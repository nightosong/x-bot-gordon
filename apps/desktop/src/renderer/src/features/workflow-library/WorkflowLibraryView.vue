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

        <div
          class="workflow-library-detail-head-center"
          :class="{ 'workflow-library-detail-head-reader': ui.workflow.view === 'info-reader' || ui.workflow.view === 'live-stream' }"
        >
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
          <template v-else-if="ui.workflow.view === 'finance'">
            <span class="status-pill">{{ activeFinanceSymbols.length }} 个标的</span>
            <button
              type="button"
              class="model-icon-button workflow-library-run-control"
              :aria-label="ui.workflow.isQueryingFinanceBrief ? '查询中' : '刷新行情'"
              :title="ui.workflow.isQueryingFinanceBrief ? '查询中' : '刷新行情'"
              :disabled="ui.workflow.isQueryingFinanceBrief"
              @click="queryActiveFinanceBrief"
            >
              <GIcon name="refresh" :spin="ui.workflow.isQueryingFinanceBrief" />
            </button>
          </template>
          <template v-else-if="ui.workflow.view === 'live-stream'">
            <span class="status-pill">{{ activeLiveStreamSources.length }} 个直播间</span>
            <button
              type="button"
              class="model-icon-button"
              aria-label="外部打开直播"
              title="外部打开直播"
              @click="openLiveStreamExternal"
            >
              <GIcon name="jump" />
            </button>
            <button
              type="button"
              class="model-icon-button workflow-library-run-control"
              :aria-label="ui.workflow.isLiveStreamLoading ? '加载中' : '刷新直播'"
              :title="ui.workflow.isLiveStreamLoading ? '加载中' : '刷新直播'"
              :disabled="ui.workflow.isLiveStreamLoading"
              @click="refreshLiveStreamView"
            >
              <GIcon name="refresh" :spin="ui.workflow.isLiveStreamLoading" />
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
          <template v-else-if="ui.workflow.view === 'info-reader' && activeInfoReaderItem">
            <button
              v-if="canOpenInfoRadarItem(activeInfoReaderItem)"
              type="button"
              class="model-action-secondary workflow-info-reader-external"
              title="在浏览器打开"
              aria-label="在浏览器打开"
              @click="openInfoRadarItemExternal(activeInfoReaderItem, ui.workflow.infoReaderResolvedUrl)"
            >
              <GIcon name="jump" />
            </button>
          </template>
        </div>
      </section>

      <section
        class="workflow-library-main-stage"
        :class="{
          'workflow-library-main-stage-info': ui.workflow.view === 'info',
          'workflow-library-main-stage-reader': ui.workflow.view === 'info-reader' || ui.workflow.view === 'live-stream'
        }"
      >
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
              <section class="workflow-info-compact-console">
                <div class="workflow-info-compact-head">
                  <div class="workflow-info-feed-title-block">
                    <div class="workflow-info-feed-title-row">
                      <span
                        class="workflow-info-radar-pulse"
                        :class="{ 'is-live': ui.workflow.isRefreshingInfoWindow, 'is-paused': activeInfoWindow.status === 'paused' }"
                        aria-hidden="true"
                      >
                        <span class="workflow-info-radar-pulse-core"></span>
                        <span class="workflow-info-radar-pulse-ring"></span>
                      </span>
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

                  <div class="workflow-info-compact-metrics" aria-label="信息雷达统计">
                    <span><strong>{{ activeInfoWindow.items?.length ?? 0 }}</strong>条</span>
                    <span><strong>{{ activeInfoWindow.sources?.length ?? 0 }}</strong>源</span>
                    <span><strong>{{ infoRadarMetrics.highScoreCount ?? 0 }}</strong>高相关</span>
                    <span><strong>{{ infoRadarMetrics.newItemCount ?? 0 }}</strong>新</span>
                    <span>{{ activeInfoWindow.lastRefreshedAt ? `刷新 ${formatLocalDateTime(activeInfoWindow.lastRefreshedAt)}` : "未刷新" }}</span>
                  </div>
                </div>

               <div class="workflow-info-compact-bar">
                 <div class="workflow-info-compact-tools">
                   <label class="workflow-info-compact-search">
                     <span>筛选</span>
                     <input
                       v-model="ui.workflow.infoSearchQuery"
                       placeholder="标题、摘要、来源或标签"
                     />
                   </label>
                   <button type="button" class="model-icon-button" aria-label="配置信息窗口" title="配置" @click="openInfoRadarWindowEditor(activeInfoWindow)">
                     <GIcon name="settings" />
                   </button>
                   <button
                     type="button"
                     class="model-icon-button workflow-info-refresh-icon"
                     :disabled="ui.workflow.isRefreshingInfoWindow"
                     :aria-label="ui.workflow.isRefreshingInfoWindow ? '刷新中' : '刷新'"
                     :title="ui.workflow.isRefreshingInfoWindow ? '刷新中' : '刷新'"
                     @click="refreshActiveInfoRadarWindow"
                   >
                     <GIcon name="refresh" :spin="ui.workflow.isRefreshingInfoWindow" />
                   </button>
                   <GCompactSelect
                     v-model="ui.workflow.infoSourceFilter"
                     class="workflow-info-filter-select"
                     aria-label="来源筛选"
                     :options="infoRadarSourceFilterOptions"
                   />
                   <GCompactSelect
                     v-model="ui.workflow.infoTopicFilter"
                     class="workflow-info-filter-select workflow-info-topic-select"
                     aria-label="标签筛选"
                     :options="infoRadarTopicFilterOptions"
                   />
                 </div>
               </div>
              </section>

              <!-- 状态 tab 筛选栏 -->
              <div class="workflow-info-status-tabs" role="tablist" aria-label="按状态筛选">
                <button
                  v-for="tab in INFO_RADAR_STATUS_TABS"
                  :key="tab.value"
                  type="button"
                  role="tab"
                  class="workflow-info-status-tab"
                  :class="{ 'is-active': ui.workflow.infoStatusFilter === tab.value }"
                  :aria-selected="String(ui.workflow.infoStatusFilter === tab.value)"
                  @click="ui.workflow.infoStatusFilter = tab.value"
                >
                  {{ tab.label }}
                  <span v-if="tab.value === ''" class="workflow-info-status-tab-count">{{ filteredInfoRadarItems.length }}</span>
                  <span v-else-if="tab.value === 'new'" class="workflow-info-status-tab-count">{{ infoRadarMetrics.newItemCount }}</span>
                  <span v-else-if="tab.value === 'saved'" class="workflow-info-status-tab-count">{{ filteredInfoRadarItems.filter(i => i.status === 'saved').length }}</span>
                </button>
              </div>

              <div v-if="filteredInfoRadarItemsByStatus.length" class="workflow-info-feed-canvas">
                <div class="workflow-info-feed-list">
                  <article
                    v-for="item in filteredInfoRadarItemsByStatus"
                    :key="item.id"
                    class="workflow-info-item"
                    :class="[getInfoRadarSourceTone(item.sourceKind), { 'is-openable': canOpenInfoRadarItem(item), 'is-saved': item.status === 'saved', 'is-ignored': item.status === 'ignored' }]"
                    :role="canOpenInfoRadarItem(item) ? 'button' : undefined"
                    :tabindex="canOpenInfoRadarItem(item) ? 0 : undefined"
                    :aria-label="canOpenInfoRadarItem(item) ? `打开：${item.title}` : undefined"
                    @click="canOpenInfoRadarItem(item) && openInfoRadarItemReader(item)"
                    @keydown.enter.prevent="canOpenInfoRadarItem(item) && openInfoRadarItemReader(item)"
                    @keydown.space.prevent="canOpenInfoRadarItem(item) && openInfoRadarItemReader(item)"
                  >
                    <div class="workflow-info-item-score" aria-hidden="true">
                      <span :style="{ width: `${getInfoRadarScorePercent(item)}%` }"></span>
                    </div>
                    <div class="workflow-info-item-visual" aria-hidden="true">
                      <img v-if="item.imageUrl" :src="item.imageUrl" alt="" loading="lazy" />
                      <span v-else>{{ String(item.sourceTitle || item.title || "I").slice(0, 1) }}</span>
                    </div>
                    <div class="workflow-info-item-main">
                      <div class="workflow-info-item-head">
                        <div class="workflow-info-item-title-block">
                          <div class="workflow-info-item-kicker-row">
                            <span class="workflow-info-kicker-cluster workflow-info-kicker-source">
                              <span class="workflow-info-kind-badge" :class="getInfoRadarSourceTone(item.sourceKind)">
                                {{ getInfoRadarSourceKindLabel(item.sourceKind) }}
                              </span>
                              <span class="workflow-info-source-name">{{ item.sourceTitle }}</span>
                              <span v-if="item.score" class="workflow-info-score-chip">相关 {{ item.score }}</span>
                            </span>
                            <span class="workflow-info-kicker-cluster workflow-info-kicker-byline">
                              <span v-if="item.author">{{ item.author }}</span>
                              <span v-if="item.publishedAt">{{ formatLocalDateTime(item.publishedAt) }}</span>
                              <span v-else-if="item.fetchedAt">{{ formatLocalDateTime(item.fetchedAt) }}</span>
                            </span>
                          </div>
                          <p class="workflow-info-item-title">{{ item.title }}</p>
                          <p v-if="getInfoRadarItemSummaryText(item)" class="workflow-info-item-summary">{{ getInfoRadarItemSummaryText(item) }}</p>
                        </div>
                      </div>
                      <div class="workflow-info-item-footer">
                        <div class="extension-tag-row workflow-info-item-tags">
                          <span
                            v-for="tag in (item.matchedKeywords?.length ? item.matchedKeywords : item.tags)?.slice(0, 4)"
                            :key="tag"
                            class="pill pill-neutral workflow-info-item-tag"
                          >
                            {{ tag }}
                          </span>
                        </div>
                        <div class="workflow-info-item-actions" @click.stop>
                          <button
                            type="button"
                            class="workflow-info-item-action-btn"
                            :class="{ 'is-active': item.status === 'saved' }"
                            :aria-label="item.status === 'saved' ? '取消收藏' : '收藏'"
                            :title="item.status === 'saved' ? '取消收藏' : '收藏'"
                            @click="markInfoRadarItemStatus(item.id, item.status === 'saved' ? 'new' : 'saved')"
                          >
                            <GIcon name="bookmark" :size="12" />
                          </button>
                          <button
                            v-if="item.status !== 'ignored'"
                            type="button"
                            class="workflow-info-item-action-btn is-mute"
                            aria-label="忽略"
                            title="忽略"
                            @click="markInfoRadarItemStatus(item.id, 'ignored')"
                          >
                            <GIcon name="eyeOff" :size="12" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      v-if="canOpenInfoRadarItem(item)"
                      type="button"
                      class="workflow-info-item-link"
                      :aria-label="`打开来源：${item.title}`"
                      title="打开来源"
                      @click.stop="openInfoRadarItemReader(item)"
                    >
                      <span>打开</span>
                      <GIcon name="jump" :size="12" />
                    </button>
                  </article>
                </div>
              </div>

              <div v-else class="workflow-info-empty workflow-info-feed-empty">
                <p>{{ ui.workflow.infoStatusFilter === 'saved' ? '还没有收藏的信息。' : ui.workflow.infoSearchQuery || ui.workflow.infoSourceFilter || ui.workflow.infoTopicFilter ? '没有匹配的信息，试着调整筛选条件。' : '当前窗口还没有信息，先刷新来源。' }}</p>
              </div>
            </section>

            <section v-else class="workflow-info-feed-panel workflow-info-empty">
              <div class="workflow-info-launch">
                <div class="workflow-info-launch-head">
                  <span class="workflow-info-launch-orbit" aria-hidden="true">
                    <GIcon name="radar" :size="22" />
                  </span>
                  <div>
                    <p class="workflow-info-launch-title">搭建你的情报雷达</p>
                    <p class="workflow-info-launch-copy">选择一个前沿预设一键接入，或从零新建窗口。</p>
                  </div>
                </div>
                <div class="workflow-info-preset-grid">
                  <button
                    v-for="preset in infoRadarPresets"
                    :key="preset.id"
                    type="button"
                    class="workflow-info-preset-card"
                    :class="`is-${preset.accent}`"
                    @click="applyInfoRadarPreset(preset.id)"
                  >
                    <span class="workflow-info-preset-icon" aria-hidden="true">
                      <GIcon :name="preset.icon" :size="16" />
                    </span>
                    <span class="workflow-info-preset-body">
                      <strong>{{ preset.label }}</strong>
                      <span>{{ preset.summary }}</span>
                    </span>
                    <span class="workflow-info-preset-count">{{ preset.sources.length }} 源</span>
                  </button>
                </div>
                <button type="button" class="model-action-secondary workflow-info-launch-blank" @click="openInfoRadarWindowEditor()">
                  <GIcon name="add" />
                  从零新建窗口
                </button>
              </div>
            </section>
          </section>
        </template>

        <section
          v-else-if="ui.workflow.view === 'finance'"
          class="workflow-finance-stage"
          :class="{ 'is-focus-mode': financeFocusMode }"
        >
          <section class="workflow-finance-command-deck">
            <div class="workflow-finance-instrument">
              <span class="workflow-finance-instrument-mark" aria-hidden="true">
                <GIcon name="lineChart" :size="17" />
              </span>
              <div class="workflow-finance-instrument-copy">
                <p>{{ activeFinanceSnapshot?.quote?.displayName || activeFinanceSymbol?.displayName || "金融行情" }}</p>
                <span>
                  {{ activeFinanceSnapshot?.quote?.symbol || activeFinanceSymbol?.symbol || "Yahoo Finance" }}
                  <i v-if="activeFinanceSnapshot?.quote?.exchangeName">{{ activeFinanceSnapshot.quote.exchangeName }}</i>
                  <i v-if="activeFinanceSnapshot?.quote?.currency">{{ activeFinanceSnapshot.quote.currency }}</i>
                </span>
              </div>
              <div v-if="activeFinanceSnapshot" class="workflow-finance-live-quote">
                <strong>{{ formatFinanceBriefNumber(activeFinanceSnapshot.quote.regularMarketPrice) }}</strong>
                <span :class="getFinanceBriefChangeTone(activeFinanceSnapshot.quote.change)">
                  {{ formatFinanceBriefSignedNumber(activeFinanceSnapshot.quote.change) }}
                  <em>{{ formatFinanceBriefPercent(activeFinanceSnapshot.quote.changePercent) }}</em>
                </span>
              </div>
            </div>

            <div class="workflow-finance-search-cluster">
              <label class="workflow-finance-symbol-input">
                <GIcon name="search" :size="14" />
                <input
                  v-model="ui.workflow.financeSymbolQuery"
                  aria-label="输入股票或金融标的代码"
                  placeholder="GC=F / 600036.SS"
                  @keydown.enter.prevent="queryActiveFinanceBrief"
                />
              </label>
              <GCompactSelect
                :model-value="activeFinanceSymbol?.id ?? ''"
                class="workflow-info-filter-select workflow-finance-select"
                aria-label="标的列表"
                :options="financeBriefSymbolOptions"
                placeholder="标的列表"
                @change="selectFinanceBriefSymbol"
              />
              <button
                type="button"
                class="model-icon-button workflow-finance-query"
                :aria-label="ui.workflow.isQueryingFinanceBrief ? '正在同步行情' : '查询行情'"
                :title="ui.workflow.isQueryingFinanceBrief ? '正在同步行情' : '查询行情'"
                :disabled="ui.workflow.isQueryingFinanceBrief"
                @click="queryActiveFinanceBrief"
              >
                <GIcon :name="ui.workflow.isQueryingFinanceBrief ? 'loading' : 'refresh'" :spin="ui.workflow.isQueryingFinanceBrief" />
              </button>
              <span class="workflow-finance-sync-state" title="进入金融快报后每 15 秒自动刷新">
                <i :class="{ 'is-busy': ui.workflow.isQueryingFinanceBrief }"></i>
                {{ getFinanceBriefRefreshLabel() }}
              </span>
            </div>
          </section>

          <section class="workflow-finance-toolbar" aria-label="行情图表工具栏">
            <div class="workflow-finance-tool-group">
              <span class="workflow-finance-tool-label">视窗</span>
              <div class="workflow-finance-tool-options" aria-label="K 线区间选择">
                <button
                  v-for="option in FINANCE_RANGE_OPTIONS"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-active': ui.workflow.financeRange === option.value }"
                  @click="selectFinanceRange(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="workflow-finance-tool-group">
              <span class="workflow-finance-tool-label">周期</span>
              <div class="workflow-finance-tool-options" aria-label="K 线周期选择">
                <button
                  v-for="option in FINANCE_INTERVAL_OPTIONS"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-active': ui.workflow.financeInterval === option.value }"
                  @click="selectFinanceInterval(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="workflow-finance-indicators" aria-label="图表指标">
              <button type="button" :class="{ 'is-active is-ma5': financeShowMa5 }" @click="financeShowMa5 = !financeShowMa5">MA5</button>
              <button type="button" :class="{ 'is-active is-ma20': financeShowMa20 }" @click="financeShowMa20 = !financeShowMa20">MA20</button>
              <button type="button" :class="{ 'is-active': financeShowVolume }" @click="financeShowVolume = !financeShowVolume">成交量</button>
              <button
                type="button"
                class="workflow-finance-focus-control"
                :aria-label="financeFocusMode ? '退出图表聚焦模式' : '进入图表聚焦模式'"
                :title="financeFocusMode ? '退出聚焦模式' : '聚焦图表'"
                @click="financeFocusMode = !financeFocusMode"
              >
                <GIcon :name="financeFocusMode ? 'minimize' : 'maximize'" :size="15" />
              </button>
            </div>
          </section>

          <p v-if="ui.workflow.financeBriefError" class="workflow-finance-error" role="alert">
            {{ ui.workflow.financeBriefError }}
          </p>

          <template v-if="activeFinanceSnapshot">
            <section class="workflow-finance-stats-strip" aria-label="行情摘要">
              <span
                v-for="metric in activeFinanceSnapshot.derivedMetrics"
                :key="metric.id"
                class="is-derived"
                :title="metric.notes || `${metric.sourceName} ${metric.sourceSymbol}`"
              >
                <small>{{ metric.label }}</small>
                <strong>{{ formatFinanceBriefNumber(metric.value) }}</strong>
                <em>{{ metric.unit }}</em>
              </span>
              <span>
                <small>昨收</small>
                <strong>{{ formatFinanceBriefNumber(activeFinanceSnapshot.quote.previousClose) }}</strong>
              </span>
              <span>
                <small>日高</small>
                <strong>{{ formatFinanceBriefNumber(activeFinanceSnapshot.quote.dayHigh) }}</strong>
              </span>
              <span>
                <small>日低</small>
                <strong>{{ formatFinanceBriefNumber(activeFinanceSnapshot.quote.dayLow) }}</strong>
              </span>
              <span>
                <small>成交量</small>
                <strong>{{ formatFinanceBriefCompactNumber(activeFinanceSnapshot.quote.volume) }}</strong>
              </span>
            </section>

            <article class="workflow-finance-chart-panel">
              <header class="workflow-finance-chart-head">
                <div>
                  <p class="workflow-finance-chart-title">
                    {{ getFinanceBriefRangeLabel(activeFinanceSnapshot.range) }} · {{ getFinanceBriefIntervalLabel(activeFinanceSnapshot.interval) }} K 线
                  </p>
                  <div class="workflow-finance-chart-context" aria-label="K 线可视区间">
                    <span>{{ activeFinanceChartSummary.rangeLabel }}</span>
                    <span>{{ activeFinanceChartSummary.durationLabel }}</span>
                    <span>{{ activeFinanceChartSummary.pointLabel }}</span>
                    <span>{{ activeFinanceChartSummary.timeZoneLabel }}</span>
                  </div>
                </div>
                <div class="workflow-finance-chart-bounds">
                  <span><small>低</small>{{ activeFinanceChartBounds.low }}</span>
                  <i></i>
                  <span><small>高</small>{{ activeFinanceChartBounds.high }}</span>
                </div>
              </header>

              <FinanceKlineChart
                v-if="activeFinanceChartRows.length"
                :rows="activeFinanceChartRows"
                :snapshot="activeFinanceSnapshot"
                :is-refreshing="ui.workflow.isQueryingFinanceBrief"
                :show-ma5="financeShowMa5"
                :show-ma20="financeShowMa20"
                :show-volume="financeShowVolume"
                :focused="financeFocusMode"
                :format-number="formatFinanceBriefNumber"
                :format-compact-number="formatFinanceBriefCompactNumber"
              />
              <div v-else class="workflow-info-empty workflow-finance-empty-chart">
                <p>当前数据源没有返回可绘制的 K 线点。</p>
              </div>

              <footer class="workflow-finance-chart-status">
                <span>{{ activeFinanceSnapshot.sourceName }}</span>
                <span>
                  {{ activeFinanceSnapshot.quote.marketTime ? `市场时间 ${formatFinanceBriefQuoteDateTime(activeFinanceSnapshot.quote.marketTime, activeFinanceSnapshot)}` : `抓取 ${formatFinanceBriefQuoteDateTime(activeFinanceSnapshot.fetchedAt, activeFinanceSnapshot)}` }}
                </span>
                <span>自动刷新 15s</span>
                <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Chart by TradingView</a>
              </footer>
            </article>
          </template>

          <section v-else class="workflow-info-empty workflow-finance-empty">
            <div class="workflow-info-launch">
              <div class="workflow-info-launch-head">
                <span class="workflow-info-launch-orbit" aria-hidden="true">
                  <GIcon name="stats" :size="22" />
                </span>
                <div>
                  <p class="workflow-info-launch-title">打开金融快报</p>
                  <p class="workflow-info-launch-copy">默认可查黄金期货和招商银行 A 股，也可以输入其他 Yahoo Finance symbol。</p>
                </div>
              </div>
              <button type="button" class="model-action workflow-info-launch-blank" :disabled="ui.workflow.isQueryingFinanceBrief" @click="queryActiveFinanceBrief">
                <GIcon :name="ui.workflow.isQueryingFinanceBrief ? 'loading' : 'refresh'" :spin="ui.workflow.isQueryingFinanceBrief" />
                拉取黄金 K 线
              </button>
            </div>
          </section>
        </section>

        <section v-else-if="ui.workflow.view === 'live-stream'" class="workflow-live-stage">
          <aside class="workflow-live-rail">
            <div class="workflow-live-rail-head">
              <div>
                <p class="feature-kicker">Live</p>
                <p class="model-section-title">直播间</p>
              </div>
              <span class="workflow-live-count">{{ activeLiveStreamSources.length }}</span>
            </div>

            <div v-if="activeLiveStreamSources.length" class="workflow-live-source-list">
              <button
                v-for="source in activeLiveStreamSources"
                :key="source.id"
                type="button"
                class="workflow-live-source"
                :class="{ 'is-active': source.id === activeLiveStreamSource?.id }"
                @click="openLiveStreamSource(source)"
              >
                <span class="workflow-live-source-icon" aria-hidden="true">
                  <GIcon name="video" :size="14" />
                </span>
                <span class="workflow-live-source-copy">
                  <strong>{{ getLiveStreamSourceLabel(source) }}</strong>
                  <small>{{ getLiveStreamPlatformLabel(source.platform) }}{{ source.roomId ? ` · ${source.roomId}` : "" }}</small>
                </span>
              </button>
            </div>

            <div class="workflow-live-input-panel">
              <div class="workflow-live-platform-row" role="radiogroup" aria-label="直播平台">
                <button
                  v-for="option in liveStreamPlatformOptions"
                  :key="option.value"
                  type="button"
                  class="workflow-live-platform"
                  :class="{ 'is-active': ui.workflow.liveStreamPlatform === option.value }"
                  :aria-pressed="ui.workflow.liveStreamPlatform === option.value ? 'true' : 'false'"
                  @click="ui.workflow.liveStreamPlatform = option.value"
                >
                  {{ option.label }}
                </button>
              </div>

              <label class="workflow-live-url-field">
                <input
                  v-model="ui.workflow.liveStreamUrlInput"
                  type="text"
                  :placeholder="liveStreamInputPlaceholder"
                  @keydown.enter.prevent="openLiveStreamFromInput"
                />
              </label>

              <div class="workflow-live-input-actions">
                <button type="button" class="model-action workflow-live-open-action" @click="openLiveStreamFromInput">
                  <GIcon name="play" />
                  打开
                </button>
                <button type="button" class="model-icon-button" aria-label="收藏当前直播间" title="收藏当前直播间" @click="saveLiveStreamInputAsSource">
                  <GIcon name="bookmark" />
                </button>
              </div>
            </div>
          </aside>

          <section class="workflow-live-player-shell">
            <div ref="liveStreamFrameRef" class="workflow-live-frame">
              <div v-if="ui.workflow.isLiveStreamLoading" class="workflow-info-reader-loading workflow-live-loading" role="status" aria-live="polite">
                <span class="workflow-info-reader-spinner" aria-hidden="true"></span>
                <span>正在加载直播页</span>
              </div>
              <div v-else-if="ui.workflow.liveStreamError" class="workflow-info-reader-fallback workflow-live-fallback" role="status">
                <p>{{ ui.workflow.liveStreamError }}</p>
                <button type="button" class="model-action-secondary" @click="openLiveStreamExternal">
                  <GIcon name="jump" />
                  外部打开
                </button>
              </div>
              <div v-else-if="!ui.workflow.liveStreamResolvedUrl" class="workflow-live-empty">
                <GIcon name="video" :size="24" />
                <p>选择一个直播间，或输入直播页链接。</p>
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="ui.workflow.view === 'info-reader'" class="workflow-info-reader-stage">
          <template v-if="activeInfoReaderItem && canOpenInfoRadarItem(activeInfoReaderItem)">
            <div ref="infoReaderFrameRef" class="workflow-info-reader-frame">
              <div v-if="ui.workflow.isInfoReaderLoading" class="workflow-info-reader-loading" role="status" aria-live="polite">
                <span class="workflow-info-reader-spinner" aria-hidden="true"></span>
                <span>正在加载来源页面</span>
              </div>
              <div v-else-if="ui.workflow.infoReaderError" class="workflow-info-reader-fallback" role="status">
                <p>{{ ui.workflow.infoReaderError }}</p>
                <button
                  type="button"
                  class="model-action-secondary"
                  @click="openInfoRadarItemExternal(activeInfoReaderItem, ui.workflow.infoReaderResolvedUrl)"
                >
                  <GIcon name="jump" />
                  外部打开
                </button>
              </div>
            </div>
          </template>

          <div v-else class="workflow-info-empty workflow-info-reader-empty">
            <p>当前信息没有可打开的来源链接。</p>
            <button type="button" class="model-action-secondary" @click="handleWorkflowBack">
              <GIcon name="return" />
              返回列表
            </button>
          </div>
        </section>

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
            <div v-if="!ui.workflow.editingInfoWindowId" class="field field-full workflow-info-preset-strip">
              <span class="field-label">快速套用预设</span>
              <div class="workflow-info-preset-chips">
                <button
                  v-for="preset in infoRadarPresets"
                  :key="preset.id"
                  type="button"
                  class="workflow-info-preset-chip"
                  :class="`is-${preset.accent}`"
                  :title="preset.summary"
                  @click="applyInfoRadarPreset(preset.id)"
                >
                  <GIcon :name="preset.icon" :size="13" />
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <label class="field">
              <span class="field-label">窗口名称</span>
              <input v-model="ui.workflow.infoWindowDraft.title" class="field-input" placeholder="例如：金融市场观察" />
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
                  <p class="workflow-library-inline-copy">RSS、网页、公开搜索和公众号线索均可刷新；公众号依赖公开搜索页，遇到限流会在刷新记录里提示。</p>
                </div>
                <button type="button" class="model-action-secondary" @click="addInfoRadarSourceDraft">
                  <GIcon name="add" />
                  添加来源
                </button>
              </div>

              <div class="workflow-info-source-editor-header" aria-hidden="true">
                <span></span>
                <span>类型</span>
                <span>名称</span>
                <span>URL</span>
                <span>查询</span>
                <span>标签</span>
                <span></span>
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
                    <GCompactSelect
                      v-model="source.kind"
                      class="workflow-library-config-select workflow-info-source-kind-select"
                      aria-label="来源类型"
                      :options="INFO_RADAR_SOURCE_KIND_OPTIONS"
                    />
                  </div>
                  <label class="field workflow-info-source-title-field">
                    <input v-model="source.title" class="field-input" placeholder="OpenAI Blog" aria-label="来源名称" />
                  </label>
                  <label class="field workflow-info-source-url-field">
                    <input v-model="source.url" class="field-input" placeholder="https://example.com/rss.xml" aria-label="来源 URL" />
                  </label>
                  <label class="field workflow-info-source-query-field">
                    <input v-model="source.query" class="field-input" placeholder="用于搜索/公众号关键词" aria-label="来源查询关键词" />
                  </label>
                  <label class="field workflow-info-source-tags-field">
                    <input v-model="source.tagsText" class="field-input" placeholder="AI，官方" aria-label="来源标签" />
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
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import GCompactSelect from "../../components/GCompactSelect.vue";
import GIcon from "../../components/GIcon.vue";
import FinanceKlineChart from "./FinanceKlineChart.vue";
import { INFO_RADAR_WINDOW_PRESETS } from "./workflowConfig.js";

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
  { value: "github", label: "GitHub" },
  { value: "reddit", label: "Reddit" },
  { value: "manual", label: "手工" }
];

