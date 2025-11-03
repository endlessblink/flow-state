<template>
  <!-- KANBAN BOARD HEADER CONTROLS -->
  <div class="kanban-header">
    <div class="header-left">
      <h2 class="board-title">Kanban Board</h2>
      <span class="task-count">{{ totalDisplayedTasks }} tasks</span>
    </div>
    <div class="header-controls">
      <!-- Density Selector -->
      <div class="density-selector">
        <button
          class="density-btn"
          :class="{ active: currentDensity === 'ultrathin' }"
          @click="setDensity('ultrathin')"
          title="Ultra-thin cards"
        >
          <Minimize2 :size="14" />
        </button>
        <button
          class="density-btn"
          :class="{ active: currentDensity === 'compact' }"
          @click="setDensity('compact')"
          title="Compact cards"
        >
          <Maximize2 :size="14" />
        </button>
        <button
          class="density-btn"
          :class="{ active: currentDensity === 'comfortable' }"
          @click="setDensity('comfortable')"
          title="Comfortable cards"
        >
          <AlignCenter :size="14" />
        </button>
      </div>

      <!-- Hide Done Tasks Toggle -->
      <button
        class="hide-done-toggle icon-only"
        :class="{ active: taskStore.hideDoneTasks }"
        @click="handleToggleDoneTasks"
        :title="taskStore.hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
      >
        <EyeOff v-if="taskStore.hideDoneTasks" :size="16" />
        <Eye v-else :size="16" />
      </button>

      <!-- Today Filter -->
      <button
        class="today-filter icon-only"
        :class="{ active: isTodayView }"
        @click="handleToggleTodayFilter"
        title="Show today's tasks"
      >
        <CalendarDays :size="16" />
      </button>

      <!-- List View Toggle -->
      <button
        class="list-view-toggle icon-only"
        :class="{ active: isListView }"
        @click="handleToggleListView"
        title="Toggle between kanban and list view"
      >
        <ListTodo :size="16" />
      </button>

      <!-- Play Button -->
      <button
        class="play-btn"
        @click="handleStartPomodoroSession"
        title="Start 25-minute Pomodoro session"
      >
        <Play :size="16" />
      </button>
    </div>
  </div>

  <!-- TASK CREATION AREA -->
  <div class="task-creation-area">
    <button
      v-for="status in statusColumns"
      :key="status.id"
      class="add-task-btn"
      :class="status.color"
      @click="handleAddTask(status.id)"
    >
      <Plus :size="14" />
      <span>{{ status.addLabel }}</span>
    </button>
  </div>

  <!-- SCROLL CONTAINER FOR KANBAN BOARD -->
  <div class="kanban-scroll-container">
    <div class="kanban-board" @click="closeContextMenu">
      <KanbanSwimlane
        v-for="project in projectsWithTasks"
        :key="project.id"
        :project="project"
        :tasks="tasksByProject[project.id] || []"
        :currentFilter="taskStore.activeSmartView"
        :density="currentDensity"
        :showDoneColumn="showDoneColumn"
        @selectTask="handleSelectTask"
        @startTimer="handleStartTimer"
        @editTask="handleEditTask"
        @moveTask="handleMoveTask"
        @contextMenu="handleContextMenu"
      />
    </div>
  </div>

  <!-- QUICK TASK CREATE MODAL -->
  <QuickTaskCreateModal
    v-if="showQuickTaskCreate"
    :initial-status="pendingTaskStatus"
    :active-project-id="taskStore.activeProjectId"
    @create="handleQuickTaskCreate"
    @cancel="closeQuickTaskCreate"
  />

  <!-- TASK EDIT MODAL -->
  <TaskEditModal
    v-if="showEditModal && selectedTask"
    :task="selectedTask"
    @close="closeEditModal"
    @update="handleTaskUpdate"
  />

  <!-- CONTEXT MENU -->
  <TaskContextMenu
    v-if="showContextMenu && contextMenuTask"
    :task="contextMenuTask"
    :x="contextMenuX"
    :y="contextMenuY"
    @edit="() => handleEditTask(contextMenuTask.id)"
    @add-subtask="() => handleAddSubtaskFromMenu(contextMenuTask.id)"
    @start-timer="() => handleStartTimer(contextMenuTask.id)"
    @move-status="(status) => handleMoveTask(contextMenuTask.id, status)"
    @delete="() => handleConfirmDelete(contextMenuTask.id)"
    @close="closeContextMenu"
  />

  <!-- CONFIRMATION MODAL -->
  <ConfirmationModal
    v-if="showConfirmModal"
    :message="`Are you sure you want to delete this task?`"
    :confirm-text="'Delete'"
    :cancel-text="'Cancel'"
    @confirm="confirmDeleteTask"
    @cancel="cancelDeleteTask"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import KanbanSwimlane from '@/components/kanban/KanbanSwimlane.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import QuickTaskCreateModal from '@/components/QuickTaskCreateModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import { Eye, EyeOff, CheckCircle, Circle, Minimize2, Maximize2, AlignCenter, ListTodo, Calendar as CalendarIcon, Play, Check, CalendarDays, Plus } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const uiStore = useUIStore()

