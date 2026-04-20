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
  AgentMcpCallRecord,
  AgentProfile,
  AgentRunLog,
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
const MAX_SKILL_HANDLER_DURATION_MS = 20_000;
const SKILL_HANDLER_PROTOCOL_VERSION = "gordon-skill/v1";
const MAX_CONVERSATION_CONTEXT_MESSAGES = 8;

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

  if (profile.provider === "openai_like" && !profile.baseUrl?.trim()) {
    throw new Error("当前 Agent 绑定的是 OpenAI-like 模型，但缺少 Base URL");
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

function resolveMcpSelection(
  agent: AgentProfile,
  authorizedServers: McpServerConfig[],
  request: AgentRunRequest
): McpServerConfig | null {
  if (!request.mcpServerId?.trim()) {
    return null;
  }

  if (!agent.allowedMcpServerIds.includes(request.mcpServerId)) {
    throw new Error("当前 MCP Server 不在 Agent 的授权列表内");
  }

  const server = authorizedServers.find((entry) => entry.id === request.mcpServerId);

  if (!server) {
    throw new Error("指定的 MCP Server 不存在或未启用");
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
  steps: AgentRunStep[]
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
    return null;
  }

  steps.push(
    createRunStep("skill_handler_started", "开始执行 Skill Handler", `${skill.name} / ${handlerPath}`)
  );

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

  return result;
}

function stringifyArguments(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
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

async function collectCandidateMcpTools(servers: McpServerConfig[]): Promise<McpToolDefinition[]> {
  const toolGroups = await Promise.all(servers.map(async (server) => listToolsFromMcpServer(server.id)));
  return toolGroups.flat();
}

function buildMcpHistoryText(mcpCalls: AgentMcpCallRecord[]): string {
  if (!mcpCalls.length) {
    return "暂无历史 MCP 调用。";
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
      reason: "未发现可用 MCP 工具"
    };
  }

  const planningResponse = await invokeModelText(modelProfile, {
    temperature: 0,
    maxOutputTokens: 800,
    messages: [
      {
        role: "system",
        content: `你是 Gordon 的 MCP 工具规划器。
你的唯一任务是判断当前是否需要调用 MCP 工具，以及如果需要，应该调用哪一个工具。

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

已有 MCP 调用历史：
${buildMcpHistoryText(mcpCalls)}

可用 MCP 工具列表：
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
      reason: reason || "模型判断本轮不需要调用 MCP 工具"
    };
  }

  const matchedTool = findCandidateTool(candidateTools, serverId, toolName);

  if (!matchedTool) {
    return {
      shouldCall: false,
      serverId: null,
      toolName: null,
      arguments: {},
      reason: "模型返回了无效 MCP 规划，已降级为不调用工具"
    };
  }

  return {
    shouldCall: true,
    serverId,
    toolName,
    arguments: argumentsObject,
    reason: reason || "模型判断需要调用 MCP 工具"
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
        content: `你是 Gordon 的 MCP 参数修复器。
你的任务是根据工具 inputSchema、用户任务和失败原因，修复一次 MCP 工具参数。

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

已有 MCP 调用历史：
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
        content: `你是 Gordon 的 MCP fallback 规划器。
当前工具调用失败后，你需要判断是否应该切换到其他 MCP 工具继续完成任务。

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

刚失败的 MCP 调用：
server=${failedCall.serverName}
tool=${failedCall.toolName}
arguments=${stringifyArguments(failedCall.arguments)}
failureKind=${failedCall.failureKind ?? "unknown"}
failureReason=${failedCall.failureReason ?? failedCall.resultText}

已有 MCP 调用历史：
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
    `你是 Gordon 中的一个 Agent。\nAgent 名称：${agent.name}\n执行模式：${agent.mode}`,
    agent.systemPrompt.trim()
  ];

  if (skill) {
    sections.push(
      `当前指定 Skill：${skill.name}\nSkill 类型：${skill.kind}\nSkill 说明：${skill.description || "无"}\nSkill 模板：\n${skill.promptTemplate.trim()}`
    );
  }

  if (authorizedMcpServers.length) {
    sections.push(
      `当前已授权 ${authorizedMcpServers.length} 个 MCP Server，必要时本轮可能先调用 MCP tool，再基于工具结果完成最终输出。\n已授权服务：${authorizedMcpServers
        .map((server) => server.name)
        .join("、")}`
    );
  }

  sections.push("输出只返回最终结果，不要解释内部推理过程。");

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
      (call) => `第 ${call.round} 轮 MCP 结果
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
    fallbackFrom
  } = options;

  steps.push(
    createRunStep("mcp_server_selected", `已选择 MCP Server（第 ${round} 轮）`, server.name),
    createRunStep("mcp_tool_selected", `已选择 MCP 工具（第 ${round} 轮）`, toolName)
  );

  let currentArguments = toolArguments ?? {};
  let lastErrorMessage = "";
  let lastErrorCategory: AgentMcpCallRecord["errorCategory"] = "non_retryable";
  let lastFailureKind: AgentMcpCallRecord["failureKind"] = "unknown";
  let repairCount = 0;
  let repairedFromArguments: Record<string, unknown> | undefined;
  let repairReason: string | undefined;

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
          `MCP 参数已修复（第 ${round} 轮）`,
          `${toolName} / ${repaired.reason}`
        )
      );
      return true;
    } catch {
      return false;
    }
  };

  for (let attempt = 1; attempt <= MAX_MCP_TOOL_ATTEMPTS; attempt += 1) {
    try {
      const toolResult = await callToolOnMcpServer({
        serverId: server.id,
        toolName,
        arguments: currentArguments
      });

      if (toolResult.isError) {
        const classified = classifyMcpMessage(toolResult.contentText || "MCP 工具返回错误标记");
        lastErrorMessage = classified.message;
        lastErrorCategory = classified.category;
        lastFailureKind = classified.failureKind;

        const repaired = await tryRepairArguments(classified.message);

        if (repaired) {
          continue;
        }

        steps.push(
          createRunStep(
            "mcp_tool_failed",
            `MCP 工具返回错误（第 ${round} 轮）`,
            `${toolName} / ${classified.message} / 第 ${attempt} 次尝试`
          )
        );

        return {
          round,
          serverId: server.id,
          serverName: server.name,
          toolName,
          arguments: currentArguments,
          resultText: toolResult.contentText,
          isError: true,
          autoSelected,
          attemptCount: attempt,
          recovered: attempt > 1 || repairCount > 0,
          errorCategory: classified.category,
          failureKind: classified.failureKind,
          failureReason: classified.message,
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
          `MCP 工具调用完成（第 ${round} 轮）`,
          `${toolResult.toolName} / 第 ${attempt} 次尝试`
        )
      );

      return {
        round,
        serverId: server.id,
        serverName: server.name,
        toolName,
        arguments: currentArguments,
        resultText: toolResult.contentText,
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
      lastErrorMessage = classified.message;
      lastErrorCategory = classified.category;
      lastFailureKind = classified.failureKind;

      const canRetry = classified.category === "retryable" && attempt < MAX_MCP_TOOL_ATTEMPTS;

      if (canRetry) {
        const delayMs = MCP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        steps.push(
          createRunStep(
            "mcp_retrying",
            `MCP 工具准备重试（第 ${round} 轮）`,
            `${toolName} / 第 ${attempt} 次失败：${classified.message} / ${delayMs}ms 后重试`
          )
        );
        await sleep(delayMs);
        continue;
      }

      const repaired = await tryRepairArguments(classified.message);

      if (repaired) {
        continue;
      }

      steps.push(
        createRunStep(
          "mcp_tool_failed",
          `MCP 工具调用失败（第 ${round} 轮）`,
          `${toolName} / ${classified.message} / 已尝试 ${attempt} 次`
        )
      );

      return {
        round,
        serverId: server.id,
        serverName: server.name,
        toolName,
        arguments: currentArguments,
        resultText: `MCP 调用失败：${classified.message}`,
        isError: true,
        autoSelected,
        attemptCount: attempt,
        recovered: repairCount > 0,
        errorCategory: classified.category,
        failureKind: classified.failureKind,
        failureReason: classified.message,
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
    resultText: `MCP 调用失败：${lastErrorMessage || "未知错误"}`,
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

export async function runAgent(request: AgentRunRequest): Promise<AgentRunLog> {
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
  const steps: AgentRunStep[] = [
    createRunStep("agent_selected", "已加载 Agent", `${agent.name} / ${agent.mode}`),
    createRunStep("model_selected", "已绑定模型", `${modelProfile.displayName} / ${modelProfile.model}`)
  ];

  if (selectedSkill) {
    steps.push(
      createRunStep(
        "skill_selected",
        "已附加 Skill",
        `${selectedSkill.name} / ${selectedSkill.kind === "workflow" ? "workflow" : "prompt"}`
      )
    );
  }

  if (authorizedMcpServers.length) {
    steps.push(
      createRunStep(
        "mcp_authorized",
        "检测到已授权 MCP",
        `本轮作为上下文保留，尚未真实调用：${authorizedMcpServers.map((server) => server.name).join("、")}`
      )
    );
  }

  const mcpCalls: AgentMcpCallRecord[] = [];
  let actualMcpToolName: string | null = request.mcpToolName?.trim() || null;
  let actualMcpArguments: Record<string, unknown> | undefined = request.mcpArguments;
  let autoSelectedMcp = false;
  let stopReason: string | null = null;

  if (selectedMcpServer && actualMcpToolName) {
    const toolName = actualMcpToolName?.trim();

    if (!toolName) {
      throw new Error("已选择 MCP Server，但还没有指定工具名称");
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
        repairContext: {
          modelProfile,
          agent,
          userInput: contextualUserInput,
          mcpCalls
        }
      })
    );
    actualMcpToolName = mcpCalls[mcpCalls.length - 1]?.toolName ?? toolName;
    actualMcpArguments = mcpCalls[mcpCalls.length - 1]?.arguments;
    stopReason = mcpCalls[mcpCalls.length - 1]?.isError
      ? "手动指定的 MCP 工具调用失败，已停止继续编排"
      : "手动指定 MCP 工具已完成";
  }

  if (!actualMcpToolName && request.autoSelectMcp && authorizedMcpServers.length) {
    const candidateServers = selectedMcpServer ? [selectedMcpServer] : authorizedMcpServers;
    let candidateTools: McpToolDefinition[] = [];
    try {
      candidateTools = await collectCandidateMcpTools(candidateServers);
    } catch (error) {
      stopReason = `MCP 工具发现失败：${error instanceof Error ? error.message : "未知错误"}`;
      steps.push(createRunStep("mcp_auto_stopped", "MCP 自动编排停止", stopReason));
    }
    let consecutiveFailures = 0;

    for (let round = 1; round <= MAX_AUTO_MCP_ROUNDS && candidateTools.length; round += 1) {
      steps.push(
        createRunStep(
          "mcp_auto_planning",
          `正在规划 MCP 工具（第 ${round} 轮）`,
          `从 ${candidateServers.length} 个 MCP Server 的可用工具中自动选择`
        )
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
        stopReason = `MCP 规划失败：${error instanceof Error ? error.message : "未知错误"}`;
        steps.push(createRunStep("mcp_auto_stopped", `MCP 自动编排停止（第 ${round} 轮）`, stopReason));
        break;
      }

      steps.push(
        createRunStep("mcp_auto_planning", `MCP 规划结果（第 ${round} 轮）`, plannedSelection.reason)
      );

      if (!plannedSelection.shouldCall || !plannedSelection.serverId || !plannedSelection.toolName) {
        stopReason = plannedSelection.reason || "模型判断无需继续调用 MCP 工具";
        steps.push(createRunStep("mcp_auto_stopped", `MCP 自动编排停止（第 ${round} 轮）`, stopReason));
        break;
      }

      const duplicateCall = hasDuplicateToolCall(
        mcpCalls,
        plannedSelection.serverId,
        plannedSelection.toolName,
        plannedSelection.arguments
      );

      if (duplicateCall) {
        stopReason = "触发重复调用保护，自动编排已停止";
        steps.push(
          createRunStep(
            "mcp_auto_stopped",
            `跳过重复 MCP 调用（第 ${round} 轮）`,
            stopReason
          )
        );
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
        repairContext: {
          modelProfile,
          agent,
          userInput: contextualUserInput,
          mcpCalls
        }
      });
      mcpCalls.push(callRecord);
      actualMcpArguments = callRecord.arguments;

      if (callRecord.isError) {
        const fallbackCandidateTools = buildFallbackCandidateTools(candidateTools, callRecord, mcpCalls);

        if (fallbackCandidateTools.length) {
          steps.push(
            createRunStep(
              "mcp_fallback_planned",
              `正在规划 fallback tool（第 ${round} 轮）`,
              `${callRecord.toolName} 调用失败后，尝试在 ${fallbackCandidateTools.length} 个候选中寻找替代方案`
            )
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

            steps.push(
              createRunStep(
                "mcp_fallback_planned",
                `fallback 规划结果（第 ${round} 轮）`,
                fallbackPlan.reason
              )
            );

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
                steps.push(
                  createRunStep(
                    "mcp_fallback_selected",
                    `fallback tool 已接管（第 ${round} 轮）`,
                    `${callRecord.serverName} / ${callRecord.toolName} -> ${fallbackServer.name} / ${fallbackTool.name}`
                  )
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
                  repairContext: {
                    modelProfile,
                    agent,
                    userInput: contextualUserInput,
                    mcpCalls
                  },
                  fallbackFrom: {
                    serverName: callRecord.serverName,
                    toolName: callRecord.toolName
                  }
                });
                mcpCalls.push(fallbackRecord);
                actualMcpToolName = fallbackRecord.toolName;
                actualMcpArguments = fallbackRecord.arguments;

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
            steps.push(
              createRunStep(
                "mcp_fallback_planned",
                `fallback 规划失败（第 ${round} 轮）`,
                `fallback 规划异常：${error instanceof Error ? error.message : "未知错误"}`
              )
            );
          }
        } else {
          consecutiveFailures += 1;
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_AUTO_MCP_FAILURES) {
          stopReason = `连续 ${MAX_CONSECUTIVE_AUTO_MCP_FAILURES} 轮 MCP 调用失败，自动编排已停止`;
          steps.push(
            createRunStep("mcp_auto_stopped", `MCP 自动编排停止（第 ${round} 轮）`, stopReason)
          );
          break;
        }
      } else {
        consecutiveFailures = 0;
      }

      if (round === MAX_AUTO_MCP_ROUNDS) {
        stopReason = `达到最大自动编排轮次（${MAX_AUTO_MCP_ROUNDS} 轮）`;
        steps.push(createRunStep("mcp_auto_stopped", `MCP 自动编排停止（第 ${round} 轮）`, stopReason));
      }
    }

    if (!candidateTools.length && !stopReason) {
      stopReason = "未发现可用 MCP 工具，自动编排已停止";
      steps.push(createRunStep("mcp_auto_stopped", "MCP 自动编排停止", stopReason));
    }
  }

  const mcpResultText = buildCombinedMcpResultText(mcpCalls);
  let skillResultText: string | null = null;
  let skillFinalOutput = false;

  if (!stopReason && request.autoSelectMcp && !mcpCalls.length) {
    stopReason = "自动 MCP 已开启，但本轮没有发生工具调用";
  }

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
        steps
      );

      if (skillExecution?.content) {
        skillResultText = skillExecution.content;
      }

      if (skillExecution?.mode === "final") {
        skillFinalOutput = true;
      }
    } catch (error) {
      steps.push(
        createRunStep(
          "skill_handler_failed",
          "Skill Handler 执行失败",
          error instanceof Error ? error.message : "未知错误"
        )
      );
    }
  }

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

以下是本轮 MCP 工具返回结果，请结合结果继续完成任务：
${mcpResultText}`
              : userInput,
            selectedSkill,
            skillResultText
          )
        ]
      });

  if (!skillFinalOutput) {
    steps.push(createRunStep("model_invoked", "模型调用完成", `${response.profileLabel} / ${response.model}`));
  }

  steps.push(
    createRunStep(
      "completed",
      "运行完成",
      skillFinalOutput
        ? `Skill「${selectedSkill?.name ?? "workflow"}」已直接产出最终结果`
        : selectedSkill
          ? `输出已结合 Skill「${selectedSkill.name}」生成`
          : "输出已直接生成"
    )
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

  await appendAgentRunLog(log);
  return log;
}
