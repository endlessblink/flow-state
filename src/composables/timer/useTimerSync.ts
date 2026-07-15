/**
 * useTimerSync — Intervals, leadership, DB persistence, Realtime, init/resync
 * Extracted from src/stores/timer.ts (TASK-1406)
 */
import { watch, type Ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import type { PomodoroSession } from '@/stores/timer'
import type { getCrossTabSync } from '@/composables/useCrossTabSync'
import { PENDING_WRITE_TIMEOUT_MS } from '@/config/timing'
import type {
  CanonicalTimerCommandRequest,
  CanonicalTimerCommandResult,
} from '@/services/sync/canonicalTimerCommand'
import { CanonicalTimerCommandError } from '@/services/sync/canonicalTimerCommand'

// Constants for device synchronization (moved from timer.ts)
const DEVICE_HEARTBEAT_INTERVAL_MS = 10000 // 10 seconds
export const DEVICE_LEADER_TIMEOUT_MS = 30000 // 30 seconds
// TASK-1009: Polling fallback for followers (mobile PWA Realtime WebSocket may fail)
// BUG-1122: Also check for stale leadership and take over if needed
// TASK-1790: Bumped from 3s to 15s and made the poll run continuously (even when no
// session is loaded locally) so it serves as a Realtime safety net. At 15s the cost
// is ~4 queries/min — well within BUG-1085's anti-spam intent, while restoring the
// ability to detect sessions started by another device when Realtime misses the INSERT.
const FOLLOWER_POLL_INTERVAL_MS = 15000

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
  workspace_id?: string | null
  canonical_revision?: number
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
  // BUG-1511: Atomic leadership claim — returns true if this device was granted leadership
  claimLeadership: (sessionId: string, deviceId: string) => Promise<boolean>
  heartbeatTimerSession: (sessionId: string, deviceId: string, remainingTime: number) => Promise<boolean>
  executeCanonicalCommand: (request: CanonicalTimerCommandRequest) => Promise<CanonicalTimerCommandResult>
  queueCanonicalCommand: (request: CanonicalTimerCommandRequest, projection: PomodoroSession) => Promise<void>
  requestWakeLock: () => Promise<void>
  releaseWakeLock: () => void
  authStore: { isAuthenticated: boolean; canSyncRemotely?: boolean } // reactive

  // Callbacks for orchestration actions
  onCountdownComplete: () => void // calls completeSession
}

