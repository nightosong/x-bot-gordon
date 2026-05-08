import { computed } from "vue";

import {
  createDefaultWorkflowEnvironments,
  createWorkflowOutputDraft as createWorkflowOutputDraftFromConfig,
  createWorkflowRecordDraft as createWorkflowRecordDraftFromConfig,
  createWorkflowState as createWorkflowStateFromConfig,
  createWorkflowStepDraft as createWorkflowStepDraftFromConfig
} from "./workflowConfig.js";
import {
  buildWorkflowInitialRunResult,
  buildWorkflowRecordFromDraft as buildWorkflowRecordFromDraftRuntime,
  createWorkflowRecordDraftFromRecord as createWorkflowRecordDraftFromRecordRuntime,
  extractCurlMethod,
  extractCurlUrl,
  findWorkflowCurlBodySegment,
  formatDurationMs,
  getWorkflowCardCountLabel,
  getWorkflowRunCompletedCount,
  getWorkflowRunDurationLabel,
  getWorkflowRunProgressPercent,
  getWorkflowRunSummaryText,
  getWorkflowRuntimeMissingFields,
  getWorkflowStepModeLabel,
  getWorkflowStepProgressPercent,
  getWorkflowStepStatusLabel,
  getWorkflowStepStatusTone,
  getWorkflowStepVisualRows,
  getWorkflowTimeoutMs,
  looksLikeWorkflowJsonBody,
  normalizeWorkflowBodyDraftForCompare,
  normalizeWorkflowEnvironments,
  repairWorkflowBodyText,
  replaceWorkflowCurlBody
} from "./workflowRuntime.js";

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function createWorkflowStepDraft(createLocalId, overrides = {}) {
  return createWorkflowStepDraftFromConfig(overrides, createLocalId);
}

function createWorkflowOutputDraft(createLocalId, overrides = {}) {
  return createWorkflowOutputDraftFromConfig(overrides, createLocalId);
}

function createWorkflowRecordDraft(createLocalId) {
  return createWorkflowRecordDraftFromConfig(createLocalId);
}

function createWorkflowRecordDraftFromRecord(createLocalId, record) {
  return createWorkflowRecordDraftFromRecordRuntime(record, { createLocalId });
}

function buildWorkflowRecordFromDraft(createLocalId, draft, existingRecord = null) {
  return buildWorkflowRecordFromDraftRuntime(draft, existingRecord, { createLocalId });
}

export function createWorkflowState(createLocalId) {
  return createWorkflowStateFromConfig(createLocalId);
}

