export const COMIC_APP_NAME = "丹青溢彩";
export const FORTUNE_APP_NAME = "灵犀照命";
export const MUSIC_APP_NAME = "瑶琴映月";
export const VIDEO_APP_NAME = "流光绘影";
export const MARKETPLACE_APP_COUNT = 5;

export const FORTUNE_ANALYSIS_METHODS = {
  bazi: {
    label: "八字",
    prompt: "四柱、五行旺衰、十神、喜忌、大运和流年；仅在用户提供完整出生信息或已有排盘时做结构化判断，缺失时说明不能精确排盘。"
  },
  ziwei: {
    label: "紫微",
    prompt: "十二宫位、主星、辅星、四化、宫位互动与人生主题；没有命盘数据时只提出补充项，不虚构星曜落宫。"
  },
  iching: {
    label: "易占",
    prompt: "梅花易数、时间起卦、数字起卦或塔罗式象意拆解；围绕问题把本象、变化和现实验证点分开。"
  },
  facePalm: {
    label: "相学",
    prompt: "面相与手相只基于用户主动描述的五官、气色、掌纹和手型线索做传统象意比喻，不评价身份、道德、寿命、疾病或颜值。"
  },
  fengshui: {
    label: "风水",
    prompt: "阳宅风水聚焦户型、朝向、门窗、动线、光照、床桌灶厕、杂物和五行色材，只给可逆、低成本、低风险的空间调整。"
  },
  numerology: {
    label: "姓名数理",
    prompt: "姓名、数字、日期、颜色和偏好只作为辅助象意，不把笔画或数字结果当成确定命运。"
  },
  astrology: {
    label: "星象",
    prompt: "西方星座、行运与个人周期只能作为辅助框架，避免和东方命盘混为确定结论。"
  },
  reality: {
    label: "现实校准",
    prompt: "把用户近况、约束、资源、情绪和可复盘事件作为校准线，所有趋势都要落到可执行动作和复盘指标。"
  }
};

