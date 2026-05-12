<template>
  <aside v-if="state.isAiDrawerOpen" class="writing-ai-card writing-ai-drawer comic-ai-drawer">
    <div class="writing-ai-head">
      <div>
        <p class="feature-kicker">AI Copilot</p>
        <p class="model-section-title">丹青画室</p>
      </div>
    </div>

    <div class="field writing-ai-task-field">
      <span class="field-label">绘图动作</span>
      <div class="writing-ai-task-dropdown" :class="{ 'is-open': state.isAiTaskPickerOpen }">
        <button
          type="button"
          class="writing-ai-task-dropdown-trigger"
          :aria-expanded="state.isAiTaskPickerOpen ? 'true' : 'false'"
          aria-haspopup="listbox"
          @click="toggleComicAiTaskPicker"
        >
          <span>{{ activeComicAiTask?.label ?? "选择任务" }}</span>
          <GIcon name="chevronDown" />
        </button>
        <p v-if="activeComicTaskTarget" class="writing-ai-task-target">{{ activeComicTaskTarget }}</p>

        <div v-if="state.isAiTaskPickerOpen" class="writing-ai-task-dropdown-menu" role="listbox">
          <button
            v-for="task in activeComicAiTaskOptions"
            :key="task.id"
            type="button"
            class="writing-ai-task-dropdown-item"
            :class="{ 'is-active': activeComicAiTask?.id === task.id }"
            role="option"
            :aria-selected="activeComicAiTask?.id === task.id ? 'true' : 'false'"
            @click="selectComicAiTask(task.id)"
          >
            <span>{{ task.label }}</span>
            <small>{{ task.goal }}</small>
            <em>{{ task.target }}</em>
          </button>
        </div>
      </div>
    </div>

    <div v-if="isImageTask" class="comic-ai-control-grid">
      <div class="field comic-ai-control-field">
        <span class="field-label">数量</span>
        <div class="comic-ai-control-picker" :class="{ 'is-open': activeControlPicker === 'count' }">
          <button
            type="button"
            class="comic-ai-control-trigger"
            :aria-expanded="activeControlPicker === 'count' ? 'true' : 'false'"
            aria-haspopup="listbox"
            @click="toggleControlPicker('count')"
          >
            <span>{{ state.aiImageCount }} 张</span>
            <GIcon name="chevronDown" />
          </button>
          <div v-if="activeControlPicker === 'count'" class="comic-ai-control-menu" role="listbox">
            <button
              v-for="count in comicAiCountOptions"
              :key="count"
              type="button"
              class="comic-ai-control-item"
              :class="{ 'is-active': Number(state.aiImageCount) === count }"
              role="option"
              :aria-selected="Number(state.aiImageCount) === count ? 'true' : 'false'"
              @click="selectComicAiCount(count)"
            >
              {{ count }} 张
            </button>
          </div>
        </div>
      </div>

      <div class="field comic-ai-control-field">
        <span class="field-label">尺寸</span>
        <div class="comic-ai-control-picker" :class="{ 'is-open': activeControlPicker === 'size' }">
          <button
            type="button"
            class="comic-ai-control-trigger"
            :aria-expanded="activeControlPicker === 'size' ? 'true' : 'false'"
            aria-haspopup="listbox"
            @click="toggleControlPicker('size')"
          >
            <span>{{ activeImageSizeLabel }}</span>
            <GIcon name="chevronDown" />
          </button>
          <div v-if="activeControlPicker === 'size'" class="comic-ai-control-menu" role="listbox">
            <button
              v-for="option in comicAiImageSizeOptions"
              :key="option.value"
              type="button"
              class="comic-ai-control-item"
              :class="{ 'is-active': state.aiImageSize === option.value }"
              role="option"
              :aria-selected="state.aiImageSize === option.value ? 'true' : 'false'"
              @click="selectComicAiImageSize(option.value)"
            >
              <span>{{ option.label }}</span>
              <small>{{ option.value }}</small>
            </button>
          </div>
        </div>
      </div>

      <div class="field comic-ai-control-field">
        <span class="field-label">质量</span>
        <div class="comic-ai-control-picker" :class="{ 'is-open': activeControlPicker === 'quality' }">
          <button
            type="button"
            class="comic-ai-control-trigger"
            :aria-expanded="activeControlPicker === 'quality' ? 'true' : 'false'"
            aria-haspopup="listbox"
            @click="toggleControlPicker('quality')"
          >
            <span>{{ activeImageQualityLabel }}</span>
            <GIcon name="chevronDown" />
          </button>
          <div v-if="activeControlPicker === 'quality'" class="comic-ai-control-menu" role="listbox">
            <button
              v-for="option in comicAiQualityOptions"
              :key="option.value"
              type="button"
              class="comic-ai-control-item"
              :class="{ 'is-active': state.aiQuality === option.value }"
              role="option"
              :aria-selected="state.aiQuality === option.value ? 'true' : 'false'"
              @click="selectComicAiImageQuality(option.value)"
            >
              <span>{{ option.label }}</span>
              <small>{{ option.value }}</small>
            </button>
          </div>
        </div>
      </div>
    </div>

    <section class="writing-ai-instruction" :class="{ 'is-open': isAiInstructionOpen }">
      <button
        type="button"
        class="writing-ai-instruction-toggle"
        :aria-expanded="isAiInstructionOpen ? 'true' : 'false'"
        aria-controls="comic-ai-instruction-input"
        @click="toggleAiInstructionOpen"
      >
        <span>额外要求</span>
        <small v-if="hasAiInstruction">已填写</small>
        <GIcon name="chevronDown" />
      </button>
      <textarea
        v-if="isAiInstructionOpen"
        id="comic-ai-instruction-input"
        :value="state.aiInstruction"
        class="field-textarea writing-ai-input"
        placeholder="例如：更像热血少年漫；保持同一角色服装；第 3 张给近景。"
        @input="setComicAiInstruction($event.target.value)"
      ></textarea>
    </section>

    <section class="writing-prompt-preview" :class="{ 'is-open': state.isPromptPreviewOpen }">
      <button
        type="button"
        class="writing-prompt-preview-toggle"
        :aria-expanded="state.isPromptPreviewOpen ? 'true' : 'false'"
        @click="toggleComicAiPromptPreview"
      >
        <span>出图提示词</span>
        <GIcon name="chevronDown" />
      </button>
      <div v-if="state.isPromptPreviewOpen" class="writing-prompt-preview-body comic-ai-prompt-preview-body">
        <pre>{{ activeComicAiPromptPreview }}</pre>
      </div>
    </section>

    <div class="writing-ai-run-row comic-ai-run-row">
      <button type="button" class="model-action-secondary writing-ai-run" :disabled="state.isAiRunning" @click="generateComicAiOutput">
        {{ getComicAiRunButtonLabel() }}
      </button>
    </div>

    <div class="writing-ai-output comic-ai-output">
      <div class="writing-ai-output-head">
        <span class="field-label">生成结果</span>
        <span v-if="state.aiFeedback" class="status-pill" :class="getComicAiFeedbackClass()">
          {{ state.aiFeedback }}
        </span>
      </div>

      <div v-if="isImageTask && hasGeneratedImages" class="comic-ai-image-grid">
        <figure v-for="(image, index) in state.aiGeneratedImages" :key="image.id || index" class="comic-ai-image-card">
          <img :src="image.src" :alt="image.title || `生成图片 ${index + 1}`" />
          <figcaption>
            <span>{{ image.title || `生成图片 ${index + 1}` }}</span>
            <small v-if="image.meta">{{ image.meta }}</small>
          </figcaption>
        </figure>
      </div>

      <textarea
        :value="state.aiOutput"
        class="field-textarea writing-ai-output-textarea comic-ai-output-textarea"
        :placeholder="isImageTask ? '生成结果、图片摘要或最终提示词会出现在这里。' : '大模型生成的漫画介绍、规划或目录会出现在这里。'"
        @input="setComicAiOutput($event.target.value)"
      ></textarea>

      <div v-if="!isReviewTask" class="model-section-actions comic-ai-output-actions">
        <button v-if="isImageTask" type="button" class="model-action-secondary" :disabled="state.isAiRunning" @click="applyComicAiOutput('prompt')">
          写入提示词
        </button>
        <button type="button" class="model-action-secondary" :disabled="state.isAiRunning || !canWriteContent" @click="applyComicAiOutput('append')">
          追加
        </button>
        <button type="button" class="model-action-secondary" :disabled="state.isAiRunning || !canWriteContent" @click="applyComicAiOutput('replace')">
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
  activeComicAiTask: { type: Object, default: null },
  activeComicAiTaskOptions: { type: Array, default: () => [] },
  activeComicAiPromptPreview: { type: String, default: "" },
  comicAiImageSizeOptions: { type: Array, default: () => [] },
  comicAiQualityOptions: { type: Array, default: () => [] },
  toggleComicAiTaskPicker: { type: Function, required: true },
  selectComicAiTask: { type: Function, required: true },
  toggleComicAiPromptPreview: { type: Function, required: true },
  setComicAiInstruction: { type: Function, required: true },
  setComicAiOutput: { type: Function, required: true },
  setComicAiImageCount: { type: Function, required: true },
  setComicAiImageSize: { type: Function, required: true },
  setComicAiImageQuality: { type: Function, required: true },
  generateComicAiOutput: { type: Function, required: true },
  getComicAiRunButtonLabel: { type: Function, required: true },
  getComicAiFeedbackClass: { type: Function, required: true },
  applyComicAiOutput: { type: Function, required: true }
});

