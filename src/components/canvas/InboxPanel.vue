<template>
  <div class="inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'" @click="isCollapsed = !isCollapsed">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">
        Inbox
      </h3>
      


      <!-- Expanded state count -->
      <NBadge v-if="!isCollapsed" :value="inboxTasks.length" type="info" />

      <!-- Quick Today Filter (TASK-080) -->
      <button
        v-if="!isCollapsed"
        class="today-quick-filter"
        :class="{ active: activeTimeFilter === 'today' }"
        :title="`Show tasks for today (${todayCount})`"
        @click="activeTimeFilter = activeTimeFilter === 'today' ? 'all' : 'today'"
      >
        <CalendarDays :size="14" />
        <span>Today</span>
        <span v-if="todayCount > 0" class="count-badge">{{ todayCount }}</span>
      </button>
    </div>

    <!-- Collapsed state task count indicators positioned under arrow -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <!-- Show dual count when filter is active, single count when no filter -->
      <BaseBadge
        v-if="activeTimeFilter === 'all'"
        variant="count"
        size="sm"
        rounded
      >
        {{ baseInboxTasks.length }}
      </BaseBadge>
      <div v-else class="dual-badges">
        <BaseBadge
          variant="count"
          size="sm"
          rounded
          class="total-count"
        >
          {{ baseInboxTasks.length }}
        </BaseBadge>
        <BaseBadge
          variant="info"
          size="sm"
          rounded
          class="filtered-count"
        >
          {{ inboxTasks.length }}
        </BaseBadge>
      </div>
    </div>

    <!-- Quick Add -->
    <div v-if="!isCollapsed" class="quick-add">
      <input
        v-model="newTaskTitle"
        type="text"
        class="quick-add-input"
        placeholder="Quick add task (Enter)..."
        @keydown.enter="addTask"
      >
    </div>

    <!-- Brain Dump Mode Toggle -->
    <NButton
      v-if="!isCollapsed"
      secondary
      block
      @click="brainDumpMode = !brainDumpMode"
    >
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </NButton>

    <!-- Brain Dump Textarea -->
    <div v-if="!isCollapsed && brainDumpMode" class="brain-dump">
      <textarea
        v-model="brainDumpText"
        class="brain-dump-textarea"
        rows="8"
        placeholder="Paste or type tasks (one per line):
  Write proposal !!!
  Review code 2h
  Call client"
      />
      <NButton
        type="primary"
        block
        size="large"
        :disabled="parsedTaskCount === 0"
        @click="processBrainDump"
      >
        Add {{ parsedTaskCount }} Tasks
      </NButton>
    </div>

    <!-- Time Filters -->
    <div v-if="!isCollapsed">
      <InboxTimeFilters
        :tasks="baseInboxTasks"
        :active-filter="activeTimeFilter"
        @filter-changed="activeTimeFilter = $event as 'all' | 'now' | 'today' | 'tomorrow' | 'thisWeek' | 'noDate'"
      />
    </div>

    <!-- Additional Filters (TASK-018: Unscheduled, Priority, Project) -->
    <InboxFilters
      v-if="!isCollapsed"
      v-model:unscheduled-only="unscheduledOnly"
      v-model:selected-priority="selectedPriority"
      v-model:selected-project="selectedProject"
      v-model:selected-duration="selectedDuration"
      :tasks="baseInboxTasks"
      :projects="taskStore.rootProjects"
      @clear-all="clearAllFilters"
    />

    <!-- Batch Actions Bar -->
    <div v-if="!isCollapsed && selectedTaskIds.size > 0" class="batch-actions">
      <span class="selected-count">{{ selectedTaskIds.size }} selected</span>
      <NButton size="small" secondary @click="selectedTaskIds.clear()">
        Clear
      </NButton>
    </div>

    <!-- Inbox Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks">
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        class="inbox-task-card"
        :class="{
          selected: selectedTaskIds.has(task.id),
          'timer-active': isTimerActive(task.id)
        }"
        draggable="true"
        tabindex="0"
        @click="handleTaskClick($event, task)"
        @dblclick="handleTaskDoubleClick(task)"
        @contextmenu.prevent="handleTaskContextMenu($event, task)"
        @dragstart="handleDragStart($event, task)"
        @keydown="handleTaskKeydown($event, task)"
      >
        <div v-if="selectedTaskIds.has(task.id)" class="selection-indicator" />
        <div :class="`priority-stripe priority-stripe-${task.priority}`" />

        <!-- Timer Active Badge -->
        <div v-if="isTimerActive(task.id)" class="timer-indicator" title="Timer Active">
          <Timer :size="12" />
        </div>

        <div class="task-content">
          <div class="task-title">
            {{ task.title }}
          </div>
          <div class="task-meta">
            <NTag
              :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
              size="small"
              round
            >
              {{ task.priority }}
            </NTag>
            <span v-if="task.estimatedDuration" class="duration-badge">
              {{ task.estimatedDuration }}m
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <TaskContextMenu
      :is-visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="null"
      :selected-count="selectedTaskIds.size"
      :context-task="contextMenuTask"
      @set-priority="handleSetPriority"
      @set-status="handleSetStatus"
      @set-due-date="handleSetDueDate"
      @enter-focus-mode="handleEnterFocusMode"
      @delete-selected="handleDeleteSelected"
      @clear-selection="handleClearSelection"
      @close="closeContextMenu"
      @edit="handleEdit"
      @confirm-delete="handleConfirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NBadge, NTag } from 'naive-ui'
