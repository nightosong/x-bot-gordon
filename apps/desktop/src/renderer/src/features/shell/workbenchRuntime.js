export function createWorkbenchRuntime({
  activeFeature,
  applyComicProjectsFromStorage,
  applyVideoProjectsFromStorage,
  applyWritingBooksFromStorage,
  desktopApi,
  featureCommandWorkshopId,
  loadWritingPromptAssets,
  normalizeCommandWorkshopConfig,
  normalizeCommandWorkshopSessions,
  setStatus,
  syncModelBalanceRuntimeFromProfiles,
  syncWeeklyEditorState,
  syncWorkflowSelection,
  ui,
  workbench,
  writingPromptAssets
}) {
  function applyWorkbenchSnapshot(snapshot, modelSettings) {
    workbench.snapshot = snapshot;
    workbench.modelSettings = modelSettings;
    syncModelBalanceRuntimeFromProfiles(modelSettings?.profiles ?? []);
    workbench.weeklyProgress = [...(snapshot?.weeklyProgress ?? [])];
    workbench.workflowLibrary = [...(snapshot?.workflowLibrary ?? [])];
    applyWritingBooksFromStorage(snapshot?.writingBooks ?? []);
    applyComicProjectsFromStorage(snapshot?.comicProjects ?? []);
    applyVideoProjectsFromStorage(snapshot?.videoProjects ?? []);
    workbench.skillDefinitions = [...(snapshot?.skillDefinitions ?? [])];
    workbench.mcpServers = [...(snapshot?.mcpServers ?? [])];
    workbench.toolConfigs = [...(snapshot?.toolConfigs ?? [])];
    workbench.agentProfiles = [...(snapshot?.agentProfiles ?? [])];
    workbench.agentRunLogs = [...(snapshot?.agentRunLogs ?? [])];
    workbench.commandSessions = normalizeCommandWorkshopSessions(snapshot?.commandWorkshopSessions ?? []);

    if (!ui.weekly.activeRecordId || !workbench.weeklyProgress.some((record) => record.id === ui.weekly.activeRecordId)) {
      ui.weekly.activeRecordId =
        workbench.weeklyProgress.find((record) => record.status === "active")?.id ?? workbench.weeklyProgress[0]?.id ?? null;
    }

    if (ui.weekly.view === "editor") {
      syncWeeklyEditorState();
    }

    syncWorkflowSelection();

    if (workbench.commandSessions.length) {
      const nextSession =
        workbench.commandSessions.find((session) => session.id === ui.command.activeSessionId) ?? workbench.commandSessions[0];

      ui.command.activeSessionId = nextSession?.id ?? null;
      ui.command.form = normalizeCommandWorkshopConfig(nextSession ?? ui.command.form);
    } else {
      ui.command.activeSessionId = null;
      ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);

      if (activeFeature.value === featureCommandWorkshopId) {
        ui.command.view = "chat";
      }
    }
  }

  async function bootstrapWorkbench() {
    if (!desktopApi) {
      setStatus("桌面桥接未就绪，当前只显示静态壳层。", "warning");
      return;
    }

    try {
      const promptAssetsPromise = loadWritingPromptAssets(desktopApi).catch((error) => {
        console.warn("Failed to load writing prompt assets", error);
        return null;
      });
      const [snapshot, modelSettings, loadedWritingPromptAssets] = await Promise.all([
        desktopApi.bootstrap(),
        desktopApi.listModelSettings(),
        promptAssetsPromise
      ]);

      if (loadedWritingPromptAssets) {
        Object.assign(writingPromptAssets, loadedWritingPromptAssets);
      }

      applyWorkbenchSnapshot(snapshot, modelSettings);
      setStatus(loadedWritingPromptAssets ? "工作台已就绪。" : "工作台已就绪，写作提示词资产使用兜底配置。", loadedWritingPromptAssets ? "success" : "warning");
    } catch (error) {
      console.error("Failed to bootstrap workbench", error);
      setStatus(`工作台加载失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  }

  async function refreshWorkbenchSnapshot() {
    if (!desktopApi) {
      return;
    }

    const [snapshot, modelSettings] = await Promise.all([desktopApi.bootstrap(), desktopApi.listModelSettings()]);
    applyWorkbenchSnapshot(snapshot, modelSettings);
  }

  return {
    applyWorkbenchSnapshot,
    bootstrapWorkbench,
    refreshWorkbenchSnapshot
  };
}
