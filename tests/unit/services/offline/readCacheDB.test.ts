/**
 * BUG-1411: Tests for the IndexedDB read cache (readCacheDB.ts)
 *
 * Uses fake-indexeddb to simulate IndexedDB in jsdom environment.
 * The `fake-indexeddb/auto` import patches globalThis before Dexie opens the DB.
 */

// Must be imported before anything that opens IndexedDB
import 'fake-indexeddb/auto'

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
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

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    status: 'planned',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-03-01',
    projectId: 'proj-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: 'group-1',
    name: 'Test Group',
    type: 'custom',
    position: { x: 100, y: 200, width: 400, height: 300 },
    color: '#4ECDC4',
    layout: 'vertical',
    isVisible: true,
    isCollapsed: false,
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    color: '#4ECDC4',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await clearReadCache()
})

afterEach(async () => {
  await clearReadCache()
})

// ── Task cache tests ───────────────────────────────────────────────────────

describe('cacheTasks / getCachedTasks', () => {
  it('returns null when the cache is empty', async () => {
    const result = await getCachedTasks()
    expect(result).toBeNull()
  })

  it('stores and retrieves tasks', async () => {
    const tasks = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2', title: 'Second Task' })]

    await cacheTasks(tasks)
    const cached = await getCachedTasks()

    expect(cached).not.toBeNull()
    expect(cached!.length).toBe(2)

    const ids = cached!.map((t) => t.id).sort()
    expect(ids).toEqual(['task-1', 'task-2'])
  })

  it('replaces existing cache on subsequent calls (full snapshot replace)', async () => {
    const firstBatch = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })]
    await cacheTasks(firstBatch)

    const secondBatch = [makeTask({ id: 'task-3', title: 'Only Task Now' })]
    await cacheTasks(secondBatch)

    const cached = await getCachedTasks()
    expect(cached!.length).toBe(1)
    expect(cached![0].id).toBe('task-3')
  })

  it('preserves task fields faithfully after round-trip', async () => {
    const task = makeTask({
      id: 'task-roundtrip',
      title: 'Round Trip',
      status: 'in_progress',
      priority: 'high',
      progress: 42,
      projectId: 'proj-abc',
      tags: ['urgent', 'dev'],
    })

    await cacheTasks([task])
    const cached = await getCachedTasks()
    const retrieved = cached![0]

    expect(retrieved.id).toBe(task.id)
    expect(retrieved.title).toBe(task.title)
    expect(retrieved.status).toBe(task.status)
    expect(retrieved.priority).toBe(task.priority)
    expect(retrieved.progress).toBe(task.progress)
    expect(retrieved.projectId).toBe(task.projectId)
    expect(retrieved.tags).toEqual(task.tags)
  })

  it('caching an empty array stores metadata but getCachedTasks returns null', async () => {
    await cacheTasks([])
    const cached = await getCachedTasks()
    // Empty cache is treated as "no cache" — returns null
    expect(cached).toBeNull()
  })
})

// ── Group cache tests ──────────────────────────────────────────────────────

