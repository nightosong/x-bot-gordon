<template>
  <div class="app-shell">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <main class="dashboard">
      <ShellNavigation :active-feature="activeFeature" @select="handleFeatureSelect" />

      <section class="right-column">
        <section class="workspace-panel" :class="{ 'workspace-panel-flush': isWorkspaceImmersive }">
          <template v-if="activeFeature === FEATURE_HOME">
            <HomeRobotStage :set-status="setStatus" />
          </template>

          <template v-else-if="activeFeature === FEATURE_MODEL_MANAGEMENT">
            <ModelManagementView
              :ui="ui"
              :workbench="workbench"
              :active-model-usage-profile="activeModelUsageProfile"
              :active-model-usage-error="activeModelUsageError"
              :is-active-model-usage-loading="isActiveModelUsageLoading"
              :model-usage-summary="modelUsageSummary"
              :model-usage-daily-series="modelUsageDailySeries"
              :model-usage-daily-list-series="modelUsageDailyListSeries"
              :provider-options="providerOptions"
              :model-editor-fields="modelEditorFields"
              :back-model-management="backModelManagement"
              :fill-model-balance-query-template="fillModelBalanceQueryTemplate"
              :format-balance-number="formatBalanceNumber"
              :format-local-date-time="formatLocalDateTime"
              :format-optional-balance-number="formatOptionalBalanceNumber"
              :get-model-balance-snapshot="getModelBalanceSnapshot"
              :get-model-usage-bar-height="getModelUsageBarHeight"
              :get-provider-meta="getProviderMeta"
              :handle-model-balance-refresh="handleModelBalanceRefresh"
              :handle-model-delete="handleModelDelete"
              :handle-model-editor-balance-query="handleModelEditorBalanceQuery"
              :handle-model-editor-save="handleModelEditorSave"
              :handle-model-status-toggle="handleModelStatusToggle"
              :has-model-balance-query="hasModelBalanceQuery"
              :is-model-balance-refreshing="isModelBalanceRefreshing"
              :mark-model-editor-dirty="markModelEditorDirty"
              :open-model-create-picker="openModelCreatePicker"
              :open-model-editor="openModelEditor"
              :open-model-usage-stats="openModelUsageStats"
              :select-model-provider="selectModelProvider"
              :select-popular-model="selectPopularModel"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_MARKETPLACE">
            <MarketplaceView :context="marketplaceViewContext" />
          </template>

          <template v-else-if="activeFeature === FEATURE_TASKS">
            <WeeklyWorkbench
              :state="ui.weekly"
              :weekly-progress="workbench.weeklyProgress"
              :active-model="activeModel"
              :weekly-task-rewrite-ids="weeklyTaskRewriteIds"
              :add-weekly-project="addWeeklyProject"
              :add-weekly-report-template="addWeeklyReportTemplate"
              :add-weekly-task="addWeeklyTask"
              :apply-weekly-report-template-ai-output="applyWeeklyReportTemplateAiOutput"
              :cancel-weekly-report-template-ai-run="cancelWeeklyReportTemplateAiRun"
              :close-weekly-editor="closeWeeklyEditor"
              :close-weekly-feishu-settings-dialog="closeWeeklyFeishuSettingsDialog"
              :close-weekly-report-template-ai="closeWeeklyReportTemplateAi"
              :generate-weekly-report-template-ai-output="generateWeeklyReportTemplateAiOutput"
              :get-weekly-report-template-ai-feedback-class="getWeeklyReportTemplateAiFeedbackClass"
              :handle-rich-text-click="handleRichTextClick"
              :handle-weekly-active-report-generation="handleWeeklyActiveReportGeneration"
              :handle-weekly-daily-report-share="handleWeeklyDailyReportShare"
              :handle-weekly-delete="handleWeeklyDelete"
              :handle-weekly-report-output-copy="handleWeeklyReportOutputCopy"
              :handle-weekly-report-template-selection-change="handleWeeklyReportTemplateSelectionChange"
              :handle-weekly-save="handleWeeklySave"
              :is-weekly-project-collapsed="isWeeklyProjectCollapsed"
              :open-weekly-record="openWeeklyRecord"
              :optimize-weekly-task-title="optimizeWeeklyTaskTitle"
              :remove-weekly-project="removeWeeklyProject"
              :remove-weekly-selected-report-template="removeWeeklySelectedReportTemplate"
              :remove-weekly-task="removeWeeklyTask"
              :open-weekly-feishu-settings-dialog="openWeeklyFeishuSettingsDialog"
              :reset-weekly-report-copy-state="resetWeeklyReportCopyState"
              :reset-weekly-report-share-state="resetWeeklyReportShareState"
              :save-weekly-feishu-settings-from-dialog="saveWeeklyFeishuSettingsFromDialog"
              :set-weekly-feishu-settings-draft-field="setWeeklyFeishuSettingsDraftField"
              :set-weekly-report-template-ai-instruction="setWeeklyReportTemplateAiInstruction"
              :set-weekly-report-template-ai-output="setWeeklyReportTemplateAiOutput"
              :set-weekly-reporting-mode="setWeeklyReportingMode"
              :set-weekly-report-output-mode="setWeeklyReportOutputMode"
              :set-weekly-task-status="setWeeklyTaskStatus"
              :toggle-weekly-report-template-collapsed="toggleWeeklyReportTemplateCollapsed"
              :toggle-weekly-project-collapsed="toggleWeeklyProjectCollapsed"
              :touch-weekly-task-by-id="touchWeeklyTaskById"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_WORKFLOW_LIBRARY">
            <WorkflowLibraryView
              :ui="ui"
              :workflow-library-cards="workflowLibraryCards"
              :workflow-detail-title="workflowDetailTitle"
              :filtered-workflow-records="filteredWorkflowRecords"
              :active-workflow-record="activeWorkflowRecord"
              :active-workflow-metrics="activeWorkflowMetrics"
              :active-workflow-api-key-input-type="activeWorkflowApiKeyInputType"
              :active-workflow-environments="activeWorkflowEnvironments"
              :active-workflow-environment="activeWorkflowEnvironment"
              :active-workflow-body-step-options="activeWorkflowBodyStepOptions"
              :workflow-body-draft-changed="workflowBodyDraftChanged"
              :workflow-run-control-label="workflowRunControlLabel"
              :workflow-run-control-icon="workflowRunControlIcon"
              :workflow-run-status-label="workflowRunStatusLabel"
              :workflow-run-status-tone="workflowRunStatusTone"
              :active-workflow-steps="activeWorkflowSteps"
              :add-workflow-draft-environment="addWorkflowDraftEnvironment"
              :add-workflow-draft-step="addWorkflowDraftStep"
              :add-workflow-step-output="addWorkflowStepOutput"
              :cancel-active-workflow-run="cancelActiveWorkflowRun"
              :delete-workflow-record="deleteWorkflowRecord"
              :duplicate-workflow-record="duplicateWorkflowRecord"
              :format-duration-ms="formatDurationMs"
              :format-local-date-time="formatLocalDateTime"
              :get-workflow-card-count-label="getWorkflowCardCountLabel"
              :get-workflow-run-completed-count="getWorkflowRunCompletedCount"
              :get-workflow-run-duration-label="getWorkflowRunDurationLabel"
              :get-workflow-run-progress-percent="getWorkflowRunProgressPercent"
              :get-workflow-run-summary-text="getWorkflowRunSummaryText"
              :get-workflow-step-mode-label="getWorkflowStepModeLabel"
              :get-workflow-step-progress-percent="getWorkflowStepProgressPercent"
              :get-workflow-step-status-label="getWorkflowStepStatusLabel"
              :get-workflow-step-status-tone="getWorkflowStepStatusTone"
              :get-workflow-step-visual-rows="getWorkflowStepVisualRows"
              :handle-workflow-api-key-input="handleWorkflowApiKeyInput"
              :handle-workflow-back="handleWorkflowBack"
              :handle-workflow-body-draft-input="handleWorkflowBodyDraftInput"
              :handle-workflow-body-step-select="handleWorkflowBodyStepSelect"
              :handle-workflow-curl-copy="handleWorkflowCurlCopy"
              :is-workflow-step-expanded="isWorkflowStepExpanded"
              :open-workflow-card="openWorkflowCard"
              :open-workflow-record="openWorkflowRecord"
              :open-workflow-record-editor="openWorkflowRecordEditor"
              :persist-active-workflow-runtime-config="persistActiveWorkflowRuntimeConfig"
              :persist-workflow-body-draft-to-template="persistWorkflowBodyDraftToTemplate"
              :remove-workflow-draft-environment="removeWorkflowDraftEnvironment"
              :remove-workflow-draft-step="removeWorkflowDraftStep"
              :remove-workflow-step-output="removeWorkflowStepOutput"
              :repair-workflow-body-draft="repairWorkflowBodyDraft"
              :run-active-workflow-record="runActiveWorkflowRecord"
              :save-workflow-record="saveWorkflowRecord"
              :select-workflow-environment="selectWorkflowEnvironment"
              :sync-workflow-body-draft-from-active-step="syncWorkflowBodyDraftFromActiveStep"
              :toggle-workflow-step-expanded="toggleWorkflowStepExpanded"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_COMMAND_WORKSHOP">
            <CommandWorkshopView
              ref="commandWorkshopViewRef"
              :ui="ui"
              :workbench="workbench"
              :active-command-session="activeCommandSession"
              :active-command-messages="activeCommandMessages"
              :command-chat-title="commandChatTitle"
              :command-settings-summary="commandSettingsSummary"
              :enabled-agent-profiles="enabledAgentProfiles"
              :command-selected-agent="commandSelectedAgent"
              :command-runnable-skills="commandRunnableSkills"
              :command-authorized-servers="commandAuthorizedServers"
              :command-tool-options="commandToolOptions"
              :back-to-command-list="backToCommandList"
              :begin-new-command-session="beginNewCommandSession"
              :get-command-artifact-products="getCommandArtifactProducts"
              :get-command-response-process-items="getCommandResponseProcessItems"
              :get-command-live-status-text="getCommandLiveStatusText"
              :get-skill-option-label="getSkillOptionLabel"
              :handle-command-agent-change="handleCommandAgentChange"
              :handle-command-attachment-select="handleCommandAttachmentSelect"
              :handle-command-input-composition-end="handleCommandInputCompositionEnd"
              :handle-command-input-composition-start="handleCommandInputCompositionStart"
              :handle-command-input-enter-keydown="handleCommandInputEnterKeydown"
              :handle-command-load-mcp-tools="handleCommandLoadMcpTools"
              :handle-command-run-cancel="handleCommandRunCancel"
              :handle-command-server-change="handleCommandServerChange"
              :handle-command-session-delete="handleCommandSessionDelete"
              :handle-command-submit="handleCommandSubmit"
              :handle-rich-text-click="handleRichTextClick"
              :open-command-session="openCommandSession"
              :remove-command-attachment="removeCommandAttachment"
              :resolve-agent-name="resolveAgentName"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_EXTENSIONS_MANAGEMENT">
            <ExtensionsManagementView
              :ui="ui"
              :workbench="workbench"
              :runner-agent="runnerAgent"
              :runner-runnable-skills="runnerRunnableSkills"
              :runner-authorized-servers="runnerAuthorizedServers"
              :runner-latest-result="runnerLatestResult"
              :runner-recent-logs="runnerRecentLogs"
              :close-extension-panels="closeExtensionPanels"
              :format-failure-kind="formatFailureKind"
              :format-local-date-time="formatLocalDateTime"
              :get-extension-editor-title="getExtensionEditorTitle"
              :get-extension-initials="getExtensionInitials"
              :get-skill-display-name="getSkillDisplayName"
              :get-skill-local-mirror-detail="getSkillLocalMirrorDetail"
              :get-skill-option-label="getSkillOptionLabel"
              :get-skill-source-detail="getSkillSourceDetail"
              :get-skill-source-label="getSkillSourceLabel"
              :handle-agent-delete="handleAgentDelete"
              :handle-agent-status-toggle="handleAgentStatusToggle"
              :handle-extension-editor-save="handleExtensionEditorSave"
              :handle-mcp-delete="handleMcpDelete"
              :handle-mcp-status-toggle="handleMcpStatusToggle"
              :handle-runner-load-mcp-tools="handleRunnerLoadMcpTools"
              :handle-runner-server-change="handleRunnerServerChange"
              :handle-runner-submit="handleRunnerSubmit"
              :handle-skill-delete="handleSkillDelete"
              :handle-skill-status-toggle="handleSkillStatusToggle"
              :handle-tool-config-status-toggle="handleToolConfigStatusToggle"
              :is-builtin-workbench-item="isBuiltinWorkbenchItem"
              :open-agent-runner="openAgentRunner"
              :open-extension-editor="openExtensionEditor"
              :reset-runner-state="resetRunnerState"
              :resolve-bound-model-name="resolveBoundModelName"
              :truncate-text="truncateText"
            />
          </template>

          <template v-else>
            <div class="workspace-stage workspace-stage-scroll">
              <article class="placeholder-card">
                <div>
                  <p class="feature-kicker">Coming Soon</p>
                  <p class="placeholder-title">{{ FEATURE_PLACEHOLDERS[activeFeature]?.title ?? "功能建设中" }}</p>
                  <p class="models-copy">{{ FEATURE_PLACEHOLDERS[activeFeature]?.description ?? "这里后续会补充对应功能模块。" }}</p>
                </div>
              </article>
            </div>
          </template>
        </section>
      </section>
    </main>

    <GordonDialog
      :dialog="gordonDialog"
      @backdrop="handleGordonDialogBackdrop"
      @resolve="resolveGordonDialog"
    />

  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from "vue";

