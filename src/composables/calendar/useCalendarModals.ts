import { ref } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'

/**
 * Calendar modals composable
 * Manages TaskEditModal and ConfirmationModal (deletion) states
 */
export function useCalendarModals() {
    const taskStore = useTaskStore()

    // Task Edit Modal state
    const isEditModalOpen = ref(false)
    const selectedTask = ref<Task | null>(null)

    // Delete confirmation modal state
    const showConfirmModal = ref(false)
    const taskToDelete = ref<string | null>(null)

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
     * Open delete confirmation modal
     */
    const handleConfirmDelete = (taskId: string) => {
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

    return {
        isEditModalOpen,
        selectedTask,
        showConfirmModal,
        taskToDelete,
        handleEditTask,
        closeEditModal,
        handleConfirmDelete,
        confirmDeleteTask,
        cancelDeleteTask
    }
}
