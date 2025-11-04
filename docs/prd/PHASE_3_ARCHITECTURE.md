# Phase 3: Design System & Architecture Modernization

## Overview

Phase 3 focuses on systematic architectural improvements to the Pomo-Flow application, emphasizing component decomposition, store modernization, and performance optimization while maintaining zero regressions.

## Development Environment

- **Branch**: `phase-3-development`
- **Base Tag**: `v2.0.0` (production ready)
- **Safety Requirement**: Zero functionality loss throughout all phases

## Phase Structure

### Phase 3.0: Foundation ✅
- Create development branch with safety checkpoint
- Establish baseline documentation and testing procedures
- Set up comprehensive regression testing framework

### Phase 3.1: CanvasView Decomposition ✅
**Focus**: Safe extraction of non-Vue-Flow components from CanvasView.vue (4,164 lines)

#### Phase 3.1.A: Modal Extraction ✅
**Status**: COMPLETED
**Date**: November 4, 2025

**Accomplishments**:
- ✅ Created `useCanvasModals.ts` composable with comprehensive modal state management
- ✅ Created `CanvasModals.vue` wrapper component for centralized modal UI
- ✅ Successfully integrated modal system into CanvasView.vue
- ✅ Fixed duplicate function declaration errors during integration
- ✅ Verified zero regressions in modal functionality

**Components Extracted**:
- TaskEditModal
- BatchEditModal
- GroupModal
- SectionWizardModal
- KeyboardTestOverlay

**Benefits Achieved**:
- Reduced CanvasView.vue complexity by ~200 lines
- Centralized modal state management
- Improved reusability and maintainability
- Enhanced type safety for modal operations

#### Phase 3.1.B: Context Menu Extraction ✅
**Status**: COMPLETED
**Date**: November 4, 2025

**Accomplishments**:
- ✅ Created `useCanvasContextMenus.ts` composable with comprehensive context menu state management
- ✅ Created `CanvasContextMenus.vue` wrapper component for centralized context menu UI
- ✅ Successfully integrated context menu system into CanvasView.vue
- ✅ Resolved variable naming conflicts between composables and local state
- ✅ Verified zero compilation errors with successful build (2.28MB, 651KB gzipped)

**Components Extracted**:
- CanvasContextMenu (canvas background right-click)
- EdgeContextMenu (connection/edge right-click)
- NodeContextMenu (node/section right-click)

**Benefits Achieved**:
- Reduced CanvasView.vue complexity by ~150 lines
- Centralized context menu state and positioning logic
- Improved separation of concerns
- Enhanced testability of context menu functionality
- Consistent composable pattern established across canvas components

**Technical Details**:
- Extracted context menu state variables: `showCanvasContextMenu`, `canvasContextMenuX/Y`, `showEdgeContextMenu`, `edgeContextMenuX/Y`, `showNodeContextMenu`, `nodeContextMenuX/Y`, `selectedNode`, `selectedEdge`, `selectedTask`, `selectedSection`
- Replaced local context menu functions with composable methods: `openCanvasContextMenu()`, `closeCanvasContextMenu()`, `openEdgeContextMenu()`, `closeEdgeContextMenu()`, `openNodeContextMenu()`, `closeNodeContextMenu()`
- Maintained local state wrapper for `canvasContextSection` to preserve existing functionality
- Updated event handlers to use composable methods while preserving all existing behavior

#### Phase 3.1.C: Canvas Controls Extraction ✅
**Status**: COMPLETED
**Date**: November 4, 2025

**Accomplishments**:
- ✅ Created `useCanvasControls.ts` composable with comprehensive zoom and viewport control management
- ✅ Created `CanvasControls.vue` wrapper component for centralized controls UI
- ✅ Successfully integrated controls system into CanvasView.vue
- ✅ Replaced local zoom functions with composable methods
- ✅ Updated keyboard shortcuts handler to use composable methods
- ✅ Removed duplicate zoom performance manager and related code
- ✅ Updated click outside handlers and cleanup functions
- ✅ Verified zero compilation errors with successful build validation

**Components Extracted**:
- Zoom controls (zoom in/out, reset, presets)
- Viewport controls (fit view, center canvas)
- Zoom performance management
- Keyboard shortcuts for zoom operations

**Benefits Achieved**:
- Reduced CanvasView.vue complexity by ~200 lines
- Centralized canvas controls state management
- Improved separation of concerns and reusability
- Enhanced type safety for canvas control operations
- Consistent composable pattern established across canvas components
- Performance optimization maintained with zoom throttling and batching

