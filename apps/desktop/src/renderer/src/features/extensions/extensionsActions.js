import { computed } from "vue";

import { isBuiltinWorkbenchItem, normalizeTagList, parseEnvText, stringifyEnvRecord } from "../../lib/presenter.js";

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function cloneToolProviderEditorValues(providers = []) {
  return providers.map((provider) => ({
    id: provider?.id ?? `tool_provider_${Date.now()}_${provider?.provider ?? "provider"}`,
    provider: provider?.provider ?? "",
    label: provider?.label ?? provider?.provider ?? "",
    model: provider?.model ?? "",
    apiKey: provider?.apiKey ?? "",
    baseUrl: provider?.baseUrl ?? "",
    enabled: Boolean(provider?.enabled),
    notes: provider?.notes ?? "",
    updatedAt: provider?.updatedAt ?? new Date().toISOString()
  }));
}

export function createExtensionEditorState(kind = "agent", entry = null) {
  if (kind === "skill") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        promptTemplate: entry?.promptTemplate ?? "",
        handlerRef: entry?.handlerRef ?? ""
      }
    };
  }

  if (kind === "skill-import") {
    return {
      kind,
      mode: "create",
      entryId: null,
      values: {
        repo: "",
        ref: "main",
        path: ""
      }
    };
  }

  if (kind === "mcp") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        transport: entry?.transport ?? "stdio",
        command: entry?.command ?? "",
        url: entry?.url ?? "",
        envText: stringifyEnvRecord(entry?.env ?? {}),
        toolAllowlist: (entry?.toolAllowlist ?? []).join(", ")
      }
    };
  }

  if (kind === "tool") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "image_gen",
        title: entry?.title ?? "",
        description: entry?.description ?? "",
        defaultProvider: entry?.defaultProvider ?? "",
        activeProvider: entry?.defaultProvider ?? entry?.providers?.[0]?.provider ?? "",
        enabled: Boolean(entry?.enabled),
        providers: cloneToolProviderEditorValues(entry?.providers ?? [])
      }
    };
  }

  return {
    kind: "agent",
    mode: entry ? "edit" : "create",
    entryId: entry?.id ?? null,
    values: {
      name: entry?.name ?? "",
      description: entry?.description ?? "",
      mode: entry?.mode ?? "task",
      modelProfileId: entry?.modelProfileId ?? "",
      systemPrompt: entry?.systemPrompt ?? "",
      allowedSkillIds: [...(entry?.allowedSkillIds ?? [])],
      allowedMcpServerIds: [...(entry?.allowedMcpServerIds ?? [])]
    }
  };
}

export function createAgentRunnerState(agentId = "") {
  return {
    agentId,
    skillId: "",
    autoSelectMcp: false,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}",
    availableMcpTools: [],
    userInput: "",
    result: null,
    isRunning: false
  };
}

export function getExtensionListTab(kind = "agent") {
  if (kind === "skill" || kind === "skill-import") {
    return "skill";
  }

  if (kind === "mcp") {
    return "mcp";
  }

  if (kind === "tool") {
    return "tool";
  }

  return "agent";
}

export function createExtensionsState() {
  return {
    view: "list",
    listTab: "agent",
    editor: createExtensionEditorState("agent"),
    runner: createAgentRunnerState()
  };
}

