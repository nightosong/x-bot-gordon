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

                <div v-if="getCommandArtifactProducts(message.artifact).length" class="command-generated-products">
                  <article
                    v-for="product in getCommandArtifactProducts(message.artifact)"
                    :key="product.id"
                    class="command-generated-product"
                  >
                    <img :src="product.src" :alt="product.title" class="command-generated-product-image" loading="lazy" />
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
                        打开原图
                      </a>
                    </div>
                  </article>
                </div>

                <details v-if="message.role === 'assistant' && message.artifact" class="command-artifact-panel">
                  <summary>{{ getCommandArtifactSummary(message.artifact) }}</summary>

                  <div class="command-artifact-body">
                    <div v-if="message.artifact.stopReason" class="command-artifact-inline-list">
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
                        <span class="command-artifact-section-title">关键动作</span>
                        <span class="pill pill-neutral command-artifact-section-count">
                          {{ getCommandArtifactExecutionItems(message.artifact).length }}
                        </span>
                      </div>

                      <div v-if="getCommandArtifactExecutionItems(message.artifact).length" class="command-artifact-chain">
                        <article
                          v-for="item in getCommandArtifactExecutionItems(message.artifact)"
                          :key="item.id"
                          class="command-artifact-chain-item"
                          :class="item.className"
                        >
                          <span class="command-artifact-chain-rail" aria-hidden="true">
                            <span class="command-artifact-chain-bead"></span>
                          </span>

                          <div class="command-artifact-chain-main">
                            <p class="command-artifact-chain-title" :title="item.title">{{ item.title }}</p>
                            <p
                              v-if="item.secondary"
                              class="command-artifact-chain-secondary"
                              :title="item.secondary"
                            >
                              {{ item.secondary }}
                            </p>

                            <div v-if="item.call && getCommandArtifactCallArgumentsText(item.call)" class="command-artifact-call-params">
                              <span class="command-artifact-call-params-label">调用参数</span>
                              <pre class="command-artifact-call-params-code">{{ getCommandArtifactCallArgumentsText(item.call) }}</pre>
                            </div>

                            <div v-if="item.call && getCommandArtifactCallRepairedArgumentsText(item.call)" class="command-artifact-call-params is-muted">
                              <span class="command-artifact-call-params-label">修复前参数</span>
                              <pre class="command-artifact-call-params-code">{{ getCommandArtifactCallRepairedArgumentsText(item.call) }}</pre>
                            </div>
                          </div>

                          <span class="command-artifact-chain-time">{{ formatLocalDateTime(item.createdAt) }}</span>
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
                  v-html="renderRichText(getCommandLiveStatusText(ui.command.liveProgress))"
                ></div>

                <div v-if="getCommandArtifactProducts(ui.command.liveProgress?.artifact).length" class="command-generated-products">
                  <article
                    v-for="product in getCommandArtifactProducts(ui.command.liveProgress?.artifact)"
                    :key="product.id"
                    class="command-generated-product"
                  >
                    <img :src="product.src" :alt="product.title" class="command-generated-product-image" loading="lazy" />
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
                        打开原图
                      </a>
                    </div>
                  </article>
                </div>

                <details v-if="ui.command.liveProgress?.artifact" class="command-artifact-panel" open>
                  <summary>{{ getCommandArtifactSummary(ui.command.liveProgress.artifact) }}</summary>

                  <div class="command-artifact-body">
                    <div v-if="ui.command.liveProgress.artifact.stopReason" class="command-artifact-inline-list">
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
                        <span class="command-artifact-section-title">关键动作</span>
                        <span class="pill pill-neutral command-artifact-section-count">
                          {{ getCommandArtifactExecutionItems(ui.command.liveProgress.artifact).length }}
                        </span>
                      </div>

                      <div v-if="getCommandArtifactExecutionItems(ui.command.liveProgress.artifact).length" class="command-artifact-chain">
                        <article
                          v-for="item in getCommandArtifactExecutionItems(ui.command.liveProgress.artifact)"
                          :key="item.id"
                          class="command-artifact-chain-item"
                          :class="item.className"
                        >
                          <span class="command-artifact-chain-rail" aria-hidden="true">
                            <span class="command-artifact-chain-bead"></span>
                          </span>

                          <div class="command-artifact-chain-main">
                            <p class="command-artifact-chain-title" :title="item.title">{{ item.title }}</p>
                            <p
                              v-if="item.secondary"
                              class="command-artifact-chain-secondary"
                              :title="item.secondary"
                            >
                              {{ item.secondary }}
                            </p>

                            <div v-if="item.call && getCommandArtifactCallArgumentsText(item.call)" class="command-artifact-call-params">
                              <span class="command-artifact-call-params-label">调用参数</span>
                              <pre class="command-artifact-call-params-code">{{ getCommandArtifactCallArgumentsText(item.call) }}</pre>
                            </div>

                            <div v-if="item.call && getCommandArtifactCallRepairedArgumentsText(item.call)" class="command-artifact-call-params is-muted">
                              <span class="command-artifact-call-params-label">修复前参数</span>
                              <pre class="command-artifact-call-params-code">{{ getCommandArtifactCallRepairedArgumentsText(item.call) }}</pre>
                            </div>
                          </div>

                          <span class="command-artifact-chain-time">{{ formatLocalDateTime(item.createdAt) }}</span>
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
                  :class="{ 'is-running': ui.command.isRunning }"
                  :disabled="!commandSelectedAgent || ui.command.isRunning"
                  :aria-label="ui.command.isRunning ? '处理中' : '发送消息'"
                  :title="ui.command.isRunning ? '处理中' : '发送消息'"
                >
                  <GIcon v-if="ui.command.isRunning" name="loading" spin />
                  <GIcon v-else name="enter" />
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
import { ref } from "vue";

import GIcon from "../../components/GIcon.vue";
import { getCommandAttachmentTitle } from "./commandWorkshopRuntime.js";
import { formatLocalDateTime, renderRichText } from "../../lib/presenter.js";

defineProps({
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
  getCommandArtifactCallArgumentsText: { type: Function, required: true },
  getCommandArtifactCallRepairedArgumentsText: { type: Function, required: true },
  getCommandArtifactCallSecondary: { type: Function, required: true },
  getCommandArtifactCallTitle: { type: Function, required: true },
  getCommandArtifactExecutionItems: { type: Function, required: true },
  getCommandArtifactInlineText: { type: Function, required: true },
  getCommandArtifactProducts: { type: Function, required: true },
  getCommandArtifactStepSecondary: { type: Function, required: true },
  getCommandArtifactSummary: { type: Function, required: true },
  getCommandLiveStatusText: { type: Function, required: true },
  getSkillOptionLabel: { type: Function, required: true },
  handleCommandAgentChange: { type: Function, required: true },
  handleCommandAttachmentSelect: { type: Function, required: true },
  handleCommandInputCompositionEnd: { type: Function, required: true },
  handleCommandInputCompositionStart: { type: Function, required: true },
  handleCommandInputEnterKeydown: { type: Function, required: true },
  handleCommandLoadMcpTools: { type: Function, required: true },
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
