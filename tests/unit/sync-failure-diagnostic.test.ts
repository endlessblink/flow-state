import { describe, expect, it } from 'vitest'
import { createSyncFailureDiagnostic } from '../../src/services/sync/syncFailureDiagnostic'

describe('createSyncFailureDiagnostic', () => {
  it('keeps an allowlisted sync error code and state while excluding task content', () => {
    const error = Object.assign(new Error('private task title'), {
      code: 'stale_revision',
      task: { title: 'private task title' },
    })

    const diagnostic = createSyncFailureDiagnostic(error, {
      status: 'error',
      isOnline: true,
      pendingCount: 2,
      failedCount: 1,
    })

    expect(diagnostic).toEqual({
      code: 'stale_revision',
      status: 'error',
      online: true,
      pendingCount: 2,
      failedCount: 1,
    })
    expect(JSON.stringify(diagnostic)).toContain('"code":"stale_revision"')
    expect(JSON.stringify(diagnostic)).not.toContain('[object Object]')
  })

  it('never copies arbitrary error messages or unrecognized codes into diagnostics', () => {
    const privateMessage = 'private task title: ' + 'x'.repeat(400)
    const unknownCode = Object.assign(new Error(privateMessage), { code: 'private_task_title' })
    const diagnostic = createSyncFailureDiagnostic(unknownCode, {
      status: 'idle', isOnline: false, pendingCount: 0, failedCount: 0,
    })
    expect(diagnostic).toEqual({
      code: 'unclassified_error', status: 'idle', online: false, pendingCount: 0, failedCount: 0,
    })
    expect(JSON.stringify(diagnostic)).not.toContain(privateMessage)
    expect(createSyncFailureDiagnostic({ code: 'PGRST116' }, {
      status: 'idle', isOnline: false, pendingCount: 0, failedCount: 0,
    }).code).toBe('database_error')
    expect(createSyncFailureDiagnostic('failure', {
      status: 'idle', isOnline: false, pendingCount: 0, failedCount: 0,
    }).code).toBe('unclassified_error')
  })
})
