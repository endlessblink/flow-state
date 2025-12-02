# Calendar Side-by-Side Tasks and Drag Ghost Position Fix

**Date**: December 2, 2025
**Status**: RESOLVED
**Commit**: `9b36bdc` - fix: Calendar side-by-side tasks and drag ghost position tracking

## Problem Description

Two related calendar issues were reported:

### Bug 1: Tasks Overlap Instead of Side-by-Side
When multiple tasks were scheduled at the same time, they visually overlapped instead of displaying side-by-side (like Google Calendar behavior).

### Bug 2: Drag Ghost at Wrong Position
When dragging a task from the sidebar/inbox to the calendar, the drag ghost preview appeared at the top of the calendar instead of following the mouse cursor position.

## Root Cause Analysis

### Bug 1: Side-by-Side Rendering
- The overlap calculation algorithm (`calculateOverlappingPositions()`) already existed in `useCalendarCore.ts`
- It correctly assigned `column` and `totalColumns` values to overlapping events
- **Problem**: The Day View template IGNORED this data - tasks rendered with no left/width positioning
- Week View used this data via `getWeekEventStyle()`, but Day View had no equivalent

### Bug 2: Drag Ghost Position
- Ghost used CSS Grid positioning (`gridRow`)
- `handleDragOver` event only fired when mouse was directly over `.time-slot` elements
- When mouse was over gaps, drag image, or non-drop-target elements, ghost position became stale
- No document-level tracking to continuously update position

## Solution

### Bug 1 Fix: Add `getSlotTaskStyle()` Function

Added to `src/views/CalendarView.vue` (~line 648):

```typescript
// Compute positioning style for slot tasks (handles overlapping tasks side-by-side)
const getSlotTaskStyle = (calEvent: any) => {
  const baseHeight = (calEvent.slotSpan * 30) - 4

  // If no overlap (totalColumns is 1 or undefined), use normal flow with full width
  if (!calEvent.totalColumns || calEvent.totalColumns <= 1) {
    return {
      height: `${baseHeight}px`,
      minHeight: `${baseHeight}px`,
      zIndex: 10
    }
  }

  // Calculate width and position for overlapping events (like Google Calendar)
  const gapPercent = 1 // 1% gap between columns
  const totalGaps = calEvent.totalColumns - 1
  const availableWidth = 100 - (totalGaps * gapPercent)
  const widthPercentage = availableWidth / calEvent.totalColumns
  const leftPercentage = (widthPercentage + gapPercent) * (calEvent.column || 0)

  return {
    position: 'absolute' as const,
    top: '2px',
    height: `${baseHeight}px`,
    minHeight: `${baseHeight}px`,
    width: `calc(${widthPercentage}% - 4px)`,
    left: `calc(${leftPercentage}% + 2px)`,
    zIndex: 10 + (calEvent.column || 0) // Later columns render on top
  }
}
```

**Template Update** (~line 153):
```vue
<div v-if="isTaskPrimarySlot(slot, calEvent)"
  class="slot-task is-primary"
  :class="{ ..., 'has-overlap': calEvent.totalColumns > 1 }"
  :style="getSlotTaskStyle(calEvent)"
```

**CSS Addition** (~line 1550):
```css
/* Overlapping tasks - remove margins when positioned absolutely */
.slot-task.has-overlap {
  margin: 0;
}

/* Ensure time slots can contain absolutely positioned children */
.time-slot {
  overflow: visible;
}
```

### Bug 2 Fix: Document-Level Drag Tracking

Added to `src/composables/calendar/useCalendarDrag.ts` (after line ~53):

```typescript
let documentDragHandler: ((e: DragEvent) => void) | null = null

/**
 * Calculate slot index from mouse Y position relative to slots container
 */
const calculateSlotFromMouseY = (clientY: number): number => {
  const container = document.querySelector('.slots-container') as HTMLElement
  if (!container) return dragGhost.value.slotIndex

  const rect = container.getBoundingClientRect()
  const scrollTop = container.scrollTop || 0
  const SLOT_HEIGHT = 30

  const relativeY = clientY - rect.top + scrollTop
  const slotIndex = Math.floor(relativeY / SLOT_HEIGHT)
  return Math.max(0, Math.min(47, slotIndex))
}

/**
 * Start document-level drag tracking for smooth ghost updates
 */
const startDocumentDragTracking = () => {
  if (documentDragHandler) return

  documentDragHandler = (e: DragEvent) => {
    if (!dragGhost.value.visible) return
    const newSlotIndex = calculateSlotFromMouseY(e.clientY)
    if (newSlotIndex !== dragGhost.value.slotIndex) {
      dragGhost.value.slotIndex = newSlotIndex
    }
  }

  document.addEventListener('dragover', documentDragHandler, { capture: true, passive: true })
}

/**
 * Stop document-level drag tracking
 */
const stopDocumentDragTracking = () => {
  if (documentDragHandler) {
    document.removeEventListener('dragover', documentDragHandler, { capture: true })
    documentDragHandler = null
  }
}
```

**Integration Points**:
- `handleDragEnter`: Call `startDocumentDragTracking()` after setting ghost visible
- `handleDragEnd`: Call `stopDocumentDragTracking()` at start
- `clearDragState`: Call `stopDocumentDragTracking()` at start

**Ghost Template Update** (`CalendarView.vue` ~line 122):
```vue
<!-- Changed from gridRow to absolute positioning -->
<div v-if="dragGhost.visible" class="ghost-preview-inline" :style="{
  position: 'absolute',
  top: `${dragGhost.slotIndex * 30}px`,
  height: `${Math.ceil(dragGhost.duration / 30) * 30}px`,
  left: '4px',
  right: '4px',
  zIndex: 50
}">
```

## Key Insights

### Why Existing Algorithm Was Unused
The `calculateOverlappingPositions()` function in `useCalendarCore.ts` was already calculating perfect column assignments for overlapping events. However, the Day View template simply ignored this data - it rendered all tasks at full width with no positioning. The Week View already used this via `getWeekEventStyle()`, demonstrating the algorithm worked correctly.

### Why Document-Level Tracking
The HTML5 Drag and Drop API fires `dragover` events on the element directly under the cursor. When dragging, the cursor is often over the drag image itself or gaps between elements. By using a document-level listener with `capture: true`, we intercept all dragover events regardless of target, enabling continuous ghost position updates.

## Files Modified

| File | Changes |
|------|---------|
| `src/views/CalendarView.vue` | Added `getSlotTaskStyle()`, updated task template, updated ghost template, added CSS |
| `src/composables/calendar/useCalendarDrag.ts` | Added document drag tracking functions and lifecycle integration |

## Verification

Tested with Playwright:
1. Created two tasks at the same time slot
2. Verified tasks display side-by-side (49.5% width each with gap)
3. Dragged task from sidebar to calendar
4. Verified ghost follows mouse cursor position smoothly
5. Verified existing drag-within-calendar still works
6. Verified resize handles still work

## Behavior: "Push Aside" (User Choice)

When tasks overlap:
- **Automatic column recalculation** - `calculateOverlappingPositions()` runs on state change
- **Side-by-side display** - Overlapping tasks get assigned different columns automatically
- **No blocking** - Users can freely schedule tasks; layout adjusts dynamically
- **Like Google Calendar** - Consistent with expected calendar behavior

## Related Files

- `src/composables/useCalendarCore.ts` - Contains `calculateOverlappingPositions()` algorithm
- `src/composables/calendar/useCalendarDayView.ts` - Day view composable
- `docs/🐛 debug/sop/calendar-consolidation/phase-2-unified-drag-system.md` - Related drag system docs
