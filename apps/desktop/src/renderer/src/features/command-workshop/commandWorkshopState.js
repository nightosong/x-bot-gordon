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
    availableMcpTools: [],
    isRunning: false,
    cancelRequested: false,
    isInputComposing: false,
    liveProgress: null
  };
}
