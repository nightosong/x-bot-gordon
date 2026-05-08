<template>
  <div class="app-shell">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <main class="dashboard">
      <section class="left-column">
        <section class="brand-panel">
          <div class="brand-panel-head">
            <div class="brand-lockup">
              <div class="brand-row">
                <MorphingText
                  class="brand-title"
                  base-text="GORDON"
                  :random-texts="BRAND_RANDOM_TEXTS"
                  aria-label="GORDON"
                />
              </div>
            </div>

            <details
              ref="homeSettingsMenuRef"
              class="home-settings-menu"
              :class="{ 'has-active-selection': isHomeSettingsFeature(activeFeature) }"
            >
              <summary aria-label="打开设置菜单">
                <GIcon name="settings" class="home-settings-trigger-gear" />
              </summary>

              <div class="home-settings-menu-panel">
                <button
                  v-for="item in HOME_SETTINGS_ITEMS"
                  :key="item.id"
                  type="button"
                  class="home-settings-item"
                  :class="{ 'is-active': activeFeature === item.id }"
                  @click="handleFeatureSelect(item.id)"
                >
                  <span class="home-settings-item-title">{{ item.title }}</span>
                  <span class="home-settings-item-copy">{{ item.copy }}</span>
                </button>
              </div>
            </details>
          </div>
        </section>

        <section class="feature-panel">
          <div class="feature-board">
            <article
              v-for="(entry, index) in FEATURE_ENTRIES"
              :key="entry.id"
              :class="getFeatureCardClass(entry, index)"
              :data-graffiti="entry.kicker"
              role="button"
              tabindex="0"
              :aria-label="`查看${entry.title}`"
              @click="handleFeatureSelect(entry.id)"
              @keydown.enter.prevent="handleFeatureSelect(entry.id)"
              @keydown.space.prevent="handleFeatureSelect(entry.id)"
              @pointermove="handleCardPointerMove"
              @pointerleave="handleCardPointerLeave"
              @pointercancel="handleCardPointerLeave"
              @pointerup="handleCardPointerLeave"
            >
              <span class="feature-graffiti" aria-hidden="true" :data-text="entry.kicker"></span>

              <div v-if="entry.tier === 'flat'" class="feature-card-flat-row">
                <div>
                  <p class="feature-kicker">{{ entry.kicker }}</p>
                  <p class="feature-title">{{ entry.title }}</p>
                </div>
              </div>

              <template v-else>
                <p class="feature-kicker">{{ entry.kicker }}</p>
                <p class="feature-title">{{ entry.title }}</p>
              </template>
            </article>
          </div>
        </section>
      </section>

      <section class="right-column">
        <section class="workspace-panel" :class="{ 'workspace-panel-flush': isWorkspaceImmersive }">
          <template v-if="activeFeature === FEATURE_HOME">
            <div class="workspace-stage robot-stage">
              <div class="robot-frame">
                <canvas ref="robotCanvasRef" class="robot-canvas" aria-label="Gordon robot"></canvas>
              </div>
            </div>
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
              :close-weekly-editor="closeWeeklyEditor"
              :handle-rich-text-click="handleRichTextClick"
              :handle-weekly-active-report-generation="handleWeeklyActiveReportGeneration"
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
              :reset-weekly-report-copy-state="resetWeeklyReportCopyState"
              :set-weekly-reporting-mode="setWeeklyReportingMode"
              :set-weekly-report-output-mode="setWeeklyReportOutputMode"
              :set-weekly-task-status="setWeeklyTaskStatus"
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
              :get-command-artifact-call-secondary="getCommandArtifactCallSecondary"
              :get-command-artifact-call-title="getCommandArtifactCallTitle"
              :get-command-artifact-inline-text="getCommandArtifactInlineText"
              :get-command-artifact-step-secondary="getCommandArtifactStepSecondary"
              :get-command-artifact-summary="getCommandArtifactSummary"
              :get-skill-option-label="getSkillOptionLabel"
              :handle-command-agent-change="handleCommandAgentChange"
              :handle-command-attachment-select="handleCommandAttachmentSelect"
              :handle-command-input-composition-end="handleCommandInputCompositionEnd"
              :handle-command-input-composition-start="handleCommandInputCompositionStart"
              :handle-command-input-enter-keydown="handleCommandInputEnterKeydown"
              :handle-command-load-mcp-tools="handleCommandLoadMcpTools"
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

    <Transition name="gordon-dialog-fade">
      <div v-if="ui.dialog.open" class="gordon-dialog-backdrop" @click.self="handleGordonDialogBackdrop">
        <section
          class="gordon-dialog"
          :class="[`is-${ui.dialog.tone}`, `is-${ui.dialog.kind}`]"
          role="dialog"
          aria-modal="true"
          :aria-label="ui.dialog.title"
        >
          <div class="gordon-dialog-head">
            <div class="gordon-dialog-mark" aria-hidden="true">
              <GIcon :name="ui.dialog.tone === 'danger' ? 'delete' : ui.dialog.kind === 'confirm' ? 'settings' : 'more'" />
            </div>

            <div>
              <p class="gordon-dialog-kicker">
                {{ ui.dialog.kind === "confirm" ? "Confirm" : ui.dialog.kind === "input" ? "Input" : "Notice" }}
              </p>
              <h2 class="gordon-dialog-title">{{ ui.dialog.title }}</h2>
            </div>
          </div>

          <p v-if="ui.dialog.message" class="gordon-dialog-message">{{ ui.dialog.message }}</p>

          <div v-if="ui.dialog.detailLines.length" class="gordon-dialog-detail">
            <p v-for="line in ui.dialog.detailLines" :key="line">{{ line }}</p>
          </div>

          <label v-if="ui.dialog.kind === 'input'" class="gordon-dialog-field">
            <span class="gordon-dialog-field-label">{{ ui.dialog.inputLabel }}</span>
            <input
              ref="gordonDialogInputRef"
              v-model="ui.dialog.inputValue"
              class="gordon-dialog-input"
              type="text"
              :placeholder="ui.dialog.inputPlaceholder"
              @keydown.enter.prevent="resolveGordonDialog(true)"
            />
          </label>

          <div class="gordon-dialog-actions">
            <button
              v-if="ui.dialog.kind !== 'alert'"
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              @click="resolveGordonDialog(false)"
            >
              {{ ui.dialog.cancelText }}
            </button>

            <button
              ref="gordonDialogPrimaryRef"
              type="button"
              class="gordon-dialog-button gordon-dialog-button-primary"
              @click="resolveGordonDialog(true)"
            >
              {{ ui.dialog.confirmText }}
            </button>
          </div>
        </section>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import robotSceneUrl from "../assets/spline-backups/home-robot-scene.splinecode?url";
