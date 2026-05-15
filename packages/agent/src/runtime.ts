import { randomUUID } from "node:crypto";
import path from "node:path";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

import { invokeModelText } from "../../providers/src/index.js";
import {
  appendAgentRunLog,
  listAgentProfiles,
  listMcpServers,
  listModelSettings,
  listSkillDefinitions
} from "../../workbench/src/index.js";
import type {
  AgentGeneratedArtifact,
  AgentMcpCallRecord,
  AgentProfile,
  AgentRunLog,
  AgentRunProgressEvent,
  AgentRunRequest,
  AgentRunStep,
  McpServerConfig,
  McpToolDefinition,
  ModelMessage,
  ModelProfile,
  SkillDefinition,
  SkillHandlerRequestPayload,
  SkillHandlerResponse
} from "../../shared/src/index.js";
import { callToolOnMcpServer, listToolsFromMcpServer } from "./mcp.js";

const MAX_AUTO_MCP_ROUNDS = 3;
const MAX_CONSECUTIVE_AUTO_MCP_FAILURES = 2;
const MAX_MCP_TOOL_ATTEMPTS = 3;
const MCP_RETRY_BASE_DELAY_MS = 400;
const MAX_MCP_ARGUMENT_REPAIRS = 1;
const MAX_MCP_DISPLAY_ARGUMENT_STRING_LENGTH = 320;
const MAX_MCP_DISPLAY_ARGUMENT_ARRAY_ITEMS = 12;
const MAX_MCP_DISPLAY_ARGUMENT_OBJECT_KEYS = 24;
const MAX_SKILL_HANDLER_DURATION_MS = 20_000;
const SKILL_HANDLER_PROTOCOL_VERSION = "gordon-skill/v1";
const MAX_CONVERSATION_CONTEXT_MESSAGES = 8;
const BUILTIN_WORKSPACE_MCP_ID = "builtin:mcp:workspace";
const BUILTIN_COMPUTER_USE_MCP_ID = "builtin:mcp:computer-use";
const BUILTIN_GORDON_TOOLS_MCP_ID = "builtin:mcp:gordon-tools";
const BUILTIN_APPLICATION_TOOLS_MCP_ID = "builtin:mcp:application-tools";
const WORKSPACE_PERMISSION_REQUIRED_PREFIX = "GORDON_PERMISSION_REQUIRED";
const COMPUTER_USE_PERMISSION_REQUIRED_PREFIX = "GORDON_COMPUTER_USE_PERMISSION_REQUIRED";
const BASE_URL_REQUIRED_PROVIDERS = new Set([
  "azure",
  "openai_like",
  "doubao",
  "qwen",
  "deepseek",
  "moonshot",
  "zhipu",
  "grok"
]);

interface SkillExecutionResult {
  mode: "context" | "final";
  content: string;
  handlerPath: string;
}

interface McpErrorClassification {
  category: AgentMcpCallRecord["errorCategory"];
  message: string;
  failureKind: AgentMcpCallRecord["failureKind"];
}

interface McpToolSelectionPlan {
  shouldCall: boolean;
  serverId: string | null;
  toolName: string | null;
  arguments: Record<string, unknown>;
  reason: string;
}

interface McpArgumentsRepairPlan {
  shouldRepair: boolean;
  arguments: Record<string, unknown>;
  reason: string;
}

interface McpFallbackPlan {
  shouldFallback: boolean;
  serverId: string | null;
  toolName: string | null;
  arguments: Record<string, unknown>;
  reason: string;
}

interface ExecuteMcpToolCallOptions {
  server: McpServerConfig;
  toolName: string;
  toolArguments?: Record<string, unknown>;
  toolDefinition?: McpToolDefinition;
  round: number;
  autoSelected: boolean;
  steps: AgentRunStep[];
  repairContext?: {
    modelProfile: ModelProfile;
    agent: AgentProfile;
    userInput: string;
    mcpCalls: AgentMcpCallRecord[];
  };
  fallbackFrom?: {
    serverName: string;
    toolName: string;
  };
  reportProgress?: () => void;
  workspacePermission?: WorkspacePermissionRuntime;
  computerUsePermission?: ComputerUsePermissionRuntime;
}

interface RunAgentOptions {
  onProgress?: (payload: AgentRunProgressEvent) => void;
  onWorkspacePermissionRequest?: (request: WorkspacePermissionRequest) => Promise<boolean>;
  onComputerUsePermissionRequest?: (request: ComputerUsePermissionRequest) => Promise<boolean>;
}

interface WorkspacePermissionRequest {
  path: string;
  suggestedRoot: string;
  workspaceRoot: string;
  serverName: string;
  toolName: string;
  reason: string;
}

interface WorkspacePermissionRuntime {
  allowedRoots: Set<string>;
  requestAccess?: (request: WorkspacePermissionRequest) => Promise<boolean>;
}

interface ComputerUsePermissionRequest {
  serverName: string;
  toolName: string;
  action: string;
  reason: string;
}

interface ComputerUsePermissionRuntime {
  granted: boolean;
  requestAccess?: (request: ComputerUsePermissionRequest) => Promise<boolean>;
}

function createRunStep(type: AgentRunStep["type"], title: string, detail: string): AgentRunStep {
  return {
    id: `step_${randomUUID()}`,
    type,
    title,
    detail,
    createdAt: new Date().toISOString()
  };
}

function ensureRunnableModelProfile(profile: ModelProfile | undefined): ModelProfile {
  if (!profile) {
    throw new Error("当前 Agent 绑定的模型不存在，请重新选择可用模型");
  }

  if (!profile.model.trim() || !profile.apiKey.trim()) {
    throw new Error("当前 Agent 绑定的模型配置不完整，请补全模型名称和 API Key");
  }

  if (BASE_URL_REQUIRED_PROVIDERS.has(profile.provider) && !profile.baseUrl?.trim()) {
    throw new Error(`当前 Agent 绑定的是 ${profile.displayName || profile.provider} 模型，但缺少 Base URL`);
  }

  return profile;
}

function resolveSkillForRun(agent: AgentProfile, skills: SkillDefinition[], skillId?: string): SkillDefinition | null {
  if (!skillId?.trim()) {
    return null;
  }

  if (!agent.allowedSkillIds.includes(skillId)) {
    throw new Error("当前 Skill 不在 Agent 的授权列表内");
  }

  const skill = skills.find((entry) => entry.id === skillId);

  if (!skill) {
    throw new Error("指定的 Skill 不存在，请重新选择");
  }

  if (!skill.enabled) {
    throw new Error("指定的 Skill 当前未启用");
  }

  return skill;
}

function resolveAuthorizedMcpServers(agent: AgentProfile, servers: McpServerConfig[]): McpServerConfig[] {
  return servers.filter((server) => agent.allowedMcpServerIds.includes(server.id) && server.enabled);
}

function isBuiltinWorkspaceToolsServer(server: McpServerConfig | null | undefined): boolean {
  return server?.id === BUILTIN_WORKSPACE_MCP_ID;
}

function isBuiltinComputerUseServer(server: McpServerConfig | null | undefined): boolean {
  return server?.id === BUILTIN_COMPUTER_USE_MCP_ID;
}

function isBuiltinGordonToolsServer(server: McpServerConfig | null | undefined): boolean {
  return server?.id === BUILTIN_GORDON_TOOLS_MCP_ID;
}

function isBuiltinApplicationToolsServer(server: McpServerConfig | null | undefined): boolean {
  return server?.id === BUILTIN_APPLICATION_TOOLS_MCP_ID;
}

function isBuiltinLocalToolsServer(server: McpServerConfig | null | undefined): boolean {
  return (
    isBuiltinWorkspaceToolsServer(server) ||
    isBuiltinComputerUseServer(server) ||
    isBuiltinGordonToolsServer(server) ||
    isBuiltinApplicationToolsServer(server)
  );
}

function describeToolServer(server: McpServerConfig): string {
  if (isBuiltinWorkspaceToolsServer(server)) {
    return `${server.name}（本地工作区工具）`;
  }

  if (isBuiltinComputerUseServer(server)) {
    return `${server.name}（本地桌面控制工具）`;
  }

  if (isBuiltinGordonToolsServer(server)) {
    return `${server.name}（本地能力工具）`;
  }

  if (isBuiltinApplicationToolsServer(server)) {
    return `${server.name}（本地应用资产工具）`;
  }

  return `${server.name}（外部 MCP）`;
}

