<template>
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
                class="model-icon-button weekly-back-button command-chat-nav-button"
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
                <GIcon name="messagePlus" />
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
                  <span class="command-message-meta">
                    <span class="command-message-time">{{ formatLocalDateTime(message.createdAt) }}</span>
                    <button
                      v-if="message.role === 'assistant' && message.content"
                      type="button"
                      class="model-icon-button command-message-copy-button"
                      :class="{ 'is-copied': ui.command.copiedMessageId === message.id }"
                      :aria-label="ui.command.copiedMessageId === message.id ? 'AI 回复已复制' : '复制 AI 回复'"
                      :title="ui.command.copiedMessageId === message.id ? '已复制' : '复制 AI 回复'"
                      @click="handleCommandMessageCopy(message)"
                    >
                      <GIcon :name="ui.command.copiedMessageId === message.id ? 'check' : 'copy'" :size="14" />
                    </button>
                  </span>
                </div>

                <div
                  v-if="message.role !== 'assistant' && message.content"
                  class="command-message-body command-rich-text"
                  v-html="renderRichText(message.content)"
                  @click="handleRichTextClick"
                ></div>

                <div v-if="message.role !== 'assistant' && message.attachments?.length" class="command-message-attachments">
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

                <div v-if="message.role === 'assistant' && getCommandResponseProcessItems(message.artifact).length" class="command-response-process">
                  <article
                    v-for="item in getCommandResponseProcessItems(message.artifact)"
                    :key="item.id"
                    class="command-response-process-item"
                    :class="item.className"
                  >
                    <span class="command-response-process-rail" aria-hidden="true">
                      <span class="command-response-process-mark">{{ item.marker }}</span>
                    </span>
                    <div class="command-response-process-main">
                      <div class="command-response-process-head">
                        <span class="command-response-process-label">{{ item.label }}</span>
                        <span v-if="item.createdAt" class="command-response-process-time">{{ formatLocalDateTime(item.createdAt) }}</span>
                      </div>
                      <p class="command-response-process-title" :title="item.title">{{ item.title }}</p>
                      <p v-if="item.detail" class="command-response-process-detail" :title="item.detail">{{ item.detail }}</p>
                      <ol v-if="item.items?.length" class="command-response-plan-list">
                        <li v-for="planItem in item.items" :key="planItem">{{ planItem }}</li>
                      </ol>
                      <div v-if="item.output" class="command-response-output">
                        <span class="command-response-output-label">{{ item.outputLabel || "中间输出" }}</span>
                        <pre>{{ item.output }}</pre>
                      </div>
                    </div>
                  </article>
                </div>

                <div
                  v-if="message.role === 'assistant' && message.content"
                  class="command-message-body command-rich-text command-final-reply"
                  v-html="renderRichText(message.content)"
                  @click="handleRichTextClick"
                ></div>

                <div v-if="getCommandArtifactProducts(message.artifact).length" class="command-generated-products">
                  <article
                    v-for="product in getCommandArtifactProducts(message.artifact)"
                    :key="product.id"
                    class="command-generated-product"
                  >
                    <img
                      v-if="product.kind === 'image'"
                      :src="product.src"
                      :alt="product.title"
                      class="command-generated-product-image"
                      loading="lazy"
                    />
                    <div v-else-if="product.kind === 'audio'" class="command-generated-product-audio">
                      <GIcon name="music" :size="20" />
                      <audio :src="product.src" controls></audio>
                    </div>
                    <div class="command-generated-product-meta">
                      <p class="command-generated-product-title">{{ product.title }}</p>
                      <p v-if="product.meta" class="command-generated-product-copy" :title="product.meta">{{ product.meta }}</p>
                      <a
                        v-if="product.url"
                        class="command-generated-product-link"
                        :href="product.url"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {{ product.kind === "audio" ? "打开音频" : "打开原图" }}
                      </a>
                    </div>
                  </article>
                </div>
              </article>

              <article v-if="ui.command.isRunning" class="command-message is-assistant is-pending">
                <div class="command-message-head">
                  <span class="command-message-role">{{ resolveAgentName(ui.command.form.agentProfileId) }}</span>
                  <span class="command-message-time">{{ ui.command.liveProgress?.updatedAt ? formatLocalDateTime(ui.command.liveProgress.updatedAt) : "处理中" }}</span>
                </div>

                <div v-if="getCommandResponseProcessItems(ui.command.liveProgress?.artifact).length" class="command-response-process is-live">
                  <article
                    v-for="item in getCommandResponseProcessItems(ui.command.liveProgress?.artifact)"
                    :key="item.id"
                    class="command-response-process-item"
                    :class="item.className"
                  >
                    <span class="command-response-process-rail" aria-hidden="true">
                      <span class="command-response-process-mark">{{ item.marker }}</span>
                    </span>
                    <div class="command-response-process-main">
                      <div class="command-response-process-head">
                        <span class="command-response-process-label">{{ item.label }}</span>
                        <span v-if="item.createdAt" class="command-response-process-time">{{ formatLocalDateTime(item.createdAt) }}</span>
                      </div>
                      <p class="command-response-process-title" :title="item.title">{{ item.title }}</p>
                      <p v-if="item.detail" class="command-response-process-detail" :title="item.detail">{{ item.detail }}</p>
                      <ol v-if="item.items?.length" class="command-response-plan-list">
                        <li v-for="planItem in item.items" :key="planItem">{{ planItem }}</li>
                      </ol>
                      <div v-if="item.output" class="command-response-output">
                        <span class="command-response-output-label">{{ item.outputLabel || "中间输出" }}</span>
                        <pre>{{ item.output }}</pre>
                      </div>
                    </div>
                  </article>
                </div>

                <div
                  v-if="ui.command.liveProgress?.text"
                  class="command-message-body command-rich-text command-final-reply"
                  v-html="renderRichText(ui.command.liveProgress.text)"
                ></div>

                <div
                  v-else-if="!getCommandResponseProcessItems(ui.command.liveProgress?.artifact).length"
                  class="command-message-body command-rich-text"
                  v-html="renderRichText(getCommandLiveStatusText(ui.command.liveProgress))"
                ></div>

                <div v-if="getCommandArtifactProducts(ui.command.liveProgress?.artifact).length" class="command-generated-products">
                  <article
                    v-for="product in getCommandArtifactProducts(ui.command.liveProgress?.artifact)"
                    :key="product.id"
                    class="command-generated-product"
                  >
                    <img
                      v-if="product.kind === 'image'"
                      :src="product.src"
                      :alt="product.title"
                      class="command-generated-product-image"
                      loading="lazy"
                    />
                    <div v-else-if="product.kind === 'audio'" class="command-generated-product-audio">
                      <GIcon name="music" :size="20" />
                      <audio :src="product.src" controls></audio>
                    </div>
                    <div class="command-generated-product-meta">
                      <p class="command-generated-product-title">{{ product.title }}</p>
                      <p v-if="product.meta" class="command-generated-product-copy" :title="product.meta">{{ product.meta }}</p>
                      <a
                        v-if="product.url"
                        class="command-generated-product-link"
                        :href="product.url"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {{ product.kind === "audio" ? "打开音频" : "打开原图" }}
                      </a>
                    </div>
                  </article>
                </div>
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
                <div class="field command-settings-cell">
                  <span class="field-label">Agent</span>
                  <GCompactSelect
                    v-model="ui.command.form.agentProfileId"
                    class="command-settings-select"
                    aria-label="Agent"
                    :disabled="!enabledAgentProfiles.length"
                    :options="commandAgentSelectOptions"
                    placeholder="暂无可用 Agent"
                    @change="handleCommandAgentChange"
                  />
                </div>

                <div class="field command-settings-cell">
                  <span class="field-label">Skill</span>
                  <GCompactSelect
                    v-model="ui.command.form.skillId"
                    class="command-settings-select"
                    aria-label="Skill"
                    :disabled="!commandSelectedAgent"
                    :options="commandSkillSelectOptions"
                  />
                </div>

                <label class="command-inline-toggle command-settings-toggle">
                  <span class="command-inline-toggle-label">允许自动工具</span>
                  <input v-model="ui.command.form.autoSelectMcp" type="checkbox" />
                </label>

                <div class="field command-settings-cell">
                  <span class="field-label">工具服务</span>
                  <GCompactSelect
                    v-model="ui.command.form.mcpServerId"
                    class="command-settings-select"
                    aria-label="工具服务"
                    :disabled="!commandSelectedAgent"
                    :options="commandServerSelectOptions"
                    @change="handleCommandServerChange"
                  />
                </div>

                <div class="field command-settings-tool-field">
                  <span class="field-label">工具</span>
                  <div class="command-settings-tool-row">
                    <GCompactSelect
                      v-model="ui.command.form.mcpToolName"
                      class="command-settings-select command-settings-tool-select"
                      aria-label="工具"
                      :disabled="!ui.command.form.mcpServerId"
                      :options="commandToolSelectOptions"
                    />

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
                  :placeholder="commandSelectedAgent ? (ui.command.isRunning ? '输入新的引导，Enter 会停止当前轮并继续执行。' : '直接告诉 Gordon 你要完成什么工作，Enter 发送，Shift + Enter 换行。') : '先在能力拓展里启用一个 Agent，Gordon 才能开始工作。'"
                  :disabled="!commandSelectedAgent"
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
                  v-if="ui.command.isRunning"
                  type="button"
                  class="model-icon-button command-input-submit is-running"
                  :class="{ 'is-cancelling': ui.command.cancelRequested }"
                  :disabled="ui.command.cancelRequested"
                  aria-label="停止运行"
                  :title="ui.command.cancelRequested ? '正在停止' : '停止运行'"
                  @click="handleCommandRunCancel"
                >
                  <GIcon v-if="ui.command.cancelRequested" name="loading" spin />
                  <GIcon v-else name="stop" />
                </button>

                <button
                  v-else
                  type="submit"
                  class="model-icon-button command-input-submit"
                  :disabled="!commandSelectedAgent"
                  aria-label="发送消息"
                  title="发送消息"
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

