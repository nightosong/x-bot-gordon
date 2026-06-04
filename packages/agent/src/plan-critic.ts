import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { stringifyArguments } from "./runtime-utils.js";

export type AgentPlanCriticDecision = "allow" | "revise" | "stop";

export interface AgentPlanCriticInput {
  contextPacket: AgentContextPacket;
  candidateTools: McpToolDefinition[];
  serverId: string | null;
  toolName: string | null;
  arguments: Record<string, unknown>;
  expectedOutcome?: string;
  verificationMethod?: string;
  reason: string;
  shouldCall: boolean;
}

export interface AgentPlanCriticResult {
  decision: AgentPlanCriticDecision;
  reason: string;
  issues: string[];
  revisionHint?: string;
}

function normalizeText(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasRejectedRouteMarker(text: string): boolean {
  return ["放弃", "避免", "不再", "拒绝", "abandon", "avoid", "reject", "rejected", "skip", "do not", "don't"].some((marker) =>
    text.includes(marker)
  );
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

function hasSameRecentToolCall(contextPacket: AgentContextPacket, serverId: string | null, toolName: string | null, args: Record<string, unknown>): boolean {
  if (!serverId || !toolName) {
    return false;
  }

  const argumentText = stringifyArguments(args);

  return contextPacket.evidence.recentToolCalls.some(
    (call) => call.serverId === serverId && call.toolName === toolName && call.arguments === argumentText
  );
}

function repeatsActiveDecisionMemory(contextPacket: AgentContextPacket, tool: McpToolDefinition): boolean {
  const routeLabels = [
    `${tool.serverName} / ${tool.name}`,
    `${tool.serverId} / ${tool.name}`,
    `${tool.serverId}:${tool.name}`,
    tool.name
  ].map((label) => label.toLowerCase());

  return contextPacket.decisionMemory.some((entry) => {
    if (entry.status !== "active") {
      return false;
    }

    const decision = normalizeText(entry.decision);
    const reason = normalizeText(entry.reason);
    const searchableText = `${decision}\n${reason}`;
    return hasRejectedRouteMarker(searchableText) && routeLabels.some((label) => searchableText.includes(label));
  });
}

export function critiqueMcpToolPlan(input: AgentPlanCriticInput): AgentPlanCriticResult {
  const issues: string[] = [];

  if (!input.shouldCall) {
    return {
      decision: "allow",
      reason: "Planner 判断无需调用工具",
      issues
    };
  }

  const tool = findCandidateTool(input.candidateTools, input.serverId, input.toolName);

  if (!tool) {
    return {
      decision: "stop",
      reason: "Planner 选择了候选列表之外的工具",
      issues: ["invalid_tool"],
      revisionHint: "重新从当前可用工具列表中选择，或停止工具调用并说明原因"
    };
  }

  if (!input.expectedOutcome?.trim()) {
    issues.push("missing_expected_outcome");
  }

  if (!input.verificationMethod?.trim()) {
    issues.push("missing_verification_method");
  }

  if (repeatsActiveDecisionMemory(input.contextPacket, tool)) {
    issues.push("repeats_active_decision_memory");
  }

  if (hasSameRecentToolCall(input.contextPacket, input.serverId, input.toolName, input.arguments)) {
    issues.push("duplicate_recent_tool_call");
  }

  if (issues.includes("repeats_active_decision_memory") || issues.includes("duplicate_recent_tool_call")) {
    return {
      decision: "revise",
      reason: "计划重复了近期失败或已放弃路线",
      issues,
      revisionHint: "选择能绕开 active decisionMemory 或重复调用的替代工具；如果必须重试，需要先说明新证据并更新 decisionMemory"
    };
  }

  if (issues.includes("missing_expected_outcome") || issues.includes("missing_verification_method")) {
    return {
      decision: "revise",
      reason: "工具计划缺少可观察预期或验证方式",
      issues,
      revisionHint: "补齐 expectedOutcome 与 verificationMethod 后再执行；如果无法定义验证方式，应停止工具调用并说明未验证状态"
    };
  }

  return {
    decision: "allow",
    reason: "计划通过 Critic 检查",
    issues
  };
}
