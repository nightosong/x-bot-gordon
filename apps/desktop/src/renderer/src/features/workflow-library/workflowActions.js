import { computed } from "vue";

import {
  createDefaultWorkflowEnvironments,
  createInfoRadarSourceDraft as createInfoRadarSourceDraftFromConfig,
  createInfoRadarWindowDraft as createInfoRadarWindowDraftFromConfig,
  createInfoRadarWindowDraftFromWindow as createInfoRadarWindowDraftFromWindowConfig,
  createInfoRadarWindowDraftFromPreset as createInfoRadarWindowDraftFromPresetConfig,
  findInfoRadarWindowPreset,
  createWorkflowOutputDraft as createWorkflowOutputDraftFromConfig,
  createWorkflowRecordDraft as createWorkflowRecordDraftFromConfig,
  createWorkflowState as createWorkflowStateFromConfig,
  createWorkflowStepDraft as createWorkflowStepDraftFromConfig
} from "./workflowConfig.js";
import {
  buildInfoRadarWindowFromDraft,
  buildWorkflowInitialRunResult,
  buildWorkflowRecordFromDraft as buildWorkflowRecordFromDraftRuntime,
  canOpenInfoRadarItem,
  createWorkflowRecordDraftFromRecord as createWorkflowRecordDraftFromRecordRuntime,
  extractCurlMethod,
  extractCurlUrl,
  findWorkflowCurlBodySegment,
  formatDurationMs,
  formatFinanceBriefCompactNumber,
  formatFinanceBriefNumber,
  formatFinanceBriefPercent,
  formatFinanceBriefQuoteDateTime,
  formatFinanceBriefSignedNumber,
  getInfoRadarCadenceLabel,
  getInfoRadarItemHref,
  getInfoRadarItemSummaryText,
  getInfoRadarItemStatusLabel,
  getInfoRadarRunStatusLabel,
  getInfoRadarRunStatusTone,
  getInfoRadarScorePercent,
  getInfoRadarSourceKindLabel,
  getInfoRadarSourceTone,
  getFinanceBriefChartAxis,
  getFinanceBriefChartBounds,
  getFinanceBriefChartRows,
  getFinanceBriefChartSummary,
  getFinanceBriefChangeTone,
  getFinanceBriefIntervalLabel,
  getFinanceBriefRangeLabel,
  getFinanceBriefSymbolLabel,
  getLiveStreamInputPlaceholder,
  getLiveStreamPlatformLabel,
  getLiveStreamSourceLabel,
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
  normalizeLiveStreamUrl,
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

function normalizeInfoRadarFilterValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getInfoRadarItemTagValues(item) {
  return [...(item?.matchedKeywords ?? []), ...(item?.tags ?? [])]
    .map((tag) => String(tag ?? "").trim())
    .filter(Boolean);
}

function infoRadarItemMatchesSource(item, sourceFilter) {
  return !sourceFilter || normalizeInfoRadarFilterValue(item?.sourceKind ?? "manual") === sourceFilter;
}

function infoRadarItemMatchesTopic(item, topicFilter) {
  if (!topicFilter) {
    return true;
  }

  return getInfoRadarItemTagValues(item)
    .map((tag) => normalizeInfoRadarFilterValue(tag))
    .includes(topicFilter);
}

function getInfoRadarPublishedRank(item) {
  const publishedTime = new Date(item?.publishedAt ?? "").getTime();
  return Number.isFinite(publishedTime) ? publishedTime : 0;
}

function getInfoRadarFetchedRank(item) {
  const fetchedTime = new Date(item?.fetchedAt ?? "").getTime();
  return Number.isFinite(fetchedTime) ? fetchedTime : 0;
}

function compareInfoRadarItems(left, right) {
  const leftPublishedRank = getInfoRadarPublishedRank(left);
  const rightPublishedRank = getInfoRadarPublishedRank(right);
  const leftHasPublishedAt = leftPublishedRank > 0;
  const rightHasPublishedAt = rightPublishedRank > 0;

  if (leftHasPublishedAt !== rightHasPublishedAt) {
    return leftHasPublishedAt ? -1 : 1;
  }

  if (rightPublishedRank !== leftPublishedRank) {
    return rightPublishedRank - leftPublishedRank;
  }

  const scoreRank = Number(right?.score ?? 0) - Number(left?.score ?? 0);

  if (scoreRank !== 0) {
    return scoreRank;
  }

  return getInfoRadarFetchedRank(right) - getInfoRadarFetchedRank(left);
}

function createInfoRadarSourceDraft(createLocalId, overrides = {}) {
  return createInfoRadarSourceDraftFromConfig(overrides, createLocalId);
}

function createInfoRadarWindowDraft(createLocalId, overrides = {}) {
  return createInfoRadarWindowDraftFromConfig(createLocalId, overrides);
}

function createInfoRadarWindowDraftFromWindow(createLocalId, infoWindow) {
  return createInfoRadarWindowDraftFromWindowConfig(infoWindow, createLocalId);
}

function createInfoRadarWindowDraftFromPreset(createLocalId, preset) {
  return createInfoRadarWindowDraftFromPresetConfig(preset, createLocalId);
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
  const activeInfoWindows = computed(() => activeWorkflowCard.value?.infoWindows ?? []);
  const activeInfoWindow = computed(
    () => activeInfoWindows.value.find((infoWindow) => infoWindow.id === ui.workflow.activeInfoWindowId) ?? activeInfoWindows.value[0] ?? null
  );
  const activeInfoReaderItem = computed(
    () => activeInfoWindow.value?.items?.find((item) => item.id === ui.workflow.activeInfoReaderItemId) ?? null
  );
  const activeFinanceBrief = computed(() => activeWorkflowCard.value?.financeBrief ?? null);
  const activeFinanceSymbols = computed(() => activeFinanceBrief.value?.symbols ?? []);
  const activeFinanceSymbol = computed(() => {
    const symbols = activeFinanceSymbols.value;
    const configuredSymbol =
      symbols.find((symbol) => symbol.id === activeFinanceBrief.value?.activeSymbolId) ??
      symbols[0] ??
      null;
    const query = String(ui.workflow.financeSymbolQuery ?? "").trim().toUpperCase();

    if (!query) {
      return configuredSymbol;
    }

    return symbols.find((symbol) => String(symbol.symbol ?? "").trim().toUpperCase() === query) ?? configuredSymbol;
  });
  const activeFinanceSnapshot = computed(() => activeFinanceBrief.value?.lastSnapshot ?? null);
  const activeFinanceChartRows = computed(() => getFinanceBriefChartRows(activeFinanceSnapshot.value));
  const activeFinanceChartBounds = computed(() => getFinanceBriefChartBounds(activeFinanceSnapshot.value));
  const activeFinanceChartAxis = computed(() => getFinanceBriefChartAxis(activeFinanceSnapshot.value));
  const activeFinanceChartSummary = computed(() => getFinanceBriefChartSummary(activeFinanceSnapshot.value));
  const financeBriefSymbolOptions = computed(() =>
    activeFinanceSymbols.value.map((symbol) => ({
      value: symbol.id,
      label: getFinanceBriefSymbolLabel(symbol)
    }))
  );
  const activeLiveStreamConfig = computed(() => activeWorkflowCard.value?.liveStream ?? null);
  const activeLiveStreamSources = computed(() => activeLiveStreamConfig.value?.sources ?? []);
  const activeLiveStreamSource = computed(() => {
    const sources = activeLiveStreamSources.value;
    const requestedId = ui.workflow.liveStreamActiveSourceId || activeLiveStreamConfig.value?.activeSourceId;
    return sources.find((source) => source.id === requestedId) ?? sources.find((source) => source.status !== "paused") ?? sources[0] ?? null;
  });
  const liveStreamPlatformOptions = computed(() => [
    { value: "bilibili", label: "Bilibili" },
    { value: "xiaohongshu", label: "小红书" },
    { value: "custom", label: "自定义" }
  ]);
  const liveStreamInputPlaceholder = computed(() => getLiveStreamInputPlaceholder(ui.workflow.liveStreamPlatform));
  const searchFilteredInfoRadarItems = computed(() => {
    const query = String(ui.workflow.infoSearchQuery ?? "").trim().toLowerCase();
    const items = activeInfoWindow.value?.items ?? [];
    const visibleItems = query
      ? items.filter((item) =>
      [
        item.title,
        getInfoRadarItemSummaryText(item),
        item.sourceTitle,
        item.author,
        item.matchedKeywords?.join(" "),
        item.tags?.join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
      )
      : items;

    return [...visibleItems].sort(compareInfoRadarItems);
  });
  const sourceCountInfoRadarItems = computed(() => {
    const topicFilter = normalizeInfoRadarFilterValue(ui.workflow.infoTopicFilter);
    return searchFilteredInfoRadarItems.value.filter((item) => infoRadarItemMatchesTopic(item, topicFilter));
  });
  const topicCountInfoRadarItems = computed(() => {
    const sourceFilter = normalizeInfoRadarFilterValue(ui.workflow.infoSourceFilter);
    return searchFilteredInfoRadarItems.value.filter((item) => infoRadarItemMatchesSource(item, sourceFilter));
  });
  const filteredInfoRadarItems = computed(() => {
    const sourceFilter = normalizeInfoRadarFilterValue(ui.workflow.infoSourceFilter);
    const topicFilter = normalizeInfoRadarFilterValue(ui.workflow.infoTopicFilter);

    return searchFilteredInfoRadarItems.value.filter(
      (item) => infoRadarItemMatchesSource(item, sourceFilter) && infoRadarItemMatchesTopic(item, topicFilter)
    );
  });
  const filteredInfoRadarItemsByStatus = computed(() => {
    const statusFilter = String(ui.workflow.infoStatusFilter ?? "").trim();
    const base = filteredInfoRadarItems.value;
    if (!statusFilter) return base;
    return base.filter((item) => item.status === statusFilter);
  });
  const activeInfoRadarSourceGroups = computed(() => {
    const sources = activeInfoWindow.value?.sources ?? [];
    const sourceItemCounts = new Map();
    const groups = new Map();

    for (const item of sourceCountInfoRadarItems.value) {
      const key = item.sourceKind ?? "manual";
      sourceItemCounts.set(key, (sourceItemCounts.get(key) ?? 0) + 1);
    }

    for (const source of sources) {
      const key = source.kind ?? "manual";
      const current = groups.get(key) ?? {
        kind: key,
        label: getInfoRadarSourceKindLabel(key),
        tone: getInfoRadarSourceTone(key),
        total: 0,
        enabled: 0,
        itemCount: sourceItemCounts.get(key) ?? 0,
        sources: []
      };

      current.total += 1;

      if (source.enabled !== false) {
        current.enabled += 1;
      }

      current.sources.push(source);
      groups.set(key, current);
    }

    for (const [key, itemCount] of sourceItemCounts.entries()) {
      if (groups.has(key)) {
        continue;
      }

      groups.set(key, {
        kind: key,
        label: getInfoRadarSourceKindLabel(key),
        tone: getInfoRadarSourceTone(key),
        total: 0,
        enabled: 0,
        itemCount,
        sources: []
      });
    }

    return Array.from(groups.values()).sort((left, right) => right.enabled - left.enabled || right.total - left.total);
  });
  const infoRadarSourceFilterOptions = computed(() => [
    { value: "", label: `全部来源 ${sourceCountInfoRadarItems.value.length}` },
    ...activeInfoRadarSourceGroups.value.map((group) => ({
      value: group.kind,
      label: `${group.label} ${group.itemCount}`
    }))
  ]);
  const activeInfoRadarHotTopics = computed(() => {
    const counts = new Map();

    for (const item of topicCountInfoRadarItems.value) {
      for (const tag of getInfoRadarItemTagValues(item)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  });
  const infoRadarTopicFilterOptions = computed(() => {
    const selectedTopic = String(ui.workflow.infoTopicFilter ?? "").trim();
    const topicOptions = activeInfoRadarHotTopics.value.map((topic) => ({
      value: topic.label,
      label: `${topic.label} ${topic.count}`
    }));

    if (selectedTopic && !topicOptions.some((option) => option.value === selectedTopic)) {
      topicOptions.unshift({ value: selectedTopic, label: `${selectedTopic} 0` });
    }

    return [{ value: "", label: `全部标签 ${topicCountInfoRadarItems.value.length}` }, ...topicOptions];
  });
  const infoRadarMetrics = computed(() => {
    const windows = activeInfoWindows.value;
    const items = windows.flatMap((infoWindow) => infoWindow.items ?? []);
    const sources = windows.flatMap((infoWindow) => infoWindow.sources ?? []);
    const activeItems = activeInfoWindow.value?.items ?? [];
    const newItemCount = activeItems.filter((item) => item.status === "new").length;
    const highScoreCount = activeItems.filter((item) => Number(item.score ?? 0) >= 20).length;
    const latestItem = [...activeItems].sort(compareInfoRadarItems)[0] ?? null;

    return {
      windowCount: windows.length,
      itemCount: items.length,
      sourceCount: sources.length,
      activeSourceCount: sources.filter((source) => source.enabled !== false).length,
      activeItemCount: activeItems.length,
      newItemCount,
      highScoreCount,
      latestItemAt: latestItem?.publishedAt ?? latestItem?.fetchedAt ?? ""
    };
  });
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
    if (ui.workflow.view === "info-editor") {
      return ui.workflow.editingInfoWindowId ? "编辑信息窗口" : "新建信息窗口";
    }

    if (ui.workflow.view === "info") {
      return activeInfoWindow.value?.title ?? activeWorkflowCard.value?.title ?? "信息雷达";
    }

    if (ui.workflow.view === "info-reader") {
      return activeInfoReaderItem.value?.title ?? "来源阅读";
    }

    if (ui.workflow.view === "finance") {
      return activeWorkflowCard.value?.title ?? "金融快报";
    }

    if (ui.workflow.view === "live-stream") {
      return activeWorkflowCard.value?.title ?? "直播流";
    }

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
      ui.workflow.activeInfoWindowId = null;
      ui.workflow.copiedStepId = null;
      ui.workflow.expandedStepIds = [];
      return;
    }

    const nextCard =
      workbench.workflowLibrary.find((entry) => entry.id === ui.workflow.activeCardId) ?? workbench.workflowLibrary[0];
    ui.workflow.activeCardId = nextCard?.id ?? null;

    if (nextCard?.kind === "info-radar") {
      const nextWindow =
        nextCard?.infoWindows?.find((infoWindow) => infoWindow.id === ui.workflow.activeInfoWindowId) ??
        nextCard?.infoWindows?.[0] ??
        null;
      ui.workflow.activeInfoWindowId = nextWindow?.id ?? null;
      ui.workflow.activeRecordId = null;
      ui.workflow.activeInfoReaderItemId =
        nextWindow?.items?.some((item) => item.id === ui.workflow.activeInfoReaderItemId) ? ui.workflow.activeInfoReaderItemId : null;
      ui.workflow.infoReaderError = "";
    } else if (nextCard?.kind === "finance-brief") {
      ui.workflow.activeRecordId = null;
      ui.workflow.activeInfoWindowId = null;
      ui.workflow.activeInfoReaderItemId = null;
      ui.workflow.infoReaderError = "";
      ui.workflow.financeRange = nextCard.financeBrief?.range ?? ui.workflow.financeRange ?? "1mo";
      ui.workflow.financeInterval = nextCard.financeBrief?.interval ?? ui.workflow.financeInterval ?? "1d";
      ui.workflow.financeSymbolQuery =
        nextCard.financeBrief?.symbols?.find((symbol) => symbol.id === nextCard.financeBrief?.activeSymbolId)?.symbol ??
        nextCard.financeBrief?.symbols?.[0]?.symbol ??
        ui.workflow.financeSymbolQuery ??
        "";
    } else if (nextCard?.kind === "live-stream") {
      const nextSource =
        nextCard?.liveStream?.sources?.find((source) => source.id === (ui.workflow.liveStreamActiveSourceId || nextCard.liveStream?.activeSourceId)) ??
        nextCard?.liveStream?.sources?.find((source) => source.status !== "paused") ??
        nextCard?.liveStream?.sources?.[0] ??
        null;
      ui.workflow.activeRecordId = null;
      ui.workflow.activeInfoWindowId = null;
      ui.workflow.activeInfoReaderItemId = null;
      ui.workflow.infoReaderError = "";
      ui.workflow.liveStreamActiveSourceId = nextSource?.id ?? null;
      ui.workflow.liveStreamPlatform = nextSource?.platform ?? ui.workflow.liveStreamPlatform ?? "bilibili";
      ui.workflow.liveStreamUrlInput = nextSource?.roomId || nextSource?.url || ui.workflow.liveStreamUrlInput || "";
      ui.workflow.liveStreamResolvedUrl = normalizeLiveStreamUrl(nextSource?.url, nextSource?.platform) || nextSource?.url || "";
      ui.workflow.liveStreamError = "";
    } else {
      const nextRecord = nextCard?.records?.find((record) => record.id === ui.workflow.activeRecordId) ?? nextCard?.records?.[0] ?? null;
      ui.workflow.activeRecordId = nextRecord?.id ?? null;
      ui.workflow.activeInfoWindowId = null;
      ui.workflow.activeInfoReaderItemId = null;
      ui.workflow.infoReaderError = "";
    }

    ui.workflow.copiedStepId = null;
    ui.workflow.expandedStepIds = [];
  }

  function openWorkflowCard(cardId) {
    writeRef(activeFeature, featureWorkflowLibraryId);
    ui.workflow.activeCardId = cardId;
    const card = workbench.workflowLibrary.find((entry) => entry.id === cardId);
    const isInfoRadar = card?.kind === "info-radar";
    const isFinanceBrief = card?.kind === "finance-brief";
    const isLiveStream = card?.kind === "live-stream";
    const liveSource =
      card?.liveStream?.sources?.find((source) => source.id === card.liveStream?.activeSourceId) ??
      card?.liveStream?.sources?.find((source) => source.status !== "paused") ??
      card?.liveStream?.sources?.[0] ??
      null;

    ui.workflow.view = isInfoRadar ? "info" : isFinanceBrief ? "finance" : isLiveStream ? "live-stream" : "list";
    ui.workflow.activeRecordId = isInfoRadar || isFinanceBrief || isLiveStream ? null : card?.records?.[0]?.id ?? null;
    ui.workflow.activeInfoWindowId = isInfoRadar ? card?.infoWindows?.[0]?.id ?? null : null;
    ui.workflow.activeInfoReaderItemId = null;
    ui.workflow.infoReaderError = "";
    ui.workflow.infoReaderResolvedUrl = "";
    ui.workflow.copiedStepId = null;
    ui.workflow.searchQuery = "";
    ui.workflow.infoSearchQuery = "";
    ui.workflow.infoSourceFilter = "";
    ui.workflow.infoTopicFilter = "";
    ui.workflow.infoStatusFilter = "";
    ui.workflow.financeRange = card?.financeBrief?.range ?? ui.workflow.financeRange ?? "1mo";
    ui.workflow.financeInterval = card?.financeBrief?.interval ?? ui.workflow.financeInterval ?? "1d";
    ui.workflow.financeSymbolQuery =
      card?.financeBrief?.symbols?.find((symbol) => symbol.id === card.financeBrief?.activeSymbolId)?.symbol ??
      card?.financeBrief?.symbols?.[0]?.symbol ??
      "";
    ui.workflow.financeBriefError = "";
    ui.workflow.liveStreamActiveSourceId = liveSource?.id ?? null;
    ui.workflow.liveStreamPlatform = liveSource?.platform ?? "bilibili";
    ui.workflow.liveStreamUrlInput = liveSource?.roomId || liveSource?.url || "";
    ui.workflow.liveStreamResolvedUrl = normalizeLiveStreamUrl(liveSource?.url, liveSource?.platform) || liveSource?.url || "";
    ui.workflow.liveStreamError = "";
    ui.workflow.isLiveStreamLoading = Boolean(isLiveStream && liveSource?.url);
    ui.workflow.runResult = null;
    ui.workflow.expandedStepIds = [];
  }

  function handleWorkflowBack() {
    if (ui.workflow.view === "info-editor") {
      ui.workflow.view = "info";
      ui.workflow.editingInfoWindowId = null;
      ui.workflow.infoWindowDraft = createInfoRadarWindowDraft(createLocalId);
      return;
    }

    if (ui.workflow.view === "info-reader") {
      ui.workflow.view = "info";
      ui.workflow.activeInfoReaderItemId = null;
      ui.workflow.isInfoReaderLoading = false;
      ui.workflow.infoReaderError = "";
      ui.workflow.infoReaderResolvedUrl = "";
      return;
    }

    if (ui.workflow.view === "info") {
      backToWorkflowLibrary();
      return;
    }

    if (ui.workflow.view === "finance") {
      backToWorkflowLibrary();
      return;
    }

    if (ui.workflow.view === "live-stream") {
      backToWorkflowLibrary();
      return;
    }

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
    ui.workflow.editingInfoWindowId = null;
    ui.workflow.activeInfoReaderItemId = null;
    ui.workflow.isInfoReaderLoading = false;
    ui.workflow.infoReaderError = "";
    ui.workflow.infoReaderResolvedUrl = "";
    ui.workflow.financeBriefError = "";
    ui.workflow.liveStreamError = "";
    ui.workflow.isLiveStreamLoading = false;
    ui.workflow.runResult = null;
    syncWorkflowSelection();
  }

  function openInfoRadarWindow(windowId) {
    ui.workflow.activeInfoWindowId = windowId;
    ui.workflow.activeInfoReaderItemId = null;
    ui.workflow.isInfoReaderLoading = false;
    ui.workflow.infoReaderError = "";
    ui.workflow.infoReaderResolvedUrl = "";
    ui.workflow.infoSearchQuery = "";
    ui.workflow.infoSourceFilter = "";
    ui.workflow.infoTopicFilter = "";
    ui.workflow.infoStatusFilter = "";
    ui.workflow.view = "info";
  }

  function openInfoRadarItemReader(item) {
    if (!canOpenInfoRadarItem(item)) {
      setStatus("当前信息没有可打开的来源链接。", "warning");
      return;
    }

    ui.workflow.activeInfoReaderItemId = item?.id ?? null;
    ui.workflow.isInfoReaderLoading = true;
    ui.workflow.infoReaderError = "";
    ui.workflow.infoReaderResolvedUrl = "";
    ui.workflow.view = "info-reader";
  }

  async function openInfoRadarItemExternal(item, overrideUrl = "") {
    const href = String(overrideUrl || getInfoRadarItemHref(item)).trim();

    if (!href) {
      setStatus("当前信息没有可打开的来源链接。", "warning");
      return;
    }

    if (!desktopApi?.openExternalUrl) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await desktopApi.openExternalUrl(href);
      setStatus("已使用系统默认浏览器打开来源。", "success");
    } catch (error) {
      console.error("Failed to open info radar item externally", error);
      setStatus(`打开来源失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function handleInfoRadarReaderLoadingStart() {
    if (ui.workflow.view !== "info-reader") {
      return;
    }

    ui.workflow.isInfoReaderLoading = true;
    ui.workflow.infoReaderError = "";
  }

  function handleInfoRadarReaderLoadingEnd() {
    ui.workflow.isInfoReaderLoading = false;
  }

  function openInfoRadarWindowEditor(infoWindow = null) {
    ui.workflow.editingInfoWindowId = infoWindow?.id ?? null;
    ui.workflow.infoWindowDraft = infoWindow
      ? createInfoRadarWindowDraftFromWindow(createLocalId, infoWindow)
      : createInfoRadarWindowDraft(createLocalId);
    ui.workflow.view = "info-editor";
  }

  function applyInfoRadarPreset(presetId) {
    const preset = findInfoRadarWindowPreset(presetId);

    if (!preset) {
      return;
    }

    ui.workflow.editingInfoWindowId = null;
    ui.workflow.infoWindowDraft = createInfoRadarWindowDraftFromPreset(createLocalId, preset);
    ui.workflow.view = "info-editor";
    setStatus(`已载入「${preset.label}」预设，确认来源后保存即可开始接收。`, "neutral");
  }

  function addInfoRadarSourceDraft() {
    ui.workflow.infoWindowDraft.sources = [
      ...(ui.workflow.infoWindowDraft.sources ?? []),
      createInfoRadarSourceDraft(createLocalId)
    ];
  }

  function removeInfoRadarSourceDraft(sourceId) {
    const nextSources = (ui.workflow.infoWindowDraft.sources ?? []).filter((source) => source.id !== sourceId);
    ui.workflow.infoWindowDraft.sources = nextSources.length ? nextSources : [createInfoRadarSourceDraft(createLocalId)];
  }

  async function saveInfoRadarWindow() {
    const card = activeWorkflowCard.value;

    if (ui.workflow.isSavingInfoWindow) {
      return;
    }

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || card.kind !== "info-radar") {
      setStatus("信息雷达仓储未就绪，暂时无法保存。", "danger");
      return;
    }

    try {
      ui.workflow.isSavingInfoWindow = true;
      setStatus("正在保存信息窗口...", "neutral");

      const existingWindow = (card.infoWindows ?? []).find((infoWindow) => infoWindow.id === ui.workflow.editingInfoWindowId) ?? null;
      const nextWindow = buildInfoRadarWindowFromDraft(ui.workflow.infoWindowDraft, existingWindow, { createLocalId });
      const nextWindows = existingWindow
        ? (card.infoWindows ?? []).map((infoWindow) => (infoWindow.id === existingWindow.id ? nextWindow : infoWindow))
        : [nextWindow, ...(card.infoWindows ?? [])];
      const nextCard = {
        ...card,
        usageCount: Number(card.usageCount ?? 0) + (existingWindow ? 0 : 1),
        updatedAt: nextWindow.updatedAt,
        lastUsedAt: nextWindow.updatedAt,
        infoWindows: nextWindows
      };

      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeCardId = nextCard.id;
      ui.workflow.activeInfoWindowId = nextWindow.id;
      ui.workflow.editingInfoWindowId = null;
      ui.workflow.infoWindowDraft = createInfoRadarWindowDraft(createLocalId);
      ui.workflow.view = "info";
      setStatus(`已保存「${nextWindow.title}」。`, "success");
    } catch (error) {
      console.error("Failed to save info radar window", error);
      const message = getErrorMessage(error);
      setStatus(`保存信息窗口失败：${message}`, "danger");
      void showAlertDialog({
        tone: "danger",
        title: "保存信息窗口失败",
        message,
        confirmText: "知道了"
      });
    } finally {
      ui.workflow.isSavingInfoWindow = false;
    }
  }

  async function deleteInfoRadarWindow(windowId) {
    const card = activeWorkflowCard.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || card.kind !== "info-radar") {
      setStatus("信息雷达仓储未就绪，暂时无法删除。", "danger");
      return;
    }

    const infoWindow = (card.infoWindows ?? []).find((entry) => entry.id === windowId) ?? null;
    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除信息窗口",
      message: `确认删除「${infoWindow?.title ?? "当前窗口"}」吗？已抓取的信息条目也会从该窗口移除。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    const nextCard = {
      ...card,
      updatedAt: new Date().toISOString(),
      infoWindows: (card.infoWindows ?? []).filter((entry) => entry.id !== windowId)
    };

    try {
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeInfoWindowId = nextCard.infoWindows[0]?.id ?? null;
      setStatus("已删除信息窗口。", "success");
    } catch (error) {
      console.error("Failed to delete info radar window", error);
      setStatus(`删除信息窗口失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function refreshActiveInfoRadarWindow() {
    const card = activeWorkflowCard.value;
    const infoWindow = activeInfoWindow.value;

    if (ui.workflow.isRefreshingInfoWindow) {
      return;
    }

    if (!desktopApi?.refreshInfoRadarWindow || !card || !infoWindow) {
      setStatus("信息刷新桥接未就绪。", "danger");
      return;
    }

    try {
      ui.workflow.isRefreshingInfoWindow = true;
      setStatus(`正在刷新「${infoWindow.title}」...`, "neutral");
      const result = await desktopApi.refreshInfoRadarWindow(
        toPlainIpcData({
          cardId: card.id,
          windowId: infoWindow.id
        })
      );
      const nextCard = result?.card;

      if (nextCard) {
        workbench.workflowLibrary = workbench.workflowLibrary.map((entry) => (entry.id === nextCard.id ? nextCard : entry));
        ui.workflow.activeCardId = nextCard.id;
        ui.workflow.activeInfoWindowId = result?.window?.id ?? infoWindow.id;
      }

      const run = result?.run;
      const succeeded = run?.status === "success";
      const partial = run?.status === "partial";
      setStatus(run?.message || "信息窗口刷新完成。", succeeded ? "success" : partial ? "warning" : "danger");
    } catch (error) {
      console.error("Failed to refresh info radar window", error);
      setStatus(`刷新信息窗口失败：${getErrorMessage(error)}`, "danger");
    } finally {
      ui.workflow.isRefreshingInfoWindow = false;
    }
  }

  function selectFinanceBriefSymbol(symbolId) {
    const symbol = activeFinanceSymbols.value.find((entry) => entry.id === symbolId) ?? null;

    if (!symbol) {
      return;
    }

    ui.workflow.financeSymbolQuery = symbol.symbol;
  }

  async function queryActiveFinanceBrief(options = {}) {
    const card = activeWorkflowCard.value;
    const query = String(ui.workflow.financeSymbolQuery || activeFinanceSymbol.value?.symbol || "").trim().toUpperCase();
    const silent = options?.silent === true;

    if (ui.workflow.isQueryingFinanceBrief) {
      return;
    }

    if (!desktopApi?.queryFinanceBriefQuote || !card || card.kind !== "finance-brief") {
      if (!silent) {
        setStatus("金融行情桥接未就绪。", "danger");
      }
      return;
    }

    if (!query) {
      if (!silent) {
        setStatus("请输入要查询的金融标的 symbol。", "warning");
      }
      return;
    }

    try {
      ui.workflow.isQueryingFinanceBrief = true;
      ui.workflow.financeBriefError = "";
      if (!silent) {
        setStatus(`正在查询 ${query} 行情...`, "neutral");
      }

      const result = await desktopApi.queryFinanceBriefQuote(
        toPlainIpcData({
          cardId: card.id,
          symbolId: activeFinanceSymbol.value?.id,
          symbol: query,
          range: ui.workflow.financeRange,
          interval: ui.workflow.financeInterval
        })
      );
      const nextCard = result?.card;

      if (nextCard) {
        workbench.workflowLibrary = workbench.workflowLibrary.map((entry) => (entry.id === nextCard.id ? nextCard : entry));
        ui.workflow.activeCardId = nextCard.id;
        ui.workflow.financeRange = nextCard.financeBrief?.range ?? ui.workflow.financeRange;
        ui.workflow.financeInterval = nextCard.financeBrief?.interval ?? ui.workflow.financeInterval;
        ui.workflow.financeSymbolQuery =
          nextCard.financeBrief?.symbols?.find((symbol) => symbol.id === nextCard.financeBrief?.activeSymbolId)?.symbol ??
          result?.snapshot?.quote?.symbol ??
          query;
      }

      if (!silent) {
        setStatus(`已更新 ${result?.snapshot?.quote?.displayName ?? query} 行情。`, "success");
      }
    } catch (error) {
      console.error("Failed to query finance brief quote", error);
      const message = getErrorMessage(error);
      ui.workflow.financeBriefError = message;
      if (!silent) {
        setStatus(`查询行情失败：${message}`, "danger");
      }
    } finally {
      ui.workflow.isQueryingFinanceBrief = false;
    }
  }

  function resolveLiveStreamUrlFromInput(input = ui.workflow.liveStreamUrlInput, platform = ui.workflow.liveStreamPlatform) {
    return normalizeLiveStreamUrl(input, platform);
  }

  function handleLiveStreamLoadingStart() {
    if (ui.workflow.view !== "live-stream") {
      return;
    }

    ui.workflow.isLiveStreamLoading = true;
    ui.workflow.liveStreamError = "";
  }

  function handleLiveStreamLoadingEnd() {
    ui.workflow.isLiveStreamLoading = false;
  }

  async function persistLiveStreamSelection(source, resolvedUrl = "") {
    const card = activeWorkflowCard.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || card.kind !== "live-stream" || !source) {
      return;
    }

    const now = new Date().toISOString();
    const nextSource = {
      ...source,
      ...(resolvedUrl ? { url: resolvedUrl } : {}),
      lastOpenedAt: now,
      updatedAt: now
    };
    const nextCard = {
      ...card,
      updatedAt: now,
      lastUsedAt: now,
      liveStream: {
        ...(card.liveStream ?? {}),
        activeSourceId: source.id,
        updatedAt: now,
        sources: (card.liveStream?.sources ?? []).map((entry) => (entry.id === source.id ? nextSource : entry))
      }
    };

    try {
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.activeCardId = nextCard.id;
      ui.workflow.liveStreamActiveSourceId = source.id;
      ui.workflow.liveStreamResolvedUrl = resolvedUrl || source.url || "";
    } catch (error) {
      console.error("Failed to persist live stream selection", error);
    }
  }

  async function openLiveStreamSource(source = activeLiveStreamSource.value) {
    if (!source) {
      setStatus("还没有可打开的直播间。", "warning");
      return;
    }

    const resolvedUrl = normalizeLiveStreamUrl(source.url, source.platform) || source.url;

    if (!resolvedUrl) {
      setStatus("当前直播间链接不可用。", "warning");
      return;
    }

    ui.workflow.liveStreamActiveSourceId = source.id;
    ui.workflow.liveStreamPlatform = source.platform ?? "custom";
    ui.workflow.liveStreamUrlInput = source.roomId || source.url || "";
    ui.workflow.liveStreamResolvedUrl = resolvedUrl;
    ui.workflow.liveStreamError = "";
    ui.workflow.isLiveStreamLoading = true;
    ui.workflow.liveStreamReloadKey = Number(ui.workflow.liveStreamReloadKey ?? 0) + 1;

    await persistLiveStreamSelection(source, resolvedUrl);
  }

  function openLiveStreamFromInput() {
    const resolvedUrl = resolveLiveStreamUrlFromInput();

    if (!resolvedUrl) {
      setStatus("请输入有效的直播间房间号或 http/https 链接。", "warning");
      ui.workflow.liveStreamError = "直播地址格式不正确。";
      return;
    }

    ui.workflow.liveStreamActiveSourceId = null;
    ui.workflow.liveStreamResolvedUrl = resolvedUrl;
    ui.workflow.liveStreamError = "";
    ui.workflow.isLiveStreamLoading = true;
    ui.workflow.liveStreamReloadKey = Number(ui.workflow.liveStreamReloadKey ?? 0) + 1;
    ui.workflow.view = "live-stream";
  }

  function refreshLiveStreamView() {
    const source = activeLiveStreamSource.value;
    const resolvedUrl =
      ui.workflow.liveStreamResolvedUrl ||
      normalizeLiveStreamUrl(source?.url, source?.platform) ||
      normalizeLiveStreamUrl(ui.workflow.liveStreamUrlInput, ui.workflow.liveStreamPlatform);

    if (!resolvedUrl) {
      setStatus("当前没有可刷新的直播链接。", "warning");
      return;
    }

    ui.workflow.liveStreamResolvedUrl = resolvedUrl;
    ui.workflow.liveStreamError = "";
    ui.workflow.isLiveStreamLoading = true;
    ui.workflow.liveStreamReloadKey = Number(ui.workflow.liveStreamReloadKey ?? 0) + 1;
  }

  async function openLiveStreamExternal() {
    const href = String(ui.workflow.liveStreamResolvedUrl || resolveLiveStreamUrlFromInput()).trim();

    if (!href) {
      setStatus("当前没有可打开的直播链接。", "warning");
      return;
    }

    if (!desktopApi?.openExternalUrl) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await desktopApi.openExternalUrl(href);
      setStatus("已使用系统默认浏览器打开直播页。", "success");
    } catch (error) {
      console.error("Failed to open live stream externally", error);
      setStatus(`打开直播页失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function saveLiveStreamInputAsSource() {
    const card = activeWorkflowCard.value;
    const resolvedUrl = resolveLiveStreamUrlFromInput();

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || card.kind !== "live-stream") {
      setStatus("直播流仓储未就绪，暂时无法收藏。", "danger");
      return;
    }

    if (!resolvedUrl) {
      setStatus("请输入有效的直播间房间号或 http/https 链接。", "warning");
      return;
    }

    const now = new Date().toISOString();
    const platform = ui.workflow.liveStreamPlatform || "custom";
    const inputValue = String(ui.workflow.liveStreamUrlInput ?? "").trim();
    const bilibiliRoomMatch = platform === "bilibili" ? resolvedUrl.match(/live\.bilibili\.com\/(?:blanc\/)?(\d+)/i) : null;
    const roomId = platform === "bilibili" && /^\d+$/.test(inputValue)
      ? inputValue
      : bilibiliRoomMatch?.[1] ?? "";
    const title = roomId ? `Bilibili 直播间 ${roomId}` : `${getLiveStreamPlatformLabel(platform)} 直播`;
    const existingSources = card.liveStream?.sources ?? [];
    const duplicateSource =
      existingSources.find((source) => String(source.url ?? "").trim() === resolvedUrl) ??
      existingSources.find((source) => platform === "bilibili" && roomId && source.platform === "bilibili" && source.roomId === roomId) ??
      null;
    const nextSource = duplicateSource
      ? {
        ...duplicateSource,
        platform,
        ...(roomId ? { roomId } : {}),
        url: resolvedUrl,
        status: "active",
        updatedAt: now
      }
      : {
        id: createLocalId("live_stream"),
        title,
        platform,
        ...(roomId ? { roomId } : {}),
        url: resolvedUrl,
        notes: "",
        status: "active",
        sortOrder: existingSources.length,
        updatedAt: now
      };
    const nextSources = duplicateSource
      ? existingSources.map((source) => (source.id === duplicateSource.id ? nextSource : source))
      : [...existingSources, nextSource];
    const nextCard = {
      ...card,
      usageCount: Number(card.usageCount ?? 0) + (duplicateSource ? 0 : 1),
      updatedAt: now,
      lastUsedAt: now,
      liveStream: {
        sources: nextSources,
        activeSourceId: nextSource.id,
        updatedAt: now
      }
    };

    try {
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
      ui.workflow.liveStreamActiveSourceId = nextSource.id;
      ui.workflow.liveStreamResolvedUrl = resolvedUrl;
      setStatus(duplicateSource ? "已更新直播收藏。" : "已收藏直播间。", "success");
    } catch (error) {
      console.error("Failed to save live stream source", error);
      setStatus(`收藏直播间失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function markInfoRadarItemStatus(itemId, status) {
    const card = activeWorkflowCard.value;
    const radarWindow = activeInfoWindow.value;

    if (!desktopApi?.upsertWorkflowLibraryItem || !card || !radarWindow) {
      return;
    }

    try {
      const nextItems = (radarWindow.items ?? []).map((item) =>
        item.id === itemId ? { ...item, status } : item
      );
      const nextWindow = { ...radarWindow, items: nextItems, updatedAt: new Date().toISOString() };
      const nextCard = {
        ...card,
        updatedAt: nextWindow.updatedAt,
        infoWindows: (card.infoWindows ?? []).map((w) => (w.id === nextWindow.id ? nextWindow : w))
      };
      workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    } catch (error) {
      console.error("Failed to mark info radar item status", error);
      setStatus(`标记失败：${getErrorMessage(error)}`, "danger");
    }
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
    activeInfoWindow,
    activeInfoWindows,
    activeWorkflowApiKeyInputType,
    activeWorkflowBodyStepOptions,
    activeWorkflowEnvironment,
    activeWorkflowEnvironments,
    activeWorkflowMetrics,
    activeWorkflowRecord,
    activeWorkflowSteps,
    activeInfoReaderItem,
    activeFinanceBrief,
    activeFinanceChartAxis,
    activeFinanceChartBounds,
    activeFinanceChartRows,
    activeFinanceChartSummary,
    activeFinanceSnapshot,
    activeFinanceSymbol,
    activeFinanceSymbols,
    activeLiveStreamConfig,
    activeLiveStreamSource,
    activeLiveStreamSources,
    addInfoRadarSourceDraft,
    applyInfoRadarPreset,
    addWorkflowDraftEnvironment,
    addWorkflowDraftStep,
    addWorkflowStepOutput,
    backToWorkflowLibrary,
    cancelActiveWorkflowRun,
    deleteInfoRadarWindow,
    deleteWorkflowRecord,
    duplicateWorkflowRecord,
    filteredInfoRadarItems,
    filteredInfoRadarItemsByStatus,
    filteredWorkflowRecords,
    financeBriefSymbolOptions,
    formatFinanceBriefCompactNumber,
    formatFinanceBriefNumber,
    formatFinanceBriefPercent,
    formatFinanceBriefQuoteDateTime,
    formatFinanceBriefSignedNumber,
    formatDurationMs,
    getFinanceBriefChangeTone,
    getFinanceBriefIntervalLabel,
    getFinanceBriefRangeLabel,
    getFinanceBriefSymbolLabel,
    getInfoRadarCadenceLabel,
    canOpenInfoRadarItem,
    getInfoRadarItemHref,
    getInfoRadarItemSummaryText,
    getInfoRadarItemStatusLabel,
    getInfoRadarRunStatusLabel,
    getInfoRadarRunStatusTone,
    getInfoRadarScorePercent,
    getInfoRadarSourceKindLabel,
    getInfoRadarSourceTone,
    getLiveStreamInputPlaceholder,
    getLiveStreamPlatformLabel,
    getLiveStreamSourceLabel,
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
    handleInfoRadarReaderLoadingEnd,
    handleInfoRadarReaderLoadingStart,
    handleLiveStreamLoadingEnd,
    handleLiveStreamLoadingStart,
    handleWorkflowRunProgress,
    isWorkflowStepExpanded,
    infoRadarMetrics,
    infoRadarSourceFilterOptions,
    infoRadarTopicFilterOptions,
    liveStreamInputPlaceholder,
    liveStreamPlatformOptions,
    openInfoRadarWindow,
    openInfoRadarWindowEditor,
    openInfoRadarItemExternal,
    openInfoRadarItemReader,
    openLiveStreamExternal,
    openLiveStreamFromInput,
    openLiveStreamSource,
    openWorkflowCard,
    openWorkflowRecord,
    openWorkflowRecordEditor,
    persistActiveWorkflowRuntimeConfig,
    persistWorkflowBodyDraftToTemplate,
    removeWorkflowDraftEnvironment,
    removeWorkflowDraftStep,
    removeWorkflowStepOutput,
    removeInfoRadarSourceDraft,
    repairWorkflowBodyDraft,
    refreshActiveInfoRadarWindow,
    refreshLiveStreamView,
    queryActiveFinanceBrief,
    runActiveWorkflowRecord,
    saveInfoRadarWindow,
    saveLiveStreamInputAsSource,
    markInfoRadarItemStatus,
    saveWorkflowRecord,
    selectFinanceBriefSymbol,
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