const INFO_RADAR_STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "new", label: "未读" },
  { value: "saved", label: "已收藏" }
];

const FINANCE_RANGE_OPTIONS = [
  { value: "1d", label: "1日" },
  { value: "5d", label: "5日" },
  { value: "1mo", label: "1月" },
  { value: "3mo", label: "3月" },
  { value: "6mo", label: "6月" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1年" },
  { value: "2y", label: "2年" },
  { value: "5y", label: "5年" }
];

const FINANCE_INTERVAL_OPTIONS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "60m", label: "1h" },
  { value: "1d", label: "日线" },
  { value: "1wk", label: "周线" },
  { value: "1mo", label: "月线" }
];
const FINANCE_BRIEF_QUERY_DEBOUNCE_MS = 120;
const FINANCE_BRIEF_AUTO_REFRESH_MS = 15_000;

const infoRadarPresets = INFO_RADAR_WINDOW_PRESETS;

const WORKFLOW_STEP_MODE_OPTIONS = [
  { value: "once", label: "单次" },
  { value: "polling", label: "轮询" }
];

function getWorkflowCardIconName(entry) {
  if (entry?.kind === "info-radar") {
    return "stats";
  }

  if (entry?.kind === "finance-brief") {
    return "lineChart";
  }

  if (entry?.kind === "live-stream") {
    return "video";
  }

  return "fileText";
}

