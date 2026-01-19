# Canvas Architecture Documentation

**Status**: Synchronized with codebase
**Last Updated**: 2026-01-12

---

## 1. Overview

The Canvas feature provides a free-form spatial view for tasks and groups using Vue Flow. It supports:
- Infinite pan/zoom canvas
- Drag-and-drop task nodes
- Resizable group containers
- Nested groups (parent-child hierarchy)
- Cross-tab sync via Supabase realtime

---

## 2. Fully Absolute Position Architecture

The canvas uses a **Fully Absolute** position system where all positions stored in the database are world coordinates.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FULLY ABSOLUTE ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DATABASE/STORE (Source of Truth):                               │
│    - Every node stores ABSOLUTE world coordinates                │
│    - No node ever stores relative coordinates                    │
│    - DB values = world positions (simple to reason about)        │
│                                                                  │
│  VUE FLOW (Display Layer):                                       │
│    - Root nodes: position = absolute (same as DB)                │
│    - Nested nodes: position = relative to parent                 │
│    - parentNode is set for nested items                          │
│                                                                  │
│  CONVERSION BOUNDARIES:                                          │
│    - READ PATH (DB → Vue Flow): toRelativePosition()             │
│    - WRITE PATH (Vue Flow → DB): toAbsolutePosition()            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Position Conversion Formulas

```typescript
// READ PATH: absolute (DB) → relative (Vue Flow)
relative = absolute - parentAbsolute

// WRITE PATH: relative (Vue Flow) → absolute (DB)
absolute = relative + parentAbsolute
```

---

## 3. Three Core Invariants

The Canvas system maintains three invariants that must hold for correct operation. Validation is in `src/utils/canvas/invariants.ts`.

### Invariant A: Hierarchy Consistency

```
If group.parentGroupId === null → node.parentNode: undefined
If group.parentGroupId !== null → node.parentNode: 'section-{parentGroupId}'
Parent group MUST exist in the store
```

**Key**: Groups do NOT have `extent: 'parent'` set, allowing them to be dragged outside their parent for child→root transitions.

### Invariant B: Position Architecture

```
Store/DB always holds ABSOLUTE world coordinates for ALL nodes
Vue Flow uses:
  - Root nodes: position = absolute (no conversion)
  - Nested nodes: position = absolute - parentAbsolute (relative)
```

Positions are compared with epsilon tolerance (0.5px) to account for floating-point drift.

### Invariant C: Recursion Safety

```
All recursive functions MUST use a visited set to prevent infinite loops
Functions: collectDescendantGroups, getTaskCountInGroupRecursive, getAllDescendantGroupIds
```

---

## 4. File Structure

