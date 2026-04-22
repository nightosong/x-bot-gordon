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
                <h1 class="brand-title" data-text="Gordon">Gordon</h1>
              </div>
            </div>

            <details
              ref="homeSettingsMenuRef"
              class="home-settings-menu"
              :class="{ 'has-active-selection': isHomeSettingsFeature(activeFeature) }"
            >
              <summary aria-label="打开设置菜单">
                <svg class="home-settings-trigger-gear" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.04 7.04 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22l-1.92 3.32a.5.5 0 0 0 .12.64L4.86 11c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
                    fill="currentColor"
                  ></path>
                </svg>
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
            <div class="workspace-stage workspace-stage-scroll">
              <div class="models-shell">
                <section v-if="ui.modelManagement.view === 'list'" class="models-hero">
                  <div>
                    <p class="feature-kicker">Model Management</p>
                    <p class="models-title">模型管理</p>
                  </div>
                  <span class="status-pill models-badge">
                    {{ workbench.modelSettings.activeProfileId ? "当前已有优先模型" : "尚未设置优先模型" }}
                  </span>
                </section>

                <div class="models-grid models-grid-single">
                  <section v-if="ui.modelManagement.view === 'list'" class="model-section">
                    <div class="model-section-head">
                      <div>
                        <p class="feature-kicker">Configured</p>
                        <p class="model-section-title">已配置列表</p>
                      </div>

                      <div class="model-section-actions">
                        <span class="pill pill-neutral">{{ workbench.modelSettings.profiles.length }} 条配置</span>
                        <button type="button" class="model-action" @click="openModelCreatePicker">添加新配置</button>
                      </div>
                    </div>

                    <div class="model-section-body model-configured-list">
                      <div v-if="!workbench.modelSettings.profiles.length" class="model-empty">
                        <p class="model-empty-copy">
                          当前还没有任何已配置模型。先在右侧选择供应商并保存一条配置，之后就能在这里启用或编辑。
                        </p>
                      </div>

                      <article v-for="profile in workbench.modelSettings.profiles" :key="profile.id" class="model-config-card">
                        <div class="model-config-head">
                          <div class="model-config-main">
                            <div
                              class="provider-avatar"
                              :class="[
                                { 'has-logo': Boolean(getProviderMeta(profile.provider).logo) },
                                `is-provider-${profile.provider.replaceAll('_', '-')}`
                              ]"
                              aria-hidden="true"
                            >
                              <img
                                v-if="getProviderMeta(profile.provider).logo"
                                class="provider-avatar-image"
                                :src="getProviderMeta(profile.provider).logo"
                                alt=""
                                loading="lazy"
                                decoding="async"
                              />
                              <template v-else>{{ getProviderMeta(profile.provider).short }}</template>
                            </div>

                            <div>
                              <p class="model-card-title">{{ profile.displayName }}</p>
                              <p class="model-card-meta">{{ getProviderMeta(profile.provider).label }} / {{ profile.model }}</p>
                            </div>
                          </div>

                          <div class="model-card-actions model-card-actions-inline">
                            <span v-if="workbench.modelSettings.activeProfileId === profile.id" class="model-priority-tag">优先使用</span>

                            <button
                              type="button"
                              class="model-icon-button"
                              :aria-label="`编辑 ${profile.displayName}`"
                              title="编辑"
                              @click="openModelEditor(profile)"
                              v-html="renderActionIcon('edit')"
                            ></button>

                            <button
                              type="button"
                              class="model-status-toggle"
                              :class="{ 'is-active': workbench.modelSettings.activeProfileId === profile.id }"
                              :aria-pressed="workbench.modelSettings.activeProfileId === profile.id ? 'true' : 'false'"
                              @click="handleModelStatusToggle(profile.id)"
                            >
                              {{ workbench.modelSettings.activeProfileId === profile.id ? "已启用" : "未启用" }}
                            </button>

                            <button
                              type="button"
                              class="model-icon-button model-icon-button-danger"
                              :aria-label="`删除 ${profile.displayName}`"
                              title="删除"
                              @click="handleModelDelete(profile.id)"
                              v-html="renderActionIcon('delete')"
                            ></button>
                          </div>
                        </div>

                        <p v-if="profile.notes" class="model-card-copy">{{ profile.notes }}</p>
                      </article>
                    </div>
                  </section>

                  <section v-else-if="ui.modelManagement.view === 'picker'" class="model-section">
                    <div class="model-editor model-editor-compact">
                      <div class="model-section-head model-section-head-leading model-section-head-picker">
                        <div class="model-section-head-start">
                          <button
                            type="button"
                            class="model-icon-button weekly-back-button"
                            aria-label="返回列表"
                            title="返回列表"
                            @click="backModelManagement"
                            v-html="renderActionIcon('return')"
                          ></button>
                        </div>

                        <div class="model-section-title-block model-section-title-block-centered">
                          <p class="feature-kicker">Provider</p>
                          <p class="model-section-title">选择供应商</p>
                        </div>

                        <span class="model-section-head-spacer" aria-hidden="true"></span>
                      </div>

                      <div class="provider-picker-grid">
                        <button
                          v-for="provider in providerOptions"
                          :key="provider.kind"
                          type="button"
                          class="provider-picker-card"
                          @click="selectModelProvider(provider.kind)"
                        >
                          <div
                            class="provider-avatar"
                            :class="[
                              { 'has-logo': Boolean(getProviderMeta(provider.kind).logo) },
                              `is-provider-${provider.kind.replaceAll('_', '-')}`
                            ]"
                            aria-hidden="true"
                          >
                            <img
                              v-if="getProviderMeta(provider.kind).logo"
                              class="provider-avatar-image"
                              :src="getProviderMeta(provider.kind).logo"
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                            <template v-else>{{ getProviderMeta(provider.kind).short }}</template>
                          </div>

                          <span class="provider-picker-name">{{ provider.label }}</span>
                        </button>
                      </div>
                    </div>
                  </section>

                  <section v-else class="model-section model-section-scroll">
                    <div class="model-editor">
                      <div class="model-section-head model-section-head-leading model-section-head-editor">
                        <div class="model-section-head-start">
                          <button
                            type="button"
                            class="model-icon-button weekly-back-button"
                            aria-label="返回列表"
                            title="返回列表"
                            @click="backModelManagement"
                            v-html="renderActionIcon('return')"
                          ></button>
                        </div>

                        <div class="model-section-title-block model-section-title-block-centered">
                          <p class="feature-kicker">Configuration</p>
                          <p class="model-section-title">编辑配置</p>
                        </div>

                        <div class="model-section-actions model-section-actions-end">
                          <span class="pill pill-neutral">{{ getProviderMeta(ui.modelManagement.editor.provider).label }}</span>
                        </div>
                      </div>

                      <form class="model-form" @submit.prevent="handleModelEditorSave">
                        <template v-for="field in modelEditorFields" :key="field.key">
                          <label class="field" :class="{ 'field-full': field.full }">
                            <span class="field-label">{{ field.label }}</span>

                            <textarea
                              v-if="field.textarea"
                              v-model="ui.modelManagement.editor.values[field.key]"
                              class="field-textarea"
                              :placeholder="field.placeholder"
                            ></textarea>

                            <input
                              v-else
                              v-model="ui.modelManagement.editor.values[field.key]"
                              class="field-input"
                              :placeholder="field.placeholder"
                              :required="field.required"
                            />
                          </label>
                        </template>

                        <div class="field field-full">
                          <span class="field-label">热门模型参考</span>
                          <div class="popular-models">
                            <button
                              v-for="model in getProviderMeta(ui.modelManagement.editor.provider).popularModels"
                              :key="model"
                              type="button"
                              class="popular-chip"
                              @click="ui.modelManagement.editor.values.model = model"
                            >
                              {{ model }}
                            </button>
                          </div>
                          <p class="field-hint">后续这里也可以继续扩成真正的模型市场与推荐列表。</p>
                        </div>

                        <div class="form-actions">
                          <button type="button" class="model-action-secondary" @click="backModelManagement">取消</button>
                          <button type="submit" class="model-action">保存配置</button>
                        </div>
                      </form>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeFeature === FEATURE_TASKS">
            <div class="workspace-stage workspace-stage-scroll" :class="{ 'workspace-stage-flush': ui.weekly.view === 'editor' }">
              <div class="weekly-shell" :class="{ 'weekly-shell-editor': ui.weekly.view === 'editor' }">
                <section v-if="ui.weekly.view === 'list'" class="weekly-hero weekly-hero-cockpit">
                  <div class="weekly-hero-main">
                    <div>
                      <p class="feature-kicker">Weekly Progress</p>
                      <p class="models-title">任务推进</p>
                    </div>
                  </div>

                  <div class="weekly-hero-side">
                    <span class="status-pill models-badge">
                      {{ activeModel ? `AI 已连接：${activeModel.displayName}` : "AI 功能待启用" }}
                    </span>
                    <span class="pill pill-neutral">
                      {{ workbench.weeklyProgress.length ? `已归档 ${workbench.weeklyProgress.length} 周记录` : "等待创建本周计划" }}
                    </span>
                  </div>
                </section>

                <section v-if="ui.weekly.view === 'list'" class="weekly-overview-grid">
                  <article v-for="card in weeklyListOverviewCards" :key="card.id" class="weekly-kpi-card">
                    <p class="weekly-kpi-label">{{ card.label }}</p>
                    <p class="weekly-kpi-value">{{ card.value }}</p>
                    <p v-if="card.meta" class="weekly-kpi-meta" :class="{ 'is-success': card.metaTone === 'success' }">{{ card.meta }}</p>
                  </article>
                </section>

                <div class="models-grid models-grid-single" :class="{ 'models-grid-immersive': ui.weekly.view === 'editor' }">
                  <section v-if="ui.weekly.view === 'list'" class="model-section">
                    <div class="model-section-head">
                      <div>
                        <p class="feature-kicker">Weekly Reports</p>
                        <p class="model-section-title">周报列表</p>
                      </div>

                      <div class="model-section-actions">
                        <span v-if="weeklyFocusRecord" class="status-pill">{{ weeklyFocusRecord.title }}</span>
                        <span class="pill pill-neutral">
                          共 {{ workbench.weeklyProgress.length }} 周，展示 {{ Math.min(workbench.weeklyProgress.length, 5) }} 条
                        </span>
                      </div>
                    </div>

                    <div class="model-section-body model-configured-list weekly-record-list">
                      <div v-if="!workbench.weeklyProgress.length" class="model-empty">
                        <p class="model-empty-copy">当前还没有周记录，首次进入时会自动创建本周空白计划。</p>
                      </div>

                      <article
                        v-for="record in workbench.weeklyProgress.slice(0, 5)"
                        :key="record.id"
                        class="weekly-record-card"
                        :class="{ 'is-active': ui.weekly.activeRecordId === record.id }"
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
                            :class="getWeeklyProgressMetrics(record).projectCount || getWeeklyProgressMetrics(record).taskCount || getWeeklyProgressMetrics(record).noteCount || String(record.generatedReport ?? '').trim() ? 'is-updated' : 'is-pending'"
                          >
                            {{
                              getWeeklyProgressMetrics(record).projectCount ||
                              getWeeklyProgressMetrics(record).taskCount ||
                              getWeeklyProgressMetrics(record).noteCount ||
                              String(record.generatedReport ?? "").trim()
                                ? `已更新 ${formatLocalDateTime(record.updatedAt)}`
                                : "待规划"
                            }}
                          </span>

                          <button
                            type="button"
                            class="model-icon-button model-icon-button-danger weekly-record-delete"
                            :aria-label="`删除 ${record.title}`"
                            title="删除周记录"
                            @click.stop="handleWeeklyDelete(record.id)"
                            v-html="renderActionIcon('delete')"
                          ></button>
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
                              :disabled="ui.weekly.isGeneratingReport"
                              @click="closeWeeklyEditor"
                              v-html="renderActionIcon('return')"
                            ></button>
                          </div>

                          <div class="weekly-panel-center">
                            <div class="weekly-panel-center-row">
                              <div class="weekly-editor-segmented" role="tablist" aria-label="任务推进编辑视图">
                                <button
                                  type="button"
                                  class="weekly-editor-tab"
                                  :class="{ 'is-active': ui.weekly.editorView === 'projects' }"
                                  :aria-selected="ui.weekly.editorView === 'projects' ? 'true' : 'false'"
                                  :disabled="ui.weekly.isGeneratingReport"
                                  @click="ui.weekly.editorView = 'projects'"
                                >
                                  项目推进
                                </button>
                                <button
                                  type="button"
                                  class="weekly-editor-tab"
                                  :class="{ 'is-active': ui.weekly.editorView === 'reporting' }"
                                  :aria-selected="ui.weekly.editorView === 'reporting' ? 'true' : 'false'"
                                  :disabled="ui.weekly.isGeneratingReport"
                                  @click="ui.weekly.editorView = 'reporting'"
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
                              v-if="ui.weekly.editorView === 'projects'"
                              type="button"
                              class="weekly-mini-action weekly-mini-action-primary"
                              :disabled="ui.weekly.isGeneratingReport"
                              @click="addWeeklyProject"
                            >
                              新增项目
                            </button>
                          </div>
                        </div>

                        <template v-if="ui.weekly.editorView === 'projects'">
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
                                      +
                                    </button>
                                    <button type="button" class="weekly-row-action weekly-row-action-delete" @click="removeWeeklyProject(project.id)">
                                      删除
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
                          <div class="weekly-report-stage" :class="{ 'is-locked': ui.weekly.isGeneratingReport }" :aria-busy="ui.weekly.isGeneratingReport ? 'true' : 'false'">
                            <section class="weekly-rail-card weekly-report-main-card">
                              <div class="weekly-report-toolbar">
                                <div class="weekly-report-mode-tabs" role="tablist" aria-label="汇报模式">
                                  <button
                                    type="button"
                                    class="weekly-report-mode-tab"
                                    :class="{ 'is-active': ui.weekly.reportingMode === 'daily' }"
                                    :aria-selected="ui.weekly.reportingMode === 'daily' ? 'true' : 'false'"
                                    :disabled="ui.weekly.isGeneratingReport"
                                    @click="setWeeklyReportingMode('daily')"
                                  >
                                    日报
                                  </button>
                                  <button
                                    type="button"
                                    class="weekly-report-mode-tab"
                                    :class="{ 'is-active': ui.weekly.reportingMode === 'weekly' }"
                                    :aria-selected="ui.weekly.reportingMode === 'weekly' ? 'true' : 'false'"
                                    :disabled="ui.weekly.isGeneratingReport"
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
                                      :disabled="ui.weekly.isGeneratingReport"
                                      @click="addWeeklyReportTemplate"
                                    >
                                      新增模板
                                    </button>
                                    <button
                                      type="button"
                                      class="weekly-mini-action"
                                      :disabled="ui.weekly.isGeneratingReport || !weeklyCanDeleteSelectedReportTemplate"
                                      @click="removeWeeklySelectedReportTemplate"
                                    >
                                      删除模板
                                    </button>
                                  </template>
                                  <span v-else class="weekly-report-mode-meta">自动提取今天更新的叶子任务</span>
                                </div>
                              </div>

                              <div v-if="weeklyIsWeeklyReportMode" class="weekly-template-toolbar">
                                <label class="field weekly-template-select-field">
                                  <span class="field-label">{{ weeklyReportSelectorLabel }}</span>
                                  <select
                                    v-model="ui.weekly.draft.selectedReportTemplateId"
                                    class="field-input weekly-template-select"
                                    :disabled="ui.weekly.isGeneratingReport"
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
                                <button
                                  type="button"
                                  class="model-icon-button weekly-report-run-button"
                                  :class="{ 'is-loading': weeklyActiveReportIsGenerating }"
                                  :disabled="ui.weekly.isGeneratingReport"
                                  :title="weeklyReportRunButtonLabel"
                                  :aria-label="weeklyReportRunButtonLabel"
                                  @click="handleWeeklyActiveReportGeneration"
                                >
                                  <span v-if="weeklyActiveReportIsGenerating" class="weekly-task-spinner" aria-hidden="true"></span>
                                  <span v-else class="weekly-report-run-icon" v-html="renderActionIcon('play')"></span>
                                </button>
                              </div>
                              <p class="weekly-report-feedback" :class="`is-${weeklyReportFeedbackTone}`">{{ weeklyReportFeedbackText }}</p>

                              <label class="field field-full weekly-report-output-field">
                                <button
                                  type="button"
                                  class="model-icon-button weekly-report-copy-button"
                                  :class="{ 'is-copied': ui.weekly.reportCopyState === 'copied' }"
                                  :disabled="ui.weekly.isGeneratingReport || !weeklyCanCopyReportOutput"
                                  :title="weeklyReportCopyButtonLabel"
                                  :aria-label="weeklyReportCopyButtonLabel"
                                  @click="handleWeeklyReportOutputCopy"
                                >
                                  <span class="weekly-report-run-icon" v-html="renderActionIcon(weeklyReportCopyIconKind)"></span>
                                </button>
                                <textarea
                                  v-model="weeklyReportOutputContent"
                                  class="field-textarea weekly-textarea weekly-textarea-report weekly-report-output-textarea"
                                  :readonly="ui.weekly.isGeneratingReport"
                                  :class="{ 'is-readonly': ui.weekly.isGeneratingReport }"
                                  :placeholder="weeklyReportOutputPlaceholder"
                                ></textarea>
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

                            <div v-if="ui.weekly.isGeneratingReport" class="weekly-report-lock-layer" aria-hidden="true"></div>
                          </div>
                        </template>
                      </form>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeFeature === FEATURE_COMMAND_WORKSHOP">
            <div
              class="workspace-stage command-workshop-stage"
              :class="ui.command.view === 'chat' ? 'command-workshop-stage-chat workspace-stage-flush' : 'workspace-stage-scroll'"
            >
              <div class="command-workshop-shell" :class="{ 'command-workshop-shell-chat': ui.command.view === 'chat' }">
                <section v-if="ui.command.view !== 'chat'" class="models-hero">
                  <div>
                    <p class="feature-kicker">Command Workshop</p>
                    <p class="models-title">命令工坊</p>
                  </div>

                  <div class="model-section-actions">
                    <button type="button" class="model-action" @click="beginNewCommandSession">开始协作</button>
                  </div>
                </section>

                <div v-if="ui.command.view === 'chat'" class="models-grid models-grid-single command-chat-layout command-chat-layout-immersive">
                  <section class="model-section model-section-immersive command-chat-section command-chat-section-immersive">
                    <div class="command-chat-shell command-chat-shell-immersive">
                      <div class="command-chat-head">
                        <div class="command-chat-side command-chat-side-start">
                          <button
                            v-if="workbench.commandSessions.length"
                            type="button"
                            class="model-icon-button command-chat-nav-button"
                            aria-label="返回列表"
                            title="返回列表"
                            @click="backToCommandList"
                            v-html="renderActionIcon('return')"
                          ></button>
                        </div>

                        <div class="command-chat-center">
                          <p class="command-chat-title" :title="activeCommandSession?.title ?? '开始一轮协作'">{{ commandChatTitle }}</p>
                        </div>

                        <div class="command-chat-side command-chat-side-end">
                          <button
                            type="button"
                            class="model-icon-button command-chat-nav-button command-chat-nav-button-primary"
                            aria-label="新对话"
                            title="新对话"
                            @click="beginNewCommandSession"
                            v-html="renderActionIcon('jump')"
                          ></button>
                        </div>
                      </div>

                      <div ref="commandMessagesRef" class="command-chat-scroll-region">
                        <div class="command-message-stream">
                          <article
                            v-for="message in activeCommandMessages"
                            :key="message.id"
                            class="command-message"
                            :class="{
                              'is-user': message.role === 'user',
                              'is-assistant': message.role === 'assistant',
                              'is-error': message.state === 'error'
                            }"
                          >
                            <div class="command-message-head">
                              <span class="command-message-role">{{ message.role === "user" ? "你" : resolveAgentName(ui.command.form.agentProfileId) }}</span>
                              <span class="command-message-time">{{ formatLocalDateTime(message.createdAt) }}</span>
                            </div>

                            <div class="command-message-body command-rich-text" v-html="renderRichText(message.content)" @click="handleRichTextClick"></div>

                            <details v-if="message.role === 'assistant' && message.artifact" class="command-artifact-panel">
                              <summary>{{ getCommandArtifactSummary(message.artifact) }}</summary>

                              <div class="command-artifact-body">
                                <div class="extension-tag-row command-artifact-tag-row">
                                  <span class="pill pill-neutral">{{ message.artifact.profileLabel }}</span>
                                  <span class="pill pill-neutral">{{ message.artifact.model }}</span>
                                  <span v-if="message.artifact.skillName" class="pill">{{ message.artifact.skillName }}</span>
                                  <span v-if="message.artifact.autoSelectedMcp" class="pill">自动选 MCP</span>
                                  <span v-if="message.artifact.mcpServerName" class="pill pill-neutral">{{ message.artifact.mcpServerName }}</span>
                                  <span v-if="message.artifact.mcpToolName" class="pill pill-neutral">{{ message.artifact.mcpToolName }}</span>
                                </div>

                                <div v-if="message.artifact.mcpResultText || message.artifact.stopReason" class="command-artifact-inline-list">
                                  <div v-if="message.artifact.mcpResultText" class="command-artifact-inline-row">
                                    <span class="command-artifact-inline-label">MCP 汇总</span>
                                    <p
                                      class="command-artifact-inline-copy"
                                      :title="getCommandArtifactInlineText(message.artifact.mcpResultText)"
                                    >
                                      {{ getCommandArtifactInlineText(message.artifact.mcpResultText) }}
                                    </p>
                                  </div>

                                  <div v-if="message.artifact.stopReason" class="command-artifact-inline-row">
                                    <span class="command-artifact-inline-label">停止原因</span>
                                    <p
                                      class="command-artifact-inline-copy"
                                      :title="getCommandArtifactInlineText(message.artifact.stopReason)"
                                    >
                                      {{ getCommandArtifactInlineText(message.artifact.stopReason) }}
                                    </p>
                                  </div>
                                </div>

                                <div class="command-artifact-section">
                                  <div class="command-artifact-section-head">
                                    <span class="command-artifact-section-title">执行步骤</span>
                                    <span class="pill pill-neutral command-artifact-section-count">
                                      {{ message.artifact.steps?.length ?? 0 }}
                                    </span>
                                  </div>

                                  <div v-if="message.artifact.steps?.length" class="command-artifact-chain">
                                    <article v-for="step in message.artifact.steps" :key="step.id" class="command-artifact-chain-item">
                                      <span class="command-artifact-chain-rail" aria-hidden="true">
                                        <span class="command-artifact-chain-bead"></span>
                                      </span>

                                      <div class="command-artifact-chain-main">
                                        <p class="command-artifact-chain-title" :title="step.title">{{ step.title }}</p>
                                        <p
                                          v-if="getCommandArtifactStepSecondary(step)"
                                          class="command-artifact-chain-secondary"
                                          :title="getCommandArtifactStepSecondary(step)"
                                        >
                                          {{ getCommandArtifactStepSecondary(step) }}
                                        </p>
                                      </div>

                                      <span class="command-artifact-chain-time">{{ formatLocalDateTime(step.createdAt) }}</span>
                                    </article>
                                  </div>
                                  <p v-else class="model-empty-copy">本次运行还没有步骤记录。</p>
                                </div>

                                <div v-if="message.artifact.mcpCalls?.length" class="command-artifact-section">
                                  <div class="command-artifact-section-head">
                                    <span class="command-artifact-section-title">MCP 调用</span>
                                    <span class="pill pill-neutral command-artifact-section-count">
                                      {{ message.artifact.mcpCalls.length }}
                                    </span>
                                  </div>

                                  <div class="command-artifact-chain">
                                    <article
                                      v-for="call in message.artifact.mcpCalls"
                                      :key="`${call.createdAt}-${call.serverName}-${call.toolName}-${call.round}`"
                                      class="command-artifact-chain-item is-mcp"
                                    >
                                      <span class="command-artifact-chain-rail" aria-hidden="true">
                                        <span class="command-artifact-chain-bead"></span>
                                      </span>

                                      <div class="command-artifact-chain-main">
                                        <p
                                          class="command-artifact-chain-title"
                                          :title="getCommandArtifactCallTitle(call)"
                                        >
                                          {{ getCommandArtifactCallTitle(call) }}
                                        </p>
                                        <p
                                          v-if="getCommandArtifactCallSecondary(call)"
                                          class="command-artifact-chain-secondary"
                                          :title="getCommandArtifactCallSecondary(call)"
                                        >
                                          {{ getCommandArtifactCallSecondary(call) }}
                                        </p>
                                      </div>

                                      <span class="command-artifact-chain-time">{{ formatLocalDateTime(call.createdAt) }}</span>
                                    </article>
                                  </div>
                                </div>
                              </div>
                            </details>
                          </article>

                          <article v-if="ui.command.isRunning" class="command-message is-assistant is-pending">
                            <div class="command-message-head">
                              <span class="command-message-role">{{ resolveAgentName(ui.command.form.agentProfileId) }}</span>
                              <span class="command-message-time">处理中</span>
                            </div>

                            <div
                              class="command-message-body command-rich-text"
                              v-html="renderRichText('正在读取上下文并规划执行步骤，请稍等片刻。')"
                            ></div>
                          </article>
                        </div>
                      </div>

                      <form class="command-composer" @submit.prevent="handleCommandSubmit">
                        <div v-if="ui.command.composerView === 'settings'" class="command-input-shell command-input-shell-float command-settings-shell">
                          <div class="command-settings-head">
                            <div class="command-settings-copy">
                              <p class="command-settings-title">高级设置</p>
                              <p class="command-settings-caption">{{ commandSettingsSummary }}</p>
                            </div>

                            <button type="button" class="weekly-mini-action command-settings-close" @click="ui.command.composerView = 'input'">
                              返回输入
                            </button>
                          </div>

                          <div class="command-settings-grid">
                            <label class="field command-settings-cell">
                              <span class="field-label">Agent</span>
                              <select v-model="ui.command.form.agentProfileId" class="field-input" :disabled="!enabledAgentProfiles.length" @change="handleCommandAgentChange">
                                <option v-for="agent in enabledAgentProfiles" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
                                <option v-if="!enabledAgentProfiles.length" value="">暂无可用 Agent</option>
                              </select>
                            </label>

                            <label class="field command-settings-cell">
                              <span class="field-label">Skill</span>
                              <select v-model="ui.command.form.skillId" class="field-input" :disabled="!commandSelectedAgent">
                                <option value="">通用模式</option>
                                <option v-for="skill in commandRunnableSkills" :key="skill.id" :value="skill.id">
                                  {{ getSkillOptionLabel(skill) }}
                                </option>
                              </select>
                            </label>

                            <label class="command-inline-toggle command-settings-toggle">
                              <span class="command-inline-toggle-label">允许自动工具</span>
                              <input v-model="ui.command.form.autoSelectMcp" type="checkbox" />
                            </label>

                            <label class="field command-settings-cell">
                              <span class="field-label">MCP Server</span>
                              <select v-model="ui.command.form.mcpServerId" class="field-input" :disabled="!commandSelectedAgent" @change="handleCommandServerChange">
                                <option value="">不指定 MCP Server</option>
                                <option v-for="server in commandAuthorizedServers" :key="server.id" :value="server.id">
                                  {{ server.name }} / {{ server.transport.toUpperCase() }}
                                </option>
                              </select>
                            </label>

                            <div class="field command-settings-tool-field">
                              <span class="field-label">MCP 工具</span>
                              <div class="command-settings-tool-row">
                                <select v-model="ui.command.form.mcpToolName" class="field-input" :disabled="!ui.command.form.mcpServerId">
                                  <option value="">不指定工具</option>
                                  <option v-for="tool in commandToolOptions" :key="`${tool.serverId ?? 'server'}-${tool.name}`" :value="tool.name">
                                    {{ tool.name }}{{ tool.description ? ` / ${tool.description}` : "" }}
                                  </option>
                                </select>

                                <button type="button" class="weekly-mini-action command-load-tools-button" @click="handleCommandLoadMcpTools">读取工具</button>
                              </div>
                            </div>

                            <label class="field command-settings-json-field">
                              <span class="field-label">MCP 参数 JSON</span>
                              <textarea
                                v-model="ui.command.form.mcpArgumentsText"
                                rows="2"
                                class="field-textarea command-settings-json-textarea"
                                placeholder='例如：{"path":"docs/ARCHITECTURE.md"}'
                              ></textarea>
                            </label>
                          </div>
                        </div>

                        <div v-else class="command-input-shell command-input-shell-float">
                          <div class="command-input-toolbar">
                            <p class="command-input-label">输入消息</p>

                            <div class="command-input-toolbar-actions">
                              <p class="command-input-shortcut">Enter 发送 · Shift + Enter 换行</p>

                              <button
                                type="button"
                                class="model-icon-button command-input-settings-trigger"
                                aria-label="打开高级设置"
                                title="高级设置"
                                @click="ui.command.composerView = 'settings'"
                                v-html="renderActionIcon('gear')"
                              ></button>
                            </div>
                          </div>

                          <div class="command-input-frame">
                            <textarea
                              ref="commandInputRef"
                              v-model="ui.command.draftInput"
                              class="field-textarea command-input"
                              :placeholder="commandSelectedAgent ? '直接告诉 Gordon 你要完成什么工作，Enter 发送，Shift + Enter 换行。' : '先在能力拓展里启用一个 Agent，Gordon 才能开始工作。'"
                              :disabled="!commandSelectedAgent || ui.command.isRunning"
                              required
                              autofocus
                              @keydown.enter.exact.prevent="handleCommandSubmit"
                            ></textarea>

                            <button
                              type="submit"
                              class="model-icon-button command-input-submit"
                              :disabled="!commandSelectedAgent || ui.command.isRunning"
                              :aria-label="ui.command.isRunning ? '处理中' : '发送消息'"
                              :title="ui.command.isRunning ? '处理中' : '发送消息'"
                              v-html="renderActionIcon('enter')"
                            ></button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </section>
                </div>

                <div v-else class="models-grid models-grid-single">
                  <section class="model-section command-session-section">
                    <div class="model-section-head">
                      <div>
                        <p class="feature-kicker">Sessions</p>
                        <p class="model-section-title">会话列表</p>
                      </div>

                    </div>

                    <div class="model-section-body command-session-list-shell">
                      <div class="command-session-group">
                        <div class="command-session-group-head">
                          <p class="command-session-group-title">最近会话</p>
                          <span class="pill pill-neutral">{{ workbench.commandSessions.length }} 条</span>
                        </div>

                        <div v-if="workbench.commandSessions.length" class="command-session-list">
                          <article
                            v-for="session in workbench.commandSessions"
                            :key="session.id"
                            class="command-session-card"
                            :class="{ 'is-active': ui.command.activeSessionId === session.id }"
                          >
                            <button type="button" class="command-session-main" @click="openCommandSession(session.id)">
                              <div class="command-session-topline">
                                <p class="command-session-title">{{ session.title || "新对话" }}</p>
                                <p class="command-session-meta">
                                  {{ formatLocalDateTime(session.updatedAt) }} · {{ session.messages.length }} 条消息 ·
                                  {{ session.messages.filter((message) => message.role === "assistant").length }} 次响应
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              class="model-icon-button model-icon-button-danger command-session-delete"
                              :aria-label="`删除 ${session.title || '当前会话'}`"
                              title="删除会话"
                              @click.stop="handleCommandSessionDelete(session.id)"
                              v-html="renderActionIcon('delete')"
                            ></button>
                          </article>
                        </div>

                        <div v-else class="command-empty-card">
                          <p class="model-empty-copy">还没有历史会话。点击上方“开始协作”，直接进入命令工坊。</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeFeature === FEATURE_EXTENSIONS_MANAGEMENT">
            <div class="workspace-stage workspace-stage-scroll">
              <div class="models-shell extensions-shell">
                <section v-if="ui.extensions.view === 'list'" class="models-hero">
                  <div>
                    <p class="feature-kicker">Capability Expansion</p>
                    <p class="models-title">能力拓展</p>
                  </div>

                                    <div class="extensions-list-toolbar">
                    <div class="weekly-editor-segmented extensions-list-tabs" role="tablist" aria-label="能力拓展配置分类">
                      <button
                        type="button"
                        class="weekly-editor-tab"
                        :class="{ 'is-active': ui.extensions.listTab === 'agent' }"
                        :aria-selected="ui.extensions.listTab === 'agent' ? 'true' : 'false'"
                        @click="ui.extensions.listTab = 'agent'"
                      >
                        Agent 配置
                      </button>
                      <button
                        type="button"
                        class="weekly-editor-tab"
                        :class="{ 'is-active': ui.extensions.listTab === 'skill' }"
                        :aria-selected="ui.extensions.listTab === 'skill' ? 'true' : 'false'"
                        @click="ui.extensions.listTab = 'skill'"
                      >
                        Skill 配置
                      </button>
                      <button
                        type="button"
                        class="weekly-editor-tab"
                        :class="{ 'is-active': ui.extensions.listTab === 'mcp' }"
                        :aria-selected="ui.extensions.listTab === 'mcp' ? 'true' : 'false'"
                        @click="ui.extensions.listTab = 'mcp'"
                      >
                        MCP 配置
                      </button>
                    </div>
                  </div>

                  <div class="model-section-actions">
                    <span class="status-pill">{{ workbench.agentProfiles.filter((profile) => profile.enabled).length }} 个 Agent 已启用</span>
                    <span class="pill pill-neutral">{{ workbench.skillDefinitions.filter((skill) => skill.enabled).length }} 个 Skill 已启用</span>
                    <span class="pill pill-neutral">{{ workbench.mcpServers.filter((server) => server.enabled).length }} 个 MCP 已启用</span>
                  </div>
                </section>

                <template v-if="ui.extensions.view === 'list'">
                  <div class="models-grid models-grid-single extensions-list-grid">
                    <section v-if="ui.extensions.listTab === 'agent'" class="model-section extension-section">
                      <div class="model-section-head">
                        <div>
                          <p class="feature-kicker">Agents</p>
                          <p class="model-section-title">Agent 配置</p>
                        </div>

                        <div class="model-section-actions">
                          <span class="pill pill-neutral">{{ workbench.agentProfiles.length }} 个 Agent</span>
                          <button type="button" class="model-action" @click="openExtensionEditor('agent')">添加 Agent</button>
                        </div>
                      </div>

                      <div class="model-section-body model-configured-list extension-configured-list">
                        <div v-if="!workbench.agentProfiles.length" class="model-empty">
                          <p class="model-empty-copy">当前还没有 Agent。先添加一个执行角色，再绑定模型、Skill 和 MCP Server。</p>
                        </div>

                        <article v-for="agent in workbench.agentProfiles" :key="agent.id" class="model-config-card extension-config-card">
                          <div class="model-config-head">
                            <div class="model-config-main">
                              <div class="provider-avatar extension-avatar extension-avatar-agent" aria-hidden="true">
                                {{ getExtensionInitials(agent.name) }}
                              </div>

                              <div>
                                <p class="model-card-title">{{ agent.name }}</p>
                                <p class="model-card-meta">
                                  {{ agent.mode === "task" ? "任务型 Agent" : "对话型 Agent" }} / {{ resolveBoundModelName(agent.modelProfileId) }}
                                </p>
                              </div>
                            </div>

                            <div class="model-card-actions model-card-actions-inline">
                              <button
                                type="button"
                                class="model-icon-button"
                                :aria-label="`运行 ${agent.name}`"
                                title="运行测试"
                                @click="openAgentRunner(agent.id)"
                                v-html="renderActionIcon('play')"
                              ></button>

                              <span v-if="isBuiltinWorkbenchItem(agent.id)" class="pill pill-neutral">内置</span>

                              <template v-else>
                                <button
                                  type="button"
                                  class="model-icon-button"
                                  :aria-label="`编辑 ${agent.name}`"
                                  title="编辑"
                                  @click="openExtensionEditor('agent', agent)"
                                  v-html="renderActionIcon('edit')"
                                ></button>

                                <button
                                  type="button"
                                  class="model-status-toggle"
                                  :class="{ 'is-active': agent.enabled }"
                                  :aria-pressed="agent.enabled ? 'true' : 'false'"
                                  @click="handleAgentStatusToggle(agent.id)"
                                >
                                  {{ agent.enabled ? "已启用" : "未启用" }}
                                </button>

                                <button
                                  type="button"
                                  class="model-icon-button model-icon-button-danger"
                                  :aria-label="`删除 ${agent.name}`"
                                  title="删除"
                                  @click="handleAgentDelete(agent.id)"
                                  v-html="renderActionIcon('delete')"
                                ></button>
                              </template>
                            </div>
                          </div>

                          <p v-if="agent.description" class="model-card-copy">{{ agent.description }}</p>

                          <div class="extension-tag-row">
                            <span v-if="isBuiltinWorkbenchItem(agent.id)" class="pill">默认兜底</span>
                            <span class="pill pill-neutral">{{ agent.allowedSkillIds.length }} 个 Skill</span>
                            <span class="pill pill-neutral">{{ agent.allowedMcpServerIds.length }} 个 MCP</span>
                          </div>
                        </article>
                      </div>
                    </section>

                    <section v-else-if="ui.extensions.listTab === 'skill'" class="model-section extension-section">
                      <div class="model-section-head">
                        <div>
                          <p class="feature-kicker">Skills</p>
                          <p class="model-section-title">Skill 配置</p>
                        </div>

                        <div class="model-section-actions">
                          <span class="pill pill-neutral">{{ workbench.skillDefinitions.length }} 个 Skill</span>
                          <button type="button" class="model-action-secondary" @click="openExtensionEditor('skill-import')">GitHub 加载</button>
                          <button type="button" class="model-action" @click="openExtensionEditor('skill')">添加 Skill</button>
                        </div>
                      </div>

                      <div class="model-section-body model-configured-list extension-configured-list">
                        <div v-if="!workbench.skillDefinitions.length" class="model-empty">
                          <p class="model-empty-copy">当前还没有 Skill。先添加可复用提示模板或工作流定义，后续再由 Agent 选择调用。</p>
                        </div>

                        <article v-for="skill in workbench.skillDefinitions" :key="skill.id" class="model-config-card extension-config-card">
                          <div class="model-config-head">
                            <div class="model-config-main">
                              <div class="provider-avatar extension-avatar extension-avatar-skill" aria-hidden="true">
                                {{ getExtensionInitials(skill.name) }}
                              </div>

                              <div>
                                <p class="model-card-title">{{ getSkillDisplayName(skill) }}</p>
                                <p class="model-card-meta">
                                  {{ getSkillDisplayName(skill) !== skill.name ? `${skill.name} / ` : "" }}{{ getSkillSourceLabel(skill) }}
                                </p>
                              </div>
                            </div>

                            <div class="model-card-actions model-card-actions-inline">
                              <span v-if="isBuiltinWorkbenchItem(skill.id)" class="pill pill-neutral">内置</span>

                              <template v-else>
                                <button
                                  type="button"
                                  class="model-icon-button"
                                  :aria-label="`编辑 ${skill.name}`"
                                  title="编辑"
                                  @click="openExtensionEditor('skill', skill)"
                                  v-html="renderActionIcon('edit')"
                                ></button>

                                <button
                                  type="button"
                                  class="model-status-toggle"
                                  :class="{ 'is-active': skill.enabled }"
                                  :aria-pressed="skill.enabled ? 'true' : 'false'"
                                  @click="handleSkillStatusToggle(skill.id)"
                                >
                                  {{ skill.enabled ? "已启用" : "未启用" }}
                                </button>

                                <button
                                  type="button"
                                  class="model-icon-button model-icon-button-danger"
                                  :aria-label="`删除 ${skill.name}`"
                                  title="删除"
                                  @click="handleSkillDelete(skill.id)"
                                  v-html="renderActionIcon('delete')"
                                ></button>
                              </template>
                            </div>
                          </div>

                          <p v-if="skill.description" class="model-card-copy">{{ skill.description }}</p>
                          <p v-if="getSkillSourceDetail(skill)" class="model-card-copy">{{ getSkillSourceDetail(skill) }}</p>
                          <p v-if="getSkillLocalMirrorDetail(skill)" class="model-card-copy">{{ getSkillLocalMirrorDetail(skill) }}</p>

                          <div class="extension-tag-row">
                            <span v-if="isBuiltinWorkbenchItem(skill.id)" class="pill">默认能力</span>
                            <span class="pill pill-neutral">{{ getSkillSourceLabel(skill) }}</span>
                            <span v-if="getSkillLocalMirrorDetail(skill)" class="pill">本地目录</span>
                          </div>
                        </article>
                      </div>
                    </section>

                    <section v-else class="model-section extension-section">
                      <div class="model-section-head">
                        <div>
                          <p class="feature-kicker">MCP Servers</p>
                          <p class="model-section-title">MCP 配置</p>
                        </div>

                        <div class="model-section-actions">
                          <span class="pill pill-neutral">{{ workbench.mcpServers.length }} 个服务</span>
                          <button type="button" class="model-action" @click="openExtensionEditor('mcp')">添加 MCP</button>
                        </div>
                      </div>

                      <div class="model-section-body model-configured-list extension-configured-list">
                        <div v-if="!workbench.mcpServers.length" class="model-empty">
                          <p class="model-empty-copy">当前还没有 MCP Server。先维护连接配置，后续再把工具暴露给 Agent。</p>
                        </div>

                        <article v-for="server in workbench.mcpServers" :key="server.id" class="model-config-card extension-config-card">
                          <div class="model-config-head">
                            <div class="model-config-main">
                              <div class="provider-avatar extension-avatar extension-avatar-mcp" aria-hidden="true">
                                {{ getExtensionInitials(server.name) }}
                              </div>

                              <div>
                                <p class="model-card-title">{{ server.name }}</p>
                                <p class="model-card-meta">
                                  {{ server.transport.toUpperCase() }} / {{ server.transport === "http" ? server.url || "未配置地址" : server.command || "未配置命令" }}
                                </p>
                              </div>
                            </div>

                            <div class="model-card-actions model-card-actions-inline">
                              <span v-if="isBuiltinWorkbenchItem(server.id)" class="pill pill-neutral">内置</span>

                              <template v-else>
                                <button
                                  type="button"
                                  class="model-icon-button"
                                  :aria-label="`编辑 ${server.name}`"
                                  title="编辑"
                                  @click="openExtensionEditor('mcp', server)"
                                  v-html="renderActionIcon('edit')"
                                ></button>

                                <button
                                  type="button"
                                  class="model-status-toggle"
                                  :class="{ 'is-active': server.enabled }"
                                  :aria-pressed="server.enabled ? 'true' : 'false'"
                                  @click="handleMcpStatusToggle(server.id)"
                                >
                                  {{ server.enabled ? "已启用" : "未启用" }}
                                </button>

                                <button
                                  type="button"
                                  class="model-icon-button model-icon-button-danger"
                                  :aria-label="`删除 ${server.name}`"
                                  title="删除"
                                  @click="handleMcpDelete(server.id)"
                                  v-html="renderActionIcon('delete')"
                                ></button>
                              </template>
                            </div>
                          </div>

                          <p v-if="server.description" class="model-card-copy">{{ server.description }}</p>

                          <div class="extension-tag-row">
                            <span v-if="isBuiltinWorkbenchItem(server.id)" class="pill">默认工具</span>
                            <span v-for="tool in server.toolAllowlist" :key="tool" class="pill pill-neutral">{{ tool }}</span>
                            <span v-if="!server.toolAllowlist.length" class="pill pill-neutral">未限制工具</span>
                          </div>
                        </article>
                      </div>
                    </section>
                  </div>
                </template>

                <template v-else-if="ui.extensions.view === 'editor'">
                  <div class="models-grid models-grid-single extensions-editor-grid">
                    <section class="model-section model-section-scroll extension-section extension-section-editor">
                      <div class="model-editor extension-editor">
                        <div class="model-section-head model-section-head-leading">
                          <div class="model-section-leading">
                            <button type="button" class="model-action-secondary" @click="closeExtensionPanels">返回列表</button>
                            <div>
                              <p class="feature-kicker">Capability Editor</p>
                              <p class="model-section-title">{{ getExtensionEditorTitle() }}</p>
                            </div>
                          </div>
                        </div>

                        <form class="model-form extension-form" @submit.prevent="handleExtensionEditorSave">
                          <template v-if="ui.extensions.editor.kind === 'agent'">
                            <label class="field">
                              <span class="field-label">Agent 名称</span>
                              <input v-model="ui.extensions.editor.values.name" class="field-input" placeholder="例如：周报助手" required />
                            </label>

                            <label class="field">
                              <span class="field-label">执行模式</span>
                              <select v-model="ui.extensions.editor.values.mode" class="field-input">
                                <option value="task">task</option>
                                <option value="chat">chat</option>
                              </select>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">模型绑定</span>
                              <select v-model="ui.extensions.editor.values.modelProfileId" class="field-input">
                                <option value="">暂不绑定</option>
                                <option v-for="profile in workbench.modelSettings.profiles" :key="profile.id" :value="profile.id">
                                  {{ profile.displayName }} / {{ profile.model }}
                                </option>
                              </select>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">说明</span>
                              <textarea
                                v-model="ui.extensions.editor.values.description"
                                class="field-textarea"
                                placeholder="描述这个 Agent 主要负责什么"
                              ></textarea>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">系统提示词</span>
                              <textarea
                                v-model="ui.extensions.editor.values.systemPrompt"
                                class="field-textarea extension-textarea-lg"
                                placeholder="定义 Agent 的角色、边界和执行策略"
                                required
                              ></textarea>
                            </label>

                            <div class="field field-full">
                              <span class="field-label">允许调用的 Skill</span>
                              <div v-if="workbench.skillDefinitions.length" class="extension-selection-list">
                                <label v-for="skill in workbench.skillDefinitions" :key="skill.id" class="extension-selection-item">
                                  <input
                                    v-model="ui.extensions.editor.values.allowedSkillIds"
                                    type="checkbox"
                                    :value="skill.id"
                                  />
                                  <span>{{ getSkillOptionLabel(skill) }}</span>
                                </label>
                              </div>
                              <div v-else class="model-empty">
                                <p class="model-empty-copy">还没有 Skill，可先在列表页新增。</p>
                              </div>
                            </div>

                            <div class="field field-full">
                              <span class="field-label">允许调用的 MCP Server</span>
                              <div v-if="workbench.mcpServers.length" class="extension-selection-list">
                                <label v-for="server in workbench.mcpServers" :key="server.id" class="extension-selection-item">
                                  <input
                                    v-model="ui.extensions.editor.values.allowedMcpServerIds"
                                    type="checkbox"
                                    :value="server.id"
                                  />
                                  <span>{{ server.name }} / {{ server.transport.toUpperCase() }}</span>
                                </label>
                              </div>
                              <div v-else class="model-empty">
                                <p class="model-empty-copy">还没有 MCP Server，可先在列表页新增。</p>
                              </div>
                            </div>
                          </template>

                          <template v-else-if="ui.extensions.editor.kind === 'skill'">
                            <label class="field">
                              <span class="field-label">Skill 名称</span>
                              <input
                                v-model="ui.extensions.editor.values.name"
                                class="field-input"
                                placeholder="例如：karpathy-guidelines"
                                required
                              />
                            </label>

                            <label class="field field-full">
                              <span class="field-label">说明</span>
                              <textarea
                                v-model="ui.extensions.editor.values.description"
                                class="field-textarea"
                                placeholder="描述这个 Skill 适用于哪些场景"
                              ></textarea>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">Prompt 模板</span>
                              <textarea
                                v-model="ui.extensions.editor.values.promptTemplate"
                                class="field-textarea extension-textarea-lg"
                                placeholder="定义 Skill 的输入上下文和输出约束"
                                required
                              ></textarea>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">处理器引用</span>
                              <input
                                v-model="ui.extensions.editor.values.handlerRef"
                                class="field-input"
                                placeholder="例如：scripts/run.py 或 scripts/run.mjs"
                              />
                            </label>

                            <label class="field field-full">
                              <span class="field-label">协议约定</span>
                              <textarea class="field-textarea" readonly>
