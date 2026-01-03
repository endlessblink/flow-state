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

// Direct PouchDB changes feed for cross-device timer sync (TASK-021)
import { useTimerChangesSync } from '@/composables/useTimerChangesSync'
import { saveTimerSession, loadTimerSession, TIMER_DOC_ID } from '@/utils/individualTimerStorage'

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
        onSessionUpdate: (rawSession: unknown) => {
          const session = rawSession as PomodoroSession | null
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
   * Calculate the correct remaining time based on session start time
   * @param session - The timer session
   * @param leaderTimestamp - Optional: The leader's timestamp when the data was saved (for clock sync)
   */
  const calculateRemainingTime = (
    session: { startTime: Date; duration: number; isPaused: boolean; remainingTime?: number },
    leaderTimestamp?: number
  ): number => {
    if (session.isPaused && session.remainingTime !== undefined) {
      // If paused, use the stored remaining time
      return session.remainingTime
    }

    // If we have the leader's timestamp, calculate time offset for accurate sync
    // This handles clock differences between devices
    const now = Date.now()
    if (leaderTimestamp && leaderTimestamp > 0) {
      // Calculate how much time has passed since leader saved the document
      // This accounts for network latency and clock differences
      const timeSinceSave = now - leaderTimestamp
      // Use leader's perspective: startTime + duration - (time elapsed since save + leader's elapsed at save)
      const leaderElapsedAtSave = leaderTimestamp - session.startTime.getTime()
      const totalElapsed = leaderElapsedAtSave + timeSinceSave
      const remaining = Math.max(0, session.duration - Math.floor(totalElapsed / 1000))
      return remaining
    }

    // Fallback: Calculate based on local elapsed time since start
    const elapsedSeconds = Math.floor((now - session.startTime.getTime()) / 1000)
    const remaining = Math.max(0, session.duration - elapsedSeconds)
    return remaining
  }

  // Store the leader's timestamp for accurate time calculation in follower interval
  let lastLeaderTimestamp = 0

  /**
   * Start a follower interval to update the display (doesn't control timer, just updates UI)
   */
  const startFollowerInterval = () => {
    // Clear any existing interval first
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    timerInterval.value = setInterval(() => {
      if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused && !isDeviceLeader.value) {
        // Calculate and update remaining time based on start time
        // Use leader timestamp for accurate cross-device sync
        const newRemainingTime = calculateRemainingTime(currentSession.value, lastLeaderTimestamp)
        currentSession.value.remainingTime = newRemainingTime

        // If timer completed on follower, wait for leader to confirm
        if (newRemainingTime <= 0) {
          console.log('⏰ [TIMER CROSS-DEVICE] Timer appears complete on follower, waiting for leader confirmation')
        }
      } else if (!currentSession.value || !currentSession.value.isActive) {
        // No active session, stop follower interval
        if (timerInterval.value) {
          clearInterval(timerInterval.value)
          timerInterval.value = null
        }
      }
    }, 1000)

    console.log('👀 [TIMER CROSS-DEVICE] Follower display interval started')
  }

  /**
   * Handle timer updates from remote devices (via CouchDB sync)
   */
  interface RemoteTimerDoc {
    deviceLeaderId?: string
    deviceLeaderLastSeen?: number
    session?: PomodoroSession & { startTime: string | Date; completedAt?: string | Date }
    deleted?: boolean
  }
  const handleRemoteTimerUpdate = async (remoteDoc: RemoteTimerDoc) => {
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

      // Update local state from remote
      if (remoteDoc.session) {
        const startTime = new Date(remoteDoc.session.startTime)
        const session = {
          ...remoteDoc.session,
          startTime,
          completedAt: remoteDoc.session.completedAt ? new Date(remoteDoc.session.completedAt) : undefined
        }

        // Store leader timestamp for accurate time sync (handles clock differences)
        lastLeaderTimestamp = remoteDoc.deviceLeaderLastSeen || Date.now()

        // Calculate the correct remaining time based on start time and leader timestamp
        session.remainingTime = calculateRemainingTime(session, lastLeaderTimestamp)

        currentSession.value = session
        console.log('🔄 [TIMER CROSS-DEVICE] Updated session, remaining:', session.remainingTime, 'seconds, leader timestamp:', lastLeaderTimestamp)

        // Start follower interval to update display
        if (session.isActive && !session.isPaused) {
          startFollowerInterval()
        }
      } else {
        // Session cleared by leader
        if (timerInterval.value) {
          clearInterval(timerInterval.value)
          timerInterval.value = null
        }
        currentSession.value = null
        console.log('🔄 [TIMER CROSS-DEVICE] Session cleared by leader')
      }
    }
  }

  /**
   * Set up listener for CouchDB sync changes
   * TASK-021: Now uses direct PouchDB changes feed instead of unreliable sync events
   */
  const timerChangesSync = useTimerChangesSync()

  const setupCrossDeviceSync = () => {
    if (crossDeviceSyncInitialized || typeof window === 'undefined') return

    // Use direct PouchDB changes feed for real-time updates (TASK-021 fix)
    // This replaces the unreliable 'reliable-sync-change' event listener
    timerChangesSync.startListening(async (doc: unknown) => {
      const rawDoc = doc as Record<string, unknown>
      try {
        // Handle document deletion
        if (rawDoc.deleted) {
          console.log('📡 [TIMER CROSS-DEVICE] Timer document deleted remotely')
          if (timerInterval.value) {
            clearInterval(timerInterval.value)
            timerInterval.value = null
          }
          currentSession.value = null
          return
        }

        // FIXED (TASK-021): Changes feed passes raw PouchDB doc { _id, _rev, data: {...} }
        // We need to extract the nested data structure
        interface PouchChangeDoc {
          data?: RemoteTimerDoc
          deviceLeaderId?: string // Legacy format support
          session?: PomodoroSession // Legacy format support
        }

        const docData = rawDoc as unknown as PouchChangeDoc
        const timerData = docData.data || (docData.deviceLeaderId ? docData : undefined) as RemoteTimerDoc | undefined

        if (!timerData) {
          console.warn('⚠️ [TIMER CROSS-DEVICE] Received doc without data property:', rawDoc._id)
          return
        }

        console.log('📡 [TIMER CROSS-DEVICE] Received remote timer update via changes feed, leader:', timerData.deviceLeaderId)
        await handleRemoteTimerUpdate(timerData)
      } catch (error) {
        console.warn('⚠️ [TIMER CROSS-DEVICE] Error handling changes feed update:', error)
      }
    })

    crossDeviceSyncInitialized = true
    console.log('✅ [TIMER CROSS-DEVICE] Cross-device sync initialized (direct PouchDB changes feed)')
  }

  /**
   * Cleanup cross-device sync listener
   */
  const _cleanupCrossDeviceSync = () => {
    timerChangesSync.stopListening()
    crossDeviceSyncInitialized = false
    console.log('🧹 [TIMER CROSS-DEVICE] Cross-device sync cleaned up')
  }

  /**
   * Save timer session with device leadership info for cross-device sync
   * Uses direct PouchDB access with conflict resolution for reliable cross-device sync
   */
  const saveTimerSessionWithLeadership = async () => {
    const pouchDb = db.database.value
    if (!pouchDb) return

    await saveTimerSession(
      pouchDb as any,
      currentSession.value,
      deviceId,
      currentSession.value ? Date.now() : null
    )
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

      const existingDoc = await loadTimerSession(db.database.value as any)
      const existingSession = existingDoc?.data || existingDoc // Handle potential wrapping

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
    if (!currentSession.value) {
      const minutes = Math.floor(settings.value.workDuration / 60)
      return `${minutes.toString().padStart(2, '0')}:00`
    }

    const minutes = Math.floor(currentSession.value.remainingTime / 60)
    const seconds = currentSession.value.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const currentTaskName = computed(() => {
    const session = currentSession.value
    if (!session?.taskId) return null

    if (session.isBreak) {
      return session.taskId === 'break' ? 'Break Time' : 'Short Break'
    }

    if (session.taskId === 'general') return 'Focus Session'

    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === session.taskId)
    return task?.title || 'Unknown Task'
  })

  const sessionTypeIcon = computed(() => {
    return currentSession.value?.isBreak ? '🧎' : '🍅'
  })

  // Tab-friendly computed properties
  const tabDisplayTime = computed(() => {
    if (!currentSession.value) return ''
    const minutes = Math.floor(currentSession.value.remainingTime / 60)
    const seconds = currentSession.value.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const sessionStatusText = computed(() => {
    const session = currentSession.value
    if (!session) return ''
    if (session.isBreak) {
      return session.taskId === 'break' ? 'Short Break' : 'Long Break'
    }
    if (session.taskId === 'general') return 'Focus Session'

    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === session.taskId)
    return task?.title || 'Work Session'
  })

  const timerPercentage = computed(() => {
    if (!currentSession.value) return 0
    const totalDuration = currentSession.value.duration
    const remainingTime = currentSession.value.remainingTime
    return Math.round(((totalDuration - remainingTime) / totalDuration) * 100)
  })

  const faviconStatus = computed(() => {
    if (!currentSession.value) return 'inactive'
    return currentSession.value.isBreak ? 'break' : 'work'
  })

  const tabTitleWithTimer = computed(() => {
    const baseTitle = 'Pomo-Flow'
    if (!currentSession.value || !isTimerActive.value) {
      return baseTitle
    }

    const time = tabDisplayTime.value
    const icon = currentSession.value.isBreak ? '🧎' : '🍅'
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
    if (currentSession.value) {
      console.log('🍅 DEBUG: Stopping existing timer')
      stopTimer()
    }

    const sessionDuration = duration || settings.value.workDuration

    currentSession.value = {
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

    if (currentSession.value) {
      console.log('🍅 DEBUG: Timer session created:', {
        id: currentSession.value.id,
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
    }

    // Broadcast to other tabs (same browser)
    broadcastSession()

    // Save with device leadership info for cross-device sync
    await saveTimerSessionWithLeadership()

    // Play start sound
    playStartSound()

    // Start countdown
    const timerIntervalId = setInterval(() => {
      const session = currentSession.value
      if (session && session.isActive && !session.isPaused) {
        session.remainingTime -= 1

        // Broadcast every 5 seconds to reduce overhead (or on significant changes)
        if (session.remainingTime % 5 === 0) {
          broadcastSession()
        }

        if (session.remainingTime <= 0) {
          completeSession()
        }
      }
    }, 1000)
    timerInterval.value = timerIntervalId
  }

  const pauseTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = true
      // Broadcast pause to other tabs
      broadcastSession()
    }
  }

  const resumeTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = false
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

    if (currentSession.value) {
      // Save incomplete session
      completedSessions.value.push({
        ...currentSession.value,
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
    const session = currentSession.value
    if (!session) return

    // Clear interval
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // CROSS-DEVICE: Stop heartbeat (but don't release leadership yet - auto-transition may reclaim)
    stopDeviceHeartbeat()

    // Mark session as completed
    const completedSession = {
      ...session,
      isActive: false,
      completedAt: new Date()
    }

    completedSessions.value.push(completedSession)

    // Store session info for auto-transition
    const wasBreakSession = session.isBreak
    const lastTaskId = session.taskId
    const sessionType = wasBreakSession ? 'Break' : 'Work session'

    // Update task pomodoro count if this was a work session
    if (session.taskId && session.taskId !== 'general' && !session.isBreak) {
      const taskStore = useTaskStore()
      const task = taskStore.tasks.find(t => t.id === session.taskId)

      if (task) {
        const newCount = task.completedPomodoros + 1
        const newProgress = Math.min(100, Math.round((newCount / (task.estimatedPomodoros || 0)) * 100))

        taskStore.updateTask(session.taskId, {
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
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
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
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
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

  // No local saveTimerSession/loadTimerSession here - using imported ones

  // Debounced save to reduce PouchDB conflicts
  // Timer ticks every second but we only save periodically to reduce conflicts
  // Other devices calculate remainingTime from startTime anyway
  // Timer ticks every second but we only save every 5 seconds to reduce conflicts
  // Other devices calculate remainingTime from startTime anyway
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastSavedState: string | null = null

  const debouncedSaveTimerSession = () => {
    // Clear any pending save
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
    }

    // Get significant state (excludes remainingTime which changes every second)
    const significantState = currentSession.value ? JSON.stringify({
      id: currentSession.value.id,
      taskId: currentSession.value.taskId,
      isActive: currentSession.value.isActive,
      isPaused: currentSession.value.isPaused,
      isBreak: currentSession.value.isBreak,
      duration: currentSession.value.duration,
      startTime: currentSession.value.startTime.toISOString()
    }) : null

    // Save immediately if significant state changed (start/pause/stop)
    if (significantState !== lastSavedState) {
      lastSavedState = significantState
      saveTimerSessionWithLeadership()
      return
    }

    // Otherwise, debounce remainingTime-only changes to every 2 seconds (was 5s, refined for balance)
    // Minimal debounce for unified docs is 1s per user request
    saveDebounceTimer = setTimeout(() => {
      saveTimerSessionWithLeadership()
    }, 2000)
  }

  // Watch for session changes and save to PouchDB (debounced)
  watch(currentSession, () => {
    debouncedSaveTimerSession()
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

      // Load timer session from PouchDB (using individual document utility)
      if (db.database.value) {
        const saved = await loadTimerSession(db.database.value as any)
        const savedSession = saved?.session

        if (savedSession && savedSession.isActive) {
          // Rebuild session if active
          currentSession.value = {
            ...savedSession,
            startTime: new Date(savedSession.startTime),
            completedAt: savedSession.completedAt ? new Date(savedSession.completedAt) : undefined
          }

          // Check for device leadership (similar logic to old loadTimerSession but simplified)
          if (saved.deviceLeaderId === deviceId) {
            isDeviceLeader.value = true
            startDeviceHeartbeat()
            // Start local countdown
            timerInterval.value = setInterval(() => {
              if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused) {
                currentSession.value.remainingTime -= 1
                if (currentSession.value.remainingTime <= 0) completeSession()
              }
            }, 1000)
          } else {
            isDeviceLeader.value = false
            startFollowerInterval()
          }
        }
      }

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
}, {
  // Disable pinia-shared-state for timer store
  // Timer has custom cross-tab sync via useCrossTabSync and Date objects don't serialize properly
  share: {
    enable: false
  }
})