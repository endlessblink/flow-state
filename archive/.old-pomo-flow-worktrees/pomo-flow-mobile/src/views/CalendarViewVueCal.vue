<template>
  <div class="calendar-layout">
    <TaskManagerSidebar
      @addTask="handleAddTask"
      @startTimer="handleStartTimer"
      @editTask="handleEditTask"
    />

    <div class="calendar-main">
      <div class="calendar-header">
        <h2>Vue-Cal Test Calendar</h2>
        <button class="back-btn" @click="$router.push('/calendar')">
          Back to Custom Calendar
        </button>
      </div>

      <vue-cal
        :time-from="0 * 60"
        :time-to="24 * 60"
        :time-step="30"
        active-view="day"
        :events="vueCalEvents"
        :editable-events="{
          title: false,
          drag: true,
          resize: true,
          delete: true,
          create: false
        }"
        @event-drag-drop="handleEventDragDrop"
        @event-duration-change="handleEventResize"
        @event-dblclick="handleEventDblClick"
        class="custom-vuecal"
        hide-view-selector
        :disable-views="['years', 'year', 'month', 'week']"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import TaskManagerSidebar from '@/components/TaskManagerSidebar.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Convert Pinia tasks to vue-cal event format
const vueCalEvents = computed(() => {
  return taskStore.tasks
    .filter(task => task.scheduledDate && task.scheduledTime)
    .map(task => {
      const [hour, minute] = task.scheduledTime!.split(':').map(Number)
      const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`)
      const duration = task.estimatedDuration || 30
      const end = new Date(start.getTime() + duration * 60000)

      return {
        id: task.id,
        start,
        end,
        title: task.title,
        content: task.description,
        class: `priority-${task.priority}`,
        taskId: task.id
      }
    })
})

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'var(--color-priority-high)'
    case 'low': return 'var(--color-priority-low)'
    default: return 'var(--color-work)'
  }
}

// Event handlers
const handleEventDragDrop = (event: any, originalEvent: any) => {
  console.log('Event dropped:', event)

  const newStart = new Date(event.start)
  const dateStr = newStart.toISOString().split('T')[0]
  const timeStr = `${newStart.getHours().toString().padStart(2, '0')}:${newStart.getMinutes().toString().padStart(2, '0')}`

  taskStore.updateTask(event.id, {
    scheduledDate: dateStr,
    scheduledTime: timeStr
  })
}

const handleEventResize = (event: any, originalEvent: any) => {
  console.log('Event resized:', event)

  const start = new Date(event.start)
  const end = new Date(event.end)
  const duration = Math.round((end.getTime() - start.getTime()) / 60000)

  taskStore.updateTask(event.id, {
    estimatedDuration: duration
  })
}

const handleEventDblClick = (event: any, e: MouseEvent) => {
  console.log('Event double-clicked:', event)
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: event.id }
  }))
}

const handleAddTask = () => {
  taskStore.createTask({
    title: 'New Task',
    description: 'Task description...',
    status: 'planned'
  })
}

const handleStartTimer = (taskId: string) => {
  timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
}

const handleEditTask = (taskId: string) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId }
  }))
}
</script>

<style scoped>
.calendar-layout {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
}

.calendar-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.calendar-header h2 {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
}

.back-btn {
  background: var(--color-navigation);
  border: none;
  color: var(--state-active-text);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--brand-primary);
}

.custom-vuecal {
  flex: 1;
  background: var(--bg-primary);
}

/* Apply our translucent green design to vue-cal */
.custom-vuecal :deep(.vuecal__bg) {
  background: var(--bg-primary);
}

.custom-vuecal :deep(.vuecal__cell) {
  border-color: var(--border-primary);
  color: var(--text-primary);
}

.custom-vuecal :deep(.vuecal__time-cell) {
  background: var(--bg-secondary);
  border-color: var(--border-primary);
  color: var(--text-muted);
  font-size: var(--text-xs);
}

/* Translucent GREEN event styling like custom calendar */
.custom-vuecal :deep(.vuecal__event) {
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  cursor: pointer;
}

/* Priority-based translucent backgrounds */
.custom-vuecal :deep(.vuecal__event.priority-high) {
  border-color: var(--color-priority-high);
  background: var(--danger-bg-subtle) !important;
}

.custom-vuecal :deep(.vuecal__event.priority-low) {
  border-color: var(--brand-primary);
  background: var(--blue-bg-light) !important;
}

.custom-vuecal :deep(.vuecal__event.priority-medium) {
  border-color: var(--color-work);
  background: var(--success-bg-light) !important;
}

.custom-vuecal :deep(.vuecal__event:hover) {
  filter: brightness(1.2);
}

/* Resize handles styling */
.custom-vuecal :deep(.vuecal__event-resize-handle) {
  background: var(--blue-border-medium);
  height: 6px;
}

.custom-vuecal :deep(.vuecal__event-resize-handle):hover {
  background: var(--brand-primary);
  height: 8px;
}
</style>