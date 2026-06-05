import type { McpToolDefinition } from "../../shared/src/index.js";
import type { AgentContextPacket } from "./context-packet.js";
import {
  buildPlannerToolPayload,
  inferToolCapabilities,
  inferToolCost,
  inferToolExecutionDomain,
  inferToolRiskLevel,
  inferToolReversibility,
  inferToolSideEffects,
  inferToolVerbs
} from "./tool-metadata.js";

type ToolCost = "low" | "medium" | "high";
type ToolRisk = "low" | "medium" | "high";

export interface AgentCapabilityNeed {
  capability: string;
  weight: number;
  reason: string;
}

export interface AgentCapabilityRouteTool {
  serverId: string;
  serverName: string;
  name: string;
  score: number;
  matchedNeeds: string[];
  capability: string[];
  verbs: string[];
  executionDomain: string;
  riskLevel: ToolRisk;
  cost: ToolCost;
  sideEffects: string;
  reversibility: string;
  descriptionSummary: string;
  schemaSummary: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentCapabilityRouteGroup {
  capability: string;
  reason: string;
  tools: AgentCapabilityRouteTool[];
}

export interface AgentCapabilityRoutingContext {
  summary: string;
  needs: AgentCapabilityNeed[];
  groups: AgentCapabilityRouteGroup[];
  visibleToolCount: number;
  hiddenToolCount: number;
  allToolsAvailable: false;
  routingPolicy: string;
}

const MAX_ROUTED_TOOLS_PER_GROUP = 6;
const MAX_VISIBLE_PLANNER_TOOLS = 18;
const DEFAULT_VISIBLE_TOOL_NAMES = ["read_file", "search_files", "web_research"];
const DOMAIN_VISIBLE_TOOL_NAMES: Record<string, string[]> = {
  workspace: ["list_directory", "read_file", "search_files", "validate_json_file", "diff_paths", "run_shell_command"],
  web_research: ["web_research", "github_search_repositories", "open_url", "read_web_page"],
  desktop: ["get_app_state", "open_app", "open_url", "wait", "click_text"],
  generation: ["image_gen", "music_gen"],
  writing_asset: ["writing_list_books", "writing_read_book", "writing_search_book"],
  comic_asset: ["comic_list_projects", "comic_read_project"],
  application_asset: ["writing_list_books", "writing_read_book", "writing_search_book", "comic_list_projects", "comic_read_project"]
};
const DOMAIN_WRITE_TOOL_NAMES: Record<string, string[]> = {
  workspace: ["write_file", "replace_in_file"],
  writing_asset: ["writing_create_book", "writing_update_chapter", "writing_update_book_fields", "writing_update_story_assets"],
  comic_asset: [
    "comic_create_chapter",
    "comic_update_chapter",
    "comic_update_project_fields",
    "comic_update_chapter_images",
    "comic_update_assets"
  ],
  application_asset: [
    "writing_update_chapter",
    "writing_update_book_fields",
    "writing_update_story_assets",
    "comic_create_chapter",
    "comic_update_chapter",
    "comic_update_project_fields",
    "comic_update_chapter_images",
    "comic_update_assets"
  ]
};
const DOMAIN_VERIFY_TOOL_NAMES: Record<string, string[]> = {
  workspace: ["read_file", "search_files", "validate_json_file", "diff_paths"],
  web_research: ["web_research", "read_web_page", "github_search_repositories"],
  desktop: ["get_app_state"],
  writing_asset: ["writing_list_books", "writing_read_book", "writing_search_book"],
  comic_asset: ["comic_list_projects", "comic_read_project"],
  application_asset: [
    "writing_list_books",
    "writing_read_book",
    "writing_search_book",
    "comic_list_projects",
    "comic_read_project"
  ]
};
const PLANNER_DOMAIN_NEEDS = new Set(["workspace", "web_research", "desktop", "generation", "writing_asset", "comic_asset", "application_asset"]);
const PLANNER_ACTION_NEEDS = new Set(["read", "write", "verify", "operate_media"]);
const DESKTOP_MEDIA_TOOL_NAMES = ["wait", "get_app_state", "click_text", "play_media", "click_window_area", "take_screenshot"];
const HIDDEN_PRIMITIVE_TOOL_NAMES = new Set([
  "path_info",
  "inspect_path",
  "normalize_path",
  "join_path",
  "relative_path",
  "create_directory",
  "move_path",
  "delete_path",
  "web_search",
  "web_search_v2",
  "list_apps",
  "click",
  "type_text",
  "press_key"
]);

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function addNeed(needs: Map<string, AgentCapabilityNeed>, capability: string, weight: number, reason: string): void {
  const current = needs.get(capability);

  if (!current || weight > current.weight) {
    needs.set(capability, {
      capability,
      weight,
      reason
    });
  }
}

function inferNeedsFromContext(contextPacket: AgentContextPacket): AgentCapabilityNeed[] {
  const text = normalizeText(
    [
      contextPacket.goal.latestUserRequest,
      contextPacket.goal.objective,
      contextPacket.goal.nextActionHint,
      ...contextPacket.constraints,
      ...contextPacket.plan.map((step) => `${step.step} ${step.toolHint ?? ""} ${step.successCriteria ?? ""}`),
      ...contextPacket.openQuestions,
      ...contextPacket.verification.structuredSuccessCriteria.map(
        (criterion) => `${criterion.type} ${criterion.target ?? ""} ${criterion.expected} ${criterion.verificationMethod ?? ""}`
      )
    ].join("\n")
  );
  const needs = new Map<string, AgentCapabilityNeed>();

  if (/file|path|workspace|repo|code|diff|json|文件|目录|路径|仓库|代码|读取|修改/u.test(text)) {
    addNeed(needs, "workspace", 7, "任务涉及本地文件、仓库、路径、代码或 JSON");
  }

  if (/search|research|web|url|http|github|latest|official|联网|搜索|调研|网页|官网|最新/u.test(text)) {
    addNeed(needs, "web_research", 7, "任务涉及联网搜索、URL、网页、GitHub、官方资料或最新事实");
  }

  if (/desktop|browser|chrome|click|screenshot|ui|app state|窗口|桌面|浏览器|点击|截图|输入|界面/u.test(text)) {
    addNeed(needs, "desktop", 7, "任务涉及桌面应用、浏览器、点击、输入、截图或 UI 状态");
  }

  if (/play|bilibili|youtube|video site|media|player|watch|episode|播放|开播|视频站|播放器|番剧|剧集|动漫|动画|B站|哔哩|凡人修仙传/iu.test(text)) {
    addNeed(needs, "desktop", 8, "任务涉及浏览器媒体播放，需要桌面状态和网页操作能力");
    addNeed(needs, "operate_media", 7, "任务需要等待页面、点击可见文本、尝试播放并截图验证");
  }

  if (/image|video|music|audio|poster|cover|illustration|图片|图像|视频|音乐|音频|海报|封面|插画|生图/u.test(text)) {
    addNeed(needs, "generation", 7, "任务涉及图片、视频、音乐、音频或生成类产物");
  }

  if (/writing|book|novel|墨笔生花|添香小筑|小说|书稿|书籍/u.test(text)) {
    addNeed(needs, "writing_asset", 8, "任务涉及墨笔生花小说或书稿资产");
  }

  if (/comic|storyboard|丹青溢彩|灵绘小筑|漫画|分镜/u.test(text)) {
    addNeed(needs, "comic_asset", 8, "任务涉及丹青溢彩漫画、章节、分镜或素材资产");
  }

  if (/application|asset|应用|素材|资产/u.test(text)) {
    addNeed(needs, "application_asset", 7, "任务涉及应用广场资产、小说/漫画、章节、分镜、素材或故事资产");
  }

  if (/verify|check|test|exists|contains|status|验证|检查|测试|存在|包含|状态/u.test(text)) {
    addNeed(needs, "verify", 6, "任务处于验证、检查或状态确认语义");
  }

  if (/write|update|replace|create|append|add|save|delete|修改|写入|写回|更新|创建|新增|增加|追加|补全|补充|保存|删除/u.test(text)) {
    addNeed(needs, "write", 5, "任务包含写入、创建、更新或删除意图");
  }

  if (!needs.size) {
    addNeed(needs, "read", 3, "未发现强能力信号，默认优先低风险读取/检查能力");
  }

  return [...needs.values()].sort((left, right) => right.weight - left.weight || left.capability.localeCompare(right.capability));
}

function costPenalty(cost: ToolCost): number {
  if (cost === "high") {
    return 2;
  }

  if (cost === "medium") {
    return 1;
  }

  return 0;
}

function riskPenalty(risk: ToolRisk): number {
  if (risk === "high") {
    return 2;
  }

  if (risk === "medium") {
    return 1;
  }

  return 0;
}

function isPlannerDomainNeed(capability: string): boolean {
  return PLANNER_DOMAIN_NEEDS.has(capability);
}

function isPlannerActionNeed(capability: string): boolean {
  return PLANNER_ACTION_NEEDS.has(capability);
}

function isApplicationSubdomain(domain: string): boolean {
  return domain === "writing_asset" || domain === "comic_asset" || domain === "application_asset";
}

function isToolInDomain(tool: McpToolDefinition | AgentCapabilityRouteTool, domain: string): boolean {
  const toolDomain = "executionDomain" in tool ? tool.executionDomain : inferToolExecutionDomain(tool);

  if (toolDomain === domain) {
    return true;
  }

  if (domain === "application_asset" && isApplicationSubdomain(toolDomain)) {
    return true;
  }

  if (isApplicationSubdomain(domain) && toolDomain === "application_asset") {
    return true;
  }

  return false;
}

function isBridgeToolForDomain(toolName: string, domain: string): boolean {
  return Boolean(DOMAIN_VISIBLE_TOOL_NAMES[domain]?.includes(toolName));
}

function isToolRelevantToDomains(tool: McpToolDefinition | AgentCapabilityRouteTool, domains: Set<string>): boolean {
  if (!domains.size) {
    return true;
  }

  for (const domain of domains) {
    if (isToolInDomain(tool, domain) || isBridgeToolForDomain(tool.name, domain)) {
      return true;
    }
  }

  return false;
}

function scoreToolForNeed(tool: McpToolDefinition, need: AgentCapabilityNeed): AgentCapabilityRouteTool {
  const capability = inferToolCapabilities(tool);
  const verbs = inferToolVerbs(tool);
  const executionDomain = inferToolExecutionDomain(tool);
  const riskLevel = inferToolRiskLevel(tool);
  const cost = inferToolCost(tool);
  const payload = buildPlannerToolPayload([tool])[0] ?? {};
  const toolText = normalizeText(`${tool.serverName} ${tool.name} ${tool.description ?? ""}`);
  const matchedNeeds: string[] = [];
  let score = 0;

  if (isPlannerDomainNeed(need.capability) && isToolInDomain(tool, need.capability)) {
    score += need.weight + 4;
    matchedNeeds.push(`domain:${need.capability}`);
  }

  if (capability.includes(need.capability)) {
    score += need.weight + 3;
    matchedNeeds.push(`capability:${need.capability}`);
  }

  if (verbs.includes(need.capability)) {
    score += need.weight + 2;
    matchedNeeds.push(`verb:${need.capability}`);
  }

  if (need.capability === "verify" && capability.includes("read")) {
    score += 2;
    matchedNeeds.push("readable_verification");
  }

  if (need.capability === "writing_asset" && /writing|book|novel|小说|书稿/u.test(toolText)) {
    score += need.weight + 4;
    matchedNeeds.push("domain:writing_asset");
  }

  if (need.capability === "comic_asset" && /comic|storyboard|漫画|分镜/u.test(toolText)) {
    score += need.weight + 4;
    matchedNeeds.push("domain:comic_asset");
  }

  score -= costPenalty(cost);
  score -= riskPenalty(riskLevel);

  return {
    serverId: tool.serverId,
    serverName: tool.serverName,
    name: tool.name,
    score,
    matchedNeeds,
    capability,
    verbs,
    executionDomain,
    riskLevel,
    cost,
    sideEffects: inferToolSideEffects(tool),
    reversibility: inferToolReversibility(tool),
    descriptionSummary: String(payload.descriptionSummary ?? ""),
    schemaSummary: String(payload.schemaSummary ?? ""),
    inputSchema: (payload.inputSchema && typeof payload.inputSchema === "object" ? payload.inputSchema : {}) as Record<string, unknown>
  };
}

export function buildCapabilityRoutingContext(
  contextPacket: AgentContextPacket,
  candidateTools: McpToolDefinition[]
): AgentCapabilityRoutingContext {
  const needs = inferNeedsFromContext(contextPacket);
  const domainNeeds = new Set(needs.filter((need) => isPlannerDomainNeed(need.capability)).map((need) => need.capability));
  const groups = needs.map((need) => {
    const scopedTools =
      isPlannerActionNeed(need.capability) && domainNeeds.size
        ? candidateTools.filter((tool) => isToolRelevantToDomains(tool, domainNeeds))
        : candidateTools;
    const tools = scopedTools
      .map((tool) => scoreToolForNeed(tool, need))
      .filter((tool) => tool.score > 0)
      .sort((left, right) => right.score - left.score || left.serverName.localeCompare(right.serverName) || left.name.localeCompare(right.name))
      .slice(0, MAX_ROUTED_TOOLS_PER_GROUP);

    return {
      capability: need.capability,
      reason: need.reason,
      tools
    };
  });
  const routedCount = new Set(groups.flatMap((group) => group.tools.map((tool) => `${tool.serverId}:${tool.name}`))).size;
  const visibleTools = buildPlannerVisibleTools(candidateTools, groups);

  return {
    summary: `Capability Routing 已生成 Planner Tool View：识别 ${needs.length} 个能力需求，推荐关注 ${routedCount}/${candidateTools.length} 个工具；本轮 planner 只可从 ${visibleTools.length} 个可见工具中选择，隐藏 ${candidateTools.length - visibleTools.length} 个底层原语或低相关工具。`,
    needs,
    groups,
    visibleToolCount: visibleTools.length,
    hiddenToolCount: Math.max(0, candidateTools.length - visibleTools.length),
    allToolsAvailable: false,
    routingPolicy:
      "Planner Tool View 是本轮工具白名单：模型只能选择可见工具列表中的工具；路径拼接、桌面点击/输入/按键等底层原语默认隐藏，除非没有更高层语义工具可用。"
  };
}

function toolKey(tool: Pick<McpToolDefinition, "serverId" | "name">): string {
  return `${tool.serverId}:${tool.name}`;
}

function comparePlannerTools(left: McpToolDefinition, right: McpToolDefinition): number {
  const leftRisk = inferToolRiskLevel(left);
  const rightRisk = inferToolRiskLevel(right);
  const leftCost = inferToolCost(left);
  const rightCost = inferToolCost(right);
  const riskOrder = { low: 0, medium: 1, high: 2 } as const;
  const costOrder = { low: 0, medium: 1, high: 2 } as const;

  return (
    riskOrder[leftRisk] - riskOrder[rightRisk] ||
    costOrder[leftCost] - costOrder[rightCost] ||
    left.serverName.localeCompare(right.serverName) ||
    left.name.localeCompare(right.name)
  );
}

export function buildPlannerVisibleTools(
  candidateTools: McpToolDefinition[],
  groups: AgentCapabilityRouteGroup[],
  maxVisibleTools = MAX_VISIBLE_PLANNER_TOOLS
): McpToolDefinition[] {
  const selected = new Map<string, McpToolDefinition>();
  const needs = new Set(groups.map((group) => group.capability));
  const domainNeeds = new Set([...needs].filter((capability) => isPlannerDomainNeed(capability)));
  const hasWriteNeed = needs.has("write");
  const hasVerifyNeed = needs.has("verify");
  const hasMediaOperationNeed = needs.has("operate_media");
  const effectiveDomains = domainNeeds.size ? domainNeeds : new Set(["read"]);
  const addTool = (tool: McpToolDefinition | undefined, options: { allowPrimitive?: boolean } = {}): void => {
    if (!tool) {
      return;
    }

    if (!options.allowPrimitive && HIDDEN_PRIMITIVE_TOOL_NAMES.has(tool.name)) {
      return;
    }

    selected.set(toolKey(tool), tool);
  };
  const addToolByName = (toolName: string): void => {
    addTool(candidateTools.find((tool) => tool.name === toolName));
  };

  for (const domain of effectiveDomains) {
    const toolNames = domain === "read" ? DEFAULT_VISIBLE_TOOL_NAMES : DOMAIN_VISIBLE_TOOL_NAMES[domain] ?? [];

    for (const toolName of toolNames) {
      addToolByName(toolName);
    }
  }

  if (hasWriteNeed) {
    for (const domain of domainNeeds) {
      for (const toolName of DOMAIN_WRITE_TOOL_NAMES[domain] ?? []) {
        addToolByName(toolName);
      }
    }
  }

  if (hasVerifyNeed) {
    for (const domain of domainNeeds) {
      for (const toolName of DOMAIN_VERIFY_TOOL_NAMES[domain] ?? []) {
        addToolByName(toolName);
      }
    }
  }

  if (hasMediaOperationNeed && domainNeeds.has("desktop")) {
    for (const toolName of DESKTOP_MEDIA_TOOL_NAMES) {
      addToolByName(toolName);
    }
  }

  for (const group of groups) {
    for (const routedTool of group.tools) {
      if (isPlannerDomainNeed(group.capability) && !isToolRelevantToDomains(routedTool, new Set([group.capability]))) {
        continue;
      }

      if (!isPlannerDomainNeed(group.capability) && !domainNeeds.size) {
        continue;
      }

      if (!isPlannerDomainNeed(group.capability) && !isToolRelevantToDomains(routedTool, domainNeeds)) {
        continue;
      }

      if (routedTool.sideEffects === "stateful" && !hasWriteNeed && !domainNeeds.has("generation")) {
        continue;
      }

      addTool(candidateTools.find((tool) => tool.serverId === routedTool.serverId && tool.name === routedTool.name));
    }
  }

  if (!selected.size) {
    for (const toolName of DEFAULT_VISIBLE_TOOL_NAMES) {
      addToolByName(toolName);
    }
  }

  if (!selected.size) {
    const fallbackTools = candidateTools.filter((entry) => !HIDDEN_PRIMITIVE_TOOL_NAMES.has(entry.name)).sort(comparePlannerTools);

    for (const tool of fallbackTools.length ? fallbackTools : candidateTools.sort(comparePlannerTools)) {
      addTool(tool, { allowPrimitive: !fallbackTools.length });
    }
  }

  if (selected.size > maxVisibleTools) {
    const routedKeys = new Set(groups.flatMap((group) => group.tools.map((tool) => `${tool.serverId}:${tool.name}`)));
    const entries = [...selected.values()].sort((left, right) => {
      const leftRouted = routedKeys.has(toolKey(left)) ? 0 : 1;
      const rightRouted = routedKeys.has(toolKey(right)) ? 0 : 1;

      return leftRouted - rightRouted || comparePlannerTools(left, right);
    });

    return entries.slice(0, maxVisibleTools);
  }

  return [...selected.values()].sort(comparePlannerTools);
}
