import { computed, reactive } from "vue";

import { PROVIDER_ORDER, getProviderMeta } from "../../lib/presenter.js";
import {
  buildModelUsageDailySeries,
  buildModelUsageSummary,
  formatBalanceNumber,
  formatOptionalBalanceNumber
} from "./modelUsageStats.js";

const MODEL_BALANCE_QUERY_TEMPLATE = [
  "({",
  "  request: {",
  "    url: \"https://xxxxx\",",
  "    method: \"GET\",",
  "    headers: {",
  "      Authorization: \"Bearer {{apiKey}}\",",
  "      \"User-Agent\": \"cc-switch/1.0\",",
  "    },",
  "  },",
  "  extractor: function (raw) {",
  "    const response = typeof raw === \"string\" ? JSON.parse(raw) : raw || {};",
  "",
  "    const data = response.resp_data || {};",
  "    const remaining = Number(data.money ?? 0);",
  "    const total = Number(data.total ?? data.quota ?? data.limit ?? 1000);",
  "",
  "    return {",
  "      planName: data.team || \"unknown\",",
  "      remaining,",
  "      used: total - remaining,",
  "      total,",
  "      unit: \"USD\",",
  "    };",
  "  },",
  "});"
].join("\n");

const MODEL_USAGE_DAILY_WINDOW_DAYS = 30;

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error, fallback = "未知错误") {
  return error instanceof Error ? error.message : fallback;
}

export function createEmptyModelSettings() {
  return {
    profiles: [],
    activeProfileId: null
  };
}

export function createModelEditorState(provider = "openai", profile = null) {
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
      notes: profile?.notes ?? "",
      apiFormat: profile?.apiFormat === "responses" ? "responses" : "chat_completions",
      supportsStreaming: profile?.supportsStreaming !== false,
      balanceQueryCode: profile?.balanceQueryCode ?? ""
    },
    balanceQueryResult: profile?.balanceSnapshot ?? null,
    balanceQueryError: "",
    isBalanceQuerying: false,
    lastBalanceQueryCode: profile?.balanceQueryCode ?? "",
    apiKeyVisible: false,
    isSaving: false,
    saveState: "idle"
  };
}

export function createModelManagementState() {
  return {
    view: "list",
    editor: createModelEditorState("openai"),
    usageProfileId: ""
  };
}

export function getProviderFields(provider) {
  const commonFields = [
    { key: "displayName", label: "配置名称", placeholder: "例如：OpenAI 主账号", required: true, full: false },
    { key: "model", label: "模型名称", placeholder: "例如：gpt-4.1", required: true, full: false }
  ];
  const apiKeyField = { key: "apiKey", label: "API Key", placeholder: "sk-...", required: true, full: true };
  const openAiCompatibleProviders = new Set([
    "openai_like",
    "doubao",
    "qwen",
    "deepseek",
    "moonshot",
    "zhipu",
    "grok"
  ]);

  if (provider === "openai") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: true },
      apiKeyField,
      { key: "organization", label: "Organization", placeholder: "可选", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "google") {
    return [
      ...commonFields,
      apiKeyField,
      { key: "project", label: "Project", placeholder: "例如：gordon-prod", required: false, full: false },
      { key: "location", label: "Location", placeholder: "例如：us-central1", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "azure") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "Azure OpenAI / Azure AI 推理终端地址", required: true, full: true },
      apiKeyField,
      { key: "notes", label: "备注", placeholder: "可补充资源组、区域或部署说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "anthropic") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: true },
      apiKeyField,
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (openAiCompatibleProviders.has(provider)) {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "兼容 OpenAI 的服务地址", required: true, full: true },
      apiKeyField,
      { key: "notes", label: "备注", placeholder: "可补充厂商网关、环境或线路说明", required: false, full: true, textarea: true }
    ];
  }

  return [
    ...commonFields,
    { key: "baseUrl", label: "Base URL", placeholder: "自定义网关地址", required: true, full: true },
    apiKeyField,
    { key: "notes", label: "备注", placeholder: "例如：DeepSeek / Kimi / Qwen / Doubao", required: false, full: true, textarea: true }
  ];
}