function getWorkflowBodyStepSelectOptions(entries = []) {
  return entries.map((entry) => ({
    value: entry.id,
    label: `${entry.label} · ${entry.method}`
  }));
}

const props = defineProps({
  ui: { type: Object, required: true },
  workbench: { type: Object, required: true },
  workflowLibraryCards: { type: Array, default: () => [] },
  workflowDetailTitle: { type: String, default: "流程中心" },
  activeInfoReaderItem: { type: Object, default: null },
  activeInfoWindow: { type: Object, default: null },
  activeInfoWindows: { type: Array, default: () => [] },
  filteredInfoRadarItems: { type: Array, default: () => [] },
  filteredInfoRadarItemsByStatus: { type: Array, default: () => [] },
  infoRadarMetrics: { type: Object, default: () => ({ windowCount: 0, itemCount: 0, sourceCount: 0, activeSourceCount: 0, activeItemCount: 0 }) },
  infoRadarSourceFilterOptions: { type: Array, default: () => [] },
  infoRadarTopicFilterOptions: { type: Array, default: () => [] },
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
  activeFinanceBrief: { type: Object, default: null },
  activeFinanceSymbols: { type: Array, default: () => [] },
  activeFinanceSymbol: { type: Object, default: null },
  activeFinanceSnapshot: { type: Object, default: null },
  activeFinanceChartRows: { type: Array, default: () => [] },
  activeFinanceChartAxis: { type: Object, default: () => ({ priceTicks: [], timeTicks: [] }) },
  activeFinanceChartBounds: { type: Object, default: () => ({ high: "--", low: "--", count: 0 }) },
  activeFinanceChartSummary: { type: Object, default: () => ({ rangeLabel: "暂无可视区间", durationLabel: "覆盖 --", pointLabel: "0 根 K 线", timeZoneLabel: "交易所时区 --" }) },
  financeBriefSymbolOptions: { type: Array, default: () => [] },
  activeLiveStreamConfig: { type: Object, default: null },
  activeLiveStreamSource: { type: Object, default: null },
  activeLiveStreamSources: { type: Array, default: () => [] },
  liveStreamPlatformOptions: { type: Array, default: () => [] },
  liveStreamInputPlaceholder: { type: String, default: "输入直播间 URL" },
  addInfoRadarSourceDraft: { type: Function, required: true },
  applyInfoRadarPreset: { type: Function, required: true },
  addWorkflowDraftEnvironment: { type: Function, required: true },
  addWorkflowDraftStep: { type: Function, required: true },
  addWorkflowStepOutput: { type: Function, required: true },
  cancelActiveWorkflowRun: { type: Function, required: true },
  deleteInfoRadarWindow: { type: Function, required: true },
  deleteWorkflowRecord: { type: Function, required: true },
  duplicateWorkflowRecord: { type: Function, required: true },
  canOpenInfoRadarItem: { type: Function, required: true },
  formatFinanceBriefCompactNumber: { type: Function, required: true },
  formatFinanceBriefNumber: { type: Function, required: true },
  formatFinanceBriefPercent: { type: Function, required: true },
  formatFinanceBriefQuoteDateTime: { type: Function, required: true },
  formatFinanceBriefSignedNumber: { type: Function, required: true },
  formatDurationMs: { type: Function, required: true },
  formatLocalDateTime: { type: Function, required: true },
  getFinanceBriefChangeTone: { type: Function, required: true },
  getFinanceBriefIntervalLabel: { type: Function, required: true },
  getFinanceBriefRangeLabel: { type: Function, required: true },
  getFinanceBriefSymbolLabel: { type: Function, required: true },
  getInfoRadarCadenceLabel: { type: Function, required: true },
  getInfoRadarItemHref: { type: Function, required: true },
  getInfoRadarItemSummaryText: { type: Function, required: true },
  getInfoRadarItemStatusLabel: { type: Function, required: true },
  getInfoRadarRunStatusLabel: { type: Function, required: true },
  getInfoRadarRunStatusTone: { type: Function, required: true },
  getInfoRadarScorePercent: { type: Function, required: true },
  getInfoRadarSourceKindLabel: { type: Function, required: true },
  getInfoRadarSourceTone: { type: Function, required: true },
  getLiveStreamPlatformLabel: { type: Function, required: true },
  getLiveStreamSourceLabel: { type: Function, required: true },
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
  handleInfoRadarReaderLoadingEnd: { type: Function, required: true },
  handleInfoRadarReaderLoadingStart: { type: Function, required: true },
  handleLiveStreamLoadingEnd: { type: Function, required: true },
  handleLiveStreamLoadingStart: { type: Function, required: true },
  isWorkflowStepExpanded: { type: Function, required: true },
  openInfoRadarWindow: { type: Function, required: true },
  openInfoRadarWindowEditor: { type: Function, required: true },
  openInfoRadarItemExternal: { type: Function, required: true },
  openInfoRadarItemReader: { type: Function, required: true },
  openLiveStreamExternal: { type: Function, required: true },
  openLiveStreamFromInput: { type: Function, required: true },
  openLiveStreamSource: { type: Function, required: true },
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
  refreshLiveStreamView: { type: Function, required: true },
  queryActiveFinanceBrief: { type: Function, required: true },
  runActiveWorkflowRecord: { type: Function, required: true },
  saveInfoRadarWindow: { type: Function, required: true },
  saveLiveStreamInputAsSource: { type: Function, required: true },
  markInfoRadarItemStatus: { type: Function, required: true },
  saveWorkflowRecord: { type: Function, required: true },
  selectFinanceBriefSymbol: { type: Function, required: true },
  selectWorkflowEnvironment: { type: Function, required: true },
  syncWorkflowBodyDraftFromActiveStep: { type: Function, required: true },
  toggleWorkflowStepExpanded: { type: Function, required: true }
});

