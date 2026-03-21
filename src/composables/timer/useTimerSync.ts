/**
 * useTimerSync — Intervals, leadership, DB persistence, Realtime, init/resync
 * Extracted from src/stores/timer.ts (TASK-1406)
 */
import { watch, type Ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import type { PomodoroSession } from '@/stores/timer'
import type { getCrossTabSync } from '@/composables/useCrossTabSync'
import { PENDING_WRITE_TIMEOUT_MS } from '@/config/timing'

// Constants for device synchronization (moved from timer.ts)
const DEVICE_HEARTBEAT_INTERVAL_MS = 10000 // 10 seconds
export const DEVICE_LEADER_TIMEOUT_MS = 30000 // 30 seconds
// TASK-1009: Polling fallback for followers (mobile PWA Realtime WebSocket may fail)
// BUG-1122: Also check for stale leadership and take over if needed
// Polls every 3 seconds when not the leader to sync timer state
const FOLLOWER_POLL_INTERVAL_MS = 3000

/**
 * Row shape as returned by Supabase Realtime events
 */
interface TimerSessionRow {
  id: string
  task_id: string
  start_time: string
  duration: number
  remaining_time: number
  is_active: boolean | string | number // Handle Supabase quirks
  is_paused: boolean
  is_break: boolean
  completed_at?: string | null
  device_leader_id: string
  device_leader_last_seen: string
}

export interface TimerSyncDeps {
  // Reactive state (pass the actual refs, NOT .value)
  currentSession: Ref<PomodoroSession | null>
  completedSessions: Ref<PomodoroSession[]>
  isLeader: Ref<boolean>
  isDeviceLeader: Ref<boolean>
  hasLoadedSession: Ref<boolean>
  deviceId: string
  completedSessionIds: Set<string>

  // External stores/composables
  crossTabSync: ReturnType<typeof getCrossTabSync>
  fetchActiveTimerSession: () => Promise<PomodoroSession | null>
  saveActiveTimerSession: (session: PomodoroSession, deviceId: string) => Promise<void>
  // BUG-1511: Atomic leadership claim — returns true if this device was granted leadership
  claimLeadership: (sessionId: string, deviceId: string) => Promise<boolean>
  requestWakeLock: () => Promise<void>
  releaseWakeLock: () => void
  authStore: { isAuthenticated: boolean } // reactive

  // Callbacks for orchestration actions
  onCountdownComplete: () => void // calls completeSession
}

export function useTimerSync(deps: TimerSyncDeps) {
  const {
    currentSession, completedSessions, isLeader, isDeviceLeader,
    hasLoadedSession, deviceId, completedSessionIds,
    crossTabSync, fetchActiveTimerSession, saveActiveTimerSession,
    claimLeadership,
    requestWakeLock, releaseWakeLock, authStore,
    onCountdownComplete
  } = deps

  // ── Intervals ──────────────────────────────────────────────────────
  // CRITICAL: useIntervalFn calls MUST be at top level of composable for proper
  // Vue effect scope registration and cleanup.

  const { pause: pauseCountdown, resume: resumeCountdown } = useIntervalFn(() => {
    const session = currentSession.value
    if (session && session.isActive && !session.isPaused) {
      session.remainingTime -= 1
      if (session.remainingTime % 5 === 0 && isDeviceLeader.value) broadcastSession()
      if (session.remainingTime <= 0) {
        if (isDeviceLeader.value) {
          onCountdownComplete()
        } else {
          // BUG-1315: Followers must NOT call completeSession independently.
          // Pause local countdown and wait for leader's Realtime event.
          pauseCountdown()
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Follower reached 0 - pausing, waiting for leader completion via Realtime')
          }
        }
      }
    }
  }, 1000, { immediate: false })

  // BUG-1411: Guard against overlapping heartbeat saves when network is slow
  let isSaving = false
  const { pause: pauseHeartbeat, resume: resumeHeartbeat } = useIntervalFn(async () => {
    if (!currentSession.value || !isDeviceLeader.value) { pauseHeartbeat(); return }
    if (isSaving) return // BUG-1411: Prevent overlapping saves
    // BUG-352: Skip heartbeat save when offline to avoid "Failed to fetch" errors on mobile
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] Heartbeat: offline, skipping save')
      }
      return
    }
    isSaving = true
    try {
      // BUG-1511: Renew leadership lease atomically. If another device has stolen
      // the lease (race condition at startup), the RPC returns false and we demote.
      const stillLeader = await claimLeadership(currentSession.value.id, deviceId)
      if (!stillLeader) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Heartbeat: leadership lease lost — demoting to follower')
        }
        isDeviceLeader.value = false
        isLeader.value = false
        pauseHeartbeat()
        resumeFollowerPoll()
        return
      }
      await saveTimerSessionWithLeadership()
    } finally {
      isSaving = false
    }
  }, DEVICE_HEARTBEAT_INTERVAL_MS, { immediate: false })

  // BUG-TIMER-RACE: Guard that blocks follower poll and resync during the async startTimer sequence.
  // Without this, the follower poll can fire between clearExistingSession() and saveTimerSessionWithLeadership(),
  // find no active session (it was just cleared), and null out currentSession.
  let isStarting = false
  const setStartingGuard = (value: boolean) => { isStarting = value }

  // BUG-1411: Guard against overlapping polls when network is slow
  let isPolling = false
  let consecutiveFailures = 0
  const { pause: pauseFollowerPoll, resume: resumeFollowerPoll } = useIntervalFn(async () => {
    // Only poll if we're not the leader (leaders write, followers read)
    if (isDeviceLeader.value) return
    if (isStarting) return // BUG-TIMER-RACE: Block poll during async start sequence
    if (isPolling) return // BUG-1411: Prevent overlapping polls

    isPolling = true
    try {
      const session = await fetchActiveTimerSession()
      consecutiveFailures = 0 // BUG-1411: Reset failure counter on success

      if (!session) {
        // No active session - clear local state if we had one
        if (currentSession.value) {
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Follower poll: No active session found, clearing local state')
          }
          pauseCountdown()
          currentSession.value = null
        }
        return
      }

      // BUG-1122: Check for stale leadership and take over
      const lastSeen = session.deviceLeaderLastSeen || 0
      const timeSinceLeaderSeen = Date.now() - lastSeen
      const leaderIsStale = timeSinceLeaderSeen > DEVICE_LEADER_TIMEOUT_MS

      if (leaderIsStale && session.isActive) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Follower poll: Leader heartbeat stale by', Math.floor(timeSinceLeaderSeen / 1000), 'seconds - attempting atomic leadership claim')
        }

        // BUG-1511: Atomic CAS — only become leader if DB confirms the claim
        const granted = await claimLeadership(session.id, deviceId)
        if (!granted) {
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Follower poll: Leadership claim denied — another device beat us')
          }
          return
        }

        isDeviceLeader.value = true
        crossTabSync.claimTimerLeadership()
        isLeader.value = true

        // Update local session with drift correction
        const drift = Math.floor(timeSinceLeaderSeen / 1000)
        const adjustedTime = session.isPaused ? session.remainingTime : Math.max(0, session.remainingTime - Math.min(drift, 120))

        currentSession.value = {
          ...session,
          remainingTime: adjustedTime
        }

        // Heartbeat keeps leadership alive (claimLeadership already updated last_seen)
        resumeHeartbeat()
        pauseFollowerPoll() // Leaders don't poll

        if (session.isActive && !session.isPaused) {
          resumeCountdown()
          requestWakeLock()
        }
        return
      }

      // Session exists - check if it's the same as ours or different
      const isNewOrUpdated = !currentSession.value ||
        currentSession.value.id !== session.id ||
        currentSession.value.isActive !== session.isActive ||
        currentSession.value.isPaused !== session.isPaused

      if (isNewOrUpdated) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Follower poll: Session updated', {
            sessionId: session.id,
            isActive: session.isActive,
            isPaused: session.isPaused,
            remainingTime: session.remainingTime
          })
        }

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
          resumeCountdown()
        } else {
          pauseCountdown()
        }
      }
    } catch (err) {
      // BUG-1411: Track consecutive failures and back off if too many
      consecutiveFailures++
      console.warn('🍅 [TIMER] Follower poll error:', err)
      if (consecutiveFailures >= 3) {
        console.warn('🍅 [TIMER] Follower poll: 3 consecutive failures, backing off for 30s')
        pauseFollowerPoll()
        setTimeout(() => {
          consecutiveFailures = 0
          if (!isDeviceLeader.value && currentSession.value) {
            resumeFollowerPoll()
          }
        }, 30_000)
      }
    } finally {
      isPolling = false // BUG-1411: Always release the guard
    }
  }, FOLLOWER_POLL_INTERVAL_MS, { immediate: false })

  // ── Leadership Helpers ─────────────────────────────────────────────

  const broadcastSession = () => {
    if (currentSession.value) {
      crossTabSync.broadcastTimerSession(currentSession.value)
    }
  }

  const handleRemoteTimerUpdate = (payload: unknown) => {
    const rawPayload = payload as Record<string, unknown>

    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] handleRemoteTimerUpdate ENTRY - raw payload:', {
        hasPayload: !!payload,
        eventType: rawPayload?.eventType,
        table: rawPayload?.table,
        hasNew: !!rawPayload?.new,
        hasOld: !!rawPayload?.old,
        hasRecord: !!rawPayload?.record
      })
    }

    // Supabase realtime wraps data in { new: {...}, old: {...}, eventType: '...' }
    // Extract the actual record from the wrapper
    const newDoc = (rawPayload?.new || rawPayload?.record || rawPayload) as TimerSessionRow

    if (!newDoc || !newDoc.id) {
      // Handle DELETE events or empty payloads
      if (rawPayload?.eventType === 'DELETE' || rawPayload?.type === 'DELETE') {
        currentSession.value = null
        pauseCountdown()
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

    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] handleRemoteTimerUpdate received:', {
        sessionId: newDoc.id,
        is_active: newDoc.is_active,
        is_active_type: typeof newDoc.is_active,
        isSessionStopped,
        device_leader_id: newDoc.device_leader_id,
        ourDeviceId: deviceId,
        weAreLeader: isDeviceLeader.value
      })
    }

    if (isSessionStopped) {
      // BUG-1354: Only process stop events for our CURRENT session.
      // Stale echoes from cleared sessions (via clearExistingSession) arrive with
      // the old device_leader_id, bypassing the own-echo guard above.
      // Previously, this block unconditionally killed currentSession, destroying
      // a newly-started session when the echo for the OLD session arrived.
      if (currentSession.value && currentSession.value.id !== newDoc.id) {
        if (import.meta.env.DEV) {
          console.log('🍅 [BUG-1354] Ignoring stop echo for different session:', {
            stoppedSessionId: newDoc.id,
            currentSessionId: currentSession.value.id
          })
        }
        // Track as completed to prevent resurrection via stale heartbeat
        completedSessionIds.add(newDoc.id)
        setTimeout(() => completedSessionIds.delete(newDoc.id), PENDING_WRITE_TIMEOUT_MS)
        return
      }

      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] Remote stop received - clearing session', {
          sessionId: newDoc.id,
          stoppedBy: newDoc.device_leader_id,
          completedAt: newDoc.completed_at
        })
      }
      pauseCountdown()
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

    // BUG-1318: Prevent stale heartbeat events from resurrecting completed sessions
    if (completedSessionIds.has(newDoc.id)) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] Ignoring stale Realtime event for already-completed session:', newDoc.id)
      }
      return
    }

    // For active sessions, only process if leader is still fresh
    // TASK-1009 FIX: Only yield leadership if update is from a DIFFERENT device
    // Previously, any fresh update would stop our heartbeat, even our own echoed updates
    const updateFromDifferentDevice = newDoc.device_leader_id !== deviceId

    if (timeSinceLastSeen < DEVICE_LEADER_TIMEOUT_MS && updateFromDifferentDevice) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] Yielding leadership to:', newDoc.device_leader_id)
      }
      isDeviceLeader.value = false
      pauseHeartbeat()

      const session = {
        id: newDoc.id,
        taskId: newDoc.task_id,
        startTime: new Date(newDoc.start_time),
        duration: newDoc.duration,
        remainingTime: newDoc.remaining_time,
        isActive: !!newDoc.is_active,
        isPaused: !!newDoc.is_paused,
        isBreak: !!newDoc.is_break,
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
        resumeCountdown()
        requestWakeLock()
      } else {
        pauseCountdown()
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

        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Clearing existing session for new timer', {
            sessionId: existing.id,
            previousLeader: existing.deviceLeaderId,
            lastSeen: new Date(lastSeen).toISOString(),
            staleFor: Math.round(timeSinceLastSeen / 1000) + 's'
          })
        }

        // Mark the existing session as inactive - user's explicit action takes precedence
        try {
          const { supabase } = await import('@/services/auth/supabase')
          if (supabase) {
            await supabase
              .from('timer_sessions')
              .update({ is_active: false, completed_at: new Date().toISOString() })
              .eq('id', existing.id)

            // BUG-1354: Pre-track cleared session so its Realtime echo is ignored.
            // The echo arrives with the OLD device_leader_id (especially after page
            // reload where deviceId changes), bypassing the own-echo guard at line 345.
            // Without this, the echo unconditionally kills the newly-started session.
            completedSessionIds.add(existing.id)
            setTimeout(() => completedSessionIds.delete(existing.id), PENDING_WRITE_TIMEOUT_MS)
          }
        } catch (clearError) {
          console.warn('🍅 [TIMER] Failed to clear existing session:', clearError)
        }
      }
    } catch (_e) {
      console.error('🍅 [TIMER] Error clearing existing session:', _e)
    }
  }

  // ── Initialization ─────────────────────────────────────────────────

  const initializeSync = async () => {
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
          if (supabase) {
            await supabase
              .from('timer_sessions')
              .update({ is_active: false })
              .eq('id', saved.id)
          }
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

      // If timer already expired while app was closed, properly complete it (BUG-1512)
      if (adjustedRemainingTime <= 0) {
        console.log('🍅 [TIMER] Session already expired on load, completing with full credit', {
          sessionId: saved.id,
          originalRemaining: saved.remainingTime,
          driftApplied: saved.remainingTime - adjustedRemainingTime
        })
        // Restore the session with remainingTime=0 so completeSession() can find and process it.
        // This awards XP, increments pomodoro count, and writes pomodoro_history.
        currentSession.value = {
          ...saved,
          startTime: new Date(saved.startTime),
          remainingTime: 0
        }
        // onCountdownComplete calls completeSession() which handles DB, XP, and history.
        // completeSession() will set currentSession.value = null when done.
        onCountdownComplete()
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
        console.log('🍅 [TIMER] Attempting atomic leadership claim', {
          reason: saved.deviceLeaderId === deviceId ? 'same device' :
            !saved.deviceLeaderId ? 'no previous leader' :
              `previous leader timed out (${Math.round(timeSinceLeaderSeen / 1000)}s ago)`,
          newLeaderId: deviceId
        })

        // BUG-1511: Atomic CAS — only become leader if DB confirms the claim
        const granted = await claimLeadership(saved.id, deviceId)
        if (!granted) {
          console.log('🍅 [TIMER] Leadership claim denied on init — running as follower')
          isDeviceLeader.value = false
          resumeCountdown()
          resumeFollowerPoll()
        } else {
          isDeviceLeader.value = true
          // Claim cross-tab leadership
          crossTabSync.claimTimerLeadership()
          isLeader.value = true
          // Heartbeat keeps the lease alive going forward
          resumeHeartbeat()
          resumeCountdown()
        }
      } else {
        console.log('🍅 [TIMER] Running as follower, leader is still active', {
          leaderId: saved.deviceLeaderId,
          lastSeen: new Date(lastSeen).toISOString(),
          timeUntilTimeout: Math.round((DEVICE_LEADER_TIMEOUT_MS - timeSinceLastSeen) / 1000) + 's'
        })
        isDeviceLeader.value = false
        // Followers should also update their local countdown
        resumeCountdown()
        // TASK-1009: Start follower polling as backup for Realtime
        resumeFollowerPoll()
      }
    } else {
      // No active session - rely on Realtime subscription to detect new sessions
      // BUG-1085 FIX: Do NOT start follower poll when there's no session
      // Previously, this was polling every 3 seconds indefinitely, causing:
      // - Excessive API calls (even when timer isn't being used)
      // - Console log spam
      // - Potential rate limiting issues
      // Realtime subscription handles detecting new sessions from other devices.
      // Follower polling is only needed when we HAVE a session and are not the leader.
      console.log('🍅 [TIMER] No active session, waiting for Realtime to detect new sessions')
      // pauseFollowerPoll() is already the default state - don't start it here
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
              resumeCountdown()
            } else {
              pauseCountdown()
            }
          } else {
            currentSession.value = null
            pauseCountdown()
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

    // BUG-1357: Register visibility change handler for mobile PWA background recovery
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  // ── Resync & Visibility ────────────────────────────────────────────

  // BUG-1357: Re-sync timer state from database after mobile PWA returns from background
  // Mobile browsers freeze setInterval and kill WebSocket when backgrounded.
  // This method re-fetches the session and recalibrates local state.
  let lastResyncAt = 0
  const resyncFromDatabase = async () => {
    // Debounce: skip if called within 1 second
    const now = Date.now()
    if (now - lastResyncAt < 1000) return
    lastResyncAt = now

    if (isStarting) return // BUG-TIMER-RACE: Block resync during async start sequence
    if (!authStore.isAuthenticated) return

    try {
      const session = await fetchActiveTimerSession()

      if (!session) {
        // Timer was stopped by another device while we were in background
        if (currentSession.value) {
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Visibility recovery: No active session found, clearing stale local state')
          }
          pauseCountdown()
          pauseHeartbeat()
          pauseFollowerPoll()
          isDeviceLeader.value = false
          currentSession.value = null
          releaseWakeLock()
        }
        return
      }

      // Check leadership status
      const lastSeen = session.deviceLeaderLastSeen || 0
      const timeSinceLeaderSeen = Date.now() - lastSeen
      const leaderIsStale = timeSinceLeaderSeen > DEVICE_LEADER_TIMEOUT_MS

      if (leaderIsStale && session.isActive) {
        // Leader went away while we were backgrounded — attempt atomic claim
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Visibility recovery: Leader stale by', Math.floor(timeSinceLeaderSeen / 1000), 's — attempting atomic leadership claim')
        }

        // BUG-1511: Atomic CAS — only become leader if DB confirms the claim
        const granted = await claimLeadership(session.id, deviceId)
        if (!granted) {
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Visibility recovery: Leadership claim denied — running as follower')
          }
          // Another device grabbed leadership — sync as follower
          currentSession.value = { ...session }
          isDeviceLeader.value = false
          if (session.isActive && !session.isPaused) {
            resumeCountdown()
            resumeFollowerPoll()
          }
          return
        }

        isDeviceLeader.value = true
        crossTabSync.claimTimerLeadership()
        isLeader.value = true

        const drift = Math.floor(timeSinceLeaderSeen / 1000)
        const adjustedTime = session.isPaused ? session.remainingTime : Math.max(0, session.remainingTime - Math.min(drift, 120))

        currentSession.value = { ...session, remainingTime: adjustedTime }
        resumeHeartbeat()
        pauseFollowerPoll()

        if (session.isActive && !session.isPaused) {
          resumeCountdown()
          requestWakeLock()
        }
      } else {
        // Leader is fresh — run as follower with drift correction
        let adjustedTime = session.remainingTime
        if (session.deviceLeaderLastSeen && session.isActive && !session.isPaused) {
          const drift = Math.floor((Date.now() - session.deviceLeaderLastSeen) / 1000)
          if (drift > 0 && drift < 30) {
            adjustedTime = Math.max(0, session.remainingTime - drift)
          }
        }

        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Visibility recovery: Synced as follower', {
            sessionId: session.id,
            adjustedTime,
            originalTime: session.remainingTime,
            isActive: session.isActive,
            isPaused: session.isPaused
          })
        }

        currentSession.value = { ...session, remainingTime: adjustedTime }
        isDeviceLeader.value = false

        if (session.isActive && !session.isPaused) {
          resumeCountdown()
          resumeFollowerPoll()
        } else {
          pauseCountdown()
        }
      }
    } catch (err) {
      console.warn('🍅 [TIMER] Visibility recovery error:', err)
    }
  }

  // BUG-1357: Handle document visibility change (mobile PWA background/foreground)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && hasLoadedSession.value) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] Document became visible — triggering resync')
      }
      resyncFromDatabase()
    }
  }

  // ── Auth watcher ───────────────────────────────────────────────────
  // Watch for auth state changes - initialize when auth becomes ready
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated && !hasLoadedSession.value) {
        console.log('🍅 [TIMER] Auth became ready, initializing timer store...')
        initializeSync()
      }
    },
    { immediate: true }
  )

  // ── Cleanup ────────────────────────────────────────────────────────
  // TASK-1151: Central cleanup function — pauses all intervals and removes event listeners.
  const cleanup = () => {
    pauseCountdown()
    pauseHeartbeat()
    pauseFollowerPoll()
    // BUG-1357: Remove visibility change listener
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  return {
    // Called by timer.ts actions
    broadcastSession,
    saveTimerSessionWithLeadership,
    clearExistingSession,
    handleRemoteTimerUpdate,
    resyncFromDatabase,
    setStartingGuard,

    // Interval controls (needed by timer.ts pause/resume/stop)
    pauseCountdown,
    resumeCountdown,
    pauseHeartbeat,
    resumeHeartbeat,
    pauseFollowerPoll,
    resumeFollowerPoll,

    // Lifecycle
    cleanup
  }
}
