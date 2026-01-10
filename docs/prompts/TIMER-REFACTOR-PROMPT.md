# Timer System Refactor Prompt

**Task ID**: TASK-194
**Priority**: P2
**Estimated Effort**: 10-14 hours
**Dependencies**: Follow patterns from TASK-191-193 (Board, Calendar, Settings refactors)

---

## Context

You are refactoring the Timer/Pomodoro system in a Vue 3 + TypeScript + Pinia application. The Timer system currently scores **6.5/10** in a tech debt audit with critical performance issues including a deep watcher that fires 60x/min and a 1,109 LOC monolithic sync composable.

**Goal**: Fix performance issues, split the monolithic composable, remove console pollution, and improve maintainability - WITHOUT breaking timer functionality.

---

## Current State (Problems to Fix)

### File Overview

| File | LOC | Issues |
|------|-----|--------|
| `src/stores/timer.ts` | 445 | Store in computed, duplicate countdown logic |
| `src/composables/useCrossTabSync.ts` | 1,109 | **God object** - 3 concerns mixed, 37 console.log |
| `src/components/FaviconManager.vue` | 238 | Clean, no changes needed |

**Total**: ~1,792 LOC across 3 files
**Console.log statements**: 38 (37 in useCrossTabSync + 1 in timer)

---

## Critical Issues

### 1. Store Called Inside Computed (Anti-pattern)

**Location**: `timer.ts:91-98, 110-118`

```typescript
// ❌ CURRENT - Store instantiated inside computed (recreated on each call)
const currentTaskName = computed(() => {
  // ...
  const taskStore = useTaskStore()  // BAD: Called inside computed!
  const task = taskStore.tasks.find(t => t.id === session.taskId)
  return task?.title || 'Unknown Task'
})

const sessionStatusText = computed(() => {
  // ...
  const taskStore = useTaskStore()  // BAD: Same issue!
  const task = taskStore.tasks.find(t => t.id === session.taskId)
  return task?.title || 'Work Session'
})
```

**Fix**: Get store reference at module level

```typescript
// ✅ FIXED
const taskStore = useTaskStore()  // Once at setup time

const currentTaskName = computed(() => {
  const session = currentSession.value
  if (!session?.taskId) return null
  if (session.isBreak) return session.taskId === 'break' ? 'Break Time' : 'Short Break'
  if (session.taskId === 'general') return 'Focus Session'
  const task = taskStore.tasks.find(t => t.id === session.taskId)
  return task?.title || 'Unknown Task'
})
```

### 2. Duplicate Time Display Logic

**Location**: `timer.ts:81-88` and `timer.ts:103-108`

```typescript
// ❌ CURRENT - Same logic duplicated
const displayTime = computed(() => {
  if (!currentSession.value) {
    const minutes = Math.floor(settings.workDuration / 60)
    return `${minutes.toString().padStart(2, '0')}:00`
  }
  const minutes = Math.floor(currentSession.value.remainingTime / 60)
  const seconds = currentSession.value.remainingTime % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const tabDisplayTime = computed(() => {
  if (!currentSession.value) return ''
  const minutes = Math.floor(currentSession.value.remainingTime / 60)  // DUPLICATE!
  const seconds = currentSession.value.remainingTime % 60               // DUPLICATE!
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})
```

**Fix**: Extract helper function

```typescript
// ✅ FIXED
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const displayTime = computed(() => {
  if (!currentSession.value) {
    return formatTime(settings.workDuration)
  }
  return formatTime(currentSession.value.remainingTime)
})

const tabDisplayTime = computed(() => {
  if (!currentSession.value) return ''
  return formatTime(currentSession.value.remainingTime)
})
```

### 3. Monolithic useCrossTabSync (1,109 LOC)

**Location**: `src/composables/useCrossTabSync.ts`

This single file handles THREE separate concerns:
1. **Cross-browser-tab communication** (BroadcastChannel)
2. **Cross-device synchronization** (Supabase Realtime)
3. **Timer leader election** (Tab leadership)

**Current structure**:
```
useCrossTabSync.ts (1,109 LOC)
├── Global state refs (~50 LOC)
├── Timer leader election (~200 LOC)
├── BroadcastChannel messaging (~300 LOC)
├── Conflict resolution (~150 LOC)
├── Store sync handlers (~250 LOC)
└── Supabase realtime (~150 LOC)
```

