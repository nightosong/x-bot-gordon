import type {
  AgentMcpCallRecord,
  AgentTaskLedgerSuccessCriterion
} from "../../shared/src/index.js";
import { stringifyArguments } from "./runtime-utils.js";

export interface AgentVerificationEvidence {
  callRef: string;
  serverName: string;
  toolName: string;
  reason: string;
}

export interface AgentCriterionVerificationResult {
  criterion: AgentTaskLedgerSuccessCriterion;
  evidence: AgentVerificationEvidence[];
}

export function getPendingSuccessCriteria(
  criteria: AgentTaskLedgerSuccessCriterion[]
): AgentTaskLedgerSuccessCriterion[] {
  return criteria.filter((criterion) => criterion.status === "pending" || criterion.status === "unknown");
}

export function getActiveVerificationCriteria(
  criteria: AgentTaskLedgerSuccessCriterion[]
): AgentTaskLedgerSuccessCriterion[] {
  const activeVerificationTypes = new Set<AgentTaskLedgerSuccessCriterion["type"]>([
    "tool_result",
    "file_contains",
    "url_opened",
    "command_passed",
    "ui_state",
    "artifact_created"
  ]);

  return getPendingSuccessCriteria(criteria).filter((criterion) => activeVerificationTypes.has(criterion.type));
}