import GordonDialog from "./components/GordonDialog.vue";
import { useGordonDialog } from "./composables/useGordonDialog.js";
import { createCommandWorkshopActions } from "./features/command-workshop/commandWorkshopActions.js";
import { createCommandWorkshopState } from "./features/command-workshop/commandWorkshopState.js";
import CommandWorkshopView from "./features/command-workshop/CommandWorkshopView.vue";
import { createExtensionsActions, createExtensionsState } from "./features/extensions/extensionsActions.js";
import ExtensionsManagementView from "./features/extensions/ExtensionsManagementView.vue";
import { createComicAiActions } from "./features/marketplace/comicAiActions.js";
import { createComicActions } from "./features/marketplace/comicActions.js";
import { createMarketplaceFieldAiActions } from "./features/marketplace/fieldAiActions.js";
import { createFortuneActions } from "./features/marketplace/fortuneActions.js";
import { createMarketplaceViewContext } from "./features/marketplace/marketplaceContext.js";
import MarketplaceView from "./features/marketplace/MarketplaceView.vue";
import { createMarketplaceState } from "./features/marketplace/marketplaceConfig.js";
import { createMusicActions } from "./features/marketplace/musicActions.js";
import { createVideoActions } from "./features/marketplace/videoActions.js";
import ModelManagementView from "./features/model-management/ModelManagementView.vue";
import {
  createEmptyModelSettings,
  createModelManagementActions,
  createModelManagementState
} from "./features/model-management/modelManagementActions.js";
import {
  FEATURE_COMMAND_WORKSHOP,
  FEATURE_EXTENSIONS_MANAGEMENT,
  FEATURE_HOME,
  FEATURE_MARKETPLACE,
  FEATURE_MODEL_MANAGEMENT,
  FEATURE_PLACEHOLDERS,
  FEATURE_TASKS,
  FEATURE_WORKFLOW_LIBRARY
} from "./features/shell/shellConfig.js";
import HomeRobotStage from "./features/shell/HomeRobotStage.vue";
import { setupRootWatchers } from "./features/shell/rootWatchers.js";
import ShellNavigation from "./features/shell/ShellNavigation.vue";
import { createWorkbenchRuntime } from "./features/shell/workbenchRuntime.js";
import { createWeeklyState } from "./features/weekly/weeklyConfig.js";
import { createWeeklyActions } from "./features/weekly/weeklyActions.js";
import WeeklyWorkbench from "./features/weekly/WeeklyWorkbench.vue";
import { getWeeklyDraftSnapshot } from "./features/weekly/weeklyRuntime.js";
import { createWorkflowActions, createWorkflowState } from "./features/workflow-library/workflowActions.js";
import WorkflowLibraryView from "./features/workflow-library/WorkflowLibraryView.vue";
import { createWritingActions } from "./features/writing/writingActions.js";
import { createWritingAiActions } from "./features/writing/writingAiActions.js";
import {
  createWritingPromptAssets,
  loadWritingPromptAssets
} from "./features/writing/writingPromptBuilder.js";
import {
  formatLocalDateTime,
  formatFailureKind,
  getProviderMeta,
  getSkillDisplayName,
  getSkillLocalMirrorDetail,
  getSkillOptionLabel,
  getSkillSourceDetail,
  getSkillSourceLabel,
  isBuiltinWorkbenchItem,
  truncateText
} from "./lib/presenter.js";
import { createRichTextClickHandler, copyTextToClipboard } from "./lib/clipboard.js";
import { createLocalId } from "./lib/ids.js";
import { toPlainIpcData } from "./lib/ipc.js";

