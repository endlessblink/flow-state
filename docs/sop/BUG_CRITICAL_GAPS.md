# Critical Gaps & Unknowns: Task Position Jump Bug

**Status**: Pre-Investigation
**Created**: January 6, 2026
**Audience**: Developer performing debugging

---

## Summary

This document highlights **gaps in understanding** that MUST be resolved before proposing a fix. Each gap has been identified during code analysis but requires runtime verification.

---

## Gap #1: Watcher Execution Order (CRITICAL)

### Question
When `updateTaskWithUndo()` is called in TaskEditModal (line 678), which watchers fire and in what order?

### Current Uncertainty
The CanvasView.vue file has multiple watchers:
1. **Line 1817**: `watch(() => canvasStore.syncTrigger)` ✅ Guards with lock check
2. **Line 1836**: `watch(() => taskStore.tasks.map(...title:status:priority...))` ❌ NO lock check documented
3. **Line 865**: `watch(filteredTasks)` ⚠️ Unclear if it calls syncNodes
4. **Line 873+**: `watch(() => canvasStore.sections)` ⚠️ Unclear if it triggers containment recalc
5. **Lines 1760+**: Multiple other watchers

### Why It Matters
If watcher #2 (line 1836) executes BEFORE lock is checked, it will call `batchedSyncNodes()` without protection, potentially triggering the position jump.

### How to Resolve
**Required Test**: Instrument watchers with logging
```javascript
// In CanvasView.vue, add before each watcher:
const watcherStartTime = performance.now()
const taskIdsTouched = new Set()

watch(..., () => {
  console.log(`[WATCHER] ${watcherName} fired after ${performance.now() - watcherStartTime}ms`)
  console.log(`[WATCHER] Lock status: ${isAnyCanvasStateLocked()}`)
})
```

Then reproduce bug and check browser console for execution order.

### Impact
**HIGH** - If confirmed that property hash watcher fires without lock check, this is likely the root cause.

---

## Gap #2: Actual Lock Status During Watchers (CRITICAL)

### Question
When the task property hash watcher fires at line 1836, is `isAnyCanvasStateLocked()` still returning `true`?

### Current Uncertainty
Lock is set by `lockTaskPosition()` in TaskEditModal line 673:
```typescript
lockTaskPosition(editedTask.value.id, originalCanvasPosition, 'manual')
```

Lock duration: 7000ms (line 55 in canvasStateLock.ts)

But the timing is:
- T=0ms: Lock set
- T=2-5ms: updateTaskWithUndo() called
- T=5-10ms: Watchers fire

The lock check at line 1821 would work, but line 1836 doesn't check.

### Why It Matters
If lock is NOT active (for some reason), then sync will proceed unguarded.

### How to Resolve
**Required Test**: Log lock status at exact moment watcher executes
```javascript
watch(() => taskStore.tasks.map(...), (val) => {
  const isLocked = isAnyCanvasStateLocked()
  console.log(`[HASH-WATCHER] Lock status: ${isLocked}`)

  // THIS IS THE BUG: No guard here!
  if (!isLocked) {
    batchedSyncNodes('normal')
  }
})
```

### Impact
**CRITICAL** - This is the smoking gun for the root cause.

---

## Gap #3: Does Line 1837 Watcher Actually Execute? (CRITICAL)

### Question
Does the task property hash watcher at line 1836 actually execute during a simple property edit?

### Current Uncertainty
The watcher watches:
```typescript
() => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|')
```

If user changes ONLY priority in TaskEditModal:
1. TaskEditModal preserves all other properties
2. updateTaskWithUndo sends: `{ priority: 'high', ...other fields }`
3. Task object in store gets mutated
4. Watcher string changes: "...priority:medium..." → "...priority:high..."
5. Watcher callback fires ✅

But if the task object reference doesn't update, the string hash might not change.

### Why It Matters
If this watcher DOESN'T execute, then line 1837 is not the culprit.
Other watchers must be identified.

### How to Resolve
**Required Test**: Add marker to line 1836 watcher
```javascript
watch(..., (val) => {
  console.log('[HASH-WATCHER-FIRED] New hash:', val?.substring(0, 50) + '...')
  // ... existing code
})

// Then when editing, search console for '[HASH-WATCHER-FIRED]'
```

If log doesn't appear, this watcher is not firing during edit.

