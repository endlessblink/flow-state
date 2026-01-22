/**
 * useQuickCapture - Batch capture and sort tasks composable
 *
 * Implements a two-phase workflow:
 * 1. Capture Phase: Rapidly add multiple task titles
 * 2. Sort Phase: Categorize each task with a project using QuickSort-style UI
 *
 * GTD-aligned: Capture without judgment, process later
 */

import { ref, computed, readonly } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useQuickSortStore } from '@/stores/quickSort'

export type QuickCapturePhase = 'capture' | 'sort' | 'done'

export interface PendingTask {
  id: string
  title: string
  projectId?: string
}

export interface SortSummary {
  total: number
  byProject: Map<string | undefined, number>
}

// Singleton state - shared across all instances
const phase = ref<QuickCapturePhase>('capture')
const pendingTasks = ref<PendingTask[]>([])
const currentSortIndex = ref(0)
const sortSummary = ref<SortSummary>({ total: 0, byProject: new Map() })
const isModalOpen = ref(false)

export function useQuickCapture() {
  const taskStore = useTaskStore()
  const quickSortStore = useQuickSortStore()

  // Computed properties
  const currentTask = computed(() => {
    if (phase.value !== 'sort' || currentSortIndex.value >= pendingTasks.value.length) {
      return null
    }
    return pendingTasks.value[currentSortIndex.value]
  })

  const sortProgress = computed(() => ({
    current: currentSortIndex.value + 1,
    total: pendingTasks.value.length
  }))

  const hasTasksToSort = computed(() => pendingTasks.value.length > 0)

  const canStartSorting = computed(() =>
    phase.value === 'capture' && pendingTasks.value.length > 0
  )

  // Actions
  function openModal() {
    isModalOpen.value = true
    reset()
  }

  function closeModal() {
    isModalOpen.value = false
  }

  function reset() {
    phase.value = 'capture'
    pendingTasks.value = []
    currentSortIndex.value = 0
    sortSummary.value = { total: 0, byProject: new Map() }
  }

  function addTask(title: string) {
    if (!title.trim()) return false

    const task: PendingTask = {
      id: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      title: title.trim()
    }

    pendingTasks.value.push(task)
    return true
  }

  function removeTask(taskId: string) {
    const index = pendingTasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      pendingTasks.value.splice(index, 1)
    }
  }

  function removeLastTask() {
    if (pendingTasks.value.length > 0) {
      pendingTasks.value.pop()
    }
  }

  function startSorting() {
    if (pendingTasks.value.length === 0) return false

    // Start a QuickSort session to track stats
    quickSortStore.startSession()

    phase.value = 'sort'
    currentSortIndex.value = 0
    sortSummary.value = { total: 0, byProject: new Map() }
    return true
  }

  async function assignProject(projectId?: string) {
    const task = currentTask.value
    if (!task) return false

    try {
      // Create the task with the assigned project
      await taskStore.createTaskWithUndo({
        title: task.title,
        projectId: projectId,
        status: 'planned'
      })

      // Track in summary
      sortSummary.value.total++
      const count = sortSummary.value.byProject.get(projectId) || 0
      sortSummary.value.byProject.set(projectId, count + 1)

      // Record action for QuickSort stats
      quickSortStore.recordAction({
        id: `action_${Date.now()}`,
        type: 'CATEGORIZE_TASK',
        taskId: task.id,
        newProjectId: projectId,
        timestamp: Date.now()
      })

      // Move to next task
      currentSortIndex.value++

      // Check if done
      if (currentSortIndex.value >= pendingTasks.value.length) {
        finishSorting()
      }

      return true
    } catch (error) {
      console.error('Failed to create task:', error)
      return false
    }
  }

  function skipTask() {
    // Skip creates the task without a project
    return assignProject(undefined)
  }

  function finishSorting() {
    phase.value = 'done'
    quickSortStore.endSession()
  }

  function cancelSort() {
    // Create remaining tasks without projects
    // Then finish
    finishSorting()
  }

  function addMoreTasks() {
    // Reset to capture phase but keep modal open
    phase.value = 'capture'
    pendingTasks.value = []
    currentSortIndex.value = 0
  }

  // Get project name for display
  function getProjectName(projectId?: string): string {
    if (!projectId) return 'Uncategorized'
    return taskStore.getProjectDisplayName(projectId)
  }

  // Get sorted summary entries for display
  const summaryEntries = computed(() => {
    const entries: { projectId: string | undefined; projectName: string; count: number }[] = []

    sortSummary.value.byProject.forEach((count, projectId) => {
      entries.push({
        projectId,
        projectName: getProjectName(projectId),
        count
      })
    })

    // Sort by count descending
    return entries.sort((a, b) => b.count - a.count)
  })

  return {
    // State (readonly)
    phase: readonly(phase),
    pendingTasks: readonly(pendingTasks),
    currentSortIndex: readonly(currentSortIndex),
    sortSummary: readonly(sortSummary),
    isModalOpen: readonly(isModalOpen),

    // Computed
    currentTask,
    sortProgress,
    hasTasksToSort,
    canStartSorting,
    summaryEntries,

    // Actions
    openModal,
    closeModal,
    reset,
    addTask,
    removeTask,
    removeLastTask,
    startSorting,
    assignProject,
    skipTask,
    finishSorting,
    cancelSort,
    addMoreTasks,
    getProjectName
  }
}
