<script setup lang="ts">
/**
 * HealthDashboard.vue
 *
 * A distinctive, production-grade health dashboard for codebase metrics.
 * Features glass morphism, animated gradients, and responsive grid layout.
 *
 * Design Philosophy:
 * - Dark theme with GitHub-dark inspired colors
 * - Glass morphism with subtle depth
 * - Animated status indicators
 * - High contrast for accessibility
 */

import { ref, computed, onMounted } from 'vue'

// Types
interface HealthMetric {
  id: string
  label: string
  value: number
  max: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  icon: string
  trend?: 'up' | 'down' | 'stable'
  issues?: string[]
}

interface HealthIssue {
  metric: string
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
}

// State
const isScanning = ref(false)
const scanProgress = ref(0)
const lastScanTime = ref<Date | null>(null)
const overallScore = ref(0)
const expandedMetric = ref<string | null>(null)

// Mock data - in production, this would come from actual health checks
const metrics = ref<HealthMetric[]>([
  {
    id: 'typescript',
    label: 'TS Errors',
    value: 0,
    max: 0,
    unit: 'errors',
    status: 'healthy',
    icon: 'typescript',
    trend: 'stable',
    issues: []
  },
  {
    id: 'eslint',
    label: 'ESLint',
    value: 3,
    max: 50,
    unit: 'issues',
    status: 'healthy',
    icon: 'eslint',
    trend: 'down',
    issues: ['Prefer const over let in useCanvas.ts:45']
  },
  {
    id: 'deadcode',
    label: 'Dead Code',
    value: 12,
    max: 100,
    unit: 'items',
    status: 'warning',
    icon: 'trash',
    trend: 'up',
    issues: ['Unused function: oldHandler', 'Unused import: legacy']
  },
  {
    id: 'tests',
    label: 'Tests',
    value: 47,
    max: 50,
    unit: 'passing',
    status: 'healthy',
    icon: 'test',
    trend: 'stable',
    issues: []
  },
  {
    id: 'coverage',
    label: 'Coverage',
    value: 68,
    max: 100,
    unit: '%',
    status: 'warning',
    icon: 'coverage',
    trend: 'up',
    issues: ['Low coverage in canvas/ directory']
  },
  {
    id: 'bundle',
    label: 'Bundle',
    value: 245,
    max: 500,
    unit: 'KB',
    status: 'healthy',
    icon: 'package',
    trend: 'stable',
    issues: []
  },
  {
    id: 'deps',
    label: 'Deps',
    value: 2,
    max: 10,
    unit: 'outdated',
    status: 'warning',
    icon: 'deps',
    trend: 'stable',
    issues: ['vue-flow: 1.38.0 -> 1.40.0', 'pinia: 2.2.0 -> 2.3.0']
  },
  {
    id: 'build',
    label: 'Build',
    value: 1.2,
    max: 5,
    unit: 'sec',
    status: 'healthy',
    icon: 'build',
    trend: 'down',
    issues: []
  }
])

const issues = ref<HealthIssue[]>([])

// Computed
const overallStatus = computed(() => {
  if (overallScore.value >= 85) return 'healthy'
  if (overallScore.value >= 60) return 'warning'
  return 'critical'
})

const statusLabel = computed(() => {
  if (overallScore.value >= 85) return 'Excellent'
  if (overallScore.value >= 70) return 'Good'
  if (overallScore.value >= 50) return 'Needs Attention'
  return 'Critical'
})

const formattedLastScan = computed(() => {
  if (!lastScanTime.value) return 'Never'
  const diff = Date.now() - lastScanTime.value.getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return lastScanTime.value.toLocaleTimeString()
})

// Methods
function getMetricPercentage(metric: HealthMetric): number {
  if (metric.id === 'tests' || metric.id === 'coverage') {
    return (metric.value / metric.max) * 100
  }
  // For error/issue counts, invert (0 errors = 100%)
  if (metric.max === 0) return 100
  return Math.max(0, 100 - (metric.value / metric.max) * 100)
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy': return 'var(--status-done-text)'
    case 'warning': return 'var(--status-in-progress-text)'
    case 'critical': return 'var(--color-priority-high)'
    default: return 'var(--text-muted)'
  }
}

function getTrendIcon(trend?: string): string {
  switch (trend) {
    case 'up': return '\u2191'
    case 'down': return '\u2193'
    default: return '\u2192'
  }
}

function toggleExpand(metricId: string) {
  expandedMetric.value = expandedMetric.value === metricId ? null : metricId
}

