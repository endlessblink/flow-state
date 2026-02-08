<template>
  <div class="mobile-today">
    <div class="today-header">
      <div class="date-display">
        <h2>{{ dayOfWeek }}</h2>
        <span class="full-date">{{ formattedDate }}</span>
      </div>
      <div class="task-count">
        {{ filteredTodayTasks.length }} tasks
      </div>
    </div>

    <!-- TASK-1104: Filter Controls -->
    <div class="filter-section">
      <!-- Project Filter -->
      <div class="filter-row">
        <div class="filter-dropdown-wrapper">
          <button class="filter-btn" @click="toggleProjectDropdown">
            <FolderOpen :size="14" />
            <span>{{ selectedProjectLabel }}</span>
            <ChevronDown :size="12" :class="{ rotated: showProjectDropdown }" />
          </button>
          <div v-if="showProjectDropdown" class="dropdown-menu">
            <button
              class="dropdown-item"
              :class="{ active: selectedProject === null }"
              @click="selectProject(null)"
            >
              All Projects
            </button>
            <button
              v-for="project in taskStore.projects"
              :key="project.id"
              class="dropdown-item"
              :class="{ active: selectedProject === project.id }"
              @click="selectProject(project.id)"
            >
              <span v-if="project.emoji" class="project-emoji">{{ project.emoji }}</span>
              {{ project.name }}
            </button>
          </div>
        </div>

        <!-- Priority Filter -->
        <div class="filter-dropdown-wrapper">
          <button class="filter-btn" @click="togglePriorityDropdown">
            <Flag :size="14" />
            <span>{{ selectedPriorityLabel }}</span>
            <ChevronDown :size="12" :class="{ rotated: showPriorityDropdown }" />
          </button>
          <div v-if="showPriorityDropdown" class="dropdown-menu">
            <button
              class="dropdown-item"
              :class="{ active: selectedPriority === null }"
              @click="selectPriority(null)"
            >
              All Priorities
            </button>
            <button
              v-for="p in priorityOptions"
              :key="p.value"
              class="dropdown-item"
              :class="{ active: selectedPriority === p.value }"
              @click="selectPriority(p.value)"
            >
              <span class="priority-dot" :class="p.value" />
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- Group By Toggle -->
        <div class="filter-dropdown-wrapper">
          <button class="filter-btn" @click="toggleGroupByDropdown">
            <Layers :size="14" />
            <span>{{ groupByLabel }}</span>
            <ChevronDown :size="12" :class="{ rotated: showGroupByDropdown }" />
          </button>
          <div v-if="showGroupByDropdown" class="dropdown-menu">
            <button
              v-for="option in groupByOptions"
              :key="option.value"
              class="dropdown-item"
              :class="{ active: groupBy === option.value }"
              @click="selectGroupBy(option.value)"
            >
              <component :is="option.icon" :size="14" />
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Clear Filters -->
      <button v-if="hasActiveFilters" class="clear-btn" @click="clearFilters">
        <X :size="14" />
        Clear
      </button>
    </div>

    <!-- Swipe hint (shows once) -->
    <div v-if="showSwipeHint" class="swipe-hint">
      <span class="hint-text">← Delete</span>
      <span class="hint-divider">|</span>
      <span class="hint-text">Edit →</span>
      <button class="hint-dismiss" @click="dismissSwipeHint">
        Got it
      </button>
    </div>

    <!-- Grouped Task Sections -->
    <div class="time-sections">
      <!-- Dynamic grouped display -->
      <template v-for="group in groupedTasks" :key="group.key">
        <div class="time-section" :class="{ overdue: group.key === 'overdue' }">
          <div class="section-header">
            <component :is="group.icon" :size="16" />
            <span>{{ group.title }}</span>
            <span class="count">{{ group.tasks.length }}</span>
          </div>
          <div class="task-list">
            <SwipeableTaskItem
              v-for="task in group.tasks"
              :key="task.id"
              :task-id="task.id"
              @edit="handleEditTask(task)"
              @delete="handleDeleteTask(task)"
            >
              <div class="task-item" @click="handleTaskClick(task)">
                <div class="task-checkbox" @click.stop="toggleTask(task)">
                  <div class="checkbox-circle" :class="[{ checked: task.status === 'done' }]">
                    <Check v-if="task.status === 'done'" :size="14" />
                  </div>
                </div>
                <div class="task-content">
                  <span class="task-title" dir="auto" :class="[{ done: task.status === 'done' }]">{{ task.title }}</span>
                  <div class="task-meta">
                    <span v-if="getDueBadge(task) && groupBy !== 'time'" class="task-due" :class="{ overdue: isOverdue(task.dueDate) }">
                      {{ getDueBadge(task) }}
                    </span>
                    <span v-if="task.priority && groupBy !== 'priority'" class="priority-badge" :class="task.priority">
                      {{ priorityLabel(task.priority) }}
                    </span>
                    <span v-if="getProjectName(task.projectId) && groupBy !== 'project'" class="project-badge">
                      {{ getProjectName(task.projectId) }}
                    </span>
                  </div>
                </div>
                <button class="timer-btn" @click.stop="startTimer(task)">
                  <Play :size="16" />
                </button>
              </div>
            </SwipeableTaskItem>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-if="filteredTodayTasks.length === 0" class="empty-state">
        <CheckCircle :size="48" />
        <h3 v-if="hasActiveFilters">No matching tasks</h3>
        <h3 v-else>All clear for today!</h3>
        <p v-if="hasActiveFilters">Try adjusting your filters.</p>
        <p v-else>No tasks scheduled. Add one from Inbox.</p>
      </div>
    </div>

    <!-- Task Edit Bottom Sheet -->
    <TaskEditBottomSheet
      :is-open="isEditSheetOpen"
      :task="editingTask"
      @close="closeEditSheet"
      @save="handleSaveTask"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
