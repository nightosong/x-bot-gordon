import assert from "node:assert/strict";
import test from "node:test";

import type { AgentTaskLedger } from "../../shared/src/index.js";
import { buildAgentResourceContext } from "./resource-registry.js";
import { normalizeAgentTaskLedger } from "./ledger.js";

function createLedger(userInput: string): AgentTaskLedger {
  return normalizeAgentTaskLedger(
    {
      objective: userInput,
      taskPhase: "planning",
      constraints: [],
      pendingSubtasks: [],
      activePlan: [],
      structuredSuccessCriteria: []
    },
    userInput
  );
}

test("buildAgentResourceContext identifies codebase resource for desktop agent coding tasks", () => {
  const context = buildAgentResourceContext({
    userInput: "帮我修改 packages/agent/src/runtime.ts，并运行 agent 测试验证",
    conversationMessages: [],
    taskLedger: createLedger("修改代码并测试"),
    mcpCalls: []
  });

  assert.equal(context.primaryResource?.type, "codebase.project");
  assert.ok(context.candidates.some((candidate) => candidate.type === "workspace.filesystem"));
  assert.ok(context.resolvedRefs.some((ref) => ref.kind === "path" && ref.value === "packages/agent/src/runtime.ts"));
  assert.ok(context.primaryResource?.resolvedRefs.some((ref) => ref.kind === "path"));
  assert.ok(context.capabilityRegistry.some((capability) => capability.id === "codebase.edit"));
  assert.ok(context.capabilityRegistry.some((capability) => capability.id === "codebase.verify"));
  assert.ok(context.capabilityFrame.preferredExecutionDomains.includes("workspace"));
  assert.ok(context.gatewayPlan.steps.some((step) => step.capabilityId === "codebase.inspect" && step.phase === "inspect"));
  assert.ok(context.gatewayPlan.steps.some((step) => step.capabilityId === "codebase.edit" && step.phase === "act"));
  assert.ok(context.gatewayPlan.toolBias.includes("run_shell_command"));
  assert.equal(context.capabilityFrame.intent, "update");
});

test("buildAgentResourceContext identifies writing and comic application resources", () => {
  const writingContext = buildAgentResourceContext({
    userInput: "检查墨笔生花当前小说第12章有没有人物崩坏，并更新故事资产",
    conversationMessages: [],
    taskLedger: createLedger("检查小说连续性"),
    mcpCalls: []
  });
  const comicContext = buildAgentResourceContext({
    userInput: "把丹青溢彩这一章拆成 20 个分镜并写回漫画项目",
    conversationMessages: [],
    taskLedger: createLedger("生成漫画分镜"),
    mcpCalls: []
  });

  assert.equal(writingContext.primaryResource?.type, "writing.book");
  assert.ok(writingContext.resolvedRefs.some((ref) => ref.kind === "chapter" && ref.metadata?.chapterIndex === 12));
  assert.ok(writingContext.capabilityRegistry.some((capability) => capability.id === "writing.review_continuity"));
  assert.ok(writingContext.capabilityFrame.preferredExecutionDomains.includes("writing_asset"));
  assert.equal(writingContext.gatewayPlan.argumentHints.chapterIndex, 12);
  assert.ok(writingContext.gatewayPlan.steps.some((step) => step.capabilityId === "writing.update_asset" && step.phase === "act"));
  assert.equal(comicContext.primaryResource?.type, "comic.project");
  assert.ok(comicContext.capabilityRegistry.some((capability) => capability.id === "comic.read_project"));
  assert.ok(comicContext.capabilityRegistry.some((capability) => capability.id === "comic.split_storyboard"));
  assert.ok(comicContext.gatewayPlan.steps.some((step) => step.capabilityId === "comic.read_project" && step.phase === "inspect"));
  assert.ok(comicContext.gatewayPlan.steps.some((step) => step.capabilityId === "comic.split_storyboard" && step.phase === "act"));
  assert.ok(comicContext.capabilityFrame.preferredExecutionDomains.includes("comic_asset"));
});

test("buildAgentResourceContext resolves application context ids from Chinese labels", () => {
  const context = buildAgentResourceContext({
    userInput: [
      "你是 Gordon，正在应用广场「丹青溢彩」里处理任务。",
      "当前上下文：",
      "项目 ID：comic_project_abc123",
      "项目：霜梅剑影",
      "当前章节 ID：comic_chapter_def456",
      "当前章节：第 3 章 雪岭试剑",
      "用户补充要求：把这一章拆成 20 个分镜并写回。"
    ].join("\n"),
    conversationMessages: [],
    taskLedger: createLedger("处理丹青溢彩章节分镜"),
    mcpCalls: []
  });

  assert.equal(context.primaryResource?.type, "comic.project");
  assert.ok(context.resolvedRefs.some((ref) => ref.kind === "comic_project" && ref.value === "comic_project_abc123"));
  assert.ok(context.resolvedRefs.some((ref) => ref.kind === "comic_chapter" && ref.value === "comic_chapter_def456"));
  assert.equal(context.gatewayPlan.argumentHints.projectIdOrTitle, "comic_project_abc123");
  assert.equal(context.gatewayPlan.argumentHints.chapterId, "comic_chapter_def456");
  assert.ok(context.gatewayPlan.toolBias.includes("comic_read_project"));
  assert.ok(context.gatewayPlan.toolBias.includes("comic_update_chapter"));
});

test("buildAgentResourceContext identifies generated media assets", () => {
  const context = buildAgentResourceContext({
    userInput: "根据这段提示词生成一段视频，后续帮我轮询任务状态，任务 ID 是 cgt-20260605233458-cd6f8",
    conversationMessages: [],
    taskLedger: createLedger("生成视频并查询结果"),
    mcpCalls: []
  });

  assert.equal(context.primaryResource?.type, "media.asset");
  assert.ok(context.resolvedRefs.some((ref) => ref.kind === "task" && ref.value === "cgt-20260605233458-cd6f8"));
  assert.ok(context.capabilityRegistry.some((capability) => capability.id === "media.generate"));
  assert.ok(context.capabilityFrame.capabilities.includes("generate"));
  assert.ok(context.capabilityFrame.preferredExecutionDomains.includes("generation"));
  assert.equal(context.gatewayPlan.argumentHints.taskId, "cgt-20260605233458-cd6f8");
  assert.ok(context.gatewayPlan.toolBias.includes("video_gen"));
});

test("buildAgentResourceContext carries refs from previous tool calls", () => {
  const context = buildAgentResourceContext({
    userInput: "继续查询刚才的视频生成结果",
    conversationMessages: [],
    taskLedger: createLedger("继续查询视频生成结果"),
    mcpCalls: [
      {
        round: 1,
        serverId: "builtin:mcp:gordon-tools",
        serverName: "Gordon Tools",
        toolName: "video_gen",
        arguments: {
          operation: "query",
          taskId: "video-task-123"
        },
        resultText: "pending",
        structuredContent: {
          taskId: "video-task-123",
          pending: true
        },
        isError: false,
        autoSelected: true,
        attemptCount: 1,
        recovered: false,
        createdAt: "2026-06-09T00:00:00.000Z"
      }
    ]
  });

  assert.ok(context.resolvedRefs.some((ref) => ref.kind === "task" && ref.value === "video-task-123"));
  assert.equal(context.primaryResource?.type, "media.asset");
});
