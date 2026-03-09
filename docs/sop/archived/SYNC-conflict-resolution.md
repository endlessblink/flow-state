# SOP: Sync Conflict Resolution & Hardening (ROAD-013)
**Last Updated:** December 27, 2025
**Scope:** PouchDB Synchronization, Conflict Detection, Resolution Strategies

## 1. Overview
This SOP details the mechanism implemented to resolve the "151 conflicts" issue where PouchDB revision conflicts were accumulating silently. It explains how the system now detects hidden conflicts and ensures they are permanently removed from the database.

## 2. The Issue: Zombie Conflicts
PouchDB uses a revision tree to track history. When two clients edit the same document `rev-1` concurrently:
- Client A produces `rev-2a`
- Client B produces `rev-2b`

Standard sync creates a conflict. PouchDB picks a "winning" revision deterministically (e.g. `rev-2a`).
**The problem:** The losing revision (`rev-2b`) is NOT deleted. It stays in the database as an *internal conflict*. Application logic that only looks at `doc.title` sees the winner and ignores the loser, causing conflicts to pile up indefinitely.

## 3. The Fix: Bulk Delete Resolution
We implemented a two-part hardening strategy:

### A. Active Detection (`ConflictDetector.ts`)
The detector used to only compare the "current" head revision of Local vs Remote. It now explicitly queries for internal conflicts:
```typescript
const allDocs = await localDB.allDocs({ include_docs: true, conflicts: true })
// Checks for doc._conflicts array
```
Any document with `_conflicts.length > 0` is flagged as `CONFLICT_REVISION` (Severity: High).

### B. Bulk Deletion (`useReliableSyncManager.ts`)
When resolving a conflict, we no longer just `put()` the winner. We perform a `bulkDocs` operation that:
1. Updates the Winner (new revision).
2. **Explicitly Deletes** all losing revisions.

```typescript
const bulkDocs = [
  { ...winnerDoc, _rev: winnerRev },
  { _id: docId, _rev: loserRev1, _deleted: true }, // 🗑️
  { _id: docId, _rev: loserRev2, _deleted: true }  // 🗑️
]
await db.bulkDocs(bulkDocs)
```
This prunes the revision tree, ensuring `_conflicts` becomes empty.

## 4. Verification Procedure

### Automated Verification
Run the reproduction test which simulates this exact scenario:
```bash
npx vitest run tests/sync/conflict-reproduction.spec.ts -c vitest.sync.config.ts
```
**Expected Output:** Pass (1 test).
If this test fails, it means the bulk deletion logic is not propagating deletions correctly.

### Manual Verification
1. Open DevTools -> Application -> Storage -> IndexedDB -> `_pouch_flow_state_local`.
2. Find a document that had conflicts.
3. In Console run:
   ```javascript
   await window.pomoFlowDb.get('task-id', { conflicts: true })
   ```
4. Verify `_conflicts` property is `undefined` or empty array.

## 5. Other Sync Scenarios to Monitor

### Delete-Edit Conflict
**Scenario:** User A deletes Task X. User B edits Task X.
**Resolution:** "Deletion Wins" rule (implemented in `ConflictResolver.ts`).
**Risk:** User B's edit might resurrect the task if not properly handled.
**Mitigation:** `resolvePreserveNonDeleted` strategy explicitly handles this.

### Offline Queue
**Scenario:** User makes 50 edits while offline, then connects.
**Resolution:** `OfflineQueue` replays changes.
**Risk:** Race conditions if sync triggers mid-replay.
**Status:** Managed by `useReliableSyncManager` serialization.

### Cross-Entity Integrity
**Scenario:** User A deletes Project P. User B adds Task T to Project P.
**Resolution:** Application layer must handle orphaned tasks (e.g., move to Inbox).
**Status:** Handled by UI logic (not DB sync layer).
