<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-content--welcome">
              <span class="logo">🍅</span>
              <div>
                <h2 class="modal-title">
                  Welcome to Pomo-Flow
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
              <span>{{ authStore.isNewSession ? 'Profile created' : `Day ${userStats?.daysSinceCreation || 1}` }}</span>
            </div>

            <!-- Optional Name Input -->
            <div class="name-section">
              <label class="input-label">Display Name (optional)</label>
              <div class="input-row">
                <input
                  v-model="displayName"
                  type="text"
                  placeholder="Enter your name"
                  class="name-input"
                  maxlength="30"
                >
                <button
                  :disabled="!displayName || displayName === currentDisplayName"
                  class="save-btn"
                  @click="saveDisplayName"
                >
                  Save
                </button>
              </div>
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
              <button class="secondary-btn" @click="exportData">
                <Download :size="16" />
                Export
              </button>
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
import { ref, computed, onMounted } from 'vue'
import { useLocalAuthStore } from '@/stores/local-auth'
import {
  X,
  CheckCircle,
  LayoutGrid,
  Timer,
  Shield,
  Download,
  Settings
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  showSettings: []
}>()

const authStore = useLocalAuthStore()
const displayName = ref('')

const userStats = computed(() => authStore.getUserStats())
const currentDisplayName = computed(() => authStore.localUser?.displayName || '')

onMounted(() => {
  displayName.value = currentDisplayName.value
})

const closeModal = () => {
  emit('close')
}

const saveDisplayName = () => {
  if (displayName.value && displayName.value !== currentDisplayName.value) {
    authStore.updateDisplayName(displayName.value.trim())
  }
}

const exportData = () => {
  try {
    const data = authStore.exportUserData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export data:', error)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.modal-container {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-xl, 16px);
  width: 100%;
  max-width: 420px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.header-content--welcome {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

/* Body */
.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Status Banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: 1px solid var(--color-work, #3b82f6);
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  color: var(--color-work, #3b82f6);
}

.status-icon {
  flex-shrink: 0;
}

/* Name Section */
.name-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.input-row {
  display: flex;
  gap: 0.5rem;
}

.name-input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary, #fff);
  font-size: 0.875rem;
}

.name-input::placeholder {
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
}

.name-input:focus {
  outline: none;
  border-color: var(--color-work, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.save-btn {
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid var(--color-work, #3b82f6);
  border-radius: var(--radius-md, 8px);
  color: var(--color-work, #3b82f6);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.save-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
}

.save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Features */
.features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.feature-icon {
  color: var(--color-work, #3b82f6);
  flex-shrink: 0;
}

/* Footer */
.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.primary-btn {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid var(--color-work, #3b82f6);
  border-radius: var(--radius-md, 8px);
  color: var(--color-work, #3b82f6);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.primary-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--color-work-hover, #2563eb);
}

.secondary-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.secondary-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: transparent;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md, 8px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.secondary-btn:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.05));
  border-color: var(--glass-border-hover, rgba(255, 255, 255, 0.15));
  color: var(--text-primary, #fff);
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.2s ease;
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
