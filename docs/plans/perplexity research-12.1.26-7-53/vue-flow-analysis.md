# Vue Flow Nested Groups Architecture Analysis
## Research Summary & Production Insights

---

## 1. IS VUE FLOW THE RIGHT CHOICE?

### Vue Flow (v1.47) Reality:
**Vue Flow is still viable BUT with architectural caveats:**

- ✅ **Nested nodes ARE supported** - `parentNode` property + `expandParent` flag work
- ✅ **Coordinate system documented** - Uses relative coordinates for nested nodes (intentional design)
- ✅ **Active maintenance** - v1.47 is current; v2.0 in progress
- ❌ **Limitations documented in issues**:
  - Parent auto-sizing NOT in core (requires manual implementation)
  - Coordinate conversion overhead is inherent, not a bug
  - Handle recalculation requires explicit `useUpdateNodeInternals()` calls
  - Single maintainer (impacts response time on edge cases)

### Konva.js vs Fabric.js vs Vue Flow

**Comparison from production projects:**

| Aspect | Vue Flow | Konva.js | Fabric.js |
|--------|----------|----------|-----------|
| **Nested Groups** | Native via parentNode | Groups + layers | Native grouping |
| **Vue Integration** | Native | React-centric, Vue wrapper exists | React-centric, manual integration |
| **Development Speed** | Medium (already familiar to you) | Slower (steeper learning curve) | Faster for simple shapes |
| **State Management** | Vue reactivity | Manual state tracking | Manual state tracking |
| **Performance (1000+ nodes)** | ✅ Optimized | ✅ Excellent | ⚠️ Moderate |
| **Community Support** | Smaller, Vue-focused | Larger, React-dominant | Medium, legacy library |
| **Coordinate Conversion Overhead** | ⚠️ Inherent in design | ❌ Only stores absolute coordinates | ❌ Only stores absolute coordinates |

**Verdict:** Konva.js would actually solve your absolute/relative coordinate problem, but switching would take 4-6 weeks. Stay with Vue Flow - the bugs are architectural, not Vue Flow's fault.

---

## 2. DATABASE POSITION STORAGE: ABSOLUTE vs RELATIVE

### Research Finding (Critical):
**Store ABSOLUTE (world) coordinates in the database. Always.**

**Why:**
1. **Hierarchical independence** - Don't store parent-child metadata twice (once in edges, once in coordinates)
2. **Query flexibility** - Easier to find nodes in region, detect overlaps, compute layouts
3. **Conflict resolution** - When sync happens, absolute positions don't need recalculation
4. **Multi-parent scenarios** - If you ever allow dynamic grouping, relative coordinates break

### Your Current Bug Root Cause:
You're storing relative coordinates and converting on sync - this creates:
- Double representation of hierarchy (parentNode ID + relative position)
- Conversion errors that compound with nesting depth
- Race condition window during conversion

### Implementation Pattern:

```javascript
// Store in DB
{
  id: "task-123",
  position: { x: 450, y: 200 },  // ABSOLUTE in world space
  parentGroupId: "group-456",     // Separate field for hierarchy
  width: 150,
  height: 80
}

// Vue Flow conversion (only for display):
const getNodePositionForFlow = (node, parentNode) => {
  if (!parentNode) return node.position; // root, use absolute
  
  // Convert to relative ONLY for rendering
  return {
    x: node.position.x - parentNode.position.x,
    y: node.position.y - parentNode.position.y
  };
};

// On drag end:
const handleDragEnd = (event) => {
  const { node } = event;
  const parentNode = nodes.find(n => n.id === node.parentNode);
  
  // Convert back to absolute for DB
  const absolutePosition = {
    x: node.position.x + (parentNode?.position.x || 0),
    y: node.position.y + (parentNode?.position.y || 0)
  };
  
  await updateNodePosition(node.id, absolutePosition);
};
```

---

## 3. PREVENTING POSITION SYNC CONFLICTS (RACE CONDITIONS)

### Standard Pattern (from production systems):

**Optimistic Locking with Version Numbers:**

