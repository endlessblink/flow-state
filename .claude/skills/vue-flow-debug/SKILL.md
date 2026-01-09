---
name: Vue Flow Nested Node Debugger
description: Expert skill for debugging Vue Flow parent-child relationships, coordinate systems, and nesting logic. Contains deep knowledge on coordinate conversion and event handling.
triggers:
  - debug vue flow
  - fix nested nodes
  - node parent issues
  - dragging nodes wrong
  - group node bugs
keywords:
  - vue flow
  - nested
  - coordinates
  - parent
  - computedPosition
---

# Vue Flow Nested Nodes & Parent-Child Debugging

## 🎯 **Capabilities**
- **Coordinate Debugging**: Understanding `position` vs `computedPosition`.
- **Relationship Fixes**: Diagnosing parent-child linkage issues.
- **Event Handling**: Correct implementation of drag/drop for nested nodes.
- **Containment Logic**: Advanced geometry checks for "node inside group".

## ⚡ **Action: Debug Protocol**
1.  **Analyze**: Determine if the issue is visual (rendering), logical (state), or persistent (store).
2.  **Verify**: Use the checklists below to validate parent-child integrity.
3.  **Implement**: Apply the robust patterns provided for parent assignment.

---

# expert-knowledge.md

## 1. Vue Flow Coordinate System {#coordinate-system}

### Understanding position vs computedPosition

**node.position (Stored in State)**
*   For root nodes: position = absolute coordinates on the canvas
*   For child nodes (with parentNode set): position = relative to parent's top-left corner
*   Stored in: Your nodes array/Pinia store
*   Used for: Persistence, serialization, state synchronization

```typescript
// Root node - position is absolute
{
  id: 'node-1',
  position: { x: 100, y: 50 },  // 100px from canvas left, 50px from top
  parentNode: undefined
}

// Child node - position is relative to parent
{
  id: 'task-1',
  position: { x: 20, y: 30 },   // 20px from parent's left, 30px from parent's top
  parentNode: 'group-1'
}
```

**node.computedPosition (Calculated at Runtime)**
*   Always absolute: World coordinates regardless of parent
*   Automatically calculated: Vue Flow computes this from position + parent's computedPosition
*   Used for: Rendering, collision detection, drag operations
*   Read-only: Don't set this directly

### Coordinate Transformation Functions

```typescript
// Absolute (world) to Relative (parent-local)
function toRelativePosition(
  absolutePos: { x: number; y: number },
  parentComputedPos: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: absolutePos.x - parentComputedPos.x,
    y: absolutePos.y - parentComputedPos.y
  }
}

// Relative (parent-local) to Absolute (world)
function toAbsolutePosition(
  relativePos: { x: number; y: number },
  parentComputedPos: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: relativePos.x + parentComputedPos.x,
    y: relativePos.y + parentComputedPos.y
  }
}
```

## 2. Common Bugs & Solutions

### Bug #1: Groups Incorrectly Moving Together (Not Nested)
**Symptoms**: When you drag one group, nearby groups move with it.
**Root Cause**: `parentNode` accidentally set or stale references.
**Solution**: Ensure Group nodes have `parentNode: undefined`.

### Bug #2: Positions Jump on Page Load/Refresh
**Root Cause**: Loading state before Vue Flow initializes or mismatched coordinate systems.
**Solution**: Use `onPaneReady` to gate data loading.

### Bug #3: Nested Groups Don't Move with Parent
**Root Cause**: Child's `parentNode` not set correctly or position is absolute instead of relative.
**Solution**: Verify `child.parentNode === parent.id`.

### Bug #4: False Positive Containment (Center-Point Only)
**Problem**: Standard checks only look at the center point. A large node essentially "outside" a group might have its center "inside", verifying it incorrectly.
**Solution**: Use Multi-Corner Containment Check.

```typescript
/**
 * Comprehensive containment check using ALL 4 corners + percentage
 */
function isNodeReallyInsideGroup(node: Node, group: Node, margin = 10) {
    // ... See full implementation in guide ...
}
```

## 3. Debugging Techniques

### Color-Coded Console Logger
Create a consistent logging utility to trace position updates.

### Real-Time Position Visualization
Overlay a transparent div showing live `computedPosition` values to see what Vue Flow "sees".

### Diagnostic Containment Check
Run a script that checks all 4 corners of a node against all groups to definitively prove if it "should" be inside.

---

## 4. Production Ready Patterns

### Reliable Parent Assignment
Do not just check `isInside`. Check `isInside` AND ensures the node fits logically. Only assign if confidence is high (>75% coverage).

### Syncing External Store
Always listen to `onNodesChange` and sync `position` back to your Pinia store. Remember to sync `parentNode` changes too!

```typescript
onNodesChange((changes) => {
  changes.forEach(change => {
    if (change.type === 'position') {
      const node = getNode(change.id)
      nodeStore.update(change.id, {
        position: node.position,
        parentNode: node.parentNode
      })
    }
  })
})
```
