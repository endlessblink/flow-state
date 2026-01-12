# Canvas System Deep Dive - Complete Architecture Mapping

> **Generated:** January 11, 2026
> **Purpose:** Exhaustive mapping of all canvas systems for task positions, group counting, sync logic, and related computations.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Canvas Composables](#2-canvas-composables)
3. [Canvas Stores](#3-canvas-stores)
4. [Canvas Components](#4-canvas-components)
5. [Type Definitions](#5-type-definitions)
6. [Utility Functions & Position Calculations](#6-utility-functions--position-calculations)
7. [Supabase Sync Integration](#7-supabase-sync-integration)
8. [Group Counting System](#8-group-counting-system)
9. [Position Persistence](#9-position-persistence)
10. [Critical Formulas & Coordinate Systems](#10-critical-formulas--coordinate-systems)
11. [Conflict Resolution](#11-conflict-resolution)
12. [Complete Data Flow Diagrams](#12-complete-data-flow-diagrams)

---

## 1. Architecture Overview

### 1.1 System Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USER INTERACTION LAYER                         │
│  CanvasView.vue → GroupNodeSimple.vue → TaskNode.vue                │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION LAYER                              │
│  useCanvasOrchestrator → Aggregates all sub-composables              │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPOSABLE LAYER (30+ files)                      │
│  useCanvasSync │ useCanvasDragDrop │ useCanvasParentChild │ etc.    │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        STORE LAYER                                   │
│  useCanvasStore │ useTaskStore │ useCanvasUiStore │ etc.            │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER                                │
│  useSupabaseDatabase │ localStorage │ Realtime WebSocket            │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architecture Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **Orchestrator** | `useCanvasOrchestrator` | Central coordination of all canvas operations |
| **Single Source of Truth** | `useCanvasSync.ts` | Only file that syncs nodes to Vue Flow |
| **Optimistic Sync** | `useCanvasOptimisticSync` | Prevents server echo conflicts |
| **Drifting Shield** | Multiple lock flags | Ignores updates during drag/resize |
| **Position Lock** | 7s timeout | Prevents race conditions on position |

---

## 2. Canvas Composables

### 2.1 File Inventory (`src/composables/canvas/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `useCanvasOrchestrator.ts` | Main orchestrator | nodes, edges, all handlers |
| `useCanvasSync.ts` | **CRITICAL** - Node sync | batchedSyncNodes, applyRemoteChanges |
| `useCanvasNodeSync.ts` | Task→Node creation | syncNodes |
| `useCanvasEdgeSync.ts` | Edge sync from dependsOn | syncEdges |
| `useCanvasDragDrop.ts` | Drag-drop orchestration | handleNodeDragStart/Stop |
| `useCanvasGroupDrag.ts` | Group drag strategy | handleGroupDragStop |
| `useCanvasTaskDrag.ts` | Task drag strategy | handleTaskDragStop |
| `useCanvasParentChild.ts` | Nesting logic | findSmallestContainingSection |
| `useCanvasTaskCounts.ts` | Badge counts | updateSectionTaskCounts |
| `useCanvasOptimisticSync.ts` | Conflict prevention | trackLocalChange, markSynced |
| `useNodeAttachment.ts` | Attach/detach nodes | attachNodeToParent |
| `useCanvasEvents.ts` | Vue Flow events | handleDrop, handlePaneClick |
| `useCanvasResize.ts` | Group resizing | handleSectionResizeEnd |
| `useCanvasSelection.ts` | Rubber-band selection | startSelection, endSelection |
| `useCanvasActions.ts` | Task/group CRUD | deleteNode, createTaskHere |
| `useCanvasGroupActions.ts` | Group CRUD | createGroup, deleteGroup |
| `useCanvasTaskActions.ts` | Task CRUD | createTaskInGroup |
| `useCanvasHotkeys.ts` | Keyboard shortcuts | Shift+G, Delete |
| `useCanvasZoom.ts` | Zoom operations | fitView, zoomIn/Out |
| `useCanvasNavigation.ts` | Viewport control | fitCanvas, zoomToSelection |
| `useCanvasContextMenus.ts` | Context menus | closeAllContextMenus |
| `useCanvasModals.ts` | Modal state | Wrapper for store |
| `useCanvasConnections.ts` | Edge creation | handleConnect, disconnectEdge |
| `useCanvasOverdueCollector.ts` | Smart groups | ensureOverdueGroup |
| `useCanvasAlignment.ts` | Align/distribute | alignLeft, distributeHorizontal |
| `useCanvasSectionProperties.ts` | Property assignment | applySectionPropertiesToTask |
| `useCanvasGroupMembership.ts` | Group queries | getTasksInGroup, getGroupTaskCount |
| `useCanvasFilteredState.ts` | Task filtering | tasksWithCanvasPosition |
| `useCanvasLifecycle.ts` | Mount/unmount | validateStores, cleanup |
| `useCanvasResizeState.ts` | Resize state | Internal to useCanvasResize |
| `useCanvasResizeCalculation.ts` | Resize math | Internal to useCanvasResize |

### 2.2 Core Composable: useCanvasSync.ts

**CRITICAL: This is the SINGLE source of truth for canvas node synchronization.**

#### Exports
```typescript
export function useCanvasSync(deps: SyncDependencies) {
  return {
    batchedSyncNodes,      // Batched node sync with priority
    batchedSyncEdges,      // Batched edge sync
    performSystemRestart,  // Full canvas restart
    removeTaskNode,        // Remove single task
    removeTaskNodes,       // Remove multiple tasks
    applyRemoteChanges     // Handle Supabase realtime
  }
}
```

#### Lock Checking (Drifting Shield)
```typescript
const checkLocks = () => {
  return deps.isNodeDragging.value ||
         deps.isDragSettlingRef.value ||
         canvasStore.isDragging ||
         deps.resizeState.value.isResizing ||
         deps.isResizeSettling.value ||
         (window as any).__PomoFlowIsDragging
}
```

#### Remote Change Handling
```typescript
const applyRemoteChanges = (payload: any) => {
  // IGNORES updates if ANY canvas operation is active
  if (checkLocks()) {
    console.log('[DRIFTING SHIELD] Ignoring remote update during drag')
    return
  }
  // Routes to appropriate sync handler
}
```

### 2.3 useCanvasOrchestrator.ts

**Aggregates all sub-composables and provides unified interface to CanvasView.vue**

#### State Refs
| Ref | Type | Purpose |
|-----|------|---------|
| `nodes` | `Ref<Node[]>` | Vue Flow nodes |
| `edges` | `Ref<Edge[]>` | Vue Flow edges |
| `vueFlowRef` | `Ref` | Vue Flow DOM element |
| `isNodeDragging` | `Ref<boolean>` | User dragging nodes |
| `isDragSettling` | `Ref<boolean>` | Post-drag settling (800ms) |
| `isSyncing` | `Ref<boolean>` | Sync in progress |
| `isHandlingNodeChange` | `Ref<boolean>` | Processing node change |
| `recentlyRemovedEdges` | `Ref<Set<string>>` | Zombie edge prevention (2s TTL) |
| `recentlyDeletedGroups` | `Ref<Set<string>>` | Deleted group tracking |
| `isVueFlowReady` | `Ref<boolean>` | Vue Flow initialized |

#### Watchers
| Watch Target | Trigger Action |
|--------------|----------------|
| `taskStore.tasks` (deep) | `sync.batchedSyncNodes('low')` |
| `canvasStore.groups` (deep) | `sync.batchedSyncNodes('normal')` |
| `taskStore.activeStatusFilter` | `sync.syncNodes()` |
| `taskStore.hideCanvasDoneTasks` | `sync.syncNodes()` |
| `taskStore.hideCanvasOverdueTasks` | `sync.syncNodes()` |
| `onMoveEnd` (Vue Flow) | Persist viewport to canvasStore |

### 2.4 useCanvasParentChild.ts

**Handles group nesting and containment detection**

#### Exports
```typescript
export function useCanvasParentChild(nodes, sections) {
  return {
    getGroupAbsolutePositionHelper,
    findAllContainingSections,
    findSmallestContainingSection,
    findSectionForTask,
    isActuallyInsideParent,
    calculateZIndex
  }
}
```

#### Containment Logic

**For Groups (50% overlap):**
```typescript
// Uses isRectMoreThanHalfInside
// Group is nested if >50% of its area overlaps parent's inner rect
const isNested = isRectMoreThanHalfInside(groupRect, parentInnerRect)
```

**For Tasks (center-point):**
```typescript
// Uses task center point
const taskCenter = getTaskCenter(task.x, task.y, 220, 100)
const isInGroup = isPointInRect(taskCenter.x, taskCenter.y, groupRect)
```

#### Z-Index Calculation
```typescript
const calculateZIndex = (section, isSelected) => {
  const BASE_Z = 10
  const DEPTH_BONUS = 50  // Per nesting level
  const sizeBonus = Math.min(49, 1000000 / area)  // Smaller = higher
  return BASE_Z + (DEPTH_BONUS * depth) + sizeBonus + (isSelected ? 1000 : 0)
}
```

### 2.5 useCanvasDragDrop.ts

**Orchestrates drag start/stop for both tasks and groups**

#### Drag Start
```typescript
const handleNodeDragStart = (event) => {
  // 1. Capture ABSOLUTE start positions
  dragStartPositions.set(nodeId, getAbsoluteNodePosition(node))

  // 2. Capture all descendant positions (for group drag)
  captureDescendantPositions(node)

  // 3. Set global drag locks
  canvasStore.isDragging = true
  window.__PomoFlowIsDragging = true

  // 4. Elevate z-index for groups
  if (isGroup) node.zIndex = 1000 + node.zIndex
}
```

#### Drag Stop
```typescript
const handleNodeDragStop = (node, draggedNodes) => {
  if (isGroup(node)) {
    groupDrag.handleGroupDragStop(node, draggedNodes)
  } else {
    taskDrag.handleTaskDragStop(node, draggedNodes)
  }

  // Release locks after 300ms + 800ms settling
  setTimeout(() => {
    canvasStore.isDragging = false
    window.__PomoFlowIsDragging = false
  }, 300)

  isDragSettlingRef.value = true
  setTimeout(() => isDragSettlingRef.value = false, 800)
}
```

### 2.6 useCanvasOptimisticSync.ts

**Prevents server echo from overwriting user's local changes**

```typescript
interface PendingChange {
  type: 'task' | 'group'
  position: { x: number; y: number }
  timestamp: number
  synced: boolean
}

const trackLocalChange = (id, type, position) => {
  pendingChanges.set(id, { type, position, timestamp: Date.now(), synced: false })
}

const shouldAcceptRemoteChange = (id, remoteTimestamp) => {
  const pending = pendingChanges.get(id)
  if (!pending) return true  // No local change
  if (remoteTimestamp > pending.timestamp) return true  // Remote is newer
  return false  // Local is newer - reject remote
}

const markSynced = (id) => {
  const pending = pendingChanges.get(id)
  if (pending) {
    pending.synced = true
    setTimeout(() => pendingChanges.delete(id), 1000)  // Cleanup after 1s
  }
}
```

---

## 3. Canvas Stores

### 3.1 Main Canvas Store (`src/stores/canvas.ts`)

#### State Properties
| Property | Type | Purpose |
|----------|------|---------|
| `viewport` | `{x, y, zoom}` | Current canvas viewport |
| `selectedNodeIds` | `string[]` | Selected node IDs |
| `_rawGroups` | `CanvasGroup[]` | All groups (including hidden) |
| `groups` (computed) | `CanvasGroup[]` | Visible groups only |
| `nodes` | `Node[]` | Vue Flow nodes |
| `edges` | `Edge[]` | Vue Flow edges |
| `isDragging` | `boolean` | Global drag state |
| `connectMode` | `boolean` | Connection drawing mode |
| `zoomConfig` | `{minZoom, maxZoom}` | Zoom limits |

#### Critical Actions

**patchGroups() - SAFE position update API:**
```typescript
const patchGroups = (updates: Map<string, GroupPatch>) => {
  for (const [id, changes] of updates) {
    // Check optimistic sync locks
    const pending = useCanvasOptimisticSync().getPendingPosition(id)
    if (pending && changes.position) {
      skippedLocked.push(id)
      continue  // SKIP - respect position lock
    }

    const group = _rawGroups.find(g => g.id === id)
    if (group) {
      Object.assign(group, changes, { updatedAt: Date.now() })
      patched.push(id)
    }
  }
  return { patched, skippedLocked, notFound }
}
```

**loadFromDatabase() - Initial load:**
```typescript
const loadFromDatabase = async () => {
  // BUG-169 FIX: Safety guard - don't overwrite existing groups in first 10s
  if (loadedGroups.length === 0 && _rawGroups.value.length > 0) {
    const timeSinceSession = Date.now() - window.PomoFlowSessionStart
    if (timeSinceSession < 10000) {
      console.warn('BLOCKED empty overwrite during auth race')
      return
    }
  }

  _rawGroups.value = loadedGroups
}
```

**recalculateAllTaskCounts():**
```typescript
const recalculateAllTaskCounts = (tasks: Task[]) => {
  _rawGroups.value.forEach(group => {
    group.taskCount = getTaskCountInGroupRecursive(group.id, tasks)
  })
}
```

**getTaskCountInGroupRecursive():**
```typescript
const getTaskCountInGroupRecursive = (groupId, tasks) => {
  const group = _rawGroups.find(g => g.id === groupId)
  if (!group) return 0

  // Get child groups
  const childGroups = _rawGroups.filter(g => g.parentGroupId === groupId)
  const childGroupRects = childGroups.map(c => calculateRect(c))

  // Count direct tasks (not in child groups)
  let count = tasks.filter(t => {
    if (t._soft_deleted) return false
    if (t.parentId === groupId) return true  // Explicit membership

    // Spatial fallback
    const isInGroup = isPointInRect(t.canvasPosition, groupRect)
    const isInChild = childGroupRects.some(r => isPointInRect(t.canvasPosition, r))
    return isInGroup && !isInChild
  }).length

  // Add child group counts recursively
  childGroups.forEach(c => {
    count += getTaskCountInGroupRecursive(c.id, tasks)
  })

  return count
}
```

### 3.2 Canvas UI Store (`src/stores/canvas/canvasUi.ts`)

| Property | Purpose |
|----------|---------|
| `viewport` | Separate viewport state |
| `hasInitialFit` | Whether initial zoom-to-fit executed |
| `viewportInitializedAt` | Timestamp of viewport init |
| `zoomConfig` | Min/max zoom (5%-400%) |
| `zoomHistory` | History of zoom levels (max 50) |
| `operationLoading` | Loading states per operation type |
| `operationError` | Current error with retryable flag |

### 3.3 Canvas Interaction Store (`src/stores/canvas/canvasInteraction.ts`)

| Property | Purpose |
|----------|---------|
| `selectedNodeIds` | Selected nodes |
| `multiSelectMode` | Multi-select enabled |
| `selectionRect` | Rubber-band selection box |
| `selectionMode` | 'rectangle' / 'lasso' / 'click' |
| `isSelecting` | Selection in progress |
| `connectMode` | Connection drawing mode |
| `connectingFrom` | Source node for connection |

### 3.4 Canvas Modals Store (`src/stores/canvas/modals.ts`)

Tracks open/close state for all canvas modals:
- Task edit modal
- Quick task create modal
- Batch edit modal
- Group modal
- Group edit modal
- Delete confirmation modal
- Bulk delete modal

### 3.5 Canvas Context Menus Store (`src/stores/canvas/contextMenus.ts`)

Tracks position and visibility for:
- Canvas context menu (right-click on empty space)
- Node context menu (right-click on node)
- Edge context menu (right-click on edge)

---

## 4. Canvas Components

### 4.1 CanvasView.vue (Main Container)

**Location:** `src/views/CanvasView.vue`

#### Template Structure
```
canvas-layout
├── canvas-drop-zone
│   ├── CanvasLoadingOverlay
│   ├── CanvasEmptyState
│   ├── CanvasStatusBanner
│   ├── UnifiedInboxPanel
│   ├── CanvasToolbar
│   └── canvas-container
│       └── VueFlow
│           ├── CanvasSelectionBox
│           ├── Background (grid)
│           ├── SVG markers (arrows)
│           ├── #node-sectionNode: GroupNodeSimple
│           └── #node-taskNode: TaskNode
├── CanvasModals
└── CanvasContextMenus
```

#### Vue Flow Configuration
```typescript
{
  'snap-to-grid': [16, 16],
  'min-zoom': 0.05,
  'max-zoom': 4.0,
  'pan-on-drag': !shiftPressed,  // Shift disables pan for selection
  'nodes-draggable': !shiftPressed,
  'multi-selection-key-code': 'Shift',
  'elevate-nodes-on-select': false,
  'elevate-edges-on-select': true,
  'connect-on-drag-nodes': false
}
```

#### Event Handlers
| Event | Handler | Purpose |
|-------|---------|---------|
| `@drop` | `handleDrop()` | External task drop |
| `@node-drag-start` | `handleNodeDragStart()` | Start drag tracking |
| `@node-drag-stop` | `handleNodeDragStop()` | Process drag end |
| `@nodes-change` | `handleNodesChange()` | Node list changes |
| `@selection-change` | `handleSelectionChange()` | Selection updates |
| `@pane-click` | `handlePaneClick()` | Deselect on click |
| `@node-context-menu` | `handleNodeContextMenu()` | Right-click node |
| `@edge-context-menu` | `handleEdgeContextMenu()` | Right-click edge |
| `@connect` | `handleConnect()` | Edge connection |

### 4.2 GroupNodeSimple.vue

**Location:** `src/components/canvas/GroupNodeSimple.vue`

#### Props
| Prop | Type | Purpose |
|------|------|---------|
| `data` | `any` | Section data, isCollapsed, taskCount, name, color |
| `selected` | `boolean` | Vue Flow selection state |
| `dragging` | `boolean` | Vue Flow drag state |

#### Emits
| Event | Payload | Purpose |
|-------|---------|---------|
| `update` | `{name}` | Name changed |
| `collect` | - | Collect tasks button |
| `contextMenu` | `(event, section)` | Right-click |
| `open-settings` | - | Settings button |
| `resizeStart/resize/resizeEnd` | `{sectionId, event}` | Resize operations |

#### Template
```
section-node
├── section-header
│   ├── section-color-dot
│   ├── collapse-btn
│   ├── section-name-input
│   ├── section-date-suffix (TASK-130)
│   └── section-count (task badge)
├── section-body
│   └── <slot> (child nodes)
└── NodeResizer (handles)
```

#### Resize Constraints
- Min: 200w × 80h
- Max: 50000w × 50000h
- Handles: All 4 edges + 4 corners

### 4.3 TaskNode.vue

**Location:** `src/components/canvas/TaskNode.vue`

#### Props
| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `task` | `Task` | required | Task data |
| `isSelected` | `boolean` | false | Selection state |
| `multiSelectMode` | `boolean` | false | Multi-select active |
| `showPriority` | `boolean` | true | Show priority bar |
| `showStatus` | `boolean` | true | Show status badge |
| `showDuration` | `boolean` | true | Show duration badge |
| `showSchedule` | `boolean` | true | Show schedule badge |
| `isConnecting` | `boolean` | false | Drawing connection |
| `isDragging` | `boolean` | false | Being dragged |

#### Emits
| Event | Payload | Purpose |
|-------|---------|---------|
| `edit` | `task` | Open editor |
| `select` | `(task, multiSelect)` | Selection |
| `contextMenu` | `(event, task)` | Right-click |

#### Template
```
task-node
├── task-node-content
│   ├── TaskNodePriority (color bar)
│   ├── TaskNodeHeader (title + timer)
│   ├── TaskNodeDescription (markdown)
│   └── TaskNodeMeta (badges)
├── TaskNodeSelection (corners)
└── Handle (connection points)
```

#### LOD (Level of Detail)
| Zoom Level | Changes |
|------------|---------|
| < 0.6 | Hide description |
| < 0.4 | Hide metadata |
| < 0.2 | Minimal block (120×60) |

### 4.4 CanvasToolbar.vue

**Location:** `src/components/canvas/CanvasToolbar.vue`

Fixed toolbar on right edge with:
- Add Task button
- Create Group button
- Hide Overdue toggle
- Hide Done toggle

---

## 5. Type Definitions

### 5.1 Task (Canvas-Related Properties)

```typescript
interface Task {
  id: string
  title: string
  // ... other fields ...

  // CANVAS POSITION
  canvasPosition?: { x: number; y: number }  // Absolute coordinates

  // GROUP MEMBERSHIP
  parentId?: string  // Links to CanvasGroup.id

  // TASK NESTING
  parentTaskId?: string | null  // Links to another Task.id

  // DEPENDENCIES (edges)
  dependsOn?: string[]  // Task IDs this depends on
  connectionTypes?: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }

  // CANVAS STATE
  isInInbox?: boolean  // True if not on canvas
  _soft_deleted?: boolean  // Soft delete flag
}
```

### 5.2 CanvasGroup

```typescript
interface CanvasGroup {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'

  // POSITION & DIMENSIONS
  position: {
    x: number
    y: number
    width: number
    height: number
  }

  color: string
  layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean
  isCollapsed: boolean
  collapsedHeight?: number

  // NESTING
  parentGroupId?: string | null  // Self-referencing FK

  // SMART GROUP FEATURES
  isPowerMode?: boolean
  powerKeyword?: PowerKeywordResult | null
  autoCollect?: boolean
  assignOnDrop?: AssignOnDropSettings
  collectFilter?: CollectFilterSettings

  // METADATA
  taskCount?: number  // Computed, not persisted
  updatedAt?: string
}
```

### 5.3 Vue Flow Types

```typescript
// Node (from @vue-flow/core)
interface Node<Data = any> {
  id: string
  type: 'taskNode' | 'sectionNode'
  position: { x: number; y: number }  // RELATIVE to parent
  data: Data
  parentNode?: string  // Parent node ID
  zIndex?: number
  selected?: boolean
  draggable?: boolean
  connectable?: boolean
}

// Edge (from @vue-flow/core)
interface Edge<Data = any> {
  id: string  // Format: e-${sourceId}-${targetId}
  source: string  // Source task ID
  target: string  // Target task ID
  type: 'smoothstep'
  animated?: boolean
  data?: Data
}
```

### 5.4 Position Utilities

```typescript
interface Position {
  x: number
  y: number
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface NodeWithPosition {
  id: string
  position: Position
  parentNode?: string
}
```

---

## 6. Utility Functions & Position Calculations

### 6.1 Canvas Constants (`src/constants/canvas.ts`)

```typescript
export const CANVAS = {
  // Dimensions
  DEFAULT_GROUP_WIDTH: 300,
  DEFAULT_GROUP_HEIGHT: 200,
  DEFAULT_TASK_WIDTH: 220,
  DEFAULT_TASK_HEIGHT: 100,
  MIN_GROUP_WIDTH: 150,
  MIN_GROUP_HEIGHT: 100,

  // Z-Index Layers
  Z_INDEX_BASE: 1000,
  Z_INDEX_TASK: 1000,
  Z_INDEX_GROUP: 10,
  Z_INDEX_DRAGGING: 3000,
  Z_INDEX_SELECTED: 2000,

  // Timing
  SYNC_DEBOUNCE_MS: 300,
  POSITION_LOCK_TIMEOUT_MS: 7000,
  ANIMATION_DURATION_MS: 200,

  // Limits
  MAX_RECURSION_DEPTH: 50,
  MAX_NESTING_LEVEL: 10,

  // Spacing
  GROUP_PADDING: 20,
  TASK_MARGIN: 10,
  GRID_SNAP_SIZE: 16,

  // CRITICAL
  GROUP_BORDER_WIDTH: 2  // Used in all position calculations
}
```

### 6.2 Position Calculator (`src/utils/canvas/positionCalculator.ts`)

#### getInnerRect(rect: Rect): Rect
```typescript
// Shrinks rectangle by GROUP_BORDER_WIDTH on all sides
innerX = rect.x + GROUP_BORDER_WIDTH
innerY = rect.y + GROUP_BORDER_WIDTH
innerWidth = max(0, rect.width - (GROUP_BORDER_WIDTH * 2))
innerHeight = max(0, rect.height - (GROUP_BORDER_WIDTH * 2))
```

#### getTaskCenter(x, y, width=220, height=100): Position
```typescript
centerX = x + (width / 2)
centerY = y + (height / 2)
```

#### isPointInRect(x, y, rect, useInnerRect?): boolean
```typescript
// AABB test with optional inner rect
isInside = (x >= targetX && x <= targetX + targetWidth) &&
           (y >= targetY && y <= targetY + targetHeight)
```

#### isRectMoreThanHalfInside(inner, outer, useInnerRect=true): boolean
```typescript
// For group nesting detection
intersectionArea = overlap.width * overlap.height
innerArea = inner.width * inner.height
return intersectionArea > (innerArea * 0.5)
```

#### getGroupAbsolutePosition(groupId, groups): Position
```typescript
// Traverse parent chain with border accumulation
x = group.position.x
y = group.position.y

while (parentId && depth < 20) {
  parent = groups.find(g => g.id === parentId)
  x += parent.position.x + GROUP_BORDER_WIDTH  // CRITICAL
  y += parent.position.y + GROUP_BORDER_WIDTH
  parentId = parent.parentGroupId
}

return {x, y}
```

#### getAbsoluteNodePosition(nodeId, nodes): Position
```typescript
// Same logic but for Vue Flow nodes
// Adds GROUP_BORDER_WIDTH per parent level
```

### 6.3 Position Utilities (`src/utils/canvas/positionUtils.ts`)

```typescript
// Type validation
isValidPosition(value): value is Position
sanitizePosition(value, fallback = {x:0, y:0}): Position

// Comparison
positionsEqual(a, b, tolerance = 0.5): boolean

// Transformation
getAbsolutePosition(node, allNodes): Position
getRelativePosition(absolutePos, parentNode): Position
clampPosition(position, minX, maxX, minY, maxY): Position
roundPosition(position, decimals = 0): Position

// Hashing
positionHash(position): string  // "100:200"
```

### 6.4 Node Update Batcher (`src/utils/canvas/NodeUpdateBatcher.ts`)

```typescript
class NodeUpdateBatcher {
  BATCH_DELAY = 16ms  // ~60fps
  MAX_BATCH_SIZE = 50

  schedule(update: Function, priority: 'high'|'normal'|'low')
  flush()
  clear()
  getQueueSize(): number
}
```

---

## 7. Supabase Sync Integration

### 7.1 Database Schema

#### Groups Table
```sql
create table public.groups (
  id text primary key,
  user_id uuid,
  name text,
  type text,
  color text,
  position_json jsonb,      -- {x, y, width, height}
  layout text,
  is_visible boolean,
  is_collapsed boolean,
  parent_group_id text,     -- Self-referencing FK
  filters_json jsonb,
  assign_on_drop_json jsonb,
  is_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
);
```

#### Tasks Table (Position Field)
```sql
create table public.tasks (
  -- ... other fields ...
  position jsonb,           -- {x, y, parentId}
  -- CRITICAL: parentId is stored inside position JSON!
);
```

### 7.2 Type Mappers (`src/utils/supabaseMappers.ts`)

#### toSupabaseGroup (App → DB)
```typescript
position_json: group.position  // {x, y, width, height}
parent_group_id: group.parentGroupId
is_power_mode: group.isPowerMode
power_keyword_json: group.powerKeyword
assign_on_drop_json: group.assignOnDrop
```

#### fromSupabaseGroup (DB → App)
```typescript
position: record.position_json
parentGroupId: record.parent_group_id
isPowerMode: record.is_power_mode
powerKeyword: record.power_keyword_json
assignOnDrop: record.assign_on_drop_json
```

#### toSupabaseTask (App → DB)
```typescript
// CRITICAL: parentId is embedded in position JSON
position: task.canvasPosition ? {
  x: task.canvasPosition.x,
  y: task.canvasPosition.y,
  parentId: task.parentId  // Group membership!
} : null
```

#### fromSupabaseTask (DB → App)
```typescript
canvasPosition: record.position ? {
  x: record.position.x,
  y: record.position.y
} : undefined

parentId: record.position?.parentId  // Extract group membership
```

### 7.3 Sync Operations

| Operation | Direction | Method | Batching |
|-----------|-----------|--------|----------|
| Group Save | → DB | UPSERT | None |
| Group Load | ← DB | SELECT | None |
| Task Save | → DB | UPSERT | Yes (batch) |
| Task Load | ← DB | SELECT | None |
| Realtime Tasks | ← WS | postgres_changes | Batched sync |

### 7.4 Realtime Subscriptions

```typescript
// Channel per user
const channel = supabase.channel(`db-changes-${userId.substring(0,8)}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `user_id=eq.${userId}`
  }, onTaskChange)
  .subscribe()
```

### 7.5 Remote Change Processing

```typescript
const onTaskChange = (payload) => {
  // DRIFTING SHIELD: Ignore during drag
  if (canvas.isDragging || window.__PomoFlowIsDragging) {
    return
  }

  // Anti-race guard: First 5s of session
  if (Date.now() - window.PomoFlowSessionStart < 5000) {
    return
  }

  // Map and update
  const mappedTask = fromSupabaseTask(payload.new)
  tasks.updateTaskFromSync(taskId, mappedTask)
}
```

---

## 8. Group Counting System

### 8.1 Task Count Calculation

**Location:** `src/stores/canvas.ts` - `getTaskCountInGroupRecursive()`

```
Algorithm:
1. Find group by ID
2. Get all child groups (groups with parentGroupId === groupId)
3. Pre-calculate child group bounding rects
4. Count direct tasks:
   a. Explicit parentId check (database truth)
   b. Spatial fallback (for unpersisted tasks)
   c. Exclude tasks in child groups (prevents double-counting)
5. Recursively add child group counts
6. Return total
```

### 8.2 Count Update Triggers

| Trigger | Location | Priority |
|---------|----------|----------|
| Task create | useCanvasTaskActions | High |
| Task move to group | useCanvasTaskDrag | High |
| Task move out of group | useCanvasTaskDrag | High |
| Sync from store | useCanvasNodeSync | Normal |
| Remote update | useCanvasSync | Low |

### 8.3 Badge Display

**GroupNodeSimple.vue:**
```vue
<div class="section-count" v-if="taskCount > 0">
  {{ taskCount }}
</div>
```

### 8.4 useCanvasTaskCounts.ts

```typescript
const updateSectionTaskCounts = (oldSectionId, newSectionId) => {
  // Update old section
  if (oldSectionId) {
    updateSingleSectionCount(oldSectionId, tasks)
    // Update ancestors
    getAncestorGroupIds(oldSectionId).forEach(ancestorId => {
      updateSingleSectionCount(ancestorId, tasks)
    })
  }

  // Update new section
  if (newSectionId) {
    updateSingleSectionCount(newSectionId, tasks)
    // Update ancestors
    getAncestorGroupIds(newSectionId).forEach(ancestorId => {
      updateSingleSectionCount(ancestorId, tasks)
    })
  }
}

const updateSingleSectionCount = (sectionId, tasks) => {
  const node = nodes.find(n => n.id === `section-${sectionId}`)
  if (node) {
    // MUTATE directly to preserve Vue Flow reactivity
    node.data.taskCount = canvasStore.getTaskCountInGroupRecursive(sectionId, tasks)
  }
}
```

---

## 9. Position Persistence

### 9.1 Storage Architecture

| Data | App Field | DB Field | Format |
|------|-----------|----------|--------|
| Task Position | `canvasPosition` | `position` | `{x, y, parentId}` |
| Group Position | `position` | `position_json` | `{x, y, width, height}` |
| Group Parent | `parentGroupId` | `parent_group_id` | `string` |
| Viewport | `viewport` | `user_settings.canvas_viewport` | `{x, y, zoom}` |

### 9.2 Coordinate Systems

| Context | Type | Description |
|---------|------|-------------|
| Task in DB | Absolute | Stored as absolute canvas coordinates |
| Group in DB | Absolute | Stored as absolute canvas coordinates |
| Vue Flow Task | Relative | Relative to parent if has parentNode |
| Vue Flow Group | Absolute | Direct from group.position |

### 9.3 Conversion Formulas

**Absolute → Relative (for Vue Flow):**
```typescript
relativeX = absoluteX - parentAbsoluteX - GROUP_BORDER_WIDTH
relativeY = absoluteY - parentAbsoluteY - GROUP_BORDER_WIDTH
```

**Relative → Absolute (for DB):**
```typescript
absoluteX = parentAbsoluteX + relativeX + GROUP_BORDER_WIDTH
absoluteY = parentAbsoluteY + relativeY + GROUP_BORDER_WIDTH
```

### 9.4 Position Reset Prevention

**CRITICAL: These are the root cause fixes for position reset bugs:**

| Bug | Cause | Fix |
|-----|-------|-----|
| TASK-131 | Competing watcher in canvas.ts | REMOVED - useCanvasSync is single source |
| TASK-142 | Canvas loaded before auth ready | Auth watcher reloads from Supabase |
| BUG-169 | Empty array overwrites groups | 10s safety guard on group load |

**Architecture Rules:**
1. `useCanvasSync.ts` is the SINGLE source of sync
2. NEVER add watchers in `canvas.ts` that call `syncTasksToCanvas()`
3. Vue Flow positions are authoritative for existing nodes
4. Position locks (7s timeout) must be respected

---

## 10. Critical Formulas & Coordinate Systems

### 10.1 Nested Position Calculation

```
Absolute Position = Node Position + Sum(Parent Positions + GROUP_BORDER_WIDTH)

Example: 3-level nesting
- Task at {50, 50} relative
- Parent1 at {100, 100}
- Parent2 at {200, 200}

Absolute = {
  x: 50 + (100 + 2) + (200 + 2) = 354,
  y: 50 + (100 + 2) + (200 + 2) = 354
}
```

### 10.2 Inner Rect (Border Adjustment)

```
┌─────────────────────┐  ← Outer rect (group.position)
│ [2px border]        │
│ ┌─────────────────┐ │
│ │ Inner rect      │ │  ← For containment checks
│ │ (x+2, y+2, ...)│ │
│ └─────────────────┘ │
└─────────────────────┘

innerX = x + 2
innerY = y + 2
innerWidth = width - 4
innerHeight = height - 4
```

### 10.3 Z-Index Layering

```
Layer Order (bottom to top):
1. Groups (z: 10 + depth*50 + sizeBonus)
2. Tasks in groups (z: 500)
3. Selected items (z: +1000)
4. Dragging items (z: 3000)
```

---

## 11. Conflict Resolution

### 11.1 Drifting Shield

**Problem:** Server echo can reset user's drag position

**Solution:** Multiple lock flags prevent remote updates during local operations

```typescript
const isLocked = () => {
  return isNodeDragging.value ||
         isDragSettlingRef.value ||
         canvasStore.isDragging ||
         window.__PomoFlowIsDragging ||
         window.__PomoFlowIsResizing ||
         window.__PomoFlowIsSettling
}

// In applyRemoteChanges:
if (isLocked()) {
  console.log('[SHIELD] Ignoring remote update')
  return
}
```

### 11.2 Optimistic Sync

**Problem:** Local changes might be overwritten by slower server response

**Solution:** Timestamp-based conflict resolution

```typescript
trackLocalChange(id, position)  // On drag end
// ...server saves...
if (shouldAcceptRemoteChange(id, remoteTimestamp)) {
  // Remote is newer - accept
} else {
  // Local is newer - reject remote
}
markSynced(id)  // Cleanup after 1s
```

### 11.3 Auth Race Guard

**Problem:** Groups might be overwritten with empty array during auth initialization

**Solution:** 10s safety window

```typescript
if (loadedGroups.length === 0 && _rawGroups.value.length > 0) {
  if (Date.now() - sessionStart < 10000) {
    console.warn('BLOCKED empty overwrite during auth race')
    return
  }
}
```

---

## 12. Complete Data Flow Diagrams

### 12.1 User Drags Task Into Group

```
USER: Drag task into group
    ↓
[Vue Flow] @node-drag-stop
    ↓
useCanvasDragDrop.handleNodeDragStop()
    ├─ Get absolute position from Vue Flow
    ├─ Find containing group (useCanvasParentChild)
    ├─ Calculate relative position for storage
    ├─ Update task.parentId
    └─ Update task.canvasPosition (absolute)
    ↓
taskStore.updateTask()
    ├─ Update _rawTasks
    └─ Trigger reactivity
    ↓
useSupabaseDatabase.saveTasks()
    ├─ toSupabaseTask() - encode position.parentId
    └─ UPSERT to tasks table
    ↓
[Supabase] Realtime postgres_changes
    ↓
onTaskChange()
    ├─ Check locks (BLOCKED if dragging)
    └─ Skip update (user still owns position)
    ↓
useCanvasNodeSync.syncNodes()
    ├─ Convert absolute → relative for Vue Flow
    ├─ Update node.position
    └─ Update node.parentNode
```

### 12.2 Group Load from Supabase

```
App Start / Auth Change
    ↓
canvasStore.loadFromDatabase()
    ├─ fetchGroups() from Supabase
    ├─ fromSupabaseGroup() for each
    ├─ Validate positions (NaN check)
    ├─ BUG-169 guard (10s window)
    └─ Set _rawGroups.value
    ↓
Watcher: canvasStore.groups
    ↓
useCanvasSync.batchedSyncNodes('normal')
    ↓
useCanvasNodeSync.syncNodes()
    ├─ Create Vue Flow nodes for each group
    ├─ Set parentNode from parentGroupId
    └─ Calculate z-index from nesting depth
```

### 12.3 Task Count Update Flow

```
Task moves (drag, create, delete)
    ↓
useCanvasTaskCounts.updateSectionTaskCounts(old, new)
    ├─ Get all ancestor groups of old section
    ├─ Get all ancestor groups of new section
    └─ For each affected group:
        ↓
        canvasStore.getTaskCountInGroupRecursive()
            ├─ Count direct tasks (parentId check)
            ├─ Exclude tasks in child groups
            └─ Sum child group counts recursively
        ↓
        node.data.taskCount = count  // Mutate for reactivity
    ↓
GroupNodeSimple.vue re-renders
    └─ Shows updated badge count
```

---

## Summary

The PomoFlow canvas system is a sophisticated multi-layered architecture that handles:

1. **Position Sync**: Bidirectional sync with Supabase using absolute coordinates, with relative coordinate conversion for Vue Flow rendering
2. **Group Nesting**: Recursive parent-child relationships with proper z-index layering and containment detection
3. **Task Counting**: Recursive counting with child group exclusion, updated on every relevant operation
4. **Conflict Resolution**: Drifting Shield, optimistic sync, and auth race guards prevent position resets
5. **Performance**: Batched updates via NodeUpdateBatcher, LOD rendering, and lock-based update skipping

**Key Files to Understand:**
- `src/composables/canvas/useCanvasSync.ts` - Single source of truth
- `src/stores/canvas.ts` - Main canvas store with group persistence
- `src/utils/canvas/positionCalculator.ts` - All position math
- `src/utils/supabaseMappers.ts` - DB type conversion
