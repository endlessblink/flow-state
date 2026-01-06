# Test Plan: Task Position Jump Bug

**Document Type**: Comprehensive Test Specification
**Related Document**: `BUG_ANALYSIS_TASK_POSITION_JUMP.md`
**Test Framework**: Playwright (Mandatory before any fixes)

---

## Test Execution Strategy

### Phase 1: Visual Regression Tests (Required Before Any Changes)
Establish baseline - which specific scenarios reproduce the bug?

### Phase 2: Instrumentation Tests
Add logging to identify exact watcher execution order

### Phase 3: Unit Tests
Test individual components (containment logic, float precision)

### Phase 4: Integration Tests
Test full edit flow with lock mechanism

### Phase 5: Regression Tests
Verify fixes don't break existing functionality

---

## Phase 1: Visual Regression Tests (Playwright)

### Test 1.1: Edit Task Property - Baseline (CRITICAL)
**Objective**: Establish if position jump occurs with simple property edit
**Severity**: P0 - Reproduces the bug

```playwright
Test: Edit task priority, verify position unchanged
Steps:
  1. Create task on Canvas at position (200, 200)
  2. Open task edit modal
  3. Change ONLY priority from 'medium' to 'high'
  4. Click Save
  5. Measure task position immediately after save completes

Verification:
  - Task position should be EXACTLY (200, 200) ± 2px tolerance
  - Task should NOT be in inbox
  - Task should NOT be in different section (if it was in one)

Expected Duration: ~2 seconds
Timeout: 10 seconds (if modal doesn't close, something is wrong)

Failure Mode: If position changes by >5px, bug is reproduced
```

### Test 1.2: Edit Task Title - Priority Check
**Objective**: Title changes trigger hash watcher - does it cause jump?

```playwright
Test: Edit task title, verify position unchanged
Setup: Same as 1.1
Steps:
  1. Create task "Original Title" at (200, 200)
  2. Open edit modal
  3. Change title to "Modified Title" (ONLY change)
  4. Save
  5. Measure position

Verification:
  - Position should stay (200, 200) ± 2px
  - If position changes, the hash watcher (line 1836) is likely culprit

Expected Duration: ~2 seconds
```

### Test 1.3: Edit Task Status - In Section
**Objective**: Check if status change + section membership = jump

```playwright
Test: Edit status of task inside section
Setup:
  1. Create "Work" section (bounds: 50-400 x 50-300)
  2. Create task inside section at (150, 150)
  3. Verify task has parentNode = "section-work-id"

Steps:
  1. Open edit modal
  2. Change status to 'in_progress' (ONLY change)
  3. Save
  4. Measure position and parentNode

Verification:
  - Position should stay (150, 150) relative to section
  - parentNode should NOT change
  - If parentNode changes to undefined (root), reparenting occurred

Expected Duration: ~2 seconds
```

### Test 1.4: Rapid Sequential Edits (Stress Test)
**Objective**: Do multiple rapid edits cause cumulative jump?

```playwright
Test: Multiple edits in succession
Steps:
  1. Create task at (200, 200)
  2. Edit #1: Change priority → Save
  3. Edit #2: Change status → Save
  4. Edit #3: Change title → Save
  5. Edit #4: Change duration → Save
  6. Measure final position

Verification:
  - Final position should be (200, 200) ± 2px
  - No cumulative drift

Expected Duration: ~8 seconds
```

### Test 1.5: Task Near Section Boundary (Float Precision Test)
**Objective**: Float precision issues at section edges

```playwright
Test: Task position exactly at section boundary
Setup:
  1. Create section at (100, 100) size (200x200)
     - So bounds are: 100 ≤ x ≤ 300, 100 ≤ y ≤ 300
  2. Create task at position (299.5, 199.5)
     - Task center: (299.5+110, 199.5+50) = (409.5, 249.5)
     - This is OUTSIDE the section (409.5 > 300)
  3. Verify task is at ROOT level (no parent)

Steps:
  1. Open edit modal
  2. Change priority
  3. Save

Verification:
  - Task should stay at ROOT (parentNode = undefined)
  - Should NOT suddenly become child of section
  - If parentNode becomes "section-...", float precision is the culprit

Expected Duration: ~2 seconds
```

### Test 1.6: Nested Groups (Complex Containment)
**Objective**: Check reparenting with nested group hierarchy

