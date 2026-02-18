/**
 * Memory Assessment Composable (TASK-1356)
 *
 * Runs the memory health assessment in fast or full mode.
 * Fast mode: heuristic checks only (coverage, freshness, density, contradictions)
 * Full mode: adds LLM-as-judge context utilization tests
 *
 * History is saved to localStorage for trend tracking.
 */

import { ref } from 'vue'
import { useWorkProfile } from '@/composables/useWorkProfile'
import {
  assessCoverage,
  assessFreshness,
  assessDensity,
  assessContradictions,
  assessBehavioralMetrics,
  computeOverallScore,
  computeMemoryGrade,
  generateRecommendations,
  buildMemoryJudgePrompt,
  buildContradictionDetectionPrompt,
  parseContradictionResponse,
  buildContextDeltaJudgePrompt,
  parseDeltaJudgeResponse,
  MEMORY_TEST_PROMPTS,
  MEMORY_RUBRICS,
  type MemoryHealthReport,
  type MemoryHealthSection,
} from '@/services/ai/memoryAssessment'
import { useAIEventTracking } from '@/composables/useAIEventTracking'
import { parseJudgeResponse, computeWeightedScore } from '@/services/ai/qualityAssessment'

const STORAGE_KEY = 'flowstate-memory-health-reports'

