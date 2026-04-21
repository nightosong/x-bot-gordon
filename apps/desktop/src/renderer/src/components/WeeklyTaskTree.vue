<template>
  <div class="weekly-task-list">
    <article
      v-for="(task, taskIndex) in tasks"
      :key="task.id"
      class="weekly-task-card"
      :class="{ 'is-busy': isTaskRewriting(task.id) }"
    >
      <div class="weekly-task-row">
        <details v-if="!isTaskRewriting(task.id)" class="weekly-task-status-menu">
          <summary
            class="weekly-task-index-button"
            :class="getStatusToneClass(task.status)"
            :aria-label="`任务 ${getTaskIndexLabel(taskIndex)}，当前状态：${getStatusLabel(task.status)}`"
          >
            {{ getTaskIndexLabel(taskIndex) }}
          </summary>

          <div class="weekly-task-status-panel">
            <button
              v-for="[statusKey, meta] in statusEntries"
              :key="statusKey"
              type="button"
              class="weekly-task-status-option"
              :class="{ 'is-active': task.status === statusKey }"
              @click="emit('set-status', { projectId, taskId: task.id, status: statusKey, event: $event })"
            >
              <span class="weekly-task-status-swatch" :class="getStatusToneClass(statusKey)"></span>
              <span>{{ meta.label }}</span>
            </button>
          </div>
        </details>
        <span v-else class="weekly-task-index-button is-running" aria-label="任务优化中">
          <span class="weekly-task-spinner"></span>
        </span>

        <input
          v-model="task.title"
          class="field-input weekly-compact-input weekly-task-title-input"
          type="text"
          :data-weekly-task-input="task.id"
          placeholder="输入任务名称"
          :disabled="isTaskRewriting(task.id)"
          @input="emit('touch-task', { projectId, taskId: task.id })"
        />

        <button
          type="button"
          class="weekly-row-action weekly-row-action-add"
          aria-label="新增下一层级任务"
          :disabled="isTaskRewriting(task.id)"
          @click="emit('add-child', { projectId, taskId: task.id })"
        >
          +
        </button>

        <details class="weekly-task-action-menu" :class="{ 'is-disabled': isTaskRewriting(task.id) }">
          <summary class="weekly-row-action weekly-row-action-more" aria-label="更多任务操作">更多</summary>

          <div class="weekly-task-action-panel">
            <button
              type="button"
              class="weekly-task-action-option"
              :disabled="isTaskRewriting(task.id) || !String(task.title ?? '').trim()"
              @click="emit('optimize-task', { projectId, taskId: task.id, event: $event })"
            >
              {{ isTaskRewriting(task.id) ? "优化中..." : "优化" }}
            </button>
            <button
              type="button"
              class="weekly-task-action-option weekly-task-action-option-danger"
              @click="emit('remove-task', { projectId, taskId: task.id })"
            >
              删除
            </button>
          </div>
        </details>
      </div>

      <WeeklyTaskTree
        v-if="getTaskChildren(task).length"
        class="weekly-task-children"
        :tasks="getTaskChildren(task)"
        :project-id="projectId"
        :rewriting-ids="rewritingIds"
        :status-meta="statusMeta"
        :get-status-tone-class="getStatusToneClass"
        :path="[...path, taskIndex + 1]"
        @add-child="emit('add-child', $event)"
        @remove-task="emit('remove-task', $event)"
        @set-status="emit('set-status', $event)"
        @touch-task="emit('touch-task', $event)"
        @optimize-task="emit('optimize-task', $event)"
      />
    </article>
  </div>
</template>

<script setup>
import { computed } from "vue";

defineOptions({
  name: "WeeklyTaskTree"
});

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  projectId: {
    type: String,
    required: true
  },
  rewritingIds: {
    type: Array,
    default: () => []
  },
  statusMeta: {
    type: Object,
    default: () => ({})
  },
  getStatusToneClass: {
    type: Function,
    required: true
  },
  path: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["add-child", "remove-task", "set-status", "touch-task", "optimize-task"]);

const statusEntries = computed(() => Object.entries(props.statusMeta ?? {}));

function getTaskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

function isTaskRewriting(taskId) {
  return props.rewritingIds.includes(taskId);
}

function getTaskIndexLabel(taskIndex) {
  return [...props.path, taskIndex + 1].join(".");
}

function getStatusLabel(status) {
  return props.statusMeta?.[status]?.label ?? props.statusMeta?.planned?.label ?? "待开始";
}
</script>