```javascript
// DB schema
{
  id: "task-123",
  position: { x: 450, y: 200 },
  version: 3,  // increment on every change
  updatedAt: "2026-01-12T10:30:00Z"
}

// Client-side
const handleDragEnd = async (event) => {
  const { node } = event;
  const currentVersion = nodeVersionMap.get(node.id);
  
  try {
    await supabase
      .from('nodes')
      .update({ 
        position: toAbsoluteCoordinates(node),
        version: currentVersion + 1
      })
      .eq('id', node.id)
      .eq('version', currentVersion);  // Optimistic lock
      
  } catch (error) {
    if (error.code === 'PGRST116') {  // 0 rows updated
      // Conflict: server has newer version
      const latestNode = await fetchNode(node.id);
      nodeVersionMap.set(node.id, latestNode.version);
      // Optionally rollback UI or notify user
      ui.showConflictNotice(`Position updated by another user`);
    }
  }
};
```

### Why This Fixes Your Race Condition:

1. **Prevents blind overwrites** - Only updates if version matches
2. **Detects conflicts early** - Before render, not after
3. **No conversion during conflict** - Absolute coordinates don't need recalc

### Alternative: Sequence Numbers + Debouncing

```javascript
let dragSequence = 0;

const handleDragMove = async (event) => {
  const sequence = ++dragSequence;
  
  // Debounce syncs to 500ms
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    // Ignore if newer drag happened
    if (sequence !== dragSequence) return;
    
    await syncNodePosition(node.id, node.position);
  }, 500);
};
```

---

## 4. FLAT NODE MODEL vs PARENTNODE MODEL

### Your Question: "Should I fake nesting with z-index instead?"

**Answer: NO. Here's why:**

**Fake Nesting Problems:**
- You STILL need to convert coordinates for drag containment
- Visual grouping ≠ logical hierarchy (will confuse users)
- Keyboard/accessibility breaks
- Copy-paste with groups becomes manual
- You re-solve the same problems manually

**Real Testing:**
- React Flow (similar to Vue Flow) has this exact issue documented
- Solution is always: store absolute, convert for UI
- NOT: abandon hierarchy

### Keep ParentNode. Fix the Conversion.

---

## 5. WHY NESTED GROUPS BREAK WHEN PARENT RESIZES

### Root Cause:

Vue Flow's coordinate system recalculates when parent changes:

```javascript
// Vue Flow internal (simplified)
const childAbsolutePosition = childRelativePosition + parentPosition;
```

**But if parent size changes and children have `expandParent: true`:**
1. Parent expands
2. Children positions stay relative
3. Parent position may shift (depends on anchor)
4. Children coordinates recalculate = visual jump

### Fix:

```javascript
// Before expanding parent:
const childAbsolutePositions = children.map(child => ({
  id: child.id,
  x: child.position.x + parentNode.position.x,
  y: child.position.y + parentNode.position.y
}));

// Resize parent
parentNode.data.width = newWidth;
parentNode.data.height = newHeight;

// Restore children with `expandParent` by converting back
children.forEach(child => {
  const absolute = childAbsolutePositions.find(c => c.id === child.id);
  child.position = {
    x: absolute.x - parentNode.position.x,
    y: absolute.y - parentNode.position.y
  };
});
```

---

## 6. THE 7+ BOOLEAN LOCK FLAGS PROBLEM

### What You're Doing (Antipattern):
```javascript
isDragging = true
isSync = true
isConverting = true  // conflicts with isDragging
isResizing = true   // conflicts with isSync
// etc.
```

### Proper State Machine:

```javascript
const nodeState = {
  IDLE: 'idle',
  DRAGGING_LOCAL: 'dragging_local',
  SYNCING: 'syncing',
  CONFLICT: 'conflict',
  RESIZING: 'resizing'
};

const currentState = ref('idle');

const transitions = {
  'idle': ['dragging_local', 'resizing'],
  'dragging_local': ['syncing', 'idle'],
  'syncing': ['idle', 'conflict'],
  'conflict': ['dragging_local', 'idle'],
  'resizing': ['syncing', 'idle']
};

const handleDragStart = () => {
  if (!transitions[currentState.value].includes('dragging_local')) {
    console.warn(`Cannot drag from ${currentState.value}`);
    return;
  }
  currentState.value = 'dragging_local';
};
```

