<template>
  <div class="kanban-swimlane" :class="{ collapsed: isCollapsed }">
    <!-- Swimlane Header -->
    <div class="swimlane-header" @click="toggleCollapse">
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
            :value="currentViewType" 
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

    <!-- Swimlane Columns (only visible when not collapsed) -->
    <div v-if="!isCollapsed" class="swimlane-columns">
      <!-- Status View Columns -->
      <template v-if="currentViewType === 'status'">
        <div v-for="column in statusColumns" :key="column.key" class="swimlane-column">
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
            :animation="60"
            :ghost-class="'ghost-card'"
          >
            <template #item="{ element: task }">
              <TaskCard
                :key="task.id"
                :task="task"
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

      <!-- Date View Columns -->
      <template v-if="currentViewType === 'date'">
        <div v-for="column in dateColumns" :key="column.key" class="swimlane-column">
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
            :animation="60"
            :ghost-class="'ghost-card'"
          >
            <template #item="{ element: task }">
              <TaskCard
                :key="task.id"
                :task="task"
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
        <div v-for="column in priorityColumns" :key="column.key" class="swimlane-column">
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
            :animation="60"
            :ghost-class="'ghost-card'"
          >
            <template #item="{ element: task }">
              <TaskCard
                :key="task.id"
                :task="task"
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
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import TaskCard from './TaskCard.vue'
import type { Task, Project } from '@/stores/tasks'
import { useTaskStore, parseDateKey } from '@/stores/tasks'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-vue-next'

interface Props {
  project: Project
  tasks: Task[]
  currentFilter?: 'today' | 'week' | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  moveTask: [taskId: string, newStatus: Task['status']]
  contextMenu: [event: MouseEvent, task: Task]
}>()

const taskStore = useTaskStore()
const isCollapsed = ref(false)

// Current view type - use project's viewType, or override with date view for smart views
const currentViewType = computed(() => {
  if (props.currentFilter) {
    return 'date' // Force date view when smart filter is active
  }
  return props.project.viewType
})

// Column definitions
const statusColumns = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'on_hold', label: 'On Hold' }
]

const dateColumns = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeekend', label: 'This Weekend' },
  { key: 'nextWeek', label: 'Next Week' },
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

// Helper functions to group tasks
const getTasksByStatus = (status: string) => {
  return props.tasks.filter(task => task.status === status)
}

const getTasksByDate = (dateColumn: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = addDays(today, 1)
  const weekendStart = getUpcomingFriday(today)
  const weekendEnd = addDays(weekendStart, 2)
  const nextWeekStart = getNextMonday(today)
  const nextWeekEnd = addDays(nextWeekStart, 6)
  const afterNextWeekStart = addDays(nextWeekEnd, 1)
  
  return props.tasks.filter(task => {
    const instances = taskStore.getTaskInstances(task)
    
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
      
      if (instanceDate < today) {
        return dateColumn === 'today'
      }
      
      switch (dateColumn) {
        case 'today':
          return isSameDay(instanceDate, today)
        case 'tomorrow':
          return isSameDay(instanceDate, tomorrow) && !(instanceDate >= weekendStart && instanceDate <= weekendEnd)
        case 'thisWeekend':
          return instanceDate >= weekendStart && instanceDate <= weekendEnd
        case 'nextWeek':
          return instanceDate >= nextWeekStart && instanceDate <= nextWeekEnd
        case 'later':
          return instanceDate >= afterNextWeekStart && !instance.isLater
        default:
          return false
      }
    })
  })
}

const getTasksByPriority = (priority: string) => {
  if (priority === 'no_priority') {
    return props.tasks.filter(task => !task.priority || task.priority === null)
  }
  return props.tasks.filter(task => task.priority === priority)
}

const totalTasks = computed(() => props.tasks.length)

// Local reactive copies for drag-drop
const localTasks = ref({
  status: {
    planned: getTasksByStatus('planned'),
    in_progress: getTasksByStatus('in_progress'),
    done: getTasksByStatus('done'),
    backlog: getTasksByStatus('backlog'),
    on_hold: getTasksByStatus('on_hold')
  },
  date: {
    today: getTasksByDate('today'),
    tomorrow: getTasksByDate('tomorrow'),
    thisWeekend: getTasksByDate('thisWeekend'),
    nextWeek: getTasksByDate('nextWeek'),
    later: getTasksByDate('later'),
    noDate: getTasksByDate('noDate')
  },
  priority: {
    high: getTasksByPriority('high'),
    medium: getTasksByPriority('medium'),
    low: getTasksByPriority('low'),
    no_priority: getTasksByPriority('no_priority')
  }
})

// Watch for external task changes
watch(() => props.tasks, () => {
  localTasks.value = {
    status: {
      planned: getTasksByStatus('planned'),
      in_progress: getTasksByStatus('in_progress'),
      done: getTasksByStatus('done'),
      backlog: getTasksByStatus('backlog'),
      on_hold: getTasksByStatus('on_hold')
    },
    date: {
      today: getTasksByDate('today'),
      tomorrow: getTasksByDate('tomorrow'),
      thisWeekend: getTasksByDate('thisWeekend'),
      nextWeek: getTasksByDate('nextWeek'),
      later: getTasksByDate('later'),
      noDate: getTasksByDate('noDate')
    },
    priority: {
      high: getTasksByPriority('high'),
      medium: getTasksByPriority('medium'),
      low: getTasksByPriority('low'),
      no_priority: getTasksByPriority('no_priority')
    }
  }
}, { deep: true })

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleViewTypeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  taskStore.setProjectViewType(props.project.id, target.value as Project['viewType'])
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
</script>

<style scoped>
.kanban-swimlane {
  margin-bottom: var(--space-4);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.swimlane-header {
  padding: var(--space-3) var(--space-2);
  margin-bottom: var(--space-4);
  cursor: pointer;
  user-select: none;
  background: linear-gradient(
    90deg,
    var(--glass-bg-tint) 0%,
    var(--surface-hover) 100%
  );
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--spring-smooth);
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
  margin-left: auto;
  margin-right: var(--space-3);
}

.view-type-dropdown {
  margin-left: auto;
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
  padding-right: 2.5rem;
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

.swimlane-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
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
  padding: var(--space-5);
  box-shadow:
    0 20px 40px var(--shadow-xl),
    0 10px 20px var(--shadow-lg),
    inset 0 1px 0 var(--glass-bg-heavy);
  transition: all var(--duration-normal) var(--spring-smooth);
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

.column-header-mini {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-2);
  background: linear-gradient(
    90deg,
    var(--glass-bg-tint) 0%,
    var(--surface-hover) 100%
  );
  border-radius: var(--radius-md);
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
  min-height: 200px;
  padding: var(--space-2);
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

/* Adjust grid for different view types */
.swimlane-columns:has(.swimlane-column:nth-child(5)) {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.swimlane-columns:has(.swimlane-column:nth-child(7)) {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
</style>