// @ts-ignore - Avoid strict type check on imported Task type if causing issues
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useMobileFilters, type GroupByType } from '@/composables/mobile/useMobileFilters'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import SwipeableTaskItem from '@/mobile/components/SwipeableTaskItem.vue'
import {
  Check, Play, AlertCircle, Sunrise, Sun, Moon, Calendar, CheckCircle,
  FolderOpen, Flag, ChevronDown, Layers, X, Clock
} from 'lucide-vue-next'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Shared mobile filter state (persists across view navigation)
const {
  selectedProject,
  selectedPriority,
  groupBy,
  hasActiveFilters,
  priorityLabel,
  clearFilters,
  setProjectFilter,
  setPriorityFilter,
  setGroupBy
} = useMobileFilters()

// Edit sheet state
const isEditSheetOpen = ref(false)
const editingTask = ref<Task | null>(null)

// View-specific dropdown state
const showProjectDropdown = ref(false)
const showPriorityDropdown = ref(false)
const showGroupByDropdown = ref(false)

// Priority options (for dropdown display)
const priorityOptions = [
  { value: 'critical', label: 'Critical (P0)' },
  { value: 'high', label: 'High (P1)' },
  { value: 'medium', label: 'Medium (P2)' },
  { value: 'low', label: 'Low (P3)' }
]

// Group by options (Today view uses 'time' instead of 'none')
const groupByOptions = [
  { value: 'time' as const, label: 'By Time', icon: Clock },
  { value: 'project' as const, label: 'By Project', icon: FolderOpen },
  { value: 'priority' as const, label: 'By Priority', icon: Flag }
]

// Computed labels
const selectedProjectLabel = computed(() => {
  if (!selectedProject.value) return 'All Projects'
  const project = taskStore.projects.find(p => p.id === selectedProject.value)
  return project?.name || 'Project'
})

const selectedPriorityLabel = computed(() => {
  if (!selectedPriority.value) return 'All Priorities'
  const p = priorityOptions.find(o => o.value === selectedPriority.value)
  return p?.label.split(' ')[0] || 'Priority'
})

const groupByLabel = computed(() => {
  const option = groupByOptions.find(o => o.value === groupBy.value)
  return option?.label || 'Group'
})

// hasActiveFilters is now provided by useMobileFilters composable

// Filter actions
const toggleProjectDropdown = () => {
  showProjectDropdown.value = !showProjectDropdown.value
  showPriorityDropdown.value = false
  showGroupByDropdown.value = false
}

const togglePriorityDropdown = () => {
  showPriorityDropdown.value = !showPriorityDropdown.value
  showProjectDropdown.value = false
  showGroupByDropdown.value = false
}

