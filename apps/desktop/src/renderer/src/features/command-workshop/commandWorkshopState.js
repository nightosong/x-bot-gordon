export function createCommandDraft(agentProfileId = "") {
  return {
    agentProfileId,
    skillId: "",
    permissionMode: "auto",
    autoSelectMcp: true,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}"
  };
}

export function createCommandWorkshopState() {
  return {
    view: "list",
    composerView: "input",
    activeSessionId: null,
    activeProgressEventId: null,
    form: createCommandDraft(),
    draftInput: "",
    attachments: [],
    requestQueue: [],
    pendingGuidanceQueue: [],
    queuedRunDraft: null,
    availableMcpTools: [],
    isRunning: false,
    cancelRequested: false,
    isInputComposing: false,
    copiedMessageId: null,
    exportingMessageKey: null,
    liveProgress: null,
    lastSubmittedInput: "",
    slashMenu: {
      open: false,
      query: "",
      activeIndex: 0
    }
  };
}
