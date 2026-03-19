import { defineStore } from 'pinia'
import { ref, computed, reactive, onUnmounted, onScopeDispose } from 'vue'
import { useTaskStore } from './tasks'
import { useAuthStore } from './auth'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useSettingsStore } from './settings'
import { formatTime } from '@/utils/timer/formatTime'
import { getCrossTabSync } from '@/composables/useCrossTabSync'
import { useWakeLock } from '@/composables/useWakeLock'
import i18n from '@/i18n'

// TASK-1406: Extracted composables
import { useTimerAudio } from '@/composables/timer/useTimerAudio'
import { useTimerNotifications } from '@/composables/timer/useTimerNotifications'
import { useTimerSync, DEVICE_LEADER_TIMEOUT_MS } from '@/composables/timer/useTimerSync'
import { PENDING_WRITE_TIMEOUT_MS } from '@/config/timing'

const getT = () => (i18n.global as unknown as { t: (key: string) => string }).t

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
    claimLeadership,
  } = useSupabaseDatabase()

  const settingsStore = useSettingsStore()
  const taskStore = useTaskStore()
  const authStore = useAuthStore()

  // Track if we've loaded the timer session (to avoid re-loading on every auth change)
  const hasLoadedSession = ref(false)

  // Track if we've loaded today's pomodoro sessions from DB
  const hasLoadedTodaySessions = ref(false)

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

  // BUG-1318: Track recently completed session IDs to prevent stale Realtime events from resurrecting them
  const completedSessionIds = new Set<string>()
  // BUG-1318: Lock to prevent concurrent completeSession() calls
  let isCompleting = false

  // Cross-tab sync integration
  const crossTabSync = getCrossTabSync()

  // Wake Lock for PWA Mobile - ROAD-004
  const { requestWakeLock, releaseWakeLock } = useWakeLock()

  // ── TASK-1406: Extracted Composables ─────────────────────────────

  const audio = useTimerAudio({
    isEnabled: () => settings.playNotificationSounds
  })

  const notifications = useTimerNotifications({
    startTimer: (taskId: string, duration: number, isBreak: boolean) => startTimer(taskId, duration, isBreak),
    addExtraTime: (seconds: number) => addExtraTime(seconds),
    getSettings: () => ({ shortBreakDuration: settings.shortBreakDuration, workDuration: settings.workDuration }),
    findTaskTitle: (taskId: string) => taskStore.tasks.find(t => t.id === taskId)?.title
  })

  // Initialize SW listener on store creation
  notifications.setupServiceWorkerListener()

  const sync = useTimerSync({
    currentSession, completedSessions, isLeader, isDeviceLeader, hasLoadedSession,
    deviceId, completedSessionIds, crossTabSync,
    fetchActiveTimerSession, saveActiveTimerSession,
    claimLeadership,
    requestWakeLock, releaseWakeLock,
    authStore,
    onCountdownComplete: () => completeSession()
  })

  // ── Computed ─────────────────────────────────────────────────────

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
    const t = getT()
    const session = currentSession.value
    if (!session?.taskId) return null
    if (session.isBreak) return session.taskId === 'break' ? t('timer.break_time') : t('timer.short_break')
    if (session.taskId === 'general') return t('timer.focus_session')
    const task = taskStore.tasks.find(tk => tk.id === session.taskId)
    return task?.title || t('timer.unknown_task')
  })

  const sessionTypeIcon = computed(() => currentSession.value?.isBreak ? '🧎' : '🍅')

  const tabDisplayTime = computed(() => {
    if (!currentSession.value) return ''
    return formatTime(currentSession.value.remainingTime)
  })

  const sessionStatusText = computed(() => {
    const t = getT()
    const session = currentSession.value
    if (!session) return ''
    if (session.isBreak) return session.taskId === 'break' ? t('timer.short_break') : t('timer.long_break')
    if (session.taskId === 'general') return t('timer.focus_session')
    const task = taskStore.tasks.find(tk => tk.id === session.taskId)
    return task?.title || t('timer.work_session')
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

  // BUG-1112: Detect if KDE widget is actively connected (handling notifications)
  // When the widget is active, it shows its own notifications - we skip Tauri/browser notifications
  const isKdeWidgetActive = computed(() => {
    if (!currentSession.value) return false
    const session = currentSession.value
    if (session.deviceLeaderId !== 'kde-widget') return false

    // Check heartbeat freshness (< 30 seconds)
    if (!session.deviceLeaderLastSeen) return false
    const lastSeen = typeof session.deviceLeaderLastSeen === 'number'
      ? session.deviceLeaderLastSeen
      : new Date(session.deviceLeaderLastSeen).getTime()
    return (Date.now() - lastSeen) < DEVICE_LEADER_TIMEOUT_MS
  })

  const tabTitleWithTimer = computed(() => {
    const baseTitle = 'FlowState'
    if (!currentSession.value || !isTimerActive.value) return baseTitle
    const time = tabDisplayTime.value
    const icon = currentSession.value.isBreak ? '🧎' : '🍅'
    return `${icon} ${time} | ${baseTitle}`
  })

  // ── Database Initialization ──────────────────────────────────────

  /**
   * TASK-1577: Load today's completed Pomodoro sessions from database.
   * Only runs when user is authenticated and AI learning is enabled.
   * Populates completedSessions with sessions from pomodoro_history table.
   */
  const loadTodaySessionsFromDB = async (): Promise<void> => {
    // Guard: only load once per session
    if (hasLoadedTodaySessions.value) return

    // Guard: require auth and AI learning enabled
    if (!authStore.user?.id || !settingsStore.aiLearningEnabled) {
      hasLoadedTodaySessions.value = true
      return
    }

    try {
      const { fetchPomodoroHistory } = useSupabaseDatabase()

      // Query for today's sessions (sinceDaysAgo=0 to get only today)
      const todaySessions = await fetchPomodoroHistory(0)

      if (!todaySessions || todaySessions.length === 0) {
        hasLoadedTodaySessions.value = true
        return
      }

      // Map DB records to PomodoroSession shape
      const sessions: PomodoroSession[] = todaySessions.map((record: Record<string, unknown>) => ({
        id: crypto.randomUUID(), // DB doesn't store session IDs, generate new ones
        taskId: (record.taskId as string) || 'general',
        startTime: new Date(record.startedAt as string),
        duration: record.duration as number,
        remainingTime: 0, // Completed sessions have no remaining time
        isActive: false,
        isPaused: false,
        isBreak: record.isBreak as boolean,
        completedAt: new Date(record.completedAt as string)
      }))

      // Populate completedSessions with loaded records
      completedSessions.value = [...sessions, ...completedSessions.value]

      if (import.meta.env.DEV) {
        console.log(`🍅 [TIMER] Loaded ${sessions.length} completed sessions from DB for today`)
      }

      hasLoadedTodaySessions.value = true
    } catch (error) {
      console.warn('🍅 [TIMER] Failed to load today sessions from DB:', error)
      hasLoadedTodaySessions.value = true
    }
  }

  // TASK-1577: Set up watcher to load sessions when auth becomes available
  const unsubscribeAuth = authStore.$subscribe(
    (mutation, state) => {
      if (!hasLoadedTodaySessions.value && state.user?.id && settingsStore.aiLearningEnabled) {
        loadTodaySessionsFromDB()
      }
    },
    { deep: true, flush: 'post' }
  )

  // ── Timer Control Actions ────────────────────────────────────────

  /**
   * TASK-1287: Switch the timer's associated task without resetting the countdown.
   * Only changes the taskId on the running session and persists to DB.
   */
  const switchTimerTask = async (taskId: string) => {
    if (!currentSession.value) return
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] switchTimerTask:', { from: currentSession.value.taskId, to: taskId })
    }
    currentSession.value.taskId = taskId
    sync.broadcastSession()
    await sync.saveTimerSessionWithLeadership()
  }

  const startTimer = async (taskId: string, duration?: number, isBreak: boolean = false) => {
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] startTimer called:', { taskId, duration, isBreak })
    }

    // TASK-1287 + BUG-1294 + TASK-1466: If a work timer is active, NEVER reset — only switch task
    // Covers: running, paused, same task, different task — always preserve countdown
    if (currentSession.value?.isActive && !currentSession.value.isBreak && !isBreak) {
      if (currentSession.value.taskId !== taskId) {
        // Different task — switch association without resetting countdown
        await switchTimerTask(taskId)
      }
      // Same task or different task — either way, resume if paused
      if (currentSession.value.isPaused) {
        resumeTimer()
      }
      // Never reset the running timer
      return
    }

    // User's explicit action takes precedence - clear any existing session
    try {
      await sync.clearExistingSession()
    } catch (error) {
      console.warn('🍅 [TIMER] clearExistingSession failed, continuing anyway:', error)
      // Don't block timer start because of DB cleanup failure
    }

    const claimedLeadership = crossTabSync.claimTimerLeadership()
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] claimTimerLeadership:', claimedLeadership)
    }
    if (!claimedLeadership) {
      // BUG-1291: Don't silently abort for user-initiated timer starts
      // In single-window Tauri mode, stale leadership state shouldn't block the user
      console.warn('🍅 [TIMER] Leadership claim failed but proceeding - user action takes precedence')
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
    sync.pauseFollowerPoll() // Leaders don't poll, they write
    sync.resumeHeartbeat()
    sync.broadcastSession()
    await sync.saveTimerSessionWithLeadership()
    audio.playStartSound()
    sync.resumeCountdown()
    await requestWakeLock() // Keep screen on - ROAD-004
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] Timer started successfully, interval resumed')
    }

    // TASK-1439: Queue for offline-first sync (secondary persistence)
    try {
      const userId = authStore.user?.id
      if (userId && currentSession.value) {
        const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
        const { toSupabaseTimerSession } = await import('@/utils/supabaseMappers')
        const payload = toSupabaseTimerSession(currentSession.value, userId, deviceId)
        await useSyncOrchestrator().enqueue({
          entityType: 'timer_session',
          operation: 'create',
          entityId: currentSession.value.id,
          payload: JSON.parse(JSON.stringify(payload)),
          baseVersion: 0
        })
      }
    } catch (queueError) {
      console.warn('[SYNC-QUEUE] Failed to queue timer start:', queueError)
    }
  }

  const pauseTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = true
      sync.pauseCountdown()
      sync.broadcastSession()
      releaseWakeLock() // Allow sleep - ROAD-004
    }
  }

  const resumeTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = false
      sync.resumeCountdown()
      sync.broadcastSession()
      requestWakeLock() // Keep screen on - ROAD-004
    }
  }

  const stopTimer = async () => {
    sync.pauseCountdown()
    sync.pauseHeartbeat()
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
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] stopTimer: Saving stopped session to DB for cross-device sync', {
          sessionId: stoppedSession.id,
          isActive: stoppedSession.isActive,
          deviceId
        })
      }
      await saveActiveTimerSession(stoppedSession, deviceId)
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] stopTimer: Session saved to DB successfully')
      }

      // TASK-1439: Queue for offline-first sync
      try {
        const userId = authStore.user?.id
        if (userId) {
          const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
          const { toSupabaseTimerSession } = await import('@/utils/supabaseMappers')
          const payload = toSupabaseTimerSession(stoppedSession, userId, deviceId)
          await useSyncOrchestrator().enqueue({
            entityType: 'timer_session',
            operation: 'update',
            entityId: stoppedSession.id,
            payload: JSON.parse(JSON.stringify(payload)),
            baseVersion: 0
          })
        }
      } catch (queueError) {
        console.warn('[SYNC-QUEUE] Failed to queue timer stop:', queueError)
      }

      // Update local state
      completedSessions.value.push(stoppedSession)
      // BUG-1318: Track stopped session to prevent resurrection
      completedSessionIds.add(stoppedSession.id)
      setTimeout(() => completedSessionIds.delete(stoppedSession.id), PENDING_WRITE_TIMEOUT_MS)
      currentSession.value = null
      sync.broadcastSession() // For same-browser tabs
      sync.resumeFollowerPoll() // Resume polling to detect new sessions
    }
  }

  const completeSession = async () => {
    const session = currentSession.value
    // BUG-1318: Merged null-check with completion lock to prevent concurrent calls
    if (!session || isCompleting) return
    isCompleting = true

    try {
      // BUG: Capture KDE widget state BEFORE clearing currentSession
      // isKdeWidgetActive checks currentSession.value which gets set to null below
      const wasKdeWidgetActive = isKdeWidgetActive.value
      sync.pauseCountdown()
      sync.pauseHeartbeat()

      const completedSession = { ...session, isActive: false, completedAt: new Date() }
      completedSessions.value.push(completedSession)
      // BUG-1318: Track this session as completed to prevent stale Realtime resurrection
      completedSessionIds.add(session.id)
      // Clean up old entries after 2 minutes (they won't arrive later than that)
      setTimeout(() => completedSessionIds.delete(session.id), PENDING_WRITE_TIMEOUT_MS)

      // BUG-1185: Save completed state to DB - prevents sync from picking up stale active session
      // Previously only stopTimer() saved to DB, causing completeSession to leave is_active=true in Supabase
      try {
        const completedForDb: PomodoroSession = {
          ...completedSession,
          startTime: completedSession.startTime instanceof Date
            ? completedSession.startTime
            : new Date(completedSession.startTime),
        }
        await saveActiveTimerSession(completedForDb, deviceId)
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] completeSession: Saved completed state to DB', { sessionId: completedSession.id })
        }

        // TASK-1439: Queue for offline-first sync
        try {
          const userId = authStore.user?.id
          if (userId) {
            const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
            const { toSupabaseTimerSession } = await import('@/utils/supabaseMappers')
            const payload = toSupabaseTimerSession(completedForDb, userId, deviceId)
            await useSyncOrchestrator().enqueue({
              entityType: 'timer_session',
              operation: 'update',
              entityId: completedSession.id,
              payload: JSON.parse(JSON.stringify(payload)),
              baseVersion: 0
            })
          }
        } catch (queueError) {
          console.warn('[SYNC-QUEUE] Failed to queue timer complete:', queueError)
        }
      } catch (e) {
        console.warn('🍅 [TIMER] completeSession: Failed to save to DB (session may reappear on sync):', e)
      }

      // FEATURE-1317: Write pomodoro history for AI work profile analysis
      // Fire-and-forget — don't block timer flow
      if (settingsStore.aiLearningEnabled && !session.isBreak && session.taskId && session.taskId !== 'general') {
        const { insertPomodoroHistory } = useSupabaseDatabase()
        insertPomodoroHistory({
          taskId: session.taskId,
          duration: session.duration,
          isBreak: false,
          startedAt: session.startTime instanceof Date ? session.startTime : new Date(session.startTime),
          completedAt: new Date()
        }).catch(err => console.warn('[Timer] Failed to write pomodoro history:', err))
      }

      const wasBreak = session.isBreak
      const lastTaskId = session.taskId

      if (session.taskId && session.taskId !== 'general' && !session.isBreak) {
        // BUG-1354: Use _rawTasks to find task regardless of smart view filters.
        // taskStore.tasks is filtered — if a smart view is active, the task won't be
        // found and completedPomodoros won't increment.
        const task = taskStore._rawTasks.find(t => t.id === session.taskId)
        if (task) {
          const newCount = (task.completedPomodoros || 0) + 1
          taskStore.updateTask(session.taskId, {
            completedPomodoros: newCount,
            progress: Math.min(100, Math.round((newCount / (task.estimatedPomodoros || 1)) * 100))
          })

        }
      }

      currentSession.value = null
      sync.broadcastSession()
      audio.playEndSound()
      releaseWakeLock() // Allow sleep - ROAD-004

      // TASK-1009: Send notification via Service Worker for action buttons
      // Browser Notification API doesn't support action buttons - only SW notifications do
      await notifications.showTimerNotification(session.id, wasBreak, lastTaskId, wasKdeWidgetActive)

      // TASK-1009 + BUG-1315: Only the leader completes sessions.
      // Followers wait for Realtime. Auto-start removed per TASK-1009.
      // Old settings (autoStartBreaks, autoStartPomodoros) are now ignored for notifications
      isDeviceLeader.value = false
      // BUG-1318: Resume follower poll so we detect new sessions from other devices
      // Without this, the device becomes deaf after completing (not leading, not polling)
      sync.resumeFollowerPoll()
    } finally {
      // BUG-1318: ALWAYS release the lock, even if an error occurs mid-completion
      // Without this, any unhandled error would permanently block all future completions
      isCompleting = false
    }
  }

  const addExtraTime = async (seconds: number) => {
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] addExtraTime called:', { seconds })
    }

    // 1. Find the most recent completed session
    const lastSession = completedSessions.value[completedSessions.value.length - 1]
    if (!lastSession) {
      // Fallback: no session to extend, start fresh
      console.warn('🍅 [TIMER] addExtraTime: No recent session to extend, falling back to startTimer')
      await startTimer('general', seconds, false)
      return
    }

    // 2. Remove from completed list and tracking set
    completedSessions.value.pop()
    completedSessionIds.delete(lastSession.id)

    // 3. Revert pomodoro count if it was a work session with a real task
    if (!lastSession.isBreak && lastSession.taskId && lastSession.taskId !== 'general') {
      const task = taskStore._rawTasks.find(t => t.id === lastSession.taskId)
      if (task && (task.completedPomodoros || 0) > 0) {
        taskStore.updateTask(lastSession.taskId, {
          completedPomodoros: (task.completedPomodoros || 1) - 1,
          progress: Math.min(100, Math.round((((task.completedPomodoros || 1) - 1) / (task.estimatedPomodoros || 1)) * 100))
        })
      }
    }

    // 4. Restore as active session with extra time
    currentSession.value = {
      ...lastSession,
      duration: lastSession.duration + seconds,
      remainingTime: seconds,
      isActive: true,
      isPaused: false,
      completedAt: undefined,
      startTime: lastSession.startTime instanceof Date
        ? lastSession.startTime
        : new Date(lastSession.startTime)
    }

    // 5. Claim leadership & resume countdown
    isDeviceLeader.value = true
    isLeader.value = true
    sync.pauseFollowerPoll()
    sync.resumeHeartbeat()
    sync.broadcastSession()
    await sync.saveTimerSessionWithLeadership()
    sync.resumeCountdown()
    await requestWakeLock()

    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] addExtraTime: Session restored', {
        sessionId: currentSession.value.id,
        totalDuration: currentSession.value.duration,
        remainingTime: currentSession.value.remainingTime,
        taskId: currentSession.value.taskId
      })
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────
  // TASK-1151: Central cleanup function — pauses all intervals and removes event listeners.
  // Registered on BOTH onUnmounted (component lifecycle) and onScopeDispose (Pinia store
  // scope disposal via $dispose()) to ensure cleanup runs regardless of how the store is torn
  // down. useIntervalFn also registers tryOnScopeDispose internally, so intervals are
  // covered; this additionally cleans up the SW message listener and visibilitychange listener.
  const cleanupAllListeners = () => {
    sync.cleanup()
    notifications.cleanupServiceWorkerListener()
    unsubscribeAuth() // TASK-1577: Clean up auth watcher
  }

  onUnmounted(cleanupAllListeners)
  onScopeDispose(cleanupAllListeners)

  return {
    currentSession, completedSessions, sessions, settings,
    isLeader, isDeviceLeader, isKdeWidgetActive,
    isTimerActive, isPaused, currentTaskId, displayTime, currentTaskName,
    sessionTypeIcon, tabDisplayTime, sessionStatusText,
    timerPercentage, faviconStatus, tabTitleWithTimer,
    startTimer, switchTimerTask, pauseTimer, resumeTimer, stopTimer, completeSession, addExtraTime,
    requestNotificationPermission: notifications.requestNotificationPermission,
    playStartSound: audio.playStartSound,
    playEndSound: audio.playEndSound,
    // TASK-1009: Expose handler for app initialization to use in consolidated Realtime subscription
    handleRemoteTimerUpdate: sync.handleRemoteTimerUpdate,
    // BUG-1357: Expose for useAppInitialization recovery callback
    resyncFromDatabase: sync.resyncFromDatabase,
    // TASK-1577: Expose for manual load if needed
    loadTodaySessionsFromDB
  }
})
