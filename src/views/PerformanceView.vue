<template>
  <div class="performance-view">
    <header class="page-header glass">
      <div class="header-content--performance">
        <h1>Performance Dashboard</h1>
        <p>System health and benchmarking suite for FlowState</p>
      </div>
      <div class="actions">
        <button 
          class="btn btn-primary glass flex items-center gap-2" 
          :disabled="isRunning" 
          aria-label="Run full performance benchmark suite"
          @click="runFullSuite"
        >
          <span>{{ isRunning ? '⚡ Running...' : '🚀 Run Full Suite' }}</span>
        </button>
      </div>
    </header>

    <div class="dashboard-grid">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="card glass score-card" :class="performanceGradeClass">
          <h3>Overall Grade</h3>
          <div class="grade-display">
            {{ performanceGrade }}
          </div>
          <p>{{ statusMessage }}</p>
        </div>

        <div class="card glass stat-card">
          <h3>Canvas Latency</h3>
          <div class="stat-value">
            {{ canvasLatency }}ms
          </div>
          <div class="stat-label">
            1000 nodes sync
          </div>
        </div>

        <div class="card glass stat-card">
          <h3>Memory Usage</h3>
          <div class="stat-value">
            {{ memoryUsage }}MB
          </div>
          <div class="stat-label">
            Heap size
          </div>
        </div>
      </div>

      <!-- Main Results Table -->
      <div class="results-container glass">
        <h2>Benchmark Results</h2>
        <div class="table-wrapper">
          <table v-if="hasResults">
            <thead>
              <tr>
                <th>Test Category</th>
                <th>Average</th>
                <th>Min/Max</th>
                <th>Throughput</th>
                <th>Success</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(result, key) in results" :key="key">
                <td class="test-name">
                  {{ result.name }}
                </td>
                <td>{{ result.averageTime.toFixed(2) }}ms</td>
                <td>{{ result.minTime.toFixed(1) }} / {{ result.maxTime.toFixed(1) }}ms</td>
                <td>{{ (result.throughput || 0).toFixed(1) }} ops/s</td>
                <td>
                  <div class="progress-bar">
                    <div class="progress" :style="{ width: result.successRate + '%' }" />
                  </div>
                  {{ Math.round(result.successRate) }}%
                </td>
                <td>
                  <span class="status-badge" :class="getStatusClass(result)">
                    {{ getStatusLabel(result) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">
            <p>No results yet. Run the benchmark suite to see metrics.</p>
          </div>
        </div>
      </div>

      <!-- Documentation/Recommendations -->
      <div class="sidebar glass">
        <h2>Recommendations</h2>
        <ul v-if="recommendations.length > 0">
          <li v-for="(rec, i) in recommendations" :key="i">
            <strong>{{ rec.type }}:</strong> {{ rec.message }}
          </li>
        </ul>
        <p v-else>
          System is performing optimally. No recommendations at this time.
        </p>

        <div class="baseline-tools">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <Zap :size="20" class="text-indigo-400" />
              Baseline Management
            </h3>
          </div>
          <button 
            class="btn btn-secondary glass w-full flex items-center justify-center gap-2"
            :disabled="!hasResults"
            aria-label="Save current results as new performance baseline"
            @click="saveAsBaseline"
          >
            <Save :size="18" />
            <span>Save as New Baseline</span>
          </button>
          <div class="footer-note">
            Baselines are stored in <code>docs/performance/</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { performanceBenchmark } from '@/utils/performanceBenchmark'

import { Zap, Save } from 'lucide-vue-next' // Import icons

import type { BenchmarkResult, BenchmarkSuite } from '@/utils/performanceBenchmark'

const results = ref<Partial<BenchmarkSuite>>({})
const isRunning = ref(false) // Renamed from isBenchmarkRunning
const currentProgress = ref(0)
const hasResults = computed(() => Object.keys(results.value).length > 0)

const runFullSuite = async () => { // Renamed from runBenchmark
  isRunning.value = true
  currentProgress.value = 0
  
  // Update progress in background
  const progressInterval = setInterval(() => {
    currentProgress.value = performanceBenchmark.currentProgress
  }, 100)

  try {
    const suiteResponse = await performanceBenchmark.runFullSuite()
    results.value = suiteResponse
  } catch (err) {
    console.error('Benchmark failed:', err)
  } finally {
    clearInterval(progressInterval)
    isRunning.value = false
    currentProgress.value = 100
  }
}

onMounted(async () => {
  const latest = await performanceBenchmark.getLatestReport()
  if (latest && (latest as { results?: Partial<BenchmarkSuite> }).results) {
    results.value = (latest as { results: Partial<BenchmarkSuite> }).results
  }
})

// Metrics helpers
const canvasLatency = computed(() => {
  if (results.value?.canvasPerformance) {
    return results.value.canvasPerformance.averageTime.toFixed(1)
  }
  return '0.0'
})

const memoryUsage = computed(() => {
  if (results.value?.memoryEfficiency?.memoryUsage) {
    return (results.value.memoryEfficiency.memoryUsage / 1024 / 1024).toFixed(1)
  }
  return '0.0'
})

const performanceGrade = computed(() => {
  if (!hasResults.value) return '-'
  // Weight the grade more towards critical UI metrics (Canvas & Render)
  const canvasTime = results.value.canvasPerformance?.averageTime || 0
  const renderTime = results.value.renderPerformance?.averageTime || 0
  const otherAvg = Object.values(results.value)
    .filter((r) => r && r.name !== 'Canvas Performance' && r.name !== 'Render Performance')
    .reduce((sum: number, r) => sum + (r?.averageTime || 0), 0) / (Object.keys(results.value).length - 2 || 1)

  const weightedAvg = (canvasTime * 0.4) + (renderTime * 0.4) + (otherAvg * 0.2)
  
  if (weightedAvg < 16) return 'A+'
  if (weightedAvg < 48) return 'A'
  if (weightedAvg < 96) return 'B'
  if (weightedAvg < 192) return 'C'
  return 'D'
})

const performanceGradeClass = computed(() => {
  const grade = performanceGrade.value
  if (grade === 'A+' || grade === 'A') return 'grade-a'
  if (grade === 'B') return 'grade-b'
  if (grade === 'C') return 'grade-c'
  return 'grade-d'
})

const statusMessage = computed(() => {
  if (!hasResults.value) return 'System status unknown'
  const grade = performanceGrade.value
  if (grade === 'A+' || grade === 'A') return 'Excellent Performance'
  if (grade === 'B') return 'Good Performance'
  return 'Performance Needs Attention'
})

const getStatusClass = (result: BenchmarkResult) => {
  // Relaxed thresholds for batch operations (Canvas)
  if (result.name === 'Canvas Performance') {
    if (result.averageTime < 100) return 'status-fast'
    if (result.averageTime < 250) return 'status-medium'
    return 'status-badge slow'
  }
  // Strict thresholds for frame-based ops (Render, Store)
  if (result.averageTime < 16) return 'status-fast'
  if (result.averageTime < 50) return 'status-medium'
  return 'status-badge slow'
}

const getStatusLabel = (result: BenchmarkResult) => {
  if (result.name === 'Canvas Performance') {
    if (result.averageTime < 100) return 'FAST'
    if (result.averageTime < 250) return 'OK'
    return 'SLOW'
  }
  if (result.averageTime < 16) return 'FAST'
  if (result.averageTime < 50) return 'OK'
  return 'SLOW'
}

const recommendations = computed(() => {
  const recs = []
  if (results.value?.canvasPerformance?.averageTime > 50) {
    recs.push({ type: 'Canvas', message: 'High latency detected with many nodes. Consider LOD optimization.' })
  }
  if (results.value?.memoryEfficiency?.memoryUsage > 200 * 1024 * 1024) {
    recs.push({ type: 'Memory', message: 'Memory usage is elevated. Check for leaks in node pooling.' })
  }
  if (results.value?.renderPerformance?.averageTime > 20) {
    recs.push({ type: 'Render', message: 'Main thread is taking too long for UI updates. Review watcher complexity.' })
  }
  return recs
})

const saveAsBaseline = () => {
  const data = JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results.value,
    environment: {
      userAgent: navigator.userAgent,
      memoryLimit: (performance as unknown as { memory?: { jsHeapSizeLimit: number } }).memory?.jsHeapSizeLimit || 'unknown'
    }
  }, null, 2)
  
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-baseline-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.performance-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text-secondary);
  height: 100vh;
  overflow-y: auto;
  scrollbar-width: auto; /* Revert to auto for better accessibility grab area */
  scrollbar-color: var(--brand-primary-alpha-50) var(--overlay-bg);
}

