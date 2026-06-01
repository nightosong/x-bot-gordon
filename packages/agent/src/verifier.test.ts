import assert from "node:assert/strict";
import test from "node:test";

import type { AgentMcpCallRecord } from "../../shared/src/index.js";
import {
  buildActiveVerificationStrategyContext,
  evaluateActiveVerificationResult,
  getActiveVerificationCriteria,
  getPendingSuccessCriteria,
  verifyCriteriaFromToolHistory,
  verifyCriterionFromToolHistory
} from "./verifier.js";

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

test("getPendingSuccessCriteria returns only pending or unknown criteria", () => {
  const criteria = getPendingSuccessCriteria([
    {
      type: "tool_result",
      expected: "done",
      status: "pending"
    },
    {
      type: "ui_state",
      expected: "ready",
      status: "unknown"
    },
    {
      type: "artifact_created",
      expected: "image",
      status: "passed"
    },
    {
      type: "command_passed",
      expected: "check",
      status: "failed"
    }
  ]);

  assert.deepEqual(
    criteria.map((criterion) => criterion.status),
    ["pending", "unknown"]
  );
});

test("getActiveVerificationCriteria excludes text-response and custom criteria", () => {
  const criteria = getActiveVerificationCriteria([
    {
      type: "text_response",
      expected: "final answer",
      status: "pending"
    },
    {
      type: "custom",
      expected: "human judgment",
      status: "unknown"
    },
    {
      type: "url_opened",
      expected: "page opened",
      status: "unknown"
    }
  ]);

  assert.deepEqual(
    criteria.map((criterion) => criterion.type),
    ["url_opened"]
  );
});

test("buildActiveVerificationStrategyContext provides typed verification guidance", () => {
  const strategies = buildActiveVerificationStrategyContext([
    {
      type: "file_contains",
      target: "packages/agent/src/runtime.ts",
      expected: "planActiveMcpVerification",
      verificationMethod: "read the file and match the function name",
      status: "pending"
    },
    {
      type: "ui_state",
      target: "Chrome",
      expected: "Google homepage visible",
      status: "unknown"
    },
    {
      type: "text_response",
      expected: "final summary",
      status: "pending"
    }
  ]);

  assert.deepEqual(
    strategies.map((strategy) => strategy.criterion.type),
    ["file_contains", "ui_state"]
  );
  assert.deepEqual(strategies[0]?.preferredExecutionDomains, ["workspace"]);
  assert.ok(strategies[0]?.preferredCapabilities.includes("read"));
  assert.ok(strategies[0]?.avoidCapabilities.includes("write"));
  assert.ok(strategies[0]?.argumentHints.some((hint) => hint.includes("packages/agent/src/runtime.ts")));
  assert.ok(strategies[0]?.argumentHints.some((hint) => hint.includes("planActiveMcpVerification")));
  assert.ok(strategies[0]?.argumentHints.some((hint) => hint.includes("read the file")));
  assert.deepEqual(strategies[1]?.preferredExecutionDomains, ["desktop"]);
  assert.ok(strategies[1]?.evidenceRequirements.some((requirement) => requirement.includes("activeApp")));
});

test("evaluateActiveVerificationResult scores direct low-risk evidence", () => {
  const beforeCriteria = [
    {
      type: "file_contains" as const,
      target: "packages/agent/src/runtime.ts",
      expected: "planActiveMcpVerification",
      status: "pending" as const
    }
  ];
  const strategies = buildActiveVerificationStrategyContext(beforeCriteria);
  const evaluation = evaluateActiveVerificationResult(
    createCallRecord({
      serverId: "builtin:mcp:workspace",
      serverName: "Workspace Tools",
      toolName: "read_file",
      resultText: "function planActiveMcpVerification() {}"
    }),
    beforeCriteria,
    [
      {
        ...beforeCriteria[0],
        status: "passed"
      }
    ],
    strategies
  );

  assert.equal(evaluation.evidenceGrade, "direct");
  assert.equal(evaluation.riskLevel, "low");
  assert.equal(evaluation.passedCriteria, 1);
  assert.equal(evaluation.remainingCriteria, 0);
  assert.ok(evaluation.qualityScore >= 80);
  assert.match(evaluation.summary, /主动验证评分/u);
});

