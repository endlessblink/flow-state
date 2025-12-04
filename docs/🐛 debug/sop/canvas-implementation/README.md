# SOP: Canvas View Implementation

**Date**: 2025-12-04
**Status**: Current Working Implementation
**Last Updated**: December 2025

## Overview

The Canvas View is a free-form visual task organization interface built on **Vue Flow** (@vue-flow/core). It provides drag-and-drop task management, sections/groups for organizing tasks, connection/dependency mapping between tasks, and an inbox sidebar for task staging.

## Architecture

### Core Files

| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| `CanvasView.vue` | `src/views/` | ~2500+ | Main canvas component with Vue Flow integration |
| `canvas.ts` | `src/stores/` | ~1180 | Pinia store for canvas state management |
| `TaskNode.vue` | `src/components/canvas/` | ~830 | Custom task node component |
| `SectionNodeSimple.vue` | `src/components/canvas/` | ~375 | Section/group container component |
| `InboxPanel.vue` | `src/components/canvas/` | ~790 | Sidebar inbox for staging tasks |
| `InboxTimeFilters.vue` | `src/components/canvas/` | - | Time-based filtering for inbox |

### Supporting Files

| File | Purpose |
|------|---------|
| `CanvasContextMenu.vue` | Right-click menu for canvas operations |
| `EdgeContextMenu.vue` | Context menu for edge/connection operations |
| `GroupModal.vue` | Create/edit group dialog |
| `GroupEditModal.vue` | Edit section properties |
| `SectionWizard.vue` | Guided section creation |
| `SectionManager.vue` | Section management panel |
| `MultiSelectionOverlay.vue` | Rectangle selection visualization |

---

## Vue Flow Integration

### CRITICAL: Do NOT Extract These Elements

```
WARNING: During refactoring, the following Vue Flow elements MUST NEVER be extracted
from CanvasView.vue into separate components:

DO NOT EXTRACT:
- v-model:nodes and v-model:edges bindings
- @node-drag-stop, @connect, @edge-created event handlers
- VueFlow component itself and its direct children
- Node/edge calculation and synchronization logic
- useVueFlow() composable usage and its return values
- syncNodes() function calls that refresh VueFlow state

SAFE TO EXTRACT:
- Canvas controls (zoom, pan, toolbar buttons)
- Modals and overlays
- Context menus (if they don't depend on VueFlow state)
- Sidebar panels
```

### Vue Flow Configuration

```typescript
<VueFlow
  v-model:nodes="safeNodes"
  v-model:edges="safeEdges"
  :node-types="nodeTypes"
  :zoom-on-scroll="true"
  :pan-on-drag="true"
  :snap-to-grid="true"
  :snap-grid="[16, 16]"
  :min-zoom="0.05"
  :max-zoom="4.0"
  :fit-view-on-init="false"
  :default-viewport="{ zoom: 1, x: 0, y: 0 }"
  @node-drag-start="handleNodeDragStart"
  @node-drag-stop="handleNodeDragStop"
  @node-drag="handleNodeDrag"
  @nodes-change="handleNodesChange"
  @selection-change="handleSelectionChange"
  @pane-click="handlePaneClick"
  @connect="handleConnect"
/>
```

### Custom Node Types

```typescript
const nodeTypes = markRaw({
  taskNode: TaskNode,          // Task cards
  sectionNode: SectionNodeSimple  // Section containers
})
```

---

## State Management

### Canvas Store (`src/stores/canvas.ts`)

#### Core State

```typescript
interface CanvasState {
  viewport: { x: number; y: number; zoom: number }
  selectedNodeIds: string[]
  connectMode: boolean
  connectingFrom: string | null
  sections: CanvasSection[]
  activeSectionId: string | null
  showSectionGuides: boolean
  snapToSections: boolean
  multiSelectMode: boolean
  selectionRect: { x: number; y: number; width: number; height: number } | null
  selectionMode: 'rectangle' | 'lasso' | 'click'
  isSelecting: boolean
  nodes: any[]  // Vue Flow nodes
  edges: any[]  // Vue Flow edges
}
```

#### Section Types

```typescript
interface CanvasSection {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
  position: { x: number; y: number; width: number; height: number }
  color: string
  filters?: SectionFilter
  layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean
  isCollapsed: boolean
  propertyValue?: string  // For smart sections
  autoCollect?: boolean   // Auto-collect matching tasks
  collapsedHeight?: number
}
```

#### Section Terminology

- **Groups** (`type: 'custom'`): Visual organization only, no property updates
- **Sections** (`type: 'priority'|'status'|'timeline'|'project'`): Smart automation, auto-updates task properties

