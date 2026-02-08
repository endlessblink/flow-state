/**
 * TASK-1219: Time Block Progress Notifications
 * Core composable that monitors calendar time blocks and fires milestone alerts.
 *
 * Polling: useIntervalFn every 15 seconds (60s too coarse for "1 min before", 1s wasteful).
 * Dedup: In-memory Set keyed by `taskId-instanceIndex-milestoneId`, reset at midnight.
 * Delivery: Reads settingsStore each tick; fires toast (in-app) and/or OS notification.
 * DND: Checks notification store's existing DND config.
 */

import { ref, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useNotificationStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { deliverNotification } from '@/utils/notificationDelivery'
import type { TimeBlockMilestone } from '@/types/timeBlockNotifications'
import type { Task, TaskInstance } from '@/types/tasks'

interface ActiveTimeBlock {
  taskId: string
  taskTitle: string
  instanceIndex: number
  startTime: Date
  endTime: Date
  durationMinutes: number
  instance: TaskInstance
}

// Module-level singleton guard
let isInitialized = false

const POLL_INTERVAL_MS = 15_000  // 15 seconds
// Tolerance: don't fire milestones that are more than 2 minutes old
const LATE_TOLERANCE_MS = 2 * 60 * 1000

export function useTimeBlockNotifications() {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const notificationStore = useNotificationStore()
  const { showToast } = useToast()

  const shownMilestones = ref(new Set<string>())
  const currentDate = ref(getTodayStr())
  let intervalId: ReturnType<typeof setInterval> | null = null

  function getTodayStr(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /**
   * Get all active time blocks for today from task instances
   */
  function getActiveTimeBlocks(): ActiveTimeBlock[] {
    const today = getTodayStr()
    const blocks: ActiveTimeBlock[] = []

    const tasks = Array.isArray(taskStore.tasks) ? taskStore.tasks : []

    for (const task of tasks) {
      if (!task.instances || !Array.isArray(task.instances)) continue

      for (let i = 0; i < task.instances.length; i++) {
        const inst = task.instances[i]
        if (inst.scheduledDate !== today) continue
        if (!inst.scheduledTime || !inst.duration) continue
        if (inst.status === 'skipped') continue

        const [hours, minutes] = inst.scheduledTime.split(':').map(Number)
        const start = new Date()
        start.setHours(hours, minutes, 0, 0)

        const end = new Date(start.getTime() + inst.duration * 60_000)

        blocks.push({
          taskId: task.id,
          taskTitle: task.title,
          instanceIndex: i,
          startTime: start,
          endTime: end,
          durationMinutes: inst.duration,
          instance: inst
        })
      }
    }

    return blocks
  }

  /**
   * Compute the trigger time for a milestone relative to a time block
   */
  function getMilestoneTriggerTime(milestone: TimeBlockMilestone, block: ActiveTimeBlock): Date | null {
    switch (milestone.type) {
      case 'percentage': {
        const offsetMs = (milestone.value / 100) * block.durationMinutes * 60_000
        return new Date(block.startTime.getTime() + offsetMs)
      }
      case 'before-end': {
        // Skip if block duration is <= the before-end value
        if (block.durationMinutes <= milestone.value) return null
        return new Date(block.endTime.getTime() - milestone.value * 60_000)
      }
      case 'at-end': {
        return new Date(block.endTime.getTime())
      }
      default:
        return null
    }
  }

  /**
   * Build the dedup key for a milestone + block combination
   */
  function dedupKey(block: ActiveTimeBlock, milestone: TimeBlockMilestone): string {
    return `${block.taskId}-${block.instanceIndex}-${milestone.id}`
  }

  /**
   * Get effective milestones (global settings merged with per-instance overrides)
   */
  function getEffectiveMilestones(block: ActiveTimeBlock): TimeBlockMilestone[] {
    const settings = settingsStore.timeBlockNotifications
    const override = block.instance.timeBlockNotifications

    // If override explicitly disables, return empty
    if (override?.enabled === false) return []

    let milestones = settings.milestones.filter(m => m.enabled)

    // Apply per-instance milestone overrides
    if (override?.milestones) {
      milestones = milestones.map(m => {
        const overrideMilestone = override.milestones!.find(om => om.id === m.id)
        if (overrideMilestone) {
          return { ...m, ...overrideMilestone } as TimeBlockMilestone
        }
        return m
      }).filter(m => m.enabled)
    }

    return milestones
  }

  /**
   * Check if currently in Do Not Disturb hours
   */
  function isInDND(): boolean {
    const settings = settingsStore.timeBlockNotifications
    if (!settings.respectDoNotDisturb) return false

    const dndPrefs = notificationStore.defaultPreferences?.doNotDisturb
    if (!dndPrefs?.enabled) return false

    const currentHour = new Date().getHours()
    if (dndPrefs.startHour > dndPrefs.endHour) {
      // Overnight DND (e.g., 22:00 to 08:00)
      return currentHour >= dndPrefs.startHour || currentHour < dndPrefs.endHour
    } else {
      return currentHour >= dndPrefs.startHour && currentHour < dndPrefs.endHour
    }
  }

  /**
   * Get the notification message for a milestone
   */
  function getMessage(milestone: TimeBlockMilestone, block: ActiveTimeBlock): string {
    switch (milestone.id) {
      case 'halfway':
        return `Halfway through "${block.taskTitle}" (${Math.round(block.durationMinutes / 2)} min remaining)`
      case '1min-before':
        return `"${block.taskTitle}" ends in 1 minute`
      case 'ended':
        return `Time block "${block.taskTitle}" has ended`
      default:
        return `${milestone.label}: "${block.taskTitle}"`
    }
  }

  /**
   * Fire notifications for a milestone via configured channels
   */
  function fireMilestone(milestone: TimeBlockMilestone, block: ActiveTimeBlock): void {
    const settings = settingsStore.timeBlockNotifications
    const override = block.instance.timeBlockNotifications
    const channels = { ...settings.deliveryChannels, ...override?.deliveryChannels }

    const message = getMessage(milestone, block)
    const title = milestone.id === 'ended' ? 'Time Block Ended' : 'Time Block Alert'

    if (channels.inAppToast) {
      const toastType = milestone.id === 'ended' ? 'warning' : 'info'
      showToast(message, toastType, { duration: 5000 })
    }

    if (channels.osNotification) {
      deliverNotification({
        title,
        body: message,
        tag: `timeblock-${block.taskId}-${milestone.id}`,
        sound: channels.sound
      })
    }
  }

  /**
   * Main tick: scan all active blocks, check milestones, fire notifications
   */
  function tick(): void {
    const settings = settingsStore.timeBlockNotifications
    if (!settings.enabled) return

    // Midnight reset
    const today = getTodayStr()
    if (today !== currentDate.value) {
      shownMilestones.value.clear()
      currentDate.value = today
    }

    // DND check
    if (isInDND()) return

    const now = Date.now()
    const blocks = getActiveTimeBlocks()

    for (const block of blocks) {
      const milestones = getEffectiveMilestones(block)

      for (const milestone of milestones) {
        const key = dedupKey(block, milestone)
        if (shownMilestones.value.has(key)) continue

        const triggerTime = getMilestoneTriggerTime(milestone, block)
        if (!triggerTime) continue

        const triggerMs = triggerTime.getTime()

        // Fire if trigger time has passed and we're within the tolerance window
        if (now >= triggerMs && now - triggerMs <= LATE_TOLERANCE_MS) {
          shownMilestones.value.add(key)
          fireMilestone(milestone, block)
        }
      }
    }
  }

  function start(): void {
    if (isInitialized) {
      console.log('[TIME-BLOCK] Already initialized, skipping')
      return
    }

    isInitialized = true
    // Run immediately once, then every 15 seconds
    tick()
    intervalId = setInterval(tick, POLL_INTERVAL_MS)
    console.log('[TIME-BLOCK] Notification polling started (15s interval)')
  }

  function stop(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    isInitialized = false
    console.log('[TIME-BLOCK] Notification polling stopped')
  }

  onUnmounted(() => {
    stop()
  })

  return {
    start,
    stop,
    shownMilestones,
    // Exposed for testing
    getActiveTimeBlocks,
    tick
  }
}
