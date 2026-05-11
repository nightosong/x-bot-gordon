export const WRITING_PROMPT_ASSET_IDS = [
  "writingMasterSystem",
  "writingNarrativeCraftGuide",
  "writingSelfReviewGuide",
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
    selfReviewGuide: "",
    chapterOutputDefaults: [],
    taskPrompts: {}
  };
}

export function normalizeWritingPromptAssets(rawAssets = {}) {
  return {
    masterSystem: normalizeText(rawAssets.writingMasterSystem),
    narrativeCraftGuide: normalizeText(rawAssets.writingNarrativeCraftGuide),
    selfReviewGuide: normalizeText(rawAssets.writingSelfReviewGuide),
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
  const selfReviewGuide = promptAssets?.selfReviewGuide || "(自评知识资产尚未加载。)";

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
    "自我评判内核：",
    selfReviewGuide,
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
    "- 章节规划必须按 3000-5000 字正文容量设计每章：每章要能展开成一个完整章节级事件，包含场景目标、资源/危险压力、冲突升级、主角选择、信息增量或代价、结尾钩子。",
    "- 不要把“到达某地 / 发现痕迹 / 试探 / 短斗 / 得到物资 / 继续赶路”拆成多个空章节；相邻 3-5 个小拍点应合并进同一章。",
    "- 章节标题必须有画面、总结力或转折感，禁止使用“地点 + 初临/旧痕/试探/险声/伏身/短斗/变招/代价/所得/开路”等固定后缀模板。",
    "- 幕/卷不是章节；如需要幕或卷，必须输出 parts，并在章节里用 partIndex 关联，章节 index 仍然全书连续累加。",
    "- 如果作者要求“第几章拆成几章 / 移除第几章 / 在第n章和第n+1章中间增加章节”，必须落实到最终 chapters JSON。",
    "- 如果是章内计划，只输出本章执行计划，不写正文；计划要能直接写入当前章节简介。",
    "- 如果是章节正文，必须有场景动作、对白张力、信息差、对手反制、证据载体、心理暗流和段落节奏；正文开头不要带章节标题。",
    "- 章节中的关键变化必须落到可验证对象或后果上，例如物件、伤痕、账目、公开结果、地点破坏、能力边界或关系破裂；不要只用抽象心理总结替代剧情推进。",
    "- 如果是书籍介绍生成，优先写清核心命题、主角处境、主要矛盾和读者钩子；不要把简介写成设定清单。",
    "- 如果是故事设定完善，再补齐世界规则、主要人物、关系冲突、伏笔账本和风格边界。",
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
    "自我评判内核：",
    promptAssets?.selfReviewGuide || "(自评知识资产尚未加载。)",
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
    "自我评判内核：",
    promptAssets?.selfReviewGuide || "(自评知识资产尚未加载。)",
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
    "- 每章必须按 3000-5000 字正文容量设计，能展开成一个完整章节级事件；不要把到达、痕迹、试探、短斗、所得、开路拆成多个空章节。",
    "- title 要概括本章独特事件、意象或转折，禁止使用“地点 + 初临/旧痕/试探/险声/伏身/短斗/变招/代价/所得/开路”等固定后缀模板。",
    "- summary 要写清本章目标、主要冲突、资源/危险压力、信息增量、人物变化、情绪目标、伏笔/回收、结尾钩子和现实反思落点。",
    "- 当前批次必须承接上一批，不要重复已有章节，不要提前收束整本书。",
    "",
    "输出 JSON 代码块，格式：",
    `{"chapters":[{"index":${batchStartIndex},"partIndex":${part.index},"title":"章节标题（纯标题，有画面和总结力）","summary":"本章目标、主要冲突、资源/危险压力、信息增量、人物变化、情绪目标、伏笔/回收、结尾钩子；内容量能支撑 3000-5000 字正文"}]}`
  ].join("\n");
}
