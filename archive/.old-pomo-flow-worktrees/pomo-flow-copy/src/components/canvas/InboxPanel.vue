<template>
  <div class="inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button @click="isCollapsed = !isCollapsed" class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">Inbox</h3>
      <n-badge v-if="!isCollapsed" :value="inboxTasks.length" type="info" />
    </div>

    <!-- Quick Add -->
    <div v-if="!isCollapsed" class="quick-add">
      <n-input
        v-model:value="newTaskTitle"
        @keydown.enter="addTask"
        placeholder="Quick add task (Enter)..."
        size="large"
        clearable
      />
    </div>

    <!-- Brain Dump Mode Toggle -->
    <n-button
      v-if="!isCollapsed"
      @click="brainDumpMode = !brainDumpMode"
      secondary
      block
    >
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </n-button>

    <!-- Brain Dump Textarea -->
    <div v-if="!isCollapsed && brainDumpMode" class="brain-dump">
      <n-input
        v-model:value="brainDumpText"
        type="textarea"
        placeholder="Paste or type tasks (one per line):
  Write proposal !!!
  Review code 2h
  Call client"
        :rows="8"
      />
      <n-button
        @click="processBrainDump"
        type="primary"
        block
        size="large"
        :disabled="parsedTaskCount === 0"
      >
        Add {{ parsedTaskCount }} Tasks
      </n-button>
    </div>

    <!-- Time Filters -->
    <InboxTimeFilters
      v-if="!isCollapsed"
      :tasks="baseInboxTasks"
      :active-filter="activeTimeFilter"
      @filter-changed="activeTimeFilter = $event"
    />

    <!-- Batch Actions Bar -->
    <div v-if="!isCollapsed && selectedTaskIds.size > 0" class="batch-actions">
      <span class="selected-count">{{ selectedTaskIds.size }} selected</span>
      <n-button @click="selectedTaskIds.clear()" size="small" secondary>Clear</n-button>
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
        @click="handleTaskClick($event, task)"
        @dblclick="handleTaskDoubleClick(task)"
        @contextmenu.prevent="handleTaskContextMenu($event, task)"
        @dragstart="handleDragStart($event, task)"
        @dragend="handleDragEnd"
      >
        <div v-if="selectedTaskIds.has(task.id)" class="selection-indicator" />
        <div :class="`priority-stripe priority-stripe-${task.priority}`"></div>

        <!-- Timer Active Badge -->
        <div v-if="isTimerActive(task.id)" class="timer-indicator" title="Timer Active">
          <Timer :size="12" />
        </div>

        <div class="task-content">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-meta">
            <n-tag
              :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
              size="small"
              round
            >
              {{ task.priority }}
            </n-tag>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { NInput, NButton, NBadge, NTag, NIcon } from 'naive-ui'
import { Plus, Zap, Clock, ChevronLeft, ChevronRight, Timer } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { filterTasksByView } from '@/utils/taskFilters'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import InboxTimeFilters from './InboxTimeFilters.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

const newTaskTitle = ref('')
const brainDumpMode = ref(false)
const brainDumpText = ref('')
const isCollapsed = ref(true) // Start collapsed to avoid overwhelming the user
const quickInputRef = ref<HTMLInputElement>()
const selectedTaskIds = ref<Set<string>>(new Set())

// Time filter state
const activeTimeFilter = ref<'all' | 'now' | 'today' | 'tomorrow' | 'thisWeek' | 'noDate'>('all')

// Context menu state
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<any>(null) // Task that was right-clicked

// 🎯 FIXED: Use unified filtering for inbox tasks
const baseInboxTasks = computed(() => {
  console.log('🔧 Canvas InboxPanel: Using unified inbox filtering')

  // Use unified filtering system with inbox smart view
  const inboxTasks = filterTasksByView(
    taskStore.tasks,
    'canvas',
    {
      smartView: 'inbox',
      showInInbox: true,
      showPositioned: false,
      hideDoneTasks: true,
      projects: taskStore.projects
    },
    taskStore.projects
  )

  console.log('🔧 Canvas InboxPanel: Unified inbox filtered to', inboxTasks.length, 'tasks')
  return inboxTasks
})

