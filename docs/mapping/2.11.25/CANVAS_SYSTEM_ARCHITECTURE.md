# Pomo-Flow - Canvas System Architecture

## Overview

The Canvas System is one of Pomo-Flow's most sophisticated features, providing a visual, node-based interface for task organization. Built on Vue Flow with custom extensions, it supports free-form task positioning, section-based organization, and visual dependency management.

## Architecture Overview

```
CanvasView.vue (Main Canvas Interface)
├── Vue Flow Core (Third-party library)
├── Canvas Store (State Management)
├── Canvas Components (Custom UI)
├── Canvas Composables (Logic)
└── Canvas Utils (Helpers)
```

## Core Technologies

### Vue Flow Integration
- **Library**: @vue-flow/core
- **Purpose**: Node-based canvas engine
- **Features**: Drag-and-drop, viewport controls, connections
- **Customization**: Custom node types, edge types, controls

### State Management
- **Canvas Store**: Canvas-specific state
- **Task Store**: Task data integration
- **UI Store**: Canvas preferences

### Performance
- **Virtual Scrolling**: Large canvas support
- **Viewport Culling**: Only render visible nodes
- **Optimized Rendering**: Efficient canvas updates

## Canvas State Architecture

### Canvas Store Structure

```typescript
interface CanvasState {
  // Viewport and Navigation
  viewport: {
    x: number         // Pan X position
    y: number         // Pan Y position
    zoom: number      // Zoom level (0.1 - 2.0)
  }

  // Section Management
  sections: CanvasSection[]           // All canvas sections
  collapsedSections: Set<string>      // Collapsed section IDs
  collapsedHeights: Map<string, number> // Preserved heights

  // Task Positioning
  taskPositions: Map<string, Position> // Task positions
  selectedNodes: string[]             // Selected node IDs
  selectedConnections: string[]       // Selected edge IDs

  // Multi-Selection
  selectionRect: SelectionRect | null // Selection rectangle
  isSelecting: boolean                // Selection active
  selectionMode: 'rectangle' | 'lasso' // Selection tool

  // Connections (Dependencies)
  connections: TaskConnection[]       // Task dependencies
  connectionTypes: ConnectionType[]   // Connection type definitions

  // Canvas Settings
  showGrid: boolean                   // Grid visibility
  snapToGrid: boolean                 // Grid snapping
  gridSize: number                    // Grid size (pixels)
  autoLayout: boolean                 // Auto-layout enabled

  // UI State
  canvasInitialized: boolean          // Canvas ready state
  activeSectionId: string | null      // Current active section
  contextMenuPosition: Position | null // Context menu location
}
```

### Section System

#### Section Types
```typescript
enum SectionType {
  PRIORITY = 'priority',      // Auto-collect by priority
  STATUS = 'status',          // Auto-collect by status
  PROJECT = 'project',        // Auto-collect by project
  CUSTOM = 'custom'           // Manual organization
}

interface CanvasSection {
  id: string
  type: SectionType
  title: string
  position: Position
  size: { width: number; height: number }
  collapsed: boolean
  collapsedHeight: number     // Preserved when collapsed
  filter?: SectionFilter      // Auto-collection rules
  color?: string              // Section color
  icon?: string               // Section icon
}
```

#### Auto-Collection Rules
```typescript
interface SectionFilter {
  // Priority-based sections
  priority?: TaskPriority[]

  // Status-based sections
  status?: TaskStatus[]

  // Project-based sections
  projectIds?: string[]

  // Custom filter expression
  expression?: string          // JavaScript expression
  function?: (task: Task) => boolean
}
```

## Component Architecture

### CanvasView.vue (Main Interface)

```vue
<template>
  <div class="canvas-view">
    <!-- Canvas Toolbar -->
    <CanvasToolbar />

    <!-- Vue Flow Canvas -->
    <VueFlow
      :nodes="canvasNodes"
      :edges="canvasEdges"
      :viewport="viewport"
      @node-drag="handleNodeDrag"
      @connect="handleConnection"
      @selection-change="handleSelectionChange"
    >
      <!-- Custom Node Types -->
      <template #node-canvasSection="{ node }">
        <CanvasSection :section="node.data" />
      </template>

      <template #node-taskNode="{ node }">
        <TaskNode :task="node.data" />
      </template>

      <!-- Custom Edge Types -->
      <template #edge-taskConnection="{ edge }">
        <TaskConnection :connection="edge.data" />
      </template>

      <!-- Canvas Controls -->
      <CanvasControls />

      <!-- Selection Overlay -->
      <MultiSelectionOverlay />

      <!-- Canvas Background -->
      <CanvasBackground />
    </VueFlow>

    <!-- Context Menus (Teleported) -->
    <CanvasContextMenu />
    <TaskContextMenu />
  </div>
</template>
```

