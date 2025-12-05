<template>
  <div class="unified-inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button @click="isCollapsed = !isCollapsed" class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">Inbox</h3>

      <!-- Expanded state count -->
      <span v-if="!isCollapsed" class="inbox-count">{{ inboxTasks.length }}</span>
    </div>

    <!-- Collapsed state task count indicators -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <BaseBadge
        v-if="activeFilter === 'all'"
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

    <!-- Smart Filter Bar - Horizontal Compact Tabs -->
    <div v-if="!isCollapsed" class="smart-filters-horizontal">
      <button
        v-for="filter in smartFilters"
        :key="filter.key"
        :class="['filter-tab', { active: activeFilter === filter.key }]"
        @click="activeFilter = filter.key as any"
        :title="filter.description"
        :aria-label="`${filter.label}: ${filter.count} tasks`"
        role="tab"
        :aria-selected="activeFilter === filter.key"
      >
        <span class="filter-icon">{{ filter.icon }}</span>
        <span class="filter-label">{{ filter.label }}</span>
        <BaseBadge
          variant="count"
          size="sm"
          :class="{ 'count-active': activeFilter === filter.key }"
        >
          {{ filter.count }}
        </BaseBadge>
      </button>
    </div>

    <!-- Quick Add Input -->
    <div v-if="!isCollapsed" class="quick-add">
      <input
        v-model="newTaskTitle"
        @keydown.enter="addTask"
        placeholder="Quick add task (Enter)..."
        class="quick-add-input"
      />
    </div>

    <!-- Brain Dump Mode (optional) -->
    <div v-if="!isCollapsed && showBrainDump">
      <button
        @click="brainDumpMode = !brainDumpMode"
        class="brain-dump-toggle"
      >
        {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
      </button>

      <div v-if="brainDumpMode" class="brain-dump">
        <textarea
          v-model="brainDumpText"
          placeholder="Paste or type tasks (one per line):
Write proposal !!!
Review code 2h
Call client"
          class="brain-dump-textarea"
          rows="8"
        />
        <button
          @click="processBrainDump"
          class="process-brain-dump-btn"
          :disabled="parsedTaskCount === 0"
        >
          Add {{ parsedTaskCount }} Tasks
        </button>
      </div>
    </div>

    <!-- Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks">
      <!-- Empty State -->
      <div v-if="inboxTasks.length === 0" class="empty-inbox">
        <div class="empty-icon">📋</div>
        <p class="empty-text">No tasks in this filter</p>
        <p class="empty-subtext">{{ getEmptyMessage() }}</p>
      </div>

      <!-- Selection Bar (shown when tasks are selected) -->
      <div v-if="multiSelectMode" class="selection-bar">
        <span class="selection-count">{{ selectedTaskIds.size }} selected</span>
        <button @click="deleteSelectedTasks" class="selection-action delete-action" title="Delete selected tasks">
          <Trash2 :size="14" />
          Delete
        </button>
        <button @click="clearSelection" class="selection-action clear-action" title="Clear selection (Esc)">
          <X :size="14" />
          Clear
        </button>
      </div>

      <!-- Task Cards -->
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        :class="['task-card', { selected: selectedTaskIds.has(task.id) }]"
        draggable="true"
        tabindex="0"
        @dragstart="onDragStart($event, task)"
        @dragend="onDragEnd"
        @click="handleTaskClick($event, task)"
        @dblclick="handleTaskDoubleClick(task)"
        @contextmenu.prevent="handleTaskContextMenu($event, task)"
        @keydown="handleTaskKeydown($event, task)"
      >
        <!-- Priority Stripe (top) -->
        <div class="priority-stripe" :class="`priority-${task.priority || 'none'}`"></div>

        <!-- Timer Active Badge -->
        <div v-if="isTimerActive(task.id)" class="timer-indicator" title="Timer Active">
          <Timer :size="12" />
        </div>

        <!-- Task Content -->
        <div class="task-content">
          <div class="task-title">{{ task.title }}</div>

          <!-- Metadata Badges -->
          <div class="task-metadata">
            <!-- Project Badge -->
            <span v-if="task.projectId" class="metadata-badge project-badge">
              <ProjectEmojiIcon
                v-if="projectVisual(task.projectId).type === 'emoji'"
                :emoji="projectVisual(task.projectId).content"
                size="sm"
              />
              <span
                v-else-if="projectVisual(task.projectId).type === 'css-circle'"
                class="project-circle"
                :style="{ '--project-color': projectVisual(task.projectId).color }"
              >
                {{ projectVisual(task.projectId).content }}
              </span>
              <span v-else>{{ projectVisual(task.projectId).content }}</span>
            </span>

            <!-- Due Date Badge -->
            <span v-if="getDueStatus(task)" class="metadata-badge" :class="`due-badge-${getDueStatus(task).type}`">
              <Calendar :size="12" />
              {{ getDueStatus(task).text }}
            </span>

            <!-- Duration Badge -->
            <span v-if="task.estimatedDuration" class="metadata-badge duration-badge">
              <Clock :size="12" />
              {{ task.estimatedDuration }}m
            </span>

            <!-- Status Indicator -->
            <span class="metadata-badge status-badge" :class="`status-${task.status}`">
              {{ getStatusIndicator(task.status) }}
            </span>
          </div>
        </div>

        <!-- Quick Actions (hover) -->
        <div class="task-actions">
          <button
            class="action-btn"
            @click.stop="handleStartTimer(task)"
            :title="`Start timer for ${task.title}`"
          >
            <Play :size="12" />
          </button>
          <button
            class="action-btn"
            @click.stop="handleEditTask(task)"
            :title="`Edit ${task.title}`"
          >
            <Edit2 :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Add Task Button -->
    <div v-if="!isCollapsed" class="quick-add-task">
      <button
        @click="handleQuickAddTask"
        class="add-task-btn"
        title="Add new task to inbox"
      >
        <Plus :size="14" />
        Add Task
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import {
  ChevronLeft, ChevronRight, Play, Edit2, Plus, Timer, Calendar, Clock,
  Target, Calendar as CalendarIcon, Clipboard, Folder, Trash2, X
} from 'lucide-vue-next'
import BaseBadge from './BaseBadge.vue'
import ProjectEmojiIcon from './ProjectEmojiIcon.vue'

// Props
interface Props {
  context?: 'calendar' | 'canvas' | 'standalone'
  defaultFilter?: 'readyNow' | 'upcoming' | 'backlog' | 'all'
  showBrainDump?: boolean
  startCollapsed?: boolean
  maxCollapsedWidth?: string
  expandedWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: 'standalone',
  defaultFilter: 'readyNow',
  showBrainDump: true,
  startCollapsed: false
})

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()

