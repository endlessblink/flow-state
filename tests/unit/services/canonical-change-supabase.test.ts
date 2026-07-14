import { describe, expect, it, vi } from 'vitest'
import { createCanonicalChangeSupabaseReader } from '@/services/sync/canonicalChangeSupabase'

function queryHarness(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = []
  const query = {
    select: vi.fn((...args: unknown[]) => { calls.push(['select', ...args]); return query }),
    eq: vi.fn((...args: unknown[]) => { calls.push(['eq', ...args]); return query }),
    is: vi.fn((...args: unknown[]) => { calls.push(['is', ...args]); return query }),
    gt: vi.fn((...args: unknown[]) => { calls.push(['gt', ...args]); return query }),
    order: vi.fn((...args: unknown[]) => { calls.push(['order', ...args]); return query }),
    limit: vi.fn((...args: unknown[]) => { calls.push(['limit', ...args]); return query }),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return { calls, client: { from: vi.fn(() => query) } }
}

describe('TASK-1947 canonical change Supabase reader', () => {
  it('reads personal pages with explicit user and null-workspace scope', async () => {
    const harness = queryHarness({
      data: [{
        change_sequence: 12,
        entity_type: 'task',
        entity_id: 'task-1',
        action: 'updated',
        tombstone: false,
      }],
      error: null,
    })
    const reader = createCanonicalChangeSupabaseReader(harness.client as never)

    await expect(reader.fetchChanges({
      scope: { kind: 'personal', userId: 'user-1' },
      afterSequence: 10,
      order: 'ascending',
      limit: 200,
    })).resolves.toEqual([{
      changeSequence: 12,
      entityType: 'task',
      entityId: 'task-1',
      action: 'updated',
      tombstone: false,
    }])

    expect(harness.calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(harness.calls).toContainEqual(['is', 'workspace_id', null])
    expect(harness.calls).toContainEqual(['gt', 'change_sequence', 10])
    expect(harness.calls).toContainEqual(['order', 'change_sequence', { ascending: true }])
    expect(harness.calls).toContainEqual(['limit', 200])
  })

  it('reads workspace high-water with exact workspace scope and descending order', async () => {
    const harness = queryHarness({ data: [{ change_sequence: 91 }], error: null })
    const reader = createCanonicalChangeSupabaseReader(harness.client as never)

    await expect(reader.readHighWater({
      kind: 'workspace',
      userId: 'member-1',
      workspaceId: 'workspace-1',
    })).resolves.toBe(91)

    expect(harness.calls).toContainEqual(['eq', 'workspace_id', 'workspace-1'])
    expect(harness.calls).not.toContainEqual(['eq', 'user_id', 'member-1'])
    expect(harness.calls).toContainEqual(['order', 'change_sequence', { ascending: false }])
    expect(harness.calls).toContainEqual(['limit', 1])
  })

  it('fails closed on database errors and malformed rows', async () => {
    const failed = queryHarness({ data: null, error: { message: 'private database details' } })
    const malformed = queryHarness({ data: [{ change_sequence: 'wrong' }], error: null })

    await expect(createCanonicalChangeSupabaseReader(failed.client as never).readHighWater({
      kind: 'personal', userId: 'user-1',
    })).rejects.toThrow('Canonical change read failed')
    await expect(createCanonicalChangeSupabaseReader(malformed.client as never).fetchChanges({
      scope: { kind: 'personal', userId: 'user-1' },
      afterSequence: 0,
      order: 'ascending',
      limit: 200,
    })).rejects.toThrow('invalid row')
  })
})