### CanvasSection.vue (Section Container)

```typescript
interface CanvasSectionProps {
  section: CanvasSection
  tasks: Task[]
  collapsed: boolean
}

// Core functionality
const {
  handleDragOver,
  handleDrop,
  toggleCollapse,
  updatePosition,
  autoAssignTasks
} = useCanvasSection(section)
```

### TaskNode.vue (Task Representation)

```typescript
interface TaskNodeProps {
  task: Task
  position: Position
  selected: boolean
  connections: TaskConnection[]
}

// Drag and drop
const { dragProps, isDragging } = useDraggableNode(task)

// Connection handles
const { inputHandle, outputHandle } = useConnectionHandles(task)

// Node interactions
const {
  handleDoubleClick,
  handleRightClick,
  handleSelection
} = useTaskNodeInteractions(task)
```

## Canvas Composables

### useCanvas.ts (Main Canvas Logic)

```typescript
export function useCanvas() {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  // Viewport management
  const { viewport, zoomTo, panTo, fitToScreen } = useViewport()

  // Selection management
  const {
    selectNodes,
    clearSelection,
    selectInRectangle,
    multiSelectMode
  } = useSelection()

  // Node management
  const {
    addNode,
    removeNode,
    updateNodePosition,
    getNodesInViewport
  } = useNodeManagement()

  // Connection management
  const {
    createConnection,
    removeConnection,
    updateConnection,
    validateConnection
  } = useConnectionManagement()

  return {
    viewport,
    selectNodes,
    addNode,
    createConnection,
    zoomTo,
    fitToScreen
  }
}
```

### useCanvasSection.ts (Section Logic)

```typescript
export function useCanvasSection(section: CanvasSection) {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  // Section tasks
  const sectionTasks = computed(() => {
    return taskStore.tasks.filter(task =>
      isTaskInSection(task, section)
    )
  })

  // Auto-assignment
  const autoAssignTasks = () => {
    const eligibleTasks = taskStore.tasks.filter(task =>
      section.filter && matchesFilter(task, section.filter)
    )

    eligibleTasks.forEach(task => {
      assignTaskToSection(task.id, section.id)
    })
  }

  // Collapse/Expand
  const toggleCollapse = () => {
    canvasStore.toggleSectionCollapse(section.id)
  }

  // Drag and drop
  const handleDrop = (event: DragEvent) => {
    const taskId = event.dataTransfer?.getData('taskId')
    if (taskId) {
      assignTaskToSection(taskId, section.id)
    }
  }

  return {
    sectionTasks,
    autoAssignTasks,
    toggleCollapse,
    handleDrop
  }
}
```

### useTaskNode.ts (Task Node Logic)

```typescript
export function useTaskNode(task: Task) {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  // Node position
  const position = computed(() =>
    canvasStore.taskPositions.get(task.id) || { x: 0, y: 0 }
  )

  // Drag handling
  const { dragProps, isDragging } = useDraggable({
    position: position.value,
    onDragStart: () => canvasStore.selectNodes([task.id]),
    onDrag: (newPosition) => {
      canvasStore.updateTaskPosition(task.id, newPosition)
    },
    onDragEnd: () => {
      canvasStore.saveState(`Move task ${task.title}`)
    }
  })

  // Connection handling
  const {
    canConnect,
    createConnection,
    removeConnection
  } = useTaskConnections(task)

  // Node actions
  const handleDoubleClick = () => {
    // Open task edit modal
    openTaskEditModal(task.id)
  }

  const handleRightClick = (event: MouseEvent) => {
    // Show context menu
    showTaskContextMenu(event, task.id)
  }

  return {
    position,
    dragProps,
    isDragging,
    canConnect,
    createConnection,
    handleDoubleClick,
    handleRightClick
  }
}
```

## Canvas Performance Optimization

### Viewport Culling
```typescript
// Only render nodes visible in viewport
const visibleNodes = computed(() => {
  return allNodes.value.filter(node =>
    isNodeInViewport(node, viewport.value)
  )
})

// Efficient viewport calculation
const isNodeInViewport = (node: Node, viewport: Viewport) => {
  const nodeBounds = getNodeBounds(node)
  const viewportBounds = getViewportBounds(viewport)

  return intersects(nodeBounds, viewportBounds)
}
```

