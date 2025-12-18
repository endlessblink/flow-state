import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useTaskStore } from './tasks'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// Cross-tab sync imports - for timer synchronization across browser tabs
import {
  useCrossTabSync,
  type TimerSessionSync as _TimerSessionSync
} from '@/composables/useCrossTabSync'

export interface PomodoroSession {
  id: string
  taskId: string
  startTime: Date
  duration: number // in seconds
  remainingTime: number
  isActive: boolean
  isPaused: boolean
  isBreak: boolean
  completedAt?: Date
}

export const useTimerStore = defineStore('timer', () => {
  // Initialize database composable
  const db = useDatabase()

  // Default settings
  const defaultSettings = {
    workDuration: 20 * 60, // 20 minutes in seconds
    shortBreakDuration: 5 * 60, // 5 minutes
    longBreakDuration: 15 * 60, // 15 minutes
    autoStartBreaks: true,
    autoStartPomodoros: true,
    playNotificationSounds: true
  }

  // Load settings from PouchDB
  const loadSettings = async () => {
    try {
      // Wait for database to be ready
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const saved = await db.load(DB_KEYS.SETTINGS)
      return saved || defaultSettings
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.DATABASE,
        message: 'Failed to load timer settings from PouchDB',
        error: error as Error,
        context: { operation: 'loadSettings' },
        showNotification: false // Silent - using defaults
      })
      return defaultSettings
    }
  }

  // State
  const currentSession = ref<PomodoroSession | null>(null)
  const completedSessions = ref<PomodoroSession[]>([])
  const sessions = ref<PomodoroSession[]>([]) // Alias for completedSessions for compatibility
  const timerInterval = ref<NodeJS.Timeout | null>(null)

  // Cross-tab sync state
  let crossTabSync: ReturnType<typeof useCrossTabSync> | null = null
  const isLeader = ref(false) // Whether this tab controls the timer
  let crossTabInitialized = false

  // Initialize cross-tab sync for timer
  const initCrossTabSync = () => {
    if (crossTabInitialized || typeof window === 'undefined') return

    try {
      crossTabSync = useCrossTabSync()

      // Set up callbacks for cross-tab timer events
      crossTabSync.setTimerCallbacks({
        onSessionUpdate: (session: any) => {
          // Another tab updated the timer - sync local state
          if (!isLeader.value && session) {
            console.log('🔄 [TIMER SYNC] Received session update from leader:', session)
            currentSession.value = {
              ...session,
              startTime: new Date(session.startTime)
            }
          } else if (!isLeader.value && session === null) {
            console.log('🔄 [TIMER SYNC] Leader stopped timer')
            if (timerInterval.value) {
              clearInterval(timerInterval.value)
              timerInterval.value = null
            }
            currentSession.value = null
          }
        },
        onBecomeLeader: () => {
          console.log('👑 [TIMER SYNC] This tab is now the timer leader')
          isLeader.value = true
        },
        onLoseLeadership: () => {
          console.log('😔 [TIMER SYNC] This tab lost timer leadership')
          isLeader.value = false
          // Stop local interval - we're now a follower
          if (timerInterval.value) {
            clearInterval(timerInterval.value)
            timerInterval.value = null
          }
        }
      })

      crossTabInitialized = true
      console.log('✅ [TIMER SYNC] Cross-tab sync initialized for timer')
    } catch (error) {
      console.warn('⚠️ [TIMER SYNC] Failed to initialize cross-tab sync:', error)
    }
  }

  // Broadcast current session to other tabs
  const broadcastSession = () => {
    if (!crossTabSync || !isLeader.value) return

    const sessionData = currentSession.value ? {
      ...currentSession.value,
      startTime: currentSession.value.startTime.toISOString()
    } : null

    crossTabSync.broadcastTimerSession(sessionData)
  }

