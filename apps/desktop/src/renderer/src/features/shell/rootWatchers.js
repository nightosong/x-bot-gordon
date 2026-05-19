import { onBeforeUnmount, onMounted, watch } from "vue";

export function setupRootWatchers({
  activeCommandMessages,
  activeFeature,
  bootstrapWorkbench,
  clearComicAutosaveTimer,
  clearMusicAutosaveTimer,
  clearVideoAutosaveTimer,
  clearWritingAutosaveTimer,
  desktopApi,
  disposeWeeklyRuntime,
  featureCommandWorkshopId,
  focusCommandInput,
  getWeeklyDraftSnapshot,
  handleAgentRunProgress,
  handleGordonDialogKeydown,
  handleWeeklyDraftSnapshotChange,
  handleWeeklySelectedReportTemplateIdChange,
  handleWorkflowRunProgress,
  nextTick,
  normalizeCommandWorkshopConfig,
  scrollCommandToBottom,
  status,
  syncWorkflowBodyDraftFromActiveStep,
  ui
}) {
  let agentProgressListenerId = null;
  let workflowProgressListenerId = null;

  watch(
    () => status.tone,
    (tone) => {
      document.body.classList.toggle("load-error", tone === "danger");
    },
    { immediate: true }
  );

  watch(
    activeFeature,
    async () => {
      if (activeFeature.value === featureCommandWorkshopId && ui.command.view === "chat") {
        await nextTick();
        scrollCommandToBottom();
      }
    },
    { immediate: false }
  );

  watch(
    () => ui.command.view,
    async (view) => {
      if (activeFeature.value === featureCommandWorkshopId && view === "chat") {
        await nextTick();
        scrollCommandToBottom();
        focusCommandInput();
      }
    }
  );

  watch(
    () => ui.command.composerView,
    (view) => {
      if (view === "input") {
        focusCommandInput();
      }
    }
  );

  watch(
    activeCommandMessages,
    () => {
      if (activeFeature.value === featureCommandWorkshopId && ui.command.view === "chat") {
        scrollCommandToBottom();
      }
    },
    { deep: true }
  );

  watch(
    () => ui.weekly.draft?.selectedReportTemplateId,
    handleWeeklySelectedReportTemplateIdChange
  );

  watch(
    () => `${ui.workflow.view}:${ui.workflow.activeCardId ?? ""}:${ui.workflow.activeRecordId ?? ""}`,
    () => {
      if (ui.workflow.view === "run") {
        syncWorkflowBodyDraftFromActiveStep({ force: true });
      }
    }
  );

  watch(
    () => getWeeklyDraftSnapshot(ui.weekly.draft),
    (nextSnapshot) => {
      handleWeeklyDraftSnapshotChange(nextSnapshot);
    }
  );

  onMounted(async () => {
    window.addEventListener("keydown", handleGordonDialogKeydown);

    if (desktopApi?.onAgentRunProgress) {
      agentProgressListenerId = desktopApi.onAgentRunProgress(handleAgentRunProgress);
    }

    if (desktopApi?.onWorkflowRunProgress) {
      workflowProgressListenerId = desktopApi.onWorkflowRunProgress(handleWorkflowRunProgress);
    }

    await bootstrapWorkbench();
    ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleGordonDialogKeydown);

    if (agentProgressListenerId && desktopApi?.offAgentRunProgress) {
      desktopApi.offAgentRunProgress(agentProgressListenerId);
      agentProgressListenerId = null;
    }

    if (workflowProgressListenerId && desktopApi?.offWorkflowRunProgress) {
      desktopApi.offWorkflowRunProgress(workflowProgressListenerId);
      workflowProgressListenerId = null;
    }

    disposeWeeklyRuntime();
    clearComicAutosaveTimer();
    clearMusicAutosaveTimer();
    clearVideoAutosaveTimer();
    clearWritingAutosaveTimer();
    document.body.classList.remove("load-error");
  });
}
