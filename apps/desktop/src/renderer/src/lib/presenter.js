import azureLogo from "../../assets/logos/azure.svg";
import anthropicLogo from "../../assets/logos/anthropic.svg";
import deepseekLogo from "../../assets/logos/deepseek.svg";
import doubaoLogo from "../../assets/logos/doubao.svg";
import googleLogo from "../../assets/logos/google.svg";
import grokLogo from "../../assets/logos/grok.svg";
import moonshotLogo from "../../assets/logos/moonshot.svg";
import openaiLogo from "../../assets/logos/openai.svg";
import openAiLikeLogo from "../../assets/logos/openai-like.svg";
import qwenLogo from "../../assets/logos/qwen.svg";
import zhipuLogo from "../../assets/logos/zai.svg";

export const NAV_ITEMS = [
  {
    id: "home",
    label: "工作台",
    eyebrow: "Overview",
    title: "Gordon Atelier",
    description: "把模型、周报推进、命令协作和扩展能力收进一个更自由的创作式工作台。 "
  },
  {
    id: "models",
    label: "模型总控",
    eyebrow: "Model Studio",
    title: "模型总控",
    description: "统一管理供应商、激活模型和当前工作链的默认推理入口。"
  },
  {
    id: "weekly",
    label: "任务推进",
    eyebrow: "Weekly Planner",
    title: "任务推进",
    description: "按项目拆任务、维护阶段结果，并生成更像真实汇报的周报。"
  },
  {
    id: "command",
    label: "命令工坊",
    eyebrow: "Command Center",
    title: "命令工坊",
    description: "围绕 Agent、Skill 与 MCP 进行多轮对话、执行和链路回看。"
  },
  {
    id: "extensions",
    label: "能力拓展",
    eyebrow: "Capability Hub",
    title: "能力拓展",
    description: "管理 Agent、Skill 与 MCP，让工作台的能力边界持续扩展。"
  }
];

export const PROVIDER_ORDER = [
  "openai",
  "azure",
  "google",
  "anthropic",
  "doubao",
  "qwen",
  "deepseek",
  "moonshot",
  "zhipu",
  "grok",
  "openai_like"
];

export const PROVIDER_META = {
  openai: {
    label: "OpenAI",
    short: "OA",
    logo: openaiLogo,
    copy: "适合 GPT 系列和官方原生能力接入，作为默认高配路线使用。",
    popularModels: ["gpt-5.4", "gpt-4.1", "o4-mini", "gpt-4.1-mini"]
  },
  azure: {
    label: "Azure",
    short: "AZ",
    logo: azureLogo,
    copy: "适合 Azure OpenAI / Azure AI 推理终端，便于企业云上统一纳管与权限隔离。",
    popularModels: ["gpt-4.1", "gpt-4o", "o4-mini", "gpt-4.1-mini"]
  },
  google: {
    label: "Google",
    short: "GG",
    logo: googleLogo,
    copy: "适合 Gemini 系列和项目级工作流场景，长文本与检索链路更顺手。",
    popularModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"]
  },
  anthropic: {
    label: "Anthropic",
    short: "AN",
    logo: anthropicLogo,
    copy: "适合 Claude 系列和长上下文整理，文案与分析风格更稳定。",
    popularModels: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"]
  },
  doubao: {
    label: "豆包",
    short: "DB",
    logo: doubaoLogo,
    copy: "适合火山引擎路线与国内推理场景，当前按 OpenAI-compatible 方式接入。",
    popularModels: ["doubao-pro-32k", "doubao-lite-32k", "doubao-vision-pro", "doubao-embedding"]
  },
  qwen: {
    label: "千问",
    short: "QW",
    logo: qwenLogo,
    copy: "适合阿里云百炼与千问模型线路，文本、工具调用和多模态扩展都比较灵活。",
    popularModels: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-vl-max"]
  },
  deepseek: {
    label: "DeepSeek",
    short: "DS",
    logo: deepseekLogo,
    copy: "适合高性价比推理与代码场景，当前按 OpenAI-compatible 方式接入。",
    popularModels: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder", "deepseek-vl"]
  },
  moonshot: {
    label: "月之暗面",
    short: "MS",
    logo: moonshotLogo,
    copy: "适合 Kimi / Moonshot 线路的长文本整理与中文工作流，当前按兼容协议接入。",
    popularModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2"]
  },
  zhipu: {
    label: "智谱",
    short: "ZP",
    logo: zhipuLogo,
    copy: "适合 GLM 系列模型与国内推理场景，当前按 OpenAI-compatible 方式接入。",
    popularModels: ["glm-4-plus", "glm-4-air", "glm-4-flash", "glm-4v-plus"]
  },
  grok: {
    label: "Grok",
    short: "GK",
    logo: grokLogo,
    copy: "适合 xAI / Grok 模型线路，当前按 OpenAI-compatible 方式接入。",
    popularModels: ["grok-3", "grok-3-fast", "grok-2", "grok-vision-beta"]
  },
  openai_like: {
    label: "OpenAI-like",
    short: "CL",
    logo: openAiLikeLogo,
    copy: "兼容自定义网关和第三方模型线路，适合把多家模型收拢到统一协议入口。",
    popularModels: ["deepseek-chat", "kimi-k2", "qwen-max", "doubao-pro"]
  }
};

