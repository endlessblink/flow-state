<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="modal-overlay"
        @click.self="closeModal"
        @keydown="handleKeydown"
      >
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-content--welcome">
              <span class="logo">🍅</span>
              <div>
                <h2 class="modal-title">
                  Welcome to FlowState
                </h2>
                <p class="modal-subtitle">
                  Your productivity companion
                </p>
              </div>
            </div>
            <button class="close-btn" aria-label="Close" @click="closeModal">
              <X :size="20" />
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Status Banner -->
            <div class="status-banner">
              <CheckCircle :size="20" class="status-icon" />
              <span>Welcome!</span>
            </div>

            <!-- Features (Simplified) -->
            <div class="features">
              <div class="feature">
                <LayoutGrid :size="18" class="feature-icon" />
                <span>Multiple views: Board, Calendar, Canvas</span>
              </div>
              <div class="feature">
                <Timer :size="18" class="feature-icon" />
                <span>Built-in Pomodoro timer</span>
              </div>
              <div class="feature">
                <Shield :size="18" class="feature-icon" />
                <span>100% private, works offline</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="primary-btn" @click="closeModal">
              Get Started
            </button>
            <div class="secondary-actions">
              <button class="secondary-btn" @click="emit('showSettings')">
                <Settings :size="16" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  X,
  CheckCircle,
  LayoutGrid,
  Timer,
  Shield,
  Settings
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
  showSettings: []
}>()

const closeModal = () => {
  emit('close')
}

// Keyboard handler - Enter closes modal, Escape also closes
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault()
    closeModal()
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 1000;
}

.modal-container {
  /* Standardized overlay styling */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-xl, 16px);
  width: 100%;
  max-width: 420px;
  box-shadow: var(--overlay-component-shadow);
  overflow: hidden;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.header-content--welcome {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo {
  font-size: 2rem;
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.modal-subtitle {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.close-btn:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

/* Body */
.modal-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Status Banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.625rem var(--text-sm);
  background: transparent;
  border: 1px solid var(--color-work, #3b82f6);
  border-radius: var(--radius-md, 8px);
  font-size: var(--text-sm);
  color: var(--color-work, #3b82f6);
}

.status-icon {
  flex-shrink: 0;
}

/* Features */
.features {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.feature {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.feature-icon {
  color: var(--color-work, #3b82f6);
  flex-shrink: 0;
}

/* Footer */
.modal-footer {
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.primary-btn {
  width: 100%;
  padding: var(--space-3);
  background: transparent;
  border: 1px solid var(--color-work, #3b82f6);
  border-radius: var(--radius-md, 8px);
  color: var(--color-work, #3b82f6);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.primary-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--color-work-hover, #2563eb);
}

.secondary-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

.secondary-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: var(--space-2) var(--text-sm);
  background: transparent;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md, 8px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.secondary-btn:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.05));
  border-color: var(--glass-border-hover, rgba(255, 255, 255, 0.15));
  color: var(--text-primary, #fff);
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform var(--duration-normal) var(--ease-out);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
