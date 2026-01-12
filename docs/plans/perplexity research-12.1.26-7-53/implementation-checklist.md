# Canvas Task Manager Refactoring Checklist

Complete this checklist to successfully refactor your Vue Flow canvas architecture.

---

## PHASE 1: DATABASE LAYER (Week 1-2)

### Setup
- [ ] **1.1** Run `db-migration.sql` in your Supabase console
  - [ ] Verify tables created: `nodes`, `node_position_history`
  - [ ] Check triggers exist: `trigger_increment_node_version`, `trigger_log_position_change`
  - [ ] Run test: `testVersionIncrement()` from `tests.ts`

- [ ] **1.2** Create a database backup before migration
  - [ ] Run: `pg_dump > backup_$(date +%Y%m%d).sql`

### Data Migration
- [ ] **1.3** Create migration script: `migrate-to-absolute.sql`
  ```sql
  -- For each node with a parent:
  UPDATE nodes n
  SET position = jsonb_build_object(
    'x', (n.position->>'x')::float + (p.position->>'x')::float,
    'y', (n.position->>'y')::float + (p.position->>'y')::float
  )
  FROM nodes p
  WHERE n.parent_group_id = p.id AND n.parent_group_id IS NOT NULL;
  ```

- [ ] **1.4** Execute migration on test database first
  - [ ] Create test DB copy
  - [ ] Run migration script
  - [ ] Verify all positions moved correctly
  - [ ] Check no (0,0) positions remain

- [ ] **1.5** Verify version tracking works
  - [ ] Manually update a node position in Supabase UI
  - [ ] Check that `version` increments
  - [ ] Check that `updated_at` updates
  - [ ] Check `node_position_history` has entry

---

## PHASE 2: COORDINATE SYSTEM (Week 2-3)

### Setup Utilities
- [ ] **2.1** Add `coordinates.ts` to your project
  - [ ] Path: `src/utils/coordinates.ts`
  - [ ] Export: `toRelativePosition`, `toAbsolutePosition`, `useNodeSync`, etc.
  - [ ] Run: `testCoordinateConversionRoundtrip()` - should pass

- [ ] **2.2** Add `state-machine.ts` to your project
  - [ ] Path: `src/utils/state-machine.ts`
  - [ ] Export: `NodeState` enum, `useNodeStateMachine`, `useNodeStateManager`
  - [ ] Run: `testStateTransitions()` - should pass

### Update Component
- [ ] **2.3** Replace drag handlers in your canvas component
  - [ ] Remove all coordinate conversion from `watch()` statements
  - [ ] Remove all coordinate conversion from watchers
  - [ ] Move conversion ONLY to:
    - `handleDragStart()` - optional, for display only
    - `handleDragEnd()` - REQUIRED, for syncing to DB
  - [ ] Reference: See `CanvasManager.vue` example

- [ ] **2.4** Update node loading logic
  ```typescript
  // OLD (wrong - no conversion):
  const nodes = dbNodes;
  
  // NEW (correct - converts at render time):
  const vueFlowNodes = computed(() => 
    dbNodesToVueFlowNodes(dbNodes.value)
  );
  ```

- [ ] **2.5** Test no position reset on refresh
  - [ ] Move a node
  - [ ] Refresh page (F5)
  - [ ] Node should stay in new position, not reset to (0,0)
  - [ ] Run: `testNoPositionResetOnRefresh()` - should pass

### Cleanup Old Code
- [ ] **2.6** Remove all scattered coordinate conversion functions
  - [ ] Search codebase for: `toRelativePosition`, `getAbsoluteCoordinates`, `convertCoordinates`, etc.
  - [ ] Delete all custom implementations
  - [ ] Replace with imports from `coordinates.ts`

- [ ] **2.7** Remove all position conversion watchers
  - [ ] Search for watchers that update `node.position`
  - [ ] Search for `watch()` on `dbNodes` that modify positions
  - [ ] Remove these - they cause the bugs!