function buildCallRef(call: AgentMcpCallRecord): string {
  return `mcp:${call.round}:${call.serverId}:${call.toolName}:${call.createdAt}`;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getSearchNeedles(criterion: AgentTaskLedgerSuccessCriterion): string[] {
  return [criterion.target, criterion.expected]
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function includesAnyNeedle(text: unknown, needles: string[]): boolean {
  const normalized = normalizeText(text);
  return needles.some((needle) => normalized.includes(needle));
}

function getCallSearchText(call: AgentMcpCallRecord): string {
  return [
    call.serverName,
    call.toolName,
    stringifyArguments(call.arguments),
    call.resultText,
    call.expectedOutcome,
    call.verificationMethod
  ]
    .filter(Boolean)
    .join("\n");
}

function createEvidence(call: AgentMcpCallRecord, reason: string): AgentVerificationEvidence {
  return {
    callRef: buildCallRef(call),
    serverName: call.serverName,
    toolName: call.toolName,
    reason
  };
}

function isCommandTool(call: AgentMcpCallRecord): boolean {
  return /command|shell|run/i.test(call.toolName);
}

function isCommandFailureText(text: string): boolean {
  return /failed|error|失败|异常|non[-_ ]?zero|exit code [1-9]/iu.test(text);
}

function verifyToolResultCriterion(
  criterion: AgentTaskLedgerSuccessCriterion,
  successfulCalls: AgentMcpCallRecord[],
  failedCalls: AgentMcpCallRecord[]
): AgentCriterionVerificationResult {
  const needles = getSearchNeedles(criterion);
  const matchedCalls = successfulCalls.filter((call) => includesAnyNeedle(getCallSearchText(call), needles));

  if (matchedCalls.length) {
    return {
      criterion: { ...criterion, status: "passed" },
      evidence: matchedCalls.map((call) => createEvidence(call, "工具结果匹配成功条件"))
    };
  }

  if (failedCalls.length) {
    return {
      criterion: { ...criterion, status: "failed" },
      evidence: failedCalls.map((call) => createEvidence(call, "已有工具失败且未找到匹配成功结果"))
    };
  }

  return {
    criterion: { ...criterion, status: "unknown" },
    evidence: []
  };
}

function verifyArtifactCriterion(
  criterion: AgentTaskLedgerSuccessCriterion,
  successfulCalls: AgentMcpCallRecord[]
): AgentCriterionVerificationResult {
  const needles = getSearchNeedles(criterion);
  const matchedCalls = successfulCalls.filter((call) => {
    if (!(call.artifacts?.length)) {
      return false;
    }

    if (!needles.length) {
      return true;
    }

    const artifactText = call.artifacts
      .map((artifact) =>
        [
          artifact.id,
          artifact.kind,
          artifact.title,
          artifact.url,
          artifact.dataUrl ? "dataUrl" : "",
          artifact.provider,
          artifact.model,
          artifact.prompt
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join("\n");

    return includesAnyNeedle(`${getCallSearchText(call)}\n${artifactText}`, needles);
  });

  return {
    criterion: { ...criterion, status: matchedCalls.length ? "passed" : "unknown" },
    evidence: matchedCalls.map((call) => createEvidence(call, "工具调用产生了匹配 artifact"))
  };
}

function verifyCommandCriterion(
  criterion: AgentTaskLedgerSuccessCriterion,
  successfulCalls: AgentMcpCallRecord[],
  failedCalls: AgentMcpCallRecord[]
): AgentCriterionVerificationResult {
  const commandCalls = successfulCalls.filter(isCommandTool);
  const failedCommandCalls = failedCalls.filter(isCommandTool);
  const needles = getSearchNeedles(criterion);
  const matchedCalls = commandCalls.filter((call) => {
    const text = getCallSearchText(call);
    return !isCommandFailureText(call.resultText) && (!needles.length || includesAnyNeedle(text, needles));
  });

  if (matchedCalls.length) {
    return {
      criterion: { ...criterion, status: "passed" },
      evidence: matchedCalls.map((call) => createEvidence(call, "命令工具完成且输出匹配成功条件"))
    };
  }

  if (failedCommandCalls.length) {
    return {
      criterion: { ...criterion, status: "failed" },
      evidence: failedCommandCalls.map((call) => createEvidence(call, "命令工具调用失败"))
    };
  }

  return {
    criterion: { ...criterion, status: "unknown" },
    evidence: []
  };
}

function verifyStateCriterion(
  criterion: AgentTaskLedgerSuccessCriterion,
  successfulCalls: AgentMcpCallRecord[],
  reason: string
): AgentCriterionVerificationResult {
  const needles = getSearchNeedles(criterion);
  const matchedCalls = successfulCalls.filter((call) => includesAnyNeedle(getCallSearchText(call), needles));

  return {
    criterion: { ...criterion, status: matchedCalls.length ? "passed" : "unknown" },
    evidence: matchedCalls.map((call) => createEvidence(call, reason))
  };
}

export function verifyCriterionFromToolHistory(
  criterion: AgentTaskLedgerSuccessCriterion,
  mcpCalls: AgentMcpCallRecord[]
): AgentCriterionVerificationResult {
  if (criterion.status === "passed" || criterion.status === "failed") {
    return {
      criterion,
      evidence: []
    };
  }

  const successfulCalls = mcpCalls.filter((call) => !call.isError);
  const failedCalls = mcpCalls.filter((call) => call.isError);

  if (criterion.type === "text_response") {
    return {
      criterion: { ...criterion, status: "unknown" },
      evidence: []
    };
  }

  if (criterion.type === "tool_result") {
    return verifyToolResultCriterion(criterion, successfulCalls, failedCalls);
  }

  if (criterion.type === "artifact_created") {
    return verifyArtifactCriterion(criterion, successfulCalls);
  }

  if (criterion.type === "command_passed") {
    return verifyCommandCriterion(criterion, successfulCalls, failedCalls);
  }

  if (criterion.type === "file_contains") {
    return verifyStateCriterion(criterion, successfulCalls, "文件相关工具结果匹配成功条件");
  }

  if (criterion.type === "url_opened") {
    return verifyStateCriterion(criterion, successfulCalls, "URL 或页面相关工具结果匹配成功条件");
  }

  if (criterion.type === "ui_state") {
    return verifyStateCriterion(criterion, successfulCalls, "UI 状态相关工具结果匹配成功条件");
  }

  return {
    criterion: { ...criterion, status: "unknown" },
    evidence: []
  };
}

export function verifyCriteriaFromToolHistory(
  criteria: AgentTaskLedgerSuccessCriterion[],
  mcpCalls: AgentMcpCallRecord[]
): AgentCriterionVerificationResult[] {
  return criteria.map((criterion) => verifyCriterionFromToolHistory(criterion, mcpCalls));
}
