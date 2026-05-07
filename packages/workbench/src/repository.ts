import path from "node:path";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { resolveFromRoot } from "../../shared/src/index.js";
import type {
  AgentRunLog,
  AgentProfile,
  ComicProject,
  ComicProjectFormat,
  ComicProjectPalette,
  CommandWorkshopSession,
  DatabaseConnectionItem,
  GithubSkillImportRequest,
  McpServerConfig,
  ModelBalanceSnapshot,
  ModelProfile,
  ModelSettings,
  SkillKind,
  SkillDefinition,
  WorkflowLibraryItem,
  WorkflowProtocolDefinition,
  WorkflowRecord,
  WorkflowRequestStep,
  WorkflowVariableBinding,
  WeeklyProgressItemStatus,
  WeeklyProgressProjectItem,
  WeeklyProgressRecord,
  WeeklyReportTemplateItem,
  WeeklyProgressTaskItem,
  WritingBook,
  WritingBookLength,
  WritingBookPart,
  WritingBookPartType,
  WritingChapter,
  WritingOutlinePlannerJob,
  WritingOutlinePlannerStatus,
  WritingBookSaveOptions,
  WritingChapterStatus,
  WorkTask
} from "../../shared/src/index.js";
import {
  getBuiltinAgentProfile,
  getBuiltinMcpServers,
  getBuiltinSkillDefinitions,
  isBuiltinWorkbenchEntry,
  mergeBuiltinEntries
} from "./default-assets.js";
import { readPromptAsset } from "./prompt-assets.js";

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

const LEGACY_DEFAULT_WEEKLY_REPORT_TEMPLATE = readPromptAsset("weeklyReportTemplateLegacy");
const DEFAULT_WEEKLY_REPORT_TEMPLATE = readPromptAsset("weeklyReportTemplateDefault");
const DEFAULT_WEEKLY_REPORT_TEMPLATE_ID = "builtin:weekly-report-template:default";
const DEFAULT_WEEKLY_REPORT_TEMPLATE_NAME = "默认模板";
const MIGRATED_WEEKLY_REPORT_TEMPLATE_NAME = "当前模板";

const WEEKLY_PROGRESS_FALLBACK_PROJECT_TITLE = "未分类项目";

