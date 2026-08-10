<template>
<div class="workspace-stage workspace-stage-scroll">
  <div
    class="models-shell"
    :class="{
      'models-shell-home':
        ui.modelManagement.view === 'list' ||
        ui.modelManagement.view === 'picker' ||
        ui.modelManagement.view === 'editor' ||
        ui.modelManagement.view === 'usage',
      'models-shell-ledger': ui.modelManagement.view === 'list',
      'models-shell-usage': ui.modelManagement.view === 'usage'
    }"
  >
    <section v-if="ui.modelManagement.view === 'list'" class="models-hero">
      <div>
        <p class="feature-kicker">模型名册</p>
        <p class="models-title">模型管理</p>
      </div>
      <div class="models-hero-metrics" aria-label="模型配置概览">
        <span class="models-metric-chip models-metric-chip-primary">
          <GIcon name="sparkles" :size="14" />
          <span class="models-metric-copy">
            <small>默认模型</small>
            <strong>{{ activeModelProfile?.displayName ?? "未设置" }}</strong>
          </span>
        </span>
        <span class="models-metric-chip">
          <span class="models-metric-copy">
            <small>配置</small>
            <strong>{{ workbench.modelSettings.profiles.length }} 条</strong>
          </span>
        </span>
        <span class="models-metric-chip">
          <span class="models-metric-copy">
            <small>供应商</small>
            <strong>{{ configuredProviderCount }} 个</strong>
          </span>
        </span>
      </div>
    </section>

    <div
      class="models-grid models-grid-single"
      :class="{
        'models-grid-subpage':
          ui.modelManagement.view === 'picker' ||
          ui.modelManagement.view === 'editor' ||
          ui.modelManagement.view === 'usage'
      }"
    >
      <section v-if="ui.modelManagement.view === 'list'" class="model-section">
        <div class="model-section-head">
          <div>
            <p class="feature-kicker">已配置</p>
            <p class="model-section-title">已配置列表</p>
          </div>

          <div class="model-section-actions">
            <span class="pill pill-neutral model-count-pill">
              <GIcon name="stats" :size="13" />
              {{ workbench.modelSettings.profiles.length }} 条配置
            </span>
            <button
              type="button"
              class="model-icon-button model-add-config-button"
              aria-label="添加新配置"
              title="添加新配置"
              @click="openModelCreatePicker"
            >
              <GIcon name="add" :size="15" />
            </button>
          </div>
        </div>

        <div class="model-section-body model-configured-list">
          <div v-if="!workbench.modelSettings.profiles.length" class="model-empty">
            <p class="model-empty-copy">
              当前还没有任何已配置模型。点击右上角加号选择供应商并保存一条配置，之后就能在这里启用或编辑。
            </p>
          </div>

          <article
            v-for="(profile, profileIndex) in workbench.modelSettings.profiles"
            :key="profile.id"
            class="model-config-card model-config-draggable-card"
            :class="{
              'is-model-preferred': isActiveModelProfile(profile),
              'is-model-dragging': draggingModelProfileId === profile.id,
              'is-model-drag-over-before':
                dragOverModelProfileId === profile.id &&
                dragOverModelProfilePlacement === 'before' &&
                draggingModelProfileId !== profile.id,
              'is-model-drag-over-after':
                dragOverModelProfileId === profile.id &&
                dragOverModelProfilePlacement === 'after' &&
                draggingModelProfileId !== profile.id
            }"
            @dragenter="handleModelProfileDragOver($event, profile.id)"
            @dragover="handleModelProfileDragOver($event, profile.id)"
            @dragleave="handleModelProfileDragLeave($event, profile.id)"
            @drop="handleModelProfileDrop($event, profile.id)"
          >
            <div class="model-config-head">
              <div class="model-config-main">
                <button
                  type="button"
                  class="model-drag-handle"
                  :draggable="workbench.modelSettings.profiles.length > 1"
                  :disabled="workbench.modelSettings.profiles.length < 2"
                  :aria-label="`拖动调整 ${profile.displayName} 的排序`"
                  :title="workbench.modelSettings.profiles.length > 1 ? '拖动调整顺序' : '至少需要两条配置才能排序'"
                  @click.stop
                  @dragstart="handleModelProfileDragStart($event, profile.id)"
                  @dragend="handleModelProfileDragEnd"
                >
                  <GIcon name="grip" :size="18" :stroke-width="2.15" />
                </button>

                <span class="model-card-rank" aria-hidden="true">
                  {{ String(profileIndex + 1).padStart(2, "0") }}
                </span>

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

                <div class="model-card-identity">
                  <div class="model-card-title-row">
                    <p class="model-card-title">{{ profile.displayName }}</p>
                    <span v-if="isActiveModelProfile(profile)" class="model-default-badge">
                      <GIcon name="sparkles" :size="12" />
                      默认
                    </span>
                  </div>
                  <p class="model-card-meta">
                    <span class="model-card-provider">{{ getProviderMeta(profile.provider).label }}</span>
                    <span class="model-card-meta-separator">/</span>
                    <span class="model-card-code">{{ profile.model }}</span>
                  </p>
                  <div class="model-card-capabilities" aria-label="接口能力">
                    <span class="model-card-mode">
                      {{ profile.apiFormat === "responses" ? "Responses" : "Chat" }}
                    </span>
                    <span class="model-card-mode" :class="{ 'is-sync': profile.supportsStreaming === false }">
                      {{ profile.supportsStreaming === false ? "标准" : "流式" }}
                    </span>
                    <span class="model-card-health">
                      <i aria-hidden="true"></i>
                      已就绪
                    </span>
                  </div>
                </div>
              </div>

              <div class="model-card-actions model-card-actions-inline">
                <div v-if="hasModelBalanceQuery(profile)" class="model-balance-widget">
                  <span class="model-balance-time">
                    {{
                      isModelBalanceRefreshing(profile.id)
                        ? "查询中..."
                        : getModelBalanceSnapshot(profile)?.queriedAt
                          ? `更新于 ${formatLocalDateTime(getModelBalanceSnapshot(profile).queriedAt)}`
                          : "未查询"
                    }}
                  </span>
                  <p v-if="getModelBalanceSnapshot(profile)" class="model-balance-widget-copy">
                    <span class="model-balance-used">已使用 {{ formatBalanceNumber(getModelBalanceSnapshot(profile).used) }}</span>
                    <span class="model-balance-remaining">
                      剩余 {{ formatBalanceNumber(getModelBalanceSnapshot(profile).remaining) }} {{ getModelBalanceSnapshot(profile).unit }}
                    </span>
                  </p>
                  <p v-else class="model-balance-widget-placeholder">点击刷新查询余额</p>
                  <div class="model-balance-widget-actions">
                    <button
                      type="button"
                      class="model-icon-button model-balance-refresh-button model-balance-stats-button"
                      :aria-label="`查看 ${profile.displayName} 的用量统计`"
                      title="用量统计"
                      @click.stop="openModelUsageStats(profile)"
                    >
                      <GIcon name="stats" />
                    </button>
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
                </div>

                <div class="model-card-command-cluster" aria-label="模型操作">
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
                    class="model-status-toggle model-default-radio"
                    :class="{ 'is-active': isActiveModelProfile(profile) }"
                    :aria-pressed="isActiveModelProfile(profile) ? 'true' : 'false'"
                    :title="isActiveModelProfile(profile) ? '取消默认模型' : '设为默认模型'"
                    :aria-label="isActiveModelProfile(profile) ? `${profile.displayName} 当前为默认模型` : `设 ${profile.displayName} 为默认模型`"
                    @click="handleModelStatusToggle(profile.id)"
                  >
                    <GIcon name="sparkles" :size="15" :stroke-width="2.1" />
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
            </div>

            <p v-if="profile.notes" class="model-card-copy">{{ profile.notes }}</p>
          </article>
        </div>
      </section>

      <section v-else-if="ui.modelManagement.view === 'usage'" class="model-section model-section-scroll model-subpage-section">
        <div class="model-editor model-editor-unified model-usage-panel">
          <div class="workflow-library-detail-head model-subpage-head">
            <div class="workflow-library-detail-head-side">
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

            <div class="workflow-library-detail-head-center">
              <p class="workflow-library-detail-title">数据统计</p>
            </div>

            <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
              <span
                v-if="activeModelUsageProfile"
                class="model-usage-profile-badge"
                :title="`${activeModelUsageProfile.displayName} / ${getProviderMeta(activeModelUsageProfile.provider).label} / ${activeModelUsageProfile.model}`"
              >
                <span class="model-usage-profile-copy">
                  <span>{{ getProviderMeta(activeModelUsageProfile.provider).label }}</span>
                  <strong>{{ activeModelUsageProfile.displayName }}</strong>
                </span>
              </span>
            </div>
          </div>

          <div v-if="activeModelUsageProfile" class="model-usage-content">
            <div class="model-usage-summary-grid">
              <article class="model-usage-metric">
                <span>近 30 天消耗</span>
                <strong>{{ formatBalanceNumber(modelUsageSummary.totalUsed) }} {{ modelUsageSummary.unit }}</strong>
              </article>
              <article class="model-usage-metric">
                <span>日均消耗</span>
                <strong>{{ formatBalanceNumber(modelUsageSummary.averageUsed) }} {{ modelUsageSummary.unit }}</strong>
              </article>
              <article class="model-usage-metric">
                <span>峰值日</span>
                <strong>{{ formatBalanceNumber(modelUsageSummary.maxUsed) }} {{ modelUsageSummary.unit }}</strong>
              </article>
              <article class="model-usage-metric">
                <span>最新账面</span>
                <strong>{{ modelUsageSummary.latestUsageText }}</strong>
              </article>
            </div>

            <section class="model-usage-chart-card">
              <div class="model-usage-card-head">
                <div>
                  <p class="feature-kicker">用量记录</p>
                  <p class="model-section-title">近 30 天每日用量</p>
                </div>
                <button
                  type="button"
                  class="model-icon-button model-usage-refresh-button"
                  :class="{ 'is-loading': isModelBalanceRefreshing(activeModelUsageProfile.id) }"
                  :disabled="isModelBalanceRefreshing(activeModelUsageProfile.id)"
                  :aria-label="`刷新 ${activeModelUsageProfile.displayName} 的余额`"
                  title="刷新余额"
                  @click="handleModelBalanceRefresh(activeModelUsageProfile)"
                >
                  <GIcon name="refresh" />
                </button>
              </div>

              <div v-if="isActiveModelUsageLoading" class="model-empty">
                <p class="model-empty-copy">正在加载用量历史...</p>
              </div>

              <div v-else-if="activeModelUsageError" class="model-empty model-usage-error">
                <p class="model-empty-copy">{{ activeModelUsageError }}</p>
              </div>

              <template v-else>
                <div class="model-usage-chart" aria-label="近 30 天每日模型用量">
                  <div
                    v-for="day in modelUsageDailySeries"
                    :key="day.dateKey"
                    class="model-usage-day"
                    :title="`${day.label}：${formatBalanceNumber(day.used)} ${day.unit}`"
                  >
                    <div class="model-usage-bar-track">
                      <span class="model-usage-bar-fill" :style="{ height: getModelUsageBarHeight(day) }"></span>
                    </div>
                    <span class="model-usage-day-label">{{ day.shortLabel }}</span>
                  </div>
                </div>

                <div class="model-usage-daily-list">
                  <div v-for="day in modelUsageDailyListSeries" :key="`${day.dateKey}-row`" class="model-usage-row">
                    <span>{{ day.label }}</span>
                    <strong>{{ formatBalanceNumber(day.used) }} / {{ formatOptionalBalanceNumber(day.remaining) }}</strong>
                  </div>
                </div>
              </template>
            </section>
          </div>

          <div v-else class="model-empty">
            <p class="model-empty-copy">当前模型配置不存在，返回列表后重新选择。</p>
          </div>
        </div>
      </section>

      <section v-else-if="ui.modelManagement.view === 'picker'" class="model-section model-section-scroll model-subpage-section">
        <div class="model-editor model-editor-unified model-provider-picker-panel">
          <div class="workflow-library-detail-head model-subpage-head">
            <div class="workflow-library-detail-head-side">
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

            <div class="workflow-library-detail-head-center">
              <p class="workflow-library-detail-title">选择供应商</p>
            </div>

            <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end"></div>
          </div>

          <div v-if="providerOptions.length" class="provider-picker-grid model-provider-picker-body">
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

              <span class="provider-picker-content">
                <span class="provider-picker-name">{{ provider.label }}</span>
                <span class="provider-picker-copy">{{ provider.copy }}</span>
              </span>
            </button>
          </div>

          <div v-else class="model-empty">
            <p class="model-empty-copy">暂时没有可选供应商。</p>
          </div>
        </div>
      </section>

      <section v-else class="model-section model-section-scroll model-subpage-section">
        <div class="model-editor model-editor-unified">
          <div class="workflow-library-detail-head model-subpage-head">
            <div class="workflow-library-detail-head-side">
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

            <div class="workflow-library-detail-head-center">
              <p class="workflow-library-detail-title">编辑配置</p>
            </div>

            <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
              <span class="pill pill-neutral">{{ getProviderMeta(ui.modelManagement.editor.provider).label }}</span>
            </div>
          </div>

          <form class="model-form" @submit.prevent="handleModelEditorSave" @input="markModelEditorDirty" @change="markModelEditorDirty">
            <template v-for="field in modelEditorFields" :key="field.key">
              <div v-if="field.key === 'baseUrl'" class="model-endpoint-control-row field-full">
                <label class="field model-endpoint-input-field">
                  <span class="field-label">{{ field.label }}</span>
                  <input
                    v-model="ui.modelManagement.editor.values[field.key]"
                    class="field-input"
                    :placeholder="field.placeholder"
                    :required="field.required"
                  />
                </label>

                <div class="field model-api-options-field">
                  <span class="field-label">接口格式</span>
                  <div class="model-api-options-controls">
                    <GCompactSelect
                      v-model="ui.modelManagement.editor.values.apiFormat"
                      class="model-api-format-select"
                      aria-label="接口格式"
                      :options="MODEL_API_FORMAT_OPTIONS"
                      @change="markModelEditorDirty"
                    />
                    <label class="model-input-side-toggle">
                      <input v-model="ui.modelManagement.editor.values.supportsStreaming" type="checkbox" />
                      <span>流式输出</span>
                    </label>
                  </div>
                </div>
              </div>

              <component
                v-else
                :is="field.key === 'apiKey' ? 'div' : 'label'"
                class="field"
                :class="{
                  'field-full': field.full,
                  'model-config-endpoint-field': field.key === 'baseUrl' || field.key === 'apiKey'
                }"
              >
                <span class="field-label">{{ field.label }}</span>

                <textarea
                  v-if="field.textarea"
                  v-model="ui.modelManagement.editor.values[field.key]"
                  class="field-textarea"
                  :placeholder="field.placeholder"
                ></textarea>

                <div v-else-if="field.key === 'apiKey'" class="field-secret-input">
                  <input
                    v-model="ui.modelManagement.editor.values[field.key]"
                    class="field-input"
                    :type="ui.modelManagement.editor.apiKeyVisible ? 'text' : 'password'"
                    :placeholder="field.placeholder"
                    :required="field.required"
                  />
                  <button
                    type="button"
                    class="model-icon-button field-secret-toggle"
                    :aria-label="ui.modelManagement.editor.apiKeyVisible ? '隐藏 API Key' : '显示 API Key'"
                    :title="ui.modelManagement.editor.apiKeyVisible ? '隐藏 API Key' : '显示 API Key'"
                    @click="ui.modelManagement.editor.apiKeyVisible = !ui.modelManagement.editor.apiKeyVisible"
                  >
                    <GIcon :name="ui.modelManagement.editor.apiKeyVisible ? 'eyeOff' : 'eye'" />
                  </button>
                </div>

                <input
                  v-else
                  v-model="ui.modelManagement.editor.values[field.key]"
                  class="field-input"
                  :placeholder="field.placeholder"
                  :required="field.required"
                />
              </component>
            </template>

            <div class="field field-full">
              <div class="balance-field-head">
                <span class="field-label">余额查询提取器代码</span>
                <div class="balance-field-actions">
                  <button type="button" class="model-action-secondary model-editor-mini-action" @click="fillModelBalanceQueryTemplate">
                    填充示例
                  </button>
                  <button
                    type="button"
                    class="model-action-secondary model-editor-mini-action"
                    :disabled="ui.modelManagement.editor.isBalanceQuerying"
                    @click="handleModelEditorBalanceQuery"
                  >
                    {{ ui.modelManagement.editor.isBalanceQuerying ? "查询中..." : "查询余额" }}
                  </button>
                </div>
              </div>

              <textarea
                v-model="ui.modelManagement.editor.values.balanceQueryCode"
                class="field-textarea model-balance-code-textarea"
                placeholder="({ request: { url: 'https://xxxxx', method: 'GET' }, extractor: function (raw) { return { remaining: 0, used: 0, unit: 'USD' }; } });"
              ></textarea>

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
                  @click="selectPopularModel(model)"
                >
                  {{ model }}
                </button>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="model-action-secondary model-editor-mini-action" @click.prevent="backModelManagement">
                取消
              </button>
              <button
                type="button"
                class="model-action model-editor-mini-action model-editor-save-button"
                :class="{ 'is-saved': ui.modelManagement.editor.saveState === 'saved' }"
                :disabled="ui.modelManagement.editor.isSaving"
                @click.prevent="handleModelEditorSave"
              >
                <GIcon
                  v-if="ui.modelManagement.editor.isSaving || ui.modelManagement.editor.saveState === 'saved'"
                  :name="ui.modelManagement.editor.isSaving ? 'loading' : 'check'"
                  :spin="ui.modelManagement.editor.isSaving"
                  :size="12"
                />
                {{ ui.modelManagement.editor.isSaving ? "保存中" : "保存" }}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  </div>