```playwright
Test: Task inside nested group during edit
Setup:
  1. Create parent section "Team" at (50, 50) size (400x300)
  2. Create nested section "Focus" inside Team at (100, 100) size (200x150)
  3. Create task at (150, 120) inside "Focus"
     - Task should have parentNode = "section-focus-id"

Steps:
  1. Open edit modal
  2. Change priority
  3. Save
  4. Measure parentNode and position

Verification:
  - parentNode should still be "section-focus-id"
  - Should NOT reparent to parent section "Team"
  - Should NOT move to root

Expected Duration: ~2 seconds
Failure Mode: If parentNode becomes "section-team-id", nesting logic broke
```

### Test 1.7: Section Resized by Other Instance (Multi-User)
**Objective**: External section change during local edit

```playwright
Test: Section bounds change while task is edited
Requires: Two browser instances or multi-tab test
Steps:
  1. [Instance A] Create section "Work" at (0, 0) size (300x300)
  2. [Instance A] Create task at (150, 150) inside "Work"
  3. [Instance B] Open same app, resize "Work" to (0, 0) size (100x100)
  4. [Instance B] Save changes (section now too small)
  5. [Instance A] Open task edit modal (position locked)
  6. [Instance A] Change priority, save
  7. [Instance A] Measure position and parentNode

Verification:
  - Task position should stay (150, 150) absolute
  - parentNode might change if lock not protecting section bounds
  - Should NOT jump to a different visual location

Expected Duration: ~5 seconds
Failure Mode: Task moves to root or different section
```

### Test 1.8: Task Move to Inbox Scenario
**Objective**: Verify position not reset when converting between canvas/inbox

```playwright
Test: Edit task, ensure it doesn't move to inbox
Setup:
  1. Create task on Canvas at (200, 200)
  2. Verify task has canvasPosition and isInInbox=false

Steps:
  1. Open edit modal
  2. Change any property (priority, status, etc.)
  3. Do NOT change canvasPosition field
  4. Save
  5. Measure position and isInInbox

Verification:
  - isInInbox should still be false
  - canvasPosition should still be (200, 200)
  - Task should NOT appear in inbox

Expected Duration: ~2 seconds
Failure Mode: Task appears in inbox (position reset to inbox coordinates)
```

---

## Phase 2: Instrumentation Tests

### Test 2.1: Watcher Execution Order Logging
**Objective**: Identify which watchers fire and in what order

```javascript
// Add to CanvasView.vue before watchers
const WATCHER_LOG: Array<{
  timestamp: number
  watcher: string
  taskId?: string
  action: string
}> = []

// Instrument each watcher
watch(() => canvasStore.syncTrigger, (newTrigger) => {
  WATCHER_LOG.push({
    timestamp: Date.now(),
    watcher: 'syncTrigger',
    action: isAnyCanvasStateLocked() ? 'BLOCKED' : 'EXECUTED'
  })
  // ... existing code
})

watch(() => taskStore.tasks.map(...), (val) => {
  WATCHER_LOG.push({
    timestamp: Date.now(),
    watcher: 'task_property_hash',
    action: isAnyCanvasStateLocked() ? 'NO_CHECK' : 'EXECUTED'
  })
  // ... existing code
})

// Export for test inspection
window.__watcherLog = WATCHER_LOG
```

**Test Steps**:
1. Clear log: `window.__watcherLog = []`
2. Edit task and save
3. Immediately check log: `window.__watcherLog`
4. Verify which watchers executed and in what order

**Expected Output**:
```
[
  { timestamp: 1234567890, watcher: 'taskEditModal', action: 'SAVE_INITIATED' },
  { timestamp: 1234567891, watcher: 'lockTaskPosition', action: 'LOCKED' },
  { timestamp: 1234567892, watcher: 'updateTaskWithUndo', action: 'CALLED' },
  { timestamp: 1234567893, watcher: 'syncTrigger', action: 'BLOCKED|EXECUTED' },
  { timestamp: 1234567894, watcher: 'task_property_hash', action: 'NO_CHECK|EXECUTED' },
  { timestamp: 1234567895, watcher: 'filteredTasks', action: 'EXECUTED' }
]
```

---

### Test 2.2: Position Lock State Tracking
**Objective**: Verify lock is active during all watchers

