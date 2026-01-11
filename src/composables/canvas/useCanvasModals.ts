import { storeToRefs } from 'pinia'
import { useCanvasModalsStore } from '@/stores/canvas/modals'

export function useCanvasModals() {
    const modalsStore = useCanvasModalsStore()
    const {
        isEditModalOpen, selectedTask,
        isQuickTaskCreateOpen, quickTaskPosition,
        isBatchEditModalOpen, batchEditTaskIds,
        isSectionSettingsOpen, editingSection,
        isGroupModalOpen, selectedGroup, groupModalPosition,
        isGroupEditModalOpen, selectedSectionForEdit,
        isDeleteGroupModalOpen, groupPendingDelete, deleteGroupMessage,
        isBulkDeleteModalOpen, bulkDeleteTitle, bulkDeleteMessage, bulkDeleteItems, bulkDeleteIsPermanent
    } = storeToRefs(modalsStore)

    return {
        // State (Refs)
        isEditModalOpen, selectedTask,
        isQuickTaskCreateOpen, quickTaskPosition,
        isBatchEditModalOpen, batchEditTaskIds,
        isSectionSettingsOpen, editingSection,
        isGroupModalOpen, selectedGroup, groupModalPosition,
        isGroupEditModalOpen, selectedSectionForEdit,
        isDeleteGroupModalOpen, groupPendingDelete, deleteGroupMessage,
        isBulkDeleteModalOpen, bulkDeleteTitle, bulkDeleteMessage, bulkDeleteItems, bulkDeleteIsPermanent,

        // Actions
        openEditModal: modalsStore.openEditModal,
        closeEditModal: modalsStore.closeEditModal,
        openQuickTaskCreate: modalsStore.openQuickTaskCreate,
        closeQuickTaskCreate: modalsStore.closeQuickTaskCreate,
        openBatchEditModal: modalsStore.openBatchEditModal,
        closeBatchEditModal: modalsStore.closeBatchEditModal,
        handleBatchEditApplied: modalsStore.closeBatchEditModal, // Alias for View compatibility
        openSectionSettings: modalsStore.openSectionSettings,
        closeSectionSettings: modalsStore.closeSectionSettings,
        openGroupModal: modalsStore.openGroupModal,
        closeGroupModal: modalsStore.closeGroupModal,
        openGroupEditModal: modalsStore.openGroupEditModal,
        closeGroupEditModal: modalsStore.closeGroupEditModal,
        openDeleteGroupModal: modalsStore.openDeleteGroupModal,
        closeDeleteGroupModal: modalsStore.closeDeleteGroupModal,
        openBulkDeleteModal: modalsStore.openBulkDeleteModal,
        closeBulkDeleteModal: modalsStore.closeBulkDeleteModal
    }
}
