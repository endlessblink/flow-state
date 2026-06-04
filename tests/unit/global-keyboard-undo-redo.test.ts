import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  destroyGlobalKeyboardShortcuts,
  initGlobalKeyboardShortcuts
} from '@/utils/globalKeyboardHandlerSimple'

const mockUndo = vi.fn()
const mockRedo = vi.fn()
const canUndo = ref(true)
const canRedo = ref(true)

vi.mock('@/composables/undoSingleton', () => ({
  getUndoSystem: () => ({
    canUndo,
    canRedo,
    undoCount: ref(1),
    redoCount: ref(1),
    undo: mockUndo,
    redo: mockRedo
  })
}))

describe('global keyboard undo/redo routing', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    mockUndo.mockResolvedValue(true)
    mockRedo.mockResolvedValue(true)
    mockUndo.mockClear()
    mockRedo.mockClear()
    canUndo.value = true
    canRedo.value = true

    await initGlobalKeyboardShortcuts()
  })

  afterEach(() => {
    destroyGlobalKeyboardShortcuts()
    document.body.innerHTML = ''
  })

  const dispatchShortcut = (key: string, options: Partial<KeyboardEventInit> = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...options
    })

    window.dispatchEvent(event)
    return event
  }

  it('routes Ctrl+Z to singleton undo when app-level history is available', async () => {
    const event = dispatchShortcut('z')

    expect(event.defaultPrevented).toBe(true)
    expect(mockUndo).toHaveBeenCalledTimes(1)
    expect(mockRedo).not.toHaveBeenCalled()
  })

  it('routes Ctrl+Shift+Z and Ctrl+Y to singleton redo when app-level redo is available', async () => {
    const shiftRedo = dispatchShortcut('Z', { shiftKey: true })
    const ctrlY = dispatchShortcut('y')

    expect(shiftRedo.defaultPrevented).toBe(true)
    expect(ctrlY.defaultPrevented).toBe(true)
    expect(mockRedo).toHaveBeenCalledTimes(2)
    expect(mockUndo).not.toHaveBeenCalled()
  })

  it('does not consume undo/redo shortcuts while Quick Sort owns the active view', async () => {
    document.body.innerHTML = '<div class="quick-sort-view"></div>'

    const undoEvent = dispatchShortcut('z')
    const redoEvent = dispatchShortcut('y')

    expect(undoEvent.defaultPrevented).toBe(false)
    expect(redoEvent.defaultPrevented).toBe(false)
    expect(mockUndo).not.toHaveBeenCalled()
    expect(mockRedo).not.toHaveBeenCalled()
  })

  it('leaves native text editing undo alone inside inputs', async () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })
    input.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(mockUndo).not.toHaveBeenCalled()
  })
})