### Impact
**HIGH** - If this watcher never fires, the bug is elsewhere.

---

## Gap #4: Position Lock Actually Preventing Sync? (CRITICAL)

### Question
Does `isAnyCanvasStateLocked()` check at line 1821 actually prevent syncNodes() from running?

### Current Code
```typescript
// Line 1821
if (!isAnyCanvasStateLocked()) {
  syncNodes()  // Only runs if NOT locked
} else {
  console.log('🛡️ [TASK-089] syncNodes blocked in syncTrigger watcher')
}
```

### Uncertainty
- Is `isAnyCanvasStateLocked()` correctly checking the lock?
- Does it return true for the correct duration?
- Is the log message actually appearing?

### How to Resolve
**Required Test**: Check browser console during edit
1. Perform edit
2. Open DevTools console
3. Search for log message: `[TASK-089] syncNodes blocked`
4. If present: syncTrigger watcher IS protecting (good)
5. If absent: syncTrigger watcher is NOT protecting (bad)

### Impact
**HIGH** - If lock is not working at all, entire mechanism fails.

---

## Gap #5: Containment Recalculation Path (CRITICAL)

### Question
When syncNodes() runs (after edit), does it follow the "skip containment" path (lines 171-192) or the "recalculate" path (lines 195-238)?

### Current Code
```typescript
// Line 167: Check if task already exists
const taskExistsInNodes = existingNodeParents.has(task.id)

// Line 169-192: IF EXISTS, SKIP recalculation
if (taskExistsInNodes) {
  skipContainmentCalc = true  // Skip lines 195-238
}

// Line 195: ONLY if NOT EXISTS
if (!skipContainmentCalc) {
  // This recalculates containment and could move task!
  const containingSections = sections.filter(...)
  // ... could change parentNode
}
```

### Uncertainty
- Is the task actually in `existingNodeParents`?
- Does `skipContainmentCalc` actually get set to true?
- Is the recalc path (line 195+) executing when it shouldn't?

### Why It Matters
If line 195+ executes for an existing task, that's where the position jumps happen.

### How to Resolve
**Required Test**: Add logging to useCanvasSync.ts
```typescript
// Line 167
const taskExistsInNodes = existingNodeParents.has(task.id)
console.log(`[SYNC] Task ${task.id}: existsInNodes=${taskExistsInNodes}`)

// Line 169
if (taskExistsInNodes) {
  skipContainmentCalc = true
  console.log(`[SYNC] Task ${task.id}: SKIPPING containment calc (existing)`)
}

// Line 195
if (!skipContainmentCalc) {
  console.log(`[SYNC] Task ${task.id}: RECALCULATING containment (NEW or forced)`)
  // ... rest of logic
}
```

Then during edit, check logs to see which path executes.

### Impact
**CRITICAL** - This determines if containment logic is the culprit.

---

## Gap #6: Float Precision in Bounds Check (MEDIUM)

### Question
Are section bounds checked with exact equality (>=, <=) causing false negatives on edge cases?

### Current Code (Lines 210-211 in useCanvasSync.ts)
```typescript
return taskCenterX >= sx && taskCenterX <= sx + sw &&
       taskCenterY >= sy && taskCenterY <= sy + sh
```

### Uncertainty
- Are there float precision diffs between stored bounds and runtime bounds?
- Example: section.position.x = 100.0000001 vs 100?
- Does this cause task to flip between "inside" and "outside"?

### How to Resolve
**Required Test**: Log bounds and center point
```typescript
const sx = s.position.x
const sy = s.position.y
const sw = s.position.width || 300
const sh = s.position.height || 300

const inside = taskCenterX >= sx && taskCenterX <= sx + sw &&
               taskCenterY >= sy && taskCenterY <= sy + sh

console.log(`[BOUNDS] Task center: (${taskCenterX}, ${taskCenterY})`)
console.log(`[BOUNDS] Section: x=${sx}..${sx+sw}, y=${sy}..${sy+sh}`)
console.log(`[BOUNDS] Inside? ${inside}`)
```

### Impact
**MEDIUM** - This could cause intermittent position flips at section edges.

---

## Gap #7: TaskEditModal Position Preservation (HIGH)

### Question
Does TaskEditModal actually preserve `canvasPosition` in the updates object?

