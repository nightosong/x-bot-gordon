import { computed } from "vue";

import { BUILTIN_GORDON_TOOLS_MCP_ID } from "../../lib/presenter.js";
import { WRITING_AUTOSAVE_DELAY } from "../writing/writingConfig.js";
import {
  COMIC_ASSET_FILTER_OPTIONS,
  COMIC_ASSET_TYPE_META,
  COMIC_ASSET_VIEW_KIND_META,
  VIDEO_APP_NAME,
  VIDEO_APP_TABS,
  VIDEO_PROJECT_ASPECT_RATIO_META,
  VIDEO_PROJECT_COVER_TONES,
  VIDEO_PROJECT_MODE_META,
  VIDEO_SHOT_STATUS_META
} from "./marketplaceConfig.js";

const VIDEO_SYSTEM_PROMPT = `你是 Gordon 应用广场里的「流光绘影」，负责视频项目策划、镜头规划、视频生成提示词整理和生成结果记录。
你需要像分镜导演一样工作：先抓主体、动作、镜头运动、光线和时长，再输出可用于视频生成工具或人工复跑的提示词。
输出中文，内容要能直接回填到当前镜头生成结果区，不要声称已经生成真实视频。`;

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function normalizeVideoText(value) {
  return String(value ?? "").trim();
}

function getImageArtifactSource(artifact) {
  return (
    normalizeVideoText(artifact?.src) ||
    normalizeVideoText(artifact?.url) ||
    normalizeVideoText(artifact?.dataUrl) ||
    normalizeVideoText(artifact?.base64) ||
    normalizeVideoText(artifact?.imageUrl)
  );
}

function extractFirstImageArtifact(toolResult) {
  const artifacts = Array.isArray(toolResult?.structuredContent?.artifacts) ? toolResult.structuredContent.artifacts : [];

  for (const artifact of artifacts) {
    if (normalizeVideoText(artifact?.kind) !== "image") {
      continue;
    }

    const src = getImageArtifactSource(artifact);

    if (src) {
      return {
        src,
        prompt: normalizeVideoText(artifact?.prompt),
        provider: normalizeVideoText(artifact?.provider),
        model: normalizeVideoText(artifact?.model)
      };
    }
  }

  return null;
}

