# Composable Patterns & Anti-Patterns

## Proven Patterns from PomoFlow Refactoring

### Pattern 1: Dependency Injection via Parameters

**✅ CORRECT** - Pass dependencies as parameters:
```typescript
// useCanvasDragDrop.ts
export function useCanvasDragDrop(
  nodes: Ref<Node[]>,
  resizeState: Ref<any>,
  syncEdges: () => void,
  project: (position: {x: number, y: number}) => {x: number, y: number}
) {
  const taskStore = useTaskStore() // ✅ OK - Pinia store
  const canvasStore = useCanvasStore() // ✅ OK - Pinia store

  const handleDrop = (event: DragEvent) => {
    const canvasPosition = project({ // ✅ Use injected function
      x: event.clientX,
      y: event.clientY
    })
    // ...
  }

  return { handleDrop }
}
```

**❌ WRONG** - Service locator anti-pattern:
```typescript
// useCanvasDragDrop.ts
export function useCanvasDragDrop() {
  const { project } = useVueFlow() // ❌ FAILS - not in component context
  // This will return undefined or wrong instance
}
```

**Why it fails**:
- `useVueFlow()` must be called in the component where `<VueFlow>` is rendered
- Calling it in a composable returns undefined or wrong instance
- The `project` function won't work correctly

---

### Pattern 2: Return Object Destructuring

**✅ CORRECT** - Return object with named properties:
```typescript
export function useCanvasNodes(taskStore, canvasStore) {
  const nodes = ref<Node[]>([])

  const syncNodes = () => {
    // Implementation
  }

  return {
    nodes,
    syncNodes
  }
}

// Component usage:
const { nodes, syncNodes } = useCanvasNodes(taskStore, canvasStore)
```

**Benefits**:
- Clear API
- Easy to destructure only what you need
- Supports tree-shaking
- Self-documenting

---

### Pattern 3: Composable Initialization Order

**✅ CORRECT** - Respect dependency chain:
```typescript
// Component setup
export default {
  setup() {
    // 1. Vue Flow instance (provides project function)
    const { viewport, project } = useVueFlow()

    // 2. No dependencies
    const { syncEdges } = useCanvasEdges(...)
    const { nodes, syncNodes } = useCanvasNodes(...)

    // 3. Depends on: nodes, syncEdges
    const { resizeState, ...resize } = useCanvasResize(nodes, syncEdges)

    // 4. Depends on: nodes, resizeState, syncEdges, project
    const { handleDrop, ...dragDrop } = useCanvasDragDrop(
      nodes,
      resizeState,
      syncEdges,
      project
    )

    // 5. Depends on: nodes, syncNodes, syncEdges
    const { ...contextMenus } = useCanvasContextMenus(
      nodes,
      syncNodes,
      syncEdges
    )

    return {
      // Expose what template needs
    }
  }
}
```

**❌ WRONG** - Random order:
```typescript
// Component setup - BROKEN
export default {
  setup() {
    // ❌ Using dragDrop before nodes is defined
    const dragDrop = useCanvasDragDrop(nodes, ...)
    const { nodes } = useCanvasNodes(...) // Too late!
  }
}
```

---

### Pattern 4: Readonly State Protection

**✅ CORRECT** - Prevent external mutations:
```typescript
export function useCanvasState() {
  // Private state
  const _state = ref({
    zoom: 1,
    selectedNodes: []
  })

  // Public readonly version
  const state = readonly(_state)

  // Controlled mutations only through methods
  const setZoom = (zoom: number) => {
    _state.value.zoom = zoom
  }

  const selectNode = (id: string) => {
    _state.value.selectedNodes.push(id)
  }

  return {
    state, // ✅ Readonly
    setZoom,
    selectNode
  }
}
```

**❌ WRONG** - Direct state exposure:
```typescript
export function useCanvasState() {
  const state = ref({
    zoom: 1,
    selectedNodes: []
  })

  // ❌ Anyone can mutate directly
  return { state }
}

// External code can do:
const { state } = useCanvasState()
state.value.zoom = 999 // ❌ Uncontrolled mutation
```

---

### Pattern 5: Cleanup Side Effects

**✅ CORRECT** - Always cleanup event listeners:
```typescript
export function useWindowResize() {
  const width = ref(window.innerWidth)

  const handleResize = () => {
    width.value = window.innerWidth
  }

  // Register listener
  window.addEventListener('resize', handleResize)

  // ✅ CRITICAL: Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return { width }
}
```

**❌ WRONG** - Memory leak:
```typescript
export function useWindowResize() {
  const width = ref(window.innerWidth)

  const handleResize = () => {
    width.value = window.innerWidth
  }

  window.addEventListener('resize', handleResize)
  // ❌ No cleanup - memory leak!

  return { width }
}
```

---

### Pattern 6: Reactive Parameter Handling

**✅ CORRECT** - Accept reactive refs:
```typescript
export function useFilteredTasks(
  tasks: Ref<Task[]>, // ✅ Accept ref
  filter: Ref<string>
) {
  const filteredTasks = computed(() => {
    return tasks.value.filter(t =>
      t.title.includes(filter.value)
    )
  })

  return { filteredTasks }
}

// Component usage:
const tasks = ref<Task[]>([])
const filter = ref('')
const { filteredTasks } = useFilteredTasks(tasks, filter)
```

