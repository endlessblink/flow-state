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
          {{ operationLoading.loading ? 'Loading Canvas...' : 'Synchronizing Data...' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface OperationError {
  type: string
  message: string
  retryable: boolean
}

interface OperationLoading {
  loading: boolean
  syncing: boolean
  // Other flags exist in source but only these are used in template
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