export function createWorkflowActions({
  activeFeature,
  copyTextToClipboard,
  createLocalId,
  desktopApi,
  featureWorkflowLibraryId,
  setStatus,
  showAlertDialog,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
}) {
  const workflowLibraryCards = computed(() => [...workbench.workflowLibrary]);
  const activeWorkflowCard = computed(
    () => workflowLibraryCards.value.find((entry) => entry.id === ui.workflow.activeCardId) ?? workflowLibraryCards.value[0] ?? null
  );
  const activeWorkflowRecords = computed(() => activeWorkflowCard.value?.records ?? []);
  const activeWorkflowRecord = computed(
    () => activeWorkflowRecords.value.find((record) => record.id === ui.workflow.activeRecordId) ?? activeWorkflowRecords.value[0] ?? null
  );
  const activeWorkflowSteps = computed(() => activeWorkflowRecord.value?.steps ?? []);
  const activeWorkflowBodyStepOptions = computed(() =>
    activeWorkflowSteps.value
      .map((step, index) => {
        const bodySegment = findWorkflowCurlBodySegment(step?.curl ?? "");

        if (!bodySegment) {
          return null;
        }

        return {
          id: step.id,
          label: step.name || `请求 ${index + 1}`,
          method: step.method || extractCurlMethod(step.curl),
          body: bodySegment.value,
          step
        };
      })
      .filter(Boolean)
  );
  const activeWorkflowBodyStep = computed(
    () =>
      activeWorkflowBodyStepOptions.value.find((entry) => entry.id === ui.workflow.bodyStepId) ??
      activeWorkflowBodyStepOptions.value[0] ??
      null
  );
  const workflowBodyDraftChanged = computed(() => {
    const activeBodyStep = activeWorkflowBodyStep.value;

    if (!activeBodyStep) {
      return false;
    }

    return normalizeWorkflowBodyDraftForCompare(ui.workflow.bodyDraftText) !== normalizeWorkflowBodyDraftForCompare(activeBodyStep.body);
  });
  const activeWorkflowEnvironments = computed(() => normalizeWorkflowEnvironments(activeWorkflowRecord.value));
  const activeWorkflowEnvironment = computed(
    () =>
      activeWorkflowEnvironments.value.find((environment) => environment.id === activeWorkflowRecord.value?.activeEnvironmentId) ??
      activeWorkflowEnvironments.value.find((environment) => environment.id === "prod") ??
      activeWorkflowEnvironments.value[0] ??
      null
  );
  const activeWorkflowApiKeyInputType = computed(() => (ui.workflow.apiKeyVisible ? "text" : "password"));
  const filteredWorkflowRecords = computed(() => {
    const query = String(ui.workflow.searchQuery ?? "").trim().toLowerCase();

    if (!query) {
      return activeWorkflowRecords.value;
    }

    return activeWorkflowRecords.value.filter((record) =>
      [
        record.name,
        record.summary,
        record.scenario,
        record.notes,
        record.tags?.join(" "),
        record.environments?.map((environment) => `${environment.label} ${environment.baseUrl}`).join(" "),
        record.steps?.map((step) => `${step.name} ${step.url} ${step.curl}`).join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  });
  const workflowDetailTitle = computed(() => {
    if (ui.workflow.view === "editor") {
      return ui.workflow.editingRecordId ? "编辑工作流" : "新建工作流";
    }

    if (ui.workflow.view === "run") {
      return activeWorkflowRecord.value?.name ?? "执行工作流";
    }

    return activeWorkflowCard.value?.title ?? "流程中心";
  });
  const workflowRunControlLabel = computed(() => {
    if (ui.workflow.isCancelling) {
      return "中断中";
    }

    return ui.workflow.isRunning ? "中断执行" : "执行工作流";
  });
  const workflowRunControlIcon = computed(() => {
    if (ui.workflow.isCancelling) {
      return "loading";
    }

    return ui.workflow.isRunning ? "stop" : "play";
  });
  const workflowRunStatusLabel = computed(() => {
    if (ui.workflow.isCancelling) {
      return "中断中";
    }

    if (!ui.workflow.runResult) {
      return "待执行";
    }

    if (ui.workflow.runResult.status === "cancelled") {
      return "已中断";
    }

    if (ui.workflow.isRunning) {
      return "执行中";
    }

    return ui.workflow.runResult.status === "success" ? "执行成功" : "执行失败";
  });
  const workflowRunStatusTone = computed(() => {
    if (ui.workflow.isCancelling) {
      return "is-cancelled";
    }

    if (!ui.workflow.runResult) {
      return "";
    }

    if (ui.workflow.runResult.status === "cancelled") {
      return "is-cancelled";
    }

    if (ui.workflow.isRunning) {
      return "is-warning";
    }

    return ui.workflow.runResult.status === "success" ? "is-success" : "is-danger";
  });
  const activeWorkflowMetrics = computed(() => ({
    recordCount: activeWorkflowCard.value?.records?.length ?? 0,
    stepCount: activeWorkflowRecord.value?.steps?.length ?? 0,
    environmentCount: activeWorkflowEnvironments.value.length,
    variableCount: activeWorkflowRecord.value?.sharedVariables?.length ?? 0,
    timeoutMs: getWorkflowTimeoutMs(activeWorkflowRecord.value?.protocol)
  }));

  function isWorkflowStepExpanded(stepId) {
    return ui.workflow.expandedStepIds.includes(stepId);
  }

  function toggleWorkflowStepExpanded(stepId) {
    if (isWorkflowStepExpanded(stepId)) {
      ui.workflow.expandedStepIds = ui.workflow.expandedStepIds.filter((id) => id !== stepId);
      return;
    }

    ui.workflow.expandedStepIds = [...ui.workflow.expandedStepIds, stepId];
  }

  function addWorkflowDraftStep() {
    ui.workflow.recordDraft.steps = [...(ui.workflow.recordDraft.steps ?? []), createWorkflowStepDraft(createLocalId)];
  }

  function removeWorkflowDraftStep(stepId) {
    const nextSteps = (ui.workflow.recordDraft.steps ?? []).filter((step) => step.id !== stepId);
    ui.workflow.recordDraft.steps = nextSteps.length ? nextSteps : [createWorkflowStepDraft(createLocalId)];
  }

  function addWorkflowStepOutput(step) {
    step.produces = [...(step.produces ?? []), createWorkflowOutputDraft(createLocalId)];
  }

  function removeWorkflowStepOutput(step, outputId) {
    step.produces = (step.produces ?? []).filter((output) => output.id !== outputId);
  }

  function addWorkflowDraftEnvironment() {
    const nextIndex = (ui.workflow.recordDraft.environments ?? []).length + 1;
    ui.workflow.recordDraft.environments = [
      ...(ui.workflow.recordDraft.environments ?? []),
      {
        id: createLocalId("env"),
        label: `ENV ${nextIndex}`,
        baseUrl: "",
        apiKey: ""
      }
    ];
  }

  function removeWorkflowDraftEnvironment(environmentId) {
    const nextEnvironments = (ui.workflow.recordDraft.environments ?? []).filter((environment) => environment.id !== environmentId);
    ui.workflow.recordDraft.environments = nextEnvironments.length ? nextEnvironments : createDefaultWorkflowEnvironments();

    if (!ui.workflow.recordDraft.environments.some((environment) => environment.id === ui.workflow.recordDraft.activeEnvironmentId)) {
      ui.workflow.recordDraft.activeEnvironmentId = ui.workflow.recordDraft.environments[0]?.id ?? "prod";
    }
  }

  function handleWorkflowRunProgress(payload) {
    if (!payload?.progressEventId || payload.progressEventId !== ui.workflow.activeProgressEventId) {
      return;
    }

    ui.workflow.runResult = toPlainIpcData(payload);

    if (["success", "failed", "cancelled"].includes(payload.status)) {
      ui.workflow.isCancelling = false;
    }
  }

  function setWorkflowBodyFeedback(text, tone = "neutral") {
    ui.workflow.bodyFeedbackText = String(text ?? "").trim();
    ui.workflow.bodyFeedbackTone = tone;
  }

  function syncWorkflowBodyDraftFromActiveStep({ force = false } = {}) {
    const activeBodyStep = activeWorkflowBodyStep.value;

    if (!activeBodyStep) {
      ui.workflow.bodyStepId = null;
      ui.workflow.bodyDraftText = "";
      setWorkflowBodyFeedback("", "neutral");
      return;
    }

    if (!ui.workflow.bodyStepId || !activeWorkflowBodyStepOptions.value.some((entry) => entry.id === ui.workflow.bodyStepId)) {
      ui.workflow.bodyStepId = activeBodyStep.id;
    }

    if (!force && workflowBodyDraftChanged.value) {
      return;
    }

    ui.workflow.bodyDraftText = activeBodyStep.body;
    setWorkflowBodyFeedback("已读取模板里的请求 Body。", "neutral");
  }

  function handleWorkflowBodyStepSelect() {
    syncWorkflowBodyDraftFromActiveStep({ force: true });
  }

  function handleWorkflowBodyDraftInput() {
    const activeBodyStep = activeWorkflowBodyStep.value;

    if (!activeBodyStep) {
      setWorkflowBodyFeedback("", "neutral");
      return;
    }

    setWorkflowBodyFeedback(
      workflowBodyDraftChanged.value ? "本次执行将使用当前 Body，不会自动写回模板。" : "当前 Body 与模板一致。",
      workflowBodyDraftChanged.value ? "warning" : "success"
    );
  }

  function repairWorkflowBodyDraft() {
    const result = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: true });
    ui.workflow.bodyDraftText = result.text;

    if (result.ok) {
      setWorkflowBodyFeedback("已修复并格式化为标准 JSON。", "success");
      return;
    }

    setWorkflowBodyFeedback(result.error, looksLikeWorkflowJsonBody(result.text) ? "warning" : "neutral");
  }

  function getWorkflowBodyTextForRun() {
    const result = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: false });

    if (!result.ok && looksLikeWorkflowJsonBody(result.text)) {
      throw new Error(result.error);
    }

    return result.text;
  }

  function applyWorkflowBodyDraftToRecord(record) {
    const activeBodyStep = activeWorkflowBodyStep.value;

    if (!record || !activeBodyStep || !workflowBodyDraftChanged.value) {
      return record;
    }

    const bodyText = getWorkflowBodyTextForRun();

    return {
      ...record,
      steps: (record.steps ?? []).map((step) => {
        if (step.id !== activeBodyStep.id) {
          return step;
        }

        const curl = replaceWorkflowCurlBody(step.curl, bodyText);

        return {
          ...step,
          method: extractCurlMethod(curl),
          url: extractCurlUrl(curl),
          curl
        };
      })
    };
  }

  function buildWorkflowRunRecord(record, progressEventId = "") {
    const runtimeRecord = applyWorkflowBodyDraftToRecord(record);
    const activeEnvironmentApiKey = String(activeWorkflowEnvironment.value?.apiKey ?? record?.apiKey ?? "").trim();

    return toPlainIpcData({
      ...runtimeRecord,
      progressEventId,
      activeEnvironmentId: activeWorkflowEnvironment.value?.id ?? record?.activeEnvironmentId,
      environments: activeWorkflowEnvironments.value,
      apiKey: activeEnvironmentApiKey
    });
  }

  async function persistActiveWorkflowRuntimeConfig(showStatus = false) {
    const card = activeWorkflowCard.value;
    const record = activeWorkflowRecord.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record) {
      return;
    }

    const now = new Date().toISOString();
    record.updatedAt = now;

    const nextCard = {
      ...card,
      updatedAt: now,
      records: (card.records ?? []).map((entry) => (entry.id === record.id ? { ...record } : entry))
    };

    try {
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeCardId = nextCard.id;
      ui.workflow.activeRecordId = record.id;

      if (showStatus) {
        setStatus("已保存工作流运行配置。", "success");
      }
    } catch (error) {
      console.error("Failed to persist workflow runtime config", error);
      setStatus(`保存运行配置失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function persistWorkflowBodyDraftToTemplate() {
    const card = activeWorkflowCard.value;
    const record = activeWorkflowRecord.value;
    const activeBodyStep = activeWorkflowBodyStep.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record || !activeBodyStep) {
      setStatus("工作流仓储未就绪，暂时无法写回 Body。", "danger");
      return;
    }

    const repairedBody = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: true });

    if (!repairedBody.ok && looksLikeWorkflowJsonBody(repairedBody.text)) {
      const message = repairedBody.error || "请求 Body 格式不正确";
      setWorkflowBodyFeedback(message, "warning");
      setStatus(message, "warning");
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = {
      ...record,
      updatedAt: now,
      steps: (record.steps ?? []).map((step) => {
        if (step.id !== activeBodyStep.id) {
          return step;
        }

        const curl = replaceWorkflowCurlBody(step.curl, repairedBody.text);

        return {
          ...step,
          method: extractCurlMethod(curl),
          url: extractCurlUrl(curl),
          curl
        };
      })
    };
    const nextCard = {
      ...card,
      updatedAt: now,
      lastUsedAt: now,
      records: (card.records ?? []).map((entry) => (entry.id === record.id ? nextRecord : entry))
    };

    try {
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeCardId = nextCard.id;
      ui.workflow.activeRecordId = nextRecord.id;
      ui.workflow.bodyDraftText = repairedBody.text;
      setWorkflowBodyFeedback("已写回模板 curl。", "success");
      setStatus("已写回请求 Body 模板。", "success");
    } catch (error) {
      console.error("Failed to persist workflow body draft", error);
      setStatus(`写回请求 Body 失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function handleWorkflowApiKeyInput(event) {
    if (!activeWorkflowRecord.value || !(event.target instanceof HTMLInputElement)) {
      return;
    }

    const nextApiKey = event.target.value;
    const environments = normalizeWorkflowEnvironments(activeWorkflowRecord.value);
    const activeEnvironmentId =
      activeWorkflowEnvironment.value?.id ??
      activeWorkflowRecord.value.activeEnvironmentId ??
      environments.find((environment) => environment.id === "prod")?.id ??
      environments[0]?.id;

    activeWorkflowRecord.value.environments = environments.map((environment) =>
      environment.id === activeEnvironmentId ? { ...environment, apiKey: nextApiKey } : environment
    );

    if (activeEnvironmentId) {
      activeWorkflowRecord.value.activeEnvironmentId = activeEnvironmentId;
      activeWorkflowRecord.value.apiKey = nextApiKey;
    }
  }

  async function selectWorkflowEnvironment(environmentId) {
    if (!activeWorkflowRecord.value || activeWorkflowRecord.value.activeEnvironmentId === environmentId) {
      return;
    }

    activeWorkflowRecord.value.activeEnvironmentId = environmentId;
    activeWorkflowRecord.value.apiKey =
      normalizeWorkflowEnvironments(activeWorkflowRecord.value).find((environment) => environment.id === environmentId)?.apiKey ??
      activeWorkflowRecord.value.apiKey ??
      "";
    await persistActiveWorkflowRuntimeConfig();
  }

  function syncWorkflowSelection() {
    if (!workbench.workflowLibrary.length) {
      ui.workflow.activeCardId = null;
      ui.workflow.activeRecordId = null;
      ui.workflow.copiedStepId = null;
      ui.workflow.expandedStepIds = [];
      return;
    }

    const nextCard =
      workbench.workflowLibrary.find((entry) => entry.id === ui.workflow.activeCardId) ?? workbench.workflowLibrary[0];
    ui.workflow.activeCardId = nextCard?.id ?? null;

    const nextRecord = nextCard?.records?.find((record) => record.id === ui.workflow.activeRecordId) ?? nextCard?.records?.[0] ?? null;
    ui.workflow.activeRecordId = nextRecord?.id ?? null;
    ui.workflow.copiedStepId = null;
    ui.workflow.expandedStepIds = [];
  }

  function openWorkflowCard(cardId) {
    writeRef(activeFeature, featureWorkflowLibraryId);
    ui.workflow.view = "list";
    ui.workflow.activeCardId = cardId;
    const card = workbench.workflowLibrary.find((entry) => entry.id === cardId);
    ui.workflow.activeRecordId = card?.records?.[0]?.id ?? null;
    ui.workflow.copiedStepId = null;
    ui.workflow.searchQuery = "";
    ui.workflow.runResult = null;
    ui.workflow.expandedStepIds = [];
  }

  function handleWorkflowBack() {
    if (ui.workflow.view === "run" || ui.workflow.view === "editor") {
      ui.workflow.view = "list";
      ui.workflow.editingRecordId = null;
      ui.workflow.recordDraft = createWorkflowRecordDraft(createLocalId);
      return;
    }

    backToWorkflowLibrary();
  }

  function backToWorkflowLibrary() {
    ui.workflow.view = "library";
    ui.workflow.editingRecordId = null;
    ui.workflow.runResult = null;
    syncWorkflowSelection();
  }

  function openWorkflowRecord(recordId) {
    ui.workflow.activeRecordId = recordId;
    ui.workflow.copiedStepId = null;
    ui.workflow.apiKeyVisible = false;
    ui.workflow.runResult = null;
    ui.workflow.expandedStepIds = [];
    ui.workflow.view = "run";
  }

  function openWorkflowRecordEditor(record = null) {
    ui.workflow.editingRecordId = record?.id ?? null;
    ui.workflow.recordDraft = record ? createWorkflowRecordDraftFromRecord(createLocalId, record) : createWorkflowRecordDraft(createLocalId);
    ui.workflow.apiKeyVisible = false;
    ui.workflow.view = "editor";
  }

  async function saveWorkflowRecord() {
    const card = activeWorkflowCard.value;

    if (ui.workflow.isSavingRecord) {
      return;
    }

    if (!desktopApi?.upsertWorkflowLibraryItem || !card) {
      setStatus("工作流仓储未就绪，暂时无法保存 curl。", "danger");
      return;
    }

    try {
      ui.workflow.isSavingRecord = true;
      setStatus("正在保存工作流配置...", "neutral");
      const existingRecord = card.records?.find((record) => record.id === ui.workflow.editingRecordId) ?? null;
      const nextRecord = buildWorkflowRecordFromDraft(createLocalId, ui.workflow.recordDraft, existingRecord);
      const nextRecords = existingRecord
        ? (card.records ?? []).map((record) => (record.id === existingRecord.id ? nextRecord : record))
        : [nextRecord, ...(card.records ?? [])];
      const nextCard = {
        ...card,
        usageCount: Number(card.usageCount ?? 0) + (existingRecord ? 0 : 1),
        updatedAt: nextRecord.updatedAt,
        lastUsedAt: nextRecord.updatedAt,
        records: nextRecords
      };

      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeCardId = nextCard.id;
      ui.workflow.activeRecordId = nextRecord.id;
      ui.workflow.copiedStepId = null;
      ui.workflow.editingRecordId = null;
      ui.workflow.recordDraft = createWorkflowRecordDraft(createLocalId);
      ui.workflow.view = "run";
      setStatus(`已保存「${nextRecord.name}」工作流。`, "success");
    } catch (error) {
      console.error("Failed to save workflow record", error);
      const message = getErrorMessage(error);
      setStatus(`保存工作流失败：${message}`, "danger");
      void showAlertDialog({
        tone: "danger",
        title: "保存工作流失败",
        message,
        confirmText: "知道了"
      });
    } finally {
      ui.workflow.isSavingRecord = false;
    }
  }

  function createWorkflowDuplicateRecordName(name, records = []) {
    const baseName = String(name ?? "").trim() || "未命名工作流";
    const copyBaseName = `${baseName.replace(/\s+副本(?:\s+\d+)?$/, "").trim() || baseName} 副本`;
    const existingNames = new Set((records ?? []).map((record) => String(record?.name ?? "").trim()));

    if (!existingNames.has(copyBaseName)) {
      return copyBaseName;
    }

    let copyIndex = 2;
    let nextName = `${copyBaseName} ${copyIndex}`;

    while (existingNames.has(nextName)) {
      copyIndex += 1;
      nextName = `${copyBaseName} ${copyIndex}`;
    }

    return nextName;
  }

  async function duplicateWorkflowRecord(record) {
    const card = activeWorkflowCard.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record) {
      setStatus("工作流仓储未就绪，暂时无法复制。", "danger");
      return;
    }

    try {
      const now = new Date().toISOString();
      const draft = createWorkflowRecordDraftFromRecord(createLocalId, record);
      draft.name = createWorkflowDuplicateRecordName(record.name, card.records ?? []);

      const nextRecord = buildWorkflowRecordFromDraft(createLocalId, draft);
      const nextCard = {
        ...card,
        usageCount: Number(card.usageCount ?? 0) + 1,
        updatedAt: now,
        lastUsedAt: now,
        records: [nextRecord, ...(card.records ?? [])]
      };

      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeCardId = nextCard.id;
      ui.workflow.activeRecordId = nextRecord.id;
      ui.workflow.runResult = null;
      setStatus(`已复制「${record.name}」。`, "success");
    } catch (error) {
      console.error("Failed to duplicate workflow record", error);
      setStatus(`复制工作流失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function deleteWorkflowRecord(recordId) {
    const card = activeWorkflowCard.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card) {
      setStatus("工作流仓储未就绪，暂时无法删除。", "danger");
      return;
    }

    const record = card.records?.find((entry) => entry.id === recordId) ?? null;
    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除工作流记录",
      message: `确认删除「${record?.name ?? "当前记录"}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    const nextCard = {
      ...card,
      updatedAt: new Date().toISOString(),
      records: (card.records ?? []).filter((record) => record.id !== recordId)
    };

    try {
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeRecordId = nextCard.records[0]?.id ?? null;
      ui.workflow.runResult = null;
      setStatus("已删除工作流。", "success");
    } catch (error) {
      console.error("Failed to delete workflow record", error);
      setStatus(`删除工作流失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function runActiveWorkflowRecord() {
    if (ui.workflow.isRunning) {
      await cancelActiveWorkflowRun();
      return;
    }

    if (!desktopApi?.runWorkflowRecord || !activeWorkflowRecord.value) {
      setStatus("工作流执行桥接未就绪。", "danger");
      return;
    }

    const missingFields = getWorkflowRuntimeMissingFields(activeWorkflowRecord.value);

    if (missingFields.length) {
      setStatus(`请先补齐：${missingFields.join("、")}。`, "warning");
      void showAlertDialog({
        tone: "warning",
        title: "运行配置不完整",
        message: `当前工作流需要 ${missingFields.join("、")}，补齐后再执行。`,
        confirmText: "知道了"
      });
      return;
    }

    try {
      const progressEventId = createLocalId("workflow_progress");
      const runRecord = buildWorkflowRunRecord(activeWorkflowRecord.value, progressEventId);

      ui.workflow.isRunning = true;
      ui.workflow.isCancelling = false;
      ui.workflow.activeProgressEventId = progressEventId;
      ui.workflow.runResult = buildWorkflowInitialRunResult(runRecord, progressEventId);
      setStatus("工作流正在执行。", "neutral");

      const result = await desktopApi.runWorkflowRecord(runRecord);
      ui.workflow.runResult = result;
      const cancelled = result?.status === "cancelled";

      if (cancelled) {
        setStatus("工作流已中断。", "warning");
        return;
      }

      const succeeded = result?.status === "success";
      setStatus(succeeded ? "工作流执行成功。" : "工作流执行失败，请查看输出。", succeeded ? "success" : "danger");

      if (!succeeded) {
        void showAlertDialog({
          tone: "danger",
          title: "工作流执行失败",
          message: "当前工作流没有完整执行成功，请查看输出区里的步骤状态、stderr 或 exit code。",
          confirmText: "知道了"
        });
      }
    } catch (error) {
      console.error("Failed to run workflow record", error);
      setStatus(`执行工作流失败：${getErrorMessage(error)}`, "danger");
      void showAlertDialog({
        tone: "danger",
        title: "工作流执行异常",
        message: getErrorMessage(error),
        confirmText: "知道了"
      });
    } finally {
      ui.workflow.isRunning = false;
      ui.workflow.isCancelling = false;
      ui.workflow.activeProgressEventId = null;
    }
  }

  async function cancelActiveWorkflowRun() {
    if (!ui.workflow.isRunning || !ui.workflow.activeProgressEventId) {
      return;
    }

    if (!desktopApi?.cancelWorkflowRecordRun) {
      setStatus("工作流中断桥接未就绪。", "danger");
      return;
    }

    try {
      ui.workflow.isCancelling = true;
      setStatus("正在中断工作流。", "warning");

      const result = await desktopApi.cancelWorkflowRecordRun(ui.workflow.activeProgressEventId);

      if (!result?.cancelled) {
        ui.workflow.isCancelling = false;
        setStatus("当前没有找到可中断的工作流执行。", "warning");
      }
    } catch (error) {
      console.error("Failed to cancel workflow record run", error);
      ui.workflow.isCancelling = false;
      setStatus(`中断工作流失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleWorkflowCurlCopy(step) {
    try {
      await copyTextToClipboard(step?.curl ?? "");
      ui.workflow.copiedStepId = step?.id ?? null;
      setStatus(`已复制「${step?.name ?? "当前步骤"}」的 curl。`, "success");
    } catch (error) {
      console.error("Failed to copy workflow curl", error);
      setStatus(`复制 curl 失败：${getErrorMessage(error)}`, "danger");
    }
  }

  return {
    activeWorkflowApiKeyInputType,
    activeWorkflowBodyStepOptions,
    activeWorkflowEnvironment,
    activeWorkflowEnvironments,
    activeWorkflowMetrics,
    activeWorkflowRecord,
    activeWorkflowSteps,
    addWorkflowDraftEnvironment,
    addWorkflowDraftStep,
    addWorkflowStepOutput,
    backToWorkflowLibrary,
    cancelActiveWorkflowRun,
    deleteWorkflowRecord,
    duplicateWorkflowRecord,
    filteredWorkflowRecords,
    formatDurationMs,
    getWorkflowCardCountLabel,
    getWorkflowRunCompletedCount,
    getWorkflowRunDurationLabel,
    getWorkflowRunProgressPercent,
    getWorkflowRunSummaryText,
    getWorkflowStepModeLabel,
    getWorkflowStepProgressPercent,
    getWorkflowStepStatusLabel,
    getWorkflowStepStatusTone,
    getWorkflowStepVisualRows,
    handleWorkflowApiKeyInput,
    handleWorkflowBack,
    handleWorkflowBodyDraftInput,
    handleWorkflowBodyStepSelect,
    handleWorkflowCurlCopy,
    handleWorkflowRunProgress,
    isWorkflowStepExpanded,
    openWorkflowCard,
    openWorkflowRecord,
    openWorkflowRecordEditor,
    persistActiveWorkflowRuntimeConfig,
    persistWorkflowBodyDraftToTemplate,
    removeWorkflowDraftEnvironment,
    removeWorkflowDraftStep,
    removeWorkflowStepOutput,
    repairWorkflowBodyDraft,
    runActiveWorkflowRecord,
    saveWorkflowRecord,
    selectWorkflowEnvironment,
    syncWorkflowBodyDraftFromActiveStep,
    syncWorkflowSelection,
    toggleWorkflowStepExpanded,
    workflowBodyDraftChanged,
    workflowDetailTitle,
    workflowLibraryCards,
    workflowRunControlIcon,
    workflowRunControlLabel,
    workflowRunStatusLabel,
    workflowRunStatusTone
  };
}
