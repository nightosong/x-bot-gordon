import type {
  AgentMcpCallRecord,
  AgentTaskLedger,
  AgentTaskLedgerDecisionMemoryEntry,
  AgentTaskLedgerDecisionTraceEntry,
  AgentTaskLedgerEvidenceNode,
  AgentTaskLedgerFailedAttempt,
  AgentTaskLedgerObservation,
  AgentTaskLedgerPlanStep,
  AgentTaskLedgerSuccessCriterion,
  AgentTaskPhase,
  SkillDefinition
} from "../../shared/src/index.js";
import { isRecord } from "./runtime-utils.js";
import {
  createEvidenceNodesFromToolCall,
  createEvidenceNodesFromVerificationResults,
  mergeEvidenceGraph,
  normalizeEvidenceGraph
} from "./evidence-graph.js";
import { getActiveVerificationCriteria, verifyCriteriaFromToolHistory } from "./verifier.js";

const MAX_LEDGER_LIST_ITEMS = 8;
const MAX_LEDGER_PLAN_STEPS = 8;
const MAX_LEDGER_DECISION_MEMORY_ITEMS = 8;
const MAX_LEDGER_DECISION_TRACE_ITEMS = 8;
const MAX_LEDGER_OBSERVATION_ITEMS = 8;
const MAX_LEDGER_SUCCESS_CRITERIA_ITEMS = 8;
const MAX_LEDGER_FAILED_ATTEMPTS = 6;
const MAX_LEDGER_ITEM_LENGTH = 220;
const MAX_LEDGER_OBSERVATION_TEXT_LENGTH = 1600;

export interface AgentTaskLedgerPatch {
  taskPhase?: AgentTaskPhase;
  objective?: string;
  constraints?: string[];
  completedSubtasks?: string[];
  pendingSubtasks?: string[];
  activePlan?: AgentTaskLedgerPlanStep[];
  decisionMemory?: AgentTaskLedgerDecisionMemoryEntry[];
  decisionTrace?: AgentTaskLedgerDecisionTraceEntry[];
  observations?: AgentTaskLedgerObservation[];
  discoveredFacts?: string[];
  failedAttempts?: AgentTaskLedgerFailedAttempt[];
  environmentState?: string[];
  userInterruptions?: string[];
  successCriteria?: string[];
  structuredSuccessCriteria?: AgentTaskLedgerSuccessCriterion[];
  nextActionHint?: string;
}

export function truncateLedgerText(value: unknown, maxLength = MAX_LEDGER_ITEM_LENGTH): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeLedgerStringList(value: unknown, maxItems = MAX_LEDGER_LIST_ITEMS): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const text = truncateLedgerText(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(text);

    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

function normalizeLedgerFailedAttempts(value: unknown): AgentTaskLedgerFailedAttempt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: AgentTaskLedgerFailedAttempt[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const action = truncateLedgerText(item.action);
    const reason = truncateLedgerText(item.reason);
    const category = truncateLedgerText(item.category || "unknown", 80) || "unknown";
    const recoveryHint = truncateLedgerText(item.recoveryHint);

    if (!action || !reason) {
      continue;
    }

    output.push({
      action,
      reason,
      category,
      ...(recoveryHint ? { recoveryHint } : {})
    });

    if (output.length >= MAX_LEDGER_FAILED_ATTEMPTS) {
      break;
    }
  }

  return output;
}

function normalizeLedgerPlanSteps(value: unknown): AgentTaskLedgerPlanStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: AgentTaskLedgerPlanStep[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const step = truncateLedgerText(item.step);
    const toolHint = truncateLedgerText(item.toolHint, 120);
    const successCriteria = truncateLedgerText(item.successCriteria);
    const rawStatus = typeof item.status === "string" ? item.status.trim() : "";
    const status = ["pending", "in_progress", "completed", "blocked"].includes(rawStatus)
      ? (rawStatus as AgentTaskLedgerPlanStep["status"])
      : "pending";

    if (!step) {
      continue;
    }

    output.push({
      step,
      ...(toolHint ? { toolHint } : {}),
      ...(successCriteria ? { successCriteria } : {}),
      status
    });

    if (output.length >= MAX_LEDGER_PLAN_STEPS) {
      break;
    }
  }

  return output;
}

