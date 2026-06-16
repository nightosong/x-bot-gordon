export const WORKFLOW_DEFAULT_ENVIRONMENTS = [
  { id: "dev", label: "DEV", baseUrl: "" },
  { id: "test", label: "TEST", baseUrl: "" },
  { id: "pre", label: "PRE", baseUrl: "" },
  { id: "prod", label: "PROD", baseUrl: "" }
];

export const WORKFLOW_CURL_BODY_OPTIONS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--json"]);

let fallbackIdSeed = 0;

function createFallbackLocalId(prefix) {
  fallbackIdSeed += 1;
  return `${prefix}_${Date.now()}_${fallbackIdSeed}`;
}

export function createWorkflowState(createLocalId = createFallbackLocalId) {
  return {
    view: "library",
    activeCardId: null,
    activeRecordId: null,
    activeInfoWindowId: null,
    activeInfoReaderItemId: null,
    copiedStepId: null,
    bodyStepId: null,
    bodyDraftText: "",
    bodyFeedbackText: "",
    bodyFeedbackTone: "neutral",
    bodyPanelCollapsed: false,
    apiKeyVisible: false,
    searchQuery: "",
    infoSearchQuery: "",
    infoSourceFilter: "",
    infoTopicFilter: "",
    infoRailCollapsed: false,
    editingRecordId: null,
    editingInfoWindowId: null,
    isRunning: false,
    isCancelling: false,
    isRefreshingInfoWindow: false,
    isInfoReaderLoading: false,
    infoReaderError: "",
    runResult: null,
    activeProgressEventId: null,
    expandedStepIds: [],
    isSavingRecord: false,
    isSavingInfoWindow: false,
    recordDraft: createWorkflowRecordDraft(createLocalId),
    infoWindowDraft: createInfoRadarWindowDraft(createLocalId)
  };
}

export function createDefaultWorkflowEnvironments(seedBaseUrl = "", seedApiKey = "") {
  return WORKFLOW_DEFAULT_ENVIRONMENTS.map((environment) => ({
    ...environment,
    baseUrl: environment.id === "prod" ? seedBaseUrl : "",
    apiKey: environment.id === "prod" ? seedApiKey : ""
  }));
}

export function createWorkflowOutputDraft(overrides = {}, createLocalId = createFallbackLocalId) {
  return {
    id: overrides.id ?? createLocalId("workflow_output_draft"),
    name: overrides.name ?? "",
    path: overrides.path ?? ""
  };
}

export function createWorkflowStepDraft(overrides = {}, createLocalId = createFallbackLocalId) {
  const successValues = Array.isArray(overrides.successValues) ? overrides.successValues : [];
  const failureValues = Array.isArray(overrides.failureValues) ? overrides.failureValues : [];

  return {
    id: overrides.id ?? createLocalId("workflow_step_draft"),
    name: overrides.name ?? "",
    curl: overrides.curl ?? "",
    waitBeforeMs: String(overrides.waitBeforeMs ?? 0),
    executionMode: overrides.executionMode ?? (overrides.completionPath ? "polling" : "once"),
    pollIntervalMs: String(overrides.pollIntervalMs ?? 5000),
    maxAttempts: String(overrides.maxAttempts ?? 20),
    completionPath: overrides.completionPath ?? "",
    successValuesText: successValues.join(", "),
    failureValuesText: failureValues.join(", "),
    produces: (Array.isArray(overrides.produces) ? overrides.produces : []).map((binding) =>
      createWorkflowOutputDraft(binding, createLocalId)
    )
  };
}

export function createWorkflowRecordDraft(createLocalId = createFallbackLocalId) {
  return {
    name: "",
    scenario: "",
    mode: "single",
    tagsText: "curl, API",
    pollIntervalMs: "3000",
    maxAttempts: "20",
    activeEnvironmentId: "prod",
    apiKey: "",
    environments: createDefaultWorkflowEnvironments(),
    steps: [createWorkflowStepDraft({}, createLocalId)],
    notes: ""
  };
}

export function createInfoRadarSourceDraft(overrides = {}, createLocalId = createFallbackLocalId) {
  return {
    id: overrides.id ?? createLocalId("info_source_draft"),
    kind: overrides.kind ?? "rss",
    title: overrides.title ?? "",
    url: overrides.url ?? "",
    query: overrides.query ?? "",
    enabled: overrides.enabled !== false,
    tagsText: Array.isArray(overrides.tags) ? overrides.tags.join("，") : overrides.tagsText ?? "",
    notes: overrides.notes ?? ""
  };
}

export function createInfoRadarWindowDraft(createLocalId = createFallbackLocalId, overrides = {}) {
  return {
    title: overrides.title ?? "",
    summary: overrides.summary ?? "",
    category: overrides.category ?? "技术",
    status: overrides.status ?? "active",
    cadence: overrides.cadence ?? "manual",
    keywordsText: Array.isArray(overrides.keywords) ? overrides.keywords.join("，") : overrides.keywordsText ?? "",
    negativeKeywordsText: Array.isArray(overrides.negativeKeywords)
      ? overrides.negativeKeywords.join("，")
      : overrides.negativeKeywordsText ?? "",
    digestPrompt: overrides.digestPrompt ?? "",
    sources: Array.isArray(overrides.sources)
      ? overrides.sources.map((source) => createInfoRadarSourceDraft(source, createLocalId))
      : [createInfoRadarSourceDraft({}, createLocalId)]
  };
}

export function createInfoRadarWindowDraftFromWindow(window, createLocalId = createFallbackLocalId) {
  return createInfoRadarWindowDraft(createLocalId, {
    title: window?.title ?? "",
    summary: window?.summary ?? "",
    category: window?.category ?? "综合",
    status: window?.status ?? "active",
    cadence: window?.cadence ?? "manual",
    keywords: window?.keywords ?? [],
    negativeKeywords: window?.negativeKeywords ?? [],
    digestPrompt: window?.digestPrompt ?? "",
    sources: window?.sources ?? []
  });
}
