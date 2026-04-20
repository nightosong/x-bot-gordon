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
    id: "openai-like",
    label: "OpenAI-like",
    kind: "openai_like",
    integrationMode: "compatible",
    setupFields: ["baseUrl", "apiKey", "modelMap?"],
    notes: "兼容 OpenAI 协议的自定义模型服务入口，便于接入私有部署或第三方网关。"
  }
];
