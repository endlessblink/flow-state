<template>
  <div class="unified-inbox-panel" :class="{ collapsed: isCollapsed }">
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
        :title="`Filter inbox: Show only today's tasks (${todayCount})`"
        @click="activeTimeFilter = activeTimeFilter === 'today' ? 'all' : 'today'"
      >
        <CalendarDays :size="14" />
        <span>Today</span>
        <span v-if="todayCount > 0" class="count-badge">{{ todayCount }}</span>
      </button>
    </div>

    <!-- Collapsed state task count indicators -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <BaseBadge
        v-if="!unscheduledOnly && !selectedPriority && !selectedProject"
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

    <!-- TASK-106: Canvas Group Filter Chips - Only show in calendar context -->
    <!-- Canvas view already shows groups visually, so filter chips would be redundant -->
    <!-- Ctrl+click to select multiple groups -->
    <div v-if="!isCollapsed && props.context === 'calendar' && canvasGroupOptions.length > 1" class="group-filter-chips">
      <button
        v-for="group in canvasGroupOptions"
        :key="group.value"
        class="group-chip"
        :class="{ active: group.value === '' ? selectedCanvasGroups.size === 0 : selectedCanvasGroups.has(group.value) }"
        :style="getChipStyle(group)"
        :title="group.value === '' ? 'Show all tasks' : `Filter by ${group.label} (Ctrl+click for multi-select)`"
        @click="handleChipClick($event, group)"
      >
        <span v-if="group.color" class="chip-dot" :style="{ backgroundColor: group.color }" />
        <span class="chip-label">{{ group.label }}</span>
      </button>
    </div>

    <!-- TASK-106: Collapsible Advanced Filters -->
    <div v-if="!isCollapsed" class="advanced-filters-section">
      <button
        class="toggle-filters-btn"
        :class="{ active: showAdvancedFilters }"
        @click="showAdvancedFilters = !showAdvancedFilters"
      >
        <Filter :size="14" />
        <span>{{ showAdvancedFilters ? 'Hide filters' : 'More filters' }}</span>
        <ChevronDown :size="14" class="toggle-icon" :class="{ rotated: showAdvancedFilters }" />
      </button>

      <!-- Additional Filters (TASK-018: Unscheduled, Priority, Project) -->
      <!-- TASK-076: Added hide-done-tasks for view-specific done filter -->
      <Transition name="slide-down">
        <InboxFilters
          v-if="showAdvancedFilters"
          v-model:unscheduled-only="unscheduledOnly"
          v-model:selected-priority="selectedPriority"
          v-model:selected-project="selectedProject"
          v-model:selected-duration="selectedDuration"
          :hide-done-tasks="currentHideDoneTasks"
          :tasks="baseInboxTasks"
          :projects="taskStore.rootProjects"
          @update:hide-done-tasks="toggleHideDoneTasks"
          @clear-all="clearAllFilters"
        />
      </Transition>
    </div>

    <div v-if="!isCollapsed" class="quick-add">
      <input
        v-model="newTaskTitle"
        :dir="quickAddDirection"
        placeholder="Quick add task (Enter)..."
        class="quick-add-input"
        @keydown.enter="addTask"
      >
    </div>

    <!-- Brain Dump Mode (optional) -->
    <div v-if="!isCollapsed && showBrainDump" class="brain-dump-section">
      <NButton
        secondary
        block
        size="small"
        class="brain-dump-toggle"
        @click="brainDumpMode = !brainDumpMode"
      >
        {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
      </NButton>

      <!-- Brain Dump Textarea -->
      <div v-if="brainDumpMode" class="brain-dump-container">
        <textarea
          v-model="brainDumpText"
          placeholder="Paste or type tasks (one per line):
Write proposal !!!
Review code 2h
Call client"
          :dir="textDirection"
          class="brain-dump-textarea"
          rows="5"
        />
        <NButton
          type="primary"
          block
          :disabled="parsedTaskCount === 0"
          @click="processBrainDump"
        >
          Add {{ parsedTaskCount }} Tasks
        </NButton>
      </div>
    </div>

    <!-- Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks scroll-container">
      <!-- Empty State -->
      <div v-if="inboxTasks.length === 0" class="empty-inbox">
        <div class="empty-icon">
          {{ selectedCanvasGroups.size > 0 ? '🎯' : '📋' }}
        </div>
        <p class="empty-text">
          {{ selectedCanvasGroups.size > 0 ? (selectedCanvasGroups.size === 1 ? 'No tasks in this group' : 'No tasks in selected groups') : 'No tasks found' }}
        </p>
        <p class="empty-subtext">
          {{ selectedCanvasGroups.size > 0 ? 'Drag tasks to these groups on the Canvas.' : getEmptyMessage() }}
        </p>
      </div>

      <!-- Selection Bar (shown when tasks are selected) -->
      <div v-if="multiSelectMode" class="selection-bar">
        <span class="selection-count">{{ selectedTaskIds.size }} selected</span>
        <button class="selection-action delete-action" title="Delete selected tasks" @click="deleteSelectedTasks">
          <Trash2 :size="14" />
          Delete
        </button>
        <button class="selection-action clear-action" title="Clear selection (Esc)" @click="clearSelection">
          <X :size="14" />
          Clear
        </button>
      </div>

      <!-- Task Cards -->
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        class="task-card"
        :class="[{ selected: selectedTaskIds.has(task.id) }]"
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
        <div class="priority-stripe" :class="`priority-${task.priority || 'none'}`" />

        <!-- Timer Active Badge -->
        <div v-if="isTimerActive(task.id)" class="timer-indicator" title="Timer Active">
          <Timer :size="12" />
        </div>

        <!-- Task Content -->
        <div class="task-content--inbox">
          <div class="task-title" dir="auto">
            {{ task.title }}
          </div>

          <!-- Metadata Badges -->
          <div class="task-metadata">
            <!-- Project Badge -->
            <span v-if="task.projectId" class="metadata-badge project-badge">
              <ProjectEmojiIcon
                v-if="projectVisual(task.projectId).type === 'emoji'"
                :emoji="projectVisual(task.projectId).content"
                size="xs"
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

            <!-- Priority Tag -->
            <NTag
              v-if="task.priority"
              :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
              size="small"
              round
              class="priority-badge"
            >
              {{ task.priority }}
            </NTag>

            <!-- Due Date Badge -->
            <span v-if="getDueStatus(task)" class="metadata-badge due-date-badge" :class="`due-badge-${getDueStatus(task)?.type}`">
              <Calendar :size="12" />
              {{ getDueStatus(task)?.text }}
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
            :title="`Start timer for ${task.title}`"
            @click.stop="handleStartTimer(task)"
          >
            <Play :size="12" />
          </button>
          <button
            class="action-btn"
            :title="`Edit ${task.title}`"
            @click.stop="handleEditTask(task)"
          >
            <Edit2 :size="12" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useCanvasGroupMembership } from '@/composables/canvas/useCanvasGroupMembership'
