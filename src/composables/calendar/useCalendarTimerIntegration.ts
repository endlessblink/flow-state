import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import type { CalendarEvent } from '@/types/tasks'

/**
 * TASK-1285: Timer-Calendar Integration
 * BUG-1291: Fix — no move/duplicate, resize to actual time
 *
 * Bridges the timer and calendar systems:
 * - Start timer from calendar event play button
 * - Grow the time block visually in real-time while timer runs
 * - If clicked instance is completed, reuse it (don't create new)
 * - Persist final duration on timer stop/complete using cumulative time
 */
export function useCalendarTimerIntegration(_currentDate: Ref<Date>) {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()

  // Track which instance is being grown by the timer
  // Maps instanceId → extra minutes added by timer
  const timerGrowthMap = ref<Map<string, number>>(new Map())

  // Track the instance being timed for cleanup on stop
  const activeTimerTracking = ref<{
    taskId: string
    instanceId: string
    originalDuration: number
    startedAt: number // timestamp when THIS Pomodoro started
    instanceStartTimestamp: number // when the calendar block originally started (parsed from scheduledTime)
  } | null>(null)

  /**
   * Parse an instance's scheduledDate + scheduledTime into a timestamp.
   * Returns Date.now() as fallback if parsing fails.
   */
  const parseInstanceStartTimestamp = (scheduledDate: string, scheduledTime?: string): number => {
    try {
      const [year, month, day] = scheduledDate.split('-').map(Number)
      if (scheduledTime) {
        const [hours, minutes] = scheduledTime.split(':').map(Number)
        return new Date(year, month - 1, day, hours, minutes).getTime()
      }
      return new Date(year, month - 1, day).getTime()
    } catch {
      return Date.now()
    }
  }

  /**
   * Start timer from a calendar event's play button
   *
   * Logic:
   * 1. If the clicked instance is NOT completed → track it for growth
   * 2. If the clicked instance IS completed → reset to in_progress, reuse it
   * 3. Start the timer via timerStore
   */
  const startTimerOnCalendarEvent = async (calEvent: CalendarEvent) => {
    console.log('🎯 [CALENDAR-TIMER] startTimerOnCalendarEvent called:', {
      taskId: calEvent.taskId,
      instanceId: calEvent.instanceId,
      instanceStatus: calEvent.instanceStatus,
      taskStatus: calEvent.taskStatus
    })

    const task = taskStore.tasks.find(t => t.id === calEvent.taskId)
    if (!task) {
      console.error('🎯 [CALENDAR-TIMER] Task not found in store:', calEvent.taskId,
        'Available tasks:', taskStore.tasks.length)
      return
    }

    // BUG-1294: If timer is already running for this task, no-op — calendar block keeps growing
    if (timerStore.isTimerActive && timerStore.currentTaskId === calEvent.taskId) {
      console.log('🎯 [CALENDAR-TIMER] Timer already running for this task, no-op')
      return
    }

    const isInstanceCompleted = calEvent.instanceStatus === 'completed' || calEvent.taskStatus === 'done'
    let targetInstanceId = calEvent.instanceId
    let targetDuration = calEvent.duration

    if (isInstanceCompleted && calEvent.instanceId) {
      // BUG-1291: Reuse existing instance — reset status, keep original time
      console.log('🎯 [CALENDAR-TIMER] Instance completed, resetting to in_progress (reusing)')
      taskStore.updateTaskInstance(calEvent.taskId, calEvent.instanceId, {
        status: 'scheduled'
      })
      targetInstanceId = calEvent.instanceId
      targetDuration = calEvent.duration
    }

    // Look up the actual instance to get scheduledDate/scheduledTime for cumulative tracking
    const instance = task.instances?.find(i => i.id === targetInstanceId)
    const instanceStartTs = instance
      ? parseInstanceStartTimestamp(instance.scheduledDate, instance.scheduledTime)
      : Date.now()

    // Set up growth tracking
    if (targetInstanceId) {
      activeTimerTracking.value = {
        taskId: calEvent.taskId,
        instanceId: targetInstanceId,
        originalDuration: targetDuration,
        startedAt: Date.now(),
        instanceStartTimestamp: instanceStartTs
      }
      timerGrowthMap.value.set(targetInstanceId, 0)
    }

    // Start the timer (wrap in try/catch)
    try {
      await timerStore.startTimer(calEvent.taskId)
      console.log('🎯 [CALENDAR-TIMER] Timer started successfully for task:', calEvent.taskId)
    } catch (error) {
      console.error('🎯 [CALENDAR-TIMER] Failed to start timer:', error)
    }
  }

  // Watch timer's remaining time to update growth map every minute
  // Growth is cumulative: total elapsed since instance original start
  let lastGrowthMinute = 0

  const stopWatcher = watch(
    () => timerStore.currentSession?.remainingTime,
    (remainingTime) => {
      if (!activeTimerTracking.value || remainingTime === undefined || remainingTime === null) return

      const tracking = activeTimerTracking.value
      // Cumulative elapsed from the instance's original start time
      const totalElapsedMs = Date.now() - tracking.instanceStartTimestamp
      const totalElapsedMinutes = Math.floor(totalElapsedMs / 60000)
      // Growth = how much the block needs to extend beyond its original duration
      const growthMinutes = Math.max(0, totalElapsedMinutes - tracking.originalDuration)

      // Only update when we cross a minute boundary
      if (growthMinutes > lastGrowthMinute) {
        lastGrowthMinute = growthMinutes
        timerGrowthMap.value.set(tracking.instanceId, growthMinutes)
      }
    }
  )

  // Watch for timer stopping (isTimerActive goes false)
  const stopActiveWatcher = watch(
    () => timerStore.isTimerActive,
    (isActive, wasActive) => {
      if (wasActive && !isActive && activeTimerTracking.value) {
        // Timer just stopped — persist the final growth
        persistTimerGrowth()
      }
    }
  )

  /**
   * Persist the elapsed growth to the instance duration.
   * Uses cumulative time from the instance's original start to now.
   */
  const persistTimerGrowth = () => {
    if (!activeTimerTracking.value) return

    const tracking = activeTimerTracking.value
    // Calculate total elapsed from the instance's original start
    const totalElapsedMinutes = Math.ceil((Date.now() - tracking.instanceStartTimestamp) / 60000)
    const newDuration = Math.max(tracking.originalDuration, totalElapsedMinutes)

    if (newDuration > tracking.originalDuration) {
      // Update instance duration to reflect actual time spent
      taskStore.updateTaskInstance(tracking.taskId, tracking.instanceId, {
        duration: newDuration
      })
      console.log('🎯 [CALENDAR-TIMER] Persisted growth:', {
        instanceId: tracking.instanceId,
        originalDuration: tracking.originalDuration,
        newDuration,
        totalElapsedMinutes
      })
    }

    // Clean up tracking state
    timerGrowthMap.value.delete(tracking.instanceId)
    activeTimerTracking.value = null
    lastGrowthMinute = 0
  }

  onUnmounted(() => {
    stopWatcher()
    stopActiveWatcher()
    // Persist any in-progress growth before unmounting
    if (activeTimerTracking.value) {
      persistTimerGrowth()
    }
  })

  return {
    timerGrowthMap,
    activeTimerTracking,
    startTimerOnCalendarEvent
  }
}
