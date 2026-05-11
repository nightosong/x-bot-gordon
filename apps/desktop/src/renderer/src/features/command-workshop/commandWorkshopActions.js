import { computed } from "vue";

import {
  BUILTIN_GORDON_AGENT_ID,
  buildCommandWorkshopArtifact,
  buildCommandWorkshopTitle,
  sortCommandWorkshopSessions,
  summarizeCommandWorkshopContent,
  truncateText
} from "../../lib/presenter.js";
import {
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

  function handleAgentRunProgress(payload) {
    if (!payload?.progressEventId || payload.progressEventId !== ui.command.activeProgressEventId) {
      return;
    }

    ui.command.liveProgress = {
      progressEventId: payload.progressEventId,
      phase: payload.phase ?? "running",
      statusText: payload.statusText || "正在执行中",
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

    if (ui.command.isRunning) {
      setStatus("上一轮任务仍在运行，请等待当前结果返回。", "warning");
      return;
    }

    const agent = getAgentById(ui.command.form.agentProfileId);
    const userInput = ui.command.draftInput.trim();
    const attachments = toPlainIpcData(ui.command.attachments ?? [], []);
    const agentUserInput = buildCommandUserInputForAgent(userInput, attachments);
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
    ui.command.isInputComposing = false;
    ui.command.activeProgressEventId = progressEventId;
    ui.command.liveProgress = {
      progressEventId,
      phase: "running",
      statusText: `命令工坊正在运行 Agent「${agent.name}」...`,
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
      ui.command.isRunning = false;
      ui.command.activeProgressEventId = null;
      ui.command.liveProgress = null;
      setStatus(`命令工坊已完成本轮响应（${result.profileLabel}）。`, "success");
      scrollCommandToBottom();
    } catch (error) {
      console.error("Failed to run command workshop session", error);
      const failedAt = new Date().toISOString();
      const assistantMessage = {
        id: `command_message_${Date.now()}_error`,
        role: "assistant",
        content: `运行失败：${getErrorMessage(error)}`,
        state: "error",
        createdAt: failedAt
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
      ui.command.activeProgressEventId = null;
      ui.command.liveProgress = null;
      setStatus(`命令工坊运行失败：${getErrorMessage(error)}`, "danger");
      void showAlertDialog({
        tone: "danger",
        title: "命令工坊运行失败",
        message: getErrorMessage(error),
        detail: "失败消息已保留在当前会话中，可回到消息流查看上下文后重试。",
        confirmText: "知道了"
      });
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
    const summaryParts = [
      artifact?.steps?.length ? `${artifact.steps.length} 个步骤` : "",
      artifact?.mcpCalls?.length ? `${artifact.mcpCalls.length} 次工具` : "",
      artifact?.profileLabel || ""
    ].filter(Boolean);

    return summaryParts.length ? `执行链路 · ${summaryParts.join(" / ")}` : "查看执行链路";
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

  function getCommandArtifactCallTitle(call) {
    return `第 ${call?.round ?? "-"} 轮 · ${call?.serverName ?? "工具服务"} / ${call?.toolName ?? "工具"}`;
  }

  function getCommandArtifactCallArgumentsText(call) {
    return stringifyCommandArtifactArguments(getCommandArtifactResolvedCallArguments(call));
  }

  function getCommandArtifactCallRepairedArgumentsText(call) {
    return stringifyCommandArtifactArguments(call?.repairedFromArguments);
  }

  function getCommandArtifactCallSecondary(call) {
    const secondaryParts = [];

    if (call?.autoSelected) {
      secondaryParts.push("自动选择");
    }

    if (call?.recovered) {
      secondaryParts.push(`重试恢复 x${call.attemptCount}`);
    } else if (call?.attemptCount > 1) {
      secondaryParts.push(`尝试 x${call.attemptCount}`);
    }

    if (call?.repairedFromArguments) {
      secondaryParts.push(call.repairReason ? normalizeCommandArtifactInlineText(call.repairReason) : "参数修复");
    }

    if (call?.fallbackFromToolName) {
      secondaryParts.push(`fallback ${call.fallbackFromServerName ?? call.serverName}/${call.fallbackFromToolName}`);
    }

    if (call?.isError) {
      secondaryParts.push("返回错误标记");
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
      secondaryParts.push(resultText);
    }

    return secondaryParts.join(" · ");
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
    getCommandArtifactCallSecondary,
    getCommandArtifactCallArgumentsText,
    getCommandArtifactCallRepairedArgumentsText,
    getCommandArtifactCallTitle,
    getCommandArtifactInlineText,
    getCommandArtifactProducts,
    getCommandArtifactStepSecondary,
    getCommandArtifactSummary,
    getCommandWorkshopModeLabel,
    getCommandWorkshopToolModeLabel,
    handleAgentRunProgress,
    handleCommandAgentChange,
    handleCommandAttachmentSelect,
    handleCommandInputCompositionEnd,
    handleCommandInputCompositionStart,
    handleCommandInputEnterKeydown,
    handleCommandLoadMcpTools,
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
