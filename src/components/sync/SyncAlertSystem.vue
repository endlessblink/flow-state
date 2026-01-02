<template>
  <div class="sync-alert-container">
    <!-- Critical Error Alerts -->
    <Transition
      v-for="alert in criticalAlerts"
      :key="alert.id"
      name="alert"
      appear
    >
      <div
        class="alert critical"
        :class="{ 'persistent': alert.persistent }"
        @click="handleAlertClick(alert)"
      >
        <div class="alert-content">
          <AlertCircle :size="20" class="alert-icon critical" />
          <div class="alert-text">
            <div class="alert-title">
              {{ alert.title }}
            </div>
            <div class="alert-message">
              {{ alert.message }}
            </div>
            <div v-if="alert.recoveryActions && alert.recoveryActions.length > 0" class="alert-actions">
              <button
                v-for="action in alert.recoveryActions"
                :key="action.id"
                class="action-btn"
                :class="action.type"
                @click.stop="handleRecoveryAction(action, alert)"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
          <button
            class="dismiss-btn"
            :title="alert.persistent ? 'Cannot dismiss critical alert' : 'Dismiss'"
            :disabled="alert.persistent"
            @click.stop="dismissAlert(alert)"
          >
            <X :size="16" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Warning Alerts -->
    <Transition
      v-for="alert in warningAlerts"
      :key="alert.id"
      name="alert"
      appear
    >
      <div
        class="alert warning"
        @click="handleAlertClick(alert)"
      >
        <div class="alert-content">
          <AlertTriangle :size="18" class="alert-icon warning" />
          <div class="alert-text">
            <div class="alert-title">
              {{ alert.title }}
            </div>
            <div class="alert-message">
              {{ alert.message }}
            </div>
          </div>
          <button
            class="dismiss-btn"
            title="Dismiss"
            @click.stop="dismissAlert(alert)"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Info Alerts -->
    <Transition
      v-for="alert in infoAlerts"
      :key="alert.id"
      name="alert"
      appear
    >
      <div
        class="alert info"
        @click="handleAlertClick(alert)"
      >
        <div class="alert-content">
          <Info :size="16" class="alert-icon info" />
          <div class="alert-text">
            <div class="alert-message">
              {{ alert.message }}
            </div>
          </div>
          <button
            class="dismiss-btn"
            title="Dismiss"
            @click.stop="dismissAlert(alert)"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Alert Summary Badge -->
    <div v-if="showSummary && totalAlerts > 0" class="alert-summary" @click="showAllAlerts = !showAllAlerts">
      <div class="summary-content">
        <AlertCircle :size="16" />
        <span class="summary-count">{{ totalAlerts }}</span>
        <span class="summary-text">Alerts</span>
      </div>
    </div>

    <!-- Expanded Alerts Panel -->
    <Transition name="slide-down">
      <div v-if="showAllAlerts && allAlerts.length > 0" class="alerts-panel">
        <div class="panel-header">
          <h3>Sync Alerts</h3>
          <button
            class="clear-btn"
            :disabled="allAlerts.length === 0"
            @click="clearAllAlerts"
          >
            Clear All
          </button>
        </div>
        <div class="alerts-list">
          <div
            v-for="alert in allAlerts"
            :key="alert.id"
            class="panel-alert"
            :class="alert.level"
            @click="handleAlertClick(alert)"
          >
            <div class="panel-alert-content">
              <component
                :is="getAlertIcon(alert.level)"
                :size="16"
                class="panel-alert-icon"
              />
              <div class="panel-alert-text">
                <div class="panel-alert-title">
                  {{ alert.title }}
                </div>
                <div class="panel-alert-message">
                  {{ alert.message }}
                </div>
                <div class="panel-alert-time">
                  {{ formatRelativeTime(alert.timestamp) }}
                </div>
              </div>
              <button
                class="panel-dismiss-btn"
                @click.stop="dismissAlert(alert)"
              >
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, readonly } from 'vue'
import { AlertCircle, AlertTriangle, AlertCircle as Info, X, RefreshCw as _RefreshCw, Database as _Database, Wifi as _Wifi, Shield as _Shield } from 'lucide-vue-next'
import { useReliableSyncManager } from '@/composables/useReliableSyncManager'
import { getLogger } from '@/utils/productionLogger'

interface RecoveryAction {
  id: string
  label: string
  type: 'primary' | 'secondary'
  action: () => void | Promise<void>
  description?: string
}

interface SyncAlert {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  persistent?: boolean
  autoDismiss?: number
  recoveryActions?: RecoveryAction[]
  category?: 'sync' | 'network' | 'database' | 'security' | 'performance'
  data?: unknown
}

interface Props {
  syncManager?: any // Allow dependency injection for testing/stories
}

const props = defineProps<Props>()

const reliableSync = props.syncManager || useReliableSyncManager()
const logger = getLogger()

// Reactive state
const alerts = ref<SyncAlert[]>([])
const showAllAlerts = ref(false)
const showSummary = ref(true)

