/**
 * BUG-1899 (group half): realtime echoes must not stomp newer local group
 * positions.
 *
 * Probe-proven live failure (Tidy "3 rows", BUG-1782 recurrence): Tidy writes
 * the canonical row via updateGroup (bumps positionVersion to 1, updatedAt to
 * now), then the INSERT/UPDATE echoes of the groups' own creation arrive
 * ~0.2-2s later carrying the SEED position with position_version 0/NULL.
 * updateGroupFromSync's version guard only skips when
 * `incomingVersion > 0 && localVersion > incomingVersion`, so a version-0
 * echo bypasses BOTH the version skip and the equal-version timestamp
 * compare (0 !== 1) and blindly overwrites the tidied position.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasGroup } from '@/types/canvas'

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheGroups: vi.fn(),
}))
vi.mock('@/utils/sync/writeRateGuard', () => ({
  recordWrite: vi.fn(),
}))
const { mockEnqueue } = vi.hoisted(() => ({
  mockEnqueue: vi.fn().mockResolvedValue({ id: 1 }),
}))
vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({ enqueue: mockEnqueue }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'test-user-id' } }),
}))
vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseGroup: vi.fn((g: CanvasGroup) => ({ id: g.id })),
}))

import { useCanvasGroups } from '@/stores/canvas/canvasGroups'

const mockSaveGroupToStorage = vi.fn().mockResolvedValue(undefined)

function makeModule() {
  return useCanvasGroups(
    {
      saveGroupToStorage: mockSaveGroupToStorage,
      saveGroupsToLocalStorage: vi.fn(),
      deleteGroupRemote: vi.fn().mockResolvedValue(undefined),
    },
    { value: { tasks: [] } }
  )
}

const GROUP_ID = '3550e13d-35ed-43a6-bf79-b1a08676f554'

function seedGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: GROUP_ID,
    name: 'Probe Gamma',
    type: 'custom',
    color: '#4ECDC4',
    position: { x: 3456, y: 777, width: 350, height: 1000 },
    positionVersion: 0,
    updatedAt: '2026-07-02T10:00:00.000Z',
    isVisible: true,
    ...overrides,
  } as CanvasGroup
}

describe('BUG-1899: group realtime echo guard', () => {
  let mod: ReturnType<typeof makeModule>

  beforeEach(() => {
    vi.clearAllMocks()
    mod = makeModule()
    mod.setGroups([seedGroup()], true)
  })

  it('createGroup issues exactly ONE remote write (spy-proven double-create was the version ping-pong)', async () => {
    // Live spy showed each group reaching position_version 4 within 200ms of
    // Tidy: createGroup enqueued a create op AND called saveGroupToStorage,
    // which enqueues a SECOND create op with the same seed-position snapshot.
    // Whichever stale snapshot drained last out-versioned the tidied position.
    await mod.createGroup({
      name: 'Fresh Group',
      position: { x: 10, y: 20, width: 300, height: 400 },
    } as Omit<CanvasGroup, 'id'>)

    const remoteWrites =
      mockEnqueue.mock.calls.filter(([op]) => op.entityType === 'group').length +
      mockSaveGroupToStorage.mock.calls.length
    expect(
      remoteWrites,
      'createGroup must have exactly one remote writer — duplicates re-assert stale seed positions after later edits'
    ).toBe(1)
  })

  it('a version-0 creation echo does NOT overwrite a newer local position (the Tidy 3-rows stomp)', async () => {
    // Tidy moves the group to the canonical row (bumps local positionVersion)
    await mod.updateGroup(GROUP_ID, { position: { x: 3456, y: 100, width: 350, height: 1000 } })
    const afterTidy = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(afterTidy.position!.y).toBe(100)
    expect(afterTidy.positionVersion).toBe(1)

    // The creation echo arrives late with the SEED position and version 0
    mod.updateGroupFromSync(GROUP_ID, {
      position: { x: 3456, y: 777, width: 350, height: 1000 },
      positionVersion: 0,
      updatedAt: '2026-07-02T10:00:01.000Z',
    })

    const after = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(
      after.position!.y,
      'creation echo (position_version 0) stomped the tidied position — groups revert to pre-Tidy rows'
    ).toBe(100)
  })

  it('an echo with UNDEFINED positionVersion does not overwrite a newer local position', async () => {
    await mod.updateGroup(GROUP_ID, { position: { x: 3456, y: 100, width: 350, height: 1000 } })

    mod.updateGroupFromSync(GROUP_ID, {
      position: { x: 3456, y: 777, width: 350, height: 1000 },
      updatedAt: '2026-07-02T10:00:01.000Z',
    })

    const after = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(after.position!.y, 'undefined-version echo stomped a newer local position').toBe(100)
  })

  it('a genuinely NEWER remote version still applies (cross-device move)', async () => {
    await mod.updateGroup(GROUP_ID, { position: { x: 3456, y: 100, width: 350, height: 1000 } })

    mod.updateGroupFromSync(GROUP_ID, {
      position: { x: 500, y: 400, width: 350, height: 1000 },
      positionVersion: 5,
      updatedAt: new Date().toISOString(),
    })

    const after = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(after.position!.y, 'newer remote versions must keep applying').toBe(400)
    expect(after.position!.x).toBe(500)
  })

  it('an EQUAL-version echo with different geometry does not move the group (drain-time timestamp hole)', async () => {
    // Spy-proven live failure: the queue drained a stale payload ~5s late; the
    // echo came back with the SAME positionVersion as local but the SEED
    // position, and a server updated_at stamped at DRAIN time (newer than the
    // local edit). The equal-version timestamp rule then applied stale
    // geometry. Version authority: whoever wrote version N owns version N's
    // geometry — an equal-version echo can never carry better geometry.
    await mod.updateGroup(GROUP_ID, { position: { x: 3456, y: 100, width: 350, height: 1000 } })
    const local = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(local.positionVersion).toBe(1)

    mod.updateGroupFromSync(GROUP_ID, {
      position: { x: 3456, y: 777, width: 350, height: 1000 },
      positionVersion: 1,
      updatedAt: new Date(Date.now() + 10_000).toISOString(), // server drain-time, "newer"
    })

    const after = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(
      after.position!.y,
      'equal-version echo with drain-time timestamp stomped newer local geometry'
    ).toBe(100)
  })

  it('an equal-version echo still applies NON-geometry fields by timestamp', async () => {
    await mod.updateGroup(GROUP_ID, { position: { x: 3456, y: 100, width: 350, height: 1000 } })

    mod.updateGroupFromSync(GROUP_ID, {
      name: 'Renamed Remotely',
      position: { x: 3456, y: 777, width: 350, height: 1000 },
      positionVersion: 1,
      updatedAt: new Date(Date.now() + 10_000).toISOString(),
    })

    const after = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(after.name, 'metadata from an equal-version echo should still merge').toBe('Renamed Remotely')
    expect(after.position!.y, 'geometry must not move on equal version').toBe(100)
  })

  it('equal versions fall back to timestamp compare (existing behavior preserved)', async () => {
    // local v0 with a NEWER timestamp than the incoming v0 echo → skip
    mod.setGroups([seedGroup({ updatedAt: '2026-07-02T10:05:00.000Z' })], true)

    mod.updateGroupFromSync(GROUP_ID, {
      position: { x: 1, y: 1, width: 350, height: 1000 },
      positionVersion: 0,
      updatedAt: '2026-07-02T10:00:00.000Z',
    })

    const after = mod.sections.value.find(g => g.id === GROUP_ID)!
    expect(after.position!.y).toBe(777)
  })
})
