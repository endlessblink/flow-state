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

      <!-- Note: Uncategorized filter removed - now using the unified "My Tasks" Smart View in the sidebar -->

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
    <div class="kanban-board" @click="closeAllContextMenus">
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
        @groupContextMenu="handleGroupContextMenu"
      />
    </div>
  </div>

  <!-- TASK EDIT MODAL -->
  <TaskEditModal
    :isOpen="showEditModal"
    :task="selectedTask"
    @close="closeEditModal"
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

  <!-- PROJECT GROUP CONTEXT MENU -->
  <ProjectGroupContextMenu
    :isVisible="showGroupContextMenu"
    :x="groupContextMenuX"
    :y="groupContextMenuY"
    :project="contextMenuProject"
    :tasksCount="getProjectTaskCount(contextMenuProject?.id)"
    :isExpanded="isProjectExpanded(contextMenuProject?.id)"
    @close="closeGroupContextMenu"
    @editProject="handleEditProject"
    @deleteProject="handleDeleteProject"
    @createSubProject="handleCreateSubProject"
    @createTask="handleCreateTaskInProject"
    @hideTasks="handleHideProjectTasks"
    @changeViewType="handleChangeViewType"
    @expandCollapseAll="handleExpandCollapseAll"
    @sortTasks="handleSortProjectTasks"
    @archiveProject="handleArchiveProject"
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

  <!-- PROJECT MODAL -->
  <ProjectModal
    :isOpen="showProjectModal"
    :project="selectedProject"
    :parentProjectId="parentProjectId"
    @close="closeProjectModal"
    @created="handleProjectCreated"
    @updated="handleProjectUpdated"
  />

  <!-- PROJECT DELETE CONFIRMATION MODAL -->
  <ConfirmationModal
    :isOpen="showProjectDeleteConfirmModal"
    title="Delete Project"
    :message="`Are you sure you want to delete the project '${projectToDelete?.name}'? All tasks in this project will be moved to the default project. This action cannot be undone.`"
    confirmText="Delete Project"
    @confirm="confirmDeleteProject"
    @cancel="cancelDeleteProject"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import { useUncategorizedTasks } from '@/composables/useUncategorizedTasks'
import KanbanSwimlane from '@/components/kanban/KanbanSwimlane.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ProjectGroupContextMenu from '@/components/ProjectGroupContextMenu.vue'
import ProjectModal from '@/components/ProjectModal.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import { Eye, EyeOff, CheckCircle, Circle, Minimize2, Maximize2, AlignCenter, ListTodo, Calendar as CalendarIcon, Play, Check, CalendarDays, Inbox, Zap } from 'lucide-vue-next'
import { shouldLogTaskDiagnostics } from '@/utils/consoleFilter'
import type { Task, Project } from '@/stores/tasks'

// Router
const router = useRouter()

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const uiStore = useUIStore()

// Uncategorized tasks composable
const { getUncategorizedTasks, filterTasksForRegularViews } = useUncategorizedTasks()

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

