import { describe, it, expect } from 'vitest'
import { filterMockTasks } from '@/utils/mockTaskDetector'

/**
 * TASK-1873 — "backup reliably backs this up".
 *
 * The local auto-backup payload is built from full task objects (`[...taskStore._rawTasks]`),
 * and the ONLY transform applied to those objects on the backup path is filterMockTasks().
 * The original data loss (BUG-1872) was never-saved text; this guard covers the other failure
 * mode — saved text being silently dropped from the backup by a field-level regression. If a
 * future change makes the backup pick/whitelist fields instead of spreading, this test fails.
 */
describe('local backup preserves task.description (TASK-1873)', () => {
  it('keeps description on real tasks after the mock filter', () => {
    const tasks = [
      { id: 'real-1', title: 'Real task', description: 'IMPORTANT content that must be backed up', status: 'todo' },
      { id: 'real-2', title: 'Hebrew task', description: 'תוכן בעברית שחייב להישמר', status: 'todo' },
    ]

    const { cleanTasks } = filterMockTasks(tasks as unknown as Record<string, unknown>[], {
      confidence: 'medium',
      logResults: false,
    })

    expect(cleanTasks).toHaveLength(2)
    for (const original of tasks) {
      const kept = (cleanTasks as unknown as typeof tasks).find(t => t.id === original.id)
      expect(kept, `task ${original.id} survived the backup filter`).toBeDefined()
      expect(kept!.description).toBe(original.description)
    }
  })
})
