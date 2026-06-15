<template>
  <div class="ai-assistant-action-bar" :class="barClass">
    <span class="field-label">{{ label }}</span>
    <div class="writing-ai-output-tools">
      <button
        v-if="showStatus"
        type="button"
        class="writing-ai-output-status"
        :class="statusClass"
        :aria-label="statusMessage"
        :aria-describedby="statusTooltipId"
      >
        <GIcon name="circleAlert" :size="16" />
        <span :id="statusTooltipId" class="writing-ai-output-status-tooltip" role="tooltip">
          {{ statusMessage }}
        </span>
      </button>
      <button
        type="button"
        class="model-action-secondary writing-ai-run"
        :disabled="quickDisabled"
        @click="onQuickRun"
      >
        <GIcon v-if="quickIcon" :name="quickIcon" :spin="quickSpin" :size="14" />
        {{ quickLabel }}
      </button>
      <button
        type="button"
        class="model-action-secondary writing-agent-run"
        :disabled="agentDisabled"
        @click="onAgentRun"
      >
        <GIcon name="sparkles" :size="14" />
        {{ agentLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

import GIcon from "../../components/GIcon.vue";

const props = defineProps({
  agentDisabled: { type: Boolean, default: false },
  agentLabel: { type: String, default: "Gordon 处理" },
  barClass: { type: [String, Object, Array], default: "" },
  label: { type: String, default: "AI 输出" },
  onAgentRun: { type: Function, required: true },
  onQuickRun: { type: Function, required: true },
  quickDisabled: { type: Boolean, default: false },
  quickIcon: { type: String, default: "" },
  quickLabel: { type: String, default: "快速模式" },
  quickSpin: { type: Boolean, default: false },
  showStatus: { type: Boolean, default: true },
  statusClass: { type: [String, Object, Array], default: "" },
  statusMessage: { type: String, default: "暂无执行状态" },
  tooltipId: { type: String, default: "" }
});

const statusTooltipId = computed(() => props.tooltipId || `ai-assistant-status-${String(props.label || "output").replace(/\s+/g, "-")}`);
</script>
