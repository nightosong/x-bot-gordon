<template>
  <div class="saber-theme-backdrop" :class="{ 'is-home': activeBackgroundIsHome }" aria-hidden="true">
    <Transition name="saber-backdrop-fade">
      <div
        :key="activeBackground.id"
        class="saber-theme-backdrop-image"
        :class="{ 'is-home': activeBackgroundIsHome }"
        :style="{
          backgroundImage: `url(${activeBackground.url})`,
          backgroundPosition: activeBackground.position
        }"
      ></div>
    </Transition>
    <div class="saber-theme-backdrop-scrim"></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { FEATURE_HOME } from "./shellConfig.js";
import {
  SABER_BACKGROUND_ROTATION_INTERVAL_MS,
  SABER_HOME_BACKGROUND,
  SABER_ROTATION_BACKGROUNDS,
  SABER_TAB_BACKGROUND_CHANGE_DELAY_MS,
  SABER_TAB_BACKGROUND_MIN_DWELL_MS,
  getNextSaberBackgroundIndex,
  preloadSaberBackgroundWindow,
  preloadSaberThemeImages
} from "./saberThemeAssets.js";

const props = defineProps({
  activeFeature: { type: String, required: true }
});

const rotationIndex = ref(0);
const activeBackground = ref(
  props.activeFeature === FEATURE_HOME ? SABER_HOME_BACKGROUND : SABER_ROTATION_BACKGROUNDS[0]
);
let rotationTimer = null;
let pendingBackgroundTimer = null;
let lastRotationBackgroundChangeAt = 0;

const isHome = computed(() => props.activeFeature === FEATURE_HOME);
const activeBackgroundIsHome = computed(() => activeBackground.value.id === SABER_HOME_BACKGROUND.id);

function getRotationBackground(index) {
  return SABER_ROTATION_BACKGROUNDS[index % SABER_ROTATION_BACKGROUNDS.length];
}

function applyRotationBackground(index) {
  rotationIndex.value = index;
  activeBackground.value = getRotationBackground(index);
  lastRotationBackgroundChangeAt = getTransitionClock();
}

function cancelPendingBackgroundChange() {
  if (pendingBackgroundTimer) {
    window.clearTimeout(pendingBackgroundTimer);
    pendingBackgroundTimer = null;
  }
}

function getTransitionClock() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getSettledBackgroundDelay(delayMs) {
  if (!lastRotationBackgroundChangeAt) {
    return delayMs;
  }

  const remainingDwellMs =
    SABER_TAB_BACKGROUND_MIN_DWELL_MS - (getTransitionClock() - lastRotationBackgroundChangeAt);

  return Math.max(delayMs, remainingDwellMs, 0);
}

function advanceRotationBackground({
  delayMs = 0,
  restartTimerAfterChange = false,
  honorMinimumDwell = false
} = {}) {
  const nextIndex = getNextSaberBackgroundIndex(rotationIndex.value);
  preloadSaberBackgroundWindow(nextIndex);

  cancelPendingBackgroundChange();

  const settledDelayMs = honorMinimumDwell ? getSettledBackgroundDelay(delayMs) : delayMs;

  if (settledDelayMs <= 0) {
    applyRotationBackground(nextIndex);
    return;
  }

  pendingBackgroundTimer = window.setTimeout(() => {
    pendingBackgroundTimer = null;

    if (isHome.value || document.visibilityState === "hidden") {
      return;
    }

    applyRotationBackground(nextIndex);

    if (restartTimerAfterChange) {
      startRotationTimer();
    }
  }, settledDelayMs);
}

function stopRotationTimer() {
  if (rotationTimer) {
    window.clearInterval(rotationTimer);
    rotationTimer = null;
  }
}

function startRotationTimer() {
  stopRotationTimer();

  if (isHome.value || document.visibilityState === "hidden") {
    return;
  }

  rotationTimer = window.setInterval(() => {
    advanceRotationBackground();
  }, SABER_BACKGROUND_ROTATION_INTERVAL_MS);
}

function handleVisibilityChange() {
  if (document.visibilityState === "hidden" || isHome.value) {
    cancelPendingBackgroundChange();
    stopRotationTimer();
    return;
  }

  startRotationTimer();
}

onMounted(() => {
  preloadSaberThemeImages();
  preloadSaberBackgroundWindow(rotationIndex.value);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (!isHome.value) {
    startRotationTimer();
  }
});

watch(
  () => props.activeFeature,
  (nextFeature, previousFeature) => {
    if (!previousFeature || nextFeature === previousFeature) {
      return;
    }

    stopRotationTimer();

    if (nextFeature === FEATURE_HOME) {
      cancelPendingBackgroundChange();
      activeBackground.value = SABER_HOME_BACKGROUND;
      return;
    }

    advanceRotationBackground({
      delayMs: SABER_TAB_BACKGROUND_CHANGE_DELAY_MS,
      restartTimerAfterChange: true,
      honorMinimumDwell: true
    });
  }
);

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  cancelPendingBackgroundChange();
  stopRotationTimer();
});
</script>