import { ChevronLeft, ChevronRight, Timer, CalendarDays } from 'lucide-vue-next'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import InboxTimeFilters from './InboxTimeFilters.vue'
import InboxFilters from './InboxFilters.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

import { useInboxFiltering } from '@/composables/useInboxFiltering'
import { useInboxDrag } from '@/composables/useInboxDrag'
import { useBrainDump } from '@/composables/useBrainDump'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

const {
  activeTimeFilter,
  unscheduledOnly,
  selectedPriority,
  selectedProject,
  selectedDuration,
  baseInboxTasks,
  todayCount,
  inboxTasks,
  clearAllFilters
} = useInboxFiltering()

const {
  brainDumpMode,
  brainDumpText,
  parsedTaskCount,
  processBrainDump
} = useBrainDump()



const newTaskTitle = ref('')
const isCollapsed = ref(true) // Start collapsed to avoid overwhelming the user
const selectedTaskIds = ref<Set<string>>(new Set())
const lastSelectedTaskId = ref<string | null>(null)

// Context menu state
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null) // Task that was right-clicked

// Check if a task has an active timer
const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}



// Parse brain dump text to count tasks
// Task management methods
const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  const { createTaskWithUndo } = useUnifiedUndoRedo()
  createTaskWithUndo({
    title: newTaskTitle.value.trim(),
    status: 'planned',
    isInInbox: true
  })

  newTaskTitle.value = ''
}



// Task interaction handlers
const handleTaskClick = (event: MouseEvent, task: Task) => {
  console.log('🖱️ Clicked task:', task.id, 'Shift:', event.shiftKey, 'Ctrl:', event.ctrlKey, 'Last:', lastSelectedTaskId.value)
  
  // Handle Shift+Click (Range Selection)
  if (event.shiftKey) {
    if (!lastSelectedTaskId.value) {
      // No start point? Treat as first click of a range (Single Select)
      console.log('Shift click without anchor - setting anchor')
      selectedTaskIds.value = new Set([task.id])
      lastSelectedTaskId.value = task.id
      return
    }

    // Has anchor - try range selection
    const tasks = Array.from(inboxTasks.value || [])
    const lastIndex = tasks.findIndex(t => t.id === lastSelectedTaskId.value)
    const currentIndex = tasks.findIndex(t => t.id === task.id)
    
    // Check if anchor is still visible/valid
    if (lastIndex === -1) {
       console.warn('Anchor task not found in view - treating as new anchor')
       selectedTaskIds.value = new Set([task.id])
       lastSelectedTaskId.value = task.id
       return
    }

    if (currentIndex !== -1) {
      console.log('Range Select: lastIndex', lastIndex, 'currentIndex', currentIndex)
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      
      const rangeTasks = tasks.slice(start, end + 1)
      console.log(`Selecting range of ${rangeTasks.length} tasks`)
      
      // Merge with existing selection (don't clear)
      const newSet = new Set(selectedTaskIds.value) // Keep existing
      rangeTasks.forEach(t => newSet.add(t.id))
      selectedTaskIds.value = newSet
    } else {
      console.warn('Shift+Click target not found in list (?)')
    }
    
    // CRITICAL: Always return if Shift was held to prevent falling through to Single Selection
    return
  }

  // Handle Ctrl/Cmd+Click (Toggle)
  if (event.ctrlKey || event.metaKey) {
    const newSet = new Set(selectedTaskIds.value)
    if (newSet.has(task.id)) {
      newSet.delete(task.id)
      // If we deselect the anchor, we lose our range start
      if (task.id === lastSelectedTaskId.value) lastSelectedTaskId.value = null
    } else {
      newSet.add(task.id)
      lastSelectedTaskId.value = task.id // Update anchor to latest toggle
    }
    selectedTaskIds.value = newSet
  } else {
    // Single Selection (No modifiers)
    console.log('Single selection:', task.id)
    selectedTaskIds.value = new Set([task.id])
    lastSelectedTaskId.value = task.id
  }
}

