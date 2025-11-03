# Canvas System Architecture Overview

## 🎯 Purpose

The Pomo-Flow canvas system provides a visual, spatial workspace for organizing and managing tasks through sections. It enables users to create custom groupings, apply smart filters, and manipulate tasks through drag-and-drop interactions in a flexible, node-based environment.

## 🏗️ Core Architecture

### **1. Technology Stack**
- **Vue 3** with Composition API and TypeScript
- **Vue Flow** for node-based canvas interactions and parent-child relationships
- **Pinia** for centralized state management
- **IndexedDB** for persistent storage of canvas layout
- **VueUse** for composables and reactive utilities

### **2. Key Components**

```
src/
├── views/
│   └── CanvasView.vue              # Main canvas container and Vue Flow integration
├── components/canvas/
│   ├── SectionNodeSimple.vue       # Individual section nodes with collapse UI
│   ├── TaskNode.vue                # Task nodes within sections (parent-child)
│   └── CanvasContextMenu.vue       # Right-click context menus
├── stores/
│   └── canvas.ts                   # Canvas state management and business logic
└── composables/
    └── useDatabase.ts              # IndexedDB persistence layer
```

## 🔄 Data Flow Architecture

### **1. State Management Flow**

```
User Interaction → CanvasView.vue → Canvas Store (Pinia) → IndexedDB Persistence
        ↓                    ↓                    ↓                    ↓
   DOM Events         Vue Flow Nodes     Reactive State      useDatabase Composable
```

### **2. Component Hierarchy**

```
CanvasView (Main Container)
├── Vue Flow Canvas
│   ├── Section Nodes (Parents)
│   │   ├── Section Header
│   │   ├── Collapse/Expand Button
│   │   └── Task Nodes (Children)
│   └── Context Menus
└── Control Panels
    ├── Section Manager
    └── View Controls
```

## 🎨 Canvas Section System

### **1. Section Types**

**Smart Sections (Auto-Collecting):**
- **Priority Sections**: Automatically collect tasks by priority level (high/medium/low)
- **Status Sections**: Automatically collect tasks by status (planned/in_progress/done/backlog)
- **Project Sections**: Automatically collect tasks by project assignment
- **Timeline Sections**: Schedule tasks with temporal organization

**Custom Sections:**
- Manual task placement through drag-and-drop
- Custom filter criteria for flexible organization
- User-defined grouping strategies

### **2. Section Properties**

```typescript
interface CanvasSection {
  id: string                    // Unique identifier
  name: string                  // Display name
  type: SectionType            // 'priority' | 'status' | 'project' | 'timeline' | 'custom'
  position: {                  // Canvas position and dimensions
    x: number
    y: number
    width: number
    height: number
  }
  color: string                // Visual identification color
  filters?: SectionFilter      // Custom filtering criteria
  layout: LayoutType           // 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean           // Visibility toggle
  isCollapsed: boolean         // Collapse state
  propertyValue?: string       // Smart section filter value
  autoCollect?: boolean        // Auto-collect matching tasks
}
```

## 🔧 Collapsible Sections Implementation

### **1. Core Functionality**

The collapsible sections system provides the ability to minimize sections to a compact header while preserving all internal state and restoring original dimensions when expanded.

### **2. Key Features**

**Collapse Behavior:**
- Sections collapse to ~80px height showing only the header
- All child tasks are hidden but their positions are preserved
- Original dimensions (width/height) are stored in `collapsedHeight` property for restoration
- Visual feedback via chevron icon rotation
- **FIXED**: Height restoration now properly works with collapsedHeight tracking

**Expand Behavior:**
- Sections restore to exact original dimensions
- Child tasks reappear at their original positions
- State transitions are smooth and animated
- No data loss during collapse/expand cycles

### **3. Implementation Details**

**Data Structures:**
```typescript
interface TaskPosition {
  id: string
  position: { x: number; y: number }
  relativePosition: { x: number; y: number }
}

interface SectionCollapseData {
  taskPositions: TaskPosition[]
  originalHeight: number
  originalWidth: number
}
```

**Storage Strategy:**
- `collapsedSectionData` Map stores collapse state by section ID
- Task positions are preserved as absolute and relative coordinates
- Original section dimensions are stored for perfect restoration
- Data persists across page refreshes via IndexedDB

