import { contextBridge, ipcRenderer } from "electron";

import type {
  AgentProfile,
  ComicProjectExportRequest,
  ComicProjectExportResult,
  ComicProject,
  CommandWorkshopMessageExportRequest,
  CommandWorkshopMessageExportResult,
  ModelBalanceHistoryEntry,
  ModelBalanceQueryRequest,
  ModelBalanceSnapshot,
  AgentRunProgressEvent,
  AgentRunRequest,
  ApplicationCoverImageSaveRequest,
  ApplicationCoverImageSaveResult,
  CommandWorkshopSession,
  DailyReportGenerateRequest,
  FinanceBriefQuoteRequest,
  FinanceBriefSnapshot,
  GithubSkillImportRequest,
  InfoRadarRefreshResult,
  McpToolCallRequest,
  McpServerConfig,
  McpToolDefinition,
  MusicProjectExportRequest,
  MusicProjectExportResult,
  MusicProject,
  ModelProfile,
  ModelTextRequest,
  PerformanceReportGenerateRequest,
  VideoProject,
  VideoProjectExportRequest,
  VideoProjectExportResult,
  ToolConfig,
  WritingBookExportRequest,
  WritingBookExportResult,
  WritingBookSaveOptions,
  SkillDefinition,
  WorkflowLibraryItem,
  WeeklyDailyReportFeishuSendRequest,
  WeeklyDailyReportFeishuSendResult,
  WeeklyFeishuSettings,
  WritingBook,
  WeeklyProgressRecord,
  WeeklyProgressRewriteRequest,
  WeeklyReportGenerateRequest
} from "../../../packages/shared/src/index.js";

