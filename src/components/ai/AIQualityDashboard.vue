<template>
  <div class="quality-dashboard">
    <!-- Header -->
    <header class="page-header glass">
      <div class="header-content">
        <h1>AI Quality Assessment</h1>
        <p>LLM-as-judge scoring with rule-based pre-checks (1-5 scale)</p>
      </div>
      <div class="actions">
        <button
          class="btn btn-ghost"
          :disabled="isRunning"
          @click="handleRunTests(1)"
          title="Quick check with 1 run per test"
        >
          Quick (1x)
        </button>
        <button
          class="btn btn-primary glass"
          :disabled="isRunning"
          @click="handleRunTests(3)"
        >
          {{ isRunning ? 'Running...' : 'Run All Tests (3x)' }}
        </button>
      </div>
    </header>

    <!-- Progress bar (visible during tests) -->
    <div v-if="isRunning" class="progress-section glass">
      <div class="progress-info">
        <span>Testing: {{ currentTest || 'initializing...' }}</span>
        <span>{{ progress }}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progress + '%' }" />
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="error-banner glass">
      {{ error }}
    </div>

    <!-- Summary Cards -->
    <div v-if="report" class="summary-cards">
      <div class="card glass score-card" :class="gradeClass">
        <h3>Overall Grade</h3>
        <div class="grade-display">{{ report.grade }}</div>
        <p>{{ gradeLabel }}</p>
      </div>

      <div class="card glass stat-card">
        <h3>Tests Passed</h3>
        <div class="stat-value" :class="scoreColorClass(report.averageScore)">
          {{ passedTestsCount }} of {{ report.results.length }}
        </div>
        <p>{{ passRateLabel }}</p>
      </div>

      <div class="card glass stat-card">
        <h3>Rule Checks</h3>
        <div class="stat-value" :class="rulePassRateColor">
          {{ (report.ruleCheckPassRate * 100).toFixed(0) }}%
        </div>
        <p>pass rate</p>
      </div>

      <div class="card glass stat-card">
        <h3>Provider</h3>
        <div class="stat-value stat-value--small">{{ report.provider }}</div>
        <p>{{ formatTime(report.timestamp) }}</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isRunning" class="empty-state glass">
      <h3 class="empty-title">AI Quality Assessment</h3>
      <p class="empty-desc">
        Tests your AI assistant by sending {{ testPrompts.length }} prompts across {{ new Set(testPrompts.map(t => t.category)).size }} categories,
        then judges each response against {{ rubrics.length }} quality rubrics using a second LLM call.
      </p>
      <div class="empty-details">
        <div class="empty-detail-item">
          <strong>Categories:</strong> Analytical, Priority, Assessment, Greeting, Action, Language (Hebrew), Edge Cases
        </div>
        <div class="empty-detail-item">
          <strong>Rubrics:</strong> {{ rubrics.map(r => r.name).join(', ') }}
        </div>
        <div class="empty-detail-item">
          <strong>Rule Checks:</strong> 9 deterministic checks (no JSON, no tool syntax, no field dumps, language compliance, etc.)
        </div>
        <div class="empty-detail-item">
          <strong>Multi-run:</strong> Each prompt is tested 3x (configurable) with statistical confidence intervals
        </div>
      </div>
    </div>

    <!-- Results Grid -->
    <div v-if="results.length > 0" class="results-section">
      <h2>Test Results</h2>

      <!-- Category Filter -->
      <div class="category-filter">
        <button
          v-for="cat in availableCategories"
          :key="cat"
          class="category-pill"
          :class="{ active: selectedCategory === cat }"
          @click.stop="selectedCategory = cat"
        >
          {{ cat === 'all' ? 'All' : cat.replace('_', ' ') }}
        </button>
      </div>

      <div class="results-grid">
        <div
          v-for="result in filteredResults"
          :key="result.promptId"
          class="result-card glass"
          :class="{ expanded: expandedCards.has(result.promptId) }"
          @click="toggleCard(result.promptId)"
        >
          <!-- Header: Category badge + Grade + Quick status dot -->
          <div class="result-header">
            <span class="category-badge" :class="'cat-' + result.category">
              {{ result.category }}
            </span>
            <div class="result-grade-area">
              <span class="result-grade" :class="scoreColorClass(result.overallScore)">
                {{ result.grade }}
              </span>
              <span class="result-grade-dot" :class="gradeDotClass(result.grade)"></span>
            </div>
          </div>

          <!-- Question -->
          <div class="result-question">
            <span class="question-label">Asked:</span>
            {{ result.prompt || '(empty prompt)' }}
          </div>

          <!-- AI Response Preview (first 3 lines) -->
          <div class="result-response-preview">
            <span class="preview-label">AI Response:</span>
            <div class="preview-text">{{ result.response }}</div>
          </div>

          <!-- Simple Verdict (derived from judge reasoning) -->
          <div class="result-verdict" :class="verdictClass(result)">
            {{ getSimpleVerdict(result) }}
          </div>

          <!-- Expanded content -->
          <div v-if="expandedCards.has(result.promptId)" class="expanded-content">
            <div class="expanded-section">
              <h4>Full AI Response</h4>
              <div class="response-text">{{ result.response }}</div>
            </div>

            <div v-if="result.judgeReasoning" class="expanded-section">
              <h4>Judge's Detailed Assessment</h4>
              <div class="judge-text">{{ result.judgeReasoning }}</div>
            </div>

            <!-- Expected Behavior -->
            <div v-if="getTestPromptDetails(result.promptId)" class="expanded-section">
              <h4>Test Criteria</h4>
              <div class="test-criteria">
                <div class="criteria-item">
                  <strong>Tests for:</strong>
                  {{ getTestPromptDetails(result.promptId)?.expectedBehavior }}
                </div>
                <div
                  v-if="getTestPromptDetails(result.promptId)?.antiPatterns?.length"
                  class="criteria-item anti-patterns-item"
                >
                  <strong>Anti-patterns:</strong>
                  {{ getTestPromptDetails(result.promptId)?.antiPatterns?.join(' · ') }}
                </div>
              </div>
            </div>

            <!-- Rule Check Details -->
            <div v-if="result.ruleChecks.length > 0" class="expanded-section">
              <h4>Rule Checks (Deterministic)</h4>
              <div class="rule-checks-grid">
                <div
                  v-for="rc in result.ruleChecks"
                  :key="rc.id"
                  class="rule-check-item"
                  :class="{ 'rule-passed': rc.passed, 'rule-failed': !rc.passed }"
                >
                  <span class="rule-icon">{{ rc.passed ? '\u2705' : '\u274C' }}</span>
                  <span class="rule-name">{{ rc.name }}</span>
                  <span class="rule-detail">{{ rc.detail }}</span>
                </div>
              </div>
            </div>

            <div class="expanded-section">
              <h4>Rubric Scores & Reasoning</h4>
              <div v-for="rs in result.rubricScores" :key="rs.rubricId" class="rubric-detail">
                <strong>{{ getRubricName(rs.rubricId) }} ({{ rs.score }}/5):</strong>
                {{ rs.reasoning }}
              </div>
            </div>

            <!-- Multi-run details -->
            <div v-if="result.runs && result.runs.length > 1" class="expanded-section">
              <h4>Multi-Run Breakdown</h4>
              <div class="run-breakdown-stats">
                <div class="stat-item">
                  <span class="stat-label">Runs:</span>
                  <span class="stat-value-inline">{{ result.runs.length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Average:</span>
                  <span class="stat-value-inline">{{ result.overallScore.toFixed(2) }}/5</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Std Dev:</span>
                  <span class="stat-value-inline">±{{ result.scoreStdDev.toFixed(2) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">95% CI:</span>
                  <span class="stat-value-inline">
                    [{{ result.confidenceInterval[0].toFixed(1) }}-{{ result.confidenceInterval[1].toFixed(1) }}]
                  </span>
                </div>
              </div>
              <div v-for="(run, idx) in result.runs" :key="idx" class="run-detail">
                <span class="run-label">Run {{ idx + 1 }}:</span>
                <span :class="scoreColorClass(run.overallScore)">{{ run.overallScore.toFixed(2) }}/5</span>
                <span class="run-latency">{{ run.latencyMs }}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- History -->
    <div v-if="history.length > 1" class="history-section">
      <h2>Previous Runs</h2>
      <div class="history-list">
        <div
          v-for="h in history.slice(1, 6)"
          :key="h.id"
          class="history-item glass"
        >
          <span class="history-grade" :class="scoreColorClass(h.averageScore)">
            {{ h.grade }}
          </span>
          <span class="history-score">{{ h.averageScore.toFixed(2) }}/5</span>
          <span class="history-runs">{{ h.runsPerTest }}x</span>
          <span class="history-rules" :class="h.ruleCheckPassRate >= 0.8 ? 'score-green' : 'score-yellow'">
            Rules: {{ (h.ruleCheckPassRate * 100).toFixed(0) }}%
          </span>
          <span class="history-provider">{{ h.provider }}</span>
          <span class="history-time">{{ formatTime(h.timestamp) }}</span>
        </div>
      </div>
      <button class="btn btn-ghost" @click="handleClearHistory">Clear History</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAIQualityAssessment } from '@/composables/useAIQualityAssessment'
import { getScoreColor, QUALITY_RUBRICS, TEST_PROMPTS, type TestResult } from '@/services/ai/qualityAssessment'

const {
  isRunning,
  progress,
  currentTest,
  results,
  report,
  error,
  runAllTests,
  getHistory,
  clearHistory,
  rubrics,
  testPrompts,
} = useAIQualityAssessment()

const expandedCards = ref(new Set<string>())
const history = ref(getHistory())
const selectedCategory = ref<string>('all')

const gradeClass = computed(() => {
  if (!report.value) return ''
  const g = report.value.grade
  if (g === 'A' || g === 'B') return 'grade-good'
  if (g === 'C' || g === 'D') return 'grade-warn'
  return 'grade-fail'
})

const gradeLabel = computed(() => {
  if (!report.value) return ''
  const g = report.value.grade
  if (g === 'A') return 'Excellent'
  if (g === 'B') return 'Good'
  if (g === 'C') return 'Acceptable'
  if (g === 'D') return 'Needs Work'
  return 'Poor'
})

const rulePassRateColor = computed(() => {
  if (!report.value) return ''
  const rate = report.value.ruleCheckPassRate
  if (rate >= 0.8) return 'score-green'
  if (rate >= 0.6) return 'score-yellow'
  return 'score-red'
})

const passedTestsCount = computed(() => {
  if (!report.value) return 0
  return report.value.results.filter(r => r.grade === 'A' || r.grade === 'B').length
})

const passRateLabel = computed(() => {
  if (!report.value) return ''
  const rate = (passedTestsCount.value / report.value.results.length) * 100
  return `${rate.toFixed(0)}% passed`
})

const availableCategories = computed(() => {
  const cats = new Set(results.value.map(r => r.category))
  return ['all', ...Array.from(cats).sort()]
})

const filteredResults = computed(() => {
  if (selectedCategory.value === 'all') {
    return results.value
  }
  return results.value.filter(r => r.category === selectedCategory.value)
})

function scoreColorClass(score: number): string {
  const color = getScoreColor(score)
  return `score-${color}`
}

function getRubricName(rubricId: string): string {
  const rubric = QUALITY_RUBRICS.find(r => r.id === rubricId)
  return rubric?.name || rubricId
}

function getFailedRuleChecks(result: TestResult) {
  return result.ruleChecks?.filter(rc => !rc.passed) || []
}

function getTestPromptDetails(promptId: string) {
  return TEST_PROMPTS.find(tp => tp.id === promptId)
}

function toggleCard(promptId: string) {
  if (expandedCards.value.has(promptId)) {
    expandedCards.value.delete(promptId)
  } else {
    expandedCards.value.add(promptId)
  }
  expandedCards.value = new Set(expandedCards.value)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
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

async function handleRunTests(runsPerTest: number) {
  try {
    await runAllTests({ runsPerTest })
    history.value = getHistory()
  } catch (e) {
    console.error('[AIQualityDashboard] Test run failed:', e)
  }
}

function handleClearHistory() {
  clearHistory()
  history.value = []
}

function gradeDotClass(grade: string): string {
  if (grade === 'A' || grade === 'B') return 'dot-green'
  if (grade === 'C' || grade === 'D') return 'dot-yellow'
  return 'dot-red'
}

function verdictClass(result: TestResult): string {
  if (result.grade === 'A' || result.grade === 'B') return 'verdict-good'
  if (result.grade === 'C' || result.grade === 'D') return 'verdict-warn'
  return 'verdict-bad'
}

function getSimpleVerdict(result: TestResult): string {
  // Extract a human-readable verdict from judge reasoning
  const reasoning = result.judgeReasoning || ''
  const failedRules = getFailedRuleChecks(result)

  // If failed basic rules, say so
  if (failedRules.length > 0) {
    const ruleNames = failedRules.map(rc => rc.name).join(', ')
    return `Failed rule checks: ${ruleNames}`
  }

  // For language tests
  if (result.category === 'language') {
    if (result.grade === 'A' || result.grade === 'B') {
      return 'AI responded in the correct language as expected'
    } else {
      return 'AI did not respond in the expected language'
    }
  }

  // For analytical/priority tests
  if (result.category === 'analytical' || result.category === 'priority') {
    if (result.grade === 'A' || result.grade === 'B') {
      return 'AI analyzed your tasks and gave specific, actionable advice'
    } else if (reasoning.toLowerCase().includes('generic')) {
      return 'Response was generic — didn\'t reference your actual tasks'
    } else if (reasoning.toLowerCase().includes('data dump') || reasoning.toLowerCase().includes('field')) {
      return 'Response contained raw data dumps instead of analysis'
    } else {
      return 'Response lacked specificity or actionable insights'
    }
  }

  // For action/greeting
  if (result.category === 'greeting' || result.category === 'action') {
    if (result.grade === 'A' || result.grade === 'B') {
      return 'AI responded appropriately and concisely'
    } else {
      return 'Response was off-topic or too verbose'
    }
  }

  // For assessment
  if (result.category === 'assessment') {
    if (result.grade === 'A' || result.grade === 'B') {
      return 'AI gave a balanced self-assessment with awareness of limitations'
    } else {
      return 'AI response lacked self-awareness or was overconfident'
    }
  }

  // Edge cases
  if (result.category === 'edge_case') {
    if (result.grade === 'A' || result.grade === 'B') {
      return 'AI handled edge case gracefully'
    } else {
      return 'AI struggled with this edge case'
    }
  }

  // Fallback
  if (result.grade === 'A' || result.grade === 'B') {
    return 'AI response met quality expectations'
  } else {
    return 'AI response had quality issues'
  }
}

onMounted(() => {
  history.value = getHistory()
})
</script>

<style scoped>
.quality-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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
  align-items: center;
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
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
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
  -webkit-backdrop-filter: blur(var(--blur-md));
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

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-4);
}

.empty-details {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-detail-item {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: 1.5;
}

.empty-detail-item strong {
  color: var(--text-secondary);
}

/* Results Section */
.results-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.results-section h2,
.history-section h2 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

/* Category Filter */
.category-filter {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: var(--space-2) 0;
}

.category-pill {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: capitalize;
  cursor: pointer;
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.category-pill:hover {
  background: var(--state-hover-bg);
  color: var(--text-primary);
  border-color: var(--brand-primary-hover);
}

.category-pill.active {
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.results-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Result Card */
.result-card {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.result-card:hover {
  border-color: var(--brand-primary-hover);
  background: var(--glass-bg-soft);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.category-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-0-5) var(--space-2);
  border-radius: var(--radius-full);
  text-transform: capitalize;
  letter-spacing: 0.03em;
}

.cat-analytical { background: rgba(78, 205, 196, 0.15); color: var(--brand-primary); }
.cat-priority { background: rgba(255, 107, 107, 0.15); color: var(--color-error); }
.cat-assessment { background: rgba(155, 89, 182, 0.15); color: #9b59b6; }
.cat-greeting { background: rgba(52, 152, 219, 0.15); color: #3498db; }
.cat-action { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
.cat-language { background: rgba(230, 126, 34, 0.15); color: #e67e22; }
.cat-edge_case { background: rgba(149, 165, 166, 0.15); color: #95a5a6; }

.result-grade-area {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.result-grade {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
}

.result-grade-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.dot-green { background: var(--color-success); }
.dot-yellow { background: var(--color-warning); }
.dot-red { background: var(--color-error); }

.result-question {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
  line-height: 1.5;
}

.question-label {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-right: var(--space-1);
}

.result-response-preview {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.preview-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-verdict {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  line-height: 1.5;
  margin-bottom: var(--space-2);
}

.verdict-good {
  color: var(--color-success);
  background: rgba(46, 204, 113, 0.1);
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.verdict-warn {
  color: var(--color-warning);
  background: rgba(241, 196, 15, 0.1);
  border: 1px solid rgba(241, 196, 15, 0.3);
}

.verdict-bad {
  color: var(--color-error);
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
}


/* Expanded Content */
.expanded-content {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.expanded-section h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  margin: 0 0 var(--space-2);
}

.response-text,
.judge-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-3);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.test-criteria {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.criteria-item {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.criteria-item strong {
  color: var(--text-primary);
  display: block;
  margin-bottom: var(--space-1);
}

.anti-patterns-item {
  color: var(--color-error);
  opacity: 0.9;
}

.rubric-detail {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--glass-border);
  line-height: 1.6;
}

.rubric-detail:last-child {
  border-bottom: none;
}

.rubric-detail strong {
  color: var(--text-primary);
}

.run-breakdown-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: var(--font-medium);
}

.stat-value-inline {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

/* Rule Checks Grid */
.rule-checks-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.rule-check-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.rule-check-item.rule-passed {
  color: var(--color-success);
  background: rgba(46, 204, 113, 0.05);
}

.rule-check-item.rule-failed {
  color: var(--color-error);
  background: rgba(231, 76, 60, 0.08);
}

.rule-icon {
  flex-shrink: 0;
}

.rule-name {
  font-weight: var(--font-medium);
  flex-shrink: 0;
}

.rule-detail {
  color: var(--text-tertiary);
  margin-left: auto;
}

/* Run Breakdown */
.run-detail {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xs);
  padding: var(--space-1) 0;
}

.run-label {
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.run-latency {
  color: var(--text-tertiary);
  margin-left: auto;
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

.history-runs {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.history-rules {
  font-size: var(--text-xs);
}

.history-provider {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.history-time {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}
</style>
