<template>
  <div class="field-ai-target" :class="{ 'is-ai-open': isActive }">
    <slot />

    <button
      type="button"
      class="field-ai-trigger"
      :class="{ 'is-active': isActive }"
      :aria-label="isActive ? `关闭${label}优化` : `优化${label}`"
      :title="isActive ? '关闭优化' : 'AI 优化'"
      :disabled="disabled"
      @click.stop="handleTriggerClick"
    >
      <GIcon
        :name="isActive && state.isGenerating ? 'loading' : 'sparkles'"
        :spin="isActive && state.isGenerating"
        :size="13"
      />
    </button>

    <Transition name="field-ai-popover">
      <section v-if="isActive" class="field-ai-popover" role="dialog" :aria-label="`${label} AI 优化`" @click.stop>
        <div class="field-ai-head">
          <div class="field-ai-title">
            <p>AI Copilot</p>
            <strong>{{ label }}</strong>
          </div>
          <button type="button" class="field-ai-close" aria-label="关闭优化" title="关闭" @click="actions.closeMarketplaceFieldAi">
            <GIcon name="close" :size="13" />
          </button>
        </div>

        <textarea
          class="field-ai-input"
          :value="state.instruction"
          placeholder="例如：补充人物关系、改成更适合漫画分镜、压缩成提示词"
          :disabled="state.isGenerating"
          @input="actions.setMarketplaceFieldAiInstruction($event.target.value)"
        ></textarea>

        <textarea
          v-if="state.output || state.isGenerating"
          class="field-ai-output"
          :value="state.output"
          placeholder="优化结果会出现在这里"
          :disabled="state.isGenerating"
          @input="actions.setMarketplaceFieldAiOutput($event.target.value)"
        ></textarea>

        <p v-if="state.feedback" class="field-ai-feedback" :class="actions.getMarketplaceFieldAiFeedbackClass()" role="status">
          {{ state.feedback }}
        </p>

        <div class="field-ai-action-row">
          <div class="field-ai-action-left">
            <button
              type="button"
              class="field-ai-run"
              :disabled="state.isGenerating"
              @click="actions.generateMarketplaceFieldAiOutput"
            >
              <GIcon :name="state.isGenerating ? 'loading' : 'sparkles'" :spin="state.isGenerating" :size="13" />
              {{ state.isGenerating ? "生成中" : "生成" }}
            </button>
            <button
              v-if="state.isGenerating"
              type="button"
              class="field-ai-ghost"
              @click="actions.cancelMarketplaceFieldAiRun"
            >
              停止
            </button>
          </div>

          <div class="field-ai-action-right">
            <button
              type="button"
              class="field-ai-ghost"
              :disabled="state.isGenerating || !state.output"
              @click="actions.applyMarketplaceFieldAiOutput('append')"
            >
              追加
            </button>
            <button
              type="button"
              class="field-ai-primary"
              :disabled="state.isGenerating || !state.output"
              @click="actions.applyMarketplaceFieldAiOutput('replace')"
            >
              替换
            </button>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from "vue";

import GIcon from "../../components/GIcon.vue";

const props = defineProps({
  actions: { type: Object, required: true },
  appName: { type: String, required: true },
  context: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  fieldId: { type: String, required: true },
  label: { type: String, required: true },
  setValue: { type: Function, required: true },
  state: { type: Object, required: true },
  value: { type: [String, Number], default: "" }
});

const isActive = computed(() => props.state.isOpen && props.state.targetId === props.fieldId);

function openCurrentField() {
  props.actions.openMarketplaceFieldAi({
    appName: props.appName,
    context: props.context,
    fieldId: props.fieldId,
    getValue: () => props.value,
    label: props.label,
    setValue: props.setValue,
    value: props.value
  });
}

function handleTriggerClick() {
  if (isActive.value) {
    props.actions.closeMarketplaceFieldAi();
    return;
  }

  openCurrentField();
}
</script>
