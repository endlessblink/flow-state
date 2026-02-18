<template>
  <div class="memory-health-dashboard">
    <!-- Header -->
    <header class="page-header glass">
      <div class="header-content">
        <h1>Memory Health Assessment</h1>
        <p>Evaluate how effectively the AI memory system captures and uses your data</p>
      </div>
      <div class="actions">
        <button
          class="btn btn-ghost"
          :disabled="isRunning"
          @click="handleRunFast"
        >
          {{ isRunning && mode === 'fast' ? 'Running...' : 'Quick Check' }}
        </button>
        <button
          class="btn btn-primary glass"
          :disabled="isRunning"
          @click="handleRunFull"
        >
          {{ isRunning && mode === 'full' ? 'Running...' : 'Full Assessment' }}
        </button>
      </div>
    </header>

    <!-- Progress bar -->
    <div v-if="isRunning" class="progress-section glass">
      <div class="progress-info">
        <span>{{ currentCheck || 'Initializing...' }}</span>
        <span>{{ progress }}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progress + '%' }" />
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-banner glass">{{ error }}</div>

    <!-- Summary Cards -->
    <div v-if="report" class="summary-cards">
      <div class="card glass score-card" :class="gradeClass">
        <h3>Memory Grade</h3>
        <div class="grade-display">{{ report.grade }}</div>
        <p>{{ gradeLabel }}</p>
      </div>

      <div class="card glass stat-card">
        <h3>Overall Score</h3>
        <div class="stat-value" :class="scoreColorClass(report.overallScore)">
          {{ report.overallScore }}
        </div>
        <p>out of 100</p>
      </div>

      <div class="card glass stat-card">
        <h3>Sections</h3>
        <div class="stat-value">{{ report.sections.length }}</div>
        <p>{{ report.mode === 'full' ? 'Full assessment' : 'Quick check' }}</p>
      </div>

      <div class="card glass stat-card">
        <h3>Duration</h3>
        <div class="stat-value stat-value--small">{{ formatDuration(report.durationMs) }}</div>
        <p>{{ formatTime(report.timestamp) }}</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isRunning" class="empty-state glass">
      <p>No assessment results yet.</p>
      <p class="empty-hint">"Quick Check" runs heuristic tests instantly. "Full Assessment" adds LLM-as-judge context utilization tests (~30s).</p>
    </div>

    <!-- Sections -->
    <div v-if="report" class="sections-list">
      <div
        v-for="section in report.sections"
        :key="section.id"
        class="section-card glass"
      >
        <div class="section-header" @click="toggleSection(section.id)">
          <div class="section-title">
            <span class="section-icon" :class="sectionStatusClass(section.score)">
              {{ sectionIcon(section.score) }}
            </span>
            <h3>{{ section.name }}</h3>
          </div>
          <div class="section-score" :class="scoreColorClass(section.score)">
            {{ section.score }}%
          </div>
        </div>

        <!-- Section progress bar -->
        <div class="section-bar-track">
          <div
            class="section-bar-fill"
            :class="barColorClass(section.score)"
            :style="{ width: section.score + '%' }"
          />
        </div>

        <!-- Checks (expanded) -->
        <div v-if="expandedSections.has(section.id)" class="checks-list">
          <div
            v-for="check in section.checks"
            :key="check.id"
            class="check-item"
          >
            <div class="check-header">
              <span class="check-status" :class="'status-' + check.status">
                {{ check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL' }}
              </span>
              <span class="check-name">{{ check.name }}</span>
              <span class="check-score" :class="scoreColorClass(check.score)">{{ check.score }}%</span>
            </div>
            <div class="check-value">{{ check.value }}</div>
            <div v-if="check.recommendation" class="check-recommendation">
              {{ check.recommendation }}
            </div>
            <div v-if="check.details?.length" class="check-details">
              <span v-for="(detail, i) in check.details" :key="i" class="detail-tag">
                {{ detail }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommendations -->
    <div v-if="report && report.recommendations.length > 0" class="recommendations-section">
      <h2>Recommendations</h2>
      <div class="recommendations-list">
        <div
          v-for="(rec, i) in report.recommendations"
          :key="i"
          class="recommendation-item glass"
          :class="'priority-' + rec.priority"
        >
          <span class="priority-badge">{{ rec.priority.toUpperCase() }}</span>
          <span class="rec-action">{{ rec.action }}</span>
        </div>
      </div>
    </div>

    <!-- History -->
    <div v-if="history.length > 1" class="history-section">
      <h2>Previous Assessments</h2>
      <div class="history-list">
        <div
          v-for="h in history.slice(1, 6)"
          :key="h.id"
          class="history-item glass"
        >
          <span class="history-grade" :class="scoreColorClass(h.overallScore)">{{ h.grade }}</span>
          <span class="history-score">{{ h.overallScore }}/100</span>
          <span class="history-mode">{{ h.mode }}</span>
          <span class="history-time">{{ formatTime(h.timestamp) }}</span>
        </div>
      </div>
      <button class="btn btn-ghost" @click="handleClearHistory">Clear History</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMemoryAssessment } from '@/composables/useMemoryAssessment'
import { getMemoryGradeColor } from '@/services/ai/memoryAssessment'

const {
  isRunning,
  progress,
  currentCheck,
  report,
  error,
  runFastAssessment,
  runFullAssessment,
  getHistory,
  clearHistory,
} = useMemoryAssessment()

const mode = ref<'fast' | 'full'>('fast')
const expandedSections = ref(new Set<string>())
const history = ref(getHistory())

// Initialize with all sections expanded
onMounted(() => {
  history.value = getHistory()
})

const gradeClass = computed(() => {
  if (!report.value) return ''
  const s = report.value.overallScore
  if (s >= 70) return 'grade-good'
  if (s >= 45) return 'grade-warn'
  return 'grade-fail'
})

const gradeLabel = computed(() => {
  if (!report.value) return ''
  const g = report.value.grade
  if (g === 'A') return 'Excellent'
  if (g === 'B') return 'Good'
  if (g === 'C') return 'Needs Attention'
  if (g === 'D') return 'Weak'
  return 'Critical'
})

function scoreColorClass(score: number): string {
  const color = getMemoryGradeColor(score)
  return `score-${color}`
}

function barColorClass(score: number): string {
  const color = getMemoryGradeColor(score)
  return `bar-${color}`
}

function sectionStatusClass(score: number): string {
  if (score >= 70) return 'icon-pass'
  if (score >= 45) return 'icon-warn'
  return 'icon-fail'
}

function sectionIcon(score: number): string {
  if (score >= 70) return '+'
  if (score >= 45) return '~'
  return '!'
}

function toggleSection(sectionId: string) {
  if (expandedSections.value.has(sectionId)) {
    expandedSections.value.delete(sectionId)
  } else {
    expandedSections.value.add(sectionId)
  }
  expandedSections.value = new Set(expandedSections.value)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return d.toLocaleDateString()
  } catch {
    return timestamp
  }
}

async function handleRunFast() {
  mode.value = 'fast'
  try {
    await runFastAssessment()
    history.value = getHistory()
    // Auto-expand all sections
    if (report.value) {
      expandedSections.value = new Set(report.value.sections.map(s => s.id))
    }
  } catch (e) {
    console.error('[MemoryHealth] Fast assessment failed:', e)
  }
}

async function handleRunFull() {
  mode.value = 'full'
  try {
    await runFullAssessment()
    history.value = getHistory()
    if (report.value) {
      expandedSections.value = new Set(report.value.sections.map(s => s.id))
    }
  } catch (e) {
    console.error('[MemoryHealth] Full assessment failed:', e)
  }
}

function handleClearHistory() {
  clearHistory()
  history.value = []
}
</script>

<style scoped>
.memory-health-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  overflow-y: auto;
  max-height: 100%;
}

/* Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

.header-content h1 {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.header-content p {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: var(--space-1) 0 0;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border: none;
}

.btn-primary {
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  backdrop-filter: blur(8px);
}

.btn-primary:hover:not(:disabled) {
  background: var(--brand-primary);
  color: var(--surface-primary);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: var(--space-2) var(--space-4);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--state-hover-bg);
  color: var(--text-primary);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Progress */
.progress-section {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-sm));
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.progress-track {
  height: 4px;
  background: var(--surface-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

/* Error */
.error-banner {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  font-size: var(--text-sm);
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}

.card {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-md));
  text-align: center;
}

.card h3 {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-2);
}

.card p {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: var(--space-1) 0 0;
}

.grade-display {
  font-size: 3rem;
  font-weight: var(--font-bold);
  line-height: 1;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.stat-value--small {
  font-size: var(--text-lg);
}

.score-card.grade-good { border-color: var(--color-success); }
.score-card.grade-good .grade-display { color: var(--color-success); }
.score-card.grade-warn { border-color: var(--color-warning); }
.score-card.grade-warn .grade-display { color: var(--color-warning); }
.score-card.grade-fail { border-color: var(--color-error); }
.score-card.grade-fail .grade-display { color: var(--color-error); }

/* Score colors */
.score-green { color: var(--color-success); }
.score-yellow { color: var(--color-warning); }
.score-red { color: var(--color-error); }

/* Empty State */
.empty-state {
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-md));
  text-align: center;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-2);
}

