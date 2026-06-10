import type { AgentMcpCallRecord, AgentTaskLedger, ModelMessage } from "../../shared/src/index.js";
import { stringifyArguments } from "./runtime-utils.js";

const MAX_RESOURCE_CANDIDATES = 8;
const MAX_RESOURCE_MENTION_LENGTH = 140;
const MAX_RESOLVED_REFS = 8;

export type AgentResourceDomain =
  | "workspace"
  | "codebase"
  | "web"
  | "desktop"
  | "artifact"
  | "writing"
  | "comic"
  | "media"
  | "conversation";

export interface AgentResourceCandidate {
  id: string;
  type: string;
  domain: AgentResourceDomain;
  label: string;
  confidence: number;
  mentions: string[];
  resolvedRefs: AgentResourceResolvedRef[];
  capabilities: string[];
  preferredExecutionDomains: string[];
  toolHints: string[];
  rationale: string;
}

export interface AgentResourceResolvedRef {
  kind: "path" | "url" | "app" | "artifact" | "task" | "book" | "chapter" | "comic_project" | "comic_chapter" | "unknown";
  value: string;
  source: "user_input" | "conversation" | "ledger" | "tool_arguments" | "tool_result";
  confidence: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface AgentResourceCapabilityDefinition {
  id: string;
  label: string;
  intent: string;
  appliesTo: string[];
  description: string;
  preferredExecutionDomains: string[];
  toolHints: string[];
  verification: string[];
  riskBoundary: "read_only" | "stateful" | "destructive";
}

export interface AgentResourceGatewayStep {
  phase: "inspect" | "act" | "verify";
  capabilityId: string;
  intent: string;
  preferredExecutionDomains: string[];
  toolHints: string[];
  argumentHints: Record<string, string | number | boolean>;
  expectedOutcome: string;
  verificationMethod: string;
  riskBoundary: AgentResourceCapabilityDefinition["riskBoundary"];
}

export interface AgentResourceGatewayPlan {
  resourceId?: string;
  resourceType?: string;
  intent: string;
  summary: string;
  steps: AgentResourceGatewayStep[];
  toolBias: string[];
  argumentHints: Record<string, string | number | boolean>;
  verificationBias: string[];
}

export interface AgentResourceCapabilityFrame {
  primaryResourceId?: string;
  intent: string;
  capabilities: string[];
  registry: AgentResourceCapabilityDefinition[];
  preferredExecutionDomains: string[];
  riskBoundary: "read_only" | "stateful" | "destructive";
  verificationBias: string[];
}

export interface AgentResourceContext {
  registryVersion: "gordon-resource-registry/v1";
  summary: string;
  primaryResource?: AgentResourceCandidate;
  candidates: AgentResourceCandidate[];
  resolvedRefs: AgentResourceResolvedRef[];
  capabilityRegistry: AgentResourceCapabilityDefinition[];
  capabilityFrame: AgentResourceCapabilityFrame;
  gatewayPlan: AgentResourceGatewayPlan;
  routingPolicy: string;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function truncateMention(value: unknown): string {
  const text = normalizeText(value).replace(/\s+/g, " ");
  return text.length > MAX_RESOURCE_MENTION_LENGTH ? `${text.slice(0, MAX_RESOURCE_MENTION_LENGTH)}...` : text;
}

function uniqueStrings(values: string[], maxItems = 8): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const text = normalizeText(value);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(text);

    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

function refKey(ref: Pick<AgentResourceResolvedRef, "kind" | "value">): string {
  return `${ref.kind}:${ref.value.toLowerCase()}`;
}

function normalizeResolvedRef(ref: AgentResourceResolvedRef): AgentResourceResolvedRef {
  return {
    kind: ref.kind,
    value: truncateMention(ref.value),
    source: ref.source,
    confidence: Math.max(0, Math.min(1, ref.confidence)),
    ...(ref.metadata && Object.keys(ref.metadata).length ? { metadata: ref.metadata } : {})
  };
}

function mergeResolvedRefs(values: AgentResourceResolvedRef[], maxItems = MAX_RESOLVED_REFS): AgentResourceResolvedRef[] {
  const refs = new Map<string, AgentResourceResolvedRef>();

  for (const value of values) {
    const ref = normalizeResolvedRef(value);

    if (!ref.value) {
      continue;
    }

    const key = refKey(ref);
    const current = refs.get(key);

    refs.set(key, {
      ...(current ?? ref),
      confidence: Math.max(current?.confidence ?? 0, ref.confidence),
      source: current?.confidence && current.confidence >= ref.confidence ? current.source : ref.source,
      metadata: {
        ...(current?.metadata ?? {}),
        ...(ref.metadata ?? {})
      }
    });
  }

  return [...refs.values()]
    .sort((left, right) => right.confidence - left.confidence || left.kind.localeCompare(right.kind) || left.value.localeCompare(right.value))
    .slice(0, maxItems);
}

function extractTextRefs(text: string, source: AgentResourceResolvedRef["source"]): AgentResourceResolvedRef[] {
  const refs: AgentResourceResolvedRef[] = [];
  const add = (ref: AgentResourceResolvedRef): void => {
    refs.push(ref);
  };

  for (const match of text.matchAll(/(?:^|[\s"'(（])((?:\.{1,2}\/|~\/|\/)?(?:packages|apps|scripts|docs|skills|prompts|data)\/[A-Za-z0-9._~@/+-]+\.[A-Za-z0-9]+)/gu)) {
    add({
      kind: "path",
      value: match[1] ?? "",
      source,
      confidence: 0.9
    });
  }

  for (const match of text.matchAll(/https?:\/\/[^\s"'）)<>]+/gu)) {
    add({
      kind: "url",
      value: match[0],
      source,
      confidence: 0.92
    });
  }

  for (const match of text.matchAll(/(?:task\s*id|taskid|任务\s*id|任务ID)(?:\s*是)?[：:\s]*([A-Za-z0-9._:-]{6,})/giu)) {
    add({
      kind: "task",
      value: match[1] ?? "",
      source,
      confidence: 0.82
    });
  }

  for (const match of text.matchAll(/(?:书籍|小说|书稿|book)\s*(?:id|ID|Id)?[：:\s]+([A-Za-z0-9._:-]{6,})/giu)) {
    add({
      kind: "book",
      value: match[1] ?? "",
      source,
      confidence: 0.9,
      metadata: {
        refLabel: "bookId"
      }
    });
  }

  for (const match of text.matchAll(/(?:项目|漫画项目|project)\s*(?:id|ID|Id)?[：:\s]+([A-Za-z0-9._:-]{6,})/giu)) {
    add({
      kind: "comic_project",
      value: match[1] ?? "",
      source,
      confidence: 0.9,
      metadata: {
        refLabel: "projectId"
      }
    });
  }

  for (const match of text.matchAll(/(?:当前)?章节\s*(?:id|ID|Id)[：:\s]+([A-Za-z0-9._:-]{6,})/giu)) {
    const isComicContext = /丹青溢彩|漫画|分镜|灵绘小筑/u.test(text.slice(Math.max(0, match.index - 220), match.index + 220));

    add({
      kind: isComicContext ? "comic_chapter" : "chapter",
      value: match[1] ?? "",
      source,
      confidence: 0.88,
      metadata: {
        chapterId: match[1] ?? "",
        refLabel: "chapterId"
      }
    });
  }

  for (const match of text.matchAll(/第\s*(\d{1,4})\s*[章节话]/gu)) {
    add({
      kind: "chapter",
      value: `chapter:${match[1]}`,
      source,
      confidence: 0.7,
      metadata: {
        chapterIndex: Number(match[1])
      }
    });
  }

  for (const app of ["Chrome", "Safari", "Finder", "Outlook", "Google Chrome"]) {
    if (new RegExp(app.replace(/\s+/gu, "\\s+"), "iu").test(text)) {
      add({
        kind: "app",
        value: app,
        source,
        confidence: 0.72
      });
    }
  }

  return refs;
}

function firstRefValue(refs: AgentResourceResolvedRef[], kind: AgentResourceResolvedRef["kind"]): string {
  return refs.find((ref) => ref.kind === kind)?.value ?? "";
}

function firstChapterIndex(refs: AgentResourceResolvedRef[], kinds: AgentResourceResolvedRef["kind"][]): number | null {
  for (const ref of refs) {
    if (!kinds.includes(ref.kind)) {
      continue;
    }

    const metadataIndex = pickNumber(ref.metadata?.chapterIndex);

    if (metadataIndex) {
      return metadataIndex;
    }

    const textIndex = ref.value.match(/chapter:(\d+)/iu)?.[1];
    const parsed = pickNumber(textIndex);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function firstChapterId(refs: AgentResourceResolvedRef[], kinds: AgentResourceResolvedRef["kind"][]): string {
  for (const ref of refs) {
    if (!kinds.includes(ref.kind)) {
      continue;
    }

    const metadataChapterId = pickString(ref.metadata?.chapterId);

    if (metadataChapterId) {
      return metadataChapterId;
    }

    if (!/^chapter:\d+$/iu.test(ref.value)) {
      return ref.value;
    }
  }

  return "";
}

function pickString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function pickNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractToolArgumentRefs(call: AgentMcpCallRecord): AgentResourceResolvedRef[] {
  const args = call.arguments ?? {};
  const refs: AgentResourceResolvedRef[] = [];
  const pathValue = pickString(args.path) || pickString(args.filePath) || pickString(args.targetPath);
  const urlValue = pickString(args.url);
  const appValue = pickString(args.app);
  const taskId = pickString(args.taskId);
  const book = pickString(args.bookIdOrTitle);
  const project = pickString(args.projectIdOrTitle);
  const chapterIndex = pickNumber(args.chapterIndex);
  const chapterId = pickString(args.chapterId);
  const chapterTitle = pickString(args.chapterTitle);

  if (pathValue) {
    refs.push({ kind: "path", value: pathValue, source: "tool_arguments", confidence: 0.94 });
  }

  if (urlValue) {
    refs.push({ kind: "url", value: urlValue, source: "tool_arguments", confidence: 0.94 });
  }

  if (appValue) {
    refs.push({ kind: "app", value: appValue, source: "tool_arguments", confidence: 0.9 });
  }

  if (taskId) {
    refs.push({ kind: "task", value: taskId, source: "tool_arguments", confidence: 0.92 });
  }

  if (book) {
    refs.push({ kind: "book", value: book, source: "tool_arguments", confidence: 0.9 });
  }

  if (project) {
    refs.push({ kind: "comic_project", value: project, source: "tool_arguments", confidence: 0.9 });
  }

  if (chapterId || chapterIndex || chapterTitle) {
    refs.push({
      kind: call.toolName.startsWith("comic_") ? "comic_chapter" : "chapter",
      value: chapterId || chapterTitle || `chapter:${chapterIndex}`,
      source: "tool_arguments",
      confidence: 0.84,
      metadata: {
        ...(chapterIndex ? { chapterIndex } : {}),
        ...(chapterId ? { chapterId } : {}),
        ...(chapterTitle ? { chapterTitle } : {})
      }
    });
  }

  return refs;
}

function extractToolResultRefs(call: AgentMcpCallRecord): AgentResourceResolvedRef[] {
  const refs: AgentResourceResolvedRef[] = [];

  for (const artifact of call.artifacts ?? []) {
    refs.push({
      kind: "artifact",
      value: artifact.url || pickString(artifact.metadata?.path) || artifact.id,
      source: "tool_result",
      confidence: 0.88,
      metadata: {
        id: artifact.id,
        kind: artifact.kind
      }
    });
  }

  const structuredContent = call.structuredContent ?? {};
  const taskId = pickString(structuredContent.taskId);
  const url = pickString(structuredContent.url) || pickString(structuredContent.videoUrl) || pickString(structuredContent.audioUrl) || pickString(structuredContent.imageUrl);

  if (taskId) {
    refs.push({ kind: "task", value: taskId, source: "tool_result", confidence: 0.86 });
  }

  if (url) {
    refs.push({ kind: "artifact", value: url, source: "tool_result", confidence: 0.86 });
  }

  return refs;
}

function collectContextText(params: {
  userInput: string;
  conversationMessages: ModelMessage[];
  taskLedger: AgentTaskLedger;
  mcpCalls: AgentMcpCallRecord[];
}): string {
  const { userInput, conversationMessages, taskLedger, mcpCalls } = params;
  const recentMessages = conversationMessages
    .slice(-4)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const planText = taskLedger.activePlan.map((step) => `${step.step} ${step.toolHint ?? ""} ${step.successCriteria ?? ""}`).join("\n");
  const criteriaText = taskLedger.structuredSuccessCriteria
    .map((criterion) => `${criterion.type} ${criterion.target ?? ""} ${criterion.expected} ${criterion.verificationMethod ?? ""}`)
    .join("\n");
  const toolText = mcpCalls
    .slice(-4)
    .map((call) => `${call.serverName} ${call.toolName} ${stringifyArguments(call.arguments)} ${call.resultText}`)
    .join("\n");

  return [
    userInput,
    taskLedger.objective,
    taskLedger.nextActionHint,
    ...taskLedger.constraints,
    planText,
    criteriaText,
    ...taskLedger.pendingSubtasks,
    recentMessages,
    toolText
  ]
    .filter(Boolean)
    .join("\n");
}

function createCandidate(input: {
  id: string;
  type: string;
  domain: AgentResourceDomain;
  label: string;
  confidence: number;
  mentions: string[];
  resolvedRefs?: AgentResourceResolvedRef[];
  capabilities: string[];
  preferredExecutionDomains: string[];
  toolHints: string[];
  rationale: string;
}): AgentResourceCandidate {
  return {
    ...input,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    mentions: uniqueStrings(input.mentions.map(truncateMention), 5),
    resolvedRefs: mergeResolvedRefs(input.resolvedRefs ?? []),
    capabilities: uniqueStrings(input.capabilities),
    preferredExecutionDomains: uniqueStrings(input.preferredExecutionDomains),
    toolHints: uniqueStrings(input.toolHints),
    rationale: truncateMention(input.rationale)
  };
}

function addCandidate(candidates: AgentResourceCandidate[], candidate: AgentResourceCandidate): void {
  const existingIndex = candidates.findIndex((entry) => entry.id === candidate.id);

  if (existingIndex < 0) {
    candidates.push(candidate);
    return;
  }

  const existing = candidates[existingIndex];
  candidates[existingIndex] = {
    ...existing,
    confidence: Math.max(existing.confidence, candidate.confidence),
    mentions: uniqueStrings([...existing.mentions, ...candidate.mentions], 5),
    resolvedRefs: mergeResolvedRefs([...existing.resolvedRefs, ...candidate.resolvedRefs]),
    capabilities: uniqueStrings([...existing.capabilities, ...candidate.capabilities]),
    preferredExecutionDomains: uniqueStrings([...existing.preferredExecutionDomains, ...candidate.preferredExecutionDomains]),
    toolHints: uniqueStrings([...existing.toolHints, ...candidate.toolHints]),
    rationale: existing.confidence >= candidate.confidence ? existing.rationale : candidate.rationale
  };
}

function refsForKinds(refs: AgentResourceResolvedRef[], kinds: AgentResourceResolvedRef["kind"][]): AgentResourceResolvedRef[] {
  return refs.filter((ref) => kinds.includes(ref.kind));
}

function inferCandidates(text: string, resolvedRefs: AgentResourceResolvedRef[]): AgentResourceCandidate[] {
  const searchableText = normalizeSearchText(text);
  const candidates: AgentResourceCandidate[] = [];
  const add = (candidate: AgentResourceCandidate): void => addCandidate(candidates, candidate);
  const hasComicSignal = /comic|storyboard|shot|panel|漫画|丹青溢彩|灵绘小筑|分镜|镜头|画面|素材|角色设计/u.test(searchableText);
  const hasExplicitWritingSignal = /writing|book|novel|墨笔生花|添香小筑|小说|书稿|书籍|故事资产|narrative\s*state/u.test(
    searchableText
  );
  const hasGenericWritingSignal = /chapter|story|character|plot|章节|正文|人物|剧情|设定/u.test(searchableText);

  if (/repo|repository|codebase|package|component|runtime|typescript|vue|css|test|代码|仓库|项目代码|组件|测试|构建/u.test(searchableText)) {
    add(
      createCandidate({
        id: "codebase.project",
        type: "codebase.project",
        domain: "codebase",
        label: "当前代码项目",
        confidence: 0.82,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["path"]),
        capabilities: ["inspect", "edit", "run_test", "verify", "summarize"],
        preferredExecutionDomains: ["workspace"],
        toolHints: ["read_file", "search_files", "replace_in_file", "run_shell_command"],
        rationale: "任务涉及代码、项目结构、测试或构建，应按代码项目资源推进"
      })
    );
  }

  if (
    /file|directory|path|json|diff|workspace|packages\/|apps\/|src\/|\.ts\b|\.tsx\b|\.js\b|\.vue\b|\.css\b|文件|目录|路径|工作区|本地|配置|json/u.test(
      searchableText
    )
  ) {
    add(
      createCandidate({
        id: "workspace.filesystem",
        type: "workspace.filesystem",
        domain: "workspace",
        label: "本地工作区文件系统",
        confidence: 0.74,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["path"]),
        capabilities: ["inspect", "read", "write", "diff", "verify"],
        preferredExecutionDomains: ["workspace"],
        toolHints: ["read_file", "search_files", "diff_paths", "validate_json_file"],
        rationale: "任务涉及文件、路径、目录或 JSON，应通过工作区资源读写和验证"
      })
    );
  }

  if (/url|http|https|web|search|research|github|official|docs|latest|网页|联网|搜索|调研|官网|官方|文档|最新/u.test(searchableText)) {
    add(
      createCandidate({
        id: "web.sources",
        type: "web.source",
        domain: "web",
        label: "联网资料来源",
        confidence: 0.78,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["url"]),
        capabilities: ["search", "read", "research", "cite", "verify"],
        preferredExecutionDomains: ["web_research"],
        toolHints: ["web_research", "web_search_v2", "github_search_repositories", "read_web_page"],
        rationale: "任务涉及联网资料、URL、官方文档或最新事实，应先建立来源资源"
      })
    );
  }

  if (/desktop|browser|chrome|safari|app|window|ui|click|screenshot|open app|桌面|浏览器|窗口|界面|点击|截图|打开应用/u.test(searchableText)) {
    add(
      createCandidate({
        id: "desktop.app",
        type: "desktop.app",
        domain: "desktop",
        label: "桌面应用或浏览器状态",
        confidence: 0.76,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["app", "url"]),
        capabilities: ["open", "inspect_ui", "navigate", "interact", "verify_ui"],
        preferredExecutionDomains: ["desktop"],
        toolHints: ["get_app_state", "open_app", "open_url", "click_text", "take_screenshot"],
        rationale: "任务涉及桌面或 UI 状态，应围绕桌面应用资源读取、操作和验证"
      })
    );
  }

  if (/artifact|output|export|download|preview|生成结果|产物|导出|下载|预览|结果文件/u.test(searchableText)) {
    add(
      createCandidate({
        id: "artifact.output",
        type: "artifact.output",
        domain: "artifact",
        label: "任务输出产物",
        confidence: 0.68,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["artifact", "path", "url"]),
        capabilities: ["create", "preview", "persist", "verify"],
        preferredExecutionDomains: ["workspace", "generation"],
        toolHints: ["write_file", "image_gen", "video_gen", "music_gen"],
        rationale: "任务涉及产物生成、预览或导出，应跟踪产物资源和验证状态"
      })
    );
  }

  if (/image|video|music|audio|poster|cover|illustration|bgm|song|图片|图像|视频|音乐|音频|歌曲|配乐|封面|海报|插画|生图/u.test(searchableText)) {
    add(
      createCandidate({
        id: "media.generated_asset",
        type: "media.asset",
        domain: "media",
        label: "生成式媒体资产",
        confidence: 0.8,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["artifact", "task", "url"]),
        capabilities: ["generate", "query_status", "preview", "attach", "verify"],
        preferredExecutionDomains: ["generation"],
        toolHints: ["image_gen", "video_gen", "music_gen"],
        rationale: "任务涉及图片、视频、音乐或音频生成，应按媒体资产资源推进"
      })
    );
  }

  if (hasExplicitWritingSignal || (hasGenericWritingSignal && !hasComicSignal)) {
    add(
      createCandidate({
        id: "writing.book",
        type: "writing.book",
        domain: "writing",
        label: "墨笔生花小说书稿",
        confidence: 0.84,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["book", "chapter", "path"]),
        capabilities: ["read", "plan", "review", "generate", "update", "verify_continuity"],
        preferredExecutionDomains: ["writing_asset", "application_asset"],
        toolHints: ["writing_list_books", "writing_read_book", "writing_search_book", "writing_update_chapter", "writing_update_story_assets"],
        rationale: "任务涉及小说、书稿、章节或故事资产，应围绕写作资源选择能力"
      })
    );
  }

  if (hasComicSignal) {
    add(
      createCandidate({
        id: "comic.project",
        type: "comic.project",
        domain: "comic",
        label: "丹青溢彩漫画项目",
        confidence: 0.84,
        mentions: [text],
        resolvedRefs: refsForKinds(resolvedRefs, ["comic_project", "comic_chapter", "chapter", "artifact"]),
        capabilities: ["read", "plan", "import_story", "split_storyboard", "generate_image", "update", "verify_visual_continuity"],
        preferredExecutionDomains: ["comic_asset", "application_asset", "generation"],
        toolHints: [
          "comic_list_projects",
          "comic_create_project",
          "comic_read_project",
          "comic_import_chapters",
          "comic_update_chapter",
          "comic_update_chapter_images",
          "comic_update_assets",
          "image_gen"
        ],
        rationale: "任务涉及漫画、分镜、镜头或素材，应围绕漫画项目资源推进"
      })
    );
  }

  if (/conversation|chat|thread|history|message|对话|会话|上下文|聊天记录|继续/u.test(searchableText)) {
    add(
      createCandidate({
        id: "conversation.thread",
        type: "conversation.thread",
        domain: "conversation",
        label: "当前命令工坊会话",
        confidence: 0.58,
        mentions: [text],
        resolvedRefs: [],
        capabilities: ["summarize", "continue", "clarify", "extract_task"],
        preferredExecutionDomains: ["conversation"],
        toolHints: [],
        rationale: "任务可能依赖当前会话上下文，应优先保持目标连续性"
      })
    );
  }

  return candidates
    .sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id))
    .slice(0, MAX_RESOURCE_CANDIDATES);
}

