/**
 * AI Quality Assessment Composable v2
 *
 * Runs a suite of test prompts against the configured AI provider,
 * then uses an LLM-as-judge approach to score each response against
 * weighted quality rubrics. Produces a QualityReport with per-prompt
 * scores, an overall grade, and historical tracking via localStorage.
 *
 * v2 improvements:
 * - Multi-run support (configurable, default 3) with mean/stddev/CI
 * - Rule-based pre-checks (deterministic, no LLM)
 * - 1-5 categorical scale
 *
 * Uses the shared AI router (getSharedRouter) which auto-injects user
 * context, so the AI gets real task data during the assessment — the
 * same experience as in the actual chat.
 */

import { ref } from 'vue'
import { getSharedRouter } from '@/services/ai/routerFactory'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import {
  QUALITY_RUBRICS,
  TEST_PROMPTS,
  buildJudgePrompt,
  parseJudgeResponse,
  computeWeightedScore,
  computeGrade,
  computeStdDev,
  computeConfidenceInterval,
  runRuleChecks,
  type TestRun,
  type TestResult,
  type QualityReport,
  type TestPrompt,
} from '@/services/ai/qualityAssessment'

const STORAGE_KEY = 'flowstate-ai-quality-reports'
const DEFAULT_RUNS_PER_TEST = 3