describe('cacheGroups / getCachedGroups', () => {
  it('preserves group fields faithfully after round-trip', async () => {
    const group = makeGroup({
      id: 'group-roundtrip',
      name: 'Important Section',
      type: 'priority',
      color: '#FF6B6B',
      layout: 'grid',
      isCollapsed: true,
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
  })

  it('caching an empty array makes getCachedGroups return null', async () => {
    await cacheGroups([])
    const result = await getCachedGroups()
    expect(result).toBeNull()
  })
})

// ── Project cache tests ────────────────────────────────────────────────────

describe('cacheProjects / getCachedProjects', () => {
  it('preserves project fields faithfully after round-trip', async () => {
    const project = makeProject({
      id: 'proj-roundtrip',
      name: 'My Project',
      color: '#4ECDC4',
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

  it('caching an empty array makes getCachedProjects return null', async () => {
    await cacheProjects([])
    const result = await getCachedProjects()
    expect(result).toBeNull()
  })
})

// ── getCacheStats tests ────────────────────────────────────────────────────

describe('getCacheStats', () => {
  it('returns undefined for all entity types when cache is empty', async () => {
    const stats = await getCacheStats()
    expect(stats.tasks).toBeUndefined()
    expect(stats.groups).toBeUndefined()
    expect(stats.projects).toBeUndefined()
  })

  it('returns timestamps after caching tasks', async () => {
    const before = Date.now()
    await cacheTasks([makeTask()])
    const after = Date.now()

    const stats = await getCacheStats()
    expect(stats.tasks).toBeDefined()
    expect(stats.tasks!.updatedAt).toBeGreaterThanOrEqual(before)
    expect(stats.tasks!.updatedAt).toBeLessThanOrEqual(after)
    expect(stats.tasks!.count).toBe(1)
    expect(stats.tasks!.key).toBe('tasks')
  })

  it('returns timestamps after caching groups', async () => {
    const groups = [makeGroup({ id: 'g-1' }), makeGroup({ id: 'g-2' })]
    await cacheGroups(groups)

    const stats = await getCacheStats()
    expect(stats.groups).toBeDefined()
    expect(stats.groups!.count).toBe(2)
    expect(stats.groups!.key).toBe('groups')
  })

  it('returns timestamps after caching projects', async () => {
    const projects = [makeProject({ id: 'p-1' }), makeProject({ id: 'p-2' }), makeProject({ id: 'p-3' })]
    await cacheProjects(projects)

    const stats = await getCacheStats()
    expect(stats.projects).toBeDefined()
    expect(stats.projects!.count).toBe(3)
    expect(stats.projects!.key).toBe('projects')
  })

  it('returns correct counts for independently cached entity types', async () => {
    await cacheTasks([makeTask({ id: 't-1' })])
    await cacheGroups([makeGroup({ id: 'g-1' }), makeGroup({ id: 'g-2' })])

    const stats = await getCacheStats()
    expect(stats.tasks!.count).toBe(1)
    expect(stats.groups!.count).toBe(2)
    expect(stats.projects).toBeUndefined()
  })
})

// ── getCacheAge tests ──────────────────────────────────────────────────────

describe('getCacheAge', () => {
  it('returns Infinity when no cache exists for the entity type', async () => {
    expect(await getCacheAge('tasks')).toBe(Infinity)
    expect(await getCacheAge('groups')).toBe(Infinity)
    expect(await getCacheAge('projects')).toBe(Infinity)
  })

  it('returns a non-negative finite age after caching tasks', async () => {
    await cacheTasks([makeTask()])
    const age = await getCacheAge('tasks')

    expect(age).not.toBe(Infinity)
    expect(age).toBeGreaterThanOrEqual(0)
    // Should be less than 5 seconds (we just cached it)
    expect(age).toBeLessThan(5_000)
  })

  it('returns a non-negative finite age after caching groups', async () => {
    await cacheGroups([makeGroup()])
    const age = await getCacheAge('groups')

    expect(age).not.toBe(Infinity)
    expect(age).toBeGreaterThanOrEqual(0)
    expect(age).toBeLessThan(5_000)
  })

  it('returns a non-negative finite age after caching projects', async () => {
    await cacheProjects([makeProject()])
    const age = await getCacheAge('projects')

    expect(age).not.toBe(Infinity)
    expect(age).toBeGreaterThanOrEqual(0)
    expect(age).toBeLessThan(5_000)
  })

  it('age increases over time', async () => {
    await cacheTasks([makeTask()])
    const ageFirst = await getCacheAge('tasks')

    // Advance fake timers or just wait a tick
    await new Promise((r) => setTimeout(r, 10))
    const ageSecond = await getCacheAge('tasks')

    expect(ageSecond).toBeGreaterThanOrEqual(ageFirst)
  })
})

// ── clearReadCache tests ───────────────────────────────────────────────────

describe('clearReadCache', () => {
  it('removes all tasks after clearing', async () => {
    await cacheTasks([makeTask({ id: 't-1' }), makeTask({ id: 't-2' })])
    await clearReadCache()
    const result = await getCachedTasks()
    expect(result).toBeNull()
  })

  it('removes all groups after clearing', async () => {
    await cacheGroups([makeGroup({ id: 'g-1' })])
    await clearReadCache()
    const result = await getCachedGroups()
    expect(result).toBeNull()
  })

  it('removes all projects after clearing', async () => {
    await cacheProjects([makeProject({ id: 'p-1' })])
    await clearReadCache()
    const result = await getCachedProjects()
    expect(result).toBeNull()
  })

  it('clears all entity types simultaneously', async () => {
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

  it('getCacheStats returns all undefined after clearing', async () => {
    await cacheTasks([makeTask()])
    await cacheGroups([makeGroup()])
    await cacheProjects([makeProject()])

    await clearReadCache()

    const stats = await getCacheStats()
    expect(stats.tasks).toBeUndefined()
    expect(stats.groups).toBeUndefined()
    expect(stats.projects).toBeUndefined()
  })

  it('getCacheAge returns Infinity for all types after clearing', async () => {
    await cacheTasks([makeTask()])
    await clearReadCache()

    expect(await getCacheAge('tasks')).toBe(Infinity)
    expect(await getCacheAge('groups')).toBe(Infinity)
    expect(await getCacheAge('projects')).toBe(Infinity)
  })

  it('can cache data again after clearing', async () => {
    await cacheTasks([makeTask({ id: 'original' })])
    await clearReadCache()
    await cacheTasks([makeTask({ id: 'after-clear' })])

    const cached = await getCachedTasks()
    expect(cached!.length).toBe(1)
    expect(cached![0].id).toBe('after-clear')
  })
})

// ── Large dataset tests ────────────────────────────────────────────────────

describe('large dataset handling', () => {
  it('caches and retrieves 500 tasks correctly', async () => {
    const tasks = Array.from({ length: 500 }, (_, i) =>
      makeTask({ id: `task-${i}`, title: `Task ${i}` })
    )

    await cacheTasks(tasks)
    const cached = await getCachedTasks()

    expect(cached).not.toBeNull()
    expect(cached!.length).toBe(500)
  })

  it('stats count reflects large dataset accurately', async () => {
    const tasks = Array.from({ length: 100 }, (_, i) => makeTask({ id: `t-${i}` }))
    await cacheTasks(tasks)

    const stats = await getCacheStats()
    expect(stats.tasks!.count).toBe(100)
  })
})