const infoReaderFrameRef = ref(null);
const liveStreamFrameRef = ref(null);
const financeFocusMode = ref(false);
const financeShowMa5 = ref(false);
const financeShowMa20 = ref(false);
const financeShowVolume = ref(true);
const financeBriefClock = ref(Date.now());
const desktopApi = window.gordonDesktop ?? null;
let infoReaderResizeObserver = null;
let infoReaderEventListenerId = null;
let infoReaderBoundsAnimationFrame = 0;
let infoReaderBoundsRetryTimer = 0;
let liveStreamResizeObserver = null;
let liveStreamEventListenerId = null;
let liveStreamBoundsAnimationFrame = 0;
let liveStreamBoundsRetryTimer = 0;
let financeBriefQueryTimer = 0;
let financeBriefAutoRefreshTimer = 0;
let financeBriefClockTimer = 0;

function isFinanceIntradayInterval(interval) {
  return ["1m", "5m", "15m", "30m", "60m"].includes(interval);
}

function selectFinanceRange(range) {
  if (props.ui.workflow.financeRange === range) {
    return;
  }

  props.ui.workflow.financeRange = range;

  if (isFinanceIntradayInterval(props.ui.workflow.financeInterval) && !["1d", "5d", "1mo"].includes(range)) {
    props.ui.workflow.financeInterval = "1d";
  }

  scheduleFinanceBriefQuery();
}

