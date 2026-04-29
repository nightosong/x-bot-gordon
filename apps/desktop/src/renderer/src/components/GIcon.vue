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
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Square,
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
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  close: X,
  copy: Copy,
  delete: Trash2,
  edit: Edit3,
  enter: LogIn,
  eye: Eye,
  eyeOff: EyeOff,
  gear: Settings,
  jump: ExternalLink,
  loading: LoaderCircle,
  more: MoreHorizontal,
  play: Play,
  refresh: RefreshCw,
  return: ArrowLeft,
  settings: Settings,
  stop: Square
};

const iconComponent = computed(() => ICONS[props.name] ?? MoreHorizontal);
</script>
