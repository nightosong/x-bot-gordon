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

export interface ExternalEvidenceQualityResult {
  success: boolean;
  reason: string;
  expectedDomains: string[];
  primaryTerms: string[];
  secondaryTerms: string[];
  resultHasOfficialDomain: boolean;
  resultIsRelevant: boolean;
  resultIsSufficient: boolean;
  sufficiencySignals: string[];
}

const EXTERNAL_TOOL_NAMES = new Set(["web_research", "web_search_v2", "web_search", "read_web_page", "github_search_repositories"]);

const KNOWN_OFFICIAL_DOMAINS: Array<{ pattern: RegExp; domains: string[] }> = [
  { pattern: /anthropic|claude/iu, domains: ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"] },
  { pattern: /openai|chatgpt|gpt[-\s]?\d|o\d\b/iu, domains: ["openai.com", "platform.openai.com"] },
  { pattern: /google|gemini/iu, domains: ["ai.google.dev", "cloud.google.com"] },
  { pattern: /deepseek|深度求索/iu, domains: ["api-docs.deepseek.com", "deepseek.com"] },
  { pattern: /qwen|通义|千问/iu, domains: ["help.aliyun.com", "dashscope.aliyuncs.com"] },
  { pattern: /doubao|豆包|volcengine|火山引擎/iu, domains: ["volcengine.com"] },
  { pattern: /grok|xai|x\.ai/iu, domains: ["docs.x.ai", "x.ai"] }
];
const KNOWN_OFFICIAL_SOURCE_URLS: Array<{ pattern: RegExp; urls: string[] }> = [
  {
    pattern:
      /(?:anthropic|claude)[^。！？\n]{0,120}(?:model|models|pricing|price|cost|模型|价格|定价|费用|fable|mythos|opus|sonnet|haiku|release|发布)|(?:model|models|pricing|price|cost|模型|价格|定价|费用|fable|mythos|opus|sonnet|haiku|release|发布)[^。！？\n]{0,120}(?:anthropic|claude)/iu,
    urls: [
      "https://platform.claude.com/docs/en/about-claude/models/overview",
      "https://platform.claude.com/docs/en/about-claude/pricing",
      "https://support.claude.com/en/articles/12138966-release-notes",
      "https://www.anthropic.com/news/claude-fable-5-mythos-5",
      "https://www.anthropic.com/news/fable-mythos-access",
      "https://www.anthropic.com/news/claude-opus-4-8"
    ]
  }
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
    ...contextPacket.recovery.userInterruptions,
    ...contextPacket.recentConversation.map((message) => message.content)
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function getPrimaryRequestText(contextPacket: AgentContextPacket): string {
  const text = (
    normalizeText(contextPacket.goal.latestUserRequest) ||
    normalizeText(contextPacket.goal.objective) ||
    normalizeText(contextPacket.goal.nextActionHint) ||
    "当前用户请求"
  );

  return normalizeQueryText(text);
}

function getExpectedOfficialDomains(text: string): string[] {
  const domains = new Set<string>();

  for (const entry of KNOWN_OFFICIAL_DOMAINS) {
    if (entry.pattern.test(text)) {
      entry.domains.forEach((domain) => domains.add(domain));
    }
  }

  return [...domains];
}

export function getExternalEvidenceExpectedOfficialDomains(contextPacket: AgentContextPacket): string[] {
  return getExpectedOfficialDomains(getExternalEvidenceText(contextPacket));
}

function getQueryTerms(text: string): { primary: string[]; secondary: string[] } {
  const lowerText = text.toLowerCase();
  const primary = new Set<string>();
  const secondary = new Set<string>();

  for (const term of ["anthropic", "claude", "openai", "chatgpt", "google", "gemini", "deepseek", "qwen", "grok", "doubao"]) {
    if (lowerText.includes(term)) {
      primary.add(term);
    }
  }

  if (primary.has("anthropic")) {
    primary.add("claude");
  }

  if (primary.has("claude")) {
    primary.add("anthropic");
  }

  for (const term of ["model", "models", "pricing", "price"]) {
    if (lowerText.includes(term)) {
      secondary.add(term);
    }
  }

  if (/模型/u.test(text)) {
    secondary.add("模型");
    secondary.add("model");
    secondary.add("models");
  }

  if (/价格|定价|费用/u.test(text)) {
    secondary.add("价格");
    secondary.add("pricing");
    secondary.add("price");
  }

  if (/最新|当前|现在/u.test(text)) {
    secondary.add("最新");
    secondary.add("latest");
    secondary.add("current");
  }

  return {
    primary: [...primary],
    secondary: [...secondary]
  };
}

function hasPricingIntent(text: string): boolean {
  return /价格|定价|费用|报价|pricing|price|cost|rate/iu.test(text);
}

function hasModelCatalogIntent(text: string): boolean {
  return /模型|model|models|api\s*id|model\s*id|旗下|清单|列表|有哪些|可用|现行|最新|当前|release|发布/iu.test(text);
}

function isHomepageOnlyOfficialEvidence(resultText: string): boolean {
  const officialUrls = resultText.match(/https?:\/\/(?:www\.)?(?:anthropic\.com|docs\.anthropic\.com|platform\.claude\.com|support\.claude\.com)(?:\/[^\s"'<>）)】]*)?/giu) ?? [];

  if (!officialUrls.length) {
    return false;
  }

  return officialUrls.every((url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname === "/" || parsed.pathname === "";
    } catch {
      return false;
    }
  });
}

function getEvidenceSufficiencySignals(resultText: string, contextText: string): string[] {
  const signals = new Set<string>();
  const lowerResult = resultText.toLowerCase();

  if (/claude[-\s]?(?:fable|mythos|opus|sonnet|haiku)|claude-[a-z0-9-]+/iu.test(resultText)) {
    signals.add("model_names");
  }

  if (/api\s*id|model\s*id|claude-[a-z0-9-]+/iu.test(resultText)) {
    signals.add("api_ids");
  }

  if (/\$\s*\d+(?:\.\d+)?|\b(?:mtok|million tokens|input tokens|output tokens)\b|输入[^。！？\n]{0,24}(?:输出|tokens)|output[^。！？\n]{0,24}input/iu.test(resultText)) {
    signals.add("pricing_numbers");
  }

  if (/\bpricing\b|价格|定价|费用|input|output|输入|输出/iu.test(resultText)) {
    signals.add("pricing_terms");
  }

  if (/release notes|发布|announced|launched|available|暂停|disabled|access|availability|status/iu.test(resultText)) {
    signals.add("release_status");
  }

  if (/\/(?:docs|news|articles)\//iu.test(resultText) || lowerResult.includes("models/overview") || lowerResult.includes("about-claude/pricing")) {
    signals.add("source_page");
  }

  if (hasPricingIntent(contextText) && !signals.has("pricing_numbers")) {
    return [...signals].filter((signal) => signal !== "pricing_terms");
  }

  return [...signals];
}

function hasSufficientEvidenceText(resultText: string, contextText: string): boolean {
  if (!normalizeText(resultText)) {
    return false;
  }

  if (isHomepageOnlyOfficialEvidence(resultText)) {
    return false;
  }

  const signals = new Set(getEvidenceSufficiencySignals(resultText, contextText));
  const needsPricing = hasPricingIntent(contextText);
  const needsModels = hasModelCatalogIntent(contextText);

  if (needsPricing && !signals.has("pricing_numbers")) {
    return false;
  }

  if (needsModels && !signals.has("model_names") && !signals.has("api_ids")) {
    return false;
  }

  if ((needsPricing || needsModels) && !signals.has("source_page")) {
    return false;
  }

  return true;
}

function normalizeQueryText(text: string): string {
  return text
    .replace(/旗下罪行的模型/gu, "旗下最新的模型")
    .replace(/罪行(?=[^。！？\n]{0,12}模型)/gu, "最新")
    .replace(/查下/gu, "查一下")
    .trim();
}

function stripPoliteSearchPrefix(text: string): string {
  return text
    .replace(/^(?:请|帮我|麻烦|帮忙|给我|你帮我)?\s*(?:联网|上网|实时)?\s*(?:查一下|查一查|查查|查找|查阅|搜索|检索|调研|看看|看下|看一下)\s*/iu, "")
    .replace(/[？?。!！]+$/gu, "")
    .trim();
}

function hasAnthropicModelCatalogIntent(text: string): boolean {
  return /(?:anthropic|claude)[^。！？\n]{0,80}(?:最新|当前|目前|现行|可用|旗下|模型|model|models|pricing|price|价格|定价|release|发布)|(?:最新|当前|目前|现行|可用|旗下|模型|model|models|pricing|price|价格|定价|release|发布)[^。！？\n]{0,80}(?:anthropic|claude)/iu.test(text);
}

function buildCanonicalExternalEvidenceQueries(text: string): string[] {
  const normalized = normalizeQueryText(text);
  const stripped = stripPoliteSearchPrefix(normalized);
  const queries: string[] = [];

  if (hasAnthropicModelCatalogIntent(normalized)) {
    const wantsPricing = /价格|定价|费用|pricing|price/iu.test(normalized);
    queries.push(
      wantsPricing ? "Anthropic Claude latest models pricing official API" : "Anthropic Claude latest models official model overview",
      "Anthropic Claude models overview official docs",
      "Claude model names API IDs latest official docs",
      "site:platform.claude.com/docs Claude models overview",
      "site:docs.anthropic.com Claude models overview",
      "site:anthropic.com/news Claude latest model release",
      "site:support.claude.com Claude release notes latest models"
    );
    if (wantsPricing) {
      queries.push("site:docs.anthropic.com Claude pricing API latest", "site:platform.claude.com/docs Claude pricing API");
    }
  }

  queries.push(stripped || normalized, normalized);
  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 10);
}

function hasOfficialDomainEvidence(resultText: string, expectedDomains: string[]): boolean {
  if (!expectedDomains.length) {
    return true;
  }

  return expectedDomains.some((domain) => new RegExp(`(?:https?://)?(?:www\\.)?${domain.replace(/\./gu, "\\.")}`, "iu").test(resultText));
}

function hasRelevantEvidenceText(resultText: string, queryTerms: { primary: string[]; secondary: string[] }): boolean {
  const primaryTerms = queryTerms.primary;
  const secondaryTerms = queryTerms.secondary;

  if (!primaryTerms.length && !secondaryTerms.length) {
    return Boolean(normalizeText(resultText));
  }

  const lowerResult = resultText.toLowerCase();
  const primaryMatched = primaryTerms.filter((term) => lowerResult.includes(term.toLowerCase())).length;

  if (primaryTerms.length && primaryMatched === 0) {
    return false;
  }

  const secondaryMatched = secondaryTerms.filter((term) => lowerResult.includes(term.toLowerCase())).length;

  return primaryMatched + secondaryMatched >= Math.min(2, primaryTerms.length + secondaryTerms.length);
}

export function assessExternalEvidenceQuality(
  result: Pick<AgentMcpCallRecord, "isError" | "resultText" | "structuredContent" | "artifacts"> | string,
  contextPacket: AgentContextPacket
): ExternalEvidenceQualityResult {
  const contextText = getExternalEvidenceText(contextPacket);
  const expectedDomains = getExpectedOfficialDomains(contextText);
  const queryTerms = getQueryTerms(contextText);
  const resultText =
    typeof result === "string"
      ? normalizeText(result)
      : normalizeText(
          [
            result.resultText,
            result.structuredContent ? JSON.stringify(result.structuredContent) : "",
            result.artifacts ? JSON.stringify(result.artifacts) : ""
          ].join("\n")
        );

  if (typeof result !== "string" && result.isError) {
    return {
      success: false,
      reason: "工具调用失败，不能作为外部证据",
      expectedDomains,
      primaryTerms: queryTerms.primary,
      secondaryTerms: queryTerms.secondary,
      resultHasOfficialDomain: false,
      resultIsRelevant: false,
      resultIsSufficient: false,
      sufficiencySignals: []
    };
  }

  if (!resultText) {
    return {
      success: false,
      reason: "工具没有返回可检验文本",
      expectedDomains,
      primaryTerms: queryTerms.primary,
      secondaryTerms: queryTerms.secondary,
      resultHasOfficialDomain: false,
      resultIsRelevant: false,
      resultIsSufficient: false,
      sufficiencySignals: []
    };
  }

  const resultHasOfficialDomain = hasOfficialDomainEvidence(resultText, expectedDomains);
  const resultIsRelevant = hasRelevantEvidenceText(resultText, queryTerms);
  const sufficiencySignals = getEvidenceSufficiencySignals(resultText, contextText);
  const resultIsSufficient = hasSufficientEvidenceText(resultText, contextText);
  const success = resultHasOfficialDomain && resultIsRelevant && resultIsSufficient;
  const reason = success
    ? "工具结果包含预期官方域名、与用户问题相关，且证据足以支撑本轮回答"
    : !resultHasOfficialDomain
      ? `工具结果未命中预期官方域名：${expectedDomains.join(", ") || "无"}`
      : !resultIsRelevant
        ? "工具结果与用户问题的关键实体或意图不匹配"
        : isHomepageOnlyOfficialEvidence(resultText)
          ? "工具结果只命中官方首页，未读到模型、价格或发布正文页"
          : "工具结果缺少回答本轮问题所需的模型名称、API ID、价格数字或来源正文";

  return {
    success,
    reason,
    expectedDomains,
    primaryTerms: queryTerms.primary,
    secondaryTerms: queryTerms.secondary,
    resultHasOfficialDomain,
    resultIsRelevant,
    resultIsSufficient,
    sufficiencySignals
  };
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
      signal: "vendor_model_catalog",
      pattern:
        /(?:anthropic|claude|openai|chatgpt|google|gemini|deepseek|qwen|grok|doubao)[^。！？\n]{0,56}(?:旗下|目前|当前|现在|最新|现行|可用|在售|有哪些|有什么|列表|清单|模型|model|models)|(?:旗下|目前|当前|现在|最新|现行|可用|在售|有哪些|有什么|列表|清单|模型|model|models)[^。！？\n]{0,56}(?:anthropic|claude|openai|chatgpt|google|gemini|deepseek|qwen|grok|doubao)/iu,
      reason: "用户询问厂商当前模型清单，容易随官方发布变化"
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

function isSuccessfulExternalEvidenceCall(call: AgentMcpCallRecord, contextText = ""): boolean {
  if (call.isError) {
    return false;
  }

  const source = `${call.serverName} ${call.toolName}`.toLowerCase();
  const resultText = normalizeText(
    [
      call.resultText,
      call.structuredContent ? JSON.stringify(call.structuredContent) : "",
      call.artifacts ? JSON.stringify(call.artifacts) : ""
    ].join("\n")
  );
  const hasResult = Boolean(resultText);
  const expectedDomains = getExpectedOfficialDomains(contextText);
  const queryTerms = getQueryTerms(contextText);

  return (
    hasResult &&
    /web[_-]?research|web[_-]?search|read[_-]?web[_-]?page|github[_-]?search|search tools|联网|网页|搜索|调研/u.test(source) &&
    hasOfficialDomainEvidence(resultText, expectedDomains) &&
    hasRelevantEvidenceText(resultText, queryTerms) &&
    hasSufficientEvidenceText(resultText, contextText)
  );
}

function isSuccessfulExternalEvidenceContextCall(call: AgentContextPacket["evidence"]["recentToolCalls"][number], contextText = ""): boolean {
  if (call.isError) {
    return false;
  }

  const source = `${call.serverName} ${call.toolName}`.toLowerCase();
  const resultText = normalizeText(call.result);
  const hasResult = Boolean(resultText);
  const expectedDomains = getExpectedOfficialDomains(contextText);
  const queryTerms = getQueryTerms(contextText);

  return (
    hasResult &&
    /web[_-]?research|web[_-]?search|read[_-]?web[_-]?page|github[_-]?search|search tools|联网|网页|搜索|调研/u.test(source) &&
    hasOfficialDomainEvidence(resultText, expectedDomains) &&
    hasRelevantEvidenceText(resultText, queryTerms) &&
    hasSufficientEvidenceText(resultText, contextText)
  );
}

export function hasSuccessfulExternalEvidenceInContext(contextPacket: AgentContextPacket): boolean {
  const contextText = getExternalEvidenceText(contextPacket);
  return contextPacket.evidence.recentToolCalls.some((call) => isSuccessfulExternalEvidenceContextCall(call, contextText));
}

export function hasSuccessfulExternalEvidenceCallRecords(mcpCalls: AgentMcpCallRecord[], contextPacket?: AgentContextPacket): boolean {
  const contextText = contextPacket ? getExternalEvidenceText(contextPacket) : "";
  return mcpCalls.some((call) => isSuccessfulExternalEvidenceCall(call, contextText));
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

function extractOfficialSourceUrls(text: string): string[] {
  const urls = new Set<string>();

  for (const entry of KNOWN_OFFICIAL_SOURCE_URLS) {
    if (entry.pattern.test(text)) {
      entry.urls.forEach((url) => urls.add(url));
    }
  }

  return [...urls].slice(0, 8);
}

function buildExternalEvidenceArguments(tool: McpToolDefinition, query: string, text: string): Record<string, unknown> | null {
  const name = tool.name.toLowerCase();
  const urls = extractNonLocalUrls(text);
  const preferredDomains = extractPreferredDomains(text);
  const canonicalQueries = buildCanonicalExternalEvidenceQueries(text);
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
    args.queries = [
      ...canonicalQueries.filter((item) => item !== query),
      ...preferredDomains.flatMap((domain) => canonicalQueries.slice(0, 4).map((item) => `site:${domain} ${item.replace(/\bsite:[^\s]+/giu, "").trim()}`))
    ].slice(0, 10);
  }

  if (supportsArgument(tool, "preferredDomains") && preferredDomains.length) {
    args.preferredDomains = preferredDomains;
  }

  if (supportsArgument(tool, "includeDomains") && preferredDomains.length) {
    args.includeDomains = preferredDomains;
  }

  const officialUrls = extractOfficialSourceUrls(text);
  if (supportsArgument(tool, "officialUrls") && officialUrls.length) {
    args.officialUrls = officialUrls;
  }

  if (supportsArgument(tool, "maxSearchResults")) {
    args.maxSearchResults = 10;
  }

  if (supportsArgument(tool, "maxPagesToRead")) {
    args.maxPagesToRead = hasAnthropicModelCatalogIntent(text) ? 6 : 4;
  }

  if (supportsArgument(tool, "limit")) {
    args.limit = 8;
  }

  if (supportsArgument(tool, "provider")) {
    args.provider = "auto";
  }

  if (supportsArgument(tool, "language")) {
    args.language = preferredDomains.length ? "en-US" : "zh-CN";
  }

  if (supportsArgument(tool, "country")) {
    args.country = preferredDomains.length ? "US" : "CN";
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
  const query = buildCanonicalExternalEvidenceQueries(getExternalEvidenceText(contextPacket))[0] ?? getPrimaryRequestText(contextPacket);
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

export function buildExternalEvidenceRetryArguments(
  contextPacket: AgentContextPacket,
  tool: McpToolDefinition,
  priorCalls: AgentMcpCallRecord[] = []
): Record<string, unknown> | null {
  const text = getExternalEvidenceText(contextPacket);
  const canonicalQueries = buildCanonicalExternalEvidenceQueries(text);
  const usedQueries = new Set(
    priorCalls
      .filter((call) => call.toolName === tool.name)
      .map((call) => normalizeText((call.arguments as Record<string, unknown> | undefined)?.query))
      .filter(Boolean)
  );
  const query = canonicalQueries.find((item) => !usedQueries.has(item)) ?? canonicalQueries[0] ?? getPrimaryRequestText(contextPacket);

  return buildExternalEvidenceArguments(tool, query, text);
}

export function buildMissingExternalEvidenceFinalInstruction(
  contextPacket: AgentContextPacket,
  mcpCalls: AgentMcpCallRecord[]
): string {
  const requirement = assessExternalEvidenceRequirement(contextPacket);

  if (!requirement.required || hasSuccessfulExternalEvidenceCallRecords(mcpCalls, contextPacket)) {
    return "";
  }

  return `重要证据约束：${requirement.reason}，但本轮没有成功命中与用户问题相关的可信外部证据；如果问题指向特定厂商或官方资料，还必须命中对应官方域名。最终回复不得声称已经实时搜索、官网确认或引用了最新来源；不得输出看似已验证的最新价格、版本、新闻、法规或官方结论表。只能明确说明本轮未完成有效外部检索，并区分可离线解释的常识与仍需工具验证的事实。`;
}
