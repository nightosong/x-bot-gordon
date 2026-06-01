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

test("classifyMcpMessage separates environment state from wrong-tool failures", () => {
  assert.equal(classifyMcpMessage("window not found").failureKind, "environment_state");
  assert.equal(classifyMcpMessage("capability not covered by this tool").failureKind, "wrong_tool");
});

test("classifyMcpError normalizes thrown errors", () => {
  assert.deepEqual(classifyMcpError(new Error("no such file: README.md")), {
    category: "non_retryable",
    message: "no such file: README.md",
    failureKind: "nonexistent_entity"
  });
});
