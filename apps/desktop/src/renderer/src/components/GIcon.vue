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
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Sparkles,
  Square,
  Trash2,
  Upload,
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
  book: BookOpen,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
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
  sparkles: Sparkles,
  stats: BarChart3,
  upload: Upload,
  stop: Square
};

const iconComponent = computed(() => ICONS[props.name] ?? MoreHorizontal);
</script>