export function useMemoryAssessment() {
  const isRunning = ref(false)
  const progress = ref(0)
  const currentCheck = ref<string | null>(null)
  const report = ref<MemoryHealthReport | null>(null)
  const error = ref<string | null>(null)

  /**
   * Run fast assessment (heuristic only, no LLM calls).
   * Completes in <100ms.
   */
  async function runFastAssessment(): Promise<MemoryHealthReport> {
    isRunning.value = true
    progress.value = 0
    error.value = null

    const startTime = Date.now()

    try {
      const { loadProfile } = useWorkProfile()

      // Step 1: Load profile
      currentCheck.value = 'Loading profile...'
      progress.value = 10
      const profile = await loadProfile()
      const observations = profile?.memoryGraph || []

      // Step 2: Coverage
      currentCheck.value = 'Checking coverage...'
      progress.value = 30
      const coverage = assessCoverage(profile)

      // Step 3: Freshness
      currentCheck.value = 'Checking freshness...'
      progress.value = 50
      const freshness = assessFreshness(observations)

      // Step 4: Density
      currentCheck.value = 'Checking density...'
      progress.value = 70
      const density = assessDensity(observations)

      // Step 5: Contradictions
      currentCheck.value = 'Checking consistency...'
      progress.value = 80
      const contradictions = assessContradictions(observations)

      // Step 6: Behavioral metrics
      currentCheck.value = 'Analyzing usage patterns...'
      progress.value = 90
      const { computeMetrics } = useAIEventTracking()
      const metrics30d = computeMetrics(30)
      const behavioral = assessBehavioralMetrics({
        acceptanceRate: metrics30d.acceptanceRate,
        editRate: metrics30d.editRate,
        retryRate: metrics30d.retryRate,
        avgSessionDepth: metrics30d.avgSessionDepth,
        totalEvents: metrics30d.totalEvents,
        chatSessions: metrics30d.chatSessions,
      })

      const sections = [coverage, freshness, density, contradictions, behavioral]
      const overallScore = computeOverallScore(sections)

      const newReport: MemoryHealthReport = {
        id: `mhr-${Date.now()}`,
        overallScore,
        grade: computeMemoryGrade(overallScore),
        sections,
        recommendations: generateRecommendations(sections),
        mode: 'fast',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      }

      progress.value = 100
      currentCheck.value = null
      report.value = newReport
      saveToHistory(newReport)
      return newReport
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isRunning.value = false
      currentCheck.value = null
    }
  }

  /**
   * Run full assessment (heuristic + LLM-as-judge context utilization).
   * Takes ~30-60s depending on provider.
   */
  async function runFullAssessment(): Promise<MemoryHealthReport> {
    isRunning.value = true
    progress.value = 0
    error.value = null

    const startTime = Date.now()

    try {
      // Run fast checks first (50% of progress)
      const { loadProfile, getProfileContext } = useWorkProfile()

      currentCheck.value = 'Loading profile...'
      progress.value = 5
      const profile = await loadProfile()
      const observations = profile?.memoryGraph || []

      currentCheck.value = 'Checking coverage...'
      progress.value = 10
      const coverage = assessCoverage(profile)

      currentCheck.value = 'Checking freshness...'
      progress.value = 15
      const freshness = assessFreshness(observations)

      currentCheck.value = 'Checking density...'
      progress.value = 20
      const density = assessDensity(observations)

      // Heuristic contradictions (fast fallback baseline)
      currentCheck.value = 'Checking consistency (heuristic)...'
      progress.value = 22
      const heuristicContradictions = assessContradictions(observations)

      // LLM-based contradiction detection (enhanced, full mode)
      currentCheck.value = 'Analyzing contradictions with LLM...'
      progress.value = 26
      const llmContradictions = await runLLMContradictionDetection(observations)
      // Merge: use LLM results if available, fall back to heuristic
      const contradictions = llmContradictions || heuristicContradictions

      // With/without context delta test (Mem0 pattern)
      const memoryContext = getProfileContext() || '(no memory context available)'
      currentCheck.value = 'Running context delta test...'
      progress.value = 32
      const deltaSection = await runContextDeltaTests(memoryContext, 36)

      // LLM-as-judge context utilization tests
      const contextSection = await runContextUtilizationTests(memoryContext, 60)

      // Behavioral metrics (same as fast mode, no LLM needed)
      currentCheck.value = 'Analyzing usage patterns...'
      progress.value = 95
      const { computeMetrics } = useAIEventTracking()
      const metrics30d = computeMetrics(30)
      const behavioral = assessBehavioralMetrics({
        acceptanceRate: metrics30d.acceptanceRate,
        editRate: metrics30d.editRate,
        retryRate: metrics30d.retryRate,
        avgSessionDepth: metrics30d.avgSessionDepth,
        totalEvents: metrics30d.totalEvents,
        chatSessions: metrics30d.chatSessions,
      })

      const sections = [coverage, freshness, density, contradictions, deltaSection, contextSection, behavioral]
      const overallScore = computeOverallScore(sections)

      const newReport: MemoryHealthReport = {
        id: `mhr-${Date.now()}`,
        overallScore,
        grade: computeMemoryGrade(overallScore),
        sections,
        recommendations: generateRecommendations(sections),
        mode: 'full',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      }

      progress.value = 100
      currentCheck.value = null
      report.value = newReport
      saveToHistory(newReport)
      return newReport
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isRunning.value = false
      currentCheck.value = null
    }
  }

  /**
   * Run LLM-based contradiction detection across all observations.
   * Returns a MemoryHealthSection or null if the LLM call fails.
   */
  async function runLLMContradictionDetection(
    observations: import('@/utils/supabaseMappers').MemoryObservation[]
  ): Promise<MemoryHealthSection | null> {
    if (observations.length < 2) return null

    try {
      const { getSharedRouter } = await import('@/services/ai/routerFactory')
      const router = await getSharedRouter()

      const prompt = buildContradictionDetectionPrompt(observations)
      const response = await router.chat(
        [
          { role: 'system', content: 'You are a memory consistency auditor. Output ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { taskType: 'general', skipUserContext: true }
      )

      const parsed = parseContradictionResponse(response.content || '')
      if (!parsed) return null

      const checks: import('@/services/ai/memoryAssessment').MemoryHealthCheck[] = []
      const count = parsed.contradictions.length
      const contradictionScore = count === 0 ? 100 : Math.max(0, 100 - count * 25)

      checks.push({
        id: 'llm_contradiction_count',
        name: 'LLM Contradiction Scan',
        status: count === 0 ? 'pass' : count <= 1 ? 'warn' : 'fail',
        score: contradictionScore,
        value: `${count} contradiction${count !== 1 ? 's' : ''} detected by LLM analysis`,
        threshold: '0 contradictions',
        details: parsed.contradictions.map(c => c.explanation),
        recommendation: count > 0
          ? 'Clear stale memories from Settings > AI > Memory Observations, then re-run capacity metrics'
          : undefined,
      })

      // Add per-contradiction detail checks
      for (const c of parsed.contradictions.slice(0, 3)) {
        checks.push({
          id: `llm_contradiction_${c.obsA}_${c.obsB}`,
          name: `Conflict: obs #${c.obsA} vs #${c.obsB}`,
          status: 'fail',
          score: 0,
          value: c.explanation,
          threshold: 'No conflict',
          details: [`Type: ${c.type}`],
        })
      }

      return {
        id: 'contradictions',
        name: 'Consistency (LLM)',
        score: contradictionScore,
        weight: 0.15,
        checks,
      }
    } catch {
      return null // Fall back to heuristic
    }
  }

  /**
   * Run with/without context delta tests (Mem0 benchmark pattern).
   * For each test prompt, runs the AI twice: once with memory context,
   * once without. A judge LLM compares the two responses.
   * Positive delta = memory is helping. Negative = memory is hurting.
   */
  async function runContextDeltaTests(
    memoryContext: string,
    baseProgress: number
  ): Promise<MemoryHealthSection> {
    const { getSharedRouter } = await import('@/services/ai/routerFactory')
    const router = await getSharedRouter()

    const checks: import('@/services/ai/memoryAssessment').MemoryHealthCheck[] = []
    const deltas: number[] = []
    const progressPerTest = (60 - baseProgress) / MEMORY_TEST_PROMPTS.length

    for (let i = 0; i < MEMORY_TEST_PROMPTS.length; i++) {
      const test = MEMORY_TEST_PROMPTS[i]
      currentCheck.value = `Delta test: ${test.id}...`
      progress.value = Math.round(baseProgress + i * progressPerTest)

      try {
        // Step 1: Get response WITHOUT memory context
        const withoutResponse = await router.chat(
          [
            { role: 'system', content: 'You are FlowState AI, a productivity assistant.' },
            { role: 'user', content: test.prompt },
          ],
          { taskType: 'chat', skipUserContext: true }
        )

        // Step 2: Get response WITH memory context
        const withResponse = await router.chat(
          [
            {
              role: 'system',
              content: `You are FlowState AI. Use the user's stored context to give personalized advice.\n\n${memoryContext}`,
            },
            { role: 'user', content: test.prompt },
          ],
          { taskType: 'chat', skipUserContext: true }
        )

        // Step 3: Judge the delta
        const judgePrompt = buildContextDeltaJudgePrompt(
          test.prompt,
          withResponse.content || '',
          withoutResponse.content || ''
        )
        const judgeResponse = await router.chat(
          [
            { role: 'system', content: 'You are a response quality judge. Output ONLY valid JSON.' },
            { role: 'user', content: judgePrompt },
          ],
          { taskType: 'general', skipUserContext: true }
        )

        const parsed = parseDeltaJudgeResponse(judgeResponse.content || '')

        if (parsed) {
          deltas.push(parsed.delta)
          // Delta of 0 = no improvement, >0 = memory helps, <0 = memory hurts
          // Normalize delta (0-10 range) to a 0-100 score
          const deltaScore = Math.max(0, Math.min(100, Math.round((parsed.delta / 5) * 100)))

          checks.push({
            id: `delta_${test.id}`,
            name: test.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            status: parsed.delta >= 2 ? 'pass' : parsed.delta >= 0.5 ? 'warn' : 'fail',
            score: deltaScore,
            value: `Delta: ${parsed.delta > 0 ? '+' : ''}${parsed.delta.toFixed(1)} — ${parsed.assessment}`,
            threshold: 'Delta >= +2.0',
            recommendation: parsed.delta < 0.5
              ? `Memory context didn't improve response for: "${test.prompt}". Profile may lack relevant data.`
              : undefined,
          })
        } else {
          deltas.push(0)
          checks.push({
            id: `delta_${test.id}`,
            name: test.id.replace(/_/g, ' '),
            status: 'warn',
            score: 50,
            value: 'Could not parse judge response',
            threshold: 'Delta >= +2.0',
          })
        }

        // Brief delay between tests
        if (i < MEMORY_TEST_PROMPTS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      } catch (e) {
        deltas.push(0)
        checks.push({
          id: `delta_${test.id}`,
          name: test.id.replace(/_/g, ' '),
          status: 'fail',
          score: 0,
          value: `Error: ${e instanceof Error ? e.message : String(e)}`,
          threshold: 'Delta >= +2.0',
        })
      }
    }

    const avgDelta = deltas.length > 0
      ? deltas.reduce((a, b) => a + b, 0) / deltas.length
      : 0
    const overallScore = Math.max(0, Math.min(100, Math.round((avgDelta / 5) * 100)))

    return {
      id: 'context_delta',
      name: 'Context Delta (Mem0)',
      score: overallScore,
      weight: 0.20,
      checks,
    }
  }

  /**
   * Run LLM-as-judge tests for context utilization.
   */
  async function runContextUtilizationTests(
    memoryContext: string,
    baseProgress: number
  ): Promise<MemoryHealthSection> {
    const { getSharedRouter } = await import('@/services/ai/routerFactory')
    const router = await getSharedRouter()

    const testScores: number[] = []
    const checks = []
    const progressPerTest = (100 - baseProgress - 5) / MEMORY_TEST_PROMPTS.length

    for (let i = 0; i < MEMORY_TEST_PROMPTS.length; i++) {
      const test = MEMORY_TEST_PROMPTS[i]
      currentCheck.value = `Testing: ${test.id}...`
      progress.value = Math.round(baseProgress + i * progressPerTest)

      try {
        // Step 1: Get AI response with memory context
        const aiResponse = await router.chat(
          [
            {
              role: 'system',
              content: `You are FlowState AI. Use the user's stored context to give personalized advice.\n\n${memoryContext}`,
            },
            { role: 'user', content: test.prompt },
          ],
          { taskType: 'chat', skipUserContext: true }
        )

        // Step 2: Judge the response
        const judgePrompt = buildMemoryJudgePrompt(test.prompt, aiResponse.content || '', memoryContext)
        const judgeResponse = await router.chat(
          [
            { role: 'system', content: 'You are a strict memory utilization judge. Output ONLY valid JSON.' },
            { role: 'user', content: judgePrompt },
          ],
          { taskType: 'general', skipUserContext: true }
        )

        const parsed = parseJudgeResponse(judgeResponse.content || '')
        let testScore = 50 // default

        if (parsed) {
          const weightedScore = computeWeightedScore(
            parsed.scores,
            MEMORY_RUBRICS.map(r => ({ id: r.id, name: r.name, description: r.description, weight: r.weight }))
          )
          testScore = Math.round(weightedScore * 10) // Convert 1-10 to 0-100
        }

        testScores.push(testScore)

        checks.push({
          id: `ctx_${test.id}`,
          name: test.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          status: testScore >= 70 ? 'pass' as const : testScore >= 45 ? 'warn' as const : 'fail' as const,
          score: testScore,
          value: `${testScore}/100 — "${test.prompt}"`,
          threshold: '70+',
          recommendation: testScore < 45
            ? `AI failed to use memory for: "${test.prompt}". Check if profile context is being injected.`
            : undefined,
        })

        // Delay between tests
        if (i < MEMORY_TEST_PROMPTS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (e) {
        testScores.push(0)
        checks.push({
          id: `ctx_${test.id}`,
          name: test.id.replace(/_/g, ' '),
          status: 'fail' as const,
          score: 0,
          value: `Error: ${e instanceof Error ? e.message : String(e)}`,
          threshold: '70+',
        })
      }
    }

    const avgScore = testScores.length > 0
      ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
      : 0

    return {
      id: 'context_utilization',
      name: 'Context Utilization',
      score: avgScore,
      weight: 0.25,
      checks,
    }
  }

  /**
   * Save report to localStorage history.
   */
  function saveToHistory(newReport: MemoryHealthReport) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as MemoryHealthReport[]
      existing.unshift(newReport)
      const trimmed = existing.slice(0, 20)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // localStorage not available
    }
  }

  /**
   * Get historical reports.
   */
  function getHistory(): MemoryHealthReport[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as MemoryHealthReport[]
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
    currentCheck,
    report,
    error,

    // Actions
    runFastAssessment,
    runFullAssessment,
    getHistory,
    clearHistory,
  }
}
