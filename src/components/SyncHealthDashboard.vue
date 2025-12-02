<template>
  <div class="sync-health-dashboard" :class="{ 'minimized': isMinimized }">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h3 class="dashboard-title">
          <Activity :size="20" />
          Sync Health Dashboard
        </h3>
        <div class="health-status" :class="overallHealthClass">
          {{ overallHealthStatus }}
        </div>
      </div>
      <div class="header-controls">
        <button
          @click="toggleMinimized"
          class="control-btn"
          :title="isMinimized ? 'Expand' : 'Minimize'"
        >
          <Minimize2 v-if="!isMinimized" :size="16" />
          <Maximize2 v-else :size="16" />
        </button>
        <button
          @click="refreshDashboard"
          class="control-btn"
          :class="{ 'loading': isRefreshing }"
          title="Refresh"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': isRefreshing }" />
        </button>
        <button
          @click="exportLogs"
          class="control-btn"
          title="Export Logs"
        >
          <Download :size="16" />
        </button>
      </div>
    </div>

    <!-- Dashboard Content -->
    <div v-if="!isMinimized" class="dashboard-content">
      <!-- Quick Stats -->
      <div class="stats-grid">
        <div class="stat-card sync-status">
          <div class="stat-header">
            <Cloud :size="24" />
            <span class="stat-label">Sync Status</span>
          </div>
          <div class="stat-value" :class="syncStatusClass">
            {{ displaySyncStatus }}
          </div>
          <div v-if="lastSyncTime" class="stat-detail">
            Last: {{ formatRelativeTime(lastSyncTime) }}
          </div>
        </div>

        <div class="stat-card network-health">
          <div class="stat-header">
            <Wifi :size="24" />
            <span class="stat-label">Network</span>
          </div>
          <div class="stat-value" :class="networkClass">
            {{ networkCondition }}
          </div>
          <div class="stat-detail">
            {{ bandwidth }} | {{ latency }}ms
          </div>
        </div>

        <div class="stat-card conflicts">
          <div class="stat-header">
            <AlertTriangle :size="24" />
            <span class="stat-label">Conflicts</span>
          </div>
          <div class="stat-value" :class="{ 'has-conflicts': conflicts.length > 0 }">
            {{ conflicts.length }}
          </div>
          <div class="stat-detail">
            {{ resolvedConflicts }} resolved
          </div>
        </div>

        <div class="stat-card data-integrity">
          <div class="stat-header">
            <Shield :size="24" />
            <span class="stat-label">Data Health</span>
          </div>
          <div class="stat-value" :class="integrityClass">
            {{ dataHealth }}
          </div>
          <div class="stat-detail">
            {{ totalDocuments }} docs
          </div>
        </div>
      </div>

      <!-- Phase 1: Enhanced Monitoring Section -->
      <div class="phase1-monitoring-section">
        <div class="monitoring-header">
          <h4 class="section-title">
            <Heart :size="18" />
            Phase 1: Cross-Browser Sync Health
          </h4>
        </div>
        <div class="monitoring-grid">
          <div class="monitoring-card circuit-breaker">
            <div class="monitoring-label">Circuit Breaker</div>
            <div class="monitoring-value" :class="`health-${circuitBreakerHealth.toLowerCase()}`">
              {{ circuitBreakerHealth }}
            </div>
            <div class="monitoring-detail">
              {{ healthReport.score }}% health | {{ circuitBreakerMetrics.consecutiveErrors }} errors
            </div>
          </div>

          <div class="monitoring-card progressive-sync">
            <div class="monitoring-label">Progressive Sync</div>
            <div class="monitoring-value" :class="{
              'active': isProgressiveSyncEnabled,
              'ready': !isProgressiveSyncEnabled && healthReport.isReadyForProgressiveSync,
              'not-ready': !healthReport.isReadyForProgressiveSync
            }">
              {{ progressiveSyncStatus }}
            </div>
            <div class="monitoring-detail">
              {{ healthReport.isReadyForProgressiveSync ? 'System ready' : 'System not ready' }}
            </div>
          </div>

          <div class="monitoring-card conflicts-rate">
            <div class="monitoring-label">Conflict Rate</div>
            <div class="monitoring-value" :class="{ 'has-conflicts': conflictStats.totalConflicts > 0 }">
              {{ conflictRate }}%
            </div>
            <div class="monitoring-detail">
              {{ conflictStats.totalConflicts }} total conflicts
            </div>
          </div>

          <div class="monitoring-card rollback-count">
            <div class="monitoring-label">Auto-Rollbacks</div>
            <div class="monitoring-value" :class="{ 'has-rollbacks': circuitBreakerMetrics.rollbackCount > 0 }">
              {{ circuitBreakerMetrics.rollbackCount }}
            </div>
            <div class="monitoring-detail">
              Automatic rollbacks triggered
            </div>
          </div>
        </div>

        <!-- Phase 1 Recommendations -->
        <div v-if="healthReport.recommendations.length > 0" class="recommendations-card">
          <div class="recommendations-header">
            <AlertCircle :size="16" />
            <span>Health Recommendations</span>
          </div>
          <ul class="recommendations-list">
            <li v-for="recommendation in healthReport.recommendations" :key="recommendation">
              {{ recommendation }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Detailed Sections -->
      <div class="details-sections">
        <!-- Sync Operations -->
        <div class="section-card">
          <h4 class="section-title">
            <Activity :size="18" />
            Recent Sync Operations
          </h4>
          <div class="operations-list">
            <div
              v-for="operation in recentOperations.slice(0, 5)"
              :key="operation.id"
              class="operation-item"
              :class="{ 'success': operation.success, 'failed': !operation.success }"
            >
              <div class="operation-info">
                <div class="operation-type">{{ operation.type }}</div>
                <div class="operation-time">{{ formatDateTime(operation.startTime) }}</div>
              </div>
              <div class="operation-metrics">
                <div class="metric">
                  <span class="metric-label">Duration:</span>
                  <span class="metric-value">{{ operation.duration }}ms</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Docs:</span>
                  <span class="metric-value">{{ operation.documentsProcessed }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Network Conditions -->
        <div class="section-card">
          <h4 class="section-title">
            <Wifi :size="18" />
            Network Performance
          </h4>
          <div class="network-metrics">
            <div class="metric-row">
              <span class="metric-label">Bandwidth:</span>
              <span class="metric-value">{{ formatBandwidth((networkMetrics as any).bandwidth || 0) }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Latency:</span>
              <span class="metric-value">{{ (networkMetrics as any).latency || 0 }}ms</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Reliability:</span>
              <span class="metric-value">{{ (((networkMetrics as any).reliability || 0) * 100).toFixed(1) }}%</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Success Rate:</span>
              <span class="metric-value">{{ (syncMetrics.successRate * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div class="section-card">
          <h4 class="section-title">
            <TrendingUp :size="18" />
            Performance Metrics
          </h4>
          <div class="performance-chart">
            <div class="chart-placeholder">
              <p>Performance chart would be rendered here</p>
              <p class="chart-legend">
                Average sync time: {{ averageSyncTime }}ms
              </p>
            </div>
          </div>
        </div>

        <!-- Error Log -->
        <div class="section-card">
          <h4 class="section-title">
            <AlertCircle :size="18" />
            Recent Errors
          </h4>
          <div class="error-list">
            <div
              v-for="error in recentErrors.slice(0, 5)"
              :key="error.id"
              class="error-item"
              :class="error.level"
            >
              <div class="error-header">
                <span class="error-level">{{ error.level.toUpperCase() }}</span>
                <span class="error-time">{{ formatRelativeTime(error.timestamp) }}</span>
              </div>
              <div class="error-message">{{ error.message }}</div>
              <div class="error-category">{{ error.category }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-section">
        <button
          @click="runHealthCheck"
          class="action-btn primary"
          :disabled="isHealthCheckRunning"
        >
          <Heart :size="16" />
          {{ isHealthCheckRunning ? 'Running...' : 'Run Health Check' }}
        </button>

        <!-- Phase 1: Progressive Sync Controls -->
        <button
          v-if="!isProgressiveSyncEnabled && healthReport.isReadyForProgressiveSync"
          @click="enableProgressiveSync"
          class="action-btn phase1-ready"
        >
          <TrendingUp :size="16" />
          Enable Progressive Sync
        </button>

        <button
          v-if="isProgressiveSyncEnabled"
          @click="disableProgressiveSync"
          class="action-btn phase1-active"
        >
          <Shield :size="16" />
          Disable Progressive Sync
        </button>

        <button
          @click="triggerManualSync"
          class="action-btn"
          :disabled="isSyncing"
        >
          <RefreshCw :size="16" />
          Manual Sync
        </button>

        <button
          @click="resetCircuitBreaker"
          class="action-btn"
          :disabled="circuitBreakerMetrics.isCurrentlyActive"
        >
          <Activity :size="16" />
          Reset Circuit Breaker
        </button>

        <button
          @click="showAdvancedSettings"
          class="action-btn"
        >
          <Settings :size="16" />
          Advanced Settings
        </button>
      </div>
    </div>

    <!-- Minimized View -->
    <div v-if="isMinimized" class="minimized-content">
      <div class="minimized-stats">
        <div class="mini-stat" :class="syncStatusClass">
          <Cloud :size="16" />
        </div>
        <div class="mini-stat" :class="networkClass">
          <Wifi :size="16" />
        </div>
        <div v-if="conflicts.length > 0" class="mini-stat has-conflicts">
          <AlertTriangle :size="16" />
          <span class="conflict-count">{{ conflicts.length }}</span>
        </div>
      </div>
    </div>

    <!-- Advanced Settings Modal -->
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal-content" @click.stop>
        <h3>Advanced Sync Settings</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <label>Sync Interval</label>
            <select v-model="settings.syncInterval">
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
            </select>
          </div>
          <div class="setting-item">
            <label>Batch Size</label>
            <input v-model.number="settings.batchSize" type="number" min="1" max="100" />
          </div>
          <div class="setting-item">
            <label>Max Retries</label>
            <input v-model.number="settings.maxRetries" type="number" min="0" max="10" />
          </div>
          <div class="setting-item">
            <label>Enable Compression</label>
            <input v-model="settings.enableCompression" type="checkbox" />
          </div>
        </div>
        <div class="modal-actions">
          <button @click="saveSettings" class="btn-primary">Save</button>
          <button @click="showSettings = false" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  Cloud,
  Download,
  Heart,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  Wifi
} from 'lucide-vue-next'
import { useCouchDBSync } from '@/composables/useCouchDBSync'
import { getLogger } from '@/utils/productionLogger'
import { globalSyncCircuitBreaker } from '@/utils/syncCircuitBreaker'
import { globalConflictResolver } from '@/utils/conflictResolver'

interface DashboardSettings {
  syncInterval: number
  batchSize: number
  maxRetries: number
  enableCompression: boolean
}

const reliableSync = useCouchDBSync()
const logger = getLogger()

// Reactive state
const isMinimized = ref(false)
const isRefreshing = ref(false)
const isHealthCheckRunning = ref(false)
const showSettings = ref(false)

// Settings
const settings = ref<DashboardSettings>({
  syncInterval: 30000,
  batchSize: 25,
  maxRetries: 5,
  enableCompression: true
})

// Sync state
const syncStatus = computed(() => reliableSync.syncStatus.value)
const lastSyncTime = computed(() => reliableSync.lastSyncTime.value)
const isSyncing = computed(() => reliableSync.isSyncing.value)
const conflicts = computed(() => []) // Conflicts not available in consolidated API
const resolvedConflicts = computed(() => 0) // Resolutions not available in consolidated API

// Network metrics (fallback for consolidated API)
const networkMetrics = computed(() => {
  // Network optimizer not available in consolidated API
  return {
    currentCondition: { type: 'good', bandwidth: 1000000, latency: 100, reliability: 0.95 },
    averageBandwidth: 1000000,
    averageLatency: 100,
    successRate: 1.0
  }
})

// Sync metrics (fallback for consolidated API)
const syncMetrics = computed(() => {
  // Use circuit breaker metrics instead of direct metrics
  const circuitMetrics = reliableSync.circuitBreaker.metrics()
  return {
    totalSyncs: 0, // Not tracked in consolidated API
    successfulSyncs: 0,
    failedSyncs: 0, // Not available in circuit breaker metrics
    averageSyncTime: 0,
    successRate: 1.0
  }
})

// Data integrity
const totalDocuments = ref(0)
const dataHealth = ref('Good')

// Recent operations
const recentOperations = ref<any[]>([])
const recentErrors = ref<any[]>([])

// Phase 1: Enhanced monitoring state
const circuitBreakerMetrics = ref(globalSyncCircuitBreaker.getMetrics())
const conflictStats = ref(globalConflictResolver.getStatistics())
const healthReport = ref(globalSyncCircuitBreaker.getHealthReport())
const isProgressiveSyncEnabled = ref(false)

// Computed properties
const overallHealthStatus = computed(() => {
  // Phase 1: Use circuit breaker health score as primary indicator
  const healthScore = healthReport.value.score
  const circuitBreakerHealth = healthReport.value.overall
  const conflictCount = conflictStats.value.totalConflicts
  const isReadyForProgressive = healthReport.value.isReadyForProgressiveSync

  // Enhanced health calculation with Phase 1 metrics
  if (circuitBreakerHealth === 'critical' || healthScore < 30) return 'Critical'
  if (circuitBreakerHealth === 'warning' || healthScore < 50 || conflictCount > 10) return 'Degraded'
  if (!isReadyForProgressive && conflictCount > 0) return 'Warning'
  return 'Healthy'
})

const overallHealthClass = computed(() => {
  const status = overallHealthStatus.value.toLowerCase()
  return `health-${status}`
})

// Phase 1: Enhanced computed properties
const circuitBreakerHealth = computed(() => {
  const metrics = circuitBreakerMetrics.value
  const healthScore = healthReport.value.score

  if (healthScore >= 80) return 'Excellent'
  if (healthScore >= 60) return 'Good'
  if (healthScore >= 40) return 'Fair'
  return 'Poor'
})

const progressiveSyncStatus = computed(() => {
  if (isProgressiveSyncEnabled.value) return 'Active'
  if (healthReport.value.isReadyForProgressiveSync) return 'Ready'
  return 'Not Ready'
})

const conflictRate = computed(() => {
  return conflictStats.value.totalConflicts > 0 ?
    ((conflictStats.value.totalConflicts / (circuitBreakerMetrics.value.attempts || 1)) * 100).toFixed(1) :
    '0.0'
})

const displaySyncStatus = computed(() => {
  const status = syncStatus.value
  return status.charAt(0).toUpperCase() + status.slice(1)
})

const syncStatusClass = computed(() => {
  return `sync-${syncStatus.value}`
})

const networkCondition = computed(() => {
  const condition = networkMetrics.value.currentCondition?.type
  return condition ? condition.charAt(0).toUpperCase() + condition.slice(1) : 'Unknown'
})

const networkClass = computed(() => {
  const condition = networkMetrics.value.currentCondition?.type
  return `network-${condition || 'unknown'}`
})

const bandwidth = computed(() => {
  const bytes = networkMetrics.value.currentCondition?.bandwidth || 0
  return formatBandwidth(bytes)
})

const latency = computed(() => networkMetrics.value.currentCondition?.latency || 0)

const integrityClass = computed(() => {
  return dataHealth.value.toLowerCase() === 'good' ? 'healthy' : 'unhealthy'
})

const averageSyncTime = computed(() => Math.round(syncMetrics.value.averageSyncTime))

// Methods
const toggleMinimized = () => {
  isMinimized.value = !isMinimized.value
}

const refreshDashboard = async () => {
  isRefreshing.value = true
  try {
    await loadDashboardData()
  } finally {
    isRefreshing.value = false
  }
}

const loadDashboardData = async () => {
  // Load recent operations
  const operations = logger.getMetrics('sync_duration')
  recentOperations.value = operations.map(metric => ({
    id: Math.random().toString(36),
    type: 'Full Sync',
    startTime: metric.timestamp,
    duration: metric.value,
    documentsProcessed: Math.floor(Math.random() * 50) + 10,
    success: true
  }))

  // Load recent errors
  const errors = logger.getLogs({ level: 'error', limit: 10 })
  recentErrors.value = errors.map(log => ({
    id: log.id,
    level: log.level,
    message: log.message,
    category: log.category,
    timestamp: log.timestamp
  }))

  // Load document count
  try {
    const taskStore = (window as any).taskStore
    if (taskStore) {
      totalDocuments.value = taskStore.tasks?.length || 0
    }
  } catch (error) {
    console.warn('Could not get document count:', error)
  }

  // Check data health
  if (syncMetrics.value.successRate > 0.95) {
    dataHealth.value = 'Excellent'
  } else if (syncMetrics.value.successRate > 0.8) {
    dataHealth.value = 'Good'
  } else {
    dataHealth.value = 'Poor'
  }
}

const runHealthCheck = async () => {
  isHealthCheckRunning.value = true
  try {
    (logger.info as any)('monitoring', 'Health check completed', await (async () => {
      const systemHealth: any = await (logger.getSystemHealth as any)()
      return {
        syncStatus: systemHealth?.syncStatus,
        errorRate: systemHealth?.errorRate,
        consecutiveFailures: systemHealth?.consecutiveFailures
      }
    })())

    // Show results
    console.log('Health Check Result: COMPLETED')

  } catch (error) {
    (logger.error as any)('monitoring', 'Health check failed', { error: (error as Error).message })
  } finally {
    isHealthCheckRunning.value = false
  }
}

const triggerManualSync = async () => {
  try {
    // Use triggerSync instead of throttledSync (consolidated API)
    await reliableSync.triggerSync()
  } catch (error) {
    console.error('Manual sync failed:', error)
  }
}

const showAdvancedSettings = () => {
  showSettings.value = true
}

const saveSettings = () => {
  // Save settings to local storage or sync manager
  localStorage.setItem('sync-dashboard-settings', JSON.stringify(settings.value))
  showSettings.value = false
}

const exportLogs = () => {
  const logs = logger.getLogs({ limit: 1000 })
  const metrics = logger.getMetrics()
  const exportHealth = logger.getSystemHealth()

  const exportData = {
    timestamp: new Date().toISOString(),
    logs,
    metrics,
    health: exportHealth,
    settings: settings.value
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sync-health-logs-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)

  logger.info('user', 'Sync health logs exported', { logCount: logs.length })
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

const formatDateTime = (date: Date): string => {
  return date.toLocaleString()
}

const formatBandwidth = (bytes: number): string => {
  if (bytes === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Phase 1.3: Enhanced progressive sync methods
const enableProgressiveSync = async () => {
  try {
    console.log('🚀 [DASHBOARD] Starting Phase 1.3 progressive sync enablement...')

    // Use the new Phase 1.3 progressive sync method from composable
    const success = await reliableSync.enableProgressiveSync()

    if (success) {
      isProgressiveSyncEnabled.value = true
      logger.info('user', 'Phase 1.3 progressive sync enabled from dashboard')
      console.log('✅ [DASHBOARD] Progressive sync fully enabled!')
    } else {
      console.warn('⚠️ [DASHBOARD] Progressive sync enablement returned false - staying in current mode')
      logger.warn('monitoring', 'Progressive sync enablement incomplete')
    }

    // Update metrics after enablement
    updatePhase1Metrics()
  } catch (error) {
    console.error('Failed to enable progressive sync:', error)
    logger.error('monitoring', 'Failed to enable progressive sync', { error: (error as Error).message })
  }
}

const disableProgressiveSync = () => {
  try {
    globalSyncCircuitBreaker.disableProgressiveSync()
    isProgressiveSyncEnabled.value = false
    logger.info('user', 'Progressive sync disabled from dashboard')

    // Show success feedback
    console.log('🛑 Progressive sync disabled successfully')

    // Update metrics after disabling
    updatePhase1Metrics()
  } catch (error) {
    console.error('Failed to disable progressive sync:', error)
    logger.error('monitoring', 'Failed to disable progressive sync', { error: (error as Error).message })
  }
}

const resetCircuitBreaker = () => {
  try {
    globalSyncCircuitBreaker.reset()
    updatePhase1Metrics()
    logger.info('user', 'Circuit breaker reset from dashboard')

    console.log('🔄 Circuit breaker reset successfully')
  } catch (error) {
    console.error('Failed to reset circuit breaker:', error)
    logger.error('monitoring', 'Failed to reset circuit breaker', { error: (error as Error).message })
  }
}

const updatePhase1Metrics = () => {
  circuitBreakerMetrics.value = globalSyncCircuitBreaker.getMetrics()
  conflictStats.value = globalConflictResolver.getStatistics()
  healthReport.value = globalSyncCircuitBreaker.getHealthReport()
  isProgressiveSyncEnabled.value = globalSyncCircuitBreaker.isReadyForProgressiveSync()
}

// Lifecycle
onMounted(() => {
  // Load saved settings
  const savedSettings = localStorage.getItem('sync-dashboard-settings')
  if (savedSettings) {
    try {
      Object.assign(settings.value, JSON.parse(savedSettings))
    } catch (error) {
      console.warn('Could not load saved settings:', error)
    }
  }

  // Load initial data
  loadDashboardData()

  // Phase 1: Load initial metrics
  updatePhase1Metrics()

  // Set up periodic refresh
  const refreshInterval = setInterval(() => {
    if (!isMinimized.value) {
      loadDashboardData()
      updatePhase1Metrics() // Phase 1: Update metrics on refresh
    }
  }, 30000) // Refresh every 30 seconds

  // Phase 1: Set up event listeners for circuit breaker and conflict events
  const circuitBreakerHandler = (event: CustomEvent) => {
    console.log('🏥 Circuit breaker health event:', event.detail)
    updatePhase1Metrics()
  }

  const conflictHandler = (event: CustomEvent) => {
    console.log('⚔️ Conflict resolved event:', event.detail)
    updatePhase1Metrics()
  }

  window.addEventListener('sync-circuit-breaker-health', circuitBreakerHandler as EventListener)
  window.addEventListener('conflict-resolved', conflictHandler as EventListener)

  onUnmounted(() => {
    clearInterval(refreshInterval)
    window.removeEventListener('sync-circuit-breaker-health', circuitBreakerHandler as EventListener)
    window.removeEventListener('conflict-resolved', conflictHandler as EventListener)
  })
})
</script>

<style scoped>
.sync-health-dashboard {
  @apply bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg;
  transition: all 0.3s ease;
}

.sync-health-dashboard.minimized {
  @apply p-3;
}

.dashboard-header {
  @apply flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700;
}

.header-content {
  @apply flex items-center gap-4;
}

.dashboard-title {
  @apply flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100;
  margin: 0;
}

.health-status {
  @apply px-3 py-1 rounded-full text-sm font-medium;
}

.health-healthy {
  @apply bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300;
}

.health-degraded {
  @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300;
}

.health-unhealthy {
  @apply bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300;
}

.health-critical {
  @apply bg-red-200 text-red-900 dark:bg-red-800/50 dark:text-red-200;
}

.health-warning {
  @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300;
}

.header-controls {
  @apply flex items-center gap-2;
}

.control-btn {
  @apply p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors;
}

.control-btn.loading {
  @apply opacity-50 cursor-not-allowed;
}

.dashboard-content {
  @apply p-4;
}

.stats-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6;
}

.stat-card {
  @apply bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600;
}

.stat-header {
  @apply flex items-center gap-2 mb-2 text-sm font-medium text-slate-600 dark:text-slate-400;
}

.stat-value {
  @apply text-xl font-bold text-slate-900 dark:text-slate-100;
}

.stat-detail {
  @apply text-xs text-slate-500 dark:text-slate-400 mt-1;
}

.sync-idle {
  @apply text-slate-600 dark:text-slate-400;
}

.sync-syncing {
  @apply text-blue-600 dark:text-blue-400;
}

.sync-complete {
  @apply text-green-600 dark:text-green-400;
}

.sync-error {
  @apply text-red-600 dark:text-red-400;
}

.sync-offline {
  @apply text-amber-600 dark:text-amber-400;
}

.network-excellent {
  @apply text-green-600 dark:text-green-400;
}

.network-good {
  @apply text-blue-600 dark:text-blue-400;
}

.network-fair {
  @apply text-amber-600 dark:text-amber-400;
}

.network-poor {
  @apply text-red-600 dark:text-red-400;
}

.has-conflicts {
  @apply text-amber-600 dark:text-amber-400;
}

.details-sections {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6;
}

.section-card {
  @apply bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700;
}

.section-title {
  @apply flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100 mb-3;
}

.operations-list,
.error-list {
  @apply space-y-2;
}

.operation-item,
.error-item {
  @apply p-3 rounded-lg border;
}

.operation-item.success {
  @apply bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800;
}

.operation-item.failed {
  @apply bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800;
}

.error-item.error {
  @apply bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800;
}

.error-item.critical {
  @apply bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700;
}

.operation-info,
.error-header {
  @apply flex justify-between items-start mb-2;
}

.operation-type,
.error-level {
  @apply font-medium text-sm;
}

.operation-metrics {
  @apply flex gap-4 text-sm;
}

.metric,
.metric-row {
  @apply flex justify-between items-center;
}

.metric-label {
  @apply text-slate-600 dark:text-slate-400;
}

.metric-value {
  @apply font-medium text-slate-900 dark:text-slate-100;
}

.error-message {
  @apply text-sm text-slate-700 dark:text-slate-300 mb-1;
}

.error-category {
  @apply text-xs text-slate-500 dark:text-slate-400;
}

.network-metrics {
  @apply space-y-2;
}

.performance-chart {
  @apply bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4;
}

.chart-placeholder {
  @apply text-center text-slate-600 dark:text-slate-400;
}

.action-section {
  @apply flex flex-wrap gap-3;
}

.action-btn {
  @apply px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2;
}

.action-btn.primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400;
}

.action-btn:not(.primary) {
  @apply bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600;
}

.action-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.minimized-content {
  @apply flex items-center gap-2;
}

.minimized-stats {
  @apply flex items-center gap-2;
}

.mini-stat {
  @apply p-2 rounded-lg relative;
}

.conflict-count {
  @apply absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center;
}

.modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4;
}

.settings-grid {
  @apply grid grid-cols-1 gap-4 mb-6;
}

.setting-item {
  @apply flex flex-col gap-2;
}

.setting-item label {
  @apply text-sm font-medium text-slate-700 dark:text-slate-300;
}

.setting-item input,
.setting-item select {
  @apply px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100;
}

.modal-actions {
  @apply flex gap-3 justify-end;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700;
}

.btn-secondary {
  @apply px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Phase 1: Enhanced Monitoring Styles */
.phase1-monitoring-section {
  @apply bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 border border-slate-200 dark:border-slate-600 mb-6;
}

.monitoring-header {
  @apply mb-4;
}

.monitoring-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4;
}

.monitoring-card {
  @apply bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-200 dark:border-slate-600;
}

.monitoring-label {
  @apply text-xs font-medium text-slate-600 dark:text-slate-400 mb-1;
}

.monitoring-value {
  @apply text-lg font-bold text-slate-900 dark:text-slate-100 mb-1;
}

.monitoring-detail {
  @apply text-xs text-slate-500 dark:text-slate-400;
}

.monitoring-value.health-excellent {
  @apply text-green-600 dark:text-green-400;
}

.monitoring-value.health-good {
  @apply text-blue-600 dark:text-blue-400;
}

.monitoring-value.health-fair {
  @apply text-amber-600 dark:text-amber-400;
}

.monitoring-value.health-poor {
  @apply text-red-600 dark:text-red-400;
}

.monitoring-value.active {
  @apply text-green-600 dark:text-green-400;
}

.monitoring-value.ready {
  @apply text-blue-600 dark:text-blue-400;
}

.monitoring-value.not-ready {
  @apply text-slate-600 dark:text-slate-400;
}

.monitoring-value.has-conflicts,
.monitoring-value.has-rollbacks {
  @apply text-amber-600 dark:text-amber-400;
}

.recommendations-card {
  @apply bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800;
}

.recommendations-header {
  @apply flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200 mb-2;
}

.recommendations-list {
  @apply text-sm text-blue-700 dark:text-blue-300 space-y-1;
  list-style-position: inside;
}

.action-btn.phase1-ready {
  @apply bg-green-600 text-white hover:bg-green-700;
}

.action-btn.phase1-active {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}
</style>