### 4.1 Stores

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/stores/canvas.ts` | Main Pinia store for canvas state | `useCanvasStore()` |
| `src/stores/canvas/types.ts` | TypeScript interfaces | `CanvasGroup`, `CanvasSection`, `CanvasState`, `GroupFilter` |

#### CanvasGroup Interface

```typescript
// src/stores/canvas/types.ts:40-68
interface CanvasGroup {
    id: string
    name: string
    type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
    position: { x: number; y: number; width: number; height: number }
    color: string
    filters?: GroupFilter
    layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
    isVisible: boolean
    isCollapsed: boolean
    parentGroupId?: string | null     // Nested groups support
    positionVersion?: number          // Optimistic locking
    taskCount?: number                // Cached task count
    // ... additional fields
}
```

#### Canvas Store Key Methods

```typescript
// src/stores/canvas.ts
useCanvasStore() → {
    // State
    viewport: Ref<{x, y, zoom}>
    _rawGroups: Ref<CanvasGroup[]>     // Internal - use visibleGroups
    visibleGroups: ComputedRef<CanvasGroup[]>  // Exported as 'groups'
    nodeVersionMap: Ref<Map<string, number>>

    // Actions
    loadFromDatabase(): Promise<void>
    saveGroup(group: CanvasGroup): Promise<void>
    deleteGroup(groupId: string): Promise<void>
    recalculateAllTaskCounts(tasks: Task[]): void
    setViewport(x, y, zoom): void
    loadSavedViewport(): Promise<void>
}
```

### 4.2 Composables

| File | Path | Purpose |
|------|------|---------|
| **useCanvasOrchestrator** | `src/composables/canvas/useCanvasOrchestrator.ts` | Main orchestrator - coordinates all canvas composables |
| **useCanvasSync** | `src/composables/canvas/useCanvasSync.ts` | READ PATH: DB/Store → Vue Flow |
| **useNodeSync** | `src/composables/canvas/useNodeSync.ts` | WRITE PATH: Vue Flow → DB with optimistic locking |
| **useCanvasInteractions** | `src/composables/canvas/useCanvasInteractions.ts` | Drag, resize, selection handlers |
| **useCanvasCore** | `src/composables/canvas/useCanvasCore.ts` | Vue Flow instance wrapper |
| **useCanvasActions** | `src/composables/canvas/useCanvasActions.ts` | CRUD operations for tasks/groups |
| **useCanvasGroups** | `src/composables/canvas/useCanvasGroups.ts` | Group-specific operations |
| **useCanvasGroupActions** | `src/composables/canvas/useCanvasGroupActions.ts` | Group management actions |
| **useCanvasTaskActions** | `src/composables/canvas/useCanvasTaskActions.ts` | Task-specific canvas operations |
| **useCanvasEvents** | `src/composables/canvas/useCanvasEvents.ts` | Vue Flow event handlers |
| **useCanvasHotkeys** | `src/composables/canvas/useCanvasHotkeys.ts` | Keyboard shortcuts |
| **useCanvasModals** | `src/composables/canvas/useCanvasModals.ts` | Modal state management |
| **useCanvasNavigation** | `src/composables/canvas/useCanvasNavigation.ts` | Viewport navigation |
| **useCanvasZoom** | `src/composables/canvas/useCanvasZoom.ts` | Zoom controls |
| **useCanvasAlignment** | `src/composables/canvas/useCanvasAlignment.ts` | Node alignment tools |
| **useCanvasConnections** | `src/composables/canvas/useCanvasConnections.ts` | Edge/connection management |
| **useCanvasFilteredState** | `src/composables/canvas/useCanvasFilteredState.ts` | Filtered task computation |
| **useCanvasLifecycle** | `src/composables/canvas/useCanvasLifecycle.ts` | Lifecycle management |
| **useCanvasOverdueCollector** | `src/composables/canvas/useCanvasOverdueCollector.ts` | Smart group auto-collection |

### 4.3 Utility Modules

| File | Path | Key Exports |
|------|------|-------------|
| **coordinates** | `src/utils/canvas/coordinates.ts` | `toRelativePosition()`, `toAbsolutePosition()`, `groupPositionToVueFlow()`, `taskPositionToVueFlow()`, `vueFlowPositionToDb()`, `getGroupAbsolutePosition()`, `sanitizePosition()` |
| **spatialContainment** | `src/utils/canvas/spatialContainment.ts` | `isNodeCompletelyInside()`, `getDeepestContainingGroup()`, `findContainingGroups()`, `reconcileTaskParentsByContainment()` |
| **canvasIds** | `src/utils/canvas/canvasIds.ts` | `CanvasIds.groupNodeId()`, `CanvasIds.taskNodeId()`, `CanvasIds.parseNodeId()`, `CanvasIds.isGroupNode()` |
| **invariants** | `src/utils/canvas/invariants.ts` | `validateInvariantA()`, `validateInvariantB()`, `validateInvariantC()`, `validateAllInvariants()`, `logHierarchySummary()` |
| **resourceManager** | `src/utils/canvas/resourceManager.ts` | Cleanup/disposal management |
| **positionCalculator** | `src/utils/canvas/positionCalculator.ts` | Position calculation helpers |

### 4.4 Vue Components

| File | Path | Purpose |
|------|------|---------|
| **CanvasView** | `src/views/CanvasView.vue` | Main canvas view container |
| **TaskNode** | `src/components/canvas/TaskNode.vue` | Task node component |
| **CanvasGroup** | `src/components/canvas/CanvasGroup.vue` | Group/section node component |
| **GroupNodeSimple** | `src/components/canvas/GroupNodeSimple.vue` | Simplified group node |
| **InboxPanel** | `src/components/canvas/InboxPanel.vue` | Left sidebar inbox |
| **CanvasControls** | `src/components/canvas/CanvasControls.vue` | Zoom/fit controls |
| **CanvasToolbar** | `src/components/canvas/CanvasToolbar.vue` | Top toolbar |
| **CanvasContextMenu** | `src/components/canvas/CanvasContextMenu.vue` | Right-click menu |
| **EdgeContextMenu** | `src/components/canvas/EdgeContextMenu.vue` | Edge right-click menu |
| **GroupEditModal** | `src/components/canvas/GroupEditModal.vue` | Group settings modal |
| **GroupSettingsMenu** | `src/components/canvas/GroupSettingsMenu.vue` | Group dropdown menu |
| **ResizeHandle** | `src/components/canvas/ResizeHandle.vue` | Group resize handles |
| **MultiSelectionOverlay** | `src/components/canvas/MultiSelectionOverlay.vue` | Selection box overlay |
| **CanvasLoadingOverlay** | `src/components/canvas/CanvasLoadingOverlay.vue` | Loading state |
| **CanvasEmptyState** | `src/components/canvas/CanvasEmptyState.vue` | Empty state display |

---

## 5. Data Flows

### 5.1 READ PATH: Database → Vue Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                      READ PATH FLOW                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. useCanvasOrchestrator.onMounted()                               │
│     ↓                                                               │
│  2. canvasStore.loadFromDatabase()                                  │
│     - Fetches groups from Supabase                                  │
│     - Breaks any parent cycles via breakGroupCycles()               │
│     ↓                                                               │
│  3. reconcileTaskParentsByContainment()                             │
│     - Fixes legacy tasks with incorrect parentId                    │
│     - Uses center-based spatial containment                         │
│     ↓                                                               │
│  4. canvasStore.recalculateAllTaskCounts()                          │
│     ↓                                                               │
│  5. useCanvasSync.syncStoreToCanvas()                               │
│     ↓                                                               │
│  6. For each group:                                                 │
│     - groupPositionToVueFlow(group, allGroups)                      │
│     - If nested: absolute - parentAbsolute = relative               │
│     - If root: use absolute directly                                │
│     ↓                                                               │
│  7. setNodes(newNodes) → Vue Flow renders                           │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Entry Point**: `useCanvasOrchestrator.ts:246` (onMounted)

```typescript
// src/composables/canvas/useCanvasOrchestrator.ts:246-284
onMounted(async () => {
    await canvasStore.loadSavedViewport()
    await nextTick()
    persistence.initRealtimeSubscription()

    // Reconcile parentIds based on spatial containment
    await reconcileTaskParentsByContainment(
        taskStore.tasks,
        canvasStore.groups,
        async (taskId, updates) => taskStore.updateTask(taskId, updates),
        { writeToDb: true, silent: false }
    )

    canvasStore.recalculateAllTaskCounts(taskStore.tasks)
    syncNodes()
    isInitialized.value = true
})
```

### 5.2 WRITE PATH: Vue Flow → Database

```
┌────────────────────────────────────────────────────────────────────┐
│                      WRITE PATH FLOW                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User drags node → onNodeDragStop fires                          │
│     ↓                                                               │
│  2. useCanvasInteractions.onNodeDragStop()                          │
│     - Gets node.computedPosition (absolute world coords)            │
│     ↓                                                               │
│  3. getDeepestContainingGroup(spatialNode, groups)                  │
│     - Finds smallest group containing node's CENTER                 │
│     - Returns targetParentId or null                                │
│     ↓                                                               │
│  4. If parent changed:                                              │
│     - Update store parentId                                         │
│     - Update Vue Flow node.parentNode                               │
│     ↓                                                               │
│  5. useNodeSync.syncNodePosition()                                  │
│     - Extract currentParentId from node.parentNode                  │
│     - Use computedPosition (already absolute)                       │
│     - Build payload: { position_json, parent_group_id }             │
│     ↓                                                               │
│  6. Supabase UPDATE with optimistic lock                            │
│     .update(payload)                                                │
│     .eq('id', nodeId)                                               │
│     .eq('position_version', currentVersion)                         │
│     ↓                                                               │
│  7. If conflict (0 rows updated):                                   │
│     - Fetch latest version                                          │
│     - Retry ONCE with new version                                   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Entry Point**: `useCanvasInteractions.ts` (onNodeDragStop handler)

