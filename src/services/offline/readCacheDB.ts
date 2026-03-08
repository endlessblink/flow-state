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

import { toRaw } from 'vue'
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
        await database.tasks.bulkPut(tasks.map(t => JSON.parse(JSON.stringify(toRaw(t)))))
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
        await database.groups.bulkPut(groups.map(g => JSON.parse(JSON.stringify(toRaw(g)))))
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
        await database.projects.bulkPut(projects.map(p => JSON.parse(JSON.stringify(toRaw(p)))))
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

// ── TASK-1427: Merge write queue into read cache on offline load ────────

/**
 * Load tasks from cache AND apply any pending (unsynced) write operations on top.
 *
 * This solves the problem where tasks created/updated/deleted while offline
 * are stored in the write queue but NOT reflected in the read cache snapshot.
 * On app restart offline those tasks appeared to vanish until the queue synced.
 *
 * Statuses included: 'pending', 'failed', 'syncing'
 * ('syncing' ops that are stuck from a previous session crash are also included
 * so their local changes are not lost from the visible task list)
 *
 * Order of operations is preserved (oldest createdAt first) so that if both
 * a create and an update exist for the same entity the update wins.
 */
export async function getCachedTasksWithPendingWrites(): Promise<Task[] | null> {
  // TASK-1427: Load base snapshot
  const cachedTasks = await getCachedTasks()

  // TASK-1427: Load pending write operations from FlowStateSyncQueue
  let pendingOps: Array<{ entityType: string; operation: string; entityId: string; payload: Record<string, unknown> }> = []
  try {
    const { getWriteQueueDB } = await import('@/services/offline/writeQueueDB')
    const queueDB = getWriteQueueDB()

    // Include 'pending', 'failed', and 'syncing' — all represent locally-committed
    // changes that have not yet been confirmed by Supabase
    const allUnsynced = await queueDB.operations
      .where('status')
      .anyOf(['pending', 'failed', 'syncing'])
      .toArray()

    // Sort ascending by createdAt to preserve operation order
    allUnsynced.sort((a, b) => a.createdAt - b.createdAt)

    pendingOps = allUnsynced.filter(op => op.entityType === 'task')
  } catch (e) {
    console.warn('[READ-CACHE] TASK-1427: Could not load pending writes for tasks:', e)
    return cachedTasks
  }

  if (pendingOps.length === 0) return cachedTasks

  // TASK-1427: Build a mutable map from the cached snapshot (or empty if no cache)
  const taskMap = new Map<string, Task>()
  if (cachedTasks) {
    for (const task of cachedTasks) {
      taskMap.set(task.id, task)
    }
  }

  // TASK-1428: Import mapper to convert write queue payloads (snake_case DB format)
  // to app format (camelCase). Write queue stores payloads in Supabase column format
  // (e.g., created_at, is_in_inbox, status: "planned") but the app expects
  // camelCase fields (createdAt, isInInbox, status: "todo").
  let mapPayloadToTask: ((payload: Record<string, unknown>) => Task) | null = null
  try {
    const { fromSupabaseTask } = await import('@/utils/supabaseMappers')
    mapPayloadToTask = (payload) => fromSupabaseTask(payload as import('@/utils/supabaseMappers').SupabaseTask)
  } catch (e) {
    console.warn('[READ-CACHE] TASK-1428: Could not load mapper, using raw payloads:', e)
  }

  // TASK-1427: Apply pending operations in chronological order
  for (const op of pendingOps) {
    switch (op.operation) {
      case 'create':
        // Only add if not already present in the cache snapshot
        if (!taskMap.has(op.entityId)) {
          // TASK-1428: Convert DB-format payload to app-format Task
          const task = mapPayloadToTask
            ? mapPayloadToTask(op.payload)
            : { id: op.entityId, ...op.payload } as Task
          taskMap.set(op.entityId, task)
        }
        break
      case 'update': {
        const existing = taskMap.get(op.entityId)
        if (existing) {
          // For updates, merge mapped payload on top of existing task
          if (mapPayloadToTask) {
            const mapped = mapPayloadToTask({ ...op.payload, id: op.entityId })
            taskMap.set(op.entityId, { ...existing, ...mapped })
          } else {
            taskMap.set(op.entityId, { ...existing, ...op.payload } as Task)
          }
        }
        break
      }
      case 'delete':
        taskMap.delete(op.entityId)
        break
    }
  }

  const merged = Array.from(taskMap.values())
  console.log(
    `📦 [READ-CACHE] TASK-1427: Merged ${cachedTasks?.length ?? 0} cached + ${pendingOps.length} pending ops → ${merged.length} tasks`
  )
  return merged.length > 0 ? merged : null
}

