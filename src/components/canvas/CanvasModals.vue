<template>
  <!-- Task Edit Modal -->
  <TaskEditModal
    :is-open="isEditModalOpen"
    :task="selectedTask"
    @close="$emit('close-edit-modal')"
  />

  <!-- Quick Task Create Modal -->
  <QuickTaskCreateModal
    :is-open="isQuickTaskCreateOpen"
    :loading="false"
    @cancel="$emit('close-quick-task-create')"
    @create="(title, description) => $emit('handle-quick-task-create', title, description)"
  />

  <!-- Batch Edit Modal -->
  <BatchEditModal
    :is-open="isBatchEditModalOpen"
    :task-ids="batchEditTaskIds"
    @close="$emit('close-batch-edit-modal')"
    @applied="$emit('handle-batch-edit-applied')"
  />

  <!-- Section Settings Modal -->
  <GroupSettingsMenu
    :section="editingSection"
    :is-visible="isSectionSettingsOpen"
    @close="$emit('close-section-settings-modal')"
    @save="(settings) => $emit('handle-section-settings-save', settings)"
  />

  <!-- Unified Group Modal (create + edit with optional smart settings) -->
  <UnifiedGroupModal
    :is-open="isGroupModalOpen"
    :group="selectedGroup"
    :position="groupModalPosition"
    @close="$emit('close-group-modal')"
    @created="(group) => $emit('handle-group-created', group)"
    @updated="(group) => $emit('handle-group-updated', group)"
  />

  <!-- Group Edit Modal -->
  <GroupEditModal
    :section="selectedSectionForEdit"
    :is-visible="isGroupEditModalOpen"
    @close="$emit('close-group-edit-modal')"
    @save="(updatedSection) => $emit('handle-group-edit-save', updatedSection)"
  />

  <!-- Group Delete Confirmation Modal -->
  <ConfirmationModal
    :is-open="isDeleteGroupModalOpen"
    title="Delete Group"
    :message="deleteGroupMessage"
    confirm-text="Delete"
    @confirm="$emit('confirm-delete-group')"
    @cancel="$emit('cancel-delete-group')"
  />

  <!-- Bulk Delete Confirmation Modal (Shift+Delete on multiple items) -->
  <ConfirmationModal
    :is-open="isBulkDeleteModalOpen"
    :title="bulkDeleteTitle"
    :message="bulkDeleteMessage"
    :details="bulkDeleteItems.map(item => `${item.type === 'section' ? '📁' : '📌'} ${item.name}`)"
    :confirm-text="bulkDeleteIsPermanent ? 'Delete Permanently' : 'Remove'"
    @confirm="$emit('confirm-bulk-delete')"
    @cancel="$emit('cancel-bulk-delete')"
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
  (e: 'close-edit-modal'): void
  (e: 'close-quick-task-create'): void
  (e: 'handle-quick-task-create', title: string, description: string): void
  (e: 'close-batch-edit-modal'): void
  (e: 'handle-batch-edit-applied'): void
  (e: 'close-section-settings-modal'): void
  (e: 'handle-section-settings-save', settings: { assignOnDrop: AssignOnDropSettings }): void
  (e: 'close-group-modal'): void
  (e: 'handle-group-created', group: CanvasSection): void
  (e: 'handle-group-updated', group: CanvasSection): void
  (e: 'close-group-edit-modal'): void
  (e: 'handle-group-edit-save', updatedSection: any): void
  (e: 'confirm-delete-group'): void
  (e: 'cancel-delete-group'): void
  (e: 'confirm-bulk-delete'): void
  (e: 'cancel-bulk-delete'): void
}>()
</script>
