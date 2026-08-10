import { describe, expect, it, vi } from 'vitest'
import { runTaskMutationWithSettling } from '../settleTaskMutation'

describe('runTaskMutationWithSettling', () => {
    it('recovers the Catalog checkbox race before failing completion', async () => {
        const getTask = vi.fn()
            .mockReturnValueOnce({ id: 'task-1' })
            .mockReturnValueOnce({ id: 'task-1' })
        const refreshTasks = vi.fn().mockResolvedValue(undefined)
        const mutation = vi.fn()
            .mockRejectedValueOnce(new Error('Task update target no longer exists: task-1'))
            .mockResolvedValueOnce('saved')

        await expect(runTaskMutationWithSettling('task-1', getTask, refreshTasks, mutation))
            .resolves.toBe('saved')
        expect(refreshTasks).toHaveBeenCalledTimes(1)
        expect(mutation).toHaveBeenCalledTimes(2)
    })

    it('refreshes when the visible task disappears before the mutation starts', async () => {
        const getTask = vi.fn()
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce({ id: 'task-1' })
        const refreshTasks = vi.fn().mockResolvedValue(undefined)
        const mutation = vi.fn().mockResolvedValue(undefined)

        await runTaskMutationWithSettling('task-1', getTask, refreshTasks, mutation)

        expect(refreshTasks).toHaveBeenCalledTimes(1)
        expect(mutation).toHaveBeenCalledTimes(1)
    })
})
