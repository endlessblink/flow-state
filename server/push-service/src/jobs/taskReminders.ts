import { supabase, getUserSubscriptions, getUserSettings } from '../db.js'
import { sendPushToUser } from '../pushSender.js'

/** Track sent notifications to prevent duplicates */
const sentReminders = new Map<string, number>()  // key -> timestamp

// Clean old entries every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000
  for (const [key, ts] of sentReminders) {
    if (ts < oneHourAgo) sentReminders.delete(key)
  }
}, 3600000)

export async function runTaskReminders() {
  // Fetch tasks due in the next 1440 minutes (1 day) that haven't been completed
  const now = new Date()
  const oneDayFromNow = new Date(now.getTime() + 1440 * 60000)

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, due_time, user_id, status')
    .not('status', 'eq', 'done')
    .not('due_date', 'is', null)
    .lte('due_date', oneDayFromNow.toISOString().split('T')[0])
    .gte('due_date', now.toISOString().split('T')[0])

  if (error) {
    console.error('[TASK-REMINDERS] Query failed:', error)
    return
  }

  if (!tasks?.length) return

  // Group tasks by user
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

    // Check if task reminders are enabled
    if (pushPrefs && !pushPrefs.enabled) continue
    if (pushPrefs?.categories?.taskReminders && !pushPrefs.categories.taskReminders.webPush) continue

    // Check quiet hours
    if (isInQuietHours(pushPrefs?.quietHours)) continue

    const subscriptions = await getUserSubscriptions(userId)
    if (!subscriptions.length) continue

    const leadTimes = pushPrefs?.taskReminderLeadTimes || [15, 60, 1440]
    const cooldownMs = (pushPrefs?.cooldownMinutes || 5) * 60000

    for (const task of userTasks) {
      const dueDateTime = parseDueDateTime(task.due_date, task.due_time)
      if (!dueDateTime) continue

      const minutesUntilDue = (dueDateTime.getTime() - now.getTime()) / 60000

      for (const leadTime of leadTimes) {
        // Check if we're within the reminder window (+-2.5 min for the 5-min cron)
        if (Math.abs(minutesUntilDue - leadTime) <= 2.5) {
          const reminderKey = `${task.id}-${leadTime}`

          // Check deduplication
          const lastSent = sentReminders.get(reminderKey)
          if (lastSent && (Date.now() - lastSent) < cooldownMs) continue

          await sendPushToUser(subscriptions, {
            type: 'task_reminder',
            title: 'Task Reminder',
            body: `"${task.title}" is due in ${formatLeadTime(leadTime)}`,
            tag: `task-reminder-${task.id}-${leadTime}`,
            taskId: task.id,
            url: `/board?task=${task.id}`,
            timestamp: now.toISOString()
          })

          sentReminders.set(reminderKey, Date.now())
        }
      }
    }
  }
}

function parseDueDateTime(dueDate: string, dueTime?: string): Date | null {
  try {
    const dateStr = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T09:00:00`
    return new Date(dateStr)
  } catch {
    return null
  }
}

function formatLeadTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  const days = Math.floor(minutes / 1440)
  return `${days} day${days !== 1 ? 's' : ''}`
}

function isInQuietHours(quietHours?: { enabled: boolean; startHour: number; endHour: number }): boolean {
  if (!quietHours?.enabled) return false
  const currentHour = new Date().getHours()
  if (quietHours.startHour > quietHours.endHour) {
    return currentHour >= quietHours.startHour || currentHour < quietHours.endHour
  }
  return currentHour >= quietHours.startHour && currentHour < quietHours.endHour
}
