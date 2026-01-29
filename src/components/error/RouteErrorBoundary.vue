<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const showError = ref(false)
const errorMessage = ref('')
const failedRoute = ref('')
const isRetrying = ref(false)
const retryCount = ref(0)
const maxRetries = 3

function handleRouteError(event: CustomEvent) {
  const { error, route } = event.detail
  errorMessage.value = error.message
  failedRoute.value = route
  showError.value = true
  retryCount.value = 0
}

async function retry() {
  if (retryCount.value >= maxRetries) {
    // Force full reload after max retries
    window.location.reload()
    return
  }

  isRetrying.value = true
  retryCount.value++

  // Exponential backoff: 1s, 2s, 4s
  const delay = Math.pow(2, retryCount.value - 1) * 1000
  await new Promise(resolve => setTimeout(resolve, delay))

  try {
    // Clear the error and try navigation again
    showError.value = false
    isRetrying.value = false

    const route = sessionStorage.getItem('failedRoute') || '/'
    sessionStorage.removeItem('failedRoute')
    sessionStorage.removeItem('importError')

    // Use location.href to force fresh module load
    window.location.href = window.location.origin + window.location.pathname + '#' + route
  } catch {
    isRetrying.value = false
    showError.value = true
  }
}

function forceReload() {
  sessionStorage.removeItem('failedRoute')
  sessionStorage.removeItem('importError')
  window.location.reload()
}

onMounted(() => {
  window.addEventListener('route-load-error', handleRouteError as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('route-load-error', handleRouteError as EventListener)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showError" class="route-error-overlay">
        <div class="route-error-card">
          <div class="error-icon">⚠️</div>
          <h2>Connection Lost</h2>
          <p class="error-message">
            Unable to load the page. This usually happens when the development server restarts or loses connection.
          </p>
          <p class="error-details">{{ errorMessage }}</p>

          <div class="error-actions">
            <button
              class="retry-button"
              :disabled="isRetrying"
              @click="retry"
            >
              <span v-if="isRetrying">Retrying... ({{ retryCount }}/{{ maxRetries }})</span>
              <span v-else>Try Again</span>
            </button>
            <button
              class="reload-button"
              @click="forceReload"
            >
              Full Reload
            </button>
          </div>

          <p v-if="retryCount >= maxRetries" class="max-retries-message">
            Multiple retries failed. Click "Full Reload" to refresh the page.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.route-error-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.route-error-card {
  background: var(--overlay-component-bg, #1a1a1c);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xl, 16px);
  padding: var(--space-8, 32px);
  max-width: 420px;
  text-align: center;
  color: var(--text-primary, #ffffff);
}

.error-icon {
  font-size: 48px;
  margin-bottom: var(--space-4, 16px);
}

h2 {
  margin: 0 0 var(--space-3, 12px) 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.error-message {
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  margin: 0 0 var(--space-4, 16px) 0;
  line-height: 1.5;
}

.error-details {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.5));
  background: rgba(0, 0, 0, 0.3);
  padding: var(--space-2, 8px);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--space-6, 24px);
  word-break: break-word;
}

.error-actions {
  display: flex;
  gap: var(--space-3, 12px);
  justify-content: center;
}

.retry-button,
.reload-button {
  padding: var(--space-3, 12px) var(--space-6, 24px);
  border-radius: var(--radius-md, 8px);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.retry-button {
  background: var(--accent-primary, #3b82f6);
  color: white;
}

.retry-button:hover:not(:disabled) {
  background: var(--accent-primary-hover, #2563eb);
}

.retry-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reload-button {
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.2));
}

.reload-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.max-retries-message {
  color: var(--status-error, #ef4444);
  font-size: 0.875rem;
  margin-top: var(--space-4, 16px);
  margin-bottom: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