import { useBrainDump } from '@/composables/useBrainDump'
import {
  ChevronLeft, ChevronRight, Play, Edit2, Plus, Timer, Calendar, Clock, CalendarDays,
  Target as _Target, Calendar as _CalendarIcon, Clipboard as _Clipboard, Folder as _Folder, Trash2, X, Filter, ChevronDown
} from 'lucide-vue-next'
import { NButton, NBadge, NTag } from 'naive-ui'
import BaseBadge from '@/components/base/BaseBadge.vue'
import { useSmartViews } from '@/composables/useSmartViews'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import InboxFilters from '@/components/canvas/InboxFilters.vue'
// CustomSelect removed - replaced with filter chips for better UX (TASK-106)

// Props
interface Props {
  context?: 'calendar' | 'canvas' | 'standalone'
  showBrainDump?: boolean
  startCollapsed?: boolean
  maxCollapsedWidth?: string
  expandedWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: 'standalone',
  showBrainDump: true,
  startCollapsed: false,
  maxCollapsedWidth: '48px',
  expandedWidth: '320px'
})

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const { isTodayTask } = useSmartViews()
const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()
const {
  brainDumpMode,
  brainDumpText,
  textDirection,
  parsedTaskCount,
  processBrainDump
} = useBrainDump()

// RTL detection for quick add
const quickAddDirection = computed(() => {
  if (!newTaskTitle.value.trim()) return 'ltr'
  const firstChar = newTaskTitle.value.trim()[0]
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})
// The canvas Done toggle only affects canvas view, not this inbox panel
// User Request: Calendar inbox needs to filter out done tasks by default
const hideInboxDoneTasks = ref(props.context === 'calendar')

