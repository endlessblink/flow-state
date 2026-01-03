# SOP: Timer Cross-Device Sync Fix

**Date**: December 19, 2025
**Task ID**: TASK-021
**Related**: BUG-016, ISSUE-007
**Status**: RESOLVED

---

## Problem Summary

Timer synchronization was not working across different browser instances or devices. When a timer was started on Device A, it would not appear on Device B, or the times would be significantly out of sync.

---

## Root Cause Analysis

### Primary Issue: Event Never Dispatched

The timer store was listening for `reliable-sync-change` events to detect remote timer updates:

```typescript
// timer.ts (old code)
window.addEventListener('reliable-sync-change', handleRemoteSyncChange)
```

**However**, this event was **NEVER dispatched** during live CouchDB sync!

| Location | Issue |
|----------|-------|
| `useReliableSyncManager.ts:1046-1063` | Live sync `on('change')` handler does NOT dispatch `reliable-sync-change` |
| `useReliableSyncManager.ts:273-316` | `_setupSyncEventHandlers()` would dispatch the event, but is NEVER CALLED (dead code with `_` prefix) |
| `timer.ts:260-279` | Listens for event that never arrives |

### Secondary Issue: Clock Sync

Even after fixing the event issue, timers were ~2-5 seconds out of sync because:

- `calculateRemainingTime()` used `Date.now()` (local device time)
- Device clocks differ by seconds, causing desync

---

## Solution

### Fix 1: Direct PouchDB Changes Feed

Created `src/composables/useTimerChangesSync.ts` that uses PouchDB's native changes API:

```typescript
pouchDb.changes({
  live: true,
  since: 'now',
  include_docs: true,
  doc_ids: ['pomo-flow-timer-session:data']  // Filter to timer only
}).on('change', (change) => {
  if (change.doc) {
    handleRemoteTimerUpdate(change.doc)
  }
})
```

**Benefits**:
- Bypasses broken event system
- Filters to only timer document (efficient)
- Real-time updates via CouchDB changes feed
- Auto-reconnect on error (5 attempts)

### Fix 2: Leader Timestamp for Clock Sync

Updated `calculateRemainingTime()` to use the leader's timestamp:

```typescript
const calculateRemainingTime = (session, leaderTimestamp?) => {
  if (leaderTimestamp) {
    // Account for clock differences between devices
    const timeSinceSave = Date.now() - leaderTimestamp
    const leaderElapsedAtSave = leaderTimestamp - session.startTime.getTime()
    const totalElapsed = leaderElapsedAtSave + timeSinceSave
    return Math.max(0, session.duration - Math.floor(totalElapsed / 1000))
  }
  // Fallback to local time
  return Math.max(0, session.duration - Math.floor((Date.now() - session.startTime.getTime()) / 1000))
}
```

### Fix 3: Data Structure Mismatch in loadTimerSession (Session 2)

**Problem**: Timer not appearing without page refresh, drift between tabs.

**Root Cause**: `loadTimerSession` expected flat properties but `db.load()` returns nested structure:

```typescript
// db.load() returns:
{
  session: { id, taskId, startTime, duration, isActive, ... },
  deviceLeaderId: 'device_xxx',
  deviceLeaderLastSeen: 1734637200000
}

// Old code expected flat structure:
if (saved && saved.isActive) {  // ❌ undefined!
  const startTime = new Date(saved.startTime)  // ❌ undefined!
```

**Fix** (`timer.ts:945-1042`):
```typescript
interface SavedTimerDocument {
  session?: SavedSessionData | null
  deviceLeaderId?: string | null
  deviceLeaderLastSeen?: number | null
}
const saved = await db.load<SavedTimerDocument>('pomo-flow-timer-session')
const savedSession = saved?.session

if (savedSession && savedSession.isActive) {  // ✅ Correct
  const startTime = new Date(savedSession.startTime)  // ✅ Correct
```

### Fix 4: Changes Feed Handler Extracting Nested Data (Session 2)

**Problem**: Changes feed callback received raw PouchDB doc but handler expected flat structure.

**Root Cause**: PouchDB changes feed returns `{ _id, _rev, data: {...} }` but handler expected `{ session, deviceLeaderId, ... }`.

