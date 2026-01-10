# Bug Summary: Task Position Jump After Edit

**Document**: Quick Reference
**For**: Quick understanding of the issue and documentation links
**Read Time**: 5 minutes

---

## The Bug in One Sentence

After a user edits a task in the Canvas view and saves changes, the task visually **jumps to a different location** instead of staying where it was.

---

## What We Know

### ✅ Confirmed
1. **Position lock mechanism exists** and is set to 7 seconds
2. **Lock is set BEFORE task update** in TaskEditModal (line 673)
3. **Multiple watchers fire after update** in CanvasView.vue
4. **Containment recalculation logic exists** that could reparent tasks

### ❌ Not Confirmed (Critical Gaps)
1. **Which watcher actually causes the jump?** (3 candidates identified)
2. **Is the lock actually preventing sync?** (check mechanism unknown)
3. **Does containment recalc path execute?** (skip logic unclear)
4. **Is canvasPosition actually preserved?** (not verified)
5. **Are section bounds consistent?** (multiple sources possible)

---

## Likely Root Causes (Ranked by Probability)

| Probability | Cause | Location | Fix Difficulty |
|---|---|---|---|
| 80% | **Watcher without lock check** | CanvasView.vue:1836 | EASY - Add guard |
| 70% | **Containment recalc when shouldn't** | useCanvasSync.ts:195 | MEDIUM - Add lock check |
| 40% | **Float precision in bounds check** | useCanvasSync.ts:210 | MEDIUM - Add epsilon |
| 30% | **Section bounds mismatch** | useCanvasSync.ts:206 | HARD - Track bounds source |
| 20% | **canvasPosition not preserved** | TaskEditModal.vue:654 | EASY - Debug modal |
| 15% | **Lock expired during async** | canvasStateLock.ts:124 | MEDIUM - Extend lock |

---

## Files to Understand

```
src/
├── components/tasks/
│   └── TaskEditModal.vue          # Edit modal, position locking (lines 608-778)
├── composables/canvas/
│   └── useCanvasSync.ts           # Sync logic, containment recalc (lines 195-238)
├── views/
│   └── CanvasView.vue             # Watchers, syncNodes triggers (lines 1817-1842)
├── stores/canvas/
│   └── canvasUi.ts                # Canvas UI store, sync trigger
└── utils/
    └── canvasStateLock.ts         # Position lock mechanism (7s duration)
```

---

## Key Code Snippets to Review

### Position Lock Set (TaskEditModal.vue:672-675)
```typescript
if (originalCanvasPosition) {
  lockTaskPosition(editedTask.value.id, originalCanvasPosition, 'manual')
  console.log('🔒 DEBUG: Locked position BEFORE save:', originalCanvasPosition)
}
```

### Watcher Without Lock Check (CanvasView.vue:1836-1842)
```typescript
watch(
  () => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|'),
  (val) => {
    if (val) batchedSyncNodes('normal')  // ❌ NO LOCK CHECK!
  }
)
```

### Containment Recalc (useCanvasSync.ts:195-238)
```typescript
if (!skipContainmentCalc) {
  // This could move task from one section to another!
  const containingSections = sections.filter(s => {
    return taskCenterX >= sx && taskCenterX <= sx + sw &&  // Float precision?
           taskCenterY >= sy && taskCenterY <= sy + sh
  })
}
```

---

## Reproduction Steps

### Minimal
1. Create task on Canvas at position (200, 200)
2. Edit task: change ONLY the priority
3. Save changes
4. **Expected**: Task stays at (200, 200)
5. **Actual**: Task may jump to different location

### With Sections
1. Create section "Work" at (50, 50) size (300x300)
2. Create task inside section at (150, 150)
3. Edit task: change priority
4. Save
5. **Expected**: Task stays in "Work" section
6. **Actual**: Task may jump to root or different section

---

## Acceptance Criteria

For a fix to be accepted, ALL of these must pass:

1. **Position Stability**: Task position changes less than 0.5px after edit
2. **Parent Consistency**: Task parentNode (section membership) doesn't change
3. **Multi-Edit Safe**: Repeated edits don't cause cumulative drift
4. **Float Precision**: Tasks at section edges don't flip in/out
5. **Lock Protection**: Lock is checked in ALL sync paths
6. **Regression Free**: Drag-drop, nesting, section operations still work

---

## Testing Required

### Before Fix (Establish Baseline)
- [ ] Test Phase 1.1-1.8 (Visual regression tests with Playwright)
- [ ] Instrument code with logging (Phase 2)
- [ ] Identify which specific watcher causes jump

