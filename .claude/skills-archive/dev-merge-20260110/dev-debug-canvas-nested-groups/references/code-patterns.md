# Vue Flow Code Patterns for Nested Nodes

## Pattern 1: Safe Reparenting

Move a node from one parent to another (or to root) without position jumping.

```typescript
function reparentNode(
  nodeId: string,
  newParentId: string | undefined,
  getNode: (id: string) => Node | undefined,
  updateNode: (id: string, data: Partial<Node>) => void
) {
  const node = getNode(nodeId)
  if (!node) return

  // Step 1: Get current absolute position
  const absolutePos = { ...node.computedPosition }

  // Step 2: Calculate new position based on target
  let newPosition: { x: number, y: number }

  if (newParentId) {
    // Moving to a new parent: convert to relative
    const newParent = getNode(newParentId)
    if (!newParent) return

    newPosition = {
      x: absolutePos.x - newParent.computedPosition.x,
      y: absolutePos.y - newParent.computedPosition.y
    }
  } else {
    // Moving to root: position becomes absolute
    newPosition = absolutePos
  }

  // Step 3: Update atomically
  updateNode(nodeId, {
    parentNode: newParentId,
    position: newPosition
  })
}
```

## Pattern 2: Containment Detection

Check if a node is inside a group using center-point detection.

```typescript
interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function getNodeBounds(node: Node): Bounds {
  return {
    x: node.computedPosition.x,
    y: node.computedPosition.y,
    width: node.dimensions?.width ?? 200,
    height: node.dimensions?.height ?? 100
  }
}

function getNodeCenter(node: Node): { x: number, y: number } {
  const bounds = getNodeBounds(node)
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  }
}

function isNodeInsideGroup(node: Node, group: Node): boolean {
  const nodeCenter = getNodeCenter(node)
  const groupBounds = getNodeBounds(group)

  return (
    nodeCenter.x >= groupBounds.x &&
    nodeCenter.x <= groupBounds.x + groupBounds.width &&
    nodeCenter.y >= groupBounds.y &&
    nodeCenter.y <= groupBounds.y + groupBounds.height
  )
}

// Find which group (if any) contains a node
function findContainingGroup(
  node: Node,
  groups: Node[]
): Node | undefined {
  // Sort by area (smallest first) to prefer most specific container
  const sortedGroups = [...groups].sort((a, b) => {
    const areaA = (a.dimensions?.width ?? 0) * (a.dimensions?.height ?? 0)
    const areaB = (b.dimensions?.width ?? 0) * (b.dimensions?.height ?? 0)
    return areaA - areaB
  })

  return sortedGroups.find(group => isNodeInsideGroup(node, group))
}
```

## Pattern 3: Hierarchy Validation

Validate and repair parent-child relationships on load.

```typescript
function validateAndRepairHierarchy(
  nodes: Node[],
  updateNode: (id: string, data: Partial<Node>) => void
): { orphans: string[], repaired: string[] } {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const orphans: string[] = []
  const repaired: string[] = []

  for (const node of nodes) {
    if (!node.parentNode) continue

    const parent = nodeMap.get(node.parentNode)

    if (!parent) {
      // Parent doesn't exist - orphan node
      orphans.push(node.id)
      console.warn(`Orphan node ${node.id}: parent ${node.parentNode} not found`)

      // Option 1: Convert to root node (preserve visual position)
      updateNode(node.id, {
        parentNode: undefined,
        // position stays as-is (was relative, now treated as absolute)
        // This may cause visual shift - document for user
      })
      repaired.push(node.id)
      continue
    }

    // Validate position makes sense
    if (!isNodeInsideGroup(node, parent)) {
      console.warn(`Node ${node.id} outside parent ${node.parentNode} bounds`)
      // Don't auto-repair this - it might be intentional during drag
    }
  }

  return { orphans, repaired }
}
```

## Pattern 4: Safe Node Creation with Parent

Create a new node as a child of an existing group.

```typescript
function createChildNode(
  parentId: string,
  canvasPosition: { x: number, y: number }, // Where user clicked/dropped
  getNode: (id: string) => Node | undefined,
  addNodes: (nodes: Node[]) => void
): string | null {
  const parent = getNode(parentId)
  if (!parent) return null

  // Convert canvas position to relative position
  const relativePosition = {
    x: canvasPosition.x - parent.computedPosition.x,
    y: canvasPosition.y - parent.computedPosition.y
  }

  const newNodeId = `node-${Date.now()}`

  addNodes([{
    id: newNodeId,
    type: 'default',
    position: relativePosition,
    parentNode: parentId,
    extent: 'parent', // Constrain to parent bounds
    data: { label: 'New Node' }
  }])

  return newNodeId
}
```

## Pattern 5: Batch Position Updates

Update multiple node positions efficiently without triggering unnecessary re-renders.

