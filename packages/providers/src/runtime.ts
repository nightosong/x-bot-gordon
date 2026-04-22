import type { ModelMessage, ModelProfile, ModelTextRequest, ModelTextResponse } from "../../shared/src/index.js";

const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  "openai",
  "openai_like",
  "doubao",
  "qwen",
  "deepseek",
  "moonshot",
  "zhipu",
  "grok"
]);

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getNestedValue(value: unknown, path: Array<string | number>): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return undefined;
      }

      current = current[segment];
      continue;
    }

    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function readTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value) && typeof value.value === "string") {
    return value.value;
  }

  return "";
}

function readTextField(content: Record<string, unknown>, key: string): string {
  if (!(key in content)) {
    return "";
  }

  return parseOpenAiMessageContent(content[key]).trim();
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

  if (isRecord(content)) {
    for (const key of [
      "text",
      "output_text",
      "content",
      "parts",
      "messages",
      "message",
      "response",
      "answer",
      "completion",
      "reasoning_content",
      "reasoning",
      "summary"
    ]) {
      const text = readTextField(content, key);

      if (text) {
        return text;
      }
    }

    return "";
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (isRecord(item)) {
          const text = readTextValue(item.text);

          if (text) {
            return text;
          }

          const outputText = readTextValue(item.output_text);

          if (outputText) {
            return outputText;
          }

          if ("content" in item) {
            return parseOpenAiMessageContent(item.content);
          }
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractOpenAiCompatibleText(payload: unknown): string {
  const directCandidates = [
    getNestedValue(payload, ["choices", 0, "message", "content"]),
    getNestedValue(payload, ["choices", 0, "message", "text"]),
    getNestedValue(payload, ["choices", 0, "message", "output_text"]),
    getNestedValue(payload, ["choices", 0, "message", "parts"]),
    getNestedValue(payload, ["choices", 0, "message", "response"]),
    getNestedValue(payload, ["choices", 0, "message", "answer"]),
    getNestedValue(payload, ["choices", 0, "message", "completion"]),
    getNestedValue(payload, ["choices", 0, "message", "reasoning_content"]),
    getNestedValue(payload, ["choices", 0, "message", "reasoning"]),
    getNestedValue(payload, ["choices", 0, "text"]),
    getNestedValue(payload, ["choices", 0, "delta", "content"]),
    getNestedValue(payload, ["choices", 0, "delta", "text"]),
    getNestedValue(payload, ["output_text"]),
    getNestedValue(payload, ["content"]),
    getNestedValue(payload, ["output", 0, "content"]),
    getNestedValue(payload, ["output", 0, "text"]),
    getNestedValue(payload, ["response"]),
    getNestedValue(payload, ["answer"])
  ];

  for (const candidate of directCandidates) {
    const text = parseOpenAiMessageContent(candidate).trim();

    if (text) {
      return text;
    }
  }

  const choices = getNestedValue(payload, ["choices"]);

  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const text = parseOpenAiMessageContent(getNestedValue(choice, ["message", "content"])).trim()
        || parseOpenAiMessageContent(getNestedValue(choice, ["text"])).trim();

      if (text) {
        return text;
      }
    }
  }

  const outputs = getNestedValue(payload, ["output"]);

  if (Array.isArray(outputs)) {
    for (const output of outputs) {
      const text = parseOpenAiMessageContent(getNestedValue(output, ["content"])).trim()
        || parseOpenAiMessageContent(getNestedValue(output, ["text"])).trim();

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function sanitizeUrlForLogging(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.replace(/\?.*$/, "");
  }
}

function buildLogPreview(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 400)}…[truncated ${value.length - 400} chars]` : value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, 6).map((item) => buildLogPreview(item, depth + 1));
    return value.length > 6 ? [...items, `...(${value.length - 6} more items)`] : items;
  }

  if (!isRecord(value)) {
    return typeof value;
  }

  if (depth >= 4) {
    return `[Object keys: ${Object.keys(value).slice(0, 8).join(", ")}]`;
  }

  const preview: Record<string, unknown> = {};
  const entries = Object.entries(value);

  for (const [key, entryValue] of entries.slice(0, 12)) {
    if (/(authorization|api[-_]?key|token|secret|password)/i.test(key)) {
      preview[key] = "[REDACTED]";
      continue;
    }

    preview[key] = buildLogPreview(entryValue, depth + 1);
  }

  if (entries.length > 12) {
    preview.__truncatedKeys = `${entries.length - 12} more keys`;
  }

  return preview;
}

function buildMissingTextReason(payload: unknown): string | null {
  const finishReason = getNestedValue(payload, ["choices", 0, "finish_reason"]);

  if (typeof finishReason === "string" && finishReason.trim()) {
    return `finish_reason=${finishReason.trim()}`;
  }

  const refusal = parseOpenAiMessageContent(getNestedValue(payload, ["choices", 0, "message", "refusal"])).trim();

  if (refusal) {
    return "模型返回了 refusal，但没有正文内容";
  }

  if (Array.isArray(getNestedValue(payload, ["choices", 0, "message", "tool_calls"]))) {
    return "模型返回了 tool_calls，但没有正文内容";
  }

  return null;
}

function logMissingOpenAiStyleText(
  profile: ModelProfile,
  endpoint: string,
  payload: unknown
): void {
  const reason = buildMissingTextReason(payload);
  const payloadPreview = buildLogPreview(payload);

  console.error("[providers] OpenAI-style response missing usable text", {
    provider: profile.provider,
    profileId: profile.id,
    profileLabel: profile.displayName,
    model: profile.model,
    endpoint: sanitizeUrlForLogging(endpoint),
    ...(reason ? { reason } : {}),
    payloadPreview,
    payloadPreviewJson: JSON.stringify(payloadPreview, null, 2)
  });
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

function buildAzureEndpoint(profile: ModelProfile): string {
  const baseUrl = trimTrailingSlash(profile.baseUrl?.trim() || "");
  const defaultApiVersion = "2024-10-21";

  if (!baseUrl) {
    throw new Error("Azure 配置缺少 Base URL");
  }

  if (baseUrl.includes("/chat/completions")) {
    return baseUrl.includes("api-version=")
      ? baseUrl
      : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}api-version=${defaultApiVersion}`;
  }

  if (baseUrl.includes("{deployment}")) {
    const resolved = baseUrl.replaceAll("{deployment}", encodeURIComponent(profile.model));
    const normalized = resolved.includes("/chat/completions") ? resolved : `${trimTrailingSlash(resolved)}/chat/completions`;
    return normalized.includes("api-version=")
      ? normalized
      : `${normalized}${normalized.includes("?") ? "&" : "?"}api-version=${defaultApiVersion}`;
  }

  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  const endpoint = normalizedBaseUrl.includes("/openai/deployments/")
    ? `${normalizedBaseUrl}/chat/completions`
    : `${normalizedBaseUrl}/openai/deployments/${encodeURIComponent(profile.model)}/chat/completions`;

  return endpoint.includes("api-version=")
    ? endpoint
    : `${endpoint}${endpoint.includes("?") ? "&" : "?"}api-version=${defaultApiVersion}`;
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
  const text = extractOpenAiCompatibleText(payload).trim();

  if (!text) {
    logMissingOpenAiStyleText(profile, endpoint, payload);
    const reason = buildMissingTextReason(payload);
    throw new Error(reason ? `模型没有返回可用文本内容（${reason}）` : "模型没有返回可用文本内容");
  }

  return {
    text,
    model: profile.model,
    profileId: profile.id,
    profileLabel: profile.displayName,
    provider: profile.provider
  };
}

async function invokeAzure(profile: ModelProfile, request: ModelTextRequest): Promise<ModelTextResponse> {
  const response = await fetch(buildAzureEndpoint(profile), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": profile.apiKey
    },
    body: JSON.stringify({
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
  const text = extractOpenAiCompatibleText(payload).trim();

  if (!text) {
    logMissingOpenAiStyleText(profile, buildAzureEndpoint(profile), payload);
    const reason = buildMissingTextReason(payload);
    throw new Error(reason ? `模型没有返回可用文本内容（${reason}）` : "模型没有返回可用文本内容");
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
  if (OPENAI_COMPATIBLE_PROVIDERS.has(profile.provider)) {
    return invokeOpenAiCompatible(profile, request);
  }

  if (profile.provider === "azure") {
    return invokeAzure(profile, request);
  }

  if (profile.provider === "anthropic") {
    return invokeAnthropic(profile, request);
  }

  if (profile.provider === "google") {
    return invokeGoogle(profile, request);
  }

  throw new Error(`暂不支持的模型供应商：${profile.provider}`);
}
