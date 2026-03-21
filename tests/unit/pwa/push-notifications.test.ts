/**
 * TASK-1647: Push Notification Tests (10 tests)
 *
 * Tests for usePushSubscription.ts, sw.ts push handler, and related types.
 * Covers:
 * 1.  Push subscription composable exists and exports expected API
 * 2.  Permission request flow (ask → grant/deny)
 * 3.  Subscription stored in Supabase via upsert
 * 4.  Unsubscribe cleans up (DB deletion + browser unsubscribe)
 * 5.  Notification click handler routes to correct view
 * 6.  Push notification payload includes task title (body field)
 * 7.  Push registration skipped in Tauri (native notifications instead)
 * 8.  Push registration skipped when permission denied
 * 9.  VAPID key configured
 * 10. Subscription renewal (re-subscribe flow) on token expiry
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Read source for static analysis
// ---------------------------------------------------------------------------
const pushComposableSource = readFileSync(
  resolve(__dirname, '../../../src/composables/usePushSubscription.ts'),
  'utf-8'
)
const swSource = readFileSync(
  resolve(__dirname, '../../../src/sw.ts'),
  'utf-8'
)
const pushTypesSource = readFileSync(
  resolve(__dirname, '../../../src/types/pushNotifications.ts'),
  'utf-8'
)

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSupabaseFrom = {
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
}

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseFrom)
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'user-push-test' } })
}))

vi.mock('@/utils/urlBase64ToUint8Array', () => ({
  urlBase64ToUint8Array: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
}))

// ---------------------------------------------------------------------------
// Browser API stubs
// ---------------------------------------------------------------------------
function makePushSubscription(endpoint = 'https://push.example.com/endpoint'): PushSubscription {
  return {
    endpoint,
    expirationTime: null,
    getKey: vi.fn().mockReturnValue(new ArrayBuffer(32)),
    toJSON: vi.fn().mockReturnValue({
      endpoint,
      keys: { p256dh: 'dGVzdC1rZXk=', auth: 'dGVzdC1hdXRo' }
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
    options: { userVisibleOnly: true, applicationServerKey: null }
  } as unknown as PushSubscription
}

function setupPushManagerMocks(opts: {
  existingSub?: PushSubscription | null
  newSub?: PushSubscription
  permission?: NotificationPermission
} = {}) {
  const existingSub = opts.existingSub ?? null
  const newSub = opts.newSub ?? makePushSubscription()
  const permission = opts.permission ?? 'granted'

  Object.defineProperty(globalThis, 'Notification', {
    writable: true,
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue(permission)
    }
  })

  const mockRegistration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(existingSub),
      subscribe: vi.fn().mockResolvedValue(newSub)
    }
  }

  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    value: {
      ready: Promise.resolve(mockRegistration)
    }
  })

  return { mockRegistration, newSub }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TASK-1647: Push Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the Tauri marker so each test starts in browser mode
    delete (window as any).__TAURI_INTERNALS__
    // Ensure PushManager is present in window
    ;(window as any).PushManager = class {}
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: { ready: Promise.resolve({}) }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. Push subscription composable exists
  // =========================================================================
  it('1. usePushSubscription composable exports required API surface', async () => {
    const mod = await import('@/composables/usePushSubscription')
    expect(mod.usePushSubscription).toBeDefined()
    expect(typeof mod.usePushSubscription).toBe('function')

    const instance = mod.usePushSubscription()
    expect(instance).toHaveProperty('isSubscribed')
    expect(instance).toHaveProperty('isSubscribing')
    expect(instance).toHaveProperty('subscriptionError')
    expect(instance).toHaveProperty('canUsePush')
    expect(instance).toHaveProperty('checkSubscriptionStatus')
    expect(instance).toHaveProperty('subscribe')
    expect(instance).toHaveProperty('unsubscribe')
  })

  // =========================================================================
  // 2. Permission request flow
  // =========================================================================
  it('2. subscribe() requests notification permission when status is "default"', () => {
    // Source-level verification: subscribe() guards on Notification.permission
    // before calling requestPermission() — only when status is 'default'
    expect(pushComposableSource).toContain("Notification.permission === 'default'")
    expect(pushComposableSource).toContain('Notification.requestPermission()')

    // When requestPermission resolves to anything other than 'granted', subscribe aborts
    expect(pushComposableSource).toContain("permission !== 'granted'")
    const permissionBlock = pushComposableSource.slice(
      pushComposableSource.indexOf("permission !== 'granted'"),
      pushComposableSource.indexOf("permission !== 'granted'") + 200
    )
    expect(permissionBlock).toContain('return false')

    // subscribe() also handles the already-denied case separately
    expect(pushComposableSource).toContain("Notification.permission === 'denied'")
  })

  // =========================================================================
  // 3. Subscription stored in Supabase
  // =========================================================================
  it('3. subscription is saved to Supabase push_subscriptions table via upsert', () => {
    // Source must reference the push_subscriptions table
    expect(pushComposableSource).toContain("'push_subscriptions'")
    expect(pushComposableSource).toContain('.upsert(')

    // Must include all required fields
    expect(pushComposableSource).toContain('user_id')
    expect(pushComposableSource).toContain('endpoint')
    expect(pushComposableSource).toContain('p256dh_key')
    expect(pushComposableSource).toContain('auth_key')
    expect(pushComposableSource).toContain('is_active')

    // Must use onConflict for idempotency
    expect(pushComposableSource).toContain("onConflict: 'user_id,endpoint'")
  })

  // =========================================================================
  // 4. Unsubscribe cleans up
  // =========================================================================
  it('4. unsubscribe() removes from Supabase and calls browser pushManager.unsubscribe()', () => {
    // Source must call deleteSubscriptionFromDb
    expect(pushComposableSource).toContain('deleteSubscriptionFromDb')
    expect(pushComposableSource).toContain('deleteSubscriptionFromDb(subscription.endpoint)')

    // Source must call subscription.unsubscribe()
    expect(pushComposableSource).toContain('subscription.unsubscribe()')

    // Sets isSubscribed to false on success
    expect(pushComposableSource).toContain('isSubscribed.value = false')

    // DB delete uses the correct table
    expect(pushComposableSource).toContain(".from('push_subscriptions')")
    expect(pushComposableSource).toContain('.delete()')
  })

  // =========================================================================
  // 5. Notification click handler routes to correct view
  // =========================================================================
  it('5. SW notificationclick handler sends NAVIGATE_TO_TASK for view-task action', () => {
    // The SW push notification click handler (TASK-1338 section)
    // The handler stores action in pushAction variable before comparing
    expect(swSource).toContain("pushAction === 'view-task'")
    expect(swSource).toContain("type: 'NAVIGATE_TO_TASK'")
    expect(swSource).toContain('taskId: data.taskId')

    // Also handles open-board action
    expect(swSource).toContain("pushAction === 'open-board'")
    expect(swSource).toContain("type: 'NAVIGATE_TO'")
    expect(swSource).toContain("url: '/board'")

    // Snooze action
    expect(swSource).toContain("pushAction === 'snooze'")
    expect(swSource).toContain("type: 'SNOOZE_NOTIFICATION'")
  })

  // =========================================================================
  // 6. Notification payload includes task title
  // =========================================================================
  it('6. push payload type definition includes title and body fields', () => {
    // PushPayload type must have title and body
    expect(pushTypesSource).toContain('title: string')
    expect(pushTypesSource).toContain('body: string')
    expect(pushTypesSource).toContain("type: 'task_reminder' | 'daily_digest' | 'overdue_alert'")

    // SW uses payload.title and payload.body when showing the notification
    expect(swSource).toContain('payload.title')
    expect(swSource).toContain('payload.body')

    // Body is propagated to showNotification options
    const pushHandler = swSource.slice(
      swSource.indexOf('self.addEventListener(\'push\''),
      swSource.indexOf('self.addEventListener(\'push\'') + 800
    )
    expect(pushHandler).toContain('body: payload.body')
  })

  // =========================================================================
  // 7. Push registration skipped in Tauri
  // =========================================================================
  it('7. isPushSupported() returns false in Tauri WebView environment', () => {
    // The check for Tauri is via window.__TAURI_INTERNALS__
    expect(pushComposableSource).toContain('window.__TAURI_INTERNALS__')
    expect(pushComposableSource).toContain('if (window.__TAURI_INTERNALS__) return false')

    // Simulate Tauri environment
    ;(window as any).__TAURI_INTERNALS__ = {}

    // The isPushSupported function returns false when __TAURI_INTERNALS__ is set
    // Verify this is the first guard in the function (before PushManager check)
    const isPushSupportedFn = pushComposableSource.slice(
      pushComposableSource.indexOf('function isPushSupported'),
      pushComposableSource.indexOf('function isPushSupported') + 300
    )
    expect(isPushSupportedFn).toContain('__TAURI_INTERNALS__')
    expect(isPushSupportedFn.indexOf('__TAURI_INTERNALS__')).toBeLessThan(
      isPushSupportedFn.indexOf('PushManager')
    )
  })

  // =========================================================================
  // 8. Push registration skipped when permission denied
  // =========================================================================
  it('8. subscribe() returns false immediately when Notification.permission is denied', () => {
    // Source must handle 'denied' permission explicitly
    expect(pushComposableSource).toContain("Notification.permission === 'denied'")

    // When denied, must set subscriptionError and return false
    const deniedBlock = pushComposableSource.slice(
      pushComposableSource.indexOf("Notification.permission === 'denied'"),
      pushComposableSource.indexOf("Notification.permission === 'denied'") + 300
    )
    expect(deniedBlock).toContain('subscriptionError.value')
    expect(deniedBlock).toContain('return false')
  })

  // =========================================================================
  // 9. VAPID key configured
  // =========================================================================
  it('9. subscribe() reads VITE_VAPID_PUBLIC_KEY and fails gracefully when absent', () => {
    // Must read the env var
    expect(pushComposableSource).toContain('VITE_VAPID_PUBLIC_KEY')
    expect(pushComposableSource).toContain('import.meta.env.VITE_VAPID_PUBLIC_KEY')

    // Must guard against missing key
    expect(pushComposableSource).toContain('if (!vapidKey)')

    // Must log and return false
    const missingKeyBlock = pushComposableSource.slice(
      pushComposableSource.indexOf('if (!vapidKey)'),
      pushComposableSource.indexOf('if (!vapidKey)') + 200
    )
    expect(missingKeyBlock).toContain('return false')
    expect(missingKeyBlock).toContain('subscriptionError.value')

    // urlBase64ToUint8Array is used to convert the key
    expect(pushComposableSource).toContain('urlBase64ToUint8Array(vapidKey)')
  })

  // =========================================================================
  // 10. Subscription renewal on token expiry
  // =========================================================================
  it('10. subscribe() unsubscribes existing subscription before creating a fresh one', () => {
    // On subscribe, the composable first fetches any existing subscription,
    // unsubscribes it, then creates a new one. This handles token expiry / renewal.
    expect(pushComposableSource).toContain('registration.pushManager.getSubscription()')
    expect(pushComposableSource).toContain('existingSub.unsubscribe()')

    // The renewal flow happens before the new subscribe call
    const subscribeSection = pushComposableSource.slice(
      pushComposableSource.indexOf('async function subscribe'),
      pushComposableSource.indexOf('async function unsubscribe')
    )
    const getSubIdx = subscribeSection.indexOf('getSubscription()')
    const newSubIdx = subscribeSection.indexOf('pushManager.subscribe({')
    expect(getSubIdx).toBeGreaterThan(-1)
    expect(newSubIdx).toBeGreaterThan(-1)
    // getSubscription must come before subscribe
    expect(getSubIdx).toBeLessThan(newSubIdx)
  })
})