```typescript
// src/composables/canvas/useNodeSync.ts:50-246
async function syncNodePosition(
    nodeId: string,
    vueFlowNode: Node,
    allGroups: CanvasGroup[],
    tableName: 'tasks' | 'groups'
): Promise<boolean> {
    // 1. Extract parent ID from Vue Flow node
    const rawParentId = vueFlowNode.parentNode
    const currentParentId = rawParentId?.replace('section-', '') || null

    // 2. Get absolute position (prefer computedPosition)
    const absolutePosition = vfNode.computedPosition ??
        toAbsolutePosition(vueFlowNode.position, parentAbsolute)

    // 3. Build payload
    const updatePayload = tableName === 'tasks'
        ? { position: { x, y, parentId, format: 'absolute' } }
        : { position_json: { x, y, width, height }, parent_group_id }

    // 4. Optimistic lock update
    const { data } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', nodeId)
        .eq('position_version', currentVersion)

    // 5. Handle conflict with single retry
    if (!data?.length) {
        // Fetch latest, retry once
    }
}
```

---

## 6. Spatial Containment

Containment detection determines which group a node belongs to based on its CENTER point.

### Center-Based Rule

```typescript
// src/utils/canvas/spatialContainment.ts:47-63
function isNodeCompletelyInside(
    node: SpatialNode,
    container: ContainerBounds,
    padding: number = 10
): boolean {
    // Get node CENTER point
    const nodeCenterX = node.position.x + (node.width || 220) / 2
    const nodeCenterY = node.position.y + (node.height || 100) / 2

    // Check if center is inside container (with padding)
    return (
        nodeCenterX >= container.position.x + padding &&
        nodeCenterX <= container.position.x + container.width - padding &&
        nodeCenterY >= container.position.y + padding &&
        nodeCenterY <= container.position.y + container.height - padding
    )
}
```

