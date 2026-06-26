import assert from "node:assert/strict";
import test from "node:test";

import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { buildAgentResourceContext } from "./resource-registry.js";
import {
  assessToolRequirement,
  selectRequiredToolFallbackPlan
} from "./tool-requirement.js";
import { buildCapabilityRoutingContext } from "./capability-router.js";

function createContextPacket(userInput: string, overrides: Partial<AgentContextPacket> = {}): AgentContextPacket {
  const taskLedger = {
    taskPhase: "planning" as const,
    objective: userInput,
    constraints: [],
    completedSubtasks: [],
    pendingSubtasks: [],
    activePlan: [],
    decisionTrace: [],
    decisionMemory: [],
    observations: [],
    evidenceGraph: [],
    discoveredFacts: [],
    failedAttempts: [],
    environmentState: [],
    userInterruptions: [],
    successCriteria: [],
    structuredSuccessCriteria: []
  };

  return {
    goal: {
      latestUserRequest: userInput,
      objective: userInput,
      taskPhase: "planning"
    },
    resources: buildAgentResourceContext({
      userInput,
      conversationMessages: [],
      taskLedger,
      mcpCalls: []
    }),
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
    serverId: "test:mcp:workspace",
    serverName: "Workspace Tools",
    name: "read_file",
    description: "Read a file",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" }
      }
    },
    ...overrides
  };
}

test("assessToolRequirement requires external evidence for latest official pricing", () => {
  const contextPacket = createContextPacket("帮我查一下 Anthropic Claude 最新官方 API 价格，带来源");
  const result = assessToolRequirement(contextPacket, [
    createTool({
      serverId: "test:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          includeDomains: { type: "array", items: { type: "string" } },
          preferredDomains: { type: "array", items: { type: "string" } }
        }
      }
    })
  ]);

  assert.equal(result.mode, "required");
  assert.equal(result.capability, "external_evidence");
  assert.equal(result.routeStrength, "strong");
});

test("assessToolRequirement requires external evidence for vendor model catalog typo", () => {
  const contextPacket = createContextPacket("帮我查下anthropic旗下罪行的模型有哪些？");
  const candidateTools = [
    createTool({
      serverId: "test:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          includeDomains: { type: "array", items: { type: "string" } },
          preferredDomains: { type: "array", items: { type: "string" } }
        }
      }
    })
  ];
  const result = assessToolRequirement(contextPacket, candidateTools);
  const routingContext = buildCapabilityRoutingContext(contextPacket, candidateTools);
  const plan = selectRequiredToolFallbackPlan({
    requirement: result,
    contextPacket,
    candidateTools,
    routingContext
  });

  assert.equal(result.mode, "required");
  assert.equal(result.capability, "external_evidence");
  assert.match(String(plan?.arguments.query ?? ""), /latest/u);
  assert.doesNotMatch(String(plan?.arguments.query ?? ""), /罪行/u);
  assert.deepEqual(plan?.arguments.preferredDomains, ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"]);
  assert.deepEqual(plan?.arguments.includeDomains, ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"]);
});

test("assessToolRequirement requires workspace tools for local markdown listing", () => {
  const contextPacket = createContextPacket("帮我看看 workspace 里有哪些 markdown 文件");
  const result = assessToolRequirement(contextPacket, [
    createTool({
      name: "inspect_path",
      description: "Inspect workspace paths",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" }
        }
      }
    })
  ]);

  assert.equal(result.mode, "required");
  assert.equal(result.capability, "workspace");
});

test("assessToolRequirement leaves ordinary chat optional", () => {
  const contextPacket = createContextPacket("解释一下什么是任务账本");
  const result = assessToolRequirement(contextPacket, [
    createTool({
      name: "read_file",
      description: "Read a file"
    })
  ]);

  assert.equal(result.mode, "optional");
});

test("selectRequiredToolFallbackPlan builds workspace fallback arguments", () => {
  const contextPacket = createContextPacket("检查一下当前项目里的 README 文件是否存在");
  const candidateTools = [
    createTool({
      name: "read_file",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" }
        }
      }
    })
  ];
  const requirement = assessToolRequirement(contextPacket, candidateTools);
  const routingContext = buildCapabilityRoutingContext(contextPacket, candidateTools);
  const plan = selectRequiredToolFallbackPlan({
    requirement,
    contextPacket,
    candidateTools,
    routingContext
  });

  assert.equal(plan?.serverId, "test:mcp:workspace");
  assert.equal(plan?.toolName, "read_file");
  assert.deepEqual(plan?.arguments, { path: "." });
});

test("selectRequiredToolFallbackPlan prefers external evidence helper", () => {
  const contextPacket = createContextPacket("帮我联网查一下 Anthropic Claude 最新官方 API 价格，带上来源");
  const candidateTools = [
    createTool({
      serverId: "test:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          provider: { type: "string" },
          maxSearchResults: { type: "integer" },
          maxPagesToRead: { type: "integer" },
          includeDomains: { type: "array", items: { type: "string" } },
          preferredDomains: { type: "array", items: { type: "string" } }
        }
      }
    })
  ];
  const requirement = assessToolRequirement(contextPacket, candidateTools);
  const routingContext = buildCapabilityRoutingContext(contextPacket, candidateTools);
  const plan = selectRequiredToolFallbackPlan({
    requirement,
    contextPacket,
    candidateTools,
    routingContext
  });

  assert.equal(plan?.toolName, "web_research");
  assert.match(String(plan?.arguments.query ?? ""), /Anthropic Claude/u);
  assert.deepEqual(plan?.arguments.preferredDomains, ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"]);
  assert.deepEqual(plan?.arguments.includeDomains, ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"]);
});

test("selectRequiredToolFallbackPlan routes live gold price to web research instead of GitHub", () => {
  const contextPacket = createContextPacket("帮我查下现在黄金的价格是多少");
  const candidateTools = [
    createTool({
      serverId: "test:mcp:search-tools",
      serverName: "Search Tools",
      name: "github_search_repositories",
      description: "Search GitHub repositories",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          sort: { type: "string" }
        }
      }
    }),
    createTool({
      serverId: "test:mcp:search-tools",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          provider: { type: "string" },
          maxSearchResults: { type: "integer" },
          maxPagesToRead: { type: "integer" }
        }
      }
    })
  ];
  const requirement = assessToolRequirement(contextPacket, candidateTools);
  const routingContext = buildCapabilityRoutingContext(contextPacket, candidateTools);
  const plan = selectRequiredToolFallbackPlan({
    requirement,
    contextPacket,
    candidateTools,
    routingContext
  });

  assert.equal(requirement.mode, "required");
  assert.equal(requirement.capability, "external_evidence");
  assert.equal(requirement.preferredToolNames.includes("github_search_repositories"), false);
  assert.equal(plan?.toolName, "web_research");
  assert.equal(plan?.arguments.query, "今日黄金价格 XAU/USD 现货黄金 实时");
});
