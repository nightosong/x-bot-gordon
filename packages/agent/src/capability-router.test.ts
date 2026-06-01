import assert from "node:assert/strict";
import test from "node:test";

import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { buildCapabilityRoutingContext } from "./capability-router.js";

function createContextPacket(overrides: Partial<AgentContextPacket> = {}): AgentContextPacket {
  return {
    goal: {
      latestUserRequest: "检查 packages/agent/src/runtime.ts 是否包含 Plan Critic",
      objective: "验证本地代码状态",
      taskPhase: "planning"
    },
    constraints: [],
    plan: [],
    decisionMemory: [],
    evidence: {
      discoveredFacts: [],
      observations: [],
      evidenceGraph: [],
      environmentState: [],
      recentToolCalls: []
    },
    verification: {
      successCriteria: [],
      structuredSuccessCriteria: []
    },
    recovery: {
      failedAttempts: [],
      userInterruptions: []
    },
    openQuestions: [],
    recentConversation: [],
    ...overrides
  };
}

function createTool(overrides: Partial<McpToolDefinition>): McpToolDefinition {
  return {
    serverId: "builtin:mcp:workspace",
    serverName: "Workspace Tools",
    name: "read_file",
    description: "Read a file from workspace",
    inputSchema: {
      type: "object"
    },
    ...overrides
  };
}

test("buildCapabilityRoutingContext prioritizes workspace tools for file tasks", () => {
  const routing = buildCapabilityRoutingContext(createContextPacket(), [
    createTool({
      serverId: "builtin:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages"
    }),
    createTool({
      serverId: "builtin:mcp:workspace",
      serverName: "Workspace Tools",
      name: "read_file",
      description: "Read a file from workspace"
    })
  ]);

  assert.equal(routing.allToolsAvailable, true);
  assert.match(routing.routingPolicy, /不做候选裁剪/u);
  assert.equal(routing.needs[0]?.capability, "workspace");
  assert.equal(routing.groups[0]?.tools[0]?.serverId, "builtin:mcp:workspace");
});

test("buildCapabilityRoutingContext groups desktop tasks without removing other tools", () => {
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "打开 Chrome 并检查当前页面 UI 是否显示登录按钮",
        objective: "验证浏览器界面状态",
        taskPhase: "planning"
      }
    }),
    [
      createTool({
        serverId: "builtin:mcp:computer-use",
        serverName: "Computer Use",
        name: "get_app_state",
        description: "Read desktop app state and screenshot"
      }),
      createTool({
        serverId: "builtin:mcp:workspace",
        serverName: "Workspace Tools",
        name: "read_file",
        description: "Read a file from workspace"
      })
    ]
  );

  assert.ok(routing.needs.some((need) => need.capability === "desktop"));
  assert.equal(routing.groups.find((group) => group.capability === "desktop")?.tools[0]?.serverId, "builtin:mcp:computer-use");
  assert.equal(routing.summary.includes("完整候选工具仍全部可选"), true);
});

test("buildCapabilityRoutingContext recognizes generation and application asset needs", () => {
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "给当前小说章节生成封面图并写回应用资产",
        objective: "生成并保存小说资产",
        taskPhase: "planning"
      }
    }),
    [
      createTool({
        serverId: "builtin:mcp:gordon-tools",
        serverName: "Gordon Tools",
        name: "image_gen",
        description: "Generate image assets"
      }),
      createTool({
        serverId: "builtin:mcp:application-tools",
        serverName: "Application Tools",
        name: "writing_update_story_assets",
        description: "Update writing book story assets"
      })
    ]
  );

  assert.ok(routing.needs.some((need) => need.capability === "generation"));
  assert.ok(routing.needs.some((need) => need.capability === "application_asset"));
  assert.equal(routing.groups.find((group) => group.capability === "generation")?.tools[0]?.name, "image_gen");
  assert.equal(routing.groups.find((group) => group.capability === "application_asset")?.tools[0]?.name, "writing_update_story_assets");
});
