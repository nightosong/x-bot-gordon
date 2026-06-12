import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

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
const DEFAULT_MEDIA_SUBMIT_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_TOOLS_FETCH_TIMEOUT_MS", DEFAULT_FETCH_TIMEOUT_MS);
const IMAGE_GEN_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_IMAGE_GEN_TIMEOUT_MS", DEFAULT_IMAGE_GEN_TIMEOUT_MS);
const VIDEO_GEN_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_VIDEO_GEN_TIMEOUT_MS", DEFAULT_MEDIA_SUBMIT_TIMEOUT_MS);
const VIDEO_QUERY_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_VIDEO_GEN_QUERY_TIMEOUT_MS", 12_000);
const DEFAULT_VIDEO_POLL_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_VIDEO_GEN_POLL_TIMEOUT_MS", 70_000);
const MUSIC_GEN_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_MUSIC_GEN_TIMEOUT_MS", DEFAULT_MEDIA_SUBMIT_TIMEOUT_MS);
const MUSIC_QUERY_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_MUSIC_GEN_QUERY_TIMEOUT_MS", 12_000);
const DEFAULT_MUSIC_POLL_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_MUSIC_GEN_POLL_TIMEOUT_MS", 90_000);
const CURL_FALLBACK_TIMEOUT_MS = readTimeoutMsFromEnv("GORDON_TOOLS_CURL_FALLBACK_TIMEOUT_MS", 20_000);
const MAX_RESULT_TEXT_CHARS = 12_000;
const MUSIC_PROVIDER_VALUES = new Set(["mureka", "suno"]);
const VIDEO_PROVIDER_VALUES = new Set(["seedance"]);
const DEFAULT_VIDEO_DURATION_SECONDS = 5;
const DEFAULT_VIDEO_RATIO = "16:9";
const DEFAULT_VIDEO_RESOLUTION = "720p";
const DEFAULT_VIDEO_POLL_INTERVAL_MS = readTimeoutMsFromEnv("GORDON_VIDEO_GEN_POLL_INTERVAL_MS", 5_000);
const DEFAULT_VIDEO_POLL_ATTEMPTS = readIntegerFromEnv("GORDON_VIDEO_GEN_POLL_ATTEMPTS", 12);
const VIDEO_QUERY_NETWORK_RETRY_ATTEMPTS = readIntegerFromEnv("GORDON_VIDEO_GEN_QUERY_NETWORK_RETRY_ATTEMPTS", 2);
const VIDEO_QUERY_NETWORK_RETRY_DELAY_MS = readTimeoutMsFromEnv("GORDON_VIDEO_GEN_QUERY_NETWORK_RETRY_DELAY_MS", 1_500);
const VIDEO_POLL_MAX_NETWORK_ERRORS = readIntegerFromEnv("GORDON_VIDEO_GEN_POLL_MAX_NETWORK_ERRORS", 3);
const DEFAULT_MUSIC_POLL_INTERVAL_MS = readTimeoutMsFromEnv("GORDON_MUSIC_GEN_POLL_INTERVAL_MS", 5_000);
const DEFAULT_MUSIC_POLL_ATTEMPTS = readIntegerFromEnv("GORDON_MUSIC_GEN_POLL_ATTEMPTS", 18);

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
  video_gen: {
    seedance: {
      operations: {
        submit: {
          endpoint: "api/v3/contents/generations/tasks",
          parameters: [
            "mode",
            "prompt",
            "model",
            "durationSeconds",
            "ratio",
            "resolution",
            "image",
            "firstFrameImage",
            "lastFrameImage",
            "referenceImages",
            "referenceVideos",
            "referenceAudios",
            "returnLastFrame",
            "generateAudio",
            "frames",
            "priority"
          ]
        },
        query: {
          endpoint: "api/v3/contents/generations/tasks/{task_id}",
          parameters: ["taskId"]
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
          endpoint: "gpt-proxy/suno/generate",
          parameters: ["prompt", "model", "instrumental"]
        },
        generate_instrumental: {
          endpoint: "gpt-proxy/suno/generate",
          parameters: ["prompt", "model", "instrumental"]
        },
        query: {
          endpoint: "gpt-proxy/suno/detail",
          parameters: ["taskId"]
        }
      }
    }
  }
};

const TOOL_PROVIDER_DEFAULT_BASE_URLS = {
  video_gen: {
    seedance: ""
  },
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

function readIntegerFromEnv(name, fallback) {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(Math.floor(value), 60));
}

function normalizeBaseUrl(value, toolName, provider) {
  const configuredBaseUrl = String(value ?? "")
    .trim()
    .replace(/^["']+/u, "")
    .replace(/["']+$/u, "");
  const fallbackBaseUrl = TOOL_PROVIDER_DEFAULT_BASE_URLS[toolName]?.[provider] ?? "";
  const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/+$/u, "");

  if (toolName === "image_gen" && provider === "openai") {
    return baseUrl.replace(/\/imagen(?:\/edit(?:\/base64)?)?$/u, "");
  }

  if (toolName === "video_gen" && provider === "seedance") {
    return baseUrl
      .replace(/\/gpt-proxy\/volengine\/video(?:\/(?:submit|task(?:\/[^/]+)?))?\/?$/u, "")
      .replace(/\/api\/v3\/contents\/generations\/tasks(?:\/[^/]+)?\/?$/u, "")
      .replace(/\/api\/v3\/?$/u, "");
  }

  if (toolName === "music_gen" && provider === "suno") {
    return baseUrl.replace(/\/(?:api\/v1\/generate(?:\/record-info)?|gpt-proxy\/suno\/(?:generate|detail))$/u, "");
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

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
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
      "使用能力拓展 TOOL 配置中的 Mureka / Suno 音乐生成能力，支持发起歌曲或纯音乐生成任务，并通过任务 ID 查询生成结果。生成和查询默认会在工具层短轮询，尽量一次调用返回音频 URL；凭证、Base URL 和默认供应商由本地 TOOL 配置提供。",
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
        pollUntilComplete: {
          type: "boolean",
          description: "生成或 query 可选，是否自动轮询直到拿到音频或达到预算；默认 true"
        },
        pollIntervalMs: {
          type: "integer",
          minimum: 1000,
          maximum: 120000,
          description: "自动轮询间隔，默认 5000ms"
        },
        pollAttempts: {
          type: "integer",
          minimum: 0,
          maximum: 120,
          description: "自动轮询次数，默认 18；设为 0 表示不轮询"
        },
        pollTimeoutMs: {
          type: "integer",
          minimum: 1000,
          maximum: 900000,
          description: "自动轮询总预算，默认 90000ms；达到预算会返回 pending=true 供后续继续查询"
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

function getVideoGenToolDefinition() {
  return {
    name: "video_gen",
    description:
      "使用能力拓展 TOOL 配置中的 Seedance 视频生成能力，按火山方舟视频生成 API 提交 / 查询任务。支持 text_to_video 文生视频、first_frame_to_video 图生视频、first_last_frame_to_video 首尾帧生视频、reference_to_video 参考图 / 视频 / 音频生视频。生成是异步任务：submit 和 query 默认都会在工具层短轮询，尽量一次调用返回视频 URL；未完成时返回 taskId、状态、pending、pollExhausted 和 pollHistory。",
    inputSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: ["submit", "query"],
          description: "submit 提交视频生成任务，query 查询任务结果"
        },
        provider: {
          type: "string",
          enum: ["seedance"],
          description: "可选，当前仅支持 seedance；不传则使用 TOOL 默认供应商"
        },
        mode: {
          type: "string",
          enum: ["text_to_video", "image_to_video", "first_frame_to_video", "first_last_frame_to_video", "reference_to_video"],
          description: "submit 时可选。text_to_video 文生视频；image_to_video / first_frame_to_video 图生视频；first_last_frame_to_video 首尾帧生视频；reference_to_video 参考图 / 视频 / 音频生视频"
        },
        prompt: {
          type: "string",
          description: "视频生成提示词。文生视频必填；图生视频、首尾帧和参考生成可选但建议填写"
        },
        negativePrompt: {
          type: "string",
          description: "可选，负向限制词；会作为 negative_prompt 传给上游"
        },
        negative_prompt: {
          type: "string",
          description: "可选，negativePrompt 的官方字段别名"
        },
        model: {
          type: "string",
          description: "可选，默认使用 TOOL 供应商配置中的模型 / 能力 ID"
        },
        taskId: {
          type: "string",
          description: "query 必填，由 submit 返回"
        },
        pollUntilComplete: {
          type: "boolean",
          description: "submit 或 query 可选，是否自动轮询直到拿到视频或达到预算；默认 true"
        },
        pollIntervalMs: {
          type: "integer",
          minimum: 1000,
          maximum: 120000,
          description: "自动轮询间隔，默认 5000ms"
        },
        pollAttempts: {
          type: "integer",
          minimum: 0,
          maximum: 60,
          description: "自动轮询次数，默认 12；设为 0 表示不轮询"
        },
        pollTimeoutMs: {
          type: "integer",
          minimum: 1000,
          maximum: 900000,
          description: "自动轮询总预算，默认 90000ms；达到预算会返回 pending=true 供后续继续查询"
        },
        image: {
          type: "string",
          description: "首帧生视频的单张图片 URL / data URL / base64；等价于 firstFrameImage"
        },
        firstFrameImage: {
          type: "string",
          description: "首帧图片 URL / data URL / base64"
        },
        first_frame_image: {
          type: "string",
          description: "首帧图片 URL / data URL / base64；firstFrameImage 的官方字段别名"
        },
        lastFrameImage: {
          type: "string",
          description: "尾帧图片 URL / data URL / base64，首尾帧模式必填"
        },
        last_frame_image: {
          type: "string",
          description: "尾帧图片 URL / data URL / base64；lastFrameImage 的官方字段别名"
        },
        referenceImages: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "string"
            }
          ],
          description: "参考生视频的参考图片，支持单个字符串或数组。Seedance 2.0 支持 1-9 张；会以 role=reference_image 传入"
        },
        reference_images: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "string"
            }
          ],
          description: "referenceImages 的官方字段别名"
        },
        referenceVideos: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "string"
            }
          ],
          description: "可选，参考视频 URL / asset ID，支持单个字符串或数组，最多 3 个；会以 role=reference_video 传入"
        },
        reference_videos: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "string"
            }
          ],
          description: "referenceVideos 的官方字段别名"
        },
        referenceAudios: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "string"
            }
          ],
          description: "可选，参考音频 URL / asset ID，支持单个字符串或数组，最多 3 个；不能单独输入音频，至少同时有参考图或参考视频"
        },
        reference_audios: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "string"
            }
          ],
          description: "referenceAudios 的官方字段别名"
        },
        durationSeconds: {
          type: "integer",
          minimum: -1,
          maximum: 60,
          description: "可选，视频时长，默认 5 秒；Seedance 2.0 / 1.5 可传 -1 表示智能选择"
        },
        duration: {
          type: "integer",
          minimum: -1,
          maximum: 60,
          description: "可选，durationSeconds 的别名"
        },
        duration_seconds: {
          type: "integer",
          minimum: -1,
          maximum: 60,
          description: "可选，durationSeconds 的官方字段别名"
        },
        ratio: {
          type: "string",
          description: "可选，画幅比例，例如 16:9、9:16、1:1、adaptive，默认 16:9"
        },
        resolution: {
          type: "string",
          description: "可选，分辨率，例如 480p、720p、1080p，默认 720p"
        },
        seed: {
          type: "integer",
          minimum: -1,
          description: "可选，随机种子，范围 -1 到 2^32-1"
        },
        watermark: {
          type: "boolean",
          description: "可选，是否带水印，默认 false"
        },
        returnLastFrame: {
          type: "boolean",
          description: "可选，是否在查询结果中返回最后一帧图片"
        },
        return_last_frame: {
          type: "boolean",
          description: "可选，returnLastFrame 的官方字段别名"
        },
        callbackUrl: {
          type: "string",
          description: "可选，任务状态变更回调地址"
        },
        callback_url: {
          type: "string",
          description: "可选，callbackUrl 的官方字段别名"
        },
        generateAudio: {
          type: "boolean",
          description: "可选，是否生成音频"
        },
        generate_audio: {
          type: "boolean",
          description: "可选，generateAudio 的官方字段别名"
        },
        frames: {
          type: "integer",
          minimum: 29,
          maximum: 289,
          description: "可选，按帧数控制视频长度；frames 与 duration 二选一，传入 frames 时上游优先使用 frames"
        },
        cameraFixed: {
          type: "boolean",
          description: "可选，是否固定摄像头；Seedance 2.0 和参考图场景不支持时上游可能忽略或报错"
        },
        camera_fixed: {
          type: "boolean",
          description: "可选，cameraFixed 的官方字段别名"
        },
        draft: {
          type: "boolean",
          description: "可选，Seedance 1.5 pro 样片模式"
        },
        serviceTier: {
          type: "string",
          enum: ["default", "flex"],
          description: "可选，服务等级；Seedance 2.0 系列仅支持 default"
        },
        service_tier: {
          type: "string",
          enum: ["default", "flex"],
          description: "可选，serviceTier 的官方字段别名"
        },
        executionExpiresAfter: {
          type: "integer",
          minimum: 3600,
          maximum: 259200,
          description: "可选，任务超时阈值，单位秒"
        },
        execution_expires_after: {
          type: "integer",
          minimum: 3600,
          maximum: 259200,
          description: "可选，executionExpiresAfter 的官方字段别名"
        },
        tools: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string"
              }
            },
            additionalProperties: true
          },
          description: "可选，Seedance 2.0 工具配置，例如 [{\"type\":\"web_search\"}]"
        },
        priority: {
          type: "integer",
          minimum: 0,
          maximum: 9,
          description: "可选，Seedance 2.0 队列优先级，0-9"
        },
        safetyIdentifier: {
          type: "string",
          description: "可选，终端用户安全标识"
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

  if (resolveRunnableToolConfig(configs, "video_gen")) {
    tools.push(getVideoGenToolDefinition());
  }

  if (resolveRunnableToolConfig(configs, "music_gen")) {
    tools.push(getMusicGenToolDefinition());
  }

  return tools;
}

