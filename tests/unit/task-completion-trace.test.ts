import { describe, expect, it, vi } from 'vitest'
import { traceTaskCompletion } from '@/utils/taskCompletionTrace'

describe('task completion trace', () => {
  it('persists a named completion phase through Electron diagnostics', async () => {
    const appendTaskCompletionDiag = vi.fn().mockResolvedValue('/tmp/runtime-diagnostics.log')
    vi.stubGlobal('window', { electronAPI: { appendTaskCompletionDiag } })

    traceTaskCompletion('remote-preview-start', { taskId: 'task-1' })

    expect(appendTaskCompletionDiag).toHaveBeenCalledOnce()
    expect(JSON.parse(appendTaskCompletionDiag.mock.calls[0][0])).toMatchObject({
      phase: 'remote-preview-start',
      taskId: 'task-1',
    })
    vi.unstubAllGlobals()
  })
})