// Check if a task has an active timer
const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}

// Helper functions for date calculations
const getToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const getTomorrow = () => {
  const tomorrow = new Date(getToday())
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}

const getWeekEnd = () => {
  const weekEnd = new Date(getToday())
  weekEnd.setDate(weekEnd.getDate() + 7)
  return weekEnd
}

const isToday = (dateStr?: string) => {
  if (!dateStr) return false
  const today = getToday()
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date.getTime() === today.getTime()
}

const isTomorrow = (dateStr?: string) => {
  if (!dateStr) return false
  const tomorrow = getTomorrow()
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date.getTime() === tomorrow.getTime()
}

const isThisWeek = (dateStr?: string) => {
  if (!dateStr) return false
  const today = getToday()
  const weekEnd = getWeekEnd()
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date >= today && date < weekEnd
}

const hasDate = (task: any) => {
  // Check instances first (new format)
  if (task.instances && task.instances.length > 0) {
    return task.instances.some((inst: any) => inst.scheduledDate)
  }
  // Fallback to legacy scheduledDate
  return !!task.scheduledDate
}

// 🎯 FIXED: Use store filtering instead of complex local filtering
const inboxTasks = computed(() => {
  console.log('🔧 Canvas InboxPanel: Using store filtering for time filter:', activeTimeFilter.value)

  // Map canvas time filters to store smart views
  switch (activeTimeFilter.value) {
    case 'all':
      taskStore.setActiveSmartView(null)
      break
    case 'now':
    case 'today':
      taskStore.setActiveSmartView('today')
      break
    case 'tomorrow':
      // For tomorrow, we'd need date-specific filtering - use inbox for now
      taskStore.setActiveSmartView('inbox')
      break
    case 'thisWeek':
      taskStore.setActiveSmartView('today')  // Use today as closest approximation
      break
    case 'noDate':
      taskStore.setActiveSmartView('inbox')
      break
    default:
      taskStore.setActiveSmartView(null)
  }

  // Get store's filtered tasks (now includes our smart view setting)
  const storeFiltered = taskStore.filteredTasks

  // Apply inbox-specific canvas filtering (only tasks that should be in canvas inbox)
  const canvasInboxTasks = storeFiltered.filter(task =>
    (task.isInInbox || !task.canvasPosition) && task.status !== 'done'
  )

  console.log('🔧 Canvas InboxPanel: Final filtered count:', canvasInboxTasks.length)
  return canvasInboxTasks

// Parse brain dump text to count tasks
const parsedTaskCount = computed(() => {
  if (!brainDumpText.value.trim()) return 0
  return brainDumpText.value.split('\n').filter(line => line.trim()).length
})

// Add single task from quick input
const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  taskStore.createTask({
    title: newTaskTitle.value.trim(),
    isInInbox: true,
    priority: 'medium',
    status: 'planned',
    projectId: taskStore.activeProjectId || taskStore.getDefaultProjectId() // Use active project filter or proper default
  })

  newTaskTitle.value = ''
  quickInputRef.value?.focus()
}

// Process brain dump (multi-line)
const processBrainDump = () => {
  const lines = brainDumpText.value.split('\n').filter(line => line.trim())

  lines.forEach(line => {
    let title = line.trim()
    let priority: 'low' | 'medium' | 'high' = 'medium'
    let estimatedDuration: number | undefined

    // Parse priority markers
    if (title.includes('!!!')) {
      priority = 'high'
      title = title.replace(/!!!/g, '').trim()
    } else if (title.includes('!!')) {
      priority = 'medium'
      title = title.replace(/!!/g, '').trim()
    } else if (title.includes('!')) {
      priority = 'low'
      title = title.replace(/!/g, '').trim()
    }

    // Parse time estimates (30m, 1h, 2h, etc.)
    const timeMatch = title.match(/(\d+)(h|m)/i)
    if (timeMatch) {
      const value = parseInt(timeMatch[1])
      const unit = timeMatch[2].toLowerCase()
      estimatedDuration = unit === 'h' ? value * 60 : value
      title = title.replace(/\d+(h|m)/i, '').trim()
    }

    // Create task
    if (title) {
      taskStore.createTask({
        title,
        priority,
        estimatedDuration,
        isInInbox: true,
        status: 'planned'
      })
    }
  })

  brainDumpText.value = ''
  brainDumpMode.value = false
}

// Handle task click for multi-select
const handleTaskClick = (event: MouseEvent, task: any) => {
  // Cmd/Ctrl for multi-select - ONLY way to select
  if (event.metaKey || event.ctrlKey) {
    if (selectedTaskIds.value.has(task.id)) {
      selectedTaskIds.value.delete(task.id)
    } else {
      selectedTaskIds.value.add(task.id)
    }
  }
  // Shift for range select (future enhancement)
  else if (event.shiftKey) {
    // TODO: Implement range selection
    selectedTaskIds.value.add(task.id)
  }
  // Normal click without modifier - do nothing (allows friction-free dragging)
  // No auto-selection - drag works directly without pre-selecting
}

// Handle double-click to edit task
const handleTaskDoubleClick = (task: any) => {
  // Clear any selection when opening edit modal (double-click takes priority)
  selectedTaskIds.value.clear()

  // Emit custom event for App.vue to handle (opens edit modal)
  // App.vue expects taskId in detail, not task object
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

// Handle right-click context menu
const handleTaskContextMenu = (event: MouseEvent, task: any) => {
  // Only show context menu without selecting the task
  // Clear selection to prevent multi-select from right-click
  selectedTaskIds.value.clear()

  // Store the task that was right-clicked for context menu actions
  contextMenuTask.value = task

  // Show context menu
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

// Context menu actions
const handleSetPriority = (priority: 'low' | 'medium' | 'high') => {
  console.log('🔧 handleSetPriority called with priority:', priority)
  console.log('🔧 contextMenuTask.value:', contextMenuTask.value)
  console.log('🔧 selectedTaskIds.value:', Array.from(selectedTaskIds.value))

  // If we have a right-clicked task, update that one
  if (contextMenuTask.value) {
    console.log('🔧 Updating context task priority:', contextMenuTask.value.id, 'to', priority)
    taskStore.updateTask(contextMenuTask.value.id, { priority })
  }
  // Otherwise, update all selected tasks (for backward compatibility)
  else if (selectedTaskIds.value.size > 0) {
    console.log('🔧 Updating selected tasks priority:', Array.from(selectedTaskIds.value), 'to', priority)
    selectedTaskIds.value.forEach(taskId => {
      taskStore.updateTask(taskId, { priority })
    })
  }
  closeContextMenu()
}

const handleSetStatus = (status: 'planned' | 'in_progress' | 'done') => {
  console.log('🔧 handleSetStatus called with status:', status)
  console.log('🔧 contextMenuTask.value:', contextMenuTask.value)
  console.log('🔧 selectedTaskIds.value:', Array.from(selectedTaskIds.value))

  // If we have a right-clicked task, update that one
  if (contextMenuTask.value) {
    console.log('🔧 Updating context task status:', contextMenuTask.value.id, 'to', status)
    taskStore.updateTask(contextMenuTask.value.id, { status })
  }
  // Otherwise, update all selected tasks (for backward compatibility)
  else if (selectedTaskIds.value.size > 0) {
    console.log('🔧 Updating selected tasks status:', Array.from(selectedTaskIds.value), 'to', status)
    selectedTaskIds.value.forEach(taskId => {
      taskStore.updateTask(taskId, { status })
    })
    selectedTaskIds.value.clear()
  }
  closeContextMenu()
}

const handleDeleteSelected = () => {
  // If we have a right-clicked task, delete that one
  if (contextMenuTask.value) {
    if (confirm(`Delete "${contextMenuTask.value.title}"?`)) {
      taskStore.deleteTask(contextMenuTask.value.id)
    }
  }
  // Otherwise, delete all selected tasks (for backward compatibility)
  else if (selectedTaskIds.value.size > 0) {
    if (confirm(`Delete ${selectedTaskIds.value.size} selected tasks?`)) {
      selectedTaskIds.value.forEach(taskId => {
        taskStore.deleteTask(taskId)
      })
      selectedTaskIds.value.clear()
    }
  }
  closeContextMenu()
}

const handleClearSelection = () => {
  selectedTaskIds.value.clear()
  closeContextMenu()
}

// Date setting handler
const handleSetDueDate = (dateType: 'today' | 'tomorrow' | 'weekend' | 'nextweek') => {
  console.log('🔧 handleSetDueDate called with dateType:', dateType)
  console.log('🔧 contextMenuTask.value:', contextMenuTask.value)

  if (contextMenuTask.value) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let dueDate: Date | null = null

    switch (dateType) {
      case 'today':
        dueDate = today
        break
      case 'tomorrow':
        dueDate = new Date(today)
        dueDate.setDate(today.getDate() + 1)
        break
      case 'weekend':
        dueDate = new Date(today)
        const daysUntilSaturday = (6 - today.getDay()) % 7 || 7
        dueDate.setDate(today.getDate() + daysUntilSaturday)
        break
      case 'nextweek':
        dueDate = new Date(today)
        const daysUntilMonday = (8 - today.getDay()) % 7 || 7
        dueDate.setDate(today.getDate() + daysUntilMonday)
        break
    }

    if (dueDate) {
      const formattedDate = dueDate.toLocaleDateString()
      console.log('🔧 Setting due date for task:', contextMenuTask.value.id, 'to', formattedDate)
      taskStore.updateTask(contextMenuTask.value.id, { dueDate: formattedDate })
    }
  }
  closeContextMenu()
}

// Focus mode handler
const handleEnterFocusMode = () => {
  console.log('🔧 handleEnterFocusMode called')
  console.log('🔧 contextMenuTask.value:', contextMenuTask.value)

  if (contextMenuTask.value) {
    // Emit custom event for App.vue to handle (opens focus view)
    window.dispatchEvent(new CustomEvent('enter-focus-mode', {
      detail: { taskId: contextMenuTask.value.id }
    }))
  }
  closeContextMenu()
}

// Edit task handler (for TaskContextMenu compatibility)
const handleEdit = (taskId: string) => {
  // Clear any selection when opening edit modal (double-click takes priority)
  selectedTaskIds.value.clear()

  // Emit custom event for App.vue to handle (opens edit modal)
  // App.vue expects taskId in detail, not task object
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId }
  }))
  closeContextMenu()
}

