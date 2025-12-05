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

  // Helper function to filter projects for sidebar display
  const filterSidebarProjects = (projects: any[]) => {
    console.log('🔍 filterSidebarProjects input:', projects.length, 'projects')

    // FIX: More robust filtering logic
    const filtered = projects.filter(p => {
      if (!p) return false // Remove null/undefined projects

      if (!p.id) {
        console.log('❌ Filtering out project without ID:', p)
        return false // Remove projects without ID
      }

      // Keep ALL real projects, filter out only synthetic ones
      const isSynthetic = p.id.startsWith('synthetic')
      if (isSynthetic) {
        console.log('❌ Filtering out synthetic project:', p.id)
        return false
      }

      // FIX: Additional validation for real projects
      if (!p.name || p.name.trim() === '') {
        console.log('❌ Filtering out project without valid name:', p.id)
        return false
      }

      console.log('✅ Keeping real project:', p.id, p.name)
      return true
    })

    console.log('🔍 filterSidebarProjects output:', filtered.length, 'projects')

    // No projects is valid - user can have uncategorized tasks without any projects
    if (filtered.length === 0) {
      console.log('ℹ️ No projects found - tasks will be uncategorized')
    }

    return filtered
  }

  // Computed Properties for Project Hierarchy
  // Use centralized rootProjects from task store
  const rootProjects = computed(() => {
    const result = taskStore.rootProjects || []
    console.log('🔍 [useSidebarManagement] rootProjects computed:', {
      length: result.length,
      firstProject: result[0]?.name || 'none',
      taskStoreRootProjects: taskStore.rootProjects
    })
    return result
  })

  const getChildren = (parentId: string) => {
    try {
      const allProjects = Array.isArray(taskStore.projects) ? taskStore.projects : []
      const childrenOnly = allProjects.filter(p => p && p.id && p.parentId === parentId)
      return filterSidebarProjects(childrenOnly) // Exclude synthetic projects
    } catch (error) {
      console.error('❌ Error in getChildren computation:', error)
      return []
    }
  }

  const hasChildren = (projectId: string) => {
    try {
      const allProjects = Array.isArray(taskStore.projects) ? taskStore.projects : []
      const childrenOnly = allProjects.filter(p => p && p.id && p.parentId === projectId)
      return filterSidebarProjects(childrenOnly).length > 0 // Check if there are any child projects
    } catch (error) {
      console.error('❌ Error in hasChildren computation:', error)
      return false
    }
  }

  // Smart View Counts
  const todayTaskCount = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return taskStore.tasks.filter(task => {
      // Exclude done tasks from today count (matches filteredTasks logic)
      if (task.status === 'done') {
        return false
      }

      // Check if task is due today (matches filteredTasks logic)
      if (task.dueDate && task.dueDate === todayStr) {
        return true
      }

      // Check if task has instances scheduled for today (matches filteredTasks logic)
      if (task.instances && task.instances.length > 0) {
        const hasTodayInstance = task.instances.some(inst =>
          inst && inst.scheduledDate === todayStr
        )
        if (hasTodayInstance) {
          return true
        }
      }

      // Check legacy scheduled date for today (matches filteredTasks logic)
      if (task.scheduledDate && task.scheduledDate === todayStr) {
        return true
      }

      // Tasks currently in progress (matches filteredTasks logic)
      if (task.status === 'in_progress') {
        return true
      }

      return false
    }).length
  })

  const weekTaskCount = computed(() => {
    // Calculate tasks for the current week (today through Sunday) using same logic as store
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Calculate end of current week (Sunday)
    const weekEnd = new Date(today)
    const dayOfWeek = today.getDay()
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7 // If today is Sunday (0), daysUntilSunday = 7
    weekEnd.setDate(today.getDate() + daysUntilSunday)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    return taskStore.tasks.filter(task => {
      // Exclude done tasks from week count (matches filteredTasks logic)
      if (task.status === 'done') {
        return false
      }

      // Include tasks due within the current week (today through Sunday)
      if (task.dueDate && task.dueDate >= todayStr && task.dueDate <= weekEndStr) {
        return true
      }

      // Check if task has instances scheduled within the week (matches filteredTasks logic)
      if (task.instances && task.instances.length > 0) {
        const hasWeekInstance = task.instances.some(inst =>
          inst && inst.scheduledDate >= todayStr && inst.scheduledDate <= weekEndStr
        )
        if (hasWeekInstance) {
          return true
        }
      }

      // Check legacy scheduled dates within the week (matches filteredTasks logic)
      if (task.scheduledDate && task.scheduledDate >= todayStr && task.scheduledDate <= weekEndStr) {
        return true
      }

      // Tasks currently in progress (matches filteredTasks logic)
      if (task.status === 'in_progress') {
        return true
      }

      // FIX (Dec 5, 2025): Include tasks created today (matches useSmartViews.isWeekTask)
      // This ensures new tasks appear in "This Week" until scheduled
      if (task.createdAt) {
        const createdDate = new Date(task.createdAt)
        if (!isNaN(createdDate.getTime())) {
          createdDate.setHours(0, 0, 0, 0)
          if (createdDate.getTime() === today.getTime()) {
            return true
          }
        }
      }

      return false
    }).length
  })

  // All Active task count - counts all non-done tasks
  const allActiveCount = computed(() => {
    // Use the centralized counter from task store for consistency
    if (taskStore && typeof taskStore.nonDoneTaskCount === 'number') {
      return taskStore.nonDoneTaskCount
    }

    // Fallback to manual filtering
    return taskStore.tasks.filter(task => {
      // Count all tasks that are not marked as done
      // This matches the "all_active" smart view logic
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

      // Backward compatibility: treat tasks without proper project assignment as uncategorized
      // REMOVED: projectId === '1' check - "My Tasks" concept removed
      if (!task.projectId || task.projectId === '' || task.projectId === null) {
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
        projectId: null // ✅ FIXED: Use null instead of forbidden '1'
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

  const selectSmartView = (view: 'today' | 'week' | 'uncategorized' | 'all_active') => {
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
    allActiveCount,
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