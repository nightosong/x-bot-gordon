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
                            <div v-if="hasModelBalanceQuery(profile)" class="model-balance-widget">
                              <div class="model-balance-widget-head">
                                <span class="model-balance-time">
                                  {{
                                    isModelBalanceRefreshing(profile.id)
                                      ? "查询中..."
                                      : getModelBalanceSnapshot(profile)?.queriedAt
                                        ? `更新于 ${formatLocalDateTime(getModelBalanceSnapshot(profile).queriedAt)}`
                                        : "未查询"
                                  }}
                                </span>
                                <button
                                  type="button"
                                  class="model-icon-button model-balance-refresh-button"
                                  :class="{ 'is-loading': isModelBalanceRefreshing(profile.id) }"
                                  :disabled="isModelBalanceRefreshing(profile.id)"
                                  :aria-label="`刷新 ${profile.displayName} 的余额`"
                                  title="刷新余额"
                                  @click.stop="handleModelBalanceRefresh(profile)"
                                >
                                  <GIcon name="refresh" />
                                </button>
                              </div>

                              <p v-if="getModelBalanceSnapshot(profile)" class="model-balance-widget-copy">
                                <span class="model-balance-used">已使用：{{ formatBalanceNumber(getModelBalanceSnapshot(profile).used) }}</span>
                                <span class="model-balance-remaining">
                                  剩余：{{ formatBalanceNumber(getModelBalanceSnapshot(profile).remaining) }} {{ getModelBalanceSnapshot(profile).unit }}
                                </span>
                              </p>

                              <p v-else class="model-balance-widget-placeholder">点击刷新查询余额</p>
                            </div>

                            <span v-if="workbench.modelSettings.activeProfileId === profile.id" class="model-priority-tag">优先使用</span>

                            <button
                              type="button"
                              class="model-icon-button"
                              :aria-label="`编辑 ${profile.displayName}`"
                              title="编辑"
                              @click="openModelEditor(profile)"
                            >
                              <GIcon name="edit" />
                            </button>

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
                            >
                              <GIcon name="delete" />
                            </button>
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
                          >
                            <GIcon name="return" />
                          </button>
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
                          >
                            <GIcon name="return" />
                          </button>
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
                          <div class="balance-field-head">
                            <span class="field-label">余额查询提取器代码</span>
                            <div class="balance-field-actions">
                              <button type="button" class="model-action-secondary" @click="fillModelBalanceQueryTemplate">填充示例</button>
                              <button
                                type="button"
                                class="model-action-secondary"
                                :disabled="ui.modelManagement.editor.isBalanceQuerying"
                                @click="handleModelEditorBalanceQuery"
                              >
                                {{ ui.modelManagement.editor.isBalanceQuerying ? "查询中..." : "立即查询余额" }}
                              </button>
                            </div>
                          </div>

                          <textarea
                            v-model="ui.modelManagement.editor.values.balanceQueryCode"
                            class="field-textarea model-balance-code-textarea"
                            placeholder="({ request: { url: 'https://xxxxx', method: 'GET' }, extractor: function (raw) { return { remaining: 0, used: 0, unit: 'USD' }; } });"
                          ></textarea>

                          <p class="field-hint">
                            支持 `cc-switch` 风格协议；`request.url` 直接写在代码里即可，`API Key` 模板变量
                            <code v-pre>{{apiKey}}</code>
                            会在查询时自动注入。
                          </p>

                          <div class="model-balance-preview" :class="{ 'is-error': ui.modelManagement.editor.balanceQueryError }">
                            <div class="model-balance-widget-head">
                              <span class="model-balance-time">
                                {{
                                  ui.modelManagement.editor.balanceQueryResult?.queriedAt
                                    ? `最近查询 ${formatLocalDateTime(ui.modelManagement.editor.balanceQueryResult.queriedAt)}`
                                    : "结果预览"
                                }}
                              </span>
                              <span
                                v-if="ui.modelManagement.editor.balanceQueryResult?.planName"
                                class="pill pill-neutral model-balance-plan-tag"
                              >
                                {{ ui.modelManagement.editor.balanceQueryResult.planName }}
                              </span>
                            </div>

                            <p v-if="ui.modelManagement.editor.balanceQueryError" class="model-balance-preview-copy is-error">
                              {{ ui.modelManagement.editor.balanceQueryError }}
                            </p>

                            <p v-else-if="ui.modelManagement.editor.balanceQueryResult" class="model-balance-widget-copy">
                              <span class="model-balance-used">
                                已使用：{{ formatBalanceNumber(ui.modelManagement.editor.balanceQueryResult.used) }}
                              </span>
                              <span class="model-balance-remaining">
                                剩余：{{ formatBalanceNumber(ui.modelManagement.editor.balanceQueryResult.remaining) }}
                                {{ ui.modelManagement.editor.balanceQueryResult.unit }}
                              </span>
                            </p>

                            <p v-else class="model-balance-widget-placeholder">填好代码后，可以直接在这里试跑并预览余额结果。</p>
                          </div>
                        </div>

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
                      <p class="models-title">任务笔记</p>
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
                              :disabled="ui.weekly.isGeneratingReport"
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
                                  <template v-else>
                                    <label class="command-inline-toggle weekly-report-inline-toggle">
                                      <span class="command-inline-toggle-label">使用大模型优化</span>
                                      <input v-model="ui.weekly.dailyReportUseModelOptimization" type="checkbox" />
                                    </label>
                                  </template>
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
                                <div class="weekly-report-output-head-actions">
                                  <div class="weekly-report-output-tabs" role="tablist" aria-label="输出视图">
                                    <button
                                      type="button"
                                      class="weekly-report-output-tab"
                                      :class="{ 'is-active': weeklyReportOutputMode === 'preview' }"
                                      :aria-selected="weeklyReportOutputMode === 'preview' ? 'true' : 'false'"
                                      :disabled="ui.weekly.isGeneratingReport"
                                      @click="setWeeklyReportOutputMode('preview')"
                                    >
                                      预览
                                    </button>
                                    <button
                                      type="button"
                                      class="weekly-report-output-tab"
                                      :class="{ 'is-active': weeklyReportOutputMode === 'edit' }"
                                      :aria-selected="weeklyReportOutputMode === 'edit' ? 'true' : 'false'"
                                      :disabled="ui.weekly.isGeneratingReport"
                                      @click="setWeeklyReportOutputMode('edit')"
                                    >
                                      编辑
                                    </button>
                                  </div>
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
                                    <span v-else class="weekly-report-run-icon"><GIcon name="play" /></span>
                                  </button>
                                </div>
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
                                  <span class="weekly-report-run-icon"><GIcon :name="weeklyReportCopyIconKind" /></span>
                                </button>
                                <div
                                  v-if="weeklyCanCopyReportOutput && weeklyReportOutputMode === 'preview'"
                                  class="weekly-report-output-preview weekly-report-output-textarea weekly-report-rendered command-rich-text"
                                  :class="{ 'is-readonly': ui.weekly.isGeneratingReport }"
                                  v-html="weeklyRenderedReportOutputHtml"
                                  @click="handleRichTextClick"
                                ></div>
                                <textarea
                                  v-else-if="weeklyReportOutputMode === 'edit'"
                                  v-model="weeklyReportOutputContent"
                                  class="field-textarea weekly-textarea weekly-textarea-report weekly-report-output-textarea"
                                  :readonly="ui.weekly.isGeneratingReport"
                                  :class="{ 'is-readonly': ui.weekly.isGeneratingReport }"
                                  :placeholder="weeklyReportOutputPlaceholder"
                                ></textarea>
                                <div
                                  v-else
                                  class="weekly-report-output-preview weekly-report-output-placeholder weekly-report-output-textarea weekly-report-rendered is-placeholder"
                                  :class="{ 'is-readonly': ui.weekly.isGeneratingReport }"
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

          <template v-else-if="activeFeature === FEATURE_WORKFLOW_LIBRARY">
            <div
              class="workspace-stage workflow-library-stage"
              :class="ui.workflow.view !== 'library' ? 'workspace-stage-flush' : 'workspace-stage-scroll'"
            >
              <div class="workflow-library-shell" :class="{ 'workflow-library-shell-detail': ui.workflow.view !== 'library' }">
                <template v-if="ui.workflow.view === 'library'">
                  <section class="models-hero workflow-library-hero">
                    <div>
                      <p class="feature-kicker">workflow</p>
                      <p class="models-title">流程中心</p>
                    </div>

                    <div class="workflow-library-hero-side">
                      <span class="status-pill">{{ workflowLibraryCards.length }} 个 workflow</span>
                    </div>
                  </section>

                  <section class="model-section workflow-library-index-section">
                    <div class="model-section-head">
                      <div>
                        <p class="feature-kicker">Library</p>
                        <p class="model-section-title">工作流</p>
                      </div>

                      <div class="model-section-actions">
                        <span class="pill pill-neutral">当前 {{ workflowLibraryCards.length }} 张</span>
                      </div>
                    </div>

                    <div v-if="workflowLibraryCards.length" class="workflow-library-card-grid">
                      <article
                        v-for="entry in workflowLibraryCards"
                        :key="entry.id"
                        class="workflow-library-card"
                        role="button"
                        tabindex="0"
                        :aria-label="`打开 ${entry.title}`"
                        @click="openWorkflowCard(entry.id)"
                        @keydown.enter.prevent="openWorkflowCard(entry.id)"
                        @keydown.space.prevent="openWorkflowCard(entry.id)"
                      >
                        <div class="workflow-library-card-body">
                          <p class="workflow-library-card-title">{{ entry.title }}</p>
                          <p class="workflow-library-card-subtitle">{{ getWorkflowCardCountLabel(entry) }}</p>
                        </div>

                        <div class="extension-tag-row workflow-library-card-tags">
                          <span v-for="tag in entry.tags.slice(0, 2)" :key="tag" class="pill pill-neutral">{{ tag }}</span>
                        </div>
                      </article>
                    </div>

                    <div v-else class="model-empty">
                      <p class="model-empty-copy">当前还没有 workflow 卡片，后续可以继续在本地仓储里补充更多工作流。</p>
                    </div>
                  </section>
                </template>

                <div v-else class="workflow-library-detail-shell">
                  <section class="workflow-library-detail-head">
                    <div class="workflow-library-detail-head-side">
                      <button
                        type="button"
                        class="model-icon-button weekly-back-button"
                        aria-label="返回"
                        title="返回"
                        @click="handleWorkflowBack"
                      >
                        <GIcon name="return" />
                      </button>
                    </div>

                    <div class="workflow-library-detail-head-center">
                      <p class="workflow-library-detail-title">{{ workflowDetailTitle }}</p>
                    </div>

                    <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
                      <span v-if="ui.workflow.view === 'list'" class="status-pill">{{ filteredWorkflowRecords.length }} 条记录</span>
                      <button
                        v-if="ui.workflow.view === 'list'"
                        type="button"
                        class="model-icon-button"
                        aria-label="新建工作流"
                        title="新建工作流"
                        @click="openWorkflowRecordEditor()"
                      >
                        <GIcon name="add" />
                      </button>
                      <template v-else-if="ui.workflow.view === 'run' && activeWorkflowRecord">
                        <button
                          type="button"
                          class="model-icon-button"
                          aria-label="编辑工作流"
                          title="编辑工作流"
                          @click="openWorkflowRecordEditor(activeWorkflowRecord)"
                        >
                          <GIcon name="edit" />
                        </button>
                        <button
                          type="button"
                          class="model-icon-button workflow-library-run-control"
                          :class="{ 'is-interrupting': ui.workflow.isRunning }"
                          :aria-label="workflowRunControlLabel"
                          :title="workflowRunControlLabel"
                          :disabled="ui.workflow.isCancelling"
                          @click="ui.workflow.isRunning ? cancelActiveWorkflowRun() : runActiveWorkflowRecord()"
                        >
                          <GIcon :name="workflowRunControlIcon" :spin="ui.workflow.isCancelling" />
                        </button>
                      </template>
                    </div>
                  </section>

                  <section class="workflow-library-main-stage">
                    <template v-if="ui.workflow.view === 'list'">
                      <section class="workflow-library-main-card workflow-library-list-toolbar">
                        <label class="field workflow-library-search-field">
                          <span class="field-label">搜索</span>
                          <input v-model="ui.workflow.searchQuery" class="field-input" placeholder="搜索名称、场景、标签或 curl" />
                        </label>
                      </section>

                      <div v-if="filteredWorkflowRecords.length" class="workflow-library-record-grid">
                        <article
                          v-for="record in filteredWorkflowRecords"
                          :key="record.id"
                          class="workflow-library-record-tile"
                          role="button"
                          tabindex="0"
                          @click="openWorkflowRecord(record.id)"
                          @keydown.enter.prevent="openWorkflowRecord(record.id)"
                          @keydown.space.prevent="openWorkflowRecord(record.id)"
                        >
                          <div class="workflow-library-record-topline">
                            <p class="workflow-library-record-title">{{ record.name }}</p>
                            <span class="pill pill-neutral">{{ record.steps.length }} 步</span>
                          </div>
                          <div class="workflow-library-record-meta">
                            <span>{{ formatLocalDateTime(record.updatedAt) }}</span>
                            <span>{{ record.protocol.mode }}</span>
                          </div>
                          <div class="model-section-actions workflow-library-record-actions">
                            <button
                              type="button"
                              class="model-icon-button"
                              aria-label="复制工作流"
                              title="复制工作流"
                              @click.stop="duplicateWorkflowRecord(record)"
                            >
                              <GIcon name="copy" />
                            </button>
                            <button
                              type="button"
                              class="model-icon-button"
                              aria-label="编辑工作流"
                              title="编辑工作流"
                              @click.stop="openWorkflowRecordEditor(record)"
                            >
                              <GIcon name="edit" />
                            </button>
                            <button
                              type="button"
                              class="model-icon-button model-action-danger"
                              aria-label="删除工作流"
                              title="删除工作流"
                              @click.stop="deleteWorkflowRecord(record.id)"
                            >
                              <GIcon name="delete" />
                            </button>
                          </div>
                        </article>
                      </div>

                      <div v-else class="model-empty">
                        <p class="model-empty-copy">没有匹配的工作流。</p>
                      </div>
                    </template>

                    <form
                      v-else-if="ui.workflow.view === 'editor'"
                      class="workflow-library-compose-card"
                      @submit.prevent="saveWorkflowRecord"
                    >
                      <div class="workflow-library-main-card-head">
                        <div>
                          <p class="feature-kicker">Curl Config</p>
                          <p class="model-section-title">{{ ui.workflow.editingRecordId ? "编辑工作流" : "新建工作流" }}</p>
                        </div>

                        <div class="model-section-actions">
                          <button type="button" class="model-action-secondary" @click="handleWorkflowBack">取消</button>
                          <button type="button" class="model-action" :disabled="ui.workflow.isSavingRecord" @click="saveWorkflowRecord">
                            <GIcon :name="ui.workflow.isSavingRecord ? 'loading' : 'check'" :spin="ui.workflow.isSavingRecord" />
                            保存
                          </button>
                        </div>
                      </div>

                      <div class="model-form workflow-library-compose-form">
                        <label class="field">
                          <span class="field-label">工作流名称</span>
                          <input v-model="ui.workflow.recordDraft.name" class="field-input" placeholder="例如：视频生成异步测试" />
                        </label>

                        <label class="field">
                          <span class="field-label">场景</span>
                          <input v-model="ui.workflow.recordDraft.scenario" class="field-input" placeholder="例如：提交任务 -> 轮询状态 -> 获取结果" />
                        </label>

                        <label class="field">
                          <span class="field-label">标签</span>
                          <input v-model="ui.workflow.recordDraft.tagsText" class="field-input" placeholder="curl, API, polling" />
                        </label>

                        <section class="field field-full workflow-library-runtime-editor">
                          <div class="workflow-library-inline-head">
                            <div>
                              <span class="field-label">环境配置</span>
                              <p class="workflow-library-inline-copy">请求路径共享，执行时按当前环境替换 BASE_URL 和 API_KEY。</p>
                            </div>
                            <button type="button" class="model-action-secondary" @click="addWorkflowDraftEnvironment">
                              <GIcon name="add" />
                              添加配置
                            </button>
                          </div>

                          <div class="workflow-library-env-tabs" role="tablist" aria-label="默认执行环境">
                            <button
                              v-for="environment in ui.workflow.recordDraft.environments"
                              :key="environment.id"
                              type="button"
                              class="workflow-library-env-tab"
                              :class="{ 'is-active': ui.workflow.recordDraft.activeEnvironmentId === environment.id }"
                              @click="ui.workflow.recordDraft.activeEnvironmentId = environment.id"
                            >
                              {{ environment.label || environment.id }}
                            </button>
                          </div>

                          <div class="workflow-library-env-editor-list">
                            <article
                              v-for="environment in ui.workflow.recordDraft.environments"
                              :key="environment.id"
                              class="workflow-library-env-editor-row"
                            >
                              <label class="field">
                                <span class="field-label">环境名</span>
                                <input v-model="environment.label" class="field-input" placeholder="DEV" />
                              </label>
                              <label class="field workflow-library-env-url-field">
                                <span class="field-label">Base URL</span>
                                <input v-model="environment.baseUrl" class="field-input" placeholder="https://api.example.com" />
                              </label>
                              <label class="field workflow-library-env-key-field">
                                <span class="field-label">APIKEY</span>
                                <span class="workflow-library-secret-input">
                                  <input
                                    v-model="environment.apiKey"
                                    class="field-input"
                                    :type="activeWorkflowApiKeyInputType"
                                    placeholder="sk-..."
                                    autocomplete="off"
                                  />
                                  <button
                                    type="button"
                                    class="model-icon-button workflow-library-secret-toggle"
                                    :aria-label="ui.workflow.apiKeyVisible ? '隐藏 APIKEY' : '显示 APIKEY'"
                                    :title="ui.workflow.apiKeyVisible ? '隐藏 APIKEY' : '显示 APIKEY'"
                                    @click="ui.workflow.apiKeyVisible = !ui.workflow.apiKeyVisible"
                                  >
                                    <GIcon :name="ui.workflow.apiKeyVisible ? 'eyeOff' : 'eye'" />
                                  </button>
                                </span>
                              </label>
                              <button
                                type="button"
                                class="model-icon-button model-action-danger workflow-library-env-remove"
                                aria-label="删除环境配置"
                                title="删除环境配置"
                                @click="removeWorkflowDraftEnvironment(environment.id)"
                              >
                                <GIcon name="delete" />
                              </button>
                            </article>
                          </div>
                        </section>

                        <section class="field field-full workflow-library-step-editor">
                          <div class="workflow-library-inline-head">
                            <div>
                              <span class="field-label">请求步骤</span>
                              <p class="workflow-library-inline-copy">每个 curl 独立维护，不再用 --- 分割。</p>
                            </div>
                            <button type="button" class="model-action-secondary" @click="addWorkflowDraftStep">
                              <GIcon name="add" />
                              添加请求
                            </button>
                          </div>

                          <div class="workflow-library-step-editor-list">
                            <article v-for="(step, index) in ui.workflow.recordDraft.steps" :key="step.id" class="workflow-library-step-editor-card">
                              <div class="workflow-library-step-editor-head">
                                <span class="workflow-library-step-order">{{ index + 1 }}</span>
                                <label class="field workflow-library-step-name-field">
                                  <span class="field-label">步骤名称</span>
                                  <input v-model="step.name" class="field-input" :placeholder="`请求 ${index + 1}`" />
                                </label>
                                <label class="field workflow-library-step-wait-field">
                                  <span class="field-label">前置等待 ms</span>
                                  <input v-model="step.waitBeforeMs" class="field-input" inputmode="numeric" placeholder="0" />
                                </label>
                                <label class="field workflow-library-step-mode-field">
                                  <span class="field-label">执行方式</span>
                                  <select v-model="step.executionMode" class="field-input">
                                    <option value="once">单次</option>
                                    <option value="polling">轮询</option>
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  class="model-icon-button model-action-danger"
                                  aria-label="删除请求"
                                  title="删除请求"
                                  @click="removeWorkflowDraftStep(step.id)"
                                >
                                  <GIcon name="delete" />
                                </button>
                              </div>

                              <label class="field">
                                <span class="field-label">curl</span>
                                <textarea
                                  v-model="step.curl"
                                  class="field-textarea workflow-library-curl-textarea"
                                  rows="8"
                                  placeholder="粘贴单个 curl，例如 curl -i $BASE_URL/v1/video/submit ..."
                                ></textarea>
                              </label>

                              <section v-if="step.executionMode === 'polling'" class="workflow-library-poll-editor">
                                <div class="workflow-library-inline-head">
                                  <div>
                                    <span class="field-label">轮询终止判断</span>
                                    <p class="workflow-library-inline-copy">每轮执行后读取 JSONPath，命中成功值继续下一步，命中失败值立即停止。</p>
                                  </div>
                                </div>

                                <div class="workflow-library-poll-grid">
                                  <label class="field">
                                    <span class="field-label">间隔 ms</span>
                                    <input v-model="step.pollIntervalMs" class="field-input" inputmode="numeric" placeholder="5000" />
                                  </label>
                                  <label class="field">
                                    <span class="field-label">最大轮次</span>
                                    <input v-model="step.maxAttempts" class="field-input" inputmode="numeric" placeholder="20" />
                                  </label>
                                  <label class="field workflow-library-poll-path-field">
                                    <span class="field-label">状态 JSONPath</span>
                                    <input v-model="step.completionPath" class="field-input" placeholder="$.content.status" />
                                  </label>
                                  <label class="field">
                                    <span class="field-label">成功值</span>
                                    <input v-model="step.successValuesText" class="field-input" placeholder="succeeded, completed, success" />
                                  </label>
                                  <label class="field">
                                    <span class="field-label">失败值</span>
                                    <input v-model="step.failureValuesText" class="field-input" placeholder="failed, error, cancelled" />
                                  </label>
                                </div>
                              </section>

                              <section class="workflow-library-output-editor">
                                <div class="workflow-library-inline-head">
                                  <div>
                                    <span class="field-label">产出变量</span>
                                    <p class="workflow-library-inline-copy">从本步骤 JSON 响应里提取变量，后续 curl 可用 $TASK_ID。</p>
                                  </div>
                                  <button type="button" class="model-action-secondary" @click="addWorkflowStepOutput(step)">
                                    <GIcon name="add" />
                                    添加变量
                                  </button>
                                </div>

                                <div v-if="step.produces.length" class="workflow-library-output-list">
                                  <article v-for="output in step.produces" :key="output.id" class="workflow-library-output-row">
                                    <label class="field">
                                      <span class="field-label">变量名</span>
                                      <input v-model="output.name" class="field-input" placeholder="TASK_ID" />
                                    </label>
                                    <label class="field workflow-library-output-path-field">
                                      <span class="field-label">JSONPath</span>
                                      <input v-model="output.path" class="field-input" placeholder="$.content.task_id 或 data: $.content.0.task_id" />
                                    </label>
                                    <button
                                      type="button"
                                      class="model-icon-button model-action-danger"
                                      aria-label="删除产出变量"
                                      title="删除产出变量"
                                      @click="removeWorkflowStepOutput(step, output.id)"
                                    >
                                      <GIcon name="delete" />
                                    </button>
                                  </article>
                                </div>
                              </section>
                            </article>
                          </div>
                        </section>

                        <label class="field field-full">
                          <span class="field-label">备注</span>
                          <textarea v-model="ui.workflow.recordDraft.notes" class="field-textarea" rows="3" placeholder="可记录变量提取、结果路径或注意事项"></textarea>
                        </label>
                      </div>
                    </form>

                    <template v-else-if="ui.workflow.view === 'run' && activeWorkflowRecord">
                        <section class="workflow-library-main-card workflow-library-main-card-hero">
                          <div class="workflow-library-main-card-head">
                            <div>
                              <p class="feature-kicker">Run</p>
                              <p class="workflow-library-record-hero-title">{{ activeWorkflowRecord.name }}</p>
                            </div>

                            <div class="model-section-actions">
                              <span class="pill">{{ activeWorkflowRecord.steps.length }} 个请求</span>
                              <span class="pill pill-neutral">{{ activeWorkflowRecord.protocol.mode }}</span>
                              <span class="pill pill-neutral">最长 {{ formatDurationMs(activeWorkflowMetrics.timeoutMs) }}</span>
                            </div>
                          </div>

                          <div class="workflow-library-runtime-panel">
                            <div class="workflow-library-inline-head">
                              <div>
                                <span class="field-label">执行环境</span>
                                <p class="workflow-library-inline-copy">{{ activeWorkflowEnvironment?.baseUrl || "当前环境未配置 Base URL" }}</p>
                              </div>
                              <button
                                type="button"
                                class="model-action-secondary"
                                @click="openWorkflowRecordEditor(activeWorkflowRecord)"
                              >
                                <GIcon name="settings" />
                                配置
                              </button>
                            </div>

                            <div class="workflow-library-runtime-grid">
                              <div class="workflow-library-runtime-cell">
                                <div class="workflow-library-env-tabs" role="tablist" aria-label="执行环境切换">
                                  <button
                                    v-for="environment in activeWorkflowEnvironments"
                                    :key="environment.id"
                                    type="button"
                                    class="workflow-library-env-tab"
                                    :class="{ 'is-active': activeWorkflowEnvironment?.id === environment.id }"
                                    :title="environment.baseUrl || '未配置 Base URL'"
                                    @click="selectWorkflowEnvironment(environment.id)"
                                  >
                                    {{ environment.label || environment.id }}
                                  </button>
                                </div>
                              </div>

                              <label class="field workflow-library-api-key-field">
                                <span class="field-label">APIKEY</span>
                                <span class="workflow-library-secret-input">
                                  <input
                                    :value="activeWorkflowEnvironment?.apiKey ?? activeWorkflowRecord.apiKey ?? ''"
                                    class="field-input"
                                    :type="activeWorkflowApiKeyInputType"
                                    placeholder="sk-..."
                                    autocomplete="off"
                                    @input="handleWorkflowApiKeyInput"
                                    @change="persistActiveWorkflowRuntimeConfig(true)"
                                  />
                                  <button
                                    type="button"
                                    class="model-icon-button workflow-library-secret-toggle"
                                    :aria-label="ui.workflow.apiKeyVisible ? '隐藏 APIKEY' : '显示 APIKEY'"
                                    :title="ui.workflow.apiKeyVisible ? '隐藏 APIKEY' : '显示 APIKEY'"
                                    @click="ui.workflow.apiKeyVisible = !ui.workflow.apiKeyVisible"
                                  >
                                    <GIcon :name="ui.workflow.apiKeyVisible ? 'eyeOff' : 'eye'" />
                                  </button>
                                </span>
                              </label>
                            </div>
                          </div>
                        </section>

                        <section
                          v-if="activeWorkflowBodyStepOptions.length"
                          class="workflow-library-main-card workflow-library-body-panel"
                          :class="{ 'is-collapsed': ui.workflow.bodyPanelCollapsed }"
                        >
                          <div class="workflow-library-main-card-head">
                            <div>
                              <p class="feature-kicker">Body</p>
                              <p class="model-section-title">请求 Body</p>
                            </div>
                            <div class="model-section-actions workflow-library-body-head-actions">
                              <span class="status-pill" :class="workflowBodyDraftChanged ? 'is-warning' : 'is-success'">
                                {{ workflowBodyDraftChanged ? "临时替换" : "模板一致" }}
                              </span>
                              <button
                                type="button"
                                class="model-icon-button workflow-library-body-toggle"
                                :aria-expanded="String(!ui.workflow.bodyPanelCollapsed)"
                                :aria-label="ui.workflow.bodyPanelCollapsed ? '展开请求 Body' : '折叠请求 Body'"
                                :title="ui.workflow.bodyPanelCollapsed ? '展开' : '折叠'"
                                @click="ui.workflow.bodyPanelCollapsed = !ui.workflow.bodyPanelCollapsed"
                              >
                                <GIcon :name="ui.workflow.bodyPanelCollapsed ? 'chevronDown' : 'chevronUp'" />
                              </button>
                            </div>
                          </div>

                          <div v-if="!ui.workflow.bodyPanelCollapsed" class="workflow-library-body-toolbar">
                            <label class="field workflow-library-body-step-field">
                              <span class="field-label">请求步骤</span>
                              <select
                                v-model="ui.workflow.bodyStepId"
                                class="field-input workflow-library-body-step-select"
                                @change="handleWorkflowBodyStepSelect"
                              >
                                <option v-for="entry in activeWorkflowBodyStepOptions" :key="entry.id" :value="entry.id">
                                  {{ entry.label }} · {{ entry.method }}
                                </option>
                              </select>
                            </label>

                            <div class="model-section-actions workflow-library-body-actions">
                              <button type="button" class="model-action-secondary" @click="repairWorkflowBodyDraft">
                                <GIcon name="refresh" />
                                修复格式
                              </button>
                              <button type="button" class="model-action-secondary" @click="syncWorkflowBodyDraftFromActiveStep({ force: true })">
                                <GIcon name="return" />
                                恢复模板
                              </button>
                              <button
                                type="button"
                                class="model-action-secondary"
                                :disabled="!workflowBodyDraftChanged"
                                @click="persistWorkflowBodyDraftToTemplate"
                              >
                                <GIcon name="check" />
                                写回模板
                              </button>
                            </div>
                          </div>

                          <label v-if="!ui.workflow.bodyPanelCollapsed" class="field">
                            <span class="field-label">Body 内容</span>
                            <textarea
                              v-model="ui.workflow.bodyDraftText"
                              class="field-textarea workflow-library-body-textarea"
                              rows="10"
                              placeholder="粘贴 JSON body，或直接粘贴包含 -d / --data 的完整 curl"
                              @input="handleWorkflowBodyDraftInput"
                            ></textarea>
                          </label>

                          <div v-if="!ui.workflow.bodyPanelCollapsed" class="workflow-library-body-footer">
                            <span
                              v-if="ui.workflow.bodyFeedbackText"
                              class="status-pill"
                              :class="ui.workflow.bodyFeedbackTone === 'success' ? 'is-success' : ui.workflow.bodyFeedbackTone === 'warning' ? 'is-warning' : ''"
                            >
                              {{ ui.workflow.bodyFeedbackText }}
                            </span>
                            <p class="workflow-library-inline-copy">直接执行时只替换本次请求体；点击写回模板后才会更新原始 curl。</p>
                          </div>
                        </section>

                        <section class="workflow-library-main-card workflow-library-run-section">
                          <div class="workflow-library-main-card-head">
                            <div>
                              <p class="feature-kicker">Status</p>
                              <p class="model-section-title">执行状态</p>
                            </div>
                            <span class="status-pill" :class="workflowRunStatusTone">{{ workflowRunStatusLabel }}</span>
                          </div>

                          <div v-if="ui.workflow.runResult" class="workflow-library-run-visual">
                            <section class="workflow-library-run-overview" :class="workflowRunStatusTone">
                              <div class="workflow-library-run-orb">
                                <span>{{ getWorkflowRunProgressPercent(ui.workflow.runResult) }}%</span>
                              </div>
                              <div class="workflow-library-run-overview-copy">
                                <p class="workflow-library-run-overview-title">{{ workflowRunStatusLabel }}</p>
                                <p>{{ getWorkflowRunSummaryText(ui.workflow.runResult) }}</p>
                              </div>
                              <div class="workflow-library-run-overview-metrics">
                                <span>{{ getWorkflowRunCompletedCount(ui.workflow.runResult) }}/{{ ui.workflow.runResult.steps?.length ?? 0 }} 步</span>
                                <span>{{ getWorkflowRunDurationLabel(ui.workflow.runResult) }}</span>
                              </div>
                            </section>

                            <div v-if="Object.keys(ui.workflow.runResult.variables ?? {}).length" class="workflow-library-variable-result-row">
                              <span
                                v-for="[name, value] in Object.entries(ui.workflow.runResult.variables)"
                                :key="name"
                                class="pill pill-neutral"
                              >
                                {{ name }} = {{ value }}
                              </span>
                            </div>

                            <div class="workflow-library-run-flow">
                              <article
                                v-for="stepResult in ui.workflow.runResult.steps"
                                :key="stepResult.stepId"
                                class="workflow-library-run-flow-step"
                                :class="getWorkflowStepStatusTone(stepResult.status)"
                              >
                                <span class="workflow-library-run-flow-marker"></span>
                                <div class="workflow-library-run-flow-body">
                                  <div class="workflow-library-run-step-head">
                                    <strong>{{ stepResult.name }}</strong>
                                    <div class="model-section-actions workflow-library-run-step-badges">
                                      <span class="pill pill-neutral">{{ getWorkflowStepModeLabel(stepResult.mode) }}</span>
                                      <span class="pill pill-neutral">{{ stepResult.attempt }}/{{ stepResult.maxAttempts }}</span>
                                      <span class="status-pill" :class="getWorkflowStepStatusTone(stepResult.status)">
                                        {{ getWorkflowStepStatusLabel(stepResult.status) }}
                                      </span>
                                    </div>
                                  </div>
                                  <div class="workflow-library-run-progress" aria-hidden="true">
                                    <span :style="{ width: `${getWorkflowStepProgressPercent(stepResult)}%` }"></span>
                                  </div>
                                  <div class="workflow-library-run-step-meta">
                                    <span>exit {{ stepResult.exitCode ?? "--" }}</span>
                                    <span v-if="stepResult.completionValue">状态 {{ stepResult.completionValue }}</span>
                                  </div>
                                  <div v-if="getWorkflowStepVisualRows(stepResult).length" class="workflow-library-response-grid">
                                    <article
                                      v-for="row in getWorkflowStepVisualRows(stepResult)"
                                      :key="`${stepResult.stepId}_${row.label}`"
                                      class="workflow-library-response-chip"
                                    >
                                      <span>{{ row.label }}</span>
                                      <strong>{{ row.value }}</strong>
                                    </article>
                                  </div>
                                  <p v-else class="workflow-library-response-empty">
                                    {{ stepResult.status === "pending" ? "等待执行" : "暂无响应摘要" }}
                                  </p>
                                </div>
                              </article>
                            </div>
                          </div>
                          <div v-else class="workflow-library-run-empty">
                            <p>点击右上角执行后，会在这里展示步骤流转、轮询进度和响应摘要。</p>
                          </div>
                        </section>

                        <div class="workflow-library-step-list workflow-library-step-list-flat">
                          <article
                            v-for="(step, index) in activeWorkflowSteps"
                            :key="step.id"
                            class="workflow-library-step-card workflow-library-step-card-collapsible"
                            :class="{ 'is-expanded': isWorkflowStepExpanded(step.id) }"
                          >
                            <div class="workflow-library-step-head">
                              <div class="workflow-library-step-head-main">
                                <span class="workflow-library-step-order">{{ index + 1 }}</span>
                                <div>
                                  <p class="workflow-library-step-title">{{ step.name }}</p>
                                  <p class="workflow-library-step-url workflow-library-step-url-compact">{{ step.url || step.method }}</p>
                                </div>
                              </div>

                              <div class="model-section-actions workflow-library-step-actions">
                                <span class="pill">{{ step.method }}</span>
                                <span v-if="step.executionMode === 'polling'" class="pill pill-neutral">轮询 {{ step.maxAttempts }} 次</span>
                                <span v-else-if="step.waitBeforeMs" class="pill pill-neutral">等待 {{ formatDurationMs(step.waitBeforeMs) }}</span>
                                <button
                                  type="button"
                                  class="model-icon-button"
                                  :title="ui.workflow.copiedStepId === step.id ? '已复制' : '复制 curl'"
                                  :aria-label="ui.workflow.copiedStepId === step.id ? '已复制' : '复制 curl'"
                                  @click="handleWorkflowCurlCopy(step)"
                                >
                                  <GIcon :name="ui.workflow.copiedStepId === step.id ? 'check' : 'copy'" />
                                </button>
                                <button
                                  type="button"
                                  class="model-icon-button workflow-library-step-toggle"
                                  :aria-expanded="String(isWorkflowStepExpanded(step.id))"
                                  :aria-label="isWorkflowStepExpanded(step.id) ? '折叠请求步骤' : '展开请求步骤'"
                                  :title="isWorkflowStepExpanded(step.id) ? '折叠' : '展开'"
                                  @click="toggleWorkflowStepExpanded(step.id)"
                                >
                                  <GIcon :name="isWorkflowStepExpanded(step.id) ? 'chevronUp' : 'chevronDown'" />
                                </button>
                              </div>
                            </div>

                            <div v-if="isWorkflowStepExpanded(step.id)" class="workflow-library-step-collapsible-body">
                              <div class="workflow-library-step-meta">
                                <p class="workflow-library-step-url">{{ step.url }}</p>
                                <div class="extension-tag-row">
                                  <span v-for="hint in step.responseFieldHints" :key="hint" class="pill pill-neutral">{{ hint }}</span>
                                </div>
                              </div>

                              <div class="workflow-library-step-binding-grid">
                                <div class="workflow-library-step-binding-box">
                                  <span class="workflow-library-step-binding-label">消费变量</span>
                                  <p v-if="step.consumes.length" class="workflow-library-step-binding-copy">
                                    {{ step.consumes.map((item) => item.name).join(" / ") }}
                                  </p>
                                  <p v-else class="workflow-library-step-binding-copy">无</p>
                                </div>

                                <div class="workflow-library-step-binding-box">
                                  <span class="workflow-library-step-binding-label">产出变量</span>
                                  <p v-if="step.produces.length" class="workflow-library-step-binding-copy">
                                    {{ step.produces.map((item) => `${item.name}${item.path ? ` ← ${item.path}` : ""}`).join(" / ") }}
                                  </p>
                                  <p v-else class="workflow-library-step-binding-copy">无</p>
                                </div>
                              </div>

                              <div class="workflow-library-code-shell">
                                <pre class="workflow-library-code-block"><code>{{ step.curl }}</code></pre>
                              </div>
                            </div>
                          </article>
                        </div>
                      </template>
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
                          >
                            <GIcon name="return" />
                          </button>
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
                          >
                            <GIcon name="jump" />
                          </button>
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

                            <div v-if="message.attachments?.length" class="command-message-attachments">
                              <span
                                v-for="attachment in message.attachments"
                                :key="attachment.id"
                                class="command-message-attachment"
                                :class="{ 'is-error': attachment.readStatus === 'error' }"
                                :title="getCommandAttachmentTitle(attachment)"
                              >
                                {{ attachment.name }}
                              </span>
                            </div>

                            <details v-if="message.role === 'assistant' && message.artifact" class="command-artifact-panel">
                              <summary>{{ getCommandArtifactSummary(message.artifact) }}</summary>

                              <div class="command-artifact-body">
                                <div class="extension-tag-row command-artifact-tag-row">
                                  <span class="pill pill-neutral">{{ message.artifact.profileLabel }}</span>
                                  <span class="pill pill-neutral">{{ message.artifact.model }}</span>
                                  <span v-if="message.artifact.skillName" class="pill">{{ message.artifact.skillName }}</span>
                                  <span v-if="message.artifact.autoSelectedMcp" class="pill">自动选工具</span>
                                  <span v-if="message.artifact.mcpServerName" class="pill pill-neutral">{{ message.artifact.mcpServerName }}</span>
                                  <span v-if="message.artifact.mcpToolName" class="pill pill-neutral">{{ message.artifact.mcpToolName }}</span>
                                </div>

                                <div v-if="message.artifact.mcpResultText || message.artifact.stopReason" class="command-artifact-inline-list">
                                  <div v-if="message.artifact.mcpResultText" class="command-artifact-inline-row">
                                    <span class="command-artifact-inline-label">工具结果</span>
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
                                    <span class="command-artifact-section-title">工具调用</span>
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
                              <span class="command-message-time">{{ ui.command.liveProgress?.updatedAt ? formatLocalDateTime(ui.command.liveProgress.updatedAt) : "处理中" }}</span>
                            </div>

                            <div
                              class="command-message-body command-rich-text"
                              v-html="renderRichText(ui.command.liveProgress?.statusText || '正在读取上下文并规划执行步骤，请稍等片刻。')"
                            ></div>

                            <details v-if="ui.command.liveProgress?.artifact" class="command-artifact-panel" open>
                              <summary>{{ getCommandArtifactSummary(ui.command.liveProgress.artifact) }}</summary>

                              <div class="command-artifact-body">
                                <div class="extension-tag-row command-artifact-tag-row">
                                  <span v-if="ui.command.liveProgress.artifact.profileLabel" class="pill pill-neutral">{{ ui.command.liveProgress.artifact.profileLabel }}</span>
                                  <span v-if="ui.command.liveProgress.artifact.model" class="pill pill-neutral">{{ ui.command.liveProgress.artifact.model }}</span>
                                  <span v-if="ui.command.liveProgress.artifact.skillName" class="pill">{{ ui.command.liveProgress.artifact.skillName }}</span>
                                  <span v-if="ui.command.liveProgress.artifact.autoSelectedMcp" class="pill">自动选工具</span>
                                  <span v-if="ui.command.liveProgress.artifact.mcpServerName" class="pill pill-neutral">{{ ui.command.liveProgress.artifact.mcpServerName }}</span>
                                  <span v-if="ui.command.liveProgress.artifact.mcpToolName" class="pill pill-neutral">{{ ui.command.liveProgress.artifact.mcpToolName }}</span>
                                </div>

                                <div v-if="ui.command.liveProgress.artifact.mcpResultText || ui.command.liveProgress.artifact.stopReason" class="command-artifact-inline-list">
                                  <div v-if="ui.command.liveProgress.artifact.mcpResultText" class="command-artifact-inline-row">
                                    <span class="command-artifact-inline-label">工具结果</span>
                                    <p
                                      class="command-artifact-inline-copy"
                                      :title="getCommandArtifactInlineText(ui.command.liveProgress.artifact.mcpResultText)"
                                    >
                                      {{ getCommandArtifactInlineText(ui.command.liveProgress.artifact.mcpResultText) }}
                                    </p>
                                  </div>

                                  <div v-if="ui.command.liveProgress.artifact.stopReason" class="command-artifact-inline-row">
                                    <span class="command-artifact-inline-label">停止原因</span>
                                    <p
                                      class="command-artifact-inline-copy"
                                      :title="getCommandArtifactInlineText(ui.command.liveProgress.artifact.stopReason)"
                                    >
                                      {{ getCommandArtifactInlineText(ui.command.liveProgress.artifact.stopReason) }}
                                    </p>
                                  </div>
                                </div>

                                <div class="command-artifact-section">
                                  <div class="command-artifact-section-head">
                                    <span class="command-artifact-section-title">执行步骤</span>
                                    <span class="pill pill-neutral command-artifact-section-count">
                                      {{ ui.command.liveProgress.artifact.steps?.length ?? 0 }}
                                    </span>
                                  </div>

                                  <div v-if="ui.command.liveProgress.artifact.steps?.length" class="command-artifact-chain">
                                    <article v-for="step in ui.command.liveProgress.artifact.steps" :key="step.id" class="command-artifact-chain-item">
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

                                <div v-if="ui.command.liveProgress.artifact.mcpCalls?.length" class="command-artifact-section">
                                  <div class="command-artifact-section-head">
                                    <span class="command-artifact-section-title">工具调用</span>
                                    <span class="pill pill-neutral command-artifact-section-count">
                                      {{ ui.command.liveProgress.artifact.mcpCalls.length }}
                                    </span>
                                  </div>

                                  <div class="command-artifact-chain">
                                    <article
                                      v-for="call in ui.command.liveProgress.artifact.mcpCalls"
                                      :key="`${call.createdAt}-${call.serverName}-${call.toolName}-${call.round}`"
                                      class="command-artifact-chain-item is-mcp"
                                    >
                                      <span class="command-artifact-chain-rail" aria-hidden="true">
                                        <span class="command-artifact-chain-bead"></span>
                                      </span>

                                      <div class="command-artifact-chain-main">
                                        <p class="command-artifact-chain-title" :title="getCommandArtifactCallTitle(call)">
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
                              <span class="field-label">工具服务</span>
                              <select v-model="ui.command.form.mcpServerId" class="field-input" :disabled="!commandSelectedAgent" @change="handleCommandServerChange">
                                <option value="">不指定工具服务</option>
                                <option v-for="server in commandAuthorizedServers" :key="server.id" :value="server.id">
                                  {{ server.name }} / {{ server.transport.toUpperCase() }}
                                </option>
                              </select>
                            </label>

                            <div class="field command-settings-tool-field">
                              <span class="field-label">工具</span>
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
                              <span class="field-label">工具参数 JSON</span>
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
                              >
                                <GIcon name="gear" />
                              </button>
                            </div>
                          </div>

                          <div class="command-input-frame">
                            <div v-if="ui.command.attachments.length" class="command-attachment-tray">
                              <span
                                v-for="attachment in ui.command.attachments"
                                :key="attachment.id"
                                class="command-attachment-chip"
                                :class="{ 'is-error': attachment.readStatus === 'error' }"
                                :title="getCommandAttachmentTitle(attachment)"
                              >
                                <span class="command-attachment-name">{{ attachment.name }}</span>
                                <button
                                  type="button"
                                  class="command-attachment-remove"
                                  :aria-label="`移除 ${attachment.name}`"
                                  title="移除"
                                  @click="removeCommandAttachment(attachment.id)"
                                >
                                  <GIcon name="close" :size="13" />
                                </button>
                              </span>
                            </div>

                            <textarea
                              ref="commandInputRef"
                              v-model="ui.command.draftInput"
                              class="field-textarea command-input"
                              :placeholder="commandSelectedAgent ? '直接告诉 Gordon 你要完成什么工作，Enter 发送，Shift + Enter 换行。' : '先在能力拓展里启用一个 Agent，Gordon 才能开始工作。'"
                              :disabled="!commandSelectedAgent || ui.command.isRunning"
                              autofocus
                              @compositionstart="handleCommandInputCompositionStart"
                              @compositionend="handleCommandInputCompositionEnd"
                              @keydown.enter.exact="handleCommandInputEnterKeydown"
                            ></textarea>

                            <button
                              type="button"
                              class="model-icon-button command-input-attach"
                              :disabled="!commandSelectedAgent || ui.command.isRunning"
                              aria-label="上传附件"
                              title="上传附件"
                              @click="handleCommandAttachmentSelect"
                            >
                              <GIcon name="add" />
                            </button>

                            <button
                              type="submit"
                              class="model-icon-button command-input-submit"
                              :disabled="!commandSelectedAgent || ui.command.isRunning"
                              :aria-label="ui.command.isRunning ? '处理中' : '发送消息'"
                              :title="ui.command.isRunning ? '处理中' : '发送消息'"
                            >
                              <GIcon name="enter" />
                            </button>
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
                            >
                              <GIcon name="delete" />
                            </button>
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
                              >
                                <GIcon name="play" />
                              </button>

                              <span v-if="isBuiltinWorkbenchItem(agent.id)" class="pill pill-neutral">内置</span>

                              <template v-else>
                                <button
                                  type="button"
                                  class="model-icon-button"
                                  :aria-label="`编辑 ${agent.name}`"
                                  title="编辑"
                                  @click="openExtensionEditor('agent', agent)"
                                >
                                  <GIcon name="edit" />
                                </button>

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
                                >
                                  <GIcon name="delete" />
                                </button>
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
                                >
                                  <GIcon name="edit" />
                                </button>

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
                                >
                                  <GIcon name="delete" />
                                </button>
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
                                >
                                  <GIcon name="edit" />
                                </button>

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
                                >
                                  <GIcon name="delete" />
                                </button>
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
                            <span class="field-label">本次附加工具服务</span>
                            <select v-model="ui.extensions.runner.mcpServerId" class="field-input" @change="handleRunnerServerChange">
                              <option value="">不调用工具</option>
                              <option v-for="server in runnerAuthorizedServers" :key="server.id" :value="server.id">
                                {{ server.name }} / {{ server.transport.toUpperCase() }}
                              </option>
                            </select>
                          </label>

                          <label class="extension-selection-item field-full">
                            <input v-model="ui.extensions.runner.autoSelectMcp" type="checkbox" />
                            <span>未手动指定工具时，允许 Agent 自动选择工具</span>
                          </label>

                          <div class="field field-full">
                            <div class="weekly-inline-actions weekly-inline-actions-spread">
                              <span class="field-label">工具</span>
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
                            <span class="field-label">工具参数 JSON</span>
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
                          <span v-if="runnerLatestResult.autoSelectedMcp" class="pill">自动选工具</span>
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
                            <span class="field-label">工具汇总结果</span>
                            <textarea class="field-textarea extension-textarea-md" readonly>{{ runnerLatestResult.mcpResultText }}</textarea>
                          </label>

                          <label v-if="runnerLatestResult.stopReason" class="field field-full">
                            <span class="field-label">停止原因</span>
                            <textarea class="field-textarea extension-textarea-md" readonly>{{ runnerLatestResult.stopReason }}</textarea>
                          </label>

                          <div class="field field-full">
                            <span class="field-label">工具调用明细</span>
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
                            <p v-else class="model-empty-copy">本次运行没有发生工具调用。</p>
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
                            <span v-if="log.autoSelectedMcp" class="pill">自动选工具</span>
                            <span class="pill pill-neutral">{{ log.mcpServerName ?? "工具服务" }}</span>
                            <span class="pill pill-neutral">{{ log.mcpToolName }}</span>
                            <span v-if="(log.mcpCalls?.length ?? 0) > 1" class="pill pill-neutral">{{ log.mcpCalls.length }} 轮工具</span>
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
  getMarkdownListLineMeta,
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
const FEATURE_WORKFLOW_LIBRARY = "workflow-library";
const FEATURE_COMMAND_WORKSHOP = "command-workshop";
const FEATURE_MODEL_MANAGEMENT = "model-management";
const FEATURE_EXTENSIONS_MANAGEMENT = "extensions-management";

