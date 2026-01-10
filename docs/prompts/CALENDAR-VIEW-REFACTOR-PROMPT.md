# Calendar View Refactor Prompt

**Task ID**: TASK-192
**Priority**: P1
**Estimated Effort**: 16-24 hours
**Dependencies**: Follow patterns from TASK-191 (Board View Refactor)

---

## Context

You are refactoring the Calendar View system in a Vue 3 + TypeScript + Pinia application. The Calendar View currently scores **5.5/10** in a tech debt audit with critical issues including memory leaks, race conditions, and excessive console.log statements.

**Goal**: Fix memory leaks, eliminate console pollution, reduce complexity, and improve performance - WITHOUT breaking existing functionality.

---

## Current State (Problems to Fix)

### File Overview

| File | LOC | Issues |
|------|-----|--------|
| `src/views/CalendarView.vue` | 660 | 11 composables, memory leaks, 11 console statements |
| `src/composables/calendar/useCalendarDayView.ts` | 949 | **47 console.log**, triple-nested try-catch, race conditions |
| `src/composables/calendar/useCalendarDrag.ts` | 551 | **22 console.log**, complex drag logic |
| `src/composables/calendar/useCalendarWeekView.ts` | 408 | Duplicated overlap calculation |
| `src/composables/calendar/useCalendarMonthView.ts` | 137 | Minor type issues |
| `src/composables/calendar/useCalendarDateNavigation.ts` | 130 | OK |
| `src/composables/calendar/useCalendarInteractionHandlers.ts` | 146 | OK |
| `src/composables/calendar/useCalendarModals.ts` | 81 | 1 console.log |
| `src/composables/calendar/useCalendarNavigation.ts` | 92 | OK |
| `src/composables/calendar/useCalendarScroll.ts` | 81 | OK |
| `src/components/calendar/CalendarDayView.vue` | 562 | Props explosion (30+ props) |
| `src/components/calendar/CalendarWeekView.vue` | 439 | Duplicated overlap logic |
| `src/components/calendar/CalendarHeader.vue` | 358 | OK |
| `src/components/calendar/CalendarStatusOverlays.vue` | 291 | OK |
| `src/components/calendar/CalendarMonthView.vue` | 235 | OK |

**Total**: ~5,780 LOC across 15 files
**Console.log statements**: **82 total** (must be 0)

---

## Critical Issues (Must Fix)

### 1. Memory Leak - Arrow Functions in Event Listeners

**Location**: `CalendarView.vue:514-519`

```typescript
// ❌ CURRENT (MEMORY LEAK)
onMounted(() => {
  const calendarEl = document.querySelector('.calendar-main')
  if (calendarEl) {
    // Arrow functions CAN'T be removed!
    calendarEl.addEventListener('dragenter', (e: Event) => handleDragEnterCapture(e as DragEvent), true)
    calendarEl.addEventListener('dragover', (e: Event) => handleDragOverCapture(e as DragEvent), true)
    calendarEl.addEventListener('dragleave', (e: Event) => handleDragLeaveCapture(e as DragEvent), true)
    calendarEl.addEventListener('drop', (e: Event) => handleDropCapture(e as DragEvent), true)
  }
})

onUnmounted(() => {
  // This comment proves the leak is known!
  // "Note: Can't remove arrow functions added with addEventListener"
})
```

**Fix using AbortController**:
```typescript
// ✅ FIXED
let abortController: AbortController | null = null

onMounted(() => {
  abortController = new AbortController()
  const { signal } = abortController

  const calendarEl = document.querySelector('.calendar-main')
  if (calendarEl) {
    calendarEl.addEventListener('dragenter', handleDragEnterCapture, { capture: true, signal })
    calendarEl.addEventListener('dragover', handleDragOverCapture, { capture: true, signal })
    calendarEl.addEventListener('dragleave', handleDragLeaveCapture, { capture: true, signal })
    calendarEl.addEventListener('drop', handleDropCapture, { capture: true, signal })
  }
})

onUnmounted(() => {
  abortController?.abort() // Removes ALL listeners at once
  abortController = null
})

// Handler functions must be defined at module level (not inline arrows)
const handleDragEnterCapture = (e: DragEvent) => { /* ... */ }
const handleDragOverCapture = (e: DragEvent) => { /* ... */ }
const handleDragLeaveCapture = (e: DragEvent) => { /* ... */ }
const handleDropCapture = (e: DragEvent) => { /* ... */ }
```

