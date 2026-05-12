export const COMIC_APP_NAME = "丹青溢彩";
export const FORTUNE_APP_NAME = "灵犀照命";
export const MUSIC_APP_NAME = "瑶琴映月";
export const VIDEO_APP_NAME = "流光绘影";
export const MARKETPLACE_APP_COUNT = 5;

export const FORTUNE_READING_MODES = [
  {
    id: "daily",
    label: "今日运势",
    kicker: "Daily",
    focus: "当天状态、机会窗口、提醒和可执行的小动作。",
    placeholder: "今天需要重点留意什么？"
  },
  {
    id: "career",
    label: "事业财运",
    kicker: "Career",
    focus: "工作推进、合作节奏、资源流动和财务倾向。",
    placeholder: "最近事业或财务上怎么取舍更稳？"
  },
  {
    id: "relationship",
    label: "感情关系",
    kicker: "Relation",
    focus: "关系温度、沟通阻力、互动机会和边界感。",
    placeholder: "这段关系接下来该主动还是观察？"
  },
  {
    id: "choice",
    label: "抉择占卜",
    kicker: "Choice",
    focus: "多个选项的得失、隐性风险和下一步试探。",
    placeholder: "我应该选择 A 方案还是 B 方案？"
  },
  {
    id: "cycle",
    label: "年月趋势",
    kicker: "Cycle",
    focus: "一段周期内的主题、节奏变化、关键节点和复盘指标。",
    placeholder: "接下来一段时间的整体趋势如何？"
  }
];

export const MUSIC_CREATION_MODES = [
  {
    id: "song",
    label: "完整歌曲",
    kicker: "Song",
    focus: "歌名、歌词、段落结构、曲风标签、编曲方向和生成提示词。",
    placeholder: "写一首关于夜雨、旧城和重逢的中文歌。"
  },
  {
    id: "lyrics",
    label: "歌词打磨",
    kicker: "Lyrics",
    focus: "主题表达、押韵、段落推进、副歌记忆点和可唱性。",
    placeholder: "把已有歌词改得更有画面感和副歌记忆点。"
  },
  {
    id: "instrumental",
    label: "纯音乐",
    kicker: "Instrumental",
    focus: "情绪曲线、乐器层次、速度、段落起伏和无歌词生成提示词。",
    placeholder: "做一段适合清晨专注工作的纯音乐。"
  },
  {
    id: "jingle",
    label: "短曲动机",
    kicker: "Jingle",
    focus: "短旋律定位、节奏钩子、品牌/场景记忆点和循环方式。",
    placeholder: "做一个 15 秒开场音乐，轻快、干净、容易记住。"
  },
  {
    id: "prompt",
    label: "生成提示词",
    kicker: "Prompt",
    focus: "面向音乐生成工具的风格、结构、乐器、速度、情绪和限制词。",
    placeholder: "帮我整理成可以给 music_gen 使用的音乐生成提示词。"
  }
];

export const COMIC_PROJECT_FORMAT_META = {
  poster: { label: "单图海报", defaultPages: 1 },
  serial: { label: "连载漫画", defaultPages: 24 }
};

export const COMIC_PROJECT_PALETTE_META = {
  monochrome: { label: "单色" },
  color: { label: "彩绘" }
};

export const COMIC_PROJECT_COVER_TONES = ["ink", "coral", "teal", "gold"];

export const VIDEO_PROJECT_MODE_META = {
  textToVideo: { label: "文生视频", defaultDuration: 5 },
  imageToVideo: { label: "图生视频", defaultDuration: 6 }
};

export const VIDEO_PROJECT_ASPECT_RATIO_META = {
  "16:9": { label: "横屏 16:9" },
  "9:16": { label: "竖屏 9:16" },
  "1:1": { label: "方屏 1:1" }
};

export const VIDEO_PROJECT_COVER_TONES = ["lumen", "violet", "teal", "coral"];

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

export const VIDEO_APP_TABS = [
  { id: "concept", label: "项目设定", kicker: "Concept", fieldLabel: "视频生成设定" },
  { id: "storyboard", label: "镜头规划", kicker: "Storyboard", fieldLabel: "镜头列表与分镜" },
  { id: "generate", label: "生成台", kicker: "Generate", fieldLabel: "镜头提示词与结果" }
];

export const VIDEO_SHOT_STATUS_META = {
  todo: { label: "未开始", className: "is-cancelled" },
  inProgress: { label: "生成中", className: "is-warning" },
  done: { label: "已完成", className: "is-success" }
};

export function createMarketplaceState() {
  return {
    view: "apps",
    fieldAi: {
      isOpen: false,
      targetId: "",
      appName: "",
      fieldLabel: "",
      context: "",
      sourceText: "",
      instruction: "",
      output: "",
      feedback: "",
      feedbackTone: "neutral",
      isGenerating: false,
      requestId: ""
    },
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
    video: {
      projects: [],
      activeProjectId: null,
      activeTab: "concept",
      activeShotId: "",
      isProfileCollapsed: false,
      isShotPickerOpen: false,
      shotSearchQuery: "",
      isExportDialogOpen: false,
      exportDirectory: "",
      exportFeedback: "",
      exportFeedbackTone: "neutral",
      isExporting: false
    },
    fortune: {
      activeMode: "daily",
      question: "",
      birthInfo: "",
      context: "",
      output: "",
      feedback: "",
      feedbackTone: "neutral",
      isGenerating: false
    },
    music: {
      activeMode: "song",
      theme: "",
      style: "",
      reference: "",
      output: "",
      feedback: "",
      feedbackTone: "neutral",
      isGenerating: false
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
      collapsedIntroSectionIds: [],
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