如果 Skill 目录里存在可执行 handler，Gordon 会自动按 handler 模式执行；否则默认按 prompt 模式处理。当前协议版本为 gordon-skill/v1；stdout 推荐返回 {"protocolVersion":"gordon-skill/v1","mode":"context|final","content":"..."}。
                              </textarea>
                            </label>
                          </template>

                          <template v-else-if="ui.extensions.editor.kind === 'skill-import'">
                            <label class="field field-full">
                              <span class="field-label">GitHub 仓库</span>
                              <input
                                v-model="ui.extensions.editor.values.repo"
                                class="field-input"
                                placeholder="例如：openai/skills 或 https://github.com/openai/skills"
                                required
                              />
                            </label>

                            <label class="field">
                              <span class="field-label">分支 / Tag</span>
                              <input v-model="ui.extensions.editor.values.ref" class="field-input" placeholder="默认 main" />
                            </label>

                            <label class="field field-full">
                              <span class="field-label">Skill 路径</span>
                              <input
                                v-model="ui.extensions.editor.values.path"
                                class="field-input"
                                placeholder="例如：skills/.curated/skill-installer 或 skills/demo/SKILL.md"
                                required
                              />
                            </label>

                            <label class="field field-full">
                              <span class="field-label">说明</span>
                              <textarea class="field-textarea" readonly>