## 🎭 Vue Flow Parent-Child Relationships

### **1. Hierarchical Structure**

Tasks are rendered as children of sections using Vue Flow's built-in parent-child system:

```typescript
// Section Node (Parent)
{
  id: section.id,
  type: 'sectionNode',
  position: { x: section.position.x, y: section.position.y },
  data: { section },
  draggable: true,
  selectable: true
}

// Task Nodes (Children)
{
  id: task.id,
  type: 'taskNode',
  position: task.canvasPosition,
  parentNode: section.id,        // Parent reference
  // extent: 'parent' - REMOVED to allow tasks to be dragged outside sections
  data: { task },
  draggable: true,
  selectable: true
}
```

### **2. Conditional Rendering**

Child tasks are only rendered when their parent section is not collapsed:

```vue
<template v-if="!section.isCollapsed">
  <!-- Task nodes are only added to Vue Flow when section is expanded -->
  <Node
    v-for="taskNode in taskNodes"
    :key="taskNode.id"
    v-bind="taskNode"
    :type="taskNode.type"
    :position="taskNode.position"
    :parentNode="taskNode.parentNode"
    :extent="taskNode.extent"
    :data="taskNode.data"
  />
</template>
```

### **3. Drag and Drop Behavior**

**Section Movement:**
- When a section is dragged, all child tasks move with it automatically
- Vue Flow handles parent-child coordinate transformations
- Relative positions of tasks within sections are preserved

**Task Movement:**
- Tasks can be dragged between sections **(FIXED: extent constraint removed)**
- Magnetic snapping guides task placement
- Smart section associations are updated automatically
- Tasks can now be dragged outside sections without being trapped

## 🗄️ State Management System

### **1. Canvas Store (Pinia)**

The canvas store manages all canvas-related state and business logic:

**Core State:**
```typescript
interface CanvasState {
  viewport: { x: number; y: number; zoom: number }
  selectedNodeIds: string[]
  connectMode: boolean
  connectingFrom: string | null
  sections: CanvasSection[]
  activeSectionId: string | null
  collapsedSectionData: Map<string, SectionCollapseData>
  multiSelectMode: boolean
  selectionRect: SelectionRect | null
  selectionMode: 'rectangle' | 'lasso' | 'click'
  isSelecting: boolean
}
```

**Key Actions:**
- `createSection()` - Create new sections with auto-generated IDs
- `updateSection()` - Update section properties
- `toggleSectionCollapse()` - Handle collapse/expand with data preservation
- `getTasksInSectionBounds()` - Get tasks geometrically or logically associated
- `taskMatchesSection()` - Smart section matching logic
- `toggleAutoCollect()` - Enable/disable automatic task collection

### **2. Persistence Layer**

**IndexedDB Integration:**
- Canvas sections are automatically saved to IndexedDB
- 1-second debounced save to prevent excessive writes
- Automatic restoration on page load
- Handles browser storage limitations gracefully

## 🎯 Advanced Features

### **1. Multi-Selection System**

**Selection Modes:**
- Rectangle selection for batch operations
- Lasso selection for irregular shapes
- Click selection for individual items
- Keyboard modifiers for extended selection

**Batch Operations:**
- Bulk status updates
- Bulk priority changes
- Bulk project assignment
- Bulk deletion with undo support

### **2. Context Menu System**

**Canvas Context Menu:**
- Create custom groups
- Paste tasks from clipboard
- Canvas-level operations

**Section Context Menu:**
- Section-specific operations
- Filter modifications
- Auto-collect toggle

**Task Context Menu:**
- Task editing and deletion
- Quick status changes
- Move between sections

### **3. Magnetic Snapping System**

**Smart Guides:**
- Visual feedback during drag operations
- Automatic alignment to section boundaries
- Grid-based positioning assistance
- Proximity-based suggestions

**Position Calculation:**
- Intelligent empty spot detection
- Grid-based layout algorithms
- Collision avoidance
- Optimal space utilization

## 🔗 Canvas Connectors & Drag System

### **1. Task Dependency Connections**