/**
 * Load groups from cache AND apply any pending (unsynced) write operations on top.
 *
 * Same merge strategy as getCachedTasksWithPendingWrites() but for canvas groups.
 * Includes 'pending', 'failed', and 'syncing' write-queue entries for entity type 'group'.
 */
export async function getCachedGroupsWithPendingWrites(): Promise<CanvasGroup[] | null> {
  // TASK-1427: Load base snapshot
  const cachedGroups = await getCachedGroups()

  // TASK-1427: Load pending write operations from FlowStateSyncQueue
  let pendingOps: Array<{ entityType: string; operation: string; entityId: string; payload: Record<string, unknown> }> = []
  try {
    const { getWriteQueueDB } = await import('@/services/offline/writeQueueDB')
    const queueDB = getWriteQueueDB()

    const allUnsynced = await queueDB.operations
      .where('status')
      .anyOf(['pending', 'failed', 'syncing'])
      .toArray()

    allUnsynced.sort((a, b) => a.createdAt - b.createdAt)

    pendingOps = allUnsynced.filter(op => op.entityType === 'group')
  } catch (e) {
    console.warn('[READ-CACHE] TASK-1427: Could not load pending writes for groups:', e)
    return cachedGroups
  }

  if (pendingOps.length === 0) return cachedGroups

  // TASK-1427: Build a mutable map from the cached snapshot (or empty if no cache)
  const groupMap = new Map<string, CanvasGroup>()
  if (cachedGroups) {
    for (const group of cachedGroups) {
      groupMap.set(group.id, group)
    }
  }

  // TASK-1428: Import mapper for groups (same snake_case→camelCase issue as tasks)
  let mapPayloadToGroup: ((payload: Record<string, unknown>) => CanvasGroup) | null = null
  try {
    const { fromSupabaseGroup } = await import('@/utils/supabaseMappers')
    mapPayloadToGroup = (payload) => fromSupabaseGroup(payload as import('@/utils/supabaseMappers').SupabaseGroup)
  } catch (e) {
    console.warn('[READ-CACHE] TASK-1428: Could not load group mapper:', e)
  }

  // TASK-1427: Apply pending operations in chronological order
  for (const op of pendingOps) {
    switch (op.operation) {
      case 'create':
        if (!groupMap.has(op.entityId)) {
          const group = mapPayloadToGroup
            ? mapPayloadToGroup(op.payload)
            : { id: op.entityId, ...op.payload } as CanvasGroup
          groupMap.set(op.entityId, group)
        }
        break
      case 'update': {
        const existing = groupMap.get(op.entityId)
        if (existing) {
          if (mapPayloadToGroup) {
            const mapped = mapPayloadToGroup({ ...op.payload, id: op.entityId })
            groupMap.set(op.entityId, { ...existing, ...mapped })
          } else {
            groupMap.set(op.entityId, { ...existing, ...op.payload } as CanvasGroup)
          }
        }
        break
      }
      case 'delete':
        groupMap.delete(op.entityId)
        break
    }
  }

  const merged = Array.from(groupMap.values())
  console.log(
    `📦 [READ-CACHE] TASK-1427: Merged ${cachedGroups?.length ?? 0} cached + ${pendingOps.length} pending ops → ${merged.length} groups`
  )
  return merged.length > 0 ? merged : null
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