当前会从 GitHub 读取整个 Skill 目录，镜像到 Gordon 的 `skills/` 本地 Skill 目录，并把 SKILL.md 映射为本地 SkillDefinition。导入后你仍然可以在列表里继续编辑。
                              </textarea>
                            </label>
                          </template>

                          <template v-else>
                            <label class="field">
                              <span class="field-label">服务名称</span>
                              <input v-model="ui.extensions.editor.values.name" class="field-input" placeholder="例如：Feishu Docs" required />
                            </label>

                            <label class="field">
                              <span class="field-label">传输方式</span>
                              <select v-model="ui.extensions.editor.values.transport" class="field-input">
                                <option value="stdio">stdio</option>
                                <option value="http">http</option>
                              </select>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">说明</span>
                              <textarea
                                v-model="ui.extensions.editor.values.description"
                                class="field-textarea"
                                placeholder="描述这个 MCP 服务提供哪些工具"
                              ></textarea>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">启动命令</span>
                              <input
                                v-model="ui.extensions.editor.values.command"
                                class="field-input"
                                placeholder="例如：npx @scope/server"
                              />
                            </label>

                            <label class="field field-full">
                              <span class="field-label">服务地址</span>
                              <input
                                v-model="ui.extensions.editor.values.url"
                                class="field-input"
                                placeholder="例如：https://mcp.example.com"
                              />
                            </label>

                            <label class="field field-full">
                              <span class="field-label">环境变量</span>
                              <textarea
                                v-model="ui.extensions.editor.values.envText"
                                class="field-textarea extension-textarea-md"
                                placeholder="一行一个 KEY=VALUE"
                              ></textarea>
                            </label>

                            <label class="field field-full">
                              <span class="field-label">工具白名单</span>
                              <input
                                v-model="ui.extensions.editor.values.toolAllowlist"
                                class="field-input"
                                placeholder="例如：search_docs, create_doc, update_doc"
                              />
                            </label>
                          </template>

                          <div class="form-actions">
                            <button type="button" class="model-action-secondary" @click="closeExtensionPanels">取消</button>
                            <button type="submit" class="model-action">
                              {{
                                ui.extensions.editor.kind === "agent"
                                  ? "保存 Agent"
                                  : ui.extensions.editor.kind === "skill"
                                    ? "保存 Skill"
                                    : ui.extensions.editor.kind === "skill-import"
                                      ? "加载 Skill"
                                      : "保存 MCP"
                              }}
                            </button>
                          </div>
                        </form>
                      </div>
                    </section>
                  </div>
                </template>

                <template v-else>
                  <div class="models-grid extensions-runner-grid">
                    <section class="model-section model-section-scroll extension-section extension-section-editor">
                      <div class="model-editor extension-editor">
                        <div class="model-section-head model-section-head-leading">
                          <div class="model-section-leading">
                            <button type="button" class="model-action-secondary" @click="closeExtensionPanels">返回列表</button>
                            <div>
                              <p class="feature-kicker">Agent Runner</p>
                              <p class="model-section-title">{{ runnerAgent?.name ?? "Agent 未找到" }}</p>
                              <p class="models-subcopy">
                                绑定模型：{{ resolveBoundModelName(runnerAgent?.modelProfileId) }}，可选 Skill：{{ runnerRunnableSkills.length }} 个。
                              </p>
                            </div>
                          </div>

                          <div class="model-section-actions">
                            <span class="status-pill">{{ runnerAgent?.enabled ? "Agent 已启用" : "Agent 未启用" }}</span>
                          </div>
                        </div>

                        <form class="model-form extension-form" @submit.prevent="handleRunnerSubmit">
                          <label class="field field-full">
                            <span class="field-label">本次附加 Skill</span>
                            <select v-model="ui.extensions.runner.skillId" class="field-input">
                              <option value="">不指定 Skill，直接按 Agent 角色执行</option>
                              <option v-for="skill in runnerRunnableSkills" :key="skill.id" :value="skill.id">
                                {{ getSkillOptionLabel(skill) }}
                              </option>
                            </select>
                          </label>

                          <label class="field field-full">
                            <span class="field-label">本次附加 MCP Server</span>
                            <select v-model="ui.extensions.runner.mcpServerId" class="field-input" @change="handleRunnerServerChange">
                              <option value="">不调用 MCP 工具</option>
                              <option v-for="server in runnerAuthorizedServers" :key="server.id" :value="server.id">
                                {{ server.name }} / {{ server.transport.toUpperCase() }}
                              </option>
                            </select>
                          </label>

                          <label class="extension-selection-item field-full">
                            <input v-model="ui.extensions.runner.autoSelectMcp" type="checkbox" />
                            <span>未手动指定 MCP tool 时，允许 Agent 自动选择工具</span>
                          </label>

                          <div class="field field-full">
                            <div class="weekly-inline-actions weekly-inline-actions-spread">
                              <span class="field-label">MCP 工具</span>
                              <button type="button" class="model-action-secondary" @click="handleRunnerLoadMcpTools">读取工具</button>
                            </div>

                            <select v-model="ui.extensions.runner.mcpToolName" class="field-input">
                              <option value="">不指定工具</option>
                              <option v-for="tool in ui.extensions.runner.availableMcpTools" :key="tool.name" :value="tool.name">
                                {{ tool.name }}{{ tool.description ? ` / ${tool.description}` : "" }}
                              </option>
                            </select>
                          </div>

                          <label class="field field-full">
                            <span class="field-label">MCP 参数 JSON</span>
                            <textarea
                              v-model="ui.extensions.runner.mcpArgumentsText"
                              class="field-textarea extension-textarea-md"
                              placeholder='例如：{"query":"本周周报"}'
                            ></textarea>
                          </label>

                          <label class="field field-full">
                            <span class="field-label">任务输入</span>
                            <textarea
                              v-model="ui.extensions.runner.userInput"
                              class="field-textarea extension-textarea-lg"
                              placeholder="例如：请帮我基于本周计划生成一版可发给领导的更新说明"
                              required
                            ></textarea>
                          </label>

                          <div class="form-actions">
                            <button type="button" class="model-action-secondary" @click="resetRunnerState">清空输入</button>
                            <button type="submit" class="model-action">{{ ui.extensions.runner.isRunning ? "运行中..." : "运行测试" }}</button>
                          </div>
                        </form>
                      </div>
                    </section>

                    <section class="model-section model-section-scroll extension-section extension-section-result">
                      <div class="model-section-head">
                        <div>
                          <p class="feature-kicker">Result</p>
                          <p class="model-section-title">本次输出</p>
                        </div>

                        <div v-if="runnerLatestResult" class="extension-tag-row">
                          <span class="pill pill-neutral">{{ runnerLatestResult.profileLabel }}</span>
                          <span v-if="runnerLatestResult.autoSelectedMcp" class="pill">自动选 MCP</span>
                        </div>
                      </div>

                      <div class="model-section-body">
                        <template v-if="runnerLatestResult">
                          <label class="field field-full">
                            <span class="field-label">输出结果</span>
                            <textarea class="field-textarea extension-textarea-lg" readonly>{{ runnerLatestResult.text }}</textarea>
                          </label>

                          <label v-if="runnerLatestResult.skillResultText" class="field field-full">
                            <span class="field-label">Skill 执行结果{{ runnerLatestResult.skillFinalOutput ? "（直出最终结果）" : "（补充上下文）" }}</span>
                            <textarea class="field-textarea extension-textarea-md" readonly>{{ runnerLatestResult.skillResultText }}</textarea>
                          </label>

                          <label v-if="runnerLatestResult.mcpResultText" class="field field-full">
                            <span class="field-label">MCP 汇总结果</span>
                            <textarea class="field-textarea extension-textarea-md" readonly>{{ runnerLatestResult.mcpResultText }}</textarea>
                          </label>

                          <label v-if="runnerLatestResult.stopReason" class="field field-full">
                            <span class="field-label">停止原因</span>
                            <textarea class="field-textarea extension-textarea-md" readonly>{{ runnerLatestResult.stopReason }}</textarea>
                          </label>

                          <div class="field field-full">
                            <span class="field-label">MCP 调用明细</span>
                            <div v-if="runnerLatestResult.mcpCalls?.length" class="agent-run-step-list">
                              <article
                                v-for="call in runnerLatestResult.mcpCalls"
                                :key="`${call.createdAt}-${call.serverName}-${call.toolName}-${call.round}`"
                                class="agent-run-step"
                              >
                                <div class="agent-run-step-head">
                                  <p class="agent-run-step-title">第 {{ call.round }} 轮 / {{ call.serverName }} / {{ call.toolName }}</p>
                                  <div class="extension-tag-row">
                                    <span v-if="call.autoSelected" class="pill">自动选择</span>
                                    <span v-if="call.recovered" class="pill">已重试恢复（{{ call.attemptCount }} 次）</span>
                                    <span v-if="call.repairedFromArguments" class="pill">参数已修复</span>
                                    <span v-if="call.fallbackFromToolName" class="pill">fallback 接管</span>
                                    <span v-if="call.isError" class="pill pill-neutral">返回错误标记</span>
                                    <span v-if="call.failureKind" class="pill pill-neutral">{{ formatFailureKind(call.failureKind) }}</span>
                                  </div>
                                </div>

                                <p class="model-card-copy">参数：{{ JSON.stringify(call.arguments ?? {}, null, 2) }}</p>
                                <textarea class="field-textarea extension-textarea-md" readonly>{{ call.resultText }}</textarea>
                              </article>
                            </div>
                            <p v-else class="model-empty-copy">本次运行没有发生 MCP 调用。</p>
                          </div>

                          <div class="field field-full">
                            <span class="field-label">执行步骤</span>
                            <div v-if="runnerLatestResult.steps?.length" class="agent-run-step-list">
                              <article v-for="step in runnerLatestResult.steps" :key="step.id" class="agent-run-step">
                                <div class="agent-run-step-head">
                                  <p class="agent-run-step-title">{{ step.title }}</p>
                                  <span class="pill pill-neutral">{{ formatLocalDateTime(step.createdAt) }}</span>
                                </div>
                                <p class="model-card-copy">{{ step.detail }}</p>
                              </article>
                            </div>
                            <p v-else class="model-empty-copy">本次运行还没有步骤记录。</p>
                          </div>
                        </template>

                        <div v-else class="model-empty">
                          <p class="model-empty-copy">运行完成后，这里会展示输出结果和执行步骤。</p>
                        </div>
                      </div>
                    </section>

                    <section class="model-section extension-section extension-history-section">
                      <div class="model-section-head">
                        <div>
                          <p class="feature-kicker">History</p>
                          <p class="model-section-title">最近执行</p>
                        </div>
                        <span class="pill pill-neutral">{{ runnerRecentLogs.length }} 条</span>
                      </div>

                      <div class="model-section-body model-configured-list">
                        <div v-if="!runnerRecentLogs.length" class="model-empty">
                          <p class="model-empty-copy">当前 Agent 还没有执行记录，先运行一次测试任务。</p>
                        </div>

                        <article v-for="log in runnerRecentLogs" :key="log.id" class="model-config-card">
                          <div class="model-config-head">
                            <div>
                              <p class="model-card-title">{{ log.skillName ?? log.mcpToolName ?? "直接运行" }}</p>
                              <p class="model-card-meta">{{ formatLocalDateTime(log.createdAt) }} / {{ log.profileLabel }}</p>
                            </div>
                            <span class="pill pill-neutral">{{ log.model }}</span>
                          </div>

                          <p class="model-card-copy">{{ truncateText(log.userInput.slice(0, 120) || "无输入内容", 120) }}</p>

                          <div v-if="log.mcpToolName" class="extension-tag-row">
                            <span v-if="log.autoSelectedMcp" class="pill">自动选 MCP</span>
                            <span class="pill pill-neutral">{{ log.mcpServerName ?? "MCP" }}</span>
                            <span class="pill pill-neutral">{{ log.mcpToolName }}</span>
                            <span v-if="(log.mcpCalls?.length ?? 0) > 1" class="pill pill-neutral">{{ log.mcpCalls.length }} 轮 MCP</span>
                            <span v-if="log.stopReason" class="pill pill-neutral">{{ log.stopReason }}</span>
                          </div>
                        </article>
                      </div>
                    </section>
                  </div>
                </template>
              </div>
            </div>
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
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import robotSceneUrl from "../assets/spline-backups/home-robot-scene.splinecode?url";
import WeeklyTaskTree from "./components/WeeklyTaskTree.vue";
import {
  BUILTIN_GORDON_AGENT_ID,
  PROVIDER_ORDER,
  WEEKLY_PROGRESS_STATUS_META,
  buildCommandWorkshopArtifact,
  buildCommandWorkshopTitle,
  cloneWeeklyProgressRecord,
  createWeeklyDraftId,
  createWeeklyProjectDraft,
  createWeeklyTaskDraft,
  formatLocalDateTime,
  getProviderMeta,
  getSkillDisplayName,
  getWeeklyProgressCompletionRate,
  getWeeklyProgressStatusMeta,
  getSkillLocalMirrorDetail,
  getSkillOptionLabel,
  getSkillSourceDetail,
  getSkillSourceLabel,
  getWeeklyProgressMetrics,
  isBuiltinWorkbenchItem,
  maskSecret,
  normalizeTagList,
  parseEnvText,
  renderRichText,
  sanitizeWeeklyProgressRecord,
  sortCommandWorkshopSessions,
  stringifyEnvRecord,
  summarizeCommandWorkshopContent,
  truncateText
} from "./lib/presenter.js";