// Computed properties
const criticalAlerts = computed(() => alerts.value.filter(alert => alert.level === 'critical'))
const warningAlerts = computed(() => alerts.value.filter(alert => alert.level === 'warning'))
const infoAlerts = computed(() => alerts.value.filter(alert => alert.level === 'info'))
const allAlerts = computed(() => [...alerts.value].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()))
const totalAlerts = computed(() => alerts.value.length)

// Methods
const addAlert = (alert: Omit<SyncAlert, 'id' | 'timestamp'>): string => {
  const alertId = generateAlertId()
  const newAlert: SyncAlert = {
    id: alertId,
    timestamp: new Date(),
    autoDismiss: alert.level === 'info' ? 5000 : undefined,
    ...alert
  }

  alerts.value.push(newAlert)

  // Log alert
  const logLevel = alert.level === 'critical' ? 'critical' : alert.level === 'warning' ? 'warn' : 'info'
  const logMethod = logger[logLevel as keyof typeof logger]
  if (typeof logMethod === 'function') {
    (logMethod as (cat: string, title: string, data: Record<string, unknown>) => void)('alert', alert.title, {
      alertId,
      message: alert.message,
      category: alert.category || 'sync',
      level: alert.level,
      data: alert.data as Record<string, unknown>
    })
  }

  // Auto-dismiss for non-critical alerts
  if (newAlert.autoDismiss) {
    setTimeout(() => {
      dismissAlert(newAlert)
    }, newAlert.autoDismiss)
  }

  return alertId
}

const dismissAlert = (alert: SyncAlert): void => {
  const index = alerts.value.findIndex(a => a.id === alert.id)
  if (index > -1) {
    alerts.value.splice(index, 1)
  }

  logger.info('user', 'Alert dismissed by user', { alertId: alert.id })
}

const clearAllAlerts = (): void => {
  alerts.value = []
  logger.info('user', 'All alerts cleared', {})
}

const handleAlertClick = (alert: SyncAlert): void => {
  logger.info('user', 'Alert clicked', { alertId: alert.id })
}

const handleRecoveryAction = async (action: RecoveryAction, alert: SyncAlert): Promise<void> => {
  try {
    logger.info('user', 'Recovery action triggered', {
      alertId: alert.id,
      actionId: action.id,
      actionLabel: action.label
    })

    await action.action()

    // Dismiss alert after successful recovery action
    if (!alert.persistent) {
      setTimeout(() => {
        dismissAlert(alert)
      }, 1000)
    }
  } catch (error) {
    logger.error('user', 'Recovery action failed', {
      alertId: alert.id,
      actionId: action.id,
      error: (error as Error).message
    })
  }
}

const getAlertIcon = (level: SyncAlert['level']) => {
  switch (level) {
    case 'critical': return AlertCircle
    case 'warning': return AlertTriangle
    case 'info': return Info
    default: return Info
  }
}

// Auto-alerts from sync system
const setupAutoAlerts = () => {
  // Watch for sync errors
  watch(() => reliableSync.error.value, (error, oldError) => {
    if (error && error !== oldError) {
      addAlert({
        level: 'critical',
        title: 'Sync Error',
        message: error,
        category: 'sync',
        persistent: true,
        recoveryActions: [
          {
            id: 'retry-sync',
            label: 'Retry Sync',
            type: 'primary',
            action: async () => {
              await reliableSync.triggerSync()
            },
            description: 'Attempt to trigger another sync operation'
          },
          {
            id: 'clear-errors',
            label: 'Clear Errors',
            type: 'secondary',
            action: () => {
              if (reliableSync.clearSyncErrors) {
                reliableSync.clearSyncErrors()
              }
            },
            description: 'Clear sync error state'
          }
        ]
      })
    }
  })

  // Watch for conflicts
  watch(() => reliableSync.conflicts.value, (conflicts, oldConflicts) => {
    const newConflicts = conflicts.filter((c: any) =>
      !oldConflicts.some((oc: any) => oc.documentId === c.documentId)
    )

    if (newConflicts.length > 0) {
      addAlert({
        level: 'warning',
        title: `Sync Conflicts Detected`,
        message: `${newConflicts.length} sync conflict(s) detected. Review the conflicts to ensure data consistency.`,
        category: 'sync',
        recoveryActions: [
          {
            id: 'view-conflicts',
            label: 'View Conflicts',
            type: 'primary',
            action: () => {
              // Would open conflict resolution UI
              console.log('Open conflict resolution UI')
            }
          },
          {
            id: 'auto-resolve',
            label: 'Auto-Resolve',
            type: 'secondary',
            action: () => {
              // Trigger auto-resolution
              newConflicts.forEach((conflict: any) => {
                if (conflict.autoResolvable) {
                  console.log('Auto-resolving conflict:', conflict.documentId)
                }
              })
            }
          }
        ]
      })
    }
  })

  // Watch for offline status
  watch(() => reliableSync.isOnline.value, (isOnline, wasOnline) => {
    if (!isOnline && wasOnline) {
      addAlert({
        level: 'warning',
        title: 'Connection Lost',
        message: 'Network connection lost. Switching to offline mode. Your changes will be synced when you reconnect.',
        category: 'network',
        autoDismiss: 8000
      })
    }
  })

  // Monitor sync health
  const monitorSyncHealth = () => {
    const health = reliableSync.getSyncHealth()
    const lastSuccessfulSync = (health as { lastSuccessfulSync?: Date }).lastSuccessfulSync

    if (lastSuccessfulSync) {
      const timeSinceLastSync = Date.now() - lastSuccessfulSync.getTime()
      const hoursSinceLastSync = timeSinceLastSync / (1000 * 60 * 60)

      if (hoursSinceLastSync > 24) {
        addAlert({
          level: 'warning',
          title: 'Sync Delayed',
          message: `Last successful sync was ${formatRelativeTime(lastSuccessfulSync)}. Consider checking your connection.`,
          category: 'performance',
          recoveryActions: [
            {
              id: 'force-sync',
              label: 'Force Sync Now',
              type: 'primary',
              action: () => reliableSync.triggerSync()
            }
          ]
        })
      }
    }
  }

  // Start health monitoring
  const healthInterval = setInterval(monitorSyncHealth, 60000) // Every minute

  onUnmounted(() => {
    clearInterval(healthInterval)
  })
}

