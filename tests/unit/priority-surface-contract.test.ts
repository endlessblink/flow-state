import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('priority surface contract', () => {
  it('offers every supported priority and an explicit no-priority action in the context menu', () => {
    const source = read('src/components/tasks/context-menu/PrioritySubmenu.vue')

    for (const priority of ['immediate', 'high', 'medium', 'low', 'relaxed']) {
      expect(source).toContain(`currentPriority === '${priority}'`)
      expect(source).toContain(`$emit('select', '${priority}')`)
      expect(source).toContain(`priority-dot ${priority}`)
    }
    expect(source).toContain('No Priority')
    expect(source).toContain("$emit('clearPriority')")
  })

  it('uses distinct priority colors in the inline task-row selector', () => {
    const source = read('src/components/tasks/row/TaskRowPriority.vue')

    for (const priority of ['immediate', 'high', 'medium', 'low', 'relaxed']) {
      expect(source).toContain(`priority-dropdown__dot--${priority}`)
    }
    expect(source).toContain('task-row__priority-badge--immediate')
    expect(source).toContain('task-row__priority-badge--relaxed')
    expect(source).toContain("value: null")
  })
})
