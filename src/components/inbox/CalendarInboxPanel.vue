<template>
  <div class="calendar-inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button
        class="collapse-btn"
        :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'"
        @click="isCollapsed = !isCollapsed"
      >
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">
        Inbox
      </h3>

      <!-- Expanded state count -->
      <NBadge v-if="!isCollapsed" :value="inboxTasks.length" type="info" />

      <!-- Quick Today Filter (BUG-046) -->
      <button
        v-if="!isCollapsed"
        class="today-quick-filter"
        :class="{ active: showTodayOnly }"
        :title="`Show tasks due today (${todayCount})`"
        @click="showTodayOnly = !showTodayOnly"
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
        v-if="!hasActiveFilters"
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

    <!-- Additional Filters (TASK-018: Unscheduled, Priority, Project) -->
    <!-- TASK-076: Added hide-done-tasks for calendar-specific done filter -->
    <InboxFilters
      v-if="!isCollapsed"
      v-model:unscheduled-only="unscheduledOnly"
      v-model:selected-priority="selectedPriority"
      v-model:selected-project="selectedProject"
      v-model:selected-duration="selectedDuration"
      :hide-done-tasks="hideCalendarDoneTasks"
      :tasks="baseInboxTasks"
      :projects="taskStore.rootProjects"
      @update:hide-done-tasks="toggleHideDoneTasks"
      @clear-all="clearAllFilters"
    />

    <!-- Quick Add -->
    <div v-if="!isCollapsed" class="quick-add">
      <input
        v-model="newTaskTitle"
        placeholder="Quick add task (Enter)..."
        class="quick-add-input"
        @keydown.enter="addTask"
      >
    </div>

    <!-- Brain Dump Mode (optional) -->
    <div v-if="!isCollapsed" class="brain-dump-section">
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
          class="brain-dump-textarea"
          rows="5"
          placeholder="Paste or type tasks (one per line)..."
        />
        <NButton
          type="primary"
          block
          :disabled="!brainDumpText.trim()"
          @click="processBrainDump"
        >
          Add {{ brainDumpText.split('\n').filter(l => l.trim()).length }} Tasks
        </NButton>
      </div>
    </div>

    <!-- Inbox Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks">
      <!-- Empty State -->
      <div v-if="inboxTasks.length === 0" class="empty-inbox">
        <div class="empty-icon">
          📋
        </div>
        <p class="empty-text">
          No tasks in inbox
        </p>
      </div>

      <!-- Task Cards -->
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        class="task-card"
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
        <div class="priority-stripe" :class="`priority-${task.priority}`" />

        <!-- Timer Active Badge -->
        <div v-if="isTimerActive(task.id)" class="timer-indicator" title="Timer Active">
          <Timer :size="12" />
        </div>

        <!-- Task Content -->
        <div class="task-content">
          <div class="task-title">
            {{ task.title }}
          </div>

          <!-- Metadata Badges -->
          <div class="task-metadata">
            <!-- Project Badge -->
            <span v-if="task.projectId" class="metadata-badge project-badge">
              <ProjectEmojiIcon
                :emoji="projectVisual(task.projectId).content"
                size="xs"
              />
            </span>

            <!-- Priority Tag -->
            <NTag
              :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
              size="small"
              round
              class="priority-badge"
            >
              {{ task.priority }}
            </NTag>

            <!-- Due Date Badge -->
            <span
              v-if="task.dueDate"
              class="metadata-badge due-date-badge"
              :class="getDueBadgeClass(task.dueDate)"
            >
              <Calendar :size="12" />
              {{ formatDueDateLabel(task.dueDate) }}
            </span>

            <!-- Duration Badge -->
            <span v-if="task.estimatedDuration" class="metadata-badge duration-badge">
              <Clock :size="12" />
              {{ task.estimatedDuration }}m
            </span>

            <!-- Status Indicator -->
            <span class="metadata-badge status-badge" :class="`status-${task.status}`">
              {{ statusEmoji(task.status) }}
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
import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import {
  ChevronLeft, ChevronRight, Play, Edit2, Plus, Timer, Calendar, Clock, CalendarDays
} from 'lucide-vue-next'
import { NButton, NBadge, NTag } from 'naive-ui'
import BaseBadge from '@/components/base/BaseBadge.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import InboxFilters from '@/components/canvas/InboxFilters.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const { updateTaskWithUndo, createTaskWithUndo, deleteTaskWithUndo } = useUnifiedUndoRedo()

// TASK-076: Get calendar-specific hide done filter from store
const hideCalendarDoneTasks = computed(() => taskStore.hideCalendarDoneTasks)

// TASK-076: Toggle function for calendar view
const toggleHideDoneTasks = () => {
  taskStore.toggleCalendarDoneTasks()
}

// State
const isCollapsed = ref(false)
const newTaskTitle = ref('')
const draggingTaskId = ref<string | null>(null)
const brainDumpMode = ref(false)
const brainDumpText = ref('')

