<template>
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
          <div class="workflow-library-card-icon" aria-hidden="true">
            <GIcon :name="getWorkflowCardIconName(entry)" :size="16" />
          </div>

          <div class="workflow-library-card-body">
            <div class="workflow-library-card-heading">
              <p class="workflow-library-card-title">{{ entry.title }}</p>
              <span class="workflow-library-card-arrow" aria-hidden="true">
                <GIcon name="chevronRight" :size="15" />
              </span>
            </div>
            <p class="workflow-library-card-subtitle">{{ getWorkflowCardCountLabel(entry) }}</p>
            <div class="workflow-library-card-tags">
              <span v-for="tag in (entry.tags ?? []).slice(0, 3)" :key="tag" class="workflow-library-card-tag">{{ tag }}</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="model-empty">
        <p class="model-empty-copy">当前还没有 workflow 卡片，后续可以继续在本地仓储里补充更多工作流。</p>
      </div>
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
          <template v-else-if="ui.workflow.view === 'info'">
            <span class="status-pill">{{ infoRadarMetrics.activeItemCount }} 条信息</span>
            <button
              type="button"
              class="model-icon-button"
              aria-label="新建信息窗口"
              title="新建信息窗口"
              @click="openInfoRadarWindowEditor()"
            >
              <GIcon name="add" />
            </button>
            <button
              v-if="activeInfoWindow"
              type="button"
              class="model-icon-button"
              aria-label="编辑信息窗口"
              title="编辑信息窗口"
              @click="openInfoRadarWindowEditor(activeInfoWindow)"
            >
              <GIcon name="edit" />
            </button>
            <button
              v-if="activeInfoWindow"
              type="button"
              class="model-icon-button model-action-danger"
              aria-label="删除信息窗口"
              title="删除信息窗口"
              @click="deleteInfoRadarWindow(activeInfoWindow.id)"
            >
              <GIcon name="delete" />
            </button>
            <button
              v-if="activeInfoWindow"
              type="button"
              class="model-icon-button workflow-library-run-control"
              :aria-label="ui.workflow.isRefreshingInfoWindow ? '刷新中' : '刷新信息窗口'"
              :title="ui.workflow.isRefreshingInfoWindow ? '刷新中' : '刷新信息窗口'"
              :disabled="ui.workflow.isRefreshingInfoWindow"
              @click="refreshActiveInfoRadarWindow"
            >
              <GIcon name="refresh" :spin="ui.workflow.isRefreshingInfoWindow" />
            </button>
          </template>
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
        <template v-if="ui.workflow.view === 'info'">
          <section
            class="workflow-info-stage"
            :class="{ 'is-rail-collapsed': ui.workflow.infoRailCollapsed }"
          >
            <aside class="workflow-info-rail" :class="{ 'is-collapsed': ui.workflow.infoRailCollapsed }">
              <div class="workflow-info-rail-head">
                <div class="workflow-info-rail-title-block">
                  <p class="feature-kicker">Radar</p>
                  <p class="model-section-title">信息窗口</p>
                </div>
                <div class="workflow-info-rail-actions">
                  <button
                    type="button"
                    class="model-icon-button workflow-info-rail-toggle"
                    :aria-expanded="String(!ui.workflow.infoRailCollapsed)"
                    :aria-label="ui.workflow.infoRailCollapsed ? '展开信息窗口列表' : '折叠信息窗口列表'"
                    :title="ui.workflow.infoRailCollapsed ? '展开窗口列表' : '折叠窗口列表'"
                    @click="ui.workflow.infoRailCollapsed = !ui.workflow.infoRailCollapsed"
                  >
                    <GIcon :name="ui.workflow.infoRailCollapsed ? 'chevronRight' : 'chevronLeft'" />
                  </button>
                </div>
              </div>

              <div
                v-if="activeInfoWindows.length"
                class="workflow-info-window-list"
                :class="{ 'is-compact': ui.workflow.infoRailCollapsed }"
              >
                <button
                  v-for="infoWindow in activeInfoWindows"
                  :key="infoWindow.id"
                  type="button"
                  class="workflow-info-window-card"
                  :class="{ 'is-active': activeInfoWindow?.id === infoWindow.id }"
                  :aria-label="`打开 ${infoWindow.title}`"
                  :title="`${infoWindow.title} · ${infoWindow.items?.length ?? 0} 条`"
                  @click="openInfoRadarWindow(infoWindow.id)"
                >
                  <span class="workflow-info-window-category">{{ infoWindow.category || "综合" }}</span>
                  <strong>{{ infoWindow.title }}</strong>
                  <span class="workflow-info-window-meta">
                    <span>{{ infoWindow.items?.length ?? 0 }} 条</span>
                    <span>{{ getInfoRadarCadenceLabel(infoWindow.cadence) }}</span>
                  </span>
                  <span class="workflow-info-window-compact-mark">
                    {{ String(infoWindow.category || infoWindow.title || "窗").slice(0, 1) }}
                  </span>
                </button>
              </div>

              <div v-else class="workflow-info-empty">
                <p>还没有信息窗口。</p>
                <button type="button" class="model-action-secondary" @click="openInfoRadarWindowEditor()">
                  <GIcon name="add" />
                  新建
                </button>
              </div>
            </aside>

            <section v-if="activeInfoWindow" class="workflow-info-feed-panel">
              <div class="workflow-info-feed-head">
                <div class="workflow-info-feed-title-block">
                  <div class="workflow-info-feed-title-row">
                    <p class="workflow-info-feed-title">{{ activeInfoWindow.title }}</p>
                    <span
                      v-if="activeInfoWindow.status === 'paused'"
                      class="status-pill is-warning workflow-info-title-status"
                    >
                      已暂停
                    </span>
                  </div>
                  <p v-if="activeInfoWindow.summary" class="workflow-info-feed-summary">{{ activeInfoWindow.summary }}</p>
                </div>

                <div class="workflow-info-feed-metrics">
                  <div class="workflow-info-feed-metric">
                    <strong>{{ activeInfoWindow.items?.length ?? 0 }}</strong>
                    <span>条目</span>
                  </div>
                  <div class="workflow-info-feed-metric">
                    <strong>{{ activeInfoWindow.sources?.length ?? 0 }}</strong>
                    <span>来源</span>
                  </div>
                  <p class="workflow-info-feed-refresh">
                    {{ activeInfoWindow.lastRefreshedAt ? `刷新 ${formatLocalDateTime(activeInfoWindow.lastRefreshedAt)}` : "未刷新" }}
                  </p>
                </div>
              </div>

              <div class="workflow-info-source-strip">
                <span
                  v-for="source in activeInfoWindow.sources"
                  :key="source.id"
                  class="workflow-info-source-chip"
                  :class="{ 'is-disabled': source.enabled === false }"
                  :title="source.url || source.query || source.notes"
                >
                  {{ getInfoRadarSourceKindLabel(source.kind) }} · {{ source.title }}
                </span>
              </div>

              <div
                v-if="activeInfoWindow.runHistory?.[0]"
                class="workflow-info-run-note"
                :class="getInfoRadarRunStatusTone(activeInfoWindow.runHistory[0].status)"
              >
                <span>{{ getInfoRadarRunStatusLabel(activeInfoWindow.runHistory[0].status) }}</span>
                <p>{{ activeInfoWindow.runHistory[0].message }}</p>
              </div>

              <section class="workflow-library-main-card workflow-info-toolbar">
                <label class="field workflow-library-search-field">
                  <span class="field-label">快速筛选</span>
                  <input
                    v-model="ui.workflow.infoSearchQuery"
                    class="field-input"
                    placeholder="搜索标题、摘要、来源或标签"
                  />
                </label>
                <div class="model-section-actions">
                  <button type="button" class="model-action-secondary" @click="openInfoRadarWindowEditor(activeInfoWindow)">
                    <GIcon name="settings" />
                    配置
                  </button>
                  <button
                    type="button"
                    class="model-action"
                    :disabled="ui.workflow.isRefreshingInfoWindow"
                    @click="refreshActiveInfoRadarWindow"
                  >
                    <GIcon name="refresh" :spin="ui.workflow.isRefreshingInfoWindow" />
                    {{ ui.workflow.isRefreshingInfoWindow ? "刷新中" : "刷新" }}
                  </button>
                </div>
              </section>

              <div v-if="filteredInfoRadarItems.length" class="workflow-info-feed-list">
                <article
                  v-for="item in filteredInfoRadarItems"
                  :key="item.id"
                  class="workflow-info-item"
                >
                  <div class="workflow-info-item-head">
                    <div class="workflow-info-item-title-block">
                      <p class="workflow-info-item-title">{{ item.title }}</p>
                      <p class="workflow-info-item-meta">
                        {{ item.sourceTitle }} · {{ getInfoRadarSourceKindLabel(item.sourceKind) }}
                        <span v-if="item.publishedAt"> · {{ formatLocalDateTime(item.publishedAt) }}</span>
                      </p>
                    </div>
                  </div>
                  <p v-if="item.summary" class="workflow-info-item-summary">{{ item.summary }}</p>
                  <div class="workflow-info-item-footer">
                    <div class="extension-tag-row workflow-info-item-tags">
                      <span
                        v-for="tag in item.tags?.slice(0, 4)"
                        :key="tag"
                        class="pill pill-neutral workflow-info-item-tag"
                      >
                        {{ tag }}
                      </span>
                    </div>
                    <a
                      v-if="getInfoRadarItemHref(item)"
                      class="workflow-info-item-link"
                      :href="getInfoRadarItemHref(item)"
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开来源
                    </a>
                  </div>
                </article>
              </div>

              <div v-else class="workflow-info-empty workflow-info-feed-empty">
                <p>当前窗口还没有匹配的信息。可以先刷新，或调整来源与关键词。</p>
              </div>
            </section>

            <section v-else class="workflow-info-feed-panel workflow-info-empty">
              <p>选择或新建一个信息窗口。</p>
              <button type="button" class="model-action" @click="openInfoRadarWindowEditor()">
                <GIcon name="add" />
                新建窗口
              </button>
            </section>
          </section>
        </template>

        <form
          v-else-if="ui.workflow.view === 'info-editor'"
          class="workflow-library-compose-card workflow-info-editor"
          @submit.prevent="saveInfoRadarWindow"
        >
          <div class="workflow-library-main-card-head">
            <div>
              <p class="feature-kicker">Info Window</p>
              <p class="model-section-title">{{ ui.workflow.editingInfoWindowId ? "编辑信息窗口" : "新建信息窗口" }}</p>
            </div>

            <div class="model-section-actions">
              <button type="button" class="model-action-secondary" @click="handleWorkflowBack">取消</button>
              <button type="button" class="model-action" :disabled="ui.workflow.isSavingInfoWindow" @click="saveInfoRadarWindow">
                <GIcon :name="ui.workflow.isSavingInfoWindow ? 'loading' : 'check'" :spin="ui.workflow.isSavingInfoWindow" />
                保存
              </button>
            </div>
          </div>

          <div class="model-form workflow-library-compose-form workflow-info-editor-form">
            <label class="field">
              <span class="field-label">窗口名称</span>
              <input v-model="ui.workflow.infoWindowDraft.title" class="field-input" placeholder="例如：技术与 Agent 趋势" />
            </label>

            <label class="field">
              <span class="field-label">分类</span>
              <input v-model="ui.workflow.infoWindowDraft.category" class="field-input" placeholder="技术 / 金融 / 科研 / 政治" />
            </label>

            <div class="field">
              <span class="field-label">刷新频率</span>
              <GCompactSelect
                v-model="ui.workflow.infoWindowDraft.cadence"
                class="workflow-library-config-select"
                aria-label="刷新频率"
                :options="INFO_RADAR_CADENCE_OPTIONS"
              />
            </div>

            <div class="field">
              <span class="field-label">状态</span>
              <GCompactSelect
                v-model="ui.workflow.infoWindowDraft.status"
                class="workflow-library-config-select"
                aria-label="状态"
                :options="INFO_RADAR_STATUS_OPTIONS"
              />
            </div>

            <label class="field field-full">
              <span class="field-label">简介</span>
              <textarea
                v-model="ui.workflow.infoWindowDraft.summary"
                class="field-textarea workflow-info-compact-textarea"
                rows="2"
                placeholder="这个窗口主要追踪什么信息"
              ></textarea>
            </label>

            <label class="field">
              <span class="field-label">关键词</span>
              <input v-model="ui.workflow.infoWindowDraft.keywordsText" class="field-input" placeholder="AI，Agent，金融监管" />
            </label>

            <label class="field">
              <span class="field-label">排除词</span>
              <input v-model="ui.workflow.infoWindowDraft.negativeKeywordsText" class="field-input" placeholder="广告，招聘，课程" />
            </label>

            <label class="field field-full">
              <span class="field-label">摘要规则</span>
              <textarea
                v-model="ui.workflow.infoWindowDraft.digestPrompt"
                class="field-textarea workflow-info-compact-textarea"
                rows="2"
                placeholder="例如：按影响、证据强度、后续行动线索归纳"
              ></textarea>
            </label>

            <section class="field field-full workflow-info-source-editor">
              <div class="workflow-library-inline-head">
                <div>
                  <span class="field-label">信息来源</span>
                  <p class="workflow-library-inline-copy">RSS 和普通网页可直接刷新；搜索与公众号先保存配置，后续接入专项能力。</p>
                </div>
                <button type="button" class="model-action-secondary" @click="addInfoRadarSourceDraft">
                  <GIcon name="add" />
                  添加来源
                </button>
              </div>

              <div class="workflow-info-source-editor-list">
                <article
                  v-for="source in ui.workflow.infoWindowDraft.sources"
                  :key="source.id"
                  class="workflow-info-source-editor-row"
                >
                  <label class="workflow-info-source-toggle">
                    <input v-model="source.enabled" type="checkbox" aria-label="启用来源" />
                  </label>
                  <div class="field workflow-info-source-kind-field">
                    <span class="field-label">类型</span>
                    <GCompactSelect
                      v-model="source.kind"
                      class="workflow-library-config-select workflow-info-source-kind-select"
                      aria-label="来源类型"
                      :options="INFO_RADAR_SOURCE_KIND_OPTIONS"
                    />
                  </div>
                  <label class="field workflow-info-source-title-field">
                    <span class="field-label">名称</span>
                    <input v-model="source.title" class="field-input" placeholder="OpenAI Blog" />
                  </label>
                  <label class="field workflow-info-source-url-field">
                    <span class="field-label">URL</span>
                    <input v-model="source.url" class="field-input" placeholder="https://example.com/rss.xml" />
                  </label>
                  <label class="field workflow-info-source-query-field">
                    <span class="field-label">查询</span>
                    <input v-model="source.query" class="field-input" placeholder="用于搜索/公众号关键词" />
                  </label>
                  <label class="field workflow-info-source-tags-field">
                    <span class="field-label">标签</span>
                    <input v-model="source.tagsText" class="field-input" placeholder="AI，官方" />
                  </label>
                  <button
                    type="button"
                    class="model-icon-button model-action-danger workflow-info-source-remove"
                    aria-label="删除来源"
                    title="删除来源"
                    @click="removeInfoRadarSourceDraft(source.id)"
                  >
                    <GIcon name="delete" />
                  </button>
                </article>
              </div>
            </section>
          </div>
        </form>

        <template v-else-if="ui.workflow.view === 'list'">
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
                    <div class="field workflow-library-step-mode-field">
                      <span class="field-label">执行方式</span>
                      <GCompactSelect
                        v-model="step.executionMode"
                        class="workflow-library-config-select workflow-library-step-mode-select"
                        aria-label="执行方式"
                        :options="WORKFLOW_STEP_MODE_OPTIONS"
                      />
                    </div>
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
                <div class="field workflow-library-body-step-field">
                  <span class="field-label">请求步骤</span>
                  <GCompactSelect
                    v-model="ui.workflow.bodyStepId"
                    class="workflow-library-config-select workflow-library-body-step-select"
                    aria-label="请求步骤"
                    :options="getWorkflowBodyStepSelectOptions(activeWorkflowBodyStepOptions)"
                    @change="handleWorkflowBodyStepSelect"
                  />
                </div>

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