### Current Code (Lines 652-658 in TaskEditModal.vue)
```typescript
// Get original position
const originalCanvasPosition = editedTask.value.canvasPosition ?? props.task?.canvasPosition

// Preserve in updates if it exists
if (originalCanvasPosition !== undefined) {
  updates.canvasPosition = originalCanvasPosition
  updates.isInInbox = false
}
```

### Uncertainty
- Is `originalCanvasPosition` actually being set?
- Is it included in the `updates` object sent to store?
- Or is it being omitted, causing position to reset?

### How to Resolve
**Required Test**: Log updates object in TaskEditModal
```typescript
console.log('[EDIT-MODAL] Original canvasPosition:', originalCanvasPosition)
console.log('[EDIT-MODAL] Updates object:', JSON.stringify(updates, null, 2))

taskStore.updateTaskWithUndo(editedTask.value.id, updates)
```

Then check console to verify canvasPosition is in updates.

### Impact
**HIGH** - If canvasPosition is not preserved here, task will be reset to inbox.

---

## Gap #8: Section Bounds Source Inconsistency (HIGH)

### Question
Does the section.position data used in containment check match the actual group position on canvas?

### Current Uncertainty
Section position could come from:
1. **canvasStore.sections[i].position** (from store)
2. **Vue Flow node data** (from component)
3. **CSS computed bounds** (from DOM)

If these don't match, bounds comparison fails.

### Why It Matters
If section bounds in store say (0, 0, 300, 300) but actual group on canvas is at (100, 100, 300, 300), then containment check will be wrong.

### How to Resolve
**Required Test**: Compare section bounds from multiple sources
```javascript
// Get from store
const sectionFromStore = canvasStore.sections[0]
console.log('[BOUNDS] From store:', sectionFromStore.position)

// Get from Vue Flow
const sectionNodeFromFlow = nodes.value.find(n => n.id === sectionFromStore.id)
console.log('[BOUNDS] From Vue Flow:', sectionNodeFromFlow.position)

// Get from DOM
const sectionDOM = document.querySelector(`[data-id="${sectionFromStore.id}"]`)
const rect = sectionDOM?.getBoundingClientRect()
console.log('[BOUNDS] From DOM:', rect)

// Compare
if (JSON.stringify(sectionFromStore.position) !== JSON.stringify(sectionNodeFromFlow.position)) {
  console.warn('[BOUNDS] MISMATCH between store and Vue Flow!')
}
```

### Impact
**HIGH** - Bounds mismatch would cause incorrect containment decisions.

---

## Gap #9: Debounce/Throttle Timing Masking Lock Expiry (MEDIUM)

### Question
If a watcher uses debounce/throttle, does it execute AFTER the 7-second lock expires?

### Current Code
- Line 908: `debounceDelay: 100` (nodeUpdate batcher)
- Line 1943: `useDebounceFn(..., 50)` (viewport update)
- Line 1951: `useDebounceFn(..., 150)` (resize sync)

Lock duration: 7000ms

### Scenario
1. T=0ms: Edit triggered, position locked
2. T=6ms: Viewport changed slightly, debounced update queued
3. T=56ms: Debounced update executes
4. T=7000ms: Lock expires
5. T=7050ms: Another change triggers sync
6. T=7051ms: syncNodes() runs WITHOUT lock protection

### How to Resolve
**Required Test**: Log when debounced functions execute
```typescript
const debouncedViewportUpdate = useDebounceFn(() => {
  console.log(`[DEBOUNCE] Viewport update executing at ${performance.now()}`)
  // ... existing code
}, 50)
```

Track execution times relative to lock set time.

### Impact
**MEDIUM** - This could cause issues if debounces fire after lock expires.

---

## Gap #10: Undo System Interaction (MEDIUM)

### Question
Does the undo system's position restoration interact badly with containment calculation?

### Current Uncertainty
TaskEditModal uses `taskStore.updateTaskWithUndo()` which:
1. Calls `undoHistory.updateTaskWithUndo()`
2. Which uses undo system to save state
3. Which might trigger watchers differently than regular update

Does the undo machinery preserve canvasPosition correctly?

### How to Resolve
**Required Test**: Compare updateTask() vs updateTaskWithUndo()
1. Edit task with updateTaskWithUndo()
2. Edit same property with regular updateTask()
3. Compare resulting position in both cases

### Impact
**MEDIUM** - If undo system doesn't preserve canvasPosition, that's the bug.