// Group tasks by project - USE STORE'S FILTERED TASKS
const tasksByProject = computed(() => {
  try {
    const grouped: Record<string, Task[]> = {}

    // COMPREHENSIVE DEBUGGING FOR SMART VIEW ISSUE
    let tasks: Task[] = []
    try {
      // STATE SNAPSHOT BEFORE FILTERING
      console.log('🔥🔥🔥 BoardView.tasksByProject: STARTING COMPUTATION')
      console.log('🔥 BoardView.tasksByProject: Task store state:')
      console.log('  - Total raw tasks:', taskStore.tasks?.length || 0)
      console.log('  - Active smart view:', taskStore.activeSmartView)
      console.log('  - Active project ID:', taskStore.activeProjectId)
      console.log('  - Hide done tasks:', taskStore.hideDoneTasks)

      // Get filtered tasks from store
      tasks = taskStore.filteredTasks || []
      console.log('🔥 BoardView.tasksByProject: Filtered tasks received:', tasks.length)

      // LOGGING FOR TASK ANALYSIS
      if (tasks.length === 0) {
        console.log('🔥 BoardView.tasksByProject: ⚠️ NO TASKS PASSED FILTERING!')
        console.log('🔥 BoardView.tasksByProject: Investigating raw tasks...')

        const rawTasks = taskStore.tasks || []
        console.log('🔥 BoardView.tasksByProject: Raw tasks available:', rawTasks.length)

        if (rawTasks.length > 0) {
          console.log('🔥 BoardView.tasksByProject: Sample raw tasks (first 5):')
          rawTasks.slice(0, 5).forEach((task, i) => {
            console.log(`    ${i+1}. "${task.title}" - Status: ${task.status}, Project: ${task.projectId || 'NONE'}`)
          })
        }
      } else {
        console.log('🔥 BoardView.tasksByProject: Tasks that passed filtering:')
        tasks.forEach((task, i) => {
          console.log(`    ${i+1}. "${task.title}" - Status: ${task.status}, Project: ${task.projectId || 'NONE'}`)
        })
      }
    } catch (error) {
      console.error('🔥 BoardView.tasksByProject: Error getting filtered tasks:', error)
      tasks = []
    }

    // Group tasks by project with detailed logging
    let uncategorizedCount = 0
    let validTaskCount = 0

    console.log('🔥 BoardView.tasksByProject: Starting task grouping...')
    tasks.forEach(task => {
      if (!task || typeof task !== 'object') {
        console.warn('🔥 BoardView.tasksByProject: ⚠️ Invalid task object:', task)
        return
      }

      validTaskCount++
      const projectId = task.projectId || 'uncategorized'

      if (projectId === 'uncategorized') {
        uncategorizedCount++
        console.log(`🔥 BoardView.tasksByProject: Found uncategorized task: "${task.title}"`)
      }

      if (!grouped[projectId]) {
        grouped[projectId] = []
        console.log(`🔥 BoardView.tasksByProject: Created project group: "${projectId}"`)
      }
      grouped[projectId].push(task)
    })

    console.log('🔥 BoardView.tasksByProject: Grouping complete:')
    console.log('  - Valid tasks processed:', validTaskCount)
    console.log('  - Uncategorized tasks:', uncategorizedCount)
    console.log('  - Total project groups:', Object.keys(grouped).length)

    // Log each project's task count
    Object.entries(grouped).forEach(([projectId, projectTasks]) => {
      console.log(`    Project "${projectId}": ${projectTasks.length} tasks`)
    })
    return grouped
  } catch (error) {
    console.error('🔥 BoardView.tasksByProject: Critical error:', error)
    // Return empty object - no fake tasks to mask real issues
    return {}
  }
})

// Helper function to create sample tasks for demonstration
const createSampleTasks = (): Task[] => {
  return [
    {
      id: 'sample-1',
      title: 'Sample Task 1 - To Do',
      description: 'This is a sample task for demonstration',
      status: 'planned',
      priority: 'high',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: null,
      instances: [],
      projectId: 'default',
      parentTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canvasPosition: null,
      isInInbox: false,
      dependsOn: []
    },
    {
      id: 'sample-2',
      title: 'Sample Task 2 - In Progress',
      description: 'This task is currently in progress',
      status: 'in_progress',
      priority: 'medium',
      progress: 50,
      completedPomodoros: 1,
      subtasks: [],
      dueDate: null,
      instances: [],
      projectId: 'default',
      parentTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canvasPosition: null,
      isInInbox: false,
      dependsOn: []
    },
    {
      id: 'sample-3',
      title: 'Sample Task 3 - Backlog',
      description: 'This task is in the backlog',
      status: 'backlog',
      priority: 'low',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: null,
      instances: [],
      projectId: 'default',
      parentTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canvasPosition: null,
      isInInbox: false,
      dependsOn: []
    }
  ]
}

// Helper to get a project and all its descendants recursively
const getProjectAndChildren = (projectId: string): string[] => {
  const ids = [projectId]
  const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getProjectAndChildren(child.id))
  })
  return ids
}