<script setup>
import { computed, ref } from "vue";

import GCompactSelect from "../../components/GCompactSelect.vue";
import GIcon from "../../components/GIcon.vue";
import { getCommandAttachmentTitle } from "./commandWorkshopRuntime.js";
import { formatLocalDateTime, renderRichText } from "../../lib/presenter.js";

const props = defineProps({
  ui: { type: Object, required: true },
  workbench: { type: Object, required: true },
  activeCommandSession: { type: Object, default: null },
  activeCommandMessages: { type: Array, default: () => [] },
  commandChatTitle: { type: String, default: "开始一轮协作" },
  commandSettingsSummary: { type: String, default: "" },
  enabledAgentProfiles: { type: Array, default: () => [] },
  commandSelectedAgent: { type: Object, default: null },
  commandRunnableSkills: { type: Array, default: () => [] },
  commandAuthorizedServers: { type: Array, default: () => [] },
  commandToolOptions: { type: Array, default: () => [] },
  backToCommandList: { type: Function, required: true },
  beginNewCommandSession: { type: Function, required: true },
  getCommandArtifactProducts: { type: Function, required: true },
  getCommandResponseProcessItems: { type: Function, required: true },
  getCommandLiveStatusText: { type: Function, required: true },
  getSkillOptionLabel: { type: Function, required: true },
  handleCommandAgentChange: { type: Function, required: true },
  handleCommandAttachmentSelect: { type: Function, required: true },
  handleCommandInputCompositionEnd: { type: Function, required: true },
  handleCommandInputCompositionStart: { type: Function, required: true },
  handleCommandInputEnterKeydown: { type: Function, required: true },
  handleCommandLoadMcpTools: { type: Function, required: true },
  handleCommandMessageCopy: { type: Function, required: true },
  handleCommandRunCancel: { type: Function, required: true },
  handleCommandServerChange: { type: Function, required: true },
  handleCommandSessionDelete: { type: Function, required: true },
  handleCommandSubmit: { type: Function, required: true },
  handleRichTextClick: { type: Function, required: true },
  openCommandSession: { type: Function, required: true },
  removeCommandAttachment: { type: Function, required: true },
  resolveAgentName: { type: Function, required: true }
});

