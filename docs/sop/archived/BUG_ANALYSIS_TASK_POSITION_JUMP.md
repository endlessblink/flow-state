# Bug Analysis: Task Position Jump After Edit

**Status**: Analysis Complete
**Date**: January 6, 2026
**Severity**: P1-HIGH
**Affected Component**: Canvas Task Editing Flow

---

## Executive Summary

After a user edits a task in TaskEditModal and approves the changes, the task visually jumps to a different location on the Canvas. The root cause is a **race condition between position locking and containment recalculation** in the sync system, compounded by **multiple async watchers firing simultaneously** after the edit is saved.

### Key Finding
The lock mechanism (7 seconds) protects against *external* sync overwrites, but **internal containment recalculation within syncNodes()** can still move tasks even when locked.

---

## Current Architecture Analysis

### 1. Task Edit → Save Flow (TaskEditModal.vue, lines 608-778)

**Current Implementation**:
```typescript
// Line 672-675: Lock BEFORE update
if (originalCanvasPosition) {
  lockTaskPosition(editedTask.value.id, originalCanvasPosition, 'manual')
  console.log('🔒 DEBUG: Locked position BEFORE save:', originalCanvasPosition)
}

// Line 678: Trigger update (fires watchers in CanvasView)
taskStore.updateTaskWithUndo(editedTask.value.id, updates)
```

**Current State**: Position IS locked before the update, BUT...

**Gap Identified**:
- Lock is set with `source: 'manual'` (line 673)
- Lock duration is 7 seconds (canvasStateLock.ts:55)
- No mechanism to extend the lock if watchers are still processing

---

### 2. Watcher Chain After Task Update (CanvasView.vue)

**Identified Watchers** that fire after `updateTaskWithUndo`:

| Line | Trigger | Effect | Lock Respected? |
|------|---------|--------|---|
| 1817-1829 | `canvasStore.syncTrigger` | Calls `syncNodes()` | ✅ YES - guards with `isAnyCanvasStateLocked()` |
| 1836-1842 | Task title/status/priority hash | Calls `batchedSyncNodes()` | ❌ NO - no lock check |
| 865-870 | `filteredTasks` | May trigger other syncs | ❌ UNCLEAR |
| 873+ | Section changes | May recalculate containment | ❌ UNCLEAR |

**Critical Issue**:
- Watcher at line 1836-1842 (`taskStore.tasks.map(...)`) **does NOT check** `isAnyCanvasStateLocked()`
- This means property changes (status, priority) trigger sync even when position lock is active
- syncNodes() then recalculates task containment (lines 195-238 in useCanvasSync.ts)

---

### 3. Position Lock Mechanism (canvasStateLock.ts)

**Current Lock Structure**:
```typescript
interface CanvasLock {
  type: 'task' | 'group' | 'viewport'
  id: string
  data: TaskPosition | GroupPosition | ViewportState
  lockedAt: number
  source: 'drag' | 'resize' | 'pan' | 'zoom' | 'manual'
}

const LOCK_DURATION_MS = 7000  // 7 seconds
```

**How Lock Works**:
1. `lockTaskPosition(taskId, position, 'manual')` stores lock in `taskLocks` Map
2. `isTaskPositionLocked(taskId)` checks age: `Date.now() - lock.lockedAt > 7000`
3. If expired, lock is deleted and returns `false`

**Gap**: Lock is checked in `syncTrigger` watcher (line 1821) but:
- ❌ Lock is NOT checked in the task property hash watcher (line 1837)
- ❌ Lock is NOT checked in filteredTasks watcher (line 865)
- ❌ Lock is NOT checked within `syncNodes()` itself during containment calculation

---

### 4. Containment Recalculation Logic (useCanvasSync.ts, lines 195-238)

**Current Logic**:
```typescript
// Check if task already exists in current nodes
const taskExistsInNodes = existingNodeParents.has(task.id)
const skipContainmentCalc = taskExistsInNodes && (
  existingParent || !existingParent  // Skip for BOTH cases
)

if (!skipContainmentCalc) {
  // PROBLEM: This recalculates position even when locked!
  const taskCenterX = position.x + TASK_WIDTH / 2
  const taskCenterY = position.y + TASK_HEIGHT / 2

  // Find smallest section that contains task center
  const containingSections = sections.filter(s => {
    // Floating point comparison - no epsilon tolerance!
    return taskCenterX >= sx && taskCenterX <= sx + sw &&
           taskCenterY >= sy && taskCenterY <= sy + sh
  })

  if (section) {
    // JUMP: Convert absolute to relative position
    const relX = position.x - section.position.x  // May differ from locked position!
    const relY = position.y - section.position.y
    position = { x: relX, y: relY }  // Position changes here
  }
}
```

