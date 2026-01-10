<template>
  <div
    class="task-card"
    :class="[{ selected: isSelected }]"
    draggable="true"
    tabindex="0"
    @dragstart="$emit('drag-start', $event)"
    @dragend="$emit('drag-end')"
    @click="$emit('task-click', $event)"
    @dblclick="$emit('task-dblclick')"
    @contextmenu.prevent="$emit('task-contextmenu', $event)"
    @keydown="$emit('task-keydown', $event)"
  >
    <!-- Priority Stripe (top) -->
    <div class="priority-stripe" :class="`priority-${task.priority || 'none'}`" />

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="12" />
    </div>

    <!-- Task Content -->
    <div class="task-content--inbox">
      <div class="task-title" dir="auto">
        {{ task.title }}
      </div>

      <!-- Metadata Badges -->
      <div class="task-metadata">
        <!-- Project Badge -->
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

        <!-- Priority Tag -->
        <NTag
          v-if="task.priority"
          :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
          size="small"
          round
          class="priority-badge"
        >
          {{ task.priority }}
        </NTag>

        <!-- Due Date Badge -->
        <span v-if="dueStatus" class="metadata-badge due-date-badge" :class="`due-badge-${dueStatus.type}`">
          <Calendar :size="12" />
          {{ dueStatus.text }}
        </span>

        <!-- Duration Badge -->
        <span v-if="task.estimatedDuration" class="metadata-badge duration-badge">
          <Clock :size="12" />
          {{ task.estimatedDuration }}m
        </span>

        <!-- Status Indicator -->
        <span class="metadata-badge status-badge" :class="`status-${task.status}`">
          {{ getStatusIndicator(task.status) }}
        </span>
      </div>
    </div>

    <!-- Quick Actions (hover) -->
    <div class="task-actions">
      <button
        class="action-btn"
        :title="`Start timer for ${task.title}`"
        @click.stop="$emit('start-timer')"
      >
        <Play :size="12" />
      </button>
      <button
        class="action-btn"
        :title="`Edit ${task.title}`"
        @click.stop="$emit('task-dblclick')"
      >
        <Edit2 :size="12" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Timer, Calendar, Clock, Play, Edit2 } from 'lucide-vue-next'
import { NTag } from 'naive-ui'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const props = defineProps<{
  task: Task
  isSelected: boolean
}>()

defineEmits<{
  (e: 'drag-start', event: DragEvent): void
  (e: 'drag-end'): void
  (e: 'task-click', event: MouseEvent): void
  (e: 'task-dblclick'): void
  (e: 'task-contextmenu', event: MouseEvent): void
  (e: 'task-keydown', event: KeyboardEvent): void
  (e: 'start-timer'): void
}>()

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Computeds
const projectVisual = computed(() => {
  return props.task.projectId
    ? taskStore.getProjectVisual(props.task.projectId)
    : { type: 'none', content: '' }
})

const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})

// Helpers
const getStatusIndicator = (status: string) => {
  const indicators: Record<string, string> = {
    planned: '📝',
    in_progress: '🎬',
    done: '✅',
    backlog: '📚',
    on_hold: '⏸️'
  }
  return indicators[status] || '📝'
}

const dueStatus = computed(() => {
  const task = props.task
  const today = new Date().toISOString().split('T')[0]

  if (task.dueDate) {
    if (task.dueDate < today) {
      return { type: 'overdue', text: `Overdue ${task.dueDate}` }
    } else if (task.dueDate === today) {
      return { type: 'today', text: 'Today' }
    } else if (task.dueDate === new Date(Date.now() + 86400000).toISOString().split('T')[0]) {
      return { type: 'tomorrow', text: 'Tomorrow' }
    } else {
      const date = new Date(task.dueDate)
      return { type: 'future', text: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }) }
    }
  }

  const effectiveDate = task.scheduledDate ||
    (task.instances?.length && task.instances.find(inst => inst.scheduledDate)?.scheduledDate)

  if (effectiveDate) {
    if (effectiveDate === today) {
      return { type: 'scheduled-today', text: 'Today' }
    } else if (effectiveDate === new Date(Date.now() + 86400000).toISOString().split('T')[0]) {
      return { type: 'scheduled-tomorrow', text: 'Tomorrow' }
    } else {
      const date = new Date(effectiveDate)
      return { type: 'scheduled-future', text: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }) }
    }
  }

  return null
})
</script>

<style scoped>
.task-card {
  position: relative;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  cursor: grab;
  user-select: none;
  transition: all 0.2s ease;
  overflow: hidden;
}

.task-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.task-card.selected {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-dim);
}

.task-card:active {
  cursor: grabbing;
}

.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  bottom: 0;
  background: transparent;
}

.priority-high { background: var(--color-priority-high); }
.priority-medium { background: var(--color-priority-medium); }
.priority-low { background: var(--color-priority-low); }

.timer-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--brand-primary);
  animation: pulse 2s infinite;
}

.task-content--inbox {
  padding-left: var(--space-2);
}

.task-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
  word-break: break-word;
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
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.project-badge {
  padding: 2px 6px;
  background: var(--surface-1);
  border-radius: 4px;
}

.status-badge {
  margin-left: auto;
}

/* Due Date Colors */
.due-badge-overdue { color: var(--color-error); font-weight: var(--font-medium); }
.due-badge-today { color: var(--color-warning); font-weight: var(--font-medium); }
.due-badge-tomorrow { color: var(--color-info); }

/* Quick Actions */
.task-actions {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none; /* Ignore clicks unless visible */
  transition: opacity 0.15s ease;
  background: var(--surface-0);
  padding: 2px;
  border-radius: 4px;
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
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--surface-hover);
  color: var(--brand-primary);
}
</style>