function normalizeTaskPhase(value: unknown, fallback: AgentTaskPhase = "understanding"): AgentTaskPhase {
  const phase = typeof value === "string" ? value.trim() : "";
  return ["understanding", "planning", "executing", "verifying", "recovering", "finalizing"].includes(phase)
    ? (phase as AgentTaskPhase)
    : fallback;
}

function normalizeDecisionMemory(value: unknown): AgentTaskLedgerDecisionMemoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: AgentTaskLedgerDecisionMemoryEntry[] = [];
  const seen = new Set<string>();
  const validScopes = new Set(["current_task", "session", "project"]);
  const validStatuses = new Set(["active", "superseded"]);

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const decision = truncateLedgerText(item.decision);
    const reason = truncateLedgerText(item.reason);
    const rawConfidence = typeof item.confidence === "number" ? item.confidence : Number(item.confidence);
    const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0.5;
    const rawScope = typeof item.scope === "string" ? item.scope.trim() : "";
    const rawStatus = typeof item.status === "string" ? item.status.trim() : "";
    const scope = validScopes.has(rawScope) ? (rawScope as AgentTaskLedgerDecisionMemoryEntry["scope"]) : "current_task";
    const status = validStatuses.has(rawStatus) ? (rawStatus as AgentTaskLedgerDecisionMemoryEntry["status"]) : "active";
    const evidenceRefs = normalizeLedgerStringList(item.evidenceRefs, 5);
    const key = `${decision.toLowerCase()}|${reason.toLowerCase()}|${scope}`;

    if (!decision || !reason || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({
      decision,
      reason,
      confidence,
      scope,
      status,
      evidenceRefs
    });

    if (output.length >= MAX_LEDGER_DECISION_MEMORY_ITEMS) {
      break;
    }
  }

  return output;
}

function mergeDecisionMemory(
  currentValue: AgentTaskLedgerDecisionMemoryEntry[],
  patchValue: AgentTaskLedgerDecisionMemoryEntry[] | undefined
): AgentTaskLedgerDecisionMemoryEntry[] {
  if (!patchValue) {
    return currentValue;
  }

  const entries = new Map<string, AgentTaskLedgerDecisionMemoryEntry>();

  for (const item of [...currentValue, ...patchValue]) {
    const key = `${item.decision.toLowerCase()}|${item.scope}`;
    entries.set(key, item);
  }

  return [...entries.values()].slice(-MAX_LEDGER_DECISION_MEMORY_ITEMS);
}

function normalizeDecisionTrace(value: unknown): AgentTaskLedgerDecisionTraceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: AgentTaskLedgerDecisionTraceEntry[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const step = truncateLedgerText(item.step);
    const intent = truncateLedgerText(item.intent);
    const chosenAction = truncateLedgerText(item.chosenAction);
    const why = truncateLedgerText(item.why);
    const rejectedAlternatives = normalizeLedgerStringList(item.rejectedAlternatives, 4);
    const expectedOutcome = truncateLedgerText(item.expectedOutcome);

    if (!step || !intent || !chosenAction || !why) {
      continue;
    }

    output.push({
      step,
      intent,
      chosenAction,
      rejectedAlternatives,
      why,
      ...(expectedOutcome ? { expectedOutcome } : {})
    });

    if (output.length >= MAX_LEDGER_DECISION_TRACE_ITEMS) {
      break;
    }
  }

  return output;
}