```javascript
// Add to canvasStateLock.ts debug output
window.__lockHistory = []

export function lockTaskPosition(taskId, position, source) {
  // ... existing code
  window.__lockHistory.push({
    timestamp: Date.now(),
    taskId,
    action: 'LOCKED',
    position,
    source
  })
}

// Track lock checks
export function isTaskPositionLocked(taskId) {
  const result = ... // existing logic
  window.__lockHistory.push({
    timestamp: Date.now(),
    taskId,
    action: 'CHECK',
    locked: result
  })
  return result
}
```

**Test Steps**:
1. Clear history: `window.__lockHistory = []`
2. Edit task and save
3. Check history: `window.__lockHistory`
4. Verify LOCKED action appears first, then CHECK actions show true for 7s

---

### Test 2.3: Containment Calculation Trace
**Objective**: Log which section containment logic executes

```javascript
// Add to useCanvasSync.ts inside syncNodes()
const CONTAINMENT_LOG: Array<{
  taskId: string
  path: 'skip_existing_parent' | 'skip_root_level' | 'new_containment_calc'
  oldParent?: string
  newParent?: string
  position: { x: number, y: number }
  timestamp: number
}> = []

// Log decision at line 169
if (taskExistsInNodes) {
  if (existingParent) {
    CONTAINMENT_LOG.push({
      taskId: task.id,
      path: 'skip_existing_parent',
      oldParent: existingParent,
      newParent: existingParent,
      position,
      timestamp: Date.now()
    })
    skipContainmentCalc = true
  } else {
    CONTAINMENT_LOG.push({
      taskId: task.id,
      path: 'skip_root_level',
      position,
      timestamp: Date.now()
    })
    skipContainmentCalc = true
  }
}

// Log decision at line 195
if (!skipContainmentCalc) {
  CONTAINMENT_LOG.push({
    taskId: task.id,
    path: 'new_containment_calc',
    position,
    timestamp: Date.now()
  })
  // ... existing containment logic
  // After section found:
  CONTAINMENT_LOG[CONTAINMENT_LOG.length-1].newParent = section?.id
}

window.__containmentLog = CONTAINMENT_LOG
```

**Test Steps**:
1. Edit task inside a section
2. Check log: `window.__containmentLog`
3. Verify path is either 'skip_existing_parent' or 'skip_root_level'
4. If path is 'new_containment_calc', that's the problem (line 195 shouldn't execute for existing tasks)

---

## Phase 3: Unit Tests

### Test 3.1: Floating Point Containment Check
**File**: `useCanvasSync.test.ts` (new)

```typescript
describe('Containment Logic - Float Precision', () => {
  it('should consistently classify task at section boundary', () => {
    const section = { position: { x: 100, y: 100, width: 200, height: 200 } }
    const taskWidth = 220
    const taskHeight = 100

    // Task exactly at right boundary
    const taskX = 279.5 // center: 279.5 + 110 = 389.5
    const taskY = 149.5 // center: 149.5 + 50 = 199.5

    // First check
    const contained1 = isTaskInSection(taskX, taskY, section, taskWidth, taskHeight)

    // Second check with slightly different bounds (float precision)
    const sectionAlt = { ...section }
    const contained2 = isTaskInSection(taskX, taskY, sectionAlt, taskWidth, taskHeight)

    expect(contained1).toBe(contained2)
    // Should not flip between true/false due to float diffs
  })

  it('should handle epsilon tolerance correctly', () => {
    const section = { position: { x: 100, y: 100, width: 200, height: 200 } }

    // Task just inside
    expect(isTaskInSection(99.9, 99.9, section)).toBe(true)

    // Task just outside (should be consistent)
    expect(isTaskInSection(99.9, 99.9, section)).toBe(true)
    // Both should give same result
  })
})
```

### Test 3.2: Lock Prevents Containment Recalc
**File**: `canvasStateLock.test.ts`

```typescript
describe('Canvas Lock - Position Protection', () => {
  beforeEach(() => {
    clearAllLocks()
  })

  it('should prevent containment calc while task is locked', () => {
    const taskId = 'task-123'
    const position = { x: 150, y: 150 }

    lockTaskPosition(taskId, position, 'manual')

    // Lock should be active
    expect(isTaskPositionLocked(taskId)).toBe(true)

    // Position should not change due to recalc
    const locked = getLockedTaskPosition(taskId)
    expect(locked).toEqual(position)
  })

  it('should expire lock after 7 seconds', async () => {
    const taskId = 'task-123'
    lockTaskPosition(taskId, { x: 150, y: 150 }, 'manual')

    expect(isTaskPositionLocked(taskId)).toBe(true)

    // Fast forward 7 seconds
    vi.useFakeTimers()
    vi.advanceTimersByTime(7100)

    expect(isTaskPositionLocked(taskId)).toBe(false)
  })
})
```

