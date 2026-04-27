<template>
  <component
    :is="iconComponent"
    class="g-icon action-icon"
    :class="{ 'is-spinning': spin }"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed } from "vue";
import {
  ArrowLeft,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  LoaderCircle,
  LogIn,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  X
} from "lucide-vue-next";

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 18
  },
  strokeWidth: {
    type: [Number, String],
    default: 2
  },
  spin: {
    type: Boolean,
    default: false
  }
});

const ICONS = {
  add: Plus,
  check: Check,
  close: X,
  copy: Copy,
  delete: Trash2,
  edit: Edit3,
  enter: LogIn,
  gear: Settings,
  jump: ExternalLink,
  loading: LoaderCircle,
  more: MoreHorizontal,
  play: Play,
  refresh: RefreshCw,
  return: ArrowLeft,
  settings: Settings
};

const iconComponent = computed(() => ICONS[props.name] ?? MoreHorizontal);
</script>
