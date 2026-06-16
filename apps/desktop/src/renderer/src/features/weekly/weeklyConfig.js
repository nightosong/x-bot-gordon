export const WEEKLY_RISK_KEYWORDS = ["风险", "问题", "阻塞", "受阻", "卡点", "依赖", "待协调", "延期", "等待"];
export const WEEKLY_NO_RISK_PATTERN = /(暂无风险|无风险|无阻塞|暂无阻塞|未发现阻塞|风险可控)/;
export const WEEKLY_AUTOSAVE_DELAY = 700;
export const DAILY_REPORT_GUIDE_COPY = [
  "系统会自动遍历今天有更新的叶子任务。",
  "更新范围包括：修改任务内容、修改任务状态。",
  "输出结果会按项目归组，仅保留今天推进过的任务清单。"
].join("\n");

function getDateInputValue(referenceDate = new Date()) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDefaultPerformanceReportRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);

  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: getDateInputValue(startDate),
    endDate: getDateInputValue(endDate)
  };
}

export function createWeeklyState() {
  const performanceReportRange = getDefaultPerformanceReportRange();

  return {
    view: "list",
    activeRecordId: null,
    draft: null,
    collapsedProjectIds: [],
    editorView: "projects",
    reportingMode: "daily",
    reportOutputMode: "preview",
    reportFeedbackText: "",
    reportFeedbackTone: "neutral",
    reportCopyState: "idle",
    dailyReportShareState: "idle",
    isSendingDailyReport: false,
    dailyReportUseModelOptimization: false,
    performanceReportRange,
    performanceReportInstruction: "",
    isPerformanceReportInstructionCollapsed: true,
    feishuSettings: {
      webhookUrl: "",
      secret: "",
      titlePrefix: "Gordon 日报",
      autoDailyReportEnabled: false,
      autoDailyReportTime: "18:30",
      autoDailyReportTimezone: "Asia/Shanghai",
      autoDailyReportLastRunDate: "",
      autoDailyReportLastRunAt: "",
      autoDailyReportLastStatus: "idle",
      autoDailyReportLastMessage: "",
      updatedAt: ""
    },
    feishuSettingsDraft: {
      webhookUrl: "",
      secret: "",
      titlePrefix: "Gordon 日报",
      autoDailyReportEnabled: false,
      autoDailyReportTime: "18:30",
      autoDailyReportTimezone: "Asia/Shanghai",
      autoDailyReportLastRunDate: "",
      autoDailyReportLastRunAt: "",
      autoDailyReportLastStatus: "idle",
      autoDailyReportLastMessage: "",
      updatedAt: ""
    },
    isFeishuSettingsLoaded: false,
    isFeishuSettingsDialogOpen: false,
    isFeishuSettingsLoading: false,
    isFeishuSettingsSaving: false,
    feishuSettingsFeedback: "",
    feishuSettingsFeedbackTone: "neutral",
    isReportTemplateCollapsed: true,
    reportTemplateAi: {
      isOpen: false,
      isGenerating: false,
      requestId: "",
      instruction: "",
      output: "",
      feedback: "",
      feedbackTone: "neutral"
    },
    isGeneratingReport: false,
    generatingReportKind: null
  };
}