### Virtual Scrolling
```typescript
// Virtual scrolling for large canvases
const {
  containerProps,
  wrapperProps,
  visibleNodes
} = useVirtualScrolling({
  items: allNodes,
  itemHeight: (node) => getNodeHeight(node),
  containerHeight: canvasHeight,
  overscan: 50
})
```

### Debounced Updates
```typescript
// Debounce position updates to improve performance
const debouncedUpdatePosition = useDebounce((
  taskId: string,
  position: Position
) => {
  canvasStore.updateTaskPosition(taskId, position)
}, 16) // 60fps
```

### Memory Management
```typescript
// Cleanup unused connections
const cleanupOrphanedConnections = () => {
  const validTaskIds = new Set(taskStore.tasks.map(t => t.id))

  canvasStore.connections = canvasStore.connections.filter(
    connection =>
      validTaskIds.has(connection.fromTaskId) &&
      validTaskIds.has(connection.toTaskId)
  )
}
```

## Canvas Data Flow

### Task to Canvas Assignment
```typescript
// 1. Task created/updated
taskStore.createTask(taskData)

// 2. Auto-assign to section
canvasStore.autoAssignTaskToSection(taskId)

// 3. Set initial position
canvasStore.setTaskPosition(taskId, calculateInitialPosition(task))

// 4. Update Vue Flow nodes
updateVueFlowNodes()
```

### Position Persistence
```typescript
// 1. Node dragged
onNodeDrag((event) => {
  const { nodeId, position } = event

  // 2. Update store
  canvasStore.updateTaskPosition(nodeId, position)

  // 3. Debounced save
  debouncedSaveCanvasState()
})

// 4. Persist to database
const saveCanvasState = async () => {
  await db.save('canvas-state', {
    taskPositions: canvasStore.taskPositions,
    sections: canvasStore.sections,
    connections: canvasStore.connections
  })
}
```

### Section Management
```typescript
// 1. Section created
canvasStore.createSection(sectionData)

// 2. Auto-assign existing tasks
sectionData.tasks.forEach(taskId => {
  assignTaskToSection(taskId, sectionData.id)
})

// 3. Update Vue Flow
updateVueFlowSections()

// 4. Save state
await saveCanvasState()
```

## Canvas Interaction Patterns

### Multi-Selection
```typescript
// Rectangle selection
const handleRectangleSelection = (startPos: Position, endPos: Position) => {
  const selectionRect = { start: startPos, end: endPos }
  const nodesInRect = getNodesInRectangle(selectionRect)

  if (keyboardModifiers.shift) {
    // Add to existing selection
    canvasStore.addToSelection(nodesInRect)
  } else {
    // Replace selection
    canvasStore.selectNodes(nodesInRect)
  }
}

// Lasso selection
const handleLassoSelection = (points: Position[]) => {
  const polygon = createPolygon(points)
  const nodesInPolygon = getNodesInPolygon(polygon)
  canvasStore.selectNodes(nodesInPolygon)
}
```

### Connection Creation
```typescript
// Connection creation
const handleConnectionCreate = (connection: Connection) => {
  const { source, target } = connection

  // Validate connection
  if (validateTaskConnection(source, target)) {
    const taskConnection: TaskConnection = {
      id: generateId(),
      fromTaskId: source,
      toTaskId: target,
      type: 'dependency',
      createdAt: new Date()
    }

    canvasStore.createConnection(taskConnection)
  }
}

// Connection validation
const validateTaskConnection = (fromId: string, toId: string) => {
  // Prevent circular dependencies
  if (wouldCreateCircularDependency(fromId, toId)) {
    return false
  }

  // Prevent duplicate connections
  if (connectionExists(fromId, toId)) {
    return false
  }

  // Prevent self-connection
  if (fromId === toId) {
    return false
  }

  return true
}
```

### Context Menus
```typescript
// Canvas context menu
const showCanvasContextMenu = (position: Position) => {
  canvasStore.setContextMenuPosition(position)

  const menuItems = [
    {
      label: 'Create Section',
      action: () => createSectionAtPosition(position)
    },
    {
      label: 'Paste Tasks',
      action: () => pasteTasksAtPosition(position),
      disabled: !clipboard.hasTasks()
    },
    {
      label: 'Canvas Settings',
      action: () => openCanvasSettings()
    }
  ]

  showContextMenu(menuItems, position)
}

// Task node context menu
const showTaskContextMenu = (position: Position, taskId: string) => {
  const menuItems = [
    {
      label: 'Edit Task',
      action: () => openTaskEditModal(taskId)
    },
    {
      label: 'Duplicate Task',
      action: () => duplicateTask(taskId)
    },
    {
      label: 'Delete Task',
      action: () => deleteTask(taskId)
    },
    { type: 'separator' },
    {
      label: 'Create Connection',
      action: () => startConnectionCreation(taskId)
    },
    {
      label: 'Assign to Section',
      action: () => showSectionSelector(taskId)
    }
  ]

  showContextMenu(menuItems, position)
}
```