/* Custom scrollbar for Webkit browsers with wider handle */
.performance-view::-webkit-scrollbar {
  width: 14px;
}

.performance-view::-webkit-scrollbar-track {
  background: var(--overlay-bg);
}

.performance-view::-webkit-scrollbar-thumb {
  background: var(--brand-primary-alpha-30);
  border-radius: var(--radius-md);
  border: 3px solid transparent;
  background-clip: content-box;
}

.performance-view::-webkit-scrollbar-thumb:hover {
  background: var(--brand-primary-alpha-50);
  background-clip: content-box;
}

.glass {
  background: var(--glass-bg-tint);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) 2rem;
  margin-bottom: 2rem;
}

.header-content--performance h1 {
  margin: 0;
  font-size: var(--text-3xl);
  background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-content--performance p {
  margin: var(--space-1) 0 0;
  opacity: 0.6;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
  grid-column: 1 / -1;
}

.card {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: transform var(--duration-normal);
}

.card:hover {
  transform: translateY(-4px);
}

.card h3 {
  margin: 0;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  margin: var(--space-2) 0;
  color: var(--color-indigo);
}

.grade-display {
  font-size: 5rem;
  font-weight: 800;
  margin: var(--space-4) 0;
  line-height: 1;
  text-shadow: 0 0 30px var(--danger-bg-medium);
  color: var(--color-danger-text-bright); /* Brighter red for accessibility */
}

.grade-a { color: var(--color-success); border-color: var(--success-border-low); }
.grade-b { color: var(--color-warning); border-color: var(--warning-border-low); }
.grade-c { color: var(--color-danger); border-color: var(--danger-border-low); }
.grade-d { color: var(--color-danger); border-color: var(--danger-border-low); } /* Added for consistency */

.results-container {
  padding: var(--space-6);
}

.table-wrapper {
  margin-top: var(--space-6);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  opacity: 0.6;
  font-weight: 500;
}

td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--glass-border-faint);
}

