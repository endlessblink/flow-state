import type { RealtimePayload } from '@/composables/supabase/useRealtimeSubscription'

export function realtimeRowMatchesScope(
  payload: RealtimePayload,
  workspaceId: string | null,
  userId: string | undefined,
): boolean {
  const row = payload.new ?? payload.old
  if (!row || typeof row !== 'object') return false
  const record = row as Record<string, unknown>
  if (
    payload.eventType === 'DELETE'
    && !Object.prototype.hasOwnProperty.call(record, 'workspace_id')
  ) return true
  const rowWorkspaceId = typeof record.workspace_id === 'string' ? record.workspace_id : null
  if (rowWorkspaceId !== workspaceId) return false
  return rowWorkspaceId !== null
    || typeof record.user_id !== 'string'
    || record.user_id === userId
}
