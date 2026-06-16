import type { McpToolDefinition } from "../../shared/src/index.js";
import { buildPlannerVisibleTools } from "./capability-router.js";
import type { AgentCapabilityRoutingContext } from "./capability-router.js";
import type { AgentContextPacket } from "./context-packet.js";
import {
  assessExternalEvidenceRequirement,
  selectExternalEvidenceTool
} from "./external-evidence.js";
import { stringifyArguments } from "./runtime-utils.js";
import {
  inferToolCapabilities,
  inferToolExecutionDomain,
  inferToolRiskLevel,
  inferToolSideEffects
} from "./tool-metadata.js";

export type AgentToolRequirementMode = "forbidden" | "optional" | "required";
export type AgentToolRouteStrength = "none" | "weak" | "strong";
export type AgentToolRequirementCapability =
  | "none"
  | "external_evidence"
  | "workspace"
  | "desktop"
  | "generation"
  | "application_asset";

export interface AgentToolRequirementDecision {
  mode: AgentToolRequirementMode;
  routeStrength: AgentToolRouteStrength;
  capability: AgentToolRequirementCapability;
  reasons: string[];
  preferredToolNames: string[];
  fallbackPolicy: "none" | "rule_based" | "safe_fail";
}

export interface AgentRequiredToolFallbackPlan {
  shouldCall: true;
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reason: string;
  expectedOutcome: string;
  verificationMethod: string;
}

