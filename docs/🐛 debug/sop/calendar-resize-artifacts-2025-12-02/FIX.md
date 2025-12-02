# Calendar Resize Artifacts Fix

**Date**: December 2, 2025
**Status**: RESOLVED
**File**: `src/views/CalendarView.vue`

## Problem Description

Visual artifacts (`↳` continuation symbols) appeared when calendar tasks spanned multiple time slots (60+ minutes). The slot-based architecture was rendering tasks in EVERY slot they overlapped, showing full content in primary slots and `↳` indicators in continuation slots.

## Root Cause

The calendar uses a slot-based architecture where:
1. `getTasksForSlot(slot)` returns ALL events overlapping that slot
2. `isTaskPrimarySlot(slot, calEvent)` checks if it's the task's start slot
3. Previous implementation rendered continuation indicators (`↳`) for non-primary slots
4. CSS attempts to hide continuations with `display: none` were ineffective

## Solution

Only render tasks in their PRIMARY slot and use dynamic height to span multiple slots visually.

### Key Changes

1. **Wrap `v-for` in `<template>`** - Vue 3 evaluates `v-if` before `v-for` on the same element, causing undefined variable errors

2. **Add `v-if` on inner `<div>`** - Only render when `isTaskPrimarySlot(slot, calEvent)` is true

3. **Dynamic height styling** - Calculate height based on `slotSpan`: `height: ${(calEvent.slotSpan * 30) - 4}px`

4. **Remove continuation template** - Eliminated the entire `v-else` block with `↳` indicator

### Fixed Code (lines 150-208)

```vue
<!-- Tasks rendered INSIDE the slot - ONLY PRIMARY SLOTS (no continuation artifacts) -->
<template v-for="calEvent in getTasksForSlot(slot)" :key="`${calEvent.id}-${slot.slotIndex}`">
  <div
    v-if="isTaskPrimarySlot(slot, calEvent)"
    class="slot-task is-primary"
    :class="{
      'timer-active-event': timerStore.currentTaskId === calEvent.taskId,
      'dragging': isDragging && draggedEventId === calEvent.id,
      'is-hovered': hoveredEventId === calEvent.id
    }"
    :style="{
      height: `${(calEvent.slotSpan * 30) - 4}px`,
      minHeight: `${(calEvent.slotSpan * 30) - 4}px`,
      zIndex: 10
    }"
    @mouseenter="handleSlotTaskMouseEnter(calEvent.id)"
    @mouseleave="handleSlotTaskMouseLeave()"
    :data-duration="calEvent.duration"
    :data-task-id="calEvent.taskId"
    draggable="true"
    @dragstart="handleEventDragStart($event, calEvent)"
    @dragend="handleEventDragEnd($event, calEvent)"
    @click="handleEventClick($event, calEvent)"
    @dblclick="handleEventDblClick(calEvent)"
    @contextmenu.prevent="handleEventContextMenu($event, calEvent)"
  >
    <!-- CLEAN CALENDAR-ONLY DISPLAY -->
    <div class="calendar-task-content">
      <div class="calendar-task-title">{{ calEvent.title }}</div>
    </div>

    <!-- Resize handles and preview overlay... -->
  </div>
</template>
```

## Why Previous CSS Fixes Failed

- The handoff document mentioned `display: none` was applied but inspection showed `opacity: 0.7`
- CSS-based hiding was fundamentally flawed because:
  - Elements were still in DOM (affecting layout)
  - Event handlers still fired
  - Performance overhead of rendering hidden elements
- Template-level conditional rendering is the correct approach

## Vue 3 Technical Note

**Important**: In Vue 3, `v-if` is evaluated BEFORE `v-for` when on the same element:
```vue
<!-- WRONG - calEvent is undefined when v-if evaluates -->
<div v-for="calEvent in events" v-if="isValid(calEvent)">

<!-- CORRECT - Use template wrapper -->
<template v-for="calEvent in events">
  <div v-if="isValid(calEvent)">
</template>
```

## Verification

1. Create a task with 60+ minute duration in Calendar view
2. Task should display as single block spanning multiple time slots
3. No `↳` symbols should appear
4. Resize handles should work on the single block

## Related Files

- `src/views/CalendarView.vue` - Main template with fix
- `src/composables/calendar/useCalendarDayView.ts` - Contains `getTasksForSlot()` and `isTaskPrimarySlot()` functions
