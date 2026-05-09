export const WRITING_APP_NAME = "墨笔生花";
export const WRITING_AUTOSAVE_DELAY = 700;

export const WRITING_APP_TABS = [
  { id: "intro", label: "故事介绍", kicker: "Premise", fieldLabel: "设定与故事介绍" },
  { id: "outline", label: "书籍目录", kicker: "Outline", fieldLabel: "卷章结构与目录" },
  { id: "chapter", label: "章节编写", kicker: "Chapter", fieldLabel: "当前章节正文" }
];

export const WRITING_LENGTH_PROFILES = {
  short: {
    label: "短篇",
    scope: "一口气完成的强冲击叙事",
    method: "只保留一个核心矛盾、一个决定性转折和一个余震结尾；背景只写会改变结局的设定。"
  },
  medium: {
    label: "中篇",
    scope: "多幕式成长与反转",
    method: "用 3-5 个阶段推进人物关系和真相揭露；每一幕都要让主角付出不可逆代价。"
  },
  long: {
    label: "长篇",
    scope: "严密世界观与群像长线",
    method: "先搭建时代、制度、利益网络和多阵营目标，再用卷级悬念、人物弧光和伏笔回收驱动章节；开篇仍优先聚焦主角，不用群像开局。"
  }
};

export const WRITING_AI_TASKS = {
  intro: [
    { id: "world", label: "世界观总设", goal: "补强时代、地理、制度、资源、禁忌和冲突源，让背景成为剧情发动机。" },
    { id: "character", label: "人物关系网", goal: "设计主角、对手、盟友、镜像人物和隐性债务，突出彼此之间的利益与情感牵连。" },
    { id: "premise", label: "故事钩子", goal: "提炼一句不可忽视的核心命题，并扩写成具有出版级吸引力的故事简介。" },
    { id: "openingAudit", label: "开篇体检", goal: "按黄金一章/三章标准检查开局卖点、主角聚焦、人物数量、群像开局和设定倾倒。" },
    { id: "storyBible", label: "创作圣经", goal: "把主线、世界规则、人物弧光、伏笔账本和风格边界整理成后续章节可复用的创作基准。" }
  ],
  outline: [
    { id: "structure", label: "章节规划", goal: "按篇幅拆分幕、卷、章，给每一章明确冲突、信息增量、人物变化和结尾钩子。" },
    { id: "openingArc", label: "前三章设计", goal: "把前三章设计成主角鲜明、人物克制、设定不倾倒并制造追读期待的开篇小故事。" },
    { id: "plotEngine", label: "剧情推进", goal: "判断下一阶段该发生什么，明确冲突、转折、情绪目标、章节目标和读者期待兑现。" },
    { id: "foreshadow", label: "伏笔回收", goal: "设计伏笔、误导、反转和回收节奏，避免目录只是事件流水账。" },
    { id: "rhythm", label: "节奏诊断", goal: "检查高潮、缓冲、揭秘、失败和胜利的分布，让故事曲线更有张力。" },
    { id: "continuity", label: "一致性审核", goal: "检查时间线、设定规则、人名关系、能力边界和未回收伏笔，避免长篇崩线。" }
  ],
  chapter: [
    { id: "draft", label: "章节初稿", goal: "根据当前目录与设定生成章节正文，要求场景具体、对白有锋芒、段落有推进。" },
    { id: "expand", label: "内容扩写", goal: "丰富感官细节、行动链、心理暗流和人物互动，不改变既有剧情方向。" },
    { id: "dialogue", label: "对白增强", goal: "稳定人物声口，补强潜台词、冲突递进和对话中的行动变化。" },
    { id: "climax", label: "高潮场面", goal: "生成战斗、对峙、打脸、反转或情绪爆发场面，保证爽点来自因果和代价。" },
    { id: "polish", label: "文学润色", goal: "强化语言质感、节奏、意象和收束句，让章节更有辨识度。" },
    { id: "openingReview", label: "开篇自评", goal: "按黄金一章/三章和商业追读标准检查当前章节，识别人物过多、群像开局和设定倾倒。" },
    { id: "review", label: "章节质检", goal: "按人物动机、因果链、节奏、伏笔、设定一致性和可读性检查当前章节。" }
  ]
};

export const WRITING_OUTLINE_REWRITE_PATTERN =
  /(重改|重写|重做|重构|重新设计|重新规划|从零|推翻|不要参考|不参考|不代入|不用已有|忽略已有|全新目录|新的目录|替换目录)/;

export const WRITING_OUTLINE_EXPANSION_PATTERN =
  /(扩写|扩充|扩展|拓展|增加到|加到|分为|分成|拆成|每幕|每一幕|每卷|每一卷|几百章|上千章|千章|百章|长篇规划)/;

export const WRITING_LONG_OUTLINE_BATCH_SIZE = 20;
export const WRITING_LONG_OUTLINE_MASTER_MAX_TOKENS = 5200;
export const WRITING_LONG_OUTLINE_BATCH_MAX_TOKENS = 8200;
export const WRITING_CHAPTER_MAX_OUTPUT_TOKENS = 7600;
export const WRITING_MODEL_MAX_RETRY_ATTEMPTS = 5;
export const WRITING_MODEL_RETRY_BASE_DELAY_MS = 1200;
export const WRITING_MODEL_RETRY_MAX_DELAY_MS = 8000;

export const WRITING_CHAPTER_PREFIX_PATTERN = /^第\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*章\s*(?:[：:、.\-]\s*)?(.*)$/;
export const WRITING_PART_PREFIX_PATTERN = /^(?:第\s*)?([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(幕|卷)\s*(?:[：:、.\-·]\s*)?(.*)$/;

export const WRITING_BOOK_EXPORT_FORMATS = [
  { id: "txt", label: "TXT" },
  { id: "md", label: "Markdown" }
];

export const WRITING_INTRO_SECTION_DEFINITIONS = {
  intro: {
    key: "intro",
    label: "简短介绍",
    placeholder: "用几段话写清故事核心命题、主角处境、主要矛盾和读者会被什么牵引。"
  },
  outlineGuide: {
    key: "outlineGuide",
    label: "大纲指导",
    placeholder: "写下中篇结构的阶段、转折、人物变化和主要伏笔，帮助后续目录不散。"
  },
  seriesPlan: {
    key: "seriesPlan",
    label: "详细大纲指导",
    placeholder: "写下长篇整体规划：分部、分卷、每一部的完整故事目标、核心阵营变化和最终回收。"
  }
};

export const WRITING_CHAPTER_STATUS_META = {
  todo: { label: "未开始", className: "is-cancelled" },
  inProgress: { label: "进行中", className: "is-warning" },
  done: { label: "已完成", className: "is-success" }
};
