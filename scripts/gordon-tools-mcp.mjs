import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const workspaceRoot = path.resolve(process.env.GORDON_WORKSPACE_ROOT || process.cwd());
const toolConfigsPath = path.join(workspaceRoot, "data", "workbench", "tool-configs.json");
const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_OPENAI_IMAGE_N = 1;
const DEFAULT_OPENAI_IMAGE_QUALITY = "medium";
const OPENAI_IMAGE_QUALITY_VALUES = new Set(["low", "medium", "high"]);
const FETCH_TIMEOUT_MS = 120_000;
const MAX_RESULT_TEXT_CHARS = 12_000;

const TOOL_RUNTIME = {
  image_gen: {
    openai: {
      operations: {
        text_to_image: {
          endpoint: "imagen",
          parameters: ["prompt", "model", "size", "n", "quality"]
        },
        image_to_image: {
          endpoint: "imagen/edit",
          parameters: ["prompt", "model", "size", "n", "quality", "image", "images"]
        }
      }
    }
  }
};

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function ok(id, result) {
  send({
    jsonrpc: "2.0",
    id,
    result
  });
}

function fail(id, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message
    }
  });
}

function buildTextResult(text, structuredContent = undefined) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    ...(structuredContent ? { structuredContent } : {})
  };
}

function logToolCall(message, payload = {}) {
  console.error(`[gordon-tools] ${message} ${JSON.stringify(payload)}`);
}

function truncateText(value, maxChars = MAX_RESULT_TEXT_CHARS) {
  const text = String(value ?? "");

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n...（已截断 ${text.length - maxChars} 字符）`;
}

function normalizeBaseUrl(value, toolName, provider) {
  const baseUrl = String(value ?? "").trim().replace(/\/+$/u, "");

  if (toolName === "image_gen" && provider === "openai") {
    return baseUrl.replace(/\/imagen(?:\/edit(?:\/base64)?)?$/u, "");
  }

  return baseUrl;
}

function joinUrl(baseUrl, endpoint) {
  const normalizedBaseUrl = String(baseUrl ?? "").trim().replace(/\/+$/u, "");
  const normalizedEndpoint = String(endpoint ?? "").trim().replace(/^\/+/u, "");

  if (!normalizedBaseUrl || !normalizedEndpoint) {
    throw new Error("工具服务地址或端点为空");
  }

  return `${normalizedBaseUrl}/${normalizedEndpoint}`;
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return [];
}

function getImageQuality(argumentsObject, provider) {
  if (provider !== "openai") {
    return "";
  }

  const explicitQuality = String(argumentsObject?.quality ?? "").trim();

  if (!explicitQuality) {
    return DEFAULT_OPENAI_IMAGE_QUALITY;
  }

  if (!OPENAI_IMAGE_QUALITY_VALUES.has(explicitQuality)) {
    throw new Error("OpenAI 图片模型的 quality 仅支持 low、medium、high");
  }

  return explicitQuality;
}

function getImageCount(argumentsObject, provider) {
  if (provider !== "openai") {
    return undefined;
  }

  const rawValue = argumentsObject?.n ?? DEFAULT_OPENAI_IMAGE_N;
  const count = typeof rawValue === "number" ? rawValue : Number(String(rawValue ?? "").trim());

  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error("OpenAI 图片模型的 n 需要是 1-10 之间的整数");
  }

  return count;
}

function sanitizeImageRequestBody(requestBody) {
  if (!requestBody || typeof requestBody !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(requestBody).map(([key, value]) => {
      if (key === "prompt" && typeof value === "string") {
        return [key, truncateText(value, 240)];
      }

      if (key === "image" && typeof value === "string") {
        return [key, `[图片输入已省略，${value.length} 字符]`];
      }

      if (key === "images" && Array.isArray(value)) {
        return [key, value.map((item) => `[图片输入已省略，${String(item ?? "").length} 字符]`)];
      }

      return [key, value];
    })
  );
}

async function readToolConfigs() {
  try {
    const raw = await fs.readFile(toolConfigsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw new Error(`读取 TOOL 配置失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function pickProvider(config) {
  const providers = Array.isArray(config?.providers) ? config.providers : [];
  const enabledProviders = providers.filter((provider) => provider?.enabled);
  const configuredDefault = String(config?.defaultProvider ?? "").trim();

  return (
    enabledProviders.find((provider) => provider?.provider === configuredDefault) ??
    enabledProviders[0] ??
    null
  );
}

function resolveRunnableToolConfig(configs, toolName) {
  const config = configs.find((entry) => entry?.name === toolName);

  if (!config?.enabled) {
    return null;
  }

  const provider = pickProvider(config);

  if (!provider?.enabled) {
    return null;
  }

  const runtime = TOOL_RUNTIME[toolName]?.[provider.provider];

  if (!runtime) {
    return null;
  }

  return {
    config,
    provider,
    runtime
  };
}

function getImageGenToolDefinition() {
  return {
    name: "image_gen",
    description:
      "使用能力拓展 TOOL 配置中的图片生成能力。文生图传 prompt/model/size，可选 n/quality；图生图传 image 或 images。凭证、Base URL 和默认供应商由本地 TOOL 配置提供。",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description: "图片生成或编辑的提示词"
        },
        model: {
          type: "string",
          description: "可选，默认使用 TOOL 供应商配置中的模型，例如 gpt-image-2"
        },
        size: {
          type: "string",
          description: "可选，图片尺寸，例如 1024x1024"
        },
        n: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "可选，仅 OpenAI 图片模型生效，生成图像数量，默认 1"
        },
        quality: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "可选，仅 OpenAI 图片模型生效，图片质量，默认 medium"
        },
        image: {
          type: "string",
          description: "可选，单张输入图片，通常为 base64、data URL 或可访问图片 URL；传入后走图生图"
        },
        images: {
          type: "array",
          items: {
            type: "string"
          },
          description: "可选，多张输入图片，通常为 base64、data URL 或可访问图片 URL；传入后走图生图"
        }
      },
      additionalProperties: false
    }
  };
}