// TASK-076: Current view's hide done setting - uses LOCAL inbox state
const currentHideDoneTasks = computed(() => hideInboxDoneTasks.value)

// TASK-076: Toggle function for the inbox's own done filter
const toggleHideDoneTasks = () => {
  hideInboxDoneTasks.value = !hideInboxDoneTasks.value
}

// State
const isCollapsed = ref(props.startCollapsed)
const newTaskTitle = ref('')
// brainDumpMode, brainDumpText now provided by useBrainDump() composable
const draggingTaskId = ref<string | null>(null)

// Multi-select state
const selectedTaskIds = ref<Set<string>>(new Set())
const lastSelectedTaskId = ref<string | null>(null) // Anchor for shift+click range selection
const multiSelectMode = computed(() => selectedTaskIds.value.size > 0)

// Additional filter state (TASK-018: Unscheduled, Priority, Project)
const unscheduledOnly = ref(false)
const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
const selectedProject = ref<string | null>(null)
const selectedDuration = ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)

// TASK-106: Canvas group filter (primary filter for reducing cognitive overload)
// Changed to Set for multi-select support (Ctrl+click)
const selectedCanvasGroups = ref<Set<string>>(new Set())
const showAdvancedFilters = ref(false)

// TASK-106: Options for canvas group filter chips
interface GroupOption {
  label: string
  value: string
  color?: string
}

const canvasGroupOptions = computed((): GroupOption[] => {
  const options: GroupOption[] = [
    { label: 'All', value: '', color: undefined }
  ]

  // Add canvas groups with task counts and colors
  groupsWithCounts.value.forEach(group => {
    options.push({
      label: `${group.name} ${group.taskCount}`,
      value: group.id,
      color: group.color || '#4ecdc4'
    })
  })

  return options
})

// TASK-106: Get chip style based on active state and group color
const getChipStyle = (group: GroupOption) => {
  const isActive = group.value === ''
    ? selectedCanvasGroups.value.size === 0  // "All" is active when no groups selected
    : selectedCanvasGroups.value.has(group.value)
  if (!isActive || !group.color) return {}

  return {
    '--chip-color': group.color,
    backgroundColor: `${group.color}20`,
    borderColor: group.color,
    color: group.color
  }
}

// TASK-106: Handle chip click with Ctrl+click for multi-select
const handleChipClick = (event: MouseEvent, group: GroupOption) => {
  // "All" chip - clears selection
  if (group.value === '') {
    selectedCanvasGroups.value = new Set()
    return
  }

  // Ctrl/Cmd+click: toggle individual group (multi-select)
  if (event.ctrlKey || event.metaKey) {
    const newSet = new Set(selectedCanvasGroups.value)
    if (newSet.has(group.value)) {
      newSet.delete(group.value)
    } else {
      newSet.add(group.value)
    }
    selectedCanvasGroups.value = newSet
    return
  }

  // Regular click: single select (toggle)
  if (selectedCanvasGroups.value.size === 1 && selectedCanvasGroups.value.has(group.value)) {
    // Clicking active chip deselects it (back to "All")
    selectedCanvasGroups.value = new Set()
  } else {
    // Select only this group
    selectedCanvasGroups.value = new Set([group.value])
  }
}

