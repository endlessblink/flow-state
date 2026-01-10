import { ref } from 'vue'
import type { Task } from '@/stores/tasks'

export function useBoardModals() {
    // Edit modal state
    const showEditModal = ref(false)
    const selectedTask = ref<Task | null>(null)

    // Quick Task Create Modal state
    const showQuickTaskCreate = ref(false)
    const pendingTaskStatus = ref<string>('planned')

    // Confirmation modal state
    const showConfirmModal = ref(false)
    const taskToDelete = ref<string | null>(null)

    const openEditModal = (task: Task) => {
        selectedTask.value = task
        showEditModal.value = true
    }

    const closeEditModal = () => {
        showEditModal.value = false
        selectedTask.value = null
    }

    const openQuickTaskCreate = (status: string) => {
        pendingTaskStatus.value = status
        showQuickTaskCreate.value = true
    }

    const closeQuickTaskCreate = () => {
        showQuickTaskCreate.value = false
        pendingTaskStatus.value = 'planned'
    }

    const openConfirmModal = (taskId: string) => {
        taskToDelete.value = taskId
        showConfirmModal.value = true
    }

    const closeConfirmModal = () => {
        showConfirmModal.value = false
        taskToDelete.value = null
    }

    return {
        // State
        showEditModal,
        selectedTask,
        showQuickTaskCreate,
        pendingTaskStatus,
        showConfirmModal,
        taskToDelete,

        // Actions
        openEditModal,
        closeEditModal,
        openQuickTaskCreate,
        closeQuickTaskCreate,
        openConfirmModal,
        closeConfirmModal
    }
}
