<template>
  <div
    class="weekly-task-list"
    :class="{ 'is-root-drop-target': isRootDropTarget && isProjectRootTree }"
    @dragover.prevent="handleRootDragOver"
    @dragleave="handleRootDragLeave"
    @drop.prevent="handleRootDrop"
  >
    <div v-if="isRootDropTarget && isProjectRootTree" class="weekly-task-root-drop-hint">移动到项目根目录</div>

    <article
      v-for="(task, taskIndex) in tasks"
      :key="task.id"
      class="weekly-task-card"
      :class="{
        'is-busy': isTaskRewriting(task.id),
        'is-planned': task.status === 'planned',
        'is-in-progress': task.status === 'in_progress',
        'is-testing': task.status === 'testing',
        'is-completed': task.status === 'completed',
        'is-blocked': task.status === 'blocked',
        'is-dragging': draggingTaskId === task.id,
        'is-drop-target': dropTargetTaskId === task.id
      }"
      @dragover.prevent.stop="handleTaskDragOver(task.id, $event)"
      @dragleave.stop="handleTaskDragLeave(task.id)"
      @drop.prevent.stop="handleTaskDrop(task.id, $event)"
    >
      <div
        class="weekly-task-row"
        :class="{
          'is-planned': task.status === 'planned',
          'is-in-progress': task.status === 'in_progress',
          'is-testing': task.status === 'testing',
          'is-completed': task.status === 'completed',
          'is-blocked': task.status === 'blocked'
        }"
      >
        <details v-if="!isTaskRewriting(task.id)" class="weekly-task-status-menu" @toggle="handleStatusMenuToggle($event)">
          <summary
            class="weekly-task-index-button"
            :class="[getStatusToneClass(task.status), { 'is-drag-source': draggingTaskId === task.id }]"
            :aria-label="`任务 ${getTaskIndexLabel(taskIndex)}，当前状态：${getStatusLabel(task.status)}。点击切换状态，按住拖动任务。`"
            :draggable="!isTaskRewriting(task.id)"
            title="点击切换状态，按住拖动任务"
            @click="handleStatusSummaryClick(task.id, $event)"
            @dragstart.stop="handleTaskDragStart(task.id, $event)"
            @dragend.stop="handleTaskDragEnd(task.id)"
          >
            <span class="weekly-task-index-glow" aria-hidden="true"></span>
            <span class="weekly-task-index-label">{{ getTaskIndexLabel(taskIndex) }}</span>
          </summary>

          <div class="weekly-task-status-panel">
            <button
              v-for="[statusKey, meta] in statusEntries"
              :key="statusKey"
              type="button"
              class="weekly-task-status-option"
              :class="{ 'is-active': task.status === statusKey }"
              @click="handleStatusOptionClick(task.id, statusKey, $event)"
            >
              <span class="weekly-task-status-swatch" :class="getStatusToneClass(statusKey)"></span>
              <span>{{ meta.label }}</span>
            </button>
          </div>
        </details>
        <span v-else class="weekly-task-index-button is-running" aria-label="任务优化中">
          <span class="weekly-task-index-glow" aria-hidden="true"></span>
          <span class="weekly-task-spinner"></span>
        </span>

        <button
          v-if="hasTaskChildren(task)"
          type="button"
          class="weekly-task-collapse-button"
          :aria-label="isTaskCollapsed(task.id) ? '展开子任务' : '折叠子任务'"
          :aria-expanded="String(!isTaskCollapsed(task.id))"
          :title="isTaskCollapsed(task.id) ? '展开子任务' : '折叠子任务'"
          :disabled="isTaskRewriting(task.id)"
          @click="toggleTaskCollapsed(task.id)"
        >
          <span class="weekly-task-collapse-glyph">
            {{ isTaskCollapsed(task.id) ? "▸" : "▾" }}
          </span>
        </button>
        <span v-else class="weekly-task-collapse-spacer" aria-hidden="true"></span>

        <button
          v-if="!isEditingTask(task.id)"
          type="button"
          class="weekly-task-title-display"
          :class="{ 'is-placeholder': !String(task.title ?? '').trim() }"
          :data-weekly-task-input="task.id"
          :title="String(task.title ?? '').trim()"
          :disabled="isTaskRewriting(task.id)"
          @click="activateTaskEditor(task.id)"
        >
          {{ String(task.title ?? '').trim() || "输入任务名称" }}
        </button>

        <textarea
          v-else
          :ref="(element) => setTaskTitleInputRef(task.id, element)"
          v-model="task.title"
          class="field-textarea weekly-compact-input weekly-task-title-input weekly-task-title-editor"
          :data-weekly-task-input="task.id"
          placeholder="输入任务名称"
          :disabled="isTaskRewriting(task.id)"
          rows="1"
          @input="handleTaskTitleInput(task.id, $event)"
          @blur="deactivateTaskEditor(task.id)"
          @keydown.esc.prevent="deactivateTaskEditor(task.id)"
        ></textarea>

        <button
          type="button"
          class="weekly-row-action weekly-row-action-add"
          aria-label="新增下一层级任务"
          :disabled="isTaskRewriting(task.id)"
          @click="emit('add-child', { projectId, taskId: task.id })"
        >
          <GIcon name="add" />
        </button>

        <details
          class="weekly-task-action-menu"
          :class="{
            'is-disabled': isTaskRewriting(task.id),
            'is-flipped': isTaskActionMenuFlipped(task.id)
          }"
          @toggle="handleTaskActionMenuToggle(task.id, $event)"
        >
          <summary class="weekly-row-action weekly-row-action-more" aria-label="更多任务操作" title="更多任务操作">
            <GIcon name="more" />
          </summary>

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
        v-if="hasTaskChildren(task) && !isTaskCollapsed(task.id)"
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
        @move-task="emit('move-task', $event)"
      />
    </article>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref } from "vue";