// Base inbox tasks (Source from filteredTasks to satisfy global filter requirements)
const baseInboxTasks = computed(() => {
  // Use taskStore.filteredTasks to respect global sidebar filters (Uncategorized, Project, Smart Views)
  return taskStore.filteredTasks.filter(task => {
    // TASK-076: Respect view-specific hide done filter
    if (currentHideDoneTasks.value && task.status === 'done') {
      return false
    }

    if (task._soft_deleted) {
       console.warn('⚠️ [INBOX-DEBUG] Soft deleted task found in filteredTasks (should be filtered out upstream):', task.title, task.id)
       return false
    }

    // Keep context-specific filtering (Canvas/Calendar)
    if (props.context === 'calendar') {
      // CALENDAR INBOX: Show tasks NOT on the calendar grid
      const hasInstances = task.instances && task.instances.length > 0
      const hasLegacySchedule = (task.scheduledDate && task.scheduledDate.trim() !== '') &&
                               (task.scheduledTime && task.scheduledTime.trim() !== '')
      return !hasInstances && !hasLegacySchedule
    } else {
      // CANVAS INBOX: Show tasks NOT on the canvas
      // Dec 16, 2025 FIX: ONLY check canvasPosition
      return !task.canvasPosition
    }
  })
})

// Check if task is scheduled on calendar (has instances with dates) - TASK-018
const isScheduledOnCalendar = (task: Task): boolean => {
  if (!task.instances || task.instances.length === 0) return false
  return task.instances.some(inst => inst.scheduledDate)
}

// Clear all additional filters - TASK-018
const clearAllFilters = () => {
  unscheduledOnly.value = false
  selectedPriority.value = null
  selectedProject.value = null
  selectedDuration.value = null
  activeTimeFilter.value = 'all'
  selectedCanvasGroups.value = new Set()  // TASK-106: Clear multi-select
}

// Time filter state (TASK-080: Today Quick Filter)
const activeTimeFilter = ref<'all' | 'today'>('all')

// Helper: Get today's date string
const getToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

// Number of tasks in the current base list that match "Today" criteria
const todayCount = computed(() => {
  // Use the same centralized logic as the sidebar for consistency
  // BUG-056: If baseInboxTasks are already filtered by !hasInstances,
  // we should ensure this doesn't conflict with isTodayTask's checks.
  return baseInboxTasks.value.filter(task => isTodayTask(task)).length
})

// Apply additional filters (TASK-018: Unscheduled, Priority, Project)
// NOTE: "Show Everything" is now the default since we removed restrictive tabs
const inboxTasks = computed(() => {
  let tasks = baseInboxTasks.value

  // TASK-106: Apply canvas group filter FIRST (primary filter)
  // Supports multi-select: filter tasks that belong to ANY selected group
  if (selectedCanvasGroups.value.size > 0) {
    const groupIds = Array.from(selectedCanvasGroups.value)
    tasks = tasks.filter(task =>
      groupIds.some(groupId => filterTasksByGroup([task], groupId).length > 0)
    )
  }

  // Apply Today filter (TASK-080)
  if (activeTimeFilter.value === 'today') {
    tasks = tasks.filter(task => isTodayTask(task))
  }

  // Apply Unscheduled filter - show only tasks NOT on calendar
  if (unscheduledOnly.value) {
    tasks = tasks.filter(task => !isScheduledOnCalendar(task))
  }

  // Apply Priority filter
  if (selectedPriority.value !== null) {
    tasks = tasks.filter(task => task.priority === selectedPriority.value)
  }

  // Apply Project filter
  if (selectedProject.value !== null) {
    if (selectedProject.value === 'none') {
      // Show tasks with no project
      tasks = tasks.filter(task => !task.projectId)
    } else {
      // Show tasks with specific project
      tasks = tasks.filter(task => task.projectId === selectedProject.value)
    }
  }

  // Apply Duration filter
  if (selectedDuration.value !== null) {
    tasks = tasks.filter(task => {
      const d = task.estimatedDuration
      if (selectedDuration.value === 'unestimated') return !d
      if (!d) return false

      switch (selectedDuration.value) {
        case 'quick': return d <= 15
        case 'short': return d > 15 && d <= 30
        case 'medium': return d > 30 && d <= 60
        case 'long': return d > 60
        default: return false
      }
    })
  }

  return tasks
})

