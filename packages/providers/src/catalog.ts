import type { ProviderConnector } from "../../shared/src/index.js";

export const providerCatalog: ProviderConnector[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    integrationMode: "native",
    setupFields: ["apiKey", "baseUrl?", "organization?"],
    notes: "默认官方接入，后续可挂载 chat / embedding / tts / image 等能力适配器。"
  },
  {
    id: "azure",
    label: "Azure",
    kind: "azure",
    integrationMode: "native",
    setupFields: ["baseUrl", "apiKey", "deployment/model"],
    notes: "面向 Azure OpenAI / Azure AI 推理终端的原生接入，当前使用部署名或模型名作为调用入口。"
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "anthropic",
    integrationMode: "native",
    setupFields: ["apiKey", "baseUrl?"],
    notes: "保留独立 provider 配置，避免业务层直接耦合供应商差异。"
  },
  {
    id: "google",
    label: "Google",
    kind: "google",
    integrationMode: "native",
    setupFields: ["apiKey", "project?", "location?"],
    notes: "面向 Gemini 等模型系列做统一接入。"
  },
  {
    id: "doubao",
    label: "豆包",
    kind: "doubao",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "model"],
    notes: "当前通过 OpenAI-compatible 链路接入豆包模型服务，适合火山引擎推理线路。"
  },
  {
    id: "qwen",
    label: "千问",
    kind: "qwen",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "model"],
    notes: "当前通过 OpenAI-compatible 链路接入阿里云百炼 / 千问模型服务。"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "deepseek",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "model"],
    notes: "当前通过 OpenAI-compatible 链路接入 DeepSeek 推理服务。"
  },
  {
    id: "moonshot",
    label: "月之暗面",
    kind: "moonshot",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "model"],
    notes: "当前通过 OpenAI-compatible 链路接入 Moonshot / Kimi 推理服务。"
  },
  {
    id: "zhipu",
    label: "智谱",
    kind: "zhipu",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "model"],
    notes: "当前通过 OpenAI-compatible 链路接入智谱 GLM 系列模型服务。"
  },
  {
    id: "grok",
    label: "Grok",
    kind: "grok",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "model"],
    notes: "当前通过 OpenAI-compatible 链路接入 xAI / Grok 推理服务。"
  },
  {
    id: "openai-like",
    label: "OpenAI-like",
    kind: "openai_like",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "modelMap?"],
    notes: "兼容 OpenAI 协议的自定义模型服务入口，便于接入私有部署或第三方网关。"
  }
];
