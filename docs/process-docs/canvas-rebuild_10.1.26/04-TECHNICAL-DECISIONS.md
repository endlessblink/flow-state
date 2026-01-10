# Canvas Rebuild - Technical Decisions

## 1. Position Storage Strategy

### Decision: Store Absolute Positions

```typescript
// STORE: Always absolute positions
interface StoredPosition {
  x: number  // Absolute X on canvas
  y: number  // Absolute Y on canvas
}
```

### Rationale
- Simpler mental model
- Database always has world coordinates
- Vue Flow handles relative calculation when `parentNode` is set
- No double-conversion bugs

### Implementation
```typescript
// When saving task position:
await updateTask(taskId, {
  canvasPosition: node.computedPosition  // Always absolute
})

// When loading task position:
const node = {
  id: `task-${task.id}`,
  position: task.parentGroupId
    ? toRelative(task.canvasPosition, parentPosition)  // Convert for Vue Flow
    : task.canvasPosition,  // Root node, use as-is
  parentNode: task.parentGroupId ? `section-${task.parentGroupId}` : undefined
}
```

---

## 2. Parent-Child Assignment

### Decision: Follow Vue Flow Discussion #1202 Pattern

```typescript
async function attachToParent(taskId: string, parentId: string) {
  const task = findNode(taskId)
  const parent = findNode(parentId)

  // 1. Calculate relative position FIRST
  const relativePos = {
    x: task.computedPosition.x - parent.computedPosition.x,
    y: task.computedPosition.y - parent.computedPosition.y
  }

  // 2. Set extent BEFORE parentNode (prevents position jump)
  task.extent = 'parent'

  // 3. Set parentNode
  task.parentNode = parentId

  // 4. Set relative position
  task.position = relativePos

  // 5. Clear extent after nextTick
  await nextTick()
  task.extent = undefined

  // 6. Save to store (absolute position)
  store.updateTaskPosition(taskId, task.computedPosition)
}
```

### Why This Order Matters
1. `extent = 'parent'` tells Vue Flow "don't recalculate position yet"
2. Setting `parentNode` would normally trigger position recalculation
3. But with `extent = 'parent'`, it waits
4. We set the correct relative `position`
5. Clear `extent` to allow normal behavior

### Reference
Vue Flow Discussion #1202: https://github.com/bcakmakoglu/vue-flow/discussions/1202

---

## 3. Sync Strategy

### Decision: No Watchers, Explicit Function Calls Only

```typescript
// BAD - creates race conditions
watch(tasks, () => syncTasksToCanvas(), { deep: true })
watch(groups, () => syncGroupsToCanvas(), { deep: true })

// GOOD - explicit sync
function syncNodes() {
  const nodes = []

  // 1. Add groups as section nodes
  for (const group of store.groups) {
    nodes.push({
      id: `section-${group.id}`,
      type: 'sectionNode',
      position: group.position,
      data: { ...group }
    })
  }

  // 2. Add tasks
  for (const task of taskStore.canvasTasks) {
    const parentId = task.parentGroupId
      ? `section-${task.parentGroupId}`
      : undefined

    nodes.push({
      id: `task-${task.id}`,
      type: 'taskNode',
      position: parentId
        ? toRelative(task.canvasPosition, getParentPosition(parentId))
        : task.canvasPosition,
      parentNode: parentId,
      data: { task }
    })
  }

  setNodes(nodes)
}
```

### When to Call syncNodes()
- After app initialization
- After loading from Supabase
- After creating/deleting nodes
- NOT after position changes (handled by Vue Flow)

---

## 4. Node Type Naming

### Decision: Keep Existing Convention

| Node Type | ID Pattern | Component |
|-----------|------------|-----------|
| Section/Group | `section-{groupId}` | `GroupNodeNew.vue` |
| Task | `task-{taskId}` | `TaskNodeNew.vue` |

### Rationale
- Compatible with existing data
- No migration needed
- Clear distinction between groups and tasks

---

## 5. State Management Split

### Decision: Pinia for Persistence, Vue Flow for Display

```
┌─────────────────────────────────────────┐
│             Pinia Store                  │
│   (canvasNew.ts)                        │
│                                          │
│   - groups: CanvasGroupNew[]            │
│   - viewport: { x, y, zoom }            │
│   - selectedIds: string[]               │
│                                          │
│   Purpose: Persistence, Business Logic   │
└─────────────────────────────────────────┘
                    ↓
               syncNodes()
                    ↓
┌─────────────────────────────────────────┐
│             Vue Flow                     │
│   (useVueFlow)                          │
│                                          │
│   - nodes: Node[]                       │
│   - edges: Edge[]                       │
│   - viewport (internal)                 │
│                                          │
│   Purpose: Rendering, Interaction        │
└─────────────────────────────────────────┘
```

### Key Points
- Pinia store is source of truth for DATA
- Vue Flow is source of truth for DISPLAY STATE
- Sync is explicit, one-directional (store -> Vue Flow)
- Position updates go: Vue Flow -> Store -> Supabase

---

## 6. Coordinate Conversion Utilities

### Relative <-> Absolute

```typescript
function toRelativePosition(
  absolutePos: XYPosition,
  parentComputedPos: XYPosition
): XYPosition {
  return {
    x: absolutePos.x - parentComputedPos.x,
    y: absolutePos.y - parentComputedPos.y
  }
}

function toAbsolutePosition(
  relativePos: XYPosition,
  parentComputedPos: XYPosition
): XYPosition {
  return {
    x: relativePos.x + parentComputedPos.x,
    y: relativePos.y + parentComputedPos.y
  }
}
```

### Usage Rules
1. Database always stores ABSOLUTE
2. Convert to RELATIVE only when passing to Vue Flow with `parentNode`
3. Use `node.computedPosition` to get absolute position from Vue Flow

---

## 7. Error Handling

### Decision: Fail Fast, Log Clearly

```typescript
async function attachToParent(taskId: string, parentId: string) {
  const task = findNode(taskId)
  if (!task) {
    console.error(`[Canvas] Cannot attach: task ${taskId} not found`)
    return false
  }

  const parent = findNode(parentId)
  if (!parent) {
    console.error(`[Canvas] Cannot attach: parent ${parentId} not found`)
    return false
  }

  // Proceed with attachment...
  return true
}
```

### Logging Convention
- Prefix with `[Canvas]` for easy filtering
- Include node IDs in error messages
- Log before and after critical operations (in debug mode)

---

## 8. Performance Considerations

### Batch Updates

```typescript
// BAD - triggers multiple re-renders
for (const task of tasks) {
  updateNode(task.id, { position: task.position })
}

// GOOD - single re-render
setNodes(tasks.map(task => ({
  id: task.id,
  position: task.position,
  // ... other props
})))
```

### Computed Node Arrays

```typescript
// Use computed for derived data
const taskNodes = computed(() =>
  taskStore.canvasTasks.map(task => ({
    id: `task-${task.id}`,
    // ...
  }))
)

// Only sync when needed
function syncNodes() {
  setNodes([...groupNodes.value, ...taskNodes.value])
}
```

---

## 9. Type Safety

### Strict Types for All Interfaces

```typescript
interface CanvasGroupNew {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom'
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  color: string
  isVisible: boolean
  parentGroupId?: string
}

// Use type guards
function isCanvasGroup(node: Node): node is Node & { data: CanvasGroupNew } {
  return node.type === 'sectionNode'
}
```
