import { Application } from "./vendor/spline-runtime/runtime.js";

const LOCAL_SPLINE_SCENE = "./assets/spline-backups/home-robot-scene.splinecode";

const FEATURE_ENTRIES = [
  {
    id: "home",
    kicker: "Home",
    title: "首页",
    description: "",
    meta: [],
    badge: "",
    tier: "flat"
  },
  {
    id: "marketplace",
    kicker: "Market",
    title: "应用广场",
    description: "预留应用发现、工具接入和能力分发区域。",
    meta: ["功能预留"],
    badge: "待补充",
    tier: "wide"
  },
  {
    id: "tasks",
    kicker: "Tasks",
    title: "任务推进",
    description: "按周维护项目树、任务状态与阶段结果，并生成更像真实汇报的周报。",
    meta: ["结构化周报", "AI 增强"],
    badge: "已接通",
    tier: "default"
  },
  {
    id: "efficiency",
    kicker: "Efficiency",
    title: "效率工具",
    description: "预留日报生成、文案改写和常用辅助能力区域。",
    meta: ["功能预留"],
    badge: "待补充",
    tier: "wide"
  },
  {
    id: "command-workshop",
    kicker: "Command",
    title: "命令工坊",
    description: "承接多轮对话、Agent 选择、MCP 调用与执行链路回看的一体化 chat 工作台。",
    meta: ["Chat 工作台", "Agent / MCP"],
    badge: "已接通",
    tier: "default"
  }
];

const PROVIDER_META = {
  openai: {
    label: "OpenAI",
    short: "OA",
    logoPath: "./assets/logos/openai.svg",
    copy: "适合官方模型接入，支持 GPT 系列与多模态能力。",
    popularModels: ["gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini"]
  },
  google: {
    label: "Google",
    short: "GG",
    logoPath: "./assets/logos/google.svg",
    copy: "适合 Gemini 系列模型与后续项目级配置。",
    popularModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"]
  },
  anthropic: {
    label: "Anthropic",
    short: "AN",
    logoPath: "./assets/logos/anthropic.svg",
    copy: "适合 Claude 系列模型与长上下文工作流。",
    popularModels: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"]
  },
  openai_like: {
    label: "OpenAI-like",
    short: "CL",
    copy: "适合接入自定义网关或兼容 OpenAI 协议的市面模型。",
    popularModels: ["deepseek-chat", "kimi-k2", "qwen-max", "doubao-pro"]
  }
};

const PROVIDER_ORDER = ["openai", "google", "anthropic", "openai_like"];
const MODEL_MANAGEMENT_FEATURE = "model-management";
const TASKS_FEATURE = "tasks";
const COMMAND_WORKSHOP_FEATURE = "command-workshop";
const EXTENSIONS_MANAGEMENT_FEATURE = "extensions-management";
const EDITOR_INDENT = "    ";
const WEEKLY_PROGRESS_PAGE_SIZE = 5;
const WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE = "未命名项目";
const BUILTIN_WORKBENCH_ID_PREFIX = "builtin:";
const BUILTIN_GORDON_AGENT_ID = "builtin:agent:gordon";
const WEEKLY_PROGRESS_STATUS_META = {
  planned: {
    label: "待开始",
    tone: "planned"
  },
  in_progress: {
    label: "进行中",
    tone: "in-progress"
  },
  completed: {
    label: "已完成",
    tone: "completed"
  },
  blocked: {
    label: "受阻",
    tone: "blocked"
  }
};

const state = {
  activeFeature: "home",
  snapshot: null,
  modelSettings: {
    profiles: [],
    activeProfileId: null
  },
  weeklyProgress: [],
  activeWeeklyProgressId: null,
  weeklyProgressEditor: createWeeklyProgressEditorState(),
  tasksView: "list",
  editor: createEditorState("openai"),
  modelManagementView: "list",
  skillDefinitions: [],
  mcpServers: [],
  agentProfiles: [],
  agentRunLogs: [],
  extensionsView: "list",
  extensionsEditor: createExtensionsEditorState("agent"),
  agentRunner: createAgentRunnerState(),
  commandWorkshop: createCommandWorkshopState()
};

const robotRuntimeState = {
  app: null,
  canvas: null,
  resizeObserver: null,
  loadToken: 0
};

function getDesktopApi() {
  return window.gordonDesktop ?? null;
}

function byId(id) {
  return document.getElementById(id);
}

function getHomeSettingsMenu() {
  const menu = byId("home-settings-menu");
  return menu instanceof HTMLDetailsElement ? menu : null;
}

function isHomeSettingsFeature(featureId) {
  return featureId === MODEL_MANAGEMENT_FEATURE || featureId === EXTENSIONS_MANAGEMENT_FEATURE;
}

function closeHomeSettingsMenu() {
  const menu = getHomeSettingsMenu();

  if (menu) {
    menu.open = false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function copyTextToClipboard(value) {
  const text = String(value ?? "");

  if (!text) {
    throw new Error("没有可复制的内容");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("当前环境不支持剪贴板复制");
  }
}

function renderCards(target, items, renderItem) {
  target.innerHTML = items.map(renderItem).join("");
}

function createEditorState(provider, profile = null) {
  return {
    mode: profile ? "edit" : "create",
    profileId: profile?.id ?? null,
    provider,
    values: {
      displayName: profile?.displayName ?? "",
      model: profile?.model ?? "",
      apiKey: profile?.apiKey ?? "",
      baseUrl: profile?.baseUrl ?? "",
      organization: profile?.organization ?? "",
      project: profile?.project ?? "",
      location: profile?.location ?? "",
      notes: profile?.notes ?? ""
    }
  };
}

function createExtensionsEditorState(kind, entry = null) {
  if (kind === "skill") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        promptTemplate: entry?.promptTemplate ?? "",
        handlerRef: entry?.handlerRef ?? ""
      }
    };
  }

  if (kind === "skill-import") {
    return {
      kind,
      mode: "create",
      entryId: null,
      values: {
        repo: "",
        ref: "main",
        path: ""
      }
    };
  }

  if (kind === "mcp") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        transport: entry?.transport ?? "stdio",
        command: entry?.command ?? "",
        url: entry?.url ?? "",
        envText: stringifyEnvRecord(entry?.env ?? {}),
        toolAllowlist: (entry?.toolAllowlist ?? []).join(", ")
      }
    };
  }

  return {
    kind: "agent",
    mode: entry ? "edit" : "create",
    entryId: entry?.id ?? null,
    values: {
      name: entry?.name ?? "",
      description: entry?.description ?? "",
      mode: entry?.mode ?? "task",
      modelProfileId: entry?.modelProfileId ?? "",
      systemPrompt: entry?.systemPrompt ?? "",
      allowedSkillIds: [...(entry?.allowedSkillIds ?? [])],
      allowedMcpServerIds: [...(entry?.allowedMcpServerIds ?? [])]
    }
  };
}

function createAgentRunnerState(agentId = null) {
  return {
    agentId,
    skillId: "",
    autoSelectMcp: false,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}",
    availableMcpTools: [],
    userInput: "",
    result: null,
    isRunning: false
  };
}

function createCommandWorkshopDraft(agentProfileId = "") {
  return {
    agentProfileId,
    skillId: "",
    autoSelectMcp: true,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}"
  };
}

function createCommandWorkshopState() {
  return {
    sessions: [],
    activeSessionId: null,
    view: "list",
    composerView: "input",
    draft: createCommandWorkshopDraft(),
    draftInput: "",
    availableMcpTools: [],
    isRunning: false
  };
}

function createWeeklyDraftId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeWeeklyProgressItemStatus(status) {
  return Object.prototype.hasOwnProperty.call(WEEKLY_PROGRESS_STATUS_META, status) ? status : "planned";
}

function createWeeklyTaskDraft(task = null) {
  return {
    id: task?.id ?? createWeeklyDraftId("weekly_task"),
    title: task?.title ?? "",
    detail: task?.detail ?? "",
    status: normalizeWeeklyProgressItemStatus(task?.status ?? "planned")
  };
}

function createWeeklyProjectDraft(project = null) {
  return {
    id: project?.id ?? createWeeklyDraftId("weekly_project"),
    title: project?.title ?? "",
    note: project?.note ?? "",
    status: normalizeWeeklyProgressItemStatus(project?.status ?? "in_progress"),
    tasks: Array.isArray(project?.tasks) ? project.tasks.map((task) => createWeeklyTaskDraft(task)) : []
  };
}

function cloneWeeklyProgressRecord(record = null) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    content: String(record.content ?? ""),
    reportTemplate: String(record.reportTemplate ?? ""),
    generatedReport: String(record.generatedReport ?? ""),
    projects: Array.isArray(record.projects) ? record.projects.map((project) => createWeeklyProjectDraft(project)) : []
  };
}

function createWeeklyProgressEditorState(record = null) {
  return {
    recordId: record?.id ?? null,
    draft: cloneWeeklyProgressRecord(record),
    collapsedProjectIds: []
  };
}

