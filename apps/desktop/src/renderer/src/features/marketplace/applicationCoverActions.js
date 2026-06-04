import { computed } from "vue";

import { BUILTIN_GORDON_TOOLS_MCP_ID } from "../../lib/presenter.js";

const DEFAULT_COVER_PROMPT =
  "竖版作品封面，主体明确，留出标题空间，画面有完整作品气质，细腻光影，构图克制，适合作品项目封面";

const COVER_APP_META = {
  writing: {
    appName: "墨笔生花",
    itemLabel: "书籍",
    fallbackInitial: "书",
    size: "1024x1536"
  },
  comic: {
    appName: "丹青溢彩",
    itemLabel: "漫画项目",
    fallbackInitial: "漫",
    size: "1024x1536"
  },
  video: {
    appName: "流光绘影",
    itemLabel: "视频项目",
    fallbackInitial: "影",
    size: "1024x1536"
  },
  music: {
    appName: "瑶琴映月",
    itemLabel: "音乐专辑",
    fallbackInitial: "音",
    size: "1024x1536"
  }
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function clipText(value, maxLength = 260) {
  const text = normalizeText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function getImageSource(artifact = {}) {
  return (
    normalizeText(artifact.src) ||
    normalizeText(artifact.url) ||
    normalizeText(artifact.dataUrl) ||
    normalizeText(artifact.base64) ||
    normalizeText(artifact.imageUrl)
  );
}

function normalizeCoverImageArtifact(artifact, index = 0) {
  if (!artifact || typeof artifact !== "object") {
    return null;
  }

  const kind = normalizeText(artifact.kind);
  const src = getImageSource(artifact);

  if (kind !== "image" || !src) {
    return null;
  }

  return {
    id: normalizeText(artifact.id) || `application_cover_${index + 1}`,
    title: normalizeText(artifact.title) || `封面 ${index + 1}`,
    src,
    provider: normalizeText(artifact.provider),
    model: normalizeText(artifact.model),
    prompt: normalizeText(artifact.prompt),
    meta: [normalizeText(artifact.provider), normalizeText(artifact.model)].filter(Boolean).join(" / ")
  };
}

function extractCoverImageArtifacts(toolResult) {
  const rawArtifacts = Array.isArray(toolResult?.structuredContent?.artifacts) ? toolResult.structuredContent.artifacts : [];
  return rawArtifacts.map((artifact, index) => normalizeCoverImageArtifact(artifact, index)).filter(Boolean);
}

function isCoverDataUrl(value) {
  return normalizeText(value).startsWith("data:image/");
}

function buildCoverPromptFallback(item, appId, shouldShowTitle) {
  const title = normalizeText(item?.title);
  const parts = [
    appId === "writing" ? "竖版小说封面" : "竖版作品封面",
    shouldShowTitle
      ? `封面文字包含标题《${title || "未命名作品"}》，题字清晰端正，不要乱码`
      : "封面不出现标题文字，只保留干净画面",
    normalizeText(item?.genre) ? `类型：${normalizeText(item?.genre)}` : "",
    normalizeText(item?.summary) ? `作品气质：${clipText(item.summary)}` : "",
    normalizeText(item?.intro) ? `作品气质：${clipText(item.intro)}` : "",
    normalizeText(item?.visualStyle) ? `视觉风格：${clipText(item.visualStyle, 180)}` : "",
    normalizeText(item?.mood) ? `情绪：${normalizeText(item.mood)}` : "",
    "主体明确，留出标题题字区域，画面有辨识度，细腻光影，构图克制，避免水印、logo、乱码文字"
  ];

  return parts.filter(Boolean).join("，") || DEFAULT_COVER_PROMPT;
}

function buildCoverGenerationPrompt(item, prompt, shouldShowTitle) {
  const title = normalizeText(item?.title);
  const titleInstruction = shouldShowTitle
    ? `封面上必须包含清晰可读的中文标题《${title || "未命名作品"}》，标题字体与画面风格协调，避免乱码、错字、额外水印或 logo。`
    : "封面上不要出现标题、文字、水印或 logo，只生成纯画面构图。";

  return [prompt, titleInstruction].filter(Boolean).join("\n\n");
}

export function createApplicationCoverActions({
  activeAdapters,
  desktopApi,
  fieldAiActions,
  setStatus,
  ui
}) {
  const coverState = ui.marketplace.cover;
  const activeCoverAdapter = computed(() => activeAdapters?.[coverState.appId] ?? null);
  const activeCoverItem = computed(() => activeCoverAdapter.value?.getItem?.() ?? null);
  const activeCoverMeta = computed(() => ({
    ...(COVER_APP_META[coverState.appId] ?? COVER_APP_META.writing),
    ...(activeCoverAdapter.value?.meta ?? {})
  }));

  function setApplicationCoverFeedback(text, tone = "neutral") {
    const message = normalizeText(text);
    coverState.feedback = message;
    coverState.feedbackTone = tone;

    if (message) {
      setStatus(message, tone);
    }
  }

  function setApplicationCoverDraftUrl(value) {
    const coverUrl = normalizeText(value);
    coverState.draftUrl = coverUrl;
    coverState.previewUrl = coverUrl;
  }

  function resetApplicationCoverDialog() {
    coverState.isDialogOpen = false;
    coverState.appId = "";
    coverState.itemId = "";
    coverState.draftUrl = "";
    coverState.previewUrl = "";
    setApplicationCoverFeedback("", "neutral");
  }

  function getApplicationCoverPromptFallback(item = activeCoverItem.value, appId = coverState.appId) {
    return buildCoverPromptFallback(item, appId, coverState.shouldShowTitle);
  }

  function openApplicationCoverDialog(appId, mode = "upload") {
    const adapter = activeAdapters?.[appId] ?? null;
    const item = adapter?.getItem?.() ?? null;

    if (!adapter || !item || adapter?.isDisabled?.()) {
      return;
    }

    const coverUrl = normalizeText(item.coverUrl);
    coverState.appId = appId;
    coverState.itemId = normalizeText(item.id);
    coverState.dialogMode = mode === "generate" ? "generate" : "upload";
    coverState.urlInput = isCoverDataUrl(coverUrl) ? "" : coverUrl;
    coverState.shouldShowTitle = item.coverShouldShowTitle !== false;
    coverState.promptInput = normalizeText(item.coverPrompt) || buildCoverPromptFallback(item, appId, coverState.shouldShowTitle);
    setApplicationCoverDraftUrl(coverUrl);
    setApplicationCoverFeedback("", "neutral");
    coverState.isDialogOpen = true;
  }

  function closeApplicationCoverDialog() {
    if (coverState.isGenerating) {
      return;
    }

    resetApplicationCoverDialog();
  }

  function setApplicationCoverDialogMode(mode) {
    coverState.dialogMode = mode === "generate" ? "generate" : "upload";
  }

  function setApplicationCoverUrlInput(value) {
    coverState.urlInput = String(value ?? "");
  }

  function setApplicationCoverPromptInput(value) {
    coverState.promptInput = String(value ?? "");
  }

  function setApplicationCoverShouldShowTitle(value) {
    coverState.shouldShowTitle = Boolean(value);
    if (!normalizeText(coverState.promptInput)) {
      coverState.promptInput = getApplicationCoverPromptFallback();
    }
  }

  function applyApplicationCoverUrlInput() {
    const coverUrl = normalizeText(coverState.urlInput);

    if (!coverUrl) {
      setApplicationCoverFeedback("请先填写图片 URL。", "warning");
      return;
    }

    setApplicationCoverDraftUrl(coverUrl);
    setApplicationCoverFeedback("已加载远端封面预览，确认后写入当前作品。", "success");
  }

  async function selectApplicationCoverLocalImage() {
    const selectCoverImage = desktopApi?.selectApplicationCoverImage ?? desktopApi?.selectWritingBookCoverImage;

    if (!selectCoverImage) {
      setApplicationCoverFeedback("本地图片选择桥接未就绪。", "danger");
      return;
    }

    try {
      const dataUrl = await selectCoverImage();

      if (!dataUrl) {
        return;
      }

      setApplicationCoverDraftUrl(dataUrl);
      coverState.urlInput = "";
      setApplicationCoverFeedback("已加载本地封面预览，确认后写入当前作品。", "success");
    } catch (error) {
      console.error("Failed to select application cover image", error);
      setApplicationCoverFeedback(`选择封面失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  async function generateApplicationCoverImage() {
    const item = activeCoverItem.value;
    const adapter = activeCoverAdapter.value;
    const prompt = normalizeText(coverState.promptInput) || getApplicationCoverPromptFallback(item, coverState.appId);
    const generationPrompt = buildCoverGenerationPrompt(item, prompt, coverState.shouldShowTitle);

    if (!item || !adapter) {
      setApplicationCoverFeedback("请先打开一个作品。", "warning");
      return;
    }

    if (!desktopApi?.callMcpServerTool) {
      setApplicationCoverFeedback("Gordon Tools 桥接未就绪。", "danger");
      return;
    }

    if (!prompt) {
      setApplicationCoverFeedback("请先填写封面生成提示词。", "warning");
      return;
    }

    coverState.isGenerating = true;
    setApplicationCoverFeedback("正在调用 image_gen 生成封面...", "neutral");

    try {
      const toolResult = await desktopApi.callMcpServerTool({
        serverId: BUILTIN_GORDON_TOOLS_MCP_ID,
        toolName: "image_gen",
        arguments: {
          prompt: generationPrompt,
          size: activeCoverMeta.value.size ?? "1024x1536",
          n: 1,
          quality: "medium"
        }
      });

      if (toolResult?.isError) {
        throw new Error(normalizeText(toolResult.contentText) || "image_gen 调用失败");
      }

      const images = extractCoverImageArtifacts(toolResult);
      const firstImage = images[0] ?? null;

      if (!firstImage?.src) {
        setApplicationCoverFeedback("工具没有返回可展示封面。", "warning");
        return;
      }

      coverState.promptInput = firstImage.prompt || prompt;
      setApplicationCoverDraftUrl(firstImage.src);
      coverState.urlInput = "";
      setApplicationCoverFeedback(firstImage.meta ? `封面已生成：${firstImage.meta}` : "封面已生成，确认后写入当前作品。", "success");
    } catch (error) {
      console.error("Failed to generate application cover", error);
      setApplicationCoverFeedback(`生成封面失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    } finally {
      coverState.isGenerating = false;
    }
  }

  async function downloadApplicationCoverImage() {
    const item = activeCoverItem.value;
    const imageUrl = normalizeText(coverState.previewUrl);
    const saveCoverImage = desktopApi?.saveApplicationCoverImage ?? desktopApi?.saveWritingBookCoverImage;

    if (!item) {
      setApplicationCoverFeedback("请先打开一个作品。", "warning");
      return;
    }

    if (!imageUrl) {
      setApplicationCoverFeedback("当前没有可下载的封面。", "warning");
      return;
    }

    if (!saveCoverImage) {
      setApplicationCoverFeedback("封面下载桥接未就绪。", "danger");
      return;
    }

    try {
      const result = await saveCoverImage({
        title: item.title || "未命名封面",
        imageUrl
      });

      if (!result) {
        return;
      }

      setApplicationCoverFeedback(`封面已下载：${result.fileName}`, "success");
    } catch (error) {
      console.error("Failed to download application cover image", error);
      setApplicationCoverFeedback(`下载封面失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  function clearApplicationCoverImage() {
    if (!activeCoverItem.value) {
      return;
    }

    coverState.urlInput = "";
    setApplicationCoverDraftUrl("");
    setApplicationCoverFeedback("已清空封面预览，确认后写入当前作品。", "success");
  }

  async function confirmApplicationCoverDialog() {
    const item = activeCoverItem.value;
    const adapter = activeCoverAdapter.value;

    if (coverState.isGenerating) {
      return;
    }

    if (!item || !adapter?.applyCover) {
      setApplicationCoverFeedback("当前作品封面写回能力未就绪。", "danger");
      return;
    }

    try {
      await adapter.applyCover(item, {
        coverUrl: normalizeText(coverState.draftUrl),
        coverPrompt: String(coverState.promptInput ?? item.coverPrompt ?? ""),
        coverShouldShowTitle: Boolean(coverState.shouldShowTitle)
      });
      setApplicationCoverFeedback("封面已写入当前作品。", "success");
      resetApplicationCoverDialog();
    } catch (error) {
      console.error("Failed to confirm application cover", error);
      setApplicationCoverFeedback(`封面写入失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  function buildApplicationCoverPromptAiContext() {
    const item = activeCoverItem.value;
    const appName = activeCoverMeta.value.appName;
    const itemLabel = activeCoverMeta.value.itemLabel;

    return [
      `用途：增强${appName}${itemLabel}封面图像生成提示词，结果会交给 image_gen 使用。`,
      `标题：${item?.title ?? ""}`,
      normalizeText(item?.genre) ? `类型：${item.genre}` : "",
      normalizeText(item?.artist) ? `作者/制作人：${item.artist}` : "",
      normalizeText(item?.mood) ? `情绪：${item.mood}` : "",
      normalizeText(item?.summary) ? `简介：${clipText(item.summary)}` : "",
      normalizeText(item?.intro) ? `简介：${clipText(item.intro)}` : "",
      normalizeText(item?.visualStyle) ? `视觉风格：${clipText(item.visualStyle)}` : "",
      `封面是否显示标题：${coverState.shouldShowTitle ? "是" : "否"}`,
      "要求：补强主体、人物/场景、构图、色彩、光影、材质、留白区域和避免项；不要解释，只输出提示词。"
    ]
      .filter(Boolean)
      .join("\n");
  }

  return {
    activeCoverItem,
    activeCoverMeta,
    applyApplicationCoverUrlInput,
    buildApplicationCoverPromptAiContext,
    clearApplicationCoverImage,
    closeApplicationCoverDialog,
    confirmApplicationCoverDialog,
    downloadApplicationCoverImage,
    fieldAiActions,
    generateApplicationCoverImage,
    openApplicationCoverDialog,
    selectApplicationCoverLocalImage,
    setApplicationCoverDialogMode,
    setApplicationCoverPromptInput,
    setApplicationCoverShouldShowTitle,
    setApplicationCoverUrlInput
  };
}
