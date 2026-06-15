import { computed } from "vue";

import {
  BUILTIN_GORDON_AGENT_ID,
  buildCommandWorkshopArtifact,
  buildCommandWorkshopTitle,
  renderRichText,
  sortCommandWorkshopSessions,
  summarizeCommandWorkshopContent,
  truncateText
} from "../../lib/presenter.js";
import { didAgentMutateWorkbenchResources } from "../shell/workbenchRefreshDetection.js";
import {
  buildCommandApplicationContext,
  buildCommandUserInputForAgent,
  buildCommandWorkshopLiveArtifact,
  buildConversationMessagesForAgentRun,
  findLatestCommandTaskLedger
} from "./commandWorkshopRuntime.js";

function readRef(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function isAbortError(error) {
  return error instanceof Error && (error.name === "AbortError" || /aborted|abort|停止|中断/u.test(error.message));
}

function formatCommandFailureKind(failureKind) {
  if (failureKind === "network_timeout") {
    return "网络连接超时";
  }

  if (failureKind === "schema_mismatch") {
    return "Schema 不匹配";
  }

  if (failureKind === "tool_unavailable") {
    return "工具不可用";
  }

  if (failureKind === "tool_execution") {
    return "工具执行失败";
  }

  if (failureKind === "permission_denied") {
    return "权限受限";
  }

  if (failureKind === "environment_state") {
    return "环境状态变化";
  }

  if (failureKind === "wrong_tool") {
    return "工具不匹配";
  }

  if (failureKind === "action_too_early") {
    return "时序过早";
  }

  if (failureKind === "nonexistent_entity") {
    return "目标不存在";
  }

  return "未知失败";
}

const MAX_COMMAND_ARGUMENT_STRING_LENGTH = 320;
const MAX_COMMAND_ARGUMENT_ARRAY_ITEMS = 12;
const MAX_COMMAND_ARGUMENT_OBJECT_KEYS = 24;
const MAX_COMMAND_PROCESS_OUTPUT_LENGTH = 900;
const MAX_COMMAND_PROCESS_DETAIL_LENGTH = 260;
const MAX_COMMAND_QUEUE_ITEM_SUMMARY_LENGTH = 34;
const COMMAND_LIVE_ACTIVITY_STEP_TYPES = new Set([
  "run_received",
  "context_prepared",
  "runtime_initializing",
  "runtime_config_loaded",
  "agent_selected",
  "model_selected",
  "skill_selected",
  "mcp_authorized",
  "tool_discovery_started",
  "tool_discovery_completed",
  "mcp_auto_planning",
  "mcp_auto_stopped",
  "model_response_started",
  "model_invoked",
  "completed"
]);
const COMMAND_HISTORY_HIDDEN_STEP_TYPES = new Set(
  [...COMMAND_LIVE_ACTIVITY_STEP_TYPES].filter((type) => type !== "mcp_auto_stopped")
);
const COMMAND_VISIBLE_AUXILIARY_STEP_TYPES = new Set([
  "skill_handler_completed",
  "skill_handler_failed",
  "workspace_permission_granted",
  "workspace_permission_denied",
  "computer_use_permission_granted",
  "computer_use_permission_denied",
  "tool_permission_granted",
  "tool_permission_denied"
]);

function isSensitiveCommandArgumentKey(key) {
  return /api[_-]?key|authorization|bearer|token|secret|password|credential|cookie/u.test(String(key ?? "").toLowerCase());
}

function sanitizeCommandArgumentValue(value, key = "", depth = 0) {
  if (key && isSensitiveCommandArgumentKey(key)) {
    return "[已脱敏]";
  }

  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (trimmedValue.startsWith("data:image/") || trimmedValue.startsWith("data:video/") || trimmedValue.startsWith("data:audio/")) {
      return `[媒体数据已省略，${value.length} 字符]`;
    }

    if (value.length > MAX_COMMAND_ARGUMENT_STRING_LENGTH) {
      return `${value.slice(0, MAX_COMMAND_ARGUMENT_STRING_LENGTH)}...（已截断 ${value.length - MAX_COMMAND_ARGUMENT_STRING_LENGTH} 字符）`;
    }

    return value;
  }

  if (depth >= 4) {
    return "[层级过深，已省略]";
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_COMMAND_ARGUMENT_ARRAY_ITEMS)
      .map((item) => sanitizeCommandArgumentValue(item, key, depth + 1));

    if (value.length > MAX_COMMAND_ARGUMENT_ARRAY_ITEMS) {
      items.push(`[已省略 ${value.length - MAX_COMMAND_ARGUMENT_ARRAY_ITEMS} 项]`);
    }

    return items;
  }

  if (typeof value === "object") {
    const output = {};
    const entries = Object.entries(value);

    for (const [entryKey, entryValue] of entries.slice(0, MAX_COMMAND_ARGUMENT_OBJECT_KEYS)) {
      output[entryKey] = sanitizeCommandArgumentValue(entryValue, entryKey, depth + 1);
    }

    if (entries.length > MAX_COMMAND_ARGUMENT_OBJECT_KEYS) {
      output.__omitted = `[已省略 ${entries.length - MAX_COMMAND_ARGUMENT_OBJECT_KEYS} 个字段]`;
    }

    return output;
  }

  return String(value);
}

function stringifyCommandArtifactArguments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  return JSON.stringify(sanitizeCommandArgumentValue(value), null, 2);
}

function getCommandArtifactResolvedCallArguments(call) {
  const structuredContent = call?.structuredContent && typeof call.structuredContent === "object" ? call.structuredContent : null;
  const requestBody =
    structuredContent?.requestBody && typeof structuredContent.requestBody === "object" && !Array.isArray(structuredContent.requestBody)
      ? structuredContent.requestBody
      : structuredContent?.call?.requestBody && typeof structuredContent.call.requestBody === "object" && !Array.isArray(structuredContent.call.requestBody)
        ? structuredContent.call.requestBody
        : null;

  return requestBody ?? call?.arguments;
}

function shouldForceCommandApplicationTools(input, applicationContext) {
  const inputText = String(input ?? "");
  const text = `${inputText}\n${applicationContext ?? ""}`;
  const mentionsApplication =
    /应用：(?:墨笔生花|丹青溢彩)|墨笔生花|writing|小说|书稿|书籍|当前小说|丹青溢彩|comic|漫画|分镜|素材库|当前项目|当前章节|应用广场/u.test(
      text
    );
  const wantsMutation = /创建|新建|新增|保存|写入|写回|导入|生成并写入|修改|更新|补充|整理到|落到|添加到|建立/u.test(inputText);

  return mentionsApplication && wantsMutation;
}

function isCommandContinuationInput(input) {
  const text = String(input ?? "").trim();

  return /^(确认|继续|继续下一步|下一步|开始|开始吧|执行|执行吧|生成|生成吧|可以|好的|好|ok|OK|yes|Yes|按这个|按默认|就这样)$/u.test(text);
}

function isCommandToolFollowupInput(input) {
  const text = String(input ?? "").trim();

  return /(?:轮询|继续查|继续查询|查询|查一下|刷新|获取|拿到|看看).*(?:生成结果|结果|状态|任务|taskId|task id|视频链接|音频链接|图片链接|链接|URL|url)|(?:生成结果|任务状态|视频链接|音频链接|图片链接|taskId|task id).*(?:查询|轮询|刷新|获取|看看)|(?:还在生成|running|processing|pending|生成中).*(?:继续|查询|轮询|刷新)/iu.test(text);
}

function hasPendingCommandToolIntent(messages = [], latestTaskLedger = null) {
  const recentText = (Array.isArray(messages) ? messages : [])
    .slice(-6)
    .map((message) => `${message?.role ?? ""}: ${message?.content ?? ""}`)
    .join("\n");
  const ledgerText = latestTaskLedger
    ? [
        latestTaskLedger.objective,
        latestTaskLedger.nextActionHint,
        ...(latestTaskLedger.pendingSubtasks ?? []),
        ...(latestTaskLedger.successCriteria ?? []),
        ...(latestTaskLedger.failedAttempts ?? []).map((attempt) => `${attempt.action} ${attempt.recoveryHint ?? ""}`)
      ].join("\n")
    : "";
  const text = `${recentText}\n${ledgerText}`;

  return (
    /(?:music_gen|video_gen|image_gen|Gordon Tools|音乐生成工具|图片生成工具|视频生成工具|生成音频|生成音乐|生成视频|视频生成|生成图片|生成产物|媒体生成|工具调用|任务\s*ID|taskId|task id|视频链接|音频链接|图片链接|running|processing|pending)/iu.test(
      text
    ) &&
    /(?:尚未|未生成|未完成|未验证|没有实际调用|没有工具调用|下一步|需要|待执行|继续|调用|生成|查询|轮询|状态|running|processing|pending)/iu.test(text)
  );
}

function shouldAutoEnableCommandTools(input, attachments = [], messages = [], latestTaskLedger = null) {
  const text = String(input ?? "");

  if (Array.isArray(attachments) && attachments.length) {
    return true;
  }

  if (isCommandContinuationInput(text) && hasPendingCommandToolIntent(messages, latestTaskLedger)) {
    return true;
  }

  if (isCommandToolFollowupInput(text) && hasPendingCommandToolIntent(messages, latestTaskLedger)) {
    return true;
  }

  return (
    /(https?:\/\/[^\s)\]}>"'，。；、]+)|\bwww\.[^\s)\]}>"'，。；、]+/iu.test(text) ||
    /(?:有哪些|有什么|列出|查看|显示).*(?:工具|tool|MCP|能力)|(?:工具|tool|MCP|能力).*(?:清单|列表|可用|启用|有哪些|有什么)/iu.test(text) ||
    /搜索|上网|联网|查一下|查找|调研|资料|来源|引用|官方文档|最新|现在|今天|新闻|价格|版本|GitHub|开源|仓库|repo|repository/iu.test(text) ||
    /文件|目录|仓库|代码|README|package\.json|tsconfig|\.ts\b|\.js\b|\.vue\b|\.json\b|检查|读取|打开|搜索|替换|修改|更新|新增|创建|删除|移动|重命名|diff|对比|运行|测试|build|lint|打包/iu.test(text) ||
    /(?:music_gen|video_gen|image_gen)|(?:生成|创作|制作|产出|调用|使用).*(?:图片|图像|海报|图标|logo|生成图|生图|文生图|图生图|视频|音乐|音频|歌曲|曲子|乐曲|配乐|伴奏|BGM|bgm|钢琴曲|笛子音乐|纯音乐)|(?:图片|图像|海报|图标|logo|生成图|生图|文生图|图生图|视频|音乐|音频|歌曲|曲子|乐曲|配乐|伴奏|BGM|bgm|钢琴|笛子|古筝|吉他|小提琴|纯音乐).*(?:生成|创作|制作|产出|调用|使用)/iu.test(text) ||
    /点击|输入|截图|窗口|浏览器|桌面|打开应用|菜单|按钮|复制|粘贴|飞书|Chrome|Safari|Electron/iu.test(text)
  );
}