import GIcon from "./components/GIcon.vue";
import MorphingText from "./components/MorphingText.vue";
import { createCommandWorkshopActions } from "./features/command-workshop/commandWorkshopActions.js";
import { createCommandWorkshopState } from "./features/command-workshop/commandWorkshopState.js";
import CommandWorkshopView from "./features/command-workshop/CommandWorkshopView.vue";
import { createExtensionsActions, createExtensionsState } from "./features/extensions/extensionsActions.js";
import ExtensionsManagementView from "./features/extensions/ExtensionsManagementView.vue";
import { createComicActions } from "./features/marketplace/comicActions.js";
import MarketplaceView from "./features/marketplace/MarketplaceView.vue";
import { createMarketplaceState } from "./features/marketplace/marketplaceConfig.js";
import ModelManagementView from "./features/model-management/ModelManagementView.vue";
import {
  createEmptyModelSettings,
  createModelManagementActions,
  createModelManagementState
} from "./features/model-management/modelManagementActions.js";
import {
  BRAND_RANDOM_TEXTS,
  FEATURE_COMMAND_WORKSHOP,
  FEATURE_ENTRIES,
  FEATURE_EXTENSIONS_MANAGEMENT,
  FEATURE_HOME,
  FEATURE_MARKETPLACE,
  FEATURE_MODEL_MANAGEMENT,
  FEATURE_PLACEHOLDERS,
  FEATURE_TASKS,
  FEATURE_WORKFLOW_LIBRARY,
  HOME_SETTINGS_ITEMS
} from "./features/shell/shellConfig.js";
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
  getProviderMeta,
  getSkillDisplayName,
  getSkillLocalMirrorDetail,
  getSkillOptionLabel,
  getSkillSourceDetail,
  getSkillSourceLabel,
  isBuiltinWorkbenchItem,
  renderRichText,
  truncateText
} from "./lib/presenter.js";

