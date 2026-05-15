import { listWritingBooks, saveWritingBook } from "../../workbench/src/index.js";
import type {
  McpServerConfig,
  McpToolCallRequest,
  McpToolCallResult,
  McpToolDefinition,
  WritingBook,
  WritingChapter
} from "../../shared/src/index.js";

export const BUILTIN_APPLICATION_TOOLS_MCP_ID = "builtin:mcp:application-tools";

const MAX_TEXT_CHARS = 24_000;
const MAX_PREVIEW_CHARS = 2_400;
const MAX_SEARCH_RESULTS = 20;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
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

export async function callApplicationTool(server: McpServerConfig, request: McpToolCallRequest): Promise<McpToolCallResult> {
  const args = isObject(request.arguments) ? request.arguments : {};
  let result: Omit<McpToolCallResult, "serverId" | "serverName" | "toolName" | "isError">;

  switch (request.toolName) {
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
