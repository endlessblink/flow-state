# SOP: Calendar Drag Inside Calendar Fix

**Date:** December 1, 2025
**Status:** Hover & Visibility Fixed, Resize Handler Working (Needs Manual Testing)
**Affected Files:** `src/views/CalendarView.vue`, `src/composables/calendar/useCalendarDayView.ts`

---

## Problem Description

Calendar daily view had broken functionality:
1. **Resize handles not appearing** on hover over calendar tasks
2. **Dragging top/bottom resize handles** not working
3. **Dragging tasks within calendar** (e.g., 9:00 AM → 2:00 PM) not working

User-reported symptoms:
- Hover over calendar task → resize handles NOT appearing at top/bottom
- Drag top resize handle → NOT working
- Drag bottom resize handle → NOT working
- Drag task from one time slot to another → NOT working

---

## Root Cause Analysis

### The Bug: CSS Position Override

**Location:** `src/views/CalendarView.vue` lines 1796-1801 (before fix)

```css
/* BROKEN RULE - This was causing the issue */
.time-slot:hover .resize-handle {
  pointer-events: auto;
  position: relative;  /* ← THIS BREAKS EVERYTHING */
  z-index: 10;
}
```

### Why This Broke Resize Handles

1. **Base CSS (correct):** `.resize-handle` has `position: absolute` + `top: 0` / `bottom: 0`
   - This positions handles at the top and bottom edges of the task element

2. **Broken hover rule:** When hovering `.time-slot` (parent container), it changed position to `relative`
   - With `position: relative`, handles enter normal document flow
   - `top: 0` and `bottom: 0` no longer position them at task edges
   - Handles become displaced and effectively invisible

3. **CSS Specificity Issue:**
   - `.time-slot:hover .resize-handle` = specificity 0,2,0 (20)
   - `.slot-task.is-primary:hover .resize-handle` = specificity 0,4,0 (40)
   - The higher specificity hover rule sets `opacity`/`pointer-events`/`background`
   - But it does NOT set `position`, so the broken `position: relative` still applies

### DOM Structure Context

```
.time-slot (hover triggers broken rule)
  └── .slot-task.is-primary
       └── .resize-handle.resize-top    (position: absolute → relative on hover)
       └── .resize-handle.resize-bottom (position: absolute → relative on hover)
```

---

## The Fix

### What Was Changed

**File:** `src/views/CalendarView.vue`

**Action:** Removed the entire broken CSS rule block (lines 1796-1801):

```css
/* REMOVED - was breaking resize handles */
/* Allow pointer events to pass through time slots when hovering over resize handles */
.time-slot:hover .resize-handle {
  pointer-events: auto;
  position: relative;
  z-index: 10;
}
```

### Correct CSS (Already Existed)

The following CSS rules were already correct and remain in place:

```css
/* Base resize handle styling (lines ~1685-1696) */
.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 8px;
  background: transparent;
  cursor: ns-resize;
  z-index: 20;
  opacity: 0;
  transition: all var(--duration-fast);
  pointer-events: none;
}

.resize-handle.resize-top {
  top: 0;
}

.resize-handle.resize-bottom {
  bottom: 0;
}

/* Hover state (lines ~1708-1712) */
.slot-task.is-primary:hover .resize-handle {
  opacity: 1;
  pointer-events: auto;
  background: rgba(99, 102, 241, 0.4);
}
```

---

## Verification Results

### After Fix - What Works

| Feature | Status | Evidence |
|---------|--------|----------|
| Resize handles in DOM | ✅ Working | Elements exist with correct classes |
| Resize handle positioning | ✅ Fixed | `position: absolute`, `top: 0px`, `bottom: 0px` |
| CSS hover rule | ✅ Correct | Sets `opacity: 1`, `pointerEvents: auto` |
| Drag within calendar | ✅ Working | Task moved from slot 18 (9:00) to slot 28 (14:00) |
| Drag from inbox to calendar | ✅ Working | Task instance created on drop |
| Resize handler triggered | ✅ Working | Console shows resize start/complete |

### After Fix - What Still Needs Work

| Feature | Status | Notes |
|---------|--------|-------|
| Visual resize handles on hover | ⚠️ Needs manual test | CSS :hover requires real mouse cursor |
| Actual resize functionality | ❌ Not working per user | Handler fires but resize may not apply |

---

## Key Files Reference

### CalendarView.vue CSS Structure

| Lines | Purpose |
|-------|---------|
| ~1557-1573 | `.slot-task` base styling |
| ~1685-1696 | `.resize-handle` base styling |
| ~1698-1706 | `.resize-handle.resize-top/bottom` positioning |
| ~1708-1712 | `.slot-task.is-primary:hover .resize-handle` hover state |
| ~~1796-1801~~ | **REMOVED** - broken `.time-slot:hover .resize-handle` rule |

### useCalendarDayView.ts Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `startResize()` | ~711-821 | Handles resize mousedown and mousemove |
| `handleEventDragStart()` | ~595-663 | Initiates drag with dataTransfer |
| `handleDrop()` | ~407-511 | Processes drop and updates task instances |
| `isTaskPrimarySlot()` | ~198-200 | Determines if slot shows full task content |

---

## Testing Methodology

### Automated Testing (Playwright)