- [ ] **2.8** Count composables before/after
  - [ ] Before: ~15 composables (your current state)
  - [ ] After: Should be ≤5 composables
  - [ ] If still high, search for position conversion logic

---

## PHASE 3: STATE MACHINE (Week 3)

### Refactor State Management
- [ ] **3.1** Replace boolean flags with state machine
  ```typescript
  // OLD (antipattern):
  const isDragging = ref(false);
  const isSync = ref(false);
  const isConverting = ref(false);
  const isResizing = ref(false);
  // ... 7+ more booleans
  
  // NEW (correct):
  const nodeState = useNodeStateMachine();
  ```

- [ ] **3.2** Update all state checks
  ```typescript
  // OLD:
  if (isDragging.value && !isSync.value) { ... }
  
  // NEW:
  if (nodeState.currentState.value === NodeState.DRAGGING_LOCAL) { ... }
  ```

- [ ] **3.3** Test state transitions
  - [ ] Run: `testStateTransitions()` - should pass
  - [ ] Run: `testNoImpossibleStates()` - should pass

- [ ] **3.4** Add debug panel (optional but recommended)
  - [ ] See `CanvasManager.vue` for example
  - [ ] Shows: current state, last error, recent transitions
  - [ ] Access via: `window.__CANVAS_DEBUG`

---

## PHASE 4: TESTING & VALIDATION (Week 4)

### Run Full Test Suite
- [ ] **4.1** Set up test environment
  - [ ] Copy `tests.ts` to `src/tests/canvas-refactoring.ts`
  - [ ] Import all utilities
  - [ ] Set `const URL = process.env.VITE_SUPABASE_URL`
  - [ ] Set `const KEY = process.env.VITE_SUPABASE_ANON_KEY`

- [ ] **4.2** Run Phase 1 tests
  ```javascript
  await testVersionIncrement();
  await testOptimisticLock();
  await testPositionHistoryLogging();
  // Expected: 3/3 pass
  ```

- [ ] **4.3** Run Phase 2 tests
  ```javascript
  await testAbsolutePositionStorage();
  testCoordinateConversionRoundtrip();
  await testNoPositionResetOnRefresh();
  // Expected: 3/3 pass
  ```

- [ ] **4.4** Run Phase 3 tests
  ```javascript
  testStateTransitions();
  testNoImpossibleStates();
  // Expected: 2/2 pass
  ```

- [ ] **4.5** Run Phase 4 integration tests
  ```javascript
  await testDragSyncRefreshCycle();
  await testConcurrentEditConflict();
  // Expected: 2/2 pass
  ```

### Manual Testing
- [ ] **4.6** Test basic operations
  - [ ] [ ] Create a task node
  - [ ] [ ] Create a group node
  - [ ] [ ] Add task to group (set parentGroupId)
  - [ ] [ ] Drag task around canvas
  - [ ] [ ] Refresh page - positions should persist
  - [ ] [ ] Create nested groups - no jumps or resets

- [ ] **4.7** Test conflict resolution
  - [ ] Open app in two browser windows
  - [ ] Move same node in both windows
  - [ ] Second window should show conflict notice
  - [ ] Retry button should fetch latest version

- [ ] **4.8** Test with nested groups
  - [ ] Create Group A
  - [ ] Create Group B inside Group A
  - [ ] Create Task inside Group B
  - [ ] Drag Task - should stay inside Group B
  - [ ] Resize Group A - children shouldn't jump
  - [ ] Expand/collapse groups - positions preserved

- [ ] **4.9** Stress test: many nodes
  - [ ] Create 100+ nodes
  - [ ] Drag rapidly
  - [ ] No lag or sync errors
  - [ ] Check console for errors
  - [ ] Monitor database: version increments correctly

---

## VERIFICATION & CLEANUP

### Bug Resolution Checklist
- [ ] **Bug 1**: Task positions reset to (0,0) on refresh
  - Status: ✓ FIXED (absolute coordinate storage)
  - Test: `testNoPositionResetOnRefresh()`

