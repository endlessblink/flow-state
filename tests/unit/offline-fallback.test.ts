/**
 * BUG-1411: Offline Fallback Behavior Tests
 *
 * Tests the cache write-on-success → cache read-on-failure cycle at the
 * readCacheDB layer. Validates that:
 *   1. After a successful load, data is cached to IndexedDB
 *   2. When Supabase is unreachable, the cache provides the fallback data
 *   3. The app degrades gracefully to empty state when no cache exists
 *   4. Cache is cleared on sign-out, preventing cross-user data leakage
 *
 * These are scenario/integration-style tests against the readCacheDB API
 * (the actual offline fallback contract) rather than per-function unit tests.
 * Per-function unit tests live in tests/unit/services/offline/readCacheDB.test.ts.
 */

// Must be imported before anything that opens IndexedDB
import 'fake-indexeddb/auto'

import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import {
  cacheTasks,
  getCachedTasks,
  cacheGroups,
  getCachedGroups,
  cacheProjects,
  getCachedProjects,
  getCacheAge,
  getCacheStats,
  clearReadCache,
} from '@/services/offline/readCacheDB'
import type { Task, Project } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

// ── Realistic fixtures ──────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Fix login bug',
    description: 'Users cannot log in with Google OAuth',
    status: 'in_progress',
    priority: 'high',
    progress: 25,
    completedPomodoros: 2,
    subtasks: [],
    dueDate: '2026-03-15',
    projectId: 'proj-backend',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-02-20T14:30:00Z'),
    ...overrides,
  }
}

function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: 'group-1',
    name: 'In Progress',
    type: 'status',
    position: { x: 200, y: 150, width: 500, height: 350 },
    color: '#4ECDC4',
    layout: 'vertical',
    isVisible: true,
    isCollapsed: false,
    propertyValue: 'in_progress',
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-backend',
    name: 'Backend API',
    color: '#FF6B6B',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    ...overrides,
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await clearReadCache()
})

afterEach(async () => {
  await clearReadCache()
})

// ── 1. Tasks offline fallback cycle ────────────────────────────────────────

describe('Tasks offline fallback cycle (BUG-1411)', () => {
  it('caches tasks on successful load, returns them on subsequent read', async () => {
    // Simulates: Supabase fetch succeeded → cache written
    const tasks = [
      makeTask({ id: 'task-a', title: 'Auth refactor' }),
      makeTask({ id: 'task-b', title: 'Rate limiting', status: 'planned' }),
      makeTask({ id: 'task-c', title: 'Deploy pipeline', priority: 'medium' }),
    ]
    await cacheTasks(tasks)

    // Simulates: Next load attempt — Supabase unreachable → read from cache
    const cached = await getCachedTasks()
    expect(cached).not.toBeNull()
    expect(cached!.length).toBe(3)

    const cachedIds = cached!.map((t) => t.id).sort()
    expect(cachedIds).toEqual(['task-a', 'task-b', 'task-c'])
  })

  it('overwrites stale cache when Supabase comes back online (full snapshot replace)', async () => {
    // First successful load
    const firstLoad = [makeTask({ id: 'task-old', title: 'Old task' })]
    await cacheTasks(firstLoad)

    // Supabase returns updated data on next successful load
    const secondLoad = [
      makeTask({ id: 'task-new-1', title: 'New task 1' }),
      makeTask({ id: 'task-new-2', title: 'New task 2' }),
    ]
    await cacheTasks(secondLoad)

    const cached = await getCachedTasks()
    expect(cached!.length).toBe(2)
    expect(cached!.find((t) => t.id === 'task-old')).toBeUndefined()
    expect(cached!.find((t) => t.id === 'task-new-1')).toBeDefined()
  })

  it('preserves all task fields through the cache round-trip', async () => {
    const originalTask = makeTask({
      id: 'task-roundtrip',
      title: 'Complete TypeScript migration',
      description: 'Migrate all .js files to .ts with strict mode',
      status: 'in_progress',
      priority: 'high',
      progress: 60,
      completedPomodoros: 8,
      projectId: 'proj-frontend',
      dueDate: '2026-04-01',
      tags: ['typescript', 'migration', 'tech-debt'],
    })

    await cacheTasks([originalTask])
    const cached = await getCachedTasks()
    const retrieved = cached![0]

    expect(retrieved.id).toBe(originalTask.id)
    expect(retrieved.title).toBe(originalTask.title)
    expect(retrieved.description).toBe(originalTask.description)
    expect(retrieved.status).toBe(originalTask.status)
    expect(retrieved.priority).toBe(originalTask.priority)
    expect(retrieved.progress).toBe(originalTask.progress)
    expect(retrieved.completedPomodoros).toBe(originalTask.completedPomodoros)
    expect(retrieved.projectId).toBe(originalTask.projectId)
    expect(retrieved.dueDate).toBe(originalTask.dueDate)
    expect(retrieved.tags).toEqual(originalTask.tags)
  })
})

