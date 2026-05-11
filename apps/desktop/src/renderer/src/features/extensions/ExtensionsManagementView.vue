<template>
<div class="workspace-stage workspace-stage-scroll">
  <div
    class="models-shell extensions-shell"
    :class="{
      'extensions-shell-home': ui.extensions.view === 'list',
      'extensions-shell-subpage': ui.extensions.view === 'editor'
    }"
  >
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
          <button
            type="button"
            class="weekly-editor-tab"
            :class="{ 'is-active': ui.extensions.listTab === 'tool' }"
            :aria-selected="ui.extensions.listTab === 'tool' ? 'true' : 'false'"
            @click="ui.extensions.listTab = 'tool'"
          >
            TOOL 配置
          </button>
        </div>
      </div>

      <div class="model-section-actions">
        <span class="status-pill">{{ workbench.agentProfiles.filter((profile) => profile.enabled).length }} 个 Agent 已启用</span>
        <span class="pill pill-neutral">{{ workbench.skillDefinitions.filter((skill) => skill.enabled).length }} 个 Skill 已启用</span>
        <span class="pill pill-neutral">{{ workbench.mcpServers.filter((server) => server.enabled).length }} 个 MCP 已启用</span>
        <span class="pill pill-neutral">{{ workbench.toolConfigs.filter((config) => config.enabled).length }} 个 TOOL 已启用</span>
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

        <section v-else-if="ui.extensions.listTab === 'tool'" class="model-section extension-section">
          <div class="model-section-head">
            <div>
              <p class="feature-kicker">Tool Configs</p>
              <p class="model-section-title">TOOL 配置</p>
            </div>

            <div class="model-section-actions">
              <span class="pill pill-neutral">{{ workbench.toolConfigs.length }} 个 TOOL</span>
            </div>
          </div>

          <div class="model-section-body model-configured-list extension-configured-list">
            <div v-if="!workbench.toolConfigs.length" class="model-empty">
              <p class="model-empty-copy">当前还没有内置 TOOL 配置。</p>
            </div>

            <article v-for="config in workbench.toolConfigs" :key="config.id" class="model-config-card extension-config-card">
              <div class="model-config-head">
                <div class="model-config-main">
                  <div class="provider-avatar extension-avatar extension-avatar-tool" aria-hidden="true">
                    {{ getExtensionInitials(config.name) }}
                  </div>

                  <div>
                    <p class="model-card-title"><code class="tool-code-name">{{ config.name }}</code></p>
                    <p class="model-card-meta">
                      {{ config.title }} / 默认
                      {{
                        config.providers.find((provider) => provider.provider === config.defaultProvider)?.label ??
                        config.defaultProvider ??
                        "未选择"
                      }}
                    </p>
                  </div>
                </div>

                <div class="model-card-actions model-card-actions-inline">
                  <button
                    type="button"
                    class="model-icon-button"
                    :aria-label="`编辑 ${config.name}`"
                    title="编辑"
                    @click="openExtensionEditor('tool', config)"
                  >
                    <GIcon name="edit" />
                  </button>

                  <button
                    type="button"
                    class="model-status-toggle"
                    :class="{ 'is-active': config.enabled }"
                    :aria-pressed="config.enabled ? 'true' : 'false'"
                    @click="handleToolConfigStatusToggle(config.id)"
                  >
                    {{ config.enabled ? "已启用" : "未启用" }}
                  </button>
                </div>
              </div>

              <p v-if="config.description" class="model-card-copy">{{ config.description }}</p>

              <div class="extension-tag-row">
                <span class="pill pill-neutral">{{ config.providers.filter((provider) => provider.enabled).length }} 个供应商已启用</span>
                <span
                  v-for="provider in config.providers"
                  :key="provider.id"
                  class="pill"
                  :class="{ 'pill-neutral': !provider.enabled }"
                >
                  {{ provider.label || provider.provider }}
                </span>
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
        <section class="model-section model-section-scroll extension-section extension-section-editor extension-subpage-section">
          <div class="model-editor extension-editor model-editor-unified">
            <div class="workflow-library-detail-head model-subpage-head">
              <div class="workflow-library-detail-head-side">
                <button
                  type="button"
                  class="model-icon-button weekly-back-button"
                  aria-label="返回列表"
                  title="返回列表"
                  @click="closeExtensionPanels"
                >
                  <GIcon name="return" />
                </button>
              </div>

              <div class="workflow-library-detail-head-center">
                <p class="workflow-library-detail-title">{{ getExtensionEditorTitle() }}</p>
              </div>

              <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
                <span class="pill pill-neutral">
                  {{
                    ui.extensions.editor.kind === "agent"
                      ? "Agent"
                      : ui.extensions.editor.kind === "skill"
                        ? "Skill"
                        : ui.extensions.editor.kind === "skill-import"
                          ? "Skill 导入"
                          : ui.extensions.editor.kind === "tool"
                            ? "TOOL"
                            : "MCP"
                  }}
                </span>
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

              <template v-else-if="ui.extensions.editor.kind === 'tool'">
                <label class="field">
                  <span class="field-label">工具名称</span>
                  <input v-model="ui.extensions.editor.values.name" class="field-input tool-name-input" readonly required />
                </label>

                <label class="field">
                  <span class="field-label">显示名称</span>
                  <input v-model="ui.extensions.editor.values.title" class="field-input" placeholder="例如：图片生成" required />
                </label>

                <label class="extension-selection-item field-full tool-enable-toggle">
                  <input v-model="ui.extensions.editor.values.enabled" type="checkbox" />
                  <span>启用这个 TOOL</span>
                </label>

                <label class="field field-full">
                  <span class="field-label">默认供应商</span>
                  <div class="field-select-control">
                    <select v-model="ui.extensions.editor.values.defaultProvider" class="field-input field-select">
                      <option
                        v-for="provider in ui.extensions.editor.values.providers"
                        :key="provider.id"
                        :value="provider.provider"
                      >
                        {{ provider.label || provider.provider }}{{ provider.enabled ? "" : " / 未启用" }}
                      </option>
                    </select>
                    <GIcon name="chevronDown" />
                  </div>
                </label>

                <label class="field field-full">
                  <span class="field-label">说明</span>
                  <textarea
                    v-model="ui.extensions.editor.values.description"
                    class="field-textarea"
                    placeholder="描述这个 TOOL 的调用场景"
                  ></textarea>
                </label>

                <div class="field field-full">
                  <span class="field-label">供应商</span>
                  <div class="tool-provider-panel">
                    <div class="weekly-editor-segmented tool-provider-tabs" role="tablist" aria-label="TOOL 供应商">
                      <button
                        v-for="provider in ui.extensions.editor.values.providers"
                        :key="provider.id"
                        type="button"
                        class="weekly-editor-tab tool-provider-tab"
                        :class="{ 'is-active': ui.extensions.editor.values.activeProvider === provider.provider }"
                        :aria-selected="ui.extensions.editor.values.activeProvider === provider.provider ? 'true' : 'false'"
                        @click="ui.extensions.editor.values.activeProvider = provider.provider"
                      >
                        <span>{{ provider.label || provider.provider }}</span>
                        <span class="tool-provider-tab-state">{{ provider.enabled ? "启用" : "未启用" }}</span>
                      </button>
                    </div>

                    <article
                      v-for="provider in ui.extensions.editor.values.providers"
                      :key="provider.id"
                      class="tool-provider-card"
                      :class="{ 'is-active': provider.enabled }"
                      v-show="ui.extensions.editor.values.activeProvider === provider.provider"
                    >
                      <div class="tool-provider-head">
                        <label class="extension-selection-item tool-provider-toggle">
                          <input v-model="provider.enabled" type="checkbox" />
                          <span>{{ provider.label || provider.provider }}</span>
                        </label>
                        <span class="pill pill-neutral">{{ provider.provider }}</span>
                      </div>

                      <div class="tool-provider-grid">
                        <label class="field">
                          <span class="field-label">供应商名称</span>
                          <input v-model="provider.label" class="field-input" placeholder="例如：OpenAI" />
                        </label>

                        <label class="field">
                          <span class="field-label">模型 / 能力 ID</span>
                          <input v-model="provider.model" class="field-input" placeholder="例如：gpt-image" />
                        </label>

                        <label class="field field-full">
                          <span class="field-label">API Key</span>
                          <input v-model="provider.apiKey" class="field-input" type="password" placeholder="sk-..." />
                        </label>

                        <label class="field field-full">
                          <span class="field-label">Base URL</span>
                          <input v-model="provider.baseUrl" class="field-input" placeholder="可选，自定义网关或供应商地址" />
                        </label>

                        <label class="field field-full">
                          <span class="field-label">备注</span>
                          <textarea
                            v-model="provider.notes"
                            class="field-textarea tool-provider-notes"
                            placeholder="可选，记录额度、区域、账号或调用偏好"
                          ></textarea>
                        </label>
                      </div>
                    </article>
                  </div>
                </div>
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
                          : ui.extensions.editor.kind === "tool"
                            ? "保存"
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

