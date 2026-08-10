import path from "node:path";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { resolveFromGordonHome, resolveFromRoot } from "../../shared/src/index.js";
import type {
  AgentRunLog,
  AgentProfile,
  ComicAsset,
  ComicAssetType,
  ComicAssetView,
  ComicAssetViewKind,
  ComicAssetVariant,
  ComicChapter,
  ComicChapterImage,
  ComicChapterStatus,
  ComicStoryboardKind,
  ComicStoryboardShot,
  ComicProject,
  ComicProjectFormat,
  ComicProjectPalette,
  ComicSourceMeta,
  ComicSourceRef,
  CommandWorkshopSession,
  DatabaseConnectionItem,
  GithubSkillImportRequest,
  McpServerConfig,
  ModelBalanceHistoryEntry,
  ModelBalanceHistorySource,
  ModelBalanceSnapshot,
  ModelProfile,
  ModelSettings,
  MusicProject,
  MusicTrack,
  MusicTrackKind,
  MusicTrackProvider,
  MusicTrackStatus,
  InfoRadarItem,
  InfoRadarRefreshRun,
  InfoRadarSource,
  InfoRadarSourceKind,
  InfoRadarWindow,
  LiveStreamPlatform,
  LiveStreamSource,
  LiveStreamSourceStatus,
  FinanceBriefAssetKind,
  FinanceBriefConfig,
  FinanceBriefDerivedMetric,
  FinanceBriefInterval,
  FinanceBriefKlinePoint,
  FinanceBriefProvider,
  FinanceBriefQuoteSnapshot,
  FinanceBriefRange,
  FinanceBriefSnapshot,
  FinanceBriefSymbol,
  SkillKind,
  SkillDefinition,
  ToolConfig,
  ToolConfigName,
  ToolConfigProvider,
  ToolProviderConfig,
  ToolProviderRuntimeConfig,
  VideoProject,
  VideoProjectAspectRatio,
  VideoProjectMode,
  VideoShot,
  VideoShotStatus,
  WorkflowLibraryItem,
  WorkflowProtocolDefinition,
  WorkflowRecord,
  WorkflowRequestStep,
  WorkflowVariableBinding,
  WeeklyFeishuSettings,
  WeeklyProgressItemStatus,
  WeeklyProgressProjectItem,
  WeeklyProgressRecord,
  WeeklyReportTemplateItem,
  WeeklyProgressTaskItem,
  WritingBook,
  WritingCharacterArc,
  WritingBookIntroSection,
  WritingBookLength,
  WritingBookPart,
  WritingBookPartType,
  WritingChapter,
  WritingCharacterAsset,
  WritingForeshadowAsset,
  WritingNarrativeRiskLevel,
  WritingNarrativeState,
  WritingNarrativeStateNode,
  WritingNarrativeStateNodeKind,
  WritingOutlinePlannerJob,
  WritingOutlinePlannerStatus,
  WritingBookSaveOptions,
  WritingChapterStatus,
  WritingEvidenceRef,
  WritingGenreProfile,
  WritingStoryAssetEntry,
  WritingStoryAssets,
  WritingStyleProfile,
  WorkTask
} from "../../shared/src/index.js";
import {
  getBuiltinAgentProfiles,
  getBuiltinMcpServers,
  getBuiltinSkillDefinitions,
  isBuiltinWorkbenchEntry,
  mergeBuiltinEntries
} from "./default-assets.js";
import { readPromptAsset } from "./prompt-assets.js";

const RETIRED_AGENT_PROFILE_IDS = new Set(["builtin:agent:arthur"]);
const DEFAULT_INFO_RADAR_CARD_ID = "workflow_info_radar";
const DEFAULT_API_WORKFLOW_CARD_ID = "workflow_api_test";
const DEFAULT_FINANCE_BRIEF_CARD_ID = "workflow_finance_brief";
const DEFAULT_LIVE_STREAM_CARD_ID = "workflow_live_stream";
const INFO_RADAR_SOURCE_KINDS = new Set<InfoRadarSourceKind>(["rss", "web_page", "search", "wechat", "github", "reddit", "manual"]);
const LIVE_STREAM_PLATFORMS = new Set<LiveStreamPlatform>(["bilibili", "xiaohongshu", "custom"]);
const LIVE_STREAM_SOURCE_STATUSES = new Set<LiveStreamSourceStatus>(["active", "paused"]);
const FINANCE_BRIEF_ASSET_KINDS = new Set<FinanceBriefAssetKind>(["commodity", "stock", "index", "fund", "crypto", "forex", "other"]);
const FINANCE_BRIEF_PROVIDERS = new Set<FinanceBriefProvider>(["yahoo"]);
const FINANCE_BRIEF_RANGES = new Set<FinanceBriefRange>(["1d", "5d", "1mo", "3mo", "6mo", "1y", "ytd", "2y", "5y"]);
const FINANCE_BRIEF_INTERVALS = new Set<FinanceBriefInterval>(["1m", "5m", "15m", "30m", "60m", "1d", "1wk", "1mo"]);

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function getDefaultModelSettings(): ModelSettings {
  return {
    profiles: [],
    activeProfileId: null
  };
}

function getDefaultWeeklyFeishuSettings(): WeeklyFeishuSettings {
  return {
    webhookUrl: "",
    secret: "",
    titlePrefix: "Gordon 日报",
    autoDailyReportEnabled: false,
    autoDailyReportTime: "18:30",
    autoDailyReportTimezone: "Asia/Shanghai",
    autoDailyReportLastRunDate: "",
    autoDailyReportLastRunAt: "",
    autoDailyReportLastStatus: "idle",
    autoDailyReportLastMessage: "",
    updatedAt: ""
  };
}

function normalizeWeeklyFeishuSettings(
  settings: Partial<WeeklyFeishuSettings> | null | undefined,
  options: { touch?: boolean } = {}
): WeeklyFeishuSettings {
  const fallback = getDefaultWeeklyFeishuSettings();

  return {
    webhookUrl: String(settings?.webhookUrl ?? fallback.webhookUrl).trim(),
    secret: String(settings?.secret ?? fallback.secret).trim(),
    titlePrefix: String(settings?.titlePrefix ?? fallback.titlePrefix).trim() || fallback.titlePrefix,
    autoDailyReportEnabled: Boolean(settings?.autoDailyReportEnabled ?? fallback.autoDailyReportEnabled),
    autoDailyReportTime:
      /^\d{2}:\d{2}$/.test(String(settings?.autoDailyReportTime ?? "").trim())
        ? String(settings?.autoDailyReportTime ?? "").trim()
        : fallback.autoDailyReportTime,
    autoDailyReportTimezone:
      String(settings?.autoDailyReportTimezone ?? fallback.autoDailyReportTimezone).trim() || fallback.autoDailyReportTimezone,
    autoDailyReportLastRunDate: String(settings?.autoDailyReportLastRunDate ?? fallback.autoDailyReportLastRunDate).trim(),
    autoDailyReportLastRunAt: String(settings?.autoDailyReportLastRunAt ?? fallback.autoDailyReportLastRunAt).trim(),
    autoDailyReportLastStatus: ["idle", "success", "failed", "skipped"].includes(
      String(settings?.autoDailyReportLastStatus ?? "")
    )
      ? (settings?.autoDailyReportLastStatus as WeeklyFeishuSettings["autoDailyReportLastStatus"])
      : fallback.autoDailyReportLastStatus,
    autoDailyReportLastMessage: String(settings?.autoDailyReportLastMessage ?? fallback.autoDailyReportLastMessage).trim(),
    updatedAt: options.touch ? new Date().toISOString() : String(settings?.updatedAt ?? fallback.updatedAt).trim()
  };
}

const LEGACY_DEFAULT_WEEKLY_REPORT_TEMPLATE = readPromptAsset("weeklyReportTemplateLegacy");
const DEFAULT_WEEKLY_REPORT_TEMPLATE = readPromptAsset("weeklyReportTemplateDefault");
const DEFAULT_WEEKLY_REPORT_TEMPLATE_ID = "builtin:weekly-report-template:default";
const DEFAULT_WEEKLY_REPORT_TEMPLATE_NAME = "默认模板";
const MIGRATED_WEEKLY_REPORT_TEMPLATE_NAME = "当前模板";

const WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE = "未分类项目";

function getWeeklyProgressFilePath(): string {
  return resolveFromRoot("data", "workbench", "weekly-progress.json");
}

function getWeeklyFeishuSettingsFilePath(): string {
  return resolveFromRoot("data", "workbench", "weekly-feishu-settings.json");
}

function getWorkbenchDirectoryPath(): string {
  return resolveFromRoot("data", "workbench");
}

function getWorkflowLibraryFilePath(): string {
  return resolveFromRoot("data", "workbench", "workflow-library.json");
}

function getLegacyEfficiencyToolsFilePath(): string {
  return resolveFromRoot("data", "workbench", "efficiency-tools.json");
}

function getSkillDefinitionsFilePath(): string {
  return resolveFromRoot("data", "workbench", "skills.json");
}

function getUserSkillsRootDirectoryPath(): string {
  return resolveFromGordonHome("skills");
}

const SKILL_MARKDOWN_FILE_NAME = "SKILL.md";
const SKILL_DISCOVERY_IGNORED_DIRECTORIES = new Set([".git", "node_modules"]);

function getMcpServersFilePath(): string {
  return resolveFromRoot("data", "workbench", "mcp-servers.json");
}

function getToolConfigsFilePath(): string {
  return resolveFromRoot("data", "workbench", "tool-configs.json");
}

function getAgentProfilesFilePath(): string {
  return resolveFromRoot("data", "workbench", "agent-profiles.json");
}

function getAgentRunLogsFilePath(): string {
  return resolveFromRoot("data", "workbench", "agent-run-logs.json");
}

function getCommandWorkshopSessionsFilePath(): string {
  return resolveFromRoot("data", "workbench", "command-workshop-sessions.json");
}

function getModelBalanceHistoryFilePath(): string {
  return resolveFromRoot("data", "workbench", "model-balance-history.json");
}

function getComicProjectsFilePath(): string {
  return resolveFromRoot("data", "workbench", "comic-projects.json");
}

function getComicProjectDeleteStagingDirectoryPath(): string {
  return resolveFromRoot("data", "workbench", ".delete-staging", "comic-projects");
}

function getComicProjectImagesDirectoryPath(projectId: string): string {
  return resolveFromRoot("data", "workbench", "comic-images", sanitizeWritingAssetName(projectId, "comic-project"));
}

function getVideoProjectsFilePath(): string {
  return resolveFromRoot("data", "workbench", "video-projects.json");
}

function getVideoProjectDeleteStagingDirectoryPath(): string {
  return resolveFromRoot("data", "workbench", ".delete-staging", "video-projects");
}

function getMusicProjectsFilePath(): string {
  return resolveFromRoot("data", "workbench", "music-projects.json");
}

function getMusicProjectDeleteStagingDirectoryPath(): string {
  return resolveFromRoot("data", "workbench", ".delete-staging", "music-projects");
}

function getWritingBooksDirectoryPath(): string {
  return resolveFromRoot("data", "workbench", "writing-books");
}

function encodeGithubPath(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sanitizeSkillFolderName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "skill";
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildSkillLocalDirectory(folderName: string): string {
  return path.join(getUserSkillsRootDirectoryPath(), folderName);
}

function escapeFrontmatterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isPathInsideDirectory(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function sanitizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized.includes("..")) {
    throw new Error("检测到非法 Skill 路径");
  }

  return normalized;
}

function normalizeGithubRepo(repo: string): string {
  const trimmed = repo.trim().replace(/\/+$/, "");

  if (!trimmed) {
    throw new Error("请填写 GitHub 仓库，例如 owner/repo");
  }

  const match = trimmed.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);

  if (match?.[1]) {
    return match[1];
  }

  const normalized = trimmed.replace(/^https?:\/\//i, "").replace(/\.git$/i, "");
  const segments = normalized.split("/").filter(Boolean);
  const githubSegments = segments[0]?.toLowerCase() === "github.com" ? segments.slice(1) : segments;

  if (githubSegments.length >= 2) {
    return `${githubSegments[0]}/${githubSegments[1]}`;
  }

  throw new Error("GitHub 仓库格式无效，请使用 owner/repo 或完整 GitHub URL");
}

function normalizeGithubSkillPath(skillPath: string): string {
  const normalized = sanitizeRelativePath(skillPath);

  if (!normalized) {
    throw new Error("请填写 Skill 路径，例如 skills/my-skill");
  }

  return normalized.endsWith("SKILL.md") ? normalized : `${normalized}/SKILL.md`;
}

function extractMarkdownFrontmatter(markdown: string): { body: string; metadata: Record<string, string> } {
  const trimmed = markdown.trim();

  if (!trimmed.startsWith("---")) {
    return {
      body: trimmed,
      metadata: {}
    };
  }

  const match = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    return {
      body: trimmed,
      metadata: {}
    };
  }

  const metadata = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex <= 0) {
        return result;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

      if (key) {
        result[key] = value;
      }

      return result;
    }, {});

  return {
    body: match[2].trim(),
    metadata
  };
}

function extractMarkdownHeading(markdown: string): string {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  return headingMatch?.[1]?.trim() ?? "";
}

function extractMarkdownSummary(markdown: string): string {
  const paragraph = markdown
    .split("\n\n")
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("```") && !block.startsWith("- ") && !block.startsWith("* "));

  return paragraph ?? "";
}

function inferImportedSkillKind(markdown: string, metadata: Record<string, string>): SkillKind {
  const configured = metadata.kind?.trim().toLowerCase();

  if (configured === "prompt" || configured === "workflow") {
    return configured;
  }

  const normalized = markdown.toLowerCase();

  if (
    normalized.includes("## scripts") ||
    normalized.includes("## workflow") ||
    normalized.includes("## steps") ||
    normalized.includes("use the helper scripts") ||
    normalized.includes("安装") ||
    normalized.includes("脚本")
  ) {
    return "workflow";
  }

  return "prompt";
}

function inferImportedSkillHandlerRef(metadata: Record<string, string>): string {
  const handlerRef = metadata.handlerRef?.trim() || metadata.handler?.trim() || metadata.entrypoint?.trim();
  return handlerRef ?? "";
}

function normalizeSkillLocalPathKey(localPath: string | null | undefined): string {
  const trimmed = localPath?.trim();
  return trimmed ? path.resolve(trimmed).normalize() : "";
}

function getSkillRelativeRootPath(localDirectory: string): string {
  const relativePath = path.relative(getUserSkillsRootDirectoryPath(), localDirectory).replace(/\\/g, "/");

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("检测到非法 Skill 本地目录");
  }

  return relativePath;
}

function buildDiscoveredLocalSkillId(relativeSkillRootPath: string): string {
  return `local:skill:${encodeURIComponent(relativeSkillRootPath)}`;
}

function extractImportedSkillTags(metadata: Record<string, string>): string[] {
  const rawTags = metadata.tags?.trim() || metadata.tag?.trim() || "";

  if (!rawTags) {
    return [];
  }

  return Array.from(
    new Set(
      rawTags
        .split(/[,，\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

async function buildDiscoveredLocalSkillDefinition(localDirectory: string, skillFilePath: string): Promise<SkillDefinition | null> {
  const markdown = await readFile(skillFilePath, "utf8");
  const { body, metadata } = extractMarkdownFrontmatter(markdown);
  const promptTemplate = body.trim();

  if (!promptTemplate) {
    return null;
  }

  const relativeSkillRootPath = getSkillRelativeRootPath(localDirectory);
  const skillFileStat = await stat(skillFilePath);
  const inferredName =
    metadata.name?.trim() ||
    extractMarkdownHeading(promptTemplate) ||
    relativeSkillRootPath.split("/").filter(Boolean).at(-1) ||
    "Local Skill";
  const description = metadata.description?.trim() || extractMarkdownSummary(promptTemplate);

  return {
    id: buildDiscoveredLocalSkillId(relativeSkillRootPath),
    name: inferredName,
    description,
    tags: extractImportedSkillTags(metadata),
    kind: inferImportedSkillKind(promptTemplate, metadata),
    promptTemplate,
    handlerRef: inferImportedSkillHandlerRef(metadata),
    source: {
      type: "manual",
      localPath: localDirectory
    },
    enabled: true,
    updatedAt: skillFileStat.mtime.toISOString()
  };
}

async function discoverLocalSkillDefinitions(): Promise<SkillDefinition[]> {
  const skillsRootDirectory = getUserSkillsRootDirectoryPath();
  const discoveredSkills: SkillDefinition[] = [];

  const walkDirectory = async (directoryPath: string): Promise<void> => {
    let entries: Array<{ name: string; isFile(): boolean; isDirectory(): boolean }>;

    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }

      throw error;
    }

    const skillFile = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === "skill.md");

    if (skillFile) {
      const discoveredSkill = await buildDiscoveredLocalSkillDefinition(directoryPath, path.join(directoryPath, skillFile.name));

      if (discoveredSkill) {
        discoveredSkills.push(discoveredSkill);
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKILL_DISCOVERY_IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await walkDirectory(path.join(directoryPath, entry.name));
    }
  };

  await walkDirectory(skillsRootDirectory);

  return discoveredSkills.sort((left, right) => {
    const leftPath = getSkillRelativeRootPath(left.source?.localPath ?? "");
    const rightPath = getSkillRelativeRootPath(right.source?.localPath ?? "");
    return leftPath.localeCompare(rightPath);
  });
}

function mergeDiscoveredSkillDefinitions(
  registeredSkills: SkillDefinition[],
  discoveredSkills: SkillDefinition[]
): SkillDefinition[] {
  const nextSkills: SkillDefinition[] = [];
  const skillIds = new Set<string>();
  const localPathKeys = new Set<string>();

  const appendSkill = (skill: SkillDefinition): void => {
    const localPathKey = normalizeSkillLocalPathKey(skill.source?.localPath);

    if (skillIds.has(skill.id) || (localPathKey && localPathKeys.has(localPathKey))) {
      return;
    }

    nextSkills.push(skill);
    skillIds.add(skill.id);

    if (localPathKey) {
      localPathKeys.add(localPathKey);
    }
  };

  registeredSkills.forEach(appendSkill);
  discoveredSkills.forEach(appendSkill);

  return nextSkills;
}

function isBuiltinSkillLocalPath(localPath: string): boolean {
  const localPathKey = normalizeSkillLocalPathKey(localPath);

  return getBuiltinSkillDefinitions().some((skill) => normalizeSkillLocalPathKey(skill.source?.localPath) === localPathKey);
}

function isUserSkillLocalPath(localPath: string | null | undefined): boolean {
  const trimmed = localPath?.trim();
  return Boolean(trimmed && isPathInsideDirectory(getUserSkillsRootDirectoryPath(), trimmed) && !isBuiltinSkillLocalPath(trimmed));
}

function resolveUserSkillLocalPath(localPath: string | null | undefined): string | null {
  const trimmed = localPath?.trim();
  return trimmed && isUserSkillLocalPath(trimmed) ? trimmed : null;
}

function getGithubSkillRootPath(skillFilePath: string): string {
  return skillFilePath.endsWith(SKILL_MARKDOWN_FILE_NAME)
    ? skillFilePath.slice(0, -SKILL_MARKDOWN_FILE_NAME.length).replace(/\/+$/, "")
    : skillFilePath;
}

async function resolveAvailableSkillLocalDirectory(
  preferredSkillName: string,
  currentSkills: SkillDefinition[],
  ignoreSkillId?: string
): Promise<string> {
  const preferredFolderName = sanitizeSkillFolderName(preferredSkillName);
  const occupiedPaths = new Set(
    currentSkills
      .filter((entry) => entry.id !== ignoreSkillId)
      .map((entry) => entry.source?.localPath?.trim())
      .filter((entry): entry is string => Boolean(entry))
  );

  for (let index = 0; index < 999; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidatePath = buildSkillLocalDirectory(`${preferredFolderName}${suffix}`);

    if (occupiedPaths.has(candidatePath)) {
      continue;
    }

    if (await pathExists(candidatePath)) {
      continue;
    }

    return candidatePath;
  }

  return buildSkillLocalDirectory(`${preferredFolderName}-${Date.now()}`);
}

function toPosixRelativePath(basePath: string, targetPath: string): string {
  const relative = path.posix.relative(basePath, targetPath);

  if (!relative || relative.startsWith("..")) {
    throw new Error("GitHub Skill 目录结构异常");
  }

  return relative;
}

async function fetchGithubJson<T>(repo: string, ref: string, targetPath: string): Promise<T> {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${encodeGithubPath(targetPath)}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Gordon"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub Skill 读取失败：HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchGithubFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "Gordon"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub Skill 下载失败：HTTP ${response.status}`);
  }

  return response.text();
}

async function mirrorGithubSkillDirectory(
  repo: string,
  ref: string,
  skillRootPath: string,
  localDirectory: string
): Promise<string> {
  const filesToWrite: Array<{ relativePath: string; content: string }> = [];

  const walkDirectory = async (directoryPath: string): Promise<void> => {
    const payload = await fetchGithubJson<
      Array<{
        type?: string;
        path?: string;
        download_url?: string | null;
      }>
    >(repo, ref, directoryPath);

    for (const entry of payload) {
      if (!entry?.type || !entry.path) {
        continue;
      }

      if (entry.type === "dir") {
        await walkDirectory(entry.path);
        continue;
      }

      if (entry.type !== "file" || !entry.download_url) {
        continue;
      }

      filesToWrite.push({
        relativePath: toPosixRelativePath(skillRootPath, entry.path),
        content: await fetchGithubFileContent(entry.download_url)
      });
    }
  };

  await walkDirectory(skillRootPath);
  await rm(localDirectory, { recursive: true, force: true });

  for (const file of filesToWrite) {
    const outputPath = path.join(localDirectory, file.relativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.content, "utf8");
  }

  return localDirectory;
}

async function fetchGithubSkillMarkdown(request: GithubSkillImportRequest): Promise<{
  repo: string;
  ref: string;
  path: string;
  url: string;
  markdown: string;
}> {
  const repo = normalizeGithubRepo(request.repo);
  const ref = request.ref?.trim() || "main";
  const path = normalizeGithubSkillPath(request.path);
  const payload = await fetchGithubJson<{
    type?: string;
    name?: string;
    download_url?: string | null;
    html_url?: string;
    content?: string;
    encoding?: string;
  }>(repo, ref, path);

  if (payload.type !== "file") {
    throw new Error("指定路径不是有效的 SKILL.md 文件");
  }

  if (payload.content && payload.encoding === "base64") {
    return {
      repo,
      ref,
      path,
      url: payload.html_url ?? `https://github.com/${repo}/blob/${ref}/${path}`,
      markdown: Buffer.from(payload.content, "base64").toString("utf8")
    };
  }

  if (!payload.download_url) {
    throw new Error("GitHub 未返回可下载的 Skill 文件地址");
  }

  return {
    repo,
    ref,
    path,
    url: payload.html_url ?? `https://github.com/${repo}/blob/${ref}/${path}`,
    markdown: await fetchGithubFileContent(payload.download_url)
  };
}

function buildImportedSkillDefinition(markdown: string, source: {
  repo: string;
  ref: string;
  path: string;
  url: string;
  localPath: string;
}): SkillDefinition {
  const { body, metadata } = extractMarkdownFrontmatter(markdown);

  if (!body.trim()) {
    throw new Error("读取到的 SKILL.md 内容为空，无法导入");
  }

  const timestamp = new Date().toISOString();
  const inferredName =
    metadata.name?.trim() ||
    extractMarkdownHeading(body) ||
    source.path.split("/").filter(Boolean).at(-2) ||
    "Imported Skill";
  const description = metadata.description?.trim() || extractMarkdownSummary(body);

  return {
    id: `skill_${randomUUID()}`,
    name: inferredName,
    description,
    tags: [],
    kind: inferImportedSkillKind(body, metadata),
    promptTemplate: body.trim(),
    handlerRef: inferImportedSkillHandlerRef(metadata) || `github:${source.repo}/${source.ref}/${source.path}`,
    source: {
      type: "github",
      repo: source.repo,
      ref: source.ref,
      path: source.path,
      url: source.url,
      localPath: source.localPath,
      importedAt: timestamp
    },
    enabled: true,
    updatedAt: timestamp
  };
}

async function resolveSkillLocalDirectory(
  skill: SkillDefinition,
  currentSkills: SkillDefinition[],
  existingSkill?: SkillDefinition
): Promise<string> {
  const existingLocalPath = resolveUserSkillLocalPath(existingSkill?.source?.localPath);

  if (existingLocalPath) {
    return existingLocalPath;
  }

  const sourceLocalPath = resolveUserSkillLocalPath(skill.source?.localPath);

  if (sourceLocalPath) {
    return sourceLocalPath;
  }

  return resolveAvailableSkillLocalDirectory(skill.name, currentSkills, skill.id);
}

function serializeSkillDefinitionMarkdown(skill: SkillDefinition): string {
  const lines = [
    "---",
    `name: ${escapeFrontmatterValue(skill.name.trim() || "Untitled Skill")}`,
    `description: ${escapeFrontmatterValue(skill.description.trim())}`
  ];
  const handlerRef = skill.handlerRef?.trim();

  if (handlerRef) {
    lines.push(`handlerRef: ${escapeFrontmatterValue(handlerRef)}`);
  }

  lines.push("---", "", skill.promptTemplate.trim());
  return `${lines.join("\n").trim()}\n`;
}

async function materializeSkillDirectory(
  skill: SkillDefinition,
  currentSkills: SkillDefinition[],
  existingSkill?: SkillDefinition
): Promise<SkillDefinition> {
  const localDirectory = await resolveSkillLocalDirectory(skill, currentSkills, existingSkill);

  await mkdir(localDirectory, { recursive: true });
  await writeFile(path.join(localDirectory, "SKILL.md"), serializeSkillDefinitionMarkdown(skill), "utf8");

  return {
    ...skill,
    source: {
      type: skill.source?.type ?? "manual",
      ...(skill.source ?? {}),
      localPath: localDirectory
    }
  };
}

function padMonthOrDay(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = padMonthOrDay(date.getMonth() + 1);
  const day = padMonthOrDay(date.getDate());

  return `${year}-${month}-${day}`;
}

function addDays(source: Date, days: number): Date {
  const next = new Date(source);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekRange(referenceDate = new Date()): { weekKey: string; startDate: string; endDate: string; title: string } {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, diffToMonday);
  const friday = addDays(monday, 4);

  return {
    weekKey: toLocalDateKey(monday),
    startDate: toLocalDateKey(monday),
    endDate: toLocalDateKey(friday),
    title: `${padMonthOrDay(monday.getMonth() + 1)}月${padMonthOrDay(monday.getDate())}日 - ${padMonthOrDay(friday.getMonth() + 1)}月${padMonthOrDay(friday.getDate())}日`
  };
}

function getWeeklyProgressStatusLabel(status: WeeklyProgressItemStatus): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "testing":
      return "测试中";
    case "in_progress":
      return "进行中";
    case "blocked":
      return "受阻";
    case "planned":
    default:
      return "待开始";
  }
}

