<template>
  <aside v-if="state.isAiDrawerOpen" class="writing-ai-card writing-ai-drawer writing-assistant-drawer">
    <div class="writing-ai-head">
      <div>
        <p class="feature-kicker">AI Copilot</p>
        <p class="model-section-title">添香小筑</p>
      </div>
    </div>

    <div class="field writing-ai-task-field">
      <span class="field-label">写作动作</span>
      <div class="writing-ai-task-dropdown" :class="{ 'is-open': state.isAiTaskPickerOpen }">
        <button
          type="button"
          class="writing-ai-task-dropdown-trigger"
          :aria-expanded="state.isAiTaskPickerOpen ? 'true' : 'false'"
          aria-haspopup="listbox"
          @click="toggleWritingAiTaskPicker"
        >
          <span>{{ activeWritingTask?.label ?? "选择任务" }}</span>
          <GIcon name="chevronDown" />
        </button>
        <p v-if="activeWritingTaskTarget" class="writing-ai-task-target">{{ activeWritingTaskTarget }}</p>

        <div v-if="state.isAiTaskPickerOpen" class="writing-ai-task-dropdown-menu" role="listbox">
          <button
            v-for="task in activeWritingTaskOptions"
            :key="task.id"
            type="button"
            class="writing-ai-task-dropdown-item"
            :class="{ 'is-active': activeWritingTask?.id === task.id }"
            role="option"
            :aria-selected="activeWritingTask?.id === task.id ? 'true' : 'false'"
            @click="selectWritingAiTask(task.id)"
          >
            <span class="writing-ai-task-item-head">
              <strong>{{ task.label }}</strong>
              <b v-if="task.stage">{{ task.stage }}</b>
            </span>
            <small>{{ task.goal }}</small>
            <em v-if="getWritingTaskTarget(task)">{{ getWritingTaskTarget(task) }}</em>
          </button>
        </div>
      </div>
    </div>

    <section class="writing-ai-instruction" :class="{ 'is-open': isAiInstructionOpen }">
      <button
        type="button"
        class="writing-ai-instruction-toggle"
        :aria-expanded="isAiInstructionOpen ? 'true' : 'false'"
        aria-controls="writing-ai-instruction-input"
        @click="toggleAiInstructionOpen"
      >
        <span>额外要求</span>
        <small v-if="hasAiInstruction">已填写</small>
        <GIcon name="chevronDown" />
      </button>
      <textarea
        v-if="isAiInstructionOpen"
        id="writing-ai-instruction-input"
        v-model="state.aiInstruction"
        class="field-textarea writing-ai-input"
        placeholder="例如：更黑暗、更史诗；补一条反派线；第 3 章必须反转。"
      ></textarea>
    </section>

    <section class="writing-prompt-preview" :class="{ 'is-open': state.isPromptPreviewOpen }">
      <button
        type="button"
        class="writing-prompt-preview-toggle"
        :aria-expanded="state.isPromptPreviewOpen ? 'true' : 'false'"
        @click="toggleWritingPromptPreview"
      >
        <span>提示词预览</span>
        <GIcon name="chevronDown" />
      </button>
      <div v-if="state.isPromptPreviewOpen" class="writing-prompt-preview-body">
        <pre>{{ activeWritingPromptPreview }}</pre>
      </div>
    </section>

    <section v-if="activeWritingLongOutlineRequest || activeWritingOutlinePlannerJob" class="writing-outline-planner-card">
      <div class="writing-outline-planner-head">
        <div>
          <p class="feature-kicker">Long Plan</p>
          <p class="writing-outline-planner-title">
            {{ activeWritingOutlinePlannerJob ? getWritingOutlinePlannerStatusLabel(activeWritingOutlinePlannerJob) : "长篇分批规划" }}
          </p>
        </div>
        <span
          v-if="activeWritingOutlinePlannerJob"
          class="status-pill"
          :class="getWritingOutlinePlannerStatusClass(activeWritingOutlinePlannerJob)"
        >
          {{ getWritingOutlinePlannerProgressPercent(activeWritingOutlinePlannerJob) }}%
        </span>
      </div>
      <p v-if="activeWritingLongOutlineRequest" class="writing-outline-planner-copy">
        {{ buildWritingLongOutlineTargetContent(activeWritingLongOutlineRequest) }}
      </p>
      <p v-if="activeWritingOutlinePlannerJob" class="writing-outline-planner-copy">
        {{ getWritingOutlinePlannerProgressCopy(activeWritingOutlinePlannerJob) }}
      </p>
      <div v-if="activeWritingOutlinePlannerJob" class="writing-outline-planner-progress" aria-hidden="true">
        <span :style="{ width: `${getWritingOutlinePlannerProgressPercent(activeWritingOutlinePlannerJob)}%` }"></span>
      </div>
      <p v-if="getWritingOutlinePlannerRetryCopy(activeWritingOutlinePlannerJob)" class="writing-outline-planner-retry">
        {{ getWritingOutlinePlannerRetryCopy(activeWritingOutlinePlannerJob) }}
      </p>
      <div v-if="canResumeWritingOutlinePlanner(activeWritingBook, activeWritingOutlinePlannerJob)" class="writing-outline-planner-actions">
        <button
          type="button"
          class="model-action-secondary writing-outline-planner-resume"
          :disabled="state.isAiRunning"
          @click="resumeWritingOutlinePlanningJob"
        >
          继续规划
        </button>
      </div>
      <p v-if="activeWritingOutlinePlannerJob?.error || activeWritingOutlinePlannerJob?.lastError" class="writing-outline-planner-error">
        {{ activeWritingOutlinePlannerJob.error || activeWritingOutlinePlannerJob.lastError }}
      </p>
    </section>

    <div class="writing-ai-output">
      <div class="writing-ai-output-head">
        <span class="field-label">AI 输出</span>
        <div class="writing-ai-output-tools">
          <button
            type="button"
            class="writing-ai-output-status"
            :class="writingAiOutputStatusClass"
            :aria-label="writingAiOutputStatusMessage"
            aria-describedby="writing-ai-output-status-tooltip"
          >
            <GIcon name="circleAlert" :size="16" />
            <span id="writing-ai-output-status-tooltip" class="writing-ai-output-status-tooltip" role="tooltip">
              {{ writingAiOutputStatusMessage }}
            </span>
          </button>
          <button type="button" class="model-action-secondary writing-ai-run" :disabled="state.isAiRunning" @click="generateWritingAssistantOutput">
            {{ getWritingAiRunButtonLabel() }}
          </button>
        </div>
      </div>
      <textarea
        v-model="state.aiOutput"
        class="field-textarea writing-ai-output-textarea"
        placeholder="生成结果会出现在这里。"
      ></textarea>
      <div class="model-section-actions">
        <button type="button" class="model-action-secondary" :disabled="!state.aiOutput" @click="applyWritingAssistantOutput('append')">
          追加
        </button>
        <button type="button" class="model-action-secondary" :disabled="!state.aiOutput" @click="applyWritingAssistantOutput('replace')">
          替换
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import GIcon from "../../components/GIcon.vue";