const isAiInstructionOpen = ref(Boolean(props.state.aiInstruction?.trim()));
const activeControlPicker = ref("");
const comicAiCountOptions = Array.from({ length: 10 }, (_, index) => index + 1);
const hasAiInstruction = computed(() => Boolean(props.state.aiInstruction?.trim()));
const isImageTask = computed(() => props.activeComicAiTask?.type === "image");
const isReviewTask = computed(() => props.activeComicAiTask?.writeMode === "review");
const activeComicTaskTarget = computed(() => String(props.activeComicAiTask?.target ?? ""));
const hasGeneratedImages = computed(() => Array.isArray(props.state.aiGeneratedImages) && props.state.aiGeneratedImages.length > 0);
const canWriteContent = computed(() => hasGeneratedImages.value || Boolean(props.state.aiOutput?.trim()));
const activeImageSizeLabel = computed(
  () => props.comicAiImageSizeOptions.find((option) => option.value === props.state.aiImageSize)?.label ?? props.state.aiImageSize
);
const activeImageQualityLabel = computed(
  () => props.comicAiQualityOptions.find((option) => option.value === props.state.aiQuality)?.label ?? props.state.aiQuality
);

function toggleAiInstructionOpen() {
  isAiInstructionOpen.value = !isAiInstructionOpen.value;
}

function toggleControlPicker(pickerId) {
  activeControlPicker.value = activeControlPicker.value === pickerId ? "" : pickerId;
}

function closeControlPicker() {
  activeControlPicker.value = "";
}

function selectComicAiCount(count) {
  props.setComicAiImageCount(count);
  closeControlPicker();
}

function selectComicAiImageSize(value) {
  props.setComicAiImageSize(value);
  closeControlPicker();
}

function selectComicAiImageQuality(value) {
  props.setComicAiImageQuality(value);
  closeControlPicker();
}

watch(
  () => props.state.aiInstruction,
  (value) => {
    if (value?.trim()) {
      isAiInstructionOpen.value = true;
    }
  }
);

watch(isImageTask, (value) => {
  if (!value) {
    closeControlPicker();
  }
});
</script>
