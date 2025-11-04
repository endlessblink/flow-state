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

    <!-- TASK EDIT MODAL -->
    <TaskEditModal
      :is-open="isEditModalOpen"
      :task="selectedTask"
      @close="closeEditModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import TaskManagerSidebar from '@/components/TaskManagerSidebar.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Task Edit Modal state
const isEditModalOpen = ref(false)
const selectedTask = ref<any>(null)

// Convert Pinia tasks to vue-cal event format
const vueCalEvents = computed(() => {
  const events: any[] = []

  // Add regular tasks
  taskStore.tasks
    .filter(task => task.scheduledDate && task.scheduledTime && !task.recurrence?.isEnabled)
    .forEach(task => {
      const [hour, minute] = task.scheduledTime!.split(':').map(Number)
      const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`)
      const duration = task.estimatedDuration || 30
      const end = new Date(start.getTime() + duration * 60000)

      events.push({
        id: task.id,
        start,
        end,
        title: task.title,
        content: task.description,
        class: `priority-${task.priority}`,
        taskId: task.id,
        isRecurring: false
      })
    })

  // Add recurring task instances
  taskStore.tasks
    .filter(task => task.recurrence?.isEnabled && task.recurrence?.generatedInstances)
    .forEach(task => {
      task.recurrence!.generatedInstances
        .filter(instance => !instance.isSkipped && instance.scheduledDate && instance.scheduledTime)
        .forEach(instance => {
          const [hour, minute] = instance.scheduledTime!.split(':').map(Number)
          const start = new Date(`${instance.scheduledDate}T${instance.scheduledTime}`)
          const duration = instance.duration || task.estimatedDuration || 30
          const end = new Date(start.getTime() + duration * 60000)

          events.push({
            id: instance.id,
            start,
            end,
            title: `${task.title} 🔁`, // Add recurrence indicator
            content: task.description,
            class: `priority-${task.priority} recurring-task`,
            taskId: task.id,
            instanceId: instance.id,
            isRecurring: true,
            isModified: instance.isModified,
            parentTaskId: instance.parentTaskId
          })
        })
    })

  return events
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

  // Handle recurring task instance modification
  if (event.isRecurring && event.instanceId && event.parentTaskId) {
    // This is a recurring task instance being moved
    const parentTask = taskStore.tasks.find(t => t.id === event.parentTaskId)
    if (parentTask?.recurrence) {
      // Create exception for this instance
      const recurrenceUtils = require('@/utils/recurrenceUtils')
      if (recurrenceUtils && recurrenceUtils.addException) {
        recurrenceUtils.addException(
          event.parentTaskId,
          event.scheduledDate,
          'modify',
          {
            newDate: dateStr,
            newTime: timeStr
          }
        )
      }
    }
  } else {
    // Regular task update
    taskStore.updateTask(event.id, {
      scheduledDate: dateStr,
      scheduledTime: timeStr
    })
  }
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
  // Create new task immediately with default values
  const newTask = taskStore.createTask({
    title: 'New Task',
    description: '',
    status: 'planned',
    priority: 'medium'
  })

  // Open TaskEditModal for editing
  if (newTask) {
    selectedTask.value = newTask
    isEditModalOpen.value = true
    console.log('Opening task edit modal for calendar')
  } else {
    console.error('Failed to create new task')
  }
}

const handleStartTimer = (taskId: string) => {
  timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
}

const handleEditTask = (taskId: string) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId }
  }))
}

// Task Edit Modal handlers
const closeEditModal = () => {
  isEditModalOpen.value = false
  selectedTask.value = null
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

/* Recurring task styles */
.custom-vuecal :deep(.vuecal__event.recurring-task) {
  border-left: 3px solid var(--color-recurring, #8b5cf6);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05));
  position: relative;
}

.custom-vuecal :deep(.vuecal__event.recurring-task::before) {
  content: '🔁';
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 12px;
  opacity: 0.7;
}

.custom-vuecal :deep(.vuecal__event.recurring-task.isModified) {
  border-left-color: var(--color-modified, #f59e0b);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
}

.custom-vuecal :deep(.vuecal__event.recurring-task.isModified::before) {
  content: '✏️';
  color: var(--color-modified, #f59e0b);
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