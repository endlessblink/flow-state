<template>
  <div
    class="task-card"
    :data-priority="task.priority || 'none'"
    draggable="true"
    tabindex="0"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend')"
    @click="$emit('click', $event)"
    @dblclick="$emit('dblclick')"
    @contextmenu.prevent="$emit('contextmenu', $event)"
    @keydown="$emit('keydown', $event)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Priority Stripe (top) -->
    <div class="priority-stripe" :class="`priority-${task.priority}`" />

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="12" />
    </div>

    <!-- Task Content -->
    <div class="task-content--calendar-inbox" dir="auto">
      <OverflowTooltip
        class="task-title"
        :text="task.title"
        multiline
        :line-clamp="2"
        dir="auto"
      >
        {{ truncateUrlsInText(task.title) }}
      </OverflowTooltip>

      <!-- Metadata Badges -->
      <div class="task-metadata">
        <!-- Project Badge -->
        <span v-if="task.projectId && projectVisual.content" class="metadata-badge project-badge">
          <ProjectEmojiIcon
            :emoji="projectVisual.content"
            size="xs"
          />
        </span>

        <!-- Priority Tag -->
        <span
          v-if="task.priority"
          class="metadata-badge priority-badge"
          :class="`priority-badge--${task.priority}`"
        >
          {{ priorityLabel }}
        </span>

        <!-- Due Date Badge -->
        <span
          v-if="task.dueDate"
          class="metadata-badge due-date-badge"
          :class="getDueBadgeClass(task.dueDate)"
        >
          <Calendar :size="12" />
          {{ formatDueDateLabel(task.dueDate) }}
        </span>

        <!-- Duration Badge -->
        <span v-if="task.estimatedDuration" class="metadata-badge duration-badge">
          <Clock :size="12" />
          {{ task.estimatedDuration }}m
        </span>

        <!-- Subtask Badge -->
        <span
          v-if="totalSubtasks > 0"
          class="metadata-badge subtask-badge"
          :class="{ 'subtask-complete': completedSubtasks === totalSubtasks }"
          :title="`Subtasks: ${completedSubtasks}/${totalSubtasks}`"
        >
          <ListChecks :size="12" />
          {{ completedSubtasks }}/{{ totalSubtasks }}
        </span>

        <!-- Status Indicator -->
        <span
          v-if="visibleStatusBadge"
          class="metadata-badge status-badge"
          :class="`status-${task.status}`"
          :title="visibleStatusBadge.label"
        >
          <component :is="visibleStatusBadge.icon" :size="12" />
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

    <!-- Quick Actions (hover) — BUG-1709: JS hover for WebKitGTK -->
    <div v-if="isHovered" class="task-actions">
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
        @click.stop="$emit('edit')"
      >
        <Edit2 :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { type Task } from '@/stores/tasks'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { Play, Edit2, Timer, Calendar, Clock, ListChecks, ClipboardList, PlayCircle, CheckCircle2, PauseCircle } from 'lucide-vue-next'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { useTaskStore } from '@/stores/tasks'
import { reactiveToday, ensureDateTimer } from '@/composables/useReactiveDate'
import { truncateUrlsInText } from '@/utils/urlTruncate'

const props = defineProps<{
  task: Task
  isTimerActive: boolean
  showCanvasBadge?: boolean
}>()

defineEmits<{
  (e: 'dragstart', event: DragEvent): void
  (e: 'dragend'): void
  (e: 'click', event: MouseEvent): void
  (e: 'dblclick'): void
  (e: 'contextmenu', event: MouseEvent): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'startTimer'): void
  (e: 'edit'): void
}>()

const taskStore = useTaskStore()

// BUG-1709: JS-based hover for WebKitGTK
const isHovered = ref(false)

// BUG-1191: Ensure date timer is running for reactive overdue detection
ensureDateTimer()

const projectVisual = computed(() =>
  taskStore.getProjectVisual(props.task.projectId)
)

const completedSubtasks = computed(() =>
  props.task.subtasks?.filter(st => st.isCompleted).length || 0
)
const totalSubtasks = computed(() => props.task.subtasks?.length || 0)

const priorityLabel = computed(() => props.task.priority?.toUpperCase() ?? '')