### 2. Race Condition - Triple Update Mechanism

**Location**: `useCalendarDayView.ts:500-536`

```typescript
// ❌ CURRENT (RACE CONDITION)
// Updates task THREE ways for the same data:
taskStore.updateTask(taskId, { scheduledDate, scheduledTime })  // 1. Store update
instanceToUpdate.scheduledDate = slot.date                       // 2. Direct mutation
taskStore.updateTaskInstance(taskId, instanceToUpdate.id, { ... }) // 3. Instance update

await nextTick()
nextTick().then(() => { void calendarEvents.value })  // 4. Force recomputation
```

**Fix with single update**:
```typescript
// ✅ FIXED
// Single source of truth - store handles everything
await taskStore.updateTaskWithInstance(taskId, instanceId, {
  scheduledDate: slot.date,
  scheduledTime: timeStr
})
// Reactivity handles the rest automatically
```

### 3. Console.log Pollution (82 statements)

**Distribution**:
| File | Count |
|------|-------|
| useCalendarDayView.ts | 47 |
| useCalendarDrag.ts | 22 |
| CalendarView.vue | 11 |
| useCalendarModals.ts | 1 |
| useCalendarWeekView.ts | 1 |

**Action**: Remove ALL 82 console statements.

```bash
# Find them all
grep -rn "console\." src/views/CalendarView.vue src/composables/calendar/
```

### 4. Props Explosion in CalendarDayView

**Location**: `CalendarDayView.vue` receives 30+ props including 15+ method props

```typescript
// ❌ CURRENT
defineProps<{
  currentDate: Date
  tasks: Task[]
  calendarEvents: CalendarEvent[]
  // ... 27 more props including methods
  handleTaskClick: (task: Task) => void
  handleTaskDoubleClick: (task: Task) => void
  handleDragStart: (e: DragEvent, task: Task) => void
  // ... 12 more method props
}>()
```

**Fix using provide/inject or moving logic into component**:
```typescript
// ✅ FIXED - Move handlers INTO the component
const props = defineProps<{
  currentDate: Date
  tasks: Task[]
  calendarEvents: CalendarEvent[]
}>()

const emit = defineEmits<{
  'task-click': [task: Task]
  'task-edit': [task: Task]
  'task-delete': [taskId: string]
}>()

// Handlers defined locally, emit events up
const handleTaskClick = (task: Task) => {
  emit('task-click', task)
}
```

### 5. Duplicated Overlap Calculation

**Location**: Same 68-line function in both:
- `useCalendarDayView.ts`
- `useCalendarWeekView.ts`

**Fix**: Extract to shared utility:
```typescript
// src/utils/calendar/overlapCalculation.ts
export function calculateEventOverlaps(
  events: CalendarEvent[],
  slotHeight: number
): EventWithPosition[] {
  // Single implementation used by both day and week views
}
```

---

## Implementation Phases

### Phase 1: Console.log Removal (1-2 hours)

Remove all 82 console statements. This is the quickest win and reduces noise for debugging.

```bash
# Count before
grep -rn "console\." src/views/CalendarView.vue src/composables/calendar/ | wc -l

# After removal, should be 0
```

**Files to clean**:
1. `useCalendarDayView.ts` - Remove 47 statements
2. `useCalendarDrag.ts` - Remove 22 statements
3. `CalendarView.vue` - Remove 11 statements
4. `useCalendarModals.ts` - Remove 1 statement
5. `useCalendarWeekView.ts` - Remove 1 statement

