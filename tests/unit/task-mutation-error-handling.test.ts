import { describe, expect, it } from 'vitest'
import {
  isTaskUpdateTargetMissingError,
  settleBackgroundTaskMutation,
} from '@/utils/taskMutationErrors'

describe('task mutation error handling', () => {
  it('recognizes only the transient task-disappearance error', () => {
    expect(
      isTaskUpdateTargetMissingError(
        new Error('Task update target no longer exists: task-123'),
      ),
    ).toBe(true)
    expect(isTaskUpdateTargetMissingError(new Error('Task could not be saved'))).toBe(false)
    expect(isTaskUpdateTargetMissingError('Task update target no longer exists: task-123')).toBe(false)
  })

  it('settles only a stale fire-and-forget gesture', async () => {
    await expect(
      settleBackgroundTaskMutation(
        Promise.reject(new Error('Task update target no longer exists: task-123')),
        'board drop',
      ),
    ).resolves.toBeUndefined()
    await expect(
      settleBackgroundTaskMutation(
        Promise.reject(new Error('Task could not be saved')),
        'board drop',
      ),
    ).rejects.toThrow('Task could not be saved')
  })
})
