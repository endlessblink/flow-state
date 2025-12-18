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

  // Cross-tab sync state (same browser)
  let crossTabSync: ReturnType<typeof useCrossTabSync> | null = null
  const isLeader = ref(false) // Whether this tab controls the timer
  let crossTabInitialized = false

  // Cross-device sync state (different browsers/devices via CouchDB)
  const DEVICE_LEADER_TIMEOUT_MS = 5000  // 5 seconds - consider leader stale after this
  const DEVICE_HEARTBEAT_INTERVAL_MS = 2000  // 2 seconds - send heartbeat

  // Get or create device ID (persisted in localStorage)
  const getDeviceId = (): string => {
    if (typeof window === 'undefined') return 'server'
    const stored = localStorage.getItem('pomoflow-device-id')
    if (stored) return stored
    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('pomoflow-device-id', newId)
    return newId
  }

  const deviceId = getDeviceId()
  const isDeviceLeader = ref(false) // Whether this device controls the timer
  let deviceHeartbeatInterval: ReturnType<typeof setInterval> | null = null
  let crossDeviceSyncInitialized = false

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

  // ============================================
  // CROSS-DEVICE SYNC (CouchDB) - TASK-021
  // ============================================

  /**
   * Handle timer updates from remote devices (via CouchDB sync)
   */
  const handleRemoteTimerUpdate = async (remoteDoc: any) => {
    // If we're the device leader and this is our own update, ignore
    if (isDeviceLeader.value && remoteDoc.deviceLeaderId === deviceId) {
      return
    }

    // Check if remote leader is still active (heartbeat within timeout)
    const elapsed = Date.now() - (remoteDoc.deviceLeaderLastSeen || 0)
    const remoteLeaderActive = elapsed < DEVICE_LEADER_TIMEOUT_MS

    // If there's an active remote leader that's not us, become a follower
    if (remoteDoc.deviceLeaderId &&
        remoteDoc.deviceLeaderId !== deviceId &&
        remoteLeaderActive) {

      console.log('🔄 [TIMER CROSS-DEVICE] Syncing with remote device leader:', remoteDoc.deviceLeaderId)
      isDeviceLeader.value = false
      stopDeviceHeartbeat()

      // Stop local timer interval - we're now a follower
      if (timerInterval.value) {
        clearInterval(timerInterval.value)
        timerInterval.value = null
      }

      // Update local state from remote
      if (remoteDoc.session) {
        currentSession.value = {
          ...remoteDoc.session,
          startTime: new Date(remoteDoc.session.startTime),
          completedAt: remoteDoc.session.completedAt ? new Date(remoteDoc.session.completedAt) : undefined
        }
      } else {
        currentSession.value = null
      }
    }
  }

  /**
   * Set up listener for CouchDB sync changes
   */
  const setupCrossDeviceSync = () => {
    if (crossDeviceSyncInitialized || typeof window === 'undefined') return

    const handleRemoteSyncChange = async (event: CustomEvent) => {
      try {
        const { documents } = event.detail || {}
        if (!documents || !Array.isArray(documents)) return

        // Look for timer session document
        const timerDoc = documents.find((doc: any) =>
          doc._id === 'pomo-flow-timer-session:data'
        )

        if (timerDoc) {
          console.log('📡 [TIMER CROSS-DEVICE] Received remote timer update')
          await handleRemoteTimerUpdate(timerDoc)
        }
      } catch (error) {
        console.warn('⚠️ [TIMER CROSS-DEVICE] Error handling sync change:', error)
      }
    }

    window.addEventListener('reliable-sync-change', handleRemoteSyncChange as EventListener)
    crossDeviceSyncInitialized = true
    console.log('✅ [TIMER CROSS-DEVICE] Cross-device sync initialized (listening for CouchDB changes)')
  }

  /**
   * Save timer session with device leadership info for cross-device sync
   */
  const saveTimerSessionWithLeadership = async () => {
    try {
      // Wait for database to be ready
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (currentSession.value) {
        const sessionData = {
          session: {
            ...currentSession.value,
            startTime: currentSession.value.startTime.toISOString(),
            completedAt: currentSession.value.completedAt?.toISOString()
          },
          deviceLeaderId: deviceId,
          deviceLeaderLastSeen: Date.now()
        }
        await db.save('pomo-flow-timer-session', sessionData)
      } else {
        // Clear session but keep device info for cleanup
        await db.save('pomo-flow-timer-session', {
          session: null,
          deviceLeaderId: null,
          deviceLeaderLastSeen: null
        })
      }
    } catch (error) {
      console.warn('⚠️ [TIMER CROSS-DEVICE] Failed to save session with leadership:', error)
    }
  }

  /**
   * Start device heartbeat to maintain leadership across devices
   */
  const startDeviceHeartbeat = () => {
    if (deviceHeartbeatInterval) clearInterval(deviceHeartbeatInterval)

    deviceHeartbeatInterval = setInterval(async () => {
      // Only send heartbeat if we're the device leader with an active session
      if (!currentSession.value || !isDeviceLeader.value) {
        stopDeviceHeartbeat()
        return
      }

      // Save session with updated heartbeat timestamp
      await saveTimerSessionWithLeadership()
    }, DEVICE_HEARTBEAT_INTERVAL_MS)

    console.log('💓 [TIMER CROSS-DEVICE] Device heartbeat started (every ' + DEVICE_HEARTBEAT_INTERVAL_MS + 'ms)')
  }

  /**
   * Stop device heartbeat
   */
  const stopDeviceHeartbeat = () => {
    if (deviceHeartbeatInterval) {
      clearInterval(deviceHeartbeatInterval)
      deviceHeartbeatInterval = null
      console.log('💔 [TIMER CROSS-DEVICE] Device heartbeat stopped')
    }
  }

  /**
   * Check if another device is currently the leader
   */
  const checkForActiveDeviceLeader = async (): Promise<boolean> => {
    try {
      // Wait for database to be ready
      while (!db.isReady?.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const existingSession = await db.load<any>('pomo-flow-timer-session')

      if (existingSession?.deviceLeaderId && existingSession.deviceLeaderId !== deviceId) {
        const elapsed = Date.now() - (existingSession.deviceLeaderLastSeen || 0)
        if (elapsed < DEVICE_LEADER_TIMEOUT_MS) {
          console.log('⚠️ [TIMER CROSS-DEVICE] Another device is controlling the timer:', existingSession.deviceLeaderId)
          return true // Another active leader exists
        }
      }

      return false // No active leader or we are the leader
    } catch (error) {
      console.warn('⚠️ [TIMER CROSS-DEVICE] Error checking for device leader:', error)
      return false // Proceed with caution
    }
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
  const startTimer = async (taskId: string, duration?: number, isBreak: boolean = false) => {
    console.log('🍅 DEBUG startTimer called:', { taskId, duration, isBreak })

    // Initialize cross-tab sync if not already done
    initCrossTabSync()

    // CROSS-DEVICE CHECK: See if another device is controlling the timer
    const otherDeviceIsLeader = await checkForActiveDeviceLeader()
    if (otherDeviceIsLeader) {
      console.warn('⚠️ [TIMER CROSS-DEVICE] Cannot start - another device is controlling the timer')
      return // Don't start - another device has leadership
    }

    // Claim timer leadership (same-browser tabs)
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

    // CROSS-DEVICE: Claim device leadership and start heartbeat
    isDeviceLeader.value = true
    startDeviceHeartbeat()

    console.log('🍅 DEBUG: Timer session created:', {
      id: currentSession.value!.id,
      taskId,
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak,
      computedIsActive: isTimerActive.value,
      deviceId,
      isDeviceLeader: isDeviceLeader.value
    })

    // Broadcast to other tabs (same browser)
    broadcastSession()

    // Save with device leadership info for cross-device sync
    await saveTimerSessionWithLeadership()

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

  const stopTimer = async () => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // CROSS-DEVICE: Clean up device leadership
    stopDeviceHeartbeat()
    isDeviceLeader.value = false

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

      // Clear device leadership in database
      await saveTimerSessionWithLeadership()
    }
  }

  const completeSession = async () => {
    if (!currentSession.value!) return

    // Clear interval
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // CROSS-DEVICE: Stop heartbeat (but don't release leadership yet - auto-transition may reclaim)
    stopDeviceHeartbeat()

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
    // Note: startTimer will re-claim device leadership when starting the next session
    if (settings.value.autoStartBreaks && !wasBreakSession) {
      // Just completed work session, start break
      // Release device leadership before auto-transition
      isDeviceLeader.value = false
      await saveTimerSessionWithLeadership()
      setTimeout(() => {
        startTimer('break', settings.value.shortBreakDuration, true)
      }, 2000) // 2-second delay for notification
    } else if (settings.value.autoStartPomodoros && wasBreakSession && lastTaskId !== 'break') {
      // Just completed break, restart work timer for same task
      // Release device leadership before auto-transition
      isDeviceLeader.value = false
      await saveTimerSessionWithLeadership()
      setTimeout(() => {
        startTimer(lastTaskId, settings.value.workDuration, false)
      }, 2000)
    } else {
      // No auto-transition - fully release device leadership
      isDeviceLeader.value = false
      await saveTimerSessionWithLeadership()
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

      // Initialize cross-tab sync for timer state (same browser)
      initCrossTabSync()

      // Initialize cross-device sync via CouchDB (different browsers/devices)
      setupCrossDeviceSync()
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
    isDeviceLeader, // Whether this device controls the timer (cross-device sync via CouchDB)

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