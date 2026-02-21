import { supabase, invalidateCache, type DatabaseContext } from './_infrastructure'

export function useRealtimeSubscription(ctx: DatabaseContext) {
    const { authStore, handleError } = ctx

    const initRealtimeSubscription = (
        onProjectChange: (payload: unknown) => void,
        onTaskChange: (payload: unknown) => void,
        onTimerChange?: (payload: unknown) => void,
        onNotificationChange?: (payload: unknown) => void,
        onGroupChange?: (payload: unknown) => void,
        onRecovery?: () => Promise<void> // Callback to reload data after recovery
    ) => {
        const userId = authStore.user?.id
        if (!userId) return null

        let currentChannel: any = null
        let retryCount = 0
        let isExplicitlyClosed = false
        const _heartbeatInterval: any = null
        let isRemovingChannel = false // Guard against recursive removeChannel calls (BUG-1088)

        // cleanup previous channels if any
        if (supabase.realtime.channels.length > 0) {
            console.debug(`📡 [REALTIME] Cleaning up ${supabase.realtime.channels.length} existing channels...`)
            supabase.removeAllChannels()
        }

        // Unique channel name per tab
        const tabId = window.__flowstate_tab_id || (() => {
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                ; window.__flowstate_tab_id = id
            return id
        })()

        const channelName = `db-changes-${userId.substring(0, 8)}-${tabId}`

        const setupSubscription = async () => {
            if (isExplicitlyClosed) return

            // connection guard
            const { data: { session: freshSession } } = await supabase.auth.getSession()
            if (!freshSession?.access_token) {
                console.warn('📡 [REALTIME] No auth token available, aborting setup')
                return
            }
            supabase.realtime.setAuth(freshSession.access_token)

            console.debug(`📡 [REALTIME] Connecting to channel: ${channelName} (Attempt ${retryCount + 1})`)

            const channel = supabase.channel(channelName)
            currentChannel = channel

            // Attach Listeners with detailed logging
            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
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
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
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
                    (payload: any) => {
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
                    (payload: any) => {
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
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
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

            // Subscribe with Robust Error Handling
            channel.subscribe(async (status: any, err: any) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 [REALTIME] Connected! 🟢')
                    retryCount = 0 // Reset backoff
                }

                else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                    // BUG-1320: Downgrade log when tab is hidden — browsers kill WebSockets
                    // in background tabs, this is expected behavior, not an error
                    const logFn = document.visibilityState === 'hidden' ? console.debug : console.warn
                    logFn(`📡 [REALTIME] Connection dropped (${status}):`, err || 'unknown reason')

                    if (isExplicitlyClosed) return

                    // BUG-1088: Guard against recursive removeChannel calls that cause stack overflow
                    if (isRemovingChannel) {
                        console.debug('📡 [REALTIME] Skipping duplicate removeChannel (recursion guard)')
                        return
                    }

                    // PREVENT STALE CHANNELS:
                    // Supabase docs recommend removing the channel before reconnecting
                    isRemovingChannel = true
                    try {
                        await supabase.removeChannel(channel)
                    } catch (removeErr) {
                        console.warn('📡 [REALTIME] Failed to remove channel (continuing anyway):', removeErr)
                    } finally {
                        isRemovingChannel = false
                    }
                    currentChannel = null

                    // RETRY LOGIC (Exponential Backoff)
                    const maxRetries = 10
                    if (retryCount < maxRetries) {
                        const delay = Math.pow(1.5, retryCount) * 1000 + (Math.random() * 500)
                        console.debug(`📡 [REALTIME] Reconnecting in ${delay.toFixed(0)}ms...`)

                        setTimeout(() => {
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
                    } else {
                        console.error('📡 [REALTIME] Max retries reached. Connection lost permanently until refresh.')
                        handleError(new Error('Realtime connection lost'), 'RealtimeSubscription')
                    }
                }
            })
        }

        // Start initial connection
        setupSubscription()

        // BUG-1207 FIX: Track last user interaction to prevent recovery from clobbering recent edits.
        let lastUserInteraction = Date.now()
        const RECOVERY_COOLDOWN_MS = 60000 // 60 seconds
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

                // BUG-1182 FIX: Proactively refresh auth token on wake-up.
                try {
                    await supabase.auth.refreshSession()
                } catch (e) {
                    console.warn('👀 [REALTIME] Token refresh on wake failed:', e)
                }

                const state = currentChannel?.state

                if (!currentChannel || state === 'closed' || state === 'errored') {
                    console.debug('👀 [REALTIME] Connection dead on resume. Force reconnecting...')
                    // BUG-1088: Guard against recursive removeChannel calls
                    if (currentChannel && !isRemovingChannel) {
                        isRemovingChannel = true
                        try {
                            await supabase.removeChannel(currentChannel as any)
                        } catch (removeErr) {
                            console.warn('👀 [REALTIME] Failed to remove channel (continuing anyway):', removeErr)
                        } finally {
                            isRemovingChannel = false
                        }
                    }
                    retryCount = 0
                    setupSubscription()

                    // BUG-1207 FIX: Skip recovery reload if user was recently active.
                    const timeSinceInteraction = Date.now() - lastUserInteraction
                    if (onRecovery && timeSinceInteraction > RECOVERY_COOLDOWN_MS) {
                        // CRITICAL FIX: Invalidate ALL caches before recovery to prevent stale data
                        invalidateCache.all()
                        onRecovery()
                    } else if (onRecovery) {
                        console.debug(`👀 [REALTIME] Skipping recovery reload - user was active ${Math.round(timeSinceInteraction / 1000)}s ago (cooldown: ${RECOVERY_COOLDOWN_MS / 1000}s)`)
                    }
                } else {
                    // Pulse check - verify we are actually connected
                }
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)

        // ONLINE RESUME
        // BUG-1209: Add same cooldown as visibility handler to prevent clobbering in-flight drags
        const onOnline = async () => {
            console.debug('🌐 [REALTIME] Online event detected. Reconnecting...')
            retryCount = 0
            setupSubscription()
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
                // BUG-1088: Guard against recursive removeChannel calls
                if (currentChannel && !isRemovingChannel) {
                    isRemovingChannel = true
                    try {
                        await supabase.removeChannel(currentChannel)
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
