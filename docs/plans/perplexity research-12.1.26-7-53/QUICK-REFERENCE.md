# Quick Reference: Vue Flow Refactoring

## File Index

| File | Use Case | When |
|------|----------|------|
| **README.md** | Start here | First time reading |
| **vue-flow-analysis.md** | Deep technical analysis | Need to understand why |
| **db-migration.sql** | Database setup | Week 1, Phase 1 |
| **coordinates.ts** | Coordinate conversion | Week 2, Phase 2 |
| **state-machine.ts** | State management | Week 3, Phase 3 |
| **CanvasManager.vue** | Component example | Week 2-4, implementing |
| **tests.ts** | Testing | After each phase |
| **implementation-checklist.md** | Step-by-step execution | Day-to-day guide |

---

## The 3 Root Causes & Fixes

### #1: Storing Relative Coordinates
**Problem**: `position: { x: 100, y: 50 }` stored relative to parent
**Result**: Resets to (0,0) on refresh, coordinate conversion errors
**Fix**: Store absolute: `position: { x: 450, y: 200 }` in world space

**Code Change**:
```typescript
// Before:
const relative = { x: child.x - parent.x, y: child.y - parent.y };

// After:
const absolute = { x: 450, y: 200 }; // Always store absolute
```

---

### #2: No Conflict Detection
**Problem**: Race condition—remote sync overwrites local drag
**Result**: User's drag operation gets lost if server updates during drag
**Fix**: Add version field + optimistic locking

**Code Change**:
```typescript
// Before:
await supabase.from('nodes').update({ position }).eq('id', nodeId);

// After:
await supabase
  .from('nodes')
  .update({ position, version: v + 1 })
  .eq('id', nodeId)
  .eq('version', v); // Only update if version matches
```

---

### #3: 7+ Boolean Flags
**Problem**: `isDragging`, `isSync`, `isConverting`, etc. conflict
**Result**: Impossible states like isDragging=true + isSync=true
**Fix**: Replace with state machine

**Code Change**:
```typescript
// Before:
const isDragging = ref(false);
const isSync = ref(false);
const isConverting = ref(false); // Can all be true at once!

// After:
const state = useNodeStateMachine();
// Only one valid state: IDLE, DRAGGING, SYNCING, CONFLICT, etc.
```

---

## Timeline at a Glance

```
Week 1: Database (4 days work)
  ├─ Run db-migration.sql
  ├─ Verify triggers work
  ├─ Create backup
  └─ Tests: testVersionIncrement()

Week 2: Coordinates (4 days work)
  ├─ Add coordinates.ts to project
  ├─ Update canvas component
  ├─ Remove scattered conversion functions
  └─ Tests: testNoPositionResetOnRefresh()

Week 3: State Machine (3 days work)
  ├─ Add state-machine.ts to project
  ├─ Replace 7+ booleans
  ├─ Cleanup old code
  └─ Tests: testStateTransitions()

Week 4: Integration (5 days work)
  ├─ Run full test suite
  ├─ Stress testing (100+ nodes)
  ├─ Manual conflict scenarios
  └─ Production readiness
```

---

## Most Common Mistakes

❌ **Don't**:
- Rewrite components before fixing data layer
- Skip database backup
- Skip tests at each phase
- Keep multiple position conversion functions
- Add new features during refactoring

✅ **Do**:
- Test after EVERY change
- Keep old code until new code proven
- Document what you change
- Ask for help if stuck
- Follow the checklist exactly

---

## Testing Checklist

### Minimal Tests (must pass)
```javascript
✓ testVersionIncrement()           // DB versioning works
✓ testCoordinateConversionRoundtrip() // No precision loss
✓ testNoPositionResetOnRefresh()   // (0,0) bug fixed
✓ testStateTransitions()            // State machine valid
```

### Full Test Suite (run in Week 4)
```javascript
✓ testVersionIncrement()
✓ testOptimisticLock()
✓ testPositionHistoryLogging()
✓ testAbsolutePositionStorage()
✓ testCoordinateConversionRoundtrip()
✓ testNoPositionResetOnRefresh()
✓ testStateTransitions()
✓ testNoImpossibleStates()
✓ testDragSyncRefreshCycle()
✓ testConcurrentEditConflict()
```

### Manual Tests (Week 4)
- [ ] Drag node → refresh → node stays
- [ ] Move node in parent → stays inside
- [ ] Two users drag same node → conflict shown
- [ ] Resize parent → children don't jump
- [ ] Nested groups 3 levels deep → works

