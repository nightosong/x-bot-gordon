export type RuntimeSurface = "desktop" | "cli" | "api";
export type MemoryScope = "references" | "experience";
export type WorkModuleStatus = "planned" | "seeded" | "ready";
export type TaskStatus = "todo" | "doing" | "done";
export type ProviderKind =
  | "openai"
  | "azure"
  | "anthropic"
  | "google"
  | "doubao"
  | "qwen"
  | "deepseek"
  | "moonshot"
  | "zhipu"
  | "grok"
  | "openai_like";
export type WeeklyProgressStatus = "active" | "archived";
export type WeeklyProgressItemStatus = "planned" | "in_progress" | "completed" | "blocked";
export type WorkflowLibraryItemKind = "api-test";
export type WorkflowLibraryItemStatus = "active" | "draft";
export type WorkflowEnvironmentId = "dev" | "test" | "pre" | "prod" | string;
export type WorkflowVariableSource = "manual" | "response";
export type WorkflowProtocolMode = "single" | "sequential" | "polling";
export type WorkflowStepExecutionMode = "once" | "polling";
export type ModelModality =
  | "text"
  | "vision"
  | "audio"
  | "tts"
  | "embedding"
  | "image"
  | "video"
  | "music";
export type SkillKind = "prompt" | "workflow";
export type SkillSourceType = "manual" | "github";
export type SkillHandlerProtocolVersion = "gordon-skill/v1";
export type SkillHandlerOutputMode = "context" | "final";
export type AgentExecutionMode = "chat" | "task";
export type McpTransport = "stdio" | "http";
export type ToolConfigName = "image_gen" | "video_gen" | "music_gen";
export type ToolConfigProvider =
  | "openai"
  | "gemini"
  | "jimeng"
  | "seedance"
  | "pixverse"
  | "veo"
  | "sora"
  | "mureka"
  | "suno";
export type CommandWorkshopMessageRole = "user" | "assistant";
export type CommandWorkshopMessageState = "completed" | "error";
export type CommandWorkshopAttachmentKind = "image" | "video" | "text" | "document" | "spreadsheet" | "data" | "other";
export type CommandWorkshopAttachmentReadStatus = "readable" | "binary" | "unsupported" | "error";
export type WritingBookLength = "short" | "medium" | "long";
export type WritingBookPartType = "act" | "volume";
export type WritingChapterStatus = "todo" | "inProgress" | "done";
export type WritingOutlinePlannerStatus = "idle" | "running" | "completed" | "failed" | "cancelled";
export type AgentRunStepType =
  | "agent_selected"
  | "model_selected"
  | "skill_selected"
  | "skill_handler_started"
  | "skill_handler_completed"
  | "skill_handler_failed"
  | "skill_handler_skipped"
  | "mcp_authorized"
  | "mcp_auto_planning"
  | "mcp_args_repaired"
  | "mcp_fallback_planned"
  | "mcp_fallback_selected"
  | "workspace_permission_requested"
  | "workspace_permission_granted"
  | "workspace_permission_denied"
  | "computer_use_permission_requested"
  | "computer_use_permission_granted"
  | "computer_use_permission_denied"
  | "mcp_server_selected"
  | "mcp_tool_selected"
  | "mcp_tool_called"
  | "mcp_tool_failed"
  | "mcp_retrying"
  | "mcp_auto_stopped"
  | "model_invoked"
  | "completed";

export type McpErrorCategory = "retryable" | "non_retryable";
export type McpFailureKind =
  | "schema_mismatch"
  | "tool_unavailable"
  | "tool_execution"
  | "permission_denied"
  | "environment_state"
  | "wrong_tool"
  | "action_too_early"
  | "nonexistent_entity"
  | "unknown";
export type AgentTaskPhase = "understanding" | "planning" | "executing" | "verifying" | "recovering" | "finalizing";

