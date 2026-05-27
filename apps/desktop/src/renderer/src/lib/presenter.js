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
    description: "围绕 Agent、Skill 与工具上下文进行多轮对话、执行和链路回看。"
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
export const BUILTIN_GORDON_TOOLS_MCP_ID = "builtin:mcp:gordon-tools";
export const BUILTIN_APPLICATION_TOOLS_MCP_ID = "builtin:mcp:application-tools";
export const BUILTIN_WORKBENCH_ID_PREFIX = "builtin:";
export const SKILL_DISPLAY_NAME_MAP = {
  plan: "任务拆解",
  code: "代码助手",
  review: "问题审查",
  "karpathy-guidelines": "Karpathy 准则",
  "self-improvement": "自我改进",
  "deep-research": "深度研究",
  "skill-creator": "Skill 创建"
};

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

export function getSkillDisplayName(skillOrName) {
  const rawName = typeof skillOrName === "string" ? skillOrName : String(skillOrName?.name ?? "");
  return SKILL_DISPLAY_NAME_MAP[rawName] ?? rawName;
}

export function getSkillOptionLabel(skill) {
  const rawName = String(skill?.name ?? "");
  const displayName = getSkillDisplayName(rawName);
  return displayName && displayName !== rawName ? `${displayName} / ${rawName}` : rawName;
}

export function getSkillSourceLabel(skill) {
  if (isBuiltinWorkbenchItem(skill?.id)) {
    return "内置";
  }

  if (skill?.source?.type === "github") {
    return "GitHub";
  }

  return skill?.source?.localPath?.trim() ? "本地 Skill" : "手工定义";
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
  return skill?.source?.localPath?.trim() || "";
}

export function formatFailureKind(failureKind) {
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
  const defaultTimestamp = new Date().toISOString();
  const createdAt = task ? String(task?.createdAt ?? task?.updatedAt ?? "").trim() : defaultTimestamp;
  const updatedAt = task ? String(task?.updatedAt ?? task?.createdAt ?? "").trim() : defaultTimestamp;

  return {
    id: task?.id ?? createWeeklyDraftId("weekly_task"),
    title: task?.title ?? "",
    detail: task?.detail ?? "",
    status: normalizeWeeklyProgressItemStatus(task?.status ?? "planned"),
    createdAt,
    updatedAt: updatedAt || createdAt,
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
    generatedDailyReport: String(record.generatedDailyReport ?? ""),
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
    createdAt: String(task.createdAt ?? task.updatedAt ?? "").trim(),
    updatedAt: String(task.updatedAt ?? task.createdAt ?? "").trim(),
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
    generatedDailyReport: String(record.generatedDailyReport ?? "").trim(),
    generatedReport: String(record.generatedReport ?? "").trim(),
    projects,
    content: serializeWeeklyProgressProjects(projects)
  };
}

const MATH_SYMBOL_MAP = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  Gamma: "Γ",
  delta: "δ",
  Delta: "Δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  Theta: "Θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  Lambda: "Λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  Xi: "Ξ",
  pi: "π",
  Pi: "Π",
  rho: "ρ",
  sigma: "σ",
  Sigma: "Σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "φ",
  Phi: "Φ",
  chi: "χ",
  psi: "ψ",
  Psi: "Ψ",
  omega: "ω",
  Omega: "Ω",
  partial: "∂",
  nabla: "∇",
  infty: "∞",
  infinity: "∞",
  sum: "∑",
  prod: "∏",
  int: "∫",
  oint: "∮",
  lim: "lim",
  cdot: "·",
  times: "×",
  div: "÷",
  pm: "±",
  mp: "∓",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  sim: "∼",
  propto: "∝",
  equiv: "≡",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  forall: "∀",
  exists: "∃",
  neg: "¬",
  land: "∧",
  lor: "∨",
  cap: "∩",
  cup: "∪",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  in: "∈",
  notin: "∉",
  emptyset: "∅",
  degree: "°",
  circ: "∘",
  bullet: "•",
  ldots: "…",
  cdots: "⋯"
};