The canvas system supports visual task dependency connections using Vue Flow's connector system:

**Connection Types:**
- **Dependency Lines**: Visual arrows showing task dependencies
- **Handle-based Creation**: Top/bottom handles for connection points
- **Smart Validation**: Prevents invalid connections (self-loops, section connections)

**Connection Implementation:**
```typescript
// Task Node Handles
<Handle type="target" :position="Position.Top" class="handle-target" />
<Handle type="source" :position="Position.Bottom" class="handle-source" />

// Connection State Management
const isConnecting = ref(false)
const handleConnectStart = (event) => {
  isConnecting.value = true
  // Clear context menus during connection
}
const handleConnectEnd = (event) => {
  setTimeout(() => { isConnecting.value = false }, 100)
}
```

### **2. Enhanced Drag System**

Advanced drag state management to prevent visual artifacts and ensure smooth interactions:

**Drag State Management:**
```typescript
// Local drag state for visual cleanup
const isNodeDragging = ref(false)

// Enhanced drag handlers
const handleDragStart = (event) => {
  isNodeDragging.value = true
  startDrag(dragData)
}
const handleDragEnd = () => {
  setTimeout(() => { isNodeDragging.value = false }, 50)
  endDrag()
}
```

**Visual Cleanup System:**
- **Transition Prevention**: `transition: none !important` during drag
- **Ghost Prevention**: Proper opacity and transform states
- **Edge Management**: Connector lines fade during drag operations
- **Context Menu Prevention**: Disabled during drag and connection modes

### **3. Context Menu Integration**

Smart context menu behavior that respects drag and connection operations:

**Menu Prevention Logic:**
```typescript
// During connection operations
const handlePaneContextMenu = (event) => {
  if (isConnecting.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  // Normal context menu behavior
}

// During drag operations
const handleContextMenu = (event) => {
  if (isNodeDragging.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('contextMenu', event, props.task)
}
```

### **4. CSS Visual State Management**

Comprehensive CSS system for clean drag and connection visual states:

**Drag State Styles:**
```css
/* Clean drag visual state */
.task-node.is-dragging {
  transition: none !important;
  animation: none !important;
  transform: scale(0.95) !important;
  opacity: 0.8 !important;
  backdrop-filter: none !important;
  z-index: 1000 !important;
}

/* Edge opacity management during drag */
body.dragging-active .vue-flow__edge {
  opacity: 0.5 !important;
  transition: opacity 0.2s ease !important;
}
```

**Connection Handle Styles:**
```css
/* Handle visibility during operations */
body.dragging-active .vue-flow__handle {
  transition: none !important;
  opacity: 0.7 !important;
}

.task-node.is-dragging .vue-flow__handle {
  opacity: 0.1 !important;
  transition: opacity 0.1s ease !important;
}
```

## 🐛 Critical Bug Fixes (October 2025)

### **1. Task Dragging Constraints - RESOLVED**

**Problem**: Tasks were getting stuck inside sections due to Vue Flow's `extent: 'parent'` constraint, preventing users from dragging tasks out of sections.

**Root Cause**: The `extent: 'parent'` property on task nodes created a bounding box that confined task movement within section boundaries.

**Solution**:
- Removed `extent: 'parent'` constraint from task node configuration
- Enhanced drag handling logic to detect when tasks move outside original sections
- Added boundary detection with proper position conversion between relative and absolute coordinates

**Files Modified**:
- `src/views/CanvasView.vue` (lines 489-498)
- Enhanced `handleNodeDragStop` function with improved boundary detection

**Impact**: Tasks can now be freely dragged between sections and canvas areas without being trapped.

### **2. Section Height Restoration - RESOLVED**

**Problem**: When sections were collapsed and then expanded, they didn't restore their original height, remaining stuck at the collapsed 80px height.

**Root Cause**: No mechanism existed to track and restore the original section dimensions during collapse/expand cycles.

**Solution**:
- Added `collapsedHeight?: number` property to `CanvasSection` interface
- Enhanced `toggleSectionCollapse()` function to store original height before collapsing
- Implemented height restoration logic that retrieves stored dimensions on expand

**Files Modified**:
- `src/stores/canvas.ts` (interface line 32, function lines 188-192, 210)
- Store logic now properly tracks and restores section dimensions