// Filter state
const unscheduledOnly = ref(false)
const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
const selectedProject = ref<string | null>(null)
const selectedDuration = ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)
const showTodayOnly = ref(false)

// Get today's date string for filtering
const getTodayStr = () => new Date().toISOString().split('T')[0]

// Computed
const hasActiveFilters = computed(() => {
  return showTodayOnly.value || unscheduledOnly.value || selectedPriority.value !== null || selectedProject.value !== null || selectedDuration.value !== null
})

// Count tasks due today (BUG-046)
const todayCount = computed(() => {
  const todayStr = getTodayStr()
  return baseInboxTasks.value.filter(task => task.dueDate === todayStr).length
})

// Check if task is scheduled on calendar (has instances with dates)
const isScheduledOnCalendar = (task: Task): boolean => {
  if (!task.instances || task.instances.length === 0) return false
  return task.instances.some(inst => inst.scheduledDate)
}

const baseInboxTasks = computed(() => {
  // Calendar inbox base: Show tasks NOT yet scheduled on the calendar grid
  // BUG-FIX: Use filteredTasks instead of tasks to respect _soft_deleted filter
  return taskStore.filteredTasks.filter(task => {
    // TASK-076: Use store filter instead of hardcoding done task removal
    if (hideCalendarDoneTasks.value && task.status === 'done') return false
    return !isScheduledOnCalendar(task)
  })
})

const inboxTasks = computed(() => {
  let tasks = baseInboxTasks.value

  // Apply Today filter (BUG-046)
  if (showTodayOnly.value) {
    const todayStr = getTodayStr()
    tasks = tasks.filter(task => task.dueDate === todayStr)
  }

  // Apply filters
  if (unscheduledOnly.value) {
    tasks = tasks.filter(task => !isScheduledOnCalendar(task))
  }

  if (selectedPriority.value !== null) {
    tasks = tasks.filter(task => task.priority === selectedPriority.value)
  }

  if (selectedProject.value !== null) {
    if (selectedProject.value === 'none') {
      tasks = tasks.filter(task => !task.projectId)
    } else {
      tasks = tasks.filter(task => task.projectId === selectedProject.value)
    }
  }

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

const projectVisual = computed(() => (projectId: string) =>
  taskStore.getProjectVisual(projectId)
)

const isTimerActive = computed(() => (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
})

const statusEmoji = (status: string) => {
  const emojis: Record<string, string> = {
    planned: '📝',
    in_progress: '🎬',
    done: '✅',
    backlog: '📦',
    on_hold: '⏸️'
  }
  return emojis[status] || '❓'
}

const getDueBadgeClass = (dueDate: string) => {
  const today = new Date().toISOString().split('T')[0]
  if (dueDate < today) return 'due-badge-overdue'
  if (dueDate === today) return 'due-badge-today'
  return 'due-badge-future'
}

const formatDueDateLabel = (dueDate: string) => {
  const today = new Date().toISOString().split('T')[0]
  if (dueDate < today) return 'Overdue ' + dueDate
  if (dueDate === today) return 'Today'
  return dueDate
}

// Methods
const clearAllFilters = () => {
  unscheduledOnly.value = false
  selectedPriority.value = null
  selectedProject.value = null
  selectedDuration.value = null
}

const addTask = () => {
  if (!newTaskTitle.value.trim()) return

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
  
  lines.forEach(line => {
    createTaskWithUndo({
      title: line.trim(),
      status: 'planned',
      isInInbox: true
    })
  })

  brainDumpText.value = ''
  brainDumpMode.value = false
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

// ISSUE-010 FIX: Handle Delete/Backspace key to delete task from calendar inbox
const handleTaskKeydown = (event: KeyboardEvent, task: Task) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    event.stopPropagation()
    console.log('🗑️ Delete key pressed on calendar inbox task:', task.id)
    deleteTaskWithUndo(task.id)
  }
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

const handleStartTimer = (task: Task) => {
  timerStore.startTimer(task.id)
}

const handleEditTask = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleQuickAddTask = () => {
  window.dispatchEvent(new CustomEvent('open-quick-task-create'))
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

.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

/* Today Quick Filter (BUG-046) */
.today-quick-filter {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-light);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  white-space: nowrap;
}

.today-quick-filter:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.today-quick-filter.active {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--brand-primary);
}

.today-quick-filter .count-badge {
  background: var(--brand-primary);
  color: white;
  font-size: 10px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
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

/* Naive UI components handle their own basic layout, 
   but we can add spacing as needed */
.brain-dump-section {
  padding: 0 var(--space-1);
}

.collapsed-badges-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-2);
}

.dual-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
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
  resize: vertical;
  margin-bottom: var(--space-2);
}

.inbox-tasks {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
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

.priority-badge {
  font-weight: var(--font-bold);
  text-transform: uppercase;
}

.due-badge-overdue { color: var(--status-error); }
.due-badge-today { color: var(--status-warning); }

.status-badge { opacity: 0.8; }

.task-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.task-card:hover .task-actions {
  opacity: 1;
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

/* Custom scrollbar for inbox tasks */
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
</style>