const FEATURE_HOME = "home";
const FEATURE_MARKETPLACE = "marketplace";
const FEATURE_TASKS = "tasks";
const FEATURE_EFFICIENCY = "efficiency";
const FEATURE_COMMAND_WORKSHOP = "command-workshop";
const FEATURE_MODEL_MANAGEMENT = "model-management";
const FEATURE_EXTENSIONS_MANAGEMENT = "extensions-management";

const FEATURE_ENTRIES = [
  {
    id: FEATURE_HOME,
    kicker: "Home",
    title: "首页",
    tier: "flat"
  },
  {
    id: FEATURE_MARKETPLACE,
    kicker: "Market",
    title: "应用广场",
    tier: "wide"
  },
  {
    id: FEATURE_TASKS,
    kicker: "Tasks",
    title: "任务推进",
    tier: "default"
  },
  {
    id: FEATURE_EFFICIENCY,
    kicker: "Efficiency",
    title: "效率工具",
    tier: "wide"
  },
  {
    id: FEATURE_COMMAND_WORKSHOP,
    kicker: "Command",
    title: "命令工坊",
    tier: "default"
  }
];

const HOME_SETTINGS_ITEMS = [
  {
    id: FEATURE_MODEL_MANAGEMENT,
    title: "模型管理",
    copy: "配置优先模型与供应商"
  },
  {
    id: FEATURE_EXTENSIONS_MANAGEMENT,
    title: "能力拓展",
    copy: "管理 Agent、Skill 与 MCP"
  }
];

const FEATURE_PLACEHOLDERS = {
  [FEATURE_MARKETPLACE]: {
    title: "应用广场",
    description: "这里会继续承接应用发现、工具接入和能力分发。"
  },
  [FEATURE_EFFICIENCY]: {
    title: "效率工具",
    description: "这里会继续承接日报生成、文案改写与效率辅助能力。"
  }
};

const ACTION_ICONS = {
  edit: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <path d="M4 20h4.2L18.4 9.8a2.2 2.2 0 0 0 0-3.1l-1.1-1.1a2.2 2.2 0 0 0-3.1 0L4 15.8V20Z" fill="currentColor" opacity="0.14" />
      <path d="M13.5 6.5 17.5 10.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M4 20h4.2L18.4 9.8a2.2 2.2 0 0 0 0-3.1l-1.1-1.1a2.2 2.2 0 0 0-3.1 0L4 15.8V20Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
    </svg>
  `,
  play: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.12" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="m10 8.8 5.8 3.2-5.8 3.2Z" fill="currentColor" opacity="0.9" />
    </svg>
  `,
  gear: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <path d="M10.2 3.8h3.6l.6 2a6.9 6.9 0 0 1 1.5.9l2-.6 1.8 3.1-1.5 1.4c.1.4.2.9.2 1.4s-.1 1-.2 1.4l1.5 1.4-1.8 3.1-2-.6a6.9 6.9 0 0 1-1.5.9l-.6 2h-3.6l-.6-2a6.9 6.9 0 0 1-1.5-.9l-2 .6-1.8-3.1 1.5-1.4A6.6 6.6 0 0 1 5.5 12c0-.5.1-1 .2-1.4L4.2 9.2 6 6.1l2 .6a6.9 6.9 0 0 1 1.5-.9l.7-2Z" fill="currentColor" opacity="0.12" />
      <path d="M10.2 3.8h3.6l.6 2a6.9 6.9 0 0 1 1.5.9l2-.6 1.8 3.1-1.5 1.4c.1.4.2.9.2 1.4s-.1 1-.2 1.4l1.5 1.4-1.8 3.1-2-.6a6.9 6.9 0 0 1-1.5.9l-.6 2h-3.6l-.6-2a6.9 6.9 0 0 1-1.5-.9l-2 .6-1.8-3.1 1.5-1.4A6.6 6.6 0 0 1 5.5 12c0-.5.1-1 .2-1.4L4.2 9.2 6 6.1l2 .6a6.9 6.9 0 0 1 1.5-.9l.7-2Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8" />
    </svg>
  `,
  return: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <path d="M8 7 4 11l4 4" fill="currentColor" opacity="0.16" />
      <path d="M8 7 4 11l4 4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M5 11h8a7 7 0 0 1 7 7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
    </svg>
  `,
  enter: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <path d="M14.5 3.8H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-3.5" fill="currentColor" opacity="0.1" />
      <path d="M14.5 3.8H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-3.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M4 12h11" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
      <path d="m10 7 5 5-5 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
    </svg>
  `,
  jump: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <path d="M6 7.5a1.5 1.5 0 0 1 1.5-1.5h6.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M6 10v7a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 17v-4.5" fill="currentColor" opacity="0.1" />
      <path d="M6 10v7a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 17v-4.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M13 5.5H19V11.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="m10 14 9-9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
    </svg>
  `,
  delete: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <path d="M8 8.5h8l-.8 10.2a1.6 1.6 0 0 1-1.6 1.5h-3.2a1.6 1.6 0 0 1-1.6-1.5L8 8.5Z" fill="currentColor" opacity="0.12" />
      <path d="M4.5 6.5h15" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
      <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v1.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="m8 8.5.8 10.2a1.6 1.6 0 0 0 1.6 1.5h3.2a1.6 1.6 0 0 0 1.6-1.5L16 8.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M10.5 11v5M13.5 11v5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
    </svg>
  `,
  copy: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <rect x="9" y="8" width="10" height="12" rx="2" fill="currentColor" opacity="0.12" />
      <rect x="9" y="8" width="10" height="12" rx="2" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
      <path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
    </svg>
  `,
  check: `
    <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.12" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="m8.5 12.2 2.5 2.5 4.8-5.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" />
    </svg>
  `
};

const WEEKLY_RISK_KEYWORDS = ["风险", "问题", "阻塞", "受阻", "卡点", "依赖", "待协调", "延期", "等待"];
const WEEKLY_NO_RISK_PATTERN = /(暂无风险|无风险|无阻塞|暂无阻塞|未发现阻塞|风险可控)/;
const WEEKLY_AUTOSAVE_DELAY = 700;
const DAILY_REPORT_GUIDE_COPY = [
  "系统会自动遍历今天有更新的叶子任务。",
  "更新范围包括：修改任务内容、修改任务状态。",
  "输出结果会按项目归组，仅保留今天推进过的任务清单。"
].join("\n");

const desktopApi = window.gordonDesktop ?? null;
let splineApplicationClass = null;
let splineApplicationPromise = null;
let weeklyAutosaveTimer = null;
let weeklySavedSnapshot = "";
let weeklyAutosaveInFlight = false;
let weeklyReportCopyTimer = null;

function createEmptyModelSettings() {
  return {
    profiles: [],
    activeProfileId: null
  };
}

function createModelEditorState(provider = "openai", profile = null) {
  return {
    mode: profile ? "edit" : "create",
    profileId: profile?.id ?? null,
    provider,
    values: {
      displayName: profile?.displayName ?? "",
      model: profile?.model ?? "",
      apiKey: profile?.apiKey ?? "",
      baseUrl: profile?.baseUrl ?? "",
      organization: profile?.organization ?? "",
      project: profile?.project ?? "",
      location: profile?.location ?? "",
      notes: profile?.notes ?? ""
    }
  };
}

function createWeeklyState() {
  return {
    view: "list",
    activeRecordId: null,
    draft: null,
    collapsedProjectIds: [],
    editorView: "projects",
    reportingMode: "weekly",
    reportFeedbackText: "",
    reportFeedbackTone: "neutral",
    reportCopyState: "idle",
    isGeneratingReport: false,
    generatingReportKind: null
  };
}

function createCommandDraft(agentProfileId = "") {
  return {
    agentProfileId,
    skillId: "",
    autoSelectMcp: true,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}"
  };
}

function createExtensionEditorState(kind = "agent", entry = null) {
  if (kind === "skill") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        promptTemplate: entry?.promptTemplate ?? "",
        handlerRef: entry?.handlerRef ?? ""
      }
    };
  }

  if (kind === "skill-import") {
    return {
      kind,
      mode: "create",
      entryId: null,
      values: {
        repo: "",
        ref: "main",
        path: ""
      }
    };
  }

  if (kind === "mcp") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        transport: entry?.transport ?? "stdio",
        command: entry?.command ?? "",
        url: entry?.url ?? "",
        envText: stringifyEnvRecord(entry?.env ?? {}),
        toolAllowlist: (entry?.toolAllowlist ?? []).join(", ")
      }
    };
  }

  return {
    kind: "agent",
    mode: entry ? "edit" : "create",
    entryId: entry?.id ?? null,
    values: {
      name: entry?.name ?? "",
      description: entry?.description ?? "",
      mode: entry?.mode ?? "task",
      modelProfileId: entry?.modelProfileId ?? "",
      systemPrompt: entry?.systemPrompt ?? "",
      allowedSkillIds: [...(entry?.allowedSkillIds ?? [])],
      allowedMcpServerIds: [...(entry?.allowedMcpServerIds ?? [])]
    }
  };
}

function createAgentRunnerState(agentId = "") {
  return {
    agentId,
    skillId: "",
    autoSelectMcp: false,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}",
    availableMcpTools: [],
    userInput: "",
    result: null,
    isRunning: false
  };
}

function getExtensionListTab(kind = "agent") {
  if (kind === "skill" || kind === "skill-import") {
    return "skill";
  }

  if (kind === "mcp") {
    return "mcp";
  }

  return "agent";
}

