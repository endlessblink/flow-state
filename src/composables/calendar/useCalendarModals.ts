import { ref } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'

/**
 * Calendar modals composable
 * Manages TaskEditModal and ConfirmationModal (deletion/unschedule) states
 */
export function useCalendarModals() {
    const taskStore = useTaskStore()

    // Task Edit Modal state
    const isEditModalOpen = ref(false)
    const selectedTask = ref<Task | null>(null)

    // Delete confirmation modal state
    const showConfirmModal = ref(false)
    const taskToDelete = ref<string | null>(null)

    // Unschedule confirmation modal state
    const showUnscheduleModal = ref(false)
    const eventsToUnschedule = ref<Array<{ taskId: string; instanceId?: string }>>([])

    /**
     * Open edit modal for a specific task
     */
    const handleEditTask = (taskId: string) => {
        const task = taskStore.rawTasks.find(t => t.id === taskId)
        if (task) {
            selectedTask.value = task
            isEditModalOpen.value = true
        }
    }

    /**
     * Close the edit modal
     */
    const closeEditModal = () => {
        isEditModalOpen.value = false
        selectedTask.value = null
    }

    /**
     * Open delete confirmation modal (with recurrence check)
     */
    const handleConfirmDelete = (taskId: string) => {
        const rawTasks = taskStore.rawTasks || taskStore.tasks
        const task = rawTasks.find(t => t.id === taskId)
        if (task?.recurrenceRule) {
            window.dispatchEvent(new CustomEvent('recurrence-delete-requested', {
                detail: { taskId, permanent: false }
            }))
            return
        }
        taskToDelete.value = taskId
        showConfirmModal.value = true
    }

    /**
     * Finalize task deletion
     */
    const confirmDeleteTask = async () => {
        if (taskToDelete.value) {
            try {
                await taskStore.deleteTaskWithUndo(taskToDelete.value)
                taskToDelete.value = null
            } catch (_error) {
              // intentionally empty
            }
        }
        showConfirmModal.value = false
    }

    /**
     * Cancel task deletion
     */
    const cancelDeleteTask = () => {
        taskToDelete.value = null
        showConfirmModal.value = false
    }

    /**
     * Open unschedule confirmation modal
     */
    const handleConfirmUnschedule = (events: Array<{ taskId: string; instanceId?: string }>) => {
        eventsToUnschedule.value = events
        showUnscheduleModal.value = true
    }

    /**
     * Finalize unschedule (remove from calendar, return to inbox)
     */
    const confirmUnscheduleTask = async () => {
        for (const event of eventsToUnschedule.value) {
            if (event.instanceId) {
                taskStore.deleteTaskInstanceWithUndo(event.taskId, event.instanceId)
            } else {
                taskStore.unscheduleTaskWithUndo(event.taskId)
            }
        }
        eventsToUnschedule.value = []
        showUnscheduleModal.value = false
    }

    /**
     * Cancel unschedule
     */
    const cancelUnscheduleTask = () => {
        eventsToUnschedule.value = []
        showUnscheduleModal.value = false
    }

    return {
        isEditModalOpen,
        selectedTask,
        showConfirmModal,
        taskToDelete,
        handleEditTask,
        closeEditModal,
        handleConfirmDelete,
        confirmDeleteTask,
        cancelDeleteTask,
        showUnscheduleModal,
        handleConfirmUnschedule,
        confirmUnscheduleTask,
        cancelUnscheduleTask
    }
}