async function runScan() {
  isScanning.value = true
  scanProgress.value = 0

  // Simulate scanning with progress
  for (let i = 0; i <= 100; i += 2) {
    await new Promise(r => setTimeout(r, 30))
    scanProgress.value = i
  }

  // Calculate overall score
  let totalScore = 0
  metrics.value.forEach(metric => {
    totalScore += getMetricPercentage(metric)
  })
  overallScore.value = Math.round(totalScore / metrics.value.length)

  lastScanTime.value = new Date()
  isScanning.value = false
}

// Initialize
onMounted(() => {
  // Initial score calculation
  let totalScore = 0
  metrics.value.forEach(metric => {
    totalScore += getMetricPercentage(metric)
  })
  overallScore.value = Math.round(totalScore / metrics.value.length)
})
</script>

<template>
  <div class="health-dashboard">
    <!-- Header with Status Banner -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="dashboard-title">
            <span class="title-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            Codebase Health
          </h1>
          <span class="last-scan">Last scan: {{ formattedLastScan }}</span>
        </div>

        <button
          class="scan-button"
          :class="{ scanning: isScanning }"
          :disabled="isScanning"
          @click="runScan"
        >
          <span class="scan-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              :class="{ spinning: isScanning }"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
          <span>{{ isScanning ? 'Scanning...' : 'Run Scan' }}</span>
        </button>
      </div>

      <!-- Overall Score Banner -->
      <div class="score-banner" :class="overallStatus">
        <div class="score-ring">
          <svg viewBox="0 0 100 100" class="score-svg">
            <circle
              class="score-bg"
              cx="50" cy="50" r="40"
              stroke-width="8"
              fill="none"
            />
            <circle
              class="score-progress"
              cx="50" cy="50" r="40"
              stroke-width="8"
              fill="none"
              :stroke-dasharray="`${overallScore * 2.51} 251`"
              stroke-linecap="round"
            />
          </svg>
          <div class="score-value">
            <span class="score-number">{{ overallScore }}</span>
            <span class="score-max">/100</span>
          </div>
        </div>

        <div class="score-details">
          <div class="score-label">{{ statusLabel }}</div>
          <div class="score-description">
            <span v-if="overallScore >= 85">Your codebase is in great shape!</span>
            <span v-else-if="overallScore >= 60">Some areas need attention</span>
            <span v-else>Immediate action recommended</span>
          </div>
        </div>

        <!-- Animated gradient border -->
        <div class="banner-glow"></div>
      </div>

      <!-- Progress bar during scan -->
      <div v-if="isScanning" class="scan-progress">
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: `${scanProgress}%` }"
          ></div>
        </div>
        <span class="progress-label">{{ scanProgress }}%</span>
      </div>
    </header>

    <!-- Metrics Grid -->
    <section class="metrics-grid">
      <article
        v-for="metric in metrics"
        :key="metric.id"
        class="metric-card"
        :class="[metric.status, { expanded: expandedMetric === metric.id }]"
        @click="toggleExpand(metric.id)"
      >
        <!-- Card Header -->
        <div class="metric-header">
          <div class="metric-icon" :class="metric.id">
            <!-- TypeScript -->
            <svg v-if="metric.id === 'typescript'" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h18v18H3V3zm10.71 14.29c.18.18.43.29.71.29h2.5v-1.5h-2v-4h2V10.5h-2v-1.5h-1.5v1.5h-1V12h1v3.29c0 .4.16.78.44 1.06l.35.35z"/>
            </svg>
            <!-- ESLint -->
            <svg v-else-if="metric.id === 'eslint'" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.257 9.132L12 6.264l4.743 2.868L12 12l-4.743-2.868zM12 4l-7.5 4.5V15l7.5 4.5L19.5 15V8.5L12 4z"/>
            </svg>
            <!-- Dead Code / Trash -->
            <svg v-else-if="metric.id === 'deadcode'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <!-- Tests -->
            <svg v-else-if="metric.id === 'tests'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <!-- Coverage -->
            <svg v-else-if="metric.id === 'coverage'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <!-- Bundle / Package -->
            <svg v-else-if="metric.id === 'bundle'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <!-- Dependencies -->
            <svg v-else-if="metric.id === 'deps'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
            <!-- Build -->
            <svg v-else-if="metric.id === 'build'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>

          <div class="metric-info">
            <span class="metric-label">{{ metric.label }}</span>
            <span class="metric-trend" :class="metric.trend">
              {{ getTrendIcon(metric.trend) }}
            </span>
          </div>
        </div>

        <!-- Metric Value -->
        <div class="metric-value-container">
          <span class="metric-value">{{ metric.value }}</span>
          <span class="metric-unit">{{ metric.unit }}</span>
        </div>

        <!-- Progress Bar -->
        <div class="metric-progress">
          <div class="progress-track">
            <div
              class="progress-fill"
              :style="{
                width: `${getMetricPercentage(metric)}%`,
                backgroundColor: getStatusColor(metric.status)
              }"
            ></div>
          </div>
        </div>

        <!-- Status Indicator -->
        <div class="metric-status">
          <span class="status-dot" :class="metric.status"></span>
          <span class="status-text">{{ metric.status }}</span>
        </div>

        <!-- Expand indicator -->
        <div v-if="metric.issues && metric.issues.length > 0" class="expand-hint">
          <span>{{ metric.issues.length }} issue{{ metric.issues.length > 1 ? 's' : '' }}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :class="{ rotated: expandedMetric === metric.id }"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        <!-- Card glow effect -->
        <div class="card-glow"></div>
      </article>
    </section>

    <!-- Expandable Issues Panel -->
    <Transition name="slide">
      <section
        v-if="expandedMetric"
        class="issues-panel"
      >
        <div class="issues-header">
          <h3>
            {{ metrics.find(m => m.id === expandedMetric)?.label }} Issues
          </h3>
          <button class="close-btn" @click="expandedMetric = null">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <ul class="issues-list">
          <li
            v-for="(issue, idx) in metrics.find(m => m.id === expandedMetric)?.issues"
            :key="idx"
            class="issue-item"
          >
            <span class="issue-bullet"></span>
            <span class="issue-text">{{ issue }}</span>
          </li>
          <li v-if="!metrics.find(m => m.id === expandedMetric)?.issues?.length" class="no-issues">
            No issues found
          </li>
        </ul>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
