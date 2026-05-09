<template>
  <Transition name="gordon-dialog-fade">
    <div v-if="dialog.open" class="gordon-dialog-backdrop" @click.self="$emit('backdrop')">
      <section
        class="gordon-dialog"
        :class="[`is-${dialog.tone}`, `is-${dialog.kind}`]"
        role="dialog"
        aria-modal="true"
        :aria-label="dialog.title"
      >
        <div class="gordon-dialog-head">
          <div class="gordon-dialog-mark" aria-hidden="true">
            <GIcon :name="dialog.tone === 'danger' ? 'delete' : dialog.kind === 'confirm' ? 'settings' : 'more'" />
          </div>

          <div>
            <p class="gordon-dialog-kicker">
              {{ dialog.kind === "confirm" ? "Confirm" : dialog.kind === "input" ? "Input" : "Notice" }}
            </p>
            <h2 class="gordon-dialog-title">{{ dialog.title }}</h2>
          </div>
        </div>

        <p v-if="dialog.message" class="gordon-dialog-message">{{ dialog.message }}</p>

        <div v-if="dialog.detailLines.length" class="gordon-dialog-detail">
          <p v-for="line in dialog.detailLines" :key="line">{{ line }}</p>
        </div>

        <label v-if="dialog.kind === 'input'" class="gordon-dialog-field">
          <span class="gordon-dialog-field-label">{{ dialog.inputLabel }}</span>
          <input
            ref="inputRef"
            v-model="dialog.inputValue"
            class="gordon-dialog-input"
            type="text"
            :placeholder="dialog.inputPlaceholder"
            @keydown.enter.prevent="$emit('resolve', true)"
          />
        </label>

        <div class="gordon-dialog-actions">
          <button
            v-if="dialog.kind !== 'alert'"
            type="button"
            class="gordon-dialog-button gordon-dialog-button-secondary"
            @click="$emit('resolve', false)"
          >
            {{ dialog.cancelText }}
          </button>

          <button
            ref="primaryRef"
            type="button"
            class="gordon-dialog-button gordon-dialog-button-primary"
            @click="$emit('resolve', true)"
          >
            {{ dialog.confirmText }}
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";

import GIcon from "./GIcon.vue";

const props = defineProps({
  dialog: { type: Object, required: true }
});

defineEmits(["backdrop", "resolve"]);

const inputRef = ref(null);
const primaryRef = ref(null);

watch(
  () => props.dialog.open,
  async (open) => {
    if (!open) {
      return;
    }

    await nextTick();

    if (props.dialog.kind === "input" && inputRef.value instanceof HTMLInputElement) {
      inputRef.value.focus();
      inputRef.value.select();
    } else if (primaryRef.value instanceof HTMLElement) {
      primaryRef.value.focus();
    }
  }
);
</script>