### Deepest Group Selection

When a node is inside multiple nested groups, the **smallest** (by area) is selected as the parent.

```typescript
// src/utils/canvas/spatialContainment.ts:122-138
function getDeepestContainingGroup(
    node: SpatialNode,
    allGroups: CanvasSection[],
    excludeId?: string
): CanvasSection | null {
    const containingGroups = findContainingGroups(node, allGroups, excludeId)
    if (containingGroups.length === 0) return null

    // Return smallest by area (deepest in hierarchy)
    return containingGroups.reduce((smallest, current) => {
        const currentArea = current.position.width * current.position.height
        const smallestArea = smallest.position.width * smallest.position.height
        return currentArea < smallestArea ? current : smallest
    })
}
```

---

## 7. Database Schema

### Groups Table

```sql
-- supabase/migrations/20260105000000_initial_schema.sql:143-175
create table public.groups (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text check (type in ('status', 'priority', 'project', 'timeline', 'custom')) default 'custom',
  color text,

  -- Layout & Position (ABSOLUTE coordinates)
  position_json jsonb,  -- {x, y, width, height}
  layout text check (layout in ('vertical', 'horizontal', 'grid', 'freeform')) default 'vertical',

  -- State
  is_visible boolean default true,
  is_collapsed boolean default false,
  collapsed_height integer,

  -- Hierarchy (for nested groups)
  parent_group_id text references public.groups(id) on delete set null,

  -- Filters & Logic
  filters_json jsonb,
  is_power_mode boolean default false,
  power_keyword_json jsonb,
  assign_on_drop_json jsonb,
  collect_filter_json jsonb,
  auto_collect boolean default false,
  is_pinned boolean default false,
  property_value text,

  -- Optimistic locking
  position_version integer default 0,

  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS enabled with user isolation
alter table public.groups enable row level security;
```

### Tasks Table (Canvas-Relevant Fields)