const handleTaskDoubleClick = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleTaskKeydown = (event: KeyboardEvent, task: Task) => {
  // Handle Delete/Backspace key to delete task
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    console.log('🗑️ Delete key pressed on inbox task:', task.id)

    // If this task is selected along with others, delete all selected
    if (selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1) {
      handleDeleteSelected()
    } else {
      // Single task deletion - use confirm delete for safety
      handleConfirmDelete(task.id)
    }
  }
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  contextMenuTask.value = task
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

const { handleDragStart } = useInboxDrag()

// Context menu handlers
const handleSetPriority = (priority: string) => {
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  const tasksToUpdate = selectedTaskIds.value.size > 0
    ? Array.from(selectedTaskIds.value)
    : [contextMenuTask.value?.id]

  tasksToUpdate.forEach(taskId => {
    if (taskId) {
      updateTaskWithUndo(taskId, { priority: priority as Task['priority'] })
    }
  })

  closeContextMenu()
}

const handleSetStatus = (status: string) => {
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  const tasksToUpdate = selectedTaskIds.value.size > 0
    ? Array.from(selectedTaskIds.value)
    : [contextMenuTask.value?.id]

  tasksToUpdate.forEach(taskId => {
    if (taskId) {
      updateTaskWithUndo(taskId, { status: status as Task['status'] })
    }
  })

  closeContextMenu()
}

const handleSetDueDate = (dateType: string) => {
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  const tasksToUpdate = selectedTaskIds.value.size > 0
    ? Array.from(selectedTaskIds.value)
    : [contextMenuTask.value?.id]

  let dueDate: string | undefined

  switch (dateType) {
    case 'today':
      dueDate = new Date().toISOString().split('T')[0]
      break
    case 'tomorrow': {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      dueDate = tomorrow.toISOString().split('T')[0]
      break
    }
    case 'thisWeek': {
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() + 7)
      dueDate = weekEnd.toISOString().split('T')[0]
      break
    }
    case 'noDate':
      dueDate = undefined
      break
  }

  tasksToUpdate.forEach(taskId => {
    if (taskId) {
      updateTaskWithUndo(taskId, { dueDate })
    }
  })

  closeContextMenu()
}

const handleEnterFocusMode = () => {
  // TODO: Implement focus mode functionality
  console.log('Enter focus mode for task:', contextMenuTask.value?.id)
  closeContextMenu()
}

const handleDeleteSelected = () => {
  const { bulkDeleteTasksWithUndo } = useUnifiedUndoRedo()
  const tasksToDelete = Array.from(selectedTaskIds.value)

  if (tasksToDelete.length > 0) {
    // TASK-050 & BUG-036: Use atomic bulk delete
    bulkDeleteTasksWithUndo(tasksToDelete)
    selectedTaskIds.value.clear()
  }

  closeContextMenu()
}

const handleClearSelection = () => {
  selectedTaskIds.value.clear()
  closeContextMenu()
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

const handleEdit = (taskId: string) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId }
  }))
  closeContextMenu()
}

const handleConfirmDelete = (taskId: string) => {
  const { deleteTaskWithUndo } = useUnifiedUndoRedo()
  deleteTaskWithUndo(taskId)
  selectedTaskIds.value.delete(taskId)
  closeContextMenu()
}

// Lifecycle hooks
onMounted(() => {
  // Component mounted
})

