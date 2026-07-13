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

  if (entry?.kind === "finance-brief") {
    const symbols = entry?.financeBrief?.symbols ?? [];
    const snapshot = entry?.financeBrief?.lastSnapshot;
    return `${symbols.length} 个标的${snapshot ? ` · ${snapshot.quote?.symbol ?? ""}` : ""}`;
  }

  if (entry?.kind === "live-stream") {
    const sources = entry?.liveStream?.sources ?? [];
    const activeSources = sources.filter((source) => source?.status !== "paused");
    return `${sources.length} 个直播间${activeSources.length !== sources.length ? ` · ${activeSources.length} 个启用` : ""}`;
  }

  return `${entry?.records?.length ?? 0} 条记录`;
}

export function getLiveStreamPlatformLabel(platform) {
  if (platform === "bilibili") {
    return "Bilibili";
  }

  if (platform === "xiaohongshu") {
    return "小红书";
  }

  return "自定义";
}

export function getLiveStreamSourceLabel(source) {
  const title = String(source?.title ?? "").trim();
  const platform = getLiveStreamPlatformLabel(source?.platform);
  const roomId = String(source?.roomId ?? "").trim();

  return title || (roomId ? `${platform} ${roomId}` : platform);
}

export function normalizeLiveStreamUrl(input, platform = "custom") {
  const rawValue = String(input ?? "").trim();

  if (!rawValue) {
    return "";
  }

  if (platform === "bilibili" && /^\d+$/.test(rawValue)) {
    return `https://live.bilibili.com/blanc/${rawValue}`;
  }

  if (platform === "bilibili") {
    const roomMatch = rawValue.match(/live\.bilibili\.com\/(?:blanc\/)?(\d+)/i);

    if (roomMatch?.[1]) {
      return `https://live.bilibili.com/blanc/${roomMatch[1]}`;
    }
  }

  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  return "";
}

export function getLiveStreamInputPlaceholder(platform) {
  if (platform === "bilibili") {
    return "输入 Bilibili 房间号或直播间 URL";
  }

  if (platform === "xiaohongshu") {
    return "粘贴小红书比赛直播页 URL";
  }

  return "粘贴 http/https 直播页 URL";
}

export function formatFinanceBriefNumber(value, options = {}) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2
  }).format(numberValue);
}

export function formatFinanceBriefSignedNumber(value, options = {}) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  const formatted = formatFinanceBriefNumber(Math.abs(numberValue), options);
  return `${numberValue > 0 ? "+" : numberValue < 0 ? "-" : ""}${formatted}`;
}