- [ ] **Bug 2**: Tasks jump outside parent after drag
  - Status: ✓ FIXED (coordinate conversion at drag end only)
  - Test: Manual nested drag test

- [ ] **Bug 3**: ID format mismatches
  - Status: ✓ FIXED (normalize in `dbNodesToVueFlowNodes`)
  - Test: Check all node IDs have "section-" prefix in Vue Flow

- [ ] **Bug 4**: Race conditions overwriting drags
  - Status: ✓ FIXED (optimistic locking + version field)
  - Test: `testConcurrentEditConflict()`

- [ ] **Bug 5**: Nested groups break when parent resizes
  - Status: ✓ FIXED (absolute positions don't change on parent resize)
  - Test: Manual resize test

- [ ] **Bug 6**: 7+ boolean lock flags conflicting
  - Status: ✓ FIXED (replaced with state machine)
  - Test: `testStateTransitions()`

### Code Quality
- [ ] **5.1** Remove DEBUG code
  - [ ] Set `DEBUG = false` in `CanvasManager.vue`
  - [ ] Remove `__CANVAS_DEBUG` exports
  - [ ] Remove debug panel UI

- [ ] **5.2** Code review checklist
  - [ ] No `localStorage` or `sessionStorage` (use variables)
  - [ ] No coordinate conversion in watchers
  - [ ] Only ONE `toRelativePosition()` implementation
  - [ ] Only ONE `toAbsolutePosition()` implementation
  - [ ] All sync uses version field

- [ ] **5.3** Performance check
  - [ ] Profile Canvas rendering (should be smooth)
  - [ ] Check Network tab - no excessive syncs
  - [ ] Database query performance - test with 10k nodes

---

## DOCUMENTATION

- [ ] **6.1** Update team documentation
  - [ ] Explain absolute vs relative coordinates
  - [ ] Document coordinate conversion functions
  - [ ] Show how to add new node types
  - [ ] Explain state machine for new developers

- [ ] **6.2** Document the refactoring decision
  - [ ] Why: Store absolute, not relative
  - [ ] Why: State machine instead of booleans
  - [ ] Why: Drag-end sync, not drag-move sync
  - [ ] Keep for future reference

- [ ] **6.3** Update CHANGELOG
  - [ ] Date completed
  - [ ] Bugs fixed
  - [ ] Files changed
  - [ ] Breaking changes (if any)

---

## FINAL VERIFICATION

- [ ] **7.1** All tests passing
  ```
  ✓ testVersionIncrement
  ✓ testOptimisticLock
  ✓ testPositionHistoryLogging
  ✓ testAbsolutePositionStorage
  ✓ testCoordinateConversionRoundtrip
  ✓ testNoPositionResetOnRefresh
  ✓ testStateTransitions
  ✓ testNoImpossibleStates
  ✓ testDragSyncRefreshCycle
  ✓ testConcurrentEditConflict
  ```

- [ ] **7.2** Production readiness
  - [ ] No console errors
  - [ ] No unhandled promise rejections
  - [ ] No memory leaks (profile in DevTools)
  - [ ] Works on mobile/touch devices
  - [ ] Accessible (keyboard navigation, screen readers)

- [ ] **7.3** Celebrate! 🎉
  - [ ] 2-3 months of bugs eliminated
  - [ ] Codebase reduced from ~15k to ~5k composable lines
  - [ ] Ready for production

---

## ROLLBACK PLAN (if needed)

If something goes wrong:

1. Restore database from backup created in step 1.2
2. Revert code to last working commit
3. Review what went wrong
4. Fix issues
5. Re-test on staging environment first

---

## TIMELINE

- **Week 1**: Database versioning setup + testing
- **Week 2**: Complete data migration + coordinate system tests
- **Week 3**: State machine refactoring + manual testing
- **Week 4**: Integration testing + stress testing
- **Bonus**: Documentation + performance optimization

---

## NOTES

- Don't rush. Test thoroughly at each phase.
- Keep old code until new code fully tested.
- Every test should pass before moving to next phase.
- Document any deviations from this plan.
- If stuck, refer back to the analysis document.