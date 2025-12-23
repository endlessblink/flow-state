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
            <div class="operation-btns">
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
import { runSyncSystemTests, type TestSuite } from '@/utils/syncTestSuite'
import SyncStatusIndicator from './SyncStatusIndicator.vue'
import SyncErrorBoundary from './SyncErrorBoundary.vue'

// Define interface for the database composable return
interface DatabaseComposable {
  save?: (key: string, data: unknown) => Promise<void>
  load?: (key: string) => Promise<unknown>
  remove?: (key: string) => Promise<void>
  [key: string]: unknown
}

// Sync manager and database
const syncManager = getGlobalReliableSyncManager()

// Reactive state
const databaseReady = ref(false)
const database = ref<DatabaseComposable | null>(null)

// Initialize database composable
const initializeDatabase = async () => {
  try {
    const dbModule = await getDatabaseComposable()
    database.value = dbModule as DatabaseComposable
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
const testResults = ref<TestSuite | null>(null)

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

// Helper for error messages
const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

// Methods
const triggerManualSync = async () => {
  try {
    operationResult.value = 'Starting manual sync...'
    await syncManager.triggerSync()
    operationResult.value = 'Manual sync completed successfully'
  } catch (error) {
    operationResult.value = `Manual sync failed: ${getErrorMessage(error)}`
  }
}

const pauseSync = async () => {
  try {
    // ReliableSyncManager doesn't have pause, so cleanup to stop sync
    await syncManager.cleanup()
    operationResult.value = 'Sync stopped (cleanup performed)'
  } catch (error) {
    operationResult.value = `Failed to stop sync: ${getErrorMessage(error)}`
  }
}

const resumeSync = async () => {
  try {
    // ReliableSyncManager doesn't have resume, so reinitialize sync
    await syncManager.init()
    operationResult.value = 'Sync resumed (reinitialized)'
  } catch (error) {
    operationResult.value = `Failed to resume sync: ${getErrorMessage(error)}`
  }
}

const clearErrors = () => {
  syncManager.clearSyncErrors()
  operationResult.value = 'Sync errors cleared'
}

const saveTestData = async () => {
  try {
    const data = { value: testValue.value, timestamp: Date.now() }
    await database.value?.save?.(testKey.value, data)
    operationResult.value = `Saved: ${testKey.value} = ${testValue.value}`
  } catch (error) {
    operationResult.value = `Save failed: ${getErrorMessage(error)}`
  }
}

const loadTestData = async () => {
  try {
    const data = await database.value?.load?.(testKey.value) as { value: string } | null
    if (data) {
      testValue.value = data.value
      operationResult.value = `Loaded: ${testKey.value} = ${data.value}`
    } else {
      operationResult.value = `No data found for key: ${testKey.value}`
    }
  } catch (error) {
    operationResult.value = `Load failed: ${getErrorMessage(error)}`
  }
}

const removeTestData = async () => {
  try {
    await database.value?.remove?.(testKey.value)
    operationResult.value = `Removed: ${testKey.value}`
  } catch (error) {
    operationResult.value = `Remove failed: ${getErrorMessage(error)}`
  }
}

const runTests = async () => {
  isTesting.value = true
  try {
    operationResult.value = 'Running comprehensive sync system tests...'
    testResults.value = await runSyncSystemTests()
    operationResult.value = `Tests completed: ${testResults.value.passed}/${testResults.value.tests.length} passed`
  } catch (error) {
    operationResult.value = `Test suite failed: ${getErrorMessage(error)}`
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
  padding: var(--space-6);
  max-width: 1000px;
  margin: 0 auto;
}

.header-sync {
  margin-bottom: var(--space-6);
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-4);
  color: var(--text-primary);
}

h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-3);
  color: var(--text-secondary);
}

.sync-controls,
.sync-details-panel,
.test-operations,
.health-monitoring,
.recent-errors,
.test-results {
  background: rgba(20, 20, 20, 0.36);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg);
}

.control-buttons {
  @apply flex flex-wrap gap-2;
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  transition: all 0.2s var(--spring-smooth);
}

.btn-primary {
  background: var(--brand-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--brand-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.btn-outline:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  border-color: var(--glass-border-heavy);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
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
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  transition: all 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
}

.operation-result {
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.health-item {
  background: rgba(30, 30, 30, 0.4);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
}

.health-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--space-1);
}

.health-value {
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.health-value.healthy,
.health-value.online,
.health-value.connected {
  color: var(--status-done-text);
}

.health-value.unhealthy,
.health-value.offline,
.health-value.disconnected {
  color: var(--priority-high-text);
}

.health-value.warning,
.health-value.error {
  color: var(--status-in-progress-text);
}

.last-sync {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.error-item {
  padding: var(--space-3);
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.error-direction {
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  color: var(--priority-high-text);
  text-transform: uppercase;
}

.error-time {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.error-message {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.error-meta {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.test-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
}

.test-summary.success {
  background: var(--success-bg-subtle);
  color: var(--status-done-text);
}

.test-summary.failure {
  background: var(--danger-bg-subtle);
  color: var(--priority-high-text);
}

.test-duration {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.test-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.test-result-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: background 0.2s;
}

.test-result-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.test-status {
  width: 24px;
  text-align: center;
}

.test-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.test-error {
  width: 100%;
  font-size: var(--font-size-xs);
  color: var(--priority-high-text);
  margin-top: var(--space-1);
}
</style>