const BRAND_RANDOM_TEXTS = [
  "LIKEGORD",
  "NICEJOB",
  "OVERMAX",
  "LEVELUP",
  "TOPFORM",
  "ELITE",
  "MASSIVE",
  "TRYAGAIN",
  "DOMINATE",
  "LEGEND",
  "VICTORY",
  "ARCANE",
  "OPTIMUS",
  "ULTRAMAN",
  "GODZILLA",
  "SUPERMAN",
  "SWORDART",
  "ONEPIECE",
  "ONLYUP",
  "ELDENRING",
  "BLACKMYTH",
  "GENSHIN",
  "STARAIL",
  "TWOFUS",
  "HALFLIFE",
  "VALORANT",
  "FORTNITE",
  "OVERWATCH",
];

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
    title: "任务笔记",
    tier: "default"
  },
  {
    id: FEATURE_WORKFLOW_LIBRARY,
    kicker: "workflow",
    title: "流程中心",
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
  },
  {
    id: FEATURE_EXTENSIONS_MANAGEMENT,
    title: "能力拓展",
  }
];

const FEATURE_PLACEHOLDERS = {
  [FEATURE_MARKETPLACE]: {
    title: "应用广场",
    description: "这里会继续承接应用发现、工具接入和能力分发。"
  }
};