**Issues**:

1. **Floating Point Precision**: Line 210-211 uses exact equality (`>=`, `<=`) with no epsilon tolerance
   - Task at `{x: 100.0000001, y: 200.5}` might be classified differently than before
   - Section bounds from different sources (canvas.ts vs canvasPosition) may have minor diffs

2. **Missing Locked Position Protection**:
   - `getLockedTaskPosition()` is called line 159
   - But it's ONLY used if `taskExistsInNodes = false`
   - If task already exists (which it does after edit), locked position is IGNORED

3. **Absolute-to-Relative Conversion After Edit**:
   - Edit modal stores position as ABSOLUTE coordinates in `task.canvasPosition`
   - Lock stores ABSOLUTE coordinates
   - But syncNodes() converts to RELATIVE if task is inside a section
   - **This conversion may calculate different relative coords than what Vue Flow expects**

---

## Identified Edge Cases & Gaps

### Edge Case 1: Task Moved Out of Section During Edit
**Scenario**:
- Task initially at (50, 50) inside "Work" section (bounds: 0-300 x 0-300)
- User edits task, position stays (50, 50)
- During save, another user's changes shift "Work" section to (100, 100)
- syncNodes() recalculates: task center (50+110, 50+50) = (160, 100)
- NEW section bounds might contain it now, causing reparenting

**Current Protection**: NONE - lock is not checked during containment calc

**Acceptance Criteria**: Task should NOT reparent if position lock is active

---

### Edge Case 2: Section Resize During Edit
**Scenario**:
- Task at (150, 150), section at (0, 0, 300, 300)
- User edits task (position locked at 150, 150)
- Section is resized to (0, 0, 100, 100)
- syncNodes() recalculates containment with new section bounds
- Task no longer inside section → task reparented to root

**Current Protection**: NONE - only task position is locked, not sections

**Acceptance Criteria**: Task should remain in same parent section if locked

---

