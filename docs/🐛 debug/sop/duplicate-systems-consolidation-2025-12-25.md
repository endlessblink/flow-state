# SOP: Duplicate Systems Consolidation (TASK-039)

**Date**: December 25, 2025
**Status**: ✅ COMPLETE
**Tracking**: `docs/MASTER_PLAN.md` → TASK-039

---

## Quick Reference: The "New World"

**Following TASK-039, these are the primary systems that should be used:**

| Area | Primary System | Location | Replaces (NOW DELETED) |
|------|----------------|----------|-------------------------|
| **Conflict Management** | `ConflictResolver` | `src/utils/conflictResolver.ts` | `conflictResolution.ts` |
| **Backup System** | `useBackupSystem` | `src/composables/useBackupSystem.ts` | `localBackupManager.ts` |
| **Sync Management** | `useReliableSyncManager` | `src/composables/useReliableSyncManager.ts` | `unifiedSyncQueue.ts`, `syncCircuitBreaker.ts` |
| **Offline Storage** | `OfflineQueue` | `src/utils/offlineQueue.ts` | `unifiedSyncQueue.ts` |

---

## Problem Summary

The codebase had accumulated multiple overlapping utilities for core operations (Backup, Sync, Conflict Management). This caused:
- **Developer Confusion**: Unclear which utility to use for a new feature.
- **Maintenance Burden**: Changes in logic (like a Task interface update) required updating 3-4 different files.
- **Bug Surface Area**: Potential for "ghost" behaviors from obsolete systems still partially linked in the background.

---

## Technical Details

### 1. Conflict Management Consolidation

**Action**: Merged `ConflictResolutionEngine` logic into `ConflictResolver`.

- **Old Logic**: `conflictResolution.ts` had advanced field-level rules (e.g., merging title vs. description).
- **Consolidation**: These "Smart Merge" rules were moved into `conflictResolver.ts`.
- **Primary Entry Point**: The `ConflictResolver` class now handles both basic strategy selection (Last Write Wins, etc.) and deep data merging.

### 2. Backup System Migration

**Action**: Decoupled `useReliableSyncManager` from the legacy manual manager.

- **Old Path**: Sync Manager → `localBackupManager.ts` (Manual PouchDB logic).
- **New Path**: Sync Manager → `useBackupSystem.ts` (Unified logic used by Settings UI).
- **Key Change**: `backupManager.createBackup(data)` became `backupSystem.createBackup('auto')`.

### 3. Sync Logic Streamlining

**Action**: Removed obsolete scaffolding replaced by more robust Phase 2 systems.

- **Removed `unifiedSyncQueue.ts`**: Replaced by `offlineQueue.ts` which has better retry logic and persistent storage support.
- **Removed `syncCircuitBreaker.ts`**: The Health Monitoring and Cooldown logic was already integrated directly into `useReliableSyncManager.ts`. Keeping the separate class was redundant.

---

## Files Deleted (CRITICAL)

The following files were removed. **DO NOT** attempt to restore them or import from them:
1. `src/utils/conflictResolution.ts`
2. `src/utils/localBackupManager.ts`
3. `src/utils/unifiedSyncQueue.ts`
4. `src/utils/syncCircuitBreaker.ts`
5. `src/types/databaseTypes.ts` (Definitions merged into `global.d.ts` or made local).

---

## Coordinate Cleanup: useDatabase.ts

A common point of failure uncovered during this task was `useDatabase.ts` retaining a link to `localBackupManager`.

**If you see a 404 for `localBackupManager.ts` in the browser console:**
1. Check `src/composables/useDatabase.ts`.
2. Ensure no imports or comments reference `IBackupDataSource` or `localBackupManager`.
3. Check `src/composables/useReliableSyncManager.ts` to ensure it only imports `useBackupSystem`.

---

## Verification Checklist

If changes are made to core sync/backup logic, run these checks:

- [ ] **Sync Test Suite**: Run `src/utils/syncTestSuite.ts` (check for green status on all basic operations).
- [ ] **App Load**: Open browser at `http://localhost:5546` and ensure no 404 errors in the Network tab.
- [ ] **Manual Backup**: Go to Settings → Backup and click "Create Backup". Verify history updates.
- [ ] **Conflict Test**: Simulate a conflict (e.g., by editing same task in two tabs/browsers) and ensure `ConflictResolver` handles the resolution without crashing.

---

**Last Updated**: December 25, 2025
**Author**: Claude Code (TASK-039 Cleanup)
