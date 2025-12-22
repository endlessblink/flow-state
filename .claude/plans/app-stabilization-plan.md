# App Stabilization Plan - Emergency Recovery

**Date**: 2025-12-22
**Status**: IN PROGRESS
**Goal**: Return app to stable, working state

---

## Current Issues Summary

### Critical (Blocking)
1. **Sync Loop** - App syncs every 5-7 seconds indefinitely
   - Conflicts growing: projects:data (67→75), canvas:data (53→60)
   - Task deletions don't persist (get reset by sync)
   - 1000+ console logs flooding browser

2. **CanvasView.vue Broken** - 16 TypeScript errors
   - Missing template bindings: `handleEditTask`, `closeBatchEditModal`, `closeSectionSettingsModal`, `handleSectionSettingsSave`
   - Vue warnings spam on every render

### High Priority
3. **App.vue Issues** - 3 TypeScript errors
   - Missing: `projectContextMenuX`, `projectContextMenuY`, `contextMenuProject`

4. **Other TS Errors** (3 files, 1 error each)
   - `individualTaskStorage.ts` - Type conversion issue
   - `GroupModal.vue` - Prop type mismatch
   - `CalendarViewVueCal.vue` - RecurrenceException type

### Pending Changes (uncommitted)
- 9 modified files
- 3 untracked directories

---

## Root Cause Analysis

### Sync Loop Root Cause
```
1. startLiveSync() or initializeSync() → calls sync
2. Sync pulls changes → triggers loadFromDatabase()
3. loadFromDatabase() may trigger debouncedSave()
4. Save writes to DB → triggers sync change event
5. Loop back to step 2
```

### CanvasView.vue Root Cause
- Template references functions that don't exist in script setup
- Likely from incomplete refactoring or merge conflicts
- Functions defined in composables but not exposed to template

---

## Two-Instance Work Division

### INSTANCE A: Sync System Stabilization
**Focus**: Fix sync loop and data persistence

#### Phase A1: Stop the Bleeding (30 min)
1. **Disable live sync temporarily**
   - Comment out `startLiveSync()` call
   - Set sync to manual-only mode

2. **Reduce logging verbosity**
   - Add log level control
   - Remove redundant console.logs

3. **Test**: Verify sync stops looping

#### Phase A2: Fix Sync Architecture (1-2 hours)
1. **Add sync guard flags**
   ```typescript
   let isReloadingFromSync = false
   // In loadFromDatabase: check flag, skip saves
   // In sync handler: set flag before reload
   ```

2. **Fix loadFromDatabase loop**
   - Don't trigger debouncedSave during reload
   - Use REPLACE instead of MERGE for sync data

3. **Resolve existing conflicts**
   - Clean up projects:data conflicts (75+)
   - Clean up canvas:data conflicts (60+)
   - Use CouchDB admin to purge old revisions

4. **Test**: Create task → refresh → verify persists

#### Phase A3: Re-enable Sync (30 min)
1. Re-enable live sync with guards
2. Verify no loops
3. Test cross-browser sync

---

### INSTANCE B: CanvasView.vue Stabilization
**Focus**: Fix TypeScript errors and missing bindings

#### Phase B1: Audit Missing Functions (30 min)
1. **List all missing template bindings**:
   - `handleEditTask`
   - `closeBatchEditModal`
   - `handleBatchEditApplied`
   - `closeSectionSettingsModal`
   - `handleSectionSettingsSave`
   - `handleDrop`
   - `getStatusFilterLabel`
   - `clearStatusFilter`
   - `handleSectionUpdate`
   - `handleSectionContextMenu`
   - `handleOpenSectionSettings`

2. **Trace where they should come from**:
   - Which composable provides them?
   - Are they defined but not exported?

#### Phase B2: Fix Missing Bindings (1-2 hours)
1. **For each missing function**:
   - Find definition (if exists)
   - Add to script setup exports
   - OR create stub function if missing

2. **Fix node type errors** (line 199)
   - VueFlow nodeTypes prop type mismatch

3. **Fix connection handler** (line 231)
   - Function type signature issue

#### Phase B3: Fix Other Files (30 min)
1. `App.vue` - Add missing context menu refs
2. `GroupModal.vue` - Fix prop type
3. `individualTaskStorage.ts` - Fix type cast
4. `CalendarViewVueCal.vue` - Fix RecurrenceException

#### Phase B4: Verify (15 min)
1. Run `npx vue-tsc --noEmit` - should be 0 errors
2. Run `npm run build` - should succeed
3. Test Canvas view loads without Vue warnings

---

## Coordination Points

### Shared Files (Conflict Risk)
- `src/stores/tasks.ts` - Both may touch
- `src/composables/useReliableSyncManager.ts` - Instance A owns

### Communication Protocol
1. Instance A completes Phase A1 first (stops sync)
2. Instance B can work independently on CanvasView
3. Sync before any shared file edits

### Success Criteria
- [ ] No sync loop (verify with console)
- [ ] Tasks persist after refresh
- [ ] Canvas loads without errors
- [ ] `npx vue-tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Rollback Plan

If things get worse:
```bash
# Stash current changes
git stash push -m "stabilization-attempt-$(date +%Y%m%d-%H%M)"

# Return to last known good commit
git checkout 42cf655  # fix(BUG-025): Resolve stale data loading

# Restart fresh
npm run dev
```

---

## Quick Start Commands

```bash
# Instance A - Focus on sync
# 1. Kill dev server, restart fresh
npm run kill && npm run dev

# 2. Check sync status
curl -s -u admin:pomoflow-2024 "http://84.46.253.137:5984/pomoflow-tasks" | jq .doc_count

# Instance B - Focus on CanvasView
# 1. Check current TS errors
npx vue-tsc --noEmit 2>&1 | grep CanvasView

# 2. Find missing function definitions
grep -n "handleEditTask\|closeBatchEditModal" src/views/CanvasView.vue
```
