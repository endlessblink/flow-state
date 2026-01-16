# SOP-008: Canvas Connection UX Improvements

**Related Task**: TASK-301
**Created**: 2026-01-16
**Status**: Resolved

## Overview

This SOP documents the implementation of enhanced connection UX features for the canvas view, including visual feedback (glowing effects) and a drag-to-create workflow.

## Features Implemented

### 1. Connection Handle Visibility
Task nodes now display connection handles (small dots) at the top (target) and bottom (source) for creating parent-child relationships.

### 2. Handle Glow on Hover
When hovering over a connection handle:
- **Source handle (bottom)**: Blue glow (`--color-navigation`)
- **Target handle (top)**: Green glow (`--color-success`)

### 3. Cable Glow While Dragging
The connection line glows with a pulsing blue animation while dragging from one task to another.

### 4. Permanent Edge Glow
Already-created connections (edges) display a subtle blue glow for visual clarity.

### 5. Drag-to-Create Feature
Dragging a connection from a task's source handle and dropping it on empty canvas space opens the QuickTaskCreateModal to create a new child task with the connection pre-established.

---

## Technical Implementation

### CSS Selectors Reference

| Element | Vue Flow Class | Purpose |
|---------|----------------|---------|
| Connection handles | `.vue-flow__handle` | Small dots on nodes |
| Dragging line | `.vue-flow__connection-path` | Line while actively dragging |
| Permanent edge | `.vue-flow__edge-path` | Established connections |

**Important**: Vue Flow uses `.vue-flow__connection-path` for the dragging line, NOT `.vue-flow__connection-line`.

### File: `src/assets/canvas-view-overrides.css`

**Handle Hover Glow** (~line 280):
```css
.vue-flow__handle:hover {
    width: 16px !important;
    height: 16px !important;
    background: rgba(255, 255, 255, 0.3) !important;
    border-color: rgba(255, 255, 255, 0.7) !important;
    box-shadow: 0 0 8px 2px var(--brand-primary), 0 0 16px 4px rgba(59, 130, 246, 0.3) !important;
}
```

**Connection Line While Dragging** (~line 605):
```css
.vue-flow__connection-path {
    stroke: var(--color-navigation) !important;
    stroke-width: 3px !important;
    stroke-linecap: round !important;
    shape-rendering: geometricPrecision !important;
    filter: drop-shadow(0 0 6px var(--color-navigation)) drop-shadow(0 0 12px rgba(59, 130, 246, 0.5)) !important;
    animation: connection-glow 1.5s ease-in-out infinite !important;
}
```

**Permanent Edge Glow** (~line 140):
```css
.vue-flow__edge-path {
    stroke: var(--color-navigation);
    stroke-width: 2px;
    transition: all var(--duration-normal) var(--ease-out);
    shape-rendering: geometricPrecision;
    filter: drop-shadow(0 0 4px var(--color-navigation)) drop-shadow(0 0 8px rgba(59, 130, 246, 0.3));
}
```

### File: `src/components/canvas/TaskNode.vue`

Restored Handle components for connection functionality:
```vue
<Handle
  v-if="isInVueFlowContext"
  id="target"
  type="target"
  :position="Position.Top"
  :connectable="true"
  class="handle-target"
/>
<Handle
  v-if="isInVueFlowContext"
  id="source"
  type="source"
  :position="Position.Bottom"
  :connectable="true"
  class="handle-source"
/>
```

### File: `src/composables/canvas/useCanvasConnections.ts`

Connection tracking state for drag-to-create:
```typescript
interface ConnectionState {
    isConnecting: Ref<boolean>
    pendingConnectionSource: Ref<string | null>      // Source task ID when dragging
    connectionWasSuccessful: Ref<boolean>            // Track if onConnect fired
}
```

**Event Sequence**:
- Valid connection: `onConnectStart` → `onConnect` → `onConnectEnd`
- Empty space drop: `onConnectStart` → `onConnectEnd` (no `onConnect`)

The `handleConnectEnd` checks if `connectionWasSuccessful` is false to detect empty-space drops:
```typescript
const handleConnectEnd = (event?: MouseEvent | TouchEvent | ...) => {
    const sourceTaskId = state.pendingConnectionSource?.value
    const wasSuccessful = state.connectionWasSuccessful?.value

    setTimeout(() => {
        if (sourceTaskId && !wasSuccessful && event && 'clientX' in event) {
            const flowCoords = deps.screenToFlowCoordinate({
                x: (event as MouseEvent).clientX,
                y: (event as MouseEvent).clientY
            })
            deps.createConnectedTask(flowCoords, sourceTaskId)
        }
        // Cleanup...
    }, 50)  // Small delay to let onConnect fire first
}
```

### File: `src/composables/canvas/useCanvasTaskActions.ts`

`createConnectedTask` function sets `parentTaskId` when opening the quick task modal:
```typescript
const createConnectedTask = (position: { x: number; y: number }, parentTaskId: string) => {
    quickTaskPosition.value = {
        flowX: position.x,
        flowY: position.y,
        screenX: 0,
        screenY: 0,
        parentTaskId  // Pre-set the parent relationship
    }
    isQuickTaskCreateOpen.value = true
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/assets/canvas-view-overrides.css` | Handle hover glow, connection path glow, permanent edge glow |
| `src/components/canvas/TaskNode.vue` | Restored Handle components |
| `src/composables/canvas/useCanvasConnections.ts` | Connection tracking state, drag-to-create logic |
| `src/composables/canvas/useCanvasTaskActions.ts` | `createConnectedTask` function |
| `src/composables/canvas/useCanvasOrchestrator.ts` | Wired up dependencies |

---

## Debugging Notes

### Issue: Glow Not Visible
**Symptom**: CSS applied but user doesn't see glow
**Cause**: Browser cache
**Fix**: Hard refresh (`Ctrl+Shift+R`) or restart dev server

### Issue: Wrong CSS Selector
**Symptom**: Dragging line doesn't glow
**Cause**: Used `.vue-flow__connection-line` instead of `.vue-flow__connection-path`
**Fix**: Vue Flow uses `.vue-flow__connection-path` for the SVG path element

### Issue: Drag-to-Create Fires on Valid Connections
**Symptom**: Task creation modal opens even when dropping on valid target
**Cause**: `onConnectEnd` fires before `onConnect`
**Fix**: Track `connectionWasSuccessful` flag, use `setTimeout` delay, and only trigger creation if flag is false

---

## Visual Hierarchy

| State | Glow Intensity | Purpose |
|-------|----------------|---------|
| Handle hover | Medium | Discoverability |
| Dragging line | Strong (animated) | Active feedback |
| Permanent edge | Subtle | Visual definition |

---

## Verification Checklist

- [ ] Connection handles visible on task nodes (top and bottom dots)
- [ ] Source handle (bottom) shows blue glow on hover
- [ ] Target handle (top) shows green glow on hover
- [ ] Dragging line glows with pulsing animation
- [ ] Permanent edges have subtle blue glow
- [ ] Drag to empty space opens task creation modal
- [ ] New task created has parentTaskId set
- [ ] Normal task-to-task connections still work
