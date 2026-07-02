import { ref, computed } from 'vue'
import type { CanvasGroup } from '@/types/canvas'
import {
    applySmartGroupNormalizations,
    logGroupIdHistogram,
    getAllDescendantGroupIds
} from '@/utils/canvas/storeHelpers'
import type { Task } from '@/types/tasks'
import { getGroupAbsolutePosition } from '@/utils/canvas/coordinates'
import { type ContainerBounds, isNodeCompletelyInside } from '@/utils/canvas/spatialContainment'
import { cacheGroups } from '@/services/offline/readCacheDB'
// TASK-1871: legacy non-UUID group ids never sync — migrate them to deterministic UUIDs
import { isUuidGroupId, deterministicGroupId, isMigratableDayGroup } from '@/utils/canvas/legacyGroupId'
// TASK-1871: fail-fast guard against write storms (same row hammered)
import { recordWrite } from '@/utils/sync/writeRateGuard'

export const useCanvasGroups = (
    persistence: {
        saveGroupToStorage: (group: CanvasGroup) => Promise<void>
        saveGroupsToLocalStorage: (groups: CanvasGroup[]) => void
        deleteGroupRemote: (id: string) => Promise<void>
    },
    // TASK-1158: Changed from mutable ref to computed ref (via bridge)
    taskStoreRef: { readonly value: { tasks: Task[] } | null }
) => {
    const _rawGroups = ref<CanvasGroup[]>([])
    const activeGroupId = ref<string | null>(null)
    const taskParentVersion = ref(0)
    const syncTrigger = ref(0)
    const activeSectionId = ref<string | null>(null)

    const visibleGroups = computed(() => {
        const result = _rawGroups.value.filter(g => g.isVisible !== false)
        logGroupIdHistogram('visibleGroups', result)
        return result
    })

    const sections = computed(() => _rawGroups.value)

    const bumpTaskParentVersion = () => {
        taskParentVersion.value++
    }

    const setGroups = (newGroups: CanvasGroup[], forceEmpty = false) => {
        if (newGroups.length === 0 && _rawGroups.value.length > 0 && !forceEmpty) {
            console.error('❌ [CANVAS] Refusing to overwrite existing groups with empty array')
            return
        }
        if (import.meta.env.DEV) {
            const incoming = new Set(newGroups.map(g => g.id))
            const removed = _rawGroups.value.filter(g => !incoming.has(g.id))
            if (removed.length > 0) {
                console.log(`[SETGROUPS-DIAG] replacing drops ${removed.length} group(s): ${removed.map(g => `${g.name}/${g.id.slice(0, 8)}`).join(', ')}`, new Error().stack?.split('\n').slice(2, 5).join(' <- '))
            }
        }
        _rawGroups.value = [...newGroups]
    }

    const createGroup = async (groupData: Omit<CanvasGroup, 'id'> | CanvasGroup) => {
        applySmartGroupNormalizations(groupData)
        const newGroup: CanvasGroup = {
            ...groupData,
            id: 'id' in groupData && groupData.id ? groupData.id : crypto.randomUUID(), // TASK-1183: Use proper UUID for Supabase compatibility
            isVisible: true,
            isCollapsed: false,
            // BUG-1127 FIX: Preserve parentGroupId for nested groups
            parentGroupId: groupData.parentGroupId || null,
            positionVersion: 1,
            positionFormat: 'absolute'
        }
        _rawGroups.value.push(newGroup)

        // TASK-1428: Update IndexedDB read cache after create
        cacheGroups([..._rawGroups.value])

        // TASK-1428: Queue for offline-first sync (secondary persistence)
        let queued = false
        try {
            const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
            const syncOrchestrator = useSyncOrchestrator()
            const { useAuthStore } = await import('@/stores/auth')
            const userId = useAuthStore().user?.id
            if (userId) {
                const { toSupabaseGroup } = await import('@/utils/supabaseMappers')
                const payload = toSupabaseGroup(newGroup, userId)
                if (payload) {
                    await syncOrchestrator.enqueue({
                        entityType: 'group',
                        operation: 'create',
                        entityId: newGroup.id,
                        payload: JSON.parse(JSON.stringify(payload)),
                        baseVersion: 0
                    })
                    queued = true
                }
            }
        } catch (queueError) {
            console.warn('[SYNC-QUEUE] Failed to queue group create:', queueError)
        }

        // BUG-1899: saveGroupToStorage ALSO enqueues a remote create op. Calling
        // it unconditionally made every createGroup a DOUBLE remote writer whose
        // stale seed-position snapshot could drain after later edits and
        // out-version them (spy-proven Tidy revert / group move ping-pong).
        // Mirror updateGroup: direct-save only when the queue didn't take it,
        // and keep the local persistence side-effects otherwise.
        if (!queued) {
            await persistence.saveGroupToStorage(newGroup)
        } else {
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        }
        return newGroup
    }

    const updateGroup = async (id: string, updates: Partial<CanvasGroup>) => {
        const index = _rawGroups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            const group = _rawGroups.value[index]

            // TASK-1871: Systemic NO-OP guard. If the only thing this update would change is
            // the position and it's already at that position (within 0.5px on x/y/w/h), drop
            // the position from the update. If nothing else changes, skip the write entirely.
            // This makes write storms from ANY caller (auto-layout, feedback loops) impossible
            // at the source, not just the two known callers.
            if ('position' in updates && updates.position && group.position) {
                const a = group.position, b = updates.position
                const samePos = Math.abs((a.x ?? 0) - (b.x ?? 0)) <= 0.5
                    && Math.abs((a.y ?? 0) - (b.y ?? 0)) <= 0.5
                    && Math.abs((a.width ?? 0) - (b.width ?? 0)) <= 0.5
                    && Math.abs((a.height ?? 0) - (b.height ?? 0)) <= 0.5
                if (samePos) {
                    const rest = { ...updates }
                    delete rest.position
                    if (Object.keys(rest).length === 0) return // pure no-op — never write
                    updates = rest
                }
            }

            if (import.meta.env.DEV) {
                if ('parentGroupId' in updates && updates.parentGroupId !== group.parentGroupId) {
                    console.log(`📍[GROUP-PARENT-WRITE] Group ${id.slice(0, 8)}... (${group.name}) parentGroupId: "${group.parentGroupId ?? 'none'}" → "${updates.parentGroupId ?? 'none'}"`)
                }

                // DRIFT LOGGING: Track ALL position writes
                if ('position' in updates && updates.position) {
                    const oldPos = group.position
                    const newPos = updates.position
                    if (oldPos?.x !== newPos?.x || oldPos?.y !== newPos?.y) {
                        console.log(`📍[GROUP-POS-WRITE] Group "${group.name?.slice(0, 20)}" (${id.slice(0, 8)})`, {
                            before: oldPos ? { x: Math.round(oldPos.x), y: Math.round(oldPos.y) } : null,
                            after: { x: Math.round(newPos.x), y: Math.round(newPos.y) },
                            stack: new Error().stack?.split('\n').slice(2, 6).join(' <- ')
                        })
                    }
                }
            }

            if (updates.name) {
                applySmartGroupNormalizations(updates)
            }

            // TASK-1871: storm tripwire — throws in dev if the SAME group is written
            // many times/sec (a feedback loop), warns in prod. No-ops above are already
            // filtered, so reaching here repeatedly for one id means a real loop.
            recordWrite('group', id)

            const currentVersion = group.positionVersion || 0
            const newVersion = updates.position ? currentVersion + 1 : currentVersion

            _rawGroups.value[index] = {
                ...group,
                ...updates,
                positionVersion: newVersion,
                updatedAt: new Date().toISOString()
            }

            // TASK-1428: Update IndexedDB read cache after update
            cacheGroups([..._rawGroups.value])

            // TASK-1428: Queue for offline-first sync (BUG-1799: single writer)
            let queued = false
            try {
                const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
                const syncOrchestrator = useSyncOrchestrator()
                const { useAuthStore } = await import('@/stores/auth')
                const userId = useAuthStore().user?.id
                if (userId) {
                    const { toSupabaseGroup } = await import('@/utils/supabaseMappers')
                    const payload = toSupabaseGroup(_rawGroups.value[index], userId)
                    if (payload) {
                        await syncOrchestrator.enqueue({
                            entityType: 'group',
                            operation: 'update',
                            entityId: id,
                            payload: JSON.parse(JSON.stringify(payload)),
                            baseVersion: currentVersion
                        })
                        queued = true
                    }
                }
            } catch (queueError) {
                console.warn('[SYNC-QUEUE] Failed to queue group update:', queueError)
            }

            // BUG-1799: Only direct-save as a fallback when the queue did NOT take the write
            // (guest mode / no userId / enqueue failure). Previously this ran unconditionally on
            // top of the enqueue — the second write's fresh `updated_at` out-timestamped the queued
            // op and bumped position_version → LWW "server wins" spam for groups. The enqueue uses
            // the same whole-object toSupabaseGroup mapper, so it is a complete writer.
            if (!queued) {
                await persistence.saveGroupToStorage(_rawGroups.value[index])
            }
        }
    }

    const deleteGroup = async (id: string) => {
        const index = _rawGroups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            // BUG-1510 FIX: Clear parentId on child tasks BEFORE removing the group.
            // Canvas renderer skips tasks whose parentId references a non-existent group,
            // making them invisible. Since canvasPosition is stored in absolute coords,
            // we only need to clear parentId — no position conversion required.
            const childTasks = taskStoreRef.value?.tasks.filter(t => t.parentId === id) ?? []
            if (childTasks.length > 0) {
                try {
                    const { useTaskStore } = await import('@/stores/tasks')
                    const taskStore = useTaskStore()
                    await Promise.all(
                        childTasks.map(t => taskStore.updateTask(t.id, { parentId: undefined }, 'GROUP_DELETE' as Parameters<typeof taskStore.updateTask>[2]))
                    )
                } catch (err) {
                    console.error('[BUG-1510] Failed to clear parentId on child tasks before group delete:', err)
                }
            }

            _rawGroups.value.splice(index, 1)
            if (activeSectionId.value === id) {
                activeSectionId.value = null
            }

            // TASK-1428: Update IndexedDB read cache after delete
            cacheGroups([..._rawGroups.value])

            // TASK-1428: Queue for offline-first sync
            try {
                const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
                const syncOrchestrator = useSyncOrchestrator()
                await syncOrchestrator.enqueue({
                    entityType: 'group',
                    operation: 'delete',
                    entityId: id,
                    payload: { id },
                    baseVersion: 0
                })
            } catch (queueError) {
                console.warn('[SYNC-QUEUE] Failed to queue group delete:', queueError)
            }

            persistence.saveGroupsToLocalStorage(_rawGroups.value)
            await persistence.deleteGroupRemote(id)
        }
    }

    const patchGroups = (updates: Map<string, Partial<CanvasGroup>>) => {
        const result = { patched: [] as string[], skippedLocked: [] as string[], notFound: [] as string[] }
        for (const [groupId, changes] of updates) {
            const group = _rawGroups.value.find(g => g.id === groupId)
            if (!group) {
                result.notFound.push(groupId)
                continue
            }
            Object.assign(group, changes, { updatedAt: new Date().toISOString() })
            result.patched.push(groupId)
        }
        if (result.patched.length > 0) {
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        }
        return result
    }

    const isTaskDone = (task: Task): boolean => task.status === 'done'

    const hasValidCanvasPosition = (task: Task): boolean => {
        const pos = task.canvasPosition
        return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
    }

    const taskCountByGroupId = computed(() => {
        const counts = new Map<string, number>()
        const _version = taskParentVersion.value

        if (!taskStoreRef.value || !taskStoreRef.value.tasks) return counts

        const tasks = taskStoreRef.value.tasks
        const _taskCountTotal = tasks.length

        for (const task of tasks) {
            if (task._soft_deleted || isTaskDone(task)) continue
            if (task.isCompletionRecord || task.isPinned) continue
            if (task.parentId && hasValidCanvasPosition(task)) {
                counts.set(task.parentId, (counts.get(task.parentId) ?? 0) + 1)
            }
        }
        return counts
    })

    const aggregatedTaskCountByGroupId = computed(() => {
        const aggregatedCounts = new Map<string, number>()
        const groups = _rawGroups.value
        const _version = taskParentVersion.value

        if (!taskStoreRef.value || !taskStoreRef.value.tasks) return aggregatedCounts
        const directCounts = taskCountByGroupId.value

        for (const group of groups) {
            const descendantIds = getAllDescendantGroupIds(group.id, groups)
            let total = 0
            for (const gid of descendantIds) {
                total += directCounts.get(gid) ?? 0
            }
            aggregatedCounts.set(group.id, total)
        }
        return aggregatedCounts
    })

    const getTasksInSection = (groupId: string, tasks?: Task[]): Task[] => {
        const sourceTasks = tasks || (taskStoreRef.value?.tasks || [])
        const group = _rawGroups.value.find(g => g.id === groupId)
        if (!group) return []

        const groupAbsolutePos = getGroupAbsolutePosition(groupId, _rawGroups.value)
        const containerBounds: ContainerBounds = {
            position: groupAbsolutePos,
            width: group.position.width,
            height: group.position.height
        }

        return sourceTasks.filter((t: Task) => {
            if (t.canvasPosition) {
                return isNodeCompletelyInside({ position: t.canvasPosition }, containerBounds)
            }
            return false
        })
    }

    // Flag to prevent auto-save after sync updates (breaks circular loop)
    let _syncUpdateInProgress = false

    // BUG-1207 Fix 4.1: Pending group writes tracking (mirrors task pattern)
    const pendingGroupWrites = new Set<string>()

    const addPendingGroupWrite = (groupId: string) => {
        pendingGroupWrites.add(groupId)
    }

    const removePendingGroupWrite = (groupId: string) => {
        pendingGroupWrites.delete(groupId)
    }

    const updateGroupFromSync = (groupId: string, data: Partial<CanvasGroup>) => {
        // SAFETY: Validate incoming data to prevent corrupted groups
        if (!data || typeof data !== 'object') {
            console.warn(`[GROUP-SYNC] Ignoring invalid data for group ${groupId}:`, data)
            return
        }

        // BUG-1207 Fix 4.1: Skip sync if local write is pending (prevents overwriting user's drag)
        if (pendingGroupWrites.has(groupId)) {
            if (import.meta.env.DEV) {
                console.log(`[GROUP-SYNC] Skipping sync for group ${groupId.slice(0, 8)}... - pending local write`)
            }
            return
        }

        // Set flag to prevent watcher from triggering auto-save
        _syncUpdateInProgress = true

        try {
            const index = _rawGroups.value.findIndex(g => g.id === groupId)

            if (index !== -1) {
                const existing = _rawGroups.value[index]

                // BUG-1207 Fix 4.1: Version/timestamp checks - prefer newer data
                const incomingVersion = data.positionVersion ?? 0
                const localVersion = existing.positionVersion ?? 0

                // BUG-1899: total-order version guard. A strictly-older incoming
                // version is stale — INCLUDING version-0/NULL creation echoes.
                // The previous `incomingVersion > 0 &&` precondition let the
                // INSERT echo of a just-created group (position_version NULL)
                // bypass both guards and stomp positions written in between
                // (probe-proven cause of Tidy "3 rows" / group moves reverting).
                if (localVersion > incomingVersion) {
                    if (import.meta.env.DEV) {
                        console.log(`[GROUP-SYNC] Skipping older version for group ${groupId.slice(0, 8)}... (local v${localVersion} > incoming v${incomingVersion})`)
                    }
                    return
                }

                // If versions are equal, compare timestamps
                if (incomingVersion === localVersion && existing.updatedAt && data.updatedAt) {
                    const localTime = new Date(existing.updatedAt).getTime()
                    const incomingTime = new Date(data.updatedAt).getTime()
                    if (localTime > incomingTime) {
                        if (import.meta.env.DEV) {
                            console.log(`[GROUP-SYNC] Skipping older timestamp for group ${groupId.slice(0, 8)}... (local newer by ${localTime - incomingTime}ms)`)
                        }
                        return
                    }
                }

                // BUG-1899: geometry version-authority. positionVersion bumps on
                // every local position write, so the author of version N owns
                // version N's geometry — an EQUAL-version echo can never carry
                // better geometry than what we already have. Without this, a
                // queue op draining late gets a server updated_at at DRAIN time
                // (newer than the local edit stamp) and the equal-version
                // timestamp rule above applies STALE geometry (spy-proven cause
                // of Tidy/group moves reverting seconds later). Only a strictly
                // newer version may move the group; metadata still merges.
                let applicable = data
                if (
                    incomingVersion === localVersion &&
                    data.position &&
                    existing.position &&
                    (data.position.x !== existing.position.x ||
                        data.position.y !== existing.position.y ||
                        data.position.width !== existing.position.width ||
                        data.position.height !== existing.position.height)
                ) {
                    if (import.meta.env.DEV) {
                        console.log(`[GROUP-SYNC] Dropping equal-version geometry for group ${groupId.slice(0, 8)}... (local v${localVersion} owns its geometry)`)
                    }
                    const { position: _droppedPosition, ...rest } = data
                    applicable = rest
                }

                // Update existing group (don't trigger saveGroupToStorage)
                _rawGroups.value[index] = {
                    ...existing,
                    ...applicable,
                    id: groupId, // Ensure ID is preserved
                    updatedAt: applicable.updatedAt || new Date().toISOString()
                }
            } else {
                // Add new group from remote - use defaults matching createGroup
                const newGroup: CanvasGroup = {
                    // Apply data first
                    ...data,
                    // Then apply required fields (override if missing)
                    id: groupId,
                    name: data.name || 'Untitled Group',
                    type: data.type || 'custom',
                    position: data.position || { x: 0, y: 0, width: 400, height: 300 },
                    color: data.color || '#3b82f6',
                    layout: data.layout || 'freeform',
                    isVisible: data.isVisible !== false,
                    isCollapsed: data.isCollapsed || false,
                    parentGroupId: data.parentGroupId || null,
                    positionVersion: data.positionVersion || 1,
                    positionFormat: data.positionFormat || 'absolute',
                    updatedAt: data.updatedAt || new Date().toISOString()
                }
                _rawGroups.value.push(newGroup)
            }

            // Update localStorage backup
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        } finally {
            // Reset flag after Vue's next tick to ensure watcher sees it
            setTimeout(() => {
                _syncUpdateInProgress = false
            }, 100)
        }
    }

    const removeGroupFromSync = (groupId: string) => {
        // SAFETY: Use _rawGroups for sync mutations
        const index = _rawGroups.value.findIndex(g => g.id === groupId)
        if (index !== -1) {
            _rawGroups.value.splice(index, 1)
            if (activeSectionId.value === groupId) {
                activeSectionId.value = null
            }
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        }
    }

    // TASK-1871: One-time migration of legacy non-UUID group ids → deterministic UUIDs.
    // Older day-column groups ("Monday"/"Tomorrow") have legacy ids that toSupabaseGroup
    // refuses to persist, so they only ever lived in each device's local storage and drifted
    // apart. We give each a deterministic UUID (same across devices → Supabase upsert folds
    // duplicates into one row), re-point child tasks/groups, and drop the local legacy copy.
    const migrateLegacyGroupIds = async (userId: string): Promise<{ migrated: number }> => {
        if (!userId) return { migrated: 0 }
        // Only migrate legacy DAY-COLUMN groups. Migrating arbitrary legacy groups
        // ("Done"/"1"/custom) would mint UUID copies and resurrect junk after cleanup.
        const legacy = _rawGroups.value.filter(g => !isUuidGroupId(g.id) && isMigratableDayGroup(g.name))
        if (legacy.length === 0) return { migrated: 0 }

        const { useTaskStore } = await import('@/stores/tasks')
        const taskStore = useTaskStore()

        // Backup BEFORE mutating: snapshot all groups + each task's (id, parentId).
        try {
            const snapshot = {
                ts: new Date().toISOString(),
                groups: JSON.parse(JSON.stringify(_rawGroups.value)),
                taskParents: (taskStore.rawTasks as Task[]).map(t => ({ id: t.id, parentId: t.parentId ?? null }))
            }
            localStorage.setItem('flowstate:legacy-group-migration-backup', JSON.stringify(snapshot))
            console.log(`💾 [LEGACY-MIGRATE] Backed up ${snapshot.groups.length} groups before migrating ${legacy.length} legacy group(s) (localStorage: flowstate:legacy-group-migration-backup)`)
        } catch (e) {
            console.error('[LEGACY-MIGRATE] Backup failed — aborting migration to be safe:', e)
            return { migrated: 0 }
        }

        // Phase 1: stable old→new id map (so nested parent remaps are consistent).
        const idMap = new Map<string, string>()
        for (const g of legacy) idMap.set(g.id, deterministicGroupId(userId, g))

        // Phase 2: create the UUID group for each legacy group (unless it already exists
        // locally from another device's sync). createGroup upserts by id → idempotent/converges.
        for (const old of legacy) {
            const newId = idMap.get(old.id)!
            if (_rawGroups.value.some(g => g.id === newId)) continue
            const newParent = old.parentGroupId && idMap.has(old.parentGroupId)
                ? idMap.get(old.parentGroupId)!
                : (old.parentGroupId ?? null)
            await createGroup({ ...old, id: newId, parentGroupId: newParent })
        }

        // Phase 3: re-point every task whose parentId is a migrated legacy id (now persists, R4 fix).
        for (const t of (taskStore.rawTasks as Task[])) {
            if (t.parentId && idMap.has(t.parentId)) {
                await taskStore.updateTask(t.id, { parentId: idMap.get(t.parentId)! }, 'DRAG')
            }
        }

        // Phase 4: re-point any surviving group whose parentGroupId is a migrated legacy id.
        for (const g of [..._rawGroups.value]) {
            if (g.parentGroupId && idMap.has(g.parentGroupId) && isUuidGroupId(g.id)) {
                await updateGroup(g.id, { parentGroupId: idMap.get(g.parentGroupId)! })
            }
        }

        // Phase 5: drop the local legacy copies. They were NEVER in Supabase, so no remote
        // delete / tombstone — that would only risk deleting the freshly-created UUID row.
        for (const old of legacy) {
            const idx = _rawGroups.value.findIndex(g => g.id === old.id)
            if (idx !== -1) _rawGroups.value.splice(idx, 1)
        }

        persistence.saveGroupsToLocalStorage(_rawGroups.value)
        cacheGroups([..._rawGroups.value])
        console.log(`✅ [LEGACY-MIGRATE] Migrated ${legacy.length} legacy group(s) to UUIDs`)
        return { migrated: legacy.length }
    }

    return {
        _rawGroups,
        activeGroupId,
        taskParentVersion,
        syncTrigger,
        activeSectionId,
        visibleGroups,
        sections,
        bumpTaskParentVersion,
        setGroups,
        createGroup,
        updateGroup,
        deleteGroup,
        patchGroups,
        taskCountByGroupId,
        aggregatedTaskCountByGroupId,
        getTasksInSection,
        updateGroupFromSync,
        removeGroupFromSync,
        addPendingGroupWrite,
        removePendingGroupWrite,
        migrateLegacyGroupIds
    }
}
