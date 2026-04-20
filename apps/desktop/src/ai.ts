import { invokeModelText } from "../../../packages/providers/src/index.js";
import { listModelSettings } from "../../../packages/workbench/src/index.js";
import type {
  ModelProfile,
  ModelTextRequest,
  ModelTextResponse,
  WeeklyProgressRewriteRequest,
  WeeklyReportGenerateRequest
} from "../../../packages/shared/src/index.js";

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

  if (profile.provider === "openai_like" && !profile.baseUrl?.trim()) {
    throw new Error("OpenAI-like 配置缺少 Base URL，请先补全后再使用");
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

  if (!selectedText) {
    throw new Error("请先在编辑器中选中需要优化的计划内容");
  }

  return invokeActiveModel({
    temperature: 0.4,
    maxOutputTokens: 500,
    messages: [
      {
        role: "system",
        content: `你是一个周计划整理助手。
你的任务是把用户选中的计划语句优化得更专业、更清晰，但必须严格遵守以下要求：
- 只优化表达，不改变事实，不新增原文没有的信息
- 如果输入来自项目备注或任务项，优先保留“结果 / 影响 / 风险 / 下一步”这种汇报语气
- 尽量保持原有层级、缩进和列表风格
- 输出只包含优化后的正文，不要加解释、标题、引号或额外说明
- 如果原文已经很清晰，只做轻量润色`
      },
      {
        role: "user",
        content: `当前周标题：
${request.weekTitle}

完整上下文：
${request.fullContent || "(空)"}

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
        content: `你是一个面向管理者汇报的周报助手。
请根据用户的本周工作内容生成一份可直接发送给领导的周报，要求如下：
- 先给结论，再展开细节，不要上来就流水账罗列任务
- 语言专业、简洁、条理清晰
- 优先突出结果、影响、完成度、风险和后续动作
- 如果原始内容缺少量化数据，不要编造，但要尽量写清“完成到哪一步”
- 如果原始内容包含“项目 / 任务 / 状态 / 备注”层级，先按项目归纳，再提炼任务结果和风险
- 若存在受阻或待协调事项，要明确写出影响和所需支持
- 不要编造原始内容中不存在的信息
- 严格按照用户给出的模板组织输出
- 输出只包含最终周报内容，不要额外解释`
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
