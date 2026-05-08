<template>
  <div class="workspace-stage workspace-stage-scroll" :class="{ 'workspace-stage-flush': state.view === 'editor' }">
    <div class="weekly-shell" :class="{ 'weekly-shell-editor': state.view === 'editor' }">
      <section v-if="state.view === 'list'" class="weekly-hero weekly-hero-cockpit">
        <div class="weekly-hero-main">
          <div>
            <p class="feature-kicker">Weekly Progress</p>
            <p class="models-title">任务笔记</p>
          </div>
        </div>

        <div class="weekly-hero-side">
          <span class="status-pill models-badge">
            {{ activeModel ? `AI 已连接：${activeModel.displayName}` : "AI 功能待启用" }}
          </span>
          <span class="pill pill-neutral">
            {{ weeklyProgress.length ? `已归档 ${weeklyProgress.length} 周记录` : "等待创建本周计划" }}
          </span>
        </div>
      </section>

      <section v-if="state.view === 'list'" class="weekly-overview-grid">
        <article v-for="card in weeklyListOverviewCards" :key="card.id" class="weekly-kpi-card">
          <p class="weekly-kpi-label">{{ card.label }}</p>
          <p class="weekly-kpi-value">{{ card.value }}</p>
          <p v-if="card.meta" class="weekly-kpi-meta" :class="{ 'is-success': card.metaTone === 'success' }">{{ card.meta }}</p>
        </article>
      </section>

      <div class="models-grid models-grid-single" :class="{ 'models-grid-immersive': state.view === 'editor' }">
        <section v-if="state.view === 'list'" class="model-section">
          <div class="model-section-head">
            <div>
              <p class="feature-kicker">Weekly Reports</p>
              <p class="model-section-title">周报列表</p>
            </div>

            <div class="model-section-actions">
              <span v-if="weeklyFocusRecord" class="status-pill">{{ weeklyFocusRecord.title }}</span>
              <span class="pill pill-neutral">
                共 {{ weeklyProgress.length }} 周，展示 {{ Math.min(weeklyProgress.length, 5) }} 条
              </span>
            </div>
          </div>

          <div class="model-section-body model-configured-list weekly-record-list">
            <div v-if="!weeklyProgress.length" class="model-empty">
              <p class="model-empty-copy">当前还没有周记录，首次进入时会自动创建本周空白计划。</p>
            </div>

            <article
              v-for="record in weeklyProgress.slice(0, 5)"
              :key="record.id"
              class="weekly-record-card"
              :class="{ 'is-active': state.activeRecordId === record.id }"
            >
              <button type="button" class="weekly-record-main" @click="openWeeklyRecord(record.id)">
                <div class="weekly-record-left">
                  <div class="weekly-record-copy">
                    <div class="weekly-record-topline">
                      <span
                        class="pill weekly-record-pill"
                        :class="{
                          'is-current': record.status === 'active',
                          'is-history pill-neutral': record.status !== 'active'
                        }"
                      >
                        {{ record.status === "active" ? "本周" : "历史" }}
                      </span>
                      <p class="weekly-record-title">{{ record.title }}</p>
                      <div class="weekly-record-metrics">
                        <span v-for="tag in getWeeklyRecordTags(record)" :key="tag" class="pill pill-neutral weekly-record-metric">
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              <div class="weekly-record-actions">
                <span
                  class="weekly-record-status"
                  :class="getWeeklyRecordHasContent(record) ? 'is-updated' : 'is-pending'"
                >
                  {{ getWeeklyRecordHasContent(record) ? `已更新 ${formatLocalDateTime(record.updatedAt)}` : "待规划" }}
                </span>

                <button
                  type="button"
                  class="model-icon-button model-icon-button-danger weekly-record-delete"
                  :aria-label="`删除 ${record.title}`"
                  title="删除周记录"
                  @click.stop="handleWeeklyDelete(record.id)"
                >
                  <GIcon name="delete" />
                </button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="weeklyDraft" class="model-section model-section-immersive">
          <div class="weekly-form-shell weekly-form-shell-immersive">
            <form class="weekly-form weekly-form-immersive" @submit.prevent="handleWeeklySave()">
              <div class="weekly-panel-head weekly-panel-head-compact">
                <div class="weekly-panel-side weekly-panel-side-start">
                  <button
                    type="button"
                    class="model-icon-button weekly-back-button"
                    aria-label="返回列表"
                    title="返回列表"
                    :disabled="state.isGeneratingReport"
                    @click="closeWeeklyEditor"
                  >
                    <GIcon name="return" />
                  </button>
                </div>

                <div class="weekly-panel-center">
                  <div class="weekly-panel-center-row">
                    <div class="weekly-editor-segmented" role="tablist" aria-label="任务笔记编辑视图">
                      <button
                        type="button"
                        class="weekly-editor-tab"
                        :class="{ 'is-active': state.editorView === 'projects' }"
                        :aria-selected="state.editorView === 'projects' ? 'true' : 'false'"
                        :disabled="state.isGeneratingReport"
                        @click="state.editorView = 'projects'"
                      >
                        项目推进
                      </button>
                      <button
                        type="button"
                        class="weekly-editor-tab"
                        :class="{ 'is-active': state.editorView === 'reporting' }"
                        :aria-selected="state.editorView === 'reporting' ? 'true' : 'false'"
                        :disabled="state.isGeneratingReport"
                        @click="state.editorView = 'reporting'"
                      >
                        汇报视图
                      </button>
                    </div>

                    <div class="weekly-panel-title-slot">
                      <p class="weekly-panel-title weekly-panel-title-centered">{{ weeklyDraft.title }}</p>
                      <span class="weekly-autosave-hint">自动保存</span>
                    </div>
                  </div>
                </div>

                <div class="weekly-panel-side weekly-panel-side-end">
                  <button
                    v-if="state.editorView === 'projects'"
                    type="button"
                    class="weekly-mini-action weekly-mini-action-primary"
                    :disabled="state.isGeneratingReport"
                    @click="addWeeklyProject"
                  >
                    新增项目
                  </button>
                </div>
              </div>

              <template v-if="state.editorView === 'projects'">
                <div class="weekly-editor-stage">
                  <section class="weekly-project-stack">
                    <template v-if="weeklyDraft.projects.length">
                      <section
                        v-for="project in weeklyDraft.projects"
                        :key="project.id"
                        class="weekly-project-card"
                        :class="{ 'is-collapsed': isWeeklyProjectCollapsed(project.id) }"
                      >
                        <div class="weekly-project-head">
                          <button
                            type="button"
                            class="weekly-project-toggle"
                            :aria-expanded="String(!isWeeklyProjectCollapsed(project.id))"
                            @click="toggleWeeklyProjectCollapsed(project.id)"
                          >
                            <span class="weekly-project-toggle-glyph">
                              {{ isWeeklyProjectCollapsed(project.id) ? "▸" : "▾" }}
                            </span>
                          </button>

                          <input
                            v-model="project.title"
                            class="field-input weekly-compact-input weekly-project-name-input"
                            type="text"
                            :data-weekly-project-input="project.id"
                            placeholder="输入项目名称"
                          />

                          <button type="button" class="weekly-row-action weekly-row-action-add" aria-label="新增任务" @click="addWeeklyTask(project.id)">
                            <GIcon name="add" />
                          </button>
                          <button
                            type="button"
                            class="weekly-row-action weekly-row-action-delete"
                            aria-label="删除项目"
                            title="删除项目"
                            @click="removeWeeklyProject(project.id)"
                          >
                            <GIcon name="delete" />
                          </button>
                        </div>

                        <div v-if="!isWeeklyProjectCollapsed(project.id)" class="weekly-project-body">
                          <WeeklyTaskTree
                            v-if="project.tasks.length"
                            :tasks="project.tasks"
                            :project-id="project.id"
                            :rewriting-ids="weeklyTaskRewriteIds"
                            :status-meta="WEEKLY_PROGRESS_STATUS_META"
                            :get-status-tone-class="getWeeklyStatusToneClass"
                            @add-child="addWeeklyTask($event.projectId, $event.taskId)"
                            @remove-task="removeWeeklyTask($event.projectId, $event.taskId)"
                            @set-status="setWeeklyTaskStatus($event.projectId, $event.taskId, $event.status, $event.event)"
                            @touch-task="touchWeeklyTaskById($event.projectId, $event.taskId)"
                            @optimize-task="optimizeWeeklyTaskTitle($event.projectId, $event.taskId, $event.event)"
                          />

                          <p v-else class="weekly-project-empty-copy weekly-project-empty-inline">暂无任务，点击右侧 + 直接新增。</p>
                        </div>
                      </section>
                    </template>

                    <div v-else class="weekly-editor-empty">
                      <p class="weekly-editor-empty-title">先新增一个项目，再在项目行里继续补任务。</p>
                      <button type="button" class="weekly-mini-action weekly-mini-action-primary" @click="addWeeklyProject">新增项目</button>
                    </div>
                  </section>
                </div>
              </template>

              <template v-else>
                <div class="weekly-report-stage" :class="{ 'is-locked': state.isGeneratingReport }" :aria-busy="state.isGeneratingReport ? 'true' : 'false'">
                  <section class="weekly-rail-card weekly-report-main-card">
                    <div class="weekly-report-toolbar">
                      <div class="weekly-report-mode-tabs" role="tablist" aria-label="汇报模式">
                        <button
                          type="button"
                          class="weekly-report-mode-tab"
                          :class="{ 'is-active': state.reportingMode === 'daily' }"
                          :aria-selected="state.reportingMode === 'daily' ? 'true' : 'false'"
                          :disabled="state.isGeneratingReport"
                          @click="setWeeklyReportingMode('daily')"
                        >
                          日报
                        </button>
                        <button
                          type="button"
                          class="weekly-report-mode-tab"
                          :class="{ 'is-active': state.reportingMode === 'weekly' }"
                          :aria-selected="state.reportingMode === 'weekly' ? 'true' : 'false'"
                          :disabled="state.isGeneratingReport"
                          @click="setWeeklyReportingMode('weekly')"
                        >
                          周报
                        </button>
                      </div>

                      <div class="weekly-report-toolbar-side">
                        <template v-if="weeklyIsWeeklyReportMode">
                          <button
                            type="button"
                            class="weekly-mini-action weekly-mini-action-primary"
                            :disabled="state.isGeneratingReport"
                            @click="addWeeklyReportTemplate"
                          >
                            新增模板
                          </button>
                          <button
                            type="button"
                            class="weekly-mini-action"
                            :disabled="state.isGeneratingReport || !weeklyCanDeleteSelectedReportTemplate"
                            @click="removeWeeklySelectedReportTemplate"
                          >
                            删除模板
                          </button>
                        </template>
                        <template v-else>
                          <label class="command-inline-toggle weekly-report-inline-toggle">
                            <span class="command-inline-toggle-label">使用大模型优化</span>
                            <input v-model="state.dailyReportUseModelOptimization" type="checkbox" />
                          </label>
                        </template>
                      </div>
                    </div>

                    <div v-if="weeklyIsWeeklyReportMode" class="weekly-template-toolbar">
                      <label class="field weekly-template-select-field">
                        <span class="field-label">{{ weeklyReportSelectorLabel }}</span>
                        <select
                          v-model="state.draft.selectedReportTemplateId"
                          class="field-input weekly-template-select"
                          :disabled="state.isGeneratingReport"
                          @change="handleWeeklyReportTemplateSelectionChange"
                        >
                          <option v-for="template in weeklyReportTemplates" :key="template.id" :value="template.id">
                            {{ getWeeklyReportTemplateOptionLabel(template) }}
                          </option>
                        </select>
                      </label>
                    </div>

                    <label v-if="weeklyIsWeeklyReportMode" class="field field-full">
                      <span class="field-label">{{ weeklyReportGuideLabel }}</span>
                      <textarea
                        v-model="weeklyReportGuideContent"
                        class="field-textarea weekly-textarea weekly-textarea-secondary"
                        :class="{ 'is-readonly': weeklyReportGuideReadonly }"
                        :readonly="weeklyReportGuideReadonly"
                        :placeholder="weeklyReportGuidePlaceholder"
                      ></textarea>
                    </label>

                    <div class="weekly-report-output-head">
                      <span class="field-label">{{ weeklyReportOutputLabel }}</span>
                      <div class="weekly-report-output-head-actions">
                        <div class="weekly-report-output-tabs" role="tablist" aria-label="输出视图">
                          <button
                            type="button"
                            class="weekly-report-output-tab"
                            :class="{ 'is-active': weeklyReportOutputMode === 'preview' }"
                            :aria-selected="weeklyReportOutputMode === 'preview' ? 'true' : 'false'"
                            :disabled="state.isGeneratingReport"
                            @click="setWeeklyReportOutputMode('preview')"
                          >
                            预览
                          </button>
                          <button
                            type="button"
                            class="weekly-report-output-tab"
                            :class="{ 'is-active': weeklyReportOutputMode === 'edit' }"
                            :aria-selected="weeklyReportOutputMode === 'edit' ? 'true' : 'false'"
                            :disabled="state.isGeneratingReport"
                            @click="setWeeklyReportOutputMode('edit')"
                          >
                            编辑
                          </button>
                        </div>
                        <button
                          type="button"
                          class="model-icon-button weekly-report-run-button"
                          :class="{ 'is-loading': weeklyActiveReportIsGenerating }"
                          :disabled="state.isGeneratingReport"
                          :title="weeklyReportRunButtonLabel"
                          :aria-label="weeklyReportRunButtonLabel"
                          @click="handleWeeklyActiveReportGeneration"
                        >
                          <span v-if="weeklyActiveReportIsGenerating" class="weekly-task-spinner" aria-hidden="true"></span>
                          <span v-else class="weekly-report-run-icon"><GIcon name="play" /></span>
                        </button>
                      </div>
                    </div>
                    <p class="weekly-report-feedback" :class="`is-${weeklyReportFeedbackTone}`">{{ weeklyReportFeedbackText }}</p>

                    <label class="field field-full weekly-report-output-field">
                      <button
                        type="button"
                        class="model-icon-button weekly-report-copy-button"
                        :class="{ 'is-copied': state.reportCopyState === 'copied' }"
                        :disabled="state.isGeneratingReport || !weeklyCanCopyReportOutput"
                        :title="weeklyReportCopyButtonLabel"
                        :aria-label="weeklyReportCopyButtonLabel"
                        @click="handleWeeklyReportOutputCopy"
                      >
                        <span class="weekly-report-run-icon"><GIcon :name="weeklyReportCopyIconKind" /></span>
                      </button>
                      <div
                        v-if="weeklyCanCopyReportOutput && weeklyReportOutputMode === 'preview'"
                        class="weekly-report-output-preview weekly-report-output-textarea weekly-report-rendered command-rich-text"
                        :class="{ 'is-readonly': state.isGeneratingReport }"
                        v-html="weeklyRenderedReportOutputHtml"
                        @click="handleRichTextClick"
                      ></div>
                      <textarea
                        v-else-if="weeklyReportOutputMode === 'edit'"
                        v-model="weeklyReportOutputContent"
                        class="field-textarea weekly-textarea weekly-textarea-report weekly-report-output-textarea"
                        :readonly="state.isGeneratingReport"
                        :class="{ 'is-readonly': state.isGeneratingReport }"
                        :placeholder="weeklyReportOutputPlaceholder"
                      ></textarea>
                      <div
                        v-else
                        class="weekly-report-output-preview weekly-report-output-placeholder weekly-report-output-textarea weekly-report-rendered is-placeholder"
                        :class="{ 'is-readonly': state.isGeneratingReport }"
                      >
                        <p class="weekly-report-placeholder-copy">{{ weeklyReportOutputPlaceholder }}</p>
                      </div>
                    </label>
                  </section>

                  <div class="weekly-report-support-grid">
                    <section class="weekly-rail-card">
                      <div class="weekly-rail-head">
                        <div>
                          <p class="feature-kicker">Quality Gate</p>
                          <p class="model-section-title">汇报质量</p>
                        </div>
                      </div>

                      <div class="weekly-quality-list">
                        <article
                          v-for="check in weeklyDraftInsights.qualityChecks"
                          :key="check.id"
                          class="weekly-quality-item"
                          :class="{ 'is-done': check.done }"
                        >
                          <span class="weekly-quality-mark">{{ check.done ? "OK" : "待补" }}</span>
                          <div class="weekly-quality-copy">
                            <p class="weekly-quality-title">{{ check.label }}</p>
                            <p class="weekly-quality-hint">{{ check.hint }}</p>
                          </div>
                        </article>
                      </div>
                    </section>

                    <section class="weekly-rail-card">
                      <div class="weekly-rail-head">
                        <div>
                          <p class="feature-kicker">Highlights</p>
                          <p class="model-section-title">本周可直接汇报</p>
                        </div>
                      </div>

                      <div v-if="weeklyDraftInsights.achievements.length" class="weekly-insight-list">
                        <article v-for="item in weeklyDraftInsights.achievements" :key="item.id" class="weekly-insight-item">
                          <p class="weekly-insight-title">{{ item.title }}</p>
                          <p class="weekly-insight-meta">{{ item.meta }}</p>
                          <p v-if="item.detail" class="weekly-insight-detail">{{ item.detail }}</p>
                        </article>
                      </div>

                      <div v-else class="weekly-rail-empty">
                        <p class="weekly-rail-empty-copy">还没识别到明确结果，建议先补“完成了什么 / 影响了什么”。</p>
                      </div>
                    </section>

                    <section class="weekly-rail-card">
                      <div class="weekly-rail-head">
                        <div>
                          <p class="feature-kicker">Risks</p>
                          <p class="model-section-title">风险与待协调</p>
                        </div>
                      </div>

                      <div v-if="weeklyDraftInsights.risks.length" class="weekly-insight-list">
                        <article v-for="item in weeklyDraftInsights.risks" :key="item.id" class="weekly-insight-item">
                          <p class="weekly-insight-title">{{ item.title }}</p>
                          <p class="weekly-insight-meta">{{ item.meta }}</p>
                          <p v-if="item.detail" class="weekly-insight-detail">{{ item.detail }}</p>
                        </article>
                      </div>

                      <div v-else class="weekly-rail-empty">
                        <p class="weekly-rail-empty-copy">还没有识别到风险项。如果当前无阻塞，建议明确写一句“当前暂无阻塞”。</p>
                      </div>
                    </section>

                    <section class="weekly-rail-card">
                      <div class="weekly-rail-head">
                        <div>
                          <p class="feature-kicker">Next Steps</p>
                          <p class="model-section-title">下周继续推进</p>
                        </div>
                      </div>

                      <div v-if="weeklyDraftInsights.nextSteps.length" class="weekly-insight-list">
                        <article v-for="item in weeklyDraftInsights.nextSteps" :key="item.id" class="weekly-insight-item">
                          <p class="weekly-insight-title">{{ item.title }}</p>
                          <p class="weekly-insight-meta">{{ item.meta }}</p>
                          <p v-if="item.detail" class="weekly-insight-detail">{{ item.detail }}</p>
                        </article>
                      </div>

                      <div v-else class="weekly-rail-empty">
                        <p class="weekly-rail-empty-copy">还没有识别到下周动作，建议给进行中的项目补 1 条下一步计划。</p>
                      </div>
                    </section>
                  </div>

                  <div v-if="state.isGeneratingReport" class="weekly-report-lock-layer" aria-hidden="true"></div>
                </div>
              </template>
            </form>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

