<template>
  <BaseModal
    :is-open="isOpen"
    :title="title"
    :description="message"
    size="sm"
    variant="danger"
    :show-footer="false"
    :close-on-overlay-click="true"
    :close-on-escape="true"
    @close="$emit('cancel')"
    @after-open="handleAfterOpen"
  >
    <!-- Icon -->
    <div class="icon-wrapper">
      <Trash2 :size="32" class="warning-icon" />
    </div>

    <!-- Details (if provided) -->
    <div v-if="details && details.length > 0" class="modal-details">
      <h4 class="details-title">Items to be deleted:</h4>
      <ul class="details-list">
        <li v-for="(detail, index) in details" :key="index" class="detail-item">
          {{ detail }}
        </li>
      </ul>
    </div>

    <!-- Actions -->
    <template #footer>
      <div class="modal-actions">
        <BaseButton
          variant="secondary"
          @click="$emit('cancel')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="danger"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue' // Fixed import for BaseButton component

interface Props {
  isOpen: boolean
  title?: string
  message?: string
  details?: string[]
  confirmText?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  confirmText: 'Confirm'
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

// Handle after open to focus the confirm button for better UX
const handleAfterOpen = () => {
  nextTick(() => {
    // Try to focus the confirm button for better keyboard navigation
    const confirmBtn = document.querySelector('.modal-actions button:last-child') as HTMLElement
    confirmBtn?.focus()
  })
}
</script>

<style scoped>
/* Confirmation Modal Specific Styles */

.icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-6);
}

.warning-icon {
  color: var(--color-danger);
  background: linear-gradient(
    135deg,
    var(--danger-bg-subtle) 0%,
    var(--danger-bg-light) 100%
  );
  backdrop-filter: blur(8px);
  padding: var(--space-4);
  border-radius: var(--radius-full);
  box-sizing: content-box;
  box-shadow:
    0 8px 16px var(--danger-bg-medium),
    0 0 20px var(--danger-bg-subtle);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow:
      0 8px 16px var(--danger-bg-medium),
      0 0 20px var(--danger-bg-subtle);
  }
  50% {
    transform: scale(1.05);
    box-shadow:
      0 12px 24px var(--danger-bg-strong),
      0 0 30px var(--danger-bg-medium);
  }
}

.modal-details {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  text-align: left;
}

.details-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3) 0;
}

.details-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-item {
  color: var(--text-muted);
  font-size: var(--text-sm);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--glass-border);
  position: relative;
  padding-left: var(--space-4);
}

.detail-item:before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--color-danger);
  font-weight: var(--font-bold);
}

.detail-item:last-child {
  border-bottom: none;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-actions {
    flex-direction: column;
    gap: var(--space-2);
  }

  .modal-actions :deep(.base-button) {
    width: 100%;
  }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
  .warning-icon {
    background: var(--color-danger);
    border: 2px solid var(--color-danger);
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .warning-icon {
    animation: none;
  }
}
</style>