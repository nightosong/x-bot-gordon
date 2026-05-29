import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

import { callToolOnMcpServer, listToolsFromMcpServer, runAgent } from "../../../packages/agent/src/index.js";
import { buildWorkbenchSnapshot } from "../../../packages/core/src/index.js";
import { isPromptAssetId, readPromptAsset, type PromptAssetId } from "../../../packages/workbench/src/prompt-assets.js";
import {
  deleteAgentProfile,
  deleteComicProject,
  deleteCommandWorkshopSession,
  deleteMcpServer,
  deleteMusicProject,
  deleteVideoProject,
  activateModelProfile,
  deleteModelProfile,
  deleteSkillDefinition,
  deleteWeeklyProgress,
  deleteWritingBook,
  getWeeklyFeishuSettings,
  importSkillDefinitionFromGithub,
  listAgentProfiles,
  listCommandWorkshopSessions,
  listComicProjects,
  listMusicProjects,
  listModelBalanceHistory,
  listMcpServers,
  listSkillDefinitions,
  listToolConfigs,
  listWeeklyProgress,
  listVideoProjects,
  listWritingBooks,
  listModelSettings,
  reorderModelProfiles,
  saveWeeklyFeishuSettings,
  saveWritingBook,
  saveWeeklyProgress,
  toggleAgentProfileStatus,
  toggleMcpServerStatus,
  toggleModelProfileStatus,
  toggleSkillDefinitionStatus,
  toggleToolConfigStatus,
  upsertAgentProfile,
  upsertCommandWorkshopSession,
  upsertComicProject,
  upsertMusicProject,
  upsertVideoProject,
  upsertWorkflowLibraryItem,
  upsertMcpServer,
  upsertModelProfile,
  upsertSkillDefinition,
  upsertToolConfig
} from "../../../packages/workbench/src/index.js";
import type {
  AgentRunProgressEvent,
  CommandWorkshopMessageExportFormat,
  CommandWorkshopMessageExportRequest,
  ComicProjectExportFormat,
  ComicProjectExportRequest,
  MusicProjectExportFormat,
  MusicProjectExportRequest,
  MusicProject,
  WeeklyDailyReportFeishuSendRequest,
  WeeklyDailyReportFeishuSendResult,
  WeeklyFeishuSettings,
  VideoProjectExportFormat,
  VideoProjectExportRequest,
  WritingBookExportFormat,
  WritingBookExportRequest
} from "../../../packages/shared/src/index.js";
import { ensureGordonHomeDirectory } from "../../../packages/shared/src/index.js";
import { readCommandWorkshopAttachment } from "./attachment-reader.js";
import {
  generateDailyProgressReport,
  generatePerformanceProgressReport,
  generateWeeklyProgressReport,
  invokeActiveModel,
  rewriteWeeklyProgressItem
} from "./ai.js";
import { queryModelBalance } from "./model-balance.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const desktopAssetDir = path.resolve(currentDir, "..", "assets");
const appIconFileName = process.platform === "win32" ? "gordon.ico" : "gordon.icns";
const appIconPath = path.join(desktopAssetDir, appIconFileName);
const modelTextAbortControllers = new Map<string, AbortController>();
const agentRunAbortControllers = new Map<string, AbortController>();
const MAIN_WINDOW_MIN_WIDTH = 1180;
const MAIN_WINDOW_MIN_HEIGHT = 760;
const MODEL_BALANCE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const MODEL_BALANCE_INITIAL_POLL_DELAY_MS = 60 * 1000;
let modelBalancePollingTimer: NodeJS.Timeout | null = null;
let modelBalancePollingInFlight = false;
const FEISHU_DAILY_REPORT_CONTENT_LIMIT = 15000;
const FEISHU_DAILY_REPORT_MARKDOWN_TEXT_SIZE = "normal_v2";

type GordonConfirmWindowTone = "neutral" | "warning" | "danger";

type GordonConfirmWindowOptions = {
  title: string;
  eyebrow?: string;
  message: string;
  detailLines?: string[];
  confirmText?: string;
  cancelText?: string;
  tone?: GordonConfirmWindowTone;
};

type WorkflowRuntimeEnvironment = {
  id?: string;
  label?: string;
  baseUrl?: string;
  apiKey?: string;
};

type WorkflowRuntimeVariableBinding = {
  name?: string;
  path?: string;
};

type WorkflowRuntimeStep = {
  id?: string;
  name?: string;
  curl?: string;
  waitBeforeMs?: number;
  executionMode?: "once" | "polling";
  pollIntervalMs?: number;
  maxAttempts?: number;
  completionPath?: string;
  successValues?: string[];
  failureValues?: string[];
  produces?: WorkflowRuntimeVariableBinding[];
};

type WorkflowRuntimeRecord = {
  progressEventId?: string;
  activeEnvironmentId?: string;
  environments?: WorkflowRuntimeEnvironment[];
  apiKey?: string;
  steps?: WorkflowRuntimeStep[];
};

type WorkflowRunStatus = "running" | "success" | "failed" | "cancelled";
type WorkflowStepStatus = "pending" | "running" | "success" | "failed" | "cancelled";

type WorkflowRunStepAttempt = {
  attempt: number;
  status: "running" | "success" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  completionValue?: string;
};

type WorkflowRunStepResult = {
  stepId: string;
  name: string;
  mode: "once" | "polling";
  status: WorkflowStepStatus;
  startedAt?: string;
  finishedAt?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  attempt: number;
  maxAttempts: number;
  completionValue?: string;
  attempts: WorkflowRunStepAttempt[];
};

type WorkflowRunProgressPayload = {
  progressEventId?: string;
  status: WorkflowRunStatus;
  startedAt: string;
  finishedAt?: string;
  variables: Record<string, string>;
  steps: WorkflowRunStepResult[];
};

type WorkflowRunProgressEmitter = (payload: WorkflowRunProgressPayload) => void;

type WorkflowActiveRunContext = {
  controller: AbortController;
  child: ReturnType<typeof spawn> | null;
};

const WORKFLOW_RUN_CANCELLED_MESSAGE = "执行已中断";
const activeWorkflowRuns = new Map<string, WorkflowActiveRunContext>();
const WRITING_BOOK_EXPORT_EXTENSIONS = new Set<WritingBookExportFormat>(["txt", "md"]);
const COMIC_PROJECT_EXPORT_EXTENSIONS = new Set<ComicProjectExportFormat>(["md"]);
const VIDEO_PROJECT_EXPORT_EXTENSIONS = new Set<VideoProjectExportFormat>(["md"]);
const MUSIC_PROJECT_EXPORT_EXTENSIONS = new Set<MusicProjectExportFormat>(["md"]);
const COMMAND_WORKSHOP_MESSAGE_EXPORT_EXTENSIONS = new Set<CommandWorkshopMessageExportFormat>(["pdf", "docx"]);

class WorkflowRunCancelledError extends Error {
  constructor() {
    super(WORKFLOW_RUN_CANCELLED_MESSAGE);
    this.name = "WorkflowRunCancelledError";
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function toCloneableIpcValue<T>(value: T): T {
  const visited = new WeakSet<object>();

  function normalize(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return input;
    }

    if (typeof input === "bigint" || typeof input === "symbol" || typeof input === "function") {
      return String(input);
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (input instanceof Error) {
      return {
        name: input.name,
        message: input.message,
        stack: input.stack ?? ""
      };
    }

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    if (input instanceof Map) {
      return Object.fromEntries(Array.from(input.entries()).map(([key, entryValue]) => [String(key), normalize(entryValue)]));
    }

    if (input instanceof Set) {
      return Array.from(input.values()).map((item) => normalize(item));
    }

    if (typeof input !== "object") {
      return String(input);
    }

    if (visited.has(input)) {
      return "[Circular]";
    }

    visited.add(input);

    const output: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(input)) {
      output[key] = normalize(entryValue);
    }

    return output;
  }

  return normalize(value) as T;
}

function normalizeFeishuWebhookUrl(value: string): string {
  const webhookUrl = String(value ?? "").trim();

  if (!webhookUrl) {
    throw new Error("请先设置飞书群机器人 Webhook。");
  }

  const url = new URL(webhookUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("飞书 Webhook 必须是 HTTP 或 HTTPS 地址。");
  }

  return url.toString();
}

function buildFeishuSignature(secret: string): { timestamp: string; sign: string } | null {
  const normalizedSecret = String(secret ?? "").trim();

  if (!normalizedSecret) {
    return null;
  }

  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const stringToSign = `${timestamp}\n${normalizedSecret}`;
  const sign = createHmac("sha256", stringToSign).digest("base64");

  return { timestamp, sign };
}

function truncateFeishuDailyReportContent(content: string): string {
  if (content.length <= FEISHU_DAILY_REPORT_CONTENT_LIMIT) {
    return content;
  }

  return `${content.slice(0, FEISHU_DAILY_REPORT_CONTENT_LIMIT)}\n\n... 内容较长，已自动截断后发送。`;
}

function getFeishuDailyReportListLineMeta(line: string): { depth: number; text: string } | null {
  const bulletMatch = line.match(/^([ \t]*)(?:[-*+]|\d+[.)])\s+(.+)$/);

