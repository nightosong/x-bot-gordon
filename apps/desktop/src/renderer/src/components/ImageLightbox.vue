<template>
  <Teleport to="body">
    <div
      v-if="image?.src"
      class="image-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="图片放大预览"
      tabindex="-1"
      @click="handleBackdropClick"
      @keydown.esc.prevent="emitClose"
      @keydown.tab.prevent="handleTabKeydown"
      @wheel.prevent="handleWheel"
    >
      <div class="image-lightbox-actions" aria-label="图片操作">
        <button
          type="button"
          class="image-lightbox-icon-button"
          :class="{ 'is-running': isDownloading }"
          :disabled="isDownloading"
          aria-label="下载图片"
          :title="isDownloading ? '正在下载' : '下载图片'"
          @click.stop="emitDownload"
        >
          <GIcon :name="isDownloading ? 'loading' : 'download'" :size="17" :spin="isDownloading" />
        </button>
        <button
          type="button"
          class="image-lightbox-icon-button"
          aria-label="关闭预览"
          title="关闭预览"
          @click.stop="emitClose"
        >
          <GIcon name="close" :size="17" />
        </button>
      </div>

      <div class="image-lightbox-stage" @click.stop>
        <img
          class="image-lightbox-image"
          :src="image.src"
          :alt="image.alt || image.title || '图片预览'"
          :style="imageStyle"
          draggable="false"
          @load="handleImageLoad"
        />
      </div>

      <div class="image-lightbox-zoom" aria-label="缩放比例">
        <button type="button" class="image-lightbox-zoom-button" aria-label="缩小图片" title="缩小图片" @click.stop="emitZoomOut">
          <GIcon name="minus" :size="15" />
        </button>
        <span>{{ zoomPercent }}%</span>
        <button type="button" class="image-lightbox-zoom-button" aria-label="放大图片" title="放大图片" @click.stop="emitZoomIn">
          <GIcon name="plus" :size="15" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, reactive, watch } from "vue";

import GIcon from "./GIcon.vue";

const props = defineProps({
  image: {
    type: Object,
    default: null
  },
  zoom: {
    type: Number,
    default: 1
  },
  isDownloading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close", "download", "zoom-in", "zoom-out", "zoom-wheel"]);

const imageMeta = reactive({
  naturalWidth: 0,
  naturalHeight: 0,
  fittedWidth: 0,
  fittedHeight: 0
});

const zoomPercent = computed(() => Math.round((Number(props.zoom) || 1) * 100));
const imageStyle = computed(() => {
  const zoomValue = Number(props.zoom) || 1;
  const width = Math.max(1, Math.round((imageMeta.fittedWidth || imageMeta.naturalWidth || 960) * zoomValue));
  const height = Math.max(1, Math.round((imageMeta.fittedHeight || imageMeta.naturalHeight || 540) * zoomValue));

  return {
    width: `${width}px`,
    height: `${height}px`
  };
});

function emitClose() {
  emit("close");
}

function emitDownload() {
  emit("download");
}

function emitZoomIn() {
  emit("zoom-in");
}

function emitZoomOut() {
  emit("zoom-out");
}

function handleWheel(event) {
  emit("zoom-wheel", event.deltaY < 0 ? "in" : "out");
}

function handleBackdropClick(event) {
  if (event.target === event.currentTarget) {
    emitClose();
  }
}

function handleTabKeydown(event) {
  const focusableElements = Array.from(
    document.querySelectorAll(".image-lightbox-overlay button:not(:disabled)")
  );

  if (!focusableElements.length) {
    document.querySelector(".image-lightbox-overlay")?.focus?.();
    return;
  }

  const currentIndex = focusableElements.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? (currentIndex <= 0 ? focusableElements.length : currentIndex) - 1
    : (currentIndex + 1) % focusableElements.length;

  focusableElements[nextIndex]?.focus?.();
}

function getViewportFitBounds() {
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 1180;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 760;

  return {
    width: Math.max(260, Math.floor(viewportWidth - 96)),
    height: Math.max(260, Math.floor(viewportHeight - 128))
  };
}

function updateImageFit(naturalWidth, naturalHeight) {
  const bounds = getViewportFitBounds();
  const width = Number(naturalWidth) || 0;
  const height = Number(naturalHeight) || 0;
  const ratio = width && height ? width / height : 16 / 9;
  let fittedWidth = Math.min(bounds.width, Math.round(bounds.height * ratio));
  let fittedHeight = Math.round(fittedWidth / ratio);

  if (fittedHeight > bounds.height) {
    fittedHeight = bounds.height;
    fittedWidth = Math.round(fittedHeight * ratio);
  }

  imageMeta.naturalWidth = width;
  imageMeta.naturalHeight = height;
  imageMeta.fittedWidth = fittedWidth;
  imageMeta.fittedHeight = fittedHeight;
}

function handleImageLoad(event) {
  updateImageFit(event.target?.naturalWidth, event.target?.naturalHeight);
}

watch(
  () => props.image?.src,
  async (src) => {
    if (!src) {
      return;
    }

    updateImageFit(0, 0);
    await nextTick();
    document.querySelector(".image-lightbox-overlay")?.focus?.();
  }
);
</script>
