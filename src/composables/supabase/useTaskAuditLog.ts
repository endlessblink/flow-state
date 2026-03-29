import { type DatabaseContext, supabase } from './_infrastructure'

export interface TaskAuditEntry {
    event_at: string
    event_type: 'CREATED' | 'SOFT_DELETED' | 'RESTORED' | 'STATUS_CHANGED' | 'HARD_DELETED'
    task_id: string
    title: string | null
    status: string | null
    priority: string | null
    project_id: string | null
    is_deleted: boolean
    old_values: Record<string, unknown>
    new_values: Record<string, unknown>
}

export function useTaskAuditLog(ctx: DatabaseContext) {
    const { withRetry, handleError } = ctx

    const searchAuditLog = async (
        query: string,
        eventTypes?: string[],
        limit = 50
    ): Promise<TaskAuditEntry[]> => {
        try {
            return await withRetry(async () => {
                const { data, error } = await supabase.rpc('search_task_audit', {
                    p_query: query || null,
                    p_event_types: eventTypes || null,
                    p_limit: limit,
                })
                if (error) throw error
                return (data ?? []) as TaskAuditEntry[]
            }, 'searchAuditLog')
        } catch (e: unknown) {
            handleError(e, 'searchAuditLog')
            return []
        }
    }

    const getTaskHistory = async (taskId: string): Promise<TaskAuditEntry[]> => {
        try {
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('task_audit_log')
                    .select('event_at, event_type, task_id, title, status, priority, project_id, is_deleted, old_values, new_values')
                    .eq('task_id', taskId)
                    .order('event_at', { ascending: true })
                if (error) throw error
                return (data ?? []) as TaskAuditEntry[]
            }, 'getTaskHistory')
        } catch (e: unknown) {
            handleError(e, 'getTaskHistory')
            return []
        }
    }

    return { searchAuditLog, getTaskHistory }
}