let progressListenerIdSeed = 0;
const agentRunProgressListeners = new Map<string, (_event: Electron.IpcRendererEvent, payload: AgentRunProgressEvent) => void>();
const workflowRunProgressListeners = new Map<string, (_event: Electron.IpcRendererEvent, payload: unknown) => void>();
const infoRadarReaderListeners = new Map<string, (_event: Electron.IpcRendererEvent, payload: unknown) => void>();
const liveStreamViewListeners = new Map<string, (_event: Electron.IpcRendererEvent, payload: unknown) => void>();

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
  readPromptAssets: (promptIds: string[]): Promise<Record<string, string>> =>
    ipcRenderer.invoke("gordon:prompt-assets:read", promptIds),
  listModelSettings: () => ipcRenderer.invoke("gordon:model-settings:list"),
  upsertModelProfile: (profile: ModelProfile) => ipcRenderer.invoke("gordon:model-settings:upsert", toPlainIpcData(profile)),
  activateModelProfile: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:activate", profileId),
  toggleModelProfileStatus: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:toggle-status", profileId),
  deleteModelProfile: (profileId: string) => ipcRenderer.invoke("gordon:model-settings:delete", profileId),
  reorderModelProfiles: (profileIds: string[]) => ipcRenderer.invoke("gordon:model-settings:reorder", profileIds),
  invokeModelText: (request: ModelTextRequest) => ipcRenderer.invoke("gordon:model:invoke-text", request),
  cancelModelText: (requestId: string) => ipcRenderer.invoke("gordon:model:cancel-text", requestId),
  queryModelBalance: (request: ModelBalanceQueryRequest): Promise<ModelBalanceSnapshot> =>
    ipcRenderer.invoke("gordon:model:query-balance", toPlainIpcData(request)),
  listModelBalanceHistory: (profileId?: string): Promise<ModelBalanceHistoryEntry[]> =>
    ipcRenderer.invoke("gordon:model:balance-history", profileId),
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
  listToolConfigs: (): Promise<ToolConfig[]> => ipcRenderer.invoke("gordon:tool-configs:list"),
  upsertToolConfig: (config: ToolConfig): Promise<ToolConfig[]> =>
    ipcRenderer.invoke("gordon:tool-configs:upsert", toPlainIpcData(config)),
  toggleToolConfigStatus: (configId: string): Promise<ToolConfig[]> =>
    ipcRenderer.invoke("gordon:tool-configs:toggle-status", configId),
  listAgentProfiles: () => ipcRenderer.invoke("gordon:agent-profiles:list"),
  upsertAgentProfile: (profile: AgentProfile) => ipcRenderer.invoke("gordon:agent-profiles:upsert", profile),
  toggleAgentProfileStatus: (profileId: string) => ipcRenderer.invoke("gordon:agent-profiles:toggle-status", profileId),
  deleteAgentProfile: (profileId: string) => ipcRenderer.invoke("gordon:agent-profiles:delete", profileId),
  runAgent: (request: AgentRunRequest) => ipcRenderer.invoke("gordon:agent:run", toPlainIpcData(request)),
  addAgentRunGuidance: (progressEventId: string, guidance: string) =>
    ipcRenderer.invoke("gordon:agent:add-guidance", progressEventId, guidance),
  cancelAgentRun: (progressEventId: string) => ipcRenderer.invoke("gordon:agent:cancel-run", progressEventId),
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
  exportCommandWorkshopMessage: (
    request: CommandWorkshopMessageExportRequest
  ): Promise<CommandWorkshopMessageExportResult | null> =>
    ipcRenderer.invoke("gordon:command-workshop:export-message", toPlainIpcData(request)),
  upsertWorkflowLibraryItem: (item: WorkflowLibraryItem): Promise<WorkflowLibraryItem[]> =>
    ipcRenderer.invoke("gordon:workflow-library:upsert", toPlainIpcData(item)),
  runWorkflowRecord: (record: WorkflowLibraryItem["records"][number]) =>
    ipcRenderer.invoke("gordon:workflow-library:run-record", toPlainIpcData(record)),
  cancelWorkflowRecordRun: (progressEventId: string) =>
    ipcRenderer.invoke("gordon:workflow-library:cancel-run", progressEventId),
  refreshInfoRadarWindow: (request: { cardId: string; windowId: string }): Promise<InfoRadarRefreshResult> =>
    ipcRenderer.invoke("gordon:workflow-library:refresh-info-window", toPlainIpcData(request)),
  queryFinanceBriefQuote: (
    request: FinanceBriefQuoteRequest
  ): Promise<{ card: WorkflowLibraryItem; snapshot: FinanceBriefSnapshot }> =>
    ipcRenderer.invoke("gordon:workflow-library:query-finance-quote", toPlainIpcData(request)),
  resolveInfoRadarWechatItemUrl: (request: { cardId: string; windowId: string; itemId: string }) =>
    ipcRenderer.invoke("gordon:workflow-library:resolve-wechat-item-url", toPlainIpcData(request)),
  openExternalUrl: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("gordon:workflow-library:open-external-url", url),
  openInfoRadarReader: (request: { url: string; bounds: { x: number; y: number; width: number; height: number } }) =>
    ipcRenderer.invoke("gordon:workflow-library:info-reader:open", toPlainIpcData(request)),
  setInfoRadarReaderBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke("gordon:workflow-library:info-reader:set-bounds", toPlainIpcData(bounds)),
  closeInfoRadarReader: () => ipcRenderer.invoke("gordon:workflow-library:info-reader:close"),
  openLiveStreamView: (request: { url: string; bounds: { x: number; y: number; width: number; height: number } }) =>
    ipcRenderer.invoke("gordon:workflow-library:live-stream:open", toPlainIpcData(request)),
  setLiveStreamViewBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke("gordon:workflow-library:live-stream:set-bounds", toPlainIpcData(bounds)),
  closeLiveStreamView: () => ipcRenderer.invoke("gordon:workflow-library:live-stream:close"),
  onLiveStreamViewEvent: (listener: (payload: unknown) => void): string => {
    const listenerId = `live_stream_listener_${Date.now()}_${progressListenerIdSeed++}`;
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    liveStreamViewListeners.set(listenerId, wrapped);
    ipcRenderer.on("gordon:workflow-library:live-stream", wrapped);
    return listenerId;
  },
  offLiveStreamViewEvent: (listenerId: string): void => {
    const wrapped = liveStreamViewListeners.get(listenerId);

    if (!wrapped) {
      return;
    }

    ipcRenderer.removeListener("gordon:workflow-library:live-stream", wrapped);
    liveStreamViewListeners.delete(listenerId);
  },
  onInfoRadarReaderEvent: (listener: (payload: unknown) => void): string => {
    const listenerId = `info_reader_listener_${Date.now()}_${progressListenerIdSeed++}`;
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    infoRadarReaderListeners.set(listenerId, wrapped);
    ipcRenderer.on("gordon:workflow-library:info-reader", wrapped);
    return listenerId;
  },
  offInfoRadarReaderEvent: (listenerId: string): void => {
    const wrapped = infoRadarReaderListeners.get(listenerId);

    if (!wrapped) {
      return;
    }

    ipcRenderer.removeListener("gordon:workflow-library:info-reader", wrapped);
    infoRadarReaderListeners.delete(listenerId);
  },
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
  deleteComicProject: (projectId: string): Promise<ComicProject[]> =>
    ipcRenderer.invoke("gordon:comic-projects:delete", projectId),
  selectComicProjectExportDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:comic-projects:select-export-directory"),
  exportComicProject: (request: ComicProjectExportRequest): Promise<ComicProjectExportResult> =>
    ipcRenderer.invoke("gordon:comic-projects:export", toPlainIpcData(request)),
  listVideoProjects: (): Promise<VideoProject[]> => ipcRenderer.invoke("gordon:video-projects:list"),
  upsertVideoProject: (project: VideoProject): Promise<VideoProject[]> =>
    ipcRenderer.invoke("gordon:video-projects:upsert", toPlainIpcData(project)),
  deleteVideoProject: (projectId: string): Promise<VideoProject[]> =>
    ipcRenderer.invoke("gordon:video-projects:delete", projectId),
  listMusicProjects: (): Promise<MusicProject[]> => ipcRenderer.invoke("gordon:music-projects:list"),
  upsertMusicProject: (project: MusicProject): Promise<MusicProject[]> =>
    ipcRenderer.invoke("gordon:music-projects:upsert", toPlainIpcData(project)),
  deleteMusicProject: (projectId: string): Promise<MusicProject[]> =>
    ipcRenderer.invoke("gordon:music-projects:delete", projectId),
  selectMusicProjectExportDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:music-projects:select-export-directory"),
  exportMusicProject: (request: MusicProjectExportRequest): Promise<MusicProjectExportResult> =>
    ipcRenderer.invoke("gordon:music-projects:export", toPlainIpcData(request)),
  selectVideoProjectExportDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:video-projects:select-export-directory"),
  exportVideoProject: (request: VideoProjectExportRequest): Promise<VideoProjectExportResult> =>
    ipcRenderer.invoke("gordon:video-projects:export", toPlainIpcData(request)),
  listWritingBooks: (): Promise<WritingBook[]> => ipcRenderer.invoke("gordon:writing-books:list"),
  saveWritingBook: (book: WritingBook, options?: WritingBookSaveOptions): Promise<WritingBook[]> =>
    ipcRenderer.invoke("gordon:writing-books:save", toPlainIpcData(book), toPlainIpcData(options ?? {})),
  deleteWritingBook: (bookId: string): Promise<WritingBook[]> =>
    ipcRenderer.invoke("gordon:writing-books:delete", bookId),
  selectWritingBookExportDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:writing-books:select-export-directory"),
  selectApplicationCoverImage: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:application-cover:select-image"),
  saveApplicationCoverImage: (
    request: ApplicationCoverImageSaveRequest
  ): Promise<ApplicationCoverImageSaveResult | null> =>
    ipcRenderer.invoke("gordon:application-cover:save-image", toPlainIpcData(request)),
  selectWritingBookCoverImage: (): Promise<string | null> =>
    ipcRenderer.invoke("gordon:application-cover:select-image"),
  saveWritingBookCoverImage: (
    request: ApplicationCoverImageSaveRequest
  ): Promise<ApplicationCoverImageSaveResult | null> =>
    ipcRenderer.invoke("gordon:application-cover:save-image", toPlainIpcData(request)),
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
    ipcRenderer.invoke("gordon:weekly-progress:generate-report", request),
  generatePerformanceProgressReport: (request: PerformanceReportGenerateRequest) =>
    ipcRenderer.invoke("gordon:weekly-progress:generate-performance-report", request),
  getWeeklyFeishuSettings: (): Promise<WeeklyFeishuSettings> =>
    ipcRenderer.invoke("gordon:weekly-progress:feishu-settings:get"),
  saveWeeklyFeishuSettings: (settings: WeeklyFeishuSettings): Promise<WeeklyFeishuSettings> =>
    ipcRenderer.invoke("gordon:weekly-progress:feishu-settings:save", toPlainIpcData(settings)),
  sendWeeklyDailyReportToFeishu: (
    request: WeeklyDailyReportFeishuSendRequest
  ): Promise<WeeklyDailyReportFeishuSendResult> =>
    ipcRenderer.invoke("gordon:weekly-progress:send-daily-report-to-feishu", toPlainIpcData(request))
});
