import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardActions } from '../useBoardActions'

const createTaskWithUndo = vi.fn()
const showToast = vi.fn()
const filterDefaults = {
  value: {
    dueDate: '2026-08-01',
    estimatedDuration: 30
  }
}

vi.mock('@/composables/tasks/useFilterDefaults', () => ({
  useFilterDefaults: () => ({ filterDefaults })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast })
}))

describe('useBoardActions task creation', () => {
  const taskStore = {
    createTaskWithUndo
  } as never
  const timerStore = {
    settings: { workDuration: 25 },
    startTimer: vi.fn()
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
    createTaskWithUndo.mockResolvedValue({ id: 'created-task' })
  })

  it('keeps an explicitly selected due date from the creation modal', async () => {
    const { createTaskForColumn } = useBoardActions({ taskStore, timerStore })

    await createTaskForColumn(
      'Task from category',
      '',
      'high',
      'priority',
      'project-1',
      undefined,
      '2026-08-12'
    )

    expect(createTaskWithUndo).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: '2026-08-12',
      order: 0,
      priority: 'high',
      projectId: 'project-1'
    }))
  })

  it('uses the source date column when no explicit date was selected', async () => {
    const { createTaskForColumn } = useBoardActions({ taskStore, timerStore })

    await createTaskForColumn('Task for today', '', 'today', 'date')

    expect(createTaskWithUndo).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      order: 0
    }))
    expect(createTaskWithUndo.mock.calls[0][0].dueDate).not.toBe('2026-08-01')
  })

  it('clears an inherited filter date when creating in the No Date column', async () => {
    const { createTaskForColumn } = useBoardActions({ taskStore, timerStore })

    await createTaskForColumn('Undated task', '', 'noDate', 'date')

    expect(createTaskWithUndo).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: undefined,
      order: 0
    }))
  })
})
