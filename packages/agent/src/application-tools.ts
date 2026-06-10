import { randomUUID } from "node:crypto";

import { listComicProjects, listWritingBooks, saveWritingBook, upsertComicProject } from "../../workbench/src/index.js";
import type {
  ComicAsset,
  ComicAssetType,
  ComicAssetView,
  ComicAssetViewKind,
  ComicAssetVariant,
  ComicChapter,
  ComicChapterImage,
  ComicChapterStatus,
  ComicProject,
  ComicProjectFormat,
  ComicProjectPalette,
  ComicSourceMeta,
  ComicSourceRef,
  ComicStoryboardKind,
  ComicStoryboardShot,
  McpServerConfig,
  McpToolCallRequest,
  McpToolCallResult,
  McpToolDefinition,
  WritingBook,
  WritingBookIntroSection,
  WritingBookLength,
  WritingCharacterArc,
  WritingChapter,
  WritingCharacterAsset,
  WritingEvidenceRef,
  WritingForeshadowAsset,
  WritingGenreProfile,
  WritingNarrativeRiskLevel,
  WritingNarrativeStateNode,
  WritingStoryAssetEntry
} from "../../shared/src/index.js";

export const BUILTIN_APPLICATION_TOOLS_MCP_ID = "builtin:mcp:application-tools";

const MAX_TEXT_CHARS = 24_000;
const MAX_PREVIEW_CHARS = 2_400;
const MAX_SEARCH_RESULTS = 20;

type JsonObject = Record<string, unknown>;

const STORY_ASSETS_SCHEMA = {
  type: "object",
  description:
    "可选，结构化故事资产。用于写入世界观、人物、关系、时间线、伏笔、规则、风格和连续性备注；适合小说企划、世界观、角色卡、武道体系、势力设定等长期资产。",
  properties: {
    premise: { type: "string", description: "故事命题/核心体验" },
    worldview: {
      type: "array",
      description: "世界观、地图、组织、经济、生态、战斗体系等设定条目",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          chapterIndex: { type: "integer", minimum: 1 },
          status: { type: "string" }
        },
        additionalProperties: true
      }
    },
    characters: {
      type: "array",
      description: "人物资产。每项可包含 name、role、goal、fear、secret、growthArc、relationships、tags、status",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          goal: { type: "string" },
          fear: { type: "string" },
          secret: { type: "string" },
          growthArc: { type: "string" },
          relationships: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          status: { type: "string" }
        },
        additionalProperties: true
      }
    },
    relationships: {
      type: "array",
      description: "关系、势力关系、人物关系条目",
      items: { type: "object", additionalProperties: true }
    },
    timeline: {
      type: "array",
      description: "时间线、卷阶段、关键事件条目",
      items: { type: "object", additionalProperties: true }
    },
    foreshadows: {
      type: "array",
      description: "伏笔资产。每项可包含 title、setup、payoff、status、chapterIndex、payoffChapterIndex、tags",
      items: { type: "object", additionalProperties: true }
    },
    characterArcs: {
      type: "array",
      description: "人物弧线。每项包含 characterName、want、need、currentStage、nextPressure、endpoint、evidenceRefs",
      items: { type: "object", additionalProperties: true }
    },
    rules: {
      type: "array",
      description: "必须长期遵守的规则边界，例如战斗体系、禁忌、设定硬约束",
      items: { type: "object", additionalProperties: true }
    },
    styleProfile: {
      type: "object",
      description: "风格档案",
      properties: {
        voice: { type: "string" },
        pacing: { type: "string" },
        genreSignals: { type: "array", items: { type: "string" } },
        taboos: { type: "array", items: { type: "string" } },
        proseDensity: { type: "string" },
        dialogueRatio: { type: "string" },
        narrationDistance: { type: "string" },
        emotionalTemperature: { type: "string" },
        humorLevel: { type: "string" },
        violenceExplicitness: { type: "string" },
        pacingCurve: { type: "array", items: { type: "string" } }
      },
      additionalProperties: true
    },
    memoryNotes: {
      type: "array",
      description: "连续性备注、资源状态、后续必须记住的事实",
      items: { type: "object", additionalProperties: true }
    }
  },
  additionalProperties: true
} as const;

const NARRATIVE_STATE_NODE_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    summary: { type: "string" },
    status: { type: "string" },
    introducedAtChapterIndex: { type: "integer", minimum: 1 },
    payoffDeadlineChapterIndex: { type: "integer", minimum: 1 },
    resolvedAtChapterIndex: { type: "integer", minimum: 1 },
    evidenceChapterIds: { type: "array", items: { type: "string" } },
    evidenceRefs: { type: "array", items: { type: "object", additionalProperties: true } },
    impact: { type: "string" },
    relatedNodeIds: { type: "array", items: { type: "string" } },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] }
  },
  additionalProperties: true
} as const;

const NARRATIVE_STATE_SCHEMA = {
  type: "object",
  description:
    "可选，统一叙事状态图。用于写入人物状态、世界规则、资源/债务/伤势、区域状态、伏笔压力、故事弧、时间线、连续性风险和计划漂移。",
  properties: {
    characters: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    worldRules: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    resources: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    regions: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    foreshadows: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    arcs: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    timelineEvents: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    continuityWarnings: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA },
    planDriftNotes: { type: "array", items: NARRATIVE_STATE_NODE_SCHEMA }
  },
  additionalProperties: true
} as const;

const GENRE_PROFILE_SCHEMA = {
  type: "object",
  description: "可选，题材画像。用于让墨笔生花按题材和 storyEngine 选择不同创作策略。",
  properties: {
    primaryGenre: { type: "string" },
    subGenres: { type: "array", items: { type: "string" } },
    storyEngine: { type: "string" },
    audience: { type: "string" },
    tone: { type: "string" }
  },
  additionalProperties: true
} as const;

const EXTRA_INTRO_SECTIONS_SCHEMA = {
  type: "array",
  description: "可选，写入墨笔生花总介绍页的补充设定区块，例如世界观、武道体系、主要人物、势力设定、分卷规划。",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" }
    },
    additionalProperties: true
  }
} as const;

const COMIC_CHAPTER_IMAGE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    storyboardId: { type: "string", description: "可选，关联的章节分镜 id" },
    alt: { type: "string", description: "图片替代文本/画面名" },
    src: { type: "string", description: "图片 URL、file URL 或 data URL" },
    prompt: { type: "string", description: "用于复现或继续优化的生图提示词" },
    size: { type: "string", description: "例如 1024x1536" },
    quality: { type: "string", description: "例如 low / medium / high" },
    createdAt: { type: "string" }
  },
  additionalProperties: false
} as const;

const COMIC_SOURCE_REF_SCHEMA = {
  type: "object",
  properties: {
    sourceType: { type: "string", enum: ["web", "novel", "chapter", "file", "manual"] },
    sourceUrl: { type: "string", description: "来源 URL，可为小说目录页或章节页" },
    sourceTitle: { type: "string", description: "来源标题，例如原小说名" },
    chapterIndex: { type: "integer", minimum: 1, description: "原文或项目章节序号" },
    chapterTitle: { type: "string", description: "原文章节标题" },
    note: { type: "string", description: "来源、提取状态或版权/授权备注" }
  },
  additionalProperties: false
} as const;

const COMIC_SOURCE_META_SCHEMA = {
  type: "object",
  properties: {
    sourceType: { type: "string", enum: ["web", "novel", "file", "manual"] },
    sourceUrl: { type: "string", description: "原小说目录页、在线来源或本地文件来源" },
    sourceTitle: { type: "string", description: "原小说名或来源标题" },
    importedAt: { type: "string", description: "导入时间 ISO 字符串，可不传" },
    importedBy: { type: "string", description: "导入来源，例如 command-workshop" },
    chapterCount: { type: "integer", minimum: 1, description: "已发现或已导入章节数" },
    extractionStatus: { type: "string", enum: ["planned", "partial", "complete", "blocked"] },
    notes: { type: "string", description: "导入说明、失败原因、来源限制或后续待办" }
  },
  additionalProperties: false
} as const;

const COMIC_STORYBOARD_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    index: { type: "integer", minimum: 1 },
    kind: { type: "string", enum: ["dialogue", "scene", "action", "transition", "emotion", "other"] },
    title: { type: "string" },
    beat: { type: "string", description: "单条分镜的画面内容与故事节点" },
    dialogue: { type: "string", description: "对白、旁白或文字留白说明" },
    camera: { type: "string", description: "景别、构图、镜头运动、画面重心" },
    prompt: { type: "string", description: "可直接用于生成该分镜图片的生图提示词" },
    status: { type: "string", enum: ["todo", "inProgress", "done"] },
    imageIds: { type: "array", items: { type: "string" }, description: "关联图片 id" },
    updatedAt: { type: "string" }
  },
  additionalProperties: false
} as const;

const COMIC_CHAPTER_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    index: { type: "integer", minimum: 1 },
    title: { type: "string" },
    summary: { type: "string", description: "章节内容简介：故事事件、角色目标、冲突变化和结尾钩子" },
    prompt: { type: "string", description: "章节级分镜与出图提示词：图片数量建议、画面节点、景别、构图和一致性约束" },
    content: { type: "string", description: "可选章节正文/故事内容，可由小说正文、剧情草稿或本章完整文本转入，用作分镜和出图参考" },
    sourceRefs: { type: "array", items: COMIC_SOURCE_REF_SCHEMA, description: "可选，原小说/网页/文件来源引用" },
    status: { type: "string", enum: ["todo", "inProgress", "done"] },
    assetRefs: { type: "array", items: { type: "string" }, description: "引用素材 id" },
    storyboards: { type: "array", items: COMIC_STORYBOARD_SCHEMA, description: "章节内的分镜轨道，每条分镜对应一张或多张漫画图" },
    images: { type: "array", items: COMIC_CHAPTER_IMAGE_SCHEMA }
  },
  additionalProperties: false
} as const;

const COMIC_ASSET_VIEW_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["turnaround", "front", "side", "back", "angle", "wide", "detail"] },
    label: { type: "string" },
    src: { type: "string", description: "素材视图图片 URL、file URL 或 data URL" },
    prompt: { type: "string", description: "该视角的稳定视觉约束" }
  },
  additionalProperties: false
} as const;

const COMIC_ASSET_VARIANT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string", description: "版本名，例如 少年期 / 入山后 / 第11-30章战斗装" },
    chapterStartIndex: { type: "integer", minimum: 1 },
    chapterEndIndex: { type: "integer", minimum: 1 },
    description: { type: "string" },
    prompt: { type: "string", description: "该版本稳定出图提示词" },
    views: { type: "array", items: COMIC_ASSET_VIEW_SCHEMA },
    sourceRefs: { type: "array", items: COMIC_SOURCE_REF_SCHEMA },
    updatedAt: { type: "string" }
  },
  additionalProperties: false
} as const;