**Impact**: Sections now perfectly restore their original size after collapse/expand operations.

### **3. Task Transparency Issues - RESOLVED**

**Problem**: Done tasks had excessive transparency (50% opacity) making them barely visible and difficult to read.

**Root Cause**: Hardcoded `opacity: 0.5` in TaskNode.vue CSS made done tasks too transparent regardless of context.

**Solution**:
- Reduced base opacity from 0.5 to 0.8 for better visibility
- Added context-aware override for tasks inside sections (90% opacity)
- Maintained visual hierarchy while improving readability

**Files Modified**:
- `src/components/canvas/TaskNode.vue` (lines 336, 345)
- CSS now provides better visibility while maintaining visual distinction

**Impact**: Done tasks are now properly visible while still being visually distinguished from active tasks.

### **4. Testing & Verification**

**Manual Testing**: Created comprehensive verification interface at `canvas-fixes-test.html`

**Automated Testing**: Updated Playwright configuration to use correct test directory (`tests/`)

**Verification Status**: All fixes verified on localhost:5546 with working application

## 🔄 Event System

### **1. Vue Flow Events**

```typescript
onNodeDragStart: (event) => { handle drag start with visual cleanup }
onNodeDrag: (event) => { update positions in real-time, prevent artifacts }
onNodeDragStop: (event) => { save final positions, update associations }
onConnectStart: (event) => { begin connection mode, prevent context menus }
onConnect: (connection) => { create task relationships }
onConnectEnd: (event) => { end connection mode, restore normal behavior }
onPaneClick: (event) => { clear selections, close menus }
onPaneContextMenu: (event) => { show canvas context menu (prevented during drag/connect) }
```

### **2. Custom Events**

```typescript
// Section Events
onSectionUpdate: (section, updates) => { update section data }
onSectionCollapse: (sectionId, isCollapsed) => { handle collapse/expand }
onSectionDelete: (sectionId) => { remove section and reassign tasks }

// Task Events
onTaskMove: (taskId, newPosition) => { update task position }
onTaskAssign: (taskId, sectionId) => { assign task to section }
onTaskCreate: (task) => { add new task to canvas }
```

## 🧪 Testing Strategy

### **1. Unit Testing**

- Canvas store actions and computed properties
- Section filtering and matching logic
- Collapse/expand data preservation
- Position calculation algorithms

### **2. Integration Testing**

- Vue Flow parent-child relationships
- Drag and drop interactions
- Context menu functionality
- IndexedDB persistence

### **3. End-to-End Testing**

- Complete user workflows
- Cross-browser compatibility
- Performance with large datasets
- Accessibility compliance

## 📊 Performance Considerations

### **1. Optimization Strategies**

**Virtual Rendering:**
- Only render visible sections and tasks
- Lazy loading of task content
- Efficient DOM updates

**State Management:**
- Debounced saves to IndexedDB
- Selective reactivity updates
- Optimized computed properties

**Memory Management:**
- Cleanup of unused event listeners
- Efficient data structures
- Garbage collection optimization

### **2. Scaling Considerations**

**Large Canvas Support:**
- Infinite canvas capabilities
- Viewport-based rendering
- Progressive loading

**Performance Metrics:**
- 60fps drag interactions
- <100ms state updates
- <500ms database operations

## 🚀 Future Enhancements

### **1. Planned Features**

**Advanced Section Types:**
- Timeline sections with Gantt chart views
- Calendar integration sections
- Resource allocation sections

**Enhanced Interactions:**
- Keyboard shortcuts for all operations
- Touch/gesture support for mobile
- Voice commands for accessibility

**Collaboration Features:**
- Real-time multi-user editing
- Section sharing and templates
- Activity feeds and history

### **2. Technical Improvements**

**Performance:**
- Web Workers for heavy computations
- Canvas-based rendering for complex visualizations
- Optimized data structures

**Extensibility:**
- Plugin system for custom section types
- API for third-party integrations
- Custom theme system

---

This architecture document provides a comprehensive overview of the Pomo-Flow canvas system, enabling developers to understand the complete end-to-end functionality and make informed decisions about future enhancements and modifications.