const MATH_SPACING_COMMANDS = new Set(["quad", "qquad", "thinspace", "medspace", "space"]);
const MATH_IGNORED_COMMANDS = new Set(["left", "right", "middle", "!", ",", ";", ":"]);
const MATH_TEXT_COMMANDS = new Set(["text", "mathrm", "mathbf", "mathit", "operatorname"]);

function findClosingBraceIndex(value, openingIndex) {
  if (value[openingIndex] !== "{") {
    return -1;
  }

  let depth = 0;

  for (let index = openingIndex; index < value.length; index += 1) {
    const char = value[index];

    if (char === "\\" && index + 1 < value.length) {
      index += 1;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function readMathGroup(value, startIndex) {
  if (value[startIndex] === "{") {
    const endIndex = findClosingBraceIndex(value, startIndex);

    if (endIndex === -1) {
      return null;
    }

    return {
      content: value.slice(startIndex + 1, endIndex),
      endIndex
    };
  }

  if (value[startIndex] === "\\") {
    const commandMatch = value.slice(startIndex).match(/^\\[A-Za-z]+/);

    if (commandMatch) {
      return {
        content: commandMatch[0],
        endIndex: startIndex + commandMatch[0].length - 1
      };
    }
  }

  if (startIndex < value.length) {
    return {
      content: value[startIndex],
      endIndex: startIndex
    };
  }

  return null;
}

function renderMathText(expression) {
  const source = String(expression ?? "").trim();
  let index = 0;
  let html = "";

  while (index < source.length) {
    const rest = source.slice(index);

    if (rest.startsWith("\\frac")) {
      let cursor = index + "\\frac".length;

      while (source[cursor] === " ") {
        cursor += 1;
      }

      const numerator = readMathGroup(source, cursor);

      if (numerator) {
        cursor = numerator.endIndex + 1;

        while (source[cursor] === " ") {
          cursor += 1;
        }

        const denominator = readMathGroup(source, cursor);

        if (denominator) {
          html += `<span class="command-math-fraction"><span>${renderMathText(numerator.content)}</span><span>${renderMathText(
            denominator.content
          )}</span></span>`;
          index = denominator.endIndex + 1;
          continue;
        }
      }
    }

    if (rest.startsWith("\\sqrt")) {
      let cursor = index + "\\sqrt".length;

      while (source[cursor] === " ") {
        cursor += 1;
      }

      const radicand = readMathGroup(source, cursor);

      if (radicand) {
        html += `<span class="command-math-root"><span class="command-math-root-mark">√</span><span class="command-math-root-body">${renderMathText(
          radicand.content
        )}</span></span>`;
        index = radicand.endIndex + 1;
        continue;
      }
    }

    if (source[index] === "^" || source[index] === "_") {
      const tagName = source[index] === "^" ? "sup" : "sub";
      const group = readMathGroup(source, index + 1);

      if (group) {
        html += `<${tagName}>${renderMathText(group.content)}</${tagName}>`;
        index = group.endIndex + 1;
        continue;
      }
    }

    if (source[index] === "\\") {
      const commandMatch = source.slice(index).match(/^\\([A-Za-z]+)/);

      if (commandMatch) {
        const command = commandMatch[1];

        if (MATH_IGNORED_COMMANDS.has(command)) {
          html += "";
        } else if (MATH_TEXT_COMMANDS.has(command)) {
          const group = readMathGroup(source, index + commandMatch[0].length);

          if (group) {
            html += `<span class="command-math-text">${renderMathText(group.content)}</span>`;
            index = group.endIndex + 1;
            continue;
          }

          html += escapeHtml(command);
        } else if (MATH_SPACING_COMMANDS.has(command)) {
          html += " ";
        } else {
          html += escapeHtml(MATH_SYMBOL_MAP[command] ?? command);
        }

        index += commandMatch[0].length;
        continue;
      }

      if (MATH_IGNORED_COMMANDS.has(source[index + 1])) {
        index += 2;
        continue;
      }

      if (index + 1 < source.length) {
        html += escapeHtml(source[index + 1]);
        index += 2;
        continue;
      }
    }

    if (source[index] === "{") {
      const groupEndIndex = findClosingBraceIndex(source, index);

      if (groupEndIndex !== -1) {
        html += renderMathText(source.slice(index + 1, groupEndIndex));
        index = groupEndIndex + 1;
        continue;
      }
    }

    html += escapeHtml(source[index]);
    index += 1;
  }

  return html.replace(/\s{2,}/g, " ");
}

function normalizeMathExpression(expression) {
  return String(expression ?? "")
    .trim()
    .replace(/^\\begin\{equation\*?\}/, "")
    .replace(/\\end\{equation\*?\}$/, "")
    .trim();
}

function renderMathInline(expression) {
  const normalized = normalizeMathExpression(expression);

  if (!normalized) {
    return "";
  }

  return `<span class="command-math-inline" title="${escapeHtml(normalized)}">${renderMathText(normalized)}</span>`;
}

function renderMathBlock(expression) {
  const normalized = normalizeMathExpression(expression);

  if (!normalized) {
    return "";
  }

  return `<div class="command-math-block" title="${escapeHtml(normalized)}"><span class="command-math-block-content">${renderMathText(
    normalized
  )}</span></div>`;
}

function findInlineMathEnd(value, startIndex, delimiter) {
  for (let index = startIndex; index < value.length; index += 1) {
    if (delimiter === "$") {
      if (value[index] === "$") {
        return index;
      }
    } else if (value.startsWith(delimiter, index)) {
      return index;
    }

    if (value[index] === "\\" && index + 1 < value.length) {
      index += 1;
      continue;
    }
  }

  return -1;
}

function renderPlainInlineText(text) {
  const source = String(text ?? "");
  let index = 0;
  let html = "";

  while (index < source.length) {
    if (source.startsWith("**", index)) {
      const endIndex = source.indexOf("**", index + 2);

      if (endIndex !== -1) {
        const inner = source.slice(index + 2, endIndex);

        if (inner.trim()) {
          html += `<strong>${renderPlainInlineText(inner)}</strong>`;
          index = endIndex + 2;
          continue;
        }
      }
    }

    if (source[index] === "*" && source[index + 1] !== "*") {
      const endIndex = source.indexOf("*", index + 1);

      if (endIndex !== -1) {
        const inner = source.slice(index + 1, endIndex);

        if (inner.trim() && !inner.includes("\n")) {
          html += `<em>${renderPlainInlineText(inner)}</em>`;
          index = endIndex + 1;
          continue;
        }
      }
    }

    html += escapeHtml(source[index]);
    index += 1;
  }

  return html;
}

function formatInlineText(text) {
  const source = String(text ?? "");
  let index = 0;
  let buffer = "";
  let html = "";

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }

    html += renderPlainInlineText(buffer);
    buffer = "";
  };

  while (index < source.length) {
    if (source[index] === "`") {
      const endIndex = source.indexOf("`", index + 1);

      if (endIndex !== -1) {
        flushBuffer();
        html += `<code class="command-inline-code">${escapeHtml(source.slice(index + 1, endIndex))}</code>`;
        index = endIndex + 1;
        continue;
      }
    }

    if (source.startsWith("\\(", index)) {
      const endIndex = findInlineMathEnd(source, index + 2, "\\)");

      if (endIndex !== -1) {
        flushBuffer();
        html += renderMathInline(source.slice(index + 2, endIndex));
        index = endIndex + 2;
        continue;
      }
    }

    if (
      source[index] === "$" &&
      source[index + 1] !== "$" &&
      source[index - 1] !== "\\" &&
      !/\s/.test(source[index + 1] ?? "")
    ) {
      const endIndex = findInlineMathEnd(source, index + 1, "$");

      if (endIndex !== -1 && !/\s/.test(source[endIndex - 1] ?? "")) {
        flushBuffer();
        html += renderMathInline(source.slice(index + 1, endIndex));
        index = endIndex + 1;
        continue;
      }
    }

    buffer += source[index];
    index += 1;
  }

  flushBuffer();
  return html;
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

function parseOrderedListMarker(markerToken) {
  const rawToken = String(markerToken ?? "").trim();

  if (!rawToken) {
    return null;
  }

  const normalizedToken = rawToken.endsWith(")") ? `${rawToken.slice(0, -1)}.` : rawToken;
  const markerCore = normalizedToken.endsWith(".") ? normalizedToken.slice(0, -1) : normalizedToken;

  if (!/^\d+(?:\.\d+)*$/.test(markerCore)) {
    return null;
  }

  const segments = markerCore.split(".").filter(Boolean);

  if (!segments.length) {
    return null;
  }

  return {
    core: markerCore,
    display: segments.length > 1 ? markerCore : `${segments[0]}.`,
    outlineDepth: Math.max(0, segments.length - 1)
  };
}

export function getMarkdownListLineMeta(line) {
  const match = String(line ?? "").match(/^(\s*)([*+-]|\d+(?:\.\d+)*\.?|\d+\))\s+(.*)$/);

  if (!match) {
    return null;
  }

  const indentWidth = match[1].replace(/\t/g, "    ").length;
  const orderedMeta = parseOrderedListMarker(match[2]);

  if (orderedMeta) {
    return {
      indent: indentWidth,
      nestingIndent: Math.max(indentWidth, orderedMeta.outlineDepth * 4),
      ordered: true,
      marker: orderedMeta.display,
      text: match[3]
    };
  }

  return {
    indent: indentWidth,
    nestingIndent: indentWidth,
    ordered: false,
    marker: match[2],
    text: match[3]
  };
}

function parseListBlock(lines, startIndex, baseIndent = null) {
  let index = startIndex;
  let ordered = null;
  const items = [];

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const meta = getMarkdownListLineMeta(line);

    if (!meta) {
      break;
    }

    if (baseIndent === null) {
      baseIndent = meta.nestingIndent;
    }

    if (meta.nestingIndent < baseIndent) {
      break;
    }

    if (meta.nestingIndent > baseIndent) {
      if (!items.length) {
        index += 1;
        continue;
      }

      const nested = parseListBlock(lines, index, meta.nestingIndent);
      items[items.length - 1].children.push(nested.list);
      index = nested.index;
      continue;
    }

    if (ordered === null) {
      ordered = meta.ordered;
    }

    if (meta.ordered !== ordered) {
      break;
    }

    items.push({
      marker: meta.ordered ? meta.marker : null,
      text: meta.text,
      children: []
    });
    index += 1;
  }

  return {
    list: {
      ordered: Boolean(ordered),
      items
    },
    index
  };
}

