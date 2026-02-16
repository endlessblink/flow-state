import { supabase, getUserSubscriptions, getUserSettings } from '../db.js'
import { sendPushToUser } from '../pushSender.js'

/** Track sent overdue alerts to prevent spam */
const sentOverdueAlerts = new Map<string, number>()

// Clean old entries every 6 hours
setInterval(() => {
  const sixHoursAgo = Date.now() - 6 * 3600000
  for (const [key, ts] of sentOverdueAlerts) {
    if (ts < sixHoursAgo) sentOverdueAlerts.delete(key)
  }
}, 6 * 3600000)

export async function runOverdueAlerts() {
  const today = new Date().toISOString().split('T')[0]

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, user_id, status')
    .not('status', 'eq', 'done')
    .lt('due_date', today)
    .not('due_date', 'is', null)

  if (error) {
    console.error('[OVERDUE] Query failed:', error)
    return
  }

  if (!tasks?.length) return

  const tasksByUser = new Map<string, typeof tasks>()
  for (const task of tasks) {
    if (!task.user_id) continue
    const existing = tasksByUser.get(task.user_id) || []
    existing.push(task)
    tasksByUser.set(task.user_id, existing)
  }

  for (const [userId, userTasks] of tasksByUser) {
    const settings = await getUserSettings(userId)
    const pushPrefs = settings?.pushNotifications

    if (pushPrefs && !pushPrefs.enabled) continue
    if (pushPrefs?.categories?.overdueAlerts && !pushPrefs.categories.overdueAlerts.webPush) continue
    if (isInQuietHours(pushPrefs?.quietHours)) continue

    const subscriptions = await getUserSubscriptions(userId)
    if (!subscriptions.length) continue

    const cooldownMs = (pushPrefs?.cooldownMinutes || 5) * 60000

    // Send alert for up to 3 overdue tasks (avoid notification spam)
    const tasksToAlert = userTasks.slice(0, 3)

    for (const task of tasksToAlert) {
      const alertKey = `overdue-${task.id}-${today}`
      const lastSent = sentOverdueAlerts.get(alertKey)
      if (lastSent && (Date.now() - lastSent) < cooldownMs) continue

      const daysOverdue = Math.ceil(
        (new Date(today).getTime() - new Date(task.due_date).getTime()) / 86400000
      )

      await sendPushToUser(subscriptions, {
        type: 'overdue_alert',
        title: 'Overdue Task',
        body: `"${task.title}" is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
        tag: `overdue-${task.id}`,
        taskId: task.id,
        url: `/board?task=${task.id}`,
        timestamp: new Date().toISOString()
      })

      sentOverdueAlerts.set(alertKey, Date.now())
    }

    // If more than 3 overdue, send a summary
    if (userTasks.length > 3) {
      const summaryKey = `overdue-summary-${userId}-${today}`
      if (!sentOverdueAlerts.has(summaryKey)) {
        await sendPushToUser(subscriptions, {
          type: 'overdue_alert',
          title: 'Overdue Tasks',
          body: `You have ${userTasks.length} overdue tasks. Time to catch up!`,
          tag: `overdue-summary-${userId}`,
          url: '/board',
          timestamp: new Date().toISOString()
        })
        sentOverdueAlerts.set(summaryKey, Date.now())
      }
    }
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