const desktopApi = window.gordonDesktop ?? null;
const writingPromptAssets = reactive(createWritingPromptAssets());
let workbenchRuntime = null;

const activeFeature = ref(FEATURE_HOME);
const commandWorkshopViewRef = ref(null);
const comicChapterDropdownMenuRef = ref(null);
const videoShotDropdownMenuRef = ref(null);
const writingChapterDropdownMenuRef = ref(null);
const weeklyTaskRewriteIds = ref([]);

const status = reactive({
  text: "正在加载工作台...",
  tone: "neutral"
});

const workbench = reactive({
  snapshot: null,
  modelSettings: createEmptyModelSettings(),
  weeklyProgress: [],
  workflowLibrary: [],
  writingBooks: [],
  comicProjects: [],
  videoProjects: [],
  musicProjects: [],
  skillDefinitions: [],
  mcpServers: [],
  toolConfigs: [],
  agentProfiles: [],
  agentRunLogs: [],
  commandSessions: []
});

const ui = reactive({
  modelManagement: createModelManagementState(),
  marketplace: createMarketplaceState(),
  weekly: createWeeklyState(),
  workflow: createWorkflowState(),
  command: createCommandWorkshopState(),
  extensions: createExtensionsState()
});

const {
  dialog: gordonDialog,
  handleGordonDialogBackdrop,
  handleGordonDialogKeydown,
  resolveGordonDialog,
  showAlertDialog,
  showConfirmDialog,
  showInputDialog
} = useGordonDialog();