const commandInputRef = ref(null);
const commandMessagesRef = ref(null);

const commandAgentSelectOptions = computed(() =>
  props.enabledAgentProfiles.map((agent) => ({
    label: agent.name,
    value: agent.id
  }))
);

const commandSkillSelectOptions = computed(() => [
  { label: "通用模式", value: "" },
  ...props.commandRunnableSkills.map((skill) => ({
    label: props.getSkillOptionLabel(skill),
    value: skill.id
  }))
]);

const commandServerSelectOptions = computed(() => [
  { label: "不指定工具服务", value: "" },
  ...props.commandAuthorizedServers.map((server) => ({
    label: `${server.name} / ${String(server.transport ?? "").toUpperCase()}`,
    value: server.id
  }))
]);

const commandToolSelectOptions = computed(() => [
  { label: "不指定工具", value: "" },
  ...props.commandToolOptions.map((tool) => ({
    label: tool.description ? `${tool.name} / ${tool.description}` : tool.name,
    value: tool.name
  }))
]);

function focusCommandInput() {
  commandInputRef.value?.focus?.();
}

function scrollCommandToBottom() {
  if (commandMessagesRef.value) {
    commandMessagesRef.value.scrollTop = commandMessagesRef.value.scrollHeight;
  }
}

defineExpose({
  focusCommandInput,
  scrollCommandToBottom
});
</script>
