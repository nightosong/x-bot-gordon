import { Script, createContext } from "node:vm";

import { appendModelBalanceHistoryEntry, saveModelProfileBalanceSnapshot } from "../../../packages/workbench/src/index.js";
import type { ModelBalanceQueryRequest, ModelBalanceSnapshot, ModelProfile } from "../../../packages/shared/src/index.js";

const BALANCE_PROTOCOL_EVAL_TIMEOUT_MS = 1200;
const BALANCE_PROTOCOL_REQUEST_TIMEOUT_MS = 15000;
const TEMPLATE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

type BalanceQueryProtocol = {
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, unknown>;
    body?: unknown;
  };
  extractor?: (raw: unknown) => unknown;
};

type BalanceQueryContext = Record<string, string>;

function interpolateTemplate(value: string, context: BalanceQueryContext): string {
  return value.replace(TEMPLATE_PATTERN, (_match, key) => context[key] ?? "");
}

function applyTemplateVariables(value: unknown, context: BalanceQueryContext): unknown {
  if (typeof value === "string") {
    return interpolateTemplate(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyTemplateVariables(item, context));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, applyTemplateVariables(entryValue, context)])
    );
  }

  return value;
}

function buildTemplateContext(profile: ModelProfile): BalanceQueryContext {
  return {
    apiKey: String(profile.apiKey ?? ""),
    baseUrl: String(profile.baseUrl ?? ""),
    displayName: String(profile.displayName ?? ""),
    model: String(profile.model ?? ""),
    notes: String(profile.notes ?? ""),
    organization: String(profile.organization ?? ""),
    project: String(profile.project ?? ""),
    location: String(profile.location ?? ""),
    provider: String(profile.provider ?? "")
  };
}

function parseBalanceQueryProtocol(profile: ModelProfile): BalanceQueryProtocol {
  const source = String(profile.balanceQueryCode ?? "").trim();

  if (!source) {
    throw new Error("当前配置还没有填写余额查询提取器代码。");
  }

  const context = createContext({
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Date,
    Array,
    Object,
    URL,
    encodeURIComponent,
    decodeURIComponent,
    parseFloat,
    parseInt
  });
  const protocol = new Script(source, { filename: "model-balance-extractor.js" }).runInContext(context, {
    timeout: BALANCE_PROTOCOL_EVAL_TIMEOUT_MS
  }) as BalanceQueryProtocol;

  if (!protocol || typeof protocol !== "object") {
    throw new Error("余额查询提取器代码必须返回一个对象。");
  }

  if (!protocol.request || typeof protocol.request !== "object") {
    throw new Error("余额查询提取器代码缺少 request 配置。");
  }

  if (typeof protocol.extractor !== "function") {
    throw new Error("余额查询提取器代码缺少 extractor 函数。");
  }

  return protocol;
}

function buildRequestInit(profile: ModelProfile, protocol: BalanceQueryProtocol): {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
} {
  const context = buildTemplateContext(profile);
  const requestConfig = applyTemplateVariables(protocol.request ?? {}, context) as BalanceQueryProtocol["request"];
  const url = String(requestConfig?.url ?? "").trim();

  if (!url) {
    throw new Error("余额查询 request.url 不能为空。");
  }

  const method = String(requestConfig?.method ?? "GET").trim().toUpperCase() || "GET";
  const headers = Object.fromEntries(
    Object.entries(requestConfig?.headers ?? {}).map(([key, value]) => [key, String(value ?? "")])
  );
  const bodyValue = requestConfig?.body;

  if (bodyValue == null || bodyValue === "") {
    return {
      url,
      method,
      headers
    };
  }

  if (typeof bodyValue === "string") {
    return {
      url,
      method,
      headers,
      body: bodyValue
    };
  }

  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  return {
    url,
    method,
    headers,
    body: JSON.stringify(bodyValue)
  };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildHttpErrorMessage(status: number, statusText: string, payload: unknown): string {
  const detail =
    typeof payload === "string" ? payload.trim() : payload && typeof payload === "object" ? JSON.stringify(payload) : "";
  const compactDetail = detail.length > 180 ? `${detail.slice(0, 177)}...` : detail;

  return compactDetail
    ? `余额查询失败：HTTP ${status} ${statusText}，响应：${compactDetail}`
    : `余额查询失败：HTTP ${status} ${statusText}`;
}

async function executeBalanceRequest(profile: ModelProfile, protocol: BalanceQueryProtocol): Promise<unknown> {
  const requestInit = buildRequestInit(profile, protocol);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BALANCE_PROTOCOL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestInit.url, {
      method: requestInit.method,
      headers: requestInit.headers,
      body: requestInit.body,
      signal: controller.signal
    });
    const responseText = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const rawPayload =
      contentType.includes("application/json") || contentType.includes("+json") ? tryParseJson(responseText) : responseText;

    if (!response.ok) {
      throw new Error(buildHttpErrorMessage(response.status, response.statusText, rawPayload));
    }

    return rawPayload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("余额查询超时，请检查接口地址或网络情况。");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBalanceSnapshot(result: unknown): ModelBalanceSnapshot {
  if (!result || typeof result !== "object") {
    throw new Error("余额提取器返回值无效，请返回包含余额字段的对象。");
  }

  const raw = result as Record<string, unknown>;
  let remaining = toFiniteNumber(raw.remaining);
  let used = toFiniteNumber(raw.used);
  let total = toFiniteNumber(raw.total);

  if (remaining == null && total != null && used != null) {
    remaining = total - used;
  }

  if (used == null && total != null && remaining != null) {
    used = total - remaining;
  }

  if (total == null && remaining != null && used != null) {
    total = remaining + used;
  }

  if (remaining == null || used == null) {
    throw new Error("余额提取器必须返回 remaining / used，或返回可推导它们的 total。");
  }

  return {
    planName: String(raw.planName ?? "").trim() || undefined,
    remaining,
    used,
    total,
    unit: String(raw.unit ?? "USD").trim() || "USD",
    queriedAt: new Date().toISOString()
  };
}

function runExtractor(protocol: BalanceQueryProtocol, raw: unknown): ModelBalanceSnapshot {
  const context = createContext({
    __extractor: protocol.extractor,
    __raw: raw
  });
  const result = new Script("__extractor(__raw)").runInContext(context, {
    timeout: BALANCE_PROTOCOL_EVAL_TIMEOUT_MS
  });

  return normalizeBalanceSnapshot(result);
}

export async function queryModelBalance(request: ModelBalanceQueryRequest): Promise<ModelBalanceSnapshot> {
  const profile = request.profile;

  if (!profile?.apiKey?.trim()) {
    throw new Error("当前模型配置缺少 API Key，暂时无法查询余额。");
  }

  const protocol = parseBalanceQueryProtocol(profile);
  const raw = await executeBalanceRequest(profile, protocol);
  const balanceSnapshot = runExtractor(protocol, raw);

  if (request.persistResult && profile.id) {
    await saveModelProfileBalanceSnapshot(profile.id, balanceSnapshot);
    await appendModelBalanceHistoryEntry(profile, balanceSnapshot, request.historySource ?? "manual");
  }

  return balanceSnapshot;
}
