import { supabase, type DatabaseContext } from './_infrastructure'

export function useTombstoneDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry } = ctx

    // TASK-317: Record tombstone for permanent deletions
    // Tombstones prevent zombie data resurrection during backup restore
    // TASK-344: Task tombstones are now permanent (expires_at = NULL)
    const recordTombstone = async (entityType: 'task' | 'group' | 'project', entityId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping recordTombstone - not authenticated')
            return
        }
        try {
            // TASK-344: Task tombstones are permanent (no expiry), others expire in 90 days
            const expiresAt = entityType === 'task'
                ? null  // Permanent for tasks
                : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()  // 90 days for others

            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('tombstones').upsert({
                    user_id: userId,
                    entity_type: entityType,
                    entity_id: entityId,
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
            // Non-fatal: tombstone recording failure shouldn't block deletion
            console.warn(`[TASK-317] Tombstone recording error:`, e)
        }
    }

    // TASK-317: Fetch tombstones for restore filtering
    const fetchTombstones = async (): Promise<{ entityType: string; entityId: string }[]> => {
        const userId = getUserIdSafe()
        if (!userId) return []
        try {
            // BUG-1311: Wrap in withRetry for network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('tombstones')
                    .select('entity_type, entity_id')
                    .eq('user_id', userId)
                if (error) throw error
                return data?.map((t: any) => ({ entityType: t.entity_type, entityId: t.entity_id })) || []
            }, 'fetchTombstones')
        } catch (e: unknown) {
            console.error('[TASK-317] Failed to fetch tombstones:', e)
            return []
        }
    }

    return { recordTombstone, fetchTombstones }
}
