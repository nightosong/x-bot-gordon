import { app, BrowserWindow, ipcMain, nativeImage, screen } from "electron";
import type { IpcMainEvent } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { callToolOnMcpServer, listToolsFromMcpServer, runAgent } from "../../../packages/agent/src/index.js";
import { buildWorkbenchSnapshot } from "../../../packages/core/src/index.js";
import {
  deleteAgentProfile,
  deleteCommandWorkshopSession,
  deleteMcpServer,
  activateModelProfile,
  deleteModelProfile,
  deleteSkillDefinition,
  deleteWeeklyProgress,
  importSkillDefinitionFromGithub,
  listAgentProfiles,
  listCommandWorkshopSessions,
  listMcpServers,
  listSkillDefinitions,
  listWeeklyProgress,
  listModelSettings,
  saveWeeklyProgress,
  toggleAgentProfileStatus,
  toggleMcpServerStatus,
  toggleModelProfileStatus,
  toggleSkillDefinitionStatus,
  upsertAgentProfile,
  upsertCommandWorkshopSession,
  upsertWorkflowLibraryItem,
  upsertMcpServer,
  upsertModelProfile,
  upsertSkillDefinition
} from "../../../packages/workbench/src/index.js";
import type { AgentRunProgressEvent } from "../../../packages/shared/src/index.js";
import { generateDailyProgressReport, generateWeeklyProgressReport, invokeActiveModel, rewriteWeeklyProgressItem } from "./ai.js";
import { queryModelBalance } from "./model-balance.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const desktopAssetDir = path.resolve(currentDir, "..", "assets");
const appIconFileName = process.platform === "win32" ? "gordon.ico" : "gordon.icns";
const appIconPath = path.join(desktopAssetDir, appIconFileName);

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

function buildGordonConfirmWindowHtml(options: GordonConfirmWindowOptions, resolveChannel: string): string {
  const tone = options.tone ?? "warning";
  const detailItems = (options.detailLines ?? [])
    .filter((line) => String(line ?? "").trim())
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  const safeResolveChannel = JSON.stringify(resolveChannel).replaceAll("<", "\\u003c");

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

      button {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
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
        <button class="secondary" type="button" data-action="cancel">${escapeHtml(options.cancelText ?? "取消")}</button>
        <button class="primary" type="button" data-action="confirm" autofocus>${escapeHtml(options.confirmText ?? "确认")}</button>
      </div>
    </main>
    <script>
      const { ipcRenderer } = require("electron");
      const resolveChannel = ${safeResolveChannel};
      const closeWith = (confirmed) => ipcRenderer.send(resolveChannel, { confirmed });
      document.querySelector('[data-action="confirm"]').addEventListener("click", () => closeWith(true));
      document.querySelector('[data-action="cancel"]').addEventListener("click", () => closeWith(false));
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeWith(false);
        }
      });
    </script>
  </body>