export const WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE = "未命名项目";

export const WEEKLY_PROGRESS_STATUS_META = {
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

export const EXTENSION_TABS = [
  { id: "agent", label: "Agent" },
  { id: "skill", label: "Skill" },
  { id: "mcp", label: "MCP" }
];

export const BUILTIN_GORDON_AGENT_ID = "builtin:agent:gordon";
export const BUILTIN_WORKBENCH_ID_PREFIX = "builtin:";

export function getProviderMeta(providerKind) {
  return PROVIDER_META[providerKind] ?? PROVIDER_META.openai_like;
}

export function deepClone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function truncateText(value, maxLength) {
  const compact = normalizeText(value);

  if (!compact) {
    return "";
  }

  const chars = Array.from(compact);
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join("")}...` : compact;
}

export function buildCommandWorkshopTitle(userInput) {
  const compact = normalizeText(userInput);
  return compact ? truncateText(compact, 22) : "新对话";
}

export function summarizeCommandWorkshopContent(content) {
  const compact = normalizeText(content);
  return compact ? truncateText(compact, 72) : "等待输入";
}

export function sortCommandWorkshopSessions(sessions) {
  return [...(sessions ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function buildCommandWorkshopArtifact(runLog) {
  return {
    profileLabel: runLog.profileLabel,
    model: runLog.model,
    skillName: runLog.skillName ?? null,
    autoSelectedMcp: runLog.autoSelectedMcp,
    mcpServerName: runLog.mcpServerName ?? null,
    mcpToolName: runLog.mcpToolName ?? null,
    mcpResultText: runLog.mcpResultText,
    mcpCalls: [...(runLog.mcpCalls ?? [])],
    stopReason: runLog.stopReason ?? "",
    steps: [...(runLog.steps ?? [])],
    createdAt: runLog.createdAt
  };
}

export function formatLocalDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function maskSecret(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "未配置";
  }

  if (text.length <= 8) {
    return `${text.slice(0, 2)}****`;
  }

  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

export function normalizeTagList(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stringifyEnvRecord(envRecord) {
  return Object.entries(envRecord ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function parseEnvText(rawValue) {
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

export function isBuiltinWorkbenchItem(entryId) {
  return String(entryId ?? "").startsWith(BUILTIN_WORKBENCH_ID_PREFIX);
}

export function getSkillSourceLabel(skill) {
  if (isBuiltinWorkbenchItem(skill?.id)) {
    return "内置";
  }

  if (skill?.source?.type === "github") {
    return "GitHub";
  }

  return "手工定义";
}

export function getSkillSourceDetail(skill) {
  if (skill?.source?.type === "github") {
    const repo = skill.source.repo ?? "";
    const ref = skill.source.ref ?? "";
    const skillPath = skill.source.path ?? "";
    return [repo, ref ? `@${ref}` : "", skillPath].filter(Boolean).join(" ");
  }

  return skill?.handlerRef?.trim() || "";
}

export function getSkillLocalMirrorDetail(skill) {
  if (skill?.source?.type !== "github") {
    return "";
  }

  return skill.source.localPath?.trim() || "";
}

export function normalizeWeeklyProgressItemStatus(status) {
  return Object.prototype.hasOwnProperty.call(WEEKLY_PROGRESS_STATUS_META, status) ? status : "planned";
}

export function createWeeklyDraftId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createWeeklyTaskDraft(task = null) {
  return {
    id: task?.id ?? createWeeklyDraftId("weekly_task"),
    title: task?.title ?? "",
    detail: task?.detail ?? "",
    status: normalizeWeeklyProgressItemStatus(task?.status ?? "planned"),
    children: Array.isArray(task?.children) ? task.children.map((child) => createWeeklyTaskDraft(child)) : []
  };
}

export function createWeeklyProjectDraft(project = null) {
  return {
    id: project?.id ?? createWeeklyDraftId("weekly_project"),
    title: project?.title ?? "",
    note: project?.note ?? "",
    status: normalizeWeeklyProgressItemStatus(project?.status ?? "in_progress"),
    tasks: Array.isArray(project?.tasks) ? project.tasks.map((task) => createWeeklyTaskDraft(task)) : []
  };
}

export function createWeeklyReportTemplateDraft(template = null) {
  return {
    id: template?.id ?? createWeeklyDraftId("weekly_report_template"),
    name: String(template?.name ?? ""),
    content: String(template?.content ?? ""),
    builtin: Boolean(template?.builtin)
  };
}

export function cloneWeeklyProgressRecord(record = null) {
  if (!record) {
    return null;
  }

  const reportTemplates = Array.isArray(record.reportTemplates)
    ? record.reportTemplates.map((template) => createWeeklyReportTemplateDraft(template))
    : [];

  return {
    ...deepClone(record),
    content: String(record.content ?? ""),
    reportTemplates,
    selectedReportTemplateId: String(record.selectedReportTemplateId ?? reportTemplates[0]?.id ?? ""),
    reportTemplate: String(record.reportTemplate ?? ""),
    generatedReport: String(record.generatedReport ?? ""),
    projects: Array.isArray(record.projects) ? record.projects.map((project) => createWeeklyProjectDraft(project)) : []
  };
}

export function getWeeklyProgressStatusMeta(status) {
  return WEEKLY_PROGRESS_STATUS_META[normalizeWeeklyProgressItemStatus(status)] ?? WEEKLY_PROGRESS_STATUS_META.planned;
}

function getWeeklyTaskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

function hasWeeklyTaskContent(task) {
  return Boolean(String(task?.title ?? "").trim() || String(task?.detail ?? "").trim() || getWeeklyTaskChildren(task).length);
}

function walkWeeklyTasks(tasks, visitor, parentTask = null) {
  for (const task of Array.isArray(tasks) ? tasks : []) {
    visitor(task, parentTask);
    walkWeeklyTasks(getWeeklyTaskChildren(task), visitor, task);
  }
}

export function getWeeklyProgressMetrics(record) {
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

    walkWeeklyTasks(project.tasks, (task) => {
      if (!hasWeeklyTaskContent(task)) {
        return;
      }

      metrics.taskCount += 1;

      if (task.status === "completed") {
        metrics.completedTaskCount += 1;
      } else if (task.status === "blocked") {
        metrics.blockedTaskCount += 1;
      } else if (task.status === "in_progress") {
        metrics.activeTaskCount += 1;
      }
    });
  }

  return metrics;
}

export function getWeeklyProjectMetrics(project) {
  return getWeeklyProgressMetrics({
    projects: project ? [project] : []
  });
}

export function getWeeklyProgressCompletionRate(record) {
  const metrics = getWeeklyProgressMetrics(record);

  if (!metrics.taskCount) {
    return 0;
  }

  return Math.round((metrics.completedTaskCount / metrics.taskCount) * 100);
}

export function getWeeklyProgressSummaryText(record) {
  const metrics = getWeeklyProgressMetrics(record);

  if (!metrics.projectCount && !metrics.taskCount && !metrics.noteCount) {
    return "还没有拆出本周项目，适合先按项目维度补齐。";
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

export function sanitizeWeeklyTaskDraft(task) {
  if (!task) {
    return null;
  }

  const title = String(task.title ?? "").trim();
  const detail = String(task.detail ?? "").trim();
  const children = getWeeklyTaskChildren(task).map((child) => sanitizeWeeklyTaskDraft(child)).filter(Boolean);

  if (!title && !detail && !children.length) {
    return null;
  }

  return {
    ...task,
    title: title || detail || "未命名任务",
    detail,
    status: normalizeWeeklyProgressItemStatus(task.status),
    children
  };
}

export function sanitizeWeeklyProjectDraft(project) {
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

export function serializeWeeklyProgressProjects(projects) {
  const serializeWeeklyTask = (task, depth = 1) => {
    const indent = "    ".repeat(depth);
    const detailIndent = "    ".repeat(depth + 1);
    const taskStatus = getWeeklyProgressStatusMeta(task.status).label;
    const lines = [`${indent}[${taskStatus}] ${task.title}`];

    if (task.detail) {
      lines.push(...task.detail.split("\n").map((line) => `${detailIndent}说明：${line.trim()}`));
    }

    for (const child of getWeeklyTaskChildren(task)) {
      lines.push(...serializeWeeklyTask(child, depth + 1));
    }

    return lines;
  };

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
        lines.push(...serializeWeeklyTask(task, 1));
      }

      return lines.join("\n");
    })
    .join("\n\n")
    .trim();
}

export function sanitizeWeeklyProgressRecord(record) {
  if (!record) {
    return null;
  }

  const projects = Array.isArray(record.projects)
    ? record.projects.map((project) => sanitizeWeeklyProjectDraft(project)).filter(Boolean)
    : [];
  const reportTemplates = Array.isArray(record.reportTemplates)
    ? record.reportTemplates.map((template) => createWeeklyReportTemplateDraft(template))
    : [];
  const selectedReportTemplate =
    reportTemplates.find((template) => template.id === String(record.selectedReportTemplateId ?? "").trim()) ?? reportTemplates[0] ?? null;

  return {
    ...record,
    reportTemplates,
    selectedReportTemplateId: selectedReportTemplate?.id ?? "",
    reportTemplate: String(selectedReportTemplate?.content ?? record.reportTemplate ?? "").trim(),
    generatedReport: String(record.generatedReport ?? "").trim(),
    projects,
    content: serializeWeeklyProgressProjects(projects)
  };
}

function formatInlineText(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="command-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function getCodeFamily(languageLabel = "") {
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

function getCodePatterns(family) {
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

function renderCodeToken(content, className) {
  return `<span class="${className}">${escapeHtml(content)}</span>`;
}

function tokenizeCodeLine(line, patterns) {
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

      html += renderCodeToken(match[0], pattern.className);
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

function getCodeLineState(line, family) {
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

function renderHighlightedCodeLine(line, languageLabel = "") {
  const family = getCodeFamily(languageLabel);

  if (family === "diff") {
    const prefix = line.slice(0, 1);
    const content = line.slice(1);

    if (["+", "-", "@"].includes(prefix)) {
      return `${renderCodeToken(prefix, "command-code-token-diff-symbol")}${escapeHtml(content)}`;
    }

    return escapeHtml(line);
  }

  const patterns = getCodePatterns(family);

  if (!patterns.length) {
    return escapeHtml(line);
  }

  return tokenizeCodeLine(line, patterns);
}

function renderCodeBlock(code, languageLabel = "") {
  const safeLanguage = escapeHtml(languageLabel || "text");
  const lines = String(code ?? "").split("\n");
  const family = getCodeFamily(languageLabel);
  const renderedLines = lines
    .map((line, index) => {
      const lineState = getCodeLineState(line, family);
      const content = line.length ? renderHighlightedCodeLine(line, languageLabel) : "&nbsp;";

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

export function renderRichText(content) {
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

      blocks.push(renderCodeBlock(codeLines.join("\n"), languageLabel));
      continue;
    }

    if (isHeadingLine(line)) {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      const depth = match?.[1]?.length ?? 1;
      const tagName = `h${Math.min(depth + 2, 6)}`;
      blocks.push(`<${tagName} class="command-rich-heading">${formatInlineText(match?.[2] ?? line)}</${tagName}>`);
      index += 1;
      continue;
    }

    if (isQuoteLine(line)) {
      const quoteLines = [];

      while (index < lines.length && isQuoteLine(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(`<blockquote class="command-rich-quote">${quoteLines.map((item) => formatInlineText(item)).join("<br />")}</blockquote>`);
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
        items.push(`<li>${formatInlineText(itemText)}</li>`);
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

    blocks.push(`<p class="command-rich-paragraph">${paragraphLines.map((item) => formatInlineText(item)).join("<br />")}</p>`);
  }

  return blocks.join("");
}