const WORKSPACE_TOOL_PREFERENCE = [
  "inspect_path",
  "read_file",
  "list_files",
  "search_files",
  "diff_paths",
  "run_shell_command"
];
const DESKTOP_TOOL_PREFERENCE = [
  "get_app_state",
  "open_app",
  "open_url",
  "wait_for_page_load",
  "click_text",
  "screenshot",
  "click",
  "type_text",
  "press_key"
];
const GENERATION_TOOL_PREFERENCE = ["video_gen", "music_gen", "image_gen"];
const APPLICATION_TOOL_PREFERENCE = [
  "writing_read_book",
  "writing_search_book",
  "writing_read_chapter",
  "writing_update_chapter",
  "writing_update_book_fields",
  "writing_update_story_assets",
  "writing_create_book",
  "comic_read_project",
  "comic_create_project",
  "comic_import_chapters",
  "comic_create_chapter",
  "comic_update_project_fields",
  "comic_update_chapter",
  "comic_update_storyboard",
  "comic_update_images",
  "comic_update_assets"
];

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function getRequirementText(contextPacket: AgentContextPacket): string {
  return [
    contextPacket.goal.latestUserRequest,
    contextPacket.goal.objective,
    contextPacket.goal.nextActionHint,
    ...contextPacket.constraints,
    ...contextPacket.openQuestions,
    ...contextPacket.recentConversation.map((message) => message.content),
    contextPacket.resources.summary,
    contextPacket.resources.gatewayPlan.summary
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function getPrimaryRequest(contextPacket: AgentContextPacket): string {
  return (
    normalizeText(contextPacket.goal.latestUserRequest) ||
    normalizeText(contextPacket.goal.objective) ||
    normalizeText(contextPacket.goal.nextActionHint) ||
    "当前用户请求"
  );
}

function hasAvailableDomain(candidateTools: McpToolDefinition[], domains: string[]): boolean {
  return candidateTools.some((tool) => domains.includes(inferToolExecutionDomain(tool)));
}

function hasToolName(candidateTools: McpToolDefinition[], toolNames: string[]): boolean {
  const names = new Set(toolNames);
  return candidateTools.some((tool) => names.has(tool.name));
}

function decision(input: {
  mode: AgentToolRequirementMode;
  routeStrength: AgentToolRouteStrength;
  capability: AgentToolRequirementCapability;
  reasons: string[];
  preferredToolNames?: string[];
  fallbackPolicy?: AgentToolRequirementDecision["fallbackPolicy"];
}): AgentToolRequirementDecision {
  return {
    mode: input.mode,
    routeStrength: input.routeStrength,
    capability: input.capability,
    reasons: input.reasons.filter(Boolean),
    preferredToolNames: input.preferredToolNames ?? [],
    fallbackPolicy: input.fallbackPolicy ?? (input.mode === "required" ? "rule_based" : "none")
  };
}

export function assessToolRequirement(
  contextPacket: AgentContextPacket,
  candidateTools: McpToolDefinition[]
): AgentToolRequirementDecision {
  if (!candidateTools.length) {
    return decision({
      mode: "optional",
      routeStrength: "none",
      capability: "none",
      reasons: ["当前没有可用工具，Runtime 无法强制工具执行"],
      fallbackPolicy: "none"
    });
  }

  const text = getRequirementText(contextPacket);
  const primaryResource = contextPacket.resources.primaryResource;
  const resourceDomain = primaryResource?.domain;
  const riskBoundary = contextPacket.resources.capabilityFrame.riskBoundary;
  const externalEvidence = assessExternalEvidenceRequirement(contextPacket);

  if (
    externalEvidence.required &&
    hasAvailableDomain(candidateTools, ["web_research"])
  ) {
    return decision({
      mode: "required",
      routeStrength: "strong",
      capability: "external_evidence",
      reasons: [externalEvidence.reason],
      preferredToolNames: ["web_research", "web_search_v2", "read_web_page", "web_search", "github_search_repositories"]
    });
  }

  if (
    (resourceDomain === "workspace" ||
      resourceDomain === "codebase" ||
      contextPacket.resources.resolvedRefs.some((ref) => ref.kind === "path") ||
      /(?:workspace|工作区|仓库|项目|目录|文件|markdown|md 文件|代码|README|readme|package\.json|src\/|packages\/|apps\/|docs\/|\.ts\b|\.js\b|\.md\b|\.json\b)[^。！？\n]{0,48}(?:查看|检查|读取|列出|搜索|查找|修改|更新|写入|删除|运行|验证|存在|有哪些)|(?:查看|检查|读取|列出|搜索|查找|修改|更新|写入|删除|运行|验证)[^。！？\n]{0,64}(?:workspace|工作区|仓库|项目|目录|文件|markdown|md 文件|代码|README|readme|package\.json|src\/|packages\/|apps\/|docs\/|\.ts\b|\.js\b|\.md\b|\.json\b)/iu.test(text)) &&
    hasAvailableDomain(candidateTools, ["workspace"])
  ) {
    return decision({
      mode: "required",
      routeStrength: "strong",
      capability: "workspace",
      reasons: ["用户请求依赖本地 workspace、文件、目录或代码状态，必须通过工具读取或验证"],
      preferredToolNames: WORKSPACE_TOOL_PREFERENCE
    });
  }

  if (
    (resourceDomain === "desktop" ||
      contextPacket.resources.resolvedRefs.some((ref) => ref.kind === "app") ||
      /(?:打开|点击|输入|按键|截图|桌面|浏览器|窗口|播放|Chrome|Safari|Finder|应用|app\b|computer use|desktop|screenshot|click|type)/iu.test(text)) &&
    hasAvailableDomain(candidateTools, ["desktop"])
  ) {
    return decision({
      mode: "required",
      routeStrength: "strong",
      capability: "desktop",
      reasons: ["用户请求依赖桌面应用或浏览器真实状态，必须通过 Computer Use 类工具执行"],
      preferredToolNames: DESKTOP_TOOL_PREFERENCE
    });
  }

  if (
    (resourceDomain === "media" ||
      /(?:生成|制作|画一张|做一段|出图|生图|视频|音乐|音频|歌曲|BGM|封面图|image_gen|video_gen|music_gen)/iu.test(text)) &&
    (hasAvailableDomain(candidateTools, ["generation"]) || hasToolName(candidateTools, GENERATION_TOOL_PREFERENCE))
  ) {
    return decision({
      mode: "required",
      routeStrength: "strong",
      capability: "generation",
      reasons: ["用户请求生成或查询媒体产物，必须调用生成类工具"],
      preferredToolNames: GENERATION_TOOL_PREFERENCE
    });
  }

  if (
    (resourceDomain === "writing" ||
      resourceDomain === "comic" ||
      resourceDomain === "artifact" ||
      /(?:墨笔生花|丹青溢彩|小说|书稿|章节|漫画|分镜|素材|项目)[^。！？\n]{0,64}(?:创建|新增|导入|读取|查看|搜索|检查|写回|保存|更新|修改|替换|删除|补全)|(?:创建|新增|导入|读取|查看|搜索|检查|写回|保存|更新|修改|替换|删除|补全)[^。！？\n]{0,64}(?:墨笔生花|丹青溢彩|小说|书稿|章节|漫画|分镜|素材|项目)/iu.test(text)) &&
    hasAvailableDomain(candidateTools, ["writing_asset", "comic_asset", "application_asset"])
  ) {
    return decision({
      mode: "required",
      routeStrength: "strong",
      capability: "application_asset",
      reasons: [
        riskBoundary === "read_only"
          ? "用户请求读取或检查应用资产，应通过 Application Tools 获得真实资产状态"
          : "用户请求创建、写回或更新应用资产，必须通过 Application Tools 或等价工具执行"
      ],
      preferredToolNames: APPLICATION_TOOL_PREFERENCE
    });
  }

  return decision({
    mode: "optional",
    routeStrength: "weak",
    capability: "none",
    reasons: ["未发现必须调用工具的高确定性信号，允许 Planner 自主判断"],
    fallbackPolicy: "none"
  });
}

export function formatToolRequirementDecision(decisionValue: AgentToolRequirementDecision): string {
  return [
    `mode=${decisionValue.mode}`,
    `capability=${decisionValue.capability}`,
    `routeStrength=${decisionValue.routeStrength}`,
    `fallbackPolicy=${decisionValue.fallbackPolicy}`,
    `preferredTools=${decisionValue.preferredToolNames.join(", ") || "none"}`,
    `reasons=${decisionValue.reasons.join("；") || "无"}`
  ].join("\n");
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

function firstResolvedRef(contextPacket: AgentContextPacket, kinds: string[]): string {
  const ref = contextPacket.resources.resolvedRefs.find((entry) => kinds.includes(entry.kind));
  return normalizeText(ref?.value);
}

function firstStringHint(contextPacket: AgentContextPacket, keys: string[]): string {
  const hints = contextPacket.resources.gatewayPlan.argumentHints;

  for (const key of keys) {
    const value = hints[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function firstNumberHint(contextPacket: AgentContextPacket, keys: string[]): number | null {
  const hints = contextPacket.resources.gatewayPlan.argumentHints;

  for (const key of keys) {
    const value = hints[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function isMutationRequest(contextPacket: AgentContextPacket): boolean {
  const text = getRequirementText(contextPacket);
  return /创建|新增|导入|写回|保存|更新|修改|替换|删除|生成|制作|create|write|update|replace|delete|save|import|generate/iu.test(text);
}

function chooseGenerationToolName(contextPacket: AgentContextPacket, availableNames: Set<string>): string {
  const text = getRequirementText(contextPacket);

  if (/视频|video|短片|镜头/iu.test(text) && availableNames.has("video_gen")) {
    return "video_gen";
  }

  if (/音乐|音频|歌曲|BGM|曲子|music|audio|song/iu.test(text) && availableNames.has("music_gen")) {
    return "music_gen";
  }

  if (availableNames.has("image_gen")) {
    return "image_gen";
  }

  return [...availableNames][0] ?? "";
}

function scoreToolForRequirement(
  tool: McpToolDefinition,
  requirement: AgentToolRequirementDecision,
  contextPacket: AgentContextPacket
): number {
  const domain = inferToolExecutionDomain(tool);
  const capabilities = inferToolCapabilities(tool);
  const sideEffects = inferToolSideEffects(tool);
  const riskLevel = inferToolRiskLevel(tool);
  const preferredIndex = requirement.preferredToolNames.indexOf(tool.name);
  let score = preferredIndex >= 0 ? 100 - preferredIndex : 0;

  if (requirement.capability === "workspace" && domain === "workspace") {
    score += 60;
  }

  if (requirement.capability === "desktop" && domain === "desktop") {
    score += 60;
  }

  if (requirement.capability === "generation" && (domain === "generation" || capabilities.includes("generate"))) {
    const preferredName = chooseGenerationToolName(
      contextPacket,
      new Set(requirement.preferredToolNames.filter((name) => name === tool.name))
    );
    score += tool.name === preferredName ? 80 : 40;
  }

  if (
    requirement.capability === "application_asset" &&
    ["writing_asset", "comic_asset", "application_asset"].includes(domain)
  ) {
    score += 60;
    if (!isMutationRequest(contextPacket) && sideEffects === "read_only") {
      score += 30;
    }
  }

  if (sideEffects === "read_only") {
    score += 8;
  }

  if (riskLevel === "low") {
    score += 4;
  }

  return score;
}

function completeRequiredArguments(tool: McpToolDefinition, args: Record<string, unknown>): Record<string, unknown> | null {
  const requiredKeys = getRequiredSchemaKeys(tool);

  for (const key of requiredKeys) {
    const value = args[key];

    if (typeof value === "string" && !value.trim()) {
      return null;
    }

    if (value === undefined || value === null) {
      return null;
    }
  }

  return args;
}

function buildWorkspaceFallbackArguments(tool: McpToolDefinition, contextPacket: AgentContextPacket): Record<string, unknown> | null {
  const args: Record<string, unknown> = {};
  const pathValue = firstStringHint(contextPacket, ["path"]) || firstResolvedRef(contextPacket, ["path"]);
  const query = getPrimaryRequest(contextPacket);

  if (supportsArgument(tool, "path")) {
    args.path = pathValue || ".";
  }

  if (supportsArgument(tool, "root")) {
    args.root = pathValue || ".";
  }

  if (supportsArgument(tool, "query")) {
    args.query = query;
  }

  if (supportsArgument(tool, "pattern")) {
    args.pattern = /\.(md|markdown)$/iu.test(query) ? "*.md" : query;
  }

  if (supportsArgument(tool, "command") && tool.name === "run_shell_command") {
    return null;
  }

  return completeRequiredArguments(tool, args);
}

function buildDesktopFallbackArguments(tool: McpToolDefinition, contextPacket: AgentContextPacket): Record<string, unknown> | null {
  const args: Record<string, unknown> = {};
  const app = firstStringHint(contextPacket, ["app"]) || firstResolvedRef(contextPacket, ["app"]);
  const url = firstStringHint(contextPacket, ["url"]) || firstResolvedRef(contextPacket, ["url"]);

  if (supportsArgument(tool, "app")) {
    args.app = app || "Google Chrome";
  }

  if (supportsArgument(tool, "url")) {
    if (!url) {
      return null;
    }
    args.url = url;
  }

  return completeRequiredArguments(tool, args);
}

function buildGenerationFallbackArguments(tool: McpToolDefinition, contextPacket: AgentContextPacket): Record<string, unknown> | null {
  const args: Record<string, unknown> = {};
  const prompt = getPrimaryRequest(contextPacket);
  const taskId = firstStringHint(contextPacket, ["taskId"]) || firstResolvedRef(contextPacket, ["task"]);

  if (supportsArgument(tool, "operation")) {
    args.operation = /查询|轮询|状态|result|query|poll/iu.test(prompt) && taskId ? "query" : "submit";
  }

  if (supportsArgument(tool, "prompt")) {
    args.prompt = prompt;
  }

  if (supportsArgument(tool, "taskId") && taskId) {
    args.taskId = taskId;
  }

  if (supportsArgument(tool, "size") && tool.name === "image_gen") {
    args.size = /9\s*:\s*16|竖版|竖屏/iu.test(prompt)
      ? "1024x1792"
      : /1\s*:\s*1|方图|头像|正方形/iu.test(prompt)
        ? "1024x1024"
        : "1792x1024";
  }

  return completeRequiredArguments(tool, args);
}

function buildApplicationFallbackArguments(tool: McpToolDefinition, contextPacket: AgentContextPacket): Record<string, unknown> | null {
  const args: Record<string, unknown> = {};
  const bookIdOrTitle = firstStringHint(contextPacket, ["bookIdOrTitle"]) || firstResolvedRef(contextPacket, ["book"]);
  const projectIdOrTitle = firstStringHint(contextPacket, ["projectIdOrTitle"]) || firstResolvedRef(contextPacket, ["comic_project"]);
  const chapterId = firstStringHint(contextPacket, ["chapterId"]) || firstResolvedRef(contextPacket, ["chapter", "comic_chapter"]);
  const chapterIndex = firstNumberHint(contextPacket, ["chapterIndex"]);

  if (supportsArgument(tool, "bookIdOrTitle")) {
    if (!bookIdOrTitle) {
      return null;
    }
    args.bookIdOrTitle = bookIdOrTitle;
  }

  if (supportsArgument(tool, "projectIdOrTitle")) {
    if (!projectIdOrTitle) {
      return null;
    }
    args.projectIdOrTitle = projectIdOrTitle;
  }

  if (supportsArgument(tool, "chapterId") && chapterId) {
    args.chapterId = chapterId;
  }

  if (supportsArgument(tool, "chapterIndex") && chapterIndex !== null) {
    args.chapterIndex = chapterIndex;
  }

  if (supportsArgument(tool, "query")) {
    args.query = getPrimaryRequest(contextPacket);
  }

  if (supportsArgument(tool, "dryRun")) {
    args.dryRun = !/(?:dryRun\s*=\s*false|写回|保存|应用|提交|正式更新|落盘)/iu.test(getRequirementText(contextPacket));
  }

  return completeRequiredArguments(tool, args);
}

function buildRuleBasedArguments(
  requirement: AgentToolRequirementDecision,
  tool: McpToolDefinition,
  contextPacket: AgentContextPacket
): Record<string, unknown> | null {
  if (requirement.capability === "workspace") {
    return buildWorkspaceFallbackArguments(tool, contextPacket);
  }

  if (requirement.capability === "desktop") {
    return buildDesktopFallbackArguments(tool, contextPacket);
  }

  if (requirement.capability === "generation") {
    return buildGenerationFallbackArguments(tool, contextPacket);
  }

  if (requirement.capability === "application_asset") {
    return buildApplicationFallbackArguments(tool, contextPacket);
  }

  return null;
}

export function selectRequiredToolFallbackPlan(input: {
  requirement: AgentToolRequirementDecision;
  contextPacket: AgentContextPacket;
  candidateTools: McpToolDefinition[];
  routingContext: AgentCapabilityRoutingContext;
}): AgentRequiredToolFallbackPlan | null {
  const { requirement, contextPacket, candidateTools, routingContext } = input;

  if (requirement.mode !== "required") {
    return null;
  }

  const visibleTools = buildPlannerVisibleTools(candidateTools, routingContext.groups);

  if (requirement.capability === "external_evidence") {
    const externalPlan = selectExternalEvidenceTool(contextPacket, visibleTools);

    if (!externalPlan) {
      return null;
    }

    return {
      shouldCall: true,
      serverId: externalPlan.tool.serverId,
      toolName: externalPlan.tool.name,
      arguments: externalPlan.arguments,
      reason: externalPlan.reason,
      expectedOutcome: externalPlan.expectedOutcome,
      verificationMethod: externalPlan.verificationMethod
    };
  }

  const rankedTools = visibleTools
    .map((tool) => ({
      tool,
      score: scoreToolForRequirement(tool, requirement, contextPacket)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  for (const entry of rankedTools) {
    const args = buildRuleBasedArguments(requirement, entry.tool, contextPacket);

    if (!args) {
      continue;
    }

    return {
      shouldCall: true,
      serverId: entry.tool.serverId,
      toolName: entry.tool.name,
      arguments: args,
      reason: `Runtime 判定本轮必须使用工具（${requirement.capability}）：${requirement.reasons.join("；")}；已按规则选择 ${entry.tool.serverName} / ${entry.tool.name}。参数：${stringifyArguments(args)}`,
      expectedOutcome: buildFallbackExpectedOutcome(requirement),
      verificationMethod: buildFallbackVerificationMethod(requirement)
    };
  }

  return null;
}

function buildFallbackExpectedOutcome(requirement: AgentToolRequirementDecision): string {
  switch (requirement.capability) {
    case "workspace":
      return "返回本地文件、目录、代码或 workspace 状态的真实工具结果";
    case "desktop":
      return "返回桌面应用、浏览器页面或 UI 状态的真实工具结果";
    case "generation":
      return "返回生成任务状态、artifact、媒体 URL 或可继续查询的 taskId";
    case "application_asset":
      return "返回应用资产的读取、预览或写入结果";
    case "external_evidence":
      return "返回外部来源、搜索结果、页面正文或可引用证据";
    default:
      return "返回满足用户目标的工具结果";
  }
}

function buildFallbackVerificationMethod(requirement: AgentToolRequirementDecision): string {
  switch (requirement.capability) {
    case "workspace":
      return "检查工具结果是否包含目标路径、文件内容、目录列表或命令状态";
    case "desktop":
      return "检查工具结果是否包含目标应用、可见文本、截图或 UI 状态";
    case "generation":
      return "检查 structuredContent 是否包含 artifacts、status、taskId 或媒体 URL";
    case "application_asset":
      return "检查工具结果是否包含应用资产内容、dryRun 预览、applied 状态或读回字段";
    case "external_evidence":
      return "检查工具结果是否包含来源链接、页面正文、搜索结果或 GitHub 仓库信息";
    default:
      return "检查工具结果是否提供可引用证据";
  }
}
