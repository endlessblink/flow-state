import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackupRestoreDatabase } from '@/composables/supabase/useBackupRestoreDatabase'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/composables/supabase/_infrastructure', async importOriginal => {
  const original = await importOriginal<
    typeof import('@/composables/supabase/_infrastructure')
  >()
  return {
    ...original,
    getSupabase: () => ({ rpc }),
  }
})

describe('atomic backup restore database wrapper', () => {
  beforeEach(() => {
    rpc.mockReset()
    localStorage.clear()
  })

  it('reuses a durable request identity after a lost acknowledgement', async () => {
    const database = useBackupRestoreDatabase({
      getUserIdSafe: () => '00000000-0000-4000-8000-000000000001',
    } as any)
    const input = {
      operationId: 'backup-1',
      artifactHash: 'artifact-hash-1',
      schemaVersion: '4.0.0',
      tasks: [{
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Recovered task',
        status: 'todo' as const,
      }],
      projects: [],
      groups: [],
      tombstones: [],
    }
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'connection closed after commit' },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          tasksCreated: 1,
          tasksExisting: 0,
          projectsCreated: 0,
          projectsExisting: 0,
          groupsCreated: 0,
          groupsExisting: 0,
          tombstonesCreated: 0,
          replayed: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          tasksCreated: 1,
          tasksExisting: 0,
          projectsCreated: 0,
          projectsExisting: 0,
          groupsCreated: 0,
          groupsExisting: 0,
          tombstonesCreated: 0,
          replayed: false,
        },
        error: null,
      })

    await expect(database.restoreBackupTransaction(input)).rejects.toThrow(
      'connection closed after commit',
    )
    const firstRequestId = rpc.mock.calls[0][1].p_operation_id

    await expect(database.restoreBackupTransaction(input)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    })
    expect(rpc.mock.calls[1][1].p_operation_id).toBe(firstRequestId)
    expect(
      localStorage.getItem(
        'flowstate-atomic-restore-v1:00000000-0000-4000-8000-000000000001:backup-1:artifact-hash-1',
      ),
    ).toBeNull()

    await database.restoreBackupTransaction(input)
    expect(rpc.mock.calls[2][1].p_operation_id).not.toBe(firstRequestId)
  })

  it('refuses to call the database when retry identity cannot be verified', async () => {
    const database = useBackupRestoreDatabase({
      getUserIdSafe: () => '00000000-0000-4000-8000-000000000001',
    } as any)
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)

    try {
      await expect(database.restoreBackupTransaction({
        operationId: 'backup-unpersisted',
        artifactHash: 'artifact-hash-2',
        schemaVersion: '4.0.0',
        tasks: [],
        projects: [],
        groups: [],
        tombstones: [],
      })).rejects.toThrow('retry identity was not persisted')
      expect(rpc).not.toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })
})
