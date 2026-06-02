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

const FALLBACK_GENRE_PROMPT_GUIDE =
  "题材驱动：先识别当前作品真正的 storyEngine，再让冲突、人物变化、证据载体和章节节奏服从该题材；不要把所有作品强行写成探险升级流或真相揭露流。";

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

function hasStorySettingRewriteIntent(task, instruction) {
  if (task?.id !== "storyRefine") {
    return false;
  }

  return /(全新|重新|重写|重做|替换|改成|剔除|去掉|排除|删除|不希望|不要|不能|别|纯粹|只保留|保留纯粹)/u.test(
    normalizeText(instruction)
  );
}

function buildStorySettingRewriteProtocol(task, instruction) {
  if (!hasStorySettingRewriteIntent(task, instruction)) {
    return "";
  }

  return [
    "故事设定替换协议：",
    "- 作者本轮要求属于设定方向替换，不是评审报告。",
    "- 最终输出必须是可直接替换「大纲指导」的新设定稿；不要输出修改说明、保留/取舍判断、优化建议、执行记录或推理过程。",
    "- 作者明确排除的元素及同义变体必须从新稿中消失；不要把被排除元素改名后保留为背景、伏笔、势力动机或隐藏主线。",
    "- 如需保留旧设定，只能保留不违背作者要求的书名意象、人物动机、武力规则、地理氛围或冒险资源，并自然写进新设定。",
    "- 如果作者要求纯粹类型体验，冲突必须围绕该类型的正面承诺展开，避免转向朝堂、阴谋、权谋、悬疑真相、文明反思或项目管理语言。",
    "- 输出开头直接写作品设定小标题，例如“## 故事核心定位”；不要写“以下是”“保留”“删除”“调整为”等说明性开场。"
  ].join("\n");
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[,\n，、/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getGenrePromptGuide(genreGuides = {}, genreProfile = {}, fallbackGenre = "") {
  const primaryGenre = normalizeText(genreProfile.primaryGenre || fallbackGenre);
  const candidates = [primaryGenre, ...normalizeStringList(genreProfile.subGenres), fallbackGenre]
    .map((item) => item.replace(/\s+/g, ""))
    .filter(Boolean);
  const guideKey = Object.keys(genreGuides ?? {}).find((key) => candidates.some((candidate) => candidate.includes(key) || key.includes(candidate)));
  const guide = guideKey ? genreGuides[guideKey] : null;
  const profileLines = [
    `- primaryGenre：${primaryGenre || "未设定"}`,
    normalizeStringList(genreProfile.subGenres).length ? `- subGenres：${normalizeStringList(genreProfile.subGenres).join("、")}` : "",
    genreProfile.storyEngine ? `- storyEngine：${genreProfile.storyEngine}` : "",
    genreProfile.audience ? `- audience：${genreProfile.audience}` : "",
    genreProfile.tone ? `- tone：${genreProfile.tone}` : ""
  ].filter(Boolean);

  return [
    "Genre Profile（题材画像）：",
    profileLines.join("\n") || "- primaryGenre：未设定",
    "",
    guide?.guide || FALLBACK_GENRE_PROMPT_GUIDE,
    guide?.engine || genreProfile.storyEngine ? `推荐 storyEngine：${genreProfile.storyEngine || guide?.engine}` : ""
  ].filter(Boolean).join("\n");
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
  genrePromptGuides,
  genreProfileContent,
  longOutlineContent,
  storyMemoryContent,
  narrativeStateContent,
  styleProfileContent,
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
  const storySettingRewriteProtocol = buildStorySettingRewriteProtocol(task, instruction);
  const genreGuideContent = getGenrePromptGuide(genrePromptGuides, book.genreProfile, book.genre);

  return [
    `你正在执行「${appName}」的一次写作辅助任务。通用标准：大师级小说总编 + 故事架构师 + 文字教练。`,
    "",
    `作品：${book.title}`,
    `篇幅：${lengthProfile.label}（${lengthProfile.scope}）`,
    `类型：${book.genre || "未设定"}`,
    genreProfileContent || genreGuideContent,
    `当前模块：${tabTitle}`,
    `大师思路：${lengthProfile.method}`,
    `本次任务：${task?.label ?? "综合辅助"} - ${task?.goal ?? "提升当前内容"}`,
    `本任务设计者：${taskSpec.role}`,
    instruction ? `作者额外要求：${instruction}` : "作者额外要求：无",
    "",
    "任务专属提示词：",
    taskSpec.strategy,
    storySettingRewriteProtocol ? "\n" + storySettingRewriteProtocol : "",
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
    "证据化写回规则：",
    "- 新增或更新 storyAssets、Narrative State、人物弧线时，必须能追溯到正文、设定或作者要求；每个长期事实优先写 evidenceRefs（chapterIndex/chapterId/quote/note）和 impact。",
    "- 不要写“主角成长了”“关系变复杂了”这种不可验证资产；要写成具体事实、证据载体和后续影响。",
    "- 人物弧线必须区分 want（外在想要）、need（内在需要）、currentStage（当前阶段）、nextPressure（下一压力）和 endpoint（终点方向）。",
    "",
    "Narrative Runtime（生成前必须遵守的统一故事状态）：",
    narrativeStateContent || "(暂无 Narrative State。)",
    "",
    "Narrative Style Profile（当前作品风格画像）：",
    styleProfileContent || "(暂无风格画像；本轮必须尊重已有文本语气，不要套用通用编辑腔。)",
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
    "- 生成前先读取 Narrative Runtime：人物状态、关系债务、资源/伤势、区域变化、世界规则、时间线和未回收伏笔必须延续；不得让下一章自动清零。",
    "- 生成前先读取 Genre Profile：题材、子类型和 storyEngine 决定冲突组织方式；只有探险/开荒类才默认强调地图扩展，言情/都市/悬疑/历史等题材必须使用各自的关系、证据、时代或现实压力推进。",
    "- 如果发现战力、伤势、时间线、资源、关系或伏笔冲突，优先在输出中规避；审阅类任务必须点名冲突来源和修复顺序。",
    "- 每个章节必须推进至少一条 Story Arc：主角弧、关系弧、世界弧、资源弧或伏笔弧；避免只有局部爽点没有长期推进。",
    "- 长篇修改后必须留意 Plan Drift：后续章节、伏笔、人物动机、卷级目标受影响时要明确指出。",
    "- 文风必须遵守 Narrative Style Profile；不要把所有书写成同一种总编腔、同一种钩子节奏或同一种对白锋芒。",
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
    "- 如果是故事设定搭建，优先从作者输入里提炼故事发动机、主角行动方向、世界压力、人物关系、阶段主线和后续目录可用的创作基准。",
    "- 如果是故事设定打磨，默认输出可直接替换/追加的成稿，不输出编辑说明；作者明确要求重做、替换、剔除或纯化方向时，必须按本轮要求生成新的完整设定稿。",
    "- 如果是书籍介绍生成，默认基于已经稳定的故事设定进行读者向包装；优先写清核心命题、主角处境、主要矛盾和读者钩子，不要把简介写成设定清单。",
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
  narrativeStateContent,
  genrePromptGuides,
  genreProfileContent,
  seedContent,
  promptAssets
}) {
  return [
    `你正在为「${appName}」执行长篇小说总体规划任务。`,
    "目标：先生成幕/卷级 Master Plan，不要输出章节列表。",
    "",
    `作品：${book.title}`,
    `类型：${book.genre || "未设定"}`,
    genreProfileContent || getGenrePromptGuide(genrePromptGuides, book.genreProfile, book.genre),
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
    "Narrative Runtime：",
    narrativeStateContent || "(暂无 Narrative State。)",
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
  narrativeStateContent,
  genrePromptGuides,
  genreProfileContent,
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
    genreProfileContent || getGenrePromptGuide(genrePromptGuides, book.genreProfile, book.genre),
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
    "Narrative Runtime：",
    narrativeStateContent || "(暂无 Narrative State。)",
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
