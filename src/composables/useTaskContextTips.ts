/**
 * Task Context Tips
 *
 * Generates contextual tips for tasks based on their state.
 * Pure client-side logic — no AI model calls needed.
 *
 * @see TASK-1283 in MASTER_PLAN.md
 */

import type { useTimerStore } from '@/stores/timer'
import type { useChallengesStore } from '@/stores/challenges'

export interface TaskContextTip {
  text: string
  icon: string
  action?: () => void
}

interface TaskLike {
  id: string
  title?: string
  status?: string
  priority?: string | null
  dueDate?: string | null
  estimatedDuration?: number | null
}

/**
 * Generate context-aware tips for a given task.
 * Returns 0-2 tips based on task state.
 */
export function getTaskContextTips(
  task: TaskLike,
  timerStore?: ReturnType<typeof useTimerStore>,
  challengeStore?: ReturnType<typeof useChallengesStore>
): TaskContextTip[] {
  const tips: TaskContextTip[] = []
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Calculate days overdue
  if (task.dueDate && task.status !== 'done') {
    const dueDateKey = task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate
    if (dueDateKey < todayKey) {
      const [y, m, d] = dueDateKey.split('-').map(Number)
      const dueMs = new Date(y, m - 1, d).getTime()
      const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const daysOverdue = Math.max(1, Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24)))

      if (daysOverdue > 7) {
        tips.push({
          text: `Over a week overdue (${daysOverdue}d) — still relevant?`,
          icon: '⚠️',
        })
      } else {
        tips.push({
          text: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} — reschedule or mark done?`,
          icon: '⏰',
        })
      }
    }
  }

  // Large task suggestion
  if (
    task.status === 'planned' &&
    task.estimatedDuration &&
    task.estimatedDuration > 120 &&
    tips.length < 2
  ) {
    const hours = Math.floor(task.estimatedDuration / 60)
    const mins = task.estimatedDuration % 60
    const durationStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    tips.push({
      text: `Large task (${durationStr}) — break into subtasks?`,
      icon: '📦',
    })
  }

  // In progress but no timer running
  if (
    task.status === 'in_progress' &&
    timerStore &&
    !timerStore.isTimerActive &&
    tips.length < 2
  ) {
    tips.push({
      text: 'In progress but no timer — start one?',
      icon: '▶️',
    })
  }

  // No priority set
  if (!task.priority && tips.length < 2) {
    tips.push({
      text: 'No priority set — add one for better planning',
      icon: '🎯',
    })
  }

  // No due date
  if (!task.dueDate && task.status !== 'done' && tips.length < 2) {
    tips.push({
      text: 'No due date — when should this be done?',
      icon: '📅',
    })
  }

  // Challenge match
  if (challengeStore && tips.length < 2) {
    try {
      const dailies = challengeStore.activeDailies || []
      for (const challenge of dailies) {
        if (challenge.status !== 'active') continue
        // Check if completing this task type could count toward challenge
        if (
          challenge.objectiveType === 'complete_tasks' ||
          (challenge.objectiveType === 'focus_time_minutes' && task.status === 'in_progress')
        ) {
          tips.push({
            text: `Completing this counts toward your "${challenge.title}" challenge!`,
            icon: '⚔️',
          })
          break
        }
      }
    } catch {
      // challenge store not available, skip
    }
  }

  return tips.slice(0, 2)
}
