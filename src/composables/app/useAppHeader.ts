import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useRouter, useRoute } from 'vue-router'

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
 * - Responsive design classes
 */

export function useAppHeader() {
  // Store dependencies
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()
  const authStore = useAuthStore()
  const uiStore = useUIStore()
  const route = useRoute()

  // ========== DYNAMIC PAGE TITLE ==========

  /**
   * Dynamic page title computation based on current view context
   * - Route-based views: Calendar, Canvas, Catalog, etc.
   * - Smart views: "Today", "This Week", "My Tasks", "All Tasks"
   * - Project views: Project name from task store
   * - Default: "Board"
   */
  const pageTitle = computed(() => {
    // Check route-based views first
    if (route.path === '/calendar') return 'Calendar'
    if (route.path === '/canvas') return 'Canvas'
    if (route.path === '/catalog') return 'Catalog'
    if (route.path === '/quick-sort') return 'Quick Sort'

    // Check smart views
    if (taskStore.activeSmartView === 'today') return 'Today'
    if (taskStore.activeSmartView === 'week') return 'This Week'
    if (taskStore.activeSmartView === 'uncategorized') return 'My Tasks'
    if (taskStore.activeSmartView === 'above_my_tasks') return 'All Tasks'

    // Check project views
    if (taskStore.activeProjectId) {
      const project = taskStore.getProjectById(taskStore.activeProjectId)
      return project?.name || 'Project'
    }

    return 'Board'
  })

  // ========== USER PROFILE STATE ==========

  /**
   * User authentication state for conditional profile display
   */
  const isAuthenticated = computed(() => authStore.isAuthenticated)

  // ========== TIMER INTEGRATION ==========

  /**
   * Timer control methods extracted from App.vue
   */
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

  const resumeTimer = () => {
    timerStore.resumeTimer()
  }

  const pauseTimer = () => {
    timerStore.pauseTimer()
  }

  const stopTimer = () => {
    timerStore.stopTimer()
  }

  // ========== TIMER STATE COMPUTED PROPERTIES ==========

  /**
   * Timer display state for UI rendering
   */
  const timerDisplayTime = computed(() => timerStore.displayTime)
  const currentTaskName = computed(() => timerStore.currentTaskName || '&nbsp;')
  const isTimerActive = computed(() => timerStore.isTimerActive)
  const isTimerPaused = computed(() => timerStore.isPaused)
  const currentSession = computed(() => timerStore.currentSession)
  const isBreakSession = computed(() => timerStore.currentSession?.isBreak)

  /**
   * Timer icon/emoticon based on current session state
   */
  const timerIcon = computed(() => {
    if (isTimerActive.value && !isBreakSession.value) {
      return '🍅' // Work session
    } else if (isTimerActive.value && isBreakSession.value) {
      return '🧎' // Break session
    }
    return null // Static Timer icon will be used in component when inactive
  })

  /**
   * CSS classes for timer display based on state
   */
  const timerDisplayClasses = computed(() => {
    const classes = ['timer-display']

    if (isTimerActive.value) {
      classes.push('timer-active')
    }

    if (isBreakSession.value) {
      classes.push('timer-break')
    }

    return classes.join(' ')
  })

  /**
   * CSS classes for timer container
   */
  const timerContainerClasses = computed(() => {
    const classes = ['timer-container']

    if (isTimerActive.value) {
      classes.push('active')
    }

    return classes.join(' ')
  })

  /**
   * Legacy timer state classes for backward compatibility
   */
  const timerClasses = computed(() => ({
    'timer-active': isTimerActive.value,
    'timer-break': isBreakSession.value
  }))

  // ========== BUTTON CONFIGURATION ==========

  /**
   * Primary timer button configuration based on current state
   */
  const primaryTimerButton = computed(() => {
    if (isTimerActive.value && !isTimerPaused.value) {
      return {
        icon: 'Pause',
        label: 'Pause',
        action: pauseTimer,
        variant: 'secondary'
      }
    }

    if (isTimerPaused.value) {
      return {
        icon: 'Play',
        label: 'Resume',
        action: resumeTimer,
        variant: 'primary'
      }
    }

    return {
      icon: 'Play',
      label: 'Start Quick Timer',
      action: startQuickTimer,
      variant: 'primary'
    }
  })

  /**
   * Secondary timer buttons for break options and controls
   */
  const secondaryTimerButtons = computed(() => {
    if (isTimerActive.value) {
      return [
        {
          icon: 'Square',
          label: 'Stop',
          action: stopTimer,
          variant: 'ghost'
        }
      ]
    }

    return [
      {
        icon: 'Coffee',
        label: 'Short Break',
        action: startShortBreak,
        variant: 'ghost'
      },
      {
        icon: 'Coffee',
        label: 'Long Break',
        action: startLongBreak,
        variant: 'ghost'
      }
    ]
  })

  // ========== HEADER CSS CLASSES ==========

  /**
   * Header section CSS classes for responsive behavior
   */
  const headerSectionClasses = computed(() => {
    const classes = ['header-section']

    // Add classes based on UI state
    if (uiStore.sidebarCollapsed) {
      classes.push('sidebar-collapsed')
    }

    return classes.join(' ')
  })

  /**
   * Control panel CSS classes with glass morphism styling
   */
  const controlPanelClasses = computed(() => {
    const classes = ['control-panel']

    if (isTimerActive.value) {
      classes.push('timer-active-panel')
    }

    return classes.join(' ')
  })

  // ========== EVENT HANDLERS ==========

  /**
   * Handle timer keyboard shortcuts
   * - Space: Start/Pause timer
   * - Ctrl/Cmd + S: Stop timer
   * - Ctrl/Cmd + B: Start short break
   */
  const handleTimerKeydown = (event: KeyboardEvent) => {
    // Prevent default behavior for timer shortcuts
    if (['Space', 'Enter'].includes(event.code)) {
      event.preventDefault()
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault()
        if (isTimerActive.value && !isTimerPaused.value) {
          pauseTimer()
        } else {
          primaryTimerButton.value.action()
        }
        break
      case 'KeyS':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          stopTimer()
        }
        break
      case 'KeyB':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          startShortBreak()
        }
        break
    }
  }

  return {
    // State
    pageTitle,
    isAuthenticated,
    isTimerActive,
    isTimerPaused,
    isBreakSession,
    currentTaskName,
    timerDisplayTime,
    currentSession,
    timerIcon,

    // CSS Classes
    timerDisplayClasses,
    timerContainerClasses,
    timerClasses, // Legacy compatibility
    headerSectionClasses,
    controlPanelClasses,

    // Button Configuration
    primaryTimerButton,
    secondaryTimerButtons,

    // Timer Control Methods
    startQuickTimer,
    startShortBreak,
    startLongBreak,
    resumeTimer,
    pauseTimer,
    stopTimer,

    // Event Handlers
    handleTimerKeydown
  }
}