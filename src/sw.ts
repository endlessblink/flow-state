/**
 * TASK-1009: Custom Service Worker for Timer Notifications
 *
 * Handles timer completion notifications with actionable buttons:
 * - Start Break / Start Work
 * - Postpone 5 min
 *
 * Uses workbox for caching + custom notification handlers
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, Route } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// VitePWA injects __WB_MANIFEST at build time
declare const self: ServiceWorkerGlobalScope

// ============================================================================
// WORKBOX PRECACHING (auto-injected by VitePWA)
// ============================================================================

// Clean up old caches from previous versions
cleanupOutdatedCaches()

// Precache all assets from the manifest (injected by VitePWA)
// Precaching
precacheAndRoute(self.__WB_MANIFEST)

// ============================================================================
// RUNTIME CACHING STRATEGIES
// ============================================================================

// TASK-1083: CRITICAL - Never cache Supabase API responses
// This prevents stale position data from being served across devices
// Research: Browser HTTP caching can serve old data even with SWR invalidation
registerRoute(
  new Route(
    ({ url }) => {
      // Match Supabase REST API and Realtime endpoints
      const isSupabaseAPI = url.hostname.includes('supabase.co') ||
        url.hostname.includes('api.in-theflow.com')
      const isRestAPI = url.pathname.includes('/rest/v1/')
      const isRealtime = url.pathname.includes('/realtime/')
      const isAuth = url.pathname.includes('/auth/')
      return isSupabaseAPI && (isRestAPI || isRealtime || isAuth)
    },
    new NetworkOnly() // Never cache - always fetch from network
  )
)

// Images: Cache-first with 30-day expiry
registerRoute(
  new Route(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'image-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        }),
      ],
    })
  )
)

// Fonts: Cache-first with 1-year expiry
registerRoute(
  new Route(
    ({ request }) => request.destination === 'font',
    new CacheFirst({
      cacheName: 'font-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        }),
      ],
    })
  )
)

// ============================================================================
// TASK-1009: TIMER NOTIFICATION HANDLERS
// ============================================================================

interface TimerCompleteMessage {
  type: 'TIMER_COMPLETE'
  sessionId: string
  wasBreak: boolean
  taskId: string
  taskName?: string
}

interface NotificationData {
  sessionId: string
  wasBreak: boolean
  taskId: string
  taskName?: string
}

/**
 * Handle messages from the main app
 */
// Event listener
(self as any).addEventListener('message', (event: any) => {
  const data = event.data

  if (!data || !data.type) return

  switch (data.type) {
    case 'SKIP_WAITING':
      // @ts-expect-error - Service worker method
      self.skipWaiting()
      break

    case 'TIMER_COMPLETE':
      handleTimerComplete(data as TimerCompleteMessage)
      break
  }
})

/**
 * Show timer completion notification with action buttons
 */
async function handleTimerComplete(data: TimerCompleteMessage) {
  const { sessionId, wasBreak, taskId, taskName } = data

  // Determine notification content based on session type
  const title = 'Session Complete! 🍅'
  const body = wasBreak
    ? `Break finished! ${taskName ? `Ready to work on "${taskName}"?` : 'Ready to work?'}`
    : `Great work! ${taskName ? `Time for a break from "${taskName}"` : 'Time for a break!'}`

  // Determine action buttons based on session type
  const actions = wasBreak
    ? [
      { action: 'start-work', title: '🍅 Start Work' },
      { action: 'postpone', title: '⏰ +5 min' },
    ]
    : [
      { action: 'start-break', title: '☕ Start Break' },
      { action: 'postpone', title: '⏰ +5 min' },
    ]

  try {
    // @ts-expect-error - Service worker registration
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-64x64.png',
      tag: `timer-complete-${sessionId}`, // Deduplication - same sessionId won't show twice
      requireInteraction: true, // Stay visible until user interacts
      actions,
      data: {
        sessionId,
        wasBreak,
        taskId,
        taskName,
      } as NotificationData,
      vibrate: [200, 100, 200], // Vibration pattern for mobile
    })
  } catch (error) {
    console.error('[SW] Failed to show notification:', error)
  }
}

/**
 * Handle notification click events (body click or action button click)
 */
// Event listener
(self as any).addEventListener('notificationclick', (event: any) => {
  const notification = event.notification
  const action = event.action
  const data = notification.data as NotificationData

  // Close the notification
  notification.close()

  // Determine what action to take
  let messageType: string

  if (action === 'start-break') {
    messageType = 'START_BREAK'
  } else if (action === 'start-work') {
    messageType = 'START_WORK'
  } else if (action === 'postpone') {
    messageType = 'POSTPONE_5MIN'
  } else {
    // Body click - default action based on session type
    messageType = data?.wasBreak ? 'START_WORK' : 'START_BREAK'
  }

  // Send message to all open clients
  event.waitUntil(
    // @ts-expect-error - Service worker clients
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList: WindowClient[]) => {
      // Try to focus an existing window first
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({
            type: messageType,
            taskId: data?.taskId,
            taskName: data?.taskName,
          })
          return
        }
      }

      // No existing window - open a new one
      // @ts-expect-error - Service worker clients
      if (self.clients.openWindow) {
        // @ts-expect-error - Service worker clients
        await self.clients.openWindow('/')
      }
    })
  )
})

/**
 * Handle notification close (dismissed without action)
 */
// Create a typed reference to self
const sw = self as any;

/**
 * Handle notification close (dismissed without action)
 */
// Event listener
sw.addEventListener('notificationclose', (event: any) => {
  // User dismissed the notification - could log this for analytics
  console.log('[SW] Notification dismissed:', event.notification.tag)
})

// ============================================================================
// SERVICE WORKER LIFECYCLE
// ============================================================================

sw.addEventListener('install', () => {
  console.log('[SW] Timer notification service worker installed')
  // Skip waiting to activate immediately (user opted for auto-update)
  // @ts-expect-error - Service worker method
  self.skipWaiting()
})

// Event listener
sw.addEventListener('activate', (event: any) => {
  console.log('[SW] Timer notification service worker activated')
  // Claim all clients immediately
  // @ts-expect-error - Service worker clients
  event.waitUntil(self.clients.claim())
})