```typescript
function batchUpdatePositions(
  updates: Array<{ id: string, position: { x: number, y: number } }>,
  updateNode: (id: string, data: Partial<Node>) => void
) {
  // Use requestAnimationFrame to batch DOM updates
  requestAnimationFrame(() => {
    for (const { id, position } of updates) {
      updateNode(id, { position })
    }
  })
}

// For large batches, consider using setNodes directly
function bulkSetPositions(
  updates: Map<string, { x: number, y: number }>,
  getNodes: () => Node[],
  setNodes: (nodes: Node[]) => void
) {
  const newNodes = getNodes().map(node => {
    const newPos = updates.get(node.id)
    if (newPos) {
      return { ...node, position: newPos }
    }
    return node
  })

  setNodes(newNodes)
}
```

## Pattern 6: Position Persistence

Save and restore node positions correctly.

```typescript
interface PersistedNode {
  id: string
  position: { x: number, y: number }
  parentNode?: string
  type: string
  data: any
}

function persistNodes(nodes: Node[]): PersistedNode[] {
  return nodes.map(node => ({
    id: node.id,
    position: node.position, // NOT computedPosition
    parentNode: node.parentNode,
    type: node.type ?? 'default',
    data: node.data
  }))
}

function restoreNodes(
  persisted: PersistedNode[],
  existingParents: Set<string>
): Node[] {
  return persisted.map(p => {
    // Validate parent still exists
    const parentNode = p.parentNode && existingParents.has(p.parentNode)
      ? p.parentNode
      : undefined

    // If parent was removed, position needs conversion
    // But we don't have computedPosition - this is a data migration issue
    // Best practice: always persist full hierarchy together

    return {
      id: p.id,
      position: p.position,
      parentNode,
      type: p.type,
      data: p.data
    }
  })
}
```

## Pattern 7: Drag Event Handling

Properly handle drag events for nested nodes.

```typescript
function setupDragHandlers(
  onNodeDragStart: (event: NodeDragEvent) => void,
  onNodeDragStop: (event: NodeDragEvent) => void,
  getNode: (id: string) => Node | undefined,
  updateNode: (id: string, data: Partial<Node>) => void,
  persistPosition: (id: string, position: { x: number, y: number }) => void
) {
  return {
    onNodeDragStart: (event: NodeDragEvent) => {
      const { node } = event
      // Store initial state if needed for undo
      console.log(`[DRAG START] ${node.id}`, node.position)
      onNodeDragStart(event)
    },

    onNodeDragStop: (event: NodeDragEvent) => {
      const { node } = event

      // Vue Flow has already updated node.position
      // Just persist the new position
      persistPosition(node.id, node.position)

      // DO NOT manually recalculate positions for children
      // Vue Flow handles this automatically via parentNode

      console.log(`[DRAG STOP] ${node.id}`, node.position)
      onNodeDragStop(event)
    }
  }
}
```

## Pattern 8: Drop Zone Detection

Detect which group a node is dropped into.

```typescript
function handleNodeDrop(
  droppedNode: Node,
  dropPosition: { x: number, y: number }, // Canvas coordinates
  groups: Node[],
  updateNode: (id: string, data: Partial<Node>) => void
) {
  // Find the smallest group that contains the drop position
  const candidateGroups = groups.filter(group => {
    const bounds = getNodeBounds(group)
    return (
      dropPosition.x >= bounds.x &&
      dropPosition.x <= bounds.x + bounds.width &&
      dropPosition.y >= bounds.y &&
      dropPosition.y <= bounds.y + bounds.height
    )
  })

  // Sort by area (smallest = most specific)
  candidateGroups.sort((a, b) => {
    const areaA = (a.dimensions?.width ?? 0) * (a.dimensions?.height ?? 0)
    const areaB = (b.dimensions?.width ?? 0) * (b.dimensions?.height ?? 0)
    return areaA - areaB
  })

  const targetGroup = candidateGroups[0]

  if (targetGroup && targetGroup.id !== droppedNode.parentNode) {
    // Reparent to new group
    reparentNode(droppedNode.id, targetGroup.id, getNode, updateNode)
  } else if (!targetGroup && droppedNode.parentNode) {
    // Dropped outside all groups - make root
    reparentNode(droppedNode.id, undefined, getNode, updateNode)
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Manual Child Position Updates

```typescript
// WRONG - Don't manually update children when parent moves
onNodeDragStop((event) => {
  const parent = event.node
  getChildren(parent.id).forEach(child => {
    // NO! Vue Flow handles this automatically
    updateNode(child.id, {
      position: { x: child.position.x + deltaX, y: child.position.y + deltaY }
    })
  })
})

// RIGHT - Just let Vue Flow handle it
onNodeDragStop((event) => {
  persistPosition(event.node.id, event.node.position)
})
```

### Anti-Pattern 2: Storing computedPosition

```typescript
// WRONG - computedPosition changes when parent moves
saveToDatabase({
  position: node.computedPosition
})

// RIGHT - position is stable and correct
saveToDatabase({
  position: node.position,
  parentNode: node.parentNode
})
```

### Anti-Pattern 3: Setting parentNode Without Position Conversion

```typescript
// WRONG - Node will jump
updateNode(nodeId, { parentNode: newParentId })

// RIGHT - Convert position atomically
const relativePos = toRelativePosition(node.computedPosition, parent)
updateNode(nodeId, { parentNode: newParentId, position: relativePos })
```