function selectFinanceInterval(interval) {
  if (props.ui.workflow.financeInterval === interval) {
    return;
  }

  props.ui.workflow.financeInterval = interval;

  if (isFinanceIntradayInterval(interval) && !["1d", "5d", "1mo"].includes(props.ui.workflow.financeRange)) {
    props.ui.workflow.financeRange = "1d";
  }

  scheduleFinanceBriefQuery();
}

function clearFinanceBriefQueryTimer() {
  if (!financeBriefQueryTimer) {
    return;
  }

  window.clearTimeout(financeBriefQueryTimer);
  financeBriefQueryTimer = 0;
}

function clearFinanceBriefAutoRefreshTimer() {
  if (!financeBriefAutoRefreshTimer) {
    return;
  }

  window.clearTimeout(financeBriefAutoRefreshTimer);
  financeBriefAutoRefreshTimer = 0;
}

function isFinanceBriefAutoRefreshActive() {
  return props.ui.workflow.view === "finance" && document.visibilityState !== "hidden";
}

function scheduleFinanceBriefQuery() {
  clearFinanceBriefQueryTimer();

  financeBriefQueryTimer = window.setTimeout(() => {
    financeBriefQueryTimer = 0;

    if (props.ui.workflow.isQueryingFinanceBrief) {
      scheduleFinanceBriefQuery();
      return;
    }

    void props.queryActiveFinanceBrief();
  }, FINANCE_BRIEF_QUERY_DEBOUNCE_MS);
  scheduleFinanceBriefAutoRefresh();
}

