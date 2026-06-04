import { computed } from "vue";

import { BUILTIN_GORDON_TOOLS_MCP_ID } from "../../lib/presenter.js";

const COMIC_AI_TASKS_BY_TAB = {
  intro: [
    {
      id: "introSummary",
      label: "生成漫画介绍",
      goal: "补全故事、主角、冲突和画面目标。",
      target: "写入：故事与画面目标",
      runLabel: "生成介绍",
      type: "text",
      field: "summary",
      promptIntent: "生成一段可以直接写入「故事与画面目标」的漫画项目介绍，兼顾故事钩子、角色、世界观、核心冲突和读者情绪。"
    },
    {
      id: "visualStyle",
      label: "完善画风镜头",
      goal: "整理画风、角色造型和镜头语言。",
      target: "写入：画风与镜头",
      runLabel: "生成画风",
      type: "text",
      field: "visualStyle",
      promptIntent: "生成一段可以直接写入「画风与镜头」的设定，包含线条、色彩、构图、角色造型、镜头节奏和一致性约束。"
    },
    {
      id: "episodePlan",
      label: "生成总规划",
      goal: "规划海报构图或连载节奏。",
      target: "写入：规划",
      runLabel: "生成规划",
      type: "text",
      field: "episodePlan",
      promptIntent: "根据项目形态生成总规划：单图海报侧重主体、背景、人物站位、留白和比例；连载漫画侧重篇章节奏、每话钩子和画面推进。"
    }
  ],
  outline: [
    {
      id: "chapterOutline",
      label: "规划章节目录",
      goal: "生成可落盘的章节标题、内容简介和分镜提示词。",
      target: "写入：章节目录",
      runLabel: "生成目录",
      type: "text",
      writeMode: "chapters",
      promptIntent: "生成漫画章节目录，每章必须有标题、章节内容简介和适合后续拆分镜/单章生图的提示词；如用户要求，可补一段可选章节正文。"
    },
    {
      id: "outlineReview",
      label: "目录体检",
      goal: "检查章节节奏、画面连续性和出图风险。",
      target: "仅审阅",
      runLabel: "体检目录",
      type: "text",
      writeMode: "review",
      promptIntent: "审阅当前漫画目录，指出节奏断点、分镜信息不足、角色连续性风险、单章出图不稳定点和修正建议。"
    }
  ],
  chapter: [
    {
      id: "splitStoryboards",
      label: "拆分章节分镜",
      goal: "把章节故事拆成可编辑的分镜轨道。",
      target: "写入：当前章节分镜轨道",
      runLabel: "拆分分镜",
      type: "text",
      writeMode: "storyboards",
      promptIntent: "根据章节内容简介、章节正文、章节级提示和用户要求，把当前章节拆成多个连续分镜；每个分镜都要有画面事件、对白/旁白、镜头构图和可直接用于生图的提示词。"
    },
    {
      id: "chapterImage",
      label: "生成当前分镜图",
      goal: "把当前分镜绘制成单张画面。",
      target: "写入：当前分镜图片区",
      runLabel: "生成分镜图",
      type: "image",
      defaultImageCount: 1,
      promptIntent: "生成当前选中分镜的完整漫画画面，突出该分镜的动作、情绪、对白留白和构图。"
    },
    {
      id: "comicPage",
      label: "漫画页分镜",
      goal: "把当前分镜扩成一页多格画面。",
      target: "写入：当前分镜图片区",
      runLabel: "生成漫画页",
      type: "image",
      defaultImageCount: 1,
      promptIntent: "围绕当前分镜生成一页完整漫画页，包含 4-6 个清晰分格，镜头有远中近变化，叙事顺序清楚可读。"
    },
    {
      id: "continuousImages",
      label: "分镜连续图",
      goal: "为当前分镜生成多张连续候选画面。",
      target: "写入：当前分镜图片区",
      runLabel: "生成连续图",
      type: "image",
      defaultImageCount: 4,
      promptIntent: "围绕当前分镜生成多张连续叙事图，同一角色造型、服饰、光线、场景和色彩保持一致，每张推进一个动作节点。"
    },
    {
      id: "coverPoster",
      label: "封面海报",
      goal: "为项目生成封面或宣传图。",
      target: "写入：当前分镜图片区",
      runLabel: "生成封面图",
      type: "image",
      defaultImageCount: 1,
      promptIntent: "生成一张漫画封面海报，主体明确，保留标题区域或留白，画面有强识别度和作品气质。"
    }
  ]
};

const COMIC_AI_IMAGE_SIZE_OPTIONS = [
  { value: "1024x1536", label: "竖图" },
  { value: "1024x1024", label: "方图" },
  { value: "1536x1024", label: "横图" }
];

const COMIC_AI_QUALITY_OPTIONS = [
  { value: "medium", label: "标准" },
  { value: "high", label: "高质" },
  { value: "low", label: "草稿" }
];

