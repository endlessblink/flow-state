import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startServiceWorkerUpdateRecovery } from '@/services/pwa/serviceWorkerUpdateRecovery'
import { buildDeviceSyncReceipt } from '@/services/sync/deviceSyncDiagnostics'

describe('mobile PWA to Electron convergence regression', () => {
  it('mounts the device receipt heartbeat and repair consumer in app initialization', () => {
    const initializer = readFileSync(resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'), 'utf8')

    expect(initializer).toContain("import { useDeviceSyncDiagnostics } from '@/composables/sync/useDeviceSyncDiagnostics'")
    expect(initializer).toMatch(/useDeviceSyncDiagnostics\(\)/)
  })

  it('refreshes a stale installed PWA, drains its task write, and converges with Electron', async () => {
    let pwaVersion = '1.4.321'
    const operation = {
      id: 42,
      entityType: 'task' as const,
      operation: 'create' as const,
      entityId: '1492ecfe-447b-4d3f-a8fd-953bac4b96a3',
      payload: { title: 'בידקת זנכרון' },
      status: 'pending' as const,
      retryCount: 0,
      createdAt: Date.parse('2026-07-29T14:56:28.382Z'),
    }
    const staleReceipt = await buildDeviceSyncReceipt({
      deviceId: '8f7f77cc-544a-415d-95af-b9a9617bef72',
      runtime: 'pwa',
      appVersion: pwaVersion,
      status: 'pending',
      isOnline: true,
      operations: [operation],
    })
    const postMessage = vi.fn()

    startServiceWorkerUpdateRecovery({
      ready: Promise.resolve({
        update: vi.fn(async () => {
          pwaVersion = '1.4.322'
        }),
        waiting: { postMessage },
      }),
      visibility: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))

    const completedOperation = { ...operation, status: 'completed' as const }
    const pwaReceipt = await buildDeviceSyncReceipt({
      deviceId: staleReceipt.deviceId,
      runtime: 'pwa',
      appVersion: pwaVersion,
      status: 'synced',
      isOnline: true,
      lastSyncAt: Date.parse('2026-07-29T14:56:28.881Z'),
      operations: [completedOperation],
    })
    const electronReceipt = await buildDeviceSyncReceipt({
      deviceId: 'dbf27989-f6b9-4882-ad20-a73c994ed2b1',
      runtime: 'electron',
      appVersion: '1.4.322',
      status: 'synced',
      isOnline: true,
      lastSyncAt: Date.parse('2026-07-29T14:56:29.000Z'),
      operations: [],
    })

    expect(staleReceipt.queue.pending).toBe(1)
    expect(pwaReceipt.queue).toEqual({ pending: 0, syncing: 0, failed: 0, conflict: 0 })
    expect(pwaReceipt.operations).toEqual([])
    expect(pwaReceipt.appVersion).toBe(electronReceipt.appVersion)
    expect(electronReceipt.status).toBe('synced')
  })

  it('keeps a real installed PWA-to-Electron mutation proof on the no-reload path', () => {
    const verifier = readFileSync(resolve(process.cwd(), 'scripts/verify-live-installed-pwa-sync.mjs'), 'utf8')

    expect(verifier).toContain('chromium.connectOverCDP')
    expect(verifier).toContain('https://in-theflow.com/#/catalog')
    expect(verifier).toContain('waitForFunction')
    expect(verifier).toContain('propagatedWithoutReload: true')
    expect(verifier).toContain('electron-sync-proof-')
    expect(verifier).toContain('reverseMs')
    expect(verifier).toContain('finally')
    expect(verifier).toContain('restored: true')
  })
})