const desktopApi = window.gordonDesktop ?? null;
const writingPromptAssets = reactive(createWritingPromptAssets());
let splineApplicationClass = null;
let splineApplicationPromise = null;
let agentProgressListenerId = null;
let workflowProgressListenerId = null;

function toPlainIpcData(value, fallback = value) {
  const visited = new WeakSet();

  function normalize(input) {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return input;
    }

    if (typeof input === "bigint" || typeof input === "symbol" || typeof input === "function") {
      return String(input);
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (input instanceof Error) {
      return {
        name: input.name,
        message: input.message,
        stack: input.stack ?? ""
      };
    }

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    if (input instanceof Map) {
      return Object.fromEntries(Array.from(input.entries()).map(([key, entryValue]) => [String(key), normalize(entryValue)]));
    }

    if (input instanceof Set) {
      return Array.from(input.values()).map((item) => normalize(item));
    }

    if (typeof input !== "object") {
      return String(input);
    }

    if (visited.has(input)) {
      return "[Circular]";
    }

    visited.add(input);

    const output = {};

    for (const [key, entryValue] of Object.entries(input)) {
      output[key] = normalize(entryValue);
    }

    return output;
  }

  try {
    return normalize(value);
  } catch {
    return fallback;
  }
}

const activeFeature = ref(FEATURE_HOME);
const homeSettingsMenuRef = ref(null);
const robotCanvasRef = ref(null);
const commandWorkshopViewRef = ref(null);
const gordonDialogPrimaryRef = ref(null);
const gordonDialogInputRef = ref(null);
const comicChapterDropdownMenuRef = ref(null);
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
  skillDefinitions: [],
  mcpServers: [],
  agentProfiles: [],
  agentRunLogs: [],
  commandSessions: []
});

const ui = reactive({
  modelManagement: createModelManagementState(),
  marketplace: createMarketplaceState(),
  weekly: createWeeklyState(),
  workflow: createWorkflowState(),
  dialog: createGordonDialogState(),
  command: createCommandWorkshopState(),
  extensions: createExtensionsState()
});

const robotRuntimeState = {
  app: null,
  canvas: null,
  resizeObserver: null,
  loadToken: 0
};

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
const enabledSkills = computed(() => workbench.skillDefinitions.filter((skill) => skill.enabled));
const enabledMcpServers = computed(() => workbench.mcpServers.filter((server) => server.enabled));

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

