<!--
  CanvasInbox.vue - Inbox panel for canvas tasks

  TASK-184: Canvas System Rebuild - Phase 3

  Features:
  - Shows tasks with isInInbox: true
  - Tasks are draggable to canvas
  - Filters by project (optional)

  Target: ~200 lines
-->
<template>
  <div class="canvas-inbox" :class="{ 'canvas-inbox--collapsed': isCollapsed }">
    <!-- Header -->
    <div class="inbox-header" @click="toggleCollapse">
      <div class="inbox-header__left">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ 'rotate-180': isCollapsed }"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span class="inbox-title">Inbox</span>
        <span class="inbox-count">{{ inboxTasks.length }}</span>
      </div>
    </div>

    <!-- Content -->
    <div v-if="!isCollapsed" class="inbox-content">
      <!-- Empty state -->
      <div v-if="inboxTasks.length === 0" class="inbox-empty">
        <p>No tasks in inbox</p>
        <p class="inbox-empty__hint">Create tasks or drag them here</p>
      </div>

      <!-- Task list -->
      <div v-else class="inbox-list">
        <div
          v-for="task in inboxTasks"
          :key="task.id"
          class="inbox-task"
          :class="[
            `inbox-task--priority-${task.priority || 'none'}`,
            { 'inbox-task--done': task.status === 'done' }
          ]"
          draggable="true"
          @dragstart="handleDragStart($event, task)"
          @dragend="handleDragEnd"
        >
          <div class="priority-dot" :style="{ backgroundColor: getPriorityColor(task.priority) }" />
          <span class="task-title">{{ task.title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'

const emit = defineEmits<{
  (e: 'taskDragStart', task: Task): void
  (e: 'taskDragEnd'): void
}>()

const taskStore = useTaskStore()

// State
const isCollapsed = ref(false)

// Computed
const inboxTasks = computed(() => {
  // Get all tasks that are in the inbox (not placed on canvas)
  return taskStore.tasks.filter((task: Task) => {
    // A task is in inbox if:
    // 1. isInInbox is explicitly true, OR
    // 2. isInInbox is undefined/null AND no canvasPosition
    if (task.isInInbox === true) return true
    if (task.isInInbox === false) return false
    // Default: if no position, it's in inbox
    return !task.canvasPosition
  })
})

// Methods
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function getPriorityColor(priority: string | null | undefined): string {
  const colors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e'
  }
  return colors[priority || ''] || '#6b7280'
}

function handleDragStart(event: DragEvent, task: Task) {
  if (!event.dataTransfer) return

  // Set drag data
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'inbox-task',
    taskId: task.id
  }))
  event.dataTransfer.effectAllowed = 'move'

  emit('taskDragStart', task)
  console.log('[CanvasInbox] Drag start:', task.id)
}

function handleDragEnd() {
  emit('taskDragEnd')
  console.log('[CanvasInbox] Drag end')
}
</script>

<style scoped>
.canvas-inbox {
  position: absolute;
  top: 80px;
  left: 16px;
  width: 260px;
  max-height: calc(100vh - 160px);
  background: var(--color-surface, #252538);
  border-radius: 12px;
  border: 1px solid var(--color-border, #2d2d44);
  overflow: hidden;
  z-index: 50;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.canvas-inbox--collapsed {
  width: auto;
}

/* Header */
.inbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-surface-hover, #2d2d44);
  cursor: pointer;
  user-select: none;
}

.inbox-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inbox-header svg {
  color: var(--color-text-secondary, #a0a0b0);
  transition: transform 0.2s ease;
}

.inbox-header svg.rotate-180 {
  transform: rotate(180deg);
}

.inbox-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #ffffff);
}

.inbox-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--color-primary, #6366f1);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: white;
}

/* Content */
.inbox-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* Empty state */
.inbox-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--color-text-secondary, #a0a0b0);
}

.inbox-empty p {
  margin: 0;
  font-size: 13px;
}

.inbox-empty__hint {
  margin-top: 4px !important;
  font-size: 11px !important;
  opacity: 0.7;
}

/* Task list */
.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inbox-task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-background, #1a1a2e);
  border-radius: 8px;
  cursor: grab;
  transition: background 0.2s ease, transform 0.1s ease;
}

.inbox-task:hover {
  background: var(--color-surface-hover, #2d2d44);
}

.inbox-task:active {
  cursor: grabbing;
  transform: scale(0.98);
}

.inbox-task--done {
  opacity: 0.6;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-title {
  font-size: 13px;
  color: var(--color-text, #ffffff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-task--done .task-title {
  text-decoration: line-through;
  color: var(--color-text-secondary, #a0a0b0);
}
</style>