export interface AgentTaskLedgerDecisionTraceEntry {
  step: string;
  intent: string;
  chosenAction: string;
  rejectedAlternatives: string[];
  why: string;
  expectedOutcome?: string;
}

export interface AgentTaskLedgerDecisionMemoryEntry {
  decision: string;
  reason: string;
  confidence: number;
  scope: "current_task" | "session" | "project";
  status: "active" | "superseded";
  evidenceRefs: string[];
}

export interface AgentTaskLedgerObservation {
  source: string;
  rawRef?: string;
  summary: string;
  durableFacts: string[];
  ephemeralFacts: string[];
  evidenceRefs: string[];
}

export interface AgentTaskLedgerEvidenceNode {
  id: string;
  kind: "fact" | "artifact" | "tool_result" | "file_ref" | "verification";
  claim: string;
  source: string;
  evidenceRefs: string[];
  confidence: number;
  durability: "durable" | "ephemeral";
  createdAt: string;
}

export interface AgentTaskLedgerSuccessCriterion {
  type:
    | "text_response"
    | "tool_result"
    | "file_contains"
    | "file_exists"
    | "url_opened"
    | "url_matches"
    | "command_passed"
    | "command_exit_zero"
    | "ui_state"
    | "ui_contains"
    | "artifact_created"
    | "artifact_exists"
    | "json_path_equals"
    | "custom";
  target?: string;
  expected: string;
  verificationMethod?: string;
  status: "pending" | "passed" | "failed" | "unknown";
}

export interface AgentTaskLedgerPlanStep {
  step: string;
  toolHint?: string;
  successCriteria?: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

export interface AgentTaskLedgerFailedAttempt {
  action: string;
  reason: string;
  category: string;
  recoveryHint?: string;
}

export interface AgentTaskLedger {
  taskPhase: AgentTaskPhase;
  objective: string;
  constraints: string[];
  completedSubtasks: string[];
  pendingSubtasks: string[];
  activePlan: AgentTaskLedgerPlanStep[];
  decisionTrace: AgentTaskLedgerDecisionTraceEntry[];
  decisionMemory: AgentTaskLedgerDecisionMemoryEntry[];
  observations: AgentTaskLedgerObservation[];
  evidenceGraph: AgentTaskLedgerEvidenceNode[];
  discoveredFacts: string[];
  failedAttempts: AgentTaskLedgerFailedAttempt[];
  environmentState: string[];
  userInterruptions: string[];
  successCriteria: string[];
  structuredSuccessCriteria: AgentTaskLedgerSuccessCriterion[];
  nextActionHint?: string;
}

export interface AgentIdentity {
  primaryName: string;
  nicknames: string[];
  mission: string;
  role: string;
}

export interface GrowthLoopStep {
  id: string;
  label: string;
  description: string;
}

export interface ProductBlueprint {
  identity: AgentIdentity;
  runtimeSurfaces: RuntimeSurface[];
  positioning: string;
  modalityTargets: ModelModality[];
  memoryStrategy: {
    references: string;
    experience: string;
  };
  growthLoop: GrowthLoopStep[];
  designPrinciples: string[];
  futureDirections: string[];
}

export interface ProviderConnector {
  id: string;
  label: string;
  kind: ProviderKind;
  integrationMode: "native" | "compatible";
  setupFields: string[];
  notes: string;
}

export interface WorkModule {
  id: string;
  label: string;
  value: string;
  status: WorkModuleStatus;
  surfaces: RuntimeSurface[];
  extensionPoints: string[];
}

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  title: string;
  summary: string;
  tags: string[];
  updatedAt: string;
}

export interface WorkTask {
  id: string;
  title: string;
  detail: string;
  status: TaskStatus;
  needsRewrite: boolean;
  dailyReportHint: string;
}

export interface WeeklyProgressTaskItem {
  id: string;
  title: string;
  detail: string;
  status: WeeklyProgressItemStatus;
  createdAt: string;
  updatedAt: string;
  children: WeeklyProgressTaskItem[];
}