function scheduleFinanceBriefAutoRefresh(delay = FINANCE_BRIEF_AUTO_REFRESH_MS) {
  clearFinanceBriefAutoRefreshTimer();

  if (!isFinanceBriefAutoRefreshActive()) {
    return;
  }

  financeBriefAutoRefreshTimer = window.setTimeout(async () => {
    financeBriefAutoRefreshTimer = 0;

    if (!isFinanceBriefAutoRefreshActive()) {
      return;
    }

    if (!props.ui.workflow.isQueryingFinanceBrief) {
      await props.queryActiveFinanceBrief({ silent: true, source: "auto-refresh" });
    }

    scheduleFinanceBriefAutoRefresh();
  }, delay);
}

function syncFinanceBriefAutoRefresh() {
  if (isFinanceBriefAutoRefreshActive()) {
    scheduleFinanceBriefAutoRefresh();
    return;
  }

  clearFinanceBriefAutoRefreshTimer();
}

function getFinanceBriefRefreshLabel() {
  const now = financeBriefClock.value;

  if (props.ui.workflow.isQueryingFinanceBrief) {
    return "正在同步";
  }

  const fetchedAt = new Date(props.activeFinanceSnapshot?.fetchedAt ?? "").getTime();

  if (!Number.isFinite(fetchedAt)) {
    return "自动 15s";
  }

  const ageSeconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));

  if (ageSeconds < 2) {
    return "刚刚更新";
  }

  if (ageSeconds < 60) {
    return `${ageSeconds} 秒前`;
  }

  return `${Math.floor(ageSeconds / 60)} 分钟前`;
}

