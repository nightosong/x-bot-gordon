<template>
  <section v-if="progress" class="writing-agent-progress" :class="progressClass" aria-live="polite">
    <div class="writing-agent-progress-head">
      <div>
        <span>Gordon 过程</span>
        <small>{{ progress.statusText || fallbackStatus }}</small>
      </div>
      <div class="writing-agent-progress-head-actions">
        <b v-if="progressTime">{{ progressTime }}</b>
        <button
          v-if="canCancel"
          type="button"
          class="model-icon-button writing-agent-progress-stop"
          aria-label="停止 Gordon 处理"
          title="停止 Gordon 处理"
          @click="cancelHandler"
        >
          <GIcon name="stop" :size="12" />
        </button>
      </div>
    </div>

    <ol v-if="safeItems.length" class="writing-agent-progress-list">
      <li
        v-for="item in safeItems"
        :key="item.id"
        class="writing-agent-progress-item"
        :class="item.className"
      >
        <span class="writing-agent-progress-marker">{{ item.marker }}</span>
        <div class="writing-agent-progress-copy">
          <strong>{{ item.title }}</strong>
          <p v-if="item.detail">{{ item.detail }}</p>
          <div v-if="item.tags?.length" class="writing-agent-progress-tags">
            <em v-for="tag in item.tags" :key="`${item.id}-${tag}`">{{ tag }}</em>
          </div>
        </div>
      </li>
    </ol>

    <div v-else class="writing-agent-progress-waiting">
      <span aria-hidden="true"></span>
      <span>正在等待 Gordon 返回过程事件</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";

import GIcon from "../../components/GIcon.vue";

const props = defineProps({
  progress: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  progressClass: { type: [String, Object, Array], default: "" },
  progressTime: { type: String, default: "" },
  fallbackStatus: { type: String, default: "正在处理任务" },
  cancelHandler: { type: Function, default: null }
});

const safeItems = computed(() => (Array.isArray(props.items) ? props.items : []));
const canCancel = computed(() => props.progress?.phase === "running" && typeof props.cancelHandler === "function");
</script>
