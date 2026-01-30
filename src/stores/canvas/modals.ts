import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Task } from '@/types/tasks'
import type { CanvasSection } from './types'

export const useCanvasModalsStore = defineStore('canvasModals', () => {
    // Task Edit Modal
    const isEditModalOpen = ref(false)
    const selectedTask = ref<Task | null>(null)

    // Quick Task Create Modal
    const isQuickTaskCreateOpen = ref(false)
    const quickTaskPosition = ref<{ x: number; y: number; parentId?: string; parentTaskId?: string }>({ x: 0, y: 0 })

    // Batch Edit Modal
    const isBatchEditModalOpen = ref(false)
    const batchEditTaskIds = ref<string[]>([])

    // Section Settings Modal
    const isSectionSettingsOpen = ref(false)
    const editingSection = ref<CanvasSection | null>(null)

    // Group Modal (Create/Edit)
    const isGroupModalOpen = ref(false)
    const selectedGroup = ref<CanvasSection | null>(null)
    const groupModalPosition = ref({ x: 100, y: 100 })

    // Group Edit Modal
    const isGroupEditModalOpen = ref(false)
    const selectedSectionForEdit = ref<CanvasSection | null>(null)

    // Delete Group Confirmation
    const isDeleteGroupModalOpen = ref(false)
    const groupPendingDelete = ref<CanvasSection | null>(null)
    const deleteGroupMessage = ref('')

    // Bulk Delete Confirmation
    const isBulkDeleteModalOpen = ref(false)
    const bulkDeleteTitle = ref('')
    const bulkDeleteMessage = ref('')
    const bulkDeleteItems = ref<{ id: string; name: string; type: 'task' | 'section' }[]>([])
    const bulkDeleteIsPermanent = ref(false)

    // Actions
    const openEditModal = (task: Task) => {
        selectedTask.value = task
        isEditModalOpen.value = true
    }
    const closeEditModal = () => {
        isEditModalOpen.value = false
        selectedTask.value = null
    }

    const openQuickTaskCreate = (position: { x: number; y: number; parentId?: string; parentTaskId?: string }) => {
        quickTaskPosition.value = position
        isQuickTaskCreateOpen.value = true
    }
    const closeQuickTaskCreate = () => {
        isQuickTaskCreateOpen.value = false
    }

    const openBatchEditModal = (taskIds: string[]) => {
        batchEditTaskIds.value = taskIds
        isBatchEditModalOpen.value = true
    }
    const closeBatchEditModal = () => {
        isBatchEditModalOpen.value = false
        batchEditTaskIds.value = []
    }

    const openSectionSettings = (section: CanvasSection) => {
        editingSection.value = section
        isSectionSettingsOpen.value = true
    }
    const closeSectionSettings = () => {
        isSectionSettingsOpen.value = false
        editingSection.value = null
    }

    const openGroupModal = (group: CanvasSection | null, position: { x: number; y: number }) => {
        selectedGroup.value = group
        groupModalPosition.value = position
        isGroupModalOpen.value = true
    }
    const closeGroupModal = () => {
        isGroupModalOpen.value = false
        selectedGroup.value = null
    }

    const openGroupEditModal = (section: CanvasSection) => {
        selectedSectionForEdit.value = section
        isGroupEditModalOpen.value = true
    }
    const closeGroupEditModal = () => {
        isGroupEditModalOpen.value = false
        selectedSectionForEdit.value = null
    }

    const openDeleteGroupModal = (group: CanvasSection, message: string) => {
        groupPendingDelete.value = group
        deleteGroupMessage.value = message
        isDeleteGroupModalOpen.value = true
    }
    const closeDeleteGroupModal = () => {
        isDeleteGroupModalOpen.value = false
        groupPendingDelete.value = null
    }

    const openBulkDeleteModal = (title: string, message: string, items: { id: string; name: string; type: 'task' | 'section' }[], isPermanent: boolean) => {
        bulkDeleteTitle.value = title
        bulkDeleteMessage.value = message
        bulkDeleteItems.value = items
        bulkDeleteIsPermanent.value = isPermanent
        isBulkDeleteModalOpen.value = true
    }
    const closeBulkDeleteModal = () => {
        isBulkDeleteModalOpen.value = false
    }

    return {
        isEditModalOpen, selectedTask,
        isQuickTaskCreateOpen, quickTaskPosition,
        isBatchEditModalOpen, batchEditTaskIds,
        isSectionSettingsOpen, editingSection,
        isGroupModalOpen, selectedGroup, groupModalPosition,
        isGroupEditModalOpen, selectedSectionForEdit,
        isDeleteGroupModalOpen, groupPendingDelete, deleteGroupMessage,
        isBulkDeleteModalOpen, bulkDeleteTitle, bulkDeleteMessage, bulkDeleteItems, bulkDeleteIsPermanent,

        openEditModal, closeEditModal,
        openQuickTaskCreate, closeQuickTaskCreate,
        openBatchEditModal, closeBatchEditModal,
        openSectionSettings, closeSectionSettings,
        openGroupModal, closeGroupModal,
        openGroupEditModal, closeGroupEditModal,
        openDeleteGroupModal, closeDeleteGroupModal,
        openBulkDeleteModal, closeBulkDeleteModal
    }
})
