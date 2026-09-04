import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('background task mutation contract', () => {
  it('settles stale Focus and subtask gestures without swallowing other errors', () => {
    const focusView = source('src/views/FocusView.vue')
    const taskEditActions = source('src/composables/tasks/useTaskEditActions.ts')

    expect(focusView).toContain(
      "import { settleBackgroundTaskMutation } from '@/utils/taskMutationErrors'",
    )
    expect(focusView.match(/void settleBackgroundTaskMutation\(/g)).toHaveLength(2)
    expect(taskEditActions).toContain(
      "import { settleBackgroundTaskMutation } from '@/utils/taskMutationErrors'",
    )
    expect(taskEditActions.match(/void settleBackgroundTaskMutation\(/g)).toHaveLength(1)
  })
})
