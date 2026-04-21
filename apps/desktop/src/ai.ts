import { invokeModelText } from "../../../packages/providers/src/index.js";
import { listModelSettings } from "../../../packages/workbench/src/index.js";
import { readPromptAsset } from "../../../packages/workbench/src/prompt-assets.js";
import type {
  DailyReportGenerateRequest,
  ModelProfile,
  ModelTextRequest,
  ModelTextResponse,
  WeeklyProgressRewriteRequest,
  WeeklyReportGenerateRequest
} from "../../../packages/shared/src/index.js";

const WEEKLY_REWRITE_ITEM_SYSTEM_PROMPT = readPromptAsset("weeklyRewriteItemSystem");
const WEEKLY_DAILY_REPORT_GENERATE_SYSTEM_PROMPT = readPromptAsset("weeklyDailyReportGenerateSystem");
const WEEKLY_REPORT_GENERATE_SYSTEM_PROMPT = readPromptAsset("weeklyReportGenerateSystem");
const BASE_URL_REQUIRED_PROVIDERS = new Set([
  "azure",
  "openai_like",
  "doubao",
  "qwen",
  "deepseek",
  "moonshot",
  "zhipu",
  "grok"
]);

async function getActiveModelProfile(): Promise<ModelProfile> {
  const settings = await listModelSettings();

  if (!settings.activeProfileId) {
    throw new Error("当前还没有设置优先模型，请先在模型管理中启用一条配置");
  }

  const profile = settings.profiles.find((item) => item.id === settings.activeProfileId);

  if (!profile) {
    throw new Error("当前优先模型不存在，请重新选择可用配置");
  }

  if (!profile.model.trim() || !profile.apiKey.trim()) {
    throw new Error("当前优先模型配置不完整，请补全模型名称和 API Key");
  }

  if (BASE_URL_REQUIRED_PROVIDERS.has(profile.provider) && !profile.baseUrl?.trim()) {
    throw new Error(`${profile.displayName || profile.provider} 配置缺少 Base URL，请先补全后再使用`);
  }

  return profile;
}

export async function invokeActiveModel(request: ModelTextRequest): Promise<ModelTextResponse> {
  const profile = await getActiveModelProfile();
  return invokeModelText(profile, request);
}

export async function rewriteWeeklyProgressItem(
  request: WeeklyProgressRewriteRequest
): Promise<ModelTextResponse> {
  const selectedText = request.selectedText.trim();
  const childTaskTitles = Array.isArray(request.childTaskTitles)
    ? request.childTaskTitles.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  if (!selectedText) {
    throw new Error("请先在编辑器中选中需要优化的计划内容");
  }

  return invokeActiveModel({
    temperature: 0.4,
    maxOutputTokens: 500,
    messages: [
      {
        role: "system",
        content: WEEKLY_REWRITE_ITEM_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `当前周标题：
${request.weekTitle}

完整上下文：
${request.fullContent || "(空)"}

当前任务层级：
${childTaskTitles.length ? "父任务（下有子任务）" : "普通任务 / 叶子任务"}

直接子任务标题：
${childTaskTitles.length ? childTaskTitles.map((item) => `- ${item}`).join("\n") : "(无)"}

需要优化的选中内容：
${selectedText}`
      }
    ]
  });
}

export async function generateWeeklyProgressReport(
  request: WeeklyReportGenerateRequest
): Promise<ModelTextResponse> {
  if (!request.content.trim()) {
    throw new Error("当前周计划内容为空，先补充工作内容后再生成周报");
  }

  return invokeActiveModel({
    temperature: 0.3,
    maxOutputTokens: 1200,
    messages: [
      {
        role: "system",
        content: WEEKLY_REPORT_GENERATE_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `周标题：
${request.weekTitle}

本周内容：
${request.content}

输出模板：
${request.reportTemplate}`
      }
    ]
  });
}

export async function generateDailyProgressReport(
  request: DailyReportGenerateRequest
): Promise<ModelTextResponse> {
  if (!request.content.trim()) {
    throw new Error("当前没有可用于生成日报的今日更新任务");
  }

  return invokeActiveModel({
    temperature: 0.3,
    maxOutputTokens: 900,
    messages: [
      {
        role: "system",
        content: WEEKLY_DAILY_REPORT_GENERATE_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `日期：
${request.dateTitle}

所在周：
${request.weekTitle}

今天有更新的任务：
${request.content}`
      }
    ]
  });
}