const props = defineProps({
  state: { type: Object, required: true },
  activeWritingTask: { type: Object, default: null },
  activeWritingTaskOptions: { type: Array, default: () => [] },
  activeWritingPromptPreview: { type: String, default: "" },
  activeWritingLongOutlineRequest: { type: Object, default: null },
  activeWritingOutlinePlannerJob: { type: Object, default: null },
  activeWritingBook: { type: Object, default: null },
  toggleWritingAiTaskPicker: { type: Function, required: true },
  selectWritingAiTask: { type: Function, required: true },
  toggleWritingPromptPreview: { type: Function, required: true },
  buildWritingLongOutlineTargetContent: { type: Function, required: true },
  getWritingOutlinePlannerStatusLabel: { type: Function, required: true },
  getWritingOutlinePlannerStatusClass: { type: Function, required: true },
  getWritingOutlinePlannerProgressPercent: { type: Function, required: true },
  getWritingOutlinePlannerProgressCopy: { type: Function, required: true },
  getWritingOutlinePlannerRetryCopy: { type: Function, required: true },
  canResumeWritingOutlinePlanner: { type: Function, required: true },
  resumeWritingOutlinePlanningJob: { type: Function, required: true },
  getWritingAiRunButtonLabel: { type: Function, required: true },
  generateWritingAssistantOutput: { type: Function, required: true },
  applyWritingAssistantOutput: { type: Function, required: true }
});

const isAiInstructionOpen = ref(Boolean(props.state.aiInstruction?.trim()));
const hasAiInstruction = computed(() => Boolean(props.state.aiInstruction?.trim()));
const activeWritingTaskTarget = computed(() => getWritingTaskTarget(props.activeWritingTask));
const writingAiOutputStatusMessage = computed(() => {
  const feedback = String(props.state.aiFeedback ?? "").trim();

  if (feedback) {
    return feedback;
  }

  if (props.state.isAiRunning) {
    return "正在执行 AI 任务";
  }

  return "暂无执行状态";
});
const writingAiOutputStatusClass = computed(() => {
  if (props.state.isAiRunning) {
    return "is-running";
  }

  if (props.state.aiFeedbackTone === "success") {
    return "is-success";
  }

  if (props.state.aiFeedbackTone === "danger") {
    return "is-danger";
  }

  if (props.state.aiFeedbackTone === "warning") {
    return "is-warning";
  }

  return "is-neutral";
});

function getWritingTaskTarget(task) {
  if (task?.id === "storySetup" || task?.id === "storyRefine") {
    return "写入：大纲指导";
  }

  return String(task?.target ?? "");
}

function toggleAiInstructionOpen() {
  isAiInstructionOpen.value = !isAiInstructionOpen.value;
}

watch(
  () => props.state.aiInstruction,
  (value) => {
    if (value?.trim()) {
      isAiInstructionOpen.value = true;
    }
  }
);
</script>