export function useTimerSync(deps: TimerSyncDeps) {
  const {
    currentSession, completedSessions, isLeader, isDeviceLeader,
    hasLoadedSession, deviceId, completedSessionIds,
    crossTabSync, fetchActiveTimerSession,
    claimLeadership, heartbeatTimerSession, executeCanonicalCommand, queueCanonicalCommand,
    requestWakeLock, releaseWakeLock, authStore,
    onCountdownComplete
  } = deps

  const canUseRemoteTimerSync = () => authStore.canSyncRemotely ?? authStore.isAuthenticated

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
      if (!canUseRemoteTimerSync()) return
      const stillLeader = await heartbeatTimerSession(
        currentSession.value.id,
        deviceId,
        currentSession.value.remainingTime,
      )
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
    } finally {
      isSaving = false
    }
  }, DEVICE_HEARTBEAT_INTERVAL_MS, { immediate: false })

  // BUG-TIMER-RACE: Guard that blocks follower poll and resync during the
  // canonical start sequence, before the authoritative read-back is applied.
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
      if (!canUseRemoteTimerSync()) return
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
        // TASK-1790: Don't pause here. The poll is the Realtime backstop and must
        // keep running so we detect sessions started on another device when the
        // postgres_changes INSERT is dropped (websocket disconnect, cold-start race,
        // replication hiccup — all documented as expected conditions in BUG-1320).
        // At 15s cadence the idle cost is acceptable.
        return
      }

      // BUG-1897: never re-adopt a session this device already stopped or
      // completed. stopTimer clears local state BEFORE the remote save; if that
      // save fails the row stays is_active=true and this poll (which stopTimer
      // resumes) would resurrect the timer within one cycle. The Realtime path
      // has this guard (BUG-1318 below) — the poll paths must mirror it.
      if (completedSessionIds.has(session.id)) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Follower poll: Ignoring already-stopped session:', session.id)
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
      if (import.meta.env.DEV) {
        console.warn('🍅 [TIMER] Follower poll error:', err)
      }
      if (consecutiveFailures >= 3) {
        if (import.meta.env.DEV) {
          console.warn('🍅 [TIMER] Follower poll: 3 consecutive failures, backing off for 30s')
        }
        pauseFollowerPoll()
        setTimeout(() => {
          consecutiveFailures = 0
          // TASK-1790: Resume regardless of currentSession — the poll is the
          // Realtime backstop and needs to run even when idle.
          if (!isDeviceLeader.value) {
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

    // A queued canonical command is only a local projection until its exact
    // server row comes back.  Do not discard that receipt as an ordinary own
    // heartbeat echo: it is what makes the projection authoritative again.
    if (
      currentSession.value?.canonicalPending &&
      currentSession.value.id === newDoc.id &&
      newDoc.device_leader_id === deviceId
    ) {
      const previous = currentSession.value
      const serverRemainingTime = Number(newDoc.remaining_time)
      const remainingTime = Number.isFinite(serverRemainingTime)
        ? (previous.isActive && !previous.isPaused
          ? Math.min(previous.remainingTime, serverRemainingTime)
          : serverRemainingTime)
        : previous.remainingTime
      currentSession.value = {
        ...previous,
        taskId: newDoc.task_id ?? previous.taskId,
        startTime: newDoc.start_time ? new Date(newDoc.start_time) : previous.startTime,
        duration: Number(newDoc.duration) || previous.duration,
        remainingTime,
        isActive: !!newDoc.is_active,
        isPaused: !!newDoc.is_paused,
        isBreak: !!newDoc.is_break,
        completedAt: newDoc.completed_at ? new Date(newDoc.completed_at) : undefined,
        deviceLeaderId: newDoc.device_leader_id,
        deviceLeaderLastSeen: new Date(newDoc.device_leader_last_seen).getTime(),
        workspaceId: newDoc.workspace_id ?? previous.workspaceId ?? null,
        canonicalRevision: Number(newDoc.canonical_revision),
        canonicalPending: false,
      }
      if (currentSession.value.isActive && !currentSession.value.isPaused) {
        resumeCountdown()
        resumeHeartbeat()
        requestWakeLock()
      } else {
        pauseCountdown()
        pauseHeartbeat()
        releaseWakeLock()
      }
      return
    }

    // Skip ordinary own-device heartbeat echoes once canonical state is known.
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
      // Stale echoes from previously completed sessions can arrive with the old
      // device_leader_id, bypassing the own-echo guard above.
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
        deviceLeaderLastSeen: lastSeen,
        workspaceId: newDoc.workspace_id ?? null,
        canonicalRevision: newDoc.canonical_revision,
        canonicalPending: false,
      }

      // Calculate adjusted remaining time based on drift
      const now = Date.now()
      const drift = Math.floor((now - lastSeen) / 1000)
      if (session.isActive && !session.isPaused) {
        session.remainingTime = Math.max(0, session.remainingTime - drift)
      }
      if (
        currentSession.value?.id === session.id &&
        currentSession.value.isActive &&
        !currentSession.value.isPaused &&
        session.isActive &&
        !session.isPaused &&
        session.duration <= currentSession.value.duration &&
        session.remainingTime > currentSession.value.remainingTime
      ) {
        session.remainingTime = currentSession.value.remainingTime
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

  // ── Initialization ─────────────────────────────────────────────────

  const initializeSync = async () => {
    // Skip if not authenticated - we'll retry when auth becomes ready
    if (!canUseRemoteTimerSync()) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] initializeStore - waiting for auth...')
      }
      return
    }

    // Skip if we've already loaded in this session
    if (hasLoadedSession.value) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] initializeStore - already loaded, skipping')
      }
      return
    }

    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] initializeStore starting (auth ready)...')
    }
    hasLoadedSession.value = true
    const saved = await fetchActiveTimerSession()
    if (import.meta.env.DEV) {
      console.log('🍅 [TIMER] fetchActiveTimerSession result:', saved ? {
        id: saved.id,
        isActive: saved.isActive,
        isPaused: saved.isPaused,
        remainingTime: saved.remainingTime,
        deviceLeaderId: saved.deviceLeaderId,
        deviceLeaderLastSeen: saved.deviceLeaderLastSeen ? new Date(saved.deviceLeaderLastSeen).toISOString() : null
      } : 'null')
    }

    if (saved && saved.isActive) {
      // Check for very stale sessions (last heartbeat > 1 hour ago)
      // These are abandoned sessions that should be cleared, not completed
      const STALE_SESSION_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour
      const lastSeen = saved.deviceLeaderLastSeen || 0
      const timeSinceLastSeen = Date.now() - lastSeen

      if (timeSinceLastSeen > STALE_SESSION_THRESHOLD_MS) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Clearing stale/abandoned session (no activity for 1+ hour)', {
            sessionId: saved.id,
            lastSeen: new Date(lastSeen).toISOString(),
            staleFor: Math.round(timeSinceLastSeen / 1000 / 60) + ' minutes'
          })
        }
        // Retire abandoned state through the same revision-bound authority as
        // explicit renderer stops. Never let initialization become a direct
        // semantic database writer.
        try {
          const baseRevision = saved.canonicalRevision
          if (!Number.isInteger(baseRevision) || (baseRevision ?? 0) <= 0) {
            throw new Error('canonical_timer_revision_missing')
          }
          await executeCanonicalCommand({
            operationId: `web:timer:stop:${saved.id}:${baseRevision}`,
            action: 'stop',
            sessionId: saved.id,
            workspaceId: saved.workspaceId ?? null,
            deviceId,
            baseRevision: baseRevision as number,
            remainingSeconds: Math.max(0, Math.floor(saved.remainingTime)),
          })
        } catch (e) {
          console.warn('🍅 [TIMER] Canonical stale-session retirement failed:', e)
          if (e instanceof CanonicalTimerCommandError && e.code === 'canonical_timer_transport_failed') {
            const baseRevision = saved.canonicalRevision as number
            const request: CanonicalTimerCommandRequest = {
              operationId: `web:timer:stop:${saved.id}:${baseRevision}`,
              action: 'stop', sessionId: saved.id, workspaceId: saved.workspaceId ?? null,
              deviceId, baseRevision,
              remainingSeconds: Math.max(0, Math.floor(saved.remainingTime)),
            }
            await queueCanonicalCommand(request, {
              ...saved, isActive: false, isPaused: false, completedAt: new Date(),
              canonicalRevision: baseRevision + 1, canonicalPending: true,
            })
            currentSession.value = null
          }
          return
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
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Applied drift correction:', driftSeconds, 'seconds, new remaining:', adjustedRemainingTime)
          }
        }
      }

      // If timer already expired while app was closed, properly complete it (BUG-1512)
      if (adjustedRemainingTime <= 0) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Session already expired on load, completing with full credit', {
            sessionId: saved.id,
            originalRemaining: saved.remainingTime,
            driftApplied: saved.remainingTime - adjustedRemainingTime
          })
        }
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
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Attempting atomic leadership claim', {
            reason: saved.deviceLeaderId === deviceId ? 'same device' :
              !saved.deviceLeaderId ? 'no previous leader' :
                `previous leader timed out (${Math.round(timeSinceLeaderSeen / 1000)}s ago)`,
            newLeaderId: deviceId
          })
        }

        // BUG-1511: Atomic CAS — only become leader if DB confirms the claim
        const granted = await claimLeadership(saved.id, deviceId)
        if (!granted) {
          if (import.meta.env.DEV) {
            console.log('🍅 [TIMER] Leadership claim denied on init — running as follower')
          }
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
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Running as follower, leader is still active', {
            leaderId: saved.deviceLeaderId,
            lastSeen: new Date(lastSeen).toISOString(),
            timeUntilTimeout: Math.round((DEVICE_LEADER_TIMEOUT_MS - timeSinceLastSeen) / 1000) + 's'
          })
        }
        isDeviceLeader.value = false
        // Followers should also update their local countdown
        resumeCountdown()
        // TASK-1009: Start follower polling as backup for Realtime
        resumeFollowerPoll()
      }
    } else {
      // TASK-1790: Start follower poll as the Realtime backstop.
      // Bumped to 15s (FOLLOWER_POLL_INTERVAL_MS) so this is cheap (~4 queries/min)
      // and only there to catch sessions that Realtime missed — cold-start race
      // before the channel reaches SUBSCRIBED, or WS drops handled at
      // useRealtimeSubscription.ts:168 (CLOSED/TIMED_OUT/CHANNEL_ERROR per BUG-1320).
      // Without this, the Vue app stays at 25:00 forever when the KDE widget starts
      // a timer and Realtime misses the INSERT.
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] No active session at init, starting follower poll as Realtime backstop')
      }
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
    if (!canUseRemoteTimerSync()) return

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
    () => canUseRemoteTimerSync(),
    (canSync) => {
      if (canSync && !hasLoadedSession.value) {
        if (import.meta.env.DEV) {
          console.log('🍅 [TIMER] Auth became ready, initializing timer store...')
        }
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
