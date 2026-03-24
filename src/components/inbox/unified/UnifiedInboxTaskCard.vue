<template>
  <div
    class="task-card"
    :class="[{ selected: isSelected, 'is-done': isDone, compact }]"
    :data-priority="task.priority || 'none'"
    :data-status="task.status"
    draggable="true"
    tabindex="0"
    @dragstart="$emit('dragStart', $event)"
    @dragend="$emit('dragEnd')"
    @click="$emit('taskClick', $event)"
    @dblclick="$emit('taskDblclick')"
    @contextmenu.prevent="$emit('taskContextmenu', $event)"
    @keydown="$emit('taskKeydown', $event)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- ADHD-friendly: Priority shown via left border on .task-card, not this stripe -->
    <div class="priority-stripe" :class="`priority-${task.priority || 'none'}`" />

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="12" />
    </div>

    <!-- Done Indicator -->
    <div v-if="isDone" class="done-indicator" title="Completed">
      <CheckCircle2 :size="16" />
    </div>

    <!-- Task Content -->
    <div class="task-content--inbox">
      <OverflowTooltip
        :text="task.title"
        class="task-title"
        multiline
        :line-clamp="compact ? 1 : 2"
        dir="auto"
      >
        {{ truncateUrlsInText(task.title) }}
      </OverflowTooltip>

      <!-- ADHD-friendly: Minimal metadata - show only essentials -->
      <div class="task-metadata">
        <!-- Due Date Badge (essential for planning) -->
        <span v-if="dueStatus" class="metadata-badge due-date-badge" :class="`due-badge-${dueStatus.type}`">
          <Calendar :size="12" />
          {{ dueStatus.text }}
        </span>

        <!-- Project Badge (only if assigned) -->
        <span v-if="task.projectId" class="metadata-badge project-badge">
          <ProjectEmojiIcon
            v-if="projectVisual.type === 'emoji'"
            :emoji="projectVisual.content"
            size="xs"
          />
          <span
            v-else-if="projectVisual.type === 'css-circle'"
            class="project-circle"
            :style="{ '--project-color': projectVisual.color }"
          >
            {{ projectVisual.content }}
          </span>
          <span v-else>{{ projectVisual.content }}</span>
        </span>

        <!-- ADHD-friendly: Removed redundant NTag priority badge - left stripe is sufficient -->
        <!-- Duration shown only on hover (progressive disclosure) via CSS -->
        <span v-if="task.estimatedDuration" class="metadata-badge duration-badge">
          <Clock :size="12" />
          {{ task.estimatedDuration }}m
        </span>

        <!-- Not on Canvas Badge -->
        <span
          v-if="showCanvasBadge && !task.canvasPosition"
          class="metadata-badge not-on-canvas-badge"
        >
          Not on Canvas
        </span>
      </div>
    </div>

    <!-- Quick Actions (hover) — BUG-1709: JS hover for WebKitGTK reliability -->
    <div v-if="isHovered" class="task-actions">
      <button
        class="action-btn send-to-canvas-btn"
        title="Send to Canvas"
        @click.stop="$emit('sendToCanvas')"
      >
        <Layout :size="14" />
      </button>
      <button
        class="action-btn"
        title="Start Timer"
        @click.stop="$emit('startTimer')"
      >
        <Play :size="14" />
      </button>
      <button
        class="action-btn"
        title="Edit"
        @click.stop="$emit('taskDblclick')"
      >
        <Edit2 :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Timer, Calendar, Clock, Play, Edit2, CheckCircle2, Layout } from 'lucide-vue-next'
import type { Task } from '@/types/tasks'
import { truncateUrlsInText } from '@/utils/urlTruncate'
import { useTaskStore } from '@/stores/tasks'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { useTimerStore } from '@/stores/timer'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { reactiveToday, ensureDateTimer } from '@/composables/useReactiveDate'

const props = defineProps<{
  task: Task
  isSelected: boolean
  showCanvasBadge?: boolean
  compact?: boolean
}>()

defineEmits<{
  (e: 'dragStart', event: DragEvent): void
  (e: 'dragEnd'): void
  (e: 'taskClick', event: MouseEvent): void
  (e: 'taskDblclick'): void
  (e: 'taskContextmenu', event: MouseEvent): void
  (e: 'taskKeydown', event: KeyboardEvent): void
  (e: 'startTimer'): void
  (e: 'sendToCanvas'): void
}>()

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// BUG-1709: JS-based hover for WebKitGTK (CSS :hover unreliable for show/hide)
const isHovered = ref(false)

// BUG-1191: Ensure date timer is running for reactive overdue detection
ensureDateTimer()

// Computeds
const projectVisual = computed(() => {
  return props.task.projectId
    ? taskStore.getProjectVisual(props.task.projectId)
    : { type: 'none', content: '' }
})

