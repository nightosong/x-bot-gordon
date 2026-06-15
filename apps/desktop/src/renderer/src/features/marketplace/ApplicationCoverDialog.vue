<template>
  <Teleport to="#workspace-panel-dialog-root">
    <Transition name="gordon-dialog-fade">
      <div
        v-if="state.isDialogOpen && item"
        class="gordon-dialog-backdrop writing-export-backdrop writing-cover-backdrop application-cover-backdrop"
        @click.self="actions.closeApplicationCoverDialog"
      >
        <section class="gordon-dialog writing-cover-dialog application-cover-dialog" role="dialog" aria-modal="true" aria-label="作品封面">
          <div class="gordon-dialog-head">
            <div class="gordon-dialog-mark writing-export-mark" aria-hidden="true">封</div>
            <div>
              <p class="gordon-dialog-kicker">Cover</p>
              <h2 class="gordon-dialog-title">{{ meta.itemLabel }}封面</h2>
            </div>
            <button
              type="button"
              class="writing-cover-close-button"
              aria-label="关闭封面弹窗"
              title="关闭"
              :disabled="state.isGenerating"
              @click="actions.closeApplicationCoverDialog"
            >
              <GIcon name="close" :size="13" />
            </button>
          </div>

          <div class="writing-cover-dialog-body">
            <aside class="writing-cover-preview-panel">
              <div class="writing-cover-preview" :class="`is-${item.coverTone}`">
                <img
                  v-if="state.previewUrl"
                  :src="state.previewUrl"
                  :alt="`${item.title} 封面预览`"
                />
                <span v-else>{{ item.title?.slice(0, 1) || meta.fallbackInitial || "封" }}</span>
                <button
                  v-if="state.previewUrl"
                  type="button"
                  class="writing-cover-download-button"
                  aria-label="下载封面"
                  title="下载封面"
                  :disabled="state.isGenerating"
                  @click="actions.downloadApplicationCoverImage"
                >
                  <GIcon name="download" :size="14" />
                </button>
              </div>
              <p class="writing-cover-preview-title">{{ item.title }}</p>
            </aside>

            <section class="writing-cover-editor-panel">
              <div class="writing-cover-mode-tabs" role="tablist" aria-label="封面来源">
                <button
                  type="button"
                  class="writing-cover-mode-tab"
                  :class="{ 'is-active': state.dialogMode === 'upload' }"
                  @click="actions.setApplicationCoverDialogMode('upload')"
                >
                  上传
                </button>
                <button
                  type="button"
                  class="writing-cover-mode-tab"
                  :class="{ 'is-active': state.dialogMode === 'generate' }"
                  @click="actions.setApplicationCoverDialogMode('generate')"
                >
                  生成
                </button>
              </div>

              <div v-if="state.dialogMode === 'upload'" class="writing-cover-upload-stack">
                <label class="gordon-dialog-field writing-cover-url-field">
                  <span class="gordon-dialog-field-label">图片 URL</span>
                  <textarea
                    class="gordon-dialog-input writing-cover-url-input"
                    :value="state.urlInput"
                    placeholder="https://example.com/cover.jpg"
                    :disabled="state.isGenerating"
                    @input="actions.setApplicationCoverUrlInput($event.target.value)"
                  ></textarea>
                </label>
                <div class="writing-cover-action-row">
                  <div class="writing-cover-action-left">
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-ghost"
                      :disabled="state.isGenerating"
                      @click="actions.selectApplicationCoverLocalImage"
                    >
                      本地上传
                    </button>
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-ghost"
                      :disabled="state.isGenerating || !state.urlInput.trim()"
                      @click="actions.applyApplicationCoverUrlInput"
                    >
                      远端加载
                    </button>
                  </div>
                  <div class="writing-cover-action-right">
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-secondary"
                      :disabled="state.isGenerating"
                      @click="actions.closeApplicationCoverDialog"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-primary"
                      :disabled="state.isGenerating"
                      @click="actions.confirmApplicationCoverDialog"
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="writing-cover-generate-stack">
                <FieldAiOptimizer
                  :actions="actions.fieldAiActions"
                  :app-name="meta.appName"
                  :field-id="`application-cover-prompt-${state.appId}-${item.id}`"
                  label="封面提示词"
                  :state="fieldAiState"
                  :value="state.promptInput"
                  :context="actions.buildApplicationCoverPromptAiContext()"
                  :disabled="state.isGenerating"
                  :set-value="actions.setApplicationCoverPromptInput"
                >
                  <div class="gordon-dialog-field writing-cover-prompt-field">
                    <span class="writing-cover-prompt-head">
                      <span class="gordon-dialog-field-label">生成提示词</span>
                      <button
                        type="button"
                        class="writing-cover-title-toggle"
                        :class="{ 'is-active': state.shouldShowTitle }"
                        :aria-pressed="state.shouldShowTitle"
                        :disabled="state.isGenerating"
                        @click="actions.setApplicationCoverShouldShowTitle(!state.shouldShowTitle)"
                      >
                        <span class="writing-cover-title-toggle-dot" aria-hidden="true"></span>
                        显示标题
                      </button>
                    </span>
                    <textarea
                      class="field-textarea writing-cover-prompt-input"
                      aria-label="生成提示词"
                      :value="state.promptInput"
                      placeholder="描述封面主体、人物、场景、色彩、构图和留白区域"
                      :disabled="state.isGenerating"
                      @input="actions.setApplicationCoverPromptInput($event.target.value)"
                    ></textarea>
                  </div>
                </FieldAiOptimizer>
                <div class="writing-cover-action-row">
                  <div class="writing-cover-action-left">
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-ghost"
                      :disabled="state.isGenerating"
                      @click="actions.clearApplicationCoverImage"
                    >
                      清空封面
                    </button>
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-ghost"
                      :disabled="state.isGenerating || !state.promptInput.trim()"
                      @click="actions.generateApplicationCoverImage"
                    >
                      <GIcon :name="state.isGenerating ? 'loading' : 'sparkles'" :spin="state.isGenerating" :size="14" />
                      {{ state.isGenerating ? "生成中" : "生成封面" }}
                    </button>
                  </div>
                  <div class="writing-cover-action-right">
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-secondary"
                      :disabled="state.isGenerating"
                      @click="actions.closeApplicationCoverDialog"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="gordon-dialog-button gordon-dialog-button-primary"
                      :disabled="state.isGenerating"
                      @click="actions.confirmApplicationCoverDialog"
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import FieldAiOptimizer from "./FieldAiOptimizer.vue";
import GIcon from "../../components/GIcon.vue";

defineProps({
  actions: { type: Object, required: true },
  fieldAiState: { type: Object, required: true },
  item: { type: Object, default: null },
  meta: { type: Object, required: true },
  state: { type: Object, required: true }
});
</script>