function createExtensionsState() {
  return {
    view: "list",
    listTab: "agent",
    editor: createExtensionEditorState("agent"),
    runner: createAgentRunnerState()
  };
}

function getProviderFields(provider) {
  const commonFields = [
    { key: "displayName", label: "配置名称", placeholder: "例如：OpenAI 主账号", required: true, full: false },
    { key: "model", label: "模型名称", placeholder: "例如：gpt-4.1", required: true, full: false },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", required: true, full: true }
  ];
  const openAiCompatibleProviders = new Set([
    "openai_like",
    "doubao",
    "qwen",
    "deepseek",
    "moonshot",
    "zhipu",
    "grok"
  ]);

  if (provider === "openai") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: false },
      { key: "organization", label: "Organization", placeholder: "可选", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "google") {
    return [
      ...commonFields,
      { key: "project", label: "Project", placeholder: "例如：gordon-prod", required: false, full: false },
      { key: "location", label: "Location", placeholder: "例如：us-central1", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "azure") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "Azure OpenAI / Azure AI 推理终端地址", required: true, full: false },
      { key: "notes", label: "备注", placeholder: "可补充资源组、区域或部署说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "anthropic") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (openAiCompatibleProviders.has(provider)) {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "兼容 OpenAI 的服务地址", required: true, full: false },
      { key: "notes", label: "备注", placeholder: "可补充厂商网关、环境或线路说明", required: false, full: true, textarea: true }
    ];
  }

  return [
    ...commonFields,
    { key: "baseUrl", label: "Base URL", placeholder: "自定义网关地址", required: true, full: false },
    { key: "notes", label: "备注", placeholder: "例如：DeepSeek / Kimi / Qwen / Doubao", required: false, full: true, textarea: true }
  ];
}

function normalizeCommandWorkshopSession(session) {
  return {
    ...session,
    ...normalizeCommandWorkshopConfig(session),
    messages: [...(session?.messages ?? [])]
  };
}

const activeFeature = ref(FEATURE_HOME);
const homeSettingsMenuRef = ref(null);
const robotCanvasRef = ref(null);
const commandInputRef = ref(null);
const commandMessagesRef = ref(null);
const weeklyTaskRewriteIds = ref([]);

const status = reactive({
  text: "正在加载工作台...",
  tone: "neutral"
});

const workbench = reactive({
  snapshot: null,
  modelSettings: createEmptyModelSettings(),
  weeklyProgress: [],
  skillDefinitions: [],
  mcpServers: [],
  agentProfiles: [],
  agentRunLogs: [],
  commandSessions: []
});

const ui = reactive({
  modelManagement: {
    view: "list",
    editor: createModelEditorState("openai")
  },
  weekly: createWeeklyState(),
  command: {
    view: "list",
    composerView: "input",
    activeSessionId: null,
    form: createCommandDraft(),
    draftInput: "",
    availableMcpTools: [],
    isRunning: false
  },
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
    (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat")
);

const providerOptions = computed(() =>
  PROVIDER_ORDER.map((kind) => {
    const provider = workbench.snapshot?.providers?.find((entry) => entry.kind === kind);
    const meta = getProviderMeta(kind);

    return {
      kind,
      label: meta.label,
      short: meta.short,
      copy: provider?.notes ?? meta.copy,
      popularModels: meta.popularModels
    };
  })
);

const activeModel = computed(() =>
  workbench.modelSettings.profiles.find((profile) => profile.id === workbench.modelSettings.activeProfileId) ?? null
);

const enabledAgentProfiles = computed(() => workbench.agentProfiles.filter((profile) => profile.enabled));
const enabledSkills = computed(() => workbench.skillDefinitions.filter((skill) => skill.enabled));
const enabledMcpServers = computed(() => workbench.mcpServers.filter((server) => server.enabled));

const modelEditorFields = computed(() => getProviderFields(ui.modelManagement.editor.provider));

const activeWeeklyRecord = computed(() =>
  workbench.weeklyProgress.find((record) => record.id === ui.weekly.activeRecordId) ?? null
);

const weeklyFocusRecord = computed(
  () => workbench.weeklyProgress.find((record) => record.status === "active") ?? workbench.weeklyProgress[0] ?? null
);
const weeklyFocusMetrics = computed(() => getWeeklyProgressMetrics(weeklyFocusRecord.value ?? { projects: [] }));
const weeklyFocusCompletionRate = computed(() => getWeeklyProgressCompletionRate(weeklyFocusRecord.value ?? { projects: [] }));
const weeklyDraft = computed(() => ui.weekly.draft);
const weeklyReportTemplates = computed(() => (Array.isArray(ui.weekly.draft?.reportTemplates) ? ui.weekly.draft.reportTemplates : []));
const weeklyIsWeeklyReportMode = computed(() => ui.weekly.reportingMode !== "daily");
const weeklyReportModeLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "周报" : "日报"));
const weeklySelectedReportTemplate = computed(() => getWeeklySelectedReportTemplate(ui.weekly.draft));
const weeklySelectedReportTemplateContent = computed({
  get: () => weeklySelectedReportTemplate.value?.content ?? "",
  set: (value) => {
    const template = weeklySelectedReportTemplate.value;

    if (!template || template.builtin) {
      return;
    }

    const nextContent = String(value ?? "");
    template.content = nextContent;

    if (ui.weekly.draft) {
      ui.weekly.draft.reportTemplate = nextContent;
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
  () => !weeklyIsWeeklyReportMode.value || Boolean(weeklySelectedReportTemplate.value?.builtin || ui.weekly.isGeneratingReport)
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
const weeklyReportOutputLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "发送给领导的周报" : "今日日报"));
const weeklyReportOutputPlaceholder = computed(() =>
  weeklyIsWeeklyReportMode.value
    ? "点击右上角执行按钮后，会在这里填充周报结果，确认后再保存"
    : "点击右上角执行按钮后，会在这里填充今天有更新任务的日报结果"
);
const weeklyReportOutputContent = computed({
  get: () => (weeklyIsWeeklyReportMode.value ? ui.weekly.draft?.generatedReport ?? "" : ui.weekly.draft?.generatedDailyReport ?? ""),
  set: (value) => {
    if (!ui.weekly.draft) {
      return;
    }

    if (weeklyIsWeeklyReportMode.value) {
      ui.weekly.draft.generatedReport = String(value ?? "");
      resetWeeklyReportCopyState();
      return;
    }

    ui.weekly.draft.generatedDailyReport = String(value ?? "");
    resetWeeklyReportCopyState();
  }
});
const weeklyActiveReportIsGenerating = computed(
  () => ui.weekly.isGeneratingReport && ui.weekly.generatingReportKind === (weeklyIsWeeklyReportMode.value ? "weekly" : "daily")
);
const weeklyReportRunButtonLabel = computed(() =>
  weeklyActiveReportIsGenerating.value ? `${weeklyReportModeLabel.value}生成中` : `生成${weeklyReportModeLabel.value}`
);
const weeklyReportFeedbackText = computed(() => {
  const customText = String(ui.weekly.reportFeedbackText ?? "").trim();

  if (customText) {
    return customText;
  }

  return weeklyIsWeeklyReportMode.value ? "按当前模板生成周报输出。" : "仅提取今天有更新的叶子任务。";
});
const weeklyReportFeedbackTone = computed(() => {
  const tone = String(ui.weekly.reportFeedbackTone ?? "").trim();
  return tone || "neutral";
});
const weeklyCanCopyReportOutput = computed(() => Boolean(String(weeklyReportOutputContent.value ?? "").trim()));
const weeklyReportCopyIconKind = computed(() => (ui.weekly.reportCopyState === "copied" ? "check" : "copy"));
const weeklyReportCopyButtonLabel = computed(() =>
  ui.weekly.reportCopyState === "copied"
    ? `${weeklyReportModeLabel.value}已复制`
    : weeklyCanCopyReportOutput.value
      ? `复制${weeklyReportModeLabel.value}`
      : `当前没有可复制的${weeklyReportModeLabel.value}内容`
);
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
const weeklyDraftInsights = computed(() => buildWeeklyDraftInsights(ui.weekly.draft));

const activeCommandSession = computed(() =>
  workbench.commandSessions.find((session) => session.id === ui.command.activeSessionId) ?? null
);

const activeCommandMessages = computed(() => activeCommandSession.value?.messages ?? []);
const commandSelectedAgent = computed(() => getAgentById(ui.command.form.agentProfileId));
const commandRunnableSkills = computed(() => getAgentRunnableSkills(ui.command.form.agentProfileId));
const commandAuthorizedServers = computed(() => getAuthorizedMcpServersForAgent(ui.command.form.agentProfileId));

const commandToolOptions = computed(() => {
  const options = [...ui.command.availableMcpTools];

  if (ui.command.form.mcpToolName && !options.some((tool) => tool.name === ui.command.form.mcpToolName)) {
    options.unshift({
      name: ui.command.form.mcpToolName,
      description: "当前已保存工具",
      serverId: ui.command.form.mcpServerId,
      serverName: commandAuthorizedServers.value.find((server) => server.id === ui.command.form.mcpServerId)?.name ?? ""
    });
  }

  return options;
});

const commandChatTitle = computed(() => truncateText(activeCommandSession.value?.title ?? "开始一轮协作", 10) || "开始一轮协作");

const commandSettingsSummary = computed(() => {
  const selectedAgent = getAgentById(ui.command.form.agentProfileId);

  return [
    selectedAgent?.name ?? "Gordon",
    resolveBoundModelName(selectedAgent?.modelProfileId),
    getCommandWorkshopModeLabel(ui.command.form),
    getCommandWorkshopToolModeLabel(ui.command.form)
  ].join(" / ");
});

const runnerAgent = computed(() => getAgentById(ui.extensions.runner.agentId));
const runnerRunnableSkills = computed(() => getAgentRunnableSkills(ui.extensions.runner.agentId));
const runnerAuthorizedServers = computed(() => getAuthorizedMcpServersForAgent(ui.extensions.runner.agentId));
const runnerRecentLogs = computed(() => getRecentAgentRunLogs(ui.extensions.runner.agentId));
const runnerLatestResult = computed(() => ui.extensions.runner.result ?? runnerRecentLogs.value[0] ?? null);

function setStatus(text, tone = "neutral") {
  status.text = text;
  status.tone = tone;
}

function clearWeeklyAutosaveTimer() {
  if (weeklyAutosaveTimer) {
    clearTimeout(weeklyAutosaveTimer);
    weeklyAutosaveTimer = null;
  }
}

function getWeeklyDraftSnapshot(record = ui.weekly.draft) {
  const sanitized = sanitizeWeeklyProgressRecord(record);

  if (!sanitized) {
    return "";
  }

  return JSON.stringify({
    projects: sanitized.projects,
    reportTemplates: sanitized.reportTemplates,
    selectedReportTemplateId: sanitized.selectedReportTemplateId,
    reportTemplate: sanitized.reportTemplate,
    generatedDailyReport: sanitized.generatedDailyReport,
    generatedReport: sanitized.generatedReport,
    content: sanitized.content
  });
}

function markWeeklyDraftSaved(record = ui.weekly.draft) {
  weeklySavedSnapshot = getWeeklyDraftSnapshot(record);
}

function clearWeeklyReportFeedback() {
  ui.weekly.reportFeedbackText = "";
  ui.weekly.reportFeedbackTone = "neutral";
}

function clearWeeklyReportCopyTimer() {
  if (weeklyReportCopyTimer) {
    clearTimeout(weeklyReportCopyTimer);
    weeklyReportCopyTimer = null;
  }
}

function resetWeeklyReportCopyState() {
  clearWeeklyReportCopyTimer();
  ui.weekly.reportCopyState = "idle";
}

function markWeeklyReportCopied() {
  clearWeeklyReportCopyTimer();
  ui.weekly.reportCopyState = "copied";
  weeklyReportCopyTimer = setTimeout(() => {
    ui.weekly.reportCopyState = "idle";
    weeklyReportCopyTimer = null;
  }, 1600);
}

function setWeeklyReportFeedback(text, tone = "neutral") {
  ui.weekly.reportFeedbackText = String(text ?? "").trim();
  ui.weekly.reportFeedbackTone = tone;
}

function setWeeklyReportingMode(mode) {
  if (ui.weekly.reportingMode === mode) {
    return;
  }

  ui.weekly.reportingMode = mode;
  clearWeeklyReportFeedback();
  resetWeeklyReportCopyState();
}

function getWeeklyTaskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

function hasWeeklyTaskContent(task) {
  return Boolean(String(task?.title ?? "").trim() || String(task?.detail ?? "").trim() || getWeeklyTaskChildren(task).length);
}

function walkWeeklyTasks(tasks = [], visitor, parentTask = null) {
  for (const task of Array.isArray(tasks) ? tasks : []) {
    visitor(task, parentTask);
    walkWeeklyTasks(getWeeklyTaskChildren(task), visitor, task);
  }
}

function flattenWeeklyTasks(tasks = []) {
  const flattened = [];
  walkWeeklyTasks(tasks, (task) => {
    flattened.push(task);
  });
  return flattened;
}

function getWeeklyTaskTimestamp(task, fieldName) {
  return String(task?.[fieldName] ?? "").trim();
}

function touchWeeklyTask(task, timestamp = new Date().toISOString()) {
  if (!task) {
    return null;
  }

  if (!getWeeklyTaskTimestamp(task, "createdAt")) {
    task.createdAt = timestamp;
  }

  task.updatedAt = timestamp;
  return task;
}

function touchWeeklyTaskById(projectId, taskId, timestamp = new Date().toISOString()) {
  const project = findWeeklyProjectById(projectId);

  if (!project) {
    return null;
  }

  const task = findWeeklyTaskContext(project.tasks, taskId)?.task ?? null;

  if (!task) {
    return null;
  }

  touchWeeklyTask(task, timestamp);
  return task;
}

function getLocalDateKey(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDailyReportDateTitle(referenceDate = new Date()) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(date);
}

function collectTodayUpdatedLeafTasks(projects = [], referenceDate = new Date()) {
  const todayKey = getLocalDateKey(referenceDate);
  const entries = [];

  for (const project of Array.isArray(projects) ? projects : []) {
    const projectTitle = String(project?.title ?? "").trim() || "未命名项目";

    const visit = (tasks = [], path = []) => {
      tasks.forEach((task, index) => {
        const nextPath = [...path, index + 1];
        const children = getWeeklyTaskChildren(task);
        const title = String(task?.title ?? "").trim();

        if (children.length) {
          visit(children, nextPath);
          return;
        }

        if (!title || getLocalDateKey(task?.updatedAt) !== todayKey) {
          return;
        }

        entries.push({
          projectTitle,
          taskPath: nextPath.join("."),
          title,
          statusLabel: getWeeklyProgressStatusMeta(task?.status).label,
          createdAt: getWeeklyTaskTimestamp(task, "createdAt"),
          updatedAt: getWeeklyTaskTimestamp(task, "updatedAt")
        });
      });
    };

    visit(project.tasks);
  }

  return entries;
}

function buildDailyReportSourceContent(record) {
  const entries = collectTodayUpdatedLeafTasks(record?.projects ?? []);

  if (!entries.length) {
    return {
      entries,
      content: ""
    };
  }

  const groupedEntries = new Map();

  entries.forEach((entry) => {
    if (!groupedEntries.has(entry.projectTitle)) {
      groupedEntries.set(entry.projectTitle, []);
    }

    groupedEntries.get(entry.projectTitle).push(entry);
  });

  const lines = [];

  groupedEntries.forEach((projectEntries, projectTitle) => {
    lines.push(`项目：${projectTitle}`);
    projectEntries.forEach((entry) => {
      lines.push(`- 任务路径：${entry.taskPath}`);
      lines.push(`  任务内容：${entry.title}`);
      lines.push(`  当前状态：${entry.statusLabel}`);

      if (entry.createdAt) {
        lines.push(`  创建时间：${formatLocalDateTime(entry.createdAt)}`);
      }

      if (entry.updatedAt) {
        lines.push(`  更新时间：${formatLocalDateTime(entry.updatedAt)}`);
      }
    });
    lines.push("");
  });

  return {
    entries,
    content: lines.join("\n").trim()
  };
}

function findWeeklyTaskContext(tasks = [], taskId, parentTask = null) {
  const taskList = Array.isArray(tasks) ? tasks : [];

  for (let index = 0; index < taskList.length; index += 1) {
    const task = taskList[index];

    if (task?.id === taskId) {
      return {
        task,
        parentTask,
        tasks: taskList,
        index
      };
    }

    const childContext = findWeeklyTaskContext(getWeeklyTaskChildren(task), taskId, task);

    if (childContext) {
      return childContext;
    }
  }

  return null;
}

function removeWeeklyTaskFromCollection(tasks = [], taskId) {
  const context = findWeeklyTaskContext(tasks, taskId);

  if (!context) {
    return false;
  }

  context.tasks.splice(context.index, 1);
  return true;
}

function deriveWeeklyProjectStatus(tasks = []) {
  const meaningfulTasks = flattenWeeklyTasks(tasks).filter((task) => hasWeeklyTaskContent(task));

  if (!meaningfulTasks.length) {
    return "in_progress";
  }

  if (meaningfulTasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }

  if (meaningfulTasks.every((task) => task.status === "completed")) {
    return "completed";
  }

  if (meaningfulTasks.some((task) => task.status === "in_progress" || task.status === "completed")) {
    return "in_progress";
  }

  return "planned";
}

function syncWeeklyProjectStatus(project) {
  if (!project) {
    return;
  }

  project.status = deriveWeeklyProjectStatus(project.tasks);
}

function getWeeklySelectedReportTemplate(draft = ui.weekly.draft) {
  const templates = Array.isArray(draft?.reportTemplates) ? draft.reportTemplates : [];

  if (!templates.length) {
    return null;
  }

  return templates.find((template) => template.id === String(draft?.selectedReportTemplateId ?? "").trim()) ?? templates[0];
}

function syncWeeklySelectedReportTemplate(draft = ui.weekly.draft) {
  if (!draft) {
    return;
  }

  const selectedTemplate = getWeeklySelectedReportTemplate(draft);

  if (!selectedTemplate) {
    draft.selectedReportTemplateId = "";
    draft.reportTemplate = String(draft.reportTemplate ?? "");
    return;
  }

  if (draft.selectedReportTemplateId !== selectedTemplate.id) {
    draft.selectedReportTemplateId = selectedTemplate.id;
  }

  const selectedContent = String(selectedTemplate.content ?? "");

  if (draft.reportTemplate !== selectedContent) {
    draft.reportTemplate = selectedContent;
  }
}

function getWeeklyReportTemplateOptionLabel(template) {
  const name = String(template?.name ?? "").trim() || (template?.builtin ? "默认模板" : "未命名模板");
  return template?.builtin ? `${name}（默认）` : name;
}

function getNextWeeklyReportTemplateName(draft = ui.weekly.draft) {
  const existingNames = new Set(
    (Array.isArray(draft?.reportTemplates) ? draft.reportTemplates : [])
      .map((template) => String(template?.name ?? "").trim())
      .filter(Boolean)
  );

  let index = 1;
  let candidate = `自定义模板 ${index}`;

  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `自定义模板 ${index}`;
  }

  return candidate;
}

function focusWeeklyProjectInput(projectId) {
  nextTick(() => {
    const input = document.querySelector(`[data-weekly-project-input="${projectId}"]`);

    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  });
}

function focusWeeklyTaskInput(taskId) {
  nextTick(() => {
    const input = document.querySelector(`[data-weekly-task-input="${taskId}"]`);

    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.focus();
      input.select();
      return;
    }

    if (input instanceof HTMLButtonElement) {
      input.click();
    }
  });
}

