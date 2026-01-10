<!--
  TaskNodeNew.vue - Clean task node component for canvas

  TASK-184: Canvas System Rebuild - Phase 3

  Features:
  - Displays task with title, priority, and status
  - Shows pomodoro count
  - Handles click to open edit modal
  - Draggable via Vue Flow

  Target: ~300 lines
-->
<template>
  <div
    class="task-node"
    :class="[
      `task-node--priority-${priority}`,
      `task-node--status-${data.status}`,
      { 'task-node--selected': selected }
    ]"
    @dblclick.stop="openTask"
  >
    <!-- Priority indicator -->
    <div class="priority-bar" :style="{ backgroundColor: priorityColor }" />

    <!-- Content -->
    <div class="task-content">
      <!-- Header with checkbox -->
      <div class="task-header">
        <button
          class="done-toggle"
          :class="{ 'done-toggle--done': data.status === 'done' }"
          @click.stop="toggleDone"
          :title="data.status === 'done' ? 'Mark as planned' : 'Mark as done'"
        >
          <svg
            v-if="data.status === 'done'"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <span class="task-title" :class="{ 'task-title--done': data.status === 'done' }">
          {{ data.title }}
        </span>
      </div>

      <!-- Meta info -->
      <div class="task-meta">
        <!-- Pomodoro count -->
        <span v-if="data.completedPomodoros > 0" class="meta-item pomodoro-count">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="12" r="10" />
          </svg>
          {{ data.completedPomodoros }}
        </span>

        <!-- Due date -->
        <span v-if="data.dueDate" class="meta-item due-date" :class="dueDateClass">
          {{ formatDueDate }}
        </span>

        <!-- Duration estimate -->
        <span v-if="data.estimatedDuration" class="meta-item duration">
          {{ formatDuration }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { Task } from '@/types/tasks'

interface TaskNodeData extends Task {
  // Any extra data passed to the node
}

const props = defineProps<NodeProps<TaskNodeData>>()

// Computed
const priority = computed(() => props.data?.priority || 'none')

const priorityColor = computed(() => {
  const colors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
    none: '#6b7280'
  }
  return colors[priority.value] || colors.none
})

const formatDueDate = computed(() => {
  if (!props.data?.dueDate) return ''
  const date = new Date(props.data.dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const dueDateClass = computed(() => {
  if (!props.data?.dueDate) return ''
  const date = new Date(props.data.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  if (date < today) return 'due-date--overdue'
  if (date.getTime() === today.getTime()) return 'due-date--today'
  return ''
})

const formatDuration = computed(() => {
  const minutes = props.data?.estimatedDuration
  if (!minutes) return ''
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
})

// Methods
function toggleDone() {
  // Will be wired up via emit in Phase 6
  console.log('[TaskNodeNew] Toggle done:', props.id)
}

function openTask() {
  // Will be wired up via emit in Phase 6
  console.log('[TaskNodeNew] Open task:', props.id)
}
</script>

<style scoped>
.task-node {
  width: 220px;
  min-height: 60px;
  background: var(--color-surface, #252538);
  border-radius: 8px;
  border: 1px solid var(--color-border, #2d2d44);
  overflow: hidden;
  cursor: grab;
  transition: box-shadow 0.2s ease, transform 0.1s ease;
  display: flex;
}

.task-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.task-node--selected {
  box-shadow: 0 0 0 2px var(--color-primary, #6366f1);
}

.task-node--status-done {
  opacity: 0.7;
}

/* Priority bar */
.priority-bar {
  width: 4px;
  min-height: 100%;
  flex-shrink: 0;
}

/* Content */
.task-content {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* Header */
.task-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.done-toggle {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--color-border, #2d2d44);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all 0.2s ease;
  color: transparent;
}

.done-toggle:hover {
  border-color: var(--color-primary, #6366f1);
}

.done-toggle--done {
  background: var(--color-success, #22c55e);
  border-color: var(--color-success, #22c55e);
  color: white;
}

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #ffffff);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-title--done {
  text-decoration: line-through;
  color: var(--color-text-secondary, #a0a0b0);
}

/* Meta */
.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-secondary, #a0a0b0);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.pomodoro-count {
  color: var(--color-primary, #6366f1);
}

.pomodoro-count svg {
  color: #ef4444;
}

.due-date--overdue {
  color: #ef4444;
  font-weight: 600;
}

.due-date--today {
  color: #f59e0b;
  font-weight: 500;
}

.duration {
  background: var(--color-surface-hover, #2d2d44);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