function inferIntent(text: string): string {
  const searchableText = normalizeSearchText(text);

  if (/delete|remove|rm|删除|移除|清理/u.test(searchableText)) {
    return "delete";
  }

  if (/write|update|replace|create|append|add|save|edit|修改|写入|写回|更新|创建|新增|追加|补全|保存|编辑/u.test(searchableText)) {
    return "update";
  }

  if (/generate|draw|render|compose|生成|绘制|出图|作曲|制作/u.test(searchableText)) {
    return "generate";
  }

  if (/verify|check|test|review|audit|validate|检查|验证|测试|审查|评估|校验/u.test(searchableText)) {
    return "review";
  }

  if (/search|research|look up|find|搜索|调研|查找|查询/u.test(searchableText)) {
    return "research";
  }

  if (/open|click|type|navigate|打开|点击|输入|跳转/u.test(searchableText)) {
    return "operate";
  }

  return "respond";
}

function inferRiskBoundary(intent: string): AgentResourceCapabilityFrame["riskBoundary"] {
  if (intent === "delete") {
    return "destructive";
  }

  if (["update", "generate", "operate"].includes(intent)) {
    return "stateful";
  }

  return "read_only";
}

function createCapability(input: AgentResourceCapabilityDefinition): AgentResourceCapabilityDefinition {
  return {
    ...input,
    appliesTo: uniqueStrings(input.appliesTo),
    preferredExecutionDomains: uniqueStrings(input.preferredExecutionDomains),
    toolHints: uniqueStrings(input.toolHints),
    verification: uniqueStrings(input.verification)
  };
}