import WeeklyTaskTree from "../../components/WeeklyTaskTree.vue";
import GIcon from "../../components/GIcon.vue";
import {
  WEEKLY_PROGRESS_STATUS_META,
  formatLocalDateTime,
  getWeeklyProgressCompletionRate,
  getWeeklyProgressMetrics,
  renderRichText
} from "../../lib/presenter.js";
import { DAILY_REPORT_GUIDE_COPY } from "./weeklyConfig.js";
import {
  buildWeeklyDraftInsights,
  getDailyReportHeadingTitle,
  getWeeklyRecordTags,
  getWeeklyReportTemplateOptionLabel,
  getWeeklySelectedReportTemplate,
  getWeeklyStatusToneClass,
  normalizeMarkdownForClipboard
} from "./weeklyRuntime.js";

const props = defineProps({
  state: { type: Object, required: true },
  weeklyProgress: { type: Array, default: () => [] },
  activeModel: { type: Object, default: null },
  weeklyTaskRewriteIds: { type: Array, default: () => [] },
  addWeeklyProject: { type: Function, required: true },
  addWeeklyReportTemplate: { type: Function, required: true },
  addWeeklyTask: { type: Function, required: true },
  closeWeeklyEditor: { type: Function, required: true },
  handleRichTextClick: { type: Function, required: true },
  handleWeeklyActiveReportGeneration: { type: Function, required: true },
  handleWeeklyDelete: { type: Function, required: true },
  handleWeeklyReportOutputCopy: { type: Function, required: true },
  handleWeeklyReportTemplateSelectionChange: { type: Function, required: true },
  handleWeeklySave: { type: Function, required: true },
  isWeeklyProjectCollapsed: { type: Function, required: true },
  openWeeklyRecord: { type: Function, required: true },
  optimizeWeeklyTaskTitle: { type: Function, required: true },
  removeWeeklyProject: { type: Function, required: true },
  removeWeeklySelectedReportTemplate: { type: Function, required: true },
  removeWeeklyTask: { type: Function, required: true },
  resetWeeklyReportCopyState: { type: Function, required: true },
  setWeeklyReportingMode: { type: Function, required: true },
  setWeeklyReportOutputMode: { type: Function, required: true },
  setWeeklyTaskStatus: { type: Function, required: true },
  toggleWeeklyProjectCollapsed: { type: Function, required: true },
  touchWeeklyTaskById: { type: Function, required: true }
});

