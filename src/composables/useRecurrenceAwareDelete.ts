/**
 * TASK-1520 follow-up: Global recurrence-aware delete composable.
 *
 * Wraps task delete calls so that recurring tasks always show the
 * RecurrenceDeleteModal (handled by ModalManager via a global CustomEvent),
 * while non-recurring tasks proceed with the normal undo-capable delete flow.
 */
import { useTaskStore } from '@/stores/tasks'

export function useRecurrenceAwareDelete() {
  const taskStore = useTaskStore()

  /**
   * Delete a task with recurrence awareness.
   * - Recurring tasks: dispatches 'recurrence-delete-requested' for ModalManager.
   * - Non-recurring tasks: performs undo-capable soft or permanent delete.
   */
  async function recurrenceAwareDelete(
    taskId: string,
    options?: { permanent?: boolean }
  ) {
    const allTasks = taskStore._rawTasks ?? taskStore.tasks
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    if (task.recurrenceRule) {
      // ModalManager listens for this event and shows RecurrenceDeleteModal
      window.dispatchEvent(
        new CustomEvent('recurrence-delete-requested', {
          detail: { taskId, permanent: options?.permanent ?? false }
        })
      )
      return
    }

    // Non-recurring — normal delete with undo support
    if (options?.permanent) {
      const { getUndoSystem } = await import('@/composables/undoSingleton')
      await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)
    } else {
      const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
      const { deleteTaskWithUndo } = useUnifiedUndoRedo()
      await deleteTaskWithUndo(taskId)
    }
  }

  return { recurrenceAwareDelete }
}
