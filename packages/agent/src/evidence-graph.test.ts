import assert from "node:assert/strict";
import test from "node:test";

import type { AgentMcpCallRecord } from "../../shared/src/index.js";
import {
  createEvidenceNodeFromVerificationEvaluation,
  createEvidenceNodesFromToolCall,
  createEvidenceNodesFromVerificationResults,
  mergeEvidenceGraph,
  normalizeEvidenceGraph
} from "./evidence-graph.js";

function createCallRecord(overrides: Partial<AgentMcpCallRecord> = {}): AgentMcpCallRecord {
  return {
    round: 1,
    serverId: "builtin:mcp:workspace",
    serverName: "Workspace Tools",
    toolName: "read_file",
    arguments: {},
    resultText: "runtime.ts contains Plan Critic",
    isError: false,
    autoSelected: true,
    attemptCount: 1,
    recovered: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

test("normalizeEvidenceGraph trims and deduplicates evidence nodes", () => {
  const nodes = normalizeEvidenceGraph([
    {
      id: " evidence:1 ",
      kind: "tool_result",
      claim: " runtime.ts contains Plan Critic ",
      source: " Workspace Tools / read_file ",
      evidenceRefs: [" mcp:1 "],
      confidence: 2,
      durability: "durable",
      createdAt: "2026-06-01T00:00:00.000Z"
    },
    {
      id: "evidence:1",
      kind: "invalid",
      claim: "newer claim",
      source: "Workspace Tools / read_file",
      confidence: 0.2,
      durability: "invalid",
      createdAt: "2026-06-01T00:00:01.000Z"
    }
  ]);

  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.claim, "newer claim");
  assert.equal(nodes[0]?.kind, "fact");
  assert.equal(nodes[0]?.confidence, 0.2);
  assert.equal(nodes[0]?.durability, "durable");
});

test("createEvidenceNodesFromToolCall creates tool, fact and artifact nodes", () => {
  const nodes = createEvidenceNodesFromToolCall(
    createCallRecord({
      artifacts: [
        {
          id: "artifact_1",
          kind: "image",
          title: "poster"
        }
      ]
    }),
    {
      source: "Workspace Tools / read_file",
      rawRef: "mcp:1",
      summary: "读取 runtime.ts",
      durableFacts: ["runtime.ts contains Plan Critic"],
      ephemeralFacts: [],
      evidenceRefs: ["mcp:1:builtin:mcp:workspace:read_file:2026-06-01T00:00:00.000Z"]
    }
  );

  assert.equal(nodes.length, 3);
  assert.ok(nodes.some((node) => node.kind === "file_ref"));
  assert.ok(nodes.some((node) => node.kind === "fact" && node.claim === "runtime.ts contains Plan Critic"));
  assert.ok(nodes.some((node) => node.kind === "artifact" && node.evidenceRefs.includes("artifact:artifact_1")));
});

test("createEvidenceNodesFromVerificationResults stores verification claims", () => {
  const nodes = createEvidenceNodesFromVerificationResults(
    [
      {
        criterion: {
          type: "file_contains",
          expected: "Plan Critic",
          status: "passed"
        },
        evidence: [
          {
            callRef: "mcp:1:builtin:mcp:workspace:read_file:2026-06-01T00:00:00.000Z",
            serverName: "Workspace Tools",
            toolName: "read_file",
            reason: "文件相关工具结果匹配成功条件"
          }
        ]
      }
    ],
    "2026-06-01T00:00:01.000Z"
  );

  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.kind, "verification");
  assert.equal(nodes[0]?.confidence, 0.9);
  assert.match(nodes[0]?.claim ?? "", /Plan Critic/u);
});

test("createEvidenceNodeFromVerificationEvaluation records quality evidence", () => {
  const node = createEvidenceNodeFromVerificationEvaluation(
    {
      qualityScore: 90,
      riskLevel: "low",
      evidenceGrade: "direct",
      passedCriteria: 1,
      failedCriteria: 0,
      remainingCriteria: 0,
      matchedStrategy: true,
      summary: "主动验证评分 90/100；证据=direct"
    },
    createCallRecord()
  );

  assert.equal(node.kind, "verification");
  assert.equal(node.confidence, 0.9);
  assert.equal(node.durability, "durable");
});

test("mergeEvidenceGraph keeps latest nodes under the cap", () => {
  const current = normalizeEvidenceGraph(
    Array.from({ length: 10 }, (_, index) => ({
      id: `node:${index}`,
      kind: "fact",
      claim: `claim ${index}`,
      source: "test",
      evidenceRefs: [`ref:${index}`],
      confidence: 0.5,
      durability: "durable",
      createdAt: "2026-06-01T00:00:00.000Z"
    }))
  );
  const merged = mergeEvidenceGraph(current, [
    {
      id: "node:10",
      kind: "fact",
      claim: "claim 10",
      source: "test",
      evidenceRefs: ["ref:10"],
      confidence: 0.5,
      durability: "durable",
      createdAt: "2026-06-01T00:00:00.000Z"
    },
    {
      id: "node:11",
      kind: "fact",
      claim: "claim 11",
      source: "test",
      evidenceRefs: ["ref:11"],
      confidence: 0.5,
      durability: "durable",
      createdAt: "2026-06-01T00:00:00.000Z"
    },
    {
      id: "node:12",
      kind: "fact",
      claim: "claim 12",
      source: "test",
      evidenceRefs: ["ref:12"],
      confidence: 0.5,
      durability: "durable",
      createdAt: "2026-06-01T00:00:00.000Z"
    }
  ]);

  assert.equal(merged.length, 12);
  assert.equal(merged[0]?.id, "node:1");
  assert.equal(merged.at(-1)?.id, "node:12");
});
