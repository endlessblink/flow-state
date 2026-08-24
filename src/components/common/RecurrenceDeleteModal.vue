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
      <!-- Remove from canvas only -->
      <button
        v-if="showRemoveFromCanvas"
        class="action-btn action-btn--canvas"
        @click="$emit('removeFromCanvas')"
      >
        <LayoutDashboard :size="20" class="action-icon action-icon--canvas" />
        <div class="action-text">
          <span class="action-label">Remove from canvas</span>
          <span class="action-hint">Keep the task, just take it off the canvas</span>
        </div>
      </button>

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
import { Repeat, SkipForward, Ban, LayoutDashboard } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import type { SimpleRecurrenceRule } from '@/types/tasks'
import { describeRecurrenceRule } from '@/utils/recurrenceUtils'

interface Props {
  isOpen: boolean
  taskTitle: string
  recurrenceRule: SimpleRecurrenceRule | null
  showRemoveFromCanvas?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  skip: []
  stop: []
  cancel: []
  removeFromCanvas: []
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
    0 8px 16px rgba(45, 212, 191, 0.1),
    0 0 20px rgba(45, 212, 191, 0.05);
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
  align-items: flex-start;
  gap: var(--space-3);
  width: 100%;
  min-height: max(4.25rem, 4.75em);
  box-sizing: border-box;
  padding: var(--space-4) var(--space-4);
  font: inherit;
  line-height: normal;
  overflow: visible;
  /* Glass surface — slightly brighter than the modal body so the buttons read as primary actions. */
  background: rgba(45, 40, 70, 0.55);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: start;
}

.action-btn--skip {
  /* Full-saturation border + subtle tinted fill so the brand colour reads at a glance. */
  background: linear-gradient(180deg, rgba(45, 212, 191, 0.12) 0%, rgba(45, 212, 191, 0.06) 100%);
  border: 1px solid var(--brand-primary);
  box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.18) inset;
}

.action-btn--skip:hover {
  background: linear-gradient(180deg, rgba(45, 212, 191, 0.22) 0%, rgba(45, 212, 191, 0.12) 100%);
  border-color: var(--brand-primary);
  box-shadow: 0 4px 16px rgba(45, 212, 191, 0.18), 0 0 0 1px rgba(45, 212, 191, 0.28) inset;
}

.action-btn--stop {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.06) 100%);
  border: 1px solid var(--color-danger);
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.18) inset;
}

.action-btn--stop:hover {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.12) 100%);
  border-color: var(--color-danger);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.18), 0 0 0 1px rgba(239, 68, 68, 0.28) inset;
}

.action-btn--canvas {
  border: 1px solid rgba(168, 162, 200, 0.8);
}

.action-btn--canvas:hover {
  background: rgba(168, 162, 200, 0.12);
  border-color: rgba(168, 162, 200, 1);
}

.action-icon--canvas {
  color: rgba(168, 162, 200, 1);
}

.action-btn--canvas .action-label {
  color: rgba(168, 162, 200, 1);
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
  flex: 1 1 auto;
  min-width: 0;
}

.action-label {
  display: block;
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
  display: block;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.4;
  white-space: normal;
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
