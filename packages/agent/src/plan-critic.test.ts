import assert from "node:assert/strict";
import test from "node:test";

import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { critiqueMcpToolPlan } from "./plan-critic.js";
import { buildAgentResourceContext } from "./resource-registry.js";

function createContextPacket(overrides: Partial<AgentContextPacket> = {}): AgentContextPacket {
  return {
    goal: {
      latestUserRequest: "继续推进",
      objective: "实现 Plan Critic",
      taskPhase: "executing"
    },
    resources: buildAgentResourceContext({
      userInput: "继续推进 Plan Critic 代码实现",
      conversationMessages: [],
      taskLedger: {
        taskPhase: "executing",
        objective: "实现 Plan Critic",
        constraints: [],
        completedSubtasks: [],
        pendingSubtasks: [],
        activePlan: [],
        decisionTrace: [],
        decisionMemory: [],
        observations: [],
        evidenceGraph: [],
        discoveredFacts: [],
        failedAttempts: [],
        environmentState: [],
        userInterruptions: [],
        successCriteria: [],
        structuredSuccessCriteria: []
      },
      mcpCalls: []
    }),
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

test("critiqueMcpToolPlan allows high-risk tools because execution permission handles approval", () => {
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

  assert.equal(result.decision, "allow");
});

test("critiqueMcpToolPlan allows state-changing tools during execution even with pending criteria", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket({
      goal: {
        latestUserRequest: "写回漫画项目",
        objective: "更新丹青溢彩项目 OVERVIEW",
        taskPhase: "executing"
      },
      verification: {
        successCriteria: [],
        structuredSuccessCriteria: [
          {
            type: "tool_result",
            target: "comic_update_project_fields",
            expected: "applied=true",
            verificationMethod: "工具结果 applied 为 true",
            status: "pending"
          }
        ]
      }
    }),
    candidateTools: [
      createTool({
        serverId: "builtin:mcp:application-tools",
        serverName: "Application Tools",
        name: "comic_update_project_fields",
        description: "写回丹青溢彩漫画项目级字段"
      })
    ],
    serverId: "builtin:mcp:application-tools",
    toolName: "comic_update_project_fields",
    arguments: { projectIdOrTitle: "寂寞青梅", summary: "更新", dryRun: false },
    expectedOutcome: "项目字段写回成功",
    verificationMethod: "读回项目字段确认内容",
    reason: "用户明确要求写回",
    shouldCall: true
  });

  assert.equal(result.decision, "allow");
});

test("critiqueMcpToolPlan allows high-risk recovery tools so executor can request permission", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket({
      goal: {
        latestUserRequest: "继续写回资产",
        objective: "恢复丹青溢彩项目字段写入",
        taskPhase: "recovering"
      },
      recovery: {
        failedAttempts: [
          {
            action: "第一次写回项目字段",
            reason: "permission required",
            category: "permission_denied"
          }
        ],
        userInterruptions: []
      }
    }),
    candidateTools: [
      createTool({
        serverId: "builtin:mcp:application-tools",
        serverName: "Application Tools",
        name: "comic_update_project_fields",
        description: "写回丹青溢彩漫画项目级字段"
      })
    ],
    serverId: "builtin:mcp:application-tools",
    toolName: "comic_update_project_fields",
    arguments: { projectIdOrTitle: "寂寞青梅", summary: "恢复写入", dryRun: false },
    expectedOutcome: "项目字段写回成功",
    verificationMethod: "读回项目字段确认内容",
    reason: "用户要求继续执行写回",
    shouldCall: true
  });

  assert.equal(result.decision, "allow");
  assert.deepEqual(result.issues, []);
});

test("critiqueMcpToolPlan requires external evidence for current official pricing questions", () => {
  const result = critiqueMcpToolPlan({
    contextPacket: createContextPacket({
      goal: {
        latestUserRequest: "帮我联网查一下 Anthropic Claude 最新官方 API 价格",
        objective: "确认 Anthropic Claude 最新官网价格",
        taskPhase: "planning"
      }
    }),
    candidateTools: [
      createTool({
        serverId: "builtin:mcp:search-tools",
        serverName: "Search Tools",
        name: "web_research",
        description: "复合联网研究，适合最新事实、官方文档和带来源结论。"
      })
    ],
    serverId: null,
    toolName: null,
    arguments: {},
    reason: "可以基于已有知识回答",
    shouldCall: false
  });

  assert.equal(result.decision, "revise");
  assert.ok(result.issues.includes("missing_required_external_evidence"));
  assert.match(result.revisionHint ?? "", /web_research/u);
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
