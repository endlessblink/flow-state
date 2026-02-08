<template>
  <div class="calendar-inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <CalendarInboxHeader
      v-model:is-collapsed="isCollapsed"
      v-model:show-today-only="showTodayOnly"
      v-model:selected-canvas-groups="selectedCanvasGroups"
      v-model:show-advanced-filters="showAdvancedFilters"
      v-model:unscheduled-only="unscheduledOnly"
      v-model:selected-priorities="selectedPriorities"
      v-model:selected-projects="selectedProjects"
      v-model:selected-durations="selectedDurations"
      :inbox-count="inboxTasks.length"
      :today-count="todayCount"
      :has-active-filters="hasActiveFilters"
      :base-count="baseInboxTasks.length"
      :canvas-group-options="canvasGroupOptions"
      :hide-done-tasks="hideCalendarDoneTasks"
      :base-tasks="baseInboxTasks"
      :root-projects="taskStore.rootProjects"
      :search-query="searchQuery"
      @toggle-hide-done-tasks="toggleHideDoneTasks"
      @clear-all-filters="clearAllFilters"
      @update:search-query="searchQuery = $event"
    />

    <!-- Quick Add & Brain Dump -->
    <div v-if="!isCollapsed">
      <CalendarInboxInput
        v-model="newTaskTitle"
        @add-task="addTask"
      />
    </div>

    <!-- Task List -->
    <div v-if="!isCollapsed" class="inbox-content">
      <CalendarInboxList
        :tasks="inboxTasks"
        :has-group-filter="selectedCanvasGroups.size > 0"
        @task-dragstart="onDragStart"
        @task-dragend="onDragEnd"
        @task-click="handleTaskClick"
        @task-dblclick="handleTaskDoubleClick"
        @task-contextmenu="handleTaskContextMenu"
        @task-keydown="handleTaskKeydown"
        @task-start-timer="handleStartTimer"
        @task-edit="handleEditTask"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useCalendarInboxState } from '@/composables/inbox/useCalendarInboxState'

// Sub-components
import CalendarInboxHeader from './calendar/CalendarInboxHeader.vue'
import CalendarInboxInput from './calendar/CalendarInboxInput.vue'
import CalendarInboxList from './calendar/CalendarInboxList.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const { createTaskWithUndo, deleteTaskWithUndo } = useUnifiedUndoRedo()

// State Composable
const {
  isCollapsed,
  showTodayOnly,
  showAdvancedFilters,
  unscheduledOnly,
  selectedPriorities,
  selectedProjects,
  selectedDurations,
  selectedCanvasGroups,
  searchQuery, // TASK-1075
  hideCalendarDoneTasks,
  canvasGroupOptions,
  baseInboxTasks,
  inboxTasks,
  todayCount,
  hasActiveFilters,
  toggleHideDoneTasks,
  clearAllFilters
} = useCalendarInboxState()

// Local State
const newTaskTitle = ref('')
const draggingTaskId = ref<string | null>(null)

// --- Actions (kept inline for simplicity as they are mostly wrappers) ---

const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  createTaskWithUndo({
    title: newTaskTitle.value.trim(),
    status: 'planned',
    isInInbox: true
  })

  newTaskTitle.value = ''
}

const onDragStart = (e: DragEvent, task: Task) => {
  if (!e.dataTransfer) return

  draggingTaskId.value = task.id
  e.dataTransfer.effectAllowed = 'move'
  
  const dragData = {
    ...task,
    taskId: task.id,
    source: 'calendar-inbox'
  }
  e.dataTransfer.setData('application/json', JSON.stringify(dragData))
}

const onDragEnd = () => {
  draggingTaskId.value = null
}

const handleTaskClick = (_event: MouseEvent, _task: Task) => {
  if (draggingTaskId.value) return
}

const handleTaskDoubleClick = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  event.preventDefault()
  event.stopPropagation()

  window.dispatchEvent(new CustomEvent('task-context-menu', {
    detail: { event, task }
  }))
}

const handleTaskKeydown = (event: KeyboardEvent, task: Task) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    event.stopPropagation()
    console.log('🗑️ Delete key pressed on calendar inbox task:', task.id)
    deleteTaskWithUndo(task.id)
  }
}

const handleStartTimer = async (task: Task) => {
  // BUG-1051: AWAIT for timer sync
  await timerStore.startTimer(task.id)
}

const handleEditTask = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}
</script>

<style scoped>
.calendar-inbox-panel {
  width: 320px;
  margin: var(--space-4) 0 var(--space-4) var(--space-4);
  max-height: calc(100vh - 220px);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: visible;
  transition: width var(--duration-normal) var(--spring-smooth), padding var(--duration-normal);
  position: relative;
  z-index: 100;
  background: var(--inbox-panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
}

.calendar-inbox-panel.collapsed {
  width: 60px;
  padding: var(--space-4) var(--space-2);
}

.inbox-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
