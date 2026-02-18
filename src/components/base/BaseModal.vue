<template>
  <div
    v-if="isOpen"
    ref="overlayRef"
    class="modal-overlay"
    :class="{ 'modal-closing': isClosing }"
    role="dialog"
    :aria-modal="isOpen"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    @mousedown.self="handleOverlayClick"
    @keydown="handleEscapeKey"
  >
    <div
      ref="modalRef"
      class="modal-container"
      :class="[`size-${size}`, `variant-${variant}`, { 'modal-closing': isClosing }]"
      @click.stop
    >
      <!-- Modal Header -->
      <header v-if="showHeader" class="modal-header">
        <div class="header-content--modal">
          <h2
            :id="titleId"
            class="modal-title"
            :class="titleClass"
          >
            <slot name="title">
              {{ title }}
            </slot>
          </h2>

          <p
            v-if="description || $slots.description"
            :id="descriptionId"
            class="modal-description"
            :class="descriptionClass"
          >
            <slot name="description">
              {{ description }}
            </slot>
          </p>
        </div>

        <!-- Close Button -->
        <button
          v-if="showCloseButton"
          ref="closeBtnRef"
          class="modal-close-btn"
          :aria-label="finalCloseAriaLabel"
          type="button"
          @click="handleClose"
        >
          <X :size="16" />
        </button>
      </header>

      <!-- Modal Body -->
      <main class="modal-body scroll-container" :class="bodyClass">
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
              :disabled="loading"
              @click="handleCancel"
            >
              {{ finalCancelText }}
            </BaseButton>

            <BaseButton
              v-if="showConfirmButton"
              variant="primary"
              :loading="loading"
              :disabled="confirmDisabled"
              @click="handleConfirm"
            >
              {{ finalConfirmText }}
            </BaseButton>
          </div>
        </slot>
      </footer>

      <!-- Focus Trap Indicator -->
      <div
        ref="focusTrapRef"
        class="focus-trap"
        tabindex="0"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseButton from './BaseButton.vue'
import { isTextAreaOrContentEditable } from '@/utils/dom'

interface Props {
  isOpen: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  variant?: 'default' | 'danger' | 'warning' | 'success'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  submitOnEnter?: boolean
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
  title: undefined,
  description: undefined,
  size: 'md',
  variant: 'default',
  closeOnOverlayClick: true,
  closeOnEscape: true,
  submitOnEnter: true,
  showHeader: true,
  showFooter: false,
  showCloseButton: true,
  showCancelButton: true,
  showConfirmButton: true,
  cancelText: undefined,
  confirmText: undefined,
  closeAriaLabel: undefined,
  loading: false,
  confirmDisabled: false,
  titleClass: undefined,
  descriptionClass: undefined,
  bodyClass: undefined,
  footerClass: undefined,
  trapFocus: true
})

const { t } = useI18n()

// I18n defaults (if props not provided)
const finalCancelText = computed(() => props.cancelText || t('common.cancel'))
const finalConfirmText = computed(() => props.confirmText || t('common.confirm'))
const finalCloseAriaLabel = computed(() => props.closeAriaLabel || t('common.close'))

const emit = defineEmits<{
  close: []
  cancel: []
  confirm: []
  open: []
  afterOpen: []
  afterClose: []
}>()

// RTL support
// Logical properties handle direction automatically, so manual isRTL check removed
// const { isRTL } = useDirection()

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


// Handle keyboard events (Escape and Enter)
const handleEscapeKey = (event: KeyboardEvent) => {
  // Handle Escape key - close modal
  if (props.closeOnEscape && event.key === 'Escape') {
    handleClose()
    return
  }

  // Handle Enter key - submit modal (if enabled)
  if (props.submitOnEnter && event.key === 'Enter') {
    // Don't submit if in textarea or contenteditable
    if (isTextAreaOrContentEditable(event.target)) return

    // Don't submit if Shift+Enter (common for newlines)
    if (event.shiftKey) return

    // Don't submit if loading or disabled
    if (props.loading || props.confirmDisabled) return

    event.preventDefault()
    handleConfirm()
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
  background: var(--glass-bg-solid);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: var(--blur-xl);
  -webkit-backdrop-filter: var(--blur-xl);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
  padding: var(--space-4);
}

.modal-overlay.modal-closing {
  animation: fadeOut var(--duration-normal) var(--spring-smooth);
}

/* Modal Container */
.modal-container {
  /* Standardized overlay styling */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--overlay-component-shadow);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  animation: slideUp var(--duration-normal) var(--spring-bounce);
  position: relative;
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
    var(--shadow-2xl),
    var(--shadow-strong),
    inset 0 2px 0 var(--color-danger),
    0 0 20px var(--danger-bg-subtle);
}

.modal-container.variant-warning {
  border-color: var(--color-warning);
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-strong),
    inset 0 2px 0 var(--color-warning),
    0 0 20px var(--warning-bg-subtle);
}

.modal-container.variant-success {
  border-color: var(--color-work);
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-strong),
    inset 0 2px 0 var(--color-work),
    0 0 20px var(--success-bg-subtle);
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.header-content--modal {
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
  background: transparent;
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
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
  transform: scale(1.05);
}

.modal-close-btn:focus-visible {
  outline: none;
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 0 3px var(--brand-primary-bg-subtle), 0 0 8px var(--brand-primary-bg-tint);
}

/* Modal Body - uses .scroll-container utility for flex:1, overflow-y:auto, min-height:0 */
.modal-body {
  padding: var(--space-6);
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-6);
  border-top: 1px solid var(--border-subtle);
  background: transparent;
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
    transition: opacity var(--duration-normal) var(--ease-out);
  }
}

/* RTL Styles - REMOVED manual RTL classes in favor of Logical Properties (browser handles flip automatically) */
/* The "dir=rtl" on HTML tag makes flex containers flip automatically */

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