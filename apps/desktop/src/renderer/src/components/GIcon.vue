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
  CircleAlert,
  CornerDownLeft,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Home,
  Image,
  LoaderCircle,
  Maximize2,
  MessageSquarePlus,
  Minus,
  MoreHorizontal,
  Music,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Share2,
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
  circleAlert: CircleAlert,
  close: X,
  copy: Copy,
  delete: Trash2,
  download: Download,
  edit: Edit3,
  enter: CornerDownLeft,
  eye: Eye,
  eyeOff: EyeOff,
  fileText: FileText,
  gear: Settings,
  grip: GripVertical,
  home: Home,
  image: Image,
  jump: ExternalLink,
  loading: LoaderCircle,
  maximize: Maximize2,
  messagePlus: MessageSquarePlus,
  minus: Minus,
  more: MoreHorizontal,
  music: Music,
  panelRightClose: PanelRightClose,
  panelRightOpen: PanelRightOpen,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  return: ArrowLeft,
  settings: Settings,
  share: Share2,
  sparkles: Sparkles,
  stats: BarChart3,
  trash: Trash2,
  upload: Upload,
  stop: Square
};

const iconComponent = computed(() => ICONS[props.name] ?? MoreHorizontal);
</script>
