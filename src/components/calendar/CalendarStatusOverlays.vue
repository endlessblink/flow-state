<template>
  <div>
    <!-- System Health Alert for Graceful Degradation -->
    <div
      v-if="!systemHealthy"
      class="system-health-alert"
      :class="{ 'degraded-mode': !systemHealthy }"
    >
      <div class="health-alert-content">
        <span class="health-icon">⚠️</span>
        <span class="health-message">{{ systemHealthMessage }}</span>
        <button
          class="health-retry-btn"
          title="Retry store initialization"
          @click="$emit('validateStores')"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Operation Loading and Error Feedback -->
    <div
      v-if="operationError"
      class="operation-error-alert"
      :class="{ 'retryable': operationError.retryable }"
    >
      <div class="operation-error-content">
        <span class="error-icon">❌</span>
        <span class="error-message">
          <strong>{{ operationError.type }}:</strong> {{ operationError.message }}
        </span>
        <div class="error-actions">
          <button
            v-if="operationError.retryable"
            class="retry-btn"
            title="Retry failed operation"
            @click="$emit('retryFailedOperation')"
          >
            🔄 Retry
          </button>
          <button
            class="dismiss-btn"
            title="Dismiss error"
            @click="$emit('clearOperationError')"
          >
            ✕
          </button>
          <button
            v-if="operationError.type === 'System Restart'"
            class="refresh-btn"
            title="Refresh page"
            @click="$emit('reloadPage')"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- Global Loading Overlay -->
    <div
      v-if="operationLoading.loading || operationLoading.syncing"
      class="global-loading-overlay"
    >
      <div class="loading-content">
        <div class="loading-spinner" />
        <span class="loading-text">
          {{ operationLoading.loading ? 'Loading Calendar...' : 'Synchronizing Data...' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface OperationError {
  type: string
  message: string
  retryable: boolean
}

export interface OperationLoading {
  loading: boolean
  syncing: boolean
}

defineProps<{
  systemHealthy: boolean
  systemHealthMessage: string
  operationError: OperationError | null
  operationLoading: OperationLoading
}>()

defineEmits<{
  (e: 'validateStores'): void
  (e: 'retryFailedOperation'): void
  (e: 'clearOperationError'): void
  (e: 'reloadPage'): void
}>()
</script>

<style scoped>
/* System Health Alert for Graceful Degradation */
.system-health-alert {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-tooltip);
  background: linear-gradient(135deg, var(--color-priority-high), var(--color-priority-medium));
  color: white;
  padding: var(--space-3) var(--space-4);
  border-bottom: 2px solid var(--border-hover);
  box-shadow: var(--shadow-md);
  animation: slideDown 0.3s ease-out;
}

.health-alert-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
}

.health-icon {
  font-size: var(--text-base);
  margin-right: var(--space-2);
}

.health-message {
  flex: 1;
  font-weight: 500;
  font-size: var(--text-sm);
}

.health-retry-btn {
  background: var(--border-hover);
  border: 1px solid var(--white-alpha-30);
  color: white;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.health-retry-btn:hover {
  background: var(--white-alpha-30);
  transform: translateY(-1px);
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Operation Error Alert */
.operation-error-alert {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-tooltip);
  background: linear-gradient(135deg, var(--color-priority-high), var(--color-priority-high));
  color: white;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px var(--danger-bg-subtle);
  max-width: 600px;
  width: 90%;
  animation: slideDown 0.3s ease-out;
}

.operation-error-alert.retryable {
  background: linear-gradient(135deg, #ff9ff3, #feca57);
}

.operation-error-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.error-icon {
  font-size: var(--text-xl);
  flex-shrink: 0;
}

.error-message {
  flex: 1;
  font-size: var(--text-sm);
  line-height: 1.4;
}

.error-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.retry-btn,
.dismiss-btn,
.refresh-btn {
  background: var(--border-hover);
  border: 1px solid var(--white-alpha-30);
  color: white;
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  white-space: nowrap;
}

.retry-btn:hover,
.dismiss-btn:hover,
.refresh-btn:hover {
  background: var(--white-alpha-30);
  transform: translateY(-1px);
}

.refresh-btn {
  background: var(--danger-bg-subtle);
  border-color: var(--white-alpha-40);
}

.refresh-btn:hover {
  background: var(--danger-bg-medium);
}

/* Global Loading Overlay */
.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-darker);
  backdrop-filter: var(--blur-sm);
  z-index: var(--z-tooltip);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.loading-content {
  background: var(--surface-secondary);
  padding: var(--space-6) var(--space-8);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  min-width: 200px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-secondary);
  border-top: 3px solid var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