onBeforeUnmount(() => {
  // Cleanup if needed
  closeContextMenu()
})
</script>

<style scoped>
.inbox-panel {
  background: transparent; /* Remove dark overlay */
  backdrop-filter: none; /* Let main app blur handle it if needed, or re-add blur without color */
  border: none; /* Remove border if it creates a boxy look, or keep explicit border only */
  /* border-radius: var(--radius-lg); */
  box-shadow: none; /* Remove shadow to blend in */
  height: 100%;
  width: 320px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
}

.inbox-panel.collapsed {
  width: 3rem;
  min-width: 3rem;
}

.inbox-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-bottom: 1px solid var(--glass-border);
}

.collapse-btn {
  padding: var(--space-1);
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--surface-hover);
}

.inbox-title {
  color: var(--text-primary);
  font-weight: 500;
  font-size: 0.875rem;
  flex: 1;
}

/* Today Quick Filter Button (TASK-080) */
.today-quick-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  height: 28px;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
}

.today-quick-filter:hover {
  background: rgba(30, 30, 30, 0.95);
  border-color: rgba(255, 255, 255, 0.25);
  color: white;
}

.today-quick-filter.active {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #a78bfa;
}

.today-quick-filter .count-badge {
  background: rgba(139, 92, 246, 0.3);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  min-width: 14px;
  text-align: center;
}

.quick-add {
  padding: var(--space-3);
  border-bottom: 1px solid var(--glass-border);
}

/* Native input styling for quick add */
.quick-add-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.quick-add-input:hover {
  border-color: var(--glass-border-hover);
}

.quick-add-input:focus {
  border-color: var(--brand-primary);
  box-shadow: var(--state-hover-glow);
}

.quick-add-input::placeholder {
  color: var(--text-muted);
}

.brain-dump {
  padding: var(--space-3);
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Native textarea styling for brain dump */
.brain-dump-textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  line-height: 1.5;
  outline: none;
  resize: vertical;
  min-height: 120px;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.brain-dump-textarea:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.brain-dump-textarea:focus {
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.15);
}

.brain-dump-textarea::placeholder {
  color: var(--text-muted);
}

.batch-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  background: var(--glass-bg-medium);
  border-bottom: 1px solid var(--glass-border);
}

.selected-count {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
}

.inbox-tasks {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0; /* Important for flexbox to respect parent bounds */
}

.inbox-task-card {
  background: rgba(255, 255, 255, 0.03); /* Very subtle tint instead of opaque glass */
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  user-select: none;
}

.inbox-task-card:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.inbox-task-card.selected {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-primary);
}

.inbox-task-card.timer-active {
  background: var(--timer-active-bg-start);
  border-color: var(--timer-active-border);
}

.selection-indicator {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  width: 0.5rem;
  height: 0.5rem;
  background: var(--color-info);
  border-radius: 50%;
}

.priority-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0.25rem;
}

.priority-stripe-high {
  background: var(--color-priority-high);
}

.priority-stripe-medium {
  background: var(--color-priority-medium);
}

.priority-stripe-low {
  background: var(--color-priority-low);
}

.priority-stripe-null {
  background: var(--text-disabled);
}

.timer-indicator {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  color: var(--color-warning);
}

.task-content {
  padding-left: var(--space-3);
}

.task-title {
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: var(--space-1);
  line-height: 1.25;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.duration-badge {
  color: var(--text-muted);
  font-size: 0.75rem;
}

/* Collapsed state adjustments */
.inbox-panel.collapsed .inbox-header {
  justify-content: center;
}

.collapsed-badges-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  width: 100%;
  overflow: visible;
}

.dual-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.dual-badges .total-count {
  opacity: 0.7;
}

.dual-badges .filtered-count {
  transform: scale(0.9);
}

.inbox-panel.collapsed .quick-add,
.inbox-panel.collapsed .brain-dump,
.inbox-panel.collapsed .batch-actions,
.inbox-panel.collapsed .inbox-tasks {
  display: none;
}

/* Scrollbar styling */
.inbox-tasks::-webkit-scrollbar {
  width: 0.5rem;
}

.inbox-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.inbox-tasks::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 9999px;
}

.inbox-tasks::-webkit-scrollbar-thumb:hover {
  background: var(--glass-border-hover);
}

/* Animation for collapse/expand */
.inbox-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>