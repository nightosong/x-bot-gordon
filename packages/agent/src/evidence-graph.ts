import type {
  AgentMcpCallRecord,
  AgentTaskLedgerEvidenceNode,
  AgentTaskLedgerObservation
} from "../../shared/src/index.js";
import type { AgentActiveVerificationEvaluation, AgentCriterionVerificationResult } from "./verifier.js";

const MAX_EVIDENCE_CLAIM_LENGTH = 280;
const MAX_EVIDENCE_SOURCE_LENGTH = 140;
const MAX_EVIDENCE_NODES = 12;

function truncateEvidenceText(value: unknown, maxLength = MAX_EVIDENCE_CLAIM_LENGTH): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function clampConfidence(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.min(1, numericValue)) : 0.5;
}

function buildCallEvidenceRef(call: AgentMcpCallRecord): string {
  return `mcp:${call.round}:${call.serverId}:${call.toolName}:${call.createdAt}`;
}

function buildEvidenceId(prefix: string, value: string): string {
  return `${prefix}:${value.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140) || "unknown"}`;
}

function inferToolResultKind(call: AgentMcpCallRecord): AgentTaskLedgerEvidenceNode["kind"] {
  if (/file|path|read|search|diff|inspect/i.test(`${call.serverName} ${call.toolName}`)) {
    return "file_ref";
  }

  return "tool_result";
}

export function normalizeEvidenceGraph(value: unknown): AgentTaskLedgerEvidenceNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validKinds = new Set(["fact", "artifact", "tool_result", "file_ref", "verification"]);
  const validDurability = new Set(["durable", "ephemeral"]);
  const nodes = new Map<string, AgentTaskLedgerEvidenceNode>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const id = truncateEvidenceText(record.id, 180);
    const claim = truncateEvidenceText(record.claim);
    const source = truncateEvidenceText(record.source, MAX_EVIDENCE_SOURCE_LENGTH);
    const rawKind = typeof record.kind === "string" ? record.kind.trim() : "";
    const rawDurability = typeof record.durability === "string" ? record.durability.trim() : "";
    const createdAt = truncateEvidenceText(record.createdAt, 80) || new Date(0).toISOString();
    const evidenceRefs = Array.isArray(record.evidenceRefs)
      ? record.evidenceRefs.map((ref) => truncateEvidenceText(ref, 180)).filter(Boolean).slice(0, 8)
      : [];

    if (!id || !claim || !source) {
      continue;
    }

    nodes.set(id, {
      id,
      kind: validKinds.has(rawKind) ? (rawKind as AgentTaskLedgerEvidenceNode["kind"]) : "fact",
      claim,
      source,
      evidenceRefs,
      confidence: clampConfidence(record.confidence),
      durability: validDurability.has(rawDurability) ? (rawDurability as AgentTaskLedgerEvidenceNode["durability"]) : "durable",
      createdAt
    });
  }

  return [...nodes.values()].slice(-MAX_EVIDENCE_NODES);
}

export function mergeEvidenceGraph(
  currentValue: AgentTaskLedgerEvidenceNode[],
  patchValue: AgentTaskLedgerEvidenceNode[] | undefined
): AgentTaskLedgerEvidenceNode[] {
  if (!patchValue) {
    return currentValue;
  }

  return normalizeEvidenceGraph([...currentValue, ...patchValue]);
}

export function createEvidenceNodesFromToolCall(
  call: AgentMcpCallRecord,
  observation?: AgentTaskLedgerObservation
): AgentTaskLedgerEvidenceNode[] {
  const callRef = buildCallEvidenceRef(call);
  const source = `${call.serverName} / ${call.toolName}`;
  const summary = observation?.summary || call.resultText || (call.isError ? "工具调用失败" : "工具调用完成");
  const claimPrefix = call.isError ? "工具调用失败" : "工具调用结果";
  const baseNode: AgentTaskLedgerEvidenceNode = {
    id: buildEvidenceId("tool", callRef),
    kind: inferToolResultKind(call),
    claim: truncateEvidenceText(`${claimPrefix}：${summary}`),
    source: truncateEvidenceText(source, MAX_EVIDENCE_SOURCE_LENGTH),
    evidenceRefs: observation?.evidenceRefs?.length ? observation.evidenceRefs : [callRef],
    confidence: call.isError ? 0.3 : 0.75,
    durability: call.isError ? "ephemeral" : "durable",
    createdAt: call.createdAt
  };
  const factNodes = (observation?.durableFacts ?? []).map((fact, index) => ({
    id: buildEvidenceId("fact", `${callRef}:${index}:${fact}`),
    kind: "fact" as const,
    claim: truncateEvidenceText(fact),
    source: truncateEvidenceText(source, MAX_EVIDENCE_SOURCE_LENGTH),
    evidenceRefs: observation?.evidenceRefs?.length ? observation.evidenceRefs : [callRef],
    confidence: call.isError ? 0.3 : 0.8,
    durability: "durable" as const,
    createdAt: call.createdAt
  }));
  const artifactNodes = (call.artifacts ?? []).map((artifact) => ({
    id: buildEvidenceId("artifact", `${callRef}:${artifact.id}`),
    kind: "artifact" as const,
    claim: truncateEvidenceText(`生成 artifact：${artifact.kind} / ${artifact.title}`),
    source: truncateEvidenceText(source, MAX_EVIDENCE_SOURCE_LENGTH),
    evidenceRefs: [callRef, `artifact:${artifact.id}`],
    confidence: call.isError ? 0.3 : 0.9,
    durability: "durable" as const,
    createdAt: call.createdAt
  }));

  return normalizeEvidenceGraph([baseNode, ...factNodes, ...artifactNodes]);
}

export function createEvidenceNodesFromVerificationResults(
  verificationResults: AgentCriterionVerificationResult[],
  createdAt = new Date().toISOString()
): AgentTaskLedgerEvidenceNode[] {
  return normalizeEvidenceGraph(
    verificationResults.flatMap((result) =>
      result.evidence.map((evidence, index) => ({
        id: buildEvidenceId("verification", `${evidence.callRef}:${result.criterion.type}:${index}:${evidence.reason}`),
        kind: "verification",
        claim: truncateEvidenceText(`${evidence.reason}：${result.criterion.expected}`),
        source: truncateEvidenceText(`${evidence.serverName} / ${evidence.toolName}`, MAX_EVIDENCE_SOURCE_LENGTH),
        evidenceRefs: [evidence.callRef],
        confidence: result.criterion.status === "passed" ? 0.9 : result.criterion.status === "failed" ? 0.65 : 0.45,
        durability: "durable",
        createdAt
      }))
    )
  );
}

export function createEvidenceNodeFromVerificationEvaluation(
  evaluation: AgentActiveVerificationEvaluation,
  call: AgentMcpCallRecord
): AgentTaskLedgerEvidenceNode {
  const callRef = buildCallEvidenceRef(call);
  return {
    id: buildEvidenceId("verification-evaluation", `${callRef}:${evaluation.qualityScore}:${evaluation.evidenceGrade}`),
    kind: "verification",
    claim: truncateEvidenceText(evaluation.summary),
    source: truncateEvidenceText(`${call.serverName} / ${call.toolName}`, MAX_EVIDENCE_SOURCE_LENGTH),
    evidenceRefs: [callRef],
    confidence: evaluation.evidenceGrade === "direct" ? 0.9 : evaluation.evidenceGrade === "weak" ? 0.6 : 0.35,
    durability: evaluation.evidenceGrade === "none" ? "ephemeral" : "durable",
    createdAt: call.createdAt
  };
}
