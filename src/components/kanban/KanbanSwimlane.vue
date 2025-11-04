<template>
  <div class="kanban-swimlane" :class="{
    collapsed: isCollapsed,
    'dragging': isDragging,
    'scrolling': isScrolling
  }">
    <!-- Swimlane Header (fixed, not scrollable) -->
    <div class="swimlane-header" @click="toggleCollapse" @contextmenu.prevent="handleGroupContextMenu">
      <div class="header-content">
        <button class="collapse-btn">
          <ChevronDown v-if="!isCollapsed" :size="16" />
          <ChevronRight v-if="isCollapsed" :size="16" />
        </button>
        <div class="project-indicator" :style="{ backgroundColor: project.color }"></div>
        <h3 class="project-name">{{ project.name }}</h3>
        <span class="task-count">{{ totalTasks }} tasks</span>

        <!-- View Type Dropdown -->
        <div class="view-type-dropdown" @click.stop>
          <select
            v-model="localViewType"
            @change="handleViewTypeChange"
            class="view-type-select"
          >
            <option value="status">Status</option>
            <option value="date">Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Scrollable Table Container (only visible when not collapsed) -->
    <div v-if="!isCollapsed" ref="scrollContainer" class="table-scroll-container">
      <div class="swimlane-columns">
      <!-- Status View Columns -->
      <template v-if="currentViewType === 'status'">
        <div
          v-for="column in statusColumns"
          :key="column.key"
          class="swimlane-column"
          @dragover="handleColumnDragOver"
          @drop="handleColumnDrop"
          @dragenter="handleColumnDragEnter"
          @dragleave="handleColumnDragLeave"
        >
          <div class="column-header-mini">
            <span class="column-title-mini">{{ column.label }}</span>
            <span class="column-count">{{ getTasksByStatus(column.key).length }}</span>
          </div>
          <draggable
            v-model="localTasks.status[column.key]"
            group="swimlane-tasks"
            item-key="id"
            @change="handleDragChange($event, 'status', column.key)"
            class="drag-area-mini"
            :animation="30"
            :ghost-class="'ghost-card'"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @dragover="handleDragOver"
          >
            <template #item="{ element: task }">
              <TaskCard
                :key="task.id"
                :task="task"
                :density="props.density || 'comfortable'"
                @select="$emit('selectTask', $event)"
                @startTimer="$emit('startTimer', $event)"
                @edit="$emit('editTask', $event)"
                @contextMenu="(event, task) => $emit('contextMenu', event, task)"
                class="task-item-mini"
              />
            </template>
          </draggable>
        </div>
      </template>

      <!-- Date View Columns - Todoist Style -->
      <template v-if="currentViewType === 'date'">
        <div
            v-for="column in dateColumns"
            :key="column.key"
            class="swimlane-column"
            @dragover="handleColumnDragOver"
            @drop="handleColumnDrop"
            @dragenter="handleColumnDragEnter"
            @dragleave="handleColumnDragLeave"
          >
          <div class="column-header-mini">
            <span class="column-title-mini">{{ column.label }}</span>
            <span class="column-count">{{ getTasksByDate(column.key).length }}</span>
          </div>
          <draggable
            v-model="localTasks.date[column.key]"
            group="swimlane-tasks"
            item-key="id"
            @change="handleDragChange($event, 'date', column.key)"
            class="drag-area-mini"
            :animation="30"
            :ghost-class="'ghost-card'"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @dragover="handleDragOver"
          >
            <template #item="{ element: task }">
              <TaskCard
                :key="task.id"
                :task="task"
                :density="props.density || 'comfortable'"
                @select="$emit('selectTask', $event)"
                @startTimer="$emit('startTimer', $event)"
                @edit="$emit('editTask', $event)"
                @contextMenu="(event, task) => $emit('contextMenu', event, task)"
                class="task-item-mini"
              />
            </template>
          </draggable>
        </div>
      </template>

      <!-- Priority View Columns -->
      <template v-if="currentViewType === 'priority'">
        <div
            v-for="column in priorityColumns"
            :key="column.key"
            class="swimlane-column"
            @dragover="handleColumnDragOver"
            @drop="handleColumnDrop"
            @dragenter="handleColumnDragEnter"
            @dragleave="handleColumnDragLeave"
          >
          <div class="column-header-mini">
            <span class="column-title-mini">{{ column.label }}</span>
            <span class="column-count">{{ getTasksByPriority(column.key).length }}</span>
          </div>
          <draggable
            v-model="localTasks.priority[column.key]"
            group="swimlane-tasks"
            item-key="id"
            @change="handleDragChange($event, 'priority', column.key)"
            class="drag-area-mini"
            :animation="30"
            :ghost-class="'ghost-card'"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @dragover="handleDragOver"
          >
            <template #item="{ element: task }">
              <TaskCard
                :key="task.id"
                :task="task"
                :density="props.density || 'comfortable'"
                @select="$emit('selectTask', $event)"
                @startTimer="$emit('startTimer', $event)"
                @edit="$emit('editTask', $event)"
                @contextMenu="(event, task) => $emit('contextMenu', event, task)"
                class="task-item-mini"
              />
            </template>
          </draggable>
        </div>
      </template>
    </div>

    <!-- Empty State for Filter -->
    <div v-if="totalTasks === 0 && currentFilter" class="empty-filter-state">
      <div class="empty-icon">
        <Calendar :size="24" :stroke-width="1.5" />
      </div>
      <p class="empty-message">
        {{ getEmptyStateMessage() }}
      </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import TaskCard from './TaskCard.vue'
