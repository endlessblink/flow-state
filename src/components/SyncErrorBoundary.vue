<template>
  <div class="sync-error-boundary">
    <!-- Normal content when no errors -->
    <div v-if="!hasCriticalError" class="boundary-content">
      <slot />
    </div>

    <!-- Error fallback UI when critical errors occur -->
    <div v-else class="error-fallback">
      <div class="error-container">
        <div class="error-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div class="error-content">
          <h3 class="error-title">
            Sync System Error
          </h3>
          <p class="error-description">
            {{ errorMessage }}
          </p>

          <div v-if="errorDetails" class="error-details">
            <h4 class="details-title">
              Error Details:
            </h4>
            <pre class="error-stack">{{ errorDetails }}</pre>
          </div>

          <div class="error-actions">
            <button class="btn btn-primary" :disabled="isRetrying" @click="retryInitialization">
              <span v-if="isRetrying" class="flex items-center gap-2">
                <svg
                  class="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Retrying...
              </span>
              <span v-else>Retry</span>
            </button>

            <button class="btn btn-secondary" @click="resetToOfflineMode">
              Work Offline
            </button>

            <button class="btn btn-outline" @click="reloadPage">
              Reload Page
            </button>

            <button class="btn btn-ghost" @click="showAdvancedOptions = !showAdvancedOptions">
              Advanced
            </button>
          </div>

          <!-- Advanced Options -->
          <div v-if="showAdvancedOptions" class="advanced-options">
            <h4 class="options-title">
              Advanced Options:
            </h4>
            <div class="option-list">
              <button class="option-btn danger" @click="clearAllData">
                Clear All Data
              </button>
              <button class="option-btn" @click="exportErrorLog">
                Export Error Log
              </button>
              <button class="option-btn" @click="checkConnection">
                Test Connection
              </button>
            </div>

            <div v-if="connectionStatus" class="connection-status">
              <h5>Connection Test Results:</h5>
              <pre>{{ connectionStatus }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Warning banner for non-critical errors -->
    <div v-if="hasWarnings && !hasCriticalError" class="warning-banner">
      <div class="warning-content">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-yellow-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L5.268 15.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span class="warning-text">{{ warningMessage }}</span>
        <button class="dismiss-btn" @click="dismissWarning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Recovery Progress -->
    <div v-if="isRecovering" class="recovery-overlay">
      <div class="recovery-content">
        <div class="recovery-spinner">
          <svg
            class="animate-spin h-8 w-8"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h3 class="recovery-title">
          {{ recoveryTitle }}
        </h3>
        <p class="recovery-message">
          {{ recoveryMessage }}
        </p>
        <div class="recovery-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${recoveryProgress}%` }" />
          </div>
          <span class="progress-text">{{ recoveryProgress }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
// import { getGlobalEnhancedSyncManager } from '@/composables/useEnhancedSyncManager' // Temporarily disabled
import { useDatabase } from '@/composables/useDatabase'

interface Props {
  fallbackComponent?: string
  maxRetries?: number
  enableRecovery?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxRetries: 3,
  enableRecovery: true
})

// Enhanced sync manager and database
// const syncManager = getGlobalEnhancedSyncManager() // Temporarily disabled
const { clear: clearDatabase } = useDatabase()

// Mock syncManager to prevent undefined references (temporary until enhanced sync manager is re-enabled)
const syncManager = {
  getHealthStatus: () => ({ status: 'healthy', lastSync: new Date() }),
  hasErrors: { value: false },
  syncErrors: { value: [] as string[] },
  pauseSync: async () => console.log('Mock: pauseSync called'),
  resumeSync: async () => console.log('Mock: resumeSync called'),
  forceSync: async () => console.log('Mock: forceSync called')
}

// Error state
const hasCriticalError = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')
const hasWarnings = ref(false)
const warningMessage = ref('')
const isRetrying = ref(false)
const showAdvancedOptions = ref(false)
const connectionStatus = ref('')

// Recovery state
const isRecovering = ref(false)
const recoveryTitle = ref('Recovering Sync System')
const recoveryMessage = ref('Attempting to restore functionality...')
const recoveryProgress = ref(0)

// Retry tracking
const retryCount = ref(0)

// Computed properties
const healthStatus = computed(() => syncManager.getHealthStatus())
const _hasErrors = computed(() => syncManager.hasErrors.value)
const syncErrors = computed(() => syncManager.syncErrors.value)

// Watch for critical errors
const checkForCriticalErrors = () => {
  const health = healthStatus.value

  // Check if we need user intervention
  if ((health as any).needsUserIntervention && retryCount.value >= props.maxRetries) {
    hasCriticalError.value = true
    errorMessage.value = 'The sync system has encountered repeated failures and needs your attention.'
    errorDetails.value = formatErrorDetails()
  }

  // Check for warnings
  if ((health as any).consecutiveFailures > 0 && !(health as any).needsUserIntervention) {
    hasWarnings.value = true
    warningMessage.value = `Sync experiencing issues (${(health as any).consecutiveFailures} consecutive failures)`
  } else {
    hasWarnings.value = false
  }
}

// Format error details for display
const formatErrorDetails = (): string => {
  const health = healthStatus.value
  const errors = syncErrors.value.slice(-5) // Show last 5 errors

  let details = `Health Status:\n`
  details += `- Status: ${health.status}\n`
  details += `- Is Healthy: ${(health as any).isHealthy}\n`
  details += `- Consecutive Failures: ${(health as any).consecutiveFailures}/${(health as any).maxFailures}\n`
  details += `- Is Online: ${(health as any).isOnline}\n`
  details += `- Remote Connected: ${(health as any).remoteConnected}\n`
  details += `- Error Count: ${(health as any).errorCount}\n`

  if (errors.length > 0) {
    details += `\nRecent Errors:\n`
    errors.forEach((error, index) => {
      details += `${index + 1}. ${(error as any).message} (${(error as any).direction || 'unknown'})\n`
      details += `   Time: ${(error as any).timestamp?.toISOString() || 'Unknown'}\n`
      if ((error as any).retryCount) {
        details += `   Retry Count: ${(error as any).retryCount}\n`
      }
      if ((error as any).isRetryable !== undefined) {
        details += `   Retryable: ${(error as any).isRetryable}\n`
      }
    })
  }

  return details
}

// Recovery methods
const retryInitialization = async () => {
  if (isRetrying.value) return

  isRetrying.value = true
  retryCount.value++

  try {
    await startRecovery('Reinitializing Sync System')

    // Clear existing errors - use available method or cast
    ;(syncManager as any).clearSyncErrors?.()

    // Reset sync manager - use available method or cast
    await (syncManager as any).cleanup?.()

    // Reinitialize
    await nextTick()
    await (syncManager as any).init?.()

    // Check if recovery was successful
    await nextTick()
    checkForCriticalErrors()

    if (!hasCriticalError.value) {
      hasCriticalError.value = false
      errorMessage.value = ''
      errorDetails.value = ''
      retryCount.value = 0
    }

  } catch (error) {
    console.error('Retry initialization failed:', error)
    errorMessage.value = `Retry failed: ${(error as any).message || (error as any).toString()}`
    errorDetails.value = (error as any).stack || (error as any).toString()
  } finally {
    isRetrying.value = false
    isRecovering.value = false
  }
}

const resetToOfflineMode = async () => {
  try {
    await startRecovery('Switching to Offline Mode')

    // Pause sync
    await syncManager.pauseSync()

    // Clear errors and work offline
    ;(syncManager as any).clearSyncErrors?.()
    hasCriticalError.value = false
    errorMessage.value = ''
    errorDetails.value = ''
    hasWarnings.value = false

  } catch (error) {
    console.error('Failed to switch to offline mode:', error)
  } finally {
    isRecovering.value = false
  }
}

const reloadPage = () => {
  window.location.reload()
}

const clearAllData = async () => {
  if (!confirm('⚠️ This will delete ALL local data. Are you sure?')) return
  if (!confirm('⚠️ This action cannot be undone. Are you absolutely sure?')) return

  try {
    await startRecovery('Clearing All Data')

    // Clear database
    await clearDatabase()

    // Clear sync errors
    ;(syncManager as any).clearSyncErrors?.()

    // Reset error state
    hasCriticalError.value = false
    errorMessage.value = ''
    errorDetails.value = ''
    retryCount.value = 0

    // Reload page to start fresh
    setTimeout(() => {
      window.location.reload()
    }, 1000)

  } catch (error) {
    console.error('Failed to clear data:', error)
    errorMessage.value = `Failed to clear data: ${(error as any).message || (error as any).toString()}`
  } finally {
    isRecovering.value = false
  }
}

const exportErrorLog = () => {
  try {
    const health = healthStatus.value
    const errors = syncErrors.value

    const logData = {
      timestamp: new Date().toISOString(),
      health: health,
      errors: errors.map(e => ({
        message: (e as any).message || 'Unknown error',
        direction: (e as any).direction || 'unknown',
        timestamp: (e as any).timestamp?.toISOString() || new Date().toISOString(),
        retryCount: (e as any).retryCount,
        isRetryable: (e as any).isRetryable
      })),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `pomo-flow-sync-error-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

  } catch (error) {
    console.error('Failed to export error log:', error)
    alert('Failed to export error log. Check console for details.')
  }
}

const checkConnection = async () => {
  try {
    connectionStatus.value = 'Testing connection...'

    const response = await fetch('http://84.46.253.137:5984/', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:pomoflow-2024').toString('base64')
      }
    })

    if (response.ok) {
      const data = await response.json()
      connectionStatus.value = `✅ Connection successful\nServer: ${data.couchdb} v${data.version}\nUUID: ${data.uuid}`
    } else {
      connectionStatus.value = `❌ Connection failed: ${response.status} ${response.statusText}`
    }

  } catch (error) {
    connectionStatus.value = `❌ Connection error: ${(error as any).message || (error as any).toString()}`
  }
}

const dismissWarning = () => {
  hasWarnings.value = false
  warningMessage.value = ''
}

const startRecovery = async (title: string): Promise<void> => {
  return new Promise((resolve) => {
    isRecovering.value = true
    recoveryTitle.value = title
    recoveryMessage.value = 'Initializing recovery process...'
    recoveryProgress.value = 0

    // Simulate recovery progress
    const progressInterval = setInterval(() => {
      recoveryProgress.value += 10
      recoveryMessage.value = `Recovering... ${recoveryProgress.value}%`

      if (recoveryProgress.value >= 90) {
        clearInterval(progressInterval)
        recoveryProgress.value = 95
        recoveryMessage.value = 'Finalizing recovery...'

        setTimeout(() => {
          recoveryProgress.value = 100
          recoveryMessage.value = 'Recovery complete'
          setTimeout(resolve, 500)
        }, 500)
      }
    }, 200)
  })
}

// Error monitoring
const handleSyncError = (event: CustomEvent) => {
  const { error, needsUserIntervention } = event.detail

  if (needsUserIntervention) {
    checkForCriticalErrors()
  }
}

const handleUnhandledError = (event: ErrorEvent) => {
  // Check if it's a sync-related error
  if (event.message && (
    event.message.includes('sync') ||
    event.message.includes('pouchdb') ||
    event.message.includes('couchdb') ||
    event.message.includes('database')
  )) {
    hasCriticalError.value = true
    errorMessage.value = 'An unexpected sync error occurred'
    errorDetails.value = `${event.message}\n${event.error?.stack || 'No stack trace available'}`
  }
}

// Lifecycle
onMounted(() => {
  // Initial check
  checkForCriticalErrors()

  // Listen for sync errors
  window.addEventListener('sync-error', handleSyncError as EventListener)

  // Listen for unhandled errors
  window.addEventListener('error', handleUnhandledError)
})

onUnmounted(() => {
  window.removeEventListener('sync-error', handleSyncError as EventListener)
  window.removeEventListener('error', handleUnhandledError)
})

// Periodic health check
const healthCheckInterval = setInterval(() => {
  checkForCriticalErrors()
}, 10000) // Check every 10 seconds

onUnmounted(() => {
  clearInterval(healthCheckInterval)
})
</script>

<style scoped>
.sync-error-boundary {
  @apply relative;
}

.boundary-content {
  @apply contents;
}

.error-fallback {
  @apply fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4;
}

.error-container {
  @apply bg-gray-900 border border-red-500/50 rounded-lg p-6 max-w-lg w-full;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
}

.error-icon {
  @apply flex justify-center mb-4;
}

.error-content {
  @apply text-center;
}

.error-title {
  @apply text-xl font-bold text-red-400 mb-2;
}

.error-description {
  @apply text-gray-300 mb-4;
}

.error-details {
  @apply mt-4 p-3 bg-black/50 rounded text-left;
}

.details-title {
  @apply text-sm font-medium text-red-400 mb-2;
}

.error-stack {
  @apply text-xs text-gray-400 whitespace-pre-wrap font-mono;
  max-height: 200px;
  overflow-y: auto;
}

.error-actions {
  @apply flex flex-wrap gap-2 justify-center mt-6;
}

.btn {
  @apply px-4 py-2 rounded font-medium transition-colors duration-200;
}

.btn-primary {
  @apply bg-red-600 hover:bg-red-700 text-white;
}

.btn-secondary {
  @apply bg-gray-600 hover:bg-gray-700 text-white;
}

.btn-outline {
  @apply border border-gray-600 hover:bg-gray-600/50 text-gray-300;
}

.btn-ghost {
  @apply hover:bg-gray-700/50 text-gray-400;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.advanced-options {
  @apply mt-6 pt-6 border-t border-gray-700 text-left;
}

.options-title {
  @apply text-sm font-medium text-gray-400 mb-3;
}

.option-list {
  @apply space-y-2;
}

.option-btn {
  @apply block w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition-colors duration-200;
}

.option-btn.danger {
  @apply bg-red-900/50 hover:bg-red-900/70 text-red-300;
}

.connection-status {
  @apply mt-4 p-3 bg-black/50 rounded;
}

.connection-status h5 {
  @apply text-sm font-medium text-gray-400 mb-2;
}

.connection-status pre {
  @apply text-xs text-gray-400 whitespace-pre-wrap;
}

.warning-banner {
  @apply fixed top-4 right-4 left-4 bg-yellow-500/90 text-yellow-900 p-4 rounded-lg shadow-lg z-40 max-w-md mx-auto;
}

.warning-content {
  @apply flex items-center gap-3;
}

.warning-text {
  @apply flex-1 text-sm font-medium;
}

.dismiss-btn {
  @apply p-1 hover:bg-yellow-600/50 rounded;
}

.recovery-overlay {
  @apply fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4;
}

.recovery-content {
  @apply text-center;
}

.recovery-spinner {
  @apply flex justify-center mb-4;
}

.recovery-title {
  @apply text-xl font-bold text-white mb-2;
}

.recovery-message {
  @apply text-gray-300 mb-4;
}

.recovery-progress {
  @apply flex items-center gap-3 max-w-xs mx-auto;
}

.progress-bar {
  @apply flex-1 bg-gray-700 rounded-full h-2;
}

.progress-fill {
  @apply bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out;
}

.progress-text {
  @apply text-sm text-gray-400 min-w-[3rem] text-right;
}
</style>