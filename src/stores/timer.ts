import { defineStore } from 'pinia'
import { ref, computed, reactive, onUnmounted, watch } from 'vue'
import { useTaskStore } from './tasks'
import { useAuthStore } from './auth'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useSettingsStore } from './settings'
import { formatTime } from '@/utils/timer/formatTime'
import { getCrossTabSync } from '@/composables/useCrossTabSync'
import { useIntervalFn } from '@vueuse/core'
import { useWakeLock } from '@/composables/useWakeLock'

/**
 * Timer Session Interface
 */
export interface PomodoroSession {
  id: string
  taskId: string
  startTime: Date
  duration: number
  remainingTime: number
  isActive: boolean
  isPaused: boolean
  isBreak: boolean
  completedAt?: Date
  deviceLeaderId?: string | null
  deviceLeaderLastSeen?: number | null
}

export const useTimerStore = defineStore('timer', () => {
  // Initialize database composable
  const {
    fetchActiveTimerSession,
    saveActiveTimerSession,
    initRealtimeSubscription
  } = useSupabaseDatabase()

  const settingsStore = useSettingsStore()
  const taskStore = useTaskStore()
  const authStore = useAuthStore()

  // Constants for device synchronization
  const DEVICE_HEARTBEAT_INTERVAL_MS = 10000 // 10 seconds
  const DEVICE_LEADER_TIMEOUT_MS = 30000 // 30 seconds

  // Track if we've loaded the timer session (to avoid re-loading on every auth change)
  const hasLoadedSession = ref(false)

  // Bridge to settingsStore for backward compatibility
  const settings = reactive({
    get workDuration() { return settingsStore.workDuration },
    set workDuration(val) { settingsStore.updateSetting('workDuration', val) },
    get shortBreakDuration() { return settingsStore.shortBreakDuration },
    set shortBreakDuration(val) { settingsStore.updateSetting('shortBreakDuration', val) },
    get longBreakDuration() { return settingsStore.longBreakDuration },
    set longBreakDuration(val) { settingsStore.updateSetting('longBreakDuration', val) },
    get autoStartBreaks() { return settingsStore.autoStartBreaks },
    set autoStartBreaks(val) { settingsStore.updateSetting('autoStartBreaks', val) },
    get autoStartPomodoros() { return settingsStore.autoStartPomodoros },
    set autoStartPomodoros(val) { settingsStore.updateSetting('autoStartPomodoros', val) },
    get playNotificationSounds() { return settingsStore.playNotificationSounds },
    set playNotificationSounds(val) { settingsStore.updateSetting('playNotificationSounds', val) }
  })

  // State
  const currentSession = ref<PomodoroSession | null>(null)
  const completedSessions = ref<PomodoroSession[]>([])
  const sessions = computed(() => completedSessions.value)
  const isLeader = ref(false)
  const isDeviceLeader = ref(false)
  const deviceId = crypto.randomUUID()

  // Cross-tab sync integration
  const crossTabSync = getCrossTabSync()

  // Wake Lock for PWA Mobile - ROAD-004
  const { requestWakeLock, releaseWakeLock } = useWakeLock()

  // Intervals
  const { pause: pauseTimerInterval, resume: resumeTimerInterval } = useIntervalFn(() => {
    const session = currentSession.value
    if (session && session.isActive && !session.isPaused) {
      session.remainingTime -= 1
      // Log every 10 seconds
      if (session.remainingTime % 10 === 0) {
        console.log('🍅 [TIMER] Tick:', session.remainingTime, 'seconds remaining')
      }
      if (session.remainingTime % 5 === 0 && isDeviceLeader.value) broadcastSession()
      if (session.remainingTime <= 0) completeSession()
    }
  }, 1000, { immediate: false })

  const { pause: pauseHeartbeat, resume: resumeHeartbeat } = useIntervalFn(async () => {
    if (!currentSession.value || !isDeviceLeader.value) { pauseHeartbeat(); return }
    await saveTimerSessionWithLeadership()
  }, DEVICE_HEARTBEAT_INTERVAL_MS, { immediate: false })

  // TASK-1009: Polling fallback for followers (mobile PWA Realtime WebSocket may fail)
  // Polls every 3 seconds when not the leader to sync timer state
  const FOLLOWER_POLL_INTERVAL_MS = 3000
  const { pause: pauseFollowerPoll, resume: resumeFollowerPoll } = useIntervalFn(async () => {
    // Only poll if we're not the leader (leaders write, followers read)
    if (isDeviceLeader.value) return

    try {
      const session = await fetchActiveTimerSession()

      if (!session) {
        // No active session - clear local state if we had one
        if (currentSession.value) {
          console.log('🍅 [TIMER] Follower poll: No active session found, clearing local state')
          pauseTimerInterval()
          currentSession.value = null
        }
        return
      }

      // Session exists - check if it's the same as ours or different
      const isNewOrUpdated = !currentSession.value ||
        currentSession.value.id !== session.id ||
        currentSession.value.isActive !== session.isActive ||
        currentSession.value.isPaused !== session.isPaused

      if (isNewOrUpdated) {
        console.log('🍅 [TIMER] Follower poll: Session updated', {
          sessionId: session.id,
          isActive: session.isActive,
          isPaused: session.isPaused,
          remainingTime: session.remainingTime
        })

        // Apply drift correction
        let adjustedTime = session.remainingTime
        if (session.deviceLeaderLastSeen && session.isActive && !session.isPaused) {
          const drift = Math.floor((Date.now() - session.deviceLeaderLastSeen) / 1000)
          if (drift > 0 && drift < 30) {
            adjustedTime = Math.max(0, session.remainingTime - drift)
          }
        }

        currentSession.value = {
          ...session,
          remainingTime: adjustedTime
        }

        if (session.isActive && !session.isPaused) {
          resumeTimerInterval()
        } else {
          pauseTimerInterval()
        }
      }
    } catch (err) {
      console.warn('🍅 [TIMER] Follower poll error:', err)
    }
  }, FOLLOWER_POLL_INTERVAL_MS, { immediate: false })

  // Computed
  const isTimerActive = computed(() => currentSession.value?.isActive || false)
  const isPaused = computed(() => currentSession.value?.isPaused || false)
  const currentTaskId = computed(() => currentSession.value?.taskId || null)

  const displayTime = computed(() => {
    if (!currentSession.value) {
      return formatTime(settings.workDuration)
    }
    return formatTime(currentSession.value.remainingTime)
  })

  const currentTaskName = computed(() => {
    const session = currentSession.value
    if (!session?.taskId) return null
    if (session.isBreak) return session.taskId === 'break' ? 'Break Time' : 'Short Break'
    if (session.taskId === 'general') return 'Focus Session'
    const task = taskStore.tasks.find(t => t.id === session.taskId)
    return task?.title || 'Unknown Task'
  })

  const sessionTypeIcon = computed(() => currentSession.value?.isBreak ? '🧎' : '🍅')

  const tabDisplayTime = computed(() => {
    if (!currentSession.value) return ''
    return formatTime(currentSession.value.remainingTime)
  })

  const sessionStatusText = computed(() => {
    const session = currentSession.value
    if (!session) return ''
    if (session.isBreak) return session.taskId === 'break' ? 'Short Break' : 'Long Break'
    if (session.taskId === 'general') return 'Focus Session'
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
    const baseTitle = 'FlowState'
    if (!currentSession.value || !isTimerActive.value) return baseTitle
    const time = tabDisplayTime.value
    const icon = currentSession.value.isBreak ? '🧎' : '🍅'
    return `${icon} ${time} | ${baseTitle}`
  })

  // Leadership Helpers
  const broadcastSession = () => {
    if (currentSession.value) {
      crossTabSync.broadcastTimerSession(currentSession.value)
    }
  }

  const handleRemoteTimerUpdate = (payload: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPayload = payload as any

    console.log('🍅 [TIMER] handleRemoteTimerUpdate ENTRY - raw payload:', {
      hasPayload: !!payload,
      eventType: rawPayload?.eventType,
      table: rawPayload?.table,
      hasNew: !!rawPayload?.new,
      hasOld: !!rawPayload?.old,
      hasRecord: !!rawPayload?.record
    })

    // Supabase realtime wraps data in { new: {...}, old: {...}, eventType: '...' }
    // Extract the actual record from the wrapper
    const newDoc = rawPayload?.new || rawPayload?.record || rawPayload

    if (!newDoc || !newDoc.id) {
      // Handle DELETE events or empty payloads
      if (rawPayload?.eventType === 'DELETE' || rawPayload?.type === 'DELETE') {
        currentSession.value = null
        pauseTimerInterval()
        releaseWakeLock()
      }
      return
    }

    // Skip our own updates when we're the leader
    if (isDeviceLeader.value && newDoc.device_leader_id === deviceId) return

    const lastSeen = new Date(newDoc.device_leader_last_seen).getTime()
    const timeSinceLastSeen = Date.now() - lastSeen

    // TASK-1009: Handle stopped sessions immediately regardless of timeout
    // When another device stops the timer, we should clear our local state
    // Note: Check for falsy is_active (false, 0, null, undefined) to handle various Supabase formats
    const isSessionStopped = newDoc.is_active === false || newDoc.is_active === 0 || newDoc.is_active === 'false'

    console.log('🍅 [TIMER] handleRemoteTimerUpdate received:', {
      sessionId: newDoc.id,
      is_active: newDoc.is_active,
      is_active_type: typeof newDoc.is_active,
      isSessionStopped,
      device_leader_id: newDoc.device_leader_id,
      ourDeviceId: deviceId,
      weAreLeader: isDeviceLeader.value
    })

    if (isSessionStopped) {
      console.log('🍅 [TIMER] Remote stop received - clearing session', {
        sessionId: newDoc.id,
        stoppedBy: newDoc.device_leader_id,
        completedAt: newDoc.completed_at
      })
      pauseTimerInterval()
      pauseHeartbeat()
      isDeviceLeader.value = false
      releaseWakeLock()

      // Add to completed sessions if not already there
      if (currentSession.value && currentSession.value.id === newDoc.id) {
        completedSessions.value.push({
          ...currentSession.value,
          isActive: false,
          completedAt: newDoc.completed_at ? new Date(newDoc.completed_at) : new Date()
        })
      }
      currentSession.value = null
      return
    }

    // For active sessions, only process if leader is still fresh
    // TASK-1009 FIX: Only yield leadership if update is from a DIFFERENT device
    // Previously, any fresh update would stop our heartbeat, even our own echoed updates
    const updateFromDifferentDevice = newDoc.device_leader_id !== deviceId

    if (timeSinceLastSeen < DEVICE_LEADER_TIMEOUT_MS && updateFromDifferentDevice) {
      console.log('🍅 [TIMER] Yielding leadership to:', newDoc.device_leader_id)
      isDeviceLeader.value = false
      pauseHeartbeat()

      const session = {
        id: newDoc.id,
        taskId: newDoc.task_id,
        startTime: new Date(newDoc.start_time),
        duration: newDoc.duration,
        remainingTime: newDoc.remaining_time,
        isActive: newDoc.is_active,
        isPaused: newDoc.is_paused,
        isBreak: newDoc.is_break,
        completedAt: newDoc.completed_at ? new Date(newDoc.completed_at) : undefined,
        deviceLeaderId: newDoc.device_leader_id,
        deviceLeaderLastSeen: lastSeen
      }

      // Calculate adjusted remaining time based on drift
      const now = Date.now()
      const drift = Math.floor((now - lastSeen) / 1000)
      if (session.isActive && !session.isPaused) {
        session.remainingTime = Math.max(0, session.remainingTime - drift)
      }

      currentSession.value = session as PomodoroSession
      if (session.isActive && !session.isPaused) {
        resumeTimerInterval()
        requestWakeLock()
      } else {
        pauseTimerInterval()
        releaseWakeLock()
      }
    }
  }

  const saveTimerSessionWithLeadership = async () => {
    if (!currentSession.value) return
    if (currentSession.value.id.length < 10) {
      currentSession.value.id = crypto.randomUUID()
    }
    // TASK-1009 FIX: Ensure startTime is a Date before saving
    // BroadcastChannel or other sources may pass string dates
    const sessionToSave: PomodoroSession = {
      ...currentSession.value,
      startTime: currentSession.value.startTime instanceof Date
        ? currentSession.value.startTime
        : new Date(currentSession.value.startTime),
      completedAt: currentSession.value.completedAt
        ? (currentSession.value.completedAt instanceof Date
            ? currentSession.value.completedAt
            : new Date(currentSession.value.completedAt))
        : undefined
    }
    await saveActiveTimerSession(sessionToSave, deviceId)
  }

  /**
   * Clears any existing active session so a new one can be started.
   * User action (clicking Start Timer) takes precedence over any other device.
   */
  const clearExistingSession = async (): Promise<void> => {
    try {
      const existing = await fetchActiveTimerSession()
      if (existing) {
        const lastSeen = existing.deviceLeaderLastSeen || 0
        const timeSinceLastSeen = Date.now() - lastSeen

        console.log('🍅 [TIMER] Clearing existing session for new timer', {
          sessionId: existing.id,
          previousLeader: existing.deviceLeaderId,
          lastSeen: new Date(lastSeen).toISOString(),
          staleFor: Math.round(timeSinceLastSeen / 1000) + 's'
        })

        // Mark the existing session as inactive - user's explicit action takes precedence
        try {
          const { supabase } = await import('@/services/auth/supabase')
          await supabase
            .from('timer_sessions')
            .update({ is_active: false, completed_at: new Date().toISOString() })
            .eq('id', existing.id)
        } catch (clearError) {
          console.warn('🍅 [TIMER] Failed to clear existing session:', clearError)
        }
      }
    } catch (_e) {
      console.error('🍅 [TIMER] Error clearing existing session:', _e)
    }
  }

  // Timer Control Actions
  const startTimer = async (taskId: string, duration?: number, isBreak: boolean = false) => {
    console.log('🍅 [TIMER] startTimer called:', { taskId, duration, isBreak })

    // User's explicit action takes precedence - clear any existing session
    await clearExistingSession()

    const claimedLeadership = crossTabSync.claimTimerLeadership()
    console.log('🍅 [TIMER] claimTimerLeadership:', claimedLeadership)
    if (!claimedLeadership) {
      console.warn('🍅 [TIMER] Blocked: Could not claim cross-tab leadership')
      return
    }
    isLeader.value = true

    const sessionDuration = duration || settings.workDuration
    currentSession.value = {
      id: crypto.randomUUID(),
      taskId,
      startTime: new Date(),
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak
    }

    isDeviceLeader.value = true
    pauseFollowerPoll() // Leaders don't poll, they write
    resumeHeartbeat()
    broadcastSession()
    await saveTimerSessionWithLeadership()
    playStartSound()
    resumeTimerInterval()
    await requestWakeLock() // Keep screen on - ROAD-004
    console.log('🍅 [TIMER] Timer started successfully, interval resumed')
  }

  const pauseTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = true
      pauseTimerInterval()
      broadcastSession()
      releaseWakeLock() // Allow sleep - ROAD-004
    }
  }

  const resumeTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = false
      resumeTimerInterval()
      broadcastSession()
      requestWakeLock() // Keep screen on - ROAD-004
    }
  }

  const stopTimer = async () => {
    pauseTimerInterval()
    pauseHeartbeat()
    isDeviceLeader.value = false
    releaseWakeLock() // Allow sleep - ROAD-004
    if (currentSession.value) {
      // Create stopped session with isActive: false
      // TASK-1009 FIX: Ensure startTime is a Date (may be string from BroadcastChannel)
      const stoppedSession: PomodoroSession = {
        ...currentSession.value,
        startTime: currentSession.value.startTime instanceof Date
          ? currentSession.value.startTime
          : new Date(currentSession.value.startTime),
        isActive: false,
        completedAt: new Date()
      }

      // TASK-1009: Save stopped state to DB - triggers Supabase Realtime for other devices
      // This ensures desktop app and KDE widget receive the stop event
      console.log('🍅 [TIMER] stopTimer: Saving stopped session to DB for cross-device sync', {
        sessionId: stoppedSession.id,
        isActive: stoppedSession.isActive,
        deviceId
      })
      await saveActiveTimerSession(stoppedSession, deviceId)
      console.log('🍅 [TIMER] stopTimer: Session saved to DB successfully')

      // Update local state
      completedSessions.value.push(stoppedSession)
      currentSession.value = null
      broadcastSession() // For same-browser tabs
      resumeFollowerPoll() // Resume polling to detect new sessions
    }
  }

  const completeSession = async () => {
    const session = currentSession.value
    if (!session) return
    pauseTimerInterval()
    pauseHeartbeat()

    const completedSession = { ...session, isActive: false, completedAt: new Date() }
    completedSessions.value.push(completedSession)

    const wasBreak = session.isBreak
    const lastTaskId = session.taskId

    if (session.taskId && session.taskId !== 'general' && !session.isBreak) {
      const task = taskStore.tasks.find(t => t.id === session.taskId)
      if (task) {
        const newCount = (task.completedPomodoros || 0) + 1
        taskStore.updateTask(session.taskId, {
          completedPomodoros: newCount,
          progress: Math.min(100, Math.round((newCount / (task.estimatedPomodoros || 1)) * 100))
        })
      }
    }

    currentSession.value = null
    broadcastSession()
    playEndSound()
    releaseWakeLock() // Allow sleep - ROAD-004

    // TASK-1009: Send notification via Service Worker for action buttons
    // Browser Notification API doesn't support action buttons - only SW notifications do
    await showTimerNotification(session.id, wasBreak, lastTaskId)

    // TASK-1009: Removed auto-start behavior
    // User must explicitly choose via notification action buttons
    // Old settings (autoStartBreaks, autoStartPomodoros) are now ignored for notifications
    isDeviceLeader.value = false
  }

  // TASK-1009: Service Worker Notification with Action Buttons
  const showTimerNotification = async (sessionId: string, wasBreak: boolean, taskId: string) => {
    // Get task name for notification body
    let taskName: string | undefined
    if (taskId && taskId !== 'general' && taskId !== 'break') {
      const task = taskStore.tasks.find(t => t.id === taskId)
      taskName = task?.title
    }

    // Try Service Worker notification first (supports action buttons)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TIMER_COMPLETE',
        sessionId,
        wasBreak,
        taskId,
        taskName
      })
      console.log('🍅 [TIMER] Sent TIMER_COMPLETE to service worker')
      return
    }

    // Fallback to basic Notification API (no action buttons)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Session Complete! 🍅', {
        body: wasBreak ? 'Ready to work?' : 'Time for a break!',
        icon: '/favicon.ico',
        tag: `timer-complete-${sessionId}`, // Deduplication
        requireInteraction: true
      })
    }
  }

  // TASK-1009: Handle messages from Service Worker (notification action clicks)
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    const data = event.data
    if (!data || !data.type) return

    console.log('🍅 [TIMER] Received SW message:', data.type, data)

    switch (data.type) {
      case 'START_BREAK':
        // Start a break session
        startTimer('break', settings.shortBreakDuration, true)
        break

      case 'START_WORK':
        // Start a work session (continue with the same task if available)
        const taskId = data.taskId && data.taskId !== 'break' ? data.taskId : 'general'
        startTimer(taskId, settings.workDuration, false)
        break

      case 'POSTPONE_5MIN':
        // Add 5 minutes and restart timer
        // Create a new session with 5 minutes
        const postponeTaskId = data.taskId || 'general'
        const isBreak = postponeTaskId === 'break'
        startTimer(postponeTaskId, 5 * 60, isBreak) // 5 minutes
        break
    }
  }

  // Register SW message listener on store initialization
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
  }

  const playStartSound = () => {
    if (!settings.playNotificationSounds) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain); gain.connect(audioContext.destination)
      osc.frequency.setValueAtTime(523, audioContext.currentTime)
      osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      osc.start(); osc.stop(audioContext.currentTime + 0.3)
    } catch (_e) {
      // Silently ignore audio initialization errors
    }
  }

  const playEndSound = () => {
    if (!settings.playNotificationSounds) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain); gain.connect(audioContext.destination)
      osc.frequency.setValueAtTime(783, audioContext.currentTime)
      osc.frequency.setValueAtTime(523, audioContext.currentTime + 0.3)
      gain.gain.setValueAtTime(0.1, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6)
      osc.start(); osc.stop(audioContext.currentTime + 0.6)
    } catch (_e) {
      // Silently ignore audio playback errors
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    return Notification.permission === 'granted'
  }

  const initializeStore = async () => {
    // Skip if not authenticated - we'll retry when auth becomes ready
    if (!authStore.isAuthenticated) {
      console.log('🍅 [TIMER] initializeStore - waiting for auth...')
      return
    }

    // Skip if we've already loaded in this session
    if (hasLoadedSession.value) {
      console.log('🍅 [TIMER] initializeStore - already loaded, skipping')
      return
    }

    console.log('🍅 [TIMER] initializeStore starting (auth ready)...')
    hasLoadedSession.value = true
    const saved = await fetchActiveTimerSession()
    console.log('🍅 [TIMER] fetchActiveTimerSession result:', saved ? {
      id: saved.id,
      isActive: saved.isActive,
      isPaused: saved.isPaused,
      remainingTime: saved.remainingTime,
      deviceLeaderId: saved.deviceLeaderId,
      deviceLeaderLastSeen: saved.deviceLeaderLastSeen ? new Date(saved.deviceLeaderLastSeen).toISOString() : null
    } : 'null')

    if (saved && saved.isActive) {
      // Check for very stale sessions (last heartbeat > 1 hour ago)
      // These are abandoned sessions that should be cleared, not completed
      const STALE_SESSION_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour
      const lastSeen = saved.deviceLeaderLastSeen || 0
      const timeSinceLastSeen = Date.now() - lastSeen

      if (timeSinceLastSeen > STALE_SESSION_THRESHOLD_MS) {
        console.log('🍅 [TIMER] Clearing stale/abandoned session (no activity for 1+ hour)', {
          sessionId: saved.id,
          lastSeen: new Date(lastSeen).toISOString(),
          staleFor: Math.round(timeSinceLastSeen / 1000 / 60) + ' minutes'
        })
        // Clear abandoned session from DB
        try {
          const { supabase } = await import('@/services/auth/supabase')
          await supabase
            .from('timer_sessions')
            .update({ is_active: false })
            .eq('id', saved.id)
        } catch (e) {
          console.warn('🍅 [TIMER] Failed to clear stale session:', e)
        }
        currentSession.value = null
        return // Don't restore abandoned sessions
      }

      // Apply drift correction for time elapsed since last update
      let adjustedRemainingTime = saved.remainingTime
      if (saved.deviceLeaderLastSeen && !saved.isPaused) {
        const driftSeconds = Math.floor(timeSinceLastSeen / 1000)
        if (driftSeconds > 0) {
          adjustedRemainingTime = Math.max(0, saved.remainingTime - driftSeconds)
          console.log('🍅 [TIMER] Applied drift correction:', driftSeconds, 'seconds, new remaining:', adjustedRemainingTime)
        }
      }

      // If timer already expired while app was closed, silently complete it (no beep)
      if (adjustedRemainingTime <= 0) {
        console.log('🍅 [TIMER] Session already expired on load, silently completing', {
          sessionId: saved.id,
          originalRemaining: saved.remainingTime,
          driftApplied: saved.remainingTime - adjustedRemainingTime
        })
        // Mark as complete in DB without playing sounds
        try {
          const { supabase } = await import('@/services/auth/supabase')
          await supabase
            .from('timer_sessions')
            .update({ is_active: false, completed_at: new Date().toISOString() })
            .eq('id', saved.id)
        } catch (e) {
          console.warn('🍅 [TIMER] Failed to mark expired session complete:', e)
        }
        currentSession.value = null
        return // Don't start timer interval for already-expired session
      }

      currentSession.value = {
        ...saved,
        startTime: new Date(saved.startTime),
        remainingTime: adjustedRemainingTime
      }

      // Check if we should take over leadership
      const leaderLastSeen = saved.deviceLeaderLastSeen || 0
      const timeSinceLeaderSeen = Date.now() - leaderLastSeen
      const shouldTakeOverLeadership = saved.deviceLeaderId === deviceId ||
        timeSinceLeaderSeen >= DEVICE_LEADER_TIMEOUT_MS ||
        !saved.deviceLeaderId

      if (shouldTakeOverLeadership) {
        console.log('🍅 [TIMER] Taking over leadership', {
          reason: saved.deviceLeaderId === deviceId ? 'same device' :
            !saved.deviceLeaderId ? 'no previous leader' :
              `previous leader timed out (${Math.round(timeSinceLeaderSeen / 1000)}s ago)`,
          newLeaderId: deviceId
        })
        isDeviceLeader.value = true
        // Claim cross-tab leadership
        crossTabSync.claimTimerLeadership()
        isLeader.value = true
        // Start heartbeat to update DB with our deviceId
        resumeHeartbeat()
        // Save immediately to claim leadership in DB
        await saveTimerSessionWithLeadership()
        resumeTimerInterval()
      } else {
        console.log('🍅 [TIMER] Running as follower, leader is still active', {
          leaderId: saved.deviceLeaderId,
          lastSeen: new Date(lastSeen).toISOString(),
          timeUntilTimeout: Math.round((DEVICE_LEADER_TIMEOUT_MS - timeSinceLastSeen) / 1000) + 's'
        })
        isDeviceLeader.value = false
        // Followers should also update their local countdown
        resumeTimerInterval()
        // TASK-1009: Start follower polling as backup for Realtime
        resumeFollowerPoll()
      }
    } else {
      // No active session - but still start follower polling to detect new sessions
      // TASK-1009: This ensures we pick up timers started on other devices
      console.log('🍅 [TIMER] No active session, starting follower poll to detect new sessions')
      resumeFollowerPoll()
    }

    // Set cross-tab callbacks
    crossTabSync.setTimerCallbacks({
      onSessionUpdate: (payload: unknown) => {
        // TASK-1009 FIX: BroadcastChannel serializes Date objects to strings
        // We need to convert them back to Date objects
        const rawSession = payload as PomodoroSession | null
        if (!isDeviceLeader.value) {
          if (rawSession) {
            // Convert date strings back to Date objects
            const session: PomodoroSession = {
              ...rawSession,
              startTime: rawSession.startTime instanceof Date
                ? rawSession.startTime
                : new Date(rawSession.startTime),
              completedAt: rawSession.completedAt
                ? (rawSession.completedAt instanceof Date
                    ? rawSession.completedAt
                    : new Date(rawSession.completedAt))
                : undefined
            }
            currentSession.value = session
            if (session.isActive && !session.isPaused) {
              resumeTimerInterval()
            } else {
              pauseTimerInterval()
            }
          } else {
            currentSession.value = null
            pauseTimerInterval()
          }
        }
      },
      onBecomeLeader: () => {
        isLeader.value = true
        isDeviceLeader.value = true
        resumeHeartbeat()
      },
      onLoseLeadership: () => {
        isLeader.value = false
        isDeviceLeader.value = false
        pauseHeartbeat()
      }
    })

    // TASK-1009: Realtime subscription is now handled by useAppInitialization
    // to avoid multiple calls to initRealtimeSubscription killing each other's channels.
    // The timer handler is exposed via getTimerRealtimeHandler() for app initialization to use.
  }

  // Cleanup
  onUnmounted(() => {
    pauseTimerInterval()
    pauseHeartbeat()
    pauseFollowerPoll()
    // TASK-1009: Remove SW message listener
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  })

  // Watch for auth state changes - initialize when auth becomes ready
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated && !hasLoadedSession.value) {
        console.log('🍅 [TIMER] Auth became ready, initializing timer store...')
        initializeStore()
      }
    },
    { immediate: true }
  )

  return {
    currentSession, completedSessions, sessions, settings,
    isLeader, isDeviceLeader,
    isTimerActive, isPaused, currentTaskId, displayTime, currentTaskName,
    sessionTypeIcon, tabDisplayTime, sessionStatusText,
    timerPercentage, faviconStatus, tabTitleWithTimer,
    startTimer, pauseTimer, resumeTimer, stopTimer, completeSession,
    requestNotificationPermission, playStartSound, playEndSound,
    // TASK-1009: Expose handler for app initialization to use in consolidated Realtime subscription
    handleRemoteTimerUpdate
  }
})