```sql
-- supabase/migrations/20260105000000_initial_schema.sql:47-96
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- ... other fields ...

  -- Canvas position (ABSOLUTE coordinates)
  position jsonb,  -- { "x": 100, "y": 200, "parentId": "group-id", "format": "absolute" }

  -- Optimistic locking
  position_version integer default 0,

  is_in_inbox boolean default false,

  -- ... other fields ...
);
```

---

## 8. ID Conventions

The Canvas system uses different ID formats for store vs Vue Flow:

```typescript
// src/utils/canvas/canvasIds.ts
const CanvasIds = {
    // Store ID → Vue Flow node ID
    groupNodeId: (groupId: string) => `section-${groupId}`,
    taskNodeId: (taskId: string) => taskId,  // Tasks use raw ID

    // Vue Flow node ID → Store ID
    parseNodeId: (nodeId: string) => {
        if (nodeId.startsWith('section-')) {
            return { type: 'group', id: nodeId.replace('section-', '') }
        }
        return { type: 'task', id: nodeId }
    },

    // Type guards
    isGroupNode: (nodeId: string) => nodeId.startsWith('section-'),
    isTaskNode: (nodeId: string) => !nodeId.startsWith('section-'),

    // Edge IDs
    edgeId: (sourceId: string, targetId: string) => `e-${sourceId}-${targetId}`
}
```

---

## 9. Vue Flow Integration

### Node Types

```typescript
// Registered in CanvasView.vue
nodeTypes: {
    taskNode: TaskNode,       // src/components/canvas/TaskNode.vue
    sectionNode: CanvasGroup  // src/components/canvas/CanvasGroup.vue
}
```

### Node Structure

```typescript
// Group node example
{
    id: 'section-{groupId}',
    type: 'sectionNode',
    position: { x: 100, y: 200 },  // Relative if nested, absolute if root
    parentNode: 'section-{parentGroupId}' | undefined,
    // NOTE: extent NOT set for groups - allows drag-out for child→root
    expandParent: false,
    data: {
        id: groupId,
        label: group.name,
        name: group.name,
        color: group.color,
        width: 300,
        height: 200,
        collapsed: false,
        directTaskCount: number,
        aggregatedTaskCount: number,
        parentGroupId: string | null
    },
    style: { width: '300px', height: '200px' }
}

// Task node example
{
    id: taskId,  // Raw UUID
    type: 'taskNode',
    position: { x: 150, y: 250 },
    parentNode: 'section-{parentId}' | undefined,
    // NOTE: extent NOT set for tasks - allows drag-out of groups
    expandParent: false,
    data: {
        task: Task,
        label: task.title
    }
}
```

---

## 10. Optimistic Locking

Position updates use optimistic locking to handle concurrent edits (e.g., cross-tab sync).

```typescript
// src/composables/canvas/useNodeSync.ts:170-232
const { data, error } = await supabase
    .from(tableName)
    .update(updatePayload)
    .eq('id', nodeId)
    .eq('position_version', currentVersion)  // ← Optimistic lock
    .select('position_version')

if (!data || data.length === 0) {
    // Conflict detected - version mismatch
    // Fetch latest version and retry ONCE
    const { data: latest } = await supabase
        .from(tableName)
        .select('position_version')
        .eq('id', nodeId)
        .single()

    versionMap.set(nodeId, latest.position_version)

    // Retry with new version
    updatePayload.position_version = latest.position_version + 1
    await supabase.from(tableName).update(updatePayload)...
}
```

---

## 11. Key Behaviors

### Child→Root Drag Transition

Groups and tasks can be dragged outside their parent container to become root-level items:

1. `extent: 'parent'` is NOT set on nodes (allows free drag)
2. On drag stop, `getDeepestContainingGroup()` checks if center is inside any group
3. If center is outside all groups, `targetParentId = null`
4. Store updates `parentGroupId = null`, Vue Flow updates `parentNode = undefined`

### Task Count Updates

Groups display task counts that update when:
- Tasks are created/deleted
- Tasks are moved between groups
- Group hierarchy changes

```typescript
// src/stores/canvas.ts (recalculateAllTaskCounts method)
// Calculates both direct and aggregated counts
// Direct: tasks where task.parentId === group.id
// Aggregated: direct + all tasks in descendant groups
```

