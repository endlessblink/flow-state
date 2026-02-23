/**
 * BUG-1411 / TASK-1177: IndexedDB Read Cache for Offline-First Loading
 *
 * This is the READ-SIDE cache complement to writeQueueDB.ts (WRITE-SIDE).
 *
 * Purpose:
 * - Cache tasks, groups, and projects in IndexedDB after each successful Supabase fetch
 * - When Supabase is unreachable (VPS down, network failure), serve data from cache
 * - App loads with last-known-good data instead of showing empty state
 *
 * Architecture:
 * - Separate database from FlowStateSyncQueue (clean separation of concerns)
 * - Each entity type (tasks/groups/projects) is stored as a bulk snapshot
 * - Cache is updated atomically on each successful load (full replace, not merge)
 * - Cache timestamp tracks freshness for UI indicators
 *
 * NOT a sync mechanism — this is purely a read cache. The write queue
 * (writeQueueDB.ts) handles durable offline writes.
 */

import Dexie, { type Table } from 'dexie'
import type { Task, Project } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

/** Metadata entry for tracking cache freshness */
interface CacheMeta {
  key: string
  updatedAt: number
  count: number
}

/**
 * FlowState Read Cache Database
 *
 * Stores snapshots of tasks, groups, and projects for offline loading.
 * Uses Dexie.js for type-safe IndexedDB access.
 */
class ReadCacheDatabase extends Dexie {
  tasks!: Table<Task, string>
  groups!: Table<CanvasGroup, string>
  projects!: Table<Project, string>
  meta!: Table<CacheMeta, string>

  constructor() {
    super('FlowStateReadCache')

    this.version(1).stores({
      // Primary key is the entity's id field
      tasks: 'id',
      groups: 'id',
      projects: 'id',
      // Metadata: tracks when each entity type was last cached
      meta: 'key',
    })
  }
}

// Singleton instance
let db: ReadCacheDatabase | null = null

function getDB(): ReadCacheDatabase {
  if (!db) {
    db = new ReadCacheDatabase()
  }
  return db
}

// ── Tasks ──────────────────────────────────────────────────────────────

/**
 * Cache all tasks (full snapshot replace).
 * Called after every successful Supabase fetch + smart merge.
 */
export async function cacheTasks(tasks: Task[]): Promise<void> {
  try {
    const database = getDB()
    await database.transaction('rw', database.tasks, database.meta, async () => {
      await database.tasks.clear()
      if (tasks.length > 0) {
        await database.tasks.bulkPut(tasks)
      }
      await database.meta.put({
        key: 'tasks',
        updatedAt: Date.now(),
        count: tasks.length,
      })
    })
    if (import.meta.env.DEV) {
      console.log(`📦 [READ-CACHE] Cached ${tasks.length} tasks`)
    }
  } catch (e) {
    console.warn('[READ-CACHE] Failed to cache tasks:', e)
  }
}

/**
 * Load tasks from cache. Returns null if cache is empty/unavailable.
 */
export async function getCachedTasks(): Promise<Task[] | null> {
  try {
    const database = getDB()
    const tasks = await database.tasks.toArray()
    if (tasks.length === 0) return null

    const meta = await database.meta.get('tasks')
    const ageMs = meta ? Date.now() - meta.updatedAt : Infinity
    const ageMin = Math.round(ageMs / 60_000)

    console.log(`📦 [READ-CACHE] Loaded ${tasks.length} tasks from cache (${ageMin}min old)`)
    return tasks
  } catch (e) {
    console.warn('[READ-CACHE] Failed to read cached tasks:', e)
    return null
  }
}

// ── Groups ─────────────────────────────────────────────────────────────

/**
 * Cache all canvas groups (full snapshot replace).
 */
