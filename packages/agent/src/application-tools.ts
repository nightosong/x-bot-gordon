import { randomUUID } from "node:crypto";

import { listWritingBooks, saveWritingBook } from "../../workbench/src/index.js";
import type {
  McpServerConfig,
  McpToolCallRequest,
  McpToolCallResult,
  McpToolDefinition,
  WritingBook,
  WritingBookIntroSection,
  WritingBookLength,
  WritingChapter,
  WritingCharacterAsset,
  WritingForeshadowAsset,
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
        taboos: { type: "array", items: { type: "string" } }
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

function asOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
    updatedAt: asString(source.updatedAt) || timestamp
  };
}

function normalizeForeshadowAssets(value: unknown, bookId: string, timestamp: string): WritingForeshadowAsset[] {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => normalizeForeshadowAsset(entry, index, bookId, timestamp))
    .filter((entry): entry is WritingForeshadowAsset => Boolean(entry));
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
    styleProfile: {
      voice: asString(isObject(source.styleProfile) ? source.styleProfile.voice : ""),
      pacing: asString(isObject(source.styleProfile) ? source.styleProfile.pacing : ""),
      genreSignals: asStringList(isObject(source.styleProfile) ? source.styleProfile.genreSignals : []),
      taboos: asStringList(isObject(source.styleProfile) ? source.styleProfile.taboos : [])
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
    styleProfile: {
      voice: incomingAssets.styleProfile.voice || currentAssets.styleProfile.voice,
      pacing: incomingAssets.styleProfile.pacing || currentAssets.styleProfile.pacing,
      genreSignals: Array.from(new Set([...currentAssets.styleProfile.genreSignals, ...incomingAssets.styleProfile.genreSignals])),
      taboos: Array.from(new Set([...currentAssets.styleProfile.taboos, ...incomingAssets.styleProfile.taboos]))
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

function summarizeStoryAssets(assets: WritingBook["storyAssets"]): JsonObject {
  return {
    premise: Boolean(assets.premise),
    worldview: assets.worldview.length,
    characters: assets.characters.length,
    relationships: assets.relationships.length,
    timeline: assets.timeline.length,
    foreshadows: assets.foreshadows.length,
    rules: assets.rules.length,
    memoryNotes: assets.memoryNotes.length,
    styleProfile: Boolean(
      assets.styleProfile.voice ||
        assets.styleProfile.pacing ||
        assets.styleProfile.genreSignals.length ||
        assets.styleProfile.taboos.length
    )
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
    status: book.status,
    length: book.length,
    updatedAt: book.updatedAt,
    directoryName: book.directoryName,
    chapterCount: book.chapters.length,
    doneChapterCount: book.chapters.filter((chapter) => chapter.status === "done").length,
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
          extraIntroSections: EXTRA_INTRO_SECTIONS_SCHEMA,
          dryRun: { type: "boolean", description: "可选，默认 true。true 只预览，false 写回本地书稿" },
          expectedBookUpdatedAt: { type: "string", description: "可选，乐观锁：若书籍更新时间不一致则拒绝写回" }
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
  const emptyStoryAssets = createEmptyWritingStoryAssets(bookId, premise, timestamp);
  const incomingStoryAssets = normalizeWritingStoryAssetsInput(args.storyAssets, bookId, timestamp);
  const storyAssets = mergeWritingStoryAssets(emptyStoryAssets, incomingStoryAssets, "merge", timestamp);
  const book: WritingBook = {
    id: bookId,
    title,
    author: asString(args.author) || "Song",
    length: asWritingBookLength(args.length),
    genre: asString(args.genre) || "小说 / 待定类型",
    status: asString(args.status) || "新建",
    updatedAt: timestamp,
    coverTone: "teal",
    intro: String(args.intro ?? ""),
    outlineGuide: String(args.outlineGuide ?? ""),
    seriesPlan: "",
    extraIntroSections: normalizeExtraIntroSections(args.extraIntroSections, bookId, timestamp),
    parts: normalizeInitialBookParts(args, bookId),
    storyAssets,
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
          storyAssets: book.storyAssets
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
        storyAssets: savedBook.storyAssets
      }
    }
  );
}

async function handleWritingReadBook(args: JsonObject) {
  const books = await listWritingBooks();
  const book = findWritingBook(books, asString(args.bookIdOrTitle));
  const includeStoryAssets = asBoolean(args.includeStoryAssets, true);
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
  return JSON.stringify(book.storyAssets ?? {}, null, 2);
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

async function handleWritingUpdateBookFields(args: JsonObject) {
  const allBooks = await listWritingBooks();
  const book = findWritingBook(allBooks, asString(args.bookIdOrTitle));
  const dryRun = asBoolean(args.dryRun, true);
  const timestamp = new Date().toISOString();
  const fields: JsonObject = {};
  const outlineGuideFromArgs =
    args.outlineGuide !== undefined ? String(args.outlineGuide ?? "") : args.seriesPlan !== undefined ? String(args.seriesPlan ?? "") : undefined;
  const nextBook: WritingBook = {
    ...book,
    ...(args.intro !== undefined ? { intro: String(args.intro ?? "") } : {}),
    ...(outlineGuideFromArgs !== undefined ? { outlineGuide: outlineGuideFromArgs } : { outlineGuide: getUnifiedWritingOutlineGuide(book) }),
    seriesPlan: "",
    ...(args.genre !== undefined ? { genre: asString(args.genre) || book.genre } : {}),
    ...(args.status !== undefined ? { status: asString(args.status) || book.status } : {}),
    updatedAt: timestamp
  };

  for (const field of ["intro", "genre", "status"] as const) {
    if (args[field] !== undefined) {
      fields[field] = buildFieldPreview(book[field], nextBook[field]);
    }
  }

  if (outlineGuideFromArgs !== undefined) {
    fields.outlineGuide = buildFieldPreview(getUnifiedWritingOutlineGuide(book), nextBook.outlineGuide);
  }

  if (!Object.keys(fields).length) {
    throw new Error("没有提供任何小说字段变更。请至少传入 intro、outlineGuide、genre 或 status。");
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
    incomingStoryAssets.styleProfile.taboos.length;
  const hasExtraIntroSections = incomingExtraIntroSections.length > 0;

  if (!hasStoryAssets && !hasExtraIntroSections) {
    throw new Error("没有提供任何故事资产变更。请至少传入 storyAssets 或 extraIntroSections。");
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
  const nextBook: WritingBook = {
    ...book,
    storyAssets: nextStoryAssets,
    extraIntroSections: nextExtraIntroSections,
    updatedAt: timestamp
  };
  const fields: JsonObject = {};

  if (hasStoryAssets) {
    fields.storyAssets = buildStructuredFieldPreview(book.storyAssets, nextStoryAssets);
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
          storyAssets: savedBook.storyAssets
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
        storyAssets: nextStoryAssets
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