const COMIC_AI_TEXT_SYSTEM = `你是 Gordon 的漫画项目文本助手。
你只输出可以直接写入当前漫画项目的最终内容，不输出解释、寒暄、代码块包裹或“以下是”等前后缀。
保留用户已有名称、角色、世界观、画风和篇幅约束；补全内容时必须贴合漫画项目，不编造外部事实。`;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  const normalized = Math.round(Number.isFinite(number) ? number : fallback);
  return Math.min(max, Math.max(min, normalized));
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function clipText(value, maxLength = 1600) {
  const text = normalizeText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function buildAppendText(currentText, outputText) {
  const current = String(currentText ?? "").trimEnd();
  const output = normalizeText(outputText);

  if (!current) {
    return output;
  }

  return `${current}\n\n${output}`;
}

function getImageSource(artifact) {
  return normalizeText(artifact?.url || artifact?.dataUrl);
}

function normalizeComicAiImageArtifact(artifact, index = 0) {
  if (!artifact || typeof artifact !== "object") {
    return null;
  }

  const kind = normalizeText(artifact.kind);
  const src = getImageSource(artifact);

  if (kind !== "image" || !src) {
    return null;
  }

  const provider = normalizeText(artifact.provider);
  const model = normalizeText(artifact.model);

  return {
    id: normalizeText(artifact.id) || `comic_ai_image_${index + 1}`,
    title: normalizeText(artifact.title) || `生成图片 ${index + 1}`,
    src,
    url: normalizeText(artifact.url),
    provider,
    model,
    prompt: normalizeText(artifact.prompt),
    meta: [provider, model].filter(Boolean).join(" / ")
  };
}

function extractComicAiImageArtifacts(toolResult) {
  const rawArtifacts = Array.isArray(toolResult?.structuredContent?.artifacts) ? toolResult.structuredContent.artifacts : [];
  return rawArtifacts.map((artifact, index) => normalizeComicAiImageArtifact(artifact, index)).filter(Boolean);
}

function getTasksByTab(tabId) {
  return COMIC_AI_TASKS_BY_TAB[tabId] ?? COMIC_AI_TASKS_BY_TAB.intro;
}

function getTaskById(tabId, taskId) {
  const tasks = getTasksByTab(tabId);
  return tasks.find((task) => task.id === taskId) ?? tasks[0];
}

function getPalettePromptLabel(project, getComicProjectPaletteLabel) {
  const paletteLabel = getComicProjectPaletteLabel(project?.palette);

  if (project?.palette === "monochrome") {
    return `${paletteLabel}，黑白漫画线稿或灰阶墨色，层次清楚`;
  }

  return `${paletteLabel}，色彩统一，主色和辅助色有明确关系`;
}

function getComicAssetTypeText(type) {
  if (type === "prop") {
    return "物品";
  }

  if (type === "scene") {
    return "场景";
  }

  return "人物";
}

function getComicAssetReferenceImages(assets = []) {
  const imageSources = [];
  const seen = new Set();

  (Array.isArray(assets) ? assets : []).forEach((asset) => {
    (Array.isArray(asset?.views) ? asset.views : []).forEach((view) => {
      const src = normalizeText(view?.src);

      if (!src || seen.has(src)) {
        return;
      }

      seen.add(src);
      imageSources.push(src);
    });
  });

  return imageSources;
}

function buildComicAssetContextLines(assets = []) {
  const normalizedAssets = Array.isArray(assets) ? assets : [];

  if (!normalizedAssets.length) {
    return ["引用素材：暂无"];
  }

  const referenceImageCount = getComicAssetReferenceImages(normalizedAssets).length;
  const referenceImageLine = referenceImageCount
    ? `其中 ${referenceImageCount} 张素材视图图会作为图生图参考图随工具调用提供`
    : "暂无可用素材视图图，请优先按文字约束保持一致性";

  return [
    `引用素材：${normalizedAssets.length} 个，${referenceImageLine}；生成时必须保持这些素材的身份、结构和视觉一致性。`,
    ...normalizedAssets.map((asset, index) => {
      const viewLabels = (Array.isArray(asset?.views) ? asset.views : [])
        .filter((view) => normalizeText(view?.src) || normalizeText(view?.prompt))
        .map((view, viewIndex) => `${normalizeText(view.label) || `视角 ${viewIndex + 1}`}：${clipText(view.prompt || view.src, 220)}`)
        .join("；");

      return [
        `${index + 1}. ${getComicAssetTypeText(asset?.type)}「${normalizeText(asset?.name) || "未命名素材"}」`,
        normalizeText(asset?.description) ? `描述：${clipText(asset.description, 360)}` : "",
        normalizeText(asset?.prompt) ? `约束：${clipText(asset.prompt, 360)}` : "",
        viewLabels ? `视图：${viewLabels}` : ""
      ]
        .filter(Boolean)
        .join("；");
    })
  ];
}

function extractJsonText(value) {
  const text = normalizeText(value).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const firstObject = text.indexOf("{");
  const firstArray = text.indexOf("[");
  const firstIndex = [firstObject, firstArray].filter((index) => index >= 0).sort((left, right) => left - right)[0] ?? -1;

  if (firstIndex < 0) {
    return text;
  }

  const opening = text[firstIndex];
  const closing = opening === "{" ? "}" : "]";
  const lastIndex = text.lastIndexOf(closing);

  return lastIndex > firstIndex ? text.slice(firstIndex, lastIndex + 1) : text.slice(firstIndex);
}

function parsePlainOutlineLines(text) {
  return normalizeText(text)
    .split(/\n+/)
    .map((line, index) => {
      const normalized = line.replace(/^[-*]\s*/, "").trim();
      const match = normalized.match(/^(?:第\s*)?([0-9０-９一二三四五六七八九十百千万零〇两]+)?\s*(?:章|话|回|集)?\s*[.、:：-]?\s*([^:：]+?)(?:[:：]\s*(.+))?$/);

      if (!match || !match[2]) {
        return null;
      }

      return {
        index: index + 1,
        title: match[2].trim(),
        summary: String(match[3] ?? "").trim(),
        content: "",
        prompt: ""
      };
    })
    .filter(Boolean);
}

function parseComicOutlineChapters(output) {
  const text = normalizeText(output);

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(extractJsonText(text));
    const chapters = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.chapters) ? parsed.chapters : [];
    return chapters
      .map((chapter, index) => ({
        index: clampInteger(chapter?.index, 1, 9999, index + 1),
        title: normalizeText(chapter?.title || chapter?.name || `第 ${index + 1} 章`),
        summary: normalizeText(chapter?.summary || chapter?.brief || chapter?.description),
        content: normalizeText(chapter?.content || chapter?.story || chapter?.body),
        prompt: normalizeText(chapter?.prompt || chapter?.imagePrompt),
        status: normalizeText(chapter?.status || "todo") || "todo"
      }))
      .filter((chapter) => chapter.title || chapter.summary || chapter.content || chapter.prompt);
  } catch {
    return parsePlainOutlineLines(text);
  }
}