### Phase 2: Fix Memory Leak (2-3 hours)

**File**: `CalendarView.vue`

1. Add AbortController at module level
2. Convert arrow function handlers to named functions
3. Use signal option in addEventListener
4. Call abort() in onUnmounted

**Implementation**:
```typescript
// At the top of script setup
let dragAbortController: AbortController | null = null

// Named handler functions (move out of onMounted)
const handleDragEnterCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  // existing logic
}

const handleDragOverCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  // existing logic
}

const handleDragLeaveCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  // existing logic
}

const handleDropCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  // existing logic
}

onMounted(() => {
  // ... existing code ...

  // Create AbortController for drag listeners
  dragAbortController = new AbortController()
  const { signal } = dragAbortController

  const calendarEl = document.querySelector('.calendar-main')
  if (calendarEl) {
    calendarEl.addEventListener('dragenter', handleDragEnterCapture, { capture: true, signal })
    calendarEl.addEventListener('dragover', handleDragOverCapture, { capture: true, signal })
    calendarEl.addEventListener('dragleave', handleDragLeaveCapture, { capture: true, signal })
    calendarEl.addEventListener('drop', handleDropCapture, { capture: true, signal })
  }
})

onUnmounted(() => {
  // ... existing cleanup ...

  // Abort all drag listeners
  dragAbortController?.abort()
  dragAbortController = null
})
```

### Phase 3: Fix Race Condition (3-4 hours)

**File**: `useCalendarDayView.ts`

The triple-update pattern around lines 500-536 needs consolidation.

**Current flow**:
1. `taskStore.updateTask()` - Updates task
2. Direct mutation of `instanceToUpdate` - Bypasses reactivity
3. `taskStore.updateTaskInstance()` - Redundant update
4. `nextTick` chain - Forcing recomputation

**New flow**:
1. Single `taskStore.updateTaskWithSchedule()` call
2. Let Vue reactivity handle UI updates

**Implementation**:

First, add a new store method if needed:
```typescript
// In tasks.ts store
async updateTaskWithSchedule(taskId: string, schedule: {
  scheduledDate: string
  scheduledTime: string
  instanceId?: string
}) {
  const task = this.tasks.find(t => t.id === taskId)
  if (!task) return

  // Update task scheduling
  task.scheduledDate = schedule.scheduledDate
  task.scheduledTime = schedule.scheduledTime

  // If instance exists, update it too
  if (schedule.instanceId && task.instances) {
    const instance = task.instances.find(i => i.id === schedule.instanceId)
    if (instance) {
      instance.scheduledDate = schedule.scheduledDate
      instance.scheduledTime = schedule.scheduledTime
    }
  }

  // Single persist call
  await this.persistTask(task)
}
```

Then simplify the drag handler:
```typescript
// In useCalendarDayView.ts
const handleCalendarDrop = async (slot: TimeSlot, taskId: string, source: string) => {
  const timeStr = formatTimeFromSlot(slot)

  await taskStore.updateTaskWithSchedule(taskId, {
    scheduledDate: slot.date,
    scheduledTime: timeStr,
    instanceId: getInstanceId(taskId)
  })

  // No manual nextTick or forced recomputation needed
}
```

### Phase 4: Extract Overlap Calculation (2-3 hours)

**Create**: `src/utils/calendar/overlapCalculation.ts`

```typescript
import type { CalendarEvent, EventPosition } from '@/types/calendar'

interface OverlapGroup {
  events: CalendarEvent[]
  maxOverlap: number
}

/**
 * Calculate overlap positions for calendar events
 * Used by both day and week views
 */
export function calculateEventOverlaps(
  events: CalendarEvent[],
  options: {
    slotHeight: number
    startHour?: number
    endHour?: number
  }
): Map<string, EventPosition> {
  const positions = new Map<string, EventPosition>()

  // Sort events by start time
  const sorted = [...events].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  )

  // Group overlapping events
  const groups: OverlapGroup[] = []
  // ... overlap detection logic ...

  // Calculate positions within each group
  for (const group of groups) {
    const width = 100 / group.maxOverlap
    group.events.forEach((event, index) => {
      positions.set(event.id, {
        left: `${index * width}%`,
        width: `${width}%`,
        top: calculateTop(event, options),
        height: calculateHeight(event, options)
      })
    })
  }

  return positions
}

function calculateTop(event: CalendarEvent, options: { slotHeight: number; startHour?: number }): string {
  // Implementation
}

function calculateHeight(event: CalendarEvent, options: { slotHeight: number }): string {
  // Implementation
}
```