const isWorkspaceImmersive = computed(
  () =>
    (activeFeature.value === FEATURE_TASKS && ui.weekly.view === "editor") ||
    (activeFeature.value === FEATURE_MARKETPLACE && ui.marketplace.view !== "apps") ||
    (activeFeature.value === FEATURE_WORKFLOW_LIBRARY && ui.workflow.view !== "library") ||
    (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat") ||
    (activeFeature.value === FEATURE_MODEL_MANAGEMENT &&
      (ui.modelManagement.view === "editor" || ui.modelManagement.view === "usage")) ||
    (activeFeature.value === FEATURE_EXTENSIONS_MANAGEMENT && ui.extensions.view === "editor")
);

const enabledAgentProfiles = computed(() => workbench.agentProfiles.filter((profile) => profile.enabled));

async function bootstrapWorkbench() {
  return workbenchRuntime?.bootstrapWorkbench();
}

async function refreshWorkbenchSnapshot() {
  return workbenchRuntime?.refreshWorkbenchSnapshot();
}

const {
  activeModel,
  activeModelUsageError,
  activeModelUsageProfile,
  backModelManagement,
  fillModelBalanceQueryTemplate,
  formatBalanceNumber,
  formatOptionalBalanceNumber,
  getModelBalanceSnapshot,
  getModelUsageBarHeight,
  handleModelBalanceRefresh,
  handleModelDelete,
  handleModelEditorBalanceQuery,
  handleModelEditorSave,
  handleModelStatusToggle,
  hasModelBalanceQuery,
  isActiveModelUsageLoading,
  isModelBalanceRefreshing,
  markModelEditorDirty,
  modelEditorFields,
  modelUsageDailyListSeries,
  modelUsageDailySeries,
  modelUsageSummary,
  openModelCreatePicker,
  openModelEditor,
  openModelUsageStats,
  providerOptions,
  selectModelProvider,
  selectPopularModel,
  syncModelBalanceRuntimeFromProfiles
} = createModelManagementActions({
  activeFeature,
  desktopApi,
  featureModelManagementId: FEATURE_MODEL_MANAGEMENT,
  nextTick,
  refreshWorkbenchSnapshot,
  setStatus,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
});

const comicActions = createComicActions({
  activeFeature,
  comicChapterDropdownMenuRef,
  createLocalId,
  desktopApi,
  featureMarketplaceId: FEATURE_MARKETPLACE,
  nextTick,
  setStatus,
  showConfirmDialog,
  ui,
  workbench
});

const comicAiActions = createComicAiActions({
  activeComicChapter: comicActions.activeComicChapter,
  activeComicChapterAssets: comicActions.activeComicChapterAssets,
  activeComicChapterImage: comicActions.activeComicChapterImage,
  activeComicChapterIndex: comicActions.activeComicChapterIndex,
  activeComicProject: comicActions.activeComicProject,
  activeComicTabMeta: comicActions.activeComicTabMeta,
  appendComicChapterImages: comicActions.appendComicChapterImages,
  applyComicChaptersFromAi: comicActions.applyComicChaptersFromAi,
  createLocalId,
  desktopApi,
  getComicChapterDisplayTitle: comicActions.getComicChapterDisplayTitle,
  getComicProjectFormatLabel: comicActions.getComicProjectFormatLabel,
  getComicProjectPaletteLabel: comicActions.getComicProjectPaletteLabel,
  setComicChapterImagePrompt: comicActions.setComicChapterImagePrompt,
  setComicChapterImages: comicActions.setComicChapterImages,
  setComicChapterPrompt: comicActions.setComicChapterPrompt,
  setComicProjectEpisodePlan: comicActions.setComicProjectEpisodePlan,
  setComicProjectSummary: comicActions.setComicProjectSummary,
  setComicProjectVisualStyle: comicActions.setComicProjectVisualStyle,
  setStatus,
  ui
});

const {
  applyComicProjectsFromStorage,
  clearComicAutosaveTimer
} = comicActions;

const videoActions = createVideoActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId: FEATURE_MARKETPLACE,
  nextTick,
  setStatus,
  showConfirmDialog,
  ui,
  videoShotDropdownMenuRef,
  workbench
});