/* ===== ROOT VARIABLES ===== */
.health-dashboard {
  --dashboard-bg: #0d1117;
  --card-bg: rgba(22, 27, 34, 0.8);
  --card-border: rgba(48, 54, 61, 0.6);
  --card-hover-border: rgba(88, 166, 255, 0.4);
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;

  /* Status Colors - High Contrast */
  --color-healthy: #3fb950;
  --color-healthy-bg: rgba(63, 185, 80, 0.15);
  --color-healthy-glow: rgba(63, 185, 80, 0.4);

  --color-warning: #d29922;
  --color-warning-bg: rgba(210, 153, 34, 0.15);
  --color-warning-glow: rgba(210, 153, 34, 0.4);

  --color-critical: #f85149;
  --color-critical-bg: rgba(248, 81, 73, 0.15);
  --color-critical-glow: rgba(248, 81, 73, 0.4);

  --accent-blue: #58a6ff;
  --accent-purple: #a371f7;

  /* Layout */
  padding: var(--space-6);
  min-height: 100vh;
  background: var(--dashboard-bg);
  color: var(--text-primary);
  font-family: var(--font-sans);
}

/* ===== HEADER ===== */
.dashboard-header {
  margin-bottom: var(--space-8);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.dashboard-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  border-radius: var(--radius-lg);
  color: white;
}

.last-scan {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* ===== SCAN BUTTON ===== */
.scan-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  border: none;
  border-radius: var(--radius-lg);
  color: white;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  box-shadow: 0 4px 12px rgba(88, 166, 255, 0.3);
}

.scan-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(88, 166, 255, 0.4);
}

.scan-button:active:not(:disabled) {
  transform: translateY(0);
}

.scan-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.scan-button.scanning {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}

.scan-icon svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== SCORE BANNER ===== */
.score-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-6);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
  overflow: hidden;
}

.score-banner.healthy {
  border-color: var(--color-healthy-glow);
  background: linear-gradient(135deg, var(--color-healthy-bg), transparent);
}

.score-banner.warning {
  border-color: var(--color-warning-glow);
  background: linear-gradient(135deg, var(--color-warning-bg), transparent);
}

.score-banner.critical {
  border-color: var(--color-critical-glow);
  background: linear-gradient(135deg, var(--color-critical-bg), transparent);
}

