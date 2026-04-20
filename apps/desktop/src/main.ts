import { app, BrowserWindow, ipcMain, screen } from "electron";
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
  upsertMcpServer,
  upsertModelProfile,
  upsertSkillDefinition
} from "../../../packages/workbench/src/index.js";
import { generateWeeklyProgressReport, invokeActiveModel, rewriteWeeklyProgressItem } from "./ai.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

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
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true
    }
  });

  await window.loadFile(path.join(currentDir, "renderer", "index.html"));
}

app.whenReady().then(async () => {
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
  ipcMain.handle("gordon:agent:run", async (_event, request) => runAgent(request));
  ipcMain.handle("gordon:command-workshop:list", async () => listCommandWorkshopSessions());
  ipcMain.handle("gordon:command-workshop:upsert", async (_event, session) => upsertCommandWorkshopSession(session));
  ipcMain.handle("gordon:command-workshop:delete", async (_event, sessionId: string) =>
    deleteCommandWorkshopSession(sessionId)
  );
  ipcMain.handle("gordon:weekly-progress:list", async () => listWeeklyProgress());
  ipcMain.handle("gordon:weekly-progress:save", async (_event, record) => saveWeeklyProgress(record));
  ipcMain.handle("gordon:weekly-progress:delete", async (_event, recordId: string) => deleteWeeklyProgress(recordId));
  ipcMain.handle("gordon:weekly-progress:rewrite", async (_event, request) => rewriteWeeklyProgressItem(request));
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
