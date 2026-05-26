import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('undo-aware modal and context-menu entry points', () => {
  it('keeps TaskContextMenu user mutations on undo-aware APIs', () => {
    const source = readSource('src/components/tasks/TaskContextMenu.vue')

    expect(source).toContain('await taskStore.updateTaskWithUndo(currentTask.value.id, { isPinned:')
    expect(source).toContain('await taskStore.updateTaskWithUndo(currentTask.value.id, { calendarLocked:')
    expect(source).toContain("await taskStore.updateTaskWithUndo(taskId, { status: 'done' })")
    expect(source).toContain('await taskStore.createTaskWithUndo({')

    expect(source).not.toContain('await taskStore.updateTask(currentTask.value.id, { isPinned:')
    expect(source).not.toContain('await taskStore.updateTask(currentTask.value.id, { calendarLocked:')
    expect(source).not.toContain("await taskStore.moveTask(taskId, 'done')")
    expect(source).not.toContain('await taskStore.createTask({\n      title: t.title')
  })

  it('keeps recurrence modal delete and canvas-remove paths undo-aware', () => {
    const source = readSource('src/layouts/ModalManager.vue')

    expect(source).toContain('await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)')
    expect(source).toContain('await getUndoSystem().bulkMoveToInboxWithUndo([taskId])')

    expect(source).not.toContain('await taskStore.permanentlyDeleteTask(taskId)')
    expect(source).not.toContain('await taskStore.updateTask(taskId, {\n      canvasPosition: undefined')
  })
})
