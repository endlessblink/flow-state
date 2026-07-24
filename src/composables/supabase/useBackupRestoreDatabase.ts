import type { CanvasGroup } from '@/types/canvas'
import type { Project, Task } from '@/types/tasks'
import {
    toSupabaseGroup,
    toSupabaseProject,
    toSupabaseTask,
} from '@/utils/supabaseMappers'
import { getSupabase, type DatabaseContext } from './_infrastructure'

export interface BackupRestoreTransactionInput {
    operationId: string
    artifactHash: string
    schemaVersion: string
    tasks: Task[]
    projects: Project[]
    groups: CanvasGroup[]
    tombstones: Array<{
        entityType: 'task' | 'project' | 'group' | 'lane'
        entityId: string
    }>
}

export interface BackupRestoreTransactionReceipt {
    ok: true
    tasksCreated: number
    tasksExisting: number
    projectsCreated: number
    projectsExisting: number
    groupsCreated: number
    groupsExisting: number
    tombstonesCreated: number
}

export function useBackupRestoreDatabase(ctx: DatabaseContext) {
    const restoreBackupTransaction = async (
        input: BackupRestoreTransactionInput,
    ): Promise<BackupRestoreTransactionReceipt> => {
        const userId = ctx.getUserIdSafe()
        if (!userId) {
            throw new Error('Cannot restore backup without authenticated persistence')
        }
        const containsSharedWorkspaceData = [
            ...input.tasks,
            ...input.projects,
            ...input.groups,
        ].some(entity => (
            (
                'workspaceId' in entity
                && typeof entity.workspaceId === 'string'
                && entity.workspaceId.length > 0
            )
            || (
                'workspace_id' in entity
                && typeof entity.workspace_id === 'string'
                && entity.workspace_id.length > 0
            )
        ))
        if (containsSharedWorkspaceData) {
            throw new Error(
                'Shared-workspace backups require an ownership-aware restore and cannot use personal recovery'
            )
        }
        const pendingKey = [
            'flowstate-atomic-restore-v1',
            userId,
            input.operationId,
            input.artifactHash,
        ].join(':')
        let requestId = localStorage.getItem(pendingKey)
        if (!requestId) {
            const nonce = typeof crypto?.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`
            requestId = `${input.operationId}:${nonce}`
            localStorage.setItem(pendingKey, requestId)
            if (localStorage.getItem(pendingKey) !== requestId) {
                throw new Error(
                    'Cannot start atomic restore because its retry identity was not persisted'
                )
            }
        }

        const mappedGroups = input.groups.map(group => toSupabaseGroup(group, userId))
        if (mappedGroups.some(group => group === null)) {
            throw new Error(
                'Backup contains a legacy group identity that cannot be restored transactionally'
            )
        }

        const { data, error } = await getSupabase().rpc('flowstate_restore_backup_v1', {
            p_user_id: userId,
            p_operation_id: requestId,
            p_artifact_hash: input.artifactHash,
            p_schema_version: input.schemaVersion,
            p_tasks: input.tasks.map(task => toSupabaseTask(task, userId)),
            p_projects: input.projects.map(project => toSupabaseProject(project, userId)),
            p_groups: mappedGroups,
            p_tombstones: input.tombstones.map(tombstone => ({
                entity_type: tombstone.entityType,
                entity_id: tombstone.entityId,
            })),
        })

        if (error) {
            throw new Error(`Atomic backup restore failed: ${error.message}`)
        }
        if (!data || typeof data !== 'object' || data.ok !== true) {
            const message = data && typeof data === 'object' && 'error' in data
                ? String((data as { error?: unknown }).error)
                : 'database returned no committed restore receipt'
            throw new Error(`Atomic backup restore failed: ${message}`)
        }

        localStorage.removeItem(pendingKey)
        return data as unknown as BackupRestoreTransactionReceipt
    }

    return { restoreBackupTransaction }
}