</div>
</template>

<script setup>
import { computed, ref } from "vue";

import GCompactSelect from "../../components/GCompactSelect.vue";
import GIcon from "../../components/GIcon.vue";

const MODEL_API_FORMAT_OPTIONS = [
  { value: "chat_completions", label: "Chat" },
  { value: "responses", label: "Responses" }
];

const props = defineProps({
  ui: { type: Object, required: true },
  workbench: { type: Object, required: true },
  activeModelUsageProfile: { type: Object, default: null },
  activeModelUsageError: { type: String, default: "" },
  isActiveModelUsageLoading: { type: Boolean, default: false },
  modelUsageSummary: { type: Object, default: () => ({}) },
  modelUsageDailySeries: { type: Array, default: () => [] },
  modelUsageDailyListSeries: { type: Array, default: () => [] },
  providerOptions: { type: Array, default: () => [] },
  modelEditorFields: { type: Array, default: () => [] },
  backModelManagement: { type: Function, required: true },
  fillModelBalanceQueryTemplate: { type: Function, required: true },
  formatBalanceNumber: { type: Function, required: true },
  formatLocalDateTime: { type: Function, required: true },
  formatOptionalBalanceNumber: { type: Function, required: true },
  getModelBalanceSnapshot: { type: Function, required: true },
  getModelUsageBarHeight: { type: Function, required: true },
  getProviderMeta: { type: Function, required: true },
  handleModelBalanceRefresh: { type: Function, required: true },
  handleModelDelete: { type: Function, required: true },
  handleModelEditorBalanceQuery: { type: Function, required: true },
  handleModelEditorSave: { type: Function, required: true },
  handleModelStatusToggle: { type: Function, required: true },
  hasModelBalanceQuery: { type: Function, required: true },
  isModelBalanceRefreshing: { type: Function, required: true },
  markModelEditorDirty: { type: Function, required: true },
  openModelCreatePicker: { type: Function, required: true },
  openModelEditor: { type: Function, required: true },
  openModelUsageStats: { type: Function, required: true },
  selectModelProvider: { type: Function, required: true },
  selectPopularModel: { type: Function, required: true }
});

