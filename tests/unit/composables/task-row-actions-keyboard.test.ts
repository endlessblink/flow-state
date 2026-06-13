import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTaskRowActions } from '@/composables/tasks/row/useTaskRowActions'
import type { Task } from '@/stores/tasks'

const task = {
  id: 'task-1',
  title: 'Edit this task',
  status: 'todo',
  createdAt: new Date(),
  updatedAt: new Date()
} as Task

const createActions = () => {
  const emit = vi.fn()
  const actions = useTaskRowActions(
    {
      task,
      indentLevel: 0,
      hasSubtasks: false,
      isExpanded: false
    },
    emit,
    {
      isDragging: ref(false),
      isDropTarget: ref(false),
      isFocused: ref(false),
      isHovered: ref(false)
    }
  )

  return { actions, emit }
}

const keyboardEventFor = (target: EventTarget, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('useTaskRowActions keyboard handling', () => {
  it('does not consume Space or Enter while inline editing a task title', () => {
    const { actions, emit } = createActions()
    const input = document.createElement('input')
    const spaceEvent = keyboardEventFor(input, ' ')
    const enterEvent = keyboardEventFor(input, 'Enter')

    actions.handleKeyDown(spaceEvent)
    actions.handleKeyDown(enterEvent)

    expect(spaceEvent.defaultPrevented).toBe(false)
    expect(enterEvent.defaultPrevented).toBe(false)
    expect(emit).not.toHaveBeenCalledWith('select', task.id)
  })

  it('does not consume keyboard shortcuts from editable row controls', () => {
    const { actions, emit } = createActions()
    const editableTargets: Array<[string, HTMLElement]> = [
      ['textarea', document.createElement('textarea')],
      ['select', document.createElement('select')],
      ['contenteditable', document.createElement('div')]
    ]
    editableTargets[2][1].setAttribute('contenteditable', 'true')

    for (const [label, target] of editableTargets) {
      const event = keyboardEventFor(target, ' ')
      actions.handleKeyDown(event)
      expect(event.defaultPrevented, label).toBe(false)
    }

    expect(emit).not.toHaveBeenCalled()
  })

  it('still treats Space as row activation outside editable controls', () => {
    const { actions, emit } = createActions()
    const row = document.createElement('div')
    const event = keyboardEventFor(row, ' ')

    actions.handleKeyDown(event)

    expect(event.defaultPrevented).toBe(true)
    expect(emit).toHaveBeenCalledWith('select', task.id)
  })
})