function buildCapabilityRegistry(candidates: AgentResourceCandidate[], intent: string): AgentResourceCapabilityDefinition[] {
  const capabilities: AgentResourceCapabilityDefinition[] = [];
  const hasType = (type: string): boolean => candidates.some((candidate) => candidate.type === type);
  const add = (capability: AgentResourceCapabilityDefinition): void => {
    if (!capabilities.some((entry) => entry.id === capability.id)) {
      capabilities.push(createCapability(capability));
    }
  };

  if (hasType("codebase.project") || hasType("workspace.filesystem")) {
    add({
      id: "codebase.inspect",
      label: "读取代码上下文",
      intent: "inspect",
      appliesTo: ["codebase.project", "workspace.filesystem"],
      description: "按目标文件、目录或关键词读取局部代码上下文，避免无边界扫描整个仓库。",
      preferredExecutionDomains: ["workspace"],
      toolHints: ["search_files", "read_file", "list_directory"],
      verification: ["读到的文件路径存在", "返回内容与目标符号或关键词相关"],
      riskBoundary: "read_only"
    });
    add({
      id: "codebase.edit",
      label: "修改代码资源",
      intent: "update",
      appliesTo: ["codebase.project", "workspace.filesystem"],
      description: "对定位后的文件做最小范围修改，并保持仓库现有风格。",
      preferredExecutionDomains: ["workspace"],
      toolHints: ["replace_in_file", "write_file", "diff_paths"],
      verification: ["diff 显示目标文件变更", "必要测试或类型检查通过"],
      riskBoundary: "stateful"
    });
    add({
      id: "codebase.verify",
      label: "验证代码变更",
      intent: "verify",
      appliesTo: ["codebase.project", "workspace.filesystem"],
      description: "通过测试、类型检查、文件存在或 diff 校验代码任务是否完成。",
      preferredExecutionDomains: ["workspace"],
      toolHints: ["run_shell_command", "diff_paths", "validate_json_file"],
      verification: ["命令退出码为 0", "目标文件包含预期变更"],
      riskBoundary: "read_only"
    });
  }

  if (hasType("web.source")) {
    add({
      id: "web.research",
      label: "研究联网资料",
      intent: "research",
      appliesTo: ["web.source"],
      description: "搜索、读取并归纳来源，适合最新事实、官方文档和 GitHub 仓库调研。",
      preferredExecutionDomains: ["web_research"],
      toolHints: ["web_research", "web_search_v2", "github_search_repositories", "read_web_page"],
      verification: ["返回来源 URL", "结论可回溯到来源摘录"],
      riskBoundary: "read_only"
    });
  }

  if (hasType("desktop.app")) {
    add({
      id: "desktop.inspect",
      label: "读取桌面状态",
      intent: "inspect",
      appliesTo: ["desktop.app"],
      description: "读取前台或指定应用窗口、可见文本和 UI 元素，用于桌面 Agent 验证。",
      preferredExecutionDomains: ["desktop"],
      toolHints: ["get_app_state", "take_screenshot", "open_app", "open_url"],
      verification: ["UI 文本或截图显示预期状态"],
      riskBoundary: intent === "operate" ? "stateful" : "read_only"
    });
    add({
      id: "desktop.operate",
      label: "操作桌面应用",
      intent: "operate",
      appliesTo: ["desktop.app"],
      description: "打开应用或 URL、等待页面、点击可见文本并用 UI 状态验证结果；原始坐标点击作为末级 fallback。",
      preferredExecutionDomains: ["desktop"],
      toolHints: ["open_app", "open_url", "wait", "click_text", "play_media", "take_screenshot", "get_app_state"],
      verification: ["目标应用或 URL 已打开", "UI 文本、媒体播放状态或截图显示预期状态"],
      riskBoundary: "stateful"
    });
  }

  if (hasType("media.asset")) {
    add({
      id: "media.generate",
      label: "生成媒体资源",
      intent: "generate",
      appliesTo: ["media.asset", "artifact.output"],
      description: "生成或查询图片、视频、音乐等媒体产物，并保留 taskId / URL 供后续验证。",
      preferredExecutionDomains: ["generation"],
      toolHints: ["image_gen", "video_gen", "music_gen"],
      verification: ["返回 artifact URL 或 taskId", "pending 时可继续 query"],
      riskBoundary: "stateful"
    });
  }

  if (hasType("writing.book")) {
    add({
      id: "writing.review_continuity",
      label: "检查小说连续性",
      intent: "review",
      appliesTo: ["writing.book"],
      description: "读取书稿、章节和故事资产，检查人物、设定、伏笔或剧情漂移。",
      preferredExecutionDomains: ["writing_asset", "application_asset"],
      toolHints: ["writing_read_book", "writing_search_book", "writing_update_story_assets"],
      verification: ["读回目标书稿或章节", "发现项能引用章节或故事资产"],
      riskBoundary: "read_only"
    });
    add({
      id: "writing.update_asset",
      label: "更新小说资源",
      intent: "update",
      appliesTo: ["writing.book"],
      description: "预览或写回小说字段、章节正文、故事资产和 Narrative State。",
      preferredExecutionDomains: ["writing_asset", "application_asset"],
      toolHints: ["writing_update_chapter", "writing_update_book_fields", "writing_update_story_assets"],
      verification: ["写回工具 applied=true", "写后读回目标字段"],
      riskBoundary: "stateful"
    });
  }

  if (hasType("comic.project")) {
    add({
      id: "comic.read_project",
      label: "读取漫画项目",
      intent: "inspect",
      appliesTo: ["comic.project"],
      description: "读取项目字段、当前章节正文、分镜轨、图片和素材库，作为分镜拆分或出图前的状态基线。",
      preferredExecutionDomains: ["comic_asset", "application_asset"],
      toolHints: ["comic_read_project", "comic_list_projects"],
      verification: ["读回目标项目", "当前章节、素材和已有分镜可被引用"],
      riskBoundary: "read_only"
    });
    add({
      id: "comic.import_story",
      label: "导入小说故事到漫画项目",
      intent: "update",
      appliesTo: ["comic.project", "web.source"],
      description: "把线上小说、上传文本或章节目录转入丹青溢彩，创建项目并批量写入章节正文/简介，供后续分镜和素材提取使用。",
      preferredExecutionDomains: ["comic_asset", "application_asset", "web_research"],
      toolHints: ["web_research", "read_web_page", "comic_create_project", "comic_import_chapters", "comic_read_project"],
      verification: ["写回工具 applied=true", "读回项目章节数和来源信息"],
      riskBoundary: "stateful"
    });
    add({
      id: "comic.split_storyboard",
      label: "拆分漫画分镜",
      intent: "generate",
      appliesTo: ["comic.project"],
      description: "基于章节正文或简介拆分多条分镜，维护镜头、画面、提示词和引用素材。",
      preferredExecutionDomains: ["comic_asset", "application_asset"],
      toolHints: ["comic_read_project", "comic_import_chapters", "comic_update_chapter"],
      verification: ["章节 storyboards 数量与目标一致", "写后读回目标章节"],
      riskBoundary: "stateful"
    });
    add({
      id: "comic.render_images",
      label: "生成漫画图片",
      intent: "generate",
      appliesTo: ["comic.project", "media.asset"],
      description: "用 image_gen 生成漫画图并通过章节图片区或 storyboardId 写回项目。",
      preferredExecutionDomains: ["generation", "comic_asset", "application_asset"],
      toolHints: ["image_gen", "comic_update_chapter_images"],
      verification: ["图片 artifact 可访问", "图片写回目标章节或分镜"],
      riskBoundary: "stateful"
    });
  }

  if (!capabilities.length) {
    add({
      id: "conversation.respond",
      label: "直接回应会话",
      intent: "respond",
      appliesTo: ["conversation.thread"],
      description: "无需真实外部动作时，基于当前会话和任务账本直接回复。",
      preferredExecutionDomains: ["conversation"],
      toolHints: [],
      verification: ["最终回复直接回应用户目标"],
      riskBoundary: "read_only"
    });
  }

  return capabilities;
}

