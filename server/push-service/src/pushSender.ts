import webpush from 'web-push'
import { deactivateSubscription, incrementFailureCount } from './db.js'

interface PushSubscriptionData {
  id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
}

interface PushPayload {
  type: 'task_reminder' | 'daily_digest' | 'overdue_alert' | 'achievement'
  title: string
  body: string
  tag: string
  taskId?: string
  url?: string
  timestamp: string
}

export function initWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@in-theflow.com'

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set')
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  console.log('[PUSH] VAPID credentials configured')
}

/** Send a push notification to a single subscription */
export async function sendPush(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh_key,
      auth: subscription.auth_key
    }
  }

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      { TTL: 3600 } // 1 hour TTL
    )
    console.log(`[PUSH] Sent ${payload.type} to ${subscription.endpoint.slice(0, 50)}...`)
    return true
  } catch (error: any) {
    const statusCode = error?.statusCode

    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or gone — deactivate it
      console.log(`[PUSH] Subscription expired (${statusCode}), deactivating:`, subscription.id)
      await deactivateSubscription(subscription.id)
    } else {
      // Transient error — increment failure count
      console.error(`[PUSH] Send failed (${statusCode}):`, error.message || error)
      await incrementFailureCount(subscription.id)
    }
    return false
  }
}

/** Send a push notification to all active subscriptions for a user */
export async function sendPushToUser(
  subscriptions: PushSubscriptionData[],
  payload: PushPayload
): Promise<number> {
  let successCount = 0
  for (const sub of subscriptions) {
    const ok = await sendPush(sub, payload)
    if (ok) successCount++
  }
  return successCount
}
