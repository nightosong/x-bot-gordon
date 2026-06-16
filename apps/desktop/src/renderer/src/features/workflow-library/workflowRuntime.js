import {
  WORKFLOW_CURL_BODY_OPTIONS,
  WORKFLOW_DEFAULT_ENVIRONMENTS,
  createWorkflowStepDraft
} from "./workflowConfig.js";

let fallbackRuntimeIdSeed = 0;

function createFallbackLocalId(prefix) {
  fallbackRuntimeIdSeed += 1;
  return `${prefix}_${Date.now()}_${fallbackRuntimeIdSeed}`;
}

function resolveCreateLocalId(options = {}) {
  return typeof options.createLocalId === "function" ? options.createLocalId : createFallbackLocalId;
}

export function formatDurationMs(value) {
  const duration = Number(value ?? 0);

  if (duration <= 0) {
    return "0s";
  }

  if (duration < 1000) {
    return `${duration}ms`;
  }

  if (duration < 60_000) {
    return `${Math.round(duration / 1000)}s`;
  }

  if (duration < 3_600_000) {
    const minutes = Math.floor(duration / 60_000);
    const seconds = Math.round((duration % 60_000) / 1000);
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(duration / 3_600_000);
  const minutes = Math.round((duration % 3_600_000) / 60_000);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function getWorkflowTimeoutMs(protocol) {
  if (!protocol) {
    return 0;
  }

  return Math.max(
    Number(protocol.timeoutMs ?? 0),
    Number(protocol.initialWaitMs ?? 0) + Number(protocol.pollIntervalMs ?? 0) * Number(protocol.maxAttempts ?? 0)
  );
}

export function getWorkflowProtocolSummary(protocol) {
  if (!protocol) {
    return "暂无协议";
  }

  if (protocol.mode === "polling") {
    return `先等 ${formatDurationMs(protocol.initialWaitMs)}，再每 ${formatDurationMs(protocol.pollIntervalMs)} 轮询，最长 ${formatDurationMs(getWorkflowTimeoutMs(protocol))}`;
  }

  if (protocol.mode === "sequential") {
    return "按固定顺序串行执行";
  }

  return "单次同步调用";
}

export function getWorkflowStepModeLabel(mode) {
  return mode === "polling" ? "轮询" : "单次";
}

export function getWorkflowStepStatusLabel(status) {
  if (status === "success") {
    return "成功";
  }

  if (status === "cancelled") {
    return "已中断";
  }

  if (status === "failed") {
    return "失败";
  }

  if (status === "running") {
    return "执行中";
  }

  return "等待中";
}

export function getWorkflowStepStatusTone(status) {
  if (status === "success") {
    return "is-success";
  }

  if (status === "cancelled") {
    return "is-cancelled";
  }

  if (status === "failed") {
    return "is-danger";
  }

  if (status === "running") {
    return "is-warning";
  }

  return "";
}

export function getWorkflowRunCompletedCount(runResult) {
  return (runResult?.steps ?? []).filter((step) => ["success", "failed", "cancelled"].includes(step.status)).length;
}

export function getWorkflowRunProgressPercent(runResult) {
  const steps = runResult?.steps ?? [];

  if (!steps.length) {
    return 0;
  }

  const total = steps.reduce((sum, step) => sum + getWorkflowStepProgressPercent(step), 0);
  return Math.round(total / steps.length);
}

export function getWorkflowRunDurationLabel(runResult) {
  const startedAt = new Date(runResult?.startedAt ?? "").getTime();
  const finishedAt = runResult?.finishedAt ? new Date(runResult.finishedAt).getTime() : Date.now();

  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    return "--";
  }

  return formatDurationMs(finishedAt - startedAt);
}

export function getWorkflowRunSummaryText(runResult) {
  const steps = runResult?.steps ?? [];

  if (!steps.length) {
    return "等待开始执行";
  }

  const cancelledStep = steps.find((step) => step.status === "cancelled");

  if (runResult?.status === "cancelled" || cancelledStep) {
    return cancelledStep ? `已中断 ${cancelledStep.name || "未命名步骤"}` : "执行已中断";
  }

  const failedStep = steps.find((step) => step.status === "failed");

  if (failedStep) {
    return `停在 ${failedStep.name || "未命名步骤"}`;
  }

  if (runResult?.status === "success") {
    return "全部请求已完成";
  }

  const runningStep = steps.find((step) => step.status === "running");

  if (runningStep) {
    return `正在执行 ${runningStep.name || "未命名步骤"}`;
  }

  const pendingCount = steps.filter((step) => step.status === "pending").length;
  return pendingCount ? `${pendingCount} 个步骤等待执行` : "正在汇总执行结果";
}

export function getWorkflowStepProgressPercent(stepResult) {
  if (stepResult?.status === "success" || stepResult?.status === "failed" || stepResult?.status === "cancelled") {
    return 100;
  }

  if (stepResult?.status === "pending") {
    return 0;
  }

  const maxAttempts = Math.max(1, Number(stepResult?.maxAttempts ?? 1));
  const attempt = Math.max(0, Number(stepResult?.attempt ?? 0));
  return Math.max(8, Math.min(92, Math.round((attempt / maxAttempts) * 100)));
}

export function getWorkflowStepOutput(stepResult) {
  const stdout = String(stepResult?.stdout ?? "").trim();
  const stderr = String(stepResult?.stderr ?? "").trim();
  const output = [stdout, stderr ? `stderr:\n${stderr}` : ""].filter(Boolean).join("\n\n");

  if (output) {
    return output;
  }

  return stepResult?.status === "pending" ? "等待执行..." : "暂无输出";
}

export function getWorkflowResponseBodyFromOutput(stdout) {
  const normalized = String(stdout ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (!/^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(normalized)) {
    return normalized;
  }

  const parts = normalized.split(/\r?\n\r?\n/).filter(Boolean);
  return parts.at(-1)?.trim() ?? normalized;
}

export function parseWorkflowOutputJson(stdout) {
  const body = getWorkflowResponseBodyFromOutput(stdout);

  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    const objectStart = body.indexOf("{");
    const objectEnd = body.lastIndexOf("}");
    const arrayStart = body.indexOf("[");
    const arrayEnd = body.lastIndexOf("]");
    const objectCandidate = objectStart >= 0 && objectEnd > objectStart ? body.slice(objectStart, objectEnd + 1) : "";
    const arrayCandidate = arrayStart >= 0 && arrayEnd > arrayStart ? body.slice(arrayStart, arrayEnd + 1) : "";
    const candidate =
      objectCandidate && arrayCandidate
        ? objectStart < arrayStart
          ? objectCandidate
          : arrayCandidate
        : objectCandidate || arrayCandidate;

    if (!candidate) {
      return null;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

export function formatWorkflowVisualValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function collectWorkflowVisualRows(value, prefix = "response", rows = [], depth = 0) {
  if (rows.length >= 8) {
    return rows;
  }

  if (value === null || value === undefined || typeof value !== "object") {
    rows.push({ label: prefix, value: formatWorkflowVisualValue(value) });
    return rows;
  }

  if (Array.isArray(value)) {
    rows.push({ label: prefix, value: `Array(${value.length})` });
    value.slice(0, 3).forEach((entry, index) => collectWorkflowVisualRows(entry, `${prefix}.${index}`, rows, depth + 1));
    return rows;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    if (rows.length >= 8) {
      break;
    }

    const label = prefix === "response" ? key : `${prefix}.${key}`;
    const shouldDive = entryValue && typeof entryValue === "object" && depth < 2;

    if (shouldDive) {
      collectWorkflowVisualRows(entryValue, label, rows, depth + 1);
      continue;
    }

    rows.push({ label, value: formatWorkflowVisualValue(entryValue) });
  }

  return rows;
}

export function getWorkflowStepVisualRows(stepResult) {
  const parsedJson = parseWorkflowOutputJson(stepResult?.stdout);

  if (parsedJson) {
    return collectWorkflowVisualRows(parsedJson).filter((row) => String(row.value ?? "").trim()).slice(0, 8);
  }

  const output = getWorkflowStepOutput(stepResult);

  if (!output || output === "等待执行..." || output === "暂无输出") {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((line, index) => ({ label: index === 0 ? "输出" : `输出 ${index + 1}`, value: line }));
}

export function getWorkflowCardCountLabel(entry) {
  if (entry?.kind === "info-radar") {
    const windows = entry?.infoWindows ?? [];
    const itemCount = windows.reduce((sum, infoWindow) => sum + (infoWindow?.items?.length ?? 0), 0);
    return `${windows.length} 个窗口 · ${itemCount} 条信息`;
  }

  return `${entry?.records?.length ?? 0} 条记录`;
}

export function getInfoRadarSourceKindLabel(kind) {
  if (kind === "rss") {
    return "RSS";
  }

  if (kind === "web_page") {
    return "网页";
  }

  if (kind === "search") {
    return "搜索";
  }

  if (kind === "wechat") {
    return "公众号";
  }

  if (kind === "manual") {
    return "手工";
  }

  return "来源";
}

export function getInfoRadarCadenceLabel(cadence) {
  if (cadence === "hourly") {
    return "每小时";
  }

  if (cadence === "daily") {
    return "每日";
  }

  if (cadence === "weekly") {
    return "每周";
  }

  return "手动";
}

export function getInfoRadarRunStatusLabel(status) {
  if (status === "success") {
    return "成功";
  }

  if (status === "partial") {
    return "部分完成";
  }

  return "失败";
}

export function getInfoRadarRunStatusTone(status) {
  if (status === "success") {
    return "is-success";
  }

  if (status === "partial") {
    return "is-warning";
  }

  return "is-danger";
}

export function getInfoRadarItemStatusLabel(status) {
  if (status === "saved") {
    return "已收藏";
  }

  if (status === "ignored") {
    return "已忽略";
  }

  return "新信息";
}

export function buildInfoRadarWindowFromDraft(draft, existingWindow = null, options = {}) {
  const createLocalId = resolveCreateLocalId(options);
  const now = new Date().toISOString();
  const parseList = (value) => parseDelimitedValues(value);
  const title = String(draft?.title ?? "").trim() || "未命名信息窗口";

  return {
    id: existingWindow?.id ?? createLocalId("info_window"),
    title,
    summary: String(draft?.summary ?? "").trim(),
    category: String(draft?.category ?? "").trim() || "综合",
    status: draft?.status === "paused" ? "paused" : "active",
    cadence: ["hourly", "daily", "weekly"].includes(draft?.cadence) ? draft.cadence : "manual",
    keywords: parseList(draft?.keywordsText),
    negativeKeywords: parseList(draft?.negativeKeywordsText),
    sources: (draft?.sources ?? [])
      .map((source) => {
        const kind = ["rss", "web_page", "search", "wechat", "manual"].includes(source?.kind) ? source.kind : "web_page";
        const titleText = String(source?.title ?? "").trim();
        const url = String(source?.url ?? "").trim();
        const query = String(source?.query ?? "").trim();

        if (!titleText && !url && !query) {
          return null;
        }

        return {
          id: source?.id && !String(source.id).includes("_draft") ? source.id : createLocalId("info_source"),
          kind,
          title: titleText || query || url || "未命名来源",
          url,
          query,
          enabled: source?.enabled !== false,
          tags: parseList(source?.tagsText),
          notes: String(source?.notes ?? "").trim(),
          updatedAt: now
        };
      })
      .filter(Boolean),
    digestPrompt: String(draft?.digestPrompt ?? "").trim(),
    items: existingWindow?.items ?? [],
    runHistory: existingWindow?.runHistory ?? [],
    createdAt: existingWindow?.createdAt ?? now,
    updatedAt: now,
    ...(existingWindow?.lastRefreshedAt ? { lastRefreshedAt: existingWindow.lastRefreshedAt } : {})
  };
}

export function getInfoRadarItemHref(item) {
  const url = String(item?.url ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

export function getInfoRadarValueText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => getInfoRadarValueText(entry))
      .filter(Boolean)
      .join("；")
      .trim();
  }

  if (typeof value === "object") {
    const preferredKeys = ["summary", "text", "content", "description", "abstract", "message", "title"];

    for (const key of preferredKeys) {
      const text = getInfoRadarValueText(value[key]);

      if (text) {
        return text;
      }
    }

    return Object.values(value)
      .map((entry) => getInfoRadarValueText(entry))
      .filter(Boolean)
      .slice(0, 3)
      .join("；")
      .trim();
  }

  return "";
}

export function getInfoRadarItemSummaryText(item) {
  return getInfoRadarValueText(item?.summary);
}

export function getInfoRadarScorePercent(item) {
  const score = Number(item?.score ?? 0);
  return Math.max(8, Math.min(100, Math.round((Number.isFinite(score) ? score : 0) * 3.2)));
}

export function getInfoRadarSourceTone(kind) {
  if (kind === "rss") {
    return "is-rss";
  }

  if (kind === "web_page") {
    return "is-web";
  }

  if (kind === "search") {
    return "is-search";
  }

  if (kind === "wechat") {
    return "is-wechat";
  }

  return "is-manual";
}

export function parseNumberInput(value, fallback) {
  const numeric = Number(String(value ?? "").trim());
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function parseDelimitedValues(value) {
  return String(value ?? "")
    .split(/[,，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function tokenizeWorkflowCurlCommand(command) {
  const source = String(command ?? "");
  const tokens = [];
  let current = "";
  let tokenStart = -1;
  let quote = null;
  let escaping = false;

  const ensureTokenStart = (index) => {
    if (tokenStart < 0) {
      tokenStart = index;
    }
  };
  const pushToken = (end) => {
    if (tokenStart < 0) {
      return;
    }

    tokens.push({
      value: current,
      start: tokenStart,
      end
    });
    current = "";
    tokenStart = -1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1] ?? "";

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      if (!quote && (nextChar === "\n" || nextChar === "\r")) {
        pushToken(index);

        if (nextChar === "\r" && source[index + 2] === "\n") {
          index += 2;
        } else {
          index += 1;
        }

        continue;
      }

      ensureTokenStart(index);
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }

      continue;
    }

    if (char === "'" || char === "\"") {
      ensureTokenStart(index);
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushToken(index);
      continue;
    }

    ensureTokenStart(index);
    current += char;
  }

  pushToken(source.length);
  return tokens.filter((token) => token.value || token.start < token.end);
}

export function splitWorkflowCurlOptionValue(tokenValue) {
  const equalIndex = String(tokenValue ?? "").indexOf("=");

  if (equalIndex <= 0) {
    return null;
  }

  const option = tokenValue.slice(0, equalIndex);

  if (!WORKFLOW_CURL_BODY_OPTIONS.has(option)) {
    return null;
  }

  return {
    option,
    value: tokenValue.slice(equalIndex + 1)
  };
}

export function findWorkflowCurlBodySegment(curl) {
  const tokens = tokenizeWorkflowCurlCommand(curl);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const inlineOption = splitWorkflowCurlOptionValue(token.value);

    if (inlineOption) {
      return {
        option: inlineOption.option,
        value: inlineOption.value,
        replaceStart: token.start,
        replaceEnd: token.end,
        inline: true
      };
    }

    if (!WORKFLOW_CURL_BODY_OPTIONS.has(token.value)) {
      continue;
    }

    const bodyToken = tokens[index + 1];

    if (!bodyToken) {
      return null;
    }

    return {
      option: token.value,
      value: bodyToken.value,
      replaceStart: bodyToken.start,
      replaceEnd: bodyToken.end,
      inline: false
    };
  }

  return null;
}

export function quoteWorkflowCurlBody(value) {
  return `'${String(value ?? "").replace(/'/g, "'\\''")}'`;
}

export function replaceWorkflowCurlBody(curl, bodyText) {
  const source = String(curl ?? "");
  const bodySegment = findWorkflowCurlBodySegment(source);

  if (!bodySegment) {
    return source;
  }

  const replacement = bodySegment.inline
    ? `${bodySegment.option}=${quoteWorkflowCurlBody(bodyText)}`
    : quoteWorkflowCurlBody(bodyText);

  return `${source.slice(0, bodySegment.replaceStart)}${replacement}${source.slice(bodySegment.replaceEnd)}`;
}

export function normalizeWorkflowBodyDraftForCompare(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

export function extractWorkflowBodyCandidate(value) {
  const raw = String(value ?? "").trim();
  const extracted = findWorkflowCurlBodySegment(raw);

  return extracted?.value ?? raw;
}

export function stripWorkflowBodyShellWrapper(value) {
  let nextValue = String(value ?? "")
    .trim()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");

  while (nextValue.length > 1) {
    const firstChar = nextValue[0];
    const lastChar = nextValue.at(-1);

    if ((firstChar === "'" || firstChar === "\"") && lastChar === firstChar) {
      nextValue = nextValue.slice(1, -1).trim();
      continue;
    }

    if ((nextValue.startsWith("{") || nextValue.startsWith("[")) && (lastChar === "'" || lastChar === "\"")) {
      nextValue = nextValue.slice(0, -1).trim();
      continue;
    }

    if ((firstChar === "'" || firstChar === "\"") && (nextValue.endsWith("}") || nextValue.endsWith("]"))) {
      nextValue = nextValue.slice(1).trim();
      continue;
    }

    break;
  }

  return nextValue.replace(/;\s*$/, "").trim();
}

export function removeWorkflowJsonTrailingCommas(value) {
  let nextValue = String(value ?? "");
  let previousValue = "";

  while (nextValue !== previousValue) {
    previousValue = nextValue;
    nextValue = nextValue.replace(/,\s*([}\]])/g, "$1");
  }

  return nextValue;
}

export function quoteWorkflowJsonLooseKeys(value) {
  return String(value ?? "").replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)(\s*:)/g, '$1"$2"$3');
}

export function normalizeWorkflowJsonSingleQuotedStrings(value) {
  return String(value ?? "").replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, innerValue) => {
    const normalized = String(innerValue ?? "")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, "\"");

    return JSON.stringify(normalized);
  });
}