// Helper function to check if a project and its children have active tasks
const projectHasActiveTasks = (projectId: string): boolean => {
  try {
    // Get all project IDs including children recursively
    const projectIds = getProjectAndChildren(projectId)

    // Check if any filtered tasks (active tasks only) belong to this project or its children
    const tasks = boardFilteredTasks.value
    return tasks.some(task => projectIds.includes(task.projectId || '1'))
  } catch (error) {
    console.error('BoardView.projectHasActiveTasks: Error checking project tasks:', error)
    return false
  }
}

// SMART PROJECT FILTERING: Only show projects that have filtered tasks when smart views are active
const projectsWithTasks = computed(() => {
  try {
    // Get all projects from store
    let allProjects = taskStore.projects || []
    console.log('🔥 BoardView.projectsWithTasks: All projects from store:', allProjects.length)
    console.log('🔥 BoardView.projectsWithTasks: Active smart view:', taskStore.activeSmartView)

    // Validate that projects is an array
    if (!Array.isArray(allProjects)) {
      console.warn('🔥 BoardView.projectsWithTasks: taskStore.projects is not an array:', allProjects)
      allProjects = []
    }

    // If no projects exist, create a default project
    if (allProjects.length === 0) {
      console.log('🔥 BoardView.projectsWithTasks: No projects found, creating default project')
      allProjects = [{
        id: 'default',
        name: 'Default Project',
        description: 'Default project for kanban board',
        color: '#3b82f6',
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    }

    // CRITICAL FIX: When smart views are active, only show projects that have filtered tasks
    if (taskStore.activeSmartView && taskStore.activeSmartView !== 'all') {
      console.log('🔥🔥🔥 SMART VIEW ACTIVE - FILTERING PROJECTS TO SHOW ONLY THOSE WITH TASKS:', taskStore.activeSmartView)

      // Get project IDs from the filtered tasks (this respects smart view filtering)
      const projectIdsWithFilteredTasks = Object.keys(tasksByProject.value)
      console.log('🔥 BoardView.projectsWithTasks: Project IDs with filtered tasks:', projectIdsWithFilteredTasks)

      // Handle uncategorized tasks
      if (projectIdsWithFilteredTasks.includes('uncategorized')) {
        console.log('🔥 BoardView.projectsWithTasks: Including uncategorized tasks in smart view')
      }

      // Filter projects to only include those that have filtered tasks
      let filteredProjects = allProjects.filter(project => {
        const hasTasks = projectIdsWithFilteredTasks.includes(project.id)
        console.log(`🔥 BoardView.projectsWithTasks: Project "${project.name}" (${project.id}) has filtered tasks: ${hasTasks}`)
        return hasTasks
      })

      // If no projects have tasks but we have uncategorized tasks, create a default project for them
      if (filteredProjects.length === 0 && projectIdsWithFilteredTasks.includes('uncategorized')) {
        console.log('🔥 BoardView.projectsWithTasks: No projects have tasks but uncategorized exist, creating default project')
        filteredProjects = [{
          id: 'default',
          name: 'Default Project',
          description: 'Default project for uncategorized tasks',
          color: '#3b82f6',
          parentId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      }

      console.log('🔥 BoardView.projectsWithTasks: SMART VIEW - Returning', filteredProjects.length, 'projects with tasks')
      return filteredProjects
    } else {
      // No smart view active or "all" selected - return all projects (preserve existing behavior)
      console.log('🔥 BoardView.projectsWithTasks: NO SMART VIEW - Returning all', allProjects.length, 'projects')
      return allProjects
    }
  } catch (error) {
    console.error('🔥 BoardView.projectsWithTasks: Error getting projects:', error)
    // Ultimate fallback - return default project
    return [{
      id: 'default',
      name: 'Default Project',
      description: 'Default project for kanban board',
      color: '#3b82f6',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  }
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

// Filtered tasks specifically for Board View
// Uses taskStore.filteredTasks directly when smart views are active to avoid double filtering
const boardFilteredTasks = computed(() => {
  try {
    // Validate input from taskStore
    const storeTasks = taskStore.filteredTasks
    console.log('🚨 BoardView.boardFilteredTasks: taskStore.filteredTasks =', storeTasks)
    console.log('🚨 BoardView.boardFilteredTasks: taskStore.filteredTasks.length =', storeTasks?.length)
    console.log('🚨 BoardView.boardFilteredTasks: activeSmartView =', taskStore.activeSmartView)

    if (!Array.isArray(storeTasks)) {
      console.warn('🚨 BoardView.boardFilteredTasks: taskStore.filteredTasks is not an array:', storeTasks)
      return []
    }

    console.log('🚨 BoardView.boardFilteredTasks: Input tasks count:', storeTasks.length)

    // When smart views are active, use filteredTasks directly to avoid double filtering
    if (taskStore.activeSmartView) {
      console.log('🚨 BoardView.boardFilteredTasks: Using smart view filtered tasks directly:', storeTasks.length, 'tasks')
      return storeTasks
    }

    // For regular views (no smart filter), use the existing filter logic
    const filtered = filterTasksForRegularViews(storeTasks, taskStore.activeSmartView)
    console.log('🚨 BoardView.boardFilteredTasks: After filterTasksForRegularViews:', filtered?.length)

    // Validate result
    if (!Array.isArray(filtered)) {
      console.warn('🚨 BoardView.boardFilteredTasks: filterTasksForRegularViews did not return an array:', filtered)
      return []
    }

    return filtered
  } catch (error) {
    console.error('🚨 BoardView.boardFilteredTasks: Error filtering tasks:', error)
    return []
  }
})

// Note: uncategorizedTaskCount removed - now using unified sidebar My Tasks Smart View

// Edit modal state
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)


// Context menu state
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Group context menu state
const showGroupContextMenu = ref(false)
const groupContextMenuX = ref(0)
const groupContextMenuY = ref(0)
const contextMenuProject = ref<Project | null>(null)

// Confirmation modal state
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)

// Project modal state
const showProjectModal = ref(false)
const selectedProject = ref<Project | null>(null)
const parentProjectId = ref<string | null>(null)

// Project delete confirmation state
const showProjectDeleteConfirmModal = ref(false)
const projectToDelete = ref<Project | null>(null)

// Task management methods
const handleAddTask = (status: string) => {
  // Create new task immediately with the specified status
  const newTask = taskStore.createTaskWithUndo({
    title: 'New Task',
    description: '',
    status: status,
    priority: 'medium'
  })

  // Open TaskEditModal for editing
  if (newTask) {
    selectedTask.value = newTask
    showEditModal.value = true
    console.log('Opening task edit modal for status:', status)
  } else {
    console.error('Failed to create new task')
  }
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

const closeAllContextMenus = () => {
  closeContextMenu()
  closeGroupContextMenu()
}

// Group context menu handlers
const handleGroupContextMenu = (event: MouseEvent, project: Project) => {
  console.log('Group context menu triggered for project:', project.name, 'at position:', event.clientX, event.clientY)
  groupContextMenuX.value = event.clientX
  groupContextMenuY.value = event.clientY
  contextMenuProject.value = project
  showGroupContextMenu.value = true
}

const closeGroupContextMenu = () => {
  showGroupContextMenu.value = false
  contextMenuProject.value = null
}

// Project action handlers
const handleEditProject = (project: Project) => {
  // Open the project modal with the selected project
  selectedProject.value = project
  showProjectModal.value = true
}

const handleDeleteProject = (project: Project) => {
  // Show confirmation modal for project deletion
  projectToDelete.value = project
  showProjectDeleteConfirmModal.value = true
}

const handleCreateSubProject = (parentProject: Project) => {
  // Open project modal with parent pre-selected
  parentProjectId.value = parentProject.id
  selectedProject.value = null
  showProjectModal.value = true
}

const handleCreateTaskInProject = (projectId: string) => {
  // Create a task in the specified project
  taskStore.createTaskWithUndo({
    title: 'New Task',
    projectId: projectId,
    status: 'planned'
  })
}

const handleHideProjectTasks = (projectId: string) => {
  // Hide all tasks in the project by moving them to a "hidden" status
  const projectTasks = taskStore.tasks.filter(task => task.projectId === projectId && task.status !== 'done')
  if (projectTasks.length > 0) {
    const taskIds = projectTasks.map(task => task.id)
    taskStore.bulkUpdateTasksWithUndo(taskIds, { status: 'backlog' })
  }
}

const handleChangeViewType = (projectId: string, viewType: 'status' | 'date' | 'priority') => {
  // Update the project's view type
  taskStore.updateProject(projectId, { viewType })
}

const handleExpandCollapseAll = (projectId: string, isExpanded: boolean) => {
  // Store collapse state in localStorage or a separate state management
  const collapseKey = `project-collapse-${projectId}`
  localStorage.setItem(collapseKey, (!isExpanded).toString())
  // Force a reactivity update if needed by emitting an event
  window.dispatchEvent(new CustomEvent('project-collapse-changed', {
    detail: { projectId, collapsed: !isExpanded }
  }))
}

const handleSortProjectTasks = (projectId: string) => {
  // Sort tasks in the project by priority and due date
  const projectTasks = taskStore.tasks.filter(task => task.projectId === projectId)
  if (projectTasks.length > 0) {
    // Sort by priority first, then by due date
    const sortedTasks = [...projectTasks].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0

      if (aPriority !== bPriority) {
        return bPriority - aPriority // Higher priority first
      }

      // Then by due date (earlier dates first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1
      return 0
    })

    // For now, just log the sort order - actual reordering would need more complex state management
    console.log('Sorted tasks for project:', projectId, sortedTasks.map(t => t.title))
  }
}

const handleArchiveProject = (projectId: string) => {
  // Archive the project by marking it as archived (add archived field to project)
  const project = taskStore.projects.find(p => p.id === projectId)
  if (project) {
    // For now, just mark all tasks as done to "archive" them
    const projectTasks = taskStore.tasks.filter(task => task.projectId === projectId && task.status !== 'done')
    if (projectTasks.length > 0) {
      const taskIds = projectTasks.map(task => task.id)
      taskStore.bulkUpdateTasksWithUndo(taskIds, { status: 'done' })
    }

    // TODO: Add archived field to Project interface and update project
    console.log('Archived project:', project.name)
  }
}

// Helper methods
const getProjectTaskCount = (projectId: string | null | undefined): number => {
  if (!projectId) return 0
  return taskStore.tasks.filter(task => task.projectId === projectId).length
}

const isProjectExpanded = (projectId: string | null | undefined): boolean => {
  // This would need to be stored in state - for now return true
  return true
}

// Modal handlers
const closeProjectModal = () => {
  showProjectModal.value = false
  selectedProject.value = null
  parentProjectId.value = null
}

const handleProjectCreated = (project: Project) => {
  console.log('Project created:', project)
  closeProjectModal()
}

const handleProjectUpdated = (project: Project) => {
  console.log('Project updated:', project)
  closeProjectModal()
}

const confirmDeleteProject = () => {
  if (projectToDelete.value) {
    // Delete the project and move tasks to default project
    taskStore.deleteProject(projectToDelete.value.id)
    projectToDelete.value = null
    showProjectDeleteConfirmModal.value = false
  }
}

const cancelDeleteProject = () => {
  projectToDelete.value = null
  showProjectDeleteConfirmModal.value = false
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

// Note: handleToggleUncategorizedFilter removed - now using unified sidebar My Tasks Smart View

// Note: handleStartQuickSort removed - Quick Sort is now available from sidebar My Tasks Smart View
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

/* Note: Uncategorized Filter CSS removed - now using unified sidebar My Tasks Smart View */

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
  overflow-x: auto; /* Enable horizontal scrolling within Kanban only */
  min-height: 0; /* Critical: allows flexbox shrinking */
  padding-bottom: 2rem;
  position: relative;
  /* Ensure horizontal scroll doesn't propagate to parent */
  contain: layout paint;
  /* Custom scrollbar styling for better UX */
  scrollbar-width: thin;
  scrollbar-color: var(--border-medium) transparent;
}

/* KANBAN BOARD */
.kanban-board {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-6) 0;
  width: 100%;
  /* Let swimlanes determine width, but contain within scroll container */
  /* Ensure swimlanes can scroll horizontally within their containers */
  isolation: isolate;
}
</style>