<script setup>
import GIcon from "../../components/GIcon.vue";

defineProps({
  ui: { type: Object, required: true },
  workbench: { type: Object, required: true },
  runnerAgent: { type: Object, default: null },
  runnerRunnableSkills: { type: Array, default: () => [] },
  runnerAuthorizedServers: { type: Array, default: () => [] },
  runnerLatestResult: { type: Object, default: null },
  runnerRecentLogs: { type: Array, default: () => [] },
  closeExtensionPanels: { type: Function, required: true },
  formatFailureKind: { type: Function, required: true },
  formatLocalDateTime: { type: Function, required: true },
  getExtensionEditorTitle: { type: Function, required: true },
  getExtensionInitials: { type: Function, required: true },
  getSkillDisplayName: { type: Function, required: true },
  getSkillLocalMirrorDetail: { type: Function, required: true },
  getSkillOptionLabel: { type: Function, required: true },
  getSkillSourceDetail: { type: Function, required: true },
  getSkillSourceLabel: { type: Function, required: true },
  handleAgentDelete: { type: Function, required: true },
  handleAgentStatusToggle: { type: Function, required: true },
  handleExtensionEditorSave: { type: Function, required: true },
  handleMcpDelete: { type: Function, required: true },
  handleMcpStatusToggle: { type: Function, required: true },
  handleRunnerLoadMcpTools: { type: Function, required: true },
  handleRunnerServerChange: { type: Function, required: true },
  handleRunnerSubmit: { type: Function, required: true },
  handleSkillDelete: { type: Function, required: true },
  handleSkillStatusToggle: { type: Function, required: true },
  handleToolConfigStatusToggle: { type: Function, required: true },
  isBuiltinWorkbenchItem: { type: Function, required: true },
  openAgentRunner: { type: Function, required: true },
  openExtensionEditor: { type: Function, required: true },
  resetRunnerState: { type: Function, required: true },
  resolveBoundModelName: { type: Function, required: true },
  truncateText: { type: Function, required: true }
});
</script>
