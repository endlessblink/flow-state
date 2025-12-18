<template>
  <div class="sync-integration-example">
    <h2>🔄 Enhanced Sync System Integration</h2>

    <!-- Error Boundary wraps everything -->
    <SyncErrorBoundary>
      <!-- Sync Status Indicator (compact mode for header) -->
      <div class="header-sync">
        <SyncStatusIndicator
          show-text
          :show-details="false"
          show-progress
          compact
        />
      </div>

      <!-- Main Content Area -->
      <div class="main-content">
        <div class="sync-controls">
          <h3>Sync Controls</h3>
          <div class="control-buttons">
            <button
              :disabled="isSyncing || !canSync"
              class="btn btn-primary"
              @click="triggerManualSync"
            >
              <span v-if="isSyncing" class="flex items-center gap-2">
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
                Syncing...
              </span>
              <span v-else>Manual Sync</span>
            </button>

            <button
              :disabled="!isSyncing"
              class="btn btn-secondary"
              @click="pauseSync"
            >
              Pause
            </button>

            <button
              :disabled="isSyncing"
              class="btn btn-secondary"
              @click="resumeSync"
            >
              Resume
            </button>

            <button
              :disabled="!hasErrors"
              class="btn btn-outline"
              @click="clearErrors"
            >
              Clear Errors
            </button>

            <button
              :disabled="isTesting"
              class="btn btn-ghost"
              @click="runTests"
            >
              <span v-if="isTesting" class="flex items-center gap-2">
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
                Testing...
              </span>
              <span v-else>Run Tests</span>
            </button>
          </div>
        </div>

        <!-- Detailed Sync Status -->
        <div class="sync-details-panel">
          <h3>Sync Details</h3>
          <SyncStatusIndicator
            show-text
            show-details
            show-progress
          />
        </div>

        <!-- Test Data Operations -->
        <div class="test-operations">
          <h3>Test Data Operations</h3>
          <div class="operation-form">
            <input
              v-model="testKey"
              placeholder="Test key"
              class="input"
            >
            <input
              v-model="testValue"
              placeholder="Test value"
              class="input"
            >
            <button class="btn btn-sm btn-primary" @click="saveTestData">
              Save
            </button>
            <button class="btn btn-sm btn-secondary" @click="loadTestData">
              Load
            </button>
            <button class="btn btn-sm btn-outline" @click="removeTestData">
              Remove
            </button>
          </div>
          <div v-if="operationResult" class="operation-result">
            <strong>Result:</strong> {{ operationResult }}
          </div>
        </div>

        <!-- Health Monitoring -->
        <div class="health-monitoring">
          <h3>Health Monitoring</h3>
          <div class="health-grid">
            <div class="health-item">
              <span class="health-label">Status:</span>
              <span class="health-value" :class="healthStatus.status">{{ healthStatus.status }}</span>
            </div>
            <div class="health-item">
              <span class="health-label">Healthy:</span>
              <span class="health-value" :class="{ healthy: healthStatus.isHealthy, unhealthy: !healthStatus.isHealthy }">
                {{ healthStatus.isHealthy ? 'Yes' : 'No' }}
              </span>
            </div>
            <div class="health-item">
              <span class="health-label">Online:</span>
              <span class="health-value" :class="{ online: healthStatus.isOnline, offline: !healthStatus.isOnline }">
                {{ healthStatus.isOnline ? 'Yes' : 'No' }}
              </span>
            </div>
            <div class="health-item">
              <span class="health-label">Remote:</span>
              <span class="health-value" :class="{ connected: healthStatus.remoteConnected, disconnected: !healthStatus.remoteConnected }">
                {{ healthStatus.remoteConnected ? 'Connected' : 'Disconnected' }}
              </span>
            </div>
            <div class="health-item">
              <span class="health-label">Failures:</span>
              <span class="health-value" :class="{ warning: healthStatus.consecutiveFailures > 0 }">
                {{ healthStatus.consecutiveFailures }}/{{ healthStatus.maxFailures }}
              </span>
            </div>
            <div class="health-item">
              <span class="health-label">Errors:</span>
              <span class="health-value" :class="{ error: healthStatus.errorCount > 0 }">
                {{ healthStatus.errorCount }}
              </span>
            </div>
          </div>

          <div v-if="healthStatus.lastSyncTime" class="last-sync">
            <strong>Last Sync:</strong> {{ formatTimestamp(healthStatus.lastSyncTime) }}
          </div>
        </div>

        <!-- Recent Errors -->
        <div v-if="recentErrors.length > 0" class="recent-errors">
          <h3>Recent Errors</h3>
          <div class="error-list">
            <div v-for="(error, index) in recentErrors" :key="index" class="error-item">
              <div class="error-header">
                <span class="error-direction">{{ error.direction || 'Unknown' }}</span>
                <span class="error-time">{{ formatTimestamp(error.timestamp) }}</span>
              </div>
              <div class="error-message">
                {{ error.message }}
              </div>
              <div v-if="error.retryCount !== undefined" class="error-meta">
                Retry {{ error.retryCount }} • {{ error.isRetryable ? 'Retryable' : 'Not Retryable' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Test Results -->
        <div v-if="testResults" class="test-results">
          <h3>Test Results</h3>
          <div class="test-summary">
            <span :class="{ success: testResults.failed === 0, failure: testResults.failed > 0 }">
              {{ testResults.passed }}/{{ testResults.tests.length }} tests passed
            </span>
            <span class="test-duration">{{ testResults.totalDuration }}ms</span>
          </div>
          <div class="test-details">
            <div v-for="test in testResults.tests" :key="test.name" class="test-result-item">
              <span class="test-status">{{ test.passed ? '✅' : '❌' }}</span>
              <span class="test-name">{{ test.name }}</span>
              <span class="test-duration">{{ test.duration }}ms</span>
              <div v-if="!test.passed && test.error" class="test-error">
                {{ test.error }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SyncErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'
import { getDatabaseComposable } from '@/composables/useDynamicImports'
import { runSyncSystemTests } from '@/utils/syncTestSuite'
import SyncStatusIndicator from './SyncStatusIndicator.vue'
import SyncErrorBoundary from './SyncErrorBoundary.vue'

// Sync manager and database
const syncManager = getGlobalReliableSyncManager()

// Reactive state
const databaseReady = ref(false)
const database = ref(null)

// Initialize database composable
const initializeDatabase = async () => {
  try {
    database.value = await getDatabaseComposable()
    databaseReady.value = true
  } catch (error) {
    console.error('Failed to initialize database composable:', error)
  }
}

// Initialize on mount
onMounted(() => {
  initializeDatabase()
})

// Reactive state
const testKey = ref('example-key')
const testValue = ref('example-value')
const operationResult = ref('')
const isTesting = ref(false)
const testResults = ref<any>(null)

// Computed properties (adapted for ReliableSyncManager API)
const _syncStatus = computed(() => syncManager.syncStatus.value)
const isSyncing = computed(() => syncManager.isSyncing.value)
const hasErrors = computed(() => syncManager.hasErrors.value)

// Create compatibility properties for the UI
const canSync = computed(() => {
  const isOnline = syncManager.isOnline.value
  const remoteConnected = syncManager.remoteConnected.value
  return isOnline && remoteConnected
})

const healthStatus = computed(() => {
  const health = syncManager.getSyncHealth()
  return {
    status: health.syncStatus,
    isHealthy: !health.hasErrors && health.conflictCount === 0,
    isOnline: health.isOnline,
    remoteConnected: syncManager.remoteConnected.value,
    consecutiveFailures: 0, // Not directly available
    maxFailures: 3,
    errorCount: health.hasErrors ? 1 : 0,
    lastSyncTime: syncManager.lastSyncTime.value
  }
})

const recentErrors = computed(() => {
  const errors = []
  const error = syncManager.error.value
  if (error) {
    errors.push({
      message: error,
      timestamp: new Date(),
      direction: 'sync',
      retryCount: 0,
      isRetryable: true
    })
  }
  return errors.slice(-5) // Show last 5
})

// Methods
const triggerManualSync = async () => {
  try {
    operationResult.value = 'Starting manual sync...'
    await syncManager.triggerSync()
    operationResult.value = 'Manual sync completed successfully'
  } catch (error) {
    operationResult.value = `Manual sync failed: ${(error as any).message}`
  }
}

const pauseSync = async () => {
  try {
    // ReliableSyncManager doesn't have pause, so cleanup to stop sync
    await syncManager.cleanup()
    operationResult.value = 'Sync stopped (cleanup performed)'
  } catch (error) {
    operationResult.value = `Failed to stop sync: ${(error as any).message}`
  }
}

const resumeSync = async () => {
  try {
    // ReliableSyncManager doesn't have resume, so reinitialize sync
    await syncManager.init()
    operationResult.value = 'Sync resumed (reinitialized)'
  } catch (error) {
    operationResult.value = `Failed to resume sync: ${(error as any).message}`
  }
}

const clearErrors = () => {
  syncManager.clearSyncErrors()
  operationResult.value = 'Sync errors cleared'
}

const saveTestData = async () => {
  try {
    const data = { value: testValue.value, timestamp: Date.now() }
    await (database.value as any)?.save?.(testKey.value, data)
    operationResult.value = `Saved: ${testKey.value} = ${testValue.value}`
  } catch (error) {
    operationResult.value = `Save failed: ${(error as any).message}`
  }
}

const loadTestData = async () => {
  try {
    const data = await (database.value as any)?.load?.(testKey.value)
    if (data) {
      testValue.value = data.value
      operationResult.value = `Loaded: ${testKey.value} = ${data.value}`
    } else {
      operationResult.value = `No data found for key: ${testKey.value}`
    }
  } catch (error) {
    operationResult.value = `Load failed: ${(error as any).message}`
  }
}

const removeTestData = async () => {
  try {
    await (database.value as any)?.remove?.(testKey.value)
    operationResult.value = `Removed: ${testKey.value}`
  } catch (error) {
    operationResult.value = `Remove failed: ${(error as any).message}`
  }
}

const runTests = async () => {
  isTesting.value = true
  try {
    operationResult.value = 'Running comprehensive sync system tests...'
    testResults.value = await runSyncSystemTests()
    operationResult.value = `Tests completed: ${testResults.value.passed}/${testResults.value.tests.length} passed`
  } catch (error) {
    operationResult.value = `Test suite failed: ${(error as any).message}`
  } finally {
    isTesting.value = false
  }
}

const formatTimestamp = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

// Initialize component
onMounted(() => {
  console.log('Sync Integration Example mounted')
  console.log('Health status:', healthStatus.value)
})
</script>

<style scoped>
.sync-integration-example {
  @apply p-6 max-w-6xl mx-auto;
}

.header-sync {
  @apply mb-6;
}

.main-content {
  @apply space-y-6;
}

h2 {
  @apply text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200;
}

h3 {
  @apply text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300;
}

.sync-controls,
.sync-details-panel,
.test-operations,
.health-monitoring,
.recent-errors,
.test-results {
  @apply bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700;
}

.control-buttons {
  @apply flex flex-wrap gap-2;
}

.btn {
  @apply px-4 py-2 rounded font-medium transition-colors duration-200;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white;
}

.btn-secondary {
  @apply bg-gray-600 hover:bg-gray-700 text-white;
}

.btn-outline {
  @apply border border-gray-600 hover:bg-gray-600/50 text-gray-700 dark:text-gray-300;
}

.btn-ghost {
  @apply hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.btn-sm {
  @apply px-3 py-1 text-sm;
}

.test-operations .operation-form {
  @apply flex flex-wrap gap-2 mb-3;
}

.input {
  @apply px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100;
}

.operation-result {
  @apply p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm;
}

.health-grid {
  @apply grid grid-cols-2 md:grid-cols-3 gap-3 mb-4;
}

.health-item {
  @apply flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded;
}

.health-label {
  @apply text-sm font-medium text-gray-600 dark:text-gray-400;
}

.health-value {
  @apply text-sm font-mono;
}

.health-value.healthy,
.health-value.online,
.health-value.connected {
  @apply text-green-600 dark:text-green-400;
}

.health-value.unhealthy,
.health.value.offline,
.health.value.disconnected {
  @apply text-red-600 dark:text-red-400;
}

.health-value.warning,
.health-value.error {
  @apply text-yellow-600 dark:text-yellow-400;
}

.last-sync {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.error-list {
  @apply space-y-2;
}

.error-item {
  @apply p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded;
}

.error-header {
  @apply flex justify-between items-center mb-1;
}

.error-direction {
  @apply text-xs font-medium text-red-600 dark:text-red-400 uppercase;
}

.error-time {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.error-message {
  @apply text-sm text-red-800 dark:text-red-200 mb-1;
}

.error-meta {
  @apply text-xs text-gray-600 dark:text-gray-400;
}

.test-summary {
  @apply flex justify-between items-center mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded;
}

.test-summary.success {
  @apply bg-green-50 dark:bg-green-900/20;
}

.test-summary.failure {
  @apply bg-red-50 dark:bg-red-900/20;
}

.test-duration {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.test-details {
  @apply space-y-1;
}

.test-result-item {
  @apply flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded;
}

.test-status {
  @apply w-6 text-center;
}

.test-name {
  @apply flex-1 text-sm font-medium;
}

.test-duration {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.test-error {
  @apply w-full text-xs text-red-600 dark:text-red-400 mt-1;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .sync-integration-example {
    @apply bg-gray-900 text-gray-100;
  }
}
</style>