import type { Task, Project } from '@/stores/tasks'
import { useTaskStore, parseDateKey, getTaskInstances } from '@/stores/tasks'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-vue-next'
import { shouldLogTaskDiagnostics } from '@/utils/consoleFilter'
import { useHorizontalDragScroll } from '@/composables/useHorizontalDragScroll'

interface Props {
  project: Project
  tasks: Task[]
  currentFilter?: 'today' | 'week' | null
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  showDoneColumn?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  moveTask: [taskId: string, newStatus: Task['status']]
  contextMenu: [event: MouseEvent, task: Task]
  groupContextMenu: [event: MouseEvent, project: Project]
}>()

const taskStore = useTaskStore()
const isCollapsed = ref(false)

// Horizontal drag scroll functionality
const scrollContainer = ref<HTMLElement | null>(null)
const { isDragging, isScrolling } = useHorizontalDragScroll(scrollContainer, {
  sensitivity: 1.2,
  friction: 0.92,
  touchEnabled: true,
  onDragStart: () => {
    console.log('🔄 [HorizontalDragScroll] Drag started on:', props.project.name)
    // Add visual feedback when drag starts
  },
  onDragEnd: () => {
    console.log('🔄 [HorizontalDragScroll] Drag ended on:', props.project.name)
    // Remove visual feedback when drag ends
  }
})

// Debug logging for scroll container
watch(isDragging, (dragging) => {
  console.log(`🔄 [HorizontalDragScroll] ${dragging ? 'STARTED' : 'ENDED'} dragging on swimlane:`, props.project.name)
  if (scrollContainer.value) {
    console.log('🔄 [HorizontalDragScroll] Container scrollWidth:', scrollContainer.value.scrollWidth)
    console.log('🔄 [HorizontalDragScroll] Container clientWidth:', scrollContainer.value.clientWidth)
    console.log('🔄 [HorizontalDragScroll] Can scroll horizontally:', scrollContainer.value.scrollWidth > scrollContainer.value.clientWidth)
  }
})

// Store local view type to respect user selection even with smart filters
const localViewType = ref(props.project.viewType)

// Current view type - prioritize user selection over smart filter forcing
const currentViewType = computed(() => {
  // If user has explicitly selected a view type, respect it
  if (localViewType.value) {
    return localViewType.value
  }

  // Fallback to project's viewType
  return props.project.viewType
})

// Column definitions - reactive to showDoneColumn prop
const statusColumns = computed(() => {
  const columns = [
    { key: 'planned', label: 'Planned' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'backlog', label: 'Backlog' },
    { key: 'on_hold', label: 'On Hold' }
  ]

  if (props.showDoneColumn) {
    columns.push({ key: 'done', label: 'Done' })
  }

  return columns
})

// Todoist-style date columns with overdue
const dateColumns = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'later', label: 'Later' },
  { key: 'noDate', label: 'No Date' }
]

