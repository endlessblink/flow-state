<template>
  <div class="sync-validation-indicator" :class="statusClasses">
    <!-- Status Badge -->
    <div
      class="status-badge"
      :class="badgeClasses"
      :title="validationSummary.message"
      @click="togglePanel"
    >
      <span class="status-icon">{{ validationSummary.icon }}</span>
      <span class="status-text" v-if="showText">{{ statusText }}</span>
      <span class="count-badge" v-if="totalIssues > 0">{{ totalIssues }}</span>
    </div>

    <!-- Detailed Status Panel -->
    <transition name="slide-down">
      <div v-if="showPanel" class="validation-panel">
        <div class="panel-header">
          <h3>Sync Validation Status</h3>
          <div class="panel-controls">
            <button
              @click="performValidation"
              :disabled="isMonitoring"
              class="control-btn"
              title="Run validation now"
            >
              <RefreshCw :size="16" :class="{ 'animate-spin': isValidating }" />
            </button>
            <button
              @click="toggleMonitoring"
              :class="['control-btn', isMonitoring ? 'stop' : 'start']"
              :title="isMonitoring ? 'Stop monitoring' : 'Start monitoring'"
            >
              <Play v-if="!isMonitoring" :size="16" />
              <Square v-else :size="16" />
            </button>
            <button
              @click="clearHistory"
              class="control-btn"
              title="Clear validation history"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">Total Tasks:</span>
            <span class="stat-value">{{ totalTasks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Last Check:</span>
            <span class="stat-value">{{ lastCheckTime }}</span>
          </div>
          <div class="stat-item" v-if="validationState.lastValidation">
            <span class="stat-label">Monitoring:</span>
            <span class="stat-value" :class="{ active: isMonitoring }">
              {{ isMonitoring ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>

        <!-- Issues List -->
        <div class="issues-section" v-if="hasIssues">
          <div class="issues-header">
            <h4>Issues Detected</h4>
            <div class="issue-tabs">
              <button
                v-for="severity in ['error', 'warning', 'info']"
                :key="severity"
                @click="activeTab = severity"
                :class="['tab-btn', { active: activeTab === severity }]"
                :disabled="getIssueCount(severity) === 0"
              >
                {{ severity.charAt(0).toUpperCase() + severity.slice(1) }}
                <span class="tab-count">{{ getIssueCount(severity) }}</span>
              </button>
            </div>
          </div>

          <div class="issues-list">
            <div
              v-for="mismatch in displayedMismatches"
              :key="mismatch.id"
              :class="['issue-item', mismatch.severity]"
            >
              <div class="issue-header">
                <span class="issue-icon">{{ getIssueIcon(mismatch.severity) }}</span>
                <span class="issue-type">{{ formatIssueType(mismatch.type) }}</span>
                <span class="issue-time">{{ formatTime(mismatch.timestamp) }}</span>
              </div>
              <div class="issue-message">{{ mismatch.message }}</div>
              <div class="issue-details">
                <div class="detail-row">
                  <span class="detail-label">Expected:</span>
                  <span class="detail-value">{{ mismatch.expectedValue }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Actual:</span>
                  <span class="detail-value error">{{ mismatch.actualValue }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Views:</span>
                  <span class="detail-value">{{ mismatch.affectedViews.join(', ') }}</span>
                </div>
                <div class="detail-row" v-if="mismatch.details.resolution">
                  <span class="detail-label">Suggestion:</span>
                  <span class="detail-value suggestion">{{ mismatch.details.resolution }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Issues State -->
        <div v-else class="no-issues">
          <CheckCircle :size="48" class="success-icon" />
          <p>All views are synchronized correctly</p>
          <small>Real-time validation is {{ isMonitoring ? 'active' : 'inactive' }}</small>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  RefreshCw,
  Play,
  Square,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle
} from 'lucide-vue-next'
import { useRealTimeSyncValidation, type SyncMismatch } from '@/composables/useRealTimeSyncValidation'
import type { Task } from '@/stores/tasks'

interface Props {
  tasks: Task[] | Parameters<typeof useRealTimeSyncValidation>[0]
  showText?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  autoStart?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showText: false,
  position: 'top-right',
  autoStart: true
})

// State
const showPanel = ref(false)
const activeTab = ref<'error' | 'warning' | 'info'>('error')
const isValidating = ref(false)

// Initialize sync validation
const syncValidation = useRealTimeSyncValidation(() => props.tasks, {
  enabled: true,
  monitoringInterval: 3000,
  visualFeedback: true,
  logToConsole: true
})

// Computed properties
const {
  isMonitoring,
  validationSummary,
  validationState,
  mismatches,
  invariants,
  startMonitoring,
  stopMonitoring,
  clearHistory,
  performValidation,
  getLatestMismatches
} = syncValidation

const totalTasks = computed(() => {
  const tasks = Array.isArray(props.tasks) ? props.tasks : props.tasks.value || []
  return tasks.length
})

const hasIssues = computed(() => validationState.value.totalMismatches > 0)
const totalIssues = computed(() => validationState.value.totalMismatches)

const statusClasses = computed(() => ({
  [`position-${props.position}`]: true,
  'has-issues': hasIssues.value,
  'is-monitoring': isMonitoring.value
}))

const badgeClasses = computed(() => [
  'badge',
  `status-${validationSummary.value.status}`,
  { 'interactive': showPanel.value }
])

const statusText = computed(() => {
  if (hasIssues.value) {
    return `${totalIssues.value} issue${totalIssues.value > 1 ? 's' : ''}`
  }
  return isMonitoring.value ? 'Monitoring' : 'Valid'
})

const lastCheckTime = computed(() => {
  if (!validationState.value.lastValidation) return 'Never'
  const time = validationState.value.lastValidation
  return time.toLocaleTimeString()
})

const displayedMismatches = computed(() => {
  return getLatestMismatches(activeTab.value, 10)
})

// Methods
const togglePanel = () => {
  showPanel.value = !showPanel.value
}

const toggleMonitoring = () => {
  if (isMonitoring.value) {
    stopMonitoring()
  } else {
    startMonitoring()
  }
}

const getIssueCount = (severity: 'error' | 'warning' | 'info'): number => {
  return validationState.value[`${severity}Count` as keyof typeof validationState.value] as number
}

const getIssueIcon = (severity: string): string => {
  const icons = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  return icons[severity as keyof typeof icons] || '❓'
}

const formatIssueType = (type: string): string => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString()
}

// Auto-close panel when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.closest('.sync-validation-indicator')) {
    showPanel.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (props.autoStart && !isMonitoring.value) {
    startMonitoring()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  stopMonitoring()
})
</script>

<style scoped>
.sync-validation-indicator {
  position: fixed;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.position-top-right {
  top: 20px;
  right: 20px;
}

.position-top-left {
  top: 20px;
  left: 20px;
}

.position-bottom-right {
  bottom: 20px;
  right: 20px;
}

.position-bottom-left {
  bottom: 20px;
  left: 20px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.status-badge.interactive {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
}

.status-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.status-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.status-error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.status-info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.status-icon {
  font-size: 14px;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
}

.count-badge {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

.validation-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 420px;
  max-height: 600px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(20px);
  overflow: hidden;
}

.position-top-left .validation-panel {
  right: auto;
  left: 0;
}

.position-bottom-right .validation-panel,
.position-bottom-left .validation-panel {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 8px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.panel-controls {
  display: flex;
  gap: 4px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.start {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.control-btn.stop {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.summary-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.stat-label {
  color: var(--color-text-secondary);
}

.stat-value {
  font-weight: 600;
  color: var(--color-text-primary);
}

.stat-value.active {
  color: #10b981;
}

.issues-section {
  max-height: 400px;
  overflow-y: auto;
}

.issues-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.issues-header h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.issue-tabs {
  display: flex;
  gap: 4px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover:not(:disabled) {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.tab-btn.active {
  background: var(--color-accent);
  color: white;
}

.tab-count {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 600;
  min-width: 14px;
  text-align: center;
}

.issues-list {
  padding: 8px;
}

.issue-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.issue-item.error {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.issue-item.warning {
  border-left: 3px solid #f59e0b;
  background: rgba(245, 158, 11, 0.05);
}

.issue-item.info {
  border-left: 3px solid #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.issue-icon {
  font-size: 14px;
}

.issue-type {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.issue-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-left: auto;
}

.issue-message {
  font-size: 12px;
  color: var(--color-text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.issue-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
}

.detail-label {
  color: var(--color-text-secondary);
  min-width: 70px;
  flex-shrink: 0;
}

.detail-value {
  color: var(--color-text-primary);
  word-break: break-word;
}

.detail-value.error {
  color: #ef4444;
  font-weight: 500;
}

.detail-value.suggestion {
  color: #10b981;
  font-style: italic;
}

.no-issues {
  padding: 32px;
  text-align: center;
  color: var(--color-text-secondary);
}

.success-icon {
  color: #10b981;
  margin-bottom: 12px;
}

.no-issues p {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.no-issues small {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>