export function looksLikeWorkflowJsonBody(value) {
  const normalized = String(value ?? "").trim();
  return normalized.startsWith("{") || normalized.startsWith("[");
}

export function repairWorkflowBodyText(value, { pretty = true } = {}) {
  const stripped = stripWorkflowBodyShellWrapper(extractWorkflowBodyCandidate(value));
  const withoutTrailingCommas = removeWorkflowJsonTrailingCommas(stripped);
  const withLooseKeys = quoteWorkflowJsonLooseKeys(withoutTrailingCommas);
  const candidates = Array.from(
    new Set([
      stripped,
      withoutTrailingCommas,
      withLooseKeys,
      normalizeWorkflowJsonSingleQuotedStrings(withoutTrailingCommas),
      normalizeWorkflowJsonSingleQuotedStrings(withLooseKeys)
    ])
  );

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = JSON.parse(candidate);

      return {
        ok: true,
        text: pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed),
        parsed
      };
    } catch {
      // Keep trying the next low-risk repair candidate.
    }
  }

  return {
    ok: false,
    text: stripped,
    error: looksLikeWorkflowJsonBody(stripped) ? "JSON 结构仍不完整，请检查引号、括号或逗号。" : "当前内容不像 JSON，将按原始文本处理。"
  };
}

export function extractCurlMethod(curl) {
  const explicitMethod = String(curl ?? "").match(/(?:--request|-X)\s+['"]?([A-Z]+)['"]?/i)?.[1];

  if (explicitMethod) {
    return explicitMethod.toUpperCase();
  }

  return /(?:--data(?:-raw|-binary|-urlencode)?|--json)\b|-d(?:\s|=|$)/i.test(curl) ? "POST" : "GET";
}

export function extractCurlUrl(curl) {
  const literalUrlMatch = String(curl ?? "").match(/(?:^|\s)(['"]?)(https?:\/\/[^'"\s\\]+)\1/i);

  if (literalUrlMatch?.[2]) {
    return literalUrlMatch[2];
  }

  const baseUrlPlaceholderMatch = String(curl ?? "").match(
    /(?:^|\s)(['"]?)(\$BASE_URL[^'"\s\\]*|\$\{BASE_URL\}[^'"\s\\]*|\{\{\s*BASE_URL\s*\}\}[^'"\s\\]*)\1/i
  );

  return baseUrlPlaceholderMatch?.[2] ?? "";
}

export function extractCurlPlaceholders(curl) {
  const dollarPlaceholders = Array.from(String(curl ?? "").matchAll(/\$\{([A-Za-z0-9_]+)\}/g)).map((match) => match[1]);
  const bareDollarPlaceholders = Array.from(String(curl ?? "").matchAll(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g)).map(
    (match) => match[1]
  );
  const doubleBracePlaceholders = Array.from(String(curl ?? "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map(
    (match) => match[1]
  );
  return Array.from(new Set([...dollarPlaceholders, ...bareDollarPlaceholders, ...doubleBracePlaceholders]));
}

export function extractCurlBearerToken(curl) {
  const token = String(curl ?? "").match(/Authorization:\s*Bearer\s+([^'"\s\\]+)/i)?.[1] ?? "";
  return token.includes("API_KEY") ? "" : token;
}

export function normalizeCurlApiKeyPlaceholder(curl) {
  return String(curl ?? "").replace(/(Authorization:\s*Bearer\s+)([^'"\s\\]+)/gi, (match, prefix, token) =>
    String(token).includes("API_KEY") ? match : `${prefix}$API_KEY`
  );
}

export function extractCurlLiteralOrigin(curl) {
  const url = extractCurlUrl(curl);

  if (!url || !/^https?:\/\//i.test(url)) {
    return "";
  }

  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function replaceCurlPrimaryOriginWithBasePlaceholder(curl, sourceOrigin) {
  const normalizedOrigin = String(sourceOrigin ?? "").replace(/\/+$/, "");
  const url = extractCurlUrl(curl);

  if (!normalizedOrigin || !url.startsWith(normalizedOrigin)) {
    return curl;
  }

  return String(curl ?? "").replace(url, url.replace(normalizedOrigin, "$BASE_URL"));
}

export function extractFirstWorkflowBaseUrlFromSteps(steps) {
  return (
    (steps ?? [])
      .map((step) => extractCurlLiteralOrigin(step?.curl ?? step))
      .find(Boolean) ?? ""
  );
}

export function normalizeWorkflowEnvironments(recordOrEnvironments, seedBaseUrl = "", seedApiKey = "") {
  const configured = Array.isArray(recordOrEnvironments)
    ? recordOrEnvironments
    : Array.isArray(recordOrEnvironments?.environments)
      ? recordOrEnvironments.environments
      : [];
  const legacyApiKey = !Array.isArray(recordOrEnvironments)
    ? String(recordOrEnvironments?.apiKey ?? seedApiKey ?? "").trim()
    : String(seedApiKey ?? "").trim();
  const configuredById = new Map(
    configured
      .map((environment, index) => ({
        id: String(environment?.id ?? WORKFLOW_DEFAULT_ENVIRONMENTS[index]?.id ?? `env_${index + 1}`).trim(),
        label: String(environment?.label ?? "").trim(),
        baseUrl: String(environment?.baseUrl ?? "").trim(),
        apiKey: String(environment?.apiKey ?? "").trim()
      }))
      .filter((environment) => environment.id)
      .map((environment) => [environment.id, environment])
  );
  const defaults = WORKFLOW_DEFAULT_ENVIRONMENTS.map((environment) => {
    const configuredEnvironment = configuredById.get(environment.id);

    return {
      ...environment,
      ...configuredEnvironment,
      label: configuredEnvironment?.label || environment.label,
      baseUrl: configuredEnvironment?.baseUrl || (environment.id === "prod" ? String(seedBaseUrl ?? "").trim() : ""),
      apiKey: configuredEnvironment?.apiKey || (environment.id === "prod" ? legacyApiKey : "")
    };
  });
  const custom = configured
    .map((environment, index) => ({
      id: String(environment?.id ?? `env_${index + 1}`).trim(),
      label: String(environment?.label ?? "").trim() || `ENV ${index + 1}`,
      baseUrl: String(environment?.baseUrl ?? "").trim(),
      apiKey: String(environment?.apiKey ?? "").trim()
    }))
    .filter((environment) => environment.id && !WORKFLOW_DEFAULT_ENVIRONMENTS.some((defaultEnvironment) => defaultEnvironment.id === environment.id));

  return [...defaults, ...custom];
}

export function normalizeWorkflowJsonPathInput(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  const dataPathMatch = normalized.match(/(?:^|\n)\s*data\s*:\s*([^\n]+)/i);

  if (dataPathMatch?.[1]) {
    return dataPathMatch[1].trim();
  }

  return normalized;
}

export function createWorkflowRecordDraftFromRecord(record, options = {}) {
  const createLocalId = resolveCreateLocalId(options);
  const seedBaseUrl = extractFirstWorkflowBaseUrlFromSteps(record?.steps ?? []);

  return {
    name: record?.name ?? "",
    scenario: record?.scenario ?? record?.summary ?? "",
    mode: record?.protocol?.mode ?? "single",
    tagsText: (record?.tags ?? []).join(", "),
    pollIntervalMs: String(record?.protocol?.pollIntervalMs ?? 3000),
    maxAttempts: String(record?.protocol?.maxAttempts ?? 20),
    activeEnvironmentId: record?.activeEnvironmentId ?? "prod",
    apiKey: "",
    environments: normalizeWorkflowEnvironments(record, seedBaseUrl, record?.apiKey),
    steps: (record?.steps?.length ? record.steps : [createWorkflowStepDraft({}, createLocalId)]).map((step) =>
      createWorkflowStepDraft(
        {
          id: step.id,
          name: step.name,
          curl: step.curl,
          waitBeforeMs: step.waitBeforeMs,
          executionMode: step.executionMode,
          pollIntervalMs: step.pollIntervalMs,
          maxAttempts: step.maxAttempts,
          completionPath: step.completionPath,
          successValues: step.successValues,
          failureValues: step.failureValues,
          produces: step.produces
        },
        createLocalId
      )
    ),
    notes: record?.notes ?? record?.protocol?.note ?? ""
  };
}

export function buildWorkflowRecordFromDraft(draft, existingRecord = null, options = {}) {
  const createLocalId = resolveCreateLocalId(options);
  const now = new Date().toISOString();
  const draftSteps = (Array.isArray(draft.steps) ? draft.steps : [])
    .map((step) => ({
      ...step,
      name: String(step?.name ?? "").trim(),
      curl: String(step?.curl ?? "").trim(),
      waitBeforeMs: step?.waitBeforeMs
    }))
    .filter((step) => step.curl);

  if (!String(draft.name ?? "").trim()) {
    throw new Error("请填写记录名称");
  }

  if (!draftSteps.length) {
    throw new Error("请至少添加一段 curl 请求");
  }

  const mode = ["single", "sequential", "polling"].includes(draft.mode) ? draft.mode : "single";
  const tags = String(draft.tagsText ?? "")
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const fallbackDetectedApiKey = String(draft.apiKey ?? "").trim() || draftSteps.map((step) => extractCurlBearerToken(step.curl)).find(Boolean) || "";
  const detectedBaseUrl = extractFirstWorkflowBaseUrlFromSteps(draftSteps);
  const environments = normalizeWorkflowEnvironments(draft.environments, detectedBaseUrl, fallbackDetectedApiKey);
  const activeEnvironmentId = environments.some((environment) => environment.id === draft.activeEnvironmentId)
    ? draft.activeEnvironmentId
    : environments.find((environment) => environment.id === "prod")?.id ?? environments[0]?.id ?? "prod";
  const activeEnvironmentApiKey = environments.find((environment) => environment.id === activeEnvironmentId)?.apiKey || fallbackDetectedApiKey;
  const sharedBindingsByKey = new Map();
  const priorProducerByName = new Map();

  function rememberWorkflowBinding(binding) {
    sharedBindingsByKey.set(`${binding.source}:${binding.name}`, binding);
  }

  const steps = draftSteps.map((draftStep, index) => {
    const existingStep = existingRecord?.steps?.find((step) => step.id === draftStep.id) ?? existingRecord?.steps?.[index] ?? null;
    const stepId = existingStep?.id ?? createLocalId("workflow_step");
    const executionMode = draftStep.executionMode === "polling" ? "polling" : "once";
    const pollIntervalMs = parseNumberInput(draftStep.pollIntervalMs, existingStep?.pollIntervalMs ?? 5000);
    const maxAttempts = Math.max(1, parseNumberInput(draftStep.maxAttempts, existingStep?.maxAttempts ?? 20));
    const completionPath = normalizeWorkflowJsonPathInput(draftStep.completionPath);
    const successValues = parseDelimitedValues(draftStep.successValuesText);
    const failureValues = parseDelimitedValues(draftStep.failureValuesText);
    const curlWithApiKeyPlaceholder = fallbackDetectedApiKey ? normalizeCurlApiKeyPlaceholder(draftStep.curl) : draftStep.curl;
    const curl = detectedBaseUrl ? replaceCurlPrimaryOriginWithBasePlaceholder(curlWithApiKeyPlaceholder, detectedBaseUrl) : curlWithApiKeyPlaceholder;
    const placeholders = extractCurlPlaceholders(curl);
    const consumes = placeholders.map((name) => {
      const producer = priorProducerByName.get(name);
      const binding = {
        name,
        source: producer ? "response" : "manual",
        placeholder: `$${name}`,
        summary: producer ? "来自前置步骤响应提取" : "curl 占位变量",
        required: true,
        ...(producer ? { sourceStepId: producer.sourceStepId, path: producer.path } : {})
      };

      rememberWorkflowBinding(binding);
      return binding;
    });
    const produces = (Array.isArray(draftStep.produces) ? draftStep.produces : [])
      .map((output) => ({
        name: String(output?.name ?? "").trim(),
        path: normalizeWorkflowJsonPathInput(output?.path)
      }))
      .filter((output) => output.name && output.path)
      .map((output) => ({
        name: output.name,
        source: "response",
        placeholder: `$${output.name}`,
        summary: "从响应 JSONPath 提取",
        required: true,
        sourceStepId: stepId,
        path: output.path
      }));

    produces.forEach((binding) => {
      rememberWorkflowBinding(binding);
      priorProducerByName.set(binding.name, binding);
    });

    return {
      id: stepId,
      name: draftStep.name || existingStep?.name || (draftSteps.length > 1 ? `请求 ${index + 1}` : "请求"),
      summary: existingStep?.summary ?? "",
      method: extractCurlMethod(curl),
      url: extractCurlUrl(curl),
      curl,
      waitBeforeMs: parseNumberInput(draftStep.waitBeforeMs, existingStep?.waitBeforeMs ?? 0),
      executionMode,
      pollIntervalMs: executionMode === "polling" ? pollIntervalMs : 0,
      maxAttempts: executionMode === "polling" ? maxAttempts : 1,
      completionPath: executionMode === "polling" ? completionPath : "",
      successValues: executionMode === "polling" ? successValues : [],
      failureValues: executionMode === "polling" ? failureValues : [],
      responseFieldHints: existingStep?.responseFieldHints ?? [],
      consumes,
      produces
    };
  });
  const derivedMode = steps.some((step) => step.executionMode === "polling") ? "polling" : steps.length > 1 ? "sequential" : "single";
  const derivedTimeoutMs = steps.reduce(
    (total, step) =>
      total +
      Number(step.waitBeforeMs ?? 0) +
      (step.executionMode === "polling"
        ? Number(step.pollIntervalMs ?? 0) * Math.max(1, Number(step.maxAttempts ?? 1))
        : 120_000),
    0
  );
  const firstPollingStep = steps.find((step) => step.executionMode === "polling");

  return {
    id: existingRecord?.id ?? createLocalId("workflow_record"),
    name: String(draft.name ?? "").trim(),
    summary: String(draft.scenario ?? "").trim() || "curl 接口测试流程",
    scenario: String(draft.scenario ?? "").trim() || "curl 接口测试",
    tags,
    updatedAt: now,
    notes: String(draft.notes ?? "").trim(),
    activeEnvironmentId,
    environments,
    apiKey: activeEnvironmentApiKey,
    sharedVariables: Array.from(sharedBindingsByKey.values()),
    steps,
    protocol: {
      mode: derivedMode || mode,
      initialWaitMs: 0,
      pollIntervalMs: firstPollingStep?.pollIntervalMs ?? 0,
      maxAttempts: firstPollingStep?.maxAttempts ?? 1,
      timeoutMs: derivedTimeoutMs,
      statusStepId: firstPollingStep?.id,
      resultStepId: steps.at(-1)?.id,
      completionPath: firstPollingStep?.completionPath ?? "",
      successValues: firstPollingStep?.successValues ?? [],
      resultPath: "",
      note: String(draft.notes ?? "").trim()
    }
  };
}

export function getWorkflowRuntimeMissingFields(record) {
  const curlText = (record?.steps ?? []).map((step) => step.curl ?? "").join("\n");
  const environments = normalizeWorkflowEnvironments(record);
  const activeEnvironment =
    environments.find((environment) => environment.id === record?.activeEnvironmentId) ??
    environments.find((environment) => environment.id === "prod") ??
    environments[0] ??
    null;
  const missing = [];

  if (/\$BASE_URL\b|\$\{BASE_URL\}|\{\{\s*BASE_URL\s*\}\}/.test(curlText) && !String(activeEnvironment?.baseUrl ?? "").trim()) {
    missing.push("当前环境的 Base URL");
  }

  if (
    /\$API_KEY\b|\$\{API_KEY\}|\{\{\s*API_KEY\s*\}\}/.test(curlText) &&
    !String(activeEnvironment?.apiKey ?? record?.apiKey ?? "").trim()
  ) {
    missing.push("当前环境的 APIKEY");
  }

  return missing;
}

export function buildWorkflowInitialRunResult(record, progressEventId) {
  const startedAt = new Date().toISOString();

  return {
    progressEventId,
    status: "running",
    startedAt,
    variables: {},
    steps: (record?.steps ?? []).map((step) => {
      const mode = step?.executionMode === "polling" ? "polling" : "once";

      return {
        stepId: step?.id ?? "",
        name: step?.name ?? "",
        mode,
        status: "pending",
        exitCode: null,
        stdout: "",
        stderr: "",
        attempt: 0,
        maxAttempts: mode === "polling" ? Math.max(1, Number(step?.maxAttempts ?? 1)) : 1,
        attempts: []
      };
    })
  };
}