import GIcon from "./GIcon.vue";

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

const emit = defineEmits(["add-child", "remove-task", "set-status", "touch-task", "optimize-task", "move-task"]);

const statusEntries = computed(() => Object.entries(props.statusMeta ?? {}));
const isProjectRootTree = computed(() => props.path.length === 0);
const activeEditorId = ref(null);
const collapsedTaskIds = ref(new Set());
const flippedActionMenuIds = ref(new Set());
const taskTitleInputRefs = new Map();
const actionMenuGap = 8;
const actionMenuViewportMargin = 12;
const weeklyTaskDragContextKey = Symbol.for("gordon.weeklyTaskTree.dragContext");
const inheritedDragContext = inject(weeklyTaskDragContextKey, null);
const localDragContext = {
  draggingTaskId: ref(""),
  dropTargetTaskId: ref(""),
  rootDropProjectId: ref(""),
  suppressStatusClickTaskId: ref(""),
  rootTasks: computed(() => props.tasks)
};
const dragContext = inheritedDragContext ?? localDragContext;

if (!inheritedDragContext) {
  provide(weeklyTaskDragContextKey, dragContext);
}

const draggingTaskId = dragContext.draggingTaskId;
const dropTargetTaskId = dragContext.dropTargetTaskId;
const rootDropProjectId = dragContext.rootDropProjectId;
const suppressStatusClickTaskId = dragContext.suppressStatusClickTaskId;
const rootTaskList = dragContext.rootTasks;
const isRootDropTarget = computed(
  () => isProjectRootTree.value && rootDropProjectId.value === props.projectId && !dropTargetTaskId.value
);

function closeWeeklyStatusMenus(exceptMenu = null) {
  document.querySelectorAll(".weekly-task-status-menu[open]").forEach((menu) => {
    if (menu !== exceptMenu && menu instanceof HTMLDetailsElement) {
      menu.open = false;
    }
  });
}

function handleDocumentPointerDown(event) {
  const target = event?.target;

  if (target instanceof Element && target.closest(".weekly-task-status-menu")) {
    return;
  }

  closeWeeklyStatusMenus();
}

function handleStatusMenuToggle(event) {
  const menu = event?.currentTarget;

  if (!(menu instanceof HTMLDetailsElement) || !menu.open) {
    return;
  }

  closeWeeklyStatusMenus(menu);
}

function handleStatusOptionClick(taskId, status, event) {
  emit("set-status", { projectId: props.projectId, taskId, status, event });

  const menu = event?.currentTarget?.closest?.(".weekly-task-status-menu");

  if (menu instanceof HTMLDetailsElement) {
    menu.open = false;
  }
}