const toggleGroupByDropdown = () => {
  showGroupByDropdown.value = !showGroupByDropdown.value
  showProjectDropdown.value = false
  showPriorityDropdown.value = false
}

const selectProject = (projectId: string | null) => {
  setProjectFilter(projectId)
  showProjectDropdown.value = false
}

const selectPriority = (priority: string | null) => {
  setPriorityFilter(priority)
  showPriorityDropdown.value = false
}

const selectGroupBy = (value: GroupByType) => {
  setGroupBy(value)
  showGroupByDropdown.value = false
}

// clearFilters is now provided by useMobileFilters composable

// Close dropdowns when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.filter-dropdown-wrapper')) {
    showProjectDropdown.value = false
    showPriorityDropdown.value = false
    showGroupByDropdown.value = false
  }
}


// Swipe hint - show once for first-time users
const SWIPE_HINT_KEY = 'flowstate-today-swipe-hint-dismissed'
const showSwipeHint = ref(false)

onMounted(() => {
  const dismissed = localStorage.getItem(SWIPE_HINT_KEY)
  if (!dismissed) {
    showSwipeHint.value = true
  }
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

const dismissSwipeHint = () => {
  showSwipeHint.value = false
  localStorage.setItem(SWIPE_HINT_KEY, 'true')
}

// Date formatting
const now = new Date()
const dayOfWeek = computed(() => {
  return now.toLocaleDateString('en-US', { weekday: 'long' })
})
const formattedDate = computed(() => {
  return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
})

// Get today's date boundaries
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

// Filter tasks for today (exclude completed tasks - TASK-1004)
const todayTasks = computed(() => {
  return taskStore.tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false
    const dueDate = new Date(t.dueDate)
    return dueDate >= todayStart && dueDate <= todayEnd
  })
})

// Overdue tasks (before today)
const overdueTasks = computed(() => {
  return taskStore.tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false
    const dueDate = new Date(t.dueDate)
    return dueDate < todayStart
  })
})

// TASK-1104: Apply filters to today + overdue tasks
const filteredTodayTasks = computed(() => {
  let tasks = [...todayTasks.value, ...overdueTasks.value]

  // Apply project filter
  if (selectedProject.value) {
    tasks = tasks.filter(t => t.projectId === selectedProject.value)
  }

  // Apply priority filter
  if (selectedPriority.value) {
    tasks = tasks.filter(t => t.priority === selectedPriority.value)
  }

  return tasks
})

// Time-based categorization — only use explicit dueTime, never extract time from dueDate
// BUG-1286: dueDate is date-only; parsing it as Date gives UTC midnight → 2am in UTC+2
const getTaskHour = (task: Task): number | null => {
  if (!task.dueTime) return null
  const [hours] = task.dueTime.split(':').map(Number)
  return isNaN(hours) ? null : hours
}

const isOverdue = (dueDate: string | Date | undefined): boolean => {
  if (!dueDate) return false
  return new Date(dueDate) < todayStart
}

// Helper to get project name
const getProjectName = (projectId: string | undefined | null): string | null => {
  if (!projectId) return null
  const project = taskStore.projects.find(p => p.id === projectId)
  return project?.name || null
}

// priorityLabel is now provided by useMobileFilters composable

// TASK-1104: Grouped tasks based on groupBy mode
interface TaskGroup {
  key: string
  title: string
  icon: typeof AlertCircle
  tasks: Task[]
}

