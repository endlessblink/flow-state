import { supabase } from '@/services/auth/supabase'
import { getDeviceSyncDeviceId } from '@/services/sync/deviceSyncDiagnostics'

interface DeviceSyncRepairRequest {
  entityIds: string[]
  requestedAt: string | null
  completedAt: string | null
}

export async function executeDeviceSyncRepair(
  request: DeviceSyncRepairRequest,
  retry: (entityIds: string[]) => Promise<void>,
): Promise<'completed' | 'skipped'> {
  if (
    request.entityIds.length === 0
    || !request.requestedAt
    || (request.completedAt && request.completedAt >= request.requestedAt)
  ) {
    return 'skipped'
  }

  await retry(request.entityIds)
  return 'completed'
}

export async function consumeDeviceSyncRepair(input: {
  userId: string
  retry: (entityIds: string[]) => Promise<void>
}): Promise<void> {
  if (!supabase || !input.userId) return

  const deviceId = getDeviceSyncDeviceId()
  const { data, error } = await supabase
    .from('device_sync_receipts')
    .select('repair_entity_ids,repair_requested_at,repair_completed_at')
    .eq('user_id', input.userId)
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) throw error
  if (!data) return

  const result = await executeDeviceSyncRepair({
    entityIds: Array.isArray(data.repair_entity_ids) ? data.repair_entity_ids : [],
    requestedAt: data.repair_requested_at,
    completedAt: data.repair_completed_at,
  }, input.retry)
  if (result === 'skipped') return

  const { error: updateError } = await supabase
    .from('device_sync_receipts')
    .update({
      repair_completed_at: new Date().toISOString(),
      repair_error_code: null,
    })
    .eq('user_id', input.userId)
    .eq('device_id', deviceId)

  if (updateError) throw updateError
}