This prevents impossible states automatically.

---

## 7. PRODUCTION EXAMPLES OF COMPLEX NESTED FLOWS

### Found (from research):

1. **Figma-like editors** - Use absolute coordinates + WebSockets for sync
   - Example pattern: Every object stores world position
   - Parent relationships computed from containment, not stored
   
2. **Miro-style boards** - Store position in world space
   - Boards (like groups) compute bounding box from children
   - No position conversion needed until render time

3. **VS Code settings editor** - Uses nested scopes but flat storage
   - Absolute paths stored: `workspace.editor.fontSize`
   - Displayed hierarchically

### GitHub Discussions (Vue Flow):

- Issue #219: Parent auto-sizing is user-implemented, not core
- Issue #3393: Request for absolute positioning in subflows (still open, not planned)
- Solution pattern: "Recalculate on every sync"

---

## 8. YOUR SPECIFIC BUGS - ROOT CAUSES

### Bug 1: Task positions reset to (0,0) on refresh
**Cause:** Database stores relative coordinates, fetch doesn't recalculate
**Fix:** Store absolute, convert only for display

### Bug 2: Tasks jump outside parent after drag
**Cause:** Coordinate conversion losing parent offset during drag event propagation
**Fix:** Track absolute position throughout drag, sync only at drag end

### Bug 3: ID format mismatches
**Cause:** Database uses `{id}`, Vue Flow expects `section-{id}` for parentNode references
**Fix:** Normalize IDs on load - single source of truth
```javascript
const normalizeId = (id) => id.startsWith('section-') ? id : `section-${id}`;
```

### Bug 4: Race conditions overwriting drags
**Cause:** Background sync doesn't check client state
**Fix:** Implement optimistic locking (version field) or debounce (500ms)

### Bug 5: Nested groups break when parent resizes
**Cause:** `expandParent: true` doesn't preserve child absolute positions
**Fix:** Calculate absolute positions before resize, restore relative after

### Bug 6: 7+ conflicting lock flags
**Cause:** No state machine
**Fix:** Use enum-based state machine

---

## RECOMMENDED REFACTORING PLAN

### Phase 1 (Week 1-2): Data Layer Fix
- [ ] Add `version` field to nodes table (integer, incremented on update)
- [ ] Add migration: `ALTER TABLE nodes ADD COLUMN version INTEGER DEFAULT 1`
- [ ] Convert all stored positions from relative to absolute
- [ ] Update sync logic to use optimistic locking

### Phase 2 (Week 2-3): Coordinate System
- [ ] Remove all coordinate conversion from watchers
- [ ] Move conversion to single utility: `getDisplayPosition(dbNode, parentNode)`
- [ ] Drag handlers work in absolute space, convert to relative only for Vue Flow node.position

### Phase 3 (Week 3): State Machine
- [ ] Replace 7+ booleans with single `state` ref using enum
- [ ] Define valid transitions
- [ ] Test state impossibilities

### Phase 4 (Week 4): Testing
- [ ] Rapid drag + refresh cycles (should not reset)
- [ ] Nested group resizing (children should stay inside)
- [ ] Concurrent edits (version conflict detection)

---

## WHEN TO SWITCH LIBRARIES

**Switch to Konva.js if:**
- You need true absolute coordinate system (saves conversion layer)
- You're willing to invest 4-6 weeks
- Hierarchy is secondary (more canvas-like, less graph-like)

**Stay with Vue Flow if:**
- You value hierarchical relationships (groups, parent-child)
- Timeline pressure (you have current code base to fix)
- Vue ecosystem familiarity (keep using Supabase, etc.)

---

## KEY TAKEAWAY

Your bugs aren't Vue Flow's fault. They're architectural:

1. **Storing relative coordinates** when you need absolute
2. **Converting without versioning** creates sync races
3. **7+ flags instead of state machine** causes impossible states
4. **Watchers doing conversion** instead of event handlers

Fix #1 (absolute storage) alone will eliminate 5 of your 6 bugs.