<template>
  <!-- Task Edit Modal -->
  <TaskEditModal
    :is-open="modals.isEditModalOpen"
    :task="modals.selectedTask"
    @close="modals.closeEditModal"
  />

  <!-- Quick Task Create Modal -->
  <QuickTaskCreateModal
    :is-open="modals.isQuickTaskCreateOpen"
    :loading="false"
    @cancel="modals.closeQuickTaskCreate"
    @create="handleQuickTaskCreateAndClose"
  />

  <!-- Batch Edit Modal -->
  <BatchEditModal
    :is-open="modals.isBatchEditModalOpen"
    :task-ids="modals.batchEditTaskIds"
    @close="modals.closeBatchEditModal"
    @applied="$emit('handleBatchEditApplied')"
  />

  <!-- Section Settings Modal -->
  <GroupSettingsMenu
    :section="modals.editingSection"
    :is-visible="modals.isSectionSettingsOpen"
    @close="modals.closeSectionSettings"
    @save="(settings) => $emit('handleSectionSettingsSave', settings)"
  />

  <!-- Unified Group Modal (create + edit with optional smart settings) -->
  <UnifiedGroupModal
    :is-open="modals.isGroupModalOpen"
    :group="modals.selectedGroup"
    :position="modals.groupModalPosition"
    @close="modals.closeGroupModal"
    @created="(group) => $emit('handleGroupCreated', group)"
    @updated="(group) => $emit('handleGroupUpdated', group)"
  />

  <!-- Group Edit Modal -->
  <GroupEditModal
    :section="modals.selectedSectionForEdit"
    :is-visible="modals.isGroupEditModalOpen"
    @close="modals.closeGroupEditModal"
    @save="(updatedSection) => $emit('handleGroupEditSave', updatedSection)"
  />

  <!-- Group Delete Confirmation Modal -->
  <ConfirmationModal
    :is-open="modals.isDeleteGroupModalOpen"
    title="Delete Group"
    :message="modals.deleteGroupMessage"
    confirm-text="Delete"
    @confirm="handleDeleteGroupConfirm"
    @cancel="modals.closeDeleteGroupModal"
  />

  <!-- Bulk Delete Confirmation Modal (Shift+Delete on multiple items) -->
  <ConfirmationModal
    :is-open="modals.isBulkDeleteModalOpen"
    :title="modals.bulkDeleteTitle"
    :message="modals.bulkDeleteMessage"
    :details="modals.bulkDeleteItems.map(item => `${item.type === 'section' ? '▤' : '📌'} ${item.name}`)"
    :confirm-text="modals.bulkDeleteIsPermanent ? 'Delete Permanently' : 'Remove'"
    @confirm="handleBulkDeleteConfirm"
    @cancel="modals.closeBulkDeleteModal"
  />
</template>

<script setup lang="ts">
import { useCanvasModalsStore } from '@/stores/canvas/modals'

// Components
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import BatchEditModal from '@/components/tasks/BatchEditModal.vue'
import GroupSettingsMenu from '@/components/canvas/GroupSettingsMenu.vue'
import UnifiedGroupModal from '@/components/canvas/UnifiedGroupModal.vue'
import GroupEditModal from '@/components/canvas/GroupEditModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'

interface QuickTaskData {
  title: string
  description: string
  status: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  projectId?: string
}

const emit = defineEmits<{
  (e: 'handleQuickTaskCreate', data: QuickTaskData): void
  (e: 'handleBatchEditApplied'): void
  (e: 'handleSectionSettingsSave', settings: any): void
  (e: 'handleGroupCreated', group: any): void
  (e: 'handleGroupUpdated', group: any): void
  (e: 'handleGroupEditSave', updatedSection: any): void
  (e: 'confirmDeleteGroup'): void
  (e: 'confirmBulkDelete'): void
}>()

const modals = useCanvasModalsStore()

// FIX: Handle quick task create - emit full data AND close modal
const handleQuickTaskCreateAndClose = (data: QuickTaskData) => {
  emit('handleQuickTaskCreate', data)
  modals.closeQuickTaskCreate()
}

// BUG-1074 FIX: Use explicit emit function to ensure proper event propagation
// BUG-1089 FIX: Close modal via Pinia store after emitting confirm event
const handleBulkDeleteConfirm = () => {
  emit('confirmBulkDelete')
  modals.closeBulkDeleteModal()
}

// BUG-1076 FIX: Handler for delete group confirmation
// BUG-1089 FIX: Close modal via Pinia store after emitting confirm event
const handleDeleteGroupConfirm = () => {
  emit('confirmDeleteGroup')
  modals.closeDeleteGroupModal()
}

</script>