  if (bulletMatch) {
    return {
      depth: Math.max(0, Math.round(bulletMatch[1].replace(/\t/g, "    ").length / 4)),
      text: bulletMatch[2].trim()
    };
  }

  const indentedMatch = line.match(/^([ \t]{2,})(\S.*)$/);

  if (!indentedMatch) {
    return null;
  }

  return {
    depth: Math.max(1, Math.round(indentedMatch[1].replace(/\t/g, "    ").length / 4)),
    text: indentedMatch[2].trim()
  };
}

function normalizeFeishuDailyReportMarkdown(content: string): string {
  const oddSpacePattern = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
  const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/g;
  const bulletLikePattern = /^[•●▪◦‣・·]\s+/;
  const statusSuffixPattern = /(?:（|\()(已完成|进行中|待开始|受阻)(?:）|\))\s*$/;
  const normalizedLines = String(content ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(zeroWidthPattern, "")
    .replace(oddSpacePattern, " ")
    .replace(/\t/g, "    ")
    .split("\n")
    .map((line) => line.replace(/[ ]+$/g, ""))
    .filter((line) => line.trim());
  const repairedLines: string[] = [];
  let hasProjectHeading = false;

  for (const line of normalizedLines) {
    const unescapedLine = line.replace(/^([ ]*)\\([*+-])\s+/, "$1$2 ");
    const normalizedBulletLine = bulletLikePattern.test(unescapedLine.trim())
      ? `${unescapedLine.match(/^[ ]*/)?.[0] ?? ""}- ${unescapedLine.trim().replace(bulletLikePattern, "")}`
      : unescapedLine;
    const listMeta = getFeishuDailyReportListLineMeta(normalizedBulletLine);

    if (!listMeta) {
      const text = normalizedBulletLine.trim();

      if (/^#{1,6}\s+/.test(text)) {
        repairedLines.push(text);
        hasProjectHeading = true;
        continue;
      }

      if (statusSuffixPattern.test(text) && hasProjectHeading) {
        repairedLines.push(`- ${text}`);
        continue;
      }

      if (repairedLines.length && repairedLines[repairedLines.length - 1]) {
        repairedLines.push("");
      }

      repairedLines.push(`**${text.replace(/^\*+|\*+$/g, "")}**`);
      hasProjectHeading = true;
      continue;
    }

    const text = listMeta.text.replace(/^\*+|\*+$/g, "").trim();

    if (!listMeta.depth && !statusSuffixPattern.test(text)) {
      if (repairedLines.length && repairedLines[repairedLines.length - 1]) {
        repairedLines.push("");
      }

      repairedLines.push(`**${text}**`);
      hasProjectHeading = true;
      continue;
    }

    const depth = !listMeta.depth && statusSuffixPattern.test(text) && hasProjectHeading ? 1 : Math.max(1, listMeta.depth);
    repairedLines.push(`${"  ".repeat(depth - 1)}- ${text}`);
  }

  return repairedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeFeishuDailyReportTitle(value: string): string {
  return String(value ?? "")
    .replace(/\s*日报\s*$/g, "")
    .replace(/周[一二三四五六日天]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFeishuDailyReportPayload(
  settings: WeeklyFeishuSettings,
  request: WeeklyDailyReportFeishuSendRequest
): Record<string, unknown> {
  const titlePrefix = String(settings.titlePrefix ?? "").trim();
  const titleDate = normalizeFeishuDailyReportTitle(request.title);
  const title = [titlePrefix, titleDate].filter(Boolean).join(" ") || "Gordon 日报";
  const content = truncateFeishuDailyReportContent(normalizeFeishuDailyReportMarkdown(String(request.content ?? "").trim()));
  const signature = buildFeishuSignature(settings.secret);
  const payload: Record<string, unknown> = {
    msg_type: "interactive",
    card: {
      schema: "2.0",
      config: {
        update_multi: true,
        style: {
          text_size: {
            [FEISHU_DAILY_REPORT_MARKDOWN_TEXT_SIZE]: {
              default: "normal",
              pc: "normal",
              mobile: "normal"
            }
          }
        }
      },
      body: {
        direction: "vertical",
        padding: "12px 12px 12px 12px",
        elements: [
          {
            tag: "markdown",
            content,
            text_align: "left",
            text_size: FEISHU_DAILY_REPORT_MARKDOWN_TEXT_SIZE,
            margin: "0px 0px 0px 0px"
          }
        ]
      },
      header: {
        title: {
          tag: "plain_text",
          content: title
        },
        template: "turquoise",
        padding: "12px 12px 12px 12px"
      }
    }
  };

  if (signature) {
    payload.timestamp = signature.timestamp;
    payload.sign = signature.sign;
  }

  return payload;
}

async function parseFeishuWebhookResponse(response: Response): Promise<Record<string, unknown>> {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return {};
  }

  try {
    return JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    return { message: responseText };
  }
}

function getFeishuResponseCode(payload: Record<string, unknown>): number | null {
  const rawCode = payload.code ?? payload.Code ?? payload.StatusCode ?? payload.statusCode;
  const code = Number(rawCode);

  return Number.isFinite(code) ? code : null;
}

function getFeishuResponseMessage(payload: Record<string, unknown>): string {
  return String(payload.msg ?? payload.message ?? payload.StatusMessage ?? payload.statusMessage ?? "").trim();
}

async function sendWeeklyDailyReportToFeishu(
  request: WeeklyDailyReportFeishuSendRequest
): Promise<WeeklyDailyReportFeishuSendResult> {
  const settings = await getWeeklyFeishuSettings();
  const webhookUrl = normalizeFeishuWebhookUrl(settings.webhookUrl);
  const content = String(request.content ?? "").trim();

  if (!content) {
    throw new Error("当前没有可发送的日报内容。");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(buildFeishuDailyReportPayload(settings, { ...request, content }))
  });
  const responsePayload = await parseFeishuWebhookResponse(response);
  const responseCode = getFeishuResponseCode(responsePayload);
  const responseMessage = getFeishuResponseMessage(responsePayload) || (response.ok ? "success" : response.statusText);
  const isBusinessOk = responseCode === null || responseCode === 0;

  if (!response.ok || !isBusinessOk) {
    throw new Error(`飞书返回异常：${responseMessage || `HTTP ${response.status}`}`);
  }

  return {
    ok: true,
    sentAt: new Date().toISOString(),
    statusCode: responseCode ?? response.status,
    responseMessage
  };
}

function normalizeWritingBookExportFormat(value: unknown): WritingBookExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return WRITING_BOOK_EXPORT_EXTENSIONS.has(format as WritingBookExportFormat) ? (format as WritingBookExportFormat) : "txt";
}

function sanitizeWritingBookExportFileName(value: unknown, format: WritingBookExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名书稿"}.${format}`;
}

function resolveWritingBookExportPath(request: WritingBookExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: WritingBookExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的正文内容");
  }

  const format = normalizeWritingBookExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeWritingBookExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeComicProjectExportFormat(value: unknown): ComicProjectExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return COMIC_PROJECT_EXPORT_EXTENSIONS.has(format as ComicProjectExportFormat) ? (format as ComicProjectExportFormat) : "md";
}

function sanitizeComicProjectExportFileName(value: unknown, format: ComicProjectExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名漫画项目"}.${format}`;
}

function resolveComicProjectExportPath(request: ComicProjectExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: ComicProjectExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的项目内容");
  }

  const format = normalizeComicProjectExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeComicProjectExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeVideoProjectExportFormat(value: unknown): VideoProjectExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return VIDEO_PROJECT_EXPORT_EXTENSIONS.has(format as VideoProjectExportFormat) ? (format as VideoProjectExportFormat) : "md";
}

function sanitizeVideoProjectExportFileName(value: unknown, format: VideoProjectExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名视频项目"}.${format}`;
}

