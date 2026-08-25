/**
 * BUG-1899 (load half): loadFromDatabase must not drop freshly-created groups.
 *
 * Recorder-proven flake: a group created while a canvas load is in flight is
 * absent from the server result (its create op hasn't drained), and the
 * wholesale setGroups(serverRows) wipes it from the store. It reappears
 * seconds later at its SEED position when the create echo lands — meanwhile
 * any operation on it (Tidy, drag) silently no-ops. This was the documented
 * "realtime sync can briefly remove freshly-pushed groups" behavior.
 *
 * Contract: preserveRecentLocalGroups keeps in-memory groups missing from the
 * server result while they're recent (pending-create grace window), and drops
 * stale local-only zombies.
 */

import { describe, expect, it } from 'vitest'
import type { CanvasGroup } from '@/types/canvas'
import { preserveRecentLocalGroups } from '@/utils/canvas/mergeGroupLoad'

const NOW = new Date('2026-07-02T12:00:00.000Z').getTime()

function group(id: string, updatedAtMsAgo: number, name = id): CanvasGroup {
  return {
    id,
    name,
    type: 'custom',
    position: { x: 0, y: 0, width: 300, height: 400 },
    updatedAt: new Date(NOW - updatedAtMsAgo).toISOString(),
  } as CanvasGroup
}

describe('BUG-1899: preserveRecentLocalGroups', () => {
  it('keeps a fresh in-memory group missing from the server result (pending create)', () => {
    const server = [group('server-1', 60_000)]
    const inMemory = [group('server-1', 60_000), group('fresh-1', 5_000)]
    const out = preserveRecentLocalGroups(server, inMemory, NOW)
    expect(out.map(g => g.id)).toContain('fresh-1')
    expect(out.map(g => g.id)).toContain('server-1')
    expect(out).toHaveLength(2)
  })

  it('does not duplicate groups present in both', () => {
    const server = [group('a', 1_000)]
    const inMemory = [group('a', 500)]
    const out = preserveRecentLocalGroups(server, inMemory, NOW)
    expect(out).toHaveLength(1)
  })

  it('drops stale local-only zombies (outside the grace window)', () => {
    const server = [group('a', 1_000)]
    const inMemory = [group('a', 1_000), group('zombie', 2 * 60 * 60 * 1000)]
    const out = preserveRecentLocalGroups(server, inMemory, NOW)
    expect(out.map(g => g.id)).not.toContain('zombie')
  })

  it('keeps a local-only group with NO updatedAt (never-synced entity — absence of stamp is not staleness)', () => {
    // createGroup historically did not stamp updatedAt, and locally-seeded
    // groups may lack one entirely. A group missing from the server AND
    // missing a timestamp is a never-synced local entity — wiping it destroys
    // user data. Stale zombies always carry updatedAt (set by store ops).
    const noStamp = { ...group('nostamp', 0), updatedAt: undefined } as CanvasGroup
    const out = preserveRecentLocalGroups([], [noStamp], NOW)
    expect(out.map(g => g.id)).toContain('nostamp')
  })

  it('keeps cache-backed local-only groups during recovery even outside the fresh-create grace', () => {
    const cachedOnly = group('cached-recovery', 2 * 60 * 60 * 1000, 'Recovered Section')
    const out = preserveRecentLocalGroups([], [], NOW, undefined, [cachedOnly])

    expect(out.map(g => g.id)).toEqual(['cached-recovery'])
    expect(out[0].name).toBe('Recovered Section')
  })

  it('keeps a day group when persisted tasks still reference it', () => {
    const today = group('today', 2 * 60 * 60 * 1000, 'Today')
    const out = preserveRecentLocalGroups([], [today], NOW, undefined, [], (candidate) =>
      candidate.id === 'today',
    )

    expect(out.map(g => g.id)).toEqual(['today'])
  })
})
