/**
 * TASK-1219: Time Block Progress Notifications
 * Core composable that monitors calendar time blocks and fires milestone alerts.
 *
 * Polling: useIntervalFn every 15 seconds (60s too coarse for "1 min before", 1s wasteful).
 * Dedup: In-memory Set keyed by `taskId-instanceIndex-milestoneId`, reset at midnight.
 * Delivery: Reads settingsStore each tick; fires toast (in-app) and/or OS notification.
 * DND: Checks notification store's existing DND config.
 *
 * BUG-1302: Increased late tolerance from 2min to 10min, added delivery logging,
 * made singleton guard resilient to interval death.
 */

import { ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useNotificationStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { deliverNotification } from '@/utils/notificationDelivery'
import type { TimeBlockMilestone } from '@/types/timeBlockNotifications'
import { DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS } from '@/types/timeBlockNotifications'
import type { TaskInstance } from '@/types/tasks'

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
let tickCount = 0
let activeIntervalId: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL_MS = 15_000  // 15 seconds
// BUG-1302: Increased from 2 min to 10 min — desktop apps may sleep/background,
// causing setInterval to skip ticks. 10 min ensures milestones are caught on wake.
const LATE_TOLERANCE_MS = 10 * 60 * 1000

export function useTimeBlockNotifications() {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const notificationStore = useNotificationStore()
  const { showToast } = useToast()

  const shownMilestones = ref(new Set<string>())
  const currentDate = ref(getTodayStr())

  /**
   * Defensive settings getter — falls back to defaults if settings store
   * was loaded from persisted state that predates the timeBlockNotifications field.
   */
  function getSettings() {
    return settingsStore.timeBlockNotifications ?? DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS
  }

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

    // IMPORTANT: Use rawTasks (unfiltered) — taskStore.tasks is filtered by
    // active smart view/project/status filters and would miss tasks not in the current view
    const tasks = Array.isArray(taskStore.rawTasks) ? taskStore.rawTasks : []

    for (const task of tasks) {
      // Skip completed/soft-deleted tasks
      if (task.status === 'done' || task._soft_deleted) continue

      // Path 1: Instance-based scheduling (primary path)
      if (task.instances && Array.isArray(task.instances)) {
        for (let i = 0; i < task.instances.length; i++) {
          const inst = task.instances[i]
          if (!inst || inst.scheduledDate !== today) continue
          if (!inst.scheduledTime) continue
          if (inst.status === 'skipped') continue

          // Duration fallback: instance.duration → task.estimatedDuration → 30 (matches calendar)
          const duration = inst.duration || task.estimatedDuration || 30

          const [hours, minutes] = inst.scheduledTime.split(':').map(Number)
          if (isNaN(hours) || isNaN(minutes)) continue

          const start = new Date()
          start.setHours(hours, minutes, 0, 0)
          const end = new Date(start.getTime() + duration * 60_000)

          blocks.push({
            taskId: task.id,
            taskTitle: task.title,
            instanceIndex: i,
            startTime: start,
            endTime: end,
            durationMinutes: duration,
            instance: inst
          })
        }
      }

      // BUG-1325: Removed Path 2 (legacy scheduledDate/scheduledTime).
      // Only explicit instances[] drive calendar visibility and notifications.
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
    const settings = getSettings()
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
    const settings = getSettings()
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
   * BUG-1302: Added delivery logging for diagnostics
   */
  function fireMilestone(milestone: TimeBlockMilestone, block: ActiveTimeBlock): void {
    const settings = getSettings()
    const override = block.instance.timeBlockNotifications
    const channels = { ...settings.deliveryChannels, ...override?.deliveryChannels }

    const message = getMessage(milestone, block)
    const title = milestone.id === 'ended' ? 'Time Block Ended' : 'Time Block Alert'

    console.log(`[TIME-BLOCK] Delivering milestone "${milestone.id}" via channels:`, {
      inAppToast: channels.inAppToast,
      osNotification: channels.osNotification,
      sound: channels.sound
    })

    if (channels.inAppToast) {
      const toastType = milestone.id === 'ended' ? 'warning' : 'info'
      showToast(message, toastType, { duration: 8000 })
      console.log('[TIME-BLOCK] Toast delivered:', message)
    }

    if (channels.osNotification) {
      deliverNotification({
        title,
        body: message,
        tag: `timeblock-${block.taskId}-${milestone.id}`,
        sound: channels.sound
      }).then(success => {
        if (success) {
          console.log('[TIME-BLOCK] OS notification delivered')
        } else {
          console.warn('[TIME-BLOCK] OS notification failed — check permission status')
        }
      }).catch(err => {
        console.error('[TIME-BLOCK] OS notification error:', err)
      })
    }
  }

  /**
   * Main tick: scan all active blocks, check milestones, fire notifications
   */
  function tick(): void {
    try {
      tickCount++
      const settings = getSettings()
      if (!settings?.enabled) {
        if (tickCount <= 3) console.log('[TIME-BLOCK] Disabled in settings, skipping tick')
        return
      }

      // Midnight reset
      const today = getTodayStr()
      if (today !== currentDate.value) {
        shownMilestones.value.clear()
        currentDate.value = today
      }

      // DND check
      if (isInDND()) {
        if (tickCount <= 3) console.log('[TIME-BLOCK] DND active, skipping tick')
        return
      }

      const now = Date.now()
      const blocks = getActiveTimeBlocks()

      // Diagnostic: log every tick for the first 4 ticks, then every 20th tick
      if (tickCount <= 4 || tickCount % 20 === 0) {
        const tasks = Array.isArray(taskStore.rawTasks) ? taskStore.rawTasks : []
        const tasksWithInstances = tasks.filter(t => t.instances?.length)
        const tasksWithSchedule = tasks.filter(t => t.scheduledDate === today)
        console.log(`[TIME-BLOCK] Tick #${tickCount}: ${blocks.length} blocks found | ${tasks.length} total tasks | ${tasksWithInstances.length} with instances | ${tasksWithSchedule.length} with scheduledDate=today(${today}) | Notification.permission=${typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}`)

        if (blocks.length === 0 && (tasksWithInstances.length > 0 || tasksWithSchedule.length > 0)) {
          // We have tasks but no blocks detected — log WHY
          for (const task of tasksWithInstances.slice(0, 3)) {
            const todayInst = task.instances?.filter(i => i?.scheduledDate === today)
            console.log(`[TIME-BLOCK] Task "${task.title}": ${task.instances?.length} instances, ${todayInst?.length} for today`, todayInst?.map(i => ({
              date: i.scheduledDate,
              time: i.scheduledTime,
              duration: i.duration,
              status: i.status
            })))
          }
          for (const task of tasksWithSchedule.slice(0, 3)) {
            console.log(`[TIME-BLOCK] Legacy task "${task.title}": scheduledDate=${task.scheduledDate} scheduledTime=${task.scheduledTime} duration=${task.estimatedDuration}`)
          }
        }
      }

      if (blocks.length > 0 && (tickCount <= 4 || tickCount % 20 === 0)) {
        console.log(`[TIME-BLOCK] Active blocks:`, blocks.map(b => ({
          task: b.taskTitle,
          start: b.startTime.toLocaleTimeString(),
          end: b.endTime.toLocaleTimeString(),
          duration: b.durationMinutes + 'min'
        })))
      }

      for (const block of blocks) {
        const milestones = getEffectiveMilestones(block)

        for (const milestone of milestones) {
          const key = dedupKey(block, milestone)
          if (shownMilestones.value.has(key)) continue

          const triggerTime = getMilestoneTriggerTime(milestone, block)
          if (!triggerTime) continue

          const triggerMs = triggerTime.getTime()

          // Fire if trigger time has passed and we're within the tolerance window
          // BUG-1302: Tolerance increased to 10 min for desktop sleep/background resilience
          if (now >= triggerMs && now - triggerMs <= LATE_TOLERANCE_MS) {
            const lateBy = Math.round((now - triggerMs) / 1000)
            console.log(`[TIME-BLOCK] 🔔 FIRING milestone "${milestone.id}" for "${block.taskTitle}" (${lateBy}s after trigger)`)
            shownMilestones.value.add(key)
            fireMilestone(milestone, block)
          }
        }
      }
    } catch (err) {
      console.error('[TIME-BLOCK] Tick error (non-fatal):', err)
    }
  }

  function start(): void {
    // BUG-1302: Resilient singleton — if interval died (e.g., GC), allow restart
    if (isInitialized && activeIntervalId !== null) {
      console.log('[TIME-BLOCK] Already initialized, skipping')
      return
    }

    // Clean up dead state if needed
    if (isInitialized && activeIntervalId === null) {
      console.warn('[TIME-BLOCK] Singleton guard was set but interval was dead — restarting')
    }

    isInitialized = true

    const settings = getSettings()
    const permissionStatus = typeof Notification !== 'undefined' ? Notification.permission : 'N/A'
    console.log('[TIME-BLOCK] Starting with settings:', {
      enabled: settings.enabled,
      milestones: settings.milestones.map(m => `${m.id}(${m.enabled ? 'on' : 'off'})`),
      channels: settings.deliveryChannels,
      totalTasks: taskStore.rawTasks?.length ?? 0,
      notificationPermission: permissionStatus,
      lateTolerance: `${LATE_TOLERANCE_MS / 60000} min`
    })

    // Run immediately once, then every 15 seconds
    tick()
    activeIntervalId = setInterval(tick, POLL_INTERVAL_MS)
    console.log('[TIME-BLOCK] Notification polling started (15s interval)')
  }

  function stop(): void {
    if (activeIntervalId) {
      clearInterval(activeIntervalId)
      activeIntervalId = null
    }
    isInitialized = false
    console.log('[TIME-BLOCK] Notification polling stopped')
  }

  // NOTE: No onUnmounted — this composable is called inside onMounted (outside
  // Vue setup context), so lifecycle hooks don't attach. The singleton guard
  // + module-level activeIntervalId ensure cleanup via stop() if ever needed.

  return {
    start,
    stop,
    shownMilestones,
    // Exposed for testing
    getActiveTimeBlocks,
    tick
  }
}
