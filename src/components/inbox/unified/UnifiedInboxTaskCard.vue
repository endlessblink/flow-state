<template>
  <div
    class="task-card"
    :class="[{ selected: isSelected }]"
    :data-priority="task.priority || 'none'"
    :data-status="task.status"
    draggable="true"
    tabindex="0"
    @dragstart="$emit('drag-start', $event)"
    @dragend="$emit('drag-end')"
    @click="$emit('task-click', $event)"
    @dblclick="$emit('task-dblclick')"
    @contextmenu.prevent="$emit('task-contextmenu', $event)"
    @keydown="$emit('task-keydown', $event)"
  >
    <!-- ADHD-friendly: Priority shown via left border on .task-card, not this stripe -->
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
// ADHD-friendly: Removed NTag - redundant with priority stripe
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


// ADHD-friendly: Human-readable date formatting
const formatHumanDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

const dueStatus = computed(() => {
  const task = props.task
  const today = new Date().toISOString().split('T')[0]

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
  /* ADHD-friendly: Priority shown via left border only */
  border-left: 4px solid transparent;
  padding: var(--space-2) var(--space-3);
  cursor: grab;
  user-select: none;
  transition: all 0.15s ease;
  overflow: visible;
  min-height: 40px;
}

.task-card:hover {
  border-color: var(--border-hover);
  border-left-color: inherit; /* Preserve priority color on hover */
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
  display: none; /* Hide the old stripe - we use border-left on .task-card now */
}

/* ADHD-friendly: Priority colors via left border - calm, not overwhelming */
.task-card[data-priority="high"] {
  border-left-color: var(--color-priority-high);
}

.task-card[data-priority="medium"] {
  border-left-color: var(--color-priority-medium);
}

.task-card[data-priority="low"] {
  border-left-color: var(--color-priority-low);
}

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

/* ADHD-friendly: Progressive disclosure - duration hidden by default */
.duration-badge {
  opacity: 0;
  transition: opacity 0.15s ease;
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