test("evaluateActiveVerificationResult flags failed risky verification", () => {
  const beforeCriteria = [
    {
      type: "ui_state" as const,
      target: "Chrome",
      expected: "Google homepage visible",
      status: "pending" as const
    }
  ];
  const evaluation = evaluateActiveVerificationResult(
    createCallRecord({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      toolName: "click",
      resultText: "button not found",
      isError: true
    }),
    beforeCriteria,
    [
      {
        ...beforeCriteria[0],
        status: "failed"
      }
    ],
    buildActiveVerificationStrategyContext(beforeCriteria)
  );

  assert.equal(evaluation.evidenceGrade, "none");
  assert.equal(evaluation.riskLevel, "high");
  assert.equal(evaluation.failedCriteria, 1);
  assert.ok(evaluation.qualityScore < 40);
  assert.match(evaluation.recoveryHint ?? "", /主动验证失败/u);
});

test("verifyCriterionFromToolHistory returns evidence for matched tool results", () => {
  const result = verifyCriterionFromToolHistory(
    {
      type: "tool_result",
      target: "Workspace Tools",
      expected: "file read",
      status: "pending"
    },
    [
      createCallRecord({
        serverName: "Workspace Tools",
        toolName: "read_file",
        resultText: "file read"
      })
    ]
  );

  assert.equal(result.criterion.status, "passed");
  assert.equal(result.evidence[0]?.reason, "工具结果匹配成功条件");
  assert.equal(result.evidence[0]?.callRef, "mcp:1:builtin:mcp:workspace:read_file:2026-05-29T00:00:00.000Z");
});

test("verifyCriterionFromToolHistory fails tool-result criteria after failed tools without success", () => {
  const result = verifyCriterionFromToolHistory(
    {
      type: "tool_result",
      expected: "file content",
      status: "pending"
    },
    [
      createCallRecord({
        isError: true,
        resultText: "tool failed"
      })
    ]
  );

  assert.equal(result.criterion.status, "failed");
  assert.equal(result.evidence[0]?.reason, "已有工具失败且未找到匹配成功结果");
});

test("verifyCriteriaFromToolHistory verifies artifacts, commands, URLs and UI state", () => {
  const results = verifyCriteriaFromToolHistory(
    [
      {
        type: "artifact_created",
        target: "poster",
        expected: "poster generated",
        status: "pending"
      },
      {
        type: "command_passed",
        expected: "pnpm run check",
        status: "pending"
      },
      {
        type: "url_opened",
        target: "https://example.com",
        expected: "example opened",
        status: "pending"
      },
      {
        type: "ui_state",
        target: "modal closed",
        expected: "modal closed",
        status: "pending"
      }
    ],
    [
      createCallRecord({
        serverName: "Gordon Tools",
        toolName: "image_gen",
        resultText: "done",
        artifacts: [
          {
            id: "artifact_1",
            kind: "image",
            title: "poster",
            url: "https://cdn.example.com/poster.png"
          }
        ]
      }),
      createCallRecord({
        toolName: "run_shell_command",
        resultText: "pnpm run check completed"
      }),
      createCallRecord({
        toolName: "open_url",
        arguments: { url: "https://example.com" },
        resultText: "opened"
      }),
      createCallRecord({
        serverName: "Computer Use",
        toolName: "get_app_state",
        resultText: "modal closed and app ready"
      })
    ]
  );

  assert.deepEqual(
    results.map((result) => result.criterion.status),
    ["passed", "passed", "passed", "passed"]
  );
  assert.deepEqual(
    results.map((result) => result.evidence[0]?.reason),
    [
      "工具调用产生了匹配 artifact",
      "命令工具完成且输出匹配成功条件",
      "URL 或页面相关工具结果匹配成功条件",
      "UI 状态相关工具结果匹配成功条件"
    ]
  );
});

test("command criteria remain unknown when command output indicates failure", () => {
  const result = verifyCriterionFromToolHistory(
    {
      type: "command_passed",
      expected: "pnpm run check",
      status: "pending"
    },
    [
      createCallRecord({
        toolName: "run_shell_command",
        resultText: "pnpm run check failed with exit code 1"
      })
    ]
  );

  assert.equal(result.criterion.status, "unknown");
  assert.equal(result.evidence.length, 0);
});
