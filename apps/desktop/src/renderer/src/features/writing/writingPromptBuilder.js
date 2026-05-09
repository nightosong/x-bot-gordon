export const WRITING_PROMPT_ASSET_IDS = [
  "writingMasterSystem",
  "writingNarrativeCraftGuide",
  "writingChapterOutputDefaults",
  "writingAiTaskPrompts"
];

const FALLBACK_TASK_SPEC = {
  role: "小说总编",
  strategy: "围绕当前故事上下文完成本轮写作辅助任务，保持人物动机、因果链、伏笔和设定一致。",
  output: "输出可直接放进当前写作项目的内容，不写寒暄。"
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parseMarkdownList(value) {
  return normalizeText(value)
    .split(/\r?\n/g)
    .map((line) => line.trim().replace(/^[-*]\s+/, "").replace(/^\d+[.)、]\s*/, "").trim())
    .filter(Boolean);
}

function parseTaskPrompts(value) {
  try {
    const parsed = JSON.parse(normalizeText(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createWritingPromptAssets() {
  return {
    masterSystem: "",
    narrativeCraftGuide: "",
    chapterOutputDefaults: [],
    taskPrompts: {}
  };
}

export function normalizeWritingPromptAssets(rawAssets = {}) {
  return {
    masterSystem: normalizeText(rawAssets.writingMasterSystem),
    narrativeCraftGuide: normalizeText(rawAssets.writingNarrativeCraftGuide),
    chapterOutputDefaults: parseMarkdownList(rawAssets.writingChapterOutputDefaults),
    taskPrompts: parseTaskPrompts(rawAssets.writingAiTaskPrompts)
  };
}

export async function loadWritingPromptAssets(desktopApi) {
  if (!desktopApi?.readPromptAssets) {
    return createWritingPromptAssets();
  }

  return normalizeWritingPromptAssets(await desktopApi.readPromptAssets(WRITING_PROMPT_ASSET_IDS));
}

export function getWritingTaskPromptSpec(promptAssets, tabId, taskId, taskOptions = []) {
  const taskPrompts = promptAssets?.taskPrompts ?? {};
  const defaultTaskId = (Array.isArray(taskOptions) ? taskOptions : [])[0]?.id;

  return (
    taskPrompts[tabId]?.[taskId] ??
    taskPrompts[tabId]?.[defaultTaskId] ??
    taskPrompts.intro?.premise ??
    FALLBACK_TASK_SPEC
  );
}

export function buildWritingAssistantPrompt({
  appName,
  book,
  lengthProfile,
  tabTitle,
  task,
  taskSpec,
  instruction,
  promptAssets,
  chapterOutputDefaults,
  longOutlineContent,
  storyMemoryContent,
  introContent,
  outlineContent,
  chapterContext,
  currentModuleContent
}) {
  if (!book) {
    return "";
  }

  const defaults = Array.isArray(chapterOutputDefaults) ? chapterOutputDefaults : promptAssets?.chapterOutputDefaults ?? [];
  const chapterOutputContent = defaults.length ? ["章节生成默认项：", ...defaults.map((item) => `- ${item}`)].join("\n") : "";
  const craftGuide = promptAssets?.narrativeCraftGuide || "(写作知识资产尚未加载。)";

  return [
    `你正在执行「${appName}」的一次写作辅助任务。通用标准：大师级小说总编 + 故事架构师 + 文字教练。`,
    "",
    `作品：${book.title}`,
    `篇幅：${lengthProfile.label}（${lengthProfile.scope}）`,
    `类型：${book.genre || "未设定"}`,
    `当前模块：${tabTitle}`,
    `大师思路：${lengthProfile.method}`,
    `本次任务：${task?.label ?? "综合辅助"} - ${task?.goal ?? "提升当前内容"}`,
    `本任务设计者：${taskSpec.role}`,
    instruction ? `作者额外要求：${instruction}` : "作者额外要求：无",
    "",
    "任务专属提示词：",
    taskSpec.strategy,
    "",
    "创作知识内核：",
    craftGuide,
    "",
    "输出要求：",
    taskSpec.output,
    chapterOutputContent,
    longOutlineContent ? "\n长篇扩展模式：\n" + longOutlineContent : "",
    "",
    "连续性资料与一致性上下文：",
    storyMemoryContent,
    "",
    "故事介绍与规划：",
    introContent,
    "",
    "章节目录：",
    outlineContent,
    "",
    "当前选中章节：",
    chapterContext,
    "",
    `请围绕「${tabTitle}」输出可直接粘贴的内容。要求：`,
    "- 不要寒暄，不要解释提示词。",
    "- 保留并强化人物动机、因果链、伏笔和冲突。",
    "- 如果是章节规划，必须输出最终目录，不输出“建议你可以怎么改”的中间建议。",
    "- 章节规划的 chapters JSON 中，每个章节必须包含 integer 类型的 index；title 只写纯标题，不要包含“第X章”。",
    "- 幕/卷不是章节；如需要幕或卷，必须输出 parts，并在章节里用 partIndex 关联，章节 index 仍然全书连续累加。",
    "- 如果作者要求“第几章拆成几章 / 移除第几章 / 在第n章和第n+1章中间增加章节”，必须落实到最终 chapters JSON。",
    "- 如果是章节，必须有场景动作、对白张力、心理暗流和段落节奏；正文开头不要带章节标题。",
    "- 如果是介绍，必须补齐世界规则、核心矛盾、主要人物与主题命题。",
    "- 连续性资料、设定账本、storyAssets 和 memoryNotes 是内部写作资料，不是作品主题；除非作者明确要求或当前项目已写明，不要默认把“记忆、失忆、遗忘、档案”设为核心设定。",
    "- 新建或扩展故事介绍时，优先为当前作品选择区别于已有项目的核心机制；书名意象可保留为氛围，不要自动扩展成同质世界观。",
    "",
    "当前模块原文：",
    currentModuleContent || "(空)"
  ].join("\n");
}

export function buildWritingLongOutlineMasterPrompt({
  appName,
  book,
  request,
  partLabel,
  targetContent,
  introContent,
  seedContent,
  promptAssets
}) {
  return [
    `你正在为「${appName}」执行长篇小说总体规划任务。`,
    "目标：先生成幕/卷级 Master Plan，不要输出章节列表。",
    "",
    `作品：${book.title}`,
    `类型：${book.genre || "未设定"}`,
    `作者要求：${request.instruction || "无"}`,
    "",
    "长篇目标：",
    targetContent,
    "",
    "创作知识内核：",
    promptAssets?.narrativeCraftGuide || "(写作知识资产尚未加载。)",
    "",
    "故事介绍与规划：",
    introContent || "(空)",
    "",
    "现有目录种子：",
    seedContent,
    "",
    "输出 JSON 代码块，且只允许包含 parts 字段：",
    `{"parts":[{"index":1,"type":"${request.partType}","title":"${partLabel}标题（不要包含第X${partLabel}前缀）","description":"本${partLabel}的故事目标、现实映照、主要冲突、人物变化、阶段高潮和伏笔安排"}]}`,
    "",
    `必须输出 exactly ${request.targetPartCount} 个 ${partLabel}；每个 description 要能支撑 ${request.minChaptersPerPart}-${request.maxChaptersPerPart} 章。`
  ].join("\n");
}

export function buildWritingLongOutlineBatchPrompt({
  appName,
  book,
  request,
  part,
  partLabel,
  batchStartIndex,
  batchEndIndex,
  targetContent,
  introContent,
  partsContext,
  partDisplayLabel,
  recentChapterContext,
  promptAssets
}) {
  const expectedCount = batchEndIndex - batchStartIndex + 1;

  return [
    `你正在为「${appName}」执行长篇小说章节目录分批规划任务。`,
    "目标：只生成当前批次的章节 JSON，不要输出其它批次，不要输出解释。",
    "",
    `作品：${book.title}`,
    `类型：${book.genre || "未设定"}`,
    `作者要求：${request.instruction || "无"}`,
    "",
    "全书目标：",
    targetContent,
    "",
    "创作知识内核：",
    promptAssets?.narrativeCraftGuide || "(写作知识资产尚未加载。)",
    "",
    "故事介绍与规划：",
    introContent || "(空)",
    "",
    "幕/卷总规划：",
    partsContext,
    "",
    `当前${partLabel}：${partDisplayLabel}`,
    part?.description || "暂无描述",
    "",
    "本幕/卷最近已生成章节：",
    recentChapterContext,
    "",
    "本批次硬性要求：",
    `- 必须输出 exactly ${expectedCount} 个 chapters。`,
    `- index 必须从 ${batchStartIndex} 连续到 ${batchEndIndex}。`,
    `- 每个 chapter 的 partIndex 必须是 ${part.index}。`,
    "- title 只写纯标题，不要包含“第X章”。",
    "- summary 要写清本章目标、主要冲突、信息增量、人物变化、情绪目标、伏笔/回收、结尾钩子和现实反思落点。",
    "- 当前批次必须承接上一批，不要重复已有章节，不要提前收束整本书。",
    "",
    "输出 JSON 代码块，格式：",
    `{"chapters":[{"index":${batchStartIndex},"partIndex":${part.index},"title":"章节标题","summary":"本章目标、主要冲突、信息增量、人物变化、情绪目标、伏笔/回收、结尾钩子、现实反思落点"}]}`
  ].join("\n");
}