async function getTools() {
  const configs = await readToolConfigs();
  const tools = [];

  if (resolveRunnableToolConfig(configs, "image_gen")) {
    tools.push(getImageGenToolDefinition());
  }

  return tools;
}

function sanitizeImageDataItem(item, index) {
  if (!item || typeof item !== "object") {
    return {
      index,
      value: item
    };
  }

  const url = typeof item.url === "string" && item.url.trim() ? item.url.trim() : undefined;
  const revisedPrompt = typeof item.revised_prompt === "string" && item.revised_prompt.trim() ? item.revised_prompt.trim() : undefined;
  const b64Json = typeof item.b64_json === "string" ? item.b64_json : "";

  return {
    index,
    ...(url ? { url } : {}),
    ...(revisedPrompt ? { revisedPrompt } : {}),
    ...(b64Json ? { b64JsonBytes: Buffer.byteLength(b64Json, "utf8") } : {})
  };
}

function sanitizeImageResponse(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return {
      raw: responseJson
    };
  }

  return {
    ...(responseJson.id ? { id: responseJson.id } : {}),
    ...(responseJson.created ? { created: responseJson.created } : {}),
    ...(responseJson.usage ? { usage: responseJson.usage } : {}),
    ...(responseJson.cost ? { cost: responseJson.cost } : {}),
    ...(Array.isArray(responseJson.data)
      ? {
          data: responseJson.data.map((item, index) => sanitizeImageDataItem(item, index))
        }
      : {}),
    responseKeys: Object.keys(responseJson)
  };
}

function getImageResponseError(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }

  if (responseJson.error) {
    const error = responseJson.error;

    if (typeof error === "string") {
      return error.trim();
    }

    if (typeof error === "object") {
      const code = typeof error.code === "string" && error.code.trim() ? error.code.trim() : "";
      const message = typeof error.message === "string" && error.message.trim() ? error.message.trim() : "";
      return [code, message].filter(Boolean).join(": ");
    }

    return String(error);
  }

  if (typeof responseJson.message === "string" && responseJson.message.trim()) {
    return responseJson.message.trim();
  }

  return "";
}

function normalizeImageArtifactUrl(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  const directUrl = typeof item.url === "string" && item.url.trim() ? item.url.trim() : "";

  if (directUrl) {
    return directUrl;
  }

  if (item.image_url && typeof item.image_url === "object" && typeof item.image_url.url === "string") {
    return item.image_url.url.trim();
  }

  return "";
}

function normalizeImageArtifactDataUrl(item) {
  if (!item || typeof item !== "object" || typeof item.b64_json !== "string" || !item.b64_json.trim()) {
    return "";
  }

  const rawValue = item.b64_json.trim();

  if (rawValue.startsWith("data:image/")) {
    return rawValue;
  }

  return `data:image/png;base64,${rawValue}`;
}

function extractImageArtifacts(responseJson, context) {
  if (!responseJson || typeof responseJson !== "object" || !Array.isArray(responseJson.data)) {
    return [];
  }

  return responseJson.data
    .map((item, index) => {
      const url = normalizeImageArtifactUrl(item);
      const dataUrl = normalizeImageArtifactDataUrl(item);

      if (!url && !dataUrl) {
        return null;
      }

      return {
        id: `image_gen_${Date.now()}_${index + 1}`,
        kind: "image",
        title: `image_gen 结果 ${index + 1}`,
        mimeType: "image/png",
        ...(url ? { url } : {}),
        ...(dataUrl ? { dataUrl } : {}),
        provider: context.provider,
        model: context.model,
        prompt: context.prompt,
        metadata: {
          operation: context.operation,
          endpoint: context.endpoint,
          index
        }
      };
    })
    .filter(Boolean);
}