// Helper functions
const projectVisual = computed(() => (projectId: string) =>
  taskStore.getProjectVisual(projectId)
)

const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}

interface WindowWithDrag extends Window {
  __draggingTaskId?: string
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
  if (taskStore.filteredTasks.length === 0) {
    return 'No tasks match your current view filters'
  }
  return 'All filtered tasks are already on the board/calendar'
}

// Brain dump logic provided by useBrainDump() composable

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

// processBrainDump now provided by useBrainDump() composable

// Task interaction handlers
const handleTaskClick = (event: MouseEvent, task: Task) => {
  if (draggingTaskId.value) return

  // Handle Shift+Click (Range Selection)
  if (event.shiftKey) {
    if (!lastSelectedTaskId.value) {
      // No anchor set - treat as first selection
      selectedTaskIds.value = new Set([task.id])
      lastSelectedTaskId.value = task.id
      return
    }

    // Has anchor - perform range selection
    const tasks = inboxTasks.value
    const lastIndex = tasks.findIndex(t => t.id === lastSelectedTaskId.value)
    const currentIndex = tasks.findIndex(t => t.id === task.id)

    if (lastIndex === -1) {
      // Anchor task no longer in list - reset to clicked task
      selectedTaskIds.value = new Set([task.id])
      lastSelectedTaskId.value = task.id
      return
    }

    if (currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      const rangeTasks = tasks.slice(start, end + 1)

      // Merge with existing selection
      const newSet = new Set(selectedTaskIds.value)
      rangeTasks.forEach(t => newSet.add(t.id))
      selectedTaskIds.value = newSet
    }
    return
  }

  // Handle Ctrl/Cmd+Click (Toggle Selection)
  if (event.ctrlKey || event.metaKey) {
    const newSet = new Set(selectedTaskIds.value)
    if (newSet.has(task.id)) {
      newSet.delete(task.id)
      // If we deselect the anchor, clear it
      if (task.id === lastSelectedTaskId.value) {
        lastSelectedTaskId.value = null
      }
    } else {
      newSet.add(task.id)
      lastSelectedTaskId.value = task.id // Update anchor
    }
    selectedTaskIds.value = newSet
    return
  }

  // Single click without modifier - select only this task
  selectedTaskIds.value = new Set([task.id])
  lastSelectedTaskId.value = task.id
}

// Clear selection when clicking outside or pressing Escape
const clearSelection = () => {
  selectedTaskIds.value.clear()
  selectedTaskIds.value = new Set()
  lastSelectedTaskId.value = null
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
  ;(window as WindowWithDrag).__draggingTaskId = task.id
  document.documentElement.setAttribute('data-dragging-task-id', task.id)
}

const onDragEnd = () => {
  draggingTaskId.value = null
  delete (window as WindowWithDrag).__draggingTaskId
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
  delete (window as WindowWithDrag).__draggingTaskId
  document.documentElement.removeAttribute('data-dragging-task-id')
})
</script>

<style scoped>
.unified-inbox-panel {
  width: 320px;
  height: 100%; /* Fill parent height (constrained by CanvasView) */
  max-height: 100%; /* Don't exceed parent bounds */
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: hidden; /* Fixed: was 'visible' which broke child scrolling */
  transition: width var(--duration-normal) var(--spring-smooth), padding var(--duration-normal);
  position: relative;
  z-index: 100;
  background: var(--inbox-panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
}

.unified-inbox-panel.collapsed {
  width: 60px;
  padding: var(--space-4) var(--space-2);
}

.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  color: var(--text-primary);
}

