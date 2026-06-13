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
  it('does not consume Space while inline editing a task title', () => {
    const { actions, emit } = createActions()
    const input = document.createElement('input')
    const event = keyboardEventFor(input, ' ')

    actions.handleKeyDown(event)

    expect(event.defaultPrevented).toBe(false)
    expect(emit).not.toHaveBeenCalledWith('select', task.id)
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