**Update useCalendarDayView.ts**:
```typescript
import { calculateEventOverlaps } from '@/utils/calendar/overlapCalculation'

const eventPositions = computed(() =>
  calculateEventOverlaps(calendarEvents.value, { slotHeight: SLOT_HEIGHT })
)
```

**Update useCalendarWeekView.ts**:
```typescript
import { calculateEventOverlaps } from '@/utils/calendar/overlapCalculation'

const eventPositions = computed(() =>
  calculateEventOverlaps(weekEvents.value, { slotHeight: SLOT_HEIGHT })
)
```

### Phase 5: Reduce CalendarDayView Props (4-6 hours)

**Current**: 30+ props including 15+ method props
**Target**: <15 props, emit events instead of method props

**Step 1**: Identify which method props can become emits

```typescript
// ❌ CURRENT - Method props
handleTaskClick: (task: Task) => void
handleTaskDoubleClick: (task: Task) => void
handleDragStart: (e: DragEvent, task: Task) => void
handleContextMenu: (e: MouseEvent, task: Task) => void

// ✅ FIXED - Emit events
const emit = defineEmits<{
  'task-click': [task: Task]
  'task-double-click': [task: Task]
  'drag-start': [e: DragEvent, task: Task]
  'context-menu': [e: MouseEvent, task: Task]
}>()
```

**Step 2**: Move some logic INTO the component

Currently CalendarDayView receives computed values as props when it could compute them internally:
- `slotHeight` - Can be a constant or computed from view mode
- `timeSlots` - Can be computed from startHour/endHour props
- `currentTimePosition` - Can be computed from currentTime prop

**Step 3**: Use provide/inject for deep props

For props that need to go through multiple component levels:
```typescript
// In CalendarView.vue
const calendarConfig = {
  slotHeight: 60,
  startHour: 0,
  endHour: 24,
  // ...
}
provide('calendarConfig', calendarConfig)

// In CalendarDayView.vue
const config = inject('calendarConfig')
```

### Phase 6: Reduce useCalendarDayView.ts (4-6 hours)

**Current**: 949 LOC - too large for a single composable

**Split into smaller composables**:

```
src/composables/calendar/
├── useCalendarDayView.ts      # ~200 LOC - Main orchestrator
├── day/
│   ├── useDayViewEvents.ts    # ~150 LOC - Event rendering
│   ├── useDayViewDrag.ts      # ~200 LOC - Drag-drop logic
│   ├── useDayViewResize.ts    # ~150 LOC - Event resize
│   └── useDayViewTimeSlots.ts # ~100 LOC - Time slot generation
```

**Implementation pattern** (follow Board View):
```typescript
// useDayViewEvents.ts
interface DayViewEventsDeps {
  taskStore: ReturnType<typeof useTaskStore>
  currentDate: Ref<Date>
}

export function useDayViewEvents(deps: DayViewEventsDeps) {
  const { taskStore, currentDate } = deps

  const calendarEvents = computed(() => {
    // Event computation logic
  })

  return { calendarEvents }
}
```

---

## Verification Checklist

### After Each Phase

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Calendar loads correctly
- [ ] Day/Week/Month views render

### Full Manual Testing