function renderListTree(list, depth = 0) {
  const tagName = list?.ordered ? "ol" : "ul";
  const items = Array.isArray(list?.items) ? list.items : [];
  const useExplicitMarkers = Boolean(list?.ordered);

  return `
    <${tagName} class="command-rich-list command-rich-list-depth-${depth}"${
      useExplicitMarkers ? ' style="list-style: none; padding-left: 22px;"' : ""
    }>
      ${items
        .map((item) => {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0;
          const children = hasChildren ? item.children.map((child) => renderListTree(child, depth + 1)).join("") : "";
          const marker = useExplicitMarkers && item.marker ? `<span class="command-rich-list-marker">${escapeHtml(item.marker)}</span> ` : "";
          return `
            <li class="command-rich-list-item command-rich-list-item-depth-${depth}${hasChildren ? " has-children" : ""}">
              <span class="command-rich-list-item-content">${marker}${formatInlineText(item.text)}</span>${children}
            </li>
          `;
        })
        .join("")}
    </${tagName}>
  `;
}

function splitMarkdownTableRow(line) {
  const trimmed = String(line ?? "").trim();
  const withoutOuterPipes = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let escaped = false;

  for (const char of withoutOuterPipes) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function getMarkdownTableAlignments(line) {
  const cells = splitMarkdownTableRow(line);

  if (!cells.length || !cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))) {
    return null;
  }

  return cells.map((cell) => {
    const trimmed = cell.trim();

    if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
      return "center";
    }

    if (trimmed.endsWith(":")) {
      return "right";
    }

    return "left";
  });
}