function normalizeTagList(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyEnvRecord(record) {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseEnvText(rawValue) {
  return String(rawValue ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((result, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        return result;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key) {
        result[key] = value;
      }

      return result;
    }, {});
}

function sortWeeklyProgressRecords(records) {
  return [...(records ?? [])].sort(
    (left, right) => right.weekKey.localeCompare(left.weekKey) || right.updatedAt.localeCompare(left.updatedAt)
  );
}

function syncWeeklyProgressSelection(records) {
  state.weeklyProgress = sortWeeklyProgressRecords(records);

  if (!state.weeklyProgress.length) {
    state.activeWeeklyProgressId = null;
    state.weeklyProgressEditor = createWeeklyProgressEditorState();
    return;
  }

  if (state.weeklyProgress.some((record) => record.id === state.activeWeeklyProgressId)) {
    const refreshedRecord = state.weeklyProgress.find((record) => record.id === state.weeklyProgressEditor.recordId) ?? null;

    if (refreshedRecord && state.tasksView === "editor") {
      setWeeklyProgressEditorRecord(refreshedRecord);
    }

    return;
  }

  state.activeWeeklyProgressId = state.weeklyProgress.find((record) => record.status === "active")?.id ?? state.weeklyProgress[0].id;

  if (state.tasksView === "editor") {
    setWeeklyProgressEditorRecord(getActiveWeeklyProgressRecord());
  }
}

function getActiveWeeklyProgressRecord() {
  if (!state.weeklyProgress.length) {
    return null;
  }

  return (
    state.weeklyProgress.find((record) => record.id === state.activeWeeklyProgressId) ??
    state.weeklyProgress.find((record) => record.status === "active") ??
    state.weeklyProgress[0]
  );
}

function getActiveModelProfile() {
  return state.modelSettings.profiles.find((profile) => profile.id === state.modelSettings.activeProfileId) ?? null;
}

function syncExtensionsState(snapshot) {
  state.skillDefinitions = [...(snapshot?.skillDefinitions ?? [])];
  state.mcpServers = [...(snapshot?.mcpServers ?? [])];
  state.agentProfiles = [...(snapshot?.agentProfiles ?? [])];
  state.agentRunLogs = [...(snapshot?.agentRunLogs ?? [])];
}

function sortCommandWorkshopSessions(sessions) {
  return [...(sessions ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function getEnabledAgentProfiles() {
  return state.agentProfiles.filter((profile) => profile.enabled);
}

function isBuiltinWorkbenchItem(entryId) {
  return String(entryId ?? "").startsWith(BUILTIN_WORKBENCH_ID_PREFIX);
}

function getPreferredCommandWorkshopAgent(configuredAgentId = "") {
  const enabledAgents = getEnabledAgentProfiles();

  return (
    enabledAgents.find((profile) => profile.id === String(configuredAgentId ?? "").trim()) ??
    enabledAgents.find((profile) => profile.id === BUILTIN_GORDON_AGENT_ID) ??
    enabledAgents[0] ??
    null
  );
}

function getAuthorizedMcpServersForAgent(agentId) {
  const agent = getAgentProfileById(agentId);

  if (!agent) {
    return [];
  }

  return state.mcpServers.filter((server) => agent.allowedMcpServerIds.includes(server.id) && server.enabled);
}

function normalizeCommandWorkshopConfig(config = {}) {
  const selectedAgent = getPreferredCommandWorkshopAgent(config.agentProfileId);
  const agentProfileId = selectedAgent?.id ?? "";
  const skillIdCandidate = String(config.skillId ?? "").trim();
  const mcpServerIdCandidate = String(config.mcpServerId ?? "").trim();
  const mcpToolNameCandidate = String(config.mcpToolName ?? "").trim();
  const runnableSkills = selectedAgent ? getAgentRunnableSkills(selectedAgent.id) : [];
  const authorizedServers = selectedAgent ? getAuthorizedMcpServersForAgent(selectedAgent.id) : [];

  const hasAuthorizedServer = authorizedServers.some((server) => server.id === mcpServerIdCandidate);

  return {
    agentProfileId,
    skillId: runnableSkills.some((skill) => skill.id === skillIdCandidate) ? skillIdCandidate : "",
    autoSelectMcp: config.autoSelectMcp !== false,
    mcpServerId: hasAuthorizedServer ? mcpServerIdCandidate : "",
    mcpToolName: hasAuthorizedServer ? mcpToolNameCandidate : "",
    mcpArgumentsText: String(config.mcpArgumentsText ?? "{}").trim() || "{}"
  };
}

function normalizeCommandWorkshopSession(session) {
  const config = normalizeCommandWorkshopConfig(session);

  return {
    ...session,
    ...config,
    messages: [...(session?.messages ?? [])]
  };
}

function syncCommandWorkshopState(sessions) {
  state.commandWorkshop.sessions = sortCommandWorkshopSessions((sessions ?? []).map((session) => normalizeCommandWorkshopSession(session)));

  if (
    state.commandWorkshop.activeSessionId &&
    !state.commandWorkshop.sessions.some((session) => session.id === state.commandWorkshop.activeSessionId)
  ) {
    state.commandWorkshop.activeSessionId = null;
  }

  state.commandWorkshop.draft = normalizeCommandWorkshopConfig(state.commandWorkshop.draft);
  state.commandWorkshop.availableMcpTools = [];
}

function getActiveCommandWorkshopSession() {
  if (!state.commandWorkshop.activeSessionId) {
    return null;
  }

  return state.commandWorkshop.sessions.find((session) => session.id === state.commandWorkshop.activeSessionId) ?? null;
}

function getCommandWorkshopFormState() {
  return getActiveCommandWorkshopSession() ?? state.commandWorkshop.draft;
}

function normalizeCommandWorkshopText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function truncateCommandWorkshopText(value, maxLength) {
  const compact = normalizeCommandWorkshopText(value);

  if (!compact) {
    return "";
  }

  const chars = Array.from(compact);

  return chars.length > maxLength ? `${chars.slice(0, maxLength).join("")}...` : compact;
}

function buildCommandWorkshopTitle(userInput) {
  const compact = normalizeCommandWorkshopText(userInput);

  if (!compact) {
    return "新对话";
  }

  return truncateCommandWorkshopText(compact, 22);
}

function summarizeCommandWorkshopContent(content) {
  const compact = normalizeCommandWorkshopText(content);

  if (!compact) {
    return "等待输入";
  }

  return truncateCommandWorkshopText(compact, 72);
}

function formatInlineCommandWorkshopText(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="command-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function getCommandWorkshopCodeFamily(languageLabel = "") {
  const normalized = String(languageLabel ?? "").trim().toLowerCase();

  if (!normalized) {
    return "text";
  }

  if (["ts", "tsx", "js", "jsx", "javascript", "typescript", "mjs", "cjs"].includes(normalized)) {
    return "javascript";
  }

  if (["json", "jsonc"].includes(normalized)) {
    return "json";
  }

  if (["sh", "bash", "zsh", "shell"].includes(normalized)) {
    return "shell";
  }

  if (["py", "python"].includes(normalized)) {
    return "python";
  }

  if (["diff", "patch"].includes(normalized)) {
    return "diff";
  }

  if (["html", "xml", "svg"].includes(normalized)) {
    return "markup";
  }

  if (["css", "scss", "less"].includes(normalized)) {
    return "css";
  }

  return "text";
}

function renderCommandWorkshopCodeToken(content, className) {
  return `<span class="${className}">${escapeHtml(content)}</span>`;
}

function tokenizeCommandWorkshopCodeLine(line, patterns) {
  let cursor = 0;
  let html = "";

  while (cursor < line.length) {
    const slice = line.slice(cursor);
    let matched = false;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(slice);

      if (!match) {
        continue;
      }

      html += renderCommandWorkshopCodeToken(match[0], pattern.className);
      cursor += match[0].length;
      matched = true;
      break;
    }

    if (!matched) {
      html += escapeHtml(line[cursor]);
      cursor += 1;
    }
  }

  return html;
}

function getCommandWorkshopCodePatterns(family) {
  if (family === "javascript") {
    return [
      { regex: /^(?:\/\/.*)/, className: "command-code-token-comment" },
      { regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/, className: "command-code-token-string" },
      { regex: /^(?:\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|await|async|try|catch|finally|throw|import|from|export|default|class|extends|implements|interface|type|public|private|protected|static|yield|in|of|null|undefined|true|false)\b)/, className: "command-code-token-keyword" },
      { regex: /^(?:\b(?:number|string|boolean|object|unknown|never|void|any)\b)/, className: "command-code-token-type" },
      { regex: /^(?:0x[\da-fA-F]+|\b\d+(?:\.\d+)?\b)/, className: "command-code-token-number" },
      { regex: /^(?:[A-Za-z_$][\w$]*)(?=\s*\()/, className: "command-code-token-function" }
    ];
  }

  if (family === "json") {
    return [
      { regex: /^(?:"(?:\\.|[^"\\])*")(?=\s*:)/, className: "command-code-token-key" },
      { regex: /^(?:"(?:\\.|[^"\\])*")/, className: "command-code-token-string" },
      { regex: /^(?:\b(?:true|false|null)\b)/, className: "command-code-token-keyword" },
      { regex: /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/, className: "command-code-token-number" }
    ];
  }

  if (family === "shell") {
    return [
      { regex: /^(?:#.*)/, className: "command-code-token-comment" },
      { regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, className: "command-code-token-string" },
      { regex: /^(?:\$[A-Za-z_][\w]*)/, className: "command-code-token-variable" },
      { regex: /^(?:--?[A-Za-z0-9][\w-]*)/, className: "command-code-token-flag" },
      { regex: /^(?:\b(?:if|then|else|fi|for|do|done|case|esac|function|export)\b)/, className: "command-code-token-keyword" },
      { regex: /^(?:\b(?:npm|pnpm|yarn|node|git|cat|sed|rg|ls|cd|cp|mv|rm|mkdir|curl)\b)/, className: "command-code-token-command" }
    ];
  }

  if (family === "python") {
    return [
      { regex: /^(?:#.*)/, className: "command-code-token-comment" },
      { regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, className: "command-code-token-string" },
      { regex: /^(?:\b(?:def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|pass|raise|yield|async|await|True|False|None)\b)/, className: "command-code-token-keyword" },
      { regex: /^(?:\b\d+(?:\.\d+)?\b)/, className: "command-code-token-number" },
      { regex: /^(?:[A-Za-z_][\w]*)(?=\s*\()/, className: "command-code-token-function" }
    ];
  }

  if (family === "markup") {
    return [
      { regex: /^(?:<!--.*?-->)/, className: "command-code-token-comment" },
      { regex: /^(?:<\/?[A-Za-z][\w:-]*)/, className: "command-code-token-keyword" },
      { regex: /^(?:[A-Za-z_:][\w:.-]*)(?==)/, className: "command-code-token-key" },
      { regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, className: "command-code-token-string" }
    ];
  }

  if (family === "css") {
    return [
      { regex: /^(?:\/\*.*\*\/)/, className: "command-code-token-comment" },
      { regex: /^(?:[.#]?[A-Za-z][\w-]*)(?=\s*\{)/, className: "command-code-token-keyword" },
      { regex: /^(?:[A-Za-z-]+)(?=\s*:)/, className: "command-code-token-key" },
      { regex: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, className: "command-code-token-string" },
      { regex: /^(?:#(?:[\da-fA-F]{3}|[\da-fA-F]{6})|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?\b)/, className: "command-code-token-number" }
    ];
  }

  return [];
}

function getCommandWorkshopCodeLineState(line, family) {
  if (family !== "diff") {
    return "";
  }

  if (line.startsWith("+++ ") || line.startsWith("--- ")) {
    return "meta";
  }

  if (line.startsWith("@@")) {
    return "hunk";
  }

  if (line.startsWith("+")) {
    return "added";
  }

  if (line.startsWith("-")) {
    return "removed";
  }

  return "";
}

function renderCommandWorkshopHighlightedCodeLine(line, languageLabel = "") {
  const family = getCommandWorkshopCodeFamily(languageLabel);

  if (family === "diff") {
    const prefix = line.slice(0, 1);
    const content = line.slice(1);

    if (["+", "-", "@"].includes(prefix)) {
      return `${renderCommandWorkshopCodeToken(prefix, "command-code-token-diff-symbol")}${escapeHtml(content)}`;
    }

    return escapeHtml(line);
  }

  const patterns = getCommandWorkshopCodePatterns(family);

  if (!patterns.length) {
    return escapeHtml(line);
  }

  return tokenizeCommandWorkshopCodeLine(line, patterns);
}

function renderCommandWorkshopCodeBlock(code, languageLabel = "") {
  const safeLanguage = escapeHtml(languageLabel || "text");
  const lines = String(code ?? "").split("\n");
  const family = getCommandWorkshopCodeFamily(languageLabel);
  const renderedLines = lines
    .map((line, index) => {
      const lineState = getCommandWorkshopCodeLineState(line, family);
      const content = line.length ? renderCommandWorkshopHighlightedCodeLine(line, languageLabel) : "&nbsp;";

      return `
        <div class="command-code-line ${lineState ? `is-${lineState}` : ""}">
          <span class="command-code-line-number">${index + 1}</span>
          <span class="command-code-line-content">${content}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="command-code-block">
      <div class="command-code-head">
        <span class="command-code-language">${safeLanguage}</span>
        <button type="button" class="command-code-copy" data-command-copy-code="true">复制代码</button>
      </div>
      <pre class="command-code-pre"><code>${renderedLines}</code></pre>
    </div>
  `;
}

function renderCommandWorkshopRichText(content) {
  const normalized = String(content ?? "").replace(/\r\n?/g, "\n");

  if (!normalized.trim()) {
    return '<p class="command-rich-paragraph">暂无内容</p>';
  }

  const lines = normalized.split("\n");
  const blocks = [];
  let index = 0;

  const isCodeFenceLine = (line) => /^```/.test(line.trim());
  const isHeadingLine = (line) => /^(#{1,3})\s+/.test(line);
  const isQuoteLine = (line) => /^>\s?/.test(line);
  const isUnorderedListLine = (line) => /^[-*+]\s+/.test(line);
  const isOrderedListLine = (line) => /^\d+\.\s+/.test(line);
  const isBoundaryLine = (line) =>
    !line.trim() || isCodeFenceLine(line) || isHeadingLine(line) || isQuoteLine(line) || isUnorderedListLine(line) || isOrderedListLine(line);

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (isCodeFenceLine(line)) {
      const match = line.trim().match(/^```([\w-]+)?/);
      const languageLabel = match?.[1] ?? "";
      const codeLines = [];
      index += 1;

      while (index < lines.length && !isCodeFenceLine(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && isCodeFenceLine(lines[index])) {
        index += 1;
      }

      blocks.push(renderCommandWorkshopCodeBlock(codeLines.join("\n"), languageLabel));
      continue;
    }

    if (isHeadingLine(line)) {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      const depth = match?.[1]?.length ?? 1;
      const tagName = `h${Math.min(depth + 2, 6)}`;
      blocks.push(`<${tagName} class="command-rich-heading">${formatInlineCommandWorkshopText(match?.[2] ?? line)}</${tagName}>`);
      index += 1;
      continue;
    }

    if (isQuoteLine(line)) {
      const quoteLines = [];

      while (index < lines.length && isQuoteLine(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(`<blockquote class="command-rich-quote">${quoteLines.map((item) => formatInlineCommandWorkshopText(item)).join("<br />")}</blockquote>`);
      continue;
    }

    if (isUnorderedListLine(line) || isOrderedListLine(line)) {
      const isOrdered = isOrderedListLine(line);
      const tagName = isOrdered ? "ol" : "ul";
      const items = [];

      while (
        index < lines.length &&
        lines[index].trim() &&
        (isOrdered ? isOrderedListLine(lines[index]) : isUnorderedListLine(lines[index]))
      ) {
        const itemText = lines[index].replace(isOrdered ? /^\d+\.\s+/ : /^[-*+]\s+/, "");
        items.push(`<li>${formatInlineCommandWorkshopText(itemText)}</li>`);
        index += 1;
      }

      blocks.push(`<${tagName} class="command-rich-list">${items.join("")}</${tagName}>`);
      continue;
    }

    const paragraphLines = [];

    while (index < lines.length && !isBoundaryLine(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(`<p class="command-rich-paragraph">${paragraphLines.map((item) => formatInlineCommandWorkshopText(item)).join("<br />")}</p>`);
  }

  return blocks.join("");
}

function getModelLabelForProfileId(modelProfileId) {
  return state.modelSettings.profiles.find((profile) => profile.id === modelProfileId)?.displayName ?? "未绑定模型";
}

function getModelLabelForAgent(agent) {
  return getModelLabelForProfileId(agent?.modelProfileId);
}

function getCommandWorkshopModeLabel(config) {
  if (!config?.skillId) {
    return "默认策略";
  }

  return getSkillDefinitionById(config.skillId)?.name ?? "指定 Skill";
}

function getCommandWorkshopToolModeLabel(config) {
  if (config?.mcpServerId && config?.mcpToolName) {
    const serverName = getMcpServerById(config.mcpServerId)?.name ?? "指定 MCP";
    return `${serverName} / ${config.mcpToolName}`;
  }

  return config?.autoSelectMcp ? "自动工具" : "纯对话";
}

function getCommandWorkshopSettingsSummary(config) {
  const selectedAgent = getAgentProfileById(config?.agentProfileId);

  return [
    selectedAgent?.name ?? "Gordon",
    getModelLabelForAgent(selectedAgent),
    getCommandWorkshopModeLabel(config),
    getCommandWorkshopToolModeLabel(config)
  ].join(" / ");
}

function getCommandWorkshopPresetPrompts() {
  return [
    "先快速浏览这个仓库，告诉我当前项目结构和建议的切入点。",
    "帮我定位一个问题，按根因、修改点、验证方式给出结论。",
    "按需求实现功能，先列最小步骤，再继续往下做。",
    "帮我 review 这块改动，按风险高低输出结论。"
  ];
}

function renderCommandWorkshopPromptDeck() {
  return `
    <div class="command-prompt-grid">
      ${getCommandWorkshopPresetPrompts()
        .map(
          (prompt) => `
            <button
              type="button"
              class="command-prompt-chip"
              data-command-prompt="${escapeHtml(prompt)}"
            >
              ${escapeHtml(prompt)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCommandWorkshopAgentCard(config) {
  const selectedAgent = getAgentProfileById(config?.agentProfileId);
  const modelLabel = getModelLabelForAgent(selectedAgent);
  const modeLabel = getCommandWorkshopModeLabel(config);
  const toolModeLabel = getCommandWorkshopToolModeLabel(config);
  const capabilityLabels = ["读仓库上下文", "实现与修改代码", config?.autoSelectMcp ? "需要时自动调工具" : "当前纯对话"];

  return `
    <section class="command-agent-card">
      <div class="command-agent-main">
        ${renderExtensionAvatar(selectedAgent?.name ?? "Gordon", "extension-avatar-agent")}
        <div class="command-agent-copy">
          <p class="command-agent-title">${escapeHtml(selectedAgent?.name ?? "Gordon")}</p>
          <p class="command-agent-description">
            ${escapeHtml(
              selectedAgent?.modelProfileId
                ? "默认围绕当前仓库协作，优先先看上下文，再给可执行结果。"
                : "先在模型管理里设置优先模型，默认 Agent 才能开始工作。"
            )}
          </p>
        </div>
      </div>

      <div class="command-agent-meta">
        <span class="pill pill-neutral">${escapeHtml(modelLabel)}</span>
        <span class="pill pill-neutral">${escapeHtml(modeLabel)}</span>
        <span class="pill pill-neutral">${escapeHtml(toolModeLabel)}</span>
      </div>

      <div class="command-agent-capabilities">
        ${capabilityLabels
          .map((label) => `<span class="command-agent-capability">${escapeHtml(label)}</span>`)
          .join("")}
      </div>
    </section>
  `;
}

function buildCommandWorkshopArtifact(runLog) {
  return {
    profileLabel: runLog.profileLabel,
    model: runLog.model,
    skillName: runLog.skillName ?? null,
    autoSelectedMcp: runLog.autoSelectedMcp,
    mcpServerName: runLog.mcpServerName ?? null,
    mcpToolName: runLog.mcpToolName ?? null,
    mcpResultText: runLog.mcpResultText,
    mcpCalls: [...(runLog.mcpCalls ?? [])],
    ...(runLog.stopReason ? { stopReason: runLog.stopReason } : {}),
    steps: [...(runLog.steps ?? [])],
    createdAt: runLog.createdAt
  };
}

function getExtensionInitials(value) {
  const compact = String(value ?? "").trim();

  if (!compact) {
    return "EX";
  }

  return compact
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.slice(0, 1).toUpperCase())
    .join("");
}

function renderExtensionAvatar(label, accentClass = "") {
  const className = ["provider-avatar", "extension-avatar", accentClass].filter(Boolean).join(" ");
  return `<div class="${className}" aria-hidden="true">${escapeHtml(getExtensionInitials(label))}</div>`;
}

function getSkillDefinitionById(skillId) {
  return state.skillDefinitions.find((skill) => skill.id === skillId) ?? null;
}

function getSkillSourceLabel(skill) {
  if (isBuiltinWorkbenchItem(skill?.id)) {
    return "内置";
  }

  if (skill?.source?.type === "github") {
    return "GitHub";
  }

  return skill?.source?.localPath?.trim() ? "本地 Skill" : "手工定义";
}

function getSkillSourceDetail(skill) {
  if (skill?.source?.type === "github") {
    const repo = skill.source.repo ?? "";
    const ref = skill.source.ref ?? "";
    const skillPath = skill.source.path ?? "";
    return [repo, ref ? `@${ref}` : "", skillPath].filter(Boolean).join(" ");
  }

  return skill?.handlerRef?.trim() || "";
}

function getSkillLocalMirrorDetail(skill) {
  return skill?.source?.localPath?.trim() || "";
}

const SKILL_DISPLAY_NAME_MAP = {
  plan: "任务拆解",
  code: "代码助手",
  review: "问题审查",
  "karpathy-guidelines": "Karpathy 准则",
  "self-improvement": "自我改进",
  "deep-research": "深度研究"
};

function getSkillDisplayName(skillOrName) {
  const rawName = typeof skillOrName === "string" ? skillOrName : String(skillOrName?.name ?? "");
  return SKILL_DISPLAY_NAME_MAP[rawName] ?? rawName;
}

function getSkillOptionLabel(skill) {
  const rawName = String(skill?.name ?? "");
  const displayName = getSkillDisplayName(rawName);
  return displayName && displayName !== rawName ? `${displayName} / ${rawName}` : rawName;
}

function getMcpServerById(serverId) {
  return state.mcpServers.find((server) => server.id === serverId) ?? null;
}

function getAgentProfileById(agentId) {
  return state.agentProfiles.find((profile) => profile.id === agentId) ?? null;
}

function getAgentRunnableSkills(agentId) {
  const agent = getAgentProfileById(agentId);

  if (!agent) {
    return [];
  }

  return state.skillDefinitions.filter((skill) => agent.allowedSkillIds.includes(skill.id) && skill.enabled);
}

function getRecentAgentRunLogs(agentId, limit = 5) {
  return state.agentRunLogs.filter((log) => log.agentProfileId === agentId).slice(0, limit);
}

function formatLocalDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function getWeeklyProgressStatusMeta(status) {
  return WEEKLY_PROGRESS_STATUS_META[normalizeWeeklyProgressItemStatus(status)] ?? WEEKLY_PROGRESS_STATUS_META.planned;
}

function getWeeklyProgressEditorDraft() {
  const activeRecord = getActiveWeeklyProgressRecord();

  if (!activeRecord) {
    return null;
  }

  if (state.weeklyProgressEditor.recordId !== activeRecord.id || !state.weeklyProgressEditor.draft) {
    state.weeklyProgressEditor = createWeeklyProgressEditorState(activeRecord);
  }

  return state.weeklyProgressEditor.draft;
}

function setWeeklyProgressEditorRecord(record) {
  state.weeklyProgressEditor = createWeeklyProgressEditorState(record);
}

function isWeeklyProjectCollapsed(projectId) {
  return state.weeklyProgressEditor.collapsedProjectIds.includes(projectId);
}

function toggleWeeklyProjectCollapsed(projectId) {
  if (isWeeklyProjectCollapsed(projectId)) {
    state.weeklyProgressEditor.collapsedProjectIds = state.weeklyProgressEditor.collapsedProjectIds.filter((id) => id !== projectId);
    return;
  }

  state.weeklyProgressEditor.collapsedProjectIds = [...state.weeklyProgressEditor.collapsedProjectIds, projectId];
}

function findWeeklyProjectById(draft, projectId) {
  return draft?.projects?.find((project) => project.id === projectId) ?? null;
}

function findWeeklyTaskById(draft, projectId, taskId) {
  return findWeeklyProjectById(draft, projectId)?.tasks?.find((task) => task.id === taskId) ?? null;
}

function getWeeklyProgressMetrics(record) {
  const projects = Array.isArray(record?.projects) ? record.projects : [];
  const metrics = {
    projectCount: 0,
    taskCount: 0,
    completedTaskCount: 0,
    activeTaskCount: 0,
    blockedTaskCount: 0,
    noteCount: 0
  };

  for (const project of projects) {
    const hasProjectContent = project.title?.trim() || project.note?.trim() || project.tasks?.length;

    if (!hasProjectContent) {
      continue;
    }

    metrics.projectCount += 1;

    if (project.note?.trim()) {
      metrics.noteCount += 1;
    }

    for (const task of project.tasks ?? []) {
      const hasTaskContent = task.title?.trim() || task.detail?.trim();

      if (!hasTaskContent) {
        continue;
      }

      metrics.taskCount += 1;

      if (task.status === "completed") {
        metrics.completedTaskCount += 1;
      } else if (task.status === "blocked") {
        metrics.blockedTaskCount += 1;
      } else if (task.status === "in_progress") {
        metrics.activeTaskCount += 1;
      }
    }
  }

  return metrics;
}

function getWeeklyProgressSummaryText(record) {
  const metrics = getWeeklyProgressMetrics(record);

  if (!metrics.projectCount && !metrics.taskCount && !metrics.noteCount) {
    return "还没有拆出本周项目，适合直接按项目维度补齐。";
  }

  const summaryParts = [`${metrics.projectCount} 个项目`, `${metrics.taskCount} 个任务`, `完成 ${metrics.completedTaskCount} 个`];

  if (metrics.activeTaskCount) {
    summaryParts.push(`进行中 ${metrics.activeTaskCount} 个`);
  }

  if (metrics.blockedTaskCount) {
    summaryParts.push(`受阻 ${metrics.blockedTaskCount} 个`);
  }

  return summaryParts.join(" / ");
}

function sanitizeWeeklyTaskDraft(task) {
  if (!task) {
    return null;
  }

  const title = String(task.title ?? "").trim();
  const detail = String(task.detail ?? "").trim();

  if (!title && !detail) {
    return null;
  }

  return {
    ...task,
    title: title || detail || "未命名任务",
    detail,
    status: normalizeWeeklyProgressItemStatus(task.status)
  };
}

function sanitizeWeeklyProjectDraft(project) {
  if (!project) {
    return null;
  }

  const title = String(project.title ?? "").trim();
  const note = String(project.note ?? "").trim();
  const tasks = Array.isArray(project.tasks)
    ? project.tasks.map((task) => sanitizeWeeklyTaskDraft(task)).filter(Boolean)
    : [];

  if (!title && !note && !tasks.length) {
    return null;
  }

  return {
    ...project,
    title: title || WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE,
    note,
    status: normalizeWeeklyProgressItemStatus(project.status),
    tasks
  };
}

function serializeWeeklyProgressProjects(projects) {
  return (Array.isArray(projects) ? projects : [])
    .map((project) => sanitizeWeeklyProjectDraft(project))
    .filter(Boolean)
    .map((project) => {
      const projectStatus = getWeeklyProgressStatusMeta(project.status).label;
      const lines = [`${project.title}（${projectStatus}）`];

      if (project.note) {
        lines.push(...project.note.split("\n").map((line) => `    备注：${line.trim()}`));
      }

      for (const task of project.tasks) {
        const taskStatus = getWeeklyProgressStatusMeta(task.status).label;
        lines.push(`    [${taskStatus}] ${task.title}`);

        if (task.detail) {
          lines.push(...task.detail.split("\n").map((line) => `        说明：${line.trim()}`));
        }
      }

      return lines.join("\n");
    })
    .join("\n\n")
    .trim();
}

function sanitizeWeeklyProgressDraft(record) {
  if (!record) {
    return null;
  }

  const projects = Array.isArray(record.projects)
    ? record.projects.map((project) => sanitizeWeeklyProjectDraft(project)).filter(Boolean)
    : [];
  const content = serializeWeeklyProgressProjects(projects);

  return {
    ...record,
    reportTemplate: String(record.reportTemplate ?? "").trim(),
    generatedReport: String(record.generatedReport ?? "").trim(),
    projects,
    content
  };
}

function syncWeeklyProgressDraftField(target) {
  const draft = getWeeklyProgressEditorDraft();

  if (!draft) {
    return false;
  }

  const recordField = target.getAttribute("data-weekly-record-field");

  if (recordField) {
    draft[recordField] = target.value;
    return true;
  }

  const projectId = target.getAttribute("data-weekly-project-id");
  const projectField = target.getAttribute("data-weekly-project-field");

  if (projectId && projectField) {
    const project = findWeeklyProjectById(draft, projectId);

    if (project) {
      project[projectField] = target.value;
      return true;
    }
  }

  const taskProjectId = target.getAttribute("data-weekly-task-project-id");
  const taskId = target.getAttribute("data-weekly-task-id");
  const taskField = target.getAttribute("data-weekly-task-field");

  if (taskProjectId && taskId && taskField) {
    const task = findWeeklyTaskById(draft, taskProjectId, taskId);

    if (task) {
      task[taskField] = target.value;
      return true;
    }
  }

  return false;
}

function addWeeklyProject() {
  const draft = getWeeklyProgressEditorDraft();

  if (!draft) {
    return;
  }

  draft.projects.push(createWeeklyProjectDraft());
  renderApp();
}

function removeWeeklyProject(projectId) {
  const draft = getWeeklyProgressEditorDraft();

  if (!draft) {
    return;
  }

  draft.projects = draft.projects.filter((project) => project.id !== projectId);
  state.weeklyProgressEditor.collapsedProjectIds = state.weeklyProgressEditor.collapsedProjectIds.filter((id) => id !== projectId);
  renderApp();
}

function addWeeklyTask(projectId) {
  const draft = getWeeklyProgressEditorDraft();
  const project = findWeeklyProjectById(draft, projectId);

  if (!project) {
    return;
  }

  project.tasks.push(createWeeklyTaskDraft());
  state.weeklyProgressEditor.collapsedProjectIds = state.weeklyProgressEditor.collapsedProjectIds.filter((id) => id !== projectId);
  renderApp();
}

function removeWeeklyTask(projectId, taskId) {
  const draft = getWeeklyProgressEditorDraft();
  const project = findWeeklyProjectById(draft, projectId);

  if (!project) {
    return;
  }

  project.tasks = project.tasks.filter((task) => task.id !== taskId);
  renderApp();
}

async function rewriteWeeklyProgressValue(selectedText, applyResult, loadingText, successText) {
  const desktopApi = getDesktopApi();
  const draft = getWeeklyProgressEditorDraft();

  if (!desktopApi || !draft) {
    updateLoadState("当前周报编辑器尚未就绪，暂无法润色", true);
    return;
  }

  if (!selectedText.trim()) {
    updateLoadState("先补充内容，再使用润色能力", true);
    return;
  }

  try {
    updateLoadState(loadingText);
    const result = await desktopApi.rewriteWeeklyProgressItem({
      selectedText,
      fullContent: serializeWeeklyProgressProjects(draft.projects),
      weekTitle: draft.title
    });

    applyResult(result.text);
    updateLoadState(successText);
    renderApp();
  } catch (error) {
    console.error("Failed to rewrite weekly progress field", error);
    updateLoadState(`润色失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

function getProviderMeta(provider) {
  return PROVIDER_META[provider] ?? {
    label: provider,
    short: provider.slice(0, 2).toUpperCase(),
    logoPath: "",
    copy: "",
    popularModels: []
  };
}

function renderProviderAvatar(provider, extraClass = "") {
  const meta = getProviderMeta(provider);
  const className = ["provider-avatar", meta.logoPath ? "has-logo" : "", extraClass].filter(Boolean).join(" ");

  if (meta.logoPath) {
    return `
      <div class="${className}" aria-hidden="true">
        <img
          class="provider-avatar-image"
          src="${escapeHtml(meta.logoPath)}"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
    `;
  }

  return `<div class="${className}" aria-hidden="true">${escapeHtml(meta.short)}</div>`;
}

function renderActionIcon(kind) {
  if (kind === "edit") {
    return `
      <svg viewBox="0 0 20 20" class="action-icon" aria-hidden="true">
        <path d="M13.9 3.1a2.1 2.1 0 0 1 3 3l-8.6 8.6-3.8.8.8-3.8 8.6-8.6Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
        <path d="m12.6 4.4 3 3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
      </svg>
    `;
  }

  if (kind === "play") {
    return `
      <svg viewBox="0 0 20 20" class="action-icon" aria-hidden="true">
        <path d="M7 5.5 14.5 10 7 14.5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
      </svg>
    `;
  }

  if (kind === "gear") {
    return `
      <svg viewBox="0 0 20 20" class="action-icon" aria-hidden="true">
        <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M10 2.7v2.1M10 15.2v2.1M17.3 10h-2.1M4.8 10H2.7M15.2 4.8l-1.5 1.5M6.3 13.7l-1.5 1.5M15.2 15.2l-1.5-1.5M6.3 6.3 4.8 4.8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" />
      </svg>
    `;
  }

  if (kind === "enter") {
    return `
      <svg viewBox="0 0 20 20" class="action-icon" aria-hidden="true">
        <path d="M15.5 4.5v4.2a3 3 0 0 1-3 3H5.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
        <path d="m8.4 8.7-3.2 3.2 3.2 3.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 20 20" class="action-icon" aria-hidden="true">
      <path d="M4.5 5.5h11" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" />
      <path d="M7.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
      <path d="m6.2 5.5.7 9.2a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.7-9.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
      <path d="M8.5 8.5v4.2M11.5 8.5v4.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" />
    </svg>
  `;
}

function getProviderOptions(providers) {
  const map = new Map((providers ?? []).map((provider) => [provider.kind, provider]));

  return PROVIDER_ORDER.map((kind) => {
    const provider = map.get(kind);
    const meta = getProviderMeta(kind);

    return {
      kind,
      label: meta.label,
      short: meta.short,
      copy: provider?.notes ?? meta.copy,
      popularModels: meta.popularModels
    };
  });
}

function getProviderLabel(provider) {
  return getProviderMeta(provider).label;
}

function getProviderFields(provider) {
  const commonFields = [
    { key: "displayName", label: "配置名称", placeholder: "例如：OpenAI 主账号", required: true, full: false },
    { key: "model", label: "模型名称", placeholder: "例如：gpt-4.1", required: true, full: false },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", required: true, full: true }
  ];

  if (provider === "openai") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: false },
      { key: "organization", label: "Organization", placeholder: "可选", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "google") {
    return [
      ...commonFields,
      { key: "project", label: "Project", placeholder: "例如：gordon-prod", required: false, full: false },
      { key: "location", label: "Location", placeholder: "例如：us-central1", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "anthropic") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  return [
    ...commonFields,
    { key: "baseUrl", label: "Base URL", placeholder: "自定义网关地址", required: true, full: false },
    { key: "notes", label: "备注", placeholder: "例如：DeepSeek / Kimi / Qwen / Doubao", required: false, full: true, textarea: true }
  ];
}

function renderFeatureBoard(entries, activeId) {
  renderCards(
    byId("feature-board"),
    entries,
    (entry, index) => {
      const graffitiText = escapeHtml(entry.kicker);

      if (entry.tier === "flat") {
        return `
          <article
            class="feature-card tilt-card feature-card-flat ${entry.id === activeId ? "is-active" : ""}"
            data-select-feature="${escapeHtml(entry.id)}"
            data-graffiti="${graffitiText}"
            role="button"
            tabindex="0"
            aria-label="查看${escapeHtml(entry.title)}"
          >
            <span class="feature-graffiti" aria-hidden="true" data-text="${graffitiText}"></span>
            <div class="feature-card-flat-row">
              <div>
                <p class="feature-kicker">${escapeHtml(entry.kicker)}</p>
                <p class="feature-title">${escapeHtml(entry.title)}</p>
              </div>
            </div>
          </article>
        `;
      }

      const alignmentClass = index % 2 === 1 ? "feature-card-align-right" : "feature-card-align-left";

      return `
        <article
          class="feature-card tilt-card feature-card-${escapeHtml(entry.tier)} ${alignmentClass} ${entry.id === activeId ? "is-active" : ""}"
          data-select-feature="${escapeHtml(entry.id)}"
          data-graffiti="${graffitiText}"
          role="button"
          tabindex="0"
          aria-label="查看${escapeHtml(entry.title)}"
        >
          <span class="feature-graffiti" aria-hidden="true" data-text="${graffitiText}"></span>
          <p class="feature-kicker">${escapeHtml(entry.kicker)}</p>
          <p class="feature-title">${escapeHtml(entry.title)}</p>
        </article>
      `;
    }
  );
}

function renderRobotWorkspace() {
  return `
    <div class="workspace-stage robot-stage">
      <div class="robot-frame">
        <canvas id="home-robot-canvas" class="robot-canvas" aria-label="Gordon robot"></canvas>
      </div>
    </div>
  `;
}

function disposeRobotRuntime() {
  robotRuntimeState.loadToken += 1;

  if (robotRuntimeState.resizeObserver) {
    robotRuntimeState.resizeObserver.disconnect();
    robotRuntimeState.resizeObserver = null;
  }

  if (robotRuntimeState.app) {
    robotRuntimeState.app.dispose();
    robotRuntimeState.app = null;
  }

  robotRuntimeState.canvas = null;
}

async function syncRobotRuntime() {
  if (state.activeFeature !== "home") {
    disposeRobotRuntime();
    return;
  }

  const canvas = byId("home-robot-canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    disposeRobotRuntime();
    return;
  }

  if (robotRuntimeState.canvas === canvas && robotRuntimeState.app) {
    return;
  }

  disposeRobotRuntime();

  const token = robotRuntimeState.loadToken;
  const app = new Application(canvas, {
    renderMode: "continuous"
  });

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    app.setSize(width, height);
  };

  robotRuntimeState.app = app;
  robotRuntimeState.canvas = canvas;
  robotRuntimeState.resizeObserver = new ResizeObserver(resize);
  robotRuntimeState.resizeObserver.observe(canvas);
  resize();

  try {
    await app.load(new URL(LOCAL_SPLINE_SCENE, window.location.href).toString());

    if (token !== robotRuntimeState.loadToken) {
      app.dispose();
    }
  } catch (error) {
    console.error("Failed to load Gordon robot scene", error);

    if (token === robotRuntimeState.loadToken) {
      updateLoadState("机器人场景加载失败", true);
    }
  }
}

function renderPlaceholderWorkspace(title, description) {
  return `
    <div class="workspace-stage workspace-stage-scroll">
      <article class="placeholder-card">
        <div>
          <p class="feature-kicker">Coming Soon</p>
          <p class="placeholder-title">${escapeHtml(title)}</p>
          <p class="models-copy">${escapeHtml(description)}</p>
        </div>
      </article>
    </div>
  `;
}

function renderConfiguredProfiles(modelSettings) {
  if (!modelSettings.profiles.length) {
    return `
      <div class="model-empty">
        <p class="model-empty-copy">当前还没有任何已配置模型。先在右侧选择供应商并保存一条配置，之后就能在这里启用或编辑。</p>
      </div>
    `;
  }

  return modelSettings.profiles
    .map((profile) => {
      const meta = getProviderMeta(profile.provider);
      const isActive = modelSettings.activeProfileId === profile.id;

      return `
        <article class="model-config-card">
          <div class="model-config-head">
            <div class="model-config-main">
              ${renderProviderAvatar(profile.provider)}
              <div>
                <p class="model-card-title">${escapeHtml(profile.displayName)}</p>
                <p class="model-card-meta">${escapeHtml(meta.label)} / ${escapeHtml(profile.model)}</p>
              </div>
            </div>
            <div class="model-card-actions model-card-actions-inline">
              ${isActive ? `<span class="model-priority-tag">优先使用</span>` : ""}
              <button
                type="button"
                class="model-icon-button"
                data-model-edit="${escapeHtml(profile.id)}"
                aria-label="编辑 ${escapeHtml(profile.displayName)}"
                title="编辑"
              >
                ${renderActionIcon("edit")}
              </button>
              <button
                type="button"
                class="model-status-toggle ${isActive ? "is-active" : ""}"
                data-model-status-toggle="${escapeHtml(profile.id)}"
                aria-pressed="${isActive ? "true" : "false"}"
              >
                ${isActive ? "已启用" : "未启用"}
              </button>
              <button
                type="button"
                class="model-icon-button model-icon-button-danger"
                data-model-delete="${escapeHtml(profile.id)}"
                aria-label="删除 ${escapeHtml(profile.displayName)}"
                title="删除"
              >
                ${renderActionIcon("delete")}
              </button>
            </div>
          </div>
          ${profile.notes ? `<p class="model-card-copy">${escapeHtml(profile.notes)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderProviderCards(providerOptions, activeProvider) {
  return providerOptions
    .map((provider) => `
      <button
        type="button"
        class="provider-card ${provider.kind === activeProvider ? "is-active" : ""}"
        data-provider-select="${escapeHtml(provider.kind)}"
      >
        <div class="provider-row">
          ${renderProviderAvatar(provider.kind)}
          <div>
            <p class="provider-name">${escapeHtml(provider.label)}</p>
            <p class="provider-copy">${escapeHtml(provider.copy)}</p>
          </div>
        </div>
        <div class="provider-model-list">
          ${provider.popularModels.map((model) => `<span class="provider-chip">${escapeHtml(model)}</span>`).join("")}
        </div>
      </button>
    `)
    .join("");
}

function renderPopularModelChips(provider) {
  return getProviderMeta(provider).popularModels
    .map(
      (model) => `
        <button type="button" class="popular-chip" data-model-chip="${escapeHtml(model)}">
          ${escapeHtml(model)}
        </button>
      `
    )
    .join("");
}

function renderProviderPickerCards(providerOptions) {
  return providerOptions
    .map(
      (provider) => `
        <button
          type="button"
          class="provider-picker-card ${provider.kind === state.editor.provider ? "is-active" : ""}"
          data-provider-select="${escapeHtml(provider.kind)}"
        >
          ${renderProviderAvatar(provider.kind)}
          <span class="provider-picker-name">${escapeHtml(provider.label)}</span>
        </button>
      `
    )
    .join("");
}

function renderEditorForm(editor) {
  const fields = getProviderFields(editor.provider);

  return `
    <form id="model-profile-form" class="model-form">
      ${fields
        .map((field) => {
          const fieldClass = field.full ? "field field-full" : "field";
          const value = escapeHtml(editor.values[field.key] ?? "");

          if (field.textarea) {
            return `
              <label class="${fieldClass}">
                <span class="field-label">${escapeHtml(field.label)}</span>
                <textarea
                  class="field-textarea"
                  name="${escapeHtml(field.key)}"
                  placeholder="${escapeHtml(field.placeholder)}"
                >${value}</textarea>
              </label>
            `;
          }

          return `
            <label class="${fieldClass}">
              <span class="field-label">${escapeHtml(field.label)}</span>
              <input
                class="field-input"
                name="${escapeHtml(field.key)}"
                value="${value}"
                placeholder="${escapeHtml(field.placeholder)}"
                ${field.required ? "required" : ""}
              />
            </label>
          `;
        })
        .join("")}

      <div class="field field-full">
        <span class="field-label">热门模型参考</span>
        <div class="popular-models">
          ${renderPopularModelChips(editor.provider)}
        </div>
        <p class="field-hint">后续这里也可以继续扩成真正的模型市场与推荐列表。</p>
      </div>

      <div class="form-actions">
        <button type="button" class="model-action-secondary" data-model-cancel="true">取消</button>
        <button type="submit" class="model-action">保存配置</button>
      </div>
    </form>
  `;
}

function renderModelListWorkspace(state) {
  return `
    <div class="models-grid models-grid-single">
      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">Configured</p>
            <p class="model-section-title">已配置列表</p>
          </div>
          <div class="model-section-actions">
            <span class="pill pill-neutral">${state.modelSettings.profiles.length} 条配置</span>
            <button type="button" class="model-action" data-model-create="true">添加新配置</button>
          </div>
        </div>

        <div class="model-section-body model-configured-list">
          ${renderConfiguredProfiles(state.modelSettings)}
        </div>
      </section>
    </div>
  `;
}

function renderModelPickerWorkspace(providerOptions) {
  return `
    <div class="models-grid models-grid-single">
      <section class="model-section">
        <div class="model-editor model-editor-compact">
          <div class="model-section-head model-section-head-leading">
            <div class="model-section-leading">
              <button type="button" class="model-action-secondary" data-model-back="true">返回列表</button>
              <div>
                <p class="feature-kicker">Provider</p>
                <p class="model-section-title">选择供应商</p>
              </div>
            </div>
          </div>

          <div class="provider-picker-grid">
            ${renderProviderPickerCards(providerOptions)}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderModelEditorWorkspace(state, providerOptions) {
  return `
    <div class="models-grid models-grid-single">
      <section class="model-section model-section-scroll">
        <div class="model-editor">
          <div class="model-section-head model-section-head-leading">
            <div class="model-section-leading">
              <button type="button" class="model-action-secondary" data-model-back="true">返回列表</button>
            </div>
            <div class="model-section-actions">
              <span class="pill pill-neutral">${escapeHtml(getProviderLabel(state.editor.provider))}</span>
            </div>
          </div>

          ${renderEditorForm(state.editor)}
        </div>
      </section>
    </div>
  `;
}

function renderModelManagementWorkspace(state) {
  const providerOptions = getProviderOptions(state.snapshot?.providers ?? []);
  const showHero = state.modelManagementView === "list";
  const content =
    state.modelManagementView === "editor"
      ? renderModelEditorWorkspace(state, providerOptions)
      : state.modelManagementView === "picker"
        ? renderModelPickerWorkspace(providerOptions)
      : renderModelListWorkspace(state);

  return `
    <div class="workspace-stage workspace-stage-scroll">
      <div class="models-shell">
        ${showHero
          ? `
            <section class="models-hero">
              <div>
                <p class="feature-kicker">Model Management</p>
                <p class="models-title">模型管理</p>
              </div>
              <span class="status-pill models-badge">
                ${state.modelSettings.activeProfileId ? "当前已有优先模型" : "尚未设置优先模型"}
              </span>
            </section>
          `
          : ""}

        ${content}
      </div>
    </div>
  `;
}

function renderTagPills(values, emptyText = "未配置") {
  if (!(values?.length)) {
    return `<span class="pill pill-neutral">${escapeHtml(emptyText)}</span>`;
  }

  return values.map((value) => `<span class="pill pill-neutral">${escapeHtml(value)}</span>`).join("");
}

function renderAgentProfilesList() {
  if (!state.agentProfiles.length) {
    return `
      <div class="model-empty">
        <p class="model-empty-copy">当前还没有 Agent。先添加一个执行角色，再绑定模型、Skill 和 MCP Server。</p>
      </div>
    `;
  }

  return state.agentProfiles
    .map((profile) => {
      const isBuiltin = isBuiltinWorkbenchItem(profile.id);
      const modelLabel =
        state.modelSettings.profiles.find((entry) => entry.id === profile.modelProfileId)?.displayName ?? "未绑定模型";
      const capabilityTags = [
        `${profile.allowedSkillIds.length} 个 Skill`,
        `${profile.allowedMcpServerIds.length} 个 MCP`
      ];

      return `
        <article class="model-config-card">
          <div class="model-config-head">
            <div class="model-config-main">
              ${renderExtensionAvatar(profile.name, "extension-avatar-agent")}
              <div>
                <p class="model-card-title">${escapeHtml(profile.name)}</p>
                <p class="model-card-meta">${escapeHtml(profile.mode === "task" ? "任务型 Agent" : "对话型 Agent")} / ${escapeHtml(modelLabel)}</p>
              </div>
            </div>
            <div class="model-card-actions model-card-actions-inline">
              <button type="button" class="model-icon-button" data-agent-runner="${escapeHtml(profile.id)}" aria-label="运行 ${escapeHtml(profile.name)}" title="运行测试">
                ${renderActionIcon("play")}
              </button>
              ${isBuiltin
                ? '<span class="pill pill-neutral">内置</span>'
                : `
                  <button type="button" class="model-icon-button" data-agent-edit="${escapeHtml(profile.id)}" aria-label="编辑 ${escapeHtml(profile.name)}" title="编辑">
                    ${renderActionIcon("edit")}
                  </button>
                  <button type="button" class="model-status-toggle ${profile.enabled ? "is-active" : ""}" data-agent-status-toggle="${escapeHtml(profile.id)}" aria-pressed="${profile.enabled ? "true" : "false"}">
                    ${profile.enabled ? "已启用" : "未启用"}
                  </button>
                  <button type="button" class="model-icon-button model-icon-button-danger" data-agent-delete="${escapeHtml(profile.id)}" aria-label="删除 ${escapeHtml(profile.name)}" title="删除">
                    ${renderActionIcon("delete")}
                  </button>
                `}
            </div>
          </div>
          ${profile.description ? `<p class="model-card-copy">${escapeHtml(profile.description)}</p>` : ""}
          <div class="extension-tag-row">
            ${isBuiltin ? '<span class="pill">默认兜底</span>' : ""}
            ${renderTagPills(capabilityTags)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSkillDefinitionsList() {
  if (!state.skillDefinitions.length) {
    return `
      <div class="model-empty">
        <p class="model-empty-copy">当前还没有 Skill。先添加可复用提示模板或工作流定义，后续再由 Agent 选择调用。</p>
      </div>
    `;
  }

  return state.skillDefinitions
    .map((skill) => {
      const isBuiltin = isBuiltinWorkbenchItem(skill.id);

      return `
      <article class="model-config-card">
        <div class="model-config-head">
          <div class="model-config-main">
            ${renderExtensionAvatar(skill.name, "extension-avatar-skill")}
            <div>
              <p class="model-card-title">${escapeHtml(getSkillDisplayName(skill))}</p>
              <p class="model-card-meta">${escapeHtml((getSkillDisplayName(skill) !== skill.name ? `${skill.name} / ` : "") + getSkillSourceLabel(skill))}</p>
            </div>
          </div>
          <div class="model-card-actions model-card-actions-inline">
            ${isBuiltin
              ? '<span class="pill pill-neutral">内置</span>'
              : `
                <button type="button" class="model-icon-button" data-skill-edit="${escapeHtml(skill.id)}" aria-label="编辑 ${escapeHtml(skill.name)}" title="编辑">
                  ${renderActionIcon("edit")}
                </button>
                <button type="button" class="model-status-toggle ${skill.enabled ? "is-active" : ""}" data-skill-status-toggle="${escapeHtml(skill.id)}" aria-pressed="${skill.enabled ? "true" : "false"}">
                  ${skill.enabled ? "已启用" : "未启用"}
                </button>
                <button type="button" class="model-icon-button model-icon-button-danger" data-skill-delete="${escapeHtml(skill.id)}" aria-label="删除 ${escapeHtml(skill.name)}" title="删除">
                  ${renderActionIcon("delete")}
                </button>
              `}
          </div>
        </div>
        ${skill.description ? `<p class="model-card-copy">${escapeHtml(skill.description)}</p>` : ""}
        ${getSkillSourceDetail(skill) ? `<p class="model-card-copy">${escapeHtml(getSkillSourceDetail(skill))}</p>` : ""}
        ${getSkillLocalMirrorDetail(skill) ? `<p class="model-card-copy">${escapeHtml(getSkillLocalMirrorDetail(skill))}</p>` : ""}
        <div class="extension-tag-row">
          ${isBuiltin ? '<span class="pill">默认能力</span>' : ""}
          <span class="pill pill-neutral">${escapeHtml(getSkillSourceLabel(skill))}</span>
          ${getSkillLocalMirrorDetail(skill) ? '<span class="pill">本地目录</span>' : ""}
        </div>
      </article>
    `;
    })
    .join("");
}

function renderMcpServersList() {
  if (!state.mcpServers.length) {
    return `
      <div class="model-empty">
        <p class="model-empty-copy">当前还没有 MCP Server。先维护连接配置，后续再把工具暴露给 Agent。</p>
      </div>
    `;
  }

  return state.mcpServers
    .map((server) => {
      const isBuiltin = isBuiltinWorkbenchItem(server.id);
      const descriptor = server.transport === "http" ? server.url || "未配置地址" : server.command || "未配置命令";
      return `
        <article class="model-config-card">
          <div class="model-config-head">
            <div class="model-config-main">
              ${renderExtensionAvatar(server.name, "extension-avatar-mcp")}
              <div>
                <p class="model-card-title">${escapeHtml(server.name)}</p>
                <p class="model-card-meta">${escapeHtml(server.transport.toUpperCase())} / ${escapeHtml(descriptor)}</p>
              </div>
            </div>
            <div class="model-card-actions model-card-actions-inline">
              ${isBuiltin
                ? '<span class="pill pill-neutral">内置</span>'
                : `
                  <button type="button" class="model-icon-button" data-mcp-edit="${escapeHtml(server.id)}" aria-label="编辑 ${escapeHtml(server.name)}" title="编辑">
                    ${renderActionIcon("edit")}
                  </button>
                  <button type="button" class="model-status-toggle ${server.enabled ? "is-active" : ""}" data-mcp-status-toggle="${escapeHtml(server.id)}" aria-pressed="${server.enabled ? "true" : "false"}">
                    ${server.enabled ? "已启用" : "未启用"}
                  </button>
                  <button type="button" class="model-icon-button model-icon-button-danger" data-mcp-delete="${escapeHtml(server.id)}" aria-label="删除 ${escapeHtml(server.name)}" title="删除">
                    ${renderActionIcon("delete")}
                  </button>
                `}
            </div>
          </div>
          ${server.description ? `<p class="model-card-copy">${escapeHtml(server.description)}</p>` : ""}
          <div class="extension-tag-row">
            ${isBuiltin ? '<span class="pill">默认工具</span>' : ""}
            ${renderTagPills(server.toolAllowlist, "未限制工具")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderExtensionsListWorkspace() {
  return `
    <div class="models-grid models-grid-single">
      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">Agents</p>
            <p class="model-section-title">Agent 配置</p>
          </div>
          <div class="model-section-actions">
            <span class="pill pill-neutral">${state.agentProfiles.length} 个 Agent</span>
            <button type="button" class="model-action" data-extension-create="agent">添加 Agent</button>
          </div>
        </div>
        <div class="model-section-body model-configured-list">
          ${renderAgentProfilesList()}
        </div>
      </section>

      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">Skills</p>
            <p class="model-section-title">Skill 配置</p>
          </div>
          <div class="model-section-actions">
            <span class="pill pill-neutral">${state.skillDefinitions.length} 个 Skill</span>
            <button type="button" class="model-action-secondary" data-extension-create="skill-import">GitHub 加载</button>
            <button type="button" class="model-action" data-extension-create="skill">添加 Skill</button>
          </div>
        </div>
        <div class="model-section-body model-configured-list">
          ${renderSkillDefinitionsList()}
        </div>
      </section>

      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">MCP Servers</p>
            <p class="model-section-title">MCP 配置</p>
          </div>
          <div class="model-section-actions">
            <span class="pill pill-neutral">${state.mcpServers.length} 个服务</span>
            <button type="button" class="model-action" data-extension-create="mcp">添加 MCP</button>
          </div>
        </div>
        <div class="model-section-body model-configured-list">
          ${renderMcpServersList()}
        </div>
      </section>
    </div>
  `;
}

function renderExtensionsSelectionList(items, selectedIds, emptyText) {
  if (!items.length) {
    return `<div class="model-empty"><p class="model-empty-copy">${escapeHtml(emptyText)}</p></div>`;
  }

  return `
    <div class="extension-selection-list">
      ${items
        .map((item) => `
          <label class="extension-selection-item">
            <input
              type="checkbox"
              name="${escapeHtml(item.name)}"
              value="${escapeHtml(item.id)}"
              ${selectedIds.includes(item.id) ? "checked" : ""}
            />
            <span>${escapeHtml(item.label)}</span>
          </label>
        `)
        .join("")}
    </div>
  `;
}

function renderAgentEditorForm(editor) {
  const modelOptions = state.modelSettings.profiles
    .map(
      (profile) => `
        <option value="${escapeHtml(profile.id)}" ${profile.id === editor.values.modelProfileId ? "selected" : ""}>
          ${escapeHtml(profile.displayName)} / ${escapeHtml(profile.model)}
        </option>
      `
    )
    .join("");

  const skillItems = state.skillDefinitions.map((skill) => ({
    id: skill.id,
    label: getSkillOptionLabel(skill),
    name: "allowedSkillIds"
  }));
  const serverItems = state.mcpServers.map((server) => ({
    id: server.id,
    label: `${server.name} / ${server.transport.toUpperCase()}`,
    name: "allowedMcpServerIds"
  }));

  return `
    <form id="agent-profile-form" class="model-form">
      <label class="field">
        <span class="field-label">Agent 名称</span>
        <input class="field-input" name="name" value="${escapeHtml(editor.values.name)}" placeholder="例如：周报助手" required />
      </label>

      <label class="field">
        <span class="field-label">执行模式</span>
        <select class="field-input" name="mode">
          <option value="task" ${editor.values.mode === "task" ? "selected" : ""}>task</option>
          <option value="chat" ${editor.values.mode === "chat" ? "selected" : ""}>chat</option>
        </select>
      </label>

      <label class="field field-full">
        <span class="field-label">模型绑定</span>
        <select class="field-input" name="modelProfileId">
          <option value="">暂不绑定</option>
          ${modelOptions}
        </select>
      </label>

      <label class="field field-full">
        <span class="field-label">说明</span>
        <textarea class="field-textarea" name="description" placeholder="描述这个 Agent 主要负责什么">${escapeHtml(editor.values.description)}</textarea>
      </label>

      <label class="field field-full">
        <span class="field-label">系统提示词</span>
        <textarea class="field-textarea extension-textarea-lg" name="systemPrompt" placeholder="定义 Agent 的角色、边界和执行策略" required>${escapeHtml(editor.values.systemPrompt)}</textarea>
      </label>

      <div class="field field-full">
        <span class="field-label">允许调用的 Skill</span>
        ${renderExtensionsSelectionList(skillItems, editor.values.allowedSkillIds, "还没有 Skill，可先在列表页新增。")}
      </div>

      <div class="field field-full">
        <span class="field-label">允许调用的 MCP Server</span>
        ${renderExtensionsSelectionList(serverItems, editor.values.allowedMcpServerIds, "还没有 MCP Server，可先在列表页新增。")}
      </div>

      <div class="form-actions">
        <button type="button" class="model-action-secondary" data-extensions-back="true">取消</button>
        <button type="submit" class="model-action">保存 Agent</button>
      </div>
    </form>
  `;
}

function renderSkillEditorForm(editor) {
  return `
    <form id="skill-definition-form" class="model-form">
      <label class="field">
        <span class="field-label">Skill 名称</span>
        <input class="field-input" name="name" value="${escapeHtml(editor.values.name)}" placeholder="例如：karpathy-guidelines" required />
      </label>

      <label class="field field-full">
        <span class="field-label">说明</span>
        <textarea class="field-textarea" name="description" placeholder="描述这个 Skill 适用于哪些场景">${escapeHtml(editor.values.description)}</textarea>
      </label>

      <label class="field field-full">
        <span class="field-label">Prompt 模板</span>
        <textarea class="field-textarea extension-textarea-lg" name="promptTemplate" placeholder="定义 Skill 的输入上下文和输出约束" required>${escapeHtml(editor.values.promptTemplate)}</textarea>
      </label>

      <label class="field field-full">
        <span class="field-label">处理器引用</span>
        <input class="field-input" name="handlerRef" value="${escapeHtml(editor.values.handlerRef)}" placeholder="例如：scripts/run.py 或 scripts/run.mjs" />
      </label>

      <label class="field field-full">
        <span class="field-label">协议约定</span>
        <textarea class="field-textarea" readonly>如果 Skill 目录里存在可执行 handler，Gordon 会自动按 handler 模式执行；否则默认按 prompt 模式处理。当前协议版本为 gordon-skill/v1；stdout 推荐返回 {"protocolVersion":"gordon-skill/v1","mode":"context|final","content":"..."}。</textarea>
      </label>

      <div class="form-actions">
        <button type="button" class="model-action-secondary" data-extensions-back="true">取消</button>
        <button type="submit" class="model-action">保存 Skill</button>
      </div>
    </form>
  `;
}

function renderSkillImportForm(editor) {
  return `
    <form id="skill-github-import-form" class="model-form">
      <label class="field field-full">
        <span class="field-label">GitHub 仓库</span>
        <input class="field-input" name="repo" value="${escapeHtml(editor.values.repo)}" placeholder="例如：openai/skills 或 https://github.com/openai/skills" required />
      </label>

      <label class="field">
        <span class="field-label">分支 / Tag</span>
        <input class="field-input" name="ref" value="${escapeHtml(editor.values.ref)}" placeholder="默认 main" />
      </label>

      <label class="field field-full">
        <span class="field-label">Skill 路径</span>
        <input class="field-input" name="path" value="${escapeHtml(editor.values.path)}" placeholder="例如：skills/.curated/skill-installer 或 skills/demo/SKILL.md" required />
      </label>

      <label class="field field-full">
        <span class="field-label">说明</span>
        <textarea class="field-textarea" readonly>当前会从 GitHub 读取整个 Skill 目录，镜像到 Gordon 的 skills/ 本地 Skill 目录，并把 SKILL.md 映射为本地 SkillDefinition。导入后你仍然可以在列表里继续编辑。</textarea>
      </label>

      <div class="form-actions">
        <button type="button" class="model-action-secondary" data-extensions-back="true">取消</button>
        <button type="submit" class="model-action">加载 Skill</button>
      </div>
    </form>
  `;
}

function renderMcpEditorForm(editor) {
  return `
    <form id="mcp-server-form" class="model-form">
      <label class="field">
        <span class="field-label">服务名称</span>
        <input class="field-input" name="name" value="${escapeHtml(editor.values.name)}" placeholder="例如：Feishu Docs" required />
      </label>

      <label class="field">
        <span class="field-label">传输方式</span>
        <select class="field-input" name="transport">
          <option value="stdio" ${editor.values.transport === "stdio" ? "selected" : ""}>stdio</option>
          <option value="http" ${editor.values.transport === "http" ? "selected" : ""}>http</option>
        </select>
      </label>

      <label class="field field-full">
        <span class="field-label">说明</span>
        <textarea class="field-textarea" name="description" placeholder="描述这个 MCP 服务提供哪些工具">${escapeHtml(editor.values.description)}</textarea>
      </label>

      <label class="field field-full">
        <span class="field-label">启动命令</span>
        <input class="field-input" name="command" value="${escapeHtml(editor.values.command)}" placeholder="例如：npx @scope/server" />
      </label>

      <label class="field field-full">
        <span class="field-label">服务地址</span>
        <input class="field-input" name="url" value="${escapeHtml(editor.values.url)}" placeholder="例如：https://mcp.example.com" />
      </label>

      <label class="field field-full">
        <span class="field-label">环境变量</span>
        <textarea class="field-textarea extension-textarea-md" name="envText" placeholder="一行一个 KEY=VALUE">${escapeHtml(editor.values.envText)}</textarea>
      </label>

      <label class="field field-full">
        <span class="field-label">工具白名单</span>
        <input class="field-input" name="toolAllowlist" value="${escapeHtml(editor.values.toolAllowlist)}" placeholder="例如：search_docs, create_doc, update_doc" />
      </label>

      <div class="form-actions">
        <button type="button" class="model-action-secondary" data-extensions-back="true">取消</button>
        <button type="submit" class="model-action">保存 MCP</button>
      </div>
    </form>
  `;
}

function renderExtensionsEditorWorkspace(editor) {
  const titleMap = {
    agent: editor.mode === "edit" ? "编辑 Agent" : "新增 Agent",
    skill: editor.mode === "edit" ? "编辑 Skill" : "新增 Skill",
    "skill-import": "从 GitHub 加载 Skill",
    mcp: editor.mode === "edit" ? "编辑 MCP Server" : "新增 MCP Server"
  };

  const form =
    editor.kind === "skill"
      ? renderSkillEditorForm(editor)
      : editor.kind === "skill-import"
        ? renderSkillImportForm(editor)
      : editor.kind === "mcp"
        ? renderMcpEditorForm(editor)
        : renderAgentEditorForm(editor);

  return `
    <div class="models-grid models-grid-single">
      <section class="model-section model-section-scroll">
        <div class="model-editor">
          <div class="model-section-head model-section-head-leading">
            <div class="model-section-leading">
              <button type="button" class="model-action-secondary" data-extensions-back="true">返回列表</button>
              <div>
                <p class="feature-kicker">Capability Editor</p>
                <p class="model-section-title">${escapeHtml(titleMap[editor.kind])}</p>
              </div>
            </div>
          </div>
          ${form}
        </div>
      </section>
    </div>
  `;
}

function renderAgentRunSteps(steps) {
  if (!steps?.length) {
    return `<p class="model-empty-copy">本次运行还没有步骤记录。</p>`;
  }

  return `
    <div class="agent-run-step-list">
      ${steps
        .map(
          (step) => `
            <article class="agent-run-step">
              <div class="agent-run-step-head">
                <p class="agent-run-step-title">${escapeHtml(step.title)}</p>
                <span class="pill pill-neutral">${escapeHtml(formatLocalDateTime(step.createdAt))}</span>
              </div>
              <p class="model-card-copy">${escapeHtml(step.detail)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAgentMcpCalls(mcpCalls) {
  if (!mcpCalls?.length) {
    return `<p class="model-empty-copy">本次运行没有发生 MCP 调用。</p>`;
  }

  const formatFailureKind = (failureKind) => {
    if (failureKind === "schema_mismatch") {
      return "Schema 不匹配";
    }

    if (failureKind === "tool_unavailable") {
      return "工具不可用";
    }

    if (failureKind === "tool_execution") {
      return "工具执行失败";
    }

    return "未知失败";
  };

  return `
    <div class="agent-run-step-list">
      ${mcpCalls
        .map(
          (call) => `
            <article class="agent-run-step">
              <div class="agent-run-step-head">
                <p class="agent-run-step-title">第 ${escapeHtml(String(call.round))} 轮 / ${escapeHtml(call.serverName)} / ${escapeHtml(call.toolName)}</p>
                <div class="extension-tag-row">
                  ${call.autoSelected ? '<span class="pill">自动选择</span>' : ""}
                  ${call.recovered ? `<span class="pill">已重试恢复（${escapeHtml(String(call.attemptCount))} 次）</span>` : ""}
                  ${call.repairedFromArguments ? '<span class="pill">参数已修复</span>' : ""}
                  ${call.fallbackFromToolName ? `<span class="pill">fallback 接管</span>` : ""}
                  ${call.isError ? '<span class="pill pill-neutral">返回错误标记</span>' : ""}
                  ${call.isError && call.errorCategory ? `<span class="pill pill-neutral">${escapeHtml(call.errorCategory === "retryable" ? "可重试错误" : "不可重试错误")}</span>` : ""}
                  ${call.failureKind ? `<span class="pill pill-neutral">${escapeHtml(formatFailureKind(call.failureKind))}</span>` : ""}
                </div>
              </div>
              <p class="model-card-copy">参数：${escapeHtml(JSON.stringify(call.arguments ?? {}, null, 2))}</p>
              ${
                call.repairedFromArguments
                  ? `<p class="model-card-copy">修复前参数：${escapeHtml(JSON.stringify(call.repairedFromArguments, null, 2))}</p>`
                  : ""
              }
              ${
                call.repairReason
                  ? `<p class="model-card-copy">修复策略：${escapeHtml(call.repairReason)}</p>`
                  : ""
              }
              ${
                call.fallbackFromToolName
                  ? `<p class="model-card-copy">fallback 来源：${escapeHtml(call.fallbackFromServerName ?? call.serverName)} / ${escapeHtml(call.fallbackFromToolName)}</p>`
                  : ""
              }
              ${
                call.failureReason
                  ? `<p class="model-card-copy">失败原因：${escapeHtml(call.failureReason)}</p>`
                  : ""
              }
              <textarea class="field-textarea extension-textarea-md" readonly>${escapeHtml(call.resultText)}</textarea>
            </article>
      `
        )
        .join("")}
    </div>
  `;
}

function renderCommandWorkshopSessionList() {
  if (!state.commandWorkshop.sessions.length) {
    return `
      <div class="command-empty-card">
        <p class="model-empty-copy">还没有历史会话。点击开始新对话，直接进入命令工坊。</p>
        <div class="form-actions">
          <button type="button" class="model-action" data-command-new-session="true">开始新对话</button>
        </div>
      </div>
    `;
  }

  return state.commandWorkshop.sessions
    .map((session) => {
      const isActive = session.id === state.commandWorkshop.activeSessionId;
      const assistantCount = session.messages.filter((message) => message.role === "assistant").length;

      return `
        <article class="command-session-card ${isActive ? "is-active" : ""}">
          <button type="button" class="command-session-main" data-command-session-open="${escapeHtml(session.id)}">
            <div class="command-session-head">
              <p class="command-session-title">${escapeHtml(session.title || "新对话")}</p>
            </div>
            <p class="command-session-summary">${escapeHtml(session.summary || "等待输入")}</p>
            <p class="command-session-meta">
              ${escapeHtml(formatLocalDateTime(session.updatedAt))} · ${escapeHtml(String(session.messages.length))} 条消息 · ${escapeHtml(String(assistantCount))} 次响应
            </p>
          </button>
          <button
            type="button"
            class="model-icon-button model-icon-button-danger command-session-delete"
            data-command-session-delete="${escapeHtml(session.id)}"
            aria-label="删除 ${escapeHtml(session.title || "当前会话")}"
            title="删除会话"
          >
            ${renderActionIcon("delete")}
          </button>
        </article>
      `;
    })
    .join("");
}

function renderCommandWorkshopArtifact(artifact) {
  if (!artifact) {
    return "";
  }

  const summaryParts = [
    artifact.steps.length ? `${artifact.steps.length} 个步骤` : "",
    artifact.mcpCalls?.length ? `${artifact.mcpCalls.length} 次工具` : "",
    artifact.profileLabel || ""
  ].filter(Boolean);

  return `
    <details class="command-artifact-panel">
      <summary>${escapeHtml(summaryParts.length ? `执行链路 · ${summaryParts.join(" / ")}` : "查看执行链路")}</summary>
      <div class="command-artifact-body">
        <div class="extension-tag-row">
          <span class="pill pill-neutral">${escapeHtml(artifact.profileLabel)}</span>
          <span class="pill pill-neutral">${escapeHtml(artifact.model)}</span>
          ${artifact.skillName ? `<span class="pill">${escapeHtml(artifact.skillName)}</span>` : ""}
          ${artifact.autoSelectedMcp ? '<span class="pill">自动选 MCP</span>' : ""}
          ${artifact.mcpServerName ? `<span class="pill pill-neutral">${escapeHtml(artifact.mcpServerName)}</span>` : ""}
          ${artifact.mcpToolName ? `<span class="pill pill-neutral">${escapeHtml(artifact.mcpToolName)}</span>` : ""}
        </div>
        ${artifact.mcpResultText
          ? `
            <label class="field field-full">
              <span class="field-label">MCP 汇总结果</span>
              <textarea class="field-textarea extension-textarea-md" readonly>${escapeHtml(artifact.mcpResultText)}</textarea>
            </label>
          `
          : ""}
        ${artifact.stopReason
          ? `
            <label class="field field-full">
              <span class="field-label">停止原因</span>
              <textarea class="field-textarea extension-textarea-md" readonly>${escapeHtml(artifact.stopReason)}</textarea>
            </label>
          `
          : ""}
        <div class="field field-full">
          <span class="field-label">执行步骤</span>
          ${renderAgentRunSteps(artifact.steps)}
        </div>
        ${artifact.mcpCalls?.length
          ? `
            <div class="field field-full">
              <span class="field-label">MCP 调用明细</span>
              ${renderAgentMcpCalls(artifact.mcpCalls)}
            </div>
          `
          : ""}
      </div>
    </details>
  `;
}

function renderCommandWorkshopMessages(activeSession) {
  const messages = activeSession?.messages ?? [];
  const config = getCommandWorkshopFormState();
  const selectedAgent = getAgentProfileById(config.agentProfileId);
  const assistantName = selectedAgent?.name ?? "Gordon";

  if (!messages.length) {
    return "";
  }

  return messages
    .map(
      (message) => `
        <article class="command-message ${message.role === "user" ? "is-user" : "is-assistant"} ${message.state === "error" ? "is-error" : ""}">
          <div class="command-message-head">
            <span class="command-message-role">${message.role === "user" ? "你" : escapeHtml(assistantName)}</span>
            <span class="command-message-time">${escapeHtml(formatLocalDateTime(message.createdAt))}</span>
          </div>
          <div class="command-message-body command-rich-text">${renderCommandWorkshopRichText(message.content)}</div>
          ${message.role === "assistant" ? renderCommandWorkshopArtifact(message.artifact) : ""}
        </article>
      `
    )
    .join("");
}

function renderCommandWorkshopSettingsFields(config, enabledAgents, selectedAgent, runnableSkills, authorizedServers, toolOptions) {
  return `
    <div class="command-settings-grid">
      <label class="field">
        <span class="field-label">Agent</span>
        <select class="field-input" name="agentProfileId" ${enabledAgents.length ? "" : "disabled"}>
          ${enabledAgents.length
            ? enabledAgents
                .map(
                  (agent) => `
                    <option value="${escapeHtml(agent.id)}" ${agent.id === config.agentProfileId ? "selected" : ""}>
                      ${escapeHtml(agent.name)}
                    </option>
                  `
                )
                .join("")
            : '<option value="">暂无可用 Agent</option>'}
        </select>
      </label>

      <label class="field">
        <span class="field-label">Skill</span>
        <select class="field-input" name="skillId" ${selectedAgent ? "" : "disabled"}>
          <option value="">通用模式</option>
          ${runnableSkills
            .map(
              (skill) => `
                <option value="${escapeHtml(skill.id)}" ${skill.id === config.skillId ? "selected" : ""}>
                  ${escapeHtml(getSkillOptionLabel(skill))}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="extension-selection-item command-inline-toggle">
        <input type="checkbox" name="autoSelectMcp" ${config.autoSelectMcp ? "checked" : ""} />
        <span>允许自动工具</span>
      </label>

      <label class="field">
        <span class="field-label">MCP Server</span>
        <select class="field-input" name="mcpServerId" ${selectedAgent ? "" : "disabled"}>
          <option value="">不指定 MCP Server</option>
          ${authorizedServers
            .map(
              (server) => `
                <option value="${escapeHtml(server.id)}" ${server.id === config.mcpServerId ? "selected" : ""}>
                  ${escapeHtml(server.name)} / ${escapeHtml(server.transport.toUpperCase())}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <div class="field">
        <div class="weekly-inline-actions weekly-inline-actions-spread">
          <span class="field-label">MCP 工具</span>
          <button type="button" class="model-action-secondary" data-command-load-mcp-tools="true">读取工具</button>
        </div>
        <select class="field-input" name="mcpToolName" ${config.mcpServerId ? "" : "disabled"}>
          <option value="">不指定工具</option>
          ${toolOptions
            .map(
              (tool) => `
                <option value="${escapeHtml(tool.name)}" ${tool.name === config.mcpToolName ? "selected" : ""}>
                  ${escapeHtml(tool.name)}${tool.description ? ` / ${escapeHtml(tool.description)}` : ""}
                </option>
              `
            )
            .join("")}
        </select>
      </div>

      <label class="field field-full">
        <span class="field-label">MCP 参数 JSON</span>
        <textarea class="field-textarea extension-textarea-md" name="mcpArgumentsText" placeholder='例如：{"path":"docs/ARCHITECTURE.md"}'>${escapeHtml(config.mcpArgumentsText)}</textarea>
      </label>
    </div>
  `;
}

function renderCommandWorkshopComposer() {
  const config = getCommandWorkshopFormState();
  const enabledAgents = getEnabledAgentProfiles();
  const selectedAgent = getAgentProfileById(config.agentProfileId);
  const runnableSkills = selectedAgent ? getAgentRunnableSkills(selectedAgent.id) : [];
  const authorizedServers = selectedAgent ? getAuthorizedMcpServersForAgent(selectedAgent.id) : [];
  const toolOptions = [...state.commandWorkshop.availableMcpTools];
  const canSubmit = Boolean(selectedAgent?.modelProfileId) && !state.commandWorkshop.isRunning;
  const settingsSummary = getCommandWorkshopSettingsSummary(config);
  const isSettingsView = state.commandWorkshop.composerView === "settings";

  if (config.mcpToolName && !toolOptions.some((tool) => tool.name === config.mcpToolName)) {
    toolOptions.unshift({
      name: config.mcpToolName,
      description: "当前已保存工具",
      serverId: config.mcpServerId,
      serverName: authorizedServers.find((server) => server.id === config.mcpServerId)?.name ?? ""
    });
  }

  return `
    <form id="command-workshop-form" class="command-composer">
      ${isSettingsView
        ? `
          <div class="command-input-shell command-input-shell-float command-settings-shell">
            <div class="command-settings-head">
              <div class="command-settings-copy">
                <p class="command-settings-title">高级设置</p>
                <p class="command-settings-caption">${escapeHtml(settingsSummary)}</p>
              </div>
              <button type="button" class="model-action-secondary command-settings-close" data-command-close-settings="true">返回输入</button>
            </div>

            ${renderCommandWorkshopSettingsFields(config, enabledAgents, selectedAgent, runnableSkills, authorizedServers, toolOptions)}
          </div>
        `
        : `
          <div class="command-input-shell command-input-shell-float">
            <div class="command-input-toolbar">
              <p class="command-input-label">输入消息</p>
              <div class="command-input-toolbar-actions">
                <p class="command-input-shortcut">Enter 发送 · Shift + Enter 换行</p>
                <button
                  type="button"
                  class="model-icon-button command-input-settings-trigger"
                  data-command-open-settings="true"
                  aria-label="打开高级设置"
                  title="高级设置"
                >
                  ${renderActionIcon("gear")}
                </button>
              </div>
            </div>

            <div class="command-input-frame">
              <textarea
                id="command-workshop-input"
                class="field-textarea command-input"
                name="userInput"
                placeholder="${selectedAgent?.modelProfileId ? "直接告诉 Gordon 你要完成什么工作，Enter 发送，Shift + Enter 换行。" : "先在模型管理里设置一个优先模型，Gordon 才能开始工作。"}"
                ${canSubmit ? "" : "disabled"}
                autofocus
                required
              >${escapeHtml(state.commandWorkshop.draftInput)}</textarea>

              <button
                type="submit"
                class="model-icon-button command-input-submit"
                ${canSubmit ? "" : "disabled"}
                aria-label="${state.commandWorkshop.isRunning ? "处理中" : "发送消息"}"
                title="${state.commandWorkshop.isRunning ? "处理中" : "发送消息"}"
              >
                ${renderActionIcon("enter")}
              </button>
            </div>
          </div>
        `}
    </form>
  `;
}

function renderCommandWorkshopListWorkspace() {
  return `
    <div class="models-grid models-grid-single">
      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">Sessions</p>
            <p class="model-section-title">会话列表</p>
          </div>
          <div class="model-section-actions">
            <button type="button" class="model-action" data-command-new-session="true">新对话</button>
          </div>
        </div>

        <div class="model-section-body command-session-list-shell">
          <div class="command-session-group">
            <div class="command-session-group-head">
              <p class="command-session-group-title">最近会话</p>
              <span class="pill pill-neutral">${escapeHtml(String(state.commandWorkshop.sessions.length))} 条</span>
            </div>
            <div class="command-session-list">
          ${renderCommandWorkshopSessionList()}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderCommandWorkshopChatWorkspace(activeSession) {
  const config = getCommandWorkshopFormState();
  const selectedAgent = getAgentProfileById(config.agentProfileId);
  const showBack = state.commandWorkshop.sessions.length > 0;
  const assistantName = selectedAgent?.name ?? "Gordon";
  const fullTitle = activeSession?.title ?? "开始一轮协作";
  const displayTitle = truncateCommandWorkshopText(fullTitle, 10) || "开始一轮协作";

  return `
    <div class="models-grid models-grid-single command-chat-layout">
      <section class="model-section command-chat-section">
        <div class="command-chat-shell">
          <div class="command-chat-head">
            <div class="command-chat-side command-chat-side-start">
              ${showBack ? '<button type="button" class="model-action-secondary" data-command-back="true">返回列表</button>' : ""}
            </div>
            <div class="command-chat-center">
              <p class="command-chat-title" title="${escapeHtml(fullTitle)}">${escapeHtml(displayTitle)}</p>
            </div>
            <div class="command-chat-side command-chat-side-end">
              <button type="button" class="model-action" data-command-new-session="true">新对话</button>
            </div>
          </div>

          <div id="command-workshop-messages" class="command-chat-scroll-region">
            <div class="command-message-stream">
              ${renderCommandWorkshopMessages(activeSession)}
              ${state.commandWorkshop.isRunning
                ? `
                  <article class="command-message is-assistant is-pending">
                    <div class="command-message-head">
                      <span class="command-message-role">${escapeHtml(assistantName)}</span>
                      <span class="command-message-time">处理中</span>
                    </div>
                    <div class="command-message-body command-rich-text">${renderCommandWorkshopRichText("正在读取上下文并规划执行步骤，请稍等片刻。")}</div>
                  </article>
                `
                : ""}
            </div>
          </div>

          ${renderCommandWorkshopComposer()}
        </div>
      </section>
    </div>
  `;
}

function renderCommandWorkshopWorkspace() {
  const activeSession = getActiveCommandWorkshopSession();
  const isChatView = state.commandWorkshop.view === "chat";
  const showHero = !isChatView;
  const content =
    isChatView ? renderCommandWorkshopChatWorkspace(activeSession) : renderCommandWorkshopListWorkspace();
  const stageClass = ["workspace-stage", "command-workshop-stage", isChatView ? "command-workshop-stage-chat" : "workspace-stage-scroll"].join(
    " "
  );

  return `
    <div class="${stageClass}">
      <div class="command-workshop-shell">
        ${showHero
          ? `
            <section class="models-hero">
              <div>
                <p class="feature-kicker">Command Workshop</p>
                <p class="models-title">命令工坊</p>
                <p class="models-subcopy">选择历史会话，或开始新对话进入命令工坊。</p>
              </div>
              <div class="model-section-actions">
                <button type="button" class="model-action" data-command-new-session="true">开始协作</button>
              </div>
            </section>
          `
          : ""}

        ${content}
      </div>
    </div>
  `;
}

function renderRecentAgentLogs(logs) {
  if (!logs.length) {
    return `
      <div class="model-empty">
        <p class="model-empty-copy">当前 Agent 还没有执行记录，先运行一次测试任务。</p>
      </div>
    `;
  }

  return logs
    .map(
      (log) => `
        <article class="model-config-card">
          <div class="model-config-head">
            <div>
              <p class="model-card-title">${escapeHtml(log.skillName ?? log.mcpToolName ?? "直接运行")}</p>
              <p class="model-card-meta">${escapeHtml(formatLocalDateTime(log.createdAt))} / ${escapeHtml(log.profileLabel)}</p>
            </div>
            <span class="pill pill-neutral">${escapeHtml(log.model)}</span>
          </div>
          <p class="model-card-copy">${escapeHtml(log.userInput.slice(0, 120) || "无输入内容")}</p>
          ${
            log.mcpToolName
              ? `<div class="extension-tag-row">${log.autoSelectedMcp ? '<span class="pill">自动选 MCP</span>' : ""}<span class="pill pill-neutral">${escapeHtml(log.mcpServerName ?? "MCP")}</span><span class="pill pill-neutral">${escapeHtml(log.mcpToolName)}</span>${(log.mcpCalls?.length ?? 0) > 1 ? `<span class="pill pill-neutral">${escapeHtml(String(log.mcpCalls.length))} 轮 MCP</span>` : ""}${log.stopReason ? `<span class="pill pill-neutral">${escapeHtml(log.stopReason)}</span>` : ""}</div>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderAgentRunnerWorkspace() {
  const agent = getAgentProfileById(state.agentRunner.agentId);

  if (!agent) {
    return renderPlaceholderWorkspace("Agent 未找到", "当前运行对象不存在，请返回列表重新选择。");
  }

  const runnableSkills = getAgentRunnableSkills(agent.id);
  const authorizedMcpServers = state.mcpServers.filter(
    (server) => agent.allowedMcpServerIds.includes(server.id) && server.enabled
  );
  const latestResult = state.agentRunner.result ?? getRecentAgentRunLogs(agent.id, 1)[0] ?? null;
  const recentLogs = getRecentAgentRunLogs(agent.id);
  const modelLabel =
    state.modelSettings.profiles.find((profile) => profile.id === agent.modelProfileId)?.displayName ?? "未绑定模型";

  return `
    <div class="models-grid">
      <section class="model-section model-section-scroll">
        <div class="model-editor">
          <div class="model-section-head model-section-head-leading">
            <div class="model-section-leading">
              <button type="button" class="model-action-secondary" data-extensions-back="true">返回列表</button>
              <div>
                <p class="feature-kicker">Agent Runner</p>
                <p class="model-section-title">${escapeHtml(agent.name)}</p>
                <p class="models-subcopy">绑定模型：${escapeHtml(modelLabel)}，可选 Skill：${escapeHtml(String(runnableSkills.length))} 个。</p>
              </div>
            </div>
            <div class="model-section-actions">
              <span class="status-pill">${agent.enabled ? "Agent 已启用" : "Agent 未启用"}</span>
            </div>
          </div>

          <form id="agent-runner-form" class="model-form">
            <label class="field field-full">
              <span class="field-label">本次附加 Skill</span>
              <select class="field-input" name="skillId">
                <option value="">不指定 Skill，直接按 Agent 角色执行</option>
                ${runnableSkills
                  .map(
                    (skill) => `
                      <option value="${escapeHtml(skill.id)}" ${skill.id === state.agentRunner.skillId ? "selected" : ""}>
                        ${escapeHtml(getSkillOptionLabel(skill))}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label class="field field-full">
              <span class="field-label">本次附加 MCP Server</span>
              <select class="field-input" name="mcpServerId">
                <option value="">不调用 MCP 工具</option>
                ${authorizedMcpServers
                  .map(
                    (server) => `
                      <option value="${escapeHtml(server.id)}" ${server.id === state.agentRunner.mcpServerId ? "selected" : ""}>
                        ${escapeHtml(server.name)} / ${escapeHtml(server.transport.toUpperCase())}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label class="extension-selection-item field-full">
              <input type="checkbox" name="autoSelectMcp" ${state.agentRunner.autoSelectMcp ? "checked" : ""} />
              <span>未手动指定 MCP tool 时，允许 Agent 自动选择工具</span>
            </label>

            <div class="field field-full">
              <div class="weekly-inline-actions weekly-inline-actions-spread">
                <span class="field-label">MCP 工具</span>
                <button type="button" class="model-action-secondary" data-agent-load-mcp-tools="true">读取工具</button>
              </div>
              <select class="field-input" name="mcpToolName">
                <option value="">不指定工具</option>
                ${state.agentRunner.availableMcpTools
                  .map(
                    (tool) => `
                      <option value="${escapeHtml(tool.name)}" ${tool.name === state.agentRunner.mcpToolName ? "selected" : ""}>
                        ${escapeHtml(tool.name)}${tool.description ? ` / ${escapeHtml(tool.description)}` : ""}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </div>

            <label class="field field-full">
              <span class="field-label">MCP 参数 JSON</span>
              <textarea class="field-textarea extension-textarea-md" name="mcpArgumentsText" placeholder='例如：{"query":"本周周报"}'>${escapeHtml(state.agentRunner.mcpArgumentsText)}</textarea>
            </label>

            <label class="field field-full">
              <span class="field-label">任务输入</span>
              <textarea class="field-textarea extension-textarea-lg" name="userInput" placeholder="例如：请帮我基于本周计划生成一版可发给领导的更新说明" required>${escapeHtml(state.agentRunner.userInput)}</textarea>
            </label>

            <div class="form-actions">
              <button type="button" class="model-action-secondary" data-agent-runner-reset="true">清空输入</button>
              <button type="submit" class="model-action">${state.agentRunner.isRunning ? "运行中..." : "运行测试"}</button>
            </div>
          </form>
        </div>
      </section>

      <section class="model-section model-section-scroll">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">Result</p>
            <p class="model-section-title">本次输出</p>
          </div>
          ${
            latestResult
              ? `<div class="extension-tag-row"><span class="pill pill-neutral">${escapeHtml(latestResult.profileLabel)}</span>${latestResult.autoSelectedMcp ? '<span class="pill">自动选 MCP</span>' : ""}</div>`
              : ""
          }
        </div>
        <div class="model-section-body">
          ${
            latestResult
              ? `
                <label class="field field-full">
                  <span class="field-label">输出结果</span>
                  <textarea class="field-textarea extension-textarea-lg" readonly>${escapeHtml(latestResult.text)}</textarea>
                </label>
                ${
                  latestResult.skillResultText
                    ? `
                      <label class="field field-full">
                        <span class="field-label">Skill 执行结果${latestResult.skillFinalOutput ? "（直出最终结果）" : "（补充上下文）"}</span>
                        <textarea class="field-textarea extension-textarea-md" readonly>${escapeHtml(latestResult.skillResultText)}</textarea>
                      </label>
                    `
                    : ""
                }
                ${
                  latestResult.mcpResultText
                    ? `
                      <label class="field field-full">
                        <span class="field-label">MCP 汇总结果</span>
                        <textarea class="field-textarea extension-textarea-md" readonly>${escapeHtml(latestResult.mcpResultText)}</textarea>
                      </label>
                    `
                    : ""
                }
                ${
                  latestResult.stopReason
                    ? `
                      <label class="field field-full">
                        <span class="field-label">停止原因</span>
                        <textarea class="field-textarea extension-textarea-md" readonly>${escapeHtml(latestResult.stopReason)}</textarea>
                      </label>
                    `
                    : ""
                }
                <div class="field field-full">
                  <span class="field-label">MCP 调用明细</span>
                  ${renderAgentMcpCalls(latestResult.mcpCalls ?? [])}
                </div>
                <div class="field field-full">
                  <span class="field-label">执行步骤</span>
                  ${renderAgentRunSteps(latestResult.steps)}
                </div>
              `
              : `<div class="model-empty"><p class="model-empty-copy">运行完成后，这里会展示输出结果和执行步骤。</p></div>`
          }
        </div>
      </section>

      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">History</p>
            <p class="model-section-title">最近执行</p>
          </div>
          <span class="pill pill-neutral">${recentLogs.length} 条</span>
        </div>
        <div class="model-section-body model-configured-list">
          ${renderRecentAgentLogs(recentLogs)}
        </div>
      </section>
    </div>
  `;
}

function renderExtensionsManagementWorkspace() {
  const showHero = state.extensionsView === "list";
  const content =
    state.extensionsView === "editor"
      ? renderExtensionsEditorWorkspace(state.extensionsEditor)
      : state.extensionsView === "runner"
        ? renderAgentRunnerWorkspace()
        : renderExtensionsListWorkspace();

  return `
    <div class="workspace-stage workspace-stage-scroll">
      <div class="models-shell">
        ${showHero
          ? `
            <section class="models-hero">
              <div>
                <p class="feature-kicker">Capability Expansion</p>
                <p class="models-title">能力拓展</p>
              </div>
              <div class="model-section-actions">
                <span class="status-pill">${state.agentProfiles.filter((profile) => profile.enabled).length} 个 Agent 已启用</span>
                <span class="pill pill-neutral">${state.skillDefinitions.filter((skill) => skill.enabled).length} 个 Skill 已启用</span>
                <span class="pill pill-neutral">${state.mcpServers.filter((server) => server.enabled).length} 个 MCP 已启用</span>
              </div>
            </section>
          `
          : ""}

        ${content}
      </div>
    </div>
  `;
}

function renderWeeklyProgressStatusOptions(selectedStatus) {
  return Object.entries(WEEKLY_PROGRESS_STATUS_META)
    .map(
      ([status, meta]) => `
        <option value="${escapeHtml(status)}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(meta.label)}</option>
      `
    )
    .join("");
}

function renderWeeklyTaskCard(projectId, task, index) {
  const statusMeta = getWeeklyProgressStatusMeta(task.status);
  const rewriteEnabled = task.title.trim() || task.detail.trim();

  return `
    <article class="weekly-task-card">
      <div class="weekly-task-row">
        <span class="weekly-task-index">${index + 1}</span>
        <select
          class="weekly-status-select weekly-status-select-compact"
          data-weekly-task-project-id="${escapeHtml(projectId)}"
          data-weekly-task-id="${escapeHtml(task.id)}"
          data-weekly-task-field="status"
          aria-label="任务状态"
        >
          ${renderWeeklyProgressStatusOptions(task.status)}
        </select>
        <input
          class="field-input weekly-task-title-input"
          type="text"
          value="${escapeHtml(task.title)}"
          placeholder="例如：补齐 Feishu 周报同步 schema"
          data-weekly-task-project-id="${escapeHtml(projectId)}"
          data-weekly-task-id="${escapeHtml(task.id)}"
          data-weekly-task-field="title"
        />
        <span class="weekly-task-status-label is-${escapeHtml(statusMeta.tone)}">${escapeHtml(statusMeta.label)}</span>
        <div class="weekly-task-actions">
          <button
            type="button"
            class="weekly-inline-link"
            data-weekly-polish-task="${escapeHtml(task.id)}"
            data-weekly-task-project-id="${escapeHtml(projectId)}"
            ${rewriteEnabled ? "" : "disabled"}
          >
            润色
          </button>
          <button
            type="button"
            class="weekly-inline-link weekly-inline-danger"
            data-weekly-remove-task="${escapeHtml(task.id)}"
            data-weekly-task-project-id="${escapeHtml(projectId)}"
          >
            删除
          </button>
        </div>
      </div>

      <textarea
        class="field-textarea weekly-task-detail"
        placeholder="补充结果、风险、协同信息（可选）"
        data-weekly-task-project-id="${escapeHtml(projectId)}"
        data-weekly-task-id="${escapeHtml(task.id)}"
        data-weekly-task-field="detail"
      >${escapeHtml(task.detail)}</textarea>
    </article>
  `;
}

function renderWeeklyProjectCard(project, index) {
  const isCollapsed = isWeeklyProjectCollapsed(project.id);
  const metrics = getWeeklyProgressMetrics({ projects: [project] });
  const statusMeta = getWeeklyProgressStatusMeta(project.status);
  const tasksContent = project.tasks.length
    ? project.tasks.map((task, taskIndex) => renderWeeklyTaskCard(project.id, task, taskIndex)).join("")
    : `
        <div class="weekly-project-empty">
          <p class="weekly-project-empty-copy">这个项目还没有拆任务，建议先把“要做什么”和“做到哪一步”拆清楚。</p>
          <button type="button" class="model-action-secondary" data-weekly-add-task="${escapeHtml(project.id)}">新增第一条任务</button>
        </div>
      `;

  return `
    <section class="weekly-project-card ${isCollapsed ? "is-collapsed" : ""}">
      <div class="weekly-project-head">
        <button
          type="button"
          class="weekly-project-toggle"
          data-weekly-toggle-project="${escapeHtml(project.id)}"
          aria-expanded="${String(!isCollapsed)}"
        >
          <span class="weekly-project-toggle-glyph">${isCollapsed ? "+" : "-"}</span>
        </button>

        <div class="weekly-project-head-copy">
          <div class="weekly-project-head-meta">
            <span class="pill pill-neutral">项目 ${index + 1}</span>
            <span class="weekly-project-status is-${escapeHtml(statusMeta.tone)}">${escapeHtml(statusMeta.label)}</span>
          </div>
          <p class="weekly-project-head-summary">
            ${metrics.taskCount ? `共 ${metrics.taskCount} 个任务，已完成 ${metrics.completedTaskCount} 个` : "还没有拆分任务"}
          </p>
        </div>

        <div class="weekly-project-head-actions">
          <select
            class="weekly-status-select"
            data-weekly-project-id="${escapeHtml(project.id)}"
            data-weekly-project-field="status"
            aria-label="项目状态"
          >
            ${renderWeeklyProgressStatusOptions(project.status)}
          </select>
          <button type="button" class="model-action-secondary" data-weekly-add-task="${escapeHtml(project.id)}">新增任务</button>
          <button type="button" class="weekly-inline-link weekly-inline-danger" data-weekly-remove-project="${escapeHtml(project.id)}">删除项目</button>
        </div>
      </div>

      ${isCollapsed
        ? ""
        : `
          <div class="weekly-project-body">
            <label class="field field-full">
              <span class="field-label">项目名称</span>
              <input
                class="field-input"
                type="text"
                value="${escapeHtml(project.title)}"
                placeholder="例如：命令工坊 / 飞书同步 / 模型管理"
                data-weekly-project-id="${escapeHtml(project.id)}"
                data-weekly-project-field="title"
              />
            </label>

            <label class="field field-full">
              <div class="weekly-inline-actions weekly-inline-actions-spread">
                <span class="field-label">阶段结果 / 风险备注</span>
                <button
                  type="button"
                  class="weekly-inline-link"
                  data-weekly-polish-project-note="${escapeHtml(project.id)}"
                  ${project.note.trim() ? "" : "disabled"}
                >
                  润色备注
                </button>
              </div>
              <textarea
                class="field-textarea weekly-project-note"
                placeholder="建议写结果、影响、当前风险，后面生成周报时会更像真正的汇报。"
                data-weekly-project-id="${escapeHtml(project.id)}"
                data-weekly-project-field="note"
              >${escapeHtml(project.note)}</textarea>
            </label>

            <div class="weekly-project-task-block">
              <div class="weekly-project-task-head">
                <span class="field-label">项目任务</span>
                <button type="button" class="weekly-inline-link" data-weekly-add-task="${escapeHtml(project.id)}">新增任务</button>
              </div>
              <div class="weekly-task-list">
                ${tasksContent}
              </div>
            </div>
          </div>
        `}
    </section>
  `;
}

function renderWeeklyProgressList(records, activeRecordId) {
  if (!records.length) {
    return `
      <div class="model-empty">
        <p class="model-empty-copy">当前还没有周记录，首次进入时会自动创建本周空白计划。</p>
      </div>
    `;
  }

  return records
    .map((record) => {
      const metrics = getWeeklyProgressMetrics(record);
      const isActive = record.id === activeRecordId;
      const hasContent = metrics.projectCount || metrics.taskCount || metrics.noteCount || String(record.generatedReport ?? "").trim();
      const updateStatus = hasContent ? `已更新 ${formatLocalDateTime(record.updatedAt)}` : "待规划";
      const leftStatusTag =
        record.status === "active"
          ? `<span class="pill weekly-record-pill">本周</span>`
          : `<span class="pill pill-neutral weekly-record-pill">历史</span>`;

      return `
        <article class="weekly-record-card ${isActive ? "is-active" : ""}">
          <button
            type="button"
            class="weekly-record-main"
            data-weekly-select="${escapeHtml(record.id)}"
          >
            <div class="weekly-record-left">
              <div class="weekly-record-copy">
                <div class="weekly-record-topline">
                  ${leftStatusTag}
                  <p class="weekly-record-title">${escapeHtml(record.title)}</p>
                </div>
                <p class="weekly-record-summary">${escapeHtml(getWeeklyProgressSummaryText(record))}</p>
              </div>
            </div>
          </button>
          <div class="weekly-record-actions">
            <span class="weekly-record-status ${hasContent ? "is-updated" : "is-pending"}">${escapeHtml(updateStatus)}</span>
            <button
              type="button"
              class="weekly-record-delete"
              data-weekly-delete="${escapeHtml(record.id)}"
              aria-label="删除 ${escapeHtml(record.title)}"
            >
              删除
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWeeklyProgressListWorkspace() {
  const activeModel = getActiveModelProfile();
  const visibleRecords = state.weeklyProgress.slice(0, WEEKLY_PROGRESS_PAGE_SIZE);
  const totalCount = state.weeklyProgress.length;

  return `
    <div class="models-grid models-grid-single">
      <section class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">Weekly Reports</p>
            <p class="model-section-title">周报列表</p>
          </div>
          <div class="model-section-actions">
            <span class="status-pill">${activeModel ? `AI：${escapeHtml(activeModel.displayName)}` : "AI 功能待启用"}</span>
            <span class="pill pill-neutral">共 ${totalCount} 周，展示 ${Math.min(totalCount, WEEKLY_PROGRESS_PAGE_SIZE)} 条</span>
          </div>
        </div>

        <div class="model-section-body model-configured-list">
          ${renderWeeklyProgressList(visibleRecords, null)}
        </div>
      </section>
    </div>
  `;
}

function renderWeeklyProgressEditorWorkspace(activeRecord) {
  const draft = getWeeklyProgressEditorDraft() ?? cloneWeeklyProgressRecord(activeRecord);
  const metrics = getWeeklyProgressMetrics(draft);
  const projectCards = draft.projects.length
    ? draft.projects.map((project, index) => renderWeeklyProjectCard(project, index)).join("")
    : `
        <div class="weekly-editor-empty">
          <p class="weekly-editor-empty-title">先按项目拆开，再写任务，周报才会像一个工作台而不是记事本。</p>
          <p class="weekly-editor-empty-copy">建议至少拆成“项目名称 + 阶段结果/风险 + 具体任务状态”三层，后面生成领导周报和接飞书都会更顺。</p>
          <button type="button" class="model-action" data-weekly-add-project="true">新增第一个项目</button>
        </div>
      `;

  return `
    <div class="models-grid models-grid-single">
      <section class="model-section model-section-scroll">
        <div class="weekly-form-shell">
          <form id="weekly-progress-form" class="weekly-form" data-weekly-record-id="${escapeHtml(activeRecord.id)}">
            <div class="weekly-panel-head weekly-panel-head-compact">
              <div class="weekly-panel-side weekly-panel-side-start">
                <button type="button" class="model-action-secondary" data-weekly-back="true">返回列表</button>
              </div>
              <p class="weekly-panel-title weekly-panel-title-centered">${escapeHtml(activeRecord.title)}</p>
              <div class="weekly-panel-side weekly-panel-side-end">
                <button type="submit" class="model-action">保存修改</button>
              </div>
            </div>

            <div class="weekly-summary-strip">
              <div class="weekly-summary-pills">
                <span class="pill pill-neutral">项目 ${metrics.projectCount}</span>
                <span class="pill pill-neutral">任务 ${metrics.taskCount}</span>
                <span class="pill pill-neutral">完成 ${metrics.completedTaskCount}</span>
                <span class="pill pill-neutral">受阻 ${metrics.blockedTaskCount}</span>
              </div>
              <button type="button" class="model-action-secondary" data-weekly-add-project="true">新增项目</button>
            </div>

            <section class="weekly-project-stack">
              ${projectCards}
            </section>

            <label class="field field-full">
              <span class="field-label">周报模板</span>
              <textarea
                class="field-textarea weekly-textarea weekly-textarea-secondary"
                placeholder="在这里维护固定模板，生成周报时会严格按模板输出"
                data-weekly-record-field="reportTemplate"
              >${escapeHtml(draft.reportTemplate)}</textarea>
            </label>

            <label class="field field-full">
              <div class="weekly-inline-actions weekly-inline-actions-spread">
                <span class="field-label">发送给领导的周报</span>
                <button type="button" class="model-action" data-weekly-generate-report="true">生成周报</button>
              </div>
              <textarea
                class="field-textarea weekly-textarea weekly-textarea-secondary"
                placeholder="点击“生成周报”后会在这里填充结果，确认后再保存"
                data-weekly-record-field="generatedReport"
              >${escapeHtml(draft.generatedReport)}</textarea>
            </label>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderWeeklyProgressWorkspace() {
  const activeModel = getActiveModelProfile();
  const activeRecord = getActiveWeeklyProgressRecord();
  const showHero = state.tasksView === "list";
  const content =
    state.tasksView === "editor" && activeRecord
      ? renderWeeklyProgressEditorWorkspace(activeRecord)
      : renderWeeklyProgressListWorkspace();

  return `
    <div class="workspace-stage workspace-stage-scroll">
      <div class="weekly-shell">
        ${showHero
          ? `
            <section class="weekly-hero">
              <div>
                <p class="feature-kicker">Weekly Progress</p>
                <p class="models-title">任务推进</p>
              </div>
              <div class="weekly-hero-side">
                <span class="status-pill models-badge">
                  ${activeModel ? `AI 已连接：${escapeHtml(activeModel.displayName)}` : "AI 功能待启用"}
                </span>
                <span class="pill pill-neutral">
                  ${state.weeklyProgress.length ? `已归档 ${state.weeklyProgress.length} 周记录` : "等待创建本周计划"}
                </span>
              </div>
            </section>
          `
          : ""}

        ${content}
      </div>
    </div>
  `;
}

function renderWorkspace(state) {
  const stage = byId("workspace-stage");

  if (state.activeFeature === "home") {
    stage.className = "workspace-stage";
    stage.innerHTML = renderRobotWorkspace();
    return;
  }

  if (state.activeFeature === MODEL_MANAGEMENT_FEATURE) {
    stage.className = "workspace-stage workspace-stage-scroll";
    stage.innerHTML = renderModelManagementWorkspace(state);
    return;
  }

  if (state.activeFeature === TASKS_FEATURE) {
    stage.className = "workspace-stage workspace-stage-scroll";
    stage.innerHTML = renderWeeklyProgressWorkspace();
    return;
  }

  if (state.activeFeature === COMMAND_WORKSHOP_FEATURE) {
    stage.className = "workspace-stage workspace-stage-scroll";
    stage.innerHTML = renderCommandWorkshopWorkspace();
    return;
  }

  if (state.activeFeature === EXTENSIONS_MANAGEMENT_FEATURE) {
    stage.className = "workspace-stage workspace-stage-scroll";
    stage.innerHTML = renderExtensionsManagementWorkspace();
    return;
  }

  const placeholderMap = {
    marketplace: {
      title: "应用广场",
      description: "这里会继续承接应用发现、工具接入和能力分发。"
    },
    efficiency: {
      title: "效率工具",
      description: "这里会继续承接日报生成、文案改写与效率辅助能力。"
    },
  };

  const placeholder = placeholderMap[state.activeFeature] ?? {
    title: "功能建设中",
    description: "这里后续会补充对应功能模块。"
  };

  stage.className = "workspace-stage workspace-stage-scroll";
  stage.innerHTML = renderPlaceholderWorkspace(placeholder.title, placeholder.description);
}

function attachTiltEffects() {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    const reset = () => {
      card.style.setProperty("--rotate-x", "0deg");
      card.style.setProperty("--rotate-y", "0deg");
      card.style.setProperty("--lift", "0px");
    };

    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const offsetX = event.clientX - bounds.left;
      const offsetY = event.clientY - bounds.top;
      const rotateY = ((offsetX / bounds.width) - 0.5) * 10;
      const rotateX = (0.5 - (offsetY / bounds.height)) * 10;

      card.style.setProperty("--rotate-x", `${rotateX.toFixed(2)}deg`);
      card.style.setProperty("--rotate-y", `${rotateY.toFixed(2)}deg`);
      card.style.setProperty("--lift", "-4px");
    });

    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    card.addEventListener("pointerup", reset);
  });
}

function renderApp() {
  renderFeatureBoard(FEATURE_ENTRIES, state.activeFeature);
  renderWorkspace(state);
  void syncRobotRuntime();
  attachTiltEffects();

  if (state.activeFeature === COMMAND_WORKSHOP_FEATURE && state.commandWorkshop.view === "chat") {
    requestAnimationFrame(() => {
      const stream = byId("command-workshop-messages");

      if (stream) {
        stream.scrollTop = stream.scrollHeight;
      }
    });
  }

  const homeSettingsMenu = getHomeSettingsMenu();

  if (homeSettingsMenu) {
    homeSettingsMenu.classList.toggle("has-active-selection", isHomeSettingsFeature(state.activeFeature));
  }

  document.querySelectorAll(".home-settings-item[data-select-feature]").forEach((button) => {
    const featureId = button.getAttribute("data-select-feature");
    const isActive = featureId === state.activeFeature;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function setActiveFeature(featureId) {
  state.activeFeature = featureId;
  closeHomeSettingsMenu();

  if (featureId === MODEL_MANAGEMENT_FEATURE) {
    state.modelManagementView = "list";
  }

  if (featureId === TASKS_FEATURE) {
    state.tasksView = "list";
    state.weeklyProgressEditor = createWeeklyProgressEditorState();
  }

  if (featureId === COMMAND_WORKSHOP_FEATURE) {
    state.commandWorkshop.draft = normalizeCommandWorkshopConfig(state.commandWorkshop.draft);
    state.commandWorkshop.view = state.commandWorkshop.sessions.length ? "list" : "chat";
    state.commandWorkshop.composerView = "input";
  }

  if (featureId === EXTENSIONS_MANAGEMENT_FEATURE) {
    state.extensionsView = "list";
  }

  renderApp();

  if (featureId === COMMAND_WORKSHOP_FEATURE && state.commandWorkshop.view === "chat") {
    focusCommandWorkshopInput();
  }
}

function updateLoadState(text, isError = false) {
  const loadState = byId("load-state");

  if (loadState) {
    loadState.textContent = text;
  }

  document.body.classList.toggle("load-error", isError);
}

async function handleModelActivate(profileId) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法设置优先模型", true);
    return;
  }

  try {
    state.modelSettings = await desktopApi.activateModelProfile(profileId);
    updateLoadState("优先模型已更新");
    renderApp();
  } catch (error) {
    console.error("Failed to activate model profile", error);
    updateLoadState("优先模型更新失败", true);
  }
}

async function handleModelStatusToggle(profileId) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法切换模型状态", true);
    return;
  }

  try {
    state.modelSettings = await desktopApi.toggleModelProfileStatus(profileId);
    updateLoadState("模型启用状态已更新");
    renderApp();
  } catch (error) {
    console.error("Failed to toggle model profile status", error);
    updateLoadState("模型状态更新失败", true);
  }
}

async function handleModelDelete(profileId) {
  const desktopApi = getDesktopApi();
  const profile = state.modelSettings.profiles.find((item) => item.id === profileId);

  if (!desktopApi || !profile) {
    updateLoadState("桌面桥接未就绪，暂无法删除模型配置", true);
    return;
  }

  const shouldDelete = window.confirm(`确认删除模型配置“${profile.displayName}”吗？`);

  if (!shouldDelete) {
    return;
  }

  try {
    state.modelSettings = await desktopApi.deleteModelProfile(profileId);
    updateLoadState("模型配置已删除");
    renderApp();
  } catch (error) {
    console.error("Failed to delete model profile", error);
    updateLoadState("模型配置删除失败", true);
  }
}

function handleModelEdit(profileId) {
  const profile = state.modelSettings.profiles.find((item) => item.id === profileId);

  if (!profile) {
    return;
  }

  state.editor = createEditorState(profile.provider, profile);
  state.modelManagementView = "editor";
  state.activeFeature = MODEL_MANAGEMENT_FEATURE;
  renderApp();
}

function handleProviderSelect(provider) {
  state.editor = createEditorState(provider);
  state.modelManagementView = "editor";
  renderApp();
}

function handleStartNewProfile() {
  state.editor = createEditorState("openai");
  state.modelManagementView = "picker";
  renderApp();
}

function handleModelManagementBack() {
  state.modelManagementView = "list";
  renderApp();
}

function handleEditorCancel() {
  state.modelManagementView = "list";
  renderApp();
}

function setActiveWeeklyProgress(recordId) {
  if (!state.weeklyProgress.some((record) => record.id === recordId)) {
    return;
  }

  state.activeWeeklyProgressId = recordId;
  state.activeFeature = TASKS_FEATURE;
  state.tasksView = "editor";
  setWeeklyProgressEditorRecord(getActiveWeeklyProgressRecord());
  renderApp();
}

function handleWeeklyProgressBack() {
  state.tasksView = "list";
  state.weeklyProgressEditor = createWeeklyProgressEditorState();
  renderApp();
}

async function handleWeeklyProgressSave() {
  const desktopApi = getDesktopApi();
  const activeRecord = getActiveWeeklyProgressRecord();
  const draft = sanitizeWeeklyProgressDraft(getWeeklyProgressEditorDraft());

  if (!desktopApi || !activeRecord || !draft) {
    updateLoadState("周记录尚未就绪，暂时无法保存", true);
    return;
  }

  const nextRecord = {
    ...draft,
    id: activeRecord.id,
    updatedAt: new Date().toISOString()
  };

  try {
    const records = await desktopApi.saveWeeklyProgress(nextRecord);
    syncWeeklyProgressSelection(records);
    setWeeklyProgressEditorRecord(getActiveWeeklyProgressRecord());
    updateLoadState("任务推进内容已保存");
    renderApp();
  } catch (error) {
    console.error("Failed to save weekly progress", error);
    updateLoadState(`任务推进保存失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleWeeklyProgressDelete(recordId) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法删除周记录", true);
    return;
  }

  if (!window.confirm("确认删除这条周记录吗？删除后无法恢复。")) {
    return;
  }

  try {
    const records = await desktopApi.deleteWeeklyProgress(recordId);
    syncWeeklyProgressSelection(records);
    state.tasksView = "list";
    state.weeklyProgressEditor = createWeeklyProgressEditorState();
    updateLoadState("周记录已删除");
    renderApp();
  } catch (error) {
    console.error("Failed to delete weekly progress", error);
    updateLoadState(`周记录删除失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleWeeklyProjectNoteRewrite(projectId) {
  const draft = getWeeklyProgressEditorDraft();
  const project = findWeeklyProjectById(draft, projectId);

  if (!project) {
    updateLoadState("当前项目尚未就绪，暂无法润色备注", true);
    return;
  }

  await rewriteWeeklyProgressValue(
    project.note,
    (text) => {
      project.note = text;
    },
    "正在润色项目备注...",
    "项目备注已润色，请确认后保存"
  );
}

async function handleWeeklyTaskRewrite(projectId, taskId) {
  const draft = getWeeklyProgressEditorDraft();
  const task = findWeeklyTaskById(draft, projectId, taskId);

  if (!task) {
    updateLoadState("当前任务尚未就绪，暂无法润色", true);
    return;
  }

  const selectedText = task.title.trim() || task.detail.trim();

  await rewriteWeeklyProgressValue(
    selectedText,
    (text) => {
      if (task.title.trim()) {
        task.title = text;
      } else {
        task.detail = text;
      }
    },
    "正在润色任务表达...",
    "任务表达已润色，请确认后保存"
  );
}

async function handleWeeklyProgressReportGeneration() {
  const desktopApi = getDesktopApi();
  const activeRecord = getActiveWeeklyProgressRecord();
  const draft = sanitizeWeeklyProgressDraft(getWeeklyProgressEditorDraft());

  if (!desktopApi || !activeRecord || !draft) {
    updateLoadState("当前周报表单尚未就绪，暂无法生成周报", true);
    return;
  }

  if (!draft.content.trim()) {
    updateLoadState("当前还没有项目或任务，先补充任务推进内容再生成周报", true);
    return;
  }

  try {
    updateLoadState("正在生成周报...");
    const result = await desktopApi.generateWeeklyProgressReport({
      weekTitle: activeRecord.title,
      content: draft.content,
      reportTemplate: draft.reportTemplate
    });

    draft.generatedReport = result.text;
    setWeeklyProgressEditorRecord(draft);

    updateLoadState(`周报已生成，请确认后保存（${result.profileLabel}）`);
    renderApp();
  } catch (error) {
    console.error("Failed to generate weekly progress report", error);
    updateLoadState(`周报生成失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

function replaceTextareaRange(textarea, start, end, replacement, selectionMode = "end") {
  textarea.setRangeText(replacement, start, end, selectionMode);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function handleIndentTextarea(textarea, shouldOutdent) {
  const { value, selectionStart, selectionEnd } = textarea;

  if (selectionStart === selectionEnd) {
    if (shouldOutdent) {
      const beforeCursor = value.slice(0, selectionStart);
      const indentStart = Math.max(beforeCursor.lastIndexOf("\n") + 1, selectionStart - EDITOR_INDENT.length);
      const maybeIndent = value.slice(indentStart, selectionStart);

      if (maybeIndent === EDITOR_INDENT) {
        replaceTextareaRange(textarea, indentStart, selectionStart, "", "end");
      }

      return;
    }

    replaceTextareaRange(textarea, selectionStart, selectionEnd, EDITOR_INDENT, "end");
    return;
  }

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", selectionEnd);
  const blockEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const lines = value.slice(lineStart, blockEnd).split("\n");
  const updatedLines = lines.map((line) => {
    if (!shouldOutdent) {
      return `${EDITOR_INDENT}${line}`;
    }

    if (line.startsWith(EDITOR_INDENT)) {
      return line.slice(EDITOR_INDENT.length);
    }

    if (line.startsWith("\t")) {
      return line.slice(1);
    }

    return line.replace(/^ {1,3}/, "");
  });

  replaceTextareaRange(textarea, lineStart, blockEnd, updatedLines.join("\n"), "select");
}

function handleSmartEnter(textarea) {
  const { value, selectionStart, selectionEnd } = textarea;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const beforeCursor = value.slice(lineStart, selectionStart);
  const indent = beforeCursor.match(/^\s*/)?.[0] ?? "";
  const bulletPrefix = beforeCursor.match(/^(\s*(?:[-*+]|\d+\.)\s+)/)?.[1] ?? "";
  const nextPrefix = bulletPrefix || indent;

  replaceTextareaRange(textarea, selectionStart, selectionEnd, `\n${nextPrefix}`, "end");
}

async function handleProfileSubmit(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法保存模型配置", true);
    return;
  }

  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  const profile = {
    id: state.editor.profileId ?? `model_${Date.now()}`,
    provider: state.editor.provider,
    displayName: String(values.displayName ?? "").trim(),
    model: String(values.model ?? "").trim(),
    apiKey: String(values.apiKey ?? "").trim(),
    baseUrl: String(values.baseUrl ?? "").trim(),
    organization: String(values.organization ?? "").trim(),
    project: String(values.project ?? "").trim(),
    location: String(values.location ?? "").trim(),
    notes: String(values.notes ?? "").trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    state.modelSettings = await desktopApi.upsertModelProfile(profile);
    state.editor = createEditorState(profile.provider, profile);
    state.modelManagementView = "list";
    state.activeFeature = MODEL_MANAGEMENT_FEATURE;
    updateLoadState("模型配置已保存");
    renderApp();
  } catch (error) {
    console.error("Failed to save model profile", error);
    updateLoadState("模型配置保存失败", true);
  }
}

function openExtensionsEditor(kind, entry = null) {
  state.extensionsEditor = createExtensionsEditorState(kind, entry);
  state.extensionsView = "editor";
  state.activeFeature = EXTENSIONS_MANAGEMENT_FEATURE;
  renderApp();
}

function openAgentRunner(agentId) {
  state.agentRunner = createAgentRunnerState(agentId);
  state.extensionsView = "runner";
  state.activeFeature = EXTENSIONS_MANAGEMENT_FEATURE;
  renderApp();
}

function returnToExtensionsList() {
  state.extensionsView = "list";
  state.activeFeature = EXTENSIONS_MANAGEMENT_FEATURE;
  renderApp();
}

function handleAgentRunnerReset() {
  state.agentRunner = {
    ...state.agentRunner,
    skillId: "",
    autoSelectMcp: false,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}",
    availableMcpTools: [],
    userInput: "",
    result: null
  };
  renderApp();
}

async function handleAgentRunnerLoadMcpTools(form) {
  const desktopApi = getDesktopApi();
  const formData = new FormData(form);
  const serverId = String(formData.get("mcpServerId") ?? "").trim();
  const skillId = String(formData.get("skillId") ?? "").trim();
  const autoSelectMcp = formData.get("autoSelectMcp") === "on";
  const userInput = String(formData.get("userInput") ?? "").trim();
  const mcpArgumentsText = String(formData.get("mcpArgumentsText") ?? "{}").trim() || "{}";

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法读取 MCP 工具", true);
    return;
  }

  if (!serverId) {
    updateLoadState("请先选择一个 MCP Server，再读取工具", true);
    return;
  }

  try {
    updateLoadState("正在读取 MCP 工具列表...");
    const tools = await desktopApi.listMcpServerTools(serverId);
    state.agentRunner = {
      ...state.agentRunner,
      skillId,
      autoSelectMcp,
      userInput,
      mcpServerId: serverId,
      mcpArgumentsText,
      availableMcpTools: tools,
      mcpToolName: tools.some((tool) => tool.name === state.agentRunner.mcpToolName)
        ? state.agentRunner.mcpToolName
        : tools[0]?.name ?? ""
    };
    updateLoadState(`已读取 ${tools.length} 个 MCP 工具`);
    renderApp();
  } catch (error) {
    console.error("Failed to load mcp tools", error);
    updateLoadState(`MCP 工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

function readCommandWorkshopFormSnapshot(form) {
  const formData = new FormData(form);
  const currentConfig = getCommandWorkshopFormState();

  return {
    config: normalizeCommandWorkshopConfig({
      agentProfileId: formData.has("agentProfileId")
        ? String(formData.get("agentProfileId") ?? "").trim()
        : currentConfig.agentProfileId,
      skillId: formData.has("skillId") ? String(formData.get("skillId") ?? "").trim() : currentConfig.skillId,
      autoSelectMcp: formData.has("autoSelectMcp") ? formData.get("autoSelectMcp") === "on" : currentConfig.autoSelectMcp,
      mcpServerId: formData.has("mcpServerId") ? String(formData.get("mcpServerId") ?? "").trim() : currentConfig.mcpServerId,
      mcpToolName: formData.has("mcpToolName") ? String(formData.get("mcpToolName") ?? "").trim() : currentConfig.mcpToolName,
      mcpArgumentsText: formData.has("mcpArgumentsText")
        ? String(formData.get("mcpArgumentsText") ?? "{}").trim() || "{}"
        : currentConfig.mcpArgumentsText
    }),
    userInput: formData.has("userInput") ? String(formData.get("userInput") ?? "") : state.commandWorkshop.draftInput
  };
}

function applyCommandWorkshopSnapshot(snapshot) {
  if (state.commandWorkshop.activeSessionId) {
    state.commandWorkshop.sessions = sortCommandWorkshopSessions(
      state.commandWorkshop.sessions.map((session) =>
        session.id === state.commandWorkshop.activeSessionId
          ? normalizeCommandWorkshopSession({
              ...session,
              ...snapshot.config
            })
          : session
      )
    );
  } else {
    state.commandWorkshop.draft = snapshot.config;
  }

  state.commandWorkshop.draftInput = snapshot.userInput;
}

function focusCommandWorkshopInput() {
  requestAnimationFrame(() => {
    const textarea = byId("command-workshop-input");

    if (!(textarea instanceof HTMLTextAreaElement) || textarea.disabled) {
      return;
    }

    textarea.focus();
    const textLength = textarea.value.length;
    textarea.setSelectionRange(textLength, textLength);
  });
}

function setCommandWorkshopComposerView(view, form = null) {
  if (form instanceof HTMLFormElement) {
    applyCommandWorkshopSnapshot(readCommandWorkshopFormSnapshot(form));
  }

  state.commandWorkshop.composerView = view;
  renderApp();

  if (view === "input") {
    focusCommandWorkshopInput();
  }
}

function buildCommandWorkshopSessionPayload(session) {
  return {
    ...session,
    agentProfileId: session.agentProfileId || null,
    skillId: session.skillId || null,
    mcpServerId: session.mcpServerId || null,
    mcpToolName: session.mcpToolName || null
  };
}

async function persistCommandWorkshopSession(session) {
  const desktopApi = getDesktopApi();

  if (typeof desktopApi?.upsertCommandWorkshopSession === "function") {
    return desktopApi.upsertCommandWorkshopSession(buildCommandWorkshopSessionPayload(session));
  }

  console.warn("Command workshop preload bridge is missing upsertCommandWorkshopSession");
  updateLoadState("当前桌面桥接版本较旧，本轮会话先只保留在当前窗口；重启桌面端后会恢复持久化。");
  return sortCommandWorkshopSessions(state.commandWorkshop.sessions);
}

async function requestCommandWorkshopSessionDelete(sessionId) {
  const desktopApi = getDesktopApi();

  if (typeof desktopApi?.deleteCommandWorkshopSession === "function") {
    return desktopApi.deleteCommandWorkshopSession(sessionId);
  }

  throw new Error("当前桌面桥接版本过旧，暂无法删除已保存会话，请重启桌面端后重试");
}

function upsertCommandWorkshopSessionState(session) {
  const normalized = normalizeCommandWorkshopSession(session);
  const nextSessions = state.commandWorkshop.sessions.filter((entry) => entry.id !== normalized.id);
  state.commandWorkshop.sessions = sortCommandWorkshopSessions([normalized, ...nextSessions]);
  state.commandWorkshop.activeSessionId = normalized.id;
}

function handleCommandWorkshopNewSession(form = null) {
  const snapshot = form instanceof HTMLFormElement ? readCommandWorkshopFormSnapshot(form) : { config: getCommandWorkshopFormState(), userInput: "" };

  state.commandWorkshop.activeSessionId = null;
  state.commandWorkshop.view = "chat";
  state.commandWorkshop.composerView = "input";
  state.commandWorkshop.draft = normalizeCommandWorkshopConfig(snapshot.config);
  state.commandWorkshop.draftInput = "";
  state.commandWorkshop.availableMcpTools = [];
  state.activeFeature = COMMAND_WORKSHOP_FEATURE;
  renderApp();
  focusCommandWorkshopInput();
}

function handleCommandWorkshopSessionOpen(sessionId) {
  if (!state.commandWorkshop.sessions.some((session) => session.id === sessionId)) {
    return;
  }

  state.commandWorkshop.activeSessionId = sessionId;
  state.commandWorkshop.view = "chat";
  state.commandWorkshop.composerView = "input";
  state.commandWorkshop.draftInput = "";
  state.commandWorkshop.availableMcpTools = [];
  state.activeFeature = COMMAND_WORKSHOP_FEATURE;
  renderApp();
  focusCommandWorkshopInput();
}

function handleCommandWorkshopBack() {
  state.commandWorkshop.view = "list";
  state.commandWorkshop.composerView = "input";
  state.commandWorkshop.draftInput = "";
  state.commandWorkshop.availableMcpTools = [];
  renderApp();
}

async function handleCommandWorkshopSessionDelete(sessionId) {
  const desktopApi = getDesktopApi();
  const session = state.commandWorkshop.sessions.find((entry) => entry.id === sessionId);

  if (!desktopApi || !session) {
    updateLoadState("当前会话尚未就绪，暂无法删除", true);
    return;
  }

  if (!window.confirm(`确认删除会话「${session.title || "当前会话"}」吗？`)) {
    return;
  }

  try {
    const sessions = await requestCommandWorkshopSessionDelete(sessionId);
    syncCommandWorkshopState(sessions);
    state.commandWorkshop.view = sessions.length ? "list" : "chat";
    state.commandWorkshop.composerView = "input";
    updateLoadState("会话已删除");
    renderApp();
  } catch (error) {
    console.error("Failed to delete command workshop session", error);
    updateLoadState(`会话删除失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

function handleCommandWorkshopPromptFill(prompt) {
  state.commandWorkshop.draftInput = prompt;
  state.commandWorkshop.view = "chat";
  state.commandWorkshop.composerView = "input";
  state.activeFeature = COMMAND_WORKSHOP_FEATURE;
  renderApp();
  focusCommandWorkshopInput();
}

function buildConversationMessagesForAgentRun(messages) {
  return (messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

async function handleCommandWorkshopLoadMcpTools(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法读取 MCP 工具", true);
    return;
  }

  const snapshot = readCommandWorkshopFormSnapshot(form);

  if (!snapshot.config.mcpServerId) {
    updateLoadState("请先选择一个 MCP Server，再读取工具", true);
    return;
  }

  try {
    updateLoadState("正在读取命令工坊的 MCP 工具列表...");
    const tools = await desktopApi.listMcpServerTools(snapshot.config.mcpServerId);
    const nextToolName = tools.some((tool) => tool.name === snapshot.config.mcpToolName)
      ? snapshot.config.mcpToolName
      : tools[0]?.name ?? "";

    applyCommandWorkshopSnapshot({
      ...snapshot,
      config: {
        ...snapshot.config,
        mcpToolName: nextToolName
      }
    });
    state.commandWorkshop.availableMcpTools = tools;
    updateLoadState(`命令工坊已读取 ${tools.length} 个 MCP 工具`);
    renderApp();
  } catch (error) {
    console.error("Failed to load command workshop mcp tools", error);
    updateLoadState(`命令工坊 MCP 工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleCommandWorkshopSubmit(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法执行命令工坊会话", true);
    return;
  }

  if (state.commandWorkshop.isRunning) {
    updateLoadState("上一轮任务仍在运行，请等待当前结果返回", true);
    return;
  }

  const snapshot = readCommandWorkshopFormSnapshot(form);
  const agent = getAgentProfileById(snapshot.config.agentProfileId);
  const userInput = snapshot.userInput.trim();
  let mcpArguments;

  if (!agent) {
    updateLoadState("请先选择一个可用 Agent", true);
    return;
  }

  if (!userInput) {
    updateLoadState("先输入一条任务，再让 Gordon 开始工作", true);
    return;
  }

  if (snapshot.config.mcpToolName && !snapshot.config.mcpServerId) {
    updateLoadState("如果要指定 MCP 工具，请先选择 MCP Server", true);
    return;
  }

  if (snapshot.config.mcpServerId && !snapshot.config.mcpToolName && !snapshot.config.autoSelectMcp) {
    updateLoadState("已选择 MCP Server，请再选择具体工具，或开启自动 MCP", true);
    return;
  }

  if (snapshot.config.mcpServerId && snapshot.config.mcpToolName) {
    try {
      mcpArguments = JSON.parse(snapshot.config.mcpArgumentsText);
    } catch (error) {
      updateLoadState(`MCP 参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, true);
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      updateLoadState("MCP 参数必须是一个 JSON 对象", true);
      return;
    }
  }

  applyCommandWorkshopSnapshot(snapshot);

  const activeSession = getActiveCommandWorkshopSession();
  const sessionId = activeSession?.id ?? `command_session_${Date.now()}`;
  const baseMessages = [...(activeSession?.messages ?? [])];
  const startedAt = new Date().toISOString();
  const userMessage = {
    id: `command_message_${Date.now()}`,
    role: "user",
    content: userInput,
    createdAt: startedAt
  };
  const pendingSession = {
    id: sessionId,
    title: activeSession?.title || buildCommandWorkshopTitle(userInput),
    summary: summarizeCommandWorkshopContent(userInput),
    agentProfileId: snapshot.config.agentProfileId,
    skillId: snapshot.config.skillId || null,
    autoSelectMcp: snapshot.config.autoSelectMcp,
    mcpServerId: snapshot.config.mcpServerId || null,
    mcpToolName: snapshot.config.mcpToolName || null,
    mcpArgumentsText: snapshot.config.mcpArgumentsText,
    messages: [...baseMessages, userMessage],
    createdAt: activeSession?.createdAt ?? startedAt,
    updatedAt: startedAt
  };

  upsertCommandWorkshopSessionState(pendingSession);
  state.commandWorkshop.draftInput = "";
  state.commandWorkshop.isRunning = true;
  renderApp();

  try {
    updateLoadState(`命令工坊正在运行 Agent「${agent.name}」...`);
    const result = await desktopApi.runAgent({
      agentProfileId: agent.id,
      userInput,
      conversationMessages: buildConversationMessagesForAgentRun(baseMessages),
      ...(snapshot.config.skillId ? { skillId: snapshot.config.skillId } : {}),
      ...(snapshot.config.autoSelectMcp ? { autoSelectMcp: true } : {}),
      ...(snapshot.config.mcpServerId ? { mcpServerId: snapshot.config.mcpServerId } : {}),
      ...(snapshot.config.mcpServerId && snapshot.config.mcpToolName ? { mcpToolName: snapshot.config.mcpToolName, mcpArguments } : {})
    });

    const assistantMessage = {
      id: `command_message_${Date.now()}_assistant`,
      role: "assistant",
      content: result.text,
      state: "completed",
      createdAt: result.createdAt,
      artifact: buildCommandWorkshopArtifact(result)
    };
    const completedSession = {
      ...pendingSession,
      summary: summarizeCommandWorkshopContent(result.text),
      messages: [...pendingSession.messages, assistantMessage],
      updatedAt: result.updatedAt
    };
    const sessions = await persistCommandWorkshopSession(completedSession);

    syncCommandWorkshopState(sessions);
    state.commandWorkshop.activeSessionId = completedSession.id;
    state.commandWorkshop.isRunning = false;
    state.agentRunLogs = [result, ...state.agentRunLogs.filter((log) => log.id !== result.id)];
    updateLoadState(`命令工坊已完成本轮响应（${result.profileLabel}）`);
    renderApp();
  } catch (error) {
    console.error("Failed to run command workshop session", error);
    const failedAt = new Date().toISOString();
    const assistantMessage = {
      id: `command_message_${Date.now()}_error`,
      role: "assistant",
      content: `运行失败：${error instanceof Error ? error.message : "未知错误"}`,
      state: "error",
      createdAt: failedAt
    };
    const failedSession = {
      ...pendingSession,
      summary: summarizeCommandWorkshopContent(assistantMessage.content),
      messages: [...pendingSession.messages, assistantMessage],
      updatedAt: failedAt
    };

    try {
      const sessions = await persistCommandWorkshopSession(failedSession);
      syncCommandWorkshopState(sessions);
      state.commandWorkshop.activeSessionId = failedSession.id;
    } catch (persistError) {
      console.error("Failed to persist command workshop failure session", persistError);
      upsertCommandWorkshopSessionState(failedSession);
    }

    state.commandWorkshop.isRunning = false;
    updateLoadState(`命令工坊运行失败：${error instanceof Error ? error.message : "未知错误"}`, true);
    renderApp();
  }
}

async function handleSkillDefinitionSubmit(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法保存 Skill", true);
    return;
  }

  const formData = new FormData(form);
  const existing = state.skillDefinitions.find((entry) => entry.id === state.extensionsEditor.entryId);
  const handlerRef = String(formData.get("handlerRef") ?? "").trim();
  const skill = {
    id: state.extensionsEditor.entryId ?? `skill_${Date.now()}`,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    tags: [],
    kind: handlerRef || existing?.kind === "workflow" ? "workflow" : "prompt",
    promptTemplate: String(formData.get("promptTemplate") ?? "").trim(),
    handlerRef,
    source: existing?.source ?? { type: "manual" },
    enabled: state.extensionsEditor.mode === "edit"
      ? existing?.enabled ?? true
      : true,
    updatedAt: new Date().toISOString()
  };

  try {
    state.skillDefinitions = await desktopApi.upsertSkillDefinition(skill);
    updateLoadState("Skill 已保存");
    returnToExtensionsList();
  } catch (error) {
    console.error("Failed to save skill definition", error);
    updateLoadState(`Skill 保存失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleSkillGithubImportSubmit(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法从 GitHub 加载 Skill", true);
    return;
  }

  const formData = new FormData(form);
  const repo = String(formData.get("repo") ?? "").trim();
  const ref = String(formData.get("ref") ?? "").trim() || "main";
  const path = String(formData.get("path") ?? "").trim();

  if (!repo || !path) {
    updateLoadState("请填写 GitHub 仓库和 Skill 路径", true);
    return;
  }

  try {
    updateLoadState("正在从 GitHub 读取 Skill...");
    state.skillDefinitions = await desktopApi.importSkillDefinitionFromGithub({
      repo,
      ref,
      path
    });
    updateLoadState("GitHub Skill 已加载");
    returnToExtensionsList();
  } catch (error) {
    console.error("Failed to import skill from github", error);
    updateLoadState(`GitHub Skill 加载失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleMcpServerSubmit(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法保存 MCP Server", true);
    return;
  }

  const formData = new FormData(form);
  const transport = String(formData.get("transport") ?? "stdio");
  const command = String(formData.get("command") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (transport === "stdio" && !command) {
    updateLoadState("stdio 模式需要填写启动命令", true);
    return;
  }

  if (transport === "http" && !url) {
    updateLoadState("http 模式需要填写服务地址", true);
    return;
  }

  const existing = state.mcpServers.find((entry) => entry.id === state.extensionsEditor.entryId);
  const server = {
    id: state.extensionsEditor.entryId ?? `mcp_${Date.now()}`,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    transport,
    command: transport === "stdio" ? command : "",
    url: transport === "http" ? url : "",
    env: parseEnvText(formData.get("envText")),
    toolAllowlist: normalizeTagList(formData.get("toolAllowlist")),
    enabled: existing?.enabled ?? true,
    updatedAt: new Date().toISOString()
  };

  try {
    state.mcpServers = await desktopApi.upsertMcpServer(server);
    updateLoadState("MCP Server 已保存");
    returnToExtensionsList();
  } catch (error) {
    console.error("Failed to save mcp server", error);
    updateLoadState(`MCP Server 保存失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleAgentProfileSubmit(form) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法保存 Agent", true);
    return;
  }

  const formData = new FormData(form);
  const existing = state.agentProfiles.find((entry) => entry.id === state.extensionsEditor.entryId);
  const profile = {
    id: state.extensionsEditor.entryId ?? `agent_${Date.now()}`,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    mode: String(formData.get("mode") ?? "task"),
    modelProfileId: String(formData.get("modelProfileId") ?? "").trim() || null,
    systemPrompt: String(formData.get("systemPrompt") ?? "").trim(),
    allowedSkillIds: formData.getAll("allowedSkillIds").map((item) => String(item)),
    allowedMcpServerIds: formData.getAll("allowedMcpServerIds").map((item) => String(item)),
    enabled: existing?.enabled ?? true,
    updatedAt: new Date().toISOString()
  };

  try {
    state.agentProfiles = await desktopApi.upsertAgentProfile(profile);
    updateLoadState("Agent 已保存");
    returnToExtensionsList();
  } catch (error) {
    console.error("Failed to save agent profile", error);
    updateLoadState(`Agent 保存失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleAgentRunnerSubmit(form) {
  const desktopApi = getDesktopApi();
  const agent = getAgentProfileById(state.agentRunner.agentId);

  if (!desktopApi || !agent) {
    updateLoadState("当前 Agent 运行器未就绪，暂无法执行", true);
    return;
  }

  const formData = new FormData(form);
  const userInput = String(formData.get("userInput") ?? "").trim();
  const skillId = String(formData.get("skillId") ?? "").trim();
  const autoSelectMcp = formData.get("autoSelectMcp") === "on";
  const mcpServerId = String(formData.get("mcpServerId") ?? "").trim();
  const mcpToolName = String(formData.get("mcpToolName") ?? "").trim();
  const mcpArgumentsText = String(formData.get("mcpArgumentsText") ?? "{}").trim() || "{}";
  let mcpArguments;

  if (mcpToolName && !mcpServerId) {
    updateLoadState("如果要调用 MCP 工具，请先选择 MCP Server", true);
    return;
  }

  if (mcpServerId && !mcpToolName && !autoSelectMcp) {
    updateLoadState("已选择 MCP Server，请再选择一个具体工具", true);
    return;
  }

  if (mcpServerId && mcpToolName) {
    try {
      mcpArguments = JSON.parse(mcpArgumentsText);
    } catch (error) {
      updateLoadState(`MCP 参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, true);
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      updateLoadState("MCP 参数必须是一个 JSON 对象", true);
      return;
    }
  }

  state.agentRunner = {
    ...state.agentRunner,
    userInput,
    skillId,
    autoSelectMcp,
    mcpServerId,
    mcpToolName,
    mcpArgumentsText,
    isRunning: true
  };
  renderApp();

  try {
    updateLoadState(`正在运行 Agent「${agent.name}」...`);
    const result = await desktopApi.runAgent({
      agentProfileId: agent.id,
      userInput,
      ...(skillId ? { skillId } : {}),
      ...(autoSelectMcp ? { autoSelectMcp } : {}),
      ...(mcpServerId && mcpToolName ? { mcpServerId, mcpToolName, mcpArguments } : {})
    });

    state.agentRunLogs = [result, ...state.agentRunLogs.filter((log) => log.id !== result.id)];
    state.agentRunner = {
      ...state.agentRunner,
      userInput,
      skillId,
      autoSelectMcp,
      mcpServerId,
      mcpToolName,
      mcpArgumentsText,
      result,
      isRunning: false
    };
    updateLoadState(`Agent 运行完成（${result.profileLabel}）`);
    renderApp();
  } catch (error) {
    console.error("Failed to run agent", error);
    state.agentRunner = {
      ...state.agentRunner,
      userInput,
      skillId,
      autoSelectMcp,
      mcpServerId,
      mcpToolName,
      mcpArgumentsText,
      isRunning: false
    };
    updateLoadState(`Agent 运行失败：${error instanceof Error ? error.message : "未知错误"}`, true);
    renderApp();
  }
}

async function handleAgentStatusToggle(profileId) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法切换 Agent 状态", true);
    return;
  }

  try {
    state.agentProfiles = await desktopApi.toggleAgentProfileStatus(profileId);
    updateLoadState("Agent 状态已更新");
    renderApp();
  } catch (error) {
    console.error("Failed to toggle agent profile status", error);
    updateLoadState(`Agent 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleSkillStatusToggle(skillId) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法切换 Skill 状态", true);
    return;
  }

  try {
    state.skillDefinitions = await desktopApi.toggleSkillDefinitionStatus(skillId);
    updateLoadState("Skill 状态已更新");
    renderApp();
  } catch (error) {
    console.error("Failed to toggle skill definition status", error);
    updateLoadState(`Skill 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleMcpStatusToggle(serverId) {
  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法切换 MCP 状态", true);
    return;
  }

  try {
    state.mcpServers = await desktopApi.toggleMcpServerStatus(serverId);
    updateLoadState("MCP 状态已更新");
    renderApp();
  } catch (error) {
    console.error("Failed to toggle mcp server status", error);
    updateLoadState(`MCP 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleAgentDelete(profileId) {
  const desktopApi = getDesktopApi();
  const profile = state.agentProfiles.find((entry) => entry.id === profileId);

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法删除 Agent", true);
    return;
  }

  if (!profile || !window.confirm(`确认删除 Agent「${profile.name}」吗？`)) {
    return;
  }

  try {
    state.agentProfiles = await desktopApi.deleteAgentProfile(profileId);
    updateLoadState("Agent 已删除");
    renderApp();
  } catch (error) {
    console.error("Failed to delete agent profile", error);
    updateLoadState(`Agent 删除失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleSkillDelete(skillId) {
  const desktopApi = getDesktopApi();
  const skill = state.skillDefinitions.find((entry) => entry.id === skillId);

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法删除 Skill", true);
    return;
  }

  if (!skill || !window.confirm(`确认删除 Skill「${skill.name}」吗？`)) {
    return;
  }

  try {
    state.skillDefinitions = await desktopApi.deleteSkillDefinition(skillId);
    updateLoadState("Skill 已删除");
    renderApp();
  } catch (error) {
    console.error("Failed to delete skill definition", error);
    updateLoadState(`Skill 删除失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

async function handleMcpDelete(serverId) {
  const desktopApi = getDesktopApi();
  const server = state.mcpServers.find((entry) => entry.id === serverId);

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪，暂无法删除 MCP Server", true);
    return;
  }

  if (!server || !window.confirm(`确认删除 MCP Server「${server.name}」吗？`)) {
    return;
  }

  try {
    state.mcpServers = await desktopApi.deleteMcpServer(serverId);
    updateLoadState("MCP Server 已删除");
    renderApp();
  } catch (error) {
    console.error("Failed to delete mcp server", error);
    updateLoadState(`MCP 删除失败：${error instanceof Error ? error.message : "未知错误"}`, true);
  }
}

function bindInteractions() {
  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
      return;
    }

    const homeSettingsMenu = getHomeSettingsMenu();

    if (homeSettingsMenu?.open && !target.closest("#home-settings-menu")) {
      homeSettingsMenu.open = false;
    }

    const featureTrigger = target.closest("[data-select-feature]");

    if (featureTrigger) {
      const featureId = featureTrigger.getAttribute("data-select-feature");

      if (featureId) {
        setActiveFeature(featureId);
      }

      return;
    }

    const commandCopyCodeTrigger = target.closest("[data-command-copy-code]");

    if (commandCopyCodeTrigger) {
      const codeElement = commandCopyCodeTrigger.closest(".command-code-block")?.querySelector("code");

      try {
        await copyTextToClipboard(codeElement?.textContent ?? "");
        updateLoadState("代码已复制");
      } catch (error) {
        updateLoadState(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, true);
      }

      return;
    }

    const commandSessionOpenTrigger = target.closest("[data-command-session-open]");

    if (commandSessionOpenTrigger) {
      const sessionId = commandSessionOpenTrigger.getAttribute("data-command-session-open");

      if (sessionId) {
        handleCommandWorkshopSessionOpen(sessionId);
      }

      return;
    }

    const commandSessionDeleteTrigger = target.closest("[data-command-session-delete]");

    if (commandSessionDeleteTrigger) {
      const sessionId = commandSessionDeleteTrigger.getAttribute("data-command-session-delete");

      if (sessionId) {
        await handleCommandWorkshopSessionDelete(sessionId);
      }

      return;
    }

    const commandBackTrigger = target.closest("[data-command-back]");

    if (commandBackTrigger) {
      handleCommandWorkshopBack();
      return;
    }

    const commandNewSessionTrigger = target.closest("[data-command-new-session]");

    if (commandNewSessionTrigger) {
      const form = target.closest("form");
      handleCommandWorkshopNewSession(form instanceof HTMLFormElement ? form : null);
      return;
    }

    const commandPromptTrigger = target.closest("[data-command-prompt]");

    if (commandPromptTrigger) {
      const prompt = commandPromptTrigger.getAttribute("data-command-prompt");

      if (prompt) {
        handleCommandWorkshopPromptFill(prompt);
      }

      return;
    }

    const commandOpenSettingsTrigger = target.closest("[data-command-open-settings]");

    if (commandOpenSettingsTrigger) {
      const form = target.closest("form");
      setCommandWorkshopComposerView("settings", form instanceof HTMLFormElement ? form : null);
      return;
    }

    const commandCloseSettingsTrigger = target.closest("[data-command-close-settings]");

    if (commandCloseSettingsTrigger) {
      const form = target.closest("form");
      setCommandWorkshopComposerView("input", form instanceof HTMLFormElement ? form : null);
      return;
    }

    const commandLoadToolsTrigger = target.closest("[data-command-load-mcp-tools]");

    if (commandLoadToolsTrigger) {
      const form = target.closest("form");

      if (form instanceof HTMLFormElement) {
        await handleCommandWorkshopLoadMcpTools(form);
      }

      return;
    }

    const extensionsBackTrigger = target.closest("[data-extensions-back]");

    if (extensionsBackTrigger) {
      returnToExtensionsList();
      return;
    }

    const extensionCreateTrigger = target.closest("[data-extension-create]");

    if (extensionCreateTrigger) {
      const kind = extensionCreateTrigger.getAttribute("data-extension-create");

      if (kind === "agent" || kind === "skill" || kind === "skill-import" || kind === "mcp") {
        openExtensionsEditor(kind);
      }

      return;
    }

    const agentRunnerTrigger = target.closest("[data-agent-runner]");

    if (agentRunnerTrigger) {
      const agentId = agentRunnerTrigger.getAttribute("data-agent-runner");

      if (agentId) {
        openAgentRunner(agentId);
      }

      return;
    }

    const agentRunnerResetTrigger = target.closest("[data-agent-runner-reset]");

    if (agentRunnerResetTrigger) {
      handleAgentRunnerReset();
      return;
    }

    const agentLoadMcpToolsTrigger = target.closest("[data-agent-load-mcp-tools]");

    if (agentLoadMcpToolsTrigger) {
      const form = target.closest("form");

      if (form instanceof HTMLFormElement) {
        await handleAgentRunnerLoadMcpTools(form);
      }

      return;
    }

    const agentEditTrigger = target.closest("[data-agent-edit]");

    if (agentEditTrigger) {
      const profileId = agentEditTrigger.getAttribute("data-agent-edit");

      if (profileId) {
        const profile = state.agentProfiles.find((entry) => entry.id === profileId);

        if (profile) {
          openExtensionsEditor("agent", profile);
        }
      }

      return;
    }

    const skillEditTrigger = target.closest("[data-skill-edit]");

    if (skillEditTrigger) {
      const skillId = skillEditTrigger.getAttribute("data-skill-edit");

      if (skillId) {
        const skill = getSkillDefinitionById(skillId);

        if (skill) {
          openExtensionsEditor("skill", skill);
        }
      }

      return;
    }

    const mcpEditTrigger = target.closest("[data-mcp-edit]");

    if (mcpEditTrigger) {
      const serverId = mcpEditTrigger.getAttribute("data-mcp-edit");

      if (serverId) {
        const server = getMcpServerById(serverId);

        if (server) {
          openExtensionsEditor("mcp", server);
        }
      }

      return;
    }

    const agentStatusTrigger = target.closest("[data-agent-status-toggle]");

    if (agentStatusTrigger) {
      const profileId = agentStatusTrigger.getAttribute("data-agent-status-toggle");

      if (profileId) {
        await handleAgentStatusToggle(profileId);
      }

      return;
    }

    const skillStatusTrigger = target.closest("[data-skill-status-toggle]");

    if (skillStatusTrigger) {
      const skillId = skillStatusTrigger.getAttribute("data-skill-status-toggle");

      if (skillId) {
        await handleSkillStatusToggle(skillId);
      }

      return;
    }

    const mcpStatusTrigger = target.closest("[data-mcp-status-toggle]");

    if (mcpStatusTrigger) {
      const serverId = mcpStatusTrigger.getAttribute("data-mcp-status-toggle");

      if (serverId) {
        await handleMcpStatusToggle(serverId);
      }

      return;
    }

    const agentDeleteTrigger = target.closest("[data-agent-delete]");

    if (agentDeleteTrigger) {
      const profileId = agentDeleteTrigger.getAttribute("data-agent-delete");

      if (profileId) {
        await handleAgentDelete(profileId);
      }

      return;
    }

    const skillDeleteTrigger = target.closest("[data-skill-delete]");

    if (skillDeleteTrigger) {
      const skillId = skillDeleteTrigger.getAttribute("data-skill-delete");

      if (skillId) {
        await handleSkillDelete(skillId);
      }

      return;
    }

    const mcpDeleteTrigger = target.closest("[data-mcp-delete]");

    if (mcpDeleteTrigger) {
      const serverId = mcpDeleteTrigger.getAttribute("data-mcp-delete");

      if (serverId) {
        await handleMcpDelete(serverId);
      }

      return;
    }

    const activateTrigger = target.closest("[data-model-activate]");

    if (activateTrigger) {
      const profileId = activateTrigger.getAttribute("data-model-activate");

      if (profileId) {
        await handleModelActivate(profileId);
      }

      return;
    }

    const statusToggleTrigger = target.closest("[data-model-status-toggle]");

    if (statusToggleTrigger) {
      const profileId = statusToggleTrigger.getAttribute("data-model-status-toggle");

      if (profileId) {
        await handleModelStatusToggle(profileId);
      }

      return;
    }

    const editTrigger = target.closest("[data-model-edit]");

    if (editTrigger) {
      const profileId = editTrigger.getAttribute("data-model-edit");

      if (profileId) {
        handleModelEdit(profileId);
      }

      return;
    }

    const deleteTrigger = target.closest("[data-model-delete]");

    if (deleteTrigger) {
      const profileId = deleteTrigger.getAttribute("data-model-delete");

      if (profileId) {
        await handleModelDelete(profileId);
      }

      return;
    }

    const createTrigger = target.closest("[data-model-create]");

    if (createTrigger) {
      handleStartNewProfile();
      return;
    }

    const backTrigger = target.closest("[data-model-back]");

    if (backTrigger) {
      handleModelManagementBack();
      return;
    }

    const weeklyBackTrigger = target.closest("[data-weekly-back]");

    if (weeklyBackTrigger) {
      handleWeeklyProgressBack();
      return;
    }

    const cancelTrigger = target.closest("[data-model-cancel]");

    if (cancelTrigger) {
      handleEditorCancel();
      return;
    }

    const providerTrigger = target.closest("[data-provider-select]");

    if (providerTrigger) {
      const provider = providerTrigger.getAttribute("data-provider-select");

      if (provider) {
        handleProviderSelect(provider);
      }

      return;
    }

    const modelChip = target.closest("[data-model-chip]");

    if (modelChip) {
      const modelValue = modelChip.getAttribute("data-model-chip");
      const input = document.querySelector("input[name='model']");

      if (input instanceof HTMLInputElement && modelValue) {
        input.value = modelValue;
      }

      return;
    }

    const weeklySelectTrigger = target.closest("[data-weekly-select]");

    if (weeklySelectTrigger) {
      const recordId = weeklySelectTrigger.getAttribute("data-weekly-select");

      if (recordId) {
        setActiveWeeklyProgress(recordId);
      }

      return;
    }

    const weeklyDeleteTrigger = target.closest("[data-weekly-delete]");

    if (weeklyDeleteTrigger) {
      const recordId = weeklyDeleteTrigger.getAttribute("data-weekly-delete");

      if (recordId) {
        await handleWeeklyProgressDelete(recordId);
      }

      return;
    }

    const weeklyAddProjectTrigger = target.closest("[data-weekly-add-project]");

    if (weeklyAddProjectTrigger) {
      addWeeklyProject();
      return;
    }

    const weeklyToggleProjectTrigger = target.closest("[data-weekly-toggle-project]");

    if (weeklyToggleProjectTrigger) {
      const projectId = weeklyToggleProjectTrigger.getAttribute("data-weekly-toggle-project");

      if (projectId) {
        toggleWeeklyProjectCollapsed(projectId);
        renderApp();
      }

      return;
    }

    const weeklyRemoveProjectTrigger = target.closest("[data-weekly-remove-project]");

    if (weeklyRemoveProjectTrigger) {
      const projectId = weeklyRemoveProjectTrigger.getAttribute("data-weekly-remove-project");

      if (projectId) {
        removeWeeklyProject(projectId);
      }

      return;
    }

    const weeklyAddTaskTrigger = target.closest("[data-weekly-add-task]");

    if (weeklyAddTaskTrigger) {
      const projectId = weeklyAddTaskTrigger.getAttribute("data-weekly-add-task");

      if (projectId) {
        addWeeklyTask(projectId);
      }

      return;
    }

    const weeklyRemoveTaskTrigger = target.closest("[data-weekly-remove-task]");

    if (weeklyRemoveTaskTrigger) {
      const projectId = weeklyRemoveTaskTrigger.getAttribute("data-weekly-task-project-id");
      const taskId = weeklyRemoveTaskTrigger.getAttribute("data-weekly-remove-task");

      if (projectId && taskId) {
        removeWeeklyTask(projectId, taskId);
      }

      return;
    }

    const weeklyProjectNoteRewriteTrigger = target.closest("[data-weekly-polish-project-note]");

    if (weeklyProjectNoteRewriteTrigger) {
      const projectId = weeklyProjectNoteRewriteTrigger.getAttribute("data-weekly-polish-project-note");

      if (projectId) {
        await handleWeeklyProjectNoteRewrite(projectId);
      }

      return;
    }

    const weeklyTaskRewriteTrigger = target.closest("[data-weekly-polish-task]");

    if (weeklyTaskRewriteTrigger) {
      const projectId = weeklyTaskRewriteTrigger.getAttribute("data-weekly-task-project-id");
      const taskId = weeklyTaskRewriteTrigger.getAttribute("data-weekly-polish-task");

      if (projectId && taskId) {
        await handleWeeklyTaskRewrite(projectId, taskId);
      }

      return;
    }

    const weeklyReportTrigger = target.closest("[data-weekly-generate-report]");

    if (weeklyReportTrigger) {
      await handleWeeklyProgressReportGeneration();
      return;
    }

  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const homeSettingsMenu = getHomeSettingsMenu();

    if (homeSettingsMenu?.open) {
      homeSettingsMenu.open = false;
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const featureTrigger = target ? target.closest("[data-select-feature]") : null;

    if (!featureTrigger || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();

    const featureId = featureTrigger.getAttribute("data-select-feature");

    if (featureId) {
      setActiveFeature(featureId);
    }
  });

  document.addEventListener("keydown", (event) => {
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;

    if (!textarea || !textarea.matches("[data-weekly-smart-indent='true']")) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      handleIndentTextarea(textarea, event.shiftKey);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSmartEnter(textarea);
    }
  });

  document.addEventListener("keydown", (event) => {
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;

    if (!textarea || textarea.id !== "command-workshop-input" || event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const form = textarea.closest("form");

    if (!(form instanceof HTMLFormElement) || state.commandWorkshop.isRunning) {
      return;
    }

    event.preventDefault();
    form.requestSubmit();
  });

  document.addEventListener("input", (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (syncWeeklyProgressDraftField(target)) {
      return;
    }

    const form = target.closest("form");

    if (!(form instanceof HTMLFormElement) || form.id !== "command-workshop-form") {
      return;
    }

    if (target.name === "userInput" || target.name === "mcpArgumentsText") {
      applyCommandWorkshopSnapshot(readCommandWorkshopFormSnapshot(form));
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (syncWeeklyProgressDraftField(target)) {
      return;
    }

    const form = target.closest("form");

    if (!(form instanceof HTMLFormElement) || form.id !== "command-workshop-form") {
      return;
    }

    const snapshot = readCommandWorkshopFormSnapshot(form);

    if (target.name === "agentProfileId") {
      state.commandWorkshop.availableMcpTools = [];
      applyCommandWorkshopSnapshot({
        ...snapshot,
        config: {
          ...snapshot.config,
          mcpServerId: "",
          mcpToolName: ""
        }
      });
      renderApp();
      return;
    }

    if (target.name === "mcpServerId") {
      state.commandWorkshop.availableMcpTools = [];
      applyCommandWorkshopSnapshot({
        ...snapshot,
        config: {
          ...snapshot.config,
          mcpToolName: ""
        }
      });
      renderApp();
      return;
    }

    applyCommandWorkshopSnapshot(snapshot);
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;

    if (!form) {
      return;
    }

    if (form.id === "model-profile-form") {
      event.preventDefault();
      await handleProfileSubmit(form);
      return;
    }

    if (form.id === "weekly-progress-form") {
      event.preventDefault();
      await handleWeeklyProgressSave(form);
      return;
    }

    if (form.id === "agent-profile-form") {
      event.preventDefault();
      await handleAgentProfileSubmit(form);
      return;
    }

    if (form.id === "skill-definition-form") {
      event.preventDefault();
      await handleSkillDefinitionSubmit(form);
      return;
    }

    if (form.id === "skill-github-import-form") {
      event.preventDefault();
      await handleSkillGithubImportSubmit(form);
      return;
    }

    if (form.id === "mcp-server-form") {
      event.preventDefault();
      await handleMcpServerSubmit(form);
      return;
    }

    if (form.id === "agent-runner-form") {
      event.preventDefault();
      await handleAgentRunnerSubmit(form);
      return;
    }

    if (form.id === "command-workshop-form") {
      event.preventDefault();
      await handleCommandWorkshopSubmit(form);
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  renderApp();
  bindInteractions();

  const desktopApi = getDesktopApi();

  if (!desktopApi) {
    updateLoadState("桌面桥接未就绪");
    return;
  }

  try {
    const [snapshot, modelSettings] = await Promise.all([
      desktopApi.bootstrap(),
      desktopApi.listModelSettings()
    ]);

    state.snapshot = snapshot;
    state.modelSettings = modelSettings;
    syncWeeklyProgressSelection(snapshot.weeklyProgress ?? []);
    syncExtensionsState(snapshot);
    syncCommandWorkshopState(snapshot.commandWorkshopSessions ?? []);

    updateLoadState("首页已就绪");
    renderApp();
  } catch (error) {
    console.error("Failed to initialize Gordon desktop renderer", error);
    updateLoadState("工作台数据加载失败", true);
  }
});
