import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Done for now UI entrypoint contracts', () => {
  it('passes an explicit next date into the atomic recurring operation', () => {
    const source = readFileSync(resolve(__dirname, '../../src/components/tasks/TaskContextMenu.vue'), 'utf8')
    const start = source.indexOf('const handleDoneForNowPickDate')
    const end = source.indexOf('\n}', start) + 2
    const body = source.slice(start, end)

    expect(body).toContain('await taskStore.doneForNow(taskId, { nextDueDate: dateStr })')
    expect(body).not.toContain("await taskStore.updateTask(taskId, { dueDate: dateStr })")
  })

  it('keeps completion history out of task search results', () => {
    const source = readFileSync(resolve(__dirname, '../../src/components/layout/SearchModal.vue'), 'utf8')

    expect(source).toContain("filter(t => !t._soft_deleted && !t.isCompletionRecord)")
  })

  it('places recurring Canvas tasks by their committed next occurrence instead of always tomorrow', () => {
    const source = readFileSync(resolve(__dirname, '../../src/composables/canvas/useCanvasTaskActions.ts'), 'utf8')
    const start = source.indexOf('const doneForNowSelectedTasks')
    const end = source.indexOf('\n    const deleteSelectedTasks', start)
    const body = source.slice(start, end)

    expect(body).toContain('findMatchingGroupForDueDate(task.dueDate, canvasStore.groups)')
    expect(body).not.toContain('findMatchingGroupForDueDate(tomorrowStr, canvasStore.groups)')
  })
})
