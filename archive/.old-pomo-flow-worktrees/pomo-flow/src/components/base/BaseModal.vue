<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    :class="{ 'modal-closing': isClosing }"
    @click="handleOverlayClick"
    @keydown.esc="handleEscapeKey"
    role="dialog"
    :aria-modal="isOpen"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    ref="overlayRef"
  >
    <div
      class="modal-container"
      :class="[`size-${size}`, `variant-${variant}`, { 'modal-closing': isClosing }]"
      @click.stop
      ref="modalRef"
    >
      <!-- Modal Header -->
      <header v-if="showHeader" class="modal-header">
        <div class="header-content">
          <h2
            :id="titleId"
            class="modal-title"
            :class="titleClass"
          >
            <slot name="title">{{ title }}</slot>
          </h2>

          <p
            v-if="description || $slots.description"
            :id="descriptionId"
            class="modal-description"
            :class="descriptionClass"
          >
            <slot name="description">{{ description }}</slot>
          </p>
        </div>

        <!-- Close Button -->
        <button
          v-if="showCloseButton"
          class="modal-close-btn"
          @click="handleClose"
          :aria-label="closeAriaLabel"
          type="button"
          ref="closeBtnRef"
        >
          <X :size="16" />
        </button>
      </header>

      <!-- Modal Body -->
      <main class="modal-body" :class="bodyClass">
        <slot />
      </main>

      <!-- Modal Footer -->
      <footer v-if="showFooter || $slots.footer" class="modal-footer" :class="footerClass">
        <slot name="footer">
          <!-- Default footer actions -->
          <div class="default-actions">
            <BaseButton
              v-if="showCancelButton"
              variant="secondary"
              @click="handleCancel"
              :disabled="loading"
            >
              {{ cancelText }}
            </BaseButton>

            <BaseButton
              v-if="showConfirmButton"
              variant="primary"
              @click="handleConfirm"
              :loading="loading"
              :disabled="confirmDisabled"
            >
              {{ confirmText }}
            </BaseButton>
          </div>
        </slot>
      </footer>

      <!-- Focus Trap Indicator -->
      <div ref="focusTrapRef" class="focus-trap" tabindex="0" aria-hidden="true"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { X } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

interface Props {
  isOpen: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  variant?: 'default' | 'danger' | 'warning' | 'success'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showHeader?: boolean
  showFooter?: boolean
  showCloseButton?: boolean
  showCancelButton?: boolean
  showConfirmButton?: boolean
  cancelText?: string
  confirmText?: string
  closeAriaLabel?: string
  loading?: boolean
  confirmDisabled?: boolean
  titleClass?: string
  descriptionClass?: string
  bodyClass?: string
  footerClass?: string
  trapFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
  closeOnOverlayClick: true,
  closeOnEscape: true,
  showHeader: true,
  showFooter: false,
  showCloseButton: true,
  showCancelButton: true,
  showConfirmButton: true,
  cancelText: 'Cancel',
  confirmText: 'Confirm',
  closeAriaLabel: 'Close modal',
  loading: false,
  confirmDisabled: false,
  trapFocus: true
})

const emit = defineEmits<{
  close: []
  cancel: []
  confirm: []
  open: []
  afterOpen: []
  afterClose: []
}>()

// Template refs
const overlayRef = ref<HTMLElement>()
const modalRef = ref<HTMLElement>()
const closeBtnRef = ref<HTMLButtonElement>()
const focusTrapRef = ref<HTMLElement>()

// State
const isClosing = ref(false)
const previousActiveElement = ref<HTMLElement | null>(null)

