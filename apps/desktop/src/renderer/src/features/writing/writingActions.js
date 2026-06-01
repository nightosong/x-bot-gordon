import { computed } from "vue";

import {
  WRITING_AI_PHASES,
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

const BEIJING_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
const EMPTY_TITLE_RESTORE_DELAY = 10000;

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
  const writingTitleBaselines = new Map();
  const writingTitleRestoreTimers = new Map();
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
const activeWritingExtraIntroSections = computed(() => activeWritingBook.value?.extraIntroSections ?? []);
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
const activeWritingSelectedTaskOption = computed(
  () => activeWritingTaskOptions.value.find((task) => task.id === ui.marketplace.writing.aiTaskId) ?? null
);
const activeWritingPhaseOptions = computed(() => getWritingPhaseOptionsForTab(ui.marketplace.writing.activeTab));
const activeWritingPhaseId = computed(() =>
  getWritingActivePhaseId(ui.marketplace.writing.activeTab, ui.marketplace.writing.aiPhaseId, activeWritingSelectedTaskOption.value)
);
const activeWritingPhaseTaskOptions = computed(() =>
  activeWritingTaskOptions.value.filter((task) => normalizeWritingTaskPhase(task) === activeWritingPhaseId.value)
);
const activeWritingTask = computed(
  () =>
    activeWritingSelectedTaskOption.value ??
    activeWritingPhaseTaskOptions.value[0] ??
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

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[,\n，、]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStringList(...lists) {
  const seen = new Set();
  const result = [];

  lists.flat().forEach((item) => {
    const text = String(item ?? "").trim();
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(text);
  });

  return result;
}

function normalizeWritingStoryAssetKey(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeWritingTaskPhase(task) {
  const phaseId = String(task?.phase ?? "").trim();
  return WRITING_AI_PHASES.some((phase) => phase.id === phaseId) ? phaseId : "foundation";
}

function getWritingPhaseOptionsForTab(tabId) {
  const tasks = WRITING_AI_TASKS[tabId] ?? WRITING_AI_TASKS.intro;
  const phaseIds = new Set(tasks.map((task) => normalizeWritingTaskPhase(task)));
  return WRITING_AI_PHASES.filter((phase) => phaseIds.has(phase.id));
}

function getWritingDefaultPhaseIdForTab(tabId) {
  const tasks = WRITING_AI_TASKS[tabId] ?? WRITING_AI_TASKS.intro;
  return normalizeWritingTaskPhase(tasks[0]);
}

function getWritingActivePhaseId(tabId, phaseId, task = null) {
  const options = getWritingPhaseOptionsForTab(tabId);
  const optionIds = new Set(options.map((phase) => phase.id));
  const taskPhaseId = task ? normalizeWritingTaskPhase(task) : "";

  if (taskPhaseId && optionIds.has(taskPhaseId)) {
    return taskPhaseId;
  }

  return optionIds.has(phaseId) ? phaseId : options[0]?.id ?? getWritingDefaultPhaseIdForTab(tabId);
}

function normalizeOptionalStoryChapterIndex(value) {
  return value === null || value === undefined || value === "" ? undefined : normalizeWritingChapterIndex(value, 0);
}

function normalizeWritingStoryAssetEntry(entry, index = 0, bookId = "writing_book", group = "asset") {
  const source = entry && typeof entry === "object" ? entry : {};
  const title = String(source.title ?? source.name ?? source.key ?? "").trim();
  const detail = String(source.detail ?? source.description ?? source.summary ?? source.value ?? "").trim();
  const chapterIndex = normalizeOptionalStoryChapterIndex(source.chapterIndex ?? source.chapter);

  if (!title && !detail) {
    return null;
  }

  return {
    id: String(source.id ?? "").trim() || `${bookId}_${group}_${index + 1}`,
    title: title || `未命名${group} ${index + 1}`,
    detail,
    tags: normalizeStringList(source.tags),
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(source.status ? { status: String(source.status) } : {}),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingStoryAssetEntries(entries = [], bookId = "writing_book", group = "asset") {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => normalizeWritingStoryAssetEntry(entry, index, bookId, group))
    .filter(Boolean);
}

function normalizeWritingCharacterAsset(entry, index = 0, bookId = "writing_book") {
  const source = entry && typeof entry === "object" ? entry : {};
  const name = String(source.name ?? source.title ?? "").trim();

  if (
    !name &&
    !source.role &&
    !source.goal &&
    !source.fear &&
    !source.secret &&
    !source.growthArc &&
    !source.growth_arc &&
    !normalizeStringList(source.relationships).length
  ) {
    return null;
  }

  return {
    id: String(source.id ?? "").trim() || `${bookId}_character_${index + 1}`,
    name: name || `未命名人物 ${index + 1}`,
    role: String(source.role ?? "").trim(),
    goal: String(source.goal ?? "").trim(),
    fear: String(source.fear ?? "").trim(),
    secret: String(source.secret ?? "").trim(),
    growthArc: String(source.growthArc ?? source.growth_arc ?? "").trim(),
    relationships: normalizeStringList(source.relationships),
    tags: normalizeStringList(source.tags),
    status: String(source.status ?? "active"),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingCharacterAssets(entries = [], bookId = "writing_book") {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => normalizeWritingCharacterAsset(entry, index, bookId))
    .filter(Boolean);
}

function normalizeWritingForeshadowAsset(entry, index = 0, bookId = "writing_book") {
  const source = entry && typeof entry === "object" ? entry : {};
  const title = String(source.title ?? source.name ?? "").trim();
  const setup = String(source.setup ?? source.detail ?? "").trim();
  const payoff = String(source.payoff ?? source.plannedPayoff ?? source.payoffPlan ?? "").trim();
  const chapterIndex = normalizeOptionalStoryChapterIndex(source.chapterIndex ?? source.setupChapterIndex);
  const payoffChapterIndex = normalizeOptionalStoryChapterIndex(source.payoffChapterIndex);

  if (!title && !setup && !payoff) {
    return null;
  }

  return {
    id: String(source.id ?? "").trim() || `${bookId}_foreshadow_${index + 1}`,
    title: title || setup || `未命名伏笔 ${index + 1}`,
    setup,
    payoff,
    status: String(source.status ?? "open"),
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(payoffChapterIndex ? { payoffChapterIndex } : {}),
    tags: normalizeStringList(source.tags),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingForeshadowAssets(entries = [], bookId = "writing_book") {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => normalizeWritingForeshadowAsset(entry, index, bookId))
    .filter(Boolean);
}

function normalizeWritingStyleProfileForUi(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  const pacingCurve = normalizeStringList(source.pacingCurve);

  return {
    voice: String(source.voice ?? "").trim(),
    pacing: String(source.pacing ?? "").trim(),
    genreSignals: normalizeStringList(source.genreSignals),
    taboos: normalizeStringList(source.taboos),
    ...(source.proseDensity ? { proseDensity: String(source.proseDensity).trim() } : {}),
    ...(source.dialogueRatio ? { dialogueRatio: String(source.dialogueRatio).trim() } : {}),
    ...(source.narrationDistance ? { narrationDistance: String(source.narrationDistance).trim() } : {}),
    ...(source.emotionalTemperature ? { emotionalTemperature: String(source.emotionalTemperature).trim() } : {}),
    ...(source.humorLevel ? { humorLevel: String(source.humorLevel).trim() } : {}),
    ...(source.violenceExplicitness ? { violenceExplicitness: String(source.violenceExplicitness).trim() } : {}),
    ...(pacingCurve.length ? { pacingCurve } : {})
  };
}

function normalizeWritingStoryAssetsForUi(assets = {}, bookId = "writing_book") {
  const source = assets && typeof assets === "object" ? assets : {};

  return {
    premise: String(source.premise ?? "").trim(),
    worldview: normalizeWritingStoryAssetEntries(source.worldview, bookId, "worldview"),
    characters: normalizeWritingCharacterAssets(source.characters, bookId),
    relationships: normalizeWritingStoryAssetEntries(source.relationships, bookId, "relationship"),
    timeline: normalizeWritingStoryAssetEntries(source.timeline, bookId, "timeline"),
    foreshadows: normalizeWritingForeshadowAssets(source.foreshadows, bookId),
    rules: normalizeWritingStoryAssetEntries(source.rules, bookId, "rule"),
    styleProfile: normalizeWritingStyleProfileForUi(source.styleProfile),
    memoryNotes: normalizeWritingStoryAssetEntries(source.memoryNotes, bookId, "memory"),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

const WRITING_NARRATIVE_STATE_NODE_KINDS = new Set([
  "character",
  "worldRule",
  "resource",
  "region",
  "foreshadow",
  "arc",
  "timelineEvent",
  "continuityWarning",
  "planDrift"
]);
const WRITING_NARRATIVE_RISK_LEVELS = new Set(["low", "medium", "high"]);

function normalizeWritingNarrativeStateNodeKind(value, fallback = "arc") {
  const kind = String(value ?? "").trim();
  return WRITING_NARRATIVE_STATE_NODE_KINDS.has(kind) ? kind : fallback;
}

function normalizeWritingNarrativeRiskLevel(value) {
  const level = String(value ?? "").trim();
  return WRITING_NARRATIVE_RISK_LEVELS.has(level) ? level : "low";
}

function normalizeWritingNarrativeStateNode(entry, index = 0, bookId = "writing_book", kind = "arc") {
  const source = entry && typeof entry === "object" ? entry : {};
  const label = String(source.label ?? source.title ?? source.name ?? "").trim();
  const summary = String(source.summary ?? source.detail ?? source.description ?? source.setup ?? "").trim();
  const introducedAtChapterIndex = normalizeOptionalStoryChapterIndex(source.introducedAtChapterIndex ?? source.chapterIndex);
  const payoffDeadlineChapterIndex = normalizeOptionalStoryChapterIndex(source.payoffDeadlineChapterIndex);
  const resolvedAtChapterIndex = normalizeOptionalStoryChapterIndex(source.resolvedAtChapterIndex);

  if (!label && !summary) {
    return null;
  }

  return {
    id: String(source.id ?? "").trim() || `${bookId}_${kind}_${index + 1}`,
    kind: normalizeWritingNarrativeStateNodeKind(source.kind, kind),
    label: label || `未命名${kind} ${index + 1}`,
    summary,
    status: String(source.status ?? "active").trim() || "active",
    ...(introducedAtChapterIndex ? { introducedAtChapterIndex } : {}),
    ...(payoffDeadlineChapterIndex ? { payoffDeadlineChapterIndex } : {}),
    ...(resolvedAtChapterIndex ? { resolvedAtChapterIndex } : {}),
    evidenceChapterIds: normalizeStringList(source.evidenceChapterIds),
    relatedNodeIds: normalizeStringList(source.relatedNodeIds),
    riskLevel: normalizeWritingNarrativeRiskLevel(source.riskLevel),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingNarrativeStateNodeList(entries = [], bookId = "writing_book", kind = "arc") {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => normalizeWritingNarrativeStateNode(entry, index, bookId, kind))
    .filter(Boolean);
}

function hasWritingNarrativeStateContent(state = {}) {
  if (!state || typeof state !== "object") {
    return false;
  }

  return [
    state.characters,
    state.worldRules,
    state.resources,
    state.regions,
    state.foreshadows,
    state.arcs,
    state.timelineEvents,
    state.continuityWarnings,
    state.planDriftNotes
  ].some((entries) => Array.isArray(entries) && entries.length > 0);
}

function dedupeWritingNarrativeStateNodes(entries = []) {
  const seen = new Set();
  const result = [];

  entries.forEach((entry) => {
    const key = normalizeWritingStoryAssetKey(entry.id || entry.label);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(entry);
  });

  return result;
}

function deriveWritingNarrativeStateFromStoryAssets(assets = {}, bookId = "writing_book") {
  const normalizedAssets = normalizeWritingStoryAssetsForUi(assets, bookId);
  const now = String(normalizedAssets.updatedAt ?? new Date().toISOString());
  const makeNode = (kind, label, summary, index, options = {}) => ({
    id: String(options.id ?? `${bookId}_${kind}_${index + 1}`),
    kind,
    label: label || `未命名${kind} ${index + 1}`,
    summary: String(summary ?? "").trim(),
    status: String(options.status ?? "active"),
    ...(options.introducedAtChapterIndex ? { introducedAtChapterIndex: options.introducedAtChapterIndex } : {}),
    ...(options.payoffDeadlineChapterIndex ? { payoffDeadlineChapterIndex: options.payoffDeadlineChapterIndex } : {}),
    ...(options.resolvedAtChapterIndex ? { resolvedAtChapterIndex: options.resolvedAtChapterIndex } : {}),
    evidenceChapterIds: normalizeStringList(options.evidenceChapterIds),
    relatedNodeIds: normalizeStringList(options.relatedNodeIds),
    riskLevel: normalizeWritingNarrativeRiskLevel(options.riskLevel),
    updatedAt: String(options.updatedAt ?? now)
  });

  const memoryResourcePattern = /资源|物件|伤痕|债务|权限|名声|证据/;
  const regionPattern = /地区|区域|地点|城|域|地图/;

  return {
    characters: normalizedAssets.characters.map((character, index) =>
      makeNode(
        "character",
        character.name,
        [
          character.role ? `身份：${character.role}` : "",
          character.goal ? `目标：${character.goal}` : "",
          character.growthArc ? `弧线：${character.growthArc}` : "",
          character.relationships?.length ? `关系：${character.relationships.join("；")}` : ""
        ].filter(Boolean).join(" / "),
        index,
        { id: character.id, status: character.status, updatedAt: character.updatedAt }
      )
    ),
    worldRules: [...normalizedAssets.rules, ...normalizedAssets.worldview].map((entry, index) =>
      makeNode("worldRule", entry.title, entry.detail, index, {
        id: entry.id,
        status: entry.status ?? "active",
        introducedAtChapterIndex: entry.chapterIndex,
        updatedAt: entry.updatedAt
      })
    ),
    resources: normalizedAssets.memoryNotes
      .filter((entry) => (entry.tags ?? []).some((tag) => memoryResourcePattern.test(tag)) || memoryResourcePattern.test(`${entry.title}${entry.detail}`))
      .map((entry, index) =>
        makeNode("resource", entry.title, entry.detail, index, {
          id: entry.id,
          status: entry.status ?? "active",
          introducedAtChapterIndex: entry.chapterIndex,
          updatedAt: entry.updatedAt
        })
      ),
    regions: normalizedAssets.worldview
      .filter((entry) => (entry.tags ?? []).some((tag) => regionPattern.test(tag)) || regionPattern.test(`${entry.title}${entry.detail}`))
      .map((entry, index) =>
        makeNode("region", entry.title, entry.detail, index, {
          id: `${entry.id}_region`,
          status: entry.status ?? "active",
          introducedAtChapterIndex: entry.chapterIndex,
          updatedAt: entry.updatedAt
        })
      ),
    foreshadows: normalizedAssets.foreshadows.map((entry, index) =>
      makeNode("foreshadow", entry.title, [entry.setup, entry.payoff ? `回收计划：${entry.payoff}` : ""].filter(Boolean).join(" / "), index, {
        id: entry.id,
        status: entry.status,
        introducedAtChapterIndex: entry.chapterIndex,
        payoffDeadlineChapterIndex: entry.payoffChapterIndex,
        riskLevel: entry.status === "open" ? "medium" : "low",
        updatedAt: entry.updatedAt
      })
    ),
    arcs: normalizedAssets.characters
      .filter((character) => character.growthArc)
      .map((character, index) =>
        makeNode("arc", `${character.name}：成长弧`, character.growthArc, index, {
          id: `${character.id}_arc`,
          relatedNodeIds: [character.id],
          status: character.status,
          updatedAt: character.updatedAt
        })
      ),
    timelineEvents: normalizedAssets.timeline.map((entry, index) =>
      makeNode("timelineEvent", entry.title, entry.detail, index, {
        id: entry.id,
        status: entry.status ?? "active",
        introducedAtChapterIndex: entry.chapterIndex,
        updatedAt: entry.updatedAt
      })
    ),
    continuityWarnings: [],
    planDriftNotes: [],
    updatedAt: now
  };
}

function normalizeWritingNarrativeStateForUi(state = {}, storyAssets = {}, bookId = "writing_book") {
  const source = state && typeof state === "object" ? state : {};

  if (!hasWritingNarrativeStateContent(source)) {
    return deriveWritingNarrativeStateFromStoryAssets(storyAssets, bookId);
  }

  return {
    characters: normalizeWritingNarrativeStateNodeList(source.characters, bookId, "character"),
    worldRules: normalizeWritingNarrativeStateNodeList(source.worldRules, bookId, "worldRule"),
    resources: normalizeWritingNarrativeStateNodeList(source.resources, bookId, "resource"),
    regions: normalizeWritingNarrativeStateNodeList(source.regions, bookId, "region"),
    foreshadows: normalizeWritingNarrativeStateNodeList(source.foreshadows, bookId, "foreshadow"),
    arcs: normalizeWritingNarrativeStateNodeList(source.arcs, bookId, "arc"),
    timelineEvents: normalizeWritingNarrativeStateNodeList(source.timelineEvents, bookId, "timelineEvent"),
    continuityWarnings: normalizeWritingNarrativeStateNodeList(source.continuityWarnings, bookId, "continuityWarning"),
    planDriftNotes: normalizeWritingNarrativeStateNodeList(source.planDriftNotes, bookId, "planDrift"),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
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

function normalizeWritingBookExtraIntroSectionForUi(section, index = 0, bookId = "writing_book") {
  const source = section && typeof section === "object" ? section : {};
  const title = String(source.title ?? source.label ?? "").trim();
  const content = String(source.content ?? source.value ?? "");

  if (!title && !content.trim()) {
    return null;
  }

  return {
    id: String(source.id ?? "").trim() || `${bookId}_intro_section_${index + 1}`,
    title: title || `补充设定 ${index + 1}`,
    content,
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingBookExtraIntroSectionsForUi(sections = [], bookId = "writing_book") {
  return (Array.isArray(sections) ? sections : [])
    .map((section, index) => normalizeWritingBookExtraIntroSectionForUi(section, index, bookId))
    .filter(Boolean);
}

function normalizeWritingBookForUi(book, index = 0) {
  const now = new Date().toISOString();
  const bookId = String(book?.id ?? "").trim() || createLocalId("writing_book");
  const legacyDetailedOutline = String(book?.seriesPlan ?? "").trim();
  const storyAssets = normalizeWritingStoryAssetsForUi(book?.storyAssets, bookId);
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
    outlineGuide: legacyDetailedOutline || String(book?.outlineGuide ?? ""),
    seriesPlan: "",
    extraIntroSections: normalizeWritingBookExtraIntroSectionsForUi(book?.extraIntroSections, bookId),
    directoryName: typeof book?.directoryName === "string" ? book.directoryName : undefined,
    parts: normalizeWritingBookPartsForUi(book?.parts, bookId),
    storyAssets,
    narrativeState: normalizeWritingNarrativeStateForUi(book?.narrativeState, storyAssets, bookId),
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

function markWritingBookDraftChange(book) {
  if (book?.id) {
    writingBookSaveVersions.set(book.id, (writingBookSaveVersions.get(book.id) ?? 0) + 1);
  }
}

function getWritingBookTitleKey(bookId) {
  return `book-title:${String(bookId ?? "").trim()}`;
}

function getWritingExtraIntroSectionTitleKey(bookId, sectionId) {
  return `extra-title:${String(bookId ?? "").trim()}:${String(sectionId ?? "").trim()}`;
}

function rememberWritingTitleBaseline(key, value) {
  const baseline = String(value ?? "").trim();

  if (key && baseline) {
    writingTitleBaselines.set(key, baseline);
  }
}

function clearWritingTitleRestoreTimer(key) {
  const timer = writingTitleRestoreTimers.get(key);

  if (timer) {
    clearTimeout(timer);
    writingTitleRestoreTimers.delete(key);
  }
}

function scheduleWritingEmptyTitleRestore(key, fallbackValue, restore) {
  const fallback = writingTitleBaselines.get(key) ?? String(fallbackValue ?? "").trim();

  clearWritingTitleRestoreTimer(key);

  if (!key || !fallback) {
    return;
  }

  const timer = setTimeout(() => {
    writingTitleRestoreTimers.delete(key);
    writingTitleBaselines.delete(key);
    restore(fallback);
  }, EMPTY_TITLE_RESTORE_DELAY);

  writingTitleRestoreTimers.set(key, timer);
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

  const nextTitle = String(value ?? "");
  const previousTitle = String(book.title ?? "");
  const titleKey = getWritingBookTitleKey(book.id);

  if (!nextTitle.trim()) {
    book.title = nextTitle;
    clearWritingAutosaveTimer();
    markWritingBookDraftChange(book);
    scheduleWritingEmptyTitleRestore(titleKey, previousTitle, (fallback) => {
      const targetBook = writingBooks.value.find((entry) => entry.id === book.id);

      if (!targetBook || String(targetBook.title ?? "").trim()) {
        return;
      }

      targetBook.title = fallback;
      touchWritingBook(targetBook);
    });
    return;
  }

  clearWritingTitleRestoreTimer(titleKey);
  book.title = nextTitle;
  touchWritingBook(book);
}

function rememberWritingBookTitleBaseline() {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  rememberWritingTitleBaseline(getWritingBookTitleKey(book.id), book.title);
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
    return [WRITING_INTRO_SECTION_DEFINITIONS.intro, WRITING_INTRO_SECTION_DEFINITIONS.outlineGuide];
  }

  if (book?.length === "medium") {
    return [WRITING_INTRO_SECTION_DEFINITIONS.intro, WRITING_INTRO_SECTION_DEFINITIONS.outlineGuide];
  }

  return [WRITING_INTRO_SECTION_DEFINITIONS.intro];
}

function getWritingIntroFieldValue(book, key) {
  return String(book?.[key] ?? "");
}

function getWritingIntroFieldWordCount(book, key) {
  return getWritingIntroFieldValue(book, key).replace(/\s+/g, "").length;
}

function setWritingIntroField(book, key, value) {
  if (!book || !WRITING_INTRO_SECTION_DEFINITIONS[key]) {
    return;
  }

  book[key] = String(value ?? "");
  touchWritingBook(book);
}

function getWritingExtraIntroSectionWordCount(section) {
  return String(section?.content ?? "").replace(/\s+/g, "").length;
}

function getWritingIntroCollapseIds() {
  if (!Array.isArray(ui.marketplace.writing.collapsedIntroSectionIds)) {
    ui.marketplace.writing.collapsedIntroSectionIds = [];
  }

  return ui.marketplace.writing.collapsedIntroSectionIds;
}

function getWritingIntroSectionCollapseId(sectionKey, type = "base") {
  return `${type}:${String(sectionKey ?? "").trim()}`;
}

function isWritingIntroSectionCollapsed(sectionKey, type = "base") {
  const collapseId = getWritingIntroSectionCollapseId(sectionKey, type);
  return getWritingIntroCollapseIds().includes(collapseId);
}

function toggleWritingIntroSectionCollapsed(sectionKey, type = "base") {
  const collapseId = getWritingIntroSectionCollapseId(sectionKey, type);
  const collapsedIds = getWritingIntroCollapseIds();

  if (collapsedIds.includes(collapseId)) {
    ui.marketplace.writing.collapsedIntroSectionIds = collapsedIds.filter((id) => id !== collapseId);
    return;
  }

  ui.marketplace.writing.collapsedIntroSectionIds = [...collapsedIds, collapseId];
}

function addWritingExtraIntroSection() {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  const extraSections = Array.isArray(book.extraIntroSections) ? book.extraIntroSections : [];
  const section = {
    id: createLocalId("writing_intro_section"),
    title: `补充设定 ${extraSections.length + 1}`,
    content: "",
    updatedAt: new Date().toISOString()
  };

  book.extraIntroSections = [...extraSections, section];
  ui.marketplace.writing.collapsedIntroSectionIds = getWritingIntroCollapseIds().filter(
    (id) => id !== getWritingIntroSectionCollapseId(section.id, "extra")
  );
  touchWritingBook(book);
}

function setWritingExtraIntroSectionTitle(sectionId, value) {
  const book = activeWritingBook.value;
  const section = (book?.extraIntroSections ?? []).find((entry) => entry.id === sectionId);

  if (!book || !section) {
    return;
  }

  const nextTitle = String(value ?? "");
  const previousTitle = String(section.title ?? "");
  const titleKey = getWritingExtraIntroSectionTitleKey(book.id, section.id);

  if (!nextTitle.trim()) {
    section.title = nextTitle;
    clearWritingAutosaveTimer();
    markWritingBookDraftChange(book);
    scheduleWritingEmptyTitleRestore(titleKey, previousTitle, (fallback) => {
      const targetBook = writingBooks.value.find((entry) => entry.id === book.id);
      const targetSection = (targetBook?.extraIntroSections ?? []).find((entry) => entry.id === section.id);

      if (!targetBook || !targetSection || String(targetSection.title ?? "").trim()) {
        return;
      }

      targetSection.title = fallback;
      targetSection.updatedAt = new Date().toISOString();
      touchWritingBook(targetBook);
    });
    return;
  }

  clearWritingTitleRestoreTimer(titleKey);
  section.title = nextTitle;
  section.updatedAt = new Date().toISOString();
  touchWritingBook(book);
}

function rememberWritingExtraIntroSectionTitleBaseline(sectionId) {
  const book = activeWritingBook.value;
  const section = (book?.extraIntroSections ?? []).find((entry) => entry.id === sectionId);

  if (!book || !section) {
    return;
  }

  rememberWritingTitleBaseline(getWritingExtraIntroSectionTitleKey(book.id, section.id), section.title);
}

function setWritingExtraIntroSectionContent(sectionId, value) {
  const book = activeWritingBook.value;
  const section = (book?.extraIntroSections ?? []).find((entry) => entry.id === sectionId);

  if (!book || !section) {
    return;
  }

  section.content = String(value ?? "");
  section.updatedAt = new Date().toISOString();
  touchWritingBook(book);
}

async function removeWritingExtraIntroSection(sectionId) {
  const book = activeWritingBook.value;
  const section = (book?.extraIntroSections ?? []).find((entry) => entry.id === sectionId);

  if (!book || !section) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除设定条目",
    message: `确认删除「${section.title || "补充设定"}」吗？`,
    detail: "删除后会从当前书籍的故事介绍中移除。",
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  book.extraIntroSections = (book.extraIntroSections ?? []).filter((entry) => entry.id !== sectionId);
  ui.marketplace.writing.collapsedIntroSectionIds = getWritingIntroCollapseIds().filter(
    (id) => id !== getWritingIntroSectionCollapseId(sectionId, "extra")
  );
  const titleKey = getWritingExtraIntroSectionTitleKey(book.id, sectionId);
  clearWritingTitleRestoreTimer(titleKey);
  writingTitleBaselines.delete(titleKey);
  touchWritingBook(book);
}

function buildWritingIntroContent(book) {
  if (!book) {
    return "";
  }

  const baseSections = getWritingIntroSections(book)
    .map((section) => {
      const value = getWritingIntroFieldValue(book, section.key).trim();
      return value ? `【${section.label}】\n${value}` : "";
    })
    .filter(Boolean);
  const extraSections = (book.extraIntroSections ?? [])
    .map((section) => {
      const title = String(section?.title ?? "").trim() || "补充设定";
      const content = String(section?.content ?? "").trim();
      return content ? `【${title}】\n${content}` : "";
    })
    .filter(Boolean);

  return [...baseSections, ...extraSections].join("\n\n");
}

function truncateWritingStoryAssetText(value, maxLength = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function buildWritingStoryAssetEntryLines(entries = []) {
  return entries
    .map((entry) => {
      const tags = entry.tags?.length ? ` / ${entry.tags.join("、")}` : "";
      const status = entry.status ? ` / ${entry.status}` : "";
      const chapter = entry.chapterIndex ? ` / 第${entry.chapterIndex}章` : "";
      const detail = truncateWritingStoryAssetText(entry.detail);
      return `- ${entry.title}${chapter}${status}${tags}${detail ? `：${detail}` : ""}`;
    })
    .join("\n");
}

function buildWritingCharacterAssetLines(characters = []) {
  return characters
    .map((character) => {
      const facts = [
        character.role ? `身份：${character.role}` : "",
        character.goal ? `目标：${character.goal}` : "",
        character.fear ? `恐惧：${character.fear}` : "",
        character.secret ? `秘密：${character.secret}` : "",
        character.growthArc ? `成长线：${character.growthArc}` : "",
        character.relationships?.length ? `关系：${character.relationships.join("；")}` : ""
      ].filter(Boolean);
      return `- ${character.name}${facts.length ? ` / ${facts.join(" / ")}` : ""}`;
    })
    .join("\n");
}

function buildWritingForeshadowAssetLines(foreshadows = []) {
  return foreshadows
    .map((foreshadow) => {
      const setupChapter = foreshadow.chapterIndex ? ` / 埋设：第${foreshadow.chapterIndex}章` : "";
      const payoffChapter = foreshadow.payoffChapterIndex ? ` / 回收：第${foreshadow.payoffChapterIndex}章` : "";
      return [
        `- ${foreshadow.title}${setupChapter}${payoffChapter} / ${foreshadow.status}`,
        foreshadow.setup ? `  setup：${truncateWritingStoryAssetText(foreshadow.setup)}` : "",
        foreshadow.payoff ? `  payoff：${truncateWritingStoryAssetText(foreshadow.payoff)}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function buildWritingStyleProfileContent(profile = {}) {
  return [
    profile.voice ? `- voice：${profile.voice}` : "",
    profile.pacing ? `- pacing：${profile.pacing}` : "",
    profile.genreSignals?.length ? `- genreSignals：${profile.genreSignals.join("、")}` : "",
    profile.taboos?.length ? `- taboos：${profile.taboos.join("、")}` : "",
    profile.proseDensity ? `- proseDensity：${profile.proseDensity}` : "",
    profile.dialogueRatio ? `- dialogueRatio：${profile.dialogueRatio}` : "",
    profile.narrationDistance ? `- narrationDistance：${profile.narrationDistance}` : "",
    profile.emotionalTemperature ? `- emotionalTemperature：${profile.emotionalTemperature}` : "",
    profile.humorLevel ? `- humorLevel：${profile.humorLevel}` : "",
    profile.violenceExplicitness ? `- violenceExplicitness：${profile.violenceExplicitness}` : "",
    profile.pacingCurve?.length ? `- pacingCurve：${profile.pacingCurve.join(" -> ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildWritingStoryAssetsContent(book) {
  const assets = normalizeWritingStoryAssetsForUi(book?.storyAssets, book?.id ?? "writing_book");
  const sections = [
    assets.premise ? `【故事命题】\n${assets.premise}` : "",
    assets.worldview.length ? `【世界观资产】\n${buildWritingStoryAssetEntryLines(assets.worldview)}` : "",
    assets.rules.length ? `【规则边界】\n${buildWritingStoryAssetEntryLines(assets.rules)}` : "",
    assets.characters.length ? `【人物资产】\n${buildWritingCharacterAssetLines(assets.characters)}` : "",
    assets.relationships.length ? `【关系资产】\n${buildWritingStoryAssetEntryLines(assets.relationships)}` : "",
    assets.timeline.length ? `【时间线】\n${buildWritingStoryAssetEntryLines(assets.timeline)}` : "",
    assets.foreshadows.length ? `【伏笔账本】\n${buildWritingForeshadowAssetLines(assets.foreshadows)}` : "",
    buildWritingStyleProfileContent(assets.styleProfile)
      ? `【风格档案】\n${buildWritingStyleProfileContent(assets.styleProfile)}`
      : "",
    assets.memoryNotes.length ? `【连续性备注】\n${buildWritingStoryAssetEntryLines(assets.memoryNotes)}` : ""
  ].filter(Boolean);

  return sections.length
    ? sections.join("\n\n")
    : "暂无结构化故事资产；本轮如产生必须长期遵守的事实，需要写入 storyAssets。";
}

function buildWritingNarrativeStateNodeLines(nodes = [], maxCount = 8) {
  return nodes
    .slice(0, maxCount)
    .map((node) => {
      const chapter = node.introducedAtChapterIndex ? ` / 第${node.introducedAtChapterIndex}章` : "";
      const deadline = node.payoffDeadlineChapterIndex ? ` / 截止第${node.payoffDeadlineChapterIndex}章` : "";
      const resolved = node.resolvedAtChapterIndex ? ` / 已回收第${node.resolvedAtChapterIndex}章` : "";
      const risk = node.riskLevel && node.riskLevel !== "low" ? ` / ${node.riskLevel}` : "";
      const status = node.status ? ` / ${node.status}` : "";
      return `- ${node.label}${chapter}${deadline}${resolved}${status}${risk}${node.summary ? `：${truncateWritingStoryAssetText(node.summary)}` : ""}`;
    })
    .join("\n");
}

function buildWritingNarrativeStateContent(book) {
  const state = normalizeWritingNarrativeStateForUi(book?.narrativeState, book?.storyAssets, book?.id ?? "writing_book");
  const sections = [
    state.characters.length ? `【人物状态】\n${buildWritingNarrativeStateNodeLines(state.characters)}` : "",
    state.worldRules.length ? `【世界规则】\n${buildWritingNarrativeStateNodeLines(state.worldRules)}` : "",
    state.resources.length ? `【资源与债务】\n${buildWritingNarrativeStateNodeLines(state.resources)}` : "",
    state.regions.length ? `【区域状态】\n${buildWritingNarrativeStateNodeLines(state.regions)}` : "",
    state.foreshadows.length ? `【伏笔压力】\n${buildWritingNarrativeStateNodeLines(state.foreshadows)}` : "",
    state.arcs.length ? `【故事弧】\n${buildWritingNarrativeStateNodeLines(state.arcs)}` : "",
    state.timelineEvents.length ? `【时间线事件】\n${buildWritingNarrativeStateNodeLines(state.timelineEvents)}` : "",
    state.continuityWarnings.length ? `【连续性风险】\n${buildWritingNarrativeStateNodeLines(state.continuityWarnings)}` : "",
    state.planDriftNotes.length ? `【计划漂移】\n${buildWritingNarrativeStateNodeLines(state.planDriftNotes)}` : ""
  ].filter(Boolean);

  return sections.length
    ? sections.join("\n\n")
    : "暂无 Narrative State；本轮如产生长期状态，请沉淀为人物状态、世界规则、资源、区域、伏笔、故事弧、时间线或风险节点。";
}

function getWritingNarrativeStateSummary(book) {
  const state = normalizeWritingNarrativeStateForUi(book?.narrativeState, book?.storyAssets, book?.id ?? "writing_book");
  const riskCount = [...state.continuityWarnings, ...state.planDriftNotes, ...state.foreshadows].filter(
    (node) => node.riskLevel === "medium" || node.riskLevel === "high"
  ).length;

  return [
    { label: "人物", value: state.characters.length },
    { label: "规则", value: state.worldRules.length },
    { label: "伏笔", value: state.foreshadows.length },
    { label: "故事弧", value: state.arcs.length },
    { label: "风险", value: riskCount }
  ];
}

function getWritingNarrativeNodeKindLabel(kind) {
  const labels = {
    character: "人物",
    worldRule: "规则",
    resource: "资源",
    region: "区域",
    foreshadow: "伏笔",
    arc: "故事弧",
    timelineEvent: "时间线",
    continuityWarning: "连续性",
    planDrift: "漂移"
  };

  return labels[kind] ?? "状态";
}

function getWritingNarrativeStatePreview(book, limit = 5) {
  const state = normalizeWritingNarrativeStateForUi(book?.narrativeState, book?.storyAssets, book?.id ?? "writing_book");
  const nodes = [
    ...state.continuityWarnings,
    ...state.planDriftNotes,
    ...state.foreshadows.filter((node) => node.status !== "resolved"),
    ...state.arcs,
    ...state.characters
  ];

  return dedupeWritingNarrativeStateNodes(nodes)
    .slice(0, limit)
    .map((node) => ({
      ...node,
      kindLabel: getWritingNarrativeNodeKindLabel(node.kind),
      summary: truncateWritingStoryAssetText(node.summary, 96)
    }));
}

function mergeWritingStoryAssetEntries(existingEntries = [], incomingEntries = [], bookId = "writing_book", group = "asset") {
  const existing = normalizeWritingStoryAssetEntries(existingEntries, bookId, group);
  const incoming = normalizeWritingStoryAssetEntries(incomingEntries, bookId, group);
  const existingByKey = new Map(existing.map((entry) => [normalizeWritingStoryAssetKey(entry.title), entry]));

  incoming.forEach((entry) => {
    const key = normalizeWritingStoryAssetKey(entry.title || entry.detail);
    const current = existingByKey.get(key);

    if (!key) {
      return;
    }

    if (!current) {
      existingByKey.set(key, entry);
      return;
    }

    existingByKey.set(key, {
      ...current,
      title: entry.title || current.title,
      detail: entry.detail || current.detail,
      tags: uniqueStringList(current.tags, entry.tags),
      chapterIndex: entry.chapterIndex ?? current.chapterIndex,
      status: entry.status || current.status,
      updatedAt: new Date().toISOString()
    });
  });

  return Array.from(existingByKey.values());
}

function mergeWritingCharacterAssets(existingEntries = [], incomingEntries = [], bookId = "writing_book") {
  const existing = normalizeWritingCharacterAssets(existingEntries, bookId);
  const incoming = normalizeWritingCharacterAssets(incomingEntries, bookId);
  const existingByKey = new Map(existing.map((entry) => [normalizeWritingStoryAssetKey(entry.name), entry]));

  incoming.forEach((entry) => {
    const key = normalizeWritingStoryAssetKey(entry.name);
    const current = existingByKey.get(key);

    if (!key) {
      return;
    }

    if (!current) {
      existingByKey.set(key, entry);
      return;
    }

    existingByKey.set(key, {
      ...current,
      role: entry.role || current.role,
      goal: entry.goal || current.goal,
      fear: entry.fear || current.fear,
      secret: entry.secret || current.secret,
      growthArc: entry.growthArc || current.growthArc,
      relationships: uniqueStringList(current.relationships, entry.relationships),
      tags: uniqueStringList(current.tags, entry.tags),
      status: entry.status || current.status,
      updatedAt: new Date().toISOString()
    });
  });

  return Array.from(existingByKey.values());
}

function mergeWritingForeshadowAssets(existingEntries = [], incomingEntries = [], bookId = "writing_book") {
  const existing = normalizeWritingForeshadowAssets(existingEntries, bookId);
  const incoming = normalizeWritingForeshadowAssets(incomingEntries, bookId);
  const existingByKey = new Map(existing.map((entry) => [normalizeWritingStoryAssetKey(entry.title || entry.setup), entry]));

  incoming.forEach((entry) => {
    const key = normalizeWritingStoryAssetKey(entry.title || entry.setup);
    const current = existingByKey.get(key);

    if (!key) {
      return;
    }

    if (!current) {
      existingByKey.set(key, entry);
      return;
    }

    existingByKey.set(key, {
      ...current,
      title: entry.title || current.title,
      setup: entry.setup || current.setup,
      payoff: entry.payoff || current.payoff,
      status: entry.status || current.status,
      chapterIndex: entry.chapterIndex ?? current.chapterIndex,
      payoffChapterIndex: entry.payoffChapterIndex ?? current.payoffChapterIndex,
      tags: uniqueStringList(current.tags, entry.tags),
      updatedAt: new Date().toISOString()
    });
  });

  return Array.from(existingByKey.values());
}

function mergeWritingStyleProfile(existingProfile = {}, incomingProfile = {}) {
  const existing = normalizeWritingStyleProfileForUi(existingProfile);
  const incoming = normalizeWritingStyleProfileForUi(incomingProfile);

  return {
    voice: incoming.voice || existing.voice,
    pacing: incoming.pacing || existing.pacing,
    genreSignals: uniqueStringList(existing.genreSignals, incoming.genreSignals),
    taboos: uniqueStringList(existing.taboos, incoming.taboos),
    proseDensity: incoming.proseDensity || existing.proseDensity || "",
    dialogueRatio: incoming.dialogueRatio || existing.dialogueRatio || "",
    narrationDistance: incoming.narrationDistance || existing.narrationDistance || "",
    emotionalTemperature: incoming.emotionalTemperature || existing.emotionalTemperature || "",
    humorLevel: incoming.humorLevel || existing.humorLevel || "",
    violenceExplicitness: incoming.violenceExplicitness || existing.violenceExplicitness || "",
    pacingCurve: uniqueStringList(existing.pacingCurve, incoming.pacingCurve)
  };
}

function mergeWritingNarrativeStateNodes(existingNodes = [], incomingNodes = [], bookId = "writing_book", kind = "arc") {
  const existing = normalizeWritingNarrativeStateNodeList(existingNodes, bookId, kind);
  const incoming = normalizeWritingNarrativeStateNodeList(incomingNodes, bookId, kind);
  const nodesByKey = new Map(existing.map((node) => [normalizeWritingStoryAssetKey(node.label || node.id), node]));

  incoming.forEach((node) => {
    const key = normalizeWritingStoryAssetKey(node.label || node.id);
    const current = nodesByKey.get(key);

    if (!key) {
      return;
    }

    if (!current) {
      nodesByKey.set(key, node);
      return;
    }

    nodesByKey.set(key, {
      ...current,
      kind: normalizeWritingNarrativeStateNodeKind(node.kind, current.kind),
      label: node.label || current.label,
      summary: node.summary || current.summary,
      status: node.status || current.status,
      introducedAtChapterIndex: node.introducedAtChapterIndex ?? current.introducedAtChapterIndex,
      payoffDeadlineChapterIndex: node.payoffDeadlineChapterIndex ?? current.payoffDeadlineChapterIndex,
      resolvedAtChapterIndex: node.resolvedAtChapterIndex ?? current.resolvedAtChapterIndex,
      evidenceChapterIds: uniqueStringList(current.evidenceChapterIds, node.evidenceChapterIds),
      relatedNodeIds: uniqueStringList(current.relatedNodeIds, node.relatedNodeIds),
      riskLevel: normalizeWritingNarrativeRiskLevel(node.riskLevel || current.riskLevel),
      updatedAt: new Date().toISOString()
    });
  });

  return Array.from(nodesByKey.values());
}

function mergeWritingNarrativeState(book, incomingState = {}) {
  if (!book) {
    return null;
  }

  const bookId = book.id ?? "writing_book";
  const current = normalizeWritingNarrativeStateForUi(book.narrativeState, book.storyAssets, bookId);
  const incoming = normalizeWritingNarrativeStateForUi(incomingState, {}, bookId);

  book.narrativeState = {
    characters: mergeWritingNarrativeStateNodes(current.characters, incoming.characters, bookId, "character"),
    worldRules: mergeWritingNarrativeStateNodes(current.worldRules, incoming.worldRules, bookId, "worldRule"),
    resources: mergeWritingNarrativeStateNodes(current.resources, incoming.resources, bookId, "resource"),
    regions: mergeWritingNarrativeStateNodes(current.regions, incoming.regions, bookId, "region"),
    foreshadows: mergeWritingNarrativeStateNodes(current.foreshadows, incoming.foreshadows, bookId, "foreshadow"),
    arcs: mergeWritingNarrativeStateNodes(current.arcs, incoming.arcs, bookId, "arc"),
    timelineEvents: mergeWritingNarrativeStateNodes(current.timelineEvents, incoming.timelineEvents, bookId, "timelineEvent"),
    continuityWarnings: mergeWritingNarrativeStateNodes(current.continuityWarnings, incoming.continuityWarnings, bookId, "continuityWarning"),
    planDriftNotes: mergeWritingNarrativeStateNodes(current.planDriftNotes, incoming.planDriftNotes, bookId, "planDrift"),
    updatedAt: new Date().toISOString()
  };

  touchWritingBook(book, { persist: false });
  return book.narrativeState;
}

function mergeWritingStoryAssets(book, incomingAssets = {}) {
  if (!book) {
    return null;
  }

  const bookId = book.id ?? "writing_book";
  const current = normalizeWritingStoryAssetsForUi(book.storyAssets, bookId);
  const incoming = normalizeWritingStoryAssetsForUi(incomingAssets, bookId);

  book.storyAssets = {
    premise: incoming.premise || current.premise,
    worldview: mergeWritingStoryAssetEntries(current.worldview, incoming.worldview, bookId, "worldview"),
    characters: mergeWritingCharacterAssets(current.characters, incoming.characters, bookId),
    relationships: mergeWritingStoryAssetEntries(current.relationships, incoming.relationships, bookId, "relationship"),
    timeline: mergeWritingStoryAssetEntries(current.timeline, incoming.timeline, bookId, "timeline"),
    foreshadows: mergeWritingForeshadowAssets(current.foreshadows, incoming.foreshadows, bookId),
    rules: mergeWritingStoryAssetEntries(current.rules, incoming.rules, bookId, "rule"),
    styleProfile: mergeWritingStyleProfile(current.styleProfile, incoming.styleProfile),
    memoryNotes: mergeWritingStoryAssetEntries(current.memoryNotes, incoming.memoryNotes, bookId, "memory"),
    updatedAt: new Date().toISOString()
  };
  book.narrativeState = normalizeWritingNarrativeStateForUi(book.narrativeState, book.storyAssets, bookId);

  touchWritingBook(book, { persist: false });
  return book.storyAssets;
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
  ui.marketplace.writing.aiPhaseId = getWritingDefaultPhaseIdForTab("chapter");
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
  const extraIntroText = (Array.isArray(book?.extraIntroSections) ? book.extraIntroSections : [])
    .map((section) => `${section.title ?? ""}\n${section.content ?? ""}`)
    .join("\n");

  return [book?.intro, book?.outlineGuide, extraIntroText, chapterText]
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${BEIJING_DATE_TIME_FORMATTER.format(date)}`;
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
  const task = activeWritingTaskOptions.value.find((entry) => entry.id === taskId);

  ui.marketplace.writing.aiTaskId = taskId;
  ui.marketplace.writing.aiPhaseId = normalizeWritingTaskPhase(task);
  setWritingAiTaskPickerOpen(false);
}

function selectWritingAiPhase(phaseId) {
  const options = getWritingPhaseOptionsForTab(ui.marketplace.writing.activeTab);
  const nextPhaseId = options.some((phase) => phase.id === phaseId) ? phaseId : options[0]?.id ?? "foundation";
  const phaseTasks = activeWritingTaskOptions.value.filter((task) => normalizeWritingTaskPhase(task) === nextPhaseId);

  ui.marketplace.writing.aiPhaseId = nextPhaseId;
  ui.marketplace.writing.aiTaskId = phaseTasks[0]?.id ?? activeWritingTaskOptions.value[0]?.id ?? "";
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
  ui.marketplace.writing.aiPhaseId = getWritingDefaultPhaseIdForTab("intro");
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
    extraIntroSections: [],
    parts: [],
    storyAssets: normalizeWritingStoryAssetsForUi({}, createLocalId("writing_story_assets")),
    narrativeState: normalizeWritingNarrativeStateForUi({}, {}, createLocalId("writing_narrative_state")),
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
      extraIntroSections: [],
      parts: [],
      storyAssets: normalizeWritingStoryAssetsForUi({}, createLocalId("writing_story_assets")),
      narrativeState: normalizeWritingNarrativeStateForUi({}, {}, createLocalId("writing_narrative_state")),
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
  ui.marketplace.writing.aiPhaseId = getWritingDefaultPhaseIdForTab(tabId);
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
    activeWritingExtraIntroSections,
    activeWritingPhaseId,
    activeWritingPhaseOptions,
    activeWritingPhaseTaskOptions,
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
    buildWritingNarrativeStateContent,
    buildWritingOutlineContent,
    buildWritingStoryAssetsContent,
    canExportActiveWritingBook,
    clearWritingAutosaveTimer,
    clearWritingChapterSubmitConfirmation,
    closeWritingExportDialog,
    addWritingExtraIntroSection,
    createWritingBook,
    createWritingChapter,
    deleteWritingBookFromShelf,
    ensureWritingChapterSelection,
    exportActiveWritingBook,
    filteredWritingChapterEntries,
    formatWritingBookUpdatedAt,
    getDoneWritingChapters,
    getPreferredWritingChapter,
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
    getWritingExtraIntroSectionWordCount,
    getWritingIntroFieldWordCount,
    getWritingIntroFieldValue,
    getWritingIntroSections,
    getWritingLengthLabel,
    getWritingNarrativeStatePreview,
    getWritingNarrativeStateSummary,
    getWritingPartDisplayLabel,
    getWritingTabTitle,
    getWritingTabWordCount,
    goWritingChapter,
    handleWritingBookUpload,
    isWritingIntroSectionCollapsed,
    isActiveWritingBookAiRunning,
    isWritingChapterSubmitConfirmed,
    mergeWritingStoryAssets,
    mergeWritingNarrativeState,
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
    normalizeWritingNarrativeStateForUi,
    normalizeWritingStoryAssetsForUi,
    openWritingAppShelf,
    openWritingBook,
    openWritingExportDialog,
    parseWritingChapterIndex,
    persistWritingBookById,
    rememberWritingBookTitleBaseline,
    rememberWritingExtraIntroSectionTitleBaseline,
    selectPreferredWritingChapter,
    selectWritingChapter,
    selectWritingChapterFromPicker,
    selectWritingExportDirectory,
    selectWritingAiTask,
    selectWritingAiPhase,
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
    setWritingExtraIntroSectionContent,
    setWritingExtraIntroSectionTitle,
    setWritingExportFormat,
    setWritingFeedback,
    setWritingIntroField,
    setWritingTab,
    splitWritingBookPartTitlePrefix,
    splitWritingChapterTitlePrefix,
    submitWritingChapter,
    syncWritingBookSaveVersions,
    removeWritingExtraIntroSection,
    toggleWritingAiTaskPicker,
    toggleWritingChapterPicker,
    toggleWritingIntroSectionCollapsed,
    toggleWritingProfileRail,
    toggleWritingPromptPreview,
    touchWritingBook,
    writingBooks
  };
}