if (!inheritedDragContext) {
  onMounted(() => {
    document.addEventListener("pointerdown", handleDocumentPointerDown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
  });
}

function getTaskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

function hasTaskChildren(task) {
  return getTaskChildren(task).length > 0;
}

function isTaskCollapsed(taskId) {
  return collapsedTaskIds.value.has(taskId);
}

function toggleTaskCollapsed(taskId) {
  const nextCollapsedTaskIds = new Set(collapsedTaskIds.value);

  if (nextCollapsedTaskIds.has(taskId)) {
    nextCollapsedTaskIds.delete(taskId);
  } else {
    nextCollapsedTaskIds.add(taskId);
  }

  collapsedTaskIds.value = nextCollapsedTaskIds;
}

function isTaskRewriting(taskId) {
  return props.rewritingIds.includes(taskId);
}

function isTaskActionMenuFlipped(taskId) {
  return flippedActionMenuIds.value.has(taskId);
}

function setTaskActionMenuFlipped(taskId, shouldFlip) {
  const nextFlippedActionMenuIds = new Set(flippedActionMenuIds.value);

  if (shouldFlip) {
    nextFlippedActionMenuIds.add(taskId);
  } else {
    nextFlippedActionMenuIds.delete(taskId);
  }

  flippedActionMenuIds.value = nextFlippedActionMenuIds;
}

async function handleTaskActionMenuToggle(taskId, event) {
  const menu = event?.currentTarget;

  if (!(menu instanceof HTMLDetailsElement)) {
    return;
  }

  if (!menu.open) {
    setTaskActionMenuFlipped(taskId, false);
    return;
  }

  await nextTick();

  const summary = menu.querySelector(".weekly-row-action-more");
  const panel = menu.querySelector(".weekly-task-action-panel");

  if (!(summary instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
    setTaskActionMenuFlipped(taskId, false);
    return;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  if (!viewportHeight) {
    setTaskActionMenuFlipped(taskId, false);
    return;
  }

  const summaryRect = summary.getBoundingClientRect();
  const panelHeight = panel.getBoundingClientRect().height;
  const visibleBounds = getTaskActionMenuVisibleBounds(menu, viewportHeight);
  const spaceBelow = visibleBounds.bottom - actionMenuViewportMargin - summaryRect.bottom - actionMenuGap;
  const spaceAbove = summaryRect.top - visibleBounds.top - actionMenuViewportMargin - actionMenuGap;
  const shouldFlip = panelHeight > spaceBelow && spaceAbove > spaceBelow;

  setTaskActionMenuFlipped(taskId, shouldFlip);
}

function getTaskActionMenuVisibleBounds(menu, viewportHeight) {
  const visibleBounds = {
    top: 0,
    bottom: viewportHeight
  };
  let element = menu.parentElement;

  while (element && element !== document.body && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    const overflowY = `${style.overflowY} ${style.overflow}`.toLowerCase();

    if (/(auto|scroll|hidden|clip)/u.test(overflowY)) {
      const rect = element.getBoundingClientRect();
      visibleBounds.top = Math.max(visibleBounds.top, rect.top);
      visibleBounds.bottom = Math.min(visibleBounds.bottom, rect.bottom);
    }

    element = element.parentElement;
  }

  return visibleBounds;
}

function findTaskInTree(tasks = [], taskId) {
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task?.id === taskId) {
      return task;
    }

    const childTask = findTaskInTree(getTaskChildren(task), taskId);

    if (childTask) {
      return childTask;
    }
  }

  return null;
}

function getDragRootTasks() {
  return Array.isArray(rootTaskList?.value) ? rootTaskList.value : props.tasks;
}

function isTaskDescendant(task, descendantTaskId) {
  if (!task || !descendantTaskId) {
    return false;
  }

  return getTaskChildren(task).some((child) => child?.id === descendantTaskId || isTaskDescendant(child, descendantTaskId));
}

function getDragTaskId(event) {
  return String(
    event?.dataTransfer?.getData("text/x-gordon-weekly-task-id") ||
      event?.dataTransfer?.getData("text/plain") ||
      draggingTaskId.value ||
      ""
  ).trim();
}

function hasDragTaskPayload(event) {
  const dataTransferTypes = Array.from(event?.dataTransfer?.types ?? []);

  return Boolean(getDragTaskId(event) || dataTransferTypes.includes("text/x-gordon-weekly-task-id"));
}

function canDropTask(sourceTaskId, targetTaskId) {
  if (!sourceTaskId || sourceTaskId === targetTaskId) {
    return false;
  }

  const sourceTask = findTaskInTree(getDragRootTasks(), sourceTaskId);

  if (!sourceTask) {
    return false;
  }

  return !targetTaskId || !isTaskDescendant(sourceTask, targetTaskId);
}

function resetDragState() {
  draggingTaskId.value = "";
  dropTargetTaskId.value = "";
  rootDropProjectId.value = "";
}

function handleStatusSummaryClick(taskId, event) {
  if (suppressStatusClickTaskId.value !== taskId) {
    return;
  }

  event?.preventDefault?.();
  event?.stopPropagation?.();
  suppressStatusClickTaskId.value = "";
}

function setTaskDragPreview(event) {
  const rowElement = event?.currentTarget?.closest?.(".weekly-task-row");

  if (!(rowElement instanceof HTMLElement) || !event?.dataTransfer?.setDragImage) {
    return;
  }

  const dragPreview = rowElement.cloneNode(true);
  dragPreview.classList.add("weekly-task-drag-preview");
  dragPreview.style.position = "fixed";
  dragPreview.style.top = "-1000px";
  dragPreview.style.left = "-1000px";
  dragPreview.style.width = `${Math.max(rowElement.getBoundingClientRect().width, 240)}px`;
  dragPreview.style.pointerEvents = "none";
  document.body.appendChild(dragPreview);
  event.dataTransfer.setDragImage(dragPreview, 18, 16);
  window.setTimeout(() => dragPreview.remove(), 0);
}

function handleTaskDragStart(taskId, event) {
  if (isTaskRewriting(taskId)) {
    event?.preventDefault?.();
    return;
  }

  draggingTaskId.value = taskId;
  dropTargetTaskId.value = "";
  rootDropProjectId.value = "";
  suppressStatusClickTaskId.value = taskId;

  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    event.dataTransfer.setData("text/x-gordon-weekly-task-id", taskId);
    event.dataTransfer.setData("text/x-gordon-weekly-project-id", props.projectId);
  }

  setTaskDragPreview(event);
}