const WEEKLY_RISK_KEYWORDS = ["风险", "问题", "阻塞", "受阻", "卡点", "依赖", "待协调", "延期", "等待"];
const WEEKLY_NO_RISK_PATTERN = /(暂无风险|无风险|无阻塞|暂无阻塞|未发现阻塞|风险可控)/;
const WEEKLY_AUTOSAVE_DELAY = 700;
const DAILY_REPORT_GUIDE_COPY = [
  "系统会自动遍历今天有更新的叶子任务。",
  "更新范围包括：修改任务内容、修改任务状态。",
  "输出结果会按项目归组，仅保留今天推进过的任务清单。"
].join("\n");
const MODEL_BALANCE_QUERY_TEMPLATE = [
  "({",
  "  request: {",
  "    url: \"https://xxxxx\",",
  "    method: \"GET\",",
  "    headers: {",
  "      Authorization: \"Bearer {{apiKey}}\",",
  "      \"User-Agent\": \"cc-switch/1.0\",",
  "    },",
  "  },",
  "  extractor: function (raw) {",
  "    const response = typeof raw === \"string\" ? JSON.parse(raw) : raw || {};",
  "",
  "    const data = response.resp_data || {};",
  "",
  "    return {",
  "      planName: data.team || \"unknown\",",
  "      remaining: data.money || 0,",
  "      used: 1000 - data.money,",
  "      total: 1000,",
  "      unit: \"USD\",",
  "    };",
  "  },",
  "});"
].join("\n");

const WORKFLOW_DEFAULT_ENVIRONMENTS = [
  { id: "dev", label: "DEV", baseUrl: "" },
  { id: "test", label: "TEST", baseUrl: "" },
  { id: "pre", label: "PRE", baseUrl: "" },
  { id: "prod", label: "PROD", baseUrl: "" }
];
const WORKFLOW_CURL_BODY_OPTIONS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--json"]);

const desktopApi = window.gordonDesktop ?? null;
let splineApplicationClass = null;
let splineApplicationPromise = null;
let weeklyAutosaveTimer = null;
let weeklySavedSnapshot = "";
let weeklyAutosaveInFlight = false;
let weeklyReportCopyTimer = null;
let agentProgressListenerId = null;
let workflowProgressListenerId = null;

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
      notes: profile?.notes ?? "",
      balanceQueryCode: profile?.balanceQueryCode ?? ""
    },
    balanceQueryResult: profile?.balanceSnapshot ?? null,
    balanceQueryError: "",
    isBalanceQuerying: false,
    lastBalanceQueryCode: profile?.balanceQueryCode ?? ""
  };
}