When a task is dragged into a Section, its properties are automatically updated based on the section's type.

---

## Task Flow: Inbox to Canvas

### 1. Task Creation

Tasks are created with `isInInbox: true` by default:

```typescript
// In InboxPanel.vue
createTaskWithUndo({
  title: newTaskTitle.value.trim(),
  status: 'planned',
  isInInbox: true  // Task starts in inbox
})
```

### 2. Task Display Rules

Tasks appear on canvas ONLY when:
1. `isInInbox === false` (explicitly moved to canvas)
2. `canvasPosition` exists (has a position)

```typescript
// In syncNodes()
safeFilteredTasks
  .filter(task => task && task.id && task.isInInbox === false && task.canvasPosition)
  .forEach((task) => {
    // Create Vue Flow node
  })
```

### 3. Drag from Inbox to Canvas

When a task is dragged from the inbox:

```typescript
// InboxPanel.vue - handleDragStart
event.dataTransfer.setData('application/json', JSON.stringify({
  type: 'task',
  taskId: task.id,
  taskIds: [task.id],
  title: task.title,
  fromInbox: true,
  source: 'inbox'
}))

// CanvasView.vue - handleDrop
const handleDrop = (event: DragEvent) => {
  const data = JSON.parse(event.dataTransfer.getData('application/json'))

  if (data.fromInbox) {
    // Calculate canvas position from drop coordinates
    const canvasPosition = screenToCanvas(event.clientX, event.clientY)

    // Update task to move from inbox to canvas
    taskStore.updateTaskWithUndo(data.taskId, {
      isInInbox: false,
      canvasPosition: canvasPosition
    })
  }
}
```

---

## Node Synchronization

### syncNodes() Function

Critical function that converts store data to Vue Flow nodes:

```typescript
const syncNodes = () => {
  const allNodes: Node[] = []

  // 1. Add section nodes FIRST (render in background)
  sections.forEach(section => {
    allNodes.push({
      id: `section-${section.id}`,
      type: 'sectionNode',
      position: { x: section.position.x, y: section.position.y },
      width: section.position.width,
      height: section.isCollapsed ? 80 : section.position.height,
      data: { /* section data */ }
    })
  })

  // 2. Add task nodes (only tasks with isInInbox === false)
  safeFilteredTasks
    .filter(task => task.isInInbox === false && task.canvasPosition)
    .forEach((task) => {
      // Calculate parent-child relationship for sections
      const section = findContainingSection(task.canvasPosition)

      allNodes.push({
        id: task.id,
        type: 'taskNode',
        position: section ? relativePosition : task.canvasPosition,
        parentNode: section ? `section-${section.id}` : undefined,
        data: { task }
      })
    })

  nodes.value = allNodes
}
```

### syncEdges() Function

Creates dependency edges between tasks:

```typescript
const syncEdges = () => {
  const allEdges: Edge[] = []

  tasks.forEach(task => {
    if (task.dependsOn?.length > 0) {
      task.dependsOn.forEach(depId => {
        // Skip recently removed edges
        if (recentlyRemovedEdges.value.has(`${depId}-${task.id}`)) return

        allEdges.push({
          id: `${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'smoothstep',
          markerEnd: 'url(#arrowhead)'
        })
      })
    }
  })

  edges.value = allEdges
}
```

---

## Event Handlers

### Node Drag Events

```typescript
// Start of drag - set flag to prevent sync
const handleNodeDragStart = () => {
  isNodeDragging.value = true
}

// During drag - update visual position
const handleNodeDrag = (event) => {
  // Optional: Show drag preview
}

// End of drag - persist position
const handleNodeDragStop = (event) => {
  isNodeDragging.value = false

  const { node, event: dragEvent } = event

  // Update task position in store
  if (node.type === 'taskNode') {
    const newPosition = calculateAbsolutePosition(node)
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: newPosition
    })
  }

  // Handle section drop (property auto-update)
  const targetSection = findSectionAtPosition(newPosition)
  if (targetSection && targetSection.type !== 'custom') {
    updateTaskPropertyForSection(node.id, targetSection)
  }
}
```

### Connection Events

```typescript
// Create dependency when connecting nodes
const handleConnect = ({ source, target }) => {
  const targetTask = taskStore.tasks.find(t => t.id === target)
  if (targetTask) {
    const updatedDependsOn = [...(targetTask.dependsOn || []), source]
    taskStore.updateTaskWithUndo(target, { dependsOn: updatedDependsOn })
  }
}
```

---

## Performance Optimizations

### Node Update Batching

```typescript
class NodeUpdateBatcher {
  private batchQueue: Array<() => void> = []
  private isProcessing = false
  private readonly BATCH_DELAY = 16  // ~60fps

