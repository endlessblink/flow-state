/**
 * TASK-1338: Web Push Subscription Management
 *
 * Handles subscribing/unsubscribing to Web Push notifications
 * via the browser PushManager API. Subscriptions are saved to
 * Supabase for the server-side push service to use.
 */

import { ref, computed } from 'vue'
import { urlBase64ToUint8Array } from '@/utils/urlBase64ToUint8Array'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/services/auth/supabase'

const isSubscribed = ref(false)
const isSubscribing = ref(false)
const subscriptionError = ref<string | null>(null)

/** Check if Web Push is supported in this environment */
function isPushSupported(): boolean {
  // Web Push not available in Tauri WebView
  if (window.__TAURI_INTERNALS__) return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export function usePushSubscription() {
  const authStore = useAuthStore()

  const canUsePush = computed(() => isPushSupported())

  /** Get current push subscription from the SW registration */
  async function getExistingSubscription(): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null
    try {
      const registration = await navigator.serviceWorker.ready
      return await registration.pushManager.getSubscription()
    } catch {
      return null
    }
  }

  /** Check if user is currently subscribed */
  async function checkSubscriptionStatus(): Promise<boolean> {
    const sub = await getExistingSubscription()
    isSubscribed.value = !!sub
    return isSubscribed.value
  }

  /** Subscribe to Web Push notifications */
  async function subscribe(): Promise<boolean> {
    if (!isPushSupported()) {
      subscriptionError.value = 'Push notifications not supported in this browser'
      return false
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      subscriptionError.value = 'VAPID public key not configured'
      console.error('[PUSH] VITE_VAPID_PUBLIC_KEY not set')
      return false
    }

    isSubscribing.value = true
    subscriptionError.value = null

    try {
      // Request notification permission if needed
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          subscriptionError.value = 'Notification permission denied'
          isSubscribing.value = false
          return false
        }
      } else if (Notification.permission === 'denied') {
        subscriptionError.value = 'Notification permission blocked. Please enable in browser settings.'
        isSubscribing.value = false
        return false
      }

      const registration = await navigator.serviceWorker.ready

      // Unsubscribe from any existing subscription first
      const existingSub = await registration.pushManager.getSubscription()
      if (existingSub) {
        await existingSub.unsubscribe()
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
      })

      // Save to Supabase
      const saved = await saveSubscriptionToDb(subscription)
      if (!saved) {
        await subscription.unsubscribe()
        subscriptionError.value = 'Failed to save subscription to server'
        isSubscribing.value = false
        return false
      }

      isSubscribed.value = true
      isSubscribing.value = false
      console.log('[PUSH] Successfully subscribed to push notifications')
      return true
    } catch (error) {
      console.error('[PUSH] Subscription failed:', error)
      subscriptionError.value = error instanceof Error ? error.message : 'Subscription failed'
      isSubscribing.value = false
      return false
    }
  }

  /** Unsubscribe from Web Push notifications */
  async function unsubscribe(): Promise<boolean> {
    try {
      const subscription = await getExistingSubscription()
      if (subscription) {
        // Remove from DB first
        await deleteSubscriptionFromDb(subscription.endpoint)
        // Then unsubscribe from browser
        await subscription.unsubscribe()
      }
      isSubscribed.value = false
      subscriptionError.value = null
      console.log('[PUSH] Successfully unsubscribed from push notifications')
      return true
    } catch (error) {
      console.error('[PUSH] Unsubscribe failed:', error)
      subscriptionError.value = error instanceof Error ? error.message : 'Unsubscribe failed'
      return false
    }
  }

  /** Save push subscription to Supabase */
  async function saveSubscriptionToDb(subscription: PushSubscription): Promise<boolean> {
    const userId = authStore.user?.id
    if (!userId || !supabase) return false

    const json = subscription.toJSON()
    const p256dhKey = json.keys?.p256dh || ''
    const authKey = json.keys?.auth || ''

    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh_key: p256dhKey,
          auth_key: authKey,
          is_active: true,
          failure_count: 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint'
        })

      if (error) {
        console.error('[PUSH] Failed to save subscription:', error)
        return false
      }
      return true
    } catch (error) {
      console.error('[PUSH] DB save failed:', error)
      return false
    }
  }

  /** Delete push subscription from Supabase */
  async function deleteSubscriptionFromDb(endpoint: string): Promise<void> {
    const userId = authStore.user?.id
    if (!userId || !supabase) return

    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
    } catch (error) {
      console.error('[PUSH] Failed to delete subscription from DB:', error)
    }
  }

  return {
    // State
    isSubscribed,
    isSubscribing,
    subscriptionError,
    canUsePush,

    // Methods
    checkSubscriptionStatus,
    subscribe,
    unsubscribe
  }
}
