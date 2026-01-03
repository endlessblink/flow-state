# SOP: Calendar Drag & Drop Reference

**Category**: CALENDAR
**Status**: Active Reference
**Last Updated**: January 2026
**Merged From**: calendar-drag-and-drop-reactivity-fix, calendar-drag-fix-2025-12-01, calendar-full-surface-drag-2025-12-03

---

## Overview

Comprehensive reference for calendar drag-and-drop functionality including external drops (from Board/Canvas/Inbox), internal moves, resize operations, and full-surface task dragging.

---

## 1. Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/views/CalendarView.vue` | Main calendar component |
| `src/composables/calendar/useCalendarDayView.ts` | Day view drag handlers |
| `src/composables/calendar/useCalendarDrag.ts` | Unified drag system |
| `src/composables/calendar/useCalendarDragCreate.ts` | Task creation via drag |

### Data Flow

```
External Drag (Board/Canvas/Inbox)
    ↓
handleDragStart() - sets dataTransfer with taskId + source
    ↓
handleDragOver() - provides visual feedback
    ↓
handleDrop() - updates task.instances + legacy fields
    ↓
nextTick() - forces calendarEvents recomputation
```

---

## 2. External Drops (Board/Canvas/Inbox → Calendar)

### Problem Pattern

External drag sources couldn't drop on calendar time slots because:
1. `calendarEvents` computed property watched `task.instances`
2. Code only updated legacy `task.scheduledDate/time` fields
3. Vue reactivity didn't trigger recomputation

### Solution: Update Task Instances

```typescript
// Update the task instance (not just legacy fields)
const taskInstance = task.instances?.[0]
if (taskInstance) {
  taskInstance.scheduledDate = slot.date
  taskInstance.scheduledTime = timeStr
}

// Also update legacy fields for compatibility
taskStore.updateTask(taskId, {
  scheduledDate: slot.date,
  scheduledTime: timeStr
})

// Force Vue recomputation
await nextTick()
nextTick().then(() => calendarEvents.value)
```

### Vue Reactivity Patterns

```typescript
// ✅ CORRECT: Direct property modification (reactive)
taskInstance.scheduledDate = newValue

// ❌ WRONG: Object replacement (breaks reactivity)
taskInstance = {...taskInstance, scheduledDate: newValue}

// ✅ CORRECT: Array element modification (reactive)
task.instances[0].property = newValue

// ❌ WRONG: Array replacement (breaks references)
task.instances = [...task.instances]
```

---

## 3. Internal Calendar Moves

### Drag Within Calendar

When moving a task from one time slot to another:

```typescript
const handleEventDragStart = (event, taskId, instanceId) => {
  event.dataTransfer.setData('application/json', JSON.stringify({
    taskId,
    instanceId,
    source: 'calendar-event'
  }))
}
```

### Drop Handler

```typescript
const handleDrop = (event, slot) => {
  const data = JSON.parse(event.dataTransfer.getData('application/json'))

  if (data.source === 'calendar-event') {
    // Internal move - update instance directly
    const task = taskStore.getTask(data.taskId)
    const instance = task.instances?.find(i => i.id === data.instanceId)

    if (instance) {
      instance.scheduledDate = slot.date
      instance.scheduledTime = slot.time
    }
  }
}
```

---

## 4. Resize Operations

### CSS Requirements

```css
/* Base resize handle */
.resize-handle {
  position: absolute;  /* CRITICAL: Must be absolute */
  left: 0;
  right: 0;
  height: 8px;
  opacity: 0;
  pointer-events: none;
  z-index: 20;
}

.resize-handle.resize-top { top: 0; }
.resize-handle.resize-bottom { bottom: 0; }

/* Hover state - make visible and interactive */
.slot-task.is-primary:hover .resize-handle,
.slot-task.is-primary.is-hovered .resize-handle {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(99, 102, 241, 0.4) !important;
  transition: none !important;  /* Prevents animation delay */
}
```

### Common CSS Bug

**Problem**: Adding `position: relative` on hover breaks resize handles.

```css
/* ❌ BROKEN: This was causing issues */
.time-slot:hover .resize-handle {
  position: relative;  /* BREAKS absolute positioning! */
}
```