// ── 2. Projects offline fallback cycle ─────────────────────────────────────

describe('Projects offline fallback cycle (BUG-1411)', () => {
  it('caches projects on successful load, returns them on subsequent read', async () => {
    const projects = [
      makeProject({ id: 'proj-1', name: 'Backend API' }),
      makeProject({ id: 'proj-2', name: 'Frontend App', color: '#4ECDC4' }),
    ]
    await cacheProjects(projects)

    const cached = await getCachedProjects()
    expect(cached).not.toBeNull()
    expect(cached!.length).toBe(2)

    const cachedIds = cached!.map((p) => p.id).sort()
    expect(cachedIds).toEqual(['proj-1', 'proj-2'])
  })

  it('overwrites stale project cache on next successful load', async () => {
    await cacheProjects([makeProject({ id: 'proj-stale', name: 'Old Project' })])
    await cacheProjects([makeProject({ id: 'proj-fresh', name: 'Fresh Project' })])

    const cached = await getCachedProjects()
    expect(cached!.length).toBe(1)
    expect(cached![0].id).toBe('proj-fresh')
  })

  it('preserves all project fields through the cache round-trip', async () => {
    const project = makeProject({
      id: 'proj-roundtrip',
      name: 'Infrastructure',
      color: '#845EC2',
      colorType: 'hex',
      viewType: 'priority',
    })

    await cacheProjects([project])
    const cached = await getCachedProjects()
    const retrieved = cached![0]

    expect(retrieved.id).toBe(project.id)
    expect(retrieved.name).toBe(project.name)
    expect(retrieved.color).toBe(project.color)
    expect(retrieved.colorType).toBe(project.colorType)
    expect(retrieved.viewType).toBe(project.viewType)
  })
})

// ── 3. Groups offline fallback cycle ───────────────────────────────────────

describe('Groups (canvas) offline fallback cycle (BUG-1411)', () => {
  it('caches groups on successful load, returns them on subsequent read', async () => {
    const groups = [
      makeGroup({ id: 'g-1', name: 'Backlog' }),
      makeGroup({ id: 'g-2', name: 'Sprint', type: 'custom', position: { x: 800, y: 200, width: 600, height: 400 } }),
    ]
    await cacheGroups(groups)

    const cached = await getCachedGroups()
    expect(cached).not.toBeNull()
    expect(cached!.length).toBe(2)
  })

  it('preserves group position data through the cache round-trip', async () => {
    const group = makeGroup({
      id: 'g-positions',
      name: 'High Priority Zone',
      position: { x: 1234, y: 567, width: 800, height: 600 },
    })

    await cacheGroups([group])
    const cached = await getCachedGroups()
    const retrieved = cached![0]

    expect(retrieved.position.x).toBe(1234)
    expect(retrieved.position.y).toBe(567)
    expect(retrieved.position.width).toBe(800)
    expect(retrieved.position.height).toBe(600)
  })

  it('preserves all group fields through the cache round-trip', async () => {
    const group = makeGroup({
      id: 'g-roundtrip',
      name: 'Done Items',
      type: 'status',
      color: '#06D6A0',
      layout: 'grid',
      isCollapsed: true,
      isVisible: true,
      propertyValue: 'done',
    })

    await cacheGroups([group])
    const cached = await getCachedGroups()
    const retrieved = cached![0]

    expect(retrieved.id).toBe(group.id)
    expect(retrieved.name).toBe(group.name)
    expect(retrieved.type).toBe(group.type)
    expect(retrieved.color).toBe(group.color)
    expect(retrieved.layout).toBe(group.layout)
    expect(retrieved.isCollapsed).toBe(group.isCollapsed)
    expect(retrieved.isVisible).toBe(group.isVisible)
    expect(retrieved.propertyValue).toBe(group.propertyValue)
  })
})

