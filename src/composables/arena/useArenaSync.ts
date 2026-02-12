// Arena sync composable — watches task/timer stores and bridges to arena store
import { watch, onUnmounted } from 'vue'
import { useArenaStore } from '@/stores/arena'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

/**
 * Bridges external store changes (task completions, pomodoro events)
 * into the arena store. Call from the arena view/component.
 */
export function useArenaSync() {
  const arenaStore = useArenaStore()
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()

  // Watch for task completions — detect status transitions to 'done'
  const stopTaskWatch = watch(
    () => taskStore._rawTasks.map(t => ({ id: t.id, status: t.status })),
    (current, previous) => {
      if (!arenaStore.isWaveActive) return
      if (!previous) return

      for (const task of current) {
        const prev = previous.find(p => p.id === task.id)
        if (prev && prev.status !== 'done' && task.status === 'done') {
          arenaStore.handleTaskCompleted(task.id)
        }
      }
    },
    { deep: true }
  )

  // Watch pomodoro timer start
  const stopTimerWatch = watch(
    () => timerStore.isTimerActive,
    (active) => {
      if (!arenaStore.isWaveActive) return
      if (active && timerStore.currentTaskId) {
        arenaStore.handlePomodoroStart(timerStore.currentTaskId)
      } else if (!active && timerStore.currentTaskId) {
        // Pomodoro completed (timer went from active to inactive)
        arenaStore.handlePomodoroComplete(timerStore.currentTaskId)
      }
    }
  )

  // Auto-initialize when arena is opened
  function initIfNeeded() {
    if (!arenaStore.isInitialized) {
      arenaStore.initializeArena()
    }
  }

  onUnmounted(() => {
    // Stop watchers but don't cleanup arena state — it persists across tab switches
    stopTaskWatch()
    stopTimerWatch()
  })

  return { initIfNeeded }
}