function normalizeLedgerObservations(value: unknown): AgentTaskLedgerObservation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: AgentTaskLedgerObservation[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const source = truncateLedgerText(item.source, 120);
    const rawRef = truncateLedgerText(item.rawRef, 160);
    const summary = truncateLedgerText(item.summary, 320);

    if (!source || !summary) {
      continue;
    }

    output.push({
      source,
      ...(rawRef ? { rawRef } : {}),
      summary,
      durableFacts: normalizeLedgerStringList(item.durableFacts, 5),
      ephemeralFacts: normalizeLedgerStringList(item.ephemeralFacts, 5),
      evidenceRefs: normalizeLedgerStringList(item.evidenceRefs, 5)
    });

    if (output.length >= MAX_LEDGER_OBSERVATION_ITEMS) {
      break;
    }
  }

  return output;
}

function normalizeStructuredSuccessCriteria(value: unknown): AgentTaskLedgerSuccessCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: AgentTaskLedgerSuccessCriterion[] = [];
  const validTypes = new Set([
    "text_response",
    "tool_result",
    "file_contains",
    "file_exists",
    "url_opened",
    "url_matches",
    "command_passed",
    "command_exit_zero",
    "ui_state",
    "ui_contains",
    "artifact_created",
    "artifact_exists",
    "json_path_equals",
    "custom"
  ]);
  const validStatuses = new Set(["pending", "passed", "failed", "unknown"]);

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const rawType = typeof item.type === "string" ? item.type.trim() : "";
    const rawStatus = typeof item.status === "string" ? item.status.trim() : "";
    const expected = truncateLedgerText(item.expected);
    const target = truncateLedgerText(item.target, 160);
    const verificationMethod = truncateLedgerText(item.verificationMethod);

    if (!expected) {
      continue;
    }

    output.push({
      type: validTypes.has(rawType) ? (rawType as AgentTaskLedgerSuccessCriterion["type"]) : "custom",
      ...(target ? { target } : {}),
      expected,
      ...(verificationMethod ? { verificationMethod } : {}),
      status: validStatuses.has(rawStatus) ? (rawStatus as AgentTaskLedgerSuccessCriterion["status"]) : "pending"
    });

    if (output.length >= MAX_LEDGER_SUCCESS_CRITERIA_ITEMS) {
      break;
    }
  }

  return output;
}

export function normalizeAgentTaskLedger(
  value: Partial<AgentTaskLedger> | Record<string, unknown> | null | undefined,
  fallbackObjective: string
): AgentTaskLedger {
  const source = (value ?? {}) as Partial<AgentTaskLedger> & Record<string, unknown>;

  return {
    taskPhase: normalizeTaskPhase(source.taskPhase),
    objective: truncateLedgerText(source.objective, 320) || truncateLedgerText(fallbackObjective, 320),
    constraints: normalizeLedgerStringList(source.constraints),
    completedSubtasks: normalizeLedgerStringList(source.completedSubtasks),
    pendingSubtasks: normalizeLedgerStringList(source.pendingSubtasks),
    activePlan: normalizeLedgerPlanSteps(source.activePlan),
    decisionMemory: normalizeDecisionMemory(source.decisionMemory),
    decisionTrace: normalizeDecisionTrace(source.decisionTrace),
    observations: normalizeLedgerObservations(source.observations),
    evidenceGraph: normalizeEvidenceGraph(source.evidenceGraph),
    discoveredFacts: normalizeLedgerStringList(source.discoveredFacts),
    failedAttempts: normalizeLedgerFailedAttempts(source.failedAttempts),
    environmentState: normalizeLedgerStringList(source.environmentState),
    userInterruptions: normalizeLedgerStringList(source.userInterruptions),
    successCriteria: normalizeLedgerStringList(source.successCriteria),
    structuredSuccessCriteria: normalizeStructuredSuccessCriteria(source.structuredSuccessCriteria),
    ...(truncateLedgerText(source.nextActionHint) ? { nextActionHint: truncateLedgerText(source.nextActionHint) } : {})
  };
}

