# SOP: Separating Shift and Ctrl Selection Behavior in Canvas

**Document ID**: CANVAS-shift-ctrl-selection-separation
**Created**: January 7, 2026
**Related Bug**: BUG-008

---

## Problem Statement

Ctrl+click and Shift+click were treated identically in the canvas, both triggering the multi-select toggle behavior. This caused confusion because:
- **Shift** is reserved for rubber-band drag selection (Vue Flow's native behavior)
- **Ctrl** should toggle individual task selection in/out of multi-select

## Root Cause

In two files, the modifier check included `event.shiftKey`:

```javascript
// BAD - TaskNode.vue (line 306)
const isModifierClick = event.ctrlKey || event.metaKey || event.shiftKey

// BAD - useCanvasEvents.ts (line 62)
const isModifierClick = event.shiftKey || event.ctrlKey || event.metaKey
```

This conflicted with Vue Flow's `multi-selection-key-code="Shift"` setting in `CanvasView.vue`, which expects Shift for its internal selection behavior.

## Solution

Remove `event.shiftKey` from the modifier check in both locations:

### File 1: `src/components/canvas/TaskNode.vue`

```javascript
// GOOD - Only Ctrl/Cmd triggers our custom toggle
const isMultiSelectClick = event.ctrlKey || event.metaKey
```

### File 2: `src/composables/canvas/useCanvasEvents.ts`

```javascript
// GOOD - Only Ctrl/Cmd+click toggles group selection
const isMultiSelectClick = event.ctrlKey || event.metaKey
```

## Expected Behavior After Fix

| Action | Result |
|--------|--------|
| **Ctrl/Cmd + click on task** | Toggle task in/out of selection (our custom behavior) |
| **Shift + click on task** | Add task to selection (Vue Flow's native behavior) |
| **Shift + drag** | Rubber-band selection |
| **Click empty space** | Clear all selections |

## Key Insight

When implementing custom selection behavior that differs from Vue Flow's defaults:
1. Understand Vue Flow's `multi-selection-key-code` setting
2. Don't intercept the key code that Vue Flow expects
3. Use `event.stopPropagation()` on your custom handler to prevent Vue Flow from overriding

## Related Files

- `src/components/canvas/TaskNode.vue` - Task click handler
- `src/composables/canvas/useCanvasEvents.ts` - Pane click handler
- `src/views/CanvasView.vue` - Vue Flow configuration (`multi-selection-key-code="Shift"`)

## Testing

1. Ctrl+click multiple tasks to build selection
2. Ctrl+click a selected task - should deselect only that task
3. Shift+click tasks - should add to selection (Vue Flow behavior)
4. Shift+drag - should create rubber-band selection
5. Click empty canvas area - should clear all selections
