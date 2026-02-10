import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCalendarCore } from '@/composables/useCalendarCore'
import type { CalendarEvent } from '@/types/tasks'

/**
 * TASK-1285: Timer-Calendar Integration
 *
 * Bridges the timer and calendar systems:
 * - Start timer from calendar event play button
 * - Grow the time block visually in real-time while timer runs
 * - If clicked instance is completed, create a new instance at current time
 * - Persist final duration on timer stop/complete
 */
export function useCalendarTimerIntegration(_currentDate: Ref<Date>) {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()
  const { getDateString } = useCalendarCore()

  // Track which instance is being grown by the timer
  // Maps instanceId → extra minutes added by timer
  const timerGrowthMap = ref<Map<string, number>>(new Map())

  // Track the instance being timed for cleanup on stop
  const activeTimerTracking = ref<{
    taskId: string
    instanceId: string
    originalDuration: number
    startedAt: number // timestamp when timer started
  } | null>(null)

  /**
   * Start timer from a calendar event's play button
   *
   * Logic:
   * 1. If the clicked instance is NOT completed → track it for growth
   * 2. If the clicked instance IS completed → create NEW instance at current time
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
      // Instance already done — create a NEW instance at current time
      const now = new Date()
      const todayStr = getDateString(now)
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      const newInstance = taskStore.createTaskInstance(calEvent.taskId, {
        scheduledDate: todayStr,
        scheduledTime: timeStr,
        duration: task.estimatedDuration || 30,
        status: 'scheduled'
      })

      if (newInstance?.id) {
        targetInstanceId = newInstance.id
        targetDuration = newInstance.duration || task.estimatedDuration || 30
      }
    }

    // Set up growth tracking
    if (targetInstanceId) {
      activeTimerTracking.value = {
        taskId: calEvent.taskId,
        instanceId: targetInstanceId,
        originalDuration: targetDuration,
        startedAt: Date.now()
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
  let lastGrowthMinute = 0

  const stopWatcher = watch(
    () => timerStore.currentSession?.remainingTime,
    (remainingTime) => {
      if (!activeTimerTracking.value || remainingTime === undefined || remainingTime === null) return

      const tracking = activeTimerTracking.value
      const elapsedMs = Date.now() - tracking.startedAt
      const elapsedMinutes = Math.floor(elapsedMs / 60000)

      // Only update when we cross a minute boundary
      if (elapsedMinutes > lastGrowthMinute) {
        lastGrowthMinute = elapsedMinutes
        timerGrowthMap.value.set(tracking.instanceId, elapsedMinutes)
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
   * Persist the elapsed growth to the instance duration
   */
  const persistTimerGrowth = () => {
    if (!activeTimerTracking.value) return

    const tracking = activeTimerTracking.value
    const growthMinutes = timerGrowthMap.value.get(tracking.instanceId) || 0

    if (growthMinutes > 0) {
      const newDuration = tracking.originalDuration + growthMinutes

      // Update instance duration
      taskStore.updateTaskInstance(tracking.taskId, tracking.instanceId, {
        duration: newDuration
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
