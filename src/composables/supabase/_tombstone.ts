import { getSupabase, type DatabaseContext } from './_infrastructure'

export function useTombstoneDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry } = ctx

    // TASK-317: Record tombstone for permanent deletions
    // Tombstones prevent zombie data resurrection during backup restore
    // TASK-344: Task tombstones are now permanent (expires_at = NULL)
    const recordTombstone = async (
        entityType: 'task' | 'group' | 'project' | 'lane',
        entityId: string,
        knownWorkspaceId?: string | null,
    ): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping recordTombstone - not authenticated')
            return
        }
        try {
            let workspaceId = knownWorkspaceId
            let scopeKind: 'personal' | 'workspace' | 'unknown'
            if (workspaceId === undefined) {
                const tableByEntityType = {
                    task: 'tasks',
                    group: 'groups',
                    project: 'projects',
                    lane: 'lanes',
                } as const
                const { data: entity, error: scopeError } = await getSupabase()
                    .from(tableByEntityType[entityType])
                    .select('workspace_id')
                    .eq('id', entityId)
                    .maybeSingle()
                if (scopeError) {
                    throw new Error(
                        `Cannot establish deletion scope for ${entityType}:${entityId}: ${scopeError.message}`
                    )
                }
                if (!entity) {
                    throw new Error(
                        `Cannot establish deletion scope for ${entityType}:${entityId}: entity is not readable`
                    )
                }
                workspaceId = entity.workspace_id ?? null
                scopeKind = workspaceId ? 'workspace' : 'personal'
            } else {
                scopeKind = workspaceId ? 'workspace' : 'personal'
            }

            // TASK-344: Task tombstones are permanent (no expiry), others expire in 90 days
            const expiresAt = entityType === 'task'
                ? null  // Permanent for tasks
                : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()  // 90 days for others

            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await getSupabase().from('tombstones').upsert({
                    user_id: userId,
                    entity_type: entityType,
                    entity_id: entityId,
                    scope_kind: scopeKind,
                    workspace_id: workspaceId ?? null,
                    deleted_at: new Date().toISOString(),
                    expires_at: expiresAt
                }, { onConflict: 'entity_type,entity_id,user_id' })
                if (error) {
                    console.warn(`[TASK-317] Failed to record tombstone for ${entityType}:${entityId}:`, error.message)
                    throw error
                }
            }, 'recordTombstone')
            console.log(`🪦 [TOMBSTONE] Recorded permanent deletion: ${entityType}:${entityId} (expires: ${expiresAt || 'never'})`)
        } catch (e: unknown) {
            console.warn(`[TASK-317] Tombstone recording error:`, e)
            throw e
        }
    }

    // TASK-317: Fetch tombstones for restore filtering
    // BUG-1891: optional onError lets the load path detect failure (vs an empty-but-successful
    // result) so it can fail CLOSED — never resurrect deleted tasks when deletion info is unreliable.
    const fetchTombstones = async (opts?: { onError?: () => void }): Promise<Array<{
        entityType: string
        entityId: string
        scopeKind: 'personal' | 'workspace' | 'unknown'
        workspaceId: string | null
    }>> => {
        const userId = getUserIdSafe()
        if (!userId) return []
        try {
            // BUG-1311: Wrap in withRetry for network resilience
            return await withRetry(async () => {
                const { data, error } = await getSupabase()
                    .from('tombstones')
                    .select('entity_type, entity_id, scope_kind, workspace_id')
                    .eq('user_id', userId)
                if (error) throw error
                return data?.map((t: Record<string, unknown>) => ({
                    entityType: t.entity_type as string,
                    entityId: t.entity_id as string,
                    scopeKind: (
                        t.scope_kind === 'personal' || t.scope_kind === 'workspace'
                            ? t.scope_kind
                            : 'unknown'
                    ) as 'personal' | 'workspace' | 'unknown',
                    workspaceId: typeof t.workspace_id === 'string' ? t.workspace_id : null,
                })) || []
            }, 'fetchTombstones')
        } catch (e: unknown) {
            console.error('[TASK-317] Failed to fetch tombstones:', e)
            opts?.onError?.()
            return []
        }
    }

    return { recordTombstone, fetchTombstones }
}
