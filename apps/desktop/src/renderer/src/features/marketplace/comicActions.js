import { computed } from "vue";

import { WRITING_AUTOSAVE_DELAY } from "../writing/writingConfig.js";
import {
  COMIC_APP_TABS,
  COMIC_ASSET_FILTER_OPTIONS,
  COMIC_ASSET_TYPE_META,
  COMIC_ASSET_VIEW_KIND_META,
  COMIC_CHAPTER_STATUS_META,
  COMIC_STORYBOARD_KIND_META,
  COMIC_PROJECT_COVER_TONES,
  COMIC_PROJECT_FORMAT_META,
  COMIC_PROJECT_PALETTE_META
} from "./marketplaceConfig.js";
import { BUILTIN_GORDON_TOOLS_MCP_ID } from "../../lib/presenter.js";

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getImageArtifactSource(artifact) {
  return (
    normalizeText(artifact?.src) ||
    normalizeText(artifact?.url) ||
    normalizeText(artifact?.dataUrl) ||
    normalizeText(artifact?.base64) ||
    normalizeText(artifact?.imageUrl)
  );
}

function extractFirstImageArtifact(toolResult) {
  const artifacts = Array.isArray(toolResult?.structuredContent?.artifacts) ? toolResult.structuredContent.artifacts : [];

  for (const artifact of artifacts) {
    if (normalizeText(artifact?.kind) !== "image") {
      continue;
    }

    const src = getImageArtifactSource(artifact);

    if (src) {
      return {
        src,
        prompt: normalizeText(artifact?.prompt),
        provider: normalizeText(artifact?.provider),
        model: normalizeText(artifact?.model)
      };
    }
  }

  return null;
}

const EMPTY_TITLE_RESTORE_DELAY = 10000;