// Generate unique IDs for accessibility
const titleId = computed(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`)
const descriptionId = computed(() => `modal-description-${Math.random().toString(36).substr(2, 9)}`)

// Handle overlay click
const handleOverlayClick = () => {
  if (props.closeOnOverlayClick) {
    handleClose()
  }
}

// Handle escape key
const handleEscapeKey = (event: KeyboardEvent) => {
  if (props.closeOnEscape && event.key === 'Escape') {
    handleClose()
  }
}

// Handle close
const handleClose = () => {
  if (props.loading) return

  isClosing.value = true
  emit('close')

  setTimeout(() => {
    isClosing.value = false
    emit('afterClose')
    restoreFocus()
  }, 200) // Match animation duration
}

// Handle cancel
const handleCancel = () => {
  emit('cancel')
}

// Handle confirm
const handleConfirm = () => {
  if (props.loading || props.confirmDisabled) return
  emit('confirm')
}

// Focus management
const saveActiveElement = () => {
  previousActiveElement.value = document.activeElement as HTMLElement
}

const restoreFocus = () => {
  if (previousActiveElement.value && typeof previousActiveElement.value.focus === 'function') {
    previousActiveElement.value.focus()
  }
}

const setInitialFocus = () => {
  nextTick(() => {
    // Focus close button first, then look for form inputs
    if (closeBtnRef.value) {
      closeBtnRef.value.focus()
    } else {
      // Look for first focusable element in modal
      const focusableElement = modalRef.value?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement
      focusableElement?.focus()
    }
  })
}

// Focus trap implementation
const handleFocusTrap = (event: KeyboardEvent) => {
  if (!props.trapFocus || !modalRef.value) return

  if (event.key === 'Tab') {
    const focusableElements = modalRef.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }
}

// Watch for open state changes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    saveActiveElement()
    emit('open')

    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    nextTick(() => {
      setInitialFocus()
      emit('afterOpen')
    })
  } else {
    isClosing.value = false
    restoreFocus()

    // Restore body scroll
    document.body.style.overflow = ''
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.body.style.overflow = ''
  restoreFocus()
})

// Handle focus trap when modal is open
onMounted(() => {
  if (props.trapFocus && props.isOpen) {
    nextTick(() => {
      overlayRef.value?.addEventListener('keydown', handleFocusTrap)
    })
  }
})

onUnmounted(() => {
  overlayRef.value?.removeEventListener('keydown', handleFocusTrap)
})

// Public methods
const focus = () => {
  closeBtnRef.value?.focus()
}

const close = () => {
  handleClose()
}

defineExpose({
  focus,
  close,
  modalRef,
  overlayRef
})
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(12px) saturate(100%);
  -webkit-backdrop-filter: blur(12px) saturate(100%);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
  padding: var(--space-4);
  /* CRITICAL FIX: Allow navigation through modal overlay */
  pointer-events: none;
}

.modal-overlay.modal-closing {
  animation: fadeOut var(--duration-normal) var(--spring-smooth);
}

/* Modal Container */
.modal-container {
  background: rgba(20, 24, 32, 0.85);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px rgba(0, 0, 0, 0.5),
    0 16px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  animation: slideUp var(--duration-normal) var(--spring-bounce);
  position: relative;
  /* CRITICAL FIX: Re-enable pointer events for modal content */
  pointer-events: auto;
}

.modal-container.modal-closing {
  animation: slideDown var(--duration-normal) var(--spring-smooth);
}

/* Size Variants */
.modal-container.size-sm {
  width: 90%;
  max-width: 400px;
}

.modal-container.size-md {
  width: 90%;
  max-width: 600px;
}

.modal-container.size-lg {
  width: 90%;
  max-width: 800px;
}

.modal-container.size-xl {
  width: 90%;
  max-width: 1000px;
}

.modal-container.size-full {
  width: 95%;
  height: 95%;
  max-width: none;
  max-height: none;
}

/* Variant Styles */
.modal-container.variant-danger {
  border-color: var(--color-danger);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--color-danger),
    0 0 20px rgba(239, 68, 68, 0.2);
}

.modal-container.variant-warning {
  border-color: var(--color-warning);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--color-warning),
    0 0 20px rgba(245, 158, 11, 0.2);
}

.modal-container.variant-success {
  border-color: var(--color-work);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--color-work),
    0 0 20px rgba(34, 197, 94, 0.2);
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
  line-height: var(--leading-tight);
  word-wrap: break-word;
}

.modal-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: var(--leading-relaxed);
}

/* Close Button */
.modal-close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.modal-close-btn:focus-visible {
  outline: 2px solid var(--color-work);
  outline-offset: 2px;
}

/* Modal Body */
.modal-body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--glass-bg-weak) 100%
  );
}

.default-actions {
  display: flex;
  gap: var(--space-3);
}

/* Focus Trap */
.focus-trap {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slideDown {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-2);
  }

  .modal-container.size-sm,
  .modal-container.size-md,
  .modal-container.size-lg,
  .modal-container.size-xl {
    width: 100%;
    max-width: none;
  }

  .modal-header {
    padding: var(--space-4);
  }

  .modal-body {
    padding: var(--space-4);
  }

  .modal-footer {
    padding: var(--space-4);
    flex-direction: column;
    gap: var(--space-2);
  }

  .default-actions {
    flex-direction: column;
    width: 100%;
  }

  .default-actions .base-button {
    width: 100%;
  }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
  .modal-container {
    border-width: 2px;
  }

  .modal-close-btn {
    border-width: 2px;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-container {
    animation: none;
    transition: opacity 0.2s ease;
  }
}

/* Screen Reader Only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>