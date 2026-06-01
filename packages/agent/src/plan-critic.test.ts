import assert from "node:assert/strict";
import test from "node:test";

import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { critiqueMcpToolPlan } from "./plan-critic.js";

function createContextPacket(overrides: Partial<AgentContextPacket> = {}): AgentContextPacket {
  return {
    goal: {
      latestUserRequest: "继续推进",
      objective: "实现 Plan Critic",
      taskPhase: "executing"
    },
    constraints: [],
    plan: [],
    decisionMemory: [],
    evidence: {
      discoveredFacts: [],
      observations: [],
      evidenceGraph: [],
      environmentState: [],
      recentToolCalls: []
    },
    verification: {
      successCriteria: [],
      structuredSuccessCriteria: []
    },
    recovery: {
      failedAttempts: [],
      userInterruptions: []
    },
    openQuestions: [],
    recentConversation: [],
    ...overrides
  };
}

function createTool(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    serverId: "builtin:mcp:workspace",
    serverName: "Workspace Tools",
    name: "read_file",
    description: "Read a file from workspace",
    inputSchema: {
      type: "object"
    },
    ...overrides
  };
}

test("critiqueMcpToolPlan allows a complete low-risk plan", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket(),
    candidateTools: [createTool()],
    serverId: "builtin:mcp:workspace",
    toolName: "read_file",
    arguments: { path: "packages/agent/src/runtime.ts" },
    expectedOutcome: "runtime.ts content returned",
    verificationMethod: "tool result contains runtime code",
    reason: "读取相关文件",
    shouldCall: true
  });

  assert.equal(result.decision, "allow");
});

test("critiqueMcpToolPlan requests revision when expected outcome is missing", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket(),
    candidateTools: [createTool()],
    serverId: "builtin:mcp:workspace",
    toolName: "read_file",
    arguments: { path: "packages/agent/src/runtime.ts" },
    reason: "读取相关文件",
    shouldCall: true
  });

  assert.equal(result.decision, "revise");
  assert.ok(result.issues.includes("missing_expected_outcome"));
  assert.ok(result.issues.includes("missing_verification_method"));
});

test("critiqueMcpToolPlan requests revision when active decision memory rejects the route", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket({
      decisionMemory: [
        {
          decision: "本任务内暂时放弃重复使用 Workspace Tools / read_file 的相同失败路线",
          reason: "路径不存在",
          confidence: 0.8,
          scope: "current_task",
          status: "active",
          evidenceRefs: ["mcp:1"]
        }
      ]
    }),
    candidateTools: [createTool()],
    serverId: "builtin:mcp:workspace",
    toolName: "read_file",
    arguments: { path: "missing.ts" },
    expectedOutcome: "file content",
    verificationMethod: "tool result contains content",
    reason: "重试读取",
    shouldCall: true
  });

  assert.equal(result.decision, "revise");
  assert.ok(result.issues.includes("repeats_active_decision_memory"));
});

test("critiqueMcpToolPlan recognizes server id decision memory routes", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket({
      decisionMemory: [
        {
          decision: "avoid builtin:mcp:workspace:read_file until a corrected path is discovered",
          reason: "previous path lookup failed",
          confidence: 0.8,
          scope: "current_task",
          status: "active",
          evidenceRefs: ["mcp:1"]
        }
      ]
    }),
    candidateTools: [createTool()],
    serverId: "builtin:mcp:workspace",
    toolName: "read_file",
    arguments: { path: "missing.ts" },
    expectedOutcome: "file content",
    verificationMethod: "tool result contains content",
    reason: "retry read",
    shouldCall: true
  });

  assert.equal(result.decision, "revise");
  assert.ok(result.issues.includes("repeats_active_decision_memory"));
});

test("critiqueMcpToolPlan requests revision for high-risk tools during verification", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket({
      goal: {
        latestUserRequest: "验证结果",
        objective: "验证写入结果",
        taskPhase: "verifying"
      },
      verification: {
        successCriteria: [],
        structuredSuccessCriteria: [
          {
            type: "file_contains",
            expected: "context packet",
            status: "pending"
          }
        ]
      }
    }),
    candidateTools: [
      createTool({
        name: "write_file",
        description: "Write a file to workspace"
      })
    ],
    serverId: "builtin:mcp:workspace",
    toolName: "write_file",
    arguments: { path: "x.ts", content: "context packet" },
    expectedOutcome: "file written",
    verificationMethod: "file contains content",
    reason: "验证时写入",
    shouldCall: true
  });

  assert.equal(result.decision, "revise");
  assert.ok(result.issues.includes("high_risk_action_during_verification"));
});

test("critiqueMcpToolPlan stops invalid tool selections", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket(),
    candidateTools: [createTool()],
    serverId: "missing",
    toolName: "missing_tool",
    arguments: {},
    expectedOutcome: "ok",
    verificationMethod: "ok",
    reason: "invalid",
    shouldCall: true
  });

  assert.equal(result.decision, "stop");
});