**Fix** (`timer.ts:301-324`):
```typescript
// Before (wrong):
timerChangesSync.startListening(async (doc: RemoteTimerDoc) => {
  await handleRemoteTimerUpdate(doc)  // ❌ doc has wrong structure
})

// After (correct):
timerChangesSync.startListening(async (rawDoc: any) => {
  const timerData = rawDoc.data as RemoteTimerDoc  // ✅ Extract nested data
  if (!timerData) return
  await handleRemoteTimerUpdate(timerData)
})
```

### Fix 5: Sync Status Debouncing (Session 2)

**Problem**: Sync indicator flickered constantly between "Online" and "Syncing".

**Root Cause**: Live sync triggers status changes every ~500ms during replication.

**Fix** (`SyncStatusIndicator.vue:235-276`):
```typescript
const STATUS_DEBOUNCE_MS = 1500  // 1.5 second debounce

watch(() => syncManager.syncStatus.value, (newStatus, oldStatus) => {
  // Immediate for error/offline (important states)
  if (['error', 'offline', 'resolving_conflicts'].includes(newStatus)) {
    stableSyncStatus.value = newStatus
    return
  }

  // Debounce syncing<->complete transitions
  if ((oldStatus === 'syncing' && newStatus === 'complete') ||
      (oldStatus === 'complete' && newStatus === 'syncing')) {
    statusDebounceTimer = setTimeout(() => {
      stableSyncStatus.value = newStatus
    }, STATUS_DEBOUNCE_MS)
  }
})
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/composables/useTimerChangesSync.ts` | **NEW** - Direct PouchDB changes feed composable |
| `src/stores/timer.ts` | Integrated composable, fixed data structure, fixed changes handler |
| `src/composables/useDatabase.ts` | Fixed sync manager init order, auto-start live sync |
| `src/components/SyncStatusIndicator.vue` | Added debounced status to prevent flickering |

---

## Root Causes Summary (All Fixed)

| # | Issue | Root Cause | Fix |
|---|-------|------------|-----|
| 1 | Event never dispatched | `reliable-sync-change` dead code | Direct PouchDB changes feed |
| 2 | Timer not appearing without refresh | Data structure mismatch (`saved.*` vs `saved.session.*`) | Fixed path in loadTimerSession |
| 3 | Changes feed not updating timer | Raw doc passed (need `rawDoc.data`) | Extract nested data before handler |
| 4 | Clock drift between devices | Using local `Date.now()` | Leader timestamp compensation |
| 5 | Sync status flickering | Rapid live sync status changes | 1.5s debounce on transitions |

---

## Testing Verification

### Test Steps
1. Open app in two different browsers (Chrome + Firefox)
2. Enable CouchDB sync in settings
3. Start timer on Browser A
4. Verify timer appears on Browser B within 2 seconds
5. Verify times are in sync (within 1 second)

### Console Indicators (Success)
```
[TIMER CHANGES] Starting changes feed listener for: pomo-flow-timer-session:data
[TIMER CHANGES] Received timer update from changes feed
📡 [TIMER CROSS-DEVICE] Received remote timer update via changes feed
🔄 [TIMER CROSS-DEVICE] Updated session, remaining: XX seconds, leader timestamp: XXXX
```

---

## Rollback Procedure

If issues arise, rollback with:

```bash
git checkout HEAD -- src/composables/useTimerChangesSync.ts src/stores/timer.ts
# Then remove the new file
rm src/composables/useTimerChangesSync.ts
```

---

## Lessons Learned

1. **Don't trust event names** - Verify events are actually dispatched before relying on them
2. **Check for dead code** - Functions prefixed with `_` may never be called
3. **Use PouchDB's native APIs** - `db.changes()` with `doc_ids` filter is the official pattern for real-time updates
4. **Account for clock differences** - Cross-device sync must use server/leader timestamps, not local `Date.now()`

---

## Related Documentation

- [PouchDB Changes Feed Guide](https://pouchdb.com/guides/changes.html)
- [PouchDB API Reference](https://pouchdb.com/api.html)
- TASK-021 in MASTER_PLAN.md
