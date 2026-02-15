import { ref, computed, toRefs } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useRouter } from 'vue-router'
import type { Project } from '@/types/tasks'
import { useSmartViews } from '@/composables/useSmartViews'

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

// Shared state instances to ensure all components see the same sidebar state
const newTaskTitle = ref('')
const showCreateProject = ref(false)
// const expandedProjects = ref<string[]>([]) // Moved to UI Store
const showProjectModal = ref(false)
const editingProject = ref<Project | null>(null)
// const isDurationSectionExpanded = ref(true) // Moved to UI Store

export function useSidebarManagement() {
  const taskStore = useTaskStore()
  const uiStore = useUIStore()
  const { isDurationSectionExpanded, expandedProjectIds: expandedProjects } = toRefs(uiStore)
  const { isTodayTask, isWeekTask } = useSmartViews()

  const router = useRouter()

  // Platform detection
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Helper function to filter projects for sidebar display
  const filterSidebarProjects = (projects: Project[]): Project[] => {
    // ... (rest of function unchanged, just need to make sure we don't break indentation)


    // FIX: More robust filtering logic
    const filtered = projects.filter((p): p is Project => {
      if (!p) return false // Remove null/undefined projects

      if (!p.id) {
        return false // Remove projects without ID
      }

      // Keep ALL real projects, filter out only synthetic ones
      const isSynthetic = p.id.startsWith('synthetic')
      if (isSynthetic) {
        return false
      }

      // FIX: Additional validation for real projects
      if (!p.name || p.name.trim() === '') {
        return false
      }


      return true
    })



    // No projects is valid - user can have uncategorized tasks without any projects
    if (filtered.length === 0) {

    }

    return filtered
  }

  // Computed Properties for Project Hierarchy
  // Use centralized rootProjects from task store
  const rootProjects = computed(() => {
    const result = taskStore.rootProjects || []
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
  // BUG-1210: Use centralized useSmartViews instead of duplicated logic.
  // Previously had divergent logic (e.g., including all in_progress tasks
  // regardless of date, excluding overdue) causing count/filter mismatches.
  const todayTaskCount = computed(() => {
    return taskStore.tasks.filter(task => {
      if (task._soft_deleted) return false
      return isTodayTask(task)
    }).length
  })

  // BUG-1210: Use centralized useSmartViews instead of duplicated logic.
  // Previously had divergent logic (e.g., including all in_progress tasks
  // regardless of date, excluding overdue) causing count/filter mismatches.
  const weekTaskCount = computed(() => {
    return taskStore.tasks.filter(task => {
      if (task._soft_deleted) return false
      return isWeekTask(task)
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
      // BUG-FIX: Exclude soft-deleted tasks
      if (task._soft_deleted) return false
      // Count all tasks that are not marked as done
      // This matches the "all_active" smart view logic
      return task.status !== 'done'
    }).length
  })

  // Uncategorized task count for Quick Sort badge
  const uncategorizedCount = computed(() => {
    // Use the exact same logic as the store's uncategorized filter for consistency
    const filteredTasks = taskStore.tasks.filter(task => {
      // BUG-FIX: Exclude soft-deleted tasks
      if (task._soft_deleted) return false
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

  // Duration Counts - Proxy from store
  const quickCount = computed(() => taskStore.smartViewTaskCounts.quick)
  const shortCount = computed(() => taskStore.smartViewTaskCounts.short)
  const mediumCount = computed(() => taskStore.smartViewTaskCounts.medium)
  const longCount = computed(() => taskStore.smartViewTaskCounts.long)
  const unestimatedCount = computed(() => taskStore.smartViewTaskCounts.unestimated)

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
        projectId: undefined // ✅ FIXED: Use undefined instead of forbidden '1'
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
    uiStore.persistState() // Manual save trigger since we're modifying the array in place
  }

  const selectProject = (project: Project) => {
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
    if (currentProjectId && hasChildren(currentProjectId)) {
      if (!expandedProjects.value.includes(currentProjectId)) {
        expandedProjects.value.push(currentProjectId)
        uiStore.persistState()
      }
    }
  }

  const collapseCurrentProjectOrNavigateToParent = () => {
    const currentProjectId = taskStore.activeProjectId
    if (!currentProjectId) return

    // If project has children and is expanded, collapse it
    if (hasChildren(currentProjectId) && expandedProjects.value.includes(currentProjectId)) {
      const index = expandedProjects.value.indexOf(currentProjectId)
      expandedProjects.value.splice(index, 1)
      uiStore.persistState()
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
  const getFlattenedProjectList = (): Project[] => {
    const flatten = (projects: Project[], _level = 1): Project[] => {
      const result: Project[] = []

      for (const project of projects) {
        if (!project.parentId) { // Only include root projects initially
          result.push(project)

          if (expandedProjects.value.includes(project.id)) {
            const children = taskStore.projects.filter(p => p.parentId === project.id)
            result.push(...flatten(children, _level + 1))
          }
        }
      }

      return result
    }

    return flatten(taskStore.projects)
  }



  const toggleDurationSection = () => {
    isDurationSectionExpanded.value = !isDurationSectionExpanded.value
    uiStore.persistState()
  }

  const selectSmartView = (view: 'today' | 'week' | 'uncategorized' | 'all_active' | 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | 'unscheduled' | 'in_progress') => {
    // Check if view is a duration filter
    if (view === 'quick' || view === 'short' || view === 'medium' || view === 'long' || view === 'unestimated') {
      taskStore.setActiveDurationFilter(view)
      taskStore.setSmartView(null)
    } else {
      // It's a smart view
      taskStore.setSmartView(view as any) // Cast still needed because view union is wide, but logic is safe
      taskStore.setActiveDurationFilter(null)
    }
  }

  // Start Quick Sort from uncategorized view
  const handleStartQuickSort = () => {

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

  const openEditProject = (project: Project) => {
    editingProject.value = project
    showProjectModal.value = true
  }

  // Handle project un-nesting (drag to "All Projects")
  const handleProjectUnnest = (data: { projectId?: string; title?: string }) => {
    if (data.projectId) {
      // Remove parent relationship by setting parentId to null
      taskStore.updateProject(data.projectId, { parentId: null })

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
    isDurationSectionExpanded,

    // Computed properties
    rootProjects,
    todayTaskCount,
    weekTaskCount,
    allActiveCount,
    uncategorizedCount,
    quickCount,
    shortCount,
    mediumCount,
    longCount,
    unestimatedCount,

    // Task management methods
    createQuickTask,

    // Project navigation methods
    toggleProjectExpansion,
    toggleDurationSection,
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