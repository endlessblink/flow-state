# Vue Flow Nested Nodes Troubleshooting Tree

## How to Use This Guide

Start at the top-level symptom, follow the diagnostic questions, and arrive at a specific cause and solution.

---

## Symptom: Node Positions Are Wrong

### Q1: When does the wrong position occur?

**A: On initial load**
→ Go to [Load-Time Position Issues](#load-time-position-issues)

**A: After dragging**
→ Go to [Drag Position Issues](#drag-position-issues)

**A: After setting parentNode**
→ Go to [Reparenting Position Issues](#reparenting-position-issues)

**A: Randomly during use**
→ Go to [Sporadic Position Issues](#sporadic-position-issues)

---

## Symptom: Parent-Child Relationship Not Working

### Q1: What specific behavior is broken?

**A: Children don't move with parent**
→ Check: Is `parentNode` property set on child nodes?
→ Fix: `updateNode(childId, { parentNode: parentId })`

**A: Parent doesn't recognize children**
→ Check: Does your code use `node.parentNode` or a custom property?
→ Fix: Vue Flow only recognizes `parentNode`, not custom fields

**A: Relationship lost on reload**
→ Check: Are you persisting `parentNode` to database?
→ Fix: Save `parentNode` alongside `position`

---

## Symptom: Containment Detection Fails

### Q1: How are you checking containment?

**A: Using `node.position` directly**
→ WRONG: `position` is relative for children
→ FIX: Use `node.computedPosition` for all containment checks

**A: Using `computedPosition` but still fails**
→ Check: Are you checking center point or corners?
→ Best practice: Check if center point is within bounds

**A: Using center point but nested nodes fail**
→ Check: Are you accounting for the full parent chain?
→ Fix: Walk up `parentNode` chain or use `computedPosition` directly

---

## Load-Time Position Issues

### Q1: Are stored positions absolute or relative?

**Check by**: Log `position` and `parentNode` from database

**If absolute positions stored for children**:
→ Problem: Positions interpreted as relative when `parentNode` set
→ Fix: Convert to relative before setting parentNode:
```typescript
const relativePos = {
  x: storedPos.x - parent.computedPosition.x,
  y: storedPos.y - parent.computedPosition.y
}
```

**If relative positions stored correctly**:
→ Check: Is `parentNode` being loaded before position?
→ Fix: Load nodes in correct order or set both atomically

---

## Drag Position Issues

### Q1: Which nodes have wrong positions after drag?

**A: The dragged node itself**
→ Check: Are you overwriting position in `onNodeDragStop`?
→ Fix: Let Vue Flow handle position updates, only persist

**A: Child nodes of dragged parent**
→ Check: Is `parentNode` set correctly on children?
→ Check: Are you manually updating child positions?
→ Fix: Never manually move children when parent moves

**A: Nodes that were dropped into a group**
→ Check: Are you converting to relative position on drop?
→ Fix: Convert absolute drop position to relative:
```typescript
const relativePos = {
  x: dropPosition.x - targetGroup.computedPosition.x,
  y: dropPosition.y - targetGroup.computedPosition.y
}
```

---

## Reparenting Position Issues

### Q1: When setting parentNode, does node jump?

**A: Yes, jumps to wrong location**
→ Cause: Position not converted from absolute to relative
→ Fix: Convert BEFORE setting parentNode:
```typescript
const parent = getNode(parentId)
const child = getNode(childId)
const relativePos = {
  x: child.computedPosition.x - parent.computedPosition.x,
  y: child.computedPosition.y - parent.computedPosition.y
}
updateNode(childId, { parentNode: parentId, position: relativePos })
```

**A: Yes, jumps when REMOVING from parent**
→ Cause: Relative position becoming absolute
→ Fix: Save absolute position BEFORE removing parent:
```typescript
const absolutePos = { ...child.computedPosition }
updateNode(childId, { parentNode: undefined, position: absolutePos })
```

---

## Sporadic Position Issues

### Q1: Can you identify a pattern?

**A: Happens after state sync**
→ Check: Is external state (Pinia/database) overwriting Vue Flow?
→ Fix: Gate position updates with change detection

**A: Happens with specific node types**
→ Check: Do all node types handle position consistently?
→ Fix: Ensure same coordinate handling for all types

**A: Happens with deeply nested nodes**
→ Check: Is recursive position calculation correct?
→ Fix: Always use `computedPosition` for absolute coords

**A: No pattern, truly random**
→ Enable comprehensive logging:
```typescript
watch(() => nodes.value, (newNodes) => {
  for (const node of newNodes) {
    console.log(`[POSITION] ${node.id}:`, node.position, node.computedPosition)
  }
}, { deep: true })
```

---

## Diagnostic Commands

### Check Single Node State
```typescript
const node = getNode(nodeId)
console.table({
  id: node.id,
  position: JSON.stringify(node.position),
  computedPosition: JSON.stringify(node.computedPosition),
  parentNode: node.parentNode,
  dimensions: JSON.stringify(node.dimensions),
  extent: node.extent
})
```

### Check All Parent-Child Relationships
```typescript
getNodes.value
  .filter(n => n.parentNode)
  .forEach(n => {
    const parent = getNode(n.parentNode)
    console.log(`${n.id} → parent: ${n.parentNode}`, {
      parentExists: !!parent,
      childPos: n.position,
      childComputed: n.computedPosition,
      parentComputed: parent?.computedPosition
    })
  })
```

### Validate Position Consistency
```typescript
getNodes.value.forEach(node => {
  if (node.parentNode) {
    const parent = getNode(node.parentNode)
    if (!parent) {
      console.error(`ORPHAN: ${node.id} references missing parent ${node.parentNode}`)
      return
    }
    const expectedComputed = {
      x: parent.computedPosition.x + node.position.x,
      y: parent.computedPosition.y + node.position.y
    }
    const matches = (
      Math.abs(expectedComputed.x - node.computedPosition.x) < 1 &&
      Math.abs(expectedComputed.y - node.computedPosition.y) < 1
    )
    if (!matches) {
      console.error(`MISMATCH: ${node.id}`, {
        expected: expectedComputed,
        actual: node.computedPosition
      })
    }
  }
})
```

---

## Quick Reference: Common Causes

| Symptom | Most Likely Cause | Quick Fix |
|---------|-------------------|-----------|
| Jumping on parent assignment | Position not converted | Convert pos before setting parentNode |
| Children don't move | parentNode not set | Set parentNode property |
| Containment fails | Using position not computedPosition | Use computedPosition |
| Positions reset on reload | Storing computedPosition | Store position + parentNode |
| Nested nodes wrong | Not using computedPosition | computedPosition handles nesting |
| Random jumps | External state overwriting | Gate updates with comparison |