export function useAIQualityAssessment() {
  const isRunning = ref(false)
  const progress = ref(0)
  const currentTest = ref<string | null>(null)
  const results = ref<TestResult[]>([])
  const report = ref<QualityReport | null>(null)
  const error = ref<string | null>(null)

  /**
   * Build a system prompt that mirrors what useAIChat builds,
   * so the AI gets the same context it would in the real chat.
   */
  function buildTestSystemPrompt(): string {
    const parts: string[] = [
      'You are FlowState AI, a smart productivity assistant that THINKS and ANALYZES.',
      '',
      '## YOUR ROLE:',
      'You are a thoughtful assistant who understands the user\'s work, weighs priorities, and gives actionable advice. You have full access to the user\'s task data below — USE IT to reason and provide insights.',
      '',
      '## CRITICAL RULES:',
      '1. LANGUAGE RULE (ABSOLUTE): Respond ENTIRELY in the SAME LANGUAGE the user writes. If they write Hebrew, ALL your text must be Hebrew.',
      '2. Be conversational, thoughtful, and analytical.',
      '3. Never show JSON to the user or explain tool syntax.',
      '4. After using tools, provide a THOUGHTFUL analysis.',
      '',
    ]

    // Add real task data from stores
    try {
      const taskStore = useTaskStore()
      const allTasks = taskStore.tasks
      const today = new Date().toISOString().split('T')[0]

      const byStatus = { planned: 0, in_progress: 0, done: 0, backlog: 0, on_hold: 0 }
      let overdueCount = 0
      for (const t of allTasks) {
        if (t.status && t.status in byStatus) {
          byStatus[t.status as keyof typeof byStatus]++
        }
        if (t.dueDate && t.dueDate < today && t.status !== 'done') {
          overdueCount++
        }
      }
      parts.push(`Tasks: ${allTasks.length} total, ${byStatus.planned} planned, ${byStatus.in_progress} in progress, ${byStatus.done} done, ${overdueCount} overdue`)

      // Include open tasks for the AI to reason about (up to 60)
      const openTasks = allTasks
        .filter(t => t.status !== 'done' && !t._soft_deleted)
        .sort((a, b) => {
          const aOverdue = a.dueDate && a.dueDate < today ? 1 : 0
          const bOverdue = b.dueDate && b.dueDate < today ? 1 : 0
          if (bOverdue !== aOverdue) return bOverdue - aOverdue
          const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
          const aPri = priorityOrder[a.priority || ''] ?? 4
          const bPri = priorityOrder[b.priority || ''] ?? 4
          if (aPri !== bPri) return aPri - bPri
          return 0
        })
        .slice(0, 60)

      if (openTasks.length > 0) {
        parts.push('')
        parts.push('## YOUR TASK DATA (use this to think and reason):')
        for (const t of openTasks) {
          const pri = t.priority ? `[${t.priority}]` : ''
          const due = t.dueDate ? `due:${t.dueDate.slice(0, 10)}` : ''
          const status = t.status || 'planned'
          const overdue = t.dueDate && t.dueDate < today ? ' ⚠OVERDUE' : ''
          parts.push(`- "${t.title}" ${pri} ${status} ${due}${overdue}`.trim())
        }
      }
    } catch {
      parts.push('Tasks: [unavailable - store not loaded]')
    }

    // Timer context
    try {
      const timerStore = useTimerStore()
      if (timerStore.isTimerActive) {
        parts.push(`Timer: Running for "${timerStore.currentTaskName || 'Unknown'}"`)
      }
    } catch {
      // Timer store not available
    }

    return parts.join('\n')
  }

  /**
   * Run a single pass of a test prompt (one AI call + one judge call).
   * Returns a TestRun (lightweight result without aggregation).
   */
  async function runOnePass(testPrompt: TestPrompt): Promise<TestRun> {
    const router = await getSharedRouter()
    const systemPrompt = buildTestSystemPrompt()

    // Step 1: Send prompt to AI
    const startTime = Date.now()
    const aiResponse = await router.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testPrompt.prompt },
      ],
      { taskType: 'chat', skipUserContext: true }
    )
    const latencyMs = Date.now() - startTime
    const responseText = aiResponse.content || ''

    // Step 2: Send response to judge AI
    const judgePrompt = buildJudgePrompt(
      testPrompt.prompt,
      testPrompt.category,
      responseText,
      QUALITY_RUBRICS
    )

    let rubricScores = QUALITY_RUBRICS.map(r => ({
      rubricId: r.id,
      score: 3,
      reasoning: 'Judge evaluation failed — using default score',
    }))
    let judgeReasoning = ''

    try {
      const judgeResponse = await router.chat(
        [
          { role: 'system', content: 'You are a strict quality evaluation judge. Output ONLY valid JSON.' },
          { role: 'user', content: judgePrompt },
        ],
        { taskType: 'general', skipUserContext: true }
      )

      const parsed = parseJudgeResponse(judgeResponse.content || '')
      if (parsed) {
        rubricScores = parsed.scores
        judgeReasoning = parsed.overallAssessment
      }
    } catch (e) {
      console.warn('[AIQuality] Judge call failed:', e)
      judgeReasoning = `Judge evaluation failed: ${e instanceof Error ? e.message : String(e)}`
    }

    const overallScore = computeWeightedScore(rubricScores, QUALITY_RUBRICS)

    return {
      response: responseText,
      rubricScores,
      overallScore,
      latencyMs,
      judgeReasoning,
    }
  }

  /**
   * Run a test prompt multiple times and aggregate results.
   */
  async function runTestWithRuns(testPrompt: TestPrompt, runCount: number): Promise<TestResult> {
    const runs: TestRun[] = []

    for (let r = 0; r < runCount; r++) {
      try {
        const run = await runOnePass(testPrompt)
        runs.push(run)
      } catch (e) {
        console.warn(`[AIQuality] Run ${r + 1}/${runCount} failed for "${testPrompt.id}":`, e)
        // Add a failed run
        const failedScores = QUALITY_RUBRICS.map(rb => ({
          rubricId: rb.id,
          score: 1,
          reasoning: 'Run failed to execute',
        }))
        runs.push({
          response: `Error: ${e instanceof Error ? e.message : String(e)}`,
          rubricScores: failedScores,
          overallScore: 0,
          latencyMs: 0,
          judgeReasoning: 'Run execution failed',
        })
      }

      // Short delay between runs to avoid rate limiting
      if (r < runCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Compute stats across runs
    const scores = runs.map(r => r.overallScore)
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const stdDev = computeStdDev(scores)
    const ci = computeConfidenceInterval(scores)

    // Pick median run as representative
    const sortedRuns = [...runs].sort((a, b) => a.overallScore - b.overallScore)
    const median = sortedRuns[Math.floor(sortedRuns.length / 2)]

    // Rule checks on representative response
    const ruleChecks = runRuleChecks(median.response, testPrompt.prompt, testPrompt.category)

    return {
      promptId: testPrompt.id,
      prompt: testPrompt.prompt,
      category: testPrompt.category,
      response: median.response,
      rubricScores: median.rubricScores,
      overallScore: meanScore,
      grade: computeGrade(meanScore),
      latencyMs: median.latencyMs,
      judgeReasoning: median.judgeReasoning,
      timestamp: new Date().toISOString(),
      ruleChecks,
      runCount,
      scoreStdDev: stdDev,
      confidenceInterval: ci,
      runs,
    }
  }

  /**
   * Run all test prompts sequentially with configurable runs per test.
   */
  async function runAllTests(options?: { runsPerTest?: number }): Promise<QualityReport> {
    const runsPerTest = options?.runsPerTest ?? DEFAULT_RUNS_PER_TEST

    isRunning.value = true
    progress.value = 0
    results.value = []
    error.value = null

    const startTime = Date.now()

    try {
      const router = await getSharedRouter()
      const providerType = router.getLastUsedProvider() || 'unknown'

      for (let i = 0; i < TEST_PROMPTS.length; i++) {
        const testPrompt = TEST_PROMPTS[i]
        currentTest.value = testPrompt.id
        progress.value = Math.round((i / TEST_PROMPTS.length) * 100)

        try {
          const result = await runTestWithRuns(testPrompt, runsPerTest)
          results.value.push(result)
        } catch (e) {
          console.error(`[AIQuality] Test "${testPrompt.id}" failed:`, e)
          const errorResponse = `Error: ${e instanceof Error ? e.message : String(e)}`
          const failedRubricScores = QUALITY_RUBRICS.map(r => ({
            rubricId: r.id,
            score: 0,
            reasoning: 'Test failed to execute',
          }))
          results.value.push({
            promptId: testPrompt.id,
            prompt: testPrompt.prompt,
            category: testPrompt.category,
            response: errorResponse,
            rubricScores: failedRubricScores,
            overallScore: 0,
            grade: 'F',
            latencyMs: 0,
            judgeReasoning: 'Test execution failed',
            timestamp: new Date().toISOString(),
            ruleChecks: runRuleChecks(errorResponse, testPrompt.prompt, testPrompt.category),
            runCount: runsPerTest,
            scoreStdDev: 0,
            confidenceInterval: [0, 0] as [number, number],
            runs: [{
              response: errorResponse,
              rubricScores: failedRubricScores,
              overallScore: 0,
              latencyMs: 0,
              judgeReasoning: 'Test execution failed',
            }],
          })
        }

        // 1 second delay between tests to avoid rate limiting
        if (i < TEST_PROMPTS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      progress.value = 100
      currentTest.value = null

      // Compute overall report
      const avgScore = results.value.length > 0
        ? results.value.reduce((sum, r) => sum + r.overallScore, 0) / results.value.length
        : 0

      // Compute overall rule check pass rate
      const allRuleChecks = results.value.flatMap(r => r.ruleChecks)
      const ruleCheckPassRate = allRuleChecks.length > 0
        ? allRuleChecks.filter(rc => rc.passed).length / allRuleChecks.length
        : 1

      const newReport: QualityReport = {
        id: `qr-${Date.now()}`,
        results: [...results.value],
        averageScore: avgScore,
        grade: computeGrade(avgScore),
        provider: providerType,
        model: 'auto',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        runsPerTest,
        ruleCheckPassRate,
      }

      report.value = newReport

      // Save to history
      saveToHistory(newReport)

      return newReport
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isRunning.value = false
      currentTest.value = null
    }
  }

  /**
   * Run a single test prompt (exposed for individual re-runs).
   */
  async function runSingleTest(promptId: string, runsPerTest?: number): Promise<TestResult> {
    const testPrompt = TEST_PROMPTS.find(p => p.id === promptId)
    if (!testPrompt) throw new Error(`Unknown prompt: ${promptId}`)
    return runTestWithRuns(testPrompt, runsPerTest ?? DEFAULT_RUNS_PER_TEST)
  }

  /**
   * Save report to localStorage history.
   */
  function saveToHistory(newReport: QualityReport) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as QualityReport[]
      existing.unshift(newReport)
      // Keep last 20 reports
      const trimmed = existing.slice(0, 20)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // localStorage not available
    }
  }

  /**
   * Get historical reports.
   */
  function getHistory(): QualityReport[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as QualityReport[]
    } catch {
      return []
    }
  }

  /**
   * Clear history.
   */
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    // State
    isRunning,
    progress,
    currentTest,
    results,
    report,
    error,

    // Actions
    runAllTests,
    runSingleTest,
    getHistory,
    clearHistory,

    // Constants (for UI)
    rubrics: QUALITY_RUBRICS,
    testPrompts: TEST_PROMPTS,
  }
}