</html>`;
}

function showGordonConfirmWindow(ownerWindow: BrowserWindow | null, options: GordonConfirmWindowOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const resolveChannel = `gordon:confirm-window:${Date.now()}:${Math.random().toString(36).slice(2)}`;
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
        contextIsolation: false,
        nodeIntegration: true,
        sandbox: false
      }
    });

    let settled = false;
    const settle = (confirmed: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      ipcMain.removeListener(resolveChannel, handleResolve);

      if (!confirmWindow.isDestroyed()) {
        confirmWindow.close();
      }

      resolve(confirmed);
    };
    const handleResolve = (event: IpcMainEvent, payload: { confirmed?: boolean }) => {
      if (event.sender !== confirmWindow.webContents) {
        return;
      }

      settle(Boolean(payload?.confirmed));
    };

    ipcMain.on(resolveChannel, handleResolve);
    confirmWindow.once("ready-to-show", () => confirmWindow.show());
    confirmWindow.once("closed", () => settle(false));
    confirmWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildGordonConfirmWindowHtml(options, resolveChannel))}`).catch(() => {
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

function runCurlStep(step: { id?: string; name?: string; curl?: string }, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const parts = splitCurlCommand(String(step?.curl ?? ""));

    if (parts[0] !== "curl") {
      resolve({
        stepId: step?.id ?? "",
        name: step?.name ?? "",
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: null,
        stdout: "",
        stderr: "仅支持以 curl 开头的命令"
      });
      return;
    }

    const child = spawn("curl", parts.slice(1), { shell: false });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill("SIGTERM");
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      settled = true;
      clearTimeout(timer);
      resolve({
        stepId: step?.id ?? "",
        name: step?.name ?? "",
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: null,
        stdout,
        stderr: error.message
      });
    });

    child.on("close", (exitCode) => {
      settled = true;
      clearTimeout(timer);
      resolve({
        stepId: step?.id ?? "",
        name: step?.name ?? "",
        status: exitCode === 0 ? "success" : "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

async function runWorkflowRecord(record: { steps?: Array<{ id?: string; name?: string; curl?: string; waitBeforeMs?: number }> }) {
  const startedAt = new Date().toISOString();
  const steps = Array.isArray(record?.steps) ? record.steps : [];
  const results = [];

  for (const step of steps) {
    const waitBeforeMs = Number(step?.waitBeforeMs ?? 0);

    if (waitBeforeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitBeforeMs));
    }

    const result = await runCurlStep(step);
    results.push(result);

    if ((result as { status?: string }).status !== "success") {
      break;
    }
  }

  return {
    status: results.every((result) => (result as { status?: string }).status === "success") ? "success" : "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    steps: results
  };
}

async function createMainWindow(): Promise<void> {
  const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.max(1180, Math.min(1320, Math.round(workAreaWidth * 0.82)));
  const height = Math.max(760, Math.min(860, Math.round(workAreaHeight * 0.84)));

  const window = new BrowserWindow({
    width,
    height,
    minWidth: 1080,
    minHeight: 720,
    title: "Gordon Work Assistant",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true
    }
  });

  await window.loadFile(path.join(currentDir, "renderer", "index.html"));
}

app.whenReady().then(async () => {
  if (process.platform === "darwin" && app.dock) {
    const dockIcon = nativeImage.createFromPath(appIconPath);

    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  ipcMain.handle("gordon:bootstrap", async () => buildWorkbenchSnapshot());
  ipcMain.handle("gordon:model-settings:list", async () => listModelSettings());
  ipcMain.handle("gordon:model-settings:upsert", async (_event, profile) => upsertModelProfile(profile));
  ipcMain.handle("gordon:model-settings:activate", async (_event, profileId: string) =>
    activateModelProfile(profileId)
  );
  ipcMain.handle("gordon:model-settings:toggle-status", async (_event, profileId: string) =>
    toggleModelProfileStatus(profileId)
  );
  ipcMain.handle("gordon:model-settings:delete", async (_event, profileId: string) => deleteModelProfile(profileId));
  ipcMain.handle("gordon:model:invoke-text", async (_event, request) => invokeActiveModel(request));
  ipcMain.handle("gordon:model:query-balance", async (_event, request) => queryModelBalance(request));
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
  ipcMain.handle("gordon:agent-profiles:list", async () => listAgentProfiles());
  ipcMain.handle("gordon:agent-profiles:upsert", async (_event, profile) => upsertAgentProfile(profile));
  ipcMain.handle("gordon:agent-profiles:toggle-status", async (_event, profileId: string) =>
    toggleAgentProfileStatus(profileId)
  );
  ipcMain.handle("gordon:agent-profiles:delete", async (_event, profileId: string) => deleteAgentProfile(profileId));
  ipcMain.handle("gordon:agent:run", async (event, request) => {
    const grantedWorkspaceRoots = new Set<string>();

    const result = await runAgent(toCloneableIpcValue(request), {
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
      }
    });

    return toCloneableIpcValue(result);
  });
  ipcMain.handle("gordon:command-workshop:list", async () => listCommandWorkshopSessions());
  ipcMain.handle("gordon:command-workshop:upsert", async (_event, session) => upsertCommandWorkshopSession(session));
  ipcMain.handle("gordon:command-workshop:delete", async (_event, sessionId: string) =>
    deleteCommandWorkshopSession(sessionId)
  );
  ipcMain.handle("gordon:workflow-library:upsert", async (_event, item) => upsertWorkflowLibraryItem(item));
  ipcMain.handle("gordon:workflow-library:run-record", async (_event, record) => runWorkflowRecord(record));
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

  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
