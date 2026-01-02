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
  z-index: 10000;
  background: linear-gradient(135deg, #ff6b6b, #ffa726);
  color: white;
  padding: 12px 16px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
  font-size: 16px;
  margin-right: 8px;
}

.health-message {
  flex: 1;
  font-weight: 500;
  font-size: 14px;
}

.health-retry-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.health-retry-btn:hover {
  background: rgba(255, 255, 255, 0.3);
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
  z-index: 10001;
  background: linear-gradient(135deg, #ff4757, #ff6b7a);
  color: white;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
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
  gap: 12px;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.error-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.error-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.retry-btn,
.dismiss-btn,
.refresh-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.retry-btn:hover,
.dismiss-btn:hover,
.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.refresh-btn {
  background: rgba(255, 71, 87, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

.refresh-btn:hover {
  background: rgba(255, 71, 87, 0.4);
}

/* Global Loading Overlay */
.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.loading-content {
  background: var(--surface-secondary);
  padding: 24px 32px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
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
  font-size: 14px;
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