export function createVideoActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId,
  nextTick,
  setStatus,
  showConfirmDialog,
  ui,
  videoShotDropdownMenuRef,
  workbench
}) {
  let videoAutosaveTimer = null;
  let videoSaveInFlight = false;
  let videoQueuedSaveProjectId = null;

  const videoProjects = computed(() => ui.marketplace.video.projects ?? []);
  const activeVideoProject = computed(
    () => videoProjects.value.find((project) => project.id === ui.marketplace.video.activeProjectId) ?? videoProjects.value[0] ?? null
  );
  const activeVideoAssets = computed(() => getVideoAssets(activeVideoProject.value));
  const filteredVideoAssets = computed(() => {
    const filter = normalizeVideoAssetFilterForUi(ui.marketplace.video.assetTypeFilter);

    if (filter === "all") {
      return activeVideoAssets.value;
    }

    return activeVideoAssets.value.filter((asset) => normalizeVideoAssetTypeForUi(asset.type) === filter);
  });
  const activeVideoAsset = computed(
    () =>
      activeVideoAssets.value.find((asset) => asset.id === ui.marketplace.video.activeAssetId) ??
      activeVideoAssets.value[0] ??
      null
  );
  const activeVideoAssetMatchesTypeFilter = computed(() => {
    const asset = activeVideoAsset.value;
    const filter = normalizeVideoAssetFilterForUi(ui.marketplace.video.assetTypeFilter);

    return Boolean(asset) && (filter === "all" || normalizeVideoAssetTypeForUi(asset.type) === filter);
  });
  const activeVideoAssetPreviewView = computed(() => {
    const views = Array.isArray(activeVideoAsset.value?.views) ? activeVideoAsset.value.views : [];
    return views.find((view) => view.id === ui.marketplace.video.previewAssetViewId && normalizeVideoText(view.src)) ?? null;
  });
  const activeVideoTabMeta = computed(
    () => VIDEO_APP_TABS.find((tab) => tab.id === ui.marketplace.video.activeTab) ?? VIDEO_APP_TABS[0]
  );
  const activeVideoShots = computed(() => getVideoShots(activeVideoProject.value));
  const activeVideoShot = computed(
    () =>
      activeVideoShots.value.find((shot) => shot.id === ui.marketplace.video.activeShotId) ??
      activeVideoShots.value[0] ??
      null
  );
  const activeVideoShotIndex = computed(() =>
    Math.max(
      0,
      activeVideoShots.value.findIndex((shot) => shot.id === activeVideoShot.value?.id)
    )
  );
  const activeVideoExportFileName = computed(() => getVideoExportFileName(activeVideoProject.value));
  const filteredVideoShotEntries = computed(() =>
    getFilteredVideoShotEntries(activeVideoShots.value, ui.marketplace.video.shotSearchQuery)
  );
  const canExportActiveVideoProject = computed(
    () =>
      Boolean(
        activeVideoProject.value &&
          String(ui.marketplace.video.exportDirectory ?? "").trim() &&
          !ui.marketplace.video.isExporting
      )
  );

  function normalizeVideoProjectModeForUi(value) {
    const mode = String(value ?? "").trim();
    return VIDEO_PROJECT_MODE_META[mode] ? mode : "textToVideo";
  }

  function setVideoFeedback(text, tone = "neutral") {
    ui.marketplace.video.feedback = String(text ?? "").trim();
    ui.marketplace.video.feedbackTone = tone;
  }

  function getVideoFeedbackClass() {
    return ui.marketplace.video.feedbackTone ? `is-${ui.marketplace.video.feedbackTone}` : "";
  }

  function normalizeVideoProjectAspectRatioForUi(value) {
    const aspectRatio = String(value ?? "").trim();
    return VIDEO_PROJECT_ASPECT_RATIO_META[aspectRatio] ? aspectRatio : "16:9";
  }

  function normalizeVideoDurationSeconds(value, fallback = 5) {
    const numeric = Number(value);
    return Math.min(600, Math.max(1, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
  }

  function normalizeVideoShotStatusForUi(value) {
    return VIDEO_SHOT_STATUS_META[value] ? value : "todo";
  }

  function normalizeVideoAssetTypeForUi(value) {
    const type = String(value ?? "").trim();
    return COMIC_ASSET_TYPE_META[type] ? type : "character";
  }

  function normalizeVideoAssetFilterForUi(value) {
    const filter = String(value ?? "").trim();
    return COMIC_ASSET_FILTER_OPTIONS.some((option) => option.value === filter) ? filter : "all";
  }

  function normalizeVideoAssetViewKindForUi(value) {
    const kind = String(value ?? "").trim();
    return COMIC_ASSET_VIEW_KIND_META[kind] ? kind : "angle";
  }

  function getVideoAssetTypeLabel(type) {
    return COMIC_ASSET_TYPE_META[normalizeVideoAssetTypeForUi(type)]?.label ?? "人物";
  }

  function getVideoAssetViewKindLabel(kind) {
    return COMIC_ASSET_VIEW_KIND_META[normalizeVideoAssetViewKindForUi(kind)]?.label ?? "视角";
  }

  function getVideoAssetNameKey(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function ensureUniqueVideoAssetName(name, usedNames, fallback) {
    const baseName = String(name ?? "").trim() || fallback;
    let candidate = baseName;
    let suffix = 2;

    while (usedNames.has(getVideoAssetNameKey(candidate))) {
      candidate = `${baseName} ${suffix}`;
      suffix += 1;
    }

    usedNames.add(getVideoAssetNameKey(candidate));
    return candidate;
  }

  function getDefaultVideoAssetViews(type) {
    const normalizedType = normalizeVideoAssetTypeForUi(type);
    const defaultViews = COMIC_ASSET_TYPE_META[normalizedType]?.defaultViews ?? COMIC_ASSET_TYPE_META.character.defaultViews;

    return defaultViews.map((view, index) =>
      normalizeVideoAssetViewForUi(
        {
          kind: view.kind,
          label: view.label
        },
        index
      )
    );
  }

  function normalizeVideoAssetViewForUi(view, index = 0) {
    const kind = normalizeVideoAssetViewKindForUi(view?.kind);

    return {
      id: String(view?.id ?? "").trim() || createLocalId("video_asset_view"),
      kind,
      label: String(view?.label ?? "").trim() || getVideoAssetViewKindLabel(kind),
      src: String(view?.src ?? "").trim(),
      prompt: String(view?.prompt ?? "")
    };
  }

  function normalizeVideoAssetForUi(asset, index = 0, usedNames = new Set()) {
    const now = new Date().toISOString();
    const type = normalizeVideoAssetTypeForUi(asset?.type);
    const typeMeta = COMIC_ASSET_TYPE_META[type] ?? COMIC_ASSET_TYPE_META.character;
    const createdAt = String(asset?.createdAt ?? "").trim() || now;
    const views = Array.isArray(asset?.views)
      ? asset.views.map((view, viewIndex) => normalizeVideoAssetViewForUi(view, viewIndex))
      : [];

    return {
      id: String(asset?.id ?? "").trim() || createLocalId("video_asset"),
      name: ensureUniqueVideoAssetName(asset?.name, usedNames, `${typeMeta.defaultName} ${index + 1}`),
      type,
      description: String(asset?.description ?? ""),
      prompt: String(asset?.prompt ?? ""),
      views: views.length ? views : getDefaultVideoAssetViews(type),
      createdAt,
      updatedAt: String(asset?.updatedAt ?? "").trim() || createdAt
    };
  }

  function normalizeVideoAssetsForUi(assets = []) {
    const usedNames = new Set();
    const usedIds = new Set();

    return (Array.isArray(assets) ? assets : []).map((asset, index) => {
      const normalizedAsset = normalizeVideoAssetForUi(asset, index, usedNames);

      if (usedIds.has(normalizedAsset.id)) {
        normalizedAsset.id = createLocalId("video_asset");
      }

      usedIds.add(normalizedAsset.id);
      return normalizedAsset;
    });
  }

  function normalizeVideoShotForUi(shot, index = 0) {
    const now = new Date().toISOString();

    return {
      id: String(shot?.id ?? "").trim() || createLocalId("video_shot"),
      index: Math.max(1, Math.round(Number(shot?.index ?? index + 1) || index + 1)),
      title: String(shot?.title ?? "").trim() || `镜头 ${index + 1}`,
      summary: String(shot?.summary ?? ""),
      prompt: String(shot?.prompt ?? ""),
      negativePrompt: String(shot?.negativePrompt ?? ""),
      reference: String(shot?.reference ?? ""),
      output: String(shot?.output ?? ""),
      taskId: normalizeVideoText(shot?.taskId),
      videoUrl: normalizeVideoText(shot?.videoUrl),
      lastFrameUrl: normalizeVideoText(shot?.lastFrameUrl),
      provider: normalizeVideoText(shot?.provider),
      model: normalizeVideoText(shot?.model),
      ...(shot?.rawResult && typeof shot.rawResult === "object" ? { rawResult: shot.rawResult } : {}),
      status: normalizeVideoShotStatusForUi(shot?.status),
      durationSeconds: normalizeVideoDurationSeconds(shot?.durationSeconds, 5),
      updatedAt: String(shot?.updatedAt ?? "").trim() || now
    };
  }

  function normalizeVideoShotsForUi(shots = []) {
    const normalizedShots = (Array.isArray(shots) ? shots : [])
      .map((shot, index) => normalizeVideoShotForUi(shot, index))
      .sort((left, right) => left.index - right.index);

    if (normalizedShots.length) {
      return normalizedShots;
    }

    return [
      normalizeVideoShotForUi(
        {
          index: 1,
          title: "开场镜头",
          summary: "写下本镜头的主体、运动、景别、光线、情绪和转场。",
          prompt: "生成一个 5 秒开场镜头，主体清晰，运动可控，光线和风格与项目设定一致。",
          negativePrompt: "低清晰度、畸形肢体、字幕、水印、过度闪烁、镜头抖动、画面断裂",
          reference: "",
          output: "",
          status: "inProgress",
          durationSeconds: 5
        },
        0
      )
    ];
  }

  function normalizeVideoProjectForUi(project, index = 0) {
    const now = new Date().toISOString();
    const mode = normalizeVideoProjectModeForUi(project?.mode);
    const createdAt = String(project?.createdAt ?? "").trim() || now;
    const updatedAt = String(project?.updatedAt ?? "").trim() || createdAt;

    return {
      id: String(project?.id ?? "").trim() || createLocalId("video_project"),
      title: String(project?.title ?? "").trim() || `未命名视频 ${index + 1}`,
      mode,
      aspectRatio: normalizeVideoProjectAspectRatioForUi(project?.aspectRatio),
      genre: String(project?.genre ?? "").trim() || "视频 / 待定类型",
      status: String(project?.status ?? "").trim() || "新建",
      summary: String(project?.summary ?? ""),
      visualStyle: String(project?.visualStyle ?? ""),
      storyboardPlan: String(project?.storyboardPlan ?? ""),
      durationSeconds: normalizeVideoDurationSeconds(
        project?.durationSeconds,
        VIDEO_PROJECT_MODE_META[mode]?.defaultDuration ?? 5
      ),
      coverUrl: String(project?.coverUrl ?? "").trim(),
      coverPrompt: String(project?.coverPrompt ?? ""),
      coverShouldShowTitle: project?.coverShouldShowTitle !== false,
      coverTone:
        String(project?.coverTone ?? "").trim() ||
        VIDEO_PROJECT_COVER_TONES[index % VIDEO_PROJECT_COVER_TONES.length] ||
        "lumen",
      assets: normalizeVideoAssetsForUi(project?.assets),
      shots: normalizeVideoShotsForUi(project?.shots),
      createdAt,
      updatedAt
    };
  }

  function normalizeVideoProjectsForUi(projects = []) {
    return (Array.isArray(projects) ? projects : []).map((project, index) => normalizeVideoProjectForUi(project, index));
  }

  function applyVideoProjectsFromStorage(projects = [], options = {}) {
    const normalizedProjects = normalizeVideoProjectsForUi(projects);
    const preferredProjectId = options.preferProjectId ?? ui.marketplace.video.activeProjectId;
    const nextProject =
      normalizedProjects.find((project) => project.id === preferredProjectId) ?? normalizedProjects[0] ?? null;

    workbench.videoProjects = normalizedProjects;
    ui.marketplace.video.projects = normalizedProjects;
    ui.marketplace.video.activeProjectId = nextProject?.id ?? null;

    if (!nextProject && ui.marketplace.view === "videoDetail") {
      ui.marketplace.view = "videoShelf";
    }

    if (nextProject && !nextProject.shots.some((shot) => shot.id === ui.marketplace.video.activeShotId)) {
      ui.marketplace.video.activeShotId = nextProject.shots[0]?.id ?? "";
    }
  }

  function buildVideoProjectSavePayload(project) {
    return {
      id: project.id,
      title: project.title,
      mode: normalizeVideoProjectModeForUi(project.mode),
      aspectRatio: normalizeVideoProjectAspectRatioForUi(project.aspectRatio),
      genre: project.genre,
      status: project.status,
      summary: project.summary,
      visualStyle: project.visualStyle,
      storyboardPlan: project.storyboardPlan,
      durationSeconds: normalizeVideoDurationSeconds(project.durationSeconds),
      coverUrl: String(project.coverUrl ?? "").trim(),
      coverPrompt: String(project.coverPrompt ?? ""),
      coverShouldShowTitle: project.coverShouldShowTitle !== false,
      assets: getVideoAssets(project).map((asset, index) => ({
        ...normalizeVideoAssetForUi(asset, index),
        updatedAt: asset.updatedAt
      })),
      shots: getVideoShots(project).map((shot, index) => ({
        ...normalizeVideoShotForUi(shot, index),
        updatedAt: shot.updatedAt
      })),
      coverTone: project.coverTone,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
  }

  function scheduleVideoProjectAutosave(projectId) {
    if (!desktopApi?.upsertVideoProject || !projectId) {
      return;
    }

    clearVideoAutosaveTimer();

    videoAutosaveTimer = setTimeout(() => {
      videoAutosaveTimer = null;
      void persistVideoProjectById(projectId, { silent: true });
    }, WRITING_AUTOSAVE_DELAY);
  }

  function clearVideoAutosaveTimer() {
    if (videoAutosaveTimer) {
      clearTimeout(videoAutosaveTimer);
      videoAutosaveTimer = null;
    }
  }

  function touchVideoProject(project, options = {}) {
    if (!project) {
      return;
    }

    project.updatedAt = new Date().toISOString();

    if (options.persist !== false) {
      scheduleVideoProjectAutosave(project.id);
    }
  }

  async function persistVideoProjectById(projectId, options = {}) {
    if (!desktopApi?.upsertVideoProject || !projectId) {
      return;
    }

    if (videoSaveInFlight) {
      videoQueuedSaveProjectId = projectId;
      return;
    }

    const project = videoProjects.value.find((entry) => entry.id === projectId);

    if (!project) {
      return;
    }

    videoSaveInFlight = true;

    try {
      const savedProjects = await desktopApi.upsertVideoProject(buildVideoProjectSavePayload(project));
      applyVideoProjectsFromStorage(savedProjects, { preferProjectId: projectId });

      if (!options.silent) {
        setStatus("视频项目已写入本地。", "success");
      }
    } catch (error) {
      console.error("Failed to save video project", error);

      if (!options.silent) {
        setStatus(`视频项目保存失败：${getErrorMessage(error)}`, "danger");
      }
    } finally {
      videoSaveInFlight = false;

      const queuedProjectId = videoQueuedSaveProjectId;
      videoQueuedSaveProjectId = null;

      if (queuedProjectId) {
        void persistVideoProjectById(queuedProjectId, { silent: true });
      }
    }
  }

  function getVideoProjectModeLabel(mode) {
    return VIDEO_PROJECT_MODE_META[normalizeVideoProjectModeForUi(mode)]?.label ?? "文生视频";
  }

  function getVideoProjectAspectRatioLabel(aspectRatio) {
    return VIDEO_PROJECT_ASPECT_RATIO_META[normalizeVideoProjectAspectRatioForUi(aspectRatio)]?.label ?? "横屏 16:9";
  }

  function getVideoShots(project) {
    return Array.isArray(project?.shots) ? project.shots : [];
  }

  function getVideoAssets(project) {
    return Array.isArray(project?.assets) ? project.assets : [];
  }

  function getVideoAssetFilledViewCount(asset) {
    return (Array.isArray(asset?.views) ? asset.views : []).filter((view) => normalizeVideoText(view?.src)).length;
  }

  function getVideoShotDisplayTitle(shot, index = 0) {
    const order = Number(shot?.index ?? index + 1);
    const title = String(shot?.title ?? "").trim();
    return `镜头 ${Number.isFinite(order) && order > 0 ? order : index + 1} ${title || "未命名镜头"}`;
  }

  function getVideoShotStatusLabel(status) {
    return VIDEO_SHOT_STATUS_META[status]?.label ?? VIDEO_SHOT_STATUS_META.todo.label;
  }

  function getVideoShotStatusClass(status) {
    return VIDEO_SHOT_STATUS_META[status]?.className ?? VIDEO_SHOT_STATUS_META.todo.className;
  }

  function getVideoTotalDuration(project) {
    return getVideoShots(project).reduce((total, shot) => total + normalizeVideoDurationSeconds(shot.durationSeconds, 0), 0);
  }

  function getFilteredVideoShotEntries(shots, query) {
    const keyword = String(query ?? "").trim().toLowerCase();

    return (Array.isArray(shots) ? shots : [])
      .map((shot, index) => ({
        shot,
        index,
        title: getVideoShotDisplayTitle(shot, index)
      }))
      .filter((entry) => {
        if (!keyword) {
          return true;
        }

        return [entry.title, entry.shot?.summary, entry.shot?.prompt, getVideoShotStatusLabel(entry.shot?.status)]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(keyword));
      });
  }

  function trimVideoExportTextBlock(value) {
    return String(value ?? "").replace(/^(?:[ \t]*\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
  }

  function sanitizeVideoExportTitle(value) {
    return (
      String(value ?? "")
        .replace(/\.[^.]+$/, "")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/g, "")
        .trim() || "未命名视频项目"
    );
  }

  function getVideoExportFileName(project) {
    return `${sanitizeVideoExportTitle(project?.title)}.md`;
  }

  function buildVideoProjectExportContent(project) {
    const shots = getVideoShots(project).slice().sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0));
    const lines = [`# ${sanitizeVideoExportTitle(project?.title)}`, ""];
    const summary = trimVideoExportTextBlock(project?.summary ?? "");
    const visualStyle = trimVideoExportTextBlock(project?.visualStyle ?? "");
    const storyboardPlan = trimVideoExportTextBlock(project?.storyboardPlan ?? "");

    lines.push("## 项目信息", "");
    lines.push(`- 生成模式：${getVideoProjectModeLabel(project?.mode)}`);
    lines.push(`- 画幅：${getVideoProjectAspectRatioLabel(project?.aspectRatio)}`);
    lines.push(`- 类型：${project?.genre || "视频 / 待定类型"}`);
    lines.push(`- 默认时长：${normalizeVideoDurationSeconds(project?.durationSeconds)} 秒`);
    lines.push(`- 镜头总时长：${getVideoTotalDuration(project)} 秒`);
    lines.push(`- 状态：${project?.status || "新建"}`, "");

    if (summary) {
      lines.push("## 项目概念", "", summary, "");
    }

    if (visualStyle) {
      lines.push("## 视觉与运动风格", "", visualStyle, "");
    }

    if (storyboardPlan) {
      lines.push("## 分镜规划", "", storyboardPlan, "");
    }

    lines.push("## 素材库", "");

    const assets = getVideoAssets(project);

    if (assets.length) {
      assets.forEach((asset) => {
        lines.push(`### ${getVideoAssetTypeLabel(asset.type)}：${asset.name}`, "");

        if (trimVideoExportTextBlock(asset.description)) {
          lines.push(trimVideoExportTextBlock(asset.description), "");
        }

        (Array.isArray(asset.views) ? asset.views : []).forEach((view) => {
          const src = normalizeVideoText(view.src);

          if (src) {
            lines.push(`- ${view.label || getVideoAssetViewKindLabel(view.kind)}：${src}`);
          }
        });

        lines.push("");
      });
    } else {
      lines.push("暂无素材", "");
    }

    lines.push("## 镜头列表", "");

    if (shots.length) {
      shots.forEach((shot, index) => {
        const title = getVideoShotDisplayTitle(shot, index);
        const shotSummary = trimVideoExportTextBlock(shot.summary ?? "") || "暂无镜头说明";
        lines.push(`- ${title}（${getVideoShotStatusLabel(shot.status)} / ${normalizeVideoDurationSeconds(shot.durationSeconds)} 秒）：${shotSummary}`);
      });
    } else {
      lines.push("- 暂无镜头");
    }

    lines.push("", "## 生成台", "");

    shots.forEach((shot, index) => {
      const title = getVideoShotDisplayTitle(shot, index);
      const shotSummary = trimVideoExportTextBlock(shot.summary ?? "");
      const reference = trimVideoExportTextBlock(shot.reference ?? "");
      const prompt = trimVideoExportTextBlock(shot.prompt ?? "");
      const negativePrompt = trimVideoExportTextBlock(shot.negativePrompt ?? "");
      const output = trimVideoExportTextBlock(shot.output ?? "");

      lines.push(`### ${title}`, "");

      if (shotSummary) {
        lines.push("#### 镜头说明", "", shotSummary, "");
      }

      if (reference) {
        lines.push("#### 参考素材", "", reference, "");
      }

      if (prompt) {
        lines.push("#### 正向提示词", "", prompt, "");
      }

      if (negativePrompt) {
        lines.push("#### 反向提示词", "", negativePrompt, "");
      }

      lines.push("#### 生成结果", "", output || "暂无生成结果", "");
    });

    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  function openVideoAppShelf() {
    writeRef(activeFeature, featureMarketplaceId);
    ui.marketplace.view = "videoShelf";

    if (!ui.marketplace.video.activeProjectId && videoProjects.value.length) {
      ui.marketplace.video.activeProjectId = videoProjects.value[0].id;
    }
  }

  function backVideoMarketplace() {
    ui.marketplace.view = "apps";
  }

  function openVideoProject(projectId) {
    ui.marketplace.video.activeProjectId = projectId;
    ui.marketplace.video.activeTab = "concept";
    const project = videoProjects.value.find((entry) => entry.id === projectId) ?? null;
    ui.marketplace.video.activeShotId = getVideoShots(project)[0]?.id ?? "";
    ui.marketplace.view = "videoDetail";
  }

  function backVideoShelf() {
    ui.marketplace.view = "videoShelf";
  }

  async function deleteVideoProjectFromShelf(projectId) {
    if (!desktopApi?.deleteVideoProject) {
      setStatus("视频项目仓储未就绪，暂时无法删除。", "danger");
      return;
    }

    const project = videoProjects.value.find((entry) => entry.id === projectId) ?? null;
    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除视频项目",
      message: `确认删除「${project?.title ?? "当前项目"}」吗？项目会移入系统回收站。`,
      detail: "删除后会从项目架移除，可在系统回收站中找回备份文件。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    clearVideoAutosaveTimer();

    if (videoQueuedSaveProjectId === projectId) {
      videoQueuedSaveProjectId = null;
    }

    try {
      const savedProjects = await desktopApi.deleteVideoProject(projectId);
      applyVideoProjectsFromStorage(savedProjects, {
        preferProjectId: ui.marketplace.video.activeProjectId === projectId ? "" : ui.marketplace.video.activeProjectId
      });
      setStatus("视频项目已移入系统回收站。", "success");
    } catch (error) {
      console.error("Failed to delete video project", error);
      setStatus(`视频项目删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function createVideoProject() {
    const now = new Date().toISOString();
    const project = {
      id: createLocalId("video_project"),
      title: `未命名视频 ${videoProjects.value.length + 1}`,
      mode: "textToVideo",
      aspectRatio: "16:9",
      genre: "视频 / 待定类型",
      status: "新建",
      summary: "写下视频的主题、主体、情绪目标和最终用途。",
      visualStyle: "电影感光影，主体稳定，镜头运动克制，色彩干净。",
      storyboardPlan: "按镜头写下开场、推进、高潮和收束，每个镜头都要有主体、运动、景别和转场。",
      durationSeconds: 5,
      coverTone: VIDEO_PROJECT_COVER_TONES[videoProjects.value.length % VIDEO_PROJECT_COVER_TONES.length],
      coverUrl: "",
      coverPrompt: "",
      coverShouldShowTitle: true,
      assets: [],
      shots: [
        {
          id: createLocalId("video_shot"),
          index: 1,
          title: "开场镜头",
          summary: "写下本镜头的主体、运动、景别、光线、情绪和转场。",
          prompt: "生成一个 5 秒开场镜头，主体清晰，运动可控，光线和风格与项目设定一致。",
          negativePrompt: "低清晰度、畸形肢体、字幕、水印、过度闪烁、镜头抖动、画面断裂",
          reference: "",
          output: "",
          status: "inProgress",
          durationSeconds: 5,
          updatedAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    ui.marketplace.video.projects = [project, ...videoProjects.value];
    workbench.videoProjects = ui.marketplace.video.projects;
    ui.marketplace.video.activeTab = "concept";
    ui.marketplace.video.activeShotId = project.shots[0]?.id ?? "";
    openVideoProject(project.id);
    setStatus("已创建一个视频项目，正在写入本地项目库。", "success");
    await persistVideoProjectById(project.id, { silent: false });
  }

  function setVideoProjectField(field, value) {
    const project = activeVideoProject.value;

    if (!project) {
      return;
    }

    if (field === "mode") {
      const previousMode = normalizeVideoProjectModeForUi(project.mode);
      const previousDefaultDuration = VIDEO_PROJECT_MODE_META[previousMode]?.defaultDuration ?? 5;
      project.mode = normalizeVideoProjectModeForUi(value);
      const nextDefaultDuration = VIDEO_PROJECT_MODE_META[project.mode]?.defaultDuration ?? 5;

      if (!project.durationSeconds || project.durationSeconds === previousDefaultDuration) {
        project.durationSeconds = nextDefaultDuration;
      }
    } else if (field === "aspectRatio") {
      project.aspectRatio = normalizeVideoProjectAspectRatioForUi(value);
    } else if (field === "durationSeconds") {
      project.durationSeconds = normalizeVideoDurationSeconds(value, project.durationSeconds);
    } else if (field === "title") {
      project.title = String(value ?? "");
    } else {
      project[field] = String(value ?? "");
    }

    touchVideoProject(project);
  }

  function setVideoProjectTitle(value) {
    setVideoProjectField("title", value);
  }

  function setVideoProjectMode(value) {
    setVideoProjectField("mode", value);
  }

  function setVideoProjectAspectRatio(value) {
    setVideoProjectField("aspectRatio", value);
  }

  function setVideoProjectGenre(value) {
    setVideoProjectField("genre", value);
  }

  function setVideoProjectSummary(value) {
    setVideoProjectField("summary", value);
  }

  function setVideoProjectVisualStyle(value) {
    setVideoProjectField("visualStyle", value);
  }

  function setVideoProjectStoryboardPlan(value) {
    setVideoProjectField("storyboardPlan", value);
  }

  function setVideoProjectDurationSeconds(value) {
    setVideoProjectField("durationSeconds", value);
  }

  function setVideoIntroMode(mode) {
    ui.marketplace.video.activeTab = "concept";
    ui.marketplace.video.introMode = mode === "assets" ? "assets" : "settings";
  }

  function toggleVideoProfileRail() {
    ui.marketplace.video.isProfileCollapsed = !ui.marketplace.video.isProfileCollapsed;
  }

  function toggleVideoAssetRail() {
    ui.marketplace.video.isAssetRailCollapsed = !ui.marketplace.video.isAssetRailCollapsed;
  }

  function setVideoTab(tabId) {
    ui.marketplace.video.activeTab = VIDEO_APP_TABS.some((tab) => tab.id === tabId) ? tabId : "concept";
  }

  function selectVideoAsset(assetId) {
    ui.marketplace.video.activeAssetId = String(assetId ?? "").trim();
    ui.marketplace.video.previewAssetViewId = "";
    setVideoIntroMode("assets");
  }

  function setVideoAssetTypeFilter(filter) {
    const nextFilter = normalizeVideoAssetFilterForUi(filter);
    ui.marketplace.video.assetTypeFilter = nextFilter;

    if (nextFilter === "all") {
      if (!activeVideoAsset.value && activeVideoAssets.value[0]) {
        ui.marketplace.video.activeAssetId = activeVideoAssets.value[0].id;
      }
      return;
    }

    const asset = activeVideoAsset.value;
    const shouldKeepAsset = asset && normalizeVideoAssetTypeForUi(asset.type) === nextFilter;

    if (!shouldKeepAsset) {
      ui.marketplace.video.activeAssetId = activeVideoAssets.value.find((entry) => normalizeVideoAssetTypeForUi(entry.type) === nextFilter)?.id ?? "";
    }
  }

  function getUniqueVideoAssetName(project, name, assetId = "") {
    const usedNames = new Set(
      getVideoAssets(project)
        .filter((asset) => asset.id !== assetId)
        .map((asset) => getVideoAssetNameKey(asset.name))
        .filter(Boolean)
    );
    const fallback = `${COMIC_ASSET_TYPE_META.character.defaultName} ${getVideoAssets(project).length + 1}`;
    return ensureUniqueVideoAssetName(name, usedNames, fallback);
  }

  function createVideoAsset(type = "character") {
    const project = activeVideoProject.value;

    if (!project) {
      return;
    }

    const requestedType = normalizeVideoAssetFilterForUi(type);
    const normalizedType = requestedType === "all" ? "character" : normalizeVideoAssetTypeForUi(requestedType);
    const typeMeta = COMIC_ASSET_TYPE_META[normalizedType] ?? COMIC_ASSET_TYPE_META.character;
    const now = new Date().toISOString();
    const asset = {
      id: createLocalId("video_asset"),
      name: getUniqueVideoAssetName(project, `${typeMeta.defaultName} ${getVideoAssets(project).length + 1}`),
      type: normalizedType,
      description: typeMeta.defaultDescription,
      prompt: typeMeta.defaultPrompt,
      views: getDefaultVideoAssetViews(normalizedType),
      createdAt: now,
      updatedAt: now
    };

    project.assets = [...getVideoAssets(project), asset];
    ui.marketplace.video.activeAssetId = asset.id;
    ui.marketplace.video.assetTypeFilter = normalizedType;
    ui.marketplace.video.isAssetRailCollapsed = false;
    setVideoIntroMode("assets");
    touchVideoProject(project);
  }

  async function deleteVideoAsset(assetId) {
    const project = activeVideoProject.value;
    const normalizedAssetId = String(assetId ?? "").trim();
    const asset = getVideoAssets(project).find((entry) => entry.id === normalizedAssetId);

    if (!project || !asset) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除素材",
      message: `确认删除素材「${asset.name}」吗？`,
      detail: "删除后不会改写已生成的视频记录，但后续镜头不能再选择它作为参考素材。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    project.assets = getVideoAssets(project).filter((entry) => entry.id !== normalizedAssetId);
    ui.marketplace.video.activeAssetId = project.assets[0]?.id ?? "";
    ui.marketplace.video.previewAssetViewId = "";
    touchVideoProject(project);
    setStatus("视频素材已删除。", "success");
  }

  function touchVideoAsset(asset) {
    const project = activeVideoProject.value;

    if (!project || !asset) {
      return;
    }

    asset.updatedAt = new Date().toISOString();
    touchVideoProject(project);
  }

  function setVideoAssetName(assetId, value) {
    const project = activeVideoProject.value;
    const asset = getVideoAssets(project).find((entry) => entry.id === assetId);

    if (!project || !asset) {
      return;
    }

    const nextName = String(value ?? "");
    asset.name = nextName.trim() ? getUniqueVideoAssetName(project, nextName, asset.id) : nextName;
    touchVideoAsset(asset);
  }

  function setVideoAssetType(assetId, value) {
    const asset = getVideoAssets(activeVideoProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.type = normalizeVideoAssetTypeForUi(value);
    ui.marketplace.video.assetTypeFilter = asset.type;

    if (!Array.isArray(asset.views) || !asset.views.length) {
      asset.views = getDefaultVideoAssetViews(asset.type);
    }

    touchVideoAsset(asset);
  }

  function setVideoAssetDescription(assetId, value) {
    const asset = getVideoAssets(activeVideoProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.description = String(value ?? "");
    touchVideoAsset(asset);
  }

  function addVideoAssetView(assetId) {
    const asset = getVideoAssets(activeVideoProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    const views = Array.isArray(asset.views) ? asset.views : [];
    const kind = asset.type === "scene" ? "angle" : "detail";
    const view = normalizeVideoAssetViewForUi(
      {
        kind,
        label: `${getVideoAssetViewKindLabel(kind)} ${views.length + 1}`
      },
      views.length
    );

    asset.views = [...views, view];
    touchVideoAsset(asset);
  }

  function removeVideoAssetView(assetId, viewId) {
    const asset = getVideoAssets(activeVideoProject.value).find((entry) => entry.id === assetId);

    if (!asset) {
      return;
    }

    asset.views = (Array.isArray(asset.views) ? asset.views : []).filter((view) => view.id !== viewId);
    if (ui.marketplace.video.previewAssetViewId === viewId) {
      ui.marketplace.video.previewAssetViewId = "";
    }
    touchVideoAsset(asset);
  }

  function setVideoAssetViewField(assetId, viewId, field, value) {
    const asset = getVideoAssets(activeVideoProject.value).find((entry) => entry.id === assetId);
    const view = (Array.isArray(asset?.views) ? asset.views : []).find((entry) => entry.id === viewId);

    if (!asset || !view) {
      return;
    }

    if (field === "kind") {
      view.kind = normalizeVideoAssetViewKindForUi(value);
      if (!String(view.label ?? "").trim()) {
        view.label = getVideoAssetViewKindLabel(view.kind);
      }
    } else if (field === "label") {
      view.label = String(value ?? "");
    } else if (field === "src") {
      view.src = String(value ?? "").trim();
      if (!normalizeVideoText(view.src) && ui.marketplace.video.previewAssetViewId === view.id) {
        ui.marketplace.video.previewAssetViewId = "";
      }
    } else if (field === "prompt") {
      view.prompt = String(value ?? "");
    }

    touchVideoAsset(asset);
  }

  function selectVideoShot(shotId) {
    ui.marketplace.video.activeShotId = shotId;
  }

  function setVideoShotPickerOpen(isOpen) {
    ui.marketplace.video.isShotPickerOpen = Boolean(isOpen);

    if (ui.marketplace.video.isShotPickerOpen) {
      void scrollVideoShotPickerToActive();
    }
  }

  function toggleVideoShotPicker() {
    setVideoShotPickerOpen(!ui.marketplace.video.isShotPickerOpen);
  }

  function selectVideoShotFromPicker(shotId) {
    selectVideoShot(shotId);
    ui.marketplace.video.shotSearchQuery = "";
    setVideoShotPickerOpen(false);
  }

  async function scrollVideoShotPickerToActive() {
    await nextTick();

    const menu = videoShotDropdownMenuRef.value;
    const activeItem = menu?.querySelector?.(".writing-chapter-dropdown-item.is-active");

    if (!menu || !activeItem) {
      return;
    }

    const targetTop = activeItem.offsetTop - (menu.clientHeight - activeItem.clientHeight) / 2;
    menu.scrollTop = Math.max(0, targetTop);
  }

  function touchVideoShot(shot) {
    const project = activeVideoProject.value;

    if (!project || !shot) {
      return;
    }

    shot.updatedAt = new Date().toISOString();

    if (shot.status === "todo" && (String(shot.prompt ?? "").trim() || String(shot.output ?? "").trim())) {
      shot.status = "inProgress";
    }

    touchVideoProject(project);
  }

  function createVideoShot() {
    const project = activeVideoProject.value;

    if (!project) {
      return;
    }

    const now = new Date().toISOString();
    const shots = getVideoShots(project);
    const shot = {
      id: createLocalId("video_shot"),
      index: shots.length + 1,
      title: `镜头 ${shots.length + 1}`,
      summary: "写下本镜头的主体、运动、景别、光线、情绪和转场。",
      prompt: "基于项目设定生成本镜头视频提示词。",
      negativePrompt: "低清晰度、畸形肢体、字幕、水印、过度闪烁、镜头抖动、画面断裂",
      reference: "",
      output: "",
      status: "todo",
      durationSeconds: normalizeVideoDurationSeconds(project.durationSeconds, 5),
      updatedAt: now
    };

    project.shots = [...shots, shot];
    ui.marketplace.video.activeShotId = shot.id;
    ui.marketplace.video.activeTab = "storyboard";
    touchVideoProject(project);
  }

  function setVideoShotTitle(shot, value) {
    if (!shot) {
      return;
    }

    shot.title = String(value ?? "");
    touchVideoShot(shot);
  }

  function setVideoShotSummary(shot, value) {
    if (!shot) {
      return;
    }

    shot.summary = String(value ?? "");
    touchVideoShot(shot);
  }

  function setVideoShotPrompt(shot, value) {
    if (!shot) {
      return;
    }

    shot.prompt = String(value ?? "");
    touchVideoShot(shot);
  }

  function setVideoShotNegativePrompt(shot, value) {
    if (!shot) {
      return;
    }

    shot.negativePrompt = String(value ?? "");
    touchVideoShot(shot);
  }

  function setVideoShotReference(shot, value) {
    if (!shot) {
      return;
    }

    shot.reference = String(value ?? "");
    touchVideoShot(shot);
  }

  function setVideoShotOutput(shot, value) {
    if (!shot) {
      return;
    }

    shot.output = String(value ?? "");
    touchVideoShot(shot);
  }

  function normalizeVideoAssetReferenceKey(value) {
    return String(value ?? "")
      .trim()
      .replace(/^@+/u, "")
      .replace(/\s+/g, "")
      .replace(/[「」《》【】[\]（）()]/g, "")
      .toLowerCase();
  }

  function extractVideoAssetReferenceTokens(text) {
    const tokens = [];
    const seen = new Set();
    const pattern = /@([^\s@，,。；;：:\n\r]+)/gu;
    let match = pattern.exec(String(text ?? ""));

    while (match) {
      const token = normalizeVideoText(match[1]);
      const key = normalizeVideoAssetReferenceKey(token);

      if (token && key && !seen.has(key)) {
        seen.add(key);
        tokens.push(token);
      }

      match = pattern.exec(String(text ?? ""));
    }

    return tokens;
  }

  function getVideoAssetReferenceOptions(assetId = "") {
    const options = [];

    activeVideoAssets.value.forEach((asset) => {
      const views = Array.isArray(asset?.views) ? asset.views : [];

      views.forEach((view) => {
        const src = normalizeVideoText(view?.src);

        if (!src) {
          return;
        }

        const assetName = normalizeVideoText(asset?.name) || "未命名素材";
        const viewLabel = normalizeVideoText(view?.label) || getVideoAssetViewKindLabel(view?.kind);
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
        ].map((value) => normalizeVideoAssetReferenceKey(value));

        options.push({
          id: `${asset?.id || "asset"}:${view?.id || "view"}`,
          assetId: asset?.id ?? "",
          viewId: view?.id ?? "",
          assetName,
          viewLabel,
          label,
          insertText,
          src,
          kind: normalizeVideoAssetViewKindForUi(view?.kind),
          type: normalizeVideoAssetTypeForUi(asset?.type),
          isCurrentAsset: Boolean(assetId && asset?.id === assetId),
          aliases
        });
      });
    });

    return options;
  }

  function resolveVideoAssetReferenceOptions(tokens = [], assetId = "") {
    if (!tokens.length) {
      return [];
    }

    const options = getVideoAssetReferenceOptions(assetId);
    const resolved = [];
    const seen = new Set();

    tokens.forEach((token) => {
      const key = normalizeVideoAssetReferenceKey(token);
      const option = options.find((entry) => entry.aliases.includes(key));

      if (option && !seen.has(option.id)) {
        seen.add(option.id);
        resolved.push(option);
      }
    });

    return resolved;
  }

  function getVideoAssetViewReferenceOptions(assetId, view) {
    return resolveVideoAssetReferenceOptions(extractVideoAssetReferenceTokens(view?.prompt), assetId);
  }

  function getVideoShotReferenceOptions(shot) {
    return resolveVideoAssetReferenceOptions([
      ...extractVideoAssetReferenceTokens(shot?.reference),
      ...extractVideoAssetReferenceTokens(shot?.prompt),
      ...extractVideoAssetReferenceTokens(shot?.summary)
    ]);
  }

  function getVideoAssetViewReferenceImages(assetId, view) {
    const seen = new Set();

    return getVideoAssetViewReferenceOptions(assetId, view)
      .map((option) => option.src)
      .filter((src) => {
        if (!src || seen.has(src)) {
          return false;
        }

        seen.add(src);
        return true;
      });
  }

  function getVideoShotReferenceImage(shot) {
    const resolvedReference = getVideoShotReferenceOptions(shot).find((option) => normalizeVideoText(option.src));

    if (resolvedReference?.src) {
      return resolvedReference.src;
    }

    const manualReference = normalizeVideoText(shot?.reference);
    return /^https?:\/\//iu.test(manualReference) || /^data:image\//iu.test(manualReference) ? manualReference : "";
  }

  function getVideoAssetViewGenerationSize(asset, view) {
    const kind = normalizeVideoAssetViewKindForUi(view?.kind);
    const type = normalizeVideoAssetTypeForUi(asset?.type);

    if (kind === "turnaround" || type === "scene") {
      return "1536x1024";
    }

    if (type === "character" && ["front", "side", "back", "angle"].includes(kind)) {
      return "1024x1536";
    }

    return "1024x1024";
  }

  function buildVideoAssetViewGenerationPrompt(asset, view) {
    const typeLabel = getVideoAssetTypeLabel(asset?.type);
    const viewLabel = normalizeVideoText(view?.label) || getVideoAssetViewKindLabel(view?.kind);
    const type = normalizeVideoAssetTypeForUi(asset?.type);
    const kind = normalizeVideoAssetViewKindForUi(view?.kind);
    const promptLines = [view?.prompt, asset?.description, asset?.prompt]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    const directives = [
      "请生成一张可长期复用的短剧/短视频视觉素材设定图。",
      "画面必须便于后续作为图生视频首帧或角色/场景一致性参考。",
      type === "character" && kind === "turnaround"
        ? "角色三视图使用 16:9 横图，同一角色正面、侧面、背面完整全身并排，不能裁切头顶、脚部、衣摆或武器。"
        : "",
      type === "character" && kind !== "turnaround"
        ? "角色素材优先完整全身或清晰半身，五官、发型、服饰、体态和标志细节稳定。"
        : "",
      type === "scene" ? "场景素材要明确空间关系、光线方向、时代质感、可复用布景和镜头运动起点。" : "",
      type === "prop" ? "物品素材要完整展示轮廓、材质、比例、纹样和使用方式，避免裁切主体。" : "",
      "禁止文字标签、UI 标注、水印、过度拼贴和随机新增无关主体。"
    ].filter(Boolean);

    return [
      `素材类型：${typeLabel}`,
      `素材名称：${normalizeVideoText(asset?.name) || "未命名素材"}`,
      `目标视图：${viewLabel}`,
      `画幅规格：${getVideoAssetViewGenerationSize(asset, view)}`,
      promptLines.length ? `创作简报：\n${promptLines.map((line) => `- ${line}`).join("\n")}` : "",
      ...directives
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function generateVideoAssetViewImage(assetId, viewId) {
    const asset = getVideoAssets(activeVideoProject.value).find((entry) => entry.id === assetId);
    const view = (Array.isArray(asset?.views) ? asset.views : []).find((entry) => entry.id === viewId);

    if (!asset || !view) {
      return;
    }

    if (!desktopApi?.callMcpServerTool) {
      setStatus("Gordon Tools 桥接未就绪，暂时无法生成素材图。", "danger");
      return;
    }

    const prompt = buildVideoAssetViewGenerationPrompt(asset, view);
    const referenceImages = getVideoAssetViewReferenceImages(asset.id, view);

    if (!normalizeVideoText(prompt)) {
      setStatus("请先填写视图提示词或素材描述。", "warning");
      return;
    }

    ui.marketplace.video.generatingAssetViewId = view.id;
    setStatus(
      referenceImages.length
        ? `正在参考 ${referenceImages.length} 张素材图生成：${asset.name} / ${view.label || getVideoAssetViewKindLabel(view.kind)}`
        : `正在生成视频素材视图：${asset.name} / ${view.label || getVideoAssetViewKindLabel(view.kind)}`,
      "neutral"
    );

    try {
      const toolArguments = {
        prompt,
        size: getVideoAssetViewGenerationSize(asset, view),
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
        throw new Error(normalizeVideoText(toolResult.contentText) || "image_gen 调用失败");
      }

      const image = extractFirstImageArtifact(toolResult);

      if (!image?.src) {
        setStatus("素材图生成完成，但工具没有返回可展示图片。", "warning");
        return;
      }

      view.src = image.src;
      view.prompt = normalizeVideoText(view.prompt) || image.prompt || "";
      touchVideoAsset(asset);
      setStatus(
        [
          referenceImages.length ? `已参考 ${referenceImages.length} 张素材图` : "",
          image.provider || image.model ? `视频素材图已生成并写入视图：${[image.provider, image.model].filter(Boolean).join(" / ")}` : "视频素材图已生成并写入当前视图。"
        ]
          .filter(Boolean)
          .join("；"),
        "success"
      );
    } catch (error) {
      console.error("Failed to generate video asset view image", error);
      setStatus(`视频素材图生成失败：${getErrorMessage(error)}`, "danger");
    } finally {
      if (ui.marketplace.video.generatingAssetViewId === view.id) {
        ui.marketplace.video.generatingAssetViewId = "";
      }
    }
  }

  function previewVideoAssetView(viewId) {
    const views = Array.isArray(activeVideoAsset.value?.views) ? activeVideoAsset.value.views : [];
    const view = views.find((entry) => entry.id === viewId);
    const asset = activeVideoAsset.value;
    const project = activeVideoProject.value;

    if (!normalizeVideoText(view?.src)) {
      setStatus("当前视图还没有可放大的素材图。", "warning");
      return;
    }

    ui.marketplace.video.previewAssetViewId = view.id;
    window.dispatchEvent(
      new CustomEvent("gordon:image-preview:open", {
        detail: {
          src: normalizeVideoText(view.src),
          alt: view.label || getVideoAssetViewKindLabel(view.kind),
          title: view.label || asset?.name || "视频素材图",
          downloadTitle: [project?.title, asset?.name, view.label || getVideoAssetViewKindLabel(view.kind)].filter(Boolean).join("-")
        }
      })
    );
  }

  async function downloadVideoAssetViewImage(assetId, viewId) {
    const project = activeVideoProject.value;
    const asset = getVideoAssets(project).find((entry) => entry.id === assetId);
    const view = (Array.isArray(asset?.views) ? asset.views : []).find((entry) => entry.id === viewId);
    const imageUrl = normalizeVideoText(view?.src);
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
        title: [project?.title, asset.name, view.label || getVideoAssetViewKindLabel(view.kind)].filter(Boolean).join("-"),
        imageUrl
      });

      if (result?.fileName) {
        setStatus(`视频素材图已下载：${result.fileName}`, "success");
      }
    } catch (error) {
      console.error("Failed to download video asset view image", error);
      setStatus(`下载视频素材图失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function extractVideoStructuredContent(toolResult) {
    if (toolResult?.structuredContent && typeof toolResult.structuredContent === "object") {
      return toolResult.structuredContent;
    }

    return {};
  }

  function extractVideoArtifact(toolResult) {
    const structuredContent = extractVideoStructuredContent(toolResult);
    const artifacts = Array.isArray(structuredContent.artifacts) ? structuredContent.artifacts : [];
    return artifacts.find((artifact) => String(artifact?.kind ?? "") === "video" && String(artifact?.url ?? "").trim()) ?? null;
  }

  function extractVideoTaskId(toolResult) {
    const structuredContent = extractVideoStructuredContent(toolResult);
    return normalizeVideoText(structuredContent.taskId);
  }

  function extractVideoStatus(toolResult) {
    const structuredContent = extractVideoStructuredContent(toolResult);
    return normalizeVideoText(structuredContent.status);
  }

  function getVideoToolCompletionState(toolResult) {
    const structuredContent = extractVideoStructuredContent(toolResult);
    return {
      pending: structuredContent.pending === true,
      completed: structuredContent.completed === true,
      pollExhausted: structuredContent.pollExhausted === true,
      pollFailed: structuredContent.pollFailed === true,
      pollError: normalizeVideoText(structuredContent.pollError)
    };
  }

  function getVideoGenerationPrompt(project, shot) {
    return [
      normalizeVideoText(shot?.prompt),
      normalizeVideoText(shot?.summary) ? `镜头说明：${normalizeVideoText(shot.summary)}` : "",
      normalizeVideoText(project?.visualStyle) ? `视觉风格：${normalizeVideoText(project.visualStyle)}` : "",
      normalizeVideoText(project?.summary) ? `项目目标：${normalizeVideoText(project.summary)}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  function buildVideoToolArguments(project, shot) {
    const prompt = getVideoGenerationPrompt(project, shot);
    const referenceImage = getVideoShotReferenceImage(shot);
    const isImageToVideo = Boolean(referenceImage);

    return {
      operation: "submit",
      provider: "seedance",
      mode: isImageToVideo ? "first_frame_to_video" : "text_to_video",
      prompt,
      negativePrompt: shot?.negativePrompt ?? "",
      ratio: normalizeVideoProjectAspectRatioForUi(project?.aspectRatio),
      durationSeconds: normalizeVideoDurationSeconds(shot?.durationSeconds, project?.durationSeconds || 5),
      ...(referenceImage ? { image: referenceImage, referenceImages: [referenceImage] } : {})
    };
  }

  function applyVideoToolResultToShot(shot, toolResult) {
    const structuredContent = extractVideoStructuredContent(toolResult);
    const artifact = extractVideoArtifact(toolResult);
    const taskId = extractVideoTaskId(toolResult);
    const status = extractVideoStatus(toolResult);

    if (taskId) {
      shot.taskId = taskId;
    }

    if (artifact) {
      const metadata = artifact.metadata && typeof artifact.metadata === "object" ? artifact.metadata : {};
      shot.videoUrl = normalizeVideoText(artifact.url);
      shot.lastFrameUrl = normalizeVideoText(metadata.lastFrameUrl) || shot.lastFrameUrl;
      shot.status = "done";
    } else if (status && /succeed|success|done|complete|finished/iu.test(status)) {
      shot.status = "done";
    } else if (taskId || status) {
      shot.status = "inProgress";
    }

    const provider = normalizeVideoText(structuredContent.provider);
    const model = normalizeVideoText(structuredContent.model);

    if (provider) {
      shot.provider = provider;
    }

    if (model) {
      shot.model = model;
    }

    shot.rawResult = structuredContent.result && typeof structuredContent.result === "object" ? structuredContent.result : structuredContent;
    shot.output = [
      shot.output,
      taskId ? `任务 ID：${taskId}` : "",
      status ? `任务状态：${status}` : "",
      artifact ? `视频地址：${artifact.url}` : ""
    ]
      .map((line) => String(line ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
    touchVideoShot(shot);
  }

  function setVideoShotDurationSeconds(shot, value) {
    if (!shot) {
      return;
    }

    shot.durationSeconds = normalizeVideoDurationSeconds(value, shot.durationSeconds);
    touchVideoShot(shot);
  }

  function goVideoShot(shotId) {
    selectVideoShot(shotId);
    ui.marketplace.video.shotSearchQuery = "";
    setVideoShotPickerOpen(false);
    setVideoTab("generate");
  }

  async function submitVideoShot() {
    const shot = activeVideoShot.value;
    const project = activeVideoProject.value;

    if (!shot) {
      return;
    }

    if (ui.marketplace.video.isGenerating) {
      return;
    }

    if (!desktopApi?.callMcpServerTool) {
      setVideoFeedback("Gordon Tools 桥接未就绪。", "danger");
      return;
    }

    try {
      ui.marketplace.video.isGenerating = true;
      const isQuery = Boolean(shot.taskId);
      setVideoFeedback(isQuery ? "正在查询视频生成结果..." : "正在调用 video_gen 提交生成任务...", "neutral");
      setStatus(`${VIDEO_APP_NAME}${isQuery ? "正在查询视频任务。" : "正在提交视频生成任务。"}`, "neutral");

      const toolResult = await desktopApi.callMcpServerTool({
        serverId: BUILTIN_GORDON_TOOLS_MCP_ID,
        toolName: "video_gen",
        arguments: isQuery
          ? {
              operation: "query",
              provider: "seedance",
              taskId: shot.taskId
            }
          : buildVideoToolArguments(project, shot)
      });

      if (toolResult?.isError) {
        throw new Error(normalizeVideoText(toolResult.contentText) || "video_gen 调用失败");
      }

      applyVideoToolResultToShot(shot, toolResult);
      const artifact = extractVideoArtifact(toolResult);
      const taskId = extractVideoTaskId(toolResult);
      const status = extractVideoStatus(toolResult);
      const completionState = getVideoToolCompletionState(toolResult);

      if (artifact) {
        setVideoFeedback("已取得视频结果，视频地址已回填。", "success");
        setStatus(`${VIDEO_APP_NAME}已取得视频。`, "success");
      } else if (completionState.pollFailed) {
        const suffix = completionState.pollError ? `：${completionState.pollError}` : "";
        setVideoFeedback(`视频任务已提交，但查询生成结果失败${suffix}`, "warning");
        setStatus(`${VIDEO_APP_NAME}视频生成查询失败。`, "warning");
      } else if (completionState.pending || completionState.pollExhausted) {
        setVideoFeedback(taskId ? `视频仍在生成中，任务 ID：${taskId}` : status ? `视频仍在生成中：${status}` : "视频仍在生成中。", "neutral");
        setStatus(`${VIDEO_APP_NAME}视频仍在生成中。`, "neutral");
      } else {
        setVideoFeedback(taskId ? `视频任务已处理，任务 ID：${taskId}` : status ? `任务状态：${status}` : "视频任务已处理。", "neutral");
        setStatus(`${VIDEO_APP_NAME}视频任务已处理。`, "neutral");
      }
    } catch (error) {
      console.error("Failed to call video_gen", error);
      const message = getErrorMessage(error);
      setVideoFeedback(`视频生成失败：${message}`, "danger");
      setStatus(`${VIDEO_APP_NAME}视频生成失败：${message}`, "danger");
    } finally {
      ui.marketplace.video.isGenerating = false;
    }
  }

  function buildVideoQuickPrompt() {
    const project = activeVideoProject.value;
    const shot = activeVideoShot.value;
    const referencedAssets = getVideoShotReferenceOptions(shot)
      .map((option) => `${option.assetName}/${option.viewLabel}`)
      .join("、");

    return [
      `项目：${project?.title ?? "未命名视频"}`,
      `模式：${getVideoProjectModeLabel(project?.mode)}`,
      `画幅：${getVideoProjectAspectRatioLabel(project?.aspectRatio)}`,
      `类型：${project?.genre || "未填写"}`,
      `默认时长：${project?.durationSeconds || shot?.durationSeconds || 5} 秒`,
      `主题与用途：${project?.summary || "未填写"}`,
      `视觉与运动风格：${project?.visualStyle || "未填写"}`,
      `分镜总规划：${project?.storyboardPlan || "未填写"}`,
      "",
      `当前镜头：${shot ? getVideoShotDisplayTitle(shot, activeVideoShotIndex.value) : "未选择"}`,
      `镜头说明：${shot?.summary || "未填写"}`,
      `参考素材 / 首帧说明：${shot?.reference || "未填写"}`,
      `已解析引用素材：${referencedAssets || "暂无"}`,
      `已有正向提示词：${shot?.prompt || "未填写"}`,
      `已有反向提示词：${shot?.negativePrompt || "未填写"}`,
      "",
      "请为当前镜头生成一份可直接使用的视频生成方案。",
      "必须包含：正向提示词、反向提示词、镜头运动、时长/节奏、画面稳定性注意点、复跑检查点。",
      "不要输出寒暄，也不要说已经生成视频。"
    ].join("\n");
  }

  async function generateVideoQuickMode() {
    const shot = activeVideoShot.value;

    if (ui.marketplace.video.isGenerating) {
      return;
    }

    if (!shot) {
      setVideoFeedback("请先选择一个镜头。", "warning");
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setVideoFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    const requestId =
      typeof createLocalId === "function" ? createLocalId("video_model_request") : `video_model_request_${Date.now()}`;

    try {
      ui.marketplace.video.isGenerating = true;
      setVideoFeedback("正在生成快速方案...", "neutral");
      setStatus(`${VIDEO_APP_NAME}正在生成快速方案。`, "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.66,
        maxOutputTokens: 1800,
        messages: [
          {
            role: "system",
            content: VIDEO_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildVideoQuickPrompt()
          }
        ]
      });

      const output = String(result?.text ?? "").trim();
      shot.output = output;
      touchVideoShot(shot);
      setVideoFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "快速方案已生成。", "success");
      setStatus(`${VIDEO_APP_NAME}已生成快速方案。`, "success");
    } catch (error) {
      console.error("Failed to generate video quick mode", error);
      const message = getErrorMessage(error);
      setVideoFeedback(`生成失败：${message}`, "danger");
      setStatus(`${VIDEO_APP_NAME}生成失败：${message}`, "danger");
    } finally {
      ui.marketplace.video.isGenerating = false;
    }
  }

  function setVideoExportFeedback(text, tone = "neutral") {
    ui.marketplace.video.exportFeedback = String(text ?? "").trim();
    ui.marketplace.video.exportFeedbackTone = tone;
  }

  function openVideoExportDialog() {
    if (!activeVideoProject.value) {
      return;
    }

    ui.marketplace.video.isExportDialogOpen = true;
    setVideoExportFeedback("", "neutral");
  }

  function closeVideoExportDialog() {
    if (ui.marketplace.video.isExporting) {
      return;
    }

    ui.marketplace.video.isExportDialogOpen = false;
    setVideoExportFeedback("", "neutral");
  }

  async function selectVideoExportDirectory() {
    if (!desktopApi?.selectVideoProjectExportDirectory) {
      setVideoExportFeedback("当前桌面桥接暂不支持选择输出目录。", "danger");
      return;
    }

    try {
      const directoryPath = await desktopApi.selectVideoProjectExportDirectory();

      if (directoryPath) {
        ui.marketplace.video.exportDirectory = directoryPath;
        setVideoExportFeedback("", "neutral");
      }
    } catch (error) {
      console.error("Failed to select video export directory", error);
      setVideoExportFeedback(`选择目录失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function exportActiveVideoProject() {
    const project = activeVideoProject.value;

    if (!project || ui.marketplace.video.isExporting) {
      return;
    }

    if (!String(ui.marketplace.video.exportDirectory ?? "").trim()) {
      setVideoExportFeedback("请先选择输出目录。", "warning");
      return;
    }

    if (!desktopApi?.exportVideoProject) {
      setVideoExportFeedback("当前桌面桥接暂不支持导出视频项目。", "danger");
      return;
    }

    try {
      ui.marketplace.video.isExporting = true;
      setVideoExportFeedback("正在保存项目文件...", "neutral");

      const result = await desktopApi.exportVideoProject({
        directoryPath: ui.marketplace.video.exportDirectory,
        fileName: getVideoExportFileName(project),
        format: "md",
        content: buildVideoProjectExportContent(project)
      });

      ui.marketplace.video.isExportDialogOpen = false;
      setVideoExportFeedback("", "neutral");
      setStatus(`已导出视频项目：${result.fileName ?? activeVideoExportFileName.value}`, "success");
    } catch (error) {
      console.error("Failed to export video project", error);
      setVideoExportFeedback(`导出失败：${getErrorMessage(error)}`, "danger");
    } finally {
      ui.marketplace.video.isExporting = false;
    }
  }

  return {
    activeVideoAsset,
    activeVideoAssetMatchesTypeFilter,
    activeVideoAssetPreviewView,
    activeVideoAssets,
    activeVideoExportFileName,
    activeVideoProject,
    activeVideoShot,
    activeVideoShotIndex,
    activeVideoShots,
    activeVideoTabMeta,
    applyVideoProjectsFromStorage,
    backVideoMarketplace,
    backVideoShelf,
    canExportActiveVideoProject,
    addVideoAssetView,
    clearVideoAutosaveTimer,
    closeVideoExportDialog,
    createVideoAsset,
    createVideoProject,
    createVideoShot,
    deleteVideoAsset,
    deleteVideoProjectFromShelf,
    downloadVideoAssetViewImage,
    exportActiveVideoProject,
    filteredVideoAssets,
    filteredVideoShotEntries,
    generateVideoAssetViewImage,
    generateVideoQuickMode,
    getVideoAssetFilledViewCount,
    getVideoAssetReferenceOptions,
    getVideoAssetTypeLabel,
    getVideoAssetViewKindLabel,
    getVideoAssetViewReferenceOptions,
    getVideoFeedbackClass,
    getVideoProjectAspectRatioLabel,
    getVideoProjectModeLabel,
    getVideoShotDisplayTitle,
    getVideoShotStatusClass,
    getVideoShotStatusLabel,
    getVideoTotalDuration,
    goVideoShot,
    openVideoAppShelf,
    openVideoExportDialog,
    openVideoProject,
    persistVideoProjectById,
    previewVideoAssetView,
    removeVideoAssetView,
    selectVideoAsset,
    selectVideoExportDirectory,
    selectVideoShot,
    selectVideoShotFromPicker,
    setVideoAssetDescription,
    setVideoAssetName,
    setVideoAssetType,
    setVideoAssetTypeFilter,
    setVideoAssetViewField,
    setVideoIntroMode,
    setVideoProjectAspectRatio,
    setVideoProjectDurationSeconds,
    setVideoProjectGenre,
    setVideoProjectMode,
    setVideoProjectStoryboardPlan,
    setVideoProjectSummary,
    setVideoProjectTitle,
    setVideoProjectVisualStyle,
    setVideoShotDurationSeconds,
    setVideoShotNegativePrompt,
    setVideoShotOutput,
    setVideoShotPickerOpen,
    setVideoShotPrompt,
    setVideoShotReference,
    setVideoShotSummary,
    setVideoShotTitle,
    setVideoTab,
    submitVideoShot,
    toggleVideoAssetRail,
    toggleVideoProfileRail,
    toggleVideoShotPicker,
    videoProjects,
    touchVideoProject
  };
}
