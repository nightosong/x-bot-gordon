import { app, BrowserWindow, ipcMain, nativeImage, screen } from "electron";
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
  ipcMain.handle("gordon:agent:run", async (event, request) =>
    runAgent(request, {
      onProgress: (payload: AgentRunProgressEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("gordon:agent:progress", payload);
        }
      }
    })
  );
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