function handleTaskDragEnd(taskId) {
  resetDragState();
  window.setTimeout(() => {
    if (suppressStatusClickTaskId.value === taskId) {
      suppressStatusClickTaskId.value = "";
    }
  }, 240);
}

function handleTaskDragOver(taskId, event) {
  const sourceTaskId = getDragTaskId(event);

  if (!canDropTask(sourceTaskId, taskId)) {
    if (dropTargetTaskId.value === taskId) {
      dropTargetTaskId.value = "";
    }

    return;
  }

  dropTargetTaskId.value = taskId;
  rootDropProjectId.value = "";

  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleTaskDragLeave(taskId) {
  if (dropTargetTaskId.value === taskId) {
    dropTargetTaskId.value = "";
  }
}

function handleTaskDrop(targetTaskId, event) {
  const sourceTaskId = getDragTaskId(event);

  if (!canDropTask(sourceTaskId, targetTaskId)) {
    resetDragState();
    return;
  }

  emit("move-task", { projectId: props.projectId, sourceTaskId, targetParentTaskId: targetTaskId });
  collapsedTaskIds.value = new Set([...collapsedTaskIds.value].filter((taskId) => taskId !== targetTaskId));
  resetDragState();
}

function handleRootDragOver(event) {
  if (!isProjectRootTree.value) {
    return;
  }

  const sourceTaskId = getDragTaskId(event);

  if (!sourceTaskId && !hasDragTaskPayload(event)) {
    return;
  }

  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  if (!dropTargetTaskId.value) {
    rootDropProjectId.value = props.projectId;
  }
}

function handleRootDragLeave(event) {
  if (!isProjectRootTree.value) {
    return;
  }

  const currentTarget = event?.currentTarget;
  const relatedTarget = event?.relatedTarget;

  if (currentTarget instanceof Node && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }

  rootDropProjectId.value = "";
}

function handleRootDrop(event) {
  if (!isProjectRootTree.value) {
    resetDragState();
    return;
  }

  const sourceTaskId = getDragTaskId(event);

  if (!sourceTaskId || dropTargetTaskId.value) {
    resetDragState();
    return;
  }

  emit("move-task", { projectId: props.projectId, sourceTaskId, targetParentTaskId: null });
  resetDragState();
}

function isEditingTask(taskId) {
  return activeEditorId.value === taskId;
}

function setTaskTitleInputRef(taskId, element) {
  if (element instanceof HTMLTextAreaElement) {
    taskTitleInputRefs.set(taskId, element);
    return;
  }

  taskTitleInputRefs.delete(taskId);
}

function activateTaskEditor(taskId) {
  if (isTaskRewriting(taskId)) {
    return;
  }

  activeEditorId.value = taskId;
  nextTick(() => {
    const input = taskTitleInputRefs.get(taskId);

    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    resizeTaskTitleEditor(input);
    input.focus();
    const cursor = input.value.length;
    input.setSelectionRange(cursor, cursor);
  });
}

function deactivateTaskEditor(taskId) {
  if (activeEditorId.value === taskId) {
    activeEditorId.value = null;
  }
}

function handleTaskTitleInput(taskId, event) {
  const input = event?.target;

  if (input instanceof HTMLTextAreaElement) {
    resizeTaskTitleEditor(input);
  }

  emit("touch-task", { projectId: props.projectId, taskId });
}

function resizeTaskTitleEditor(input) {
  input.style.height = "0px";
  input.style.height = `${Math.min(Math.max(input.scrollHeight, 40), 148)}px`;
}

function getTaskIndexLabel(taskIndex) {
  return [...props.path, taskIndex + 1].join(".");
}

function getStatusLabel(status) {
  return props.statusMeta?.[status]?.label ?? props.statusMeta?.planned?.label ?? "待开始";
}
</script>
