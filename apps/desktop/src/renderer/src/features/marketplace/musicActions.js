import { computed } from "vue";

import { BUILTIN_GORDON_TOOLS_MCP_ID } from "../../lib/presenter.js";
import { WRITING_AUTOSAVE_DELAY } from "../writing/writingConfig.js";
import {
  MUSIC_APP_NAME,
  MUSIC_APP_TABS,
  MUSIC_CREATION_MODES,
  MUSIC_PROJECT_COVER_TONES,
  MUSIC_PROVIDER_META,
  MUSIC_TRACK_KIND_META,
  MUSIC_TRACK_STATUS_META
} from "./marketplaceConfig.js";

const MUSIC_SYSTEM_PROMPT = `你是 Gordon 应用广场里的「瑶琴映月」，负责音乐创作、歌词打磨、编曲策划和音乐生成提示词整理。
你需要像音乐制作人一样工作：先抓主题和情绪，再组织歌曲结构、曲风标签、乐器层次、节奏速度和可执行的生成提示词。
输出应适合作为后续 music_gen 工具或人工创作的输入，不要声称已经生成真实音频。
如果用户提供已有歌词或参考内容，需要保留其核心意图，并提升可唱性、画面感和段落推进。
输出中文，使用清晰小标题，按任务类型给出必要内容。`;
const NO_FILTERED_MUSIC_TRACK_ID = "__music_no_filtered_track__";

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function normalizeMusicText(value) {
  return String(value ?? "").trim();
}

function normalizeMusicTrackKindForUi(value) {
  const kind = String(value ?? "").trim();
  return MUSIC_TRACK_KIND_META[kind] ? kind : "song";
}

function normalizeMusicTrackStatusForUi(value) {
  const status = String(value ?? "").trim();
  return MUSIC_TRACK_STATUS_META[status] ? status : "draft";
}

function normalizeMusicProviderForUi(value) {
  const provider = String(value ?? "").trim();
  return MUSIC_PROVIDER_META[provider] ? provider : "manual";
}