const priorityColumns = [
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
  { key: 'no_priority', label: 'No Priority' }
]

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  next.setHours(0, 0, 0, 0)
  return next
}

const isSameDay = (a: Date, b: Date) => a.getTime() === b.getTime()

const getUpcomingFriday = (base: Date) => {
  const friday = new Date(base)
  const diff = (5 - base.getDay() + 7) % 7
  friday.setDate(base.getDate() + diff)
  friday.setHours(0, 0, 0, 0)
  return friday
}

const getNextMonday = (base: Date) => {
  const monday = new Date(base)
  const diff = (8 - base.getDay()) % 7 || 7
  monday.setDate(base.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Cache for computed task groupings
const taskCache = ref(new Map<string, Task[]>())

// Helper functions to group tasks (with caching for performance)
const getTasksByStatus = (status: string) => {
  return props.tasks.filter(task => task.status === status)
}

const getTasksByDate = (dateColumn: string) => {
  // Create cache key that includes relevant factors
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const cacheKey = `date_${dateColumn}_${props.tasks.length}_${todayStr}_${props.currentFilter}`

  if (taskCache.value.has(cacheKey)) {
    return taskCache.value.get(cacheKey)!
  }

  // Pre-compute date values to avoid repeated calculations
  const tomorrow = addDays(today, 1)
  const weekendStart = getUpcomingFriday(today)
  const weekendEnd = addDays(weekendStart, 2)
  const nextWeekStart = getNextMonday(today)
  const nextWeekEnd = addDays(nextWeekStart, 6)
  const afterNextWeekStart = addDays(nextWeekEnd, 1)

  const result = props.tasks.filter(task => {
    const instances = getTaskInstances(task)

    // Check for overdue tasks first (highest priority)
    if (dateColumn === 'overdue') {
      // Exclude completed tasks from overdue column
      if (task.status === 'done') {
        return false
      }

      // Check if task has a past due date
      if (task.dueDate && task.dueDate < todayStr) {
        return true
      }

      // Check if any instance is overdue
      if (instances.length > 0) {
        return instances.some(instance => {
          const instanceDate = parseDateKey(instance.scheduledDate)
          return instanceDate && instanceDate < today
        })
      }

      // Check if task is old (created more than 1 day ago) and has no date
      const taskCreatedDate = new Date(task.createdAt)
      taskCreatedDate.setHours(0, 0, 0, 0)
      const oneDayAgo = new Date(today)
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      // Include tasks that are at least 1 day old, have no date/instances, and are not in backlog
      if (taskCreatedDate < oneDayAgo && instances.length === 0 &&
          !task.dueDate && task.status !== 'backlog') {
        return true
      }

      return false
    }

    // For tasks without instances, check additional criteria
    if (instances.length === 0) {
      // Check if task was created today (for today column)
      if (dateColumn === 'today') {
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)
        if (taskCreatedDate.getTime() === today.getTime()) {
          return true
        }

        // Check if task is due today
        if (task.dueDate === todayStr) {
          return true
        }

        // Check if task is in progress
        if (task.status === 'in_progress') {
          return true
        }
      }

      // Check if task has no scheduled date for noDate column
      if (dateColumn === 'noDate') {
        // Only include in noDate if it doesn't match today criteria
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)
        const isCreatedToday = taskCreatedDate.getTime() === today.getTime()
        const isDueToday = task.dueDate === todayStr
        const isInProgress = task.status === 'in_progress'

        return !isCreatedToday && !isDueToday && !isInProgress
      }

      return false
    }

    // For tasks with instances, use the original logic with later flag support
    return instances.some(instance => {
      // Check for later flag first
      if (instance.isLater) {
        return dateColumn === 'later'
      }

      const instanceDate = parseDateKey(instance.scheduledDate)
      if (!instanceDate) return false

      // Past dates go to overdue column (but we already handled overdue above)
      if (instanceDate < today) {
        return dateColumn === 'overdue'
      }

      switch (dateColumn) {
        case 'inbox':
          // New tasks without specific scheduling
          // Include tasks that are unscheduled and not completed
          return !task.dueDate && task.status !== 'done' && task.status !== 'in_progress'
        case 'today':
          return isSameDay(instanceDate, today)
        case 'tomorrow':
          return isSameDay(instanceDate, tomorrow) && !(instanceDate >= weekendStart && instanceDate <= weekendEnd)
        case 'thisWeek':
          // Include this weekend and next week
          return (instanceDate >= weekendStart && instanceDate <= weekendEnd) ||
                 (instanceDate >= nextWeekStart && instanceDate <= nextWeekEnd)
        case 'later':
          return instanceDate >= afterNextWeekStart && !instance.isLater
        default:
          return false
      }
    })
  })

  // Include completed tasks in noDate column (Todoist-style)
  // Only show them if the eye toggle is enabled
  if (dateColumn === 'noDate') {
    const completedTasks = props.tasks.filter(task => task.status === 'done')
    const shouldShowCompletedTasks = !taskStore.hideDoneTasks
    if (shouldShowCompletedTasks) {
      result.push(...completedTasks)
    }
  }

  return result
}