// Density state from global UI store
const currentDensity = computed(() => uiStore.boardDensity)

// ✅ WORKING: Use store's working filteredTasks directly
const filteredTasks = computed(() => {
  console.log('🔍 BoardView: Using store working filteredTasks')
  console.log('🔍 BoardView: Store filtered tasks count:', taskStore.filteredTasks.length)

  // Use the working store filtering logic
  return taskStore.filteredTasks
})

// Show done column setting
const showDoneColumn = ref(false)
const isTodayView = ref(false)
const isListView = ref(false)

// Status columns for kanban board
const statusColumns = computed(() => [
  { id: 'backlog', label: 'Backlog', color: 'bg-gray-500', addLabel: 'Add to Backlog' },
  { id: 'planned', label: 'Planned', color: 'bg-blue-500', addLabel: 'Add to Planned' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-yellow-500', addLabel: 'Add to In Progress' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-orange-500', addLabel: 'Add to On Hold' },
  { id: 'done', label: 'Done', color: 'bg-green-500', addLabel: 'Add to Done' }
])

// 🎯 NEW: Group tasks by project using unified filtering
const tasksByProject = computed(() => {
  const grouped: Record<string, Task[]> = {}

  filteredTasks.value.forEach(task => {
    const projectId = task.projectId || '1'
    if (!grouped[projectId]) {
      grouped[projectId] = []
    }
    grouped[projectId].push(task)
  })

  return grouped
})

// Helper to get a project and all its descendants recursively
const getProjectAndChildren = (projectId: string): string[] => {
  const ids = [projectId]
  const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getProjectAndChildren(child.id))
  })
  return ids
}

// Get projects to display - respect active project filter but always show projects for smart views
const projectsWithTasks = computed(() => {
  console.log('🏗️ BoardView: Active project ID:', taskStore.activeProjectId)
  console.log('🏗️ BoardView: All projects count:', taskStore.projects.length)

  // If a specific project is selected, show that project AND its children
  if (taskStore.activeProjectId) {
    const projectIds = getProjectAndChildren(taskStore.activeProjectId)
    const filtered = taskStore.projects.filter(project => projectIds.includes(project.id))
    console.log('🏗️ BoardView: Filtered projects (with active):', filtered.length)
    return filtered
  }
  // For smart views (today, week) or no filter, show all projects
  console.log('🏗️ BoardView: Returning all projects:', taskStore.projects.length)
  return taskStore.projects
})

// Total displayed tasks (respects hide done tasks setting)
const totalDisplayedTasks = computed(() => {
  return Object.values(tasksByProject.value).reduce((total, projectTasks) => total + projectTasks.length, 0)
})

// 🎯 NEW: Edit modal state
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)

// Quick Task Create Modal state
const showQuickTaskCreate = ref(false)
const pendingTaskStatus = ref<string>('planned')

// Context menu state
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Confirmation modal state
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)

// Load saved settings on mount
onMounted(() => {
  // Initialize UI store (includes density loading)
  uiStore.loadState()

  // Load kanban settings
  const savedKanbanSettings = localStorage.getItem('pomo-flow-kanban-settings')
  if (savedKanbanSettings) {
    const settings = JSON.parse(savedKanbanSettings)
    showDoneColumn.value = settings.showDoneColumn || false
  }

  // Listen for kanban settings changes
  window.addEventListener('kanban-settings-changed', handleKanbanSettingsChange)

  // 🎯 NEW: Log that we're using the new two-layer architecture
  console.log('✅ BoardView: Using Simple Services + Direct Stores (Two-Layer Architecture)')
  console.log('✅ BoardView: Task operations will sync instantly across all views')
})

