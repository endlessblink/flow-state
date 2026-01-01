<template>
  <!-- Task Edit Modal -->
  <TaskEditModal
    :is-open="isEditModalOpen"
    :task="selectedTask"
    @close="$emit('closeEditModal')"
  />

  <!-- Quick Task Create Modal -->
  <QuickTaskCreateModal
    :is-open="isQuickTaskCreateOpen"
    :loading="false"
    @cancel="$emit('closeQuickTaskCreate')"
    @create="(title, description) => $emit('handleQuickTaskCreate', title, description)"
  />

  <!-- Batch Edit Modal -->
  <BatchEditModal
    :is-open="isBatchEditModalOpen"
    :task-ids="batchEditTaskIds"
    @close="$emit('closeBatchEditModal')"
    @applied="$emit('handleBatchEditApplied')"
  />

  <!-- Section Settings Modal -->
  <GroupSettingsMenu
    :section="editingSection"
    :is-visible="isSectionSettingsOpen"
    @close="$emit('closeSectionSettingsModal')"
    @save="(settings) => $emit('handleSectionSettingsSave', settings)"
  />

  <!-- Unified Group Modal (create + edit with optional smart settings) -->
  <UnifiedGroupModal
    :is-open="isGroupModalOpen"
    :group="selectedGroup"
    :position="groupModalPosition"
    @close="$emit('closeGroupModal')"
    @created="(group) => $emit('handleGroupCreated', group)"
    @updated="(group) => $emit('handleGroupUpdated', group)"
  />

  <!-- Group Edit Modal -->
  <GroupEditModal
    :section="selectedSectionForEdit"
    :is-visible="isGroupEditModalOpen"
    @close="$emit('closeGroupEditModal')"
    @save="(updatedSection) => $emit('handleGroupEditSave', updatedSection)"
  />

  <!-- Group Delete Confirmation Modal -->
  <ConfirmationModal
    :is-open="isDeleteGroupModalOpen"
    title="Delete Group"
    :message="deleteGroupMessage"
    confirm-text="Delete"
    @confirm="$emit('confirmDeleteGroup')"
    @cancel="$emit('cancelDeleteGroup')"
  />

  <!-- Bulk Delete Confirmation Modal (Shift+Delete on multiple items) -->
  <ConfirmationModal
    :is-open="isBulkDeleteModalOpen"
    :title="bulkDeleteTitle"
    :message="bulkDeleteMessage"
    :details="bulkDeleteItems.map(item => `${item.type === 'section' ? '📁' : '📌'} ${item.name}`)"
    :confirm-text="bulkDeleteIsPermanent ? 'Delete Permanently' : 'Remove'"
    @confirm="$emit('confirmBulkDelete')"
    @cancel="$emit('cancelBulkDelete')"
  />
</template>

<script setup lang="ts">
import type { Task } from '@/stores/tasks'
import type { CanvasSection, AssignOnDropSettings } from '@/stores/canvas'

// Components
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import BatchEditModal from '@/components/tasks/BatchEditModal.vue'
import GroupSettingsMenu from '@/components/canvas/GroupSettingsMenu.vue'
import UnifiedGroupModal from '@/components/canvas/UnifiedGroupModal.vue'
import GroupEditModal from '@/components/canvas/GroupEditModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'

defineProps<{
  // Task Edit
  isEditModalOpen: boolean
  selectedTask: Task | null
  
  // Quick Task Create
  isQuickTaskCreateOpen: boolean
  
  // Batch Edit
  isBatchEditModalOpen: boolean
  batchEditTaskIds: string[]
  
  // Section Settings
  isSectionSettingsOpen: boolean
  editingSection: CanvasSection | null
  
  // Unified Group
  isGroupModalOpen: boolean
  selectedGroup: CanvasSection | null
  groupModalPosition: { x: number; y: number }
  
  // Group Edit
  isGroupEditModalOpen: boolean
  selectedSectionForEdit: CanvasSection | null
  
  // Group Delete
  isDeleteGroupModalOpen: boolean
  deleteGroupMessage: string

  // Bulk Delete (Shift+Delete on multiple items)
  isBulkDeleteModalOpen: boolean
  bulkDeleteTitle: string
  bulkDeleteMessage: string
  bulkDeleteItems: { id: string; name: string; type: 'task' | 'section' }[]
  bulkDeleteIsPermanent: boolean
}>()

defineEmits<{
  (e: 'closeEditModal'): void
  (e: 'closeQuickTaskCreate'): void
  (e: 'handleQuickTaskCreate', title: string, description: string): void
  (e: 'closeBatchEditModal'): void
  (e: 'handleBatchEditApplied'): void
  (e: 'closeSectionSettingsModal'): void
  (e: 'handleSectionSettingsSave', settings: { assignOnDrop: AssignOnDropSettings }): void
  (e: 'closeGroupModal'): void
  (e: 'handleGroupCreated', group: CanvasSection): void
  (e: 'handleGroupUpdated', group: CanvasSection): void
  (e: 'closeGroupEditModal'): void
  (e: 'handleGroupEditSave', updatedSection: any): void
  (e: 'confirmDeleteGroup'): void
  (e: 'cancelDeleteGroup'): void
  (e: 'confirmBulkDelete'): void
  (e: 'cancelBulkDelete'): void
}>()
</script>