function scheduleWeeklyAutosave() {
  if (ui.weekly.view !== "editor" || !ui.weekly.draft) {
    return;
  }

  clearWeeklyAutosaveTimer();
  weeklyAutosaveTimer = setTimeout(() => {
    handleWeeklySave({ silent: true, reason: "auto" });
  }, WEEKLY_AUTOSAVE_DELAY);
}

function extractWeeklyMeaningfulLines(value) {
  return String(value ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim().replace(/^[-*+•]\s*/, ""))
    .filter(Boolean);
}

function getWeeklyFirstMeaningfulLine(value) {
  return extractWeeklyMeaningfulLines(value)[0] ?? "";
}

function findWeeklyRiskNotes(value) {
  return extractWeeklyMeaningfulLines(value).filter((line) => WEEKLY_RISK_KEYWORDS.some((keyword) => line.includes(keyword)));
}

function getWeeklyRecordTags(record) {
  const metrics = getWeeklyProgressMetrics(record);
  const tags = [`项目 ${metrics.projectCount}`, `任务 ${metrics.taskCount}`];

  if (metrics.blockedTaskCount) {
    tags.push(`风险 ${metrics.blockedTaskCount}`);
  }

  return tags;
}

function buildWeeklyInsightEntry(category, project, task, detail = "") {
  const primary = task?.title?.trim() || detail || getWeeklyFirstMeaningfulLine(task?.detail) || project?.title?.trim() || "未命名事项";
  const secondary = detail || getWeeklyFirstMeaningfulLine(task?.detail) || "";

  return {
    id: `${category}-${project?.id ?? "record"}-${task?.id ?? primary}`,
    title: primary,
    meta: project?.title?.trim() || "未命名项目",
    detail: secondary && secondary !== primary ? secondary : ""
  };
}

function dedupeWeeklyInsights(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.meta}-${item.title}-${item.detail}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildWeeklyDraftInsights(record) {
  const empty = {
    qualityChecks: [
      {
        id: "result",
        label: "本周有结论或结果",
        done: false,
        hint: "至少补 1 条阶段结果，周报才不会像流水账。"
      },
      {
        id: "risk",
        label: "风险与协调事项明确",
        done: false,
        hint: "如果当前无风险，建议补一句“当前暂无阻塞”。"
      },
      {
        id: "next",
        label: "下周动作可继续推进",
        done: false,
        hint: "为进行中项目至少补 1 条下周动作。"
      },
      {
        id: "report",
        label: "领导周报已准备",
        done: false,
        hint: "右侧生成后再人工确认一次，会更稳。"
      }
    ],
    achievements: [],
    risks: [],
    nextSteps: []
  };

  if (!record) {
    return empty;
  }

  const achievements = [];
  const risks = [];
  const nextSteps = [];
  let hasNoRiskStatement = false;

  for (const project of record.projects ?? []) {
    const noteLines = extractWeeklyMeaningfulLines(project.note);
    const riskNotes = findWeeklyRiskNotes(project.note);
    const projectTasks = flattenWeeklyTasks(project.tasks).filter((task) => hasWeeklyTaskContent(task));

    if (WEEKLY_NO_RISK_PATTERN.test(project.note)) {
      hasNoRiskStatement = true;
    }

    if (project.note.trim() && !projectTasks.length) {
      achievements.push(buildWeeklyInsightEntry("project-note", project, null, getWeeklyFirstMeaningfulLine(project.note)));
    }

    for (const riskLine of riskNotes) {
      risks.push(buildWeeklyInsightEntry("risk-note", project, null, riskLine));
    }

    for (const task of projectTasks) {
      if (task.status === "completed") {
        achievements.push(buildWeeklyInsightEntry("achievement", project, task, getWeeklyFirstMeaningfulLine(task.detail)));
        continue;
      }

      if (task.status === "blocked") {
        risks.push(buildWeeklyInsightEntry("risk-task", project, task, getWeeklyFirstMeaningfulLine(task.detail)));
        continue;
      }

      nextSteps.push(buildWeeklyInsightEntry("next-step", project, task, getWeeklyFirstMeaningfulLine(task.detail)));
    }

    if (!projectTasks.length && noteLines.length > 1) {
      nextSteps.push(buildWeeklyInsightEntry("project-follow-up", project, null, noteLines[1]));
    }
  }

  const uniqueAchievements = dedupeWeeklyInsights(achievements).slice(0, 6);
  const uniqueRisks = dedupeWeeklyInsights(risks).slice(0, 6);
  const uniqueNextSteps = dedupeWeeklyInsights(nextSteps).slice(0, 6);

  return {
    qualityChecks: [
      {
        id: "result",
        label: "本周有结论或结果",
        done: uniqueAchievements.length > 0,
        hint: uniqueAchievements.length ? `已识别 ${uniqueAchievements.length} 条可汇报结果。` : "至少补 1 条阶段结果，周报才不会像流水账。"
      },
      {
        id: "risk",
        label: "风险与协调事项明确",
        done: uniqueRisks.length > 0 || hasNoRiskStatement,
        hint:
          uniqueRisks.length > 0
            ? `已识别 ${uniqueRisks.length} 条风险或待协调事项。`
            : hasNoRiskStatement
              ? "已明确写出当前无显式阻塞。"
              : "如果当前无风险，建议补一句“当前暂无阻塞”。"
      },
      {
        id: "next",
        label: "下周动作可继续推进",
        done: uniqueNextSteps.length > 0,
        hint: uniqueNextSteps.length ? `已识别 ${uniqueNextSteps.length} 条下周动作。` : "为进行中项目至少补 1 条下周动作。"
      },
      {
        id: "report",
        label: "领导周报已准备",
        done: Boolean(String(record.generatedReport ?? "").trim()),
        hint: String(record.generatedReport ?? "").trim() ? "领导稿已经生成，建议再人工改一轮。" : "右侧生成后再人工确认一次，会更稳。"
      }
    ],
    achievements: uniqueAchievements,
    risks: uniqueRisks,
    nextSteps: uniqueNextSteps
  };
}

function renderActionIcon(kind) {
  return ACTION_ICONS[kind] ?? ACTION_ICONS.delete;
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

function getExtensionInitials(value) {
  const compact = String(value ?? "").trim();

  if (!compact) {
    return "EX";
  }

  return compact
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.slice(0, 1).toUpperCase())
    .join("");
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

function getPreferredCommandWorkshopAgent(configuredAgentId = "") {
  return (
    enabledAgentProfiles.value.find((profile) => profile.id === String(configuredAgentId ?? "").trim()) ??
    enabledAgentProfiles.value.find((profile) => profile.id === BUILTIN_GORDON_AGENT_ID) ??
    enabledAgentProfiles.value[0] ??
    null
  );
}

function normalizeCommandWorkshopConfig(config = {}) {
  const selectedAgent = getPreferredCommandWorkshopAgent(config.agentProfileId);
  const agentProfileId = selectedAgent?.id ?? "";
  const skillIdCandidate = String(config.skillId ?? "").trim();
  const mcpServerIdCandidate = String(config.mcpServerId ?? "").trim();
  const mcpToolNameCandidate = String(config.mcpToolName ?? "").trim();
  const runnableSkills = selectedAgent ? getAgentRunnableSkills(selectedAgent.id) : [];
  const authorizedServers = selectedAgent ? getAuthorizedMcpServersForAgent(selectedAgent.id) : [];
  const hasAuthorizedServer = authorizedServers.some((server) => server.id === mcpServerIdCandidate);

  return {
    agentProfileId,
    skillId: runnableSkills.some((skill) => skill.id === skillIdCandidate) ? skillIdCandidate : "",
    autoSelectMcp: config.autoSelectMcp !== false,
    mcpServerId: hasAuthorizedServer ? mcpServerIdCandidate : "",
    mcpToolName: hasAuthorizedServer ? mcpToolNameCandidate : "",
    mcpArgumentsText: String(config.mcpArgumentsText ?? "{}").trim() || "{}"
  };
}

function syncWeeklyEditorState() {
  if (!activeWeeklyRecord.value) {
    ui.weekly.draft = null;
    weeklyTaskRewriteIds.value = [];
    clearWeeklyReportFeedback();
    resetWeeklyReportCopyState();
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
    markWeeklyDraftSaved(null);
    return;
  }

  clearWeeklyAutosaveTimer();
  ui.weekly.draft = cloneWeeklyProgressRecord(activeWeeklyRecord.value);
  ui.weekly.draft?.projects?.forEach((project) => syncWeeklyProjectStatus(project));
  syncWeeklySelectedReportTemplate(ui.weekly.draft);
  ui.weekly.collapsedProjectIds = [];
  weeklyTaskRewriteIds.value = [];
  clearWeeklyReportFeedback();
  resetWeeklyReportCopyState();
  ui.weekly.isGeneratingReport = false;
  ui.weekly.generatingReportKind = null;
  markWeeklyDraftSaved(ui.weekly.draft);
}

function applyWorkbenchSnapshot(snapshot, modelSettings) {
  workbench.snapshot = snapshot;
  workbench.modelSettings = modelSettings;
  workbench.weeklyProgress = [...(snapshot?.weeklyProgress ?? [])];
  workbench.skillDefinitions = [...(snapshot?.skillDefinitions ?? [])];
  workbench.mcpServers = [...(snapshot?.mcpServers ?? [])];
  workbench.agentProfiles = [...(snapshot?.agentProfiles ?? [])];
  workbench.agentRunLogs = [...(snapshot?.agentRunLogs ?? [])];
  workbench.commandSessions = sortCommandWorkshopSessions((snapshot?.commandWorkshopSessions ?? []).map((session) => normalizeCommandWorkshopSession(session)));

  if (!ui.weekly.activeRecordId || !workbench.weeklyProgress.some((record) => record.id === ui.weekly.activeRecordId)) {
    ui.weekly.activeRecordId =
      workbench.weeklyProgress.find((record) => record.status === "active")?.id ?? workbench.weeklyProgress[0]?.id ?? null;
  }

  if (ui.weekly.view === "editor") {
    syncWeeklyEditorState();
  }

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
    const [snapshot, modelSettings] = await Promise.all([desktopApi.bootstrap(), desktopApi.listModelSettings()]);
    applyWorkbenchSnapshot(snapshot, modelSettings);
    setStatus("工作台已就绪。", "success");
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
    ui.modelManagement.view = "list";
    ui.modelManagement.editor = createModelEditorState("openai");
  }

  if (featureId === FEATURE_TASKS) {
    closeWeeklyEditor();
  }

  if (featureId === FEATURE_COMMAND_WORKSHOP) {
    ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
    ui.command.view = workbench.commandSessions.length ? "list" : "chat";
    ui.command.composerView = "input";
  }

  if (featureId === FEATURE_EXTENSIONS_MANAGEMENT) {
    ui.extensions.view = "list";
    ui.extensions.editor = createExtensionEditorState("agent");
    ui.extensions.runner = createAgentRunnerState();
  }
}

function handleFeatureSelect(featureId) {
  setActiveFeature(featureId);
}

function openModelCreatePicker() {
  activeFeature.value = FEATURE_MODEL_MANAGEMENT;
  ui.modelManagement.view = "picker";
  ui.modelManagement.editor = createModelEditorState("openai");
}

function selectModelProvider(provider) {
  ui.modelManagement.editor = createModelEditorState(provider);
  ui.modelManagement.view = "editor";
}

function openModelEditor(profile) {
  activeFeature.value = FEATURE_MODEL_MANAGEMENT;
  ui.modelManagement.editor = createModelEditorState(profile.provider, profile);
  ui.modelManagement.view = "editor";
}

function backModelManagement() {
  ui.modelManagement.view = "list";
  ui.modelManagement.editor = createModelEditorState("openai");
}