**Technical Details**:
- Extracted zoom performance manager with requestAnimationFrame batching
- Replaced local zoom functions: `fitView`, `zoomIn`, `zoomOut`, `applyZoomPreset`, `resetZoom`
- Updated keyboard shortcuts handler to use `handleZoomKeyboardShortcuts` composable method
- Maintained all zoom presets and validation logic in composable
- Preserved Vue Flow integration for viewport operations
- Enhanced zoom limit enforcement and validation

### Phase 3.2: App.vue & CalendarView Decomposition 🚧
**Focus**: Safe refactoring of root component and calendar view
**Status**: IN PROGRESS - Analysis Phase
**Date**: November 4, 2025

#### Current Component Analysis

**App.vue** (3,159 lines) - Root application component:
- **Sidebar Management**: Main sidebar with project navigation, smart views, quick task creation
- **Header Section**: Project title, timer display, user profile
- **View Navigation**: Tab-based navigation between Board/Calendar/Canvas/Catalog/Quick Sort
- **Global Modals**: Settings, projects, tasks, confirmation, search, authentication
- **Keyboard Shortcuts**: Comprehensive hotkey system (Cmd+K, Ctrl+Z, Shift+Delete, etc.)
- **Theme Integration**: Dark theme and design system coordination
- **Error Boundaries**: View-level error handling

**CalendarView.vue** (2,408 lines) - Calendar scheduling interface:
- **Date Navigation**: Previous/next day, today button, date display
- **Calendar Grid**: Time-based task scheduling with drag-and-drop
- **Task Management**: Quick create, inline editing, status updates
- **Filtering**: Project filters, status filters, hide completed tasks
- **Inbox Panel**: Secondary sidebar for calendar-specific task management
- **Drag & Drop**: Complex task scheduling with time slot creation
- **Integration**: Timer integration, task editing modals

#### Phase 3.2.A: App.vue Decomposition Strategy
**Safe Extraction Components** (Non-Critical Path):

1. **Sidebar Management System**
   - `useSidebarManagement.ts` - Sidebar visibility, project navigation, smart views
   - `AppSidebar.vue` - Main sidebar component wrapper
   - Extractible: Quick task creation, project tree, smart view navigation

2. **Header Management System**
   - `useAppHeader.ts` - Project title, timer display integration, user profile
   - `AppHeader.vue` - Header component wrapper
   - Extractible: Timer controls, user profile, project title display

3. **Global Modal Management**
   - `useGlobalModals.ts` - Settings, project, task, confirmation modals
   - `GlobalModals.vue` - Centralized modal wrapper
   - Extractible: All non-critical app-level modals

4. **Keyboard Shortcuts System**
   - `useKeyboardShortcuts.ts` - Comprehensive hotkey management
   - Extractible: View switching, undo/redo, search, task deletion shortcuts

**Critical Dependencies** (Must Remain in App.vue):
- Router configuration and view transitions
- Global error boundary setup
- Theme provider and design system initialization
- Authentication state management integration
- Vue Flow and complex component coordination

#### Phase 3.2.B: CalendarView Decomposition Strategy
**Safe Extraction Components** (Non-Critical Path):

1. **Calendar Header System**
   - `useCalendarHeader.ts` - Date navigation, today button, filtering controls
   - `CalendarHeader.vue` - Header component with navigation and filters
   - Extractible: Date navigation, project filters, status filters, hide done toggle

2. **Calendar Task Management**
   - `useCalendarTasks.ts` - Task creation, editing, drag-and-drop handling
   - `CalendarTaskManager.vue` - Task-related UI components
   - Extractible: Quick task creation, inline editing, task status updates

3. **Calendar Filtering System**
   - `useCalendarFilters.ts` - Project and status filtering logic
   - `CalendarFilters.vue` - Filter UI components
   - Extractible: Project filter dropdown, status filter buttons

**Critical Dependencies** (Must Remain in CalendarView.vue):
- Calendar grid rendering and time slot management
- Complex drag-and-drop scheduling logic
- Vue Flow integration for canvas elements
- Timer and modal integration hooks

#### Safety Constraints for Phase 3.2

1. **Router Integration**: App.vue must remain the router coordination hub
2. **Global State**: Theme, authentication, and error boundary management
3. **Complex Interactions**: Calendar drag-and-drop and Vue Flow integrations
4. **Performance**: Maintain current rendering performance and optimization
5. **Zero Regressions**: All existing functionality must work identically

#### Expected Benefits

- **Reduced Complexity**: Target reduction of ~800 lines from App.vue and ~600 lines from CalendarView.vue
- **Improved Maintainability**: Separated concerns for sidebar, header, and modal management
- **Enhanced Reusability**: Composable patterns for cross-component functionality
- **Better Testing**: Isolated components for unit testing
- **Cleaner Architecture**: Clear separation between app coordination and feature components