function isInfoReaderBoundsReady(bounds) {
  return Boolean(bounds && bounds.width >= 120 && bounds.height >= 120);
}

function clearInfoReaderBoundsRetry() {
  if (!infoReaderBoundsRetryTimer) {
    return;
  }

  window.clearTimeout(infoReaderBoundsRetryTimer);
  infoReaderBoundsRetryTimer = 0;
}

function clearLiveStreamBoundsRetry() {
  if (!liveStreamBoundsRetryTimer) {
    return;
  }

  window.clearTimeout(liveStreamBoundsRetryTimer);
  liveStreamBoundsRetryTimer = 0;
}

function getFrameBounds(frame) {
  if (!frame) {
    return null;
  }

  const rect = frame.getBoundingClientRect();

  return {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height))
  };
}

function getInfoReaderBounds() {
  return getFrameBounds(infoReaderFrameRef.value);
}

function getLiveStreamBounds() {
  return getFrameBounds(liveStreamFrameRef.value);
}

function syncInfoReaderBounds() {
  const bounds = getInfoReaderBounds();

  if (!isInfoReaderBoundsReady(bounds) || !desktopApi?.setInfoRadarReaderBounds) {
    return;
  }

  void desktopApi.setInfoRadarReaderBounds(bounds);
}

function scheduleInfoReaderBoundsSync() {
  if (infoReaderBoundsAnimationFrame) {
    cancelAnimationFrame(infoReaderBoundsAnimationFrame);
  }

  infoReaderBoundsAnimationFrame = requestAnimationFrame(() => {
    infoReaderBoundsAnimationFrame = 0;
    syncInfoReaderBounds();
  });
}

function syncLiveStreamBounds() {
  const bounds = getLiveStreamBounds();

  if (!isInfoReaderBoundsReady(bounds) || !desktopApi?.setLiveStreamViewBounds) {
    return;
  }

  void desktopApi.setLiveStreamViewBounds(bounds);
}

function scheduleLiveStreamBoundsSync() {
  if (liveStreamBoundsAnimationFrame) {
    cancelAnimationFrame(liveStreamBoundsAnimationFrame);
  }

  liveStreamBoundsAnimationFrame = requestAnimationFrame(() => {
    liveStreamBoundsAnimationFrame = 0;
    syncLiveStreamBounds();
  });
}

