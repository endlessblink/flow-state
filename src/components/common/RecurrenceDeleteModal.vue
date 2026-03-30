<template>
  <BaseModal
    :is-open="isOpen"
    title="Delete Recurring Task"
    size="sm"
    close-on-overlay-click
    close-on-escape
    class="recurrence-delete-modal"
    @close="$emit('cancel')"
  >
    <!-- Icon -->
    <div class="icon-wrapper">
      <Repeat :size="32" class="recurrence-icon" />
    </div>

    <!-- Task title -->
    <p class="task-title-label">{{ taskTitle }}</p>

    <!-- Recurrence description -->
    <p class="recurrence-description">{{ ruleDescription }}</p>

    <!-- Action buttons -->
    <div class="action-list">
      <!-- Skip this occurrence -->
      <button
        class="action-btn action-btn--skip"
        @click="$emit('skip')"
      >
        <SkipForward :size="20" class="action-icon action-icon--skip" />
        <div class="action-text">
          <span class="action-label">Skip this occurrence</span>
          <span class="action-hint">Advance to the next scheduled date</span>
        </div>
      </button>

      <!-- Stop all future occurrences -->
      <button
        class="action-btn action-btn--stop"
        @click="$emit('stop')"
      >
        <Ban :size="20" class="action-icon action-icon--stop" />
        <div class="action-text">
          <span class="action-label">Stop all future occurrences</span>
          <span class="action-hint">Remove recurrence from the entire chain</span>
        </div>
      </button>
    </div>

    <!-- Footer with cancel -->
    <template #footer>
      <div class="modal-actions">
        <BaseButton
          variant="ghost"
          @click="$emit('cancel')"
        >
          Cancel
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Repeat, SkipForward, Ban } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import type { SimpleRecurrenceRule } from '@/types/tasks'
import { describeRecurrenceRule } from '@/utils/recurrenceUtils'

interface Props {
  isOpen: boolean
  taskTitle: string
  recurrenceRule: SimpleRecurrenceRule | null
}

const props = defineProps<Props>()

defineEmits<{
  skip: []
  stop: []
  cancel: []
}>()

const ruleDescription = computed(() => {
  if (!props.recurrenceRule) return ''
  return describeRecurrenceRule(props.recurrenceRule)
})
</script>

<style scoped>
.icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.recurrence-icon {
  color: var(--brand-primary);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  padding: var(--space-4);
  border-radius: var(--radius-full);
  box-sizing: content-box;
  border: 1px solid var(--brand-primary);
  box-shadow:
    0 8px 16px rgba(78, 205, 196, 0.1),
    0 0 20px rgba(78, 205, 196, 0.05);
}

.task-title-label {
  text-align: center;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recurrence-description {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0 0 var(--space-6) 0;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-4) var(--space-4);
  background: rgba(45, 40, 70, 0.75);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: start;
}

.action-btn--skip {
  border: 1px solid rgba(78, 205, 196, 0.8);
}

.action-btn--skip:hover {
  background: rgba(78, 205, 196, 0.12);
  border-color: var(--brand-primary);
}

.action-btn--stop {
  border: 1px solid rgba(239, 68, 68, 0.8);
}

.action-btn--stop:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: var(--color-danger);
}

.action-icon {
  flex-shrink: 0;
}

.action-icon--skip {
  color: var(--brand-primary);
}

.action-icon--stop {
  color: var(--color-danger);
}

.action-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.action-label {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: 1.3;
  opacity: 1;
}

.action-btn--skip .action-label {
  color: var(--brand-primary);
}

.action-btn--stop .action-label {
  color: var(--color-danger);
}

.action-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: center;
}

/* Ensure this modal renders above other modals */
:deep(.modal-overlay) {
  z-index: var(--z-toast);
}

/* Responsive */
@media (max-width: 768px) {
  .action-btn {
    padding: var(--space-4);
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .action-btn {
    transition: none;
  }
}
</style>