export function formatFinanceBriefPercent(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${formatFinanceBriefSignedNumber(numberValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatFinanceBriefCompactNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(numberValue);
}

export function getFinanceBriefChangeTone(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue === 0) {
    return "";
  }

  return numberValue > 0 ? "is-up" : "is-down";
}

export function getFinanceBriefRangeLabel(range) {
  if (range === "1d") return "1日";
  if (range === "5d") return "5日";
  if (range === "3mo") return "3月";
  if (range === "6mo") return "6月";
  if (range === "1y") return "1年";
  if (range === "ytd") return "年初至今";
  if (range === "2y") return "2年";
  if (range === "5y") return "5年";
  return "1月";
}

export function getFinanceBriefIntervalLabel(interval) {
  if (interval === "1m") return "1分钟";
  if (interval === "5m") return "5分钟";
  if (interval === "15m") return "15分钟";
  if (interval === "30m") return "30分钟";
  if (interval === "60m") return "小时线";
  if (interval === "1wk") return "周线";
  if (interval === "1mo") return "月线";
  return "日线";
}

export function getFinanceBriefSymbolLabel(symbol) {
  const name = String(symbol?.displayName ?? "").trim();
  const code = String(symbol?.symbol ?? "").trim();
  return name && code && name !== code ? `${name} · ${code}` : name || code || "未命名标的";
}

function parseFinanceBriefChartNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeFinanceBriefChartPoint(point) {
  const time = String(point?.time ?? "").trim();
  const timeValue = new Date(time).getTime();
  const open = parseFinanceBriefChartNumber(point?.open);
  const high = parseFinanceBriefChartNumber(point?.high);
  const low = parseFinanceBriefChartNumber(point?.low);
  const close = parseFinanceBriefChartNumber(point?.close);
  const volume = parseFinanceBriefChartNumber(point?.volume);

  if (
    !time ||
    !Number.isFinite(timeValue) ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    high < low ||
    high < Math.max(open, close) ||
    low > Math.min(open, close)
  ) {
    return null;
  }

  return {
    ...point,
    time,
    open,
    high,
    low,
    close,
    ...(volume !== null ? { volume } : {})
  };
}

function getFinanceBriefChartPointLimit(snapshot) {
  const interval = String(snapshot?.interval ?? "");

  if (["1m", "5m", "15m", "30m", "60m"].includes(interval)) {
    return 10_000;
  }

  return 5_000;
}

function sampleFinanceBriefChartPoints(points, limit) {
  if (!Number.isFinite(limit) || limit <= 0 || points.length <= limit) {
    return points;
  }

  const lastIndex = points.length - 1;
  const seenIndexes = new Set();

  return Array.from({ length: limit }, (_, index) => {
    const sourceIndex = Math.round((index / (limit - 1)) * lastIndex);

    if (seenIndexes.has(sourceIndex)) {
      return null;
    }

    seenIndexes.add(sourceIndex);
    return points[sourceIndex] ?? null;
  }).filter(Boolean);
}

function getFinanceBriefSortedChartPoints(snapshot) {
  const points = snapshot?.quote?.points ?? [];

  return points
    .map(normalizeFinanceBriefChartPoint)
    .filter(Boolean)
    .slice()
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
}

export function getFinanceBriefChartRows(snapshot) {
  const normalizedPoints = getFinanceBriefSortedChartPoints(snapshot);
  const visiblePoints = sampleFinanceBriefChartPoints(normalizedPoints, getFinanceBriefChartPointLimit(snapshot));

  if (!visiblePoints.length) {
    return [];
  }

  const lows = visiblePoints.map((point) => Number(point.low)).filter(Number.isFinite);
  const highs = visiblePoints.map((point) => Number(point.high)).filter(Number.isFinite);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = Math.max(0.000001, max - min);
  const toTop = (value) => `${Math.max(2, Math.min(98, ((max - value) / span) * 100))}%`;
  const toHeight = (high, low) => `${Math.max(4, ((high - low) / span) * 100)}%`;

  return visiblePoints.map((point) => {
    const open = Number(point.open);
    const close = Number(point.close);
    const high = Number(point.high);
    const low = Number(point.low);
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const bodyHeight = Math.max(2.5, ((bodyTop - bodyBottom) / span) * 100);

    return {
      ...point,
      tone: close >= open ? "is-up" : "is-down",
      wickTop: toTop(high),
      wickHeight: toHeight(high, low),
      bodyTop: toTop(bodyTop),
      bodyHeight: `${bodyHeight}%`
    };
  });
}

export function getFinanceBriefChartBounds(snapshot) {
  const rows = getFinanceBriefChartRows(snapshot);

  if (!rows.length) {
    return { high: "--", low: "--", count: 0 };
  }

  const high = Math.max(...rows.map((point) => Number(point.high)).filter(Number.isFinite));
  const low = Math.min(...rows.map((point) => Number(point.low)).filter(Number.isFinite));

  return {
    high: formatFinanceBriefNumber(high),
    low: formatFinanceBriefNumber(low),
    count: rows.length
  };
}

const FINANCE_BRIEF_INTRADAY_INTERVALS = new Set(["1m", "5m", "15m", "30m", "60m"]);
const FINANCE_BRIEF_LONG_RANGES = new Set(["1y", "ytd", "2y", "5y"]);
const FINANCE_BRIEF_MINUTE_MS = 60 * 1000;
const FINANCE_BRIEF_HOUR_MS = 60 * FINANCE_BRIEF_MINUTE_MS;

function isFinanceBriefIntradayInterval(interval) {
  return FINANCE_BRIEF_INTRADAY_INTERVALS.has(interval);
}

function getFinanceBriefSnapshotTimeZone(snapshot) {
  const timeZone = String(snapshot?.quote?.exchangeTimezoneName ?? "").trim();

  if (!timeZone) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return undefined;
  }
}

