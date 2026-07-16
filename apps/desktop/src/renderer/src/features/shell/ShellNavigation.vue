<template>
  <section class="left-column">
    <section class="brand-panel">
      <div class="brand-panel-head">
        <div class="brand-lockup">
          <MorphingText
            class="brand-title"
            base-text="GORDON"
            :random-texts="BRAND_RANDOM_TEXTS"
            :morph-time="0.72"
            :base-hold-time="9"
            :alternate-hold-time="1.15"
            aria-label="GORDON"
          />
        </div>

        <details
          ref="homeSettingsMenuRef"
          class="home-settings-menu"
          :class="{ 'has-active-selection': isHomeSettingsFeature(activeFeature) }"
        >
          <summary aria-label="打开设置菜单">
            <GIcon name="settings" class="home-settings-trigger-gear" />
          </summary>

          <div class="home-settings-menu-panel">
            <button
              v-for="item in HOME_SETTINGS_ITEMS"
              :key="item.id"
              type="button"
              class="home-settings-item"
              :class="{ 'is-active': activeFeature === item.id }"
              @click="selectFeature(item.id)"
            >
              <GIcon :name="item.icon" :size="14" />
              <span class="home-settings-item-title">{{ item.title }}</span>
            </button>
          </div>
        </details>
      </div>
    </section>

    <section class="feature-panel">
      <nav class="feature-board" aria-label="主导航">
        <button
          v-for="entry in FEATURE_ENTRIES"
          :key="entry.id"
          type="button"
          class="feature-card"
          :class="{ 'is-active': entry.id === activeFeature }"
          :aria-label="`查看${entry.title}`"
          @click="selectFeature(entry.id)"
        >
          <span class="feature-card-icon" aria-hidden="true">
            <GIcon :name="entry.icon" :size="17" :stroke-width="1.9" />
          </span>
          <span class="feature-card-copy">
            <span class="feature-title">{{ entry.title }}</span>
            <span class="feature-kicker">{{ entry.kicker }}</span>
          </span>
          <span class="feature-card-indicator" aria-hidden="true"></span>
        </button>
      </nav>
    </section>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import GIcon from "../../components/GIcon.vue";
import MorphingText from "../../components/MorphingText.vue";
import {
  BRAND_RANDOM_TEXTS,
  FEATURE_ENTRIES,
  FEATURE_EXTENSIONS_MANAGEMENT,
  FEATURE_MODEL_MANAGEMENT,
  HOME_SETTINGS_ITEMS
} from "./shellConfig.js";

const props = defineProps({
  activeFeature: { type: String, required: true }
});

const emit = defineEmits(["select"]);

const homeSettingsMenuRef = ref(null);

function isHomeSettingsFeature(featureId) {
  return featureId === FEATURE_MODEL_MANAGEMENT || featureId === FEATURE_EXTENSIONS_MANAGEMENT;
}

function closeHomeSettingsMenu() {
  if (homeSettingsMenuRef.value) {
    homeSettingsMenuRef.value.open = false;
  }
}

function handleDocumentPointerDown(event) {
  const menu = homeSettingsMenuRef.value;

  if (!menu?.open) {
    return;
  }

  if (event.target instanceof Node && menu.contains(event.target)) {
    return;
  }

  closeHomeSettingsMenu();
}

function selectFeature(featureId) {
  closeHomeSettingsMenu();
  emit("select", featureId);
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
});

watch(() => props.activeFeature, closeHomeSettingsMenu);
</script>