const {
  applyVideoProjectsFromStorage,
  clearVideoAutosaveTimer
} = videoActions;

const fortuneActions = createFortuneActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId: FEATURE_MARKETPLACE,
  setStatus,
  ui
});

const musicActions = createMusicActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId: FEATURE_MARKETPLACE,
  setStatus,
  showConfirmDialog,
  ui,
  workbench
});

const {
  applyMusicProjectsFromStorage,
  clearMusicAutosaveTimer
} = musicActions;

const writingActions = createWritingActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId: FEATURE_MARKETPLACE,
  nextTick,
  setStatus,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench,
  writingChapterDropdownMenuRef
});

const {
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingLengthProfile,
  activeWritingOutlinePlannerJob,
  activeWritingTask,
  applyWritingBooksFromStorage,
  buildWritingIntroContent,
  buildWritingOutlineContent,
  buildWritingStoryAssetsContent,
  clearWritingAutosaveTimer,
  ensureWritingChapterSelection,
  getPreferredWritingChapter,
  getWritingBookContent,
  getWritingBookParts,
  getWritingChapterDisplayTitle,
  getWritingChapterPart,
  getWritingChapterPartLabel,
  getWritingChapterStatusLabel,
  getWritingChapters,
  getWritingIntroFieldValue,
  getWritingPartDisplayLabel,
  getWritingTabTitle,
  mergeWritingStoryAssets,
  normalizePositiveInteger,
  normalizeWritingBookPart,
  normalizeWritingBookPartTypeForUi,
  normalizeWritingChapterDraftOutput,
  normalizeWritingChapterIndex,
  normalizeWritingOutlinePlannerJobForUi,
  normalizeWritingStoryAssetsForUi,
  parseWritingChapterIndex,
  persistWritingBookById,
  selectWritingChapter,
  setWritingAiTaskPickerOpen,
  setWritingChapterContent,
  setWritingChapterSummary,
  setWritingFeedback,
  setWritingIntroField,
  splitWritingBookPartTitlePrefix,
  splitWritingChapterTitlePrefix,
  touchWritingBook
} = writingActions;