const groupedTasks = computed((): TaskGroup[] => {
  const tasks = filteredTodayTasks.value
  const groups: TaskGroup[] = []

  // Today view treats 'none' and 'date' the same as 'time' (time-based grouping is the default)
  if (groupBy.value === 'time' || groupBy.value === 'none' || groupBy.value === 'date') {
    // Time-based grouping (original behavior)
    const overdueFiltered = tasks.filter(t => isOverdue(t.dueDate))
    const morningFiltered = tasks.filter(t => {
      if (isOverdue(t.dueDate)) return false
      const hour = getTaskHour(t)
      return hour !== null && hour >= 6 && hour < 12
    })
    const afternoonFiltered = tasks.filter(t => {
      if (isOverdue(t.dueDate)) return false
      const hour = getTaskHour(t)
      return hour !== null && hour >= 12 && hour < 18
    })
    const eveningFiltered = tasks.filter(t => {
      if (isOverdue(t.dueDate)) return false
      const hour = getTaskHour(t)
      return hour !== null && (hour >= 18 || hour < 6)
    })
    // BUG-1286: Tasks without explicit dueTime are "untimed" → "Anytime Today"
    const untimedFiltered = tasks.filter(t => {
      if (isOverdue(t.dueDate)) return false
      return getTaskHour(t) === null
    })

    if (overdueFiltered.length > 0) groups.push({ key: 'overdue', title: 'Overdue', icon: AlertCircle, tasks: overdueFiltered })
    if (morningFiltered.length > 0) groups.push({ key: 'morning', title: 'Morning', icon: Sunrise, tasks: morningFiltered })
    if (afternoonFiltered.length > 0) groups.push({ key: 'afternoon', title: 'Afternoon', icon: Sun, tasks: afternoonFiltered })
    if (eveningFiltered.length > 0) groups.push({ key: 'evening', title: 'Evening', icon: Moon, tasks: eveningFiltered })
    if (untimedFiltered.length > 0) groups.push({ key: 'anytime', title: 'Anytime Today', icon: Calendar, tasks: untimedFiltered })
  } else if (groupBy.value === 'project') {
    // Group by project
    const projectMap = new Map<string, Task[]>()

    tasks.forEach(task => {
      const key = task.projectId || 'no-project'
      if (!projectMap.has(key)) projectMap.set(key, [])
      projectMap.get(key)!.push(task)
    })

    // Sort: projects first, then no-project
    const sortedKeys = Array.from(projectMap.keys()).sort((a, b) => {
      if (a === 'no-project') return 1
      if (b === 'no-project') return -1
      const aName = getProjectName(a) || ''
      const bName = getProjectName(b) || ''
      return aName.localeCompare(bName)
    })

    sortedKeys.forEach(key => {
      const projectTasks = projectMap.get(key)!
      const title = key === 'no-project' ? 'No Project' : (getProjectName(key) || 'Unknown')
      groups.push({ key, title, icon: FolderOpen, tasks: projectTasks })
    })
  } else if (groupBy.value === 'priority') {
    // Group by priority
    const priorityOrder = ['critical', 'high', 'medium', 'low', 'none']
    const priorityLabels: Record<string, string> = {
      critical: 'Critical (P0)',
      high: 'High (P1)',
      medium: 'Medium (P2)',
      low: 'Low (P3)',
      none: 'No Priority'
    }
    const priorityMap = new Map<string, Task[]>()

    tasks.forEach(task => {
      const key = task.priority || 'none'
      if (!priorityMap.has(key)) priorityMap.set(key, [])
      priorityMap.get(key)!.push(task)
    })

    priorityOrder.forEach(key => {
      if (priorityMap.has(key) && priorityMap.get(key)!.length > 0) {
        groups.push({ key, title: priorityLabels[key], icon: Flag, tasks: priorityMap.get(key)! })
      }
    })
  }

  return groups
})

