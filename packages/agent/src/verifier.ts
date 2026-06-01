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

type ActiveVerificationCriterionType =
  | "tool_result"
  | "file_contains"
  | "url_opened"
  | "command_passed"
  | "ui_state"
  | "artifact_created";

export interface AgentActiveVerificationStrategy {
  criterion: Pick<AgentTaskLedgerSuccessCriterion, "type" | "target" | "expected" | "verificationMethod" | "status">;
  intent: string;
  preferredCapabilities: string[];
  preferredExecutionDomains: string[];
  riskBoundary: string;
  avoidCapabilities: string[];
  argumentHints: string[];
  evidenceRequirements: string[];
  failureSignals: string[];
}

const ACTIVE_VERIFICATION_TYPES = new Set<ActiveVerificationCriterionType>([
  "tool_result",
  "file_contains",
  "url_opened",
  "command_passed",
  "ui_state",
  "artifact_created"
]);

function isActiveVerificationCriterionType(
  type: AgentTaskLedgerSuccessCriterion["type"]
): type is ActiveVerificationCriterionType {
  return ACTIVE_VERIFICATION_TYPES.has(type as ActiveVerificationCriterionType);
}

const ACTIVE_VERIFICATION_STRATEGIES: Record<
  ActiveVerificationCriterionType,
  Omit<AgentActiveVerificationStrategy, "criterion" | "argumentHints">
> = {
  tool_result: {
    intent: "验证已有或新调用的工具结果是否满足目标",
    preferredCapabilities: ["read", "verify"],
    preferredExecutionDomains: ["workspace", "web_research", "desktop", "application_asset", "external_mcp"],
    riskBoundary: "优先低风险或中风险读取/检查类工具；不要为了验证重新执行高副作用动作",
    avoidCapabilities: ["write", "execute", "generate"],
    evidenceRequirements: ["工具返回必须能直接匹配 target 或 expected", "记录 serverName、toolName 和关键返回摘要"],
    failureSignals: ["工具返回为空", "工具返回与 target/expected 无关", "工具调用失败且没有其他成功证据"]
  },
  file_contains: {
    intent: "验证指定文件或路径内容是否包含预期文本、结构或状态",
    preferredCapabilities: ["read", "search", "verify"],
    preferredExecutionDomains: ["workspace"],
    riskBoundary: "只选择读取、搜索、inspect 或 diff 类工具；不要写入、移动、删除或格式化文件",
    avoidCapabilities: ["write", "execute", "generate"],
    evidenceRequirements: ["返回中应包含文件路径或可定位引用", "返回中应包含 expected 的匹配片段或结构化检查结果"],
    failureSignals: ["文件不存在", "目标路径不明确", "读取结果不含 expected", "工具只能写入不能读取"]
  },
  url_opened: {
    intent: "验证目标 URL、页面标题、当前地址或页面可见状态是否符合预期",
    preferredCapabilities: ["read", "search", "verify"],
    preferredExecutionDomains: ["web_research", "desktop"],
    riskBoundary: "优先页面读取、浏览器状态读取或 URL 状态检查；打开 URL 可接受，但避免点击、输入、提交表单",
    avoidCapabilities: ["write", "execute", "generate"],
    evidenceRequirements: ["返回中应包含当前 URL、页面标题、状态码或可见页面摘要", "证据应能和 target/expected 对齐"],
    failureSignals: ["URL 跳转到无关页面", "页面读取失败", "需要登录或权限但没有可验证状态"]
  },
  command_passed: {
    intent: "验证命令或检查步骤是否成功通过",
    preferredCapabilities: ["read", "verify", "execute"],
    preferredExecutionDomains: ["workspace"],
    riskBoundary: "优先复用已有命令结果；只有用户目标明确要求命令验证时，才选择受限、可重复、低破坏性的命令执行工具",
    avoidCapabilities: ["write", "generate"],
    evidenceRequirements: ["返回中应包含命令、退出状态或明确成功文本", "失败时应保留 stderr、exit code 或错误摘要"],
    failureSignals: ["非零退出码", "输出包含 failed/error/异常", "命令会改变用户资产或依赖外部不可控状态"]
  },
  ui_state: {
    intent: "验证桌面应用、窗口、控件或弹窗状态是否符合预期",
    preferredCapabilities: ["read", "verify"],
    preferredExecutionDomains: ["desktop"],
    riskBoundary: "优先读取 app state、辅助功能树或截图；不要为验证点击、输入、拖拽或按键",
    avoidCapabilities: ["write", "execute"],
    evidenceRequirements: ["返回中应包含 activeApp、visible text、focused input、窗口或弹窗状态", "截图或状态摘要应可支持判断 expected"],
    failureSignals: ["目标应用未打开", "弹窗遮挡", "可见状态与 expected 不一致", "工具只能操作不能读取状态"]
  },
  artifact_created: {
    intent: "验证图片、音频、视频、文件或文本 artifact 是否真实生成且可引用",
    preferredCapabilities: ["read", "verify"],
    preferredExecutionDomains: ["generation", "workspace", "web_research", "application_asset"],
    riskBoundary: "优先检查已有 artifact、任务结果、文件存在或 URL 可访问性；不要为了验证重复生成",
    avoidCapabilities: ["write", "generate"],
    evidenceRequirements: ["返回中应包含 artifact id、kind、title、url、dataUrl 或本地路径", "证据应说明 artifact 与 expected 的对应关系"],
    failureSignals: ["没有 artifact 元数据", "URL 或文件不可访问", "生成任务仍在排队", "artifact 类型与 expected 不一致"]
  }
};

