# Canvas Rebuild - Architecture

## Core Principles

### 1. Vue Flow Native
- Trust `parentNode` for parent-child relationships
- Store ABSOLUTE positions only
- Let Vue Flow compute relative positions automatically
- Follow Discussion #1202 pattern for attachments

### 2. Explicit Over Reactive
- NO watchers for sync operations
- Function calls trigger updates
- Clear data flow: User Action -> Store Update -> Vue Flow Sync

### 3. Minimal Surface Area
- CanvasView.vue: ~500 lines (orchestration only)
- Each composable: <200 lines (single responsibility)
- Store: ~400 lines (state only, no sync logic)

### 4. Testable
- Each composable independently testable
- No circular dependencies
- Mock-friendly architecture

---

## File Structure (New)

```
src/
├── views/
│   └── CanvasViewNew.vue          # ~500 lines - orchestration
│
├── stores/
│   └── canvasNew.ts               # ~400 lines - pure state
│
├── composables/canvasNew/
│   ├── useCanvasCore.ts           # ~150 lines - Vue Flow setup
│   ├── useCanvasNodes.ts          # ~200 lines - node sync
│   ├── useCanvasDrag.ts           # ~200 lines - drag handling
│   ├── useCanvasGroups.ts         # ~200 lines - group operations
│   └── useCanvasActions.ts        # ~150 lines - CRUD operations
│
└── components/canvasNew/
    ├── TaskNodeNew.vue            # ~300 lines - task display
    ├── GroupNodeNew.vue           # ~250 lines - group display
    └── CanvasInbox.vue            # ~200 lines - inbox panel
```

**Total New Code: ~2,550 lines** (vs current 22,500 lines)

---

## Component Responsibilities

### CanvasViewNew.vue (~500 lines)
- Vue Flow initialization and configuration
- Node type registration
- Orchestrate composables
- Handle Vue Flow events
- Template with Vue Flow component + sidebars

**NOT Responsible For:**
- Business logic (composables do this)
- State management (store does this)
- Complex calculations (utilities do this)

### Store: canvasNew.ts (~400 lines)
- Group state (CRUD)
- Viewport state
- Selection state
- Load/save to Supabase

**NOT Responsible For:**
- Vue Flow node management
- Sync logic
- Event handling

### Composables

| Composable | Responsibility | Lines |
|------------|----------------|-------|
| `useCanvasCore.ts` | Vue Flow instance, node types | ~150 |
| `useCanvasNodes.ts` | Build nodes array, sync to Vue Flow | ~200 |
| `useCanvasDrag.ts` | Handle drag-drop, update positions | ~200 |
| `useCanvasGroups.ts` | Group CRUD, parent-child | ~200 |
| `useCanvasActions.ts` | Task operations, context menu actions | ~150 |

### Components

| Component | Responsibility | Lines |
|-----------|----------------|-------|
| `TaskNodeNew.vue` | Render task in Vue Flow | ~300 |
| `GroupNodeNew.vue` | Render group/section in Vue Flow | ~250 |
| `CanvasInbox.vue` | Inbox panel with task list | ~200 |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     User Action                          │
│         (drag, click, create, delete, etc.)             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Composable                            │
│    (useCanvasDrag, useCanvasActions, etc.)              │
│                                                          │
│    1. Process action                                     │
│    2. Update store                                       │
│    3. Call syncNodes()                                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                      Store                               │
│                  (canvasNew.ts)                         │
│                                                          │
│    - Pinia reactive state                                │
│    - Persists to Supabase                               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  useCanvasNodes                          │
│                   syncNodes()                            │
│                                                          │
│    1. Read from store                                    │
│    2. Build Vue Flow nodes array                         │
│    3. Call setNodes()                                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Vue Flow                             │
│                                                          │
│    - Renders nodes                                       │
│    - Handles pan/zoom                                    │
│    - Computes positions                                  │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: NO WATCHERS. Each step is an explicit function call.

---

## Anti-Patterns to Avoid

### 1. Deep Watchers on Vue Flow State
```typescript
// BAD - creates race conditions
watch(nodes, () => { syncToStore() }, { deep: true })

// GOOD - explicit sync
function onNodeDragStop(event) {
  updatePosition(event)  // Explicit
}
```

### 2. Double Coordinate Conversion
```typescript
// BAD - store converts, then Vue Flow converts again
function syncNodes() {
  const relPos = toRelative(absolutePos, parentPos)  // Store converts
  node.position = relPos
  node.parentNode = parentId  // Vue Flow ALSO converts
}

// GOOD - store has absolute, Vue Flow handles relative
function syncNodes() {
  node.position = absolutePos  // For root nodes
  // OR
  node.position = toRelative(absolutePos, parentPos)  // For children
  node.parentNode = parentId  // Vue Flow renders correctly
}
```

### 3. Multiple Sync Sources
```typescript
// BAD - competing watchers
watch(tasks, syncTasksToCanvas)
watch(groups, syncGroupsToCanvas)
watch(auth, reloadEverything)

// GOOD - single sync point
function syncNodes() {
  // All sync logic in one place
  const nodes = [...groupNodes, ...taskNodes]
  setNodes(nodes)
}
```

---

## Vue Flow Configuration

```typescript
// CanvasViewNew.vue
const {
  nodes,
  edges,
  setNodes,
  findNode,
  onNodesChange,
  onNodeDragStop,
  onConnect
} = useVueFlow({
  nodes: [],
  edges: [],
  defaultEdgeOptions: { type: 'smoothstep' },
  fitViewOnInit: false,
  zoomOnScroll: true,
  panOnScroll: false,
  panOnDrag: true,
  selectionOnDrag: false,
  snapToGrid: true,
  snapGrid: [10, 10]
})
```

---

## Type Definitions

```typescript
// src/stores/canvasNew.ts

interface CanvasGroupNew {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom'
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  color: string
  isVisible: boolean
  parentGroupId?: string  // For nested groups
}

interface CanvasStateNew {
  groups: CanvasGroupNew[]
  viewport: { x: number; y: number; zoom: number }
  selectedIds: string[]
}
```
