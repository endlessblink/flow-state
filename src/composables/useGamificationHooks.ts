/**
 * Gamification Hooks Composable
 * FEATURE-1118: Integration hooks for task and timer stores
 * FEATURE-1132: Challenge progress tracking integration
 *
 * This composable provides methods to award XP and track stats
 * when tasks are completed, pomodoros finish, etc.
 * Also integrates with challenge progress tracking.
 */

import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { XP_VALUES } from '@/types/gamification'
import type { Task } from '@/types/tasks'

export function useGamificationHooks() {
  const gamificationStore = useGamificationStore()
  const challengesStore = useChallengesStore()

  /**
   * Called when a task is marked as completed
   */
  async function onTaskCompleted(task: Task, options?: {
    wasOverdue?: boolean
    createdAt?: Date
  }) {
    if (!gamificationStore.isEnabled) return null

    // Calculate if task was completed quickly (for speed achievement)
    const createdAt = options?.createdAt || task.createdAt
    const completedAt = new Date()
    const secondsSinceCreation = (completedAt.getTime() - new Date(createdAt).getTime()) / 1000

    // Check for speed demon achievement (under 60 seconds)
    if (secondsSinceCreation < 60) {
      await gamificationStore.triggerSpecialAchievement('speed_completion')
      await gamificationStore.incrementStat('speedCompletions')
    }

    // Check for time-based achievements
    const hour = completedAt.getHours()
    if (hour >= 0 && hour < 4) {
      await gamificationStore.triggerSpecialAchievement('midnight_task')
      await gamificationStore.incrementStat('midnightTasks')
    }
    if (hour >= 4 && hour < 6) {
      await gamificationStore.triggerSpecialAchievement('early_task')
    }

    // Track stats
    await gamificationStore.incrementStat('tasksCompleted')

    if (!options?.wasOverdue) {
      await gamificationStore.incrementStat('tasksCompletedOnTime')
    }

    if (task.priority === 'high') {
      await gamificationStore.incrementStat('tasksCompletedHighPriority')
    }

    // Award XP
    const result = await gamificationStore.awardXp(XP_VALUES.TASK_COMPLETE_BASE, 'task_complete', {
      taskId: task.id,
      priority: task.priority,
      isOverdue: options?.wasOverdue,
    })

    // FEATURE-1132: Track challenge progress
    if (challengesStore.isInitialized) {
      // Complete tasks challenge
      await challengesStore.checkChallengeProgress({
        type: 'complete_tasks',
        context: { projectId: task.projectId, priority: task.priority ?? undefined },
      })

      // High priority challenge
      if (task.priority === 'high') {
        await challengesStore.checkChallengeProgress({
          type: 'complete_high_priority',
          context: { priority: 'high' },
        })
      }

      // Clear overdue challenge
      if (options?.wasOverdue) {
        await challengesStore.checkChallengeProgress({
          type: 'clear_overdue',
          context: { wasOverdue: true },
        })
      }

      // Project-specific challenge
      if (task.projectId) {
        await challengesStore.checkChallengeProgress({
          type: 'complete_project_tasks',
          context: { projectId: task.projectId },
        })
      }

      // Complete before hour challenge
      const currentHour = new Date().getHours()
      await challengesStore.checkChallengeProgress({
        type: 'complete_before_hour',
        context: { hour: currentHour },
      })

      // Variety challenge (complete in different projects)
      await challengesStore.checkChallengeProgress({
        type: 'complete_variety',
        context: { projectId: task.projectId },
      })
    }

    return result
  }

  /**
   * Called when a pomodoro session is completed
   */
  async function onPomodoroCompleted(taskId: string | null, options?: {
    consecutiveSessions?: number
    durationMinutes?: number
  }) {
    if (!gamificationStore.isEnabled) return null

    // Track stats
    await gamificationStore.incrementStat('pomodorosCompleted')

    if (options?.durationMinutes) {
      await gamificationStore.incrementStat('totalFocusMinutes', options.durationMinutes)
    }

    // Award XP with consecutive bonus
    const result = await gamificationStore.awardXp(XP_VALUES.POMODORO_COMPLETE_BASE, 'pomodoro_complete', {
      taskId: taskId || undefined,
      consecutivePomodoros: options?.consecutiveSessions,
    })

    // FEATURE-1132: Track challenge progress
    if (challengesStore.isInitialized) {
      // Pomodoro challenge
      await challengesStore.checkChallengeProgress({
        type: 'complete_pomodoros',
      })

      // Focus time challenge
      if (options?.durationMinutes) {
        await challengesStore.checkChallengeProgress({
          type: 'focus_time_minutes',
          amount: options.durationMinutes,
        })
      }
    }

    return result
  }

  /**
   * Track when user uses different views
   */
  function onViewUsed(viewName: 'canvas' | 'board' | 'calendar' | 'mobile') {
    if (!gamificationStore.isEnabled) return

    const viewMap: Record<string, string> = {
      canvas: 'canvas_used',
      board: 'board_used',
      calendar: 'calendar_used',
      mobile: 'mobile_used',
    }

    const achievementKey = viewMap[viewName]
    if (achievementKey) {
      gamificationStore.trackViewUsage(viewName)
      gamificationStore.triggerSpecialAchievement(achievementKey)
    }
  }

  /**
   * Track when user creates their first canvas group
   */
  function onCanvasGroupCreated() {
    if (!gamificationStore.isEnabled) return
    gamificationStore.triggerSpecialAchievement('canvas_used')
    gamificationStore.trackFeatureUsage('canvas_group')
  }

  /**
   * Check if user completed a task on mobile
   */
  function isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  /**
   * Called when app initializes - track daily activity
   */
  async function onAppInitialized() {
    if (!gamificationStore.isEnabled) return

    // Record daily activity (updates streak)
    await gamificationStore.recordDailyActivity()

    // Track mobile usage
    if (isMobileDevice()) {
      onViewUsed('mobile')
    }
  }

  return {
    onTaskCompleted,
    onPomodoroCompleted,
    onViewUsed,
    onCanvasGroupCreated,
    onAppInitialized,
    isMobileDevice,
  }
}
