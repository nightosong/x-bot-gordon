<template>
  <section class="left-column">
    <section class="brand-panel">
      <div class="brand-panel-head">
        <div class="brand-lockup">
          <div class="brand-row">
            <MorphingText
              class="brand-title"
              base-text="GORDON"
              :random-texts="BRAND_RANDOM_TEXTS"
              aria-label="GORDON"
            />
          </div>
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
              <span class="home-settings-item-title">{{ item.title }}</span>
              <span class="home-settings-item-copy">{{ item.copy }}</span>
            </button>
          </div>
        </details>
      </div>
    </section>

    <section class="feature-panel">
      <div class="feature-board">
        <article
          v-for="(entry, index) in FEATURE_ENTRIES"
          :key="entry.id"
          :class="getFeatureCardClass(entry, index)"
          :data-graffiti="entry.kicker"
          role="button"
          tabindex="0"
          :aria-label="`查看${entry.title}`"
          @click="selectFeature(entry.id)"
          @keydown.enter.prevent="selectFeature(entry.id)"
          @keydown.space.prevent="selectFeature(entry.id)"
          @pointermove="handleCardPointerMove"
          @pointerleave="handleCardPointerLeave"
          @pointercancel="handleCardPointerLeave"
          @pointerup="handleCardPointerLeave"
        >
          <span class="feature-graffiti" aria-hidden="true" :data-text="entry.kicker"></span>

          <div v-if="entry.tier === 'flat'" class="feature-card-flat-row">
            <div>
              <p class="feature-kicker">{{ entry.kicker }}</p>
              <p class="feature-title">{{ entry.title }}</p>
            </div>
          </div>

          <template v-else>
            <p class="feature-kicker">{{ entry.kicker }}</p>
            <p class="feature-title">{{ entry.title }}</p>
          </template>
        </article>
      </div>
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

function resetTiltCard(card) {
  if (!(card instanceof HTMLElement)) {
    return;
  }

  card.style.setProperty("--rotate-x", "0deg");
  card.style.setProperty("--rotate-y", "0deg");
  card.style.setProperty("--lift", "0px");
}

function getFeatureCardClass(entry, index) {
  const classes = ["feature-card", "tilt-card", `feature-card-${entry.tier}`];

  if (entry.tier !== "flat") {
    classes.push(index % 2 === 1 ? "feature-card-align-right" : "feature-card-align-left");
  }

  if (entry.id === props.activeFeature) {
    classes.push("is-active");
  }

  return classes;
}

function handleCardPointerMove(event) {
  const card = event.currentTarget;

  if (!(card instanceof HTMLElement)) {
    return;
  }

  const bounds = card.getBoundingClientRect();
  const offsetX = event.clientX - bounds.left;
  const offsetY = event.clientY - bounds.top;
  const rotateY = ((offsetX / bounds.width) - 0.5) * 10;
  const rotateX = (0.5 - (offsetY / bounds.height)) * 10;

  card.style.setProperty("--rotate-x", `${rotateX.toFixed(2)}deg`);
  card.style.setProperty("--rotate-y", `${rotateY.toFixed(2)}deg`);
  card.style.setProperty("--lift", "-4px");
}

function handleCardPointerLeave(event) {
  resetTiltCard(event.currentTarget);
}

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