const generateAlertId = (): string => {
  return 'alert_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'Just now'
}

// Expose alert system
defineExpose({
  addAlert,
  dismissAlert,
  clearAllAlerts,
  alerts: readonly(alerts),
  criticalAlerts: readonly(criticalAlerts),
  warningAlerts: readonly(warningAlerts),
  infoAlerts: readonly(infoAlerts)
})

// Initialize auto-alerts
onMounted(() => {
  setupAutoAlerts()

  // Add initial connection status alert
  setTimeout(() => {
    if (!reliableSync.isOnline.value) {
      addAlert({
        level: 'warning',
        title: 'Offline Mode',
        message: 'Currently running in offline mode. Changes will be synced when connection is restored.',
        category: 'network'
      })
    }
  }, 2000)
})
</script>

<style scoped>
.sync-alert-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  max-width: 400px;
}

.alert {
  position: relative;
  background: rgba(20, 20, 20, 0.36);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg);
  margin-bottom: var(--space-3);
  transition: all 0.3s var(--spring-smooth);
  cursor: pointer;
  overflow: hidden;
}

.alert:hover {
  background: rgba(30, 30, 30, 0.45);
  border-color: var(--glass-border-heavy);
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

.alert.critical {
  border-color: var(--danger-border-strong);
}

.alert.warning {
  border-color: var(--status-in-progress-border);
}

.alert.info {
  border-color: var(--status-planned-border);
}

.alert.persistent {
  box-shadow: 0 0 0 2px var(--danger-bg-medium);
}

.alert-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
}

.alert-icon {
  flex-shrink: 0;
  margin-top: var(--space-1);
}

.alert-icon.critical {
  color: #ef4444;
}

.alert-icon.warning {
  color: #f59e0b;
}

.alert-icon.info {
  color: #3b82f6;
}

.alert-text {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.alert-message {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.alert-actions {
  display: flex;
  gap: var(--space-2);
}

.action-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  transition: background-color 0.2s;
  border: none;
  cursor: pointer;
}

.action-btn.primary {
  background: var(--brand-primary);
  color: white;
}

.action-btn.primary:hover {
  background: var(--brand-hover);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.dismiss-btn {
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.dismiss-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.dismiss-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.alert-summary {
  background: rgba(20, 20, 20, 0.36);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  padding: var(--space-3);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: all 0.2s var(--spring-smooth);
}

.alert-summary:hover {
  background: rgba(30, 30, 30, 0.45);
  transform: scale(1.05);
}

.summary-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.summary-count {
  background: var(--color-danger);
  color: white;
  font-size: var(--font-size-xs);
  font-weight: var(--font-bold);
  border-radius: var(--radius-full);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary-text {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

/* Expanded Panel */
.alerts-panel {
  background: rgba(20, 20, 20, 0.36);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-xl);
  margin-bottom: var(--space-4);
  max-height: 480px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--glass-border);
}

.panel-header h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.clear-btn {
  padding: var(--space-1) var(--space-3);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  transition: all 0.2s;
}

.clear-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.alerts-list {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.panel-alert {
  display: flex;
  items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: all 0.2s;
}

.panel-alert:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--glass-border-heavy);
}

.panel-alert.critical {
  border-color: var(--danger-border-medium);
}

.panel-alert.warning {
  border-color: var(--status-in-progress-border);
}

.panel-alert.info {
  border-color: var(--status-planned-border);
}

.panel-alert-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
}

.panel-alert-icon {
  flex-shrink: 0;
}

.panel-alert-text {
  flex: 1;
  min-width: 0;
}

.panel-alert-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.panel-alert-message {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.panel-alert-time {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.panel-dismiss-btn {
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

/* Transitions */
.alert-enter-active,
.alert-leave-active {
  transition: all 0.3s ease;
}

.alert-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.alert-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>