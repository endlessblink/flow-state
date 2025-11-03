<template>
  <div v-if="isOpen" class="confirmation-overlay" @click="$emit('cancel')">
    <div class="confirmation-modal" @click.stop>
      <div class="modal-content">
        <!-- Icon -->
        <div class="icon-wrapper">
          <Trash2 :size="24" class="warning-icon" />
        </div>

        <!-- Title -->
        <h3 class="modal-title">{{ title }}</h3>

        <!-- Message -->
        <p class="modal-message">{{ message }}</p>

        <!-- Actions -->
        <div class="modal-actions">
          <button class="cancel-btn" @click="$emit('cancel')">
            Cancel
          </button>
          <button class="confirm-btn" @click="$emit('confirm')">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  title?: string
  message?: string
  confirmText?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  confirmText: 'Confirm'
})

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
.confirmation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(12px) saturate(150%);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

.confirmation-modal {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
  animation: scaleIn var(--duration-normal) var(--spring-bounce);
}

.modal-content {
  padding: var(--space-8);
  text-align: center;
  min-width: 360px;
}

.icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-5);
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
}

.modal-title {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-4) 0;
  text-shadow: 0 2px 4px var(--shadow-subtle);
}

.modal-message {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--space-6) 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.cancel-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.cancel-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px var(--shadow-lg);
}

.confirm-btn {
  background: linear-gradient(
    135deg,
    var(--danger-gradient-start) 0%,
    var(--danger-gradient-end) 100%
  );
  border: 1px solid var(--danger-border-medium);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow:
    0 8px 16px var(--danger-border-medium),
    0 0 20px var(--danger-bg-medium);
}

.confirm-btn:hover {
  background: linear-gradient(
    135deg,
    var(--danger-gradient-hover-start) 0%,
    var(--danger-gradient-hover-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    0 12px 24px var(--danger-shadow-strong),
    0 0 30px var(--danger-border-medium);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>