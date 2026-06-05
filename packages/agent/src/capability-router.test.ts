import assert from "node:assert/strict";
import test from "node:test";

import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { buildCapabilityRoutingContext, buildPlannerVisibleTools } from "./capability-router.js";

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

  assert.equal(routing.allToolsAvailable, false);
  assert.match(routing.routingPolicy, /Planner Tool View/u);
  assert.equal(routing.needs[0]?.capability, "workspace");
  assert.equal(routing.groups[0]?.tools[0]?.serverId, "builtin:mcp:workspace");
});

test("buildCapabilityRoutingContext groups desktop tasks into a planner tool view", () => {
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
  assert.equal(routing.summary.includes("Planner Tool View"), true);
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

test("buildPlannerVisibleTools hides low-level path and GUI primitives", () => {
  const candidateTools = [
    createTool({
      serverId: "builtin:mcp:workspace",
      serverName: "Workspace Tools",
      name: "read_file",
      description: "Read a file"
    }),
    createTool({
      serverId: "builtin:mcp:workspace",
      serverName: "Workspace Tools",
      name: "join_path",
      description: "Join path segments"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "get_app_state",
      description: "Read desktop app state"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "click",
      description: "Click a desktop coordinate"
    }),
    createTool({
      serverId: "builtin:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Deep web research"
    })
  ];
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "检查本地文件后打开浏览器验证页面状态",
        objective: "读取文件并验证桌面 UI",
        taskPhase: "planning"
      }
    }),
    candidateTools
  );
  const visibleToolNames = buildPlannerVisibleTools(candidateTools, routing.groups).map((tool) => tool.name);

  assert.ok(visibleToolNames.includes("read_file"));
  assert.ok(visibleToolNames.includes("get_app_state"));
  assert.equal(visibleToolNames.includes("web_research"), false);
  assert.equal(visibleToolNames.includes("join_path"), false);
  assert.equal(visibleToolNames.includes("click"), false);
});

test("buildPlannerVisibleTools keeps web research tasks out of application and generation tools", () => {
  const candidateTools = [
    createTool({
      serverId: "builtin:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Deep web research"
    }),
    createTool({
      serverId: "builtin:mcp:search-tools",
      serverName: "Search Tools",
      name: "github_search_repositories",
      description: "Search GitHub repositories"
    }),
    createTool({
      serverId: "builtin:mcp:workspace",
      serverName: "Workspace Tools",
      name: "read_web_page",
      description: "Read a web page body from URL"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "open_url",
      description: "Open http URL in browser"
    }),
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "writing_search_book",
      description: "在「墨笔生花」小说中搜索关键词。"
    }),
    createTool({
      serverId: "builtin:mcp:gordon-tools",
      serverName: "Gordon Tools",
      name: "image_gen",
      description: "使用 Base URL 和图片生成模型生成图片。"
    })
  ];
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "搜索 OpenAI 最新模型官方文档",
        objective: "查找官方最新资料",
        taskPhase: "planning"
      }
    }),
    candidateTools
  );
  const visibleToolNames = buildPlannerVisibleTools(candidateTools, routing.groups).map((tool) => tool.name);

  assert.ok(visibleToolNames.includes("web_research"));
  assert.ok(visibleToolNames.includes("read_web_page"));
  assert.ok(visibleToolNames.includes("open_url"));
  assert.equal(visibleToolNames.includes("writing_search_book"), false);
  assert.equal(visibleToolNames.includes("image_gen"), false);
});

test("buildPlannerVisibleTools scopes desktop verification to desktop high-level tools", () => {
  const candidateTools = [
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "get_app_state",
      description: "Read desktop app state and visible UI text"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "open_app",
      description: "Open macOS application"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "click",
      description: "Click a desktop coordinate"
    }),
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "comic_update_project_fields",
      description: "写回丹青溢彩漫画项目级字段和状态。"
    }),
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "comic_read_project",
      description: "读取丹青溢彩漫画项目。"
    })
  ];
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "打开 Chrome 并检查当前页面 UI 是否显示登录按钮",
        objective: "验证浏览器 UI 状态",
        taskPhase: "planning"
      }
    }),
    candidateTools
  );
  const visibleToolNames = buildPlannerVisibleTools(candidateTools, routing.groups).map((tool) => tool.name);

  assert.ok(visibleToolNames.includes("get_app_state"));
  assert.ok(visibleToolNames.includes("open_app"));
  assert.equal(visibleToolNames.includes("click"), false);
  assert.equal(visibleToolNames.includes("comic_read_project"), false);
  assert.equal(visibleToolNames.includes("comic_update_project_fields"), false);
});

test("buildPlannerVisibleTools exposes media playback helpers for browser video tasks", () => {
  const candidateTools = [
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "get_app_state",
      description: "Read desktop app state and visible UI text"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "open_url",
      description: "Open http URL in browser"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "wait",
      description: "Wait for page loading"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "click_text",
      description: "Click visible text in browser UI"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "play_media",
      description: "Try to play current browser media"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "click_window_area",
      description: "Click relative window area"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "take_screenshot",
      description: "Capture current screen"
    }),
    createTool({
      serverId: "builtin:mcp:computer-use",
      serverName: "Computer Use",
      name: "click",
      description: "Click raw desktop coordinate"
    })
  ];
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "打开 google 搜索 bilibili，然后在网站上打开凡人修仙传并播放",
        objective: "完成网页视频播放",
        taskPhase: "planning"
      }
    }),
    candidateTools
  );
  const visibleToolNames = buildPlannerVisibleTools(candidateTools, routing.groups).map((tool) => tool.name);

  assert.ok(visibleToolNames.includes("open_url"));
  assert.ok(visibleToolNames.includes("wait"));
  assert.ok(visibleToolNames.includes("click_text"));
  assert.ok(visibleToolNames.includes("play_media"));
  assert.ok(visibleToolNames.includes("click_window_area"));
  assert.ok(visibleToolNames.includes("take_screenshot"));
  assert.equal(visibleToolNames.includes("click"), false);
});

test("buildPlannerVisibleTools exposes write tools only for matching application domain", () => {
  const candidateTools = [
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "writing_read_book",
      description: "读取墨笔生花小说。"
    }),
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "writing_update_story_assets",
      description: "写回墨笔生花小说故事资产。"
    }),
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "comic_read_project",
      description: "读取丹青溢彩漫画项目。"
    }),
    createTool({
      serverId: "builtin:mcp:application-tools",
      serverName: "Application Tools",
      name: "comic_update_chapter",
      description: "写回丹青溢彩漫画章节。"
    })
  ];
  const routing = buildCapabilityRoutingContext(
    createContextPacket({
      goal: {
        latestUserRequest: "把霜梅照天阙的大纲写回墨笔生花",
        objective: "更新小说大纲",
        taskPhase: "planning"
      }
    }),
    candidateTools
  );
  const visibleToolNames = buildPlannerVisibleTools(candidateTools, routing.groups).map((tool) => tool.name);

  assert.ok(visibleToolNames.includes("writing_read_book"));
  assert.ok(visibleToolNames.includes("writing_update_story_assets"));
  assert.equal(visibleToolNames.includes("comic_read_project"), false);
  assert.equal(visibleToolNames.includes("comic_update_chapter"), false);
});
