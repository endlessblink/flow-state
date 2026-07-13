import { describe, expect, it } from 'vitest'
import { taskStorageOwner } from '@/stores/tasks/taskPersistence'

describe('task persistence auth boundary', () => {
  it('holds account data without touching guest storage while session restoration is pending', () => {
    expect(taskStorageOwner({
      user: { id: 'account-user' },
      isAuthenticated: false,
      isRestoringSession: true,
    })).toBe('restoring')
  })

  it('uses guest storage only after initialization confirms there is no account identity', () => {
    expect(taskStorageOwner({
      user: null,
      isAuthenticated: false,
      isRestoringSession: false,
    })).toBe('guest')
  })

  it('uses account persistence for a confirmed authenticated user', () => {
    expect(taskStorageOwner({
      user: { id: 'account-user' },
      isAuthenticated: true,
      isRestoringSession: false,
    })).toBe('account')
  })
})