function resolveVideoProjectExportPath(request: VideoProjectExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: VideoProjectExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的视频项目内容");
  }

  const format = normalizeVideoProjectExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeVideoProjectExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeMusicProjectExportFormat(value: unknown): MusicProjectExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return MUSIC_PROJECT_EXPORT_EXTENSIONS.has(format as MusicProjectExportFormat) ? (format as MusicProjectExportFormat) : "md";
}

function sanitizeMusicProjectExportFileName(value: unknown, format: MusicProjectExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名音乐专辑"}.${format}`;
}

function resolveMusicProjectExportPath(request: MusicProjectExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: MusicProjectExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的音乐专辑内容");
  }

  const format = normalizeMusicProjectExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeMusicProjectExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeCommandWorkshopMessageExportFormat(value: unknown): CommandWorkshopMessageExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return COMMAND_WORKSHOP_MESSAGE_EXPORT_EXTENSIONS.has(format as CommandWorkshopMessageExportFormat)
    ? (format as CommandWorkshopMessageExportFormat)
    : "pdf";
}

function sanitizeExportBaseFileName(value: unknown, fallback: string): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return baseName || fallback;
}

function normalizeCommandWorkshopMessageExportRequest(
  request: CommandWorkshopMessageExportRequest
): CommandWorkshopMessageExportRequest {
  const format = normalizeCommandWorkshopMessageExportFormat(request?.format);
  const contentText = String(request?.contentText ?? "").trim();
  const contentHtml = String(request?.contentHtml ?? "").trim();

  if (!contentText && !contentHtml) {
    throw new Error("当前 AI 回复没有可导出的内容");
  }

  return {
    fileName: `${sanitizeExportBaseFileName(request?.fileName, "Gordon AI 回复")}.${format}`,
    format,
    title: String(request?.title ?? "").trim() || "Gordon AI 回复",
    agentName: String(request?.agentName ?? "").trim() || "Gordon",
    createdAt: String(request?.createdAt ?? "").trim(),
    contentText,
    contentHtml: contentHtml || `<p>${escapeHtml(contentText).replace(/\n/g, "<br />")}</p>`
  };
}