export function normalizeAgentTaskLedgerPatch(value: unknown): AgentTaskLedgerPatch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const patch: AgentTaskLedgerPatch = {};
  const taskPhase = normalizeTaskPhase(value.taskPhase, "understanding");
  const objective = truncateLedgerText(value.objective, 320);
  const nextActionHint = truncateLedgerText(value.nextActionHint);
  const listFields = [
    "constraints",
    "completedSubtasks",
    "pendingSubtasks",
    "discoveredFacts",
    "environmentState",
    "userInterruptions",
    "successCriteria"
  ] as const;

  if (objective) {
    patch.objective = objective;
  }

  if ("taskPhase" in value) {
    patch.taskPhase = taskPhase;
  }

  for (const field of listFields) {
    if (field in value) {
      patch[field] = normalizeLedgerStringList(value[field]);
    }
  }

  if ("failedAttempts" in value) {
    patch.failedAttempts = normalizeLedgerFailedAttempts(value.failedAttempts);
  }

  if ("activePlan" in value) {
    patch.activePlan = normalizeLedgerPlanSteps(value.activePlan);
  }

  if ("decisionMemory" in value) {
    patch.decisionMemory = normalizeDecisionMemory(value.decisionMemory);
  }

  if ("decisionTrace" in value) {
    patch.decisionTrace = normalizeDecisionTrace(value.decisionTrace);
  }

  if ("observations" in value) {
    patch.observations = normalizeLedgerObservations(value.observations);
  }

  if ("structuredSuccessCriteria" in value) {
    patch.structuredSuccessCriteria = normalizeStructuredSuccessCriteria(value.structuredSuccessCriteria);
  }

  if (nextActionHint) {
    patch.nextActionHint = nextActionHint;
  }

  return Object.keys(patch).length ? patch : undefined;
}

export function createInitialTaskLedger(userInput: string, selectedSkill: Pick<SkillDefinition, "name"> | null): AgentTaskLedger {
  const objective = truncateLedgerText(userInput, 320);
  const constraints = [
    "模型负责判断下一步行动和工具选择；运行时只做授权、安全、重试和边界控制",
    "没有成功的工具结果前，不声称已经完成读取、写入、打开、生成或验证类动作"
  ];

  if (selectedSkill) {
    constraints.push(`需要结合 Skill「${selectedSkill.name}」的约束执行`);
  }

  return normalizeAgentTaskLedger(
    {
      objective,
      taskPhase: "understanding",
      constraints,
      pendingSubtasks: ["判断任务是否需要工具；如需要，选择最能推进目标的下一步工具"],
      activePlan: [
        {
          step: "判断任务是否需要工具，并选择最能推进目标的下一步动作",
          successCriteria: "明确是否需要工具；需要工具时给出可执行工具调用和验证方式",
          status: "pending"
        }
      ],
      successCriteria: ["最终回复应直接回应用户目标；涉及外部状态或本地动作时，需要基于工具结果给出结论"],
      structuredSuccessCriteria: [
        {
          type: "text_response",
          expected: "最终回复直接回应用户目标，并明确说明已完成、未完成或未验证的事项",
          verificationMethod: "根据工具结果、任务账本和最终回复内容检查",
          status: "pending"
        }
      ]
    },
    userInput
  );
}

