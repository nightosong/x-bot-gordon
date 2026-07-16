<template>
  <div class="workspace-stage robot-stage">
    <div class="robot-frame">
      <FallingStarsBackground class="robot-stars" color="#ffffff" :count="180" :speed="0.7" />
      <canvas ref="robotCanvasRef" class="robot-canvas" aria-label="Gordon robot"></canvas>
      <div class="robot-hud" aria-hidden="true">
        <span class="robot-hud-corner robot-hud-corner-nw"></span>
        <span class="robot-hud-corner robot-hud-corner-ne"></span>
        <span class="robot-hud-corner robot-hud-corner-sw"></span>
        <span class="robot-hud-corner robot-hud-corner-se"></span>
        <span class="robot-hud-scan"></span>
        <span class="robot-hud-axis robot-hud-axis-top"></span>
        <span class="robot-hud-axis robot-hud-axis-right"></span>
        <span class="robot-hud-signal-bars">
          <i></i><i></i><i></i><i></i><i></i>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import robotSceneUrl from "../../../assets/spline-backups/home-robot-scene.splinecode?url";
import FallingStarsBackground from "./FallingStarsBackground.vue";

const props = defineProps({
  setStatus: { type: Function, required: true }
});

const robotCanvasRef = ref(null);
const robotRuntimeState = {
  app: null,
  canvas: null,
  resizeObserver: null,
  loadToken: 0
};

let splineApplicationClass = null;
let splineApplicationPromise = null;

function disposeRobotRuntime() {
  robotRuntimeState.loadToken += 1;

  if (robotRuntimeState.resizeObserver) {
    robotRuntimeState.resizeObserver.disconnect();
    robotRuntimeState.resizeObserver = null;
  }

  if (robotRuntimeState.app) {
    robotRuntimeState.app.dispose();
    robotRuntimeState.app = null;
  }

  robotRuntimeState.canvas = null;
}

async function loadSplineApplication() {
  if (splineApplicationClass) {
    return splineApplicationClass;
  }

  if (!splineApplicationPromise) {
    splineApplicationPromise = import("@splinetool/runtime").then((module) => {
      splineApplicationClass = module.Application;
      return splineApplicationClass;
    });
  }

  return splineApplicationPromise;
}

async function syncRobotRuntime() {
  const canvas = robotCanvasRef.value;

  if (!(canvas instanceof HTMLCanvasElement)) {
    disposeRobotRuntime();
    return;
  }

  if (robotRuntimeState.canvas === canvas && robotRuntimeState.app) {
    return;
  }

  const token = robotRuntimeState.loadToken + 1;
  disposeRobotRuntime();

  let SplineApplication = null;

  try {
    SplineApplication = await loadSplineApplication();
  } catch (error) {
    console.error("Failed to load Gordon robot runtime", error);

    if (token === robotRuntimeState.loadToken) {
      props.setStatus("机器人运行时加载失败。", "danger");
    }

    return;
  }

  if (token !== robotRuntimeState.loadToken) {
    return;
  }

  const app = new SplineApplication(canvas, {
    renderMode: "continuous"
  });

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    app.setSize(width, height);
  };

  robotRuntimeState.app = app;
  robotRuntimeState.canvas = canvas;
  robotRuntimeState.resizeObserver = new ResizeObserver(resize);
  robotRuntimeState.resizeObserver.observe(canvas);
  resize();

  try {
    await app.load(robotSceneUrl);

    if (token !== robotRuntimeState.loadToken) {
      app.dispose();
    }
  } catch (error) {
    console.error("Failed to load Gordon robot scene", error);

    if (token === robotRuntimeState.loadToken) {
      props.setStatus("机器人场景加载失败。", "danger");
    }
  }
}

onMounted(async () => {
  await nextTick();
  await syncRobotRuntime();
});

onBeforeUnmount(() => {
  disposeRobotRuntime();
});
</script>