.test-name {
  font-weight: 600;
}

.sidebar {
  padding: var(--space-6);
  height: fit-content;
}

.sidebar h2 {
  font-size: var(--space-5);
  margin-top: 0;
}

.sidebar ul {
  padding-left: var(--space-5);
  margin: var(--space-4) 0;
}

.sidebar li {
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.baseline-tools {
  margin-top: 2rem;
  padding-top: var(--space-6);
  border-top: 1px solid var(--glass-border);
}

.footer-note {
  margin-top: var(--space-4);
  font-size: var(--text-xs);
  opacity: 0.5;
}

.status-badge {
  padding: var(--space-1) 0.6rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
}

.status-fast { background: var(--success-bg-subtle); color: var(--color-success); }
.status-medium { background: var(--warning-bg-subtle); color: var(--color-warning); }
.status-badge.slow {
  background: var(--danger-bg-subtle);
  color: var(--color-danger-text-bright); /* Brighter red for contrast on dark background */
  border: 1px solid var(--danger-border-low);
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-normal);
}

.btn-primary { background: var(--brand-primary); color: white; }
.btn-primary:hover { background: var(--brand-primary-hover); }
.btn-secondary { background: var(--white-alpha-10); color: white; }
.btn-secondary:hover { background: var(--white-alpha-15); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.progress-bar {
  width: 60px;
  height: 6px;
  background: var(--glass-border);
  border-radius: var(--radius-xs);
  display: inline-block;
  margin-right: var(--space-2);
  vertical-align: middle;
}

.progress {
  height: 100%;
  background: var(--color-indigo);
  border-radius: var(--radius-xs);
}
</style>
