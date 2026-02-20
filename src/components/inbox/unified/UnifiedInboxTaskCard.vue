<template>
  <div
    class="task-card"
    :class="[{ selected: isSelected, 'is-done': isDone }]"
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
  >
    <!-- ADHD-friendly: Priority shown via left border on .task-card, not this stripe -->
    <div class="priority-stripe" :class="`priority-${task.priority || 'none'}`" />

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="12" />
    </div>

    <!-- Done Indicator -->
    <div v-if="isDone" class="done-indicator" title="Completed">
      <CheckCircle2 :size="14" />
    </div>

    <!-- Task Content -->
    <div class="task-content--inbox">
      <div class="task-title" dir="auto" :title="task.title">
        {{ truncateUrlsInText(task.title) }}
      </div>

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
      </div>
    </div>

    <!-- Quick Actions (hover) -->
    <div class="task-actions">
      <button
        class="action-btn send-to-canvas-btn"
        title="Send to Canvas"
        @click.stop="$emit('sendToCanvas')"
      >
        <Layout :size="12" />
      </button>
      <button
        class="action-btn"
        :title="`Start timer for ${task.title}`"
        @click.stop="$emit('startTimer')"
      >
        <Play :size="12" />
      </button>
      <button
        class="action-btn"
        :title="`Edit ${task.title}`"
        @click.stop="$emit('taskDblclick')"
      >
        <Edit2 :size="12" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Timer, Calendar, Clock, Play, Edit2, CheckCircle2, Layout } from 'lucide-vue-next'
import type { Task } from '@/types/tasks'
import { truncateUrlsInText } from '@/utils/urlTruncate'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { reactiveToday, ensureDateTimer } from '@/composables/useReactiveDate'

const props = defineProps<{
  task: Task
  isSelected: boolean
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
/* ADHD-friendly: Calm, compact task card */
.task-card {
  position: relative;
  background: var(--glass-bg-soft, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md);
  /* ADHD-friendly: Priority shown via inline-start border only */
  border-inline-start: 4px solid transparent;
  padding: var(--space-3);
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
  right: var(--space-2);
  color: var(--brand-primary);
  animation: pulse 2s infinite;
}

.task-content--inbox {
  padding-inline-start: var(--space-2);
  width: 100%;
  box-sizing: border-box;
}

.task-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

/* Quick Actions */
.task-actions {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  pointer-events: none; /* Ignore clicks unless visible */
  transition: opacity var(--duration-fast) var(--ease-out);
  background: var(--surface-0);
  padding: var(--space-0_5);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}

.task-card:hover .task-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
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
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.3);
}

.task-card.is-done .task-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

.done-indicator {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  color: #22c55e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-card.is-done .task-content--inbox {
  padding-inline-start: var(--space-5);
}
</style>
