import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useAuthStore } from '@/stores/auth'

/**
 * App Header Management State Management Composable
 *
 * Extracted from App.vue to centralize all header-related state and functionality
 * including project title display, timer integration, and user profile coordination.
 *
 * This composable manages:
 * - Dynamic page title computation based on active context
 * - Timer display and quick timer controls
 * - User profile integration
 * - Time display coordination
 * - Header-specific event handling
 */

export function useAppHeader() {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()
  const authStore = useAuthStore()

  // Dynamic page title computation
  const pageTitle = computed(() => {
    if (taskStore.activeSmartView === 'today') return 'Today'
    if (taskStore.activeSmartView === 'week') return 'This Week'
    if (taskStore.activeSmartView === 'uncategorized') return 'My Tasks'
    if (taskStore.activeSmartView === 'above_my_tasks') return 'All Tasks'

    if (taskStore.activeProjectId) {
      const project = taskStore.getProjectById(taskStore.activeProjectId)
      return project?.name || 'Project'
    }

    return 'Board'
  })

  // Timer integration methods
  const startQuickTimer = () => {
    console.log('🍅 DEBUG: startQuickTimer called - starting general timer')
    // Start a general 25-minute timer (no specific task)
    timerStore.startTimer('general')
  }

  const startShortBreak = () => {
    console.log('🍅 DEBUG: startShortBreak called - starting short break timer')
    // Start a 5-minute break timer
    timerStore.startTimer('short-break', timerStore.settings.shortBreakDuration, true)
  }

  const startLongBreak = () => {
    console.log('🍅 DEBUG: startLongBreak called - starting long break timer')
    // Start a 15-minute long break timer
    timerStore.startTimer('long-break', timerStore.settings.longBreakDuration, true)
  }

  // Timer state computed properties for header display
  const timerDisplayTime = computed(() => timerStore.displayTime)
  const currentTaskName = computed(() => timerStore.currentTaskName || '&nbsp;')
  const isTimerActive = computed(() => timerStore.isTimerActive)
  const isTimerPaused = computed(() => timerStore.isPaused)
  const currentSession = computed(() => timerStore.currentSession)
  const isBreakSession = computed(() => timerStore.currentSession?.isBreak)

  // Timer icon computation
  const timerIcon = computed(() => {
    if (isTimerActive.value && !isBreakSession.value) {
      return '🍅' // Work session
    } else if (isTimerActive.value && isBreakSession.value) {
      return '🧎' // Break session
    }
    return null // Static icon will be used in component
  })

  // Timer state classes
  const timerClasses = computed(() => ({
    'timer-active': isTimerActive.value,
    'timer-break': isBreakSession.value
  }))

  // User profile state
  const isAuthenticated = computed(() => authStore.isAuthenticated)

  return {
    // Computed properties
    pageTitle,
    timerDisplayTime,
    currentTaskName,
    isTimerActive,
    isTimerPaused,
    currentSession,
    isBreakSession,
    timerIcon,
    timerClasses,
    isAuthenticated,

    // Timer control methods
    startQuickTimer,
    startShortBreak,
    startLongBreak
  }
}