/* Section Cards */
.sections-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-card {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-md));
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-title h3 {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.section-icon {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
}

.icon-pass { background: rgba(46, 204, 113, 0.15); color: var(--color-success); }
.icon-warn { background: rgba(241, 196, 15, 0.15); color: var(--color-warning); }
.icon-fail { background: rgba(231, 76, 60, 0.15); color: var(--color-error); }

.section-score {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
}

.section-bar-track {
  height: 4px;
  background: var(--surface-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: var(--space-3);
}

.section-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
}

.bar-green { background: var(--color-success); }
.bar-yellow { background: var(--color-warning); }
.bar-red { background: var(--color-error); }

/* Checks */
.checks-list {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.check-item {
  padding: var(--space-2) 0;
}

.check-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.check-status {
  font-size: 10px;
  font-weight: var(--font-bold);
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
}

.status-pass { background: rgba(46, 204, 113, 0.15); color: var(--color-success); }
.status-warn { background: rgba(241, 196, 15, 0.15); color: var(--color-warning); }
.status-fail { background: rgba(231, 76, 60, 0.15); color: var(--color-error); }

.check-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  flex: 1;
}

.check-score {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.check-value {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.check-recommendation {
  font-size: var(--text-xs);
  color: var(--brand-primary);
  margin-top: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: rgba(78, 205, 196, 0.08);
  border-radius: var(--radius-sm);
}

.check-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.detail-tag {
  font-size: 10px;
  color: var(--text-tertiary);
  padding: 1px var(--space-1);
  background: var(--surface-tertiary);
  border-radius: var(--radius-sm);
}

/* Recommendations */
.recommendations-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.recommendations-section h2,
.history-section h2 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  font-size: var(--text-sm);
}

.priority-badge {
  font-size: 10px;
  font-weight: var(--font-bold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.priority-high .priority-badge { background: rgba(231, 76, 60, 0.15); color: var(--color-error); }
.priority-medium .priority-badge { background: rgba(241, 196, 15, 0.15); color: var(--color-warning); }
.priority-low .priority-badge { background: rgba(46, 204, 113, 0.15); color: var(--color-success); }

.rec-action {
  color: var(--text-secondary);
}

/* History */
.history-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  font-size: var(--text-sm);
}

.history-grade {
  font-weight: var(--font-bold);
  font-size: var(--text-lg);
}

.history-score {
  color: var(--text-secondary);
}

.history-mode {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.history-time {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}
</style>
