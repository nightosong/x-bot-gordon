import type { AgentTaskLedger } from "../../shared/src/index.js";

export type AgentTaskContinuationMode = "new_task" | "continuation" | "direction_change";

export interface AgentTaskContinuationDecision {
  mode: AgentTaskContinuationMode;
  confidence: number;
  reason: string;
  shouldSkipGenericPlanner: boolean;
  nextActionHint?: string;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function hasPendingTaskState(ledger: AgentTaskLedger | null | undefined): boolean {
  if (!ledger) {
    return false;
  }

  if (ledger.pendingSubtasks.some((item) => normalizeText(item))) {
    return true;
  }

  if (ledger.activePlan.some((step) => step.status === "pending" || step.status === "in_progress" || step.status === "blocked")) {
    return true;
  }

  if (ledger.structuredSuccessCriteria.some((criterion) => criterion.status === "pending" || criterion.status === "unknown")) {
    return true;
  }

  if (normalizeText(ledger.nextActionHint)) {
    return true;
  }

  return ledger.taskPhase !== "finalizing";
}

function hasActionableLedgerHint(ledger: AgentTaskLedger | null | undefined): boolean {
  if (!ledger) {
    return false;
  }

  const combined = [
    ledger.nextActionHint,
    ...ledger.pendingSubtasks,
    ...ledger.activePlan.map((step) => `${step.step} ${step.toolHint ?? ""} ${step.successCriteria ?? ""}`),
    ...ledger.structuredSuccessCriteria.map(
      (criterion) => `${criterion.type} ${criterion.target ?? ""} ${criterion.expected} ${criterion.verificationMethod ?? ""}`
    )
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");

  return /读取|检查|搜索|查找|运行|执行|修改|写回|保存|生成|查询|轮询|验证|read|inspect|search|run|execute|update|write|save|generate|query|poll|verify|tool|工具/u.test(
    combined
  );
}

function isContinuationPhrase(text: string): boolean {
  return /^(?:继续|继续吧|继续执行|继续下一步|下一步|接着做|接着来|往下做|把剩下的做完|继续修|继续改|继续处理|按计划继续|按这个继续|可以继续|go on|continue|next)$/iu.test(
    text
  );
}

function isLightweightGuidance(text: string): boolean {
  if (!text || text.length > 120) {
    return false;
  }

  return /^(?:继续|接着|然后|下一步|把剩下|按计划|照这个|按这个|可以|好的|好|ok|OK|yes|Yes)/u.test(text);
}

function hasConcreteTaskSignal(text: string): boolean {
  return /(?:帮我|请|需要|把|给我|创建|新增|实现|修复|重构|查询|搜索|生成|写|改|读|检查|打开|运行|分析|总结|对比|查一下|look up|search|create|implement|fix|refactor|generate|analyze)/iu.test(
    text
  );
}

function isDirectionChange(text: string): boolean {
  return /(?:不要继续|先别|停一下|暂停|换个方向|改成|重新来|重做|从头|先做别的|不要.*按|别.*继续|instead|change direction|start over|new task)/iu.test(
    text
  );
}

function looksLikeNewConcreteTask(text: string): boolean {
  if (!text) {
    return false;
  }

  if (isContinuationPhrase(text)) {
    return false;
  }

  if (isLightweightGuidance(text) && !hasConcreteTaskSignal(text)) {
    return false;
  }

  return hasConcreteTaskSignal(text);
}

export function assessTaskContinuation(input: {
  userInput: string;
  previousLedger?: AgentTaskLedger | null;
}): AgentTaskContinuationDecision {
  const text = normalizeText(input.userInput);
  const previousLedger = input.previousLedger ?? null;

  if (!previousLedger || !hasPendingTaskState(previousLedger)) {
    return {
      mode: "new_task",
      confidence: 0.9,
      reason: previousLedger ? "上一轮任务账本没有可延续的未完成状态" : "没有上一轮任务账本",
      shouldSkipGenericPlanner: false
    };
  }

  if (isDirectionChange(text)) {
    return {
      mode: "direction_change",
      confidence: 0.9,
      reason: "用户输入包含明确转向或停止继续的信号",
      shouldSkipGenericPlanner: false
    };
  }

  if (isContinuationPhrase(text) || (isLightweightGuidance(text) && !looksLikeNewConcreteTask(text))) {
    const actionable = hasActionableLedgerHint(previousLedger);

    return {
      mode: "continuation",
      confidence: actionable ? 0.86 : 0.68,
      reason: actionable ? "用户输入是延续任务，且上一轮账本包含可执行下一步" : "用户输入是延续任务，但上一轮账本缺少明确可执行下一步",
      shouldSkipGenericPlanner: actionable,
      ...(previousLedger.nextActionHint ? { nextActionHint: previousLedger.nextActionHint } : {})
    };
  }

  if (looksLikeNewConcreteTask(text)) {
    return {
      mode: "new_task",
      confidence: 0.76,
      reason: "用户输入包含新的具体目标，需重新规划",
      shouldSkipGenericPlanner: false
    };
  }

  return {
    mode: "new_task",
    confidence: 0.55,
    reason: "未命中明确延续信号，默认按新输入规划",
    shouldSkipGenericPlanner: false
  };
}

export function mergeLedgerForContinuation(input: {
  previousLedger?: AgentTaskLedger | null;
  userInput: string;
  decision: AgentTaskContinuationDecision;
}): AgentTaskLedger | null {
  const previousLedger = input.previousLedger ?? null;

  if (!previousLedger) {
    return null;
  }

  const userInput = normalizeText(input.userInput);
  const userInterruptions = userInput
    ? [...(previousLedger.userInterruptions ?? []), `本轮继续请求：${userInput}`]
    : [...(previousLedger.userInterruptions ?? [])];

  if (input.decision.mode === "continuation") {
    const taskPhase =
      previousLedger.taskPhase === "finalizing" || previousLedger.taskPhase === "recovering"
        ? "planning"
        : previousLedger.taskPhase;

    return {
      ...previousLedger,
      taskPhase,
      userInterruptions,
      nextActionHint: previousLedger.nextActionHint || input.decision.nextActionHint
    };
  }

  return null;
}