function findCapabilityDefinition(
  registry: AgentResourceCapabilityDefinition[],
  capabilityId: string
): AgentResourceCapabilityDefinition | undefined {
  return registry.find((capability) => capability.id === capabilityId);
}

function compactGatewayArgumentHints(
  hints: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(hints)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    output[key] = value;
  }

  return output;
}

function buildGatewayArgumentHints(
  primaryResource: AgentResourceCandidate | undefined,
  resolvedRefs: AgentResourceResolvedRef[]
): Record<string, string | number | boolean> {
  const pathValue = firstRefValue(resolvedRefs, "path");
  const urlValue = firstRefValue(resolvedRefs, "url");
  const appValue = firstRefValue(resolvedRefs, "app");
  const taskId = firstRefValue(resolvedRefs, "task");
  const bookIdOrTitle = firstRefValue(resolvedRefs, "book");
  const projectIdOrTitle = firstRefValue(resolvedRefs, "comic_project");
  const writingChapterId = firstChapterId(resolvedRefs, ["chapter"]);
  const writingChapterIndex = firstChapterIndex(resolvedRefs, ["chapter"]);
  const comicChapterId = firstChapterId(resolvedRefs, ["comic_chapter", "chapter"]);
  const comicChapterIndex = firstChapterIndex(resolvedRefs, ["comic_chapter", "chapter"]);

  if (primaryResource?.type === "writing.book") {
    return compactGatewayArgumentHints({
      bookIdOrTitle,
      chapterId: writingChapterId,
      chapterIndex: writingChapterIndex ?? undefined,
      includeStoryAssets: true,
      includeNarrativeState: true
    });
  }

  if (primaryResource?.type === "comic.project") {
    return compactGatewayArgumentHints({
      projectIdOrTitle,
      chapterId: comicChapterId,
      chapterIndex: comicChapterIndex ?? undefined,
      includeAssets: true,
      includeImages: true
    });
  }

  if (primaryResource?.domain === "media") {
    return compactGatewayArgumentHints({
      taskId,
      url: urlValue
    });
  }

  if (primaryResource?.domain === "web") {
    return compactGatewayArgumentHints({
      url: urlValue
    });
  }

  if (primaryResource?.domain === "desktop") {
    return compactGatewayArgumentHints({
      app: appValue,
      url: urlValue
    });
  }

  return compactGatewayArgumentHints({
    path: pathValue,
    url: urlValue,
    taskId
  });
}

