const { contextBridge, ipcRenderer } = require("electron");

let progressListenerIdSeed = 0;
const agentRunProgressListeners = new Map();

function toPlainIpcData(value) {
  const visited = new WeakSet();

  function normalize(input) {
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
        stack: input.stack || ""
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

    const output = {};

    for (const [key, entryValue] of Object.entries(input)) {
      output[key] = normalize(entryValue);
    }

    return output;
  }

  return normalize(value);
}

contextBridge.exposeInMainWorld("gordonDesktop", {
  bootstrap: () => ipcRenderer.invoke("gordon:bootstrap"),
  listModelSettings: () => ipcRenderer.invoke("gordon:model-settings:list"),
  upsertModelProfile: (profile) => ipcRenderer.invoke("gordon:model-settings:upsert", profile),
  activateModelProfile: (profileId) => ipcRenderer.invoke("gordon:model-settings:activate", profileId),
  toggleModelProfileStatus: (profileId) => ipcRenderer.invoke("gordon:model-settings:toggle-status", profileId),
  deleteModelProfile: (profileId) => ipcRenderer.invoke("gordon:model-settings:delete", profileId),
  invokeModelText: (request) => ipcRenderer.invoke("gordon:model:invoke-text", request),
  queryModelBalance: (request) => ipcRenderer.invoke("gordon:model:query-balance", request),
  listSkillDefinitions: () => ipcRenderer.invoke("gordon:skills:list"),
  upsertSkillDefinition: (skill) => ipcRenderer.invoke("gordon:skills:upsert", skill),
  importSkillDefinitionFromGithub: (request) => ipcRenderer.invoke("gordon:skills:import-from-github", request),
  toggleSkillDefinitionStatus: (skillId) => ipcRenderer.invoke("gordon:skills:toggle-status", skillId),
  deleteSkillDefinition: (skillId) => ipcRenderer.invoke("gordon:skills:delete", skillId),
  listMcpServers: () => ipcRenderer.invoke("gordon:mcp-servers:list"),
  upsertMcpServer: (server) => ipcRenderer.invoke("gordon:mcp-servers:upsert", server),
  toggleMcpServerStatus: (serverId) => ipcRenderer.invoke("gordon:mcp-servers:toggle-status", serverId),
  deleteMcpServer: (serverId) => ipcRenderer.invoke("gordon:mcp-servers:delete", serverId),
  listMcpServerTools: (serverId) => ipcRenderer.invoke("gordon:mcp-servers:list-tools", serverId),
  callMcpServerTool: (request) => ipcRenderer.invoke("gordon:mcp-servers:call-tool", request),
  listAgentProfiles: () => ipcRenderer.invoke("gordon:agent-profiles:list"),
  upsertAgentProfile: (profile) => ipcRenderer.invoke("gordon:agent-profiles:upsert", profile),
  toggleAgentProfileStatus: (profileId) => ipcRenderer.invoke("gordon:agent-profiles:toggle-status", profileId),
  deleteAgentProfile: (profileId) => ipcRenderer.invoke("gordon:agent-profiles:delete", profileId),
  runAgent: (request) => ipcRenderer.invoke("gordon:agent:run", toPlainIpcData(request)),
  onAgentRunProgress: (listener) => {
    const listenerId = `agent_progress_listener_${Date.now()}_${progressListenerIdSeed++}`;
    const wrapped = (_event, payload) => listener(payload);
    agentRunProgressListeners.set(listenerId, wrapped);
    ipcRenderer.on("gordon:agent:progress", wrapped);
    return listenerId;
  },
  offAgentRunProgress: (listenerId) => {
    const wrapped = agentRunProgressListeners.get(listenerId);

    if (!wrapped) {
      return;
    }

    ipcRenderer.removeListener("gordon:agent:progress", wrapped);
    agentRunProgressListeners.delete(listenerId);
  },
  listCommandWorkshopSessions: () => ipcRenderer.invoke("gordon:command-workshop:list"),
  upsertCommandWorkshopSession: (session) => ipcRenderer.invoke("gordon:command-workshop:upsert", toPlainIpcData(session)),
  deleteCommandWorkshopSession: (sessionId) => ipcRenderer.invoke("gordon:command-workshop:delete", sessionId),
  upsertWorkflowLibraryItem: (item) => ipcRenderer.invoke("gordon:workflow-library:upsert", toPlainIpcData(item)),
  runWorkflowRecord: (record) => ipcRenderer.invoke("gordon:workflow-library:run-record", toPlainIpcData(record)),
  listWeeklyProgress: () => ipcRenderer.invoke("gordon:weekly-progress:list"),
  saveWeeklyProgress: (record) => ipcRenderer.invoke("gordon:weekly-progress:save", record),
  deleteWeeklyProgress: (recordId) => ipcRenderer.invoke("gordon:weekly-progress:delete", recordId),
  rewriteWeeklyProgressItem: (request) => ipcRenderer.invoke("gordon:weekly-progress:rewrite", request),
  generateDailyProgressReport: (request) => ipcRenderer.invoke("gordon:weekly-progress:generate-daily-report", request),
  generateWeeklyProgressReport: (request) => ipcRenderer.invoke("gordon:weekly-progress:generate-report", request)
});
