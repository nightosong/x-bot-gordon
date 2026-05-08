import { computed } from "vue";

import {
  WRITING_AI_TASKS,
  WRITING_APP_NAME,
  WRITING_CHAPTER_MAX_OUTPUT_TOKENS,
  WRITING_LENGTH_PROFILES,
  WRITING_LONG_OUTLINE_BATCH_MAX_TOKENS,
  WRITING_LONG_OUTLINE_BATCH_SIZE,
  WRITING_LONG_OUTLINE_MASTER_MAX_TOKENS,
  WRITING_MODEL_MAX_RETRY_ATTEMPTS,
  WRITING_MODEL_RETRY_BASE_DELAY_MS,
  WRITING_MODEL_RETRY_MAX_DELAY_MS,
  WRITING_OUTLINE_EXPANSION_PATTERN,
  WRITING_OUTLINE_REWRITE_PATTERN
} from "./writingConfig.js";
import {
  buildWritingAssistantPrompt as buildWritingAssistantPromptFromAssets,
  buildWritingLongOutlineBatchPrompt as buildWritingLongOutlineBatchPromptFromAssets,
  buildWritingLongOutlineMasterPrompt as buildWritingLongOutlineMasterPromptFromAssets,
  getWritingTaskPromptSpec as getWritingTaskPromptSpecFromAssets
} from "./writingPromptBuilder.js";