// Confirm delete handler (for TaskContextMenu compatibility)
const handleConfirmDelete = (taskId: string, instanceId?: string, isCalendarEvent?: boolean) => {
  // Handle single task deletion (same logic as handleDeleteSelected)
  if (confirm(`Delete "${contextMenuTask.value?.title || 'task'}"?`)) {
    taskStore.deleteTask(taskId)
  }
  closeContextMenu()
}

// Handle drag start from inbox - supports batch dragging
const handleDragStart = (event: DragEvent, task: any) => {
  // If dragging a selected task, drag all selected tasks
  let taskIds: string[]
  if (selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1) {
    taskIds = Array.from(selectedTaskIds.value)
  } else {
    taskIds = [task.id]
    selectedTaskIds.value.clear()
    selectedTaskIds.value.add(task.id)
  }

  event.dataTransfer?.setData('application/json', JSON.stringify({
    type: 'task',
    taskIds, // Array of task IDs for batch operations
    taskId: taskIds[0], // Single task ID for backward compatibility
    title: task.title,
    source: 'canvas-inbox',
    fromInbox: true
  }))
}

// Handle drag end to clean up drag state
const handleDragEnd = () => {
  const { endDrag } = useDragAndDrop()
  endDrag()
}

// Click outside handler to close context menu
const handleClickOutside = (event: MouseEvent) => {
  if (showContextMenu.value) {
    const target = event.target as HTMLElement
    if (!target.closest('.inbox-context-menu')) {
      closeContextMenu()
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* UNIFIED DESIGN SYSTEM - Outlined + Glass with Green Accent */

.inbox-panel {
  width: 320px;
  margin: var(--space-4) 0; /* RTL: top and bottom margins */
  margin-inline-start: var(--space-4); /* RTL: left margin in LTR, right margin in RTL */
  max-height: calc(100vh - 220px);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: visible;
  transition: width var(--duration-normal) var(--spring-smooth), padding var(--duration-normal);
  /* Clean solid background matching target design */
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 16px; /* Moderate rounded corners */
  box-shadow: var(--shadow-sm);
}

.inbox-panel.collapsed {
  width: 60px;
  padding: var(--space-4) var(--space-2);
}

.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow);
}

.inbox-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.quick-add {
  /* Naive UI handles internal styling */
}

.brain-dump {
  padding: var(--space-4);
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.inbox-tasks {
  flex: 1;
  overflow-x: visible;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  margin: calc(var(--space-2) * -1) calc(var(--space-4) * -1);
}

/* Unified card styling - subtle at rest, green vibrant on hover */
.inbox-task-card {
  position: relative;
  padding: var(--space-4);
  margin-bottom: var(--space-1);
  cursor: move;
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
}

.inbox-task-card:last-child {
  margin-bottom: 0;
}

.inbox-task-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-2px) scale(1.01);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
  z-index: 10;
}

