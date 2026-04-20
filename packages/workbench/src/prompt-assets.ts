import { readFileSync } from "node:fs";

import { resolveFromRoot } from "../../shared/src/index.js";

const PROMPT_ASSET_PATHS = {
  builtinAgentGordonSystem: ["prompts", "builtins", "agents", "gordon.system.md"],
  builtinSkillPlanPrompt: ["prompts", "builtins", "skills", "plan.prompt.md"],
  builtinSkillCodePrompt: ["prompts", "builtins", "skills", "code.prompt.md"],
  builtinSkillReviewPrompt: ["prompts", "builtins", "skills", "review.prompt.md"],
  weeklyRewriteItemSystem: ["prompts", "workbench", "weekly", "rewrite-item.system.md"],
  weeklyReportGenerateSystem: ["prompts", "workbench", "weekly", "report-generate.system.md"],
  weeklyReportTemplateDefault: ["prompts", "workbench", "weekly", "report-template.default.md"],
  weeklyReportTemplateLegacy: ["prompts", "workbench", "weekly", "report-template.legacy.md"]
} as const;

export type PromptAssetId = keyof typeof PROMPT_ASSET_PATHS;

const promptAssetCache = new Map<PromptAssetId, string>();

function normalizePromptMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").trim();
}

export function resolvePromptAssetPath(promptId: PromptAssetId): string {
  return resolveFromRoot(...PROMPT_ASSET_PATHS[promptId]);
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
