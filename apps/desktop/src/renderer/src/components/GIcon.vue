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
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Code2,
  CornerDownLeft,
  Copy,
  Diff,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Globe2,
  GripVertical,
  Home,
  Image,
  LineChart,
  ListTodo,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Minus,
  MoreHorizontal,
  Music,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Share2,
  Sparkles,
  Square,
  SquareTerminal,
  Trash2,
  Upload,
  Video,
  Workflow,
  Zap,
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
  bookmark: Bookmark,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  circleAlert: CircleAlert,
  close: X,
  code: Code2,
  copy: Copy,
  delete: Trash2,
  download: Download,
  edit: Edit3,
  enter: CornerDownLeft,
  eye: Eye,
  eyeOff: EyeOff,
  fileText: FileText,
  flask: FlaskConical,
  gear: Settings,
  globe: Globe2,
  grip: GripVertical,
  home: Home,
  image: Image,
  jump: ExternalLink,
  lineChart: LineChart,
  listTodo: ListTodo,
  layoutGrid: LayoutGrid,
  loading: LoaderCircle,
  maximize: Maximize2,
  minimize: Minimize2,
  messagePlus: MessageSquarePlus,
  minus: Minus,
  diff: Diff,
  more: MoreHorizontal,
  music: Music,
  panelRightClose: PanelRightClose,
  panelRightOpen: PanelRightOpen,
  pin: Pin,
  play: Play,
  plus: Plus,
  radar: Radar,
  refresh: RefreshCw,
  return: ArrowLeft,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  share: Share2,
  sparkles: Sparkles,
  stats: BarChart3,
  trash: Trash2,
  upload: Upload,
  video: Video,
  workflow: Workflow,
  zap: Zap,
  stop: Square,
  terminal: SquareTerminal
};

const iconComponent = computed(() => ICONS[props.name] ?? MoreHorizontal);
</script>
