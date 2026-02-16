import { supabase, getUserSubscriptions, getUserSettings } from '../db.js'
import { sendPushToUser } from '../pushSender.js'

/** Track which users got their digest today */
const digestSentToday = new Set<string>()

// Reset at midnight
const resetAtMidnight = () => {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  setTimeout(() => {
    digestSentToday.clear()
    resetAtMidnight()
  }, midnight.getTime() - now.getTime())
}
resetAtMidnight()

export async function runDailyDigest() {
  const currentHour = new Date().getHours()

  // Get all active subscriptions grouped by user
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('is_active', true)

  if (error || !subscriptions?.length) return

  const uniqueUserIds = [...new Set(subscriptions.map(s => s.user_id))]

  for (const userId of uniqueUserIds) {
    // Skip if already sent today
    if (digestSentToday.has(userId)) continue

    const settings = await getUserSettings(userId)
    const pushPrefs = settings?.pushNotifications

    // Check if daily digest is enabled
    if (pushPrefs && !pushPrefs.enabled) continue
    if (pushPrefs?.categories?.dailyDigest && !pushPrefs.categories.dailyDigest.webPush) continue

    // Check if current hour matches user's preferred digest hour
    const preferredHour = pushPrefs?.dailyDigestHour ?? 8
    if (currentHour !== preferredHour) continue

    // Check quiet hours
    if (isInQuietHours(pushPrefs?.quietHours)) continue

    // Count today's tasks
    const today = new Date().toISOString().split('T')[0]
    const { count: dueToday } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('due_date', today)
      .not('status', 'eq', 'done')

    const { count: overdue } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lt('due_date', today)
      .not('status', 'eq', 'done')

    const tasksDue = dueToday || 0
    const overdueCount = overdue || 0

    if (tasksDue === 0 && overdueCount === 0) {
      digestSentToday.add(userId)
      continue  // Nothing to report
    }

    const bodyParts: string[] = []
    if (tasksDue > 0) bodyParts.push(`${tasksDue} task${tasksDue !== 1 ? 's' : ''} due today`)
    if (overdueCount > 0) bodyParts.push(`${overdueCount} overdue`)

    const userSubs = await getUserSubscriptions(userId)
    if (!userSubs.length) continue

    await sendPushToUser(userSubs, {
      type: 'daily_digest',
      title: 'Daily Planning Nudge',
      body: bodyParts.join(', ') + '. Ready to plan your day?',
      tag: `daily-digest-${today}`,
      url: '/board',
      timestamp: new Date().toISOString()
    })

    digestSentToday.add(userId)
  }
}

function isInQuietHours(quietHours?: { enabled: boolean; startHour: number; endHour: number }): boolean {
  if (!quietHours?.enabled) return false
  const currentHour = new Date().getHours()
  if (quietHours.startHour > quietHours.endHour) {
    return currentHour >= quietHours.startHour || currentHour < quietHours.endHour
  }
  return currentHour >= quietHours.startHour && currentHour < quietHours.endHour
}
