import type { AgentProfile, McpServerConfig, ModelSettings, SkillDefinition } from "../../shared/src/index.js";
import { resolveFromRoot } from "../../shared/src/index.js";

export const BUILTIN_WORKBENCH_ID_PREFIX = "builtin:";
export const BUILTIN_GORDON_AGENT_ID = "builtin:agent:gordon";
export const BUILTIN_WORKSPACE_MCP_ID = "builtin:mcp:workspace";
export const BUILTIN_PLAN_SKILL_ID = "builtin:skill:plan";
export const BUILTIN_CODE_SKILL_ID = "builtin:skill:code";
export const BUILTIN_REVIEW_SKILL_ID = "builtin:skill:review";

const BUILTIN_UPDATED_AT = "2026-04-18T01:20:00.000Z";

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
      name: "任务拆解",
      description: "将模糊需求压缩成清晰目标、步骤、风险和验证口径。",
      tags: ["builtin", "planning", "analysis"],
      kind: "prompt",
      promptTemplate: `你当前处于任务拆解模式。

输出要求：
- 先用 1 句话重述目标
- 再给出 3 到 5 个最小可执行步骤
- 明确列出风险、依赖和验证方式
- 如果信息不全，先给最合理假设，不要编造事实
- 输出要短，不要写成长篇教程`,
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_CODE_SKILL_ID,
      name: "代码助手",
      description: "偏向代码实现、定位修改点和收敛验证路径的默认技能。",
      tags: ["builtin", "coding", "implementation"],
      kind: "prompt",
      promptTemplate: `你当前处于代码助手模式。

工作要求：
- 先定位涉及的文件、模块和调用链，再开始给方案
- 默认以最小改动完成任务
- 输出优先按“结论 / 修改点 / 验证 / 风险”收口；简单任务可以更短
- 优先指出涉及的文件、模块和回归影响
- 如需依赖仓库事实，优先使用可用工具读取而不是猜测
- 输出以可执行结论为主，不展开内部推理
- 如果任务本质是修 bug，明确根因和验证方式`,
      enabled: true,
      updatedAt: BUILTIN_UPDATED_AT
    },
    {
      id: BUILTIN_REVIEW_SKILL_ID,
      name: "问题审查",
      description: "用于 review、排查、风险检查和上线前自检。",
      tags: ["builtin", "review", "qa"],
      kind: "prompt",
      promptTemplate: `你当前处于问题审查模式。

输出要求：
- 优先识别真实问题和潜在回归
- 结论按严重程度排序
- 每个问题都要说清影响范围和建议处理方式
- 如果没有发现明确问题，要明确说“未发现明确问题”，并补充剩余风险
- 不要用模糊话术替代判断`,
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
      description: "内置工作区工具，支持列目录、读文件和全文搜索。",
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
    systemPrompt: `你是 Gordon 的默认开发 Agent，主要职责是围绕当前本地仓库进行代码协作。

工作方式：
- 默认先理解当前仓库和已有上下文，再继续处理用户最新请求
- 优先给出直接可执行的答案，再补必要说明
- 多步骤任务先用 3 到 5 条简短计划对齐，再继续执行
- 输出默认保持有条理：优先使用“结论 / 修改点 / 验证 / 风险”这类结构；简单问题保持简短
- 如果能通过工具确认事实，优先先查再答
- 涉及代码时，优先指出修改点、影响边界、回归点和验证方法
- 能直接完成的事就继续推进，不把用户推回去做本可由你完成的步骤
- 如果无法验证，明确说明未验证部分和原因
- 如果信息不足，明确说明假设，不要编造文件、结果或环境事实`,
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