function isMarkdownTableStart(lines, index) {
  if (index + 1 >= lines.length) {
    return false;
  }

  const headerCells = splitMarkdownTableRow(lines[index]);
  const alignments = getMarkdownTableAlignments(lines[index + 1]);

  return lines[index].includes("|") && headerCells.length >= 2 && Array.isArray(alignments) && alignments.length >= 2;
}

function renderMarkdownTable(lines, startIndex) {
  const headerCells = splitMarkdownTableRow(lines[startIndex]);
  const alignments = getMarkdownTableAlignments(lines[startIndex + 1]) ?? [];
  const bodyRows = [];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    const cells = splitMarkdownTableRow(lines[index]);

    if (cells.length >= 2) {
      bodyRows.push(cells);
      index += 1;
      continue;
    }

    break;
  }

  const cellCount = Math.max(headerCells.length, alignments.length, ...bodyRows.map((row) => row.length));
  const renderCell = (cell, cellIndex, tagName) => {
    const alignment = alignments[cellIndex] ?? "left";
    const alignClass = alignment === "center" || alignment === "right" ? ` is-${alignment}` : "";

    return `<${tagName} class="command-rich-table-cell${alignClass}">${formatInlineText(cell ?? "")}</${tagName}>`;
  };

  const headerHtml = Array.from({ length: cellCount }, (_, cellIndex) => renderCell(headerCells[cellIndex], cellIndex, "th")).join("");
  const bodyHtml = bodyRows
    .map((row) => {
      const rowHtml = Array.from({ length: cellCount }, (_, cellIndex) => renderCell(row[cellIndex], cellIndex, "td")).join("");
      return `<tr>${rowHtml}</tr>`;
    })
    .join("");

  return {
    html: `
      <div class="command-rich-table-wrap">
        <table class="command-rich-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `,
    index
  };
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
  const isBlockMathStartLine = (line) => ["$$", "\\["].includes(line.trim());
  const getSingleLineBlockMath = (line) => {
    const trimmed = String(line ?? "").trim();

    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
      return trimmed.slice(2, -2);
    }

    if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]") && trimmed.length > 4) {
      return trimmed.slice(2, -2);
    }

    return null;
  };
  const isDividerLine = (line) => /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  const isHeadingLine = (line) => /^(#{1,3})\s+/.test(line);
  const isQuoteLine = (line) => /^>\s?/.test(line);
  const isListLine = (line) => Boolean(getMarkdownListLineMeta(line));
  const isBoundaryLine = (line) =>
    !line.trim() ||
    isCodeFenceLine(line) ||
    getSingleLineBlockMath(line) !== null ||
    isBlockMathStartLine(line) ||
    isDividerLine(line) ||
    isHeadingLine(line) ||
    isQuoteLine(line) ||
    isListLine(line) ||
    isMarkdownTableStart(lines, index);

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

    const singleLineBlockMath = getSingleLineBlockMath(line);

    if (singleLineBlockMath !== null) {
      blocks.push(renderMathBlock(singleLineBlockMath));
      index += 1;
      continue;
    }

    if (isBlockMathStartLine(line)) {
      const startToken = line.trim();
      const endToken = startToken === "$$" ? "$$" : "\\]";
      const mathLines = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== endToken) {
        mathLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].trim() === endToken) {
        index += 1;
      }

      blocks.push(renderMathBlock(mathLines.join("\n")));
      continue;
    }

    if (isDividerLine(line)) {
      blocks.push('<hr class="command-rich-divider" />');
      index += 1;
      continue;
    }

    if (isHeadingLine(line)) {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      const depth = match?.[1]?.length ?? 1;
      const tagName = `h${Math.min(depth + 2, 6)}`;
      blocks.push(
        `<${tagName} class="command-rich-heading command-rich-heading-depth-${depth}">${formatInlineText(match?.[2] ?? line)}</${tagName}>`
      );
      index += 1;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const table = renderMarkdownTable(lines, index);
      blocks.push(table.html);
      index = table.index;
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

    if (isListLine(line)) {
      const parsed = parseListBlock(lines, index);
      blocks.push(renderListTree(parsed.list));
      index = parsed.index;
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
