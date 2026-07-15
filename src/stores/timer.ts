import { defineStore } from 'pinia'
import { ref, computed, reactive, watch, onUnmounted, onScopeDispose } from 'vue'
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
import { syncLocalApiTimerSnapshot } from '@/composables/useLocalApiBridge'
import { supabase } from '@/services/auth/supabase'
import {
  CanonicalTimerCommandError,
  executeCanonicalTimerCommand,
  type CanonicalTimerCommandRequest,
  type CanonicalTimerReadBack,
} from '@/services/sync/canonicalTimerCommand'
import { useWorkspaceStore } from './workspace'

const LOCAL_API_TIMER_INACTIVE_HEARTBEAT_MS = 10_000

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
  workspaceId?: string | null
  canonicalRevision?: number
  canonicalPending?: boolean
}

export const useTimerStore = defineStore('timer', () => {
  // Initialize database composable
  const {
    fetchActiveTimerSession,
    claimLeadership,
    heartbeatTimerSession,
  } = useSupabaseDatabase()

  const settingsStore = useSettingsStore()
  const taskStore = useTaskStore()
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceStore()

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

  const fromCanonicalReadBack = (readBack: CanonicalTimerReadBack): PomodoroSession => ({
    id: readBack.id,
    workspaceId: readBack.workspaceId,
    taskId: readBack.taskId,
    startTime: new Date(readBack.startTime),
    duration: readBack.duration,
    remainingTime: readBack.remainingTime,
    isActive: readBack.isActive,
    isPaused: readBack.isPaused,
    isBreak: readBack.isBreak,
    completedAt: readBack.completedAt ? new Date(readBack.completedAt) : undefined,
    deviceLeaderId: readBack.deviceLeaderId,
    deviceLeaderLastSeen: Date.parse(readBack.canonicalUpdatedAt),
    canonicalRevision: readBack.canonicalRevision,
    canonicalPending: false,
  })

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
    findTaskTitle: (taskId: string) => taskStore._rawTasks.find(t => t.id === taskId)?.title
  })

  // Initialize SW listener on store creation
  notifications.setupServiceWorkerListener()

  const sync = useTimerSync({
    currentSession, completedSessions, isLeader, isDeviceLeader, hasLoadedSession,
    deviceId, completedSessionIds, crossTabSync,
    fetchActiveTimerSession,
    claimLeadership, heartbeatTimerSession,
    executeCanonicalCommand: request => executeCanonicalTimerCommand(supabase, request),
    queueCanonicalCommand: (request, projection) => queueCanonicalTimerCommand(request, projection),
    requestWakeLock, releaseWakeLock,
    authStore,
    onCountdownComplete: () => completeSession()
  })

  watch(
    currentSession,
    (session) => syncLocalApiTimerSnapshot(session, deviceId),
    { deep: true, flush: 'post', immediate: true },
  )

  const localApiInactiveHeartbeat = setInterval(() => {
    if (!currentSession.value) {
      syncLocalApiTimerSnapshot(null, deviceId)
    }
  }, LOCAL_API_TIMER_INACTIVE_HEARTBEAT_MS)

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
    // BUG: Use _rawTasks to find the task regardless of active filters/smart views
    const task = taskStore._rawTasks.find(tk => tk.id === session.taskId)
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
    const task = taskStore._rawTasks.find(tk => tk.id === session.taskId)
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

  const queueCanonicalTimerCommand = async (
    request: CanonicalTimerCommandRequest,
    projection: PomodoroSession,
  ) => {
    if (!authStore.user?.id) return
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    await useSyncOrchestrator().enqueue({
      entityType: 'timer_session',
      operation: request.action === 'start' ? 'create' : 'update',
      entityId: request.sessionId,
      payload: {
        id: projection.id,
        task_id: projection.taskId,
        is_active: projection.isActive,
        is_paused: projection.isPaused,
        is_break: projection.isBreak,
      },
      baseVersion: request.baseRevision,
      canonicalTimerCommand: request,
    })
  }

  const executeOrQueueTimerCommand = async (
    request: CanonicalTimerCommandRequest,
    projection: PomodoroSession,
    forceQueue = false,
  ): Promise<PomodoroSession> => {
    if (authStore.canSyncRemotely && !forceQueue) {
      try {
        const result = await executeCanonicalTimerCommand(supabase, request)
        for (const replaced of result.replacedSessions) {
          completedSessionIds.add(replaced.id)
        }
        return fromCanonicalReadBack(result.readBack)
      } catch (error) {
        if (!(error instanceof CanonicalTimerCommandError)
          || error.code !== 'canonical_timer_transport_failed') throw error
      }
    }
    if (authStore.user?.id) {
      await queueCanonicalTimerCommand(request, projection)
      return { ...projection, canonicalPending: true }
    }
    return projection
  }

  const applyCanonicalTimerReadBack = (readBack: CanonicalTimerReadBack) => {
    const session = fromCanonicalReadBack(readBack)
    if (session.isActive) {
      currentSession.value = session
      isDeviceLeader.value = session.deviceLeaderId === deviceId
      isLeader.value = isDeviceLeader.value
      if (isDeviceLeader.value) {
        sync.pauseFollowerPoll()
        sync.resumeHeartbeat()
      } else {
        sync.pauseHeartbeat()
        sync.resumeFollowerPoll()
      }
      if (session.isPaused) sync.pauseCountdown()
      else sync.resumeCountdown()
    } else {
      const index = completedSessions.value.findIndex(item => item.id === session.id)
      if (index >= 0) completedSessions.value[index] = session
      else completedSessions.value.push(session)
      completedSessionIds.add(session.id)
      if (currentSession.value?.id === session.id) currentSession.value = null
      sync.pauseCountdown()
      sync.pauseHeartbeat()
      sync.resumeFollowerPoll()
    }
    sync.broadcastSession()
  }

  const transitionRequest = (
    action: 'pause' | 'resume' | 'stop',
    session: PomodoroSession,
  ): CanonicalTimerCommandRequest => {
    const baseRevision = session.canonicalRevision
    if (!Number.isSafeInteger(baseRevision) || Number(baseRevision) < 1) {
      throw new CanonicalTimerCommandError(
        'invalid_timer_revision',
        'Canonical timer revision is unavailable; refresh the timer before changing it',
      )
    }
    return {
      operationId: `web:timer:${action}:${session.id}:${baseRevision}`,
      action,
      sessionId: session.id,
      baseRevision: Number(baseRevision),
      deviceId,
      workspaceId: session.workspaceId ?? workspaceStore.activeWorkspaceId ?? null,
      remainingSeconds: Math.max(0, Math.floor(session.remainingTime)),
    }
  }

  /**
   * TASK-1287: Switch the timer's associated task without resetting the countdown.
   * Only changes the taskId on the running session and persists to DB.
   */
  const switchTimerTask = async (taskId: string) => {
    const previous = currentSession.value ? { ...currentSession.value } : null
    if (!previous || previous.taskId === taskId) return
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] switchTimerTask:', { from: previous.taskId, to: taskId })
    }
    if (!authStore.user?.id) {
      currentSession.value = { ...previous, taskId }
      sync.broadcastSession()
      return
    }
    const baseRevision = previous.canonicalRevision
    if (!Number.isSafeInteger(baseRevision) || Number(baseRevision) < 1) {
      throw new CanonicalTimerCommandError('invalid_timer_revision', 'Canonical timer revision is unavailable')
    }
    const request: CanonicalTimerCommandRequest = {
      operationId: `web:timer:switch_task:${previous.id}:${baseRevision}`,
      action: 'switch_task', sessionId: previous.id, baseRevision: Number(baseRevision),
      deviceId, workspaceId: previous.workspaceId ?? workspaceStore.activeWorkspaceId ?? null,
      taskId, remainingSeconds: Math.max(0, Math.floor(previous.remainingTime)),
    }
    const projection = { ...previous, taskId, canonicalRevision: Number(baseRevision) + 1 }
    currentSession.value = projection
    sync.broadcastSession()
    try {
      currentSession.value = await executeOrQueueTimerCommand(request, projection, previous.canonicalPending)
      sync.broadcastSession()
    } catch (error) {
      currentSession.value = previous
      sync.broadcastSession()
      throw error
    }
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
        await resumeTimer()
      }
      // Never reset the running timer
      return
    }

    // BUG-TIMER-RACE: Set leadership state and starting guard before the
    // canonical round-trip. The guard prevents follower reconciliation from
    // clearing the optimistic in-flight state before its read-back arrives.
    sync.setStartingGuard(true)
    isDeviceLeader.value = true
    sync.pauseFollowerPoll() // Leaders don't poll, they write

    try {
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
      const sessionId = crypto.randomUUID()
      const startedAt = new Date()
      const workspaceId = workspaceStore.activeWorkspaceId ?? null
      const projection: PomodoroSession = {
        id: sessionId,
        workspaceId,
        taskId,
        startTime: startedAt,
        duration: sessionDuration,
        remainingTime: sessionDuration,
        isActive: true,
        isPaused: false,
        isBreak,
        deviceLeaderId: deviceId,
        deviceLeaderLastSeen: startedAt.getTime(),
        canonicalRevision: 1,
      }
      const request: CanonicalTimerCommandRequest = {
        operationId: `web:timer:start:${sessionId}:0`,
        action: 'start',
        sessionId,
        baseRevision: 0,
        deviceId,
        workspaceId,
        taskId,
        startedAt: startedAt.toISOString(),
        durationSeconds: sessionDuration,
        isBreak,
      }
      currentSession.value = await executeOrQueueTimerCommand(request, projection)

      if (!currentSession.value.canonicalPending) sync.resumeHeartbeat()
      sync.broadcastSession()
      audio.playStartSound()
      sync.resumeCountdown()
      await requestWakeLock() // Keep screen on - ROAD-004
    } catch (error) {
      sync.pauseCountdown()
      sync.pauseHeartbeat()
      isDeviceLeader.value = false
      isLeader.value = false
      currentSession.value = null
      sync.broadcastSession()
      sync.resumeFollowerPoll()
      releaseWakeLock()
      throw error
    } finally {
      sync.setStartingGuard(false)
    }
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] Timer started successfully, interval resumed')
    }

  }

  const pauseTimer = async () => {
    const previous = currentSession.value ? { ...currentSession.value } : null
    if (!previous || previous.isPaused) return
    const request = transitionRequest('pause', previous)
    const projection: PomodoroSession = {
      ...previous, isPaused: true, canonicalRevision: request.baseRevision + 1,
    }
    currentSession.value = projection
    sync.pauseCountdown()
    sync.broadcastSession()
    releaseWakeLock() // Allow sleep - ROAD-004
    try {
      currentSession.value = await executeOrQueueTimerCommand(request, projection, previous.canonicalPending)
      sync.broadcastSession()
    } catch (error) {
      currentSession.value = previous
      sync.resumeCountdown()
      requestWakeLock()
      sync.broadcastSession()
      throw error
    }
  }

  const resumeTimer = async () => {
    const previous = currentSession.value ? { ...currentSession.value } : null
    if (!previous || !previous.isPaused) return
    const request = transitionRequest('resume', previous)
    const projection: PomodoroSession = {
      ...previous, isPaused: false, canonicalRevision: request.baseRevision + 1,
    }
    currentSession.value = projection
    sync.resumeCountdown()
    sync.broadcastSession()
    requestWakeLock() // Keep screen on - ROAD-004
    try {
      currentSession.value = await executeOrQueueTimerCommand(request, projection, previous.canonicalPending)
      sync.broadcastSession()
    } catch (error) {
      currentSession.value = previous
      sync.pauseCountdown()
      releaseWakeLock()
      sync.broadcastSession()
      throw error
    }
  }

  const stopTimer = async () => {
    const previous = currentSession.value ? { ...currentSession.value } : null
    if (!previous) return
    const request = transitionRequest('stop', previous)
    const stoppedProjection: PomodoroSession = {
      ...previous,
      startTime: previous.startTime instanceof Date ? previous.startTime : new Date(previous.startTime),
      isActive: false,
      isPaused: false,
      completedAt: new Date(),
      canonicalRevision: request.baseRevision + 1,
    }
    sync.pauseCountdown()
    sync.pauseHeartbeat()
    isDeviceLeader.value = false
    releaseWakeLock() // Allow sleep - ROAD-004
    completedSessions.value.push(stoppedProjection)
    completedSessionIds.add(stoppedProjection.id)
    currentSession.value = null
    syncLocalApiTimerSnapshot(null, deviceId)
    sync.resumeFollowerPoll()

    try {
      const stopped = await executeOrQueueTimerCommand(request, stoppedProjection, previous.canonicalPending)
      const index = completedSessions.value.findIndex(session => session.id === stopped.id)
      if (index >= 0) completedSessions.value[index] = stopped
    } catch (error) {
      completedSessions.value = completedSessions.value.filter(session => session.id !== previous.id)
      completedSessionIds.delete(previous.id)
      currentSession.value = previous
      isDeviceLeader.value = true
      isLeader.value = true
      sync.pauseFollowerPoll()
      if (!previous.canonicalPending) sync.resumeHeartbeat()
      if (previous.isPaused) sync.pauseCountdown()
      else sync.resumeCountdown()
      sync.broadcastSession()
      throw error
    }
  }

  const completeSession = async () => {
    const session = currentSession.value
    // BUG-1318: Merged null-check with completion lock to prevent concurrent calls
    if (!session || isCompleting) return
    // BUG-1892: Idempotency per session id — never complete/notify the same session twice.
    // The follower poll / resync (useTimerSync) can re-adopt an expired-but-still-active
    // session row; without this guard completeSession re-fires the "Time for a break"
    // notification on every tick, looping until the app is closed. completedSessionIds is
    // now durable (the 2-minute self-delete below was removed), so this guard holds for the
    // life of the store. addExtraTime() intentionally clears the id to allow re-completion.
    if (completedSessionIds.has(session.id)) {
      if (currentSession.value?.id === session.id) {
        currentSession.value = null
        syncLocalApiTimerSnapshot(null, deviceId)
      }
      return
    }
    isCompleting = true

    try {
      // BUG: Capture KDE widget state BEFORE clearing currentSession
      // isKdeWidgetActive checks currentSession.value which gets set to null below
      const wasKdeWidgetActive = isKdeWidgetActive.value
      sync.pauseCountdown()
      sync.pauseHeartbeat()

      const stopRequest = transitionRequest('stop', session)
      const completedSession: PomodoroSession = {
        ...session,
        isActive: false,
        isPaused: false,
        completedAt: new Date(),
        canonicalRevision: stopRequest.baseRevision + 1,
      }
      const wasBreak = session.isBreak
      const lastTaskId = session.taskId
      completedSessions.value.push(completedSession)
      // BUG-1318: Track this session as completed to prevent stale Realtime resurrection.
      // BUG-1892: Keep the id DURABLY (no 2-minute self-delete). A completed session id is a
      // UUID that is never reused, so suppressing it for the store's lifetime is correct and
      // is what stops completeSession from re-firing the break notification when the poll/resync
      // re-adopts an expired-active row after the old 2-minute window elapsed. addExtraTime()
      // explicitly removes the id when the user extends a session.
      completedSessionIds.add(session.id)
      // Clear the local/Electron/KDE-facing timer before any remote completion work.
      // If Supabase, sync queueing, or notifications stall, the visible timer must not
      // remain active at 00:00 in both the app and the localhost KDE endpoint.
      currentSession.value = null
      syncLocalApiTimerSnapshot(null, deviceId)
      audio.playEndSound()
      releaseWakeLock() // Allow sleep - ROAD-004

      try {
        const canonicalCompletion = await executeOrQueueTimerCommand(
          stopRequest,
          completedSession,
          session.canonicalPending,
        )
        const completedIndex = completedSessions.value.findIndex(item => item.id === session.id)
        if (completedIndex >= 0) completedSessions.value[completedIndex] = canonicalCompletion
      } catch (e) {
        console.warn('🍅 [TIMER] completeSession: canonical stop was rejected:', e)
        completedSessions.value = completedSessions.value.filter(item => item.id !== session.id)
        completedSessionIds.delete(session.id)
        currentSession.value = { ...session, isPaused: true }
        isDeviceLeader.value = false
        isLeader.value = false
        sync.broadcastSession()
        sync.resumeFollowerPoll()
        return
      }

      // FEATURE-1317: Write pomodoro history for AI work profile analysis
      // Fire-and-forget — don't block timer flow
      if (authStore.canSyncRemotely && settingsStore.aiLearningEnabled && !session.isBreak && session.taskId && session.taskId !== 'general') {
        const { insertPomodoroHistory } = useSupabaseDatabase()
        insertPomodoroHistory({
          taskId: session.taskId,
          duration: session.duration,
          isBreak: false,
          startedAt: session.startTime instanceof Date ? session.startTime : new Date(session.startTime),
          completedAt: new Date()
        }).catch(err => console.warn('[Timer] Failed to write pomodoro history:', err))
      }

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

      sync.broadcastSession()

      // TASK-1009: Send notification via Service Worker for action buttons
      // Browser Notification API doesn't support action buttons - only SW notifications do
      await notifications.showTimerNotification(session.id, wasBreak, lastTaskId, wasKdeWidgetActive)

      // TASK-1009 + BUG-1315: Only the leader completes sessions.
      // Followers wait for Realtime. Auto-start removed per TASK-1009.
      // Old settings (autoStartBreaks, autoStartPomodoros) are now ignored for notifications
      isDeviceLeader.value = false
      // TASK-1790: Resume follower poll as the Realtime backstop after completion.
      // At 15s cadence (FOLLOWER_POLL_INTERVAL_MS) this is cheap and ensures the
      // device picks up the next session from another device even if Realtime drops.
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

    if (authStore.user?.id) {
      const baseRevision = lastSession.canonicalRevision
      if (!Number.isSafeInteger(baseRevision) || Number(baseRevision) < 1) {
        throw new CanonicalTimerCommandError('invalid_timer_revision', 'Canonical timer revision is unavailable')
      }
      const request: CanonicalTimerCommandRequest = {
        operationId: `web:timer:extend:${lastSession.id}:${baseRevision}`,
        action: 'extend', sessionId: lastSession.id, baseRevision: Number(baseRevision),
        deviceId, workspaceId: lastSession.workspaceId ?? workspaceStore.activeWorkspaceId ?? null,
        extensionSeconds: seconds,
      }
      const projection: PomodoroSession = {
        ...lastSession,
        duration: lastSession.duration + seconds,
        remainingTime: seconds,
        isActive: true,
        isPaused: false,
        completedAt: undefined,
        canonicalRevision: Number(baseRevision) + 1,
      }
      completedSessions.value.pop()
      completedSessionIds.delete(lastSession.id)
      try {
        currentSession.value = await executeOrQueueTimerCommand(request, projection, lastSession.canonicalPending)
      } catch (error) {
        completedSessions.value.push(lastSession)
        completedSessionIds.add(lastSession.id)
        currentSession.value = null
        throw error
      }
      isDeviceLeader.value = true
      isLeader.value = true
      sync.pauseFollowerPoll()
      if (!currentSession.value.canonicalPending) sync.resumeHeartbeat()
      sync.broadcastSession()
      sync.resumeCountdown()
      await requestWakeLock()
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
    clearInterval(localApiInactiveHeartbeat)
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
    applyCanonicalTimerReadBack,
    // BUG-1357: Expose for useAppInitialization recovery callback
    resyncFromDatabase: sync.resyncFromDatabase,
    // TASK-1577: Expose for manual load if needed
    loadTodaySessionsFromDB
  }
})
