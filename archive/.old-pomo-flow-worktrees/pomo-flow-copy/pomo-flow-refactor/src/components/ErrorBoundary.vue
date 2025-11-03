<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-message">{{ errorMessage }}</p>

      <div class="error-actions">
        <button @click="handleReload" class="error-btn primary">
          Reload Page
        </button>
        <button @click="handleReset" class="error-btn secondary">
          Reset & Continue
        </button>
        <button @click="copyErrorMessage" class="error-btn copy">
          <Copy :size="14" />
          Copy Error
        </button>
      </div>

      <details v-if="errorDetails" class="error-details">
        <summary>Technical Details</summary>
        <div class="error-details-header">
          <button @click="copyErrorDetails" class="copy-details-btn">
            <Copy :size="12" />
            Copy Details
          </button>
        </div>
        <pre class="error-stack">{{ errorDetails }}</pre>
      </details>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Copy } from 'lucide-vue-next'
import { useCopy } from '@/composables/useCopy'

const props = defineProps<{
  fallbackMessage?: string
}>()

const emit = defineEmits<{
  error: [error: Error, info: any]
}>()

const router = useRouter()
const { copyError } = useCopy()
const hasError = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')

onErrorCaptured((error: Error, instance, info) => {
  console.error('ErrorBoundary caught error:', error, info)

  hasError.value = true
  errorMessage.value = props.fallbackMessage || error.message || 'An unexpected error occurred'
  errorDetails.value = error.stack || ''

  emit('error', error, info)

  // Prevent error from propagating
  return false
})

// Watch for route changes to reset error state
watch(() => router.currentRoute.value.path, () => {
  if (hasError.value) {
    handleReset()
  }
})

const handleReload = () => {
  window.location.reload()
}

const handleReset = () => {
  hasError.value = false
  errorMessage.value = ''
  errorDetails.value = ''
}

const copyErrorMessage = () => {
  copyError(errorMessage.value)
}

const copyErrorDetails = () => {
  copyError(errorMessage.value, errorDetails.value)
}
</script>

<style scoped>
.error-boundary {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-primary);
  padding: var(--space-8);
}

.error-container {
  max-width: 600px;
  width: 100%;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: var(--shadow-2xl);
  text-align: center;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: var(--space-6);
  animation: errorPulse 2s ease-in-out infinite;
}

@keyframes errorPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.error-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-4) 0;
}

.error-message {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-6) 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  margin-bottom: var(--space-6);
}

.error-btn {
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border: 1px solid transparent;
}

.error-btn.primary {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow);
}

.error-btn.primary:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.error-btn.secondary {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

.error-btn.secondary:hover {
  background: var(--glass-bg-tint);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.error-btn.copy {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.error-btn.copy:hover {
  background: var(--glass-bg-tint);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.error-details {
  margin-top: var(--space-6);
  text-align: left;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.error-details summary {
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  user-select: none;
}

.error-details summary:hover {
  color: var(--text-primary);
}

.error-details-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.copy-details-btn {
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.copy-details-btn:hover {
  background: var(--glass-bg-tint);
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.error-stack {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow-x: auto;
  max-height: 300px;
}
</style>
