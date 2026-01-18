import { ref } from 'vue'
import type { Task } from '@/stores/tasks'

export type BoardViewType = 'status' | 'priority' | 'date'

export function useBoardModals() {
    // Edit modal state
    const showEditModal = ref(false)
    const selectedTask = ref<Task | null>(null)

    // Quick Task Create Modal state
    const showQuickTaskCreate = ref(false)
    const pendingTaskColumnKey = ref<string>('planned')
    const pendingTaskProjectId = ref<string | undefined>(undefined)
    const pendingTaskViewType = ref<BoardViewType>('status')

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

    const openQuickTaskCreate = (
        columnKey: string,
        projectId?: string,
        viewType?: BoardViewType
    ) => {
        pendingTaskColumnKey.value = columnKey
        pendingTaskProjectId.value = projectId
        pendingTaskViewType.value = viewType || 'status'
        showQuickTaskCreate.value = true
    }

    const closeQuickTaskCreate = () => {
        showQuickTaskCreate.value = false
        pendingTaskColumnKey.value = 'planned'
        pendingTaskProjectId.value = undefined
        pendingTaskViewType.value = 'status'
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
        pendingTaskColumnKey,
        pendingTaskProjectId,
        pendingTaskViewType,
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