const writingAiActions = createWritingAiActions({
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingLengthProfile,
  activeWritingOutlinePlannerJob,
  activeWritingTask,
  buildWritingStoryAssetsContent,
  buildWritingIntroContent,
  buildWritingOutlineContent,
  createLocalId,
  desktopApi,
  ensureWritingChapterSelection,
  getWritingBookContent,
  getWritingBookParts,
  getWritingChapterDisplayTitle,
  getWritingChapterPart,
  getWritingChapterPartLabel,
  getWritingChapterStatusLabel,
  getWritingChapters,
  getWritingIntroFieldValue,
  getWritingPartDisplayLabel,
  getWritingTabTitle,
  getPreferredWritingChapter,
  mergeWritingStoryAssets,
  normalizePositiveInteger,
  normalizeWritingBookPart,
  normalizeWritingBookPartTypeForUi,
  normalizeWritingChapterDraftOutput,
  normalizeWritingChapterIndex,
  normalizeWritingOutlinePlannerJobForUi,
  normalizeWritingStoryAssetsForUi,
  parseWritingChapterIndex,
  persistWritingBookById,
  selectWritingChapter,
  setStatus,
  setWritingAiTaskPickerOpen,
  setWritingChapterContent,
  setWritingChapterSummary,
  setWritingFeedback,
  setWritingIntroField,
  splitWritingBookPartTitlePrefix,
  splitWritingChapterTitlePrefix,
  touchWritingBook,
  truncateText,
  ui,
  writingPromptAssets
});

const fieldAiActions = createMarketplaceFieldAiActions({
  createLocalId,
  desktopApi,
  setStatus,
  ui
});

