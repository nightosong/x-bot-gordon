import {
  cloneWeeklyProgressRecord,
  createWeeklyDraftId,
  createWeeklyProjectDraft,
  createWeeklyTaskDraft,
  sanitizeWeeklyProgressRecord
} from "../../lib/presenter.js";
import { WEEKLY_AUTOSAVE_DELAY } from "./weeklyConfig.js";
import {
  buildDailyReportMarkdown,
  findWeeklyTaskContext,
  getDailyReportDateTitle,
  getNextWeeklyReportTemplateName,
  getWeeklyDraftSnapshot,
  getWeeklySelectedReportTemplate,
  getWeeklyTaskChildren,
  hasMatchingMarkdownHierarchy,
  normalizeMarkdownForClipboard,
  removeWeeklyTaskFromCollection,
  syncWeeklyProjectStatus,
  syncWeeklySelectedReportTemplate,
  touchWeeklyTask
} from "./weeklyRuntime.js";

function readRef(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

const WEEKLY_REPORT_TEMPLATE_AI_SYSTEM_PROMPT = `你是 Gordon 任务笔记的周报模板优化助手。
你只负责优化“周报生成模板”，不是生成本周周报正文。
输出必须是可以直接保存为模板的最终内容，不要输出解释、寒暄、代码块包裹或“以下是”等前后缀。
保留模板中已有的关键格式约束、Markdown 层级约束和事实边界；可以优化结构、措辞、检查规则和输出要求，让模板更清晰、更稳定、更适合生成正式周报。
不要把当前项目进展改写进模板正文；当前周记录只作为理解用户工作场景的参考。`;

function normalizeWeeklyAiText(value) {
  return String(value ?? "").trim();
}

function buildWeeklyAppendText(currentText, outputText) {
  const current = String(currentText ?? "").trimEnd();
  const output = normalizeWeeklyAiText(outputText);

  if (!current) {
    return output;
  }

  return `${current}\n\n${output}`;
}

export function createWeeklyActions({
  activeFeature,
  activeWeeklyRecord,
  copyTextToClipboard,
  documentRef = globalThis.document,
  desktopApi,
  featureTasksId,
  nextTick,
  setActiveFeature,
  setStatus,
  showConfirmDialog,
  showInputDialog,
  ui,
  weeklyTaskRewriteIds,
  workbench
}) {
  let weeklyAutosaveTimer = null;
  let weeklySavedSnapshot = "";
  let weeklyAutosaveInFlight = false;
  let weeklyReportCopyTimer = null;

  function runOnNextTick(callback) {
    if (typeof nextTick === "function") {
      nextTick(callback);
      return;
    }

    Promise.resolve().then(callback);
  }

  function getActiveWeeklyRecord() {
    return readRef(activeWeeklyRecord);
  }

  function isWeeklyReportMode() {
    return ui.weekly.reportingMode !== "daily";
  }

  function getWeeklyReportModeLabel() {
    return isWeeklyReportMode() ? "周报" : "日报";
  }

  function getWeeklyReportOutputContent() {
    return isWeeklyReportMode() ? ui.weekly.draft?.generatedReport ?? "" : ui.weekly.draft?.generatedDailyReport ?? "";
  }

  function setWeeklyReportOutputContent(value) {
    if (!ui.weekly.draft) {
      return;
    }

    if (isWeeklyReportMode()) {
      ui.weekly.draft.generatedReport = String(value ?? "");
      return;
    }

    ui.weekly.draft.generatedDailyReport = String(value ?? "");
  }

  function findWeeklyProjectById(projectId) {
    return ui.weekly.draft?.projects?.find((project) => project.id === projectId) ?? null;
  }

  function clearWeeklyAutosaveTimer() {
    if (weeklyAutosaveTimer) {
      clearTimeout(weeklyAutosaveTimer);
      weeklyAutosaveTimer = null;
    }
  }

  function markWeeklyDraftSaved(record = ui.weekly.draft) {
    weeklySavedSnapshot = getWeeklyDraftSnapshot(record);
  }

  function clearWeeklyReportFeedback() {
    ui.weekly.reportFeedbackText = "";
    ui.weekly.reportFeedbackTone = "neutral";
  }

  function clearWeeklyReportCopyTimer() {
    if (weeklyReportCopyTimer) {
      clearTimeout(weeklyReportCopyTimer);
      weeklyReportCopyTimer = null;
    }
  }

  function resetWeeklyReportCopyState() {
    clearWeeklyReportCopyTimer();
    ui.weekly.reportCopyState = "idle";
  }

  function markWeeklyReportCopied() {
    clearWeeklyReportCopyTimer();
    ui.weekly.reportCopyState = "copied";
    weeklyReportCopyTimer = setTimeout(() => {
      ui.weekly.reportCopyState = "idle";
      weeklyReportCopyTimer = null;
    }, 1600);
  }

  function setWeeklyReportFeedback(text, tone = "neutral") {
    ui.weekly.reportFeedbackText = String(text ?? "").trim();
    ui.weekly.reportFeedbackTone = tone;
  }

  function getWeeklyReportTemplateAiState() {
    if (!ui.weekly.reportTemplateAi) {
      ui.weekly.reportTemplateAi = {
        isOpen: false,
        isGenerating: false,
        requestId: "",
        instruction: "",
        output: "",
        feedback: "",
        feedbackTone: "neutral"
      };
    }

    return ui.weekly.reportTemplateAi;
  }

  function setWeeklyReportTemplateAiFeedback(text, tone = "neutral") {
    const state = getWeeklyReportTemplateAiState();
    state.feedback = normalizeWeeklyAiText(text);
    state.feedbackTone = tone;
  }

  function resetWeeklyReportTemplateAi(options = {}) {
    const state = getWeeklyReportTemplateAiState();
    state.isOpen = false;
    state.isGenerating = false;
    state.requestId = "";
    state.output = "";
    state.feedback = "";
    state.feedbackTone = "neutral";

    if (!options.keepInstruction) {
      state.instruction = "";
    }
  }

  function getWeeklyReportTemplateAiFeedbackClass() {
    const tone = getWeeklyReportTemplateAiState().feedbackTone;
    return tone ? `is-${tone}` : "";
  }

  function toggleWeeklyReportTemplateCollapsed() {
    ui.weekly.isReportTemplateCollapsed = !ui.weekly.isReportTemplateCollapsed;

    if (ui.weekly.isReportTemplateCollapsed) {
      closeWeeklyReportTemplateAi();
    }
  }

  function openWeeklyReportTemplateAi() {
    const state = getWeeklyReportTemplateAiState();

    if (!ui.weekly.draft) {
      setStatus("当前周报模板尚未就绪，暂无法优化。", "danger");
      return;
    }

    ui.weekly.isReportTemplateCollapsed = false;
    state.isOpen = true;

    if (!state.output) {
      setWeeklyReportTemplateAiFeedback("输入优化要求后生成，可替换或追加到当前模板。", "neutral");
    }
  }

  function closeWeeklyReportTemplateAi() {
    const state = getWeeklyReportTemplateAiState();

    if (state.isGenerating && state.requestId && desktopApi?.cancelModelText) {
      void desktopApi.cancelModelText(state.requestId);
    }

    resetWeeklyReportTemplateAi({ keepInstruction: true });
  }

  function setWeeklyReportTemplateAiInstruction(value) {
    getWeeklyReportTemplateAiState().instruction = String(value ?? "");
  }

  function setWeeklyReportTemplateAiOutput(value) {
    getWeeklyReportTemplateAiState().output = String(value ?? "");
  }

  function buildWeeklyReportTemplateAiPrompt() {
    const state = getWeeklyReportTemplateAiState();
    const selectedTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);
    const currentTemplate = normalizeWeeklyAiText(selectedTemplate?.content ?? ui.weekly.draft?.reportTemplate);
    const instruction = normalizeWeeklyAiText(state.instruction) || "优化模板结构和表达，让生成的周报更紧凑、正式、稳定，保留现有输出边界。";
    const sanitizedDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);

    return [
      `模板名称：${normalizeWeeklyAiText(selectedTemplate?.name) || "未命名模板"}`,
      `模板类型：${selectedTemplate?.builtin ? "内置模板" : "自定义模板"}`,
      "",
      "当前模板内容：",
      currentTemplate || "当前模板为空，请生成一份适合项目周报的模板。",
      "",
      "当前周记录摘要（仅用于理解业务场景，不要写进模板正文）：",
      normalizeWeeklyAiText(sanitizedDraft?.content) || "暂无项目进展摘要。",
      "",
      "用户优化要求：",
      instruction,
      "",
      "请只输出优化后的完整周报模板。"
    ].join("\n");
  }

  async function generateWeeklyReportTemplateAiOutput() {
    const state = getWeeklyReportTemplateAiState();

    if (state.isGenerating) {
      return;
    }

    if (!ui.weekly.draft) {
      setWeeklyReportTemplateAiFeedback("当前周报模板尚未就绪。", "danger");
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setWeeklyReportTemplateAiFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    const requestId = createWeeklyDraftId("weekly_report_template_ai_request");

    try {
      state.isGenerating = true;
      state.requestId = requestId;
      state.output = "";
      setWeeklyReportTemplateAiFeedback("正在优化模板...", "neutral");
      setStatus("正在优化周报模板...", "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.56,
        maxOutputTokens: 2600,
        messages: [
          {
            role: "system",
            content: WEEKLY_REPORT_TEMPLATE_AI_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildWeeklyReportTemplateAiPrompt()
          }
        ]
      });

      if (state.requestId !== requestId) {
        return;
      }

      const output = normalizeWeeklyAiText(result?.text);

      if (!output) {
        setWeeklyReportTemplateAiFeedback("模型没有返回可写入模板。", "warning");
        return;
      }

      state.output = output;
      setWeeklyReportTemplateAiFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "优化结果已生成。", "success");
      setStatus("周报模板优化结果已生成。", "success");
    } catch (error) {
      if (state.requestId !== requestId) {
        return;
      }

      console.error("Failed to optimize weekly report template", error);
      const message = error instanceof Error ? error.message : "未知错误";
      setWeeklyReportTemplateAiFeedback(`优化失败：${message}`, "danger");
      setStatus(`周报模板优化失败：${message}`, "danger");
    } finally {
      if (state.requestId === requestId) {
        state.isGenerating = false;
        state.requestId = "";
      }
    }
  }

  async function cancelWeeklyReportTemplateAiRun() {
    const state = getWeeklyReportTemplateAiState();
    const requestId = state.requestId;

    if (!state.isGenerating || !requestId) {
      return;
    }

    try {
      if (desktopApi?.cancelModelText) {
        await desktopApi.cancelModelText(requestId);
      }

      setWeeklyReportTemplateAiFeedback("已停止优化。", "neutral");
      setStatus("周报模板优化已停止。", "neutral");
    } catch (error) {
      console.error("Failed to cancel weekly report template AI run", error);
      setWeeklyReportTemplateAiFeedback(`停止失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      if (state.requestId === requestId) {
        state.isGenerating = false;
        state.requestId = "";
      }
    }
  }

  function applyWeeklyReportTemplateAiOutput(mode = "replace") {
    const state = getWeeklyReportTemplateAiState();
    const output = normalizeWeeklyAiText(state.output);

    if (!ui.weekly.draft) {
      setWeeklyReportTemplateAiFeedback("当前周报模板尚未就绪。", "danger");
      return;
    }

    if (!output) {
      setWeeklyReportTemplateAiFeedback("还没有可写入的优化结果。", "warning");
      return;
    }

    const templates = Array.isArray(ui.weekly.draft.reportTemplates) ? ui.weekly.draft.reportTemplates : [];
    const selectedTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);
    const currentContent = String(selectedTemplate?.content ?? ui.weekly.draft.reportTemplate ?? "");
    const nextContent = mode === "append" ? buildWeeklyAppendText(currentContent, output) : output;

    if (!selectedTemplate || selectedTemplate.builtin) {
      const baseName = normalizeWeeklyAiText(selectedTemplate?.name) || "默认模板";
      const nextTemplate = {
        id: createWeeklyDraftId("weekly_report_template"),
        name: `${baseName}优化版`,
        content: nextContent,
        builtin: false
      };

      ui.weekly.draft.reportTemplates = [...templates, nextTemplate];
      ui.weekly.draft.selectedReportTemplateId = nextTemplate.id;
      ui.weekly.draft.reportTemplate = nextContent;
      setStatus("已基于内置模板创建优化版。", "success");
      closeWeeklyReportTemplateAi();
      return;
    }

    selectedTemplate.content = nextContent;
    ui.weekly.draft.reportTemplate = nextContent;
    setStatus("周报模板已写入优化结果。", "success");
    closeWeeklyReportTemplateAi();
  }

  function setWeeklyReportingMode(mode) {
    if (ui.weekly.reportingMode === mode) {
      return;
    }

    if (mode === "daily") {
      closeWeeklyReportTemplateAi();
    }

    ui.weekly.reportingMode = mode;
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
  }

  function setWeeklyReportOutputMode(mode) {
    ui.weekly.reportOutputMode = mode === "edit" ? "edit" : "preview";
  }

  function blurWeeklyActiveElement() {
    const activeElement = documentRef?.activeElement;

    if (activeElement && typeof activeElement.blur === "function") {
      activeElement.blur();
    }
  }

  function focusWeeklyProjectInput(projectId) {
    runOnNextTick(() => {
      const input = documentRef?.querySelector?.(`[data-weekly-project-input="${projectId}"]`);

      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
  }

  function focusWeeklyTaskInput(taskId) {
    runOnNextTick(() => {
      const input = documentRef?.querySelector?.(`[data-weekly-task-input="${taskId}"]`);

      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        input.focus();
        input.select();
        return;
      }

      if (input instanceof HTMLButtonElement) {
        input.click();
      }
    });
  }

  function scheduleWeeklyAutosave() {
    if (ui.weekly.view !== "editor" || !ui.weekly.draft) {
      return;
    }

    clearWeeklyAutosaveTimer();
    weeklyAutosaveTimer = setTimeout(() => {
      handleWeeklySave({ silent: true, reason: "auto" });
    }, WEEKLY_AUTOSAVE_DELAY);
  }

  function handleWeeklyDraftSnapshotChange(nextSnapshot) {
    if (!ui.weekly.draft || ui.weekly.view !== "editor" || !nextSnapshot || nextSnapshot === weeklySavedSnapshot) {
      return;
    }

    scheduleWeeklyAutosave();
  }

  function handleWeeklySelectedReportTemplateIdChange() {
    if (!ui.weekly.draft) {
      return;
    }

    syncWeeklySelectedReportTemplate(ui.weekly.draft);
  }

  function syncWeeklyEditorState() {
    const weeklyRecord = getActiveWeeklyRecord();

    if (!weeklyRecord) {
      ui.weekly.draft = null;
      weeklyTaskRewriteIds.value = [];
      clearWeeklyReportFeedback();
      resetWeeklyReportCopyState();
      ui.weekly.isGeneratingReport = false;
      ui.weekly.generatingReportKind = null;
      ui.weekly.isReportTemplateCollapsed = true;
      closeWeeklyReportTemplateAi();
      resetWeeklyReportTemplateAi();
      markWeeklyDraftSaved(null);
      return;
    }

    clearWeeklyAutosaveTimer();
    ui.weekly.draft = cloneWeeklyProgressRecord(weeklyRecord);
    ui.weekly.draft?.projects?.forEach((project) => syncWeeklyProjectStatus(project));
    syncWeeklySelectedReportTemplate(ui.weekly.draft);
    ui.weekly.collapsedProjectIds = [];
    ui.weekly.reportOutputMode = "preview";
    weeklyTaskRewriteIds.value = [];
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
    ui.weekly.isReportTemplateCollapsed = true;
    closeWeeklyReportTemplateAi();
    resetWeeklyReportTemplateAi();
    markWeeklyDraftSaved(ui.weekly.draft);
  }

  function disposeWeeklyRuntime() {
    clearWeeklyAutosaveTimer();
    clearWeeklyReportCopyTimer();
  }

  function openWeeklyRecord(recordId) {
    ui.weekly.activeRecordId = recordId;
    ui.weekly.view = "editor";
    ui.weekly.editorView = "projects";
    writeRef(activeFeature, featureTasksId);
    syncWeeklyEditorState();
  }

  function openLatestWeeklyRecord() {
    if (workbench.weeklyProgress[0]) {
      openWeeklyRecord(workbench.weeklyProgress[0].id);
      return;
    }

    setActiveFeature(featureTasksId);
  }

  function closeWeeklyEditor() {
    clearWeeklyAutosaveTimer();
    ui.weekly.view = "list";
    ui.weekly.draft = null;
    ui.weekly.collapsedProjectIds = [];
    ui.weekly.editorView = "projects";
    ui.weekly.reportOutputMode = "preview";
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
    weeklyTaskRewriteIds.value = [];
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
    ui.weekly.isReportTemplateCollapsed = true;
    closeWeeklyReportTemplateAi();
    resetWeeklyReportTemplateAi();
    markWeeklyDraftSaved(null);
  }

  function isWeeklyProjectCollapsed(projectId) {
    return ui.weekly.collapsedProjectIds.includes(projectId);
  }

  function toggleWeeklyProjectCollapsed(projectId) {
    if (isWeeklyProjectCollapsed(projectId)) {
      ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
      return;
    }

    ui.weekly.collapsedProjectIds = [...ui.weekly.collapsedProjectIds, projectId];
  }

  function addWeeklyProject() {
    if (!ui.weekly.draft) {
      return;
    }

    const project = createWeeklyProjectDraft();
    ui.weekly.draft.projects.push(project);
    ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== project.id);
    focusWeeklyProjectInput(project.id);
  }

  function removeWeeklyProject(projectId) {
    if (!ui.weekly.draft) {
      return;
    }

    ui.weekly.draft.projects = ui.weekly.draft.projects.filter((project) => project.id !== projectId);
    ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
  }

  function addWeeklyTask(projectId, parentTaskId = null) {
    const project = findWeeklyProjectById(projectId);

    if (!project) {
      return;
    }

    const task = createWeeklyTaskDraft();

    if (parentTaskId) {
      const context = findWeeklyTaskContext(project.tasks, parentTaskId);

      if (context) {
        if (!Array.isArray(context.task.children)) {
          context.task.children = [];
        }

        context.task.children.push(task);
      } else {
        project.tasks.push(task);
      }
    } else {
      project.tasks.push(task);
    }

    syncWeeklyProjectStatus(project);
    ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
    focusWeeklyTaskInput(task.id);
  }

  function removeWeeklyTask(projectId, taskId) {
    const project = findWeeklyProjectById(projectId);

    if (!project) {
      return;
    }

    removeWeeklyTaskFromCollection(project.tasks, taskId);
    syncWeeklyProjectStatus(project);
  }

  function touchWeeklyTaskById(projectId, taskId, timestamp = new Date().toISOString()) {
    const project = findWeeklyProjectById(projectId);

    if (!project) {
      return null;
    }

    const task = findWeeklyTaskContext(project.tasks, taskId)?.task ?? null;

    if (!task) {
      return null;
    }

    touchWeeklyTask(task, timestamp);
    return task;
  }

  function isWeeklyTaskRewriting(taskId) {
    return weeklyTaskRewriteIds.value.includes(taskId);
  }

  function setWeeklyTaskRewriting(taskId, nextValue) {
    if (nextValue) {
      if (!weeklyTaskRewriteIds.value.includes(taskId)) {
        weeklyTaskRewriteIds.value = [...weeklyTaskRewriteIds.value, taskId];
      }

      return;
    }

    weeklyTaskRewriteIds.value = weeklyTaskRewriteIds.value.filter((id) => id !== taskId);
  }

  function closeWeeklyDetailsMenu(trigger, selector) {
    const source = trigger instanceof Event ? trigger.currentTarget : trigger;

    if (!(source instanceof HTMLElement)) {
      return;
    }

    const menu = source.closest(selector);

    if (menu instanceof HTMLDetailsElement) {
      menu.open = false;
    }
  }

  function closeWeeklyStatusMenu(trigger) {
    closeWeeklyDetailsMenu(trigger, ".weekly-task-status-menu");
  }

  function setWeeklyTaskStatus(projectId, taskId, nextStatus, event) {
    const project = findWeeklyProjectById(projectId);

    if (!project) {
      return;
    }

    const task = findWeeklyTaskContext(project.tasks, taskId)?.task ?? null;

    if (!task) {
      return;
    }

    if (task.status === nextStatus) {
      closeWeeklyStatusMenu(event);
      return;
    }

    task.status = nextStatus;
    touchWeeklyTask(task);
    syncWeeklyProjectStatus(project);
    closeWeeklyStatusMenu(event);
  }

  function closeWeeklyTaskActionMenu(trigger) {
    closeWeeklyDetailsMenu(trigger, ".weekly-task-action-menu");
  }

  async function optimizeWeeklyTaskTitle(projectId, taskId, event) {
    closeWeeklyTaskActionMenu(event);

    if (!desktopApi || !ui.weekly.draft) {
      setStatus("当前周报编辑器尚未就绪，暂无法优化任务表达。", "danger");
      return;
    }

    const project = findWeeklyProjectById(projectId);
    const task = project ? findWeeklyTaskContext(project.tasks, taskId)?.task ?? null : null;
    const selectedText = String(task?.title ?? "").trim();
    const childTaskTitles = getWeeklyTaskChildren(task)
      .map((child) => String(child?.title ?? "").trim())
      .filter(Boolean);

    if (!task || !selectedText) {
      setStatus("先填写任务内容，再使用优化功能。", "warning");
      return;
    }

    if (isWeeklyTaskRewriting(taskId)) {
      return;
    }

    try {
      setWeeklyTaskRewriting(taskId, true);
      setStatus("正在优化任务表达...", "neutral");

      const currentDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);
      const result = await desktopApi.rewriteWeeklyProgressItem({
        selectedText,
        fullContent: currentDraft?.content ?? "",
        weekTitle: ui.weekly.draft.title,
        childTaskTitles
      });
      const rewrittenText = String(result?.text ?? "").trim();

      if (!rewrittenText) {
        setStatus("优化未返回可用结果，请稍后再试。", "warning");
        return;
      }

      const latestProject = findWeeklyProjectById(projectId);
      const latestTask = latestProject ? findWeeklyTaskContext(latestProject.tasks, taskId)?.task ?? null : null;

      if (!latestProject || !latestTask) {
        setStatus("任务已变化，本次优化结果未回填。", "warning");
        return;
      }

      latestTask.title = rewrittenText;
      touchWeeklyTask(latestTask);
      syncWeeklyProjectStatus(latestProject);
      setStatus("任务表达已优化，请确认后自动保存。", "success");
    } catch (error) {
      console.error("Failed to optimize weekly task title", error);
      setStatus(`任务优化失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      setWeeklyTaskRewriting(taskId, false);
    }
  }

  function handleWeeklyReportTemplateSelectionChange() {
    syncWeeklySelectedReportTemplate(ui.weekly.draft);
    closeWeeklyReportTemplateAi();
    resetWeeklyReportTemplateAi();
  }

  async function addWeeklyReportTemplate() {
    if (!ui.weekly.draft) {
      return;
    }

    const baseTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);
    const defaultName = getNextWeeklyReportTemplateName(ui.weekly.draft);
    const nextName = await showInputDialog({
      title: "新增周报模板",
      message: "输入模板名称后会基于当前模板复制一份新模板。",
      inputLabel: "模板名称",
      inputValue: defaultName,
      inputPlaceholder: "例如：项目周报",
      confirmText: "新增",
      cancelText: "取消"
    });

    if (nextName === null) {
      return;
    }

    const normalizedName = String(nextName ?? "").trim() || defaultName;
    const nextTemplate = {
      id: createWeeklyDraftId("weekly_report_template"),
      name: normalizedName,
      content: String(baseTemplate?.content ?? ui.weekly.draft.reportTemplate ?? ""),
      builtin: false
    };

    ui.weekly.draft.reportTemplates = [...(Array.isArray(ui.weekly.draft.reportTemplates) ? ui.weekly.draft.reportTemplates : []), nextTemplate];
    ui.weekly.draft.selectedReportTemplateId = nextTemplate.id;
    ui.weekly.draft.reportTemplate = nextTemplate.content;
    setStatus(`已新增模板「${normalizedName}」。`, "success");
  }

  async function removeWeeklySelectedReportTemplate() {
    const templates = Array.isArray(ui.weekly.draft?.reportTemplates) ? ui.weekly.draft.reportTemplates : [];
    const selectedTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);

    if (!ui.weekly.draft || templates.length <= 1 || !selectedTemplate || selectedTemplate.builtin) {
      return;
    }

    const templateName = String(selectedTemplate.name ?? "").trim() || "未命名模板";
    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除周报模板",
      message: `确认删除模板「${templateName}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    const templateIndex = templates.findIndex((template) => template.id === selectedTemplate.id);
    const nextTemplates = templates.filter((template) => template.id !== selectedTemplate.id);
    const fallbackTemplate = nextTemplates[templateIndex] ?? nextTemplates[templateIndex - 1] ?? nextTemplates[0] ?? null;

    ui.weekly.draft.reportTemplates = nextTemplates;
    ui.weekly.draft.selectedReportTemplateId = fallbackTemplate?.id ?? "";
    ui.weekly.draft.reportTemplate = String(fallbackTemplate?.content ?? "");
    setStatus("模板已删除。", "success");
  }

  async function handleWeeklySave(options = {}) {
    const weeklyRecord = getActiveWeeklyRecord();

    if (!desktopApi || !weeklyRecord || !ui.weekly.draft) {
      setStatus("周记录尚未就绪，暂时无法保存。", "danger");
      return;
    }

    const { silent = false, reason = "manual" } = options;
    const snapshotBeforeSave = getWeeklyDraftSnapshot(ui.weekly.draft);

    if (reason === "auto") {
      if (!snapshotBeforeSave || snapshotBeforeSave === weeklySavedSnapshot || weeklyAutosaveInFlight) {
        return;
      }

      weeklyAutosaveInFlight = true;
    }

    clearWeeklyAutosaveTimer();

    try {
      const nextRecord = {
        ...sanitizeWeeklyProgressRecord(ui.weekly.draft),
        id: weeklyRecord.id,
        updatedAt: new Date().toISOString()
      };

      workbench.weeklyProgress = await desktopApi.saveWeeklyProgress(nextRecord);
      ui.weekly.activeRecordId = nextRecord.id;

      if (ui.weekly.draft) {
        ui.weekly.draft.updatedAt = nextRecord.updatedAt;
        ui.weekly.draft.content = nextRecord.content;
      }

      weeklySavedSnapshot = snapshotBeforeSave;

      const latestSnapshot = getWeeklyDraftSnapshot(ui.weekly.draft);

      if (latestSnapshot !== weeklySavedSnapshot) {
        scheduleWeeklyAutosave();
      }

      if (!silent) {
        setStatus("任务笔记内容已保存。", "success");
      } else {
        setStatus("任务笔记已自动保存。", "success");
      }
    } catch (error) {
      console.error("Failed to save weekly progress", error);
      setStatus(`任务笔记保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      if (reason === "auto") {
        weeklyAutosaveInFlight = false;
      }
    }
  }

  async function handleWeeklyDelete(recordId) {
    if (!desktopApi) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除周记录",
      message: "确认删除这条周记录吗？删除后无法恢复。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    try {
      workbench.weeklyProgress = await desktopApi.deleteWeeklyProgress(recordId);

      if (ui.weekly.activeRecordId === recordId) {
        ui.weekly.activeRecordId =
          workbench.weeklyProgress.find((record) => record.status === "active")?.id ?? workbench.weeklyProgress[0]?.id ?? null;
        closeWeeklyEditor();
      }

      setStatus("周记录已删除。", "success");
    } catch (error) {
      console.error("Failed to delete weekly progress", error);
      setStatus(`周记录删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  async function handleWeeklyActiveReportGeneration() {
    if (isWeeklyReportMode()) {
      await handleWeeklyReportGeneration();
      return;
    }

    await handleWeeklyDailyReportGeneration();
  }

  async function handleWeeklyDailyReportGeneration() {
    const weeklyRecord = getActiveWeeklyRecord();

    if (!ui.weekly.draft || !weeklyRecord) {
      setWeeklyReportFeedback("当前周报表单尚未就绪，暂无法生成日报。", "danger");
      setStatus("当前周报表单尚未就绪，暂无法生成日报。", "danger");
      return;
    }

    if (ui.weekly.isGeneratingReport) {
      return;
    }

    try {
      resetWeeklyReportCopyState();
      ui.weekly.isGeneratingReport = true;
      ui.weekly.generatingReportKind = "daily";
      blurWeeklyActiveElement();
      setWeeklyReportFeedback("正在整理今日日报...", "neutral");
      setStatus("正在整理今日日报...", "neutral");
      const sanitizedDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);
      const { entries, markdown } = buildDailyReportMarkdown(sanitizedDraft);

      if (!entries.length || !markdown) {
        setWeeklyReportFeedback(`今天（${getDailyReportDateTitle()}）还没有检测到更新的子任务记录。`, "warning");
        setStatus(`今天（${getDailyReportDateTitle()}）还没有检测到更新的子任务记录。`, "warning");
        return;
      }

      const baseMarkdown = normalizeMarkdownForClipboard(markdown);
      let finalMarkdown = baseMarkdown;
      let feedbackText = "日报已按原任务层级生成。";
      let feedbackTone = "success";

      if (ui.weekly.dailyReportUseModelOptimization) {
        if (!desktopApi || typeof desktopApi.generateDailyProgressReport !== "function") {
          feedbackText = "当前版本尚未接通日报优化能力，已回退为原任务层级稿。";
          feedbackTone = "warning";
        } else {
          try {
            const result = await desktopApi.generateDailyProgressReport({
              dateTitle: getDailyReportDateTitle(),
              weekTitle: weeklyRecord.title,
              content: baseMarkdown
            });
            const optimizedMarkdown = normalizeMarkdownForClipboard(result.text);

            if (optimizedMarkdown && hasMatchingMarkdownHierarchy(baseMarkdown, optimizedMarkdown)) {
              finalMarkdown = optimizedMarkdown;
              feedbackText = `日报已完成大模型优化（${result.profileLabel}）。`;
            } else {
              feedbackText = `大模型优化未通过层级校验，已回退为原任务层级稿（${result.profileLabel}）。`;
              feedbackTone = "warning";
            }
          } catch (error) {
            console.error("Failed to optimize daily report", error);
            feedbackText = `大模型优化失败，已回退为原任务层级稿：${error instanceof Error ? error.message : "未知错误"}`;
            feedbackTone = "warning";
          }
        }
      }

      ui.weekly.draft.generatedDailyReport = finalMarkdown;
      resetWeeklyReportCopyState();
      setWeeklyReportFeedback(feedbackText, feedbackTone);
      setStatus(feedbackText, feedbackTone);
    } catch (error) {
      console.error("Failed to generate daily report", error);
      setWeeklyReportFeedback(`日报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      setStatus(`日报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      ui.weekly.isGeneratingReport = false;
      ui.weekly.generatingReportKind = null;
    }
  }

  async function handleWeeklyReportGeneration() {
    const weeklyRecord = getActiveWeeklyRecord();

    if (!desktopApi || !ui.weekly.draft || !weeklyRecord) {
      setWeeklyReportFeedback("当前周报表单尚未就绪，暂无法生成周报。", "danger");
      setStatus("当前周报表单尚未就绪，暂无法生成周报。", "danger");
      return;
    }

    if (ui.weekly.isGeneratingReport) {
      return;
    }

    const sanitizedDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);

    if (!sanitizedDraft?.content.trim()) {
      setWeeklyReportFeedback("当前还没有项目或任务，先补充任务笔记内容再生成周报。", "warning");
      setStatus("当前还没有项目或任务，先补充任务笔记内容再生成周报。", "warning");
      return;
    }

    if (!String(sanitizedDraft.reportTemplate ?? "").trim()) {
      setWeeklyReportFeedback("当前模板内容为空，先补一版模板再生成周报。", "warning");
      setStatus("当前模板内容为空，先补一版模板再生成周报。", "warning");
      return;
    }

    try {
      resetWeeklyReportCopyState();
      ui.weekly.isGeneratingReport = true;
      ui.weekly.generatingReportKind = "weekly";
      blurWeeklyActiveElement();
      setWeeklyReportFeedback("正在生成周报...", "neutral");
      setStatus("正在生成周报...", "neutral");
      const result = await desktopApi.generateWeeklyProgressReport({
        weekTitle: weeklyRecord.title,
        content: sanitizedDraft.content,
        reportTemplate: sanitizedDraft.reportTemplate
      });
      ui.weekly.draft.generatedReport = normalizeMarkdownForClipboard(result.text);
      resetWeeklyReportCopyState();
      setWeeklyReportFeedback(`周报已生成（${result.profileLabel}）。`, "success");
      setStatus(`周报已生成（${result.profileLabel}）。`, "success");
    } catch (error) {
      console.error("Failed to generate weekly report", error);
      setWeeklyReportFeedback(`周报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      setStatus(`周报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      ui.weekly.isGeneratingReport = false;
      ui.weekly.generatingReportKind = null;
    }
  }

  async function handleWeeklyReportOutputCopy() {
    if (ui.weekly.isGeneratingReport) {
      return;
    }

    try {
      const currentOutput = getWeeklyReportOutputContent();
      const normalizedText = normalizeMarkdownForClipboard(currentOutput);

      if (normalizedText !== currentOutput) {
        setWeeklyReportOutputContent(normalizedText);
      }

      await copyTextToClipboard(normalizedText);
      markWeeklyReportCopied();
      setStatus(`${getWeeklyReportModeLabel()}已清洗并复制，可直接粘贴到飞书。`, "success");
    } catch (error) {
      resetWeeklyReportCopyState();
      setStatus(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  return {
    addWeeklyProject,
    addWeeklyReportTemplate,
    addWeeklyTask,
    applyWeeklyReportTemplateAiOutput,
    cancelWeeklyReportTemplateAiRun,
    closeWeeklyEditor,
    closeWeeklyReportTemplateAi,
    disposeWeeklyRuntime,
    generateWeeklyReportTemplateAiOutput,
    getWeeklyReportTemplateAiFeedbackClass,
    handleWeeklyActiveReportGeneration,
    handleWeeklyDelete,
    handleWeeklyDraftSnapshotChange,
    handleWeeklyReportOutputCopy,
    handleWeeklyReportTemplateSelectionChange,
    handleWeeklySave,
    handleWeeklySelectedReportTemplateIdChange,
    isWeeklyProjectCollapsed,
    isWeeklyTaskRewriting,
    openLatestWeeklyRecord,
    openWeeklyRecord,
    optimizeWeeklyTaskTitle,
    removeWeeklyProject,
    removeWeeklySelectedReportTemplate,
    removeWeeklyTask,
    resetWeeklyReportCopyState,
    setWeeklyReportTemplateAiInstruction,
    setWeeklyReportTemplateAiOutput,
    setWeeklyTaskRewriting,
    setWeeklyTaskStatus,
    setWeeklyReportingMode,
    setWeeklyReportOutputMode,
    syncWeeklyEditorState,
    toggleWeeklyReportTemplateCollapsed,
    toggleWeeklyProjectCollapsed,
    touchWeeklyTaskById
  };
}