function createWeeklyState() {
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

function createWorkflowState() {
  return {
    view: "library",
    activeCardId: null,
    activeRecordId: null,
    copiedStepId: null,
    bodyStepId: null,
    bodyDraftText: "",
    bodyFeedbackText: "",
    bodyFeedbackTone: "neutral",
    bodyPanelCollapsed: false,
    apiKeyVisible: false,
    searchQuery: "",
    editingRecordId: null,
    isRunning: false,
    isCancelling: false,
    runResult: null,
    activeProgressEventId: null,
    expandedStepIds: [],
    isSavingRecord: false,
    recordDraft: createWorkflowRecordDraft()
  };
}

function createDefaultWorkflowEnvironments(seedBaseUrl = "", seedApiKey = "") {
  return WORKFLOW_DEFAULT_ENVIRONMENTS.map((environment) => ({
    ...environment,
    baseUrl: environment.id === "prod" ? seedBaseUrl : "",
    apiKey: environment.id === "prod" ? seedApiKey : ""
  }));
}

function createWorkflowStepDraft(overrides = {}) {
  const successValues = Array.isArray(overrides.successValues) ? overrides.successValues : [];
  const failureValues = Array.isArray(overrides.failureValues) ? overrides.failureValues : [];

  return {
    id: overrides.id ?? createLocalId("workflow_step_draft"),
    name: overrides.name ?? "",
    curl: overrides.curl ?? "",
    waitBeforeMs: String(overrides.waitBeforeMs ?? 0),
    executionMode: overrides.executionMode ?? (overrides.completionPath ? "polling" : "once"),
    pollIntervalMs: String(overrides.pollIntervalMs ?? 5000),
    maxAttempts: String(overrides.maxAttempts ?? 20),
    completionPath: overrides.completionPath ?? "",
    successValuesText: successValues.join(", "),
    failureValuesText: failureValues.join(", "),
    produces: (Array.isArray(overrides.produces) ? overrides.produces : []).map((binding) => createWorkflowOutputDraft(binding))
  };
}

function createWorkflowOutputDraft(overrides = {}) {
  return {
    id: overrides.id ?? createLocalId("workflow_output_draft"),
    name: overrides.name ?? "",
    path: overrides.path ?? ""
  };
}

function createWorkflowRecordDraft() {
  return {
    name: "",
    scenario: "",
    mode: "single",
    tagsText: "curl, API",
    pollIntervalMs: "3000",
    maxAttempts: "20",
    activeEnvironmentId: "prod",
    apiKey: "",
    environments: createDefaultWorkflowEnvironments(),
    steps: [createWorkflowStepDraft()],
    notes: ""
  };
}

function buildCommandWorkshopLiveArtifact(progress) {
  return buildCommandWorkshopArtifact({
    profileLabel: progress?.profileLabel ?? "",
    model: progress?.model ?? "",
    skillName: progress?.skillName ?? null,
    autoSelectedMcp: Boolean(progress?.autoSelectedMcp),
    mcpServerName: progress?.mcpServerName ?? null,
    mcpToolName: progress?.mcpToolName ?? null,
    mcpResultText: progress?.mcpResultText ?? null,
    mcpCalls: [...(progress?.mcpCalls ?? [])],
    stopReason: progress?.stopReason ?? "",
    steps: [...(progress?.steps ?? [])],
    createdAt: progress?.createdAt ?? new Date().toISOString()
  });
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
    messages: toPlainIpcData(session?.messages ?? [], []).map((message) => ({
      ...message,
      attachments: toPlainIpcData(message?.attachments ?? [], [])
    }))
  };
}

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
const commandInputRef = ref(null);
const commandMessagesRef = ref(null);
const gordonDialogPrimaryRef = ref(null);
const gordonDialogInputRef = ref(null);
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
  skillDefinitions: [],
  mcpServers: [],
  agentProfiles: [],
  agentRunLogs: [],
  commandSessions: []
});

const modelBalanceRuntime = reactive({
  loadingByProfileId: {},
  snapshotByProfileId: {},
  feedbackByProfileId: {}
});

const ui = reactive({
  modelManagement: {
    view: "list",
    editor: createModelEditorState("openai")
  },
  weekly: createWeeklyState(),
  workflow: createWorkflowState(),
  dialog: createGordonDialogState(),
  command: {
    view: "list",
    composerView: "input",
    activeSessionId: null,
    activeProgressEventId: null,
    form: createCommandDraft(),
    draftInput: "",
    attachments: [],
    availableMcpTools: [],
    isRunning: false,
    isInputComposing: false,
    liveProgress: null
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
    (activeFeature.value === FEATURE_WORKFLOW_LIBRARY && ui.workflow.view !== "library") ||
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

function hasModelBalanceQuery(profile) {
  return Boolean(String(profile?.balanceQueryCode ?? "").trim());
}

function formatBalanceNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "--";
}

function getModelBalanceSnapshot(profile) {
  return modelBalanceRuntime.snapshotByProfileId[profile?.id] ?? profile?.balanceSnapshot ?? null;
}

function getModelBalanceFeedback(profile) {
  return modelBalanceRuntime.feedbackByProfileId[profile?.id] ?? null;
}

function isModelBalanceRefreshing(profileId) {
  return Boolean(modelBalanceRuntime.loadingByProfileId[profileId]);
}

function setModelBalanceRefreshing(profileId, shouldRefresh) {
  modelBalanceRuntime.loadingByProfileId[profileId] = shouldRefresh;
}

function syncModelBalanceRuntimeFromProfiles(profiles = []) {
  const profileIds = new Set((Array.isArray(profiles) ? profiles : []).map((profile) => profile.id));

  Object.keys(modelBalanceRuntime.snapshotByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.snapshotByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.loadingByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.loadingByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.feedbackByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.feedbackByProfileId[profileId];
    }
  });

  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    modelBalanceRuntime.snapshotByProfileId[profile.id] = profile.balanceSnapshot ?? null;
  });
}

function setModelBalanceFeedback(profileId, text, tone = "neutral") {
  modelBalanceRuntime.feedbackByProfileId[profileId] = {
    text: String(text ?? "").trim(),
    tone
  };
}

function toPlainModelProfile(profile) {
  return {
    id: String(profile?.id ?? ""),
    provider: profile?.provider,
    displayName: String(profile?.displayName ?? ""),
    model: String(profile?.model ?? ""),
    apiKey: String(profile?.apiKey ?? ""),
    baseUrl: String(profile?.baseUrl ?? ""),
    organization: String(profile?.organization ?? ""),
    project: String(profile?.project ?? ""),
    location: String(profile?.location ?? ""),
    notes: String(profile?.notes ?? ""),
    balanceQueryCode: String(profile?.balanceQueryCode ?? ""),
    updatedAt: String(profile?.updatedAt ?? "")
  };
}

function applyModelBalanceSnapshot(profileId, balanceSnapshot) {
  modelBalanceRuntime.snapshotByProfileId[profileId] = balanceSnapshot;
  workbench.modelSettings.profiles = workbench.modelSettings.profiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          balanceSnapshot
        }
      : profile
  );

  if (ui.modelManagement.editor.profileId === profileId) {
    ui.modelManagement.editor.balanceQueryResult = balanceSnapshot;
    ui.modelManagement.editor.balanceQueryError = "";
    ui.modelManagement.editor.lastBalanceQueryCode = ui.modelManagement.editor.values.balanceQueryCode.trim();
  }
}

function buildModelEditorPayload() {
  const balanceQueryCode = ui.modelManagement.editor.values.balanceQueryCode.trim();
  const shouldReuseBalanceSnapshot =
    balanceQueryCode && balanceQueryCode === String(ui.modelManagement.editor.lastBalanceQueryCode ?? "").trim();

  return {
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
    balanceQueryCode,
    balanceSnapshot: shouldReuseBalanceSnapshot ? ui.modelManagement.editor.balanceQueryResult ?? null : null,
    updatedAt: new Date().toISOString()
  };
}

const activeWeeklyRecord = computed(() =>
  workbench.weeklyProgress.find((record) => record.id === ui.weekly.activeRecordId) ?? null
);

const weeklyFocusRecord = computed(
  () => workbench.weeklyProgress.find((record) => record.status === "active") ?? workbench.weeklyProgress[0] ?? null
);
const weeklyFocusMetrics = computed(() => getWeeklyProgressMetrics(weeklyFocusRecord.value ?? { projects: [] }));
const weeklyFocusCompletionRate = computed(() => getWeeklyProgressCompletionRate(weeklyFocusRecord.value ?? { projects: [] }));
const weeklyDraft = computed(() => ui.weekly.draft);
const workflowLibraryCards = computed(() => [...workbench.workflowLibrary]);
const activeWorkflowCard = computed(
  () => workflowLibraryCards.value.find((entry) => entry.id === ui.workflow.activeCardId) ?? workflowLibraryCards.value[0] ?? null
);
const activeWorkflowRecords = computed(() => activeWorkflowCard.value?.records ?? []);
const activeWorkflowRecord = computed(
  () => activeWorkflowRecords.value.find((record) => record.id === ui.workflow.activeRecordId) ?? activeWorkflowRecords.value[0] ?? null
);
const activeWorkflowProtocol = computed(() => activeWorkflowRecord.value?.protocol ?? null);
const activeWorkflowSteps = computed(() => activeWorkflowRecord.value?.steps ?? []);
const activeWorkflowBodyStepOptions = computed(() =>
  activeWorkflowSteps.value
    .map((step, index) => {
      const bodySegment = findWorkflowCurlBodySegment(step?.curl ?? "");

      if (!bodySegment) {
        return null;
      }

      return {
        id: step.id,
        label: step.name || `请求 ${index + 1}`,
        method: step.method || extractCurlMethod(step.curl),
        body: bodySegment.value,
        step
      };
    })
    .filter(Boolean)
);
const activeWorkflowBodyStep = computed(
  () =>
    activeWorkflowBodyStepOptions.value.find((entry) => entry.id === ui.workflow.bodyStepId) ??
    activeWorkflowBodyStepOptions.value[0] ??
    null
);
const workflowBodyDraftChanged = computed(() => {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!activeBodyStep) {
    return false;
  }

  return normalizeWorkflowBodyDraftForCompare(ui.workflow.bodyDraftText) !== normalizeWorkflowBodyDraftForCompare(activeBodyStep.body);
});
const activeWorkflowEnvironments = computed(() => normalizeWorkflowEnvironments(activeWorkflowRecord.value));
const activeWorkflowEnvironment = computed(
  () =>
    activeWorkflowEnvironments.value.find((environment) => environment.id === activeWorkflowRecord.value?.activeEnvironmentId) ??
    activeWorkflowEnvironments.value.find((environment) => environment.id === "prod") ??
    activeWorkflowEnvironments.value[0] ??
    null
);
const activeWorkflowApiKeyInputType = computed(() => (ui.workflow.apiKeyVisible ? "text" : "password"));
const filteredWorkflowRecords = computed(() => {
  const query = String(ui.workflow.searchQuery ?? "").trim().toLowerCase();

  if (!query) {
    return activeWorkflowRecords.value;
  }

  return activeWorkflowRecords.value.filter((record) =>
    [
      record.name,
      record.summary,
      record.scenario,
      record.notes,
      record.tags?.join(" "),
      record.environments?.map((environment) => `${environment.label} ${environment.baseUrl}`).join(" "),
      record.steps?.map((step) => `${step.name} ${step.url} ${step.curl}`).join(" ")
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
});
const workflowDetailTitle = computed(() => {
  if (ui.workflow.view === "editor") {
    return ui.workflow.editingRecordId ? "编辑工作流" : "新建工作流";
  }

  if (ui.workflow.view === "run") {
    return activeWorkflowRecord.value?.name ?? "执行工作流";
  }

  return activeWorkflowCard.value?.title ?? "流程中心";
});
const workflowRunControlLabel = computed(() => {
  if (ui.workflow.isCancelling) {
    return "中断中";
  }

  return ui.workflow.isRunning ? "中断执行" : "执行工作流";
});
const workflowRunControlIcon = computed(() => {
  if (ui.workflow.isCancelling) {
    return "loading";
  }

  return ui.workflow.isRunning ? "stop" : "play";
});
const workflowRunStatusLabel = computed(() => {
  if (ui.workflow.isCancelling) {
    return "中断中";
  }

  if (!ui.workflow.runResult) {
    return "待执行";
  }

  if (ui.workflow.runResult.status === "cancelled") {
    return "已中断";
  }

  if (ui.workflow.isRunning) {
    return "执行中";
  }

  return ui.workflow.runResult.status === "success" ? "执行成功" : "执行失败";
});
const workflowRunStatusTone = computed(() => {
  if (ui.workflow.isCancelling) {
    return "is-cancelled";
  }

  if (!ui.workflow.runResult) {
    return "";
  }

  if (ui.workflow.runResult.status === "cancelled") {
    return "is-cancelled";
  }

  if (ui.workflow.isRunning) {
    return "is-warning";
  }

  return ui.workflow.runResult.status === "success" ? "is-success" : "is-danger";
});
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
const weeklyReportOutputLabel = computed(() => (weeklyIsWeeklyReportMode.value ? "发送给领导的周报" : getDailyReportHeadingTitle()));
const weeklyReportOutputMode = computed(() => ui.weekly.reportOutputMode === "edit" ? "edit" : "preview");
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

  return weeklyIsWeeklyReportMode.value
    ? "按当前模板生成周报输出。"
    : ui.weekly.dailyReportUseModelOptimization
      ? "先提取今天更新的任务树，再交给大模型做轻量润色；若层级校验失败会回退基础稿。"
      : "仅提取今天有更新的任务树，并严格保留原父子层级。";
});
const weeklyReportFeedbackTone = computed(() => {
  const tone = String(ui.weekly.reportFeedbackTone ?? "").trim();
  return tone || "neutral";
});
const weeklyCanCopyReportOutput = computed(() => Boolean(String(weeklyReportOutputContent.value ?? "").trim()));
const weeklyNormalizedReportOutputContent = computed(() => normalizeMarkdownForClipboard(weeklyReportOutputContent.value));
const weeklyRenderedReportOutputHtml = computed(() => renderRichText(weeklyNormalizedReportOutputContent.value));
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
const activeWorkflowMetrics = computed(() => ({
  recordCount: activeWorkflowCard.value?.records?.length ?? 0,
  stepCount: activeWorkflowRecord.value?.steps?.length ?? 0,
  environmentCount: activeWorkflowEnvironments.value.length,
  variableCount: activeWorkflowRecord.value?.sharedVariables?.length ?? 0,
  timeoutMs: getWorkflowTimeoutMs(activeWorkflowRecord.value?.protocol)
}));

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