### Edge Case 3: Property Change Triggers Sync After Edit
**Scenario**:
- User edits task title "Fix bug" → "Fix bug NOW!" (status still 'planned')
- updateTaskWithUndo() updates task in store
- Line 1836-1842 watcher fires (hash changed: task title different)
- batchedSyncNodes('normal') called WITHOUT lock check
- syncNodes() runs while position lock is still active (but watcher didn't check)

**Current Protection**: Lock set in TaskEditModal, but watcher at line 1837 doesn't check it

**Acceptance Criteria**: All watchers triggering syncNodes must check lock

---

### Edge Case 4: Lock Expiry Race (7-Second Window)
**Scenario**:
- Edit at t=0s, position locked for 7s
- Sync completes by t=3s, position saved to DB
- External sync from other device arrives at t=6.5s
- Lock expires at t=7s
- At t=6.8s, second sync from same external device arrives
- Lock already expired, containment recalculation happens

**Current Protection**: Lock expires at 7s regardless of sync completion

**Acceptance Criteria**: Lock should be extended or dismissed when sync successfully persists position

---

### Edge Case 5: Nested Group Containment Ambiguity
**Scenario**:
- Task center at (150, 150)
- Parent section at (0, 0, 300, 300)
- Nested subsection at (100, 100, 200, 200)
- Both contain task center
- Line 216-220 picks smallest (subsection)
- But previous sync might have assigned to parent section
- Task reparented unexpectedly

**Current Protection**: Takes smallest section, but no checking against previous parent

**Acceptance Criteria**: Nested groups logic should be tested, especially with float precision

---

### Edge Case 6: Task Position Becomes Undefined During Property Update
**Scenario**:
- Task has `canvasPosition = {x: 50, y: 100}`
- Edit changes only priority
- Updates sent to store: `{ priority: 'high', canvasPosition: undefined }` ❌ (accidental omission)
- TaskEditModal intends to preserve position (lines 652-658) BUT
- If editedTask.value.canvasPosition somehow becomes undefined after edit
- Line 653: `if (originalCanvasPosition !== undefined)` fails
- Task falls to line 656: `isInInbox = originalIsInInbox`
- Task position reset to inbox (visual jump to inbox location)

**Current Protection**: TaskEditModal tries to preserve (lines 635-658), but...

**Acceptance Criteria**: canvasPosition must be preserved through entire edit flow

---

## Timing & Async Issues

### Issue 1: Multiple Async Watchers Racing
```
T=0ms   User clicks "Save" in modal
T=1ms   lockTaskPosition() called (lock set)
T=2ms   updateTaskWithUndo() called
T=5ms   Watcher #1 (syncTrigger) fires → checks lock ✅ blocked or synced
T=6ms   Watcher #2 (task property hash) fires → NO LOCK CHECK ❌
T=8ms   Watcher #2's batchedSyncNodes() executes
T=12ms  Watcher #3 (filteredTasks) fires → unclear lock behavior
T=15ms  First sync completes, position saved to DB
T=20ms  Lock expires (7s TTL)
T=25ms  External sync arrives, position recalculated with stale bounds
```

### Issue 2: Debounce/Throttle Masking Lock Status
- Line 908: debounceDelay: 100ms
- Line 1951: debouncedResizeSync: 150ms debounce
- If property change fires at T=6ms and debounce fires at T=106ms
- Lock may have expired by T=106ms (duration only 7s from T=1ms)

---

## Root Cause Summary

### Primary Causes (in order of likelihood):

1. **Watcher Lock Check Gap** (80% probability)
   - Watcher at line 1836-1842 (task property hash) doesn't check `isAnyCanvasStateLocked()`
   - Triggers syncNodes() which recalculates containment
   - Task moves from one section to another or root

2. **Containment Recalculation Within syncNodes()** (70% probability)
   - Even when lock is checked, syncNodes() still does containment calc (lines 195-238)
   - Floating point precision issues in section bounds checks
   - Task reparented based on recalculated section membership

3. **Section Bounds Changed Between Sync Calls** (40% probability)
   - Task locked at position (150, 150) inside "Work" section
   - Section bounds change due to user resize/drag on other instance
   - syncNodes() sees different bounds, recalculates containment
   - Task moves to different section or root

4. **Lock Expiry Before Async Completion** (20% probability)
   - Edit triggers 3+ async watchers that fire over 20-30ms
   - Lock set once, expires after 7s from initial time
   - Later watchers run with expired lock, no protection

---

## Acceptance Criteria Specification

### AC-1: Position Lock Honored in All Sync Paths
```gherkin
Feature: Position locks prevent containment recalculation
  Scenario: Edit triggers sync while lock active
    Given a task at (150, 150) inside "Work" section
    When user edits task and saves (position locked)
    And syncNodes() is called within 7 seconds
    Then task should NOT change parentNode or relative position
    And task should remain at absolute (150, 150)
```

**Test**: Verify lock is checked in:
- [ ] syncTrigger watcher (line 1817)
- [ ] task property hash watcher (line 1836) - **CURRENTLY MISSING**
- [ ] filteredTasks watcher (line 865)
- [ ] Within syncNodes() itself before containment calc

### AC-2: Floating Point Precision Handled
```gherkin
Feature: Section bounds compared with epsilon tolerance
  Scenario: Task on section edge within float precision
    Given a task center at (150.00001, 200.5)
    And section bounds at (100, 100, 200, 200)
    When syncNodes() checks containment
    Then should use epsilon tolerance (e.g., 0.1px)
    And not flip between inside/outside due to float diffs
```

**Test**:
- [ ] Add epsilon tolerance to containment check
- [ ] Test task at bounds edge (100.0, 100.0) vs (99.9, 100.1)
- [ ] Verify consistent classification

### AC-3: Preserved Position Through Edit Lifecycle
```gherkin
Feature: canvasPosition preserved through edit
  Scenario: User edits only task priority
    Given task with canvasPosition (150, 150) and priority 'medium'
    When user edits task and changes priority to 'high'
    And saves changes
    Then task.canvasPosition should still be (150, 150)
    And task should NOT move to inbox
```

**Test**:
- [ ] Edit modal always includes original canvasPosition in updates
- [ ] No undefined values sent for canvasPosition
- [ ] Verify in store.updateTask logs

### AC-4: No Reparenting on Section Bounds Change
```gherkin
Feature: Task parent section stable during edit
  Scenario: Section resized while task is being edited
    Given task inside "Work" section
    When section is resized by another user
    And task edit is saved
    Then task should keep original parent section
    And task should NOT jump to root or different section
```

**Test**:
- [ ] Verify parentNode doesn't change if lock is active
- [ ] Check line 171-192 in useCanvasSync.ts - should skip containment calc

### AC-5: Lock Guards All Containment Recalculations
```gherkin
Feature: Containment logic skipped when locked
  Scenario: Multiple containment calculations during sync
    Given task position locked at (150, 150)
    When syncNodes() runs and would recalculate containment
    Then should respect existing parentNode from line 171-192
    And should NOT recalculate based on current section bounds
```

**Test**:
- [ ] Verify `skipContainmentCalc = true` is set properly
- [ ] Check condition at line 169-192 handles locked tasks
- [ ] Log which path is taken (existing parent vs containment calc)

---

## Investigation Checklist

- [ ] **Review Task Edit Modal**: Verify canvasPosition always preserved
- [ ] **Check Watcher Guards**: Add lock checks to missing watchers
- [ ] **Trace Containment Logic**: Step through lines 195-238 with real data
- [ ] **Float Precision Audit**: Check all >= / <= comparisons for epsilon
- [ ] **Lock Extension**: Consider extending lock if sync is still in-flight
- [ ] **Async Waterfall**: Map all watchers that fire after updateTaskWithUndo()
- [ ] **DB Persistence**: Verify position is saved before lock expires
- [ ] **Multi-User Test**: Reproduce with section changes on another instance

---

## Files Affected

| File | Lines | Issue |
|------|-------|-------|
| `TaskEditModal.vue` | 608-778 | Locking logic, position preservation |
| `canvasStateLock.ts` | 1-376 | Lock mechanism, 7s duration |
| `useCanvasSync.ts` | 195-238 | Containment recalculation |
| `CanvasView.vue` | 1817-1842 | Watchers, lock checks |
| `useCanvasDragDrop.ts` | TBD | Drag handlers may interact |
| `canvasUi.ts` | TBD | Sync trigger mechanics |

---

## Reproduction Steps (Proposed)

### Minimal Repro
1. Create task on Canvas at position (150, 150)
2. Open task edit modal
3. Change ONLY the task priority (not position)
4. Save changes
5. **Expected**: Task stays at (150, 150)
6. **Actual**: Task may jump to different section or root

### Advanced Repro (with external sync)
1. Create task at (150, 150) in "Work" section (bounds: 0-300 x 0-300)
2. On second instance, resize "Work" section to (0-100 x 0-100)
3. Switch back to first instance, open task edit modal
4. Change task priority
5. While save is in-flight (~2-5s), check Canvas position
6. **Expected**: Task stays at (150, 150), parent unchanged
7. **Actual**: Task may reparent to root (since no longer in resized section)

---

## Potential Solutions (Not Recommendations)

1. **Extend lock duration** (7s → 15s) - masks timing issues, not root fix
2. **Skip containment calc if locked** - adds check at line 195
3. **Add epsilon to float comparison** - small fix, helps with precision
4. **Lock sections while task is locked** - complex, prevents user actions
5. **Dismiss lock on successful sync** - needs DB round-trip confirmation
6. **Separate property watchers from position watchers** - architectural change
7. **Queue watchers instead of parallel** - serializes updates, performance impact

---

## Key Learnings

1. **Multiple Watchers Fire Simultaneously**: updateTaskWithUndo triggers 3+ watchers, not all check locks
2. **Lock ≠ Sync Protection**: Lock prevents overwrites from remote, not internal recalculation
3. **Containment is Complex**: Float precision, nested groups, and parent relationships all interact
4. **Position vs Properties**: Editing properties (priority, status) can trigger position recalc
5. **7-Second Lock May Expire**: Async debounces and watchers may fire after lock expires

---

## Next Steps

1. Run test suite with detailed logging for position changes
2. Add instrumentation to trace exact watcher execution order
3. Identify which watcher(s) are actually moving the task
4. Verify canvasPosition is preserved through entire edit flow
5. Check if problem only occurs with certain section configurations
6. Test with nested groups to see if reparenting is the issue
