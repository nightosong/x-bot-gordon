import type { AgentMcpCallRecord } from "../../shared/src/index.js";

export interface McpErrorClassification {
  category: AgentMcpCallRecord["errorCategory"];
  message: string;
  failureKind: AgentMcpCallRecord["failureKind"];
}

export function classifyMcpMessage(message: string): McpErrorClassification {
  const normalized = message.toLowerCase();

  const networkTimeoutPatterns = [
    "network_timeout",
    "网络连接超时",
    "网络请求超时",
    "连接超时",
    "请求超时",
    "connection timed out",
    "connect timeout",
    "connect timed out",
    "connection timeout",
    "operation timed out",
    "timeout was reached",
    "curl: (28)",
    "exit 28",
    "etimedout",
    "und_err_connect_timeout",
    "eai_again",
    "enotfound",
    "econnreset",
    "econnrefused",
    "fetch failed"
  ];

  const nonRetryableSubmissionUnknownPatterns = [
    "video_gen 提交状态未知",
    "不能安全自动重试",
    "以免重复生成",
    "重复扣费"
  ];

  const retryablePatterns = [
    "http 408",
    "http 409",
    "http 425",
    "http 429",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "timed out",
    "timeout",
    "temporarily unavailable",
    "network",
    "socket hang up",
    "econnreset",
    "econnrefused",
    "etimedout",
    "epipe",
    "empty",
    "engineoverloaded",
    "overloaded",
    "too many requests",
    "rate limit",
    "无法解析"
  ];

  const schemaMismatchPatterns = [
    "schema",
    "validation",
    "required",
    "missing required",
    "unexpected",
    "must be",
    "should be",
    "invalid type",
    "invalidparameter",
    "badrequest",
    "bad request",
    "参数",
    "字段",
    "必填",
    "格式",
    "校验",
    "json"
  ];

  const toolUnavailablePatterns = [
    "白名单",
    "不存在",
    "未启用",
    "not found",
    "not enabled",
    "unknown tool",
    "method not found",
    "unsupported",
    "forbidden"
  ];

  const toolExecutionPatterns = [
    "invalid",
    "failed",
    "error",
    "执行失败",
    "exception",
    "denied",
    "permission"
  ];

  const permissionDeniedPatterns = [
    "permission denied",
    "access denied",
    "not authorized",
    "unauthorized",
    "forbidden",
    "用户拒绝授权",
    "授权被拒绝",
    "拒绝授权",
    "没有权限",
    "权限不足"
  ];

  const environmentStatePatterns = [
    "not running",
    "window not found",
    "page not loaded",
    "modal",
    "dialog",
    "popup",
    "blocked by",
    "login required",
    "需要登录",
    "未启动",
    "窗口不存在",
    "页面未加载",
    "弹窗",
    "登录"
  ];

  const wrongToolPatterns = [
    "wrong tool",
    "not supported by this tool",
    "unsupported operation",
    "capability not covered",
    "cannot handle",
    "工具不支持",
    "能力未覆盖",
    "不支持该操作",
    "无法处理该任务"
  ];

  const actionTooEarlyPatterns = [
    "too early",
    "not ready",
    "wait",
    "loading",
    "pending",
    "尚未就绪",
    "还未准备好",
    "正在加载",
    "请等待",
    "过早"
  ];

  const nonexistentEntityPatterns = [
    "no such file",
    "enoent",
    "not exist",
    "does not exist",
    "not found",
    "missing entity",
    "不存在",
    "未找到",
    "找不到",
    "没有这个"
  ];

  if (nonRetryableSubmissionUnknownPatterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "tool_execution"
    };
  }

  if (networkTimeoutPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "retryable",
      message,
      failureKind: "network_timeout"
    };
  }

  if (retryablePatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "retryable",
      message,
      failureKind: "unknown"
    };
  }

  if (permissionDeniedPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "permission_denied"
    };
  }

  if (schemaMismatchPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "schema_mismatch"
    };
  }

  if (actionTooEarlyPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "retryable",
      message,
      failureKind: "action_too_early"
    };
  }

  if (environmentStatePatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "environment_state"
    };
  }

  if (wrongToolPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "wrong_tool"
    };
  }

  if (nonexistentEntityPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "nonexistent_entity"
    };
  }

  if (toolUnavailablePatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "tool_unavailable"
    };
  }

  if (toolExecutionPatterns.some((pattern) => normalized.includes(pattern))) {
    return {
      category: "non_retryable",
      message,
      failureKind: "tool_execution"
    };
  }

  return {
    category: "non_retryable",
    message,
    failureKind: "unknown"
  };
}

export function classifyMcpError(error: unknown): McpErrorClassification {
  const message = error instanceof Error ? error.message : String(error);
  return classifyMcpMessage(message);
}
