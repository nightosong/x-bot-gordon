import type { AgentMcpCallRecord, McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import { inferToolExecutionDomain } from "./tool-metadata.js";

export interface ExternalEvidenceRequirement {
  required: boolean;
  reason: string;
  matchedSignal?: string;
}

export interface ExternalEvidenceToolSelection {
  tool: McpToolDefinition;
  arguments: Record<string, unknown>;
  query: string;
  reason: string;
  expectedOutcome: string;
  verificationMethod: string;
}

const EXTERNAL_TOOL_NAMES = new Set(["web_research", "web_search_v2", "web_search", "read_web_page", "github_search_repositories"]);

const KNOWN_OFFICIAL_DOMAINS: Array<{ pattern: RegExp; domains: string[] }> = [
  { pattern: /anthropic|claude/iu, domains: ["anthropic.com", "docs.anthropic.com"] },
  { pattern: /openai|chatgpt|gpt[-\s]?\d|o\d\b/iu, domains: ["openai.com", "platform.openai.com"] },
  { pattern: /google|gemini/iu, domains: ["ai.google.dev", "cloud.google.com"] },
  { pattern: /deepseek|深度求索/iu, domains: ["api-docs.deepseek.com", "deepseek.com"] },
  { pattern: /qwen|通义|千问/iu, domains: ["help.aliyun.com", "dashscope.aliyuncs.com"] },
  { pattern: /doubao|豆包|volcengine|火山引擎/iu, domains: ["volcengine.com"] },
  { pattern: /grok|xai|x\.ai/iu, domains: ["docs.x.ai", "x.ai"] }
];

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function getExternalEvidenceText(contextPacket: AgentContextPacket): string {
  return [
    contextPacket.goal.latestUserRequest,
    contextPacket.goal.objective,
    contextPacket.goal.nextActionHint,
    ...contextPacket.constraints,
    ...contextPacket.openQuestions,
    ...contextPacket.recentConversation.map((message) => message.content)
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function getPrimaryRequestText(contextPacket: AgentContextPacket): string {
  return (
    normalizeText(contextPacket.goal.latestUserRequest) ||
    normalizeText(contextPacket.goal.objective) ||
    normalizeText(contextPacket.goal.nextActionHint) ||
    "当前用户请求"
  );
}

function extractNonLocalUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>）)】]+/giu) ?? [];

  return matches.filter((url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
    } catch {
      return false;
    }
  });
}

export function assessExternalEvidenceRequirement(contextPacket: AgentContextPacket): ExternalEvidenceRequirement {
  const text = getExternalEvidenceText(contextPacket);

  if (!text) {
    return { required: false, reason: "未发现需要外部证据的任务信号" };
  }

  const checks: Array<{ signal: string; pattern: RegExp; reason: string }> = [
    {
      signal: "explicit_web_research",
      pattern: /上网|联网|搜索|检索|查一下|查找|查阅|调研|web\s*search|browse|look\s*up|research/iu,
      reason: "用户明确要求联网搜索、查找或调研"
    },
    {
      signal: "official_source_or_citation",
      pattern:
        /官网|官方文档|官方资料|官方价格|official|pricing\s*page|\bsources\b|\bcite\b|\bcitation\b|引用|来源|出处|参考链接|来源链接|官方链接|官网链接|证据|佐证/iu,
      reason: "用户要求官方资料、来源、引用或证据"
    },
    {
      signal: "current_or_latest_fact",
      pattern:
        /(?:最新|当前|现在|今天|今日|实时|recent|latest|current|today|now)[^。！？\n]{0,48}(?:价格|报价|费用|定价|pricing|price|模型|版本|发布|新闻|政策|法规|文档|官网|api|名单|列表)|(?:价格|报价|费用|定价|pricing|price)[^。！？\n]{0,48}(?:最新|当前|现在|官网|官方|official)/iu,
      reason: "用户询问最新、当前或实时事实"
    },
    {
      signal: "product_pricing",
      pattern:
        /(?:价格|报价|费用|定价|pricing|price)[^。！？\n]{0,56}(?:anthropic|claude|openai|gemini|deepseek|qwen|grok|doubao|模型|model|api)|(?:anthropic|claude|openai|gemini|deepseek|qwen|grok|doubao|模型|model|api)[^。！？\n]{0,56}(?:价格|报价|费用|定价|pricing|price)/iu,
      reason: "用户询问模型、产品或 API 价格，容易随官网变更"
    },
    {
      signal: "news_or_release",
      pattern: /新闻|公告|发布|release\s*notes?|changelog|版本更新|最新版本|breaking\s*news/iu,
      reason: "用户询问新闻、公告、发布或版本更新"
    }
  ];

  for (const check of checks) {
    if (check.pattern.test(text)) {
      return {
        required: true,
        reason: check.reason,
        matchedSignal: check.signal
      };
    }
  }

  if (extractNonLocalUrls(text).length) {
    return {
      required: true,
      reason: "用户提供了外部 URL，需要读取来源后再回答",
      matchedSignal: "external_url"
    };
  }

  return { required: false, reason: "未发现需要外部证据的任务信号" };
}

