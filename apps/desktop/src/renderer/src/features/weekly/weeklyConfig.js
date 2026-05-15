export const WEEKLY_RISK_KEYWORDS = ["风险", "问题", "阻塞", "受阻", "卡点", "依赖", "待协调", "延期", "等待"];
export const WEEKLY_NO_RISK_PATTERN = /(暂无风险|无风险|无阻塞|暂无阻塞|未发现阻塞|风险可控)/;
export const WEEKLY_AUTOSAVE_DELAY = 700;
export const DAILY_REPORT_GUIDE_COPY = [
  "系统会自动遍历今天有更新的叶子任务。",
  "更新范围包括：修改任务内容、修改任务状态。",
  "输出结果会按项目归组，仅保留今天推进过的任务清单。"
].join("\n");

export function createWeeklyState() {
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
    dailyReportUseModelOptimization: false,
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
