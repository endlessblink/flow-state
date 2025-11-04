import { ref, computed } from 'vue'
import { useTaskStore, formatDateKey } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useRouter } from 'vue-router'

/**
 * Sidebar Management State Management Composable
 *
 * Extracted from App.vue to centralize all sidebar-related state and functionality
 * including project navigation, smart views, quick task creation, and project management.
 *
 * This composable manages:
 * - Quick task creation and input state
 * - Project tree navigation and expansion
 * - Smart view selection and filtering
 * - Project hierarchy management
 * - Context menu handling for projects
 * - Drag and drop functionality for projects
 */

export function useSidebarManagement() {
  const taskStore = useTaskStore()
  const uiStore = useUIStore()
  const router = useRouter()

  // Quick task creation state
  const newTaskTitle = ref('')
  const showCreateProject = ref(false)
  const expandedProjects = ref<string[]>([]) // For nested project expand/collapse

  // Project management state
  const showProjectModal = ref(false)
  const editingProject = ref<any>(null)

  // Platform detection
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Helper function to filter out synthetic My Tasks project
  const filterOutSyntheticMyTasks = (project: any) => {
    // Exclude synthetic My Tasks project with multiple criteria for robustness
    return project.id !== '1' &&
           project.name !== 'My Tasks' &&
           !(project.color === '#3b82f6' && project.colorType === 'hex' && project.viewType === 'status')
  }

  // Computed Properties for Project Hierarchy
  // Show all root projects regardless of task count (but exclude the synthetic My Tasks project)
  const rootProjects = computed(() => {
    return taskStore.projects
      .filter(p => !p.parentId) // Only root projects
      .filter(filterOutSyntheticMyTasks) // Exclude synthetic My Tasks project
      // Note: No longer filtering by active tasks - show all projects
  })

  const getChildren = (parentId: string) => {
    return taskStore.projects
      .filter(p => p.parentId === parentId)
      .filter(filterOutSyntheticMyTasks) // Exclude synthetic My Tasks project
      // Note: No longer filtering by active tasks - show all child projects
  }

  const hasChildren = (projectId: string) => {
    return taskStore.projects
      .filter(p => p.parentId === projectId)
      .filter(filterOutSyntheticMyTasks) // Exclude synthetic My Tasks project
      .length > 0 // Check if there are any child projects
  }

  // Smart View Counts
  const todayTaskCount = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return taskStore.tasks.filter(task => {
      // Exclude done tasks from today count - CRITICAL FIX
      if (task.status === 'done') {
        return false
      }

      // Check if task is due today (simplified - no more complex instance system)
      if (task.dueDate === todayStr) {
        return true
      }

      // Fallback to legacy scheduledDate - tasks scheduled for today
      if (task.scheduledDate === todayStr) {
        return true
      }

      // Tasks created today
      const taskCreatedDate = new Date(task.createdAt)
      taskCreatedDate.setHours(0, 0, 0, 0)
      if (taskCreatedDate.getTime() === today.getTime()) {
        return true
      }

      // Tasks due today
      if (task.dueDate === todayStr) {
        return true
      }

      // Tasks currently in progress
      if (task.status === 'in_progress') {
        return true
      }

      return false
    }).length
  })

  const weekTaskCount = computed(() => {
    // Calculate tasks for the next 7 days using same logic as store
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    return taskStore.tasks.filter(task => {
      // Exclude done tasks from week count - CRITICAL FIX (matches today filter)
      if (task.status === 'done') {
        return false
      }

      // Check if task is due within the week (simplified - no more complex instance system)
      if (!task.dueDate) return false
      return task.dueDate >= todayStr && task.dueDate < weekEndStr
    }).length
  })

  // Above My Tasks task count - counts all non-done tasks
  const aboveMyTasksCount = computed(() => {
    return taskStore.tasks.filter(task => {
      // Count all tasks that are not marked as done
      // This matches the "above_my_tasks" smart view logic
      return task.status !== 'done'
    }).length
  })

  // Uncategorized task count for Quick Sort badge
  const uncategorizedCount = computed(() => {
    // Use the exact same logic as the store's uncategorized filter for consistency
    const filteredTasks = taskStore.tasks.filter(task => {
      // Apply same filtering logic as uncategorized smart view in taskStore.filteredTasks
      // Check isUncategorized flag first
      if (task.isUncategorized === true) {
        return true
      }

      // Backward compatibility: also treat tasks without proper project assignment as uncategorized
      if (!task.projectId || task.projectId === '' || task.projectId === null || task.projectId === '1') {
        return true
      }

      return false
    })

    // Apply the same hideDoneTasks logic as the task store
    const finalCount = taskStore.hideDoneTasks
      ? filteredTasks.filter(task => task.status !== 'done').length
      : filteredTasks.length

    return finalCount
  })

  // Task management methods
  const createQuickTask = async () => {
    if (newTaskTitle.value.trim()) {
      // Use the unified undo system
      const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
      const undoRedoActions = useUnifiedUndoRedo()
      undoRedoActions.createTaskWithUndo({
        title: newTaskTitle.value.trim(),
        description: '',
        status: 'planned',
        projectId: '1' // Default project
      })
      newTaskTitle.value = ''
    }
  }

  // Project Navigation Methods
  const toggleProjectExpansion = (projectId: string) => {
    const index = expandedProjects.value.indexOf(projectId)
    if (index > -1) {
      expandedProjects.value.splice(index, 1)
    } else {
      expandedProjects.value.push(projectId)
    }
  }

  const selectProject = (project: any) => {
    taskStore.setActiveProject(project.id)
    taskStore.setSmartView(null)
  }

  // Keyboard navigation for project tree
  const handleProjectTreeKeydown = (event: KeyboardEvent) => {
    const { key } = event

    switch (key) {
      case 'ArrowDown':
        event.preventDefault()
        navigateToNextProject()
        break
      case 'ArrowUp':
        event.preventDefault()
        navigateToPreviousProject()
        break
      case 'ArrowRight':
        event.preventDefault()
        expandCurrentProject()
        break
      case 'ArrowLeft':
        event.preventDefault()
        collapseCurrentProjectOrNavigateToParent()
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        activateCurrentProject()
        break
      case 'Home':
        event.preventDefault()
        navigateToFirstProject()
        break
      case 'End':
        event.preventDefault()
        navigateToLastProject()
        break
    }
  }

  // Navigation helpers
  const navigateToNextProject = () => {
    const currentProjectId = taskStore.activeProjectId
    const allProjects = getFlattenedProjectList()
    const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

    if (currentIndex < allProjects.length - 1) {
      taskStore.setActiveProject(allProjects[currentIndex + 1].id)
    }
  }

  const navigateToPreviousProject = () => {
    const currentProjectId = taskStore.activeProjectId
    const allProjects = getFlattenedProjectList()
    const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

    if (currentIndex > 0) {
      taskStore.setActiveProject(allProjects[currentIndex - 1].id)
    }
  }

  const expandCurrentProject = () => {
    const currentProjectId = taskStore.activeProjectId
    if (currentProjectId && hasProjectChildren(currentProjectId)) {
      if (!expandedProjects.value.includes(currentProjectId)) {
        expandedProjects.value.push(currentProjectId)
      }
    }
  }

  const collapseCurrentProjectOrNavigateToParent = () => {
    const currentProjectId = taskStore.activeProjectId
    if (!currentProjectId) return

    // If project has children and is expanded, collapse it
    if (hasProjectChildren(currentProjectId) && expandedProjects.value.includes(currentProjectId)) {
      const index = expandedProjects.value.indexOf(currentProjectId)
      expandedProjects.value.splice(index, 1)
    } else {
      // Otherwise, navigate to parent if exists
      const project = taskStore.getProjectById(currentProjectId)
      if (project?.parentId) {
        taskStore.setActiveProject(project.parentId)
      }
    }
  }

  const activateCurrentProject = () => {
    const currentProjectId = taskStore.activeProjectId
    if (currentProjectId) {
      const project = taskStore.getProjectById(currentProjectId)
      if (project) {
        selectProject(project)
      }
    }
  }

  const navigateToFirstProject = () => {
    const allProjects = getFlattenedProjectList()
    if (allProjects.length > 0) {
      taskStore.setActiveProject(allProjects[0].id)
    }
  }

  const navigateToLastProject = () => {
    const allProjects = getFlattenedProjectList()
    if (allProjects.length > 0) {
      taskStore.setActiveProject(allProjects[allProjects.length - 1].id)
    }
  }

  // Helper functions for navigation
  const getFlattenedProjectList = () => {
    const flatten = (projects: any[], level = 1): any[] => {
      const result: any[] = []

      for (const project of projects) {
        if (!project.parentId) { // Only include root projects initially
          result.push(project)

          if (expandedProjects.value.includes(project.id)) {
            const children = taskStore.projects.filter(p => p.parentId === project.id)
            result.push(...flatten(children, level + 1))
          }
        }
      }

      return result
    }

    return flatten(taskStore.projects)
  }

  const hasProjectChildren = (projectId: string) => {
    return taskStore.projects.some(p => p.parentId === projectId)
  }

  const selectSmartView = (view: 'today' | 'week' | 'uncategorized' | 'above_my_tasks') => {
    taskStore.setSmartView(view)
  }

  // Start Quick Sort from uncategorized view
  const handleStartQuickSort = () => {
    console.log('🔧 Sidebar: Starting Quick Sort from uncategorized view')
    router.push({ name: 'quick-sort' })
  }

  const getProjectTaskCount = (projectId: string) => {
    // Include tasks from child projects recursively
    const countTasksRecursive = (pid: string): number => {
      const directTasks = taskStore.tasks.filter(task => task.projectId === pid).length
      const children = getChildren(pid)
      const childTasks = children.reduce((sum, child) => sum + countTasksRecursive(child.id), 0)
      return directTasks + childTasks
    }

    return countTasksRecursive(projectId)
  }

  // Project management methods
  const openCreateProject = () => {
    editingProject.value = null
    showProjectModal.value = true
  }

  const openEditProject = (project: any) => {
    editingProject.value = project
    showProjectModal.value = true
  }

  // Handle project un-nesting (drag to "All Projects")
  const handleProjectUnnest = (data: any) => {
    if (data.projectId) {
      // Remove parent relationship by setting parentId to null
      taskStore.updateProject(data.projectId, { parentId: null })
      console.log(`Project "${data.title}" un-nested to root level`)
    }
  }

  return {
    // State
    newTaskTitle,
    showCreateProject,
    expandedProjects,
    showProjectModal,
    editingProject,
    isMac,

    // Computed properties
    rootProjects,
    todayTaskCount,
    weekTaskCount,
    aboveMyTasksCount,
    uncategorizedCount,

    // Task management methods
    createQuickTask,

    // Project navigation methods
    toggleProjectExpansion,
    selectProject,
    handleProjectTreeKeydown,
    selectSmartView,
    handleStartQuickSort,
    getProjectTaskCount,

    // Project management methods
    openCreateProject,
    openEditProject,
    handleProjectUnnest,

    // Helper methods
    getChildren,
    hasChildren
  }
}