import assert from "node:assert/strict";
import test from "node:test";

import type { AgentContextPacket } from "./context-packet.js";
import type { AgentMcpCallRecord } from "../../shared/src/index.js";
import { buildAgentResourceContext } from "./resource-registry.js";
import {
  assessExternalEvidenceQuality,
  buildMissingExternalEvidenceFinalInstruction,
  hasSuccessfulExternalEvidenceCallRecords,
  selectExternalEvidenceTool
} from "./external-evidence.js";

function createContextPacket(userInput: string): AgentContextPacket {
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
    recentConversation: []
  };
}

function createCallRecord(overrides: Partial<AgentMcpCallRecord> = {}): AgentMcpCallRecord {
  return {
    round: 1,
    serverId: "test:mcp:search",
    serverName: "Search Tools",
    toolName: "web_research",
    arguments: {},
    resultText: "",
    isError: false,
    autoSelected: true,
    attemptCount: 1,
    recovered: false,
    createdAt: "2026-06-15T00:00:00.000Z",
    ...overrides
  };
}

test("external evidence rejects irrelevant search results for official Anthropic requests", () => {
  const contextPacket = createContextPacket("帮我查一下目前 Anthropic 最新的模型有哪些");
  const calls = [
    createCallRecord({
      resultText: "source=https://dict.example.test/help\nsummary=帮字词典页面",
    })
  ];

  assert.equal(hasSuccessfulExternalEvidenceCallRecords(calls, contextPacket), false);
  assert.equal(assessExternalEvidenceQuality(calls[0], contextPacket).success, false);
  assert.match(buildMissingExternalEvidenceFinalInstruction(contextPacket, calls), /没有成功命中/u);
});

test("external evidence accepts relevant official Anthropic model results", () => {
  const contextPacket = createContextPacket("帮我查一下目前 Anthropic 最新的模型有哪些");
  const calls = [
    createCallRecord({
      resultText: "source=https://docs.anthropic.com/en/docs/about-claude/models\nsummary=Anthropic Claude models include Claude Opus, Sonnet, and Haiku model families.",
    })
  ];

  assert.equal(hasSuccessfulExternalEvidenceCallRecords(calls, contextPacket), true);
  assert.equal(assessExternalEvidenceQuality(calls[0], contextPacket).success, true);
  assert.equal(buildMissingExternalEvidenceFinalInstruction(contextPacket, calls), "");
});

test("external evidence tool selection uses canonical official Anthropic queries", () => {
  const contextPacket = createContextPacket("帮我查一下anthropic旗下最新的模型有哪些？需要输出对应的官方价格");
  const selection = selectExternalEvidenceTool(contextPacket, [
    {
      serverId: "test:mcp:search",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          queries: { type: "array", items: { type: "string" } },
          provider: { type: "string" },
          includeDomains: { type: "array", items: { type: "string" } },
          preferredDomains: { type: "array", items: { type: "string" } },
          officialUrls: { type: "array", items: { type: "string" } },
          maxSearchResults: { type: "integer" },
          maxPagesToRead: { type: "integer" },
          language: { type: "string" },
          country: { type: "string" }
        }
      }
    }
  ]);

  assert.equal(selection?.tool.name, "web_research");
  assert.equal(selection?.arguments.query, "Anthropic Claude latest models pricing official API");
  assert.deepEqual(selection?.arguments.includeDomains, ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"]);
  assert.deepEqual(selection?.arguments.officialUrls, [
    "https://platform.claude.com/docs/en/about-claude/models/overview",
    "https://platform.claude.com/docs/en/about-claude/pricing",
    "https://support.claude.com/en/articles/12138966-release-notes",
    "https://www.anthropic.com/news/claude-fable-5-mythos-5",
    "https://www.anthropic.com/news/fable-mythos-access",
    "https://www.anthropic.com/news/claude-opus-4-8"
  ]);
  assert.equal(selection?.arguments.maxPagesToRead, 6);
  assert.match(JSON.stringify(selection?.arguments.queries), /platform\.claude\.com\/docs/u);
  assert.doesNotMatch(String(selection?.arguments.query), /帮我|查一下/u);
});

test("external evidence tool selection uses clean market price queries and avoids GitHub", () => {
  const contextPacket = createContextPacket("帮我查下现在黄金的价格是多少");
  const selection = selectExternalEvidenceTool(contextPacket, [
    {
      serverId: "test:mcp:search",
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
    },
    {
      serverId: "test:mcp:search",
      serverName: "Search Tools",
      name: "web_research",
      description: "Research web pages",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          queries: { type: "array", items: { type: "string" } },
          provider: { type: "string" },
          maxSearchResults: { type: "integer" },
          maxPagesToRead: { type: "integer" },
          language: { type: "string" },
          country: { type: "string" }
        }
      }
    }
  ]);

  assert.equal(selection?.tool.name, "web_research");
  assert.equal(selection?.arguments.query, "今日黄金价格 XAU/USD 现货黄金 实时");
  assert.doesNotMatch(String(selection?.arguments.query), /帮我|查一下|当前会话最近上下文/u);
});

test("external evidence rejects official homepage-only result for model pricing tasks", () => {
  const contextPacket = createContextPacket("帮我查一下 Anthropic 最新模型有哪些，并打印官方价格");
  const call = createCallRecord({
    resultText: [
      "source=https://www.anthropic.com/",
      "summary=Anthropic homepage navigation mentions Models and Pricing."
    ].join("\n")
  });
  const quality = assessExternalEvidenceQuality(call, contextPacket);

  assert.equal(quality.resultHasOfficialDomain, true);
  assert.equal(quality.resultIsRelevant, true);
  assert.equal(quality.resultIsSufficient, false);
  assert.equal(quality.success, false);
  assert.match(quality.reason, /官方首页|缺少/u);
});

test("external evidence requires pricing numbers when user asks for official prices", () => {
  const contextPacket = createContextPacket("帮我查一下 Anthropic 最新模型有哪些，并打印官方价格");
  const missingPrice = createCallRecord({
    resultText:
      "source=https://platform.claude.com/docs/en/about-claude/models/overview\nsummary=Claude models include Claude Fable 5, Mythos 5, Opus 4.8, Sonnet 4.6, and Haiku 4.5."
  });
  const withPrice = createCallRecord({
    resultText: [
      "source=https://platform.claude.com/docs/en/about-claude/models/overview",
      "source=https://platform.claude.com/docs/en/about-claude/pricing",
      "summary=Claude models include Claude Fable 5, Mythos 5, Opus 4.8, Sonnet 4.6, and Haiku 4.5.",
      "pricing=Claude Sonnet 4.6 input $3 / MTok, output $15 / MTok; Claude Haiku 4.5 input $1 / MTok, output $5 / MTok."
    ].join("\n")
  });

  assert.equal(assessExternalEvidenceQuality(missingPrice, contextPacket).success, false);
  assert.equal(assessExternalEvidenceQuality(withPrice, contextPacket).success, true);
  assert.deepEqual(
    assessExternalEvidenceQuality(withPrice, contextPacket).sufficiencySignals.sort(),
    ["model_names", "pricing_numbers", "pricing_terms", "source_page"].sort()
  );
});