export function mergeAgentTaskLedgerPatch(
  currentLedger: AgentTaskLedger,
  patch: AgentTaskLedgerPatch | null | undefined,
  fallbackObjective: string
): AgentTaskLedger {
  if (!patch || typeof patch !== "object") {
    return normalizeAgentTaskLedger(currentLedger, fallbackObjective);
  }

  return normalizeAgentTaskLedger(
    {
      taskPhase: patch.taskPhase ?? currentLedger.taskPhase,
      objective: patch.objective ?? currentLedger.objective,
      constraints: patch.constraints ?? currentLedger.constraints,
      completedSubtasks: patch.completedSubtasks ?? currentLedger.completedSubtasks,
      pendingSubtasks: patch.pendingSubtasks ?? currentLedger.pendingSubtasks,
      activePlan: patch.activePlan ?? currentLedger.activePlan,
      decisionMemory: mergeDecisionMemory(currentLedger.decisionMemory, patch.decisionMemory),
      decisionTrace: patch.decisionTrace ?? currentLedger.decisionTrace,
      observations: patch.observations ?? currentLedger.observations,
      evidenceGraph: currentLedger.evidenceGraph,
      discoveredFacts: patch.discoveredFacts ?? currentLedger.discoveredFacts,
      failedAttempts: patch.failedAttempts ?? currentLedger.failedAttempts,
      environmentState: patch.environmentState ?? currentLedger.environmentState,
      userInterruptions: patch.userInterruptions ?? currentLedger.userInterruptions,
      successCriteria: patch.successCriteria ?? currentLedger.successCriteria,
      structuredSuccessCriteria: patch.structuredSuccessCriteria ?? currentLedger.structuredSuccessCriteria,
      nextActionHint: patch.nextActionHint ?? currentLedger.nextActionHint
    },
    fallbackObjective
  );
}

export function buildTaskLedgerText(ledger: AgentTaskLedger): string {
  return JSON.stringify(ledger, null, 2);
}

export function buildToolObservationText(call: AgentMcpCallRecord, stringifyDisplayArguments: (value: Record<string, unknown> | undefined) => string): string {
  const resultText = String(call.resultText ?? "").trim();
  const truncatedResult =
    resultText.length > MAX_LEDGER_OBSERVATION_TEXT_LENGTH
      ? `${resultText.slice(0, MAX_LEDGER_OBSERVATION_TEXT_LENGTH)}...`
      : resultText;

  return [
    `round=${call.round}`,
    `server=${call.serverName}`,
    `tool=${call.toolName}`,
    `arguments=${stringifyDisplayArguments(call.arguments)}`,
    call.expectedOutcome ? `expectedOutcome=${call.expectedOutcome}` : "",
    call.verificationMethod ? `verificationMethod=${call.verificationMethod}` : "",
    call.isError ? `error=true` : "error=false",
    call.failureKind ? `failureKind=${call.failureKind}` : "",
    call.failureReason ? `failureReason=${call.failureReason}` : "",
    `result=${truncatedResult}`
  ]
    .filter(Boolean)
    .join("\n");
}

export function createObservationFromToolCall(call: AgentMcpCallRecord): AgentTaskLedgerObservation {
  const rawRef = `mcp:${call.round}:${call.serverId}:${call.toolName}:${call.createdAt}`;
  const resultSummary = truncateLedgerText(call.resultText, 320) || (call.isError ? "工具调用失败" : "工具调用完成");
  const evidenceRefs = [rawRef];

  if (call.artifacts?.length) {
    evidenceRefs.push(...call.artifacts.map((artifact) => `artifact:${artifact.id}`));
  }

  return {
    source: `${call.serverName} / ${call.toolName}`,
    rawRef,
    summary: resultSummary,
    durableFacts: call.isError ? [] : [resultSummary],
    ephemeralFacts: [
      call.expectedOutcome ? `预期结果：${call.expectedOutcome}` : "",
      call.verificationMethod ? `验证方式：${call.verificationMethod}` : ""
    ].filter(Boolean),
    evidenceRefs
  };
}

export function createEvidenceGraphFromToolCall(
  call: AgentMcpCallRecord,
  observation?: AgentTaskLedgerObservation
): AgentTaskLedgerEvidenceNode[] {
  return createEvidenceNodesFromToolCall(call, observation);
}

export function createDecisionMemoryFromToolCall(call: AgentMcpCallRecord): AgentTaskLedgerDecisionMemoryEntry | null {
  if (!call.isError) {
    return null;
  }

  const shouldAvoidRepeat = ["schema_mismatch", "tool_unavailable", "wrong_tool", "nonexistent_entity", "permission_denied"].includes(
    call.failureKind ?? ""
  );

  if (!shouldAvoidRepeat) {
    return null;
  }

  const rawRef = `mcp:${call.round}:${call.serverId}:${call.toolName}:${call.createdAt}`;
  const reason =
    truncateLedgerText(call.failureReason || call.resultText, 180) ||
    `工具失败分类：${call.failureKind ?? "unknown"}`;

  return {
    decision: `本任务内暂时放弃重复使用 ${call.serverName} / ${call.toolName} 的相同失败路线`,
    reason,
    confidence: 0.8,
    scope: "current_task",
    status: "active",
    evidenceRefs: [rawRef]
  };
}

