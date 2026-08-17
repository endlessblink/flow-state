import { describe, expect, it } from 'vitest'
import { useCalendarDragCreate } from '@/composables/useCalendarDragCreate'

const externalEvent = {
  startTime: new Date(2026, 7, 17, 13, 0)
}

describe('useCalendarDragCreate external calendar events', () => {
  it('keeps a Google event click from opening task creation', () => {
    const dragCreate = useCalendarDragCreate()

    dragCreate.handleExternalEventMouseDown(new MouseEvent('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 100
    }), externalEvent)
    document.dispatchEvent(new MouseEvent('mouseup', {
      button: 0,
      clientX: 100,
      clientY: 100
    }))

    expect(dragCreate.showQuickCreateModal.value).toBe(false)
  })

  it('starts local task creation after dragging over a Google event', () => {
    const dragCreate = useCalendarDragCreate()

    dragCreate.handleExternalEventMouseDown(new MouseEvent('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 100
    }), externalEvent)
    document.dispatchEvent(new MouseEvent('mousemove', {
      button: 0,
      buttons: 1,
      clientX: 106,
      clientY: 120
    }))
    document.dispatchEvent(new MouseEvent('mouseup', {
      button: 0,
      clientX: 106,
      clientY: 120
    }))

    expect(dragCreate.showQuickCreateModal.value).toBe(true)
    expect(dragCreate.quickCreateData.startTime).toEqual(new Date(2026, 7, 17, 13, 0))
    expect(dragCreate.quickCreateData.duration).toBe(30)
  })
})
