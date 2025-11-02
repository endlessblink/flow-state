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
        :class="{ active: taskStore.activeSmartView === 'today' }"
        @click="handleToggleTodayFilter"
        title="Show Today's Tasks"
      >
        <CalendarDays :size="16" />
      </button>

      <!-- Status Filters -->
      <div class="status-filters">
        <button
          class="status-btn icon-only"
          :class="{ active: taskStore.activeStatusFilter === null }"
          @click="taskStore.setActiveStatusFilter(null)"
          title="All Tasks"
        >
          <ListTodo :size="16" />
        </button>
        <button
          class="status-btn icon-only"
          :class="{ active: taskStore.activeStatusFilter === 'planned' }"
          @click="taskStore.setActiveStatusFilter('planned')"
          title="Planned Tasks"
        >
          <CalendarIcon :size="16" />
        </button>
        <button
          class="status-btn icon-only"
          :class="{ active: taskStore.activeStatusFilter === 'in_progress' }"
          @click="taskStore.setActiveStatusFilter('in_progress')"
          title="In Progress Tasks"
        >
          <Play :size="16" />
        </button>
        <button
          class="status-btn icon-only"
          :class="{ active: taskStore.activeStatusFilter === 'done' }"
          @click="taskStore.setActiveStatusFilter('done')"
          title="Completed Tasks"
        >
          <Check :size="16" />
        </button>
      </div>

      <!-- Show Done Column Toggle -->
      <button
        class="done-column-toggle icon-only"
        :class="{ active: showDoneColumn }"
        @click="handleToggleDoneColumn"
        :title="showDoneColumn ? 'Hide Done column' : 'Show Done column'"
      >
        <CheckCircle v-if="showDoneColumn" :size="16" />
        <Circle v-else :size="16" />
      </button>
    </div>
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

  <!-- TASK EDIT MODAL -->
  <TaskEditModal
    :isOpen="showEditModal"
    :task="selectedTask"
    @close="closeEditModal"
  />

  <!-- QUICK TASK CREATE MODAL -->
  <QuickTaskCreateModal
    :isOpen="showQuickTaskCreate"
    :loading="false"
    @cancel="closeQuickTaskCreate"
    @create="handleQuickTaskCreate"
  />

  <!-- TASK CONTEXT MENU -->
  <TaskContextMenu
    :isVisible="showContextMenu"
    :x="contextMenuX"
    :y="contextMenuY"
    :task="contextMenuTask"
    :compactMode="currentDensity === 'ultrathin'"
    @close="closeContextMenu"
    @edit="handleEditTask"
    @confirmDelete="handleConfirmDelete"
  />

  <!-- CONFIRMATION MODAL -->
  <ConfirmationModal
    :isOpen="showConfirmModal"
    title="Delete Task"
    message="Are you sure you want to delete this task? This action cannot be undone."
    confirmText="Delete"
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
import { Eye, EyeOff, CheckCircle, Circle, Minimize2, Maximize2, AlignCenter, ListTodo, Calendar as CalendarIcon, Play, Check, CalendarDays } from 'lucide-vue-next'
import { shouldLogTaskDiagnostics } from '@/utils/consoleFilter'
import type { Task } from '@/stores/tasks'

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const uiStore = useUIStore()

// Density state from global UI store
const currentDensity = computed(() => uiStore.boardDensity)

// Show done column setting
const showDoneColumn = ref(false)

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

// Group tasks by project (using filtered tasks from store)
const tasksByProject = computed(() => {
  const grouped: Record<string, Task[]> = {}

  taskStore.filteredTasks.forEach(task => {
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
  // If a specific project is selected, show that project AND its children
  if (taskStore.activeProjectId) {
    const projectIds = getProjectAndChildren(taskStore.activeProjectId)
    return taskStore.projects.filter(project => projectIds.includes(project.id))
  }

  // For smart views (today, week) or no filter, show all projects
  return taskStore.projects
})

// Total displayed tasks (uses centralized counter for consistency)
const totalDisplayedTasks = computed(() => {
  try {
    // Use the centralized counter from task store
    if (taskStore && typeof taskStore.nonDoneTaskCount === 'number') {
      return taskStore.nonDoneTaskCount
    }

    // Fallback to filteredTasks length
    return taskStore?.filteredTasks?.length || 0
  } catch (error) {
    console.error('BoardView.totalDisplayedTasks: Error calculating task count:', error)
    return 0
  }
})

// Edit modal state
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

// Task management methods
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
  console.log('Context menu triggered for task:', task.title, 'at position:', event.clientX, event.clientY)
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTask.value = task
  showContextMenu.value = true
  console.log('Context menu should be visible:', showContextMenu.value)
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
/* KANBAN HEADER */
.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  background: var(--surface-primary);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.board-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.task-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  background-color: var(--surface-tertiary);
  border-radius: var(--radius-full);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Density Selector - Todoist Inspired */
.density-selector {
  display: flex;
  gap: 2px;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 2px;
  box-shadow: inset var(--shadow-sm);
}

.density-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
}

.density-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-heavy);
}

.density-btn.active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
}

.hide-done-toggle.icon-only {
  padding: var(--space-2);
  min-width: 40px;
  min-height: 40px;
  justify-content: center;
}

.hide-done-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.done-column-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
  min-width: 40px;
  min-height: 40px;
}

.done-column-toggle.icon-only {
  padding: var(--space-2);
  justify-content: center;
}

.done-column-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.done-column-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Today Filter Toggle */
.today-filter {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
  min-width: 40px;
  min-height: 40px;
}

.today-filter.icon-only {
  padding: var(--space-2);
  justify-content: center;
}

.today-filter:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.today-filter.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Status Filters - Board View */
.status-filters {
  display: flex;
  gap: 2px;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 2px;
  box-shadow: inset var(--shadow-sm);
}

.status-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
  z-index: 1;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-btn.icon-only {
  padding: var(--space-2);
  min-width: 36px;
  min-height: 36px;
}

.status-btn:hover {
  color: var(--text-primary);
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow);
}

.status-btn.active {
  color: var(--state-active-text);
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* SCROLL CONTAINER */
.kanban-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: visible; /* Allow horizontal scrolling in inner containers */
  min-height: 0; /* Critical: allows flexbox shrinking */
  padding-bottom: 2rem;
  /* Add containment to prevent child scroll from affecting parent */
  contain: layout style;
  position: relative;
}

/* KANBAN BOARD */
.kanban-board {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-6) 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  /* Ensure swimlanes can scroll horizontally within their containers */
  isolation: isolate;
}
</style>