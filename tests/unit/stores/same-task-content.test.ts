/**
 * BUG-2115: the authoritative reload maps fresh task objects every 15s. Unchanged
 * tasks must keep their existing object so views do not recompute for nothing,
 * while any real field change is still applied.
 */
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { Task } from '@/types/tasks'
import { sameTaskContent } from '@/stores/tasks/taskPersistence'

const base = () => ({
  id: 'a',
  title: 'Write the brief',
  status: 'planned',
  dueDate: '2026-10-15',
  createdAt: new Date('2026-10-01T08:00:00Z'),
  updatedAt: new Date('2026-10-14T08:00:00Z'),
  instances: [{ id: 'i1', scheduledDate: '2026-10-15', scheduledTime: '10:00' }],
  tags: ['work'],
}) as unknown as Task

describe('sameTaskContent', () => {
  it('treats a freshly mapped copy of an unchanged task as the same', () => {
    expect(sameTaskContent(reactive(base()) as Task, base())).toBe(true)
  })

  it('detects real changes, including nested instance edits and dates', () => {
    const moved = base()
    ;(moved.instances as Array<{ scheduledTime: string }>)[0].scheduledTime = '15:00'
    expect(sameTaskContent(base(), moved)).toBe(false)

    const touched = base()
    touched.updatedAt = new Date('2026-10-15T08:00:00Z') as unknown as Task['updatedAt']
    expect(sameTaskContent(base(), touched)).toBe(false)

    expect(sameTaskContent(base(), { ...base(), status: 'done' } as Task)).toBe(false)
  })
})
