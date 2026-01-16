/**
 * useOfflineDatabase.ts - IndexedDB offline storage using Dexie.js
 *
 * Foundation for PWA offline-first functionality.
 * Stores tasks, groups, timer sessions, settings locally.
 *
 * Key features:
 * - Full offline CRUD operations
 * - Schema versioning and migrations
 * - Conflict resolution with latest-wins strategy
 * - Sync queue for pending changes
 */

import Dexie, { type EntityTable } from 'dexie'
import { ref, computed } from 'vue'

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error'

export interface OfflineEntity {
    id: string
    updatedAt: number
    syncedAt?: number
    syncStatus: SyncStatus
    serverVersion?: number
    isDeleted?: boolean
    deletedAt?: number
}

export interface OfflineTask extends OfflineEntity {
    title: string
    description: string
    status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
    priority: 'low' | 'medium' | 'high' | null
    progress: number
    completedPomodoros: number
    estimatedPomodoros: number
    dueDate: string
    projectId: string
    createdAt: number
}

export interface OfflineProject extends OfflineEntity {
    name: string
    color: string
    colorType: 'hex' | 'emoji'
    viewType: 'status' | 'date' | 'priority'
    createdAt: number
}

export interface OfflineGroup extends OfflineEntity {
    name: string
    type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
    position: { x: number; y: number; width: number; height: number }
    color: string
    layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
    isVisible: boolean
    isCollapsed: boolean
    createdAt: number
}

export interface OfflineTimerSession extends OfflineEntity {
    taskId: string
    startTime: number
    duration: number
    remainingTime: number
    isActive: boolean
    isPaused: boolean
    isBreak: boolean
    createdAt: number
}

export interface SyncQueueEntry {
    id: string
    entityType: 'task' | 'project' | 'group' | 'timerSession'
    entityId: string
    operation: 'create' | 'update' | 'delete'
    payload: Record<string, unknown>
    createdAt: number
    attempts: number
}

export class PomoFlowOfflineDB extends Dexie {
    tasks!: EntityTable<OfflineTask, 'id'>
    projects!: EntityTable<OfflineProject, 'id'>
    groups!: EntityTable<OfflineGroup, 'id'>
    timerSessions!: EntityTable<OfflineTimerSession, 'id'>
    syncQueue!: EntityTable<SyncQueueEntry, 'id'>

    constructor() {
        super('PomoFlowOfflineDB')
        this.version(1).stores({
            tasks: 'id, status, projectId, dueDate, syncStatus, updatedAt, isDeleted',
            projects: 'id, syncStatus, updatedAt, isDeleted',
            groups: 'id, type, syncStatus, updatedAt, isDeleted',
            timerSessions: 'id, taskId, isActive, syncStatus, updatedAt',
            syncQueue: 'id, entityType, entityId, operation, createdAt, attempts'
        })
    }
}

let dbInstance: PomoFlowOfflineDB | null = null

export function getOfflineDB(): PomoFlowOfflineDB {
    if (!dbInstance) dbInstance = new PomoFlowOfflineDB()
    return dbInstance
}

export async function closeOfflineDB(): Promise<void> {
    if (dbInstance) { dbInstance.close(); dbInstance = null }
}

export function useOfflineDatabase() {
    const db = getOfflineDB()
    const isOnline = ref(navigator.onLine)
    const pendingSyncCount = ref(0)

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => { isOnline.value = true })
        window.addEventListener('offline', () => { isOnline.value = false })
    }

    const hasPendingChanges = computed(() => pendingSyncCount.value > 0)

    async function addToSyncQueue(
        entityType: SyncQueueEntry['entityType'],
        entityId: string,
        operation: SyncQueueEntry['operation'],
        payload: Record<string, unknown>
    ): Promise<void> {
        await db.syncQueue.add({
            id: crypto.randomUUID(),
            entityType,
            entityId,
            operation,
            payload,
            createdAt: Date.now(),
            attempts: 0
        })
        pendingSyncCount.value = await db.syncQueue.count()
    }

    async function getPendingSyncEntries(): Promise<SyncQueueEntry[]> {
        return db.syncQueue.orderBy('createdAt').toArray()
    }

    async function removeSyncQueueEntry(id: string): Promise<void> {
        await db.syncQueue.delete(id)
        pendingSyncCount.value = await db.syncQueue.count()
    }

    function resolveConflict(localUpdatedAt: number, serverUpdatedAt: number): 'local' | 'server' {
        return localUpdatedAt >= serverUpdatedAt ? 'local' : 'server'
    }

    async function clearAllData(): Promise<void> {
        await db.transaction('rw', [db.tasks, db.projects, db.groups, db.timerSessions, db.syncQueue], async () => {
            await db.tasks.clear()
            await db.projects.clear()
            await db.groups.clear()
            await db.timerSessions.clear()
            await db.syncQueue.clear()
        })
        pendingSyncCount.value = 0
    }

    db.syncQueue.count().then(count => { pendingSyncCount.value = count })

    return {
        isOnline,
        pendingSyncCount,
        hasPendingChanges,
        addToSyncQueue,
        getPendingSyncEntries,
        removeSyncQueueEntry,
        resolveConflict,
        clearAllData,
        db
    }
}
