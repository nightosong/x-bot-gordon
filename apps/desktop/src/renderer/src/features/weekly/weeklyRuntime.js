import { WEEKLY_NO_RISK_PATTERN, WEEKLY_RISK_KEYWORDS } from "./weeklyConfig.js";
import {
  getMarkdownListLineMeta,
  getWeeklyProgressMetrics,
  getWeeklyProgressStatusMeta,
  sanitizeWeeklyProgressRecord
} from "../../lib/presenter.js";

export function getWeeklyDraftSnapshot(record) {
  const sanitized = sanitizeWeeklyProgressRecord(record);

  if (!sanitized) {
    return "";
  }

  return JSON.stringify({
    projects: sanitized.projects,
    reportTemplates: sanitized.reportTemplates,
    selectedReportTemplateId: sanitized.selectedReportTemplateId,
    reportTemplate: sanitized.reportTemplate,
    generatedDailyReport: sanitized.generatedDailyReport,
    generatedReport: sanitized.generatedReport,
    content: sanitized.content
  });
}

export function normalizeMarkdownForClipboard(value) {
  const oddSpacePattern = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
  const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/g;
  const bulletLikePattern = /^[ \t]*[•●▪◦‣・·]\s+/;
  const statusSuffixPattern = /(?:（|\()(已完成|进行中|待开始|受阻)(?:）|\))\s*$/;
  const normalizeListIndent = (indentWidth = 0) => {
    const width = Number.isFinite(indentWidth) ? Number(indentWidth) : 0;

    if (!width) {
      return "";
    }

    return "    ".repeat(Math.max(1, Math.round(width / 4)));
  };

  const normalizedLines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(zeroWidthPattern, "")
    .replace(oddSpacePattern, " ")
    .replace(/\t/g, "    ")
    .replace(/((?:（|\()(?:已完成|进行中|待开始|受阻)(?:）|\)))(?=\\?[*+-]\s+)/g, "$1\n")
    .replace(/(\S)[ ]{2,}(?=(?:\\?[*+-]|\d+(?:\.\d+)*\.?|\d+\))\s+)/g, "$1\n")
    .split("\n")
    .map((line) => {
      let normalizedLine = line.replace(/[ ]+$/g, "");

      normalizedLine = normalizedLine.replace(/^([ ]*)\\([*+-])\s+/, "$1$2 ");

      if (bulletLikePattern.test(normalizedLine)) {
        normalizedLine = normalizedLine.replace(/^([ ]*)[•●▪◦‣・·]\s+/, "$1* ");
      }

      normalizedLine = normalizedLine.replace(/^([ ]*)([*+-])\s+/, "$1$2 ");
      normalizedLine = normalizedLine.replace(/^([ ]*)(\d+)[\.\)]\s+/, "$1$2. ");
      normalizedLine = normalizedLine.replace(/^(#{1,6})([^\s#])/, "$1 $2");
      normalizedLine = normalizedLine.replace(/^([ ]*)>([^\s>])/, "$1> $2");

      const listMeta = getMarkdownListLineMeta(normalizedLine);

      if (listMeta?.ordered) {
        normalizedLine = `${normalizeListIndent(listMeta.nestingIndent)}${listMeta.marker} ${listMeta.text.trim()}`;
      }

      return normalizedLine;
    });

  const repairedLines = [];
  let hasActiveProject = false;

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];

    if (!line.trim()) {
      const previousNonEmptyLine = [...repairedLines].reverse().find((item) => item.trim());
      const nextNonEmptyLine = normalizedLines.slice(index + 1).find((item) => item.trim());
      const isBlankLineInsideListBlock = Boolean(
        previousNonEmptyLine &&
          nextNonEmptyLine &&
          getMarkdownListLineMeta(previousNonEmptyLine) &&
          getMarkdownListLineMeta(nextNonEmptyLine)
      );

      if (isBlankLineInsideListBlock) {
        continue;
      }

      if (repairedLines[repairedLines.length - 1] !== "") {
        repairedLines.push("");
      }

      continue;
    }

    const listMeta = getMarkdownListLineMeta(line);

    if (!listMeta) {
      repairedLines.push(line);
      continue;
    }

    const content = listMeta.text.trim();

    if (!listMeta.ordered && !listMeta.nestingIndent && statusSuffixPattern.test(content) && hasActiveProject) {
      repairedLines.push(`    * ${content}`);
      continue;
    }

    if (listMeta.ordered) {
      repairedLines.push(`${normalizeListIndent(listMeta.nestingIndent)}${listMeta.marker} ${content}`);
      hasActiveProject = !listMeta.nestingIndent;
      continue;
    }

    repairedLines.push(`${normalizeListIndent(listMeta.nestingIndent)}* ${content}`);
    hasActiveProject = !listMeta.nestingIndent && !statusSuffixPattern.test(content);
  }

  return repairedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function getWeeklyTaskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

