import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const kanbanSwimlaneSource = readFileSync(
  resolve(process.cwd(), 'src/components/kanban/KanbanSwimlane.vue'),
  'utf8',
)

describe('Kanban background mutation contract', () => {
  it('settles stale task-update races from every fire-and-forget board drop', () => {
    expect(kanbanSwimlaneSource).toContain(
      "import { settleBackgroundTaskMutation } from '@/utils/taskMutationErrors'",
    )
    expect(kanbanSwimlaneSource.match(/void settleBackgroundTaskMutation\(/g)).toHaveLength(5)
  })
})