**Fix**: Split into focused composables

```
src/composables/
├── sync/
│   ├── useTimerLeaderElection.ts   # ~150 LOC
│   ├── useBroadcastChannelSync.ts  # ~250 LOC
│   ├── useSupabaseRealtimeSync.ts  # ~150 LOC
│   └── useCrossTabSync.ts          # ~100 LOC (orchestrator)
```

### 4. Console.log Pollution (38 statements)

**Distribution**:
| File | Count |
|------|-------|
| useCrossTabSync.ts | 37 |
| timer.ts | 1 |

Most are debug logs like:
```typescript
console.log('👑 [TIMER] Claiming timer leadership:', currentTabId.value)
console.log('🎯 [TIMER] Cannot claim leadership - another leader is alive')
console.log('💓 [TIMER] Heartbeat sent')
```

**Action**: Remove ALL 38 console statements.

### 5. Multiple setInterval Instances

**Location**: Various places in timer.ts and useCrossTabSync.ts

```typescript
// timer.ts:418
timerInterval.value = setInterval(() => { ... }, 1000)

// useCrossTabSync.ts - heartbeat
timerHeartbeatTimer = setInterval(() => { ... }, TIMER_HEARTBEAT_INTERVAL_MS)
```

**Issues**:
- Not all are properly cleaned up
- Some leak on component unmount
- No central interval management

**Fix**: Use VueUse `useIntervalFn` or centralized interval manager

```typescript
import { useIntervalFn } from '@vueuse/core'

// ✅ Auto-cleanup on component unmount
const { pause, resume } = useIntervalFn(() => {
  if (currentSession.value?.isActive && !currentSession.value?.isPaused) {
    currentSession.value.remainingTime -= 1
    if (currentSession.value.remainingTime <= 0) completeSession()
  }
}, 1000, { immediate: false })
```

---

## Target Architecture

### New File Structure

```
src/
├── stores/
│   └── timer.ts                    # ~350 LOC (reduced from 445)
├── composables/
│   └── sync/
│       ├── useTimerLeaderElection.ts   # ~150 LOC - Leader election logic
│       ├── useBroadcastChannelSync.ts  # ~250 LOC - Tab communication
│       ├── useSupabaseRealtimeSync.ts  # ~150 LOC - Device sync
│       └── useCrossTabSync.ts          # ~100 LOC - Orchestrator
├── utils/
│   └── timer/
│       └── formatTime.ts           # ~20 LOC - Time formatting helpers
```

---

## Implementation Phases

### Phase 1: Console.log Removal (1 hour)

Remove all 38 console statements.

```bash
# Find them all
grep -rn "console\." src/stores/timer.ts src/composables/useCrossTabSync.ts

# After removal, should be 0
```

### Phase 2: Fix Store-in-Computed (1 hour)

**File**: `timer.ts`

Move `useTaskStore()` call to module level:

```typescript
// At the top of defineStore callback
const taskStore = useTaskStore()

// Then use taskStore.tasks in computed properties
```

### Phase 3: Extract Time Formatting (1 hour)

**Create**: `src/utils/timer/formatTime.ts`

```typescript
/**
 * Format seconds into MM:SS display string
 */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format seconds into human-readable duration
 */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}
```

Update timer.ts to use shared utilities.

### Phase 4: Split useCrossTabSync (4-6 hours)

This is the main refactoring work.

#### 4.1 Create useTimerLeaderElection.ts

```typescript
// src/composables/sync/useTimerLeaderElection.ts
import { ref } from 'vue'

interface TimerLeaderState {
  leaderId: string
  lastHeartbeat: number
  sessionState: unknown
}

interface LeaderElectionDeps {
  tabId: string
  broadcastMessage: (msg: unknown) => void
}

export function useTimerLeaderElection(deps: LeaderElectionDeps) {
  const { tabId, broadcastMessage } = deps

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
      type: 'timer_session',
      data: { action: 'claim_leadership', leaderId: tabId, timestamp: Date.now() }
    })

    startHeartbeat()
    return true
  }

  const startHeartbeat = () => {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (isLeader.value && leaderState.value) {
        leaderState.value.lastHeartbeat = Date.now()
        broadcastMessage({
          type: 'timer_session',
          data: { action: 'heartbeat', leaderId: tabId, timestamp: Date.now() }
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

  const handleLeaderMessage = (message: unknown) => {
    // Handle incoming leader messages
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
```

