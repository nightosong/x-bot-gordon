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
    copiedStepId: null,
    bodyStepId: null,
    bodyDraftText: "",
    bodyFeedbackText: "",
    bodyFeedbackTone: "neutral",
    bodyPanelCollapsed: false,
    apiKeyVisible: false,
    searchQuery: "",
    editingRecordId: null,
    isRunning: false,
    isCancelling: false,
    runResult: null,
    activeProgressEventId: null,
    expandedStepIds: [],
    isSavingRecord: false,
    recordDraft: createWorkflowRecordDraft(createLocalId)
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