export function hasWeeklyTaskContent(task) {
  return Boolean(String(task?.title ?? "").trim() || String(task?.detail ?? "").trim() || getWeeklyTaskChildren(task).length);
}

export function walkWeeklyTasks(tasks = [], visitor, parentTask = null) {
  for (const task of Array.isArray(tasks) ? tasks : []) {
    visitor(task, parentTask);
    walkWeeklyTasks(getWeeklyTaskChildren(task), visitor, task);
  }
}

export function flattenWeeklyTasks(tasks = []) {
  const flattened = [];
  walkWeeklyTasks(tasks, (task) => {
    flattened.push(task);
  });
  return flattened;
}

export function getWeeklyTaskTimestamp(task, fieldName) {
  return String(task?.[fieldName] ?? "").trim();
}

export function touchWeeklyTask(task, timestamp = new Date().toISOString()) {
  if (!task) {
    return null;
  }

  if (!getWeeklyTaskTimestamp(task, "createdAt")) {
    task.createdAt = timestamp;
  }

  task.updatedAt = timestamp;
  return task;
}

export function getLocalDateKey(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDailyReportDateTitle(referenceDate = new Date()) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(date);
}

export function getDailyReportHeadingTitle(referenceDate = new Date()) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}/${month}/${day} 日报`;
}

export function filterWeeklyTasksToUpdatedBranches(tasks = [], todayKey = getLocalDateKey(new Date())) {
  const filtered = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const children = getWeeklyTaskChildren(task);
    const filteredChildren = filterWeeklyTasksToUpdatedBranches(children, todayKey);
    const title = String(task?.title ?? "").trim();
    const isUpdatedLeaf = !children.length && Boolean(title) && getLocalDateKey(task?.updatedAt) === todayKey;

    if (!isUpdatedLeaf && !filteredChildren.length) {
      continue;
    }

    filtered.push({
      ...task,
      title,
      detail: String(task?.detail ?? "").trim(),
      children: filteredChildren
    });
  }

  return filtered;
}

export function collectTodayUpdatedLeafTasks(projects = [], referenceDate = new Date()) {
  const todayKey = getLocalDateKey(referenceDate);
  const entries = [];

  for (const project of Array.isArray(projects) ? projects : []) {
    const projectTitle = String(project?.title ?? "").trim() || "未命名项目";

    const visit = (tasks = [], path = []) => {
      tasks.forEach((task, index) => {
        const nextPath = [...path, index + 1];
        const children = getWeeklyTaskChildren(task);
        const title = String(task?.title ?? "").trim();

        if (children.length) {
          visit(children, nextPath);
          return;
        }

        if (!title || getLocalDateKey(task?.updatedAt) !== todayKey) {
          return;
        }

        entries.push({
          projectTitle,
          taskPath: nextPath.join("."),
          title,
          statusLabel: getWeeklyProgressStatusMeta(task?.status).label,
          createdAt: getWeeklyTaskTimestamp(task, "createdAt"),
          updatedAt: getWeeklyTaskTimestamp(task, "updatedAt")
        });
      });
    };

    visit(project.tasks);
  }

  return entries;
}

export function serializeDailyReportTaskLines(tasks = [], depth = 1, todayKey = getLocalDateKey(new Date())) {
  const lines = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const indent = "    ".repeat(depth);
    const statusLabel = getWeeklyProgressStatusMeta(task?.status).label;
    const title = String(task?.title ?? "").trim() || "未命名任务";

    lines.push(`${indent}* ${title}（${statusLabel}）`);

    const children = getWeeklyTaskChildren(task);

    if (children.length) {
      lines.push(...serializeDailyReportTaskLines(children, depth + 1, todayKey));
    }
  }

  return lines;
}

export function buildDailyReportMarkdown(record, referenceDate = new Date()) {
  const todayKey = getLocalDateKey(referenceDate);
  const entries = collectTodayUpdatedLeafTasks(record?.projects ?? [], referenceDate);

  if (!entries.length) {
    return {
      entries,
      markdown: ""
    };
  }

  const lines = [];

  for (const project of Array.isArray(record?.projects) ? record.projects : []) {
    const projectTitle = String(project?.title ?? "").trim() || "未命名项目";
    const filteredTasks = filterWeeklyTasksToUpdatedBranches(project?.tasks ?? [], todayKey);

    if (!filteredTasks.length) {
      continue;
    }

    lines.push(`* ${projectTitle}`);
    lines.push(...serializeDailyReportTaskLines(filteredTasks, 1, todayKey));
    lines.push("");
  }

  return {
    entries,
    markdown: lines.join("\n").trim()
  };
}

export function extractMarkdownListDepthSignature(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => getMarkdownListLineMeta(line))
    .filter(Boolean)
    .map((meta) => Math.round((meta?.nestingIndent ?? 0) / 4))
    .join(",");
}

export function hasMatchingMarkdownHierarchy(sourceMarkdown, candidateMarkdown) {
  return extractMarkdownListDepthSignature(sourceMarkdown) === extractMarkdownListDepthSignature(candidateMarkdown);
}

export function buildDailyReportSourceContent(record) {
  const entries = collectTodayUpdatedLeafTasks(record?.projects ?? []);

  if (!entries.length) {
    return {
      entries,
      content: ""
    };
  }

  const todayKey = getLocalDateKey(new Date());
  const lines = [];

  for (const project of Array.isArray(record?.projects) ? record.projects : []) {
    const projectTitle = String(project?.title ?? "").trim() || "未命名项目";
    const filteredTasks = filterWeeklyTasksToUpdatedBranches(project?.tasks ?? [], todayKey);

    if (!filteredTasks.length) {
      continue;
    }

    lines.push(`* ${projectTitle}`);

    if (String(project?.note ?? "").trim()) {
      lines.push(...String(project.note).split("\n").map((line) => `    * 项目备注：${line.trim()}`));
    }

    lines.push(...serializeDailyReportTaskLines(filteredTasks, 1, todayKey));
    lines.push("");
  }

  return {
    entries,
    content: lines.join("\n").trim()
  };
}

export function findWeeklyTaskContext(tasks = [], taskId, parentTask = null) {
  const taskList = Array.isArray(tasks) ? tasks : [];

  for (let index = 0; index < taskList.length; index += 1) {
    const task = taskList[index];

    if (task?.id === taskId) {
      return {
        task,
        parentTask,
        tasks: taskList,
        index
      };
    }

    const childContext = findWeeklyTaskContext(getWeeklyTaskChildren(task), taskId, task);

    if (childContext) {
      return childContext;
    }
  }

  return null;
}

export function removeWeeklyTaskFromCollection(tasks = [], taskId) {
  const context = findWeeklyTaskContext(tasks, taskId);

  if (!context) {
    return false;
  }

  context.tasks.splice(context.index, 1);
  return true;
}

export function deriveWeeklyProjectStatus(tasks = []) {
  const meaningfulTasks = flattenWeeklyTasks(tasks).filter((task) => hasWeeklyTaskContent(task));

  if (!meaningfulTasks.length) {
    return "in_progress";
  }

  if (meaningfulTasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }

  if (meaningfulTasks.every((task) => task.status === "completed")) {
    return "completed";
  }

  if (meaningfulTasks.some((task) => task.status === "in_progress" || task.status === "completed")) {
    return "in_progress";
  }

  return "planned";
}

export function syncWeeklyProjectStatus(project) {
  if (!project) {
    return;
  }

  project.status = deriveWeeklyProjectStatus(project.tasks);
}

export function getWeeklySelectedReportTemplate(draft) {
  const templates = Array.isArray(draft?.reportTemplates) ? draft.reportTemplates : [];

  if (!templates.length) {
    return null;
  }

  return templates.find((template) => template.id === String(draft?.selectedReportTemplateId ?? "").trim()) ?? templates[0];
}

export function syncWeeklySelectedReportTemplate(draft) {
  if (!draft) {
    return;
  }

  const selectedTemplate = getWeeklySelectedReportTemplate(draft);

  if (!selectedTemplate) {
    draft.selectedReportTemplateId = "";
    draft.reportTemplate = String(draft.reportTemplate ?? "");
    return;
  }

  if (draft.selectedReportTemplateId !== selectedTemplate.id) {
    draft.selectedReportTemplateId = selectedTemplate.id;
  }

  const selectedContent = String(selectedTemplate.content ?? "");

  if (draft.reportTemplate !== selectedContent) {
    draft.reportTemplate = selectedContent;
  }
}

export function getWeeklyReportTemplateOptionLabel(template) {
  const name = String(template?.name ?? "").trim() || (template?.builtin ? "默认模板" : "未命名模板");
  return template?.builtin ? `${name}（默认）` : name;
}

export function getNextWeeklyReportTemplateName(draft) {
  const existingNames = new Set(
    (Array.isArray(draft?.reportTemplates) ? draft.reportTemplates : [])
      .map((template) => String(template?.name ?? "").trim())
      .filter(Boolean)
  );

  let index = 1;
  let candidate = `自定义模板 ${index}`;

  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `自定义模板 ${index}`;
  }

  return candidate;
}

export function getWeeklyStatusToneClass(status) {
  return `is-${getWeeklyProgressStatusMeta(status).tone}`;
}

export function extractWeeklyMeaningfulLines(value) {
  return String(value ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim().replace(/^[-*+•]\s*/, ""))
    .filter(Boolean);
}

export function getWeeklyFirstMeaningfulLine(value) {
  return extractWeeklyMeaningfulLines(value)[0] ?? "";
}

export function findWeeklyRiskNotes(value) {
  return extractWeeklyMeaningfulLines(value).filter((line) => WEEKLY_RISK_KEYWORDS.some((keyword) => line.includes(keyword)));
}

export function getWeeklyRecordTags(record) {
  const metrics = getWeeklyProgressMetrics(record);
  const tags = [`项目 ${metrics.projectCount}`, `任务 ${metrics.taskCount}`];

  if (metrics.blockedTaskCount) {
    tags.push(`风险 ${metrics.blockedTaskCount}`);
  }

  return tags;
}

export function buildWeeklyInsightEntry(category, project, task, detail = "") {
  const primary = task?.title?.trim() || detail || getWeeklyFirstMeaningfulLine(task?.detail) || project?.title?.trim() || "未命名事项";
  const secondary = detail || getWeeklyFirstMeaningfulLine(task?.detail) || "";

  return {
    id: `${category}-${project?.id ?? "record"}-${task?.id ?? primary}`,
    title: primary,
    meta: project?.title?.trim() || "未命名项目",
    detail: secondary && secondary !== primary ? secondary : ""
  };
}

export function dedupeWeeklyInsights(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.meta}-${item.title}-${item.detail}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildWeeklyDraftInsights(record) {
  const empty = {
    qualityChecks: [
      {
        id: "result",
        label: "本周有结论或结果",
        done: false,
        hint: "至少补 1 条阶段结果，周报才不会像流水账。"
      },
      {
        id: "risk",
        label: "风险与协调事项明确",
        done: false,
        hint: "如果当前无风险，建议补一句“当前暂无阻塞”。"
      },
      {
        id: "next",
        label: "下周动作可继续推进",
        done: false,
        hint: "为进行中项目至少补 1 条下周动作。"
      },
      {
        id: "report",
        label: "领导周报已准备",
        done: false,
        hint: "右侧生成后再人工确认一次，会更稳。"
      }
    ],
    achievements: [],
    risks: [],
    nextSteps: []
  };

  if (!record) {
    return empty;
  }

  const achievements = [];
  const risks = [];
  const nextSteps = [];
  let hasNoRiskStatement = false;

  for (const project of record.projects ?? []) {
    const noteLines = extractWeeklyMeaningfulLines(project.note);
    const riskNotes = findWeeklyRiskNotes(project.note);
    const projectTasks = flattenWeeklyTasks(project.tasks).filter((task) => hasWeeklyTaskContent(task));

    if (WEEKLY_NO_RISK_PATTERN.test(project.note)) {
      hasNoRiskStatement = true;
    }

    if (project.note.trim() && !projectTasks.length) {
      achievements.push(buildWeeklyInsightEntry("project-note", project, null, getWeeklyFirstMeaningfulLine(project.note)));
    }

    for (const riskLine of riskNotes) {
      risks.push(buildWeeklyInsightEntry("risk-note", project, null, riskLine));
    }

    for (const task of projectTasks) {
      if (task.status === "completed") {
        achievements.push(buildWeeklyInsightEntry("achievement", project, task, getWeeklyFirstMeaningfulLine(task.detail)));
        continue;
      }

      if (task.status === "blocked") {
        risks.push(buildWeeklyInsightEntry("risk-task", project, task, getWeeklyFirstMeaningfulLine(task.detail)));
        continue;
      }

      nextSteps.push(buildWeeklyInsightEntry("next-step", project, task, getWeeklyFirstMeaningfulLine(task.detail)));
    }

    if (!projectTasks.length && noteLines.length > 1) {
      nextSteps.push(buildWeeklyInsightEntry("project-follow-up", project, null, noteLines[1]));
    }
  }

  const uniqueAchievements = dedupeWeeklyInsights(achievements).slice(0, 6);
  const uniqueRisks = dedupeWeeklyInsights(risks).slice(0, 6);
  const uniqueNextSteps = dedupeWeeklyInsights(nextSteps).slice(0, 6);

  return {
    qualityChecks: [
      {
        id: "result",
        label: "本周有结论或结果",
        done: uniqueAchievements.length > 0,
        hint: uniqueAchievements.length ? `已识别 ${uniqueAchievements.length} 条可汇报结果。` : "至少补 1 条阶段结果，周报才不会像流水账。"
      },
      {
        id: "risk",
        label: "风险与协调事项明确",
        done: uniqueRisks.length > 0 || hasNoRiskStatement,
        hint:
          uniqueRisks.length > 0
            ? `已识别 ${uniqueRisks.length} 条风险或待协调事项。`
            : hasNoRiskStatement
              ? "已明确写出当前无显式阻塞。"
              : "如果当前无风险，建议补一句“当前暂无阻塞”。"
      },
      {
        id: "next",
        label: "下周动作可继续推进",
        done: uniqueNextSteps.length > 0,
        hint: uniqueNextSteps.length ? `已识别 ${uniqueNextSteps.length} 条下周动作。` : "为进行中项目至少补 1 条下周动作。"
      },
      {
        id: "report",
        label: "领导周报已准备",
        done: Boolean(String(record.generatedReport ?? "").trim()),
        hint: String(record.generatedReport ?? "").trim() ? "领导稿已经生成，建议再人工改一轮。" : "右侧生成后再人工确认一次，会更稳。"
      }
    ],
    achievements: uniqueAchievements,
    risks: uniqueRisks,
    nextSteps: uniqueNextSteps
  };
}