<script setup>
import GCompactSelect from "../../components/GCompactSelect.vue";
import GIcon from "../../components/GIcon.vue";

const INFO_RADAR_CADENCE_OPTIONS = [
  { value: "manual", label: "手动" },
  { value: "hourly", label: "每小时" },
  { value: "daily", label: "每日" },
  { value: "weekly", label: "每周" }
];

const INFO_RADAR_STATUS_OPTIONS = [
  { value: "active", label: "启用" },
  { value: "paused", label: "暂停" }
];

const INFO_RADAR_SOURCE_KIND_OPTIONS = [
  { value: "rss", label: "RSS" },
  { value: "web_page", label: "网页" },
  { value: "search", label: "搜索" },
  { value: "wechat", label: "公众号" },
  { value: "manual", label: "手工" }
];

const WORKFLOW_STEP_MODE_OPTIONS = [
  { value: "once", label: "单次" },
  { value: "polling", label: "轮询" }
];

function getWorkflowCardIconName(entry) {
  if (entry?.kind === "info-radar") {
    return "stats";
  }

  return "fileText";
}

function getWorkflowBodyStepSelectOptions(entries = []) {
  return entries.map((entry) => ({
    value: entry.id,
    label: `${entry.label} · ${entry.method}`
  }));
}

defineProps({
  ui: { type: Object, required: true },
  workflowLibraryCards: { type: Array, default: () => [] },
  workflowDetailTitle: { type: String, default: "流程中心" },
  activeInfoWindow: { type: Object, default: null },
  activeInfoWindows: { type: Array, default: () => [] },
  filteredInfoRadarItems: { type: Array, default: () => [] },
  infoRadarMetrics: { type: Object, default: () => ({ windowCount: 0, itemCount: 0, sourceCount: 0, activeSourceCount: 0, activeItemCount: 0 }) },
  filteredWorkflowRecords: { type: Array, default: () => [] },
  activeWorkflowRecord: { type: Object, default: null },
  activeWorkflowMetrics: { type: Object, default: () => ({ timeoutMs: 0 }) },
  activeWorkflowApiKeyInputType: { type: String, default: "password" },
  activeWorkflowEnvironments: { type: Array, default: () => [] },
  activeWorkflowEnvironment: { type: Object, default: null },
  activeWorkflowBodyStepOptions: { type: Array, default: () => [] },
  workflowBodyDraftChanged: { type: Boolean, default: false },
  workflowRunControlLabel: { type: String, default: "执行工作流" },
  workflowRunControlIcon: { type: String, default: "play" },
  workflowRunStatusLabel: { type: String, default: "待执行" },
  workflowRunStatusTone: { type: String, default: "" },
  activeWorkflowSteps: { type: Array, default: () => [] },
  addInfoRadarSourceDraft: { type: Function, required: true },
  addWorkflowDraftEnvironment: { type: Function, required: true },
  addWorkflowDraftStep: { type: Function, required: true },
  addWorkflowStepOutput: { type: Function, required: true },
  cancelActiveWorkflowRun: { type: Function, required: true },
  deleteInfoRadarWindow: { type: Function, required: true },
  deleteWorkflowRecord: { type: Function, required: true },
  duplicateWorkflowRecord: { type: Function, required: true },
  formatDurationMs: { type: Function, required: true },
  formatLocalDateTime: { type: Function, required: true },
  getInfoRadarCadenceLabel: { type: Function, required: true },
  getInfoRadarItemHref: { type: Function, required: true },
  getInfoRadarItemStatusLabel: { type: Function, required: true },
  getInfoRadarRunStatusLabel: { type: Function, required: true },
  getInfoRadarRunStatusTone: { type: Function, required: true },
  getInfoRadarSourceKindLabel: { type: Function, required: true },
  getWorkflowCardCountLabel: { type: Function, required: true },
  getWorkflowRunCompletedCount: { type: Function, required: true },
  getWorkflowRunDurationLabel: { type: Function, required: true },
  getWorkflowRunProgressPercent: { type: Function, required: true },
  getWorkflowRunSummaryText: { type: Function, required: true },
  getWorkflowStepModeLabel: { type: Function, required: true },
  getWorkflowStepProgressPercent: { type: Function, required: true },
  getWorkflowStepStatusLabel: { type: Function, required: true },
  getWorkflowStepStatusTone: { type: Function, required: true },
  getWorkflowStepVisualRows: { type: Function, required: true },
  handleWorkflowApiKeyInput: { type: Function, required: true },
  handleWorkflowBack: { type: Function, required: true },
  handleWorkflowBodyDraftInput: { type: Function, required: true },
  handleWorkflowBodyStepSelect: { type: Function, required: true },
  handleWorkflowCurlCopy: { type: Function, required: true },
  isWorkflowStepExpanded: { type: Function, required: true },
  openInfoRadarWindow: { type: Function, required: true },
  openInfoRadarWindowEditor: { type: Function, required: true },
  openWorkflowCard: { type: Function, required: true },
  openWorkflowRecord: { type: Function, required: true },
  openWorkflowRecordEditor: { type: Function, required: true },
  persistActiveWorkflowRuntimeConfig: { type: Function, required: true },
  persistWorkflowBodyDraftToTemplate: { type: Function, required: true },
  removeWorkflowDraftEnvironment: { type: Function, required: true },
  removeWorkflowDraftStep: { type: Function, required: true },
  removeWorkflowStepOutput: { type: Function, required: true },
  removeInfoRadarSourceDraft: { type: Function, required: true },
  repairWorkflowBodyDraft: { type: Function, required: true },
  refreshActiveInfoRadarWindow: { type: Function, required: true },
  runActiveWorkflowRecord: { type: Function, required: true },
  saveInfoRadarWindow: { type: Function, required: true },
  saveWorkflowRecord: { type: Function, required: true },
  selectWorkflowEnvironment: { type: Function, required: true },
  syncWorkflowBodyDraftFromActiveStep: { type: Function, required: true },
  toggleWorkflowStepExpanded: { type: Function, required: true }
});
</script>