#### 4.2 Create useBroadcastChannelSync.ts

```typescript
// src/composables/sync/useBroadcastChannelSync.ts
import { ref, onUnmounted } from 'vue'

interface BroadcastMessage {
  type: string
  senderId: string
  timestamp: number
  data: unknown
}

export function useBroadcastChannelSync(channelName = 'pomo-flow-sync') {
  const tabId = ref(`tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const isConnected = ref(false)

  let channel: BroadcastChannel | null = null
  const messageHandlers = new Map<string, (data: unknown) => void>()

  const connect = () => {
    if (channel) return

    channel = new BroadcastChannel(channelName)
    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      if (event.data.senderId === tabId.value) return // Ignore own messages

      const handler = messageHandlers.get(event.data.type)
      if (handler) {
        handler(event.data.data)
      }
    }

    isConnected.value = true
  }

  const disconnect = () => {
    if (channel) {
      channel.close()
      channel = null
    }
    isConnected.value = false
  }

  const broadcast = (type: string, data: unknown) => {
    if (!channel) return

    const message: BroadcastMessage = {
      type,
      senderId: tabId.value,
      timestamp: Date.now(),
      data
    }
    channel.postMessage(message)
  }

  const onMessage = (type: string, handler: (data: unknown) => void) => {
    messageHandlers.set(type, handler)
  }

  const offMessage = (type: string) => {
    messageHandlers.delete(type)
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    tabId,
    isConnected,
    connect,
    disconnect,
    broadcast,
    onMessage,
    offMessage
  }
}
```

#### 4.3 Create useSupabaseRealtimeSync.ts

```typescript
// src/composables/sync/useSupabaseRealtimeSync.ts
import { ref, onUnmounted } from 'vue'
import { supabase } from '@/services/auth/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface RealtimeSyncDeps {
  userId: string | undefined
}