function formatFinanceBriefDateTimePart(value, options = {}, timeZone) {
  const date = new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const formatOptions = {
    ...options,
    ...(timeZone ? { timeZone } : {})
  };

  try {
    return new Intl.DateTimeFormat("zh-CN", formatOptions).format(date);
  } catch {
    return new Intl.DateTimeFormat("zh-CN", options).format(date);
  }
}

function getFinanceBriefAxisDateKey(value, timeZone) {
  return formatFinanceBriefDateTimePart(
    value,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    },
    timeZone
  );
}

function getFinanceBriefChartTimeTickCount(rows, snapshot) {
  const interval = String(snapshot?.interval ?? "");
  const range = String(snapshot?.range ?? "");

  if (rows.length <= 2) {
    return rows.length;
  }

  if (isFinanceBriefIntradayInterval(interval)) {
    return Math.min(rows.length, range === "1d" ? 6 : 6);
  }

  if (interval === "1mo" || range === "5y") {
    return Math.min(rows.length, 6);
  }

  return Math.min(rows.length, 5);
}

function getFinanceBriefChartTimeTickPoints(rows, tickCount) {
  if (!rows.length || tickCount <= 0) {
    return [];
  }

  if (tickCount === 1 || rows.length === 1) {
    return [{ point: rows[0], position: 0 }];
  }

  const lastIndex = rows.length - 1;
  const seenIndexes = new Set();

  return Array.from({ length: tickCount }, (_, index) => {
    const sourceIndex = Math.round((index / (tickCount - 1)) * lastIndex);

    if (seenIndexes.has(sourceIndex)) {
      return null;
    }

    seenIndexes.add(sourceIndex);
    return {
      point: rows[sourceIndex],
      position: (sourceIndex / lastIndex) * 100
    };
  }).filter(Boolean);
}

function getFinanceBriefTimeClockParts(value, timeZone) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const options = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {})
  };

  try {
    const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    const second = Number(parts.find((part) => part.type === "second")?.value);

    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
      return null;
    }

    return {
      hour: ((hour % 24) + 24) % 24,
      minute,
      second
    };
  } catch {
    return null;
  }
}

function getFinanceBriefIntradayTickStepHours(startTime, endTime, range) {
  const durationHours = Math.max(1, (endTime - startTime) / FINANCE_BRIEF_HOUR_MS);
  const maxTickCount = range === "1d" ? 9 : 8;

  for (const stepHours of [1, 2, 3, 4, 6, 12, 24]) {
    if (Math.floor(durationHours / stepHours) + 1 <= maxTickCount) {
      return stepHours;
    }
  }

  return 24;
}

function findFinanceBriefFirstWholeHourTick(startTime, endTime, stepHours, timeZone) {
  const firstCandidate = Math.ceil(startTime / FINANCE_BRIEF_MINUTE_MS) * FINANCE_BRIEF_MINUTE_MS;
  const searchLimit = Math.min(endTime, startTime + Math.max(stepHours + 2, 4) * FINANCE_BRIEF_HOUR_MS);

  for (let candidate = firstCandidate; candidate <= searchLimit; candidate += FINANCE_BRIEF_MINUTE_MS) {
    const clock = getFinanceBriefTimeClockParts(candidate, timeZone);

    if (clock?.minute === 0 && clock.second === 0 && clock.hour % stepHours === 0) {
      return candidate;
    }
  }

  return null;
}

