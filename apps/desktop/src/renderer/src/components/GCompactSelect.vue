<template>
  <div
    ref="rootRef"
    class="compact-select"
    :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
    @keydown="handleKeydown"
  >
    <button
      type="button"
      class="compact-select-trigger"
      :disabled="disabled"
      :aria-label="ariaLabel || selectedLabel"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <span>{{ selectedLabel }}</span>
      <GIcon name="chevronDown" :size="13" />
    </button>

    <Transition name="compact-select-menu">
      <div v-if="isOpen" class="compact-select-menu" role="listbox">
        <button
          v-for="option in normalizedOptions"
          :key="option.value"
          type="button"
          class="compact-select-option"
          :class="{ 'is-selected': isSelected(option.value) }"
          role="option"
          :aria-selected="isSelected(option.value) ? 'true' : 'false'"
          @click.stop="choose(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import GIcon from "./GIcon.vue";

const props = defineProps({
  ariaLabel: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  modelValue: { type: [String, Number], default: "" },
  options: { type: Array, required: true },
  placeholder: { type: String, default: "请选择" }
});

const emit = defineEmits(["update:modelValue", "change"]);

const rootRef = ref(null);
const isOpen = ref(false);

const normalizedOptions = computed(() =>
  props.options
    .map((option) => ({
      label: String(option?.label ?? option?.value ?? ""),
      value: String(option?.value ?? "")
    }))
    .filter((option) => option.value)
);

const selectedOption = computed(() => normalizedOptions.value.find((option) => isSelected(option.value)) ?? null);
const selectedLabel = computed(() => selectedOption.value?.label ?? props.placeholder);

function isSelected(value) {
  return String(props.modelValue ?? "") === String(value ?? "");
}

function toggle() {
  if (props.disabled) {
    return;
  }

  isOpen.value = !isOpen.value;
}

function choose(value) {
  if (props.disabled) {
    return;
  }

  emit("update:modelValue", value);
  emit("change", value);
  isOpen.value = false;
}

function handleDocumentPointerDown(event) {
  if (!isOpen.value || !rootRef.value || rootRef.value.contains(event.target)) {
    return;
  }

  isOpen.value = false;
}

function handleKeydown(event) {
  if (props.disabled) {
    return;
  }

  if (event.key === "Escape") {
    isOpen.value = false;
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggle();
  }
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      isOpen.value = false;
    }
  }
);

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>
