<template>
  <section class="writing-detail-shell fortune-detail-shell">
    <header class="writing-detail-head fortune-detail-head">
      <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backFortuneMarketplace">
        <GIcon name="return" />
      </button>

      <div class="writing-detail-title">
        <p class="fortune-title-text">{{ FORTUNE_APP_NAME }}</p>
      </div>

      <div class="model-section-actions">
        <span class="pill">{{ activeFortuneModeMeta.label }}</span>
        <span class="pill pill-neutral">灵感参考</span>
      </div>
    </header>

    <section class="fortune-workbench">
      <aside class="fortune-rail">
        <div class="fortune-mark-large" aria-hidden="true">
          <span>灵</span>
        </div>

        <div class="fortune-mode-list" role="tablist" aria-label="灵犀照命解读类型">
          <button
            v-for="mode in FORTUNE_READING_MODES"
            :key="mode.id"
            type="button"
            class="fortune-mode-button"
            :class="{ 'is-active': ui.marketplace.fortune.activeMode === mode.id }"
            :aria-selected="ui.marketplace.fortune.activeMode === mode.id ? 'true' : 'false'"
            @click="setFortuneMode(mode.id)"
          >
            <span>{{ mode.kicker }}</span>
            <strong>{{ mode.label }}</strong>
          </button>
        </div>
      </aside>

      <main class="fortune-main-stage fortune-chat-stage">
        <article class="writing-editor-card fortune-chat-card">
          <div class="fortune-chat-head">
            <div>
              <p class="feature-kicker">{{ activeFortuneModeMeta.kicker }}</p>
              <p class="model-section-title">{{ activeFortuneModeMeta.label }}</p>
            </div>
            <div class="fortune-chat-tools">
              <div class="fortune-method-strip" aria-label="当前解读框架">
                <span v-for="method in activeFortuneMethodLabels" :key="method" class="fortune-method-chip">{{ method }}</span>
              </div>
              <button
                type="button"
                class="model-icon-button fortune-clear-button"
                title="清空对话"
                aria-label="清空对话"
                :disabled="ui.marketplace.fortune.isGenerating || !ui.marketplace.fortune.messages?.length"
                @click="clearFortuneReading"
              >
                <GIcon name="close" :size="15" />
              </button>
            </div>
          </div>

          <div class="fortune-chat-scroll">
            <div v-if="!ui.marketplace.fortune.messages?.length" class="fortune-chat-empty">
              <strong>先说出你想问的事。</strong>
              <span>可以直接问今天运势、事业财运、感情关系，也可以上传手相、面相、户型或工位照片。灵犀会先追问必要信息，再给卦名和解读。</span>
            </div>

            <div v-else class="fortune-message-stream">
              <article
                v-for="message in ui.marketplace.fortune.messages || []"
                :key="message.id"
                class="fortune-message"
                :class="[`is-${message.role}`, message.state ? `is-${message.state}` : '']"
              >
                <div class="fortune-message-meta">
                  <span>{{ message.role === "user" ? "你" : FORTUNE_APP_NAME }}</span>
                  <small>{{ message.modeLabel || activeFortuneModeMeta.label }} · {{ formatFortuneTime(message.createdAt) }}</small>
                </div>
                <div class="fortune-message-text command-rich-text fortune-rich-text" v-html="renderRichText(message.content)"></div>
                <div v-if="message.attachments?.length" class="fortune-message-attachments">
                  <span
                    v-for="attachment in message.attachments"
                    :key="attachment.id"
                    class="fortune-attachment-chip"
                    :class="{ 'is-image': attachment.kind === 'image', 'is-error': attachment.readStatus === 'error' }"
                  >
                    {{ attachment.kind === "image" ? "图片" : "附件" }} · {{ attachment.name }}
                  </span>
                </div>
              </article>

              <article v-if="ui.marketplace.fortune.isGenerating" class="fortune-message is-assistant is-pending">
                <div class="fortune-message-meta">
                  <span>{{ FORTUNE_APP_NAME }}</span>
                  <small>正在推演</small>
                </div>
                <p class="fortune-thinking">
                  <span></span>
                  <span></span>
                  <span></span>
                </p>
              </article>
            </div>
          </div>

          <p
            v-if="ui.marketplace.fortune.feedback"
            class="writing-export-feedback fortune-feedback"
            :class="getFortuneFeedbackClass()"
            role="status"
          >
            {{ ui.marketplace.fortune.feedback }}
          </p>

          <div class="fortune-composer">
            <AiAssistantActionBar
              label="对话处理"
              bar-class="fortune-action-bar"
              :status-class="getFortuneFeedbackClass()"
              :status-message="fortuneAiOutputStatusMessage"
              :quick-disabled="!canSendFortuneQuickMessage"
              :quick-icon="ui.marketplace.fortune.isGenerating ? 'loading' : 'enter'"
              :quick-spin="ui.marketplace.fortune.isGenerating"
              :quick-label="ui.marketplace.fortune.isGenerating ? '推演中' : '快速模式'"
              :agent-disabled="!canRunFortuneAgent"
              :on-quick-run="sendFortuneMessage"
              :on-agent-run="() => runMarketplaceAgentTask('fortune')"
            />
            <div v-if="ui.marketplace.fortune.chatAttachments?.length" class="fortune-attachment-tray">
              <span
                v-for="attachment in ui.marketplace.fortune.chatAttachments || []"
                :key="attachment.id"
                class="fortune-attachment-chip"
                :class="{ 'is-image': attachment.kind === 'image', 'is-error': attachment.readStatus === 'error' }"
              >
                <span class="fortune-attachment-name">{{ attachment.kind === "image" ? "图片" : "附件" }} · {{ attachment.name }}</span>
                <button type="button" class="fortune-attachment-remove" aria-label="移除附件" @click="removeFortuneAttachment(attachment.id)">
                  <GIcon name="close" :size="12" />
                </button>
              </span>
            </div>
            <textarea
              :value="ui.marketplace.fortune.chatInput"
              class="field-textarea fortune-chat-input"
              :placeholder="`问${activeFortuneModeMeta.label}，或补充出生时间、数字、手相/面相、户型方位...`"
              :disabled="ui.marketplace.fortune.isGenerating"
              @input="setFortuneChatInput($event.target.value)"
              @keydown.enter.exact.prevent="sendFortuneMessage"
            ></textarea>
            <button
              type="button"
              class="model-icon-button fortune-attach-button"
              title="上传图片或资料"
              aria-label="上传图片或资料"
              :disabled="ui.marketplace.fortune.isGenerating"
              @click="selectFortuneAttachments"
            >
              <GIcon name="image" :size="17" />
            </button>
          </div>

          <GordonAgentProgress
            class="marketplace-agent-progress-inline"
            :progress="fortuneAgentProgress"
            :items="fortuneAgentProgressItems"
            :progress-class="fortuneAgentProgressClass"
            :progress-time="fortuneAgentProgressTime"
            fallback-status="正在处理解读任务"
            :cancel-handler="cancelMarketplaceAgentRun"
          />
        </article>
      </main>
    </section>
  </section>
