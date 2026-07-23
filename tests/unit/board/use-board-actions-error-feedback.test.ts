import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const showToast = vi.fn()

vi.mock('@/composables/tasks/useFilterDefaults', () => ({
  useFilterDefaults: () => ({ filterDefaults: ref({}) }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast }),
}))

import { useBoardActions } from '@/composables/board/useBoardActions'

describe('Board durable-action failure feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a rejected delete explicit instead of silently returning null', async () => {
    const deleteTaskWithUndo = vi.fn().mockRejectedValue(new Error('durable delete rejected'))
    const actions = useBoardActions({
      taskStore: {
        deleteTaskWithUndo,
      } as never,
      timerStore: {} as never,
    })

    await expect(actions.deleteTask('task-1')).resolves.toBeNull()
    expect(deleteTaskWithUndo).toHaveBeenCalledWith('task-1')
    expect(showToast).toHaveBeenCalledWith(
      'Task could not be deleted. No changes were saved.',
      'error',
    )
  })
})