const getTasksByPriority = (priority: string) => {

  const result = priority === 'no_priority'
    ? props.tasks.filter(task => !task.priority || task.priority === null)
    : props.tasks.filter(task => task.priority === priority)

  return result
}

const totalTasks = computed(() => {
  const nonDoneCount = props.tasks.filter(t => t.status !== 'done').length
  if (shouldLogTaskDiagnostics()) {
    console.log(`🔢 KanbanSwimlane.totalTasks: Project "${props.project.name}" - Total tasks: ${props.tasks.length}, Non-done tasks: ${nonDoneCount}`)
  }
  return nonDoneCount
})

// Local reactive copies for drag-drop using refs for proper vuedraggable reactivity
const localTasks = ref({
  status: {
    planned: [],
    in_progress: [],
    backlog: [],
    on_hold: [],
    done: []
  },
  date: {
    overdue: [],
    inbox: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDate: []
  },
  priority: {
    high: [],
    medium: [],
    low: [],
    no_priority: []
  }
})

// Function to update localTasks from props
const updateLocalTasks = () => {
  // Update status tasks
  localTasks.value.status.planned = getTasksByStatus('planned')
  localTasks.value.status.in_progress = getTasksByStatus('in_progress')
  localTasks.value.status.backlog = getTasksByStatus('backlog')
  localTasks.value.status.on_hold = getTasksByStatus('on_hold')

  if (props.showDoneColumn) {
    localTasks.value.status.done = getTasksByStatus('done')
  } else {
    localTasks.value.status.done = []
  }

  // Update date tasks
  localTasks.value.date.overdue = getTasksByDate('overdue')
  localTasks.value.date.inbox = getTasksByDate('inbox')
  localTasks.value.date.today = getTasksByDate('today')
  localTasks.value.date.tomorrow = getTasksByDate('tomorrow')
  localTasks.value.date.thisWeek = getTasksByDate('thisWeek')
  localTasks.value.date.later = getTasksByDate('later')
  localTasks.value.date.noDate = getTasksByDate('noDate')

  // Update priority tasks
  localTasks.value.priority.high = getTasksByPriority('high')
  localTasks.value.priority.medium = getTasksByPriority('medium')
  localTasks.value.priority.low = getTasksByPriority('low')
  localTasks.value.priority.no_priority = getTasksByPriority('no_priority')
}

// Initialize localTasks
updateLocalTasks()

// Watch for external task changes
watch(() => props.tasks, () => {
  // Update localTasks to maintain vuedraggable reactivity (no more cache clearing)
  updateLocalTasks()
}, { deep: true })

// Also watch showDoneColumn changes
watch(() => props.showDoneColumn, () => {
  updateLocalTasks()
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleGroupContextMenu = (event: MouseEvent) => {
  console.log('🔍 [KanbanSwimlane] handleGroupContextMenu called')
  console.log('🔍 [KanbanSwimlane] Event:', event)
  console.log('🔍 [KanbanSwimlane] Project:', props.project)

  try {
    emit('groupContextMenu', event, props.project)
    console.log('✅ [KanbanSwimlane] groupContextMenu event emitted successfully')
  } catch (error) {
    console.error('❌ [KanbanSwimlane] Error emitting groupContextMenu:', error)
    console.error('❌ [KanbanSwimlane] Error details:', error.stack)
  }
}

const handleViewTypeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const newViewType = target.value as Project['viewType']

  // Update local view type immediately for reactive UI
  localViewType.value = newViewType

  // Also save to project for persistence
  taskStore.setProjectViewType(props.project.id, newViewType)
}

const handleDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Don't set dropEffect here - let the browser determine it based on the drop target
  }
}