function shouldUseCommandAutoToolPlanner(
  input,
  attachments = [],
  applicationContext = "",
  allowAutoTools = true,
  messages = [],
  latestTaskLedger = null
) {
  if (!allowAutoTools) {
    return false;
  }

  return (
    shouldForceCommandApplicationTools(input, applicationContext) ||
    shouldAutoEnableCommandTools(input, attachments, messages, latestTaskLedger)
  );
}

function collapseRepeatedCommandText(text) {
  const source = String(text ?? "");

  if (!source.trim()) {
    return source;
  }

  const paragraphs = source.split(/\n{2,}/u);
  const collapsedParagraphs = [];

  for (const paragraph of paragraphs) {
    const normalizedParagraph = paragraph.replace(/\s+/gu, " ").trim();
    const previous = collapsedParagraphs[collapsedParagraphs.length - 1] ?? "";

    if (normalizedParagraph.length >= 80 && previous.replace(/\s+/gu, " ").trim() === normalizedParagraph) {
      continue;
    }

    collapsedParagraphs.push(paragraph);
  }

  const paragraphCollapsed = collapsedParagraphs.join("\n\n");
  const trimmed = paragraphCollapsed.trim();
  const collapsedLines = paragraphCollapsed.split(/\n/u);

  for (let size = Math.floor(collapsedLines.length / 2); size >= 2; size -= 1) {
    const output = [];
    let index = 0;

    while (index < collapsedLines.length) {
      const block = collapsedLines.slice(index, index + size).join("\n").trim();
      const nextBlock = collapsedLines.slice(index + size, index + size * 2).join("\n").trim();

      if (block.length >= 120 && block === nextBlock) {
        output.push(...collapsedLines.slice(index, index + size));
        index += size * 2;

        while (collapsedLines.slice(index, index + size).join("\n").trim() === block) {
          index += size;
        }

        continue;
      }

      output.push(collapsedLines[index]);
      index += 1;
    }

    if (output.length < collapsedLines.length) {
      return output.join("\n").trim();
    }
  }

  for (let repeat = 2; repeat <= 4; repeat += 1) {
    if (trimmed.length < repeat * 120 || trimmed.length % repeat !== 0) {
      continue;
    }

    const unit = trimmed.slice(0, trimmed.length / repeat);

    if (unit.trim().length >= 120 && unit.repeat(repeat) === trimmed) {
      return unit.trim();
    }
  }

  return paragraphCollapsed;
}