// ── 4. Cache freshness tracking ─────────────────────────────────────────────

describe('Cache freshness tracking (BUG-1411)', () => {
  it('getCacheStats reflects correct timestamps and counts after caching', async () => {
    const before = Date.now()
    await cacheTasks([makeTask({ id: 't-1' }), makeTask({ id: 't-2' })])
    await cacheGroups([makeGroup({ id: 'g-1' })])
    await cacheProjects([makeProject({ id: 'p-1' }), makeProject({ id: 'p-2' }), makeProject({ id: 'p-3' })])
    const after = Date.now()

    const stats = await getCacheStats()

    expect(stats.tasks).toBeDefined()
    expect(stats.tasks!.count).toBe(2)
    expect(stats.tasks!.key).toBe('tasks')
    expect(stats.tasks!.updatedAt).toBeGreaterThanOrEqual(before)
    expect(stats.tasks!.updatedAt).toBeLessThanOrEqual(after)

    expect(stats.groups).toBeDefined()
    expect(stats.groups!.count).toBe(1)
    expect(stats.groups!.key).toBe('groups')

    expect(stats.projects).toBeDefined()
    expect(stats.projects!.count).toBe(3)
    expect(stats.projects!.key).toBe('projects')
  })

  it('getCacheAge returns a small number (< 1000ms) immediately after caching tasks', async () => {
    await cacheTasks([makeTask()])
    const age = await getCacheAge('tasks')

    expect(age).not.toBe(Infinity)
    expect(age).toBeGreaterThanOrEqual(0)
    expect(age).toBeLessThan(1000)
  })

  it('getCacheAge returns a small number immediately after caching groups', async () => {
    await cacheGroups([makeGroup()])
    const age = await getCacheAge('groups')

    expect(age).not.toBe(Infinity)
    expect(age).toBeGreaterThanOrEqual(0)
    expect(age).toBeLessThan(1000)
  })

  it('getCacheAge returns a small number immediately after caching projects', async () => {
    await cacheProjects([makeProject()])
    const age = await getCacheAge('projects')

    expect(age).not.toBe(Infinity)
    expect(age).toBeGreaterThanOrEqual(0)
    expect(age).toBeLessThan(1000)
  })
})

// ── 5. Full offline scenario ─────────────────────────────────────────────────

describe('Full offline scenario: cache all 3 entity types, read all back (BUG-1411)', () => {
  it('all 3 entity types can be written and read back independently', async () => {
    // Simulates: app loads successfully, all 3 entity types are cached
    const tasks = [
      makeTask({ id: 't-1', title: 'Task One' }),
      makeTask({ id: 't-2', title: 'Task Two', status: 'done' }),
    ]
    const groups = [
      makeGroup({ id: 'g-1', name: 'Sprint Board' }),
    ]
    const projects = [
      makeProject({ id: 'p-1', name: 'Main App' }),
      makeProject({ id: 'p-2', name: 'API Service' }),
    ]

    await Promise.all([
      cacheTasks(tasks),
      cacheGroups(groups),
      cacheProjects(projects),
    ])

    // Simulates: Supabase unreachable — all 3 fallback reads succeed
    const [cachedTasks, cachedGroups, cachedProjects] = await Promise.all([
      getCachedTasks(),
      getCachedGroups(),
      getCachedProjects(),
    ])

    expect(cachedTasks).not.toBeNull()
    expect(cachedTasks!.length).toBe(2)
    expect(cachedTasks!.map((t) => t.id).sort()).toEqual(['t-1', 't-2'])

    expect(cachedGroups).not.toBeNull()
    expect(cachedGroups!.length).toBe(1)
    expect(cachedGroups![0].id).toBe('g-1')

    expect(cachedProjects).not.toBeNull()
    expect(cachedProjects!.length).toBe(2)
    expect(cachedProjects!.map((p) => p.id).sort()).toEqual(['p-1', 'p-2'])
  })

  it('entity types are cached independently — tasks cache does not affect projects cache', async () => {
    await cacheTasks([makeTask({ id: 't-1' })])
    // Do NOT cache projects

    const cachedTasks = await getCachedTasks()
    const cachedProjects = await getCachedProjects()

    expect(cachedTasks).not.toBeNull()
    expect(cachedProjects).toBeNull() // Not cached — fallback returns null
  })
})