// State
const isCollapsed = ref(props.startCollapsed)
const newTaskTitle = ref('')
const activeFilter = ref(props.defaultFilter)
const brainDumpMode = ref(false)
const brainDumpText = ref('')
const draggingTaskId = ref<string | null>(null)

// Multi-select state
const selectedTaskIds = ref<Set<string>>(new Set())
const multiSelectMode = computed(() => selectedTaskIds.value.size > 0)

// Base inbox tasks (consistent data source)
const baseInboxTasks = computed(() => {
  // Use taskStore.tasks directly to avoid conflicts with smart view filtering
  return taskStore.tasks.filter(task =>
    task.isInInbox !== false &&
    !task.canvasPosition &&
    task.status !== 'done'
  )
})

// Smart filters with counts
const smartFilters = computed(() => [
  {
    key: 'readyNow',
    label: 'Ready Now',
    icon: '🎯',
    description: 'Tasks that need attention now',
    count: applySmartFilter(baseInboxTasks.value, 'readyNow').length
  },
  {
    key: 'upcoming',
    label: 'Upcoming',
    icon: '📅',
    description: 'Tasks scheduled for near future',
    count: applySmartFilter(baseInboxTasks.value, 'upcoming').length
  },
  {
    key: 'backlog',
    label: 'Backlog',
    icon: '📋',
    description: 'Tasks without specific dates',
    count: applySmartFilter(baseInboxTasks.value, 'backlog').length
  },
  {
    key: 'all',
    label: 'All',
    icon: '🗂️',
    description: 'Complete inbox view',
    count: baseInboxTasks.value.length
  }
])

// Apply smart filter
const inboxTasks = computed(() => {
  if (activeFilter.value === 'all') {
    return baseInboxTasks.value
  }
  return applySmartFilter(baseInboxTasks.value, activeFilter.value)
})

