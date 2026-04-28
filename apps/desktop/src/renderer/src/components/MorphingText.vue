<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  texts: {
    type: Array,
    required: true
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

const normalizedTexts = computed(() => {
  const entries = props.texts.map((text) => String(text ?? "").trim()).filter(Boolean);
  return entries.length ? entries : ["GORDON"];
});

const textIndex = ref(0);
const text1Ref = ref(null);
const text2Ref = ref(null);
const filterId = `gordon-morphing-text-${Math.random().toString(36).slice(2, 10)}`;

let animationFrameId = 0;
let reducedMotionTimerId = 0;
let lastTime = 0;
let morph = 0;
let coolDown = props.coolDownTime;
let reducedMotionQuery = null;

const currentText = computed(() => normalizedTexts.value[textIndex.value % normalizedTexts.value.length]);
const nextText = computed(() => normalizedTexts.value[(textIndex.value + 1) % normalizedTexts.value.length]);
const accessibleLabel = computed(() => props.ariaLabel || currentText.value);

function setLayerContent() {
  if (!text1Ref.value || !text2Ref.value) {
    return;
  }

  text1Ref.value.textContent = currentText.value;
  text2Ref.value.textContent = nextText.value;
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
    textIndex.value += 1;
  }
}

function animate(timestamp) {
  animationFrameId = requestAnimationFrame(animate);

  if (!lastTime) {
    lastTime = timestamp;
  }

  const delta = (timestamp - lastTime) / 1000;
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
    textIndex.value += 1;
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
