/// <reference lib="webworker" />
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
import { CacheFirst, NetworkOnly, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// VitePWA injects __WB_MANIFEST at build time
// VitePWA injects __WB_MANIFEST at build time
declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// ============================================================================
// WORKBOX PRECACHING (auto-injected by VitePWA)
// ============================================================================

// Clean up old caches from previous versions
cleanupOutdatedCaches()

// Precache all assets from the manifest (injected by VitePWA)
// Precaching
precacheAndRoute(self.__WB_MANIFEST)

// BUG-1089: Fallback for assets not in precache (handles stale SW edge case)
// If precache fails, try network directly
registerRoute(
  new Route(
    ({ url }) => url.pathname.startsWith('/assets/') &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')),
    new NetworkFirst({
      cacheName: 'asset-fallback-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60 // 1 day
        })
      ]
    })
  )
)

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

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Handle messages from the main app
 */
self.addEventListener('message', (event) => {
  const data = event.data

  if (!data || !data.type) return

  switch (data.type) {
    case 'SKIP_WAITING':
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
  // Check notification permission before attempting to show
  if (Notification.permission !== 'granted') {
    console.warn('[SW] Cannot show notification - permission not granted:', Notification.permission)
    return
  }

  const { sessionId, wasBreak, taskId, taskName } = data

  // Determine notification content based on session type
  const title = 'Session Complete! 🍅'
  const body = wasBreak
    ? `Break finished! ${taskName ? `Ready to work on "${taskName}"?` : 'Ready to work?'}`
    : `Great work! ${taskName ? `Time for a break from "${taskName}"` : 'Time for a break!'}`

  // Determine action buttons based on session type
  const actions: NotificationAction[] = wasBreak
    ? [
      { action: 'start-work', title: '🍅 Start Work' },
      { action: 'postpone', title: '⏰ +5 min' },
    ]
    : [
      { action: 'start-break', title: '☕ Start Break' },
      { action: 'postpone', title: '⏰ +5 min' },
    ]

  try {
    // BUG-1112: Use system notification sound by setting silent: false
    // This allows the OS to play its notification sound (KDE, GNOME, etc.)
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-64x64.png',
      tag: `timer-complete-${sessionId}`, // Deduplication - same sessionId won't show twice
      requireInteraction: true, // Stay visible until user interacts
      silent: false, // BUG-1112: Enable system notification sound
      actions,
      data: {
        sessionId,
        wasBreak,
        taskId,
        taskName,
      } as NotificationData,
      vibrate: [200, 100, 200], // Vibration pattern for mobile
    } as NotificationOptions & { actions?: NotificationAction[] })
    console.log('[SW] Timer notification shown successfully')
  } catch (error) {
    console.error('[SW] Failed to show notification:', error)
  }
}

/**
 * Handle notification click events (body click or action button click)
 */
self.addEventListener('notificationclick', (event) => {
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
    // BUG-1185: Body click should NOT auto-start a session
    // Previously, clicking the notification body would start the opposite session type,
    // which caused unexpected timer starts when users clicked to dismiss the notification
    // Just focus the app window without starting a timer
    messageType = ''
  }

  // BUG-1178: Send message to all open clients with improved reliability
  // Previous code had race condition: message sent before window fully focused
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      console.log('[SW] Found clients:', clientList.length)

      // Try to focus an existing window first
      for (const client of clientList) {
        // WindowClient type check
        if ('focus' in client && typeof (client as WindowClient).focus === 'function') {
          console.log('[SW] Focusing client:', client.url)
          await (client as WindowClient).focus()

          // BUG-1178: Add small delay to ensure window is fully focused and ready to receive messages
          await new Promise(resolve => setTimeout(resolve, 100))

          if (messageType) {
            console.log('[SW] Sending message to client:', messageType)
            client.postMessage({
              type: messageType,
              taskId: data?.taskId,
              taskName: data?.taskName,
            })
            console.log('[SW] Message sent successfully:', messageType)
          } else {
            console.log('[SW] Body click - just focusing window, no timer action')
          }
          return
        }
      }

      // No existing window - open a new one with action in URL (fallback)
      console.log('[SW] No existing window, opening new with action in URL')
      if (messageType && self.clients.openWindow) {
        const actionUrl = `/?action=${messageType}&taskId=${encodeURIComponent(data?.taskId || '')}`
        await self.clients.openWindow(actionUrl)
      }
    })
  )
})

/**
 * Handle notification close (dismissed without action)
 */
self.addEventListener('notificationclose', (event) => {
  // User dismissed the notification - could log this for analytics
  console.log('[SW] Notification dismissed:', event.notification.tag)
})

// ============================================================================
// SERVICE WORKER LIFECYCLE
// ============================================================================

self.addEventListener('install', () => {
  console.log('[SW] Timer notification service worker installed')
  // Skip waiting to activate immediately (user opted for auto-update)
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Timer notification service worker activated')
  // Claim all clients immediately
  event.waitUntil(self.clients.claim())
})