**❌ WRONG** - Unwrapped values (not reactive):
```typescript
export function useFilteredTasks(
  tasks: Task[], // ❌ Not reactive
  filter: string
) {
  const filteredTasks = computed(() => {
    return tasks.filter(t => t.title.includes(filter))
    // ❌ Won't update when tasks/filter change
  })

  return { filteredTasks }
}

// Component usage (broken):
const tasks = ref<Task[]>([])
const filter = ref('')
const { filteredTasks } = useFilteredTasks(
  tasks.value, // ❌ Unwrapped
  filter.value // ❌ Unwrapped
)
```

---

### Pattern 7: Composable Size Limits

**✅ CORRECT** - Focused, single-concern composables:
```typescript
// useCanvasNodes.ts (~250 lines) ✅
export function useCanvasNodes(taskStore, canvasStore) {
  // Node synchronization only
  const nodes = ref<Node[]>([])
  const syncNodes = () => { /* logic */ }
  return { nodes, syncNodes }
}

// useCanvasControls.ts (~475 lines) ✅
export function useCanvasControls(...) {
  // Zoom, pan, fit view controls only
  return { handleZoom, handleFitView, ... }
}

// useCanvasDragDrop.ts (~400 lines) ✅
export function useCanvasDragDrop(...) {
  // Drag and drop logic only
  return { handleDrop, handleDragStart, ... }
}
```

**❌ WRONG** - God composable:
```typescript
// useCanvas.ts (2000+ lines) ❌
export function useCanvas() {
  // Nodes
  const nodes = ref([])
  const syncNodes = () => {}

  // Controls
  const zoom = ref(1)
  const handleZoom = () => {}

  // Drag and drop
  const handleDrop = () => {}

  // Context menus
  const handleContextMenu = () => {}

  // Resize
  const handleResize = () => {}

  // Edges
  const edges = ref([])
  const syncEdges = () => {}

  // ❌ Too much! Split into focused composables
  return { /* 50+ properties */ }
}
```

**Rule**: If composable > 500 lines, split it.

---

### Pattern 8: Named Exports for Tree-Shaking

**✅ CORRECT** - Named exports:
```typescript
// useCanvasNodes.ts
export function useCanvasNodes(...) {
  // Implementation
}

export function useCanvasEdges(...) {
  // Implementation
}

// Component import:
import { useCanvasNodes } from '@/composables/canvas/useCanvasNodes'
// ✅ Only imports what's used
```

**❌ WRONG** - Default exports:
```typescript
// useCanvasNodes.ts
export default function useCanvasNodes(...) {
  // Implementation
}

// Component import:
import useCanvasNodes from '@/composables/canvas/useCanvasNodes'
// ❌ Harder to tree-shake
```

---

### Pattern 9: Options Object for Many Parameters

**✅ CORRECT** - Options object (>3 parameters):
```typescript
interface CanvasOptions {
  taskStore: any
  canvasStore: any
  showPriority: Ref<boolean>
  showStatus: Ref<boolean>
  showDuration: Ref<boolean>
  showSchedule: Ref<boolean>
}

export function useCanvasDisplay(options: CanvasOptions) {
  const { taskStore, canvasStore, showPriority, ... } = options
  // Implementation
}

// Component usage:
const display = useCanvasDisplay({
  taskStore,
  canvasStore,
  showPriority,
  showStatus,
  showDuration,
  showSchedule
})
```

**❌ WRONG** - Long parameter list:
```typescript
export function useCanvasDisplay(
  taskStore: any,
  canvasStore: any,
  showPriority: Ref<boolean>,
  showStatus: Ref<boolean>,
  showDuration: Ref<boolean>,
  showSchedule: Ref<boolean>
) {
  // ❌ Hard to remember order, hard to read
}
```

---

### Pattern 10: Template Data Structure Alignment

**✅ CORRECT** - Match composable data structure to template expectations:
```typescript
// Composable
export function useCanvasNodes() {
  const allNodes: Node[] = []

  taskStore.filteredTasks.forEach(task => {
    allNodes.push({
      id: task.id,
      type: 'taskNode',
      data: task, // ✅ Task object directly as data
    })
  })

  return { nodes: allNodes }
}

// Template
<template #node-taskNode="nodeProps">
  <TaskNode :task="nodeProps.data" /> <!-- ✅ Access data directly -->
</template>
```

**❌ WRONG** - Mismatched structure:
```typescript
// Composable
export function useCanvasNodes() {
  const allNodes: Node[] = []

  taskStore.filteredTasks.forEach(task => {
    allNodes.push({
      id: task.id,
      type: 'taskNode',
      data: task, // Task directly
    })
  })

  return { nodes: allNodes }
}

// Template (WRONG)
<template #node-taskNode="nodeProps">
  <TaskNode :task="nodeProps.data.task" /> <!-- ❌ data.task doesn't exist -->
</template>
```

---

## Summary: Refactoring Patterns Checklist

- [ ] **Dependency Injection**: Pass dependencies as parameters, don't use service locator
- [ ] **Return Objects**: Use object destructuring for clear APIs
- [ ] **Initialization Order**: Respect dependency chains
- [ ] **Readonly State**: Protect state from external mutations
- [ ] **Cleanup**: Remove event listeners in `onUnmounted()`
- [ ] **Reactive Parameters**: Accept `Ref<T>` not `T`
- [ ] **Size Limits**: Keep composables <500 lines
- [ ] **Named Exports**: Use named exports for tree-shaking
- [ ] **Options Object**: Use for >3 parameters
- [ ] **Data Alignment**: Match composable structure to template expectations
