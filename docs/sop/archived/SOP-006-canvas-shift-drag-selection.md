# SOP-006: Canvas Shift+Drag Selection Inside Groups

**Created**: 2026-01-15
**Task**: TASK-295
**Status**: Resolved

## Problem

When holding Shift and dragging inside a group on the canvas, the selection box did not appear. Instead, the group would move, or no visual feedback was shown despite tasks being selected.

## Root Cause

This is a known Vue Flow / xyflow issue documented in [xyflow/xyflow#3041](https://github.com/xyflow/xyflow/issues/3041).

Three factors caused the issue:

1. **`nodes-draggable` still enabled**: Vue Flow's `nodes-draggable` prop was `true` even when Shift was held, causing nodes to start dragging instead of allowing selection.

2. **Task nodes blocking events**: CSS rule only set `pointer-events: none` on group nodes during shift-select, but task nodes still had `pointer-events: auto`, blocking the selection box from starting.

3. **Invisible selection box**: The `CanvasSelectionBox.vue` component used undefined CSS variables (`--accent-primary`, `--color-indigo-bg-subtle`), making the selection box invisible.

## Solution

### 1. Disable Node Dragging When Shift Held

**File**: `src/views/CanvasView.vue`

```vue
<!-- Before -->
:nodes-draggable="!control && !meta"

<!-- After -->
:nodes-draggable="!control && !meta && !shift"
```

### 2. Enable Vue Flow's Native Selection

**File**: `src/views/CanvasView.vue`

```vue
:selection-on-drag="shift"
```

### 3. Set pointer-events: none on ALL Nodes

**File**: `src/assets/canvas-view-overrides.css`

```css
/*
   SHIFT-DRAG SELECTION SUPPORT
   When Shift is held, disable pointer events on ALL nodes (groups AND tasks)
   so the drag event falls through to the Vue Flow Pane to start the selection box.
*/
.shift-selecting .vue-flow__node-sectionNode,
.shift-selecting .vue-flow__node-taskNode {
    pointer-events: none !important;
}

/* Ensure all children inside nodes also have pointer-events disabled */
.shift-selecting .vue-flow__node-sectionNode *,
.shift-selecting .vue-flow__node-taskNode * {
    pointer-events: none !important;
}
```

### 4. Fix Selection Box CSS

**File**: `src/components/canvas/CanvasSelectionBox.vue`

```css
.canvas-selection-box {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  border: 2px solid rgba(99, 102, 241, 0.8);
  background-color: rgba(99, 102, 241, 0.15);
  border-radius: 4px;
}
```

### 5. Move Selection Box Outside VueFlow

**File**: `src/views/CanvasView.vue`

The `CanvasSelectionBox` component must be rendered **outside** the `<VueFlow>` component to avoid CSS transform issues that can affect `position: fixed` elements.

```vue
</VueFlow>

<!-- Selection box outside VueFlow to avoid transform issues -->
<CanvasSelectionBox :selection-box="selectionBox" />

<CanvasLoadingOverlay ... />
```

## How It Works

1. User holds Shift key
2. CSS class `shift-selecting` is applied to canvas layout
3. All nodes (groups AND tasks) become click-through (`pointer-events: none`)
4. User clicks and drags
5. Event passes through nodes to Vue Flow pane
6. Vue Flow's `selectionOnDrag` creates the native selection box
7. On release, tasks within the box are selected

## Testing

1. Hold Shift key
2. Click and drag inside a group on the canvas
3. Verify blue selection box appears
4. Release mouse - tasks inside box should be selected

## References

- [xyflow/xyflow#3041 - Selection on drag inside a parent node not working](https://github.com/xyflow/xyflow/issues/3041)
- Vue Flow `selectionOnDrag` prop documentation