function formatDurationMs(value) {
  const duration = Number(value ?? 0);

  if (duration <= 0) {
    return "0s";
  }

  if (duration < 1000) {
    return `${duration}ms`;
  }

  if (duration < 60_000) {
    return `${Math.round(duration / 1000)}s`;
  }

  if (duration < 3_600_000) {
    const minutes = Math.floor(duration / 60_000);
    const seconds = Math.round((duration % 60_000) / 1000);
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(duration / 3_600_000);
  const minutes = Math.round((duration % 3_600_000) / 60_000);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getWorkflowTimeoutMs(protocol) {
  if (!protocol) {
    return 0;
  }

  return Math.max(Number(protocol.timeoutMs ?? 0), Number(protocol.initialWaitMs ?? 0) + Number(protocol.pollIntervalMs ?? 0) * Number(protocol.maxAttempts ?? 0));
}

function getWorkflowProtocolSummary(protocol) {
  if (!protocol) {
    return "暂无协议";
  }

  if (protocol.mode === "polling") {
    return `先等 ${formatDurationMs(protocol.initialWaitMs)}，再每 ${formatDurationMs(protocol.pollIntervalMs)} 轮询，最长 ${formatDurationMs(getWorkflowTimeoutMs(protocol))}`;
  }

  if (protocol.mode === "sequential") {
    return "按固定顺序串行执行";
  }

  return "单次同步调用";
}

function getWorkflowStepModeLabel(mode) {
  return mode === "polling" ? "轮询" : "单次";
}

function getWorkflowStepStatusLabel(status) {
  if (status === "success") {
    return "成功";
  }

  if (status === "cancelled") {
    return "已中断";
  }

  if (status === "failed") {
    return "失败";
  }

  if (status === "running") {
    return "执行中";
  }

  return "等待中";
}

function getWorkflowStepStatusTone(status) {
  if (status === "success") {
    return "is-success";
  }

  if (status === "cancelled") {
    return "is-cancelled";
  }

  if (status === "failed") {
    return "is-danger";
  }

  if (status === "running") {
    return "is-warning";
  }

  return "";
}

function getWorkflowRunCompletedCount(runResult) {
  return (runResult?.steps ?? []).filter((step) => ["success", "failed", "cancelled"].includes(step.status)).length;
}

function getWorkflowRunProgressPercent(runResult) {
  const steps = runResult?.steps ?? [];

  if (!steps.length) {
    return 0;
  }

  const total = steps.reduce((sum, step) => sum + getWorkflowStepProgressPercent(step), 0);
  return Math.round(total / steps.length);
}

function getWorkflowRunDurationLabel(runResult) {
  const startedAt = new Date(runResult?.startedAt ?? "").getTime();
  const finishedAt = runResult?.finishedAt ? new Date(runResult.finishedAt).getTime() : Date.now();

  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    return "--";
  }

  return formatDurationMs(finishedAt - startedAt);
}

function getWorkflowRunSummaryText(runResult) {
  const steps = runResult?.steps ?? [];

  if (!steps.length) {
    return "等待开始执行";
  }

  const cancelledStep = steps.find((step) => step.status === "cancelled");

  if (runResult?.status === "cancelled" || cancelledStep) {
    return cancelledStep ? `已中断 ${cancelledStep.name || "未命名步骤"}` : "执行已中断";
  }

  const failedStep = steps.find((step) => step.status === "failed");

  if (failedStep) {
    return `停在 ${failedStep.name || "未命名步骤"}`;
  }

  if (runResult?.status === "success") {
    return "全部请求已完成";
  }

  const runningStep = steps.find((step) => step.status === "running");

  if (runningStep) {
    return `正在执行 ${runningStep.name || "未命名步骤"}`;
  }

  const pendingCount = steps.filter((step) => step.status === "pending").length;
  return pendingCount ? `${pendingCount} 个步骤等待执行` : "正在汇总执行结果";
}

function getWorkflowStepProgressPercent(stepResult) {
  if (stepResult?.status === "success" || stepResult?.status === "failed" || stepResult?.status === "cancelled") {
    return 100;
  }

  if (stepResult?.status === "pending") {
    return 0;
  }

  const maxAttempts = Math.max(1, Number(stepResult?.maxAttempts ?? 1));
  const attempt = Math.max(0, Number(stepResult?.attempt ?? 0));
  return Math.max(8, Math.min(92, Math.round((attempt / maxAttempts) * 100)));
}

function getWorkflowStepOutput(stepResult) {
  const stdout = String(stepResult?.stdout ?? "").trim();
  const stderr = String(stepResult?.stderr ?? "").trim();
  const output = [
    stdout,
    stderr ? `stderr:\n${stderr}` : ""
  ].filter(Boolean).join("\n\n");

  if (output) {
    return output;
  }

  return stepResult?.status === "pending" ? "等待执行..." : "暂无输出";
}

function getWorkflowResponseBodyFromOutput(stdout) {
  const normalized = String(stdout ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (!/^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(normalized)) {
    return normalized;
  }

  const parts = normalized.split(/\r?\n\r?\n/).filter(Boolean);
  return parts.at(-1)?.trim() ?? normalized;
}

function parseWorkflowOutputJson(stdout) {
  const body = getWorkflowResponseBodyFromOutput(stdout);

  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    const objectStart = body.indexOf("{");
    const objectEnd = body.lastIndexOf("}");
    const arrayStart = body.indexOf("[");
    const arrayEnd = body.lastIndexOf("]");
    const objectCandidate = objectStart >= 0 && objectEnd > objectStart ? body.slice(objectStart, objectEnd + 1) : "";
    const arrayCandidate = arrayStart >= 0 && arrayEnd > arrayStart ? body.slice(arrayStart, arrayEnd + 1) : "";
    const candidate =
      objectCandidate && arrayCandidate
        ? objectStart < arrayStart
          ? objectCandidate
          : arrayCandidate
        : objectCandidate || arrayCandidate;

    if (!candidate) {
      return null;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function formatWorkflowVisualValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function collectWorkflowVisualRows(value, prefix = "response", rows = [], depth = 0) {
  if (rows.length >= 8) {
    return rows;
  }

  if (value === null || value === undefined || typeof value !== "object") {
    rows.push({ label: prefix, value: formatWorkflowVisualValue(value) });
    return rows;
  }

  if (Array.isArray(value)) {
    rows.push({ label: prefix, value: `Array(${value.length})` });
    value.slice(0, 3).forEach((entry, index) => collectWorkflowVisualRows(entry, `${prefix}.${index}`, rows, depth + 1));
    return rows;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    if (rows.length >= 8) {
      break;
    }

    const label = prefix === "response" ? key : `${prefix}.${key}`;
    const shouldDive = entryValue && typeof entryValue === "object" && depth < 2;

    if (shouldDive) {
      collectWorkflowVisualRows(entryValue, label, rows, depth + 1);
      continue;
    }

    rows.push({ label, value: formatWorkflowVisualValue(entryValue) });
  }

  return rows;
}

function getWorkflowStepVisualRows(stepResult) {
  const parsedJson = parseWorkflowOutputJson(stepResult?.stdout);

  if (parsedJson) {
    return collectWorkflowVisualRows(parsedJson).filter((row) => String(row.value ?? "").trim()).slice(0, 8);
  }

  const output = getWorkflowStepOutput(stepResult);

  if (!output || output === "等待执行..." || output === "暂无输出") {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((line, index) => ({ label: index === 0 ? "输出" : `输出 ${index + 1}`, value: line }));
}

function isWorkflowStepExpanded(stepId) {
  return ui.workflow.expandedStepIds.includes(stepId);
}

function toggleWorkflowStepExpanded(stepId) {
  if (isWorkflowStepExpanded(stepId)) {
    ui.workflow.expandedStepIds = ui.workflow.expandedStepIds.filter((id) => id !== stepId);
    return;
  }

  ui.workflow.expandedStepIds = [...ui.workflow.expandedStepIds, stepId];
}

function getWorkflowCardCountLabel(entry) {
  return `${entry?.records?.length ?? 0} 条记录`;
}

function createLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function parseNumberInput(value, fallback) {
  const numeric = Number(String(value ?? "").trim());
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function parseDelimitedValues(value) {
  return String(value ?? "")
    .split(/[,，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenizeWorkflowCurlCommand(command) {
  const source = String(command ?? "");
  const tokens = [];
  let current = "";
  let tokenStart = -1;
  let quote = null;
  let escaping = false;

  const ensureTokenStart = (index) => {
    if (tokenStart < 0) {
      tokenStart = index;
    }
  };
  const pushToken = (end) => {
    if (tokenStart < 0) {
      return;
    }

    tokens.push({
      value: current,
      start: tokenStart,
      end
    });
    current = "";
    tokenStart = -1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1] ?? "";

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      if (!quote && (nextChar === "\n" || nextChar === "\r")) {
        pushToken(index);

        if (nextChar === "\r" && source[index + 2] === "\n") {
          index += 2;
        } else {
          index += 1;
        }

        continue;
      }

      ensureTokenStart(index);
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }

      continue;
    }

    if (char === "'" || char === "\"") {
      ensureTokenStart(index);
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushToken(index);
      continue;
    }

    ensureTokenStart(index);
    current += char;
  }

  pushToken(source.length);
  return tokens.filter((token) => token.value || token.start < token.end);
}

function splitWorkflowCurlOptionValue(tokenValue) {
  const equalIndex = String(tokenValue ?? "").indexOf("=");

  if (equalIndex <= 0) {
    return null;
  }

  const option = tokenValue.slice(0, equalIndex);

  if (!WORKFLOW_CURL_BODY_OPTIONS.has(option)) {
    return null;
  }

  return {
    option,
    value: tokenValue.slice(equalIndex + 1)
  };
}

function findWorkflowCurlBodySegment(curl) {
  const tokens = tokenizeWorkflowCurlCommand(curl);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const inlineOption = splitWorkflowCurlOptionValue(token.value);

    if (inlineOption) {
      return {
        option: inlineOption.option,
        value: inlineOption.value,
        replaceStart: token.start,
        replaceEnd: token.end,
        inline: true
      };
    }

    if (!WORKFLOW_CURL_BODY_OPTIONS.has(token.value)) {
      continue;
    }

    const bodyToken = tokens[index + 1];

    if (!bodyToken) {
      return null;
    }

    return {
      option: token.value,
      value: bodyToken.value,
      replaceStart: bodyToken.start,
      replaceEnd: bodyToken.end,
      inline: false
    };
  }

  return null;
}

function quoteWorkflowCurlBody(value) {
  return `'${String(value ?? "").replace(/'/g, "'\\''")}'`;
}

function replaceWorkflowCurlBody(curl, bodyText) {
  const source = String(curl ?? "");
  const bodySegment = findWorkflowCurlBodySegment(source);

  if (!bodySegment) {
    return source;
  }

  const replacement = bodySegment.inline
    ? `${bodySegment.option}=${quoteWorkflowCurlBody(bodyText)}`
    : quoteWorkflowCurlBody(bodyText);

  return `${source.slice(0, bodySegment.replaceStart)}${replacement}${source.slice(bodySegment.replaceEnd)}`;
}

function normalizeWorkflowBodyDraftForCompare(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

function extractWorkflowBodyCandidate(value) {
  const raw = String(value ?? "").trim();
  const extracted = findWorkflowCurlBodySegment(raw);

  return extracted?.value ?? raw;
}

function stripWorkflowBodyShellWrapper(value) {
  let nextValue = String(value ?? "")
    .trim()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");

  while (nextValue.length > 1) {
    const firstChar = nextValue[0];
    const lastChar = nextValue.at(-1);

    if ((firstChar === "'" || firstChar === "\"") && lastChar === firstChar) {
      nextValue = nextValue.slice(1, -1).trim();
      continue;
    }

    if ((nextValue.startsWith("{") || nextValue.startsWith("[")) && (lastChar === "'" || lastChar === "\"")) {
      nextValue = nextValue.slice(0, -1).trim();
      continue;
    }

    if ((firstChar === "'" || firstChar === "\"") && (nextValue.endsWith("}") || nextValue.endsWith("]"))) {
      nextValue = nextValue.slice(1).trim();
      continue;
    }

    break;
  }

  return nextValue.replace(/;\s*$/, "").trim();
}

function removeWorkflowJsonTrailingCommas(value) {
  let nextValue = String(value ?? "");
  let previousValue = "";

  while (nextValue !== previousValue) {
    previousValue = nextValue;
    nextValue = nextValue.replace(/,\s*([}\]])/g, "$1");
  }

  return nextValue;
}

function quoteWorkflowJsonLooseKeys(value) {
  return String(value ?? "").replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)(\s*:)/g, '$1"$2"$3');
}

function normalizeWorkflowJsonSingleQuotedStrings(value) {
  return String(value ?? "").replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, innerValue) => {
    const normalized = String(innerValue ?? "")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, "\"");

    return JSON.stringify(normalized);
  });
}

function looksLikeWorkflowJsonBody(value) {
  const normalized = String(value ?? "").trim();
  return normalized.startsWith("{") || normalized.startsWith("[");
}

function repairWorkflowBodyText(value, { pretty = true } = {}) {
  const stripped = stripWorkflowBodyShellWrapper(extractWorkflowBodyCandidate(value));
  const withoutTrailingCommas = removeWorkflowJsonTrailingCommas(stripped);
  const withLooseKeys = quoteWorkflowJsonLooseKeys(withoutTrailingCommas);
  const candidates = Array.from(
    new Set([
      stripped,
      withoutTrailingCommas,
      withLooseKeys,
      normalizeWorkflowJsonSingleQuotedStrings(withoutTrailingCommas),
      normalizeWorkflowJsonSingleQuotedStrings(withLooseKeys)
    ])
  );

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = JSON.parse(candidate);

      return {
        ok: true,
        text: pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed),
        parsed
      };
    } catch {
      // Keep trying the next low-risk repair candidate.
    }
  }

  return {
    ok: false,
    text: stripped,
    error: looksLikeWorkflowJsonBody(stripped) ? "JSON 结构仍不完整，请检查引号、括号或逗号。" : "当前内容不像 JSON，将按原始文本处理。"
  };
}