function createGatewayStep(
  capability: AgentResourceCapabilityDefinition | undefined,
  phase: AgentResourceGatewayStep["phase"],
  argumentHints: Record<string, string | number | boolean>,
  overrides: Partial<Pick<AgentResourceGatewayStep, "expectedOutcome" | "verificationMethod" | "toolHints">> = {}
): AgentResourceGatewayStep | null {
  if (!capability) {
    return null;
  }

  return {
    phase,
    capabilityId: capability.id,
    intent: capability.intent,
    preferredExecutionDomains: capability.preferredExecutionDomains,
    toolHints: uniqueStrings(overrides.toolHints ?? capability.toolHints),
    argumentHints,
    expectedOutcome: overrides.expectedOutcome ?? capability.verification[0] ?? capability.description,
    verificationMethod: overrides.verificationMethod ?? capability.verification.join("；"),
    riskBoundary: capability.riskBoundary
  };
}

function addGatewayStep(steps: AgentResourceGatewayStep[], step: AgentResourceGatewayStep | null): void {
  if (!step) {
    return;
  }

  const key = `${step.phase}:${step.capabilityId}`;

  if (!steps.some((entry) => `${entry.phase}:${entry.capabilityId}` === key)) {
    steps.push(step);
  }
}

function buildResourceGatewayPlan(
  context: AgentResourceCapabilityFrame,
  primaryResource: AgentResourceCandidate | undefined,
  resolvedRefs: AgentResourceResolvedRef[]
): AgentResourceGatewayPlan {
  const registry = context.registry;
  const steps: AgentResourceGatewayStep[] = [];
  const argumentHints = buildGatewayArgumentHints(primaryResource, resolvedRefs);
  const capability = (id: string): AgentResourceCapabilityDefinition | undefined => findCapabilityDefinition(registry, id);
  const hasIntent = (...intents: string[]): boolean => intents.includes(context.intent);
  const searchableResourceText = normalizeSearchText(
    [
      primaryResource?.mentions.join(" "),
      primaryResource?.capabilities.join(" "),
      context.capabilities.join(" "),
      resolvedRefs.map((ref) => ref.value).join(" ")
    ].join(" ")
  );

  if (!primaryResource) {
    return {
      intent: context.intent,
      summary: "Resource Gateway 未识别强资源；保持直接回应或按需读取上下文。",
      steps: [],
      toolBias: [],
      argumentHints,
      verificationBias: context.verificationBias
    };
  }

  if (primaryResource.type === "codebase.project" || primaryResource.type === "workspace.filesystem") {
    addGatewayStep(steps, createGatewayStep(capability("codebase.inspect"), "inspect", argumentHints));

    if (hasIntent("update", "delete")) {
      addGatewayStep(
        steps,
        createGatewayStep(capability("codebase.edit"), "act", argumentHints, {
          expectedOutcome: "目标文件出现最小范围代码变更",
          verificationMethod: "使用 diff、文件读取和必要测试确认变更"
        })
      );
    }

    addGatewayStep(steps, createGatewayStep(capability("codebase.verify"), "verify", argumentHints));
  } else if (primaryResource.type === "web.source") {
    addGatewayStep(steps, createGatewayStep(capability("web.research"), "inspect", argumentHints));
  } else if (primaryResource.type === "desktop.app") {
    addGatewayStep(steps, createGatewayStep(capability("desktop.inspect"), "inspect", argumentHints));

    if (hasIntent("operate", "update")) {
      addGatewayStep(steps, createGatewayStep(capability("desktop.operate"), "act", argumentHints));
      addGatewayStep(steps, createGatewayStep(capability("desktop.inspect"), "verify", argumentHints));
    }
  } else if (primaryResource.type === "media.asset") {
    addGatewayStep(steps, createGatewayStep(capability("media.generate"), "act", argumentHints));
    addGatewayStep(
      steps,
      createGatewayStep(capability("media.generate"), "verify", argumentHints, {
        toolHints: ["video_gen", "music_gen", "image_gen"],
        expectedOutcome: "媒体任务返回 completed、artifact URL 或可继续查询的 taskId",
        verificationMethod: "检查结构化结果中的 artifacts、url、taskId、pending 或 completed 字段"
      })
    );
  } else if (primaryResource.type === "writing.book") {
    addGatewayStep(steps, createGatewayStep(capability("writing.review_continuity"), "inspect", argumentHints));

    if (hasIntent("update", "generate", "delete")) {
      addGatewayStep(
        steps,
        createGatewayStep(capability("writing.update_asset"), "act", argumentHints, {
          expectedOutcome: "目标小说字段、章节或故事资产完成预览或写回",
          verificationMethod: "写回后调用 writing_read_book 读回目标字段，确认 applied=true 和关键内容匹配"
        })
      );
      addGatewayStep(
        steps,
        createGatewayStep(capability("writing.review_continuity"), "verify", argumentHints, {
          toolHints: ["writing_read_book", "writing_search_book"],
          expectedOutcome: "读回目标小说和章节",
          verificationMethod: "确认目标书籍、章节或 storyAssets 中存在本轮变更，且没有把修改说明写入成品字段"
        })
      );
    }
  } else if (primaryResource.type === "comic.project") {
    addGatewayStep(steps, createGatewayStep(capability("comic.read_project"), "inspect", argumentHints));

    if (hasIntent("generate", "update")) {
      if (/导入|提取|抓取|小说|章节|目录|正文|source|url|web|convert|转换|改编/u.test(searchableResourceText)) {
        addGatewayStep(
          steps,
          createGatewayStep(capability("comic.import_story"), "act", argumentHints, {
            toolHints: ["web_research", "read_web_page", "comic_create_project", "comic_import_chapters", "comic_read_project"],
            expectedOutcome: "线上或上传的小说来源被整理为丹青溢彩项目和章节正文/简介",
            verificationMethod: "调用 comic_read_project 读回项目，确认 source、chapterCount、章节 title/content 已写入"
          })
        );
      }

      addGatewayStep(
        steps,
        createGatewayStep(capability("comic.split_storyboard"), "act", argumentHints, {
          expectedOutcome: "目标章节获得可编辑的分镜轨道、章节正文引用和出图提示",
          verificationMethod: "写回后调用 comic_read_project 读回目标章节，确认 storyboards 数量、标题、画面和 prompt"
        })
      );
    }

    if (/render_images|generate_image|attach|media\.generate/u.test(context.capabilities.join(" "))) {
      addGatewayStep(
        steps,
        createGatewayStep(capability("comic.render_images"), "act", argumentHints, {
          expectedOutcome: "image_gen 返回漫画图 artifact，并可写入章节图片区或分镜",
          verificationMethod: "确认图片 artifact 可引用，并通过 comic_read_project 读回章节图片"
        })
      );
    }

    if (hasIntent("generate", "update")) {
      addGatewayStep(steps, createGatewayStep(capability("comic.read_project"), "verify", argumentHints));
    }
  }

  const toolBias = uniqueStrings([
    ...steps.flatMap((step) => step.toolHints),
    ...primaryResource.toolHints
  ]);
  const stepSummary = steps.length
    ? steps.map((step) => `${step.phase}:${step.capabilityId}`).join(" -> ")
    : "无显式步骤";

  return {
    resourceId: primaryResource.id,
    resourceType: primaryResource.type,
    intent: context.intent,
    summary: `Resource Gateway 建议围绕 ${primaryResource.type} 执行：${stepSummary}`,
    steps,
    toolBias,
    argumentHints,
    verificationBias: uniqueStrings([...context.verificationBias, ...steps.map((step) => step.verificationMethod)])
  };
}

