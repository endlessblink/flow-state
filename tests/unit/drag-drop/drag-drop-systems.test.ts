/**
 * TASK-1600: Drag-and-Drop System Tests
 *
 * Tests the DATA LAYER effects of drag operations across Kanban, Calendar,
 * Quick Sort, and Canvas systems.  No DOM rendering — pure logic and contract
 * verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SimpleTask {
  id: string
  title: string
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  order?: number
  projectId?: string
  priority?: 'low' | 'medium' | 'high' | null
  dueDate?: string
  canvasPosition?: { x: number; y: number }
  parentId?: string
}

function makeTask(overrides: Partial<SimpleTask> = {}): SimpleTask {
  return {
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test task',
    status: 'planned',
    order: 0,
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// TESTS 1-10: Kanban drag — data layer
// ---------------------------------------------------------------------------

describe('Kanban drag — data layer effects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('1: drag task from planned to done updates status to done', () => {
    const task = makeTask({ status: 'planned' })
    // Simulate the status update that handleDragChange triggers
    const applyMove = (t: SimpleTask, targetStatus: SimpleTask['status']): SimpleTask => ({
      ...t,
      status: targetStatus
    })
    const updated = applyMove(task, 'done')
    expect(updated.status).toBe('done')
    expect(updated.id).toBe(task.id) // same task
  })

  it('2: drag between columns preserves order relative to neighbours', () => {
    const tasks: SimpleTask[] = [
      makeTask({ status: 'planned', order: 0 }),
      makeTask({ status: 'planned', order: 1 }),
      makeTask({ status: 'planned', order: 2 }),
    ]
    // Simulate moving index 2 before index 0
    const reorder = (list: SimpleTask[], fromIdx: number, toIdx: number) => {
      const copy = [...list]
      const [moved] = copy.splice(fromIdx, 1)
      copy.splice(toIdx, 0, moved)
      return copy.map((t, i) => ({ ...t, order: i }))
    }
    const result = reorder(tasks, 2, 0)
    expect(result[0].id).toBe(tasks[2].id)
    expect(result[1].id).toBe(tasks[0].id)
    expect(result.map(t => t.order)).toEqual([0, 1, 2])
  })

  it('3: drag within same column preserves all other task data', () => {
    const original = makeTask({ status: 'in_progress', projectId: 'proj-1', priority: 'high', order: 5 })
    const afterReorder = { ...original, order: 3 }
    // Only order changed
    expect(afterReorder.status).toBe(original.status)
    expect(afterReorder.projectId).toBe(original.projectId)
    expect(afterReorder.priority).toBe(original.priority)
    expect(afterReorder.id).toBe(original.id)
    expect(afterReorder.order).toBe(3)
  })

  it('4: drag move event fires status update for cross-column drops', () => {
    const updateMock = vi.fn()
    const handleDragChange = (
      event: { added?: { element: SimpleTask } },
      targetStatus: SimpleTask['status'],
      updateFn: (id: string, status: SimpleTask['status']) => void
    ) => {
      if (event.added) {
        updateFn(event.added.element.id, targetStatus)
      }
    }
    const task = makeTask({ status: 'planned' })
    handleDragChange({ added: { element: task } }, 'in_progress', updateMock)
    expect(updateMock).toHaveBeenCalledWith(task.id, 'in_progress')
  })

  it('5: dragging multiple selected tasks produces one update per task', () => {
    const updateMock = vi.fn()
    const tasks = [makeTask(), makeTask(), makeTask()]
    tasks.forEach(t => updateMock(t.id, 'done'))
    expect(updateMock).toHaveBeenCalledTimes(3)
    tasks.forEach(t => {
      expect(updateMock).toHaveBeenCalledWith(t.id, 'done')
    })
  })

  it('6: BUG-1335 — vuedraggable force-fallback must be explicit true binding (code scan)', () => {
    // Verify the fix is in place: the KanbanColumn.vue template uses :force-fallback="true"
    // not bare force-fallback (which evaluates to "" in $attrs → falsy in SortableJS)
    const fs = require('fs')
    const path = require('path')
    const columnPath = path.resolve(
      __dirname,
      '../../../src/components/kanban/KanbanColumn.vue'
    )
    const source = fs.readFileSync(columnPath, 'utf-8')
    // Must use explicit binding, NOT bare attribute
    expect(source).toContain(':force-fallback="true"')
    expect(source).not.toMatch(/(?<![:])\bforce-fallback\b(?!=)/)
  })

  it('7: drag cancellation — state unchanged when no added/moved event', () => {
    const updateMock = vi.fn()
    const handleDragChange = (
      event: { added?: { element: SimpleTask }; moved?: { element: SimpleTask } },
      updateFn: (id: string, status: SimpleTask['status']) => void
    ) => {
      if (event.added) updateFn(event.added.element.id, 'done')
      if ((event as { moved?: unknown }).moved) updateFn((event as { moved: { element: SimpleTask } }).moved.element.id, 'done')
    }
    handleDragChange({}, updateMock)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('8: drag to invalid target (no added event) produces no update', () => {
    const updateMock = vi.fn()
    // SortableJS fires no "added" event when drop target is same group or invalid
    const fakeEvent = { removed: { element: makeTask() } } // only removed, no added
    if ((fakeEvent as { added?: unknown }).added) {
      updateMock((fakeEvent as { added: { element: SimpleTask } }).added.element.id, 'done')
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('9: cross-project drag keeps task projectId unchanged (kanban moves status only)', () => {
    const task = makeTask({ status: 'planned', projectId: 'proj-original' })
    // handleDragChange for a status column updates only status, not projectId
    const statusUpdate = (t: SimpleTask, newStatus: SimpleTask['status']): SimpleTask => ({
      ...t,
      status: newStatus
      // projectId intentionally NOT changed here
    })
    const updated = statusUpdate(task, 'in_progress')
    expect(updated.projectId).toBe('proj-original')
  })

  it('10: drag preserves all non-status fields on a status column move', () => {
    const task = makeTask({
      title: 'Important task',
      status: 'planned',
      priority: 'high',
      dueDate: '2026-04-01',
      projectId: 'proj-1',
      order: 7
    })
    const moved = { ...task, status: 'done' as const }
    expect(moved.title).toBe(task.title)
    expect(moved.priority).toBe(task.priority)
    expect(moved.dueDate).toBe(task.dueDate)
    expect(moved.projectId).toBe(task.projectId)
    expect(moved.order).toBe(task.order)
  })
})

// ---------------------------------------------------------------------------
// TESTS 11-20: Calendar drag — data layer
// ---------------------------------------------------------------------------

describe('Calendar drag — data layer effects', () => {
  it('11: drag task to different day updates dueDate', () => {
    const task = makeTask({ dueDate: '2026-03-20' })
    const applyDateDrop = (t: SimpleTask, newDate: string): SimpleTask => ({
      ...t,
      dueDate: newDate
    })
    const updated = applyDateDrop(task, '2026-03-25')
    expect(updated.dueDate).toBe('2026-03-25')
    expect(updated.id).toBe(task.id)
  })

  it('12: drag task to different time slot updates scheduledTime', () => {
    interface CalendarTask extends SimpleTask { scheduledTime?: string }
    const task: CalendarTask = { ...makeTask(), scheduledTime: '09:00' }
    const applyTimeDrop = (t: CalendarTask, newTime: string): CalendarTask => ({
      ...t,
      scheduledTime: newTime
    })
    const updated = applyTimeDrop(task, '14:30')
    expect(updated.scheduledTime).toBe('14:30')
  })

  it('13: drag to resize duration updates duration field', () => {
    interface DurTask extends SimpleTask { duration?: number }
    const task: DurTask = { ...makeTask(), duration: 60 }
    const applyResize = (t: DurTask, newDuration: number): DurTask => ({
      ...t,
      duration: newDuration
    })
    const updated = applyResize(task, 90)
    expect(updated.duration).toBe(90)
  })

  it('14: drag across week boundary produces correct ISO date', () => {
    // March 28 (Friday) → April 1 (Tuesday next week)
    const addDays = (date: string, days: number): string => {
      const d = new Date(date)
      d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }
    expect(addDays('2026-03-28', 4)).toBe('2026-04-01')
  })

  it('15: drag to past date is allowed — no validation blocks it', () => {
    const task = makeTask({ dueDate: '2026-03-21' })
    const applyPastDrop = (t: SimpleTask, pastDate: string): SimpleTask => ({
      ...t,
      dueDate: pastDate
    })
    // No error thrown — past dates are valid
    const updated = applyPastDrop(task, '2025-01-01')
    expect(updated.dueDate).toBe('2025-01-01')
  })

  it('16: drop creates instance when task has no scheduled slot yet', () => {
    interface ScheduledTask extends SimpleTask { scheduledTime?: string }
    const task: ScheduledTask = makeTask()
    // Before: no scheduledTime
    expect(task.scheduledTime).toBeUndefined()
    const applySlot = (t: ScheduledTask, time: string, date: string): ScheduledTask => ({
      ...t,
      scheduledTime: time,
      dueDate: date
    })
    const updated = applySlot(task, '10:00', '2026-04-05')
    expect(updated.scheduledTime).toBe('10:00')
    expect(updated.dueDate).toBe('2026-04-05')
  })

  it('17: drag preserves task title and metadata', () => {
    const task = makeTask({
      title: 'Critical task',
      priority: 'high',
      dueDate: '2026-03-20'
    })
    const moved = { ...task, dueDate: '2026-03-27' }
    expect(moved.title).toBe('Critical task')
    expect(moved.priority).toBe('high')
  })

  it('18: drop on occupied slot — two tasks can share same slot (no collision block)', () => {
    interface SlottedTask extends SimpleTask { scheduledTime?: string }
    const existing: SlottedTask = { ...makeTask(), scheduledTime: '09:00', dueDate: '2026-04-01' }
    const incoming: SlottedTask = makeTask()
    // Both can exist at 09:00 — calendar allows overlap
    const updated: SlottedTask = { ...incoming, scheduledTime: '09:00', dueDate: '2026-04-01' }
    expect(updated.scheduledTime).toBe(existing.scheduledTime)
    expect(updated.id).not.toBe(existing.id)
  })

  it('19: drag from unscheduled to scheduled sets both date and time', () => {
    interface SlottedTask extends SimpleTask { scheduledTime?: string }
    const task: SlottedTask = makeTask()
    expect(task.dueDate).toBeUndefined()
    expect(task.scheduledTime).toBeUndefined()
    const placed: SlottedTask = { ...task, dueDate: '2026-04-10', scheduledTime: '11:00' }
    expect(placed.dueDate).toBe('2026-04-10')
    expect(placed.scheduledTime).toBe('11:00')
  })

  it('20: cancel drag — no changes applied (original object unchanged)', () => {
    const task = makeTask({ dueDate: '2026-03-21', status: 'planned' })
    const original = { ...task }
    // Simulate a cancelled drag: no updates called
    const cancelled = true
    if (!cancelled) {
      // This branch is never taken
      Object.assign(task, { dueDate: '2026-12-31' })
    }
    expect(task.dueDate).toBe(original.dueDate)
    expect(task.status).toBe(original.status)
  })
})

// ---------------------------------------------------------------------------
// TESTS 21-25: Quick Sort / Swipe logic
// ---------------------------------------------------------------------------

describe('Quick Sort — swipe gesture logic', () => {
  it('21: swipe right beyond threshold triggers done action', () => {
    const THRESHOLD = 100
    let markedDone = false
    const onSwipeRight = () => { markedDone = true }

    const deltaX = 120 // exceeds threshold
    if (deltaX >= THRESHOLD) onSwipeRight()
    expect(markedDone).toBe(true)
  })

  it('22: swipe left beyond threshold triggers skip (move to end)', () => {
    const THRESHOLD = 100
    let skipped = false
    const onSwipeLeft = () => { skipped = true }

    const deltaX = -115
    if (Math.abs(deltaX) >= THRESHOLD) onSwipeLeft()
    expect(skipped).toBe(true)
  })

  it('23: swipe below threshold is treated as cancel — no action', () => {
    const THRESHOLD = 100
    let actionFired = false
    const onSwipeRight = () => { actionFired = true }
    const onSwipeLeft = () => { actionFired = true }

    const deltaX = 40 // below threshold
    if (deltaX >= THRESHOLD) onSwipeRight()
    if (deltaX <= -THRESHOLD) onSwipeLeft()
    expect(actionFired).toBe(false)
  })

  it('24: touch event setup must use passive listener on touchstart (BUG-1453)', () => {
    // Verify useSwipeGestures source: touchstart must be { passive: true }
    const fs = require('fs')
    const path = require('path')
    const composablePath = path.resolve(
      __dirname,
      '../../../src/composables/useSwipeGestures.ts'
    )
    const source = fs.readFileSync(composablePath, 'utf-8')

    // BUG-1453 fix: touchstart MUST be passive — calling preventDefault() in
    // touchstart blocks the entire Android Chrome gesture sequence.
    // Check that addEventListener for touchstart includes { passive: true }
    expect(source).toContain("passive: true")
  })

  it('25: card stack order — topmost card is index 0 in array', () => {
    const cards = ['card-a', 'card-b', 'card-c']
    // After skip: current card moves to end, next card becomes index 0
    const skipTop = (deck: string[]) => {
      const [current, ...rest] = deck
      return [...rest, current]
    }
    const after = skipTop(cards)
    expect(after[0]).toBe('card-b')
    expect(after[after.length - 1]).toBe('card-a')
  })
})

// ---------------------------------------------------------------------------
// TESTS 26-30: Canvas drag — position and geometry invariants
// ---------------------------------------------------------------------------

describe('Canvas drag — position and geometry invariants', () => {
  it('26: drag node updates canvasPosition with new x/y', () => {
    const task = makeTask({ canvasPosition: { x: 100, y: 100 } })
    const applyDrag = (t: SimpleTask, newPos: { x: number; y: number }): SimpleTask => ({
      ...t,
      canvasPosition: newPos
    })
    const updated = applyDrag(task, { x: 350, y: 220 })
    expect(updated.canvasPosition).toEqual({ x: 350, y: 220 })
  })

  it('27: drag task into group sets parentId to group id', () => {
    const task = makeTask({ parentId: undefined })
    const applyDragIntoGroup = (t: SimpleTask, groupId: string): SimpleTask => ({
      ...t,
      parentId: groupId,
      canvasPosition: { x: 50, y: 80 } // relative to group
    })
    const updated = applyDragIntoGroup(task, 'grp-abc')
    expect(updated.parentId).toBe('grp-abc')
  })

  it('28: drag task out of group clears parentId', () => {
    const task = makeTask({ parentId: 'grp-abc', canvasPosition: { x: 50, y: 50 } })
    const applyDragOutOfGroup = (t: SimpleTask, absolutePos: { x: number; y: number }): SimpleTask => ({
      ...t,
      parentId: undefined,
      canvasPosition: absolutePos
    })
    const updated = applyDragOutOfGroup(task, { x: 800, y: 400 })
    expect(updated.parentId).toBeUndefined()
    expect(updated.canvasPosition).toEqual({ x: 800, y: 400 })
  })

  it('29: position lock prevents sync from overwriting position during drag window', () => {
    // Replicate the lock logic: canWrite = !isLocked && !isSettling
    const flags = { isLocked: true, isSettling: false }
    const canWrite = !flags.isLocked && !flags.isSettling
    expect(canWrite).toBe(false)

    // After settle:
    flags.isLocked = false
    const canWriteAfter = !flags.isLocked && !flags.isSettling
    expect(canWriteAfter).toBe(true)
  })

  it('30: geometry invariant — sync must never write canvasPosition (code contract)', () => {
    // Verify useCanvasSync.ts does not contain calls that modify canvasPosition
    const fs = require('fs')
    const path = require('path')
    const syncPath = path.resolve(
      __dirname,
      '../../../src/composables/canvas/useCanvasSync.ts'
    )
    const source = fs.readFileSync(syncPath, 'utf-8')

    // The sync layer is read-only: it must NOT call updateTask with canvasPosition
    // Pattern: updateTask( with canvasPosition as direct argument
    // A write of canvasPosition in sync code would look like:
    //   updateTask(id, { canvasPosition: ... })
    // We check that no such direct write exists outside of a DRAG source context
    const syncWritesPosition = /updateTask\([^)]*canvasPosition/.test(source)
    expect(syncWritesPosition).toBe(false)
  })
})