// Smart filter logic
function applySmartFilter(tasks: Task[], filter: string): Task[] {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)

  return tasks.filter(task => {
    // Check if task has date (instances or legacy)
    const hasInstances = task.instances && task.instances.length > 0
    const hasScheduledDate = task.scheduledDate || (hasInstances &&
      task.instances.some(inst => inst.scheduledDate))

    // Get effective date for filtering
    const effectiveDate = task.scheduledDate ||
      (hasInstances && task.instances.find(inst => inst.scheduledDate)?.scheduledDate)

    switch (filter) {
      case 'readyNow':
        return (
          // Due today or overdue
          (task.dueDate && task.dueDate <= today) ||
          // Scheduled today
          (effectiveDate === today) ||
          // In progress
          task.status === 'in_progress' ||
          // High priority due soon
          (task.priority === 'high' && task.dueDate && task.dueDate <= weekEnd.toISOString().split('T')[0])
        )

      case 'upcoming':
        return (
          // Due tomorrow
          task.dueDate === tomorrowStr ||
          // Scheduled tomorrow or this week (but not today)
          (effectiveDate && effectiveDate > today && effectiveDate <= weekEnd.toISOString().split('T')[0])
        )

      case 'backlog':
        // No due date AND no scheduled date
        return !task.dueDate && !effectiveDate

      default:
        return true
    }
  })
}

// Helper functions
const projectVisual = computed(() => (projectId: string) =>
  taskStore.getProjectVisual(projectId)
)

const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}

const getStatusIndicator = (status: string) => {
  const indicators: Record<string, string> = {
    planned: '📝',
    in_progress: '🎬',
    done: '✅',
    backlog: '📚',
    on_hold: '⏸️'
  }
  return indicators[status] || '📝'
}

const getDueStatus = (task: Task) => {
  const today = new Date().toISOString().split('T')[0]

  if (task.dueDate) {
    if (task.dueDate < today) {
      return { type: 'overdue', text: `Overdue ${task.dueDate}` }
    } else if (task.dueDate === today) {
      return { type: 'today', text: 'Today' }
    } else if (task.dueDate === new Date(Date.now() + 86400000).toISOString().split('T')[0]) {
      return { type: 'tomorrow', text: 'Tomorrow' }
    } else {
      const date = new Date(task.dueDate)
      return { type: 'future', text: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }) }
    }
  }

  const effectiveDate = task.scheduledDate ||
    (task.instances?.length && task.instances.find(inst => inst.scheduledDate)?.scheduledDate)

  if (effectiveDate) {
    if (effectiveDate === today) {
      return { type: 'scheduled-today', text: 'Today' }
    } else if (effectiveDate === new Date(Date.now() + 86400000).toISOString().split('T')[0]) {
      return { type: 'scheduled-tomorrow', text: 'Tomorrow' }
    } else {
      const date = new Date(effectiveDate)
      return { type: 'scheduled-future', text: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }) }
    }
  }

  return null
}

const getEmptyMessage = () => {
  switch (activeFilter.value) {
    case 'readyNow':
      return 'No tasks need immediate attention'
    case 'upcoming':
      return 'No tasks scheduled for the near future'
    case 'backlog':
      return 'All tasks have dates assigned'
    case 'all':
      return 'All tasks are scheduled or completed'
    default:
      return 'No tasks found'
  }
}