.score-ring {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.score-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.score-bg {
  stroke: rgba(255, 255, 255, 0.1);
}

.score-progress {
  stroke: var(--color-healthy);
  transition: stroke-dasharray 0.8s var(--spring-smooth);
}

.score-banner.warning .score-progress {
  stroke: var(--color-warning);
}

.score-banner.critical .score-progress {
  stroke: var(--color-critical);
}

.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.score-number {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  font-variant-numeric: tabular-nums;
}

.score-max {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.score-details {
  flex: 1;
}

.score-label {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}

.score-banner.healthy .score-label {
  color: var(--color-healthy);
}

.score-banner.warning .score-label {
  color: var(--color-warning);
}

.score-banner.critical .score-label {
  color: var(--color-critical);
}

.score-description {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.banner-glow {
  position: absolute;
  top: -50%;
  right: -10%;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  opacity: 0.15;
  pointer-events: none;
}

.score-banner.healthy .banner-glow {
  background: radial-gradient(circle, var(--color-healthy) 0%, transparent 70%);
}

.score-banner.warning .banner-glow {
  background: radial-gradient(circle, var(--color-warning) 0%, transparent 70%);
}

.score-banner.critical .banner-glow {
  background: radial-gradient(circle, var(--color-critical) 0%, transparent 70%);
}

/* ===== SCAN PROGRESS ===== */
.scan-progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--card-bg);
  border-radius: var(--radius-md);
}

.scan-progress .progress-track {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.scan-progress .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
  border-radius: var(--radius-full);
  transition: width 0.1s linear;
}

.progress-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: right;
}

/* ===== METRICS GRID ===== */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

@media (max-width: 1200px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}

/* ===== METRIC CARD ===== */
.metric-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  overflow: hidden;
}

.metric-card:hover {
  transform: translateY(-4px);
  border-color: var(--card-hover-border);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px var(--card-hover-border);
}

.metric-card.healthy:hover {
  border-color: var(--color-healthy-glow);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 20px var(--color-healthy-glow);
}

.metric-card.warning:hover {
  border-color: var(--color-warning-glow);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 20px var(--color-warning-glow);
}

.metric-card.critical:hover {
  border-color: var(--color-critical-glow);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 20px var(--color-critical-glow);
}

.metric-card.expanded {
  border-color: var(--accent-blue);
  background: rgba(88, 166, 255, 0.08);
}

/* ===== METRIC HEADER ===== */
.metric-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.metric-icon svg {
  width: 20px;
  height: 20px;
}

.metric-icon.typescript {
  color: #3178c6;
}

.metric-icon.eslint {
  color: #4b32c3;
}

.metric-icon.deadcode {
  color: var(--color-critical);
}

.metric-icon.tests {
  color: var(--color-healthy);
}

.metric-icon.coverage {
  color: var(--accent-purple);
}

.metric-icon.bundle {
  color: var(--color-warning);
}

.metric-icon.deps {
  color: var(--accent-blue);
}

.metric-icon.build {
  color: var(--color-warning);
}

.metric-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.metric-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.metric-trend {
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.05);
}

.metric-trend.up {
  color: var(--color-healthy);
}

.metric-trend.down {
  color: var(--color-critical);
}

.metric-trend.stable {
  color: var(--text-muted);
}

/* ===== METRIC VALUE ===== */
.metric-value-container {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.metric-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.metric-unit {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* ===== METRIC PROGRESS ===== */
.metric-progress {
  margin-top: auto;
}

.metric-progress .progress-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.metric-progress .progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s var(--spring-smooth);
}

/* ===== METRIC STATUS ===== */
.metric-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.healthy {
  background: var(--color-healthy);
  box-shadow: 0 0 8px var(--color-healthy-glow);
}

.status-dot.warning {
  background: var(--color-warning);
  box-shadow: 0 0 8px var(--color-warning-glow);
}

.status-dot.critical {
  background: var(--color-critical);
  box-shadow: 0 0 8px var(--color-critical-glow);
  animation: pulse-critical 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.2); }
}

.status-text {
  font-size: var(--text-xs);
  text-transform: capitalize;
  color: var(--text-muted);
}

/* ===== EXPAND HINT ===== */
.expand-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-3);
  border-top: 1px solid var(--card-border);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.expand-hint svg {
  transition: transform var(--duration-fast) var(--spring-smooth);
}

.expand-hint svg.rotated {
  transform: rotate(180deg);
}

/* ===== CARD GLOW ===== */
.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.metric-card:hover .card-glow {
  opacity: 1;
}

/* ===== ISSUES PANEL ===== */
.issues-panel {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
  overflow: hidden;
}

.issues-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--card-border);
}

.issues-header h3 {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--card-border);
  color: var(--text-primary);
}

.issues-list {
  list-style: none;
  margin: 0;
  padding: var(--space-4) var(--space-5);
}

.issue-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.issue-item:last-child {
  border-bottom: none;
}

.issue-bullet {
  width: 6px;
  height: 6px;
  background: var(--color-warning);
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.issue-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.no-issues {
  padding: var(--space-4);
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
}

/* ===== TRANSITIONS ===== */
.slide-enter-active,
.slide-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