function buildToolScopeText(authorizedServers: McpServerConfig[]): string {
  if (!authorizedServers.length) {
    return "当前未启用任何工具服务。本轮只能基于模型、会话上下文和已附加 Skill 回复，不要声称已经接入外部 MCP。";
  }

  const localTools = authorizedServers.filter((server) => isBuiltinLocalToolsServer(server));
  const externalMcpServers = authorizedServers.filter((server) => !isBuiltinLocalToolsServer(server));
  const sections = [];

  if (localTools.length) {
    sections.push(
      `本地工具：${localTools.map((server) => server.name).join("、")}。这是 Gordon 内置能力通道，不代表用户已连接外部 MCP。Application Tools 用于按应用语义读取、检索、预览和写回应用广场资产；Gordon Tools 会按能力拓展 TOOL 配置暴露 image_gen 等内置工具；Computer Use 会在首次读取或控制桌面前申请本轮授权。`
    );
  }

  if (externalMcpServers.length) {
    sections.push(`外部 MCP：${externalMcpServers.map((server) => server.name).join("、")}。仅在真实调用后才说明已调用 MCP。`);
  } else {
    sections.push("当前没有启用外部 MCP Server。");
  }

  sections.push("是否调用工具由任务需要决定；能直接回答时直接回答。");

  return sections.join("\n");
}

function resolveMcpSelection(
  agent: AgentProfile,
  authorizedServers: McpServerConfig[],
  request: AgentRunRequest
): McpServerConfig | null {
  if (!request.mcpServerId?.trim()) {
    return null;
  }

  if (!agent.allowedMcpServerIds.includes(request.mcpServerId)) {
    throw new Error("当前工具服务不在 Agent 的授权列表内");
  }

  const server = authorizedServers.find((entry) => entry.id === request.mcpServerId);

  if (!server) {
    throw new Error("指定的工具服务不存在或未启用");
  }

  return server;
}

function extractJsonBlock(text: string): string {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function normalizePlannerArguments(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeConversationMessages(messages: ModelMessage[] | undefined): ModelMessage[] {
  return (messages ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-MAX_CONVERSATION_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim()
    }));
}

function buildConversationContextText(messages: ModelMessage[]): string {
  if (!messages.length) {
    return "";
  }

  return messages
    .map((message) => `${message.role === "assistant" ? "助手" : "用户"}：\n${message.content}`)
    .join("\n\n");
}

function buildContextualUserInput(userInput: string, conversationMessages: ModelMessage[]): string {
  const contextText = buildConversationContextText(conversationMessages);

  if (!contextText) {
    return userInput;
  }

  return `以下是当前会话最近上下文，请先理解历史内容，再继续处理最新请求。

${contextText}

当前用户最新请求：
${userInput}`;
}

function normalizeSkillHandlerRef(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.startsWith("github:")) {
    return null;
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSkillHandlerPayload(stdout: string): { mode: "context" | "final"; content: string } {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error("Skill handler 没有输出任何内容");
  }

  try {
    const parsed = JSON.parse(extractJsonBlock(trimmed)) as SkillHandlerResponse | unknown;

    if (!isRecord(parsed)) {
      throw new Error("Skill handler JSON 输出不是对象");
    }

    if (
      "protocolVersion" in parsed &&
      typeof parsed.protocolVersion === "string" &&
      parsed.protocolVersion.trim() &&
      parsed.protocolVersion !== SKILL_HANDLER_PROTOCOL_VERSION
    ) {
      throw new Error(`Skill handler 协议版本不兼容：${parsed.protocolVersion}`);
    }

    const mode = parsed.mode === "final" ? "final" : "context";
    const contentCandidate =
      typeof parsed.content === "string"
        ? parsed.content
        : "result" in parsed && typeof parsed.result === "string"
          ? parsed.result
          : undefined;

    if (typeof contentCandidate === "string" && contentCandidate.trim()) {
      return {
        mode,
        content: contentCandidate.trim()
      };
    }
  } catch {
    return {
      mode: "context",
      content: trimmed
    };
  }

  return {
    mode: "context",
    content: trimmed
  };
}

function getSkillHandlerCommand(handlerPath: string): { command: string; args: string[] } {
  const extension = path.extname(handlerPath).toLowerCase();

  if (extension === ".py") {
    return {
      command: "python3",
      args: [handlerPath]
    };
  }

  if (extension === ".sh") {
    return {
      command: "/bin/sh",
      args: [handlerPath]
    };
  }

  return {
    command: process.execPath,
    args: [handlerPath]
  };
}

async function findExistingSkillHandlerPath(skill: SkillDefinition): Promise<string | null> {
  const localPath = skill.source?.localPath?.trim();

  if (!localPath) {
    return null;
  }

  const explicitHandlerRef = normalizeSkillHandlerRef(skill.handlerRef);
  const candidateRefs = [
    explicitHandlerRef,
    "scripts/run.py",
    "scripts/run.sh",
    "scripts/run.mjs",
    "scripts/run.js",
    "scripts/run.cjs",
    "run.py",
    "run.sh",
    "run.mjs",
    "run.js",
    "run.cjs",
    "handler.py",
    "handler.sh",
    "handler.mjs",
    "handler.js",
    "handler.cjs"
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidateRef of candidateRefs) {
    const resolvedPath = path.resolve(localPath, candidateRef);
    const relativePath = path.relative(localPath, resolvedPath);

    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      continue;
    }

    try {
      await access(resolvedPath);
      return resolvedPath;
    } catch {
      continue;
    }
  }

  return null;
}