const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})

const isDone = computed(() => props.task.status === 'done')

// Helpers


// ADHD-friendly: Human-readable date formatting
const formatHumanDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

// BUG-1191: Due status with reactive date dependency
const dueStatus = computed(() => {
  const task = props.task
  // BUG-1191: Reactive dependency - ensures re-evaluation at midnight
  const _todayTrigger = reactiveToday.value
  // BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

  if (task.dueDate) {
    // Extract just the date part (handles ISO strings with time)
    const dueDateOnly = task.dueDate.split('T')[0]

    if (dueDateOnly < today) {
      // ADHD-friendly: Show simple "Overdue" with human-readable date
      return { type: 'overdue', text: `Overdue ${formatHumanDate(dueDateOnly)}` }
    } else if (dueDateOnly === today) {
      return { type: 'today', text: 'Today' }
    } else if (dueDateOnly === new Date(Date.now() + 86400000).toISOString().split('T')[0]) {
      return { type: 'tomorrow', text: 'Tomorrow' }
    } else {
      return { type: 'future', text: formatHumanDate(dueDateOnly) }
    }
  }

  const effectiveDate = task.scheduledDate ||
    (task.instances?.length && task.instances.find(inst => inst.scheduledDate)?.scheduledDate)

  if (effectiveDate) {
    const effectiveDateOnly = effectiveDate.split('T')[0]

    if (effectiveDateOnly === today) {
      return { type: 'scheduled-today', text: 'Today' }
    } else if (effectiveDateOnly === new Date(Date.now() + 86400000).toISOString().split('T')[0]) {
      return { type: 'scheduled-tomorrow', text: 'Tomorrow' }
    } else {
      return { type: 'scheduled-future', text: formatHumanDate(effectiveDateOnly) }
    }
  }

  return null
})
</script>

<style scoped>
/* ADHD-friendly: Calm task card — BUG-1709: breathing room */
.task-card {
  position: relative;
  background: var(--glass-bg-soft, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md);
  /* ADHD-friendly: Priority shown via inline-start border only */
  border-inline-start: 4px solid transparent;
  padding: var(--space-4);
  cursor: grab;
  user-select: none;
  transition: all var(--duration-fast) var(--ease-out);
  width: 100%;
  box-sizing: border-box;
  /* Allow content to determine height */
  height: auto;
  min-height: fit-content;
}

.task-card:hover {
  border-color: var(--border-hover);
  border-inline-start-color: inherit; /* Preserve priority color on hover */
  box-shadow: var(--shadow-sm);
}

.task-card.selected {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-dim);
}

.task-card:active {
  cursor: grabbing;
}

/* ADHD-friendly: Priority as subtle left border only */
.priority-stripe {
  display: none; /* Hide the old stripe - we use border-inline-start on .task-card now */
}

/* ADHD-friendly: Priority colors via left border - calm, not overwhelming */
.task-card[data-priority="high"] {
  border-inline-start-color: var(--color-priority-high);
}

.task-card[data-priority="medium"] {
  border-inline-start-color: var(--color-priority-medium);
}

.task-card[data-priority="low"] {
  border-inline-start-color: var(--color-priority-low);
}

.timer-indicator {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2); /* BUG-1709: logical property for RTL */
  color: var(--brand-primary);
  animation: pulse 2s infinite;
}

.task-content--inbox {
  padding-inline-start: var(--space-2);
  padding-inline-end: var(--space-2);
  padding-bottom: var(--space-2); /* BUG-1709: space for action tray */
  width: 100%;
  box-sizing: border-box;
}

.task-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  line-height: 1.5;
  max-width: 100%;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.metadata-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.project-badge {
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--surface-1);
  border-radius: var(--radius-sm);
}

/* ADHD-friendly: Progressive disclosure - duration hidden by default */
.duration-badge {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.task-card:hover .duration-badge {
  opacity: 1;
}

/* ADHD-friendly: Due Date Colors - muted for calm appearance */
.due-badge-overdue { color: var(--color-error); font-weight: var(--font-medium); }
.due-badge-today { color: var(--text-secondary); font-weight: var(--font-medium); }
.due-badge-tomorrow { color: var(--text-muted); }

/* Quick Actions — BUG-1709: visibility controlled by v-show (JS hover) */
.task-actions {
  position: absolute;
  inset-inline-end: var(--space-2);
  bottom: var(--space-2);
  display: flex;
  gap: var(--space-1);
  background: var(--surface-0);
  padding: var(--space-1) var(--space-1_5);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--glass-border);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.action-btn:hover {
  background: var(--surface-hover);
  color: var(--brand-primary);
}

/* Done Task Styling */
.task-card.is-done {
  opacity: 0.7;
  background: var(--success-bg-light);
  border-color: var(--success-border);
}

.task-card.is-done .task-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

.done-indicator {
  position: absolute;
  top: var(--space-2);
  inset-inline-start: var(--space-2); /* BUG-1709: logical property for RTL */
  color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  /* BUG-1709: Add background circle for WebKitGTK clarity */
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--success-bg-subtle);
}