function createModelBalanceRuntime() {
  return {
    loadingByProfileId: {},
    snapshotByProfileId: {},
    feedbackByProfileId: {},
    historyByProfileId: {},
    historyLoadingByProfileId: {},
    historyErrorByProfileId: {}
  };
}

export function createModelManagementActions({
  activeFeature,
  desktopApi,
  featureModelManagementId,
  nextTick,
  refreshWorkbenchSnapshot,
  setStatus,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
}) {
  const modelBalanceRuntime = reactive(createModelBalanceRuntime());

  const providerOptions = computed(() =>
    PROVIDER_ORDER.map((kind) => {
      const provider = workbench.snapshot?.providers?.find((entry) => entry.kind === kind);
      const meta = getProviderMeta(kind);

      return {
        kind,
        label: meta.label,
        short: meta.short,
        copy: provider?.notes ?? meta.copy,
        popularModels: meta.popularModels
      };
    })
  );

  const activeModel = computed(() =>
    workbench.modelSettings.profiles.find((profile) => profile.id === workbench.modelSettings.activeProfileId) ?? null
  );
  const activeModelUsageProfile = computed(() =>
    workbench.modelSettings.profiles.find((profile) => profile.id === ui.modelManagement.usageProfileId) ?? null
  );
  const modelUsageHistoryEntries = computed(() => getModelUsageHistoryEntries(activeModelUsageProfile.value));
  const modelUsageDailySeries = computed(() =>
    buildModelUsageDailySeries(modelUsageHistoryEntries.value, MODEL_USAGE_DAILY_WINDOW_DAYS)
  );
  const modelUsageDailyListSeries = computed(() => [...modelUsageDailySeries.value].reverse());
  const modelUsageSummary = computed(() => buildModelUsageSummary(modelUsageDailySeries.value, modelUsageHistoryEntries.value));
  const isActiveModelUsageLoading = computed(() =>
    Boolean(activeModelUsageProfile.value && modelBalanceRuntime.historyLoadingByProfileId[activeModelUsageProfile.value.id])
  );
  const activeModelUsageError = computed(() =>
    activeModelUsageProfile.value ? modelBalanceRuntime.historyErrorByProfileId[activeModelUsageProfile.value.id] ?? "" : ""
  );
  const modelEditorFields = computed(() => getProviderFields(ui.modelManagement.editor.provider));

  function hasModelBalanceQuery(profile) {
    return Boolean(String(profile?.balanceQueryCode ?? "").trim());
  }

  function getModelUsageHistoryEntries(profile) {
    if (!profile?.id) {
      return [];
    }

    const history = [...(modelBalanceRuntime.historyByProfileId[profile.id] ?? [])];
    const snapshot = getModelBalanceSnapshot(profile);

    if (snapshot?.queriedAt && !history.some((entry) => entry.snapshot?.queriedAt === snapshot.queriedAt)) {
      history.push({
        id: `runtime_${profile.id}_${snapshot.queriedAt}`,
        profileId: profile.id,
        profileName: profile.displayName,
        provider: profile.provider,
        model: profile.model,
        snapshot,
        source: "manual",
        recordedAt: snapshot.queriedAt,
        updatedAt: snapshot.queriedAt
      });
    }

    return history
      .filter((entry) => entry?.snapshot?.queriedAt)
      .sort((left, right) => Date.parse(left.snapshot.queriedAt) - Date.parse(right.snapshot.queriedAt));
  }

  function getModelUsageBarHeight(day) {
    const maxUsed = modelUsageSummary.value.maxUsed;

    if (!maxUsed || !day?.used) {
      return "0%";
    }

    return `${Math.max(7, Math.round((day.used / maxUsed) * 100))}%`;
  }

  function getModelBalanceSnapshot(profile) {
    return modelBalanceRuntime.snapshotByProfileId[profile?.id] ?? profile?.balanceSnapshot ?? null;
  }

  function getModelBalanceFeedback(profile) {
    return modelBalanceRuntime.feedbackByProfileId[profile?.id] ?? null;
  }

  function isModelBalanceRefreshing(profileId) {
    return Boolean(modelBalanceRuntime.loadingByProfileId[profileId]);
  }

  function setModelBalanceRefreshing(profileId, shouldRefresh) {
    modelBalanceRuntime.loadingByProfileId[profileId] = shouldRefresh;
  }

  function syncModelBalanceRuntimeFromProfiles(profiles = []) {
    const profileIds = new Set((Array.isArray(profiles) ? profiles : []).map((profile) => profile.id));

    Object.keys(modelBalanceRuntime.snapshotByProfileId).forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        delete modelBalanceRuntime.snapshotByProfileId[profileId];
      }
    });

    Object.keys(modelBalanceRuntime.loadingByProfileId).forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        delete modelBalanceRuntime.loadingByProfileId[profileId];
      }
    });

    Object.keys(modelBalanceRuntime.feedbackByProfileId).forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        delete modelBalanceRuntime.feedbackByProfileId[profileId];
      }
    });

    Object.keys(modelBalanceRuntime.historyByProfileId).forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        delete modelBalanceRuntime.historyByProfileId[profileId];
      }
    });

    Object.keys(modelBalanceRuntime.historyLoadingByProfileId).forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        delete modelBalanceRuntime.historyLoadingByProfileId[profileId];
      }
    });

    Object.keys(modelBalanceRuntime.historyErrorByProfileId).forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        delete modelBalanceRuntime.historyErrorByProfileId[profileId];
      }
    });

    (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
      modelBalanceRuntime.snapshotByProfileId[profile.id] = profile.balanceSnapshot ?? null;
    });
  }

  function setModelBalanceFeedback(profileId, text, tone = "neutral") {
    modelBalanceRuntime.feedbackByProfileId[profileId] = {
      text: String(text ?? "").trim(),
      tone
    };
  }

  function toPlainModelProfile(profile) {
    return {
      id: String(profile?.id ?? ""),
      provider: profile?.provider,
      displayName: String(profile?.displayName ?? ""),
      model: String(profile?.model ?? ""),
      apiKey: String(profile?.apiKey ?? ""),
      baseUrl: String(profile?.baseUrl ?? ""),
      organization: String(profile?.organization ?? ""),
      project: String(profile?.project ?? ""),
      location: String(profile?.location ?? ""),
      notes: String(profile?.notes ?? ""),
      apiFormat: profile?.apiFormat === "responses" ? "responses" : "chat_completions",
      supportsStreaming: profile?.supportsStreaming !== false,
      balanceQueryCode: String(profile?.balanceQueryCode ?? ""),
      updatedAt: String(profile?.updatedAt ?? "")
    };
  }

  function applyModelBalanceSnapshot(profileId, balanceSnapshot) {
    modelBalanceRuntime.snapshotByProfileId[profileId] = balanceSnapshot;
    workbench.modelSettings.profiles = workbench.modelSettings.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            balanceSnapshot
          }
        : profile
    );

    if (ui.modelManagement.editor.profileId === profileId) {
      ui.modelManagement.editor.balanceQueryResult = balanceSnapshot;
      ui.modelManagement.editor.balanceQueryError = "";
      ui.modelManagement.editor.lastBalanceQueryCode = ui.modelManagement.editor.values.balanceQueryCode.trim();
    }
  }

  function buildModelEditorPayload() {
    const balanceQueryCode = ui.modelManagement.editor.values.balanceQueryCode.trim();
    const shouldReuseBalanceSnapshot =
      balanceQueryCode && balanceQueryCode === String(ui.modelManagement.editor.lastBalanceQueryCode ?? "").trim();

    return {
      id: ui.modelManagement.editor.profileId ?? `model_${Date.now()}`,
      provider: ui.modelManagement.editor.provider,
      displayName: ui.modelManagement.editor.values.displayName.trim(),
      model: ui.modelManagement.editor.values.model.trim(),
      apiKey: ui.modelManagement.editor.values.apiKey.trim(),
      baseUrl: ui.modelManagement.editor.values.baseUrl.trim(),
      organization: ui.modelManagement.editor.values.organization.trim(),
      project: ui.modelManagement.editor.values.project.trim(),
      location: ui.modelManagement.editor.values.location.trim(),
      notes: ui.modelManagement.editor.values.notes.trim(),
      apiFormat: ui.modelManagement.editor.values.apiFormat === "responses" ? "responses" : "chat_completions",
      supportsStreaming: ui.modelManagement.editor.values.supportsStreaming !== false,
      balanceQueryCode,
      balanceSnapshot: shouldReuseBalanceSnapshot ? ui.modelManagement.editor.balanceQueryResult ?? null : null,
      updatedAt: new Date().toISOString()
    };
  }

  async function loadModelBalanceUsageHistory(profileId) {
    const normalizedProfileId = String(profileId ?? "").trim();

    if (!normalizedProfileId) {
      return;
    }

    if (!desktopApi?.listModelBalanceHistory) {
      modelBalanceRuntime.historyErrorByProfileId[normalizedProfileId] = "桌面桥接未就绪，暂时无法读取用量历史。";
      return;
    }

    modelBalanceRuntime.historyLoadingByProfileId[normalizedProfileId] = true;
    modelBalanceRuntime.historyErrorByProfileId[normalizedProfileId] = "";

    try {
      modelBalanceRuntime.historyByProfileId[normalizedProfileId] = await desktopApi.listModelBalanceHistory(normalizedProfileId);
    } catch (error) {
      console.error("Failed to load model balance usage history", error);
      modelBalanceRuntime.historyErrorByProfileId[normalizedProfileId] = getErrorMessage(error, "用量历史读取失败。");
    } finally {
      modelBalanceRuntime.historyLoadingByProfileId[normalizedProfileId] = false;
    }
  }

  async function openModelUsageStats(profile) {
    if (!profile?.id) {
      return;
    }

    writeRef(activeFeature, featureModelManagementId);
    ui.modelManagement.usageProfileId = profile.id;
    ui.modelManagement.view = "usage";
    await loadModelBalanceUsageHistory(profile.id);
  }

  function openModelCreatePicker() {
    writeRef(activeFeature, featureModelManagementId);
    ui.modelManagement.view = "picker";
    ui.modelManagement.editor = createModelEditorState("openai");
  }

  function selectModelProvider(provider) {
    ui.modelManagement.editor = createModelEditorState(provider);
    ui.modelManagement.view = "editor";
  }

  function openModelEditor(profile) {
    writeRef(activeFeature, featureModelManagementId);
    ui.modelManagement.editor = createModelEditorState(profile.provider, profile);
    ui.modelManagement.view = "editor";
  }

  function backModelManagement() {
    ui.modelManagement.view = "list";
    ui.modelManagement.editor = createModelEditorState("openai");
    ui.modelManagement.usageProfileId = "";
  }

  function markModelEditorDirty() {
    if (ui.modelManagement.editor.saveState === "saved") {
      ui.modelManagement.editor.saveState = "idle";
    }
  }

  function selectPopularModel(model) {
    ui.modelManagement.editor.values.model = model;
    markModelEditorDirty();
  }

  function fillModelBalanceQueryTemplate() {
    ui.modelManagement.editor.values.balanceQueryCode = MODEL_BALANCE_QUERY_TEMPLATE;
    ui.modelManagement.editor.balanceQueryError = "";
    ui.modelManagement.editor.balanceQueryResult = null;
    ui.modelManagement.editor.lastBalanceQueryCode = "";
    markModelEditorDirty();
  }

  async function handleModelEditorBalanceQuery() {
    if (!desktopApi?.queryModelBalance) {
      setStatus("桌面桥接未就绪，暂无法执行余额查询。", "danger");
      return;
    }

    const payload = buildModelEditorPayload();

    if (!payload.apiKey) {
      setStatus("请先填写 API Key，再执行余额查询。", "warning");
      return;
    }

    if (!payload.balanceQueryCode) {
      setStatus("请先填写余额查询提取器代码。", "warning");
      return;
    }

    ui.modelManagement.editor.isBalanceQuerying = true;
    ui.modelManagement.editor.balanceQueryError = "";

    try {
      const balanceSnapshot = await desktopApi.queryModelBalance(toPlainIpcData({
        profile: payload,
        persistResult: false
      }));
      ui.modelManagement.editor.balanceQueryResult = balanceSnapshot;
      ui.modelManagement.editor.lastBalanceQueryCode = payload.balanceQueryCode;
      setStatus("余额查询成功。", "success");
    } catch (error) {
      console.error("Failed to query model balance in editor", error);
      ui.modelManagement.editor.balanceQueryError = getErrorMessage(error);
      setStatus(`余额查询失败：${ui.modelManagement.editor.balanceQueryError}`, "danger");
    } finally {
      ui.modelManagement.editor.isBalanceQuerying = false;
    }
  }

  async function handleModelEditorSave() {
    if (ui.modelManagement.editor.isSaving) {
      return;
    }

    if (!desktopApi) {
      ui.modelManagement.editor.saveState = "idle";
      setStatus("桌面桥接未就绪，暂无法保存模型配置。", "danger");
      return;
    }

    const missingField = modelEditorFields.value.find(
      (field) => field.required && !String(ui.modelManagement.editor.values[field.key] ?? "").trim()
    );

    if (missingField) {
      ui.modelManagement.editor.saveState = "idle";
      setStatus(`请先填写 ${missingField.label}。`, "warning");
      return;
    }

    const payload = buildModelEditorPayload();

    try {
      ui.modelManagement.editor.isSaving = true;
      ui.modelManagement.editor.saveState = "saving";
      await desktopApi.upsertModelProfile(toPlainIpcData(payload));
      ui.modelManagement.editor.profileId = payload.id;
      ui.modelManagement.editor.mode = "edit";
      await refreshWorkbenchSnapshot();
      ui.modelManagement.editor.saveState = "saved";
      setStatus("模型配置已保存。", "success");
    } catch (error) {
      console.error("Failed to save model profile", error);
      ui.modelManagement.editor.saveState = "idle";
      setStatus(`模型配置保存失败：${getErrorMessage(error)}`, "danger");
    } finally {
      ui.modelManagement.editor.isSaving = false;
    }
  }

  async function handleModelBalanceRefresh(profile) {
    if (!desktopApi?.queryModelBalance) {
      setModelBalanceFeedback(profile?.id, "桥接未就绪，列表按钮未拿到查询能力。", "danger");
      setStatus("桌面桥接未就绪，暂无法执行余额查询。", "danger");
      return;
    }

    if (!hasModelBalanceQuery(profile)) {
      setModelBalanceFeedback(profile?.id, "当前模型没有配置余额查询代码。", "warning");
      setStatus("当前模型还没有配置余额查询提取器代码。", "warning");
      return;
    }

    const profilePayload = toPlainModelProfile(profile);
    setModelBalanceFeedback(profile.id, "已点击，准备发起余额查询...", "neutral");
    setStatus(`正在刷新 ${profile.displayName} 的余额...`, "neutral");
    setModelBalanceRefreshing(profile.id, true);
    await nextTick();

    try {
      setModelBalanceFeedback(profile.id, "请求已发出，等待接口返回...", "neutral");
      const balanceSnapshot = await desktopApi.queryModelBalance(toPlainIpcData({
        profile: profilePayload,
        persistResult: true,
        historySource: "manual"
      }));
      applyModelBalanceSnapshot(profile.id, balanceSnapshot);
      if (ui.modelManagement.view === "usage" && ui.modelManagement.usageProfileId === profile.id) {
        await loadModelBalanceUsageHistory(profile.id);
      }
      setModelBalanceFeedback(profile.id, "余额刷新成功。", "success");
      setStatus(`已刷新 ${profile.displayName} 的余额。`, "success");
    } catch (error) {
      console.error("Failed to refresh model balance", error);
      setModelBalanceFeedback(profile.id, getErrorMessage(error, "余额刷新失败。"), "danger");
      setStatus(`余额刷新失败：${getErrorMessage(error)}`, "danger");
    } finally {
      setModelBalanceRefreshing(profile.id, false);
    }

    try {
      await refreshWorkbenchSnapshot();
    } catch (error) {
      console.error("Failed to sync refreshed model balance snapshot", error);
    }
  }

  async function handleModelStatusToggle(profileId) {
    if (!desktopApi) {
      return;
    }

    try {
      workbench.modelSettings = await desktopApi.toggleModelProfileStatus(profileId);
      await refreshWorkbenchSnapshot();
      setStatus("模型状态已更新。", "success");
    } catch (error) {
      console.error("Failed to toggle model profile status", error);
      setStatus(`模型状态更新失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleModelDelete(profileId) {
    if (!desktopApi) {
      return;
    }

    const profile = workbench.modelSettings.profiles.find((item) => item.id === profileId);

    if (!profile) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除模型配置",
      message: `确认删除「${profile.displayName}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    try {
      workbench.modelSettings = await desktopApi.deleteModelProfile(profileId);
      await refreshWorkbenchSnapshot();
      setStatus("模型配置已删除。", "success");
    } catch (error) {
      console.error("Failed to delete model profile", error);
      setStatus(`模型配置删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleModelProfileReorder({ sourceProfileId, targetProfileId, placement = "before" }) {
    if (!desktopApi?.reorderModelProfiles) {
      setStatus("桌面桥接未就绪，暂无法保存模型顺序。", "danger");
      return;
    }

    const normalizedSourceProfileId = String(sourceProfileId ?? "").trim();
    const normalizedTargetProfileId = String(targetProfileId ?? "").trim();

    if (!normalizedSourceProfileId || !normalizedTargetProfileId || normalizedSourceProfileId === normalizedTargetProfileId) {
      return;
    }

    const currentProfiles = [...workbench.modelSettings.profiles];
    const sourceIndex = currentProfiles.findIndex((profile) => profile.id === normalizedSourceProfileId);
    const targetIndex = currentProfiles.findIndex((profile) => profile.id === normalizedTargetProfileId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextProfiles = [...currentProfiles];
    const [movingProfile] = nextProfiles.splice(sourceIndex, 1);
    const nextTargetIndex = nextProfiles.findIndex((profile) => profile.id === normalizedTargetProfileId);

    if (!movingProfile || nextTargetIndex < 0) {
      return;
    }

    const insertIndex = placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
    nextProfiles.splice(insertIndex, 0, movingProfile);

    const nextProfileIds = nextProfiles.map((profile) => profile.id);
    const currentProfileIds = currentProfiles.map((profile) => profile.id);

    if (nextProfileIds.every((profileId, index) => profileId === currentProfileIds[index])) {
      return;
    }

    workbench.modelSettings = {
      ...workbench.modelSettings,
      profiles: nextProfiles
    };

    try {
      workbench.modelSettings = await desktopApi.reorderModelProfiles(toPlainIpcData(nextProfileIds));
      await refreshWorkbenchSnapshot();
      setStatus("模型顺序已更新。", "success");
    } catch (error) {
      console.error("Failed to reorder model profiles", error);
      workbench.modelSettings = {
        ...workbench.modelSettings,
        profiles: currentProfiles
      };
      setStatus(`模型顺序保存失败：${getErrorMessage(error)}`, "danger");
    }
  }

  return {
    activeModel,
    activeModelUsageError,
    activeModelUsageProfile,
    backModelManagement,
    fillModelBalanceQueryTemplate,
    formatBalanceNumber,
    formatOptionalBalanceNumber,
    getModelBalanceFeedback,
    getModelBalanceSnapshot,
    getModelUsageBarHeight,
    handleModelBalanceRefresh,
    handleModelDelete,
    handleModelEditorBalanceQuery,
    handleModelEditorSave,
    handleModelProfileReorder,
    handleModelStatusToggle,
    hasModelBalanceQuery,
    isActiveModelUsageLoading,
    isModelBalanceRefreshing,
    markModelEditorDirty,
    modelEditorFields,
    modelUsageDailyListSeries,
    modelUsageDailySeries,
    modelUsageSummary,
    openModelCreatePicker,
    openModelEditor,
    openModelUsageStats,
    providerOptions,
    selectModelProvider,
    selectPopularModel,
    syncModelBalanceRuntimeFromProfiles
  };
}
