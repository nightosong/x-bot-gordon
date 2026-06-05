import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const workspaceRoot = path.resolve(process.env.GORDON_WORKSPACE_ROOT || process.cwd());
const gordonHome = path.resolve(process.env.GORDON_HOME || path.join(os.homedir(), ".gord"));
const dataRoot = path.resolve(process.env.GORDON_DATA_ROOT || path.join(gordonHome, "data"));
const toolConfigsPath = path.join(dataRoot, "workbench", "tool-configs.json");
const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_OPENAI_IMAGE_N = 1;
const DEFAULT_OPENAI_IMAGE_QUALITY = "medium";
const OPENAI_IMAGE_QUALITY_VALUES = new Set(["low", "medium", "high"]);
const DEFAULT_FETCH_TIMEOUT_MS = 120_000;
const DEFAULT_IMAGE_GEN_TIMEOUT_MS = 300_000;
const FETCH_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_TOOLS_FETCH_TIMEOUT_MS", DEFAULT_FETCH_TIMEOUT_MS);
const IMAGE_GEN_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_IMAGE_GEN_TIMEOUT_MS", DEFAULT_IMAGE_GEN_TIMEOUT_MS);
const MAX_RESULT_TEXT_CHARS = 12_000;
const MUSIC_PROVIDER_VALUES = new Set(["mureka", "suno"]);

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
  },
  music_gen: {
    mureka: {
      operations: {
        generate_song: {
          endpoint: "v1/song/generate",
          parameters: ["prompt", "lyrics", "model"]
        },
        generate_instrumental: {
          endpoint: "v1/soundtrack/generate",
          parameters: ["prompt", "model", "durationSeconds"]
        },
        query: {
          endpoint: "v1/song/query/{task_id}",
          parameters: ["taskId"]
        },
        vocal_clone: {
          endpoint: "v1/vocal/clone",
          parameters: ["filePath"]
        }
      }
    },
    suno: {
      operations: {
        generate_song: {
          endpoint: "api/v1/generate",
          parameters: ["prompt", "style", "title", "model", "instrumental", "callbackUrl"]
        },
        generate_instrumental: {
          endpoint: "api/v1/generate",
          parameters: ["prompt", "style", "title", "model", "instrumental", "callbackUrl"]
        },
        query: {
          endpoint: "api/v1/generate/record-info",
          parameters: ["taskId"]
        }
      }
    }
  }
};

const TOOL_PROVIDER_DEFAULT_BASE_URLS = {
  music_gen: {
    mureka: "https://api.mureka.ai",
    suno: "https://api.sunoapi.org"
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

function readTimeoutMsFromEnv(name, fallback) {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value) || value < 1_000) {
    return fallback;
  }

  return Math.min(Math.floor(value), 900_000);
}

function normalizeBaseUrl(value, toolName, provider) {
  const configuredBaseUrl = String(value ?? "").trim();
  const fallbackBaseUrl = TOOL_PROVIDER_DEFAULT_BASE_URLS[toolName]?.[provider] ?? "";
  const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/+$/u, "");

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

function pickProvider(config, requestedProvider = "") {
  const providers = Array.isArray(config?.providers) ? config.providers : [];
  const enabledProviders = providers.filter((provider) => provider?.enabled);
  const configuredDefault = String(config?.defaultProvider ?? "").trim();
  const requested = String(requestedProvider ?? "").trim();

  if (requested) {
    return enabledProviders.find((provider) => provider?.provider === requested) ?? null;
  }

  return (
    enabledProviders.find((provider) => provider?.provider === configuredDefault) ??
    enabledProviders[0] ??
    null
  );
}