const parsedTaskCount = computed(() => {
  if (!brainDumpText.value.trim()) return 0
  return brainDumpText.value.split('\n').filter(line => line.trim()).length
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

  brainDumpText.value = ''
  brainDumpMode.value = false
}

// Task interaction handlers
const handleTaskClick = (event: MouseEvent, task: Task) => {
  if (draggingTaskId.value) return

  const isMultiSelect = event.ctrlKey || event.metaKey

  if (isMultiSelect) {
    // Toggle selection for this task
    if (selectedTaskIds.value.has(task.id)) {
      selectedTaskIds.value.delete(task.id)
    } else {
      selectedTaskIds.value.add(task.id)
    }
    // Force reactivity update
    selectedTaskIds.value = new Set(selectedTaskIds.value)
  } else {
    // Single click without modifier - clear selection
    if (selectedTaskIds.value.size > 0) {
      selectedTaskIds.value.clear()
      selectedTaskIds.value = new Set()
    }
  }
}

// Clear selection when clicking outside or pressing Escape
const clearSelection = () => {
  selectedTaskIds.value.clear()
  selectedTaskIds.value = new Set()
}

// Delete selected tasks
const deleteSelectedTasks = () => {
  if (selectedTaskIds.value.size === 0) return

  const idsToDelete = Array.from(selectedTaskIds.value)
  idsToDelete.forEach(id => {
    taskStore.deleteTaskWithUndo(id)
  })
  clearSelection()
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
    event.stopPropagation()
    console.log('🗑️ Delete key pressed on inbox task:', task.id)

    // If this task is selected along with others, delete all selected
    if (selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1) {
      deleteSelectedTasks()
    } else {
      // Single task deletion
      taskStore.deleteTaskWithUndo(task.id)
      selectedTaskIds.value.delete(task.id)
    }
  }
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  event.preventDefault()
  event.stopPropagation()

  // If right-clicking on an unselected task while others are selected, select this one too
  if (selectedTaskIds.value.size > 0 && !selectedTaskIds.value.has(task.id)) {
    // Add this task to selection for batch operation
    selectedTaskIds.value.add(task.id)
    selectedTaskIds.value = new Set(selectedTaskIds.value)
  }

  // Pass selected task IDs for batch operations
  const selectedIds = selectedTaskIds.value.size > 0
    ? Array.from(selectedTaskIds.value)
    : [task.id]

  window.dispatchEvent(new CustomEvent('task-context-menu', {
    detail: {
      event,
      task,
      selectedIds,
      selectedCount: selectedIds.length,
      instanceId: undefined,
      isCalendarEvent: false
    }
  }))
}

const onDragStart = (e: DragEvent, task: Task) => {
  if (!e.dataTransfer) return

  draggingTaskId.value = task.id
  e.dataTransfer.effectAllowed = 'move'

  // If dragging a selected task, include all selected tasks
  // If dragging an unselected task, just drag that one
  const taskIds = selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1
    ? Array.from(selectedTaskIds.value)
    : [task.id]

  const dragData = {
    ...task,
    taskId: task.id,
    taskIds: taskIds,
    selectedCount: taskIds.length,
    fromInbox: true,
    source: `unified-inbox-${props.context}`
  }
  e.dataTransfer.setData('application/json', JSON.stringify(dragData))

  // Set global drag state
  ;(window as any).__draggingTaskId = task.id
  document.documentElement.setAttribute('data-dragging-task-id', task.id)
}

const onDragEnd = () => {
  draggingTaskId.value = null
  delete (window as any).__draggingTaskId
  document.documentElement.removeAttribute('data-dragging-task-id')
}

const handleStartTimer = (task: Task) => {
  timerStore.startTimer(task.id)
}

const handleEditTask = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleQuickAddTask = () => {
  window.dispatchEvent(new CustomEvent('open-quick-task-create', {
    detail: {
      defaultProjectId: '1',
      defaultPriority: 'medium',
      estimatedDuration: 30
    }
  }))
}

// Keyboard handler for selection actions
const handleKeydown = (event: KeyboardEvent) => {
  // Don't handle if typing in an input field
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  // Escape: Clear selection
  if (event.key === 'Escape' && selectedTaskIds.value.size > 0) {
    clearSelection()
    return
  }

  // Delete or Backspace: Delete selected tasks
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTaskIds.value.size > 0) {
    event.preventDefault()
    deleteSelectedTasks()
    return
  }
}

// Lifecycle
onMounted(() => {
  // Add keyboard listener for Escape
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  // Cleanup
  window.removeEventListener('keydown', handleKeydown)
  delete (window as any).__draggingTaskId
  document.documentElement.removeAttribute('data-dragging-task-id')
})
</script>

