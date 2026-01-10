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
    @create="(title, description) => $emit('handleQuickTaskCreate', title, description)"
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
    @confirm="$emit('confirmDeleteGroup')"
    @cancel="modals.closeDeleteGroupModal"
  />

  <!-- Bulk Delete Confirmation Modal (Shift+Delete on multiple items) -->
  <ConfirmationModal
    :is-open="modals.isBulkDeleteModalOpen"
    :title="modals.bulkDeleteTitle"
    :message="modals.bulkDeleteMessage"
    :details="modals.bulkDeleteItems.map(item => `${item.type === 'section' ? '📁' : '📌'} ${item.name}`)"
    :confirm-text="modals.bulkDeleteIsPermanent ? 'Delete Permanently' : 'Remove'"
    @confirm="$emit('confirmBulkDelete')"
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

const modals = useCanvasModalsStore()

defineEmits<{
  (e: 'handleQuickTaskCreate', title: string, description: string): void
  (e: 'handleBatchEditApplied'): void
  (e: 'handleSectionSettingsSave', settings: any): void
  (e: 'handleGroupCreated', group: any): void
  (e: 'handleGroupUpdated', group: any): void
  (e: 'handleGroupEditSave', updatedSection: any): void
  (e: 'confirmDeleteGroup'): void
  (e: 'confirmBulkDelete'): void
}>()
</script>
