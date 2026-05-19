import { computed } from "vue";

import {
  BUILTIN_APPLICATION_TOOLS_MCP_ID,
  BUILTIN_GORDON_AGENT_ID,
  buildCommandWorkshopArtifact,
  buildCommandWorkshopTitle,
  sortCommandWorkshopSessions,
  summarizeCommandWorkshopContent,
  truncateText
} from "../../lib/presenter.js";
import {
  buildCommandApplicationContext,
  buildCommandUserInputForAgent,
  buildCommandWorkshopLiveArtifact,
  buildConversationMessagesForAgentRun
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
  if (failureKind === "schema_mismatch") {
    return "Schema 不匹配";
  }

  if (failureKind === "tool_unavailable") {
    return "工具不可用";
  }

  if (failureKind === "tool_execution") {
    return "工具执行失败";
  }

  return "未知失败";
}

const MAX_COMMAND_ARGUMENT_STRING_LENGTH = 320;
const MAX_COMMAND_ARGUMENT_ARRAY_ITEMS = 12;
const MAX_COMMAND_ARGUMENT_OBJECT_KEYS = 24;
const MAX_COMMAND_PROCESS_OUTPUT_LENGTH = 900;
const MAX_COMMAND_PROCESS_DETAIL_LENGTH = 260;
const COMMAND_VISIBLE_AUXILIARY_STEP_TYPES = new Set([
  "skill_handler_completed",
  "skill_handler_failed",
  "workspace_permission_granted",
  "workspace_permission_denied",
  "computer_use_permission_granted",
  "computer_use_permission_denied"
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

export function createCommandWorkshopActions({
  activeFeature,
  commandWorkshopViewRef,
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
    ui.command.queuedInput = "";
    ui.command.queuedAttachments = [];
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
    ui.command.queuedInput = "";
    ui.command.queuedAttachments = [];
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

    if (!commandSelectedAgent.value || ui.command.isRunning) {
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
      return;
    }

    ui.command.cancelRequested = true;
    setStatus("正在停止命令工坊本轮运行...", "warning");

    try {
      const cancelled = await desktopApi.cancelAgentRun(progressEventId);

      if (!cancelled) {
        setStatus("当前运行已进入收尾阶段，正在等待结束。", "warning");
      }
    } catch (error) {
      console.error("Failed to cancel command workshop run", error);
      setStatus(`停止失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function queueCommandGuidance(input, attachments = []) {
    ui.command.queuedInput = String(input ?? "").trim();
    ui.command.queuedAttachments = toPlainIpcData(attachments ?? [], []);
    ui.command.draftInput = "";
    ui.command.attachments = [];
  }

  function runQueuedCommandGuidanceIfNeeded() {
    const queuedInput = String(ui.command.queuedInput ?? "").trim();
    const queuedAttachments = toPlainIpcData(ui.command.queuedAttachments ?? [], []);

    if (!queuedInput && !queuedAttachments.length) {
      return false;
    }

    ui.command.queuedInput = "";
    ui.command.queuedAttachments = [];
    ui.command.draftInput = queuedInput;
    ui.command.attachments = queuedAttachments;
    runOnNextTick(() => {
      void handleCommandSubmit();
    });
    return true;
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
      artifact: buildCommandWorkshopLiveArtifact(payload)
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

  async function handleCommandSubmit() {
    if (!desktopApi) {
      setStatus("桌面桥接未就绪，暂无法执行命令工坊会话。", "danger");
      return;
    }

    const agent = getAgentById(ui.command.form.agentProfileId);
    const userInput = ui.command.draftInput.trim();
    const attachments = toPlainIpcData(ui.command.attachments ?? [], []);

    if (ui.command.isRunning) {
      if (!userInput && !attachments.length) {
        setStatus("当前任务仍在运行；输入新的引导后可中断并接着执行。", "warning");
        return;
      }

      queueCommandGuidance(userInput, attachments);
      setStatus("已收到新的引导，正在停止当前运行并准备接着执行。", "warning");
      await handleCommandRunCancel();
      return;
    }

    const applicationContext = buildCommandApplicationContext(ui, workbench);
    const agentUserInput = buildCommandUserInputForAgent(userInput, attachments, applicationContext);
    let mcpArguments = undefined;

    if (!agent) {
      setStatus("请先选择一个可用 Agent。", "warning");
      return;
    }

    if (!userInput && !attachments.length) {
      setStatus("先输入一条任务，或上传一个附件，再让 Gordon 开始工作。", "warning");
      return;
    }

    if (ui.command.form.mcpToolName && !ui.command.form.mcpServerId) {
      setStatus("如果要指定工具，请先选择工具服务。", "warning");
      return;
    }

    if (ui.command.form.mcpServerId && !ui.command.form.mcpToolName && !ui.command.form.autoSelectMcp) {
      setStatus("已选择工具服务，请再选择具体工具，或开启自动工具。", "warning");
      return;
    }

    if (ui.command.form.mcpServerId && ui.command.form.mcpToolName) {
      try {
        mcpArguments = JSON.parse(ui.command.form.mcpArgumentsText);
      } catch (error) {
        setStatus(`工具参数 JSON 解析失败：${getErrorMessage(error)}`, "danger");
        return;
      }

      if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
        setStatus("工具参数必须是一个 JSON 对象。", "danger");
        return;
      }
    }

    const activeSession = toPlainIpcData(activeCommandSession.value, null);
    const sessionId = activeSession?.id ?? `command_session_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const progressEventId = `command_progress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseMessages = toPlainIpcData(activeSession?.messages ?? [], []);
    const userMessage = {
      id: `command_message_${Date.now()}`,
      role: "user",
      content: userInput || "请阅读并处理我上传的附件。",
      createdAt: startedAt,
      attachments
    };
    const titleSource = userInput || attachments.map((attachment) => attachment.name).join("、");
    const pendingSession = {
      id: sessionId,
      title: activeSession?.title || buildCommandWorkshopTitle(titleSource),
      summary: summarizeCommandWorkshopContent(titleSource),
      agentProfileId: ui.command.form.agentProfileId,
      skillId: ui.command.form.skillId || null,
      autoSelectMcp: ui.command.form.autoSelectMcp,
      mcpServerId: ui.command.form.mcpServerId || null,
      mcpToolName: ui.command.form.mcpToolName || null,
      mcpArgumentsText: ui.command.form.mcpArgumentsText,
      messages: [...baseMessages, userMessage],
      createdAt: activeSession?.createdAt ?? startedAt,
      updatedAt: startedAt
    };

    upsertCommandWorkshopSessionState(pendingSession);
    ui.command.isRunning = true;
    ui.command.cancelRequested = false;
    ui.command.isInputComposing = false;
    ui.command.activeProgressEventId = progressEventId;
    ui.command.liveProgress = {
      progressEventId,
      phase: "running",
      statusText: `命令工坊正在运行 Agent「${agent.name}」...`,
      text: "",
      updatedAt: startedAt,
      artifact: buildCommandWorkshopLiveArtifact({
        profileLabel: "",
        model: "",
        skillName: ui.command.form.skillId ? getSkillById(ui.command.form.skillId)?.name ?? null : null,
        autoSelectedMcp: false,
        mcpServerName: ui.command.form.mcpServerId ? getMcpServerById(ui.command.form.mcpServerId)?.name ?? null : null,
        mcpToolName: ui.command.form.mcpToolName || null,
        mcpResultText: "",
        mcpCalls: [],
        stopReason: "",
        steps: [],
        createdAt: startedAt
      })
    };
    ui.command.view = "chat";
    ui.command.draftInput = "";
    ui.command.attachments = [];
    scrollCommandToBottom();

    try {
      setStatus(`命令工坊正在运行 Agent「${agent.name}」...`, "neutral");
      const runRequest = toPlainIpcData({
        agentProfileId: agent.id,
        userInput: agentUserInput,
        conversationMessages: buildConversationMessagesForAgentRun(baseMessages),
        progressEventId,
        ...(ui.command.form.skillId ? { skillId: ui.command.form.skillId } : {}),
        ...(ui.command.form.autoSelectMcp ? { autoSelectMcp: true } : {}),
        ...(ui.command.form.mcpServerId ? { mcpServerId: ui.command.form.mcpServerId } : {}),
        ...(ui.command.form.mcpServerId && ui.command.form.mcpToolName
          ? {
              mcpToolName: ui.command.form.mcpToolName,
              mcpArguments
            }
          : {})
      });
      const result = await desktopApi.runAgent(runRequest);

      const assistantMessage = {
        id: `command_message_${Date.now()}_assistant`,
        role: "assistant",
        content: result.text,
        state: "completed",
        createdAt: result.createdAt,
        artifact: buildCommandWorkshopArtifact(result)
      };
      const completedSession = {
        ...pendingSession,
        summary: summarizeCommandWorkshopContent(result.text),
        messages: [...pendingSession.messages, assistantMessage],
        updatedAt: result.updatedAt
      };
      const sessions = await desktopApi.upsertCommandWorkshopSession(toPlainIpcData(completedSession));

      workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
      ui.command.activeSessionId = completedSession.id;
      workbench.agentRunLogs = [result, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
      if (
        typeof refreshWorkbenchSnapshot === "function" &&
        result.mcpCalls?.some(
          (call) =>
            call?.serverId === BUILTIN_APPLICATION_TOOLS_MCP_ID &&
            call?.structuredContent?.applied === true &&
            call?.isError !== true
        )
      ) {
        await refreshWorkbenchSnapshot();
      }
      ui.command.isRunning = false;
      ui.command.cancelRequested = false;
      ui.command.activeProgressEventId = null;
      ui.command.liveProgress = null;
      setStatus(`命令工坊已完成本轮响应（${result.profileLabel}）。`, "success");
      if (runQueuedCommandGuidanceIfNeeded()) {
        setStatus("正在按新的引导继续执行。", "neutral");
      }
      scrollCommandToBottom();
    } catch (error) {
      console.error("Failed to run command workshop session", error);
      const failedAt = new Date().toISOString();
      const wasCancelled = ui.command.cancelRequested || isAbortError(error);
      const streamedText = String(ui.command.liveProgress?.text ?? "").trim();
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
      ui.command.liveProgress = null;
      setStatus(wasCancelled ? "命令工坊已停止，本轮部分输出已保留。" : `命令工坊运行失败：${getErrorMessage(error)}`, wasCancelled ? "warning" : "danger");
      if (runQueuedCommandGuidanceIfNeeded()) {
        setStatus("正在按新的引导继续执行。", "neutral");
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

    return config?.autoSelectMcp ? "自动工具" : "纯对话";
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

  function getCommandArtifactInlineText(value) {
    return normalizeCommandArtifactInlineText(value);
  }

  function normalizeCommandArtifactProduct(artifact, index = 0) {
    if (!artifact || typeof artifact !== "object") {
      return null;
    }

    const kind = String(artifact.kind ?? "").trim();
    const src = String(artifact.dataUrl || artifact.url || "").trim();

    if (kind !== "image" || !src) {
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
      title: String(artifact.title ?? "").trim() || `生成图片 ${index + 1}`,
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

  function getCommandStepRound(step) {
    const source = `${step?.title ?? ""} ${step?.detail ?? ""}`;
    const match = source.match(/第\s*(\d+)\s*轮/u);
    return match?.[1] ?? "";
  }

  function isCommandPlanningResultStep(step) {
    return step?.type === "mcp_auto_planning" && /结果/u.test(String(step?.title ?? ""));
  }

  function isCommandPlanningStartStep(step) {
    return step?.type === "mcp_auto_planning" && !isCommandPlanningResultStep(step);
  }

  function getCommandProcessCallDetail(call) {
    const detailParts = [];
    const argumentText = truncateCommandProcessText(stringifyCommandArtifactArguments(getCommandArtifactResolvedCallArguments(call)), 180);

    if (argumentText) {
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

  function normalizeCommandResponseProcessCall(call, index = 0) {
    if (!call || typeof call !== "object") {
      return null;
    }

    const roundText = call.round ? `Plan ${call.round}` : `Plan ${index + 1}`;
    const output = truncateCommandProcessOutput(call.resultText);

    return {
      id: `process_call_${call.createdAt ?? "tool"}_${call.toolName ?? index}`,
      kind: "execute",
      marker: call.isError ? "!" : "执",
      label: call.isError ? `执行失败 · ${roundText}` : `执行 · ${roundText}`,
      className: call.isError ? "is-execute is-error" : "is-execute is-done",
      title: `${call.serverName ?? "工具服务"} / ${call.toolName ?? "工具"}`,
      detail: getCommandProcessCallDetail(call),
      output,
      outputLabel: call.isError ? "错误输出" : "中间输出",
      createdAt: call.createdAt ?? ""
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
    const round = getCommandStepRound(selectedStep);
    const toolName = getCommandArtifactToolNameFromStep(selectedStep) || "工具";
    const serverName = getCommandArtifactServerNameFromStep(serverStep) || "工具服务";
    const argumentText = String(selectedStep?.detail ?? "").split(" / 参数：")[1] ?? "";

    return {
      id: `${selectedStep?.id ?? selectedStep?.createdAt ?? "tool"}_process_pending`,
      kind: "execute",
      marker: "执",
      label: `执行中 · Plan ${round || calls.length + 1}`,
      className: "is-execute is-running",
      title: `${serverName} / ${toolName}`,
      detail: argumentText ? `参数：${truncateCommandProcessText(argumentText, 180)}` : "参数已确定，正在等待工具返回。",
      output: "工具正在运行，返回后会把中间输出接在这里。",
      outputLabel: "中间输出",
      createdAt: selectedStep?.createdAt ?? ""
    };
  }

  function normalizeCommandResponseProcessStep(step, index = 0, planningResultRounds = new Set()) {
    if (!step || typeof step !== "object") {
      return null;
    }

    const detail = truncateCommandProcessText(step.detail);
    const round = getCommandStepRound(step);
    const id = step.id ?? `process_step_${index}`;
    const createdAt = step.createdAt ?? "";

    if (isCommandPlanningResultStep(step)) {
      return {
        id,
        kind: "thought",
        marker: "思",
        label: round ? `思考 · 第 ${round} 轮` : "思考",
        className: "is-thought",
        title: round ? `我判断第 ${round} 轮下一步` : "我判断下一步",
        detail,
        createdAt
      };
    }

    if (isCommandPlanningStartStep(step)) {
      if (round && planningResultRounds.has(round)) {
        return null;
      }

      return {
        id,
        kind: "thought",
        marker: "思",
        label: round ? `思考中 · 第 ${round} 轮` : "思考中",
        className: "is-thought is-running",
        title: "正在选择下一步动作",
        detail,
        createdAt
      };
    }

    if (step.type === "mcp_auto_stopped") {
      const hasFailure = /失败|停止|重复|最大/u.test(`${step.title ?? ""} ${step.detail ?? ""}`);

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

    if (step.type === "workspace_permission_requested" || step.type === "computer_use_permission_requested") {
      return {
        id,
        kind: "permission",
        marker: "权",
        label: "等待授权",
        className: "is-permission is-running",
        title: step.title ?? "请求授权",
        detail,
        createdAt
      };
    }

    if (step.type === "workspace_permission_granted" || step.type === "computer_use_permission_granted") {
      return {
        id,
        kind: "permission",
        marker: "权",
        label: "授权完成",
        className: "is-permission is-done",
        title: step.title ?? "授权完成",
        detail,
        createdAt
      };
    }

    if (step.type === "workspace_permission_denied" || step.type === "computer_use_permission_denied") {
      return {
        id,
        kind: "permission",
        marker: "!",
        label: "授权拒绝",
        className: "is-permission is-error",
        title: step.title ?? "授权被拒绝",
        detail,
        createdAt
      };
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

    if (step.type === "model_invoked") {
      return {
        id,
        kind: "final",
        marker: "答",
        label: "整理",
        className: "is-final is-running",
        title: "整理最终答复",
        detail: detail || "工具输出已经汇总，正在生成最终回复。",
        createdAt
      };
    }

    if (step.type === "completed") {
      return {
        id,
        kind: "final",
        marker: "成",
        label: "完成",
        className: "is-final is-done",
        title: "本轮处理完成",
        detail,
        createdAt
      };
    }

    return null;
  }

  function getCommandResponseThoughtDetail(artifact) {
    const steps = Array.isArray(artifact?.steps) ? artifact.steps : [];
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const firstPlanResult = steps.find((step) => isCommandPlanningResultStep(step) && normalizeCommandArtifactInlineText(step.detail));
    const stopStep = steps.find((step) => step?.type === "mcp_auto_stopped" && normalizeCommandArtifactInlineText(step.detail));

    if (calls.length) {
      return firstPlanResult
        ? `我先判断这轮需要动用工具：${truncateCommandProcessText(firstPlanResult.detail, 180)}`
        : "我先把需求拆成可执行动作，再调用工具把结果落到本地或当前应用里。";
    }

    if (stopStep) {
      return `我先判断是否需要工具：${truncateCommandProcessText(stopStep.detail, 180)}`;
    }

    if (steps.some((step) => step?.type === "mcp_authorized")) {
      return "我先确认可用工具范围，再判断这轮是直接回复还是进入工具执行。";
    }

    return "我先理解你的问题和当前上下文，再把可执行结果整理给你。";
  }

  function getCommandResponsePlanItems(artifact) {
    const steps = Array.isArray(artifact?.steps) ? artifact.steps : [];
    const calls = Array.isArray(artifact?.mcpCalls) ? artifact.mcpCalls : [];
    const pendingTool = normalizeCommandResponsePendingTool(steps, calls);
    const planItems = [];

    if (artifact?.skillName) {
      planItems.push(`加载 Skill：${artifact.skillName}`);
    }

    const toolItems = [
      ...calls.map((call, index) => {
        const roundText = call.round ? `Plan ${call.round}` : `Plan ${index + 1}`;
        return `${roundText}：调用 ${call.serverName ?? "工具服务"} / ${call.toolName ?? "工具"}`;
      }),
      ...(pendingTool ? [`${pendingTool.label.replace("执行中 · ", "")}：调用 ${pendingTool.title}`] : [])
    ];

    if (toolItems.length) {
      planItems.push(...toolItems);
      planItems.push("根据中间输出判断是否继续调用工具");
      planItems.push("整理最终答复");
    } else {
      const stoppedStep = steps.find((step) => step?.type === "mcp_auto_stopped");

      if (stoppedStep) {
        planItems.push("确认无需继续调用工具");
      } else {
        planItems.push("理解问题与当前上下文");
        planItems.push("按需判断是否调用工具");
      }

      planItems.push("整理回复");
    }

    return Array.from(new Set(planItems)).slice(0, 8);
  }

  function getCommandResponseProcessItems(artifact) {
    if (!artifact || typeof artifact !== "object") {
      return [];
    }

    const steps = Array.isArray(artifact.steps) ? artifact.steps : [];
    const calls = Array.isArray(artifact.mcpCalls) ? artifact.mcpCalls : [];

    if (!steps.length && !calls.length && !artifact.stopReason) {
      return [];
    }

    const firstCreatedAt = steps[0]?.createdAt ?? calls[0]?.createdAt ?? artifact.createdAt ?? "";
    const planningResultRounds = new Set(
      steps.filter(isCommandPlanningResultStep).map((step) => getCommandStepRound(step)).filter(Boolean)
    );
    const timelineItems = [
      ...steps.map((step, index) => normalizeCommandResponseProcessStep(step, index, planningResultRounds)).filter(Boolean),
      ...calls.map((call, index) => normalizeCommandResponseProcessCall(call, index)).filter(Boolean)
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
        createdAt: artifact.createdAt ?? ""
      });
    }

    return [
      {
        id: `process_thought_${(artifact.createdAt ?? firstCreatedAt) || "now"}`,
        kind: "thought",
        marker: "思",
        label: "思路摘要",
        className: "is-thought",
        title: "我先判断任务路径",
        detail: getCommandResponseThoughtDetail(artifact),
        createdAt: firstCreatedAt
      },
      {
        id: `process_plan_${(artifact.createdAt ?? firstCreatedAt) || "now"}`,
        kind: "plan",
        marker: "计",
        label: "执行计划",
        className: "is-plan",
        title: "这轮按这些步骤推进",
        items: getCommandResponsePlanItems(artifact),
        createdAt: firstCreatedAt
      },
      ...timelineItems.sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))
    ];
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
      return "正在等待外部路径访问授权...";
    }

    if (latestStep?.type === "computer_use_permission_requested") {
      return "正在等待桌面控制授权...";
    }

    const statusText = normalizeCommandArtifactInlineText(liveProgress?.statusText);

    if (/最终回复|整理输出|模型调用完成|运行完成/u.test(statusText)) {
      return "正在整理回复...";
    }

    return "正在处理请求...";
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
    getCommandResponseProcessItems,
    getCommandLiveStatusText,
    getCommandWorkshopModeLabel,
    getCommandWorkshopToolModeLabel,
    handleAgentRunProgress,
    handleCommandAgentChange,
    handleCommandAttachmentSelect,
    handleCommandInputCompositionEnd,
    handleCommandInputCompositionStart,
    handleCommandInputEnterKeydown,
    handleCommandLoadMcpTools,
    handleCommandRunCancel,
    handleCommandServerChange,
    handleCommandSessionDelete,
    handleCommandSubmit,
    normalizeCommandWorkshopConfig,
    normalizeCommandWorkshopSession,
    normalizeCommandWorkshopSessions,
    openCommandSession,
    openCommandWorkspace,
    removeCommandAttachment,
    scrollCommandToBottom,
    upsertCommandWorkshopSessionState
  };
}