function getFinanceBriefNiceIntradayTimeTickEntries(rows, snapshot) {
  const interval = String(snapshot?.interval ?? "");

  if (!isFinanceBriefIntradayInterval(interval) || rows.length <= 1) {
    return [];
  }

  const startTime = new Date(rows[0]?.time ?? "").getTime();
  const endTime = new Date(rows[rows.length - 1]?.time ?? "").getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return [];
  }

  const range = String(snapshot?.range ?? "");
  const timeZone = getFinanceBriefSnapshotTimeZone(snapshot);
  const stepHours = getFinanceBriefIntradayTickStepHours(startTime, endTime, range);
  const firstTick = findFinanceBriefFirstWholeHourTick(startTime, endTime, stepHours, timeZone);

  if (firstTick === null) {
    return [];
  }

  const ticks = [];

  for (let tickTime = firstTick; tickTime <= endTime + 30_000 && ticks.length < 16; tickTime += stepHours * FINANCE_BRIEF_HOUR_MS) {
    const position = ((tickTime - startTime) / (endTime - startTime)) * 100;

    if (position >= 0 && position <= 100) {
      ticks.push({
        time: new Date(tickTime).toISOString(),
        position
      });
    }
  }

  return ticks.length >= 1 ? ticks : [];
}

function getFinanceBriefChartTimeTickEntries(rows, snapshot) {
  const niceTicks = getFinanceBriefNiceIntradayTimeTickEntries(rows, snapshot);

  if (niceTicks.length) {
    return niceTicks;
  }

  return getFinanceBriefChartTimeTickPoints(rows, getFinanceBriefChartTimeTickCount(rows, snapshot))
    .map((entry) => ({
      time: entry.point.time,
      position: entry.position
    }));
}

function formatFinanceBriefAxisPrimaryTime(value, options = {}) {
  const interval = String(options.interval ?? "");
  const range = String(options.range ?? "");
  const timeZone = options.timeZone;
  const isIntraday = isFinanceBriefIntradayInterval(interval);

  if (isIntraday) {
    return formatFinanceBriefDateTimePart(
      value,
      {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      },
      timeZone
    );
  }

  if (interval === "1mo" || FINANCE_BRIEF_LONG_RANGES.has(range)) {
    return formatFinanceBriefDateTimePart(
      value,
      {
        year: "numeric",
        month: "2-digit"
      },
      timeZone
    );
  }

  return formatFinanceBriefDateTimePart(
    value,
    {
      month: "2-digit",
      day: "2-digit"
    },
    timeZone
  );
}

function formatFinanceBriefAxisSecondaryTime(value, options = {}) {
  const interval = String(options.interval ?? "");
  const range = String(options.range ?? "");
  const timeZone = options.timeZone;

  if (isFinanceBriefIntradayInterval(interval)) {
    return formatFinanceBriefDateTimePart(
      value,
      {
        month: "2-digit",
        day: "2-digit"
      },
      timeZone
    );
  }

  if (interval === "1mo" || FINANCE_BRIEF_LONG_RANGES.has(range)) {
    return "";
  }

  return formatFinanceBriefDateTimePart(
    value,
    {
      weekday: "short"
    },
    timeZone
  );
}

function formatFinanceBriefShortDateTime(value, snapshot = null) {
  return formatFinanceBriefDateTimePart(
    value,
    {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    },
    getFinanceBriefSnapshotTimeZone(snapshot)
  );
}

export function formatFinanceBriefQuoteDateTime(value, snapshot = null) {
  return formatFinanceBriefDateTimePart(
    value,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    },
    getFinanceBriefSnapshotTimeZone(snapshot)
  );
}