const marketplaceViewContext = createMarketplaceViewContext({
  comicActions,
  comicAiActions,
  comicChapterDropdownMenuRef,
  fieldAiActions,
  fortuneActions,
  musicActions,
  truncateText,
  ui,
  videoActions,
  videoShotDropdownMenuRef,
  writingActions,
  writingAiActions,
  writingChapterDropdownMenuRef
});
const activeWeeklyRecord = computed(() =>
  workbench.weeklyProgress.find((record) => record.id === ui.weekly.activeRecordId) ?? null
);
const {
  activeWorkflowApiKeyInputType,
  activeWorkflowBodyStepOptions,
  activeWorkflowEnvironment,
  activeWorkflowEnvironments,
  activeWorkflowMetrics,
  activeWorkflowRecord,
  activeWorkflowSteps,
  addWorkflowDraftEnvironment,
  addWorkflowDraftStep,
  addWorkflowStepOutput,
  cancelActiveWorkflowRun,
  deleteWorkflowRecord,
  duplicateWorkflowRecord,
  filteredWorkflowRecords,
  formatDurationMs,
  getWorkflowCardCountLabel,
  getWorkflowRunCompletedCount,
  getWorkflowRunDurationLabel,
  getWorkflowRunProgressPercent,
  getWorkflowRunSummaryText,
  getWorkflowStepModeLabel,
  getWorkflowStepProgressPercent,
  getWorkflowStepStatusLabel,
  getWorkflowStepStatusTone,
  getWorkflowStepVisualRows,
  handleWorkflowApiKeyInput,
  handleWorkflowBack,
  handleWorkflowBodyDraftInput,
  handleWorkflowBodyStepSelect,
  handleWorkflowCurlCopy,
  handleWorkflowRunProgress,
  isWorkflowStepExpanded,
  openWorkflowCard,
  openWorkflowRecord,
  openWorkflowRecordEditor,
  persistActiveWorkflowRuntimeConfig,
  persistWorkflowBodyDraftToTemplate,
  removeWorkflowDraftEnvironment,
  removeWorkflowDraftStep,
  removeWorkflowStepOutput,
  repairWorkflowBodyDraft,
  runActiveWorkflowRecord,
  saveWorkflowRecord,
  selectWorkflowEnvironment,
  syncWorkflowBodyDraftFromActiveStep,
  syncWorkflowSelection,
  toggleWorkflowStepExpanded,
  workflowBodyDraftChanged,
  workflowDetailTitle,
  workflowLibraryCards,
  workflowRunControlIcon,
  workflowRunControlLabel,
  workflowRunStatusLabel,
  workflowRunStatusTone
} = createWorkflowActions({
  activeFeature,
  copyTextToClipboard,
  createLocalId,
  desktopApi,
  featureWorkflowLibraryId: FEATURE_WORKFLOW_LIBRARY,
  setStatus,
  showAlertDialog,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
});

const {
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
  getCommandArtifactProducts,
  getCommandResponseProcessItems,
  getCommandLiveStatusText,
  handleAgentRunProgress,
  handleCommandAgentChange,
  handleCommandAttachmentSelect,
  handleCommandInputCompositionEnd,
  handleCommandInputCompositionStart,
  handleCommandInputEnterKeydown,
  handleCommandLoadMcpTools,
  handleCommandRunCancel,
  handleCommandServerChange,
  handleCommandSessionDelete,
  handleCommandSubmit,
  normalizeCommandWorkshopConfig,
  normalizeCommandWorkshopSessions,
  openCommandSession,
  removeCommandAttachment,
  scrollCommandToBottom
} = createCommandWorkshopActions({
  activeFeature,
  commandWorkshopViewRef,
  desktopApi,
  enabledAgentProfiles,
  featureCommandWorkshopId: FEATURE_COMMAND_WORKSHOP,
  formatFailureKind,
  getAgentById,
  getAgentRunnableSkills,
  getAuthorizedMcpServersForAgent,
  getMcpServerById,
  getSkillById,
  nextTick,
  refreshWorkbenchSnapshot,
  resolveBoundModelName,
  setStatus,
  showAlertDialog,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
});

const {
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
} = createExtensionsActions({
  activeFeature,
  desktopApi,
  featureExtensionsManagementId: FEATURE_EXTENSIONS_MANAGEMENT,
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
});

function setStatus(text, tone = "neutral") {
  status.text = text;
  status.tone = tone;
}

function resolveBoundModelName(modelProfileId) {
  if (!modelProfileId) {
    return "未绑定模型";
  }

  return workbench.modelSettings.profiles.find((profile) => profile.id === modelProfileId)?.displayName ?? "未绑定模型";
}

function resolveAgentName(agentId) {
  return getAgentById(agentId)?.name ?? "Gordon";
}

function getAgentById(agentId) {
  return workbench.agentProfiles.find((profile) => profile.id === agentId) ?? null;
}

function getSkillById(skillId) {
  return workbench.skillDefinitions.find((skill) => skill.id === skillId) ?? null;
}