function formatExportDateTime(value: unknown): string {
  const date = new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString("zh-CN", { hour12: false });
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

function buildCommandWorkshopExportHtml(request: CommandWorkshopMessageExportRequest): string {
  const title = escapeHtml(request.title);
  const agentName = escapeHtml(request.agentName);
  const createdAt = escapeHtml(formatExportDateTime(request.createdAt));

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #1f2933;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12.5pt;
      line-height: 1.72;
    }
    .document-shell { max-width: 760px; margin: 0 auto; }
    .document-header {
      padding: 0 0 18px;
      margin: 0 0 22px;
      border-bottom: 1px solid #d7e6e2;
    }
    .document-eyebrow {
      margin: 0 0 7px;
      color: #0f8f7b;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 9px;
      color: #18272f;
      font-size: 24pt;
      line-height: 1.18;
      letter-spacing: 0;
    }
    .document-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      color: #60717d;
      font-size: 9.5pt;
    }
    .document-content { overflow-wrap: anywhere; }
    .document-content > *:first-child { margin-top: 0; }
    .command-rich-heading {
      break-after: avoid;
      color: #18313a;
      line-height: 1.28;
      margin: 23px 0 9px;
      letter-spacing: 0;
    }
    .command-rich-heading-depth-1 { font-size: 18pt; }
    .command-rich-heading-depth-2 { font-size: 15pt; }
    .command-rich-heading-depth-3 { font-size: 13.5pt; }
    .command-rich-paragraph { margin: 8px 0; }
    .command-rich-list { margin: 8px 0 10px 0; padding-left: 22px; }
    .command-rich-list .command-rich-list { margin-top: 4px; }
    .command-rich-list-item { margin: 3px 0; padding-left: 2px; }
    .command-rich-list-marker {
      display: inline-block;
      min-width: 26px;
      margin-left: -26px;
      color: #0f8f7b;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .command-rich-quote {
      margin: 12px 0;
      padding: 9px 13px;
      border-left: 3px solid #0fbea2;
      background: #f4fbf8;
      color: #40515c;
    }
    .command-rich-divider {
      height: 1px;
      margin: 18px 0;
      border: 0;
      background: #d7e6e2;
    }
    .command-rich-link { color: #087f6e; text-decoration: none; border-bottom: 1px solid rgba(8, 127, 110, 0.28); }
    .command-inline-code {
      padding: 1px 4px;
      border: 1px solid #d9e7e4;
      border-radius: 4px;
      background: #f6faf9;
      color: #9f4c3b;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.88em;
    }
    .command-code-block {
      break-inside: avoid;
      margin: 13px 0;
      border: 1px solid #d6e4e1;
      border-radius: 8px;
      overflow: hidden;
      background: #f8fbfa;
    }
    .command-code-head {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid #e1ebe8;
      color: #5c6f79;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .command-code-copy { display: none; }
    .command-code-pre {
      margin: 0;
      padding: 9px 0;
      overflow-wrap: normal;
      white-space: pre-wrap;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 8.5pt;
      line-height: 1.55;
    }
    .command-code-line {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 8px;
      padding: 0 10px;
    }
    .command-code-line-number {
      color: #91a1a9;
      text-align: right;
      user-select: none;
    }
    .command-code-line-content { min-width: 0; }
    .command-rich-table-wrap {
      margin: 14px 0;
      overflow: hidden;
      border: 1px solid #d6e4e1;
      border-radius: 8px;
    }
    .command-rich-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .command-rich-table th,
    .command-rich-table td {
      padding: 7px 9px;
      border-right: 1px solid #dce9e6;
      border-bottom: 1px solid #dce9e6;
      text-align: left;
      vertical-align: top;
    }
    .command-rich-table th {
      background: #eff8f5;
      color: #28414b;
      font-weight: 800;
    }
    .command-rich-table-cell.is-center { text-align: center; }
    .command-rich-table-cell.is-right { text-align: right; }
    .command-math-inline,
    .command-math-block {
      font-family: "Times New Roman", "STIX Two Math", serif;
      color: #17313b;
    }
    .command-math-inline {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      padding: 0 3px;
      border-radius: 4px;
      background: #f3faf8;
      vertical-align: baseline;
    }
    .command-math-block {
      display: flex;
      justify-content: center;
      margin: 14px 0;
      padding: 12px;
      overflow-x: auto;
      border: 1px solid #d8e8e4;
      border-radius: 8px;
      background: #fbfdfc;
      text-align: center;
    }
    .command-math-fraction {
      display: inline-grid;
      grid-template-rows: auto auto;
      align-items: center;
      margin: 0 2px;
      text-align: center;
      vertical-align: middle;
    }
    .command-math-fraction > span:first-child { border-bottom: 1px solid currentColor; }
    .command-math-root-mark { border-top: 1px solid currentColor; margin-right: 2px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      a { color: #087f6e; }
    }
  </style>
</head>
<body>
  <main class="document-shell">
    <header class="document-header">
      <p class="document-eyebrow">Gordon Command Workshop</p>
      <h1>${title}</h1>
      <div class="document-meta">
        <span>Agent: ${agentName}</span>
        <span>生成时间: ${createdAt}</span>
      </div>
    </header>
    <article class="document-content">${request.contentHtml}</article>
  </main>
</body>
</html>`;
}

async function exportCommandWorkshopMessageAsPdf(
  request: CommandWorkshopMessageExportRequest,
  filePath: string
): Promise<number> {
  const exportWindow = new BrowserWindow({
    width: 900,
    height: 1200,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    const html = buildCommandWorkshopExportHtml(request);
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      preferCSSPageSize: true,
      margins: {
        marginType: "custom",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    await writeFile(filePath, pdf);
    return pdf.byteLength;
  } finally {
    if (!exportWindow.isDestroyed()) {
      exportWindow.destroy();
    }
  }
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeDocxTextLines(text: string): string[] {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "    "));
}

function buildDocxRun(text: string, options: { bold?: boolean; italic?: boolean } = {}): string {
  const runProperties = [
    options.bold ? "<w:b/>" : "",
    options.italic ? "<w:i/>" : ""
  ].join("");
  const safeText = escapeXml(text);
  return `<w:r>${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ""}<w:t xml:space="preserve">${safeText}</w:t></w:r>`;
}

function buildDocxParagraph(
  text: string,
  style: "Title" | "Subtitle" | "Heading1" | "Heading2" | "Heading3" | "Normal" | "ListParagraph" = "Normal"
): string {
  const paragraphProperties = style === "Normal" ? "" : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  return `<w:p>${paragraphProperties}${buildDocxRun(text)}</w:p>`;
}

function buildCommandWorkshopDocxDocument(request: CommandWorkshopMessageExportRequest): string {
  const lines = normalizeDocxTextLines(request.contentText);
  const paragraphs = [
    buildDocxParagraph(request.title, "Title"),
    buildDocxParagraph(`Agent: ${request.agentName}    生成时间: ${formatExportDateTime(request.createdAt)}`, "Subtitle")
  ];
  let blankCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      blankCount += 1;
      if (blankCount <= 1) {
        paragraphs.push("<w:p/>");
      }
      continue;
    }

    blankCount = 0;

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);

    if (headingMatch) {
      const depth = headingMatch[1].length;
      paragraphs.push(buildDocxParagraph(headingMatch[2], depth === 1 ? "Heading1" : depth === 2 ? "Heading2" : "Heading3"));
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*+]|\d+(?:\.\d+)*[.)])\s+(.*)$/);

    if (listMatch) {
      paragraphs.push(buildDocxParagraph(`• ${listMatch[1]}`, "ListParagraph"));
      continue;
    }

    if (/^>\s?/.test(line)) {
      paragraphs.push(buildDocxParagraph(line.replace(/^>\s?/, ""), "Subtitle"));
      continue;
    }

    paragraphs.push(buildDocxParagraph(line));
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1260" w:bottom="1440" w:left="1260" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildCommandWorkshopDocxStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:eastAsia="Microsoft YaHei" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="180"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="18313A"/><w:sz w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="220"/></w:pPr>
    <w:rPr><w:color w:val="60717D"/><w:sz w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="0F7F6E"/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="18313A"/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="28414B"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:ind w:left="420" w:hanging="220"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
</w:styles>`;
}

async function exportCommandWorkshopMessageAsDocx(
  request: CommandWorkshopMessageExportRequest,
  filePath: string
): Promise<number> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word")?.file("document.xml", buildCommandWorkshopDocxDocument(request));
  zip.folder("word")?.file("styles.xml", buildCommandWorkshopDocxStyles());
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(filePath, buffer);
  return buffer.byteLength;
}

function buildGordonConfirmWindowHtml(options: GordonConfirmWindowOptions, confirmUrl: string, cancelUrl: string): string {
  const tone = options.tone ?? "warning";
  const detailItems = (options.detailLines ?? [])
    .filter((line) => String(line ?? "").trim())
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  const escapedConfirmUrl = escapeHtml(confirmUrl);
  const escapedCancelUrl = escapeHtml(cancelUrl);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --text: #f7f3eb;
        --text-soft: #98a9bf;
        --text-faint: rgba(247, 243, 235, 0.52);
        --line: rgba(151, 182, 216, 0.14);
        --panel: rgba(10, 19, 31, 0.92);
        --panel-strong: rgba(8, 15, 24, 0.96);
        --panel-soft: rgba(255, 255, 255, 0.05);
        --accent: #5ce1c2;
        --accent-warm: #f5c86b;
        --accent-hot: #ff8d77;
        --shadow: 0 24px 64px rgba(0, 0, 0, 0.36);
        font-family: "Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        color: var(--text);
        background:
          radial-gradient(circle at 18% 18%, rgba(92, 225, 194, 0.1), transparent 32%),
          radial-gradient(circle at 84% 18%, rgba(245, 200, 107, 0.1), transparent 30%),
          linear-gradient(180deg, #07111d 0%, #0a1320 100%);
      }

      .dialog {
        width: min(420px, calc(100vw - 32px));
        padding: 17px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025)),
          var(--panel);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .head {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        align-items: center;
      }

      .mark {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        border: 1px solid rgba(92, 225, 194, 0.14);
        background: rgba(92, 225, 194, 0.08);
        color: #bcf8ea;
      }

      .dialog.is-warning .mark,
      .dialog.is-danger .mark {
        border-color: rgba(255, 141, 119, 0.18);
        background: rgba(255, 141, 119, 0.09);
        color: #ffc5b7;
      }

      .mark svg {
        width: 16px;
        height: 16px;
      }

      .eyebrow {
        margin: 0 0 4px;
        color: var(--text-faint);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: 17px;
        line-height: 1.22;
      }

      .message {
        margin: 12px 0 0;
        color: var(--text-soft);
        font-size: 12.5px;
        line-height: 1.65;
      }

      .detail {
        display: grid;
        gap: 6px;
        max-height: 112px;
        margin: 12px 0 0;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 13px;
        background: var(--panel-soft);
        color: var(--text-soft);
        font-size: 11.5px;
        line-height: 1.5;
        list-style: none;
        overflow: auto;
      }

      .detail li {
        overflow-wrap: anywhere;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
      }

      .dialog-action {
        display: inline-grid;
        place-items: center;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        text-decoration: none;
        font: inherit;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
      }

      .secondary {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
      }

      .primary {
        border-color: rgba(92, 225, 194, 0.2);
        background: rgba(92, 225, 194, 0.14);
        color: #bcf8ea;
      }

      .dialog.is-danger .primary,
      .dialog.is-warning .primary {
        border-color: rgba(255, 141, 119, 0.24);
        background: rgba(255, 141, 119, 0.14);
        color: #ffd0c6;
      }
    </style>
  </head>
  <body>
    <main class="dialog is-${escapeHtml(tone)}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="head">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <div>
          <p class="eyebrow">${escapeHtml(options.eyebrow ?? "Gordon Confirm")}</p>
          <h1 id="dialog-title">${escapeHtml(options.title)}</h1>
        </div>
      </div>
      <p class="message">${escapeHtml(options.message)}</p>
      ${detailItems ? `<ul class="detail">${detailItems}</ul>` : ""}
      <div class="actions">
        <a class="dialog-action secondary" href="${escapedCancelUrl}" data-action="cancel">${escapeHtml(options.cancelText ?? "取消")}</a>
        <a class="dialog-action primary" href="${escapedConfirmUrl}" data-action="confirm" autofocus>${escapeHtml(options.confirmText ?? "确认")}</a>
      </div>
    </main>
  </body>
</html>`;
}

function showGordonConfirmWindow(ownerWindow: BrowserWindow | null, options: GordonConfirmWindowOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const confirmUrl = `gordon-confirm://${requestId}/confirm`;
    const cancelUrl = `gordon-confirm://${requestId}/cancel`;
    const confirmWindow = new BrowserWindow({
      width: 460,
      height: 320,
      parent: ownerWindow ?? undefined,
      modal: Boolean(ownerWindow),
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      show: false,
      title: options.title,
      backgroundColor: "#07111d",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    let settled = false;
    const settle = (confirmed: boolean) => {
      if (settled) {
        return;
      }

      settled = true;

      if (!confirmWindow.isDestroyed()) {
        confirmWindow.close();
      }

      resolve(confirmed);
    };

    const handleNavigation = (event: Electron.Event, targetUrl: string) => {
      const url = new URL(targetUrl);

      if (url.protocol !== "gordon-confirm:" || url.hostname !== requestId) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      settle(url.pathname.replace(/^\//, "") === "confirm");
    };

    confirmWindow.webContents.on("will-navigate", handleNavigation);
    confirmWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") {
        return;
      }

      if (input.key === "Escape") {
        event.preventDefault();
        settle(false);
      }

      if (input.key === "Enter") {
        event.preventDefault();
        settle(true);
      }
    });
    confirmWindow.once("ready-to-show", () => confirmWindow.show());
    confirmWindow.once("closed", () => settle(false));
    confirmWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildGordonConfirmWindowHtml(options, confirmUrl, cancelUrl))}`).catch(() => {
      settle(false);
    });
  });
}

function splitCurlCommand(command: string): string[] {
  const normalized = String(command ?? "").replace(/\\\r?\n/g, " ").trim();
  const args: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const char of normalized) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
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
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
}

function normalizeWorkflowBaseUrl(baseUrl: unknown): string {
  return String(baseUrl ?? "").trim().replace(/\/+$/, "");
}

function getActiveWorkflowEnvironment(record: WorkflowRuntimeRecord): WorkflowRuntimeEnvironment | null {
  const environments = Array.isArray(record?.environments) ? record.environments : [];
  const activeEnvironment =
    environments.find((environment) => String(environment?.id ?? "") === String(record?.activeEnvironmentId ?? "")) ??
    environments.find((environment) => String(environment?.id ?? "") === "prod") ??
    environments[0] ??
    null;

  return activeEnvironment ?? null;
}

function replaceCurlPlaceholders(curl: string, record: WorkflowRuntimeRecord, variables: Record<string, string> = {}): string {
  const activeEnvironment = getActiveWorkflowEnvironment(record);
  const baseUrl = normalizeWorkflowBaseUrl(activeEnvironment?.baseUrl);
  const apiKey = String(activeEnvironment?.apiKey ?? record?.apiKey ?? "").trim();
  const replacements: Record<string, string> = {
    BASE_URL: baseUrl,
    API_KEY: apiKey,
    ...variables
  };
  const resolveReplacement = (placeholder: string, name: string) =>
    Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : placeholder;

  return String(curl ?? "")
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, resolveReplacement)
    .replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, resolveReplacement)
    .replace(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g, resolveReplacement);
}

function mergeWorkflowBaseUrlWithRequestUrl(baseUrl: string, requestUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const request = new URL(requestUrl);
    const basePath = base.pathname.replace(/\/+$/, "");
    const requestPath = request.pathname.startsWith("/") ? request.pathname : `/${request.pathname}`;

    return `${base.origin}${basePath}${requestPath}${request.search}${request.hash}`;
  } catch {
    return requestUrl;
  }
}

function findWorkflowUnresolvedVariables(command: string): string[] {
  const normalized = String(command ?? "");
  const dollarPlaceholders = Array.from(normalized.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)).map((match) => match[1]);
  const bareDollarPlaceholders = Array.from(normalized.matchAll(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g)).map((match) => match[1]);
  const doubleBracePlaceholders = Array.from(normalized.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)).map(
    (match) => match[1]
  );

  return Array.from(new Set([...dollarPlaceholders, ...bareDollarPlaceholders, ...doubleBracePlaceholders]));
}

function buildWorkflowCurlInvocation(
  step: { curl?: string },
  record: WorkflowRuntimeRecord,
  variables: Record<string, string> = {}
): { parts: string[]; unresolvedVariables: string[] } {
  const activeEnvironment = getActiveWorkflowEnvironment(record);
  const baseUrl = normalizeWorkflowBaseUrl(activeEnvironment?.baseUrl);
  const originalCommand = String(step?.curl ?? "");
  const usesBaseUrlPlaceholder = /\$BASE_URL\b|\$\{BASE_URL\}|\{\{\s*BASE_URL\s*\}\}/.test(originalCommand);
  const command = replaceCurlPlaceholders(originalCommand, record, variables);
  const unresolvedVariables = findWorkflowUnresolvedVariables(command);
  const parts = splitCurlCommand(command);
  const requestUrlIndex = parts.findIndex((part, index) => index > 0 && /^https?:\/\//i.test(part));

  if (baseUrl && !usesBaseUrlPlaceholder && requestUrlIndex >= 0) {
    parts[requestUrlIndex] = mergeWorkflowBaseUrlWithRequestUrl(baseUrl, parts[requestUrlIndex]);
  }

  return { parts, unresolvedVariables };
}

function createWorkflowStepResult(step: WorkflowRuntimeStep): WorkflowRunStepResult {
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
}

function createWorkflowStepAttempt(attempt: number): WorkflowRunStepAttempt {
  return {
    attempt,
    status: "running",
    startedAt: new Date().toISOString(),
    exitCode: null,
    stdout: "",
    stderr: ""
  };
}

function syncWorkflowStepResultFromAttempt(stepResult: WorkflowRunStepResult, attempt: WorkflowRunStepAttempt): void {
  stepResult.startedAt = stepResult.startedAt ?? attempt.startedAt;
  stepResult.exitCode = attempt.exitCode;
  stepResult.stdout = attempt.stdout;
  stepResult.stderr = attempt.stderr;
  stepResult.attempt = attempt.attempt;
  stepResult.completionValue = attempt.completionValue;
}

function appendWorkflowStderr(current: string, message: string): string {
  if (!message) {
    return current;
  }

  if (current.split(/\r?\n/).includes(message)) {
    return current;
  }

  return [current, message].filter(Boolean).join("\n");
}

function markWorkflowStepCancelled(stepResult: WorkflowRunStepResult, message = WORKFLOW_RUN_CANCELLED_MESSAGE): void {
  stepResult.status = "cancelled";
  stepResult.finishedAt = stepResult.finishedAt ?? new Date().toISOString();
  stepResult.stderr = appendWorkflowStderr(stepResult.stderr, message);
}

function markActiveWorkflowStepCancelled(results: WorkflowRunStepResult[]): void {
  const activeStep =
    results.find((step) => step.status === "running") ??
    results.find((step) => step.status === "pending");

  if (!activeStep || activeStep.status === "success" || activeStep.status === "failed" || activeStep.status === "cancelled") {
    return;
  }

  markWorkflowStepCancelled(activeStep);
}

function isWorkflowRunCancelledError(error: unknown): boolean {
  return error instanceof WorkflowRunCancelledError;
}

function throwIfWorkflowRunCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new WorkflowRunCancelledError();
  }
}

function terminateWorkflowChild(child: ReturnType<typeof spawn> | null): void {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Process may have already exited between progress updates and the cancel request.
  }
}

function normalizeWorkflowCompareValue(value: unknown): string {
  return normalizeWorkflowVariableValue(value).trim().toLowerCase();
}

function getWorkflowConfiguredValues(values: unknown, fallback: string[]): string[] {
  const normalized = Array.isArray(values)
    ? values.map((value) => normalizeWorkflowCompareValue(value)).filter(Boolean)
    : [];

  return normalized.length ? normalized : fallback;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new WorkflowRunCancelledError());
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const handleAbort = () => {
      clearTimeout(timer);
      reject(new WorkflowRunCancelledError());
    };

    timer = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, Math.max(0, ms));

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function runCurlAttempt(
  step: WorkflowRuntimeStep,
  record: WorkflowRuntimeRecord,
  variables: Record<string, string>,
  attempt: WorkflowRunStepAttempt,
  onUpdate: () => void,
  timeoutMs = 120_000,
  signal?: AbortSignal,
  activeRun?: WorkflowActiveRunContext
): Promise<WorkflowRunStepAttempt> {
  return new Promise((resolve) => {
    const { parts, unresolvedVariables } = buildWorkflowCurlInvocation(step, record, variables);
    let settled = false;
    let timedOut = false;
    let child: ReturnType<typeof spawn> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let handleAbort: () => void = () => undefined;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }

      signal?.removeEventListener("abort", handleAbort);

      if (activeRun?.child === child) {
        activeRun.child = null;
      }
    };

    const settle = (status: "success" | "failed" | "cancelled", exitCode: number | null, stderrSuffix = "") => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      attempt.status = status;
      attempt.finishedAt = new Date().toISOString();
      attempt.exitCode = exitCode;

      if (stderrSuffix) {
        attempt.stderr = appendWorkflowStderr(attempt.stderr, stderrSuffix);
      }

      onUpdate();
      resolve(attempt);
    };

    handleAbort = () => {
      terminateWorkflowChild(child);
      settle("cancelled", null, WORKFLOW_RUN_CANCELLED_MESSAGE);
    };

    if (signal?.aborted) {
      settle("cancelled", null, WORKFLOW_RUN_CANCELLED_MESSAGE);
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });

    timer = setTimeout(() => {
      timedOut = true;
      terminateWorkflowChild(child);
      settle("failed", null, `curl 执行超时（${timeoutMs}ms）`);
    }, timeoutMs);

    if (parts[0] !== "curl") {
      settle("failed", null, "仅支持以 curl 开头的命令");
      return;
    }

    if (unresolvedVariables.length) {
      settle("failed", null, `变量未解析：${unresolvedVariables.join("、")}`);
      return;
    }

    try {
      child = spawn("curl", parts.slice(1), { shell: false });
      if (activeRun) {
        activeRun.child = child;
      }
    } catch (error) {
      settle("failed", null, error instanceof Error ? error.message : String(error));
      return;
    }

    child.stdout?.on("data", (chunk) => {
      attempt.stdout += chunk.toString();
      onUpdate();
    });

    child.stderr?.on("data", (chunk) => {
      attempt.stderr += chunk.toString();
      onUpdate();
    });

    child.on("error", (error) => {
      settle("failed", null, error.message);
    });

    child.on("close", (exitCode) => {
      settle(!timedOut && exitCode === 0 ? "success" : "failed", exitCode);
    });

    onUpdate();
  });
}

async function runWorkflowStep(
  step: WorkflowRuntimeStep,
  record: WorkflowRuntimeRecord,
  variables: Record<string, string>,
  stepResult: WorkflowRunStepResult,
  emitProgress: () => void,
  signal?: AbortSignal,
  activeRun?: WorkflowActiveRunContext
): Promise<"success" | "failed" | "cancelled"> {
  const mode = step?.executionMode === "polling" ? "polling" : "once";
  const maxAttempts = mode === "polling" ? Math.max(1, Number(step?.maxAttempts ?? 1)) : 1;
  const pollIntervalMs = Math.max(0, Number(step?.pollIntervalMs ?? 0));
  const successValues = getWorkflowConfiguredValues(step?.successValues, ["succeeded", "completed", "success", "done", "finished"]);
  const failureValues = getWorkflowConfiguredValues(step?.failureValues, ["failed", "error", "canceled", "cancelled", "fail"]);
  const completionPath = normalizeWorkflowJsonPath(step?.completionPath);

  throwIfWorkflowRunCancelled(signal);
  stepResult.mode = mode;
  stepResult.status = "running";
  stepResult.startedAt = stepResult.startedAt ?? new Date().toISOString();
  stepResult.maxAttempts = maxAttempts;
  emitProgress();

  if (mode === "polling" && !completionPath) {
    stepResult.status = "failed";
    stepResult.finishedAt = new Date().toISOString();
    stepResult.stderr = "轮询步骤缺少状态 JSONPath";
    emitProgress();
    return "failed";
  }

  for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
    throwIfWorkflowRunCancelled(signal);
    const attempt = createWorkflowStepAttempt(attemptIndex);
    stepResult.attempts.push(attempt);
    syncWorkflowStepResultFromAttempt(stepResult, attempt);
    emitProgress();

    await runCurlAttempt(
      step,
      record,
      variables,
      attempt,
      () => {
        syncWorkflowStepResultFromAttempt(stepResult, attempt);
        emitProgress();
      },
      120_000,
      signal,
      activeRun
    );

    syncWorkflowStepResultFromAttempt(stepResult, attempt);

    if (attempt.status === "cancelled") {
      markWorkflowStepCancelled(stepResult);
      emitProgress();
      return "cancelled";
    }

    if (attempt.status !== "success") {
      stepResult.status = "failed";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      emitProgress();
      return "failed";
    }

    if (mode === "once") {
      stepResult.status = "success";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      emitProgress();
      return "success";
    }

    const responseJson = parseWorkflowResponseJson(attempt.stdout);
    const completionValue = normalizeWorkflowVariableValue(readWorkflowJsonPath(responseJson, completionPath));
    const comparableCompletionValue = normalizeWorkflowCompareValue(completionValue);
    attempt.completionValue = completionValue;
    syncWorkflowStepResultFromAttempt(stepResult, attempt);

    if (failureValues.includes(comparableCompletionValue)) {
      stepResult.status = "failed";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      stepResult.stderr = appendWorkflowStderr(stepResult.stderr, `轮询命中失败状态：${completionValue || "空值"}`);
      emitProgress();
      return "failed";
    }

    if (successValues.includes(comparableCompletionValue)) {
      stepResult.status = "success";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      emitProgress();
      return "success";
    }

    emitProgress();

    if (attemptIndex < maxAttempts && pollIntervalMs > 0) {
      await sleep(pollIntervalMs, signal);
    }
  }

  stepResult.status = "failed";
  stepResult.finishedAt = new Date().toISOString();
  stepResult.stderr = appendWorkflowStderr(
    stepResult.stderr,
    `轮询超过最大轮次，最后状态：${stepResult.completionValue || "未读取到状态"}`
  );
  emitProgress();
  return "failed";
}

function getWorkflowResponseBody(stdout: string): string {
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

function parseWorkflowResponseJson(stdout: string): unknown {
  const body = getWorkflowResponseBody(stdout);

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

function normalizeWorkflowJsonPath(pathValue: unknown): string {
  const normalized = String(pathValue ?? "").trim();

  if (!normalized) {
    return "";
  }

  const dataPathMatch = normalized.match(/(?:^|\n)\s*data\s*:\s*([^\n]+)/i);
  return dataPathMatch?.[1]?.trim() ?? normalized;
}

function readWorkflowJsonPath(input: unknown, pathValue: unknown): unknown {
  const pathText = normalizeWorkflowJsonPath(pathValue);
  const normalizedPath = pathText.startsWith("$") ? pathText.slice(1) : pathText;
  const tokens = normalizedPath
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "")
    .split(".")
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.reduce<unknown>((current, token) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current) && /^\d+$/.test(token)) {
      return current[Number(token)];
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[token];
    }

    return undefined;
  }, input);
}

function normalizeWorkflowVariableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function collectWorkflowStepVariables(step: WorkflowRuntimeStep, stdout: string): Record<string, string> {
  const responseJson = parseWorkflowResponseJson(stdout);
  const variables: Record<string, string> = {};

  if (!responseJson || !Array.isArray(step?.produces)) {
    return variables;
  }

  for (const binding of step.produces) {
    const name = String(binding?.name ?? "").trim();
    const path = normalizeWorkflowJsonPath(binding?.path);

    if (!name || !path) {
      continue;
    }

    const value = normalizeWorkflowVariableValue(readWorkflowJsonPath(responseJson, path));

    if (value) {
      variables[name] = value;
    }
  }

  return variables;
}

async function runWorkflowRecord(record: WorkflowRuntimeRecord, emitProgress?: WorkflowRunProgressEmitter) {
  const startedAt = new Date().toISOString();
  const steps = Array.isArray(record?.steps) ? record.steps : [];
  const results = steps.map((step) => createWorkflowStepResult(step));
  const variables: Record<string, string> = {};
  const progressEventId = String(record?.progressEventId ?? "").trim();
  const activeRun: WorkflowActiveRunContext | null = progressEventId
    ? { controller: new AbortController(), child: null }
    : null;
  const signal = activeRun?.controller.signal;
  let status: WorkflowRunStatus = "running";
  let finishedAt: string | undefined;

  if (progressEventId && activeRun) {
    activeWorkflowRuns.set(progressEventId, activeRun);
  }

  const buildPayload = (): WorkflowRunProgressPayload => ({
    progressEventId: record?.progressEventId,
    status,
    startedAt,
    ...(finishedAt ? { finishedAt } : {}),
    variables: { ...variables },
    steps: results.map((step) => ({
      ...step,
      attempts: step.attempts.map((attempt) => ({ ...attempt }))
    }))
  });

  const emitSnapshot = () => {
    if (record?.progressEventId && emitProgress) {
      emitProgress(buildPayload());
    }
  };

  emitSnapshot();

  try {
    for (const [index, step] of steps.entries()) {
      throwIfWorkflowRunCancelled(signal);

      const stepResult = results[index];
      const waitBeforeMs = Number(step?.waitBeforeMs ?? 0);

      if (waitBeforeMs > 0) {
        stepResult.status = "running";
        stepResult.startedAt = stepResult.startedAt ?? new Date().toISOString();
        stepResult.stderr = `等待 ${waitBeforeMs}ms 后执行`;
        emitSnapshot();
        await sleep(waitBeforeMs, signal);
        stepResult.stderr = "";
      }

      const outcome = await runWorkflowStep(step, record, variables, stepResult, emitSnapshot, signal, activeRun ?? undefined);

      if (outcome === "cancelled") {
        status = "cancelled";
        break;
      }

      if (outcome !== "success") {
        break;
      }

      throwIfWorkflowRunCancelled(signal);
      Object.assign(variables, collectWorkflowStepVariables(step, stepResult.stdout ?? ""));
      emitSnapshot();
    }

    if (status === "running") {
      status = signal?.aborted
        ? "cancelled"
        : results.length > 0 && results.every((result) => result.status === "success")
          ? "success"
          : "failed";
    }
  } catch (error) {
    if (!isWorkflowRunCancelledError(error)) {
      throw error;
    }

    status = "cancelled";
  } finally {
    if (status === "cancelled") {
      markActiveWorkflowStepCancelled(results);
    }

    finishedAt = new Date().toISOString();
    emitSnapshot();

    if (progressEventId) {
      activeWorkflowRuns.delete(progressEventId);
    }
  }

  return buildPayload();
}

function cancelWorkflowRecordRun(progressEventId: unknown): { cancelled: boolean; progressEventId: string } {
  const runId = String(progressEventId ?? "").trim();

  if (!runId) {
    return { cancelled: false, progressEventId: "" };
  }

  const activeRun = activeWorkflowRuns.get(runId);

  if (!activeRun) {
    return { cancelled: false, progressEventId: runId };
  }

  activeRun.controller.abort();

  terminateWorkflowChild(activeRun.child);

  return { cancelled: true, progressEventId: runId };
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: MAIN_WINDOW_MIN_WIDTH,
    height: MAIN_WINDOW_MIN_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    title: "Gordon Work Assistant",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadFile(path.join(currentDir, "renderer", "index.html"));
}

async function pollModelBalanceUsage(): Promise<void> {
  if (modelBalancePollingInFlight) {
    return;
  }

  modelBalancePollingInFlight = true;

  try {
    const settings = await listModelSettings();
    const profiles = settings.profiles.filter(
      (profile) => profile.apiKey?.trim() && String(profile.balanceQueryCode ?? "").trim()
    );

    for (const profile of profiles) {
      try {
        await queryModelBalance({
          profile,
          persistResult: true,
          historySource: "scheduled"
        });
      } catch (error) {
        console.warn(
          `[model-balance] scheduled usage polling failed for ${profile.displayName}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    console.warn("[model-balance] scheduled usage polling failed:", error instanceof Error ? error.message : error);
  } finally {
    modelBalancePollingInFlight = false;
  }
}