const handleDragEnd = (event: DragEvent) => {
  // Clean up any drag state if needed
}

const handleDragOver = (event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

// Column-level drag handlers to make entire column a drop target
const handleColumnDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleColumnDrop = (event: DragEvent) => {
  event.preventDefault()
  // Let the draggable component handle the actual drop
}

const handleColumnDragEnter = (event: DragEvent) => {
  event.preventDefault()
  // Could add visual feedback here if needed
}

const handleColumnDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // Remove visual feedback if needed
}

const handleDragChange = (event: any, viewType: string, columnKey: string) => {
  if (event.added) {
    const task = event.added.element

    if (viewType === 'status') {
      emit('moveTask', task.id, columnKey as Task['status'])
    } else if (viewType === 'date') {
      taskStore.moveTaskToDate(task.id, columnKey)
    } else if (viewType === 'priority') {
      taskStore.moveTaskToPriority(task.id, columnKey as any)
    }
  }
  // No need to manually refresh - localTasks is computed and reactive
}

// Get empty state message based on current filter
const getEmptyStateMessage = () => {
  if (props.currentFilter === 'today') {
    return 'No tasks scheduled for today'
  } else if (props.currentFilter === 'week') {
    return 'No tasks scheduled for this week'
  }
  return 'No tasks in this project'
}

// Clear cache when tasks change to ensure fresh computation
watch(() => props.tasks, () => {
  taskCache.value.clear()
}, { deep: true })
</script>

<style scoped>
.kanban-swimlane {
  margin-bottom: var(--space-3);
  transition: all var(--duration-normal) var(--spring-smooth);
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.kanban-swimlane:last-child {
  margin-bottom: 0;
}

.swimlane-header {
  padding: var(--space-2) var(--space-8);
  margin-bottom: 0;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(
    90deg,
    var(--glass-bg-tint) 0%,
    var(--surface-hover) 100%
  );
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--spring-smooth);
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.swimlane-header:hover {
  background: linear-gradient(
    90deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
}

.project-indicator {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
}

.project-name {
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin: 0;
}

.task-count {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-inline-start: auto; /* RTL: push to end */
  margin-inline-end: var(--space-3); /* RTL: task count spacing */
}

.view-type-dropdown {
  margin-inline-start: auto; /* RTL: push dropdown to end */
  position: relative;
}

.view-type-select {
  background: var(--surface-tertiary);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  min-width: 80px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-inline-end: 2.5rem; /* RTL: dropdown chevron spacing */
}

.view-type-select:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-glow);
}

.view-type-select:hover {
  background: var(--surface-elevated);
  border-color: var(--glass-border-soft);
}

/* Dark mode dropdown options */
.view-type-select option {
  background: var(--surface-tertiary);
  color: var(--text-primary);
  padding: var(--space-2);
}

.view-type-select option:hover,
.view-type-select option:checked {
  background: var(--brand-primary);
  color: white;
}

.table-scroll-container {
  overflow-x: auto;
  overflow-y: visible;
  margin-bottom: var(--space-3);
  scrollbar-width: thin;
  scrollbar-color: var(--border-medium) transparent;
  width: 100%;
  /* Enhanced containment to prevent overflow propagation */
  touch-action: pan-x;
  position: relative;
  /* Contain paint operations to prevent performance issues */
  contain: layout paint style;
  /* Ensure proper scroll boundary behavior */
  max-width: 100%;
}

/* Drag states for visual feedback */
.kanban-swimlane.dragging .table-scroll-container {
  cursor: grabbing;
  user-select: none;
}

.kanban-swimlane.dragging .swimlane-columns {
  transition: none;
}

.kanban-swimlane.scrolling .table-scroll-container {
  scroll-behavior: auto;
}

.swimlane-columns {
  display: flex;
  gap: var(--kanban-gap);
  padding: var(--space-4) var(--space-8) var(--space-4) var(--space-8);
  min-height: 0;
  min-width: max-content; /* Allow columns to expand to their natural width */
  width: max-content; /* Force expansion to show all columns */
}

