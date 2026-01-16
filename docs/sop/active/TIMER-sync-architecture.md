# Timer Cross-Device Sync Architecture

**Category**: TIMER
**Status**: Active
**Last Updated**: January 16, 2026
**Related Task**: TASK-017 (KDE Plasma Widget)

---

## Overview

This SOP documents the architecture for synchronizing Pomodoro timer state across multiple devices (Vue.js app + KDE Plasma widget) using Supabase as the source of truth.

## Architecture Diagram

```
┌─────────────────────┐     Supabase Realtime      ┌─────────────────────┐
│     Vue.js App      │◄────── WebSocket ──────────►│    timer_sessions   │
│   (Device Leader)   │                             │       (Postgres)    │
└─────────────────────┘                             └─────────────────────┘
         │                                                    ▲
         │ Writes heartbeat                                   │
         │ every 10 seconds                                   │
         ▼                                                    │
┌─────────────────────┐     REST API Polling        ┌─────────────────────┐
│   KDE Widget        │◄────── every 2 sec ─────────►│                     │
│   (Follower)        │                             │  POST/PATCH/GET     │
└─────────────────────┘                             └─────────────────────┘
```

---

## Core Concepts

### 1. Device Leadership Model

Only ONE device actively counts down and writes to the database at a time. This prevents conflicts.

| Role | Responsibilities |
|------|------------------|
| **Leader** | Runs local countdown, sends heartbeats every 10s, writes `remaining_time` to DB |
| **Follower** | Polls DB every 2s, displays DB value, applies drift correction |

### 2. Leadership Takeover Rules

A device can become leader when:

1. **No current leader** - `device_leader_id` is null or empty
2. **Stale leadership** - `device_leader_last_seen` is >30 seconds old
3. **User explicit action** - User clicks start/pause on any device (takes precedence)

### 3. Heartbeat Mechanism

The leader sends a PATCH request every 10 seconds:

```typescript
// Leader heartbeat (timer.ts)
const heartbeatInterval = setInterval(async () => {
  if (!isRunning.value || !currentSession.value) return

  await supabase
    .from('timer_sessions')
    .update({
      remaining_time: timeRemaining.value,
      device_leader_last_seen: new Date().toISOString()
    })
    .eq('id', currentSession.value.id)
}, 10000)
```

### 4. Drift Correction Algorithm

Followers must account for time elapsed since the leader's last heartbeat:

```typescript
function applyDriftCorrection(session: TimerSession): number {
  if (!session.device_leader_last_seen) {
    return session.remaining_time
  }

  const lastSeen = new Date(session.device_leader_last_seen).getTime()
  const now = Date.now()
  const elapsedSeconds = Math.floor((now - lastSeen) / 1000)

  // Only apply drift if within reasonable bounds (0-30s)
  if (elapsedSeconds > 0 && elapsedSeconds < 30) {
    return Math.max(0, session.remaining_time - elapsedSeconds)
  }

  return session.remaining_time
}
```

---

## Database Schema

### timer_sessions Table

```sql
CREATE TABLE timer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  task_id TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL,           -- Total session length in seconds
  remaining_time INTEGER NOT NULL,     -- Current countdown value
  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  is_break BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  device_leader_id TEXT,               -- 'vue-app' or 'kde-widget'
  device_leader_last_seen TIMESTAMPTZ, -- Heartbeat timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy: Users can only access their own sessions
ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own sessions" ON timer_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Implementation Details

### Vue.js App (Leader-Capable)

**File**: `src/stores/timer.ts`

#### Auth-Aware Initialization (CRITICAL)

The timer store must wait for authentication before loading sessions:

```typescript
import { watch } from 'vue'
import { useAuthStore } from './auth'

const authStore = useAuthStore()
const hasLoadedSession = ref(false)

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
  if (saved) {
    // Apply drift correction and resume
    const correctedTime = applyDriftCorrection(saved)
    timeRemaining.value = correctedTime
    // ... setup session
  }
}

// Watch for auth state changes
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
```

#### Fluid Leadership (User Action Takes Precedence)

```typescript
const startTimer = async () => {
  // Clear any existing session - user's explicit action takes precedence
  await clearExistingSession()

  // Create new session with this device as leader
  const session = {
    user_id: authStore.userId,
    duration: workDuration.value * 60,
    remaining_time: workDuration.value * 60,
    is_active: true,
    is_paused: false,
    is_break: false,
    device_leader_id: 'vue-app',
    device_leader_last_seen: new Date().toISOString()
  }

  const { data } = await supabase
    .from('timer_sessions')
    .insert(session)
    .select()
    .single()

  // Start local countdown
  startCountdown()
}
```

### KDE Plasma Widget (Follower)

**File**: `kde-widget/package/contents/ui/main.qml`

#### Polling Every 2 Seconds

```qml
Timer {
    id: syncTimer
    interval: 2000  // 2 seconds for responsive sync
    running: root.isAuthenticated
    repeat: true
    onTriggered: fetchCurrentSession()
}

