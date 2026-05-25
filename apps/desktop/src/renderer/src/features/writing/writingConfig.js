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
    method: "用 3-5 个阶段推进人物关系、行动目标和处境变化；阶段代价要落到资源、路线、关系、身份或能力边界上，不默认写成真相揭露或文明反思。"
  },
  long: {
    label: "长篇",
    scope: "持续扩展的成长长线",
    method: "先确定主角的长期行动方向、阶段权限、资源压力、能力成长和可持续扩展的卷级区域，再补时代、制度、利益网络与伏笔回收；开篇仍优先聚焦主角，不用群像开局。"
  }
};

export const WRITING_AI_TASKS = {
  intro: [
    {
      id: "premise",
      label: "生成书籍介绍",
      goal: "把核心命题、主角处境、主要矛盾和读者钩子写成可直接使用的简介。",
      target: "写入：简短介绍"
    },
    {
      id: "storySetup",
      label: "完善故事设定",
      goal: "把世界规则、人物关系、主线阶段、伏笔和风格边界整理成目录可用的创作规划。",
      target: "写入：大纲指导"
    },
    {
      id: "openingAudit",
      label: "开篇体检",
      goal: "按黄金一章/三章检查主角聚焦、人物数量、群像开局、设定倾倒和追读期待。",
      target: "仅审阅，不自动写入"
    }
  ],
  outline: [
    {
      id: "structure",
      label: "规划章节目录",
      goal: "按篇幅拆分幕、卷、章；前三章、节奏、伏笔和一致性会内置到目录规划中。",
      target: "写入：书籍目录"
    },
    {
      id: "outlineAudit",
      label: "目录体检",
      goal: "集中检查目录的节奏、因果、伏笔、前三章追读和设定一致性，只给可执行修法。",
      target: "仅审阅，不自动写入"
    }
  ],
  chapter: [
    { id: "chapterPlan", label: "章内计划", goal: "先拆清本章问题、信息差、反制、证据载体、代价和结尾钩子，再进入正文。", target: "写入：当前章节简介" },
    { id: "draft", label: "章节初稿", goal: "根据当前目录与设定生成章节正文，要求场景具体、对白有锋芒、段落有推进。", target: "写入：当前章节正文" },
    { id: "expand", label: "内容扩写", goal: "丰富感官细节、行动链、心理暗流和人物互动，不改变既有剧情方向。", target: "写入：当前章节正文" },
    { id: "dialogue", label: "对白增强", goal: "稳定人物声口，补强潜台词、冲突递进和对话中的行动变化。", target: "写入：当前章节正文" },
    { id: "climax", label: "高潮场面", goal: "生成战斗、对峙、打脸、反转或情绪爆发场面，保证爽点来自因果和代价。", target: "写入：当前章节正文" },
    { id: "polish", label: "压缩润色", goal: "删掉空泛解释和无功能辞藻，把抽象情绪改成动作、证据和场景后果。", target: "写入：当前章节正文" },
    { id: "openingReview", label: "开篇自评", goal: "按黄金一章/三章和商业追读标准检查当前章节，识别人物过多、群像开局和设定倾倒。", target: "仅审阅，不自动写入" },
    { id: "review", label: "章节质检", goal: "按人物动机、因果链、节奏、伏笔、设定一致性和可读性检查当前章节。", target: "仅审阅，不自动写入" }
  ]
};

export const WRITING_OUTLINE_REWRITE_PATTERN =
  /(重改|重写|重做|重构|重新设计|重新规划|从零|推翻|不要参考|不参考|不代入|不用已有|忽略已有|全新目录|新的目录|替换目录)/;

export const WRITING_OUTLINE_EXPANSION_PATTERN =
  /(扩写|扩充|扩展|拓展|增加到|加到|分为|分成|拆成|每幕|每一幕|每卷|每一卷|几百章|上千章|千章|百章|长篇规划)/;

export const WRITING_DEFAULT_MAX_OUTPUT_TOKENS = 64 * 1024;
export const WRITING_LONG_OUTLINE_BATCH_SIZE = 20;
export const WRITING_LONG_OUTLINE_MASTER_MAX_TOKENS = WRITING_DEFAULT_MAX_OUTPUT_TOKENS;
export const WRITING_LONG_OUTLINE_BATCH_MAX_TOKENS = WRITING_DEFAULT_MAX_OUTPUT_TOKENS;
export const WRITING_CHAPTER_MAX_OUTPUT_TOKENS = WRITING_DEFAULT_MAX_OUTPUT_TOKENS;
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
    placeholder: "写下整体规划：故事发动机、阶段主线、人物变化、世界规则、关键伏笔、风格边界和后续目录策略。"
  }
};

export const WRITING_CHAPTER_STATUS_META = {
  todo: { label: "未开始", className: "is-cancelled" },
  inProgress: { label: "进行中", className: "is-warning" },
  done: { label: "已完成", className: "is-success" }
};