function parsePlainStoryboardLines(text) {
  return normalizeText(text)
    .split(/\n+/)
    .map((line, index) => {
      const normalized = line.replace(/^[-*]\s*/, "").trim();

      if (!normalized) {
        return null;
      }

      const match = normalized.match(/^(?:#?\s*)?(?:分镜|镜头|画面)?\s*([0-9０-９]+)?\s*[.、:：-]?\s*(.+)$/u);
      const body = String(match?.[2] ?? normalized).trim();
      const [titlePart, ...restParts] = body.split(/[：:]/u);
      const rest = restParts.join("：").trim();

      return {
        index: index + 1,
        kind: "other",
        title: titlePart.trim() || `分镜 ${index + 1}`,
        beat: rest || body,
        dialogue: "",
        camera: "",
        prompt: rest || body
      };
    })
    .filter(Boolean);
}

function parseComicStoryboards(output) {
  const text = normalizeText(output);

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(extractJsonText(text));
    const storyboards = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.storyboards) ? parsed.storyboards : [];
    return storyboards
      .map((storyboard, index) => ({
        index: clampInteger(storyboard?.index, 1, 9999, index + 1),
        kind: normalizeText(storyboard?.kind || "other"),
        title: normalizeText(storyboard?.title || storyboard?.name || `分镜 ${index + 1}`),
        beat: normalizeText(storyboard?.beat || storyboard?.summary || storyboard?.description || storyboard?.content),
        dialogue: normalizeText(storyboard?.dialogue || storyboard?.lines || storyboard?.caption),
        camera: normalizeText(storyboard?.camera || storyboard?.shot || storyboard?.composition),
        prompt: normalizeText(storyboard?.prompt || storyboard?.imagePrompt),
        status: normalizeText(storyboard?.status || "todo") || "todo"
      }))
      .filter((storyboard) => storyboard.title || storyboard.beat || storyboard.dialogue || storyboard.camera || storyboard.prompt);
  } catch {
    return parsePlainStoryboardLines(text);
  }
}

