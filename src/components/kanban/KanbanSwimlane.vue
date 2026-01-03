<template>
  <div
    class="kanban-swimlane"
    :class="{
      collapsed: isCollapsed,
      'dragging': isDragging,
      'scrolling': isScrolling
    }"
  >
    <!-- Swimlane Header (fixed, not scrollable) -->
    <div class="swimlane-header" @click="toggleCollapse" @contextmenu.prevent="handleGroupContextMenu">
      <div class="header-content">
        <button class="collapse-btn">
          <ChevronDown v-if="!isCollapsed" :size="16" />
          <ChevronRight v-if="isCollapsed" :size="16" />
        </button>
        <div class="project-indicator" />
        <h3 class="project-name">
          {{ project.name }}
        </h3>
        <span class="task-count">{{ totalTasks }} tasks</span>

        <!-- View Type Dropdown -->
        <div class="view-type-dropdown" @click.stop>
          <CustomSelect
            :model-value="localViewType"
            :options="viewTypeOptions"
            placeholder="View by..."
            @update:model-value="(val) => { localViewType = String(val) as Project['viewType']; handleViewTypeChange({ target: { value: val } } as any) }"
          />
        </div>
      </div>
    </div>

    <!-- Scrollable Table Container (only visible when not collapsed) -->
    <div v-if="!isCollapsed" ref="scrollContainer" class="table-scroll-container">
      <div class="swimlane-body">
        <!-- Status View Columns -->
        <template v-if="currentViewType === 'status'">
          <KanbanColumn
            v-for="column in statusColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as Task['status']"
            :tasks="localTasks.status[column.key]"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <!-- Date View Columns - Todoist Style -->
        <template v-if="currentViewType === 'date'">
          <KanbanColumn
            v-for="column in dateColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as any"
            :tasks="localTasks.date[column.key]"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <!-- Priority View Columns -->
        <template v-if="currentViewType === 'priority'">
          <KanbanColumn
            v-for="column in priorityColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as any"
            :tasks="localTasks.priority[column.key]"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
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
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import KanbanColumn from './KanbanColumn.vue' 
import TaskCard from './TaskCard.vue'
import type { Task, Project, RecurringTaskInstance } from '@/stores/tasks'
import { useTaskStore, parseDateKey, getTaskInstances } from '@/stores/tasks'
import { ChevronDown, ChevronRight, Calendar, Plus } from 'lucide-vue-next'
import CustomSelect from '@/components/common/CustomSelect.vue'

// View type options for swimlane organization
const viewTypeOptions = [
  { label: 'Status', value: 'status' },
  { label: 'Date', value: 'date' },
  { label: 'Priority', value: 'priority' }
]
import { shouldLogTaskDiagnostics } from '@/utils/consoleFilter'
import { useHorizontalDragScroll } from '@/composables/useHorizontalDragScroll'
import { shouldUseSmartGroupLogic, getSmartGroupType } from '@/composables/useTaskSmartGroups'