---

## Gap #11: Multi-Edit Scenario - State Accumulation (MEDIUM)

### Question
Do repeated rapid edits accumulate position errors?

### Current Scenario
1. Edit 1: Save at T=0s, lock set, position preserved ✓
2. Edit 2: Save at T=1s (lock from Edit 1 expired at T=7s), lock set again
3. Edit 3: Save at T=2s

Does each edit correctly lock and preserve, or does state accumulate?

### How to Resolve
**Required Test**: Rapid sequential edits with position logging
```javascript
const positionLog = []

// Before each edit
const beforePos = taskStore.tasks.find(t => t.id === taskId).canvasPosition
positionLog.push({ edit: i, before: beforePos })

// After save completes
const afterPos = taskStore.tasks.find(t => t.id === taskId).canvasPosition
positionLog.push({ edit: i, after: afterPos })
```

### Impact
**MEDIUM** - If errors accumulate, may need different fix approach.

---

## Gap #12: Canvas State Lock vs Task State Lock (MEDIUM)

### Question
Is `isAnyCanvasStateLocked()` being used correctly? Does it include task locks?

### Current Code (canvasStateLock.ts, line 178)
```typescript
export function isAnyCanvasStateLocked(): boolean {
  // Check task locks
  for (const [taskId, lock] of taskLocks) {
    if (isLockValid(lock)) return true
  }
  // Check group locks, viewport lock...
  return false
}
```

This should return true if ANY task has an active lock. But is the lock for the CORRECT task?

### Uncertainty
When TaskEditModal edits task "ABC", it locks "ABC".
Later watcher should check: is task "ABC" locked?

But `isAnyCanvasStateLocked()` returns true if ANY task is locked (including task "XYZ").

So a watcher touching task "XYZ" would be blocked because task "ABC" is locked!

### How to Resolve
**Required Test**: Check if problem is task-specific locking
```typescript
// In watcher that potentially causes jump
const isThisTaskLocked = isTaskPositionLocked(taskId)
if (!isThisTaskLocked) {
  // Proceed with sync for this specific task
}
```

vs current:

```typescript
if (!isAnyCanvasStateLocked()) {
  // Only proceed if ANY task is locked (too broad)
}
```

### Impact
**MEDIUM** - If watchers use too-broad lock check, they could block unnecessarily.

---

## Investigation Priority

### Phase 1: MUST RESOLVE (Blocking Everything)
1. **Gap #3**: Does line 1836 watcher execute during edit?
2. **Gap #2**: Is lock status actually true when watcher fires?
3. **Gap #1**: What is watcher execution order?

### Phase 2: Likely Root Cause
4. **Gap #5**: Does containment recalc path execute?
5. **Gap #7**: Is canvasPosition preserved in updates?
6. **Gap #8**: Are section bounds mismatched?

### Phase 3: Supporting Investigation
7. **Gap #4**: Is lock mechanism working at all?
8. **Gap #6**: Float precision causing edge case?
9. **Gap #9**: Debounce timing issues?
10. **Gap #10**: Undo system issue?
11. **Gap #11**: Accumulation error?
12. **Gap #12**: Lock scope issue?

---

## Instrumentation Checklist

Before attempting any fixes, instrument the codebase with:

- [ ] Watcher execution logging (all watchers in CanvasView.vue)
- [ ] Lock status checking at watcher execution time
- [ ] Containment path decision logging (skip vs recalc)
- [ ] Position value logging at each step (edit modal, store update, sync)
- [ ] Bounds comparison logging (store vs Vue Flow vs DOM)
- [ ] Debounce execution timing
- [ ] Undo system trace

---

## Expected Findings by Gap

| Gap # | If True | Then Likely Cause |
|-------|---------|--|
| 3 = No | Line 1836 watcher doesn't fire | Look for OTHER watchers |
| 3 = Yes + 2 = No | Watcher fires but lock is false | Lock mechanism broken |
| 3 = Yes + 2 = Yes + 1 = Before Lock | Execution order is wrong | Lock set too late |
| 5 = Recalc | Containment path always executes | Fix: Add lock check to line 195 |
| 5 = Skip | Containment logic isn't culprit | Look elsewhere |
| 7 = No | canvasPosition not preserved | Fix: Add to updates object |
| 7 = Yes | Position preserved | Not a modal issue |

---

