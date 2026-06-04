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
  allToolsAvailable: true;
  routingPolicy: string;
}

const MAX_ROUTED_TOOLS_PER_GROUP = 6;

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

  if (/image|video|music|audio|generate|poster|图片|视频|音乐|音频|生成|海报/u.test(text)) {
    addNeed(needs, "generation", 7, "任务涉及图片、视频、音乐、音频或生成类产物");
  }

  if (/writing|comic|book|chapter|novel|application|story|asset|storyboard|小说|漫画|章节|分镜|书稿|应用|故事|素材|资产/u.test(text)) {
    addNeed(needs, "application_asset", 7, "任务涉及应用广场资产、小说/漫画、章节、分镜、素材或故事资产");
  }

  if (/verify|check|test|exists|contains|status|验证|检查|测试|存在|包含|状态/u.test(text)) {
    addNeed(needs, "verify", 6, "任务处于验证、检查或状态确认语义");
  }

  if (/write|update|replace|create|save|delete|修改|写入|更新|创建|保存|删除/u.test(text)) {
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

function scoreToolForNeed(tool: McpToolDefinition, need: AgentCapabilityNeed): AgentCapabilityRouteTool {
  const capability = inferToolCapabilities(tool);
  const verbs = inferToolVerbs(tool);
  const executionDomain = inferToolExecutionDomain(tool);
  const riskLevel = inferToolRiskLevel(tool);
  const cost = inferToolCost(tool);
  const payload = buildPlannerToolPayload([tool])[0] ?? {};
  const matchedNeeds: string[] = [];
  let score = 0;

  if (executionDomain === need.capability) {
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
  const groups = needs.map((need) => {
    const tools = candidateTools
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

  return {
    summary: `Capability Routing 仅用于分组和排序提示：识别 ${needs.length} 个能力需求，推荐关注 ${routedCount}/${candidateTools.length} 个工具；完整候选工具仍全部可选。`,
    needs,
    groups,
    allToolsAvailable: true,
    routingPolicy: "模型仍可选择完整候选列表中的任意工具；routing 不做候选裁剪、不做强制路由，只作为成本、风险和能力匹配提示。"
  };
}
