import type { AgentProfile, McpServerConfig, ModelSettings, SkillDefinition } from "../../shared/src/index.js";
import { resolveFromRoot } from "../../shared/src/index.js";
import { readPromptAsset } from "./prompt-assets.js";

export const BUILTIN_WORKBENCH_ID_PREFIX = "builtin:";
export const BUILTIN_GORDON_AGENT_ID = "builtin:agent:gordon";
export const BUILTIN_WORKSPACE_MCP_ID = "builtin:mcp:workspace";
export const BUILTIN_PLAN_SKILL_ID = "builtin:skill:plan";
export const BUILTIN_CODE_SKILL_ID = "builtin:skill:code";
export const BUILTIN_REVIEW_SKILL_ID = "builtin:skill:review";
export const BUILTIN_KARPATHY_SKILL_ID = "builtin:skill:karpathy-guidelines";
export const BUILTIN_SELF_IMPROVEMENT_SKILL_ID = "builtin:skill:self-improvement";
export const BUILTIN_DEEP_RESEARCH_SKILL_ID = "builtin:skill:deep-research";

const BUILTIN_UPDATED_AT = "2026-04-21T09:40:00.000Z";
const BUILTIN_PLAN_SKILL_PATH = resolveFromRoot("skills", "plan");
const BUILTIN_CODE_SKILL_PATH = resolveFromRoot("skills", "code");
const BUILTIN_REVIEW_SKILL_PATH = resolveFromRoot("skills", "review");
const BUILTIN_KARPATHY_SKILL_PATH = resolveFromRoot("skills", "karpathy-guidelines");
const BUILTIN_SELF_IMPROVEMENT_SKILL_PATH = resolveFromRoot("skills", "self-improvement");
const BUILTIN_DEEP_RESEARCH_SKILL_PATH = resolveFromRoot("skills", "deep-research");
const BUILTIN_PLAN_SKILL_PROMPT = readPromptAsset("builtinSkillPlanPrompt");
const BUILTIN_CODE_SKILL_PROMPT = readPromptAsset("builtinSkillCodePrompt");
const BUILTIN_REVIEW_SKILL_PROMPT = readPromptAsset("builtinSkillReviewPrompt");
const BUILTIN_KARPATHY_SKILL_PROMPT = readPromptAsset("builtinSkillKarpathyPrompt");
const BUILTIN_SELF_IMPROVEMENT_SKILL_PROMPT = readPromptAsset("builtinSkillSelfImprovementPrompt");
const BUILTIN_DEEP_RESEARCH_SKILL_PROMPT = readPromptAsset("builtinSkillDeepResearchPrompt");
const BUILTIN_GORDON_AGENT_SYSTEM_PROMPT = readPromptAsset("builtinAgentGordonSystem");

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolvePreferredModelProfileId(modelSettings: ModelSettings): string | null {
  return modelSettings.activeProfileId ?? modelSettings.profiles[0]?.id ?? null;
}

export function isBuiltinWorkbenchEntry(entryId: string | null | undefined): boolean {
  return String(entryId ?? "").startsWith(BUILTIN_WORKBENCH_ID_PREFIX);
}

