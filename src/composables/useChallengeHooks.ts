/**
 * Challenge Progress Hooks Composable
 * FEATURE-1132: Wire task/timer completion to challenge progress
 *
 * This composable provides integration points for challenge progress tracking.
 * Call these functions from task store and timer store when events occur.
 */

import { useChallengesStore } from '@/stores/challenges'
import type { ChallengeProgressEvent } from '@/types/challenges'
import type { Task } from '@/types/tasks'

/**
 * Hook for task completion events
 * Call this when a task is marked as complete
 */
export function onTaskCompleted(task: Task): void {
  const challengesStore = useChallengesStore()

  // Skip if challenges not initialized
  if (!challengesStore.isInitialized) return

  // Base task completion
  challengesStore.checkChallengeProgress({
    type: 'complete_tasks',
    context: { projectId: task.projectId ?? undefined, priority: task.priority ?? undefined },
  })

  // High priority task
  if (task.priority === 'high') {
    challengesStore.checkChallengeProgress({
      type: 'complete_high_priority',
      context: { priority: task.priority },
    })
  }

  // Overdue task cleared
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate)
    const now = new Date()
    if (dueDate < now) {
      challengesStore.checkChallengeProgress({
        type: 'clear_overdue',
        context: { wasOverdue: true },
      })
    }
  }

  // Project-specific task
  if (task.projectId) {
    challengesStore.checkChallengeProgress({
      type: 'complete_project_tasks',
      context: { projectId: task.projectId },
    })
  }

  // Time-based completion (before specific hour)
  const currentHour = new Date().getHours()
  if (currentHour < 12) {
    challengesStore.checkChallengeProgress({
      type: 'complete_before_hour',
      context: { hour: currentHour },
    })
  }

  console.log('[ChallengeHooks] Task completed:', task.title)
}

/**
 * Hook for pomodoro completion events
 * Call this when a pomodoro session completes
 */
export function onPomodoroCompleted(durationMinutes: number = 25): void {
  const challengesStore = useChallengesStore()

  // Skip if challenges not initialized
  if (!challengesStore.isInitialized) return

  // Pomodoro completion
  challengesStore.checkChallengeProgress({
    type: 'complete_pomodoros',
    amount: 1,
  })

  // Focus time accumulation
  challengesStore.checkChallengeProgress({
    type: 'focus_time_minutes',
    amount: durationMinutes,
  })

  console.log('[ChallengeHooks] Pomodoro completed:', durationMinutes, 'minutes')
}

/**
 * Hook for project variety tracking
 * Call this when user works on a different project
 */
export function onProjectTouched(projectId: string): void {
  const challengesStore = useChallengesStore()

  // Skip if challenges not initialized
  if (!challengesStore.isInitialized) return

  // This should track unique projects touched today
  // The store will need to handle deduplication
  challengesStore.checkChallengeProgress({
    type: 'complete_variety',
    amount: 1,
    context: { projectId },
  })
}

/**
 * Generic progress event emitter
 * Use this for custom challenge progress tracking
 */
export function emitChallengeProgress(event: ChallengeProgressEvent): void {
  const challengesStore = useChallengesStore()

  if (!challengesStore.isInitialized) return

  challengesStore.checkChallengeProgress(event)
}

/**
 * Composable wrapper for use in Vue components
 */
export function useChallengeHooks() {
  return {
    onTaskCompleted,
    onPomodoroCompleted,
    onProjectTouched,
    emitChallengeProgress,
  }
}
