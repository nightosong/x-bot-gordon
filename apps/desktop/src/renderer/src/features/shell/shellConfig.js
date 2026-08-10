export const FEATURE_HOME = "home";
export const FEATURE_MARKETPLACE = "marketplace";
export const FEATURE_TASKS = "tasks";
export const FEATURE_WORKFLOW_LIBRARY = "workflow-library";
export const FEATURE_COMMAND_WORKSHOP = "command-workshop";
export const FEATURE_MODEL_MANAGEMENT = "model-management";
export const FEATURE_EXTENSIONS_MANAGEMENT = "extensions-management";

export const BRAND_RANDOM_TEXTS = [
  "GORDON",
  "ATELIER",
  "SABER",
  "LUMINA",
  "AETHER",
  "BLUEARC",
  "MOONLIT",
  "HIKARI",
  "AOZORA",
  "SEIHAI",
  "RADIANT",
  "MIRAGE",
  "ASTER",
  "KISEKI",
  "STUDIO",
  "DAYDREAM"
];

export const FEATURE_ENTRIES = [
  {
    id: FEATURE_HOME,
    icon: "home",
    kicker: "Atelier",
    title: "首页",
    tier: "flat"
  },
  {
    id: FEATURE_MARKETPLACE,
    icon: "layoutGrid",
    kicker: "Shelf",
    title: "应用广场",
    tier: "wide"
  },
  {
    id: FEATURE_TASKS,
    icon: "listTodo",
    kicker: "Notes",
    title: "任务笔记",
    tier: "default"
  },
  {
    id: FEATURE_WORKFLOW_LIBRARY,
    icon: "workflow",
    kicker: "Flow",
    title: "流程中心",
    tier: "wide"
  },
  {
    id: FEATURE_COMMAND_WORKSHOP,
    icon: "messagePlus",
    kicker: "Dialogue",
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
