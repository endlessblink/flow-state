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
  >
    <!-- Priority Stripe (top) -->
    <div class="priority-stripe" :class="`priority-${task.priority}`" />

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="12" />
    </div>

    <!-- Task Content -->
    <div class="task-content--calendar-inbox">
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
        <span v-if="task.projectId" class="metadata-badge project-badge">
          <ProjectEmojiIcon
            :emoji="projectVisual.content"
            size="xs"
          />
        </span>

        <!-- Priority Tag -->
        <NTag
          :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
          size="small"
          round
          class="priority-badge"
        >
          {{ task.priority }}
        </NTag>

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
        <span class="metadata-badge status-badge" :class="`status-${task.status}`">
          {{ statusEmoji(task.status) }}
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

    <!-- Quick Actions (hover) — BUG-1709: visible labels for WebKitGTK -->
    <div class="task-actions">
      <button
        class="action-btn"
        @click.stop="$emit('startTimer')"
      >
        <Play :size="12" />
        <span class="action-label">Timer</span>
      </button>
      <button
        class="action-btn"
        @click.stop="$emit('edit')"
      >
        <Edit2 :size="12" />
        <span class="action-label">Edit</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type Task } from '@/stores/tasks'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { Play, Edit2, Timer, Calendar, Clock, ListChecks } from 'lucide-vue-next'
import { NTag } from 'naive-ui'
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

// BUG-1191: Ensure date timer is running for reactive overdue detection
ensureDateTimer()

const projectVisual = computed(() =>
  taskStore.getProjectVisual(props.task.projectId)
)

const completedSubtasks = computed(() =>
  props.task.subtasks?.filter(st => st.isCompleted).length || 0
)
const totalSubtasks = computed(() => props.task.subtasks?.length || 0)

const statusEmoji = (status: string) => {
  const emojis: Record<string, string> = {
    planned: '📝',
    in_progress: '🎬',
    done: '✅',
    backlog: '📦',
    on_hold: '⏸️'
  }
  return emojis[status] || '❓'
}

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
/* BUG-1709: more breathing room */
.task-card {
  position: relative;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-inline-start: 4px solid transparent;
  border-radius: var(--radius-lg);
  cursor: grab;
  transition: all var(--duration-fast) ease;
}

.task-card:hover {
  background: var(--state-hover-bg);
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
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
  word-break: break-word;
  overflow-wrap: break-word;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.metadata-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-full);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.priority-badge {
  font-weight: var(--font-bold);
  text-transform: uppercase;
}

.due-badge-overdue { color: var(--status-error); }
.due-badge-today { color: var(--status-warning); }

.status-badge { opacity: 0.8; }

.subtask-badge {
  color: var(--text-secondary);
}

.subtask-complete {
  color: var(--color-work);
  background: var(--success-bg-subtle);
  border-color: var(--success-border);
}

/* BUG-1709: use visibility instead of opacity for WebKitGTK */
.task-actions {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2);
  display: flex;
  gap: var(--space-2);
  visibility: hidden;
  pointer-events: none;
  background: var(--surface-0);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--glass-border);
}

.task-card:hover .task-actions {
  visibility: visible;
  pointer-events: auto;
}

.action-btn {
  background: var(--glass-bg-heavy);
  border: none;
  color: var(--text-secondary);
  height: 20px;
  padding: 0 var(--space-1_5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

.action-label {
  font-size: var(--text-xs);
  line-height: 1;
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
  padding-inline-end: var(--space-8);
  width: 100%;
  box-sizing: border-box;
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