function getMcpServerById(serverId) {
  return workbench.mcpServers.find((server) => server.id === serverId) ?? null;
}

function getAgentRunnableSkills(agentId) {
  const agent = getAgentById(agentId);

  if (!agent) {
    return [];
  }

  return workbench.skillDefinitions.filter((skill) => agent.allowedSkillIds.includes(skill.id) && skill.enabled);
}

function getAuthorizedMcpServersForAgent(agentId) {
  const agent = getAgentById(agentId);

  if (!agent) {
    return [];
  }

  return workbench.mcpServers.filter((server) => agent.allowedMcpServerIds.includes(server.id) && server.enabled);
}

function setActiveFeature(featureId) {
  activeFeature.value = featureId;

  if (featureId === FEATURE_MODEL_MANAGEMENT) {
    backModelManagement();
  }

  if (featureId === FEATURE_TASKS) {
    closeWeeklyEditor();
  }

  if (featureId === FEATURE_MARKETPLACE && !ui.marketplace.view) {
    ui.marketplace.view = "apps";
  }

  if (featureId === FEATURE_WORKFLOW_LIBRARY) {
    ui.workflow.view = "library";
    syncWorkflowSelection();
  }

  if (featureId === FEATURE_COMMAND_WORKSHOP) {
    ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
    ui.command.view = workbench.commandSessions.length ? "list" : "chat";
    ui.command.composerView = "input";
  }

  if (featureId === FEATURE_EXTENSIONS_MANAGEMENT) {
    resetExtensionsManagement();
  }
}

function handleFeatureSelect(featureId) {
  setActiveFeature(featureId);
}

const {
  addWeeklyProject,
  addWeeklyReportTemplate,
  addWeeklyTask,
  applyWeeklyReportTemplateAiOutput,
  cancelWeeklyReportTemplateAiRun,
  closeWeeklyEditor,
  closeWeeklyFeishuSettingsDialog,
  closeWeeklyReportTemplateAi,
  disposeWeeklyRuntime,
  generateWeeklyReportTemplateAiOutput,
  getWeeklyReportTemplateAiFeedbackClass,
  handleWeeklyActiveReportGeneration,
  handleWeeklyDailyReportShare,
  handleWeeklyDelete,
  handleWeeklyDraftSnapshotChange,
  handleWeeklyReportOutputCopy,
  handleWeeklyReportTemplateSelectionChange,
  handleWeeklySave,
  handleWeeklySelectedReportTemplateIdChange,
  isWeeklyProjectCollapsed,
  isWeeklyTaskRewriting,
  openWeeklyFeishuSettingsDialog,
  openLatestWeeklyRecord,
  openWeeklyRecord,
  optimizeWeeklyTaskTitle,
  removeWeeklyProject,
  removeWeeklySelectedReportTemplate,
  removeWeeklyTask,
  resetWeeklyReportCopyState,
  resetWeeklyReportShareState,
  saveWeeklyFeishuSettingsFromDialog,
  setWeeklyFeishuSettingsDraftField,
  setWeeklyReportTemplateAiInstruction,
  setWeeklyReportTemplateAiOutput,
  setWeeklyReportingMode,
  setWeeklyReportOutputMode,
  setWeeklyTaskStatus,
  syncWeeklyEditorState,
  toggleWeeklyReportTemplateCollapsed,
  toggleWeeklyProjectCollapsed,
  touchWeeklyTaskById
} = createWeeklyActions({
  activeFeature,
  activeWeeklyRecord,
  copyTextToClipboard,
  desktopApi,
  featureTasksId: FEATURE_TASKS,
  nextTick,
  setActiveFeature,
  setStatus,
  showConfirmDialog,
  showInputDialog,
  ui,
  weeklyTaskRewriteIds,
  workbench
});

workbenchRuntime = createWorkbenchRuntime({
  activeFeature,
  applyComicProjectsFromStorage,
  applyMusicProjectsFromStorage,
  applyVideoProjectsFromStorage,
  applyWritingBooksFromStorage,
  desktopApi,
  featureCommandWorkshopId: FEATURE_COMMAND_WORKSHOP,
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
});

const handleRichTextClick = createRichTextClickHandler({ setStatus });

setupRootWatchers({
  activeCommandMessages,
  activeFeature,
  bootstrapWorkbench,
  clearComicAutosaveTimer,
  clearMusicAutosaveTimer,
  clearVideoAutosaveTimer,
  clearWritingAutosaveTimer,
  desktopApi,
  disposeWeeklyRuntime,
  featureCommandWorkshopId: FEATURE_COMMAND_WORKSHOP,
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
});
</script>
