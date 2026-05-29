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
const NON_STREAM_ONLY_PROFILE_IDS = new Set<string>();
const DEFAULT_MAX_OUTPUT_TOKENS = 32 * 1024;

interface ModelTextInvokeOptions {
  signal?: AbortSignal;
  onTextDelta?: (delta: string, text: string) => void;
}

interface SseEvent {
  event: string;
  data: string;
}

type SseTextExtractor = (payload: unknown, event: SseEvent) => string;
type SseTextSnapshotExtractor = (payload: unknown, event: SseEvent) => string;

type JsonOrSseTextResponse =
  | {
      kind: "json";
      payload: unknown;
    }
  | {
      kind: "sse";
      text: string;
    };

class ModelStreamReadError extends Error {
  readonly accumulatedText: string;

  constructor(message: string, accumulatedText = "") {
    super(message);
    this.name = "ModelStreamReadError";
    this.accumulatedText = accumulatedText;
  }
}

class ModelEmptySseResponseError extends Error {
  readonly eventSummary: string;

  constructor(label: string, eventSummary: string) {
    super(`${label} 没有返回可用文本内容（SSE 事件未包含可识别文本：${eventSummary}）`);
    this.name = "ModelEmptySseResponseError";
    this.eventSummary = eventSummary;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveMaxOutputTokens(request: ModelTextRequest): number {
  const value = request.maxOutputTokens;

  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_MAX_OUTPUT_TOKENS;
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

function formatConversationForResponsesInput(messages: ModelMessage[]): string {
  const conversation = getConversationMessages(messages)
    .map((message) => ({
      role: message.role,
      content: message.content.trim()
    }))
    .filter((message) => message.content);

  if (conversation.length === 1 && conversation[0]?.role === "user") {
    return conversation[0].content;
  }

  const roleLabels: Record<ModelMessage["role"], string> = {
    system: "System",
    user: "User",
    assistant: "Assistant"
  };

  return conversation
    .map((message) => `${roleLabels[message.role] ?? message.role}:\n${message.content}`)
    .join("\n\n");
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

function parseSseBlock(block: string): SseEvent | null {
  const normalizedBlock = block.trimEnd();

  if (!normalizedBlock.trim()) {
    return null;
  }

  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of normalizedBlock.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line || line.startsWith(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") {
      event = value || "message";
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (!dataLines.length) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n")
  };
}

function looksLikeSsePayload(value: string): boolean {
  const trimmed = value.trimStart();

  return trimmed.startsWith(":") || trimmed.startsWith("data:") || trimmed.startsWith("event:");
}

function buildRawTextPreview(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 300 ? `${normalized.slice(0, 300)}…[truncated ${normalized.length - 300} chars]` : normalized;
}

function extractSseTextFromRawText(
  rawText: string,
  label: string,
  extractDelta: SseTextExtractor,
  extractSnapshot?: SseTextSnapshotExtractor
): string {
  const normalizedText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let accumulatedText = "";
  let snapshotText = "";
  const eventSummaries: string[] = [];

  for (const block of normalizedText.split(/\n\n+/g)) {
    const event = parseSseBlock(block);

    if (!event) {
      continue;
    }

    const data = event.data.trim();

    if (!data || data === "[DONE]") {
      continue;
    }

    let payload: unknown;

    try {
      payload = JSON.parse(data) as unknown;
    } catch (error) {
      throw new Error(`${label} 流式响应解析失败：${error instanceof Error ? error.message : "未知错误"}`);
    }

    const payloadErrorMessage = extractErrorMessage(payload);

    if (payloadErrorMessage) {
      throw new Error(`模型服务错误：${payloadErrorMessage}`);
    }

    const delta = extractDelta(payload, event);

    if (delta) {
      accumulatedText += delta;
      continue;
    }

    const payloadType = readTextValue(getNestedValue(payload, ["type"]));
    const payloadKeys = isRecord(payload) ? Object.keys(payload).slice(0, 8).join(",") : typeof payload;
    const eventSummary = [event.event, payloadType, payloadKeys].filter(Boolean).join(" ");

    if (eventSummary) {
      eventSummaries.push(eventSummary);
    }

    const snapshot = extractSnapshot?.(payload, event).trim() ?? "";

    if (snapshot && snapshot.length >= snapshotText.length) {
      snapshotText = snapshot;
    }
  }

  const text = accumulatedText.trim() || snapshotText.trim();

  if (!text) {
    const eventSummary = eventSummaries.length
      ? eventSummaries.slice(0, 8).join(" / ")
      : "仅收到 keep-alive 或空事件";
    throw new ModelEmptySseResponseError(label, eventSummary);
  }

  return text;
}

async function parseJsonOrSseTextResponse(
  response: Response,
  label: string,
  extractDelta: SseTextExtractor,
  extractSnapshot?: SseTextSnapshotExtractor
): Promise<JsonOrSseTextResponse> {
  let rawText = "";

  try {
    rawText = await response.text();
  } catch (error) {
    throw new Error(`${label} 响应读取失败：${error instanceof Error ? error.message : "未知错误"}`);
  }

  const trimmedText = rawText.trim();

  if (!trimmedText) {
    throw new Error(`${label} 返回空响应`);
  }

  if (looksLikeSsePayload(trimmedText)) {
    return {
      kind: "sse",
      text: extractSseTextFromRawText(rawText, label, extractDelta, extractSnapshot)
    };
  }

  try {
    return {
      kind: "json",
      payload: JSON.parse(trimmedText) as unknown
    };
  } catch (error) {
    throw new Error(
      `${label} 返回了非 JSON 响应：${buildRawTextPreview(trimmedText)}（${error instanceof Error ? error.message : "未知错误"}）`
    );
  }
}

async function consumeSseEvents(response: Response, onEvent: (event: SseEvent) => void | Promise<void>): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("模型服务没有返回可读取的流式响应");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const flushBlocks = async (flushRemaining = false): Promise<void> => {
    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const event = parseSseBlock(block);

      if (event) {
        await onEvent(event);
      }

      separatorIndex = buffer.indexOf("\n\n");
    }

    if (flushRemaining && buffer.trim()) {
      const event = parseSseBlock(buffer);
      buffer = "";

      if (event) {
        await onEvent(event);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      await flushBlocks();
    }

    buffer += decoder.decode().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    await flushBlocks(true);
  } finally {
    reader.releaseLock();
  }
}

function emitTextDelta(options: ModelTextInvokeOptions, delta: string, accumulatedText: string): void {
  if (!delta) {
    return;
  }

  options.onTextDelta?.(delta, accumulatedText);
}

function withoutTextDelta(options: ModelTextInvokeOptions): ModelTextInvokeOptions {
  return {
    ...(options.signal ? { signal: options.signal } : {})
  };
}

function shouldFallbackToNonStream(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return false;
  }

  return error instanceof ModelStreamReadError && !error.accumulatedText.trim();
}

function shouldDisableStreamForPayload(payload: unknown): boolean {
  return Boolean(extractErrorMessage(payload) || !extractOpenAiCompatibleText(payload).trim());
}

function rememberNonStreamOnlyProfile(profile: ModelProfile): void {
  NON_STREAM_ONLY_PROFILE_IDS.add(profile.id);
}

function canAttemptStream(profile: ModelProfile): boolean {
  return profile.supportsStreaming !== false && !NON_STREAM_ONLY_PROFILE_IDS.has(profile.id);
}

function logStreamFallback(
  label: string,
  profile: ModelProfile,
  endpoint: string,
  reason: string
): void {
  console.warn(`[providers] ${label} stream failed before output, falling back to non-stream request`, {
    provider: profile.provider,
    profileId: profile.id,
    profileLabel: profile.displayName,
    model: profile.model,
    endpoint: sanitizeUrlForLogging(endpoint),
    reason
  });
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

function extractOpenAiResponsesText(payload: unknown): string {
  const directCandidates = [
    getNestedValue(payload, ["output_text"]),
    getNestedValue(payload, ["response", "output_text"])
  ];

  for (const candidate of directCandidates) {
    const text = parseOpenAiMessageContent(candidate);

    if (text) {
      return text;
    }
  }

  const output = getNestedValue(payload, ["output"]) ?? getNestedValue(payload, ["response", "output"]);

  if (Array.isArray(output)) {
    const parts = output
      .map((item) => {
        if (!isRecord(item)) {
          return "";
        }

        return parseOpenAiMessageContent(item.content);
      })
      .filter(Boolean);

    if (parts.length) {
      return parts.join("\n");
    }
  }

  return extractOpenAiCompatibleText(payload);
}

function extractOpenAiResponsesStreamDelta(payload: unknown): string {
  return parseOpenAiMessageContent(getNestedValue(payload, ["delta"])).trim()
    || readTextValue(getNestedValue(payload, ["part", "delta"]))
    || readTextValue(getNestedValue(payload, ["text_delta"]));
}

function extractOpenAiResponsesSseDelta(payload: unknown, event: SseEvent): string {
  const eventType = event.event || readTextValue(getNestedValue(payload, ["type"]));
  const choices = getNestedValue(payload, ["choices"]);
  const canUseCompatibleDelta =
    eventType === "message" ||
    eventType.includes("delta") ||
    Array.isArray(choices);
  const compatibleDelta = canUseCompatibleDelta ? extractOpenAiCompatibleStreamDelta(payload) : "";

  if (compatibleDelta) {
    return compatibleDelta;
  }

  if (!eventType.includes("delta")) {
    return "";
  }

  return extractOpenAiResponsesStreamDelta(payload);
}

function extractOpenAiCompatibleStreamDelta(payload: unknown): string {
  const choices = getNestedValue(payload, ["choices"]);
  const deltas: string[] = [];

  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const delta = getNestedValue(choice, ["delta"]);
      const candidates = [
        getNestedValue(delta, ["content"]),
        getNestedValue(delta, ["text"]),
        getNestedValue(delta, ["output_text"]),
        getNestedValue(delta, ["reasoning_content"]),
        getNestedValue(delta, ["reasoning"]),
        delta
      ];

      for (const candidate of candidates) {
        const text = parseOpenAiMessageContent(candidate).trim();

        if (text) {
          deltas.push(text);
          break;
        }
      }
    }
  }

  if (deltas.length) {
    return deltas.join("");
  }

  return parseOpenAiMessageContent(getNestedValue(payload, ["delta", "content"]))
    || parseOpenAiMessageContent(getNestedValue(payload, ["delta", "text"]))
    || parseOpenAiMessageContent(getNestedValue(payload, ["delta", "output_text"]))
    || parseOpenAiMessageContent(getNestedValue(payload, ["delta"]));
}

function extractOpenAiCompatibleStreamSnapshot(payload: unknown): string {
  return extractOpenAiCompatibleText(payload).trim();
}

function extractOpenAiResponsesStreamSnapshot(payload: unknown): string {
  return extractOpenAiResponsesText(payload).trim()
    || parseOpenAiMessageContent(getNestedValue(payload, ["part", "text"])).trim()
    || parseOpenAiMessageContent(getNestedValue(payload, ["item", "content"])).trim()
    || parseOpenAiMessageContent(getNestedValue(payload, ["item", "content", 0, "text"])).trim()
    || extractOpenAiCompatibleStreamSnapshot(payload);
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
  const payloadErrorMessage = extractErrorMessage(payload);

  if (payloadErrorMessage) {
    return payloadErrorMessage;
  }

  const finishReason = getNestedValue(payload, ["choices", 0, "finish_reason"]);

  if (typeof finishReason === "string" && finishReason.trim()) {
    return `finish_reason=${finishReason.trim()}`;
  }

  const status = readTextValue(getNestedValue(payload, ["status"])) || readTextValue(getNestedValue(payload, ["response", "status"]));

  if (status && status !== "completed") {
    return `status=${status}`;
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

  if ("code_msg" in payload && typeof payload.code_msg === "string") {
    return payload.code_msg;
  }

  if ("response" in payload) {
    const responseErrorMessage = extractErrorMessage(payload.response);

    if (responseErrorMessage) {
      return responseErrorMessage;
    }
  }

  return null;
}

async function parseErrorResponse(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  let text = "";

  try {
    text = await response.text();
  } catch {
    return fallback;
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    return fallback;
  }

  try {
    const payload = JSON.parse(trimmedText) as unknown;
    return extractErrorMessage(payload) ?? fallback;
  } catch {
    return trimmedText;
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

function shouldUseSseStream(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  return !contentType.includes("application/json");
}

function buildOpenAiStyleEndpoint(profile: ModelProfile, path: "/chat/completions" | "/responses"): string {
  const baseUrl = trimTrailingSlash(profile.baseUrl?.trim() || "https://api.openai.com/v1");

  if (baseUrl.endsWith(path)) {
    return baseUrl;
  }

  if (path === "/responses" && baseUrl.endsWith("/chat/completions")) {
    return `${baseUrl.slice(0, -"/chat/completions".length)}/responses`;
  }

  if (path === "/chat/completions" && baseUrl.endsWith("/responses")) {
    return `${baseUrl.slice(0, -"/responses".length)}/chat/completions`;
  }

  return `${baseUrl}${path}`;
}

function buildOpenAiResponsesPromptCacheKey(profile: ModelProfile): string {
  return `gordon-${profile.id || profile.displayName || profile.model}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
}

async function readOpenAiCompatibleStream(
  profile: ModelProfile,
  endpoint: string,
  response: Response,
  options: ModelTextInvokeOptions
): Promise<string> {
  let accumulatedText = "";
  let snapshotText = "";

  try {
    await consumeSseEvents(response, (event) => {
      const data = event.data.trim();

      if (!data || data === "[DONE]") {
        return;
      }

      let payload: unknown;

      try {
        payload = JSON.parse(data) as unknown;
      } catch (error) {
        throw new ModelStreamReadError(
          `模型流式响应解析失败：${error instanceof Error ? error.message : "未知错误"}`,
          accumulatedText
        );
      }

      const payloadErrorMessage = extractErrorMessage(payload);

      if (payloadErrorMessage) {
        throw new ModelStreamReadError(`模型服务错误：${payloadErrorMessage}`, accumulatedText);
      }

      const delta = extractOpenAiCompatibleStreamDelta(payload);

      if (delta) {
        accumulatedText += delta;
        emitTextDelta(options, delta, accumulatedText);
        return;
      }

      const snapshot = extractOpenAiCompatibleStreamSnapshot(payload);

      if (!accumulatedText.trim() && snapshot && snapshot.length >= snapshotText.length) {
        snapshotText = snapshot;
        emitTextDelta(options, snapshot, snapshotText);
      }
    });
  } catch (error) {
    if (error instanceof ModelStreamReadError) {
      throw error;
    }

    throw new ModelStreamReadError(error instanceof Error ? error.message : "模型流式响应读取失败", accumulatedText);
  }

  const text = accumulatedText.trim() || snapshotText.trim();

  if (!text) {
    throw new ModelStreamReadError("模型没有返回可用文本内容", accumulatedText);
  }

  return text;
}

async function readOpenAiResponsesStream(
  profile: ModelProfile,
  endpoint: string,
  response: Response,
  options: ModelTextInvokeOptions
): Promise<string> {
  let accumulatedText = "";
  let snapshotText = "";

  try {
    await consumeSseEvents(response, (event) => {
      const data = event.data.trim();

      if (!data || data === "[DONE]") {
        return;
      }

      let payload: unknown;

      try {
        payload = JSON.parse(data) as unknown;
      } catch (error) {
        throw new ModelStreamReadError(
          `模型流式响应解析失败：${error instanceof Error ? error.message : "未知错误"}`,
          accumulatedText
        );
      }

      const payloadErrorMessage = extractErrorMessage(payload);

      if (payloadErrorMessage) {
        throw new ModelStreamReadError(`模型服务错误：${payloadErrorMessage}`, accumulatedText);
      }

      const delta = extractOpenAiResponsesSseDelta(payload, event);

      if (delta) {
        accumulatedText += delta;
        emitTextDelta(options, delta, accumulatedText);
        return;
      }

      const snapshot = extractOpenAiResponsesStreamSnapshot(payload);

      if (!accumulatedText.trim() && snapshot && snapshot.length >= snapshotText.length) {
        snapshotText = snapshot;
        emitTextDelta(options, snapshot, snapshotText);
      }
    });
  } catch (error) {
    if (error instanceof ModelStreamReadError) {
      throw error;
    }

    throw new ModelStreamReadError(error instanceof Error ? error.message : "模型流式响应读取失败", accumulatedText);
  }

  const text = accumulatedText.trim() || snapshotText.trim();

  if (!text) {
    throw new ModelStreamReadError("模型没有返回可用文本内容", accumulatedText);
  }

  return text;
}

async function invokeOpenAiResponses(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  const endpoint = buildOpenAiStyleEndpoint(profile, "/responses");
  const stream = canAttemptStream(profile);
  const instructions = getSystemPrompt(request.messages);
  const maxOutputTokens = resolveMaxOutputTokens(request);
  const response = await fetch(endpoint, {
    method: "POST",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`,
      ...(profile.organization?.trim() ? { "OpenAI-Organization": profile.organization.trim() } : {})
    },
    body: JSON.stringify({
      model: profile.model,
      input: formatConversationForResponsesInput(request.messages),
      ...(instructions ? { instructions } : {}),
      prompt_cache_key: buildOpenAiResponsesPromptCacheKey(profile),
      store: false,
      ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      max_output_tokens: maxOutputTokens,
      ...(stream ? { stream: true } : {})
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (stream && shouldUseSseStream(response)) {
    try {
      return {
        text: await readOpenAiResponsesStream(profile, endpoint, response, options),
        model: profile.model,
        profileId: profile.id,
        profileLabel: profile.displayName,
        provider: profile.provider
      };
    } catch (error) {
      if (shouldFallbackToNonStream(error, options.signal)) {
        rememberNonStreamOnlyProfile(profile);
        logStreamFallback("OpenAI Responses", profile, endpoint, error instanceof Error ? error.message : "unknown");
        return invokeOpenAiResponses(profile, request, withoutTextDelta(options));
      }

      throw error;
    }
  }

  let parsedResponse: JsonOrSseTextResponse;

  parsedResponse = await parseJsonOrSseTextResponse(
    response,
    "OpenAI Responses",
    (payload, event) => extractOpenAiResponsesSseDelta(payload, event),
    (payload) => extractOpenAiResponsesText(payload)
  );

  if (parsedResponse.kind === "sse") {
    return {
      text: parsedResponse.text,
      model: profile.model,
      profileId: profile.id,
      profileLabel: profile.displayName,
      provider: profile.provider
    };
  }

  const payload = parsedResponse.payload;
  const payloadErrorMessage = extractErrorMessage(payload);

  if (payloadErrorMessage) {
    logMissingOpenAiStyleText(profile, endpoint, payload);
    throw new Error(`模型服务错误：${payloadErrorMessage}`);
  }

  const text = extractOpenAiResponsesText(payload).trim();

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

async function invokeOpenAiChatCompletions(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  const endpoint = buildOpenAiStyleEndpoint(profile, "/chat/completions");
  const stream = canAttemptStream(profile);
  const maxOutputTokens = resolveMaxOutputTokens(request);
  const response = await fetch(endpoint, {
    method: "POST",
    signal: options.signal,
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
      max_tokens: maxOutputTokens,
      ...(stream ? { stream: true } : {})
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (stream && shouldUseSseStream(response)) {
    try {
      return {
        text: await readOpenAiCompatibleStream(profile, endpoint, response, options),
        model: profile.model,
        profileId: profile.id,
        profileLabel: profile.displayName,
        provider: profile.provider
      };
    } catch (error) {
      if (shouldFallbackToNonStream(error, options.signal)) {
        rememberNonStreamOnlyProfile(profile);
        logStreamFallback("OpenAI-style", profile, endpoint, error instanceof Error ? error.message : "unknown");
        return invokeOpenAiChatCompletions(profile, request, withoutTextDelta(options));
      }

      throw error;
    }
  }

  const parsedResponse = await parseJsonOrSseTextResponse(
    response,
    "OpenAI-style",
    (payload) => extractOpenAiCompatibleStreamDelta(payload),
    (payload) => extractOpenAiCompatibleText(payload)
  );

  if (parsedResponse.kind === "sse") {
    return {
      text: parsedResponse.text,
      model: profile.model,
      profileId: profile.id,
      profileLabel: profile.displayName,
      provider: profile.provider
    };
  }

  const payload = parsedResponse.payload;
  const payloadErrorMessage = extractErrorMessage(payload);

  if (payloadErrorMessage) {
    if (stream && shouldDisableStreamForPayload(payload)) {
      rememberNonStreamOnlyProfile(profile);
      logStreamFallback("OpenAI-style JSON", profile, endpoint, payloadErrorMessage);
      return invokeOpenAiChatCompletions(profile, request, withoutTextDelta(options));
    }

    logMissingOpenAiStyleText(profile, endpoint, payload);
    throw new Error(`模型服务错误：${payloadErrorMessage}`);
  }

  const text = extractOpenAiCompatibleText(payload).trim();

  if (!text) {
    if (stream && shouldDisableStreamForPayload(payload)) {
      const reason = buildMissingTextReason(payload);
      rememberNonStreamOnlyProfile(profile);
      logStreamFallback("OpenAI-style JSON", profile, endpoint, reason ?? "模型没有返回可用文本内容");
      return invokeOpenAiChatCompletions(profile, request, withoutTextDelta(options));
    }

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

async function invokeOpenAiCompatible(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  if (profile.apiFormat === "responses") {
    return invokeOpenAiResponses(profile, request, options);
  }

  return invokeOpenAiChatCompletions(profile, request, options);
}

async function invokeAzure(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  const endpoint = buildAzureEndpoint(profile);
  const stream = canAttemptStream(profile);
  const maxOutputTokens = resolveMaxOutputTokens(request);
  const response = await fetch(endpoint, {
    method: "POST",
    signal: options.signal,
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
      max_tokens: maxOutputTokens,
      ...(stream ? { stream: true } : {})
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (stream && shouldUseSseStream(response)) {
    try {
      return {
        text: await readOpenAiCompatibleStream(profile, endpoint, response, options),
        model: profile.model,
        profileId: profile.id,
        profileLabel: profile.displayName,
        provider: profile.provider
      };
    } catch (error) {
      if (shouldFallbackToNonStream(error, options.signal)) {
        rememberNonStreamOnlyProfile(profile);
        logStreamFallback("Azure", profile, endpoint, error instanceof Error ? error.message : "unknown");
        return invokeAzure(profile, request, withoutTextDelta(options));
      }

      throw error;
    }
  }

  const parsedResponse = await parseJsonOrSseTextResponse(
    response,
    "Azure",
    (payload) => extractOpenAiCompatibleStreamDelta(payload),
    (payload) => extractOpenAiCompatibleText(payload)
  );

  if (parsedResponse.kind === "sse") {
    return {
      text: parsedResponse.text,
      model: profile.model,
      profileId: profile.id,
      profileLabel: profile.displayName,
      provider: profile.provider
    };
  }

  const payload = parsedResponse.payload;
  const payloadErrorMessage = extractErrorMessage(payload);

  if (payloadErrorMessage) {
    if (stream && shouldDisableStreamForPayload(payload)) {
      rememberNonStreamOnlyProfile(profile);
      logStreamFallback("Azure JSON", profile, endpoint, payloadErrorMessage);
      return invokeAzure(profile, request, withoutTextDelta(options));
    }

    logMissingOpenAiStyleText(profile, endpoint, payload);
    throw new Error(`模型服务错误：${payloadErrorMessage}`);
  }

  const text = extractOpenAiCompatibleText(payload).trim();

  if (!text) {
    if (stream && shouldDisableStreamForPayload(payload)) {
      const reason = buildMissingTextReason(payload);
      rememberNonStreamOnlyProfile(profile);
      logStreamFallback("Azure JSON", profile, endpoint, reason ?? "模型没有返回可用文本内容");
      return invokeAzure(profile, request, withoutTextDelta(options));
    }

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

async function invokeAnthropic(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  const endpoint = `${trimTrailingSlash(profile.baseUrl?.trim() || "https://api.anthropic.com")}/v1/messages`;
  const conversation = getConversationMessages(request.messages);
  const stream = canAttemptStream(profile);
  const maxOutputTokens = resolveMaxOutputTokens(request);
  const response = await fetch(endpoint, {
    method: "POST",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": profile.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: profile.model,
      max_tokens: maxOutputTokens,
      ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      ...(getSystemPrompt(request.messages) ? { system: getSystemPrompt(request.messages) } : {}),
      ...(stream ? { stream: true } : {}),
      messages: conversation.map((message) => ({
        role: message.role,
        content: [{ type: "text", text: message.content }]
      }))
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (stream && shouldUseSseStream(response)) {
    let accumulatedText = "";

    await consumeSseEvents(response, (event) => {
      if (!event.data.trim() || event.data.trim() === "[DONE]") {
        return;
      }

      let payload: unknown;

      try {
        payload = JSON.parse(event.data) as unknown;
      } catch (error) {
        throw new Error(`模型流式响应解析失败：${error instanceof Error ? error.message : "未知错误"}`);
      }

      const payloadErrorMessage = extractErrorMessage(payload);

      if (payloadErrorMessage) {
        throw new Error(`模型服务错误：${payloadErrorMessage}`);
      }

      const delta = event.event === "content_block_delta"
        ? readTextValue(getNestedValue(payload, ["delta", "text"]))
        : "";

      if (delta) {
        accumulatedText += delta;
        emitTextDelta(options, delta, accumulatedText);
      }
    });

    const text = accumulatedText.trim();

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

  const parsedResponse = await parseJsonOrSseTextResponse(
    response,
    "Anthropic",
    (payload, event) => event.event === "content_block_delta"
      ? readTextValue(getNestedValue(payload, ["delta", "text"]))
      : "",
    (payload) => (getNestedValue(payload, ["content"]) as Array<{ type?: string; text?: string }> | undefined)
      ?.map((item) => (item.type === "text" ? item.text ?? "" : ""))
      .join("\n") ?? ""
  );

  if (parsedResponse.kind === "sse") {
    return {
      text: parsedResponse.text,
      model: profile.model,
      profileId: profile.id,
      profileLabel: profile.displayName,
      provider: profile.provider
    };
  }

  const payload = parsedResponse.payload as {
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

function buildGoogleEndpoint(profile: ModelProfile, stream = false): string {
  const baseUrl = profile.baseUrl?.trim();
  const method = stream ? "streamGenerateContent" : "generateContent";
  const defaultEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:${method}?key=${encodeURIComponent(profile.apiKey)}${stream ? "&alt=sse" : ""}`;

  if (!baseUrl) {
    return defaultEndpoint;
  }

  if (baseUrl.includes(":generateContent") || baseUrl.includes(":streamGenerateContent")) {
    const resolvedBaseUrl = stream
      ? baseUrl.replace(":generateContent", ":streamGenerateContent")
      : baseUrl.replace(":streamGenerateContent", ":generateContent");
    return `${resolvedBaseUrl}${resolvedBaseUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(profile.apiKey)}${stream ? "&alt=sse" : ""}`;
  }

  if (baseUrl.includes("{model}")) {
    const resolved = baseUrl.replaceAll("{model}", encodeURIComponent(profile.model));
    return `${resolved}${resolved.includes("?") ? "&" : "?"}key=${encodeURIComponent(profile.apiKey)}${stream ? "&alt=sse" : ""}`;
  }

  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  return `${normalizedBaseUrl}/${encodeURIComponent(profile.model)}:${method}?key=${encodeURIComponent(profile.apiKey)}${stream ? "&alt=sse" : ""}`;
}

async function invokeGoogle(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  const systemPrompt = getSystemPrompt(request.messages);
  const conversation = getConversationMessages(request.messages);
  const stream = canAttemptStream(profile);
  const maxOutputTokens = resolveMaxOutputTokens(request);
  const response = await fetch(buildGoogleEndpoint(profile, stream), {
    method: "POST",
    signal: options.signal,
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
        maxOutputTokens
      }
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (stream && shouldUseSseStream(response)) {
    let accumulatedText = "";

    await consumeSseEvents(response, (event) => {
      if (!event.data.trim() || event.data.trim() === "[DONE]") {
        return;
      }

      let payload: unknown;

      try {
        payload = JSON.parse(event.data) as unknown;
      } catch (error) {
        throw new Error(`模型流式响应解析失败：${error instanceof Error ? error.message : "未知错误"}`);
      }

      const payloadErrorMessage = extractErrorMessage(payload);

      if (payloadErrorMessage) {
        throw new Error(`模型服务错误：${payloadErrorMessage}`);
      }

      const delta = (getNestedValue(payload, ["candidates", 0, "content", "parts"]) as unknown[] | undefined)
        ?.map((part) => readTextValue(getNestedValue(part, ["text"])))
        .join("") ?? "";

      if (delta) {
        accumulatedText += delta;
        emitTextDelta(options, delta, accumulatedText);
      }
    });

    const text = accumulatedText.trim();

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

  const parsedResponse = await parseJsonOrSseTextResponse(
    response,
    "Google",
    (payload) => (getNestedValue(payload, ["candidates", 0, "content", "parts"]) as unknown[] | undefined)
      ?.map((part) => readTextValue(getNestedValue(part, ["text"])))
      .join("") ?? "",
    (payload) => (getNestedValue(payload, ["candidates", 0, "content", "parts"]) as unknown[] | undefined)
      ?.map((part) => readTextValue(getNestedValue(part, ["text"])))
      .join("\n") ?? ""
  );

  if (parsedResponse.kind === "sse") {
    return {
      text: parsedResponse.text,
      model: profile.model,
      profileId: profile.id,
      profileLabel: profile.displayName,
      provider: profile.provider
    };
  }

  const payload = parsedResponse.payload as {
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

export async function invokeModelText(
  profile: ModelProfile,
  request: ModelTextRequest,
  options: ModelTextInvokeOptions = {}
): Promise<ModelTextResponse> {
  if (OPENAI_COMPATIBLE_PROVIDERS.has(profile.provider)) {
    return invokeOpenAiCompatible(profile, request, options);
  }

  if (profile.provider === "azure") {
    return invokeAzure(profile, request, options);
  }

  if (profile.provider === "anthropic") {
    return invokeAnthropic(profile, request, options);
  }

  if (profile.provider === "google") {
    return invokeGoogle(profile, request, options);
  }

  throw new Error(`暂不支持的模型供应商：${profile.provider}`);
}