export async function cacheGroups(groups: CanvasGroup[]): Promise<void> {
  try {
    const database = getDB()
    await database.transaction('rw', database.groups, database.meta, async () => {
      await database.groups.clear()
      if (groups.length > 0) {
        await database.groups.bulkPut(groups)
      }
      await database.meta.put({
        key: 'groups',
        updatedAt: Date.now(),
        count: groups.length,
      })
    })
    if (import.meta.env.DEV) {
      console.log(`📦 [READ-CACHE] Cached ${groups.length} groups`)
    }
  } catch (e) {
    console.warn('[READ-CACHE] Failed to cache groups:', e)
  }
}

/**
 * Load groups from cache. Returns null if cache is empty/unavailable.
 */
export async function getCachedGroups(): Promise<CanvasGroup[] | null> {
  try {
    const database = getDB()
    const groups = await database.groups.toArray()
    if (groups.length === 0) return null

    const meta = await database.meta.get('groups')
    const ageMs = meta ? Date.now() - meta.updatedAt : Infinity
    const ageMin = Math.round(ageMs / 60_000)

    console.log(`📦 [READ-CACHE] Loaded ${groups.length} groups from cache (${ageMin}min old)`)
    return groups
  } catch (e) {
    console.warn('[READ-CACHE] Failed to read cached groups:', e)
    return null
  }
}

// ── Projects ───────────────────────────────────────────────────────────

/**
 * Cache all projects (full snapshot replace).
 */
export async function cacheProjects(projects: Project[]): Promise<void> {
  try {
    const database = getDB()
    await database.transaction('rw', database.projects, database.meta, async () => {
      await database.projects.clear()
      if (projects.length > 0) {
        await database.projects.bulkPut(projects)
      }
      await database.meta.put({
        key: 'projects',
        updatedAt: Date.now(),
        count: projects.length,
      })
    })
    if (import.meta.env.DEV) {
      console.log(`📦 [READ-CACHE] Cached ${projects.length} projects`)
    }
  } catch (e) {
    console.warn('[READ-CACHE] Failed to cache projects:', e)
  }
}

/**
 * Load projects from cache. Returns null if cache is empty/unavailable.
 */
export async function getCachedProjects(): Promise<Project[] | null> {
  try {
    const database = getDB()
    const projects = await database.projects.toArray()
    if (projects.length === 0) return null

    const meta = await database.meta.get('projects')
    const ageMs = meta ? Date.now() - meta.updatedAt : Infinity
    const ageMin = Math.round(ageMs / 60_000)

    console.log(`📦 [READ-CACHE] Loaded ${projects.length} projects from cache (${ageMin}min old)`)
    return projects
  } catch (e) {
    console.warn('[READ-CACHE] Failed to read cached projects:', e)
    return null
  }
}

// ── Utilities ──────────────────────────────────────────────────────────

/**
 * Get cache age in milliseconds for a specific entity type.
 * Returns Infinity if no cache exists.
 */
export async function getCacheAge(entityType: 'tasks' | 'groups' | 'projects'): Promise<number> {
  try {
    const database = getDB()
    const meta = await database.meta.get(entityType)
    return meta ? Date.now() - meta.updatedAt : Infinity
  } catch {
    return Infinity
  }
}

/**
 * Get cache metadata for all entity types.
 */
export async function getCacheStats(): Promise<{
  tasks: CacheMeta | undefined
  groups: CacheMeta | undefined
  projects: CacheMeta | undefined
}> {
  try {
    const database = getDB()
    const [tasks, groups, projects] = await Promise.all([
      database.meta.get('tasks'),
      database.meta.get('groups'),
      database.meta.get('projects'),
    ])
    return { tasks, groups, projects }
  } catch {
    return { tasks: undefined, groups: undefined, projects: undefined }
  }
}

/**
 * Clear all cached data. Used on sign-out or manual cache reset.
 */
export async function clearReadCache(): Promise<void> {
  try {
    const database = getDB()
    await Promise.all([
      database.tasks.clear(),
      database.groups.clear(),
      database.projects.clear(),
      database.meta.clear(),
    ])
    console.log('🗑️ [READ-CACHE] Cache cleared')
  } catch (e) {
    console.warn('[READ-CACHE] Failed to clear cache:', e)
  }
}