function startModelBalanceUsagePolling(): void {
  if (modelBalancePollingTimer) {
    return;
  }

  modelBalancePollingTimer = setInterval(() => {
    void pollModelBalanceUsage();
  }, MODEL_BALANCE_POLL_INTERVAL_MS);

  setTimeout(() => {
    void pollModelBalanceUsage();
  }, MODEL_BALANCE_INITIAL_POLL_DELAY_MS);
}

app.whenReady().then(async () => {
  await ensureGordonHomeDirectory();

  if (process.platform === "darwin" && app.dock) {
    const dockIcon = nativeImage.createFromPath(appIconPath);

    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  ipcMain.handle("gordon:bootstrap", async () => buildWorkbenchSnapshot());
  ipcMain.handle("gordon:prompt-assets:read", async (_event, promptIds: unknown) => {
    if (!Array.isArray(promptIds)) {
      throw new Error("提示词资产读取参数必须是数组");
    }

    const assets: Partial<Record<PromptAssetId, string>> = {};

    for (const promptId of promptIds) {
      if (typeof promptId !== "string" || !isPromptAssetId(promptId)) {
        throw new Error(`未知提示词资产：${String(promptId)}`);
      }

      assets[promptId] = readPromptAsset(promptId);
    }

    return assets;
  });
  ipcMain.handle("gordon:model-settings:list", async () => toCloneableIpcValue(await listModelSettings()));
  ipcMain.handle("gordon:model-settings:upsert", async (_event, profile) =>
    toCloneableIpcValue(await upsertModelProfile(toCloneableIpcValue(profile)))
  );
  ipcMain.handle("gordon:model-settings:activate", async (_event, profileId: string) =>
    toCloneableIpcValue(await activateModelProfile(profileId))
  );
  ipcMain.handle("gordon:model-settings:toggle-status", async (_event, profileId: string) =>
    toCloneableIpcValue(await toggleModelProfileStatus(profileId))
  );
  ipcMain.handle("gordon:model-settings:delete", async (_event, profileId: string) =>
    toCloneableIpcValue(await deleteModelProfile(profileId))
  );
  ipcMain.handle("gordon:model-settings:reorder", async (_event, profileIds: string[]) =>
    toCloneableIpcValue(await reorderModelProfiles(toCloneableIpcValue(profileIds)))
  );
  ipcMain.handle("gordon:model:balance-history", async (_event, profileId?: string) =>
    toCloneableIpcValue(await listModelBalanceHistory(profileId))
  );
  ipcMain.handle("gordon:model:invoke-text", async (_event, request) => {
    const requestId = typeof request?.requestId === "string" && request.requestId.trim() ? request.requestId.trim() : "";
    const abortController = requestId ? new AbortController() : null;

    if (requestId && abortController) {
      modelTextAbortControllers.set(requestId, abortController);
    }

    try {
      return await invokeActiveModel(request, abortController ? { signal: abortController.signal } : {});
    } finally {
      if (requestId) {
        modelTextAbortControllers.delete(requestId);
      }
    }
  });
  ipcMain.handle("gordon:model:cancel-text", async (_event, requestId) => {
    const normalizedRequestId = typeof requestId === "string" ? requestId.trim() : "";
    const abortController = normalizedRequestId ? modelTextAbortControllers.get(normalizedRequestId) : null;

    if (!abortController) {
      return false;
    }

    abortController.abort();
    modelTextAbortControllers.delete(normalizedRequestId);
    return true;
  });
  ipcMain.handle("gordon:model:query-balance", async (_event, request) =>
    toCloneableIpcValue(await queryModelBalance(toCloneableIpcValue(request)))
  );
  ipcMain.handle("gordon:skills:list", async () => listSkillDefinitions());
  ipcMain.handle("gordon:skills:upsert", async (_event, skill) => upsertSkillDefinition(skill));
  ipcMain.handle("gordon:skills:import-from-github", async (_event, request) => importSkillDefinitionFromGithub(request));
  ipcMain.handle("gordon:skills:toggle-status", async (_event, skillId: string) => toggleSkillDefinitionStatus(skillId));
  ipcMain.handle("gordon:skills:delete", async (_event, skillId: string) => deleteSkillDefinition(skillId));
  ipcMain.handle("gordon:mcp-servers:list", async () => listMcpServers());
  ipcMain.handle("gordon:mcp-servers:upsert", async (_event, server) => upsertMcpServer(server));
  ipcMain.handle("gordon:mcp-servers:toggle-status", async (_event, serverId: string) => toggleMcpServerStatus(serverId));
  ipcMain.handle("gordon:mcp-servers:delete", async (_event, serverId: string) => deleteMcpServer(serverId));
  ipcMain.handle("gordon:mcp-servers:list-tools", async (_event, serverId: string) => listToolsFromMcpServer(serverId));
  ipcMain.handle("gordon:mcp-servers:call-tool", async (_event, request) => callToolOnMcpServer(request));
  ipcMain.handle("gordon:tool-configs:list", async () => listToolConfigs());
  ipcMain.handle("gordon:tool-configs:upsert", async (_event, config) => upsertToolConfig(config));
  ipcMain.handle("gordon:tool-configs:toggle-status", async (_event, configId: string) => toggleToolConfigStatus(configId));
  ipcMain.handle("gordon:agent-profiles:list", async () => listAgentProfiles());
  ipcMain.handle("gordon:agent-profiles:upsert", async (_event, profile) => upsertAgentProfile(profile));
  ipcMain.handle("gordon:agent-profiles:toggle-status", async (_event, profileId: string) =>
    toggleAgentProfileStatus(profileId)
  );
  ipcMain.handle("gordon:agent-profiles:delete", async (_event, profileId: string) => deleteAgentProfile(profileId));
  ipcMain.handle("gordon:agent:run", async (event, request) => {
    const grantedWorkspaceRoots = new Set<string>();
    let computerUseGranted = false;
    const progressEventId = typeof request?.progressEventId === "string" && request.progressEventId.trim()
      ? request.progressEventId.trim()
      : "";
    const abortController = new AbortController();

    if (progressEventId) {
      agentRunAbortControllers.set(progressEventId, abortController);
    }

    try {
      const result = await runAgent(toCloneableIpcValue(request), {
        signal: abortController.signal,
        onProgress: (payload: AgentRunProgressEvent) => {
          if (!event.sender.isDestroyed()) {
            try {
              event.sender.send("gordon:agent:progress", toCloneableIpcValue(payload));
            } catch (error) {
              console.error("Failed to send agent progress event", error);
            }
          }
        },
        onWorkspacePermissionRequest: async (permissionRequest) => {
          if (grantedWorkspaceRoots.has(permissionRequest.suggestedRoot)) {
            return true;
          }

          const ownerWindow = BrowserWindow.fromWebContents(event.sender);
          const granted = await showGordonConfirmWindow(ownerWindow, {
            tone: "warning",
            eyebrow: "Permission",
            title: "Gordon 需要访问外部路径",
            message: "是否允许 Gordon 本次访问工作区外的路径？授权只对当前这次 Agent 运行生效，不会写入长期配置。",
            detailLines: [
              `请求路径：${permissionRequest.path}`,
              `授权范围：${permissionRequest.suggestedRoot}`,
              `工具：${permissionRequest.serverName} / ${permissionRequest.toolName}`
            ],
            confirmText: "允许本次访问",
            cancelText: "拒绝"
          });

          if (granted) {
            grantedWorkspaceRoots.add(permissionRequest.suggestedRoot);
          }

          return granted;
        },
        onComputerUsePermissionRequest: async (permissionRequest) => {
          if (computerUseGranted) {
            return true;
          }

          const ownerWindow = BrowserWindow.fromWebContents(event.sender);
          const granted = await showGordonConfirmWindow(ownerWindow, {
            tone: "danger",
            eyebrow: "Computer Use",
            title: "Gordon 需要使用桌面控制",
            message: "是否允许 Gordon 本次读取和控制你的桌面？授权只对当前这次 Agent 运行生效，后续运行会重新询问。",
            detailLines: [
              `动作：${permissionRequest.action}`,
              `工具：${permissionRequest.serverName} / ${permissionRequest.toolName}`,
              `原因：${permissionRequest.reason}`
            ],
            confirmText: "允许本次使用",
            cancelText: "拒绝"
          });

          if (granted) {
            computerUseGranted = true;
          }

          return granted;
        }
      });

      return toCloneableIpcValue(result);
    } finally {
      if (progressEventId) {
        agentRunAbortControllers.delete(progressEventId);
      }
    }
  });
  ipcMain.handle("gordon:agent:cancel-run", async (_event, progressEventId) => {
    const normalizedProgressEventId = typeof progressEventId === "string" ? progressEventId.trim() : "";
    const abortController = normalizedProgressEventId ? agentRunAbortControllers.get(normalizedProgressEventId) : null;

    if (!abortController) {
      return false;
    }

    abortController.abort();
    agentRunAbortControllers.delete(normalizedProgressEventId);
    return true;
  });
  ipcMain.handle("gordon:command-workshop:list", async () => listCommandWorkshopSessions());
  ipcMain.handle("gordon:command-workshop:select-attachments", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择要发送给 Gordon 的文件",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "常用文件",
          extensions: [
            "txt",
            "md",
            "csv",
            "tsv",
            "json",
            "xml",
            "yaml",
            "yml",
            "pdf",
            "docx",
            "pptx",
            "xlsx",
            "xls",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "webp",
            "svg",
            "mp4",
            "mov",
            "webm"
          ]
        },
        { name: "所有文件", extensions: ["*"] }
      ]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return [];
    }

    const attachments = await Promise.all(result.filePaths.map((filePath) => readCommandWorkshopAttachment(filePath)));
    return toCloneableIpcValue(attachments);
  });
  ipcMain.handle("gordon:command-workshop:upsert", async (_event, session) => upsertCommandWorkshopSession(session));
  ipcMain.handle("gordon:command-workshop:delete", async (_event, sessionId: string) =>
    deleteCommandWorkshopSession(sessionId)
  );
  ipcMain.handle("gordon:command-workshop:export-message", async (event, request: CommandWorkshopMessageExportRequest) => {
    const exportRequest = normalizeCommandWorkshopMessageExportRequest(request);
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const extension = exportRequest.format;
    const saveDialogOptions = {
      title: extension === "pdf" ? "导出 AI 回复为 PDF" : "导出 AI 回复为 DOCX",
      defaultPath: path.join(app.getPath("documents"), exportRequest.fileName),
      filters: [
        {
          name: extension === "pdf" ? "PDF 文档" : "Word 文档",
          extensions: [extension]
        }
      ]
    } satisfies Electron.SaveDialogOptions;
    const dialogResult = ownerWindow
      ? await dialog.showSaveDialog(ownerWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (dialogResult.canceled || !dialogResult.filePath) {
      return null;
    }

    const normalizedFilePath = dialogResult.filePath.toLowerCase().endsWith(`.${extension}`)
      ? dialogResult.filePath
      : `${dialogResult.filePath}.${extension}`;

    await mkdir(path.dirname(normalizedFilePath), { recursive: true });

    const writtenBytes =
      extension === "pdf"
        ? await exportCommandWorkshopMessageAsPdf(exportRequest, normalizedFilePath)
        : await exportCommandWorkshopMessageAsDocx(exportRequest, normalizedFilePath);

    return {
      filePath: normalizedFilePath,
      fileName: path.basename(normalizedFilePath),
      format: extension,
      writtenBytes
    };
  });
  ipcMain.handle("gordon:workflow-library:upsert", async (_event, item) => upsertWorkflowLibraryItem(item));
  ipcMain.handle("gordon:workflow-library:run-record", async (event, record) =>
    runWorkflowRecord(record, (payload) =>
      event.sender.send("gordon:workflow-library:progress", toCloneableIpcValue(payload))
    )
  );
  ipcMain.handle("gordon:workflow-library:cancel-run", async (_event, progressEventId) =>
    cancelWorkflowRecordRun(progressEventId)
  );
  ipcMain.handle("gordon:comic-projects:list", async () => listComicProjects());
  ipcMain.handle("gordon:comic-projects:upsert", async (_event, project) => upsertComicProject(project));
  ipcMain.handle("gordon:comic-projects:delete", async (_event, projectId: string) =>
    deleteComicProject(projectId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:comic-projects:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择丹青溢彩导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:comic-projects:export", async (_event, request: ComicProjectExportRequest) => {
    const exportTarget = resolveComicProjectExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:video-projects:list", async () => listVideoProjects());
  ipcMain.handle("gordon:video-projects:upsert", async (_event, project) => upsertVideoProject(project));
  ipcMain.handle("gordon:video-projects:delete", async (_event, projectId: string) =>
    deleteVideoProject(projectId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:video-projects:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择流光绘影导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:video-projects:export", async (_event, request: VideoProjectExportRequest) => {
    const exportTarget = resolveVideoProjectExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:music-projects:list", async () => listMusicProjects());
  ipcMain.handle("gordon:music-projects:upsert", async (_event, project: MusicProject) => upsertMusicProject(project));
  ipcMain.handle("gordon:music-projects:delete", async (_event, projectId: string) =>
    deleteMusicProject(projectId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:music-projects:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择瑶琴映月导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:music-projects:export", async (_event, request: MusicProjectExportRequest) => {
    const exportTarget = resolveMusicProjectExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:writing-books:list", async () => listWritingBooks());
  ipcMain.handle("gordon:writing-books:save", async (_event, book, options) => saveWritingBook(book, options));
  ipcMain.handle("gordon:writing-books:delete", async (_event, bookId: string) =>
    deleteWritingBook(bookId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:writing-books:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择墨笔生花导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:writing-books:export", async (_event, request: WritingBookExportRequest) => {
    const exportTarget = resolveWritingBookExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:weekly-progress:list", async () => listWeeklyProgress());
  ipcMain.handle("gordon:weekly-progress:save", async (_event, record) => saveWeeklyProgress(record));
  ipcMain.handle("gordon:weekly-progress:delete", async (_event, recordId: string) => deleteWeeklyProgress(recordId));
  ipcMain.handle("gordon:weekly-progress:rewrite", async (_event, request) => rewriteWeeklyProgressItem(request));
  ipcMain.handle("gordon:weekly-progress:generate-daily-report", async (_event, request) =>
    generateDailyProgressReport(request)
  );
  ipcMain.handle("gordon:weekly-progress:generate-report", async (_event, request) =>
    generateWeeklyProgressReport(request)
  );
  ipcMain.handle("gordon:weekly-progress:generate-performance-report", async (_event, request) =>
    generatePerformanceProgressReport(request)
  );
  ipcMain.handle("gordon:weekly-progress:feishu-settings:get", async () => getWeeklyFeishuSettings());
  ipcMain.handle("gordon:weekly-progress:feishu-settings:save", async (_event, settings: WeeklyFeishuSettings) =>
    saveWeeklyFeishuSettings(settings)
  );
  ipcMain.handle(
    "gordon:weekly-progress:send-daily-report-to-feishu",
    async (_event, request: WeeklyDailyReportFeishuSendRequest) => sendWeeklyDailyReportToFeishu(request)
  );

  await createMainWindow();
  startModelBalanceUsagePolling();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  if (modelBalancePollingTimer) {
    clearInterval(modelBalancePollingTimer);
    modelBalancePollingTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
