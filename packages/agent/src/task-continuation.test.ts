import assert from "node:assert/strict";
import test from "node:test";

import type { AgentTaskLedger } from "../../shared/src/index.js";
import {
  assessTaskContinuation,
  mergeLedgerForContinuation
} from "./task-continuation.js";

function createLedger(overrides: Partial<AgentTaskLedger> = {}): AgentTaskLedger {
  return {
    taskPhase: "executing",
    objective: "修复 README 检查任务",
    constraints: [],
    completedSubtasks: ["已确认需要检查 workspace"],
    pendingSubtasks: ["读取 README 文件确认是否存在"],
    activePlan: [
      {
        step: "读取 README",
        toolHint: "Workspace Tools / read_file",
        successCriteria: "工具返回 README 内容或不存在错误",
        status: "pending"
      }
    ],
    decisionTrace: [],
    decisionMemory: [],
    observations: [],
    evidenceGraph: [],
    discoveredFacts: [],
    failedAttempts: [],
    environmentState: [],
    userInterruptions: [],
    successCriteria: ["确认 README 状态"],
    structuredSuccessCriteria: [
      {
        type: "tool_result",
        target: "read_file",
        expected: "README 文件内容或不存在状态",
        verificationMethod: "读取 README",
        status: "pending"
      }
    ],
    nextActionHint: "读取 README 文件确认是否存在",
    ...overrides
  };
}

test("assessTaskContinuation detects continue phrase with actionable ledger", () => {
  const decision = assessTaskContinuation({
    userInput: "继续",
    previousLedger: createLedger()
  });

  assert.equal(decision.mode, "continuation");
  assert.equal(decision.shouldSkipGenericPlanner, true);
  assert.match(decision.nextActionHint ?? "", /README/u);
});

test("assessTaskContinuation treats direction change as planner work", () => {
  const decision = assessTaskContinuation({
    userInput: "不要继续，改成帮我搜索最新价格",
    previousLedger: createLedger()
  });

  assert.equal(decision.mode, "direction_change");
  assert.equal(decision.shouldSkipGenericPlanner, false);
});

test("assessTaskContinuation treats concrete new request as new task", () => {
  const decision = assessTaskContinuation({
    userInput: "帮我实现登录功能",
    previousLedger: createLedger()
  });

  assert.equal(decision.mode, "new_task");
  assert.equal(decision.shouldSkipGenericPlanner, false);
});

test("assessTaskContinuation treats lightweight guidance with concrete objective as new task", () => {
  const decision = assessTaskContinuation({
    userInput: "然后帮我实现登录功能",
    previousLedger: createLedger()
  });

  assert.equal(decision.mode, "new_task");
  assert.equal(decision.shouldSkipGenericPlanner, false);
});

test("mergeLedgerForContinuation preserves previous next action", () => {
  const ledger = createLedger();
  const decision = assessTaskContinuation({
    userInput: "继续",
    previousLedger: ledger
  });
  const merged = mergeLedgerForContinuation({
    previousLedger: ledger,
    userInput: "继续",
    decision
  });

  assert.equal(merged?.objective, "修复 README 检查任务");
  assert.equal(merged?.nextActionHint, "读取 README 文件确认是否存在");
  assert.ok(merged?.userInterruptions.some((item) => item.includes("继续")));
});

test("mergeLedgerForContinuation does not carry old ledger into new tasks", () => {
  const ledger = createLedger();
  const decision = assessTaskContinuation({
    userInput: "然后帮我实现登录功能",
    previousLedger: ledger
  });
  const merged = mergeLedgerForContinuation({
    previousLedger: ledger,
    userInput: "然后帮我实现登录功能",
    decision
  });

  assert.equal(merged, null);
});