---

## Phase 4: Integration Tests

### Test 4.1: Full Edit Flow with Lock
**File**: `canvas.integration.test.ts`

```typescript
describe('Canvas - Full Edit Flow with Lock', () => {
  it('should preserve task position through complete edit lifecycle', async () => {
    // Setup
    const { mount } = await import('@vue/test-utils')
    const canvas = mount(CanvasView)

    // Create task
    const taskId = 'task-1'
    const initialPosition = { x: 200, y: 200 }
    // ... create task at position

    // Edit task
    const modal = mount(TaskEditModal, {
      props: { task: { id: taskId, canvasPosition: initialPosition } }
    })

    // Change property
    await modal.find('[data-test="priority-select"]').setValue('high')

    // Save (triggers lock and update)
    await modal.find('[data-test="save-button"]').trigger('click')

    // Verify position unchanged
    await vi.runAllTimersAsync() // Process all async watchers

    const finalTask = taskStore.tasks.find(t => t.id === taskId)
    expect(finalTask.canvasPosition).toEqual(initialPosition)
  })
})
```

---

## Phase 5: Regression Tests

### Test 5.1: No Break in Drag-Drop
**Objective**: Verify fixes don't break drag functionality

```playwright
Test: Drag task after edit fix applied
Steps:
  1. Create task at (200, 200)
  2. Edit task (trigger fix)
  3. Drag task to (300, 300)
  4. Verify position updates correctly
```

### Test 5.2: No Break in Section Containment
**Objective**: Verify nested groups still work

```playwright
Test: Drag task into section after fix
Steps:
  1. Create section at (50, 50) size (300x300)
  2. Create task outside at (400, 50)
  3. Drag task into section
  4. Verify task becomes child of section (parentNode set)
  5. Edit task
  6. Verify parentNode doesn't change
```

---

## Metrics & Success Criteria

### Baseline Metrics (Before Fix)
- Record position of 10 tasks before/after edit
- Record parentNode changes for 5 tasks in sections
- Record any position drifts in rapid edit scenario

### Success Criteria (After Fix)
- Position change < 0.5px (sub-pixel precision)
- parentNode consistency: 100% (no reparenting on edit)
- Lock check presence: 100% (all watchers check lock)
- Float precision: No boundary flipping on repeated measurements
- Regression: Zero regressions in drag-drop, nesting, section operations

---

## Test Data Requirements

| Scenario | Section Size | Section Pos | Task Pos | Expected Parent |
|----------|---|---|---|---|
| Simple edit | N/A | N/A | (200, 200) | None (root) |
| Inside section | 300x200 | (50, 50) | (150, 150) | section-id |
| At boundary | 200x200 | (100, 100) | (299.5, 199.5) | None (outside) |
| Nested group | 400x300 (parent), 200x150 (child) | (50, 50), (100, 100) | (150, 120) | child-section-id |

---

## Expected Issues & Workarounds

### Issue: Modal doesn't save on first click
**Workaround**: Wait for modal to be visible, then click save

### Issue: Position drift due to viewport zoom
**Workaround**: Reset viewport to zoom=1 before measuring

### Issue: Timing-dependent failures
**Workaround**: Use `vi.runAllTimersAsync()` to process all async operations

### Issue: Multi-instance test flakiness
**Workaround**: Use 500ms delay between instance operations, poll for sync completion

---

## Checklist for Test Execution

- [ ] Phase 1.1 - 1.3: Basic edit tests (5 min)
- [ ] Phase 1.4 - 1.8: Complex scenarios (15 min)
- [ ] Phase 2.1 - 2.3: Instrumentation (10 min)
- [ ] Phase 3.1 - 3.2: Unit tests (10 min)
- [ ] Phase 4.1: Integration test (15 min)
- [ ] Phase 5.1 - 5.2: Regression tests (10 min)
- [ ] Total time estimate: ~65 minutes for full suite

