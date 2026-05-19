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

            <div v-if="weeklyYearOptions.length" class="model-section-actions weekly-year-filter" role="group" aria-label="按年份筛选周报">
              <button
                v-for="yearOption in weeklyYearOptions"
                :key="yearOption.year"
                type="button"
                class="weekly-year-chip"
                :class="{ 'is-active': weeklyActiveYear === yearOption.year }"
                :aria-pressed="weeklyActiveYear === yearOption.year ? 'true' : 'false'"
                @click="setWeeklyYearFilter(yearOption.year)"
              >
                <span>{{ yearOption.year }}</span>
                <small>{{ yearOption.count }}</small>
              </button>
            </div>
          </div>

          <div class="model-section-body model-configured-list weekly-record-list">
            <div v-if="!weeklyProgress.length" class="model-empty">
              <p class="model-empty-copy">当前还没有周记录，首次进入时会自动创建本周空白计划。</p>
            </div>

            <article
              v-for="record in weeklyVisibleRecords"
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
                  </div>
                </div>

                <div class="weekly-panel-title-slot">
                  <p class="weekly-panel-title weekly-panel-title-centered">{{ weeklyDraft.title }}</p>
                  <span class="weekly-autosave-hint">自动保存</span>
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
                  <button
                    v-else
                    type="button"
                    class="weekly-panel-settings-button"
                    :class="{ 'is-configured': weeklyHasFeishuWebhook }"
                    aria-label="飞书群设置"
                    title="飞书群设置"
                    @click="openWeeklyFeishuSettingsDialog"
                  >
                    <GIcon name="settings" :size="13" />
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
                          <GCompactSelect
                            v-model="state.draft.selectedReportTemplateId"
                            class="weekly-template-select"
                            aria-label="周报模板"
                            :disabled="state.isGeneratingReport"
                            :options="weeklyReportTemplateOptions"
                            @change="handleWeeklyReportTemplateSelectionChange"
                          />
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

                    <section
                      v-if="weeklyIsWeeklyReportMode"
                      class="weekly-template-editor-card"
                      :class="{
                        'is-collapsed': state.isReportTemplateCollapsed,
                        'is-ai-open': weeklyReportTemplateAiState.isOpen
                      }"
                    >
                      <div class="weekly-template-editor-head">
                        <button
                          type="button"
                          class="weekly-template-collapse-button"
                          :aria-expanded="state.isReportTemplateCollapsed ? 'false' : 'true'"
                          aria-controls="weekly-report-template-editor"
                          @click="toggleWeeklyReportTemplateCollapsed"
                        >
                          <GIcon :name="state.isReportTemplateCollapsed ? 'chevronDown' : 'chevronUp'" />
                          <span>{{ weeklyReportGuideLabel }}</span>
                          <small>{{ weeklyReportTemplateMetaLabel }}</small>
                        </button>

                        <div class="weekly-template-editor-actions">
                          <div class="weekly-template-ai-control">
                            <button
                              type="button"
                              class="field-ai-trigger weekly-template-ai-trigger"
                              :class="{ 'is-active': weeklyReportTemplateAiState.isOpen }"
                              :disabled="state.isGeneratingReport"
                              :aria-label="weeklyReportTemplateAiButtonLabel"
                              :title="weeklyReportTemplateAiButtonTitle"
                              @click.stop="weeklyReportTemplateAiState.isOpen ? closeWeeklyReportTemplateAi() : openWeeklyReportTemplateAi()"
                            >
                              <GIcon
                                :name="weeklyReportTemplateAiState.isGenerating ? 'loading' : 'sparkles'"
                                :spin="weeklyReportTemplateAiState.isGenerating"
                                :size="13"
                              />
                            </button>

                            <Transition name="field-ai-popover">
                              <section
                                v-if="weeklyReportTemplateAiState.isOpen"
                                class="field-ai-popover weekly-template-ai-popover"
                                role="dialog"
                                aria-label="周报模板 AI 优化"
                                @click.stop
                              >
                                <div class="field-ai-head">
                                  <div class="field-ai-title">
                                    <p>AI Copilot</p>
                                    <strong>周报模板</strong>
                                  </div>
                                  <button type="button" class="field-ai-close" aria-label="关闭优化" title="关闭" @click="closeWeeklyReportTemplateAi">
                                    <GIcon name="close" :size="13" />
                                  </button>
                                </div>

                                <textarea
                                  class="field-ai-input"
                                  :value="weeklyReportTemplateAiState.instruction"
                                  placeholder="例如：更紧凑、保留项目层级、强调风险和下周动作"
                                  :disabled="weeklyReportTemplateAiState.isGenerating"
                                  @input="setWeeklyReportTemplateAiInstruction($event.target.value)"
                                ></textarea>

                                <textarea
                                  v-if="weeklyReportTemplateAiState.output || weeklyReportTemplateAiState.isGenerating"
                                  class="field-ai-output"
                                  :value="weeklyReportTemplateAiState.output"
                                  placeholder="优化后的模板会出现在这里"
                                  :disabled="weeklyReportTemplateAiState.isGenerating"
                                  @input="setWeeklyReportTemplateAiOutput($event.target.value)"
                                ></textarea>

                                <p
                                  v-if="weeklyReportTemplateAiState.feedback"
                                  class="field-ai-feedback"
                                  :class="getWeeklyReportTemplateAiFeedbackClass()"
                                  role="status"
                                >
                                  {{ weeklyReportTemplateAiState.feedback }}
                                </p>

                                <div class="field-ai-action-row">
                                  <div class="field-ai-action-left">
                                    <button
                                      type="button"
                                      class="field-ai-run"
                                      :disabled="weeklyReportTemplateAiState.isGenerating"
                                      @click="generateWeeklyReportTemplateAiOutput"
                                    >
                                      <GIcon
                                        :name="weeklyReportTemplateAiState.isGenerating ? 'loading' : 'sparkles'"
                                        :spin="weeklyReportTemplateAiState.isGenerating"
                                        :size="13"
                                      />
                                      {{ weeklyReportTemplateAiState.isGenerating ? "生成中" : "生成" }}
                                    </button>
                                    <button
                                      v-if="weeklyReportTemplateAiState.isGenerating"
                                      type="button"
                                      class="field-ai-ghost"
                                      @click="cancelWeeklyReportTemplateAiRun"
                                    >
                                      停止
                                    </button>
                                  </div>

                                  <div class="field-ai-action-right">
                                    <button
                                      type="button"
                                      class="field-ai-ghost"
                                      :disabled="weeklyReportTemplateAiState.isGenerating || !weeklyReportTemplateAiState.output"
                                      @click="applyWeeklyReportTemplateAiOutput('append')"
                                    >
                                      追加
                                    </button>
                                    <button
                                      type="button"
                                      class="field-ai-primary"
                                      :disabled="weeklyReportTemplateAiState.isGenerating || !weeklyReportTemplateAiState.output"
                                      @click="applyWeeklyReportTemplateAiOutput('replace')"
                                    >
                                      替换
                                    </button>
                                  </div>
                                </div>
                              </section>
                            </Transition>
                          </div>
                        </div>
                      </div>

                      <Transition name="weekly-template-editor-body">
                        <div
                          v-if="!state.isReportTemplateCollapsed"
                          id="weekly-report-template-editor"
                          class="weekly-template-editor-body"
                        >
                          <textarea
                            v-model="weeklyReportGuideContent"
                            class="field-textarea weekly-textarea weekly-textarea-secondary weekly-template-editor-textarea"
                            :class="{ 'is-readonly': weeklyReportGuideReadonly }"
                            :readonly="weeklyReportGuideReadonly"
                            :placeholder="weeklyReportGuidePlaceholder"
                          ></textarea>
                        </div>
                      </Transition>
                    </section>

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
                        <button
                          v-if="!weeklyIsWeeklyReportMode"
                          type="button"
                          class="model-icon-button weekly-report-share-button"
                          :class="{ 'is-sent': state.dailyReportShareState === 'sent', 'is-loading': state.isSendingDailyReport }"
                          :disabled="state.isGeneratingReport || state.isSendingDailyReport || !weeklyCanShareDailyReport"
                          :title="weeklyReportShareButtonLabel"
                          :aria-label="weeklyReportShareButtonLabel"
                          @click="handleWeeklyDailyReportShare"
                        >
                          <span v-if="state.isSendingDailyReport" class="weekly-task-spinner" aria-hidden="true"></span>
                          <span v-else class="weekly-report-run-icon"><GIcon :name="weeklyReportShareIconKind" /></span>
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

                  <section class="weekly-rail-card weekly-report-summary-card">
                    <div class="weekly-report-summary-head">
                      <div>
                        <p class="feature-kicker">Report Digest</p>
                        <p class="model-section-title">汇报摘要</p>
                      </div>
                      <span class="weekly-report-summary-score">
                        {{ weeklyInsightDoneCount }}/{{ weeklyDraftInsights.qualityChecks.length }} 项已就绪
                      </span>
                    </div>

                    <div class="weekly-report-summary-tabs" role="tablist" aria-label="汇报摘要分类">
                      <button
                        v-for="tab in weeklyInsightTabs"
                        :id="`weekly-report-summary-tab-${tab.id}`"
                        :key="tab.id"
                        type="button"
                        class="weekly-report-summary-tab"
                        :class="{ 'is-active': weeklyInsightActiveTab === tab.id }"
                        role="tab"
                        :aria-selected="weeklyInsightActiveTab === tab.id ? 'true' : 'false'"
                        :aria-controls="`weekly-report-summary-panel-${tab.id}`"
                        @click="weeklyInsightActiveTab = tab.id"
                      >
                        <span class="weekly-report-summary-tab-label">{{ tab.label }}</span>
                        <span class="weekly-report-summary-tab-meta">{{ tab.meta }}</span>
                      </button>
                    </div>

                    <div
                      :id="`weekly-report-summary-panel-${weeklyInsightActiveTab}`"
                      class="weekly-report-summary-body"
                      role="tabpanel"
                      :aria-labelledby="`weekly-report-summary-tab-${weeklyInsightActiveTab}`"
                    >
                      <div v-if="weeklyInsightActiveTab === 'quality'" class="weekly-quality-compact-list">
                        <article
                          v-for="check in weeklyDraftInsights.qualityChecks"
                          :key="check.id"
                          class="weekly-quality-compact-item"
                          :class="{ 'is-done': check.done }"
                        >
                          <span class="weekly-quality-compact-mark">
                            <GIcon :name="check.done ? 'check' : 'circleAlert'" />
                          </span>
                          <div class="weekly-quality-copy">
                            <p class="weekly-quality-title">{{ check.label }}</p>
                            <p class="weekly-quality-hint">{{ check.hint }}</p>
                          </div>
                        </article>
                      </div>

                      <div v-else-if="weeklyActiveInsightItems.length" class="weekly-insight-compact-list">
                        <article v-for="(item, index) in weeklyActiveInsightItems" :key="item.id" class="weekly-insight-compact-item">
                          <span class="weekly-insight-compact-index">{{ index + 1 }}</span>
                          <div class="weekly-insight-compact-copy">
                            <p class="weekly-insight-title weekly-insight-compact-title">{{ item.title }}</p>
                            <div class="weekly-insight-compact-meta-row">
                              <span class="weekly-insight-meta">{{ item.meta }}</span>
                            </div>
                            <p v-if="item.detail" class="weekly-insight-detail weekly-insight-compact-detail">{{ item.detail }}</p>
                          </div>
                        </article>
                      </div>

                      <div v-else class="weekly-rail-empty weekly-report-summary-empty">
                        <p class="weekly-rail-empty-copy">{{ weeklyActiveInsightEmptyCopy }}</p>
                      </div>
                    </div>
                  </section>

                  <div v-if="state.isGeneratingReport" class="weekly-report-lock-layer" aria-hidden="true"></div>
                </div>
              </template>
            </form>
          </div>
        </section>
      </div>
    </div>

    <Transition name="gordon-dialog-fade">
      <div
        v-if="state.isFeishuSettingsDialogOpen"
        class="gordon-dialog-backdrop weekly-feishu-backdrop"
        @click.self="closeWeeklyFeishuSettingsDialog"
      >
        <section class="gordon-dialog weekly-feishu-dialog" role="dialog" aria-modal="true" aria-label="飞书群设置">
          <div class="gordon-dialog-head">
            <div class="gordon-dialog-mark weekly-feishu-mark" aria-hidden="true">
              <GIcon name="share" :size="15" />
            </div>

            <div>
              <p class="gordon-dialog-kicker">Feishu</p>
              <h2 class="gordon-dialog-title">飞书群设置</h2>
            </div>
          </div>

          <p class="gordon-dialog-message">配置群机器人后，日报可以从汇报视图直接发送到飞书群。</p>

          <div class="weekly-feishu-panel">
            <label class="gordon-dialog-field weekly-feishu-field">
              <span class="gordon-dialog-field-label">Webhook</span>
              <input
                class="gordon-dialog-input"
                type="text"
                :value="state.feishuSettingsDraft.webhookUrl"
                :disabled="state.isFeishuSettingsLoading || state.isFeishuSettingsSaving"
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                @input="setWeeklyFeishuSettingsDraftField('webhookUrl', $event.target.value)"
              />
            </label>

            <label class="gordon-dialog-field weekly-feishu-field">
              <span class="gordon-dialog-field-label">签名密钥</span>
              <input
                class="gordon-dialog-input"
                type="password"
                :value="state.feishuSettingsDraft.secret"
                :disabled="state.isFeishuSettingsLoading || state.isFeishuSettingsSaving"
                placeholder="可选"
                @input="setWeeklyFeishuSettingsDraftField('secret', $event.target.value)"
              />
            </label>

            <label class="gordon-dialog-field weekly-feishu-field">
              <span class="gordon-dialog-field-label">标题前缀</span>
              <input
                class="gordon-dialog-input"
                type="text"
                :value="state.feishuSettingsDraft.titlePrefix"
                :disabled="state.isFeishuSettingsLoading || state.isFeishuSettingsSaving"
                placeholder="Gordon 日报"
                @input="setWeeklyFeishuSettingsDraftField('titlePrefix', $event.target.value)"
              />
            </label>

            <div class="writing-export-summary weekly-feishu-summary">
              <span>{{ weeklyFeishuSettingsStatusText }}</span>
              <span>{{ weeklyFeishuSecretStatusText }}</span>
            </div>
          </div>

          <p
            v-if="state.feishuSettingsFeedback"
            class="writing-export-feedback"
            :class="`is-${state.feishuSettingsFeedbackTone}`"
          >
            {{ state.feishuSettingsFeedback }}
          </p>

          <div class="gordon-dialog-actions">
            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              :disabled="state.isFeishuSettingsSaving"
              @click="closeWeeklyFeishuSettingsDialog"
            >
              取消
            </button>

            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-primary"
              :disabled="state.isFeishuSettingsLoading || state.isFeishuSettingsSaving"
              @click="saveWeeklyFeishuSettingsFromDialog"
            >
              {{ state.isFeishuSettingsSaving ? "保存中" : "保存" }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

import GCompactSelect from "../../components/GCompactSelect.vue";
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
  applyWeeklyReportTemplateAiOutput: { type: Function, required: true },
  cancelWeeklyReportTemplateAiRun: { type: Function, required: true },
  closeWeeklyEditor: { type: Function, required: true },
  closeWeeklyFeishuSettingsDialog: { type: Function, required: true },
  closeWeeklyReportTemplateAi: { type: Function, required: true },
  generateWeeklyReportTemplateAiOutput: { type: Function, required: true },
  getWeeklyReportTemplateAiFeedbackClass: { type: Function, required: true },
  handleRichTextClick: { type: Function, required: true },
  handleWeeklyActiveReportGeneration: { type: Function, required: true },
  handleWeeklyDailyReportShare: { type: Function, required: true },
  handleWeeklyDelete: { type: Function, required: true },
  handleWeeklyReportOutputCopy: { type: Function, required: true },
  handleWeeklyReportTemplateSelectionChange: { type: Function, required: true },
  handleWeeklySave: { type: Function, required: true },
  isWeeklyProjectCollapsed: { type: Function, required: true },
  openWeeklyFeishuSettingsDialog: { type: Function, required: true },
  openWeeklyRecord: { type: Function, required: true },
  optimizeWeeklyTaskTitle: { type: Function, required: true },
  removeWeeklyProject: { type: Function, required: true },
  removeWeeklySelectedReportTemplate: { type: Function, required: true },
  removeWeeklyTask: { type: Function, required: true },
  resetWeeklyReportCopyState: { type: Function, required: true },
  resetWeeklyReportShareState: { type: Function, required: true },
  saveWeeklyFeishuSettingsFromDialog: { type: Function, required: true },
  setWeeklyFeishuSettingsDraftField: { type: Function, required: true },
  setWeeklyReportTemplateAiInstruction: { type: Function, required: true },
  setWeeklyReportTemplateAiOutput: { type: Function, required: true },
  setWeeklyReportingMode: { type: Function, required: true },
  setWeeklyReportOutputMode: { type: Function, required: true },
  setWeeklyTaskStatus: { type: Function, required: true },
  toggleWeeklyReportTemplateCollapsed: { type: Function, required: true },
  toggleWeeklyProjectCollapsed: { type: Function, required: true },
  touchWeeklyTaskById: { type: Function, required: true }
});