export function createComicAiActions({
  activeComicChapter,
  activeComicChapterAssets,
  activeComicChapterImage,
  activeComicChapterIndex,
  activeComicStoryboard,
  activeComicStoryboardImages,
  activeComicStoryboardIndex,
  activeComicStoryboards,
  activeComicProject,
  activeComicTabMeta,
  appendComicChapterImages,
  applyComicChaptersFromAi,
  applyComicStoryboardsFromAi,
  createLocalId,
  desktopApi,
  getComicChapterDisplayTitle,
  getComicProjectFormatLabel,
  getComicProjectPaletteLabel,
  setComicChapterImagePrompt,
  setComicChapterImages,
  setComicChapterPrompt,
  setComicStoryboardField,
  setComicProjectEpisodePlan,
  setComicProjectSummary,
  setComicProjectVisualStyle,
  setStatus,
  ui
}) {
  const activeComicAiTaskOptions = computed(() => getTasksByTab(ui.marketplace.comic.activeTab));
  const activeComicAiTask = computed(() => getTaskById(ui.marketplace.comic.activeTab, ui.marketplace.comic.aiTaskId));
  const activeComicAiPromptPreview = computed(() =>
    buildComicAiPrompt({
      project: activeComicProject.value,
      chapter: activeComicChapter.value,
      chapterImage: activeComicChapterImage?.value ?? null,
      chapterIndex: activeComicChapterIndex.value,
      storyboard: activeComicStoryboard?.value ?? null,
      storyboardIndex: activeComicStoryboardIndex?.value ?? -1,
      storyboards: activeComicStoryboards?.value ?? [],
      storyboardImages: activeComicStoryboardImages?.value ?? [],
      tabId: ui.marketplace.comic.activeTab,
      tabLabel: activeComicTabMeta.value?.fieldLabel,
      task: activeComicAiTask.value,
      instruction: ui.marketplace.comic.aiInstruction,
      imageCount: ui.marketplace.comic.aiImageCount,
      storyboardCount: ui.marketplace.comic.aiStoryboardCount,
      referencedAssets: activeComicChapterAssets?.value ?? []
    })
  );

  function getState() {
    return ui.marketplace.comic;
  }

  function setComicAiFeedback(text, tone = "neutral") {
    const state = getState();
    state.aiFeedback = normalizeText(text);
    state.aiFeedbackTone = tone;
  }

  function syncComicAiTaskToActiveTab() {
    const state = getState();
    const task = getTaskById(state.activeTab, state.aiTaskId);
    state.aiTaskId = task.id;

    if (task.type === "image") {
      state.aiImageCount = clampInteger(state.aiImageCount, 1, 20, task.defaultImageCount || 1);
    } else if (task.writeMode === "storyboards") {
      state.aiStoryboardCount = clampInteger(state.aiStoryboardCount, 1, 40, 8);
    }

    return task;
  }

  function setComicAiDrawerOpen(isOpen) {
    const state = getState();
    state.isAiDrawerOpen = Boolean(isOpen);

    if (state.isAiDrawerOpen) {
      syncComicAiTaskToActiveTab();
    } else {
      state.isAiTaskPickerOpen = false;
      state.isPromptPreviewOpen = false;
    }
  }

  function toggleComicAiTaskPicker() {
    const state = getState();
    state.isAiTaskPickerOpen = !state.isAiTaskPickerOpen;
  }

  function selectComicAiTask(taskId) {
    const task = getTaskById(ui.marketplace.comic.activeTab, taskId);
    const state = getState();
    state.aiTaskId = task.id;
    state.isAiTaskPickerOpen = false;

    if (task.type === "image") {
      state.aiImageCount = clampInteger(task.defaultImageCount, 1, 20, 1);
    } else if (task.writeMode === "storyboards") {
      state.aiStoryboardCount = clampInteger(state.aiStoryboardCount, 1, 40, 8);
    }
  }

  function toggleComicAiPromptPreview() {
    const state = getState();
    state.isPromptPreviewOpen = !state.isPromptPreviewOpen;
  }

  function setComicAiInstruction(value) {
    getState().aiInstruction = String(value ?? "");
  }

  function setComicAiOutput(value) {
    getState().aiOutput = String(value ?? "");
  }

  function setComicAiImageSize(value) {
    const normalized = normalizeText(value);
    const fallback = COMIC_AI_IMAGE_SIZE_OPTIONS[0].value;
    getState().aiImageSize = COMIC_AI_IMAGE_SIZE_OPTIONS.some((option) => option.value === normalized) ? normalized : fallback;
  }

  function setComicAiImageQuality(value) {
    const normalized = normalizeText(value);
    const fallback = COMIC_AI_QUALITY_OPTIONS[0].value;
    getState().aiQuality = COMIC_AI_QUALITY_OPTIONS.some((option) => option.value === normalized) ? normalized : fallback;
  }

  function setComicAiImageCount(value) {
    getState().aiImageCount = clampInteger(value, 1, 20, 1);
  }

  function setComicAiStoryboardCount(value) {
    getState().aiStoryboardCount = clampInteger(value, 1, 40, 8);
  }

  function buildComicStoryboardContextLines(storyboards = [], activeStoryboard = null, storyboardIndex = -1, storyboardImages = []) {
    const normalizedStoryboards = Array.isArray(storyboards) ? storyboards : [];
    const activeIndex = Number.isFinite(storyboardIndex) ? storyboardIndex : -1;
    const activeOrder = activeIndex >= 0 ? activeIndex + 1 : normalizedStoryboards.findIndex((storyboard) => storyboard.id === activeStoryboard?.id) + 1;

    return [
      `章节分镜数量：${normalizedStoryboards.length}`,
      normalizedStoryboards.length
        ? `分镜轨道：${normalizedStoryboards
            .slice(0, 40)
            .map((storyboard, index) => {
              const title = normalizeText(storyboard?.title) || `分镜 ${index + 1}`;
              const kind = normalizeText(storyboard?.kind) || "other";
              const beat = clipText(storyboard?.beat || storyboard?.prompt || "暂无", 160);
              return `${index + 1}. [${kind}] ${title}：${beat}`;
            })
            .join("\n")}`
        : "分镜轨道：暂无",
      activeStoryboard ? `当前分镜：第 ${activeOrder || 1} 条 / ${normalizeText(activeStoryboard.title) || "未命名分镜"}` : "当前分镜：暂无",
      activeStoryboard ? `当前分镜类型：${normalizeText(activeStoryboard.kind) || "other"}` : "",
      activeStoryboard ? `当前分镜画面：${clipText(activeStoryboard.beat || "暂无", 600)}` : "",
      activeStoryboard ? `当前分镜对白/旁白：${clipText(activeStoryboard.dialogue || "暂无", 360)}` : "",
      activeStoryboard ? `当前分镜镜头：${clipText(activeStoryboard.camera || "暂无", 360)}` : "",
      activeStoryboard ? `当前分镜提示词：${clipText(activeStoryboard.prompt || "暂无", 700)}` : "",
      activeStoryboard ? `当前分镜已生成图片：${Array.isArray(storyboardImages) ? storyboardImages.length : 0} 张` : ""
    ].filter(Boolean);
  }

  function buildComicContextLines(
    project,
    chapter,
    chapterIndex,
    tabLabel,
    referencedAssets = [],
    chapterImage = null,
    storyboard = null,
    storyboardIndex = -1,
    storyboards = [],
    storyboardImages = []
  ) {
    const chapterTitle = chapter ? getComicChapterDisplayTitle(chapter, chapterIndex) : "暂无当前章节";
    const imageParams = [
      normalizeText(chapterImage?.size) ? `尺寸 ${normalizeText(chapterImage.size)}` : "",
      normalizeText(chapterImage?.quality) ? `质量 ${normalizeText(chapterImage.quality)}` : ""
    ]
      .filter(Boolean)
      .join("，");

    return [
      `当前模块：${tabLabel || "漫画项目"}`,
      `项目：${project?.title || "未命名漫画"}`,
      `形态：${getComicProjectFormatLabel(project?.format)}`,
      `画面：${getPalettePromptLabel(project, getComicProjectPaletteLabel)}`,
      `类型：${project?.genre || "漫画 / 待定类型"}`,
      `页数目标：${project?.pageCount || 1} 页`,
      `故事与画面目标：${clipText(project?.summary || "暂无")}`,
      `画风与镜头：${clipText(project?.visualStyle || "暂无")}`,
      `总规划：${clipText(project?.episodePlan || "暂无")}`,
      `当前章节：${chapterTitle}`,
      `章节内容简介：${clipText(chapter?.summary || "暂无")}`,
      `章节正文/故事内容：${clipText(chapter?.content || "暂无", 1400)}`,
      `分镜与出图提示：${clipText(chapter?.prompt || "暂无")}`,
      ...buildComicStoryboardContextLines(storyboards, storyboard, storyboardIndex, storyboardImages),
      chapterImage ? `当前选中图片：${normalizeText(chapterImage.alt) || "未命名画面"}${imageParams ? `（${imageParams}）` : ""}` : "",
      chapterImage ? `当前图片生图提示词：${clipText(chapterImage.prompt || "暂无")}` : "",
      ...buildComicAssetContextLines(referencedAssets)
    ].filter(Boolean);
  }

  function buildComicAiPrompt({
    project,
    chapter,
    chapterImage,
    chapterIndex,
    storyboard,
    storyboardIndex,
    storyboards,
    storyboardImages,
    tabId,
    tabLabel,
    task,
    instruction,
    imageCount,
    storyboardCount,
    referencedAssets
  }) {
    const safeTask = task ?? getTasksByTab(tabId)[0];
    const userInstruction = normalizeText(instruction) || "按当前项目设定生成，保持漫画感、画面连续性和可执行性。";
    const contextLines = buildComicContextLines(
      project,
      chapter,
      chapterIndex,
      tabLabel,
      referencedAssets,
      chapterImage,
      storyboard,
      storyboardIndex,
      storyboards,
      storyboardImages
    ).join("\n");

    if (safeTask.type === "image") {
      const count = clampInteger(imageCount, 1, 20, safeTask.defaultImageCount || 1);
      const sequenceLine =
        safeTask.id === "continuousImages"
          ? `连续图数量：${count} 张。请明确第 1 张到第 ${count} 张的画面推进，并保持角色、服饰、场景和色调一致。`
          : count > 1
            ? `生成数量：${count} 张，作为同一章节的连续候选图，保持角色与风格一致。`
            : "生成数量：1 张。";

      return [
        "请生成漫画图像提示词。",
        "",
        "【任务】",
        `${safeTask.label}：${safeTask.promptIntent}`,
        sequenceLine,
        "",
        "【项目上下文】",
        contextLines,
        "",
        "【用户额外要求】",
        userInstruction,
        "",
        "【画面硬性约束】",
        "角色造型、年龄感、服饰、发型和关键道具必须前后一致。",
        "镜头语言要具体，包含构图、景别、动作方向、光线、色彩、气氛和背景信息。",
        "避免真实文字、水印、logo、乱码字幕和多余边框；如需要对白或标题，只保留留白区域。",
        "输出应是图像生成模型可直接使用的完整提示词。"
      ].join("\n");
    }

    const outputRule =
      safeTask.writeMode === "chapters"
        ? [
            "请只输出 JSON 对象，不要代码块。",
            '格式：{"chapters":[{"index":1,"title":"章节标题","summary":"本章内容简介","content":"可选章节正文或故事草稿","prompt":"本章分镜与生图提示词"}]}',
            "章节数应贴合项目形态和页数目标；summary 写故事事件和情绪推进，prompt 写分镜拆解、图片数量建议、景别、动作和出图约束；标题不要模板化重复。"
          ].join("\n")
        : safeTask.writeMode === "storyboards"
          ? [
              "请只输出 JSON 对象，不要代码块。",
              '格式：{"storyboards":[{"index":1,"kind":"dialogue|scene|action|transition|emotion|other","title":"分镜标题","beat":"画面内容与故事节点","dialogue":"对白/旁白，可为空","camera":"景别/构图/镜头运动","prompt":"可直接用于生成这一张图的生图提示词"}]}',
              `目标分镜数：${clampInteger(storyboardCount, 1, 40, 8)} 条；如果用户额外要求了具体数量，以用户要求为准。`,
              "分镜必须覆盖本章的对话、过渡、场景刻画、情绪停顿和打斗动作，不要把一章压缩成单张概念图。",
              "kind 只能使用 dialogue / scene / action / transition / emotion / other；prompt 要聚焦单张图，不写解释和修改说明。"
            ].join("\n")
        : safeTask.writeMode === "review"
          ? "请输出简洁的审阅报告，按问题、风险、修正建议组织，不要改写成章节正文。"
          : "请只输出可直接写入目标字段的正文，不要标题和解释。";

    return [
      "请完成漫画项目文本生成任务。",
      "",
      "【任务】",
      `${safeTask.label}：${safeTask.promptIntent}`,
      "",
      "【项目上下文】",
      contextLines,
      "",
      "【用户额外要求】",
      userInstruction,
      "",
      "【输出要求】",
      outputRule
    ].join("\n");
  }

  function buildComicAiOutputText({ task, prompt, toolResult, images }) {
    const resultText = normalizeText(toolResult?.contentText);
    const lines = [
      `任务：${task.label}`,
      "",
      "出图提示词：",
      prompt,
      "",
      images.length ? `已生成 ${images.length} 张图片。` : "",
      resultText && !images.length ? resultText : ""
    ];

    return lines.filter(Boolean).join("\n");
  }

  async function generateComicTextOutput(task, prompt, requestId) {
    const state = getState();

    if (!desktopApi?.invokeModelText) {
      setComicAiFeedback("AI 文本桥接未就绪。", "danger");
      return;
    }

    const result = await desktopApi.invokeModelText({
      requestId,
      temperature: task.writeMode === "review" ? 0.42 : 0.64,
      maxOutputTokens: task.writeMode === "chapters" || task.writeMode === "storyboards" ? 4200 : 1800,
      messages: [
        {
          role: "system",
          content: COMIC_AI_TEXT_SYSTEM
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    if (state.aiRequestId !== requestId) {
      return;
    }

    const output = normalizeText(result?.text);

    if (!output) {
      setComicAiFeedback("模型没有返回可写入内容。", "warning");
      return;
    }

    state.aiOutput = output;
    setComicAiFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "文本已生成。", "success");
    setStatus("灵绘小筑已生成文本内容。", "success");
  }

  async function generateComicImageOutput(task, prompt, requestId, referencedAssets = []) {
    const state = getState();

    if (!desktopApi?.callMcpServerTool) {
      setComicAiFeedback("Gordon Tools 桥接未就绪。", "danger");
      return;
    }

    const referenceImages = getComicAssetReferenceImages(referencedAssets);
    const toolArguments = {
      prompt,
      size: state.aiImageSize,
      n: clampInteger(state.aiImageCount, 1, 20, task.defaultImageCount || 1),
      quality: state.aiQuality
    };

    if (referenceImages.length) {
      toolArguments.images = referenceImages;
    }

    const toolResult = await desktopApi.callMcpServerTool({
      serverId: BUILTIN_GORDON_TOOLS_MCP_ID,
      toolName: "image_gen",
      arguments: toolArguments
    });

    if (state.aiRequestId !== requestId) {
      return;
    }

    if (toolResult?.isError) {
      throw new Error(normalizeText(toolResult.contentText) || "image_gen 调用失败");
    }

    const images = extractComicAiImageArtifacts(toolResult);

    if (!images.length) {
      setComicAiFeedback("工具没有返回可展示图片。", "warning");
      state.aiOutput = buildComicAiOutputText({ task, prompt, toolResult, images: [] });
      return;
    }

    state.aiGeneratedImages = images;
    state.aiOutput = buildComicAiOutputText({ task, prompt, toolResult, images });
    setComicAiFeedback(`已生成 ${images.length} 张图片。`, "success");
    setStatus(`灵绘小筑已生成 ${images.length} 张漫画图。`, "success");
  }

  async function generateComicAiOutput() {
    const state = getState();

    if (state.isAiRunning) {
      return;
    }

    if (!activeComicProject.value) {
      setComicAiFeedback("请先打开一个漫画项目。", "warning");
      return;
    }

    const task = syncComicAiTaskToActiveTab();
    const referencedAssets = task.type === "image" ? activeComicChapterAssets?.value ?? [] : [];
    const prompt = activeComicAiPromptPreview.value;
    const requestId =
      typeof createLocalId === "function" ? createLocalId("comic_ai_request") : `comic_ai_request_${Date.now()}`;

    state.isAiRunning = true;
    state.aiRequestId = requestId;
    state.aiOutput = "";
    state.aiPromptPreview = prompt;
    state.aiGeneratedImages = [];
    setComicAiFeedback(task.type === "image" ? "正在生成图片..." : "正在生成文本...", "neutral");
    setStatus(task.type === "image" ? "灵绘小筑正在生成漫画图。" : "灵绘小筑正在调用大模型生成内容。", "neutral");

    try {
      if (task.type === "image") {
        await generateComicImageOutput(task, prompt, requestId, referencedAssets);
      } else {
        await generateComicTextOutput(task, prompt, requestId);
      }
    } catch (error) {
      if (state.aiRequestId !== requestId) {
        return;
      }

      console.error("Failed to generate comic AI output", error);
      const message = getErrorMessage(error);
      setComicAiFeedback(`生成失败：${message}`, "danger");
      setStatus(`灵绘小筑生成失败：${message}`, "danger");
    } finally {
      if (state.aiRequestId === requestId) {
        state.isAiRunning = false;
        state.aiRequestId = "";
      }
    }
  }

  function getComicTextFieldValue(task) {
    const project = activeComicProject.value;

    if (task.field === "summary") {
      return project?.summary ?? "";
    }

    if (task.field === "visualStyle") {
      return project?.visualStyle ?? "";
    }

    if (task.field === "episodePlan") {
      return project?.episodePlan ?? "";
    }

    return "";
  }

  function setComicTextFieldValue(task, value) {
    if (task.field === "summary") {
      setComicProjectSummary(value);
      return true;
    }

    if (task.field === "visualStyle") {
      setComicProjectVisualStyle(value);
      return true;
    }

    if (task.field === "episodePlan") {
      setComicProjectEpisodePlan(value);
      return true;
    }

    return false;
  }

  function applyComicTextOutput(task, mode) {
    const state = getState();
    const output = normalizeText(state.aiOutput);

    if (!output) {
      setComicAiFeedback("还没有可写入的生成结果。", "warning");
      return;
    }

    if (task.writeMode === "review") {
      setComicAiFeedback("这个任务只用于审阅，不会写回项目。", "neutral");
      return;
    }

    if (task.writeMode === "chapters") {
      const chapters = parseComicOutlineChapters(output);

      if (!chapters.length) {
        setComicAiFeedback("没有解析到可写入的章节目录。", "warning");
        return;
      }

      if (!applyComicChaptersFromAi(chapters, mode)) {
        setComicAiFeedback("章节目录写入失败。", "danger");
        return;
      }

      setComicAiFeedback(mode === "replace" ? "已替换章节目录。" : "已追加章节目录。", "success");
      setStatus(mode === "replace" ? "灵绘小筑已替换章节目录。" : "灵绘小筑已追加章节目录。", "success");
      return;
    }

    if (task.writeMode === "storyboards") {
      const storyboards = parseComicStoryboards(output);

      if (!storyboards.length) {
        setComicAiFeedback("没有解析到可写入的分镜。", "warning");
        return;
      }

      if (!applyComicStoryboardsFromAi(storyboards, mode)) {
        setComicAiFeedback("分镜轨道写入失败。", "danger");
        return;
      }

      setComicAiFeedback(mode === "replace" ? "已替换当前章节分镜。" : "已追加到当前章节分镜。", "success");
      setStatus(mode === "replace" ? "灵绘小筑已替换当前章节分镜。" : "灵绘小筑已追加到当前章节分镜。", "success");
      return;
    }

    const currentText = getComicTextFieldValue(task);
    const nextText = mode === "append" ? buildAppendText(currentText, output) : output;

    if (!setComicTextFieldValue(task, nextText)) {
      setComicAiFeedback("当前任务没有可写入字段。", "danger");
      return;
    }

    setComicAiFeedback(mode === "replace" ? "已替换目标字段。" : "已追加到目标字段。", "success");
    setStatus(mode === "replace" ? "灵绘小筑已替换目标字段。" : "灵绘小筑已追加到目标字段。", "success");
  }

  function applyComicImageOutput(mode) {
    const state = getState();
    const chapter = activeComicChapter.value;

    if (!chapter) {
      setComicAiFeedback("请先选择一个漫画章节。", "warning");
      return;
    }

    if (mode === "prompt") {
      const prompt = normalizeText(state.aiPromptPreview || activeComicAiPromptPreview.value);

      if (!prompt) {
        setComicAiFeedback("还没有可写入的提示词。", "warning");
        return;
      }

      if (activeComicStoryboard?.value && typeof setComicStoryboardField === "function") {
        setComicStoryboardField(activeComicStoryboard.value, "prompt", prompt);
        setComicAiFeedback("已写入当前分镜生图提示词。", "success");
        setStatus("灵绘小筑已写入当前分镜生图提示词。", "success");
      } else if (activeComicChapterImage?.value && typeof setComicChapterImagePrompt === "function") {
        setComicChapterImagePrompt(chapter, activeComicChapterImage.value.id, prompt);
        setComicAiFeedback("已写入当前图片生图提示词。", "success");
        setStatus("灵绘小筑已写入当前图片生图提示词。", "success");
      } else {
        setComicChapterPrompt(chapter, prompt);
        setComicAiFeedback("当前章节暂无图片，已写入分镜与出图提示。", "success");
        setStatus("灵绘小筑已写入当前章节分镜与出图提示。", "success");
      }
      return;
    }

    const prompt = normalizeText(state.aiPromptPreview || activeComicAiPromptPreview.value);
    const images = (Array.isArray(state.aiGeneratedImages) ? state.aiGeneratedImages : [])
      .map((image, index) => ({
        alt: normalizeText(image.alt || image.title) || `灵绘小筑生成图 ${index + 1}`,
        src: normalizeText(image.src),
        prompt: normalizeText(image.prompt) || prompt,
        size: normalizeText(state.aiImageSize),
        quality: normalizeText(state.aiQuality)
      }))
      .filter((image) => image.src);

    if (!images.length) {
      setComicAiFeedback("还没有可写入的图片。", "warning");
      return;
    }

    if (mode === "replace" && typeof setComicChapterImages === "function") {
      setComicChapterImages(chapter, images, { storyboardId: activeComicStoryboard?.value?.id ?? "" });
    } else if (typeof appendComicChapterImages === "function") {
      appendComicChapterImages(chapter, images, { storyboardId: activeComicStoryboard?.value?.id ?? "" });
    }

    const targetLabel = activeComicStoryboard?.value ? "当前分镜图片" : "当前章节图片";
    setComicAiFeedback(mode === "replace" ? `已替换${targetLabel}。` : `已追加到${targetLabel}。`, "success");
    setStatus(mode === "replace" ? `灵绘小筑已替换${targetLabel}。` : `灵绘小筑已追加到${targetLabel}。`, "success");
  }

  function applyComicAiOutput(mode = "append") {
    const task = activeComicAiTask.value;

    if (task.type === "image") {
      applyComicImageOutput(mode);
      return;
    }

    applyComicTextOutput(task, mode);
  }

  function getComicAiRunButtonLabel() {
    const state = getState();

    if (state.isAiRunning) {
      return "生成中";
    }

    return activeComicAiTask.value?.runLabel ?? "生成";
  }

  function getComicAiFeedbackClass() {
    const tone = getState().aiFeedbackTone;
    return tone ? `is-${tone}` : "";
  }

  return {
    activeComicAiPromptPreview,
    activeComicAiTask,
    activeComicAiTaskOptions,
    applyComicAiOutput,
    comicAiImageSizeOptions: COMIC_AI_IMAGE_SIZE_OPTIONS,
    comicAiQualityOptions: COMIC_AI_QUALITY_OPTIONS,
    generateComicAiOutput,
    getComicAiFeedbackClass,
    getComicAiRunButtonLabel,
    selectComicAiTask,
    setComicAiDrawerOpen,
    setComicAiImageCount,
    setComicAiImageQuality,
    setComicAiImageSize,
    setComicAiInstruction,
    setComicAiOutput,
    setComicAiStoryboardCount,
    toggleComicAiPromptPreview,
    toggleComicAiTaskPicker
  };
}