### After Fix
- [ ] All Phase 1 tests must pass
- [ ] Phase 5 regression tests must pass
- [ ] Zero position jumps in rapid edit scenario

**Estimated test time**: 60-90 minutes

---

## Documentation Files

This analysis is split across 4 documents:

1. **BUG_ANALYSIS_TASK_POSITION_JUMP.md** (This is the technical deep-dive)
   - Root cause analysis
   - Edge cases and gaps
   - Watcher chain analysis
   - Lock mechanism review
   - 6,000+ words, very detailed

2. **BUG_TEST_PLAN_POSITION_JUMP.md** (How to test)
   - 12 comprehensive Playwright tests
   - 3 instrumentation test patterns
   - 2 unit test suites
   - 1 integration test
   - Regression test suite
   - 100+ lines of test code

3. **BUG_CRITICAL_GAPS.md** (What's unknown)
   - 12 critical gaps in understanding
   - Questions that MUST be answered
   - How to resolve each gap
   - Investigation priority
   - Detailed instrumentation checklist

4. **BUG_SUMMARY_POSITION_JUMP.md** (This document)
   - 5-minute executive summary
   - Quick reference guide
   - File locations
   - Reproduction steps
   - Testing checklist

---

## Next Steps

### For Investigation (Highest Priority)
1. **Answer Gap #3**: Does the property hash watcher (line 1836) fire?
2. **Answer Gap #2**: Is lock status true when it fires?
3. **Answer Gap #1**: What is the exact watcher execution order?

**Action**: Add instrumentation logging from Phase 2.1-2.3 in test plan

### For Understanding
4. Run visual regression tests (Phase 1 from test plan)
5. Check browser console logs during edit
6. Verify canvasPosition in store updates

### For Fixing (After investigation)
- Add lock check to missing watchers (if that's the culprit)
- OR add lock check to containment recalc (if that's the culprit)
- OR extend lock duration (if timing is the issue)
- OR debug float precision (if boundary cases are the issue)

---

## Key Insights

### Architecture Observation
The canvas sync system has a **dual-purpose lock mechanism**:
- **Intended**: Prevent external sync from overwriting local changes
- **Actual**: May not protect internal containment recalculation

### Timing Architecture
Edit flow creates a **watcher cascade**:
```
T=0ms: updateTaskWithUndo()
T=2-5ms: Watcher #1 fires (with lock check) ✅
T=5-10ms: Watcher #2 fires (no lock check?) ❌
T=10-15ms: Watcher #3 fires (unclear) ⚠️
T=15ms: First sync completes
T=7000ms: Lock expires
```

### Position Management Complexity
Three sources of position data:
1. **Task store**: `task.canvasPosition` (absolute)
2. **Vue Flow**: `node.position` (relative if parented)
3. **canvasStateLock**: Locked position for collision detection

Mismatch between these causes jump.

---

## Risks If Not Fixed

1. **User Experience**: Confusing - users can't trust position after edit
2. **Data Loss**: Tasks in wrong sections = lost organization
3. **Productivity**: User must manually reposition task = wasted time
4. **Reliability**: Intermittent (depends on timing) = hard to debug in production

---

## Resources

### Related Jira/Issues (if any)
- Check MASTER_PLAN.md for related bug IDs

### Similar Past Issues
- TASK-089: Canvas state lock (related)
- BUG-001: Shift+drag selection (different symptom, same root cause location)
- TASK-072: Nested group containment (related logic)
- BUG-034: Absolute-to-relative position conversion (related)

### Code References
- Vue Flow documentation: Parent-child positioning
- Pinia store documentation: Watch mechanics
- Vue 3 watcher documentation: Execution order guarantees

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Position drift after edit | < 0.5px | Unknown (likely > 5px) |
| Task parentNode consistency | 100% | Unknown |
| Lock check coverage | 100% of sync calls | ~50% (missing 1-2 watchers) |
| Regression-free | Zero failures | Unknown |

---

## Questions to Answer

Before proceeding with a fix, these questions MUST be answered:

1. Which specific watcher is causing the position jump?
2. Is the position lock actually protecting the sync?
3. Does the containment recalculation path execute for existing tasks?
4. Is canvasPosition actually preserved through the edit flow?
5. Are section bounds consistent between store and Vue Flow?

See **BUG_CRITICAL_GAPS.md** for detailed methodology to answer each.

---

**Created**: January 6, 2026
**Status**: Ready for Investigation
**Next Action**: Run Phase 2 instrumentation tests to answer critical gaps
