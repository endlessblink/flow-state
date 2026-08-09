import { onScopeDispose, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStatusStore } from '@/stores/syncStatus'
import { publishDeviceSyncReceipt } from '@/services/sync/deviceSyncDiagnostics'
import { consumeDeviceSyncRepair } from '@/services/sync/deviceSyncRepair'
import { useSyncOrchestrator } from '@/composables/sync/useSyncOrchestrator'

const HEARTBEAT_MS = 30_000
const CHANGE_DEBOUNCE_MS = 1_000
const FORCE_SYNC_TIMEOUT_MS = 10_000

export function useDeviceSyncDiagnostics() {
  const auth = useAuthStore()
  const sync = useSyncStatusStore()
  const orchestrator = useSyncOrchestrator()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let repairInFlight = false

  const publish = async () => {
    if (!auth.user?.id || !auth.canSyncRemotely) return
    try {
      // A receipt is also a liveness pulse. Re-enter the single-flight queue
      // processor before sampling it so a renderer that missed the online or
      // auth-ready event cannot report a healthy connection while durable work
      // is still stranded in IndexedDB.
      await Promise.race([
        orchestrator.forceSync(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('forceSync timed out')), FORCE_SYNC_TIMEOUT_MS)
        }),
      ])
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : error instanceof Error ? error.message : 'unknown'
      console.warn('[SYNC-DIAGNOSTICS] Queue pass failed before receipt', { code })
    }
    try {
      await publishDeviceSyncReceipt({
        userId: auth.user.id,
        status: sync.status,
        isOnline: sync.isOnline,
        lastSyncAt: sync.lastSyncAt,
      })
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
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : 'unknown'
      console.warn('[SYNC-DIAGNOSTICS] Receipt publish failed', {
        code,
      })
    }
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