function getWeeklyProgressFilePath(): string {
  return resolveFromRoot("data", "workbench", "weekly-progress.json");
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

function getSkillsRootDirectoryPath(): string {
  return resolveFromRoot("skills");
}

function getMcpServersFilePath(): string {
  return resolveFromRoot("data", "workbench", "mcp-servers.json");
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

function getComicProjectsFilePath(): string {
  return resolveFromRoot("data", "workbench", "comic-projects.json");
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
  return path.join(getSkillsRootDirectoryPath(), folderName);
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

function getGithubSkillRootPath(skillFilePath: string): string {
  return skillFilePath.endsWith("SKILL.md") ? skillFilePath.slice(0, -"SKILL.md".length).replace(/\/+$/, "") : skillFilePath;
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
  const existingLocalPath = existingSkill?.source?.localPath?.trim();

  if (existingLocalPath) {
    return existingLocalPath;
  }

  const sourceLocalPath = skill.source?.localPath?.trim();

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
  return status === "in_progress" || status === "blocked";
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
  return readJsonFile<WorkTask[]>(filePath);
}

export async function listDatabaseConnections(): Promise<DatabaseConnectionItem[]> {
  const filePath = resolveFromRoot("data", "workbench", "database-connections.json");
  return readJsonFile<DatabaseConnectionItem[]>(filePath);
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

const WRITING_BOOK_CONFIG_FILE_NAME = "book.json";
const WRITING_BOOK_CHAPTERS_FILE_NAME = "chapters.json";
const WRITING_BOOK_CHAPTERS_DIRECTORY_NAME = "chapters";
const WRITING_BOOK_LENGTHS = new Set<WritingBookLength>(["short", "medium", "long"]);
const WRITING_BOOK_PART_TYPES = new Set<WritingBookPartType>(["act", "volume"]);
const WRITING_CHAPTER_STATUSES = new Set<WritingChapterStatus>(["todo", "inProgress", "done"]);
const WRITING_OUTLINE_PLANNER_STATUSES = new Set<WritingOutlinePlannerStatus>(["idle", "running", "completed", "failed", "cancelled"]);
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

  return {
    id,
    title,
    author: String(input?.author ?? "Song"),
    length: normalizeWritingBookLength(input?.length),
    genre: String(input?.genre ?? "小说 / 待定类型"),
    status: String(input?.status ?? "新建"),
    updatedAt: timestamp,
    coverTone: String(input?.coverTone ?? "teal"),
    intro: String(input?.intro ?? ""),
    outlineGuide: String(input?.outlineGuide ?? ""),
    seriesPlan: String(input?.seriesPlan ?? ""),
    parts: normalizeWritingBookParts(input?.parts, id),
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

const COMIC_PROJECT_FORMATS = new Set<ComicProjectFormat>(["poster", "serial"]);
const COMIC_PROJECT_PALETTES = new Set<ComicProjectPalette>(["monochrome", "color"]);

function normalizeComicProjectFormat(value: unknown): ComicProjectFormat {
  const format = String(value ?? "").trim();
  return COMIC_PROJECT_FORMATS.has(format as ComicProjectFormat) ? (format as ComicProjectFormat) : "poster";
}

function normalizeComicProjectPalette(value: unknown): ComicProjectPalette {
  const palette = String(value ?? "").trim();
  return COMIC_PROJECT_PALETTES.has(palette as ComicProjectPalette) ? (palette as ComicProjectPalette) : "color";
}

function normalizeComicProject(input: Partial<ComicProject> | null | undefined, index = 0): ComicProject {
  const now = new Date().toISOString();
  const createdAt = String(input?.createdAt ?? "").trim() || now;
  const updatedAt = String(input?.updatedAt ?? "").trim() || createdAt;
  const id = String(input?.id ?? "").trim() || `comic_project_${randomUUID()}`;

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
    createdAt,
    updatedAt
  };
}

export async function listComicProjects(): Promise<ComicProject[]> {
  const projects = await readWorkbenchCollection<Partial<ComicProject>>(getComicProjectsFilePath());
  return sortByUpdatedAtDescending(projects.map((project, index) => normalizeComicProject(project, index)));
}

export async function upsertComicProject(project: ComicProject): Promise<ComicProject[]> {
  const current = await listComicProjects();
  const normalizedProject = normalizeComicProject(project);
  const nextProjects = current.some((entry) => entry.id === normalizedProject.id)
    ? current.map((entry) => (entry.id === normalizedProject.id ? normalizedProject : entry))
    : [normalizedProject, ...current];

  await writeWorkbenchCollection(getComicProjectsFilePath(), sortByUpdatedAtDescending(nextProjects));
  return listComicProjects();
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

export async function listWorkflowLibrary(): Promise<WorkflowLibraryItem[]> {
  const filePath = getWorkflowLibraryFilePath();

  try {
    return sortByUpdatedAtDescending(await readWorkbenchCollection<WorkflowLibraryItem>(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const legacyEntries = await readWorkbenchCollection<unknown>(getLegacyEfficiencyToolsFilePath());
  return sortByUpdatedAtDescending(normalizeLegacyWorkflowLibrary(legacyEntries));
}

export async function upsertWorkflowLibraryItem(item: WorkflowLibraryItem): Promise<WorkflowLibraryItem[]> {
  const current = await listWorkflowLibrary();
  const existingIndex = current.findIndex((entry) => entry.id === item.id);
  const nextItems = [...current];

  if (existingIndex >= 0) {
    nextItems[existingIndex] = item;
  } else {
    nextItems.unshift(item);
  }

  await writeWorkbenchCollection(getWorkflowLibraryFilePath(), sortByUpdatedAtDescending(nextItems));
  return listWorkflowLibrary();
}

export async function listSkillDefinitions(): Promise<SkillDefinition[]> {
  const userSkills = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  return mergeBuiltinEntries(getBuiltinSkillDefinitions(), userSkills);
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
  const importedPreview = buildImportedSkillDefinition(fetched.markdown, {
    ...fetched,
    localPath: existingSkill?.source?.localPath?.trim() || ""
  });
  const localPath =
    existingSkill?.source?.localPath?.trim() ||
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
  const nextSkills = current.map((skill) =>
    skill.id === skillId
      ? {
          ...skill,
          enabled: !skill.enabled,
          updatedAt: new Date().toISOString()
        }
      : skill
  );

  await writeWorkbenchCollection(getSkillDefinitionsFilePath(), sortByUpdatedAtDescending(nextSkills));
  return listSkillDefinitions();
}

export async function deleteSkillDefinition(skillId: string): Promise<SkillDefinition[]> {
  if (isBuiltinWorkbenchEntry(skillId)) {
    return listSkillDefinitions();
  }

  const current = sortByUpdatedAtDescending(await readWorkbenchCollection<SkillDefinition>(getSkillDefinitionsFilePath()));
  const target = current.find((skill) => skill.id === skillId);
  const nextSkills = current.filter((skill) => skill.id !== skillId);

  const localPath = target?.source?.localPath?.trim();

  if (localPath && isPathInsideDirectory(getSkillsRootDirectoryPath(), localPath)) {
    await rm(localPath, { recursive: true, force: true });
  }

  await writeWorkbenchCollection(getSkillDefinitionsFilePath(), nextSkills);
  return listSkillDefinitions();
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
  const userProfiles = sortByUpdatedAtDescending(await readWorkbenchCollection<AgentProfile>(getAgentProfilesFilePath()));
  const [modelSettings, skills, servers] = await Promise.all([
    listModelSettings(),
    listSkillDefinitions(),
    listMcpServers()
  ]);

  return mergeBuiltinEntries([getBuiltinAgentProfile(modelSettings, skills, servers)], userProfiles);
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
