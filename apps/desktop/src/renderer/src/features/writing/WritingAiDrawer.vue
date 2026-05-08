<template>
  <aside v-if="state.isAiDrawerOpen" class="writing-ai-card writing-ai-drawer">
    <div class="writing-ai-head">
      <div>
        <p class="feature-kicker">AI Copilot</p>
        <p class="model-section-title">大师辅助</p>
      </div>
    </div>

    <div class="field writing-ai-task-field">
      <span class="field-label">辅助任务</span>
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
            <span>{{ task.label }}</span>
            <small>{{ task.goal }}</small>
          </button>
        </div>
      </div>
    </div>

    <label class="field">
      <span class="field-label">额外要求</span>
      <textarea
        v-model="state.aiInstruction"
        class="field-textarea writing-ai-input"
        placeholder="例如：更黑暗、更史诗；补一条反派线；第 3 章必须反转。"
      ></textarea>
    </label>

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

    <div class="writing-ai-run-row">
      <button type="button" class="model-action writing-ai-run" :disabled="state.isAiRunning" @click="generateWritingAssistantOutput">
        {{ getWritingAiRunButtonLabel() }}
      </button>
    </div>

    <div class="writing-ai-output">
      <div class="writing-ai-output-head">
        <span class="field-label">AI 输出</span>
        <span v-if="state.aiFeedback" class="status-pill" :class="getWritingAiFeedbackClass()">
          {{ state.aiFeedback }}
        </span>
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
import GIcon from "../../components/GIcon.vue";

defineProps({
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
  getWritingAiFeedbackClass: { type: Function, required: true },
  applyWritingAssistantOutput: { type: Function, required: true }
});
</script>