const weeklyDraft = computed(() => props.state.draft);
const weeklyFocusRecord = computed(
  () => props.weeklyProgress.find((record) => record.status === "active") ?? props.weeklyProgress[0] ?? null
);
const weeklyFocusMetrics = computed(() => getWeeklyProgressMetrics(weeklyFocusRecord.value ?? { projects: [] }));
const weeklyFocusCompletionRate = computed(() => getWeeklyProgressCompletionRate(weeklyFocusRecord.value ?? { projects: [] }));
const weeklyListOverviewCards = computed(() => {
  const record = weeklyFocusRecord.value;
  const metrics = weeklyFocusMetrics.value;
  const hasGeneratedReport = Boolean(String(record?.generatedReport ?? "").trim());
  const reportMeta = record?.updatedAt ? `更新于 ${formatLocalDateTime(record.updatedAt)}` : "";

  return [
    {
      id: "project-count",
      label: "本周项目",
      value: `${metrics.projectCount}`
    },
    {
      id: "completion-rate",
      label: "任务完成率",
      value: `${weeklyFocusCompletionRate.value}%`
    },
    {
      id: "risk-count",
      label: "待协调事项",
      value: `${metrics.blockedTaskCount}`
    },
    {
      id: "report-status",
      label: "领导周报",
      value: hasGeneratedReport ? "已生成" : "待生成",
      meta: reportMeta,
      metaTone: reportMeta ? "success" : "neutral"
    }
  ];
});
const weeklyReportTemplates = computed(() => (Array.isArray(props.state.draft?.reportTemplates) ? props.state.draft.reportTemplates : []));
const weeklyIsWeeklyReportMode = computed(() => props.state.reportingMode !== "daily");
const weeklyReportModeLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "周报" : "日报"));
const weeklySelectedReportTemplate = computed(() => getWeeklySelectedReportTemplate(props.state.draft));
const weeklySelectedReportTemplateContent = computed({
  get: () => weeklySelectedReportTemplate.value?.content ?? "",
  set: (value) => {
    const template = weeklySelectedReportTemplate.value;

    if (!template || template.builtin) {
      return;
    }

    const nextContent = String(value ?? "");
    template.content = nextContent;

    if (props.state.draft) {
      props.state.draft.reportTemplate = nextContent;
    }
  }
});
const weeklyCanDeleteSelectedReportTemplate = computed(
  () => Boolean(weeklySelectedReportTemplate.value && !weeklySelectedReportTemplate.value.builtin && weeklyReportTemplates.value.length > 1)
);
const weeklyReportSelectorLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "模板列表" : "内容范围"));
const weeklyReportGuideLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "周报模板" : "日报规则"));
const weeklyReportGuidePlaceholder = computed(() =>
  weeklyIsWeeklyReportMode.value ? "在这里维护固定模板，生成周报时会严格按模板输出" : DAILY_REPORT_GUIDE_COPY
);
const weeklyReportGuideReadonly = computed(
  () => !weeklyIsWeeklyReportMode.value || Boolean(weeklySelectedReportTemplate.value?.builtin || props.state.isGeneratingReport)
);
const weeklyReportGuideContent = computed({
  get: () => (weeklyIsWeeklyReportMode.value ? weeklySelectedReportTemplateContent.value : DAILY_REPORT_GUIDE_COPY),
  set: (value) => {
    if (!weeklyIsWeeklyReportMode.value) {
      return;
    }

    weeklySelectedReportTemplateContent.value = value;
  }
});
const weeklyReportOutputLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "发送给领导的周报" : getDailyReportHeadingTitle()));
const weeklyReportOutputMode = computed(() => props.state.reportOutputMode === "edit" ? "edit" : "preview");
const weeklyReportOutputPlaceholder = computed(() =>
  weeklyIsWeeklyReportMode.value
    ? "点击右上角执行按钮后，会在这里填充周报结果，确认后再保存"
    : "点击右上角执行按钮后，会在这里填充今天有更新任务的日报结果"
);
const weeklyReportOutputContent = computed({
  get: () => (weeklyIsWeeklyReportMode.value ? props.state.draft?.generatedReport ?? "" : props.state.draft?.generatedDailyReport ?? ""),
  set: (value) => {
    if (!props.state.draft) {
      return;
    }

    if (weeklyIsWeeklyReportMode.value) {
      props.state.draft.generatedReport = String(value ?? "");
      props.resetWeeklyReportCopyState();
      return;
    }

    props.state.draft.generatedDailyReport = String(value ?? "");
    props.resetWeeklyReportCopyState();
  }
});
const weeklyActiveReportIsGenerating = computed(
  () => props.state.isGeneratingReport && props.state.generatingReportKind === (weeklyIsWeeklyReportMode.value ? "weekly" : "daily")
);
const weeklyReportRunButtonLabel = computed(() =>
  weeklyActiveReportIsGenerating.value ? `${weeklyReportModeLabel.value}生成中` : `生成${weeklyReportModeLabel.value}`
);
const weeklyReportFeedbackText = computed(() => {
  const customText = String(props.state.reportFeedbackText ?? "").trim();

  if (customText) {
    return customText;
  }

  return weeklyIsWeeklyReportMode.value
    ? "按当前模板生成周报输出。"
    : props.state.dailyReportUseModelOptimization
      ? "先提取今天更新的任务树，再交给大模型做轻量润色；若层级校验失败会回退基础稿。"
      : "仅提取今天有更新的任务树，并严格保留原父子层级。";
});
const weeklyReportFeedbackTone = computed(() => {
  const tone = String(props.state.reportFeedbackTone ?? "").trim();
  return tone || "neutral";
});
const weeklyCanCopyReportOutput = computed(() => Boolean(String(weeklyReportOutputContent.value ?? "").trim()));
const weeklyNormalizedReportOutputContent = computed(() => normalizeMarkdownForClipboard(weeklyReportOutputContent.value));
const weeklyRenderedReportOutputHtml = computed(() => renderRichText(weeklyNormalizedReportOutputContent.value));
const weeklyReportCopyIconKind = computed(() => (props.state.reportCopyState === "copied" ? "check" : "copy"));
const weeklyReportCopyButtonLabel = computed(() =>
  props.state.reportCopyState === "copied"
    ? `${weeklyReportModeLabel.value}已复制`
    : weeklyCanCopyReportOutput.value
      ? `复制${weeklyReportModeLabel.value}`
      : `当前没有可复制的${weeklyReportModeLabel.value}内容`
);
const weeklyDraftInsights = computed(() => buildWeeklyDraftInsights(props.state.draft));

function getWeeklyRecordHasContent(record) {
  const metrics = getWeeklyProgressMetrics(record);

  return Boolean(
    metrics.projectCount ||
    metrics.taskCount ||
    metrics.noteCount ||
    String(record?.generatedReport ?? "").trim()
  );
}
</script>
