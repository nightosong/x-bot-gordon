import type {
  AgentMcpCallRecord,
  AgentTaskLedger,
  AgentTaskLedgerDecisionMemoryEntry,
  AgentTaskLedgerEvidenceNode,
  AgentTaskLedgerFailedAttempt,
  AgentTaskLedgerObservation,
  AgentTaskLedgerPlanStep,
  AgentTaskLedgerSuccessCriterion,
  ModelMessage
} from "../../shared/src/index.js";
import { stringifyArguments } from "./runtime-utils.js";

const MAX_CONTEXT_RECENT_MESSAGES = 6;
const MAX_CONTEXT_RECENT_MESSAGE_LENGTH = 900;
const MAX_CONTEXT_ITEMS = 6;
const MAX_CONTEXT_TOOL_CALLS = 6;
const MAX_CONTEXT_TOOL_RESULT_LENGTH = 900;
const MAX_CONTEXT_ITEM_LENGTH = 220;

export interface AgentContextPacket {
  goal: {
    latestUserRequest: string;
    objective: string;
    taskPhase: AgentTaskLedger["taskPhase"];
    nextActionHint?: string;
  };
  constraints: string[];
  plan: AgentTaskLedgerPlanStep[];
  decisionMemory: AgentTaskLedgerDecisionMemoryEntry[];
  evidence: {
    discoveredFacts: string[];
    observations: AgentTaskLedgerObservation[];
    evidenceGraph: AgentTaskLedgerEvidenceNode[];
    environmentState: string[];
    recentToolCalls: AgentContextPacketToolCall[];
  };
  verification: {
    successCriteria: string[];
    structuredSuccessCriteria: AgentTaskLedgerSuccessCriterion[];
  };
  recovery: {
    failedAttempts: AgentTaskLedgerFailedAttempt[];
    userInterruptions: string[];
  };
  openQuestions: string[];
  recentConversation: AgentContextPacketMessage[];
}

export interface AgentContextPacketMessage {
  role: ModelMessage["role"];
  content: string;
}

export interface AgentContextPacketToolCall {
  round: number;
  serverId: string;
  serverName: string;
  toolName: string;
  arguments: string;
  expectedOutcome?: string;
  verificationMethod?: string;
  failureKind?: string;
  failureReason?: string;
  fallbackFrom?: string;
  result: string;
  isError: boolean;
}

function truncateContextText(value: unknown, maxLength = MAX_CONTEXT_ITEM_LENGTH): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function trimStringList(value: string[], maxItems = MAX_CONTEXT_ITEMS): string[] {
  const output: string[] = [];

  for (const item of value) {
    const text = truncateContextText(item);

    if (!text) {
      continue;
    }

    output.push(text);

    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

function buildRecentConversation(messages: ModelMessage[]): AgentContextPacketMessage[] {
  return messages.slice(-MAX_CONTEXT_RECENT_MESSAGES).map((message) => ({
    role: message.role,
    content: truncateContextText(message.content, MAX_CONTEXT_RECENT_MESSAGE_LENGTH)
  }));
}

function buildRecentToolCalls(mcpCalls: AgentMcpCallRecord[]): AgentContextPacketToolCall[] {
  return mcpCalls.slice(-MAX_CONTEXT_TOOL_CALLS).map((call) => ({
    round: call.round,
    serverId: truncateContextText(call.serverId, 160),
    serverName: truncateContextText(call.serverName, 120),
    toolName: truncateContextText(call.toolName, 120),
    arguments: truncateContextText(stringifyArguments(call.arguments), 500),
    ...(call.expectedOutcome ? { expectedOutcome: truncateContextText(call.expectedOutcome) } : {}),
    ...(call.verificationMethod ? { verificationMethod: truncateContextText(call.verificationMethod) } : {}),
    ...(call.failureKind ? { failureKind: truncateContextText(call.failureKind, 80) } : {}),
    ...(call.failureReason ? { failureReason: truncateContextText(call.failureReason) } : {}),
    ...(call.fallbackFromToolName
      ? { fallbackFrom: truncateContextText(`${call.fallbackFromServerName ?? call.serverName} / ${call.fallbackFromToolName}`) }
      : {}),
    result: truncateContextText(call.resultText, MAX_CONTEXT_TOOL_RESULT_LENGTH),
    isError: call.isError
  }));
}

function buildOpenQuestions(ledger: AgentTaskLedger): string[] {
  const pendingCriteria = ledger.structuredSuccessCriteria
    .filter((criterion) => criterion.status === "pending" || criterion.status === "unknown")
    .map((criterion) => `待验证成功条件：${criterion.type}${criterion.target ? ` / ${criterion.target}` : ""} / ${criterion.expected}`);
  const blockedPlanSteps = ledger.activePlan
    .filter((step) => step.status === "blocked")
    .map((step) => `阻塞计划：${step.step}`);
  const pendingSubtasks = ledger.pendingSubtasks.map((subtask) => `待推进事项：${subtask}`);

  return trimStringList([...pendingCriteria, ...blockedPlanSteps, ...pendingSubtasks]);
}

export function buildAgentContextPacket(params: {
  userInput: string;
  conversationMessages: ModelMessage[];
  taskLedger: AgentTaskLedger;
  mcpCalls: AgentMcpCallRecord[];
}): AgentContextPacket {
  const { userInput, conversationMessages, taskLedger, mcpCalls } = params;

  return {
    goal: {
      latestUserRequest: truncateContextText(userInput, 500),
      objective: truncateContextText(taskLedger.objective, 500),
      taskPhase: taskLedger.taskPhase,
      ...(taskLedger.nextActionHint ? { nextActionHint: truncateContextText(taskLedger.nextActionHint) } : {})
    },
    constraints: trimStringList(taskLedger.constraints),
    plan: taskLedger.activePlan.slice(-MAX_CONTEXT_ITEMS),
    decisionMemory: taskLedger.decisionMemory.slice(-MAX_CONTEXT_ITEMS),
    evidence: {
      discoveredFacts: trimStringList(taskLedger.discoveredFacts),
      observations: taskLedger.observations.slice(-MAX_CONTEXT_ITEMS),
      evidenceGraph: taskLedger.evidenceGraph.slice(-MAX_CONTEXT_ITEMS),
      environmentState: trimStringList(taskLedger.environmentState),
      recentToolCalls: buildRecentToolCalls(mcpCalls)
    },
    verification: {
      successCriteria: trimStringList(taskLedger.successCriteria),
      structuredSuccessCriteria: taskLedger.structuredSuccessCriteria.slice(-MAX_CONTEXT_ITEMS)
    },
    recovery: {
      failedAttempts: taskLedger.failedAttempts.slice(-MAX_CONTEXT_ITEMS),
      userInterruptions: trimStringList(taskLedger.userInterruptions)
    },
    openQuestions: buildOpenQuestions(taskLedger),
    recentConversation: buildRecentConversation(conversationMessages)
  };
}

export function buildAgentContextPacketText(packet: AgentContextPacket): string {
  return JSON.stringify(packet, null, 2);
}