  schedule(update: () => void, priority: 'high' | 'normal' | 'low') {
    if (priority === 'high') {
      update()  // Immediate
      return
    }
    this.batchQueue.push(update)
    this.startBatchProcessing()
  }

  private processBatch() {
    const chunk = this.batchQueue.splice(0, MAX_BATCH_SIZE)
    chunk.forEach(update => update())

    nextTick(() => {
      vueFlowRef.value?.updateNodeInternals()
    })
  }
}
```

### Memoized Computed Properties

```typescript
// Cache filtered tasks to avoid recalculation
let lastFilteredTasksHash = ''
let lastFilteredTasks: any[] = []

const filteredTasksWithCanvasPosition = computed(() => {
  const currentHash = tasks.map(t => `${t.id}:${t.canvasPosition?.x}`).join('|')

  if (currentHash === lastFilteredTasksHash) {
    return lastFilteredTasks
  }

  // Recalculate only when data changes
  lastFilteredTasksHash = currentHash
  lastFilteredTasks = tasks.filter(t => t.canvasPosition)
  return lastFilteredTasks
})
```

### Resource Manager

```typescript
const resourceManager = {
  watchers: [],
  eventListeners: [],
  timers: [],
  intervals: [],

  cleanup() {
    this.watchers.forEach(unwatch => unwatch())
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler)
    })
    this.timers.forEach(clearTimeout)
    this.intervals.forEach(clearInterval)
  }
}

onBeforeUnmount(() => {
  resourceManager.cleanup()
})
```

---

## TaskNode Component

### Props

```typescript
interface Props {
  task: Task
  isSelected?: boolean
  multiSelectMode?: boolean
  showPriority?: boolean
  showStatus?: boolean
  showDuration?: boolean
  showSchedule?: boolean
  isConnecting?: boolean  // During connection creation
}
```

### Visual States

| Class | Condition | Visual Effect |
|-------|-----------|---------------|
| `priority-high` | `task.priority === 'high'` | Red accent |
| `priority-medium` | `task.priority === 'medium'` | Orange accent |
| `priority-low` | `task.priority === 'low'` | Blue accent |
| `status-done` | `task.status === 'done'` | Muted/strikethrough |
| `status-in-progress` | `task.status === 'in_progress'` | Highlight glow |
| `timer-active` | Timer running for task | Pulsing indicator |
| `selected` | Node is selected | Corner handles |
| `is-dragging` | During drag operation | Reduced opacity |
| `is-connecting` | During connection | Crosshair cursor |

### Connection Handles

```vue
<Handle
  v-if="isInVueFlowContext"
  type="target"
  :position="Position.Top"
/>
<Handle
  v-if="isInVueFlowContext"
  type="source"
  :position="Position.Bottom"
/>
```

---

## Section System

### Creating Sections

```typescript
// Priority Section
const createPrioritySection = (priority, position) => {
  return createSection({
    name: `${priority} Priority`,
    type: 'priority',
    propertyValue: priority,
    position: { ...position, width: 300, height: 250 },
    color: priorityColors[priority],
    layout: 'grid',
    isVisible: true,
    isCollapsed: false
  })
}

// Custom Group (no auto-property update)
const createCustomGroup = (name, color, position) => {
  return createSection({
    name,
    type: 'custom',
    position: { ...position, width: 300, height: 200 },
    color,
    layout: 'grid'
  })
}
```

### Section Collapse/Expand

```typescript
const toggleSectionCollapse = (sectionId, allTasks) => {
  const section = sections.find(s => s.id === sectionId)

  if (section.isCollapsed) {
    // EXPAND: Restore stored positions
    const savedPositions = collapsedTaskPositions.get(sectionId)
    savedPositions.forEach(({ id, position }) => {
      const task = allTasks.find(t => t.id === id)
      if (task) task.canvasPosition = position
    })
    section.position.height = section.collapsedHeight
    section.collapsedHeight = undefined
    section.isCollapsed = false
  } else {
    // COLLAPSE: Store current positions
    const tasksInSection = getTasksInSectionBounds(section, allTasks)
    collapsedTaskPositions.set(sectionId, tasksInSection.map(t => ({
      id: t.id,
      position: t.canvasPosition
    })))
    section.collapsedHeight = section.position.height
    section.isCollapsed = true
  }
}
```

### Auto-Collect Feature

When enabled, sections automatically pull matching tasks:

```typescript
const taskMatchesSection = (task, section) => {
  if (section.type === 'priority') {
    return task.priority === section.propertyValue
  }
  if (section.type === 'status') {
    return task.status === section.propertyValue
  }
  if (section.type === 'project') {
    return task.projectId === section.propertyValue
  }
  return false
}
```

---

## InboxPanel Component

### Task Filtering

```typescript
// Base inbox tasks: no canvas position, not done
const baseInboxTasks = computed(() =>
  taskStore.filteredTasks.filter(task =>
    !task.canvasPosition &&
    task.isInInbox !== false &&
    task.status !== 'done'
  )
)