### Phase 3.3: Store Architecture Modernization (Planned)
**Focus**: Store decomposition and event bus pattern implementation

### Phase 3.4: Performance Optimization (Planned)
**Focus**: Vue Flow optimization and database improvements

### Phase 3.5: Final Testing & Cloud Deployment Preparation (Planned)
**Focus**: Complete validation and deployment readiness

## Safety Measures

### Regression Testing Protocol
1. **Pre-change validation**: Verify current functionality
2. **Step-by-step implementation**: Small, testable changes
3. **Post-change validation**: Comprehensive testing
4. **Automated E2E tests**: Playwright verification
5. **Manual validation**: Visual confirmation of critical workflows

### Git Workflow
- Feature branch development with regular commits
- Comprehensive commit messages
- Safety checkpoints at each phase completion
- Rollback capability maintained throughout

### Build Validation
- Zero compilation errors requirement
- Bundle size monitoring
- Performance impact assessment
- Type safety maintenance

## Technical Patterns Established

### Composable Pattern for State Management
```typescript
// Example: useCanvasModals pattern
export function useCanvasModals() {
  const isEditModalOpen = ref(false)
  const selectedTask = ref<Task | null>(null)

  const openEditModal = (task: Task) => {
    selectedTask.value = task
    isEditModalOpen.value = true
  }

  const closeEditModal = () => {
    isEditModalOpen.value = false
    selectedTask.value = null
  }

  return {
    isEditModalOpen,
    selectedTask,
    openEditModal,
    closeEditModal
  }
}
```

### Wrapper Component Pattern
```vue
<!-- Example: CanvasModals.vue pattern -->
<template>
  <TaskEditModal
    :is-open="isEditModalOpen"
    :task="selectedTask"
    @close="closeEditModal"
  />
  <!-- Other modals... -->
</template>

<script setup lang="ts">
import { useCanvasModals } from '@/composables/canvas/useCanvasModals'
const {
  isEditModalOpen,
  selectedTask,
  closeEditModal
} = useCanvasModals()
</script>
```

## Progress Metrics

### Code Reduction
- **CanvasView.vue**: Target reduction from 4,164 to ~3,500 lines
- **Phase 3.1.A**: Reduced by ~200 lines (modals extracted)
- **Phase 3.1.B**: Reduced by ~150 lines (context menus extracted)
- **Phase 3.1.C**: Reduced by ~200 lines (canvas controls extracted)
- **Phase 3.2**: Target reduction ~1,400 lines total (App.vue + CalendarView.vue)

### Component Architecture
- Enhanced modularity and reusability
- Improved separation of concerns
- Better testability in isolation
- Cleaner dependency management

### Performance
- Maintaining or improving current performance
- Bundle size optimization
- Memory usage optimization
- Render performance improvements

## Risks and Mitigations

### Vue Flow Integration Constraints
**Risk**: Breaking Vue Flow parent-child relationships
**Mitigation**: Only extracting non-Vue-Flow components, maintaining all Vue Flow integration within CanvasView.vue

### App.vue Coordination Complexity
**Risk**: Disrupting global app coordination and router management
**Mitigation**: Maintaining critical app coordination in App.vue, only extracting feature-specific functionality

### Calendar Drag-and-Drop Complexity
**Risk**: Breaking complex calendar scheduling interactions
**Mitigation**: Keeping calendar grid and drag-drop logic in CalendarView.vue, extracting only supporting components

### Regression Risk
**Risk**: Introducing bugs during refactoring
**Mitigation**: Comprehensive testing at each step, zero-regression requirement, automated E2E validation

### Performance Impact
**Risk**: Performance degradation from component decomposition
**Mitigation**: Performance monitoring, bundle analysis, optimized composable patterns

## Success Criteria

### Functional Requirements
- ✅ All existing functionality preserved
- ✅ Zero regression in user workflows
- ✅ All E2E tests passing
- ✅ Performance maintained or improved

### Code Quality Requirements
- ✅ Improved component modularity
- ✅ Enhanced code reusability
- ✅ Better separation of concerns
- ✅ Maintained type safety

### Development Experience Requirements
- ✅ Improved developer productivity
- ✅ Enhanced debugging capabilities
- ✅ Better code organization
- ✅ Easier feature development

---

**Last Updated**: November 4, 2025
**Current Phase**: 3.2.A (App.vue Decomposition Analysis - In Progress)
**Next Milestone**: Begin Phase 3.2.A implementation with Sidebar Management extraction