</template>

<script setup>
import { computed } from "vue";

import GIcon from "../../components/GIcon.vue";
import { renderRichText } from "../../lib/presenter.js";
import AiAssistantActionBar from "./AiAssistantActionBar.vue";
import GordonAgentProgress from "./GordonAgentProgress.vue";
import { FORTUNE_APP_NAME, FORTUNE_READING_MODES } from "./marketplaceConfig.js";

const props = defineProps({
  context: { type: Object, required: true }
});

const { fortuneActions, marketplaceAgentActions, ui } = props.context;

const {
  activeFortuneMethodLabels,
  activeFortuneModeMeta,
  backFortuneMarketplace,
  clearFortuneReading,
  formatFortuneTime,
  getFortuneFeedbackClass,
  removeFortuneAttachment,
  selectFortuneAttachments,
  sendFortuneMessage,
  setFortuneChatInput,
  setFortuneMode
} = fortuneActions;

const {
  cancelMarketplaceAgentRun,
  getMarketplaceAgentProgress,
  getMarketplaceAgentProgressItems,
  runMarketplaceAgentTask
} = marketplaceAgentActions;

const fortuneAgentProgress = computed(() => getMarketplaceAgentProgress("fortune"));
const fortuneAgentProgressItems = computed(() => getMarketplaceAgentProgressItems(fortuneAgentProgress.value));
const fortuneAgentProgressClass = computed(() => {
  const progress = fortuneAgentProgress.value;

  if (!progress) {
    return "";
  }

  if (progress.phase === "completed") {
    return "is-completed";
  }

  if (progress.tone === "warning") {
    return "is-warning";
  }

  if (progress.phase === "failed") {
    return "is-error";
  }

  return "";
});
const fortuneAgentProgressTime = computed(() => {
  const value = fortuneAgentProgress.value?.updatedAt ?? fortuneAgentProgress.value?.createdAt ?? "";

  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
});
const hasFortuneDraftInput = computed(() =>
  Boolean(String(ui.marketplace.fortune.chatInput ?? "").trim() || (ui.marketplace.fortune.chatAttachments ?? []).length)
);
const hasFortuneAgentContext = computed(() =>
  Boolean(hasFortuneDraftInput.value || (ui.marketplace.fortune.messages ?? []).length)
);
const canSendFortuneQuickMessage = computed(() => !ui.marketplace.fortune.isGenerating && hasFortuneDraftInput.value);
const canRunFortuneAgent = computed(() => !ui.marketplace.fortune.isGenerating && hasFortuneAgentContext.value);
const fortuneAiOutputStatusMessage = computed(() =>
  String(ui.marketplace.fortune.feedback ?? "").trim() || (ui.marketplace.fortune.isGenerating ? "正在处理对话" : "暂无执行状态")
);
</script>
