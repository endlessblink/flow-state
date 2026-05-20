/**
 * TASK-1785 Push 2: ripple skip-protect.
 *
 * The actual Shift+drag gesture needs a real browser (synthetic HTML5 DnD with
 * shiftKey is unreliable), so this proves the data-layer contract instead:
 * after Shift+dragstart and a dragover that yields a positive delta, the live
 * ghost-offset map (the exposed API) must contain the unlocked later task's
 * instance but never the locked one's — i.e. ripple skips locked tasks.
 *
 * The pure delta/midnight math is covered separately in calendar/rippleShift.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const DAY = '2026-05-21'

function makeTask(id: string, time: string, calendarLocked = false) {
  return {
    id,
    title: `Task ${id}`,
    deletedAt: undefined,
    calendarLocked,
    priority: null,
    status: 'todo',
    instances: [{ id: `inst-${id}`, scheduledDate: DAY, scheduledTime: time, duration: 60 }],
  }
}

describe('useCalendarDayView — ripple lock skip-protect', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetModules()
  })

  async function loadComposable(rawTasks: ReturnType<typeof makeTask>[]) {
    vi.doMock('@/stores/tasks', () => ({
      useTaskStore: () => ({ _rawTasks: rawTasks }),
      getTaskInstances: (task: { instances?: unknown[] }) => task.instances ?? [],
    }))
    vi.doMock('@/stores/timer', () => ({
      useTimerStore: () => ({ currentTaskId: null, isTimerActive: false }),
    }))
    vi.doMock('@/composables/useCalendarCore', () => ({
      useCalendarCore: () => ({
        getPriorityColor: () => '#000',
        getDateString: (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      }),
    }))
    vi.doMock('@/composables/useDragAndDrop', () => ({
      useDragAndDrop: () => ({
        isDragging: ref(false),
        startDrag: vi.fn(),
        endDrag: vi.fn(),
      }),
    }))

    const { useCalendarDayView } = await import('@/composables/calendar/useCalendarDayView')
    return useCalendarDayView(ref(new Date(`${DAY}T00:00:00`)), ref(null))
  }

  function dragStart(id: string, time: string, shiftKey = true) {
    const [h, m] = time.split(':').map(Number)
    const startTime = new Date(`${DAY}T00:00:00`)
    startTime.setHours(h, m, 0, 0)
    const calendarEvent = {
      id: `inst-${id}`,
      taskId: id,
      instanceId: `inst-${id}`,
      title: `Task ${id}`,
      startTime,
    }
    const dragEvent = { shiftKey, dataTransfer: { setData: vi.fn(), effectAllowed: '' } } as unknown as DragEvent
    return { dragEvent, calendarEvent }
  }

  // A later slot that yields a positive delta from the dragged task's origin.
  function slotAt(hour: number) {
    return { id: `${DAY}-${hour}-0`, hour, minute: 0, slotIndex: hour * 2, date: DAY }
  }

  it('ghost offsets cover the unlocked later task but skip the locked one', async () => {
    const tasks = [
      makeTask('dragged', '10:00'),
      makeTask('locked', '12:00', true),  // must be skipped
      makeTask('later', '14:00'),         // must ripple
    ]
    const view = await loadComposable(tasks)
    const { dragEvent, calendarEvent } = dragStart('dragged', '10:00')

    view.handleEventDragStart(dragEvent, calendarEvent as never)
    // Drag to 11:00 → +60min delta → ghost offsets populate for ripple set
    view.handleDragOver({ preventDefault() {}, dataTransfer: {} } as unknown as DragEvent, slotAt(11))

    const offsets = view.rippleGhostOffsets.value
    expect(offsets.has('inst-later')).toBe(true)
    expect(offsets.has('inst-locked')).toBe(false)
    expect(offsets.has('inst-dragged')).toBe(false) // source isn't in the later set
  })

  it('covers all later tasks when none are locked', async () => {
    const tasks = [
      makeTask('dragged', '10:00'),
      makeTask('mid', '12:00'),
      makeTask('late', '14:00'),
    ]
    const view = await loadComposable(tasks)
    const { dragEvent, calendarEvent } = dragStart('dragged', '10:00')

    view.handleEventDragStart(dragEvent, calendarEvent as never)
    view.handleDragOver({ preventDefault() {}, dataTransfer: {} } as unknown as DragEvent, slotAt(11))

    const offsets = view.rippleGhostOffsets.value
    expect(offsets.has('inst-mid')).toBe(true)
    expect(offsets.has('inst-late')).toBe(true)
  })

  it('produces no ghost offsets when Shift is not held', async () => {
    const tasks = [makeTask('dragged', '10:00'), makeTask('mid', '12:00')]
    const view = await loadComposable(tasks)
    const { dragEvent, calendarEvent } = dragStart('dragged', '10:00', false)

    view.handleEventDragStart(dragEvent, calendarEvent as never)
    view.handleDragOver({ preventDefault() {}, dataTransfer: {} } as unknown as DragEvent, slotAt(11))

    expect(view.rippleGhostOffsets.value.size).toBe(0)
  })
})
