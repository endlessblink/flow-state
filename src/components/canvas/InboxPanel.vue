<template>
  <div class="inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button @click="isCollapsed = !isCollapsed" class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">Inbox</h3>

      <!-- Collapsed state task count indicators -->
      <div v-if="isCollapsed" class="collapsed-badges">
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

      <!-- Expanded state count -->
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
    <div v-if="!isCollapsed">
      <InboxTimeFilters
        :tasks="baseInboxTasks"
        :active-filter="activeTimeFilter"
        @filter-changed="activeTimeFilter = $event"
      />
    </div>

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
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import InboxTimeFilters from './InboxTimeFilters.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

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

// Get ONLY inbox tasks (tasks without canvas position, excluding done tasks)
const baseInboxTasks = computed(() =>
  taskStore.filteredTasks.filter(task =>
    (task.isInInbox || !task.canvasPosition) && task.status !== 'done'
  )
)

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

// Apply time-based filtering to inbox tasks
const inboxTasks = computed(() => {
  const tasks = baseInboxTasks.value

  switch (activeTimeFilter.value) {
    case 'all':
      return tasks

    case 'now':
      // Tasks due today, created today, currently in progress, or currently running (timer active)
      const today = getToday().toISOString().split('T')[0]
      const taskCreatedDate = new Date()
      taskCreatedDate.setHours(0, 0, 0, 0)

      return tasks.filter(task => {
        // Check instances for today scheduling
        if (task.instances && task.instances.length > 0) {
          if (task.instances.some((inst: any) => inst.scheduledDate === today)) return true
        }
        // Fallback to legacy scheduledDate
        if (task.scheduledDate === today) return true

        return false
      })

    case 'tomorrow':
      return tasks.filter(task => {
        const tomorrow = getTomorrow().toISOString().split('T')[0]
        // Check instances for tomorrow scheduling
        if (task.instances && task.instances.length > 0) {
          if (task.instances.some((inst: any) => inst.scheduledDate === tomorrow)) return true
        }
        // Fallback to legacy scheduledDate
        if (task.scheduledDate === tomorrow) return true
        return false
      })

    case 'thisWeek':
      return tasks.filter(task => {
        // Check instances for this week scheduling
        if (task.instances && task.instances.length > 0) {
          if (task.instances.some((inst: any) => isThisWeek(inst.scheduledDate))) return true
        }
        // Fallback to legacy scheduledDate
        if (isThisWeek(task.scheduledDate)) return true
        return false
      })

    case 'noDate':
      return tasks.filter(task => !hasDate(task))

    default:
      return tasks
  }
})

// Parse brain dump text to count tasks
const parsedTaskCount = computed(() => {
  if (!brainDumpText.value.trim()) return 0

  const lines = brainDumpText.value.split('\n').filter(line => line.trim())
  return lines.length
})

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

const processBrainDump = () => {
  if (!brainDumpText.value.trim()) return

  const lines = brainDumpText.value.split('\n').filter(line => line.trim())
  const { createTaskWithUndo } = useUnifiedUndoRedo()

  lines.forEach(line => {
    // Parse task line for priority, duration, etc.
    const cleanedLine = line.trim()
    let title = cleanedLine
    let priority: any = null
    let estimatedDuration: number | undefined

    // Extract priority (e.g., "!!!", "!!", "!")
    const priorityMatch = cleanedLine.match(/(!+)$/)
    if (priorityMatch) {
      const exclamationCount = priorityMatch[1].length
      if (exclamationCount >= 3) priority = 'high'
      else if (exclamationCount === 2) priority = 'medium'
      else if (exclamationCount === 1) priority = 'low'
      title = cleanedLine.replace(/\s*!+$/, '').trim()
    }

    // Extract duration (e.g., "2h", "30m")
    const durationMatch = cleanedLine.match(/(\d+)([hm])$/i)
    if (durationMatch) {
      const value = parseInt(durationMatch[1])
      const unit = durationMatch[2].toLowerCase()
      if (unit === 'h') estimatedDuration = value * 60
      else estimatedDuration = value
      title = cleanedLine.replace(/\s*\d+[hm]$/i, '').trim()
    }

    createTaskWithUndo({
      title,
      priority,
      estimatedDuration,
      status: 'planned',
      isInInbox: true
    })
  })

  // Clear brain dump
  brainDumpText.value = ''
  brainDumpMode.value = false
}

// Task interaction handlers
const handleTaskClick = (event: MouseEvent, task: any) => {
  if (event.ctrlKey || event.metaKey) {
    // Toggle selection with Ctrl/Cmd
    if (selectedTaskIds.value.has(task.id)) {
      selectedTaskIds.value.delete(task.id)
    } else {
      selectedTaskIds.value.add(task.id)
    }
  } else {
    // Single selection
    selectedTaskIds.value.clear()
    selectedTaskIds.value.add(task.id)
  }
}

const handleTaskDoubleClick = (task: any) => {
  // TODO: Implement task editing functionality
  console.log('Edit task:', task.id)
}