async function waitForInfoReaderBounds() {
  await nextTick();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bounds = getInfoReaderBounds();

    if (isInfoReaderBoundsReady(bounds)) {
      return bounds;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  return null;
}

async function waitForLiveStreamBounds() {
  await nextTick();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bounds = getLiveStreamBounds();

    if (isInfoReaderBoundsReady(bounds)) {
      return bounds;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  return null;
}

async function openNativeInfoReader() {
  let url = props.ui.workflow.infoReaderResolvedUrl || (props.activeInfoReaderItem ? props.getInfoRadarItemHref(props.activeInfoReaderItem) : "");
  const bounds = await waitForInfoReaderBounds();

  if (props.activeInfoReaderItem?.sourceKind === "wechat") {
    if (!props.ui.workflow.infoReaderResolvedUrl) {
      const cardId = props.ui.workflow.activeCardId;
      const windowId = props.ui.workflow.activeInfoWindowId;
      const itemId = props.activeInfoReaderItem.id;

      if (!desktopApi?.resolveInfoRadarWechatItemUrl || !cardId || !windowId || !itemId) {
        props.handleInfoRadarReaderLoadingEnd();
        props.ui.workflow.infoReaderError = "公众号链接需要重新检索，但当前桥接未就绪。";
        return;
      }

      props.handleInfoRadarReaderLoadingStart();

      try {
        const result = await desktopApi.resolveInfoRadarWechatItemUrl({ cardId, windowId, itemId });
        const nextCard = result?.card;

        if (nextCard && Array.isArray(props.workbench?.workflowLibrary)) {
          props.workbench.workflowLibrary = props.workbench.workflowLibrary.map((entry) => (entry.id === nextCard.id ? nextCard : entry));
        }

        props.ui.workflow.infoReaderResolvedUrl = String(result?.url ?? "").trim();
        url = props.ui.workflow.infoReaderResolvedUrl;
      } catch (error) {
        props.handleInfoRadarReaderLoadingEnd();
        props.ui.workflow.infoReaderError = error instanceof Error ? error.message : "公众号链接重新检索失败。";

        if (desktopApi?.closeInfoRadarReader) {
          await desktopApi.closeInfoRadarReader();
        }

        return;
      }
    }
  }

  if (!url || !bounds || !desktopApi?.openInfoRadarReader) {
    if (url && props.ui.workflow.view === "info-reader") {
      clearInfoReaderBoundsRetry();
      infoReaderBoundsRetryTimer = window.setTimeout(() => {
        infoReaderBoundsRetryTimer = 0;
        void openNativeInfoReader();
      }, 120);
    }
    return;
  }

  props.handleInfoRadarReaderLoadingStart();
  await desktopApi.openInfoRadarReader({ url, bounds });
  scheduleInfoReaderBoundsSync();
}

async function refreshNativeInfoReader() {
  if (props.ui.workflow.view !== "info-reader") {
    if (desktopApi?.closeInfoRadarReader) {
      await desktopApi.closeInfoRadarReader();
    }
    return;
  }

  await nextTick();
  scheduleInfoReaderBoundsSync();
  await openNativeInfoReader();
}

async function openNativeLiveStreamView() {
  const url = String(props.ui.workflow.liveStreamResolvedUrl ?? "").trim();
  const bounds = await waitForLiveStreamBounds();

  if (!url || !bounds || !desktopApi?.openLiveStreamView) {
    if (url && props.ui.workflow.view === "live-stream") {
      clearLiveStreamBoundsRetry();
      liveStreamBoundsRetryTimer = window.setTimeout(() => {
        liveStreamBoundsRetryTimer = 0;
        void openNativeLiveStreamView();
      }, 120);
    }
    return;
  }

  props.handleLiveStreamLoadingStart();
  await desktopApi.openLiveStreamView({ url, bounds });
  scheduleLiveStreamBoundsSync();
}

async function refreshNativeLiveStreamView() {
  if (props.ui.workflow.view !== "live-stream") {
    if (desktopApi?.closeLiveStreamView) {
      await desktopApi.closeLiveStreamView();
    }
    return;
  }

  await nextTick();
  scheduleLiveStreamBoundsSync();
  await openNativeLiveStreamView();
}

function handleInfoReaderEvent(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  if (payload.status === "loading") {
    props.handleInfoRadarReaderLoadingStart();
    return;
  }

  if (payload.status === "ready") {
    props.handleInfoRadarReaderLoadingEnd();
    props.ui.workflow.infoReaderError = "";
    return;
  }

  if (payload.status === "failed") {
    props.handleInfoRadarReaderLoadingEnd();
    props.ui.workflow.infoReaderError = String(payload.message ?? "来源页面加载失败，可以尝试外部打开。");
  }
}

function handleLiveStreamEvent(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  if (payload.status === "loading") {
    props.handleLiveStreamLoadingStart();
    return;
  }

  if (payload.status === "ready") {
    props.handleLiveStreamLoadingEnd();
    props.ui.workflow.liveStreamError = "";
    return;
  }

  if (payload.status === "failed") {
    props.handleLiveStreamLoadingEnd();
    props.ui.workflow.liveStreamError = String(payload.message ?? "直播页面加载失败，可以尝试外部打开。");
  }
}

onMounted(() => {
  if (desktopApi?.onInfoRadarReaderEvent) {
    infoReaderEventListenerId = desktopApi.onInfoRadarReaderEvent(handleInfoReaderEvent);
  }

  if (desktopApi?.onLiveStreamViewEvent) {
    liveStreamEventListenerId = desktopApi.onLiveStreamViewEvent(handleLiveStreamEvent);
  }

  if (typeof ResizeObserver !== "undefined") {
    infoReaderResizeObserver = new ResizeObserver(scheduleInfoReaderBoundsSync);
    liveStreamResizeObserver = new ResizeObserver(scheduleLiveStreamBoundsSync);
  }

  if (infoReaderFrameRef.value && infoReaderResizeObserver) {
    infoReaderResizeObserver.observe(infoReaderFrameRef.value);
  }

  if (liveStreamFrameRef.value && liveStreamResizeObserver) {
    liveStreamResizeObserver.observe(liveStreamFrameRef.value);
  }

  window.addEventListener("resize", scheduleInfoReaderBoundsSync);
  window.addEventListener("resize", scheduleLiveStreamBoundsSync);
  document.addEventListener("visibilitychange", syncFinanceBriefAutoRefresh);
  financeBriefClockTimer = window.setInterval(() => {
    financeBriefClock.value = Date.now();
  }, 1000);
  void refreshNativeInfoReader();
  void refreshNativeLiveStreamView();
  syncFinanceBriefAutoRefresh();
});

onBeforeUnmount(() => {
  clearInfoReaderBoundsRetry();
  clearLiveStreamBoundsRetry();
  clearFinanceBriefQueryTimer();
  clearFinanceBriefAutoRefreshTimer();

  if (financeBriefClockTimer) {
    window.clearInterval(financeBriefClockTimer);
    financeBriefClockTimer = 0;
  }

  if (infoReaderBoundsAnimationFrame) {
    cancelAnimationFrame(infoReaderBoundsAnimationFrame);
    infoReaderBoundsAnimationFrame = 0;
  }

  if (liveStreamBoundsAnimationFrame) {
    cancelAnimationFrame(liveStreamBoundsAnimationFrame);
    liveStreamBoundsAnimationFrame = 0;
  }

  window.removeEventListener("resize", scheduleInfoReaderBoundsSync);
  window.removeEventListener("resize", scheduleLiveStreamBoundsSync);
  document.removeEventListener("visibilitychange", syncFinanceBriefAutoRefresh);

  if (infoReaderResizeObserver) {
    infoReaderResizeObserver.disconnect();
    infoReaderResizeObserver = null;
  }

  if (liveStreamResizeObserver) {
    liveStreamResizeObserver.disconnect();
    liveStreamResizeObserver = null;
  }

  if (infoReaderEventListenerId && desktopApi?.offInfoRadarReaderEvent) {
    desktopApi.offInfoRadarReaderEvent(infoReaderEventListenerId);
    infoReaderEventListenerId = null;
  }

  if (liveStreamEventListenerId && desktopApi?.offLiveStreamViewEvent) {
    desktopApi.offLiveStreamViewEvent(liveStreamEventListenerId);
    liveStreamEventListenerId = null;
  }

  if (desktopApi?.closeInfoRadarReader) {
    void desktopApi.closeInfoRadarReader();
  }

  if (desktopApi?.closeLiveStreamView) {
    void desktopApi.closeLiveStreamView();
  }
});

watch(
  () => [
    props.ui.workflow.view,
    props.activeInfoReaderItem?.id,
    props.activeInfoReaderItem?.sourceKind === "wechat"
      ? props.ui.workflow.infoReaderResolvedUrl
      : props.activeInfoReaderItem
        ? props.getInfoRadarItemHref(props.activeInfoReaderItem)
        : ""
  ],
  () => {
    void refreshNativeInfoReader();
  },
  { flush: "post" }
);

watch(
  () => [
    props.ui.workflow.view,
    props.ui.workflow.liveStreamResolvedUrl,
    props.ui.workflow.liveStreamReloadKey
  ],
  () => {
    void refreshNativeLiveStreamView();
  },
  { flush: "post" }
);

watch(
  () => props.ui.workflow.view,
  syncFinanceBriefAutoRefresh,
  { flush: "post" }
);

watch(
  () => props.ui.workflow.isQueryingFinanceBrief,
  (isQuerying) => {
    if (!isQuerying) {
      syncFinanceBriefAutoRefresh();
    }
  },
  { flush: "post" }
);

watch(
  () => infoReaderFrameRef.value,
  (frame, previousFrame) => {
    if (!infoReaderResizeObserver) {
      return;
    }

    if (previousFrame) {
      infoReaderResizeObserver.unobserve(previousFrame);
    }

    if (frame) {
      infoReaderResizeObserver.observe(frame);
      scheduleInfoReaderBoundsSync();
    }
  },
  { flush: "post" }
);

watch(
  () => liveStreamFrameRef.value,
  (frame, previousFrame) => {
    if (!liveStreamResizeObserver) {
      return;
    }

    if (previousFrame) {
      liveStreamResizeObserver.unobserve(previousFrame);
    }

    if (frame) {
      liveStreamResizeObserver.observe(frame);
      scheduleLiveStreamBoundsSync();
    }
  },
  { flush: "post" }
);
</script>