interface Props {
  project: Project
  tasks: Task[]
  currentFilter?: 'today' | 'week' | null
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  showDoneColumn?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentFilter: null,
  density: 'comfortable',
  showDoneColumn: false
})
const emit = defineEmits<{
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  moveTask: [taskId: string, newStatus: Task['status']]
  addTask: [statusOrDateKey: string]
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
const localViewType = ref(props.project.viewType || 'status')

// Current view type - prioritize user selection over smart filter forcing
const currentViewType = computed(() => {
  // If user has explicitly selected a view type, respect it
  if (localViewType.value) {
    return localViewType.value
  }

  // Fallback to project's viewType or 'status'
  return props.project.viewType || 'status'
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
// Generate a deterministic fingerprint for a set of tasks to detect content changes (not just count)
const getTasksFingerprint = (tasks: Task[]) => {
  if (!tasks || tasks.length === 0) return 'empty'
  // Use a smaller sample or hash if performance becomes an issue with 1000+ tasks
  return tasks.map(t => `${t.id}:${t.updatedAt?.getTime() ?? ''}`).join('|')
}

const getTasksByStatus = (status: string) => {
  return props.tasks.filter(task => task.status === status)
}

const getTasksByDate = (dateColumn: string) => {
  // Create cache key that includes relevant factors including content fingerprint
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const fingerprint = getTasksFingerprint(props.tasks)
  const cacheKey = `date_${dateColumn}_${fingerprint}_${todayStr}_${props.currentFilter}`

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

    // Pre-compute task classification for consistency across columns
    const taskCreatedDate = new Date(task.createdAt)
    taskCreatedDate.setHours(0, 0, 0, 0)
    const oneDayAgo = new Date(today)
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    const isCreatedToday = taskCreatedDate.getTime() === today.getTime()
    const isDueToday = task.dueDate === todayStr
    const isInProgress = task.status === 'in_progress'
    const isOverdueByDate = task.dueDate && task.dueDate < todayStr
    const hasPastInstance = instances.length > 0 && instances.some((instance: RecurringTaskInstance) => {
      const instanceDate = parseDateKey(instance.scheduledDate)
      return instanceDate && instanceDate < today
    })
    const isOldAndUnscheduled = taskCreatedDate < oneDayAgo && instances.length === 0 &&
                               !task.dueDate && task.status !== 'backlog'

    // Check for overdue tasks first (highest priority)
    if (dateColumn === 'overdue') {
      // Exclude completed tasks from overdue column
      if (task.status === 'done') {
        return false
      }

      // Task is overdue if it has a past due date OR a past instance OR is old and unscheduled
      return isOverdueByDate || hasPastInstance || isOldAndUnscheduled
    }

    // For tasks without instances, check additional criteria
    if (instances.length === 0) {
      // Check if task matches today criteria (but is not already classified as overdue)
      if (dateColumn === 'today') {
        // Task belongs in Today if created today OR due today OR in progress
        // But NOT if it's already overdue (handled above)
        return (isCreatedToday || isDueToday || isInProgress) && !isOverdueByDate
      }

      // Check if task has no scheduled date for noDate column
      if (dateColumn === 'noDate') {
        // Only include in noDate if it doesn't match today criteria AND isn't overdue
        return !isCreatedToday && !isDueToday && !isInProgress && !isOverdueByDate
      }

      return false
    }

    // For tasks with instances, use the original logic with later flag support
    return instances.some((instance: RecurringTaskInstance) => {
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

// Type definitions for indexed access
interface StatusTasks {
  planned: Task[]
  in_progress: Task[]
  backlog: Task[]
  on_hold: Task[]
  done: Task[]
  [key: string]: Task[] // Index signature for dynamic access
}

interface DateTasks {
  overdue: Task[]
  inbox: Task[]
  today: Task[]
  tomorrow: Task[]
  thisWeek: Task[]
  later: Task[]
  noDate: Task[]
  [key: string]: Task[] // Index signature for dynamic access
}

interface PriorityTasks {
  high: Task[]
  medium: Task[]
  low: Task[]
  no_priority: Task[]
  [key: string]: Task[] // Index signature for dynamic access
}

// Local reactive copies for drag-drop using refs for proper vuedraggable reactivity
const localTasks = ref({
  status: {
    planned: [] as Task[],
    in_progress: [] as Task[],
    backlog: [] as Task[],
    on_hold: [] as Task[],
    done: [] as Task[]
  } as StatusTasks,
  date: {
    overdue: [] as Task[],
    inbox: [] as Task[],
    today: [] as Task[],
    tomorrow: [] as Task[],
    thisWeek: [] as Task[],
    later: [] as Task[],
    noDate: [] as Task[]
  } as DateTasks,
  priority: {
    high: [] as Task[],
    medium: [] as Task[],
    low: [] as Task[],
    no_priority: [] as Task[]
  } as PriorityTasks
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
watch(() => props.tasks, (newTasks) => {
  if (shouldLogTaskDiagnostics()) {
    console.log(`🔄 [KanbanSwimlane] Tasks changed for project "${props.project.name}":`, newTasks.length)
  }
  // Clear the cache to ensure getTasksByDate recomputes with new task data
  taskCache.value.clear()
  // Update localTasks to maintain vuedraggable reactivity
  updateLocalTasks()
}, { deep: true })

// Also watch showDoneColumn changes
watch(() => props.showDoneColumn, () => {
  updateLocalTasks()
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleAddTask = (statusOrDateKey: string) => {
  emit('addTask', statusOrDateKey)
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
    console.error('❌ [KanbanSwimlane] Error details:', error instanceof Error ? error.stack : String(error))
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

const handleMoveTask = (taskId: string, targetKey: string) => {
  // Logic adapted from handleDragChange to support different view types
  if (currentViewType.value === 'status') {
    emit('moveTask', taskId, targetKey as Task['status'])
  } else if (currentViewType.value === 'date') {
    // Check if this is a smart group (today, tomorrow, etc.)
    if (shouldUseSmartGroupLogic(targetKey)) {
      const smartGroupType = getSmartGroupType(targetKey)
      if (smartGroupType) {
        // Use smart group logic - set dueDate but keep in inbox
        taskStore.moveTaskToSmartGroup(taskId, smartGroupType)
      } else {
        // Fallback to original behavior
        taskStore.moveTaskToDate(taskId, targetKey)
      }
    } else {
      // Regular calendar date - use original scheduling logic
      taskStore.moveTaskToDate(taskId, targetKey)
    }
  } else if (currentViewType.value === 'priority') {
    // Cast to specific priority type which matches the store's expectation
    taskStore.moveTaskToPriority(taskId, targetKey as Task['priority'] | 'no_priority')
  }
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
  background: var(--kanban-swimlane-bg);
}

.kanban-swimlane:last-child {
  margin-bottom: 0;
}

.swimlane-header {
  padding: var(--space-2) var(--space-8);
  margin-bottom: var(--space-4); /* Increased space to prevent collision */
  cursor: pointer;
  user-select: none;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
  position: relative;
  width: 100%;
  box-sizing: border-box;
  border-bottom: 1px solid var(--border-subtle);
}

.swimlane-header:hover {
  background: var(--kanban-header-bg);
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
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-bg-medium);
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
  background: var(--glass-bg-medium);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  border: 1px solid var(--glass-border);
  color: rgba(255, 255, 255, 0.9);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  min-width: 80px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='rgba(255,255,255,0.7)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-inline-end: 2.5rem; /* RTL: dropdown chevron spacing */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.view-type-select:focus {
  outline: none;
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  box-shadow: 0 0 0 2px var(--glass-bg-medium);
}

.view-type-select:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
}

/* Dark mode dropdown options */
.view-type-select option {
  background: var(--gray-900); /* Solid dark background for options */
  color: var(--text-primary);
  padding: var(--space-2);
}

.view-type-select option:hover,
.view-type-select option:checked {
  background: var(--glass-bg-light);
  color: #fff;
}

.table-scroll-container {
  overflow-x: auto;
  overflow-y: visible;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
  touch-action: pan-y; /* Allow native vertical scroll, JS handles horizontal */
}

.table-scroll-container::-webkit-scrollbar {
  height: 6px;
}

.table-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 10px;
}

.swimlane-body {
  display: flex;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  padding-right: var(--space-1);
  align-items: flex-start; /* Prevent columns from stretching to match tallest */
  width: max-content; /* Ensure body expands to fit all columns */
  min-width: 100%;
}

/* ... existing scrollbar styles ... */

.swimlane-column {
  /* Using exact widths to prevent collapsing */
  flex: 0 0 320px !important;
  min-width: 320px !important;
  width: 320px !important;
  height: auto !important; /* Force auto height to override component 100% */
  transition: opacity 0.3s ease;
}

/* Collapsed State */
.kanban-swimlane.collapsed .swimlane-header {
  margin-bottom: 0;
  border-color: transparent;
  background: transparent;
}

.kanban-swimlane.collapsed .swimlane-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Empty State */
.empty-filter-state {
  flex: 1;
  text-align: center;
  padding: 48px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

/* Responsive */
@media (max-width: 1400px) {
  .swimlane-column {
    flex: 0 0 300px !important;
    min-width: 300px !important;
    width: 300px !important;
  }
}

@media (max-width: 768px) {
  .swimlane-column {
    flex: 0 0 280px !important;
    min-width: 280px !important;
    width: 280px !important;
  }
  
  .swimlane-header {
    margin-left: -50px; /* Offset for mobile if needed */
  }
}
</style>
```