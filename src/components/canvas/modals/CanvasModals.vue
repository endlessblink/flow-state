<template>
  <!-- Keyboard Test Modal -->
  <div v-if="showKeyboardTest" class="keyboard-test-overlay">
    <div class="keyboard-test-content">
      <h3>Keyboard Test</h3>
      <p v-if="testStatus">{{ testStatus }}</p>

      <div v-if="testResults.length > 0" class="test-results">
        <div
          v-for="(result, index) in testResults"
          :key="index"
          :class="['test-result', result.status]"
        >
          {{ result.message }}
        </div>
      </div>

      <div class="keyboard-test-actions">
        <button
          v-if="!isTestRunning"
          @click="startKeyboardTest"
          class="btn btn-primary"
        >
          Start Test
        </button>
        <button
          @click="closeKeyboardTest"
          class="btn btn-secondary"
        >
          Close
        </button>
      </div>

      <button @click="closeKeyboardTest" class="close-btn">✕</button>
    </div>
  </div>

  <!-- Task Edit Modal -->
  <TaskEditModal
    :is-open="isEditModalOpen"
    :task="selectedTask"
    @close="closeEditModal"
  />

  <!-- Batch Edit Modal -->
  <BatchEditModal
    :is-open="isBatchEditModalOpen"
    :task-ids="batchEditTaskIds"
    @close="closeBatchEditModal"
    @applied="handleBatchEditApplied"
  />

  <!-- Group Modal -->
  <GroupModal
    :is-open="isGroupModalOpen"
    :position="groupModalPosition"
    :group="selectedGroup"
    @close="closeGroupModal"
  />

  <!-- Section Wizard Modal -->
  <SectionWizard
    :is-open="isSectionWizardOpen"
    :position="sectionWizardPosition"
    @close="closeSectionWizard"
  />

  <!-- Group Edit Modal -->
  <GroupEditModal
    :is-visible="isGroupEditModalOpen"
    :section="selectedSectionForEdit"
    @close="closeGroupEditModal"
  />
</template>

<script setup lang="ts">
import { useCanvasModals } from '@/composables/canvas/useCanvasModals'

// Use the canvas modals composable
const {
  // State
  isEditModalOpen,
  selectedTask,
  showKeyboardTest,
  isTestRunning,
  testStatus,
  testResults,
  isBatchEditModalOpen,
  batchEditTaskIds,
  isGroupModalOpen,
  groupModalPosition,
  selectedGroup,
  isSectionWizardOpen,
  sectionWizardPosition,
  isGroupEditModalOpen,
  selectedSectionForEdit,

  // Methods
  openEditModal,
  closeEditModal,
  openKeyboardTest,
  closeKeyboardTest,
  startKeyboardTest,
  addTestResult,
  completeKeyboardTest,
  openBatchEditModal,
  closeBatchEditModal,
  handleBatchEditApplied,
  openGroupModal,
  closeGroupModal,
  openSectionWizard,
  closeSectionWizard,
  openGroupEditModal,
  closeGroupEditModal
} = useCanvasModals()

// Expose methods to parent component if needed
defineExpose({
  openEditModal,
  closeEditModal,
  openKeyboardTest,
  closeKeyboardTest,
  startKeyboardTest,
  openBatchEditModal,
  closeBatchEditModal,
  openGroupModal,
  closeGroupModal,
  openSectionWizard,
  closeSectionWizard,
  openGroupEditModal,
  closeGroupEditModal
})
</script>

<style scoped>
.keyboard-test-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.keyboard-test-content {
  background: var(--surface-0);
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--surface-3);
  position: relative;
}

.keyboard-test-content h3 {
  margin: 0 0 1rem 0;
  color: var(--text-1);
  font-size: 1.5rem;
  font-weight: 600;
}

.keyboard-test-content p {
  margin: 0 0 1.5rem 0;
  color: var(--text-2);
}

.test-results {
  margin-bottom: 1.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.test-result {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
}

.test-result.passed {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.test-result.failed {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.test-result.running {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.keyboard-test-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--surface-2);
  border: none;
  color: var(--text-1);
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--surface-3);
  transform: scale(1.1);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--primary-6);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-7);
}

.btn-secondary {
  background: var(--surface-2);
  color: var(--text-1);
  border: 1px solid var(--surface-3);
}

.btn-secondary:hover {
  background: var(--surface-3);
}
</style>