### Cycle Prevention

Parent cycles (A→B→A) are prevented at multiple levels:
1. **Load time**: `breakGroupCycles()` in canvas.ts
2. **Sync time**: `hasParentCycle()` check in useCanvasSync.ts
3. **Validation**: `validateInvariantC()` in invariants.ts

---

## 12. Debugging

### Invariant Validation (Dev Only)

```typescript
// Enable in dev mode - runs after each sync
import { validateAllInvariants, logHierarchySummary } from '@/utils/canvas/invariants'

// Check all invariants
const violations = validateAllInvariants(vueFlowNodes, storeGroups, storeTasks, 'context')

// Log group hierarchy tree
logHierarchySummary(storeGroups)
```

### Console Output

```
[INVARIANT] 2 violation(s) detected in syncStoreToCanvas
  1 ERROR(s):
    [A] group abc123: Store has parentGroupId but Vue Flow node has no parentNode
  1 WARNING(s):
    [B] group def456: Vue Flow position doesn't match expected (relative)
```

### Key Log Prefixes

| Prefix | Source |
|--------|--------|
| `[INVARIANT]` | invariants.ts validation |
| `[NODE-SYNC]` | useNodeSync.ts write operations |
| `[GROUPS]` | canvas.ts group operations |
| `[RECONCILE]` | spatialContainment.ts parent fixes |
| `[ORCHESTRATOR]` | useCanvasOrchestrator.ts coordination |
| `[SYNC]` | useCanvasSync.ts read operations |

---

## 13. Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Position resets on refresh | Stale positions winning over DB | Fixed: useCanvasSync always uses fresh store positions |
| Child can't detach from parent | `extent: 'parent'` constrains drag | Fixed: extent removed for groups and tasks |
| Task counts show 0 | Counts calculated before reconciliation | Fixed: recalculateAllTaskCounts after reconciliation |
| Infinite recursion in counts | Missing visited set in recursive functions | Fixed: all recursive functions use visited Set |
| Cross-tab position conflicts | Concurrent edits without locking | Fixed: optimistic locking with single retry |

---

## 14. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CANVAS SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐     ┌─────────────────────┐     ┌────────────────┐  │
│  │   CanvasView.vue   │────→│ useCanvasOrchestrator│────→│  Vue Flow API  │  │
│  │   (Entry Point)    │     │   (Coordinator)      │     │  (Rendering)   │  │
│  └────────────────────┘     └──────────┬──────────┘     └────────────────┘  │
│                                        │                                     │
│            ┌───────────────────────────┼───────────────────────────┐         │
│            │                           │                           │         │
│            ▼                           ▼                           ▼         │
│  ┌─────────────────┐       ┌─────────────────┐        ┌─────────────────┐   │
│  │ useCanvasSync   │       │useCanvasInteract│        │  useNodeSync    │   │
│  │ (READ PATH)     │       │   (Handlers)    │        │  (WRITE PATH)   │   │
│  │ DB → Vue Flow   │       │ Drag/Resize/Sel │        │  Vue Flow → DB  │   │
│  └────────┬────────┘       └────────┬────────┘        └────────┬────────┘   │
│           │                         │                          │            │
│           └─────────────────────────┼──────────────────────────┘            │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────────┐                            │
│                          │    canvasStore      │                            │
│                          │  (Pinia - State)    │                            │
│                          │  groups, viewport   │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────────┐                            │
│                          │     Supabase        │                            │
│                          │  (PostgreSQL + RLS) │                            │
│                          │  groups, tasks      │                            │
│                          └─────────────────────┘                            │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           UTILITY MODULES                                    │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │coordinates │  │spatialContainment│  │ canvasIds  │  │   invariants    │  │
│  │ (convert)  │  │ (center-based)   │  │(ID format) │  │  (validation)   │  │
│  └────────────┘  └──────────────────┘  └────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Related Documentation

- `CLAUDE.md` - Development rules and canvas safety guidelines
- `docs/MASTER_PLAN.md` - Task tracking (TASK-131, TASK-142, TASK-155, etc.)
- `docs/claude-md-extension/architecture.md` - Overall project architecture
