export const FEATURE_HOME = "home";
export const FEATURE_MARKETPLACE = "marketplace";
export const FEATURE_TASKS = "tasks";
export const FEATURE_WORKFLOW_LIBRARY = "workflow-library";
export const FEATURE_COMMAND_WORKSHOP = "command-workshop";
export const FEATURE_MODEL_MANAGEMENT = "model-management";
export const FEATURE_EXTENSIONS_MANAGEMENT = "extensions-management";

export const BRAND_RANDOM_TEXTS = [
  "LIKEGORD",
  "PALWORLD",
  "DIVINITY",
  "DEADCELLS",
  "DARKSOULS",
  "ZELDA",
  "STARWARS",
  "CYBERPUNK",
  "WILDHUNT",
  "MINECRAFT",
  "MARIOKART",
  "LOSTARK",
  "ONLYUP",
  "ELDENRING",
  "BLACKMYTH",
  "GENSHIN",
  "STARAIL",
  "TWOFUS",
  "HALFLIFE",
  "VALORANT",
  "FORTNITE",
  "OVERWATCH",
  "DOMINATE",
  "LEGEND",
  "VICTORY",
  "GROOT",
  "HOLMES",
  "OPTIMUS",
  "ARAGORN",
  "ULTRAMAN",
  "SUPERMAN",
  "DEADPOOL",
  "VENOM",
  "GODZILLA",
  "THANOS",
  "SMAUG",
  "WOLVERINE",
  "ARCANE",
  "SWORDART",
  "ONEPIECE",
  "NARUTO",
  "SASUKE",
  "PHANTOM",
  "VALKYRIE",
  "ALCHEMIST",
  "ECLIPSE",
  "OBSIDIAN",
  "SPACEX",
  "NVIDIA"
];

export const FEATURE_ENTRIES = [
  {
    id: FEATURE_HOME,
    icon: "home",
    kicker: "Home",
    title: "首页",
    tier: "flat"
  },
  {
    id: FEATURE_MARKETPLACE,
    icon: "layoutGrid",
    kicker: "Market",
    title: "应用广场",
    tier: "wide"
  },
  {
    id: FEATURE_TASKS,
    icon: "listTodo",
    kicker: "Tasks",
    title: "任务笔记",
    tier: "default"
  },
  {
    id: FEATURE_WORKFLOW_LIBRARY,
    icon: "workflow",
    kicker: "workflow",
    title: "流程中心",
    tier: "wide"
  },
  {
    id: FEATURE_COMMAND_WORKSHOP,
    icon: "terminal",
    kicker: "Command",
    title: "命令工坊",
    tier: "default"
  }
];

export const HOME_SETTINGS_ITEMS = [
  {
    id: FEATURE_MODEL_MANAGEMENT,
    icon: "settings",
    title: "模型管理"
  },
  {
    id: FEATURE_EXTENSIONS_MANAGEMENT,
    icon: "sparkles",
    title: "能力拓展"
  }
];

export const FEATURE_PLACEHOLDERS = {
  [FEATURE_MARKETPLACE]: {
    title: "应用广场",
    description: "这里会继续承接应用发现、工具接入和能力分发。"
  }
};
