import { describe, expect, it } from 'vitest'
import { realtimeRowMatchesScope } from '@/services/sync/realtimeScopeGuard'

describe('realtime scope guard', () => {
  it.each(['task', 'project', 'group', 'lane'])(
    'accepts an identity-only shared-workspace DELETE for the current scoped channel (%s)',
    () => {
      expect(realtimeRowMatchesScope({
        eventType: 'DELETE',
        old: { id: 'deleted-row' },
        new: null,
      }, 'workspace-1', 'user-1')).toBe(true)
    },
  )

  it('rejects a row delivered for another workspace', () => {
    expect(realtimeRowMatchesScope({
      eventType: 'UPDATE',
      old: null,
      new: { id: 'foreign-row', workspace_id: 'workspace-2' },
    }, 'workspace-1', 'user-1')).toBe(false)
  })

  it('rejects a personal row owned by another user', () => {
    expect(realtimeRowMatchesScope({
      eventType: 'UPDATE',
      old: null,
      new: { id: 'foreign-row', workspace_id: null, user_id: 'user-2' },
    }, null, 'user-1')).toBe(false)
  })
})
