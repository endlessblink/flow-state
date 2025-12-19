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

---

## Files Changed

| File | Change |
|------|--------|
| `src/composables/useTimerChangesSync.ts` | **NEW** - Direct PouchDB changes feed composable |
| `src/stores/timer.ts` | Integrated new composable, fixed clock sync calculation |

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