export function getPendingSuccessCriteria(
  criteria: AgentTaskLedgerSuccessCriterion[]
): AgentTaskLedgerSuccessCriterion[] {
  return criteria.filter((criterion) => criterion.status === "pending" || criterion.status === "unknown");
}

export function getActiveVerificationCriteria(
  criteria: AgentTaskLedgerSuccessCriterion[]
): AgentTaskLedgerSuccessCriterion[] {
  return getPendingSuccessCriteria(criteria).filter((criterion) => isActiveVerificationCriterionType(criterion.type));
}

function buildCriterionArgumentHints(criterion: AgentTaskLedgerSuccessCriterion): string[] {
  const hints: string[] = [];

  if (criterion.target?.trim()) {
    hints.push(`优先把 target 原样作为 path/url/query/app/selector 等候选参数：${criterion.target.trim()}`);
  }

  if (criterion.expected.trim()) {
    hints.push(`优先把 expected 原样作为搜索词、断言文本或匹配条件：${criterion.expected.trim()}`);
  }

  if (criterion.verificationMethod?.trim()) {
    hints.push(`遵循账本中的验证方式：${criterion.verificationMethod.trim()}`);
  }

  hints.push("参数必须来自用户任务、任务账本、成功条件或工具 schema；无法确定时不要臆造高风险参数");

  return hints;
}

export function buildActiveVerificationStrategyContext(
  criteria: AgentTaskLedgerSuccessCriterion[]
): AgentActiveVerificationStrategy[] {
  return getActiveVerificationCriteria(criteria).map((criterion) => {
    if (!isActiveVerificationCriterionType(criterion.type)) {
      throw new Error(`Unsupported active verification criterion type: ${criterion.type}`);
    }

    const strategy = ACTIVE_VERIFICATION_STRATEGIES[criterion.type];

    return {
      criterion: {
        type: criterion.type,
        ...(criterion.target ? { target: criterion.target } : {}),
        expected: criterion.expected,
        ...(criterion.verificationMethod ? { verificationMethod: criterion.verificationMethod } : {}),
        status: criterion.status
      },
      ...strategy,
      argumentHints: buildCriterionArgumentHints(criterion)
    };
  });
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
