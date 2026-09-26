/**
 * BUG-2100: canvas reloads re-saved unchanged groups every few seconds; with
 * uploads starved this grew to ~670 identical group upserts per group.
 */
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  enqueueOperation,
  getWriteQueueDB,
  hasIdenticalUnsentOperation,
} from '@/services/offline/writeQueueDB'

const groupPayload = (overrides: Record<string, unknown> = {}) => ({
  id: 'group-tuesday',
  user_id: 'user-a',
  name: 'Tuesday',
  position_json: { x: 1248, y: 0.00002154096636239026, width: 400, height: 1000 },
  updated_at: '2026-09-26T19:35:00.997Z',
  ...overrides,
})

describe('hasIdenticalUnsentOperation (BUG-2100)', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('detects an identical waiting group upsert regardless of updated_at and key order', async () => {
    await enqueueOperation({ entityType: 'group', operation: 'create', entityId: 'group-tuesday', payload: groupPayload(), userId: 'user-a', workspaceId: null })

    const { updated_at: _ignored, ...rest } = groupPayload()
    const resaveWithOtherKeyOrder = { updated_at: '2026-09-26T19:35:18.000Z', ...Object.fromEntries(Object.entries(rest).reverse()) }
    expect(await hasIdenticalUnsentOperation('group', 'group-tuesday', 'create', resaveWithOtherKeyOrder)).toBe(true)
  })

  it('does not suppress a real change, another entity, or an already completed write', async () => {
    const queued = await enqueueOperation({ entityType: 'group', operation: 'create', entityId: 'group-tuesday', payload: groupPayload(), userId: 'user-a', workspaceId: null })

    expect(await hasIdenticalUnsentOperation('group', 'group-tuesday', 'create', groupPayload({ name: 'Wednesday' }))).toBe(false)
    expect(await hasIdenticalUnsentOperation('group', 'group-other', 'create', groupPayload())).toBe(false)

    await getWriteQueueDB().operations.update(queued.id!, { status: 'completed' })
    expect(await hasIdenticalUnsentOperation('group', 'group-tuesday', 'create', groupPayload())).toBe(false)
  })
})
