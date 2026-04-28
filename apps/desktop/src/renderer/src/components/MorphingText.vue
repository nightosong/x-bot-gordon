<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  texts: {
    type: Array,
    default: () => []
  },
  baseText: {
    type: String,
    default: ""
  },
  randomTexts: {
    type: Array,
    default: () => []
  },
  morphTime: {
    type: Number,
    default: 1.4
  },
  coolDownTime: {
    type: Number,
    default: 0.55
  },
  ariaLabel: {
    type: String,
    default: ""
  }
});

function normalizeTextList(values) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((text) => String(text ?? "").trim())
    .filter((text) => {
      if (!text || seen.has(text)) {
        return false;
      }

      seen.add(text);
      return true;
    });
}

const normalizedTexts = computed(() => {
  const entries = normalizeTextList(props.texts);
  return entries.length ? entries : ["GORDON"];
});

const normalizedBaseText = computed(() => String(props.baseText ?? "").trim());
const randomTextPool = computed(() => {
  const baseKey = normalizedBaseText.value.toLowerCase();
  return normalizeTextList(props.randomTexts).filter((text) => text.toLowerCase() !== baseKey);
});
const hasRandomCycle = computed(() => Boolean(normalizedBaseText.value && randomTextPool.value.length));

const textIndex = ref(0);
const text1Ref = ref(null);
const text2Ref = ref(null);
const activeRandomText = ref("");
const filterId = `gordon-morphing-text-${Math.random().toString(36).slice(2, 10)}`;
const MAX_FRAME_DELTA_SECONDS = 1 / 30;

let animationFrameId = 0;
let reducedMotionTimerId = 0;
let lastTime = 0;
let morph = 0;
let coolDown = props.coolDownTime;
let reducedMotionQuery = null;

const accessibleLabel = computed(() => props.ariaLabel || normalizedBaseText.value || normalizedTexts.value[0]);

function pickRandomText(previousText = "") {
  const pool = randomTextPool.value;

  if (!pool.length) {
    return normalizedBaseText.value || normalizedTexts.value[0];
  }

  const candidates = pool.length > 1 ? pool.filter((text) => text !== previousText) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function ensureRandomText() {
  if (hasRandomCycle.value && !activeRandomText.value) {
    activeRandomText.value = pickRandomText();
  }
}

function getCurrentText() {
  if (hasRandomCycle.value) {
    ensureRandomText();
    return textIndex.value % 2 === 0 ? normalizedBaseText.value : activeRandomText.value;
  }

  return normalizedTexts.value[textIndex.value % normalizedTexts.value.length];
}

function getNextText() {
  if (hasRandomCycle.value) {
    ensureRandomText();
    return textIndex.value % 2 === 0 ? activeRandomText.value : normalizedBaseText.value;
  }

  return normalizedTexts.value[(textIndex.value + 1) % normalizedTexts.value.length];
}

function advanceText() {
  textIndex.value += 1;

  if (hasRandomCycle.value && textIndex.value % 2 === 0) {
    activeRandomText.value = pickRandomText(activeRandomText.value);
  }
}

function setLayerContent() {
  if (!text1Ref.value || !text2Ref.value) {
    return;
  }

  text1Ref.value.textContent = getCurrentText();
  text2Ref.value.textContent = getNextText();
}

function setStyles(fraction) {
  if (!text1Ref.value || !text2Ref.value) {
    return;
  }

  const nextFraction = Math.max(fraction, 0.001);
  const currentFraction = Math.max(1 - fraction, 0.001);

  setLayerContent();

  text2Ref.value.style.filter = `blur(${Math.min(8 / nextFraction - 8, 100)}px)`;
  text2Ref.value.style.opacity = `${Math.pow(nextFraction, 0.4)}`;
  text1Ref.value.style.filter = `blur(${Math.min(8 / currentFraction - 8, 100)}px)`;
  text1Ref.value.style.opacity = `${Math.pow(currentFraction, 0.4)}`;
}

function doCoolDown() {
  morph = 0;
  setLayerContent();

  if (text1Ref.value && text2Ref.value) {
    text1Ref.value.style.filter = "none";
    text1Ref.value.style.opacity = "1";
    text2Ref.value.style.filter = "none";
    text2Ref.value.style.opacity = "0";
  }
}

function doMorph() {
  morph -= coolDown;
  coolDown = 0;

  let fraction = morph / props.morphTime;

  if (fraction > 1) {
    coolDown = props.coolDownTime;
    fraction = 1;
  }

  setStyles(fraction);

  if (fraction === 1) {
    advanceText();
  }
}

function animate(timestamp) {
  animationFrameId = requestAnimationFrame(animate);

  if (!lastTime) {
    lastTime = timestamp;
  }

  const rawDelta = (timestamp - lastTime) / 1000;
  const delta = Math.min(Math.max(rawDelta, 0), MAX_FRAME_DELTA_SECONDS);
  lastTime = timestamp;
  coolDown -= delta;

  if (coolDown <= 0) {
    doMorph();
  } else {
    doCoolDown();
  }
}

function stopAnimation() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
  window.clearInterval(reducedMotionTimerId);
  reducedMotionTimerId = 0;
}

function startReducedMotionCycle() {
  doCoolDown();
  reducedMotionTimerId = window.setInterval(() => {
    advanceText();
    doCoolDown();
  }, Math.max(1200, (props.morphTime + props.coolDownTime) * 1000));
}

function startAnimation() {
  stopAnimation();
  lastTime = 0;
  morph = 0;
  coolDown = props.coolDownTime;

  if (reducedMotionQuery?.matches) {
    startReducedMotionCycle();
    return;
  }

  doCoolDown();
  animationFrameId = requestAnimationFrame(animate);
}

watch(
  [normalizedBaseText, randomTextPool, normalizedTexts],
  () => {
    textIndex.value = 0;
    activeRandomText.value = pickRandomText();
    doCoolDown();
  },
  { deep: true }
);

onMounted(() => {
  reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionQuery.addEventListener("change", startAnimation);
  startAnimation();
});

onBeforeUnmount(() => {
  stopAnimation();
  reducedMotionQuery?.removeEventListener("change", startAnimation);
});
</script>

<template>
  <h1
    class="morphing-text"
    :aria-label="accessibleLabel"
    :style="{ filter: `url(#${filterId}) blur(0.45px) drop-shadow(0 0 16px rgba(92, 225, 194, 0.12))` }"
  >
    <span
      ref="text1Ref"
      class="morphing-text-layer"
      aria-hidden="true"
    ></span>
    <span
      ref="text2Ref"
      class="morphing-text-layer"
      aria-hidden="true"
    ></span>

    <svg class="morphing-text-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter :id="filterId">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 255 -140"
          />
        </filter>
      </defs>
    </svg>
  </h1>
</template>