// Keep sessions in sync with completedSessions for compatibility
watch(completedSessions, (newSessions) => {
  sessions.value = [...newSessions]
}, { immediate: true, deep: true })

  // Settings with PouchDB persistence
  const settings = ref(defaultSettings)

  // Computed
  const isTimerActive = computed(() =>
    currentSession.value?.isActive && !currentSession.value?.isPaused
  )

  const isPaused = computed(() =>
    currentSession.value?.isPaused || false
  )

  const currentTaskId = computed(() =>
    currentSession.value?.taskId || null
  )

  const displayTime = computed(() => {
    if (!currentSession.value!) {
      const minutes = Math.floor(settings.value.workDuration / 60)
      return `${minutes.toString().padStart(2, '0')}:00`
    }

    const minutes = Math.floor(currentSession.value!.remainingTime / 60)
    const seconds = currentSession.value!.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const currentTaskName = computed(() => {
    if (!currentSession.value! || !currentSession.value!.taskId) return null

    if (currentSession.value!.isBreak) {
      return currentSession.value!.taskId === 'break' ? 'Break Time' : 'Short Break'
    }

    if (currentSession.value!.taskId === 'general') return 'Focus Session'

    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === currentSession.value!.taskId)
    return task?.title || 'Unknown Task'
  })

  const sessionTypeIcon = computed(() => {
    if (!currentSession.value!) return '🍅'
    return currentSession.value!.isBreak ? '🧎' : '🍅'
  })

  // Tab-friendly computed properties
  const tabDisplayTime = computed(() => {
    if (!currentSession.value!) return ''
    const minutes = Math.floor(currentSession.value!.remainingTime / 60)
    const seconds = currentSession.value!.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const sessionStatusText = computed(() => {
    if (!currentSession.value!) return ''
    if (currentSession.value!.isBreak) {
      return currentSession.value!.taskId === 'break' ? 'Short Break' : 'Long Break'
    }
    if (currentSession.value!.taskId === 'general') return 'Focus Session'

    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === currentSession.value!.taskId)
    return task?.title || 'Work Session'
  })

  const timerPercentage = computed(() => {
    if (!currentSession.value!) return 0
    const totalDuration = currentSession.value!.duration
    const remainingTime = currentSession.value!.remainingTime
    return Math.round(((totalDuration - remainingTime) / totalDuration) * 100)
  })

  const faviconStatus = computed(() => {
    if (!currentSession.value!) return 'inactive'
    return currentSession.value!.isBreak ? 'break' : 'work'
  })

  const tabTitleWithTimer = computed(() => {
    const baseTitle = 'Pomo-Flow'
    if (!currentSession.value! || !isTimerActive.value) {
      return baseTitle
    }

    const time = tabDisplayTime.value
    const icon = currentSession.value!.isBreak ? '🧎' : '🍅'
    const status = sessionStatusText.value
    return `${status} - ${time} ${icon} | ${baseTitle}`
  })

  // Actions
  const startTimer = (taskId: string, duration?: number, isBreak: boolean = false) => {
    console.log('🍅 DEBUG startTimer called:', { taskId, duration, isBreak })

    // Initialize cross-tab sync if not already done
    initCrossTabSync()

    // Claim timer leadership
    if (crossTabSync) {
      const claimed = crossTabSync.claimTimerLeadership()
      if (!claimed) {
        console.warn('⚠️ [TIMER] Could not claim leadership - another tab is controlling the timer')
        // Don't start if we can't claim leadership
        return
      }
      isLeader.value = true
    }

    // Stop any existing timer
    if (currentSession.value!) {
      console.log('🍅 DEBUG: Stopping existing timer')
      stopTimer()
    }

    const sessionDuration = duration || settings.value.workDuration

    currentSession.value! = {
      id: Date.now().toString(),
      taskId,
      startTime: new Date(),
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak
    }

    console.log('🍅 DEBUG: Timer session created:', {
      id: currentSession.value!.id,
      taskId,
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak,
      computedIsActive: isTimerActive.value
    })

    // Broadcast to other tabs
    broadcastSession()

    // Play start sound
    playStartSound()

    // Start countdown
    timerInterval.value = setInterval(() => {
      if (currentSession.value! && currentSession.value!.isActive && !currentSession.value!.isPaused) {
        currentSession.value!.remainingTime -= 1

        // Broadcast every 5 seconds to reduce overhead (or on significant changes)
        if (currentSession.value!.remainingTime % 5 === 0) {
          broadcastSession()
        }

        if (currentSession.value!.remainingTime <= 0) {
          completeSession()
        }
      }
    }, 1000)
  }

  const pauseTimer = () => {
    if (currentSession.value!) {
      currentSession.value!.isPaused = true
      // Broadcast pause to other tabs
      broadcastSession()
    }
  }

  const resumeTimer = () => {
    if (currentSession.value!) {
      currentSession.value!.isPaused = false
      // Broadcast resume to other tabs
      broadcastSession()
    }
  }

  const stopTimer = () => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    if (currentSession.value!) {
      // Save incomplete session
      completedSessions.value.push({
        ...currentSession.value!,
        isActive: false,
        completedAt: new Date()
      })

      currentSession.value = null

      // Broadcast stop to other tabs
      broadcastSession()
    }
  }

  const completeSession = () => {
    if (!currentSession.value!) return

    // Clear interval
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // Mark session as completed
    const completedSession = {
      ...currentSession.value!,
      isActive: false,
      completedAt: new Date()
    }

    completedSessions.value.push(completedSession)

    // Store session info for auto-transition
    const wasBreakSession = currentSession.value!.isBreak
    const lastTaskId = currentSession.value!.taskId
    const sessionType = wasBreakSession ? 'Break' : 'Work session'

    // Update task pomodoro count if this was a work session
    if (currentSession.value!.taskId && currentSession.value!.taskId !== 'general' && !currentSession.value!.isBreak) {
      const taskStore = useTaskStore()
      const task = taskStore.tasks.find(t => t.id === currentSession.value!.taskId)

      if (task) {
        const newCount = task.completedPomodoros + 1
        const newProgress = Math.min(100, Math.round((newCount / (task.estimatedPomodoros || 0)) * 100))

        taskStore.updateTask(currentSession.value!.taskId, {
          completedPomodoros: newCount,
          progress: newProgress
        })

        console.log(`Pomodoro completed for "${task.title}": ${newCount}/${task.estimatedPomodoros || 0}`)
      }
    }

    currentSession.value = null

    // Broadcast completion to other tabs
    broadcastSession()

    // Play completion sound
    playEndSound()

    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${sessionType} Complete! 🍅`, {
        body: wasBreakSession ? 'Ready to get back to work?' : 'Great work! Time for a break.',
        icon: '/favicon.ico'
      })
    }

    // Auto-transition: Work → Break → Work
    if (settings.value.autoStartBreaks && !wasBreakSession) {
      // Just completed work session, start break
      setTimeout(() => {
        startTimer('break', settings.value.shortBreakDuration, true)
      }, 2000) // 2-second delay for notification
    } else if (settings.value.autoStartPomodoros && wasBreakSession && lastTaskId !== 'break') {
      // Just completed break, restart work timer for same task
      setTimeout(() => {
        startTimer(lastTaskId, settings.value.workDuration, false)
      }, 2000)
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.COMPONENT,
          message: 'Timer notification permission request failed - must be called from user gesture',
          error: error as Error,
          context: { operation: 'requestNotificationPermission' },
          showNotification: false
        })
        return false
      }
    }
    return 'granted' === Notification.permission
  }

  // Sound effects using Web Audio API
  const playStartSound = () => {
    if (!settings.value.playNotificationSounds) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Pleasant ascending chime for start
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime) // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1) // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2) // G5

      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.INFO,
        category: ErrorCategory.COMPONENT,
        message: 'Audio not available for timer start sound',
        error: error as Error,
        context: { operation: 'playStartSound' },
        showNotification: false // Non-critical
      })
    }
  }

  const playEndSound = () => {
    if (!settings.value.playNotificationSounds) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Gentle completion bell
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime) // G5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15) // E5
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.3) // C5

      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.6)
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.INFO,
        category: ErrorCategory.COMPONENT,
        message: 'Audio not available for timer end sound',
        error: error as Error,
        context: { operation: 'playEndSound' },
        showNotification: false // Non-critical
      })
    }
  }

  // Persistence for timer session using PouchDB
  const saveTimerSession = async () => {
    try {
      // Wait for database to be ready
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (currentSession.value!) {
        const sessionData = {
          ...currentSession.value!,
          startTime: currentSession.value!.startTime.toISOString(),
          completedAt: currentSession.value!.completedAt?.toISOString()
        }
        await db.save('pomo-flow-timer-session', sessionData)
      } else {
        await db.remove('pomo-flow-timer-session')
      }
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.DATABASE,
        message: 'Failed to save timer session to PouchDB',
        error: error as Error,
        context: { operation: 'saveTimerSession' },
        showNotification: false // Non-critical for timer state
      })
    }
  }

  const loadTimerSession = async () => {
    try {
      // Wait for database to be ready
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const saved = await db.load('pomo-flow-timer-session')
      if (saved) {
        currentSession.value! = {
          id: (saved as any).id || 'default',
          taskId: (saved as any).taskId || '',
          startTime: new Date((saved as any).startTime || Date.now()),
          duration: (saved as any).duration || 25 * 60 * 1000,
          remainingTime: (saved as any).remainingTime || 25 * 60 * 1000,
          isActive: (saved as any).isActive || false,
          isPaused: (saved as any).isPaused || false,
          isBreak: (saved as any).isBreak || false,
          completedAt: (saved as any).completedAt ? new Date((saved as any).completedAt) : undefined
        }

        // Restart interval if timer was active
        if (currentSession.value!.isActive && !currentSession.value!.isPaused) {
          timerInterval.value = setInterval(() => {
            if (currentSession.value! && currentSession.value!.isActive && !currentSession.value!.isPaused) {
              currentSession.value!.remainingTime -= 1
              if (currentSession.value!.remainingTime <= 0) {
                completeSession()
              }
            }
          }, 1000)
        }
      }
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.DATABASE,
        message: 'Failed to load timer session from PouchDB',
        error: error as Error,
        context: { operation: 'loadTimerSession' },
        showNotification: false // Non-critical - timer starts fresh
      })
    }
  }

  // Watch for session changes and save to PouchDB
  watch(currentSession, () => {
    saveTimerSession()
  }, { deep: true })

  // Watch for settings changes and save to PouchDB
  watch(settings, async () => {
    // Wait for database to be ready
    while (!db.isReady?.value) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    await db.save(DB_KEYS.SETTINGS, settings.value)
  }, { deep: true })

  // Initialize store immediately (Pinia stores should not use lifecycle hooks)
  const initializeStore = async () => {
    try {
      // Load settings from PouchDB
      const loadedSettings = await loadSettings()
      settings.value = { ...defaultSettings, ...(loadedSettings as typeof defaultSettings) }

      // Load timer session from PouchDB
      await loadTimerSession()

      // Initialize cross-tab sync for timer state
      initCrossTabSync()
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.STATE,
        message: 'Timer store initialization failed',
        error: error as Error,
        context: { operation: 'initializeStore', store: 'timer' },
        showNotification: true,
        userMessage: 'Timer features may be limited'
      })
    }
  }

  // Initialize immediately
  initializeStore()

  return {
    // State
    currentSession,
    completedSessions,
    sessions,
    settings,
    isLeader, // Whether this tab controls the timer (cross-tab sync)

    // Computed
    isTimerActive,
    isPaused,
    currentTaskId,
    displayTime,
    currentTaskName,
    sessionTypeIcon,

    // Tab-friendly computed properties
    tabDisplayTime,
    sessionStatusText,
    timerPercentage,
    faviconStatus,
    tabTitleWithTimer,

    // Actions
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    completeSession,
    requestNotificationPermission,
    playStartSound,
    playEndSound
  }
})