# Calendar Full-Surface Task Drag Fix

**Date**: December 3, 2025
**Status**: RESOLVED
**Commit**: `c9f247d` (included with debug log gating refactor)
**File**: `src/views/CalendarView.vue`

## Problem Description

Users could only drag calendar tasks from the top edge (first 30px of the task), not from the entire task surface. For multi-slot tasks (60+ minutes), clicking/dragging on the extended portion didn't work.

### User Report
> "it should be possible to drag a task inside the calendar from the entire surface of the task and not only the top edge"

## Root Cause Analysis

For a task at 10:00 with 60-minute duration:

1. **Task is a child of only the first time-slot** (slot at 10:00)
2. **Task height extends visually** into subsequent slots (10:30, 11:00) via CSS `height: calc(slotSpan * 30px)`
3. **Subsequent time-slots are sibling elements** with `pointer-events: auto`
4. **These sibling slots intercept pointer events** on the extended task area

### CSS Before Fix
```css
.time-slot:has(.slot-task) { pointer-events: none; }  /* Only first slot */
.time-slot:not(:has(.slot-task)) { pointer-events: auto; }  /* Subsequent slots intercept! */
```

### The Stacking Context Problem
The task's z-index (5) didn't help because:
- Z-index is relative to the task's parent (the first time-slot)
- Sibling time-slots are in different stacking contexts
- The extended task area was visually over sibling slots but events hit those slots first

## Solution

Elevate time-slots containing tasks to a higher stacking context so their child tasks render **ABOVE** subsequent time-slots.

### CSS Fix Applied (lines 1840-1846)
```css
/* CRITICAL: Slots with tasks let events pass through to children
   Also elevate stacking context so multi-slot tasks render ABOVE subsequent time-slots */
.time-slot:has(.slot-task) {
  pointer-events: none;
  position: relative;
  z-index: 10; /* Elevate above subsequent time-slots for full-surface drag */
}
```

### Why This Works

1. **`.time-slot:has(.slot-task)` now creates a stacking context** with `z-index: 10`
2. **The task (child) and its extended height** are part of this elevated stacking context
3. **Subsequent time-slots (without tasks)** remain at default z-index (lower)
4. **The task's entire visual area** is now ABOVE subsequent slots
5. **Combined with** `pointer-events: none` on the slot and `pointer-events: auto` on the task, drag works from anywhere

### Visual Diagram
```
Before Fix:                          After Fix:
┌─────────────────┐                  ┌─────────────────┐
│ 10:00 slot      │                  │ 10:00 slot      │ z-index: 10
│ ┌─────────────┐ │                  │ ┌─────────────┐ │
│ │ Task        │ │ ←─ drag works    │ │ Task        │ │ ←─ drag works
│ └─────────────│ │                  │ └─────────────│ │
├─────────────────┤                  │               │ │
│ 10:30 slot      │ ←─ intercepts!   │ │  (extended) │ │ ←─ NOW drag works!
│               │ │ (z-index issue)  │ └─────────────┘ │
├─────────────────┤                  ├─────────────────┤
│ 11:00 slot      │ ←─ intercepts!   │ 10:30 slot      │ z-index: default
└─────────────────┘                  ├─────────────────┤
                                     │ 11:00 slot      │ z-index: default
                                     └─────────────────┘
```

## Files Modified

| File | Changes |
|------|---------|
| `src/views/CalendarView.vue` | Added `position: relative; z-index: 10;` to `.time-slot:has(.slot-task)` |

## Testing Checklist

- [x] Create a 60+ minute task in calendar
- [x] Drag task from the TOP portion (within first slot) - works
- [x] Drag task from the MIDDLE portion (extends into second slot) - NOW WORKS
- [x] Drag task from the BOTTOM portion - NOW WORKS
- [x] Resize handles at top/bottom still work
- [x] Click anywhere on task to select - works
- [x] Existing functionality preserved (drop zones, create task by dragging)

## Stability Guarantees

### What This Fix Does NOT Change
- Drag ghost positioning system (from `useCalendarDrag.ts`)
- Drop target detection logic
- Task creation via slot dragging (`useCalendarDragCreate`)
- Side-by-side task rendering for overlapping events
- Resize handle functionality
- Week and Month view drag behavior

### CSS Specificity Maintained
The fix only adds properties to an existing rule, maintaining all existing cascade behavior:
- `.slot-task { pointer-events: auto; }` still applies
- `.slot-task { z-index: 5; }` still applies within the elevated parent
- Drag-active states still override as needed

## Related Fixes

| Date | Issue | Commit |
|------|-------|--------|
| Dec 2, 2025 | Side-by-side tasks | `9b36bdc` |
| Dec 2, 2025 | Drag ghost position | `9b36bdc` |
| Dec 2, 2025 | Resize artifacts | `55fb45d` |
| Dec 3, 2025 | Full-surface drag | `c9f247d` |

## Regression Prevention

A Playwright test should verify:
1. Multi-slot tasks can be dragged from any Y position within their bounds
2. Drag from top 30px works (original behavior)
3. Drag from middle section works (new behavior)
4. Drag from bottom section works (new behavior)

See: `e2e/calendar-drag-stability.spec.ts`