function extractCurlMethod(curl) {
  const explicitMethod = curl.match(/(?:--request|-X)\s+['"]?([A-Z]+)['"]?/i)?.[1];

  if (explicitMethod) {
    return explicitMethod.toUpperCase();
  }

  return /(?:--data(?:-raw|-binary|-urlencode)?|--json)\b|-d(?:\s|=|$)/i.test(curl) ? "POST" : "GET";
}

function extractCurlUrl(curl) {
  const literalUrlMatch = String(curl ?? "").match(/(?:^|\s)(['"]?)(https?:\/\/[^'"\s\\]+)\1/i);

  if (literalUrlMatch?.[2]) {
    return literalUrlMatch[2];
  }

  const baseUrlPlaceholderMatch = String(curl ?? "").match(
    /(?:^|\s)(['"]?)(\$BASE_URL[^'"\s\\]*|\$\{BASE_URL\}[^'"\s\\]*|\{\{\s*BASE_URL\s*\}\}[^'"\s\\]*)\1/i
  );

  return baseUrlPlaceholderMatch?.[2] ?? "";
}

function extractCurlPlaceholders(curl) {
  const dollarPlaceholders = Array.from(String(curl ?? "").matchAll(/\$\{([A-Za-z0-9_]+)\}/g)).map((match) => match[1]);
  const bareDollarPlaceholders = Array.from(String(curl ?? "").matchAll(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g)).map(
    (match) => match[1]
  );
  const doubleBracePlaceholders = Array.from(String(curl ?? "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map(
    (match) => match[1]
  );
  return Array.from(new Set([...dollarPlaceholders, ...bareDollarPlaceholders, ...doubleBracePlaceholders]));
}

function extractCurlBearerToken(curl) {
  const token = String(curl ?? "").match(/Authorization:\s*Bearer\s+([^'"\s\\]+)/i)?.[1] ?? "";
  return token.includes("API_KEY") ? "" : token;
}

function normalizeCurlApiKeyPlaceholder(curl) {
  return String(curl ?? "").replace(/(Authorization:\s*Bearer\s+)([^'"\s\\]+)/gi, (match, prefix, token) =>
    String(token).includes("API_KEY") ? match : `${prefix}$API_KEY`
  );
}

function extractCurlLiteralOrigin(curl) {
  const url = extractCurlUrl(curl);

  if (!url || !/^https?:\/\//i.test(url)) {
    return "";
  }

  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function replaceCurlPrimaryOriginWithBasePlaceholder(curl, sourceOrigin) {
  const normalizedOrigin = String(sourceOrigin ?? "").replace(/\/+$/, "");
  const url = extractCurlUrl(curl);

  if (!normalizedOrigin || !url.startsWith(normalizedOrigin)) {
    return curl;
  }

  return String(curl ?? "").replace(url, url.replace(normalizedOrigin, "$BASE_URL"));
}

function extractFirstWorkflowBaseUrlFromSteps(steps) {
  return (
    (steps ?? [])
      .map((step) => extractCurlLiteralOrigin(step?.curl ?? step))
      .find(Boolean) ?? ""
  );
}

function normalizeWorkflowEnvironments(recordOrEnvironments, seedBaseUrl = "", seedApiKey = "") {
  const configured = Array.isArray(recordOrEnvironments)
    ? recordOrEnvironments
    : Array.isArray(recordOrEnvironments?.environments)
      ? recordOrEnvironments.environments
      : [];
  const legacyApiKey = !Array.isArray(recordOrEnvironments) ? String(recordOrEnvironments?.apiKey ?? seedApiKey ?? "").trim() : String(seedApiKey ?? "").trim();
  const configuredById = new Map(
    configured
      .map((environment, index) => ({
        id: String(environment?.id ?? WORKFLOW_DEFAULT_ENVIRONMENTS[index]?.id ?? `env_${index + 1}`).trim(),
        label: String(environment?.label ?? "").trim(),
        baseUrl: String(environment?.baseUrl ?? "").trim(),
        apiKey: String(environment?.apiKey ?? "").trim()
      }))
      .filter((environment) => environment.id)
      .map((environment) => [environment.id, environment])
  );
  const defaults = WORKFLOW_DEFAULT_ENVIRONMENTS.map((environment) => {
    const configuredEnvironment = configuredById.get(environment.id);

    return {
      ...environment,
      ...configuredEnvironment,
      label: configuredEnvironment?.label || environment.label,
      baseUrl: configuredEnvironment?.baseUrl || (environment.id === "prod" ? String(seedBaseUrl ?? "").trim() : ""),
      apiKey: configuredEnvironment?.apiKey || (environment.id === "prod" ? legacyApiKey : "")
    };
  });
  const custom = configured
    .map((environment, index) => ({
      id: String(environment?.id ?? `env_${index + 1}`).trim(),
      label: String(environment?.label ?? "").trim() || `ENV ${index + 1}`,
      baseUrl: String(environment?.baseUrl ?? "").trim(),
      apiKey: String(environment?.apiKey ?? "").trim()
    }))
    .filter((environment) => environment.id && !WORKFLOW_DEFAULT_ENVIRONMENTS.some((defaultEnvironment) => defaultEnvironment.id === environment.id));

  return [...defaults, ...custom];
}

function normalizeWorkflowJsonPathInput(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  const dataPathMatch = normalized.match(/(?:^|\n)\s*data\s*:\s*([^\n]+)/i);

  if (dataPathMatch?.[1]) {
    return dataPathMatch[1].trim();
  }

  return normalized;
}

function createWorkflowRecordDraftFromRecord(record) {
  const seedBaseUrl = extractFirstWorkflowBaseUrlFromSteps(record?.steps ?? []);

  return {
    name: record?.name ?? "",
    scenario: record?.scenario ?? record?.summary ?? "",
    mode: record?.protocol?.mode ?? "single",
    tagsText: (record?.tags ?? []).join(", "),
    pollIntervalMs: String(record?.protocol?.pollIntervalMs ?? 3000),
    maxAttempts: String(record?.protocol?.maxAttempts ?? 20),
    activeEnvironmentId: record?.activeEnvironmentId ?? "prod",
    apiKey: "",
    environments: normalizeWorkflowEnvironments(record, seedBaseUrl, record?.apiKey),
    steps: (record?.steps?.length ? record.steps : [createWorkflowStepDraft()]).map((step) =>
      createWorkflowStepDraft({
        id: step.id,
        name: step.name,
        curl: step.curl,
        waitBeforeMs: step.waitBeforeMs,
        executionMode: step.executionMode,
        pollIntervalMs: step.pollIntervalMs,
        maxAttempts: step.maxAttempts,
        completionPath: step.completionPath,
        successValues: step.successValues,
        failureValues: step.failureValues,
        produces: step.produces
      })
    ),
    notes: record?.notes ?? record?.protocol?.note ?? ""
  };
}

function buildWorkflowRecordFromDraft(draft, existingRecord = null) {
  const now = new Date().toISOString();
  const draftSteps = (Array.isArray(draft.steps) ? draft.steps : [])
    .map((step) => ({
      ...step,
      name: String(step?.name ?? "").trim(),
      curl: String(step?.curl ?? "").trim(),
      waitBeforeMs: step?.waitBeforeMs
    }))
    .filter((step) => step.curl);

  if (!String(draft.name ?? "").trim()) {
    throw new Error("请填写记录名称");
  }

  if (!draftSteps.length) {
    throw new Error("请至少添加一段 curl 请求");
  }

  const mode = ["single", "sequential", "polling"].includes(draft.mode) ? draft.mode : "single";
  const tags = String(draft.tagsText ?? "")
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const fallbackDetectedApiKey = String(draft.apiKey ?? "").trim() || draftSteps.map((step) => extractCurlBearerToken(step.curl)).find(Boolean) || "";
  const detectedBaseUrl = extractFirstWorkflowBaseUrlFromSteps(draftSteps);
  const environments = normalizeWorkflowEnvironments(draft.environments, detectedBaseUrl, fallbackDetectedApiKey);
  const activeEnvironmentId = environments.some((environment) => environment.id === draft.activeEnvironmentId)
    ? draft.activeEnvironmentId
    : environments.find((environment) => environment.id === "prod")?.id ?? environments[0]?.id ?? "prod";
  const activeEnvironmentApiKey = environments.find((environment) => environment.id === activeEnvironmentId)?.apiKey || fallbackDetectedApiKey;
  const sharedBindingsByKey = new Map();
  const priorProducerByName = new Map();

  function rememberWorkflowBinding(binding) {
    sharedBindingsByKey.set(`${binding.source}:${binding.name}`, binding);
  }

  const steps = draftSteps.map((draftStep, index) => {
    const existingStep = existingRecord?.steps?.find((step) => step.id === draftStep.id) ?? existingRecord?.steps?.[index] ?? null;
    const stepId = existingStep?.id ?? createLocalId("workflow_step");
    const executionMode = draftStep.executionMode === "polling" ? "polling" : "once";
    const pollIntervalMs = parseNumberInput(draftStep.pollIntervalMs, existingStep?.pollIntervalMs ?? 5000);
    const maxAttempts = Math.max(1, parseNumberInput(draftStep.maxAttempts, existingStep?.maxAttempts ?? 20));
    const completionPath = normalizeWorkflowJsonPathInput(draftStep.completionPath);
    const successValues = parseDelimitedValues(draftStep.successValuesText);
    const failureValues = parseDelimitedValues(draftStep.failureValuesText);
    const curlWithApiKeyPlaceholder = fallbackDetectedApiKey ? normalizeCurlApiKeyPlaceholder(draftStep.curl) : draftStep.curl;
    const curl = detectedBaseUrl ? replaceCurlPrimaryOriginWithBasePlaceholder(curlWithApiKeyPlaceholder, detectedBaseUrl) : curlWithApiKeyPlaceholder;
    const placeholders = extractCurlPlaceholders(curl);
    const consumes = placeholders.map((name) => {
      const producer = priorProducerByName.get(name);
      const binding = {
        name,
        source: producer ? "response" : "manual",
        placeholder: `$${name}`,
        summary: producer ? "来自前置步骤响应提取" : "curl 占位变量",
        required: true,
        ...(producer ? { sourceStepId: producer.sourceStepId, path: producer.path } : {})
      };

      rememberWorkflowBinding(binding);
      return binding;
    });
    const produces = (Array.isArray(draftStep.produces) ? draftStep.produces : [])
      .map((output) => ({
        name: String(output?.name ?? "").trim(),
        path: normalizeWorkflowJsonPathInput(output?.path)
      }))
      .filter((output) => output.name && output.path)
      .map((output) => ({
        name: output.name,
        source: "response",
        placeholder: `$${output.name}`,
        summary: "从响应 JSONPath 提取",
        required: true,
        sourceStepId: stepId,
        path: output.path
      }));

    produces.forEach((binding) => {
      rememberWorkflowBinding(binding);
      priorProducerByName.set(binding.name, binding);
    });

    return {
      id: stepId,
      name: draftStep.name || existingStep?.name || (draftSteps.length > 1 ? `请求 ${index + 1}` : "请求"),
      summary: existingStep?.summary ?? "",
      method: extractCurlMethod(curl),
      url: extractCurlUrl(curl),
      curl,
      waitBeforeMs: parseNumberInput(draftStep.waitBeforeMs, existingStep?.waitBeforeMs ?? 0),
      executionMode,
      pollIntervalMs: executionMode === "polling" ? pollIntervalMs : 0,
      maxAttempts: executionMode === "polling" ? maxAttempts : 1,
      completionPath: executionMode === "polling" ? completionPath : "",
      successValues: executionMode === "polling" ? successValues : [],
      failureValues: executionMode === "polling" ? failureValues : [],
      responseFieldHints: existingStep?.responseFieldHints ?? [],
      consumes,
      produces
    };
  });
  const derivedMode = steps.some((step) => step.executionMode === "polling") ? "polling" : steps.length > 1 ? "sequential" : "single";
  const derivedTimeoutMs = steps.reduce(
    (total, step) =>
      total +
      Number(step.waitBeforeMs ?? 0) +
      (step.executionMode === "polling"
        ? Number(step.pollIntervalMs ?? 0) * Math.max(1, Number(step.maxAttempts ?? 1))
        : 120_000),
    0
  );
  const firstPollingStep = steps.find((step) => step.executionMode === "polling");

  return {
    id: existingRecord?.id ?? createLocalId("workflow_record"),
    name: String(draft.name ?? "").trim(),
    summary: String(draft.scenario ?? "").trim() || "curl 接口测试流程",
    scenario: String(draft.scenario ?? "").trim() || "curl 接口测试",
    tags,
    updatedAt: now,
    notes: String(draft.notes ?? "").trim(),
    activeEnvironmentId,
    environments,
    apiKey: activeEnvironmentApiKey,
    sharedVariables: Array.from(sharedBindingsByKey.values()),
    steps,
    protocol: {
      mode: derivedMode || mode,
      initialWaitMs: 0,
      pollIntervalMs: firstPollingStep?.pollIntervalMs ?? 0,
      maxAttempts: firstPollingStep?.maxAttempts ?? 1,
      timeoutMs: derivedTimeoutMs,
      statusStepId: firstPollingStep?.id,
      resultStepId: steps.at(-1)?.id,
      completionPath: firstPollingStep?.completionPath ?? "",
      successValues: firstPollingStep?.successValues ?? [],
      resultPath: "",
      note: String(draft.notes ?? "").trim()
    }
  };
}

function addWorkflowDraftStep() {
  ui.workflow.recordDraft.steps = [...(ui.workflow.recordDraft.steps ?? []), createWorkflowStepDraft()];
}

function removeWorkflowDraftStep(stepId) {
  const nextSteps = (ui.workflow.recordDraft.steps ?? []).filter((step) => step.id !== stepId);
  ui.workflow.recordDraft.steps = nextSteps.length ? nextSteps : [createWorkflowStepDraft()];
}

function addWorkflowStepOutput(step) {
  step.produces = [...(step.produces ?? []), createWorkflowOutputDraft()];
}

function removeWorkflowStepOutput(step, outputId) {
  step.produces = (step.produces ?? []).filter((output) => output.id !== outputId);
}

function addWorkflowDraftEnvironment() {
  const nextIndex = (ui.workflow.recordDraft.environments ?? []).length + 1;
  ui.workflow.recordDraft.environments = [
    ...(ui.workflow.recordDraft.environments ?? []),
    {
      id: createLocalId("env"),
      label: `ENV ${nextIndex}`,
      baseUrl: "",
      apiKey: ""
    }
  ];
}

function removeWorkflowDraftEnvironment(environmentId) {
  const nextEnvironments = (ui.workflow.recordDraft.environments ?? []).filter((environment) => environment.id !== environmentId);
  ui.workflow.recordDraft.environments = nextEnvironments.length ? nextEnvironments : createDefaultWorkflowEnvironments();

  if (!ui.workflow.recordDraft.environments.some((environment) => environment.id === ui.workflow.recordDraft.activeEnvironmentId)) {
    ui.workflow.recordDraft.activeEnvironmentId = ui.workflow.recordDraft.environments[0]?.id ?? "prod";
  }
}

function getWorkflowRuntimeMissingFields(record) {
  const curlText = (record?.steps ?? []).map((step) => step.curl ?? "").join("\n");
  const environments = normalizeWorkflowEnvironments(record);
  const activeEnvironment =
    environments.find((environment) => environment.id === record?.activeEnvironmentId) ??
    environments.find((environment) => environment.id === "prod") ??
    environments[0] ??
    null;
  const missing = [];

  if (/\$BASE_URL\b|\$\{BASE_URL\}|\{\{\s*BASE_URL\s*\}\}/.test(curlText) && !String(activeEnvironment?.baseUrl ?? "").trim()) {
    missing.push("当前环境的 Base URL");
  }

  if (
    /\$API_KEY\b|\$\{API_KEY\}|\{\{\s*API_KEY\s*\}\}/.test(curlText) &&
    !String(activeEnvironment?.apiKey ?? record?.apiKey ?? "").trim()
  ) {
    missing.push("当前环境的 APIKEY");
  }

  return missing;
}

function buildWorkflowInitialRunResult(record, progressEventId) {
  const startedAt = new Date().toISOString();

  return {
    progressEventId,
    status: "running",
    startedAt,
    variables: {},
    steps: (record?.steps ?? []).map((step) => {
      const mode = step?.executionMode === "polling" ? "polling" : "once";

      return {
        stepId: step?.id ?? "",
        name: step?.name ?? "",
        mode,
        status: "pending",
        exitCode: null,
        stdout: "",
        stderr: "",
        attempt: 0,
        maxAttempts: mode === "polling" ? Math.max(1, Number(step?.maxAttempts ?? 1)) : 1,
        attempts: []
      };
    })
  };
}

function handleWorkflowRunProgress(payload) {
  if (!payload?.progressEventId || payload.progressEventId !== ui.workflow.activeProgressEventId) {
    return;
  }

  ui.workflow.runResult = toPlainIpcData(payload);

  if (["success", "failed", "cancelled"].includes(payload.status)) {
    ui.workflow.isCancelling = false;
  }
}

function setWorkflowBodyFeedback(text, tone = "neutral") {
  ui.workflow.bodyFeedbackText = String(text ?? "").trim();
  ui.workflow.bodyFeedbackTone = tone;
}

function syncWorkflowBodyDraftFromActiveStep({ force = false } = {}) {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!activeBodyStep) {
    ui.workflow.bodyStepId = null;
    ui.workflow.bodyDraftText = "";
    setWorkflowBodyFeedback("", "neutral");
    return;
  }

  if (!ui.workflow.bodyStepId || !activeWorkflowBodyStepOptions.value.some((entry) => entry.id === ui.workflow.bodyStepId)) {
    ui.workflow.bodyStepId = activeBodyStep.id;
  }

  if (!force && workflowBodyDraftChanged.value) {
    return;
  }

  ui.workflow.bodyDraftText = activeBodyStep.body;
  setWorkflowBodyFeedback("已读取模板里的请求 Body。", "neutral");
}

function handleWorkflowBodyStepSelect() {
  syncWorkflowBodyDraftFromActiveStep({ force: true });
}

function handleWorkflowBodyDraftInput() {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!activeBodyStep) {
    setWorkflowBodyFeedback("", "neutral");
    return;
  }

  setWorkflowBodyFeedback(
    workflowBodyDraftChanged.value ? "本次执行将使用当前 Body，不会自动写回模板。" : "当前 Body 与模板一致。",
    workflowBodyDraftChanged.value ? "warning" : "success"
  );
}

function repairWorkflowBodyDraft() {
  const result = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: true });
  ui.workflow.bodyDraftText = result.text;

  if (result.ok) {
    setWorkflowBodyFeedback("已修复并格式化为标准 JSON。", "success");
    return;
  }

  setWorkflowBodyFeedback(result.error, looksLikeWorkflowJsonBody(result.text) ? "warning" : "neutral");
}

function getWorkflowBodyTextForRun() {
  const result = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: false });

  if (!result.ok && looksLikeWorkflowJsonBody(result.text)) {
    throw new Error(result.error);
  }

  return result.text;
}

function applyWorkflowBodyDraftToRecord(record) {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!record || !activeBodyStep || !workflowBodyDraftChanged.value) {
    return record;
  }

  const bodyText = getWorkflowBodyTextForRun();

  return {
    ...record,
    steps: (record.steps ?? []).map((step) => {
      if (step.id !== activeBodyStep.id) {
        return step;
      }

      const curl = replaceWorkflowCurlBody(step.curl, bodyText);

      return {
        ...step,
        method: extractCurlMethod(curl),
        url: extractCurlUrl(curl),
        curl
      };
    })
  };
}

function buildWorkflowRunRecord(record, progressEventId = "") {
  const runtimeRecord = applyWorkflowBodyDraftToRecord(record);
  const activeEnvironmentApiKey = String(activeWorkflowEnvironment.value?.apiKey ?? record?.apiKey ?? "").trim();

  return toPlainIpcData({
    ...runtimeRecord,
    progressEventId,
    activeEnvironmentId: activeWorkflowEnvironment.value?.id ?? record?.activeEnvironmentId,
    environments: activeWorkflowEnvironments.value,
    apiKey: activeEnvironmentApiKey
  });
}

async function persistActiveWorkflowRuntimeConfig(showStatus = false) {
  const card = activeWorkflowCard.value;
  const record = activeWorkflowRecord.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record) {
    return;
  }

  const now = new Date().toISOString();
  record.updatedAt = now;

  const nextCard = {
    ...card,
    updatedAt: now,
    records: (card.records ?? []).map((entry) => (entry.id === record.id ? { ...record } : entry))
  };

  try {
    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = record.id;

    if (showStatus) {
      setStatus("已保存工作流运行配置。", "success");
    }
  } catch (error) {
    console.error("Failed to persist workflow runtime config", error);
    setStatus(`保存运行配置失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function persistWorkflowBodyDraftToTemplate() {
  const card = activeWorkflowCard.value;
  const record = activeWorkflowRecord.value;
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record || !activeBodyStep) {
    setStatus("工作流仓储未就绪，暂时无法写回 Body。", "danger");
    return;
  }

  const repairedBody = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: true });

  if (!repairedBody.ok && looksLikeWorkflowJsonBody(repairedBody.text)) {
    const message = repairedBody.error || "请求 Body 格式不正确";
    setWorkflowBodyFeedback(message, "warning");
    setStatus(message, "warning");
    return;
  }

  const now = new Date().toISOString();
  const nextRecord = {
    ...record,
    updatedAt: now,
    steps: (record.steps ?? []).map((step) => {
      if (step.id !== activeBodyStep.id) {
        return step;
      }

      const curl = replaceWorkflowCurlBody(step.curl, repairedBody.text);

      return {
        ...step,
        method: extractCurlMethod(curl),
        url: extractCurlUrl(curl),
        curl
      };
    })
  };
  const nextCard = {
    ...card,
    updatedAt: now,
    lastUsedAt: now,
    records: (card.records ?? []).map((entry) => (entry.id === record.id ? nextRecord : entry))
  };

  try {
    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = nextRecord.id;
    ui.workflow.bodyDraftText = repairedBody.text;
    setWorkflowBodyFeedback("已写回模板 curl。", "success");
    setStatus("已写回请求 Body 模板。", "success");
  } catch (error) {
    console.error("Failed to persist workflow body draft", error);
    setStatus(`写回请求 Body 失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function handleWorkflowApiKeyInput(event) {
  if (!activeWorkflowRecord.value || !(event.target instanceof HTMLInputElement)) {
    return;
  }

  const nextApiKey = event.target.value;
  const environments = normalizeWorkflowEnvironments(activeWorkflowRecord.value);
  const activeEnvironmentId =
    activeWorkflowEnvironment.value?.id ??
    activeWorkflowRecord.value.activeEnvironmentId ??
    environments.find((environment) => environment.id === "prod")?.id ??
    environments[0]?.id;

  activeWorkflowRecord.value.environments = environments.map((environment) =>
    environment.id === activeEnvironmentId ? { ...environment, apiKey: nextApiKey } : environment
  );

  if (activeEnvironmentId) {
    activeWorkflowRecord.value.activeEnvironmentId = activeEnvironmentId;
    activeWorkflowRecord.value.apiKey = nextApiKey;
  }
}

async function selectWorkflowEnvironment(environmentId) {
  if (!activeWorkflowRecord.value || activeWorkflowRecord.value.activeEnvironmentId === environmentId) {
    return;
  }

  activeWorkflowRecord.value.activeEnvironmentId = environmentId;
  activeWorkflowRecord.value.apiKey =
    normalizeWorkflowEnvironments(activeWorkflowRecord.value).find((environment) => environment.id === environmentId)?.apiKey ??
    activeWorkflowRecord.value.apiKey ??
    "";
  await persistActiveWorkflowRuntimeConfig();
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

function setWeeklyReportOutputMode(mode) {
  ui.weekly.reportOutputMode = mode === "edit" ? "edit" : "preview";
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

function getDailyReportHeadingTitle(referenceDate = new Date()) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}/${month}/${day} 日报`;
}

function filterWeeklyTasksToUpdatedBranches(tasks = [], todayKey = getLocalDateKey(new Date())) {
  const filtered = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const children = getWeeklyTaskChildren(task);
    const filteredChildren = filterWeeklyTasksToUpdatedBranches(children, todayKey);
    const title = String(task?.title ?? "").trim();
    const isUpdatedLeaf = !children.length && Boolean(title) && getLocalDateKey(task?.updatedAt) === todayKey;

    if (!isUpdatedLeaf && !filteredChildren.length) {
      continue;
    }

    filtered.push({
      ...task,
      title,
      detail: String(task?.detail ?? "").trim(),
      children: filteredChildren
    });
  }

  return filtered;
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

function serializeDailyReportTaskLines(tasks = [], depth = 1, todayKey = getLocalDateKey(new Date())) {
  const lines = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const indent = "    ".repeat(depth);
    const statusLabel = getWeeklyProgressStatusMeta(task?.status).label;
    const title = String(task?.title ?? "").trim() || "未命名任务";

    lines.push(`${indent}* ${title}（${statusLabel}）`);

    const children = getWeeklyTaskChildren(task);

    if (children.length) {
      lines.push(...serializeDailyReportTaskLines(children, depth + 1, todayKey));
    }
  }

  return lines;
}

function buildDailyReportMarkdown(record, referenceDate = new Date()) {
  const todayKey = getLocalDateKey(referenceDate);
  const entries = collectTodayUpdatedLeafTasks(record?.projects ?? [], referenceDate);

  if (!entries.length) {
    return {
      entries,
      markdown: ""
    };
  }

  const lines = [];

  for (const project of Array.isArray(record?.projects) ? record.projects : []) {
    const projectTitle = String(project?.title ?? "").trim() || "未命名项目";
    const filteredTasks = filterWeeklyTasksToUpdatedBranches(project?.tasks ?? [], todayKey);

    if (!filteredTasks.length) {
      continue;
    }

    lines.push(`* ${projectTitle}`);
    lines.push(...serializeDailyReportTaskLines(filteredTasks, 1, todayKey));
    lines.push("");
  }

  return {
    entries,
    markdown: lines.join("\n").trim()
  };
}

function extractMarkdownListDepthSignature(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => getMarkdownListLineMeta(line))
    .filter(Boolean)
    .map((meta) => Math.round((meta?.nestingIndent ?? 0) / 4))
    .join(",");
}

function hasMatchingMarkdownHierarchy(sourceMarkdown, candidateMarkdown) {
  return extractMarkdownListDepthSignature(sourceMarkdown) === extractMarkdownListDepthSignature(candidateMarkdown);
}

function buildDailyReportSourceContent(record) {
  const entries = collectTodayUpdatedLeafTasks(record?.projects ?? []);

  if (!entries.length) {
    return {
      entries,
      content: ""
    };
  }

  const todayKey = getLocalDateKey(new Date());
  const lines = [];

  for (const project of Array.isArray(record?.projects) ? record.projects : []) {
    const projectTitle = String(project?.title ?? "").trim() || "未命名项目";
    const filteredTasks = filterWeeklyTasksToUpdatedBranches(project?.tasks ?? [], todayKey);

    if (!filteredTasks.length) {
      continue;
    }

    lines.push(`* ${projectTitle}`);

    if (String(project?.note ?? "").trim()) {
      lines.push(...String(project.note).split("\n").map((line) => `    * 项目备注：${line.trim()}`));
    }

    lines.push(...serializeDailyReportTaskLines(filteredTasks, 1, todayKey));
    lines.push("");
  }

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
  ui.weekly.reportOutputMode = "preview";
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
  syncModelBalanceRuntimeFromProfiles(modelSettings?.profiles ?? []);
  workbench.weeklyProgress = [...(snapshot?.weeklyProgress ?? [])];
  workbench.workflowLibrary = [...(snapshot?.workflowLibrary ?? [])];
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
    ui.extensions.view = "list";
    ui.extensions.editor = createExtensionEditorState("agent");
    ui.extensions.runner = createAgentRunnerState();
  }
}

function handleFeatureSelect(featureId) {
  setActiveFeature(featureId);
}

function syncWorkflowSelection() {
  if (!workbench.workflowLibrary.length) {
    ui.workflow.activeCardId = null;
    ui.workflow.activeRecordId = null;
    ui.workflow.copiedStepId = null;
    ui.workflow.expandedStepIds = [];
    return;
  }

  const nextCard =
    workbench.workflowLibrary.find((entry) => entry.id === ui.workflow.activeCardId) ?? workbench.workflowLibrary[0];
  ui.workflow.activeCardId = nextCard?.id ?? null;

  const nextRecord = nextCard?.records?.find((record) => record.id === ui.workflow.activeRecordId) ?? nextCard?.records?.[0] ?? null;
  ui.workflow.activeRecordId = nextRecord?.id ?? null;
  ui.workflow.copiedStepId = null;
  ui.workflow.expandedStepIds = [];
}

function openWorkflowCard(cardId) {
  activeFeature.value = FEATURE_WORKFLOW_LIBRARY;
  ui.workflow.view = "list";
  ui.workflow.activeCardId = cardId;
  const card = workbench.workflowLibrary.find((entry) => entry.id === cardId);
  ui.workflow.activeRecordId = card?.records?.[0]?.id ?? null;
  ui.workflow.copiedStepId = null;
  ui.workflow.searchQuery = "";
  ui.workflow.runResult = null;
  ui.workflow.expandedStepIds = [];
}

function handleWorkflowBack() {
  if (ui.workflow.view === "run" || ui.workflow.view === "editor") {
    ui.workflow.view = "list";
    ui.workflow.editingRecordId = null;
    ui.workflow.recordDraft = createWorkflowRecordDraft();
    return;
  }

  backToWorkflowLibrary();
}

function backToWorkflowLibrary() {
  ui.workflow.view = "library";
  ui.workflow.editingRecordId = null;
  ui.workflow.runResult = null;
  syncWorkflowSelection();
}

function openWorkflowRecord(recordId) {
  ui.workflow.activeRecordId = recordId;
  ui.workflow.copiedStepId = null;
  ui.workflow.apiKeyVisible = false;
  ui.workflow.runResult = null;
  ui.workflow.expandedStepIds = [];
  ui.workflow.view = "run";
}

function openWorkflowRecordEditor(record = null) {
  ui.workflow.editingRecordId = record?.id ?? null;
  ui.workflow.recordDraft = record ? createWorkflowRecordDraftFromRecord(record) : createWorkflowRecordDraft();
  ui.workflow.apiKeyVisible = false;
  ui.workflow.view = "editor";
}

async function saveWorkflowRecord() {
  const card = activeWorkflowCard.value;

  if (ui.workflow.isSavingRecord) {
    return;
  }

  if (!desktopApi?.upsertWorkflowLibraryItem || !card) {
    setStatus("工作流仓储未就绪，暂时无法保存 curl。", "danger");
    return;
  }

  try {
    ui.workflow.isSavingRecord = true;
    setStatus("正在保存工作流配置...", "neutral");
    const existingRecord = card.records?.find((record) => record.id === ui.workflow.editingRecordId) ?? null;
    const nextRecord = buildWorkflowRecordFromDraft(ui.workflow.recordDraft, existingRecord);
    const nextRecords = existingRecord
      ? (card.records ?? []).map((record) => (record.id === existingRecord.id ? nextRecord : record))
      : [nextRecord, ...(card.records ?? [])];
    const nextCard = {
      ...card,
      usageCount: Number(card.usageCount ?? 0) + (existingRecord ? 0 : 1),
      updatedAt: nextRecord.updatedAt,
      lastUsedAt: nextRecord.updatedAt,
      records: nextRecords
    };

    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = nextRecord.id;
    ui.workflow.copiedStepId = null;
    ui.workflow.editingRecordId = null;
    ui.workflow.recordDraft = createWorkflowRecordDraft();
    ui.workflow.view = "run";
    setStatus(`已保存「${nextRecord.name}」工作流。`, "success");
  } catch (error) {
    console.error("Failed to save workflow record", error);
    const message = error instanceof Error ? error.message : "未知错误";
    setStatus(`保存工作流失败：${message}`, "danger");
    void showAlertDialog({
      tone: "danger",
      title: "保存工作流失败",
      message,
      confirmText: "知道了"
    });
  } finally {
    ui.workflow.isSavingRecord = false;
  }
}

function createWorkflowDuplicateRecordName(name, records = []) {
  const baseName = String(name ?? "").trim() || "未命名工作流";
  const copyBaseName = `${baseName.replace(/\s+副本(?:\s+\d+)?$/, "").trim() || baseName} 副本`;
  const existingNames = new Set((records ?? []).map((record) => String(record?.name ?? "").trim()));

  if (!existingNames.has(copyBaseName)) {
    return copyBaseName;
  }

  let copyIndex = 2;
  let nextName = `${copyBaseName} ${copyIndex}`;

  while (existingNames.has(nextName)) {
    copyIndex += 1;
    nextName = `${copyBaseName} ${copyIndex}`;
  }

  return nextName;
}

async function duplicateWorkflowRecord(record) {
  const card = activeWorkflowCard.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record) {
    setStatus("工作流仓储未就绪，暂时无法复制。", "danger");
    return;
  }

  try {
    const now = new Date().toISOString();
    const draft = createWorkflowRecordDraftFromRecord(record);
    draft.name = createWorkflowDuplicateRecordName(record.name, card.records ?? []);

    const nextRecord = buildWorkflowRecordFromDraft(draft);
    const nextCard = {
      ...card,
      usageCount: Number(card.usageCount ?? 0) + 1,
      updatedAt: now,
      lastUsedAt: now,
      records: [nextRecord, ...(card.records ?? [])]
    };

    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = nextRecord.id;
    ui.workflow.runResult = null;
    setStatus(`已复制「${record.name}」。`, "success");
  } catch (error) {
    console.error("Failed to duplicate workflow record", error);
    setStatus(`复制工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function deleteWorkflowRecord(recordId) {
  const card = activeWorkflowCard.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card) {
    setStatus("工作流仓储未就绪，暂时无法删除。", "danger");
    return;
  }

  const record = card.records?.find((entry) => entry.id === recordId) ?? null;
  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除工作流记录",
    message: `确认删除「${record?.name ?? "当前记录"}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  const nextCard = {
    ...card,
    updatedAt: new Date().toISOString(),
    records: (card.records ?? []).filter((record) => record.id !== recordId)
  };

  try {
    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeRecordId = nextCard.records[0]?.id ?? null;
    ui.workflow.runResult = null;
    setStatus("已删除工作流。", "success");
  } catch (error) {
    console.error("Failed to delete workflow record", error);
    setStatus(`删除工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function runActiveWorkflowRecord() {
  if (ui.workflow.isRunning) {
    await cancelActiveWorkflowRun();
    return;
  }

  if (!desktopApi?.runWorkflowRecord || !activeWorkflowRecord.value) {
    setStatus("工作流执行桥接未就绪。", "danger");
    return;
  }

  const missingFields = getWorkflowRuntimeMissingFields(activeWorkflowRecord.value);

  if (missingFields.length) {
    setStatus(`请先补齐：${missingFields.join("、")}。`, "warning");
    void showAlertDialog({
      tone: "warning",
      title: "运行配置不完整",
      message: `当前工作流需要 ${missingFields.join("、")}，补齐后再执行。`,
      confirmText: "知道了"
    });
    return;
  }

  try {
    const progressEventId = createLocalId("workflow_progress");
    const runRecord = buildWorkflowRunRecord(activeWorkflowRecord.value, progressEventId);

    ui.workflow.isRunning = true;
    ui.workflow.isCancelling = false;
    ui.workflow.activeProgressEventId = progressEventId;
    ui.workflow.runResult = buildWorkflowInitialRunResult(runRecord, progressEventId);
    setStatus("工作流正在执行。", "neutral");

    const result = await desktopApi.runWorkflowRecord(runRecord);
    ui.workflow.runResult = result;
    const cancelled = result?.status === "cancelled";

    if (cancelled) {
      setStatus("工作流已中断。", "warning");
      return;
    }

    const succeeded = result?.status === "success";
    setStatus(succeeded ? "工作流执行成功。" : "工作流执行失败，请查看输出。", succeeded ? "success" : "danger");

    if (!succeeded) {
      void showAlertDialog({
        tone: "danger",
        title: "工作流执行失败",
        message: "当前工作流没有完整执行成功，请查看输出区里的步骤状态、stderr 或 exit code。",
        confirmText: "知道了"
      });
    }
  } catch (error) {
    console.error("Failed to run workflow record", error);
    setStatus(`执行工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    void showAlertDialog({
      tone: "danger",
      title: "工作流执行异常",
      message: error instanceof Error ? error.message : "未知错误",
      confirmText: "知道了"
    });
  } finally {
    ui.workflow.isRunning = false;
    ui.workflow.isCancelling = false;
    ui.workflow.activeProgressEventId = null;
  }
}

async function cancelActiveWorkflowRun() {
  if (!ui.workflow.isRunning || !ui.workflow.activeProgressEventId) {
    return;
  }

  if (!desktopApi?.cancelWorkflowRecordRun) {
    setStatus("工作流中断桥接未就绪。", "danger");
    return;
  }

  try {
    ui.workflow.isCancelling = true;
    setStatus("正在中断工作流。", "warning");

    const result = await desktopApi.cancelWorkflowRecordRun(ui.workflow.activeProgressEventId);

    if (!result?.cancelled) {
      ui.workflow.isCancelling = false;
      setStatus("当前没有找到可中断的工作流执行。", "warning");
    }
  } catch (error) {
    console.error("Failed to cancel workflow record run", error);
    ui.workflow.isCancelling = false;
    setStatus(`中断工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleWorkflowCurlCopy(step) {
  try {
    await copyTextToClipboard(step?.curl ?? "");
    ui.workflow.copiedStepId = step?.id ?? null;
    setStatus(`已复制「${step?.name ?? "当前步骤"}」的 curl。`, "success");
  } catch (error) {
    console.error("Failed to copy workflow curl", error);
    setStatus(`复制 curl 失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
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

function fillModelBalanceQueryTemplate() {
  ui.modelManagement.editor.values.balanceQueryCode = MODEL_BALANCE_QUERY_TEMPLATE;
  ui.modelManagement.editor.balanceQueryError = "";
  ui.modelManagement.editor.balanceQueryResult = null;
  ui.modelManagement.editor.lastBalanceQueryCode = "";
}

async function handleModelEditorBalanceQuery() {
  if (!desktopApi?.queryModelBalance) {
    setStatus("桌面桥接未就绪，暂无法执行余额查询。", "danger");
    return;
  }

  const payload = buildModelEditorPayload();

  if (!payload.apiKey) {
    setStatus("请先填写 API Key，再执行余额查询。", "warning");
    return;
  }

  if (!payload.balanceQueryCode) {
    setStatus("请先填写余额查询提取器代码。", "warning");
    return;
  }

  ui.modelManagement.editor.isBalanceQuerying = true;
  ui.modelManagement.editor.balanceQueryError = "";

  try {
    const balanceSnapshot = await desktopApi.queryModelBalance({
      profile: payload,
      persistResult: false
    });
    ui.modelManagement.editor.balanceQueryResult = balanceSnapshot;
    ui.modelManagement.editor.lastBalanceQueryCode = payload.balanceQueryCode;
    setStatus("余额查询成功。", "success");
  } catch (error) {
    console.error("Failed to query model balance in editor", error);
    ui.modelManagement.editor.balanceQueryError = error instanceof Error ? error.message : "未知错误";
    setStatus(`余额查询失败：${ui.modelManagement.editor.balanceQueryError}`, "danger");
  } finally {
    ui.modelManagement.editor.isBalanceQuerying = false;
  }
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

  const payload = buildModelEditorPayload();

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

async function handleModelBalanceRefresh(profile) {
  if (!desktopApi?.queryModelBalance) {
    setModelBalanceFeedback(profile?.id, "桥接未就绪，列表按钮未拿到查询能力。", "danger");
    setStatus("桌面桥接未就绪，暂无法执行余额查询。", "danger");
    return;
  }

  if (!hasModelBalanceQuery(profile)) {
    setModelBalanceFeedback(profile?.id, "当前模型没有配置余额查询代码。", "warning");
    setStatus("当前模型还没有配置余额查询提取器代码。", "warning");
    return;
  }

  const profilePayload = toPlainModelProfile(profile);
  setModelBalanceFeedback(profile.id, "已点击，准备发起余额查询...", "neutral");
  setStatus(`正在刷新 ${profile.displayName} 的余额...`, "neutral");
  setModelBalanceRefreshing(profile.id, true);
  await nextTick();

  try {
    setModelBalanceFeedback(profile.id, "请求已发出，等待接口返回...", "neutral");
    const balanceSnapshot = await desktopApi.queryModelBalance({
      profile: profilePayload,
      persistResult: true
    });
    applyModelBalanceSnapshot(profile.id, balanceSnapshot);
    setModelBalanceFeedback(profile.id, "余额刷新成功。", "success");
    setStatus(`已刷新 ${profile.displayName} 的余额。`, "success");
  } catch (error) {
    console.error("Failed to refresh model balance", error);
    setModelBalanceFeedback(profile.id, error instanceof Error ? error.message : "余额刷新失败。", "danger");
    setStatus(`余额刷新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    setModelBalanceRefreshing(profile.id, false);
  }

  try {
    await refreshWorkbenchSnapshot();
  } catch (error) {
    console.error("Failed to sync refreshed model balance snapshot", error);
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

  if (!profile) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除模型配置",
    message: `确认删除「${profile.displayName}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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
  ui.weekly.reportOutputMode = "preview";
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

async function addWeeklyReportTemplate() {
  if (!ui.weekly.draft) {
    return;
  }

  const baseTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);
  const defaultName = getNextWeeklyReportTemplateName(ui.weekly.draft);
  const nextName = await showInputDialog({
    title: "新增周报模板",
    message: "输入模板名称后会基于当前模板复制一份新模板。",
    inputLabel: "模板名称",
    inputValue: defaultName,
    inputPlaceholder: "例如：项目周报",
    confirmText: "新增",
    cancelText: "取消"
  });

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

async function removeWeeklySelectedReportTemplate() {
  if (!ui.weekly.draft || !weeklyCanDeleteSelectedReportTemplate.value) {
    return;
  }

  const selectedTemplate = getWeeklySelectedReportTemplate(ui.weekly.draft);

  if (!selectedTemplate || selectedTemplate.builtin) {
    return;
  }

  const templateName = String(selectedTemplate.name ?? "").trim() || "未命名模板";
  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除周报模板",
    message: `确认删除模板「${templateName}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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
      setStatus("任务笔记内容已保存。", "success");
    } else {
      setStatus("任务笔记已自动保存。", "success");
    }
  } catch (error) {
    console.error("Failed to save weekly progress", error);
    setStatus(`任务笔记保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
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

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除周记录",
    message: "确认删除这条周记录吗？删除后无法恢复。",
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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
  if (!ui.weekly.draft || !activeWeeklyRecord.value) {
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
    const { entries, markdown } = buildDailyReportMarkdown(sanitizedDraft);

    if (!entries.length || !markdown) {
      setWeeklyReportFeedback(`今天（${getDailyReportDateTitle()}）还没有检测到更新的子任务记录。`, "warning");
      setStatus(`今天（${getDailyReportDateTitle()}）还没有检测到更新的子任务记录。`, "warning");
      return;
    }

    const baseMarkdown = normalizeMarkdownForClipboard(markdown);
    let finalMarkdown = baseMarkdown;
    let feedbackText = "日报已按原任务层级生成。";
    let feedbackTone = "success";

    if (ui.weekly.dailyReportUseModelOptimization) {
      if (!desktopApi || typeof desktopApi.generateDailyProgressReport !== "function") {
        feedbackText = "当前版本尚未接通日报优化能力，已回退为原任务层级稿。";
        feedbackTone = "warning";
      } else {
        try {
          const result = await desktopApi.generateDailyProgressReport({
            dateTitle: getDailyReportDateTitle(),
            weekTitle: activeWeeklyRecord.value.title,
            content: baseMarkdown
          });
          const optimizedMarkdown = normalizeMarkdownForClipboard(result.text);

          if (optimizedMarkdown && hasMatchingMarkdownHierarchy(baseMarkdown, optimizedMarkdown)) {
            finalMarkdown = optimizedMarkdown;
            feedbackText = `日报已完成大模型优化（${result.profileLabel}）。`;
          } else {
            feedbackText = `大模型优化未通过层级校验，已回退为原任务层级稿（${result.profileLabel}）。`;
            feedbackTone = "warning";
          }
        } catch (error) {
          console.error("Failed to optimize daily report", error);
          feedbackText = `大模型优化失败，已回退为原任务层级稿：${error instanceof Error ? error.message : "未知错误"}`;
          feedbackTone = "warning";
        }
      }
    }

    ui.weekly.draft.generatedDailyReport = finalMarkdown;
    resetWeeklyReportCopyState();
    setWeeklyReportFeedback(feedbackText, feedbackTone);
    setStatus(feedbackText, feedbackTone);
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
    setWeeklyReportFeedback("当前还没有项目或任务，先补充任务笔记内容再生成周报。", "warning");
    setStatus("当前还没有项目或任务，先补充任务笔记内容再生成周报。", "warning");
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
    ui.weekly.draft.generatedReport = normalizeMarkdownForClipboard(result.text);
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
    const normalizedText = normalizeMarkdownForClipboard(weeklyReportOutputContent.value);

    if (normalizedText !== weeklyReportOutputContent.value) {
      weeklyReportOutputContent.value = normalizedText;
    }

    await copyTextToClipboard(normalizedText);
    markWeeklyReportCopied();
    setStatus(`${weeklyReportModeLabel.value}已清洗并复制，可直接粘贴到飞书。`, "success");
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
  ui.command.activeProgressEventId = null;
  ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
  ui.command.draftInput = "";
  ui.command.attachments = [];
  ui.command.availableMcpTools = [];
  ui.command.liveProgress = null;
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
  ui.command.activeProgressEventId = null;
  ui.command.form = normalizeCommandWorkshopConfig(session);
  ui.command.availableMcpTools = [];
  ui.command.draftInput = "";
  ui.command.attachments = [];
  ui.command.liveProgress = null;
  scrollCommandToBottom();
}

async function handleCommandSessionDelete(sessionId) {
  if (!desktopApi) {
    return;
  }

  const session = workbench.commandSessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除命令工坊会话",
    message: `确认删除会话「${session.title || "当前会话"}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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

function handleCommandInputCompositionStart() {
  ui.command.isInputComposing = true;
}

function handleCommandInputCompositionEnd() {
  ui.command.isInputComposing = false;
}

function handleCommandInputEnterKeydown(event) {
  if (event.isComposing || ui.command.isInputComposing || event.key === "Process" || event.keyCode === 229) {
    return;
  }

  event.preventDefault();
  void handleCommandSubmit();
}

function getCommandAttachmentTitle(attachment) {
  const sizeKb = Math.max(1, Math.round((attachment?.sizeBytes ?? 0) / 1024));
  const statusText = {
    readable: "已读取正文",
    binary: "二进制附件",
    unsupported: "暂不支持正文读取",
    error: attachment?.errorMessage ? `读取失败：${attachment.errorMessage}` : "读取失败"
  }[attachment?.readStatus] ?? "附件";

  return `${attachment?.name ?? "附件"} · ${sizeKb} KB · ${statusText}`;
}

function buildCommandAttachmentContext(attachments) {
  const normalizedAttachments = toPlainIpcData(attachments ?? [], []);

  if (!normalizedAttachments.length) {
    return "";
  }

  return normalizedAttachments
    .map((attachment, index) => {
      const header = `附件 ${index + 1}: ${attachment.name}
路径: ${attachment.path}
类型: ${attachment.mimeType || attachment.extension || "unknown"}
读取状态: ${attachment.readStatus}`;

      if (attachment.extractedText?.trim()) {
        return `${header}
正文:
${attachment.extractedText.trim()}`;
      }

      if (attachment.errorMessage) {
        return `${header}
读取错误: ${attachment.errorMessage}`;
      }

      return `${header}
说明: 该文件已作为附件传入，但当前没有可注入模型的文本正文。`;
    })
    .join("\n\n");
}

function buildCommandUserInputForAgent(content, attachments) {
  const attachmentContext = buildCommandAttachmentContext(attachments);

  if (!attachmentContext) {
    return content;
  }

  return `${content || "请阅读并处理我上传的附件。"}

以下是本轮上传附件的后台读取结果：
${attachmentContext}`;
}

async function handleCommandAttachmentSelect() {
  if (!desktopApi?.selectCommandWorkshopAttachments) {
    setStatus("当前桌面桥接暂不支持上传附件。", "danger");
    return;
  }

  if (!commandSelectedAgent.value || ui.command.isRunning) {
    return;
  }

  try {
    const attachments = await desktopApi.selectCommandWorkshopAttachments();

    if (!attachments?.length) {
      return;
    }

    const currentPaths = new Set(ui.command.attachments.map((attachment) => attachment.path));
    ui.command.attachments = [
      ...ui.command.attachments,
      ...attachments.filter((attachment) => !currentPaths.has(attachment.path))
    ];
    setStatus(`已添加 ${attachments.length} 个附件。`, "success");
  } catch (error) {
    console.error("Failed to select command attachments", error);
    setStatus(`附件读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function removeCommandAttachment(attachmentId) {
  ui.command.attachments = ui.command.attachments.filter((attachment) => attachment.id !== attachmentId);
}

function handleAgentRunProgress(payload) {
  if (!payload?.progressEventId || payload.progressEventId !== ui.command.activeProgressEventId) {
    return;
  }

  ui.command.liveProgress = {
    progressEventId: payload.progressEventId,
    phase: payload.phase ?? "running",
    statusText: payload.statusText || "正在执行中",
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
    artifact: buildCommandWorkshopLiveArtifact(payload)
  };
  scrollCommandToBottom();
}

async function handleCommandLoadMcpTools() {
  if (!desktopApi) {
    return;
  }

  if (!ui.command.form.mcpServerId) {
    setStatus("请先选择一个工具服务，再读取工具。", "warning");
    return;
  }

  try {
    const tools = await desktopApi.listMcpServerTools(ui.command.form.mcpServerId);
    ui.command.availableMcpTools = tools;

    if (!tools.some((tool) => tool.name === ui.command.form.mcpToolName)) {
      ui.command.form.mcpToolName = tools[0]?.name ?? "";
    }

    setStatus(`命令工坊已读取 ${tools.length} 个工具。`, "success");
  } catch (error) {
    console.error("Failed to load command tools", error);
    setStatus(`命令工坊工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function buildConversationMessagesForAgentRun(messages) {
  return (messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content:
        message.role === "user"
          ? buildCommandUserInputForAgent(message.content, message.attachments ?? [])
          : message.content
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
  const attachments = toPlainIpcData(ui.command.attachments ?? [], []);
  const agentUserInput = buildCommandUserInputForAgent(userInput, attachments);
  let mcpArguments = undefined;

  if (!agent) {
    setStatus("请先选择一个可用 Agent。", "warning");
    return;
  }

  if (!userInput && !attachments.length) {
    setStatus("先输入一条任务，或上传一个附件，再让 Gordon 开始工作。", "warning");
    return;
  }

  if (ui.command.form.mcpToolName && !ui.command.form.mcpServerId) {
    setStatus("如果要指定工具，请先选择工具服务。", "warning");
    return;
  }

  if (ui.command.form.mcpServerId && !ui.command.form.mcpToolName && !ui.command.form.autoSelectMcp) {
    setStatus("已选择工具服务，请再选择具体工具，或开启自动工具。", "warning");
    return;
  }

  if (ui.command.form.mcpServerId && ui.command.form.mcpToolName) {
    try {
      mcpArguments = JSON.parse(ui.command.form.mcpArgumentsText);
    } catch (error) {
      setStatus(`工具参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      setStatus("工具参数必须是一个 JSON 对象。", "danger");
      return;
    }
  }

  const activeSession = toPlainIpcData(activeCommandSession.value, null);
  const sessionId = activeSession?.id ?? `command_session_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const progressEventId = `command_progress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const baseMessages = toPlainIpcData(activeSession?.messages ?? [], []);
  const userMessage = {
    id: `command_message_${Date.now()}`,
    role: "user",
    content: userInput || "请阅读并处理我上传的附件。",
    createdAt: startedAt,
    attachments
  };
  const titleSource = userInput || attachments.map((attachment) => attachment.name).join("、");
  const pendingSession = {
    id: sessionId,
    title: activeSession?.title || buildCommandWorkshopTitle(titleSource),
    summary: summarizeCommandWorkshopContent(titleSource),
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
  ui.command.isInputComposing = false;
  ui.command.activeProgressEventId = progressEventId;
  ui.command.liveProgress = {
    progressEventId,
    phase: "running",
    statusText: `命令工坊正在运行 Agent「${agent.name}」...`,
    updatedAt: startedAt,
    artifact: buildCommandWorkshopLiveArtifact({
      profileLabel: "",
      model: "",
      skillName: ui.command.form.skillId ? getSkillById(ui.command.form.skillId)?.name ?? null : null,
      autoSelectedMcp: false,
      mcpServerName: ui.command.form.mcpServerId ? getMcpServerById(ui.command.form.mcpServerId)?.name ?? null : null,
      mcpToolName: ui.command.form.mcpToolName || null,
      mcpResultText: "",
      mcpCalls: [],
      stopReason: "",
      steps: [],
      createdAt: startedAt
    })
  };
  ui.command.view = "chat";
  ui.command.draftInput = "";
  ui.command.attachments = [];
  scrollCommandToBottom();

  try {
    setStatus(`命令工坊正在运行 Agent「${agent.name}」...`, "neutral");
    const runRequest = toPlainIpcData({
      agentProfileId: agent.id,
      userInput: agentUserInput,
      conversationMessages: buildConversationMessagesForAgentRun(baseMessages),
      progressEventId,
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
    const result = await desktopApi.runAgent(runRequest);

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
    const sessions = await desktopApi.upsertCommandWorkshopSession(toPlainIpcData(completedSession));

    workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
    ui.command.activeSessionId = completedSession.id;
    workbench.agentRunLogs = [result, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
    ui.command.isRunning = false;
    ui.command.activeProgressEventId = null;
    ui.command.liveProgress = null;
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
      const sessions = await desktopApi.upsertCommandWorkshopSession(toPlainIpcData(failedSession));
      workbench.commandSessions = sortCommandWorkshopSessions(sessions.map((entry) => normalizeCommandWorkshopSession(entry)));
      ui.command.activeSessionId = failedSession.id;
    } catch (persistError) {
      console.error("Failed to persist command failure session", persistError);
      upsertCommandWorkshopSessionState(failedSession);
    }

    ui.command.isRunning = false;
    ui.command.activeProgressEventId = null;
    ui.command.liveProgress = null;
    setStatus(`命令工坊运行失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    void showAlertDialog({
      tone: "danger",
      title: "命令工坊运行失败",
      message: error instanceof Error ? error.message : "未知错误",
      detail: "失败消息已保留在当前会话中，可回到消息流查看上下文后重试。",
      confirmText: "知道了"
    });
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

  if (!profile) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除 Agent",
    message: `确认删除 Agent「${profile.name}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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

  if (!skill) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除 Skill",
    message: `确认删除 Skill「${skill.name}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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

  if (!server) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除 MCP Server",
    message: `确认删除 MCP Server「${server.name}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
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
    setStatus("请先选择一个工具服务，再读取工具。", "warning");
    return;
  }

  try {
    const tools = await desktopApi.listMcpServerTools(ui.extensions.runner.mcpServerId);
    ui.extensions.runner.availableMcpTools = tools;
    ui.extensions.runner.mcpToolName = tools[0]?.name ?? "";
    setStatus(`已读取 ${tools.length} 个工具。`, "success");
  } catch (error) {
    console.error("Failed to load runner tools", error);
    setStatus(`工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
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
    setStatus("如果要调用工具，请先选择工具服务。", "warning");
    return;
  }

  if (ui.extensions.runner.mcpServerId && !ui.extensions.runner.mcpToolName && !ui.extensions.runner.autoSelectMcp) {
    setStatus("已选择工具服务，请再选择一个具体工具。", "warning");
    return;
  }

  if (ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName) {
    try {
      mcpArguments = JSON.parse(ui.extensions.runner.mcpArgumentsText);
    } catch (error) {
      setStatus(`工具参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      setStatus("工具参数必须是一个 JSON 对象。", "danger");
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
    void showAlertDialog({
      tone: "danger",
      title: "Agent 运行失败",
      message: error instanceof Error ? error.message : "未知错误",
      detail: "Runner 保留当前输入，可调整 Agent、Skill 或工具配置后再次运行。",
      confirmText: "知道了"
    });
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

function normalizeMarkdownForClipboard(value) {
  const oddSpacePattern = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
  const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/g;
  const bulletLikePattern = /^[ \t]*[•●▪◦‣・·]\s+/;
  const statusSuffixPattern = /(?:（|\()(已完成|进行中|待开始|受阻)(?:）|\))\s*$/;
  const normalizeListIndent = (indentWidth = 0) => {
    const width = Number.isFinite(indentWidth) ? Number(indentWidth) : 0;

    if (!width) {
      return "";
    }

    return "    ".repeat(Math.max(1, Math.round(width / 4)));
  };

  const normalizedLines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(zeroWidthPattern, "")
    .replace(oddSpacePattern, " ")
    .replace(/\t/g, "    ")
    .replace(/((?:（|\()(?:已完成|进行中|待开始|受阻)(?:）|\)))(?=\\?[*+-]\s+)/g, "$1\n")
    .replace(/(\S)[ ]{2,}(?=(?:\\?[*+-]|\d+(?:\.\d+)*\.?|\d+\))\s+)/g, "$1\n")
    .split("\n")
    .map((line) => {
      let normalizedLine = line.replace(/[ ]+$/g, "");

      normalizedLine = normalizedLine.replace(/^([ ]*)\\([*+-])\s+/, "$1$2 ");

      if (bulletLikePattern.test(normalizedLine)) {
        normalizedLine = normalizedLine.replace(/^([ ]*)[•●▪◦‣・·]\s+/, "$1* ");
      }

      normalizedLine = normalizedLine.replace(/^([ ]*)([*+-])\s+/, "$1$2 ");
      normalizedLine = normalizedLine.replace(/^([ ]*)(\d+)[\.\)]\s+/, "$1$2. ");
      normalizedLine = normalizedLine.replace(/^(#{1,6})([^\s#])/, "$1 $2");
      normalizedLine = normalizedLine.replace(/^([ ]*)>([^\s>])/, "$1> $2");

      const listMeta = getMarkdownListLineMeta(normalizedLine);

      if (listMeta?.ordered) {
        normalizedLine = `${normalizeListIndent(listMeta.nestingIndent)}${listMeta.marker} ${listMeta.text.trim()}`;
      }

      return normalizedLine;
    });

  const repairedLines = [];
  let hasActiveProject = false;

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];

    if (!line.trim()) {
      const previousNonEmptyLine = [...repairedLines].reverse().find((item) => item.trim());
      const nextNonEmptyLine = normalizedLines.slice(index + 1).find((item) => item.trim());
      const isBlankLineInsideListBlock = Boolean(
        previousNonEmptyLine &&
          nextNonEmptyLine &&
          getMarkdownListLineMeta(previousNonEmptyLine) &&
          getMarkdownListLineMeta(nextNonEmptyLine)
      );

      if (isBlankLineInsideListBlock) {
        continue;
      }

      if (repairedLines[repairedLines.length - 1] !== "") {
        repairedLines.push("");
      }

      continue;
    }

    const listMeta = getMarkdownListLineMeta(line);

    if (!listMeta) {
      repairedLines.push(line);
      continue;
    }

    const content = listMeta.text.trim();

    if (!listMeta.ordered && !listMeta.nestingIndent && statusSuffixPattern.test(content) && hasActiveProject) {
      repairedLines.push(`    * ${content}`);
      continue;
    }

    if (listMeta.ordered) {
      repairedLines.push(`${normalizeListIndent(listMeta.nestingIndent)}${listMeta.marker} ${content}`);
      hasActiveProject = !listMeta.nestingIndent;
      continue;
    }

    repairedLines.push(`${normalizeListIndent(listMeta.nestingIndent)}* ${content}`);
    hasActiveProject = !listMeta.nestingIndent && !statusSuffixPattern.test(content);
  }

  return repairedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
    const serverName = getMcpServerById(config.mcpServerId)?.name ?? "指定工具服务";
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
    if (!ui.weekly.draft || ui.weekly.view !== "editor" || !nextSnapshot || nextSnapshot === weeklySavedSnapshot) {
      return;
    }

    scheduleWeeklyAutosave();
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

  clearWeeklyAutosaveTimer();
  disposeRobotRuntime();
  document.body.classList.remove("load-error");
});
</script>