const COMIC_ASSET_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    type: { type: "string", enum: ["character", "prop", "scene"] },
    description: { type: "string" },
    prompt: { type: "string", description: "素材级出图一致性提示词" },
    variantLabel: { type: "string", description: "当前主版本标签，例如 初始形象 / 十章后 / 夜战装" },
    chapterStartIndex: { type: "integer", minimum: 1, description: "该素材主版本适用起始章节" },
    chapterEndIndex: { type: "integer", minimum: 1, description: "该素材主版本适用结束章节" },
    sourceRefs: { type: "array", items: COMIC_SOURCE_REF_SCHEMA },
    views: { type: "array", items: COMIC_ASSET_VIEW_SCHEMA },
    variants: { type: "array", items: COMIC_ASSET_VARIANT_SCHEMA, description: "可选，多阶段造型/场景状态版本" }
  },
  additionalProperties: false
} as const;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }

  const text = asString(value);

  if (!text) {
    return [];
  }

  return text
    .split(/[,，、\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function asPositiveInteger(value: unknown, fallback: number, max = 100): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function asWritingBookLength(value: unknown): WritingBookLength {
  const normalized = asString(value);

  if (["short", "medium", "long"].includes(normalized)) {
    return normalized as WritingBookLength;
  }

  if (/短篇/u.test(normalized)) {
    return "short";
  }

  if (/长篇|長篇/u.test(normalized)) {
    return "long";
  }

  return "medium";
}

function asWritingChapterStatus(value: unknown): WritingChapter["status"] {
  const normalized = asString(value);

  if (["todo", "inProgress", "done"].includes(normalized)) {
    return normalized as WritingChapter["status"];
  }

  if (/完成|done/u.test(normalized)) {
    return "done";
  }

  if (/进行|編写|编写|in.?progress/u.test(normalized)) {
    return "inProgress";
  }

  return "todo";
}

function asComicProjectFormat(value: unknown): ComicProjectFormat {
  const normalized = asString(value);
  return ["poster", "serial"].includes(normalized) ? (normalized as ComicProjectFormat) : "poster";
}

function asComicProjectPalette(value: unknown): ComicProjectPalette {
  const normalized = asString(value);
  return ["monochrome", "color"].includes(normalized) ? (normalized as ComicProjectPalette) : "color";
}

function asComicChapterStatus(value: unknown): ComicChapterStatus {
  const normalized = asString(value);

  if (["todo", "inProgress", "done"].includes(normalized)) {
    return normalized as ComicChapterStatus;
  }

  if (/完成|done/u.test(normalized)) {
    return "done";
  }

  if (/进行|繪制|绘制|生成|in.?progress/u.test(normalized)) {
    return "inProgress";
  }

  return "todo";
}

function asComicStoryboardKind(value: unknown): ComicStoryboardKind {
  const normalized = asString(value);
  return ["dialogue", "scene", "action", "transition", "emotion", "other"].includes(normalized)
    ? (normalized as ComicStoryboardKind)
    : "other";
}

function asComicAssetType(value: unknown): ComicAssetType {
  const normalized = asString(value);
  return ["character", "prop", "scene"].includes(normalized) ? (normalized as ComicAssetType) : "character";
}

function asComicAssetViewKind(value: unknown): ComicAssetViewKind {
  const normalized = asString(value);
  return ["turnaround", "front", "side", "back", "angle", "wide", "detail"].includes(normalized)
    ? (normalized as ComicAssetViewKind)
    : "angle";
}

function asOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function asComicSourceRefType(value: unknown): ComicSourceRef["sourceType"] {
  const normalized = asString(value);
  return ["web", "novel", "chapter", "file", "manual"].includes(normalized)
    ? (normalized as ComicSourceRef["sourceType"])
    : "manual";
}

function asComicProjectSourceType(value: unknown): ComicSourceMeta["sourceType"] {
  const normalized = asString(value);
  return ["web", "novel", "file", "manual"].includes(normalized)
    ? (normalized as ComicSourceMeta["sourceType"])
    : "manual";
}

function asComicProjectExtractionStatus(value: unknown): ComicSourceMeta["extractionStatus"] | undefined {
  const normalized = asString(value);
  return ["planned", "partial", "complete", "blocked"].includes(normalized)
    ? (normalized as ComicSourceMeta["extractionStatus"])
    : undefined;
}

function asNarrativeRiskLevel(value: unknown): WritingNarrativeRiskLevel {
  const normalized = asString(value);
  return ["low", "medium", "high"].includes(normalized) ? (normalized as WritingNarrativeRiskLevel) : "low";
}

function createLocalId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function createEmptyWritingStoryAssets(bookId: string, premise: string, timestamp: string): WritingBook["storyAssets"] {
  return {
    premise,
    worldview: [],
    characters: [],
    relationships: [],
    timeline: [],
    foreshadows: [],
    rules: [],
    characterArcs: [],
    styleProfile: {
      voice: "",
      pacing: "",
      genreSignals: [],
      taboos: []
    },
    memoryNotes: [],
    updatedAt: timestamp
  };
}

function normalizeGenreProfileInput(value: unknown, fallbackGenre: string, timestamp: string): WritingGenreProfile {
  const source = isObject(value) ? value : {};
  const fallbackParts = asStringList(fallbackGenre);
  const primaryGenre = asString(source.primaryGenre ?? source.genre ?? fallbackParts[0] ?? fallbackGenre);
  const storyEngine = asString(source.storyEngine ?? source.engine);

  return {
    primaryGenre: primaryGenre || "小说",
    subGenres: asStringList(source.subGenres ?? source.subgenres ?? fallbackParts.slice(1)),
    storyEngine: storyEngine === "成长升级" ? "成长沉淀" : storyEngine,
    ...(asString(source.audience) ? { audience: asString(source.audience) } : {}),
    ...(asString(source.tone) ? { tone: asString(source.tone) } : {}),
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeEvidenceRef(value: unknown, index: number, bookId: string): WritingEvidenceRef | null {
  const source = isObject(value) ? value : { note: value };
  const note = asString(source.note ?? source.summary ?? source.detail ?? source.evidence);
  const quote = asString(source.quote ?? source.text);
  const chapterIndex = asOptionalPositiveInteger(source.chapterIndex ?? source.chapter);
  const chapterId = asString(source.chapterId);

  if (!note && !quote && !chapterIndex && !chapterId) {
    return null;
  }

  return {
    id: asString(source.id) || `${bookId}_evidence_${index + 1}`,
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(quote ? { quote } : {}),
    note: note || quote || (chapterIndex ? `第${chapterIndex}章证据` : "证据")
  };
}

function normalizeEvidenceRefs(value: unknown, bookId: string): WritingEvidenceRef[] {
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => normalizeEvidenceRef(entry, index, bookId))
      .filter((entry): entry is WritingEvidenceRef => Boolean(entry));
  }

  const normalized = normalizeEvidenceRef(value, 0, bookId);
  return normalized ? [normalized] : [];
}

function normalizeEvidenceRefsFromSource(source: JsonObject, bookId: string): WritingEvidenceRef[] {
  const explicit = normalizeEvidenceRefs(source.evidenceRefs, bookId);
  const legacyEvidence = normalizeEvidenceRefs(source.evidence ?? source.evidenceText, bookId);
  const chapterIndex = asOptionalPositiveInteger(source.chapterIndex ?? source.chapter);
  const chapterId = asString(source.chapterId);

  if (!chapterIndex && !chapterId) {
    return [...explicit, ...legacyEvidence];
  }

  return [
    ...explicit,
    ...legacyEvidence,
    {
      id: `${bookId}_chapter_evidence_${chapterId || chapterIndex || explicit.length + legacyEvidence.length + 1}`,
      ...(chapterIndex ? { chapterIndex } : {}),
      ...(chapterId ? { chapterId } : {}),
      note: chapterIndex ? `第${chapterIndex}章出现或更新` : "章节证据"
    }
  ];
}

function normalizeNarrativeStateNode(
  value: unknown,
  index: number,
  bookId: string,
  kind: WritingNarrativeStateNode["kind"],
  timestamp: string
): WritingNarrativeStateNode | null {
  const source = isObject(value) ? value : { summary: value };
  const label = asString(source.label ?? source.title ?? source.name);
  const summary = asString(source.summary ?? source.detail ?? source.description ?? source.setup);

  if (!label && !summary) {
    return null;
  }

  return {
    id: asString(source.id) || `${bookId}_${kind}_${index + 1}`,
    kind,
    label: label || `未命名${kind} ${index + 1}`,
    summary,
    status: asString(source.status) || "active",
    ...(asOptionalPositiveInteger(source.introducedAtChapterIndex ?? source.chapterIndex) ? {
      introducedAtChapterIndex: asOptionalPositiveInteger(source.introducedAtChapterIndex ?? source.chapterIndex)
    } : {}),
    ...(asOptionalPositiveInteger(source.payoffDeadlineChapterIndex) ? {
      payoffDeadlineChapterIndex: asOptionalPositiveInteger(source.payoffDeadlineChapterIndex)
    } : {}),
    ...(asOptionalPositiveInteger(source.resolvedAtChapterIndex) ? {
      resolvedAtChapterIndex: asOptionalPositiveInteger(source.resolvedAtChapterIndex)
    } : {}),
    evidenceChapterIds: asStringList(source.evidenceChapterIds),
    evidenceRefs: normalizeEvidenceRefsFromSource(source, bookId),
    ...(asString(source.impact) ? { impact: asString(source.impact) } : {}),
    relatedNodeIds: asStringList(source.relatedNodeIds),
    riskLevel: asNarrativeRiskLevel(source.riskLevel),
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeNarrativeStateNodeList(
  value: unknown,
  bookId: string,
  kind: WritingNarrativeStateNode["kind"],
  timestamp: string
): WritingNarrativeStateNode[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeNarrativeStateNode(entry, index, bookId, kind, timestamp))
    .filter((entry): entry is WritingNarrativeStateNode => Boolean(entry));
}

function createEmptyWritingNarrativeState(bookId: string, timestamp: string): WritingBook["narrativeState"] {
  return {
    characters: [],
    worldRules: [],
    resources: [],
    regions: [],
    foreshadows: [],
    arcs: [],
    timelineEvents: [],
    continuityWarnings: [],
    planDriftNotes: [],
    updatedAt: timestamp
  };
}

function normalizeWritingNarrativeStateInput(value: unknown, bookId: string, timestamp: string): WritingBook["narrativeState"] {
  const source = isObject(value) ? value : {};

  return {
    characters: normalizeNarrativeStateNodeList(source.characters, bookId, "character", timestamp),
    worldRules: normalizeNarrativeStateNodeList(source.worldRules, bookId, "worldRule", timestamp),
    resources: normalizeNarrativeStateNodeList(source.resources, bookId, "resource", timestamp),
    regions: normalizeNarrativeStateNodeList(source.regions, bookId, "region", timestamp),
    foreshadows: normalizeNarrativeStateNodeList(source.foreshadows, bookId, "foreshadow", timestamp),
    arcs: normalizeNarrativeStateNodeList(source.arcs, bookId, "arc", timestamp),
    timelineEvents: normalizeNarrativeStateNodeList(source.timelineEvents, bookId, "timelineEvent", timestamp),
    continuityWarnings: normalizeNarrativeStateNodeList(source.continuityWarnings, bookId, "continuityWarning", timestamp),
    planDriftNotes: normalizeNarrativeStateNodeList(source.planDriftNotes, bookId, "planDrift", timestamp),
    updatedAt: timestamp
  };
}

function normalizeStoryAssetEntry(
  value: unknown,
  index: number,
  bookId: string,
  group: string,
  timestamp: string
): WritingStoryAssetEntry | null {
  const source = isObject(value) ? value : { detail: value };
  const title = asString(source.title ?? source.name ?? source.key);
  const detail = asString(source.detail ?? source.description ?? source.summary ?? source.value ?? source.content);
  const chapterIndex = asOptionalPositiveInteger(source.chapterIndex ?? source.chapter);

  if (!title && !detail) {
    return null;
  }

  return {
    id: asString(source.id) || `${bookId}_${group}_${index + 1}`,
    title: title || `未命名${group} ${index + 1}`,
    detail,
    tags: asStringList(source.tags),
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(asString(source.status) ? { status: asString(source.status) } : {}),
    evidenceRefs: normalizeEvidenceRefsFromSource(source, bookId),
    ...(asString(source.impact) ? { impact: asString(source.impact) } : {}),
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeStoryAssetEntries(value: unknown, bookId: string, group: string, timestamp: string): WritingStoryAssetEntry[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeStoryAssetEntry(entry, index, bookId, group, timestamp))
    .filter((entry): entry is WritingStoryAssetEntry => Boolean(entry));
}

function normalizeCharacterAsset(
  value: unknown,
  index: number,
  bookId: string,
  timestamp: string
): WritingCharacterAsset | null {
  const source = isObject(value) ? value : { name: value };
  const name = asString(source.name ?? source.title);
  const relationships = asStringList(source.relationships);

  if (
    !name &&
    !asString(source.role) &&
    !asString(source.goal) &&
    !asString(source.fear) &&
    !asString(source.secret) &&
    !asString(source.growthArc ?? source.growth_arc) &&
    !relationships.length
  ) {
    return null;
  }

  return {
    id: asString(source.id) || `${bookId}_character_${index + 1}`,
    name: name || `未命名人物 ${index + 1}`,
    role: asString(source.role),
    goal: asString(source.goal),
    fear: asString(source.fear),
    secret: asString(source.secret),
    growthArc: asString(source.growthArc ?? source.growth_arc),
    relationships,
    tags: asStringList(source.tags),
    status: asString(source.status) || "active",
    evidenceRefs: normalizeEvidenceRefsFromSource(source, bookId),
    ...(asString(source.impact) ? { impact: asString(source.impact) } : {}),
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeCharacterAssets(value: unknown, bookId: string, timestamp: string): WritingCharacterAsset[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeCharacterAsset(entry, index, bookId, timestamp))
    .filter((entry): entry is WritingCharacterAsset => Boolean(entry));
}

function normalizeForeshadowAsset(
  value: unknown,
  index: number,
  bookId: string,
  timestamp: string
): WritingForeshadowAsset | null {
  const source = isObject(value) ? value : { setup: value };
  const title = asString(source.title ?? source.name);
  const setup = asString(source.setup ?? source.detail ?? source.description);
  const payoff = asString(source.payoff ?? source.plannedPayoff ?? source.payoffPlan);
  const chapterIndex = asOptionalPositiveInteger(source.chapterIndex ?? source.setupChapterIndex);
  const payoffChapterIndex = asOptionalPositiveInteger(source.payoffChapterIndex);

  if (!title && !setup && !payoff) {
    return null;
  }

  return {
    id: asString(source.id) || `${bookId}_foreshadow_${index + 1}`,
    title: title || setup || `未命名伏笔 ${index + 1}`,
    setup,
    payoff,
    status: asString(source.status) || "open",
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(payoffChapterIndex ? { payoffChapterIndex } : {}),
    tags: asStringList(source.tags),
    evidenceRefs: normalizeEvidenceRefsFromSource(source, bookId),
    ...(asString(source.impact) ? { impact: asString(source.impact) } : {}),
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeForeshadowAssets(value: unknown, bookId: string, timestamp: string): WritingForeshadowAsset[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeForeshadowAsset(entry, index, bookId, timestamp))
    .filter((entry): entry is WritingForeshadowAsset => Boolean(entry));
}

function normalizeCharacterArc(value: unknown, index: number, bookId: string, timestamp: string): WritingCharacterArc | null {
  const source = isObject(value) ? value : { characterName: value };
  const characterName = asString(source.characterName ?? source.name ?? source.title);
  const want = asString(source.want ?? source.goal);
  const need = asString(source.need);
  const currentStage = asString(source.currentStage ?? source.stage);
  const nextPressure = asString(source.nextPressure ?? source.pressure);
  const endpoint = asString(source.endpoint ?? source.endState ?? source.payoff);

  if (!characterName && !want && !need && !currentStage && !nextPressure && !endpoint) {
    return null;
  }

  return {
    id: asString(source.id) || `${bookId}_character_arc_${index + 1}`,
    characterName: characterName || `未命名人物 ${index + 1}`,
    want,
    need,
    currentStage,
    nextPressure,
    endpoint,
    evidenceRefs: normalizeEvidenceRefsFromSource(source, bookId),
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeCharacterArcs(value: unknown, bookId: string, timestamp: string): WritingCharacterArc[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeCharacterArc(entry, index, bookId, timestamp))
    .filter((entry): entry is WritingCharacterArc => Boolean(entry));
}

function normalizeWritingStoryAssetsInput(value: unknown, bookId: string, timestamp: string): WritingBook["storyAssets"] {
  const source = isObject(value) ? value : {};

  return {
    premise: asString(source.premise),
    worldview: normalizeStoryAssetEntries(source.worldview, bookId, "worldview", timestamp),
    characters: normalizeCharacterAssets(source.characters, bookId, timestamp),
    relationships: normalizeStoryAssetEntries(source.relationships, bookId, "relationship", timestamp),
    timeline: normalizeStoryAssetEntries(source.timeline, bookId, "timeline", timestamp),
    foreshadows: normalizeForeshadowAssets(source.foreshadows, bookId, timestamp),
    rules: normalizeStoryAssetEntries(source.rules, bookId, "rule", timestamp),
    characterArcs: normalizeCharacterArcs(source.characterArcs, bookId, timestamp),
    styleProfile: {
      voice: asString(isObject(source.styleProfile) ? source.styleProfile.voice : ""),
      pacing: asString(isObject(source.styleProfile) ? source.styleProfile.pacing : ""),
      genreSignals: asStringList(isObject(source.styleProfile) ? source.styleProfile.genreSignals : []),
      taboos: asStringList(isObject(source.styleProfile) ? source.styleProfile.taboos : []),
      ...(isObject(source.styleProfile) && asString(source.styleProfile.proseDensity) ? { proseDensity: asString(source.styleProfile.proseDensity) } : {}),
      ...(isObject(source.styleProfile) && asString(source.styleProfile.dialogueRatio) ? { dialogueRatio: asString(source.styleProfile.dialogueRatio) } : {}),
      ...(isObject(source.styleProfile) && asString(source.styleProfile.narrationDistance) ? { narrationDistance: asString(source.styleProfile.narrationDistance) } : {}),
      ...(isObject(source.styleProfile) && asString(source.styleProfile.emotionalTemperature) ? { emotionalTemperature: asString(source.styleProfile.emotionalTemperature) } : {}),
      ...(isObject(source.styleProfile) && asString(source.styleProfile.humorLevel) ? { humorLevel: asString(source.styleProfile.humorLevel) } : {}),
      ...(isObject(source.styleProfile) && asString(source.styleProfile.violenceExplicitness) ? { violenceExplicitness: asString(source.styleProfile.violenceExplicitness) } : {}),
      ...(isObject(source.styleProfile) && asStringList(source.styleProfile.pacingCurve).length ? { pacingCurve: asStringList(source.styleProfile.pacingCurve) } : {})
    },
    memoryNotes: normalizeStoryAssetEntries(source.memoryNotes, bookId, "memory", timestamp),
    updatedAt: timestamp
  };
}

function normalizeExtraIntroSections(value: unknown, bookId: string, timestamp: string): WritingBookIntroSection[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => {
      const source: JsonObject = isObject(entry) ? entry : { content: entry };
      const title = asString(source.title);
      const content = String(source.content ?? source.detail ?? source.description ?? "");

      if (!title && !content.trim()) {
        return null;
      }

      return {
        id: asString(source.id) || `${bookId}_section_${index + 1}`,
        title: title || `补充设定 ${index + 1}`,
        content,
        updatedAt: asString(source.updatedAt) || timestamp
      };
    })
    .filter((entry): entry is WritingBookIntroSection => Boolean(entry));
}

function normalizeAssetMergeKey(value: unknown): string {
  return asString(value).replace(/\s+/g, "").toLowerCase();
}

function mergeEvidenceRefs(existingRefs: WritingEvidenceRef[], incomingRefs: WritingEvidenceRef[]): WritingEvidenceRef[] {
  const byKey = new Map<string, WritingEvidenceRef>();

  for (const ref of [...existingRefs, ...incomingRefs]) {
    const key = normalizeAssetMergeKey(ref.id || `${ref.chapterId || ""}:${ref.chapterIndex || ""}:${ref.quote || ""}:${ref.note || ""}`);

    if (!key) {
      continue;
    }

    byKey.set(key, {
      ...byKey.get(key),
      ...ref,
      note: ref.note || byKey.get(key)?.note || "证据"
    });
  }

  return Array.from(byKey.values());
}

function mergeStoryAssetEntries(existingEntries: WritingStoryAssetEntry[], incomingEntries: WritingStoryAssetEntry[]): WritingStoryAssetEntry[] {
  const byKey = new Map<string, WritingStoryAssetEntry>();

  for (const entry of existingEntries) {
    const key = normalizeAssetMergeKey(entry.title || entry.detail);

    if (key) {
      byKey.set(key, entry);
    }
  }

  for (const entry of incomingEntries) {
    const key = normalizeAssetMergeKey(entry.title || entry.detail);
    const current = key ? byKey.get(key) : null;

    if (!key) {
      continue;
    }

    byKey.set(
      key,
      current
        ? {
            ...current,
            title: entry.title || current.title,
            detail: entry.detail || current.detail,
            tags: Array.from(new Set([...current.tags, ...entry.tags])),
            chapterIndex: entry.chapterIndex ?? current.chapterIndex,
            status: entry.status || current.status,
            evidenceRefs: mergeEvidenceRefs(current.evidenceRefs, entry.evidenceRefs),
            impact: entry.impact || current.impact,
            updatedAt: entry.updatedAt
          }
        : entry
    );
  }

  return Array.from(byKey.values());
}

function mergeCharacterAssets(existingEntries: WritingCharacterAsset[], incomingEntries: WritingCharacterAsset[]): WritingCharacterAsset[] {
  const byKey = new Map<string, WritingCharacterAsset>();

  for (const entry of existingEntries) {
    const key = normalizeAssetMergeKey(entry.name);

    if (key) {
      byKey.set(key, entry);
    }
  }

  for (const entry of incomingEntries) {
    const key = normalizeAssetMergeKey(entry.name);
    const current = key ? byKey.get(key) : null;

    if (!key) {
      continue;
    }

    byKey.set(
      key,
      current
        ? {
            ...current,
            role: entry.role || current.role,
            goal: entry.goal || current.goal,
            fear: entry.fear || current.fear,
            secret: entry.secret || current.secret,
            growthArc: entry.growthArc || current.growthArc,
            relationships: Array.from(new Set([...current.relationships, ...entry.relationships])),
            tags: Array.from(new Set([...current.tags, ...entry.tags])),
            status: entry.status || current.status,
            evidenceRefs: mergeEvidenceRefs(current.evidenceRefs, entry.evidenceRefs),
            impact: entry.impact || current.impact,
            updatedAt: entry.updatedAt
          }
        : entry
    );
  }

  return Array.from(byKey.values());
}

function mergeForeshadowAssets(existingEntries: WritingForeshadowAsset[], incomingEntries: WritingForeshadowAsset[]): WritingForeshadowAsset[] {
  const byKey = new Map<string, WritingForeshadowAsset>();

  for (const entry of existingEntries) {
    const key = normalizeAssetMergeKey(entry.title || entry.setup);

    if (key) {
      byKey.set(key, entry);
    }
  }

  for (const entry of incomingEntries) {
    const key = normalizeAssetMergeKey(entry.title || entry.setup);
    const current = key ? byKey.get(key) : null;

    if (!key) {
      continue;
    }

    byKey.set(
      key,
      current
        ? {
            ...current,
            title: entry.title || current.title,
            setup: entry.setup || current.setup,
            payoff: entry.payoff || current.payoff,
            status: entry.status || current.status,
            chapterIndex: entry.chapterIndex ?? current.chapterIndex,
            payoffChapterIndex: entry.payoffChapterIndex ?? current.payoffChapterIndex,
            tags: Array.from(new Set([...current.tags, ...entry.tags])),
            evidenceRefs: mergeEvidenceRefs(current.evidenceRefs, entry.evidenceRefs),
            impact: entry.impact || current.impact,
            updatedAt: entry.updatedAt
          }
        : entry
    );
  }

  return Array.from(byKey.values());
}

function mergeCharacterArcs(existingEntries: WritingCharacterArc[], incomingEntries: WritingCharacterArc[]): WritingCharacterArc[] {
  const byKey = new Map<string, WritingCharacterArc>();

  for (const entry of existingEntries) {
    const key = normalizeAssetMergeKey(entry.characterName);

    if (key) {
      byKey.set(key, entry);
    }
  }

  for (const entry of incomingEntries) {
    const key = normalizeAssetMergeKey(entry.characterName);
    const current = key ? byKey.get(key) : null;

    if (!key) {
      continue;
    }

    byKey.set(
      key,
      current
        ? {
            ...current,
            want: entry.want || current.want,
            need: entry.need || current.need,
            currentStage: entry.currentStage || current.currentStage,
            nextPressure: entry.nextPressure || current.nextPressure,
            endpoint: entry.endpoint || current.endpoint,
            evidenceRefs: mergeEvidenceRefs(current.evidenceRefs, entry.evidenceRefs),
            updatedAt: entry.updatedAt
          }
        : entry
    );
  }

  return Array.from(byKey.values());
}

function mergeWritingStoryAssets(
  currentAssets: WritingBook["storyAssets"],
  incomingAssets: WritingBook["storyAssets"],
  mode: string,
  timestamp: string
): WritingBook["storyAssets"] {
  if (mode === "replace") {
    return {
      ...incomingAssets,
      updatedAt: timestamp
    };
  }

  return {
    premise: incomingAssets.premise || currentAssets.premise,
    worldview: mergeStoryAssetEntries(currentAssets.worldview, incomingAssets.worldview),
    characters: mergeCharacterAssets(currentAssets.characters, incomingAssets.characters),
    relationships: mergeStoryAssetEntries(currentAssets.relationships, incomingAssets.relationships),
    timeline: mergeStoryAssetEntries(currentAssets.timeline, incomingAssets.timeline),
    foreshadows: mergeForeshadowAssets(currentAssets.foreshadows, incomingAssets.foreshadows),
    rules: mergeStoryAssetEntries(currentAssets.rules, incomingAssets.rules),
    characterArcs: mergeCharacterArcs(currentAssets.characterArcs, incomingAssets.characterArcs),
    styleProfile: {
      voice: incomingAssets.styleProfile.voice || currentAssets.styleProfile.voice,
      pacing: incomingAssets.styleProfile.pacing || currentAssets.styleProfile.pacing,
      genreSignals: Array.from(new Set([...currentAssets.styleProfile.genreSignals, ...incomingAssets.styleProfile.genreSignals])),
      taboos: Array.from(new Set([...currentAssets.styleProfile.taboos, ...incomingAssets.styleProfile.taboos])),
      proseDensity: incomingAssets.styleProfile.proseDensity || currentAssets.styleProfile.proseDensity || "",
      dialogueRatio: incomingAssets.styleProfile.dialogueRatio || currentAssets.styleProfile.dialogueRatio || "",
      narrationDistance: incomingAssets.styleProfile.narrationDistance || currentAssets.styleProfile.narrationDistance || "",
      emotionalTemperature: incomingAssets.styleProfile.emotionalTemperature || currentAssets.styleProfile.emotionalTemperature || "",
      humorLevel: incomingAssets.styleProfile.humorLevel || currentAssets.styleProfile.humorLevel || "",
      violenceExplicitness: incomingAssets.styleProfile.violenceExplicitness || currentAssets.styleProfile.violenceExplicitness || "",
      pacingCurve: Array.from(new Set([...(currentAssets.styleProfile.pacingCurve ?? []), ...(incomingAssets.styleProfile.pacingCurve ?? [])]))
    },
    memoryNotes: mergeStoryAssetEntries(currentAssets.memoryNotes, incomingAssets.memoryNotes),
    updatedAt: timestamp
  };
}

function mergeExtraIntroSections(
  currentSections: WritingBookIntroSection[],
  incomingSections: WritingBookIntroSection[],
  mode: string
): WritingBookIntroSection[] {
  if (mode === "replace") {
    return incomingSections;
  }

  const byKey = new Map<string, WritingBookIntroSection>();

  for (const section of currentSections) {
    const key = normalizeAssetMergeKey(section.title);

    if (key) {
      byKey.set(key, section);
    }
  }

  for (const section of incomingSections) {
    const key = normalizeAssetMergeKey(section.title || section.content);
    const current = key ? byKey.get(key) : null;

    if (!key) {
      continue;
    }

    byKey.set(
      key,
      current
        ? {
            ...current,
            title: section.title || current.title,
            content: section.content || current.content,
            updatedAt: section.updatedAt
          }
        : section
    );
  }

  return Array.from(byKey.values());
}

function mergeNarrativeStateNodes(
  currentNodes: WritingNarrativeStateNode[],
  incomingNodes: WritingNarrativeStateNode[],
  mode: string
): WritingNarrativeStateNode[] {
  if (mode === "replace") {
    return incomingNodes;
  }

  const byKey = new Map<string, WritingNarrativeStateNode>();

  for (const node of currentNodes) {
    const key = normalizeAssetMergeKey(node.label);

    if (key) {
      byKey.set(key, node);
    }
  }

  for (const node of incomingNodes) {
    const key = normalizeAssetMergeKey(node.label);
    const current = byKey.get(key);

    if (!key) {
      continue;
    }

    byKey.set(
      key,
      current
        ? {
            ...current,
            label: node.label || current.label,
            summary: node.summary || current.summary,
            status: node.status || current.status,
            introducedAtChapterIndex: node.introducedAtChapterIndex ?? current.introducedAtChapterIndex,
            payoffDeadlineChapterIndex: node.payoffDeadlineChapterIndex ?? current.payoffDeadlineChapterIndex,
            resolvedAtChapterIndex: node.resolvedAtChapterIndex ?? current.resolvedAtChapterIndex,
            evidenceChapterIds: Array.from(new Set([...current.evidenceChapterIds, ...node.evidenceChapterIds])),
            evidenceRefs: mergeEvidenceRefs(current.evidenceRefs, node.evidenceRefs),
            impact: node.impact || current.impact,
            relatedNodeIds: Array.from(new Set([...current.relatedNodeIds, ...node.relatedNodeIds])),
            riskLevel: node.riskLevel || current.riskLevel,
            updatedAt: node.updatedAt
          }
        : node
    );
  }

  return Array.from(byKey.values());
}

function mergeWritingNarrativeState(
  currentState: WritingBook["narrativeState"],
  incomingState: WritingBook["narrativeState"],
  mode: string,
  timestamp: string
): WritingBook["narrativeState"] {
  if (mode === "replace") {
    return {
      ...incomingState,
      updatedAt: timestamp
    };
  }

  return {
    characters: mergeNarrativeStateNodes(currentState.characters, incomingState.characters, mode),
    worldRules: mergeNarrativeStateNodes(currentState.worldRules, incomingState.worldRules, mode),
    resources: mergeNarrativeStateNodes(currentState.resources, incomingState.resources, mode),
    regions: mergeNarrativeStateNodes(currentState.regions, incomingState.regions, mode),
    foreshadows: mergeNarrativeStateNodes(currentState.foreshadows, incomingState.foreshadows, mode),
    arcs: mergeNarrativeStateNodes(currentState.arcs, incomingState.arcs, mode),
    timelineEvents: mergeNarrativeStateNodes(currentState.timelineEvents, incomingState.timelineEvents, mode),
    continuityWarnings: mergeNarrativeStateNodes(currentState.continuityWarnings, incomingState.continuityWarnings, mode),
    planDriftNotes: mergeNarrativeStateNodes(currentState.planDriftNotes, incomingState.planDriftNotes, mode),
    updatedAt: timestamp
  };
}

function summarizeStoryAssets(assets: WritingBook["storyAssets"]): JsonObject {
  return {
    premise: Boolean(assets.premise),
    worldview: assets.worldview.length,
    characters: assets.characters.length,
    relationships: assets.relationships.length,
    timeline: assets.timeline.length,
    foreshadows: assets.foreshadows.length,
    rules: assets.rules.length,
    characterArcs: assets.characterArcs.length,
    memoryNotes: assets.memoryNotes.length,
    styleProfile: Boolean(
      assets.styleProfile.voice ||
        assets.styleProfile.pacing ||
        assets.styleProfile.genreSignals.length ||
        assets.styleProfile.taboos.length ||
        assets.styleProfile.proseDensity ||
        assets.styleProfile.dialogueRatio ||
        assets.styleProfile.narrationDistance ||
        assets.styleProfile.emotionalTemperature ||
        assets.styleProfile.humorLevel ||
        assets.styleProfile.violenceExplicitness ||
        assets.styleProfile.pacingCurve?.length
    )
  };
}

function summarizeNarrativeState(state: WritingBook["narrativeState"]): JsonObject {
  return {
    characters: state.characters.length,
    worldRules: state.worldRules.length,
    resources: state.resources.length,
    regions: state.regions.length,
    foreshadows: state.foreshadows.length,
    arcs: state.arcs.length,
    timelineEvents: state.timelineEvents.length,
    continuityWarnings: state.continuityWarnings.length,
    planDriftNotes: state.planDriftNotes.length
  };
}

function truncateText(value: unknown, maxChars = MAX_TEXT_CHARS): string {
  const text = String(value ?? "");

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n...（已截断 ${text.length - maxChars} 字）`;
}

function compactText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getUnifiedWritingOutlineGuide(book: Pick<WritingBook, "outlineGuide" | "seriesPlan">): string {
  return String(book.seriesPlan ?? "").trim() || String(book.outlineGuide ?? "");
}

function chapterLabel(chapter: WritingChapter): string {
  return `第 ${chapter.index} 章 ${chapter.title}`;
}

function summarizeBook(book: WritingBook, includeChapters = false): JsonObject {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    genre: book.genre,
    genreProfile: book.genreProfile,
    status: book.status,
    length: book.length,
    updatedAt: book.updatedAt,
    directoryName: book.directoryName,
    chapterCount: book.chapters.length,
    doneChapterCount: book.chapters.filter((chapter) => chapter.status === "done").length,
    narrativeState: summarizeNarrativeState(book.narrativeState),
    ...(includeChapters
      ? {
          chapters: book.chapters.map((chapter) => ({
            id: chapter.id,
            index: chapter.index,
            title: chapter.title,
            status: chapter.status,
            summary: chapter.summary,
            updatedAt: chapter.updatedAt,
            wordCount: String(chapter.content ?? "").length
          }))
        }
      : {})
  };
}

function summarizeComicProject(project: ComicProject, includeChapters = false, includeAssets = false): JsonObject {
  return {
    id: project.id,
    title: project.title,
    format: project.format,
    palette: project.palette,
    genre: project.genre,
    status: project.status,
    pageCount: project.pageCount,
    updatedAt: project.updatedAt,
    chapterCount: project.chapters.length,
    assetCount: project.assets.length,
    imageCount: project.chapters.reduce((sum, chapter) => sum + chapter.images.length, 0),
    storyboardCount: project.chapters.reduce((sum, chapter) => sum + chapter.storyboards.length, 0),
    source: project.source,
    ...(includeChapters
      ? {
          chapters: project.chapters.map((chapter) => ({
            id: chapter.id,
            index: chapter.index,
            title: chapter.title,
            status: chapter.status,
            summary: chapter.summary,
            sourceRefs: chapter.sourceRefs,
            storyboardCount: chapter.storyboards.length,
            imageCount: chapter.images.length,
            assetRefs: chapter.assetRefs,
            updatedAt: chapter.updatedAt
          }))
        }
      : {}),
    ...(includeAssets
      ? {
          assets: project.assets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            description: truncateText(asset.description, 1200),
            prompt: truncateText(asset.prompt, 1200),
            variantLabel: asset.variantLabel,
            chapterStartIndex: asset.chapterStartIndex,
            chapterEndIndex: asset.chapterEndIndex,
            variantCount: asset.variants?.length ?? 0,
            viewCount: asset.views.length,
            filledViewCount: asset.views.filter((view) => asString(view.src)).length,
            updatedAt: asset.updatedAt
          }))
        }
      : {})
  };
}

function findWritingBook(books: WritingBook[], bookIdOrTitle: string): WritingBook {
  const query = bookIdOrTitle.trim();

  if (!query) {
    throw new Error("bookIdOrTitle 不能为空");
  }

  const exact =
    books.find((book) => book.id === query) ??
    books.find((book) => book.title === query) ??
    books.find((book) => book.directoryName === query);

  if (exact) {
    return exact;
  }

  const candidates = books.filter(
    (book) => book.title.includes(query) || query.includes(book.title) || String(book.directoryName ?? "").includes(query)
  );

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    throw new Error(`找到多本可能匹配的小说：${candidates.map((book) => book.title).join("、")}，请使用更精确的书名或 bookId。`);
  }

  throw new Error(`没有找到小说：${query}`);
}

function findComicProject(projects: ComicProject[], projectIdOrTitle: string): ComicProject {
  const query = projectIdOrTitle.trim();

  if (!query) {
    throw new Error("projectIdOrTitle 不能为空");
  }

  const exact = projects.find((project) => project.id === query) ?? projects.find((project) => project.title === query);

  if (exact) {
    return exact;
  }

  const candidates = projects.filter((project) => project.title.includes(query) || query.includes(project.title));

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    throw new Error(`找到多个可能匹配的漫画项目：${candidates.map((project) => project.title).join("、")}，请使用更精确的项目名或 projectId。`);
  }

  throw new Error(`没有找到漫画项目：${query}`);
}

function findWritingChapter(book: WritingBook, args: JsonObject): WritingChapter {
  const chapterId = asString(args.chapterId);
  const chapterTitle = asString(args.chapterTitle);
  const rawChapterIndex = args.chapterIndex;
  const chapterIndex =
    rawChapterIndex === undefined || rawChapterIndex === null || rawChapterIndex === ""
      ? null
      : Number(rawChapterIndex);

  if (chapterId) {
    const chapter = book.chapters.find((entry) => entry.id === chapterId);

    if (chapter) {
      return chapter;
    }
  }

  if (typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex > 0) {
    const chapter = book.chapters.find((entry) => entry.index === chapterIndex);

    if (chapter) {
      return chapter;
    }
  }

  if (chapterTitle) {
    const exact = book.chapters.find((entry) => entry.title === chapterTitle);

    if (exact) {
      return exact;
    }

    const candidates = book.chapters.filter((entry) => entry.title.includes(chapterTitle) || chapterTitle.includes(entry.title));

    if (candidates.length === 1) {
      return candidates[0];
    }

    if (candidates.length > 1) {
      throw new Error(`找到多个章节标题匹配：${candidates.map(chapterLabel).join("、")}，请使用 chapterIndex 或 chapterId。`);
    }
  }

  throw new Error("没有找到目标章节，请提供 chapterId、chapterIndex 或 chapterTitle。");
}

function findComicChapter(project: ComicProject, args: JsonObject): ComicChapter {
  const chapterId = asString(args.chapterId);
  const chapterTitle = asString(args.chapterTitle);
  const rawChapterIndex = args.chapterIndex;
  const chapterIndex =
    rawChapterIndex === undefined || rawChapterIndex === null || rawChapterIndex === "" ? null : Number(rawChapterIndex);

  if (chapterId) {
    const chapter = project.chapters.find((entry) => entry.id === chapterId);

    if (chapter) {
      return chapter;
    }
  }

  if (typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex > 0) {
    const chapter = project.chapters.find((entry) => entry.index === chapterIndex);

    if (chapter) {
      return chapter;
    }
  }

  if (chapterTitle) {
    const exact = project.chapters.find((entry) => entry.title === chapterTitle);

    if (exact) {
      return exact;
    }

    const candidates = project.chapters.filter((entry) => entry.title.includes(chapterTitle) || chapterTitle.includes(entry.title));

    if (candidates.length === 1) {
      return candidates[0];
    }

    if (candidates.length > 1) {
      throw new Error(`找到多个漫画章节标题匹配：${candidates.map((chapter) => `第 ${chapter.index} 章 ${chapter.title}`).join("、")}，请使用 chapterIndex 或 chapterId。`);
    }
  }

  throw new Error("没有找到目标漫画章节，请提供 chapterId、chapterIndex 或 chapterTitle。");
}

function buildTextResult(contentText: string, structuredContent?: JsonObject): Omit<McpToolCallResult, "serverId" | "serverName" | "toolName" | "isError"> {
  return {
    contentText,
    ...(structuredContent ? { structuredContent } : {})
  };
}

function createToolDefinition(server: McpServerConfig, definition: Omit<McpToolDefinition, "serverId" | "serverName">): McpToolDefinition {
  return {
    serverId: server.id,
    serverName: server.name,
    ...definition
  };
}

function getApplicationToolDefinitions(server: McpServerConfig): McpToolDefinition[] {
  return [
    createToolDefinition(server, {
      name: "writing_create_book",
      description:
        "在应用广场「墨笔生花」中新建一本小说并写入本地书稿目录。可一次性写入简介、大纲、分卷/章节目录、补充设定区块和结构化故事资产。仅当用户明确要求新增、创建、增加一本小说/书稿或把企划写入墨笔生花时使用；普通创意讨论不要调用。默认 dryRun=false 会直接保存。",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", description: "新小说书名" },
          author: { type: "string", description: "可选，作者名，默认 Song" },
          length: { type: "string", enum: ["short", "medium", "long"], description: "可选，篇幅，默认 medium" },
          genre: { type: "string", description: "可选，类型/题材" },
          genreProfile: GENRE_PROFILE_SCHEMA,
          status: { type: "string", description: "可选，书籍状态，默认 新建" },
          intro: { type: "string", description: "可选，简短介绍" },
          outlineGuide: { type: "string", description: "可选，大纲指导/创作方向" },
          chapters: {
            type: "array",
            description: "可选，初始章节目录。每项可包含 title、summary、content、status、partIndex",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                content: { type: "string" },
                status: { type: "string", enum: ["todo", "inProgress", "done"] },
                partIndex: { type: "integer", minimum: 1 }
              },
              additionalProperties: false
            }
          },
          parts: {
            type: "array",
            description: "可选，幕/卷设计。每项可包含 title、description、type",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                type: { type: "string", enum: ["act", "volume"] }
              },
              additionalProperties: false
            }
          },
          premise: { type: "string", description: "可选，故事命题，会写入 storyAssets.premise" },
          extraIntroSections: EXTRA_INTRO_SECTIONS_SCHEMA,
          storyAssets: STORY_ASSETS_SCHEMA,
          narrativeState: NARRATIVE_STATE_SCHEMA,
          dryRun: { type: "boolean", description: "可选，默认 false。true 只预览，false 直接写入本地书稿" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "writing_list_books",
      description: "列出应用广场「墨笔生花」中的小说书稿。用于根据书名、id、章节数量和更新时间定位目标小说。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "可选，按书名、作者、类型或状态过滤" },
          includeChapters: { type: "boolean", description: "可选，是否返回章节目录摘要，默认 false" },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "可选，最多返回数量，默认 20" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "writing_read_book",
      description:
        "读取「墨笔生花」小说的介绍、大纲、故事资产和章节目录；指定 chapterId/chapterIndex/chapterTitle 时可读取目标章节正文。",
      inputSchema: {
        type: "object",
        required: ["bookIdOrTitle"],
        properties: {
          bookIdOrTitle: { type: "string", description: "小说 id、完整书名或可唯一匹配的书名片段" },
          chapterId: { type: "string", description: "可选，目标章节 id" },
          chapterIndex: { type: "integer", minimum: 1, description: "可选，目标章节序号" },
          chapterTitle: { type: "string", description: "可选，目标章节标题或可唯一匹配片段" },
          includeStoryAssets: { type: "boolean", description: "可选，是否返回结构化故事资产，默认 true" },
          includeNarrativeState: { type: "boolean", description: "可选，是否返回 Narrative State，默认 true" },
          includeRecentChapters: { type: "integer", minimum: 0, maximum: 10, description: "可选，额外返回最近章节正文数量，默认 0" },
          maxContentChars: { type: "integer", minimum: 1000, maximum: 60000, description: "可选，单段正文最大返回字数，默认 24000" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "writing_search_book",
      description: "在「墨笔生花」小说的简介、大纲、故事资产、章节标题、章节简介和正文中搜索关键词。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "搜索关键词" },
          bookIdOrTitle: { type: "string", description: "可选，限定某本小说；不传则搜索全部小说" },
          maxResults: { type: "integer", minimum: 1, maximum: 50, description: "可选，最多返回数量，默认 20" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "writing_update_chapter",
      description:
        "预览或写回「墨笔生花」指定章节的标题、简介、正文或状态。默认 dryRun=true 只返回修改预览；只有用户明确要求保存/写回/直接修改时才设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["bookIdOrTitle"],
        properties: {
          bookIdOrTitle: { type: "string", description: "小说 id、完整书名或可唯一匹配的书名片段" },
          chapterId: { type: "string", description: "可选，目标章节 id" },
          chapterIndex: { type: "integer", minimum: 1, description: "可选，目标章节序号" },
          chapterTitle: { type: "string", description: "可选，目标章节标题或可唯一匹配片段" },
          title: { type: "string", description: "可选，新章节标题，不含“第X章”前缀" },
          summary: { type: "string", description: "可选，新章节简介" },
          content: { type: "string", description: "可选，新章节正文。写回时会完整替换当前章节正文" },
          status: { type: "string", enum: ["todo", "inProgress", "done"], description: "可选，新章节状态" },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地书稿" },
          expectedBookUpdatedAt: { type: "string", description: "可选，乐观锁：若书籍更新时间不一致则拒绝写回" },
          expectedChapterUpdatedAt: { type: "string", description: "可选，乐观锁：若章节更新时间不一致则拒绝写回" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "writing_update_book_fields",
      description:
        "预览或写回「墨笔生花」小说级字段，例如简介、大纲指导、类型和状态。默认 dryRun=true 只返回修改预览。",
      inputSchema: {
        type: "object",
        required: ["bookIdOrTitle"],
        properties: {
          bookIdOrTitle: { type: "string", description: "小说 id、完整书名或可唯一匹配的书名片段" },
          intro: { type: "string", description: "可选，新简短介绍" },
          outlineGuide: { type: "string", description: "可选，新大纲指导" },
          seriesPlan: { type: "string", description: "可选，旧版 seriesPlan 兼容别名；提供后会合并写入大纲指导" },
          genre: { type: "string", description: "可选，新类型" },
          genreProfile: GENRE_PROFILE_SCHEMA,
          status: { type: "string", description: "可选，新书籍状态" },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地书稿" },
          expectedBookUpdatedAt: { type: "string", description: "可选，乐观锁：若书籍更新时间不一致则拒绝写回" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "writing_update_story_assets",
      description:
        "预览或写回「墨笔生花」小说的结构化故事资产和补充设定区块。适合把世界观、人物、关系、武道/能力体系、势力设定、伏笔、时间线、分卷规划等长期资产写入已有小说。默认 dryRun=true；用户明确要求保存/写入/直接修改时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["bookIdOrTitle"],
        properties: {
          bookIdOrTitle: { type: "string", description: "小说 id、完整书名或可唯一匹配的书名片段" },
          mode: { type: "string", enum: ["merge", "replace"], description: "可选，merge 合并同名资产，replace 替换全部故事资产与补充区块；默认 merge" },
          storyAssets: STORY_ASSETS_SCHEMA,
          narrativeState: NARRATIVE_STATE_SCHEMA,
          extraIntroSections: EXTRA_INTRO_SECTIONS_SCHEMA,
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地书稿" },
          expectedBookUpdatedAt: { type: "string", description: "可选，乐观锁：若书籍更新时间不一致则拒绝写回" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_list_projects",
      description: "列出应用广场「丹青溢彩」中的漫画项目。用于根据项目名、id、章节数量、素材数量和更新时间定位目标漫画。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "可选，按项目名、类型、状态或简介过滤" },
          includeChapters: { type: "boolean", description: "可选，是否返回章节目录摘要，默认 false" },
          includeAssets: { type: "boolean", description: "可选，是否返回素材库摘要，默认 false" },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "可选，最多返回数量，默认 20" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_create_project",
      description:
        "在应用广场「丹青溢彩」中新建漫画项目。适合命令工坊把线上小说、上传文本或漫画企划转成丹青溢彩项目，可一次性写入来源信息、项目简介、统一画风、总规划、素材库和初始章节正文。默认 dryRun=false 会直接保存。",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", description: "新漫画项目名" },
          format: { type: "string", enum: ["poster", "serial"], description: "poster 单图海报，serial 连载漫画；小说转漫画默认 serial" },
          palette: { type: "string", enum: ["monochrome", "color"] },
          genre: { type: "string" },
          status: { type: "string" },
          summary: { type: "string", description: "故事与画面目标" },
          visualStyle: { type: "string", description: "全局画风、角色风格、场景风格、镜头语言和一致性规则" },
          episodePlan: { type: "string", description: "连载总规划、导入批次、素材提取计划和分镜推进策略" },
          pageCount: { type: "integer", minimum: 1, maximum: 999 },
          coverTone: { type: "string" },
          coverUrl: { type: "string" },
          coverPrompt: { type: "string" },
          coverShouldShowTitle: { type: "boolean" },
          source: COMIC_SOURCE_META_SCHEMA,
          assets: { type: "array", items: COMIC_ASSET_SCHEMA },
          chapters: {
            type: "array",
            description: "可选，初始章节目录和正文。小说导入时应把原文/摘要放入 content/summary，后续再拆分 storyboards。",
            items: COMIC_CHAPTER_SCHEMA
          },
          dryRun: { type: "boolean", description: "可选，默认 false。true 只预览，false 直接写入本地项目" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_read_project",
      description:
        "读取「丹青溢彩」漫画项目的项目字段、素材库、章节目录和指定章节图片/提示词。处理漫画项目、章节分镜、素材一致性和出图任务前应优先调用。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle"],
        properties: {
          projectIdOrTitle: { type: "string", description: "漫画项目 id、完整项目名或可唯一匹配的项目名片段" },
          chapterId: { type: "string", description: "可选，目标章节 id" },
          chapterIndex: { type: "integer", minimum: 1, description: "可选，目标章节序号" },
          chapterTitle: { type: "string", description: "可选，目标章节标题或可唯一匹配片段" },
          includeAssets: { type: "boolean", description: "可选，是否返回素材库，默认 true" },
          includeImages: { type: "boolean", description: "可选，是否返回章节图片列表，默认 true" },
          maxContentChars: { type: "integer", minimum: 1000, maximum: 60000, description: "可选，章节备注最大返回字数，默认 24000" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_update_project_fields",
      description:
        "预览或写回「丹青溢彩」漫画项目级字段，例如故事与画面目标、画风与镜头、规划、类型、形态、画面和状态。默认 dryRun=true，只预览；用户明确保存/写回/替换时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle"],
        properties: {
          projectIdOrTitle: { type: "string", description: "漫画项目 id、完整项目名或可唯一匹配的项目名片段" },
          title: { type: "string" },
          format: { type: "string", enum: ["poster", "serial"], description: "poster 单图海报，serial 连载漫画" },
          palette: { type: "string", enum: ["monochrome", "color"] },
          genre: { type: "string" },
          status: { type: "string" },
          summary: { type: "string", description: "故事与画面目标" },
          visualStyle: { type: "string", description: "画风与镜头" },
          episodePlan: { type: "string", description: "海报构图规划或连载总规划" },
          pageCount: { type: "integer", minimum: 1, maximum: 999 },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地项目" },
          expectedProjectUpdatedAt: { type: "string", description: "可选，乐观锁：若项目更新时间不一致则拒绝写回" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_create_chapter",
      description:
        "预览或写回「丹青溢彩」漫画项目中的新章节实体。用于新增、补全或追加章节目录；如果目标章节已经存在，请改用 comic_update_chapter。默认 dryRun=true；用户明确保存/写回/直接创建时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle"],
        properties: {
          projectIdOrTitle: { type: "string", description: "漫画项目 id、完整项目名或可唯一匹配的项目名片段" },
          chapterIndex: { type: "integer", minimum: 1, description: "可选，新章节序号；默认追加到末尾。若该序号已存在会拒绝创建" },
          title: { type: "string", description: "可选，新章节标题；默认“第 N 章”" },
          summary: { type: "string", description: "可选，章节内容简介：故事事件、角色目标、冲突变化和结尾钩子" },
          prompt: { type: "string", description: "可选，章节级分镜与出图提示词" },
          content: { type: "string", description: "可选章节正文/故事内容" },
          storyboards: { type: "array", items: COMIC_STORYBOARD_SCHEMA, description: "可选，新章节初始分镜轨道" },
          images: { type: "array", items: COMIC_CHAPTER_IMAGE_SCHEMA, description: "可选，新章节初始图片数组" },
          status: { type: "string", enum: ["todo", "inProgress", "done"], description: "可选，新章节状态，默认 todo" },
          assetRefs: { type: "array", items: { type: "string" }, description: "可选，引用素材 id" },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地项目" },
          expectedProjectUpdatedAt: { type: "string", description: "可选，乐观锁：若项目更新时间不一致则拒绝写回" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_import_chapters",
      description:
        "批量导入或更新「丹青溢彩」漫画项目章节。适合命令工坊把线上小说目录/正文、用户上传文本或分批提取结果一次性写入项目。可 append、upsert 或 replaceRange，避免中篇/长篇小说逐章调用 comic_create_chapter。默认 dryRun=true；用户明确导入/写入/保存时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle", "chapters"],
        properties: {
          projectIdOrTitle: { type: "string", description: "漫画项目 id、完整项目名或可唯一匹配的项目名片段" },
          mode: {
            type: "string",
            enum: ["append", "upsert", "replaceRange"],
            description: "append 追加到末尾；upsert 按 index/title/id 更新或新增；replaceRange 删除 startIndex-endIndex 范围后写入"
          },
          startIndex: { type: "integer", minimum: 1, description: "replaceRange 起始章节；也可作为 append/upsert 的重编号起点" },
          endIndex: { type: "integer", minimum: 1, description: "replaceRange 结束章节" },
          chapters: { type: "array", items: COMIC_CHAPTER_SCHEMA, description: "待导入章节，每项可包含 title、summary、content、prompt、sourceRefs、storyboards" },
          source: COMIC_SOURCE_META_SCHEMA,
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地项目" },
          expectedProjectUpdatedAt: { type: "string", description: "可选，乐观锁：若项目更新时间不一致则拒绝写回" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_update_chapter",
      description:
        "预览或写回「丹青溢彩」指定漫画章节的标题、章节内容简介、章节正文/故事内容、分镜与出图提示、状态或引用素材。默认 dryRun=true；用户明确保存/写回/直接修改时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle"],
        properties: {
          projectIdOrTitle: { type: "string", description: "漫画项目 id、完整项目名或可唯一匹配的项目名片段" },
          chapterId: { type: "string" },
          chapterIndex: { type: "integer", minimum: 1 },
          chapterTitle: { type: "string" },
          title: { type: "string" },
          summary: { type: "string", description: "章节内容简介：故事事件、角色目标、冲突变化和结尾钩子" },
          prompt: { type: "string", description: "章节级分镜与出图提示词：图片数量建议、画面节点、景别、构图和一致性约束" },
          content: { type: "string", description: "可选章节正文/故事内容，可由小说正文、剧情草稿或本章完整文本转入，用作分镜和出图参考" },
          storyboards: { type: "array", items: COMIC_STORYBOARD_SCHEMA, description: "当前章节的分镜轨道；替换写入时应包含完整目标分镜列表" },
          status: { type: "string", enum: ["todo", "inProgress", "done"] },
          assetRefs: { type: "array", items: { type: "string" }, description: "引用素材 id" },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地项目" },
          expectedProjectUpdatedAt: { type: "string" },
          expectedChapterUpdatedAt: { type: "string" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_update_chapter_images",
      description:
        "预览或写回「丹青溢彩」指定章节的图片数组。适合把 image_gen 产生的漫画图、漫画页、封面或连续图组写入当前章节图片区。默认 dryRun=true；用户明确要求生成并放进项目/追加/替换时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle", "images"],
        properties: {
          projectIdOrTitle: { type: "string" },
          chapterId: { type: "string" },
          chapterIndex: { type: "integer", minimum: 1 },
          chapterTitle: { type: "string" },
          storyboardId: { type: "string", description: "可选，指定要写入图片的章节分镜 id" },
          storyboardIndex: { type: "integer", minimum: 1, description: "可选，指定要写入图片的分镜序号" },
          mode: { type: "string", enum: ["append", "replace"], description: "append 追加到章节图片区，replace 替换章节全部图片；默认 append" },
          prompt: { type: "string", description: "可选，同时写入章节级分镜与出图提示" },
          images: { type: "array", items: COMIC_CHAPTER_IMAGE_SCHEMA },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地项目" },
          expectedProjectUpdatedAt: { type: "string" },
          expectedChapterUpdatedAt: { type: "string" }
        },
        additionalProperties: false
      }
    }),
    createToolDefinition(server, {
      name: "comic_update_assets",
      description:
        "预览或写回「丹青溢彩」项目素材库。适合维护人物、物品、场景素材及其视图图和稳定出图提示词。默认 dryRun=true；用户明确保存/写回素材时设置 dryRun=false。",
      inputSchema: {
        type: "object",
        required: ["projectIdOrTitle", "assets"],
        properties: {
          projectIdOrTitle: { type: "string" },
          mode: { type: "string", enum: ["merge", "replace"], description: "merge 按 id/名称合并，replace 替换素材库；默认 merge" },
          assets: { type: "array", items: COMIC_ASSET_SCHEMA },
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地项目" },
          expectedProjectUpdatedAt: { type: "string" }
        },
        additionalProperties: false
      }
    })
  ];
}

export function listApplicationToolDefinitions(server: McpServerConfig): McpToolDefinition[] {
  const allowlist = new Set(server.toolAllowlist);
  const definitions = getApplicationToolDefinitions(server);

  return allowlist.size ? definitions.filter((definition) => allowlist.has(definition.name)) : definitions;
}

async function handleWritingListBooks(args: JsonObject) {
  const query = asString(args.query).toLowerCase();
  const includeChapters = asBoolean(args.includeChapters, false);
  const limit = asPositiveInteger(args.limit, 20, 50);
  const books = (await listWritingBooks()).filter((book) => {
    if (!query) {
      return true;
    }

    return [book.title, book.author, book.genre, book.status, book.directoryName]
      .map((value) => String(value ?? "").toLowerCase())
      .some((value) => value.includes(query));
  });
  const selectedBooks = books.slice(0, limit);
  const lines = selectedBooks.map(
    (book) => `- ${book.title}（id=${book.id}，章节=${book.chapters.length}，状态=${book.status}，更新=${book.updatedAt}）`
  );

  return buildTextResult(
    `墨笔生花小说列表：共匹配 ${books.length} 本，返回 ${selectedBooks.length} 本。\n${lines.join("\n") || "暂无匹配小说。"}`,
    {
      applicationId: "writing",
      resourceType: "book",
      total: books.length,
      books: selectedBooks.map((book) => summarizeBook(book, includeChapters))
    }
  );
}

function normalizeInitialBookParts(args: JsonObject, bookId: string): WritingBook["parts"] {
  const parts = Array.isArray(args.parts) ? args.parts : [];

  return parts
    .filter(isObject)
    .map((part, index) => {
      const normalizedType = asString(part.type) === "volume" ? "volume" : "act";

      return {
        id: createLocalId(`${bookId}_part`),
        type: normalizedType,
        index: index + 1,
        title: asString(part.title) || `${normalizedType === "volume" ? "卷" : "幕"} ${index + 1}`,
        description: String(part.description ?? "")
      };
    });
}

function normalizeInitialBookChapters(args: JsonObject, bookId: string, timestamp: string): WritingChapter[] {
  const rawChapters = Array.isArray(args.chapters) ? args.chapters.filter(isObject) : [];
  const chapters = rawChapters.length
    ? rawChapters
    : [
        {
          title: "开场章节",
          summary: "建立主角、梦境穿越规则和第一次异世界危机。",
          content: "",
          status: "todo"
        }
      ];

  return chapters.map((chapter, index) => {
    const partIndex = Number(chapter.partIndex);

    return {
      id: createLocalId(`${bookId}_chapter`),
      index: index + 1,
      ...(Number.isInteger(partIndex) && partIndex > 0 ? { partIndex } : {}),
      title: asString(chapter.title).replace(/^第\s*\d+\s*章\s*/u, "") || `未命名章节 ${index + 1}`,
      summary: String(chapter.summary ?? ""),
      content: String(chapter.content ?? ""),
      status: asWritingChapterStatus(chapter.status),
      updatedAt: timestamp
    };
  });
}

async function handleWritingCreateBook(args: JsonObject) {
  const title = asString(args.title);

  if (!title) {
    throw new Error("title 不能为空");
  }

  const dryRun = asBoolean(args.dryRun, false);
  const timestamp = new Date().toISOString();
  const bookId = createLocalId("writing_book");
  const premise = asString(args.premise) || asString(args.intro);
  const genre = asString(args.genre) || "小说 / 待定类型";
  const emptyStoryAssets = createEmptyWritingStoryAssets(bookId, premise, timestamp);
  const incomingStoryAssets = normalizeWritingStoryAssetsInput(args.storyAssets, bookId, timestamp);
  const storyAssets = mergeWritingStoryAssets(emptyStoryAssets, incomingStoryAssets, "merge", timestamp);
  const narrativeState = normalizeWritingNarrativeStateInput(args.narrativeState, bookId, timestamp);
  const book: WritingBook = {
    id: bookId,
    title,
    author: asString(args.author) || "Song",
    length: asWritingBookLength(args.length),
    genre,
    genreProfile: normalizeGenreProfileInput(args.genreProfile, genre, timestamp),
    status: asString(args.status) || "新建",
    updatedAt: timestamp,
    coverTone: "teal",
    intro: String(args.intro ?? ""),
    outlineGuide: String(args.outlineGuide ?? ""),
    seriesPlan: "",
    extraIntroSections: normalizeExtraIntroSections(args.extraIntroSections, bookId, timestamp),
    parts: normalizeInitialBookParts(args, bookId),
    storyAssets,
    narrativeState,
    chapters: normalizeInitialBookChapters(args, bookId, timestamp)
  };

  if (dryRun) {
    return buildTextResult(
      `小说创建预览（未写回）：${book.title}
类型：${book.genre}
篇幅：${book.length}
初始章节：${book.chapters.length} 章
故事资产：${Object.entries(summarizeStoryAssets(book.storyAssets))
        .map(([key, value]) => `${key}=${value}`)
        .join("，")}
叙事状态：${Object.entries(summarizeNarrativeState(book.narrativeState))
        .map(([key, value]) => `${key}=${value}`)
        .join("，")}

如需保存，请在用户确认后再次调用 writing_create_book 并设置 dryRun=false。`,
      {
        applicationId: "writing",
        resourceType: "book",
        applied: false,
        dryRun: true,
        proposedBook: {
          ...summarizeBook(book, true),
          intro: truncateText(book.intro, MAX_TEXT_CHARS),
          outlineGuide: truncateText(book.outlineGuide, MAX_TEXT_CHARS),
          extraIntroSections: book.extraIntroSections,
          storyAssets: book.storyAssets,
          narrativeState: book.narrativeState
        }
      }
    );
  }

  const savedBooks = await saveWritingBook(book);
  const savedBook = savedBooks.find((entry) => entry.id === book.id) ?? book;

  return buildTextResult(
    `已新建小说：${savedBook.title}
id=${savedBook.id}
类型=${savedBook.genre}
初始章节=${savedBook.chapters.length} 章
补充设定区块=${savedBook.extraIntroSections.length} 个
故事资产=${Object.entries(summarizeStoryAssets(savedBook.storyAssets))
      .map(([key, value]) => `${key}=${value}`)
      .join("，")}
叙事状态=${Object.entries(summarizeNarrativeState(savedBook.narrativeState))
      .map(([key, value]) => `${key}=${value}`)
      .join("，")}
更新时间=${savedBook.updatedAt}`,
    {
      applicationId: "writing",
      resourceType: "book",
      applied: true,
      dryRun: false,
      bookId: savedBook.id,
      savedBook: {
        ...summarizeBook(savedBook, true),
        intro: truncateText(savedBook.intro, MAX_TEXT_CHARS),
        outlineGuide: truncateText(getUnifiedWritingOutlineGuide(savedBook), MAX_TEXT_CHARS),
        extraIntroSections: savedBook.extraIntroSections,
        storyAssets: savedBook.storyAssets,
        narrativeState: savedBook.narrativeState
      }
    }
  );
}

function normalizeComicSourceRefInput(value: unknown): ComicSourceRef | null {
  const source = isObject(value) ? value : {};
  const sourceUrl = asString(source.sourceUrl ?? source.url);
  const sourceTitle = asString(source.sourceTitle ?? source.title);
  const chapterIndex = asOptionalPositiveInteger(source.chapterIndex ?? source.index);
  const chapterTitle = asString(source.chapterTitle ?? source.chapterName);
  const note = asString(source.note ?? source.notes);

  if (!sourceUrl && !sourceTitle && chapterIndex === undefined && !chapterTitle && !note) {
    return null;
  }

  return {
    sourceType: asComicSourceRefType(source.sourceType),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(chapterIndex !== undefined ? { chapterIndex } : {}),
    ...(chapterTitle ? { chapterTitle } : {}),
    ...(note ? { note } : {})
  };
}

function normalizeComicSourceRefsInput(value: unknown): ComicSourceRef[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => normalizeComicSourceRefInput(entry))
    .filter((entry): entry is ComicSourceRef => Boolean(entry));
}

function normalizeComicProjectSourceInput(value: unknown, timestamp: string, chapterCount = 0): ComicSourceMeta | undefined {
  const source = isObject(value) ? value : {};
  const sourceUrl = asString(source.sourceUrl ?? source.url);
  const sourceTitle = asString(source.sourceTitle ?? source.title);
  const importedAt = asString(source.importedAt) || timestamp;
  const importedBy = asString(source.importedBy) || "command-workshop";
  const explicitChapterCount = asOptionalPositiveInteger(source.chapterCount);
  const extractionStatus = asComicProjectExtractionStatus(source.extractionStatus) ?? (chapterCount > 0 ? "partial" : "planned");
  const notes = asString(source.notes ?? source.note);

  if (!sourceUrl && !sourceTitle && !notes && !chapterCount && !explicitChapterCount) {
    return undefined;
  }

  return {
    sourceType: asComicProjectSourceType(source.sourceType),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    importedAt,
    importedBy,
    chapterCount: explicitChapterCount ?? (chapterCount > 0 ? chapterCount : undefined),
    extractionStatus,
    ...(notes ? { notes } : {})
  };
}

function mergeComicProjectSource(current: ComicSourceMeta | undefined, incoming: ComicSourceMeta | undefined, timestamp: string, chapterCount: number): ComicSourceMeta | undefined {
  if (!current && !incoming) {
    return undefined;
  }

  return {
    sourceType: incoming?.sourceType ?? current?.sourceType ?? "manual",
    ...(current?.sourceUrl || incoming?.sourceUrl ? { sourceUrl: incoming?.sourceUrl ?? current?.sourceUrl } : {}),
    ...(current?.sourceTitle || incoming?.sourceTitle ? { sourceTitle: incoming?.sourceTitle ?? current?.sourceTitle } : {}),
    importedAt: incoming?.importedAt ?? current?.importedAt ?? timestamp,
    importedBy: incoming?.importedBy ?? current?.importedBy ?? "command-workshop",
    chapterCount: incoming?.chapterCount ?? (Math.max(chapterCount, current?.chapterCount ?? 0) || undefined),
    extractionStatus: incoming?.extractionStatus ?? current?.extractionStatus ?? (chapterCount > 0 ? "partial" : "planned"),
    ...(current?.notes || incoming?.notes ? { notes: incoming?.notes ?? current?.notes } : {})
  };
}

function normalizeComicAssetVariantInput(value: unknown, index: number, fallbackViews: ComicAssetView[] = []): ComicAssetVariant | null {
  const source = isObject(value) ? value : {};
  const label = asString(source.label ?? source.name);
  const description = String(source.description ?? "");
  const prompt = String(source.prompt ?? "");
  const chapterStartIndex = asOptionalPositiveInteger(source.chapterStartIndex ?? source.startChapterIndex);
  const chapterEndIndex = asOptionalPositiveInteger(source.chapterEndIndex ?? source.endChapterIndex);
  const views = Array.isArray(source.views)
    ? source.views.map((view, viewIndex) => normalizeComicAssetViewInput(view, viewIndex))
    : [];
  const sourceRefs = normalizeComicSourceRefsInput(source.sourceRefs);
  const timestamp = asString(source.updatedAt) || new Date().toISOString();

  if (!label && !description && !prompt && chapterStartIndex === undefined && chapterEndIndex === undefined && !views.length && !sourceRefs.length) {
    return null;
  }

  return {
    id: asString(source.id) || createLocalId("comic_asset_variant"),
    label: label || `版本 ${index + 1}`,
    ...(chapterStartIndex !== undefined ? { chapterStartIndex } : {}),
    ...(chapterEndIndex !== undefined ? { chapterEndIndex } : {}),
    ...(description ? { description } : {}),
    ...(prompt ? { prompt } : {}),
    views: views.length ? views : fallbackViews,
    ...(sourceRefs.length ? { sourceRefs } : {}),
    updatedAt: timestamp
  };
}

function normalizeComicAssetVariantsInput(value: unknown, fallbackViews: ComicAssetView[] = []): ComicAssetVariant[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeComicAssetVariantInput(entry, index, fallbackViews))
    .filter((entry): entry is ComicAssetVariant => Boolean(entry));
}

function normalizeComicChapterInputForProject(value: unknown, index: number, project: ComicProject | null, timestamp: string, current?: ComicChapter): ComicChapter | null {
  const source = isObject(value) ? value : {};
  const title = asString(source.title ?? source.chapterTitle ?? current?.title);
  const summary = String(source.summary ?? current?.summary ?? "");
  const content = String(source.content ?? source.text ?? current?.content ?? "");
  const prompt = String(source.prompt ?? source.imagePrompt ?? current?.prompt ?? "");
  const sourceRefs = normalizeComicSourceRefsInput(source.sourceRefs ?? current?.sourceRefs);
  const storyboards = normalizeComicStoryboardsInput(source.storyboards, current?.storyboards ?? []);
  const images = normalizeComicChapterImagesInput(source.images, prompt || (current?.prompt ?? ""));
  const assetRefs = project ? normalizeComicAssetRefsForTool(source.assetRefs ?? current?.assetRefs, project) : asStringList(source.assetRefs ?? current?.assetRefs);

  if (!title && !summary && !content && !prompt && !storyboards.length && !images.length) {
    return null;
  }

  const storyboardIds = new Set(storyboards.map((storyboard) => storyboard.id));
  const normalizedImages = images.map((image) => ({
    ...image,
    storyboardId: image.storyboardId && storyboardIds.has(image.storyboardId) ? image.storyboardId : storyboards[0]?.id
  }));

  return syncComicStoryboardImageIdsForTool({
    id: asString(source.id) || current?.id || createLocalId("comic_chapter"),
    index: asPositiveInteger(source.index ?? source.chapterIndex ?? current?.index, index + 1, 9999),
    title: title || current?.title || `第 ${index + 1} 章`,
    summary,
    prompt,
    content,
    ...(sourceRefs.length ? { sourceRefs } : {}),
    storyboards,
    images: normalizedImages,
    status: asComicChapterStatus(source.status ?? current?.status),
    assetRefs,
    updatedAt: timestamp
  });
}

function normalizeComicChaptersForProject(value: unknown, project: ComicProject | null, timestamp: string, currentChapters: ComicChapter[] = []): ComicChapter[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => {
      const source = isObject(entry) ? entry : {};
      const sourceId = asString(source.id);
      const sourceIndex = asOptionalPositiveInteger(source.index ?? source.chapterIndex);
      const sourceTitle = asString(source.title ?? source.chapterTitle);
      const current =
        (sourceId ? currentChapters.find((chapter) => chapter.id === sourceId) : null) ??
        (sourceIndex ? currentChapters.find((chapter) => chapter.index === sourceIndex) : null) ??
        (sourceTitle ? currentChapters.find((chapter) => chapter.title === sourceTitle) : null) ??
        undefined;
      return normalizeComicChapterInputForProject(entry, index, project, timestamp, current);
    })
    .filter((entry): entry is ComicChapter => Boolean(entry));
}

function sortAndReindexComicChapters(chapters: ComicChapter[]): ComicChapter[] {
  return [...chapters].sort((left, right) => left.index - right.index).map((chapter, index) => ({ ...chapter, index: index + 1 }));
}

function buildComicChapterImportStats(beforeChapters: ComicChapter[], afterChapters: ComicChapter[], incomingChapters: ComicChapter[]): JsonObject {
  const beforeIds = new Set(beforeChapters.map((chapter) => chapter.id));
  const incomingIds = new Set(incomingChapters.map((chapter) => chapter.id));
  const updatedCount = incomingChapters.filter((chapter) => beforeIds.has(chapter.id)).length;
  const createdCount = incomingChapters.length - updatedCount;
  const replacedCount = beforeChapters.filter((chapter) => !afterChapters.some((entry) => entry.id === chapter.id)).length;

  return {
    beforeCount: beforeChapters.length,
    afterCount: afterChapters.length,
    incomingCount: incomingChapters.length,
    createdCount,
    updatedCount,
    replacedCount,
    importedChapterIds: Array.from(incomingIds)
  };
}

async function handleComicCreateProject(args: JsonObject) {
  const title = asString(args.title);

  if (!title) {
    throw new Error("title 不能为空");
  }

  const dryRun = asBoolean(args.dryRun, false);
  const timestamp = new Date().toISOString();
  const projectId = createLocalId("comic_project");
  const emptyProject: ComicProject = {
    id: projectId,
    title,
    format: asComicProjectFormat(args.format ?? "serial"),
    palette: asComicProjectPalette(args.palette),
    genre: asString(args.genre) || "漫画 / 待定类型",
    status: asString(args.status) || "新建",
    summary: String(args.summary ?? ""),
    visualStyle: String(args.visualStyle ?? ""),
    episodePlan: String(args.episodePlan ?? ""),
    pageCount: asPositiveInteger(args.pageCount, 24, 999),
    coverTone: asString(args.coverTone) || "ink",
    coverUrl: asString(args.coverUrl),
    coverPrompt: String(args.coverPrompt ?? ""),
    coverShouldShowTitle: args.coverShouldShowTitle !== false,
    assets: [],
    chapters: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const assets = (Array.isArray(args.assets) ? args.assets : [])
    .map((entry, index) => normalizeComicAssetInput(entry, index))
    .filter((entry): entry is ComicAsset => Boolean(entry));
  const projectWithAssets = { ...emptyProject, assets };
  const chapters = normalizeComicChaptersForProject(args.chapters, projectWithAssets, timestamp);
  const project: ComicProject = {
    ...projectWithAssets,
    source: normalizeComicProjectSourceInput(args.source, timestamp, chapters.length),
    assets,
    chapters: sortAndReindexComicChapters(chapters),
    updatedAt: timestamp
  };

  if (dryRun) {
    return buildTextResult(
      `漫画项目创建预览（未写回）：${project.title}
类型：${project.genre}
形态：${project.format}
画面：${project.palette}
初始章节：${project.chapters.length} 章
素材：${project.assets.length} 个
来源：${project.source?.sourceTitle || project.source?.sourceUrl || "未设置"}

如需保存，请在用户确认后再次调用 comic_create_project 并设置 dryRun=false。`,
      {
        applicationId: "comic",
        resourceType: "project",
        applied: false,
        dryRun: true,
        proposedProject: {
          ...summarizeComicProject(project, true, true),
          summary: truncateText(project.summary, MAX_TEXT_CHARS),
          visualStyle: truncateText(project.visualStyle, MAX_TEXT_CHARS),
          episodePlan: truncateText(project.episodePlan, MAX_TEXT_CHARS)
        }
      }
    );
  }

  const savedProjects = await upsertComicProject(project);
  const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? project;

  return buildTextResult(
    `已新建漫画项目：${savedProject.title}
id=${savedProject.id}
类型=${savedProject.genre}
初始章节=${savedProject.chapters.length} 章
素材=${savedProject.assets.length} 个
来源=${savedProject.source?.sourceTitle || savedProject.source?.sourceUrl || "未设置"}
更新时间=${savedProject.updatedAt}`,
    {
      applicationId: "comic",
      resourceType: "project",
      applied: true,
      dryRun: false,
      projectId: savedProject.id,
      savedProject: {
        ...summarizeComicProject(savedProject, true, true),
        summary: truncateText(savedProject.summary, MAX_TEXT_CHARS),
        visualStyle: truncateText(savedProject.visualStyle, MAX_TEXT_CHARS),
        episodePlan: truncateText(savedProject.episodePlan, MAX_TEXT_CHARS)
      }
    }
  );
}

async function handleWritingReadBook(args: JsonObject) {
  const books = await listWritingBooks();
  const book = findWritingBook(books, asString(args.bookIdOrTitle));
  const includeStoryAssets = asBoolean(args.includeStoryAssets, true);
  const includeNarrativeState = asBoolean(args.includeNarrativeState, true);
  const recentCount = Math.max(0, Math.min(10, Math.floor(Number(args.includeRecentChapters ?? 0) || 0)));
  const maxContentChars = asPositiveInteger(args.maxContentChars, MAX_TEXT_CHARS, 60_000);
  const hasChapterTarget = Boolean(args.chapterId || args.chapterIndex || args.chapterTitle);
  const selectedChapters = hasChapterTarget
    ? [findWritingChapter(book, args)]
    : recentCount > 0
      ? [...book.chapters].sort((left, right) => right.index - left.index).slice(0, recentCount)
      : [];
  const chapterSummaries = book.chapters.map((chapter) => ({
    id: chapter.id,
    index: chapter.index,
    title: chapter.title,
    summary: chapter.summary,
    status: chapter.status,
    updatedAt: chapter.updatedAt,
    wordCount: String(chapter.content ?? "").length
  }));
  const selectedChapterText = selectedChapters
    .map(
      (chapter) => `${chapterLabel(chapter)}（id=${chapter.id}，状态=${chapter.status}，更新=${chapter.updatedAt}）
简介：${chapter.summary || "无"}
正文：
${truncateText(chapter.content, maxContentChars)}`
    )
    .join("\n\n");

  return buildTextResult(
    `已读取小说：${book.title}
id=${book.id}
类型=${book.genre}
状态=${book.status}
更新时间=${book.updatedAt}
章节数=${book.chapters.length}

简短介绍：
${truncateText(book.intro || "无", 4000)}

大纲指导：
${truncateText(getUnifiedWritingOutlineGuide(book) || "无", 8000)}

章节目录：
${chapterSummaries.map((chapter) => `- 第 ${chapter.index} 章 ${chapter.title} / ${chapter.status} / ${chapter.summary || "无简介"}`).join("\n") || "暂无章节"}
${selectedChapterText ? `\n\n选中章节正文：\n${selectedChapterText}` : ""}`,
    {
      applicationId: "writing",
      resourceType: "book",
      book: {
        ...summarizeBook(book),
        intro: book.intro,
        outlineGuide: getUnifiedWritingOutlineGuide(book),
        ...(includeStoryAssets ? { storyAssets: book.storyAssets } : {}),
        ...(includeNarrativeState ? { narrativeState: book.narrativeState } : {}),
        chapters: chapterSummaries,
        selectedChapters: selectedChapters.map((chapter) => ({
          ...chapter,
          content: truncateText(chapter.content, maxContentChars)
        }))
      }
    }
  );
}

function buildStoryAssetSearchText(book: WritingBook): string {
  return JSON.stringify(
    {
      storyAssets: book.storyAssets ?? {},
      narrativeState: book.narrativeState ?? {},
      genreProfile: book.genreProfile ?? {}
    },
    null,
    2
  );
}

function makeSnippet(text: string, query: string): string {
  const normalizedText = String(text ?? "");
  const index = normalizedText.toLowerCase().indexOf(query.toLowerCase());

  if (index < 0) {
    return truncateText(compactText(normalizedText), 280);
  }

  const start = Math.max(0, index - 120);
  const end = Math.min(normalizedText.length, index + query.length + 180);
  return compactText(`${start > 0 ? "..." : ""}${normalizedText.slice(start, end)}${end < normalizedText.length ? "..." : ""}`);
}

async function handleWritingSearchBook(args: JsonObject) {
  const query = asString(args.query);

  if (!query) {
    throw new Error("query 不能为空");
  }

  const maxResults = asPositiveInteger(args.maxResults, MAX_SEARCH_RESULTS, 50);
  const allBooks = await listWritingBooks();
  const books = asString(args.bookIdOrTitle) ? [findWritingBook(allBooks, asString(args.bookIdOrTitle))] : allBooks;
  const results: JsonObject[] = [];
  const pushResult = (book: WritingBook, scope: string, title: string, text: string, extra: JsonObject = {}) => {
    if (results.length >= maxResults || !text.toLowerCase().includes(query.toLowerCase())) {
      return;
    }

    results.push({
      bookId: book.id,
      bookTitle: book.title,
      scope,
      title,
      snippet: makeSnippet(text, query),
      ...extra
    });
  };

  for (const book of books) {
    pushResult(book, "intro", "简短介绍", book.intro);
    pushResult(book, "outlineGuide", "大纲指导", getUnifiedWritingOutlineGuide(book));
    pushResult(book, "storyAssets", "故事资产", buildStoryAssetSearchText(book));

    for (const chapter of book.chapters) {
      const chapterText = [chapter.title, chapter.summary, chapter.content].join("\n");
      pushResult(book, "chapter", chapterLabel(chapter), chapterText, {
        chapterId: chapter.id,
        chapterIndex: chapter.index,
        chapterTitle: chapter.title
      });

      if (results.length >= maxResults) {
        break;
      }
    }

    if (results.length >= maxResults) {
      break;
    }
  }

  return buildTextResult(
    `搜索关键词：${query}
匹配结果：${results.length} 条
${results.map((result, index) => `${index + 1}. ${result.bookTitle} / ${result.title}\n${result.snippet}`).join("\n\n") || "暂无匹配结果。"}`,
    {
      applicationId: "writing",
      resourceType: "search",
      query,
      results
    }
  );
}

async function handleComicListProjects(args: JsonObject) {
  const query = asString(args.query).toLowerCase();
  const includeChapters = asBoolean(args.includeChapters, false);
  const includeAssets = asBoolean(args.includeAssets, false);
  const limit = asPositiveInteger(args.limit, 20, 50);
  const projects = (await listComicProjects()).filter((project) => {
    if (!query) {
      return true;
    }

    return [project.title, project.genre, project.status, project.summary, project.visualStyle, project.episodePlan]
      .map((value) => String(value ?? "").toLowerCase())
      .some((value) => value.includes(query));
  });
  const selectedProjects = projects.slice(0, limit);
  const lines = selectedProjects.map(
    (project) =>
      `- ${project.title}（id=${project.id}，章节=${project.chapters.length}，素材=${project.assets.length}，图片=${project.chapters.reduce((sum, chapter) => sum + chapter.images.length, 0)}，更新=${project.updatedAt}）`
  );

  return buildTextResult(
    `丹青溢彩漫画项目列表：共匹配 ${projects.length} 个，返回 ${selectedProjects.length} 个。\n${lines.join("\n") || "暂无匹配项目。"}`,
    {
      applicationId: "comic",
      resourceType: "project",
      total: projects.length,
      projects: selectedProjects.map((project) => summarizeComicProject(project, includeChapters, includeAssets))
    }
  );
}

async function handleComicReadProject(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const includeAssets = asBoolean(args.includeAssets, true);
  const includeImages = asBoolean(args.includeImages, true);
  const maxContentChars = asPositiveInteger(args.maxContentChars, MAX_TEXT_CHARS, 60_000);
  const hasChapterTarget = Boolean(args.chapterId || args.chapterIndex || args.chapterTitle);
  const selectedChapters = hasChapterTarget ? [findComicChapter(project, args)] : [];
  const chapterSummaries = project.chapters.map((chapter) => ({
    id: chapter.id,
    index: chapter.index,
    title: chapter.title,
    summary: chapter.summary,
    prompt: truncateText(chapter.prompt, 1800),
    status: chapter.status,
    storyboardCount: chapter.storyboards.length,
    imageCount: chapter.images.length,
    assetRefs: chapter.assetRefs,
    updatedAt: chapter.updatedAt
  }));
  const selectedChapterText = selectedChapters
    .map((chapter) => {
      const images = includeImages
        ? chapter.images.map((image, index) => `${index + 1}. ${image.alt || `画面 ${index + 1}`} / ${image.size || "未标尺寸"} / ${image.quality || "未标质量"}\n${image.src}\n提示词：${truncateText(image.prompt, 1200)}`)
        : [];
      const storyboards = chapter.storyboards.map((storyboard, index) => {
        const imageCount = chapter.images.filter((image) => image.storyboardId === storyboard.id || storyboard.imageIds.includes(image.id)).length;

        return `${index + 1}. [${storyboard.kind}] ${storyboard.title || `分镜 ${index + 1}`}（id=${storyboard.id}，图片=${imageCount}，状态=${storyboard.status}）
画面：${truncateText(storyboard.beat || "无", 800)}
对白：${truncateText(storyboard.dialogue || "无", 500)}
镜头：${truncateText(storyboard.camera || "无", 500)}
提示词：${truncateText(storyboard.prompt || "无", 900)}`;
      });

      return `第 ${chapter.index} 章 ${chapter.title}（id=${chapter.id}，状态=${chapter.status}，更新=${chapter.updatedAt}）
章节内容简介：${chapter.summary || "无"}
章节正文/故事内容：
${truncateText(chapter.content || "无", maxContentChars)}
分镜与出图提示：
${truncateText(chapter.prompt || "无", 4000)}
章节分镜：
${storyboards.join("\n\n") || "无"}
引用素材：${chapter.assetRefs.join("、") || "无"}
图片：${images.join("\n\n") || "无"}`;
    })
    .join("\n\n");

  return buildTextResult(
    `已读取漫画项目：${project.title}
id=${project.id}
类型=${project.genre}
形态=${project.format}
画面=${project.palette}
状态=${project.status}
页数目标=${project.pageCount}
更新时间=${project.updatedAt}
素材数=${project.assets.length}
章节数=${project.chapters.length}

故事与画面目标：
${truncateText(project.summary || "无", 4000)}

画风与镜头：
${truncateText(project.visualStyle || "无", 4000)}

规划：
${truncateText(project.episodePlan || "无", 6000)}

章节目录：
${chapterSummaries.map((chapter) => `- 第 ${chapter.index} 章 ${chapter.title} / ${chapter.status} / 分镜 ${chapter.storyboardCount} 条 / 图片 ${chapter.imageCount} 张 / ${chapter.summary || "无简介"}`).join("\n") || "暂无章节"}
${selectedChapterText ? `\n\n选中章节：\n${selectedChapterText}` : ""}`,
    {
      applicationId: "comic",
      resourceType: "project",
      project: {
        ...summarizeComicProject(project, true, includeAssets),
        summary: project.summary,
        visualStyle: project.visualStyle,
        episodePlan: project.episodePlan,
        ...(includeAssets ? { assets: project.assets } : {}),
        chapters: chapterSummaries,
        selectedChapters: selectedChapters.map((chapter) => ({
          ...chapter,
          content: truncateText(chapter.content, maxContentChars),
          images: includeImages ? chapter.images : []
        }))
      }
    }
  );
}

function assertExpectedTimestamp(label: string, expected: string, actual: string): void {
  if (expected && expected !== actual) {
    throw new Error(`${label} 已变化，拒绝写回。expected=${expected} actual=${actual}`);
  }
}

function buildFieldPreview(before: unknown, after: unknown): JsonObject {
  return {
    before: truncateText(before, MAX_PREVIEW_CHARS),
    after: truncateText(after, MAX_PREVIEW_CHARS),
    beforeLength: String(before ?? "").length,
    afterLength: String(after ?? "").length
  };
}

function buildStructuredFieldPreview(before: unknown, after: unknown): JsonObject {
  const beforeText = JSON.stringify(before ?? null, null, 2);
  const afterText = JSON.stringify(after ?? null, null, 2);

  return {
    before: truncateText(beforeText, MAX_PREVIEW_CHARS),
    after: truncateText(afterText, MAX_PREVIEW_CHARS),
    beforeLength: beforeText.length,
    afterLength: afterText.length
  };
}

function formatFieldPreviewText(fields: JsonObject): string {
  return Object.entries(fields)
    .map(([field, value]) => {
      const preview = isObject(value) ? value : {};
      return `字段：${field}
旧值（${preview.beforeLength ?? 0} 字）：${truncateText(preview.before, 900) || "空"}
新值（${preview.afterLength ?? 0} 字）：${truncateText(preview.after, 1200) || "空"}`;
    })
    .join("\n\n");
}

function normalizeComicAssetRefsForTool(value: unknown, project: ComicProject): string[] {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  return asStringList(value).filter((assetId) => assetIds.has(assetId));
}

function normalizeComicChapterImageInput(value: unknown, index: number, fallbackPrompt = ""): ComicChapterImage | null {
  const source = isObject(value) ? value : {};
  const src = asString(source.src ?? source.url ?? source.dataUrl);

  if (!src) {
    return null;
  }

  const timestamp = asString(source.createdAt) || new Date().toISOString();

  return {
    id: asString(source.id) || createLocalId("comic_chapter_image"),
    storyboardId: asString(source.storyboardId) || undefined,
    alt: asString(source.alt ?? source.title) || `画面 ${index + 1}`,
    src,
    prompt: String(source.prompt ?? fallbackPrompt ?? ""),
    size: asString(source.size),
    quality: asString(source.quality),
    createdAt: timestamp
  };
}

function normalizeComicChapterImagesInput(value: unknown, fallbackPrompt = ""): ComicChapterImage[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeComicChapterImageInput(entry, index, fallbackPrompt))
    .filter((entry): entry is ComicChapterImage => Boolean(entry));
}

function normalizeComicStoryboardInput(value: unknown, index: number, current?: ComicStoryboardShot): ComicStoryboardShot | null {
  const source = isObject(value) ? value : {};
  const now = new Date().toISOString();
  const title = asString(source.title ?? source.name ?? current?.title);
  const beat = String(source.beat ?? source.summary ?? source.description ?? source.content ?? current?.beat ?? "");
  const dialogue = String(source.dialogue ?? source.lines ?? source.caption ?? current?.dialogue ?? "");
  const camera = String(source.camera ?? source.shot ?? source.composition ?? current?.camera ?? "");
  const prompt = String(source.prompt ?? source.imagePrompt ?? current?.prompt ?? "");

  if (!title && !beat && !dialogue && !camera && !prompt) {
    return null;
  }

  return {
    id: asString(source.id) || current?.id || createLocalId("comic_storyboard"),
    index: asPositiveInteger(source.index, index + 1, 9999),
    kind: asComicStoryboardKind(source.kind ?? current?.kind),
    title: title || current?.title || `分镜 ${index + 1}`,
    beat,
    dialogue,
    camera,
    prompt,
    status: asComicChapterStatus(source.status ?? current?.status),
    imageIds: asStringList(source.imageIds ?? current?.imageIds),
    updatedAt: asString(source.updatedAt) || now
  };
}

function normalizeComicStoryboardsInput(value: unknown, currentStoryboards: ComicStoryboardShot[] = []): ComicStoryboardShot[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => {
      const source = isObject(entry) ? entry : {};
      const sourceId = asString(source.id);
      const current = sourceId ? currentStoryboards.find((storyboard) => storyboard.id === sourceId) : undefined;
      return normalizeComicStoryboardInput(entry, index, current);
    })
    .filter((entry): entry is ComicStoryboardShot => Boolean(entry))
    .sort((left, right) => left.index - right.index)
    .map((storyboard, index) => ({ ...storyboard, index: index + 1 }));
}

function findComicStoryboard(chapter: ComicChapter, args: JsonObject): ComicStoryboardShot | null {
  const storyboardId = asString(args.storyboardId);
  const rawStoryboardIndex = args.storyboardIndex;
  const storyboardIndex =
    rawStoryboardIndex === undefined || rawStoryboardIndex === null || rawStoryboardIndex === ""
      ? null
      : Number(rawStoryboardIndex);

  if (storyboardId) {
    const storyboard = chapter.storyboards.find((entry) => entry.id === storyboardId);

    if (storyboard) {
      return storyboard;
    }

    throw new Error(`没有找到目标分镜：${storyboardId}`);
  }

  if (typeof storyboardIndex === "number" && Number.isInteger(storyboardIndex) && storyboardIndex > 0) {
    const storyboard = chapter.storyboards.find((entry) => entry.index === storyboardIndex);

    if (storyboard) {
      return storyboard;
    }

    throw new Error(`没有找到第 ${storyboardIndex} 条分镜。`);
  }

  return null;
}

function syncComicStoryboardImageIdsForTool(chapter: ComicChapter): ComicChapter {
  const images = chapter.images;
  const storyboards = chapter.storyboards.map((storyboard) => ({
    ...storyboard,
    imageIds: Array.from(
      new Set([
        ...storyboard.imageIds.filter((imageId) => images.some((image) => image.id === imageId)),
        ...images.filter((image) => image.storyboardId === storyboard.id).map((image) => image.id)
      ])
    )
  }));

  return {
    ...chapter,
    storyboards
  };
}

function normalizeComicAssetViewInput(value: unknown, index: number): ComicAssetView {
  const source = isObject(value) ? value : {};

  return {
    id: asString(source.id) || createLocalId("comic_asset_view"),
    kind: asComicAssetViewKind(source.kind),
    label: asString(source.label) || `视角 ${index + 1}`,
    src: asString(source.src ?? source.url ?? source.dataUrl),
    prompt: String(source.prompt ?? "")
  };
}

function getDefaultComicAssetViewsForTool(type: ComicAssetType): ComicAssetView[] {
  if (type === "scene") {
    return [
      { id: createLocalId("comic_asset_view"), kind: "wide", label: "全景", src: "", prompt: "" },
      { id: createLocalId("comic_asset_view"), kind: "angle", label: "视角 A", src: "", prompt: "" },
      { id: createLocalId("comic_asset_view"), kind: "detail", label: "细节", src: "", prompt: "" }
    ];
  }

  return [{ id: createLocalId("comic_asset_view"), kind: "turnaround", label: "三视图", src: "", prompt: "" }];
}

function normalizeComicAssetInput(value: unknown, index: number, current?: ComicAsset): ComicAsset | null {
  const source = isObject(value) ? value : {};
  const now = new Date().toISOString();
  const type = asComicAssetType(source.type ?? current?.type);
  const name = asString(source.name ?? source.title ?? current?.name);

  if (!name && !asString(source.description ?? current?.description) && !asString(source.prompt ?? current?.prompt)) {
    return null;
  }

  const incomingViews = Array.isArray(source.views)
    ? source.views.map((view, viewIndex) => normalizeComicAssetViewInput(view, viewIndex))
    : [];
  const views = incomingViews.length ? incomingViews : current?.views?.length ? current.views : getDefaultComicAssetViewsForTool(type);
  const chapterStartIndex = asOptionalPositiveInteger(source.chapterStartIndex ?? source.startChapterIndex ?? current?.chapterStartIndex);
  const chapterEndIndex = asOptionalPositiveInteger(source.chapterEndIndex ?? source.endChapterIndex ?? current?.chapterEndIndex);
  const sourceRefs = normalizeComicSourceRefsInput(source.sourceRefs ?? current?.sourceRefs);
  const variants = Array.isArray(source.variants)
    ? normalizeComicAssetVariantsInput(source.variants, views)
    : current?.variants ?? [];

  return {
    id: asString(source.id) || current?.id || createLocalId("comic_asset"),
    name: name || current?.name || `素材 ${index + 1}`,
    type,
    description: String(source.description ?? current?.description ?? ""),
    prompt: String(source.prompt ?? current?.prompt ?? ""),
    variantLabel: asString(source.variantLabel ?? current?.variantLabel) || undefined,
    ...(chapterStartIndex !== undefined ? { chapterStartIndex } : {}),
    ...(chapterEndIndex !== undefined ? { chapterEndIndex } : {}),
    ...(sourceRefs.length ? { sourceRefs } : {}),
    views,
    ...(variants.length ? { variants } : {}),
    createdAt: asString(source.createdAt) || current?.createdAt || now,
    updatedAt: now
  };
}

function mergeComicAssets(currentAssets: ComicAsset[], incomingAssets: ComicAsset[], mode: string): ComicAsset[] {
  if (mode === "replace") {
    return incomingAssets;
  }

  const byKey = new Map<string, ComicAsset>();

  for (const asset of currentAssets) {
    const key = normalizeAssetMergeKey(asset.id || asset.name);

    if (key) {
      byKey.set(key, asset);
    }

    const nameKey = normalizeAssetMergeKey(asset.name);
    if (nameKey && !byKey.has(nameKey)) {
      byKey.set(nameKey, asset);
    }
  }

  for (const asset of incomingAssets) {
    const key = normalizeAssetMergeKey(asset.id || asset.name);
    const nameKey = normalizeAssetMergeKey(asset.name);
    const current = (key ? byKey.get(key) : null) ?? (nameKey ? byKey.get(nameKey) : null);
    const merged = current
      ? {
          ...current,
          name: asset.name || current.name,
          type: asset.type || current.type,
          description: asset.description || current.description,
          prompt: asset.prompt || current.prompt,
          variantLabel: asset.variantLabel || current.variantLabel,
          chapterStartIndex: asset.chapterStartIndex ?? current.chapterStartIndex,
          chapterEndIndex: asset.chapterEndIndex ?? current.chapterEndIndex,
          sourceRefs: asset.sourceRefs?.length ? asset.sourceRefs : current.sourceRefs,
          views: asset.views.length ? asset.views : current.views,
          variants: asset.variants?.length ? asset.variants : current.variants,
          updatedAt: asset.updatedAt
        }
      : asset;
    const nextKey = normalizeAssetMergeKey(merged.id || merged.name);

    if (nextKey) {
      byKey.set(nextKey, merged);
    }

    if (nameKey) {
      byKey.set(nameKey, merged);
    }
  }

  return Array.from(new Map(Array.from(byKey.values()).map((asset) => [asset.id, asset])).values());
}

async function handleComicUpdateProjectFields(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const timestamp = new Date().toISOString();
  const nextProject: ComicProject = {
    ...project,
    ...(args.title !== undefined ? { title: asString(args.title) || project.title } : {}),
    ...(args.format !== undefined ? { format: asComicProjectFormat(args.format) } : {}),
    ...(args.palette !== undefined ? { palette: asComicProjectPalette(args.palette) } : {}),
    ...(args.genre !== undefined ? { genre: asString(args.genre) || project.genre } : {}),
    ...(args.status !== undefined ? { status: asString(args.status) || project.status } : {}),
    ...(args.summary !== undefined ? { summary: String(args.summary ?? "") } : {}),
    ...(args.visualStyle !== undefined ? { visualStyle: String(args.visualStyle ?? "") } : {}),
    ...(args.episodePlan !== undefined ? { episodePlan: String(args.episodePlan ?? "") } : {}),
    ...(args.pageCount !== undefined ? { pageCount: asPositiveInteger(args.pageCount, project.pageCount, 999) } : {}),
    updatedAt: timestamp
  };
  const fields: JsonObject = {};

  for (const field of ["title", "format", "palette", "genre", "status", "summary", "visualStyle", "episodePlan", "pageCount"] as const) {
    if (args[field] !== undefined) {
      fields[field] = buildFieldPreview(project[field], nextProject[field]);
    }
  }

  if (!Object.keys(fields).length) {
    throw new Error("没有提供任何漫画项目字段变更。");
  }

  assertExpectedTimestamp("漫画项目", asString(args.expectedProjectUpdatedAt), project.updatedAt);

  if (!dryRun) {
    const savedProjects = await upsertComicProject(nextProject);
    const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? nextProject;

    return buildTextResult(
      `已写回漫画项目字段：${project.title}
变更字段：${Object.keys(fields).join("、")}
更新时间：${savedProject.updatedAt}`,
      {
        applicationId: "comic",
        resourceType: "project",
        applied: true,
        dryRun: false,
        projectId: project.id,
        fields,
        savedProject: summarizeComicProject(savedProject, true, true)
      }
    );
  }

  return buildTextResult(
    `漫画项目字段修改预览（未写回）：${project.title}
变更字段：${Object.keys(fields).join("、")}
${formatFieldPreviewText(fields)}

如需保存，请在用户确认后再次调用 comic_update_project_fields 并设置 dryRun=false。`,
    {
      applicationId: "comic",
      resourceType: "project",
      applied: false,
      dryRun: true,
      projectId: project.id,
      fields,
      proposedProject: {
        ...summarizeComicProject(nextProject, true, true),
        summary: truncateText(nextProject.summary, MAX_TEXT_CHARS),
        visualStyle: truncateText(nextProject.visualStyle, MAX_TEXT_CHARS),
        episodePlan: truncateText(nextProject.episodePlan, MAX_TEXT_CHARS)
      }
    }
  );
}

async function handleWritingUpdateChapter(args: JsonObject) {
  const allBooks = await listWritingBooks();
  const book = findWritingBook(allBooks, asString(args.bookIdOrTitle));
  const chapter = findWritingChapter(book, args);
  const dryRun = asBoolean(args.dryRun, true);
  const timestamp = new Date().toISOString();
  const nextChapter = {
    ...chapter,
    ...(args.title !== undefined ? { title: asString(args.title) || chapter.title } : {}),
    ...(args.summary !== undefined ? { summary: String(args.summary ?? "") } : {}),
    ...(args.content !== undefined ? { content: String(args.content ?? "") } : {}),
    ...(args.status !== undefined ? { status: asString(args.status) as WritingChapter["status"] } : {}),
    updatedAt: timestamp
  };

  if (args.title === undefined && args.summary === undefined && args.content === undefined && args.status === undefined) {
    throw new Error("没有提供任何章节字段变更。请至少传入 title、summary、content 或 status。");
  }

  if (!["todo", "inProgress", "done"].includes(nextChapter.status)) {
    throw new Error("章节状态仅支持 todo、inProgress、done");
  }

  assertExpectedTimestamp("小说", asString(args.expectedBookUpdatedAt), book.updatedAt);
  assertExpectedTimestamp("章节", asString(args.expectedChapterUpdatedAt), chapter.updatedAt);

  const fields: JsonObject = {};

  for (const field of ["title", "summary", "content", "status"] as const) {
    if (args[field] !== undefined) {
      fields[field] = buildFieldPreview(chapter[field], nextChapter[field]);
    }
  }

  const nextBook: WritingBook = {
    ...book,
    updatedAt: timestamp,
    chapters: book.chapters.map((entry) => (entry.id === chapter.id ? nextChapter : entry))
  };

  if (!dryRun) {
    const savedBooks = await saveWritingBook(nextBook, { mergeChapters: true });
    const savedBook = savedBooks.find((entry) => entry.id === book.id) ?? nextBook;

    return buildTextResult(
      `已写回章节：${book.title} / ${chapterLabel(nextChapter)}
变更字段：${Object.keys(fields).join("、")}
更新时间：${savedBook.updatedAt}`,
      {
        applicationId: "writing",
        resourceType: "chapter",
        applied: true,
        dryRun: false,
        bookId: book.id,
        chapterId: chapter.id,
        fields,
        savedBook: summarizeBook(savedBook)
      }
    );
  }

  return buildTextResult(
    `章节修改预览（未写回）：${book.title} / ${chapterLabel(chapter)}
变更字段：${Object.keys(fields).join("、")}
${formatFieldPreviewText(fields)}

如需保存，请在用户确认后再次调用 writing_update_chapter 并设置 dryRun=false。`,
    {
      applicationId: "writing",
      resourceType: "chapter",
      applied: false,
      dryRun: true,
      bookId: book.id,
      chapterId: chapter.id,
      fields,
      proposedChapter: {
        id: nextChapter.id,
        index: nextChapter.index,
        title: nextChapter.title,
        summary: nextChapter.summary,
        status: nextChapter.status,
        content: truncateText(nextChapter.content, MAX_TEXT_CHARS),
        updatedAt: nextChapter.updatedAt
      }
    }
  );
}

async function handleComicCreateChapter(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const timestamp = new Date().toISOString();
  const requestedIndex =
    args.chapterIndex === undefined || args.chapterIndex === null || args.chapterIndex === ""
      ? null
      : asPositiveInteger(args.chapterIndex, project.chapters.length + 1, 9999);
  const nextIndex = requestedIndex ?? Math.max(0, ...project.chapters.map((chapter) => Number(chapter.index) || 0)) + 1;
  const title = asString(args.title) || `第 ${nextIndex} 章`;

  if (project.chapters.some((chapter) => chapter.index === nextIndex)) {
    throw new Error(`第 ${nextIndex} 章已存在；如需修改该章节，请使用 comic_update_chapter。`);
  }

  if (title && project.chapters.some((chapter) => chapter.title === title)) {
    throw new Error(`漫画章节标题已存在：${title}；如需修改该章节，请使用 comic_update_chapter。`);
  }

  assertExpectedTimestamp("漫画项目", asString(args.expectedProjectUpdatedAt), project.updatedAt);

  const storyboards = normalizeComicStoryboardsInput(args.storyboards, []);
  const incomingImages = normalizeComicChapterImagesInput(args.images, asString(args.prompt));
  const storyboardIds = new Set(storyboards.map((storyboard) => storyboard.id));
  const images = incomingImages.map((image) => ({
    ...image,
    storyboardId: image.storyboardId && storyboardIds.has(image.storyboardId) ? image.storyboardId : storyboards[0]?.id
  }));
  const chapter = syncComicStoryboardImageIdsForTool({
    id: createLocalId("comic_chapter"),
    index: nextIndex,
    title,
    summary: String(args.summary ?? ""),
    prompt: String(args.prompt ?? ""),
    content: String(args.content ?? ""),
    storyboards,
    images,
    status: asComicChapterStatus(args.status),
    assetRefs: normalizeComicAssetRefsForTool(args.assetRefs, project),
    updatedAt: timestamp
  });
  const nextChapters = [...project.chapters, chapter]
    .sort((left, right) => left.index - right.index)
    .map((entry, index) => ({ ...entry, index: index + 1 }));
  const nextProject: ComicProject = {
    ...project,
    chapters: nextChapters,
    updatedAt: timestamp
  };
  const chapterAfterReindex = nextChapters.find((entry) => entry.id === chapter.id) ?? chapter;

  if (!dryRun) {
    const savedProjects = await upsertComicProject(nextProject);
    const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? nextProject;
    const savedChapter = savedProject.chapters.find((entry) => entry.id === chapter.id) ?? chapterAfterReindex;

    return buildTextResult(
      `已创建漫画章节：${project.title} / 第 ${savedChapter.index} 章 ${savedChapter.title}
当前实际章节数：${savedProject.chapters.length}
更新时间：${savedProject.updatedAt}`,
      {
        applicationId: "comic",
        resourceType: "chapter",
        applied: true,
        dryRun: false,
        projectId: project.id,
        chapterId: savedChapter.id,
        createdChapter: {
          ...savedChapter,
          content: truncateText(savedChapter.content, MAX_TEXT_CHARS)
        },
        savedProject: summarizeComicProject(savedProject, true, true)
      }
    );
  }

  return buildTextResult(
    `漫画章节创建预览（未写回）：${project.title} / 第 ${chapterAfterReindex.index} 章 ${chapterAfterReindex.title}
当前实际章节数：${project.chapters.length}
创建后章节数：${nextProject.chapters.length}

如需保存，请在用户确认后再次调用 comic_create_chapter 并设置 dryRun=false。`,
    {
      applicationId: "comic",
      resourceType: "chapter",
      applied: false,
      dryRun: true,
      projectId: project.id,
      chapterId: chapterAfterReindex.id,
      proposedChapter: {
        ...chapterAfterReindex,
        content: truncateText(chapterAfterReindex.content, MAX_TEXT_CHARS)
      },
      proposedProject: summarizeComicProject(nextProject, true, true)
    }
  );
}

async function handleComicImportChapters(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const mode = asString(args.mode) === "append" || asString(args.mode) === "replaceRange" ? asString(args.mode) : "upsert";
  const timestamp = new Date().toISOString();
  const startIndex = asOptionalPositiveInteger(args.startIndex);
  const endIndex = asOptionalPositiveInteger(args.endIndex);

  assertExpectedTimestamp("漫画项目", asString(args.expectedProjectUpdatedAt), project.updatedAt);

  const incomingBase = normalizeComicChaptersForProject(args.chapters, project, timestamp, project.chapters);

  if (!incomingBase.length) {
    throw new Error("没有提供可导入的章节。请传入 chapters，且每章至少包含 title、summary、content、prompt、storyboards 或 images。");
  }

  let incomingChapters = incomingBase;

  if (mode === "append") {
    const baseIndex = startIndex ?? Math.max(0, ...project.chapters.map((chapter) => Number(chapter.index) || 0)) + 1;
    incomingChapters = incomingBase.map((chapter, index) => ({
      ...chapter,
      id: asString(chapter.id) && !project.chapters.some((entry) => entry.id === chapter.id) ? chapter.id : createLocalId("comic_chapter"),
      index: baseIndex + index,
      updatedAt: timestamp
    }));
  } else if (startIndex !== undefined) {
    incomingChapters = incomingBase.map((chapter, index) => ({
      ...chapter,
      index: startIndex + index
    }));
  }

  let nextChapters: ComicChapter[] = [];

  if (mode === "append") {
    const occupiedIndexes = new Set(project.chapters.map((chapter) => chapter.index));
    const duplicatedIndex = incomingChapters.find((chapter) => occupiedIndexes.has(chapter.index));

    if (duplicatedIndex) {
      throw new Error(`第 ${duplicatedIndex.index} 章已存在，append 模式不能覆盖已有章节；请改用 upsert 或指定新的 startIndex。`);
    }

    nextChapters = [...project.chapters, ...incomingChapters];
  } else if (mode === "replaceRange") {
    const firstIndex = startIndex ?? Math.min(...incomingChapters.map((chapter) => chapter.index));
    const lastIndex = endIndex ?? Math.max(...incomingChapters.map((chapter) => chapter.index));

    if (!Number.isFinite(firstIndex) || !Number.isFinite(lastIndex) || firstIndex > lastIndex) {
      throw new Error("replaceRange 需要有效的 startIndex/endIndex，且 startIndex 不能大于 endIndex。");
    }

    nextChapters = [
      ...project.chapters.filter((chapter) => chapter.index < firstIndex || chapter.index > lastIndex),
      ...incomingChapters.map((chapter, index) => ({
        ...chapter,
        index: firstIndex + index,
        updatedAt: timestamp
      }))
    ];
  } else {
    const nextById = new Map(project.chapters.map((chapter) => [chapter.id, chapter]));
    const consumedExistingIds = new Set<string>();

    for (const incoming of incomingChapters) {
      const current =
        project.chapters.find((chapter) => chapter.id === incoming.id) ??
        project.chapters.find((chapter) => chapter.index === incoming.index) ??
        project.chapters.find((chapter) => chapter.title === incoming.title);
      const chapter = current
        ? {
            ...current,
            ...incoming,
            id: current.id,
            index: incoming.index || current.index,
            updatedAt: timestamp
          }
        : {
            ...incoming,
            id: incoming.id || createLocalId("comic_chapter"),
            updatedAt: timestamp
          };

      if (current) {
        consumedExistingIds.add(current.id);
        nextById.set(current.id, chapter);
      } else {
        nextById.set(chapter.id, chapter);
      }
    }

    nextChapters = Array.from(nextById.values()).map((chapter) => (
      consumedExistingIds.has(chapter.id) || incomingChapters.some((incoming) => incoming.id === chapter.id)
        ? chapter
        : { ...chapter }
    ));
  }

  const sortedChapters = sortAndReindexComicChapters(nextChapters);
  const normalizedIncomingIds = new Set(incomingChapters.map((chapter) => chapter.id));
  const importedChapters = sortedChapters.filter((chapter) => normalizedIncomingIds.has(chapter.id));
  const incomingSource = normalizeComicProjectSourceInput(args.source, timestamp, sortedChapters.length);
  const nextProject: ComicProject = {
    ...project,
    source: mergeComicProjectSource(project.source, incomingSource, timestamp, sortedChapters.length),
    chapters: sortedChapters,
    updatedAt: timestamp
  };
  const stats = buildComicChapterImportStats(project.chapters, sortedChapters, incomingChapters);
  const fields: JsonObject = {
    chapters: buildStructuredFieldPreview(
      project.chapters.map((chapter) => ({ id: chapter.id, index: chapter.index, title: chapter.title })),
      sortedChapters.map((chapter) => ({ id: chapter.id, index: chapter.index, title: chapter.title }))
    ),
    source: buildStructuredFieldPreview(project.source, nextProject.source)
  };

  if (!dryRun) {
    const savedProjects = await upsertComicProject(nextProject);
    const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? nextProject;

    return buildTextResult(
      `已导入漫画章节：${project.title}
模式：${mode}
输入章节：${incomingChapters.length} 章
章节数：${project.chapters.length} -> ${savedProject.chapters.length}
新增：${stats.createdCount}，更新：${stats.updatedCount}，移除范围内旧章：${stats.replacedCount}
更新时间：${savedProject.updatedAt}`,
      {
        applicationId: "comic",
        resourceType: "chapters",
        applied: true,
        dryRun: false,
        mode,
        projectId: project.id,
        fields,
        stats,
        importedChapters: importedChapters.map((chapter) => ({
          id: chapter.id,
          index: chapter.index,
          title: chapter.title,
          summary: chapter.summary,
          contentLength: chapter.content.length,
          sourceRefs: chapter.sourceRefs
        })),
        savedProject: summarizeComicProject(savedProject, true, true)
      }
    );
  }

  return buildTextResult(
    `漫画章节批量导入预览（未写回）：${project.title}
模式：${mode}
输入章节：${incomingChapters.length} 章
章节数：${project.chapters.length} -> ${sortedChapters.length}
新增：${stats.createdCount}，更新：${stats.updatedCount}，移除范围内旧章：${stats.replacedCount}

如需保存，请在用户确认后再次调用 comic_import_chapters 并设置 dryRun=false。`,
    {
      applicationId: "comic",
      resourceType: "chapters",
      applied: false,
      dryRun: true,
      mode,
      projectId: project.id,
      fields,
      stats,
      importedChapters: importedChapters.map((chapter) => ({
        id: chapter.id,
        index: chapter.index,
        title: chapter.title,
        summary: chapter.summary,
        contentLength: chapter.content.length,
        sourceRefs: chapter.sourceRefs
      })),
      proposedProject: summarizeComicProject(nextProject, true, true)
    }
  );
}

async function handleComicUpdateChapter(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const chapter = findComicChapter(project, args);
  const dryRun = asBoolean(args.dryRun, true);
  const timestamp = new Date().toISOString();
  const nextChapterBase: ComicChapter = {
    ...chapter,
    ...(args.title !== undefined ? { title: asString(args.title) || chapter.title } : {}),
    ...(args.summary !== undefined ? { summary: String(args.summary ?? "") } : {}),
    ...(args.prompt !== undefined ? { prompt: String(args.prompt ?? "") } : {}),
    ...(args.content !== undefined ? { content: String(args.content ?? "") } : {}),
    ...(args.storyboards !== undefined ? { storyboards: normalizeComicStoryboardsInput(args.storyboards, chapter.storyboards) } : {}),
    ...(args.status !== undefined ? { status: asComicChapterStatus(args.status) } : {}),
    ...(args.assetRefs !== undefined ? { assetRefs: normalizeComicAssetRefsForTool(args.assetRefs, project) } : {}),
    updatedAt: timestamp
  };
  const nextChapter = syncComicStoryboardImageIdsForTool(nextChapterBase);
  const fields: JsonObject = {};

  for (const field of ["title", "summary", "prompt", "content", "storyboards", "status", "assetRefs"] as const) {
    if (args[field] !== undefined) {
      fields[field] =
        field === "assetRefs" || field === "storyboards"
          ? buildStructuredFieldPreview(chapter[field], nextChapter[field])
          : buildFieldPreview(chapter[field], nextChapter[field]);
    }
  }

  if (!Object.keys(fields).length) {
    throw new Error("没有提供任何漫画章节字段变更。");
  }

  assertExpectedTimestamp("漫画项目", asString(args.expectedProjectUpdatedAt), project.updatedAt);
  assertExpectedTimestamp("漫画章节", asString(args.expectedChapterUpdatedAt), chapter.updatedAt);

  const nextProject: ComicProject = {
    ...project,
    chapters: project.chapters.map((entry) => (entry.id === chapter.id ? nextChapter : entry)),
    updatedAt: timestamp
  };

  if (!dryRun) {
    const savedProjects = await upsertComicProject(nextProject);
    const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? nextProject;

    return buildTextResult(
      `已写回漫画章节：${project.title} / 第 ${nextChapter.index} 章 ${nextChapter.title}
变更字段：${Object.keys(fields).join("、")}
更新时间：${savedProject.updatedAt}`,
      {
        applicationId: "comic",
        resourceType: "chapter",
        applied: true,
        dryRun: false,
        projectId: project.id,
        chapterId: chapter.id,
        fields,
        savedProject: summarizeComicProject(savedProject, true, true)
      }
    );
  }

  return buildTextResult(
    `漫画章节修改预览（未写回）：${project.title} / 第 ${chapter.index} 章 ${chapter.title}
变更字段：${Object.keys(fields).join("、")}
${formatFieldPreviewText(fields)}

如需保存，请在用户确认后再次调用 comic_update_chapter 并设置 dryRun=false。`,
    {
      applicationId: "comic",
      resourceType: "chapter",
      applied: false,
      dryRun: true,
      projectId: project.id,
      chapterId: chapter.id,
      fields,
      proposedChapter: {
        ...nextChapter,
        content: truncateText(nextChapter.content, MAX_TEXT_CHARS)
      }
    }
  );
}

async function handleComicUpdateChapterImages(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const chapter = findComicChapter(project, args);
  const dryRun = asBoolean(args.dryRun, true);
  const mode = asString(args.mode) === "replace" ? "replace" : "append";
  const timestamp = new Date().toISOString();
  const targetStoryboard = findComicStoryboard(chapter, args);
  const incomingImages = normalizeComicChapterImagesInput(args.images, asString(args.prompt || targetStoryboard?.prompt || chapter.prompt)).map((image) => ({
    ...image,
    storyboardId: targetStoryboard?.id ?? image.storyboardId
  }));

  if (!incomingImages.length) {
    throw new Error("没有提供可写入的漫画图片。请传入 images，且每张至少包含 src。");
  }

  assertExpectedTimestamp("漫画项目", asString(args.expectedProjectUpdatedAt), project.updatedAt);
  assertExpectedTimestamp("漫画章节", asString(args.expectedChapterUpdatedAt), chapter.updatedAt);

  const nextImages =
    mode === "replace" && targetStoryboard
      ? [...chapter.images.filter((image) => image.storyboardId !== targetStoryboard.id), ...incomingImages]
      : mode === "replace"
        ? incomingImages
        : [...chapter.images, ...incomingImages];
  const nextChapterBase: ComicChapter = {
    ...chapter,
    ...(args.prompt !== undefined ? { prompt: String(args.prompt ?? "") } : {}),
    images: nextImages,
    storyboards: chapter.storyboards.map((storyboard) =>
      storyboard.id === targetStoryboard?.id && storyboard.status === "todo"
        ? { ...storyboard, status: "inProgress", updatedAt: timestamp }
        : storyboard
    ),
    status: chapter.status === "todo" ? "inProgress" : chapter.status,
    updatedAt: timestamp
  };
  const nextChapter = syncComicStoryboardImageIdsForTool(nextChapterBase);
  const nextProject: ComicProject = {
    ...project,
    chapters: project.chapters.map((entry) => (entry.id === chapter.id ? nextChapter : entry)),
    updatedAt: timestamp
  };
  const fields: JsonObject = {
    images: buildStructuredFieldPreview(chapter.images, nextImages)
  };

  if (args.prompt !== undefined) {
    fields.prompt = buildFieldPreview(chapter.prompt, nextChapter.prompt);
  }

  if (!dryRun) {
    const savedProjects = await upsertComicProject(nextProject);
    const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? nextProject;

    return buildTextResult(
      `已写回漫画章节图片：${project.title} / 第 ${chapter.index} 章 ${chapter.title}
模式：${mode}
目标分镜：${targetStoryboard ? `${targetStoryboard.index}. ${targetStoryboard.title}` : "整章"}
新增图片：${incomingImages.length} 张
章节图片总数：${nextImages.length}
更新时间：${savedProject.updatedAt}`,
      {
        applicationId: "comic",
        resourceType: "chapterImages",
        applied: true,
        dryRun: false,
        mode,
        storyboardId: targetStoryboard?.id ?? "",
        projectId: project.id,
        chapterId: chapter.id,
        fields,
        savedProject: summarizeComicProject(savedProject, true, true),
        images: incomingImages
      }
    );
  }

  return buildTextResult(
    `漫画章节图片写入预览（未写回）：${project.title} / 第 ${chapter.index} 章 ${chapter.title}
模式：${mode}
目标分镜：${targetStoryboard ? `${targetStoryboard.index}. ${targetStoryboard.title}` : "整章"}
新增图片：${incomingImages.length} 张
章节图片总数：${chapter.images.length} -> ${nextImages.length}

如需保存，请在用户确认后再次调用 comic_update_chapter_images 并设置 dryRun=false。`,
    {
      applicationId: "comic",
      resourceType: "chapterImages",
      applied: false,
      dryRun: true,
      mode,
      projectId: project.id,
      chapterId: chapter.id,
      fields,
      images: incomingImages,
      proposedChapter: {
        ...nextChapter,
        content: truncateText(nextChapter.content, MAX_TEXT_CHARS)
      }
    }
  );
}

async function handleWritingUpdateBookFields(args: JsonObject) {
  const allBooks = await listWritingBooks();
  const book = findWritingBook(allBooks, asString(args.bookIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const timestamp = new Date().toISOString();
  const fields: JsonObject = {};
  const outlineGuideFromArgs =
    args.outlineGuide !== undefined ? String(args.outlineGuide ?? "") : args.seriesPlan !== undefined ? String(args.seriesPlan ?? "") : undefined;
  const nextGenre = args.genre !== undefined ? asString(args.genre) || book.genre : book.genre;
  const nextGenreProfile =
    args.genreProfile !== undefined
      ? normalizeGenreProfileInput(args.genreProfile, nextGenre, timestamp)
      : args.genre !== undefined
        ? normalizeGenreProfileInput(book.genreProfile, nextGenre, timestamp)
        : book.genreProfile;
  const nextBook: WritingBook = {
    ...book,
    ...(args.intro !== undefined ? { intro: String(args.intro ?? "") } : {}),
    ...(outlineGuideFromArgs !== undefined ? { outlineGuide: outlineGuideFromArgs } : { outlineGuide: getUnifiedWritingOutlineGuide(book) }),
    seriesPlan: "",
    genre: nextGenre,
    genreProfile: nextGenreProfile,
    ...(args.status !== undefined ? { status: asString(args.status) || book.status } : {}),
    updatedAt: timestamp
  };

  for (const field of ["intro", "genre", "status"] as const) {
    if (args[field] !== undefined) {
      fields[field] = buildFieldPreview(book[field], nextBook[field]);
    }
  }

  if (args.genreProfile !== undefined) {
    fields.genreProfile = buildStructuredFieldPreview(book.genreProfile, nextBook.genreProfile);
  }

  if (outlineGuideFromArgs !== undefined) {
    fields.outlineGuide = buildFieldPreview(getUnifiedWritingOutlineGuide(book), nextBook.outlineGuide);
  }

  if (!Object.keys(fields).length) {
    throw new Error("没有提供任何小说字段变更。请至少传入 intro、outlineGuide、genre、genreProfile 或 status。");
  }

  assertExpectedTimestamp("小说", asString(args.expectedBookUpdatedAt), book.updatedAt);

  if (!dryRun) {
    const savedBooks = await saveWritingBook(nextBook, { mergeChapters: true });
    const savedBook = savedBooks.find((entry) => entry.id === book.id) ?? nextBook;

    return buildTextResult(
      `已写回小说字段：${book.title}
变更字段：${Object.keys(fields).join("、")}
更新时间：${savedBook.updatedAt}`,
      {
        applicationId: "writing",
        resourceType: "book",
        applied: true,
        dryRun: false,
        bookId: book.id,
        fields,
        savedBook: summarizeBook(savedBook)
      }
    );
  }

  return buildTextResult(
    `小说字段修改预览（未写回）：${book.title}
变更字段：${Object.keys(fields).join("、")}
${formatFieldPreviewText(fields)}

如需保存，请在用户确认后再次调用 writing_update_book_fields 并设置 dryRun=false。`,
    {
      applicationId: "writing",
      resourceType: "book",
      applied: false,
      dryRun: true,
      bookId: book.id,
      fields,
      proposedBook: {
        id: nextBook.id,
        title: nextBook.title,
        intro: truncateText(nextBook.intro, MAX_TEXT_CHARS),
        outlineGuide: truncateText(nextBook.outlineGuide, MAX_TEXT_CHARS),
        genre: nextBook.genre,
        status: nextBook.status,
        updatedAt: nextBook.updatedAt
      }
    }
  );
}

async function handleWritingUpdateStoryAssets(args: JsonObject) {
  const allBooks = await listWritingBooks();
  const book = findWritingBook(allBooks, asString(args.bookIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const mode = asString(args.mode) === "replace" ? "replace" : "merge";
  const timestamp = new Date().toISOString();
  const incomingStoryAssets = normalizeWritingStoryAssetsInput(args.storyAssets, book.id, timestamp);
  const incomingNarrativeState = normalizeWritingNarrativeStateInput(args.narrativeState, book.id, timestamp);
  const incomingExtraIntroSections = normalizeExtraIntroSections(args.extraIntroSections, book.id, timestamp);
  const hasStoryAssets =
    incomingStoryAssets.premise ||
    incomingStoryAssets.worldview.length ||
    incomingStoryAssets.characters.length ||
    incomingStoryAssets.relationships.length ||
    incomingStoryAssets.timeline.length ||
    incomingStoryAssets.foreshadows.length ||
    incomingStoryAssets.rules.length ||
    incomingStoryAssets.memoryNotes.length ||
    incomingStoryAssets.styleProfile.voice ||
    incomingStoryAssets.styleProfile.pacing ||
    incomingStoryAssets.styleProfile.genreSignals.length ||
    incomingStoryAssets.styleProfile.taboos.length ||
    incomingStoryAssets.styleProfile.proseDensity ||
    incomingStoryAssets.styleProfile.dialogueRatio ||
    incomingStoryAssets.styleProfile.narrationDistance ||
    incomingStoryAssets.styleProfile.emotionalTemperature ||
    incomingStoryAssets.styleProfile.humorLevel ||
    incomingStoryAssets.styleProfile.violenceExplicitness ||
    incomingStoryAssets.styleProfile.pacingCurve?.length;
  const hasNarrativeState =
    incomingNarrativeState.characters.length ||
    incomingNarrativeState.worldRules.length ||
    incomingNarrativeState.resources.length ||
    incomingNarrativeState.regions.length ||
    incomingNarrativeState.foreshadows.length ||
    incomingNarrativeState.arcs.length ||
    incomingNarrativeState.timelineEvents.length ||
    incomingNarrativeState.continuityWarnings.length ||
    incomingNarrativeState.planDriftNotes.length;
  const hasExtraIntroSections = incomingExtraIntroSections.length > 0;

  if (!hasStoryAssets && !hasNarrativeState && !hasExtraIntroSections) {
    throw new Error("没有提供任何故事资产变更。请至少传入 storyAssets、narrativeState 或 extraIntroSections。");
  }

  assertExpectedTimestamp("小说", asString(args.expectedBookUpdatedAt), book.updatedAt);

  const nextStoryAssets = hasStoryAssets
    ? mergeWritingStoryAssets(book.storyAssets, incomingStoryAssets, mode, timestamp)
    : {
        ...book.storyAssets,
        updatedAt: timestamp
      };
  const nextExtraIntroSections = hasExtraIntroSections
    ? mergeExtraIntroSections(book.extraIntroSections ?? [], incomingExtraIntroSections, mode)
    : book.extraIntroSections ?? [];
  const nextNarrativeState = hasNarrativeState
    ? mergeWritingNarrativeState(book.narrativeState ?? createEmptyWritingNarrativeState(book.id, timestamp), incomingNarrativeState, mode, timestamp)
    : {
        ...(book.narrativeState ?? createEmptyWritingNarrativeState(book.id, timestamp)),
        updatedAt: timestamp
      };
  const nextBook: WritingBook = {
    ...book,
    storyAssets: nextStoryAssets,
    narrativeState: nextNarrativeState,
    extraIntroSections: nextExtraIntroSections,
    updatedAt: timestamp
  };
  const fields: JsonObject = {};

  if (hasStoryAssets) {
    fields.storyAssets = buildStructuredFieldPreview(book.storyAssets, nextStoryAssets);
  }

  if (hasNarrativeState) {
    fields.narrativeState = buildStructuredFieldPreview(book.narrativeState, nextNarrativeState);
  }

  if (hasExtraIntroSections) {
    fields.extraIntroSections = buildStructuredFieldPreview(book.extraIntroSections, nextExtraIntroSections);
  }

  if (!dryRun) {
    const savedBooks = await saveWritingBook(nextBook, { mergeChapters: true });
    const savedBook = savedBooks.find((entry) => entry.id === book.id) ?? nextBook;

    return buildTextResult(
      `已写回故事资产：${book.title}
模式：${mode}
变更字段：${Object.keys(fields).join("、")}
补充设定区块=${savedBook.extraIntroSections.length} 个
故事资产=${Object.entries(summarizeStoryAssets(savedBook.storyAssets))
        .map(([key, value]) => `${key}=${value}`)
        .join("，")}
叙事状态=${Object.entries(summarizeNarrativeState(savedBook.narrativeState))
        .map(([key, value]) => `${key}=${value}`)
        .join("，")}
更新时间：${savedBook.updatedAt}`,
      {
        applicationId: "writing",
        resourceType: "storyAssets",
        applied: true,
        dryRun: false,
        mode,
        bookId: book.id,
        fields,
        savedBook: {
          ...summarizeBook(savedBook),
          extraIntroSections: savedBook.extraIntroSections,
          storyAssets: savedBook.storyAssets,
          narrativeState: savedBook.narrativeState
        }
      }
    );
  }

  return buildTextResult(
    `故事资产修改预览（未写回）：${book.title}
模式：${mode}
变更字段：${Object.keys(fields).join("、")}
补充设定区块：${book.extraIntroSections.length} -> ${nextExtraIntroSections.length}
故事资产：${Object.entries(summarizeStoryAssets(nextStoryAssets))
      .map(([key, value]) => `${key}=${value}`)
      .join("，")}
叙事状态：${Object.entries(summarizeNarrativeState(nextNarrativeState))
      .map(([key, value]) => `${key}=${value}`)
      .join("，")}

如需保存，请在用户确认后再次调用 writing_update_story_assets 并设置 dryRun=false。`,
    {
      applicationId: "writing",
      resourceType: "storyAssets",
      applied: false,
      dryRun: true,
      mode,
      bookId: book.id,
      fields,
      proposedBook: {
        id: nextBook.id,
        title: nextBook.title,
        updatedAt: nextBook.updatedAt,
        extraIntroSections: nextExtraIntroSections,
        storyAssets: nextStoryAssets,
        narrativeState: nextNarrativeState
      }
    }
  );
}

async function handleComicUpdateAssets(args: JsonObject) {
  const projects = await listComicProjects();
  const project = findComicProject(projects, asString(args.projectIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const mode = asString(args.mode) === "replace" ? "replace" : "merge";
  const timestamp = new Date().toISOString();
  const existingById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const existingByName = new Map(project.assets.map((asset) => [normalizeAssetMergeKey(asset.name), asset]));
  const incomingAssets = (Array.isArray(args.assets) ? args.assets : [])
    .map((entry, index) => {
      const source = isObject(entry) ? entry : {};
      const current =
        (asString(source.id) ? existingById.get(asString(source.id)) : null) ??
        (asString(source.name) ? existingByName.get(normalizeAssetMergeKey(source.name)) : null);
      return normalizeComicAssetInput(entry, index, current ?? undefined);
    })
    .filter((entry): entry is ComicAsset => Boolean(entry));

  if (!incomingAssets.length) {
    throw new Error("没有提供可写入的漫画素材。请传入 assets。");
  }

  assertExpectedTimestamp("漫画项目", asString(args.expectedProjectUpdatedAt), project.updatedAt);

  const nextAssets = mergeComicAssets(project.assets, incomingAssets, mode);
  const nextAssetIds = new Set(nextAssets.map((asset) => asset.id));
  const nextProject: ComicProject = {
    ...project,
    assets: nextAssets,
    chapters: project.chapters.map((chapter) => ({
      ...chapter,
      assetRefs: chapter.assetRefs.filter((assetId) => nextAssetIds.has(assetId))
    })),
    updatedAt: timestamp
  };
  const fields: JsonObject = {
    assets: buildStructuredFieldPreview(project.assets, nextAssets)
  };

  if (!dryRun) {
    const savedProjects = await upsertComicProject(nextProject);
    const savedProject = savedProjects.find((entry) => entry.id === project.id) ?? nextProject;

    return buildTextResult(
      `已写回漫画素材库：${project.title}
模式：${mode}
输入素材：${incomingAssets.length} 个
素材总数：${savedProject.assets.length} 个
更新时间：${savedProject.updatedAt}`,
      {
        applicationId: "comic",
        resourceType: "assets",
        applied: true,
        dryRun: false,
        mode,
        projectId: project.id,
        fields,
        savedProject: summarizeComicProject(savedProject, true, true),
        assets: incomingAssets
      }
    );
  }

  return buildTextResult(
    `漫画素材库修改预览（未写回）：${project.title}
模式：${mode}
输入素材：${incomingAssets.length} 个
素材总数：${project.assets.length} -> ${nextAssets.length}

如需保存，请在用户确认后再次调用 comic_update_assets 并设置 dryRun=false。`,
    {
      applicationId: "comic",
      resourceType: "assets",
      applied: false,
      dryRun: true,
      mode,
      projectId: project.id,
      fields,
      assets: incomingAssets,
      proposedProject: {
        ...summarizeComicProject(nextProject, true, true),
        assets: nextAssets
      }
    }
  );
}

export async function callApplicationTool(server: McpServerConfig, request: McpToolCallRequest): Promise<McpToolCallResult> {
  const args = isObject(request.arguments) ? request.arguments : {};
  let result: Omit<McpToolCallResult, "serverId" | "serverName" | "toolName" | "isError">;

  switch (request.toolName) {
    case "writing_create_book":
      result = await handleWritingCreateBook(args);
      break;
    case "writing_list_books":
      result = await handleWritingListBooks(args);
      break;
    case "writing_read_book":
      result = await handleWritingReadBook(args);
      break;
    case "writing_search_book":
      result = await handleWritingSearchBook(args);
      break;
    case "writing_update_chapter":
      result = await handleWritingUpdateChapter(args);
      break;
    case "writing_update_book_fields":
      result = await handleWritingUpdateBookFields(args);
      break;
    case "writing_update_story_assets":
      result = await handleWritingUpdateStoryAssets(args);
      break;
    case "comic_list_projects":
      result = await handleComicListProjects(args);
      break;
    case "comic_create_project":
      result = await handleComicCreateProject(args);
      break;
    case "comic_read_project":
      result = await handleComicReadProject(args);
      break;
    case "comic_update_project_fields":
      result = await handleComicUpdateProjectFields(args);
      break;
    case "comic_create_chapter":
      result = await handleComicCreateChapter(args);
      break;
    case "comic_import_chapters":
      result = await handleComicImportChapters(args);
      break;
    case "comic_update_chapter":
      result = await handleComicUpdateChapter(args);
      break;
    case "comic_update_chapter_images":
      result = await handleComicUpdateChapterImages(args);
      break;
    case "comic_update_assets":
      result = await handleComicUpdateAssets(args);
      break;
    default:
      throw new Error(`未知应用工具：${request.toolName}`);
  }

  return {
    serverId: server.id,
    serverName: server.name,
    toolName: request.toolName,
    isError: false,
    ...result
  };
}