// Clean up event listener
onUnmounted(() => {
  window.removeEventListener('kanban-settings-changed', handleKanbanSettingsChange)
})

// Handle kanban settings changes
const handleKanbanSettingsChange = (event: CustomEvent) => {
  showDoneColumn.value = event.detail.showDoneColumn
}

// Set density using global store
const setDensity = (density: 'ultrathin' | 'compact' | 'comfortable') => {
  uiStore.setBoardDensity(density)
}


// 🎯 NEW: List view toggle
const handleToggleListView = () => {
  isListView.value = !isListView.value
  console.log('🎯 BoardView:', isListView.value ? 'List view' : 'Kanban view')
}

// 🎯 NEW: Start Pomodoro session
const handleStartPomodoroSession = async () => {
  try {
    await timerService.startTimer('work')
    console.log('✅ SimpleTimerService: Started 25-minute work session')
  } catch (error) {
    console.error('❌ SimpleTimerService: Failed to start timer', error)
  }
}

// 🎯 NEW: Enhanced task management methods
const handleAddTask = (status: string) => {
  // Store the status for when the task is created
  pendingTaskStatus.value = status

  // Open quick task create modal instead of creating task directly
  showQuickTaskCreate.value = true
  console.log('Opening task creation modal for status:', status)
}

const handleSelectTask = (taskId: string) => {
  taskStore.selectTask(taskId)
}

const handleStartTimer = (taskId: string) => {
  // Start a 25-minute work timer for the specific task
  timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
  console.log('Started timer for task:', taskId)
}

const handleEditTask = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    selectedTask.value = task
    showEditModal.value = true
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedTask.value = null
}


// Quick Task Create Modal handlers
const closeQuickTaskCreate = () => {
  showQuickTaskCreate.value = false
  pendingTaskStatus.value = 'planned'
}

const handleQuickTaskCreate = (title: string, description: string) => {
  console.log('🎯 Creating task with title:', title, 'and status:', pendingTaskStatus.value)

  // Create new task with user-provided title and stored status
  const newTask = taskStore.createTaskWithUndo({
    title: title,
    description: description,
    status: pendingTaskStatus.value as any,
    projectId: taskStore.activeProjectId || '1'
  })

  // Close the quick create modal
  closeQuickTaskCreate()

  if (newTask) {
    console.log('✅ Successfully created task:', newTask.title)
  } else {
    console.error('❌ Failed to create new task')
  }
}