const {
  activeComicChapter,
  activeComicChapterIndex,
  activeComicChapters,
  activeComicExportFileName,
  activeComicProject,
  activeComicTabMeta,
  applyComicProjectsFromStorage,
  backComicMarketplace,
  backComicShelf,
  canExportActiveComicProject,
  clearComicAutosaveTimer,
  closeComicExportDialog,
  comicProjects,
  createComicChapter,
  createComicProject,
  deleteComicProjectFromShelf,
  exportActiveComicProject,
  filteredComicChapterEntries,
  getComicChapterDisplayTitle,
  getComicChapterStatusClass,
  getComicChapterStatusLabel,
  getComicProjectFormatLabel,
  getComicProjectPaletteLabel,
  goComicChapter,
  openComicAppShelf,
  openComicExportDialog,
  openComicProject,
  selectComicChapter,
  selectComicChapterFromPicker,
  selectComicExportDirectory,
  setComicChapterContent,
  setComicChapterPickerOpen,
  setComicChapterPrompt,
  setComicChapterSummary,
  setComicChapterTitle,
  setComicProjectEpisodePlan,
  setComicProjectFormat,
  setComicProjectGenre,
  setComicProjectPageCount,
  setComicProjectPalette,
  setComicProjectSummary,
  setComicProjectTitle,
  setComicProjectVisualStyle,
  setComicTab,
  submitComicChapter,
  toggleComicChapterPicker,
  toggleComicProfileRail
} = createComicActions({
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

const {
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingContent,
  activeWritingDoneChapterCount,
  activeWritingDoneChapters,
  activeWritingExportFileName,
  activeWritingIntroSections,
  activeWritingLengthProfile,
  activeWritingOutlinePlannerJob,
  activeWritingTabMeta,
  activeWritingTask,
  activeWritingTaskOptions,
  applyWritingBooksFromStorage,
  backWritingMarketplace,
  backWritingShelf,
  buildWritingBookExportContent,
  buildWritingIntroContent,
  buildWritingOutlineContent,
  canExportActiveWritingBook,
  clearWritingAutosaveTimer,
  clearWritingChapterSubmitConfirmation,
  closeWritingExportDialog,
  createWritingBook,
  createWritingChapter,
  deleteWritingBookFromShelf,
  ensureWritingChapterSelection,
  exportActiveWritingBook,
  filteredWritingChapterEntries,
  formatWritingBookUpdatedAt,
  getDoneWritingChapters,
  getPreferredWritingChapter,
  getWritingAiFeedbackClass,
  getWritingBookCompleteness,
  getWritingBookContent,
  getWritingBookParts,
  getWritingBookWordCount,
  getWritingChapterDisplayTitle,
  getWritingChapterPart,
  getWritingChapterPartLabel,
  getWritingChapterStatusClass,
  getWritingChapterStatusLabel,
  getWritingChapterWordCount,
  getWritingChapters,
  getWritingExportFileName,
  getWritingIntroFieldValue,
  getWritingIntroSections,
  getWritingLengthLabel,
  getWritingPartDisplayLabel,
  getWritingTabTitle,
  getWritingTabWordCount,
  goWritingChapter,
  handleWritingBookUpload,
  isActiveWritingBookAiRunning,
  isWritingChapterSubmitConfirmed,
  normalizePositiveInteger,
  normalizeWritingBookForUi,
  normalizeWritingBookLengthForUi,
  normalizeWritingBookPart,
  normalizeWritingBookPartsForUi,
  normalizeWritingBookPartTypeForUi,
  normalizeWritingChapterDraftOutput,
  normalizeWritingChapterIndex,
  normalizeWritingChapterStatusForUi,
  normalizeWritingExportFormat,
  normalizeWritingOutlinePlannerJobForUi,
  openWritingAppShelf,
  openWritingBook,
  openWritingExportDialog,
  parseWritingChapterIndex,
  persistWritingBookById,
  selectPreferredWritingChapter,
  selectWritingChapter,
  selectWritingChapterFromPicker,
  selectWritingExportDirectory,
  selectWritingAiTask,
  setWritingAiDrawerOpen,
  setWritingAiTaskPickerOpen,
  setWritingBookContent,
  setWritingBookGenre,
  setWritingBookLength,
  setWritingBookTitle,
  setWritingChapterContent,
  setWritingChapterPickerOpen,
  setWritingChapterSummary,
  setWritingChapterTitle,
  setWritingExportFormat,
  setWritingFeedback,
  setWritingIntroField,
  setWritingTab,
  splitWritingBookPartTitlePrefix,
  splitWritingChapterTitlePrefix,
  submitWritingChapter,
  syncWritingBookSaveVersions,
  toggleWritingAiTaskPicker,
  toggleWritingChapterPicker,
  toggleWritingProfileRail,
  toggleWritingPromptPreview,
  touchWritingBook,
  writingBooks
} = createWritingActions({
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
  activeWritingLongOutlineRequest,
  activeWritingPromptPreview,
  applyWritingAssistantOutput,
  buildWritingLongOutlineTargetContent,
  cancelWritingOutlinePlanningJob,
  canResumeWritingOutlinePlanner,
  generateWritingAssistantOutput,
  getWritingAiRunButtonLabel,
  getWritingBusyDescription,
  getWritingBusyTitle,
  getWritingOutlinePlannerProgressCopy,
  getWritingOutlinePlannerProgressPercent,
  getWritingOutlinePlannerRetryCopy,
  getWritingOutlinePlannerStatusClass,
  getWritingOutlinePlannerStatusLabel,
  isWritingOutlinePlannerRunning,
  resumeWritingOutlinePlanningJob
} = createWritingAiActions({
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingLengthProfile,
  activeWritingOutlinePlannerJob,
  activeWritingTask,
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
  normalizePositiveInteger,
  normalizeWritingBookPart,
  normalizeWritingBookPartTypeForUi,
  normalizeWritingChapterDraftOutput,
  normalizeWritingChapterIndex,
  normalizeWritingOutlinePlannerJobForUi,
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


const marketplaceViewContext = {
  activeComicChapter,
  activeComicChapterIndex,
  activeComicChapters,
  activeComicExportFileName,
  activeComicProject,
  activeComicTabMeta,
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingDoneChapterCount,
  activeWritingExportFileName,
  activeWritingIntroSections,
  activeWritingLengthProfile,
  activeWritingLongOutlineRequest,
  activeWritingOutlinePlannerJob,
  activeWritingPromptPreview,
  activeWritingTabMeta,
  activeWritingTask,
  activeWritingTaskOptions,
  applyWritingAssistantOutput,
  backComicMarketplace,
  backComicShelf,
  backWritingMarketplace,
  backWritingShelf,
  buildWritingLongOutlineTargetContent,
  canExportActiveComicProject,
  canExportActiveWritingBook,
  canResumeWritingOutlinePlanner,
  cancelWritingOutlinePlanningJob,
  closeComicExportDialog,
  closeWritingExportDialog,
  comicChapterDropdownMenuRef,
  comicProjects,
  createComicChapter,
  createComicProject,
  createWritingBook,
  createWritingChapter,
  deleteComicProjectFromShelf,
  deleteWritingBookFromShelf,
  exportActiveComicProject,
  exportActiveWritingBook,
  filteredComicChapterEntries,
  filteredWritingChapterEntries,
  formatWritingBookUpdatedAt,
  generateWritingAssistantOutput,
  getComicChapterDisplayTitle,
  getComicChapterStatusClass,
  getComicChapterStatusLabel,
  getComicProjectFormatLabel,
  getComicProjectPaletteLabel,
  getWritingAiFeedbackClass,
  getWritingAiRunButtonLabel,
  getWritingBookCompleteness,
  getWritingBookWordCount,
  getWritingBusyDescription,
  getWritingBusyTitle,
  getWritingChapterDisplayTitle,
  getWritingChapterPartLabel,
  getWritingChapterStatusClass,
  getWritingChapterStatusLabel,
  getWritingChapterWordCount,
  getWritingIntroFieldValue,
  getWritingLengthLabel,
  getWritingOutlinePlannerProgressCopy,
  getWritingOutlinePlannerProgressPercent,
  getWritingOutlinePlannerRetryCopy,
  getWritingOutlinePlannerStatusClass,
  getWritingOutlinePlannerStatusLabel,
  getWritingTabWordCount,
  goComicChapter,
  goWritingChapter,
  handleWritingBookUpload,
  isActiveWritingBookAiRunning,
  isWritingChapterSubmitConfirmed,
  isWritingOutlinePlannerRunning,
  openComicAppShelf,
  openComicExportDialog,
  openComicProject,
  openWritingAppShelf,
  openWritingBook,
  openWritingExportDialog,
  resumeWritingOutlinePlanningJob,
  selectComicChapter,
  selectComicChapterFromPicker,
  selectComicExportDirectory,
  selectWritingAiTask,
  selectWritingChapter,
  selectWritingChapterFromPicker,
  selectWritingExportDirectory,
  setComicChapterContent,
  setComicChapterPickerOpen,
  setComicChapterPrompt,
  setComicChapterSummary,
  setComicChapterTitle,
  setComicProjectEpisodePlan,
  setComicProjectFormat,
  setComicProjectGenre,
  setComicProjectPageCount,
  setComicProjectPalette,
  setComicProjectSummary,
  setComicProjectTitle,
  setComicProjectVisualStyle,
  setComicTab,
  setWritingAiDrawerOpen,
  setWritingBookGenre,
  setWritingBookLength,
  setWritingBookTitle,
  setWritingChapterContent,
  setWritingChapterPickerOpen,
  setWritingChapterSummary,
  setWritingChapterTitle,
  setWritingExportFormat,
  setWritingIntroField,
  setWritingTab,
  submitComicChapter,
  submitWritingChapter,
  toggleComicChapterPicker,
  toggleComicProfileRail,
  toggleWritingAiTaskPicker,
  toggleWritingChapterPicker,
  toggleWritingProfileRail,
  toggleWritingPromptPreview,
  truncateText,
  ui,
  writingBooks,
  writingChapterDropdownMenuRef
};
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
  getCommandArtifactCallSecondary,
  getCommandArtifactCallTitle,
  getCommandArtifactInlineText,
  getCommandArtifactStepSecondary,
  getCommandArtifactSummary,
  handleAgentRunProgress,
  handleCommandAgentChange,
  handleCommandAttachmentSelect,
  handleCommandInputCompositionEnd,
  handleCommandInputCompositionStart,
  handleCommandInputEnterKeydown,
  handleCommandLoadMcpTools,
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

function createGordonDialogState() {
  return {
    open: false,
    kind: "alert",
    tone: "neutral",
    title: "",
    message: "",
    detailLines: [],
    inputLabel: "名称",
    inputValue: "",
    inputPlaceholder: "",
    confirmText: "确认",
    cancelText: "取消",
    resolve: null
  };
}

function normalizeGordonDialogDetail(detail) {
  if (Array.isArray(detail)) {
    return detail.map((line) => String(line ?? "").trim()).filter(Boolean);
  }

  const normalized = String(detail ?? "").trim();
  return normalized ? [normalized] : [];
}

function resetGordonDialog() {
  Object.assign(ui.dialog, createGordonDialogState());
}

function openGordonDialog(options = {}) {
  if (typeof ui.dialog.resolve === "function") {
    ui.dialog.resolve(false);
  }

  return new Promise((resolve) => {
    Object.assign(ui.dialog, {
      ...createGordonDialogState(),
      open: true,
      kind: options.kind ?? "alert",
      tone: options.tone ?? "neutral",
      title: String(options.title ?? "Gordon"),
      message: String(options.message ?? ""),
      detailLines: normalizeGordonDialogDetail(options.detail),
      inputLabel: String(options.inputLabel ?? "名称"),
      inputValue: String(options.inputValue ?? ""),
      inputPlaceholder: String(options.inputPlaceholder ?? ""),
      confirmText: String(options.confirmText ?? (options.kind === "confirm" ? "确认" : "知道了")),
      cancelText: String(options.cancelText ?? "取消"),
      resolve
    });

    void nextTick(() => {
      if (ui.dialog.kind === "input" && gordonDialogInputRef.value instanceof HTMLInputElement) {
        gordonDialogInputRef.value.focus();
        gordonDialogInputRef.value.select();
      } else if (gordonDialogPrimaryRef.value instanceof HTMLElement) {
        gordonDialogPrimaryRef.value.focus();
      }
    });
  });
}

function showConfirmDialog(options = {}) {
  return openGordonDialog({
    kind: "confirm",
    tone: options.tone ?? "warning",
    confirmText: options.confirmText ?? "确认",
    cancelText: options.cancelText ?? "取消",
    ...options
  });
}

function showAlertDialog(options = {}) {
  return openGordonDialog({
    kind: "alert",
    tone: options.tone ?? "warning",
    confirmText: options.confirmText ?? "知道了",
    ...options
  });
}

function showInputDialog(options = {}) {
  return openGordonDialog({
    kind: "input",
    tone: options.tone ?? "neutral",
    confirmText: options.confirmText ?? "确认",
    cancelText: options.cancelText ?? "取消",
    ...options
  });
}

function resolveGordonDialog(confirmed) {
  const resolver = ui.dialog.resolve;
  const kind = ui.dialog.kind;
  const inputValue = ui.dialog.inputValue;
  resetGordonDialog();

  if (typeof resolver === "function") {
    if (kind === "alert") {
      resolver(true);
    } else if (kind === "input") {
      resolver(confirmed ? inputValue : null);
    } else {
      resolver(Boolean(confirmed));
    }
  }
}

function handleGordonDialogBackdrop() {
  if (ui.dialog.kind === "alert") {
    resolveGordonDialog(true);
  }
}

function handleGordonDialogKeydown(event) {
  if (!ui.dialog.open || event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  resolveGordonDialog(false);
}

function setStatus(text, tone = "neutral") {
  status.text = text;
  status.tone = tone;
}

function createLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function getFeatureCardClass(entry, index) {
  const classes = ["feature-card", "tilt-card", `feature-card-${entry.tier}`];

  if (entry.tier !== "flat") {
    classes.push(index % 2 === 1 ? "feature-card-align-right" : "feature-card-align-left");
  }

  if (entry.id === activeFeature.value) {
    classes.push("is-active");
  }

  return classes;
}

function resetTiltCard(card) {
  if (!(card instanceof HTMLElement)) {
    return;
  }

  card.style.setProperty("--rotate-x", "0deg");
  card.style.setProperty("--rotate-y", "0deg");
  card.style.setProperty("--lift", "0px");
}

function handleCardPointerMove(event) {
  const card = event.currentTarget;

  if (!(card instanceof HTMLElement)) {
    return;
  }

  const bounds = card.getBoundingClientRect();
  const offsetX = event.clientX - bounds.left;
  const offsetY = event.clientY - bounds.top;
  const rotateY = ((offsetX / bounds.width) - 0.5) * 10;
  const rotateX = (0.5 - (offsetY / bounds.height)) * 10;

  card.style.setProperty("--rotate-x", `${rotateX.toFixed(2)}deg`);
  card.style.setProperty("--rotate-y", `${rotateY.toFixed(2)}deg`);
  card.style.setProperty("--lift", "-4px");
}

function handleCardPointerLeave(event) {
  resetTiltCard(event.currentTarget);
}

function isHomeSettingsFeature(featureId) {
  return featureId === FEATURE_MODEL_MANAGEMENT || featureId === FEATURE_EXTENSIONS_MANAGEMENT;
}

function closeHomeSettingsMenu() {
  if (homeSettingsMenuRef.value) {
    homeSettingsMenuRef.value.open = false;
  }
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

function applyWorkbenchSnapshot(snapshot, modelSettings) {
  workbench.snapshot = snapshot;
  workbench.modelSettings = modelSettings;
  syncModelBalanceRuntimeFromProfiles(modelSettings?.profiles ?? []);
  workbench.weeklyProgress = [...(snapshot?.weeklyProgress ?? [])];
  workbench.workflowLibrary = [...(snapshot?.workflowLibrary ?? [])];
  applyWritingBooksFromStorage(snapshot?.writingBooks ?? []);
  applyComicProjectsFromStorage(snapshot?.comicProjects ?? []);
  workbench.skillDefinitions = [...(snapshot?.skillDefinitions ?? [])];
  workbench.mcpServers = [...(snapshot?.mcpServers ?? [])];
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

    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP) {
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

function setActiveFeature(featureId) {
  activeFeature.value = featureId;
  closeHomeSettingsMenu();

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
  closeWeeklyEditor,
  disposeWeeklyRuntime,
  handleWeeklyActiveReportGeneration,
  handleWeeklyDelete,
  handleWeeklyDraftSnapshotChange,
  handleWeeklyReportOutputCopy,
  handleWeeklyReportTemplateSelectionChange,
  handleWeeklySave,
  handleWeeklySelectedReportTemplateIdChange,
  isWeeklyProjectCollapsed,
  isWeeklyTaskRewriting,
  openLatestWeeklyRecord,
  openWeeklyRecord,
  optimizeWeeklyTaskTitle,
  removeWeeklyProject,
  removeWeeklySelectedReportTemplate,
  removeWeeklyTask,
  resetWeeklyReportCopyState,
  setWeeklyReportingMode,
  setWeeklyReportOutputMode,
  setWeeklyTaskStatus,
  syncWeeklyEditorState,
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

async function copyTextToClipboard(value) {
  const text = String(value ?? "");

  if (!text) {
    throw new Error("没有可复制的内容");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("当前环境不支持剪贴板复制");
  }
}

async function handleRichTextClick(event) {
  const target = event.target instanceof Element ? event.target.closest("[data-command-copy-code]") : null;

  if (!target) {
    return;
  }

  const codeElement = target.closest(".command-code-block")?.querySelector("code");
  const content = codeElement?.textContent ?? "";

  if (!content) {
    return;
  }

  try {
    await copyTextToClipboard(content);
    setStatus("代码已复制。", "success");
  } catch (error) {
    setStatus(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function formatFailureKind(failureKind) {
  if (failureKind === "schema_mismatch") {
    return "Schema 不匹配";
  }

  if (failureKind === "tool_unavailable") {
    return "工具不可用";
  }

  if (failureKind === "tool_execution") {
    return "工具执行失败";
  }

  return "未知失败";
}

function disposeRobotRuntime() {
  robotRuntimeState.loadToken += 1;

  if (robotRuntimeState.resizeObserver) {
    robotRuntimeState.resizeObserver.disconnect();
    robotRuntimeState.resizeObserver = null;
  }

  if (robotRuntimeState.app) {
    robotRuntimeState.app.dispose();
    robotRuntimeState.app = null;
  }

  robotRuntimeState.canvas = null;
}

async function loadSplineApplication() {
  if (splineApplicationClass) {
    return splineApplicationClass;
  }

  if (!splineApplicationPromise) {
    splineApplicationPromise = import("@splinetool/runtime").then((module) => {
      splineApplicationClass = module.Application;
      return splineApplicationClass;
    });
  }

  return splineApplicationPromise;
}

async function syncRobotRuntime() {
  if (activeFeature.value !== FEATURE_HOME) {
    disposeRobotRuntime();
    return;
  }

  const canvas = robotCanvasRef.value;

  if (!(canvas instanceof HTMLCanvasElement)) {
    disposeRobotRuntime();
    return;
  }

  if (robotRuntimeState.canvas === canvas && robotRuntimeState.app) {
    return;
  }

  const token = robotRuntimeState.loadToken + 1;
  disposeRobotRuntime();

  let SplineApplication = null;

  try {
    SplineApplication = await loadSplineApplication();
  } catch (error) {
    console.error("Failed to load Gordon robot runtime", error);

    if (token === robotRuntimeState.loadToken) {
      setStatus("机器人运行时加载失败。", "danger");
    }

    return;
  }

  if (token !== robotRuntimeState.loadToken || activeFeature.value !== FEATURE_HOME) {
    return;
  }

  const app = new SplineApplication(canvas, {
    renderMode: "continuous"
  });

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    app.setSize(width, height);
  };

  robotRuntimeState.app = app;
  robotRuntimeState.canvas = canvas;
  robotRuntimeState.resizeObserver = new ResizeObserver(resize);
  robotRuntimeState.resizeObserver.observe(canvas);
  resize();

  try {
    await app.load(robotSceneUrl);

    if (token !== robotRuntimeState.loadToken) {
      app.dispose();
    }
  } catch (error) {
    console.error("Failed to load Gordon robot scene", error);

    if (token === robotRuntimeState.loadToken) {
      setStatus("机器人场景加载失败。", "danger");
    }
  }
}

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
    await nextTick();
    await syncRobotRuntime();

    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat") {
      scrollCommandToBottom();
    }
  },
  { immediate: false }
);

watch(
  () => ui.command.view,
  async (view) => {
    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP && view === "chat") {
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
    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat") {
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
  await nextTick();
  await syncRobotRuntime();
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
  clearWritingAutosaveTimer();
  disposeRobotRuntime();
  document.body.classList.remove("load-error");
});
</script>