/* Webkit scrollbar styling for Chrome/Safari */
.table-scroll-container::-webkit-scrollbar {
  height: var(--kanban-scrollbar-height);
}

.table-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background-color: var(--border-medium);
  border-radius: var(--radius-full);
  border: 2px solid transparent;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: var(--border-strong);
}

.swimlane-column {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-3);
  box-shadow:
    0 20px 40px var(--shadow-xl),
    0 10px 20px var(--shadow-lg),
    inset 0 1px 0 var(--glass-bg-heavy);
  transition: all var(--duration-normal) var(--spring-smooth);
  flex: 0 0 var(--kanban-column-width) !important;
  min-width: var(--kanban-column-width) !important;
  width: var(--kanban-column-width) !important;
}

.swimlane-column:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  border-color: var(--glass-border-soft);
  box-shadow:
    0 24px 48px var(--shadow-strong),
    0 12px 24px var(--shadow-md),
    inset 0 1px 0 var(--glass-border);
}

/* Enhanced hover state during drag operations */
.swimlane-column.drag-over {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--brand-primary) 15%, transparent) 0%,
    color-mix(in srgb, var(--brand-primary) 25%, transparent) 100%
  ) !important;
  border-color: var(--brand-primary) !important;
  box-shadow:
    0 24px 48px color-mix(in srgb, var(--brand-primary) 30%, transparent),
    0 12px 24px color-mix(in srgb, var(--brand-primary) 20%, transparent),
    inset 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent),
    inset 0 1px 0 var(--glass-border) !important;
}

.swimlane-column.drag-over .column-header-mini {
  background: color-mix(in srgb, var(--brand-primary) 10%, transparent) !important;
  border-bottom-color: var(--brand-primary) !important;
}

.column-header-mini {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-2);
  background: linear-gradient(
    90deg,
    var(--glass-bg-tint) 0%,
    var(--surface-hover) 100%
  );
  border-radius: var(--radius-md);
  /* Todoist-inspired sticky headers */
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface-primary);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(16px);
}

.column-title-mini {
  color: var(--text-secondary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.column-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  background: var(--glass-bg-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.drag-area-mini {
  min-height: var(--kanban-drag-area-min-height);
  padding: var(--space-3);
  /* Ensure proper scrolling below sticky headers */
  scroll-margin-top: 60px;
  /* Make entire area a valid drop target */
  background: transparent;
  position: relative;
}

/* Add visual feedback for valid drop zones during drag */
.drag-area-mini.drag-over {
  background: color-mix(in srgb, var(--brand-primary) 5%, transparent);
  border-radius: var(--radius-md);
}

.task-item-mini {
  transition: all 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform, opacity;
}

.ghost-card {
  opacity: 0.4;
  background: var(--blue-bg-medium) !important;
  border: 2px dashed var(--brand-primary) !important;
  transform: rotate(1deg);
}

/* Hierarchical task styles removed - they break the kanban layout */

.kanban-swimlane.collapsed .swimlane-header {
  border-bottom: none;
}

.empty-filter-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
  background: linear-gradient(
    135deg,
    var(--glass-bg-weak) 0%,
    var(--glass-bg-tint) 100%
  );
  border-radius: var(--radius-lg);
  border: 2px dashed var(--glass-border);
  margin-top: var(--space-4);

  .empty-icon {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-message {
    font-size: var(--text-sm);
    margin: 0;
    font-weight: var(--font-medium);
  }
}

/* Compact column widths for different screen sizes */
@media (max-width: 1400px) {
  .swimlane-column {
    flex: 0 0 var(--kanban-column-width-lg) !important;
    min-width: var(--kanban-column-width-lg) !important;
    width: var(--kanban-column-width-lg) !important;
  }
}

@media (max-width: 1200px) {
  .swimlane-column {
    flex: 0 0 var(--kanban-column-width-md) !important;
    min-width: var(--kanban-column-width-md) !important;
    width: var(--kanban-column-width-md) !important;
  }
}

@media (max-width: 1000px) {
  .swimlane-column {
    flex: 0 0 var(--kanban-column-width-sm) !important;
    min-width: var(--kanban-column-width-sm) !important;
    width: var(--kanban-column-width-sm) !important;
  }
}
</style>