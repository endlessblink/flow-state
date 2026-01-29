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
                    <span v-if="task.dueDate && groupBy !== 'time'" class="task-due" :class="{ overdue: isOverdue(task.dueDate) }">
                      {{ formatDueTime(task.dueDate) }}
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
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import SwipeableTaskItem from '@/mobile/components/SwipeableTaskItem.vue'
import {
  Check, Play, AlertCircle, Sunrise, Sun, Moon, Calendar, CheckCircle,
  FolderOpen, Flag, ChevronDown, Layers, X, Clock
} from 'lucide-vue-next'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Edit sheet state
const isEditSheetOpen = ref(false)
const editingTask = ref<Task | null>(null)

// TASK-1104: Filter state
type GroupByType = 'time' | 'project' | 'priority'
const selectedProject = ref<string | null>(null)
const selectedPriority = ref<string | null>(null)
const groupBy = ref<GroupByType>('time')
const showProjectDropdown = ref(false)
const showPriorityDropdown = ref(false)
const showGroupByDropdown = ref(false)

// Priority options
const priorityOptions = [
  { value: 'critical', label: 'Critical (P0)' },
  { value: 'high', label: 'High (P1)' },
  { value: 'medium', label: 'Medium (P2)' },
  { value: 'low', label: 'Low (P3)' }
]

// Group by options
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

const hasActiveFilters = computed(() => {
  return selectedProject.value !== null || selectedPriority.value !== null
})

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
  selectedProject.value = projectId
  showProjectDropdown.value = false
}

const selectPriority = (priority: string | null) => {
  selectedPriority.value = priority
  showPriorityDropdown.value = false
}

const selectGroupBy = (value: GroupByType) => {
  groupBy.value = value
  showGroupByDropdown.value = false
}

const clearFilters = () => {
  selectedProject.value = null
  selectedPriority.value = null
}

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

// Time-based categorization
const getTaskHour = (task: Task): number | null => {
  if (!task.dueDate) return null
  return new Date(task.dueDate).getHours()
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

// Priority label helper
const priorityLabel = (priority: string | null | undefined): string => {
  const labels: Record<string, string> = {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
    low: 'P3'
  }
  return labels[priority || ''] || ''
}

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

  if (groupBy.value === 'time') {
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
    const untimedFiltered = tasks.filter(t => {
      if (isOverdue(t.dueDate)) return false
      if (!t.dueDate) return true
      const dueDate = new Date(t.dueDate)
      return dueDate.getHours() === 0 && dueDate.getMinutes() === 0
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

const formatDueTime = (dueDate: string | Date | undefined): string => {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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
  padding: 16px;
  padding-bottom: 100px;
  min-height: 100vh;
  background: var(--app-background-gradient);
}

/* Swipe hint banner */
.swipe-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: var(--surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
}

.hint-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.hint-divider {
  color: var(--border-subtle);
}

.hint-dismiss {
  margin-left: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-brand);
  background: var(--primary-brand-bg-subtle);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.hint-dismiss:active {
  transform: scale(0.95);
}

.today-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

/* TASK-1104: Filter Section */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-dropdown-wrapper {
  position: relative;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
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
  margin-top: 4px;
  min-width: 160px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item:hover {
  background: var(--surface-secondary);
}

.dropdown-item.active {
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
}

.project-emoji {
  font-size: 16px;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.priority-dot.critical { background: #dc2626; }
.priority-dot.high { background: #f97316; }
.priority-dot.medium { background: #eab308; }
.priority-dot.low { background: #22c55e; }

.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--danger-border);
  background: var(--danger-bg-subtle);
  color: var(--danger-text);
  font-size: 12px;
  font-weight: 500;
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
  gap: 8px;
  margin-top: 2px;
}

.priority-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.priority-badge.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge.high { background: var(--warning-bg-subtle); color: var(--warning-text); }
.priority-badge.medium { background: var(--primary-brand-bg-subtle); color: var(--primary-brand); }
.priority-badge.low { background: var(--surface-tertiary); color: var(--text-muted); }

.project-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-tertiary);
  color: var(--text-tertiary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-display h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.full-date {
  font-size: 14px;
  color: var(--text-tertiary);
}

.task-count {
  background: var(--surface-secondary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.time-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-section {
  background: var(--surface-primary);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.time-section.overdue {
  border-left: 3px solid var(--danger-text);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-header .count {
  margin-left: auto;
  background: var(--surface-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
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
  padding: 4px;
}

.checkbox-circle {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox-circle.checked {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.task-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.task-title {
  font-size: 15px;
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
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-due.overdue {
  color: var(--danger-text);
}

.timer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
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
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-state h3 {
  margin: 16px 0 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
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