export function getBuiltinSkillDefinitions(): SkillDefinition[] {
  return [
    {
      id: BUILTIN_PLAN_SKILL_ID,
      name: "plan",
      description: "用文件化计划承接复杂任务拆解、阶段推进、发现沉淀和会话恢复。",
      tags: [],
      kind: "prompt",
      promptTemplate: BUILTIN_PLAN_SKILL_PROMPT,
      source: {
        type: "manual",
        localPath: BUILTIN_PLAN_SKILL_PATH
      },
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_CODE_SKILL_ID,
      name: "code",
      description: "偏向代码实现、定位修改点和收敛验证路径的默认技能。",
      tags: [],
      kind: "prompt",
      promptTemplate: BUILTIN_CODE_SKILL_PROMPT,
      source: {
        type: "manual",
        localPath: BUILTIN_CODE_SKILL_PATH
      },
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_REVIEW_SKILL_ID,
      name: "review",
      description: "用于 review、排查、风险检查和上线前自检。",
      tags: [],
      kind: "prompt",
      promptTemplate: BUILTIN_REVIEW_SKILL_PROMPT,
      source: {
        type: "manual",
        localPath: BUILTIN_REVIEW_SKILL_PATH
      },
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_KARPATHY_SKILL_ID,
      name: "karpathy-guidelines",
      description: "吸收 Karpathy 的开发偏好，强调先澄清、保持简单、外科式修改和目标驱动验证。",
      tags: [],
      kind: "prompt",
      promptTemplate: BUILTIN_KARPATHY_SKILL_PROMPT,
      source: {
        type: "manual",
        localPath: BUILTIN_KARPATHY_SKILL_PATH
      },
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_SELF_IMPROVEMENT_SKILL_ID,
      name: "self-improvement",
      description: "把失败、纠错和用户反馈提炼为可复用规则，并明确建议沉淀到哪里。",
      tags: [],
      kind: "prompt",
      promptTemplate: BUILTIN_SELF_IMPROVEMENT_SKILL_PROMPT,
      source: {
        type: "manual",
        localPath: BUILTIN_SELF_IMPROVEMENT_SKILL_PATH
      },
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_DEEP_RESEARCH_SKILL_ID,
      name: "deep-research",
      description: "用于复杂主题研究、证据交叉验证和结论整合，并显式约束来源真实性。",
      tags: [],
      kind: "prompt",
      promptTemplate: BUILTIN_DEEP_RESEARCH_SKILL_PROMPT,
      source: {
        type: "manual",
        localPath: BUILTIN_DEEP_RESEARCH_SKILL_PATH
      },
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    }
  ];
}

export function getBuiltinMcpServers(): McpServerConfig[] {
  const scriptPath = resolveFromRoot("scripts", "workspace-mcp.mjs");

  return [
    {
      id: BUILTIN_WORKSPACE_MCP_ID,
      name: "Workspace Tools",
      description: "内置工作区工具，支持基础文件操作、路径管理、工作区搜索与联网搜索。",
      transport: "stdio",
      command: `/usr/bin/env node ${shellEscape(scriptPath)}`,
      env: {
        GORDON_WORKSPACE_ROOT: resolveFromRoot(".")
      },
      toolAllowlist: [],
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    }
  ];
}

export function getBuiltinAgentProfile(
  modelSettings: ModelSettings,
  skills: SkillDefinition[],
  mcpServers: McpServerConfig[]
): AgentProfile {
  const modelProfileId = resolvePreferredModelProfileId(modelSettings);
  const builtinSkillIds = getBuiltinSkillDefinitions().map((skill) => skill.id);
  const skillIds = Array.from(
    new Set([...builtinSkillIds, ...skills.filter((skill) => skill.enabled).map((skill) => skill.id)])
  );
  const builtinServerIds = getBuiltinMcpServers().map((server) => server.id);
  const mcpServerIds = Array.from(
    new Set([...builtinServerIds, ...mcpServers.filter((server) => server.enabled).map((server) => server.id)])
  );

  return {
    id: BUILTIN_GORDON_AGENT_ID,
    name: "Gordon",
    description: "内置默认开发 Agent，直接复用当前优先模型，并可围绕当前仓库调用基础工具完成协作。",
    mode: "chat",
    modelProfileId,
    systemPrompt: BUILTIN_GORDON_AGENT_SYSTEM_PROMPT,
    allowedSkillIds: skillIds,
    allowedMcpServerIds: mcpServerIds,
    enabled: true,
    updatedAt: BUILTIN_UPDATED_AT
  };
}

export function mergeBuiltinEntries<T extends { id: string }>(builtinEntries: T[], userEntries: T[]): T[] {
  const builtinIds = new Set(builtinEntries.map((entry) => entry.id));
  const overrideMap = new Map(
    userEntries.filter((entry) => builtinIds.has(entry.id)).map((entry) => [entry.id, entry] as const)
  );

  return [
    ...builtinEntries.map((entry) => overrideMap.get(entry.id) ?? entry),
    ...userEntries.filter((entry) => !builtinIds.has(entry.id))
  ];
}
