import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { useQuickSort } from '@/composables/useQuickSort'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useHaptics } from '@/composables/useHaptics'
import type { Task } from '@/types/tasks'
import type { SessionSummary } from '@/stores/quickSort'

export function useMobileQuickSortLogic() {
  const router = useRouter()
  const taskStore = useTaskStore()
  const projectStore = useProjectStore()
  const { triggerHaptic: baseTriggerHaptic } = useHaptics()

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    baseTriggerHaptic(type)
  }

  // Quick Sort composable
  const {
    currentTask,
    uncategorizedTasks,
    progress,
    isComplete,
    isTaskDirty,
    startSession,
    endSession,
    categorizeTask,
    saveTask,
    markTaskDone,
    markDoneAndDeleteTask,
    skipTask,
    tryResumeSession
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

  const uncategorizedCount = computed(() => uncategorizedTasks.value.length)

  const stackPreview = computed(() => {
    return uncategorizedTasks.value.slice(1, 3)
  })

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
    if (!currentTask.value) return
    await taskStore.updateTask(currentTask.value.id, { priority })
    triggerHaptic('light')
  }

  async function setDueDate(preset: 'today' | 'tomorrow' | 'in3days' | 'weekend' | 'nextweek' | '1month' | 'clear') {
    if (!currentTask.value) return

    let dueDate: string | undefined
    const now = new Date()

    if (preset === 'today') {
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      dueDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    } else if (preset === 'in3days') {
      const date = new Date(now)
      date.setDate(date.getDate() + 3)
      date.setHours(0, 0, 0, 0)
      dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } else if (preset === 'weekend') {
      const dayOfWeek = now.getDay()
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
      const saturday = new Date(now)
      saturday.setDate(now.getDate() + (daysUntilSaturday || 7))
      saturday.setHours(0, 0, 0, 0)
      dueDate = `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, '0')}-${String(saturday.getDate()).padStart(2, '0')}`
    } else if (preset === 'nextweek') {
      const date = new Date(now)
      date.setDate(date.getDate() + 7)
      date.setHours(0, 0, 0, 0)
      dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } else if (preset === '1month') {
      const date = new Date(now)
      date.setMonth(date.getMonth() + 1)
      date.setHours(0, 0, 0, 0)
      dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } else {
      dueDate = undefined
    }

    await taskStore.updateTask(currentTask.value.id, { dueDate: dueDate || '' })
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

  function setDueDateAndClose(preset: 'today' | 'tomorrow' | 'in3days' | 'weekend' | 'nextweek' | '1month' | 'clear') {
    setDueDate(preset)
    showQuickEditPanel.value = false
  }

  async function setDueDateDirect(dateString: string) {
    if (!currentTask.value || !dateString) return
    await taskStore.updateTask(currentTask.value.id, { dueDate: dateString })
    triggerHaptic('light')
    showQuickEditPanel.value = false
  }

  function openProjectSheet() {
    showQuickEditPanel.value = false
    showProjectSheet.value = true
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
    if (!currentTask.value?.projectId) return null
    return projectStore.projects.find(p => p.id === currentTask.value!.projectId)
  })

  watch(isComplete, (completed) => {
    if (completed) {
      const summary = endSession()
      sessionSummary.value = summary || null
    }
  })

  watch(aiState, (state) => {
    if (state === 'preview' || state === 'error') {
      showAISheet.value = true
    }
  })

  // TASK-1450: Resume interrupted session or start fresh
  onMounted(() => {
    const resumed = tryResumeSession()
    if (!resumed) {
      startSession()
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
    uncategorizedTasks,
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
    uncategorizedCount,
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
    setPriority,
    setDueDate,
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
    celebrationLabel
  }
}
