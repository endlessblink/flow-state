import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/kanban/card/TaskCardBadges.vue', 'utf8')

describe('TaskCardBadges duration picker', () => {
  it('renders the picker outside the task-card overflow boundary', () => {
    expect(source).toContain('<Teleport to="body">')
    expect(source).toContain('class="work-block-picker"')
  })

  it('keeps the picker open until the duration update succeeds', () => {
    expect(source).toContain('try {\n    await taskStore.updateTaskWithUndo')
    expect(source).toContain('isDurationPickerOpen.value = false')
    expect(source).toContain('catch')
    expect(source).toContain('pickerRef.value?.contains(event.target as Node)')
  })

  it('surfaces a failed durable update to the picker', () => {
    const undoSource = readFileSync('src/composables/undoSingleton.ts', 'utf8')
    const operationsSource = readFileSync('src/stores/tasks/taskOperations.ts', 'utf8')

    expect(undoSource).toContain("if (persisted === false)")
    expect(operationsSource).toContain('return persisted')
  })
})