/* Hover state: Enhanced visibility */
.inbox-task-card:hover .task-title {
  color: var(--text-primary);
}

.inbox-task-card:hover .task-meta {
  opacity: 0.95;
}

.priority-stripe {
  position: absolute;
  top: 0;
  inset-inline-start: 0; /* RTL: priority stripe position */
  width: 3px;
  height: 100%;
  border-start-start-radius: var(--radius-sm); /* RTL: top-left in LTR, top-right in RTL */
  border-end-start-radius: var(--radius-sm); /* RTL: bottom-left in LTR, bottom-right in RTL */
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  transition: color var(--duration-normal);
}

.task-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  transition: opacity var(--duration-normal);
}

.duration-badge {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

/* Unified scrollbar styling */
.inbox-tasks::-webkit-scrollbar {
  width: 6px;
}

.inbox-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.inbox-tasks::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast);
}

.inbox-tasks::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.inbox-tasks {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

/* Batch Actions Bar */
.batch-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--blue-bg-medium);
  border: 1px solid var(--blue-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.selected-count {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--blue-text);
}

/* Timer Active Styling */
.inbox-task-card.timer-active {
  background: var(--blue-bg-subtle);
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-md), 0 0 0 2px var(--brand-primary), 0 0 16px rgba(59, 130, 246, 0.3);
}

.inbox-task-card.timer-active .priority-stripe {
  background: var(--brand-primary) !important;
  box-shadow: 0 0 8px var(--brand-primary);
}

/* Timer Indicator */
.timer-indicator {
  position: absolute;
  top: 6px;
  inset-inline-end: 6px; /* RTL: timer indicator position */
  width: 20px;
  height: 20px;
  background: var(--brand-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 2px 6px var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
  border: 2px solid white;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 6px var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 2px 10px var(--brand-primary), 0 0 12px rgba(59, 130, 246, 0.4);
  }
}

/* Selected Task Styling */
.inbox-task-card.selected {
  background: var(--blue-bg-medium);
  border-color: var(--blue-border-active);
  box-shadow: var(--shadow-md), 0 0 0 2px var(--blue-bg-subtle);
}

.selection-indicator {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2); /* RTL: selection indicator position */
  width: 20px;
  height: 20px;
  background: var(--blue-bg);
  border: 2px solid var(--blue-border-active);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.selection-indicator::after {
  content: '✓';
  color: var(--blue-text);
  font-size: 12px;
  font-weight: bold;
}
</style>
