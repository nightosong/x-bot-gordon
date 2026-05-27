import { readFileSync } from "node:fs";

import { resolveFromRoot } from "../../shared/src/index.js";

const PROMPT_ASSET_PATHS = {
  builtinAgentGordonSystem: ["prompts", "builtins", "agents", "gordon.system.md"],
  builtinAgentArthurSystem: ["prompts", "builtins", "agents", "arthur.system.md"],
  builtinSkillPlanPrompt: ["skills", "plan", "SKILL.md"],
  builtinSkillCodePrompt: ["skills", "code", "SKILL.md"],
  builtinSkillReviewPrompt: ["skills", "review", "SKILL.md"],
  builtinSkillKarpathyPrompt: ["skills", "karpathy-guidelines", "SKILL.md"],
  builtinSkillSelfImprovementPrompt: ["skills", "self-improvement", "SKILL.md"],
  builtinSkillDeepResearchPrompt: ["skills", "deep-research", "SKILL.md"],
  builtinSkillCreatorPrompt: ["skills", "skill-creator", "SKILL.md"],
  builtinSkillWritingPrompt: ["skills", "writing", "SKILL.md"],
  weeklyRewriteItemSystem: ["prompts", "workbench", "weekly", "rewrite-item.system.md"],
  weeklyDailyReportGenerateSystem: ["prompts", "workbench", "weekly", "daily-report-generate.system.md"],
  weeklyReportGenerateSystem: ["prompts", "workbench", "weekly", "report-generate.system.md"],
  weeklyReportTemplateDefault: ["prompts", "workbench", "weekly", "report-template.default.md"],
  weeklyReportTemplateLegacy: ["prompts", "workbench", "weekly", "report-template.legacy.md"],
  writingMasterSystem: ["prompts", "workbench", "writing", "master.system.md"],
  writingNarrativeCraftGuide: ["prompts", "workbench", "writing", "narrative-craft-guide.md"],
  writingSelfReviewGuide: ["prompts", "workbench", "writing", "self-review-guide.md"],
  writingChapterOutputDefaults: ["prompts", "workbench", "writing", "chapter-output-defaults.md"],
  writingAiTaskPrompts: ["prompts", "workbench", "writing", "ai-task-prompts.json"]
} as const;

export type PromptAssetId = keyof typeof PROMPT_ASSET_PATHS;

const promptAssetCache = new Map<PromptAssetId, string>();

function normalizePromptMarkdown(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  const frontmatterMatch = normalized.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (frontmatterMatch?.[1] ?? normalized).trim();
}

export function resolvePromptAssetPath(promptId: PromptAssetId): string {
  return resolveFromRoot(...PROMPT_ASSET_PATHS[promptId]);
}

export function isPromptAssetId(value: string): value is PromptAssetId {
  return Object.prototype.hasOwnProperty.call(PROMPT_ASSET_PATHS, value);
}

export function readPromptAsset(promptId: PromptAssetId): string {
  const cached = promptAssetCache.get(promptId);

  if (cached) {
    return cached;
  }

  const filePath = resolvePromptAssetPath(promptId);

  try {
    const content = normalizePromptMarkdown(readFileSync(filePath, "utf8"));

    if (!content) {
      throw new Error("内容为空");
    }

    promptAssetCache.set(promptId, content);
    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`读取提示词资产失败：${promptId} (${filePath})，原因：${message}`);
  }
}
