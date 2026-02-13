// Arena sync — bridges task/timer stores to arena store.
// Watches for task completions and pomodoro events, calls arena store actions.
import { watch, onUnmounted } from 'vue'
import { useArenaStore } from '@/stores/arena'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import type { Task } from '@/types/tasks'

export function useArenaSync() {
  const arenaStore = useArenaStore()
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()

  // ─── Watch Task Completions ───
  // Track status transitions to 'done' for tasks that have enemy counterparts.

  const stopTaskWatch = watch(
    () => taskStore._rawTasks.map(t => ({ id: t.id, status: t.status })),
    (current, previous) => {
      if (!previous) return
      if (arenaStore.phase !== 'wave_active' && arenaStore.phase !== 'boss_phase') return

      for (const task of current) {
        const prev = previous.find(p => p.id === task.id)
        if (prev && prev.status !== 'done' && task.status === 'done') {
          arenaStore.handleTaskCompleted(task.id)
        }
      }
    },
    { deep: true }
  )

  // ─── Watch Pomodoro Timer ───
  // When timer starts for a task with an enemy, focus on that enemy.
  // When timer completes, deal focus damage.

  const stopTimerActiveWatch = watch(
    () => timerStore.isTimerActive,
    (active, wasActive) => {
      if (arenaStore.phase !== 'wave_active' && arenaStore.phase !== 'boss_phase') return

      if (active && timerStore.currentTaskId) {
        arenaStore.handlePomodoroStart(timerStore.currentTaskId)
      } else if (!active && wasActive && timerStore.currentTaskId) {
        arenaStore.handlePomodoroComplete()
      }
    }
  )

  // ─── Init ───
  // Load overdue + today tasks and initialize arena if not already done.

  function initIfNeeded() {
    if (arenaStore.phase !== 'idle') return

    // Get all tasks from raw store, filter to overdue + due today
    const allTasks = taskStore._rawTasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const eligible = allTasks.filter((t: Task) => {
      if (t.status === 'done') return false
      if (!t.dueDate) return false

      const due = new Date(t.dueDate)
      due.setHours(0, 0, 0, 0)

      // Overdue or due today
      return due <= today
    })

    if (eligible.length > 0) {
      arenaStore.initializeArena(eligible)
    }
  }

  onUnmounted(() => {
    stopTaskWatch()
    stopTimerActiveWatch()
  })

  return { initIfNeeded }
}
