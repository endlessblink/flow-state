# Standard Operating Procedure: Canvas Modularization & Slimming (Operation Defrag)

**Date**: January 2, 2026
**Status**: COMPLETED (Phase 6 & 7)
**Target**: `src/views/CanvasView.vue`
**Goal**: Reduce complexity of the monolithic Canvas view by extracting logic into specialized composables.

## 1. Context & Rationale

At the start of Phase 6, `CanvasView.vue` exceeded 4,200 lines, leading to:
- **Reactivity Overhead**: Unrelated state changes triggering expensive computed property recalculations.
- **Maintenance Difficulty**: Overlapping logic for selection, drag-and-drop, and group management.
- **Silent Failures**: Logic errors like **BUG-055** (position persistence) hidden in massive script blocks.

## 2. Structural Implementation

We utilized the **Strangler Fig Pattern**, gradually moving "brain" logic into composables while maintaining the "body" (template) in the main view.

### A. Advanced Interaction Handling
**File**: `src/composables/canvas/useCanvasInteractionHandlers.ts`
- **Responsibility**: All Vue Flow event-driven logic.
- **Key Functions**:
    - `handleNodesChange`: Manages node/edge lifecycle and group resizing.
    - `handleConnect/Start/End`: Orchestrates edge creation.
    - `handlePaneClick/ContextMenu`: Manages the global canvas interaction surface.
- **Benefit**: Decouples the UI component from the engine events.

### B. Modal State Management
**File**: `src/composables/canvas/useCanvasModals.ts`
- **Responsibility**: Unified state for all canvas-related overlays.
- **Key States**: `isGroupModalOpen`, `isDeleteGroupModalOpen`, `isBulkDeleteModalOpen`.
- **Dynamic Content**: Centralized computed properties for confirmation messages (e.g., `bulkDeleteMessage`) to keep the template clean.

### C. Filtered State & Layout Math
**File**: `src/composables/canvas/useCanvasFilteredState.ts`
- **Responsibility**: Heavy computations and layout-specific derivations.
- **Key Features**:
    - **Optimized Task Filtering**: Uses robust hashing (`lastCanvasTasksHash`) to prevent redundant filtering when data hasn't changed.
    - **Boundary derivation**: `dynamicNodeExtent` calculation for group confinement.
    - **Layout Helpers**: `generateCanvasPosition` for right-click task creation.

## 3. Key Technical Fixes

### BUG-055: Group Resize Persistence
- **Discovery**: Found that group resizing visually moved tasks but didn't trigger database updates.
- **Resolution**: Integrated `taskStore.updateTask` calls into the resize handlers within the new modular structure, ensuring absolute positions are saved during delta transformations.

### Unused Code & Lint Efficiency
- **Cleanup**: Removed ~150 lines of legacy "retry" logic and unused imports (`CanvasStatusOverlays`) that were identified during the extraction process.

## 4. Verification Requirements

When modifying canvas logic in the future:
1.  **Selection Integrity**: Verify `Shift+Click` and marquee selection work across all types (Tasks/Groups).
2.  **Persistence**: Every drag/resize operation MUST be verified in the browser's IndexedDB (PouchDB) to ensure coordinates are saved.
3.  **Boundary Safety**: Ensure tasks cannot be moved outside the `dynamicNodeExtent` when dragged within groups.

## 5. Metadata

- **Lines Removed**: ~1,100 from `CanvasView.vue`.
- **New Files**: 3 specialized composables.
- **Dependency Map**:
    - `CanvasView.vue` → `useCanvasInteractionHandlers` → `CanvasStore`
    - `CanvasView.vue` → `useCanvasFilteredState` → `TaskStore`