async function handleModelEditorSave() {
  if (!desktopApi) {
    setStatus("桌面桥接未就绪，暂无法保存模型配置。", "danger");
    return;
  }

  const missingField = modelEditorFields.value.find(
    (field) => field.required && !String(ui.modelManagement.editor.values[field.key] ?? "").trim()
  );

  if (missingField) {
    setStatus(`请先填写 ${missingField.label}。`, "warning");
    return;
  }

  const payload = {
    id: ui.modelManagement.editor.profileId ?? `model_${Date.now()}`,
    provider: ui.modelManagement.editor.provider,
    displayName: ui.modelManagement.editor.values.displayName.trim(),
    model: ui.modelManagement.editor.values.model.trim(),
    apiKey: ui.modelManagement.editor.values.apiKey.trim(),
    baseUrl: ui.modelManagement.editor.values.baseUrl.trim(),
    organization: ui.modelManagement.editor.values.organization.trim(),
    project: ui.modelManagement.editor.values.project.trim(),
    location: ui.modelManagement.editor.values.location.trim(),
    notes: ui.modelManagement.editor.values.notes.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    await desktopApi.upsertModelProfile(payload);
    await refreshWorkbenchSnapshot();
    backModelManagement();
    setStatus("模型配置已保存。", "success");
  } catch (error) {
    console.error("Failed to save model profile", error);
    setStatus(`模型配置保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleModelStatusToggle(profileId) {
  if (!desktopApi) {
    return;
  }

  try {
    workbench.modelSettings = await desktopApi.toggleModelProfileStatus(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("模型状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle model profile status", error);
    setStatus(`模型状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleModelDelete(profileId) {
  if (!desktopApi) {
    return;
  }

  const profile = workbench.modelSettings.profiles.find((item) => item.id === profileId);

  if (!profile || !window.confirm(`确认删除模型配置“${profile.displayName}”吗？`)) {
    return;
  }

  try {
    workbench.modelSettings = await desktopApi.deleteModelProfile(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("模型配置已删除。", "success");
  } catch (error) {
    console.error("Failed to delete model profile", error);
    setStatus(`模型配置删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function openWeeklyRecord(recordId) {
  ui.weekly.activeRecordId = recordId;
  ui.weekly.view = "editor";
  ui.weekly.editorView = "projects";
  activeFeature.value = FEATURE_TASKS;
  syncWeeklyEditorState();
}

function openLatestWeeklyRecord() {
  if (workbench.weeklyProgress[0]) {
    openWeeklyRecord(workbench.weeklyProgress[0].id);
    return;
  }

  setActiveFeature(FEATURE_TASKS);
}

function closeWeeklyEditor() {
  clearWeeklyAutosaveTimer();
  ui.weekly.view = "list";
  ui.weekly.draft = null;
  ui.weekly.collapsedProjectIds = [];
  ui.weekly.editorView = "projects";
  clearWeeklyReportFeedback();
  resetWeeklyReportCopyState();
  weeklyTaskRewriteIds.value = [];
  ui.weekly.isGeneratingReport = false;
  ui.weekly.generatingReportKind = null;
  markWeeklyDraftSaved(null);
}

function isWeeklyProjectCollapsed(projectId) {
  return ui.weekly.collapsedProjectIds.includes(projectId);
}

function toggleWeeklyProjectCollapsed(projectId) {
  if (isWeeklyProjectCollapsed(projectId)) {
    ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
    return;
  }

  ui.weekly.collapsedProjectIds = [...ui.weekly.collapsedProjectIds, projectId];
}

function findWeeklyProjectById(projectId) {
  return ui.weekly.draft?.projects?.find((project) => project.id === projectId) ?? null;
}

function addWeeklyProject() {
  if (!ui.weekly.draft) {
    return;
  }

  const project = createWeeklyProjectDraft();
  ui.weekly.draft.projects.push(project);
  ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== project.id);
  focusWeeklyProjectInput(project.id);
}

function removeWeeklyProject(projectId) {
  if (!ui.weekly.draft) {
    return;
  }

  ui.weekly.draft.projects = ui.weekly.draft.projects.filter((project) => project.id !== projectId);
  ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
}

function addWeeklyTask(projectId, parentTaskId = null) {
  const project = findWeeklyProjectById(projectId);

  if (!project) {
    return;
  }

  const task = createWeeklyTaskDraft();

  if (parentTaskId) {
    const context = findWeeklyTaskContext(project.tasks, parentTaskId);

    if (context) {
      if (!Array.isArray(context.task.children)) {
        context.task.children = [];
      }

      context.task.children.push(task);
    } else {
      project.tasks.push(task);
    }
  } else {
    project.tasks.push(task);
  }

  syncWeeklyProjectStatus(project);
  ui.weekly.collapsedProjectIds = ui.weekly.collapsedProjectIds.filter((id) => id !== projectId);
  focusWeeklyTaskInput(task.id);
}

function removeWeeklyTask(projectId, taskId) {
  const project = findWeeklyProjectById(projectId);

  if (!project) {
    return;
  }

  removeWeeklyTaskFromCollection(project.tasks, taskId);
  syncWeeklyProjectStatus(project);
}

function getWeeklyStatusToneClass(status) {
  return `is-${getWeeklyProgressStatusMeta(status).tone}`;
}

function isWeeklyTaskRewriting(taskId) {
  return weeklyTaskRewriteIds.value.includes(taskId);
}

function setWeeklyTaskRewriting(taskId, nextValue) {
  if (nextValue) {
    if (!weeklyTaskRewriteIds.value.includes(taskId)) {
      weeklyTaskRewriteIds.value = [...weeklyTaskRewriteIds.value, taskId];
    }

    return;
  }

  weeklyTaskRewriteIds.value = weeklyTaskRewriteIds.value.filter((id) => id !== taskId);
}

function closeWeeklyDetailsMenu(trigger, selector) {
  const source = trigger instanceof Event ? trigger.currentTarget : trigger;

  if (!(source instanceof HTMLElement)) {
    return;
  }

  const menu = source.closest(selector);

  if (menu instanceof HTMLDetailsElement) {
    menu.open = false;
  }
}

function closeWeeklyStatusMenu(trigger) {
  closeWeeklyDetailsMenu(trigger, ".weekly-task-status-menu");
}

function setWeeklyTaskStatus(projectId, taskId, nextStatus, event) {
  const project = findWeeklyProjectById(projectId);

  if (!project) {
    return;
  }

  const task = findWeeklyTaskContext(project.tasks, taskId)?.task ?? null;

  if (!task) {
    return;
  }

  if (task.status === nextStatus) {
    closeWeeklyStatusMenu(event);
    return;
  }

  task.status = nextStatus;
  touchWeeklyTask(task);
  syncWeeklyProjectStatus(project);
  closeWeeklyStatusMenu(event);
}

function closeWeeklyTaskActionMenu(trigger) {
  closeWeeklyDetailsMenu(trigger, ".weekly-task-action-menu");
}

async function optimizeWeeklyTaskTitle(projectId, taskId, event) {
  closeWeeklyTaskActionMenu(event);

  if (!desktopApi || !ui.weekly.draft) {
    setStatus("当前周报编辑器尚未就绪，暂无法优化任务表达。", "danger");
    return;
  }

  const project = findWeeklyProjectById(projectId);
  const task = project ? findWeeklyTaskContext(project.tasks, taskId)?.task ?? null : null;
  const selectedText = String(task?.title ?? "").trim();
  const childTaskTitles = getWeeklyTaskChildren(task)
    .map((child) => String(child?.title ?? "").trim())
    .filter(Boolean);

  if (!task || !selectedText) {
    setStatus("先填写任务内容，再使用优化功能。", "warning");
    return;
  }

  if (isWeeklyTaskRewriting(taskId)) {
    return;
  }

  try {
    setWeeklyTaskRewriting(taskId, true);
    setStatus("正在优化任务表达...", "neutral");

    const currentDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);
    const result = await desktopApi.rewriteWeeklyProgressItem({
      selectedText,
      fullContent: currentDraft?.content ?? "",
      weekTitle: ui.weekly.draft.title,
      childTaskTitles
    });
    const rewrittenText = String(result?.text ?? "").trim();

    if (!rewrittenText) {
      setStatus("优化未返回可用结果，请稍后再试。", "warning");
      return;
    }

    const latestProject = findWeeklyProjectById(projectId);
    const latestTask = latestProject ? findWeeklyTaskContext(latestProject.tasks, taskId)?.task ?? null : null;

    if (!latestProject || !latestTask) {
      setStatus("任务已变化，本次优化结果未回填。", "warning");
      return;
    }

    latestTask.title = rewrittenText;
    touchWeeklyTask(latestTask);
    syncWeeklyProjectStatus(latestProject);
    setStatus("任务表达已优化，请确认后自动保存。", "success");
  } catch (error) {
    console.error("Failed to optimize weekly task title", error);
    setStatus(`任务优化失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    setWeeklyTaskRewriting(taskId, false);
  }
}

function handleWeeklyReportTemplateSelectionChange() {
  syncWeeklySelectedReportTemplate(ui.weekly.draft);
}

function addWeeklyReportTemplate() {
  if (!ui.weekly.draft) {
    return;
  }

  const baseTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);
  const defaultName = getNextWeeklyReportTemplateName(ui.weekly.draft);
  const nextName = window.prompt("请输入模板名称", defaultName);

  if (nextName === null) {
    return;
  }

  const normalizedName = String(nextName ?? "").trim() || defaultName;
  const nextTemplate = {
    id: createWeeklyDraftId("weekly_report_template"),
    name: normalizedName,
    content: String(baseTemplate?.content ?? ui.weekly.draft.reportTemplate ?? ""),
    builtin: false
  };

  ui.weekly.draft.reportTemplates = [...(Array.isArray(ui.weekly.draft.reportTemplates) ? ui.weekly.draft.reportTemplates : []), nextTemplate];
  ui.weekly.draft.selectedReportTemplateId = nextTemplate.id;
  ui.weekly.draft.reportTemplate = nextTemplate.content;
  setStatus(`已新增模板「${normalizedName}」。`, "success");
}

function removeWeeklySelectedReportTemplate() {
  if (!ui.weekly.draft || !weeklyCanDeleteSelectedReportTemplate.value) {
    return;
  }

  const selectedTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);

  if (!selectedTemplate || selectedTemplate.builtin) {
    return;
  }

  if (!window.confirm(`确认删除模板「${String(selectedTemplate.name ?? "").trim() || "未命名模板"}」吗？`)) {
    return;
  }

  const templates = Array.isArray(ui.weekly.draft.reportTemplates) ? ui.weekly.draft.reportTemplates : [];
  const templateIndex = templates.findIndex((template) => template.id === selectedTemplate.id);
  const nextTemplates = templates.filter((template) => template.id !== selectedTemplate.id);
  const fallbackTemplate = nextTemplates[templateIndex] ?? nextTemplates[templateIndex - 1] ?? nextTemplates[0] ?? null;

  ui.weekly.draft.reportTemplates = nextTemplates;
  ui.weekly.draft.selectedReportTemplateId = fallbackTemplate?.id ?? "";
  ui.weekly.draft.reportTemplate = String(fallbackTemplate?.content ?? "");
  setStatus("模板已删除。", "success");
}

async function handleWeeklySave(options = {}) {
  if (!desktopApi || !activeWeeklyRecord.value || !ui.weekly.draft) {
    setStatus("周记录尚未就绪，暂时无法保存。", "danger");
    return;
  }

  const { silent = false, reason = "manual" } = options;
  const snapshotBeforeSave = getWeeklyDraftSnapshot(ui.weekly.draft);

  if (reason === "auto") {
    if (!snapshotBeforeSave || snapshotBeforeSave === weeklySavedSnapshot || weeklyAutosaveInFlight) {
      return;
    }

    weeklyAutosaveInFlight = true;
  }

  clearWeeklyAutosaveTimer();

  try {
    const nextRecord = {
      ...sanitizeWeeklyProgressRecord(ui.weekly.draft),
      id: activeWeeklyRecord.value.id,
      updatedAt: new Date().toISOString()
    };

    workbench.weeklyProgress = await desktopApi.saveWeeklyProgress(nextRecord);
    ui.weekly.activeRecordId = nextRecord.id;

    if (ui.weekly.draft) {
      ui.weekly.draft.updatedAt = nextRecord.updatedAt;
      ui.weekly.draft.content = nextRecord.content;
    }

    weeklySavedSnapshot = snapshotBeforeSave;

    const latestSnapshot = getWeeklyDraftSnapshot(ui.weekly.draft);

    if (latestSnapshot !== weeklySavedSnapshot) {
      scheduleWeeklyAutosave();
    }

    if (!silent) {
      setStatus("任务推进内容已保存。", "success");
    } else {
      setStatus("任务推进已自动保存。", "success");
    }
  } catch (error) {
    console.error("Failed to save weekly progress", error);
    setStatus(`任务推进保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    if (reason === "auto") {
      weeklyAutosaveInFlight = false;
    }
  }
}

async function handleWeeklyDelete(recordId) {
  if (!desktopApi) {
    return;
  }

  if (!window.confirm("确认删除这条周记录吗？删除后无法恢复。")) {
    return;
  }

  try {
    workbench.weeklyProgress = await desktopApi.deleteWeeklyProgress(recordId);

    if (ui.weekly.activeRecordId === recordId) {
      ui.weekly.activeRecordId =
        workbench.weeklyProgress.find((record) => record.status === "active")?.id ?? workbench.weeklyProgress[0]?.id ?? null;
      closeWeeklyEditor();
    }

    setStatus("周记录已删除。", "success");
  } catch (error) {
    console.error("Failed to delete weekly progress", error);
    setStatus(`周记录删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleWeeklyActiveReportGeneration() {
  if (weeklyIsWeeklyReportMode.value) {
    await handleWeeklyReportGeneration();
    return;
  }

  await handleWeeklyDailyReportGeneration();
}

async function handleWeeklyDailyReportGeneration() {
  if (!desktopApi || !ui.weekly.draft || !activeWeeklyRecord.value) {
    setWeeklyReportFeedback("当前周报表单尚未就绪，暂无法生成日报。", "danger");
    setStatus("当前周报表单尚未就绪，暂无法生成日报。", "danger");
    return;
  }

  if (ui.weekly.isGeneratingReport) {
    return;
  }

  try {
    resetWeeklyReportCopyState();
    ui.weekly.isGeneratingReport = true;
    ui.weekly.generatingReportKind = "daily";
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setWeeklyReportFeedback("正在整理今日日报...", "neutral");
    setStatus("正在整理今日日报...", "neutral");
    const sanitizedDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);
    const { entries, content } = buildDailyReportSourceContent(sanitizedDraft);

    if (!entries.length || !content) {
      setWeeklyReportFeedback(`今天（${getDailyReportDateTitle()}）还没有检测到更新的子任务记录。`, "warning");
      setStatus(`今天（${getDailyReportDateTitle()}）还没有检测到更新的子任务记录。`, "warning");
      return;
    }

    if (typeof desktopApi.generateDailyProgressReport !== "function") {
      throw new Error("当前版本尚未接通日报生成能力，请重启应用后重试");
    }

    const result = await desktopApi.generateDailyProgressReport({
      dateTitle: getDailyReportDateTitle(),
      weekTitle: activeWeeklyRecord.value.title,
      content
    });
    ui.weekly.draft.generatedDailyReport = result.text;
    resetWeeklyReportCopyState();
    setWeeklyReportFeedback(`日报已生成（${result.profileLabel}）。`, "success");
    setStatus(`日报已生成（${result.profileLabel}）。`, "success");
  } catch (error) {
    console.error("Failed to generate daily report", error);
    setWeeklyReportFeedback(`日报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    setStatus(`日报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
  }
}

async function handleWeeklyReportGeneration() {
  if (!desktopApi || !ui.weekly.draft || !activeWeeklyRecord.value) {
    setWeeklyReportFeedback("当前周报表单尚未就绪，暂无法生成周报。", "danger");
    setStatus("当前周报表单尚未就绪，暂无法生成周报。", "danger");
    return;
  }

  if (ui.weekly.isGeneratingReport) {
    return;
  }

  const sanitizedDraft = sanitizeWeeklyProgressRecord(ui.weekly.draft);

  if (!sanitizedDraft?.content.trim()) {
    setWeeklyReportFeedback("当前还没有项目或任务，先补充任务推进内容再生成周报。", "warning");
    setStatus("当前还没有项目或任务，先补充任务推进内容再生成周报。", "warning");
    return;
  }

  if (!String(sanitizedDraft.reportTemplate ?? "").trim()) {
    setWeeklyReportFeedback("当前模板内容为空，先补一版模板再生成周报。", "warning");
    setStatus("当前模板内容为空，先补一版模板再生成周报。", "warning");
    return;
  }

  try {
    resetWeeklyReportCopyState();
    ui.weekly.isGeneratingReport = true;
    ui.weekly.generatingReportKind = "weekly";
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setWeeklyReportFeedback("正在生成周报...", "neutral");
    setStatus("正在生成周报...", "neutral");
    const result = await desktopApi.generateWeeklyProgressReport({
      weekTitle: activeWeeklyRecord.value.title,
      content: sanitizedDraft.content,
      reportTemplate: sanitizedDraft.reportTemplate
    });
    ui.weekly.draft.generatedReport = result.text;
    resetWeeklyReportCopyState();
    setWeeklyReportFeedback(`周报已生成（${result.profileLabel}）。`, "success");
    setStatus(`周报已生成（${result.profileLabel}）。`, "success");
  } catch (error) {
    console.error("Failed to generate weekly report", error);
    setWeeklyReportFeedback(`周报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    setStatus(`周报生成失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    ui.weekly.isGeneratingReport = false;
    ui.weekly.generatingReportKind = null;
  }
}

async function handleWeeklyReportOutputCopy() {
  if (ui.weekly.isGeneratingReport) {
    return;
  }

  try {
    await copyTextToClipboard(weeklyReportOutputContent.value);
    markWeeklyReportCopied();
    setStatus(`${weeklyReportModeLabel.value}已复制。`, "success");
  } catch (error) {
    resetWeeklyReportCopyState();
    setStatus(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function openCommandWorkspace() {
  activeFeature.value = FEATURE_COMMAND_WORKSHOP;

  if (workbench.commandSessions.length) {
    ui.command.view = "list";
    return;
  }

  beginNewCommandSession();
}

function focusCommandInput() {
  nextTick(() => {
    commandInputRef.value?.focus?.();
  });
}

function scrollCommandToBottom() {
  nextTick(() => {
    if (commandMessagesRef.value) {
      commandMessagesRef.value.scrollTop = commandMessagesRef.value.scrollHeight;
    }
  });
}

function beginNewCommandSession() {
  activeFeature.value = FEATURE_COMMAND_WORKSHOP;
  ui.command.view = "chat";
  ui.command.composerView = "input";
  ui.command.activeSessionId = null;
  ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
  ui.command.draftInput = "";
  ui.command.availableMcpTools = [];
  focusCommandInput();
}

function backToCommandList() {
  ui.command.view = "list";
  ui.command.composerView = "input";
}

function openCommandSession(sessionId) {
  const session = workbench.commandSessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return;
  }

  activeFeature.value = FEATURE_COMMAND_WORKSHOP;
  ui.command.view = "chat";
  ui.command.composerView = "input";
  ui.command.activeSessionId = session.id;
  ui.command.form = normalizeCommandWorkshopConfig(session);
  ui.command.availableMcpTools = [];
  ui.command.draftInput = "";
  scrollCommandToBottom();
}

async function handleCommandSessionDelete(sessionId) {
  if (!desktopApi) {
    return;
  }

  const session = workbench.commandSessions.find((entry) => entry.id === sessionId);

  if (!session || !window.confirm(`确认删除会话「${session.title || "当前会话"}」吗？`)) {
    return;
  }

  try {
    const sessions = await desktopApi.deleteCommandWorkshopSession(sessionId);
    workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));

    if (ui.command.activeSessionId === sessionId) {
      if (workbench.commandSessions.length) {
        ui.command.activeSessionId = workbench.commandSessions[0].id;
        ui.command.view = "list";
      } else {
        beginNewCommandSession();
      }
    }

    setStatus("会话已删除。", "success");
  } catch (error) {
    console.error("Failed to delete command session", error);
    setStatus(`会话删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function handleCommandAgentChange() {
  ui.command.form = normalizeCommandWorkshopConfig({
    ...ui.command.form,
    mcpServerId: "",
    mcpToolName: ""
  });
  ui.command.availableMcpTools = [];
}

function handleCommandServerChange() {
  ui.command.form = normalizeCommandWorkshopConfig({
    ...ui.command.form,
    mcpToolName: ""
  });
  ui.command.availableMcpTools = [];
}

async function handleCommandLoadMcpTools() {
  if (!desktopApi) {
    return;
  }

  if (!ui.command.form.mcpServerId) {
    setStatus("请先选择一个 MCP Server，再读取工具。", "warning");
    return;
  }

  try {
    const tools = await desktopApi.listMcpServerTools(ui.command.form.mcpServerId);
    ui.command.availableMcpTools = tools;

    if (!tools.some((tool) => tool.name === ui.command.form.mcpToolName)) {
      ui.command.form.mcpToolName = tools[0]?.name ?? "";
    }

    setStatus(`命令工坊已读取 ${tools.length} 个 MCP 工具。`, "success");
  } catch (error) {
    console.error("Failed to load command tools", error);
    setStatus(`命令工坊 MCP 工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function buildConversationMessagesForAgentRun(messages) {
  return (messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function upsertCommandWorkshopSessionState(session) {
  const nextSessions = workbench.commandSessions.filter((entry) => entry.id !== session.id);
  workbench.commandSessions = sortCommandWorkshopSessions([normalizeCommandWorkshopSession(session), ...nextSessions]);
  ui.command.activeSessionId = session.id;
}

async function handleCommandSubmit() {
  if (!desktopApi) {
    setStatus("桌面桥接未就绪，暂无法执行命令工坊会话。", "danger");
    return;
  }

  if (ui.command.isRunning) {
    setStatus("上一轮任务仍在运行，请等待当前结果返回。", "warning");
    return;
  }

  const agent = getAgentById(ui.command.form.agentProfileId);
  const userInput = ui.command.draftInput.trim();
  let mcpArguments = undefined;

  if (!agent) {
    setStatus("请先选择一个可用 Agent。", "warning");
    return;
  }

  if (!userInput) {
    setStatus("先输入一条任务，再让 Gordon 开始工作。", "warning");
    return;
  }

  if (ui.command.form.mcpToolName && !ui.command.form.mcpServerId) {
    setStatus("如果要指定 MCP 工具，请先选择 MCP Server。", "warning");
    return;
  }

  if (ui.command.form.mcpServerId && !ui.command.form.mcpToolName && !ui.command.form.autoSelectMcp) {
    setStatus("已选择 MCP Server，请再选择具体工具，或开启自动 MCP。", "warning");
    return;
  }

  if (ui.command.form.mcpServerId && ui.command.form.mcpToolName) {
    try {
      mcpArguments = JSON.parse(ui.command.form.mcpArgumentsText);
    } catch (error) {
      setStatus(`MCP 参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      setStatus("MCP 参数必须是一个 JSON 对象。", "danger");
      return;
    }
  }

  const activeSession = activeCommandSession.value;
  const sessionId = activeSession?.id ?? `command_session_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const baseMessages = [...(activeSession?.messages ?? [])];
  const userMessage = {
    id: `command_message_${Date.now()}`,
    role: "user",
    content: userInput,
    createdAt: startedAt
  };
  const pendingSession = {
    id: sessionId,
    title: activeSession?.title || buildCommandWorkshopTitle(userInput),
    summary: summarizeCommandWorkshopContent(userInput),
    agentProfileId: ui.command.form.agentProfileId,
    skillId: ui.command.form.skillId || null,
    autoSelectMcp: ui.command.form.autoSelectMcp,
    mcpServerId: ui.command.form.mcpServerId || null,
    mcpToolName: ui.command.form.mcpToolName || null,
    mcpArgumentsText: ui.command.form.mcpArgumentsText,
    messages: [...baseMessages, userMessage],
    createdAt: activeSession?.createdAt ?? startedAt,
    updatedAt: startedAt
  };

  upsertCommandWorkshopSessionState(pendingSession);
  ui.command.isRunning = true;
  ui.command.view = "chat";
  ui.command.draftInput = "";
  scrollCommandToBottom();

  try {
    setStatus(`命令工坊正在运行 Agent「${agent.name}」...`, "neutral");
    const result = await desktopApi.runAgent({
      agentProfileId: agent.id,
      userInput,
      conversationMessages: buildConversationMessagesForAgentRun(baseMessages),
      ...(ui.command.form.skillId ? { skillId: ui.command.form.skillId } : {}),
      ...(ui.command.form.autoSelectMcp ? { autoSelectMcp: true } : {}),
      ...(ui.command.form.mcpServerId ? { mcpServerId: ui.command.form.mcpServerId } : {}),
      ...(ui.command.form.mcpServerId && ui.command.form.mcpToolName
        ? {
            mcpToolName: ui.command.form.mcpToolName,
            mcpArguments
          }
        : {})
    });

    const assistantMessage = {
      id: `command_message_${Date.now()}_assistant`,
      role: "assistant",
      content: result.text,
      state: "completed",
      createdAt: result.createdAt,
      artifact: buildCommandWorkshopArtifact(result)
    };
    const completedSession = {
      ...pendingSession,
      summary: summarizeCommandWorkshopContent(result.text),
      messages: [...pendingSession.messages, assistantMessage],
      updatedAt: result.updatedAt
    };
    const sessions = await desktopApi.upsertCommandWorkshopSession(completedSession);

    workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
    ui.command.activeSessionId = completedSession.id;
    workbench.agentRunLogs = [result, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
    ui.command.isRunning = false;
    setStatus(`命令工坊已完成本轮响应（${result.profileLabel}）。`, "success");
    scrollCommandToBottom();
  } catch (error) {
    console.error("Failed to run command workshop session", error);
    const failedAt = new Date().toISOString();
    const assistantMessage = {
      id: `command_message_${Date.now()}_error`,
      role: "assistant",
      content: `运行失败：${error instanceof Error ? error.message : "未知错误"}`,
      state: "error",
      createdAt: failedAt
    };
    const failedSession = {
      ...pendingSession,
      summary: summarizeCommandWorkshopContent(assistantMessage.content),
      messages: [...pendingSession.messages, assistantMessage],
      updatedAt: failedAt
    };

    try {
      const sessions = await desktopApi.upsertCommandWorkshopSession(failedSession);
      workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
      ui.command.activeSessionId = failedSession.id;
    } catch (persistError) {
      console.error("Failed to persist command failure session", persistError);
      upsertCommandWorkshopSessionState(failedSession);
    }

    ui.command.isRunning = false;
    setStatus(`命令工坊运行失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    scrollCommandToBottom();
  }
}

function openExtensionEditor(kind, entry = null) {
  activeFeature.value = FEATURE_EXTENSIONS_MANAGEMENT;
  ui.extensions.listTab = getExtensionListTab(kind);
  ui.extensions.editor = createExtensionEditorState(kind, entry);
  ui.extensions.view = "editor";
}

function openAgentRunner(agentId) {
  activeFeature.value = FEATURE_EXTENSIONS_MANAGEMENT;
  ui.extensions.listTab = "agent";
  ui.extensions.runner = createAgentRunnerState(agentId);
  ui.extensions.view = "runner";
}

function closeExtensionPanels() {
  const currentTab = ui.extensions.listTab;
  ui.extensions.view = "list";
  ui.extensions.editor = createExtensionEditorState(currentTab === "skill" ? "skill" : currentTab === "mcp" ? "mcp" : "agent");
  ui.extensions.runner = createAgentRunnerState();
}

function resetRunnerState() {
  const agentId = ui.extensions.runner.agentId;
  ui.extensions.runner = createAgentRunnerState(agentId);
}

function getExtensionEditorTitle() {
  switch (ui.extensions.editor.kind) {
    case "agent":
      return ui.extensions.editor.mode === "edit" ? "编辑 Agent" : "新增 Agent";
    case "skill":
      return ui.extensions.editor.mode === "edit" ? "编辑 Skill" : "新增 Skill";
    case "skill-import":
      return "从 GitHub 加载 Skill";
    case "mcp":
      return ui.extensions.editor.mode === "edit" ? "编辑 MCP Server" : "新增 MCP Server";
    default:
      return "能力编辑器";
  }
}

async function handleExtensionEditorSave() {
  if (!desktopApi) {
    setStatus("桌面桥接未就绪，暂无法保存能力配置。", "danger");
    return;
  }

  try {
    if (ui.extensions.editor.kind === "agent") {
      const existing = workbench.agentProfiles.find((entry) => entry.id === ui.extensions.editor.entryId);
      await desktopApi.upsertAgentProfile({
        id: ui.extensions.editor.entryId ?? `agent_${Date.now()}`,
        name: ui.extensions.editor.values.name.trim(),
        description: ui.extensions.editor.values.description.trim(),
        mode: ui.extensions.editor.values.mode,
        modelProfileId: ui.extensions.editor.values.modelProfileId.trim() || null,
        systemPrompt: ui.extensions.editor.values.systemPrompt.trim(),
        allowedSkillIds: ui.extensions.editor.values.allowedSkillIds,
        allowedMcpServerIds: ui.extensions.editor.values.allowedMcpServerIds,
        enabled: existing?.enabled ?? true,
        updatedAt: new Date().toISOString()
      });
    } else if (ui.extensions.editor.kind === "skill") {
      const existing = workbench.skillDefinitions.find((entry) => entry.id === ui.extensions.editor.entryId);
      const handlerRef = ui.extensions.editor.values.handlerRef.trim();
      await desktopApi.upsertSkillDefinition({
        id: ui.extensions.editor.entryId ?? `skill_${Date.now()}`,
        name: ui.extensions.editor.values.name.trim(),
        description: ui.extensions.editor.values.description.trim(),
        tags: [],
        kind: handlerRef || existing?.kind === "workflow" ? "workflow" : "prompt",
        promptTemplate: ui.extensions.editor.values.promptTemplate.trim(),
        handlerRef,
        source: existing?.source ?? { type: "manual" },
        enabled: existing?.enabled ?? true,
        updatedAt: new Date().toISOString()
      });
    } else if (ui.extensions.editor.kind === "skill-import") {
      await desktopApi.importSkillDefinitionFromGithub({
        repo: ui.extensions.editor.values.repo.trim(),
        ref: ui.extensions.editor.values.ref.trim() || "main",
        path: ui.extensions.editor.values.path.trim()
      });
    } else {
      const existing = workbench.mcpServers.find((entry) => entry.id === ui.extensions.editor.entryId);

      if (ui.extensions.editor.values.transport === "stdio" && !ui.extensions.editor.values.command.trim()) {
        setStatus("stdio 模式需要填写启动命令。", "warning");
        return;
      }

      if (ui.extensions.editor.values.transport === "http" && !ui.extensions.editor.values.url.trim()) {
        setStatus("http 模式需要填写服务地址。", "warning");
        return;
      }

      await desktopApi.upsertMcpServer({
        id: ui.extensions.editor.entryId ?? `mcp_${Date.now()}`,
        name: ui.extensions.editor.values.name.trim(),
        description: ui.extensions.editor.values.description.trim(),
        transport: ui.extensions.editor.values.transport,
        command: ui.extensions.editor.values.transport === "stdio" ? ui.extensions.editor.values.command.trim() : "",
        url: ui.extensions.editor.values.transport === "http" ? ui.extensions.editor.values.url.trim() : "",
        env: parseEnvText(ui.extensions.editor.values.envText),
        toolAllowlist: normalizeTagList(ui.extensions.editor.values.toolAllowlist),
        enabled: existing?.enabled ?? true,
        updatedAt: new Date().toISOString()
      });
    }

    await refreshWorkbenchSnapshot();
    closeExtensionPanels();
    setStatus("能力配置已保存。", "success");
  } catch (error) {
    console.error("Failed to save extension", error);
    setStatus(`能力配置保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleAgentStatusToggle(profileId) {
  if (!desktopApi) {
    return;
  }

  try {
    await desktopApi.toggleAgentProfileStatus(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("Agent 状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle agent status", error);
    setStatus(`Agent 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleSkillStatusToggle(skillId) {
  if (!desktopApi) {
    return;
  }

  try {
    await desktopApi.toggleSkillDefinitionStatus(skillId);
    await refreshWorkbenchSnapshot();
    setStatus("Skill 状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle skill status", error);
    setStatus(`Skill 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleMcpStatusToggle(serverId) {
  if (!desktopApi) {
    return;
  }

  try {
    await desktopApi.toggleMcpServerStatus(serverId);
    await refreshWorkbenchSnapshot();
    setStatus("MCP 状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle mcp status", error);
    setStatus(`MCP 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleAgentDelete(profileId) {
  if (!desktopApi || isBuiltinWorkbenchItem(profileId)) {
    return;
  }

  const profile = getAgentById(profileId);

  if (!profile || !window.confirm(`确认删除 Agent「${profile.name}」吗？`)) {
    return;
  }

  try {
    await desktopApi.deleteAgentProfile(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("Agent 已删除。", "success");
  } catch (error) {
    console.error("Failed to delete agent", error);
    setStatus(`Agent 删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleSkillDelete(skillId) {
  if (!desktopApi || isBuiltinWorkbenchItem(skillId)) {
    return;
  }

  const skill = getSkillById(skillId);

  if (!skill || !window.confirm(`确认删除 Skill「${skill.name}」吗？`)) {
    return;
  }

  try {
    await desktopApi.deleteSkillDefinition(skillId);
    await refreshWorkbenchSnapshot();
    setStatus("Skill 已删除。", "success");
  } catch (error) {
    console.error("Failed to delete skill", error);
    setStatus(`Skill 删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleMcpDelete(serverId) {
  if (!desktopApi || isBuiltinWorkbenchItem(serverId)) {
    return;
  }

  const server = getMcpServerById(serverId);

  if (!server || !window.confirm(`确认删除 MCP Server「${server.name}」吗？`)) {
    return;
  }

  try {
    await desktopApi.deleteMcpServer(serverId);
    await refreshWorkbenchSnapshot();
    setStatus("MCP Server 已删除。", "success");
  } catch (error) {
    console.error("Failed to delete mcp server", error);
    setStatus(`MCP 删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function handleRunnerServerChange() {
  ui.extensions.runner.mcpToolName = "";
  ui.extensions.runner.availableMcpTools = [];
}

async function handleRunnerLoadMcpTools() {
  if (!desktopApi) {
    return;
  }

  if (!ui.extensions.runner.mcpServerId) {
    setStatus("请先选择一个 MCP Server，再读取工具。", "warning");
    return;
  }

  try {
    const tools = await desktopApi.listMcpServerTools(ui.extensions.runner.mcpServerId);
    ui.extensions.runner.availableMcpTools = tools;
    ui.extensions.runner.mcpToolName = tools[0]?.name ?? "";
    setStatus(`已读取 ${tools.length} 个 MCP 工具。`, "success");
  } catch (error) {
    console.error("Failed to load runner tools", error);
    setStatus(`MCP 工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function getRecentAgentRunLogs(agentId, limit = 5) {
  if (!agentId) {
    return [];
  }

  return workbench.agentRunLogs.filter((log) => log.agentProfileId === agentId).slice(0, limit);
}

async function handleRunnerSubmit() {
  if (!desktopApi) {
    return;
  }

  const agent = getAgentById(ui.extensions.runner.agentId);

  if (!agent) {
    setStatus("当前 Agent 运行器未就绪，暂无法执行。", "danger");
    return;
  }

  let mcpArguments = undefined;

  if (ui.extensions.runner.mcpToolName && !ui.extensions.runner.mcpServerId) {
    setStatus("如果要调用 MCP 工具，请先选择 MCP Server。", "warning");
    return;
  }

  if (ui.extensions.runner.mcpServerId && !ui.extensions.runner.mcpToolName && !ui.extensions.runner.autoSelectMcp) {
    setStatus("已选择 MCP Server，请再选择一个具体工具。", "warning");
    return;
  }

  if (ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName) {
    try {
      mcpArguments = JSON.parse(ui.extensions.runner.mcpArgumentsText);
    } catch (error) {
      setStatus(`MCP 参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      setStatus("MCP 参数必须是一个 JSON 对象。", "danger");
      return;
    }
  }

  try {
    ui.extensions.runner.isRunning = true;
    setStatus(`正在运行 Agent「${agent.name}」...`, "neutral");
    const result = await desktopApi.runAgent({
      agentProfileId: agent.id,
      userInput: ui.extensions.runner.userInput.trim(),
      ...(ui.extensions.runner.skillId ? { skillId: ui.extensions.runner.skillId } : {}),
      ...(ui.extensions.runner.autoSelectMcp ? { autoSelectMcp: true } : {}),
      ...(ui.extensions.runner.mcpServerId ? { mcpServerId: ui.extensions.runner.mcpServerId } : {}),
      ...(ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName
        ? {
            mcpToolName: ui.extensions.runner.mcpToolName,
            mcpArguments
          }
        : {})
    });
    ui.extensions.runner.result = result;
    workbench.agentRunLogs = [result, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
    ui.extensions.runner.isRunning = false;
    setStatus(`Agent 运行完成（${result.profileLabel}）。`, "success");
  } catch (error) {
    console.error("Failed to run agent", error);
    ui.extensions.runner.isRunning = false;
    setStatus(`Agent 运行失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

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

function getCommandWorkshopModeLabel(config) {
  if (!config?.skillId) {
    return "默认策略";
  }

  return getSkillById(config.skillId)?.name ?? "指定 Skill";
}

function getCommandWorkshopToolModeLabel(config) {
  if (config?.mcpServerId && config?.mcpToolName) {
    const serverName = getMcpServerById(config.mcpServerId)?.name ?? "指定 MCP";
    return `${serverName} / ${config.mcpToolName}`;
  }

  return config?.autoSelectMcp ? "自动工具" : "纯对话";
}

function getCommandArtifactSummary(artifact) {
  const summaryParts = [
    artifact.steps?.length ? `${artifact.steps.length} 个步骤` : "",
    artifact.mcpCalls?.length ? `${artifact.mcpCalls.length} 次工具` : "",
    artifact.profileLabel || ""
  ].filter(Boolean);

  return summaryParts.length ? `执行链路 · ${summaryParts.join(" / ")}` : "查看执行链路";
}

function normalizeCommandArtifactInlineText(value) {
  return String(value ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getCommandArtifactInlineText(value) {
  return normalizeCommandArtifactInlineText(value);
}

function getCommandArtifactStepSecondary(step) {
  const detail = normalizeCommandArtifactInlineText(step?.detail);

  if (!detail || detail === step?.title) {
    return "";
  }

  return detail;
}

function getCommandArtifactCallTitle(call) {
  return `第 ${call.round} 轮 · ${call.serverName} / ${call.toolName}`;
}

function getCommandArtifactCallSecondary(call) {
  const secondaryParts = [];

  if (call.autoSelected) {
    secondaryParts.push("自动选择");
  }

  if (call.recovered) {
    secondaryParts.push(`重试恢复 x${call.attemptCount}`);
  } else if (call.attemptCount > 1) {
    secondaryParts.push(`尝试 x${call.attemptCount}`);
  }

  if (call.repairedFromArguments) {
    secondaryParts.push(call.repairReason ? normalizeCommandArtifactInlineText(call.repairReason) : "参数修复");
  }

  if (call.fallbackFromToolName) {
    secondaryParts.push(`fallback ${call.fallbackFromServerName ?? call.serverName}/${call.fallbackFromToolName}`);
  }

  if (call.isError) {
    secondaryParts.push("返回错误标记");
  }

  if (call.failureKind) {
    secondaryParts.push(formatFailureKind(call.failureKind));
  }

  const failureReason = normalizeCommandArtifactInlineText(call.failureReason);
  const resultText = normalizeCommandArtifactInlineText(call.resultText);

  if (failureReason) {
    secondaryParts.push(failureReason);
  } else if (resultText) {
    secondaryParts.push(resultText);
  }

  return secondaryParts.join(" · ");
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
  () => {
    if (!ui.weekly.draft) {
      return;
    }

    syncWeeklySelectedReportTemplate(ui.weekly.draft);
  }
);

watch(
  () => getWeeklyDraftSnapshot(ui.weekly.draft),
  (nextSnapshot) => {
    if (!ui.weekly.draft || ui.weekly.view !== "editor" || !nextSnapshot || nextSnapshot === weeklySavedSnapshot) {
      return;
    }

    scheduleWeeklyAutosave();
  }
);

onMounted(async () => {
  await bootstrapWorkbench();
  ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
  await nextTick();
  await syncRobotRuntime();
});

onBeforeUnmount(() => {
  clearWeeklyAutosaveTimer();
  disposeRobotRuntime();
  document.body.classList.remove("load-error");
});
</script>