function sanitizeImageDataItem(item, index) {
  if (typeof item === "string") {
    const value = item.trim();
    const isUrl = /^https?:\/\//iu.test(value);
    const isDataUrl = /^data:image\//iu.test(value);

    return {
      index,
      ...(isUrl ? { url: value } : {}),
      ...(isDataUrl ? { dataUrlBytes: Buffer.byteLength(value, "utf8") } : {}),
      ...(!isUrl && !isDataUrl ? { valueBytes: Buffer.byteLength(value, "utf8") } : {})
    };
  }

  if (!item || typeof item !== "object") {
    return {
      index,
      value: item
    };
  }

  const url = normalizeImageArtifactUrl(item) || undefined;
  const dataUrl = normalizeImageArtifactDataUrl(item);
  const revisedPrompt = typeof item.revised_prompt === "string" && item.revised_prompt.trim() ? item.revised_prompt.trim() : undefined;

  return {
    index,
    ...(url ? { url } : {}),
    ...(revisedPrompt ? { revisedPrompt } : {}),
    ...(dataUrl ? { dataUrlBytes: Buffer.byteLength(dataUrl, "utf8") } : {}),
    responseKeys: Object.keys(item)
  };
}

function getImagePayloadCandidates(responseJson) {
  const candidates = [];
  const seen = new WeakSet();

  function addCandidate(value) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (seen.has(value)) {
      return;
    }

    seen.add(value);
    candidates.push(value);

    if (Array.isArray(value)) {
      return;
    }

    for (const key of ["resp_data", "respData", "result", "data", "output", "outputs", "response"]) {
      addCandidate(value[key]);
    }
  }

  addCandidate(responseJson);
  return candidates;
}

function addUniqueImageItem(items, seenObjectItems, seenPrimitiveItems, item) {
  if (!item) {
    return;
  }

  if (typeof item === "object") {
    if (seenObjectItems.has(item)) {
      return;
    }

    seenObjectItems.add(item);
    items.push(item);
    return;
  }

  const value = String(item).trim();

  if (!value || seenPrimitiveItems.has(value)) {
    return;
  }

  seenPrimitiveItems.add(value);
  items.push(value);
}

function getImageDataItems(responseJson) {
  const items = [];
  const seenObjectItems = new WeakSet();
  const seenPrimitiveItems = new Set();

  for (const candidate of getImagePayloadCandidates(responseJson)) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        addUniqueImageItem(items, seenObjectItems, seenPrimitiveItems, item);
      }
      continue;
    }

    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    for (const key of ["data", "images", "image_urls", "imageUrls", "output_urls", "outputUrls", "artifacts"]) {
      if (Array.isArray(candidate[key])) {
        for (const item of candidate[key]) {
          addUniqueImageItem(items, seenObjectItems, seenPrimitiveItems, item);
        }
      }
    }

    for (const key of [
      "image",
      "image_url",
      "imageUrl",
      "url",
      "dataUrl",
      "data_url",
      "outputUrl",
      "output_url",
      "b64_json",
      "base64",
      "image_base64",
      "imageBase64"
    ]) {
      if (candidate[key]) {
        addUniqueImageItem(items, seenObjectItems, seenPrimitiveItems, candidate);
        break;
      }
    }
  }

  return items;
}

function sanitizeImageResponse(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return {
      raw: responseJson
    };
  }

  const respData = responseJson.resp_data && typeof responseJson.resp_data === "object" ? responseJson.resp_data : null;
  const imageItems = getImageDataItems(responseJson);

  return {
    ...(responseJson.id ? { id: responseJson.id } : {}),
    ...(responseJson.code !== undefined ? { code: responseJson.code } : {}),
    ...(responseJson.code_msg ? { codeMsg: responseJson.code_msg } : {}),
    ...(responseJson.trace_id ? { traceId: responseJson.trace_id } : {}),
    ...(responseJson.created ? { created: responseJson.created } : {}),
    ...(responseJson.usage ? { usage: responseJson.usage } : {}),
    ...(responseJson.cost ? { cost: responseJson.cost } : {}),
    ...(respData ? { respDataKeys: Object.keys(respData) } : {}),
    ...(Array.isArray(responseJson.data)
      ? {
          data: responseJson.data.map((item, index) => sanitizeImageDataItem(item, index))
        }
      : {}),
    ...(imageItems.length ? { imageItems: imageItems.map((item, index) => sanitizeImageDataItem(item, index)) } : {}),
    responseKeys: Object.keys(responseJson)
  };
}