const statusBadge = computed(() => {
  const badges: Record<string, { icon: unknown; label: string }> = {
    planned: { icon: ClipboardList, label: 'Planned' },
    in_progress: { icon: PlayCircle, label: 'In progress' },
    done: { icon: CheckCircle2, label: 'Done' },
    on_hold: { icon: PauseCircle, label: 'On hold' }
  }
  return badges[props.task.status] ?? null
})

const visibleStatusBadge = computed(() => {
  if (!props.task.status || props.task.status === 'todo') return null
  return statusBadge.value
})

// BUG-1191: Due badge class with reactive date dependency
const getDueBadgeClass = (dueDate: string) => {
  // BUG-1191: Reactive dependency - ensures re-evaluation at midnight
  const _todayTrigger = reactiveToday.value
  // BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  if (dueDate < today) return 'due-badge-overdue'
  if (dueDate === today) return 'due-badge-today'
  return 'due-badge-future'
}

const formatDueDateLabel = (dueDate: string) => {
  if (!dueDate) return ''
  const dateStr = dueDate.split('T')[0]
  // BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
  const _n = new Date()
  const today = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`
  
  const dateObj = new Date(dueDate)
  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateObj)

  if (dateStr < today) return 'Overdue ' + formattedDate
  if (dateStr === today) return 'Today'
  return formattedDate
}
</script>

<style scoped>
/* BUG-1709: breathing room */
.task-card {
  position: relative;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-3);
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  border: 1px solid var(--border-subtle);
  border-inline-start: 4px solid transparent;
  border-radius: var(--radius-md);
  cursor: grab;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}

.task-card:hover {
  background: var(--surface-2);
  border-color: var(--border-medium);
  border-inline-start-color: inherit; /* Preserve priority color on hover */
  transform: translateY(-1px);
}

/* Priority shown via border-inline-start on .task-card, not stripe */
.priority-stripe {
  display: none;
}

/* Priority colors via inline-start border */
.task-card[data-priority="high"] {
  border-inline-start-color: var(--color-priority-high);
}

.task-card[data-priority="medium"] {
  border-inline-start-color: var(--color-priority-medium);
}

.task-card[data-priority="low"] {
  border-inline-start-color: var(--color-priority-low);
}

.task-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  min-height: 20px;
  word-break: break-word;
  overflow-wrap: break-word;
  text-align: start;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  min-height: 20px;
  opacity: 0.92;
}

.metadata-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  line-height: 1;
  min-height: 20px;
  max-width: 100%;
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--surface-2) 82%, transparent);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.priority-badge {
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0;
}

.priority-badge--high {
  color: var(--color-priority-high);
  border-color: color-mix(in srgb, var(--color-priority-high) 42%, transparent);
}

.priority-badge--medium {
  color: var(--color-priority-medium);
  border-color: color-mix(in srgb, var(--color-priority-medium) 42%, transparent);
}

.priority-badge--low {
  color: var(--color-priority-low);
  border-color: color-mix(in srgb, var(--color-priority-low) 42%, transparent);
}

.due-badge-overdue { color: var(--status-error); }
.due-badge-today { color: var(--status-warning); }

.status-badge {
  width: 22px;
  justify-content: center;
  padding-inline: 0;
  opacity: 0.85;
}

.subtask-badge {
  color: var(--text-secondary);
}

.subtask-complete {
  color: var(--color-work);
  background: var(--success-bg-subtle);
  border-color: var(--success-border);
}

/* BUG-1709: visibility controlled by v-show (JS hover) */
.task-actions {
  position: absolute;
  top: var(--space-2_5);
  inset-inline-end: var(--space-2);
  display: flex;
  gap: var(--space-1);
  background: var(--surface-1);
  padding: var(--space-0_5);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-medium);
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn:hover {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
}

.not-on-canvas-badge {
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  border-style: dashed;
}

/* BUG-1709: Reserve space for action icons to prevent RTL text overlap */
.task-content--calendar-inbox {
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  padding-inline-end: 58px;
  text-align: start;
}

.task-content--calendar-inbox:dir(rtl) {
  text-align: start;
}

.timer-indicator {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2); /* BUG-1709: logical property for RTL */
  color: var(--brand-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>
