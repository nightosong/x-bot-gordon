import { computed } from "vue";

import {
  WRITING_AI_TASKS,
  WRITING_APP_TABS,
  WRITING_AUTOSAVE_DELAY,
  WRITING_BOOK_EXPORT_FORMATS,
  WRITING_CHAPTER_PREFIX_PATTERN,
  WRITING_CHAPTER_STATUS_META,
  WRITING_INTRO_SECTION_DEFINITIONS,
  WRITING_LENGTH_PROFILES,
  WRITING_LONG_OUTLINE_BATCH_SIZE,
  WRITING_PART_PREFIX_PATTERN
} from "./writingConfig.js";

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

export function createWritingActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId,
  nextTick,
  setStatus,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench,
  writingChapterDropdownMenuRef
}) {
  let writingAutosaveTimer = null;
  let writingSaveInFlight = false;
  let writingQueuedSave = null;
  const writingBookSaveVersions = new Map();
const writingBooks = computed(() => ui.marketplace.writing.books ?? []);
const activeWritingBook = computed(
  () => writingBooks.value.find((book) => book.id === ui.marketplace.writing.activeBookId) ?? writingBooks.value[0] ?? null
);
const activeWritingTabMeta = computed(
  () => WRITING_APP_TABS.find((tab) => tab.id === ui.marketplace.writing.activeTab) ?? WRITING_APP_TABS[0]
);
const activeWritingLengthProfile = computed(
  () => WRITING_LENGTH_PROFILES[activeWritingBook.value?.length ?? "long"] ?? WRITING_LENGTH_PROFILES.long
);
const activeWritingIntroSections = computed(() => getWritingIntroSections(activeWritingBook.value));
const activeWritingChapters = computed(() => getWritingChapters(activeWritingBook.value));
const activeWritingDoneChapters = computed(() => getDoneWritingChapters(activeWritingBook.value));
const activeWritingDoneChapterCount = computed(() => activeWritingDoneChapters.value.length);
const activeWritingChapter = computed(
  () =>
    activeWritingChapters.value.find((chapter) => chapter.id === ui.marketplace.writing.activeChapterId) ??
    getPreferredWritingChapter(activeWritingBook.value) ??
    null
);
const activeWritingChapterIndex = computed(() =>
  Math.max(
    0,
    activeWritingChapters.value.findIndex((chapter) => chapter.id === activeWritingChapter.value?.id)
  )
);
const filteredWritingChapterEntries = computed(() =>
  getFilteredWritingChapterEntries(activeWritingChapters.value, ui.marketplace.writing.chapterSearchQuery)
);
const activeWritingTaskOptions = computed(() => WRITING_AI_TASKS[ui.marketplace.writing.activeTab] ?? WRITING_AI_TASKS.intro);
const activeWritingTask = computed(
  () =>
    activeWritingTaskOptions.value.find((task) => task.id === ui.marketplace.writing.aiTaskId) ??
    activeWritingTaskOptions.value[0] ??
    null
);
const activeWritingOutlinePlannerJob = computed(() => activeWritingBook.value?.outlinePlannerJob ?? null);
const isActiveWritingBookAiRunning = computed(
  () => ui.marketplace.writing.isAiRunning && ui.marketplace.writing.aiRunningBookId === activeWritingBook.value?.id
);
const activeWritingContent = computed({
  get: () => getWritingBookContent(activeWritingBook.value, ui.marketplace.writing.activeTab),
  set: (value) => {
    setWritingBookContent(activeWritingBook.value, ui.marketplace.writing.activeTab, value);
  }
});
const activeWritingExportFileName = computed(() =>
  getWritingExportFileName(activeWritingBook.value, ui.marketplace.writing.exportFormat)
);
const canExportActiveWritingBook = computed(
  () =>
    Boolean(
      activeWritingBook.value &&
        activeWritingDoneChapterCount.value > 0 &&
        String(ui.marketplace.writing.exportDirectory ?? "").trim() &&
        !ui.marketplace.writing.isExporting
    )
);

function getWritingLengthLabel(length) {
  return WRITING_LENGTH_PROFILES[length]?.label ?? WRITING_LENGTH_PROFILES.long.label;
}

function normalizeWritingBookLengthForUi(value) {
  return WRITING_LENGTH_PROFILES[value] ? value : "long";
}

function normalizeWritingChapterStatusForUi(value) {
  return WRITING_CHAPTER_STATUS_META[value] ? value : "todo";
}

function parseWritingChapterIndex(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));

  if (/^\d+$/.test(normalizedValue)) {
    const parsedValue = Number(normalizedValue);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  const digits = {
    零: 0,
    "〇": 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };
  const units = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
  let total = 0;
  let section = 0;
  let number = 0;

  for (const char of normalizedValue) {
    if (digits[char] !== undefined) {
      number = digits[char];
      continue;
    }

    const unit = units[char];

    if (!unit) {
      return null;
    }

    if (unit === 10000) {
      section = (section + (number || 1)) * unit;
      total += section;
      section = 0;
    } else {
      section += (number || 1) * unit;
    }

    number = 0;
  }

  const parsedValue = total + section + number;
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeWritingChapterIndex(value, fallbackIndex = 0) {
  const normalizedFallback = Number.isFinite(fallbackIndex) && fallbackIndex >= 0 ? fallbackIndex + 1 : 1;
  return parseWritingChapterIndex(value) ?? normalizedFallback;
}

function splitWritingChapterTitlePrefix(value) {
  const title = String(value ?? "")
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  const match = title.match(WRITING_CHAPTER_PREFIX_PATTERN);

  if (!match) {
    return { index: null, title };
  }

  return {
    index: parseWritingChapterIndex(match[1]),
    title: String(match[2] ?? "").trim()
  };
}

function normalizeWritingBookPartTypeForUi(value) {
  return value === "volume" ? "volume" : "act";
}

function splitWritingBookPartTitlePrefix(value) {
  const title = String(value ?? "")
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  const match = title.match(WRITING_PART_PREFIX_PATTERN);

  if (!match) {
    return { index: null, type: null, title };
  }

  return {
    index: parseWritingChapterIndex(match[1]),
    type: match[2] === "卷" ? "volume" : "act",
    title: String(match[3] ?? "").trim()
  };
}

function normalizeWritingBookPart(part, index = 0, bookId = "writing_book") {
  const titleParts = splitWritingBookPartTitlePrefix(part?.title);
  const partIndex = normalizeWritingChapterIndex(part?.index ?? titleParts.index, index);
  const partType = normalizeWritingBookPartTypeForUi(part?.type ?? titleParts.type);

  return {
    id: String(part?.id ?? "").trim() || `${bookId}_part_${partIndex}`,
    type: partType,
    index: partIndex,
    title: titleParts.title || `未命名${partType === "volume" ? "卷" : "幕"} ${partIndex}`,
    description: String(part?.description ?? part?.summary ?? "")
  };
}

function normalizeWritingBookPartsForUi(parts = [], bookId = "writing_book") {
  return (Array.isArray(parts) ? parts : [])
    .map((part, index) => normalizeWritingBookPart(part, index, bookId))
    .sort((left, right) => left.index - right.index);
}

function normalizePositiveInteger(value, fallbackValue = 1) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function normalizeWritingOutlinePlannerJobForUi(job) {
  if (!job || typeof job !== "object") {
    return undefined;
  }

  const minChaptersPerPart = normalizePositiveInteger(job.minChaptersPerPart, 80);
  const maxChaptersPerPart = Math.max(minChaptersPerPart, normalizePositiveInteger(job.maxChaptersPerPart, 100));
  const chaptersPerPart = Math.min(maxChaptersPerPart, Math.max(minChaptersPerPart, normalizePositiveInteger(job.chaptersPerPart, Math.round((minChaptersPerPart + maxChaptersPerPart) / 2))));
  const targetPartCount = normalizePositiveInteger(job.targetPartCount, 1);
  const batchSize = Math.min(40, Math.max(5, normalizePositiveInteger(job.batchSize, WRITING_LONG_OUTLINE_BATCH_SIZE)));

  return {
    id: String(job.id ?? "").trim() || createLocalId("writing_outline_job"),
    status: ["idle", "running", "completed", "failed", "cancelled"].includes(job.status) ? job.status : "idle",
    instruction: String(job.instruction ?? ""),
    targetPartCount,
    partType: normalizeWritingBookPartTypeForUi(job.partType),
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    batchSize,
    targetChapterCount: targetPartCount * chaptersPerPart,
    generatedChapterCount: Math.max(0, Number(job.generatedChapterCount ?? 0) || 0),
    currentPartIndex: Math.max(0, Number(job.currentPartIndex ?? 0) || 0),
    currentBatchStartIndex: Math.max(0, Number(job.currentBatchStartIndex ?? 0) || 0),
    currentBatchEndIndex: Math.max(0, Number(job.currentBatchEndIndex ?? 0) || 0),
    lastCompletedChapterIndex: Math.max(0, Number(job.lastCompletedChapterIndex ?? 0) || 0),
    retryAttempt: Math.max(0, Number(job.retryAttempt ?? 0) || 0),
    maxRetryAttempts: Math.max(0, Number(job.maxRetryAttempts ?? 0) || 0),
    ...(job.lastRetryAt ? { lastRetryAt: String(job.lastRetryAt) } : {}),
    ...(job.lastError ? { lastError: String(job.lastError) } : {}),
    createdAt: String(job.createdAt ?? new Date().toISOString()),
    updatedAt: String(job.updatedAt ?? new Date().toISOString()),
    ...(job.error ? { error: String(job.error) } : {})
  };
}

function normalizeWritingBookForUi(book, index = 0) {
  const now = new Date().toISOString();
  const bookId = String(book?.id ?? "").trim() || createLocalId("writing_book");
  const normalized = {
    id: bookId,
    title: String(book?.title ?? "").trim() || "未命名故事",
    author: String(book?.author ?? "Song"),
    length: normalizeWritingBookLengthForUi(book?.length),
    genre: String(book?.genre ?? "小说 / 待定类型"),
    status: String(book?.status ?? "新建"),
    updatedAt: String(book?.updatedAt ?? now),
    coverTone: String(book?.coverTone ?? (index % 3 === 0 ? "teal" : index % 3 === 1 ? "coral" : "gold")),
    intro: String(book?.intro ?? ""),
    outlineGuide: String(book?.outlineGuide ?? ""),
    seriesPlan: String(book?.seriesPlan ?? ""),
    directoryName: typeof book?.directoryName === "string" ? book.directoryName : undefined,
    parts: normalizeWritingBookPartsForUi(book?.parts, bookId),
    outlinePlannerJob: normalizeWritingOutlinePlannerJobForUi(book?.outlinePlannerJob),
    chapters: []
  };

  normalized.chapters = (Array.isArray(book?.chapters) ? book.chapters : []).map((chapter, chapterIndex) =>
    normalizeWritingChapter(
      {
        ...chapter,
        status: normalizeWritingChapterStatusForUi(chapter?.status)
      },
      chapterIndex,
      normalized
    )
  );

  return normalized;
}

function normalizeWritingBooksForUi(books = []) {
  return (Array.isArray(books) ? books : []).map((book, index) => normalizeWritingBookForUi(book, index));
}

function syncWritingBookSaveVersions(books = []) {
  const bookIds = new Set(books.map((book) => book.id));

  Array.from(writingBookSaveVersions.keys()).forEach((bookId) => {
    if (!bookIds.has(bookId)) {
      writingBookSaveVersions.delete(bookId);
    }
  });

  books.forEach((book) => {
    if (!writingBookSaveVersions.has(book.id)) {
      writingBookSaveVersions.set(book.id, 0);
    }
  });
}

function applyWritingBooksFromStorage(books = [], options = {}) {
  const normalizedBooks = normalizeWritingBooksForUi(books);
  const preferredBookId = options.preferBookId ?? ui.marketplace.writing.activeBookId;
  const preferredChapterId = options.preferChapterId ?? ui.marketplace.writing.activeChapterId;
  const nextBook = normalizedBooks.find((book) => book.id === preferredBookId) ?? normalizedBooks[0] ?? null;

  workbench.writingBooks = normalizedBooks;
  ui.marketplace.writing.books = normalizedBooks;
  syncWritingBookSaveVersions(normalizedBooks);
  ui.marketplace.writing.activeBookId = nextBook?.id ?? null;

  if (!nextBook) {
    ui.marketplace.writing.activeChapterId = "";
    if (ui.marketplace.view === "writingDetail") {
      ui.marketplace.view = "writingShelf";
    }
    return;
  }

  const chapters = getWritingChapters(nextBook);
  const nextChapter =
    chapters.find((chapter) => chapter.id === preferredChapterId) ?? getPreferredWritingChapter(nextBook) ?? chapters[0] ?? null;
  ui.marketplace.writing.activeChapterId = nextChapter?.id ?? "";
}

function clearWritingAutosaveTimer() {
  if (writingAutosaveTimer) {
    clearTimeout(writingAutosaveTimer);
    writingAutosaveTimer = null;
  }
}

function scheduleWritingBookAutosave(bookId) {
  if (!desktopApi?.saveWritingBook || !bookId) {
    return;
  }

  clearWritingAutosaveTimer();
  writingAutosaveTimer = setTimeout(() => {
    writingAutosaveTimer = null;
    persistWritingBookById(bookId, { silent: true });
  }, WRITING_AUTOSAVE_DELAY);
}

function touchWritingBook(book, options = {}) {
  if (!book) {
    return;
  }

  book.updatedAt = new Date().toISOString();

  if (book.id) {
    writingBookSaveVersions.set(book.id, (writingBookSaveVersions.get(book.id) ?? 0) + 1);
  }

  if (options.persist !== false) {
    scheduleWritingBookAutosave(book.id);
  }
}

function buildWritingBookSavePayload(book) {
  if (!book) {
    return null;
  }

  return toPlainIpcData(
    {
      ...book,
      chapters: getWritingChapters(book).map((chapter) => ({
        ...chapter,
        status: normalizeWritingChapterStatusForUi(chapter.status),
        content: String(chapter.content ?? "")
      }))
    },
    null
  );
}

async function persistWritingBookById(bookId, options = {}) {
  const targetBookId = String(bookId ?? "").trim();

  if (!desktopApi?.saveWritingBook || !targetBookId) {
    return;
  }

  if (writingSaveInFlight) {
    writingQueuedSave = {
      bookId: targetBookId,
      options: {
        ...(writingQueuedSave?.options ?? {}),
        ...options,
        mergeChapters: Boolean(writingQueuedSave?.options?.mergeChapters || options.mergeChapters),
        keepLocal: Boolean(writingQueuedSave?.options?.keepLocal || options.keepLocal),
        silent: Boolean((writingQueuedSave?.options?.silent ?? true) && (options.silent ?? true))
      }
    };
    return;
  }

  const book = writingBooks.value.find((entry) => entry.id === targetBookId);

  if (!book) {
    return;
  }

  const saveVersion = writingBookSaveVersions.get(targetBookId) ?? 0;
  const payload = buildWritingBookSavePayload(book);

  if (!payload) {
    return;
  }

  clearWritingAutosaveTimer();
  writingSaveInFlight = true;

  try {
    const savedBooks = await desktopApi.saveWritingBook(payload, options.mergeChapters ? { mergeChapters: true } : {});

    if (options.keepLocal && (writingBookSaveVersions.get(targetBookId) ?? 0) === saveVersion) {
      const savedBook = normalizeWritingBooksForUi(savedBooks).find((entry) => entry.id === targetBookId);

      if (savedBook) {
        Object.assign(book, savedBook);
        writingBookSaveVersions.set(targetBookId, 0);
      }
    } else if ((writingBookSaveVersions.get(targetBookId) ?? 0) === saveVersion) {
      applyWritingBooksFromStorage(savedBooks, {
        preferBookId: targetBookId,
        preferChapterId: ui.marketplace.writing.activeChapterId
      });
    }

    if (!options.silent) {
      setStatus("小说已保存到本地书稿目录。", "success");
    }
  } catch (error) {
    console.error("Failed to save writing book", error);
    setStatus(`小说保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    writingSaveInFlight = false;

    const queuedSave = writingQueuedSave;
    writingQueuedSave = null;

    if (queuedSave) {
      persistWritingBookById(queuedSave.bookId, queuedSave.options);
    }
  }
}

function setWritingBookTitle(value) {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  book.title = String(value ?? "");
  touchWritingBook(book);
}

function setWritingBookLength(value) {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  book.length = normalizeWritingBookLengthForUi(value);
  touchWritingBook(book);
}

function setWritingBookGenre(value) {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  book.genre = String(value ?? "");
  touchWritingBook(book);
}

function getWritingIntroSections(book) {
  if (book?.length === "long") {
    return [
      WRITING_INTRO_SECTION_DEFINITIONS.intro,
      WRITING_INTRO_SECTION_DEFINITIONS.outlineGuide,
      WRITING_INTRO_SECTION_DEFINITIONS.seriesPlan
    ];
  }

  if (book?.length === "medium") {
    return [WRITING_INTRO_SECTION_DEFINITIONS.intro, WRITING_INTRO_SECTION_DEFINITIONS.outlineGuide];
  }

  return [WRITING_INTRO_SECTION_DEFINITIONS.intro];
}

function getWritingIntroFieldValue(book, key) {
  return String(book?.[key] ?? "");
}

function setWritingIntroField(book, key, value) {
  if (!book || !WRITING_INTRO_SECTION_DEFINITIONS[key]) {
    return;
  }

  book[key] = String(value ?? "");
  touchWritingBook(book);
}

function buildWritingIntroContent(book) {
  if (!book) {
    return "";
  }

  return getWritingIntroSections(book)
    .map((section) => {
      const value = getWritingIntroFieldValue(book, section.key).trim();
      return value ? `【${section.label}】\n${value}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function getWritingChapters(book) {
  if (!book) {
    return [];
  }

  if (!Array.isArray(book.chapters) || book.chapters.length === 0) {
    book.chapters = createWritingChaptersFromLegacyBook(book);
  }

  return book.chapters.map((chapter, index) => normalizeWritingChapter(chapter, index, book));
}

function createWritingChaptersFromLegacyBook(book) {
  const outlineLines = String(book?.outline ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^(\d+[.、]|第.+?章)/.test(line));
  const sourceLines = outlineLines.length ? outlineLines : ["第一章：正文整理"];
  const legacyContent = String(book?.chapter ?? "");

  return sourceLines.map((line, index) => {
    const normalizedLine = line.replace(/^\d+[.、]\s*/, "").replace(/^第.+?章[:：]?\s*/, "");
    const [rawTitle, ...summaryParts] = normalizedLine.split(/[:：]/);

    return {
      id: `${book.id || "writing_book"}_chapter_${index + 1}`,
      index: index + 1,
      title: (rawTitle || `未命名章节 ${index + 1}`).trim(),
      summary: summaryParts.join("：").trim(),
      content: index === 0 ? legacyContent : "",
      status: index === 0 && legacyContent.trim() ? "inProgress" : "todo",
      updatedAt: book.updatedAt ?? new Date().toISOString()
    };
  });
}

function normalizeWritingChapter(chapter, index, book) {
  const normalized = chapter ?? {};
  const titleParts = splitWritingChapterTitlePrefix(normalized.title);

  if (!normalized.id) {
    normalized.id = `${book?.id || "writing_book"}_chapter_${index + 1}`;
  }

  normalized.index = normalizeWritingChapterIndex(normalized.index ?? titleParts.index, index);
  if (normalized.partIndex) {
    normalized.partIndex = normalizeWritingChapterIndex(normalized.partIndex, 0);
  } else {
    delete normalized.partIndex;
  }
  normalized.title = titleParts.title || `未命名章节 ${normalized.index}`;

  normalized.summary = String(normalized.summary ?? "");
  normalized.content = String(normalized.content ?? "");
  normalized.status = WRITING_CHAPTER_STATUS_META[normalized.status] ? normalized.status : "todo";
  normalized.updatedAt = normalized.updatedAt ?? book?.updatedAt ?? new Date().toISOString();

  return normalized;
}

function getPreferredWritingChapter(book) {
  const chapters = getWritingChapters(book);

  if (!chapters.length) {
    return null;
  }

  const inProgressChapters = chapters
    .filter((chapter) => chapter.status === "inProgress")
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime());

  return inProgressChapters[0] ?? chapters.find((chapter) => chapter.status === "todo") ?? chapters[chapters.length - 1];
}

function ensureWritingChapterSelection(book = activeWritingBook.value) {
  const chapters = getWritingChapters(book);
  const current = chapters.find((chapter) => chapter.id === ui.marketplace.writing.activeChapterId);

  if (current) {
    return current;
  }

  const preferred = getPreferredWritingChapter(book);
  ui.marketplace.writing.activeChapterId = preferred?.id ?? "";
  return preferred;
}

function selectPreferredWritingChapter(book = activeWritingBook.value) {
  const preferred = getPreferredWritingChapter(book);
  selectWritingChapter(preferred?.id ?? "");
  return preferred;
}

function selectWritingChapter(chapterId) {
  ui.marketplace.writing.activeChapterId = chapterId;
  clearWritingChapterSubmitConfirmation(chapterId);
}

function setWritingChapterPickerOpen(isOpen) {
  ui.marketplace.writing.isChapterPickerOpen = Boolean(isOpen);

  if (ui.marketplace.writing.isChapterPickerOpen) {
    scrollWritingChapterPickerToActive();
  }
}

function toggleWritingChapterPicker() {
  setWritingChapterPickerOpen(!ui.marketplace.writing.isChapterPickerOpen);
}

function selectWritingChapterFromPicker(chapterId) {
  selectWritingChapter(chapterId);
  ui.marketplace.writing.chapterSearchQuery = "";
  setWritingChapterPickerOpen(false);
}

async function scrollWritingChapterPickerToActive() {
  await nextTick();

  const menu = writingChapterDropdownMenuRef.value;
  const activeItem = menu?.querySelector?.(".writing-chapter-dropdown-item.is-active");

  if (!menu || !activeItem) {
    return;
  }

  const targetTop = activeItem.offsetTop - (menu.clientHeight - activeItem.clientHeight) / 2;
  menu.scrollTop = Math.max(0, targetTop);
}

function getWritingChapterDisplayTitle(chapter, index = 0) {
  const order = normalizeWritingChapterIndex(chapter?.index, index);
  const title = splitWritingChapterTitlePrefix(chapter?.title).title || `未命名章节 ${order}`;
  return `第${order}章 ${title}`;
}

function getWritingBookParts(book) {
  if (!book) {
    return [];
  }

  return (Array.isArray(book.parts) ? book.parts : [])
    .slice()
    .sort((left, right) => normalizeWritingChapterIndex(left?.index, 0) - normalizeWritingChapterIndex(right?.index, 0));
}

function getWritingPartDisplayLabel(part) {
  if (!part) {
    return "";
  }

  const label = part.type === "volume" ? "卷" : "幕";
  const title = splitWritingBookPartTitlePrefix(part.title).title || `未命名${label} ${part.index}`;
  return `第${part.index}${label} ${title}`;
}

function getWritingChapterPart(book, chapter) {
  const partIndex = parseWritingChapterIndex(chapter?.partIndex);

  if (!partIndex) {
    return null;
  }

  return getWritingBookParts(book).find((part) => part.index === partIndex) ?? null;
}

function getWritingChapterPartLabel(book, chapter) {
  return getWritingPartDisplayLabel(getWritingChapterPart(book, chapter));
}

function getFilteredWritingChapterEntries(chapters, query) {
  const keyword = String(query ?? "").trim().toLowerCase();

  return (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => ({
      chapter,
      index,
      title: getWritingChapterDisplayTitle(chapter, index)
    }))
    .filter((entry) => {
      if (!keyword) {
        return true;
      }

      return [entry.title, entry.chapter?.summary, getWritingChapterStatusLabel(entry.chapter?.status)]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(keyword));
    });
}

function getWritingChapterStatusLabel(status) {
  return WRITING_CHAPTER_STATUS_META[status]?.label ?? WRITING_CHAPTER_STATUS_META.todo.label;
}

function getWritingChapterStatusClass(status) {
  return WRITING_CHAPTER_STATUS_META[status]?.className ?? WRITING_CHAPTER_STATUS_META.todo.className;
}

function getWritingChapterWordCount(chapter) {
  return String(chapter?.content ?? "").replace(/\s+/g, "").length;
}

function isWritingChapterSubmitConfirmed(chapter) {
  return Boolean(
    chapter?.id &&
      ui.marketplace.writing.submittedChapterId === chapter.id &&
      String(chapter.content ?? "") === ui.marketplace.writing.submittedChapterContentSnapshot
  );
}

function clearWritingChapterSubmitConfirmation(chapterId = "") {
  if (!chapterId || ui.marketplace.writing.submittedChapterId === chapterId) {
    ui.marketplace.writing.submittedChapterId = "";
    ui.marketplace.writing.submittedChapterContentSnapshot = "";
  }
}

function normalizeWritingExportFormat(format) {
  const normalized = String(format ?? "").trim().toLowerCase();
  return WRITING_BOOK_EXPORT_FORMATS.some((entry) => entry.id === normalized) ? normalized : "txt";
}

function sanitizeWritingExportTitle(value) {
  return String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim() || "未命名书稿";
}

function getWritingExportFileName(book, format) {
  return `${sanitizeWritingExportTitle(book?.title)}.${normalizeWritingExportFormat(format)}`;
}

function getDoneWritingChapters(book) {
  return getWritingChapters(book)
    .filter((chapter) => chapter.status === "done" && String(chapter.content ?? "").trim())
    .sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0));
}

