/**
 * TASK-1338: FlowState Push Notification Service
 *
 * Runs on VPS alongside Supabase. Checks for tasks due soon,
 * overdue tasks, and daily digests, then sends Web Push notifications.
 *
 * Environment variables required:
 *   VAPID_PUBLIC_KEY    — VAPID public key
 *   VAPID_PRIVATE_KEY   — VAPID private key
 *   VAPID_SUBJECT       — mailto: or URL for VAPID
 *   SUPABASE_URL        — Supabase API URL
 *   SUPABASE_SERVICE_KEY — Supabase service role key
 */

import cron from 'node-cron'
import { initWebPush } from './pushSender.js'
import { runTaskReminders } from './jobs/taskReminders.js'
import { runDailyDigest } from './jobs/dailyDigest.js'
import { runOverdueAlerts } from './jobs/overdueAlerts.js'
import { runCleanupStale } from './jobs/cleanupStale.js'

console.log('[PUSH-SERVICE] Starting FlowState push notification service...')

// Initialize web-push with VAPID credentials
initWebPush()

// Task reminders: every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log('[CRON] Running task reminders check...')
  runTaskReminders().catch(err => console.error('[CRON] Task reminders failed:', err))
})

// Overdue alerts: every 30 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('[CRON] Running overdue alerts check...')
  runOverdueAlerts().catch(err => console.error('[CRON] Overdue alerts failed:', err))
})

// Daily digest: every hour (checks each user's preferred hour)
cron.schedule('0 * * * *', () => {
  console.log('[CRON] Running daily digest check...')
  runDailyDigest().catch(err => console.error('[CRON] Daily digest failed:', err))
})

// Cleanup stale subscriptions: daily at 3 AM
cron.schedule('0 3 * * *', () => {
  console.log('[CRON] Running stale subscription cleanup...')
  runCleanupStale().catch(err => console.error('[CRON] Cleanup failed:', err))
})

console.log('[PUSH-SERVICE] Cron jobs scheduled. Service running.')

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[PUSH-SERVICE] Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[PUSH-SERVICE] Received SIGINT, shutting down gracefully...')
  process.exit(0)
})