.inbox-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
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
  flex-shrink: 0;
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
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  min-width: 16px;
  text-align: center;
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
  padding: 0;
}

.quick-add-input {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  unicode-bidi: plaintext;
  text-align: start;
}

/* Naive UI components handle their own basic layout,
   but we can add spacing as needed */
.brain-dump-section {
  padding: 0 var(--space-1);
}

.brain-dump-toggle {
  margin-bottom: var(--space-2);
}

.brain-dump-toggle:hover {
  background: var(--state-hover-bg);
  color: var(--text-secondary);
}

.brain-dump-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.brain-dump-textarea {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-family: inherit;
  resize: vertical;
  margin-bottom: var(--space-2);
  unicode-bidi: plaintext;
  text-align: start;
}

.brain-dump-textarea:focus {
  outline: none;
  border-color: var(--state-active-border);
  box-shadow: var(--state-hover-shadow);
}

/* Uses .scroll-container utility for flex:1, overflow-y:auto, min-height:0 */
.inbox-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-bottom: var(--space-4); /* BUG-049: Extra padding so last task isn't cut off */
}

.empty-inbox {
  text-align: center;
  padding: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.empty-icon {
  font-size: 24px;
  margin-bottom: var(--space-2);
  opacity: 0.5;
}

.task-card {
  position: relative;
  padding: var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: grab;
  transition: all var(--duration-fast) ease;
}

.task-card:hover {
  background: var(--state-hover-bg);
  transform: translateY(-1px);
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
  width: 3px;
  height: 100%;
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
}

.priority-high { background: var(--color-priority-high); }
.priority-medium { background: var(--color-priority-medium); }
.priority-low { background: var(--color-priority-low); }

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

.task-content--inbox {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.metadata-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.project-badge {
  background: var(--glass-bg-medium);
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

.priority-badge {
  font-weight: var(--font-bold);
  text-transform: uppercase;
}

.due-badge-overdue {
  color: var(--status-error);
}

.due-badge-today {
  color: var(--status-warning);
}

.status-badge {
  opacity: 0.8;
}

.task-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.action-btn {
  background: var(--glass-bg-heavy);
  border: none;
  color: var(--text-secondary);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.action-btn:hover {
  color: var(--brand-primary);
}

.quick-add-task {
  margin-top: var(--space-2);
}

/* Collapsed state adjustments */
.unified-inbox-panel.collapsed .inbox-header {
  justify-content: center;
}

.unified-inbox-panel.collapsed .smart-filters-horizontal,
.unified-inbox-panel.collapsed .quick-add,
.unified-inbox-panel.collapsed .brain-dump-section,
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

/* TASK-106: Canvas Group Filter Chips */
.group-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
  padding: var(--space-1) 0;
}

.group-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  white-space: nowrap;
}

.group-chip:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
  transform: translateY(-1px);
}

.group-chip.active {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  box-shadow: 0 0 8px rgba(78, 205, 196, 0.2);
}

.group-chip .chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-chip .chip-label {
  line-height: 1;
}

/* TASK-106: Advanced Filters Toggle */
.advanced-filters-section {
  margin-bottom: var(--space-2);
}

.toggle-filters-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.toggle-filters-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--border-medium);
  color: var(--text-secondary);
}

.toggle-filters-btn.active {
  background: var(--glass-bg-light);
  border-style: solid;
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.toggle-filters-btn .toggle-icon {
  margin-left: auto;
  transition: transform var(--duration-fast);
}

.toggle-filters-btn .toggle-icon.rotated {
  transform: rotate(180deg);
}

/* Slide down transition for filters */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--duration-normal) ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 300px;
  margin-top: var(--space-2);
}
</style>