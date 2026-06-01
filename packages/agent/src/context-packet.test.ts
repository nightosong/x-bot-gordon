import assert from "node:assert/strict";
import test from "node:test";

import type { AgentMcpCallRecord, AgentTaskLedger } from "../../shared/src/index.js";
import { buildAgentContextPacket, buildAgentContextPacketText } from "./context-packet.js";
import { normalizeAgentTaskLedger } from "./ledger.js";

function createLedger(overrides: Partial<AgentTaskLedger> = {}): AgentTaskLedger {
  return normalizeAgentTaskLedger(
    {
      objective: "完成上下文工程改造",
      taskPhase: "planning",
      constraints: ["模型主导工具选择"],
      pendingSubtasks: ["接入 Context Packet"],
      activePlan: [
        {
          step: "实现 Context Packet",
          status: "in_progress"
        },
        {
          step: "运行测试",
          status: "pending"
        }
      ],
      decisionMemory: [
        {
          decision: "避免重复读取整个仓库",
          reason: "成本过高",
          confidence: 0.9,
          scope: "current_task",
          status: "active",
          evidenceRefs: ["mcp:1"]
        }
      ],
      discoveredFacts: ["runtime.ts 已有任务账本"],
      observations: [
        {
          source: "Workspace Tools / read_file",
          rawRef: "mcp:1",
          summary: "读取 runtime.ts",
          durableFacts: ["存在 buildContextualUserInput"],
          ephemeralFacts: [],
          evidenceRefs: ["mcp:1"]
        }
      ],
      structuredSuccessCriteria: [
        {
          type: "tool_result",
          expected: "test passed",
          status: "pending"
        }
      ],
      ...overrides
    },
    "完成上下文工程改造"
  );
}

function createCallRecord(overrides: Partial<AgentMcpCallRecord> = {}): AgentMcpCallRecord {
  return {
    round: 1,
    serverId: "builtin:mcp:workspace",
    serverName: "Workspace Tools",
    toolName: "read_file",
    arguments: { path: "packages/agent/src/runtime.ts" },
    resultText: "runtime content",
    isError: false,
    autoSelected: true,
    attemptCount: 1,
    recovered: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

test("buildAgentContextPacket groups goal, evidence, recovery and open questions", () => {
  const packet = buildAgentContextPacket({
    userInput: "继续推进",
    conversationMessages: [
      { role: "user", content: "先做 Decision Memory" },
      { role: "assistant", content: "已经完成" }
    ],
    taskLedger: createLedger(),
    mcpCalls: [createCallRecord()]
  });

  assert.equal(packet.goal.latestUserRequest, "继续推进");
  assert.equal(packet.goal.objective, "完成上下文工程改造");
  assert.equal(packet.plan.length, 2);
  assert.equal(packet.decisionMemory[0]?.decision, "避免重复读取整个仓库");
  assert.equal(packet.evidence.discoveredFacts[0], "runtime.ts 已有任务账本");
  assert.equal(packet.evidence.recentToolCalls[0]?.serverId, "builtin:mcp:workspace");
  assert.equal(packet.evidence.recentToolCalls[0]?.toolName, "read_file");
  assert.match(packet.openQuestions[0] ?? "", /待验证成功条件/);
  assert.equal(packet.recentConversation.length, 2);
});

test("buildAgentContextPacket trims recent conversation and tool history", () => {
  const packet = buildAgentContextPacket({
    userInput: "继续",
    conversationMessages: Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message-${index}`
    })),
    taskLedger: createLedger(),
    mcpCalls: Array.from({ length: 8 }, (_, index) =>
      createCallRecord({
        round: index + 1,
        toolName: `tool_${index}`
      })
    )
  });

  assert.equal(packet.recentConversation.length, 6);
  assert.equal(packet.recentConversation[0]?.content, "message-2");
  assert.equal(packet.evidence.recentToolCalls.length, 6);
  assert.equal(packet.evidence.recentToolCalls[0]?.toolName, "tool_2");
});

test("buildAgentContextPacketText returns JSON context", () => {
  const packet = buildAgentContextPacket({
    userInput: "继续",
    conversationMessages: [],
    taskLedger: createLedger(),
    mcpCalls: []
  });
  const parsed = JSON.parse(buildAgentContextPacketText(packet)) as { goal?: { objective?: string } };

  assert.equal(parsed.goal?.objective, "完成上下文工程改造");
});