function normalizeMusicDurationSeconds(value, fallback = 30) {
  const numeric = Number(value);
  return Math.min(3600, Math.max(0, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
}

function getMusicTracks(project) {
  return Array.isArray(project?.tracks) ? project.tracks : [];
}

function sanitizeMusicExportFileName(value) {
  const baseName = normalizeMusicText(value)
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名音乐专辑"}.md`;
}

function getMusicExportFileName(project) {
  return sanitizeMusicExportFileName(project?.title);
}

function appendMusicExportSection(lines, title, content, level = 2) {
  const normalizedContent = String(content ?? "").trim();

  if (!normalizedContent) {
    return;
  }

  lines.push(`${"#".repeat(Math.max(2, Math.min(6, level)))} ${title}`, "", normalizedContent, "");
}

function buildMusicProjectExportContent(project) {
  const tracks = getMusicTracks(project).sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0));
  const lines = [
    `# ${normalizeMusicText(project?.title) || "未命名音乐专辑"}`,
    "",
    `- 制作人：${normalizeMusicText(project?.artist) || "未填写"}`,
    `- 风格：${normalizeMusicText(project?.genre) || "未填写"}`,
    `- 情绪：${normalizeMusicText(project?.mood) || "未填写"}`,
    `- 状态：${normalizeMusicText(project?.status) || "未填写"}`,
    `- 曲目数量：${tracks.length}`,
    `- 总时长：${tracks.reduce((total, track) => total + normalizeMusicDurationSeconds(track?.durationSeconds, 0), 0)} 秒`,
    `- 更新时间：${normalizeMusicText(project?.updatedAt) || "未记录"}`,
    ""
  ];

  appendMusicExportSection(lines, "专辑方向", project?.summary);
  lines.push("## 曲目", "");

  if (!tracks.length) {
    lines.push("暂无曲目。", "");
  }

  tracks.forEach((track, index) => {
    const order = Number(track?.index ?? index + 1);
    lines.push(
      `### ${Number.isFinite(order) && order > 0 ? order : index + 1}. ${normalizeMusicText(track?.title) || "未命名曲目"}`,
      "",
      `- 类型：${MUSIC_TRACK_KIND_META[normalizeMusicTrackKindForUi(track?.kind)]?.label ?? "完整歌曲"}`,
      `- 状态：${MUSIC_TRACK_STATUS_META[normalizeMusicTrackStatusForUi(track?.status)]?.label ?? "草稿"}`,
      `- Provider：${MUSIC_PROVIDER_META[normalizeMusicProviderForUi(track?.provider)]?.label ?? "手动"}`,
      `- 模型：${normalizeMusicText(track?.model) || "未填写"}`,
      `- 任务 ID：${normalizeMusicText(track?.taskId) || "暂无"}`,
      `- 时长：${normalizeMusicDurationSeconds(track?.durationSeconds, 0)} 秒`,
      `- 音频地址：${normalizeMusicText(track?.audioUrl) || "暂无"}`,
      `- 流媒体地址：${normalizeMusicText(track?.streamUrl) || "暂无"}`,
      ""
    );
    appendMusicExportSection(lines, "生成提示词", track?.prompt, 4);
    appendMusicExportSection(lines, "曲风 / 情绪 / 场景", track?.style, 4);
    appendMusicExportSection(lines, "歌词 / 素材", track?.lyrics, 4);
    appendMusicExportSection(lines, "负向限制", track?.negativePrompt, 4);
    appendMusicExportSection(lines, "制作草案", track?.notes, 4);
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractMusicStructuredContent(toolResult) {
  if (toolResult?.structuredContent && typeof toolResult.structuredContent === "object") {
    return toolResult.structuredContent;
  }

  return {};
}

function extractMusicAudioArtifact(toolResult) {
  const structuredContent = extractMusicStructuredContent(toolResult);
  const artifacts = Array.isArray(structuredContent.artifacts) ? structuredContent.artifacts : [];
  return artifacts.find((artifact) => String(artifact?.kind ?? "") === "audio" && String(artifact?.url ?? "").trim()) ?? null;
}

function extractMusicTaskId(toolResult) {
  const structuredContent = extractMusicStructuredContent(toolResult);
  return normalizeMusicText(structuredContent.taskId);
}

function extractMusicStatus(toolResult) {
  const structuredContent = extractMusicStructuredContent(toolResult);
  return normalizeMusicText(structuredContent.status);
}

export function createMusicActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId,
  setStatus,
  showConfirmDialog,
  ui,
  workbench
}) {
  let musicAutosaveTimer = null;
  let musicSaveInFlight = false;
  let musicQueuedSaveProjectId = null;

  const musicProjects = computed(() => ui.marketplace.music.projects ?? []);
  const activeMusicProject = computed(
    () => musicProjects.value.find((project) => project.id === ui.marketplace.music.activeProjectId) ?? musicProjects.value[0] ?? null
  );
  const activeMusicTracks = computed(() => getMusicTracks(activeMusicProject.value));
  const activeMusicTrack = computed(
    () => {
      const track = activeMusicTracks.value.find((entry) => entry.id === ui.marketplace.music.activeTrackId) ?? null;

      if (track || ui.marketplace.music.activeTrackId === NO_FILTERED_MUSIC_TRACK_ID) {
        return track;
      }

      return activeMusicTracks.value[0] ?? null;
    }
  );
  const activeMusicModeMeta = computed(
    () => MUSIC_CREATION_MODES.find((mode) => mode.id === ui.marketplace.music.activeMode) ?? MUSIC_CREATION_MODES[0]
  );
  const activeMusicTabMeta = computed(
    () => MUSIC_APP_TABS.find((tab) => tab.id === ui.marketplace.music.activeTab) ?? MUSIC_APP_TABS[0]
  );
  const activeMusicTrackIndex = computed(() =>
    Math.max(
      0,
      activeMusicTracks.value.findIndex((track) => track.id === activeMusicTrack.value?.id)
    )
  );
  const filteredMusicTrackEntries = computed(() => getFilteredMusicTrackEntries(activeMusicTracks.value, ui.marketplace.music.trackFilter));
  const activeMusicDraftCount = computed(() =>
    activeMusicTracks.value.filter((track) => normalizeMusicTrackStatusForUi(track.status) === "draft").length
  );
  const activeMusicFinishedCount = computed(() =>
    activeMusicTracks.value.filter((track) => normalizeMusicTrackStatusForUi(track.status) === "finished").length
  );
  const activeMusicExportFileName = computed(() => getMusicExportFileName(activeMusicProject.value));
  const canExportActiveMusicProject = computed(
    () =>
      Boolean(
        activeMusicProject.value &&
          String(ui.marketplace.music.exportDirectory ?? "").trim() &&
          !ui.marketplace.music.isExporting
      )
  );

  function normalizeMusicTrackForUi(track, index = 0) {
    const now = new Date().toISOString();
    const createdAt = normalizeMusicText(track?.createdAt) || now;

    return {
      id: normalizeMusicText(track?.id) || createLocalId("music_track"),
      index: Math.max(1, Math.round(Number(track?.index ?? index + 1) || index + 1)),
      title: normalizeMusicText(track?.title) || `曲目 ${index + 1}`,
      kind: normalizeMusicTrackKindForUi(track?.kind),
      status: normalizeMusicTrackStatusForUi(track?.status),
      prompt: String(track?.prompt ?? ""),
      lyrics: String(track?.lyrics ?? ""),
      style: String(track?.style ?? ""),
      negativePrompt: String(track?.negativePrompt ?? ""),
      provider: normalizeMusicProviderForUi(track?.provider),
      model: normalizeMusicText(track?.model),
      taskId: normalizeMusicText(track?.taskId),
      audioUrl: normalizeMusicText(track?.audioUrl),
      streamUrl: normalizeMusicText(track?.streamUrl),
      coverUrl: normalizeMusicText(track?.coverUrl),
      durationSeconds: normalizeMusicDurationSeconds(track?.durationSeconds, 30),
      notes: String(track?.notes ?? ""),
      ...(track?.rawResult && typeof track.rawResult === "object" ? { rawResult: track.rawResult } : {}),
      createdAt,
      updatedAt: normalizeMusicText(track?.updatedAt) || createdAt
    };
  }

  function normalizeMusicTracksForUi(tracks = []) {
    return (Array.isArray(tracks) ? tracks : [])
      .map((track, index) => normalizeMusicTrackForUi(track, index))
      .sort((left, right) => left.index - right.index);
  }

  function normalizeMusicProjectForUi(project, index = 0) {
    const now = new Date().toISOString();
    const createdAt = normalizeMusicText(project?.createdAt) || now;

    return {
      id: normalizeMusicText(project?.id) || createLocalId("music_project"),
      title: normalizeMusicText(project?.title) || `未命名专辑 ${index + 1}`,
      artist: normalizeMusicText(project?.artist) || "Gordon Studio",
      genre: normalizeMusicText(project?.genre) || "音乐 / 待定风格",
      mood: normalizeMusicText(project?.mood) || "待定",
      status: normalizeMusicText(project?.status) || "草稿",
      summary: String(project?.summary ?? ""),
      coverTone:
        normalizeMusicText(project?.coverTone) ||
        MUSIC_PROJECT_COVER_TONES[index % MUSIC_PROJECT_COVER_TONES.length] ||
        "lunar",
      tracks: normalizeMusicTracksForUi(project?.tracks),
      createdAt,
      updatedAt: normalizeMusicText(project?.updatedAt) || createdAt
    };
  }

  function normalizeMusicProjectsForUi(projects = []) {
    return (Array.isArray(projects) ? projects : []).map((project, index) => normalizeMusicProjectForUi(project, index));
  }

  function applyMusicProjectsFromStorage(projects = [], options = {}) {
    const normalizedProjects = normalizeMusicProjectsForUi(projects);
    const preferredProjectId = options.preferProjectId ?? ui.marketplace.music.activeProjectId;
    const nextProject =
      normalizedProjects.find((project) => project.id === preferredProjectId) ?? normalizedProjects[0] ?? null;

    workbench.musicProjects = normalizedProjects;
    ui.marketplace.music.projects = normalizedProjects;
    ui.marketplace.music.activeProjectId = nextProject?.id ?? null;

    if (nextProject && !nextProject.tracks.some((track) => track.id === ui.marketplace.music.activeTrackId)) {
      ui.marketplace.music.activeTrackId = nextProject.tracks[0]?.id ?? "";
    } else if (!nextProject) {
      ui.marketplace.music.activeTrackId = "";
    }

    if (!nextProject && ui.marketplace.view === "musicDetail") {
      ui.marketplace.view = "musicShelf";
    }
  }

  function buildMusicProjectSavePayload(project) {
    return {
      id: project.id,
      title: project.title,
      artist: project.artist,
      genre: project.genre,
      mood: project.mood,
      status: project.status,
      summary: project.summary,
      coverTone: project.coverTone,
      tracks: getMusicTracks(project).map((track, index) => ({
        ...normalizeMusicTrackForUi(track, index),
        updatedAt: track.updatedAt
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
  }

  function clearMusicAutosaveTimer() {
    if (musicAutosaveTimer) {
      clearTimeout(musicAutosaveTimer);
      musicAutosaveTimer = null;
    }
  }

  function scheduleMusicProjectAutosave(projectId) {
    if (!desktopApi?.upsertMusicProject || !projectId) {
      return;
    }

    clearMusicAutosaveTimer();
    musicAutosaveTimer = setTimeout(() => {
      musicAutosaveTimer = null;
      void persistMusicProjectById(projectId, { silent: true });
    }, WRITING_AUTOSAVE_DELAY);
  }

  function touchMusicProject(project, options = {}) {
    if (!project) {
      return;
    }

    project.updatedAt = new Date().toISOString();

    if (options.persist !== false) {
      scheduleMusicProjectAutosave(project.id);
    }
  }

  function touchMusicTrack(track, options = {}) {
    const project = activeMusicProject.value;

    if (!project || !track) {
      return;
    }

    track.updatedAt = new Date().toISOString();

    if (track.status === "draft" && String(track.audioUrl ?? "").trim()) {
      track.status = "finished";
    }

    touchMusicProject(project, options);
  }

  async function persistMusicProjectById(projectId, options = {}) {
    if (!desktopApi?.upsertMusicProject || !projectId) {
      return;
    }

    if (musicSaveInFlight) {
      musicQueuedSaveProjectId = projectId;
      return;
    }

    const project = musicProjects.value.find((entry) => entry.id === projectId);

    if (!project) {
      return;
    }

    musicSaveInFlight = true;

    try {
      const savedProjects = await desktopApi.upsertMusicProject(buildMusicProjectSavePayload(project));
      applyMusicProjectsFromStorage(savedProjects, { preferProjectId: projectId });

      if (!options.silent) {
        setStatus("音乐专辑已写入本地。", "success");
      }
    } catch (error) {
      console.error("Failed to save music project", error);

      if (!options.silent) {
        setStatus(`音乐专辑保存失败：${getErrorMessage(error)}`, "danger");
      }
    } finally {
      musicSaveInFlight = false;

      const queuedProjectId = musicQueuedSaveProjectId;
      musicQueuedSaveProjectId = null;

      if (queuedProjectId) {
        void persistMusicProjectById(queuedProjectId, { silent: true });
      }
    }
  }

  function setMusicFeedback(text, tone = "neutral") {
    ui.marketplace.music.feedback = normalizeMusicText(text);
    ui.marketplace.music.feedbackTone = tone;
  }

  function openMusicApp() {
    writeRef(activeFeature, featureMarketplaceId);
    ui.marketplace.view = "musicShelf";

    if (!ui.marketplace.music.activeProjectId && musicProjects.value.length) {
      ui.marketplace.music.activeProjectId = musicProjects.value[0].id;
    }
  }

  function backMusicMarketplace() {
    ui.marketplace.view = "apps";
  }

  function openMusicProject(projectId) {
    const project = musicProjects.value.find((entry) => entry.id === projectId) ?? null;

    if (!project) {
      return;
    }

    ui.marketplace.music.activeProjectId = project.id;
    ui.marketplace.music.activeTrackId = project.tracks[0]?.id ?? "";
    ui.marketplace.music.isAiDrawerOpen = false;
    setMusicFeedback("", "neutral");
    ui.marketplace.view = "musicDetail";
  }

  function backMusicShelf() {
    ui.marketplace.view = "musicShelf";
    ui.marketplace.music.isAiDrawerOpen = false;
    setMusicFeedback("", "neutral");
  }

  async function createMusicProject() {
    const now = new Date().toISOString();
    const project = {
      id: createLocalId("music_project"),
      title: `未命名专辑 ${musicProjects.value.length + 1}`,
      artist: "Gordon Studio",
      genre: "音乐 / 待定风格",
      mood: "月色、流动、留白",
      status: "草稿",
      summary: "写下这张专辑的主题、听感、使用场景和曲目方向。",
      coverTone: MUSIC_PROJECT_COVER_TONES[musicProjects.value.length % MUSIC_PROJECT_COVER_TONES.length] || "lunar",
      tracks: [],
      createdAt: now,
      updatedAt: now
    };

    ui.marketplace.music.projects = [project, ...musicProjects.value];
    workbench.musicProjects = ui.marketplace.music.projects;
    ui.marketplace.music.activeProjectId = project.id;
    ui.marketplace.music.activeTrackId = "";
    ui.marketplace.music.isAiDrawerOpen = false;
    ui.marketplace.view = "musicDetail";
    setStatus("已创建一个音乐专辑，正在写入本地项目库。", "success");
    await persistMusicProjectById(project.id, { silent: false });
    createMusicTrack();
  }

  async function deleteMusicProjectFromWorkbench(projectId) {
    if (!desktopApi?.deleteMusicProject) {
      setStatus("音乐项目仓储未就绪，暂时无法删除。", "danger");
      return;
    }

    const project = musicProjects.value.find((entry) => entry.id === projectId) ?? null;
    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除音乐专辑",
      message: `确认删除「${project?.title ?? "当前专辑"}」吗？专辑快照会移入系统回收站。`,
      detail: "删除后会从瑶琴映月移除，可在系统回收站中找回备份文件。",
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    clearMusicAutosaveTimer();

    if (musicQueuedSaveProjectId === projectId) {
      musicQueuedSaveProjectId = null;
    }

    try {
      const savedProjects = await desktopApi.deleteMusicProject(projectId);
      applyMusicProjectsFromStorage(savedProjects, {
        preferProjectId: ui.marketplace.music.activeProjectId === projectId ? "" : ui.marketplace.music.activeProjectId
      });
      setStatus("音乐专辑已移入系统回收站。", "success");
    } catch (error) {
      console.error("Failed to delete music project", error);
      setStatus(`音乐专辑删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function selectMusicProject(projectId) {
    const project = musicProjects.value.find((entry) => entry.id === projectId) ?? null;

    if (!project) {
      return;
    }

    ui.marketplace.music.activeProjectId = project.id;
    ui.marketplace.music.activeTrackId = project.tracks[0]?.id ?? "";
  }

  function createMusicTrack(kind = ui.marketplace.music.activeMode) {
    const project = activeMusicProject.value;

    if (!project) {
      return;
    }

    const now = new Date().toISOString();
    const tracks = getMusicTracks(project);
    const normalizedKind = normalizeMusicTrackKindForUi(kind);
    const track = {
      id: createLocalId("music_track"),
      index: tracks.length + 1,
      title: normalizedKind === "instrumental" ? `纯音乐 ${tracks.length + 1}` : `曲目 ${tracks.length + 1}`,
      kind: normalizedKind,
      status: "draft",
      prompt: ui.marketplace.music.theme || "写下这首曲子的主题、画面、情绪和结构。",
      lyrics: normalizedKind === "song" ? ui.marketplace.music.reference : "",
      style: ui.marketplace.music.style || "国风流行 / 电影感 / 细腻人声",
      negativePrompt: "低清晰度、杂音、刺耳高频、跑调、人声含混、水印、过度压缩",
      provider: "manual",
      model: "",
      taskId: "",
      audioUrl: "",
      streamUrl: "",
      coverUrl: "",
      durationSeconds: normalizedKind === "jingle" ? 15 : 90,
      notes: "",
      createdAt: now,
      updatedAt: now
    };

    project.tracks = [...tracks, track];
    ui.marketplace.music.activeTrackId = track.id;
    ui.marketplace.music.activeMode = normalizedKind;
    ui.marketplace.music.activeTab = "draft";
    ui.marketplace.music.trackFilter = "draft";
    touchMusicProject(project);
  }

  function setMusicMode(modeId) {
    ui.marketplace.music.activeMode = MUSIC_CREATION_MODES.some((mode) => mode.id === modeId) ? modeId : "song";
    ui.marketplace.music.isAiTaskPickerOpen = false;
    const track = activeMusicTrack.value;

    if (track) {
      track.kind = normalizeMusicTrackKindForUi(modeId);
      touchMusicTrack(track);
    }

    setMusicFeedback("", "neutral");
  }

  function setMusicProjectField(field, value) {
    const project = activeMusicProject.value;

    if (!project) {
      return;
    }

    project[field] = String(value ?? "");
    touchMusicProject(project);
  }

  function setMusicProjectTitle(value) {
    setMusicProjectField("title", value);
  }

  function setMusicProjectArtist(value) {
    setMusicProjectField("artist", value);
  }

  function setMusicProjectGenre(value) {
    setMusicProjectField("genre", value);
  }

  function setMusicProjectMood(value) {
    setMusicProjectField("mood", value);
  }

  function setMusicProjectStatus(value) {
    setMusicProjectField("status", value);
  }

  function setMusicProjectSummary(value) {
    setMusicProjectField("summary", value);
  }

  function setMusicTrackField(track, field, value) {
    if (!track) {
      return;
    }

    if (field === "kind") {
      track.kind = normalizeMusicTrackKindForUi(value);
      ui.marketplace.music.activeMode = track.kind;
    } else if (field === "status") {
      track.status = normalizeMusicTrackStatusForUi(value);
    } else if (field === "durationSeconds") {
      track.durationSeconds = normalizeMusicDurationSeconds(value, track.durationSeconds);
    } else if (field === "provider") {
      track.provider = normalizeMusicProviderForUi(value);
    } else {
      track[field] = String(value ?? "");
    }

    touchMusicTrack(track);
  }

  function selectMusicTrack(trackId) {
    const track = activeMusicTracks.value.find((entry) => entry.id === trackId) ?? null;

    if (!track) {
      return;
    }

    ui.marketplace.music.activeTrackId = track.id;
    ui.marketplace.music.activeMode = normalizeMusicTrackKindForUi(track.kind);
  }

  function setMusicTrackFilter(filter) {
    const normalizedFilter = ["all", "draft", "finished"].includes(filter) ? filter : "all";
    ui.marketplace.music.trackFilter = normalizedFilter;
    ui.marketplace.music.activeTab = MUSIC_APP_TABS.find((tab) => tab.filter === normalizedFilter)?.id ?? "all";
    const nextEntries = getFilteredMusicTrackEntries(activeMusicTracks.value, normalizedFilter);

    if (!nextEntries.some((entry) => entry.track.id === ui.marketplace.music.activeTrackId)) {
      ui.marketplace.music.activeTrackId = nextEntries[0]?.track.id ?? NO_FILTERED_MUSIC_TRACK_ID;
    }
  }

  function setMusicTab(tabId) {
    const tab = MUSIC_APP_TABS.find((entry) => entry.id === tabId) ?? MUSIC_APP_TABS[0];
    ui.marketplace.music.activeTab = tab.id;
    ui.marketplace.music.trackFilter = tab.filter;
  }

  function toggleMusicAiTaskPicker() {
    ui.marketplace.music.isAiTaskPickerOpen = !ui.marketplace.music.isAiTaskPickerOpen;
  }

  function setMusicGenerationProvider(provider) {
    ui.marketplace.music.generationProvider = ["mureka", "suno"].includes(provider) ? provider : "";
  }

  function setMusicCallbackUrl(value) {
    ui.marketplace.music.callbackUrl = String(value ?? "");
  }

  function setMusicTheme(value) {
    ui.marketplace.music.theme = String(value ?? "");

    if (activeMusicTrack.value) {
      setMusicTrackField(activeMusicTrack.value, "prompt", value);
    }
  }

  function setMusicStyle(value) {
    ui.marketplace.music.style = String(value ?? "");

    if (activeMusicTrack.value) {
      setMusicTrackField(activeMusicTrack.value, "style", value);
    }
  }

  function setMusicReference(value) {
    ui.marketplace.music.reference = String(value ?? "");

    if (activeMusicTrack.value) {
      setMusicTrackField(activeMusicTrack.value, "lyrics", value);
    }
  }

  function clearMusicOutput() {
    ui.marketplace.music.output = "";
    const track = activeMusicTrack.value;

    if (track) {
      track.notes = "";
      touchMusicTrack(track);
    }

    setMusicFeedback("", "neutral");
  }

  function setMusicExportFeedback(text, tone = "neutral") {
    ui.marketplace.music.exportFeedback = normalizeMusicText(text);
    ui.marketplace.music.exportFeedbackTone = tone;
  }

  function openMusicExportDialog() {
    if (!activeMusicProject.value) {
      return;
    }

    ui.marketplace.music.isExportDialogOpen = true;
    setMusicExportFeedback("", "neutral");
  }

  function closeMusicExportDialog() {
    if (ui.marketplace.music.isExporting) {
      return;
    }

    ui.marketplace.music.isExportDialogOpen = false;
    setMusicExportFeedback("", "neutral");
  }

  async function selectMusicExportDirectory() {
    if (!desktopApi?.selectMusicProjectExportDirectory) {
      setMusicExportFeedback("当前桌面桥接暂不支持选择输出目录。", "danger");
      return;
    }

    try {
      const directoryPath = await desktopApi.selectMusicProjectExportDirectory();

      if (directoryPath) {
        ui.marketplace.music.exportDirectory = directoryPath;
        setMusicExportFeedback("", "neutral");
      }
    } catch (error) {
      console.error("Failed to select music export directory", error);
      setMusicExportFeedback(`选择目录失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function exportActiveMusicProject() {
    const project = activeMusicProject.value;

    if (!project || ui.marketplace.music.isExporting) {
      return;
    }

    if (!String(ui.marketplace.music.exportDirectory ?? "").trim()) {
      setMusicExportFeedback("请先选择输出目录。", "warning");
      return;
    }

    if (!desktopApi?.exportMusicProject) {
      setMusicExportFeedback("当前桌面桥接暂不支持导出音乐专辑。", "danger");
      return;
    }

    try {
      ui.marketplace.music.isExporting = true;
      setMusicExportFeedback("正在保存专辑文件...", "neutral");

      const result = await desktopApi.exportMusicProject({
        directoryPath: ui.marketplace.music.exportDirectory,
        fileName: getMusicExportFileName(project),
        format: "md",
        content: buildMusicProjectExportContent(project)
      });

      ui.marketplace.music.isExportDialogOpen = false;
      setMusicExportFeedback("", "neutral");
      setStatus(`已导出音乐专辑：${result.fileName ?? activeMusicExportFileName.value}`, "success");
    } catch (error) {
      console.error("Failed to export music project", error);
      setMusicExportFeedback(`导出失败：${getErrorMessage(error)}`, "danger");
    } finally {
      ui.marketplace.music.isExporting = false;
    }
  }

  function getMusicFeedbackClass() {
    return ui.marketplace.music.feedbackTone ? `is-${ui.marketplace.music.feedbackTone}` : "";
  }

  function getMusicTrackDisplayTitle(track, index = 0) {
    const order = Number(track?.index ?? index + 1);
    const title = normalizeMusicText(track?.title);
    return `${Number.isFinite(order) && order > 0 ? order : index + 1}. ${title || "未命名曲目"}`;
  }

  function getMusicTrackKindLabel(kind) {
    return MUSIC_TRACK_KIND_META[normalizeMusicTrackKindForUi(kind)]?.label ?? "完整歌曲";
  }

  function getMusicTrackStatusLabel(status) {
    return MUSIC_TRACK_STATUS_META[normalizeMusicTrackStatusForUi(status)]?.label ?? "草稿";
  }

  function getMusicTrackStatusClass(status) {
    return MUSIC_TRACK_STATUS_META[normalizeMusicTrackStatusForUi(status)]?.className ?? "is-warning";
  }

  function getMusicProviderLabel(provider) {
    return MUSIC_PROVIDER_META[normalizeMusicProviderForUi(provider)]?.label ?? "手动";
  }

  function getMusicProjectDraftCount(project) {
    return getMusicTracks(project).filter((track) => normalizeMusicTrackStatusForUi(track.status) === "draft").length;
  }

  function getMusicProjectFinishedCount(project) {
    return getMusicTracks(project).filter((track) => normalizeMusicTrackStatusForUi(track.status) === "finished").length;
  }

  function getMusicTotalDuration(project) {
    return getMusicTracks(project).reduce((total, track) => total + normalizeMusicDurationSeconds(track.durationSeconds, 0), 0);
  }

  function getFilteredMusicTrackEntries(tracks, filter) {
    const normalizedFilter = ["draft", "finished"].includes(filter) ? filter : "all";

    return (Array.isArray(tracks) ? tracks : [])
      .map((track, index) => ({
        track,
        index,
        title: getMusicTrackDisplayTitle(track, index)
      }))
      .filter((entry) => normalizedFilter === "all" || normalizeMusicTrackStatusForUi(entry.track?.status) === normalizedFilter);
  }

  function buildMusicPrompt() {
    const mode = activeMusicModeMeta.value;
    const track = activeMusicTrack.value;
    const theme = normalizeMusicText(track?.prompt) || normalizeMusicText(ui.marketplace.music.theme) || mode.placeholder;
    const style = normalizeMusicText(track?.style) || normalizeMusicText(ui.marketplace.music.style) || "未指定，请根据主题给出合适曲风";
    const reference = normalizeMusicText(track?.lyrics) || normalizeMusicText(ui.marketplace.music.reference) || "未提供";
    const project = activeMusicProject.value;

    return [
      `专辑：${project?.title ?? "未命名专辑"}`,
      `专辑方向：${project?.summary || "未填写"}`,
      `创作类型：${mode.label}`,
      `创作重点：${mode.focus}`,
      `曲目：${track?.title ?? "未命名曲目"}`,
      `主题 / 需求：${theme}`,
      `曲风 / 情绪 / 场景：${style}`,
      `参考歌词 / 素材：${reference}`,
      "",
      "请给出可以直接进入音乐制作或 music_gen 工具调用前准备的结果。",
      "如适用，请包含：歌名、曲风标签、BPM/速度建议、段落结构、歌词、编曲说明、music_gen 正向提示词、限制/负向提示词、复听检查点。"
    ].join("\n");
  }

  async function generateMusicDraft() {
    const track = activeMusicTrack.value;

    if (ui.marketplace.music.isGenerating) {
      return;
    }

    if (!track) {
      setMusicFeedback("请先新建一个曲目草稿。", "warning");
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setMusicFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    const mode = activeMusicModeMeta.value;
    const requestId =
      typeof createLocalId === "function" ? createLocalId("music_model_request") : `music_model_request_${Date.now()}`;

    try {
      ui.marketplace.music.isGenerating = true;
      ui.marketplace.music.output = "";
      setMusicFeedback("正在谱写草案...", "neutral");
      setStatus(`${MUSIC_APP_NAME}正在生成${mode.label}。`, "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.78,
        maxOutputTokens: 1900,
        messages: [
          {
            role: "system",
            content: MUSIC_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildMusicPrompt()
          }
        ]
      });

      const output = normalizeMusicText(result?.text);
      ui.marketplace.music.output = output;
      track.notes = output;
      touchMusicTrack(track);
      setMusicFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "音乐草案已生成。", "success");
      setStatus(`${MUSIC_APP_NAME}已生成音乐草案。`, "success");
    } catch (error) {
      console.error("Failed to generate music draft", error);
      const message = getErrorMessage(error);
      setMusicFeedback(`生成失败：${message}`, "danger");
      setStatus(`${MUSIC_APP_NAME}生成失败：${message}`, "danger");
    } finally {
      ui.marketplace.music.isGenerating = false;
    }
  }

  function buildMusicToolArguments(track, operation) {
    return {
      operation,
      ...(ui.marketplace.music.generationProvider ? { provider: ui.marketplace.music.generationProvider } : {}),
      prompt: track.prompt,
      lyrics: track.lyrics,
      style: track.style,
      title: track.title,
      model: track.model,
      instrumental: operation !== "generate_song",
      taskId: track.taskId,
      callbackUrl: ui.marketplace.music.callbackUrl,
      negativePrompt: track.negativePrompt,
      durationSeconds: track.durationSeconds
    };
  }

  function applyMusicToolResultToTrack(track, toolResult) {
    const structuredContent = extractMusicStructuredContent(toolResult);
    const artifact = extractMusicAudioArtifact(toolResult);
    const taskId = extractMusicTaskId(toolResult);
    const status = extractMusicStatus(toolResult);

    if (taskId) {
      track.taskId = taskId;
    }

    if (artifact) {
      const metadata = artifact.metadata && typeof artifact.metadata === "object" ? artifact.metadata : {};
      track.audioUrl = normalizeMusicText(artifact.url);
      track.streamUrl = normalizeMusicText(metadata.streamUrl) || track.streamUrl;
      track.coverUrl = normalizeMusicText(metadata.coverUrl) || track.coverUrl;
      track.durationSeconds = normalizeMusicDurationSeconds(metadata.durationSeconds, track.durationSeconds);
      track.status = "finished";
    }

    const provider = normalizeMusicText(structuredContent.provider);
    const model = normalizeMusicText(structuredContent.model);

    if (provider) {
      track.provider = normalizeMusicProviderForUi(provider);
    }

    if (model) {
      track.model = model;
    }

    track.rawResult = structuredContent.result && typeof structuredContent.result === "object" ? structuredContent.result : structuredContent;
    track.notes = [
      track.notes,
      status ? `任务状态：${status}` : "",
      artifact ? `音频地址：${artifact.url}` : ""
    ]
      .map((line) => String(line ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
    touchMusicTrack(track);
  }

  async function callMusicGeneration() {
    const track = activeMusicTrack.value;

    if (ui.marketplace.music.isCallingTool) {
      return;
    }

    if (!track) {
      setMusicFeedback("请先选择一个曲目草稿。", "warning");
      return;
    }

    if (!desktopApi?.callMcpServerTool) {
      setMusicFeedback("Gordon Tools 桥接未就绪。", "danger");
      return;
    }

    const operation = MUSIC_TRACK_KIND_META[normalizeMusicTrackKindForUi(track.kind)]?.operation ?? "generate_song";

    try {
      ui.marketplace.music.isCallingTool = true;
      setMusicFeedback("正在调用 music_gen 发起生成任务...", "neutral");
      setStatus(`${MUSIC_APP_NAME}正在调用 music_gen。`, "neutral");

      const toolResult = await desktopApi.callMcpServerTool({
        serverId: BUILTIN_GORDON_TOOLS_MCP_ID,
        toolName: "music_gen",
        arguments: buildMusicToolArguments(track, operation)
      });

      if (toolResult?.isError) {
        throw new Error(normalizeMusicText(toolResult.contentText) || "music_gen 调用失败");
      }

      applyMusicToolResultToTrack(track, toolResult);
      const artifact = extractMusicAudioArtifact(toolResult);
      const taskId = extractMusicTaskId(toolResult);
      setMusicFeedback(artifact ? "音乐成品已回填到曲目播放器。" : taskId ? `生成任务已提交：${taskId}` : "生成任务已提交。", "success");
      setStatus(artifact ? `${MUSIC_APP_NAME}已生成音频。` : `${MUSIC_APP_NAME}已提交音乐生成任务。`, "success");
    } catch (error) {
      console.error("Failed to call music_gen", error);
      const message = getErrorMessage(error);
      setMusicFeedback(`生成失败：${message}`, "danger");
      setStatus(`${MUSIC_APP_NAME}生成失败：${message}`, "danger");
    } finally {
      ui.marketplace.music.isCallingTool = false;
    }
  }

  async function queryMusicGeneration() {
    const track = activeMusicTrack.value;

    if (ui.marketplace.music.isCallingTool) {
      return;
    }

    if (!track?.taskId) {
      setMusicFeedback("当前曲目还没有任务 ID。", "warning");
      return;
    }

    if (!desktopApi?.callMcpServerTool) {
      setMusicFeedback("Gordon Tools 桥接未就绪。", "danger");
      return;
    }

    try {
      ui.marketplace.music.isCallingTool = true;
      setMusicFeedback("正在查询生成结果...", "neutral");

      const toolResult = await desktopApi.callMcpServerTool({
        serverId: BUILTIN_GORDON_TOOLS_MCP_ID,
        toolName: "music_gen",
        arguments: {
          operation: "query",
          ...(ui.marketplace.music.generationProvider ? { provider: ui.marketplace.music.generationProvider } : {}),
          taskId: track.taskId
        }
      });

      if (toolResult?.isError) {
        throw new Error(normalizeMusicText(toolResult.contentText) || "music_gen 查询失败");
      }

      applyMusicToolResultToTrack(track, toolResult);
      const artifact = extractMusicAudioArtifact(toolResult);
      const status = extractMusicStatus(toolResult);
      setMusicFeedback(artifact ? "已取得音频结果。" : status ? `任务状态：${status}` : "已查询任务。", artifact ? "success" : "neutral");
    } catch (error) {
      console.error("Failed to query music_gen", error);
      const message = getErrorMessage(error);
      setMusicFeedback(`查询失败：${message}`, "danger");
      setStatus(`${MUSIC_APP_NAME}查询失败：${message}`, "danger");
    } finally {
      ui.marketplace.music.isCallingTool = false;
    }
  }

  function markMusicTrackStatus(status) {
    const track = activeMusicTrack.value;

    if (!track) {
      return;
    }

    track.status = normalizeMusicTrackStatusForUi(status);
    touchMusicTrack(track);
  }

  function toggleMusicProfileRail() {
    ui.marketplace.music.isProfileCollapsed = !ui.marketplace.music.isProfileCollapsed;
  }

  function setMusicAiDrawerOpen(isOpen) {
    ui.marketplace.music.isAiDrawerOpen = Boolean(isOpen);
  }

  return {
    activeMusicDraftCount,
    activeMusicExportFileName,
    activeMusicFinishedCount,
    activeMusicModeMeta,
    activeMusicProject,
    activeMusicTabMeta,
    activeMusicTrack,
    activeMusicTrackIndex,
    activeMusicTracks,
    applyMusicProjectsFromStorage,
    backMusicMarketplace,
    backMusicShelf,
    callMusicGeneration,
    canExportActiveMusicProject,
    clearMusicAutosaveTimer,
    clearMusicOutput,
    closeMusicExportDialog,
    createMusicProject,
    createMusicTrack,
    deleteMusicProjectFromWorkbench,
    exportActiveMusicProject,
    filteredMusicTrackEntries,
    generateMusicDraft,
    getMusicFeedbackClass,
    getMusicProviderLabel,
    getMusicProjectDraftCount,
    getMusicProjectFinishedCount,
    getMusicTotalDuration,
    getMusicTrackDisplayTitle,
    getMusicTrackKindLabel,
    getMusicTrackStatusClass,
    getMusicTrackStatusLabel,
    markMusicTrackStatus,
    musicProjects,
    openMusicExportDialog,
    openMusicApp,
    openMusicProject,
    queryMusicGeneration,
    selectMusicProject,
    selectMusicExportDirectory,
    selectMusicTrack,
    setMusicCallbackUrl,
    setMusicGenerationProvider,
    setMusicMode,
    setMusicProjectArtist,
    setMusicProjectGenre,
    setMusicProjectMood,
    setMusicProjectStatus,
    setMusicProjectSummary,
    setMusicProjectTitle,
    setMusicReference,
    setMusicStyle,
    setMusicTheme,
    setMusicTrackField,
    setMusicTrackFilter,
    setMusicTab,
    setMusicAiDrawerOpen,
    toggleMusicAiTaskPicker,
    toggleMusicProfileRail
  };
}
