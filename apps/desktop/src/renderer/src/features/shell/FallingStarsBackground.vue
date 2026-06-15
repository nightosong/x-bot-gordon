<template>
  <canvas ref="canvasRef" class="falling-stars-canvas" aria-hidden="true"></canvas>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  color: { type: String, default: "#ffffff" },
  count: { type: Number, default: 170 },
  speed: { type: Number, default: 0.64 }
});

const canvasRef = ref(null);

let animationFrame = 0;
let resizeObserver = null;
let context = null;
let stars = [];
let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let focalLength = 0;
let previousTime = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function resetStar(star, initial = false) {
  const spread = Math.max(width, height);

  star.x = randomBetween(-spread, spread);
  star.y = randomBetween(-spread, spread);
  star.z = initial ? randomBetween(1, spread) : spread;
  star.previousX = 0;
  star.previousY = 0;
  star.size = randomBetween(0.55, 1.55);
  star.velocity = randomBetween(0.82, 1.58);
  star.opacity = randomBetween(0.42, 0.92);
}

function createStars() {
  const total = Math.max(32, Math.floor(props.count));

  stars = Array.from({ length: total }, () => {
    const star = {};
    resetStar(star, true);
    return star;
  });
}

function resizeCanvas() {
  const canvas = canvasRef.value;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  width = Math.max(1, Math.round(bounds.width));
  height = Math.max(1, Math.round(bounds.height));
  centerX = width / 2;
  centerY = height / 2;
  focalLength = Math.max(width, height) * 0.82;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context = canvas.getContext("2d");

  if (context) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.lineCap = "round";
  }

  createStars();
}

function drawStar(star, delta) {
  if (!context) {
    return;
  }

  star.z -= props.speed * star.velocity * delta * 0.072;

  if (star.z <= 1) {
    resetStar(star);
  }

  const scale = focalLength / star.z;
  const x = centerX + star.x * scale;
  const y = centerY + star.y * scale;

  if (x < -80 || x > width + 80 || y < -80 || y > height + 80) {
    resetStar(star);
    return;
  }

  const previousX = star.previousX || x;
  const previousY = star.previousY || y;
  const distance = Math.hypot(x - previousX, y - previousY);
  const alpha = Math.min(1, Math.max(0.16, star.opacity * (1.4 - star.z / Math.max(width, height))));
  const trail = Math.min(28, Math.max(4, distance * 1.8));
  const angle = Math.atan2(y - centerY, x - centerX);
  const tailX = x - Math.cos(angle) * trail;
  const tailY = y - Math.sin(angle) * trail;
  const size = Math.min(2.6, star.size * scale * 0.48);

  const glowGradient = context.createLinearGradient(tailX, tailY, x, y);
  glowGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  glowGradient.addColorStop(0.42, `rgba(255, 255, 255, ${alpha * 0.2})`);
  glowGradient.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.82})`);

  context.strokeStyle = glowGradient;
  context.lineWidth = Math.max(1, size * 1.85);
  context.shadowColor = props.color;
  context.shadowBlur = 12;
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(x, y);
  context.stroke();

  context.shadowBlur = 0;
  context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  context.lineWidth = Math.max(0.65, size * 0.82);
  context.beginPath();
  context.moveTo((tailX + x) / 2, (tailY + y) / 2);
  context.lineTo(x, y);
  context.stroke();

  context.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha + 0.1)})`;
  context.beginPath();
  context.arc(x, y, Math.max(0.55, size), 0, Math.PI * 2);
  context.fill();

  star.previousX = x;
  star.previousY = y;
}

function renderFrame(time) {
  if (!context) {
    animationFrame = window.requestAnimationFrame(renderFrame);
    return;
  }

  const delta = previousTime ? Math.min(48, time - previousTime) : 16;
  previousTime = time;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(5, 10, 17, 0.08)";
  context.fillRect(0, 0, width, height);

  for (const star of stars) {
    drawStar(star, delta);
  }

  animationFrame = window.requestAnimationFrame(renderFrame);
}

function startStars() {
  resizeCanvas();
  previousTime = 0;
  animationFrame = window.requestAnimationFrame(renderFrame);
}

function stopStars() {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

onMounted(() => {
  const canvas = canvasRef.value;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
  startStars();
});

onBeforeUnmount(() => {
  stopStars();
});
</script>