export interface WeeklyProgressProjectItem {
  id: string;
  title: string;
  note: string;
  status: WeeklyProgressItemStatus;
  tasks: WeeklyProgressTaskItem[];
}

export interface WeeklyReportTemplateItem {
  id: string;
  name: string;
  content: string;
  builtin: boolean;
}

export interface WeeklyProgressRecord {
  id: string;
  weekKey: string;
  title: string;
  startDate: string;
  endDate: string;
  content: string;
  projects: WeeklyProgressProjectItem[];
  reportTemplates: WeeklyReportTemplateItem[];
  selectedReportTemplateId: string;
  reportTemplate: string;
  generatedDailyReport: string;
  generatedReport: string;
  generatedPerformanceReport: string;
  status: WeeklyProgressStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface WeeklyFeishuSettings {
  webhookUrl: string;
  secret: string;
  titlePrefix: string;
  updatedAt: string;
}

export interface WeeklyDailyReportFeishuSendRequest {
  title: string;
  weekTitle: string;
  content: string;
}

export interface WeeklyDailyReportFeishuSendResult {
  ok: boolean;
  sentAt: string;
  statusCode: number;
  responseMessage: string;
}

export interface DatabaseConnectionItem {
  id: string;
  label: string;
  driver: "mysql" | "postgres" | "sqlite" | "redis" | "other";
  host: string;
  port: number;
  database: string;
  username: string;
  secretRef: string;
  readOnly: boolean;
  tags: string[];
  notes: string;
}

export interface WorkflowVariableBinding {
  name: string;
  source: WorkflowVariableSource;
  placeholder: string;
  summary: string;
  required: boolean;
  sourceStepId?: string;
  path?: string;
}

export interface WorkflowRequestStep {
  id: string;
  name: string;
  summary: string;
  method: string;
  url: string;
  curl: string;
  waitBeforeMs: number;
  executionMode?: WorkflowStepExecutionMode;
  pollIntervalMs?: number;
  maxAttempts?: number;
  completionPath?: string;
  successValues?: string[];
  failureValues?: string[];
  responseFieldHints: string[];
  consumes: WorkflowVariableBinding[];
  produces: WorkflowVariableBinding[];
}

export interface WorkflowEnvironmentConfig {
  id: WorkflowEnvironmentId;
  label: string;
  baseUrl: string;
  apiKey?: string;
}

export interface WorkflowProtocolDefinition {
  mode: WorkflowProtocolMode;
  initialWaitMs: number;
  pollIntervalMs: number;
  maxAttempts: number;
  timeoutMs: number;
  statusStepId?: string;
  resultStepId?: string;
  completionPath?: string;
  successValues: string[];
  resultPath?: string;
  note: string;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  summary: string;
  scenario: string;
  tags: string[];
  updatedAt: string;
  notes?: string;
  activeEnvironmentId?: WorkflowEnvironmentId;
  environments?: WorkflowEnvironmentConfig[];
  apiKey?: string;
  sharedVariables: WorkflowVariableBinding[];
  steps: WorkflowRequestStep[];
  protocol: WorkflowProtocolDefinition;
}

export interface WorkflowLibraryItem {
  id: string;
  kind: WorkflowLibraryItemKind;
  title: string;
  summary: string;
  description: string;
  tags: string[];
  status: WorkflowLibraryItemStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  records: WorkflowRecord[];
}

export interface ModelProfile {
  id: string;
  provider: ProviderKind;
  displayName: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  location?: string;
  notes?: string;
  apiFormat?: "chat_completions" | "responses";
  supportsStreaming?: boolean;
  balanceQueryCode?: string;
  balanceSnapshot?: ModelBalanceSnapshot | null;
  updatedAt: string;
}

export interface ModelSettings {
  profiles: ModelProfile[];
  activeProfileId: string | null;
}

export interface ModelBalanceSnapshot {
  planName?: string;
  remaining: number;
  used: number;
  total?: number | null;
  unit: string;
  queriedAt: string;
}

export type ModelBalanceHistorySource = "manual" | "scheduled";

export interface ModelBalanceHistoryEntry {
  id: string;
  profileId: string;
  profileName: string;
  provider: ProviderKind;
  model: string;
  snapshot: ModelBalanceSnapshot;
  source: ModelBalanceHistorySource;
  recordedAt: string;
  updatedAt: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  kind: SkillKind;
  promptTemplate: string;
  handlerRef?: string;
  source?: SkillSource;
  enabled: boolean;
  updatedAt: string;
}

export interface SkillSource {
  type: SkillSourceType;
  repo?: string;
  ref?: string;
  path?: string;
  url?: string;
  localPath?: string;
  importedAt?: string;
}

export interface GithubSkillImportRequest {
  repo: string;
  ref?: string;
  path: string;
}

export interface SkillHandlerRequestPayload {
  protocolVersion: SkillHandlerProtocolVersion;
  requestId: string;
  userInput: string;
  conversationMessages: ModelMessage[];
  agent: {
    id: string;
    name: string;
    description: string;
    mode: AgentExecutionMode;
    systemPrompt: string;
  };
  skill: {
    id: string;
    name: string;
    description: string;
    kind: SkillKind;
    tags: string[];
    promptTemplate: string;
    handlerRef: string;
    source: SkillSource | null;
  };
  modelProfile: {
    id: string;
    displayName: string;
    model: string;
    provider: ProviderKind;
  };
  mcpResultText: string | null;
  mcpCalls: AgentMcpCallRecord[];
  timestamp: string;
}

export interface SkillHandlerResponse {
  protocolVersion?: SkillHandlerProtocolVersion | string;
  mode?: SkillHandlerOutputMode;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  transport: McpTransport;
  command?: string;
  url?: string;
  env: Record<string, string>;
  toolAllowlist: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface ToolProviderConfig {
  id: string;
  provider: ToolConfigProvider;
  label: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  notes?: string;
  runtime?: ToolProviderRuntimeConfig;
  updatedAt: string;
}

export interface ToolProviderRuntimeOperation {
  endpoint: string;
  parameters: string[];
}

export interface ToolProviderRuntimeConfig {
  operations: Record<string, ToolProviderRuntimeOperation>;
}

export interface ToolConfig {
  id: string;
  name: ToolConfigName;
  title: string;
  description: string;
  defaultProvider: ToolConfigProvider | null;
  providers: ToolProviderConfig[];
  enabled: boolean;
  updatedAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  mode: AgentExecutionMode;
  modelProfileId: string | null;
  systemPrompt: string;
  allowedSkillIds: string[];
  allowedMcpServerIds: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface AgentRunRequest {
  agentProfileId: string;
  userInput: string;
  conversationMessages?: ModelMessage[];
  taskLedger?: AgentTaskLedger | null;
  skillId?: string;
  autoSelectMcp?: boolean;
  mcpServerId?: string;
  mcpToolName?: string;
  mcpArguments?: Record<string, unknown>;
  progressEventId?: string;
}

export interface AgentRunStep {
  id: string;
  type: AgentRunStepType;
  title: string;
  detail: string;
  createdAt: string;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelTextRequest {
  requestId?: string;
  messages: ModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ModelTextResponse {
  text: string;
  model: string;
  profileId: string;
  profileLabel: string;
  provider: ProviderKind;
}

export interface ModelBalanceQueryRequest {
  profile: ModelProfile;
  persistResult?: boolean;
  historySource?: ModelBalanceHistorySource;
}

export interface AgentRunLog extends ModelTextResponse {
  id: string;
  agentProfileId: string;
  agentName: string;
  userInput: string;
  skillId: string | null;
  skillName: string | null;
  skillResultText?: string | null;
  skillFinalOutput?: boolean;
  autoSelectedMcp: boolean;
  mcpServerId: string | null;
  mcpServerName: string | null;
  mcpToolName: string | null;
  mcpArguments?: Record<string, unknown>;
  mcpResultText: string | null;
  mcpCalls?: AgentMcpCallRecord[];
  stopReason?: string;
  taskLedger?: AgentTaskLedger | null;
  steps: AgentRunStep[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunProgressEvent {
  progressEventId: string;
  phase: "running" | "completed" | "failed";
  statusText: string;
  text?: string;
  profileLabel: string | null;
  model: string | null;
  skillName: string | null;
  autoSelectedMcp: boolean;
  mcpServerName: string | null;
  mcpToolName: string | null;
  mcpResultText: string | null;
  mcpCalls: AgentMcpCallRecord[];
  stopReason?: string;
  taskLedger?: AgentTaskLedger | null;
  steps: AgentRunStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CommandWorkshopMessageArtifact {
  profileLabel: string;
  model: string;
  skillName: string | null;
  autoSelectedMcp: boolean;
  mcpServerName: string | null;
  mcpToolName: string | null;
  mcpResultText: string | null;
  mcpCalls: AgentMcpCallRecord[];
  stopReason?: string;
  taskLedger?: AgentTaskLedger | null;
  steps: AgentRunStep[];
  createdAt: string;
}

export interface CommandWorkshopAttachment {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  kind: CommandWorkshopAttachmentKind;
  readStatus: CommandWorkshopAttachmentReadStatus;
  extractedText?: string;
  errorMessage?: string;
}

export interface CommandWorkshopMessage {
  id: string;
  role: CommandWorkshopMessageRole;
  content: string;
  state?: CommandWorkshopMessageState;
  createdAt: string;
  attachments?: CommandWorkshopAttachment[];
  artifact?: CommandWorkshopMessageArtifact;
}

export interface CommandWorkshopSession {
  id: string;
  title: string;
  summary: string;
  agentProfileId: string | null;
  skillId: string | null;
  autoSelectMcp: boolean;
  mcpServerId: string | null;
  mcpToolName: string | null;
  mcpArgumentsText: string;
  messages: CommandWorkshopMessage[];
  createdAt: string;
  updatedAt: string;
}

export type CommandWorkshopMessageExportFormat = "pdf" | "docx";

export interface CommandWorkshopMessageExportRequest {
  fileName: string;
  format: CommandWorkshopMessageExportFormat;
  title: string;
  agentName: string;
  createdAt: string;
  contentText: string;
  contentHtml: string;
}

export interface CommandWorkshopMessageExportResult {
  filePath: string;
  fileName: string;
  format: CommandWorkshopMessageExportFormat;
  writtenBytes: number;
}

export interface WritingBookPart {
  id: string;
  type: WritingBookPartType;
  index: number;
  title: string;
  description: string;
}

export interface WritingBookIntroSection {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface WritingGenreProfile {
  primaryGenre: string;
  subGenres: string[];
  storyEngine: string;
  audience?: string;
  tone?: string;
  updatedAt: string;
}

export interface WritingEvidenceRef {
  id: string;
  chapterIndex?: number;
  chapterId?: string;
  quote?: string;
  note: string;
}

export interface WritingStoryAssetEntry {
  id: string;
  title: string;
  detail: string;
  tags: string[];
  chapterIndex?: number;
  status?: string;
  evidenceRefs: WritingEvidenceRef[];
  impact?: string;
  updatedAt: string;
}

export interface WritingCharacterAsset {
  id: string;
  name: string;
  role: string;
  goal: string;
  fear: string;
  secret: string;
  growthArc: string;
  relationships: string[];
  tags: string[];
  status: string;
  evidenceRefs: WritingEvidenceRef[];
  impact?: string;
  updatedAt: string;
}

export interface WritingForeshadowAsset {
  id: string;
  title: string;
  setup: string;
  payoff: string;
  status: string;
  chapterIndex?: number;
  payoffChapterIndex?: number;
  tags: string[];
  evidenceRefs: WritingEvidenceRef[];
  impact?: string;
  updatedAt: string;
}

export interface WritingCharacterArc {
  id: string;
  characterName: string;
  want: string;
  need: string;
  currentStage: string;
  nextPressure: string;
  endpoint: string;
  evidenceRefs: WritingEvidenceRef[];
  updatedAt: string;
}

export interface WritingStyleProfile {
  voice: string;
  pacing: string;
  genreSignals: string[];
  taboos: string[];
  proseDensity?: string;
  dialogueRatio?: string;
  narrationDistance?: string;
  emotionalTemperature?: string;
  humorLevel?: string;
  violenceExplicitness?: string;
  pacingCurve?: string[];
}

export interface WritingStoryAssets {
  premise: string;
  worldview: WritingStoryAssetEntry[];
  characters: WritingCharacterAsset[];
  relationships: WritingStoryAssetEntry[];
  timeline: WritingStoryAssetEntry[];
  foreshadows: WritingForeshadowAsset[];
  rules: WritingStoryAssetEntry[];
  characterArcs: WritingCharacterArc[];
  styleProfile: WritingStyleProfile;
  memoryNotes: WritingStoryAssetEntry[];
  updatedAt: string;
}

export type WritingNarrativeStateNodeKind =
  | "character"
  | "worldRule"
  | "resource"
  | "region"
  | "foreshadow"
  | "arc"
  | "timelineEvent"
  | "continuityWarning"
  | "planDrift";

export type WritingNarrativeRiskLevel = "low" | "medium" | "high";

export interface WritingNarrativeStateNode {
  id: string;
  kind: WritingNarrativeStateNodeKind;
  label: string;
  summary: string;
  status: string;
  introducedAtChapterIndex?: number;
  payoffDeadlineChapterIndex?: number;
  resolvedAtChapterIndex?: number;
  evidenceChapterIds: string[];
  evidenceRefs: WritingEvidenceRef[];
  impact?: string;
  relatedNodeIds: string[];
  riskLevel: WritingNarrativeRiskLevel;
  updatedAt: string;
}

export interface WritingNarrativeState {
  characters: WritingNarrativeStateNode[];
  worldRules: WritingNarrativeStateNode[];
  resources: WritingNarrativeStateNode[];
  regions: WritingNarrativeStateNode[];
  foreshadows: WritingNarrativeStateNode[];
  arcs: WritingNarrativeStateNode[];
  timelineEvents: WritingNarrativeStateNode[];
  continuityWarnings: WritingNarrativeStateNode[];
  planDriftNotes: WritingNarrativeStateNode[];
  updatedAt: string;
}

export interface WritingOutlinePlannerJob {
  id: string;
  status: WritingOutlinePlannerStatus;
  instruction: string;
  targetPartCount: number;
  partType: WritingBookPartType;
  minChaptersPerPart: number;
  maxChaptersPerPart: number;
  chaptersPerPart: number;
  batchSize: number;
  targetChapterCount: number;
  generatedChapterCount: number;
  currentPartIndex: number;
  currentBatchStartIndex: number;
  currentBatchEndIndex: number;
  lastCompletedChapterIndex?: number;
  retryAttempt?: number;
  maxRetryAttempts?: number;
  lastRetryAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface WritingChapter {
  id: string;
  index: number;
  partIndex?: number;
  title: string;
  summary: string;
  content: string;
  status: WritingChapterStatus;
  updatedAt: string;
  fileName?: string;
}

export interface WritingBook {
  id: string;
  title: string;
  author: string;
  length: WritingBookLength;
  genre: string;
  genreProfile: WritingGenreProfile;
  status: string;
  updatedAt: string;
  coverTone: string;
  coverUrl?: string;
  coverPrompt?: string;
  coverShouldShowTitle?: boolean;
  intro: string;
  outlineGuide: string;
  seriesPlan: string;
  extraIntroSections: WritingBookIntroSection[];
  parts: WritingBookPart[];
  storyAssets: WritingStoryAssets;
  narrativeState: WritingNarrativeState;
  outlinePlannerJob?: WritingOutlinePlannerJob;
  chapters: WritingChapter[];
  directoryName?: string;
}

export interface WritingBookSaveOptions {
  mergeChapters?: boolean;
}

export interface WritingBookCoverImageSaveRequest {
  title?: string;
  imageUrl: string;
}

export interface WritingBookCoverImageSaveResult {
  filePath: string;
  fileName: string;
  writtenBytes: number;
}

export type ComicProjectFormat = "poster" | "serial";
export type ComicProjectPalette = "monochrome" | "color";
export type ComicChapterStatus = "todo" | "inProgress" | "done";
export type ComicAssetType = "character" | "prop" | "scene";
export type ComicAssetViewKind = "turnaround" | "front" | "side" | "back" | "angle" | "wide" | "detail";

export interface ComicAssetView {
  id: string;
  kind: ComicAssetViewKind;
  label: string;
  src: string;
  prompt?: string;
}

export interface ComicAsset {
  id: string;
  name: string;
  type: ComicAssetType;
  description: string;
  prompt: string;
  views: ComicAssetView[];
  createdAt: string;
  updatedAt: string;
}

export interface ComicChapterImage {
  id: string;
  alt: string;
  src: string;
  prompt: string;
  size: string;
  quality: string;
  createdAt: string;
}

export interface ComicChapter {
  id: string;
  index: number;
  title: string;
  summary: string;
  prompt: string;
  content: string;
  images: ComicChapterImage[];
  status: ComicChapterStatus;
  assetRefs: string[];
  updatedAt: string;
}

export interface ComicProject {
  id: string;
  title: string;
  format: ComicProjectFormat;
  palette: ComicProjectPalette;
  genre: string;
  status: string;
  summary: string;
  visualStyle: string;
  episodePlan: string;
  pageCount: number;
  coverTone: string;
  assets: ComicAsset[];
  chapters: ComicChapter[];
  createdAt: string;
  updatedAt: string;
}

export type WritingBookExportFormat = "txt" | "md";

export interface WritingBookExportRequest {
  directoryPath: string;
  fileName: string;
  format: WritingBookExportFormat;
  content: string;
}

export interface WritingBookExportResult {
  filePath: string;
  fileName: string;
  format: WritingBookExportFormat;
  writtenBytes: number;
}

export type ComicProjectExportFormat = "md";

export interface ComicProjectExportRequest {
  directoryPath: string;
  fileName: string;
  format: ComicProjectExportFormat;
  content: string;
}

export interface ComicProjectExportResult {
  filePath: string;
  fileName: string;
  format: ComicProjectExportFormat;
  writtenBytes: number;
}

export type VideoProjectMode = "textToVideo" | "imageToVideo";
export type VideoProjectAspectRatio = "16:9" | "9:16" | "1:1";
export type VideoShotStatus = "todo" | "inProgress" | "done";

export interface VideoShot {
  id: string;
  index: number;
  title: string;
  summary: string;
  prompt: string;
  negativePrompt: string;
  reference: string;
  output: string;
  status: VideoShotStatus;
  durationSeconds: number;
  updatedAt: string;
}

export interface VideoProject {
  id: string;
  title: string;
  mode: VideoProjectMode;
  aspectRatio: VideoProjectAspectRatio;
  genre: string;
  status: string;
  summary: string;
  visualStyle: string;
  storyboardPlan: string;
  durationSeconds: number;
  coverTone: string;
  shots: VideoShot[];
  createdAt: string;
  updatedAt: string;
}

export type VideoProjectExportFormat = "md";

export interface VideoProjectExportRequest {
  directoryPath: string;
  fileName: string;
  format: VideoProjectExportFormat;
  content: string;
}

export interface VideoProjectExportResult {
  filePath: string;
  fileName: string;
  format: VideoProjectExportFormat;
  writtenBytes: number;
}

export type MusicTrackKind = "song" | "instrumental" | "jingle" | "soundtrack";
export type MusicTrackStatus = "draft" | "finished";
export type MusicTrackProvider = "mureka" | "suno" | "manual";

export interface MusicTrack {
  id: string;
  index: number;
  title: string;
  kind: MusicTrackKind;
  status: MusicTrackStatus;
  prompt: string;
  lyrics: string;
  style: string;
  negativePrompt: string;
  provider: MusicTrackProvider;
  model: string;
  taskId: string;
  audioUrl: string;
  streamUrl: string;
  coverUrl: string;
  durationSeconds: number;
  notes: string;
  rawResult?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MusicProject {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  status: string;
  summary: string;
  coverTone: string;
  tracks: MusicTrack[];
  createdAt: string;
  updatedAt: string;
}

export type MusicProjectExportFormat = "md";

export interface MusicProjectExportRequest {
  directoryPath: string;
  fileName: string;
  format: MusicProjectExportFormat;
  content: string;
}

export interface MusicProjectExportResult {
  filePath: string;
  fileName: string;
  format: MusicProjectExportFormat;
  writtenBytes: number;
}

export interface AgentMcpCallRecord {
  round: number;
  serverId: string;
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  resultText: string;
  structuredContent?: Record<string, unknown>;
  artifacts?: AgentGeneratedArtifact[];
  isError: boolean;
  autoSelected: boolean;
  attemptCount: number;
  recovered: boolean;
  errorCategory?: McpErrorCategory;
  failureKind?: McpFailureKind;
  failureReason?: string;
  expectedOutcome?: string;
  verificationMethod?: string;
  repairReason?: string;
  repairedFromArguments?: Record<string, unknown>;
  fallbackFromToolName?: string;
  fallbackFromServerName?: string;
  createdAt: string;
}

export interface AgentGeneratedArtifact {
  id: string;
  kind: "image" | "video" | "audio" | "file" | "text";
  title: string;
  mimeType?: string;
  url?: string;
  dataUrl?: string;
  provider?: string;
  model?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
}

export interface McpToolDefinition {
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolCallRequest {
  serverId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  workspaceAllowedRoots?: string[];
  computerUseAllowed?: boolean;
}

export interface McpToolCallResult {
  serverId: string;
  serverName: string;
  toolName: string;
  contentText: string;
  isError: boolean;
  structuredContent?: Record<string, unknown>;
}

export interface WeeklyProgressRewriteRequest {
  selectedText: string;
  fullContent: string;
  weekTitle: string;
  childTaskTitles?: string[];
}

export interface WeeklyReportGenerateRequest {
  weekTitle: string;
  content: string;
  reportTemplate: string;
}

export interface DailyReportGenerateRequest {
  dateTitle: string;
  weekTitle: string;
  content: string;
}

export interface PerformanceReportGenerateRequest {
  startDate: string;
  endDate: string;
  content: string;
  instruction?: string;
}

export interface WorkbenchSnapshot {
  blueprint: ProductBlueprint;
  providers: ProviderConnector[];
  modules: WorkModule[];
  memory: {
    references: MemoryEntry[];
    experience: MemoryEntry[];
  };
  tasks: WorkTask[];
  weeklyProgress: WeeklyProgressRecord[];
  databaseConnections: DatabaseConnectionItem[];
  workflowLibrary: WorkflowLibraryItem[];
  writingBooks: WritingBook[];
  comicProjects: ComicProject[];
  videoProjects: VideoProject[];
  musicProjects: MusicProject[];
  skillDefinitions: SkillDefinition[];
  mcpServers: McpServerConfig[];
  toolConfigs: ToolConfig[];
  agentProfiles: AgentProfile[];
  agentRunLogs: AgentRunLog[];
  commandWorkshopSessions: CommandWorkshopSession[];
}