// ── 6. Empty cache scenario (first-ever load, VPS down) ───────────────────

describe('Empty cache scenario: first load fails with VPS down (BUG-1411)', () => {
  it('getCachedTasks returns null when no cache exists (new user / cleared DB)', async () => {
    // Cache is empty — simulates first-ever launch with VPS unreachable
    const result = await getCachedTasks()
    expect(result).toBeNull()
  })

  it('getCachedProjects returns null when no cache exists', async () => {
    const result = await getCachedProjects()
    expect(result).toBeNull()
  })

  it('getCachedGroups returns null when no cache exists', async () => {
    const result = await getCachedGroups()
    expect(result).toBeNull()
  })

  it('all 3 cache reads return null simultaneously on first launch with no connectivity', async () => {
    // App gracefully degrades to empty state — no crash, no stale data
    const [tasks, groups, projects] = await Promise.all([
      getCachedTasks(),
      getCachedGroups(),
      getCachedProjects(),
    ])

    expect(tasks).toBeNull()
    expect(groups).toBeNull()
    expect(projects).toBeNull()
  })

  it('getCacheAge returns Infinity for all entity types when cache is empty', async () => {
    expect(await getCacheAge('tasks')).toBe(Infinity)
    expect(await getCacheAge('groups')).toBe(Infinity)
    expect(await getCacheAge('projects')).toBe(Infinity)
  })

  it('getCacheStats returns all undefined when cache is empty', async () => {
    const stats = await getCacheStats()
    expect(stats.tasks).toBeUndefined()
    expect(stats.groups).toBeUndefined()
    expect(stats.projects).toBeUndefined()
  })
})

// ── 7. Cache cleared on sign-out ─────────────────────────────────────────────

describe('Cache cleared on sign-out (BUG-1411): prevents cross-user data leakage', () => {
  it('clearReadCache removes all task data so the next user sees null', async () => {
    // User A caches their tasks
    await cacheTasks([
      makeTask({ id: 'user-a-task-1', title: 'User A private task' }),
      makeTask({ id: 'user-a-task-2', title: 'User A confidential work' }),
    ])

    // User A signs out — cache is cleared
    await clearReadCache()

    // User B's first load — must not see User A's data
    const result = await getCachedTasks()
    expect(result).toBeNull()
  })

  it('clearReadCache removes all project data', async () => {
    await cacheProjects([makeProject({ id: 'p-private', name: 'Secret Project' })])
    await clearReadCache()

    const result = await getCachedProjects()
    expect(result).toBeNull()
  })

  it('clearReadCache removes all group data', async () => {
    await cacheGroups([makeGroup({ id: 'g-private', name: 'Personal Board' })])
    await clearReadCache()

    const result = await getCachedGroups()
    expect(result).toBeNull()
  })

  it('clearReadCache removes all 3 entity types atomically', async () => {
    await cacheTasks([makeTask()])
    await cacheGroups([makeGroup()])
    await cacheProjects([makeProject()])

    await clearReadCache()

    const [tasks, groups, projects] = await Promise.all([
      getCachedTasks(),
      getCachedGroups(),
      getCachedProjects(),
    ])

    expect(tasks).toBeNull()
    expect(groups).toBeNull()
    expect(projects).toBeNull()
  })

  it('getCacheAge returns Infinity for all entity types after sign-out clear', async () => {
    await cacheTasks([makeTask()])
    await cacheGroups([makeGroup()])
    await cacheProjects([makeProject()])

    await clearReadCache()

    expect(await getCacheAge('tasks')).toBe(Infinity)
    expect(await getCacheAge('groups')).toBe(Infinity)
    expect(await getCacheAge('projects')).toBe(Infinity)
  })

  it('new user can cache their own data after sign-out clear', async () => {
    // User A data
    await cacheTasks([makeTask({ id: 'user-a-task', title: 'User A task' })])
    await clearReadCache()

    // User B signs in and caches their data
    await cacheTasks([makeTask({ id: 'user-b-task', title: 'User B task' })])

    const result = await getCachedTasks()
    expect(result).not.toBeNull()
    expect(result!.length).toBe(1)
    expect(result![0].id).toBe('user-b-task')
  })
})