function tryParseWeeklyProgressItemStatus(status: string | undefined): WeeklyProgressItemStatus | undefined {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (["completed", "done", "finish", "finished", "已完成", "完成", "x"].includes(normalized)) {
    return "completed";
  }

  if (["inprogress", "doing", "active", "进行中", "处理中", "~", "-"].includes(normalized)) {
    return "in_progress";
  }

  if (["testing", "test", "qa", "测试中", "测试", "联调", "验收中"].includes(normalized)) {
    return "testing";
  }

  if (["blocked", "block", "受阻", "阻塞", "卡住", "!"].includes(normalized)) {
    return "blocked";
  }

  if (["planned", "plan", "todo", "待开始", "待办", "未开始"].includes(normalized)) {
    return "planned";
  }

  return undefined;
}

function normalizeWeeklyProgressItemStatus(status: string | undefined): WeeklyProgressItemStatus {
  const parsedStatus = tryParseWeeklyProgressItemStatus(status);

  if (parsedStatus) {
    return parsedStatus;
  }

  return "planned";
}

function extractWeeklyProgressLineMetadata(rawText: string): { title: string; status?: WeeklyProgressItemStatus } {
  let text = rawText.trim().replace(/^[-*+•]\s+/, "");
  let detectedStatus: WeeklyProgressItemStatus | undefined;

  const prefixMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);

  if (prefixMatch) {
    const nextStatus = tryParseWeeklyProgressItemStatus(prefixMatch[1]);

    if (nextStatus) {
      detectedStatus = nextStatus;
      text = prefixMatch[2].trim();
    }
  }

  const suffixMatch = text.match(/^(.*?)[（(]([^)）]+)[)）]$/);

  if (suffixMatch) {
    const nextStatus = tryParseWeeklyProgressItemStatus(suffixMatch[2]);

    if (nextStatus) {
      detectedStatus = nextStatus;
      text = suffixMatch[1].trim();
    }
  }

  return {
    title: text,
    status: detectedStatus
  };
}

function createWeeklyProgressTaskItem(
  overrides: Partial<WeeklyProgressTaskItem> = {}
): WeeklyProgressTaskItem {
  const timestamp = new Date().toISOString();
  const createdAt = String(overrides.createdAt ?? "").trim() || timestamp;
  const updatedAt = String(overrides.updatedAt ?? "").trim() || createdAt;

  return {
    id: overrides.id ?? `weekly_task_${randomUUID()}`,
    title: overrides.title ?? "",
    detail: overrides.detail ?? "",
    status: overrides.status ?? "planned",
    createdAt,
    updatedAt,
    children: Array.isArray(overrides.children) ? overrides.children : []
  };
}

function createWeeklyProgressProjectItem(
  overrides: Partial<WeeklyProgressProjectItem> = {}
): WeeklyProgressProjectItem {
  return {
    id: overrides.id ?? `weekly_project_${randomUUID()}`,
    title: overrides.title ?? "",
    note: overrides.note ?? "",
    status: overrides.status ?? "in_progress",
    tasks: overrides.tasks ?? []
  };
}

function createDefaultWeeklyReportTemplateItem(): WeeklyReportTemplateItem {
  return {
    id: DEFAULT_WEEKLY_REPORT_TEMPLATE_ID,
    name: DEFAULT_WEEKLY_REPORT_TEMPLATE_NAME,
    content: DEFAULT_WEEKLY_REPORT_TEMPLATE,
    builtin: true
  };
}

function createWeeklyReportTemplateItem(
  overrides: Partial<WeeklyReportTemplateItem> = {}
): WeeklyReportTemplateItem {
  const builtin = Boolean(overrides.builtin) || overrides.id === DEFAULT_WEEKLY_REPORT_TEMPLATE_ID;

  if (builtin) {
    return createDefaultWeeklyReportTemplateItem();
  }

  return {
    id: overrides.id ?? `weekly_report_template_${randomUUID()}`,
    name: String(overrides.name ?? ""),
    content: String(overrides.content ?? ""),
    builtin: false
  };
}

function normalizeWeeklyReportTemplateItem(
  template: Partial<WeeklyReportTemplateItem> | null | undefined
): WeeklyReportTemplateItem | null {
  if (!template) {
    return null;
  }

  return createWeeklyReportTemplateItem({
    id: String(template.id ?? "").trim() || undefined,
    name: String(template.name ?? ""),
    content: String(template.content ?? ""),
    builtin: Boolean(template.builtin)
  });
}

function isLegacyCustomWeeklyReportTemplate(content: string): boolean {
  return Boolean(content) && content !== LEGACY_DEFAULT_WEEKLY_REPORT_TEMPLATE && content !== DEFAULT_WEEKLY_REPORT_TEMPLATE;
}

function normalizeWeeklyReportTemplates(record: WeeklyProgressRecord): {
  reportTemplates: WeeklyReportTemplateItem[];
  selectedReportTemplateId: string;
  reportTemplate: string;
} {
  const legacyReportTemplate = String(record.reportTemplate ?? "").trim();
  const hasReportTemplateCollection = Array.isArray(record.reportTemplates) && record.reportTemplates.length > 0;
  const defaultTemplate = createDefaultWeeklyReportTemplateItem();
  const normalizedTemplates = (Array.isArray(record.reportTemplates) ? record.reportTemplates : [])
    .map((template) => normalizeWeeklyReportTemplateItem(template))
    .filter((template): template is WeeklyReportTemplateItem => Boolean(template));
  const dedupedTemplates: WeeklyReportTemplateItem[] = [];
  const seenTemplateIds = new Set<string>();

  for (const template of normalizedTemplates) {
    if (seenTemplateIds.has(template.id)) {
      continue;
    }

    seenTemplateIds.add(template.id);
    dedupedTemplates.push(template);
  }

  const customTemplates = dedupedTemplates.filter((template) => template.id !== DEFAULT_WEEKLY_REPORT_TEMPLATE_ID && !template.builtin);
  const reportTemplates = [defaultTemplate, ...customTemplates];

  if (!hasReportTemplateCollection && isLegacyCustomWeeklyReportTemplate(legacyReportTemplate)) {
    reportTemplates.push(
      createWeeklyReportTemplateItem({
        name: MIGRATED_WEEKLY_REPORT_TEMPLATE_NAME,
        content: legacyReportTemplate
      })
    );
  }

  let selectedTemplate =
    reportTemplates.find((template) => template.id === String(record.selectedReportTemplateId ?? "").trim()) ?? null;

  if (!selectedTemplate && legacyReportTemplate) {
    selectedTemplate = reportTemplates.find((template) => template.content.trim() === legacyReportTemplate) ?? null;
  }

  if (!selectedTemplate) {
    selectedTemplate = reportTemplates.find((template) => !template.builtin) ?? reportTemplates[0];
  }

  return {
    reportTemplates,
    selectedReportTemplateId: selectedTemplate.id,
    reportTemplate: selectedTemplate.content
  };
}

function getWeeklyTaskChildren(task: Partial<WeeklyProgressTaskItem> | null | undefined): Partial<WeeklyProgressTaskItem>[] {
  return Array.isArray(task?.children) ? task.children : [];
}

function normalizeWeeklyTaskTimestamp(
  value: unknown,
  fallbackTimestamp: string
): string {
  const normalized = String(value ?? "").trim();

  return normalized || fallbackTimestamp;
}

function hasWeeklyTaskContent(task: Partial<WeeklyProgressTaskItem> | null | undefined): boolean {
  return Boolean(String(task?.title ?? "").trim() || String(task?.detail ?? "").trim() || getWeeklyTaskChildren(task).length);
}

function collectWeeklyProgressTasks(tasks: WeeklyProgressTaskItem[]): WeeklyProgressTaskItem[] {
  const flattened: WeeklyProgressTaskItem[] = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    flattened.push(task);

    const children = getWeeklyTaskChildren(task) as WeeklyProgressTaskItem[];

    if (children.length) {
      flattened.push(...collectWeeklyProgressTasks(children));
    }
  }

  return flattened;
}

function deriveWeeklyProgressProjectStatus(tasks: WeeklyProgressTaskItem[]): WeeklyProgressItemStatus {
  const meaningfulTasks = collectWeeklyProgressTasks(tasks).filter((task) => hasWeeklyTaskContent(task));

  if (!meaningfulTasks.length) {
    return "in_progress";
  }

  if (meaningfulTasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }

  if (meaningfulTasks.every((task) => task.status === "completed")) {
    return "completed";
  }

  if (meaningfulTasks.some((task) => task.status === "testing")) {
    return "testing";
  }

  if (meaningfulTasks.some((task) => task.status === "in_progress" || task.status === "completed")) {
    return "in_progress";
  }

  return "planned";
}

function normalizeWeeklyProgressTaskItem(
  task: Partial<WeeklyProgressTaskItem> | null | undefined,
  fallbackTimestamp = new Date().toISOString()
): WeeklyProgressTaskItem | null {
  if (!task) {
    return null;
  }

  const title = String(task.title ?? "").trim();
  const detail = String(task.detail ?? "").trim();
  const children = getWeeklyTaskChildren(task)
    .map((child) => normalizeWeeklyProgressTaskItem(child, fallbackTimestamp))
    .filter((child): child is WeeklyProgressTaskItem => Boolean(child));
  const createdAt = normalizeWeeklyTaskTimestamp(task.createdAt ?? task.updatedAt, fallbackTimestamp);
  const updatedAt = normalizeWeeklyTaskTimestamp(task.updatedAt ?? task.createdAt, createdAt);

  if (!title && !detail && !children.length) {
    return null;
  }

  return createWeeklyProgressTaskItem({
    ...task,
    title: title || detail || "未命名任务",
    detail,
    status: normalizeWeeklyProgressItemStatus(task.status),
    createdAt,
    updatedAt,
    children
  });
}

function normalizeWeeklyProgressProjectItem(
  project: Partial<WeeklyProgressProjectItem> | null | undefined,
  fallbackTaskTimestamp = new Date().toISOString()
): WeeklyProgressProjectItem | null {
  if (!project) {
    return null;
  }

  const title = String(project.title ?? "").trim();
  const note = String(project.note ?? "").trim();
  const tasks = Array.isArray(project.tasks)
    ? project.tasks
        .map((task) => normalizeWeeklyProgressTaskItem(task, fallbackTaskTimestamp))
        .filter((task): task is WeeklyProgressTaskItem => Boolean(task))
    : [];

  if (!title && !note && !tasks.length) {
    return null;
  }

  return createWeeklyProgressProjectItem({
    ...project,
    title: title || WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE,
    note,
    status: project.status ? normalizeWeeklyProgressItemStatus(project.status) : deriveWeeklyProgressProjectStatus(tasks),
    tasks
  });
}

function parseLegacyWeeklyProgressContent(
  content: string | undefined,
  fallbackTaskTimestamp = new Date().toISOString()
): WeeklyProgressProjectItem[] {
  const lines = String(content ?? "").replace(/\r\n?/g, "\n").split("\n");
  const projects: WeeklyProgressProjectItem[] = [];
  let currentProject: WeeklyProgressProjectItem | null = null;
  let taskStack: WeeklyProgressTaskItem[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      taskStack = [];
      continue;
    }

    const indentLength = rawLine.match(/^\s*/)?.[0]?.length ?? 0;
    const indentLevel = Math.max(0, Math.floor(indentLength / 4));
    const metadata = extractWeeklyProgressLineMetadata(trimmed);
    const normalizedTitle = metadata.title.trim();

    if (!normalizedTitle) {
      continue;
    }

    if (indentLength === 0) {
      currentProject = createWeeklyProgressProjectItem({
        title: normalizedTitle,
        status: metadata.status ?? "in_progress"
      });
      projects.push(currentProject);
      taskStack = [];
      continue;
    }

    if (!currentProject) {
      currentProject = createWeeklyProgressProjectItem({
        title: WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE
      });
      projects.push(currentProject);
    }

    const noteMatch = normalizedTitle.match(/^(?:备注|说明|结果|风险)[:：]\s*(.*)$/);

    if (noteMatch) {
      const detailText = noteMatch[1].trim();
      const targetTask = taskStack[Math.min(Math.max(indentLevel - 2, 0), Math.max(taskStack.length - 1, 0))] ?? null;

      if (indentLevel >= 2 && targetTask) {
        targetTask.detail = targetTask.detail ? `${targetTask.detail}\n${detailText}` : detailText;
      } else {
        currentProject.note = currentProject.note ? `${currentProject.note}\n${detailText}` : detailText;
      }

      continue;
    }

    if (!metadata.status && indentLevel > taskStack.length && taskStack.length) {
      const deepestTask = taskStack[taskStack.length - 1];
      deepestTask.detail = deepestTask.detail ? `${deepestTask.detail}\n${normalizedTitle}` : normalizedTitle;
      continue;
    }

    const taskDepth = Math.max(0, indentLevel - 1);
    const parentTask = taskDepth > 0 ? taskStack[taskDepth - 1] ?? null : null;
    const task = createWeeklyProgressTaskItem({
      title: normalizedTitle,
      status: metadata.status ?? "planned",
      createdAt: fallbackTaskTimestamp,
      updatedAt: fallbackTaskTimestamp
    });

    if (parentTask) {
      parentTask.children.push(task);
    } else {
      currentProject.tasks.push(task);
    }

    taskStack = taskStack.slice(0, taskDepth);
    taskStack[taskDepth] = task;
  }

  return projects
    .map((project) => normalizeWeeklyProgressProjectItem(project, fallbackTaskTimestamp))
    .filter((project): project is WeeklyProgressProjectItem => Boolean(project));
}

function buildWeeklyProgressContent(projects: WeeklyProgressProjectItem[]): string {
  function buildWeeklyTaskLines(task: WeeklyProgressTaskItem, depth: number): string[] {
    const indent = "    ".repeat(depth);
    const detailIndent = "    ".repeat(depth + 1);
    const lines = [`${indent}[${getWeeklyProgressStatusLabel(task.status)}] ${task.title}`];

    if (task.detail) {
      lines.push(...task.detail.split("\n").map((line) => `${detailIndent}说明：${line.trim()}`));
    }

    for (const child of getWeeklyTaskChildren(task) as WeeklyProgressTaskItem[]) {
      lines.push(...buildWeeklyTaskLines(child, depth + 1));
    }

    return lines;
  }

  return projects
    .map((project) => {
      const lines = [`${project.title}（${getWeeklyProgressStatusLabel(project.status)}）`];

      if (project.note) {
        lines.push(...project.note.split("\n").map((line) => `    备注：${line.trim()}`));
      }

      for (const task of project.tasks) {
        lines.push(...buildWeeklyTaskLines(task, 1));
      }

      return lines.join("\n");
    })
    .join("\n\n")
    .trim();
}

function shouldCarryForwardWeeklyTaskStatus(status: WeeklyProgressItemStatus): boolean {
  return status === "planned" || status === "in_progress" || status === "testing" || status === "blocked";
}

function cloneWeeklyProgressTaskForCarryForward(task: WeeklyProgressTaskItem): WeeklyProgressTaskItem | null {
  const filteredChildren = getWeeklyTaskChildren(task)
    .map((child) => cloneWeeklyProgressTaskForCarryForward(child as WeeklyProgressTaskItem))
    .filter((child): child is WeeklyProgressTaskItem => Boolean(child));
  const shouldCarryCurrentTask = shouldCarryForwardWeeklyTaskStatus(task.status);

  if (!shouldCarryCurrentTask && !filteredChildren.length) {
    return null;
  }

  const nextStatus =
    filteredChildren.length && task.status !== "blocked"
      ? "in_progress"
      : task.status;

  return createWeeklyProgressTaskItem({
    title: task.title,
    detail: task.detail,
    status: nextStatus,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    children: filteredChildren
  });
}

function buildCarryForwardProjectsFromWeeklyRecord(record: WeeklyProgressRecord | null | undefined): WeeklyProgressProjectItem[] {
  if (!record) {
    return [];
  }

  return (Array.isArray(record.projects) ? record.projects : [])
    .map((project) => {
      const carriedTasks = (Array.isArray(project.tasks) ? project.tasks : [])
        .map((task) => cloneWeeklyProgressTaskForCarryForward(task))
        .filter((task): task is WeeklyProgressTaskItem => Boolean(task));

      if (!carriedTasks.length) {
        return null;
      }

      return createWeeklyProgressProjectItem({
        title: project.title,
        note: project.note,
        status: deriveWeeklyProgressProjectStatus(carriedTasks),
        tasks: carriedTasks
      });
    })
    .filter((project): project is WeeklyProgressProjectItem => Boolean(project));
}

function sortWeeklyProgress(records: WeeklyProgressRecord[]): WeeklyProgressRecord[] {
  return [...records].sort(
    (left, right) => right.weekKey.localeCompare(left.weekKey) || right.updatedAt.localeCompare(left.updatedAt)
  );
}

function normalizeWeeklyProgressRecord(record: WeeklyProgressRecord): WeeklyProgressRecord {
  const taskFallbackTimestamp = String(record.createdAt ?? "").trim() || new Date().toISOString();
  const normalizedProjects = (Array.isArray(record.projects) && record.projects.length
    ? record.projects
    : parseLegacyWeeklyProgressContent(record.content, taskFallbackTimestamp)
  )
    .map((project) => normalizeWeeklyProgressProjectItem(project, taskFallbackTimestamp))
    .filter((project): project is WeeklyProgressProjectItem => Boolean(project));
  const normalizedTemplates = normalizeWeeklyReportTemplates(record);

  return {
    ...record,
    content: normalizedProjects.length ? buildWeeklyProgressContent(normalizedProjects) : String(record.content ?? "").trim(),
    projects: normalizedProjects,
    reportTemplates: normalizedTemplates.reportTemplates,
    selectedReportTemplateId: normalizedTemplates.selectedReportTemplateId,
    reportTemplate: normalizedTemplates.reportTemplate,
    generatedDailyReport: record.generatedDailyReport ?? "",
    generatedReport: record.generatedReport ?? "",
    generatedPerformanceReport: record.generatedPerformanceReport ?? "",
    status: record.status ?? "archived"
  };
}

