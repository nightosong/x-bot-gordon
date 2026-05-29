import assert from "node:assert/strict";
import test from "node:test";

import type { AgentMcpCallRecord } from "../../shared/src/index.js";
import {
  createInitialTaskLedger,
  mergeAgentTaskLedgerPatch,
  normalizeAgentTaskLedger,
  verifyTaskLedgerSuccessCriteria
} from "./ledger.js";

function createCallRecord(overrides: Partial<AgentMcpCallRecord> = {}): AgentMcpCallRecord {
  return {
    round: 1,
    serverId: "builtin:mcp:workspace",
    serverName: "Workspace Tools",
    toolName: "read_file",
    arguments: {},
    resultText: "ok",
    isError: false,
    autoSelected: true,
    attemptCount: 1,
    recovered: false,
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides
  };
}

test("normalizeAgentTaskLedger trims and deduplicates stable ledger fields", () => {
  const ledger = normalizeAgentTaskLedger(
    {
      objective: "  Ship Gordon runtime  ",
      taskPhase: "executing",
      constraints: [" keep model-led ", "keep model-led", ""],
      pendingSubtasks: ["write tests"],
      structuredSuccessCriteria: [
        {
          type: "tool_result",
          expected: "tests passed",
          status: "pending"
        }
      ]
    },
    "fallback"
  );

  assert.equal(ledger.objective, "Ship Gordon runtime");
  assert.equal(ledger.taskPhase, "executing");
  assert.deepEqual(ledger.constraints, ["keep model-led"]);
  assert.equal(ledger.pendingSubtasks[0], "write tests");
  assert.equal(ledger.structuredSuccessCriteria[0]?.status, "pending");
});

test("mergeAgentTaskLedgerPatch preserves fields absent from patch", () => {
  const ledger = createInitialTaskLedger("实现 Agent runtime", { name: "code-guidelines" });
  const merged = mergeAgentTaskLedgerPatch(
    ledger,
    {
      taskPhase: "executing",
      completedSubtasks: ["完成模块化拆分"],
      nextActionHint: "继续补测试"
    },
    "fallback"
  );

  assert.equal(merged.taskPhase, "executing");
  assert.deepEqual(merged.completedSubtasks, ["完成模块化拆分"]);
  assert.deepEqual(merged.constraints, ledger.constraints);
  assert.deepEqual(merged.activePlan, ledger.activePlan);
  assert.equal(merged.nextActionHint, "继续补测试");
});

test("verifyTaskLedgerSuccessCriteria updates ledger phase and stores verification facts", () => {
  const ledger = normalizeAgentTaskLedger(
    {
      objective: "验证执行结果",
      structuredSuccessCriteria: [
        {
          type: "tool_result",
          target: "Workspace Tools",
          expected: "file read",
          status: "pending"
        }
      ]
    },
    "验证执行结果"
  );
  const verified = verifyTaskLedgerSuccessCriteria(ledger, [
    createCallRecord({
      serverName: "Workspace Tools",
      toolName: "read_file",
      resultText: "file read"
    })
  ]);

  assert.equal(verified.structuredSuccessCriteria[0]?.status, "passed");
  assert.equal(verified.taskPhase, "finalizing");
  assert.deepEqual(verified.discoveredFacts, ["工具结果匹配成功条件：Workspace Tools / read_file"]);
});

test("verifyTaskLedgerSuccessCriteria fails missing tool result when a tool already errored", () => {
  const ledger = normalizeAgentTaskLedger(
    {
      objective: "读取文件",
      structuredSuccessCriteria: [
        {
          type: "tool_result",
          expected: "file content",
          status: "pending"
        }
      ]
    },
    "读取文件"
  );
  const verified = verifyTaskLedgerSuccessCriteria(ledger, [
    createCallRecord({
      isError: true,
      resultText: "tool failed"
    })
  ]);

  assert.equal(verified.structuredSuccessCriteria[0]?.status, "failed");
  assert.equal(verified.taskPhase, "recovering");
});