export function isExternalEvidenceTool(tool: McpToolDefinition): boolean {
  const name = tool.name.toLowerCase();

  if (EXTERNAL_TOOL_NAMES.has(name)) {
    return true;
  }

  if (inferToolExecutionDomain(tool) !== "web_research") {
    return false;
  }

  const source = `${tool.serverName} ${tool.name} ${tool.description ?? ""}`.toLowerCase();
  return /web|url|http|github|research|official|联网|网页|官网|官方|搜索|调研/u.test(source);
}

function isSuccessfulExternalEvidenceCall(call: AgentMcpCallRecord): boolean {
  if (call.isError) {
    return false;
  }

  const source = `${call.serverName} ${call.toolName}`.toLowerCase();
  const hasResult = Boolean(normalizeText(call.resultText) || call.structuredContent);

  return hasResult && /web[_-]?research|web[_-]?search|read[_-]?web[_-]?page|github[_-]?search|search tools|联网|网页|搜索|调研/u.test(source);
}

function isSuccessfulExternalEvidenceContextCall(call: AgentContextPacket["evidence"]["recentToolCalls"][number]): boolean {
  if (call.isError) {
    return false;
  }

  const source = `${call.serverName} ${call.toolName}`.toLowerCase();
  const hasResult = Boolean(normalizeText(call.result));

  return hasResult && /web[_-]?research|web[_-]?search|read[_-]?web[_-]?page|github[_-]?search|search tools|联网|网页|搜索|调研/u.test(source);
}

export function hasSuccessfulExternalEvidenceInContext(contextPacket: AgentContextPacket): boolean {
  return contextPacket.evidence.recentToolCalls.some(isSuccessfulExternalEvidenceContextCall);
}

export function hasSuccessfulExternalEvidenceCallRecords(mcpCalls: AgentMcpCallRecord[]): boolean {
  return mcpCalls.some(isSuccessfulExternalEvidenceCall);
}

function getSchemaProperties(tool: McpToolDefinition): Record<string, unknown> {
  const properties = tool.inputSchema?.properties;
  return properties && typeof properties === "object" && !Array.isArray(properties) ? (properties as Record<string, unknown>) : {};
}