// Context menu handlers
const handleContextMenu = (event: MouseEvent, task: Task) => {
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTask.value = task
  showContextMenu.value = true
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

const handleAddSubtaskFromMenu = (taskId: string) => {
  taskStore.createSubtaskWithUndo(taskId, { title: 'New Subtask' })
}

// Confirmation modal handlers
const handleConfirmDelete = (taskId: string) => {
  taskToDelete.value = taskId
  showConfirmModal.value = true
}

const confirmDeleteTask = () => {
  if (taskToDelete.value) {
    taskStore.deleteTaskWithUndo(taskToDelete.value)
    taskToDelete.value = null
  }
  showConfirmModal.value = false
}

const cancelDeleteTask = () => {
  taskToDelete.value = null
  showConfirmModal.value = false
}

const handleMoveTask = (taskId: string, newStatus: string) => {
  taskStore.moveTaskWithUndo(taskId, newStatus as any)
  console.log('Moved task:', taskId, 'to', newStatus)
}

// Debug function to test toggle functionality
const handleToggleDoneTasks = (event: MouseEvent) => {
  // Prevent event bubbling that might interfere with other click handlers
  event.stopPropagation()
  console.log('🔧 BoardView: Toggle button clicked!')
  console.log('🔧 BoardView: Current hideDoneTasks value:', taskStore.hideDoneTasks)

  try {
    taskStore.toggleHideDoneTasks()
    console.log('🔧 BoardView: After toggle - hideDoneTasks value:', taskStore.hideDoneTasks)
    console.log('🔧 BoardView: Method call successful')
  } catch (error) {
    console.error('🔧 BoardView: Error calling toggleHideDoneTasks:', error)
  }
}

// Toggle Done column visibility
const handleToggleDoneColumn = (event: MouseEvent) => {
  // Prevent event bubbling
  event.stopPropagation()
  console.log('🔧 BoardView: Done column toggle clicked!')
  console.log('🔧 BoardView: Current showDoneColumn value:', showDoneColumn.value)
  console.log('🔧 BoardView: Available done tasks:', taskStore.tasks.filter(t => t.status === 'done').length)

  try {
    // Toggle the local state
    showDoneColumn.value = !showDoneColumn.value
    console.log('🔧 BoardView: Toggled to new value:', showDoneColumn.value)

    // Save to localStorage
    saveKanbanSettings()

    // Emit custom event to keep Settings in sync
    window.dispatchEvent(new CustomEvent('kanban-settings-changed', {
      detail: { showDoneColumn: showDoneColumn.value }
    }))

    console.log('🔧 BoardView: Settings saved and event dispatched')
    console.log('🔧 BoardView: Done column should now be', showDoneColumn.value ? 'VISIBLE' : 'HIDDEN')
  } catch (error) {
    console.error('🔧 BoardView: Error toggling Done column:', error)
  }
}

// Save kanban settings to localStorage
const saveKanbanSettings = () => {
  const settings = {
    showDoneColumn: showDoneColumn.value
  }
  localStorage.setItem('pomo-flow-kanban-settings', JSON.stringify(settings))
  console.log('🔧 BoardView: Kanban settings saved:', settings)
}

// Toggle Today filter
const handleToggleTodayFilter = (event: MouseEvent) => {
  event.stopPropagation()
  console.log('🔧 BoardView: Today filter toggle clicked!')
  console.log('🔧 BoardView: Current activeSmartView:', taskStore.activeSmartView)

  try {
    // Toggle between 'today' and null
    if (taskStore.activeSmartView === 'today') {
      taskStore.setSmartView(null)
      console.log('🔧 BoardView: Cleared Today filter')
    } else {
      taskStore.setSmartView('today')
      console.log('🔧 BoardView: Activated Today filter')
    }
  } catch (error) {
    console.error('🔧 BoardView: Error toggling Today filter:', error)
  }
}
</script>

<style scoped>
.kanban-header {
  @apply flex items-center justify-between p-4 border-b;
  @apply border-gray-200 dark:border-gray-700;
  @apply bg-gray-50/80 dark:bg-gray-900/80;
  backdrop-filter: blur(10px);
}

.header-left {
  @apply flex items-center gap-3;
}

.board-title {
  @apply text-xl font-semibold text-gray-800 dark:text-gray-100;
}

.task-count {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.header-controls {
  @apply flex items-center gap-2;
}

.density-selector {
  @apply flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1;
}

.density-btn {
  @apply p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700;
}

.density-btn.active {
  @apply bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200;
}

.hide-done-toggle,
.today-filter,
.list-view-toggle,
.play-btn {
  @apply p-2 rounded-lg transition-all duration-200;
  @apply border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800;
  @apply hover:bg-gray-50 dark:hover:bg-gray-700;
}

.hide-done-toggle.active,
.today-filter.active,
.list-view-toggle.active {
  @apply bg-blue-500 text-white border-blue-500;
}

.play-btn {
  @apply bg-green-500 text-white border-green-500 hover:bg-green-600;
}

.task-creation-area {
  @apply flex gap-4 p-4 border-b;
  @apply border-gray-200 dark:border-gray-700;
  @apply bg-gray-100/50 dark:bg-gray-800/50;
}

.add-task-btn {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200;
  @apply text-white font-medium hover:scale-105;
  @apply shadow-sm hover:shadow-md;
}

.add-task-btn:hover {
  @apply transform-gpu -translate-y-1;
}

.kanban-board {
  @apply p-4 overflow-x-auto;
  @apply bg-gray-50 dark:bg-gray-900;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Glass morphism effects */
.add-task-btn {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.dark .add-task-btn {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.density-selector,
.hide-done-toggle,
.today-filter,
.list-view-toggle,
.play-btn {
  @apply bg-white/90 dark:bg-gray-800/90;
  backdrop-filter: blur(10px);
  @apply border border-gray-200/50 dark:border-gray-700/50;
}

/* Status column colors */
.bg-blue-500 { background-color: #3b82f6; }
.bg-yellow-500 { background-color: #eab308; }
.bg-orange-500 { background-color: #f97316; }
.bg-green-500 { background-color: #22c55e; }
.bg-gray-500 { background-color: #6b7280; }

/* Responsive design */
@media (max-width: 768px) {
  .kanban-header {
    @apply flex-col gap-3;
  }

  .header-controls {
    @apply w-full justify-center;
  }

  .task-creation-area {
    @apply flex-col gap-2;
  }
}
</style>