function getImageResponseError(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }

  for (const candidate of getImagePayloadCandidates(responseJson)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }

    const responseCode = candidate.code;
    const responseCodeText = String(responseCode ?? "").trim().toLowerCase();
    const isSuccessCode =
      responseCode === undefined ||
      responseCodeText === "" ||
      responseCodeText === "0" ||
      responseCodeText === "success" ||
      responseCodeText === "ok" ||
      responseCodeText === "succeeded";
    const codeMessage = typeof candidate.code_msg === "string" && candidate.code_msg.trim() ? candidate.code_msg.trim() : "";

    if (!isSuccessCode) {
      return [String(candidate.code), codeMessage].filter(Boolean).join(": ");
    }

    if (candidate.error) {
      const error = candidate.error;

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

    if (typeof candidate.message === "string" && candidate.message.trim()) {
      const message = candidate.message.trim();

      if (!/^(success|ok|succeeded)$/iu.test(message)) {
        return message;
      }
    }
  }

  return "";
}

function normalizeImageArtifactUrl(item) {
  if (typeof item === "string") {
    const value = item.trim();
    return /^https?:\/\//iu.test(value) ? value : "";
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  const directUrl = [
    item.url,
    item.imageUrl,
    item.image_url,
    item.outputUrl,
    item.output_url
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean);

  if (directUrl && !directUrl.startsWith("data:image/") && !isLikelyImageBase64(directUrl)) {
    return directUrl;
  }

  if (item.image_url && typeof item.image_url === "object" && typeof item.image_url.url === "string") {
    const nestedUrl = item.image_url.url.trim();
    return nestedUrl && !nestedUrl.startsWith("data:image/") && !isLikelyImageBase64(nestedUrl) ? nestedUrl : "";
  }

  if (item.image && typeof item.image === "object") {
    return normalizeImageArtifactUrl(item.image);
  }

  return "";
}

function isLikelyImageBase64(value) {
  const text = String(value ?? "").trim();
  return text.length > 80 && /^[A-Za-z0-9+/=\s]+$/u.test(text);
}

function normalizeImageArtifactDataUrl(item) {
  if (typeof item === "string") {
    const value = item.trim();

    if (value.startsWith("data:image/")) {
      return value;
    }

    return isLikelyImageBase64(value) ? `data:image/png;base64,${value}` : "";
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  const rawValue = [
    item.b64_json,
    item.base64,
    item.image_base64,
    item.imageBase64,
    item.dataUrl,
    item.data_url,
    item.url,
    item.imageUrl,
    item.image_url,
    item.outputUrl,
    item.output_url
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean);

  if (!rawValue && item.image && typeof item.image === "object") {
    return normalizeImageArtifactDataUrl(item.image);
  }

  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith("data:image/")) {
    return rawValue;
  }

  return isLikelyImageBase64(rawValue) ? `data:image/png;base64,${rawValue}` : "";
}

function extractImageArtifacts(responseJson, context) {
  const imageItems = getImageDataItems(responseJson);

  if (!imageItems.length) {
    return [];
  }

  return imageItems
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

function getNetworkErrorDetail(error) {
  const cause = error?.cause;
  const parts = [
    error?.name,
    error?.message,
    cause?.code,
    cause?.syscall,
    cause?.hostname,
    cause?.message
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  return [...new Set(parts)].join(" / ");
}

function isFetchNetworkFailure(error) {
  return (
    error?.name === "TypeError" &&
    /fetch failed/iu.test(String(error?.message ?? "")) &&
    /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|fetch failed/iu.test(
      getNetworkErrorDetail(error)
    )
  );
}

function normalizeNetworkErrorMessage(message) {
  const text = String(message ?? "").trim();

  if (!text) {
    return "网络连接失败：未返回错误详情";
  }

  if (/curl:\s*\(28\)|exit\s*28|timed out|timeout was reached|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/iu.test(text)) {
    return `网络连接超时：${truncateText(text, 1000)}`;
  }

  if (/ENOTFOUND|EAI_AGAIN|Could not resolve host|无法解析/iu.test(text)) {
    return `网络解析失败：${truncateText(text, 1000)}`;
  }

  if (/ECONNRESET|ECONNREFUSED|socket hang up|fetch failed/iu.test(text)) {
    return `网络连接失败：${truncateText(text, 1000)}`;
  }

  return text;
}

function isNetworkErrorMessage(message) {
  return /网络|超时|timeout|timed out|fetch failed|curl:\s*\(28\)|exit\s*28|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|socket hang up|Could not resolve host/iu.test(
    String(message ?? "")
  );
}

function isVideoSubmitUnknownNetworkMessage(message) {
  return /video_gen 提交状态未知/u.test(String(message ?? ""));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function curlJsonRequest(url, apiKey, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const body = options.body;
  const timeoutMs = Math.min(readRequestTimeoutMs(options.timeoutMs), CURL_FALLBACK_TIMEOUT_MS);
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const args = [
    "-sS",
    "-L",
    "--max-time",
    String(timeoutSeconds),
    "-X",
    method,
    "-H",
    `Authorization: Bearer ${apiKey}`,
    "-H",
    "Content-Type: application/json",
    "-w",
    "\n%{http_code}",
    url
  ];

  if (body !== undefined) {
    args.splice(args.length - 3, 0, "-d", JSON.stringify(body));
  }

  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`curl 兜底启动失败：${error.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const rawMessage = `curl 兜底请求失败（exit ${code}）：${truncateText(stderr || stdout, 1200)}`;
        reject(new Error(normalizeNetworkErrorMessage(rawMessage)));
        return;
      }

      const separatorIndex = stdout.lastIndexOf("\n");
      const bodyText = separatorIndex >= 0 ? stdout.slice(0, separatorIndex) : stdout;
      const statusText = separatorIndex >= 0 ? stdout.slice(separatorIndex + 1).trim() : "";
      const status = Number(statusText);
      let json = null;

      try {
        json = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        json = null;
      }

      if (!Number.isFinite(status) || status < 200 || status >= 300) {
        reject(new Error(`HTTP ${statusText || "unknown"}：${truncateText(json ? JSON.stringify(json) : bodyText || stderr, 1200)}`));
        return;
      }

      resolve(json ?? bodyText);
    });
  });
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
      throw new Error(`网络请求超时：${timeoutLabel}超过 ${timeoutMs}ms`);
    }

    if (isFetchNetworkFailure(error)) {
      logToolCall("fetch fallback to curl", {
        method: "POST",
        url,
        reason: getNetworkErrorDetail(error)
      });
      return await curlJsonRequest(url, apiKey, {
        method: "POST",
        body,
        timeoutMs
      });
    }

    throw new Error(normalizeNetworkErrorMessage(getNetworkErrorDetail(error) || String(error)));
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
      throw new Error(`网络请求超时：${timeoutLabel}超过 ${timeoutMs}ms`);
    }

    if (isFetchNetworkFailure(error)) {
      logToolCall("fetch fallback to curl", {
        method: "GET",
        url,
        reason: getNetworkErrorDetail(error)
      });
      return await curlJsonRequest(url, apiKey, {
        method: "GET",
        timeoutMs
      });
    }

    throw new Error(normalizeNetworkErrorMessage(getNetworkErrorDetail(error) || String(error)));
  } finally {
    clearTimeout(timeout);
  }
}

async function getJsonWithNetworkRetry(url, apiKey, options = {}) {
  const attempts = Math.max(1, Number(options.attempts ?? VIDEO_QUERY_NETWORK_RETRY_ATTEMPTS + 1) || 1);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs ?? VIDEO_QUERY_NETWORK_RETRY_DELAY_MS) || 0);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getJson(url, apiKey, options);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (!isNetworkErrorMessage(message) || attempt >= attempts) {
        throw error;
      }

      logToolCall("video_gen query retry", {
        url,
        attempt,
        maxAttempts: attempts,
        retryDelayMs,
        reason: normalizeNetworkErrorMessage(message)
      });
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError ?? new Error("video_gen 查询重试失败：未知错误");
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

    throw new Error(getNetworkErrorDetail(error) || String(error));
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
  const prompt = compactMusicPrompt(argumentsObject?.prompt, argumentsObject?.lyrics, argumentsObject?.style);
  const style = String(argumentsObject?.style ?? "").trim();
  const instrumental =
    typeof argumentsObject?.instrumental === "boolean"
      ? argumentsObject.instrumental
      : operationName === "generate_instrumental";

  if (!prompt && !style) {
    throw new Error("Suno 音乐生成需要 prompt、lyrics 或 style 参数");
  }

  return {
    prompt: prompt || style,
    customMode: false,
    instrumental,
    ...(model ? { model } : {})
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

  return joinUrl(baseUrl, operation.endpoint);
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
  const codeMessage = pickNestedText(responseJson, ["code_msg", "codeMsg", "msg", "message"]);

  if (codeMessage && code && !["0", "200", "success"].includes(code)) {
    return codeMessage;
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

    const taskId = pickNestedText(item, [
      "task_id",
      "taskId",
      "taskID",
      "id",
      "record_id",
      "recordId",
      "request_id",
      "requestId"
    ]);

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

    const status = pickNestedText(item, ["status", "state", "task_status", "taskStatus", "status_code", "statusCode"]);

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
    "source_audio_url",
    "sourceAudioUrl",
    "source_stream_audio_url",
    "sourceStreamAudioUrl",
    "mp3_url",
    "mp3Url",
    "song_url",
    "songUrl",
    "wav_url",
    "wavUrl",
    "download_url",
    "downloadUrl",
    "audio",
    "audioUrl",
    "stream_url",
    "streamUrl",
    "cdn_url",
    "cdnUrl"
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

function getMusicPollAttempts(argumentsObject) {
  const rawValue = argumentsObject?.pollAttempts;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_MUSIC_POLL_ATTEMPTS;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return DEFAULT_MUSIC_POLL_ATTEMPTS;
  }

  return Math.max(0, Math.min(Math.floor(value), 120));
}

function getMusicPollIntervalMs(argumentsObject) {
  const rawValue = argumentsObject?.pollIntervalMs;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_MUSIC_POLL_INTERVAL_MS;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return DEFAULT_MUSIC_POLL_INTERVAL_MS;
  }

  return Math.max(1_000, Math.min(Math.floor(value), 120_000));
}

function getMusicPollTimeoutMs(argumentsObject) {
  const rawValue = argumentsObject?.pollTimeoutMs;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_MUSIC_POLL_TIMEOUT_MS;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return DEFAULT_MUSIC_POLL_TIMEOUT_MS;
  }

  return Math.max(1_000, Math.min(Math.floor(value), 900_000));
}

function shouldPollMusicTool(argumentsObject) {
  return argumentsObject?.pollUntilComplete !== false && getMusicPollAttempts(argumentsObject) > 0;
}

function isMusicPendingStatus(status) {
  return /queued|queueing|pending|running|processing|generating|created|submitted|in_progress|progress|wait|waiting|排队|运行|处理中|生成中|等待/u.test(
    String(status ?? "").trim().toLowerCase()
  );
}

function isMusicCompletedStatus(status) {
  return /success|succeeded|succeed|done|finished|complete|completed|finish|ready|generated|passed|成功|完成|已完成/u.test(
    String(status ?? "").trim().toLowerCase()
  );
}

function isMusicFailedStatus(status) {
  return /fail|failed|error|cancel|canceled|cancelled|timeout|expired|失败|错误|取消|超时/u.test(
    String(status ?? "").trim().toLowerCase()
  );
}

function buildMusicQueryContext({ provider, operation, baseUrl, apiKey, model, prompt, taskId }) {
  const endpoint = buildMusicQueryUrl(baseUrl, operation, provider.provider, taskId);
  const requestBody = provider.provider === "suno" ? { taskId } : null;

  return {
    endpoint,
    requestBody,
    async query() {
      const response =
        provider.provider === "suno"
          ? await postJson(endpoint, apiKey, requestBody, {
              timeoutMs: MUSIC_QUERY_TIMEOUT_MS,
              timeoutLabel: "music_gen 查询"
            })
          : await getJson(endpoint, apiKey, {
              timeoutMs: MUSIC_QUERY_TIMEOUT_MS,
              timeoutLabel: "music_gen 查询"
            });
      const status = extractMusicStatus(response);
      const artifacts = extractMusicArtifacts(response, {
        provider: provider.provider,
        model,
        prompt,
        operation: "query",
        endpoint: operation.endpoint,
        taskId,
        status
      });

      return {
        response,
        status,
        artifacts,
        sanitized: sanitizeMusicResponse(response)
      };
    }
  };
}

function normalizeVideoOperation(value) {
  const operation = String(value ?? "").trim();

  if (operation === "generate" || operation === "create") {
    return "submit";
  }

  if (operation === "status" || operation === "retrieve" || operation === "get") {
    return "query";
  }

  return ["submit", "query"].includes(operation) ? operation : "";
}

function normalizeVideoMode(value, argumentsObject = {}) {
  const explicitMode = String(value ?? "").trim();
  const modeAliasMap = {
    text: "text_to_video",
    text_to_video: "text_to_video",
    t2v: "text_to_video",
    image: "first_frame_to_video",
    image_to_video: "first_frame_to_video",
    img2video: "first_frame_to_video",
    i2v: "first_frame_to_video",
    first_frame: "first_frame_to_video",
    first_frame_to_video: "first_frame_to_video",
    first_last_frame: "first_last_frame_to_video",
    first_last_frame_to_video: "first_last_frame_to_video",
    start_end_frame_to_video: "first_last_frame_to_video",
    keyframe_to_video: "first_last_frame_to_video",
    reference: "reference_to_video",
    reference_to_video: "reference_to_video",
    reference_image_to_video: "reference_to_video",
    reference_images_to_video: "reference_to_video"
  };

  if (modeAliasMap[explicitMode]) {
    return modeAliasMap[explicitMode];
  }

  const referenceImages = [...toStringArray(argumentsObject?.referenceImages), ...toStringArray(argumentsObject?.reference_images)];
  const referenceVideos = [...toStringArray(argumentsObject?.referenceVideos), ...toStringArray(argumentsObject?.reference_videos)];
  const referenceAudios = [...toStringArray(argumentsObject?.referenceAudios), ...toStringArray(argumentsObject?.reference_audios)];

  if (referenceImages.length || referenceVideos.length || referenceAudios.length) {
    return "reference_to_video";
  }

  if (String(argumentsObject?.lastFrameImage ?? argumentsObject?.last_frame_image ?? "").trim()) {
    return "first_last_frame_to_video";
  }

  if (String(argumentsObject?.firstFrameImage ?? argumentsObject?.first_frame_image ?? argumentsObject?.image ?? "").trim()) {
    return "first_frame_to_video";
  }

  return "text_to_video";
}

function getVideoDurationSeconds(argumentsObject) {
  const rawValue = argumentsObject?.durationSeconds ?? argumentsObject?.duration_seconds ?? argumentsObject?.duration ?? DEFAULT_VIDEO_DURATION_SECONDS;
  const duration = Number(rawValue);

  if (!Number.isFinite(duration) || duration < -1 || duration === 0 || duration > 60) {
    throw new Error("video_gen 的 durationSeconds 需要是 -1 或 1-60 之间的数字");
  }

  return Math.round(duration);
}

function getVideoPriority(argumentsObject) {
  const rawValue = argumentsObject?.priority;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  const priority = Number(rawValue);

  if (!Number.isInteger(priority) || priority < 0 || priority > 9) {
    throw new Error("video_gen 的 priority 需要是 0-9 之间的整数");
  }

  return priority;
}

function getOptionalIntegerArgument(argumentsObject, camelName, snakeName, { minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER, label }) {
  const rawValue = argumentsObject?.[camelName] ?? argumentsObject?.[snakeName];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`video_gen 的 ${label || camelName} 需要是 ${minimum}-${maximum} 之间的整数`);
  }

  return value;
}

function createVideoContentItem(kind, url, role) {
  const normalizedUrl = String(url ?? "").trim();

  if (!normalizedUrl) {
    return null;
  }

  if (kind === "video") {
    return {
      type: "video_url",
      video_url: {
        url: normalizedUrl
      },
      ...(role ? { role } : {})
    };
  }

  if (kind === "audio") {
    return {
      type: "audio_url",
      audio_url: {
        url: normalizedUrl
      },
      ...(role ? { role } : {})
    };
  }

  return {
    type: "image_url",
    image_url: {
      url: normalizedUrl
    },
    ...(role ? { role } : {})
  };
}

function normalizeVideoReferenceInputs(argumentsObject) {
  return {
    firstFrameImage: String(argumentsObject?.firstFrameImage ?? argumentsObject?.first_frame_image ?? argumentsObject?.image ?? "").trim(),
    lastFrameImage: String(argumentsObject?.lastFrameImage ?? argumentsObject?.last_frame_image ?? "").trim(),
    referenceImages: uniqueStrings([...toStringArray(argumentsObject?.referenceImages), ...toStringArray(argumentsObject?.reference_images)]),
    referenceVideos: uniqueStrings([...toStringArray(argumentsObject?.referenceVideos), ...toStringArray(argumentsObject?.reference_videos)]),
    referenceAudios: uniqueStrings([...toStringArray(argumentsObject?.referenceAudios), ...toStringArray(argumentsObject?.reference_audios)])
  };
}

function assertSeedanceModeInputs(mode, inputs) {
  const hasFirstFrame = Boolean(inputs.firstFrameImage);
  const hasLastFrame = Boolean(inputs.lastFrameImage);
  const hasReferenceImage = inputs.referenceImages.length > 0;
  const hasReferenceVideo = inputs.referenceVideos.length > 0;
  const hasReferenceAudio = inputs.referenceAudios.length > 0;
  const hasReferenceMedia = hasReferenceImage || hasReferenceVideo || hasReferenceAudio;

  if (mode === "text_to_video") {
    if (hasFirstFrame || hasLastFrame || hasReferenceMedia) {
      throw new Error("text_to_video 只能传文本提示词；如需图片输入，请使用 first_frame_to_video、first_last_frame_to_video 或 reference_to_video");
    }
    return;
  }

  if (mode === "first_frame_to_video") {
    if (!hasFirstFrame) {
      throw new Error("first_frame_to_video 需要 image 或 firstFrameImage 参数");
    }

    if (hasLastFrame || hasReferenceMedia) {
      throw new Error("first_frame_to_video 不能混用 lastFrameImage、referenceImages、referenceVideos 或 referenceAudios");
    }
    return;
  }

  if (mode === "first_last_frame_to_video") {
    if (!hasFirstFrame || !hasLastFrame) {
      throw new Error("first_last_frame_to_video 需要 firstFrameImage/image 和 lastFrameImage 参数");
    }

    if (hasReferenceMedia) {
      throw new Error("first_last_frame_to_video 不能混用 referenceImages、referenceVideos 或 referenceAudios");
    }
    return;
  }

  if (mode === "reference_to_video") {
    if (!hasReferenceMedia) {
      throw new Error("reference_to_video 需要 referenceImages、referenceVideos 或 referenceAudios 参数");
    }

    if (hasFirstFrame || hasLastFrame) {
      throw new Error("reference_to_video 不能混用 firstFrameImage/image 或 lastFrameImage；需要严格首尾帧时请使用 first_last_frame_to_video");
    }

    if (inputs.referenceImages.length > 9) {
      throw new Error("reference_to_video 的 referenceImages 需要是 1-9 张");
    }

    if (inputs.referenceVideos.length > 3) {
      throw new Error("reference_to_video 的 referenceVideos 需要是 0-3 个");
    }

    if (inputs.referenceAudios.length > 3) {
      throw new Error("reference_to_video 的 referenceAudios 需要是 0-3 个");
    }

    if (hasReferenceAudio && !hasReferenceImage && !hasReferenceVideo) {
      throw new Error("reference_to_video 不能单独输入音频，至少需要 1 张参考图或 1 个参考视频");
    }
  }
}

function buildSeedanceVideoRequestBody(operationName, argumentsObject, model) {
  if (operationName !== "submit") {
    return null;
  }

  const prompt = String(argumentsObject?.prompt ?? "").trim();
  const mode = normalizeVideoMode(argumentsObject?.mode, argumentsObject);
  const inputs = normalizeVideoReferenceInputs(argumentsObject);
  const content = [];

  assertSeedanceModeInputs(mode, inputs);

  if (mode === "text_to_video" && !prompt) {
    throw new Error("text_to_video 需要 prompt 参数");
  }

  if (prompt) {
    content.push({
      type: "text",
      text: prompt
    });
  }

  if (mode === "first_frame_to_video") {
    content.push(createVideoContentItem("image", inputs.firstFrameImage, "first_frame"));
  } else if (mode === "first_last_frame_to_video") {
    content.push(createVideoContentItem("image", inputs.firstFrameImage, "first_frame"));
    content.push(createVideoContentItem("image", inputs.lastFrameImage, "last_frame"));
  } else if (mode === "reference_to_video") {
    inputs.referenceImages.forEach((url) => content.push(createVideoContentItem("image", url, "reference_image")));
    inputs.referenceVideos.forEach((url) => content.push(createVideoContentItem("video", url, "reference_video")));
    inputs.referenceAudios.forEach((url) => content.push(createVideoContentItem("audio", url, "reference_audio")));
  }

  const negativePrompt = String(argumentsObject?.negativePrompt ?? argumentsObject?.negative_prompt ?? "").trim();
  const callbackUrl = String(argumentsObject?.callbackUrl ?? argumentsObject?.callBackUrl ?? argumentsObject?.callback_url ?? "").trim();
  const safetyIdentifier = String(argumentsObject?.safetyIdentifier ?? argumentsObject?.safety_identifier ?? "").trim();
  const seed = argumentsObject?.seed === undefined || argumentsObject?.seed === null || argumentsObject?.seed === "" ? undefined : Number(argumentsObject.seed);
  const priority = getVideoPriority(argumentsObject);
  const frames = getOptionalIntegerArgument(argumentsObject, "frames", "frames", {
    minimum: 29,
    maximum: 289,
    label: "frames"
  });
  const executionExpiresAfter = getOptionalIntegerArgument(argumentsObject, "executionExpiresAfter", "execution_expires_after", {
    minimum: 3_600,
    maximum: 259_200,
    label: "execution_expires_after"
  });
  const serviceTier = String(argumentsObject?.serviceTier ?? argumentsObject?.service_tier ?? "").trim();
  const tools = argumentsObject?.tools;

  if (seed !== undefined && (!Number.isInteger(seed) || seed < -1 || seed > 2 ** 32 - 1)) {
    throw new Error("video_gen 的 seed 需要是 -1 到 2^32-1 之间的整数");
  }

  if (serviceTier && !["default", "flex"].includes(serviceTier)) {
    throw new Error("video_gen 的 serviceTier 需要是 default 或 flex");
  }

  if (tools !== undefined && !Array.isArray(tools)) {
    throw new Error("video_gen 的 tools 需要是数组");
  }

  return {
    model,
    content: content.filter(Boolean),
    ratio: String(argumentsObject?.ratio ?? DEFAULT_VIDEO_RATIO).trim() || DEFAULT_VIDEO_RATIO,
    ...(frames === undefined ? { duration: getVideoDurationSeconds(argumentsObject) } : {}),
    resolution: String(argumentsObject?.resolution ?? DEFAULT_VIDEO_RESOLUTION).trim() || DEFAULT_VIDEO_RESOLUTION,
    watermark: typeof argumentsObject?.watermark === "boolean" ? argumentsObject.watermark : false,
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(typeof argumentsObject?.returnLastFrame === "boolean" ? { return_last_frame: argumentsObject.returnLastFrame } : {}),
    ...(typeof argumentsObject?.return_last_frame === "boolean" ? { return_last_frame: argumentsObject.return_last_frame } : {}),
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    ...(typeof argumentsObject?.generateAudio === "boolean" ? { generate_audio: argumentsObject.generateAudio } : {}),
    ...(typeof argumentsObject?.generate_audio === "boolean" ? { generate_audio: argumentsObject.generate_audio } : {}),
    ...(typeof argumentsObject?.cameraFixed === "boolean" ? { camera_fixed: argumentsObject.cameraFixed } : {}),
    ...(typeof argumentsObject?.camera_fixed === "boolean" ? { camera_fixed: argumentsObject.camera_fixed } : {}),
    ...(typeof argumentsObject?.draft === "boolean" ? { draft: argumentsObject.draft } : {}),
    ...(frames !== undefined ? { frames } : {}),
    ...(serviceTier ? { service_tier: serviceTier } : {}),
    ...(executionExpiresAfter !== undefined ? { execution_expires_after: executionExpiresAfter } : {}),
    ...(tools !== undefined ? { tools } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {})
  };
}

function buildVideoQueryUrl(baseUrl, operation, taskId) {
  return joinUrl(baseUrl, operation.endpoint.replace("{task_id}", encodeURIComponent(taskId)));
}

function buildVideoSubmitUrl(baseUrl, operation) {
  return joinUrl(baseUrl, operation.endpoint);
}

function getVideoPollAttempts(argumentsObject) {
  const rawValue = argumentsObject?.pollAttempts;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_VIDEO_POLL_ATTEMPTS;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return DEFAULT_VIDEO_POLL_ATTEMPTS;
  }

  return Math.max(0, Math.min(Math.floor(value), 60));
}

function getVideoPollIntervalMs(argumentsObject) {
  const rawValue = argumentsObject?.pollIntervalMs;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_VIDEO_POLL_INTERVAL_MS;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return DEFAULT_VIDEO_POLL_INTERVAL_MS;
  }

  return Math.max(1_000, Math.min(Math.floor(value), 120_000));
}

function getVideoPollTimeoutMs(argumentsObject) {
  const rawValue = argumentsObject?.pollTimeoutMs;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_VIDEO_POLL_TIMEOUT_MS;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return DEFAULT_VIDEO_POLL_TIMEOUT_MS;
  }

  return Math.max(1_000, Math.min(Math.floor(value), 900_000));
}

function shouldPollVideoTool(argumentsObject) {
  return argumentsObject?.pollUntilComplete !== false && getVideoPollAttempts(argumentsObject) > 0;
}

function isVideoPendingStatus(status) {
  return /queued|queueing|pending|running|processing|generating|created|submitted|in_progress|progress|排队|运行|处理中|生成中/u.test(
    String(status ?? "").trim().toLowerCase()
  );
}

function isVideoCompletedStatus(status) {
  return /success|succeeded|succeed|done|finished|complete|completed|finish|ready|generated|passed|成功|完成|已完成/u.test(
    String(status ?? "").trim().toLowerCase()
  );
}

function isVideoFailedStatus(status) {
  return /fail|failed|error|cancel|canceled|cancelled|timeout|expired|失败|错误|取消|超时/u.test(
    String(status ?? "").trim().toLowerCase()
  );
}

function buildVideoQueryContext({ provider, operation, baseUrl, apiKey, model, prompt, mode, taskId }) {
  const endpoint = buildVideoQueryUrl(baseUrl, operation, taskId);

  return {
    endpoint,
    async query() {
      const response = await getJsonWithNetworkRetry(endpoint, apiKey, {
        timeoutMs: VIDEO_QUERY_TIMEOUT_MS,
        timeoutLabel: "video_gen 查询"
      });
      const status = extractVideoStatus(response);
      const artifacts = extractVideoArtifacts(response, {
        provider: provider.provider,
        model,
        prompt,
        operation: "query",
        mode,
        endpoint: operation.endpoint,
        taskId,
        status
      });

      return {
        response,
        status,
        artifacts,
        sanitized: sanitizeVideoResponse(response)
      };
    }
  };
}

async function probeVideoProxyHealth({ baseUrl, apiKey, queryOperation }) {
  if (!queryOperation) {
    return {
      ok: false,
      status: "query_endpoint_missing",
      message: "未配置视频查询端点，无法执行健康检查"
    };
  }

  const probeTaskId = `gordon-healthcheck-${Date.now()}`;
  const endpoint = buildVideoQueryUrl(baseUrl, queryOperation, probeTaskId);
  const startedAt = Date.now();

  try {
    const response = await getJsonWithNetworkRetry(endpoint, apiKey, {
      timeoutMs: Math.min(VIDEO_QUERY_TIMEOUT_MS, 8_000),
      timeoutLabel: "video_gen 健康检查",
      attempts: 2,
      retryDelayMs: 800
    });
    const errorText = getVideoResponseError(response);
    const errorClass = classifyVideoResponseError(errorText);
    const sanitized = sanitizeVideoResponse(response);

    if (errorClass.kind === "nonexistent_entity") {
      return {
        ok: true,
        status: "reachable",
        durationMs: Date.now() - startedAt,
        message: "视频代理查询路由可达，认证有效；假任务返回不存在，属于预期结果",
        response: sanitized
      };
    }

    if (errorText) {
      return {
        ok: false,
        status: errorClass.kind,
        durationMs: Date.now() - startedAt,
        message: `${errorClass.label}：${errorText}`,
        response: sanitized
      };
    }

    return {
      ok: true,
      status: "reachable",
      durationMs: Date.now() - startedAt,
      message: "视频代理查询路由可达",
      response: sanitized
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      status: /超时|timeout|timed out|exit 28|curl:\s*\(28\)/iu.test(message) ? "network_timeout" : "network_error",
      durationMs: Date.now() - startedAt,
      message: normalizeNetworkErrorMessage(message)
    };
  }
}

function sanitizeVideoRequestBody(requestBody) {
  if (!requestBody || typeof requestBody !== "object") {
    return {};
  }

  return {
    ...requestBody,
    content: Array.isArray(requestBody.content)
      ? requestBody.content.map((item) => {
          if (!item || typeof item !== "object") {
            return item;
          }

          if (item.type === "text") {
            return {
              ...item,
              text: truncateText(item.text, 320)
            };
          }

          const url =
            typeof item.image_url?.url === "string"
              ? item.image_url.url
              : typeof item.video_url?.url === "string"
                ? item.video_url.url
                : typeof item.audio_url?.url === "string"
                  ? item.audio_url.url
                  : "";

          return {
            type: item.type,
            role: item.role,
            url: url ? `[媒体输入已省略，${url.length} 字符]` : ""
          };
        })
      : requestBody.content,
    ...(typeof requestBody.negative_prompt === "string" ? { negative_prompt: truncateText(requestBody.negative_prompt, 180) } : {})
  };
}

function getVideoResponseError(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }

  const nestedPayload =
    responseJson.resp_data && typeof responseJson.resp_data === "object"
      ? responseJson.resp_data
      : responseJson.data && typeof responseJson.data === "object"
        ? responseJson.data
        : null;
  const error = responseJson.error ?? responseJson.err ?? responseJson.errors ?? nestedPayload?.error ?? nestedPayload?.err ?? nestedPayload?.errors;

  if (error) {
    if (typeof error === "string") {
      return error.trim();
    }

    if (typeof error === "object") {
      const code = pickNestedText(error, ["code", "error_code", "errorCode"]);
      const message = pickNestedText(error, ["message", "msg", "description"]);
      return [code, message].filter(Boolean).join(": ") || JSON.stringify(error);
    }

    return String(error);
  }

  const code = String(responseJson.code ?? "").trim().toLowerCase();
  const status = String(responseJson.status ?? "").trim().toLowerCase();
  const message = pickNestedText(responseJson, ["message", "msg"]) || (nestedPayload ? pickNestedText(nestedPayload, ["message", "msg"]) : "");

  if (message && code && !["0", "200", "success"].includes(code)) {
    return message;
  }

  if (message && ["error", "failed"].includes(status)) {
    return message;
  }

  return "";
}

function classifyVideoResponseError(errorText) {
  const normalized = String(errorText ?? "").toLowerCase();

  if (!normalized) {
    return {
      kind: "upstream_error",
      label: "上游错误"
    };
  }

  if (
    /invalidparameter|badrequest|invalid request|invalid request format|validation|required|must be|not supported|unsupported|参数|字段|格式|校验|必填/u.test(
      normalized
    )
  ) {
    return {
      kind: "schema_mismatch",
      label: "接口参数错误"
    };
  }

  if (/resourcenotfound|notfound|not found|不存在|未找到/u.test(normalized)) {
    return {
      kind: "nonexistent_entity",
      label: "目标不存在"
    };
  }

  return {
    kind: "upstream_error",
    label: "上游错误"
  };
}

function extractVideoTaskId(responseJson) {
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

    const taskId = pickNestedText(item, ["task_id", "taskId", "taskID"]);

    if (taskId) {
      return taskId;
    }

    const genericId = pickNestedText(item, ["id"]);

    if (genericId && /^(cgt-|task-|video-|vid-|[a-f0-9]{24,}|[a-z0-9_-]{16,})/iu.test(genericId)) {
      return genericId;
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

function extractVideoStatus(responseJson) {
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

function pickVideoUrl(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const key of [
    "video_url",
    "videoUrl",
    "source_video_url",
    "sourceVideoUrl",
    "stream_video_url",
    "streamVideoUrl",
    "file_url",
    "fileUrl",
    "output_url",
    "outputUrl",
    "result_url",
    "resultUrl",
    "download_url",
    "downloadUrl",
    "url"
  ]) {
    const value = item[key];

    if (typeof value === "string" && /^https?:\/\//iu.test(value.trim())) {
      return value.trim();
    }

    if (value && typeof value === "object") {
      const nestedUrl = pickNestedText(value, [
        "url",
        "video_url",
        "videoUrl",
        "source_video_url",
        "sourceVideoUrl",
        "file_url",
        "fileUrl",
        "download_url",
        "downloadUrl"
      ]);

      if (nestedUrl && /^https?:\/\//iu.test(nestedUrl)) {
        return nestedUrl;
      }
    }
  }

  return "";
}

function hasExplicitVideoUrlField(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  return [
    "video_url",
    "videoUrl",
    "source_video_url",
    "sourceVideoUrl",
    "stream_video_url",
    "streamVideoUrl"
  ].some((key) => {
    const value = item[key];
    return typeof value === "string" || (value && typeof value === "object");
  });
}

function hasVideoResultContext(pathSegments) {
  const text = (Array.isArray(pathSegments) ? pathSegments : []).join(".").toLowerCase();

  return /(^|\.)videos?($|\.)|video_?url|result|output|works?|file|download/u.test(text);
}

function isLikelyVideoUrl(url, item, pathSegments = []) {
  if (!url || !/^https?:\/\//iu.test(url)) {
    return false;
  }

  const mimeType = String(item?.mimeType ?? item?.mime_type ?? item?.type ?? "").toLowerCase();

  return (
    hasExplicitVideoUrlField(item) ||
    mimeType.includes("video") ||
    /\.(mp4|mov|webm|m4v)(?:[?#].*)?$/iu.test(url) ||
    (hasVideoResultContext(pathSegments) && !/\.(?:jpg|jpeg|png|webp|gif|mp3|wav|m4a|aac)(?:[?#].*)?$/iu.test(url))
  );
}

function pickLastFrameUrl(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const key of ["last_frame_url", "lastFrameUrl", "last_frame", "lastFrame"]) {
    const value = item[key];

    if (typeof value === "string" && /^https?:\/\//iu.test(value.trim())) {
      return value.trim();
    }

    if (value && typeof value === "object") {
      const nestedUrl = pickNestedText(value, ["url", "image_url", "imageUrl"]);

      if (nestedUrl && /^https?:\/\//iu.test(nestedUrl)) {
        return nestedUrl;
      }
    }
  }

  return "";
}

function extractVideoArtifacts(responseJson, context) {
  const artifacts = [];
  const seenObjects = new WeakSet();
  const seenUrls = new Set();

  function visit(item, pathSegments = []) {
    if (!item || typeof item !== "object") {
      return;
    }

    if (seenObjects.has(item)) {
      return;
    }

    seenObjects.add(item);

    const videoUrl = pickVideoUrl(item);

    if (videoUrl && !seenUrls.has(videoUrl) && isLikelyVideoUrl(videoUrl, item, pathSegments)) {
      seenUrls.add(videoUrl);
      artifacts.push({
        id: `video_gen_${Date.now()}_${artifacts.length + 1}`,
        kind: "video",
        title: `video_gen 结果 ${artifacts.length + 1}`,
        mimeType: "video/mp4",
        url: videoUrl,
        provider: context.provider,
        model: context.model,
        prompt: context.prompt,
        metadata: {
          operation: context.operation,
          mode: context.mode,
          endpoint: context.endpoint,
          taskId: context.taskId,
          status: context.status,
          lastFrameUrl: pickLastFrameUrl(item)
        }
      });
    }

    for (const [key, value] of Object.entries(item)) {
      const nextPathSegments = [...pathSegments, key];

      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...nextPathSegments, String(index)]));
      } else if (value && typeof value === "object") {
        visit(value, nextPathSegments);
      }
    }
  }

  visit(responseJson);
  return artifacts;
}

function sanitizeVideoResponse(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return {
      raw: responseJson
    };
  }

  return {
    taskId: extractVideoTaskId(responseJson),
    status: extractVideoStatus(responseJson),
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
  const imageInputs = uniqueStrings([String(argumentsObject?.image ?? "").trim(), ...toStringArray(argumentsObject?.images)]);
  const image = imageInputs[0] ?? "";
  const images = imageInputs;
  const hasImageInput = imageInputs.length > 0;
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
    imageCount: imageInputs.length,
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

async function callVideoGen(argumentsObject) {
  const operationName = normalizeVideoOperation(argumentsObject?.operation);

  if (!operationName) {
    throw new Error("video_gen 需要 operation 参数，可选 submit、query");
  }

  const requestedProvider = String(argumentsObject?.provider ?? "").trim();

  if (requestedProvider && !VIDEO_PROVIDER_VALUES.has(requestedProvider)) {
    throw new Error("video_gen 的 provider 当前仅支持 seedance");
  }

  const configs = await readToolConfigs();
  const resolved = resolveRunnableToolConfig(configs, "video_gen", requestedProvider);

  if (!resolved) {
    throw new Error("video_gen 未启用，或目标供应商未启用 / 未配置运行时。请先在能力拓展的 TOOL 配置中启用 video_gen。");
  }

  const { provider, runtime } = resolved;
  const operation = runtime.operations[operationName];

  if (!operation) {
    throw new Error(`video_gen 当前供应商不支持 ${operationName}`);
  }

  const apiKey = String(provider.apiKey ?? "").trim();
  const baseUrl = normalizeBaseUrl(provider.baseUrl, "video_gen", provider.provider);
  const model = String(argumentsObject?.model ?? provider.model ?? "").trim();

  if (!apiKey) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少 API Key`);
  }

  if (!baseUrl) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少 Base URL`);
  }

  if (operationName === "submit" && !model) {
    throw new Error(`${provider.label || provider.provider} 已启用，但缺少模型 / 能力 ID`);
  }

  const prompt = String(argumentsObject?.prompt ?? "").trim();
  const mode = normalizeVideoMode(argumentsObject?.mode, argumentsObject);
  const taskId = String(argumentsObject?.taskId ?? argumentsObject?.task_id ?? "").trim();
  const requestStartedAt = Date.now();
  let endpoint = buildVideoSubmitUrl(baseUrl, operation);
  let requestBody = null;
  let response;

  if (operationName === "query") {
    if (!taskId) {
      throw new Error("video_gen 查询需要 taskId 参数");
    }

    endpoint = buildVideoQueryUrl(baseUrl, operation, taskId);
  } else {
    requestBody = buildSeedanceVideoRequestBody(operationName, argumentsObject, model);
  }

  const callLog = {
    tool: "video_gen",
    provider: provider.provider,
    endpoint: operation.endpoint,
    url: endpoint,
    model,
    operation: operationName,
    ...(operationName === "submit" ? { mode } : {}),
    ...(taskId ? { taskId } : {}),
    ...(requestBody ? { requestBody: sanitizeVideoRequestBody(requestBody) } : {}),
    prompt: truncateText(prompt, 240),
    timeoutMs: operationName === "query" ? VIDEO_QUERY_TIMEOUT_MS : VIDEO_GEN_TIMEOUT_MS
  };
  logToolCall("video_gen request", callLog);

  try {
    if (operationName === "query") {
      response = await getJson(endpoint, apiKey, {
        timeoutMs: VIDEO_QUERY_TIMEOUT_MS,
        timeoutLabel: "video_gen 查询"
      });
    } else {
      response = await postJson(endpoint, apiKey, requestBody, {
        timeoutMs: VIDEO_GEN_TIMEOUT_MS,
        timeoutLabel: "video_gen 提交"
      });
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const shouldHealthCheck = isNetworkErrorMessage(rawMessage);
    let diagnosticMessage = normalizeNetworkErrorMessage(rawMessage);
    let healthCheck = null;

    if (shouldHealthCheck) {
      healthCheck = await probeVideoProxyHealth({
        baseUrl,
        apiKey,
        queryOperation: runtime.operations.query
      });
      const healthText = healthCheck.ok
        ? `健康检查通过：${healthCheck.message}${healthCheck.durationMs ? `（${healthCheck.durationMs}ms）` : ""}`
        : `健康检查失败：${healthCheck.message}${healthCheck.durationMs ? `（${healthCheck.durationMs}ms）` : ""}`;
      diagnosticMessage = `${diagnosticMessage}；${healthText}`;
    }

    if (operationName === "submit" && shouldHealthCheck) {
      diagnosticMessage = `video_gen 提交状态未知：提交请求发生网络异常，不能安全自动重试以免重复生成或重复扣费。${diagnosticMessage}。建议稍后检查上游任务列表，或确认未创建任务后重新提交。`;
    }

    logToolCall("video_gen failure", {
      ...callLog,
      durationMs: Date.now() - requestStartedAt,
      error: diagnosticMessage,
      ...(healthCheck ? { healthCheck } : {})
    });
    throw new Error(diagnosticMessage);
  }

  const sanitized = sanitizeVideoResponse(response);
  const responseTaskId = extractVideoTaskId(response) || taskId;
  let responseStatus = extractVideoStatus(response);
  const responseError = getVideoResponseError(response);

  if (responseError) {
    const errorClass = classifyVideoResponseError(responseError);
    throw new Error(`上游视频接口${errorClass.label}：${responseError}`);
  }

  let artifacts = extractVideoArtifacts(response, {
    provider: provider.provider,
    model,
    prompt,
    operation: operationName,
    mode,
    endpoint: operation.endpoint,
    taskId: responseTaskId,
    status: responseStatus
  });
  let finalResult = response;
  let finalSanitized = sanitized;
  const pollHistory = [];

  if (responseTaskId && shouldPollVideoTool(argumentsObject) && !artifacts.length && (!responseStatus || isVideoPendingStatus(responseStatus))) {
    const queryOperation = runtime.operations.query;
    const pollAttempts = getVideoPollAttempts(argumentsObject);
    const pollIntervalMs = getVideoPollIntervalMs(argumentsObject);
    const pollTimeoutMs = getVideoPollTimeoutMs(argumentsObject);
    const pollStartedAt = Date.now();
    let pollNetworkErrors = 0;

    if (queryOperation) {
      const queryContext = buildVideoQueryContext({
        provider,
        operation: queryOperation,
        baseUrl,
        apiKey,
        model,
        prompt,
        mode,
        taskId: responseTaskId
      });

      for (let pollIndex = 1; pollIndex <= pollAttempts; pollIndex += 1) {
        const elapsedMs = Date.now() - pollStartedAt;

        if (elapsedMs >= pollTimeoutMs) {
          pollHistory.push({
            attempt: pollIndex,
            status: responseStatus || "poll_timeout",
            artifacts: artifacts.length,
            elapsedMs,
            stopped: "poll_timeout"
          });
          break;
        }

        if (pollIndex > 1) {
          const remainingMs = pollTimeoutMs - elapsedMs;
          await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remainingMs)));
        }

        logToolCall("video_gen poll", {
          taskId: responseTaskId,
          attempt: pollIndex,
          maxAttempts: pollAttempts,
          intervalMs: pollIntervalMs,
          timeoutMs: pollTimeoutMs,
          url: queryContext.endpoint
        });
        let queryResult;

        try {
          queryResult = await queryContext.query();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isNetworkError = isNetworkErrorMessage(errorMessage);

          pollHistory.push({
            attempt: pollIndex,
            status: responseStatus || "query_error",
            artifacts: artifacts.length,
            elapsedMs: Date.now() - pollStartedAt,
            error: normalizeNetworkErrorMessage(errorMessage),
            ...(isNetworkError ? { recoverable: pollNetworkErrors + 1 < VIDEO_POLL_MAX_NETWORK_ERRORS } : {})
          });

          if (isNetworkError && pollNetworkErrors + 1 < VIDEO_POLL_MAX_NETWORK_ERRORS) {
            pollNetworkErrors += 1;
            continue;
          }

          break;
        }

        finalResult = queryResult.response;
        finalSanitized = queryResult.sanitized;
        responseStatus = queryResult.status || responseStatus;
        artifacts = queryResult.artifacts;
        pollHistory.push({
          attempt: pollIndex,
          status: responseStatus,
          artifacts: artifacts.length,
          elapsedMs: Date.now() - pollStartedAt
        });

        if (artifacts.length || (responseStatus && !isVideoPendingStatus(responseStatus))) {
          break;
        }
      }
    }
  }

  logToolCall("video_gen response", {
    ...callLog,
    durationMs: Date.now() - requestStartedAt,
    taskId: responseTaskId,
    status: responseStatus,
    artifacts: artifacts.length,
    pollHistory,
    responseKeys: finalSanitized.responseKeys
  });

  const finalResponseError = finalResult === response ? "" : getVideoResponseError(finalResult);

  if (finalResponseError) {
    const errorClass = classifyVideoResponseError(finalResponseError);
    throw new Error(`上游视频查询接口${errorClass.label}：${finalResponseError}`);
  }

  if (responseStatus && isVideoFailedStatus(responseStatus)) {
    throw new Error(`视频生成任务失败：${responseStatus}`);
  }

  if (operationName === "submit" && !responseTaskId) {
    throw new Error(`上游视频接口未返回 taskId：${truncateText(JSON.stringify(sanitized), 1200)}`);
  }

  if (!artifacts.length && responseStatus && isVideoCompletedStatus(responseStatus)) {
    throw new Error(`视频生成任务已完成，但上游未返回可播放视频 URL：${truncateText(JSON.stringify(finalSanitized), 1200)}`);
  }

  const pollError = artifacts.length ? "" : [...pollHistory].reverse().find((entry) => entry?.error && !entry?.recoverable)?.error ?? "";
  const hasPollStop = pollHistory.some((entry) => entry?.stopped);
  const hasUnknownStatus = responseTaskId && !responseStatus && !artifacts.length;
  const isPending = Boolean(
    !artifacts.length &&
      !pollError &&
      (hasUnknownStatus || hasPollStop || (responseStatus && isVideoPendingStatus(responseStatus)))
  );
  const isCompleted = Boolean(artifacts.length || (responseStatus && isVideoCompletedStatus(responseStatus) && !isPending && !pollError));
  const pollExhausted = Boolean(pollHistory.length && isPending);
  const pollFailed = Boolean(pollError);

  return buildTextResult(
    `video_gen 调用完成
provider=${provider.label || provider.provider}
endpoint=${operation.endpoint}
${model ? `model=${model}\n` : ""}operation=${operationName}
${operationName === "submit" ? `mode=${mode}\n` : ""}${responseTaskId ? `taskId=${responseTaskId}\n` : ""}${responseStatus ? `status=${responseStatus}\n` : ""}${pollHistory.length ? `polls=${pollHistory.length}\n` : ""}${pollError ? `pollError=${pollError}\n` : ""}pending=${isPending}
completed=${isCompleted}
artifacts=${artifacts.length}

结果摘要：
${truncateText(JSON.stringify(finalSanitized.raw ?? finalSanitized, null, 2))}`,
    {
      provider: provider.provider,
      endpoint: operation.endpoint,
      model,
      operation: operationName,
      mode,
      taskId: responseTaskId,
      status: responseStatus,
      pending: isPending,
      completed: isCompleted,
      pollExhausted,
      pollFailed,
      ...(pollError ? { pollError } : {}),
      call: callLog,
      ...(requestBody ? { requestBody: sanitizeVideoRequestBody(requestBody) } : {}),
      ...(pollHistory.length ? { pollHistory } : {}),
      artifacts,
      result: finalSanitized.raw ?? finalSanitized
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
    requestBody = provider.provider === "suno" ? { taskId } : null;
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
    prompt: truncateText(prompt, 240),
    timeoutMs: operationName === "query" ? MUSIC_QUERY_TIMEOUT_MS : MUSIC_GEN_TIMEOUT_MS
  };
  logToolCall("music_gen request", callLog);

  try {
    if (operationName === "query") {
      response =
        provider.provider === "suno"
          ? await postJson(endpoint, apiKey, requestBody, {
              timeoutMs: MUSIC_QUERY_TIMEOUT_MS,
              timeoutLabel: "music_gen 查询"
            })
          : await getJson(endpoint, apiKey, {
              timeoutMs: MUSIC_QUERY_TIMEOUT_MS,
              timeoutLabel: "music_gen 查询"
            });
    } else if (operationName === "vocal_clone") {
      response = await postMultipartFile(endpoint, apiKey, vocalFilePath, "file", {
        timeoutMs: MUSIC_GEN_TIMEOUT_MS,
        timeoutLabel: "music_gen 提交"
      });
    } else {
      response = await postJson(endpoint, apiKey, requestBody, {
        timeoutMs: MUSIC_GEN_TIMEOUT_MS,
        timeoutLabel: "music_gen 提交"
      });
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
  let responseStatus = extractMusicStatus(response);
  const responseError = getMusicResponseError(response);
  let artifacts = extractMusicArtifacts(response, {
    provider: provider.provider,
    model,
    prompt,
    operation: operationName,
    endpoint: operation.endpoint,
    taskId: responseTaskId,
    status: responseStatus
  });
  let finalResult = response;
  let finalSanitized = sanitized;
  const pollHistory = [];

  if (responseError) {
    throw new Error(`上游音乐接口返回错误：${responseError}`);
  }

  if (
    operationName !== "vocal_clone" &&
    responseTaskId &&
    shouldPollMusicTool(argumentsObject) &&
    !artifacts.length &&
    (!responseStatus || isMusicPendingStatus(responseStatus))
  ) {
    const queryOperation = runtime.operations.query;
    const pollAttempts = getMusicPollAttempts(argumentsObject);
    const pollIntervalMs = getMusicPollIntervalMs(argumentsObject);
    const pollTimeoutMs = getMusicPollTimeoutMs(argumentsObject);
    const pollStartedAt = Date.now();

    if (queryOperation) {
      const queryContext = buildMusicQueryContext({
        provider,
        operation: queryOperation,
        baseUrl,
        apiKey,
        model,
        prompt,
        taskId: responseTaskId
      });

      for (let pollIndex = 1; pollIndex <= pollAttempts; pollIndex += 1) {
        const elapsedMs = Date.now() - pollStartedAt;

        if (elapsedMs >= pollTimeoutMs) {
          pollHistory.push({
            attempt: pollIndex,
            status: responseStatus || "poll_timeout",
            artifacts: artifacts.length,
            elapsedMs,
            stopped: "poll_timeout"
          });
          break;
        }

        if (pollIndex > 1) {
          const remainingMs = pollTimeoutMs - elapsedMs;
          await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remainingMs)));
        }

        logToolCall("music_gen poll", {
          taskId: responseTaskId,
          attempt: pollIndex,
          maxAttempts: pollAttempts,
          intervalMs: pollIntervalMs,
          timeoutMs: pollTimeoutMs,
          url: queryContext.endpoint
        });
        let queryResult;

        try {
          queryResult = await queryContext.query();
        } catch (error) {
          pollHistory.push({
            attempt: pollIndex,
            status: responseStatus || "query_error",
            artifacts: artifacts.length,
            elapsedMs: Date.now() - pollStartedAt,
            error: error instanceof Error ? error.message : String(error)
          });
          break;
        }

        finalResult = queryResult.response;
        finalSanitized = queryResult.sanitized;
        responseStatus = queryResult.status || responseStatus;
        artifacts = queryResult.artifacts;
        pollHistory.push({
          attempt: pollIndex,
          status: responseStatus,
          artifacts: artifacts.length,
          elapsedMs: Date.now() - pollStartedAt
        });

        if (artifacts.length || (responseStatus && !isMusicPendingStatus(responseStatus))) {
          break;
        }
      }
    }
  }

  logToolCall("music_gen response", {
    ...callLog,
    durationMs: Date.now() - requestStartedAt,
    taskId: responseTaskId,
    status: responseStatus,
    artifacts: artifacts.length,
    pollHistory,
    responseKeys: finalSanitized.responseKeys
  });

  const finalResponseError = finalResult === response ? "" : getMusicResponseError(finalResult);

  if (finalResponseError) {
    throw new Error(`上游音乐查询接口返回错误：${finalResponseError}`);
  }

  if (responseStatus && isMusicFailedStatus(responseStatus)) {
    throw new Error(`音乐生成任务失败：${responseStatus}`);
  }

  if (["generate_song", "generate_instrumental"].includes(operationName) && !responseTaskId && !artifacts.length) {
    throw new Error(`上游音乐接口未返回 taskId 或音频 URL：${truncateText(JSON.stringify(sanitized), 1200)}`);
  }

  if (!artifacts.length && responseStatus && isMusicCompletedStatus(responseStatus)) {
    throw new Error(`音乐生成任务已完成，但上游未返回可播放音频 URL：${truncateText(JSON.stringify(finalSanitized), 1200)}`);
  }

  const pollError = [...pollHistory].reverse().find((entry) => entry?.error)?.error ?? "";
  const hasPollStop = pollHistory.some((entry) => entry?.stopped);
  const hasUnknownStatus = responseTaskId && !responseStatus && !artifacts.length;
  const isPending = Boolean(
    !artifacts.length &&
      !pollError &&
      (hasUnknownStatus || hasPollStop || (responseStatus && isMusicPendingStatus(responseStatus)))
  );
  const isCompleted = Boolean(artifacts.length || (responseStatus && isMusicCompletedStatus(responseStatus) && !isPending && !pollError));
  const pollExhausted = Boolean(pollHistory.length && isPending);
  const pollFailed = Boolean(pollError);

  return buildTextResult(
    `music_gen 调用完成
provider=${provider.label || provider.provider}
endpoint=${operation.endpoint}
${model ? `model=${model}\n` : ""}operation=${operationName}
${responseTaskId ? `taskId=${responseTaskId}\n` : ""}${responseStatus ? `status=${responseStatus}\n` : ""}${pollHistory.length ? `polls=${pollHistory.length}\n` : ""}${pollError ? `pollError=${pollError}\n` : ""}pending=${isPending}
completed=${isCompleted}
artifacts=${artifacts.length}

结果摘要：
${truncateText(JSON.stringify(finalSanitized.raw ?? finalSanitized, null, 2))}`,
    {
      provider: provider.provider,
      endpoint: operation.endpoint,
      model,
      operation: operationName,
      taskId: responseTaskId,
      status: responseStatus,
      pending: isPending,
      completed: isCompleted,
      pollExhausted,
      pollFailed,
      ...(pollError ? { pollError } : {}),
      call: callLog,
      ...(requestBody ? { requestBody: sanitizeMusicRequestBody(requestBody) } : {}),
      ...(pollHistory.length ? { pollHistory } : {}),
      artifacts,
      result: finalSanitized.raw ?? finalSanitized
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

    if (toolName === "video_gen") {
      ok(id, await callVideoGen(argumentsObject));
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
