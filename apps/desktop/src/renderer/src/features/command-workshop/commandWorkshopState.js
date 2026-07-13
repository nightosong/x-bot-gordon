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
    /** 本次会话已发送的输入历史，最新在前，用于 ↑/↓ 浏览 */
    inputHistory: [],
    /** 当前历史浏览游标，-1 表示未在浏览历史 */
    inputHistoryCursor: -1,
    /** 浏览历史前保存的草稿，避免退出历史浏览时丢失 */
    inputHistoryDraft: "",
    /** 会话列表搜索关键词 */
    sessionSearchQuery: "",
    /** 正在内联编辑的用户消息 id */
    editingMessageId: null,
    /** 内联编辑的草稿内容 */
    editingMessageDraft: "",
    /** 正在重命名的会话 id */
    renamingSessionId: null,
    /** 重命名草稿 */
    renamingSessionDraft: "",
    /** 过程流步骤收折响应式触发器（由 actions 层驱动） */
    _processCollapseSeq: 0,
    slashMenu: {
      open: false,
      query: "",
      activeIndex: 0
    }
  };
}