## Canvas Persistence Strategy

### Database Schema
```typescript
interface CanvasStateDocument {
  _id: 'canvas-state'

  // Viewport state
  viewport: {
    x: number
    y: number
    zoom: number
  }

  // Task positions
  taskPositions: Record<string, Position>

  // Sections
  sections: CanvasSection[]

  // Connections
  connections: TaskConnection[]

  // Settings
  settings: {
    showGrid: boolean
    snapToGrid: boolean
    gridSize: number
    autoLayout: boolean
  }

  // Metadata
  lastModified: Date
  version: string
}
```

### Auto-Save Strategy
```typescript
// Debounced auto-save
const debouncedSave = useDebounce(async () => {
  try {
    const canvasState = {
      viewport: canvasStore.viewport,
      taskPositions: Object.fromEntries(canvasStore.taskPositions),
      sections: canvasStore.sections,
      connections: canvasStore.connections,
      settings: canvasStore.settings,
      lastModified: new Date(),
      version: '1.0.0'
    }

    await db.save('canvas-state', canvasState)
    canvasStore.setLastSaveTime(new Date())
  } catch (error) {
    console.error('Failed to save canvas state:', error)
    canvasStore.setSaveError(error.message)
  }
}, 2000) // 2 second debounce
```

### Conflict Resolution
```typescript
// Handle concurrent modifications
const resolveCanvasConflicts = async (
  localState: CanvasStateDocument,
  remoteState: CanvasStateDocument
) => {
  // Use last-modified timestamp for simple conflict resolution
  if (localState.lastModified > remoteState.lastModified) {
    // Local state is newer
    await db.save('canvas-state', localState)
  } else {
    // Remote state is newer
    await mergeCanvasStates(localState, remoteState)
  }
}
```

## Canvas Testing Strategy

### Unit Testing
```typescript
describe('Canvas Store', () => {
  it('should add task to section', () => {
    const canvas = useCanvasStore()
    const taskId = 'task-1'
    const sectionId = 'section-1'

    canvas.assignTaskToSection(taskId, sectionId)

    expect(canvas.taskSectionMap.get(taskId)).toBe(sectionId)
  })

  it('should update task position', () => {
    const canvas = useCanvasStore()
    const taskId = 'task-1'
    const position = { x: 100, y: 200 }

    canvas.updateTaskPosition(taskId, position)

    expect(canvas.taskPositions.get(taskId)).toEqual(position)
  })
})
```

### Integration Testing
```typescript
describe('Canvas Drag and Drop', () => {
  it('should move task to new position', async () => {
    const { getByTestId } = render(CanvasView)
    const taskNode = getByTestId('task-node-1')

    await drag(taskNode, { to: { x: 150, y: 250 } })

    expect(canvasStore.taskPositions.get('task-1')).toEqual({ x: 150, y: 250 })
  })

  it('should assign task to section on drop', async () => {
    const { getByTestId } = render(CanvasView)
    const taskNode = getByTestId('task-node-1')
    const section = getByTestId('section-1')

    await drag(taskNode, { to: section })

    expect(canvasStore.getTaskSection('task-1')).toBe('section-1')
  })
})
```

## Canvas Architecture Best Practices

### 1. Performance
- Use viewport culling for large canvases
- Implement virtual scrolling for many nodes
- Debounce position updates and saves
- Optimize render cycles with computed properties

### 2. State Management
- Keep canvas state separate from task data
- Use immutable updates for better change detection
- Implement proper cleanup for unused data
- Validate state changes before persistence

### 3. User Experience
- Provide visual feedback for all interactions
- Support keyboard navigation
- Implement smooth animations and transitions
- Maintain context during operations

### 4. Error Handling
- Gracefully handle drag and drop failures
- Recover from save errors
- Validate user inputs
- Provide meaningful error messages

The Canvas System architecture demonstrates sophisticated Vue.js patterns with Vue Flow integration, real-time collaboration, performance optimization, and comprehensive state management. It serves as an excellent example of complex visual interfaces in modern web applications.

**Last Updated**: November 2, 2025
**Architecture Version**: Vue 3.4.0, Vue Flow, Composition API