async function postJson(url, apiKey, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}：${truncateText(json ? JSON.stringify(json) : text, 1200)}`);
    }

    return json ?? text;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`请求超时：超过 ${FETCH_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callImageGen(argumentsObject) {
  const configs = await readToolConfigs();
  const resolved = resolveRunnableToolConfig(configs, "image_gen");

  if (!resolved) {
    throw new Error("image_gen 未启用，或默认供应商未启用 / 未配置运行时。请先在能力拓展的 TOOL 配置中启用 image_gen。");
  }

  const { provider, runtime } = resolved;
  const prompt = String(argumentsObject?.prompt ?? "").trim();
  const image = String(argumentsObject?.image ?? "").trim();
  const images = toStringArray(argumentsObject?.images);
  const hasImageInput = Boolean(image) || images.length > 0;
  const operationName = hasImageInput ? "image_to_image" : "text_to_image";
  const operation = runtime.operations[operationName];

  if (!prompt) {
    throw new Error("image_gen 需要 prompt 参数");
  }

  if (!operation) {
    throw new Error(`image_gen 当前供应商不支持 ${operationName}`);
  }

  const apiKey = String(provider.apiKey ?? "").trim();
  const baseUrl = normalizeBaseUrl(provider.baseUrl, "image_gen", provider.provider);
  const model = String(argumentsObject?.model ?? provider.model ?? "").trim();
  const size = String(argumentsObject?.size ?? DEFAULT_IMAGE_SIZE).trim() || DEFAULT_IMAGE_SIZE;
  const quality = getImageQuality(argumentsObject, provider.provider);
  const count = getImageCount(argumentsObject, provider.provider);

  if (!apiKey) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少 API Key`);
  }

  if (!baseUrl) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少 Base URL`);
  }

  if (!model) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少模型 / 能力 ID`);
  }

  const requestBody = {
    prompt,
    model,
    size,
    ...(count ? { n: count } : {}),
    ...(quality ? { quality } : {}),
    ...(image ? { image } : {}),
    ...(images.length ? { images } : {})
  };
  const endpoint = joinUrl(baseUrl, operation.endpoint);
  const sanitizedRequestBody = sanitizeImageRequestBody(requestBody);
  const callLog = {
    tool: "image_gen",
    provider: provider.provider,
    endpoint: operation.endpoint,
    url: endpoint,
    model,
    size,
    ...(count ? { n: count } : {}),
    ...(quality ? { quality } : {}),
    operation: operationName,
    requestBody: sanitizedRequestBody,
    prompt: truncateText(prompt, 240),
    hasImage: Boolean(image),
    imageCount: images.length
  };
  const requestStartedAt = Date.now();
  logToolCall("image_gen request", callLog);
  let response;

  try {
    response = await postJson(endpoint, apiKey, requestBody);
  } catch (error) {
    logToolCall("image_gen failure", {
      ...callLog,
      durationMs: Date.now() - requestStartedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  const sanitized = sanitizeImageResponse(response);
  logToolCall("image_gen response", {
    ...callLog,
    durationMs: Date.now() - requestStartedAt,
    response: sanitized
  });
  const responseError = getImageResponseError(response);

  if (responseError) {
    throw new Error(`上游图片接口返回错误：${responseError}`);
  }

  const artifacts = extractImageArtifacts(response, {
    provider: provider.provider,
    model,
    prompt,
    operation: operationName,
    endpoint: operation.endpoint
  });

  if (!artifacts.length) {
    throw new Error(`上游图片接口未返回可展示图片数据：${truncateText(JSON.stringify(sanitized), 1200)}`);
  }

  return buildTextResult(
    `image_gen 调用完成
provider=${provider.label || provider.provider}
endpoint=${operation.endpoint}
model=${model}
${count ? `n=${count}\n` : ""}${quality ? `quality=${quality}\n` : ""}operation=${operationName}
artifacts=${artifacts.length}

结果摘要：
${truncateText(JSON.stringify(sanitized, null, 2))}`,
    {
      provider: provider.provider,
      endpoint: operation.endpoint,
      model,
      ...(count ? { n: count } : {}),
      ...(quality ? { quality } : {}),
      operation: operationName,
      call: callLog,
      requestBody: sanitizedRequestBody,
      artifacts,
      result: sanitized
    }
  );
}

async function handleRequest(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    ok(id, {
      protocolVersion: "2025-11-25",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "gordon-tools",
        version: "0.1.0"
      }
    });
    return;
  }

  if (method === "tools/list") {
    ok(id, {
      tools: await getTools()
    });
    return;
  }

  if (method === "tools/call") {
    const toolName = String(params?.name || "").trim();
    const argumentsObject = params?.arguments && typeof params.arguments === "object" ? params.arguments : {};

    if (toolName === "image_gen") {
      ok(id, await callImageGen(argumentsObject));
      return;
    }

    throw new Error(`未知工具：${toolName}`);
  }

  if (method === "notifications/initialized") {
    return;
  }

  throw new Error(`未知方法：${method}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", async (line) => {
  const trimmed = line.trim();

  if (!trimmed) {
    return;
  }

  let message;

  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  try {
    if (message.method === "notifications/initialized") {
      await handleRequest(message);
      return;
    }

    await handleRequest(message);
  } catch (error) {
    fail(message.id ?? null, error instanceof Error ? error.message : String(error));
  }
});
