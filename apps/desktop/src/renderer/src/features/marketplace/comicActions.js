import { computed } from "vue";

import { WRITING_AUTOSAVE_DELAY } from "../writing/writingConfig.js";
import {
  COMIC_APP_TABS,
  COMIC_CHAPTER_STATUS_META,
  COMIC_PROJECT_COVER_TONES,
  COMIC_PROJECT_FORMAT_META,
  COMIC_PROJECT_PALETTE_META
} from "./marketplaceConfig.js";

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

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

  const comicProjects = computed(() => ui.marketplace.comic.projects ?? []);
  const activeComicProject = computed(
    () => comicProjects.value.find((project) => project.id === ui.marketplace.comic.activeProjectId) ?? comicProjects.value[0] ?? null
  );
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

  function normalizeComicChapterForUi(chapter, index = 0) {
    const now = new Date().toISOString();

    return {
      id: String(chapter?.id ?? "").trim() || createLocalId("comic_chapter"),
      index: Math.max(1, Math.round(Number(chapter?.index ?? index + 1) || index + 1)),
      title: String(chapter?.title ?? "").trim() || `第 ${index + 1} 章`,
      summary: String(chapter?.summary ?? ""),
      prompt: String(chapter?.prompt ?? ""),
      content: String(chapter?.content ?? ""),
      status: normalizeComicChapterStatusForUi(chapter?.status),
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
          title: "开场分镜",
          summary: "写下这一章的场景目标、镜头顺序、角色动作和结尾画面。",
          prompt: "基于总介绍生成开场分镜，明确画面、动作、对白和页数。",
          content: "",
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
      chapters: normalizeComicChaptersForUi(project?.chapters),
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
  }

  function buildComicProjectSavePayload(project) {
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
      chapters: getComicChapters(project).map((chapter, index) => ({
        ...normalizeComicChapterForUi(chapter, index),
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

    if (options.persist !== false) {
      scheduleComicProjectAutosave(project.id);
    }
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

    comicSaveInFlight = true;

    try {
      const savedProjects = await desktopApi.upsertComicProject(buildComicProjectSavePayload(project));
      applyComicProjectsFromStorage(savedProjects, { preferProjectId: projectId });

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

  function getComicChapterDisplayTitle(chapter, index = 0) {
    const order = Number(chapter?.index ?? index + 1);
    const title = String(chapter?.title ?? "").trim();
    return `第 ${Number.isFinite(order) && order > 0 ? order : index + 1} 章 ${title || "未命名分镜"}`;
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

    lines.push("## 目录", "");

    if (chapters.length) {
      chapters.forEach((chapter, index) => {
        const title = getComicChapterDisplayTitle(chapter, index);
        const chapterSummary = trimComicExportTextBlock(chapter.summary ?? "") || "暂无分镜简介";
        lines.push(`- ${title}（${getComicChapterStatusLabel(chapter.status)}）：${chapterSummary}`);
      });
    } else {
      lines.push("- 暂无章节");
    }

    lines.push("", "## 单章生成", "");

    chapters.forEach((chapter, index) => {
      const title = getComicChapterDisplayTitle(chapter, index);
      const chapterSummary = trimComicExportTextBlock(chapter.summary ?? "");
      const prompt = trimComicExportTextBlock(chapter.prompt ?? "");
      const content = trimComicExportTextBlock(chapter.content ?? "");

      lines.push(`### ${title}`, "");

      if (chapterSummary) {
        lines.push("#### 分镜简介", "", chapterSummary, "");
      }

      if (prompt) {
        lines.push("#### 生成提示词", "", prompt, "");
      }

      lines.push("#### 生成稿", "", content || "暂无生成稿", "");
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
    const project = comicProjects.value.find((entry) => entry.id === projectId) ?? null;
    ui.marketplace.comic.activeChapterId = getComicChapters(project)[0]?.id ?? "";
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
      chapters: [
        {
          id: createLocalId("comic_chapter"),
          index: 1,
          title: "开场分镜",
          summary: "写下这一章的场景目标、镜头顺序、角色动作和结尾画面。",
          prompt: "基于总介绍生成开场分镜，明确画面、动作、对白和页数。",
          content: "",
          status: "inProgress",
          updatedAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    ui.marketplace.comic.projects = [project, ...comicProjects.value];
    workbench.comicProjects = ui.marketplace.comic.projects;
    ui.marketplace.comic.activeTab = "intro";
    ui.marketplace.comic.activeChapterId = project.chapters[0]?.id ?? "";
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
    setComicProjectField("title", value);
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

  function toggleComicProfileRail() {
    ui.marketplace.comic.isProfileCollapsed = !ui.marketplace.comic.isProfileCollapsed;
  }

  function setComicTab(tabId) {
    ui.marketplace.comic.activeTab = COMIC_APP_TABS.some((tab) => tab.id === tabId) ? tabId : "intro";
  }

  function selectComicChapter(chapterId) {
    ui.marketplace.comic.activeChapterId = chapterId;
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

    if (chapter.status === "todo" && (String(chapter.prompt ?? "").trim() || String(chapter.content ?? "").trim())) {
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
      title: `分镜章节 ${chapters.length + 1}`,
      summary: "写下本章画面目标、分镜顺序、角色动作、对白密度和结尾画面。",
      prompt: "基于总介绍和目录生成本章漫画分镜。",
      content: "",
      status: "todo",
      updatedAt: now
    };

    project.chapters = [...chapters, chapter];
    ui.marketplace.comic.activeChapterId = chapter.id;
    ui.marketplace.comic.activeTab = "outline";
    touchComicProject(project);
  }

  function normalizeComicAiChapterDraft(chapter, index = 0, baseIndex = 0) {
    const safeIndex = normalizeComicProjectPageCount(chapter?.index, baseIndex + index + 1);

    return normalizeComicChapterForUi(
      {
        id: createLocalId("comic_chapter"),
        index: safeIndex,
        title: String(chapter?.title ?? "").trim() || `分镜章节 ${safeIndex}`,
        summary: String(chapter?.summary ?? chapter?.brief ?? chapter?.description ?? ""),
        prompt: String(chapter?.prompt ?? chapter?.imagePrompt ?? ""),
        content: String(chapter?.content ?? ""),
        status: normalizeComicChapterStatusForUi(chapter?.status || "todo")
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
    ui.marketplace.comic.activeTab = "outline";
    touchComicProject(project);

    return true;
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

    chapter.content = String(value ?? "");
    touchComicChapter(chapter);
  }

  function goComicChapter(chapterId) {
    selectComicChapter(chapterId);
    ui.marketplace.comic.chapterSearchQuery = "";
    setComicChapterPickerOpen(false);
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
    activeComicChapter,
    activeComicChapterIndex,
    activeComicChapters,
    activeComicExportFileName,
    activeComicProject,
    activeComicTabMeta,
    applyComicProjectsFromStorage,
    backComicMarketplace,
    backComicShelf,
    canExportActiveComicProject,
    clearComicAutosaveTimer,
    closeComicExportDialog,
    comicProjects,
    createComicChapter,
    createComicProject,
    deleteComicProjectFromShelf,
    exportActiveComicProject,
    filteredComicChapterEntries,
    getComicChapterDisplayTitle,
    getComicChapterStatusClass,
    getComicChapterStatusLabel,
    getComicProjectFormatLabel,
    getComicProjectPaletteLabel,
    goComicChapter,
    openComicAppShelf,
    openComicExportDialog,
    openComicProject,
    selectComicChapter,
    selectComicChapterFromPicker,
    selectComicExportDirectory,
    applyComicChaptersFromAi,
    setComicChapterContent,
    setComicChapterPickerOpen,
    setComicChapterPrompt,
    setComicChapterSummary,
    setComicChapterTitle,
    setComicProjectEpisodePlan,
    setComicProjectFormat,
    setComicProjectGenre,
    setComicProjectPageCount,
    setComicProjectPalette,
    setComicProjectSummary,
    setComicProjectTitle,
    setComicProjectVisualStyle,
    setComicTab,
    submitComicChapter,
    toggleComicChapterPicker,
    toggleComicProfileRail
  };
}