function formatFinanceBriefDurationLabel(startValue, endValue) {
  const startTime = new Date(startValue ?? "").getTime();
  const endTime = new Date(endValue ?? "").getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    return "覆盖 --";
  }

  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60_000));

  if (durationMinutes < 60) {
    return `覆盖 ${durationMinutes} 分钟`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours < 48) {
    return `覆盖 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `覆盖 ${days} 天${remainingHours ? ` ${remainingHours} 小时` : ""}`;
}

export function getFinanceBriefChartSummary(snapshot) {
  const points = getFinanceBriefSortedChartPoints(snapshot);

  if (!points.length) {
    return {
      rangeLabel: "暂无可视区间",
      durationLabel: "覆盖 --",
      pointLabel: "0 根 K 线",
      timeZoneLabel: "交易所时区 --"
    };
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const exchangeName = String(snapshot?.quote?.exchangeName ?? "").trim();
  const timeZoneName = String(snapshot?.quote?.timezone ?? snapshot?.quote?.exchangeTimezoneName ?? "").trim();

  return {
    rangeLabel: `${formatFinanceBriefShortDateTime(firstPoint.time, snapshot)} - ${formatFinanceBriefShortDateTime(lastPoint.time, snapshot)}`,
    durationLabel: formatFinanceBriefDurationLabel(firstPoint.time, lastPoint.time),
    pointLabel: `${points.length} 根 K 线`,
    timeZoneLabel: [exchangeName, timeZoneName].filter(Boolean).join(" · ") || "交易所时区 --"
  };
}

export function getFinanceBriefChartAxis(snapshot) {
  const rows = getFinanceBriefChartRows(snapshot);

  if (!rows.length) {
    return {
      priceTicks: [],
      timeTicks: []
    };
  }

  const highs = rows.map((point) => Number(point.high)).filter(Number.isFinite);
  const lows = rows.map((point) => Number(point.low)).filter(Number.isFinite);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const middle = (high + low) / 2;
  const interval = String(snapshot?.interval ?? "");
  const range = String(snapshot?.range ?? "");
  const timeZone = getFinanceBriefSnapshotTimeZone(snapshot);
  const tickPoints = getFinanceBriefChartTimeTickEntries(rows, snapshot);
  const seenTimes = new Set();
  const timeTicks = tickPoints
    .filter((entry) => {
      if (seenTimes.has(entry.time)) {
        return false;
      }

      seenTimes.add(entry.time);
      return true;
    })
    .map((entry, index, entries) => {
      const dateKey = getFinanceBriefAxisDateKey(entry.time, timeZone);
      const previousDateKey = index > 0 ? getFinanceBriefAxisDateKey(entries[index - 1].time, timeZone) : "";
      const isBoundary = index === 0 || index === entries.length - 1 || dateKey !== previousDateKey;

      return {
        label: formatFinanceBriefAxisPrimaryTime(entry.time, {
          interval,
          range,
          timeZone
        }),
        subLabel: formatFinanceBriefAxisSecondaryTime(entry.time, {
          interval,
          range,
          timeZone
        }),
        title: formatFinanceBriefQuoteDateTime(entry.time, snapshot),
        position: `${entry.position}%`,
        align: entry.position <= 1 ? "start" : entry.position >= 99 ? "end" : "center",
        isBoundary
      };
    });

  return {
    priceTicks: [
      { label: formatFinanceBriefNumber(high), position: "top" },
      { label: formatFinanceBriefNumber(middle), position: "middle" },
      { label: formatFinanceBriefNumber(low), position: "bottom" }
    ],
    timeTicks
  };
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

  if (kind === "github") {
    return "GitHub";
  }

  if (kind === "reddit") {
    return "Reddit";
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
        const kind = ["rss", "web_page", "search", "wechat", "github", "reddit", "manual"].includes(source?.kind) ? source.kind : "web_page";
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
          updatedAt: now,
          ...(source?.lastDiscoveredAt ? { lastDiscoveredAt: source.lastDiscoveredAt } : {})
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
  const url = String(item?.url || item?.resolvedUrl || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

export function canOpenInfoRadarItem(item) {
  if (getInfoRadarItemHref(item)) {
    return true;
  }

  return item?.sourceKind === "wechat" && Boolean(String(item?.title ?? "").trim());
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

  if (kind === "github") {
    return "is-github";
  }

  if (kind === "reddit") {
    return "is-reddit";
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