.task-card.is-done .task-content--inbox {
  padding-inline-start: var(--space-5);
}

/* ─────────────────────────────────────────────────────────────────────────
   Compact pill mode for pinned tasks
   ───────────────────────────────────────────────────────────────────────── */
.task-card.compact {
  /* Pill geometry */
  display: inline-flex;
  align-items: center;
  width: auto;
  min-height: unset;
  height: auto;
  padding: var(--space-1) var(--space-2_5);
  gap: var(--space-1_5);
  border-radius: var(--radius-full);

  /* Kill the left-border priority stripe — use priority dot instead */
  border-inline-start-width: 1px;
  border-inline-start-color: var(--glass-border);

  /* Slightly more opaque glass for pill legibility */
  background: var(--glass-bg-medium, rgba(255, 255, 255, 0.08));

  /* Contain the hover action tray */
  overflow: visible;
}

/* Priority glow tint on the pill border */
.task-card.compact[data-priority="high"] {
  border-color: color-mix(in srgb, var(--color-priority-high) 35%, var(--glass-border));
  border-inline-start-color: color-mix(in srgb, var(--color-priority-high) 35%, var(--glass-border));
}
.task-card.compact[data-priority="medium"] {
  border-color: color-mix(in srgb, var(--color-priority-medium) 25%, var(--glass-border));
  border-inline-start-color: color-mix(in srgb, var(--color-priority-medium) 25%, var(--glass-border));
}
.task-card.compact[data-priority="low"] {
  border-color: color-mix(in srgb, var(--color-priority-low) 20%, var(--glass-border));
  border-inline-start-color: color-mix(in srgb, var(--color-priority-low) 20%, var(--glass-border));
}

/* Hover: soft glow that respects priority color */
.task-card.compact:hover {
  border-color: var(--border-hover);
  border-inline-start-color: var(--border-hover);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--brand-primary) 20%, transparent),
    var(--shadow-sm);
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.12));
}
.task-card.compact[data-priority="high"]:hover {
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-priority-high) 30%, transparent),
    var(--shadow-sm);
}
.task-card.compact[data-priority="medium"]:hover {
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-priority-medium) 25%, transparent),
    var(--shadow-sm);
}

/* Priority dot — repurpose the .priority-stripe div as a 5px circle */
.task-card.compact .priority-stripe {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
  opacity: 0.5;
}
.task-card.compact .priority-stripe.priority-high {
  background: var(--color-priority-high);
  opacity: 1;
  box-shadow: 0 0 4px color-mix(in srgb, var(--color-priority-high) 60%, transparent);
}
.task-card.compact .priority-stripe.priority-medium {
  background: var(--color-priority-medium);
  opacity: 0.9;
}
.task-card.compact .priority-stripe.priority-low {
  background: var(--color-priority-low);
  opacity: 0.7;
}

/* Title */
.task-card.compact .task-content--inbox {
  padding-inline-start: 0;
  width: auto;
  min-width: 0;
}

.task-card.compact .task-title {
  font-size: var(--text-xs);
  line-height: 1.2;
  margin-bottom: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

/* Hide all metadata in pill mode */
.task-card.compact .task-metadata {
  display: none;
}

/* Timer indicator — inline, no absolute positioning */
.task-card.compact .timer-indicator {
  position: static;
  flex-shrink: 0;
}

/* Done indicator — inline */
.task-card.compact .done-indicator {
  position: static;
  flex-shrink: 0;
}

/* Action tray — floats above the pill on hover, centered horizontally */
.task-card.compact .task-actions {
  position: absolute;
  /* Sit just above the pill */
  bottom: calc(100% + var(--space-1));
  inset-inline-start: 50%; /* BUG-1709: logical property for RTL */
  transform: translateX(-50%);
  right: unset;

  display: flex;
  gap: var(--space-0_5);
  padding: var(--space-0_5) var(--space-1);
  background: var(--surface-1, rgba(20, 20, 24, 0.95));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.4));

  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);

  /* Prevent the tray from wrapping oddly */
  white-space: nowrap;
  width: max-content;

  /* Stack above siblings */
  z-index: 10;
}

.task-card.compact:hover .task-actions {
  opacity: 1;
  pointer-events: auto;
}

/* Action buttons stay compact */
.task-card.compact .action-btn {
  width: 20px;
  height: 20px;
}

.not-on-canvas-badge {
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-sm);
  padding: var(--space-0_5) var(--space-1_5);
}
</style>
