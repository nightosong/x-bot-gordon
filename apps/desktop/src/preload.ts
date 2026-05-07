import { contextBridge, ipcRenderer } from "electron";

import type {
  AgentProfile,
  ComicProject,
  ModelBalanceQueryRequest,
  ModelBalanceSnapshot,
  AgentRunProgressEvent,
  AgentRunRequest,
  CommandWorkshopSession,
  DailyReportGenerateRequest,
  GithubSkillImportRequest,
  McpToolCallRequest,
  McpServerConfig,
  McpToolDefinition,
  ModelProfile,
  ModelTextRequest,
  WritingBookExportRequest,
  WritingBookExportResult,
  WritingBookSaveOptions,
  SkillDefinition,
  WorkflowLibraryItem,
  WritingBook,
  WeeklyProgressRecord,
  WeeklyProgressRewriteRequest,
  WeeklyReportGenerateRequest
} from "../../../packages/shared/src/index.js";

let progressListenerIdSeed = 0;
const agentRunProgressListeners = new Map<string, (_event: Electron.IpcRendererEvent, payload: AgentRunProgressEvent) => void>();
const workflowRunProgressListeners = new Map<string, (_event: Electron.IpcRendererEvent, payload: unknown) => void>();

function toPlainIpcData<T>(value: T): T {
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

contextBridge.exposeInMainWorld("gordonDesktop", {
  bootstrap: () => ipcRenderer.invoke("gordon:bootstrap"),
  listModelSettings: () => ipcRenderer.invoke("gordon:model-settings:list"),
  upsertModelProfile: (profile: ModelProfile) => ipcRenderer.invoke("gordon:model-settings:upsert", profile),
  activateModelProfile: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:activate", profileId),
  toggleModelProfileStatus: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:toggle-status", profileId),
  deleteModelProfile: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:delete", profileId),
  invokeModelText: (request: ModelTextRequest) => ipcRenderer.invoke("gordon:model:invoke-text", request),
  cancelModelText: (requestId: string) => ipcRenderer.invoke("gordon:model:cancel-text", requestId),
  queryModelBalance: (request: ModelBalanceQueryRequest): Promise<ModelBalanceSnapshot> =>
    ipcRenderer.invoke("gordon:model:query-balance", request),
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
  runAgent: (request: AgentRunRequest) => ipcRenderer.invoke("gordon:agent:run", toPlainIpcData(request)),
  onAgentRunProgress: (listener: (payload: AgentRunProgressEvent) => void): string => {
    const listenerId = `agent_progress_listener_${Date.now()}_${progressListenerIdSeed++}`;
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AgentRunProgressEvent) => listener(payload);
    agentRunProgressListeners.set(listenerId, wrapped);
    ipcRenderer.on("gordon:agent:progress", wrapped);
    return listenerId;
  },
  offAgentRunProgress: (listenerId: string): void => {
    const wrapped = agentRunProgressListeners.get(listenerId);

    if (!wrapped) {
      return;
    }

    ipcRenderer.removeListener("gordon:agent:progress", wrapped);
    agentRunProgressListeners.delete(listenerId);
  },
  listCommandWorkshopSessions: (): Promise<CommandWorkshopSession[]> => ipcRenderer.invoke("gordon:command-workshop:list"),
  selectCommandWorkshopAttachments: () => ipcRenderer.invoke("gordon:command-workshop:select-attachments"),
  upsertCommandWorkshopSession: (session: CommandWorkshopSession): Promise<CommandWorkshopSession[]> =>
    ipcRenderer.invoke("gordon:command-workshop:upsert", toPlainIpcData(session)),
  deleteCommandWorkshopSession: (sessionId: string): Promise<CommandWorkshopSession[]> =>
    ipcRenderer.invoke("gordon:command-workshop:delete", sessionId),
  upsertWorkflowLibraryItem: (item: WorkflowLibraryItem): Promise<WorkflowLibraryItem[]> =>
    ipcRenderer.invoke("gordon:workflow-library:upsert", toPlainIpcData(item)),
  runWorkflowRecord: (record: WorkflowLibraryItem["records"][number]) =>
    ipcRenderer.invoke("gordon:workflow-library:run-record", toPlainIpcData(record)),
  cancelWorkflowRecordRun: (progressEventId: string) =>
    ipcRenderer.invoke("gordon:workflow-library:cancel-run", progressEventId),
  onWorkflowRunProgress: (listener: (payload: unknown) => void): string => {
    const listenerId = `workflow_progress_listener_${Date.now()}_${progressListenerIdSeed++}`;
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    workflowRunProgressListeners.set(listenerId, wrapped);
    ipcRenderer.on("gordon:workflow-library:progress", wrapped);
    return listenerId;
  },
  offWorkflowRunProgress: (listenerId: string): void => {
    const wrapped = workflowRunProgressListeners.get(listenerId);

    if (!wrapped) {
      return;
    }

    ipcRenderer.removeListener("gordon:workflow-library:progress", wrapped);
    workflowRunProgressListeners.delete(listenerId);
  },
  listComicProjects: (): Promise<ComicProject[]> => ipcRenderer.invoke("gordon:comic-projects:list"),
  upsertComicProject: (project: ComicProject): Promise<ComicProject[]> =>
    ipcRenderer.invoke("gordon:comic-projects:upsert", toPlainIpcData(project)),
  listWritingBooks: (): Promise<WritingBook[]> => ipcRenderer.invoke("gordon:writing-books:list"),
  saveWritingBook: (book: WritingBook, options?: WritingBookSaveOptions): Promise<WritingBook[]> =>
    ipcRenderer.invoke("gordon:writing-books:save", toPlainIpcData(book), toPlainIpcData(options ?? {})),
  selectWritingBookExportDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:writing-books:select-export-directory"),
  exportWritingBook: (request: WritingBookExportRequest): Promise<WritingBookExportResult> =>
    ipcRenderer.invoke("gordon:writing-books:export", toPlainIpcData(request)),
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