const weeklyDraft = computed(() => props.state.draft);
const weeklySelectedYear = ref("");

function getWeeklyRecordYear(record) {
  const rawDate = String(record?.weekKey ?? record?.startDate ?? record?.createdAt ?? "").trim();
  const directYear = rawDate.match(/^\d{4}/)?.[0];

  if (directYear) {
    return directYear;
  }

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return String(date.getFullYear());
}

const weeklyFocusRecord = computed(
  () => props.weeklyProgress.find((record) => record.status === "active") ?? props.weeklyProgress[0] ?? null
);
const weeklyYearOptions = computed(() => {
  const yearCounts = new Map();

  props.weeklyProgress.forEach((record) => {
    const year = getWeeklyRecordYear(record);

    if (!year) {
      return;
    }

    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
  });

  return Array.from(yearCounts.entries())
    .sort(([leftYear], [rightYear]) => rightYear.localeCompare(leftYear))
    .map(([year, count]) => ({ year, count }));
});
const weeklyActiveYear = computed(() => {
  const availableYears = weeklyYearOptions.value.map((option) => option.year);

  if (weeklySelectedYear.value && availableYears.includes(weeklySelectedYear.value)) {
    return weeklySelectedYear.value;
  }

  return availableYears[0] ?? "";
});
const weeklyVisibleRecords = computed(() => {
  if (!weeklyActiveYear.value) {
    return props.weeklyProgress;
  }

  return props.weeklyProgress.filter((record) => getWeeklyRecordYear(record) === weeklyActiveYear.value);
});
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
      label: "周报结果",
      value: hasGeneratedReport ? "已生成" : "待生成",
      meta: reportMeta,
      metaTone: reportMeta ? "success" : "neutral"
    }
  ];
});
const weeklyReportTemplates = computed(() => (Array.isArray(props.state.draft?.reportTemplates) ? props.state.draft.reportTemplates : []));
const weeklyReportTemplateOptions = computed(() =>
  weeklyReportTemplates.value.map((template) => ({
    label: getWeeklyReportTemplateOptionLabel(template),
    value: template.id
  }))
);
const weeklyIsWeeklyReportMode = computed(() => props.state.reportingMode !== "daily");
const weeklyReportModeLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "周报" : "日报"));
const weeklySelectedReportTemplate = computed(() => getWeeklySelectedReportTemplate(props.state.draft));
const weeklyReportTemplateAiState = computed(
  () =>
    props.state.reportTemplateAi ?? {
      isOpen: false,
      isGenerating: false,
      requestId: "",
      instruction: "",
      output: "",
      feedback: "",
      feedbackTone: "neutral"
    }
);
const weeklyReportTemplateMetaLabel = computed(() => {
  const template = weeklySelectedReportTemplate.value;
  const name = String(template?.name ?? "").trim() || "未命名模板";
  const typeLabel = template?.builtin ? "内置模板" : "自定义模板";

  return `${name} · ${typeLabel}`;
});
const weeklyReportTemplateAiButtonLabel = computed(() =>
  weeklyReportTemplateAiState.value.isOpen ? "关闭周报模板优化" : "优化周报模板"
);
const weeklyReportTemplateAiButtonTitle = computed(() =>
  weeklyReportTemplateAiState.value.isOpen ? "关闭优化" : "AI 优化"
);

