import { computed, reactive } from "vue";

import { PROVIDER_ORDER, getProviderMeta } from "../../lib/presenter.js";

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
  "",
  "    return {",
  "      planName: data.team || \"unknown\",",
  "      remaining: data.money || 0,",
  "      used: 1000 - data.money,",
  "      total: 1000,",
  "      unit: \"USD\",",
  "    };",
  "  },",
  "});"
].join("\n");

const MODEL_USAGE_DAILY_WINDOW_DAYS = 30;
const MODEL_USAGE_DAY_START_HOUR = 1;

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

  function formatBalanceNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : "--";
  }

  function formatOptionalBalanceNumber(value) {
    return value == null ? "--" : formatBalanceNumber(value);
  }

  function getModelUsageLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getModelUsageDayStart(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value);

    if (date.getHours() < MODEL_USAGE_DAY_START_HOUR) {
      date.setDate(date.getDate() - 1);
    }

    date.setHours(MODEL_USAGE_DAY_START_HOUR, 0, 0, 0);
    return date;
  }

  function formatModelUsageDayLabel(date) {
    return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
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

  function buildModelUsageDayWindows(dayCount) {
    const currentDayStart = getModelUsageDayStart(new Date());

    return Array.from({ length: dayCount }, (_item, index) => {
      const start = new Date(currentDayStart);
      start.setDate(currentDayStart.getDate() - (dayCount - index - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);

      return {
        dateKey: getModelUsageLocalDateKey(start),
        start,
        end,
        label: formatModelUsageDayLabel(start),
        shortLabel: String(start.getDate()).padStart(2, "0")
      };
    });
  }

  function toUsageSnapshotPoint(entry) {
    const queriedAt = new Date(entry?.snapshot?.queriedAt ?? entry?.recordedAt ?? "");
    const used = Number(entry?.snapshot?.used);
    const remaining = Number(entry?.snapshot?.remaining);
    const total = Number(entry?.snapshot?.total);

    if (Number.isNaN(queriedAt.getTime()) || !Number.isFinite(used)) {
      return null;
    }

    return {
      queriedAt,
      used,
      remaining: Number.isFinite(remaining) ? remaining : null,
      total: Number.isFinite(total) ? total : null,
      unit: String(entry?.snapshot?.unit ?? "USD").trim() || "USD"
    };
  }

  function buildModelUsageDailySeries(entries, dayCount = MODEL_USAGE_DAILY_WINDOW_DAYS) {
    const points = (Array.isArray(entries) ? entries : [])
      .map(toUsageSnapshotPoint)
      .filter(Boolean)
      .sort((left, right) => left.queriedAt.getTime() - right.queriedAt.getTime());

    return buildModelUsageDayWindows(dayCount).map((day) => {
      const pointsBeforeDay = points.filter((point) => point.queriedAt < day.start);
      const pointsInDay = points.filter((point) => point.queriedAt >= day.start && point.queriedAt < day.end);
      const baseline = pointsBeforeDay[pointsBeforeDay.length - 1] ?? null;
      let previousUsed = baseline?.used ?? pointsInDay[0]?.used ?? null;
      let used = 0;

      pointsInDay.forEach((point) => {
        if (previousUsed == null) {
          previousUsed = point.used;
          return;
        }

        const delta = point.used - previousUsed;

        if (delta >= 0) {
          used += delta;
        } else {
          used += Math.max(0, point.used);
        }

        previousUsed = point.used;
      });

      const latestPoint = pointsInDay[pointsInDay.length - 1] ?? baseline;

      return {
        ...day,
        used,
        remaining: latestPoint?.remaining ?? null,
        total: latestPoint?.total ?? null,
        unit: latestPoint?.unit ?? "USD",
        sampleCount: pointsInDay.length
      };
    });
  }

  function buildModelUsageSummary(days, entries) {
    const normalizedDays = Array.isArray(days) ? days : [];
    const normalizedEntries = Array.isArray(entries) ? entries : [];
    const totalUsed = normalizedDays.reduce((sum, day) => sum + Math.max(0, Number(day.used) || 0), 0);
    const maxUsed = normalizedDays.reduce((max, day) => Math.max(max, Number(day.used) || 0), 0);
    const latestEntry = normalizedEntries[normalizedEntries.length - 1] ?? null;
    const latestSnapshot = latestEntry?.snapshot ?? null;
    const unit = latestSnapshot?.unit ?? normalizedDays.find((day) => day.unit)?.unit ?? "USD";

    return {
      totalUsed,
      averageUsed: normalizedDays.length ? totalUsed / normalizedDays.length : 0,
      maxUsed,
      unit,
      sampleCount: normalizedEntries.length,
      latestUsageText: latestSnapshot
        ? `${formatBalanceNumber(latestSnapshot.used)} / ${formatBalanceNumber(latestSnapshot.remaining)}`
        : "-- / --"
    };
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