---

## Database Quick Setup

```bash
# Step 1: Backup current DB
pg_dump your_db > backup.sql

# Step 2: Copy db-migration.sql into Supabase SQL editor

# Step 3: Run all queries in this order:
1. ALTER TABLE nodes ADD COLUMN version ...
2. CREATE INDEX idx_nodes_version ...
3. CREATE TABLE node_position_history ...
4. CREATE FUNCTION increment_node_version() ...
5. CREATE TRIGGER trigger_increment_node_version ...
6. CREATE FUNCTION log_position_change() ...
7. CREATE TRIGGER trigger_log_position_change ...

# Step 4: Verify
SELECT column_name FROM information_schema.columns WHERE table_name='nodes';
# Should include: version, updated_at

SELECT * FROM information_schema.triggers WHERE event_object_table='nodes';
# Should include: trigger_increment_node_version, trigger_log_position_change

# Step 5: Data migration (when ready in Week 2)
UPDATE nodes SET position = absolute_position_calculation();
```

---

## Code Snippets

### Converting DB Node to Vue Flow
```typescript
import { dbNodesToVueFlowNodes } from '@/utils/coordinates';

const vueFlowNodes = computed(() => 
  dbNodesToVueFlowNodes(dbNodes.value)
);
```

### On Drag End (Only time we sync)
```typescript
async function handleDragEnd(event) {
  const { node } = event;
  
  // Convert Vue Flow position (relative) to absolute
  const absolutePos = toAbsolutePosition(node, dbNodes.value);
  
  // Sync to database with version check
  await syncNodePosition(supabaseClient, node.id, node, dbNodes.value);
  
  // Update state machine
  nodeState.setState(NodeState.IDLE);
}
```

### State Machine Usage
```typescript
import { useNodeStateMachine, NodeState } from '@/utils/state-machine';

const state = useNodeStateMachine();

// Check if transition valid
if (state.canTransitionTo(NodeState.DRAGGING_LOCAL)) {
  state.setState(NodeState.DRAGGING_LOCAL);
}

// In template
<span>{{ state.getStateLabel() }}</span>
```

---

## Debugging

**Enable debug mode**:
```typescript
const DEBUG = true; // in CanvasManager.vue
// Browser console: window.__CANVAS_DEBUG
```

**Check state machine**:
```javascript
// In browser console:
window.__CANVAS_DEBUG.nodeState // Current state
window.__CANVAS_DEBUG.sync.isSyncing // Syncing?
window.__CANVAS_DEBUG.sync.error // Any errors?
```

**Validate coordinates**:
```javascript
// In browser console:
window.__CANVAS_DEBUG.validateAllCoordinates()
// Should print: "✓ PASS" or show errors
```

---

## Quick Answers

**Q: Should I switch to Konva.js?**  
A: No. Vue Flow is fine. The bugs are data-layer, not Vue Flow.

**Q: Should I store relative or absolute?**  
A: Absolute. Always. Database should store world-space coordinates.

**Q: When should I sync to database?**  
A: At drag END only, not on every drag move.

**Q: What if versions conflict?**  
A: That's good! Conflict means another user changed it. Fetch their version and retry.

**Q: Can I skip the state machine?**  
A: No. The 7 boolean flags cause impossible states. State machine fixes this.

**Q: How long will refactoring take?**  
A: 4 weeks if you follow the plan. Don't skip phases.

**Q: What if I mess up the database?**  
A: Restore from backup created in Week 1. That's why you make a backup first.

---

## Emergency Contacts (This is Your Project)

- **Stuck on Phase 1?** Refer to db-migration.sql and run tests
- **Stuck on Phase 2?** Check coordinates.ts—single source of truth
- **Stuck on Phase 3?** Look at state-machine.ts—valid transitions only
- **Stuck on Phase 4?** Run test suite—tests show what's broken

All files are in this directory. Read the relevant one for your phase.

---

## Success Checklist

When you're done:
- [ ] All 10 tests pass
- [ ] No (0,0) position resets
- [ ] Tasks don't jump outside groups
- [ ] Concurrent edits show conflicts (not silent overwrites)
- [ ] Composable code is <5000 lines (was 15000)
- [ ] No console errors on prod build
- [ ] Performance is same or better

That's it. You've won. 🎉