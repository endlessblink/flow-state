import { ref } from 'vue'

interface TimerLeaderState {
    leaderId: string
    lastHeartbeat: number
    sessionState: unknown
}

interface LeaderElectionDeps {
    tabId: string
    broadcastMessage: (msg: any) => void
    onBecomeLeader?: () => void
    onLoseLeadership?: () => void
    onSessionUpdate?: (session: unknown) => void
}

export function useTimerLeaderElection(deps: LeaderElectionDeps) {
    const { tabId, broadcastMessage, onBecomeLeader, onLoseLeadership, onSessionUpdate } = deps

    const leaderState = ref<TimerLeaderState | null>(null)
    const isLeader = ref(false)

    const HEARTBEAT_INTERVAL = 2000
    const LEADER_TIMEOUT = 5000

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    const isLeaderAlive = (): boolean => {
        if (!leaderState.value) return false
        return Date.now() - leaderState.value.lastHeartbeat < LEADER_TIMEOUT
    }

    const claimLeadership = (): boolean => {
        if (leaderState.value && isLeaderAlive() && leaderState.value.leaderId !== tabId) {
            return false
        }

        leaderState.value = {
            leaderId: tabId,
            lastHeartbeat: Date.now(),
            sessionState: leaderState.value?.sessionState || null
        }
        isLeader.value = true

        broadcastMessage({
            action: 'claim_leadership',
            leaderId: tabId,
            sessionState: leaderState.value.sessionState,
            timestamp: Date.now()
        })

        startHeartbeat()

        if (onBecomeLeader) {
            onBecomeLeader()
        }

        return true
    }

    const startHeartbeat = () => {
        stopHeartbeat()
        heartbeatTimer = setInterval(() => {
            if (isLeader.value && leaderState.value) {
                leaderState.value.lastHeartbeat = Date.now()
                broadcastMessage({
                    action: 'heartbeat',
                    leaderId: tabId,
                    sessionState: leaderState.value.sessionState,
                    timestamp: Date.now()
                })
            }
        }, HEARTBEAT_INTERVAL)
    }

    const stopHeartbeat = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer)
            heartbeatTimer = null
        }
    }

    const handleLeaderMessage = (sync: any) => {
        switch (sync.action) {
            case 'claim_leadership':
                if (sync.leaderId !== tabId) {
                    if (isLeader.value) {
                        isLeader.value = false
                        stopHeartbeat()
                        if (onLoseLeadership) {
                            onLoseLeadership()
                        }
                    }

                    leaderState.value = {
                        leaderId: sync.leaderId,
                        lastHeartbeat: sync.timestamp,
                        sessionState: sync.sessionState
                    }

                    if (sync.sessionState && onSessionUpdate) {
                        onSessionUpdate(sync.sessionState)
                    }
                }
                break

            case 'heartbeat':
                if (leaderState.value && sync.leaderId === leaderState.value.leaderId) {
                    leaderState.value.lastHeartbeat = sync.timestamp
                    leaderState.value.sessionState = sync.sessionState

                    if (!isLeader.value && sync.sessionState && onSessionUpdate) {
                        onSessionUpdate(sync.sessionState)
                    }
                }
                break

            case 'session_update':
                if (leaderState.value) {
                    leaderState.value.sessionState = sync.sessionState
                    leaderState.value.lastHeartbeat = sync.timestamp
                }

                if (!isLeader.value && onSessionUpdate) {
                    onSessionUpdate(sync.sessionState)
                }
                break

            case 'session_stop':
                if (leaderState.value) {
                    leaderState.value.sessionState = null
                }

                if (!isLeader.value && onSessionUpdate) {
                    onSessionUpdate(null)
                }
                break
        }
    }

    const cleanup = () => {
        stopHeartbeat()
        isLeader.value = false
    }

    return {
        isLeader,
        leaderState,
        claimLeadership,
        handleLeaderMessage,
        cleanup
    }
}