**Fix**: Remove any rules that change position from absolute.

### Resize Handler

```typescript
const startResize = (event, taskId, direction) => {
  // Store original values
  const originalTime = task.scheduledTime
  const originalDuration = task.estimatedDuration

  const handleMouseMove = (e) => {
    // Calculate new duration based on mouse position
    const deltaY = e.clientY - startY
    const deltaSlots = Math.round(deltaY / slotHeight)

    if (direction === 'bottom') {
      task.estimatedDuration = originalDuration + (deltaSlots * 30)
    } else {
      // Top resize changes start time
      task.scheduledTime = adjustTime(originalTime, deltaSlots)
    }
  }
}
```

---

## 5. Full-Surface Task Drag

### Problem

Multi-slot tasks (60+ minutes) could only be dragged from the top 30px, not the full task surface.

### Root Cause

```css
/* Task is child of first slot only */
.time-slot (10:00) → contains .slot-task
.time-slot (10:30) → sibling, intercepts pointer events
.time-slot (11:00) → sibling, intercepts pointer events
```

### Solution

Elevate time-slots containing tasks above subsequent slots:

```css
.time-slot:has(.slot-task) {
  pointer-events: none;
  position: relative;
  z-index: 10;  /* Elevate above subsequent time-slots */
}

.slot-task {
  pointer-events: auto;  /* Task receives events */
}
```

### Visual Diagram

```
Before Fix:                     After Fix:
┌─────────────────┐            ┌─────────────────┐
│ 10:00 slot      │            │ 10:00 slot      │ z-index: 10
│ ┌─────────────┐ │            │ ┌─────────────┐ │
│ │ Task        │ │ ← works    │ │ Task        │ │ ← works
│ └─────────────│ │            │ │             │ │
├─────────────────┤            │ │  (extended) │ │ ← NOW works
│ 10:30 slot      │ ← blocked  │ └─────────────┘ │
├─────────────────┤            ├─────────────────┤
│ 11:00 slot      │ ← blocked  │ 10:30 slot      │ z-index: default
└─────────────────┘            └─────────────────┘
```

---

## 6. Debugging Checklist

### When Drag Doesn't Work

- [ ] Check console for `🎯 CALENDAR DROP` logs
- [ ] Verify `dataTransfer.getData()` returns expected JSON
- [ ] Check if `task.instances` is being updated (not just legacy fields)
- [ ] Verify `calendarEvents` computed property recomputes

### When Resize Doesn't Work

- [ ] Check resize handle has `position: absolute`
- [ ] Verify hover state applies `pointer-events: auto`
- [ ] Check for CSS rules overriding position
- [ ] Verify `startResize()` is called (check console)

### Console Log Patterns

```
🎯 [CalendarDrag] handleEventDragStart called {...}
🎨 [CalendarDrag] Drag state activated {...}
📤 [CalendarDrag] Setting drag data: {...}
🔄 [CalendarDrag] handleDragOver called {...}
🎯 CALENDAR DROP: Task "..." dropped on ... at ...
🚀 [CalendarResize] Resize started {...}
🏁 [CalendarResize] Resize completed
```

---

## 7. Quick Reference

### Drag Data Format

```typescript
// External drag (from inbox/board/canvas)
{
  type: 'task',
  taskId: string,
  taskIds: string[],
  title: string,
  fromInbox?: boolean,
  source: 'inbox' | 'board' | 'canvas'
}

// Internal drag (within calendar)
{
  taskId: string,
  instanceId: string,
  source: 'calendar-event'
}
```

### Force UI Update Pattern

```typescript
// After any task instance modification
await nextTick()
nextTick().then(() => {
  calendarEvents.value  // Trigger reactive update
})
```

---

## 8. Related SOPs

- `reference/calendar-consolidation-initiative.md` - Full consolidation roadmap
- `CANVAS-group-drag-fix.md` - Similar drag patterns for canvas

---

**Key Insight**: Calendar drag issues usually stem from Vue reactivity - always update `task.instances` directly, not just legacy fields, and force recomputation with `nextTick()`.
