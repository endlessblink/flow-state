/**
 * BUG-1775 — Rollback on remote delete failure.
 *
 * deleteProject and deleteProjects optimistically mutate _rawProjects before
 * awaiting the Supabase soft-delete. If that remote call rejects, the local
 * state must be restored to its pre-mutation snapshot and the error
 * re-thrown so the caller can surface a toast.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockRemoteDeleteProject = vi.fn()

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchProjects: vi.fn().mockResolvedValue([]),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    saveProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: mockRemoteDeleteProject,
    fetchTasks: vi.fn().mockResolvedValue([]),
    saveTask: vi.fn().mockResolvedValue(undefined),
    saveTasks: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    restoreTask: vi.fn().mockResolvedValue(undefined),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroups: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheProjects: vi.fn(),
  getCachedProjects: vi.fn().mockResolvedValue([]),
  cacheTasks: vi.fn(),
  getCachedTasks: vi.fn().mockResolvedValue([]),
}))

import { useProjectStore } from '../projects'

describe('BUG-1775 — project delete rollback on remote failure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRemoteDeleteProject.mockReset()
  })

  it('restores _rawProjects when deleteProject remote call rejects', async () => {
    const store = useProjectStore()
    const project = await store.createProject({ name: 'Will Fail' })
    expect(store.projects.find(p => p.id === project.id)).toBeTruthy()

    mockRemoteDeleteProject.mockRejectedValueOnce(new Error('network error'))

    await expect(store.deleteProject(project.id)).rejects.toThrow('network error')

    // After rollback the project must still be present
    expect(store.projects.find(p => p.id === project.id)).toBeTruthy()
    expect(store._rawProjects.find(p => p.id === project.id)).toBeTruthy()
  })

  it('completes normally when deleteProject remote call resolves', async () => {
    const store = useProjectStore()
    const project = await store.createProject({ name: 'Will Succeed' })

    mockRemoteDeleteProject.mockResolvedValueOnce(undefined)

    await store.deleteProject(project.id)

    expect(store.projects.find(p => p.id === project.id)).toBeUndefined()
  })

  it('restores all projects when any remote call in deleteProjects rejects', async () => {
    const store = useProjectStore()
    const a = await store.createProject({ name: 'A' })
    const b = await store.createProject({ name: 'B' })
    const c = await store.createProject({ name: 'C' })

    // Fail on the second id; the first and third succeed.
    mockRemoteDeleteProject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('server rejected'))
      .mockResolvedValueOnce(undefined)

    await expect(store.deleteProjects([a.id, b.id, c.id])).rejects.toThrow()

    // Snapshot rollback: all three projects present again.
    expect(store.projects.find(p => p.id === a.id)).toBeTruthy()
    expect(store.projects.find(p => p.id === b.id)).toBeTruthy()
    expect(store.projects.find(p => p.id === c.id)).toBeTruthy()
  })
})