export function createExtensionsActions({
  activeFeature,
  desktopApi,
  featureExtensionsManagementId,
  getAgentById,
  getAgentRunnableSkills,
  getAuthorizedMcpServersForAgent,
  getMcpServerById,
  getSkillById,
  refreshWorkbenchSnapshot,
  setStatus,
  showAlertDialog,
  showConfirmDialog,
  ui,
  workbench
}) {
  const runnerAgent = computed(() => getAgentById(ui.extensions.runner.agentId));
  const runnerRunnableSkills = computed(() => getAgentRunnableSkills(ui.extensions.runner.agentId));
  const runnerAuthorizedServers = computed(() => getAuthorizedMcpServersForAgent(ui.extensions.runner.agentId));
  const runnerRecentLogs = computed(() => getRecentAgentRunLogs(ui.extensions.runner.agentId));
  const runnerLatestResult = computed(() => ui.extensions.runner.result ?? runnerRecentLogs.value[0] ?? null);

  function resetExtensionsManagement() {
    ui.extensions.view = "list";
    ui.extensions.editor = createExtensionEditorState("agent");
    ui.extensions.runner = createAgentRunnerState();
  }

  function getExtensionInitials(value) {
    const compact = String(value ?? "").trim();

    if (!compact) {
      return "EX";
    }

    return compact
      .split(/\s+/)
      .slice(0, 2)
      .map((item) => item.slice(0, 1).toUpperCase())
      .join("");
  }

  function openExtensionEditor(kind, entry = null) {
    writeRef(activeFeature, featureExtensionsManagementId);
    ui.extensions.listTab = getExtensionListTab(kind);
    ui.extensions.editor = createExtensionEditorState(kind, entry);
    ui.extensions.view = "editor";
  }

  function openAgentRunner(agentId) {
    writeRef(activeFeature, featureExtensionsManagementId);
    ui.extensions.listTab = "agent";
    ui.extensions.runner = createAgentRunnerState(agentId);
    ui.extensions.view = "runner";
  }

  function closeExtensionPanels() {
    const currentTab = ui.extensions.listTab;
    ui.extensions.view = "list";
    ui.extensions.editor = createExtensionEditorState(
      currentTab === "skill" ? "skill" : currentTab === "mcp" ? "mcp" : currentTab === "tool" ? "tool" : "agent"
    );
    ui.extensions.runner = createAgentRunnerState();
  }

  function resetRunnerState() {
    const agentId = ui.extensions.runner.agentId;
    ui.extensions.runner = createAgentRunnerState(agentId);
  }

  function getExtensionEditorTitle() {
    switch (ui.extensions.editor.kind) {
      case "agent":
        return ui.extensions.editor.mode === "edit" ? "编辑 Agent" : "新增 Agent";
      case "skill":
        return ui.extensions.editor.mode === "edit" ? "编辑 Skill" : "新增 Skill";
      case "skill-import":
        return "从 GitHub 加载 Skill";
      case "mcp":
        return ui.extensions.editor.mode === "edit" ? "编辑 MCP Server" : "新增 MCP Server";
      case "tool":
        return ui.extensions.editor.mode === "edit" ? "编辑 TOOL配置" : "新增 TOOL配置";
      default:
        return "能力编辑器";
    }
  }

  async function handleExtensionEditorSave() {
    if (!desktopApi) {
      setStatus("桌面桥接未就绪，暂无法保存能力配置。", "danger");
      return;
    }

    try {
      if (ui.extensions.editor.kind === "agent") {
        const existing = workbench.agentProfiles.find((entry) => entry.id === ui.extensions.editor.entryId);
        await desktopApi.upsertAgentProfile({
          id: ui.extensions.editor.entryId ?? `agent_${Date.now()}`,
          name: ui.extensions.editor.values.name.trim(),
          description: ui.extensions.editor.values.description.trim(),
          mode: ui.extensions.editor.values.mode,
          modelProfileId: ui.extensions.editor.values.modelProfileId.trim() || null,
          systemPrompt: ui.extensions.editor.values.systemPrompt.trim(),
          allowedSkillIds: ui.extensions.editor.values.allowedSkillIds,
          allowedMcpServerIds: ui.extensions.editor.values.allowedMcpServerIds,
          enabled: existing?.enabled ?? true,
          updatedAt: new Date().toISOString()
        });
      } else if (ui.extensions.editor.kind === "skill") {
        const existing = workbench.skillDefinitions.find((entry) => entry.id === ui.extensions.editor.entryId);
        const handlerRef = ui.extensions.editor.values.handlerRef.trim();
        await desktopApi.upsertSkillDefinition({
          id: ui.extensions.editor.entryId ?? `skill_${Date.now()}`,
          name: ui.extensions.editor.values.name.trim(),
          description: ui.extensions.editor.values.description.trim(),
          tags: [],
          kind: handlerRef || existing?.kind === "workflow" ? "workflow" : "prompt",
          promptTemplate: ui.extensions.editor.values.promptTemplate.trim(),
          handlerRef,
          source: existing?.source ?? { type: "manual" },
          enabled: existing?.enabled ?? true,
          updatedAt: new Date().toISOString()
        });
      } else if (ui.extensions.editor.kind === "skill-import") {
        await desktopApi.importSkillDefinitionFromGithub({
          repo: ui.extensions.editor.values.repo.trim(),
          ref: ui.extensions.editor.values.ref.trim() || "main",
          path: ui.extensions.editor.values.path.trim()
        });
      } else if (ui.extensions.editor.kind === "tool") {
        const existing = workbench.toolConfigs.find((entry) => entry.id === ui.extensions.editor.entryId);
        const providers = cloneToolProviderEditorValues(ui.extensions.editor.values.providers).map((provider) => ({
          ...provider,
          label: provider.label.trim() || provider.provider,
          model: provider.model.trim(),
          apiKey: provider.apiKey.trim(),
          baseUrl: provider.baseUrl.trim(),
          notes: provider.notes.trim(),
          updatedAt: new Date().toISOString()
        }));
        const enabledProviders = providers.filter((provider) => provider.enabled);
        const missingApiKeyProvider = enabledProviders.find((provider) => !provider.apiKey);

        if (ui.extensions.editor.values.enabled && !enabledProviders.length) {
          setStatus("启用 TOOL 前，请至少启用一个供应商。", "warning");
          return;
        }

        if (ui.extensions.editor.values.enabled && missingApiKeyProvider) {
          setStatus(`${missingApiKeyProvider.label || missingApiKeyProvider.provider} 已启用，但还没有填写 API Key。`, "warning");
          return;
        }

        await desktopApi.upsertToolConfig({
          id: ui.extensions.editor.entryId ?? existing?.id ?? `tool_${ui.extensions.editor.values.name}`,
          name: ui.extensions.editor.values.name,
          title: ui.extensions.editor.values.title.trim(),
          description: ui.extensions.editor.values.description.trim(),
          defaultProvider: enabledProviders.some((provider) => provider.provider === ui.extensions.editor.values.defaultProvider)
            ? ui.extensions.editor.values.defaultProvider
            : enabledProviders[0]?.provider ?? providers[0]?.provider ?? null,
          providers,
          enabled: Boolean(ui.extensions.editor.values.enabled),
          updatedAt: new Date().toISOString()
        });
      } else {
        const existing = workbench.mcpServers.find((entry) => entry.id === ui.extensions.editor.entryId);

        if (ui.extensions.editor.values.transport === "stdio" && !ui.extensions.editor.values.command.trim()) {
          setStatus("stdio 模式需要填写启动命令。", "warning");
          return;
        }

        if (ui.extensions.editor.values.transport === "http" && !ui.extensions.editor.values.url.trim()) {
          setStatus("http 模式需要填写服务地址。", "warning");
          return;
        }

        await desktopApi.upsertMcpServer({
          id: ui.extensions.editor.entryId ?? `mcp_${Date.now()}`,
          name: ui.extensions.editor.values.name.trim(),
          description: ui.extensions.editor.values.description.trim(),
          transport: ui.extensions.editor.values.transport,
          command: ui.extensions.editor.values.transport === "stdio" ? ui.extensions.editor.values.command.trim() : "",
          url: ui.extensions.editor.values.transport === "http" ? ui.extensions.editor.values.url.trim() : "",
          env: parseEnvText(ui.extensions.editor.values.envText),
          toolAllowlist: normalizeTagList(ui.extensions.editor.values.toolAllowlist),
          enabled: existing?.enabled ?? true,
          updatedAt: new Date().toISOString()
        });
      }

      await refreshWorkbenchSnapshot();
      closeExtensionPanels();
      setStatus("能力配置已保存。", "success");
    } catch (error) {
      console.error("Failed to save extension", error);
      setStatus(`能力配置保存失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleAgentStatusToggle(profileId) {
    if (!desktopApi) {
      return;
    }

    try {
      await desktopApi.toggleAgentProfileStatus(profileId);
      await refreshWorkbenchSnapshot();
      setStatus("Agent 状态已更新。", "success");
    } catch (error) {
      console.error("Failed to toggle agent status", error);
      setStatus(`Agent 状态更新失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleSkillStatusToggle(skillId) {
    if (!desktopApi) {
      return;
    }

    try {
      await desktopApi.toggleSkillDefinitionStatus(skillId);
      await refreshWorkbenchSnapshot();
      setStatus("Skill 状态已更新。", "success");
    } catch (error) {
      console.error("Failed to toggle skill status", error);
      setStatus(`Skill 状态更新失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleMcpStatusToggle(serverId) {
    if (!desktopApi) {
      return;
    }

    try {
      await desktopApi.toggleMcpServerStatus(serverId);
      await refreshWorkbenchSnapshot();
      setStatus("MCP 状态已更新。", "success");
    } catch (error) {
      console.error("Failed to toggle mcp status", error);
      setStatus(`MCP 状态更新失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleToolConfigStatusToggle(configId) {
    if (!desktopApi) {
      return;
    }

    const config = workbench.toolConfigs.find((entry) => entry.id === configId);
    const enabledProviders = (config?.providers ?? []).filter((provider) => provider.enabled);
    const missingApiKeyProvider = enabledProviders.find((provider) => !String(provider.apiKey ?? "").trim());

    if (config && !config.enabled && !enabledProviders.length) {
      setStatus("启用 TOOL 前，请先进入编辑页启用至少一个供应商。", "warning");
      return;
    }

    if (config && !config.enabled && missingApiKeyProvider) {
      setStatus(`${missingApiKeyProvider.label || missingApiKeyProvider.provider} 已启用，但还没有填写 API Key。`, "warning");
      return;
    }

    try {
      await desktopApi.toggleToolConfigStatus(configId);
      await refreshWorkbenchSnapshot();
      setStatus("TOOL 配置状态已更新。", "success");
    } catch (error) {
      console.error("Failed to toggle tool config status", error);
      setStatus(`TOOL 配置状态更新失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleAgentDelete(profileId) {
    if (!desktopApi || isBuiltinWorkbenchItem(profileId)) {
      return;
    }

    const profile = getAgentById(profileId);

    if (!profile) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除 Agent",
      message: `确认删除 Agent「${profile.name}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    try {
      await desktopApi.deleteAgentProfile(profileId);
      await refreshWorkbenchSnapshot();
      setStatus("Agent 已删除。", "success");
    } catch (error) {
      console.error("Failed to delete agent", error);
      setStatus(`Agent 删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleSkillDelete(skillId) {
    if (!desktopApi || isBuiltinWorkbenchItem(skillId)) {
      return;
    }

    const skill = getSkillById(skillId);

    if (!skill) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除 Skill",
      message: `确认删除 Skill「${skill.name}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    try {
      await desktopApi.deleteSkillDefinition(skillId);
      await refreshWorkbenchSnapshot();
      setStatus("Skill 已删除。", "success");
    } catch (error) {
      console.error("Failed to delete skill", error);
      setStatus(`Skill 删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  async function handleMcpDelete(serverId) {
    if (!desktopApi || isBuiltinWorkbenchItem(serverId)) {
      return;
    }

    const server = getMcpServerById(serverId);

    if (!server) {
      return;
    }

    const confirmed = await showConfirmDialog({
      tone: "danger",
      title: "删除 MCP Server",
      message: `确认删除 MCP Server「${server.name}」吗？删除后无法恢复。`,
      confirmText: "删除",
      cancelText: "取消"
    });

    if (!confirmed) {
      return;
    }

    try {
      await desktopApi.deleteMcpServer(serverId);
      await refreshWorkbenchSnapshot();
      setStatus("MCP Server 已删除。", "success");
    } catch (error) {
      console.error("Failed to delete mcp server", error);
      setStatus(`MCP 删除失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function handleRunnerServerChange() {
    ui.extensions.runner.mcpToolName = "";
    ui.extensions.runner.availableMcpTools = [];
  }

  async function handleRunnerLoadMcpTools() {
    if (!desktopApi) {
      return;
    }

    if (!ui.extensions.runner.mcpServerId) {
      setStatus("请先选择一个工具服务，再读取工具。", "warning");
      return;
    }

    try {
      const tools = await desktopApi.listMcpServerTools(ui.extensions.runner.mcpServerId);
      ui.extensions.runner.availableMcpTools = tools;
      ui.extensions.runner.mcpToolName = tools[0]?.name ?? "";
      setStatus(`已读取 ${tools.length} 个工具。`, "success");
    } catch (error) {
      console.error("Failed to load runner tools", error);
      setStatus(`工具读取失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function getRecentAgentRunLogs(agentId, limit = 5) {
    if (!agentId) {
      return [];
    }

    return workbench.agentRunLogs.filter((log) => log.agentProfileId === agentId).slice(0, limit);
  }

  async function handleRunnerSubmit() {
    if (!desktopApi) {
      return;
    }

    const agent = getAgentById(ui.extensions.runner.agentId);

    if (!agent) {
      setStatus("当前 Agent 运行器未就绪，暂无法执行。", "danger");
      return;
    }

    let mcpArguments = undefined;

    if (ui.extensions.runner.mcpToolName && !ui.extensions.runner.mcpServerId) {
      setStatus("如果要调用工具，请先选择工具服务。", "warning");
      return;
    }

    if (ui.extensions.runner.mcpServerId && !ui.extensions.runner.mcpToolName && !ui.extensions.runner.autoSelectMcp) {
      setStatus("已选择工具服务，请再选择一个具体工具。", "warning");
      return;
    }

    if (ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName) {
      try {
        mcpArguments = JSON.parse(ui.extensions.runner.mcpArgumentsText);
      } catch (error) {
        setStatus(`工具参数 JSON 解析失败：${getErrorMessage(error)}`, "danger");
        return;
      }

      if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
        setStatus("工具参数必须是一个 JSON 对象。", "danger");
        return;
      }
    }

    try {
      ui.extensions.runner.isRunning = true;
      setStatus(`正在运行 Agent「${agent.name}」...`, "neutral");
      const result = await desktopApi.runAgent({
        agentProfileId: agent.id,
        userInput: ui.extensions.runner.userInput.trim(),
        ...(ui.extensions.runner.skillId ? { skillId: ui.extensions.runner.skillId } : {}),
        ...(ui.extensions.runner.autoSelectMcp ? { autoSelectMcp: true } : {}),
        ...(ui.extensions.runner.mcpServerId ? { mcpServerId: ui.extensions.runner.mcpServerId } : {}),
        ...(ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName
          ? {
              mcpToolName: ui.extensions.runner.mcpToolName,
              mcpArguments
            }
          : {})
      });
      ui.extensions.runner.result = result;
      workbench.agentRunLogs = [result, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
      ui.extensions.runner.isRunning = false;
      setStatus(`Agent 运行完成（${result.profileLabel}）。`, "success");
    } catch (error) {
      console.error("Failed to run agent", error);
      ui.extensions.runner.isRunning = false;
      setStatus(`Agent 运行失败：${getErrorMessage(error)}`, "danger");
      void showAlertDialog({
        tone: "danger",
        title: "Agent 运行失败",
        message: getErrorMessage(error),
        detail: "Runner 保留当前输入，可调整 Agent、Skill 或工具配置后再次运行。",
        confirmText: "知道了"
      });
    }
  }

  return {
    closeExtensionPanels,
    getExtensionEditorTitle,
    getExtensionInitials,
    handleAgentDelete,
    handleAgentStatusToggle,
    handleExtensionEditorSave,
    handleMcpDelete,
    handleMcpStatusToggle,
    handleRunnerLoadMcpTools,
    handleRunnerServerChange,
    handleRunnerSubmit,
    handleSkillDelete,
    handleSkillStatusToggle,
    handleToolConfigStatusToggle,
    openAgentRunner,
    openExtensionEditor,
    resetExtensionsManagement,
    resetRunnerState,
    runnerAgent,
    runnerAuthorizedServers,
    runnerLatestResult,
    runnerRecentLogs,
    runnerRunnableSkills
  };
}
