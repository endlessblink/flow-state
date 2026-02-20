import { supabase, getUserSubscriptions, getUserSettings } from '../db.js'
import { sendPushToUser } from '../pushSender.js'

/** Track sent reminders to prevent duplicates */
const sentCustomReminders = new Map<string, number>()

// Clean old entries every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000
  for (const [key, ts] of sentCustomReminders) {
    if (ts < oneHourAgo) sentCustomReminders.delete(key)
  }
}, 3600000)

/**
 * FEATURE-1363: Check for custom task reminders and fire push notifications
 * Queries tasks with non-empty reminders JSONB for unfired items past their datetime
 */
export async function runCustomReminders() {
  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60000)

  // Query tasks that have reminders with unfired items in the current window
  // We use a raw JSONB query to find tasks with pending reminders
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, reminders, user_id')
    .not('reminders', 'eq', '[]')
    .not('reminders', 'is', null)

  if (error) {
    console.error('[CUSTOM-REMINDERS] Query failed:', error)
    return
  }

  if (!tasks?.length) return

  // Group by user for efficient subscription lookups
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

    // Check if push is enabled
    if (pushPrefs && !pushPrefs.enabled) continue

    // Check quiet hours
    if (isInQuietHours(pushPrefs?.quietHours)) continue

    const subscriptions = await getUserSubscriptions(userId)
    if (!subscriptions.length) continue

    for (const task of userTasks) {
      if (!Array.isArray(task.reminders)) continue

      for (const reminder of task.reminders as Array<{
        id: string
        datetime: string
        label?: string
        fired: boolean
        dismissed: boolean
      }>) {
        if (reminder.fired || reminder.dismissed) continue

        const reminderTime = new Date(reminder.datetime)
        // Fire if reminder time is between 5 min ago and now (covers the cron window)
        if (reminderTime >= fiveMinAgo && reminderTime <= now) {
          const reminderKey = `custom-${reminder.id}`

          // Dedup check
          if (sentCustomReminders.has(reminderKey)) continue

          await sendPushToUser(subscriptions, {
            type: 'task_reminder',
            title: 'Reminder',
            body: reminder.label || `Reminder for "${task.title}"`,
            tag: `custom-reminder-${reminder.id}`,
            taskId: task.id,
            url: `/board?task=${task.id}`,
            timestamp: now.toISOString()
          })

          sentCustomReminders.set(reminderKey, Date.now())

          // Mark as fired in DB
          const updatedReminders = (task.reminders as Array<{ id: string; fired: boolean }>).map(r =>
            r.id === reminder.id ? { ...r, fired: true } : r
          )

          await supabase
            .from('tasks')
            .update({ reminders: updatedReminders })
            .eq('id', task.id)

          console.log(`[CUSTOM-REMINDERS] Fired reminder ${reminder.id} for task "${task.title}"`)
        }
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