function buildCapabilityFrame(text: string, candidates: AgentResourceCandidate[]): AgentResourceCapabilityFrame {
  const intent = inferIntent(text);
  const primaryResource = candidates[0];
  const registry = buildCapabilityRegistry(candidates, intent);
  const capabilities = uniqueStrings([
    intent,
    ...registry.map((capability) => capability.id),
    ...candidates.flatMap((candidate) => candidate.capabilities).filter((capability) => {
      if (intent === "review") {
        return /review|verify|inspect|read|search|check/u.test(capability);
      }

      if (intent === "update") {
        return /update|write|edit|persist|verify|read/u.test(capability);
      }

      if (intent === "generate") {
        return /generate|query_status|preview|attach|verify|read/u.test(capability);
      }

      return true;
    })
  ]);
  const preferredExecutionDomains = uniqueStrings(candidates.flatMap((candidate) => candidate.preferredExecutionDomains), 6);

  return {
    ...(primaryResource ? { primaryResourceId: primaryResource.id } : {}),
    intent,
    capabilities,
    registry,
    preferredExecutionDomains,
    riskBoundary: inferRiskBoundary(intent),
    verificationBias: uniqueStrings([
      "优先用资源读回、状态查询、JSON 校验、文件存在、UI 可见文本或产物 URL 验证结果",
      primaryResource ? `围绕 ${primaryResource.type} 的当前版本和可观察状态验证` : "围绕当前任务资源的可观察状态验证"
    ])
  };
}