export function appendLedgerObservation(ledger: AgentTaskLedger, observation: AgentTaskLedgerObservation): AgentTaskLedger {
  return normalizeAgentTaskLedger(
    {
      ...ledger,
      observations: [...ledger.observations, observation].slice(-MAX_LEDGER_OBSERVATION_ITEMS)
    },
    ledger.objective
  );
}

export function appendEvidenceGraph(
  ledger: AgentTaskLedger,
  evidenceNodes: AgentTaskLedgerEvidenceNode[] | AgentTaskLedgerEvidenceNode
): AgentTaskLedger {
  const nodes = Array.isArray(evidenceNodes) ? evidenceNodes : [evidenceNodes];

  if (!nodes.length) {
    return normalizeAgentTaskLedger(ledger, ledger.objective);
  }

  return normalizeAgentTaskLedger(
    {
      ...ledger,
      evidenceGraph: mergeEvidenceGraph(ledger.evidenceGraph, nodes)
    },
    ledger.objective
  );
}

export function appendDecisionMemory(
  ledger: AgentTaskLedger,
  decisionMemory: AgentTaskLedgerDecisionMemoryEntry | null
): AgentTaskLedger {
  if (!decisionMemory) {
    return normalizeAgentTaskLedger(ledger, ledger.objective);
  }

  return normalizeAgentTaskLedger(
    {
      ...ledger,
      decisionMemory: [...ledger.decisionMemory, decisionMemory].slice(-MAX_LEDGER_DECISION_MEMORY_ITEMS)
    },
    ledger.objective
  );
}

export function inferTaskPhaseAfterCall(ledger: AgentTaskLedger, call: AgentMcpCallRecord): AgentTaskPhase {
  if (call.isError) {
    return "recovering";
  }

  const hasPendingCriteria = ledger.structuredSuccessCriteria.some((criterion) => criterion.status === "pending" || criterion.status === "unknown");

  return hasPendingCriteria ? "verifying" : "finalizing";
}

export function verifyTaskLedgerSuccessCriteria(ledger: AgentTaskLedger, mcpCalls: AgentMcpCallRecord[]): AgentTaskLedger {
  const verificationResults = verifyCriteriaFromToolHistory(ledger.structuredSuccessCriteria, mcpCalls);
  const verifiedCriteria = verificationResults.map((result) => result.criterion);
  const hasFailed = verifiedCriteria.some((criterion) => criterion.status === "failed");
  const hasPending = getActiveVerificationCriteria(verifiedCriteria).length > 0;
  const taskPhase: AgentTaskPhase = hasFailed ? "recovering" : hasPending ? "verifying" : "finalizing";
  const verificationFacts = verificationResults
    .flatMap((result) => result.evidence.map((evidence) => `${evidence.reason}：${evidence.serverName} / ${evidence.toolName}`))
    .filter(Boolean);
  const verificationEvidenceNodes = createEvidenceNodesFromVerificationResults(verificationResults);

  return normalizeAgentTaskLedger(
    {
      ...ledger,
      taskPhase,
      discoveredFacts: [...ledger.discoveredFacts, ...verificationFacts],
      evidenceGraph: mergeEvidenceGraph(ledger.evidenceGraph, verificationEvidenceNodes),
      structuredSuccessCriteria: verifiedCriteria,
      nextActionHint: hasPending
        ? "仍有成功条件未被独立验证，最终回复需明确未验证状态或继续选择验证工具"
        : "结构化成功条件已通过，可进入最终整理"
    },
    ledger.objective
  );
}
