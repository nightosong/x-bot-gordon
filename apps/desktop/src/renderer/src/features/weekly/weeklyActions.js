import {
  cloneWeeklyProgressRecord,
  createWeeklyDraftId,
  createWeeklyProjectDraft,
  createWeeklyTaskDraft,
  renderRichText,
  sanitizeWeeklyProgressRecord
} from "../../lib/presenter.js";
import { WEEKLY_AUTOSAVE_DELAY } from "./weeklyConfig.js";
import {
  buildDailyReportMarkdown,
  buildPerformanceReportSourceContent,
  compareLocalDateKeys,
  findWeeklyTaskContext,
  getDailyReportDateTitle,
  getNextWeeklyReportTemplateName,
  getWeeklyDraftSnapshot,
  getWeeklySelectedReportTemplate,
  getWeeklyTaskChildren,
  hasMatchingMarkdownHierarchy,
  normalizeMarkdownForClipboard,
  moveWeeklyTaskSubtree,
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

const DEFAULT_WEEKLY_FEISHU_SETTINGS = {
  webhookUrl: "",
  secret: "",
  titlePrefix: "Gordon 日报",
  autoDailyReportEnabled: false,
  autoDailyReportTime: "18:30",
  autoDailyReportTimezone: "Asia/Shanghai",
  autoDailyReportLastRunDate: "",
  autoDailyReportLastRunAt: "",
  autoDailyReportLastStatus: "idle",
  autoDailyReportLastMessage: "",
  updatedAt: ""
};

function normalizeWeeklyAiText(value) {
  return String(value ?? "").trim();
}

function normalizeWeeklyFeishuSettings(settings = {}) {
  return {
    webhookUrl: String(settings?.webhookUrl ?? "").trim(),
    secret: String(settings?.secret ?? "").trim(),
    titlePrefix: String(settings?.titlePrefix ?? DEFAULT_WEEKLY_FEISHU_SETTINGS.titlePrefix).trim() || DEFAULT_WEEKLY_FEISHU_SETTINGS.titlePrefix,
    autoDailyReportEnabled: Boolean(settings?.autoDailyReportEnabled ?? DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportEnabled),
    autoDailyReportTime:
      /^\d{2}:\d{2}$/.test(String(settings?.autoDailyReportTime ?? "").trim())
        ? String(settings?.autoDailyReportTime ?? "").trim()
        : DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportTime,
    autoDailyReportTimezone:
      String(settings?.autoDailyReportTimezone ?? DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportTimezone).trim() ||
      DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportTimezone,
    autoDailyReportLastRunDate: String(
      settings?.autoDailyReportLastRunDate ?? DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportLastRunDate
    ).trim(),
    autoDailyReportLastRunAt: String(
      settings?.autoDailyReportLastRunAt ?? DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportLastRunAt
    ).trim(),
    autoDailyReportLastStatus: ["idle", "success", "failed", "skipped"].includes(
      String(settings?.autoDailyReportLastStatus ?? "")
    )
      ? String(settings?.autoDailyReportLastStatus ?? "")
      : DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportLastStatus,
    autoDailyReportLastMessage: String(
      settings?.autoDailyReportLastMessage ?? DEFAULT_WEEKLY_FEISHU_SETTINGS.autoDailyReportLastMessage
    ).trim(),
    updatedAt: String(settings?.updatedAt ?? "").trim()
  };
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
  copyRichTextToClipboard,
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
  let weeklyReportShareTimer = null;

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
    return ui.weekly.reportingMode === "weekly";
  }

  function isWeeklyDailyReportMode() {
    return ui.weekly.reportingMode === "daily";
  }

  function isWeeklyPerformanceReportMode() {
    return ui.weekly.reportingMode === "performance";
  }

  function getWeeklyReportModeLabel() {
    if (isWeeklyReportMode()) {
      return "周报";
    }

    if (isWeeklyPerformanceReportMode()) {
      return "述职报告";
    }

    return "日报";
  }

  function getWeeklyReportOutputContent() {
    if (isWeeklyReportMode()) {
      return ui.weekly.draft?.generatedReport ?? "";
    }

    if (isWeeklyPerformanceReportMode()) {
      return ui.weekly.draft?.generatedPerformanceReport ?? "";
    }

    return ui.weekly.draft?.generatedDailyReport ?? "";
  }

  function setWeeklyReportOutputContent(value) {
    if (!ui.weekly.draft) {
      return;
    }

    if (isWeeklyReportMode()) {
      ui.weekly.draft.generatedReport = String(value ?? "");
      return;
    }

    if (isWeeklyPerformanceReportMode()) {
      ui.weekly.draft.generatedPerformanceReport = String(value ?? "");
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

  function clearWeeklyReportShareTimer() {
    if (weeklyReportShareTimer) {
      clearTimeout(weeklyReportShareTimer);
      weeklyReportShareTimer = null;
    }
  }

  function resetWeeklyReportCopyState() {
    clearWeeklyReportCopyTimer();
    ui.weekly.reportCopyState = "idle";
  }

  function resetWeeklyReportShareState() {
    clearWeeklyReportShareTimer();
    ui.weekly.dailyReportShareState = "idle";
  }

  function markWeeklyReportCopied() {
    clearWeeklyReportCopyTimer();
    ui.weekly.reportCopyState = "copied";
    weeklyReportCopyTimer = setTimeout(() => {
      ui.weekly.reportCopyState = "idle";
      weeklyReportCopyTimer = null;
    }, 1600);
  }

  function markWeeklyDailyReportShared() {
    clearWeeklyReportShareTimer();
    ui.weekly.dailyReportShareState = "sent";
    weeklyReportShareTimer = setTimeout(() => {
      ui.weekly.dailyReportShareState = "idle";
      weeklyReportShareTimer = null;
    }, 1800);
  }

  function setWeeklyReportFeedback(text, tone = "neutral") {
    ui.weekly.reportFeedbackText = String(text ?? "").trim();
    ui.weekly.reportFeedbackTone = tone;
  }

  function setWeeklyFeishuSettingsFeedback(text, tone = "neutral") {
    ui.weekly.feishuSettingsFeedback = String(text ?? "").trim();
    ui.weekly.feishuSettingsFeedbackTone = tone;
  }

  function syncWeeklyFeishuSettingsDraft(settings = ui.weekly.feishuSettings) {
    ui.weekly.feishuSettingsDraft = normalizeWeeklyFeishuSettings(settings);
  }

  async function loadWeeklyFeishuSettings(options = {}) {
    const { force = false, keepDraft = false } = options;

    if (ui.weekly.isFeishuSettingsLoaded && !force) {
      if (!keepDraft) {
        syncWeeklyFeishuSettingsDraft();
      }

      return ui.weekly.feishuSettings;
    }

    if (!desktopApi?.getWeeklyFeishuSettings) {
      const fallbackSettings = normalizeWeeklyFeishuSettings(ui.weekly.feishuSettings);
      ui.weekly.feishuSettings = fallbackSettings;
      ui.weekly.isFeishuSettingsLoaded = true;
      setWeeklyFeishuSettingsFeedback("飞书配置桥接未就绪。", "danger");
      return fallbackSettings;
    }

    try {
      ui.weekly.isFeishuSettingsLoading = true;
      const settings = normalizeWeeklyFeishuSettings(await desktopApi.getWeeklyFeishuSettings());
      ui.weekly.feishuSettings = settings;
      ui.weekly.isFeishuSettingsLoaded = true;

      if (!keepDraft) {
        syncWeeklyFeishuSettingsDraft(settings);
      }

      return settings;
    } catch (error) {
      console.error("Failed to load weekly Feishu settings", error);
      setWeeklyFeishuSettingsFeedback(`配置读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      return normalizeWeeklyFeishuSettings(ui.weekly.feishuSettings);
    } finally {
      ui.weekly.isFeishuSettingsLoading = false;
    }
  }

  async function openWeeklyFeishuSettingsDialog() {
    ui.weekly.isFeishuSettingsDialogOpen = true;
    setWeeklyFeishuSettingsFeedback("", "neutral");
    syncWeeklyFeishuSettingsDraft();
    await loadWeeklyFeishuSettings({ force: !ui.weekly.isFeishuSettingsLoaded });
  }

  function closeWeeklyFeishuSettingsDialog() {
    if (ui.weekly.isFeishuSettingsSaving) {
      return;
    }

    ui.weekly.isFeishuSettingsDialogOpen = false;
    setWeeklyFeishuSettingsFeedback("", "neutral");
    syncWeeklyFeishuSettingsDraft();
  }

  function setWeeklyFeishuSettingsDraftField(field, value) {
    const draft = normalizeWeeklyFeishuSettings(ui.weekly.feishuSettingsDraft);
    ui.weekly.feishuSettingsDraft = {
      ...draft,
      [field]: field === "autoDailyReportEnabled" ? Boolean(value) : String(value ?? "")
    };
    setWeeklyFeishuSettingsFeedback("", "neutral");
  }

  async function saveWeeklyFeishuSettingsFromDialog() {
    if (!desktopApi?.saveWeeklyFeishuSettings) {
      setWeeklyFeishuSettingsFeedback("飞书配置桥接未就绪。", "danger");
      return;
    }

    try {
      ui.weekly.isFeishuSettingsSaving = true;
      setWeeklyFeishuSettingsFeedback("正在保存...", "neutral");
      const nextSettings = normalizeWeeklyFeishuSettings(
        await desktopApi.saveWeeklyFeishuSettings(normalizeWeeklyFeishuSettings(ui.weekly.feishuSettingsDraft))
      );
      ui.weekly.feishuSettings = nextSettings;
      ui.weekly.feishuSettingsDraft = nextSettings;
      ui.weekly.isFeishuSettingsLoaded = true;
      ui.weekly.isFeishuSettingsDialogOpen = false;
      setStatus("飞书群配置已保存。", "success");
    } catch (error) {
      console.error("Failed to save weekly Feishu settings", error);
      setWeeklyFeishuSettingsFeedback(`保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      ui.weekly.isFeishuSettingsSaving = false;
    }
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
    const nextMode = ["daily", "weekly", "performance"].includes(mode) ? mode : "daily";

    if (ui.weekly.reportingMode === nextMode) {
      return;
    }

    if (nextMode !== "weekly") {
      closeWeeklyReportTemplateAi();
    }

    ui.weekly.reportingMode = nextMode;
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
    resetWeeklyReportShareState();
  }

  function setWeeklyPerformanceReportRangeField(field, value) {
    const nextRange = {
      startDate: String(ui.weekly.performanceReportRange?.startDate ?? "").trim(),
      endDate: String(ui.weekly.performanceReportRange?.endDate ?? "").trim()
    };

    if (field === "startDate" || field === "endDate") {
      nextRange[field] = String(value ?? "").trim();
    }

    ui.weekly.performanceReportRange = nextRange;
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
  }

  function setWeeklyPerformanceReportInstruction(value) {
    ui.weekly.performanceReportInstruction = String(value ?? "");
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
  }

  function toggleWeeklyPerformanceReportInstructionCollapsed() {
    ui.weekly.isPerformanceReportInstructionCollapsed = !ui.weekly.isPerformanceReportInstructionCollapsed;
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
      resetWeeklyReportShareState();
      ui.weekly.isGeneratingReport = false;
      ui.weekly.generatingReportKind = null;
      ui.weekly.isReportTemplateCollapsed = true;
      ui.weekly.isFeishuSettingsDialogOpen = false;
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
    resetWeeklyReportShareState();
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
    ui.weekly.isReportTemplateCollapsed = true;
    ui.weekly.isFeishuSettingsDialogOpen = false;
    closeWeeklyReportTemplateAi();
    resetWeeklyReportTemplateAi();
    markWeeklyDraftSaved(ui.weekly.draft);

    if (!ui.weekly.isFeishuSettingsLoaded) {
      void loadWeeklyFeishuSettings({ keepDraft: true });
    }
  }

  function disposeWeeklyRuntime() {
    clearWeeklyAutosaveTimer();
    clearWeeklyReportCopyTimer();
    clearWeeklyReportShareTimer();
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
    resetWeeklyReportShareState();
    weeklyTaskRewriteIds.value = [];
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
    ui.weekly.isReportTemplateCollapsed = true;
    ui.weekly.isFeishuSettingsDialogOpen = false;
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

  function moveWeeklyTask(projectId, sourceTaskId, targetParentTaskId = null) {
    const project = findWeeklyProjectById(projectId);

    if (!project || !sourceTaskId) {
      return false;
    }

    const moved = moveWeeklyTaskSubtree(project.tasks, sourceTaskId, targetParentTaskId);

    if (!moved) {
      return false;
    }

    syncWeeklyProjectStatus(project);
    ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
    return true;
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

    if (isWeeklyPerformanceReportMode()) {
      await handleWeeklyPerformanceReportGeneration();
      return;
    }

    await handleWeeklyDailyReportGeneration();
  }

  async function handleWeeklyPerformanceReportGeneration() {
    if (!desktopApi || !ui.weekly.draft) {
      setWeeklyReportFeedback("当前周报表单尚未就绪，暂无法生成述职报告。", "danger");
      setStatus("当前周报表单尚未就绪，暂无法生成述职报告。", "danger");
      return;
    }

    if (ui.weekly.isGeneratingReport) {
      return;
    }

    const startDate = String(ui.weekly.performanceReportRange?.startDate ?? "").trim();
    const endDate = String(ui.weekly.performanceReportRange?.endDate ?? "").trim();

    if (!startDate || !endDate) {
      setWeeklyReportFeedback("请先选择述职报告的起始日期和结束日期。", "warning");
      setStatus("请先选择述职报告的起止日期。", "warning");
      return;
    }

    if (compareLocalDateKeys(startDate, endDate) > 0) {
      setWeeklyReportFeedback("起始日期不能晚于结束日期。", "warning");
      setStatus("起始日期不能晚于结束日期。", "warning");
      return;
    }

    const reportRecords = workbench.weeklyProgress.map((record) =>
      record.id === ui.weekly.draft?.id ? sanitizeWeeklyProgressRecord(ui.weekly.draft) : record
    );
    const { entries, content } = buildPerformanceReportSourceContent(reportRecords, startDate, endDate);

    if (!entries.length || !content) {
      setWeeklyReportFeedback("所选日期范围内没有检测到可用于述职报告的日报素材。", "warning");
      setStatus("所选日期范围内没有检测到日报素材。", "warning");
      return;
    }

    if (typeof desktopApi.generatePerformanceProgressReport !== "function") {
      setWeeklyReportFeedback("述职报告生成桥接未就绪。", "danger");
      setStatus("述职报告生成桥接未就绪。", "danger");
      return;
    }

    try {
      resetWeeklyReportCopyState();
      ui.weekly.isGeneratingReport = true;
      ui.weekly.generatingReportKind = "performance";
      blurWeeklyActiveElement();
      setWeeklyReportFeedback(`正在整合 ${entries.length} 条日报素材并生成述职报告...`, "neutral");
      setStatus("正在生成述职报告...", "neutral");

      const result = await desktopApi.generatePerformanceProgressReport({
        startDate,
        endDate,
        instruction: String(ui.weekly.performanceReportInstruction ?? "").trim(),
        content
      });

      ui.weekly.draft.generatedPerformanceReport = normalizeMarkdownForClipboard(result.text);
      resetWeeklyReportCopyState();
      resetWeeklyReportShareState();
      setWeeklyReportFeedback(`述职报告已生成（${result.profileLabel}）。`, "success");
      setStatus(`述职报告已生成（${result.profileLabel}）。`, "success");
    } catch (error) {
      console.error("Failed to generate performance report", error);
      setWeeklyReportFeedback(`述职报告生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      setStatus(`述职报告生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      ui.weekly.isGeneratingReport = false;
      ui.weekly.generatingReportKind = null;
    }
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
      resetWeeklyReportShareState();
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
      resetWeeklyReportShareState();
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

      if (!normalizedText) {
        throw new Error("没有可复制的内容");
      }

      if (normalizedText !== currentOutput) {
        setWeeklyReportOutputContent(normalizedText);
      }

      const renderedHtml = renderRichText(normalizedText);
      const copiedFormat =
        typeof copyRichTextToClipboard === "function"
          ? await copyRichTextToClipboard({ html: renderedHtml, text: normalizedText })
          : await copyTextToClipboard(normalizedText);
      markWeeklyReportCopied();
      if (copiedFormat === "html") {
        setStatus(`${getWeeklyReportModeLabel()}已复制为富文本，可直接粘贴到飞书聊天窗口。`, "success");
      } else {
        setStatus(`${getWeeklyReportModeLabel()}已清洗并复制；当前环境只支持纯文本剪贴板。`, "warning");
      }
    } catch (error) {
      resetWeeklyReportCopyState();
      setStatus(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  async function handleWeeklyDailyReportShare() {
    if (ui.weekly.isGeneratingReport || ui.weekly.isSendingDailyReport) {
      return;
    }

    if (!isWeeklyDailyReportMode()) {
      setWeeklyReportFeedback("当前分享按钮只发送日报，请先切换到日报模式。", "warning");
      setStatus("当前分享按钮只发送日报。", "warning");
      return;
    }

    const weeklyRecord = getActiveWeeklyRecord();
    const currentOutput = ui.weekly.draft?.generatedDailyReport ?? "";
    const normalizedText = normalizeMarkdownForClipboard(currentOutput);

    if (!ui.weekly.draft || !weeklyRecord) {
      setWeeklyReportFeedback("当前周报表单尚未就绪，暂无法发送日报。", "danger");
      setStatus("当前周报表单尚未就绪，暂无法发送日报。", "danger");
      return;
    }

    if (!normalizedText) {
      setWeeklyReportFeedback("当前没有可发送的日报内容，先生成日报。", "warning");
      setStatus("当前没有可发送的日报内容，先生成日报。", "warning");
      return;
    }

    const settings = await loadWeeklyFeishuSettings({ keepDraft: true });

    if (!String(settings?.webhookUrl ?? "").trim()) {
      await openWeeklyFeishuSettingsDialog();
      setWeeklyFeishuSettingsFeedback("请先填写飞书群机器人 Webhook。", "warning");
      setWeeklyReportFeedback("请先完成飞书群配置，再发送日报。", "warning");
      return;
    }

    if (!desktopApi?.sendWeeklyDailyReportToFeishu) {
      setWeeklyReportFeedback("飞书发送桥接未就绪。", "danger");
      setStatus("飞书发送桥接未就绪。", "danger");
      return;
    }

    try {
      ui.weekly.isSendingDailyReport = true;
      resetWeeklyReportShareState();
      blurWeeklyActiveElement();

      if (normalizedText !== currentOutput) {
        ui.weekly.draft.generatedDailyReport = normalizedText;
      }

      setWeeklyReportFeedback("正在发送日报到飞书群...", "neutral");
      setStatus("正在发送日报到飞书群...", "neutral");

      await desktopApi.sendWeeklyDailyReportToFeishu({
        title: `${getDailyReportDateTitle()} 日报`,
        weekTitle: weeklyRecord.title,
        content: normalizedText
      });

      markWeeklyDailyReportShared();
      setWeeklyReportFeedback("日报已发送到飞书群。", "success");
      setStatus("日报已发送到飞书群。", "success");
    } catch (error) {
      console.error("Failed to send daily report to Feishu", error);
      resetWeeklyReportShareState();
      setWeeklyReportFeedback(`日报发送失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      setStatus(`日报发送失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      ui.weekly.isSendingDailyReport = false;
    }
  }

  return {
    addWeeklyProject,
    addWeeklyReportTemplate,
    addWeeklyTask,
    applyWeeklyReportTemplateAiOutput,
    cancelWeeklyReportTemplateAiRun,
    closeWeeklyEditor,
    closeWeeklyFeishuSettingsDialog,
    closeWeeklyReportTemplateAi,
    disposeWeeklyRuntime,
    generateWeeklyReportTemplateAiOutput,
    getWeeklyReportTemplateAiFeedbackClass,
    handleWeeklyActiveReportGeneration,
    handleWeeklyDailyReportShare,
    handleWeeklyDelete,
    handleWeeklyDraftSnapshotChange,
    handleWeeklyReportOutputCopy,
    handleWeeklyReportTemplateSelectionChange,
    handleWeeklySave,
    handleWeeklySelectedReportTemplateIdChange,
    isWeeklyProjectCollapsed,
    isWeeklyTaskRewriting,
    openWeeklyFeishuSettingsDialog,
    openLatestWeeklyRecord,
    openWeeklyRecord,
    optimizeWeeklyTaskTitle,
    removeWeeklyProject,
    removeWeeklySelectedReportTemplate,
    removeWeeklyTask,
    moveWeeklyTask,
    resetWeeklyReportCopyState,
    resetWeeklyReportShareState,
    saveWeeklyFeishuSettingsFromDialog,
    setWeeklyFeishuSettingsDraftField,
    setWeeklyReportTemplateAiInstruction,
    setWeeklyReportTemplateAiOutput,
    setWeeklyPerformanceReportInstruction,
    setWeeklyPerformanceReportRangeField,
    setWeeklyTaskRewriting,
    setWeeklyTaskStatus,
    setWeeklyReportingMode,
    setWeeklyReportOutputMode,
    syncWeeklyEditorState,
    toggleWeeklyPerformanceReportInstructionCollapsed,
    toggleWeeklyReportTemplateCollapsed,
    toggleWeeklyProjectCollapsed,
    touchWeeklyTaskById
  };
}