- [ ] Navigate between day/week/month views
- [ ] Create task from calendar (click time slot)
- [ ] Drag task from inbox to calendar
- [ ] Drag task between time slots
- [ ] Resize task duration (drag bottom edge)
- [ ] Right-click context menu works
- [ ] Edit task modal opens/saves
- [ ] Delete task works
- [ ] Navigate between dates (prev/next/today)
- [ ] Current time indicator shows correctly
- [ ] Overlapping events display side-by-side
- [ ] Switch views, navigate away, return - no memory leak symptoms

### Memory Leak Verification

```javascript
// In browser DevTools Console:
// 1. Open Calendar view
// 2. Navigate away
// 3. Run: performance.memory.usedJSHeapSize
// 4. Navigate back to Calendar
// 5. Navigate away again
// 6. Run: performance.memory.usedJSHeapSize
// Memory should not grow significantly on repeated navigation
```

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Console.log statements | 82 | 0 |
| Memory leaks | 2 | 0 |
| Race conditions | 1 | 0 |
| useCalendarDayView.ts | 949 LOC | <400 LOC |
| CalendarDayView props | 30+ | <15 |
| Duplicated overlap logic | 2 files | 1 shared utility |
| Health Score | 5.5/10 | 7.5+/10 |

---

## Files to Create

- `src/utils/calendar/overlapCalculation.ts`
- `src/composables/calendar/day/useDayViewEvents.ts` (optional)
- `src/composables/calendar/day/useDayViewDrag.ts` (optional)
- `src/composables/calendar/day/useDayViewResize.ts` (optional)
- `src/composables/calendar/day/useDayViewTimeSlots.ts` (optional)

## Files to Modify

- `src/views/CalendarView.vue` - Memory leak fix, console removal
- `src/composables/calendar/useCalendarDayView.ts` - Race condition fix, console removal, split
- `src/composables/calendar/useCalendarDrag.ts` - Console removal
- `src/composables/calendar/useCalendarWeekView.ts` - Use shared overlap utility
- `src/composables/calendar/useCalendarModals.ts` - Console removal
- `src/components/calendar/CalendarDayView.vue` - Props reduction

## Do NOT Modify

- `src/stores/tasks.ts` - Only add helper method if needed
- Other views or unrelated components
- Calendar month view (already clean)

---

## Order of Operations

1. **Phase 1** - Remove all 82 console.log (quick win, reduces noise)
2. **Phase 2** - Fix memory leak (critical bug)
3. **Phase 3** - Fix race condition (data integrity)
4. **Phase 4** - Extract overlap calculation (deduplication)
5. **Phase 5** - Reduce CalendarDayView props (maintainability)
6. **Phase 6** - Split useCalendarDayView.ts (optional, if time permits)

Commit after each phase for easy rollback.

---

## Reference Patterns

### From Board View Refactor (TASK-191)
- `src/composables/board/useBoardState.ts` - Dependency injection
- `src/composables/board/useBoardActions.ts` - Centralized error handling
- `src/components/kanban/card/TaskCardBadges.vue` - Component extraction

### VueUse Patterns
```typescript
import { watchDebounced } from '@vueuse/core'
import { onClickOutside } from '@vueuse/core'
```

---

## IMPORTANT RULES

1. **Fix memory leak FIRST** - This is a critical bug affecting production
2. **Remove console.log aggressively** - 82 → 0
3. **Do NOT break existing functionality** - Test after each change
4. **One phase at a time** - Complete, test, commit
5. **Update MASTER_PLAN.md** - Mark progress as you go
6. **Commit after each phase** - Small, reversible commits

---

## Getting Started

```bash
# 1. Create a new branch
git checkout -b refactor/calendar-view-TASK-192

# 2. Verify current state
npm run dev
# Test calendar functionality

# 3. Count console.log before
grep -rn "console\." src/views/CalendarView.vue src/composables/calendar/ | wc -l
# Should be ~82

# 4. Start with Phase 1 (console removal)
# Remove all console.log statements

# 5. Verify build
npm run build
npm run lint

# 6. Commit phase 1
git add .
git commit -m "refactor(calendar): remove 82 console.log statements (TASK-192 Phase 1)"
```

Good luck!