export function useSupabaseRealtimeSync(deps: RealtimeSyncDeps) {
  const { userId } = deps

  const isSubscribed = ref(false)
  let channel: RealtimeChannel | null = null

  const subscribe = (
    onTaskChange: (payload: unknown) => void,
    onTimerChange: (payload: unknown) => void
  ) => {
    if (!userId || channel) return

    channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`
      }, onTaskChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timer_sessions',
        filter: `user_id=eq.${userId}`
      }, onTimerChange)
      .subscribe()

    isSubscribed.value = true
  }

  const unsubscribe = () => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    isSubscribed.value = false
  }

  onUnmounted(() => {
    unsubscribe()
  })

  return {
    isSubscribed,
    subscribe,
    unsubscribe
  }
}
```

#### 4.4 Refactor useCrossTabSync.ts (Orchestrator)

```typescript
// src/composables/useCrossTabSync.ts (reduced to ~100 LOC)
import { useBroadcastChannelSync } from './sync/useBroadcastChannelSync'
import { useTimerLeaderElection } from './sync/useTimerLeaderElection'
import { useSupabaseRealtimeSync } from './sync/useSupabaseRealtimeSync'
import { useAuthStore } from '@/stores/auth'

export function useCrossTabSync() {
  const authStore = useAuthStore()

  // Initialize sub-composables
  const { tabId, connect, broadcast, onMessage } = useBroadcastChannelSync()

  const { isLeader, claimLeadership, handleLeaderMessage, cleanup: cleanupLeader } =
    useTimerLeaderElection({
      tabId: tabId.value,
      broadcastMessage: (msg) => broadcast('timer_session', msg)
    })

  const { subscribe, unsubscribe } = useSupabaseRealtimeSync({
    userId: authStore.user?.id
  })

  // Set up message handlers
  onMessage('timer_session', handleLeaderMessage)

  const init = () => {
    connect()
    subscribe(
      (payload) => { /* handle task changes */ },
      (payload) => { /* handle timer changes */ }
    )
  }

  const cleanup = () => {
    cleanupLeader()
    unsubscribe()
  }

  return {
    tabId,
    isLeader,
    claimLeadership,
    init,
    cleanup
  }
}
```

### Phase 5: Use VueUse Intervals (2 hours)

Replace manual `setInterval` with VueUse `useIntervalFn`:

```typescript
import { useIntervalFn } from '@vueuse/core'

// In timer.ts
const { pause: pauseTimerInterval, resume: resumeTimerInterval } = useIntervalFn(
  () => {
    if (currentSession.value?.isActive && !currentSession.value?.isPaused) {
      currentSession.value.remainingTime -= 1
      if (currentSession.value.remainingTime <= 0) {
        completeSession()
      }
    }
  },
  1000,
  { immediate: false }
)

// Start timer
const startTimer = () => {
  // ... setup session ...
  resumeTimerInterval()
}

// Stop timer
const stopTimer = () => {
  pauseTimerInterval()
  // ... cleanup ...
}
```

### Phase 6: Update timer.ts to Use New Sync (1-2 hours)

Update timer.ts to import from the new split composables instead of the monolithic useCrossTabSync.

---

## Verification Checklist

### After Each Phase

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Timer starts correctly

### Full Manual Testing

- [ ] Start a work session → timer counts down
- [ ] Pause timer → countdown stops
- [ ] Resume timer → countdown continues
- [ ] Stop timer → session ends
- [ ] Complete session → notification plays, next session starts (if auto)
- [ ] Open second tab → only one tab is leader
- [ ] Close leader tab → other tab becomes leader
- [ ] Timer shows in tab title
- [ ] Favicon changes based on timer state
- [ ] Settings changes (duration) apply to new sessions
- [ ] Timer persists across page refresh

### Multi-Tab Testing

```
1. Open app in Tab A
2. Start timer in Tab A
3. Open Tab B
4. Verify Tab B shows same timer state
5. Close Tab A
6. Verify Tab B becomes leader and timer continues
7. Refresh Tab B
8. Verify timer resumes from correct position
```

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| useCrossTabSync.ts | 1,109 LOC | <100 LOC (orchestrator) |
| New sync composables | 0 | 3 focused files |
| Console.log statements | 38 | 0 |
| Store-in-computed | 2 | 0 |
| Duplicate time format | 2 | 1 shared utility |
| Health Score | 6.5/10 | 8.0+/10 |

---

## Files to Create

- `src/composables/sync/useTimerLeaderElection.ts`
- `src/composables/sync/useBroadcastChannelSync.ts`
- `src/composables/sync/useSupabaseRealtimeSync.ts`
- `src/utils/timer/formatTime.ts`

## Files to Modify

- `src/stores/timer.ts` - Fix computed, use new utils
- `src/composables/useCrossTabSync.ts` - Reduce to orchestrator

## Files NOT to Modify

- `src/components/FaviconManager.vue` - Already clean (8/10)
- Timer UI components

---

## Order of Operations

1. **Phase 1** - Remove 38 console.log (quick win)
2. **Phase 2** - Fix store-in-computed anti-pattern
3. **Phase 3** - Extract time formatting utility
4. **Phase 4** - Split useCrossTabSync (main work)
5. **Phase 5** - Use VueUse intervals
6. **Phase 6** - Wire up new sync to timer store

Commit after each phase for easy rollback.

---

## Reference Patterns

### From Previous Refactors
- `src/stores/settings.ts` - Clean store pattern
- `src/composables/board/useBoardState.ts` - Dependency injection
- `src/utils/calendar/overlapCalculation.ts` - Shared utilities

### VueUse Utilities
```typescript
import { useIntervalFn, useTimeoutFn, watchThrottled } from '@vueuse/core'
```

---

## IMPORTANT RULES

1. **Do NOT break timer functionality** - Test after each change
2. **Multi-tab sync must continue working** - Critical feature
3. **One phase at a time** - Complete, test, commit
4. **Remove console.log aggressively** - 38 → 0
5. **Update MASTER_PLAN.md** - Mark progress as you go
6. **Commit after each phase** - Small, reversible commits

---

## Getting Started

```bash
# 1. Create a new branch
git checkout -b refactor/timer-TASK-194

# 2. Verify current state works
npm run dev
# Start timer, verify it works

# 3. Count console.log before
grep -rn "console\." src/stores/timer.ts src/composables/useCrossTabSync.ts | wc -l
# Should be ~38

# 4. Start with Phase 1 (console removal)
# Remove all console.log statements

# 5. Verify build
npm run build

# 6. Commit phase 1
git add .
git commit -m "refactor(timer): remove 38 console.log statements (TASK-194 Phase 1)"
```

Good luck!
