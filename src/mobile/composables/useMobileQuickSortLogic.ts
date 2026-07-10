import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { useQuickSort } from '@/composables/useQuickSort'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useHaptics } from '@/composables/useHaptics'
import type { Task } from '@/types/tasks'
import type { SessionSummary } from '@/stores/quickSort'
import type { QuickSortSource } from '@/utils/quickSortTaskFilters'
import {
  resolveQuickSortDueDate,
  type QuickSortDuePreset
} from '@/utils/quickSortDuePresets'

export function useMobileQuickSortLogic() {
  const router = useRouter()
  const route = useRoute()
  const taskStore = useTaskStore()
  const projectStore = useProjectStore()
  const { triggerHaptic: baseTriggerHaptic } = useHaptics()

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    baseTriggerHaptic(type)
  }

  // Quick Sort composable
  const {
    currentTask,
    quickSortTasks,
    progress,
    isComplete,
    isTaskDirty,
    isRescheduling,
    canUndo,
    startSession,
    endSession,
    previewSessionSummary,
    categorizeTask,
    saveTask,
    rescheduleCurrentTask,
    undoLastCategorization,
    markTaskDone,
    markDoneAndDeleteTask,
    skipTask,
    tryResumeSession,
    cancelSession,
    selectedSources,
    sourceCounts,
    sourcePreviewTasks,
    isSessionActive
  } = useQuickSort()

  // AI Command stubs (QuickSort AI removed in TASK-1465)
  const aiState = ref<'idle' | 'preview' | 'error'>('idle')
  const aiAction = ref('')
  const aiError = ref<string | null>(null)
  const isAIBusy = ref(false)
  const currentSuggestions = ref<Array<{ field: string; suggestedValue: unknown }>>([])
  const suggestedProjectId = ref<string | null>(null)
  const suggestedProjectName = ref<string | null>(null)

  // UI State
  const activePhase = ref<'sort' | 'capture'>('sort')
  const showProjectSheet = ref(false)
  const showCelebration = ref(false)
  const hasSwipedOnce = ref(false)
  const sessionSummary = ref<SessionSummary | null>(null)
  const showDeleteConfirm = ref(false)
  const showQuickEditPanel = ref(false)
  const showEditSheet = ref(false)
  const showAISheet = ref(false)
  const showNothingSetReminder = ref(false)
  const showChangeSourcesConfirm = ref(false)
  const pendingSaveAfterReminder = ref(false)

  // Timer cleanup tracking
  const celebrationTimers: ReturnType<typeof setTimeout>[] = []

  // Randomised celebration labels
  const celebrationLabels = ['Sorted!', 'Nice!', 'Got it!', 'Done!', 'Sweet!']
  const celebrationLabel = ref('Sorted!')
  function pickCelebrationLabel() {
    celebrationLabel.value = celebrationLabels[Math.floor(Math.random() * celebrationLabels.length)]
  }

  // Capture phase state
  const newTaskTitle = ref('')
  const newTaskPriority = ref<'low' | 'medium' | 'high' | undefined>()
  const newTaskDue = ref<'today' | 'tomorrow' | undefined>()
  const recentlyAdded = ref<Task[]>([])
  const captureInputRef = ref<HTMLInputElement | null>(null)

  // Project picker state
  const projectSearch = ref('')
  const recentProjectIds = useLocalStorage<string[]>('quicksort-recent-projects', [])

  const confettiRef = ref<HTMLElement | null>(null)

  // Projects - hierarchical structure for nested display
  const rootProjects = computed(() => projectStore.rootProjects)

  interface ProjectWithDepth {
    project: typeof projectStore.projects[number]
    depth: number
  }

  const projectsWithDepth = computed(() => {
    const result: ProjectWithDepth[] = []
    const addProjectWithChildren = (project: typeof projectStore.projects[number], depth: number) => {
      result.push({ project, depth })
      const children = projectStore.getChildProjects(project.id)
      for (const child of children) {
        addProjectWithChildren(child, depth + 1)
      }
    }
    for (const rootProject of rootProjects.value) {
      addProjectWithChildren(rootProject, 0)
    }
    return result
  })

  const recentProjects = computed(() =>
    recentProjectIds.value
      .slice(0, 4)
      .map(id => projectStore.projects.find(p => p.id === id))
      .filter((p): p is typeof projectStore.projects[number] => Boolean(p))
  )

  const filteredProjects = computed(() => {
    if (!projectSearch.value.trim()) return projectsWithDepth.value
    const search = projectSearch.value.toLowerCase()
    return projectsWithDepth.value.filter(({ project }) =>
      project.name.toLowerCase().includes(search)
    )
  })

  const displayTaskCount = computed(() => isSessionActive.value
    ? quickSortTasks.value.length
    : sourcePreviewTasks.value.length)

  const stackPreview = computed(() => {
    const taskId = currentTask.value?.id
    if (!taskId) return []
    const currentIndex = quickSortTasks.value.findIndex(task => task.id === taskId)
    return currentIndex < 0 ? [] : quickSortTasks.value.slice(currentIndex + 1, currentIndex + 3)
  })

  function handleStartSession(sources: QuickSortSource[]) {
    sessionSummary.value = null
    startSession(sources)
  }

  function resetToSourcePicker() {
    cancelSession()
    sessionSummary.value = null
    showChangeSourcesConfirm.value = false
  }

  function requestSourceChange() {
    showChangeSourcesConfirm.value = true
  }

  function confirmSourceChange() {
    resetToSourcePicker()
  }

  function handleSortAnotherSet() {
    endSession()
    sessionSummary.value = null
  }

  function finishAndExit() {
    if (sessionSummary.value) endSession()
    router.push('/tasks')
  }

  // Date detection
  const isToday = computed(() => {
    if (!currentTask.value?.dueDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const taskDate = new Date(currentTask.value.dueDate)
    taskDate.setHours(0, 0, 0, 0)
    return taskDate.getTime() === today.getTime()
  })

  const isTomorrow = computed(() => {
    if (!currentTask.value?.dueDate) return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const taskDate = new Date(currentTask.value.dueDate)
    taskDate.setHours(0, 0, 0, 0)
    return taskDate.getTime() === tomorrow.getTime()
  })

  const isWeekend = computed(() => {
    if (!currentTask.value?.dueDate) return false
    if (isToday.value || isTomorrow.value) return false
    const taskDate = new Date(currentTask.value.dueDate)
    const dayOfWeek = taskDate.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  })

  // Actions
  async function handleQuickAdd() {
    if (!newTaskTitle.value.trim()) return

    let dueDate: string | undefined
    if (newTaskDue.value === 'today') {
      const today = new Date()
      dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    } else if (newTaskDue.value === 'tomorrow') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      dueDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    }

    const newTask = await taskStore.createTask({
      title: newTaskTitle.value.trim(),
      priority: newTaskPriority.value,
      dueDate
    })

    recentlyAdded.value.unshift(newTask)
    if (recentlyAdded.value.length > 5) {
      recentlyAdded.value.pop()
    }

    newTaskTitle.value = ''
    newTaskPriority.value = undefined
    newTaskDue.value = undefined

    triggerHaptic('medium')

    nextTick(() => {
      captureInputRef.value?.focus()
    })
  }

  function handleAssignProject(projectId: string) {
    if (!currentTask.value) return
    recentProjectIds.value = [
      projectId,
      ...recentProjectIds.value.filter(id => id !== projectId)
    ].slice(0, 10)

    categorizeTask(currentTask.value.id, projectId)
    showProjectSheet.value = false
    projectSearch.value = ''
    triggerHaptic('medium')
  }

  function handleSortWithoutProject() {
    if (!currentTask.value) return
    categorizeTask(currentTask.value.id, '')
    showProjectSheet.value = false
    projectSearch.value = ''
    triggerHaptic('medium')
  }

  function handleEditTask() {
    if (!currentTask.value) return
    showEditSheet.value = true
    triggerHaptic('medium')
  }

  async function handleEditSheetSave(taskId: string, updates: Partial<Task>) {
    await taskStore.updateTask(taskId, updates)
    showEditSheet.value = false
    triggerHaptic('medium')
  }

  function handleSkip() {
    skipTask()
    triggerHaptic('light')
  }

  async function _doSave() {
    if (!currentTask.value) return
    // Persist any pending local changes (e.g., AI Apply All sets values locally)
    if (isTaskDirty.value) {
      const task = currentTask.value
      await taskStore.updateTask(task.id, {
        priority: task.priority,
        dueDate: task.dueDate || '',
        status: task.status,
        estimatedDuration: task.estimatedDuration,
        projectId: task.projectId || undefined
      })
    }
    saveTask()
    pickCelebrationLabel()
    showCelebration.value = true
    celebrationTimers.push(setTimeout(() => {
      showCelebration.value = false
    }, 600))
    triggerHaptic('heavy')
  }

  async function handleSave() {
    if (!currentTask.value) return
    const _task = currentTask.value
    if (!isTaskDirty.value) {
      pendingSaveAfterReminder.value = true
      showNothingSetReminder.value = true
      return
    }
    await _doSave()
  }

  async function confirmSaveAnyway() {
    showNothingSetReminder.value = false
    pendingSaveAfterReminder.value = false
    await _doSave()
  }

  function cancelSave() {
    showNothingSetReminder.value = false
    pendingSaveAfterReminder.value = false
  }

  function handleMarkDone() {
    if (!currentTask.value) return
    markTaskDone(currentTask.value.id)
    showCelebration.value = true
    celebrationTimers.push(setTimeout(() => {
      showCelebration.value = false
    }, 600))
    triggerHaptic('heavy')
  }

  async function setPriority(priority: 'low' | 'medium' | 'high') {
    if (!currentTask.value || isRescheduling.value) return
    await taskStore.updateTask(currentTask.value.id, { priority })
    triggerHaptic('light')
  }

  function handleAISuggest() {
    // QuickSort AI removed (TASK-1465) — no-op
  }

  function closeAISheet() {
    showAISheet.value = false
  }

  function handleApplySuggestions() {
    if (!currentTask.value) return
    const task = currentTask.value
    for (const s of currentSuggestions.value) {
      if (s.field === 'priority') task.priority = s.suggestedValue as typeof task.priority
      else if (s.field === 'dueDate') task.dueDate = s.suggestedValue as string
      else if (s.field === 'status') task.status = s.suggestedValue as typeof task.status
      else if (s.field === 'estimatedDuration') task.estimatedDuration = s.suggestedValue as number
    }
    if (suggestedProjectId.value) task.projectId = suggestedProjectId.value
    closeAISheet()
    triggerHaptic('medium')
  }

  function cancelDelete() {
    showDeleteConfirm.value = false
  }

  async function confirmDelete() {
    if (!currentTask.value) return
    await markDoneAndDeleteTask(currentTask.value.id)
    showDeleteConfirm.value = false
    triggerHaptic('heavy')
  }

  function setPriorityAndClose(priority: 'low' | 'medium' | 'high') {
    setPriority(priority)
    showQuickEditPanel.value = false
  }

  const postponeLabels: Record<QuickSortDuePreset, string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    in3days: 'In 3 days',
    weekend: 'Next weekend',
    nextweek: 'In 1 week',
    in2weeks: 'In 2 weeks',
    in1month: 'In 1 month',
    clear: 'No due date'
  }

  async function setDueDateAndClose(preset: QuickSortDuePreset) {
    if (!currentTask.value) return
    const moved = await rescheduleCurrentTask(resolveQuickSortDueDate(preset))
    if (!moved) return
    showQuickEditPanel.value = false
    celebrationLabel.value = `Moved to ${postponeLabels[preset]}`
    showCelebration.value = true
    celebrationTimers.push(setTimeout(() => { showCelebration.value = false }, 900))
    triggerHaptic('medium')
  }

  async function setDueDateDirect(dateString: string) {
    if (!currentTask.value || !dateString) return
    const moved = await rescheduleCurrentTask(dateString)
    if (!moved) return
    showQuickEditPanel.value = false
    celebrationLabel.value = 'Moved to selected date'
    showCelebration.value = true
    celebrationTimers.push(setTimeout(() => { showCelebration.value = false }, 900))
    triggerHaptic('medium')
  }

  function openProjectSheet() {
    showQuickEditPanel.value = false
    showProjectSheet.value = true
  }

  async function handleUndo() {
    await undoLastCategorization()
    triggerHaptic('medium')
  }

  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes === 0) return `${remainingSeconds}s`
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Swipe handlers (for the card to call)
  function onSwipeRight() {
    hasSwipedOnce.value = true
    handleSave()
  }
  function onSwipeLeft() {
    hasSwipedOnce.value = true
    showDeleteConfirm.value = true
  }
  function onSwipeUp() {
    hasSwipedOnce.value = true
    handleEditTask()
  }
  function onSwipeDown() {
    hasSwipedOnce.value = true
    handleSkip()
  }

  const taskDueDate = computed(() => {
    if (!currentTask.value?.dueDate) return null
    const d = new Date(currentTask.value.dueDate)
    if (isNaN(d.getTime())) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const taskDate = new Date(d)
    taskDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  })

  const isTaskOverdue = computed(() => {
    if (!currentTask.value?.dueDate) return false
    const d = new Date(currentTask.value.dueDate)
    if (isNaN(d.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
  })

  const currentTaskProject = computed(() => {
    const projectId = currentTask.value?.projectId
    if (!projectId) return null
    return projectStore.projects.find(project => project.id === projectId)
  })

  watch(isComplete, (completed) => {
    sessionSummary.value = completed ? (previewSessionSummary() || null) : null
  })

  watch(aiState, (state) => {
    if (state === 'preview' || state === 'error') {
      showAISheet.value = true
    }
  })

  // TASK-1450: Resume interrupted sessions; fresh sessions wait for pool selection.
  onMounted(() => {
    const resumed = tryResumeSession()
    if (!resumed && route.query.sources === 'uncategorized') {
      selectedSources.value = ['uncategorized']
    }
  })

  onUnmounted(() => {
    celebrationTimers.forEach(clearTimeout)
    celebrationTimers.length = 0
  })

  return {
    router,
    activePhase,
    showProjectSheet,
    showCelebration,
    hasSwipedOnce,
    sessionSummary,
    showDeleteConfirm,
    showQuickEditPanel,
    isRescheduling,
    canUndo,
    showAISheet,
    newTaskTitle,
    newTaskPriority,
    newTaskDue,
    recentlyAdded,
    captureInputRef,
    projectSearch,
    recentProjectIds,
    confettiRef,
    currentTask,
    quickSortTasks,
    progress,
    isComplete,
    isTaskDirty,
    aiState,
    aiAction,
    aiError,
    isAIBusy,
    currentSuggestions,
    suggestedProjectId,
    suggestedProjectName,
    projectsWithDepth,
    recentProjects,
    filteredProjects,
    displayTaskCount,
    selectedSources,
    sourceCounts,
    sourcePreviewTasks,
    isSessionActive,
    isLoadingTasks: computed(() => taskStore.isLoadingFromDatabase),
    showChangeSourcesConfirm,
    stackPreview,
    isToday,
    isTomorrow,
    isWeekend,
    taskDueDate,
    isTaskOverdue,
    currentTaskProject,
    handleQuickAdd,
    handleAssignProject,
    handleSortWithoutProject,
    handleEditTask,
    handleEditSheetSave,
    showEditSheet,
    handleSkip,
    handleSave,
    handleMarkDone,
    handleUndo,
    setPriority,
    handleAISuggest,
    closeAISheet,
    handleApplySuggestions,
    cancelDelete,
    confirmDelete,
    setPriorityAndClose,
    setDueDateAndClose,
    setDueDateDirect,
    openProjectSheet,
    formatDuration,
    onSwipeRight,
    onSwipeLeft,
    onSwipeUp,
    onSwipeDown,
    showNothingSetReminder,
    pendingSaveAfterReminder,
    confirmSaveAnyway,
    cancelSave,
    celebrationLabel,
    handleStartSession,
    requestSourceChange,
    confirmSourceChange,
    resetToSourcePicker,
    handleSortAnotherSet,
    finishAndExit
  }
}