// ── 8. Cache survives across multiple reads (not one-shot) ─────────────────

describe('Cache persistence across multiple reads (BUG-1411)', () => {
  it('getCachedTasks can be called multiple times and always returns the same data', async () => {
    const tasks = [
      makeTask({ id: 'persistent-1', title: 'Always here' }),
      makeTask({ id: 'persistent-2', title: 'Still here' }),
    ]
    await cacheTasks(tasks)

    // Simulate multiple app reloads / re-renders reading from cache
    const read1 = await getCachedTasks()
    const read2 = await getCachedTasks()
    const read3 = await getCachedTasks()

    expect(read1!.length).toBe(2)
    expect(read2!.length).toBe(2)
    expect(read3!.length).toBe(2)

    // Data is identical across all reads
    expect(read1!.map((t) => t.id).sort()).toEqual(read2!.map((t) => t.id).sort())
    expect(read2!.map((t) => t.id).sort()).toEqual(read3!.map((t) => t.id).sort())
  })

  it('getCachedProjects can be called multiple times and always returns the same data', async () => {
    await cacheProjects([makeProject({ id: 'p-stable' })])

    const read1 = await getCachedProjects()
    const read2 = await getCachedProjects()

    expect(read1).not.toBeNull()
    expect(read2).not.toBeNull()
    expect(read1![0].id).toBe('p-stable')
    expect(read2![0].id).toBe('p-stable')
  })

  it('getCachedGroups can be called multiple times and always returns the same data', async () => {
    await cacheGroups([makeGroup({ id: 'g-stable' })])

    const read1 = await getCachedGroups()
    const read2 = await getCachedGroups()

    expect(read1).not.toBeNull()
    expect(read2).not.toBeNull()
    expect(read1![0].id).toBe('g-stable')
    expect(read2![0].id).toBe('g-stable')
  })

  it('reading cache does not consume or modify the stored data', async () => {
    const tasks = [makeTask({ id: 't-immutable' })]
    await cacheTasks(tasks)

    // Read 5 times
    for (let i = 0; i < 5; i++) {
      const result = await getCachedTasks()
      expect(result).not.toBeNull()
      expect(result![0].id).toBe('t-immutable')
    }
  })
})

// ── 9. Large dataset offline fallback ──────────────────────────────────────

describe('Large dataset offline fallback (BUG-1411)', () => {
  it('caches and restores 200 tasks correctly as an offline fallback', async () => {
    const tasks = Array.from({ length: 200 }, (_, i) =>
      makeTask({
        id: `task-bulk-${i}`,
        title: `Bulk task ${i}`,
        status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in_progress' : 'planned',
        priority: i % 2 === 0 ? 'high' : 'medium',
        projectId: `proj-${i % 5}`,
      })
    )

    await cacheTasks(tasks)

    // Simulates offline load
    const cached = await getCachedTasks()
    expect(cached).not.toBeNull()
    expect(cached!.length).toBe(200)

    const stats = await getCacheStats()
    expect(stats.tasks!.count).toBe(200)
  })
})
