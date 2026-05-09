export const COMIC_APP_NAME = "丹青溢彩";
export const MARKETPLACE_APP_COUNT = 2;

export const COMIC_PROJECT_FORMAT_META = {
  poster: { label: "单图海报", defaultPages: 1 },
  serial: { label: "连载漫画", defaultPages: 24 }
};

export const COMIC_PROJECT_PALETTE_META = {
  monochrome: { label: "单色" },
  color: { label: "彩绘" }
};

export const COMIC_PROJECT_COVER_TONES = ["ink", "coral", "teal", "gold"];

export const COMIC_APP_TABS = [
  { id: "intro", label: "总介绍", kicker: "Overview", fieldLabel: "漫画总介绍" },
  { id: "outline", label: "目录", kicker: "Outline", fieldLabel: "章节与分镜目录" },
  { id: "chapter", label: "单章生成", kicker: "Chapter", fieldLabel: "单章生成稿" }
];

export const COMIC_CHAPTER_STATUS_META = {
  todo: { label: "未开始", className: "is-cancelled" },
  inProgress: { label: "进行中", className: "is-warning" },
  done: { label: "已完成", className: "is-success" }
};

export function createMarketplaceState() {
  return {
    view: "apps",
    comic: {
      projects: [],
      activeProjectId: null,
      activeTab: "intro",
      activeChapterId: "",
      isProfileCollapsed: false,
      isChapterPickerOpen: false,
      chapterSearchQuery: "",
      isExportDialogOpen: false,
      exportDirectory: "",
      exportFeedback: "",
      exportFeedbackTone: "neutral",
      isExporting: false
    },
    writing: {
      books: [],
      activeBookId: null,
      activeTab: "intro",
      activeChapterId: "",
      aiTaskId: "premise",
      aiInstruction: "",
      aiOutput: "",
      aiFeedback: "",
      aiFeedbackTone: "neutral",
      isAiRunning: false,
      aiRunningBookId: "",
      outlinePlannerCancelRequested: false,
      uploadFeedback: "",
      isProfileCollapsed: false,
      isAiDrawerOpen: false,
      isAiTaskPickerOpen: false,
      isPromptPreviewOpen: false,
      isChapterPickerOpen: false,
      chapterSearchQuery: "",
      isExportDialogOpen: false,
      exportFormat: "txt",
      exportDirectory: "",
      exportFeedback: "",
      exportFeedbackTone: "neutral",
      isExporting: false,
      submittedChapterId: "",
      submittedChapterContentSnapshot: ""
    }
  };
}