export function createWritingAiActions({
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingLengthProfile,
  activeWritingOutlinePlannerJob,
  activeWritingTask,
  buildWritingIntroContent,
  buildWritingOutlineContent,
  createLocalId,
  desktopApi,
  ensureWritingChapterSelection,
  getWritingBookContent,
  getWritingBookParts,
  getWritingChapterDisplayTitle,
  getWritingChapterPart,
  getWritingChapterPartLabel,
  getWritingChapters,
  getWritingIntroFieldValue,
  normalizePositiveInteger,
  normalizeWritingChapterDraftOutput,
  normalizeWritingChapterIndex,
  normalizeWritingOutlinePlannerJobForUi,
  parseWritingChapterIndex,
  persistWritingBookById,
  selectWritingChapter,
  setStatus,
  setWritingChapterContent,
  setWritingChapterSummary,
  setWritingFeedback,
  setWritingIntroField,
  splitWritingBookPartTitlePrefix,
  splitWritingChapterTitlePrefix,
  touchWritingBook,
  ui,
  writingPromptAssets
}) {
  let activeWritingModelRequestId = "";

  const activeWritingLongOutlineRequest = computed(() =>
    getWritingLongOutlineRequest({
      book: activeWritingBook.value,
      tabId: ui.marketplace.writing.activeTab,
      task: activeWritingTask.value,
      instruction: ui.marketplace.writing.aiInstruction
    })
  );
  const activeWritingPromptPreview = computed(() =>
    buildWritingAssistantPrompt({
      book: activeWritingBook.value,
      tabId: ui.marketplace.writing.activeTab,
      task: activeWritingTask.value,
      instruction: ui.marketplace.writing.aiInstruction
    })
  );
function getWritingTaskPromptSpec(tabId, taskId) {
  return getWritingTaskPromptSpecFromAssets(
    writingPromptAssets,
    tabId,
    taskId,
    WRITING_AI_TASKS[tabId] ?? WRITING_AI_TASKS.intro
  );
}

function parseWritingInstructionPartCount(instruction) {
  const match = String(instruction ?? "").match(
    /(?:分(?:为|成)|拆(?:为|成)|规划(?:为|成)|设计(?:为|成))?\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(幕|卷|部)/
  );

  if (!match) {
    return null;
  }

  const count = parseWritingChapterIndex(match[1]);

  if (!count) {
    return null;
  }

  return {
    count,
    partType: match[2] === "卷" ? "volume" : "act"
  };
}

function parseWritingInstructionChapterRange(instruction) {
  const text = String(instruction ?? "");
  const perPartMatch = text.match(
    /每\s*(?:一)?(?:幕|卷|部)\s*(?:大概|大约|约|左右|预计|规划)?\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(?:[-~－—–到至]\s*([0-9０-９一二三四五六七八九十百千万零〇两]+))?\s*章/
  );

  if (perPartMatch) {
    const first = parseWritingChapterIndex(perPartMatch[1]);
    const second = parseWritingChapterIndex(perPartMatch[2]);

    if (first) {
      return {
        min: Math.min(first, second ?? first),
        max: Math.max(first, second ?? first),
        source: "perPart"
      };
    }
  }

  const totalMatch = text.match(/(?:共|总共|总计|整体|全书|增加到|扩写到)?\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(?:章|章节)/);
  const total = parseWritingChapterIndex(totalMatch?.[1]);

  return total ? { min: total, max: total, source: "total" } : null;
}

function getWritingLongOutlineRequest({ book, tabId, task, instruction }) {
  if (!book || tabId !== "outline" || task?.id !== "structure") {
    return null;
  }

  const instructionText = String(instruction ?? "").trim();
  const partCountRequest = parseWritingInstructionPartCount(instructionText);
  const chapterRange = parseWritingInstructionChapterRange(instructionText);
  const hasExpansionIntent = WRITING_OUTLINE_EXPANSION_PATTERN.test(instructionText);

  if (!hasExpansionIntent && !partCountRequest && !chapterRange) {
    return null;
  }

  const existingPartCount = getWritingBookParts(book).length;
  const targetPartCount = Math.max(1, partCountRequest?.count ?? (existingPartCount || 1));
  const partType = partCountRequest?.partType ?? (getWritingBookParts(book)[0]?.type || "act");
  const minChaptersPerPart =
    chapterRange?.source === "perPart"
      ? chapterRange.min
      : chapterRange?.source === "total"
        ? Math.max(1, Math.floor(chapterRange.min / targetPartCount))
        : 24;
  const maxChaptersPerPart =
    chapterRange?.source === "perPart"
      ? chapterRange.max
      : chapterRange?.source === "total"
        ? Math.max(minChaptersPerPart, Math.ceil(chapterRange.max / targetPartCount))
        : Math.max(minChaptersPerPart, 30);
  const chaptersPerPart = Math.round((minChaptersPerPart + maxChaptersPerPart) / 2);
  const targetChapterCount = targetPartCount * chaptersPerPart;
  const shouldUseLongPlanner =
    targetChapterCount >= 80 ||
    targetPartCount > Math.max(1, existingPartCount) ||
    minChaptersPerPart >= 40 ||
    /几百章|上千章|千章|百章/.test(instructionText);

  if (!shouldUseLongPlanner) {
    return null;
  }

  return {
    instruction: instructionText,
    targetPartCount,
    partType,
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    targetChapterCount,
    batchSize: WRITING_LONG_OUTLINE_BATCH_SIZE
  };
}

function shouldIgnoreExistingWritingOutline(instruction, taskId) {
  const text = String(instruction ?? "");
  return taskId === "structure" && (WRITING_OUTLINE_REWRITE_PATTERN.test(text) || WRITING_OUTLINE_EXPANSION_PATTERN.test(text));
}

function buildWritingLongOutlineTargetContent(request) {
  if (!request) {
    return "";
  }

  const partLabel = request.partType === "volume" ? "卷" : "幕";

  return [
    `目标结构：${request.targetPartCount} ${partLabel}`,
    `每${partLabel}章节范围：${request.minChaptersPerPart}-${request.maxChaptersPerPart} 章`,
    `本轮规划采用：每${partLabel} ${request.chaptersPerPart} 章，共 ${request.targetChapterCount} 章`,
    `分批粒度：每批 ${request.batchSize} 章，逐批生成、校验并落盘`
  ].join("\n");
}

function buildWritingLongOutlineSeedContent(book, maxChapters = 36) {
  const partsContent = getWritingBookParts(book)
    .map((part) => `${getWritingPartDisplayLabel(part)}：${part.description || "暂无描述"}`)
    .join("\n");
  const chapters = getWritingChapters(book);
  const visibleChapters =
    chapters.length <= maxChapters
      ? chapters
      : [...chapters.slice(0, Math.ceil(maxChapters / 2)), null, ...chapters.slice(-Math.floor(maxChapters / 2))];
  const chaptersContent = visibleChapters
    .map((chapter, index) => {
      if (!chapter) {
        return `... 已省略 ${Math.max(0, chapters.length - maxChapters)} 章 ...`;
      }

      const chapterIndex = chapters.findIndex((entry) => entry.id === chapter.id);
      return `${getWritingChapterDisplayTitle(chapter, chapterIndex >= 0 ? chapterIndex : index)}：${chapter.summary || "暂无简介"}`;
    })
    .join("\n");

  return [
    "现有目录只作为种子参考，不是最终章节数上限；如果作者要求扩写，必须重新设计覆盖目标篇幅的长篇结构。",
    partsContent ? `【现有幕/卷】\n${partsContent}` : "",
    chaptersContent ? `【现有章节种子】\n${chaptersContent}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildWritingChapterMemoryLine(book, chapter, index = 0) {
  const partLabel = getWritingChapterPartLabel(book, chapter);
  const statusLabel = getWritingChapterStatusLabel(chapter?.status);
  const sourceText = String(chapter?.summary || chapter?.content || "")
    .replace(/\s+/g, " ")
    .trim();
  const summary = truncateText(sourceText, 140) || "暂无摘要";

  return `${getWritingChapterDisplayTitle(chapter, index)}${partLabel ? ` / ${partLabel}` : ""} / ${statusLabel}：${summary}`;
}

function buildWritingStoryMemoryContext(book, currentChapter = null) {
  if (!book) {
    return "(空)";
  }

  const chapters = getWritingChapters(book).sort(
    (left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0)
  );
  const currentChapterIndex = currentChapter
    ? chapters.findIndex((chapter) => chapter.id === currentChapter.id)
    : -1;
  const currentOrder = currentChapterIndex >= 0 ? normalizeWritingChapterIndex(chapters[currentChapterIndex].index, currentChapterIndex) : 0;
  const recentChapters =
    currentOrder > 0
      ? chapters
          .filter((chapter, index) => normalizeWritingChapterIndex(chapter.index, index) < currentOrder)
          .slice(-6)
      : chapters.filter((chapter) => chapter.status === "done").slice(-6);
  const nextChapters =
    currentOrder > 0
      ? chapters
          .filter((chapter, index) => normalizeWritingChapterIndex(chapter.index, index) > currentOrder)
          .slice(0, 4)
      : chapters.slice(0, 4);
  const memoryKeywords = /(伏笔|未回收|秘密|悬念|钩子|误导|回收|规则|境界|能力|债务|承诺|禁忌)/;
  const memoryNotes = chapters
    .filter((chapter) => memoryKeywords.test(`${chapter.summary}\n${chapter.content}`))
    .slice(-8);
  const parts = getWritingBookParts(book)
    .map((part) => `${getWritingPartDisplayLabel(part)}：${truncateText(String(part.description ?? "").replace(/\s+/g, " ").trim(), 120) || "暂无描述"}`)
    .join("\n");

  return [
    parts ? `【幕/卷记忆】\n${parts}` : "",
    recentChapters.length
      ? `【最近已发生】\n${recentChapters.map((chapter, index) => buildWritingChapterMemoryLine(book, chapter, index)).join("\n")}`
      : "【最近已发生】暂无已完成章节，请以故事介绍和目录为准。",
    currentChapter
      ? `【当前章节职责】\n${buildWritingChapterMemoryLine(book, currentChapter, currentChapterIndex >= 0 ? currentChapterIndex : 0)}`
      : "",
    nextChapters.length
      ? `【后续承接】\n${nextChapters.map((chapter, index) => buildWritingChapterMemoryLine(book, chapter, index)).join("\n")}`
      : "",
    memoryNotes.length
      ? `【伏笔与规则提醒】\n${memoryNotes.map((chapter, index) => buildWritingChapterMemoryLine(book, chapter, index)).join("\n")}`
      : "【伏笔与规则提醒】暂无显式记录；如果本轮新增事实，输出时要把它写成可回收、可追踪的设定。"
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildWritingAssistantPrompt({ book, tabId, task, instruction }) {
  if (!book) {
    return "";
  }

  const lengthProfile = WRITING_LENGTH_PROFILES[book.length] ?? WRITING_LENGTH_PROFILES.long;
  const tabTitle = getWritingTabTitle(tabId);
  const content = getWritingBookContent(book, tabId);
  const currentChapter = activeWritingChapter.value ?? getPreferredWritingChapter(book);
  const taskSpec = getWritingTaskPromptSpec(tabId, task?.id);
  const longOutlineRequest = getWritingLongOutlineRequest({ book, tabId, task, instruction });
  const shouldIgnoreOutline = !longOutlineRequest && shouldIgnoreExistingWritingOutline(instruction, task?.id);
  const introContent = buildWritingIntroContent(book) || "(空)";
  const storyMemoryContent = buildWritingStoryMemoryContext(book, currentChapter);
  const outlineContent = longOutlineRequest
    ? buildWritingLongOutlineSeedContent(book)
    : shouldIgnoreOutline
      ? "(作者要求重改目录，本轮不代入已有章节目录。)"
      : buildWritingOutlineContent(book) || "(空)";
  const currentModuleContent = tabId === "outline" && (shouldIgnoreOutline || longOutlineRequest) ? outlineContent : content;
  const chapterContext =
    currentChapter
      ? [
          `标题：${getWritingChapterDisplayTitle(currentChapter, getWritingChapters(book).findIndex((chapter) => chapter.id === currentChapter.id))}`,
          `状态：${getWritingChapterStatusLabel(currentChapter.status)}`,
          `简介：${currentChapter.summary || "(空)"}`,
          "正文：",
          currentChapter.content || "(空)"
        ].join("\n")
      : "(空)";

  return buildWritingAssistantPromptFromAssets({
    appName: WRITING_APP_NAME,
    book,
    lengthProfile,
    tabTitle,
    task,
    taskSpec,
    instruction,
    promptAssets: writingPromptAssets,
    chapterOutputDefaults: tabId === "chapter" ? writingPromptAssets.chapterOutputDefaults : [],
    longOutlineContent: longOutlineRequest ? buildWritingLongOutlineTargetContent(longOutlineRequest) : "",
    storyMemoryContent,
    introContent,
    outlineContent,
    chapterContext,
    currentModuleContent
  });
}

function getWritingAssistantMaxOutputTokens(tabId, taskId) {
  if (tabId === "outline" && taskId === "structure") {
    return 6200;
  }

  if (tabId === "chapter") {
    return WRITING_CHAPTER_MAX_OUTPUT_TOKENS;
  }

  return 2600;
}

function createWritingOutlinePlannerJob(request, book = null) {
  const now = new Date().toISOString();
  const generatedChapterCount = book ? countWritingGeneratedTargetChapters(book, request) : 0;

  return {
    id: createLocalId("writing_outline_job"),
    status: "running",
    instruction: request.instruction,
    targetPartCount: request.targetPartCount,
    partType: request.partType,
    minChaptersPerPart: request.minChaptersPerPart,
    maxChaptersPerPart: request.maxChaptersPerPart,
    chaptersPerPart: request.chaptersPerPart,
    batchSize: request.batchSize,
    targetChapterCount: request.targetChapterCount,
    generatedChapterCount,
    currentPartIndex: 0,
    currentBatchStartIndex: 0,
    currentBatchEndIndex: 0,
    lastCompletedChapterIndex: book ? getLastCompletedWritingChapterIndex(book, request) : 0,
    retryAttempt: 0,
    maxRetryAttempts: 0,
    createdAt: now,
    updatedAt: now
  };
}

function updateWritingOutlinePlannerJob(book, updates = {}) {
  if (!book?.outlinePlannerJob) {
    return null;
  }

  book.outlinePlannerJob = {
    ...book.outlinePlannerJob,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  return book.outlinePlannerJob;
}

function cancelWritingOutlinePlanningJob() {
  ui.marketplace.writing.outlinePlannerCancelRequested = true;
  if (activeWritingModelRequestId && desktopApi?.cancelModelText) {
    desktopApi.cancelModelText(activeWritingModelRequestId).catch((error) => {
      console.warn("Failed to cancel writing model request", error);
    });
  }
  setWritingFeedback("正在停止分批规划，当前请求会尽快中断。", "warning");
}

function isWritingAssistantAbortError(error) {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? error ?? "");

  return (
    name === "AbortError" ||
    /abort|aborted|cancelled|canceled|operation was aborted|ERR_ABORTED/i.test(message)
  );
}

function createWritingAbortError() {
  const error = new Error("任务已停止");
  error.name = "AbortError";
  return error;
}

function getWritingErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "未知错误");
}

function isRetryableWritingAssistantError(error) {
  if (isWritingAssistantAbortError(error) || ui.marketplace.writing.outlinePlannerCancelRequested) {
    return false;
  }

  const message = getWritingErrorMessage(error);

  return /(?:HTTP\s*)?(?:408|429|500|502|503|504)|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|timeout|socket|gateway|upstream|overloaded|rate limit|too many requests|服务错误|serivce_request_error|service_request_error|ccp http status|模型没有返回可用文本内容/i.test(
    message
  );
}

function getWritingRetryDelayMs(retryAttempt) {
  const attempt = Math.max(1, Number(retryAttempt) || 1);
  return Math.min(WRITING_MODEL_RETRY_MAX_DELAY_MS, WRITING_MODEL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
}

async function waitWritingRetryDelay(delayMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < delayMs) {
    if (ui.marketplace.writing.outlinePlannerCancelRequested) {
      throw createWritingAbortError();
    }

    await new Promise((resolve) => setTimeout(resolve, Math.min(250, delayMs - (Date.now() - startedAt))));
  }
}

function isWritingOutlinePlannerRunning(job = activeWritingOutlinePlannerJob.value) {
  return job?.status === "running";
}

function getWritingLongOutlineRequestFromJob(job) {
  if (!job) {
    return null;
  }

  const targetPartCount = normalizePositiveInteger(job.targetPartCount, 1);
  const minChaptersPerPart = normalizePositiveInteger(job.minChaptersPerPart, 80);
  const maxChaptersPerPart = Math.max(minChaptersPerPart, normalizePositiveInteger(job.maxChaptersPerPart, 100));
  const chaptersPerPart = Math.min(maxChaptersPerPart, Math.max(minChaptersPerPart, normalizePositiveInteger(job.chaptersPerPart, Math.round((minChaptersPerPart + maxChaptersPerPart) / 2))));

  return {
    instruction: String(job.instruction ?? ""),
    targetPartCount,
    partType: normalizeWritingBookPartTypeForUi(job.partType),
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    targetChapterCount: targetPartCount * chaptersPerPart,
    batchSize: Math.min(40, Math.max(5, normalizePositiveInteger(job.batchSize, WRITING_LONG_OUTLINE_BATCH_SIZE)))
  };
}

function isSameWritingLongOutlineRequest(left, right) {
  return Boolean(
    left &&
      right &&
      left.targetPartCount === right.targetPartCount &&
      left.partType === right.partType &&
      left.minChaptersPerPart === right.minChaptersPerPart &&
      left.maxChaptersPerPart === right.maxChaptersPerPart &&
      left.chaptersPerPart === right.chaptersPerPart &&
      left.targetChapterCount === right.targetChapterCount &&
      String(left.instruction ?? "") === String(right.instruction ?? "")
  );
}

function getNextMissingWritingChapterIndex(book, startIndex, endIndex) {
  const existingIndexes = new Set(getWritingChapters(book).map((chapter) => normalizeWritingChapterIndex(chapter.index, 0)));

  for (let index = startIndex; index <= endIndex; index += 1) {
    if (!existingIndexes.has(index)) {
      return index;
    }
  }

  return null;
}

function getLastCompletedWritingChapterIndex(book, request) {
  let lastCompletedIndex = 0;
  const existingIndexes = new Set(getWritingChapters(book).map((chapter) => normalizeWritingChapterIndex(chapter.index, 0)));

  for (let index = 1; index <= request.targetChapterCount; index += 1) {
    if (!existingIndexes.has(index)) {
      break;
    }

    lastCompletedIndex = index;
  }

  return lastCompletedIndex;
}

function canResumeWritingOutlinePlanner(book, job) {
  const isStaleRunningJob = job?.status === "running" && !ui.marketplace.writing.isAiRunning;

  if (!book || !job || (!["failed", "cancelled"].includes(job.status) && !isStaleRunningJob)) {
    return false;
  }

  const request = getWritingLongOutlineRequestFromJob(job);

  return Boolean(request && getNextMissingWritingChapterIndex(book, 1, request.targetChapterCount));
}

function getWritingOutlinePlannerRetryCopy(job = activeWritingOutlinePlannerJob.value) {
  if (!job?.retryAttempt || !job.maxRetryAttempts || job.status !== "running") {
    return "";
  }

  return `当前批次遇到临时错误，正在第 ${job.retryAttempt}/${job.maxRetryAttempts} 次重试。`;
}

function getWritingOutlinePlannerProgressPercent(job = activeWritingOutlinePlannerJob.value) {
  if (!job?.targetChapterCount) {
    return 0;
  }

  return Math.min(100, Math.round((Number(job.generatedChapterCount ?? 0) / job.targetChapterCount) * 100));
}

function getWritingOutlinePlannerProgressCopy(job = activeWritingOutlinePlannerJob.value) {
  if (!job) {
    return "";
  }

  if (job.status === "running" && !ui.marketplace.writing.isAiRunning && activeWritingBook.value) {
    const request = getWritingLongOutlineRequestFromJob(job);
    const nextMissingIndex = request ? getNextMissingWritingChapterIndex(activeWritingBook.value, 1, request.targetChapterCount) : null;

    return nextMissingIndex
      ? `上次规划停在第 ${nextMissingIndex} 章前；本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`
      : `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`;
  }

  if (job.status === "running" && !job.currentPartIndex) {
    return `正在生成幕/卷总规划；本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`;
  }

  if (job.status === "running") {
    const partLabel = job.partType === "volume" ? "卷" : "幕";
    return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章；当前请求第 ${job.currentPartIndex} ${partLabel}，第 ${job.currentBatchStartIndex}-${job.currentBatchEndIndex} 章。`;
  }

  if (["failed", "cancelled"].includes(job.status) && activeWritingBook.value) {
    const request = getWritingLongOutlineRequestFromJob(job);
    const nextMissingIndex = request ? getNextMissingWritingChapterIndex(activeWritingBook.value, 1, request.targetChapterCount) : null;

    if (nextMissingIndex) {
      return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章；可从第 ${nextMissingIndex} 章继续。`;
    }
  }

  return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`;
}

function getWritingOutlinePlannerStatusLabel(job = activeWritingOutlinePlannerJob.value) {
  if (!job) {
    return "";
  }

  if (job.status === "running") {
    if (!ui.marketplace.writing.isAiRunning) {
      return "待继续";
    }

    if (!job.currentPartIndex) {
      return "总规划中";
    }

    return "分批规划中";
  }

  if (job.status === "completed") {
    return "规划完成";
  }

  if (job.status === "failed") {
    return "规划失败";
  }

  if (job.status === "cancelled") {
    return "已停止";
  }

  return "待规划";
}

function getWritingOutlinePlannerStatusClass(job = activeWritingOutlinePlannerJob.value) {
  if (job?.status === "completed") {
    return "is-success";
  }

  if (job?.status === "failed") {
    return "is-danger";
  }

  if (job?.status === "cancelled") {
    return "is-warning";
  }

  return job?.status === "running" ? (ui.marketplace.writing.isAiRunning ? "is-running" : "is-warning") : "";
}

function getWritingAiRunButtonLabel() {
  if (ui.marketplace.writing.isAiRunning) {
    return activeWritingOutlinePlannerJob.value?.status === "running" ? "规划中" : "生成中";
  }

  const resumeRequest = getWritingLongOutlineRequestFromJob(activeWritingOutlinePlannerJob.value);

  if (
    canResumeWritingOutlinePlanner(activeWritingBook.value, activeWritingOutlinePlannerJob.value) &&
    (!activeWritingLongOutlineRequest.value || isSameWritingLongOutlineRequest(activeWritingLongOutlineRequest.value, resumeRequest))
  ) {
    return "继续规划";
  }

  return activeWritingLongOutlineRequest.value ? "启动分批规划" : "生成建议";
}

function getWritingBusyTitle() {
  return activeWritingOutlinePlannerJob.value?.status === "running" ? "正在分批规划长篇目录" : "正在生成建议";
}

function getWritingBusyDescription() {
  const job = activeWritingOutlinePlannerJob.value;

  if (job?.status === "running") {
    const partLabel = job.partType === "volume" ? "卷" : "幕";

    if (!job.currentPartIndex) {
      return `正在生成幕/卷总规划；当前本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。可以返回书架或切换到其他书籍，任务会继续在后台执行。`;
    }

    return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章；当前在第 ${job.currentPartIndex} ${partLabel}，生成第 ${job.currentBatchStartIndex}-${job.currentBatchEndIndex} 章。可以返回书架或切换到其他书籍，任务会继续在后台执行。`;
  }

  return "任务已在后台执行，可以切换到其他页面，完成后会回到大师辅助输出区。";
}

function buildWritingPartsContext(book) {
  const parts = getWritingBookParts(book);

  if (!parts.length) {
    return "(空)";
  }

  return parts.map((part) => `${getWritingPartDisplayLabel(part)}\n${part.description || "暂无描述"}`).join("\n\n");
}

function ensureWritingLongOutlineParts(book, request) {
  const partLabel = request.partType === "volume" ? "卷" : "幕";
  const existingByIndex = new Map(getWritingBookParts(book).map((part) => [part.index, part]));

  book.parts = Array.from({ length: request.targetPartCount }, (_, index) => {
    const partIndex = index + 1;
    const existingPart = existingByIndex.get(partIndex);

    return normalizeWritingBookPart(
      existingPart ?? {
        id: createLocalId("writing_part"),
        type: request.partType,
        index: partIndex,
        title: `未命名${partLabel} ${partIndex}`,
        description: "待补充本幕/卷的整体故事设计、关键矛盾、阶段高潮和转折作用。"
      },
      index,
      book.id
    );
  });
}

function buildWritingRecentChapterContext(book, partIndex, beforeIndex, limit = 8) {
  const chapters = getWritingChapters(book)
    .filter((chapter) => (!partIndex || chapter.partIndex === partIndex) && normalizeWritingChapterIndex(chapter.index, 0) < beforeIndex)
    .sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0))
    .slice(-limit);

  if (!chapters.length) {
    return "(本幕/卷还没有已生成章节)";
  }

  return chapters
    .map((chapter) => {
      const index = getWritingChapters(book).findIndex((entry) => entry.id === chapter.id);
      return `${getWritingChapterDisplayTitle(chapter, index)}：${chapter.summary || "暂无简介"}`;
    })
    .join("\n");
}

function buildWritingLongOutlineMasterPrompt(book, request) {
  const partLabel = request.partType === "volume" ? "卷" : "幕";

  return buildWritingLongOutlineMasterPromptFromAssets({
    appName: WRITING_APP_NAME,
    book,
    request,
    partLabel,
    targetContent: buildWritingLongOutlineTargetContent(request),
    introContent: buildWritingIntroContent(book) || "(空)",
    seedContent: buildWritingLongOutlineSeedContent(book, 36),
    promptAssets: writingPromptAssets
  });
}

function buildWritingLongOutlineBatchPrompt(book, request, part, batchStartIndex, batchEndIndex) {
  const partLabel = request.partType === "volume" ? "卷" : "幕";

  return buildWritingLongOutlineBatchPromptFromAssets({
    appName: WRITING_APP_NAME,
    book,
    request,
    part,
    partLabel,
    batchStartIndex,
    batchEndIndex,
    targetContent: buildWritingLongOutlineTargetContent(request),
    introContent: buildWritingIntroContent(book) || "(空)",
    partsContext: buildWritingPartsContext(book),
    partDisplayLabel: getWritingPartDisplayLabel(part),
    recentChapterContext: buildWritingRecentChapterContext(book, part.index, batchStartIndex),
    promptAssets: writingPromptAssets
  });
}

function normalizeWritingLongBatchPlans(plans, part, batchStartIndex, batchEndIndex) {
  const expectedCount = batchEndIndex - batchStartIndex + 1;
  const sortedPlans = plans
    .filter((plan) => normalizeWritingChapterIndex(plan.index, 0) >= batchStartIndex && normalizeWritingChapterIndex(plan.index, 0) <= batchEndIndex)
    .sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0));
  const sourcePlans = sortedPlans.length >= expectedCount ? sortedPlans : plans.slice(0, expectedCount);

  if (sourcePlans.length < expectedCount) {
    return [];
  }

  return sourcePlans.slice(0, expectedCount).map((plan, offset) => ({
    ...plan,
    index: batchStartIndex + offset,
    partIndex: part.index,
    title: normalizeWritingChapterPlanTitle(plan.title),
    summary: normalizeWritingChapterPlanSummary(plan.summary)
  }));
}

function mergeWritingChapterPlanBatch(book, plans) {
  const existingChapters = getWritingChapters(book);
  const existingByTitle = new Map(
    existingChapters.map((chapter) => [normalizeWritingChapterTitleForMatch(chapter.title), chapter]).filter(([title]) => Boolean(title))
  );
  const existingByIndex = new Map(existingChapters.map((chapter) => [normalizeWritingChapterIndex(chapter.index, 0), chapter]));
  const planIndexes = new Set(plans.map((plan) => normalizeWritingChapterIndex(plan.index, 0)));
  const retainedChapters = existingChapters.filter((chapter) => !planIndexes.has(normalizeWritingChapterIndex(chapter.index, 0)));
  const batchChapters = plans.map((plan, index) => {
    const titleKey = normalizeWritingChapterTitleForMatch(plan.title);
    const indexMatchedChapter = existingByIndex.get(normalizeWritingChapterIndex(plan.index, index)) ?? null;
    const existingChapter =
      existingByTitle.get(titleKey) ?? (indexMatchedChapter && !String(indexMatchedChapter.content ?? "").trim() ? indexMatchedChapter : null);
    return buildWritingChapterFromPlan(plan, existingChapter, normalizeWritingChapterIndex(plan.index, index) - 1);
  });

  book.chapters = [...retainedChapters, ...batchChapters].sort(
    (left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0)
  );
}

function countWritingGeneratedTargetChapters(book, request) {
  return getWritingChapters(book).filter((chapter) => {
    const index = normalizeWritingChapterIndex(chapter.index, 0);
    return index >= 1 && index <= request.targetChapterCount;
  }).length;
}

function getWritingMasterSystemPrompt() {
  return (
    writingPromptAssets.masterSystem ||
    [
      `你是「${WRITING_APP_NAME}」里的大师级小说总编、故事架构师和文字教练。`,
      "输出必须可直接放进写作项目，不写寒暄，不解释你在做什么。"
    ].join("\n")
  );
}

async function invokeWritingAssistantModel(prompt, maxOutputTokens, temperature = 0.72, options = {}) {
  const maxRetries = Math.max(0, Number(options.maxRetries ?? 0) || 0);
  let retryAttempt = 0;

  while (retryAttempt <= maxRetries) {
    if (ui.marketplace.writing.outlinePlannerCancelRequested) {
      throw createWritingAbortError();
    }

    const requestId = createLocalId("writing_model_request");
    activeWritingModelRequestId = requestId;

    try {
      return await desktopApi.invokeModelText({
        requestId,
        temperature,
        maxOutputTokens,
        messages: [
          {
            role: "system",
            content: getWritingMasterSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });
    } catch (error) {
      if (retryAttempt >= maxRetries || !isRetryableWritingAssistantError(error)) {
        throw error;
      }

      retryAttempt += 1;
      const delayMs = getWritingRetryDelayMs(retryAttempt);

      if (typeof options.onRetry === "function") {
        await options.onRetry({
          error,
          retryAttempt,
          maxRetries,
          delayMs
        });
      }

      await waitWritingRetryDelay(delayMs);
    } finally {
      if (activeWritingModelRequestId === requestId) {
        activeWritingModelRequestId = "";
      }
    }
  }

  throw new Error("模型调用重试失败");
}

async function generateWritingLongOutlinePlan(book, request, options = {}) {
  if (!book || !desktopApi?.invokeModelText) {
    setWritingFeedback("AI 桥接未就绪。", "danger");
    return;
  }

  const existingJob = book.outlinePlannerJob ?? null;
  const shouldResume =
    Boolean(options.resume) ||
    (canResumeWritingOutlinePlanner(book, existingJob) && isSameWritingLongOutlineRequest(request, getWritingLongOutlineRequestFromJob(existingJob)));
  const job = shouldResume && existingJob
    ? {
        ...existingJob,
        status: "running",
        instruction: request.instruction,
        targetPartCount: request.targetPartCount,
        partType: request.partType,
        minChaptersPerPart: request.minChaptersPerPart,
        maxChaptersPerPart: request.maxChaptersPerPart,
        chaptersPerPart: request.chaptersPerPart,
        batchSize: request.batchSize,
        targetChapterCount: request.targetChapterCount,
        generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
        lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
        retryAttempt: 0,
        maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
        lastError: "",
        error: ""
      }
    : createWritingOutlinePlannerJob(request, book);
  const partLabel = request.partType === "volume" ? "卷" : "幕";

  try {
    ui.marketplace.writing.isAiRunning = true;
    ui.marketplace.writing.aiRunningBookId = book.id;
    ui.marketplace.writing.outlinePlannerCancelRequested = false;
    ui.marketplace.writing.aiOutput = "";
    book.outlinePlannerJob = job;
    setWritingAiTaskPickerOpen(false);
    setWritingFeedback(
      shouldResume
        ? `继续长篇分批规划：已落盘 ${job.generatedChapterCount}/${request.targetChapterCount} 章。`
        : `长篇分批规划启动：${request.targetPartCount} ${partLabel} / ${request.targetChapterCount} 章。`,
      "neutral"
    );
    setStatus(
      shouldResume
        ? `${WRITING_APP_NAME}正在继续分批规划长篇目录。`
        : `${WRITING_APP_NAME}正在后台分批规划长篇目录。`,
      "neutral"
    );
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });

    const shouldGenerateMasterPlan = !shouldResume || getWritingBookParts(book).length < request.targetPartCount;

    if (shouldGenerateMasterPlan) {
      const masterResult = await invokeWritingAssistantModel(
        buildWritingLongOutlineMasterPrompt(book, request),
        WRITING_LONG_OUTLINE_MASTER_MAX_TOKENS,
        0.66,
        {
          maxRetries: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
          onRetry: async ({ error, retryAttempt, maxRetries }) => {
            const message = getWritingErrorMessage(error);
            updateWritingOutlinePlannerJob(book, {
              status: "running",
              retryAttempt,
              maxRetryAttempts: maxRetries,
              lastRetryAt: new Date().toISOString(),
              lastError: message,
              error: ""
            });
            setWritingFeedback(`总体规划请求失败，正在第 ${retryAttempt}/${maxRetries} 次重试。`, "warning");
            ui.marketplace.writing.aiOutput = [
              `【长篇分批规划重试】总体规划 ${retryAttempt}/${maxRetries}`,
              "",
              message
            ].join("\n");
            touchWritingBook(book, { persist: false });
            await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
          }
        }
      );
      const masterPlan = parseWritingChapterJsonPayload(masterResult?.text ?? "", { allowPartsOnly: true });
      const plannedParts = masterPlan.parts.length
        ? masterPlan.parts.slice(0, request.targetPartCount)
        : Array.from({ length: request.targetPartCount }, (_, index) => ({
            id: createLocalId("writing_part"),
            type: request.partType,
            index: index + 1,
            title: `未命名${partLabel} ${index + 1}`,
            description: "待补充本幕/卷的整体故事设计、关键矛盾、阶段高潮和转折作用。"
          }));

      book.parts = plannedParts.map((part, index) =>
        normalizeWritingBookPart({ ...part, type: part.type ?? request.partType, index: part.index ?? index + 1 }, index, book.id)
      );
      ui.marketplace.writing.aiOutput = [`【总体规划已生成】`, buildWritingPartsContext(book)].join("\n\n");
    } else {
      ensureWritingLongOutlineParts(book, request);
      ui.marketplace.writing.aiOutput = [
        `【继续长篇分批规划】`,
        `已落盘 ${countWritingGeneratedTargetChapters(book, request)}/${request.targetChapterCount} 章`,
        "",
        buildWritingPartsContext(book)
      ].join("\n\n");
    }

    ensureWritingLongOutlineParts(book, request);
    updateWritingOutlinePlannerJob(book, {
      retryAttempt: 0,
      maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
      lastError: "",
      error: "",
      generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
      lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request)
    });
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });

    for (let partIndex = 1; partIndex <= request.targetPartCount; partIndex += 1) {
      const part = getWritingBookParts(book).find((entry) => entry.index === partIndex) ?? normalizeWritingBookPart(null, partIndex - 1, book.id);
      const partStartIndex = (partIndex - 1) * request.chaptersPerPart + 1;
      const partEndIndex = partIndex * request.chaptersPerPart;
      let batchStartIndex = getNextMissingWritingChapterIndex(book, partStartIndex, partEndIndex);

      while (batchStartIndex && batchStartIndex <= partEndIndex) {
        if (ui.marketplace.writing.outlinePlannerCancelRequested) {
          updateWritingOutlinePlannerJob(book, {
            status: "cancelled",
            generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
            lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
            retryAttempt: 0
          });
          setWritingFeedback("长篇分批规划已停止。", "warning");
          setStatus(`${WRITING_APP_NAME}分批规划已停止。`, "warning");
          touchWritingBook(book, { persist: false });
          await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
          return;
        }

        const batchEndIndex = Math.min(partEndIndex, batchStartIndex + request.batchSize - 1);
        updateWritingOutlinePlannerJob(book, {
          status: "running",
          currentPartIndex: partIndex,
          currentBatchStartIndex: batchStartIndex,
          currentBatchEndIndex: batchEndIndex,
          generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
          retryAttempt: 0,
          maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
          lastError: "",
          error: ""
        });
        setWritingFeedback(`正在规划第 ${partIndex} ${partLabel}：第 ${batchStartIndex}-${batchEndIndex} 章。`, "neutral");
        ui.marketplace.writing.aiOutput = [
          `【长篇分批规划进度】${book.outlinePlannerJob.generatedChapterCount}/${request.targetChapterCount} 章已落盘`,
          `当前请求：第 ${partIndex} ${partLabel}，第 ${batchStartIndex}-${batchEndIndex} 章`,
          "",
          "当前批次正在生成中，批次完成后会写入 chapters.json。"
        ].join("\n");
        touchWritingBook(book, { persist: false });
        await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });

        const batchResult = await invokeWritingAssistantModel(
          buildWritingLongOutlineBatchPrompt(book, request, part, batchStartIndex, batchEndIndex),
          WRITING_LONG_OUTLINE_BATCH_MAX_TOKENS,
          0.7,
          {
            maxRetries: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
            onRetry: async ({ error, retryAttempt, maxRetries }) => {
              const message = getWritingErrorMessage(error);
              updateWritingOutlinePlannerJob(book, {
                status: "running",
                currentPartIndex: partIndex,
                currentBatchStartIndex: batchStartIndex,
                currentBatchEndIndex: batchEndIndex,
                generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
                lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
                retryAttempt,
                maxRetryAttempts: maxRetries,
                lastRetryAt: new Date().toISOString(),
                lastError: message,
                error: ""
              });
              setWritingFeedback(`第 ${batchStartIndex}-${batchEndIndex} 章请求失败，正在第 ${retryAttempt}/${maxRetries} 次重试。`, "warning");
              ui.marketplace.writing.aiOutput = [
                `【长篇分批规划重试】第 ${batchStartIndex}-${batchEndIndex} 章`,
                `重试：${retryAttempt}/${maxRetries}`,
                `本地已落盘：${book.outlinePlannerJob.generatedChapterCount}/${request.targetChapterCount} 章`,
                "",
                message
              ].join("\n");
              touchWritingBook(book, { persist: false });
              await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
            }
          }
        );
        const batchPlan = parseWritingChaptersFromAssistantOutput(batchResult?.text ?? "");
        const normalizedPlans = normalizeWritingLongBatchPlans(batchPlan.chapters, part, batchStartIndex, batchEndIndex);

        if (!normalizedPlans.length) {
          throw new Error(`第 ${batchStartIndex}-${batchEndIndex} 章没有返回完整 chapters JSON`);
        }

        mergeWritingChapterPlanBatch(book, normalizedPlans);
        const generatedChapterCount = countWritingGeneratedTargetChapters(book, request);
        updateWritingOutlinePlannerJob(book, {
          generatedChapterCount,
          lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
          retryAttempt: 0,
          maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
          lastError: "",
          error: ""
        });
        ui.marketplace.writing.aiOutput = [
          `【长篇分批规划进度】${generatedChapterCount}/${request.targetChapterCount} 章`,
          `当前完成：第 ${partIndex} ${partLabel}，第 ${batchStartIndex}-${batchEndIndex} 章`,
          "",
          batchResult?.text ?? ""
        ].join("\n");
        touchWritingBook(book, { persist: false });
        await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
        batchStartIndex = getNextMissingWritingChapterIndex(book, partStartIndex, partEndIndex);
      }
    }

    updateWritingOutlinePlannerJob(book, {
      status: "completed",
      generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
      lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
      currentPartIndex: request.targetPartCount,
      currentBatchStartIndex: request.targetChapterCount,
      currentBatchEndIndex: request.targetChapterCount,
      retryAttempt: 0,
      maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
      lastError: "",
      error: ""
    });
    if (activeWritingBook.value?.id === book.id) {
      selectWritingChapter(getWritingChapters(book)[0]?.id ?? "");
    }
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
    setWritingFeedback(`长篇目录规划完成：${request.targetChapterCount} 章已写入本地。`, "success");
    setStatus(`${WRITING_APP_NAME}长篇目录已分批写入本地。`, "success");
  } catch (error) {
    console.error("Failed to generate long writing outline", error);
    const message = error instanceof Error ? error.message : "未知错误";
    const isCancelled = ui.marketplace.writing.outlinePlannerCancelRequested || isWritingAssistantAbortError(error);
    updateWritingOutlinePlannerJob(book, {
      status: isCancelled ? "cancelled" : "failed",
      generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
      lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
      retryAttempt: 0,
      maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
      lastError: isCancelled ? "" : message,
      ...(isCancelled ? { error: "" } : { error: message })
    });
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true }).catch(() => {});
    if (isCancelled) {
      setWritingFeedback("长篇分批规划已停止。", "warning");
      setStatus(`${WRITING_APP_NAME}分批规划已停止。`, "warning");
    } else {
      setWritingFeedback(`分批规划失败：${message}`, "danger");
      setStatus(`${WRITING_APP_NAME}分批规划失败：${message}`, "danger");
    }
  } finally {
    ui.marketplace.writing.isAiRunning = false;
    ui.marketplace.writing.aiRunningBookId = "";
    ui.marketplace.writing.outlinePlannerCancelRequested = false;
  }
}

async function generateWritingAssistantOutput() {
  const book = activeWritingBook.value;

  if (ui.marketplace.writing.isAiRunning) {
    return;
  }

  if (!book || !desktopApi?.invokeModelText) {
    setWritingFeedback("AI 桥接未就绪。", "danger");
    return;
  }

  const longOutlineRequest = activeWritingLongOutlineRequest.value;
  const resumeRequest = getWritingLongOutlineRequestFromJob(book.outlinePlannerJob);

  if (
    canResumeWritingOutlinePlanner(book, book.outlinePlannerJob) &&
    resumeRequest &&
    (!longOutlineRequest || isSameWritingLongOutlineRequest(longOutlineRequest, resumeRequest))
  ) {
    await generateWritingLongOutlinePlan(book, resumeRequest, { resume: true });
    return;
  }

  if (longOutlineRequest) {
    await generateWritingLongOutlinePlan(book, longOutlineRequest);
    return;
  }

  const prompt = activeWritingPromptPreview.value;

  try {
    ui.marketplace.writing.isAiRunning = true;
    ui.marketplace.writing.aiRunningBookId = book.id;
    ui.marketplace.writing.aiOutput = "";
    setWritingAiTaskPickerOpen(false);
    setWritingFeedback("正在召唤主编和故事架构师...", "neutral");
    setStatus(`${WRITING_APP_NAME}正在后台生成建议。`, "neutral");

    const result = await invokeWritingAssistantModel(
      prompt,
      getWritingAssistantMaxOutputTokens(ui.marketplace.writing.activeTab, activeWritingTask.value?.id),
      0.72
    );

    ui.marketplace.writing.aiOutput =
      ui.marketplace.writing.activeTab === "chapter"
        ? normalizeWritingChapterDraftOutput(result?.text ?? "")
        : String(result?.text ?? "").trim();
    setWritingFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "AI 已生成建议。", "success");
    setStatus(`${WRITING_APP_NAME}已生成建议。`, "success");
  } catch (error) {
    console.error("Failed to generate writing assistant output", error);
    const message = error instanceof Error ? error.message : "未知错误";
    setWritingFeedback(`生成失败：${message}`, "danger");
    setStatus(`${WRITING_APP_NAME}生成失败：${message}`, "danger");
  } finally {
    ui.marketplace.writing.isAiRunning = false;
    ui.marketplace.writing.aiRunningBookId = "";
  }
}

async function resumeWritingOutlinePlanningJob() {
  const book = activeWritingBook.value;
  const request = getWritingLongOutlineRequestFromJob(book?.outlinePlannerJob);

  if (!book || !request || ui.marketplace.writing.isAiRunning) {
    return;
  }

  await generateWritingLongOutlinePlan(book, request, { resume: true });
}

function normalizeWritingChapterTitleForMatch(value) {
  return splitWritingChapterTitlePrefix(value)
    .title
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeWritingChapterPlanTitle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function normalizeWritingChapterPlanSummary(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, entryValue]) => `${key}：${String(entryValue ?? "").trim()}`)
      .filter((line) => !line.endsWith("："))
      .join("\n");
  }

  return String(value ?? "").trim();
}

function normalizeWritingChapterPlanEntry(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const rawTitle = normalizeWritingChapterPlanTitle(
    entry.title ?? entry.name ?? entry.chapterTitle ?? entry.chapter ?? entry.标题 ?? entry.章节标题
  );
  const titleParts = splitWritingChapterTitlePrefix(rawTitle);
  const chapterIndex = normalizeWritingChapterIndex(
    entry.index ?? entry.order ?? entry.chapterIndex ?? entry.chapterNo ?? entry.序号 ?? entry.章节序号 ?? titleParts.index,
    fallbackIndex
  );
  const partIndex =
    parseWritingChapterIndex(
      entry.partIndex ?? entry.part_index ?? entry.volumeIndex ?? entry.actIndex ?? entry.幕序号 ?? entry.卷序号 ?? entry.所属幕 ?? entry.所属卷
    ) ?? null;
  const title = titleParts.title;
  const summary = normalizeWritingChapterPlanSummary(
    entry.summary ??
      entry.brief ??
      entry.description ??
      entry.synopsis ??
      entry.goal ??
      entry.简介 ??
      entry.摘要 ??
      entry.梗概 ??
      entry.章节简介 ??
      entry.本章目标
  );

  if (!title) {
    return null;
  }

  return {
    index: chapterIndex,
    ...(partIndex ? { partIndex } : {}),
    title,
    summary: summary || "待补充章节目标、主要冲突、信息增量、伏笔/回收和结尾钩子。"
  };
}

function normalizeWritingPartPlanEntry(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const rawTitle = normalizeWritingChapterPlanTitle(entry.title ?? entry.name ?? entry.partTitle ?? entry.volumeTitle ?? entry.标题 ?? entry.卷名 ?? entry.幕名);
  const titleParts = splitWritingBookPartTitlePrefix(rawTitle);
  const partIndex = normalizeWritingChapterIndex(entry.index ?? entry.order ?? entry.partIndex ?? entry.序号 ?? titleParts.index, fallbackIndex);
  const partType = normalizeWritingBookPartTypeForUi(entry.type ?? entry.partType ?? entry.kind ?? titleParts.type);
  const title = titleParts.title || rawTitle;
  const description = normalizeWritingChapterPlanSummary(
    entry.description ?? entry.summary ?? entry.brief ?? entry.synopsis ?? entry.goal ?? entry.描述 ?? entry.简介 ?? entry.概述
  );

  if (!title) {
    return null;
  }

  return {
    id: createLocalId("writing_part"),
    type: partType,
    index: partIndex,
    title,
    description: description || "待补充本幕/卷的整体故事设计、关键矛盾、阶段高潮和转折作用。"
  };
}

function parseWritingChapterJsonPayload(value, options = {}) {
  const text = String(value ?? "").trim();
  const candidates = [];
  const fencedBlocks = Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)).map((match) => match[1]?.trim()).filter(Boolean);

  candidates.push(...fencedBlocks);

  const firstObjectIndex = text.indexOf("{");
  const lastObjectIndex = text.lastIndexOf("}");
  if (firstObjectIndex >= 0 && lastObjectIndex > firstObjectIndex) {
    candidates.push(text.slice(firstObjectIndex, lastObjectIndex + 1));
  }

  const firstArrayIndex = text.indexOf("[");
  const lastArrayIndex = text.lastIndexOf("]");
  if (firstArrayIndex >= 0 && lastArrayIndex > firstArrayIndex) {
    candidates.push(text.slice(firstArrayIndex, lastArrayIndex + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const chapters = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.chapters) ? parsed.chapters : [];
      const parts = Array.isArray(parsed?.parts)
        ? parsed.parts
        : Array.isArray(parsed?.volumes)
          ? parsed.volumes.map((part) => ({ ...part, type: part?.type ?? "volume" }))
          : Array.isArray(parsed?.acts)
            ? parsed.acts.map((part) => ({ ...part, type: part?.type ?? "act" }))
            : [];
      const normalizedParts = parts.map((entry, index) => normalizeWritingPartPlanEntry(entry, index)).filter(Boolean);
      const normalizedChapters = [];
      let currentPartIndex = normalizedParts.at(-1)?.index ?? null;

      chapters.forEach((entry, index) => {
        const rawTitle = normalizeWritingChapterPlanTitle(
          entry?.title ?? entry?.name ?? entry?.chapterTitle ?? entry?.chapter ?? entry?.标题 ?? entry?.章节标题
        );
        const partTitleParts = splitWritingBookPartTitlePrefix(rawTitle);

        if (partTitleParts.index && partTitleParts.type) {
          const partPlan = normalizeWritingPartPlanEntry(
            {
              ...entry,
              index: partTitleParts.index,
              type: partTitleParts.type,
              title: partTitleParts.title,
              description: entry?.description ?? entry?.summary
            },
            normalizedParts.length
          );

          if (partPlan) {
            normalizedParts.push(partPlan);
            currentPartIndex = partPlan.index;
          }

          return;
        }

        const chapterPlan = normalizeWritingChapterPlanEntry(entry, normalizedChapters.length || index);

        if (chapterPlan) {
          if (currentPartIndex && !chapterPlan.partIndex) {
            chapterPlan.partIndex = currentPartIndex;
          }

          normalizedChapters.push(chapterPlan);
        }
      });

      if (normalizedChapters.length || (options.allowPartsOnly && normalizedParts.length)) {
        return { parts: normalizedParts, chapters: normalizedChapters };
      }
    } catch {
      // Continue with markdown fallback.
    }
  }

  return { parts: [], chapters: [] };
}

function splitWritingChapterTitleAndSummary(value, fallbackIndex = 0) {
  const text = normalizeWritingChapterPlanTitle(value);
  const titleParts = splitWritingChapterTitlePrefix(text);
  const chapterIndex = normalizeWritingChapterIndex(titleParts.index, fallbackIndex);
  const titleText = titleParts.title || text;
  const separatorIndex = titleText.search(/[：:]/);

  if (separatorIndex > 0) {
    const title = normalizeWritingChapterPlanTitle(titleText.slice(0, separatorIndex));
    const summary = titleText.slice(separatorIndex + 1).trim();
    return { index: chapterIndex, title, summary };
  }

  return { index: chapterIndex, title: titleText, summary: "" };
}

function parseWritingChapterMarkdownPayload(value) {
  const parts = [];
  const chapters = [];
  let current = null;
  let currentPart = null;

  String(value ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((rawLine) => {
      const line = rawLine.replace(/^>\s*/, "").replace(/^#{1,6}\s*/, "").replace(/^\s*[-*+]\s*/, "").trim();
      const partMatch = line.match(/^(?:\*\*)?\s*(?:第\s*)?([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(幕|卷)\s*[：:.\-、·]?\s*(.+?)(?:\*\*)?$/i);

      if (partMatch?.[3]) {
        const partType = partMatch[2] === "卷" ? "volume" : "act";
        const partIndex = normalizeWritingChapterIndex(partMatch[1], parts.length);
        currentPart = {
          id: createLocalId("writing_part"),
          type: partType,
          index: partIndex,
          title: normalizeWritingChapterPlanTitle(partMatch[3]),
          description: ""
        };
        parts.push(currentPart);
        current = null;
        return;
      }

      const titleMatch = line.match(
        /^(?:\*\*)?\s*(?:第\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*章|chapter\s*(\d+)|(\d+)[.、])\s*[：:.\-、]?\s*(.+?)(?:\*\*)?$/i
      );

      if (titleMatch?.[4]) {
        const chapterIndex = titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? chapters.length + 1;
        const titleLine = `第${chapterIndex}章 ${titleMatch[4]}`;
        const { index, title, summary } = splitWritingChapterTitleAndSummary(titleLine, chapters.length);

        if (title) {
          current = { index, ...(currentPart?.index ? { partIndex: currentPart.index } : {}), title, summary };
          chapters.push(current);
        }

        return;
      }

      if (!current) {
        if (currentPart) {
          const descriptionMatch = line.match(/^(?:简介|描述|概述|本幕目标|本卷目标|目标|主要冲突|阶段高潮|转折作用)\s*[：:]\s*(.+)$/);
          const descriptionText = descriptionMatch?.[1]?.trim() || line;

          if (descriptionText && !/^```/.test(descriptionText)) {
            currentPart.description = [currentPart.description, descriptionText].filter(Boolean).join("\n");
          }
        }

        return;
      }

      const summaryMatch = line.match(/^(?:简介|摘要|梗概|章节简介|本章目标|目标|主要冲突|信息增量|伏笔|结尾钩子)\s*[：:]\s*(.+)$/);
      const summaryText = summaryMatch?.[1]?.trim() || line;

      if (summaryText && !/^```/.test(summaryText)) {
        current.summary = [current.summary, summaryText].filter(Boolean).join("\n");
      }
    });

  const normalizedParts = parts
    .map((part, index) => normalizeWritingBookPart(part, index, "writing_book"))
    .filter((part) => part.title);
  const normalizedChapters = chapters
    .map((chapter, index) => ({
      index: normalizeWritingChapterIndex(chapter.index, index),
      ...(chapter.partIndex ? { partIndex: normalizeWritingChapterIndex(chapter.partIndex, 0) } : {}),
      title: normalizeWritingChapterPlanTitle(chapter.title),
      summary: normalizeWritingChapterPlanSummary(chapter.summary)
    }))
    .filter((chapter) => chapter.title);

  return { parts: normalizedParts, chapters: normalizedChapters };
}

function parseWritingChaptersFromAssistantOutput(value) {
  const jsonPlan = parseWritingChapterJsonPayload(value);
  return jsonPlan.chapters.length ? jsonPlan : parseWritingChapterMarkdownPayload(value);
}

function buildWritingChapterFromPlan(plan, existingChapter = null, fallbackIndex = 0) {
  const now = new Date().toISOString();
  const chapterIndex = normalizeWritingChapterIndex(plan.index ?? existingChapter?.index, fallbackIndex);
  const title = splitWritingChapterTitlePrefix(plan.title).title || `未命名章节 ${chapterIndex}`;

  return {
    id: existingChapter?.id ?? createLocalId("writing_chapter"),
    index: chapterIndex,
    ...(plan.partIndex ? { partIndex: normalizeWritingChapterIndex(plan.partIndex, 0) } : existingChapter?.partIndex ? { partIndex: existingChapter.partIndex } : {}),
    title,
    summary: plan.summary,
    content: existingChapter?.content ?? "",
    status: existingChapter?.status ?? "todo",
    updatedAt: now,
    ...(existingChapter?.fileName ? { fileName: existingChapter.fileName } : {})
  };
}

async function applyWritingChapterPlanOutput(book, output, mode = "append") {
  const outlinePlan = parseWritingChaptersFromAssistantOutput(output);
  const plans = outlinePlan.chapters;
  const currentTaskId = activeWritingTask.value?.id ?? "";

  if (!plans.length) {
    if (currentTaskId === "structure") {
      setWritingFeedback("未识别到可落盘的章节 JSON，请重新生成或让 AI 按提示词输出 chapters。", "warning");
      return true;
    }

    return false;
  }

  const existingChapters = getWritingChapters(book);
  const existingByTitle = new Map(
    existingChapters.map((chapter) => [normalizeWritingChapterTitleForMatch(chapter.title), chapter]).filter(([title]) => Boolean(title))
  );
  const existingTitleKeys = new Set(existingByTitle.keys());
  const nextChapters =
    mode === "replace"
      ? plans.map((plan, index) => buildWritingChapterFromPlan(plan, existingByTitle.get(normalizeWritingChapterTitleForMatch(plan.title)) ?? null, index))
      : [
          ...existingChapters,
          ...plans
            .filter((plan) => !existingTitleKeys.has(normalizeWritingChapterTitleForMatch(plan.title)))
            .map((plan, index) => buildWritingChapterFromPlan(plan, null, existingChapters.length + index))
        ];

  if (mode === "append" && nextChapters.length === existingChapters.length) {
    setWritingFeedback("生成目录里的章节已存在，没有新增章节。", "warning");
    return true;
  }

  const existingParts = getWritingBookParts(book);
  const existingPartsByIndex = new Map(existingParts.map((part) => [part.index, part]));

  if (mode === "replace") {
    book.parts = outlinePlan.parts.map((part, index) => ({
      ...normalizeWritingBookPart(part, index, book.id),
      id: existingPartsByIndex.get(part.index)?.id ?? part.id
    }));
  } else if (outlinePlan.parts.length) {
    const existingPartIndexes = new Set(existingParts.map((part) => part.index));
    book.parts = [
      ...existingParts,
      ...outlinePlan.parts
        .filter((part) => !existingPartIndexes.has(part.index))
        .map((part, index) => normalizeWritingBookPart(part, existingParts.length + index, book.id))
    ].sort((left, right) => left.index - right.index);
  }

  book.chapters = nextChapters;
  selectWritingChapter(nextChapters[0]?.id ?? "");
  touchWritingBook(book, { persist: false });
  await persistWritingBookById(book.id, { silent: true });
  setWritingFeedback(mode === "replace" ? `已替换为 ${plans.length} 个章节，并写入本地目录。` : `已追加 ${nextChapters.length - existingChapters.length} 个章节，并写入本地目录。`, "success");
  setStatus("书籍目录已写入本地 chapters.json。", "success");
  return true;
}

async function applyWritingAssistantOutput(mode = "append") {
  const book = activeWritingBook.value;
  const output =
    ui.marketplace.writing.activeTab === "chapter"
      ? normalizeWritingChapterDraftOutput(ui.marketplace.writing.aiOutput ?? "")
      : String(ui.marketplace.writing.aiOutput ?? "").trim();

  if (!output || !book) {
    setWritingFeedback("当前没有可写入的 AI 输出。", "warning");
    return;
  }

  if (ui.marketplace.writing.activeTab === "chapter") {
    if (activeWritingTask.value?.id === "review") {
      setWritingFeedback("章节质检结果仅用于审阅，不自动写入正文。", "warning");
      return;
    }

    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    const current = String(chapter?.content ?? "").trim();
    setWritingChapterContent(chapter, mode === "replace" ? output : [current, output].filter(Boolean).join("\n\n"));
  } else if (ui.marketplace.writing.activeTab === "outline") {
    if (await applyWritingChapterPlanOutput(book, output, mode)) {
      return;
    }

    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    const current = String(chapter?.summary ?? "").trim();
    setWritingChapterSummary(chapter, mode === "replace" ? output : [current, output].filter(Boolean).join("\n\n"));
  } else {
    const targetKey = book.length === "short" ? "intro" : book.length === "long" ? "seriesPlan" : "outlineGuide";
    const current = getWritingIntroFieldValue(book, targetKey).trim();
    setWritingIntroField(book, targetKey, mode === "replace" ? output : [current, output].filter(Boolean).join("\n\n"));
  }

  setWritingFeedback(mode === "replace" ? "已用 AI 输出替换当前模块。" : "已把 AI 输出追加到当前模块。", "success");
}

  return {
    activeWritingLongOutlineRequest,
    activeWritingPromptPreview,
    applyWritingAssistantOutput,
    applyWritingChapterPlanOutput,
    buildWritingAssistantPrompt,
    buildWritingChapterFromPlan,
    buildWritingChapterMemoryLine,
    buildWritingLongOutlineBatchPrompt,
    buildWritingLongOutlineMasterPrompt,
    buildWritingLongOutlineSeedContent,
    buildWritingLongOutlineTargetContent,
    buildWritingPartsContext,
    buildWritingRecentChapterContext,
    buildWritingStoryMemoryContext,
    canResumeWritingOutlinePlanner,
    cancelWritingOutlinePlanningJob,
    countWritingGeneratedTargetChapters,
    createWritingAbortError,
    createWritingOutlinePlannerJob,
    generateWritingAssistantOutput,
    generateWritingLongOutlinePlan,
    getLastCompletedWritingChapterIndex,
    getNextMissingWritingChapterIndex,
    getWritingAiRunButtonLabel,
    getWritingAssistantMaxOutputTokens,
    getWritingBusyDescription,
    getWritingBusyTitle,
    getWritingErrorMessage,
    getWritingLongOutlineRequest,
    getWritingLongOutlineRequestFromJob,
    getWritingMasterSystemPrompt,
    getWritingOutlinePlannerProgressCopy,
    getWritingOutlinePlannerProgressPercent,
    getWritingOutlinePlannerRetryCopy,
    getWritingOutlinePlannerStatusClass,
    getWritingOutlinePlannerStatusLabel,
    getWritingRetryDelayMs,
    getWritingTaskPromptSpec,
    invokeWritingAssistantModel,
    isRetryableWritingAssistantError,
    isSameWritingLongOutlineRequest,
    isWritingAssistantAbortError,
    isWritingOutlinePlannerRunning,
    mergeWritingChapterPlanBatch,
    normalizeWritingChapterPlanEntry,
    normalizeWritingChapterPlanSummary,
    normalizeWritingChapterPlanTitle,
    normalizeWritingChapterTitleForMatch,
    normalizeWritingLongBatchPlans,
    normalizeWritingPartPlanEntry,
    parseWritingChapterJsonPayload,
    parseWritingChapterMarkdownPayload,
    parseWritingChaptersFromAssistantOutput,
    parseWritingInstructionChapterRange,
    parseWritingInstructionPartCount,
    resumeWritingOutlinePlanningJob,
    shouldIgnoreExistingWritingOutline,
    splitWritingChapterTitleAndSummary,
    updateWritingOutlinePlannerJob,
    waitWritingRetryDelay
  };
}