function setWeeklyYearFilter(year) {
  weeklySelectedYear.value = String(year ?? "");
}

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
const weeklyReportOutputLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "周报结果" : getDailyReportHeadingTitle()));
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
      props.resetWeeklyReportShareState();
      return;
    }

    props.state.draft.generatedDailyReport = String(value ?? "");
    props.resetWeeklyReportCopyState();
    props.resetWeeklyReportShareState();
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
const weeklyCanShareDailyReport = computed(
  () => !weeklyIsWeeklyReportMode.value && Boolean(String(props.state.draft?.generatedDailyReport ?? "").trim())
);
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
const weeklyReportShareIconKind = computed(() => (props.state.dailyReportShareState === "sent" ? "check" : "share"));
const weeklyReportShareButtonLabel = computed(() => {
  if (props.state.isSendingDailyReport) {
    return "正在发送日报到飞书群";
  }

  if (props.state.dailyReportShareState === "sent") {
    return "日报已发送到飞书群";
  }

  return weeklyCanShareDailyReport.value ? "发送日报到飞书群" : "当前没有可发送的日报内容";
});
const weeklyHasFeishuWebhook = computed(() => Boolean(String(props.state.feishuSettings?.webhookUrl ?? "").trim()));
const weeklyFeishuDraftHasWebhook = computed(() => Boolean(String(props.state.feishuSettingsDraft?.webhookUrl ?? "").trim()));
const weeklyFeishuSettingsStatusText = computed(() => (weeklyFeishuDraftHasWebhook.value ? "Webhook 已填写" : "Webhook 未配置"));
const weeklyFeishuSecretStatusText = computed(() =>
  String(props.state.feishuSettingsDraft?.secret ?? "").trim() ? "签名校验已启用" : "未启用签名校验"
);
const weeklyDraftInsights = computed(() => buildWeeklyDraftInsights(props.state.draft));
const weeklyInsightActiveTab = ref("quality");
const weeklyInsightDoneCount = computed(() => weeklyDraftInsights.value.qualityChecks.filter((check) => check.done).length);
const weeklyInsightTabs = computed(() => {
  const insights = weeklyDraftInsights.value;
  const qualityTotal = insights.qualityChecks.length;

  return [
    {
      id: "quality",
      label: "质量",
      meta: `${weeklyInsightDoneCount.value}/${qualityTotal}`
    },
    {
      id: "achievements",
      label: "结果",
      meta: `${insights.achievements.length} 条`
    },
    {
      id: "risks",
      label: "风险",
      meta: `${insights.risks.length} 条`
    },
    {
      id: "nextSteps",
      label: "下周",
      meta: `${insights.nextSteps.length} 条`
    }
  ];
});
const weeklyActiveInsightItems = computed(() => {
  const insights = weeklyDraftInsights.value;

  if (weeklyInsightActiveTab.value === "achievements") {
    return insights.achievements;
  }

  if (weeklyInsightActiveTab.value === "risks") {
    return insights.risks;
  }

  if (weeklyInsightActiveTab.value === "nextSteps") {
    return insights.nextSteps;
  }

  return [];
});
const weeklyActiveInsightEmptyCopy = computed(() => {
  if (weeklyInsightActiveTab.value === "achievements") {
    return "还没识别到明确结果，建议先补“完成了什么 / 影响了什么”。";
  }

  if (weeklyInsightActiveTab.value === "risks") {
    return "还没有识别到风险项。如果当前无阻塞，建议明确写一句“当前暂无阻塞”。";
  }

  if (weeklyInsightActiveTab.value === "nextSteps") {
    return "还没有识别到下周动作，建议给进行中的项目补 1 条下一步计划。";
  }

  return "";
});

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