async function executeSkillHandler(
  skill: SkillDefinition,
  agent: AgentProfile,
  modelProfile: ModelProfile,
  userInput: string,
  conversationMessages: ModelMessage[],
  mcpResultText: string | null,
  mcpCalls: AgentMcpCallRecord[],
  steps: AgentRunStep[],
  reportProgress?: () => void
): Promise<SkillExecutionResult | null> {
  if (skill.kind !== "workflow") {
    return null;
  }

  const handlerPath = await findExistingSkillHandlerPath(skill);

  if (!handlerPath) {
    steps.push(
      createRunStep(
        "skill_handler_skipped",
        "未执行 Skill Handler",
        `${skill.name} 未找到可执行 handler，回退为 prompt 模板模式`
      )
    );
    reportProgress?.();
    return null;
  }

  steps.push(
    createRunStep("skill_handler_started", "开始执行 Skill Handler", `${skill.name} / ${handlerPath}`)
  );
  reportProgress?.();

  const requestId = `skill_handler_${randomUUID()}`;
  const payload: SkillHandlerRequestPayload = {
    protocolVersion: SKILL_HANDLER_PROTOCOL_VERSION,
    requestId,
    userInput,
    conversationMessages,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      mode: agent.mode,
      systemPrompt: agent.systemPrompt
    },
    skill: {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      kind: skill.kind,
      tags: skill.tags,
      promptTemplate: skill.promptTemplate,
      handlerRef: skill.handlerRef ?? "",
      source: skill.source ?? null
    },
    modelProfile: {
      id: modelProfile.id,
      displayName: modelProfile.displayName,
      model: modelProfile.model,
      provider: modelProfile.provider
    },
    mcpResultText,
    mcpCalls,
    timestamp: new Date().toISOString()
  };

  const result = await new Promise<SkillExecutionResult>((resolve, reject) => {
    const handlerCommand = getSkillHandlerCommand(handlerPath);
    const skillRootPath = skill.source?.localPath?.trim() || path.dirname(handlerPath);
    const child = spawn(handlerCommand.command, handlerCommand.args, {
      cwd: skillRootPath,
      env: {
        ...process.env,
        GORDON_SKILL_PROTOCOL_VERSION: SKILL_HANDLER_PROTOCOL_VERSION,
        GORDON_SKILL_ROOT: skillRootPath,
        GORDON_SKILL_REQUEST_ID: requestId
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Skill handler 执行超时（>${MAX_SKILL_HANDLER_DURATION_MS}ms）`));
    }, MAX_SKILL_HANDLER_DURATION_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `Skill handler 退出码异常：${code ?? "unknown"}`));
        return;
      }

      try {
        const parsed = parseSkillHandlerPayload(stdout);
        resolve({
          ...parsed,
          handlerPath
        });
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });

  steps.push(
    createRunStep(
      "skill_handler_completed",
      "Skill Handler 执行完成",
      `${skill.name} / ${result.mode === "final" ? "直接产出最终结果" : "产出补充上下文"}`
    )
  );
  reportProgress?.();

  return result;
}

function stringifyArguments(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function isSensitiveArgumentKey(key: string): boolean {
  return /api[_-]?key|authorization|bearer|token|secret|password|credential|cookie/u.test(key.toLowerCase());
}

function sanitizeArgumentValueForDisplay(value: unknown, key = "", depth = 0): unknown {
  if (key && isSensitiveArgumentKey(key)) {
    return "[已脱敏]";
  }

  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (trimmedValue.startsWith("data:image/") || trimmedValue.startsWith("data:video/") || trimmedValue.startsWith("data:audio/")) {
      return `[媒体数据已省略，${value.length} 字符]`;
    }

    if (value.length > MAX_MCP_DISPLAY_ARGUMENT_STRING_LENGTH) {
      return `${value.slice(0, MAX_MCP_DISPLAY_ARGUMENT_STRING_LENGTH)}...（已截断 ${value.length - MAX_MCP_DISPLAY_ARGUMENT_STRING_LENGTH} 字符）`;
    }

    return value;
  }

  if (depth >= 4) {
    return "[层级过深，已省略]";
  }

  if (Array.isArray(value)) {
    const slicedItems = value
      .slice(0, MAX_MCP_DISPLAY_ARGUMENT_ARRAY_ITEMS)
      .map((item) => sanitizeArgumentValueForDisplay(item, key, depth + 1));

    if (value.length > MAX_MCP_DISPLAY_ARGUMENT_ARRAY_ITEMS) {
      slicedItems.push(`[已省略 ${value.length - MAX_MCP_DISPLAY_ARGUMENT_ARRAY_ITEMS} 项]`);
    }

    return slicedItems;
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);

    for (const [entryKey, entryValue] of entries.slice(0, MAX_MCP_DISPLAY_ARGUMENT_OBJECT_KEYS)) {
      output[entryKey] = sanitizeArgumentValueForDisplay(entryValue, entryKey, depth + 1);
    }

    if (entries.length > MAX_MCP_DISPLAY_ARGUMENT_OBJECT_KEYS) {
      output.__omitted = `[已省略 ${entries.length - MAX_MCP_DISPLAY_ARGUMENT_OBJECT_KEYS} 个字段]`;
    }

    return output;
  }

  return String(value);
}

function stringifyDisplayArguments(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(sanitizeArgumentValueForDisplay(value ?? {}));
}

function isSameArguments(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined
): boolean {
  return stringifyArguments(left) === stringifyArguments(right);
}

function getToolCallKey(serverId: string, toolName: string): string {
  return `${serverId}::${toolName}`;
}

function hasDuplicateToolCall(
  mcpCalls: AgentMcpCallRecord[],
  serverId: string,
  toolName: string,
  argumentsObject: Record<string, unknown> | undefined
): boolean {
  return mcpCalls.some(
    (call) =>
      call.serverId === serverId &&
      call.toolName === toolName &&
      isSameArguments(call.arguments, argumentsObject)
  );
}

function describeSchemaType(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).join(" | ");
  }

  return "unknown";
}

function buildToolSchemaSummary(tool: McpToolDefinition): string {
  if (!tool.inputSchema) {
    return "无显式 inputSchema";
  }

  const required =
    Array.isArray(tool.inputSchema.required) && tool.inputSchema.required.length
      ? tool.inputSchema.required.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  const properties =
    tool.inputSchema.properties &&
    typeof tool.inputSchema.properties === "object" &&
    !Array.isArray(tool.inputSchema.properties)
      ? (tool.inputSchema.properties as Record<string, unknown>)
      : {};

  const propertyLines = Object.entries(properties).map(([name, definition]) => {
    const schema = definition && typeof definition === "object" ? (definition as Record<string, unknown>) : {};
    const type = describeSchemaType(schema.type);
    const description = typeof schema.description === "string" ? schema.description.trim() : "";
    return `${name}: ${type}${description ? ` - ${description}` : ""}`;
  });

  return [
    required.length ? `required=${required.join(", ")}` : "required=none",
    propertyLines.length ? `properties=${propertyLines.join("; ")}` : "properties=none"
  ].join(" / ");
}

function buildPlannerToolPayload(candidateTools: McpToolDefinition[]): Array<Record<string, unknown>> {
  return candidateTools.map((tool) => ({
    serverId: tool.serverId,
    serverName: tool.serverName,
    name: tool.name,
    description: tool.description,
    schemaSummary: buildToolSchemaSummary(tool),
    inputSchema: tool.inputSchema ?? {}
  }));
}

function findCandidateTool(
  candidateTools: McpToolDefinition[],
  serverId: string | null,
  toolName: string | null
): McpToolDefinition | undefined {
  if (!serverId || !toolName) {
    return undefined;
  }

  return candidateTools.find((tool) => tool.serverId === serverId && tool.name === toolName);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function classifyMcpMessage(message: string): McpErrorClassification {
  const normalized = message.toLowerCase();

  const retryablePatterns = [
    "http 408",
    "http 409",
    "http 425",
    "http 429",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "timed out",
    "timeout",
    "temporarily unavailable",
    "network",
    "socket hang up",
    "econnreset",
    "econnrefused",
    "etimedout",
    "epipe",
    "empty",
    "engineoverloaded",
    "overloaded",
    "too many requests",
    "rate limit",
    "无法解析"
  ];

  const schemaMismatchPatterns = [
    "schema",
    "validation",
    "required",
    "missing required",
    "unexpected",
    "must be",
    "should be",
    "invalid type",
    "参数",
    "字段",
    "必填",
    "格式",
    "校验",
    "json"
  ];

  const toolUnavailablePatterns = [
    "白名单",
    "不存在",
    "未启用",
    "not found",
    "not enabled",
    "unknown tool",
    "method not found",
    "unsupported",
    "forbidden"
  ];

  const toolExecutionPatterns = [
    "invalid",
    "failed",
    "error",
    "执行失败",
    "exception",
    "denied",
    "permission"
  ];

  if (retryablePatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "retryable",
      message,
      failureKind: "unknown"
    };
  }

  if (schemaMismatchPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "schema_mismatch"
    };
  }

  if (toolUnavailablePatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "tool_unavailable"
    };
  }

  if (toolExecutionPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "tool_execution"
    };
  }

  return {
    category: "non_retryable",
    message,
    failureKind: "unknown"
  };
}

function classifyMcpError(error: unknown): McpErrorClassification {
  const message = error instanceof Error ? error.message : String(error);
  return classifyMcpMessage(message);
}

function parseWorkspacePermissionError(message: string): Omit<WorkspacePermissionRequest, "serverName" | "toolName" | "reason"> | null {
  const markerIndex = message.indexOf(WORKSPACE_PERMISSION_REQUIRED_PREFIX);

  if (markerIndex < 0) {
    return null;
  }

  const rawPayload = message.slice(markerIndex + WORKSPACE_PERMISSION_REQUIRED_PREFIX.length).trim();

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      path?: unknown;
      suggestedRoot?: unknown;
      workspaceRoot?: unknown;
    };
    const targetPath = typeof parsed.path === "string" ? parsed.path.trim() : "";
    const suggestedRoot = typeof parsed.suggestedRoot === "string" ? parsed.suggestedRoot.trim() : targetPath;
    const workspaceRoot = typeof parsed.workspaceRoot === "string" ? parsed.workspaceRoot.trim() : "";

    if (!targetPath || !suggestedRoot || !workspaceRoot) {
      return null;
    }

    return {
      path: targetPath,
      suggestedRoot,
      workspaceRoot
    };
  } catch {
    return null;
  }
}

function parseComputerUsePermissionError(message: string): Omit<ComputerUsePermissionRequest, "serverName"> | null {
  const markerIndex = message.indexOf(COMPUTER_USE_PERMISSION_REQUIRED_PREFIX);

  if (markerIndex < 0) {
    return null;
  }

  const rawPayload = message.slice(markerIndex + COMPUTER_USE_PERMISSION_REQUIRED_PREFIX.length).trim();

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      toolName?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    const toolName = typeof parsed.toolName === "string" && parsed.toolName.trim() ? parsed.toolName.trim() : "computer_use";
    const action = typeof parsed.action === "string" && parsed.action.trim() ? parsed.action.trim() : "读取或控制桌面";
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "需要读取或控制本机桌面，本次授权只对当前 Agent 运行生效。";

    return {
      toolName,
      action,
      reason
    };
  } catch {
    return null;
  }
}

async function collectCandidateMcpTools(servers: McpServerConfig[]): Promise<McpToolDefinition[]> {
  const toolGroups = await Promise.all(servers.map(async (server) => listToolsFromMcpServer(server.id)));
  return toolGroups.flat();
}

function buildMcpHistoryText(mcpCalls: AgentMcpCallRecord[]): string {
  if (!mcpCalls.length) {
    return "暂无历史工具调用。";
  }

  return mcpCalls
    .map(
      (call) => `第 ${call.round} 轮：
server=${call.serverName}
tool=${call.toolName}
arguments=${stringifyArguments(call.arguments)}
${call.repairedFromArguments ? `repairedFrom=${stringifyArguments(call.repairedFromArguments)}\n` : ""}${call.fallbackFromToolName ? `fallbackFrom=${call.fallbackFromServerName ?? call.serverName}/${call.fallbackFromToolName}\n` : ""}${call.failureKind ? `failureKind=${call.failureKind}\n` : ""}result=${call.resultText}`
    )
    .join("\n\n");
}

async function planMcpToolSelection(
  modelProfile: ModelProfile,
  agent: AgentProfile,
  userInput: string,
  candidateTools: McpToolDefinition[],
  mcpCalls: AgentMcpCallRecord[],
  iteration: number
): Promise<McpToolSelectionPlan> {
  if (!candidateTools.length) {
    return {
      shouldCall: false,
      serverId: null,
      toolName: null,
      arguments: {},
      reason: "未发现可用工具"
    };
  }

  const planningResponse = await invokeModelText(modelProfile, {
    temperature: 0,
    maxOutputTokens: 800,
    messages: [
      {
        role: "system",
        content: `你是 Gordon 的工具规划器。
你的唯一任务是判断当前是否需要调用工具，以及如果需要，应该调用哪一个工具。

请严格输出 JSON，不要输出解释、标题、Markdown 或代码块之外的任何文字。
JSON 结构必须为：
{
  "shouldCall": boolean,
  "serverId": string | null,
  "toolName": string | null,
  "arguments": object,
  "reason": string
}

约束：
- 只有当调用工具能明显提升结果质量时才调用
- serverId 和 toolName 必须来自提供给你的候选列表
- arguments 必须是一个 JSON 对象
- 如果不需要调用工具，shouldCall 设为 false，其余字段可设为 null 或 {}
- 不要编造不存在的 serverId 或 toolName`
      },
      {
        role: "user",
        content: `当前 Agent：
${agent.name}

用户任务：
${userInput}

当前规划轮次：
第 ${iteration} 轮

已有工具调用历史：
${buildMcpHistoryText(mcpCalls)}

可用工具列表：
${JSON.stringify(
  buildPlannerToolPayload(candidateTools),
  null,
  2
) }`
      }
    ]
  });

  const parsed = JSON.parse(extractJsonBlock(planningResponse.text)) as {
    shouldCall?: boolean;
    serverId?: unknown;
    toolName?: unknown;
    arguments?: unknown;
    reason?: unknown;
  };

  const shouldCall = Boolean(parsed.shouldCall);
  const serverId = typeof parsed.serverId === "string" && parsed.serverId.trim() ? parsed.serverId.trim() : null;
  const toolName = typeof parsed.toolName === "string" && parsed.toolName.trim() ? parsed.toolName.trim() : null;
  const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
  const argumentsObject = normalizePlannerArguments(parsed.arguments);

  if (!shouldCall) {
    return {
      shouldCall: false,
      serverId: null,
      toolName: null,
      arguments: {},
      reason: reason || "模型判断本轮不需要调用工具"
    };
  }

  const matchedTool = findCandidateTool(candidateTools, serverId, toolName);

  if (!matchedTool) {
    return {
      shouldCall: false,
      serverId: null,
      toolName: null,
      arguments: {},
      reason: "模型返回了无效工具规划，已降级为不调用工具"
    };
  }

  return {
    shouldCall: true,
    serverId,
    toolName,
    arguments: argumentsObject,
    reason: reason || "模型判断需要调用工具"
  };
}

async function repairMcpArgumentsWithSchema(
  modelProfile: ModelProfile,
  agent: AgentProfile,
  userInput: string,
  tool: McpToolDefinition,
  currentArguments: Record<string, unknown> | undefined,
  failureReason: string,
  mcpCalls: AgentMcpCallRecord[],
  round: number
): Promise<McpArgumentsRepairPlan> {
  if (!tool.inputSchema) {
    return {
      shouldRepair: false,
      arguments: currentArguments ?? {},
      reason: "当前工具未提供 inputSchema，跳过参数修复"
    };
  }

  const repairResponse = await invokeModelText(modelProfile, {
    temperature: 0,
    maxOutputTokens: 900,
    messages: [
      {
        role: "system",
        content: `你是 Gordon 的工具参数修复器。
你的任务是根据工具 inputSchema、用户任务和失败原因，修复一次工具参数。

请严格输出 JSON，不要输出解释、标题、Markdown 或 JSON 之外的任何文字。
JSON 结构必须为：
{
  "shouldRepair": boolean,
  "arguments": object,
  "reason": string
}

约束：
- arguments 必须是一个 JSON 对象
- 只能保留对当前工具 schema 合法且必要的字段
- 优先补齐 required 字段，删除明显不兼容字段
- 不要编造用户没有提供、历史结果也没有提供的关键事实
- 如果无法安全修复，shouldRepair 必须为 false`
      },
      {
        role: "user",
        content: `当前 Agent：
${agent.name}

当前轮次：
第 ${round} 轮

用户任务：
${userInput}

失败工具：
server=${tool.serverName}
tool=${tool.name}
description=${tool.description || "无"}

工具 schema 摘要：
${buildToolSchemaSummary(tool)}

工具完整 inputSchema：
${JSON.stringify(tool.inputSchema, null, 2)}

当前参数：
${stringifyArguments(currentArguments)}

失败原因：
${failureReason}

已有工具调用历史：
${buildMcpHistoryText(mcpCalls)}`
      }
    ]
  });

  const parsed = JSON.parse(extractJsonBlock(repairResponse.text)) as {
    shouldRepair?: boolean;
    arguments?: unknown;
    reason?: unknown;
  };

  return {
    shouldRepair: Boolean(parsed.shouldRepair),
    arguments: normalizePlannerArguments(parsed.arguments),
    reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "模型给出参数修复建议"
  };
}

function buildFallbackCandidateTools(
  candidateTools: McpToolDefinition[],
  failedCall: AgentMcpCallRecord,
  mcpCalls: AgentMcpCallRecord[]
): McpToolDefinition[] {
  const withoutCurrentTool = candidateTools.filter(
    (tool) => !(tool.serverId === failedCall.serverId && tool.name === failedCall.toolName)
  );

  if (!withoutCurrentTool.length) {
    return [];
  }

  const failedToolKeys = new Set(
    mcpCalls.filter((call) => call.isError).map((call) => getToolCallKey(call.serverId, call.toolName))
  );
  const unusedOrHealthyTools = withoutCurrentTool.filter(
    (tool) => !failedToolKeys.has(getToolCallKey(tool.serverId, tool.name))
  );

  return unusedOrHealthyTools.length ? unusedOrHealthyTools : withoutCurrentTool;
}

function normalizeGeneratedArtifact(value: unknown, index = 0): AgentGeneratedArtifact | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const artifact = value as Record<string, unknown>;
  const kind = typeof artifact.kind === "string" && artifact.kind.trim() ? artifact.kind.trim() : "file";

  if (!["image", "video", "audio", "file", "text"].includes(kind)) {
    return null;
  }

  const url = typeof artifact.url === "string" && artifact.url.trim() ? artifact.url.trim() : "";
  const dataUrl = typeof artifact.dataUrl === "string" && artifact.dataUrl.trim() ? artifact.dataUrl.trim() : "";

  if (!url && !dataUrl && kind !== "text") {
    return null;
  }

  return {
    id: typeof artifact.id === "string" && artifact.id.trim() ? artifact.id.trim() : `artifact_${index + 1}`,
    kind: kind as AgentGeneratedArtifact["kind"],
    title:
      typeof artifact.title === "string" && artifact.title.trim()
        ? artifact.title.trim()
        : `${kind} ${index + 1}`,
    ...(typeof artifact.mimeType === "string" && artifact.mimeType.trim() ? { mimeType: artifact.mimeType.trim() } : {}),
    ...(url ? { url } : {}),
    ...(dataUrl ? { dataUrl } : {}),
    ...(typeof artifact.provider === "string" && artifact.provider.trim() ? { provider: artifact.provider.trim() } : {}),
    ...(typeof artifact.model === "string" && artifact.model.trim() ? { model: artifact.model.trim() } : {}),
    ...(typeof artifact.prompt === "string" && artifact.prompt.trim() ? { prompt: artifact.prompt.trim() } : {}),
    ...(artifact.metadata && typeof artifact.metadata === "object" && !Array.isArray(artifact.metadata)
      ? { metadata: artifact.metadata as Record<string, unknown> }
      : {})
  };
}

function extractGeneratedArtifacts(structuredContent: Record<string, unknown> | undefined): AgentGeneratedArtifact[] {
  const rawArtifacts = Array.isArray(structuredContent?.artifacts) ? structuredContent.artifacts : [];
  return rawArtifacts
    .map((artifact, index) => normalizeGeneratedArtifact(artifact, index))
    .filter((artifact): artifact is AgentGeneratedArtifact => Boolean(artifact));
}

async function planFallbackMcpToolSelection(
  modelProfile: ModelProfile,
  agent: AgentProfile,
  userInput: string,
  candidateTools: McpToolDefinition[],
  mcpCalls: AgentMcpCallRecord[],
  failedCall: AgentMcpCallRecord,
  round: number
): Promise<McpFallbackPlan> {
  if (!candidateTools.length) {
    return {
      shouldFallback: false,
      serverId: null,
      toolName: null,
      arguments: {},
      reason: "没有可用的 fallback tool 候选"
    };
  }

  const planningResponse = await invokeModelText(modelProfile, {
    temperature: 0,
    maxOutputTokens: 900,
    messages: [
      {
        role: "system",
        content: `你是 Gordon 的工具 fallback 规划器。
当前工具调用失败后，你需要判断是否应该切换到其他工具继续完成任务。

请严格输出 JSON，不要输出解释、标题、Markdown 或代码块之外的任何文字。
JSON 结构必须为：
{
  "shouldFallback": boolean,
  "serverId": string | null,
  "toolName": string | null,
  "arguments": object,
  "reason": string
}

约束：
- 只能从提供的 fallback 候选中选择
- 不要继续选择刚失败的同一个 tool
- 优先选择 schema 更贴合当前任务、且能绕开失败原因的工具
- 如果没有更好的替代方案，shouldFallback 必须为 false`
      },
      {
        role: "user",
        content: `当前 Agent：
${agent.name}

当前轮次：
第 ${round} 轮

用户任务：
${userInput}

刚失败的工具调用：
server=${failedCall.serverName}
tool=${failedCall.toolName}
arguments=${stringifyArguments(failedCall.arguments)}
failureKind=${failedCall.failureKind ?? "unknown"}
failureReason=${failedCall.failureReason ?? failedCall.resultText}

已有工具调用历史：
${buildMcpHistoryText(mcpCalls)}

可用 fallback 工具列表：
${JSON.stringify(buildPlannerToolPayload(candidateTools), null, 2)}`
      }
    ]
  });

  const parsed = JSON.parse(extractJsonBlock(planningResponse.text)) as {
    shouldFallback?: boolean;
    serverId?: unknown;
    toolName?: unknown;
    arguments?: unknown;
    reason?: unknown;
  };
  const shouldFallback = Boolean(parsed.shouldFallback);
  const serverId = typeof parsed.serverId === "string" && parsed.serverId.trim() ? parsed.serverId.trim() : null;
  const toolName = typeof parsed.toolName === "string" && parsed.toolName.trim() ? parsed.toolName.trim() : null;
  const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "";
  const argumentsObject = normalizePlannerArguments(parsed.arguments);
  const matchedTool = findCandidateTool(candidateTools, serverId, toolName);

  if (!shouldFallback || !matchedTool) {
    return {
      shouldFallback: false,
      serverId: null,
      toolName: null,
      arguments: {},
      reason: reason || "模型判断当前不适合切换 fallback tool"
    };
  }

  return {
    shouldFallback: true,
    serverId,
    toolName,
    arguments: argumentsObject,
    reason: reason || "模型已规划 fallback tool"
  };
}

function buildSystemPrompt(agent: AgentProfile, skill: SkillDefinition | null, authorizedMcpServers: McpServerConfig[]): string {
  const sections = [
    `你是 Gordon 中的一个 harness Agent。\nAgent 名称：${agent.name}\n执行模式：${agent.mode}`,
    agent.systemPrompt.trim()
  ];

  if (skill) {
    sections.push(
      `当前指定 Skill：${skill.name}\nSkill 说明：${skill.description || "无"}\nSkill 模板：\n${skill.promptTemplate.trim()}`
    );
  }

  sections.push(`工具上下文：\n${buildToolScopeText(authorizedMcpServers)}`);

  sections.push("输出只返回最终结果，不要解释内部推理过程；不要把内置本地工具描述成用户已经接入外部 MCP。");

  return sections.filter(Boolean).join("\n\n");
}

function buildUserMessages(
  userInput: string,
  skill: SkillDefinition | null,
  skillExecutionText?: string | null
): ModelMessage[] {
  if (!skill) {
    return [
      {
        role: "user",
        content: userInput
      }
    ];
  }

  return [
    {
      role: "user",
      content: `请结合以下 Skill 模板执行任务。

任务输入：
${userInput}

${skillExecutionText ? `以下是 Skill Handler 产出的补充上下文，请优先吸收其中的有效信息：\n${skillExecutionText}\n\n` : ""}
请严格参考这个 Skill 的模板和约束完成输出。`
    }
  ];
}

function buildCombinedMcpResultText(mcpCalls: AgentMcpCallRecord[]): string | null {
  if (!mcpCalls.length) {
    return null;
  }

  return mcpCalls
    .map(
      (call) => `第 ${call.round} 轮工具结果
服务：${call.serverName}
工具：${call.toolName}
参数：${stringifyArguments(call.arguments)}
${call.repairedFromArguments ? `修复前参数：${stringifyArguments(call.repairedFromArguments)}\n` : ""}${call.fallbackFromToolName ? `fallback 来源：${call.fallbackFromServerName ?? call.serverName} / ${call.fallbackFromToolName}\n` : ""}${call.failureKind ? `失败分类：${call.failureKind}\n` : ""}结果：
${call.resultText}`
    )
    .join("\n\n");
}

async function executeMcpToolCall(options: ExecuteMcpToolCallOptions): Promise<AgentMcpCallRecord> {
  const {
    server,
    toolName,
    toolArguments,
    toolDefinition,
    round,
    autoSelected,
    steps,
    repairContext,
    fallbackFrom,
    reportProgress,
    workspacePermission,
    computerUsePermission
  } = options;

  let currentArguments = toolArguments ?? {};

  steps.push(
    createRunStep("mcp_server_selected", `已选择工具服务（第 ${round} 轮）`, describeToolServer(server)),
    createRunStep(
      "mcp_tool_selected",
      `已选择工具（第 ${round} 轮）`,
      `${toolName} / 参数：${stringifyDisplayArguments(currentArguments)}`
    )
  );
  reportProgress?.();

  let lastErrorMessage = "";
  let lastErrorCategory: AgentMcpCallRecord["errorCategory"] = "non_retryable";
  let lastFailureKind: AgentMcpCallRecord["failureKind"] = "unknown";
  let repairCount = 0;
  let repairedFromArguments: Record<string, unknown> | undefined;
  let repairReason: string | undefined;

  const buildToolCallRequest = (): Parameters<typeof callToolOnMcpServer>[0] => ({
    serverId: server.id,
    toolName,
    arguments: currentArguments,
    ...(workspacePermission?.allowedRoots.size
      ? { workspaceAllowedRoots: Array.from(workspacePermission.allowedRoots) }
      : {}),
    ...(computerUsePermission?.granted ? { computerUseAllowed: true } : {})
  });

  const requestWorkspacePermissionIfNeeded = async (
    message: string
  ): Promise<{ matched: boolean; granted: boolean; message: string }> => {
    const permissionPayload = parseWorkspacePermissionError(message);

    if (!permissionPayload) {
      return {
        matched: false,
        granted: false,
        message
      };
    }

    if (workspacePermission?.allowedRoots.has(permissionPayload.suggestedRoot)) {
      return {
        matched: true,
        granted: true,
        message: ""
      };
    }

    if (!workspacePermission?.requestAccess) {
      return {
        matched: true,
        granted: false,
        message: `需要授权访问外部路径：${permissionPayload.path}`
      };
    }

    steps.push(
      createRunStep(
        "workspace_permission_requested",
        "请求外部路径访问权限",
        `${permissionPayload.path} / ${server.name} / ${toolName}`
      )
    );
    reportProgress?.();

    const granted = await workspacePermission.requestAccess({
      ...permissionPayload,
      serverName: server.name,
      toolName,
      reason: `${server.name} / ${toolName} 需要访问外部路径 ${permissionPayload.path}`
    });

    if (granted) {
      workspacePermission.allowedRoots.add(permissionPayload.suggestedRoot);
      steps.push(
        createRunStep(
          "workspace_permission_granted",
          "外部路径访问已授权",
          `${permissionPayload.suggestedRoot} / 将重试当前工具调用`
        )
      );
      reportProgress?.();
      return {
        matched: true,
        granted: true,
        message: ""
      };
    }

    const deniedMessage = `用户拒绝授权访问外部路径：${permissionPayload.path}`;
    steps.push(createRunStep("workspace_permission_denied", "外部路径访问被拒绝", deniedMessage));
    reportProgress?.();

    return {
      matched: true,
      granted: false,
      message: deniedMessage
    };
  };

  const requestComputerUsePermissionIfNeeded = async (
    message: string
  ): Promise<{ matched: boolean; granted: boolean; message: string }> => {
    const permissionPayload = parseComputerUsePermissionError(message);

    if (!permissionPayload) {
      return {
        matched: false,
        granted: false,
        message
      };
    }

    if (computerUsePermission?.granted) {
      return {
        matched: true,
        granted: true,
        message: ""
      };
    }

    if (!computerUsePermission?.requestAccess) {
      return {
        matched: true,
        granted: false,
        message: "需要授权使用 Computer Use 读取或控制桌面"
      };
    }

    steps.push(
      createRunStep(
        "computer_use_permission_requested",
        "请求 Computer Use 授权",
        `${server.name} / ${permissionPayload.toolName || toolName} / ${permissionPayload.action}`
      )
    );
    reportProgress?.();

    const granted = await computerUsePermission.requestAccess({
      ...permissionPayload,
      serverName: server.name,
      toolName: permissionPayload.toolName || toolName
    });

    if (granted) {
      computerUsePermission.granted = true;
      steps.push(
        createRunStep(
          "computer_use_permission_granted",
          "Computer Use 已授权",
          `${server.name} / 将重试当前工具调用`
        )
      );
      reportProgress?.();
      return {
        matched: true,
        granted: true,
        message: ""
      };
    }

    const deniedMessage = "用户拒绝授权使用 Computer Use";
    steps.push(createRunStep("computer_use_permission_denied", "Computer Use 授权被拒绝", deniedMessage));
    reportProgress?.();

    return {
      matched: true,
      granted: false,
      message: deniedMessage
    };
  };

  const requestToolPermissionIfNeeded = async (
    message: string
  ): Promise<{ matched: boolean; granted: boolean; message: string }> => {
    const workspaceDecision = await requestWorkspacePermissionIfNeeded(message);

    if (workspaceDecision.matched) {
      return workspaceDecision;
    }

    return requestComputerUsePermissionIfNeeded(message);
  };

  const tryRepairArguments = async (failureReason: string): Promise<boolean> => {
    if (!repairContext || !toolDefinition?.inputSchema || repairCount >= MAX_MCP_ARGUMENT_REPAIRS) {
      return false;
    }

    try {
      const repaired = await repairMcpArgumentsWithSchema(
        repairContext.modelProfile,
        repairContext.agent,
        repairContext.userInput,
        toolDefinition,
        currentArguments,
        failureReason,
        [...repairContext.mcpCalls],
        round
      );

      if (!repaired.shouldRepair || isSameArguments(currentArguments, repaired.arguments)) {
        return false;
      }

      repairedFromArguments = currentArguments;
      currentArguments = repaired.arguments;
      repairReason = repaired.reason;
      repairCount += 1;
      steps.push(
        createRunStep(
          "mcp_args_repaired",
          `工具参数已修复（第 ${round} 轮）`,
          `${toolName} / ${repaired.reason} / 新参数：${stringifyDisplayArguments(currentArguments)}`
        )
      );
      reportProgress?.();
      return true;
    } catch {
      return false;
    }
  };

  for (let attempt = 1; attempt <= MAX_MCP_TOOL_ATTEMPTS; attempt += 1) {
    try {
      const toolResult = await callToolOnMcpServer(buildToolCallRequest());
      const generatedArtifacts = extractGeneratedArtifacts(toolResult.structuredContent);

      if (toolResult.isError) {
        const classified = classifyMcpMessage(toolResult.contentText || "工具返回错误标记");
        const permissionDecision = await requestToolPermissionIfNeeded(classified.message);

        if (permissionDecision.granted) {
          continue;
        }

        lastErrorMessage = permissionDecision.matched ? permissionDecision.message : classified.message;
        lastErrorCategory = classified.category;
        lastFailureKind = classified.failureKind;
        const failureMessage = permissionDecision.matched ? permissionDecision.message : classified.message;

        const repaired = await tryRepairArguments(failureMessage);

        if (repaired) {
          continue;
        }

        steps.push(
          createRunStep(
            "mcp_tool_failed",
            `工具返回错误（第 ${round} 轮）`,
            `${toolName} / ${failureMessage} / 第 ${attempt} 次尝试`
          )
        );
        reportProgress?.();

        return {
          round,
          serverId: server.id,
          serverName: server.name,
          toolName,
          arguments: currentArguments,
          resultText: permissionDecision.matched ? `工具调用失败：${failureMessage}` : toolResult.contentText,
          ...(toolResult.structuredContent ? { structuredContent: toolResult.structuredContent } : {}),
          ...(generatedArtifacts.length ? { artifacts: generatedArtifacts } : {}),
          isError: true,
          autoSelected,
          attemptCount: attempt,
          recovered: attempt > 1 || repairCount > 0,
          errorCategory: classified.category,
          failureKind: classified.failureKind,
          failureReason: failureMessage,
          ...(repairReason ? { repairReason } : {}),
          ...(repairedFromArguments ? { repairedFromArguments } : {}),
          ...(fallbackFrom
            ? {
                fallbackFromToolName: fallbackFrom.toolName,
                fallbackFromServerName: fallbackFrom.serverName
              }
            : {}),
          createdAt: new Date().toISOString()
        };
      }

      steps.push(
        createRunStep(
          "mcp_tool_called",
          `工具调用完成（第 ${round} 轮）`,
          `${toolResult.toolName} / 第 ${attempt} 次尝试`
        )
      );
      reportProgress?.();

      return {
        round,
        serverId: server.id,
        serverName: server.name,
        toolName,
        arguments: currentArguments,
        resultText: toolResult.contentText,
        ...(toolResult.structuredContent ? { structuredContent: toolResult.structuredContent } : {}),
        ...(generatedArtifacts.length ? { artifacts: generatedArtifacts } : {}),
        isError: false,
        autoSelected,
        attemptCount: attempt,
        recovered: attempt > 1 || repairCount > 0,
        ...(repairReason ? { repairReason } : {}),
        ...(repairedFromArguments ? { repairedFromArguments } : {}),
        ...(fallbackFrom
          ? {
              fallbackFromToolName: fallbackFrom.toolName,
              fallbackFromServerName: fallbackFrom.serverName
            }
          : {}),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      const classified = classifyMcpError(error);
      const permissionDecision = await requestToolPermissionIfNeeded(classified.message);

      if (permissionDecision.granted) {
        continue;
      }

      lastErrorMessage = permissionDecision.matched ? permissionDecision.message : classified.message;
      lastErrorCategory = classified.category;
      lastFailureKind = classified.failureKind;
      const failureMessage = permissionDecision.matched ? permissionDecision.message : classified.message;

      const canRetry = classified.category === "retryable" && attempt < MAX_MCP_TOOL_ATTEMPTS;

      if (canRetry) {
        const delayMs = MCP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        steps.push(
          createRunStep(
            "mcp_retrying",
            `工具准备重试（第 ${round} 轮）`,
            `${toolName} / 第 ${attempt} 次失败：${failureMessage} / ${delayMs}ms 后重试`
          )
        );
        reportProgress?.();
        await sleep(delayMs);
        continue;
      }

      const repaired = await tryRepairArguments(failureMessage);

      if (repaired) {
        continue;
      }

      steps.push(
        createRunStep(
          "mcp_tool_failed",
          `工具调用失败（第 ${round} 轮）`,
          `${toolName} / ${failureMessage} / 已尝试 ${attempt} 次`
        )
      );
      reportProgress?.();

      return {
        round,
        serverId: server.id,
        serverName: server.name,
        toolName,
        arguments: currentArguments,
        resultText: `工具调用失败：${failureMessage}`,
        isError: true,
        autoSelected,
        attemptCount: attempt,
        recovered: repairCount > 0,
        errorCategory: classified.category,
        failureKind: classified.failureKind,
        failureReason: failureMessage,
        ...(repairReason ? { repairReason } : {}),
        ...(repairedFromArguments ? { repairedFromArguments } : {}),
        ...(fallbackFrom
          ? {
              fallbackFromToolName: fallbackFrom.toolName,
              fallbackFromServerName: fallbackFrom.serverName
            }
          : {}),
        createdAt: new Date().toISOString()
      };
    }
  }

  return {
    round,
    serverId: server.id,
    serverName: server.name,
    toolName,
    arguments: currentArguments,
    resultText: `工具调用失败：${lastErrorMessage || "未知错误"}`,
    isError: true,
    autoSelected,
    attemptCount: MAX_MCP_TOOL_ATTEMPTS,
    recovered: repairCount > 0,
    errorCategory: lastErrorCategory,
    failureKind: lastFailureKind,
    failureReason: lastErrorMessage || "未知错误",
    ...(repairReason ? { repairReason } : {}),
    ...(repairedFromArguments ? { repairedFromArguments } : {}),
    ...(fallbackFrom
      ? {
          fallbackFromToolName: fallbackFrom.toolName,
          fallbackFromServerName: fallbackFrom.serverName
        }
      : {}),
    createdAt: new Date().toISOString()
  };
}

function sanitizeForIpc<T>(value: T): T {
  const visited = new WeakSet<object>();

  function normalize(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return input;
    }

    if (typeof input === "bigint") {
      return input.toString();
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (input instanceof Error) {
      return {
        name: input.name,
        message: input.message,
        stack: input.stack ?? ""
      };
    }

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    if (typeof input !== "object") {
      return String(input);
    }

    if (visited.has(input)) {
      return "[Circular]";
    }

    visited.add(input);

    const output: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(input)) {
      output[key] = normalize(entryValue);
    }

    return output;
  }

  return normalize(value) as T;
}

export async function runAgent(request: AgentRunRequest, options: RunAgentOptions = {}): Promise<AgentRunLog> {
  const userInput = request.userInput.trim();

  if (!userInput) {
    throw new Error("请先输入需要 Agent 处理的内容");
  }

  const conversationMessages = normalizeConversationMessages(request.conversationMessages);
  const contextualUserInput = buildContextualUserInput(userInput, conversationMessages);

  const [agentProfiles, skillDefinitions, mcpServers, modelSettings] = await Promise.all([
    listAgentProfiles(),
    listSkillDefinitions(),
    listMcpServers(),
    listModelSettings()
  ]);

  const agent = agentProfiles.find((entry) => entry.id === request.agentProfileId);

  if (!agent) {
    throw new Error("当前 Agent 不存在，请刷新后重试");
  }

  if (!agent.enabled) {
    throw new Error("当前 Agent 尚未启用，请先启用后再运行");
  }

  if (!agent.modelProfileId) {
    throw new Error("当前 Agent 还没有绑定模型，请先在能力拓展页里配置模型");
  }

  const modelProfile = ensureRunnableModelProfile(
    modelSettings.profiles.find((profile) => profile.id === agent.modelProfileId)
  );
  const selectedSkill = resolveSkillForRun(agent, skillDefinitions, request.skillId);
  const authorizedMcpServers = resolveAuthorizedMcpServers(agent, mcpServers);
  let selectedMcpServer = resolveMcpSelection(agent, authorizedMcpServers, request);
  const mcpCalls: AgentMcpCallRecord[] = [];
  let actualMcpToolName: string | null = request.mcpToolName?.trim() || null;
  let actualMcpArguments: Record<string, unknown> | undefined = request.mcpArguments;
  let autoSelectedMcp = false;
  let stopReason: string | null = null;
  const steps: AgentRunStep[] = [];
  const progressCreatedAt = new Date().toISOString();
  const workspacePermission: WorkspacePermissionRuntime = {
    allowedRoots: new Set<string>(),
    requestAccess: options.onWorkspacePermissionRequest
  };
  const computerUsePermission: ComputerUsePermissionRuntime = {
    granted: false,
    requestAccess: options.onComputerUsePermissionRequest
  };

  const emitProgress = (overrides: Partial<AgentRunProgressEvent> = {}): void => {
    if (!request.progressEventId || !options.onProgress) {
      return;
    }

    const latestStep = steps[steps.length - 1];
    const defaultStatusText =
      stopReason?.trim() ||
      latestStep?.detail?.trim() ||
      latestStep?.title?.trim() ||
      "正在执行中";

    options.onProgress(
      sanitizeForIpc({
        progressEventId: request.progressEventId,
        phase: overrides.phase ?? "running",
        statusText: overrides.statusText ?? defaultStatusText,
        ...(overrides.text ? { text: overrides.text } : {}),
        profileLabel: overrides.profileLabel ?? modelProfile.displayName ?? null,
        model: overrides.model ?? modelProfile.model ?? null,
        skillName: overrides.skillName ?? selectedSkill?.name ?? null,
        autoSelectedMcp: overrides.autoSelectedMcp ?? autoSelectedMcp,
        mcpServerName: overrides.mcpServerName ?? selectedMcpServer?.name ?? null,
        mcpToolName: overrides.mcpToolName ?? actualMcpToolName,
        mcpResultText: overrides.mcpResultText ?? buildCombinedMcpResultText(mcpCalls),
        mcpCalls: overrides.mcpCalls ?? [...mcpCalls],
        ...(overrides.stopReason ?? stopReason ? { stopReason: overrides.stopReason ?? stopReason ?? "" } : {}),
        steps: overrides.steps ?? [...steps],
        createdAt: overrides.createdAt ?? progressCreatedAt,
        updatedAt: overrides.updatedAt ?? new Date().toISOString()
      }) as AgentRunProgressEvent
    );
  };

  const pushStep = (type: AgentRunStep["type"], title: string, detail: string): AgentRunStep => {
    const step = createRunStep(type, title, detail);
    steps.push(step);
    emitProgress();
    return step;
  };

  pushStep("agent_selected", "已加载 Agent", `${agent.name} / ${agent.mode}`);
  pushStep("model_selected", "已绑定模型", `${modelProfile.displayName} / ${modelProfile.model}`);

  if (selectedSkill) {
    pushStep("skill_selected", "已附加 Skill", selectedSkill.name);
  }

  if (authorizedMcpServers.length) {
    const externalMcpServers = authorizedMcpServers.filter((server) => !isBuiltinLocalToolsServer(server));
    pushStep(
      "mcp_authorized",
      externalMcpServers.length ? "已加载工具上下文" : "已加载本地工具",
      buildToolScopeText(authorizedMcpServers)
    );
  }

  if (selectedMcpServer && actualMcpToolName) {
    const toolName = actualMcpToolName?.trim();

    if (!toolName) {
      throw new Error("已选择工具服务，但还没有指定工具名称");
    }

    let selectedToolDefinition: McpToolDefinition | undefined;

    try {
      selectedToolDefinition = findCandidateTool(await collectCandidateMcpTools([selectedMcpServer]), selectedMcpServer.id, toolName);
    } catch {
      selectedToolDefinition = undefined;
    }

    mcpCalls.push(
      await executeMcpToolCall({
        server: selectedMcpServer,
        toolName,
        toolArguments: actualMcpArguments,
        toolDefinition: selectedToolDefinition,
        round: 1,
        autoSelected: false,
        steps,
        reportProgress: () => emitProgress(),
        repairContext: {
          modelProfile,
          agent,
          userInput: contextualUserInput,
          mcpCalls
        },
        workspacePermission,
        computerUsePermission
      })
    );
    actualMcpToolName = mcpCalls[mcpCalls.length - 1]?.toolName ?? toolName;
    actualMcpArguments = mcpCalls[mcpCalls.length - 1]?.arguments;
    if (mcpCalls[mcpCalls.length - 1]?.isError) {
      stopReason = "手动指定的工具调用失败，已停止继续编排";
    }
    emitProgress();
  }

  if (!actualMcpToolName && request.autoSelectMcp && authorizedMcpServers.length) {
    const candidateServers = selectedMcpServer ? [selectedMcpServer] : authorizedMcpServers;
    let candidateTools: McpToolDefinition[] = [];
    try {
      candidateTools = await collectCandidateMcpTools(candidateServers);
    } catch (error) {
      stopReason = `工具发现失败：${error instanceof Error ? error.message : "未知错误"}`;
      pushStep("mcp_auto_stopped", "工具编排停止", stopReason);
    }
    let consecutiveFailures = 0;

    for (let round = 1; round <= MAX_AUTO_MCP_ROUNDS && candidateTools.length; round += 1) {
      pushStep(
        "mcp_auto_planning",
        `正在规划工具（第 ${round} 轮）`,
        `从 ${candidateServers.length} 个工具服务的可用工具中自动选择`
      );

      let plannedSelection;

      try {
        plannedSelection = await planMcpToolSelection(
          modelProfile,
          agent,
          contextualUserInput,
          candidateTools,
          mcpCalls,
          round
        );
      } catch (error) {
        stopReason = `工具规划失败：${error instanceof Error ? error.message : "未知错误"}`;
        pushStep("mcp_auto_stopped", `工具编排停止（第 ${round} 轮）`, stopReason);
        break;
      }

      pushStep("mcp_auto_planning", `工具规划结果（第 ${round} 轮）`, plannedSelection.reason);

      if (!plannedSelection.shouldCall || !plannedSelection.serverId || !plannedSelection.toolName) {
        pushStep(
          "mcp_auto_stopped",
          `工具规划完成（第 ${round} 轮）`,
          plannedSelection.reason || "模型判断无需继续调用工具"
        );
        break;
      }

      const duplicateCall = hasDuplicateToolCall(
        mcpCalls,
        plannedSelection.serverId,
        plannedSelection.toolName,
        plannedSelection.arguments
      );

      if (duplicateCall) {
        stopReason = "触发重复调用保护，工具编排已停止";
        pushStep("mcp_auto_stopped", `跳过重复工具调用（第 ${round} 轮）`, stopReason);
        break;
      }

      selectedMcpServer = resolveMcpSelection(agent, authorizedMcpServers, {
        ...request,
        mcpServerId: plannedSelection.serverId
      });
      actualMcpToolName = plannedSelection.toolName;
      actualMcpArguments = plannedSelection.arguments;
      autoSelectedMcp = true;

      if (!selectedMcpServer || !actualMcpToolName) {
        break;
      }

      const plannedTool = findCandidateTool(candidateTools, plannedSelection.serverId, plannedSelection.toolName);
      const callRecord = await executeMcpToolCall({
        server: selectedMcpServer,
        toolName: actualMcpToolName,
        toolArguments: actualMcpArguments,
        toolDefinition: plannedTool,
        round,
        autoSelected: true,
        steps,
        reportProgress: () => emitProgress(),
        repairContext: {
          modelProfile,
          agent,
          userInput: contextualUserInput,
          mcpCalls
        },
        workspacePermission,
        computerUsePermission
      });
      mcpCalls.push(callRecord);
      actualMcpArguments = callRecord.arguments;
      emitProgress();

      if (callRecord.isError) {
        const fallbackCandidateTools = buildFallbackCandidateTools(candidateTools, callRecord, mcpCalls);

        if (fallbackCandidateTools.length) {
          pushStep(
            "mcp_fallback_planned",
            `正在规划 fallback tool（第 ${round} 轮）`,
            `${callRecord.toolName} 调用失败后，尝试在 ${fallbackCandidateTools.length} 个候选中寻找替代方案`
          );

          try {
            const fallbackPlan = await planFallbackMcpToolSelection(
              modelProfile,
              agent,
              contextualUserInput,
              fallbackCandidateTools,
              mcpCalls,
              callRecord,
              round
            );

            pushStep("mcp_fallback_planned", `fallback 规划结果（第 ${round} 轮）`, fallbackPlan.reason);

            if (
              fallbackPlan.shouldFallback &&
              fallbackPlan.serverId &&
              fallbackPlan.toolName &&
              !hasDuplicateToolCall(mcpCalls, fallbackPlan.serverId, fallbackPlan.toolName, fallbackPlan.arguments)
            ) {
              const fallbackServer = resolveMcpSelection(agent, authorizedMcpServers, {
                ...request,
                mcpServerId: fallbackPlan.serverId
              });
              const fallbackTool = findCandidateTool(candidateTools, fallbackPlan.serverId, fallbackPlan.toolName);

              if (fallbackServer && fallbackTool) {
                pushStep(
                  "mcp_fallback_selected",
                  `fallback tool 已接管（第 ${round} 轮）`,
                  `${callRecord.serverName} / ${callRecord.toolName} -> ${fallbackServer.name} / ${fallbackTool.name}`
                );

                selectedMcpServer = fallbackServer;
                actualMcpToolName = fallbackTool.name;
                actualMcpArguments = fallbackPlan.arguments;

                const fallbackRecord = await executeMcpToolCall({
                  server: fallbackServer,
                  toolName: fallbackTool.name,
                  toolArguments: fallbackPlan.arguments,
                  toolDefinition: fallbackTool,
                  round,
                  autoSelected: true,
                  steps,
                  reportProgress: () => emitProgress(),
                  repairContext: {
                    modelProfile,
                    agent,
                    userInput: contextualUserInput,
                    mcpCalls
                  },
                  workspacePermission,
                  computerUsePermission,
                  fallbackFrom: {
                    serverName: callRecord.serverName,
                    toolName: callRecord.toolName
                  }
                });
                mcpCalls.push(fallbackRecord);
                actualMcpToolName = fallbackRecord.toolName;
                actualMcpArguments = fallbackRecord.arguments;
                emitProgress();

                if (fallbackRecord.isError) {
                  consecutiveFailures += 1;
                } else {
                  consecutiveFailures = 0;
                }
              } else {
                consecutiveFailures += 1;
              }
            } else {
              consecutiveFailures += 1;
            }
          } catch (error) {
            consecutiveFailures += 1;
            pushStep(
              "mcp_fallback_planned",
              `fallback 规划失败（第 ${round} 轮）`,
              `fallback 规划异常：${error instanceof Error ? error.message : "未知错误"}`
            );
          }
        } else {
          consecutiveFailures += 1;
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_AUTO_MCP_FAILURES) {
          stopReason = `连续 ${MAX_CONSECUTIVE_AUTO_MCP_FAILURES} 轮工具调用失败，自动编排已停止`;
          pushStep("mcp_auto_stopped", `工具编排停止（第 ${round} 轮）`, stopReason);
          break;
        }
      } else {
        consecutiveFailures = 0;
      }

      if (round === MAX_AUTO_MCP_ROUNDS) {
        stopReason = `达到最大自动编排轮次（${MAX_AUTO_MCP_ROUNDS} 轮）`;
        pushStep("mcp_auto_stopped", `工具编排停止（第 ${round} 轮）`, stopReason);
      }
    }

    if (!candidateTools.length && !stopReason) {
      pushStep("mcp_auto_stopped", "工具规划完成", "未发现可用工具，已直接进入模型回复");
    }
  }

  const mcpResultText = buildCombinedMcpResultText(mcpCalls);
  let skillResultText: string | null = null;
  let skillFinalOutput = false;

  if (selectedSkill?.kind === "workflow") {
    try {
      const skillExecution = await executeSkillHandler(
        selectedSkill,
        agent,
        modelProfile,
        contextualUserInput,
        conversationMessages,
        mcpResultText,
        mcpCalls,
        steps,
        () => emitProgress()
      );

      if (skillExecution?.content) {
        skillResultText = skillExecution.content;
      }

      if (skillExecution?.mode === "final") {
        skillFinalOutput = true;
      }

      emitProgress();
    } catch (error) {
      pushStep(
        "skill_handler_failed",
        "Skill Handler 执行失败",
        error instanceof Error ? error.message : "未知错误"
      );
    }
  }

  emitProgress({ statusText: skillFinalOutput ? "Skill 已直接产出结果，正在整理输出..." : "正在生成最终回复..." });

  const response = skillFinalOutput
    ? {
        text: skillResultText ?? "",
        model: `${modelProfile.model} / skill-handler`,
        profileId: modelProfile.id,
        profileLabel: `${modelProfile.displayName}（Skill 直出）`,
        provider: modelProfile.provider
      }
    : await invokeModelText(modelProfile, {
        temperature: selectedSkill ? 0.3 : 0.5,
        maxOutputTokens: 1400,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(agent, selectedSkill, authorizedMcpServers)
          },
          ...conversationMessages,
          ...buildUserMessages(
            mcpResultText
              ? `${userInput}

以下是本轮工具返回结果，请结合结果继续完成任务：
${mcpResultText}`
              : userInput,
            selectedSkill,
            skillResultText
          )
        ]
      });

  if (!skillFinalOutput) {
    pushStep("model_invoked", "模型调用完成", `${response.profileLabel} / ${response.model}`);
  }

  pushStep(
    "completed",
    "运行完成",
    skillFinalOutput
      ? `Skill「${selectedSkill?.name ?? "workflow"}」已直接产出最终结果`
      : selectedSkill
        ? `输出已结合 Skill「${selectedSkill.name}」生成`
        : "输出已直接生成"
  );

  const timestamp = new Date().toISOString();
  const log: AgentRunLog = {
    id: `agent_run_${randomUUID()}`,
    agentProfileId: agent.id,
    agentName: agent.name,
    userInput,
    skillId: selectedSkill?.id ?? null,
    skillName: selectedSkill?.name ?? null,
    ...(skillResultText ? { skillResultText } : {}),
    ...(skillFinalOutput ? { skillFinalOutput } : {}),
    autoSelectedMcp,
    mcpServerId: selectedMcpServer?.id ?? null,
    mcpServerName: selectedMcpServer?.name ?? null,
    mcpToolName: actualMcpToolName,
    ...(actualMcpArguments ? { mcpArguments: actualMcpArguments } : {}),
    mcpResultText,
    ...(mcpCalls.length ? { mcpCalls } : {}),
    ...(stopReason ? { stopReason } : {}),
    steps,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...response
  };

  const safeLog = sanitizeForIpc(log);
  emitProgress({
    phase: "completed",
    statusText: safeLog.text || "运行完成",
    text: safeLog.text,
    profileLabel: safeLog.profileLabel,
    model: safeLog.model,
    mcpResultText: safeLog.mcpResultText,
    mcpCalls: [...(safeLog.mcpCalls ?? [])],
    stopReason: safeLog.stopReason ?? "",
    steps: [...safeLog.steps],
    updatedAt: safeLog.updatedAt
  });
  await appendAgentRunLog(safeLog);
  return safeLog;
}