export const FORTUNE_READING_MODES = [
  {
    id: "daily",
    label: "今日运势",
    kicker: "Daily",
    focus: "当天状态、机会窗口、提醒和可执行的小动作。",
    placeholder: "今天需要重点留意什么？",
    methods: ["iching", "astrology", "reality"]
  },
  {
    id: "destiny",
    label: "综合看命",
    kicker: "Destiny",
    focus: "把出生信息、现实处境和多个命理框架合并成长期主题。",
    placeholder: "我想看自己近几年事业、感情和财运的整体走向。",
    methods: ["bazi", "ziwei", "numerology", "reality"]
  },
  {
    id: "facePalm",
    label: "面相手相",
    kicker: "Mian Xiang",
    focus: "面部气质、五官线索、掌纹手型与性格倾向的娱乐解读。",
    placeholder: "请根据我描述的面相/手相，给一个温和的性格和趋势参考。",
    methods: ["facePalm", "reality"]
  },
  {
    id: "fengshui",
    label: "阳宅风水",
    kicker: "Feng Shui",
    focus: "家居办公布局、动线、光照、收纳和五行平衡建议。",
    placeholder: "请帮我看这个房间/工位的风水布局怎么调整更顺。",
    methods: ["fengshui", "bazi", "reality"]
  },
  {
    id: "career",
    label: "事业财运",
    kicker: "Career",
    focus: "工作推进、合作节奏、资源流动和财务倾向。",
    placeholder: "最近事业或财务上怎么取舍更稳？",
    methods: ["bazi", "ziwei", "iching", "reality"]
  },
  {
    id: "relationship",
    label: "感情关系",
    kicker: "Relation",
    focus: "关系温度、沟通阻力、互动机会和边界感。",
    placeholder: "这段关系接下来该主动还是观察？",
    methods: ["ziwei", "iching", "numerology", "reality"]
  },
  {
    id: "choice",
    label: "抉择占卜",
    kicker: "Choice",
    focus: "多个选项的得失、隐性风险和下一步试探。",
    placeholder: "我应该选择 A 方案还是 B 方案？",
    methods: ["iching", "reality"]
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

export const MUSIC_APP_TABS = [
  { id: "all", label: "全部曲目", kicker: "All", filter: "all" },
  { id: "draft", label: "草稿", kicker: "Draft", filter: "draft" },
  { id: "finished", label: "成品", kicker: "Master", filter: "finished" }
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

export const COMIC_ASSET_TYPE_META = {
  character: {
    label: "人物",
    defaultName: "人物素材",
    defaultDescription: "固定角色的外貌、服饰、体态、表情气质和关键识别点。",
    defaultPrompt: "保持人物五官、发型、服饰、年龄感、体态比例和标志性细节一致；三视图使用 16:9 横图，把正面、侧面、背面三个完整全身立姿放在同一张图里，不能裁切头顶、脚部、衣摆或武器。",
    defaultViews: [
      { kind: "turnaround", label: "三视图" }
    ]
  },
  prop: {
    label: "物品",
    defaultName: "物品素材",
    defaultDescription: "固定物品的造型、材质、尺寸感、纹样和使用方式。",
    defaultPrompt: "保持物品轮廓、材质、颜色、比例、纹样和磨损细节一致；三视图使用 16:9 横图，把正面、侧面、背面三个完整视角放在同一张图里，不能裁切主体轮廓。",
    defaultViews: [
      { kind: "turnaround", label: "三视图" }
    ]
  },
  scene: {
    label: "场景",
    defaultName: "场景素材",
    defaultDescription: "固定场景的空间关系、光线、氛围、建筑结构和关键道具。",
    defaultPrompt: "保持场景空间结构、光线方向、色彩氛围、时代感和关键布景一致。",
    defaultViews: [
      { kind: "wide", label: "全景" },
      { kind: "angle", label: "视角 A" },
      { kind: "detail", label: "细节" }
    ]
  }
};

export const COMIC_ASSET_VIEW_KIND_META = {
  turnaround: { label: "三视图" },
  front: { label: "正面" },
  side: { label: "侧面" },
  back: { label: "背面" },
  angle: { label: "视角" },
  wide: { label: "全景" },
  detail: { label: "细节" }
};

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
export const MUSIC_PROJECT_COVER_TONES = ["lunar", "jade", "amber", "rose"];

export const MUSIC_TRACK_KIND_META = {
  song: { label: "完整歌曲", operation: "generate_song" },
  instrumental: { label: "纯音乐", operation: "generate_instrumental" },
  jingle: { label: "短曲动机", operation: "generate_instrumental" },
  soundtrack: { label: "场景配乐", operation: "generate_instrumental" }
};

export const MUSIC_TRACK_STATUS_META = {
  draft: { label: "草稿", className: "is-warning" },
  finished: { label: "成品", className: "is-success" }
};

export const MUSIC_PROVIDER_META = {
  mureka: { label: "Mureka" },
  suno: { label: "Suno" },
  manual: { label: "手动" }
};

export const COMIC_APP_TABS = [
  { id: "intro", label: "总介绍", kicker: "Overview", fieldLabel: "漫画总介绍" },
  { id: "outline", label: "目录", kicker: "Outline", fieldLabel: "章节与分镜目录" },
  { id: "chapter", label: "单章生成", kicker: "Chapter", fieldLabel: "章节图片生成" }
];

export const COMIC_CHAPTER_STATUS_META = {
  todo: { label: "未开始", className: "is-cancelled" },
  inProgress: { label: "进行中", className: "is-warning" },
  done: { label: "已完成", className: "is-success" }
};

export const COMIC_STORYBOARD_KIND_META = {
  dialogue: { label: "对话" },
  scene: { label: "场景" },
  action: { label: "打斗" },
  transition: { label: "过渡" },
  emotion: { label: "情绪" },
  other: { label: "其他" }
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
    agent: {
      activeAppId: "",
      activeProgressEventId: "",
      progress: null
    },
    cover: {
      isDialogOpen: false,
      appId: "",
      itemId: "",
      dialogMode: "upload",
      urlInput: "",
      promptInput: "",
      shouldShowTitle: true,
      feedback: "",
      feedbackTone: "neutral",
      draftUrl: "",
      previewUrl: "",
      isGenerating: false
    },
    comic: {
      projects: [],
      activeProjectId: null,
      activeTab: "intro",
      activeChapterId: "",
      activeStoryboardId: "",
      activeChapterImageId: "",
      introMode: "settings",
      activeAssetId: "",
      isAssetRailCollapsed: false,
      previewAssetViewId: "",
      aiTaskId: "splitStoryboards",
      aiInstruction: "",
      aiOutput: "",
      aiFeedback: "",
      aiFeedbackTone: "neutral",
      aiPromptPreview: "",
      aiGeneratedImages: [],
      aiImageSize: "1024x1536",
      aiImageCount: 1,
      aiStoryboardCount: 8,
      aiQuality: "medium",
      aiRequestId: "",
      isAiRunning: false,
      generatingAssetViewId: "",
      isAiDrawerOpen: false,
      isAiTaskPickerOpen: false,
      isPromptPreviewOpen: false,
      isProfileCollapsed: false,
      isChapterPickerOpen: false,
      chapterSearchQuery: "",
      isOutlineChapterSummaryOpen: true,
      isOutlineChapterContentOpen: true,
      isOutlineChapterPromptOpen: true,
      isChapterStoryInputOpen: false,
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
      feedback: "",
      feedbackTone: "neutral",
      isGenerating: false,
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
      profileInfo: "",
      birthInfo: "",
      appearanceInfo: "",
      spaceInfo: "",
      nameInfo: "",
      context: "",
      chatInput: "",
      chatAttachments: [],
      messages: [],
      output: "",
      feedback: "",
      feedbackTone: "neutral",
      isGenerating: false
    },
    music: {
      activeMode: "song",
      activeTab: "all",
      projects: [],
      activeProjectId: null,
      activeTrackId: "",
      trackFilter: "all",
      generationProvider: "",
      callbackUrl: "",
      isProfileCollapsed: false,
      isAiDrawerOpen: false,
      isAiTaskPickerOpen: false,
      isCallingTool: false,
      theme: "",
      style: "",
      reference: "",
      output: "",
      feedback: "",
      feedbackTone: "neutral",
      isExportDialogOpen: false,
      exportDirectory: "",
      exportFeedback: "",
      exportFeedbackTone: "neutral",
      isExporting: false,
      isGenerating: false
    },
    writing: {
      books: [],
      activeBookId: null,
      activeTab: "intro",
      activeChapterId: "",
      aiPhaseId: "foundation",
      aiTaskId: "storySetup",
      aiInstruction: "",
      aiOutput: "",
      aiFeedback: "",
      aiFeedbackTone: "neutral",
      isAiRunning: false,
      agentProgress: null,
      aiRunningBookId: "",
      outlinePlannerCancelRequested: false,
      uploadFeedback: "",
      isProfileCollapsed: false,
      isAiDrawerOpen: false,
      isAiTaskPickerOpen: false,
      isPromptPreviewOpen: false,
      isCoverDialogOpen: false,
      coverDialogMode: "upload",
      coverUrlInput: "",
      coverPromptInput: "",
      coverShouldShowTitle: true,
      coverFeedback: "",
      coverFeedbackTone: "neutral",
      coverDraftUrl: "",
      coverPreviewUrl: "",
      isCoverGenerating: false,
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
