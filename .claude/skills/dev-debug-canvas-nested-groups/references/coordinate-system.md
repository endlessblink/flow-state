# Vue Flow Coordinate System Deep Dive

## The Two Coordinate Systems

Vue Flow maintains two distinct coordinate systems that serve different purposes. Misunderstanding these systems is the root cause of most nested node bugs.

### 1. `node.position` - Storage Coordinate

**Definition**: The position value stored on the node object.

**Behavior**:
- For **root nodes** (no parent): Absolute canvas coordinates
- For **child nodes** (has `parentNode`): Relative to parent's top-left corner

**Use Cases**:
- Database persistence
- Initial node creation
- Setting node position via `updateNode()`

### 2. `node.computedPosition` - Canvas Coordinate

**Definition**: The actual position on the canvas after parent transformations are applied.

**Behavior**:
- Always absolute canvas coordinates
- Calculated by Vue Flow: `parent.computedPosition + child.position`
- Updated automatically when parent moves
- Read-only (cannot be set directly)

**Use Cases**:
- Hit testing / containment detection
- Distance calculations
- Visual positioning logic
- Drag boundaries

## Visual Example

```
Canvas Origin (0,0)
├── Parent Group at position {x: 100, y: 100}
│   ├── computedPosition: {x: 100, y: 100}
│   │
│   └── Child Task at position {x: 50, y: 30}
│       ├── computedPosition: {x: 150, y: 130}  ← (100+50, 100+30)
│       │
│       └── Nested Child at position {x: 20, y: 10}
│           └── computedPosition: {x: 170, y: 140}  ← (150+20, 130+10)
```

## Coordinate Transformation Functions

### Converting Absolute to Relative

When making a node a child of a parent:

```typescript
function toRelativePosition(
  absolutePos: { x: number, y: number },
  parent: Node
): { x: number, y: number } {
  return {
    x: absolutePos.x - parent.computedPosition.x,
    y: absolutePos.y - parent.computedPosition.y
  }
}

// Usage
const child = getNode(childId)
const parent = getNode(parentId)
const relativePos = toRelativePosition(child.computedPosition, parent)
updateNode(childId, { position: relativePos, parentNode: parentId })
```

### Converting Relative to Absolute

When removing a node from its parent (making it root):

```typescript
function toAbsolutePosition(node: Node): { x: number, y: number } {
  // computedPosition already is absolute
  return {
    x: node.computedPosition.x,
    y: node.computedPosition.y
  }
}

// Usage
const child = getNode(childId)
const absolutePos = toAbsolutePosition(child)
updateNode(childId, { position: absolutePos, parentNode: undefined })
```

## Common Mistakes

### Mistake 1: Storing computedPosition

```typescript
// WRONG - Will cause position shift on reload
saveToDatabase({
  position: node.computedPosition  // Absolute stored as if relative
})

// RIGHT - Store the actual position property
saveToDatabase({
  position: node.position,
  parentNode: node.parentNode
})
```

### Mistake 2: Using position for Containment

```typescript
// WRONG - Child's position is relative to parent
const isInside = (
  task.position.x >= group.position.x &&
  task.position.x <= group.position.x + groupWidth
)

// RIGHT - Use computedPosition for both
const isInside = (
  task.computedPosition.x >= group.computedPosition.x &&
  task.computedPosition.x <= group.computedPosition.x + groupWidth
)
```

### Mistake 3: Setting parentNode Without Converting Position

```typescript
// WRONG - Node will jump because absolute pos becomes relative
updateNode(childId, { parentNode: parentId })

// RIGHT - Convert position in same update
const parent = getNode(parentId)
const child = getNode(childId)
const relativePos = {
  x: child.computedPosition.x - parent.computedPosition.x,
  y: child.computedPosition.y - parent.computedPosition.y
}
updateNode(childId, { parentNode: parentId, position: relativePos })
```

### Mistake 4: Assuming Position Updates Immediately

```typescript
// WRONG - computedPosition may be stale
updateNode(nodeId, { position: newPos })
console.log(node.computedPosition)  // May still show old value!

// RIGHT - Wait for Vue Flow to process
await nextTick()
console.log(node.computedPosition)  // Now correct
```

## Debug Logging Pattern

Add this to trace coordinate issues:

```typescript
function debugNodePosition(node: Node, context: string) {
  console.log(`[${context}] Node ${node.id}:`, {
    position: node.position,
    computedPosition: node.computedPosition,
    parentNode: node.parentNode,
    delta: node.parentNode ? {
      x: node.computedPosition.x - node.position.x,
      y: node.computedPosition.y - node.position.y
    } : 'N/A (root node)'
  })
}
```

## The "Position Inheritance" Mental Model

Think of positions like CSS positioning:

- **Root nodes** = `position: absolute` (relative to canvas)
- **Child nodes** = `position: relative` (relative to parent)
- **computedPosition** = `getBoundingClientRect()` (actual screen position)

This mental model helps predict behavior:
- Moving a parent moves all children (they're positioned relative to it)
- A child's `position` doesn't change when parent moves
- A child's `computedPosition` changes when parent moves

## Z-Index and Render Order

Related to coordinate systems, Vue Flow also manages z-index:

- Child nodes render AFTER parent nodes
- This means children appear ON TOP of their parent
- `zIndex` can override this but use sparingly
- Typical order: parent group → child task nodes → nested groups