```javascript
// Check resize handle CSS
const resizeTop = document.querySelector('.resize-handle.resize-top');
const styles = window.getComputedStyle(resizeTop);
// Verify: position === 'absolute', top === '0px'

// Check CSS hover rule exists
const sheets = document.styleSheets;
for (const sheet of sheets) {
  for (const rule of sheet.cssRules) {
    if (rule.selectorText?.includes('.slot-task.is-primary:hover .resize-handle')) {
      // Verify: opacity === '1', pointerEvents === 'auto'
    }
  }
}

// Test drag within calendar
const dragData = JSON.stringify({ taskId, source: 'calendar-event' });
// Dispatch dragstart, dragover, drop events
// Verify task moved to new slot
```

### Manual Testing Checklist

1. [ ] Navigate to Calendar view (Day mode)
2. [ ] Schedule a task from inbox to calendar
3. [ ] Hover over the scheduled task
4. [ ] Verify purple resize handles appear at top and bottom
5. [ ] Drag bottom handle down → duration should increase
6. [ ] Drag top handle up → start time should change
7. [ ] Drag task body to different time slot → task should move

---

## Console Debug Logs

When drag/resize is working, you should see these logs:

```
🎯 [CalendarDrag] handleEventDragStart called {taskId: ..., instanceId: ...}
🎨 [CalendarDrag] Drag state activated {isDragging: true, ...}
📤 [CalendarDrag] Setting drag data: {...}
🔄 [CalendarDrag] handleDragOver called {slotIndex: ..., slotTime: ...}
🎯 CALENDAR DROP: Task "..." dropped on ... at ...
🎯 CALENDAR DROP: Updated task instance ... to ... at ...
🔄 [CalendarDrag] Forced calendarEvents recomputation after drop

🚀 [CalendarResize] Resize started {taskId: ..., direction: ..., originalTime: ...}
🔄 [CalendarResize] Bottom resize: duration X → Y
🏁 [CalendarResize] Resize completed
```

---

## Related Issues

- Resize still not working visually - may need additional CSS or handler fixes
- Previous SOPs existed in git commit `bc2011c` but were deleted
- Related composable: `useCalendarDragCreate.ts` - handles new task creation via drag

---

## Next Steps for Resize Fix

1. Verify `startResize()` handler is actually being called on mousedown
2. Check if `pointer-events: auto` is applying on hover (may need explicit position override)
3. Consider adding `position: absolute !important` to hover state
4. Test resize handle z-index vs task content z-index
5. Verify mousedown event is not being blocked by other elements

---

## Additional Fixes (Session 2 - December 1, 2025)

### Issue: CSS `:hover` Not Triggering on Draggable Elements

The CSS `:hover` pseudo-class is unreliable on elements with `draggable="true"`. The resize handles weren't becoming visible even though the CSS rule was correct.

### Root Cause: Multiple Issues

1. **Variable Naming Collision**: In the template v-for loop, `event` was used as the loop variable, conflicting with JavaScript's `$event`
2. **Inline Event Handlers**: Inline handlers like `@mouseenter="hoveredEventId = event.id"` weren't working reliably
3. **CSS Transition Blocking**: The `transition: all var(--duration-fast)` on resize handles was preventing immediate opacity changes

### Fixes Applied

#### 1. Variable Rename (lines 147-235)
Changed `event` to `calEvent` in the v-for loop to avoid naming collision:
```vue
v-for="calEvent in getTasksForSlot(slot)"
```

#### 2. Method-Based Hover Handlers (lines 611-617)
Added explicit methods instead of inline handlers:
```typescript
const handleSlotTaskMouseEnter = (eventId: string) => {
  hoveredEventId.value = eventId
}
const handleSlotTaskMouseLeave = () => {
  hoveredEventId.value = null
}
```

#### 3. CSS Transition Fix (lines 1722-1731)
Added `!important` and disabled transitions on hover:
```css
.slot-task.is-primary:hover .resize-handle,
.slot-task.is-primary.is-hovered .resize-handle {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(99, 102, 241, 0.4) !important;
  transition: none !important;  /* Critical - prevents transition from blocking */
}
```

### Verification Results (Session 2)

| Feature | Status | Evidence |
|---------|--------|----------|
| Vue mouseenter handler | ✅ Working | `is-hovered` class added on mouseenter event |
| Resize handle opacity | ✅ Working | Changes from 0 to 1 when `is-hovered` class added |
| Resize handle pointer-events | ✅ Working | Changes from `none` to `auto` |
| startResize() called | ✅ Working | Console shows "Resize started" and "Resize completed" |

### What Needs Manual Testing

The resize functionality uses `requestAnimationFrame` which doesn't work well with Playwright synthetic events. Manual testing required to verify:
- Bottom resize handle drag extends duration
- Top resize handle drag changes start time

---

## Change Log

| Date | Change | Result |
|------|--------|--------|
| 2025-12-01 | Removed broken `.time-slot:hover .resize-handle` CSS rule | Drag within calendar now works |
| 2025-12-01 | Fixed variable naming collision (`event` → `calEvent`) | Vue event handlers work correctly |
| 2025-12-01 | Added method-based hover handlers | Hover tracking now reliable |
| 2025-12-01 | Added `transition: none !important` to hover state | Resize handles now visible instantly |