const emit = defineEmits(["reorder-model-profiles"]);
const draggingModelProfileId = ref("");
const dragOverModelProfileId = ref("");
const dragOverModelProfilePlacement = ref("before");
const activeModelProfile = computed(
  () =>
    props.workbench.modelSettings.profiles.find((profile) => profile.id === props.workbench.modelSettings.activeProfileId) ??
    null
);
const configuredProviderCount = computed(() => new Set(props.workbench.modelSettings.profiles.map((profile) => profile.provider)).size);

function isActiveModelProfile(profile) {
  return props.workbench.modelSettings.activeProfileId === profile.id;
}

function updateModelProfileDragPlacement(event, profileId) {
  if (!draggingModelProfileId.value || draggingModelProfileId.value === profileId) {
    return;
  }

  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  const targetElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const targetRect = targetElement?.getBoundingClientRect();
  dragOverModelProfileId.value = profileId;
  dragOverModelProfilePlacement.value =
    targetRect && event.clientY > targetRect.top + targetRect.height / 2 ? "after" : "before";
}

function handleModelProfileDragStart(event, profileId) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", profileId);

    const dragSource = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const dragCard = dragSource?.closest(".model-config-draggable-card");
    if (dragCard instanceof HTMLElement) {
      const dragCardRect = dragCard.getBoundingClientRect();
      const dragImageOffsetX = Math.max(0, Math.min(event.clientX - dragCardRect.left, dragCardRect.width));
      const dragImageOffsetY = Math.max(0, Math.min(event.clientY - dragCardRect.top, dragCardRect.height));
      event.dataTransfer.setDragImage(dragCard, dragImageOffsetX, dragImageOffsetY);
    }
  }

  draggingModelProfileId.value = profileId;
  dragOverModelProfileId.value = "";
  dragOverModelProfilePlacement.value = "before";
}

function handleModelProfileDragOver(event, profileId) {
  updateModelProfileDragPlacement(event, profileId);
}

function handleModelProfileDragLeave(event, profileId) {
  if (
    event.currentTarget instanceof Node &&
    event.relatedTarget instanceof Node &&
    event.currentTarget.contains(event.relatedTarget)
  ) {
    return;
  }

  if (dragOverModelProfileId.value === profileId) {
    dragOverModelProfileId.value = "";
  }
}

function handleModelProfileDragDropReset() {
  draggingModelProfileId.value = "";
  dragOverModelProfileId.value = "";
  dragOverModelProfilePlacement.value = "before";
}

function handleModelProfileDrop(event, targetProfileId) {
  updateModelProfileDragPlacement(event, targetProfileId);

  const sourceProfileId = draggingModelProfileId.value || event.dataTransfer?.getData("text/plain") || "";
  const placement = dragOverModelProfilePlacement.value;
  handleModelProfileDragDropReset();

  if (!sourceProfileId || sourceProfileId === targetProfileId) {
    return;
  }

  emit("reorder-model-profiles", {
    sourceProfileId,
    targetProfileId,
    placement
  });
}

function handleModelProfileDragEnd() {
  handleModelProfileDragDropReset();
}
</script>
