import { ref, computed, readonly } from 'vue'

export interface LoadingPhase {
  id: string
  name: string
  progress: number
  completed: boolean
  error?: string
}

export interface AppLoadedState {
  phases: LoadingPhase[]
  currentPhase: string
  overallProgress: number
  isLoaded: boolean
  hasError: boolean
  errors: string[]
}

const DEFAULT_PHASES: LoadingPhase[] = [
  { id: 'theme', name: 'Initializing theme', progress: 0, completed: false },
  { id: 'ui-state', name: 'Loading UI preferences', progress: 0, completed: false },
  { id: 'task-database', name: 'Loading tasks and projects', progress: 0, completed: false },
  { id: 'canvas-database', name: 'Loading canvas layout', progress: 0, completed: false },
  { id: 'timer-permissions', name: 'Setting up timer', progress: 0, completed: false },
  { id: 'event-listeners', name: 'Initializing interactions', progress: 0, completed: false },
  { id: 'auth-check', name: 'Checking authentication', progress: 0, completed: false },
  { id: 'finalization', name: 'Finalizing setup', progress: 0, completed: false }
]

export function useAppLoaded() {
  const state = ref<AppLoadedState>({
    phases: DEFAULT_PHASES.map(phase => ({ ...phase })),
    currentPhase: DEFAULT_PHASES[0].id,
    overallProgress: 0,
    isLoaded: false,
    hasError: false,
    errors: []
  })

  const currentPhaseIndex = computed(() => {
    return state.value.phases.findIndex(phase => phase.id === state.value.currentPhase)
  })

  const completedPhases = computed(() => {
    return state.value.phases.filter(phase => phase.completed)
  })

  const overallProgress = computed(() => {
    const completed = completedPhases.value.length
    const total = state.value.phases.length
    return Math.round((completed / total) * 100)
  })

  const isLoaded = computed(() => {
    return state.value.phases.every(phase => phase.completed)
  })

  const hasError = computed(() => {
    return state.value.phases.some(phase => phase.error) || state.value.errors.length > 0
  })

  const allErrors = computed(() => {
    const phaseErrors = state.value.phases
      .filter(phase => phase.error)
      .map(phase => `${phase.name}: ${phase.error}`)

    return [...phaseErrors, ...state.value.errors]
  })

  function updatePhaseProgress(phaseId: string, progress: number, error?: string) {
    const phaseIndex = state.value.phases.findIndex(phase => phase.id === phaseId)
    if (phaseIndex === -1) {
      console.warn(`Unknown phase: ${phaseId}`)
      return
    }

    state.value.phases[phaseIndex].progress = Math.min(100, Math.max(0, progress))

    if (error) {
      state.value.phases[phaseIndex].error = error
      state.value.hasError = true
    }

    if (progress >= 100 && !error) {
      state.value.phases[phaseIndex].completed = true
      moveToNextPhase()
    }

    state.value.overallProgress = overallProgress.value
    state.value.isLoaded = isLoaded.value
    state.value.hasError = hasError.value
  }

  function moveToNextPhase() {
    const currentIndex = currentPhaseIndex.value
    if (currentIndex < state.value.phases.length - 1) {
      state.value.currentPhase = state.value.phases[currentIndex + 1].id
    }
  }

  function completePhase(phaseId: string) {
    updatePhaseProgress(phaseId, 100)
  }

  function failPhase(phaseId: string, error: string) {
    updatePhaseProgress(phaseId, 0, error)
  }

  function reset() {
    state.value = {
      phases: DEFAULT_PHASES.map(phase => ({ ...phase })),
      currentPhase: DEFAULT_PHASES[0].id,
      overallProgress: 0,
      isLoaded: false,
      hasError: false,
      errors: []
    }
  }

  function addGlobalError(error: string) {
    state.value.errors.push(error)
    state.value.hasError = true
  }

  // Convenience methods for specific phases
  const theme = {
    start: () => updatePhaseProgress('theme', 10),
    complete: () => completePhase('theme'),
    fail: (error: string) => failPhase('theme', error)
  }

  const uiState = {
    start: () => updatePhaseProgress('ui-state', 25),
    complete: () => completePhase('ui-state'),
    fail: (error: string) => failPhase('ui-state', error)
  }

  const taskDatabase = {
    start: () => updatePhaseProgress('task-database', 40),
    update: (progress: number) => updatePhaseProgress('task-database', progress),
    complete: () => completePhase('task-database'),
    fail: (error: string) => failPhase('task-database', error)
  }

  const canvasDatabase = {
    start: () => updatePhaseProgress('canvas-database', 30),
    update: (progress: number) => updatePhaseProgress('canvas-database', progress),
    complete: () => completePhase('canvas-database'),
    fail: (error: string) => failPhase('canvas-database', error)
  }

  const timerPermissions = {
    start: () => updatePhaseProgress('timer-permissions', 20),
    complete: () => completePhase('timer-permissions'),
    fail: (error: string) => failPhase('timer-permissions', error)
  }

  const eventListeners = {
    start: () => updatePhaseProgress('event-listeners', 15),
    complete: () => completePhase('event-listeners'),
    fail: (error: string) => failPhase('event-listeners', error)
  }

  const authCheck = {
    start: () => updatePhaseProgress('auth-check', 10),
    complete: () => completePhase('auth-check'),
    fail: (error: string) => failPhase('auth-check', error)
  }

  const finalization = {
    start: () => updatePhaseProgress('finalization', 5),
    complete: () => completePhase('finalization'),
    fail: (error: string) => failPhase('finalization', error)
  }

  return {
    // State
    state: readonly(state),

    // Computed
    overallProgress,
    isLoaded,
    hasError,
    allErrors,
    currentPhase: computed(() => state.value.currentPhase),
    completedPhases,

    // Methods
    updatePhaseProgress,
    completePhase,
    failPhase,
    reset,
    addGlobalError,

    // Phase-specific methods
    theme,
    uiState,
    taskDatabase,
    canvasDatabase,
    timerPermissions,
    eventListeners,
    authCheck,
    finalization
  }
}

// Export a singleton instance for global use
let globalAppLoaded: ReturnType<typeof useAppLoaded> | null = null

export function useGlobalAppLoaded() {
  if (!globalAppLoaded) {
    globalAppLoaded = useAppLoaded()
  }
  return globalAppLoaded
}