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
import type { WriteOperation } from '@/types/sync'
import { applyPendingGroupPatch, applyPendingTaskPatch } from './pendingWritePatch'

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

  constructor(databaseName: string) {
    super(databaseName)

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

export interface ReadCacheScope {
  userId: string
  workspaceId: string | null
}

// A scope gets its own physical database so entity IDs and metadata can never
// collide across accounts or workspaces. The legacy unscoped database is not
// opened by this module.
let activeScope: ReadCacheScope | null = null
let activeScopeEpoch = 0
const databases = new Map<string, ReadCacheDatabase>()
const READ_CACHE_SCOPE_REGISTRY_KEY = 'flowstate-read-cache-v2-scopes'

function scopeDatabaseName(scope: ReadCacheScope): string {
  return `FlowStateReadCache-v2:${scope.userId}:${scope.workspaceId ?? 'personal'}`
}

function readScopeRegistry(): Set<string> {
  try {
    const value = localStorage.getItem(READ_CACHE_SCOPE_REGISTRY_KEY)
    const names = value ? JSON.parse(value) : []
    return new Set(Array.isArray(names) ? names.filter(name => typeof name === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeScopeRegistry(names: Set<string>): void {
  try {
    localStorage.setItem(READ_CACHE_SCOPE_REGISTRY_KEY, JSON.stringify([...names]))
  } catch {
    // IndexedDB enumeration remains the fallback when localStorage is unavailable.
  }
}

function registerScopeDatabase(name: string): void {
  const names = readScopeRegistry()
  names.add(name)
  writeScopeRegistry(names)
}

export function configureReadCacheScope(scope: ReadCacheScope | null): void {
  if (
    activeScope?.userId === scope?.userId
    && activeScope?.workspaceId === scope?.workspaceId
  ) return
  activeScope = scope ? { ...scope } : null
  activeScopeEpoch++
}

export function getReadCacheScope(): ReadCacheScope | null {
  return activeScope ? { ...activeScope } : null
}

export interface ReadCacheScopeToken {
  scope: ReadCacheScope
  epoch: number
}

export function captureReadCacheScope(): ReadCacheScopeToken | null {
  return activeScope ? { scope: { ...activeScope }, epoch: activeScopeEpoch } : null
}

export function isReadCacheScopeTokenCurrent(token: ReadCacheScopeToken): boolean {
  return token.epoch === activeScopeEpoch
    && token.scope.userId === activeScope?.userId
    && token.scope.workspaceId === activeScope?.workspaceId
}

function getDB(scope: ReadCacheScope | null = activeScope): ReadCacheDatabase {
  if (!scope) {
    throw new Error('Read cache scope is not configured')
  }
  const name = scopeDatabaseName(scope)
  let database = databases.get(name)
  if (!database) {
    database = new ReadCacheDatabase(name)
    databases.set(name, database)
    registerScopeDatabase(name)
  }
  return database
}

// ── Tasks ──────────────────────────────────────────────────────────────

/**
 * Cache all tasks (full snapshot replace).
 * Called after every successful Supabase fetch + smart merge.
 */
export async function cacheTasks(
  tasks: Task[],
  options: { throwOnError?: boolean; scopeToken?: ReadCacheScopeToken } = {},
): Promise<void> {
  try {
    if (options.scopeToken && !isReadCacheScopeTokenCurrent(options.scopeToken)) {
      throw new Error('Read cache scope changed during task load')
    }
    const database = getDB(options.scopeToken?.scope)
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
    if (
      options.throwOnError
      || (options.scopeToken && !isReadCacheScopeTokenCurrent(options.scopeToken))
    ) throw e
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
export async function cacheGroups(
  groups: CanvasGroup[],
  options: { scopeToken?: ReadCacheScopeToken; throwOnError?: boolean } = {},
): Promise<void> {
  try {
    if (options.scopeToken && !isReadCacheScopeTokenCurrent(options.scopeToken)) {
      throw new Error('Read cache scope changed during group load')
    }
    const database = getDB(options.scopeToken?.scope)
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
    if (options.throwOnError) throw e
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
export async function cacheProjects(
  projects: Project[],
  options: { scopeToken?: ReadCacheScopeToken; throwOnError?: boolean } = {},
): Promise<void> {
  try {
    if (options.scopeToken && !isReadCacheScopeTokenCurrent(options.scopeToken)) {
      throw new Error('Read cache scope changed during project load')
    }
    const database = getDB(options.scopeToken?.scope)
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
    if (options.throwOnError) throw e
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

export interface PendingTaskWriteScope {
  userId: string
  workspaceId: string | null
}

export interface PendingTaskProjection {
  tasks: Task[]
  pendingTaskIds: Set<string>
}

/**
 * Apply the durable task write queue over an arbitrary canonical projection.
 * Exact-scope mode fails closed for legacy/unscoped operations: ambiguous rows
 * are quarantined as conflicts so catch-up never replays unknown local intent.
 */
export async function overlayPendingTaskWrites(
  baseTasks: Task[],
  options: {
    scope?: PendingTaskWriteScope
    fallbackTasks?: Task[]
  } = {},
): Promise<PendingTaskProjection> {
  const { getWriteQueueDB } = await import('@/services/offline/writeQueueDB')
  if (options.scope) {
    await import('@/services/offline/writeQueueDB').then(async ({
      repairLegacyOperationScope,
      quarantineUnscopedOperations,
    }) => {
      await repairLegacyOperationScope(options.scope!)
      await quarantineUnscopedOperations(options.scope!)
    })
  }
  const allUnsynced = await getWriteQueueDB().operations
    .where('status')
    .anyOf(['pending', 'failed', 'syncing'])
    .toArray()

  const pendingOps = allUnsynced
    .filter((op): op is WriteOperation => op.entityType === 'task')
    .filter((op) => {
      if (!options.scope) return true
      if (!op.userId || op.workspaceId === undefined) return false
      return op.userId === options.scope.userId
        && op.workspaceId === options.scope.workspaceId
    })
    .sort((a, b) => a.createdAt - b.createdAt)

  const pendingTaskIds = new Set(pendingOps.map(op => op.entityId))
  const taskMap = new Map(baseTasks.map(task => [task.id, task]))
  const fallbackMap = new Map((options.fallbackTasks ?? []).map(task => [task.id, task]))
  const { fromSupabaseTask } = await import('@/utils/supabaseMappers')

  for (const op of pendingOps) {
    if (op.operation === 'delete') {
      taskMap.delete(op.entityId)
      continue
    }
    if (op.operation === 'create') {
      taskMap.set(
        op.entityId,
        fromSupabaseTask(op.payload as unknown as import('@/utils/supabaseMappers').SupabaseTask),
      )
      continue
    }
    const existing = taskMap.get(op.entityId) ?? fallbackMap.get(op.entityId)
    if (!existing) {
      throw new Error(`Durable task update ${op.entityId} has no recoverable base projection`)
    }
    taskMap.set(op.entityId, applyPendingTaskPatch(existing, op.payload))
  }

  return { tasks: [...taskMap.values()], pendingTaskIds }
}

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
  const scope = getReadCacheScope()
  if (!scope) return null
  // TASK-1427: Load base snapshot
  const cachedTasks = await getCachedTasks()
  try {
    const projection = await overlayPendingTaskWrites(cachedTasks ?? [], { scope })
    if (projection.pendingTaskIds.size > 0) {
      console.log(
        `📦 [READ-CACHE] TASK-1427: Merged ${cachedTasks?.length ?? 0} cached + ${projection.pendingTaskIds.size} pending task(s) → ${projection.tasks.length} tasks`
      )
    }
    return projection.tasks.length > 0 ? projection.tasks : null
  } catch (e) {
    console.warn('[READ-CACHE] TASK-1427: Could not load pending writes for tasks:', e)
    return cachedTasks
  }
}

/**
 * Load groups from cache AND apply any pending (unsynced) write operations on top.
 *
 * Same merge strategy as getCachedTasksWithPendingWrites() but for canvas groups.
 * Includes 'pending', 'failed', and 'syncing' write-queue entries for entity type 'group'.
 */
export async function getCachedGroupsWithPendingWrites(): Promise<CanvasGroup[] | null> {
  const scope = getReadCacheScope()
  if (!scope) return null
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

    pendingOps = allUnsynced
      .filter(op => op.entityType === 'group')
      .filter((op) => {
        if (!op.userId || op.workspaceId === undefined) {
          throw new Error('Read cache found an unscoped durable group operation')
        }
        return op.userId === scope.userId && op.workspaceId === scope.workspaceId
      })
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
    mapPayloadToGroup = (payload) => fromSupabaseGroup(payload as unknown as import('@/utils/supabaseMappers').SupabaseGroup)
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
          groupMap.set(op.entityId, applyPendingGroupPatch(existing, op.payload))
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
export async function clearReadCache(scope: ReadCacheScope | null = activeScope): Promise<void> {
  try {
    const database = getDB(scope)
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

export async function deleteReadCacheScope(scope: ReadCacheScope): Promise<void> {
  const name = scopeDatabaseName(scope)
  const database = databases.get(name)
  database?.close()
  databases.delete(name)
  await Dexie.delete(name)
  const names = readScopeRegistry()
  names.delete(name)
  writeScopeRegistry(names)
}

export async function deleteReadCacheScopesForUser(userId: string): Promise<void> {
  const prefix = `FlowStateReadCache-v2:${userId}:`
  const names = readScopeRegistry()
  for (const name of databases.keys()) names.add(name)

  if (typeof indexedDB.databases === 'function') {
    try {
      for (const database of await indexedDB.databases()) {
        if (database.name) names.add(database.name)
      }
    } catch {
      // The persisted registry and opened-database map remain authoritative fallbacks.
    }
  }

  const accountNames = [...names].filter(name => name.startsWith(prefix))
  await Promise.all(accountNames.map(async name => {
    databases.get(name)?.close()
    databases.delete(name)
    await Dexie.delete(name)
    names.delete(name)
  }))
  writeScopeRegistry(names)
}
