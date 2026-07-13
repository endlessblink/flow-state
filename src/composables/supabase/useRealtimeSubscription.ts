import { type RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, invalidateCache, type DatabaseContext } from './_infrastructure'

// Generation counter: incremented each time initRealtimeSubscription runs.
// Each setupSubscription closure captures its own generation at creation time.
// Any stale setTimeout that fires after a newer subscription exists will see
// myGeneration !== subscriptionGeneration and bail out immediately.
let subscriptionGeneration = 0

/** Shape of Supabase Realtime postgres_changes payload */
export interface RealtimePayload {
    eventType: string
    table: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new: Record<string, any> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    old: Record<string, any> | null
    [key: string]: unknown
}

export function useRealtimeSubscription(ctx: DatabaseContext) {
    const { authStore } = ctx

    const initRealtimeSubscription = (
        onProjectChange: (payload: RealtimePayload) => void,
        onTaskChange: (payload: RealtimePayload) => void,
        onTimerChange?: (payload: RealtimePayload) => void,
        onNotificationChange?: (payload: RealtimePayload) => void,
        onGroupChange?: (payload: RealtimePayload) => void,
        onRecovery?: () => Promise<void>, // Callback to reload data after recovery
        workspaceId?: string | null,      // Workspace collaboration: null = personal
        onLaneChange?: (payload: RealtimePayload) => void // TASK-1812: lane realtime
    ) => {
        const userId = authStore.user?.id
        if (!userId) return null

        // Claim this generation. Any setTimeout from a previous call to
        // initRealtimeSubscription that hasn't fired yet will see a stale generation
        // and abort, preventing ghost reconnects after workspace switches.
        const myGeneration = ++subscriptionGeneration

        // Workspace-aware filter: personal workspace filters by user_id,
        // shared workspace filters by workspace_id instead
        const taskFilter = workspaceId
            ? `workspace_id=eq.${workspaceId}`
            : `user_id=eq.${userId}`
        const projectFilter = workspaceId
            ? `workspace_id=eq.${workspaceId}`
            : `user_id=eq.${userId}`
        const groupFilter = workspaceId
            ? `workspace_id=eq.${workspaceId}`
            : `user_id=eq.${userId}`
        const laneFilter = workspaceId
            ? `workspace_id=eq.${workspaceId}`
            : `user_id=eq.${userId}`

        let currentChannel: RealtimeChannel | null = null
        let retryCount = 0
        let isExplicitlyClosed = false
        const _heartbeatInterval: ReturnType<typeof setInterval> | null = null
        let isRemovingChannel = false // Guard against recursive removeChannel calls (BUG-1088)
        // BUG-1799: Single-flight guard. setupSubscription is invoked from 4 places (initial,
        // retry timer, visibility, online). supabase-js dedupes channels by topic, so re-entrant
        // calls re-run channel.on(...) → DUPLICATE postgres_changes bindings (events handled N×)
        // and spawn competing reconnects. isConnecting collapses concurrent setup into one.
        let isConnecting = false
        // BUG-1799: Single pending reconnect handle. Both terminal statuses (CHANNEL_ERROR then
        // CLOSED) fire per failure; without this they each schedule a reconnect (double-schedule).
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null

        // cleanup previous channel (scoped to this call-site's currentChannel ref only,
        // not a nuclear removeAllChannels that would tear down other subscriptions)
        // NOTE: currentChannel is declared below; this block will be a no-op on the first
        // call. Subsequent re-inits re-enter this function, so the old closure's
        // currentChannel is already gone — the generation counter is the real guard.

        // Unique channel name per tab
        const tabId = window.__flowstate_tab_id || (() => {
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                ; window.__flowstate_tab_id = id
            return id
        })()

        const channelName = `db-changes-${userId.substring(0, 8)}-${tabId}`

        const setupSubscription = async () => {
            if (isExplicitlyClosed) return

            // BUG-1799: Single-flight — never let two setups run concurrently. Re-entrant calls
            // would re-bind postgres_changes listeners on the deduped channel and spawn competing
            // reconnects (the root of the CHANNEL_ERROR/CLOSED storm under Electron focus churn).
            if (isConnecting) {
                console.debug('📡 [REALTIME] setupSubscription already in progress — skipping concurrent call')
                return
            }
            isConnecting = true

            // TASK-1871: Wrap the whole body in try/finally. Previously a throw anywhere between
            // `isConnecting = true` and the reset at the end (getSession rejecting, removeChannel,
            // channel.subscribe) left isConnecting=true FOREVER — then every future setupSubscription
            // early-returned at the single-flight guard and realtime silently never recovered until a
            // full reload. The finally guarantees the flag is always cleared.
            try {
                // connection guard
                const { data: { session: freshSession } } = await getSupabase().auth.getSession()
                if (!freshSession?.access_token) {
                    // TASK-1871: Electron resolves disk-backed auth late; an init landing in this window
                    // must NOT die silently (no token → no channel → no recovery path). Reschedule.
                    console.warn('📡 [REALTIME] No auth token available, scheduling retry')
                    scheduleSetupRetry(2000, 'no-auth-token')
                    return
                }
                getSupabase().realtime.setAuth(freshSession.access_token)

            console.debug(`📡 [REALTIME] Connecting to channel: ${channelName} (Attempt ${retryCount + 1})`)

            // BUG-1799: Remove any existing channel before creating a new one. supabase-js reuses
            // a channel with the same topic, so without an explicit teardown we re-add duplicate
            // postgres_changes bindings onto the same channel (each event then fires N handlers).
            if (currentChannel && !isRemovingChannel) {
                isRemovingChannel = true
                try {
                    await getSupabase().removeChannel(currentChannel)
                } catch (removeErr) {
                    console.warn('📡 [REALTIME] Failed to remove stale channel before reconnect:', removeErr)
                } finally {
                    isRemovingChannel = false
                }
            }

            const channel = getSupabase().channel(channelName)
            currentChannel = channel

            // Attach Listeners with detailed logging
            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: projectFilter },
                    (payload: RealtimePayload) => {
                        if (import.meta.env.DEV) {
                            console.debug('📡 [REALTIME] PROJECT event received:', {
                                eventType: payload.eventType,
                                table: payload.table,
                                id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                                name: payload.new?.name || payload.old?.name
                            })
                        }
                        if (payload.table === 'projects') onProjectChange(payload)
                    })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: taskFilter },
                    (payload: RealtimePayload) => {
                        if (import.meta.env.DEV) {
                            console.debug('📡 [REALTIME] TASK event received:', {
                                eventType: payload.eventType,
                                table: payload.table,
                                id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                                title: payload.new?.title?.substring(0, 20) || payload.old?.title?.substring(0, 20),
                                position: payload.new?.position ? `(${payload.new.position.x},${payload.new.position.y})` : 'N/A'
                            })
                        }
                        if (payload.table === 'tasks') onTaskChange(payload)
                    })

            if (onTimerChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'timer_sessions', filter: `user_id=eq.${userId}` },
                    (payload: RealtimePayload) => {
                        if (import.meta.env.DEV) {
                            console.debug('📡 [REALTIME] TIMER event received:', {
                                eventType: payload.eventType,
                                sessionId: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                                isActive: payload.new?.is_active,
                                remainingTime: payload.new?.remaining_time
                            })
                        }
                        onTimerChange(payload)
                    })
            }

            if (onNotificationChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                    (payload: RealtimePayload) => {
                        if (import.meta.env.DEV) {
                            console.debug('📡 [REALTIME] NOTIFICATION event received:', {
                                eventType: payload.eventType,
                                id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8)
                            })
                        }
                        onNotificationChange(payload)
                    })
            }

            if (onGroupChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: groupFilter },
                    (payload: RealtimePayload) => {
                        if (import.meta.env.DEV) {
                            console.debug('📡 [REALTIME] GROUP event received:', {
                                eventType: payload.eventType,
                                id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                                name: payload.new?.name || payload.old?.name,
                                position: payload.new?.position ? `(${payload.new.position.x},${payload.new.position.y})` : 'N/A'
                            })
                        }
                        onGroupChange(payload)
                    })
            }

            if (onLaneChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'lanes', filter: laneFilter },
                    (payload: RealtimePayload) => {
                        if (import.meta.env.DEV) {
                            console.debug('📡 [REALTIME] LANE event received:', {
                                eventType: payload.eventType,
                                id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                                name: payload.new?.name || payload.old?.name
                            })
                        }
                        if (payload.table === 'lanes') onLaneChange(payload)
                    })
            }

            // Subscribe with Robust Error Handling
            channel.subscribe(async (status: string, err?: Error) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 [REALTIME] Connected! 🟢')
                    retryCount = 0 // Reset backoff
                }

                else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                    if (isExplicitlyClosed) return

                    // BUG-1799: Both terminal statuses (CHANNEL_ERROR then CLOSED) fire per failure.
                    // If a reconnect is already scheduled, ignore the duplicate so we don't stack
                    // multiple competing reconnect timers (and so backoff advances by one, not two).
                    if (reconnectTimer) {
                        console.debug('📡 [REALTIME] Reconnect already scheduled — ignoring duplicate terminal status')
                        return
                    }

                    // BUG-1088: Guard against recursive removeChannel calls that cause stack overflow
                    if (isRemovingChannel) {
                        console.debug('📡 [REALTIME] Skipping duplicate removeChannel (recursion guard)')
                        return
                    }

                    // BUG-1921: Only warn for terminal statuses that will actually drive recovery.
                    // Supabase emits CLOSED during explicit cleanup and often emits CLOSED after a
                    // CHANNEL_ERROR from the same drop. Logging before the guards made normal
                    // cleanup and duplicate terminal statuses look like repeated failures.
                    const logFn = document.visibilityState === 'hidden' ? console.debug : console.warn
                    logFn(`📡 [REALTIME] Connection dropped (${status}):`, err || 'unknown reason')

                    // PREVENT STALE CHANNELS:
                    // Supabase docs recommend removing the channel before reconnecting
                    isRemovingChannel = true
                    try {
                        await getSupabase().removeChannel(channel)
                    } catch (removeErr) {
                        console.warn('📡 [REALTIME] Failed to remove channel (continuing anyway):', removeErr)
                    } finally {
                        isRemovingChannel = false
                    }
                    currentChannel = null

                    // RETRY LOGIC
                    // Phase 1 (fast): first 10 retries use exponential backoff (~1s → ~57s)
                    // Phase 2 (slow): after 10 fast retries, retry every 60s indefinitely
                    // Reset: retryCount resets to 0 on SUBSCRIBED (line above)
                    const FAST_RETRY_LIMIT = 10
                    const SLOW_RETRY_INTERVAL_MS = 60_000

                    const isSlowPhase = retryCount >= FAST_RETRY_LIMIT
                    const delay = isSlowPhase
                        ? SLOW_RETRY_INTERVAL_MS
                        : Math.pow(1.5, retryCount) * 1000 + (Math.random() * 500)

                    if (isSlowPhase) {
                        // Log the transition once (when retryCount is exactly FAST_RETRY_LIMIT)
                        if (retryCount === FAST_RETRY_LIMIT) {
                            console.warn('📡 [REALTIME] Fast retries exhausted, entering slow retry mode (every 60s)')
                        } else {
                            console.debug(`📡 [REALTIME] Slow retry #${retryCount - FAST_RETRY_LIMIT + 1} in ${SLOW_RETRY_INTERVAL_MS / 1000}s...`)
                        }
                    } else {
                        console.debug(`📡 [REALTIME] Reconnecting in ${delay.toFixed(0)}ms (fast retry ${retryCount + 1}/${FAST_RETRY_LIMIT})...`)
                    }

                    reconnectTimer = setTimeout(() => {
                        // BUG-1799: clear the handle first so the next failure can schedule again.
                        reconnectTimer = null
                        // Cancellation token: abort if a newer initRealtimeSubscription
                        // call has already claimed the channel (workspace switch, re-init, etc.)
                        if (myGeneration !== subscriptionGeneration) {
                            console.debug('📡 [REALTIME] Stale reconnect timer fired — discarding (generation mismatch)')
                            return
                        }
                        retryCount++
                        setupSubscription().then(async () => {
                            // BUG-1207 FIX: Apply same cooldown as visibility/online handlers
                            // to prevent recovery from clobbering recent user edits
                            const timeSinceInteraction = Date.now() - lastUserInteraction
                            if (onRecovery && timeSinceInteraction > RECOVERY_COOLDOWN_MS) {
                                // BUG-1206 FIX (Fix 3): Check modal state before reconnect recovery too
                                try {
                                    const { useCanvasModalsStore } = await import('@/stores/canvas/modals')
                                    const canvasModals = useCanvasModalsStore()
                                    if (canvasModals.isEditModalOpen || canvasModals.isBatchEditModalOpen) {
                                        console.debug('📡 [REALTIME] Skipping reconnect recovery - edit modal is open (BUG-1206)')
                                        return
                                    }
                                } catch { /* continue */ }

                                console.debug('📡 [REALTIME] Triggering recovery data reload...')
                                // CRITICAL FIX: Invalidate ALL caches before recovery to prevent stale data
                                invalidateCache.all()
                                onRecovery().catch(e => console.error('Recovery failed:', e))
                            } else if (onRecovery) {
                                console.debug(`📡 [REALTIME] Skipping reconnect recovery reload - user was active ${Math.round(timeSinceInteraction / 1000)}s ago (cooldown: ${RECOVERY_COOLDOWN_MS / 1000}s)`)
                            }
                        })
                    }, delay)
                }
            })

            // BUG-1799: Setup (binding + subscribe initiation) is complete. Subsequent
            // SUBSCRIBED/error transitions are handled by the callback above and reconnectTimer.
            } catch (setupErr) {
                // TASK-1871: A throw here used to wedge isConnecting=true permanently. Now we
                // schedule a retry and let finally clear the flag so recovery always resumes.
                console.warn('📡 [REALTIME] setupSubscription threw — scheduling retry:', setupErr)
                scheduleSetupRetry(3000, 'setup-threw')
            } finally {
                isConnecting = false
            }
        }

        // TASK-1871: Single, generation-guarded way to re-attempt setup. Reuses reconnectTimer so
        // it never stacks with the subscribe-callback reconnect, and aborts if a newer init claimed
        // the channel (workspace switch / re-init).
        const scheduleSetupRetry = (delayMs: number, reason: string) => {
            if (isExplicitlyClosed) return
            if (reconnectTimer) return // a reconnect is already pending — don't stack timers
            console.debug(`📡 [REALTIME] Scheduling setup retry in ${delayMs}ms (${reason})`)
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null
                if (isExplicitlyClosed) return
                if (myGeneration !== subscriptionGeneration) return
                setupSubscription()
            }, delayMs)
        }

        // Start initial connection
        setupSubscription()

        // BUG-1207 FIX: Track last user interaction to prevent recovery from clobbering recent edits.
        let lastUserInteraction = Date.now()
        const RECOVERY_COOLDOWN_MS = 60000 // 60 seconds
        let lastAuthoritativeRecovery = Date.now()
        const trackUserInteraction = () => { lastUserInteraction = Date.now() }
        document.addEventListener('click', trackUserInteraction, { passive: true })
        document.addEventListener('keydown', trackUserInteraction, { passive: true })
        document.addEventListener('pointerdown', trackUserInteraction, { passive: true })
        document.addEventListener('input', trackUserInteraction, { passive: true })

        // VISIBILITY RESUME (Handle Background Tab Throttling)
        const onVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                // BUG-1206 FIX (Fix 3): Skip recovery entirely while any edit modal is open.
                try {
                    const { useCanvasModalsStore } = await import('@/stores/canvas/modals')
                    const canvasModals = useCanvasModalsStore()
                    if (canvasModals.isEditModalOpen || canvasModals.isBatchEditModalOpen) {
                        console.debug('👀 [REALTIME] Skipping visibility recovery - edit modal is open (BUG-1206)')
                        return
                    }
                } catch {
                    // Canvas modals store not available — continue with normal flow
                }

                console.debug('👀 [REALTIME] App visible - checking connection health...')

                // BUG-1182 FIX: Refresh auth token on wake-up — but only when it's actually stale.
                // TASK-1794: Electron fires visibilitychange far more often than a browser tab
                // (window focus/blur/occlusion, OS notifications). An UNCONDITIONAL refreshSession()
                // here races with Supabase's autoRefreshToken and the scheduled refresh in auth.ts.
                // That auth-event churn produced a transient SIGNED_OUT → the login screen flashed
                // and re-signed in a few seconds later. Only refresh a real session that is
                // missing-expiry or within 120s of expiry; autoRefreshToken covers everything else.
                try {
                    const { data: { session: currentSession } } = await getSupabase().auth.getSession()
                    const expiresAtMs = currentSession?.expires_at ? currentSession.expires_at * 1000 : 0
                    const needsRefresh = !!currentSession && (!expiresAtMs || (expiresAtMs - Date.now()) < 120_000)
                    if (needsRefresh) {
                        await getSupabase().auth.refreshSession()
                    }
                } catch (e) {
                    console.warn('👀 [REALTIME] Token refresh on wake failed:', e)
                }

                const state = currentChannel?.state
                const isDead = !currentChannel || state === 'closed' || state === 'errored'

                // BUG-1799: Only reconnect when genuinely dead AND no reconnect is already in
                // flight (isConnecting) or scheduled (reconnectTimer). Electron fires
                // visibilitychange constantly (focus/blur/occlusion) — without these guards every
                // tick forced a reconnect and reset retryCount, defeating backoff and re-binding
                // listeners. setupSubscription now tears down the stale channel itself, so the
                // manual removeChannel here is gone. retryCount is NOT reset — only SUBSCRIBED resets it.
                if (isDead && !isConnecting && reconnectTimer === null) {
                    console.debug('👀 [REALTIME] Connection dead on resume. Reconnecting...')
                    setupSubscription()
                } else if (isDead) {
                    console.debug('👀 [REALTIME] Connection dead but reconnect already in progress/scheduled — skipping')
                }

                // BUG-1942: A PWA write can be missed while Supabase still reports this
                // channel as joined. Reconcile authoritative data on a genuine visible
                // resume even for a healthy-looking channel; realtime remains the fast path.
                const now = Date.now()
                const timeSinceInteraction = now - lastUserInteraction
                const timeSinceRecovery = now - lastAuthoritativeRecovery
                if (onRecovery && timeSinceRecovery > RECOVERY_COOLDOWN_MS) {
                    lastAuthoritativeRecovery = now
                    invalidateCache.all()
                    await onRecovery().catch(e => console.error('Visibility recovery failed:', e))
                } else if (onRecovery) {
                    console.debug(`👀 [REALTIME] Skipping recovery reload - last authoritative refresh was ${Math.round(timeSinceRecovery / 1000)}s ago (cooldown: ${RECOVERY_COOLDOWN_MS / 1000}s, last interaction: ${Math.round(timeSinceInteraction / 1000)}s)`)
                }
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)

        // ONLINE RESUME
        // BUG-1209: Add same cooldown as visibility handler to prevent clobbering in-flight drags
        const onOnline = async () => {
            console.debug('🌐 [REALTIME] Online event detected.')
            // BUG-1799: Only force a reconnect when the channel is actually dead and no reconnect
            // is already in flight/scheduled. Do not reset retryCount here (only SUBSCRIBED does).
            const state = currentChannel?.state
            const isDead = !currentChannel || state === 'closed' || state === 'errored'
            if (isDead && !isConnecting && reconnectTimer === null) {
                console.debug('🌐 [REALTIME] Reconnecting after online event...')
                setupSubscription()
            }
            const timeSinceInteraction = Date.now() - lastUserInteraction
            if (onRecovery && timeSinceInteraction > RECOVERY_COOLDOWN_MS) {
                // BUG-1206 FIX (Fix 3): Check modal state before online recovery too
                try {
                    const { useCanvasModalsStore } = await import('@/stores/canvas/modals')
                    const canvasModals = useCanvasModalsStore()
                    if (canvasModals.isEditModalOpen || canvasModals.isBatchEditModalOpen) {
                        console.debug('🌐 [REALTIME] Skipping online recovery - edit modal is open (BUG-1206)')
                        return
                    }
                } catch { /* continue */ }

                // CRITICAL FIX: Invalidate ALL caches before recovery to prevent stale data
                invalidateCache.all()
                onRecovery()
            } else if (onRecovery) {
                console.debug(`🌐 [REALTIME] Skipping online recovery reload - user was active ${Math.round(timeSinceInteraction / 1000)}s ago (cooldown: ${RECOVERY_COOLDOWN_MS / 1000}s)`)
            }
        }
        window.addEventListener('online', onOnline)

        // Return cleanup function (Proxy interface for callers)
        return {
            unsubscribe: async () => {
                console.debug('📡 [REALTIME] Unsubscribing explicitly.')
                isExplicitlyClosed = true
                // BUG-1799: Cancel any pending reconnect so it can't resurrect the channel.
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer)
                    reconnectTimer = null
                }
                // BUG-1088: Guard against recursive removeChannel calls
                if (currentChannel && !isRemovingChannel) {
                    isRemovingChannel = true
                    try {
                        await getSupabase().removeChannel(currentChannel)
                    } catch (removeErr) {
                        console.warn('📡 [REALTIME] Failed to remove channel during cleanup:', removeErr)
                    } finally {
                        isRemovingChannel = false
                    }
                }
                document.removeEventListener('visibilitychange', onVisibilityChange)
                document.removeEventListener('click', trackUserInteraction)
                document.removeEventListener('keydown', trackUserInteraction)
                document.removeEventListener('pointerdown', trackUserInteraction)
                document.removeEventListener('input', trackUserInteraction)
                window.removeEventListener('online', onOnline)
            }
        }
    }

    return { initRealtimeSubscription }
}
