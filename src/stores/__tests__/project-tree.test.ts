/**
 * BUG-1775 — projectTree canonical getter.
 *
 * Shared nested-tree source used by Quick Sort CategorySelector + any other
 * consumer that needs the hierarchy. Orphans whose parentId points at a
 * no-longer-existing project must be re-bucketed under the null root so
 * they stay reachable from a single traversal (they would otherwise vanish
 * from every flat view and users could not re-parent them).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchProjects: vi.fn().mockResolvedValue([]),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    saveProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    fetchTasks: vi.fn().mockResolvedValue([]),
    saveTasks: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheProjects: vi.fn(),
  getCachedProjects: vi.fn().mockResolvedValue([]),
}))

import { useProjectStore } from '../projects'

describe('BUG-1775 — projectTree canonical getter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('builds a nested tree preserving depth', async () => {
    const store = useProjectStore()
    const work = await store.createProject({ name: 'Work' })
    await store.createProject({ name: 'Engineering', parentId: work.id })
    const home = await store.createProject({ name: 'Home' })

    const tree = store.projectTree
    const workNode = tree.find(n => n.project.id === work.id)!
    const homeNode = tree.find(n => n.project.id === home.id)!

    expect(workNode.depth).toBe(0)
    expect(workNode.children).toHaveLength(1)
    expect(workNode.children[0].depth).toBe(1)
    expect(workNode.children[0].project.name).toBe('Engineering')

    expect(homeNode.depth).toBe(0)
    expect(homeNode.children).toHaveLength(0)
  })

  it('re-buckets orphans under the null root', async () => {
    const store = useProjectStore()
    const root = await store.createProject({ name: 'Root' })
    // Manually inject an orphan whose parentId points at a nonexistent project.
    // Simulates the real-world state where a parent was deleted without
    // re-parenting its children cleanly (see BUG-1775 investigation).
    store._rawProjects.push({
      id: 'orphan-id',
      name: 'Orphan',
      color: '#4ECDC4',
      colorType: 'hex',
      viewType: 'status',
      parentId: 'no-such-parent',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const tree = store.projectTree
    const rootIds = tree.map(n => n.project.id)

    expect(rootIds).toContain(root.id)
    expect(rootIds).toContain('orphan-id')
  })
})