<style scoped>
.unified-inbox-panel {
  background: var(--glass-bg-light);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  height: 100%;
  width: 320px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.unified-inbox-panel.collapsed {
  width: 60px;
  min-width: 60px;
}

.inbox-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
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

.inbox-count {
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
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

/* Horizontal Compact Tabs */
.smart-filters-horizontal {
  display: flex;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.smart-filters-horizontal::-webkit-scrollbar {
  display: none;
}

.filter-tab {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-1_5);
  min-width: auto;
  max-width: none;
  height: 40px;
  padding: var(--space-1_5) var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
}

.filter-tab:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.filter-tab.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.filter-tab .base-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  font-size: 10px;
  z-index: 1;
  pointer-events: none;
}

.filter-tab .count-active {
  background: var(--text-primary) !important;
  color: var(--surface-primary) !important;
}

.filter-icon {
  font-size: var(--text-base);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-label {
  font-size: var(--text-xs);
  line-height: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.filter-count-active {
  background: var(--state-active-bg) !important;
  color: var(--text-primary) !important;
}

.quick-add {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.quick-add-input {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
}

.quick-add-input:focus {
  outline: none;
  border-color: var(--state-active-border);
  background: var(--glass-bg-soft);
  box-shadow: var(--state-hover-shadow);
}

.quick-add-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.brain-dump-toggle {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
  margin-bottom: var(--space-2);
}

.brain-dump-toggle:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.brain-dump {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.brain-dump-textarea {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-family: inherit;
  resize: vertical;
  min-height: 120px;
}

.brain-dump-textarea:focus {
  outline: none;
  border-color: var(--state-active-border);
  box-shadow: var(--state-hover-shadow);
}

.process-brain-dump-btn {
  width: 100%;
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  color: var(--text-primary);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-semibold);
  transition: all 0.2s ease;
}

.process-brain-dump-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow);
}

.process-brain-dump-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.inbox-tasks {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
}

.empty-inbox {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--text-muted);
}

.empty-icon {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin: 0 0 var(--space-1) 0;
}

.empty-subtext {
  font-size: var(--text-xs);
  margin: 0;
  opacity: 0.7;
}

.task-card {
  position: relative;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  cursor: move;
  transition: all 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.task-card:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.task-card:hover .task-actions {
  opacity: 1;
}

/* Selection state */
.task-card.selected {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  box-shadow: var(--shadow-md), 0 0 0 2px rgba(var(--primary-rgb, 79, 209, 197), 0.3);
}

.task-card.selected:hover {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
}

/* Selection bar */
.selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.selection-count {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  flex: 1;
}

.selection-action {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.selection-action.delete-action {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.selection-action.delete-action:hover {
  background: rgba(239, 68, 68, 0.25);
}

.selection-action.clear-action {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
}

.selection-action.clear-action:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.priority-stripe.priority-high {
  background: var(--color-priority-high);
}

.priority-stripe.priority-medium {
  background: var(--color-priority-medium);
}

.priority-stripe.priority-low {
  background: var(--color-priority-low);
}

.priority-stripe.priority-none {
  background: var(--glass-bg-heavy);
}

.timer-indicator {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 20px;
  height: 20px;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 8px var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 2px 16px var(--brand-primary);
  }
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  margin-bottom: var(--space-2);
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1_5);
  align-items: center;
}

.metadata-badge {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-elevated);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.project-badge {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
}

.project-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--project-color, var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: white;
  font-weight: var(--font-bold);
}

.due-badge-overdue {
  background: var(--color-error-bg);
  color: var(--color-error-text);
  border-color: var(--color-error-border);
}

.due-badge-today,
.due-badge-scheduled-today {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  border-color: var(--color-warning-border);
}

.due-badge-tomorrow,
.due-badge-scheduled-tomorrow {
  background: var(--color-info-bg);
  color: var(--color-info-text);
  border-color: var(--color-info-border);
}

.status-badge {
  opacity: 0.8;
}

.task-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.action-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-secondary);
  transform: scale(1.05);
}

.quick-add-task {
  border-top: 1px solid var(--glass-border);
  padding-top: var(--space-3);
}

.add-task-btn {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.add-task-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Collapsed state adjustments */
.unified-inbox-panel.collapsed .inbox-header {
  justify-content: center;
}

.unified-inbox-panel.collapsed .smart-filters-horizontal,
.unified-inbox-panel.collapsed .quick-add,
.unified-inbox-panel.collapsed .brain-dump-toggle,
.unified-inbox-panel.collapsed .brain-dump,
.unified-inbox-panel.collapsed .inbox-tasks,
.unified-inbox-panel.collapsed .quick-add-task {
  display: none;
}

/* Scrollbar styling */
.inbox-tasks::-webkit-scrollbar {
  width: 6px;
}

.inbox-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.inbox-tasks::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
}

.inbox-tasks::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.inbox-tasks {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}
</style>