export function buildAgentResourceContext(params: {
  userInput: string;
  conversationMessages: ModelMessage[];
  taskLedger: AgentTaskLedger;
  mcpCalls: AgentMcpCallRecord[];
}): AgentResourceContext {
  const text = collectContextText(params);
  const textRefs = [
    ...extractTextRefs(params.userInput, "user_input"),
    ...extractTextRefs(params.conversationMessages.slice(-4).map((message) => message.content).join("\n"), "conversation"),
    ...extractTextRefs(
      [params.taskLedger.objective, params.taskLedger.nextActionHint, ...params.taskLedger.pendingSubtasks, ...params.taskLedger.successCriteria].join(
        "\n"
      ),
      "ledger"
    )
  ];
  const toolRefs = params.mcpCalls.flatMap((call) => [...extractToolArgumentRefs(call), ...extractToolResultRefs(call)]);
  const resolvedRefs = mergeResolvedRefs([...textRefs, ...toolRefs]);
  const candidates = inferCandidates(text, resolvedRefs);
  const capabilityFrame = buildCapabilityFrame(text, candidates);
  const capabilityRegistry = capabilityFrame.registry;
  const primaryResource = candidates[0];
  const gatewayPlan = buildResourceGatewayPlan(capabilityFrame, primaryResource, resolvedRefs);

  return {
    registryVersion: "gordon-resource-registry/v1",
    summary: primaryResource
      ? `Resource Registry 识别主资源：${primaryResource.type}（${primaryResource.label}）；意图：${capabilityFrame.intent}；建议能力：${capabilityRegistry
          .slice(0, 4)
          .map((capability) => capability.id)
          .join(", ")}；解析引用 ${resolvedRefs.length} 个。`
      : `Resource Registry 未识别到强资源信号；意图：${capabilityFrame.intent}；优先保持会话目标连续性并按需读取上下文。`,
    ...(primaryResource ? { primaryResource } : {}),
    candidates,
    resolvedRefs,
    capabilityRegistry,
    capabilityFrame,
    gatewayPlan,
    routingPolicy:
      "Planner 应先判断当前任务资源与 resolvedRefs，再选择 capabilityRegistry 中最贴近的资源能力，并参考 gatewayPlan 的 inspect / act / verify 步骤选择工具；工具只是落地方式。路径拼接、低阶 GUI 原语和文件遍历优先由 Runtime 或高阶资源能力承接。"
  };
}