function resolveRunnableToolConfig(configs, toolName, requestedProvider = "") {
  const config = configs.find((entry) => entry?.name === toolName);

  if (!config?.enabled) {
    return null;
  }

  const provider = pickProvider(config, requestedProvider);

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

function getMusicGenToolDefinition() {
  return {
    name: "music_gen",
    description:
      "使用能力拓展 TOOL 配置中的 Mureka / Suno 音乐生成能力，支持发起歌曲或纯音乐生成任务，并通过任务 ID 查询生成结果。凭证、Base URL 和默认供应商由本地 TOOL 配置提供。",
    inputSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: ["generate_song", "generate_instrumental", "query", "vocal_clone"],
          description: "generate_song 生成歌曲，generate_instrumental 生成纯音乐 / 配乐，query 查询任务，vocal_clone 使用 Mureka 克隆人声"
        },
        provider: {
          type: "string",
          enum: ["mureka", "suno"],
          description: "可选，指定本次使用 Mureka 或 Suno；不传则使用 TOOL 默认供应商"
        },
        prompt: {
          type: "string",
          description: "音乐生成提示词，描述曲风、情绪、结构、乐器和场景"
        },
        lyrics: {
          type: "string",
          description: "可选，歌词或可唱文本；生成纯音乐时可留空"
        },
        style: {
          type: "string",
          description: "可选，曲风、情绪、BPM、乐器等标签"
        },
        title: {
          type: "string",
          description: "可选，歌曲或曲目标题"
        },
        model: {
          type: "string",
          description: "可选，默认使用 TOOL 供应商配置中的模型 / 能力 ID"
        },
        instrumental: {
          type: "boolean",
          description: "可选，Suno 生成时是否按纯音乐处理"
        },
        taskId: {
          type: "string",
          description: "查询任务时必填，由生成接口返回"
        },
        callbackUrl: {
          type: "string",
          description: "可选，Suno 回调地址；不传时可后续用 query 主动查询"
        },
        negativePrompt: {
          type: "string",
          description: "可选，负向限制词"
        },
        durationSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 3600,
          description: "可选，配乐或短曲时长，单位秒"
        },
        filePath: {
          type: "string",
          description: "vocal_clone 必填，本地音频文件路径"
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

  if (resolveRunnableToolConfig(configs, "music_gen")) {
    tools.push(getMusicGenToolDefinition());
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

async function postJson(url, apiKey, body, options = {}) {
  const timeoutMs = readRequestTimeoutMs(options.timeoutMs);
  const timeoutLabel = String(options.timeoutLabel ?? "请求").trim() || "请求";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
      throw new Error(`${timeoutLabel}超时：超过 ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(url, apiKey, options = {}) {
  const timeoutMs = readRequestTimeoutMs(options.timeoutMs);
  const timeoutLabel = String(options.timeoutLabel ?? "请求").trim() || "请求";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
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
      throw new Error(`${timeoutLabel}超时：超过 ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readRequestTimeoutMs(timeoutMs) {
  const normalized = Number(timeoutMs);

  if (!Number.isFinite(normalized) || normalized < 1_000) {
    return FETCH_TIMEOUT_MS;
  }

  return Math.min(Math.floor(normalized), 900_000);
}

function inferAudioMimeType(filePath) {
  const extension = path.extname(String(filePath ?? "")).toLowerCase();

  if (extension === ".wav") {
    return "audio/wav";
  }

  if (extension === ".m4a") {
    return "audio/mp4";
  }

  if (extension === ".ogg") {
    return "audio/ogg";
  }

  if (extension === ".aac") {
    return "audio/aac";
  }

  return "audio/mpeg";
}

async function postMultipartFile(url, apiKey, filePath, fieldName = "file", options = {}) {
  const normalizedFilePath = String(filePath ?? "").trim();

  if (!normalizedFilePath) {
    throw new Error("vocal_clone 需要 filePath 参数");
  }

  const bytes = await fs.readFile(normalizedFilePath);
  const form = new FormData();
  const blob = new Blob([bytes], { type: inferAudioMimeType(normalizedFilePath) });
  form.append(fieldName, blob, path.basename(normalizedFilePath));
  const timeoutMs = readRequestTimeoutMs(options.timeoutMs);
  const timeoutLabel = String(options.timeoutLabel ?? "请求").trim() || "请求";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form,
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
      throw new Error(`${timeoutLabel}超时：超过 ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMusicOperation(value) {
  const operation = String(value ?? "").trim();

  if (operation === "generate" || operation === "song") {
    return "generate_song";
  }

  if (operation === "instrumental" || operation === "soundtrack") {
    return "generate_instrumental";
  }

  return ["generate_song", "generate_instrumental", "query", "vocal_clone"].includes(operation) ? operation : "";
}

function getMusicDurationSeconds(argumentsObject) {
  const rawValue = argumentsObject?.durationSeconds ?? argumentsObject?.duration ?? undefined;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  const duration = Number(rawValue);

  if (!Number.isFinite(duration) || duration < 1 || duration > 3600) {
    throw new Error("durationSeconds 需要是 1-3600 之间的数字");
  }

  return Math.round(duration);
}

function compactMusicPrompt(...parts) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function buildMurekaMusicRequestBody(operationName, argumentsObject, model) {
  const prompt = compactMusicPrompt(argumentsObject?.prompt, argumentsObject?.style);
  const lyrics = String(argumentsObject?.lyrics ?? "").trim();
  const durationSeconds = getMusicDurationSeconds(argumentsObject);

  if (!prompt && !lyrics) {
    throw new Error("Mureka 音乐生成需要 prompt 或 lyrics 参数");
  }

  if (operationName === "generate_song") {
    return {
      ...(lyrics ? { lyrics } : {}),
      ...(model ? { model } : {}),
      ...(prompt ? { prompt } : {})
    };
  }

  return {
    prompt: prompt || lyrics,
    ...(model ? { model } : {}),
    ...(durationSeconds ? { duration: durationSeconds } : {})
  };
}

function buildSunoMusicRequestBody(operationName, argumentsObject, model) {
  const prompt = compactMusicPrompt(argumentsObject?.lyrics, argumentsObject?.prompt);
  const style = String(argumentsObject?.style ?? "").trim();
  const title = String(argumentsObject?.title ?? "").trim();
  const callbackUrl = String(argumentsObject?.callbackUrl ?? argumentsObject?.callBackUrl ?? "").trim();
  const negativePrompt = String(argumentsObject?.negativePrompt ?? "").trim();
  const instrumental =
    typeof argumentsObject?.instrumental === "boolean"
      ? argumentsObject.instrumental
      : operationName === "generate_instrumental";

  if (!prompt && !style) {
    throw new Error("Suno 音乐生成需要 prompt、lyrics 或 style 参数");
  }

  return {
    prompt: prompt || style,
    customMode: Boolean(style || title),
    instrumental,
    ...(model ? { model } : {}),
    ...(style ? { style } : {}),
    ...(title ? { title } : {}),
    ...(negativePrompt ? { negativeTags: negativePrompt } : {}),
    ...(callbackUrl ? { callBackUrl: callbackUrl } : {})
  };
}

function buildMusicRequestBody(provider, operationName, argumentsObject, model) {
  if (provider === "mureka") {
    return buildMurekaMusicRequestBody(operationName, argumentsObject, model);
  }

  if (provider === "suno") {
    return buildSunoMusicRequestBody(operationName, argumentsObject, model);
  }

  throw new Error(`music_gen 暂不支持供应商：${provider}`);
}

function buildMusicQueryUrl(baseUrl, operation, provider, taskId) {
  if (provider === "mureka") {
    return joinUrl(baseUrl, operation.endpoint.replace("{task_id}", encodeURIComponent(taskId)));
  }

  const url = new URL(joinUrl(baseUrl, operation.endpoint));
  url.searchParams.set("taskId", taskId);
  return url.toString();
}

function sanitizeMusicRequestBody(requestBody) {
  if (!requestBody || typeof requestBody !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(requestBody).map(([key, value]) => {
      if (typeof value === "string" && ["prompt", "lyrics", "style", "negativeTags"].includes(key)) {
        return [key, truncateText(value, 260)];
      }

      return [key, value];
    })
  );
}

function getMusicResponseError(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }

  const error = responseJson.error ?? responseJson.err ?? responseJson.errors;

  if (error) {
    if (typeof error === "string") {
      return error.trim();
    }

    if (typeof error === "object") {
      const code = typeof error.code === "string" && error.code.trim() ? error.code.trim() : "";
      const message = typeof error.message === "string" && error.message.trim() ? error.message.trim() : "";
      return [code, message].filter(Boolean).join(": ") || JSON.stringify(error);
    }

    return String(error);
  }

  const code = String(responseJson.code ?? "").trim().toLowerCase();

  if (typeof responseJson.msg === "string" && responseJson.msg.trim() && code && !["0", "200", "success"].includes(code)) {
    return responseJson.msg.trim();
  }

  if (typeof responseJson.message === "string" && responseJson.message.trim() && responseJson.status === "error") {
    return responseJson.message.trim();
  }

  return "";
}

function pickNestedText(value, keys) {
  if (!value || typeof value !== "object") {
    return "";
  }

  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return "";
}

function extractMusicTaskId(responseJson) {
  const seen = new WeakSet();
  const queue = [responseJson];

  while (queue.length) {
    const item = queue.shift();

    if (!item || typeof item !== "object") {
      continue;
    }

    if (seen.has(item)) {
      continue;
    }

    seen.add(item);

    const taskId = pickNestedText(item, ["task_id", "taskId", "taskID", "id"]);

    if (taskId) {
      return taskId;
    }

    for (const value of Object.values(item)) {
      if (Array.isArray(value)) {
        queue.push(...value);
      } else if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return "";
}

function extractMusicStatus(responseJson) {
  const seen = new WeakSet();
  const queue = [responseJson];

  while (queue.length) {
    const item = queue.shift();

    if (!item || typeof item !== "object") {
      continue;
    }

    if (seen.has(item)) {
      continue;
    }

    seen.add(item);

    const status = pickNestedText(item, ["status", "state", "task_status", "taskStatus"]);

    if (status) {
      return status;
    }

    for (const value of Object.values(item)) {
      if (Array.isArray(value)) {
        queue.push(...value);
      } else if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return "";
}

function pickMusicAudioUrl(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const key of [
    "audio_url",
    "audioUrl",
    "stream_audio_url",
    "streamAudioUrl",
    "sourceAudioUrl",
    "sourceStreamAudioUrl",
    "mp3_url",
    "mp3Url",
    "song_url",
    "songUrl",
    "wav_url",
    "wavUrl"
  ]) {
    const value = item[key];

    if (typeof value === "string" && /^https?:\/\//iu.test(value.trim())) {
      return value.trim();
    }
  }

  const url = typeof item.url === "string" ? item.url.trim() : "";
  const mimeType = String(item.mimeType ?? item.mime_type ?? item.type ?? "").toLowerCase();

  if (url && /^https?:\/\//iu.test(url) && (mimeType.includes("audio") || /\.(mp3|wav|m4a|aac|ogg)(?:[?#].*)?$/iu.test(url))) {
    return url;
  }

  return "";
}

function pickMusicCoverUrl(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const key of ["image_url", "imageUrl", "cover_url", "coverUrl", "cover", "sourceImageUrl"]) {
    const value = item[key];

    if (typeof value === "string" && /^https?:\/\//iu.test(value.trim())) {
      return value.trim();
    }
  }

  return "";
}

function pickMusicStreamUrl(item, audioUrl) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const key of ["stream_audio_url", "streamAudioUrl", "sourceStreamAudioUrl"]) {
    const value = item[key];

    if (typeof value === "string" && /^https?:\/\//iu.test(value.trim()) && value.trim() !== audioUrl) {
      return value.trim();
    }
  }

  return "";
}

function extractMusicArtifacts(responseJson, context) {
  const artifacts = [];
  const seenObjects = new WeakSet();
  const seenUrls = new Set();

  function visit(item) {
    if (!item || typeof item !== "object") {
      return;
    }

    if (seenObjects.has(item)) {
      return;
    }

    seenObjects.add(item);

    const audioUrl = pickMusicAudioUrl(item);

    if (audioUrl && !seenUrls.has(audioUrl)) {
      seenUrls.add(audioUrl);
      const title = pickNestedText(item, ["title", "song_name", "songName", "name"]) || `music_gen 结果 ${artifacts.length + 1}`;
      const duration = Number(item.duration ?? item.durationSeconds ?? item.duration_seconds ?? 0);
      artifacts.push({
        id: `music_gen_${Date.now()}_${artifacts.length + 1}`,
        kind: "audio",
        title,
        mimeType: "audio/mpeg",
        url: audioUrl,
        provider: context.provider,
        model: context.model,
        prompt: context.prompt,
        metadata: {
          operation: context.operation,
          endpoint: context.endpoint,
          taskId: context.taskId,
          status: context.status,
          streamUrl: pickMusicStreamUrl(item, audioUrl),
          coverUrl: pickMusicCoverUrl(item),
          ...(Number.isFinite(duration) && duration > 0 ? { durationSeconds: duration } : {})
        }
      });
    }

    for (const value of Object.values(item)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => visit(entry));
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  }

  visit(responseJson);
  return artifacts;
}

function sanitizeMusicResponse(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return {
      raw: responseJson
    };
  }

  return {
    taskId: extractMusicTaskId(responseJson),
    status: extractMusicStatus(responseJson),
    responseKeys: Object.keys(responseJson),
    raw: responseJson
  };
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
    imageCount: images.length,
    timeoutMs: IMAGE_GEN_TIMEOUT_MS
  };
  const requestStartedAt = Date.now();
  logToolCall("image_gen request", callLog);
  let response;

  try {
    response = await postJson(endpoint, apiKey, requestBody, {
      timeoutMs: IMAGE_GEN_TIMEOUT_MS,
      timeoutLabel: "image_gen 请求"
    });
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

async function callMusicGen(argumentsObject) {
  const operationName = normalizeMusicOperation(argumentsObject?.operation);

  if (!operationName) {
    throw new Error("music_gen 需要 operation 参数，可选 generate_song、generate_instrumental、query");
  }

  const requestedProvider = String(argumentsObject?.provider ?? "").trim();

  if (requestedProvider && !MUSIC_PROVIDER_VALUES.has(requestedProvider)) {
    throw new Error("music_gen 的 provider 仅支持 mureka 或 suno");
  }

  const configs = await readToolConfigs();
  const resolved = resolveRunnableToolConfig(configs, "music_gen", requestedProvider);

  if (!resolved) {
    throw new Error("music_gen 未启用，或目标供应商未启用 / 未配置运行时。请先在能力拓展的 TOOL 配置中启用 music_gen。");
  }

  const { provider, runtime } = resolved;
  const operation = runtime.operations[operationName];

  if (!operation) {
    throw new Error(`music_gen 当前供应商不支持 ${operationName}`);
  }

  if (operationName === "vocal_clone" && provider.provider !== "mureka") {
    throw new Error("vocal_clone 当前仅支持 Mureka 供应商");
  }

  const apiKey = String(provider.apiKey ?? "").trim();
  const baseUrl = normalizeBaseUrl(provider.baseUrl, "music_gen", provider.provider);
  const model = String(argumentsObject?.model ?? provider.model ?? "").trim();

  if (!apiKey) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少 API Key`);
  }

  if (!baseUrl) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少 Base URL`);
  }

  const prompt = compactMusicPrompt(argumentsObject?.prompt, argumentsObject?.style);
  const taskId = String(argumentsObject?.taskId ?? "").trim();
  const requestStartedAt = Date.now();
  let endpoint = joinUrl(baseUrl, operation.endpoint);
  let requestBody = null;
  let response;
  const vocalFilePath = String(argumentsObject?.filePath ?? "").trim();

  if (operationName === "query") {
    if (!taskId) {
      throw new Error("music_gen 查询需要 taskId 参数");
    }

    endpoint = buildMusicQueryUrl(baseUrl, operation, provider.provider, taskId);
  } else if (operationName === "vocal_clone") {
    if (!vocalFilePath) {
      throw new Error("vocal_clone 需要 filePath 参数");
    }
  } else {
    requestBody = buildMusicRequestBody(provider.provider, operationName, argumentsObject, model);
  }

  const callLog = {
    tool: "music_gen",
    provider: provider.provider,
    endpoint: operation.endpoint,
    url: endpoint,
    model,
    operation: operationName,
    ...(taskId ? { taskId } : {}),
    ...(vocalFilePath ? { filePath: vocalFilePath } : {}),
    ...(requestBody ? { requestBody: sanitizeMusicRequestBody(requestBody) } : {}),
    prompt: truncateText(prompt, 240)
  };
  logToolCall("music_gen request", callLog);

  try {
    if (operationName === "query") {
      response = await getJson(endpoint, apiKey);
    } else if (operationName === "vocal_clone") {
      response = await postMultipartFile(endpoint, apiKey, vocalFilePath);
    } else {
      response = await postJson(endpoint, apiKey, requestBody);
    }
  } catch (error) {
    logToolCall("music_gen failure", {
      ...callLog,
      durationMs: Date.now() - requestStartedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  const sanitized = sanitizeMusicResponse(response);
  const responseTaskId = extractMusicTaskId(response) || taskId;
  const responseStatus = extractMusicStatus(response);
  const responseError = getMusicResponseError(response);
  const artifacts = extractMusicArtifacts(response, {
    provider: provider.provider,
    model,
    prompt,
    operation: operationName,
    endpoint: operation.endpoint,
    taskId: responseTaskId,
    status: responseStatus
  });

  logToolCall("music_gen response", {
    ...callLog,
    durationMs: Date.now() - requestStartedAt,
    taskId: responseTaskId,
    status: responseStatus,
    artifacts: artifacts.length,
    responseKeys: sanitized.responseKeys
  });

  if (responseError) {
    throw new Error(`上游音乐接口返回错误：${responseError}`);
  }

  return buildTextResult(
    `music_gen 调用完成
provider=${provider.label || provider.provider}
endpoint=${operation.endpoint}
${model ? `model=${model}\n` : ""}operation=${operationName}
${responseTaskId ? `taskId=${responseTaskId}\n` : ""}${responseStatus ? `status=${responseStatus}\n` : ""}artifacts=${artifacts.length}

结果摘要：
${truncateText(JSON.stringify(sanitized.raw ?? sanitized, null, 2))}`,
    {
      provider: provider.provider,
      endpoint: operation.endpoint,
      model,
      operation: operationName,
      taskId: responseTaskId,
      status: responseStatus,
      call: callLog,
      ...(requestBody ? { requestBody: sanitizeMusicRequestBody(requestBody) } : {}),
      artifacts,
      result: sanitized.raw ?? sanitized
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

    if (toolName === "music_gen") {
      ok(id, await callMusicGen(argumentsObject));
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
