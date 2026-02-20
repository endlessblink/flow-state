import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCalendarCore } from '@/composables/useCalendarCore'
import type { CalendarEvent } from '@/types/tasks'

/**
 * TASK-1285: Timer-Calendar Integration
 * BUG-1291: Fix — no move/duplicate, resize to actual time
 * BUG-1354: Fix — growth tracking auto-initializes for externally-started timers
 *
 * Bridges the timer and calendar systems:
 * - Start timer from calendar event play button
 * - Grow the time block visually in real-time while timer runs
 * - If clicked instance is completed, reuse it (don't create new)
 * - Persist final duration on timer stop/complete using cumulative time
 * - Auto-track growth even when timer started from kanban/sidebar
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
   * BUG-1354: Initialize growth tracking for a task's today-instance.
   * Called when timer is already running but growth tracking wasn't set up
   * (e.g., timer started from kanban board, then user opens calendar).
   */
  const initGrowthTrackingForTask = (taskId: string) => {
    // BUG-1354: Use _rawTasks instead of filtered 'tasks'.
    // Calendar shows tasks from calendarFilteredTasks (bypasses smart view),
    // but taskStore.tasks applies smart view filters. If a smart view is active,
    // the task is visible on calendar but NOT in taskStore.tasks → lookup fails silently.
    const task = taskStore._rawTasks.find(t => t.id === taskId)
    if (!task?.instances) return

    const dateStr = getDateString(_currentDate.value)
    const todayInstance = task.instances.find(i => i?.scheduledDate === dateStr)
    if (!todayInstance?.id || !todayInstance.scheduledTime) return

    const instanceStartTs = parseInstanceStartTimestamp(todayInstance.scheduledDate, todayInstance.scheduledTime)
    const duration = todayInstance.duration || task.estimatedDuration || 30

    activeTimerTracking.value = {
      taskId,
      instanceId: todayInstance.id,
      originalDuration: duration,
      startedAt: Date.now(),
      instanceStartTimestamp: instanceStartTs
    }

    // Calculate current growth immediately (timer may have been running for a while)
    const totalElapsedMs = Date.now() - instanceStartTs
    const totalElapsedMinutes = Math.floor(totalElapsedMs / 60000)
    const growthMinutes = Math.max(0, totalElapsedMinutes - duration)
    lastGrowthMinute = growthMinutes
    timerGrowthMap.value.set(todayInstance.id, growthMinutes)

    if (import.meta.env.DEV) {
      console.log('🎯 [BUG-1354] Auto-initialized growth tracking:', {
        taskId: taskId.slice(0, 8),
        instanceId: todayInstance.id.slice(0, 8),
        originalDuration: duration,
        currentGrowth: growthMinutes,
        totalElapsed: totalElapsedMinutes
      })
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

    // BUG-1354: Use _rawTasks instead of filtered 'tasks'.
    // Calendar shows tasks from calendarFilteredTasks (bypasses smart view filters),
    // but taskStore.tasks applies smart view + status + duration filters.
    // If any smart view is active, the task is visible on the calendar but NOT found
    // by taskStore.tasks.find() → timer silently fails to start → "doesn't lengthen".
    const task = taskStore._rawTasks.find(t => t.id === calEvent.taskId)
    if (!task) {
      console.error('🎯 [CALENDAR-TIMER] Task not found in _rawTasks:', calEvent.taskId,
        'Total raw tasks:', taskStore._rawTasks.length)
      return
    }

    // BUG-1294 + BUG-1354: If timer is already active for this task,
    // ensure growth tracking is set up, resume if paused, then return
    if (timerStore.isTimerActive && timerStore.currentTaskId === calEvent.taskId) {
      if (!activeTimerTracking.value) {
        // Timer was started from outside calendar — set up growth tracking now
        initGrowthTrackingForTask(calEvent.taskId)
      }
      // If timer is paused, pressing play should resume it
      if (timerStore.isPaused) {
        timerStore.resumeTimer()
        console.log('🎯 [CALENDAR-TIMER] Timer resumed for this task')
      } else {
        console.log('🎯 [CALENDAR-TIMER] Timer already running for this task, growth tracking ensured')
      }
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
      lastGrowthMinute = 0
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
   * BUG-1354: Watch for externally-started timers (kanban, sidebar, etc.)
   * If a timer starts for a task that has a calendar instance today,
   * auto-initialize growth tracking so the block grows in the calendar.
   */
  const stopExternalTimerWatcher = watch(
    () => ({ active: timerStore.isTimerActive, taskId: timerStore.currentTaskId }),
    ({ active, taskId }) => {
      if (active && taskId && !activeTimerTracking.value) {
        // Timer just became active and we have no tracking — check if this task has a today-instance
        initGrowthTrackingForTask(taskId)
      }
    },
    { immediate: true }
  )

  /**
   * Persist the elapsed growth to the instance duration.
   * Uses cumulative time from the instance's original start to now.
   *
   * BUG-1354 FIX: Keep growth map entry until local state is updated
   * to prevent visual flash where block briefly shrinks.
   */
  const persistTimerGrowth = () => {
    if (!activeTimerTracking.value) return

    const tracking = activeTimerTracking.value
    // Calculate total elapsed from the instance's original start
    const totalElapsedMinutes = Math.ceil((Date.now() - tracking.instanceStartTimestamp) / 60000)
    const newDuration = Math.max(tracking.originalDuration, totalElapsedMinutes)

    // BUG-1354 FIX: Clean up tracking state BEFORE the async update,
    // but keep the growth map value so the visual block doesn't flash.
    // The growth map value will be redundant once updateTaskInstance
    // persists the new duration (since visualDuration = duration + growth,
    // and duration will now include the growth, making growth = 0 equivalent).
    const instanceId = tracking.instanceId
    activeTimerTracking.value = null
    lastGrowthMinute = 0

    if (newDuration > tracking.originalDuration) {
      // Update instance duration to reflect actual time spent
      // This is async but the local state update in updateTask happens synchronously
      // (line 474 of taskOperations.ts). After that sync update, the computed will
      // see: duration = newDuration, growthMinutes = old cached value.
      // visualDuration = newDuration + oldGrowth = slightly too large momentarily,
      // but we clear the growth map right after to correct it.
      taskStore.updateTaskInstance(tracking.taskId, instanceId, {
        duration: newDuration
      })
      console.log('🎯 [CALENDAR-TIMER] Persisted growth:', {
        instanceId,
        originalDuration: tracking.originalDuration,
        newDuration,
        totalElapsedMinutes
      })
    }

    // Clear growth map AFTER updateTaskInstance has updated local state
    // (updateTaskInstance → updateTask → _rawTasks[index] = {...} is synchronous)
    // So by the time we reach here, the instance duration is already updated locally.
    timerGrowthMap.value.delete(instanceId)
  }

  onUnmounted(() => {
    stopWatcher()
    stopActiveWatcher()
    stopExternalTimerWatcher()
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