function createWeeklyProgressRecord(referenceDate = new Date(), projects: WeeklyProgressProjectItem[] = []): WeeklyProgressRecord {
  const range = getWeekRange(referenceDate);
  const timestamp = new Date().toISOString();

  return {
    id: `weekly_${randomUUID()}`,
    weekKey: range.weekKey,
    title: range.title,
    startDate: range.startDate,
    endDate: range.endDate,
    content: buildWeeklyProgressContent(projects),
    projects,
    reportTemplates: [createDefaultWeeklyReportTemplateItem()],
    selectedReportTemplateId: DEFAULT_WEEKLY_REPORT_TEMPLATE_ID,
    reportTemplate: DEFAULT_WEEKLY_REPORT_TEMPLATE,
    generatedDailyReport: "",
    generatedReport: "",
    generatedPerformanceReport: "",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function readWeeklyProgressRecords(): Promise<WeeklyProgressRecord[]> {
  const filePath = getWeeklyProgressFilePath();

  try {
    const records = await readJsonFile<WeeklyProgressRecord[]>(filePath);
    return sortWeeklyProgress(records.map(normalizeWeeklyProgressRecord));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeWeeklyProgressRecords(records: WeeklyProgressRecord[]): Promise<void> {
  const directory = getWorkbenchDirectoryPath();
  const filePath = getWeeklyProgressFilePath();

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(sortWeeklyProgress(records), null, 2)}\n`, "utf8");
}

async function ensureWeeklyProgressRecords(): Promise<WeeklyProgressRecord[]> {
  const currentRange = getWeekRange();
  const timestamp = new Date().toISOString();
  let changed = false;

  const normalizedRecords = (await readWeeklyProgressRecords()).map((record): WeeklyProgressRecord => {
    if (record.status === "active" && record.weekKey !== currentRange.weekKey) {
      changed = true;

      return {
        ...record,
        status: "archived",
        archivedAt: record.archivedAt ?? timestamp,
        updatedAt: timestamp
      };
    }

    return record;
  });

  if (!normalizedRecords.some((record) => record.weekKey === currentRange.weekKey)) {
    const previousRecord =
      sortWeeklyProgress(normalizedRecords).find((record) => record.weekKey < currentRange.weekKey) ?? null;
    const carriedProjects = buildCarryForwardProjectsFromWeeklyRecord(previousRecord);

    normalizedRecords.unshift(createWeeklyProgressRecord(new Date(), carriedProjects));
    changed = true;
  }

  const sortedRecords = sortWeeklyProgress(normalizedRecords);

  if (changed) {
    await writeWeeklyProgressRecords(sortedRecords);
  }

  return sortedRecords;
}

export async function listTasks(): Promise<WorkTask[]> {
  const filePath = resolveFromRoot("data", "workbench", "tasks.json");
  try {
    return await readJsonFile<WorkTask[]>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function listDatabaseConnections(): Promise<DatabaseConnectionItem[]> {
  const filePath = resolveFromRoot("data", "workbench", "database-connections.json");
  try {
    return await readJsonFile<DatabaseConnectionItem[]>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function saveTasks(tasks: WorkTask[]): Promise<void> {
  const directory = getWorkbenchDirectoryPath();
  const filePath = resolveFromRoot("data", "workbench", "tasks.json");

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
}

export async function listModelSettings(): Promise<ModelSettings> {
  const filePath = resolveFromRoot("data", "workbench", "model-settings.json");

  try {
    return await readJsonFile<ModelSettings>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return getDefaultModelSettings();
    }

    throw error;
  }
}

export async function saveModelSettings(settings: ModelSettings): Promise<void> {
  const directory = getWorkbenchDirectoryPath();
  const filePath = resolveFromRoot("data", "workbench", "model-settings.json");

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export async function upsertModelProfile(profile: ModelProfile): Promise<ModelSettings> {
  const current = await listModelSettings();
  const existingIndex = current.profiles.findIndex((entry) => entry.id === profile.id);
  const nextProfiles = [...current.profiles];

  if (existingIndex >= 0) {
    nextProfiles[existingIndex] = profile;
  } else {
    nextProfiles.unshift(profile);
  }

  const nextSettings: ModelSettings = {
    profiles: nextProfiles,
    activeProfileId: current.activeProfileId
  };

  await saveModelSettings(nextSettings);
  return nextSettings;
}

export async function reorderModelProfiles(profileIds: string[]): Promise<ModelSettings> {
  const current = await listModelSettings();
  const normalizedProfileIds = profileIds.map((profileId) => String(profileId ?? "").trim()).filter(Boolean);
  const uniqueProfileIds = new Set(normalizedProfileIds);
  const profileById = new Map(current.profiles.map((profile) => [profile.id, profile]));

  if (
    normalizedProfileIds.length !== current.profiles.length ||
    uniqueProfileIds.size !== current.profiles.length ||
    normalizedProfileIds.some((profileId) => !profileById.has(profileId))
  ) {
    throw new Error("模型配置排序失败：传入的模型列表与当前配置不一致。");
  }

  const nextSettings: ModelSettings = {
    profiles: normalizedProfileIds.map((profileId) => profileById.get(profileId)!),
    activeProfileId: current.activeProfileId && profileById.has(current.activeProfileId) ? current.activeProfileId : null
  };

  await saveModelSettings(nextSettings);
  return nextSettings;
}

export async function saveModelProfileBalanceSnapshot(
  profileId: string,
  balanceSnapshot: ModelBalanceSnapshot | null
): Promise<ModelSettings> {
  const current = await listModelSettings();
  const nextProfiles = current.profiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          balanceSnapshot
        }
      : profile
  );

  const nextSettings: ModelSettings = {
    profiles: nextProfiles,
    activeProfileId: current.activeProfileId
  };

  await saveModelSettings(nextSettings);
  return nextSettings;
}

const MODEL_BALANCE_HISTORY_RETENTION_DAYS = 95;
const MODEL_BALANCE_VALUE_EPSILON = 1e-6;

function sortModelBalanceHistory(entries: ModelBalanceHistoryEntry[]): ModelBalanceHistoryEntry[] {
  return [...entries].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
}

function isValidModelBalanceSnapshot(snapshot: Partial<ModelBalanceSnapshot> | undefined): snapshot is ModelBalanceSnapshot {
  const remaining = Number(snapshot?.remaining);
  const used = Number(snapshot?.used);
  const total = snapshot?.total == null ? null : Number(snapshot.total);

  if (!Number.isFinite(remaining) || !Number.isFinite(used)) {
    return false;
  }

  if (used < -MODEL_BALANCE_VALUE_EPSILON) {
    return false;
  }

  if (total != null && (!Number.isFinite(total) || total < -MODEL_BALANCE_VALUE_EPSILON)) {
    return false;
  }

  return !(total != null && remaining - total > MODEL_BALANCE_VALUE_EPSILON);
}

function normalizeModelBalanceHistoryEntry(input: Partial<ModelBalanceHistoryEntry>): ModelBalanceHistoryEntry | null {
  const profileId = String(input.profileId ?? "").trim();
  const snapshot = input.snapshot;
  const recordedAt = String(input.recordedAt ?? snapshot?.queriedAt ?? "").trim();

  if (!profileId || !snapshot || !recordedAt || !isValidModelBalanceSnapshot(snapshot)) {
    return null;
  }

  const updatedAt = String(input.updatedAt ?? recordedAt).trim() || recordedAt;

  return {
    id: String(input.id ?? "").trim() || `model_balance_${randomUUID()}`,
    profileId,
    profileName: String(input.profileName ?? "").trim() || "未命名模型",
    provider: input.provider ?? "openai_like",
    model: String(input.model ?? "").trim(),
    snapshot: {
      planName: snapshot.planName,
      remaining: Number(snapshot.remaining),
      used: Number(snapshot.used),
      total: snapshot.total == null ? null : Number(snapshot.total),
      unit: String(snapshot.unit ?? "USD").trim() || "USD",
      queriedAt: String(snapshot.queriedAt ?? recordedAt).trim() || recordedAt
    },
    source: input.source === "scheduled" ? "scheduled" : "manual",
    recordedAt,
    updatedAt
  };
}

export async function listModelBalanceHistory(profileId?: string): Promise<ModelBalanceHistoryEntry[]> {
  const normalizedProfileId = String(profileId ?? "").trim();
  const entries = (await readWorkbenchCollection<Partial<ModelBalanceHistoryEntry>>(getModelBalanceHistoryFilePath()))
    .map(normalizeModelBalanceHistoryEntry)
    .filter((entry): entry is ModelBalanceHistoryEntry => Boolean(entry));

  return sortModelBalanceHistory(
    normalizedProfileId ? entries.filter((entry) => entry.profileId === normalizedProfileId) : entries
  );
}

export async function appendModelBalanceHistoryEntry(
  profile: ModelProfile,
  balanceSnapshot: ModelBalanceSnapshot,
  source: ModelBalanceHistorySource = "manual"
): Promise<ModelBalanceHistoryEntry[]> {
  const timestamp = balanceSnapshot.queriedAt || new Date().toISOString();
  const entry: ModelBalanceHistoryEntry = {
    id: `model_balance_${randomUUID()}`,
    profileId: profile.id,
    profileName: profile.displayName,
    provider: profile.provider,
    model: profile.model,
    snapshot: balanceSnapshot,
    source,
    recordedAt: timestamp,
    updatedAt: timestamp
  };
  const retentionStartMs = Date.now() - MODEL_BALANCE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const current = await listModelBalanceHistory();
  const nextEntries = sortModelBalanceHistory([entry, ...current]).filter((item) => {
    const recordedAtMs = Date.parse(item.recordedAt);
    return Number.isNaN(recordedAtMs) || recordedAtMs >= retentionStartMs;
  });

  await writeWorkbenchCollection(getModelBalanceHistoryFilePath(), nextEntries);
  return listModelBalanceHistory(profile.id);
}

async function deleteModelBalanceHistoryForProfile(profileId: string): Promise<void> {
  const normalizedProfileId = String(profileId ?? "").trim();

  if (!normalizedProfileId) {
    return;
  }

  const current = await listModelBalanceHistory();
  await writeWorkbenchCollection(
    getModelBalanceHistoryFilePath(),
    current.filter((entry) => entry.profileId !== normalizedProfileId)
  );
}

export async function activateModelProfile(profileId: string): Promise<ModelSettings> {
  const current = await listModelSettings();

  const nextSettings: ModelSettings = {
    profiles: current.profiles,
    activeProfileId: current.profiles.some((profile) => profile.id === profileId) ? profileId : null
  };

  await saveModelSettings(nextSettings);
  return nextSettings;
}

export async function toggleModelProfileStatus(profileId: string): Promise<ModelSettings> {
  const current = await listModelSettings();
  const hasProfile = current.profiles.some((profile) => profile.id === profileId);

  const nextSettings: ModelSettings = {
    profiles: current.profiles,
    activeProfileId: !hasProfile ? current.activeProfileId : current.activeProfileId === profileId ? null : profileId
  };

  await saveModelSettings(nextSettings);
  return nextSettings;
}

export async function deleteModelProfile(profileId: string): Promise<ModelSettings> {
  const current = await listModelSettings();
  const nextProfiles = current.profiles.filter((profile) => profile.id !== profileId);
  const nextSettings: ModelSettings = {
    profiles: nextProfiles,
    activeProfileId: current.activeProfileId === profileId ? null : current.activeProfileId
  };

  await saveModelSettings(nextSettings);
  await deleteModelBalanceHistoryForProfile(profileId);
  return nextSettings;
}

export async function listWeeklyProgress(): Promise<WeeklyProgressRecord[]> {
  return ensureWeeklyProgressRecords();
}

export async function saveWeeklyProgress(record: WeeklyProgressRecord): Promise<WeeklyProgressRecord[]> {
  const currentRecords = await ensureWeeklyProgressRecords();
  const timestamp = new Date().toISOString();
  const currentRange = getWeekRange();
  const nextRecord = normalizeWeeklyProgressRecord({
    ...record,
    title: record.title?.trim() ? record.title : currentRange.title,
    updatedAt: timestamp
  });
  const existingIndex = currentRecords.findIndex((entry) => entry.id === nextRecord.id);
  const nextRecords = [...currentRecords];

  if (existingIndex >= 0) {
    nextRecords[existingIndex] = {
      ...nextRecords[existingIndex],
      ...nextRecord
    };
  } else {
    nextRecords.unshift(nextRecord);
  }

  await writeWeeklyProgressRecords(nextRecords);
  return ensureWeeklyProgressRecords();
}

export async function deleteWeeklyProgress(recordId: string): Promise<WeeklyProgressRecord[]> {
  const currentRecords = await ensureWeeklyProgressRecords();
  const nextRecords = currentRecords.filter((record) => record.id !== recordId);

  await writeWeeklyProgressRecords(nextRecords);
  return ensureWeeklyProgressRecords();
}

export async function getWeeklyFeishuSettings(): Promise<WeeklyFeishuSettings> {
  const filePath = getWeeklyFeishuSettingsFilePath();

  try {
    return normalizeWeeklyFeishuSettings(await readJsonFile<WeeklyFeishuSettings>(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return getDefaultWeeklyFeishuSettings();
    }

    throw error;
  }
}

export async function saveWeeklyFeishuSettings(settings: WeeklyFeishuSettings): Promise<WeeklyFeishuSettings> {
  const directory = getWorkbenchDirectoryPath();
  const filePath = getWeeklyFeishuSettingsFilePath();
  const normalizedSettings = normalizeWeeklyFeishuSettings(settings, { touch: true });

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalizedSettings, null, 2)}\n`, "utf8");

  return normalizedSettings;
}

async function readWorkbenchCollection<T>(filePath: string): Promise<T[]> {
  try {
    return await readJsonFile<T[]>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeWorkbenchCollection<T>(filePath: string, items: T[]): Promise<void> {
  await mkdir(getWorkbenchDirectoryPath(), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function sortByUpdatedAtDescending<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

const DEFAULT_TOOL_CONFIG_UPDATED_AT = "2026-05-11T00:00:00.000Z";
const TOOL_CONFIG_NAMES = new Set<ToolConfigName>(["image_gen", "video_gen", "music_gen"]);
const TOOL_CONFIG_PROVIDERS = new Set<ToolConfigProvider>([
  "openai",
  "gemini",
  "jimeng",
  "seedance",
  "pixverse",
  "veo",
  "sora",
  "mureka",
  "suno"
]);

const TOOL_CONFIG_CATALOG: Record<
  ToolConfigName,
  {
    title: string;
    description: string;
    providers: Array<{ provider: ToolConfigProvider; label: string }>;
  }
> = {
  image_gen: {
    title: "图片生成",
    description: "内置图片生成工具能力，供 Agent 或应用工作流按工具语义调用。",
    providers: [
      { provider: "openai", label: "OpenAI" },
      { provider: "gemini", label: "Gemini" },
      { provider: "jimeng", label: "即梦" }
    ]
  },
  video_gen: {
    title: "视频生成",
    description: "内置视频生成工具能力，面向文生视频、图生视频、首尾帧生视频、参考图生视频和分镜生成台。",
    providers: [
      { provider: "seedance", label: "Seedance" },
      { provider: "pixverse", label: "PixVerse" },
      { provider: "veo", label: "Veo" },
      { provider: "sora", label: "Sora" }
    ]
  },
  music_gen: {
    title: "音乐生成",
    description: "内置音乐生成工具能力，面向配乐、歌曲草稿和声音资产生成。",
    providers: [
      { provider: "mureka", label: "Mureka" },
      { provider: "suno", label: "Suno" }
    ]
  }
};

const TOOL_PROVIDER_RUNTIME_CONFIG: Partial<
  Record<ToolConfigName, Partial<Record<ToolConfigProvider, ToolProviderRuntimeConfig>>>
> = {
  image_gen: {
    openai: {
      operations: {
        text_to_image: {
          endpoint: "imagen",
          parameters: ["prompt", "model", "size", "n", "quality"]
        },
        image_to_image: {
          endpoint: "imagen/edit",
          parameters: ["prompt", "model", "size", "n", "quality", "image", "images"]
        }
      }
    }
  },
  video_gen: {
    seedance: {
      operations: {
        submit: {
          endpoint: "gpt-proxy/volengine/video/submit",
          parameters: [
            "mode",
            "prompt",
            "model",
            "durationSeconds",
            "ratio",
            "resolution",
            "image",
            "firstFrameImage",
            "lastFrameImage",
            "referenceImages",
            "referenceVideos",
            "referenceAudios",
            "returnLastFrame",
            "generateAudio",
            "frames",
            "priority"
          ]
        },
        query: {
          endpoint: "gpt-proxy/volengine/video/task/{task_id}",
          parameters: ["taskId"]
        }
      }
    }
  },
  music_gen: {
    mureka: {
      operations: {
        generate_song: {
          endpoint: "v1/song/generate",
          parameters: ["prompt", "lyrics", "model"]
        },
        generate_instrumental: {
          endpoint: "v1/soundtrack/generate",
          parameters: ["prompt", "model", "durationSeconds"]
        },
        query: {
          endpoint: "v1/song/query/{task_id}",
          parameters: ["taskId"]
        },
        vocal_clone: {
          endpoint: "v1/vocal/clone",
          parameters: ["filePath"]
        }
      }
    },
    suno: {
      operations: {
        generate_song: {
          endpoint: "gpt-proxy/suno/generate",
          parameters: ["prompt", "model", "instrumental"]
        },
        generate_instrumental: {
          endpoint: "gpt-proxy/suno/generate",
          parameters: ["prompt", "model", "instrumental"]
        },
        query: {
          endpoint: "gpt-proxy/suno/detail",
          parameters: ["taskId"]
        }
      }
    }
  }
};

const TOOL_PROVIDER_DEFAULT_BASE_URLS: Partial<Record<ToolConfigName, Partial<Record<ToolConfigProvider, string>>>> = {
  video_gen: {
    seedance: ""
  },
  music_gen: {
    mureka: "https://api.mureka.ai",
    suno: "https://api.sunoapi.org"
  }
};

const TOOL_PROVIDER_DEFAULT_REQUEST_PROTOCOLS: Partial<
  Record<
    ToolConfigName,
    Partial<
      Record<
        ToolConfigProvider,
        {
          submitUrl?: string;
          queryUrl?: string;
          taskIdPath?: string;
          resultUrlPath?: string;
        }
      >
    >
  >
> = {
  video_gen: {
    seedance: {
      submitUrl: "https://api-maas-test.singularity-ai.com/gpt-proxy/volengine/video/submit",
      queryUrl: "https://api-maas-test.singularity-ai.com/gpt-proxy/volengine/video/task/{task_id}",
      taskIdPath: "$.data.task_id",
      resultUrlPath: "$.data.video_url"
    }
  }
};

function cloneToolProviderRuntimeConfig(config: ToolProviderRuntimeConfig | undefined): ToolProviderRuntimeConfig | undefined {
  if (!config) {
    return undefined;
  }

  const operations: Record<string, { endpoint: string; parameters: string[] }> = {};

  for (const [operationName, operation] of Object.entries(config.operations)) {
    operations[operationName] = {
      endpoint: operation.endpoint,
      parameters: [...operation.parameters]
    };
  }

  return { operations };
}

function getDefaultToolProviderRuntimeConfig(
  toolName: ToolConfigName,
  provider: ToolConfigProvider
): ToolProviderRuntimeConfig | undefined {
  return cloneToolProviderRuntimeConfig(TOOL_PROVIDER_RUNTIME_CONFIG[toolName]?.[provider]);
}

function normalizeToolProviderBaseUrl(toolName: ToolConfigName, provider: ToolConfigProvider, baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/^["']+/u, "").replace(/["']+$/u, "");

  if (toolName === "image_gen" && provider === "openai") {
    return normalizedBaseUrl.replace(/\/imagen(?:\/edit(?:\/base64)?)?\/?$/u, "");
  }

  if (toolName === "video_gen" && provider === "seedance") {
    return normalizedBaseUrl
      .replace(/\/gpt-proxy\/volengine\/video(?:\/(?:submit|task(?:\/[^/]+)?))?\/?$/u, "")
      .replace(/\/api\/v3\/contents\/generations\/tasks(?:\/[^/]+)?\/?$/u, "")
      .replace(/\/api\/v3\/?$/u, "");
  }

  if (toolName === "music_gen" && provider === "suno") {
    return normalizedBaseUrl.replace(/\/(?:api\/v1\/generate(?:\/record-info)?|gpt-proxy\/suno\/(?:generate|detail))\/?$/u, "");
  }

  return normalizedBaseUrl;
}

function normalizeToolProviderUrl(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^["']+/u, "")
    .replace(/["']+$/u, "");
}

function joinToolProviderUrl(baseUrl: string, endpoint: string): string {
  const normalizedBaseUrl = normalizeToolProviderUrl(baseUrl).replace(/\/+$/u, "");
  const normalizedEndpoint = String(endpoint ?? "").trim().replace(/^\/+/u, "");

  if (!normalizedBaseUrl || !normalizedEndpoint) {
    return "";
  }

  return `${normalizedBaseUrl}/${normalizedEndpoint}`;
}

function deriveToolProviderOperationUrl(
  toolName: ToolConfigName,
  providerName: ToolConfigProvider,
  provider: Partial<ToolProviderConfig> | null | undefined,
  operationName: string
): string {
  const operation = provider?.runtime?.operations?.[operationName] ?? TOOL_PROVIDER_RUNTIME_CONFIG[toolName]?.[providerName]?.operations?.[operationName];
  const rawEndpoint = String(operation?.endpoint ?? "").trim();

  if (!rawEndpoint) {
    return "";
  }

  if (/^https?:\/\//iu.test(rawEndpoint)) {
    return normalizeToolProviderUrl(rawEndpoint);
  }

  const rawBaseUrl = normalizeToolProviderUrl(provider?.baseUrl);
  const normalizedBaseUrl = normalizeToolProviderBaseUrl(toolName, providerName, rawBaseUrl);

  return joinToolProviderUrl(normalizedBaseUrl || rawBaseUrl, rawEndpoint);
}

function normalizeToolProviderModel(toolName: ToolConfigName, provider: ToolConfigProvider, value: unknown): string {
  const model = String(value ?? "").trim();

  if (toolName === "video_gen" && provider === "seedance" && model === "doubao-seedance-2-0-260128-video") {
    return "doubao-seedance-2-0-260128";
  }

  return model;
}

function createDefaultToolProviderConfig(toolName: ToolConfigName, provider: ToolConfigProvider, label: string): ToolProviderConfig {
  const runtime = getDefaultToolProviderRuntimeConfig(toolName, provider);
  const baseUrl = TOOL_PROVIDER_DEFAULT_BASE_URLS[toolName]?.[provider] ?? "";
  const requestProtocol = TOOL_PROVIDER_DEFAULT_REQUEST_PROTOCOLS[toolName]?.[provider] ?? {};

  return {
    id: `tool_provider_${toolName}_${provider}`,
    provider,
    label,
    model: toolName === "video_gen" && provider === "seedance" ? "doubao-seedance-2-0-260128" : "",
    apiKey: "",
    baseUrl,
    ...(requestProtocol.submitUrl ? { submitUrl: requestProtocol.submitUrl } : {}),
    ...(requestProtocol.queryUrl ? { queryUrl: requestProtocol.queryUrl } : {}),
    ...(requestProtocol.taskIdPath ? { taskIdPath: requestProtocol.taskIdPath } : {}),
    ...(requestProtocol.resultUrlPath ? { resultUrlPath: requestProtocol.resultUrlPath } : {}),
    enabled: false,
    notes: "",
    ...(runtime ? { runtime } : {}),
    updatedAt: DEFAULT_TOOL_CONFIG_UPDATED_AT
  };
}

function createDefaultToolConfig(name: ToolConfigName): ToolConfig {
  const catalog = TOOL_CONFIG_CATALOG[name];
  const providers = catalog.providers.map((provider) =>
    createDefaultToolProviderConfig(name, provider.provider, provider.label)
  );

  return {
    id: `tool_${name}`,
    name,
    title: catalog.title,
    description: catalog.description,
    defaultProvider: providers[0]?.provider ?? null,
    providers,
    enabled: false,
    updatedAt: DEFAULT_TOOL_CONFIG_UPDATED_AT
  };
}

function getDefaultToolConfigs(): ToolConfig[] {
  return ["image_gen", "video_gen", "music_gen"].map((name) => createDefaultToolConfig(name as ToolConfigName));
}

function normalizeToolConfigName(value: unknown): ToolConfigName | null {
  const name = String(value ?? "").trim();
  return TOOL_CONFIG_NAMES.has(name as ToolConfigName) ? (name as ToolConfigName) : null;
}

function normalizeToolConfigProvider(value: unknown): ToolConfigProvider | null {
  const provider = String(value ?? "").trim();
  return TOOL_CONFIG_PROVIDERS.has(provider as ToolConfigProvider) ? (provider as ToolConfigProvider) : null;
}

function normalizeToolProviderConfig(
  toolName: ToolConfigName,
  provider: Partial<ToolProviderConfig> | null | undefined,
  defaultProvider: ToolProviderConfig
): ToolProviderConfig {
  const normalizedProvider = normalizeToolConfigProvider(provider?.provider) ?? defaultProvider.provider;
  const updatedAt = String(provider?.updatedAt ?? "").trim() || defaultProvider.updatedAt;
  const runtime = cloneToolProviderRuntimeConfig(defaultProvider.runtime);
  const inputBaseUrl = String(provider?.baseUrl ?? "").trim();
  const defaultRequestProtocol = TOOL_PROVIDER_DEFAULT_REQUEST_PROTOCOLS[toolName]?.[normalizedProvider] ?? {};
  const submitUrl =
    normalizeToolProviderUrl(provider?.submitUrl) ||
    deriveToolProviderOperationUrl(toolName, normalizedProvider, provider, "submit") ||
    defaultRequestProtocol.submitUrl ||
    defaultProvider.submitUrl ||
    "";
  const queryUrl =
    normalizeToolProviderUrl(provider?.queryUrl) ||
    deriveToolProviderOperationUrl(toolName, normalizedProvider, provider, "query") ||
    defaultRequestProtocol.queryUrl ||
    defaultProvider.queryUrl ||
    "";
  const taskIdPath =
    String(provider?.taskIdPath ?? "").trim() ||
    defaultRequestProtocol.taskIdPath ||
    defaultProvider.taskIdPath ||
    "";
  const resultUrlPath =
    String(provider?.resultUrlPath ?? "").trim() ||
    defaultRequestProtocol.resultUrlPath ||
    defaultProvider.resultUrlPath ||
    "";

  return {
    id: String(provider?.id ?? "").trim() || defaultProvider.id,
    provider: normalizedProvider,
    label: String(provider?.label ?? "").trim() || defaultProvider.label,
    model: normalizeToolProviderModel(toolName, normalizedProvider, provider?.model),
    apiKey: String(provider?.apiKey ?? ""),
    baseUrl: normalizeToolProviderBaseUrl(toolName, normalizedProvider, inputBaseUrl || defaultProvider.baseUrl || ""),
    ...(submitUrl ? { submitUrl } : {}),
    ...(queryUrl ? { queryUrl } : {}),
    ...(taskIdPath ? { taskIdPath } : {}),
    ...(resultUrlPath ? { resultUrlPath } : {}),
    enabled: Boolean(provider?.enabled),
    notes: String(provider?.notes ?? ""),
    ...(runtime ? { runtime } : {}),
    updatedAt
  };
}

function normalizeToolConfig(config: Partial<ToolConfig> | null | undefined): ToolConfig | null {
  const name = normalizeToolConfigName(config?.name);

  if (!name) {
    return null;
  }

  const defaultConfig = createDefaultToolConfig(name);
  const inputProviders = Array.isArray(config?.providers) ? config.providers : [];
  const inputProviderEntries: Array<readonly [ToolConfigProvider, Partial<ToolProviderConfig>]> = [];

  for (const provider of inputProviders) {
    const providerName = normalizeToolConfigProvider(provider?.provider);

    if (providerName) {
      inputProviderEntries.push([providerName, provider]);
    }
  }

  const inputProviderByName = new Map<ToolConfigProvider, Partial<ToolProviderConfig>>(inputProviderEntries);
  const providers = defaultConfig.providers.map((provider) =>
    normalizeToolProviderConfig(name, inputProviderByName.get(provider.provider), provider)
  );
  const configuredDefaultProvider = normalizeToolConfigProvider(config?.defaultProvider);
  const defaultProvider = providers.some((provider) => provider.provider === configuredDefaultProvider)
    ? configuredDefaultProvider
    : defaultConfig.defaultProvider;

  return {
    id: String(config?.id ?? "").trim() || defaultConfig.id,
    name,
    title: String(config?.title ?? "").trim() || defaultConfig.title,
    description: String(config?.description ?? "").trim() || defaultConfig.description,
    defaultProvider,
    providers,
    enabled: Boolean(config?.enabled),
    updatedAt: String(config?.updatedAt ?? "").trim() || defaultConfig.updatedAt
  };
}

const WRITING_BOOK_CONFIG_FILE_NAME = "book.json";
const WRITING_BOOK_CHAPTERS_FILE_NAME = "chapters.json";
const WRITING_BOOK_CHAPTERS_DIRECTORY_NAME = "chapters";
const WRITING_BOOK_LENGTHS = new Set<WritingBookLength>(["short", "medium", "long"]);
const WRITING_BOOK_PART_TYPES = new Set<WritingBookPartType>(["act", "volume"]);
const WRITING_CHAPTER_STATUSES = new Set<WritingChapterStatus>(["todo", "inProgress", "done"]);
const WRITING_OUTLINE_PLANNER_STATUSES = new Set<WritingOutlinePlannerStatus>(["idle", "running", "completed", "failed", "cancelled"]);
const WRITING_NARRATIVE_STATE_NODE_KINDS = new Set<WritingNarrativeStateNodeKind>([
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
const WRITING_NARRATIVE_RISK_LEVELS = new Set<WritingNarrativeRiskLevel>(["low", "medium", "high"]);
const WRITING_CHAPTER_CONTENT_FILE_NAME_PATTERN = /^[a-f0-9]{32}\.md$/i;
const WRITING_CHAPTER_PREFIX_PATTERN = /^第\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*章\s*(?:[：:、.\-]\s*)?(.*)$/;
const WRITING_PART_PREFIX_PATTERN = /^(?:第\s*)?([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(幕|卷)\s*(?:[：:、.\-·]\s*)?(.*)$/;

type StoredWritingBookConfig = Omit<WritingBook, "chapters" | "directoryName">;
type StoredWritingChapterMeta = Omit<WritingChapter, "content">;

function sanitizeWritingAssetName(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .replace(/-+/g, "-")
    .trim();

  return normalized || fallback;
}

function normalizeWritingBookLength(value: unknown): WritingBookLength {
  const length = String(value ?? "");
  return WRITING_BOOK_LENGTHS.has(length as WritingBookLength) ? (length as WritingBookLength) : "long";
}

function normalizeWritingChapterStatus(value: unknown): WritingChapterStatus {
  const status = String(value ?? "");
  return WRITING_CHAPTER_STATUSES.has(status as WritingChapterStatus) ? (status as WritingChapterStatus) : "todo";
}

function normalizeWritingOutlinePlannerStatus(value: unknown): WritingOutlinePlannerStatus {
  const status = String(value ?? "");
  return WRITING_OUTLINE_PLANNER_STATUSES.has(status as WritingOutlinePlannerStatus) ? (status as WritingOutlinePlannerStatus) : "idle";
}

function normalizeWritingBookPartType(value: unknown): WritingBookPartType {
  const type = String(value ?? "");
  return WRITING_BOOK_PART_TYPES.has(type as WritingBookPartType) ? (type as WritingBookPartType) : "act";
}

function normalizeWritingGenreProfile(
  input: Partial<WritingGenreProfile> | Record<string, unknown> | null | undefined,
  fallbackGenre = ""
): WritingGenreProfile {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const fallbackParts = normalizeStringList(fallbackGenre);
  const primaryGenre = String(source.primaryGenre ?? source.genre ?? fallbackParts[0] ?? fallbackGenre ?? "").trim();
  const storyEngine = String(source.storyEngine ?? source.engine ?? "").trim();

  return {
    primaryGenre: primaryGenre || "小说",
    subGenres: normalizeStringList(source.subGenres ?? source.subgenres ?? fallbackParts.slice(1)),
    storyEngine: storyEngine === "成长升级" ? "成长沉淀" : storyEngine,
    ...(source.audience ? { audience: String(source.audience).trim() } : {}),
    ...(source.tone ? { tone: String(source.tone).trim() } : {}),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function parseStoredWritingChapterIndex(value: unknown): number | null {
  const normalizedValue = String(value ?? "")
    .trim()
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));

  if (/^\d+$/.test(normalizedValue)) {
    const parsedValue = Number(normalizedValue);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  const digits: Record<string, number> = {
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
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
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

function normalizeWritingChapterIndex(value: unknown, fallbackIndex: number): number {
  const normalizedFallback = Number.isFinite(fallbackIndex) && fallbackIndex >= 0 ? fallbackIndex + 1 : 1;
  return parseStoredWritingChapterIndex(value) ?? normalizedFallback;
}

function normalizeNonNegativeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function splitStoredWritingChapterTitle(value: unknown): { index: number | null; title: string } {
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
    index: parseStoredWritingChapterIndex(match[1]),
    title: String(match[2] ?? "").trim()
  };
}

function splitStoredWritingPartTitle(value: unknown): { index: number | null; type: WritingBookPartType | null; title: string } {
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
    index: parseStoredWritingChapterIndex(match[1]),
    type: match[2] === "卷" ? "volume" : "act",
    title: String(match[3] ?? "").trim()
  };
}

function normalizeWritingBookPart(input: Partial<WritingBookPart> | null | undefined, index: number, bookId: string): WritingBookPart {
  const titleParts = splitStoredWritingPartTitle(input?.title);
  const partIndex = normalizeWritingChapterIndex(input?.index ?? titleParts.index, index);
  const partType = normalizeWritingBookPartType(input?.type ?? titleParts.type);

  return {
    id: String(input?.id ?? `${bookId}_part_${partIndex}`),
    type: partType,
    index: partIndex,
    title: titleParts.title || `未命名${partType === "volume" ? "卷" : "幕"} ${partIndex}`,
    description: String(input?.description ?? "")
  };
}

function normalizeWritingBookParts(input: unknown, bookId: string): WritingBookPart[] {
  return (Array.isArray(input) ? input : [])
    .map((part, index) => normalizeWritingBookPart(part as Partial<WritingBookPart>, index, bookId))
    .sort((left, right) => left.index - right.index);
}

function normalizeWritingBookIntroSection(
  input: Partial<WritingBookIntroSection> | Record<string, unknown> | null | undefined,
  index: number,
  bookId: string
): WritingBookIntroSection | null {
  const title = String(input?.title ?? (input as Record<string, unknown> | undefined)?.label ?? "").trim();
  const content = String(input?.content ?? (input as Record<string, unknown> | undefined)?.value ?? "");

  if (!title && !content.trim()) {
    return null;
  }

  return {
    id: String(input?.id ?? `${bookId}_intro_section_${index + 1}`),
    title: title || `补充设定 ${index + 1}`,
    content,
    updatedAt: String(input?.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingBookIntroSections(input: unknown, bookId: string): WritingBookIntroSection[] {
  return (Array.isArray(input) ? input : [])
    .map((section, index) => normalizeWritingBookIntroSection(section as Partial<WritingBookIntroSection>, index, bookId))
    .filter((section): section is WritingBookIntroSection => Boolean(section));
}

function normalizeStringList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return String(input ?? "")
    .split(/[,\n，、]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalChapterIndex(value: unknown): number | undefined {
  return value === null || value === undefined || value === "" ? undefined : normalizeWritingChapterIndex(value, 0);
}

function normalizeWritingEvidenceRef(
  input: Partial<WritingEvidenceRef> | Record<string, unknown> | string | null | undefined,
  index: number,
  bookId: string
): WritingEvidenceRef | null {
  const source = input && typeof input === "object" ? input : { note: input };
  const note = String(
    source.note ??
      (source as Record<string, unknown>).summary ??
      (source as Record<string, unknown>).detail ??
      (source as Record<string, unknown>).evidence ??
      ""
  ).trim();
  const quote = String((source as Record<string, unknown>).quote ?? (source as Record<string, unknown>).text ?? "").trim();
  const chapterIndex = normalizeOptionalChapterIndex(
    (source as Record<string, unknown>).chapterIndex ?? (source as Record<string, unknown>).chapter
  );
  const chapterId = String((source as Record<string, unknown>).chapterId ?? "").trim();

  if (!note && !quote && !chapterIndex && !chapterId) {
    return null;
  }

  return {
    id: String((source as Record<string, unknown>).id ?? `${bookId}_evidence_${index + 1}`),
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(quote ? { quote } : {}),
    note: note || quote || (chapterIndex ? `第${chapterIndex}章证据` : "证据")
  };
}

function normalizeWritingEvidenceRefs(input: unknown, bookId: string): WritingEvidenceRef[] {
  if (Array.isArray(input)) {
    return input
      .map((entry, index) => normalizeWritingEvidenceRef(entry as Partial<WritingEvidenceRef>, index, bookId))
      .filter((entry): entry is WritingEvidenceRef => Boolean(entry));
  }

  const normalized = normalizeWritingEvidenceRef(input as string, 0, bookId);
  return normalized ? [normalized] : [];
}

function normalizeWritingEvidenceRefsFromSource(source: Record<string, unknown>, bookId: string): WritingEvidenceRef[] {
  const explicit = normalizeWritingEvidenceRefs(source.evidenceRefs, bookId);
  const legacyEvidence = normalizeWritingEvidenceRefs(source.evidence ?? source.evidenceText, bookId);
  const chapterIndex = normalizeOptionalChapterIndex(source.chapterIndex ?? source.chapter);
  const chapterId = String(source.chapterId ?? "").trim();

  if (!chapterIndex && !chapterId) {
    return [...explicit, ...legacyEvidence];
  }

  const chapterEvidence: WritingEvidenceRef = {
    id: `${bookId}_chapter_evidence_${chapterId || chapterIndex || explicit.length + legacyEvidence.length + 1}`,
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(chapterId ? { chapterId } : {}),
    note: chapterIndex ? `第${chapterIndex}章出现或更新` : "章节证据"
  };

  return [...explicit, ...legacyEvidence, chapterEvidence];
}

function normalizeWritingStoryAssetEntry(
  input: Partial<WritingStoryAssetEntry> | Record<string, unknown> | null | undefined,
  index: number,
  bookId: string,
  group: string
): WritingStoryAssetEntry | null {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const timestamp = String(input?.updatedAt ?? new Date().toISOString());
  const title = String(input?.title ?? source.name ?? source.key ?? "").trim();
  const detail = String(
    input?.detail ??
      source.description ??
      source.summary ??
      source.value ??
      ""
  ).trim();
  const chapterIndex = normalizeOptionalChapterIndex(input?.chapterIndex ?? source.chapter);

  if (!title && !detail) {
    return null;
  }

  return {
    id: String(input?.id ?? `${bookId}_${group}_${index + 1}`),
    title: title || `未命名${group} ${index + 1}`,
    detail,
    tags: normalizeStringList(input?.tags),
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(input?.status ? { status: String(input.status) } : {}),
    evidenceRefs: normalizeWritingEvidenceRefsFromSource(source, bookId),
    ...(source.impact ? { impact: String(source.impact).trim() } : {}),
    updatedAt: timestamp
  };
}

function normalizeWritingStoryAssetEntries(input: unknown, bookId: string, group: string): WritingStoryAssetEntry[] {
  return (Array.isArray(input) ? input : [])
    .map((entry, index) => normalizeWritingStoryAssetEntry(entry as Partial<WritingStoryAssetEntry>, index, bookId, group))
    .filter((entry): entry is WritingStoryAssetEntry => Boolean(entry));
}

function normalizeWritingCharacterAsset(
  input: Partial<WritingCharacterAsset> | Record<string, unknown> | null | undefined,
  index: number,
  bookId: string
): WritingCharacterAsset | null {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const name = String(input?.name ?? source.title ?? "").trim();
  const relationships = normalizeStringList(input?.relationships);

  if (
    !name &&
    !input?.role &&
    !input?.goal &&
    !input?.fear &&
    !input?.secret &&
    !input?.growthArc &&
    !(input as Record<string, unknown> | undefined)?.growth_arc &&
    !relationships.length
  ) {
    return null;
  }

  return {
    id: String(input?.id ?? `${bookId}_character_${index + 1}`),
    name: name || `未命名人物 ${index + 1}`,
    role: String(input?.role ?? "").trim(),
    goal: String(input?.goal ?? "").trim(),
    fear: String(input?.fear ?? "").trim(),
    secret: String(input?.secret ?? "").trim(),
    growthArc: String(input?.growthArc ?? (input as Record<string, unknown> | undefined)?.growth_arc ?? "").trim(),
    relationships,
    tags: normalizeStringList(input?.tags),
    status: String(input?.status ?? "active"),
    evidenceRefs: normalizeWritingEvidenceRefsFromSource(source, bookId),
    ...(source.impact ? { impact: String(source.impact).trim() } : {}),
    updatedAt: String(input?.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingCharacterAssets(input: unknown, bookId: string): WritingCharacterAsset[] {
  return (Array.isArray(input) ? input : [])
    .map((entry, index) => normalizeWritingCharacterAsset(entry as Partial<WritingCharacterAsset>, index, bookId))
    .filter((entry): entry is WritingCharacterAsset => Boolean(entry));
}

function normalizeWritingForeshadowAsset(
  input: Partial<WritingForeshadowAsset> | Record<string, unknown> | null | undefined,
  index: number,
  bookId: string
): WritingForeshadowAsset | null {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const title = String(input?.title ?? source.name ?? "").trim();
  const setup = String(input?.setup ?? source.detail ?? "").trim();
  const payoff = String(
    input?.payoff ??
      source.plannedPayoff ??
      source.payoffPlan ??
      ""
  ).trim();
  const chapterIndex = normalizeOptionalChapterIndex(input?.chapterIndex ?? source.setupChapterIndex);
  const payoffChapterIndex = normalizeOptionalChapterIndex(input?.payoffChapterIndex);

  if (!title && !setup && !payoff) {
    return null;
  }

  return {
    id: String(input?.id ?? `${bookId}_foreshadow_${index + 1}`),
    title: title || setup || `未命名伏笔 ${index + 1}`,
    setup,
    payoff,
    status: String(input?.status ?? "open"),
    ...(chapterIndex ? { chapterIndex } : {}),
    ...(payoffChapterIndex ? { payoffChapterIndex } : {}),
    tags: normalizeStringList(input?.tags),
    evidenceRefs: normalizeWritingEvidenceRefsFromSource(source, bookId),
    ...(source.impact ? { impact: String(source.impact).trim() } : {}),
    updatedAt: String(input?.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingForeshadowAssets(input: unknown, bookId: string): WritingForeshadowAsset[] {
  return (Array.isArray(input) ? input : [])
    .map((entry, index) => normalizeWritingForeshadowAsset(entry as Partial<WritingForeshadowAsset>, index, bookId))
    .filter((entry): entry is WritingForeshadowAsset => Boolean(entry));
}

function normalizeWritingStyleProfile(input: Partial<WritingStyleProfile> | null | undefined): WritingStyleProfile {
  return {
    voice: String(input?.voice ?? "").trim(),
    pacing: String(input?.pacing ?? "").trim(),
    genreSignals: normalizeStringList(input?.genreSignals),
    taboos: normalizeStringList(input?.taboos),
    ...(input?.proseDensity ? { proseDensity: String(input.proseDensity).trim() } : {}),
    ...(input?.dialogueRatio ? { dialogueRatio: String(input.dialogueRatio).trim() } : {}),
    ...(input?.narrationDistance ? { narrationDistance: String(input.narrationDistance).trim() } : {}),
    ...(input?.emotionalTemperature ? { emotionalTemperature: String(input.emotionalTemperature).trim() } : {}),
    ...(input?.humorLevel ? { humorLevel: String(input.humorLevel).trim() } : {}),
    ...(input?.violenceExplicitness ? { violenceExplicitness: String(input.violenceExplicitness).trim() } : {}),
    ...(normalizeStringList(input?.pacingCurve).length ? { pacingCurve: normalizeStringList(input?.pacingCurve) } : {})
  };
}

function normalizeWritingCharacterArc(
  input: Partial<WritingCharacterArc> | Record<string, unknown> | null | undefined,
  index: number,
  bookId: string
): WritingCharacterArc | null {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const characterName = String(source.characterName ?? source.name ?? source.title ?? "").trim();
  const want = String(source.want ?? source.goal ?? "").trim();
  const need = String(source.need ?? "").trim();
  const currentStage = String(source.currentStage ?? source.stage ?? "").trim();
  const nextPressure = String(source.nextPressure ?? source.pressure ?? "").trim();
  const endpoint = String(source.endpoint ?? source.endState ?? source.payoff ?? "").trim();

  if (!characterName && !want && !need && !currentStage && !nextPressure && !endpoint) {
    return null;
  }

  return {
    id: String(source.id ?? `${bookId}_character_arc_${index + 1}`),
    characterName: characterName || `未命名人物 ${index + 1}`,
    want,
    need,
    currentStage,
    nextPressure,
    endpoint,
    evidenceRefs: normalizeWritingEvidenceRefsFromSource(source, bookId),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingCharacterArcs(input: unknown, bookId: string): WritingCharacterArc[] {
  return (Array.isArray(input) ? input : [])
    .map((entry, index) => normalizeWritingCharacterArc(entry as Partial<WritingCharacterArc>, index, bookId))
    .filter((entry): entry is WritingCharacterArc => Boolean(entry));
}

function normalizeWritingStoryAssets(input: Partial<WritingStoryAssets> | null | undefined, bookId: string): WritingStoryAssets {
  return {
    premise: String(input?.premise ?? "").trim(),
    worldview: normalizeWritingStoryAssetEntries(input?.worldview, bookId, "worldview"),
    characters: normalizeWritingCharacterAssets(input?.characters, bookId),
    relationships: normalizeWritingStoryAssetEntries(input?.relationships, bookId, "relationship"),
    timeline: normalizeWritingStoryAssetEntries(input?.timeline, bookId, "timeline"),
    foreshadows: normalizeWritingForeshadowAssets(input?.foreshadows, bookId),
    rules: normalizeWritingStoryAssetEntries(input?.rules, bookId, "rule"),
    characterArcs: normalizeWritingCharacterArcs(input?.characterArcs, bookId),
    styleProfile: normalizeWritingStyleProfile(input?.styleProfile),
    memoryNotes: normalizeWritingStoryAssetEntries(input?.memoryNotes, bookId, "memory"),
    updatedAt: String(input?.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingNarrativeStateNodeKind(value: unknown, fallback: WritingNarrativeStateNodeKind): WritingNarrativeStateNodeKind {
  const kind = String(value ?? "").trim();
  return WRITING_NARRATIVE_STATE_NODE_KINDS.has(kind as WritingNarrativeStateNodeKind)
    ? (kind as WritingNarrativeStateNodeKind)
    : fallback;
}

function normalizeWritingNarrativeRiskLevel(value: unknown): WritingNarrativeRiskLevel {
  const level = String(value ?? "").trim();
  return WRITING_NARRATIVE_RISK_LEVELS.has(level as WritingNarrativeRiskLevel)
    ? (level as WritingNarrativeRiskLevel)
    : "low";
}

function normalizeWritingNarrativeStateNode(
  input: Partial<WritingNarrativeStateNode> | Record<string, unknown> | null | undefined,
  index: number,
  bookId: string,
  kind: WritingNarrativeStateNodeKind
): WritingNarrativeStateNode | null {
  const source = input && typeof input === "object" ? input : {};
  const label = String(source.label ?? (source as Record<string, unknown>).title ?? (source as Record<string, unknown>).name ?? "").trim();
  const summary = String(
    source.summary ??
      (source as Record<string, unknown>).detail ??
      (source as Record<string, unknown>).description ??
      (source as Record<string, unknown>).setup ??
      ""
  ).trim();

  if (!label && !summary) {
    return null;
  }

  return {
    id: String(source.id ?? `${bookId}_${kind}_${index + 1}`),
    kind: normalizeWritingNarrativeStateNodeKind(source.kind, kind),
    label: label || `未命名${kind} ${index + 1}`,
    summary,
    status: String(source.status ?? "active").trim() || "active",
    ...(normalizeOptionalChapterIndex(source.introducedAtChapterIndex ?? (source as Record<string, unknown>).chapterIndex) ? {
      introducedAtChapterIndex: normalizeOptionalChapterIndex(source.introducedAtChapterIndex ?? (source as Record<string, unknown>).chapterIndex)
    } : {}),
    ...(normalizeOptionalChapterIndex(source.payoffDeadlineChapterIndex) ? {
      payoffDeadlineChapterIndex: normalizeOptionalChapterIndex(source.payoffDeadlineChapterIndex)
    } : {}),
    ...(normalizeOptionalChapterIndex(source.resolvedAtChapterIndex) ? {
      resolvedAtChapterIndex: normalizeOptionalChapterIndex(source.resolvedAtChapterIndex)
    } : {}),
    evidenceChapterIds: normalizeStringList(source.evidenceChapterIds),
    evidenceRefs: normalizeWritingEvidenceRefsFromSource(source as Record<string, unknown>, bookId),
    ...((source as Record<string, unknown>).impact ? { impact: String((source as Record<string, unknown>).impact).trim() } : {}),
    relatedNodeIds: normalizeStringList(source.relatedNodeIds),
    riskLevel: normalizeWritingNarrativeRiskLevel(source.riskLevel),
    updatedAt: String(source.updatedAt ?? new Date().toISOString())
  };
}

function normalizeWritingNarrativeStateNodeList(
  input: unknown,
  bookId: string,
  kind: WritingNarrativeStateNodeKind
): WritingNarrativeStateNode[] {
  return (Array.isArray(input) ? input : [])
    .map((entry, index) => normalizeWritingNarrativeStateNode(entry as Partial<WritingNarrativeStateNode>, index, bookId, kind))
    .filter((entry): entry is WritingNarrativeStateNode => Boolean(entry));
}

function hasWritingNarrativeStateContent(state: Partial<WritingNarrativeState> | null | undefined): boolean {
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

function deriveWritingNarrativeStateFromStoryAssets(assets: WritingStoryAssets, bookId: string): WritingNarrativeState {
  const now = String(assets.updatedAt ?? new Date().toISOString());
  const toNode = (
    kind: WritingNarrativeStateNodeKind,
    label: string,
    summary: string,
    index: number,
    options: Partial<WritingNarrativeStateNode> = {}
  ): WritingNarrativeStateNode => ({
    id: String(options.id ?? `${bookId}_${kind}_${index + 1}`),
    kind,
    label: label || `未命名${kind} ${index + 1}`,
    summary,
    status: String(options.status ?? "active"),
    ...(options.introducedAtChapterIndex ? { introducedAtChapterIndex: options.introducedAtChapterIndex } : {}),
    ...(options.payoffDeadlineChapterIndex ? { payoffDeadlineChapterIndex: options.payoffDeadlineChapterIndex } : {}),
    ...(options.resolvedAtChapterIndex ? { resolvedAtChapterIndex: options.resolvedAtChapterIndex } : {}),
    evidenceChapterIds: normalizeStringList(options.evidenceChapterIds),
    evidenceRefs: normalizeWritingEvidenceRefs(options.evidenceRefs, bookId),
    ...(options.impact ? { impact: String(options.impact).trim() } : {}),
    relatedNodeIds: normalizeStringList(options.relatedNodeIds),
    riskLevel: normalizeWritingNarrativeRiskLevel(options.riskLevel),
    updatedAt: String(options.updatedAt ?? now)
  });

  return {
    characters: assets.characters.map((character, index) =>
      toNode(
        "character",
        character.name,
        [
          character.role ? `身份：${character.role}` : "",
          character.goal ? `目标：${character.goal}` : "",
          character.growthArc ? `弧线：${character.growthArc}` : "",
          character.relationships.length ? `关系：${character.relationships.join("；")}` : ""
        ].filter(Boolean).join(" / "),
        index,
        { id: character.id, status: character.status, evidenceRefs: character.evidenceRefs, impact: character.impact, updatedAt: character.updatedAt }
      )
    ),
    worldRules: [...assets.rules, ...assets.worldview].map((entry, index) =>
      toNode("worldRule", entry.title, entry.detail, index, {
        id: entry.id,
        status: entry.status ?? "active",
        introducedAtChapterIndex: entry.chapterIndex,
        evidenceRefs: entry.evidenceRefs,
        impact: entry.impact,
        updatedAt: entry.updatedAt
      })
    ),
    resources: assets.memoryNotes
      .filter((entry) => normalizeStringList(entry.tags).some((tag) => /资源|物件|伤痕|债务|权限|名声|证据/.test(tag)) || /资源|物件|伤痕|债务|权限|名声|证据/.test(`${entry.title}${entry.detail}`))
      .map((entry, index) => toNode("resource", entry.title, entry.detail, index, {
        id: entry.id,
        status: entry.status ?? "active",
        introducedAtChapterIndex: entry.chapterIndex,
        evidenceRefs: entry.evidenceRefs,
        impact: entry.impact,
        updatedAt: entry.updatedAt
      })),
    regions: assets.worldview
      .filter((entry) => normalizeStringList(entry.tags).some((tag) => /地区|区域|地点|城|域|地图/.test(tag)) || /地区|区域|地点|城|域|地图/.test(`${entry.title}${entry.detail}`))
      .map((entry, index) => toNode("region", entry.title, entry.detail, index, {
        id: `${entry.id}_region`,
        status: entry.status ?? "active",
        introducedAtChapterIndex: entry.chapterIndex,
        evidenceRefs: entry.evidenceRefs,
        impact: entry.impact,
        updatedAt: entry.updatedAt
      })),
    foreshadows: assets.foreshadows.map((entry, index) =>
      toNode("foreshadow", entry.title, [entry.setup, entry.payoff ? `回收计划：${entry.payoff}` : ""].filter(Boolean).join(" / "), index, {
        id: entry.id,
        status: entry.status,
        introducedAtChapterIndex: entry.chapterIndex,
        payoffDeadlineChapterIndex: entry.payoffChapterIndex,
        evidenceRefs: entry.evidenceRefs,
        impact: entry.impact,
        updatedAt: entry.updatedAt,
        riskLevel: entry.status === "open" ? "medium" : "low"
      })
    ),
    arcs: [
      ...assets.characterArcs.map((arc, index) =>
        toNode("arc", `${arc.characterName}：人物弧线`, [arc.want ? `Want：${arc.want}` : "", arc.need ? `Need：${arc.need}` : "", arc.currentStage ? `阶段：${arc.currentStage}` : "", arc.nextPressure ? `下一压力：${arc.nextPressure}` : "", arc.endpoint ? `终点：${arc.endpoint}` : ""].filter(Boolean).join(" / "), index, {
          id: arc.id,
          status: "active",
          evidenceRefs: arc.evidenceRefs,
          relatedNodeIds: assets.characters.filter((character) => character.name === arc.characterName).map((character) => character.id),
          updatedAt: arc.updatedAt
        })
      ),
      ...assets.characters
      .filter((character) => character.growthArc)
      .map((character, index) => toNode("arc", `${character.name}：成长弧`, character.growthArc, index, {
        id: `${character.id}_arc`,
        relatedNodeIds: [character.id],
        status: character.status,
        evidenceRefs: character.evidenceRefs,
        impact: character.impact,
        updatedAt: character.updatedAt
      }))
    ],
    timelineEvents: assets.timeline.map((entry, index) =>
      toNode("timelineEvent", entry.title, entry.detail, index, {
        id: entry.id,
        status: entry.status ?? "active",
        introducedAtChapterIndex: entry.chapterIndex,
        evidenceRefs: entry.evidenceRefs,
        impact: entry.impact,
        updatedAt: entry.updatedAt
      })
    ),
    continuityWarnings: [],
    planDriftNotes: [],
    updatedAt: now
  };
}

function normalizeWritingNarrativeState(
  input: Partial<WritingNarrativeState> | null | undefined,
  assets: WritingStoryAssets,
  bookId: string
): WritingNarrativeState {
  const source = input && typeof input === "object" ? input : {};

  if (!hasWritingNarrativeStateContent(source)) {
    return deriveWritingNarrativeStateFromStoryAssets(assets, bookId);
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

function normalizeWritingOutlinePlannerJob(input: Partial<WritingOutlinePlannerJob> | null | undefined): WritingOutlinePlannerJob | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const targetPartCount = Math.max(1, normalizeWritingChapterIndex(input.targetPartCount, 0));
  const minChaptersPerPart = Math.max(1, normalizeWritingChapterIndex(input.minChaptersPerPart, 79));
  const maxChaptersPerPart = Math.max(minChaptersPerPart, normalizeWritingChapterIndex(input.maxChaptersPerPart, minChaptersPerPart - 1));
  const chaptersPerPart = Math.min(
    maxChaptersPerPart,
    Math.max(minChaptersPerPart, normalizeWritingChapterIndex(input.chaptersPerPart, Math.round((minChaptersPerPart + maxChaptersPerPart) / 2) - 1))
  );
  const batchSize = Math.min(40, Math.max(5, normalizeWritingChapterIndex(input.batchSize, 19)));
  const createdAt = String(input.createdAt ?? new Date().toISOString());

  return {
    id: String(input.id ?? `writing_outline_job_${randomUUID()}`),
    status: normalizeWritingOutlinePlannerStatus(input.status),
    instruction: String(input.instruction ?? ""),
    targetPartCount,
    partType: normalizeWritingBookPartType(input.partType),
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    batchSize,
    targetChapterCount: targetPartCount * chaptersPerPart,
    generatedChapterCount: normalizeNonNegativeNumber(input.generatedChapterCount),
    currentPartIndex: normalizeNonNegativeNumber(input.currentPartIndex),
    currentBatchStartIndex: normalizeNonNegativeNumber(input.currentBatchStartIndex),
    currentBatchEndIndex: normalizeNonNegativeNumber(input.currentBatchEndIndex),
    lastCompletedChapterIndex: normalizeNonNegativeNumber(input.lastCompletedChapterIndex),
    retryAttempt: normalizeNonNegativeNumber(input.retryAttempt),
    maxRetryAttempts: normalizeNonNegativeNumber(input.maxRetryAttempts),
    ...(input.lastRetryAt ? { lastRetryAt: String(input.lastRetryAt) } : {}),
    ...(input.lastError ? { lastError: String(input.lastError) } : {}),
    createdAt,
    updatedAt: String(input.updatedAt ?? createdAt),
    ...(input.error ? { error: String(input.error) } : {})
  };
}

function normalizeWritingBookConfig(input: Partial<WritingBook> | null | undefined, directoryName = ""): StoredWritingBookConfig {
  const timestamp = String(input?.updatedAt ?? new Date().toISOString());
  const title = String(input?.title ?? directoryName ?? "").trim() || "未命名故事";
  const id = String(input?.id ?? `writing_book_${randomUUID()}`);
  const outlinePlannerJob = normalizeWritingOutlinePlannerJob(input?.outlinePlannerJob);
  const legacyDetailedOutline = String(input?.seriesPlan ?? "").trim();
  const storyAssets = normalizeWritingStoryAssets(input?.storyAssets, id);
  const genre = String(input?.genre ?? "小说 / 待定类型");

  return {
    id,
    title,
    author: String(input?.author ?? "Song"),
    length: normalizeWritingBookLength(input?.length),
    genre,
    genreProfile: normalizeWritingGenreProfile(input?.genreProfile, genre),
    status: String(input?.status ?? "新建"),
    updatedAt: timestamp,
    coverTone: String(input?.coverTone ?? "teal"),
    coverUrl: String(input?.coverUrl ?? "").trim(),
    coverPrompt: String(input?.coverPrompt ?? ""),
    coverShouldShowTitle: input?.coverShouldShowTitle !== false,
    intro: String(input?.intro ?? ""),
    outlineGuide: legacyDetailedOutline || String(input?.outlineGuide ?? ""),
    seriesPlan: "",
    extraIntroSections: normalizeWritingBookIntroSections(input?.extraIntroSections, id),
    parts: normalizeWritingBookParts(input?.parts, id),
    storyAssets,
    narrativeState: normalizeWritingNarrativeState(input?.narrativeState, storyAssets, id),
    ...(outlinePlannerJob ? { outlinePlannerJob } : {})
  };
}

function normalizeWritingChapterMeta(input: Partial<WritingChapter> | null | undefined, index: number, bookId: string): StoredWritingChapterMeta {
  const titleParts = splitStoredWritingChapterTitle(input?.title);
  const chapterIndex = normalizeWritingChapterIndex(input?.index ?? titleParts.index, index);

  return {
    id: String(input?.id ?? `${bookId}_chapter_${index + 1}`),
    index: chapterIndex,
    ...(input?.partIndex ? { partIndex: normalizeWritingChapterIndex(input.partIndex, 0) } : {}),
    title: titleParts.title || `未命名章节 ${chapterIndex}`,
    summary: String(input?.summary ?? ""),
    status: normalizeWritingChapterStatus(input?.status),
    updatedAt: String(input?.updatedAt ?? new Date().toISOString()),
    fileName: input?.fileName ? sanitizeWritingAssetName(input.fileName, "") : undefined
  };
}

function createWritingChapterContentFileName(usedFileNames: Set<string>): string {
  let candidate = `${randomUUID().replace(/-/g, "")}.md`;

  while (usedFileNames.has(candidate)) {
    candidate = `${randomUUID().replace(/-/g, "")}.md`;
  }

  usedFileNames.add(candidate);
  return candidate;
}

function resolveWritingChapterContentFileName(fileName: string | undefined, usedFileNames: Set<string>): string {
  const normalizedFileName = fileName ? sanitizeWritingAssetName(fileName, "") : "";

  if (
    normalizedFileName &&
    WRITING_CHAPTER_CONTENT_FILE_NAME_PATTERN.test(normalizedFileName) &&
    !usedFileNames.has(normalizedFileName)
  ) {
    usedFileNames.add(normalizedFileName);
    return normalizedFileName;
  }

  return createWritingChapterContentFileName(usedFileNames);
}

function resolveExistingWritingChapterContentFileName(fileName: string | undefined, usedFileNames: Set<string>): string | undefined {
  const normalizedFileName = fileName ? sanitizeWritingAssetName(fileName, "") : "";

  if (
    normalizedFileName &&
    WRITING_CHAPTER_CONTENT_FILE_NAME_PATTERN.test(normalizedFileName) &&
    !usedFileNames.has(normalizedFileName)
  ) {
    usedFileNames.add(normalizedFileName);
    return normalizedFileName;
  }

  return undefined;
}

async function isEmptyWritingChapterContentFile(filePath: string): Promise<boolean> {
  try {
    return !(await readFile(filePath, "utf8")).trim();
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}

function getWritingChapterMergeKey(chapter: Pick<WritingChapter, "id" | "index">): string {
  const index = normalizeWritingChapterIndex(chapter.index, 0);
  return index ? `index:${index}` : `id:${chapter.id}`;
}

function mergeWritingBookForIncrementalSave(incomingBook: WritingBook, existingBook: WritingBook | null): WritingBook {
  if (!existingBook) {
    return incomingBook;
  }

  const incomingChapters = Array.isArray(incomingBook.chapters) ? incomingBook.chapters : [];
  const existingChapters = Array.isArray(existingBook.chapters) ? existingBook.chapters : [];
  const incomingByKey = new Map(incomingChapters.map((chapter) => [getWritingChapterMergeKey(chapter), chapter]));
  const mergedChapters = [
    ...existingChapters.map((chapter) => {
      const incomingChapter = incomingByKey.get(getWritingChapterMergeKey(chapter));

      if (!incomingChapter) {
        return chapter;
      }

      return {
        ...chapter,
        ...incomingChapter,
        content: String(incomingChapter.content ?? "").trim() ? incomingChapter.content : chapter.content,
        fileName: incomingChapter.fileName ?? chapter.fileName
      };
    }),
    ...incomingChapters.filter((chapter) => !existingChapters.some((existingChapter) => getWritingChapterMergeKey(existingChapter) === getWritingChapterMergeKey(chapter)))
  ].sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0));

  return {
    ...existingBook,
    ...incomingBook,
    parts: Array.isArray(incomingBook.parts) && incomingBook.parts.length ? incomingBook.parts : existingBook.parts,
    chapters: mergedChapters
  };
}

async function readWritingBookDirectoryNames(): Promise<string[]> {
  try {
    const entries = await readdir(getWritingBooksDirectoryPath(), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readWritingBookConfigId(directoryName: string): Promise<string | null> {
  try {
    const config = await readJsonFile<Partial<WritingBook>>(
      path.join(getWritingBooksDirectoryPath(), directoryName, WRITING_BOOK_CONFIG_FILE_NAME)
    );
    return typeof config.id === "string" && config.id.trim() ? config.id : null;
  } catch {
    return null;
  }
}

async function findWritingBookDirectoryById(bookId: string): Promise<string | null> {
  const directoryNames = await readWritingBookDirectoryNames();

  for (const directoryName of directoryNames) {
    const currentId = await readWritingBookConfigId(directoryName);

    if (currentId === bookId) {
      return directoryName;
    }
  }

  return null;
}

async function resolveWritingBookTargetDirectory(book: WritingBook): Promise<{ targetDirectoryName: string; existingDirectoryName: string | null }> {
  const rootDirectory = getWritingBooksDirectoryPath();
  const existingDirectoryName =
    (typeof book.directoryName === "string" && book.directoryName.trim() ? book.directoryName : null) ??
    (book.id ? await findWritingBookDirectoryById(book.id) : null);
  const baseName = sanitizeWritingAssetName(book.title, "未命名故事");
  let targetDirectoryName = baseName;
  let suffix = 2;

  while (await pathExists(path.join(rootDirectory, targetDirectoryName))) {
    const existingId = await readWritingBookConfigId(targetDirectoryName);

    if (!existingId || existingId === book.id || targetDirectoryName === existingDirectoryName) {
      break;
    }

    targetDirectoryName = `${baseName}-${suffix++}`;
  }

  return { targetDirectoryName, existingDirectoryName };
}

async function readWritingBookFromDirectory(directoryName: string): Promise<WritingBook | null> {
  const bookDirectory = path.join(getWritingBooksDirectoryPath(), directoryName);

  try {
    const [configInput, chapterMetaInput] = await Promise.all([
      readJsonFile<Partial<WritingBook>>(path.join(bookDirectory, WRITING_BOOK_CONFIG_FILE_NAME)),
      readJsonFile<Array<Partial<WritingChapter>>>(path.join(bookDirectory, WRITING_BOOK_CHAPTERS_FILE_NAME)).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }

        throw error;
      })
    ]);
    const config = normalizeWritingBookConfig(configInput, directoryName);
    const chaptersDirectory = path.join(bookDirectory, WRITING_BOOK_CHAPTERS_DIRECTORY_NAME);
    const usedFileNames = new Set<string>();
    const chapterMetas = (Array.isArray(chapterMetaInput) ? chapterMetaInput : []).map((chapter, index) =>
      normalizeWritingChapterMeta(chapter, index, config.id)
    );
    const chapters = await Promise.all(
      chapterMetas.map(async (chapter) => {
        const fileName = resolveExistingWritingChapterContentFileName(chapter.fileName, usedFileNames);

        if (!fileName) {
          return {
            ...chapter,
            fileName: undefined,
            content: ""
          };
        }

        const contentPath = path.join(chaptersDirectory, fileName);
        const content = await readFile(contentPath, "utf8").catch((error) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return "";
          }

          throw error;
        });
        const hasContent = Boolean(content.trim());

        return {
          ...chapter,
          ...(hasContent ? { fileName } : { fileName: undefined }),
          content
        };
      })
    );

    return {
      ...config,
      directoryName,
      chapters
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeWritingBook(book: WritingBook, options: WritingBookSaveOptions = {}): Promise<WritingBook> {
  const rootDirectory = getWritingBooksDirectoryPath();
  const target = await resolveWritingBookTargetDirectory(book);
  const existingBook =
    options.mergeChapters && target.existingDirectoryName ? await readWritingBookFromDirectory(target.existingDirectoryName) : null;
  const mergedBook = options.mergeChapters ? mergeWritingBookForIncrementalSave(book, existingBook) : book;
  const config = normalizeWritingBookConfig(mergedBook, mergedBook.directoryName);
  const chapters = (Array.isArray(mergedBook.chapters) ? mergedBook.chapters : []).map((chapter, index) => ({
    ...normalizeWritingChapterMeta(chapter, index, config.id),
    content: String(chapter?.content ?? "")
  }));
  const { targetDirectoryName, existingDirectoryName } = await resolveWritingBookTargetDirectory({
    ...mergedBook,
    ...config,
    chapters
  });
  const bookDirectory = path.join(rootDirectory, targetDirectoryName);
  const chaptersDirectory = path.join(bookDirectory, WRITING_BOOK_CHAPTERS_DIRECTORY_NAME);
  const usedFileNames = new Set<string>();
  const chapterMetas: StoredWritingChapterMeta[] = chapters.map((chapter) => {
    const content = String(chapter.content ?? "");
    const fileName = content.trim() ? resolveWritingChapterContentFileName(chapter.fileName, usedFileNames) : undefined;

    return {
      id: chapter.id,
      index: chapter.index,
      ...(chapter.partIndex ? { partIndex: chapter.partIndex } : {}),
      title: chapter.title,
      summary: chapter.summary,
      status: chapter.status,
      updatedAt: chapter.updatedAt,
      ...(fileName ? { fileName } : {})
    };
  });

  await mkdir(bookDirectory, { recursive: true });
  await writeFile(path.join(bookDirectory, WRITING_BOOK_CONFIG_FILE_NAME), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await writeFile(path.join(bookDirectory, WRITING_BOOK_CHAPTERS_FILE_NAME), `${JSON.stringify(chapterMetas, null, 2)}\n`, "utf8");

  const chapterContentWrites = chapterMetas
    .map((chapter, index) => ({
      fileName: chapter.fileName,
      content: String(chapters[index]?.content ?? "")
    }))
    .filter((chapter): chapter is { fileName: string; content: string } => Boolean(chapter.fileName && chapter.content.trim()));

  if (chapterContentWrites.length) {
    await mkdir(chaptersDirectory, { recursive: true });
    await Promise.all(
      chapterContentWrites.map((chapter) => writeFile(path.join(chaptersDirectory, chapter.fileName), chapter.content, "utf8"))
    );
  }

  const chapterFiles = await readdir(chaptersDirectory, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    chapterFiles
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md") && !usedFileNames.has(entry.name))
      .map(async (entry) => {
        const filePath = path.join(chaptersDirectory, entry.name);

        if (!options.mergeChapters || (await isEmptyWritingChapterContentFile(filePath))) {
          await rm(filePath, { force: true });
        }
      })
  );

  if (existingDirectoryName && existingDirectoryName !== targetDirectoryName) {
    await rm(path.join(rootDirectory, existingDirectoryName), { recursive: true, force: true });
  }

  const savedBook = await readWritingBookFromDirectory(targetDirectoryName);

  if (!savedBook) {
    throw new Error("保存小说后读取失败");
  }

  return savedBook;
}

export async function listWritingBooks(): Promise<WritingBook[]> {
  const directoryNames = await readWritingBookDirectoryNames();
  const books = await Promise.all(directoryNames.map((directoryName) => readWritingBookFromDirectory(directoryName)));

  return sortByUpdatedAtDescending(books.filter((book): book is WritingBook => Boolean(book)));
}

export async function saveWritingBook(book: WritingBook, options: WritingBookSaveOptions = {}): Promise<WritingBook[]> {
  await writeWritingBook(book, options);
  return listWritingBooks();
}

export async function deleteWritingBook(bookId: string, moveToTrash: (targetPath: string) => Promise<void>): Promise<WritingBook[]> {
  const normalizedBookId = String(bookId ?? "").trim();

  if (!normalizedBookId) {
    return listWritingBooks();
  }

  const directoryName = await findWritingBookDirectoryById(normalizedBookId);

  if (!directoryName) {
    return listWritingBooks();
  }

  await moveToTrash(path.join(getWritingBooksDirectoryPath(), directoryName));
  return listWritingBooks();
}

const COMIC_PROJECT_FORMATS = new Set<ComicProjectFormat>(["poster", "serial"]);
const COMIC_PROJECT_PALETTES = new Set<ComicProjectPalette>(["monochrome", "color"]);
const COMIC_CHAPTER_STATUSES = new Set<ComicChapterStatus>(["todo", "inProgress", "done"]);
const COMIC_STORYBOARD_KINDS = new Set<ComicStoryboardKind>(["dialogue", "scene", "action", "transition", "emotion", "other"]);
const COMIC_ASSET_TYPES = new Set<ComicAssetType>(["character", "prop", "scene"]);
const COMIC_ASSET_VIEW_KINDS = new Set<ComicAssetViewKind>(["turnaround", "front", "side", "back", "angle", "wide", "detail"]);

function normalizeComicProjectFormat(value: unknown): ComicProjectFormat {
  const format = String(value ?? "").trim();
  return COMIC_PROJECT_FORMATS.has(format as ComicProjectFormat) ? (format as ComicProjectFormat) : "poster";
}

function normalizeComicProjectPalette(value: unknown): ComicProjectPalette {
  const palette = String(value ?? "").trim();
  return COMIC_PROJECT_PALETTES.has(palette as ComicProjectPalette) ? (palette as ComicProjectPalette) : "color";
}

function normalizeComicChapterStatus(value: unknown): ComicChapterStatus {
  const status = String(value ?? "").trim();
  return COMIC_CHAPTER_STATUSES.has(status as ComicChapterStatus) ? (status as ComicChapterStatus) : "todo";
}

function normalizeComicStoryboardKind(value: unknown): ComicStoryboardKind {
  const kind = String(value ?? "").trim();
  return COMIC_STORYBOARD_KINDS.has(kind as ComicStoryboardKind) ? (kind as ComicStoryboardKind) : "other";
}

function normalizeComicAssetType(value: unknown): ComicAssetType {
  const type = String(value ?? "").trim();
  return COMIC_ASSET_TYPES.has(type as ComicAssetType) ? (type as ComicAssetType) : "character";
}

function normalizeComicAssetViewKind(value: unknown): ComicAssetViewKind {
  const kind = String(value ?? "").trim();
  return COMIC_ASSET_VIEW_KINDS.has(kind as ComicAssetViewKind) ? (kind as ComicAssetViewKind) : "angle";
}

function normalizeComicAssetRefs(input: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(input) ? input : [])
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeOptionalComicChapterIndex(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeComicSourceType(value: unknown): ComicSourceRef["sourceType"] {
  const sourceType = String(value ?? "").trim();
  return sourceType === "web" || sourceType === "novel" || sourceType === "chapter" || sourceType === "file" || sourceType === "manual"
    ? sourceType
    : "manual";
}

function normalizeComicProjectSourceType(value: unknown): ComicSourceMeta["sourceType"] {
  const sourceType = String(value ?? "").trim();
  return sourceType === "web" || sourceType === "novel" || sourceType === "file" || sourceType === "manual" ? sourceType : "manual";
}

function normalizeComicSourceRef(input: Partial<ComicSourceRef> | null | undefined): ComicSourceRef | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const sourceUrl = String(input.sourceUrl ?? "").trim();
  const sourceTitle = String(input.sourceTitle ?? "").trim();
  const chapterIndex = normalizeOptionalComicChapterIndex(input.chapterIndex);
  const chapterTitle = String(input.chapterTitle ?? "").trim();
  const note = String(input.note ?? "").trim();

  if (!sourceUrl && !sourceTitle && chapterIndex === undefined && !chapterTitle && !note) {
    return null;
  }

  return {
    sourceType: normalizeComicSourceType(input.sourceType),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(chapterIndex !== undefined ? { chapterIndex } : {}),
    ...(chapterTitle ? { chapterTitle } : {}),
    ...(note ? { note } : {})
  };
}

function normalizeComicSourceRefs(input: unknown): ComicSourceRef[] {
  return (Array.isArray(input) ? input : [])
    .map((entry) => normalizeComicSourceRef(entry as Partial<ComicSourceRef>))
    .filter((entry): entry is ComicSourceRef => Boolean(entry));
}

function normalizeComicProjectSource(input: Partial<ComicSourceMeta> | null | undefined): ComicSourceMeta | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const sourceUrl = String(input.sourceUrl ?? "").trim();
  const sourceTitle = String(input.sourceTitle ?? "").trim();
  const importedAt = String(input.importedAt ?? "").trim();
  const importedBy = String(input.importedBy ?? "").trim();
  const chapterCount = normalizeOptionalComicChapterIndex(input.chapterCount);
  const extractionStatus = String(input.extractionStatus ?? "").trim();
  const notes = String(input.notes ?? "").trim();

  if (!sourceUrl && !sourceTitle && !importedAt && !importedBy && chapterCount === undefined && !extractionStatus && !notes) {
    return undefined;
  }

  return {
    sourceType: normalizeComicProjectSourceType(input.sourceType),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(importedAt ? { importedAt } : {}),
    ...(importedBy ? { importedBy } : {}),
    ...(chapterCount !== undefined ? { chapterCount } : {}),
    ...(extractionStatus === "planned" || extractionStatus === "partial" || extractionStatus === "complete" || extractionStatus === "blocked"
      ? { extractionStatus }
      : {}),
    ...(notes ? { notes } : {})
  };
}

function cleanComicImageSource(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/^<|>$/g, "");
  const titleStart = raw.search(/\s+["']/);
  return (titleStart > 0 ? raw.slice(0, titleStart) : raw).trim();
}

function extractComicChapterImagesFromMarkdown(content: string): Array<Pick<ComicChapterImage, "alt" | "src">> {
  const imagePattern = /!\[([^\]]*)\]\(([^)\n]+)\)/gu;
  const images: Array<Pick<ComicChapterImage, "alt" | "src">> = [];
  let match = imagePattern.exec(content);

  while (match) {
    const src = cleanComicImageSource(match[2]);

    if (src) {
      images.push({
        alt: String(match[1] ?? "").trim(),
        src
      });
    }

    match = imagePattern.exec(content);
  }

  return images;
}

function stripComicChapterImageMarkdown(content: string): string {
  if (!content.includes("![") || !content.includes("](")) {
    return content;
  }

  return content
    .replace(/!\[[^\]]*\]\([^) \n]+(?:\s+["'][^"'\n]*["'])?\)/gu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeComicChapterImage(input: Partial<ComicChapterImage> | null | undefined, index = 0): ComicChapterImage {
  const now = new Date().toISOString();

  return {
    id: String(input?.id ?? "").trim() || `comic_chapter_image_${randomUUID()}`,
    storyboardId: String(input?.storyboardId ?? "").trim() || undefined,
    alt: String(input?.alt ?? "").trim() || `画面 ${index + 1}`,
    src: cleanComicImageSource(input?.src),
    prompt: String(input?.prompt ?? ""),
    size: String(input?.size ?? ""),
    quality: String(input?.quality ?? ""),
    createdAt: String(input?.createdAt ?? "").trim() || now
  };
}

function normalizeComicChapterImages(input: unknown, legacyContent = ""): ComicChapterImage[] {
  const usedSources = new Set<string>();
  const images: ComicChapterImage[] = [];
  const candidates: Array<Partial<ComicChapterImage>> = [
    ...(Array.isArray(input) ? (input as Array<Partial<ComicChapterImage>>) : []),
    ...extractComicChapterImagesFromMarkdown(legacyContent)
  ];

  candidates.forEach((candidate, index) => {
    const image = normalizeComicChapterImage(candidate, index);

    if (!image.src || usedSources.has(image.src)) {
      return;
    }

    usedSources.add(image.src);
    images.push(image);
  });

  return images;
}

function normalizeComicStoryboardShot(input: Partial<ComicStoryboardShot> | null | undefined, index = 0, chapterPrompt = ""): ComicStoryboardShot {
  const now = new Date().toISOString();
  const order = Math.max(1, Math.round(Number(input?.index ?? index + 1) || index + 1));

  return {
    id: String(input?.id ?? "").trim() || `comic_storyboard_${randomUUID()}`,
    index: order,
    kind: normalizeComicStoryboardKind(input?.kind),
    title: String(input?.title ?? "").trim() || `分镜 ${order}`,
    beat: String(input?.beat ?? ""),
    dialogue: String(input?.dialogue ?? ""),
    camera: String(input?.camera ?? ""),
    prompt: String(input?.prompt ?? "").trim() || chapterPrompt,
    status: normalizeComicChapterStatus(input?.status),
    imageIds: Array.from(
      new Set((Array.isArray(input?.imageIds) ? input.imageIds : []).map((imageId) => String(imageId ?? "").trim()).filter(Boolean))
    ),
    updatedAt: String(input?.updatedAt ?? "").trim() || now
  };
}

function normalizeComicStoryboards(input: unknown, chapterPrompt = "", images: ComicChapterImage[] = []): ComicStoryboardShot[] {
  const storyboards = (Array.isArray(input) ? input : [])
    .map((shot, index) => normalizeComicStoryboardShot(shot as Partial<ComicStoryboardShot>, index, chapterPrompt))
    .sort((left, right) => left.index - right.index)
    .map((shot, index) => ({ ...shot, index: index + 1 }));

  if (storyboards.length) {
    const storyboardIds = new Set(storyboards.map((shot) => shot.id));

    return storyboards.map((shot) => ({
      ...shot,
      imageIds: shot.imageIds.filter((imageId) => images.some((image) => image.id === imageId))
    })).map((shot) => ({
      ...shot,
      imageIds: Array.from(
        new Set([
          ...shot.imageIds,
          ...images.filter((image) => image.storyboardId === shot.id && storyboardIds.has(shot.id)).map((image) => image.id)
        ])
      )
    }));
  }

  if (!chapterPrompt && !images.length) {
    return [];
  }

  return [
    normalizeComicStoryboardShot(
      {
        index: 1,
        kind: "scene",
        title: "分镜 1",
        beat: "",
        prompt: chapterPrompt,
        imageIds: images.map((image) => image.id),
        status: images.length ? "inProgress" : "todo"
      },
      0,
      chapterPrompt
    )
  ];
}

function parseComicImageDataUrl(value: string): { buffer: Buffer; extension: string } | null {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]+)$/u.exec(value.trim());

  if (!match) {
    return null;
  }

  const imageType = match[1].toLowerCase();
  const extension =
    imageType === "jpeg" || imageType === "jpg"
      ? "jpg"
      : imageType === "png" || imageType === "webp" || imageType === "gif" || imageType === "avif"
        ? imageType
        : "png";

  return {
    buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64"),
    extension
  };
}

async function externalizeComicImageSource(
  projectId: string,
  segments: string[],
  imageId: string,
  source: string
): Promise<{ source: string; changed: boolean }> {
  const parsed = parseComicImageDataUrl(source);

  if (!parsed) {
    return { source, changed: false };
  }

  const safeSegments = segments.map((segment) => sanitizeWritingAssetName(segment, "group"));
  const directoryPath = path.join(getComicProjectImagesDirectoryPath(projectId), ...safeSegments);
  const fileName = `${sanitizeWritingAssetName(imageId, "image")}.${parsed.extension}`;
  const filePath = path.join(directoryPath, fileName);

  await mkdir(directoryPath, { recursive: true });
  await writeFile(filePath, parsed.buffer);

  return {
    source: pathToFileURL(filePath).href,
    changed: true
  };
}

async function externalizeComicProjectImages(project: ComicProject): Promise<{ project: ComicProject; changed: boolean }> {
  let changed = false;

  const assets = await Promise.all(
    project.assets.map(async (asset) => {
      const views = await Promise.all(
        asset.views.map(async (view) => {
          const result = await externalizeComicImageSource(project.id, ["assets", asset.id], view.id, view.src);

          if (result.changed) {
            changed = true;
            return { ...view, src: result.source };
          }

          return view;
        })
      );

      return views.some((view, index) => view !== asset.views[index]) ? { ...asset, views } : asset;
    })
  );

  const chapters = await Promise.all(
    project.chapters.map(async (chapter) => {
      const images = await Promise.all(
        chapter.images.map(async (image) => {
          const result = await externalizeComicImageSource(project.id, ["chapters", chapter.id], image.id, image.src);

          if (result.changed) {
            changed = true;
            return { ...image, src: result.source };
          }

          return image;
        })
      );

      return images.some((image, index) => image !== chapter.images[index]) ? { ...chapter, images } : chapter;
    })
  );

  return {
    project: changed ? { ...project, assets, chapters } : project,
    changed
  };
}

async function externalizeComicProjectsImages(projects: ComicProject[]): Promise<{ projects: ComicProject[]; changed: boolean }> {
  let changed = false;
  const externalizedProjects = await Promise.all(
    projects.map(async (project) => {
      const result = await externalizeComicProjectImages(project);

      if (result.changed) {
        changed = true;
      }

      return result.project;
    })
  );

  return {
    projects: externalizedProjects,
    changed
  };
}

function normalizeComicChapter(input: Partial<ComicChapter> | null | undefined, index = 0): ComicChapter {
  const now = new Date().toISOString();
  const content = String(input?.content ?? "");
  const chapterPrompt = String(input?.prompt ?? "");
  const images = normalizeComicChapterImages(input?.images, content).map((image) => ({
    ...image,
    prompt: image.prompt || chapterPrompt
  }));
  const storyboards = normalizeComicStoryboards(input?.storyboards, chapterPrompt, images);
  const storyboardIds = new Set(storyboards.map((shot) => shot.id));
  const normalizedImages = images.map((image) => ({
    ...image,
    storyboardId: image.storyboardId && storyboardIds.has(image.storyboardId) ? image.storyboardId : storyboards[0]?.id
  }));

  return {
    id: String(input?.id ?? "").trim() || `comic_chapter_${randomUUID()}`,
    index: Math.max(1, Math.round(Number(input?.index ?? index + 1) || index + 1)),
    title: String(input?.title ?? "").trim() || `第 ${index + 1} 章`,
    summary: String(input?.summary ?? ""),
    prompt: chapterPrompt,
    content: stripComicChapterImageMarkdown(content),
    sourceRefs: normalizeComicSourceRefs(input?.sourceRefs),
    storyboards: storyboards.map((shot) => ({
      ...shot,
      imageIds: Array.from(
        new Set([
          ...shot.imageIds.filter((imageId) => normalizedImages.some((image) => image.id === imageId)),
          ...normalizedImages.filter((image) => image.storyboardId === shot.id).map((image) => image.id)
        ])
      )
    })),
    images: normalizedImages,
    status: normalizeComicChapterStatus(input?.status),
    assetRefs: normalizeComicAssetRefs(input?.assetRefs),
    updatedAt: String(input?.updatedAt ?? "").trim() || now
  };
}

function normalizeComicChapters(input: unknown): ComicChapter[] {
  const chapters = (Array.isArray(input) ? input : [])
    .map((chapter, index) => normalizeComicChapter(chapter as Partial<ComicChapter>, index))
    .sort((left, right) => left.index - right.index);

  if (chapters.length) {
    return chapters;
  }

  return [
    normalizeComicChapter(
      {
        index: 1,
        title: "第 1 章",
        summary: "写下这一章的场景目标、镜头顺序、角色动作和结尾画面。",
        prompt: "基于总介绍生成开场分镜，明确画面、动作、对白和页数。",
        content: "",
        storyboards: [],
        status: "inProgress"
      },
      0
    )
  ];
}

function normalizeComicAssetView(input: Partial<ComicAssetView> | null | undefined, index = 0): ComicAssetView {
  const kind = normalizeComicAssetViewKind(input?.kind);

  return {
    id: String(input?.id ?? "").trim() || `comic_asset_view_${randomUUID()}`,
    kind,
    label: String(input?.label ?? "").trim() || `视角 ${index + 1}`,
    src: String(input?.src ?? "").trim(),
    prompt: String(input?.prompt ?? "")
  };
}

function normalizeComicAssetViews(input: unknown): ComicAssetView[] {
  return (Array.isArray(input) ? input : []).map((view, index) => normalizeComicAssetView(view as Partial<ComicAssetView>, index));
}

function normalizeComicAssetVariant(
  input: Partial<ComicAssetVariant> | null | undefined,
  index = 0,
  fallbackViews: ComicAssetView[] = []
): ComicAssetVariant | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const now = new Date().toISOString();
  const views = normalizeComicAssetViews(input.views);
  const label = String(input.label ?? "").trim();
  const description = String(input.description ?? "");
  const prompt = String(input.prompt ?? "");
  const chapterStartIndex = normalizeOptionalComicChapterIndex(input.chapterStartIndex);
  const chapterEndIndex = normalizeOptionalComicChapterIndex(input.chapterEndIndex);
  const sourceRefs = normalizeComicSourceRefs(input.sourceRefs);

  if (!label && !description && !prompt && chapterStartIndex === undefined && chapterEndIndex === undefined && !views.length && !sourceRefs.length) {
    return null;
  }

  return {
    id: String(input.id ?? "").trim() || `comic_asset_variant_${randomUUID()}`,
    label: label || `版本 ${index + 1}`,
    ...(chapterStartIndex !== undefined ? { chapterStartIndex } : {}),
    ...(chapterEndIndex !== undefined ? { chapterEndIndex } : {}),
    ...(description ? { description } : {}),
    ...(prompt ? { prompt } : {}),
    views: views.length ? views : fallbackViews,
    ...(sourceRefs.length ? { sourceRefs } : {}),
    updatedAt: String(input.updatedAt ?? "").trim() || now
  };
}

function normalizeComicAssetVariants(input: unknown, fallbackViews: ComicAssetView[] = []): ComicAssetVariant[] {
  return (Array.isArray(input) ? input : [])
    .map((variant, index) => normalizeComicAssetVariant(variant as Partial<ComicAssetVariant>, index, fallbackViews))
    .filter((variant): variant is ComicAssetVariant => Boolean(variant));
}

function isLegacyEmptyComicTurnaroundViewSet(type: ComicAssetType, views: ComicAssetView[]): boolean {
  if (type !== "character" && type !== "prop") {
    return false;
  }

  if (views.length !== 3) {
    return false;
  }

  const kinds = views.map((view) => view.kind).sort().join(",");
  const isEmpty = views.every((view) => !view.src.trim() && !String(view.prompt ?? "").trim());
  return isEmpty && kinds === "back,front,side";
}

function getDefaultComicAssetViews(type: ComicAssetType): ComicAssetView[] {
  if (type === "scene") {
    return [
      { id: `comic_asset_view_${randomUUID()}`, kind: "wide", label: "全景", src: "", prompt: "" },
      { id: `comic_asset_view_${randomUUID()}`, kind: "angle", label: "视角 A", src: "", prompt: "" },
      { id: `comic_asset_view_${randomUUID()}`, kind: "detail", label: "细节", src: "", prompt: "" }
    ];
  }

  return [
    { id: `comic_asset_view_${randomUUID()}`, kind: "turnaround", label: "三视图", src: "", prompt: "" }
  ];
}

function normalizeComicAssetName(value: unknown, usedNames: Set<string>, fallback: string): string {
  const baseName = String(value ?? "").trim() || fallback;
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} ${suffix}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function normalizeComicAsset(
  input: Partial<ComicAsset> | null | undefined,
  index = 0,
  usedNames: Set<string> = new Set()
): ComicAsset {
  const now = new Date().toISOString();
  const createdAt = String(input?.createdAt ?? "").trim() || now;
  const type = normalizeComicAssetType(input?.type);
  const defaultName = type === "character" ? "人物素材" : type === "prop" ? "物品素材" : "场景素材";
  const views = normalizeComicAssetViews(input?.views);
  const normalizedViews = views.length && !isLegacyEmptyComicTurnaroundViewSet(type, views) ? views : getDefaultComicAssetViews(type);
  const chapterStartIndex = normalizeOptionalComicChapterIndex(input?.chapterStartIndex);
  const chapterEndIndex = normalizeOptionalComicChapterIndex(input?.chapterEndIndex);
  const sourceRefs = normalizeComicSourceRefs(input?.sourceRefs);
  const variants = normalizeComicAssetVariants(input?.variants, normalizedViews);

  return {
    id: String(input?.id ?? "").trim() || `comic_asset_${randomUUID()}`,
    name: normalizeComicAssetName(input?.name, usedNames, `${defaultName} ${index + 1}`),
    type,
    description: String(input?.description ?? ""),
    prompt: String(input?.prompt ?? ""),
    variantLabel: String(input?.variantLabel ?? "").trim() || undefined,
    ...(chapterStartIndex !== undefined ? { chapterStartIndex } : {}),
    ...(chapterEndIndex !== undefined ? { chapterEndIndex } : {}),
    ...(sourceRefs.length ? { sourceRefs } : {}),
    views: normalizedViews,
    ...(variants.length ? { variants } : {}),
    createdAt,
    updatedAt: String(input?.updatedAt ?? "").trim() || createdAt
  };
}

function normalizeComicAssets(input: unknown): ComicAsset[] {
  const usedNames = new Set<string>();
  const usedIds = new Set<string>();

  return (Array.isArray(input) ? input : []).map((asset, index) => {
    const normalizedAsset = normalizeComicAsset(asset as Partial<ComicAsset>, index, usedNames);

    if (usedIds.has(normalizedAsset.id)) {
      normalizedAsset.id = `comic_asset_${randomUUID()}`;
    }

    usedIds.add(normalizedAsset.id);
    return normalizedAsset;
  });
}

function normalizeComicProject(input: Partial<ComicProject> | null | undefined, index = 0): ComicProject {
  const now = new Date().toISOString();
  const createdAt = String(input?.createdAt ?? "").trim() || now;
  const updatedAt = String(input?.updatedAt ?? "").trim() || createdAt;
  const id = String(input?.id ?? "").trim() || `comic_project_${randomUUID()}`;
  const assets = normalizeComicAssets(input?.assets);
  const assetIds = new Set(assets.map((asset) => asset.id));
  const chapters = normalizeComicChapters(input?.chapters).map((chapter) => ({
    ...chapter,
    assetRefs: chapter.assetRefs.filter((assetId) => assetIds.has(assetId))
  }));

  return {
    id,
    title: String(input?.title ?? "").trim() || `未命名漫画 ${index + 1}`,
    format: normalizeComicProjectFormat(input?.format),
    palette: normalizeComicProjectPalette(input?.palette),
    genre: String(input?.genre ?? "").trim() || "漫画 / 待定类型",
    status: String(input?.status ?? "").trim() || "新建",
    summary: String(input?.summary ?? ""),
    visualStyle: String(input?.visualStyle ?? ""),
    episodePlan: String(input?.episodePlan ?? ""),
    pageCount: Math.max(1, Math.round(Number(input?.pageCount ?? 1) || 1)),
    coverTone: String(input?.coverTone ?? "").trim() || (index % 2 === 0 ? "ink" : "coral"),
    coverUrl: String(input?.coverUrl ?? "").trim(),
    coverPrompt: String(input?.coverPrompt ?? ""),
    coverShouldShowTitle: input?.coverShouldShowTitle !== false,
    source: normalizeComicProjectSource(input?.source),
    assets,
    chapters,
    createdAt,
    updatedAt
  };
}

export async function listComicProjects(): Promise<ComicProject[]> {
  const projects = await readWorkbenchCollection<Partial<ComicProject>>(getComicProjectsFilePath());
  const normalizedProjects = sortByUpdatedAtDescending(projects.map((project, index) => normalizeComicProject(project, index)));
  const externalized = await externalizeComicProjectsImages(normalizedProjects);

  if (externalized.changed) {
    await writeWorkbenchCollection(getComicProjectsFilePath(), sortByUpdatedAtDescending(externalized.projects));
  }

  return sortByUpdatedAtDescending(externalized.projects);
}

export async function upsertComicProject(project: ComicProject): Promise<ComicProject[]> {
  const current = await listComicProjects();
  const normalizedProject = (await externalizeComicProjectImages(normalizeComicProject(project))).project;
  const nextProjects = current.some((entry) => entry.id === normalizedProject.id)
    ? current.map((entry) => (entry.id === normalizedProject.id ? normalizedProject : entry))
    : [normalizedProject, ...current];

  await writeWorkbenchCollection(getComicProjectsFilePath(), sortByUpdatedAtDescending(nextProjects));
  return listComicProjects();
}

export async function deleteComicProject(projectId: string, moveToTrash: (targetPath: string) => Promise<void>): Promise<ComicProject[]> {
  const normalizedProjectId = String(projectId ?? "").trim();

  if (!normalizedProjectId) {
    return listComicProjects();
  }

  const current = await listComicProjects();
  const deletedProject = current.find((entry) => entry.id === normalizedProjectId);

  if (!deletedProject) {
    return current;
  }

  const stagingDirectory = getComicProjectDeleteStagingDirectoryPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotFileName = `${sanitizeWritingAssetName(deletedProject.title, "comic-project")}-${timestamp}.json`;
  const snapshotPath = path.join(stagingDirectory, snapshotFileName);

  await mkdir(stagingDirectory, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(deletedProject, null, 2)}\n`, "utf8");
  await moveToTrash(snapshotPath);

  try {
    await access(getComicProjectImagesDirectoryPath(normalizedProjectId));
    await moveToTrash(getComicProjectImagesDirectoryPath(normalizedProjectId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await writeWorkbenchCollection(
    getComicProjectsFilePath(),
    sortByUpdatedAtDescending(current.filter((entry) => entry.id !== normalizedProjectId))
  );

  return listComicProjects();
}

const VIDEO_PROJECT_MODES = new Set<VideoProjectMode>(["textToVideo", "imageToVideo"]);
const VIDEO_PROJECT_ASPECT_RATIOS = new Set<VideoProjectAspectRatio>(["16:9", "9:16", "1:1"]);
const VIDEO_SHOT_STATUSES = new Set<VideoShotStatus>(["todo", "inProgress", "done"]);

function normalizeVideoProjectMode(value: unknown): VideoProjectMode {
  const mode = String(value ?? "").trim();
  return VIDEO_PROJECT_MODES.has(mode as VideoProjectMode) ? (mode as VideoProjectMode) : "textToVideo";
}

function normalizeVideoProjectAspectRatio(value: unknown): VideoProjectAspectRatio {
  const aspectRatio = String(value ?? "").trim();
  return VIDEO_PROJECT_ASPECT_RATIOS.has(aspectRatio as VideoProjectAspectRatio)
    ? (aspectRatio as VideoProjectAspectRatio)
    : "16:9";
}

function normalizeVideoShotStatus(value: unknown): VideoShotStatus {
  const status = String(value ?? "").trim();
  return VIDEO_SHOT_STATUSES.has(status as VideoShotStatus) ? (status as VideoShotStatus) : "todo";
}

function normalizeVideoDurationSeconds(value: unknown, fallback = 5): number {
  const numeric = Number(value);
  return Math.min(600, Math.max(1, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
}

function normalizeVideoShot(input: Partial<VideoShot> | null | undefined, index = 0): VideoShot {
  const now = new Date().toISOString();

  return {
    id: String(input?.id ?? "").trim() || `video_shot_${randomUUID()}`,
    index: Math.max(1, Math.round(Number(input?.index ?? index + 1) || index + 1)),
    title: String(input?.title ?? "").trim() || `镜头 ${index + 1}`,
    summary: String(input?.summary ?? ""),
    prompt: String(input?.prompt ?? ""),
    negativePrompt: String(input?.negativePrompt ?? ""),
    reference: String(input?.reference ?? ""),
    output: String(input?.output ?? ""),
    taskId: String(input?.taskId ?? "").trim(),
    videoUrl: String(input?.videoUrl ?? "").trim(),
    lastFrameUrl: String(input?.lastFrameUrl ?? "").trim(),
    provider: String(input?.provider ?? "").trim(),
    model: String(input?.model ?? "").trim(),
    ...(input?.rawResult && typeof input.rawResult === "object" && !Array.isArray(input.rawResult)
      ? { rawResult: input.rawResult as Record<string, unknown> }
      : {}),
    status: normalizeVideoShotStatus(input?.status),
    durationSeconds: normalizeVideoDurationSeconds(input?.durationSeconds, 5),
    updatedAt: String(input?.updatedAt ?? "").trim() || now
  };
}

function normalizeVideoShots(input: unknown): VideoShot[] {
  const shots = (Array.isArray(input) ? input : [])
    .map((shot, index) => normalizeVideoShot(shot as Partial<VideoShot>, index))
    .sort((left, right) => left.index - right.index);

  if (shots.length) {
    return shots;
  }

  return [
    normalizeVideoShot(
      {
        index: 1,
        title: "开场镜头",
        summary: "写下本镜头的主体、运动、景别、光线、情绪和转场。",
        prompt: "生成一个 5 秒开场镜头，主体清晰，运动可控，光线和风格与项目设定一致。",
        negativePrompt: "低清晰度、畸形肢体、字幕、水印、过度闪烁、镜头抖动、画面断裂",
        reference: "",
        output: "",
        status: "inProgress",
        durationSeconds: 5
      },
      0
    )
  ];
}

function normalizeVideoProject(input: Partial<VideoProject> | null | undefined, index = 0): VideoProject {
  const now = new Date().toISOString();
  const createdAt = String(input?.createdAt ?? "").trim() || now;
  const updatedAt = String(input?.updatedAt ?? "").trim() || createdAt;
  const id = String(input?.id ?? "").trim() || `video_project_${randomUUID()}`;

  return {
    id,
    title: String(input?.title ?? "").trim() || `未命名视频 ${index + 1}`,
    mode: normalizeVideoProjectMode(input?.mode),
    aspectRatio: normalizeVideoProjectAspectRatio(input?.aspectRatio),
    genre: String(input?.genre ?? "").trim() || "视频 / 待定类型",
    status: String(input?.status ?? "").trim() || "新建",
    summary: String(input?.summary ?? ""),
    visualStyle: String(input?.visualStyle ?? ""),
    storyboardPlan: String(input?.storyboardPlan ?? ""),
    durationSeconds: normalizeVideoDurationSeconds(input?.durationSeconds, 5),
    coverTone: String(input?.coverTone ?? "").trim() || (index % 2 === 0 ? "lumen" : "violet"),
    coverUrl: String(input?.coverUrl ?? "").trim(),
    coverPrompt: String(input?.coverPrompt ?? ""),
    coverShouldShowTitle: input?.coverShouldShowTitle !== false,
    assets: normalizeComicAssets(input?.assets),
    shots: normalizeVideoShots(input?.shots),
    createdAt,
    updatedAt
  };
}

export async function listVideoProjects(): Promise<VideoProject[]> {
  const projects = await readWorkbenchCollection<Partial<VideoProject>>(getVideoProjectsFilePath());
  return sortByUpdatedAtDescending(projects.map((project, index) => normalizeVideoProject(project, index)));
}

export async function upsertVideoProject(project: VideoProject): Promise<VideoProject[]> {
  const current = await listVideoProjects();
  const normalizedProject = normalizeVideoProject(project);
  const nextProjects = current.some((entry) => entry.id === normalizedProject.id)
    ? current.map((entry) => (entry.id === normalizedProject.id ? normalizedProject : entry))
    : [normalizedProject, ...current];

  await writeWorkbenchCollection(getVideoProjectsFilePath(), sortByUpdatedAtDescending(nextProjects));
  return listVideoProjects();
}

export async function deleteVideoProject(projectId: string, moveToTrash: (targetPath: string) => Promise<void>): Promise<VideoProject[]> {
  const normalizedProjectId = String(projectId ?? "").trim();

  if (!normalizedProjectId) {
    return listVideoProjects();
  }

  const current = await listVideoProjects();
  const deletedProject = current.find((entry) => entry.id === normalizedProjectId);

  if (!deletedProject) {
    return current;
  }

  const stagingDirectory = getVideoProjectDeleteStagingDirectoryPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotFileName = `${sanitizeWritingAssetName(deletedProject.title, "video-project")}-${timestamp}.json`;
  const snapshotPath = path.join(stagingDirectory, snapshotFileName);

  await mkdir(stagingDirectory, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(deletedProject, null, 2)}\n`, "utf8");
  await moveToTrash(snapshotPath);
  await writeWorkbenchCollection(
    getVideoProjectsFilePath(),
    sortByUpdatedAtDescending(current.filter((entry) => entry.id !== normalizedProjectId))
  );

  return listVideoProjects();
}

const MUSIC_TRACK_KINDS = new Set<MusicTrackKind>(["song", "instrumental", "jingle", "soundtrack"]);
const MUSIC_TRACK_STATUSES = new Set<MusicTrackStatus>(["draft", "finished"]);
const MUSIC_TRACK_PROVIDERS = new Set<MusicTrackProvider>(["mureka", "suno", "manual"]);

function normalizeMusicTrackKind(value: unknown): MusicTrackKind {
  const kind = String(value ?? "").trim();
  return MUSIC_TRACK_KINDS.has(kind as MusicTrackKind) ? (kind as MusicTrackKind) : "song";
}

function normalizeMusicTrackStatus(value: unknown): MusicTrackStatus {
  const status = String(value ?? "").trim();
  return MUSIC_TRACK_STATUSES.has(status as MusicTrackStatus) ? (status as MusicTrackStatus) : "draft";
}

function normalizeMusicTrackProvider(value: unknown): MusicTrackProvider {
  const provider = String(value ?? "").trim();
  return MUSIC_TRACK_PROVIDERS.has(provider as MusicTrackProvider) ? (provider as MusicTrackProvider) : "manual";
}

function normalizeMusicDurationSeconds(value: unknown, fallback = 30): number {
  const numeric = Number(value);
  return Math.min(3600, Math.max(0, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
}

function normalizeMusicRawResult(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function normalizeMusicTrack(input: Partial<MusicTrack> | null | undefined, index = 0): MusicTrack {
  const now = new Date().toISOString();
  const createdAt = String(input?.createdAt ?? "").trim() || now;

  return {
    id: String(input?.id ?? "").trim() || `music_track_${randomUUID()}`,
    index: Math.max(1, Math.round(Number(input?.index ?? index + 1) || index + 1)),
    title: String(input?.title ?? "").trim() || `曲目 ${index + 1}`,
    kind: normalizeMusicTrackKind(input?.kind),
    status: normalizeMusicTrackStatus(input?.status),
    prompt: String(input?.prompt ?? ""),
    lyrics: String(input?.lyrics ?? ""),
    style: String(input?.style ?? ""),
    negativePrompt: String(input?.negativePrompt ?? ""),
    provider: normalizeMusicTrackProvider(input?.provider),
    model: String(input?.model ?? ""),
    taskId: String(input?.taskId ?? "").trim(),
    audioUrl: String(input?.audioUrl ?? "").trim(),
    streamUrl: String(input?.streamUrl ?? "").trim(),
    coverUrl: String(input?.coverUrl ?? "").trim(),
    durationSeconds: normalizeMusicDurationSeconds(input?.durationSeconds, 30),
    notes: String(input?.notes ?? ""),
    ...(normalizeMusicRawResult(input?.rawResult) ? { rawResult: normalizeMusicRawResult(input?.rawResult) } : {}),
    createdAt,
    updatedAt: String(input?.updatedAt ?? "").trim() || createdAt
  };
}

function normalizeMusicTracks(input: unknown): MusicTrack[] {
  return (Array.isArray(input) ? input : [])
    .map((track, index) => normalizeMusicTrack(track as Partial<MusicTrack>, index))
    .sort((left, right) => left.index - right.index);
}

function normalizeMusicProject(input: Partial<MusicProject> | null | undefined, index = 0): MusicProject {
  const now = new Date().toISOString();
  const createdAt = String(input?.createdAt ?? "").trim() || now;
  const updatedAt = String(input?.updatedAt ?? "").trim() || createdAt;
  const id = String(input?.id ?? "").trim() || `music_project_${randomUUID()}`;

  return {
    id,
    title: String(input?.title ?? "").trim() || `未命名专辑 ${index + 1}`,
    artist: String(input?.artist ?? "").trim() || "Gordon Studio",
    genre: String(input?.genre ?? "").trim() || "音乐 / 待定风格",
    mood: String(input?.mood ?? "").trim() || "待定",
    status: String(input?.status ?? "").trim() || "草稿",
    summary: String(input?.summary ?? ""),
    coverTone: String(input?.coverTone ?? "").trim() || (index % 2 === 0 ? "lunar" : "jade"),
    coverUrl: String(input?.coverUrl ?? "").trim(),
    coverPrompt: String(input?.coverPrompt ?? ""),
    coverShouldShowTitle: input?.coverShouldShowTitle !== false,
    tracks: normalizeMusicTracks(input?.tracks),
    createdAt,
    updatedAt
  };
}

export async function listMusicProjects(): Promise<MusicProject[]> {
  const projects = await readWorkbenchCollection<Partial<MusicProject>>(getMusicProjectsFilePath());
  return sortByUpdatedAtDescending(projects.map((project, index) => normalizeMusicProject(project, index)));
}

export async function upsertMusicProject(project: MusicProject): Promise<MusicProject[]> {
  const current = await listMusicProjects();
  const normalizedProject = normalizeMusicProject(project);
  const nextProjects = current.some((entry) => entry.id === normalizedProject.id)
    ? current.map((entry) => (entry.id === normalizedProject.id ? normalizedProject : entry))
    : [normalizedProject, ...current];

  await writeWorkbenchCollection(getMusicProjectsFilePath(), sortByUpdatedAtDescending(nextProjects));
  return listMusicProjects();
}

export async function deleteMusicProject(projectId: string, moveToTrash: (targetPath: string) => Promise<void>): Promise<MusicProject[]> {
  const normalizedProjectId = String(projectId ?? "").trim();

  if (!normalizedProjectId) {
    return listMusicProjects();
  }

  const current = await listMusicProjects();
  const deletedProject = current.find((entry) => entry.id === normalizedProjectId);

  if (!deletedProject) {
    return current;
  }

  const stagingDirectory = getMusicProjectDeleteStagingDirectoryPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotFileName = `${sanitizeWritingAssetName(deletedProject.title, "music-project")}-${timestamp}.json`;
  const snapshotPath = path.join(stagingDirectory, snapshotFileName);

  await mkdir(stagingDirectory, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(deletedProject, null, 2)}\n`, "utf8");
  await moveToTrash(snapshotPath);
  await writeWorkbenchCollection(
    getMusicProjectsFilePath(),
    sortByUpdatedAtDescending(current.filter((entry) => entry.id !== normalizedProjectId))
  );

  return listMusicProjects();
}

function createWorkflowVariableBinding(
  overrides: Partial<WorkflowVariableBinding> & Pick<WorkflowVariableBinding, "name" | "source" | "placeholder" | "summary">
): WorkflowVariableBinding {
  return {
    name: overrides.name,
    source: overrides.source,
    placeholder: overrides.placeholder,
    summary: overrides.summary,
    required: overrides.required ?? true,
    ...(overrides.sourceStepId ? { sourceStepId: overrides.sourceStepId } : {}),
    ...(overrides.path ? { path: overrides.path } : {})
  };
}

function extractCurlMethod(curl: string): string {
  const explicitMethod = curl.match(/(?:--request|-X)\s+['"]?([A-Z]+)['"]?/i)?.[1];

  if (explicitMethod) {
    return explicitMethod.toUpperCase();
  }

  return /(?:--data(?:-raw|-binary|-urlencode)?|--json)\b|-d(?:\s|=|$)/i.test(curl) ? "POST" : "GET";
}

function extractCurlUrl(curl: string): string {
  const literalUrlMatch = curl.match(/(?:^|\s)(['"]?)(https?:\/\/[^'"\s\\]+)\1/i);

  if (literalUrlMatch?.[2]) {
    return literalUrlMatch[2];
  }

  const placeholderUrlMatch = curl.match(
    /(?:^|\s)(['"]?)(\$BASE_URL[^'"\s\\]*|\$\{BASE_URL\}[^'"\s\\]*|\{\{\s*BASE_URL\s*\}\}[^'"\s\\]*)\1/i
  );
  return placeholderUrlMatch?.[2] ?? "";
}

function extractCurlPlaceholders(curl: string): string[] {
  const dollarPlaceholders = Array.from(curl.matchAll(/\$\{([A-Za-z0-9_]+)\}/g)).map((match) => match[1]);
  const bareDollarPlaceholders = Array.from(curl.matchAll(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g)).map((match) => match[1]);
  const doubleBracePlaceholders = Array.from(curl.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
  return Array.from(new Set([...dollarPlaceholders, ...bareDollarPlaceholders, ...doubleBracePlaceholders]));
}

function normalizeLegacyWorkflowProtocol(protocol: Record<string, unknown> | undefined): WorkflowProtocolDefinition {
  const pollIntervalMs = Number(protocol?.pollIntervalMs ?? 0);
  const maxAttempts = Number(protocol?.maxAttempts ?? 1);

  return {
    mode: maxAttempts > 1 ? "polling" : pollIntervalMs > 0 ? "sequential" : "single",
    initialWaitMs: Number(protocol?.initialWaitMs ?? 0),
    pollIntervalMs,
    maxAttempts,
    timeoutMs: Math.max(Number(protocol?.timeoutMs ?? 0), pollIntervalMs * maxAttempts),
    ...(protocol?.statusRequestId ? { statusStepId: String(protocol.statusRequestId) } : {}),
    ...(protocol?.resultRequestId ? { resultStepId: String(protocol.resultRequestId) } : {}),
    ...(protocol?.completionPath ? { completionPath: String(protocol.completionPath) } : {}),
    successValues: protocol?.completionSuccessValue ? [String(protocol.completionSuccessValue)] : [],
    ...(protocol?.resultPath ? { resultPath: String(protocol.resultPath) } : {}),
    note: String(protocol?.note ?? "")
  };
}

function normalizeLegacyWorkflowStep(
  request: Record<string, unknown>,
  protocol: Record<string, unknown> | undefined,
  requestIndex: number
): WorkflowRequestStep {
  const curl = String(request.curl ?? "");
  const placeholders = extractCurlPlaceholders(curl);
  const taskIdPath = String(protocol?.taskIdPath ?? "").trim();
  const isSubmitRequest = String(protocol?.submitRequestId ?? "") === String(request.id ?? "");
  const consumes = placeholders.map((name) => {
    const isTaskId = name === "task_id" && taskIdPath;

    return createWorkflowVariableBinding({
      name,
      source: isTaskId ? "response" : "manual",
      placeholder: `$${name}`,
      summary: isTaskId ? "来自上一步返回结果的任务标识" : "执行前手工填入或从环境变量注入",
      ...(isTaskId
        ? {
            sourceStepId: String(protocol?.submitRequestId ?? ""),
            path: taskIdPath
          }
        : {})
    });
  });
  const produces =
    isSubmitRequest && taskIdPath
      ? [
          createWorkflowVariableBinding({
            name: "task_id",
            source: "response",
            placeholder: "$task_id",
            summary: "从提交接口响应中提取异步任务 ID",
            sourceStepId: String(request.id ?? ""),
            path: taskIdPath
          })
        ]
      : [];

  return {
    id: String(request.id ?? `workflow_step_${requestIndex + 1}`),
    name: String(request.name ?? `步骤 ${requestIndex + 1}`),
    summary: String(request.summary ?? ""),
    method: extractCurlMethod(curl),
    url: extractCurlUrl(curl),
    curl,
    waitBeforeMs: requestIndex === 0 ? 0 : Number(protocol?.pollIntervalMs ?? 0),
    executionMode: requestIndex === 0 ? "once" : Number(protocol?.maxAttempts ?? 1) > 1 ? "polling" : "once",
    pollIntervalMs: Number(protocol?.pollIntervalMs ?? 0),
    maxAttempts: Number(protocol?.maxAttempts ?? 1),
    completionPath: requestIndex === 0 ? "" : String(protocol?.completionPath ?? ""),
    successValues: protocol?.completionSuccessValue ? [String(protocol.completionSuccessValue)] : [],
    failureValues: [],
    responseFieldHints: Array.isArray(request.responseFieldHints) ? request.responseFieldHints.map((entry) => String(entry)) : [],
    consumes,
    produces
  };
}

function normalizeLegacyApiWorkflowRecord(bundle: Record<string, unknown>): WorkflowRecord {
  const protocol = (bundle.protocol ?? {}) as Record<string, unknown>;
  const requests = Array.isArray(bundle.requests) ? bundle.requests : [];
  const steps = requests.map((request, index) => normalizeLegacyWorkflowStep(request as Record<string, unknown>, protocol, index));
  const taskIdProducer = steps.flatMap((step) => step.produces).find((binding) => binding.name === "task_id");
  const manualBindings = steps
    .flatMap((step) => step.consumes)
    .filter((binding) => binding.source === "manual");
  const sharedVariables = [
    ...manualBindings,
    ...(taskIdProducer ? [taskIdProducer] : [])
  ].filter(
    (binding, index, collection) =>
      collection.findIndex((candidate) => candidate.name === binding.name && candidate.source === binding.source) === index
  );

  return {
    id: String(bundle.id ?? `workflow_record_${randomUUID()}`),
    name: String(bundle.name ?? "未命名工作流"),
    summary: String(bundle.summary ?? ""),
    scenario: String(bundle.summary ?? "接口测试流程复用"),
    tags: Array.isArray(bundle.tags) ? bundle.tags.map((entry) => String(entry)) : [],
    updatedAt: String(bundle.updatedAt ?? new Date().toISOString()),
    notes: String(protocol.note ?? ""),
    sharedVariables,
    steps,
    protocol: normalizeLegacyWorkflowProtocol(protocol)
  };
}

function normalizeLegacyWorkflowLibrary(legacyEntries: unknown[]): WorkflowLibraryItem[] {
  return legacyEntries
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => entry.kind === "api-suite")
    .map((entry) => ({
      id: `workflow_${String(entry.id ?? randomUUID())}`,
      kind: "api-test" as const,
      title: "模型接口测试",
      summary: String(entry.summary ?? ""),
      description: String(entry.description ?? ""),
      tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)) : [],
      status: String(entry.status ?? "active") === "draft" ? "draft" : "active",
      usageCount: Number(entry.usageCount ?? 0),
      createdAt: String(entry.createdAt ?? new Date().toISOString()),
      updatedAt: String(entry.updatedAt ?? new Date().toISOString()),
      ...(entry.lastUsedAt ? { lastUsedAt: String(entry.lastUsedAt) } : {}),
      records: Array.isArray(entry.bundles)
        ? entry.bundles.map((bundle) => normalizeLegacyApiWorkflowRecord(bundle as Record<string, unknown>))
        : []
    }));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function normalizeLiveStreamPlatform(value: unknown): LiveStreamPlatform {
  const platform = String(value ?? "").trim();
  return LIVE_STREAM_PLATFORMS.has(platform as LiveStreamPlatform) ? (platform as LiveStreamPlatform) : "custom";
}

function normalizeLiveStreamSourceStatus(value: unknown): LiveStreamSourceStatus {
  const status = String(value ?? "").trim();
  return LIVE_STREAM_SOURCE_STATUSES.has(status as LiveStreamSourceStatus) ? (status as LiveStreamSourceStatus) : "active";
}

function normalizeLiveStreamSource(input: Partial<LiveStreamSource> | null | undefined, index = 0): LiveStreamSource | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const title = String(input.title ?? "").trim();
  const url = String(input.url ?? "").trim();
  const roomId = String(input.roomId ?? "").trim();

  if (!title || !url) {
    return null;
  }

  return {
    id: String(input.id ?? "").trim() || `live_stream_${randomUUID()}`,
    title,
    platform: normalizeLiveStreamPlatform(input.platform),
    ...(roomId ? { roomId } : {}),
    url,
    notes: String(input.notes ?? "").trim(),
    status: normalizeLiveStreamSourceStatus(input.status),
    sortOrder: Math.max(0, Number(input.sortOrder ?? index) || index),
    updatedAt: String(input.updatedAt ?? "").trim() || new Date().toISOString(),
    ...(input.lastOpenedAt ? { lastOpenedAt: String(input.lastOpenedAt).trim() } : {})
  };
}

function createDefaultLiveStreamSources(now = new Date().toISOString()): LiveStreamSource[] {
  return [
    {
      id: "live_stream_bilibili_room_6",
      title: "Bilibili 直播间 6",
      platform: "bilibili",
      roomId: "6",
      url: "https://live.bilibili.com/blanc/6",
      notes: "用户关注的固定 Bilibili 直播间，默认使用 blanc 纯净播放页",
      status: "active",
      sortOrder: 0,
      updatedAt: now
    }
  ];
}

function normalizeLiveStreamConfig(input: Partial<NonNullable<WorkflowLibraryItem["liveStream"]>> | null | undefined): NonNullable<WorkflowLibraryItem["liveStream"]> {
  const now = new Date().toISOString();
  const rawConfig = input && typeof input === "object" ? input : {};
  const defaultSources = createDefaultLiveStreamSources(now);
  const normalizedSources = (Array.isArray(rawConfig.sources) ? rawConfig.sources : [])
    .map(normalizeLiveStreamSource)
    .filter((source): source is LiveStreamSource => Boolean(source));
  const sourceById = new Map<string, LiveStreamSource>();

  for (const source of [...defaultSources, ...normalizedSources]) {
    sourceById.set(source.id, source);
  }

  const sources = Array.from(sourceById.values()).sort((left, right) => left.sortOrder - right.sortOrder);
  const requestedActiveSourceId = String(rawConfig.activeSourceId ?? "").trim();
  const activeSourceId = sources.some((source) => source.id === requestedActiveSourceId)
    ? requestedActiveSourceId
    : sources.find((source) => source.status === "active")?.id ?? sources[0]?.id;

  return {
    sources,
    ...(activeSourceId ? { activeSourceId } : {}),
    updatedAt: String(rawConfig.updatedAt ?? "").trim() || now
  };
}

function normalizeFinanceBriefAssetKind(value: unknown): FinanceBriefAssetKind {
  const kind = String(value ?? "").trim();
  return FINANCE_BRIEF_ASSET_KINDS.has(kind as FinanceBriefAssetKind) ? (kind as FinanceBriefAssetKind) : "other";
}

function normalizeFinanceBriefProvider(value: unknown): FinanceBriefProvider {
  const provider = String(value ?? "").trim();
  return FINANCE_BRIEF_PROVIDERS.has(provider as FinanceBriefProvider) ? (provider as FinanceBriefProvider) : "yahoo";
}

function normalizeFinanceBriefRange(value: unknown): FinanceBriefRange {
  const range = String(value ?? "").trim();
  return FINANCE_BRIEF_RANGES.has(range as FinanceBriefRange) ? (range as FinanceBriefRange) : "1mo";
}

function normalizeFinanceBriefInterval(value: unknown): FinanceBriefInterval {
  const interval = String(value ?? "").trim();
  return FINANCE_BRIEF_INTERVALS.has(interval as FinanceBriefInterval) ? (interval as FinanceBriefInterval) : "1d";
}

function normalizeNullableFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeOptionalFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  if (typeof value === "string" && !value.trim()) {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeNullableFinanceBriefPrice(value: unknown): number | null {
  const numberValue = normalizeNullableFiniteNumber(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function normalizeFinanceBriefSymbol(input: Partial<FinanceBriefSymbol> | null | undefined, index = 0): FinanceBriefSymbol | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const symbol = String(input.symbol ?? "").trim().toUpperCase();

  if (!symbol) {
    return null;
  }

  return {
    id: String(input.id ?? "").trim() || `finance_symbol_${randomUUID()}`,
    symbol,
    displayName: String(input.displayName ?? "").trim() || symbol,
    assetKind: normalizeFinanceBriefAssetKind(input.assetKind),
    market: String(input.market ?? "").trim(),
    currency: String(input.currency ?? "").trim(),
    provider: normalizeFinanceBriefProvider(input.provider),
    notes: String(input.notes ?? "").trim(),
    sortOrder: Math.max(0, Number(input.sortOrder ?? index) || index),
    updatedAt: String(input.updatedAt ?? "").trim() || new Date().toISOString()
  };
}

function createDefaultFinanceBriefSymbols(now = new Date().toISOString()): FinanceBriefSymbol[] {
  return [
    {
      id: "finance_symbol_gold_futures",
      symbol: "GC=F",
      displayName: "黄金期货",
      assetKind: "commodity",
      market: "COMEX",
      currency: "USD",
      provider: "yahoo",
      notes: "Yahoo Finance: Gold Futures",
      sortOrder: 0,
      updatedAt: now
    },
    {
      id: "finance_symbol_cmb_600036",
      symbol: "600036.SS",
      displayName: "招商银行 A 股",
      assetKind: "stock",
      market: "Shanghai",
      currency: "CNY",
      provider: "yahoo",
      notes: "Yahoo Finance: China Merchants Bank",
      sortOrder: 1,
      updatedAt: now
    }
  ];
}

function normalizeFinanceBriefKlinePoint(input: Partial<FinanceBriefKlinePoint> | null | undefined): FinanceBriefKlinePoint | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const time = String(input.time ?? "").trim();
  const open = normalizeNullableFinanceBriefPrice(input.open);
  const high = normalizeNullableFinanceBriefPrice(input.high);
  const low = normalizeNullableFinanceBriefPrice(input.low);
  const close = normalizeNullableFinanceBriefPrice(input.close);

  if (!time || open === null || high === null || low === null || close === null) {
    return null;
  }

  if (!Number.isFinite(new Date(time).getTime()) || high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
    return null;
  }

  const volume = normalizeOptionalFiniteNumber(input.volume);

  return {
    time,
    open,
    high,
    low,
    close,
    ...(volume !== undefined ? { volume } : {})
  };
}

function normalizeFinanceBriefQuoteSnapshot(
  input: Partial<FinanceBriefQuoteSnapshot> | null | undefined
): FinanceBriefQuoteSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const points = (Array.isArray(input.points) ? input.points : [])
    .map(normalizeFinanceBriefKlinePoint)
    .filter((point): point is FinanceBriefKlinePoint => Boolean(point));

  if (!symbol) {
    return null;
  }

  return {
    symbol,
    displayName: String(input.displayName ?? "").trim() || symbol,
    provider: normalizeFinanceBriefProvider(input.provider),
    currency: String(input.currency ?? "").trim(),
    exchangeName: String(input.exchangeName ?? "").trim(),
    ...(String(input.exchangeTimezoneName ?? "").trim() ? { exchangeTimezoneName: String(input.exchangeTimezoneName).trim() } : {}),
    ...(String(input.timezone ?? "").trim() ? { timezone: String(input.timezone).trim() } : {}),
    ...(normalizeOptionalFiniteNumber(input.gmtoffset) !== undefined ? { gmtoffset: normalizeOptionalFiniteNumber(input.gmtoffset) } : {}),
    ...(String(input.marketTime ?? "").trim() ? { marketTime: String(input.marketTime).trim() } : {}),
    regularMarketPrice: normalizeNullableFinanceBriefPrice(input.regularMarketPrice),
    previousClose: normalizeNullableFinanceBriefPrice(input.previousClose),
    dayHigh: normalizeNullableFinanceBriefPrice(input.dayHigh),
    dayLow: normalizeNullableFinanceBriefPrice(input.dayLow),
    volume: normalizeNullableFiniteNumber(input.volume),
    change: normalizeNullableFiniteNumber(input.change),
    changePercent: normalizeNullableFiniteNumber(input.changePercent),
    fetchedAt: String(input.fetchedAt ?? "").trim() || new Date().toISOString(),
    points
  };
}

function normalizeFinanceBriefDerivedMetric(
  input: Partial<FinanceBriefDerivedMetric> | null | undefined,
  index = 0
): FinanceBriefDerivedMetric | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = normalizeNullableFiniteNumber(input.value);
  const unit = String(input.unit ?? "").trim();

  if (value === null || !unit) {
    return null;
  }

  const id = String(input.id ?? "").trim() || `finance_metric_${index}`;

  return {
    id,
    label: String(input.label ?? "").trim() || id,
    value,
    unit,
    sourceName: String(input.sourceName ?? "").trim(),
    sourceSymbol: String(input.sourceSymbol ?? "").trim().toUpperCase(),
    calculatedAt: String(input.calculatedAt ?? "").trim() || new Date().toISOString(),
    notes: String(input.notes ?? "").trim()
  };
}

function normalizeFinanceBriefSnapshot(input: Partial<FinanceBriefSnapshot> | null | undefined): FinanceBriefSnapshot | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const quote = normalizeFinanceBriefQuoteSnapshot(input.quote);
  const symbolId = String(input.symbolId ?? "").trim();
  const derivedMetrics = (Array.isArray(input.derivedMetrics) ? input.derivedMetrics : [])
    .map(normalizeFinanceBriefDerivedMetric)
    .filter((metric): metric is FinanceBriefDerivedMetric => Boolean(metric));

  if (!quote || !symbolId) {
    return undefined;
  }

  return {
    symbolId,
    range: normalizeFinanceBriefRange(input.range),
    interval: normalizeFinanceBriefInterval(input.interval),
    fetchedAt: String(input.fetchedAt ?? "").trim() || quote.fetchedAt,
    sourceName: String(input.sourceName ?? "").trim() || "Yahoo Finance",
    sourceUrl: String(input.sourceUrl ?? "").trim(),
    quote,
    ...(derivedMetrics.length ? { derivedMetrics } : {})
  };
}

function normalizeFinanceBriefConfig(input: Partial<FinanceBriefConfig> | null | undefined): FinanceBriefConfig {
  const now = new Date().toISOString();
  const rawConfig = input && typeof input === "object" ? input : {};
  const defaultSymbols = createDefaultFinanceBriefSymbols(now);
  const normalizedSymbols = (Array.isArray(rawConfig.symbols) ? rawConfig.symbols : [])
    .map(normalizeFinanceBriefSymbol)
    .filter((symbol): symbol is FinanceBriefSymbol => Boolean(symbol));
  const symbolById = new Map<string, FinanceBriefSymbol>();

  for (const symbol of [...defaultSymbols, ...normalizedSymbols]) {
    symbolById.set(symbol.id, symbol);
  }

  const symbols = Array.from(symbolById.values()).sort((left, right) => left.sortOrder - right.sortOrder);
  const requestedActiveSymbolId = String(rawConfig.activeSymbolId ?? "").trim();
  const activeSymbolId = symbols.some((symbol) => symbol.id === requestedActiveSymbolId)
    ? requestedActiveSymbolId
    : symbols[0]?.id;
  const lastSnapshot = normalizeFinanceBriefSnapshot(rawConfig.lastSnapshot);

  return {
    symbols,
    ...(activeSymbolId ? { activeSymbolId } : {}),
    range: normalizeFinanceBriefRange(rawConfig.range),
    interval: normalizeFinanceBriefInterval(rawConfig.interval),
    updatedAt: String(rawConfig.updatedAt ?? "").trim() || now,
    ...(lastSnapshot ? { lastSnapshot } : {})
  };
}

function normalizeInfoRadarSourceKind(value: unknown): InfoRadarSourceKind {
  const kind = String(value ?? "").trim();
  return INFO_RADAR_SOURCE_KINDS.has(kind as InfoRadarSourceKind) ? (kind as InfoRadarSourceKind) : "web_page";
}

function isWechatTemporaryArticleUrl(value: unknown): boolean {
  const url = String(value ?? "").trim();

  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      /(?:^|\.)mp\.weixin\.qq\.com$/i.test(parsed.hostname) &&
      parsed.pathname === "/s" &&
      (parsed.searchParams.has("signature") || parsed.searchParams.has("timestamp") || parsed.searchParams.has("src"))
    );
  } catch {
    return false;
  }
}

function normalizeInfoRadarComparableText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeInfoRadarComparableUrl(value: unknown): string {
  const url = String(value ?? "").trim();

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";

    for (const volatileParam of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from"]) {
      parsed.searchParams.delete(volatileParam);
    }

    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function getInfoRadarComparableDate(value: unknown): string {
  const timestamp = new Date(String(value ?? "")).getTime();

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  return normalizeInfoRadarComparableText(value).slice(0, 16);
}

function getInfoRadarItemDedupeKey(item: InfoRadarItem): string {
  const title = normalizeInfoRadarComparableText(item.title);
  const author = normalizeInfoRadarComparableText(item.author);
  const sourceTitle = normalizeInfoRadarComparableText(item.sourceTitle);

  if (item.sourceKind === "wechat") {
    const publishedDate = getInfoRadarComparableDate(item.publishedAt);
    return ["wechat", title, author, publishedDate].filter(Boolean).join(":");
  }

  const url = normalizeInfoRadarComparableUrl(item.url || item.resolvedUrl);

  if (url) {
    return url;
  }

  return [item.sourceKind, item.sourceId || sourceTitle, title].filter(Boolean).join(":");
}

function getInfoRadarItemSortTime(item: InfoRadarItem): number {
  const publishedTime = new Date(item.publishedAt ?? "").getTime();

  if (Number.isFinite(publishedTime)) {
    return publishedTime;
  }

  const fetchedTime = new Date(item.fetchedAt ?? "").getTime();
  return Number.isFinite(fetchedTime) ? fetchedTime : 0;
}

function mergeNormalizedInfoRadarItems(items: InfoRadarItem[]): InfoRadarItem[] {
  const byKey = new Map<string, InfoRadarItem>();

  for (const item of items) {
    const key = getInfoRadarItemDedupeKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item.sourceKind === "wechat" ? { ...item, url: "", resolvedUrl: undefined } : item);
      continue;
    }

    const preferred = getInfoRadarItemSortTime(item) >= getInfoRadarItemSortTime(existing) ? item : existing;
    const preserved = existing.status === "saved" || existing.status === "ignored" ? existing : item.status === "saved" || item.status === "ignored" ? item : preferred;

    byKey.set(key, {
      ...(existing.sourceKind === "wechat" ? { ...existing, url: "", resolvedUrl: undefined } : existing),
      ...(preferred.sourceKind === "wechat" ? { ...preferred, url: "", resolvedUrl: undefined } : preferred),
      id: preserved.id,
      status: preserved.status,
      fetchedAt: preferred.fetchedAt || existing.fetchedAt,
      tags: Array.from(new Set([...(existing.tags ?? []), ...(item.tags ?? [])])).slice(0, 8),
      matchedKeywords: Array.from(new Set([...(existing.matchedKeywords ?? []), ...(item.matchedKeywords ?? [])])).slice(0, 8),
      score: Math.max(Number(existing.score ?? 0), Number(item.score ?? 0))
    });
  }

  return Array.from(byKey.values()).sort((left, right) => getInfoRadarItemSortTime(right) - getInfoRadarItemSortTime(left));
}

function normalizeInfoRadarSource(input: Partial<InfoRadarSource> | null | undefined, windowId = ""): InfoRadarSource | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const kind = normalizeInfoRadarSourceKind(input.kind);
  const title = String(input.title ?? "").trim();
  const url = String(input.url ?? "").trim();
  const query = String(input.query ?? "").trim();
  const hasLocator = kind === "search" ? Boolean(query || url) : kind === "manual" ? Boolean(title || url || query) : Boolean(url);

  if (!hasLocator && !title) {
    return null;
  }

  const timestamp = String(input.updatedAt ?? "").trim() || new Date().toISOString();

  return {
    id: String(input.id ?? "").trim() || `info_source_${windowId || randomUUID()}_${randomUUID()}`,
    kind,
    title: title || query || url || "未命名来源",
    url,
    query,
    enabled: input.enabled !== false,
    tags: normalizeStringArray(input.tags),
    notes: String(input.notes ?? "").trim(),
    updatedAt: timestamp,
    ...(String(input.lastDiscoveredAt ?? "").trim() ? { lastDiscoveredAt: String(input.lastDiscoveredAt).trim() } : {})
  };
}

function normalizeInfoRadarItem(input: Partial<InfoRadarItem> | null | undefined): InfoRadarItem | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const title = String(input.title ?? "").trim();
  const url = String(input.url ?? "").trim();

  if (!title && !url) {
    return null;
  }

  const sourceKind = normalizeInfoRadarSourceKind(input.sourceKind);
  const normalizedUrl = sourceKind === "wechat" && isWechatTemporaryArticleUrl(url) ? "" : url;
  const resolvedUrl = String(input.resolvedUrl ?? "").trim();
  const normalizedResolvedUrl =
    sourceKind === "wechat" && isWechatTemporaryArticleUrl(resolvedUrl) ? "" : resolvedUrl;
  const fetchedAt = String(input.fetchedAt ?? "").trim() || new Date().toISOString();
  const status = input.status === "saved" || input.status === "ignored" ? input.status : "new";

  return {
    id: String(input.id ?? "").trim() || `info_item_${randomUUID()}`,
    sourceId: String(input.sourceId ?? "").trim(),
    sourceTitle: String(input.sourceTitle ?? "").trim() || "未知来源",
    sourceKind,
    title: title || normalizedUrl,
    url: normalizedUrl,
    ...(normalizedResolvedUrl ? { resolvedUrl: normalizedResolvedUrl } : {}),
    summary: String(input.summary ?? "").trim(),
    ...(input.author ? { author: String(input.author).trim() } : {}),
    ...(input.publishedAt ? { publishedAt: String(input.publishedAt).trim() } : {}),
    ...(input.imageUrl ? { imageUrl: String(input.imageUrl).trim() } : {}),
    fetchedAt,
    tags: normalizeStringArray(input.tags),
    matchedKeywords: normalizeStringArray(input.matchedKeywords),
    score: Number.isFinite(Number(input.score)) ? Number(input.score) : 0,
    status
  };
}

function normalizeInfoRadarRefreshRun(input: Partial<InfoRadarRefreshRun> | null | undefined): InfoRadarRefreshRun | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const startedAt = String(input.startedAt ?? "").trim() || new Date().toISOString();
  const finishedAt = String(input.finishedAt ?? "").trim() || startedAt;
  const status = input.status === "success" || input.status === "partial" || input.status === "failed" ? input.status : "success";

  return {
    id: String(input.id ?? "").trim() || `info_run_${randomUUID()}`,
    status,
    startedAt,
    finishedAt,
    sourceCount: Math.max(0, Number(input.sourceCount ?? 0) || 0),
    itemCount: Math.max(0, Number(input.itemCount ?? 0) || 0),
    message: String(input.message ?? "").trim()
  };
}

function normalizeInfoRadarWindow(input: Partial<InfoRadarWindow> | null | undefined): InfoRadarWindow | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const title = String(input.title ?? "").trim();

  if (!title) {
    return null;
  }

  const timestamp = String(input.updatedAt ?? input.createdAt ?? "").trim() || new Date().toISOString();
  const windowId = String(input.id ?? "").trim() || `info_window_${randomUUID()}`;
  const sources = (Array.isArray(input.sources) ? input.sources : [])
    .map((source) => normalizeInfoRadarSource(source, windowId))
    .filter((source): source is InfoRadarSource => Boolean(source));
  const items = (Array.isArray(input.items) ? input.items : [])
    .map(normalizeInfoRadarItem)
    .filter((item): item is InfoRadarItem => Boolean(item))
    .reduce<InfoRadarItem[]>((entries, item) => {
      entries.push(item);
      return entries;
    }, []);
  const runHistory = (Array.isArray(input.runHistory) ? input.runHistory : [])
    .map(normalizeInfoRadarRefreshRun)
    .filter((run): run is InfoRadarRefreshRun => Boolean(run))
    .slice(0, 20);

  return {
    id: windowId,
    title,
    summary: String(input.summary ?? "").trim(),
    category: String(input.category ?? "").trim() || "综合",
    status: input.status === "paused" ? "paused" : "active",
    cadence:
      input.cadence === "hourly" || input.cadence === "daily" || input.cadence === "weekly" ? input.cadence : "manual",
    keywords: normalizeStringArray(input.keywords),
    negativeKeywords: normalizeStringArray(input.negativeKeywords),
    sources,
    digestPrompt: String(input.digestPrompt ?? "").trim(),
    items: mergeNormalizedInfoRadarItems(items).slice(0, 200),
    runHistory,
    createdAt: String(input.createdAt ?? "").trim() || timestamp,
    updatedAt: timestamp,
    ...(input.lastRefreshedAt ? { lastRefreshedAt: String(input.lastRefreshedAt).trim() } : {})
  };
}

function createDefaultInfoRadarCard(): WorkflowLibraryItem {
  const now = new Date().toISOString();

  return {
    id: DEFAULT_INFO_RADAR_CARD_ID,
    kind: "info-radar",
    title: "信息雷达",
    summary: "长期追踪技术、金融、科研、政治等外部信息，并沉淀为可复用的信息窗口。",
    description: "把常看的信息源、关键词和总结规则配置成窗口，手动或定时刷新后形成个人情报台。",
    tags: ["资讯", "研究", "雷达"],
    status: "active",
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    records: [],
    infoWindows: []
  };
}

function createDefaultApiWorkflowCard(): WorkflowLibraryItem {
  const now = new Date().toISOString();

  return {
    id: DEFAULT_API_WORKFLOW_CARD_ID,
    kind: "api-test",
    title: "模型接口测试",
    summary: "沉淀可复用 curl 流程，用于提交、轮询和结果检查。",
    description: "维护多步骤 API 请求、环境变量和轮询终止条件。",
    tags: ["API", "curl", "调试"],
    status: "active",
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    records: []
  };
}

function createDefaultFinanceBriefCard(): WorkflowLibraryItem {
  const now = new Date().toISOString();

  return {
    id: DEFAULT_FINANCE_BRIEF_CARD_ID,
    kind: "finance-brief",
    title: "金融快报",
    summary: "查询黄金、股票等金融标的的最新行情和 K 线快照。",
    description: "先从免密公开数据源抓取行情，后续可扩展到更多交易所、财经 API 和自定义数据源。",
    tags: ["金融", "行情", "K线"],
    status: "active",
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    records: [],
    financeBrief: normalizeFinanceBriefConfig({ updatedAt: now })
  };
}

function createDefaultLiveStreamCard(): WorkflowLibraryItem {
  const now = new Date().toISOString();

  return {
    id: DEFAULT_LIVE_STREAM_CARD_ID,
    kind: "live-stream",
    title: "直播流",
    summary: "收藏 Bilibili、小红书等固定直播间，在流程中心内直接观看。",
    description: "维护常看的直播房间或比赛直播页，进入后使用内嵌原生网页舞台播放。",
    tags: ["直播", "Bilibili", "小红书"],
    status: "active",
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    records: [],
    liveStream: normalizeLiveStreamConfig({ updatedAt: now })
  };
}

function normalizeWorkflowLibraryItemKind(value: unknown): WorkflowLibraryItem["kind"] {
  if (value === "info-radar" || value === "finance-brief" || value === "live-stream") {
    return value;
  }

  return "api-test";
}

function getWorkflowDefaultCardId(kind: WorkflowLibraryItem["kind"]): string {
  if (kind === "info-radar") {
    return DEFAULT_INFO_RADAR_CARD_ID;
  }

  if (kind === "finance-brief") {
    return DEFAULT_FINANCE_BRIEF_CARD_ID;
  }

  if (kind === "live-stream") {
    return DEFAULT_LIVE_STREAM_CARD_ID;
  }

  return `workflow_${randomUUID()}`;
}

function getWorkflowDefaultTitle(kind: WorkflowLibraryItem["kind"]): string {
  if (kind === "info-radar") {
    return "信息雷达";
  }

  if (kind === "finance-brief") {
    return "金融快报";
  }

  if (kind === "live-stream") {
    return "直播流";
  }

  return "模型接口测试";
}

function normalizeWorkflowLibraryItem(input: Partial<WorkflowLibraryItem> | null | undefined): WorkflowLibraryItem | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const kind = normalizeWorkflowLibraryItemKind(input.kind);
  const now = new Date().toISOString();
  const normalized: WorkflowLibraryItem = {
    id: String(input.id ?? "").trim() || getWorkflowDefaultCardId(kind),
    kind,
    title: String(input.title ?? "").trim() || getWorkflowDefaultTitle(kind),
    summary: String(input.summary ?? "").trim(),
    description: String(input.description ?? "").trim(),
    tags: normalizeStringArray(input.tags),
    status: input.status === "draft" ? "draft" : "active",
    usageCount: Math.max(0, Number(input.usageCount ?? 0) || 0),
    createdAt: String(input.createdAt ?? "").trim() || now,
    updatedAt: String(input.updatedAt ?? "").trim() || now,
    ...(input.lastUsedAt ? { lastUsedAt: String(input.lastUsedAt).trim() } : {}),
    records: Array.isArray(input.records) ? (input.records as WorkflowRecord[]) : []
  };

  if (kind === "info-radar") {
    normalized.infoWindows = (Array.isArray(input.infoWindows) ? input.infoWindows : [])
      .map(normalizeInfoRadarWindow)
      .filter((window): window is InfoRadarWindow => Boolean(window));
  }

  if (kind === "finance-brief") {
    normalized.financeBrief = normalizeFinanceBriefConfig(input.financeBrief);
  }

  if (kind === "live-stream") {
    normalized.liveStream = normalizeLiveStreamConfig(input.liveStream);
  }

  return normalized;
}

function ensureWorkflowLibraryDefaults(items: WorkflowLibraryItem[]): WorkflowLibraryItem[] {
  const normalizedItems = items
    .map(normalizeWorkflowLibraryItem)
    .filter((item): item is WorkflowLibraryItem => Boolean(item));
  const hasInfoRadar = normalizedItems.some((item) => item.kind === "info-radar");
  const hasApiWorkflow = normalizedItems.some((item) => item.kind === "api-test");
  const hasFinanceBrief = normalizedItems.some((item) => item.kind === "finance-brief");
  const hasLiveStream = normalizedItems.some((item) => item.kind === "live-stream");
  const nextItems = [...normalizedItems];

  if (!hasInfoRadar) {
    nextItems.unshift(createDefaultInfoRadarCard());
  }

  if (!hasFinanceBrief) {
    nextItems.push(createDefaultFinanceBriefCard());
  }

  if (!hasLiveStream) {
    nextItems.push(createDefaultLiveStreamCard());
  }

  if (!hasApiWorkflow) {
    nextItems.push(createDefaultApiWorkflowCard());
  }

  return sortByUpdatedAtDescending(nextItems);
}

export async function listWorkflowLibrary(): Promise<WorkflowLibraryItem[]> {
  const filePath = getWorkflowLibraryFilePath();

  try {
    return ensureWorkflowLibraryDefaults(await readWorkbenchCollection<WorkflowLibraryItem>(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const legacyEntries = await readWorkbenchCollection<unknown>(getLegacyEfficiencyToolsFilePath());
  return ensureWorkflowLibraryDefaults(normalizeLegacyWorkflowLibrary(legacyEntries));
}

export async function upsertWorkflowLibraryItem(item: WorkflowLibraryItem): Promise<WorkflowLibraryItem[]> {
  const normalizedItem = normalizeWorkflowLibraryItem(item);

  if (!normalizedItem) {
    return listWorkflowLibrary();
  }

  const current = await listWorkflowLibrary();
  const existingIndex = current.findIndex((entry) => entry.id === normalizedItem.id);
  const nextItems = [...current];

  if (existingIndex >= 0) {
    nextItems[existingIndex] = normalizedItem;
  } else {
    nextItems.unshift(normalizedItem);
  }

  await writeWorkbenchCollection(getWorkflowLibraryFilePath(), sortByUpdatedAtDescending(nextItems));
  return listWorkflowLibrary();
}

export async function listSkillDefinitions(): Promise<SkillDefinition[]> {
  const userSkills = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  const registeredSkills = mergeBuiltinEntries(getBuiltinSkillDefinitions(), userSkills);
  const discoveredSkills = await discoverLocalSkillDefinitions();
  return mergeDiscoveredSkillDefinitions(registeredSkills, discoveredSkills);
}

export async function upsertSkillDefinition(skill: SkillDefinition): Promise<SkillDefinition[]> {
  if (isBuiltinWorkbenchEntry(skill.id)) {
    return listSkillDefinitions();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  const existingSkill = current.find((entry) => entry.id === skill.id);
  const materializedSkill = await materializeSkillDirectory(skill, current, existingSkill);
  const existingIndex = current.findIndex((entry) => entry.id === skill.id);
  const nextSkills = [...current];

  if (existingIndex >= 0) {
    nextSkills[existingIndex] = materializedSkill;
  } else {
    nextSkills.unshift(materializedSkill);
  }

  await writeWorkbenchCollection(getSkillDefinitionsFilePath(), sortByUpdatedAtDescending(nextSkills));
  return listSkillDefinitions();
}

export async function importSkillDefinitionFromGithub(request: GithubSkillImportRequest): Promise<SkillDefinition[]> {
  const fetched = await fetchGithubSkillMarkdown(request);
  const skillRootPath = getGithubSkillRootPath(fetched.path);
  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  const existingIndex = current.findIndex(
    (entry) =>
      entry.source?.type === "github" &&
      entry.source.repo === fetched.repo &&
      entry.source.ref === fetched.ref &&
      entry.source.path === fetched.path
  );
  const existingSkill = existingIndex >= 0 ? current[existingIndex] : undefined;
  const reusableLocalPath = resolveUserSkillLocalPath(existingSkill?.source?.localPath) ?? "";
  const importedPreview = buildImportedSkillDefinition(fetched.markdown, {
    ...fetched,
    localPath: reusableLocalPath
  });
  const localPath =
    reusableLocalPath ||
    (await resolveAvailableSkillLocalDirectory(importedPreview.name, current, existingSkill?.id));

  await mirrorGithubSkillDirectory(fetched.repo, fetched.ref, skillRootPath, localPath);

  const importedSkill = buildImportedSkillDefinition(fetched.markdown, {
    ...fetched,
    localPath
  });
  const nextSkills = [...current];

  if (existingIndex >= 0) {
    nextSkills[existingIndex] = {
      ...nextSkills[existingIndex],
      ...importedSkill,
      id: nextSkills[existingIndex].id,
      enabled: nextSkills[existingIndex].enabled
    };
  } else {
    nextSkills.unshift(importedSkill);
  }

  await writeWorkbenchCollection(getSkillDefinitionsFilePath(), sortByUpdatedAtDescending(nextSkills));
  return listSkillDefinitions();
}

export async function toggleSkillDefinitionStatus(skillId: string): Promise<SkillDefinition[]> {
  if (isBuiltinWorkbenchEntry(skillId)) {
    return listSkillDefinitions();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  const existingSkill = current.find((skill) => skill.id === skillId);
  const targetSkill = existingSkill ?? (await listSkillDefinitions()).find((skill) => skill.id === skillId);

  if (!targetSkill || isBuiltinWorkbenchEntry(targetSkill.id)) {
    return listSkillDefinitions();
  }

  const updatedSkill = {
    ...targetSkill,
    enabled: !targetSkill.enabled,
    updatedAt: new Date().toISOString()
  };
  const nextSkills = existingSkill
    ? current.map((skill) => (skill.id === skillId ? updatedSkill : skill))
    : [updatedSkill, ...current];

  await writeWorkbenchCollection(getSkillDefinitionsFilePath(), sortByUpdatedAtDescending(nextSkills));
  return listSkillDefinitions();
}

export async function deleteSkillDefinition(skillId: string): Promise<SkillDefinition[]> {
  if (isBuiltinWorkbenchEntry(skillId)) {
    return listSkillDefinitions();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  const target = current.find((skill) => skill.id === skillId) ?? (await listSkillDefinitions()).find((skill) => skill.id === skillId);
  const nextSkills = current.filter((skill) => skill.id !== skillId);

  const localPath = target?.source?.localPath?.trim();

  if (localPath && isPathInsideDirectory(getUserSkillsRootDirectoryPath(), localPath) && !isBuiltinSkillLocalPath(localPath)) {
    await rm(localPath, { recursive: true, force: true });
  }

  await writeWorkbenchCollection(getSkillDefinitionsFilePath(), nextSkills);
  return listSkillDefinitions();
}

export async function listToolConfigs(): Promise<ToolConfig[]> {
  const storedConfigs = (await readWorkbenchCollection<Partial<ToolConfig>>(getToolConfigsFilePath()))
    .map((config) => normalizeToolConfig(config))
    .filter((config): config is ToolConfig => Boolean(config));
  const storedConfigByName = new Map(storedConfigs.map((config) => [config.name, config] as const));

  return getDefaultToolConfigs().map((config) => storedConfigByName.get(config.name) ?? config);
}

export async function upsertToolConfig(config: ToolConfig): Promise<ToolConfig[]> {
  const normalizedConfig = normalizeToolConfig({
    ...config,
    updatedAt: config.updatedAt || new Date().toISOString()
  });

  if (!normalizedConfig) {
    return listToolConfigs();
  }

  const current = await listToolConfigs();
  const nextConfigs = current.map((entry) => (entry.name === normalizedConfig.name ? normalizedConfig : entry));

  await writeWorkbenchCollection(getToolConfigsFilePath(), nextConfigs);
  return listToolConfigs();
}

export async function toggleToolConfigStatus(configId: string): Promise<ToolConfig[]> {
  const current = await listToolConfigs();
  const timestamp = new Date().toISOString();
  const nextConfigs = current.map((config) =>
    config.id === configId
      ? {
          ...config,
          enabled: !config.enabled,
          updatedAt: timestamp
        }
      : config
  );

  await writeWorkbenchCollection(getToolConfigsFilePath(), nextConfigs);
  return listToolConfigs();
}

export async function listMcpServers(): Promise<McpServerConfig[]> {
  const userServers = sortByUpdatedAtDescending(await readWorkbenchCollection<McpServerConfig>(getMcpServersFilePath()));
  return mergeBuiltinEntries(getBuiltinMcpServers(), userServers);
}

export async function upsertMcpServer(server: McpServerConfig): Promise<McpServerConfig[]> {
  if (isBuiltinWorkbenchEntry(server.id)) {
    return listMcpServers();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<McpServerConfig>(getMcpServersFilePath()));
  const existingIndex = current.findIndex((entry) => entry.id === server.id);
  const nextServers = [...current];

  if (existingIndex >= 0) {
    nextServers[existingIndex] = server;
  } else {
    nextServers.unshift(server);
  }

  await writeWorkbenchCollection(getMcpServersFilePath(), sortByUpdatedAtDescending(nextServers));
  return listMcpServers();
}

export async function toggleMcpServerStatus(serverId: string): Promise<McpServerConfig[]> {
  if (isBuiltinWorkbenchEntry(serverId)) {
    return listMcpServers();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<McpServerConfig>(getMcpServersFilePath()));
  const nextServers = current.map((server) =>
    server.id === serverId
      ? {
          ...server,
          enabled: !server.enabled,
          updatedAt: new Date().toISOString()
        }
      : server
  );

  await writeWorkbenchCollection(getMcpServersFilePath(), sortByUpdatedAtDescending(nextServers));
  return listMcpServers();
}

export async function deleteMcpServer(serverId: string): Promise<McpServerConfig[]> {
  if (isBuiltinWorkbenchEntry(serverId)) {
    return listMcpServers();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<McpServerConfig>(getMcpServersFilePath()));
  const nextServers = current.filter((server) => server.id !== serverId);

  await writeWorkbenchCollection(getMcpServersFilePath(), nextServers);
  return listMcpServers();
}

export async function listAgentProfiles(): Promise<AgentProfile[]> {
  const userProfiles = sortByUpdatedAtDescending(await readWorkbenchCollection<AgentProfile>(getAgentProfilesFilePath())).filter(
    (profile) => !RETIRED_AGENT_PROFILE_IDS.has(profile.id)
  );
  const [modelSettings, skills, servers] = await Promise.all([
    listModelSettings(),
    listSkillDefinitions(),
    listMcpServers()
  ]);

  return mergeBuiltinEntries(getBuiltinAgentProfiles(modelSettings, skills, servers), userProfiles);
}

export async function upsertAgentProfile(profile: AgentProfile): Promise<AgentProfile[]> {
  if (isBuiltinWorkbenchEntry(profile.id)) {
    return listAgentProfiles();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<AgentProfile>(getAgentProfilesFilePath()));
  const existingIndex = current.findIndex((entry) => entry.id === profile.id);
  const nextProfiles = [...current];

  if (existingIndex >= 0) {
    nextProfiles[existingIndex] = profile;
  } else {
    nextProfiles.unshift(profile);
  }

  await writeWorkbenchCollection(getAgentProfilesFilePath(), sortByUpdatedAtDescending(nextProfiles));
  return listAgentProfiles();
}

export async function toggleAgentProfileStatus(profileId: string): Promise<AgentProfile[]> {
  if (isBuiltinWorkbenchEntry(profileId)) {
    return listAgentProfiles();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<AgentProfile>(getAgentProfilesFilePath()));
  const nextProfiles = current.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          enabled: !profile.enabled,
          updatedAt: new Date().toISOString()
        }
      : profile
  );

  await writeWorkbenchCollection(getAgentProfilesFilePath(), sortByUpdatedAtDescending(nextProfiles));
  return listAgentProfiles();
}

export async function deleteAgentProfile(profileId: string): Promise<AgentProfile[]> {
  if (isBuiltinWorkbenchEntry(profileId)) {
    return listAgentProfiles();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<AgentProfile>(getAgentProfilesFilePath()));
  const nextProfiles = current.filter((profile) => profile.id !== profileId);

  await writeWorkbenchCollection(getAgentProfilesFilePath(), nextProfiles);
  return listAgentProfiles();
}

export async function listAgentRunLogs(): Promise<AgentRunLog[]> {
  return sortByUpdatedAtDescending(await readWorkbenchCollection<AgentRunLog>(getAgentRunLogsFilePath()));
}

export async function appendAgentRunLog(log: AgentRunLog): Promise<AgentRunLog[]> {
  const current = await listAgentRunLogs();
  const nextLogs = [log, ...current];

  await writeWorkbenchCollection(getAgentRunLogsFilePath(), sortByUpdatedAtDescending(nextLogs));
  return listAgentRunLogs();
}

export async function listCommandWorkshopSessions(): Promise<CommandWorkshopSession[]> {
  return sortByUpdatedAtDescending(
    await readWorkbenchCollection<CommandWorkshopSession>(getCommandWorkshopSessionsFilePath())
  );
}

export async function upsertCommandWorkshopSession(session: CommandWorkshopSession): Promise<CommandWorkshopSession[]> {
  const current = await listCommandWorkshopSessions();
  const existingIndex = current.findIndex((entry) => entry.id === session.id);
  const nextSessions = [...current];

  if (existingIndex >= 0) {
    nextSessions[existingIndex] = session;
  } else {
    nextSessions.unshift(session);
  }

  await writeWorkbenchCollection(getCommandWorkshopSessionsFilePath(), sortByUpdatedAtDescending(nextSessions));
  return listCommandWorkshopSessions();
}

export async function deleteCommandWorkshopSession(sessionId: string): Promise<CommandWorkshopSession[]> {
  const current = await listCommandWorkshopSessions();
  const nextSessions = current.filter((session) => session.id !== sessionId);

  await writeWorkbenchCollection(getCommandWorkshopSessionsFilePath(), nextSessions);
  return listCommandWorkshopSessions();
}
