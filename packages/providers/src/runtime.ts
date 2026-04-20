import type { ModelMessage, ModelProfile, ModelTextRequest, ModelTextResponse } from "../../shared/src/index.js";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getSystemPrompt(messages: ModelMessage[]): string | null {
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content.trim());
  const joined = systemMessages.filter(Boolean).join("\n\n");

  return joined || null;
}

function getConversationMessages(messages: ModelMessage[]): ModelMessage[] {
  const conversation = messages.filter((message) => message.role !== "system");

  return conversation.length ? conversation : [{ role: "user", content: "" }];
}

function parseOpenAiMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("error" in payload) {
    const error = payload.error;

    if (typeof error === "string") {
      return error;
    }

    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message;
    }
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    return extractErrorMessage(payload) ?? `HTTP ${response.status}`;
  } catch {
    const text = await response.text();
    return text.trim() || `HTTP ${response.status}`;
  }
}

async function invokeOpenAiCompatible(profile: ModelProfile, request: ModelTextRequest): Promise<ModelTextResponse> {
  const endpoint = `${trimTrailingSlash(profile.baseUrl?.trim() || "https://api.openai.com/v1")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`,
      ...(profile.organization?.trim() ? { "OpenAI-Organization": profile.organization.trim() } : {})
    },
    body: JSON.stringify({
      model: profile.model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      ...(typeof request.maxOutputTokens === "number" ? { max_tokens: request.maxOutputTokens } : {})
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };
  const text = parseOpenAiMessageContent(payload.choices?.[0]?.message?.content).trim();

  if (!text) {
    throw new Error("模型没有返回可用文本内容");
  }

  return {
    text,
    model: profile.model,
    profileId: profile.id,
    profileLabel: profile.displayName,
    provider: profile.provider
  };
}

async function invokeAnthropic(profile: ModelProfile, request: ModelTextRequest): Promise<ModelTextResponse> {
  const endpoint = `${trimTrailingSlash(profile.baseUrl?.trim() || "https://api.anthropic.com")}/v1/messages`;
  const conversation = getConversationMessages(request.messages);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": profile.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: profile.model,
      max_tokens: request.maxOutputTokens ?? 1200,
      ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      ...(getSystemPrompt(request.messages) ? { system: getSystemPrompt(request.messages) } : {}),
      messages: conversation.map((message) => ({
        role: message.role,
        content: [{ type: "text", text: message.content }]
      }))
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = (await response.json()) as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
  const text = (payload.content ?? [])
    .map((item) => (item.type === "text" ? item.text ?? "" : ""))
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("模型没有返回可用文本内容");
  }

  return {
    text,
    model: profile.model,
    profileId: profile.id,
    profileLabel: profile.displayName,
    provider: profile.provider
  };
}

function buildGoogleEndpoint(profile: ModelProfile): string {
  const baseUrl = profile.baseUrl?.trim();
  const defaultEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;

  if (!baseUrl) {
    return defaultEndpoint;
  }

  if (baseUrl.includes(":generateContent")) {
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(profile.apiKey)}`;
  }

  if (baseUrl.includes("{model}")) {
    const resolved = baseUrl.replaceAll("{model}", encodeURIComponent(profile.model));
    return `${resolved}${resolved.includes("?") ? "&" : "?"}key=${encodeURIComponent(profile.apiKey)}`;
  }

  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  return `${normalizedBaseUrl}/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;
}

async function invokeGoogle(profile: ModelProfile, request: ModelTextRequest): Promise<ModelTextResponse> {
  const systemPrompt = getSystemPrompt(request.messages);
  const conversation = getConversationMessages(request.messages);
  const response = await fetch(buildGoogleEndpoint(profile), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
      contents: conversation.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
      generationConfig: {
        ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
        ...(typeof request.maxOutputTokens === "number" ? { maxOutputTokens: request.maxOutputTokens } : {})
      }
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("模型没有返回可用文本内容");
  }

  return {
    text,
    model: profile.model,
    profileId: profile.id,
    profileLabel: profile.displayName,
    provider: profile.provider
  };
}

export async function invokeModelText(profile: ModelProfile, request: ModelTextRequest): Promise<ModelTextResponse> {
  if (profile.provider === "openai" || profile.provider === "openai_like") {
    return invokeOpenAiCompatible(profile, request);
  }

  if (profile.provider === "anthropic") {
    return invokeAnthropic(profile, request);
  }

  if (profile.provider === "google") {
    return invokeGoogle(profile, request);
  }

  throw new Error(`暂不支持的模型供应商：${profile.provider}`);
}
