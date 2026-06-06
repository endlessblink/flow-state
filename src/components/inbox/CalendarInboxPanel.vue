<template>
  <div
    class="calendar-inbox-panel"
    :class="{ collapsed: isCollapsed, 'inbox-drop-active': isCalendarDropTarget }"
    @dragover.prevent="handleInboxDragOver"
    @dragenter.prevent="handleInboxDragEnter"
    @dragleave="handleInboxDragLeave"
    @drop.prevent="handleInboxDrop"
  >
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
      v-model:sort-by="sortBy"
      v-model:sort-direction="sortDirection"
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
        @add-task-with-description="addTaskWithDescription"
      />
    </div>

    <!-- Task List -->
    <div v-if="!isCollapsed" class="inbox-content">
      <CalendarInboxList
        :tasks="inboxTasks"
        :has-group-filter="selectedCanvasGroups.size > 0"
        :show-canvas-badge="sortBy === 'canvasOrder'"
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
import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useRecurrenceAwareDelete } from '@/composables/useRecurrenceAwareDelete'
import { useCalendarInboxState } from '@/composables/inbox/useCalendarInboxState'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useFilterDefaults } from '@/composables/tasks/useFilterDefaults'

// Sub-components
import CalendarInboxHeader from './calendar/CalendarInboxHeader.vue'
import CalendarInboxInput from './calendar/CalendarInboxInput.vue'
import CalendarInboxList from './calendar/CalendarInboxList.vue'

const emit = defineEmits<{
  (e: 'calendarDropToInbox', taskId: string): void
}>()

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const { createTaskWithUndo } = useUnifiedUndoRedo()
const { recurrenceAwareDelete } = useRecurrenceAwareDelete()
const { filterDefaults } = useFilterDefaults()

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
  sortBy, // TASK-1303
  sortDirection, // TASK-1412
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
const isCalendarDropTarget = ref(false)

// --- Actions (kept inline for simplicity as they are mostly wrappers) ---

// TASK-1451: Compute local calendar inbox defaults (showTodayOnly is local, not in global store)
const calendarLocalDefaults = computed(() => {
  const defaults: Record<string, unknown> = {}
  if (showTodayOnly.value) {
    const d = new Date()
    defaults.dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return defaults
})

const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  const taskData = {
    ...filterDefaults.value,
    ...calendarLocalDefaults.value,
    title: newTaskTitle.value.trim(),
    status: 'todo' as const,
    isInInbox: true
  }
  console.log('[TASK-1451] Calendar addTask:', { showTodayOnly: showTodayOnly.value, filterDefaults: filterDefaults.value, calendarLocalDefaults: calendarLocalDefaults.value, taskData })
  createTaskWithUndo(taskData)

  newTaskTitle.value = ''
}

// TASK-1325: Add task with description (from URL scraping)
const addTaskWithDescription = (title: string, description: string) => {
  if (!title.trim()) return

  createTaskWithUndo({
    ...filterDefaults.value,
    ...calendarLocalDefaults.value,
    title: title.trim(),
    description: description.trim(),
    status: 'todo',
    isInInbox: true
  })

  newTaskTitle.value = ''
}

const { startDrag: startGlobalDrag, endDrag: endGlobalDrag } = useDragAndDrop()

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

  // Unified ghost pill — pass event for setDragImage
  startGlobalDrag({ type: 'task', taskId: task.id, title: task.title, source: 'calendar' }, e)
}

const onDragEnd = () => {
  draggingTaskId.value = null
  endGlobalDrag()
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
    recurrenceAwareDelete(task.id)
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

const handleInboxDragOver = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

const handleInboxDragEnter = (e: DragEvent) => {
  try {
    if (window.__draggingTaskId || e.dataTransfer?.types.includes('application/json')) {
      isCalendarDropTarget.value = true
    }
  } catch {
    // Ignore dataTransfer access issues in browser edge cases.
  }
}

const handleInboxDragLeave = (e: DragEvent) => {
  const related = e.relatedTarget as HTMLElement | null
  const panel = e.currentTarget as HTMLElement
  if (!related || !panel.contains(related)) {
    isCalendarDropTarget.value = false
  }
}

const handleInboxDrop = (e: DragEvent) => {
  isCalendarDropTarget.value = false

  let taskId: string | null = null
  let source: string | null = null

  try {
    const jsonStr = e.dataTransfer?.getData('application/json')
    if (jsonStr) {
      const data = JSON.parse(jsonStr)
      taskId = data.taskId
      source = data.source
    }
  } catch {
    // Fall back to the global drag signal below.
  }

  if (!taskId) {
    taskId = window.__draggingTaskId || null
    source = 'calendar-event'
  }

  if (taskId && (source === 'calendar-event' || source === 'calendar')) {
    emit('calendarDropToInbox', taskId)
  }
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

.calendar-inbox-panel.inbox-drop-active {
  border-color: var(--brand-primary);
  box-shadow: inset 0 0 0 2px var(--brand-primary), 0 0 16px var(--brand-primary-dim);
  background: var(--brand-primary-subtle);
}

.inbox-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
