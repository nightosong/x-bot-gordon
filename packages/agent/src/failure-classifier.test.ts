import assert from "node:assert/strict";
import test from "node:test";

import { classifyMcpError, classifyMcpMessage } from "./failure-classifier.js";

test("classifyMcpMessage identifies permission failures", () => {
  assert.deepEqual(classifyMcpMessage("Permission denied: user rejected access"), {
    category: "non_retryable",
    message: "Permission denied: user rejected access",
    failureKind: "permission_denied"
  });
});

test("classifyMcpMessage keeps transient errors retryable", () => {
  assert.deepEqual(classifyMcpMessage("HTTP 503 temporarily unavailable"), {
    category: "retryable",
    message: "HTTP 503 temporarily unavailable",
    failureKind: "unknown"
  });
});

test("classifyMcpMessage sanitizes upstream HTML 503 pages", () => {
  const classified = classifyMcpMessage(
    "HTTP 503：<html> <head><title>503 Service Temporarily Unavailable</title></head> <body bgcolor=\"white\"> <center><h1>503 Service Temporarily Unavailable</h1></center> <hr><center>alb</center> </body> </html>"
  );

  assert.equal(classified.category, "retryable");
  assert.equal(classified.failureKind, "unknown");
  assert.match(classified.message, /上游服务暂时不可用（HTTP 503）/u);
  assert.match(classified.message, /Service Temporarily Unavailable/u);
  assert.doesNotMatch(classified.message, /<html|<body|<center/iu);
});

test("classifyMcpMessage identifies network timeouts", () => {
  assert.deepEqual(
    classifyMcpMessage(
      "网络连接超时：curl 兜底请求失败（exit 28）：curl: (28) Connection timed out after 20006 milliseconds"
    ),
    {
      category: "retryable",
      message: "网络连接超时：curl 兜底请求失败（exit 28）：curl: (28) Connection timed out after 20006 milliseconds",
      failureKind: "network_timeout"
    }
  );
});

test("classifyMcpMessage does not auto-retry unknown video submissions", () => {
  assert.deepEqual(
    classifyMcpMessage("video_gen 提交状态未知：提交请求发生网络异常，不能安全自动重试以免重复生成或重复扣费。"),
    {
      category: "non_retryable",
      message: "video_gen 提交状态未知：提交请求发生网络异常，不能安全自动重试以免重复生成或重复扣费。",
      failureKind: "tool_execution"
    }
  );
});

test("classifyMcpMessage separates environment state from wrong-tool failures", () => {
  assert.equal(classifyMcpMessage("window not found").failureKind, "environment_state");
  assert.equal(classifyMcpMessage("capability not covered by this tool").failureKind, "wrong_tool");
});

test("classifyMcpMessage treats upstream invalid parameters as schema mismatch", () => {
  assert.deepEqual(classifyMcpMessage("InvalidParameter: the specified parameter camera_fixed is not supported / BadRequest"), {
    category: "non_retryable",
    message: "InvalidParameter: the specified parameter camera_fixed is not supported / BadRequest",
    failureKind: "schema_mismatch"
  });
});

test("classifyMcpError normalizes thrown errors", () => {
  assert.deepEqual(classifyMcpError(new Error("no such file: README.md")), {
    category: "non_retryable",
    message: "no such file: README.md",
    failureKind: "nonexistent_entity"
  });
});
