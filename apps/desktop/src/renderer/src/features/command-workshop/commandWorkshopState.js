export function createCommandDraft(agentProfileId = "") {
  return {
    agentProfileId,
    skillId: "",
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
    queuedInput: "",
    queuedAttachments: [],
    availableMcpTools: [],
    isRunning: false,
    cancelRequested: false,
    isInputComposing: false,
    copiedMessageId: null,
    liveProgress: null
  };
}