export function createComicActions({
  activeFeature,
  comicChapterDropdownMenuRef,
  createLocalId,
  desktopApi,
  featureMarketplaceId,
  nextTick,
  setStatus,
  showConfirmDialog,
  ui,
  workbench
}) {
  let comicAutosaveTimer = null;
  let comicSaveInFlight = false;
  let comicQueuedSaveProjectId = null;
  const comicProjectSaveVersions = new Map();
  const comicTitleBaselines = new Map();
  const comicTitleRestoreTimers = new Map();

  const comicProjects = computed(() => ui.marketplace.comic.projects ?? []);
  const activeComicProject = computed(
    () => comicProjects.value.find((project) => project.id === ui.marketplace.comic.activeProjectId) ?? comicProjects.value[0] ?? null
  );
  const activeComicAssets = computed(() => getComicAssets(activeComicProject.value));
  const filteredComicAssets = computed(() => {
    const filter = normalizeComicAssetFilterForUi(ui.marketplace.comic.assetTypeFilter);

    if (filter === "all") {
      return activeComicAssets.value;
    }

    return activeComicAssets.value.filter((asset) => normalizeComicAssetTypeForUi(asset.type) === filter);
  });
  const activeComicAsset = computed(
    () =>
      activeComicAssets.value.find((asset) => asset.id === ui.marketplace.comic.activeAssetId) ??
      activeComicAssets.value[0] ??
      null
  );
  const activeComicAssetMatchesTypeFilter = computed(() => {
    const asset = activeComicAsset.value;
    const filter = normalizeComicAssetFilterForUi(ui.marketplace.comic.assetTypeFilter);

    return Boolean(asset) && (filter === "all" || normalizeComicAssetTypeForUi(asset.type) === filter);
  });
  const activeComicAssetPreviewView = computed(() => {
    const views = Array.isArray(activeComicAsset.value?.views) ? activeComicAsset.value.views : [];
    return views.find((view) => view.id === ui.marketplace.comic.previewAssetViewId && normalizeText(view.src)) ?? null;
  });
  const activeComicTabMeta = computed(
    () => COMIC_APP_TABS.find((tab) => tab.id === ui.marketplace.comic.activeTab) ?? COMIC_APP_TABS[0]
  );
  const activeComicChapters = computed(() => getComicChapters(activeComicProject.value));
  const activeComicChapter = computed(
    () =>
      activeComicChapters.value.find((chapter) => chapter.id === ui.marketplace.comic.activeChapterId) ??
      activeComicChapters.value[0] ??
      null
  );
  const activeComicChapterIndex = computed(() =>
    Math.max(
      0,
      activeComicChapters.value.findIndex((chapter) => chapter.id === activeComicChapter.value?.id)
    )
  );
  const activeComicChapterAssets = computed(() => getComicChapterReferencedAssets(activeComicChapter.value));
  const activeComicChapterImages = computed(() => getComicChapterImages(activeComicChapter.value));
  const activeComicStoryboards = computed(() => getComicStoryboards(activeComicChapter.value));
  const activeComicStoryboard = computed(() => getActiveComicStoryboard(activeComicStoryboards.value));
  const activeComicStoryboardIndex = computed(() =>
    activeComicStoryboards.value.findIndex((storyboard) => storyboard.id === activeComicStoryboard.value?.id)
  );
  const activeComicStoryboardImages = computed(() =>
    getComicStoryboardImages(activeComicChapter.value, activeComicStoryboard.value)
  );
  const activeComicChapterImage = computed(() =>
    activeComicStoryboard.value
      ? getActiveComicChapterImage(activeComicStoryboardImages.value)
      : getActiveComicChapterImage(activeComicChapterImages.value)
  );
  const activeComicChapterImageIndex = computed(() =>
    (activeComicStoryboard.value ? activeComicStoryboardImages.value : activeComicChapterImages.value).findIndex(
      (image) => image.id === activeComicChapterImage.value?.id
    )
  );
  const activeComicChapterImageCountLabel = computed(() => getComicChapterImageCountLabel(activeComicChapterImages.value));
  const activeComicExportFileName = computed(() => getComicExportFileName(activeComicProject.value));
  const filteredComicChapterEntries = computed(() =>
    getFilteredComicChapterEntries(activeComicChapters.value, ui.marketplace.comic.chapterSearchQuery)
  );
  const canExportActiveComicProject = computed(
    () =>
      Boolean(
        activeComicProject.value &&
          String(ui.marketplace.comic.exportDirectory ?? "").trim() &&
          !ui.marketplace.comic.isExporting
      )
  );

  function normalizeComicProjectFormatForUi(value) {
    const format = String(value ?? "").trim();
    return COMIC_PROJECT_FORMAT_META[format] ? format : "poster";
  }

  function normalizeComicProjectPaletteForUi(value) {
    const palette = String(value ?? "").trim();
    return COMIC_PROJECT_PALETTE_META[palette] ? palette : "color";
  }

  function normalizeComicProjectPageCount(value, fallback = 1) {
    const numeric = Number(value);
    return Math.min(999, Math.max(1, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
  }

  function normalizeComicChapterStatusForUi(value) {
    return COMIC_CHAPTER_STATUS_META[value] ? value : "todo";
  }

  function normalizeComicStoryboardKindForUi(value) {
    const kind = String(value ?? "").trim();
    return COMIC_STORYBOARD_KIND_META[kind] ? kind : "other";
  }

  function normalizeComicAssetTypeForUi(value) {
    const type = String(value ?? "").trim();
    return COMIC_ASSET_TYPE_META[type] ? type : "character";
  }

  function normalizeComicAssetFilterForUi(value) {
    const filter = String(value ?? "").trim();
    return COMIC_ASSET_FILTER_OPTIONS.some((option) => option.value === filter) ? filter : "all";
  }

  function normalizeComicAssetViewKindForUi(value) {
    const kind = String(value ?? "").trim();
    return COMIC_ASSET_VIEW_KIND_META[kind] ? kind : "angle";
  }

  function getComicAssetTypeLabel(type) {
    return COMIC_ASSET_TYPE_META[normalizeComicAssetTypeForUi(type)]?.label ?? "人物";
  }

  function getComicAssetViewKindLabel(kind) {
    return COMIC_ASSET_VIEW_KIND_META[normalizeComicAssetViewKindForUi(kind)]?.label ?? "视角";
  }

  function getComicStoryboardKindLabel(kind) {
    return COMIC_STORYBOARD_KIND_META[normalizeComicStoryboardKindForUi(kind)]?.label ?? "其他";
  }

  function normalizeComicAssetRefsForUi(refs = []) {
    return Array.from(
      new Set(
        (Array.isArray(refs) ? refs : [])
          .map((ref) => String(ref ?? "").trim())
          .filter(Boolean)
      )
    );
  }

  function cleanComicImageSource(value) {
    const raw = String(value ?? "").trim().replace(/^<|>$/g, "");
    const titleStart = raw.search(/\s+["']/);
    return (titleStart > 0 ? raw.slice(0, titleStart) : raw).trim();
  }

  function extractComicChapterImagesFromMarkdown(content) {
    const text = String(content ?? "");
    const imagePattern = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
    const images = [];
    let match = imagePattern.exec(text);

    while (match) {
      const src = cleanComicImageSource(match[2]);

      if (src) {
        images.push({
          alt: String(match[1] ?? "").trim(),
          src
        });
      }

      match = imagePattern.exec(text);
    }

    return images;
  }

  function stripComicChapterImageMarkdown(content) {
    const text = String(content ?? "");

    if (!text.includes("![") || !text.includes("](")) {
      return text;
    }

    return text
      .replace(/!\[[^\]]*\]\([^) \n]+(?:\s+["'][^"'\n]*["'])?\)/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeComicChapterImageForUi(image, index = 0) {
    const now = new Date().toISOString();

    return {
      id: String(image?.id ?? "").trim() || createLocalId("comic_chapter_image"),
      storyboardId: String(image?.storyboardId ?? "").trim() || "",
      alt: String(image?.alt ?? "").trim() || `画面 ${index + 1}`,
      src: cleanComicImageSource(image?.src),
      prompt: String(image?.prompt ?? ""),
      size: String(image?.size ?? ""),
      quality: String(image?.quality ?? ""),
      createdAt: String(image?.createdAt ?? "").trim() || now
    };
  }

  function normalizeComicChapterImagesForUi(images = [], legacyContent = "") {
    const usedSources = new Set();
    const candidates = [
      ...(Array.isArray(images) ? images : []),
      ...extractComicChapterImagesFromMarkdown(legacyContent)
    ];

    return candidates
      .map((image, index) => normalizeComicChapterImageForUi(image, index))
      .filter((image) => {
        if (!image.src || usedSources.has(image.src)) {
          return false;
        }

        usedSources.add(image.src);
        return true;
      });
  }

  function normalizeComicStoryboardShotForUi(storyboard, index = 0, chapterPrompt = "") {
    const now = new Date().toISOString();
    const safeIndex = Math.max(1, Math.round(Number(storyboard?.index ?? index + 1) || index + 1));

    return {
      id: String(storyboard?.id ?? "").trim() || createLocalId("comic_storyboard"),
      index: safeIndex,
      kind: normalizeComicStoryboardKindForUi(storyboard?.kind),
      title: String(storyboard?.title ?? "").trim() || `分镜 ${safeIndex}`,
      beat: String(storyboard?.beat ?? ""),
      dialogue: String(storyboard?.dialogue ?? ""),
      camera: String(storyboard?.camera ?? ""),
      prompt: String(storyboard?.prompt ?? "").trim() || chapterPrompt,
      status: normalizeComicChapterStatusForUi(storyboard?.status),
      imageIds: Array.from(
        new Set(
          (Array.isArray(storyboard?.imageIds) ? storyboard.imageIds : [])
            .map((imageId) => String(imageId ?? "").trim())
            .filter(Boolean)
        )
      ),
      updatedAt: String(storyboard?.updatedAt ?? "").trim() || now
    };
  }

  function normalizeComicStoryboardsForUi(storyboards = [], chapterPrompt = "", images = []) {
    const normalizedStoryboards = (Array.isArray(storyboards) ? storyboards : [])
      .map((storyboard, index) => normalizeComicStoryboardShotForUi(storyboard, index, chapterPrompt))
      .sort((left, right) => left.index - right.index)
      .map((storyboard, index) => ({
        ...storyboard,
        index: index + 1
      }));

    if (!normalizedStoryboards.length && (String(chapterPrompt ?? "").trim() || images.length)) {
      normalizedStoryboards.push(
        normalizeComicStoryboardShotForUi(
          {
            index: 1,
            kind: "scene",
            title: "分镜 1",
            prompt: chapterPrompt,
            imageIds: images.map((image) => image.id),
            status: images.length ? "inProgress" : "todo"
          },
          0,
          chapterPrompt
        )
      );
    }

    const storyboardIds = new Set(normalizedStoryboards.map((storyboard) => storyboard.id));

    return normalizedStoryboards.map((storyboard) => ({
      ...storyboard,
      imageIds: Array.from(
        new Set([
          ...storyboard.imageIds.filter((imageId) => images.some((image) => image.id === imageId)),
          ...images.filter((image) => image.storyboardId === storyboard.id && storyboardIds.has(storyboard.id)).map((image) => image.id)
        ])
      )
    }));
  }

  function getComicStoryboards(chapter) {
    return Array.isArray(chapter?.storyboards) ? chapter.storyboards : [];
  }

  function getComicStoryboardImages(chapter, storyboard) {
    const normalizedStoryboardId = String(storyboard?.id ?? "").trim();

    if (!normalizedStoryboardId) {
      return [];
    }

    const imageIds = new Set(
      (Array.isArray(storyboard?.imageIds) ? storyboard.imageIds : [])
        .map((imageId) => String(imageId ?? "").trim())
        .filter(Boolean)
    );

    return getComicChapterImages(chapter).filter(
      (image) => image.storyboardId === normalizedStoryboardId || imageIds.has(image.id)
    );
  }

  function getActiveComicStoryboard(storyboards = activeComicStoryboards.value) {
    const normalizedStoryboards = Array.isArray(storyboards) ? storyboards : [];
    const activeStoryboardId = String(ui.marketplace.comic.activeStoryboardId ?? "").trim();
    return normalizedStoryboards.find((storyboard) => storyboard.id === activeStoryboardId) ?? normalizedStoryboards[0] ?? null;
  }

  function syncActiveComicStoryboard(chapter = activeComicChapter.value) {
    const storyboards = getComicStoryboards(chapter);
    const activeStoryboardId = String(ui.marketplace.comic.activeStoryboardId ?? "").trim();

    if (storyboards.some((storyboard) => storyboard.id === activeStoryboardId)) {
      return activeStoryboardId;
    }

    const nextStoryboardId = storyboards[0]?.id ?? "";
    ui.marketplace.comic.activeStoryboardId = nextStoryboardId;
    return nextStoryboardId;
  }

  function syncActiveComicStoryboardImage(chapter = activeComicChapter.value, storyboardId = ui.marketplace.comic.activeStoryboardId) {
    const storyboard = getComicStoryboards(chapter).find((entry) => entry.id === storyboardId) ?? null;
    const storyboardImages = getComicStoryboardImages(chapter, storyboard);
    const activeImageId = String(ui.marketplace.comic.activeChapterImageId ?? "").trim();

    if (storyboardImages.some((image) => image.id === activeImageId)) {
      return activeImageId;
    }

    const nextImageId = storyboardImages[0]?.id ?? "";
    ui.marketplace.comic.activeChapterImageId = nextImageId;
    return nextImageId;
  }

  function getComicChapterImages(chapter) {
    return Array.isArray(chapter?.images) ? chapter.images.filter((image) => String(image?.src ?? "").trim()) : [];
  }

  function getActiveComicChapterImage(images = activeComicChapterImages.value) {
    const normalizedImages = Array.isArray(images) ? images : [];
    const activeImageId = String(ui.marketplace.comic.activeChapterImageId ?? "").trim();
    return normalizedImages.find((image) => image.id === activeImageId) ?? normalizedImages[0] ?? null;
  }

  function syncActiveComicChapterImage(chapter = activeComicChapter.value) {
    const images = getComicChapterImages(chapter);
    const activeImageId = String(ui.marketplace.comic.activeChapterImageId ?? "").trim();

    if (images.some((image) => image.id === activeImageId)) {
      return activeImageId;
    }

    const nextImageId = images[0]?.id ?? "";
    ui.marketplace.comic.activeChapterImageId = nextImageId;
    return nextImageId;
  }

  function getComicChapterImageCountLabel(imagesOrChapter) {
    const count = Array.isArray(imagesOrChapter) ? imagesOrChapter.length : getComicChapterImages(imagesOrChapter).length;
    return count ? `${count} 张图片` : "暂无图片";
  }

  function getComicAssetNameKey(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function ensureUniqueComicAssetName(name, usedNames, fallback) {
    const baseName = String(name ?? "").trim() || fallback;
    let candidate = baseName;
    let suffix = 2;

    while (usedNames.has(getComicAssetNameKey(candidate))) {
      candidate = `${baseName} ${suffix}`;
      suffix += 1;
    }

    usedNames.add(getComicAssetNameKey(candidate));
    return candidate;
  }

  function getDefaultComicAssetViews(type) {
    const normalizedType = normalizeComicAssetTypeForUi(type);
    const defaultViews = COMIC_ASSET_TYPE_META[normalizedType]?.defaultViews ?? COMIC_ASSET_TYPE_META.character.defaultViews;

    return defaultViews.map((view, index) =>
      normalizeComicAssetViewForUi(
        {
          kind: view.kind,
          label: view.label
        },
        index
      )
    );
  }

  function normalizeComicAssetViewForUi(view, index = 0) {
    const kind = normalizeComicAssetViewKindForUi(view?.kind);

    return {
      id: String(view?.id ?? "").trim() || createLocalId("comic_asset_view"),
      kind,
      label: String(view?.label ?? "").trim() || getComicAssetViewKindLabel(kind),
      src: String(view?.src ?? "").trim(),
      prompt: String(view?.prompt ?? "")
    };
  }

  function getComicAssetViewIdentityText(view) {
    return [view?.label, view?.prompt].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
  }

  function isComicAssetTurnaroundView(view) {
    const kind = normalizeComicAssetViewKindForUi(view?.kind);

    if (kind === "turnaround") {
      return true;
    }

    return /三视图|三視圖|turnaround|three[-\s]?view|3[-\s]?view/i.test(getComicAssetViewIdentityText(view));
  }

  function normalizeOptionalComicChapterIndexForUi(value) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  function normalizeComicSourceRefForUi(ref) {
    if (!ref || typeof ref !== "object") {
      return null;
    }

    const sourceType = ["web", "novel", "chapter", "file", "manual"].includes(String(ref.sourceType ?? "").trim())
      ? String(ref.sourceType).trim()
      : "manual";
    const sourceUrl = String(ref.sourceUrl ?? "").trim();
    const sourceTitle = String(ref.sourceTitle ?? "").trim();
    const chapterIndex = normalizeOptionalComicChapterIndexForUi(ref.chapterIndex);
    const chapterTitle = String(ref.chapterTitle ?? "").trim();
    const note = String(ref.note ?? "").trim();

    if (!sourceUrl && !sourceTitle && chapterIndex === undefined && !chapterTitle && !note) {
      return null;
    }

    return {
      sourceType,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sourceTitle ? { sourceTitle } : {}),
      ...(chapterIndex !== undefined ? { chapterIndex } : {}),
      ...(chapterTitle ? { chapterTitle } : {}),
      ...(note ? { note } : {})
    };
  }

  function getComicSourceRefsForUi(sourceRefs = []) {
    return (Array.isArray(sourceRefs) ? sourceRefs : [])
      .map((ref) => normalizeComicSourceRefForUi(ref))
      .filter(Boolean);
  }

  function getComicChapterSourceRefs(chapter) {
    return getComicSourceRefsForUi(chapter?.sourceRefs);
  }

  function getComicSourceRefTitle(ref, fallback = "来源") {
    const chapterTitle = String(ref?.chapterTitle ?? "").trim();
    const sourceTitle = String(ref?.sourceTitle ?? "").trim();
    const chapterIndex = normalizeOptionalComicChapterIndexForUi(ref?.chapterIndex);

    if (chapterTitle && chapterIndex !== undefined) {
      return `第 ${chapterIndex} 章 · ${chapterTitle}`;
    }

    if (chapterTitle) {
      return chapterTitle;
    }

    if (sourceTitle && chapterIndex !== undefined) {
      return `${sourceTitle} · 第 ${chapterIndex} 章`;
    }

    if (sourceTitle) {
      return sourceTitle;
    }

    return chapterIndex !== undefined ? `第 ${chapterIndex} 章` : fallback;
  }

  function getComicSourceRefMeta(ref) {
    const url = String(ref?.sourceUrl ?? "").trim();
    const note = String(ref?.note ?? "").trim();

    if (url) {
      try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./u, "");
      } catch {
        return url.replace(/^https?:\/\//u, "").split("/")[0] || "网页来源";
      }
    }

    return note || "手动来源";
  }

  function getComicSourceRefUrl(ref) {
    return String(ref?.sourceUrl ?? "").trim();
  }

  function getComicChapterSourceLabel(chapter) {
    const refs = getComicChapterSourceRefs(chapter);

    if (!refs.length) {
      return "未对照来源";
    }

    return getComicSourceRefTitle(refs[0], "来源对照");
  }

  function getComicChapterSourceCountLabel(chapter) {
    const refs = getComicChapterSourceRefs(chapter);

    return refs.length ? `${refs.length} 条来源` : "无来源";
  }

  function normalizeComicSourceRefsForUi(refs = []) {
    return (Array.isArray(refs) ? refs : []).map((ref) => normalizeComicSourceRefForUi(ref)).filter(Boolean);
  }

  function normalizeComicProjectSourceForUi(source) {
    if (!source || typeof source !== "object") {
      return undefined;
    }

    const sourceType = ["web", "novel", "file", "manual"].includes(String(source.sourceType ?? "").trim())
      ? String(source.sourceType).trim()
      : "manual";
    const sourceUrl = String(source.sourceUrl ?? "").trim();
    const sourceTitle = String(source.sourceTitle ?? "").trim();
    const importedAt = String(source.importedAt ?? "").trim();
    const importedBy = String(source.importedBy ?? "").trim();
    const chapterCount = normalizeOptionalComicChapterIndexForUi(source.chapterCount);
    const extractionStatus = ["planned", "partial", "complete", "blocked"].includes(String(source.extractionStatus ?? "").trim())
      ? String(source.extractionStatus).trim()
      : "";
    const notes = String(source.notes ?? "").trim();

    if (!sourceUrl && !sourceTitle && !importedAt && !importedBy && chapterCount === undefined && !extractionStatus && !notes) {
      return undefined;
    }

    return {
      sourceType,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sourceTitle ? { sourceTitle } : {}),
      ...(importedAt ? { importedAt } : {}),
      ...(importedBy ? { importedBy } : {}),
      ...(chapterCount !== undefined ? { chapterCount } : {}),
      ...(extractionStatus ? { extractionStatus } : {}),
      ...(notes ? { notes } : {})
    };
  }

  function normalizeComicAssetVariantForUi(variant, index = 0, fallbackViews = []) {
    if (!variant || typeof variant !== "object") {
      return null;
    }

    const now = new Date().toISOString();
    const views = Array.isArray(variant.views)
      ? variant.views.map((view, viewIndex) => normalizeComicAssetViewForUi(view, viewIndex))
      : [];
    const label = String(variant.label ?? "").trim();
    const description = String(variant.description ?? "");
    const prompt = String(variant.prompt ?? "");
    const chapterStartIndex = normalizeOptionalComicChapterIndexForUi(variant.chapterStartIndex);
    const chapterEndIndex = normalizeOptionalComicChapterIndexForUi(variant.chapterEndIndex);
    const sourceRefs = normalizeComicSourceRefsForUi(variant.sourceRefs);

    if (!label && !description && !prompt && chapterStartIndex === undefined && chapterEndIndex === undefined && !views.length && !sourceRefs.length) {
      return null;
    }

    return {
      id: String(variant.id ?? "").trim() || createLocalId("comic_asset_variant"),
      label: label || `版本 ${index + 1}`,
      ...(chapterStartIndex !== undefined ? { chapterStartIndex } : {}),
      ...(chapterEndIndex !== undefined ? { chapterEndIndex } : {}),
      ...(description ? { description } : {}),
      ...(prompt ? { prompt } : {}),
      views: views.length ? views : fallbackViews,
      ...(sourceRefs.length ? { sourceRefs } : {}),
      updatedAt: String(variant.updatedAt ?? "").trim() || now
    };
  }

  function normalizeComicAssetVariantsForUi(variants = [], fallbackViews = []) {
    return (Array.isArray(variants) ? variants : [])
      .map((variant, index) => normalizeComicAssetVariantForUi(variant, index, fallbackViews))
      .filter(Boolean);
  }

  function isLegacyEmptyComicTurnaroundViewSet(type, views) {
    if (type !== "character" && type !== "prop") {
      return false;
    }

    if (!Array.isArray(views) || views.length !== 3) {
      return false;
    }

    const kinds = views.map((view) => view.kind).sort().join(",");
    const isEmpty = views.every((view) => !String(view?.src ?? "").trim() && !String(view?.prompt ?? "").trim());
    return isEmpty && kinds === "back,front,side";
  }

  function normalizeComicAssetForUi(asset, index = 0, usedNames = new Set()) {
    const now = new Date().toISOString();
    const type = normalizeComicAssetTypeForUi(asset?.type);
    const typeMeta = COMIC_ASSET_TYPE_META[type] ?? COMIC_ASSET_TYPE_META.character;
    const createdAt = String(asset?.createdAt ?? "").trim() || now;
    const views = Array.isArray(asset?.views)
      ? asset.views.map((view, viewIndex) => normalizeComicAssetViewForUi(view, viewIndex))
      : [];
    const normalizedViews = views.length && !isLegacyEmptyComicTurnaroundViewSet(type, views) ? views : getDefaultComicAssetViews(type);
    const chapterStartIndex = normalizeOptionalComicChapterIndexForUi(asset?.chapterStartIndex);
    const chapterEndIndex = normalizeOptionalComicChapterIndexForUi(asset?.chapterEndIndex);
    const sourceRefs = normalizeComicSourceRefsForUi(asset?.sourceRefs);
    const variants = normalizeComicAssetVariantsForUi(asset?.variants, normalizedViews);

    return {
      id: String(asset?.id ?? "").trim() || createLocalId("comic_asset"),
      name: ensureUniqueComicAssetName(asset?.name, usedNames, `${typeMeta.defaultName} ${index + 1}`),
      type,
      description: String(asset?.description ?? ""),
      prompt: String(asset?.prompt ?? ""),
      variantLabel: String(asset?.variantLabel ?? "").trim() || undefined,
      ...(chapterStartIndex !== undefined ? { chapterStartIndex } : {}),
      ...(chapterEndIndex !== undefined ? { chapterEndIndex } : {}),
      ...(sourceRefs.length ? { sourceRefs } : {}),
      views: normalizedViews,
      ...(variants.length ? { variants } : {}),
      createdAt,
      updatedAt: String(asset?.updatedAt ?? "").trim() || createdAt
    };
  }

  function normalizeComicAssetsForUi(assets = []) {
    const usedNames = new Set();
    const usedIds = new Set();

    return (Array.isArray(assets) ? assets : []).map((asset, index) => {
      const normalizedAsset = normalizeComicAssetForUi(asset, index, usedNames);

      if (usedIds.has(normalizedAsset.id)) {
        normalizedAsset.id = createLocalId("comic_asset");
      }

      usedIds.add(normalizedAsset.id);
      return normalizedAsset;
    });
  }

  function normalizeComicChapterForUi(chapter, index = 0) {
    const now = new Date().toISOString();
    const content = String(chapter?.content ?? "");
    const chapterPrompt = String(chapter?.prompt ?? "");
    const images = normalizeComicChapterImagesForUi(chapter?.images, content).map((image) => ({
      ...image,
      prompt: image.prompt || chapterPrompt
    }));
    const storyboards = normalizeComicStoryboardsForUi(chapter?.storyboards, chapterPrompt, images);
    const storyboardIds = new Set(storyboards.map((storyboard) => storyboard.id));
    const normalizedImages = images.map((image) => ({
      ...image,
      storyboardId: image.storyboardId && storyboardIds.has(image.storyboardId) ? image.storyboardId : storyboards[0]?.id ?? ""
    }));

    return {
      id: String(chapter?.id ?? "").trim() || createLocalId("comic_chapter"),
      index: Math.max(1, Math.round(Number(chapter?.index ?? index + 1) || index + 1)),
      title: String(chapter?.title ?? "").trim() || `第 ${Math.max(1, Math.round(Number(chapter?.index ?? index + 1) || index + 1))} 章`,
      summary: String(chapter?.summary ?? ""),
      prompt: chapterPrompt,
      content: stripComicChapterImageMarkdown(content),
      sourceRefs: normalizeComicSourceRefsForUi(chapter?.sourceRefs),
      storyboards: storyboards.map((storyboard) => ({
        ...storyboard,
        imageIds: Array.from(
          new Set([
            ...storyboard.imageIds.filter((imageId) => normalizedImages.some((image) => image.id === imageId)),
            ...normalizedImages.filter((image) => image.storyboardId === storyboard.id).map((image) => image.id)
          ])
        )
      })),
      images: normalizedImages,
      status: normalizeComicChapterStatusForUi(chapter?.status),
      assetRefs: normalizeComicAssetRefsForUi(chapter?.assetRefs),
      updatedAt: String(chapter?.updatedAt ?? "").trim() || now
    };
  }

  function normalizeComicChaptersForUi(chapters = []) {
    const normalizedChapters = (Array.isArray(chapters) ? chapters : [])
      .map((chapter, index) => normalizeComicChapterForUi(chapter, index))
      .sort((left, right) => left.index - right.index);

    if (normalizedChapters.length) {
      return normalizedChapters;
    }

    return [
      normalizeComicChapterForUi(
        {
          index: 1,
          title: "第 1 章",
          summary: "写下这一章的场景目标、镜头顺序、角色动作和结尾画面。",
          prompt: "基于总介绍生成开场分镜，明确画面、动作、对白和页数。",
          content: "",
          storyboards: [],
          status: "inProgress"
        },
        0
      )
    ];
  }

  function normalizeComicProjectForUi(project, index = 0) {
    const now = new Date().toISOString();
    const format = normalizeComicProjectFormatForUi(project?.format);
    const palette = normalizeComicProjectPaletteForUi(project?.palette);
    const createdAt = String(project?.createdAt ?? "").trim() || now;
    const updatedAt = String(project?.updatedAt ?? "").trim() || createdAt;
    const assets = normalizeComicAssetsForUi(project?.assets);
    const assetIds = new Set(assets.map((asset) => asset.id));
    const chapters = normalizeComicChaptersForUi(project?.chapters).map((chapter) => ({
      ...chapter,
      assetRefs: chapter.assetRefs.filter((assetId) => assetIds.has(assetId))
    }));

    return {
      id: String(project?.id ?? "").trim() || createLocalId("comic_project"),
      title: String(project?.title ?? "").trim() || `未命名漫画 ${index + 1}`,
      format,
      palette,
      genre: String(project?.genre ?? "").trim() || "漫画 / 待定类型",
      status: String(project?.status ?? "").trim() || "新建",
      summary: String(project?.summary ?? ""),
      visualStyle: String(project?.visualStyle ?? ""),
      episodePlan: String(project?.episodePlan ?? ""),
      pageCount: normalizeComicProjectPageCount(project?.pageCount, COMIC_PROJECT_FORMAT_META[format]?.defaultPages ?? 1),
      coverUrl: String(project?.coverUrl ?? "").trim(),
      coverPrompt: String(project?.coverPrompt ?? ""),
      coverShouldShowTitle: project?.coverShouldShowTitle !== false,
      source: normalizeComicProjectSourceForUi(project?.source),
      assets,
      chapters,
      coverTone:
        String(project?.coverTone ?? "").trim() ||
        COMIC_PROJECT_COVER_TONES[index % COMIC_PROJECT_COVER_TONES.length] ||
        "ink",
      createdAt,
      updatedAt
    };
  }

  function normalizeComicProjectsForUi(projects = []) {
    return (Array.isArray(projects) ? projects : []).map((project, index) => normalizeComicProjectForUi(project, index));
  }

  function applyComicProjectsFromStorage(projects = [], options = {}) {
    const normalizedProjects = normalizeComicProjectsForUi(projects);
    const preferredProjectId = options.preferProjectId ?? ui.marketplace.comic.activeProjectId;
    const nextProject =
      normalizedProjects.find((project) => project.id === preferredProjectId) ?? normalizedProjects[0] ?? null;

    workbench.comicProjects = normalizedProjects;
    ui.marketplace.comic.projects = normalizedProjects;
    ui.marketplace.comic.activeProjectId = nextProject?.id ?? null;

    if (!nextProject && ui.marketplace.view === "comicDetail") {
      ui.marketplace.view = "comicShelf";
    }

    if (nextProject && !nextProject.chapters.some((chapter) => chapter.id === ui.marketplace.comic.activeChapterId)) {
      ui.marketplace.comic.activeChapterId = nextProject.chapters[0]?.id ?? "";
    }

    const activeChapter = nextProject?.chapters.find((chapter) => chapter.id === ui.marketplace.comic.activeChapterId) ?? null;
    const activeStoryboardId = syncActiveComicStoryboard(activeChapter);
    syncActiveComicStoryboardImage(activeChapter, activeStoryboardId);

    if (nextProject && !getComicAssets(nextProject).some((asset) => asset.id === ui.marketplace.comic.activeAssetId)) {
      ui.marketplace.comic.activeAssetId = getComicAssets(nextProject)[0]?.id ?? "";
    }
  }

  function buildComicProjectSavePayload(project) {
    const assets = normalizeComicAssetsForUi(project.assets);
    const assetIds = new Set(assets.map((asset) => asset.id));

    return {
      id: project.id,
      title: project.title,
      format: normalizeComicProjectFormatForUi(project.format),
      palette: normalizeComicProjectPaletteForUi(project.palette),
      genre: project.genre,
      status: project.status,
      summary: project.summary,
      visualStyle: project.visualStyle,
      episodePlan: project.episodePlan,
      pageCount: normalizeComicProjectPageCount(project.pageCount),
      coverUrl: String(project.coverUrl ?? "").trim(),
      coverPrompt: String(project.coverPrompt ?? ""),
      coverShouldShowTitle: project.coverShouldShowTitle !== false,
      source: normalizeComicProjectSourceForUi(project.source),
      assets,
      chapters: getComicChapters(project).map((chapter, index) => ({
        ...normalizeComicChapterForUi(chapter, index),
        assetRefs: normalizeComicAssetRefsForUi(chapter.assetRefs).filter((assetId) => assetIds.has(assetId)),
        updatedAt: chapter.updatedAt
      })),
      coverTone: project.coverTone,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
  }

  function scheduleComicProjectAutosave(projectId) {
    if (!desktopApi?.upsertComicProject || !projectId) {
      return;
    }

    clearComicAutosaveTimer();

    comicAutosaveTimer = setTimeout(() => {
      comicAutosaveTimer = null;
      void persistComicProjectById(projectId, { silent: true });
    }, WRITING_AUTOSAVE_DELAY);
  }

  function clearComicAutosaveTimer() {
    if (comicAutosaveTimer) {
      clearTimeout(comicAutosaveTimer);
      comicAutosaveTimer = null;
    }
  }

  function touchComicProject(project, options = {}) {
    if (!project) {
      return;
    }

    project.updatedAt = new Date().toISOString();
    markComicProjectDraftChange(project);

    if (options.persist !== false) {
      scheduleComicProjectAutosave(project.id);
    }
  }

  function markComicProjectDraftChange(project) {
    if (project?.id) {
      comicProjectSaveVersions.set(project.id, (comicProjectSaveVersions.get(project.id) ?? 0) + 1);
    }
  }

  function getComicProjectTitleRestoreKey(projectId) {
    return `project-title:${String(projectId ?? "").trim()}`;
  }

  function getComicAssetNameRestoreKey(projectId, assetId) {
    return `asset-name:${String(projectId ?? "").trim()}:${String(assetId ?? "").trim()}`;
  }

  function rememberComicTitleBaseline(key, value) {
    const baseline = String(value ?? "").trim();

    if (key && baseline) {
      comicTitleBaselines.set(key, baseline);
    }
  }

  function clearComicTitleRestoreTimer(key) {
    const timer = comicTitleRestoreTimers.get(key);

    if (timer) {
      clearTimeout(timer);
      comicTitleRestoreTimers.delete(key);
    }
  }

  function scheduleComicEmptyTitleRestore(key, fallbackValue, restore) {
    const fallback = comicTitleBaselines.get(key) ?? String(fallbackValue ?? "").trim();

    clearComicTitleRestoreTimer(key);

    if (!key || !fallback) {
      return;
    }

    const timer = setTimeout(() => {
      comicTitleRestoreTimers.delete(key);
      comicTitleBaselines.delete(key);
      restore(fallback);
    }, EMPTY_TITLE_RESTORE_DELAY);

    comicTitleRestoreTimers.set(key, timer);
  }

  async function persistComicProjectById(projectId, options = {}) {
    if (!desktopApi?.upsertComicProject || !projectId) {
      return;
    }

    if (comicSaveInFlight) {
      comicQueuedSaveProjectId = projectId;
      return;
    }

    const project = comicProjects.value.find((entry) => entry.id === projectId);

    if (!project) {
      return;
    }

    const saveVersion = comicProjectSaveVersions.get(projectId) ?? 0;
    comicSaveInFlight = true;

    try {
      const savedProjects = await desktopApi.upsertComicProject(buildComicProjectSavePayload(project));

      if ((comicProjectSaveVersions.get(projectId) ?? 0) === saveVersion) {
        applyComicProjectsFromStorage(savedProjects, { preferProjectId: projectId });
      }

      if (!options.silent) {
        setStatus("漫画项目已写入本地。", "success");
      }
    } catch (error) {
      console.error("Failed to save comic project", error);

      if (!options.silent) {
        setStatus(`漫画项目保存失败：${getErrorMessage(error)}`, "danger");
      }
    } finally {
      comicSaveInFlight = false;

      const queuedProjectId = comicQueuedSaveProjectId;
      comicQueuedSaveProjectId = null;

      if (queuedProjectId) {
        void persistComicProjectById(queuedProjectId, { silent: true });
      }
    }
  }

  function getComicProjectFormatLabel(format) {
    return COMIC_PROJECT_FORMAT_META[normalizeComicProjectFormatForUi(format)]?.label ?? "单图海报";
  }

  function getComicProjectPaletteLabel(palette) {
    return COMIC_PROJECT_PALETTE_META[normalizeComicProjectPaletteForUi(palette)]?.label ?? "彩绘";
  }

  function getComicChapters(project) {
    return Array.isArray(project?.chapters) ? project.chapters : [];
  }

  function getComicAssets(project) {
    return Array.isArray(project?.assets) ? project.assets : [];
  }

  function getComicAssetFilledViewCount(asset) {
    return (Array.isArray(asset?.views) ? asset.views : []).filter((view) => String(view?.src ?? "").trim()).length;
  }

  function getComicChapterReferencedAssets(chapter) {
    const refs = normalizeComicAssetRefsForUi(chapter?.assetRefs);
    const refSet = new Set(refs);

    return activeComicAssets.value.filter((asset) => refSet.has(asset.id));
  }

  function isComicChapterAssetReferenced(chapter, assetId) {
    return normalizeComicAssetRefsForUi(chapter?.assetRefs).includes(String(assetId ?? "").trim());
  }

  function getComicChapterDisplayTitle(chapter, index = 0) {
    const order = Number(chapter?.index ?? index + 1);
    const title = String(chapter?.title ?? "").trim();
    return title || `第 ${Number.isFinite(order) && order > 0 ? order : index + 1} 章`;
  }

  function getComicChapterStatusLabel(status) {
    return COMIC_CHAPTER_STATUS_META[status]?.label ?? COMIC_CHAPTER_STATUS_META.todo.label;
  }

  function getComicChapterStatusClass(status) {
    return COMIC_CHAPTER_STATUS_META[status]?.className ?? COMIC_CHAPTER_STATUS_META.todo.className;
  }

  function getFilteredComicChapterEntries(chapters, query) {
    const keyword = String(query ?? "").trim().toLowerCase();

    return (Array.isArray(chapters) ? chapters : [])
      .map((chapter, index) => ({
        chapter,
        index,
        title: getComicChapterDisplayTitle(chapter, index)
      }))
      .filter((entry) => {
        if (!keyword) {
          return true;
        }

        return [entry.title, entry.chapter?.summary, getComicChapterStatusLabel(entry.chapter?.status)]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(keyword));
      });
  }

  function trimComicExportTextBlock(value) {
    return String(value ?? "").replace(/^(?:[ \t]*\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
  }

  function sanitizeComicExportTitle(value) {
    return (
      String(value ?? "")
        .replace(/\.[^.]+$/, "")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/g, "")
        .trim() || "未命名漫画项目"
    );
  }

  function getComicExportFileName(project) {
    return `${sanitizeComicExportTitle(project?.title)}.md`;
  }

  function buildComicProjectExportContent(project) {
    const chapters = getComicChapters(project).slice().sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0));
    const assets = getComicAssets(project);
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const lines = [`# ${sanitizeComicExportTitle(project?.title)}`, ""];
    const summary = trimComicExportTextBlock(project?.summary ?? "");
    const visualStyle = trimComicExportTextBlock(project?.visualStyle ?? "");
    const episodePlan = trimComicExportTextBlock(project?.episodePlan ?? "");

    lines.push("## 项目信息", "");
    lines.push(`- 形态：${getComicProjectFormatLabel(project?.format)}`);
    lines.push(`- 画面：${getComicProjectPaletteLabel(project?.palette)}`);
    lines.push(`- 类型：${project?.genre || "漫画 / 待定类型"}`);
    lines.push(`- 页数：${normalizeComicProjectPageCount(project?.pageCount)} 页`);
    lines.push(`- 状态：${project?.status || "新建"}`, "");

    if (summary) {
      lines.push("## 总介绍", "", summary, "");
    }

    if (visualStyle) {
      lines.push("## 画风与镜头", "", visualStyle, "");
    }

    if (episodePlan) {
      lines.push(project?.format === "serial" ? "## 连载总规划" : "## 海报构图规划", "", episodePlan, "");
    }

    if (assets.length) {
      lines.push("## 素材库", "");

      assets.forEach((asset) => {
        const description = trimComicExportTextBlock(asset.description ?? "");
        const prompt = trimComicExportTextBlock(asset.prompt ?? "");
        const filledViews = (Array.isArray(asset.views) ? asset.views : []).filter((view) => String(view?.src ?? "").trim());

        lines.push(`### ${asset.name}`, "");
        lines.push(`- 类型：${getComicAssetTypeLabel(asset.type)}`);
        lines.push(`- ID：${asset.id}`);

        if (description) {
          lines.push(`- 描述：${description}`);
        }

        if (prompt) {
          lines.push(`- 提示词：${prompt}`);
        }

        if (filledViews.length) {
          filledViews.forEach((view) => {
            lines.push(`- ${view.label || getComicAssetViewKindLabel(view.kind)}：${view.src}`);
          });
        }

        lines.push("");
      });
    }

    lines.push("## 目录", "");

    if (chapters.length) {
      chapters.forEach((chapter, index) => {
        const title = getComicChapterDisplayTitle(chapter, index);
        const chapterSummary = trimComicExportTextBlock(chapter.summary ?? "") || "暂无章节内容简介";
        lines.push(`- ${title}（${getComicChapterStatusLabel(chapter.status)}）：${chapterSummary}`);
      });
    } else {
      lines.push("- 暂无章节");
    }

    lines.push("", "## 单章生成", "");

    chapters.forEach((chapter, index) => {
      const title = getComicChapterDisplayTitle(chapter, index);
      const chapterSummary = trimComicExportTextBlock(chapter.summary ?? "");
      const content = trimComicExportTextBlock(chapter.content ?? "");
      const chapterPrompt = trimComicExportTextBlock(chapter.prompt ?? "");
      const images = getComicChapterImages(chapter);
      const storyboards = getComicStoryboards(chapter);
      const referencedAssets = normalizeComicAssetRefsForUi(chapter.assetRefs)
        .map((assetId) => assetMap.get(assetId))
        .filter(Boolean);

      lines.push(`### ${title}`, "");

      if (chapterSummary) {
        lines.push("#### 章节内容简介", "", chapterSummary, "");
      }

      if (content) {
        lines.push("#### 章节正文", "", content, "");
      }

      if (chapterPrompt) {
        lines.push("#### 分镜与出图提示", "", chapterPrompt, "");
      }

      if (referencedAssets.length) {
        lines.push(
          "#### 引用素材",
          "",
          referencedAssets.map((asset) => `- ${getComicAssetTypeLabel(asset.type)}：${asset.name}（${asset.id}）`).join("\n"),
          ""
        );
      }

      if (storyboards.length) {
        lines.push("#### 分镜轨道", "");

        storyboards.forEach((storyboard, storyboardIndex) => {
          const beat = trimComicExportTextBlock(storyboard.beat ?? "");
          const dialogue = trimComicExportTextBlock(storyboard.dialogue ?? "");
          const camera = trimComicExportTextBlock(storyboard.camera ?? "");
          const prompt = trimComicExportTextBlock(storyboard.prompt ?? "");
          const storyboardImages = getComicStoryboardImages(chapter, storyboard);

          lines.push(`##### ${storyboardIndex + 1}. ${storyboard.title || `分镜 ${storyboardIndex + 1}`}`, "");
          lines.push(`- 类型：${getComicStoryboardKindLabel(storyboard.kind)}`);
          lines.push(`- 状态：${getComicChapterStatusLabel(storyboard.status)}`);

          if (beat) {
            lines.push("", "画面内容：", "", beat);
          }

          if (dialogue) {
            lines.push("", "对白 / 旁白：", "", dialogue);
          }

          if (camera) {
            lines.push("", "镜头 / 构图：", "", camera);
          }

          if (prompt) {
            lines.push("", "分镜生图提示词：", "", prompt);
          }

          if (storyboardImages.length) {
            lines.push("", "关联图片：", "");
            storyboardImages.forEach((image, imageIndex) => {
              lines.push(`![${image.alt || `分镜图片 ${imageIndex + 1}`}](${image.src})`, "");
            });
          }

          lines.push("");
        });
      }

      if (images.length) {
        lines.push("#### 全部生成图片", "");

        images.forEach((image, imageIndex) => {
          const imagePrompt = trimComicExportTextBlock(image.prompt ?? "");
          const params = [
            image.size ? `尺寸：${image.size}` : "",
            image.quality ? `质量：${image.quality}` : ""
          ].filter(Boolean);

          lines.push(`![${image.alt || `画面 ${imageIndex + 1}`}](${image.src})`, "");

          if (params.length) {
            lines.push(params.map((item) => `- ${item}`).join("\n"), "");
          }

          if (imagePrompt) {
            lines.push("生图提示词：", "", imagePrompt, "");
          }
        });
      }
    });

    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  function openComicAppShelf() {
    writeRef(activeFeature, featureMarketplaceId);
    ui.marketplace.view = "comicShelf";

    if (!ui.marketplace.comic.activeProjectId && comicProjects.value.length) {
      ui.marketplace.comic.activeProjectId = comicProjects.value[0].id;
    }
  }

  function backComicMarketplace() {
    ui.marketplace.view = "apps";
  }

  function openComicProject(projectId) {
    ui.marketplace.comic.activeProjectId = projectId;
    ui.marketplace.comic.activeTab = "intro";
    ui.marketplace.comic.introMode = "settings";
    const project = comicProjects.value.find((entry) => entry.id === projectId) ?? null;
    const chapter = getComicChapters(project)[0] ?? null;
    ui.marketplace.comic.activeChapterId = chapter?.id ?? "";
    const activeStoryboardId = syncActiveComicStoryboard(chapter);
    syncActiveComicStoryboardImage(chapter, activeStoryboardId);
    ui.marketplace.comic.activeAssetId = getComicAssets(project)[0]?.id ?? "";
    ui.marketplace.view = "comicDetail";
  }

  function backComicShelf() {
    ui.marketplace.view = "comicShelf";
  }

  async function deleteComicProjectFromShelf(projectId) {
    if (!desktopApi?.deleteComicProject) {
      setStatus("漫画项目仓储未就绪，暂时无法删除。", "danger");
      return;
    }

    const project = comicProjects.value.find((entry) => entry.id === projectId) ?? null;
    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除漫画项目",
      message: `确认删除「${project?.title ?? "当前项目"}」吗？项目会移入系统回收站。`,
      detail: "删除后会从项目架移除，可在系统回收站中找回备份文件。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    clearComicAutosaveTimer();

    if (comicQueuedSaveProjectId === projectId) {
      comicQueuedSaveProjectId = null;
    }

    try {
      const savedProjects = await desktopApi.deleteComicProject(projectId);
      applyComicProjectsFromStorage(savedProjects, {
        preferProjectId: ui.marketplace.comic.activeProjectId === projectId ? "" : ui.marketplace.comic.activeProjectId
      });
      setStatus("漫画项目已移入系统回收站。", "success");
    } catch (error) {
      console.error("Failed to delete comic project", error);
      setStatus(`漫画项目删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function createComicProject() {
    const now = new Date().toISOString();
    const project = {
      id: createLocalId("comic_project"),
      title: `未命名漫画 ${comicProjects.value.length + 1}`,
      format: "poster",
      palette: "color",
      genre: "漫画 / 待定类型",
      status: "新建",
      summary: "写下漫画的主角、冲突、核心画面和要传达的情绪。",
      visualStyle: "彩绘分镜，角色轮廓清晰，画面层次明确。",
      episodePlan: "单图海报：主体、背景、人物站位、标题区域和最终比例。",
      pageCount: 1,
      coverTone: COMIC_PROJECT_COVER_TONES[comicProjects.value.length % COMIC_PROJECT_COVER_TONES.length],
      coverUrl: "",
      coverPrompt: "",
      coverShouldShowTitle: true,
      assets: [],
      chapters: [
        {
          id: createLocalId("comic_chapter"),
          index: 1,
          title: "第 1 章",
          summary: "写下这一章的故事事件、角色目标、冲突变化和结尾钩子。",
          prompt: "基于章节正文拆分开场分镜，明确画面、动作、对白留白和页数。",
          content: "",
          storyboards: [],
          images: [],
          status: "inProgress",
          assetRefs: [],
          updatedAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    ui.marketplace.comic.projects = [project, ...comicProjects.value];
    workbench.comicProjects = ui.marketplace.comic.projects;
    ui.marketplace.comic.activeTab = "intro";
    ui.marketplace.comic.introMode = "settings";
    ui.marketplace.comic.activeChapterId = project.chapters[0]?.id ?? "";
    ui.marketplace.comic.activeStoryboardId = "";
    ui.marketplace.comic.activeAssetId = "";
    openComicProject(project.id);
    setStatus("已创建一个漫画项目，正在写入本地项目库。", "success");
    await persistComicProjectById(project.id, { silent: false });
  }

  function setComicProjectField(field, value) {
    const project = activeComicProject.value;

    if (!project) {
      return;
    }

    if (field === "format") {
      const previousFormat = normalizeComicProjectFormatForUi(project.format);
      const previousDefaultPages = COMIC_PROJECT_FORMAT_META[previousFormat]?.defaultPages ?? 1;
      project.format = normalizeComicProjectFormatForUi(value);
      const nextDefaultPages = COMIC_PROJECT_FORMAT_META[project.format]?.defaultPages ?? 1;

      if (!project.pageCount || project.pageCount === previousDefaultPages) {
        project.pageCount = nextDefaultPages;
      }
    } else if (field === "palette") {
      project.palette = normalizeComicProjectPaletteForUi(value);
    } else if (field === "pageCount") {
      project.pageCount = normalizeComicProjectPageCount(value, project.pageCount);
    } else if (field === "title") {
      project.title = String(value ?? "");
    } else {
      project[field] = String(value ?? "");
    }

    touchComicProject(project);
  }

  function setComicProjectTitle(value) {
    const project = activeComicProject.value;

    if (!project) {
      return;
    }

    const nextTitle = String(value ?? "");
    const previousTitle = String(project.title ?? "");
    const titleKey = getComicProjectTitleRestoreKey(project.id);

    if (!nextTitle.trim()) {
      project.title = nextTitle;
      clearComicAutosaveTimer();
      markComicProjectDraftChange(project);
      scheduleComicEmptyTitleRestore(titleKey, previousTitle, (fallback) => {
        const targetProject = comicProjects.value.find((entry) => entry.id === project.id);

        if (!targetProject || String(targetProject.title ?? "").trim()) {
          return;
        }

        targetProject.title = fallback;
        touchComicProject(targetProject);
      });
      return;
    }

    clearComicTitleRestoreTimer(titleKey);
    project.title = nextTitle;
    touchComicProject(project);
  }

  function rememberComicProjectTitleBaseline() {
    const project = activeComicProject.value;

    if (!project) {
      return;
    }

    rememberComicTitleBaseline(getComicProjectTitleRestoreKey(project.id), project.title);
  }

  function setComicProjectFormat(value) {
    setComicProjectField("format", value);
  }

  function setComicProjectPalette(value) {
    setComicProjectField("palette", value);
  }

  function setComicProjectGenre(value) {
    setComicProjectField("genre", value);
  }

  function setComicProjectSummary(value) {
    setComicProjectField("summary", value);
  }

  function setComicProjectVisualStyle(value) {
    setComicProjectField("visualStyle", value);
  }

  function setComicProjectEpisodePlan(value) {
    setComicProjectField("episodePlan", value);
  }

  function setComicProjectPageCount(value) {
    setComicProjectField("pageCount", value);
  }

  function setComicIntroMode(mode) {
    ui.marketplace.comic.activeTab = "intro";
    ui.marketplace.comic.introMode = mode === "assets" ? "assets" : "settings";
  }

  function toggleComicAssetRail() {
    ui.marketplace.comic.isAssetRailCollapsed = !ui.marketplace.comic.isAssetRailCollapsed;
  }

  function selectComicAsset(assetId) {
    ui.marketplace.comic.activeAssetId = String(assetId ?? "").trim();
    ui.marketplace.comic.previewAssetViewId = "";
    setComicIntroMode("assets");
  }

  function setComicAssetTypeFilter(filter) {
    const nextFilter = normalizeComicAssetFilterForUi(filter);
    ui.marketplace.comic.assetTypeFilter = nextFilter;

    if (nextFilter === "all") {
      if (!activeComicAsset.value && activeComicAssets.value[0]) {
        ui.marketplace.comic.activeAssetId = activeComicAssets.value[0].id;
      }
      return;
    }

    const activeAsset = activeComicAsset.value;
    const shouldKeepActiveAsset = activeAsset && normalizeComicAssetTypeForUi(activeAsset.type) === nextFilter;

    if (!shouldKeepActiveAsset) {
      ui.marketplace.comic.activeAssetId = activeComicAssets.value.find((asset) => normalizeComicAssetTypeForUi(asset.type) === nextFilter)?.id ?? "";
    }
  }

  function getUniqueComicAssetName(project, name, assetId = "") {
    const usedNames = new Set(
      getComicAssets(project)
        .filter((asset) => asset.id !== assetId)
        .map((asset) => getComicAssetNameKey(asset.name))
        .filter(Boolean)
    );
    const fallback = `${COMIC_ASSET_TYPE_META.character.defaultName} ${getComicAssets(project).length + 1}`;
    return ensureUniqueComicAssetName(name, usedNames, fallback);
  }

  function createComicAsset(type = "character") {
    const project = activeComicProject.value;

    if (!project) {
      return;
    }

    const requestedType = normalizeComicAssetFilterForUi(type);
    const normalizedType = requestedType === "all" ? "character" : normalizeComicAssetTypeForUi(requestedType);
    const typeMeta = COMIC_ASSET_TYPE_META[normalizedType] ?? COMIC_ASSET_TYPE_META.character;
    const now = new Date().toISOString();
    const asset = {
      id: createLocalId("comic_asset"),
      name: getUniqueComicAssetName(project, `${typeMeta.defaultName} ${getComicAssets(project).length + 1}`),
      type: normalizedType,
      description: typeMeta.defaultDescription,
      prompt: typeMeta.defaultPrompt,
      views: getDefaultComicAssetViews(normalizedType),
      createdAt: now,
      updatedAt: now
    };

    project.assets = [...getComicAssets(project), asset];
    ui.marketplace.comic.activeAssetId = asset.id;
    ui.marketplace.comic.assetTypeFilter = normalizedType;
    ui.marketplace.comic.isAssetRailCollapsed = false;
    setComicIntroMode("assets");
    touchComicProject(project);
  }

  async function deleteComicAsset(assetId) {
    const project = activeComicProject.value;
    const normalizedAssetId = String(assetId ?? "").trim();
    const asset = getComicAssets(project).find((entry) => entry.id === normalizedAssetId);

    if (!project || !asset) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除素材",
      message: `确认删除素材「${asset.name}」吗？`,
      detail: "删除后会从所有章节的引用里移除，但不会删除你粘贴过的外部图片源。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    project.assets = getComicAssets(project).filter((entry) => entry.id !== normalizedAssetId);
    project.chapters = getComicChapters(project).map((chapter) => ({
      ...chapter,
      assetRefs: normalizeComicAssetRefsForUi(chapter.assetRefs).filter((ref) => ref !== normalizedAssetId)
    }));
    ui.marketplace.comic.activeAssetId = project.assets[0]?.id ?? "";
    ui.marketplace.comic.previewAssetViewId = "";
    const nameKey = getComicAssetNameRestoreKey(project.id, normalizedAssetId);
    clearComicTitleRestoreTimer(nameKey);
    comicTitleBaselines.delete(nameKey);
    touchComicProject(project);
    setStatus("素材已删除，并已清理章节引用。", "success");
  }

  function touchComicAsset(asset) {
    const project = activeComicProject.value;

    if (!project || !asset) {
      return;
    }

    asset.updatedAt = new Date().toISOString();
    touchComicProject(project);
  }

  function setComicAssetName(assetId, value) {
    const project = activeComicProject.value;
    const asset = getComicAssets(project).find((entry) => entry.id === assetId);

    if (!project || !asset) {
      return;
    }

    const nextName = String(value ?? "");
    const previousName = String(asset.name ?? "");
    const nameKey = getComicAssetNameRestoreKey(project.id, asset.id);

    if (!nextName.trim()) {
      asset.name = nextName;
      clearComicAutosaveTimer();
      markComicProjectDraftChange(project);
      scheduleComicEmptyTitleRestore(nameKey, previousName, (fallback) => {
        const targetProject = comicProjects.value.find((entry) => entry.id === project.id);
        const targetAsset = getComicAssets(targetProject).find((entry) => entry.id === asset.id);

        if (!targetProject || !targetAsset || String(targetAsset.name ?? "").trim()) {
          return;
        }

        targetAsset.name = getUniqueComicAssetName(targetProject, fallback, targetAsset.id);
        targetAsset.updatedAt = new Date().toISOString();
        touchComicProject(targetProject);
      });
      return;
    }

    clearComicTitleRestoreTimer(nameKey);
    asset.name = getUniqueComicAssetName(project, nextName, asset.id);
    touchComicAsset(asset);
  }

  function rememberComicAssetNameBaseline(assetId) {
    const project = activeComicProject.value;
    const asset = getComicAssets(project).find((entry) => entry.id === assetId);

    if (!project || !asset) {
      return;
    }

    rememberComicTitleBaseline(getComicAssetNameRestoreKey(project.id, asset.id), asset.name);
  }

  function setComicAssetType(assetId, value) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.type = normalizeComicAssetTypeForUi(value);
    ui.marketplace.comic.assetTypeFilter = asset.type;

    if (!Array.isArray(asset.views) || !asset.views.length) {
      asset.views = getDefaultComicAssetViews(asset.type);
    }

    touchComicAsset(asset);
  }

  function setComicAssetDescription(assetId, value) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.description = String(value ?? "");
    touchComicAsset(asset);
  }

  function setComicAssetPrompt(assetId, value) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.prompt = String(value ?? "");
    touchComicAsset(asset);
  }

  function addComicAssetView(assetId) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    const views = Array.isArray(asset.views) ? asset.views : [];
    const kind = asset.type === "scene" ? "angle" : "detail";
    const view = normalizeComicAssetViewForUi(
      {
        kind,
        label: `${getComicAssetViewKindLabel(kind)} ${views.length + 1}`
      },
      views.length
    );

    asset.views = [...views, view];
    touchComicAsset(asset);
  }

  function removeComicAssetView(assetId, viewId) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.views = (Array.isArray(asset.views) ? asset.views : []).filter((view) => view.id !== viewId);
    if (ui.marketplace.comic.previewAssetViewId === viewId) {
      ui.marketplace.comic.previewAssetViewId = "";
    }
    touchComicAsset(asset);
  }

  function setComicAssetViewField(assetId, viewId, field, value) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);
    const view = (Array.isArray(asset?.views) ? asset.views : []).find((entry) => entry.id === viewId);

    if (!asset || !view) {
      return;
    }

    if (field === "kind") {
      view.kind = normalizeComicAssetViewKindForUi(value);
      if (!String(view.label ?? "").trim()) {
        view.label = getComicAssetViewKindLabel(view.kind);
      }
    } else if (field === "label") {
      view.label = String(value ?? "");
    } else if (field === "src") {
      view.src = String(value ?? "").trim();
      if (!normalizeText(view.src) && ui.marketplace.comic.previewAssetViewId === view.id) {
        ui.marketplace.comic.previewAssetViewId = "";
      }
    } else if (field === "prompt") {
      view.prompt = String(value ?? "");
    }

    touchComicAsset(asset);
  }

  function isGeneratedComicAssetPromptLine(line) {
    return (
      /^素材类型[:：]/.test(line) ||
      /^素材名称[:：]/.test(line) ||
      /^素材描述[:：]/.test(line) ||
      /^目标视图[:：]/.test(line) ||
      /^画幅规格[:：]/.test(line) ||
      line === "请生成一张可长期复用的漫画素材设定图。" ||
      line.startsWith("优先级：视图规格与完整度") ||
      line.startsWith("生成单张角色/物品设定参考图") ||
      line.startsWith("生成单张角色设定参考图") ||
      line.startsWith("生成单张物品设定参考图") ||
      line.startsWith("生成单张场景参考图") ||
      line.startsWith("生成角色三视图设定表") ||
      line.startsWith("生成物品三视图设定表") ||
      line.startsWith("生成特殊形态角色三视图设定表") ||
      line.startsWith("生成多人角色阵列设定图") ||
      line.startsWith("生成角色关系设定图") ||
      line.startsWith("不要加入无关文字说明") ||
      line.startsWith("不要做成多图拼贴") ||
      line.startsWith("画面只保留一个明确素材主体") ||
      line.startsWith("语言要求：") ||
      line.startsWith("原著优先：") ||
      line.startsWith("当前视图优先：") ||
      line.startsWith("特殊形态约束：") ||
      line.startsWith("多人/群像素材约束：") ||
      line.startsWith("关系型素材约束：")
    );
  }

  function normalizeComicPromptLines(...values) {
    const seen = new Set();
    const lines = [];

    values.forEach((value) => {
      String(value ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => normalizeText(line))
        .filter(Boolean)
        .filter((line) => !isGeneratedComicAssetPromptLine(line))
        .forEach((line) => {
          const key = line.replace(/[，。；;:：、\s]/g, "").toLowerCase();

          if (key && !seen.has(key)) {
            seen.add(key);
            lines.push(line);
          }
        });
    });

    return lines;
  }

  function normalizeComicAssetReferenceKey(value) {
    return String(value ?? "")
      .trim()
      .replace(/^@+/u, "")
      .replace(/\s+/g, "")
      .replace(/[「」《》【】[\]（）()]/g, "")
      .toLowerCase();
  }

  function extractComicAssetReferenceTokens(text) {
    const tokens = [];
    const seen = new Set();
    const pattern = /@([^\s@，,。；;：:\n\r]+)/gu;
    let match = pattern.exec(String(text ?? ""));

    while (match) {
      const token = normalizeText(match[1]);
      const key = normalizeComicAssetReferenceKey(token);

      if (token && key && !seen.has(key)) {
        seen.add(key);
        tokens.push(token);
      }

      match = pattern.exec(String(text ?? ""));
    }

    return tokens;
  }

  function getComicAssetReferenceOptions(assetId = "") {
    const options = [];

    activeComicAssets.value.forEach((asset) => {
      const views = Array.isArray(asset?.views) ? asset.views : [];

      views.forEach((view) => {
        const src = normalizeText(view?.src);

        if (!src) {
          return;
        }

        const assetName = normalizeText(asset?.name) || "未命名素材";
        const viewLabel = normalizeText(view?.label) || getComicAssetViewKindLabel(view?.kind);
        const label = `${assetName} / ${viewLabel}`;
        const insertText = `@${assetName}/${viewLabel}`.replace(/\s+/g, "");
        const aliases = [
          assetName,
          viewLabel,
          label,
          insertText,
          `${assetName}/${viewLabel}`,
          `${assetName}-${viewLabel}`,
          `${assetName}_${viewLabel}`
        ].map((value) => normalizeComicAssetReferenceKey(value));

        options.push({
          id: `${asset?.id || "asset"}:${view?.id || "view"}`,
          assetId: asset?.id ?? "",
          viewId: view?.id ?? "",
          assetName,
          viewLabel,
          label,
          insertText,
          src,
          kind: normalizeComicAssetViewKindForUi(view?.kind),
          type: normalizeComicAssetTypeForUi(asset?.type),
          isCurrentAsset: Boolean(assetId && asset?.id === assetId),
          aliases
        });
      });
    });

    return options;
  }

  function resolveComicAssetReferenceOptions(tokens = [], assetId = "") {
    if (!tokens.length) {
      return [];
    }

    const options = getComicAssetReferenceOptions(assetId);
    const resolved = [];
    const seen = new Set();

    tokens.forEach((token) => {
      const key = normalizeComicAssetReferenceKey(token);
      const option = options.find((entry) => entry.aliases.includes(key));

      if (option && !seen.has(option.id)) {
        seen.add(option.id);
        resolved.push(option);
      }
    });

    return resolved;
  }

  function getComicAssetViewReferenceOptions(assetId, view) {
    const tokens = extractComicAssetReferenceTokens(view?.prompt);
    return resolveComicAssetReferenceOptions(tokens, assetId);
  }

  function getComicAssetViewReferenceImages(assetId, view) {
    const seen = new Set();

    return getComicAssetViewReferenceOptions(assetId, view)
      .map((option) => option.src)
      .filter((src) => {
        if (!src || seen.has(src)) {
          return false;
        }

        seen.add(src);
        return true;
      });
  }

  function buildComicAssetPromptSearchText(asset, view) {
    const variantText = (Array.isArray(asset?.variants) ? asset.variants : [])
      .map((variant) => [variant?.label, variant?.description, variant?.prompt].filter(Boolean).join(" "))
      .join(" ");

    return [
      asset?.name,
      asset?.description,
      asset?.prompt,
      asset?.variantLabel,
      view?.label,
      view?.prompt,
      variantText
    ]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
  }

  function isComicSkeletonAsset(asset, view) {
    const text = buildComicAssetPromptSearchText(asset, view).toLowerCase();

    return /骷髅|骨骼|骨架|金刚骨|骨相|白骨|暗金骨|skeleton|skull|bones?|bone seams/.test(text);
  }

  function isComicGroupCharacterAsset(asset, view) {
    if (normalizeComicAssetTypeForUi(asset?.type) !== "character") {
      return false;
    }

    if (isComicAssetTurnaroundView(view)) {
      return false;
    }

    const identityText = [asset?.name, asset?.description, asset?.variantLabel]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const promptText = [asset?.prompt, view?.label, view?.prompt]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      /多人|群体|组合|队伍|导师团|老师群|群像|阵列|并排展示|五位|四位|三位|二位|二人|两位|两人|一家|搭档|同伴/.test(identityText) ||
      /character lineup|group reference|multiple characters|team lineup|five .*mentors|mentor lineup/.test(promptText)
    );
  }

  function isComicRelationshipCharacterAsset(asset, view) {
    if (normalizeComicAssetTypeForUi(asset?.type) !== "character") {
      return false;
    }

    if (isComicAssetTurnaroundView(view)) {
      return false;
    }

    const text = buildComicAssetPromptSearchText(asset, view).toLowerCase();

    return /关系图|关系设定|关系参考|坐骑|伙伴|伴随|同行|站在.+旁|与.+旁边|蓝龙|莎莉|standing beside|relationship reference|relationship concept|mount|blue dragon|dragon sally/.test(text);
  }

  function getComicAssetViewGenerationSize(asset, view) {
    const kind = normalizeComicAssetViewKindForUi(view?.kind);
    const type = normalizeComicAssetTypeForUi(asset?.type);

    if (isComicAssetTurnaroundView(view)) {
      return "1536x1024";
    }

    if (isComicGroupCharacterAsset(asset, view) || isComicRelationshipCharacterAsset(asset, view)) {
      return "1536x1024";
    }

    if (kind === "turnaround" || type === "scene") {
      return "1536x1024";
    }

    if (type === "character" && ["front", "side", "back", "angle"].includes(kind)) {
      return "1024x1536";
    }

    return "1024x1024";
  }

  function getComicAssetViewGenerationDirectives(asset, view) {
    const kind = normalizeComicAssetViewKindForUi(view?.kind);
    const type = normalizeComicAssetTypeForUi(asset?.type);
    const isSkeleton = type === "character" && isComicSkeletonAsset(asset, view);
    const isTurnaroundView = isComicAssetTurnaroundView(view);
    const isGroupCharacter = isComicGroupCharacterAsset(asset, view);
    const isRelationshipCharacter = isComicRelationshipCharacterAsset(asset, view);

    if (isGroupCharacter) {
      return [
        "生成多人角色阵列设定图：在同一张 16:9 横图中完整展示所有成员，而不是把一个人拆成正面、侧面、背面。",
        "每个成员都必须有清晰、不同的轮廓、体态、材质、颜色和身份识别点；成员之间不能互相遮挡关键部位。",
        "保持群像统一画风和光照，背景干净或极淡氛围，便于后续作为长期角色参考。",
        "禁止把多人素材误画成单个角色三视图；禁止随机增加成员、替换成员身份、裁切脚部、文字标签、UI 标注。"
      ];
    }

    if (isRelationshipCharacter) {
      return [
        "生成角色关系设定图：在同一张 16:9 横图中完整展示角色与坐骑/伙伴/关联对象的比例、站位和关系。",
        "角色与关联对象都要完整可见，重点表现体型差、材质差异、表情气质和可复用的漫画识别点。",
        "保持关系对象的身份稳定，例如蓝龙坐骑不能画成普通中型怪物或太古巨龙；角色服饰和装备不能随机漂移。",
        "禁止把关系型素材误画成单个角色三视图；禁止半身裁切、遮挡关键对象、文字标签、UI 标注。"
      ];
    }

    if (kind === "wide" && type === "character") {
      return [
        "生成角色状态参考设定图：在同一张 16:9 横图中完整展示该角色/生物当前阶段的整体轮廓、状态变化和关键细节。",
        "如果是同一角色的阶段版本，必须保留原有身份识别点、体型比例、材质和标志性结构，不要改成新角色。",
        "可补充局部细节参考，但主体必须完整可见，比例和场景尺度清楚。",
        "禁止把状态参考图误画成单人三视图；禁止随机改种族、随机加盔甲、文字标签、UI 标注。"
      ];
    }

    if (isTurnaroundView && type === "character" && isSkeleton) {
      return [
        "生成特殊形态角色三视图设定表：同一名角色的正面、侧面、背面三个完整全身立姿并排展示。",
        "主体必须是原著描述的骨骼本体，例如暗金色金刚骨骼、红色眼眶、骨缝微弱红光；不要把骨骼误画成穿盔甲的战士。",
        "三视图的头骨轮廓、胸腔骨架、脊柱、四肢骨相、手骨比例、暗金材质和红光位置必须一致。",
        "必须从头顶到脚底完整可见，重点展示骨架比例和骨节结构，不得裁切身体。",
        "禁止衣服、盔甲、披风、胸甲、肩甲、头盔、面具、外骨骼装饰、皮革、布料、鞋靴、武器和随机服饰。",
        "禁止半身图、胸像、头像特写、近景裁切、单人海报、剧情分镜、文字标签、UI 标注。"
      ];
    }

    if (isTurnaroundView && type === "character") {
      return [
        "生成角色三视图设定表：同一名角色的正面、侧面、背面三个完整全身立姿并排展示。",
        "必须从头顶到脚底完整可见，保留靴子/鞋底/衣摆/武器全长，不得裁切身体。",
        "三视图服饰、发型、体型、武器位置和标志性细节必须一致，背景保持干净或极淡氛围。",
        "禁止半身图、胸像、头像特写、近景裁切、单人海报、剧情分镜、文字标签、UI 标注。"
      ];
    }

    if (isTurnaroundView && type === "prop") {
      return [
        "生成物品三视图设定表：同一件物品的正面、侧面、背面三个完整视角并排展示。",
        "必须完整展示物品轮廓、比例、材质、磨损痕迹和关键结构，不得裁切。",
        "三视图颜色、纹样、材质和结构必须一致，背景保持干净。",
        "禁止单角度海报、局部特写、剧情场景、文字标签、UI 标注。"
      ];
    }

    if (isSkeleton) {
      return [
        "生成特殊形态角色设定参考图，完整全身站姿优先，从头顶到脚底完整可见，不要裁切。",
        "主体必须是原著描述的骨骼本体，例如暗金色金刚骨骼、红色眼眶、骨缝微弱红光；不要把骨骼误画成穿盔甲的战士。",
        "重点表现头骨轮廓、胸腔骨架、脊柱、四肢骨相、手骨比例、暗金材质和可反复复用的漫画识别点。",
        "禁止衣服、盔甲、披风、胸甲、肩甲、头盔、面具、外骨骼装饰、皮革、布料、鞋靴、武器和随机服饰。",
        "背景干净或只保留极淡氛围，不要喧宾夺主；禁止半身图、头像特写、文字标签。"
      ];
    }

    if (type === "character") {
      return [
        isSkeleton ? "生成特殊形态角色设定参考图，完整全身站姿优先，从头顶到脚底完整可见，不要裁切。" : "生成单张角色设定参考图，完整全身站姿优先，从头顶到脚底完整可见，不要裁切。",
        isSkeleton ? "主体必须是原著描述的骨骼本体，例如暗金色金刚骨骼、红色眼眶、骨缝微弱红光；不要把骨骼误画成穿盔甲的战士。" : "",
        isSkeleton ? "重点表现头骨轮廓、胸腔骨架、脊柱、四肢骨相、手骨比例、暗金材质和可反复复用的漫画识别点。" : "",
        isSkeleton ? "禁止衣服、盔甲、披风、胸甲、肩甲、头盔、面具、外骨骼装饰、皮革、布料、鞋靴、武器和随机服饰。" : "",
        isSkeleton ? "背景干净或只保留极淡氛围，不要喧宾夺主；禁止半身图、头像特写、文字标签。" : "",
        !isSkeleton ? "生成单张角色设定参考图，完整全身站姿优先，从头顶到脚底完整可见，不要裁切。" : "",
        !isSkeleton ? "重点表现角色五官、眼神、体态、服饰层次、随身武器和可反复复用的漫画识别点。" : "",
        !isSkeleton ? "背景干净或只保留极淡氛围，不要喧宾夺主。" : "",
        !isSkeleton ? "禁止半身图、头像特写、过度华丽服装、夸张玄幻武器、文字标签。" : ""
      ].filter(Boolean);
    }

    if (type === "scene") {
      return [
        "生成单张场景参考图，构图清晰，空间关系明确，可作为后续漫画分镜参考。",
        "突出场景的时代感、光线方向、地形/建筑结构和可复用的布景锚点。",
        "禁止人物抢占画面主体、文字标签、UI 标注。"
      ];
    }

    return [
      "生成单张物品设定参考图，主体完整清晰，结构准确，便于后续漫画分镜保持一致性。",
      "重点表现轮廓、材质、比例、纹样、磨损和使用方式，不得裁切主体。",
      "背景干净，禁止文字标签、UI 标注。"
    ];
  }

  function buildComicAssetViewGenerationPrompt(asset, view) {
    const typeLabel = getComicAssetTypeLabel(asset?.type);
    const viewLabel = normalizeText(view?.label) || getComicAssetViewKindLabel(view?.kind);
    const isTurnaroundView = isComicAssetTurnaroundView(view);
    const viewPrompt = normalizeText(view?.prompt);
    const promptLines = isTurnaroundView
      ? normalizeComicPromptLines(viewPrompt || asset?.description)
      : normalizeComicPromptLines(view?.prompt, asset?.description, asset?.prompt);
    const lines = [
      "请生成一张可长期复用的漫画素材设定图。",
      "语言要求：提示词、画面约束和可见文字意图全部使用中文理解；不要把中文小说素材转写成英文概念词后自由发挥。",
      "原著优先：素材外形以小说原文、用户描述和素材字段为最高优先级，不自动补充未出现的服装、盔甲、披风、武器或装饰。",
      isTurnaroundView ? "当前视图优先：本次只执行目标视图的三视图规格，不继承素材总提示词或其它视图里的全景图、关系图、群像图要求。" : "",
      "优先级：原著描述 > 视图规格与完整度 > 角色/物品识别点 > 形态/材质一致性 > 氛围与画风。",
      promptLines.length ? `创作简报：\n${promptLines.map((line) => `- ${line}`).join("\n")}` : "",
      `素材类型：${typeLabel}`,
      `素材名称：${normalizeText(asset?.name) || "未命名素材"}`,
      `目标视图：${viewLabel}`,
      `画幅规格：${getComicAssetViewGenerationSize(asset, view)}`,
      ...getComicAssetViewGenerationDirectives(asset, view)
    ].filter(Boolean);

    return lines.join("\n");
  }

  async function generateComicAssetViewImage(assetId, viewId) {
    const asset = getComicAssets(activeComicProject.value).find((entry) => entry.id === assetId);
    const view = (Array.isArray(asset?.views) ? asset.views : []).find((entry) => entry.id === viewId);

    if (!asset || !view) {
      return;
    }

    if (!desktopApi?.callMcpServerTool) {
      setStatus("Gordon Tools 桥接未就绪，暂时无法生成素材图。", "danger");
      return;
    }

    const prompt = buildComicAssetViewGenerationPrompt(asset, view);
    const referenceImages = getComicAssetViewReferenceImages(asset.id, view);

    if (!normalizeText(prompt)) {
      setStatus("请先填写视图提示词或素材描述。", "warning");
      return;
    }

    ui.marketplace.comic.generatingAssetViewId = view.id;
    setStatus(
      referenceImages.length
        ? `正在参考 ${referenceImages.length} 张素材图生成：${asset.name} / ${view.label || getComicAssetViewKindLabel(view.kind)}`
        : `正在生成素材视图：${asset.name} / ${view.label || getComicAssetViewKindLabel(view.kind)}`,
      "neutral"
    );

    try {
      const toolArguments = {
        prompt,
        size: getComicAssetViewGenerationSize(asset, view),
        n: 1,
        quality: "high"
      };

      if (referenceImages.length) {
        toolArguments.images = referenceImages;
      }

      const toolResult = await desktopApi.callMcpServerTool({
        serverId: BUILTIN_GORDON_TOOLS_MCP_ID,
        toolName: "image_gen",
        arguments: toolArguments
      });

      if (toolResult?.isError) {
        throw new Error(normalizeText(toolResult.contentText) || "image_gen 调用失败");
      }

      const image = extractFirstImageArtifact(toolResult);

      if (!image?.src) {
        setStatus("素材图生成完成，但工具没有返回可展示图片。", "warning");
        return;
      }

      view.src = image.src;
      view.prompt = normalizeText(view.prompt) || image.prompt || "";
      touchComicAsset(asset);
      setStatus(
        [
          referenceImages.length ? `已参考 ${referenceImages.length} 张素材图` : "",
          image.provider || image.model ? `素材图已生成并写入视图：${[image.provider, image.model].filter(Boolean).join(" / ")}` : "素材图已生成并写入当前视图。"
        ]
          .filter(Boolean)
          .join("；"),
        "success"
      );
    } catch (error) {
      console.error("Failed to generate comic asset view image", error);
      setStatus(`素材图生成失败：${getErrorMessage(error)}`, "danger");
    } finally {
      if (ui.marketplace.comic.generatingAssetViewId === view.id) {
        ui.marketplace.comic.generatingAssetViewId = "";
      }
    }
  }

  function previewComicAssetView(viewId) {
    const views = Array.isArray(activeComicAsset.value?.views) ? activeComicAsset.value.views : [];
    const view = views.find((entry) => entry.id === viewId);
    const asset = activeComicAsset.value;
    const project = activeComicProject.value;

    if (!normalizeText(view?.src)) {
      setStatus("当前视图还没有可放大的素材图。", "warning");
      return;
    }

    ui.marketplace.comic.previewAssetViewId = view.id;
    window.dispatchEvent(
      new CustomEvent("gordon:image-preview:open", {
        detail: {
          src: normalizeText(view.src),
          alt: view.label || getComicAssetViewKindLabel(view.kind),
          title: view.label || asset?.name || "素材图",
          downloadTitle: [project?.title, asset?.name, view.label || getComicAssetViewKindLabel(view.kind)].filter(Boolean).join("-")
        }
      })
    );
  }

  function closeComicAssetPreviewView() {
    ui.marketplace.comic.previewAssetViewId = "";
  }

  async function downloadComicAssetViewImage(assetId, viewId) {
    const project = activeComicProject.value;
    const asset = getComicAssets(project).find((entry) => entry.id === assetId);
    const view = (Array.isArray(asset?.views) ? asset.views : []).find((entry) => entry.id === viewId);
    const imageUrl = normalizeText(view?.src);
    const saveImage = desktopApi?.saveApplicationCoverImage ?? desktopApi?.saveWritingBookCoverImage;

    if (!asset || !view) {
      return;
    }

    if (!imageUrl) {
      setStatus("当前视图没有可下载的素材图。", "warning");
      return;
    }

    if (!saveImage) {
      setStatus("图片下载桥接未就绪。", "danger");
      return;
    }

    try {
      const result = await saveImage({
        title: [project?.title, asset.name, view.label || getComicAssetViewKindLabel(view.kind)].filter(Boolean).join("-"),
        imageUrl
      });

      if (result?.fileName) {
        setStatus(`素材图已下载：${result.fileName}`, "success");
      }
    } catch (error) {
      console.error("Failed to download comic asset view image", error);
      setStatus(`下载素材图失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function toggleComicChapterAssetRef(chapter, assetId) {
    const project = activeComicProject.value;
    const normalizedAssetId = String(assetId ?? "").trim();

    if (!project || !chapter || !getComicAssets(project).some((asset) => asset.id === normalizedAssetId)) {
      return;
    }

    const refs = normalizeComicAssetRefsForUi(chapter.assetRefs);
    const nextRefs = refs.includes(normalizedAssetId)
      ? refs.filter((ref) => ref !== normalizedAssetId)
      : [...refs, normalizedAssetId];

    chapter.assetRefs = nextRefs;
    touchComicChapter(chapter);
  }

  function toggleComicProfileRail() {
    ui.marketplace.comic.isProfileCollapsed = !ui.marketplace.comic.isProfileCollapsed;
  }

  function setComicTab(tabId) {
    ui.marketplace.comic.activeTab = COMIC_APP_TABS.some((tab) => tab.id === tabId) ? tabId : "intro";
  }

  function selectComicChapter(chapterId) {
    ui.marketplace.comic.activeChapterId = chapterId;
    const chapter = activeComicChapters.value.find((entry) => entry.id === chapterId) ?? null;
    const activeStoryboardId = syncActiveComicStoryboard(chapter);
    syncActiveComicStoryboardImage(chapter, activeStoryboardId);
  }

  function selectComicStoryboard(storyboardId) {
    const normalizedStoryboardId = String(storyboardId ?? "").trim();
    const storyboards = getComicStoryboards(activeComicChapter.value);

    if (!storyboards.some((storyboard) => storyboard.id === normalizedStoryboardId)) {
      const nextStoryboardId = syncActiveComicStoryboard(activeComicChapter.value);
      syncActiveComicStoryboardImage(activeComicChapter.value, nextStoryboardId);
      return;
    }

    ui.marketplace.comic.activeStoryboardId = normalizedStoryboardId;
    syncActiveComicStoryboardImage(activeComicChapter.value, normalizedStoryboardId);
  }

  function selectComicChapterImage(imageId) {
    const normalizedImageId = String(imageId ?? "").trim();
    const images = getComicChapterImages(activeComicChapter.value);
    const image = images.find((entry) => entry.id === normalizedImageId) ?? null;

    if (!image) {
      syncActiveComicStoryboardImage(activeComicChapter.value, ui.marketplace.comic.activeStoryboardId);
      return;
    }

    if (image.storyboardId && getComicStoryboards(activeComicChapter.value).some((storyboard) => storyboard.id === image.storyboardId)) {
      ui.marketplace.comic.activeStoryboardId = image.storyboardId;
    }

    ui.marketplace.comic.activeChapterImageId = normalizedImageId;
  }

  function setComicChapterPickerOpen(isOpen) {
    ui.marketplace.comic.isChapterPickerOpen = Boolean(isOpen);

    if (ui.marketplace.comic.isChapterPickerOpen) {
      void scrollComicChapterPickerToActive();
    }
  }

  function toggleComicChapterPicker() {
    setComicChapterPickerOpen(!ui.marketplace.comic.isChapterPickerOpen);
  }

  function toggleComicOutlineChapterContent() {
    ui.marketplace.comic.isOutlineChapterContentOpen = !ui.marketplace.comic.isOutlineChapterContentOpen;
  }

  function toggleComicOutlineChapterPrompt() {
    ui.marketplace.comic.isOutlineChapterPromptOpen = !ui.marketplace.comic.isOutlineChapterPromptOpen;
  }

  function toggleComicOutlineChapterSummary() {
    ui.marketplace.comic.isOutlineChapterSummaryOpen = !ui.marketplace.comic.isOutlineChapterSummaryOpen;
  }

  function toggleComicChapterStoryInput() {
    ui.marketplace.comic.isChapterStoryInputOpen = !ui.marketplace.comic.isChapterStoryInputOpen;
  }

  function selectComicChapterFromPicker(chapterId) {
    selectComicChapter(chapterId);
    ui.marketplace.comic.chapterSearchQuery = "";
    setComicChapterPickerOpen(false);
  }

  async function scrollComicChapterPickerToActive() {
    await nextTick();

    const menu = comicChapterDropdownMenuRef.value;
    const activeItem = menu?.querySelector?.(".writing-chapter-dropdown-item.is-active");

    if (!menu || !activeItem) {
      return;
    }

    const targetTop = activeItem.offsetTop - (menu.clientHeight - activeItem.clientHeight) / 2;
    menu.scrollTop = Math.max(0, targetTop);
  }

  function touchComicChapter(chapter) {
    const project = activeComicProject.value;

    if (!project || !chapter) {
      return;
    }

    chapter.updatedAt = new Date().toISOString();

    const hasImageWork = getComicChapterImages(chapter).some((image) => String(image?.prompt ?? "").trim() || String(image?.src ?? "").trim());
    const hasStoryboardWork = getComicStoryboards(chapter).some(
      (storyboard) =>
        String(storyboard?.beat ?? "").trim() ||
        String(storyboard?.dialogue ?? "").trim() ||
        String(storyboard?.camera ?? "").trim() ||
        String(storyboard?.prompt ?? "").trim() ||
        getComicStoryboardImages(chapter, storyboard).length
    );

    if (
      chapter.status === "todo" &&
      (String(chapter.summary ?? "").trim() ||
        String(chapter.prompt ?? "").trim() ||
        String(chapter.content ?? "").trim() ||
        hasStoryboardWork ||
        hasImageWork)
    ) {
      chapter.status = "inProgress";
    }

    touchComicProject(project);
  }

  function createComicChapter() {
    const project = activeComicProject.value;

    if (!project) {
      return;
    }

    const now = new Date().toISOString();
    const chapters = getComicChapters(project);
    const chapter = {
      id: createLocalId("comic_chapter"),
      index: chapters.length + 1,
      title: `第 ${chapters.length + 1} 章`,
      summary: "写下本章故事事件、角色目标、冲突变化和结尾钩子。",
      prompt: "基于章节正文拆分分镜，明确每张图/每格的画面、动作、景别和出图提示。",
      content: "",
      storyboards: [],
      images: [],
      status: "todo",
      assetRefs: [],
      updatedAt: now
    };

    project.chapters = [...chapters, chapter];
    ui.marketplace.comic.activeChapterId = chapter.id;
    ui.marketplace.comic.activeStoryboardId = "";
    ui.marketplace.comic.activeChapterImageId = "";
    ui.marketplace.comic.activeTab = "outline";
    touchComicProject(project);
  }

  function normalizeComicAiChapterDraft(chapter, index = 0, baseIndex = 0) {
    const safeIndex = normalizeComicProjectPageCount(chapter?.index, baseIndex + index + 1);

    return normalizeComicChapterForUi(
      {
        id: createLocalId("comic_chapter"),
        index: safeIndex,
        title: String(chapter?.title ?? "").trim() || `第 ${safeIndex} 章`,
        summary: String(chapter?.summary ?? chapter?.brief ?? chapter?.description ?? ""),
        prompt: String(chapter?.prompt ?? chapter?.imagePrompt ?? ""),
        content: String(chapter?.content ?? ""),
        storyboards: Array.isArray(chapter?.storyboards) ? chapter.storyboards : [],
        status: normalizeComicChapterStatusForUi(chapter?.status || "todo"),
        assetRefs: []
      },
      baseIndex + index
    );
  }

  function applyComicChaptersFromAi(chapterDrafts, mode = "replace") {
    const project = activeComicProject.value;
    const drafts = Array.isArray(chapterDrafts) ? chapterDrafts : [];

    if (!project || !drafts.length) {
      return false;
    }

    const currentChapters = getComicChapters(project);
    const isAppend = mode === "append";
    const baseIndex = isAppend
      ? currentChapters.reduce((maxIndex, chapter) => Math.max(maxIndex, Number(chapter.index ?? 0) || 0), 0)
      : 0;
    const nextChapters = drafts.map((chapter, index) => normalizeComicAiChapterDraft(chapter, index, baseIndex));

    project.chapters = isAppend ? [...currentChapters, ...nextChapters] : nextChapters;
    ui.marketplace.comic.activeChapterId = nextChapters[0]?.id ?? project.chapters[0]?.id ?? "";
    const activeChapter = project.chapters.find((chapter) => chapter.id === ui.marketplace.comic.activeChapterId) ?? null;
    const activeStoryboardId = syncActiveComicStoryboard(activeChapter);
    syncActiveComicStoryboardImage(activeChapter, activeStoryboardId);
    ui.marketplace.comic.activeTab = "outline";
    touchComicProject(project);

    return true;
  }

  function normalizeComicAiStoryboardDraft(storyboard, index = 0, baseIndex = 0, chapterPrompt = "") {
    return normalizeComicStoryboardShotForUi(
      {
        id: createLocalId("comic_storyboard"),
        index: baseIndex + index + 1,
        kind: storyboard?.kind,
        title: String(storyboard?.title ?? storyboard?.name ?? "").trim() || `分镜 ${baseIndex + index + 1}`,
        beat: String(storyboard?.beat ?? storyboard?.summary ?? storyboard?.description ?? storyboard?.content ?? ""),
        dialogue: String(storyboard?.dialogue ?? storyboard?.lines ?? storyboard?.caption ?? ""),
        camera: String(storyboard?.camera ?? storyboard?.shot ?? storyboard?.composition ?? ""),
        prompt: String(storyboard?.prompt ?? storyboard?.imagePrompt ?? ""),
        status: normalizeComicChapterStatusForUi(storyboard?.status || "todo"),
        imageIds: []
      },
      baseIndex + index,
      chapterPrompt
    );
  }

  function applyComicStoryboardsFromAi(storyboardDrafts, mode = "replace") {
    const chapter = activeComicChapter.value;
    const drafts = Array.isArray(storyboardDrafts) ? storyboardDrafts : [];

    if (!chapter || !drafts.length) {
      return false;
    }

    const currentStoryboards = getComicStoryboards(chapter);
    const isAppend = mode === "append";
    const baseIndex = isAppend
      ? currentStoryboards.reduce((maxIndex, storyboard) => Math.max(maxIndex, Number(storyboard.index ?? 0) || 0), 0)
      : 0;
    const nextStoryboards = drafts.map((storyboard, index) =>
      normalizeComicAiStoryboardDraft(storyboard, index, baseIndex, chapter.prompt)
    );

    if (isAppend) {
      chapter.storyboards = [...currentStoryboards, ...nextStoryboards].map((storyboard, index) => ({
        ...storyboard,
        index: index + 1
      }));
    } else {
      const nextStoryboardIdSet = new Set(nextStoryboards.map((storyboard) => storyboard.id));
      chapter.storyboards = nextStoryboards;
      chapter.images = getComicChapterImages(chapter).map((image) => ({
        ...image,
        storyboardId: image.storyboardId && nextStoryboardIdSet.has(image.storyboardId) ? image.storyboardId : ""
      }));
    }

    const activeStoryboardId = nextStoryboards[0]?.id ?? syncActiveComicStoryboard(chapter);
    ui.marketplace.comic.activeStoryboardId = activeStoryboardId;
    syncActiveComicStoryboardImage(chapter, activeStoryboardId);
    ui.marketplace.comic.activeTab = "chapter";
    touchComicChapter(chapter);
    return true;
  }

  function createComicStoryboard(kind = "scene") {
    const chapter = activeComicChapter.value;

    if (!chapter) {
      return null;
    }

    const storyboards = getComicStoryboards(chapter);
    const storyboard = normalizeComicStoryboardShotForUi(
      {
        index: storyboards.length + 1,
        kind,
        title: `分镜 ${storyboards.length + 1}`,
        beat: "",
        dialogue: "",
        camera: "",
        prompt: chapter.prompt,
        status: "todo",
        imageIds: []
      },
      storyboards.length,
      chapter.prompt
    );

    chapter.storyboards = [...storyboards, storyboard];
    ui.marketplace.comic.activeStoryboardId = storyboard.id;
    ui.marketplace.comic.activeChapterImageId = "";
    touchComicChapter(chapter);
    return storyboard;
  }

  async function deleteComicStoryboard(storyboardId) {
    const chapter = activeComicChapter.value;
    const normalizedStoryboardId = String(storyboardId ?? "").trim();
    const storyboard = getComicStoryboards(chapter).find((entry) => entry.id === normalizedStoryboardId);

    if (!chapter || !storyboard) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除分镜",
      message: `确认删除「${storyboard.title || "当前分镜"}」吗？`,
      detail: "分镜会从轨道移除，已生成图片保留在章节中但解除分镜关联。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    chapter.storyboards = getComicStoryboards(chapter)
      .filter((entry) => entry.id !== normalizedStoryboardId)
      .map((entry, index) => ({
        ...entry,
        index: index + 1
      }));
    chapter.images = getComicChapterImages(chapter).map((image) => ({
      ...image,
      storyboardId: image.storyboardId === normalizedStoryboardId ? "" : image.storyboardId
    }));
    const activeStoryboardId = syncActiveComicStoryboard(chapter);
    syncActiveComicStoryboardImage(chapter, activeStoryboardId);
    touchComicChapter(chapter);
    setStatus("分镜已删除，图片已保留在章节中。", "success");
  }

  function setComicStoryboardField(storyboard, field, value) {
    const chapter = activeComicChapter.value;
    const target = getComicStoryboards(chapter).find((entry) => entry.id === storyboard?.id);

    if (!chapter || !target) {
      return;
    }

    if (field === "kind") {
      target.kind = normalizeComicStoryboardKindForUi(value);
    } else if (field === "title") {
      target.title = String(value ?? "");
    } else if (field === "beat") {
      target.beat = String(value ?? "");
    } else if (field === "dialogue") {
      target.dialogue = String(value ?? "");
    } else if (field === "camera") {
      target.camera = String(value ?? "");
    } else if (field === "prompt") {
      target.prompt = String(value ?? "");
    } else if (field === "status") {
      target.status = normalizeComicChapterStatusForUi(value);
    }

    target.updatedAt = new Date().toISOString();
    touchComicChapter(chapter);
  }

  function setComicChapterTitle(chapter, value) {
    if (!chapter) {
      return;
    }

    chapter.title = String(value ?? "");
    touchComicChapter(chapter);
  }

  function setComicChapterSummary(chapter, value) {
    if (!chapter) {
      return;
    }

    chapter.summary = String(value ?? "");
    touchComicChapter(chapter);
  }

  function setComicChapterPrompt(chapter, value) {
    if (!chapter) {
      return;
    }

    chapter.prompt = String(value ?? "");
    touchComicChapter(chapter);
  }

  function setComicChapterContent(chapter, value) {
    if (!chapter) {
      return;
    }

    const content = String(value ?? "");

    if (content.includes("![") && content.includes("](")) {
      chapter.images = normalizeComicChapterImagesForUi(chapter.images, content);
      chapter.content = stripComicChapterImageMarkdown(content);
    } else {
      chapter.content = content;
    }

    touchComicChapter(chapter);
  }

  function getComicImageWriteStoryboardId(chapter, options = {}) {
    const optionStoryboardId = String(options.storyboardId ?? "").trim();
    const storyboards = getComicStoryboards(chapter);

    if (optionStoryboardId && storyboards.some((storyboard) => storyboard.id === optionStoryboardId)) {
      return optionStoryboardId;
    }

    const activeStoryboardId = String(ui.marketplace.comic.activeStoryboardId ?? "").trim();

    if (activeStoryboardId && storyboards.some((storyboard) => storyboard.id === activeStoryboardId)) {
      return activeStoryboardId;
    }

    return "";
  }

  function syncComicStoryboardImageIds(chapter) {
    if (!chapter) {
      return;
    }

    const images = getComicChapterImages(chapter);
    chapter.storyboards = getComicStoryboards(chapter).map((storyboard) => ({
      ...storyboard,
      imageIds: Array.from(
        new Set([
          ...(Array.isArray(storyboard.imageIds) ? storyboard.imageIds : []).filter((imageId) =>
            images.some((image) => image.id === imageId && image.storyboardId === storyboard.id)
          ),
          ...images.filter((image) => image.storyboardId === storyboard.id).map((image) => image.id)
        ])
      ),
      status:
        storyboard.status === "todo" && images.some((image) => image.storyboardId === storyboard.id)
          ? "inProgress"
          : storyboard.status
    }));
  }

  function setComicChapterImages(chapter, images, options = {}) {
    if (!chapter) {
      return;
    }

    const storyboardId = getComicImageWriteStoryboardId(chapter, options);
    const storyboards = getComicStoryboards(chapter);
    const storyboard = storyboards.find((entry) => entry.id === storyboardId) ?? null;
    const promptFallback = String(storyboard?.prompt || chapter.prompt || "");
    const nextImages = normalizeComicChapterImagesForUi(images).map((image) => ({
      ...image,
      storyboardId: storyboardId || image.storyboardId,
      prompt: image.prompt || promptFallback
    }));

    if (storyboardId) {
      const remainingImages = getComicChapterImages(chapter).filter((image) => image.storyboardId !== storyboardId);
      chapter.images = [...remainingImages, ...nextImages];
      ui.marketplace.comic.activeStoryboardId = storyboardId;
    } else {
      chapter.images = nextImages;
    }

    syncComicStoryboardImageIds(chapter);
    ui.marketplace.comic.activeChapterImageId = nextImages[0]?.id ?? getActiveComicChapterImage(chapter.images)?.id ?? "";
    touchComicChapter(chapter);
  }

  function appendComicChapterImages(chapter, images, options = {}) {
    if (!chapter) {
      return false;
    }

    const storyboardId = getComicImageWriteStoryboardId(chapter, options);
    const storyboard = getComicStoryboards(chapter).find((entry) => entry.id === storyboardId) ?? null;
    const currentImages = Array.isArray(chapter.images) ? chapter.images : [];
    const currentCount = currentImages.length;
    const incomingImages = (Array.isArray(images) ? images : []).map((image) => ({
      ...image,
      storyboardId: storyboardId || image?.storyboardId
    }));
    const nextImages = normalizeComicChapterImagesForUi([...currentImages, ...incomingImages]).map((image) => ({
      ...image,
      prompt: image.prompt || String(storyboard?.prompt || chapter.prompt || "")
    }));

    chapter.images = nextImages;
    syncComicStoryboardImageIds(chapter);
    if (storyboardId) {
      ui.marketplace.comic.activeStoryboardId = storyboardId;
    }
    ui.marketplace.comic.activeChapterImageId = nextImages[currentCount]?.id ?? getActiveComicChapterImage(nextImages)?.id ?? "";
    touchComicChapter(chapter);
    return true;
  }

  function setComicChapterImageField(chapter, imageId, field, value) {
    if (!chapter) {
      return;
    }

    const normalizedImageId = String(imageId ?? "").trim();
    const image = getComicChapterImages(chapter).find((entry) => entry.id === normalizedImageId);

    if (!image) {
      syncActiveComicChapterImage(chapter);
      return;
    }

    if (field === "alt") {
      image.alt = String(value ?? "");
    } else if (field === "prompt") {
      image.prompt = String(value ?? "");
    } else if (field === "size") {
      image.size = String(value ?? "").trim();
    } else if (field === "quality") {
      image.quality = String(value ?? "").trim();
    }

    touchComicChapter(chapter);
  }

  function setComicChapterImagePrompt(chapter, imageId, value) {
    setComicChapterImageField(chapter, imageId, "prompt", value);
  }

  function getComicChapterImageDownloadTitle(chapter, image) {
    const project = activeComicProject.value;
    const images = getComicChapterImages(chapter);
    const imageIndex = Math.max(0, images.findIndex((entry) => entry.id === image?.id));

    return [
      project?.title,
      chapter ? getComicChapterDisplayTitle(chapter, activeComicChapterIndex.value) : "",
      image?.alt || (imageIndex >= 0 ? `图片${imageIndex + 1}` : "章节图片")
    ]
      .filter(Boolean)
      .join("-");
  }

  function previewComicChapterImage(chapter, imageId) {
    const targetChapter = chapter ?? activeComicChapter.value;
    const image = getComicChapterImages(targetChapter).find((entry) => entry.id === String(imageId ?? "").trim());
    const imageUrl = normalizeText(image?.src);

    if (!imageUrl) {
      setStatus("当前章节图片不可放大。", "warning");
      return;
    }

    ui.marketplace.comic.activeChapterImageId = image.id;
    window.dispatchEvent(
      new CustomEvent("gordon:image-preview:open", {
        detail: {
          src: imageUrl,
          alt: image.alt || "章节图片",
          title: image.alt || "章节图片",
          downloadTitle: getComicChapterImageDownloadTitle(targetChapter, image)
        }
      })
    );
  }

  async function downloadComicChapterImage(chapter, imageId) {
    const targetChapter = chapter ?? activeComicChapter.value;
    const image = getComicChapterImages(targetChapter).find((entry) => entry.id === String(imageId ?? "").trim());
    const imageUrl = normalizeText(image?.src);
    const saveImage = desktopApi?.saveApplicationCoverImage ?? desktopApi?.saveWritingBookCoverImage;

    if (!imageUrl) {
      setStatus("当前章节图片不可下载。", "warning");
      return;
    }

    if (!saveImage) {
      setStatus("图片下载桥接未就绪。", "danger");
      return;
    }

    try {
      const result = await saveImage({
        title: getComicChapterImageDownloadTitle(targetChapter, image),
        imageUrl
      });

      if (result?.fileName) {
        setStatus(`章节图片已下载：${result.fileName}`, "success");
      }
    } catch (error) {
      console.error("Failed to download comic chapter image", error);
      setStatus(`下载章节图片失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function goComicChapter(chapterId) {
    selectComicChapter(chapterId);
    ui.marketplace.comic.chapterSearchQuery = "";
    setComicChapterPickerOpen(false);
    const activeStoryboardId = syncActiveComicStoryboard(activeComicChapter.value);
    syncActiveComicStoryboardImage(activeComicChapter.value, activeStoryboardId);
    setComicTab("chapter");
  }

  function submitComicChapter() {
    const chapter = activeComicChapter.value;

    if (!chapter) {
      return;
    }

    chapter.status = "done";
    touchComicChapter(chapter);
    setStatus("漫画章节已提交。", "success");
  }

  function setComicExportFeedback(text, tone = "neutral") {
    ui.marketplace.comic.exportFeedback = String(text ?? "").trim();
    ui.marketplace.comic.exportFeedbackTone = tone;
  }

  function openComicExportDialog() {
    if (!activeComicProject.value) {
      return;
    }

    ui.marketplace.comic.isExportDialogOpen = true;
    setComicExportFeedback("", "neutral");
  }

  function closeComicExportDialog() {
    if (ui.marketplace.comic.isExporting) {
      return;
    }

    ui.marketplace.comic.isExportDialogOpen = false;
    setComicExportFeedback("", "neutral");
  }

  async function selectComicExportDirectory() {
    if (!desktopApi?.selectComicProjectExportDirectory) {
      setComicExportFeedback("当前桌面桥接暂不支持选择输出目录。", "danger");
      return;
    }

    try {
      const directoryPath = await desktopApi.selectComicProjectExportDirectory();

      if (directoryPath) {
        ui.marketplace.comic.exportDirectory = directoryPath;
        setComicExportFeedback("", "neutral");
      }
    } catch (error) {
      console.error("Failed to select comic export directory", error);
      setComicExportFeedback(`选择目录失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function exportActiveComicProject() {
    const project = activeComicProject.value;

    if (!project || ui.marketplace.comic.isExporting) {
      return;
    }

    if (!String(ui.marketplace.comic.exportDirectory ?? "").trim()) {
      setComicExportFeedback("请先选择输出目录。", "warning");
      return;
    }

    if (!desktopApi?.exportComicProject) {
      setComicExportFeedback("当前桌面桥接暂不支持导出漫画项目。", "danger");
      return;
    }

    try {
      ui.marketplace.comic.isExporting = true;
      setComicExportFeedback("正在保存作品文件...", "neutral");

      const result = await desktopApi.exportComicProject({
        directoryPath: ui.marketplace.comic.exportDirectory,
        fileName: getComicExportFileName(project),
        format: "md",
        content: buildComicProjectExportContent(project)
      });

      ui.marketplace.comic.isExportDialogOpen = false;
      setComicExportFeedback("", "neutral");
      setStatus(`已导出漫画项目：${result.fileName ?? activeComicExportFileName.value}`, "success");
    } catch (error) {
      console.error("Failed to export comic project", error);
      setComicExportFeedback(`导出失败：${getErrorMessage(error)}`, "danger");
    } finally {
      ui.marketplace.comic.isExporting = false;
    }
  }

  return {
    activeComicAsset,
    activeComicAssetMatchesTypeFilter,
    activeComicAssets,
    activeComicChapter,
    activeComicChapterAssets,
    activeComicChapterImage,
    activeComicChapterImageCountLabel,
    activeComicChapterImageIndex,
    activeComicChapterImages,
    activeComicChapterIndex,
    activeComicChapters,
    activeComicExportFileName,
    activeComicProject,
    activeComicStoryboard,
    activeComicStoryboardImages,
    activeComicStoryboardIndex,
    activeComicStoryboards,
    activeComicTabMeta,
    applyComicProjectsFromStorage,
    applyComicStoryboardsFromAi,
    backComicMarketplace,
    backComicShelf,
    canExportActiveComicProject,
    clearComicAutosaveTimer,
    closeComicAssetPreviewView,
    closeComicExportDialog,
    comicProjects,
    addComicAssetView,
    createComicAsset,
    createComicChapter,
    createComicProject,
    createComicStoryboard,
    deleteComicAsset,
    downloadComicAssetViewImage,
    downloadComicChapterImage,
    deleteComicProjectFromShelf,
    deleteComicStoryboard,
    exportActiveComicProject,
    filteredComicAssets,
    filteredComicChapterEntries,
    appendComicChapterImages,
    getComicAssetFilledViewCount,
    getComicAssetTypeLabel,
    getComicAssetReferenceOptions,
    getComicAssetViewKindLabel,
    getComicAssetViewReferenceOptions,
    getComicChapterDisplayTitle,
    getComicChapterSourceCountLabel,
    getComicChapterSourceLabel,
    getComicChapterSourceRefs,
    getComicChapterReferencedAssets,
    getComicChapterStatusClass,
    getComicChapterStatusLabel,
    getComicChapterImageCountLabel,
    getComicChapterImages,
    getComicProjectFormatLabel,
    getComicProjectPaletteLabel,
    getComicStoryboardImages,
    getComicStoryboardKindLabel,
    getComicSourceRefMeta,
    getComicSourceRefTitle,
    getComicSourceRefUrl,
    generateComicAssetViewImage,
    activeComicAssetPreviewView,
    goComicChapter,
    isComicChapterAssetReferenced,
    openComicAppShelf,
    openComicExportDialog,
    openComicProject,
    previewComicAssetView,
    previewComicChapterImage,
    rememberComicAssetNameBaseline,
    rememberComicProjectTitleBaseline,
    removeComicAssetView,
    selectComicAsset,
    selectComicChapter,
    selectComicChapterImage,
    selectComicChapterFromPicker,
    selectComicStoryboard,
    selectComicExportDirectory,
    setComicAssetDescription,
    setComicAssetName,
    setComicAssetPrompt,
    setComicAssetTypeFilter,
    setComicAssetType,
    setComicAssetViewField,
    applyComicChaptersFromAi,
    setComicChapterContent,
    setComicChapterImageField,
    setComicChapterImagePrompt,
    setComicChapterImages,
    setComicChapterPickerOpen,
    setComicChapterPrompt,
    setComicChapterSummary,
    setComicChapterTitle,
    setComicStoryboardField,
    setComicProjectEpisodePlan,
    setComicProjectFormat,
    setComicProjectGenre,
    setComicProjectPageCount,
    setComicProjectPalette,
    setComicProjectSummary,
    setComicProjectTitle,
    setComicProjectVisualStyle,
    setComicIntroMode,
    setComicTab,
    submitComicChapter,
    persistComicProjectById,
    toggleComicAssetRail,
    toggleComicChapterAssetRef,
    toggleComicChapterStoryInput,
    toggleComicOutlineChapterContent,
    toggleComicOutlineChapterPrompt,
    toggleComicOutlineChapterSummary,
    toggleComicChapterPicker,
    toggleComicProfileRail,
    touchComicProject
  };
}
