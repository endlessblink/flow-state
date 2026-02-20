/**
 * FEATURE-1345: Android lifecycle management.
 * - Back button: navigate back or exit app
 * - App state: dispatch foreground/background events for sync orchestrator
 * - Network: dispatch reliable online/offline events (better than navigator.onLine on mobile)
 */
import { isCapacitor } from '@/utils/platform'

export async function initCapacitorLifecycle(router: { back: () => void }): Promise<void> {
  if (!isCapacitor()) return

  try {
    const { App } = await import('@capacitor/app')
    const { Network } = await import('@capacitor/network')

    // Android back button handling
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        router.back()
      } else {
        App.exitApp()
      }
    })

    // App state changes (foreground/background)
    App.addListener('appStateChange', ({ isActive }) => {
      window.dispatchEvent(
        new CustomEvent(isActive ? 'capacitor-app-foreground' : 'capacitor-app-background')
      )
      console.log('[CAP-LIFECYCLE]', isActive ? 'Foreground' : 'Background')
    })

    // Network status (more reliable than navigator.onLine on mobile)
    Network.addListener('networkStatusChange', ({ connected }) => {
      window.dispatchEvent(new Event(connected ? 'online' : 'offline'))
      console.log('[CAP-LIFECYCLE] Network:', connected ? 'online' : 'offline')
    })

    console.log('[CAP-LIFECYCLE] Lifecycle handlers registered')
  } catch (error) {
    console.warn('[CAP-LIFECYCLE] Failed to initialize lifecycle:', error)
  }
}