// Time-filtered inbox tasks
const inboxTasks = computed(() => {
  switch (activeTimeFilter.value) {
    case 'now':    return filterByToday(baseInboxTasks.value)
    case 'tomorrow': return filterByTomorrow(baseInboxTasks.value)
    case 'thisWeek': return filterByWeek(baseInboxTasks.value)
    case 'noDate':  return filterByNoDate(baseInboxTasks.value)
    default:       return baseInboxTasks.value
  }
})
```

### Brain Dump Mode

Quick task creation from multi-line text:

```typescript
const processBrainDump = () => {
  const lines = brainDumpText.value.split('\n').filter(l => l.trim())

  lines.forEach(line => {
    let title = line.trim()
    let priority = null
    let estimatedDuration = undefined

    // Parse priority (!!!)
    const priorityMatch = title.match(/(!+)$/)
    if (priorityMatch) {
      priority = priorityMatch[1].length >= 3 ? 'high' :
                 priorityMatch[1].length === 2 ? 'medium' : 'low'
      title = title.replace(/\s*!+$/, '')
    }

    // Parse duration (2h, 30m)
    const durationMatch = title.match(/(\d+)([hm])$/i)
    if (durationMatch) {
      estimatedDuration = durationMatch[2] === 'h'
        ? parseInt(durationMatch[1]) * 60
        : parseInt(durationMatch[1])
      title = title.replace(/\s*\d+[hm]$/i, '')
    }

    createTaskWithUndo({ title, priority, estimatedDuration, isInInbox: true })
  })
}
```

---

## Error Handling & Recovery

### System Health Check

```typescript
const systemHealthy = computed(() => {
  return storeHealth.taskStore && storeHealth.canvasStore && storeHealth.uiStore
})

// Graceful degradation wrapper
const safeStoreOperation = <T>(
  operation: () => T,
  fallback: T,
  operationName: string,
  storeName: string
): T => {
  try {
    if (!storeHealth[storeName]) {
      console.warn(`${storeName} unavailable, using fallback`)
      return fallback
    }
    return operation()
  } catch (error) {
    console.error(`${operationName} failed:`, error)
    return fallback
  }
}
```

### System Restart

```typescript
const performSystemRestart = async () => {
  // Clear reactive state
  nodes.value = []
  edges.value = []

  // Reset store states
  canvasStore.setSelectedNodes([])

  // Reinitialize
  await nextTick()
  syncNodes()
  syncEdges()
}
```

---

## Debugging

### Development Tools

```typescript
// Expose stores in dev mode
if (import.meta.env.DEV) {
  window.__canvasStore = canvasStore
  window.__lastDeletedSection = { /* deletion tracking */ }
}
```

### Console Log Patterns

| Pattern | Meaning |
|---------|---------|
| `[SYNC] Updated nodes: X` | Node synchronization completed |
| `[BATCH] Cleared node update batcher` | Memory cleanup |
| `Skipping edge recreation` | Recently removed edge protection |
| `Task filtering:` | syncNodes decision log |
| `Critical error in syncNodes()` | Sync failure |

### Vue Flow Stability Monitor

Shows performance metrics when issues detected:
- Node count
- Edge count
- Render time
- Memory usage
- Error count
- Recovery count

---

## Testing Checklist

### Functional Tests

- [ ] Task appears on canvas after drag from inbox
- [ ] Task returns to inbox when moved back
- [ ] Section collapse preserves task positions
- [ ] Section expand restores task positions
- [ ] Auto-collect works for smart sections
- [ ] Connections create dependencies
- [ ] Shift+click disconnects edges
- [ ] Context menus function correctly
- [ ] Multi-select with Shift works
- [ ] Rectangle selection works

### Edge Cases

- [ ] Empty canvas renders correctly
- [ ] Many tasks (50+) performance acceptable
- [ ] Zoom limits work (5% to 400%)
- [ ] Task drag outside section bounds
- [ ] Section resize with tasks inside
- [ ] Undo/redo for canvas operations

---

## Quick Reference Commands

```bash
# Start dev server
PORT=5546 npm run dev

# TypeScript check
NODE_OPTIONS="--max-old-space-size=1024" npx vue-tsc --noEmit

# Kill dev processes
npm run kill

# Run tests
npm run test
```