export function createCommandWorkshopActions({
  activeFeature,
  commandWorkshopViewRef,
  copyRichTextToClipboard,
  copyTextToClipboard,
  desktopApi,
  enabledAgentProfiles,
  featureCommandWorkshopId,
  formatFailureKind,
  getAgentById,
  getAgentRunnableSkills,
  getAuthorizedMcpServersForAgent,
  getMcpServerById,
  getSkillById,
  nextTick,
  resolveBoundModelName,
  refreshWorkbenchSnapshot,
  setStatus,
  showAlertDialog,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
}) {
  let commandMessageCopyTimer = null;

  function runOnNextTick(callback) {
    if (typeof nextTick === "function") {
      void nextTick(callback);
      return;
    }

    Promise.resolve().then(callback);
  }

  function getPreferredCommandWorkshopAgent(configuredAgentId = "") {
    const agents = readRef(enabledAgentProfiles) ?? [];

    return (
      agents.find((profile) => profile.id === String(configuredAgentId ?? "").trim()) ??
      agents.find((profile) => profile.id === BUILTIN_GORDON_AGENT_ID) ??
      agents[0] ??
      null
    );
  }

  function normalizeCommandWorkshopConfig(config = {}) {
    const selectedAgent = getPreferredCommandWorkshopAgent(config.agentProfileId);
    const agentProfileId = selectedAgent?.id ?? "";
    const skillIdCandidate = String(config.skillId ?? "").trim();
    const mcpServerIdCandidate = String(config.mcpServerId ?? "").trim();
    const mcpToolNameCandidate = String(config.mcpToolName ?? "").trim();
    const runnableSkills = selectedAgent ? getAgentRunnableSkills(selectedAgent.id) : [];
    const authorizedServers = selectedAgent ? getAuthorizedMcpServersForAgent(selectedAgent.id) : [];
    const hasAuthorizedServer = authorizedServers.some((server) => server.id === mcpServerIdCandidate);

    return {
      agentProfileId,
      skillId: runnableSkills.some((skill) => skill.id === skillIdCandidate) ? skillIdCandidate : "",
      autoSelectMcp: config.autoSelectMcp !== false,
      mcpServerId: hasAuthorizedServer ? mcpServerIdCandidate : "",
      mcpToolName: hasAuthorizedServer ? mcpToolNameCandidate : "",
      mcpArgumentsText: String(config.mcpArgumentsText ?? "{}").trim() || "{}"
    };
  }

  function normalizeCommandWorkshopSession(session) {
    return {
      ...(session ?? {}),
      ...normalizeCommandWorkshopConfig(session ?? {}),
      messages: toPlainIpcData(session?.messages ?? [], []).map((message) => ({
        ...message,
        attachments: toPlainIpcData(message?.attachments ?? [], [])
      }))
    };
  }

  function normalizeCommandWorkshopSessions(sessions) {
    return sortCommandWorkshopSessions((Array.isArray(sessions) ? sessions : []).map((session) => normalizeCommandWorkshopSession(session)));
  }

  function clearCommandMessageCopyTimer() {
    if (commandMessageCopyTimer) {
      clearTimeout(commandMessageCopyTimer);
      commandMessageCopyTimer = null;
    }
  }

  function markCommandMessageCopied(messageId) {
    clearCommandMessageCopyTimer();
    ui.command.copiedMessageId = messageId ?? null;
    commandMessageCopyTimer = setTimeout(() => {
      ui.command.copiedMessageId = null;
      commandMessageCopyTimer = null;
    }, 1600);
  }

  function renderCommandMessageCopyHtml(content) {
    const html = renderRichText(content);
    const template = document.createElement("template");

    template.innerHTML = html;
    template.content.querySelectorAll("[data-command-copy-code]").forEach((element) => element.remove());

    return template.innerHTML;
  }

  function getCommandMessageExportKey(message, format) {
    return `${message?.id ?? ""}:${format}`;
  }

  const activeCommandSession = computed(() =>
    workbench.commandSessions.find((session) => session.id === ui.command.activeSessionId) ?? null
  );

  const activeCommandMessages = computed(() => activeCommandSession.value?.messages ?? []);
  const commandSelectedAgent = computed(() => getAgentById(ui.command.form.agentProfileId));
  const commandRunnableSkills = computed(() => getAgentRunnableSkills(ui.command.form.agentProfileId));
  const commandAuthorizedServers = computed(() => getAuthorizedMcpServersForAgent(ui.command.form.agentProfileId));

  const commandToolOptions = computed(() => {
    const options = [...ui.command.availableMcpTools];

    if (ui.command.form.mcpToolName && !options.some((tool) => tool.name === ui.command.form.mcpToolName)) {
      options.unshift({
        name: ui.command.form.mcpToolName,
        description: "当前已保存工具",
        serverId: ui.command.form.mcpServerId,
        serverName: commandAuthorizedServers.value.find((server) => server.id === ui.command.form.mcpServerId)?.name ?? ""
      });
    }

    return options;
  });

  const commandChatTitle = computed(() => truncateText(activeCommandSession.value?.title ?? "开始一轮协作", 10) || "开始一轮协作");
  const pendingCommandGuidanceMessages = computed(() => {
    const messageIds = new Set((activeCommandSession.value?.messages ?? []).map((message) => message?.id).filter(Boolean));

    return (Array.isArray(ui.command.pendingGuidanceQueue) ? ui.command.pendingGuidanceQueue : [])
      .map((item) => item?.message)
      .filter((message) => message?.id && !messageIds.has(message.id));
  });

  const commandSettingsSummary = computed(() => {
    const selectedAgent = getAgentById(ui.command.form.agentProfileId);

    return [
      selectedAgent?.name ?? "Gordon",
      resolveBoundModelName(selectedAgent?.modelProfileId),
      getCommandWorkshopModeLabel(ui.command.form),
      getCommandWorkshopToolModeLabel(ui.command.form)
    ].join(" / ");
  });

  function focusCommandInput() {
    runOnNextTick(() => {
      commandWorkshopViewRef.value?.focusCommandInput?.();
    });
  }

  function scrollCommandToBottom() {
    runOnNextTick(() => {
      commandWorkshopViewRef.value?.scrollCommandToBottom?.();
    });
  }

  function openCommandWorkspace() {
    writeRef(activeFeature, featureCommandWorkshopId);

    if (workbench.commandSessions.length) {
      ui.command.view = "list";
      return;
    }

    beginNewCommandSession();
  }

  function beginNewCommandSession() {
    writeRef(activeFeature, featureCommandWorkshopId);
    ui.command.view = "chat";
    ui.command.composerView = "input";
    ui.command.activeSessionId = null;
    ui.command.activeProgressEventId = null;
    ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
    ui.command.draftInput = "";
    ui.command.attachments = [];
    ui.command.requestQueue = [];
    ui.command.pendingGuidanceQueue = [];
    ui.command.queuedRunDraft = null;
    ui.command.availableMcpTools = [];
    ui.command.liveProgress = null;
    focusCommandInput();
  }

  function backToCommandList() {
    ui.command.view = "list";
    ui.command.composerView = "input";
  }

  function openCommandSession(sessionId) {
    const session = workbench.commandSessions.find((entry) => entry.id === sessionId);

    if (!session) {
      return;
    }

    writeRef(activeFeature, featureCommandWorkshopId);
    ui.command.view = "chat";
    ui.command.composerView = "input";
    ui.command.activeSessionId = session.id;
    ui.command.activeProgressEventId = null;
    ui.command.form = normalizeCommandWorkshopConfig(session);
    ui.command.availableMcpTools = [];
    ui.command.draftInput = "";
    ui.command.attachments = [];
    ui.command.requestQueue = [];
    ui.command.pendingGuidanceQueue = [];
    ui.command.queuedRunDraft = null;
    ui.command.liveProgress = null;
    scrollCommandToBottom();
  }

  async function handleCommandSessionDelete(sessionId) {
    if (!desktopApi) {
      return;
    }

    const session = workbench.commandSessions.find((entry) => entry.id === sessionId);

    if (!session) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除命令工坊会话",
      message: `确认删除会话「${session.title || "当前会话"}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    try {
      const sessions = await desktopApi.deleteCommandWorkshopSession(sessionId);
      workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));

      if (ui.command.activeSessionId === sessionId) {
        if (workbench.commandSessions.length) {
          ui.command.activeSessionId = workbench.commandSessions[0].id;
          ui.command.view = "list";
        } else {
          beginNewCommandSession();
        }
      }

      setStatus("会话已删除。", "success");
    } catch (error) {
      console.error("Failed to delete command session", error);
      setStatus(`会话删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function handleCommandAgentChange() {
    ui.command.form = normalizeCommandWorkshopConfig({
      ...ui.command.form,
      mcpServerId: "",
      mcpToolName: ""
    });
    ui.command.availableMcpTools = [];
  }

  function handleCommandServerChange() {
    ui.command.form = normalizeCommandWorkshopConfig({
      ...ui.command.form,
      mcpToolName: ""
    });
    ui.command.availableMcpTools = [];
  }

  async function handleCommandMessageCopy(message) {
    const content = String(message?.content ?? "").trim();

    if (!content) {
      setStatus("当前 AI 回复没有可复制的内容。", "warning");
      return;
    }

    try {
      const renderedHtml = renderCommandMessageCopyHtml(content);
      const copiedFormat =
        typeof copyRichTextToClipboard === "function"
          ? await copyRichTextToClipboard({ html: renderedHtml, text: content })
          : await copyTextToClipboard(content);

      markCommandMessageCopied(message?.id ?? null);

      if (copiedFormat === "html") {
        setStatus("AI 回复已复制为富文本。", "success");
      } else {
        setStatus("AI 回复已复制为纯文本。", "success");
      }
    } catch (error) {
      console.error("Failed to copy command assistant message", error);
      setStatus(`复制 AI 回复失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleCommandMessageExport(message, format) {
    const content = String(message?.content ?? "").trim();
    const normalizedFormat = format === "docx" ? "docx" : "pdf";

    if (!content) {
      setStatus("当前 AI 回复没有可导出的内容。", "warning");
      return;
    }

    if (!desktopApi?.exportCommandWorkshopMessage) {
      setStatus("当前桌面桥接暂不支持文档导出。", "danger");
      return;
    }

    const activeSession = activeCommandSession.value;
    const exportKey = getCommandMessageExportKey(message, normalizedFormat);
    ui.command.exportingMessageKey = exportKey;

    try {
      const result = await desktopApi.exportCommandWorkshopMessage({
        fileName: `${activeSession?.title || "Gordon AI 回复"}-${normalizedFormat.toUpperCase()}`,
        format: normalizedFormat,
        title: activeSession?.title || "Gordon AI 回复",
        agentName: resolveBoundModelName(commandSelectedAgent.value?.modelProfileId)
          ? `${commandSelectedAgent.value?.name ?? "Gordon"} / ${resolveBoundModelName(commandSelectedAgent.value?.modelProfileId)}`
          : commandSelectedAgent.value?.name ?? "Gordon",
        createdAt: message?.createdAt ?? new Date().toISOString(),
        contentText: content,
        contentHtml: renderCommandMessageCopyHtml(content)
      });

      if (!result) {
        setStatus("已取消导出。", "neutral");
        return;
      }

      setStatus(`AI 回复已导出为 ${normalizedFormat.toUpperCase()}：${result.fileName}`, "success");
    } catch (error) {
      console.error("Failed to export command assistant message", error);
      setStatus(`导出 AI 回复失败：${getErrorMessage(error)}`, "danger");
    } finally {
      if (ui.command.exportingMessageKey === exportKey) {
        ui.command.exportingMessageKey = null;
      }
    }
  }

  function handleCommandInputCompositionStart() {
    ui.command.isInputComposing = true;
  }

  function handleCommandInputCompositionEnd() {
    ui.command.isInputComposing = false;
  }

  function handleCommandInputEnterKeydown(event) {
    if (event.isComposing || ui.command.isInputComposing || event.key === "Process" || event.keyCode === 229) {
      return;
    }

    event.preventDefault();
    void handleCommandSubmit();
  }

  async function handleCommandAttachmentSelect() {
    if (!desktopApi?.selectCommandWorkshopAttachments) {
      setStatus("当前桌面桥接暂不支持上传附件。", "danger");
      return;
    }

    if (!commandSelectedAgent.value) {
      return;
    }

    try {
      const attachments = await desktopApi.selectCommandWorkshopAttachments();

      if (!attachments?.length) {
        return;
      }

      const currentPaths = new Set(ui.command.attachments.map((attachment) => attachment.path));
      ui.command.attachments = [
        ...ui.command.attachments,
        ...attachments.filter((attachment) => !currentPaths.has(attachment.path))
      ];
      setStatus(`已添加 ${attachments.length} 个附件。`, "success");
    } catch (error) {
      console.error("Failed to select command attachments", error);
      setStatus(`附件读取失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function removeCommandAttachment(attachmentId) {
    ui.command.attachments = ui.command.attachments.filter((attachment) => attachment.id !== attachmentId);
  }

  async function handleCommandRunCancel() {
    const progressEventId = ui.command.activeProgressEventId;

    if (!desktopApi?.cancelAgentRun || !progressEventId || !ui.command.isRunning) {
      return false;
    }

    ui.command.cancelRequested = true;
    setStatus("正在停止命令工坊本轮运行...", "warning");

    try {
      const cancelled = await desktopApi.cancelAgentRun(progressEventId);

      if (!cancelled) {
        setStatus("当前运行已进入收尾阶段，正在等待结束。", "warning");
      }

      return Boolean(cancelled);
    } catch (error) {
      console.error("Failed to cancel command workshop run", error);
      setStatus(`停止失败：${getErrorMessage(error)}`, "danger");
      return false;
    }
  }

  function createCommandQueueItem(input, attachments = []) {
    const content = String(input ?? "").trim();
    const queuedAttachments = toPlainIpcData(attachments ?? [], []);

    return {
      id: `command_queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      attachments: queuedAttachments,
      createdAt: new Date().toISOString()
    };
  }

  function getCommandQueueItemTitle(item) {
    const content = String(item?.content ?? "").trim();

    if (content) {
      return content;
    }

    const attachments = Array.isArray(item?.attachments) ? item.attachments : [];

    if (attachments.length) {
      return attachments.map((attachment) => attachment?.name).filter(Boolean).join("、") || "附件请求";
    }

    return "空请求";
  }

  function getCommandQueueItemSummary(item) {
    const title = getCommandQueueItemTitle(item).replace(/\s+/gu, " ").trim();

    if (title.length <= MAX_COMMAND_QUEUE_ITEM_SUMMARY_LENGTH) {
      return title;
    }

    return `${title.slice(0, MAX_COMMAND_QUEUE_ITEM_SUMMARY_LENGTH)}...`;
  }

  function hasCommandDraftContent() {
    return Boolean(String(ui.command.draftInput ?? "").trim() || toPlainIpcData(ui.command.attachments ?? [], []).length);
  }

  function queueCommandGuidance(input, attachments = []) {
    const item = createCommandQueueItem(input, attachments);
    ui.command.requestQueue = [...(Array.isArray(ui.command.requestQueue) ? ui.command.requestQueue : []), item];
    ui.command.draftInput = "";
    ui.command.attachments = [];
    return item;
  }

  function createPendingGuidanceFromQueueItem(item) {
    const content = String(item?.content ?? "").trim();
    const attachments = toPlainIpcData(item?.attachments ?? [], []);
    const createdAt = new Date().toISOString();
    const messageId = `command_message_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      id: `command_guidance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      attachments,
      createdAt,
      message: {
        id: messageId,
        role: "user",
        content: content || "请阅读并处理我上传的附件。",
        createdAt,
        attachments
      }
    };
  }

  function normalizeQueuedRunDraft(item, source = "queue") {
    return {
      id: item?.id ?? `command_queued_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source,
      content: String(item?.content ?? "").trim(),
      attachments: toPlainIpcData(item?.attachments ?? [], []),
      createdAt: item?.message?.createdAt ?? item?.createdAt ?? new Date().toISOString(),
      messageId: item?.message?.id ?? null,
      pendingGuidanceId: source === "guidance" ? item?.id ?? null : null
    };
  }

  function activateQueuedCommandGuidance(item, source = "queue") {
    if (!item) {
      return false;
    }

    ui.command.queuedRunDraft = normalizeQueuedRunDraft(item, source);
    runOnNextTick(() => {
      void handleCommandSubmit();
    });
    return source;
  }

  function runQueuedCommandGuidanceIfNeeded() {
    if (ui.command.queuedRunDraft) {
      return false;
    }

    const pendingGuidanceQueue = Array.isArray(ui.command.pendingGuidanceQueue) ? ui.command.pendingGuidanceQueue : [];
    const nextGuidance = pendingGuidanceQueue.find(
      (item) => String(item?.content ?? "").trim() || toPlainIpcData(item?.attachments ?? [], []).length
    );

    if (nextGuidance) {
      return activateQueuedCommandGuidance(nextGuidance, "guidance");
    }

    ui.command.pendingGuidanceQueue = [];

    const queue = Array.isArray(ui.command.requestQueue) ? ui.command.requestQueue : [];
    const nextItem = queue.find((item) => String(item?.content ?? "").trim() || toPlainIpcData(item?.attachments ?? [], []).length);

    if (!nextItem) {
      ui.command.requestQueue = [];
      return false;
    }

    ui.command.requestQueue = queue.filter((item) => item?.id !== nextItem.id);
    return activateQueuedCommandGuidance(nextItem, "queue");
  }

  function handleCommandQueueItemEdit(itemId) {
    const queue = Array.isArray(ui.command.requestQueue) ? ui.command.requestQueue : [];
    const item = queue.find((entry) => entry?.id === itemId);

    if (!item) {
      return;
    }

    ui.command.requestQueue = queue.filter((entry) => entry?.id !== itemId);
    ui.command.draftInput = String(item.content ?? "").trim();
    ui.command.attachments = toPlainIpcData(item.attachments ?? [], []);
    focusCommandInput();
  }

  function handleCommandQueueItemDelete(itemId) {
    ui.command.requestQueue = (Array.isArray(ui.command.requestQueue) ? ui.command.requestQueue : []).filter((entry) => entry?.id !== itemId);
  }

  function handleCommandQueueItemGuide(itemId) {
    const queue = Array.isArray(ui.command.requestQueue) ? ui.command.requestQueue : [];
    const item = queue.find((entry) => entry?.id === itemId);

    if (!item) {
      return;
    }

    const pendingGuidance = createPendingGuidanceFromQueueItem(item);

    ui.command.requestQueue = queue.filter((entry) => entry?.id !== itemId);
    ui.command.pendingGuidanceQueue = [
      ...(Array.isArray(ui.command.pendingGuidanceQueue) ? ui.command.pendingGuidanceQueue : []),
      pendingGuidance
    ];
    scrollCommandToBottom();

    if (!ui.command.isRunning) {
      runQueuedCommandGuidanceIfNeeded();
    }
  }

  function recoverQueuedRunDraft() {
    const draft = ui.command.queuedRunDraft;

    if (!draft) {
      return;
    }

    if (draft.source === "queue" && (String(draft.content ?? "").trim() || toPlainIpcData(draft.attachments ?? [], []).length)) {
      ui.command.requestQueue = [
        {
          id: draft.id,
          content: draft.content,
          attachments: toPlainIpcData(draft.attachments ?? [], []),
          createdAt: draft.createdAt ?? new Date().toISOString()
        },
        ...(Array.isArray(ui.command.requestQueue) ? ui.command.requestQueue : [])
      ];
    }

    ui.command.queuedRunDraft = null;
  }

  function handleAgentRunProgress(payload) {
    if (!payload?.progressEventId || payload.progressEventId !== ui.command.activeProgressEventId) {
      return;
    }

    ui.command.liveProgress = {
      progressEventId: payload.progressEventId,
      phase: payload.phase ?? "running",
      statusText: payload.statusText || "正在执行中",
      text: typeof payload.text === "string" ? payload.text : ui.command.liveProgress?.text ?? "",
      updatedAt: payload.updatedAt ?? new Date().toISOString(),
      artifact: buildCommandWorkshopLiveArtifact({
        ...payload,
        steps: mergeCommandLiveProcessSteps(ui.command.liveProgress?.artifact?.steps, payload.steps)
      })
    };
    scrollCommandToBottom();
  }

  async function handleCommandLoadMcpTools() {
    if (!desktopApi) {
      return;
    }

    if (!ui.command.form.mcpServerId) {
      setStatus("请先选择一个工具服务，再读取工具。", "warning");
      return;
    }

    try {
      const tools = await desktopApi.listMcpServerTools(ui.command.form.mcpServerId);
      ui.command.availableMcpTools = tools;

      if (!tools.some((tool) => tool.name === ui.command.form.mcpToolName)) {
        ui.command.form.mcpToolName = tools[0]?.name ?? "";
      }

      setStatus(`命令工坊已读取 ${tools.length} 个工具。`, "success");
    } catch (error) {
      console.error("Failed to load command tools", error);
      setStatus(`命令工坊工具读取失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function upsertCommandWorkshopSessionState(session) {
    const nextSessions = workbench.commandSessions.filter((entry) => entry.id !== session.id);
    workbench.commandSessions = sortCommandWorkshopSessions([normalizeCommandWorkshopSession(session), ...nextSessions]);
    ui.command.activeSessionId = session.id;
  }

  function createCommandLocalProcessStep(type, title, detail, createdAt = new Date().toISOString()) {
    return {
      id: `command_local_step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      detail,
      createdAt
    };
  }

  function mergeCommandLiveProcessSteps(previousSteps, nextSteps) {
    const mergedSteps = [];
    const seenTypes = new Set();
    const appendStep = (step) => {
      if (!step || typeof step !== "object") {
        return;
      }

      const type = String(step.type ?? "");

      if (type && COMMAND_LIVE_ACTIVITY_STEP_TYPES.has(type)) {
        if (seenTypes.has(type)) {
          return;
        }

        seenTypes.add(type);
      }

      mergedSteps.push(step);
    };

    for (const step of Array.isArray(previousSteps) ? previousSteps : []) {
      if (step?.id && String(step.id).startsWith("command_local_step_")) {
        appendStep(step);
      }
    }

    for (const step of Array.isArray(nextSteps) ? nextSteps : []) {
      appendStep(step);
    }

    return mergedSteps;
  }

  async function handleCommandSubmit() {
    if (!desktopApi) {
      setStatus("桌面桥接未就绪，暂无法执行命令工坊会话。", "danger");
      recoverQueuedRunDraft();
      return;
    }

    const queuedRunDraft = ui.command.queuedRunDraft;
    const isQueuedRun = Boolean(queuedRunDraft);
    const agent = getAgentById(ui.command.form.agentProfileId);
    const userInput = isQueuedRun ? String(queuedRunDraft?.content ?? "").trim() : ui.command.draftInput.trim();
    const attachments = isQueuedRun
      ? toPlainIpcData(queuedRunDraft?.attachments ?? [], [])
      : toPlainIpcData(ui.command.attachments ?? [], []);

    if (ui.command.isRunning && !isQueuedRun) {
      if (!userInput && !attachments.length) {
        setStatus("当前任务仍在运行；输入内容后可加入请求队列。", "warning");
        return;
      }

      const queuedItem = queueCommandGuidance(userInput, attachments);
      setStatus(`已加入请求队列：${getCommandQueueItemSummary(queuedItem)}`, "success");
      return;
    }

    const applicationContext = buildCommandApplicationContext(ui, workbench);
    const agentUserInput = buildCommandUserInputForAgent(userInput, attachments, applicationContext);
    const activeSession = toPlainIpcData(activeCommandSession.value, null);
    const baseMessages = toPlainIpcData(activeSession?.messages ?? [], []);
    const latestTaskLedger = findLatestCommandTaskLedger(baseMessages);
    const allowAutoTools = ui.command.form.autoSelectMcp;
    const forceApplicationTools = shouldForceCommandApplicationTools(userInput, applicationContext);
    const autoEnableTools = shouldAutoEnableCommandTools(userInput, attachments, baseMessages, latestTaskLedger);
    const effectiveAutoSelectMcp = shouldUseCommandAutoToolPlanner(
      userInput,
      attachments,
      applicationContext,
      allowAutoTools,
      baseMessages,
      latestTaskLedger
    );
    const effectiveMcpServerId = forceApplicationTools && !ui.command.form.mcpToolName ? "" : ui.command.form.mcpServerId;
    const effectiveMcpToolName = forceApplicationTools && !ui.command.form.mcpToolName ? "" : ui.command.form.mcpToolName;
    let mcpArguments = undefined;

    if (!agent) {
      setStatus("请先选择一个可用 Agent。", "warning");
      recoverQueuedRunDraft();
      return;
    }

    if (!userInput && !attachments.length) {
      setStatus("先输入一条任务，或上传一个附件，再让 Gordon 开始工作。", "warning");
      recoverQueuedRunDraft();
      return;
    }

    if (effectiveMcpToolName && !effectiveMcpServerId) {
      setStatus("如果要指定工具，请先选择工具服务。", "warning");
      recoverQueuedRunDraft();
      return;
    }

    if (effectiveMcpServerId && !effectiveMcpToolName && !effectiveAutoSelectMcp) {
      setStatus("已选择工具服务，请再选择具体工具，或开启自动工具。", "warning");
      recoverQueuedRunDraft();
      return;
    }

    if (effectiveMcpServerId && effectiveMcpToolName) {
      try {
        mcpArguments = JSON.parse(ui.command.form.mcpArgumentsText);
      } catch (error) {
        setStatus(`工具参数 JSON 解析失败：${getErrorMessage(error)}`, "danger");
        recoverQueuedRunDraft();
        return;
      }

      if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
        setStatus("工具参数必须是一个 JSON 对象。", "danger");
        recoverQueuedRunDraft();
        return;
      }
    }

    const sessionId = activeSession?.id ?? `command_session_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const progressEventId = `command_progress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const existingQueuedRunMessage = queuedRunDraft?.messageId
      ? (Array.isArray(ui.command.pendingGuidanceQueue) ? ui.command.pendingGuidanceQueue : [])
          .map((item) => item?.message)
          .find((message) => message?.id === queuedRunDraft.messageId)
      : null;
    const userMessage = {
      id: existingQueuedRunMessage?.id ?? `command_message_${Date.now()}`,
      role: "user",
      content: (existingQueuedRunMessage?.content ?? userInput) || "请阅读并处理我上传的附件。",
      createdAt: existingQueuedRunMessage?.createdAt ?? startedAt,
      attachments: existingQueuedRunMessage?.attachments ?? attachments
    };
    const existingUserMessageId = userMessage.id;
    const normalizedBaseMessages = baseMessages.filter((message) => message?.id !== existingUserMessageId);
    const conversationBaseMessages = queuedRunDraft?.messageId
      ? normalizedBaseMessages
      : baseMessages;
    const titleSource = userInput || attachments.map((attachment) => attachment.name).join("、");
    const pendingSession = {
      id: sessionId,
      title: activeSession?.title || buildCommandWorkshopTitle(titleSource),
      summary: summarizeCommandWorkshopContent(titleSource),
      agentProfileId: ui.command.form.agentProfileId,
      skillId: ui.command.form.skillId || null,
      autoSelectMcp: allowAutoTools,
      mcpServerId: effectiveMcpServerId || null,
      mcpToolName: effectiveMcpToolName || null,
      mcpArgumentsText: ui.command.form.mcpArgumentsText,
      messages: [...normalizedBaseMessages, userMessage],
      createdAt: activeSession?.createdAt ?? startedAt,
      updatedAt: startedAt
    };

    upsertCommandWorkshopSessionState(pendingSession);
    if (queuedRunDraft?.pendingGuidanceId) {
      ui.command.pendingGuidanceQueue = (Array.isArray(ui.command.pendingGuidanceQueue) ? ui.command.pendingGuidanceQueue : []).filter(
        (item) => item?.id !== queuedRunDraft.pendingGuidanceId
      );
    }
    ui.command.queuedRunDraft = null;
    ui.command.isRunning = true;
    ui.command.cancelRequested = false;
    ui.command.isInputComposing = false;
    ui.command.activeProgressEventId = progressEventId;
    ui.command.liveProgress = {
      progressEventId,
      phase: "running",
      statusText: "已接收任务，正在整理上下文...",
      text: "",
      updatedAt: startedAt,
      artifact: buildCommandWorkshopLiveArtifact({
        profileLabel: "",
        model: "",
        skillName: ui.command.form.skillId ? getSkillById(ui.command.form.skillId)?.name ?? null : null,
        autoSelectedMcp: false,
        mcpServerName: effectiveMcpServerId ? getMcpServerById(effectiveMcpServerId)?.name ?? null : null,
        mcpToolName: effectiveMcpToolName || null,
        mcpResultText: "",
        mcpCalls: [],
        stopReason: "",
        taskLedger: null,
        steps: [
          createCommandLocalProcessStep(
            "run_received",
            "已接收任务",
            attachments.length
              ? `用户消息已进入命令工坊，包含 ${attachments.length} 个附件。`
              : "用户消息已进入命令工坊。待会儿每一步都会在这里更新。"
          ),
          createCommandLocalProcessStep(
            "context_prepared",
            "正在整理上下文",
            [
              latestTaskLedger ? "已带入上一轮任务账本" : "当前为本轮新上下文",
              applicationContext ? "已附加应用广场上下文" : "",
              effectiveAutoSelectMcp ? "已识别为工具任务" : "将优先走快速流式回复"
            ].filter(Boolean).join(" / "),
            new Date(Date.now() + 1).toISOString()
          ),
          createCommandLocalProcessStep(
            "runtime_initializing",
            "正在启动 Gordon Runtime",
            `准备运行 Agent「${agent.name}」${ui.command.form.skillId ? "，并附加 Skill" : ""}。`,
            new Date(Date.now() + 2).toISOString()
          )
        ],
        createdAt: startedAt
      })
    };
    ui.command.view = "chat";
    if (!isQueuedRun) {
      ui.command.draftInput = "";
      ui.command.attachments = [];
    }
    scrollCommandToBottom();

    try {
      const runStatusText = forceApplicationTools
        ? effectiveAutoSelectMcp
          ? "检测到应用资产写入任务，已自动启用应用工具。"
          : "检测到应用资产写入任务，但当前已关闭自动工具。"
        : autoEnableTools && allowAutoTools
          ? "检测到需要工具处理的任务，已进入工具编排。"
          : autoEnableTools
            ? "检测到工具任务，但当前已关闭自动工具。"
          : `命令工坊正在运行 Agent「${agent.name}」...`;

      setStatus(
        runStatusText,
        "neutral"
      );
      const runRequest = toPlainIpcData({
        agentProfileId: agent.id,
        userInput: agentUserInput,
        conversationMessages: buildConversationMessagesForAgentRun(conversationBaseMessages),
        ...(latestTaskLedger ? { taskLedger: latestTaskLedger } : {}),
        progressEventId,
        ...(ui.command.form.skillId ? { skillId: ui.command.form.skillId } : {}),
        ...(effectiveAutoSelectMcp ? { autoSelectMcp: true } : {}),
        ...(effectiveMcpServerId ? { mcpServerId: effectiveMcpServerId } : {}),
        ...(effectiveMcpServerId && effectiveMcpToolName
          ? {
              mcpToolName: effectiveMcpToolName,
              mcpArguments
            }
          : {})
      });
      const result = await desktopApi.runAgent(runRequest);
      const assistantContent = collapseRepeatedCommandText(result.text);
      const normalizedResult = {
        ...result,
        text: assistantContent
      };

      const assistantMessage = {
        id: `command_message_${Date.now()}_assistant`,
        role: "assistant",
        content: assistantContent,
        state: "completed",
        createdAt: result.createdAt,
        artifact: buildCommandWorkshopArtifact(normalizedResult)
      };
      const completedSession = {
        ...pendingSession,
        summary: summarizeCommandWorkshopContent(assistantContent),
        messages: [...pendingSession.messages, assistantMessage],
        updatedAt: result.updatedAt
      };
      const sessions = await desktopApi.upsertCommandWorkshopSession(toPlainIpcData(completedSession));

      workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
      ui.command.activeSessionId = completedSession.id;
      workbench.agentRunLogs = [normalizedResult, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
      ui.command.isRunning = false;
      ui.command.cancelRequested = false;
      ui.command.activeProgressEventId = null;
      ui.command.queuedRunDraft = null;
      ui.command.liveProgress = null;
      if (typeof refreshWorkbenchSnapshot === "function" && didAgentMutateWorkbenchResources(result)) {
        await refreshWorkbenchSnapshot();
      }
      setStatus(`命令工坊已完成本轮响应（${result.profileLabel}）。`, "success");
      if (runQueuedCommandGuidanceIfNeeded() === "queue") {
        setStatus("正在按队列继续执行。", "neutral");
      }
      scrollCommandToBottom();
    } catch (error) {
      console.error("Failed to run command workshop session", error);
      const failedAt = new Date().toISOString();
      const wasCancelled = ui.command.cancelRequested || isAbortError(error);
      const streamedText = collapseRepeatedCommandText(ui.command.liveProgress?.text ?? "").trim();
      const stoppedContent = streamedText ? `${streamedText}\n\n（已停止）` : "本轮运行已停止。";
      const assistantMessage = {
        id: `command_message_${Date.now()}_${wasCancelled ? "stopped" : "error"}`,
        role: "assistant",
        content: wasCancelled ? stoppedContent : `运行失败：${getErrorMessage(error)}`,
        state: wasCancelled ? "stopped" : "error",
        createdAt: failedAt,
        ...(ui.command.liveProgress?.artifact ? { artifact: ui.command.liveProgress.artifact } : {})
      };
      const failedSession = {
        ...pendingSession,
        summary: summarizeCommandWorkshopContent(assistantMessage.content),
        messages: [...pendingSession.messages, assistantMessage],
        updatedAt: failedAt
      };

      try {
        const sessions = await desktopApi.upsertCommandWorkshopSession(toPlainIpcData(failedSession));
        workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
        ui.command.activeSessionId = failedSession.id;
      } catch (persistError) {
        console.error("Failed to persist command failure session", persistError);
        upsertCommandWorkshopSessionState(failedSession);
      }

      ui.command.isRunning = false;
      ui.command.cancelRequested = false;
      ui.command.activeProgressEventId = null;
      ui.command.queuedRunDraft = null;
      ui.command.liveProgress = null;
      setStatus(wasCancelled ? "命令工坊已停止，本轮部分输出已保留。" : `命令工坊运行失败：${getErrorMessage(error)}`, wasCancelled ? "warning" : "danger");
      if (runQueuedCommandGuidanceIfNeeded() === "queue") {
        setStatus("正在按队列继续执行。", "neutral");
      }

      if (!wasCancelled) {
        void showAlertDialog({
          tone: "danger",
          title: "命令工坊运行失败",
          message: getErrorMessage(error),
          detail: "失败消息已保留在当前会话中，可回到消息流查看上下文后重试。",
          confirmText: "知道了"
        });
      }
      scrollCommandToBottom();
    }
  }

  function getCommandWorkshopModeLabel(config) {
    if (!config?.skillId) {
      return "默认策略";
    }

    return getSkillById(config.skillId)?.name ?? "指定 Skill";
  }

  function getCommandWorkshopToolModeLabel(config) {
    if (config?.mcpServerId && config?.mcpToolName) {
      const serverName = getMcpServerById(config.mcpServerId)?.name ?? "指定工具服务";
      return `${serverName} / ${config.mcpToolName}`;
    }

    return config?.autoSelectMcp ? "按需工具" : "纯对话";
  }

  function getCommandArtifactSummary(artifact) {
    const toolCount = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls.length : 0;
    const executionItems = getCommandArtifactExecutionItems(artifact);
    const actionCount = executionItems.length;
    const hasToolAction = executionItems.some((item) => item?.kind === "tool");
    const summaryParts = [];

    if (toolCount) {
      summaryParts.push(`${toolCount} 次工具`);
    } else if (hasToolAction) {
      summaryParts.push("工具执行中");
    } else if (actionCount) {
      summaryParts.push("直接回复");
    } else {
      summaryParts.push("准备中");
    }

    if (actionCount && (toolCount || hasToolAction)) {
      summaryParts.push(`${actionCount} 个关键动作`);
    }

    return `执行详情 · ${summaryParts.join(" / ")}`;
  }

  function normalizeCommandArtifactInlineText(value) {
    return String(value ?? "")
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function normalizeCommandArtifactProduct(artifact, index = 0) {
    if (!artifact || typeof artifact !== "object") {
      return null;
    }

    const kind = String(artifact.kind ?? "").trim();
    const src = String(artifact.dataUrl || artifact.url || "").trim();

    if (!["image", "audio", "video"].includes(kind) || !src) {
      return null;
    }

    const provider = String(artifact.provider ?? "").trim();
    const model = String(artifact.model ?? "").trim();
    const prompt = normalizeCommandArtifactInlineText(artifact.prompt);
    const meta = [provider, model, prompt].filter(Boolean).join(" / ");

    return {
      id: String(artifact.id ?? "").trim() || `generated_product_${index}`,
      kind,
      src,
      title:
        String(artifact.title ?? "").trim() ||
        (kind === "audio" ? `生成音频 ${index + 1}` : kind === "video" ? `生成视频 ${index + 1}` : `生成图片 ${index + 1}`),
      url: String(artifact.url ?? "").trim(),
      meta
    };
  }

  function getCommandArtifactProducts(artifact) {
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const products = calls.flatMap((call) => (Array.isArray(call?.artifacts) ? call.artifacts : []));

    return products
      .map((product, index) => normalizeCommandArtifactProduct(product, index))
      .filter(Boolean);
  }

  function getCommandArtifactStepSecondary(step) {
    const detail = normalizeCommandArtifactInlineText(step?.detail);

    if (!detail || detail === step?.title) {
      return "";
    }

    return detail;
  }

  function getCommandArtifactAuxiliaryStepTitle(step) {
    if (step?.type === "skill_handler_completed") {
      return "执行 Skill Handler";
    }

    if (step?.type === "skill_handler_failed") {
      return "Skill Handler 执行失败";
    }

    if (step?.type === "workspace_permission_granted") {
      return "已授权外部路径访问";
    }

    if (step?.type === "workspace_permission_denied") {
      return "外部路径访问被拒绝";
    }

    if (step?.type === "computer_use_permission_granted") {
      return "已授权桌面控制";
    }

    if (step?.type === "computer_use_permission_denied") {
      return "桌面控制授权被拒绝";
    }

    return step?.title ?? "执行动作";
  }

  function normalizeCommandArtifactAuxiliaryStep(step, index = 0) {
    if (!COMMAND_VISIBLE_AUXILIARY_STEP_TYPES.has(step?.type)) {
      return null;
    }

    return {
      id: step?.id ?? `step_${index}`,
      kind: "step",
      className: step?.type?.endsWith("_failed") || step?.type?.endsWith("_denied") ? "is-error" : "",
      title: getCommandArtifactAuxiliaryStepTitle(step),
      secondary: getCommandArtifactStepSecondary(step),
      createdAt: step?.createdAt ?? "",
      step
    };
  }

  function getCommandArtifactCallTitle(call) {
    return `使用工具：${call?.serverName ?? "工具服务"} / ${call?.toolName ?? "工具"}`;
  }

  function getCommandToolActionTitle(toolName, serverName = "") {
    const normalizedToolName = String(toolName ?? "").trim();
    const normalizedServerName = String(serverName ?? "").trim();
    const lowerToolName = normalizedToolName.toLowerCase();

    const toolTitleMap = {
      read_web_page: "读取网页内容",
      web_research: "联网研究资料",
      web_search: "搜索网页资料",
      web_search_v2: "搜索网页资料",
      github_search_repositories: "搜索 GitHub 仓库",
      read_file: "读取文件",
      write_file: "写入文件",
      list_directory: "查看目录",
      inspect_path: "检查路径",
      path_info: "检查路径",
      diff_paths: "对比文件差异",
      search_files: "搜索工作区",
      search_workspace: "搜索工作区",
      run_shell_command: "运行命令",
      get_app_state: "读取桌面状态",
      open_app: "打开桌面应用",
      open_url: "打开网页",
      take_screenshot: "截取桌面画面",
      click: "点击界面",
      type_text: "输入文本",
      press_key: "发送按键",
      image_gen: "生成图片",
      video_gen: "生成视频",
      music_gen: "生成音频",
      writing_list_books: "读取小说列表",
      writing_read_book: "读取小说资产",
      writing_search_book: "检索小说内容",
      writing_create_book: "创建小说资产",
      writing_update_book_fields: "更新小说设定",
      writing_update_chapter: "更新小说章节",
      writing_update_story_assets: "更新故事资产",
      comic_list_projects: "读取漫画项目列表",
      comic_read_project: "读取漫画项目",
      comic_update_project_fields: "更新漫画项目",
      comic_create_chapter: "创建漫画章节",
      comic_update_chapter: "更新章节分镜",
      comic_update_chapter_images: "写入章节图片",
      comic_update_assets: "更新漫画素材库"
    };

    if (toolTitleMap[lowerToolName]) {
      return toolTitleMap[lowerToolName];
    }

    if (/workspace tools/iu.test(normalizedServerName)) {
      return "处理工作区内容";
    }

    if (/search tools/iu.test(normalizedServerName)) {
      return "检索外部资料";
    }

    if (/gordon tools/iu.test(normalizedServerName)) {
      return "调用生成能力";
    }

    if (/application tools/iu.test(normalizedServerName)) {
      return "处理应用资产";
    }

    return normalizedToolName ? `使用工具：${normalizedToolName}` : "执行工具动作";
  }

  function getCommandToolProcessTag(serverName, toolName) {
    const normalizedServerName = String(serverName ?? "").trim();
    const normalizedToolName = String(toolName ?? "").trim();

    if (!normalizedToolName && !normalizedServerName) {
      return null;
    }

    return {
      label: normalizedToolName || normalizedServerName,
      detail: [normalizedServerName, normalizedToolName].filter(Boolean).join(" / ")
    };
  }

  function getCommandArgumentSummaryValue(value, maxLength = 96) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return "";
    }

    return truncateCommandProcessText(value, maxLength);
  }

  function getCommandToolArgumentSummary(argumentsObject) {
    if (!argumentsObject || typeof argumentsObject !== "object" || Array.isArray(argumentsObject)) {
      return "";
    }

    const priorityEntries = [
      ["url", "目标"],
      ["href", "目标"],
      ["path", "路径"],
      ["filePath", "路径"],
      ["sourcePath", "来源"],
      ["targetPath", "目标"],
      ["query", "关键词"],
      ["q", "关键词"],
      ["keyword", "关键词"],
      ["bookIdOrTitle", "小说"],
      ["bookId", "小说"],
      ["projectIdOrTitle", "项目"],
      ["projectId", "项目"],
      ["chapterId", "章节"],
      ["chapterIndex", "章节"],
      ["taskId", "任务"],
      ["mode", "模式"],
      ["action", "动作"],
      ["prompt", "提示词"]
    ];
    const parts = [];

    for (const [key, label] of priorityEntries) {
      if (parts.length >= 2) {
        break;
      }

      const value = getCommandArgumentSummaryValue(argumentsObject[key], key === "prompt" ? 72 : 96);

      if (value) {
        parts.push(`${label}：${value}`);
      }
    }

    return parts.join(" · ");
  }

  function getCommandSelectedStepArgumentsText(step) {
    const detail = String(step?.detail ?? "");
    const argumentText = detail.split(" / 参数：")[1] ?? "";

    return argumentText
      .split(" / 预期：")[0]
      .split(" / 验证：")[0]
      .trim();
  }

  function parseCommandSelectedStepArguments(step) {
    const argumentText = getCommandSelectedStepArgumentsText(step);

    if (!argumentText) {
      return null;
    }

    try {
      const parsed = JSON.parse(argumentText);

      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function getCommandArtifactCallArgumentsText(call) {
    return stringifyCommandArtifactArguments(getCommandArtifactResolvedCallArguments(call));
  }

  function getCommandArtifactCallRepairedArgumentsText(call) {
    return stringifyCommandArtifactArguments(call?.repairedFromArguments);
  }

  function getCommandArtifactCallSecondary(call) {
    const secondaryParts = [];

    if (call?.recovered) {
      secondaryParts.push(`重试恢复 x${call.attemptCount}`);
    } else if (call?.attemptCount > 1) {
      secondaryParts.push(`尝试 x${call.attemptCount}`);
    }

    if (call?.repairedFromArguments) {
      secondaryParts.push(call.repairReason ? normalizeCommandArtifactInlineText(call.repairReason) : "参数修复");
    }

    if (call?.fallbackFromToolName) {
      secondaryParts.push(`fallback 来源：${call.fallbackFromServerName ?? call.serverName}/${call.fallbackFromToolName}`);
    }

    if (call?.isError) {
      secondaryParts.push("调用失败");
    }

    if (call?.failureKind) {
      const failureKindLabel =
        typeof formatFailureKind === "function" ? formatFailureKind(call.failureKind) : formatCommandFailureKind(call.failureKind);
      secondaryParts.push(failureKindLabel);
    }

    const failureReason = normalizeCommandArtifactInlineText(call?.failureReason);
    const resultText = normalizeCommandArtifactInlineText(call?.resultText);

    if (failureReason) {
      secondaryParts.push(failureReason);
    } else if (resultText) {
      secondaryParts.push(`完成：${truncateText(resultText, 180)}`);
    }

    return secondaryParts.join(" · ");
  }

  function normalizeCommandArtifactCallItem(call, index = 0) {
    if (!call || typeof call !== "object") {
      return null;
    }

    return {
      id: `${call.createdAt ?? "tool"}-${call.serverName ?? "server"}-${call.toolName ?? "tool"}-${call.round ?? index}`,
      kind: "tool",
      className: call.isError ? "is-mcp is-error" : "is-mcp",
      title: getCommandArtifactCallTitle(call),
      secondary: getCommandArtifactCallSecondary(call),
      createdAt: call.createdAt ?? "",
      call
    };
  }

  function truncateCommandProcessText(value, maxLength = MAX_COMMAND_PROCESS_DETAIL_LENGTH) {
    return truncateText(normalizeCommandArtifactInlineText(value), maxLength);
  }

  function truncateCommandProcessOutput(value, maxLength = MAX_COMMAND_PROCESS_OUTPUT_LENGTH) {
    const text = String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();

    if (!text) {
      return "";
    }

    const chars = Array.from(text);
    return chars.length > maxLength ? `${chars.slice(0, maxLength).join("")}\n...（已截断）` : text;
  }

  function getCommandProcessCallDetail(call) {
    const detailParts = [];
    const argumentText = truncateCommandProcessText(stringifyCommandArtifactArguments(getCommandArtifactResolvedCallArguments(call)), 180);
    const argumentSummary = getCommandToolArgumentSummary(getCommandArtifactResolvedCallArguments(call));

    if (argumentSummary) {
      detailParts.push(argumentSummary);
    } else if (argumentText) {
      detailParts.push(`参数：${argumentText}`);
    }

    if (call?.recovered) {
      detailParts.push(`重试恢复 x${call.attemptCount}`);
    } else if (call?.attemptCount > 1) {
      detailParts.push(`尝试 x${call.attemptCount}`);
    }

    if (call?.repairedFromArguments) {
      detailParts.push(call.repairReason ? truncateCommandProcessText(call.repairReason, 120) : "参数已修复");
    }

    if (call?.fallbackFromToolName) {
      detailParts.push(`fallback：${call.fallbackFromServerName ?? call.serverName}/${call.fallbackFromToolName}`);
    }

    if (call?.failureKind) {
      const failureKindLabel =
        typeof formatFailureKind === "function" ? formatFailureKind(call.failureKind) : formatCommandFailureKind(call.failureKind);
      detailParts.push(failureKindLabel);
    }

    if (call?.isError && call?.failureReason) {
      detailParts.push(truncateCommandProcessText(call.failureReason, 160));
    }

    return detailParts.join(" · ");
  }

  function isCommandPermissionProcessStep(step) {
    return [
      "workspace_permission_requested",
      "workspace_permission_granted",
      "workspace_permission_denied",
      "computer_use_permission_requested",
      "computer_use_permission_granted",
      "computer_use_permission_denied",
      "tool_permission_requested",
      "tool_permission_granted",
      "tool_permission_denied"
    ].includes(step?.type);
  }

  function getCommandPermissionDomainLabel(step) {
    if (String(step?.type ?? "").startsWith("computer_use_")) {
      return "桌面控制";
    }

    if (String(step?.type ?? "").startsWith("tool_permission_")) {
      return "工具授权";
    }

    return "外部路径";
  }

  function getCommandPermissionStatus(step) {
    if (String(step?.type ?? "").endsWith("_requested")) {
      return {
        priority: 1,
        label: `${getCommandPermissionDomainLabel(step)} · 待授权`,
        className: "is-waiting"
      };
    }

    if (String(step?.type ?? "").endsWith("_granted")) {
      return {
        priority: 2,
        label: `${getCommandPermissionDomainLabel(step)} · 已授权`,
        className: "is-done"
      };
    }

    if (String(step?.type ?? "").endsWith("_denied")) {
      return {
        priority: 3,
        label: `${getCommandPermissionDomainLabel(step)} · 已拒绝`,
        className: "is-error"
      };
    }

    return null;
  }

  function getCommandToolPermissionSteps(steps, toolIndex = 0) {
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
    const selectedStep = selectedToolSteps[toolIndex];

    if (!selectedStep) {
      return [];
    }

    const selectedStepIndex = steps.indexOf(selectedStep);
    const nextSelectedStep = selectedToolSteps[toolIndex + 1];
    const nextSelectedStepIndex = nextSelectedStep ? steps.indexOf(nextSelectedStep) : steps.length;

    return steps
      .slice(selectedStepIndex + 1, nextSelectedStepIndex)
      .filter(isCommandPermissionProcessStep);
  }

  function getCommandToolPermissionTags(steps, toolIndex = 0) {
    const latestByDomain = new Map();

    for (const step of getCommandToolPermissionSteps(steps, toolIndex)) {
      const status = getCommandPermissionStatus(step);

      if (!status) {
        continue;
      }

      const domain = getCommandPermissionDomainLabel(step);
      const detail = truncateCommandProcessText(step.detail, 120);
      latestByDomain.set(domain, {
        label: status.label,
        className: status.className,
        priority: status.priority,
        detail,
        createdAt: step.createdAt ?? ""
      });
    }

    return Array.from(latestByDomain.values()).sort((left, right) => right.priority - left.priority);
  }

  function getCommandToolPermissionTone(tags) {
    if (!Array.isArray(tags) || !tags.length) {
      return "";
    }

    if (tags.some((tag) => tag.className === "is-error")) {
      return "error";
    }

    if (tags.some((tag) => tag.className === "is-waiting")) {
      return "waiting";
    }

    if (tags.some((tag) => tag.className === "is-done")) {
      return "done";
    }

    return "";
  }

  function getCommandToolTerminalStep(steps, toolIndex = 0) {
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
    const selectedStep = selectedToolSteps[toolIndex];

    if (!selectedStep) {
      return null;
    }

    const selectedStepIndex = steps.indexOf(selectedStep);
    const nextSelectedStep = selectedToolSteps[toolIndex + 1];
    const nextSelectedStepIndex = nextSelectedStep ? steps.indexOf(nextSelectedStep) : steps.length;

    return (
      steps
        .slice(selectedStepIndex + 1, nextSelectedStepIndex)
        .reverse()
        .find((step) => step?.type === "mcp_tool_called" || step?.type === "mcp_tool_failed") ?? null
    );
  }

  function normalizeCommandResponseProcessCall(call, index = 0, options = {}) {
    if (!call || typeof call !== "object") {
      return null;
    }

    const output = truncateCommandProcessOutput(call.resultText);
    const selectedStep = options.selectedStep ?? null;
    const terminalStep = options.terminalStep ?? null;
    const technicalTag = getCommandToolProcessTag(call.serverName, call.toolName);
    const tags = [technicalTag, ...(options.tags ?? [])].filter(Boolean);

    return {
      id: selectedStep?.id ? `${selectedStep.id}_process_tool` : `process_call_${call.createdAt ?? "tool"}_${call.toolName ?? index}`,
      kind: "execute",
      sequenceMode: "tool",
      marker: `${index + 1}`,
      label: call.isError ? "执行失败" : "执行",
      className: call.isError ? "is-execute is-error" : "is-execute is-done",
      title: getCommandToolActionTitle(call.toolName, call.serverName),
      detail: getCommandProcessCallDetail(call),
      tags,
      output,
      outputLabel: call.isError ? "错误输出" : "中间输出",
      createdAt: terminalStep?.createdAt ?? call.createdAt ?? selectedStep?.createdAt ?? "",
      sortIndex: options.sortIndex >= 0 ? options.sortIndex : index
    };
  }

  function normalizeCommandResponsePendingTool(steps, calls) {
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");

    if (!selectedToolSteps.length || selectedToolSteps.length <= calls.length) {
      return null;
    }

    const selectedStep = selectedToolSteps[selectedToolSteps.length - 1];
    const selectedStepIndex = steps.indexOf(selectedStep);
    const serverStep = steps
      .slice(0, selectedStepIndex)
      .reverse()
      .find((step) => step?.type === "mcp_server_selected");
    const toolName = getCommandArtifactToolNameFromStep(selectedStep) || "工具";
    const serverName = getCommandArtifactServerNameFromStep(serverStep) || "工具服务";
    const argumentText = getCommandSelectedStepArgumentsText(selectedStep);
    const argumentSummary = getCommandToolArgumentSummary(parseCommandSelectedStepArguments(selectedStep));
    const technicalTag = getCommandToolProcessTag(serverName, toolName);
    const tags = [technicalTag, ...getCommandToolPermissionTags(steps, selectedToolSteps.length - 1)].filter(Boolean);
    const permissionTone = getCommandToolPermissionTone(tags);
    const hasDeniedPermission = permissionTone === "error";

    return {
      id: `${selectedStep?.id ?? selectedStep?.createdAt ?? "tool"}_process_tool`,
      kind: "execute",
      sequenceMode: "tool",
      marker: `${calls.length + 1}`,
      label: hasDeniedPermission ? "执行受阻" : "执行中",
      className: hasDeniedPermission ? "is-execute is-error" : "is-execute is-running",
      title: getCommandToolActionTitle(toolName, serverName),
      detail: argumentSummary || (argumentText ? `参数：${truncateCommandProcessText(argumentText, 180)}` : "参数已确定，正在等待工具返回。"),
      tags,
      output: hasDeniedPermission ? "授权被拒绝，Gordon 会尝试调整路线或停止当前工具调用。" : "工具正在运行，返回后会把中间输出接在这里。",
      outputLabel: hasDeniedPermission ? "授权状态" : "中间输出",
      createdAt: selectedStep?.createdAt ?? "",
      sortIndex: steps.indexOf(selectedStep)
    };
  }

  function normalizeCommandResponseProcessStep(step, index = 0, options = {}) {
    if (!step || typeof step !== "object") {
      return null;
    }

    const detail = truncateCommandProcessText(step.detail);
    const id = step.id ?? `process_step_${index}`;
    const createdAt = step.createdAt ?? "";

    if (step.type === "mcp_auto_planning") {
      return null;
    }

    if (step.type === "mcp_auto_stopped") {
      const hasFailure = /失败|停止|重复|最大/u.test(`${step.title ?? ""} ${step.detail ?? ""}`);

      if (!hasFailure && !options.hasToolCalls) {
        return null;
      }

      return {
        id,
        kind: "reflect",
        marker: hasFailure ? "!" : "判",
        label: hasFailure ? "复盘" : "继续判断",
        className: hasFailure ? "is-reflect is-error" : "is-reflect",
        title: step.title ?? "工具规划完成",
        detail,
        createdAt
      };
    }

    if (step.type === "mcp_args_repaired") {
      return {
        id,
        kind: "adjust",
        marker: "调",
        label: "调整",
        className: "is-adjust",
        title: "修正工具参数",
        detail,
        createdAt
      };
    }

    if (step.type === "mcp_retrying") {
      return {
        id,
        kind: "adjust",
        marker: "重",
        label: "重试",
        className: "is-adjust is-running",
        title: "工具调用重试",
        detail,
        createdAt
      };
    }

    if (step.type === "mcp_fallback_planned" || step.type === "mcp_fallback_selected") {
      return {
        id,
        kind: "reflect",
        marker: "换",
        label: "恢复策略",
        className: "is-reflect",
        title: step.title ?? "切换备用工具",
        detail,
        createdAt
      };
    }

    if (isCommandPermissionProcessStep(step)) {
      return null;
    }

    if (step.type === "skill_handler_started") {
      return {
        id,
        kind: "execute",
        marker: "执",
        label: "执行 Skill",
        className: "is-execute is-running",
        title: step.title ?? "执行 Skill Handler",
        detail,
        createdAt
      };
    }

    if (step.type === "skill_handler_completed") {
      return {
        id,
        kind: "execute",
        marker: "执",
        label: "执行 Skill",
        className: "is-execute is-done",
        title: "Skill Handler 执行完成",
        detail,
        createdAt
      };
    }

    if (step.type === "skill_handler_failed") {
      return {
        id,
        kind: "execute",
        marker: "!",
        label: "执行 Skill",
        className: "is-execute is-error",
        title: "Skill Handler 执行失败",
        detail,
        createdAt
      };
    }

    return null;
  }

  function getCommandLiveActivityLabel(step) {
    const type = step?.type;

    if (type === "run_received" || type === "context_prepared" || type === "runtime_initializing") {
      return "启动";
    }

    if (type === "runtime_config_loaded") {
      return "配置";
    }

    if (type === "agent_selected" || type === "model_selected" || type === "skill_selected" || type === "mcp_authorized") {
      return type === "mcp_authorized" ? "工具上下文" : "执行上下文";
    }

    if (type === "tool_discovery_started") {
      return "准备工具";
    }

    if (type === "tool_discovery_completed") {
      return "准备工具";
    }

    if (type === "mcp_auto_planning") {
      return "判断动作";
    }

    if (type === "mcp_auto_stopped") {
      return "判断结束";
    }

    if (type === "model_response_started" || type === "model_invoked" || type === "completed") {
      return "整理回复";
    }

    return "处理中";
  }

  function getCommandLiveActivityTone(step) {
    if (step?.type === "completed") {
      return "done";
    }

    if (step?.type === "tool_discovery_completed" || step?.type === "runtime_config_loaded") {
      return "steady";
    }

    if (step?.type === "mcp_auto_stopped") {
      const text = `${step?.title ?? ""} ${step?.detail ?? ""}`;

      if (/超时|失败|停止|重复|最大/u.test(text)) {
        return "error";
      }

      return "steady";
    }

    return "running";
  }

  function getCommandLiveToolActivityItem(artifact, liveProgress) {
    const steps = Array.isArray(artifact?.steps) ? artifact.steps : [];
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
    const hasPendingTool = selectedToolSteps.length > calls.length;
    const latestCall = calls[calls.length - 1];

    if (!hasPendingTool && !latestCall) {
      return null;
    }

    if (hasPendingTool) {
      const selectedStep = selectedToolSteps[selectedToolSteps.length - 1];
      const selectedStepIndex = steps.indexOf(selectedStep);
      const serverStep = steps
        .slice(0, selectedStepIndex)
        .reverse()
        .find((step) => step?.type === "mcp_server_selected");
      const toolName = getCommandArtifactToolNameFromStep(selectedStep) || "工具";
      const serverName = getCommandArtifactServerNameFromStep(serverStep) || "工具服务";
      const argumentSummary = getCommandToolArgumentSummary(parseCommandSelectedStepArguments(selectedStep));

      return {
        id: selectedStep?.id ?? `live_tool_${liveProgress?.progressEventId ?? "current"}`,
        label: "工具执行",
        title: getCommandToolActionTitle(toolName, serverName),
        detail: argumentSummary || "正在等待工具返回结果",
        createdAt: selectedStep?.createdAt ?? liveProgress?.updatedAt ?? "",
        tone: "running",
        className: "is-running"
      };
    }

    return {
      id: `live_tool_${latestCall.createdAt ?? liveProgress?.progressEventId ?? "current"}`,
      label: latestCall.isError ? "工具失败" : "工具完成",
      title: getCommandToolActionTitle(latestCall.toolName, latestCall.serverName),
      detail: latestCall.isError ? truncateCommandProcessText(latestCall.failureReason || latestCall.resultText, 140) : "正在基于工具结果判断下一步",
      createdAt: latestCall.createdAt ?? liveProgress?.updatedAt ?? "",
      tone: latestCall.isError ? "error" : "steady",
      className: latestCall.isError ? "is-error" : "is-steady"
    };
  }

  function getCommandLiveActivityItem(liveProgress) {
    const artifact = liveProgress?.artifact;
    const steps = Array.isArray(artifact?.steps) ? artifact.steps : [];
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const toolActivityItem = getCommandLiveToolActivityItem(artifact, liveProgress);
    const latestActivityStep = [...steps]
      .reverse()
      .find((step) => COMMAND_LIVE_ACTIVITY_STEP_TYPES.has(step?.type));
    const statusText = getCommandLiveStatusText(liveProgress);

    if (
      toolActivityItem &&
      !["model_response_started", "model_invoked", "completed"].includes(latestActivityStep?.type)
    ) {
      return toolActivityItem;
    }

    if (!latestActivityStep && !statusText) {
      return null;
    }

    let title = normalizeCommandArtifactInlineText(latestActivityStep?.title) || statusText || "Gordon 正在处理";
    let detail = normalizeCommandArtifactInlineText(latestActivityStep?.detail);

    if (latestActivityStep?.type === "tool_discovery_started") {
      title = "正在准备可用工具";
      detail = "Gordon 正在为本轮任务筛选可执行能力";
    } else if (latestActivityStep?.type === "tool_discovery_completed") {
      title = "已准备可用工具";
      detail = "接下来会选择最合适的动作执行";
    } else if (latestActivityStep?.type === "mcp_auto_planning") {
      const isDirectGenerationStep = /已识别为.*(?:图片|视频|音乐|媒体).*生成任务/u.test(
        `${latestActivityStep?.title ?? ""} ${latestActivityStep?.detail ?? ""}`
      );
      title = isDirectGenerationStep ? normalizeCommandArtifactInlineText(latestActivityStep?.title) : "正在判断下一步动作";
      detail = isDirectGenerationStep ? "Gordon 已匹配生成工具，正在准备提交任务" : "Gordon 正在判断是否需要调用工具";
    } else if (latestActivityStep?.type === "mcp_auto_stopped") {
      const text = `${latestActivityStep?.title ?? ""} ${latestActivityStep?.detail ?? ""}`;
      const isTimeout = /超时/u.test(text);
      title = isTimeout ? "前置判断已超时" : normalizeCommandArtifactInlineText(latestActivityStep?.title) || "工具判断已结束";
      detail = isTimeout ? "Gordon 会先基于当前上下文整理回复，不再继续等待工具规划" : detail;
    } else if (latestActivityStep?.type === "mcp_authorized") {
      title = "已载入工具能力";
      detail = "Gordon 会按任务需要选择工具";
    } else if (latestActivityStep?.type === "model_response_started" || latestActivityStep?.type === "model_invoked") {
      title = "正在整理回复";
      detail = toolActivityItem?.title ? `已完成 ${toolActivityItem.title}` : detail;
    }

    const createdAt = latestActivityStep?.createdAt ?? liveProgress?.updatedAt ?? "";
    const label = getCommandLiveActivityLabel(latestActivityStep);
    const tone = getCommandLiveActivityTone(latestActivityStep);

    return {
      id: latestActivityStep?.id ?? `live_activity_${liveProgress?.progressEventId ?? "current"}`,
      label,
      title,
      detail,
      createdAt,
      tone,
      className: `is-${tone}`
    };
  }

  function hasCommandProcessRunningClass(item) {
    return String(item?.className ?? "")
      .split(/\s+/u)
      .filter(Boolean)
      .includes("is-running");
  }

  function removeCommandProcessRunningClass(className) {
    return String(className ?? "")
      .split(/\s+/u)
      .filter((token) => token && token !== "is-running")
      .join(" ");
  }

  function normalizeCommandProcessRunningState(items) {
    const processItems = Array.isArray(items) ? items : [];
    const latestIndex = processItems.length - 1;

    return processItems.map((item, index) => {
      if (index === latestIndex || !hasCommandProcessRunningClass(item)) {
        return item;
      }

      return {
        ...item,
        className: removeCommandProcessRunningClass(item.className)
      };
    });
  }

  function normalizeCommandProcessVisibleSequence(items) {
    let toolStepIndex = 0;

    return items.map((item) => {
      if (item?.sequenceMode !== "tool") {
        return item;
      }

      toolStepIndex += 1;

      return {
        ...item,
        marker: `${toolStepIndex}`,
        label: `${item.label} · 步骤 ${toolStepIndex}`
      };
    });
  }

  function isCommandOperationalProcessStep(step) {
    if (step?.type === "mcp_auto_stopped") {
      return /超时|失败|停止|重复|最大/u.test(`${step.title ?? ""} ${step.detail ?? ""}`);
    }

    return [
      "run_received",
      "context_prepared",
      "runtime_initializing",
      "runtime_config_loaded",
      "agent_selected",
      "model_selected",
      "skill_selected",
      "mcp_authorized",
      "mcp_args_repaired",
      "mcp_retrying",
      "mcp_fallback_planned",
      "mcp_fallback_selected",
      "workspace_permission_requested",
      "workspace_permission_granted",
      "workspace_permission_denied",
      "computer_use_permission_requested",
      "computer_use_permission_granted",
      "computer_use_permission_denied",
      "tool_permission_requested",
      "tool_permission_granted",
      "tool_permission_denied",
      "skill_handler_started",
      "skill_handler_completed",
      "skill_handler_failed"
    ].includes(step?.type);
  }

  function getCommandResponseProcessItems(artifact) {
    if (!artifact || typeof artifact !== "object") {
      return [];
    }

    const allSteps = Array.isArray(artifact.steps) ? artifact.steps : [];
    const steps = allSteps.filter((step) => !COMMAND_HISTORY_HIDDEN_STEP_TYPES.has(step?.type));
    const calls = Array.isArray(artifact.mcpCalls) ? artifact.mcpCalls : [];

    if (!steps.length && !calls.length && !artifact.stopReason) {
      return [];
    }

    const hasToolCalls = calls.length > 0;
    const hasOperationalSteps = steps.some(isCommandOperationalProcessStep);
    const showFinalStage = hasToolCalls || hasOperationalSteps || Boolean(artifact.stopReason);
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
    const timelineItems = [
      ...steps
        .map((step, index) => {
          const normalizedStep = normalizeCommandResponseProcessStep(step, index, { hasToolCalls, showFinalStage });

          return normalizedStep
            ? {
                ...normalizedStep,
                sortIndex: index
              }
            : null;
        })
        .filter(Boolean),
      ...calls
        .map((call, index) =>
          normalizeCommandResponseProcessCall(call, index, {
            selectedStep: selectedToolSteps[index] ?? null,
            terminalStep: getCommandToolTerminalStep(steps, index),
            tags: getCommandToolPermissionTags(steps, index),
            sortIndex: steps.indexOf(getCommandToolTerminalStep(steps, index) ?? selectedToolSteps[index] ?? null)
          })
        )
        .filter(Boolean)
    ];
    const pendingTool = normalizeCommandResponsePendingTool(steps, calls);

    if (pendingTool) {
      timelineItems.push(pendingTool);
    }

    if (artifact.stopReason && !steps.some((step) => step?.type === "mcp_auto_stopped")) {
      timelineItems.push({
        id: `process_stop_${artifact.createdAt ?? "now"}`,
        kind: "reflect",
        marker: "!",
        label: "复盘",
        className: "is-reflect is-error",
        title: "运行停止",
        detail: truncateCommandProcessText(artifact.stopReason),
        createdAt: artifact.createdAt ?? "",
        sortIndex: steps.length + calls.length + 1
      });
    }

    const visibleItems = timelineItems.sort((left, right) => {
      const leftSortIndex = left.sortIndex;
      const rightSortIndex = right.sortIndex;

      if (leftSortIndex >= 0 && rightSortIndex >= 0 && leftSortIndex !== rightSortIndex) {
        return leftSortIndex - rightSortIndex;
      }

      return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });

    if (!visibleItems.length) {
      return [];
    }

    return normalizeCommandProcessVisibleSequence(normalizeCommandProcessRunningState(visibleItems));
  }

  function getCommandArtifactToolNameFromStep(step) {
    return String(step?.detail ?? "")
      .split(" / 参数：")[0]
      .trim();
  }

  function getCommandArtifactServerNameFromStep(step) {
    return String(step?.detail ?? "")
      .split(" / ")[0]
      .trim();
  }

  function normalizeCommandArtifactPendingToolItem(steps, calls) {
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");

    if (!selectedToolSteps.length || selectedToolSteps.length <= calls.length) {
      return null;
    }

    const selectedStep = selectedToolSteps[selectedToolSteps.length - 1];
    const selectedStepIndex = steps.indexOf(selectedStep);
    const serverStep = steps
      .slice(0, selectedStepIndex)
      .reverse()
      .find((step) => step?.type === "mcp_server_selected");
    const toolName = getCommandArtifactToolNameFromStep(selectedStep) || "工具";
    const serverName = getCommandArtifactServerNameFromStep(serverStep);
    const title = serverName ? `使用工具：${serverName} / ${toolName}` : `使用工具：${toolName}`;

    return {
      id: `${selectedStep?.id ?? selectedStep?.createdAt ?? "tool"}_pending`,
      kind: "tool",
      className: "is-mcp",
      title,
      secondary: "执行中",
      createdAt: selectedStep?.createdAt ?? ""
    };
  }

  function getCommandArtifactExecutionItems(artifact) {
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const steps = Array.isArray(artifact?.steps) ? artifact.steps : [];
    const pendingToolItem = normalizeCommandArtifactPendingToolItem(steps, calls);
    const items = [
      ...steps.map((step, index) => normalizeCommandArtifactAuxiliaryStep(step, index)).filter(Boolean),
      ...(pendingToolItem ? [pendingToolItem] : []),
      ...calls.map((call, index) => normalizeCommandArtifactCallItem(call, index)).filter(Boolean)
    ].sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));

    if (items.length) {
      return items;
    }

    const hasCompletedReply = steps.some((step) => step?.type === "model_invoked" || step?.type === "completed");

    if (!artifact?.stopReason && !hasCompletedReply) {
      return [];
    }

    return [
      {
        id: `direct_${artifact?.createdAt ?? "now"}`,
        kind: "direct",
        className: "",
        title: artifact?.stopReason ? "运行停止" : "生成回复",
        secondary: normalizeCommandArtifactInlineText(artifact?.stopReason),
        createdAt: artifact?.createdAt ?? ""
      }
    ];
  }

  function getCommandLiveStatusText(liveProgress) {
    const streamedText = String(liveProgress?.text ?? "").trim();

    if (streamedText) {
      return streamedText;
    }

    const artifact = liveProgress?.artifact;
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const lastCall = calls[calls.length - 1];

    if (lastCall?.isError) {
      return `工具调用失败：${lastCall.serverName ?? "工具服务"} / ${lastCall.toolName ?? "工具"}`;
    }

    if (lastCall) {
      return `已完成工具调用：${lastCall.serverName ?? "工具服务"} / ${lastCall.toolName ?? "工具"}`;
    }

    const latestStep = Array.isArray(artifact?.steps) ? artifact.steps[artifact.steps.length - 1] : null;

    if (latestStep?.type === "workspace_permission_requested") {
      return "正在等待外部路径访问授权";
    }

    if (latestStep?.type === "computer_use_permission_requested") {
      return "正在等待桌面控制授权";
    }

    if (latestStep?.type === "tool_permission_requested") {
      return "正在等待高风险工具授权";
    }

    const statusText = normalizeCommandArtifactInlineText(liveProgress?.statusText);

    if (/最终回复|整理输出|模型调用完成|运行完成/u.test(statusText)) {
      return "正在整理回复";
    }

    return "正在处理请求";
  }

  return {
    activeCommandMessages,
    activeCommandSession,
    backToCommandList,
    beginNewCommandSession,
    commandAuthorizedServers,
    commandChatTitle,
    commandRunnableSkills,
    commandSelectedAgent,
    commandSettingsSummary,
    commandToolOptions,
    focusCommandInput,
    getCommandArtifactProducts,
    getCommandLiveActivityItem,
    getCommandResponseProcessItems,
    getCommandLiveStatusText,
    getCommandQueueItemSummary,
    getCommandWorkshopModeLabel,
    getCommandWorkshopToolModeLabel,
    handleAgentRunProgress,
    handleCommandAgentChange,
    handleCommandAttachmentSelect,
    handleCommandInputCompositionEnd,
    handleCommandInputCompositionStart,
    handleCommandInputEnterKeydown,
    handleCommandLoadMcpTools,
    handleCommandMessageCopy,
    handleCommandMessageExport,
    handleCommandQueueItemDelete,
    handleCommandQueueItemEdit,
    handleCommandQueueItemGuide,
    handleCommandRunCancel,
    handleCommandServerChange,
    handleCommandSessionDelete,
    handleCommandSubmit,
    normalizeCommandWorkshopConfig,
    normalizeCommandWorkshopSession,
    normalizeCommandWorkshopSessions,
    openCommandSession,
    openCommandWorkspace,
    hasCommandDraftContent,
    pendingCommandGuidanceMessages,
    removeCommandAttachment,
    scrollCommandToBottom,
    upsertCommandWorkshopSessionState
  };
}