function getWritingExportPartHeading(book, chapter) {
  const part = getWritingChapterPart(book, chapter);

  if (part) {
    return getWritingPartDisplayLabel(part);
  }

  const partIndex = parseWritingChapterIndex(chapter?.partIndex);
  return partIndex ? `第${partIndex}幕` : "";
}

function normalizeWritingChapterDraftOutput(value) {
  const text = String(value ?? "")
    .replace(/^\s*```(?:markdown|md|text)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  if (!text.trim()) {
    return "";
  }

  const lines = text.split(/\r?\n/);

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  const firstLine = String(lines[0] ?? "").trim().replace(/^#+\s*/, "").trim();

  if (WRITING_CHAPTER_PREFIX_PATTERN.test(firstLine)) {
    lines.shift();
  }

  return lines.join("\n").replace(/^(?:\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
}

function trimWritingExportTextBlock(value) {
  return String(value ?? "").replace(/^(?:[ \t]*\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
}

function buildWritingBookExportContent(book) {
  const chapters = getDoneWritingChapters(book);
  const allChapters = getWritingChapters(book);
  const lines = [`《${sanitizeWritingExportTitle(book?.title)}》`, ""];
  const intro = trimWritingExportTextBlock(book?.intro ?? "");
  let previousPartHeading = "";

  if (intro) {
    lines.push(intro, "");
  }

  chapters.forEach((chapter) => {
    const partHeading = getWritingExportPartHeading(book, chapter);

    if (partHeading && partHeading !== previousPartHeading) {
      lines.push(partHeading, "");
      previousPartHeading = partHeading;
    }

    const chapterIndex = allChapters.findIndex((entry) => entry.id === chapter.id);
    lines.push(getWritingChapterDisplayTitle(chapter, chapterIndex >= 0 ? chapterIndex : 0), "");
    lines.push(trimWritingExportTextBlock(chapter.content ?? ""), "");
  });

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function setWritingExportFeedback(text, tone = "neutral") {
  ui.marketplace.writing.exportFeedback = String(text ?? "").trim();
  ui.marketplace.writing.exportFeedbackTone = tone;
}

function openWritingExportDialog() {
  if (!activeWritingBook.value) {
    return;
  }

  ui.marketplace.writing.exportFormat = normalizeWritingExportFormat(ui.marketplace.writing.exportFormat);
  ui.marketplace.writing.isExportDialogOpen = true;
  setWritingExportFeedback(
    activeWritingDoneChapterCount.value > 0 ? "" : "当前还没有已完成且有正文的章节，暂时不能导出书稿文件。",
    activeWritingDoneChapterCount.value > 0 ? "neutral" : "warning"
  );
}

function closeWritingExportDialog() {
  if (ui.marketplace.writing.isExporting) {
    return;
  }

  ui.marketplace.writing.isExportDialogOpen = false;
  setWritingExportFeedback("", "neutral");
}

function setWritingExportFormat(format) {
  ui.marketplace.writing.exportFormat = normalizeWritingExportFormat(format);
}

async function selectWritingExportDirectory() {
  if (!desktopApi?.selectWritingBookExportDirectory) {
    setWritingExportFeedback("当前桌面桥接暂不支持选择输出目录。", "danger");
    return;
  }

  try {
    const directoryPath = await desktopApi.selectWritingBookExportDirectory();

    if (directoryPath) {
      ui.marketplace.writing.exportDirectory = directoryPath;
      setWritingExportFeedback("", "neutral");
    }
  } catch (error) {
    console.error("Failed to select writing export directory", error);
    setWritingExportFeedback(`选择目录失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function exportActiveWritingBook() {
  const book = activeWritingBook.value;

  if (!book || ui.marketplace.writing.isExporting) {
    return;
  }

  if (!activeWritingDoneChapterCount.value) {
    setWritingExportFeedback("当前还没有已完成且有正文的章节，暂时不能导出书稿文件。", "warning");
    return;
  }

  if (!String(ui.marketplace.writing.exportDirectory ?? "").trim()) {
    setWritingExportFeedback("请先选择输出目录。", "warning");
    return;
  }

  if (!desktopApi?.exportWritingBook) {
    setWritingExportFeedback("当前桌面桥接暂不支持导出书稿。", "danger");
    return;
  }

  try {
    ui.marketplace.writing.isExporting = true;
    setWritingExportFeedback("正在保存书稿文件...", "neutral");
    const format = normalizeWritingExportFormat(ui.marketplace.writing.exportFormat);
    const result = await desktopApi.exportWritingBook({
      directoryPath: ui.marketplace.writing.exportDirectory,
      fileName: getWritingExportFileName(book, format),
      format,
      content: buildWritingBookExportContent(book)
    });
    ui.marketplace.writing.isExportDialogOpen = false;
    setWritingExportFeedback("", "neutral");
    setStatus(`已导出书稿文件：${result.fileName ?? activeWritingExportFileName.value}`, "success");
  } catch (error) {
    console.error("Failed to export writing book", error);
    setWritingExportFeedback(`导出失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    ui.marketplace.writing.isExporting = false;
  }
}

function buildWritingOutlineContent(book) {
  const partsContent = getWritingBookParts(book)
    .map((part) => `partIndex：${part.index}\npartType：${part.type}\npartTitle：${part.title}\npartDescription：${part.description || "暂无描述"}`)
    .join("\n\n");
  const chaptersContent = getWritingChapters(book)
    .map((chapter, index) => {
      const order = normalizeWritingChapterIndex(chapter.index, index);
      const title = splitWritingChapterTitlePrefix(chapter.title).title || `未命名章节 ${order}`;
      const summary = String(chapter.summary ?? "").trim() || "暂无简介";
      const partLine = chapter.partIndex ? `partIndex：${chapter.partIndex}\n` : "";
      return `${partLine}index：${order}\ntitle：${title}\n状态：${getWritingChapterStatusLabel(chapter.status)}\n简介：${summary}`;
    })
    .join("\n\n");

  return [partsContent ? `【幕/卷设计】\n${partsContent}` : "", chaptersContent ? `【章节目录】\n${chaptersContent}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function setWritingChapterTitle(chapter, value) {
  if (!chapter || !activeWritingBook.value) {
    return;
  }

  const titleParts = splitWritingChapterTitlePrefix(value);
  chapter.index = normalizeWritingChapterIndex(titleParts.index ?? chapter.index, getWritingChapters(activeWritingBook.value).indexOf(chapter));
  chapter.title = titleParts.title;
  chapter.updatedAt = new Date().toISOString();
  touchWritingBook(activeWritingBook.value);
}

function setWritingChapterSummary(chapter, value) {
  if (!chapter || !activeWritingBook.value) {
    return;
  }

  chapter.summary = String(value ?? "");
  chapter.updatedAt = new Date().toISOString();
  touchWritingBook(activeWritingBook.value);
}

function setWritingChapterContent(chapter, value) {
  if (!chapter || !activeWritingBook.value) {
    return;
  }

  chapter.content = String(value ?? "");
  chapter.updatedAt = new Date().toISOString();

  if (
    ui.marketplace.writing.submittedChapterId === chapter.id &&
    chapter.content !== ui.marketplace.writing.submittedChapterContentSnapshot
  ) {
    clearWritingChapterSubmitConfirmation(chapter.id);
  }

  if (chapter.status === "todo" && chapter.content.trim()) {
    chapter.status = "inProgress";
  }

  touchWritingBook(activeWritingBook.value);
}

function createWritingChapter() {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  const chapters = getWritingChapters(book);
  const nextIndex = chapters.length + 1;
  const chapter = {
    id: createLocalId("writing_chapter"),
    index: nextIndex,
    title: `未命名章节 ${nextIndex}`,
    summary: "",
    content: "",
    status: "todo",
    updatedAt: new Date().toISOString()
  };

  book.chapters = [...chapters, chapter];
  selectWritingChapter(chapter.id);
  touchWritingBook(book);
  setStatus("已新增一个章节。", "success");
}

function goWritingChapter(chapterId) {
  selectWritingChapter(chapterId);
  ui.marketplace.writing.activeTab = "chapter";
  ui.marketplace.writing.aiTaskId = WRITING_AI_TASKS.chapter[0].id;
  ui.marketplace.writing.aiOutput = "";
  ui.marketplace.writing.chapterSearchQuery = "";
  setWritingChapterPickerOpen(false);
  setWritingFeedback("", "neutral");
}

function submitWritingChapter() {
  const chapter = activeWritingChapter.value;

  if (!chapter || !activeWritingBook.value) {
    return;
  }

  if (!String(chapter.content ?? "").trim()) {
    setWritingFeedback("章节正文为空，暂时不能提交。", "warning");
    return;
  }

  chapter.status = "done";
  chapter.updatedAt = new Date().toISOString();
  ui.marketplace.writing.submittedChapterId = chapter.id;
  ui.marketplace.writing.submittedChapterContentSnapshot = String(chapter.content ?? "");
  touchWritingBook(activeWritingBook.value);
  setWritingFeedback(`「${chapter.title || "当前章节"}」已标记完成。`, "success");
  setStatus(`章节「${chapter.title || "当前章节"}」已完成。`, "success");
}

function getWritingBookContent(book, tabId) {
  if (!book) {
    return "";
  }

  if (tabId === "outline") {
    return buildWritingOutlineContent(book);
  }

  if (tabId === "chapter") {
    return activeWritingChapter.value?.content ?? getPreferredWritingChapter(book)?.content ?? "";
  }

  return buildWritingIntroContent(book);
}

function setWritingBookContent(book, tabId, value) {
  if (!book) {
    return;
  }

  const content = String(value ?? "");

  if (tabId === "outline") {
    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    if (chapter) {
      setWritingChapterSummary(chapter, content);
    }
  } else if (tabId === "chapter") {
    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    if (chapter) {
      setWritingChapterContent(chapter, content);
    }
  } else {
    book.intro = content;
    touchWritingBook(book);
  }
}

function getWritingBookWordCount(book) {
  const chapterText = getWritingChapters(book)
    .map((chapter) => `${chapter.summary ?? ""}\n${chapter.content ?? ""}`)
    .join("\n");

  return [book?.intro, book?.outlineGuide, book?.seriesPlan, chapterText]
    .map((value) => String(value ?? "").replace(/\s+/g, ""))
    .join("").length;
}

function getWritingTabWordCount(tabId = ui.marketplace.writing.activeTab) {
  return String(getWritingBookContent(activeWritingBook.value, tabId) ?? "").replace(/\s+/g, "").length;
}

function getWritingTabTitle(tabId) {
  return WRITING_APP_TABS.find((tab) => tab.id === tabId)?.label ?? "写作";
}

function formatWritingBookUpdatedAt(value) {
  if (!value) {
    return "刚刚";
  }

  try {
    return formatLocalDateTime(value);
  } catch {
    return String(value);
  }
}

function getWritingBookCompleteness(book) {
  if (!book) {
    return 0;
  }

  const introSections = getWritingIntroSections(book);
  const filledIntroCount = introSections.filter((section) => getWritingIntroFieldValue(book, section.key).trim()).length;
  const introScore = introSections.length ? filledIntroCount / introSections.length : 0;
  const chapters = getWritingChapters(book);
  const chapterScore = chapters.length ? chapters.filter((chapter) => chapter.status === "done").length / chapters.length : 0;
  return Math.round((introScore * 0.4 + chapterScore * 0.6) * 100);
}

function setWritingFeedback(text, tone = "neutral") {
  ui.marketplace.writing.aiFeedback = String(text ?? "").trim();
  ui.marketplace.writing.aiFeedbackTone = tone;
}

function getWritingAiFeedbackClass() {
  if (ui.marketplace.writing.isAiRunning) {
    return "is-running";
  }

  if (ui.marketplace.writing.aiFeedbackTone === "success") {
    return "is-success";
  }

  if (ui.marketplace.writing.aiFeedbackTone === "warning") {
    return "is-warning";
  }

  if (ui.marketplace.writing.aiFeedbackTone === "danger") {
    return "is-danger";
  }

  return "";
}

function toggleWritingProfileRail() {
  if (isActiveWritingBookAiRunning.value) {
    return;
  }

  ui.marketplace.writing.isProfileCollapsed = !ui.marketplace.writing.isProfileCollapsed;
}

function setWritingAiDrawerOpen(isOpen) {
  if (isActiveWritingBookAiRunning.value) {
    return;
  }

  ui.marketplace.writing.isAiDrawerOpen = Boolean(isOpen);
  if (!ui.marketplace.writing.isAiDrawerOpen) {
    setWritingAiTaskPickerOpen(false);
    ui.marketplace.writing.isPromptPreviewOpen = false;
  }
}

function setWritingAiTaskPickerOpen(isOpen) {
  ui.marketplace.writing.isAiTaskPickerOpen = Boolean(isOpen);
}

function toggleWritingAiTaskPicker() {
  setWritingAiTaskPickerOpen(!ui.marketplace.writing.isAiTaskPickerOpen);
}

function selectWritingAiTask(taskId) {
  ui.marketplace.writing.aiTaskId = taskId;
  setWritingAiTaskPickerOpen(false);
}

function toggleWritingPromptPreview() {
  ui.marketplace.writing.isPromptPreviewOpen = !ui.marketplace.writing.isPromptPreviewOpen;
}

function openWritingAppShelf() {
  writeRef(activeFeature, featureMarketplaceId);
  ui.marketplace.view = "writingShelf";
  if (!ui.marketplace.writing.activeBookId && writingBooks.value.length) {
    ui.marketplace.writing.activeBookId = writingBooks.value[0].id;
  }
}

function backWritingMarketplace() {
  ui.marketplace.view = "apps";
  ui.marketplace.writing.aiOutput = "";
  setWritingFeedback("", "neutral");
}

async function deleteWritingBookFromShelf(bookId) {
  if (!desktopApi?.deleteWritingBook) {
    setStatus("书稿仓储未就绪，暂时无法删除。", "danger");
    return;
  }

  const book = writingBooks.value.find((entry) => entry.id === bookId) ?? null;
  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除书籍",
    message: `确认删除「${book?.title ?? "当前书籍"}」吗？书稿目录会移入系统回收站。`,
    detail: "删除后会从书架移除，可在系统回收站中恢复本地书稿目录。",
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  clearWritingAutosaveTimer();

  if (writingQueuedSave?.bookId === bookId) {
    writingQueuedSave = null;
  }

  try {
    const savedBooks = await desktopApi.deleteWritingBook(bookId);
    applyWritingBooksFromStorage(savedBooks, {
      preferBookId: ui.marketplace.writing.activeBookId === bookId ? "" : ui.marketplace.writing.activeBookId
    });
    setStatus("书籍已移入系统回收站。", "success");
  } catch (error) {
    console.error("Failed to delete writing book", error);
    setStatus(`书籍删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function openWritingBook(bookId) {
  ui.marketplace.writing.activeBookId = bookId;
  selectPreferredWritingChapter(writingBooks.value.find((book) => book.id === bookId) ?? null);
  ui.marketplace.writing.activeTab = "intro";
  ui.marketplace.writing.aiTaskId = WRITING_AI_TASKS.intro[0].id;
  ui.marketplace.writing.aiOutput = "";
  ui.marketplace.writing.isAiDrawerOpen = false;
  ui.marketplace.writing.isPromptPreviewOpen = false;
  setWritingFeedback("", "neutral");
  ui.marketplace.view = "writingDetail";
}

function backWritingShelf() {
  ui.marketplace.view = "writingShelf";
  ui.marketplace.writing.aiOutput = "";
  setWritingFeedback("", "neutral");
}

async function createWritingBook() {
  const now = new Date().toISOString();
  const book = {
    id: createLocalId("writing_book"),
    title: `未命名故事 ${writingBooks.value.length + 1}`,
    author: "Song",
    length: "medium",
    genre: "小说 / 待定类型",
    status: "新建",
    updatedAt: now,
    coverTone: writingBooks.value.length % 2 === 0 ? "gold" : "teal",
    intro: "在这里写下故事的核心命题、世界观、人物关系和主要矛盾。",
    outlineGuide: "把故事拆成开始、失控、反转和收束四个阶段，每个阶段都要写清冲突升级和人物变化。",
    seriesPlan: "",
    parts: [],
    chapters: [
      {
        id: createLocalId("writing_chapter"),
        index: 1,
        title: "开场章节",
        summary: "写下本章冲突、信息增量、人物变化和结尾钩子。",
        content: "## 第一章\n\n",
        status: "inProgress",
        updatedAt: now
      }
    ]
  };

  ui.marketplace.writing.books = [book, ...writingBooks.value];
  workbench.writingBooks = ui.marketplace.writing.books;
  writingBookSaveVersions.set(book.id, 0);
  openWritingBook(book.id);
  setStatus("已创建一本新书，正在写入本地书稿目录。", "success");
  await persistWritingBookById(book.id, { silent: false });
}

async function handleWritingBookUpload(event) {
  const file = event.target?.files?.[0] ?? null;

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const title = file.name.replace(/\.[^.]+$/, "").trim() || "上传书稿";
    const book = {
      id: createLocalId("writing_book_upload"),
      title,
      author: "Song",
      length: "long",
      genre: "上传书稿",
      status: "导入",
      updatedAt: new Date().toISOString(),
      coverTone: "ink",
      intro: `从「${file.name}」导入。建议先让 AI 帮你整理故事简介、人物关系和世界观。`,
      outlineGuide: "待整理目录。可以在目录 Tab 里使用「章节规划」生成结构。",
      seriesPlan: "",
      chapters: [
        {
          id: createLocalId("writing_chapter_upload"),
          title: "导入正文",
          summary: "从上传书稿中导入的初始正文，可继续拆分和整理。",
          content: text.slice(0, 16000),
          status: text.trim() ? "inProgress" : "todo",
          updatedAt: new Date().toISOString()
        }
      ]
    };

    ui.marketplace.writing.books = [book, ...writingBooks.value];
    workbench.writingBooks = ui.marketplace.writing.books;
    writingBookSaveVersions.set(book.id, 0);
    ui.marketplace.writing.uploadFeedback = `已导入 ${file.name}`;
    openWritingBook(book.id);
    setStatus(`已导入「${title}」，正在写入本地书稿目录。`, "success");
    await persistWritingBookById(book.id, { silent: false });
  } catch (error) {
    console.error("Failed to upload writing book", error);
    ui.marketplace.writing.uploadFeedback = "导入失败";
    setStatus(`导入书稿失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    event.target.value = "";
  }
}

function setWritingTab(tabId) {
  if (tabId === "chapter") {
    selectPreferredWritingChapter(activeWritingBook.value);
  } else {
    ensureWritingChapterSelection(activeWritingBook.value);
    setWritingChapterPickerOpen(false);
  }

  if (ui.marketplace.writing.activeTab === tabId) {
    return;
  }

  ui.marketplace.writing.activeTab = tabId;
  ui.marketplace.writing.aiTaskId = (WRITING_AI_TASKS[tabId] ?? WRITING_AI_TASKS.intro)[0]?.id ?? "";
  ui.marketplace.writing.aiOutput = "";
  setWritingAiTaskPickerOpen(false);
  setWritingFeedback("", "neutral");
}

  return {
    activeWritingBook,
    activeWritingChapter,
    activeWritingChapterIndex,
    activeWritingChapters,
    activeWritingContent,
    activeWritingDoneChapterCount,
    activeWritingDoneChapters,
    activeWritingExportFileName,
    activeWritingIntroSections,
    activeWritingLengthProfile,
    activeWritingOutlinePlannerJob,
    activeWritingTabMeta,
    activeWritingTask,
    activeWritingTaskOptions,
    applyWritingBooksFromStorage,
    backWritingMarketplace,
    backWritingShelf,
    buildWritingBookExportContent,
    buildWritingIntroContent,
    buildWritingOutlineContent,
    canExportActiveWritingBook,
    clearWritingAutosaveTimer,
    clearWritingChapterSubmitConfirmation,
    closeWritingExportDialog,
    createWritingBook,
    createWritingChapter,
    deleteWritingBookFromShelf,
    ensureWritingChapterSelection,
    exportActiveWritingBook,
    filteredWritingChapterEntries,
    formatWritingBookUpdatedAt,
    getDoneWritingChapters,
    getPreferredWritingChapter,
    getWritingAiFeedbackClass,
    getWritingBookCompleteness,
    getWritingBookContent,
    getWritingBookParts,
    getWritingBookWordCount,
    getWritingChapterDisplayTitle,
    getWritingChapterPart,
    getWritingChapterPartLabel,
    getWritingChapterStatusClass,
    getWritingChapterStatusLabel,
    getWritingChapterWordCount,
    getWritingChapters,
    getWritingExportFileName,
    getWritingIntroFieldValue,
    getWritingIntroSections,
    getWritingLengthLabel,
    getWritingPartDisplayLabel,
    getWritingTabTitle,
    getWritingTabWordCount,
    goWritingChapter,
    handleWritingBookUpload,
    isActiveWritingBookAiRunning,
    isWritingChapterSubmitConfirmed,
    normalizePositiveInteger,
    normalizeWritingBookForUi,
    normalizeWritingBookLengthForUi,
    normalizeWritingBookPart,
    normalizeWritingBookPartsForUi,
    normalizeWritingBookPartTypeForUi,
    normalizeWritingChapterDraftOutput,
    normalizeWritingChapterIndex,
    normalizeWritingChapterStatusForUi,
    normalizeWritingExportFormat,
    normalizeWritingOutlinePlannerJobForUi,
    openWritingAppShelf,
    openWritingBook,
    openWritingExportDialog,
    parseWritingChapterIndex,
    persistWritingBookById,
    selectPreferredWritingChapter,
    selectWritingChapter,
    selectWritingChapterFromPicker,
    selectWritingExportDirectory,
    selectWritingAiTask,
    setWritingAiDrawerOpen,
    setWritingAiTaskPickerOpen,
    setWritingBookContent,
    setWritingBookGenre,
    setWritingBookLength,
    setWritingBookTitle,
    setWritingChapterContent,
    setWritingChapterPickerOpen,
    setWritingChapterSummary,
    setWritingChapterTitle,
    setWritingExportFormat,
    setWritingFeedback,
    setWritingIntroField,
    setWritingTab,
    splitWritingBookPartTitlePrefix,
    splitWritingChapterTitlePrefix,
    submitWritingChapter,
    syncWritingBookSaveVersions,
    toggleWritingAiTaskPicker,
    toggleWritingChapterPicker,
    toggleWritingProfileRail,
    toggleWritingPromptPreview,
    touchWritingBook,
    writingBooks
  };
}
