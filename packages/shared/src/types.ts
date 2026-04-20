export type RuntimeSurface = "desktop" | "cli" | "api";
export type MemoryScope = "references" | "experience";
export type WorkModuleStatus = "planned" | "seeded" | "ready";
export type TaskStatus = "todo" | "doing" | "done";
export type ProviderKind = "openai" | "anthropic" | "google" | "openai_like";
export type WeeklyProgressStatus = "active" | "archived";
export type WeeklyProgressItemStatus = "planned" | "in_progress" | "completed" | "blocked";
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
export type CommandWorkshopMessageRole = "user" | "assistant";
export type CommandWorkshopMessageState = "completed" | "error";
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
  | "mcp_server_selected"
  | "mcp_tool_selected"
  | "mcp_tool_called"
  | "mcp_tool_failed"
  | "mcp_retrying"
  | "mcp_auto_stopped"
  | "model_invoked"
  | "completed";

export type McpErrorCategory = "retryable" | "non_retryable";
export type McpFailureKind = "schema_mismatch" | "tool_unavailable" | "tool_execution" | "unknown";

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
  generatedReport: string;
  status: WeeklyProgressStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
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
  updatedAt: string;
}

export interface ModelSettings {
  profiles: ModelProfile[];
  activeProfileId: string | null;
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
  skillId?: string;
  autoSelectMcp?: boolean;
  mcpServerId?: string;
  mcpToolName?: string;
  mcpArguments?: Record<string, unknown>;
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
  steps: AgentRunStep[];
  createdAt: string;
}

export interface CommandWorkshopMessage {
  id: string;
  role: CommandWorkshopMessageRole;
  content: string;
  state?: CommandWorkshopMessageState;
  createdAt: string;
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

export interface AgentMcpCallRecord {
  round: number;
  serverId: string;
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  resultText: string;
  isError: boolean;
  autoSelected: boolean;
  attemptCount: number;
  recovered: boolean;
  errorCategory?: McpErrorCategory;
  failureKind?: McpFailureKind;
  failureReason?: string;
  repairReason?: string;
  repairedFromArguments?: Record<string, unknown>;
  fallbackFromToolName?: string;
  fallbackFromServerName?: string;
  createdAt: string;
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
}

export interface WeeklyReportGenerateRequest {
  weekTitle: string;
  content: string;
  reportTemplate: string;
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
  skillDefinitions: SkillDefinition[];
  mcpServers: McpServerConfig[];
  agentProfiles: AgentProfile[];
  agentRunLogs: AgentRunLog[];
  commandWorkshopSessions: CommandWorkshopSession[];
}