// BUG-1286: Show meaningful badge — overdue date, explicit time, or nothing
const getDueBadge = (task: Task): string => {
  if (!task.dueDate) return ''
  // Show relative date if overdue
  if (isOverdue(task.dueDate)) {
    // Parse as local date to avoid UTC shift
    const [y, m, d] = task.dueDate.split('T')[0].split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  // Show explicit time if user set one
  if (task.dueTime) {
    const [hours, minutes] = task.dueTime.split(':').map(Number)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return ''
}

const toggleTask = async (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (_task: Task) => {
  // Normal tap - currently no action
  // Swipe gestures handle edit/delete
}

const startTimer = async (task: Task) => {
  // BUG-1051: AWAIT for timer sync
  await timerStore.startTimer(task.id)
}

// Open edit bottom sheet for task (triggered by swipe right)
const handleEditTask = (task: Task) => {
  editingTask.value = task
  isEditSheetOpen.value = true
}

// Delete task (triggered by swipe left + confirm)
const handleDeleteTask = (task: Task) => {
  taskStore.deleteTask(task.id)
}

// Close edit bottom sheet
const closeEditSheet = () => {
  isEditSheetOpen.value = false
  // Delay clearing the task to allow close animation
  setTimeout(() => {
    editingTask.value = null
  }, 300)
}

// Save task changes from edit sheet
const handleSaveTask = async (taskId: string, updates: Partial<Task>) => {
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(taskId, updates)
}
</script>

<style scoped>
.mobile-today {
  padding: var(--space-4);
  padding-bottom: 100px;
  min-height: 100vh;
  background: var(--app-background-gradient);
}

/* Swipe hint banner */
.swipe-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-2_5) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--surface-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
}

.hint-text {
  font-size: var(--text-meta);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.hint-divider {
  color: var(--border-subtle);
}

.hint-dismiss {
  margin-left: var(--space-2);
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--primary-brand);
  background: var(--primary-brand-bg-subtle);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.hint-dismiss:active {
  transform: scale(0.95);
}

.today-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

/* TASK-1104: Filter Section */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.filter-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.filter-dropdown-wrapper {
  position: relative;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  cursor: pointer;
  transition: all var(--duration-normal);
  white-space: nowrap;
}

.filter-btn:active {
  transform: scale(0.98);
}

.filter-btn .rotated {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--space-1);
  min-width: 160px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.dropdown-item:hover {
  background: var(--surface-secondary);
}

.dropdown-item.active {
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
}

.project-emoji {
  font-size: var(--text-base);
}

.priority-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
}

.priority-dot.critical { background: var(--color-priority-high); }
.priority-dot.high { background: var(--color-priority-medium); }
.priority-dot.medium { background: var(--color-warning); }
.priority-dot.low { background: var(--color-success); }

.clear-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--danger-border-subtle);
  background: var(--danger-bg-subtle);
  color: var(--danger-text);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  align-self: flex-start;
}

.clear-btn:active {
  transform: scale(0.98);
}

/* Task meta row */
.task-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-0_5);
}

.priority-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
}

.priority-badge.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge.high { background: var(--orange-bg-subtle); color: var(--color-priority-medium); }
.priority-badge.medium { background: var(--primary-brand-bg-subtle); color: var(--primary-brand); }
.priority-badge.low { background: var(--surface-tertiary); color: var(--text-muted); }

.project-badge {
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
  background: var(--surface-tertiary);
  color: var(--text-tertiary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-display h2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin: 0;
  color: var(--text-primary);
}

.full-date {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.task-count {
  background: var(--surface-secondary);
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-xl);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.time-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.time-section {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.time-section.overdue {
  border-left: 3px solid var(--danger-text);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.section-header .count {
  margin-left: auto;
  background: var(--surface-secondary);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-secondary);
  cursor: pointer;
  /* Prevent text selection */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.task-item:active {
  background: var(--surface-tertiary);
}

.task-checkbox {
  padding: var(--space-1);
}

.checkbox-circle {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-subtle);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal);
}

.checkbox-circle.checked {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: var(--text-primary);
}

.task-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  min-width: 0;
}

.task-title {
  font-size: var(--text-base);
  color: var(--text-primary);
  /* Multi-line truncation for RTL/long text */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  line-height: 1.4;
  word-break: break-word;
  /* RTL support */
  text-align: start;
  unicode-bidi: plaintext;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-due {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.task-due.overdue {
  color: var(--danger-text);
}

.timer-btn {
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  border: none;
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.timer-btn:active {
  transform: scale(0.95);
}

.empty-state {
  text-align: center;
  padding: var(--space-16) var(--space-5);
  color: var(--text-tertiary);
}

.empty-state h3 {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--text-xl);
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: var(--text-sm);
}

/* RTL Layout Support */
[dir="rtl"] .today-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .filter-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .task-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .task-content {
  text-align: right;
}

[dir="rtl"] .task-meta {
  flex-direction: row-reverse;
}

[dir="rtl"] .section-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .section-header .count {
  margin-left: 0;
  margin-right: auto;
}

[dir="rtl"] .dropdown-menu {
  left: auto;
  right: 0;
}

[dir="rtl"] .dropdown-item {
  flex-direction: row-reverse;
  text-align: right;
}

[dir="rtl"] .filter-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .time-section.overdue {
  border-left: none;
  border-right: 3px solid var(--danger-text);
}
</style>