function getRequiredSchemaKeys(tool: McpToolDefinition): string[] {
  return Array.isArray(tool.inputSchema?.required)
    ? tool.inputSchema.required.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function supportsArgument(tool: McpToolDefinition, key: string): boolean {
  return key in getSchemaProperties(tool);
}

function extractPreferredDomains(text: string): string[] {
  const domains = new Set<string>();

  for (const url of extractNonLocalUrls(text)) {
    try {
      domains.add(new URL(url).hostname.replace(/^www\./iu, ""));
    } catch {
      // Ignore invalid URLs that slipped through the regex.
    }
  }

  for (const entry of KNOWN_OFFICIAL_DOMAINS) {
    if (entry.pattern.test(text)) {
      entry.domains.forEach((domain) => domains.add(domain));
    }
  }

  return [...domains].slice(0, 4);
}

function buildExternalEvidenceArguments(tool: McpToolDefinition, query: string, text: string): Record<string, unknown> | null {
  const name = tool.name.toLowerCase();
  const urls = extractNonLocalUrls(text);
  const preferredDomains = extractPreferredDomains(text);
  const requiredKeys = getRequiredSchemaKeys(tool);
  const args: Record<string, unknown> = {};

  if (name === "read_web_page" || requiredKeys.includes("url")) {
    if (!urls[0]) {
      return null;
    }

    args.url = urls[0];
  }

  if (supportsArgument(tool, "query") || requiredKeys.includes("query")) {
    args.query = query;
  }

  if (supportsArgument(tool, "queries") && preferredDomains.length) {
    args.queries = preferredDomains.map((domain) => `${query} site:${domain}`);
  }

  if (supportsArgument(tool, "preferredDomains") && preferredDomains.length) {
    args.preferredDomains = preferredDomains;
  }

  if (supportsArgument(tool, "maxSearchResults")) {
    args.maxSearchResults = 10;
  }

  if (supportsArgument(tool, "maxPagesToRead")) {
    args.maxPagesToRead = 4;
  }

  if (supportsArgument(tool, "limit")) {
    args.limit = 8;
  }

  if (supportsArgument(tool, "provider")) {
    args.provider = "auto";
  }

  if (name === "github_search_repositories" && supportsArgument(tool, "sort")) {
    args.sort = "best-match";
  }

  for (const key of requiredKeys) {
    if (!(key in args)) {
      return null;
    }
  }

  return args;
}

function scoreExternalEvidenceTool(tool: McpToolDefinition, text: string): number {
  const name = tool.name.toLowerCase();
  const hasUrl = extractNonLocalUrls(text).length > 0;
  const isGithubTask = /github|开源|仓库|repository|repo/iu.test(text);

  if (name === "web_research") {
    return 100;
  }

  if (name === "web_search_v2") {
    return 90;
  }

  if (name === "web_search") {
    return 85;
  }

  if (name === "read_web_page") {
    return hasUrl ? 82 : 20;
  }

  if (name === "github_search_repositories") {
    return isGithubTask ? 80 : 35;
  }

  return inferToolExecutionDomain(tool) === "web_research" ? 60 : 0;
}

export function selectExternalEvidenceTool(
  contextPacket: AgentContextPacket,
  candidateTools: McpToolDefinition[]
): ExternalEvidenceToolSelection | null {
  const text = getExternalEvidenceText(contextPacket);
  const query = getPrimaryRequestText(contextPacket);
  const rankedTools = candidateTools
    .filter(isExternalEvidenceTool)
    .map((tool) => ({
      tool,
      score: scoreExternalEvidenceTool(tool, text)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  for (const entry of rankedTools) {
    const args = buildExternalEvidenceArguments(entry.tool, query, text);

    if (!args) {
      continue;
    }

    return {
      tool: entry.tool,
      arguments: args,
      query,
      reason: `当前请求需要外部证据，自动选择 ${entry.tool.serverName} / ${entry.tool.name} 获取来源后再回答。`,
      expectedOutcome: "返回与用户问题相关的外部来源、摘要或页面正文证据",
      verificationMethod: "检查工具结果中是否包含可引用来源、页面正文、链接或结构化搜索结果"
    };
  }

  return null;
}

export function buildMissingExternalEvidenceFinalInstruction(
  contextPacket: AgentContextPacket,
  mcpCalls: AgentMcpCallRecord[]
): string {
  const requirement = assessExternalEvidenceRequirement(contextPacket);

  if (!requirement.required || hasSuccessfulExternalEvidenceCallRecords(mcpCalls)) {
    return "";
  }

  return `重要证据约束：${requirement.reason}，但本轮没有成功的联网搜索、网页读取或 GitHub 检索工具结果。最终回复不得声称已经实时搜索、官网确认或引用了最新来源；不得输出看似已验证的最新价格、版本、新闻、法规或官方结论表。只能明确说明本轮未完成外部检索，并区分可离线解释的常识与仍需工具验证的事实。`;
}