function fetchCurrentSession() {
    if (!isAuthenticated) return

    var xhr = new XMLHttpRequest()
    var url = supabaseUrl + "/rest/v1/timer_sessions" +
        "?user_id=eq." + userId +
        "&is_active=eq.true" +
        "&select=*" +
        "&order=updated_at.desc" +
        "&limit=1"

    xhr.open("GET", url, true)
    xhr.setRequestHeader("apikey", supabaseKey)
    xhr.setRequestHeader("Authorization", "Bearer " + accessToken)

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            var sessions = JSON.parse(xhr.responseText)
            if (sessions.length > 0) {
                var s = sessions[0]

                // Apply drift correction
                var correctedTime = s.remaining_time
                if (s.device_leader_last_seen) {
                    var lastSeen = new Date(s.device_leader_last_seen)
                    var now = new Date()
                    var drift = Math.floor((now - lastSeen) / 1000)
                    if (drift > 0 && drift < 30) {
                        correctedTime = Math.max(0, s.remaining_time - drift)
                    }
                }

                secondsRemaining = correctedTime
                isRunning = s.is_active && !s.is_paused
                isWorkSession = !s.is_break
                hasActiveSession = true
            } else {
                hasActiveSession = false
            }
        }
    }
    xhr.send()
}
```

#### Widget Starting Timer (Becomes Leader)

```qml
function startNewSession(isBreak) {
    var sessionId = generateUUID()
    var duration = isBreak ? breakDuration * 60 : workDuration * 60

    var payload = {
        id: sessionId,
        user_id: userId,  // CRITICAL: Required for RLS
        task_id: "general",
        start_time: new Date().toISOString(),
        duration: duration,
        remaining_time: duration,
        is_active: true,
        is_paused: false,
        is_break: isBreak,
        device_leader_id: "kde-widget",
        device_leader_last_seen: new Date().toISOString()
    }

    var xhr = new XMLHttpRequest()
    xhr.open("POST", supabaseUrl + "/rest/v1/timer_sessions", true)
    xhr.setRequestHeader("apikey", supabaseKey)
    xhr.setRequestHeader("Authorization", "Bearer " + accessToken)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("Prefer", "return=representation")
    xhr.send(JSON.stringify(payload))
}
```

---

## Design Colors (IMPORTANT)

The widget must match the main app's visual style:

| Session Type | Color | CSS Variable |
|--------------|-------|--------------|
| Work | `#4ECDC4` (Teal) | `--color-primary` |
| Break | `#F59E0B` (Orange/Amber) | `--color-warning` |

```qml
// KDE Widget colors
readonly property color workColor: "#4ECDC4"
readonly property color breakColor: "#F59E0B"
```

---

## Troubleshooting

### Issue: Timer Doesn't Persist After Hard Refresh

**Symptom**: Timer shows 25:00 after refresh even though session was running

**Root Cause**: Race condition - `initializeStore()` runs before auth is ready, so `userId` is null and `fetchActiveTimerSession()` returns nothing.

**Solution**: Use `watch` on `authStore.isAuthenticated` with `immediate: true` to wait for auth:

```typescript
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated && !hasLoadedSession.value) {
      initializeStore()
    }
  },
  { immediate: true }
)
```

### Issue: "Blocked: Another Device Leading"

**Symptom**: User can't start timer from widget because app is "leading"

**Root Cause**: Old logic blocked new sessions if another device was leading (even if stale)

**Solution**: User's explicit action takes precedence - clear existing session before starting:

```typescript
const startTimer = async () => {
  await clearExistingSession()  // User action = take control
  // ... create new session
}
```

### Issue: 3-5 Second Drift Between Devices

**Symptom**: Widget shows 24:37, app shows 24:34

**Root Cause**: Both devices running independent countdowns without reconciliation

**Solution**:
1. One device is leader (runs countdown, writes heartbeat)
2. Other devices are followers (poll and display DB value with drift correction)
3. Reduce poll interval to 2 seconds for tighter sync

### Issue: WebSocket 403 on Realtime

**Symptom**: App doesn't receive realtime updates

**Root Cause**: JWT key mismatch between `.env.local` and local Supabase secret

**Solution**: Run `npm run generate:keys` and update `.env.local`

---

## Testing Checklist

- [ ] Start timer in app, widget shows same time (within 2s)
- [ ] Start timer in widget, app shows same time immediately
- [ ] Pause in app, widget shows paused within 2s
- [ ] Pause in widget, app shows paused immediately
- [ ] Hard refresh app with running timer, timer resumes at correct time
- [ ] Close and reopen widget, timer syncs from DB
- [ ] Let timer run 5+ minutes, verify no drift accumulation
- [ ] Both devices show same colors (teal for work, orange for break)

---

## Related Files

| File | Purpose |
|------|---------|
| `src/stores/timer.ts` | Main timer store with leadership logic |
| `src/composables/useSupabaseDatabase.ts` | Database operations including timer sessions |
| `kde-widget/package/contents/ui/main.qml` | KDE widget implementation |
| `src/stores/auth.ts` | Authentication state |

---

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [KDE Plasma Widget Development](https://develop.kde.org/docs/plasma/widget/)
- TASK-017 implementation in `docs/MASTER_PLAN.md`