const handleTaskContextMenu = (event: MouseEvent, task: any) => {
  contextMenuTask.value = task
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

const handleDragStart = (event: DragEvent, task: any) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: 'task',
      taskId: task.id,
      taskIds: [task.id], // For batch operation compatibility
      title: task.title,
      fromInbox: true,
      source: 'inbox'
    }))
    event.dataTransfer.effectAllowed = 'move'
  }
}

// Context menu handlers
const handleSetPriority = (priority: string) => {
  const { updateTaskWithUndo } = useUnifiedUndoRedo()
  const tasksToUpdate = selectedTaskIds.value.size > 0
    ? Array.from(selectedTaskIds.value)
    : [contextMenuTask.value?.id]

  tasksToUpdate.forEach(taskId => {
    if (taskId) {
      updateTaskWithUndo(taskId, { priority: priority as any })
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
      updateTaskWithUndo(taskId, { status: status as any })
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
    case 'tomorrow':
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      dueDate = tomorrow.toISOString().split('T')[0]
      break
    case 'thisWeek':
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() + 7)
      dueDate = weekEnd.toISOString().split('T')[0]
      break
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
  const { deleteTasksWithUndo } = useUnifiedUndoRedo()
  const tasksToDelete = Array.from(selectedTaskIds.value)

  if (tasksToDelete.length > 0) {
    deleteTasksWithUndo(tasksToDelete)
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
  // TODO: Implement task editing functionality
  console.log('Edit task:', taskId)
  closeContextMenu()
}

const handleConfirmDelete = (taskId: string) => {
  const { deleteTasksWithUndo } = useUnifiedUndoRedo()
  deleteTasksWithUndo([taskId])
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
  @apply bg-white/10 backdrop-blur-md rounded-lg border border-white/20 h-full flex flex-col overflow-hidden;
  transition: all 0.3s ease;
}

.inbox-panel.collapsed {
  @apply min-w-12;
}

.inbox-header {
  @apply flex items-center gap-2 p-3 border-b border-white/10;
}

.collapse-btn {
  @apply p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0;
}

.inbox-title {
  @apply text-white font-medium text-sm flex-1;
}

.quick-add {
  @apply p-3 border-b border-white/10;
}

.brain-dump {
  @apply p-3 border-b border-white/10 space-y-3;
}

.batch-actions {
  @apply flex items-center justify-between p-2 bg-white/5 border-b border-white/10;
}

.selected-count {
  @apply text-white/70 text-xs font-medium;
}

.inbox-tasks {
  @apply flex-1 overflow-y-auto p-2 space-y-2;
}

.inbox-task-card {
  @apply bg-white/5 border border-white/10 rounded-lg p-3 cursor-pointer relative;
  @apply hover:bg-white/10 hover:border-white/20 transition-all duration-200;
  @apply select-none;
}

.inbox-task-card.selected {
  @apply bg-blue-500/20 border-blue-400/50;
}

.inbox-task-card.timer-active {
  @apply bg-orange-500/10 border-orange-400/50;
}

.selection-indicator {
  @apply absolute top-2 left-2 w-2 h-2 bg-blue-400 rounded-full;
}

.priority-stripe {
  @apply absolute left-0 top-0 bottom-0 w-1;
}

.priority-stripe-high {
  @apply bg-red-400;
}

.priority-stripe-medium {
  @apply bg-yellow-400;
}

.priority-stripe-low {
  @apply bg-blue-400;
}

.priority-stripe-null {
  @apply bg-gray-400;
}

.timer-indicator {
  @apply absolute top-2 right-2 text-orange-400;
}

.task-content {
  @apply pl-3;
}

.task-title {
  @apply text-white text-sm font-medium mb-1 leading-tight;
}

.task-meta {
  @apply flex items-center gap-2;
}

.duration-badge {
  @apply text-white/50 text-xs;
}

/* Collapsed state adjustments */
.inbox-panel.collapsed .inbox-header {
  @apply justify-center;
}

.collapsed-badges {
  @apply flex flex-col items-center gap-1;
}

.dual-badges {
  @apply flex flex-col items-center gap-1;
}

.dual-badges .total-count {
  @apply opacity-70;
}

.dual-badges .filtered-count {
  @apply scale-90;
}

.inbox-panel.collapsed .quick-add,
.inbox-panel.collapsed .brain-dump,
.inbox-panel.collapsed .batch-actions,
.inbox-panel.collapsed .inbox-tasks {
  @apply hidden;
}

/* Scrollbar styling */
.inbox-tasks::-webkit-scrollbar {
  @apply w-2;
}

.inbox-tasks::-webkit-scrollbar-track {
  @apply bg-transparent;
}

.inbox-tasks::-webkit-scrollbar-thumb {
  @apply bg-white/20 rounded-full;
}

.inbox-tasks::-webkit-scrollbar-thumb:hover {
  @apply bg-white/30;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .inbox-panel {
    @apply bg-gray-900/50 border-gray-700/50;
  }

  .inbox-task-card {
    @apply bg-gray-800/50 border-gray-700/50;
    @apply hover:bg-gray-800/70 hover:border-gray-600/50;
  }
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

