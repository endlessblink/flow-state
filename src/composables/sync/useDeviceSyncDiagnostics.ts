import { onScopeDispose, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStatusStore } from '@/stores/syncStatus'
import { publishDeviceSyncReceipt } from '@/services/sync/deviceSyncDiagnostics'
import { consumeDeviceSyncRepair } from '@/services/sync/deviceSyncRepair'
import { useSyncOrchestrator } from '@/composables/sync/useSyncOrchestrator'

const HEARTBEAT_MS = 30_000
const CHANGE_DEBOUNCE_MS = 1_000

export function useDeviceSyncDiagnostics() {
  const auth = useAuthStore()
  const sync = useSyncStatusStore()
  const orchestrator = useSyncOrchestrator()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let repairInFlight = false

  const publish = () => {
    if (!auth.user?.id || !auth.canSyncRemotely) return
    void publishDeviceSyncReceipt({
      userId: auth.user.id,
      status: sync.status,
      isOnline: sync.isOnline,
      lastSyncAt: sync.lastSyncAt,
    }).then(async () => {
      if (repairInFlight) return
      repairInFlight = true
      try {
        await consumeDeviceSyncRepair({
          userId: auth.user!.id,
          retry: orchestrator.retryFailedByEntityIds,
        })
      } finally {
        repairInFlight = false
      }
    }).catch(error => {
      console.warn('[SYNC-DIAGNOSTICS] Receipt publish failed', {
        code: typeof error?.code === 'string' ? error.code : 'unknown',
      })
    })
  }

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(publish, CHANGE_DEBOUNCE_MS)
  }

  const stopWatch = watch(
    [
      () => auth.user?.id,
      () => auth.canSyncRemotely,
      () => sync.status,
      () => sync.isOnline,
      () => sync.pendingCount,
      () => sync.failedCount,
      () => sync.lastSyncAt,
    ],
    schedule,
    { immediate: true },
  )
  const heartbeat = setInterval(publish, HEARTBEAT_MS)

  onScopeDispose(() => {
    stopWatch()
    clearInterval(heartbeat)
    if (debounceTimer) clearTimeout(debounceTimer)
  })
}
