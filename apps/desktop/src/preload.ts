import { contextBridge, ipcRenderer } from "electron";

import type {
  AgentProfile,
  AgentRunRequest,
  CommandWorkshopSession,
  DailyReportGenerateRequest,
  GithubSkillImportRequest,
  McpToolCallRequest,
  McpServerConfig,
  McpToolDefinition,
  ModelProfile,
  ModelTextRequest,
  SkillDefinition,
  WeeklyProgressRecord,
  WeeklyProgressRewriteRequest,
  WeeklyReportGenerateRequest
} from "../../../packages/shared/src/index.js";

contextBridge.exposeInMainWorld("gordonDesktop", {
  bootstrap: () => ipcRenderer.invoke("gordon:bootstrap"),
  listModelSettings: () => ipcRenderer.invoke("gordon:model-settings:list"),
  upsertModelProfile: (profile: ModelProfile) => ipcRenderer.invoke("gordon:model-settings:upsert", profile),
  activateModelProfile: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:activate", profileId),
  toggleModelProfileStatus: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:toggle-status", profileId),
  deleteModelProfile: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:delete", profileId),
  invokeModelText: (request: ModelTextRequest) => ipcRenderer.invoke("gordon:model:invoke-text", request),
  listSkillDefinitions: () => ipcRenderer.invoke("gordon:skills:list"),
  upsertSkillDefinition: (skill: SkillDefinition) => ipcRenderer.invoke("gordon:skills:upsert", skill),
  importSkillDefinitionFromGithub: (request: GithubSkillImportRequest) =>
    ipcRenderer.invoke("gordon:skills:import-from-github", request),
  toggleSkillDefinitionStatus: (skillId: string) => ipcRenderer.invoke("gordon:skills:toggle-status", skillId),
  deleteSkillDefinition: (skillId: string) => ipcRenderer.invoke("gordon:skills:delete", skillId),
  listMcpServers: () => ipcRenderer.invoke("gordon:mcp-servers:list"),
  upsertMcpServer: (server: McpServerConfig) => ipcRenderer.invoke("gordon:mcp-servers:upsert", server),
  toggleMcpServerStatus: (serverId: string) => ipcRenderer.invoke("gordon:mcp-servers:toggle-status", serverId),
  deleteMcpServer: (serverId: string) => ipcRenderer.invoke("gordon:mcp-servers:delete", serverId),
  listMcpServerTools: (serverId: string): Promise<McpToolDefinition[]> =>
    ipcRenderer.invoke("gordon:mcp-servers:list-tools", serverId),
  callMcpServerTool: (request: McpToolCallRequest) => ipcRenderer.invoke("gordon:mcp-servers:call-tool", request),
  listAgentProfiles: () => ipcRenderer.invoke("gordon:agent-profiles:list"),
  upsertAgentProfile: (profile: AgentProfile) => ipcRenderer.invoke("gordon:agent-profiles:upsert", profile),
  toggleAgentProfileStatus: (profileId: string) => ipcRenderer.invoke("gordon:agent-profiles:toggle-status", profileId),
  deleteAgentProfile: (profileId: string) => ipcRenderer.invoke("gordon:agent-profiles:delete", profileId),
  runAgent: (request: AgentRunRequest) => ipcRenderer.invoke("gordon:agent:run", request),
  listCommandWorkshopSessions: (): Promise<CommandWorkshopSession[]> => ipcRenderer.invoke("gordon:command-workshop:list"),
  upsertCommandWorkshopSession: (session: CommandWorkshopSession): Promise<CommandWorkshopSession[]> =>
    ipcRenderer.invoke("gordon:command-workshop:upsert", session),
  deleteCommandWorkshopSession: (sessionId: string): Promise<CommandWorkshopSession[]> =>
    ipcRenderer.invoke("gordon:command-workshop:delete", sessionId),
  listWeeklyProgress: () => ipcRenderer.invoke("gordon:weekly-progress:list"),
  saveWeeklyProgress: (record: WeeklyProgressRecord) => ipcRenderer.invoke("gordon:weekly-progress:save", record),
  deleteWeeklyProgress: (recordId: string) => ipcRenderer.invoke("gordon:weekly-progress:delete", recordId),
  rewriteWeeklyProgressItem: (request: WeeklyProgressRewriteRequest) =>
    ipcRenderer.invoke("gordon:weekly-progress:rewrite", request),
  generateDailyProgressReport: (request: DailyReportGenerateRequest) =>
    ipcRenderer.invoke("gordon:weekly-progress:generate-daily-report", request),
  generateWeeklyProgressReport: (request: WeeklyReportGenerateRequest) =>
    ipcRenderer.invoke("gordon:weekly-progress:generate-report", request)
});
