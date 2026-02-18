/**
 * AI Memory Assessment Engine (TASK-1356)
 *
 * Evaluates the effectiveness of the AI memory system across multiple dimensions:
 * - Coverage: How many expected profile fields are populated
 * - Freshness: How recent are the stored observations (half-life decay)
 * - Density: How many observations exist and their confidence distribution
 * - Contradiction detection: Heuristic check for conflicting observations
 * - Context utilization: LLM-as-judge scoring of whether AI uses memory context
 *
 * Supports two modes:
 * - Fast: Heuristic-only (no LLM calls), completes in <1s
 * - Full: Adds LLM-as-judge context utilization tests (~30s)
 *
 * Research basis: RAGAS framework, Mem0 benchmarks, OpenAI Cookbook memory eval
 */

import type { WorkProfile, MemoryObservation } from '@/utils/supabaseMappers'

// ============================================================================
// Types
// ============================================================================

export interface MemoryHealthCheck {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  score: number // 0-100
  value: string
  threshold: string
  recommendation?: string
  details?: string[]
}

export interface MemoryHealthSection {
  id: string
  name: string
  score: number // 0-100
  weight: number // 0-1
  checks: MemoryHealthCheck[]
}

export interface MemoryHealthReport {
  id: string
  overallScore: number
  grade: string
  sections: MemoryHealthSection[]
  recommendations: { priority: 'high' | 'medium' | 'low'; action: string }[]
  mode: 'fast' | 'full'
  timestamp: string
  durationMs: number
}

export interface MemoryAssessmentConfig {
  freshnessHalfLifeDays: number
  minObservationsForGood: number
  minCoverageForGood: number
  contradictionPairs: [string, string][]
}

// ============================================================================
// Constants
// ============================================================================

/** Default assessment configuration */
export const DEFAULT_CONFIG: MemoryAssessmentConfig = {
  freshnessHalfLifeDays: 14,
  minObservationsForGood: 8,
  minCoverageForGood: 0.7,
  contradictionPairs: [
    ['capacity_gap', 'reliable_planner'],
    ['overplans', 'reliable_planner'],
    ['underestimates', 'overestimates'],
  ],
}

/** Expected profile fields — the "schema" we measure coverage against */
const EXPECTED_PROFILE_FIELDS: { key: keyof WorkProfile; label: string; computed: boolean }[] = [
  { key: 'workDays', label: 'Work days', computed: false },
  { key: 'daysOff', label: 'Days off', computed: false },
  { key: 'heavyMeetingDays', label: 'Heavy meeting days', computed: false },
  { key: 'maxTasksPerDay', label: 'Max tasks per day', computed: false },
  { key: 'preferredWorkStyle', label: 'Work style preference', computed: false },
  { key: 'topPriorityNote', label: 'Top priority note', computed: false },
  { key: 'avgWorkMinutesPerDay', label: 'Avg work minutes/day', computed: true },
  { key: 'avgTasksCompletedPerDay', label: 'Avg tasks completed/day', computed: true },
  { key: 'peakProductivityDays', label: 'Peak productivity days', computed: true },
  { key: 'avgPlanAccuracy', label: 'Plan accuracy', computed: true },
  { key: 'weeklyHistory', label: 'Weekly history', computed: true },
  { key: 'interviewCompleted', label: 'Interview completed', computed: false },
  { key: 'memoryGraph', label: 'Memory graph', computed: true },
]

/** Memory-specific test prompts for LLM-as-judge (full mode only) */
export const MEMORY_TEST_PROMPTS = [
  {
    id: 'memory_patterns',
    prompt: 'Based on my work patterns, what should I adjust this week?',
    expectedBehavior: 'Should cite specific observations from memory: peak days, capacity, plan accuracy, work style',
    antiPatterns: ['Generic advice without referencing stored patterns', 'Asking the user about their patterns instead of using memory'],
  },
  {
    id: 'memory_capacity',
    prompt: 'Am I taking on too much?',
    expectedBehavior: 'Should use avgTasksCompletedPerDay, overdue patterns, and WIP count to give a data-backed answer',
    antiPatterns: ['Vague reassurance without data', 'Not referencing historical capacity metrics'],
  },
  {
    id: 'memory_corrections',
    prompt: 'Help me plan my priorities for tomorrow',
    expectedBehavior: 'Should apply past suggestion corrections and peak productivity day knowledge to scheduling',
    antiPatterns: ['Ignoring suggestion_feedback observations', 'Not considering peak days for scheduling'],
  },
]

/** Rubrics for LLM-as-judge memory utilization scoring */
export const MEMORY_RUBRICS = [
  { id: 'context_citation', name: 'Context Citation', description: 'Does the response cite specific data from the user profile/memory?', weight: 3 },
  { id: 'pattern_application', name: 'Pattern Application', description: 'Does the AI apply learned patterns (peak days, capacity, accuracy) to its recommendations?', weight: 3 },
  { id: 'feedback_learning', name: 'Feedback Learning', description: 'Does the AI avoid past mistakes recorded in suggestion_feedback?', weight: 2 },
  { id: 'personalization_depth', name: 'Personalization Depth', description: 'Is the response specifically tailored to THIS user vs generic advice?', weight: 2 },
]

// ============================================================================
// Coverage Assessment
// ============================================================================

function isFieldPopulated(profile: WorkProfile, key: keyof WorkProfile): boolean {
  const value = profile[key]
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (typeof value === 'number' && value === 0) return false
  if (typeof value === 'boolean') return value // interviewCompleted = true is populated
  return true
}

export function assessCoverage(profile: WorkProfile | null): MemoryHealthSection {
  const checks: MemoryHealthCheck[] = []

  if (!profile) {
    return {
      id: 'coverage',
      name: 'Profile Coverage',
      score: 0,
      weight: 0.25,
      checks: [{
        id: 'no_profile',
        name: 'Profile Exists',
        status: 'fail',
        score: 0,
        value: 'No profile found',
        threshold: 'Profile must exist',
        recommendation: 'Complete the AI interview in Settings > AI to build your profile',
      }],
    }
  }

  let populated = 0
  const total = EXPECTED_PROFILE_FIELDS.length
  const missing: string[] = []
  const missingComputed: string[] = []

  for (const field of EXPECTED_PROFILE_FIELDS) {
    const filled = isFieldPopulated(profile, field.key)
    if (filled) {
      populated++
    } else if (field.computed) {
      missingComputed.push(field.label)
    } else {
      missing.push(field.label)
    }
  }

  const coverageRatio = total > 0 ? populated / total : 0
  const coveragePercent = Math.round(coverageRatio * 100)
  const score = coveragePercent

  // Interview check
  checks.push({
    id: 'interview_completed',
    name: 'Interview Completed',
    status: profile.interviewCompleted ? 'pass' : 'fail',
    score: profile.interviewCompleted ? 100 : 0,
    value: profile.interviewCompleted ? 'Yes' : 'Not completed',
    threshold: 'Must be completed',
    recommendation: profile.interviewCompleted ? undefined : 'Go to Settings > AI and complete the work profile interview',
  })

  // Overall coverage
  checks.push({
    id: 'field_coverage',
    name: 'Field Coverage',
    status: coverageRatio >= 0.8 ? 'pass' : coverageRatio >= 0.5 ? 'warn' : 'fail',
    score: coveragePercent,
    value: `${populated}/${total} fields populated (${coveragePercent}%)`,
    threshold: '80%+',
    recommendation: missing.length > 0 ? `Missing user-provided: ${missing.join(', ')}` : undefined,
    details: missingComputed.length > 0 ? [`Missing computed: ${missingComputed.join(', ')} (auto-populated after ~1 week of usage)`] : undefined,
  })

  // Computed metrics check
  const computedFields = EXPECTED_PROFILE_FIELDS.filter(f => f.computed)
  const computedPopulated = computedFields.filter(f => isFieldPopulated(profile, f.key)).length
  checks.push({
    id: 'computed_metrics',
    name: 'Computed Metrics',
    status: computedPopulated >= computedFields.length * 0.7 ? 'pass' : computedPopulated >= computedFields.length * 0.4 ? 'warn' : 'fail',
    score: computedFields.length > 0 ? Math.round((computedPopulated / computedFields.length) * 100) : 0,
    value: `${computedPopulated}/${computedFields.length} auto-computed fields populated`,
    threshold: '70%+',
    recommendation: computedPopulated < computedFields.length * 0.4
      ? 'Use the app for at least 1 week with the Pomodoro timer to generate computed metrics'
      : undefined,
  })

  return {
    id: 'coverage',
    name: 'Profile Coverage',
    score,
    weight: 0.25,
    checks,
  }
}

// ============================================================================
// Freshness Assessment
// ============================================================================

function computeFreshnessScore(observation: MemoryObservation, halfLifeDays: number): number {
  const createdAt = new Date(observation.createdAt)
  const now = new Date()
  const ageMs = now.getTime() - createdAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Exponential decay with half-life
  return Math.max(0, Math.pow(0.5, ageDays / halfLifeDays))
}

export function assessFreshness(
  observations: MemoryObservation[],
  config: MemoryAssessmentConfig = DEFAULT_CONFIG
): MemoryHealthSection {
  const checks: MemoryHealthCheck[] = []

  if (observations.length === 0) {
    return {
      id: 'freshness',
      name: 'Memory Freshness',
      score: 0,
      weight: 0.20,
      checks: [{
        id: 'no_observations',
        name: 'Observations Exist',
        status: 'fail',
        score: 0,
        value: 'No memory observations',
        threshold: 'At least 1 observation',
        recommendation: 'Use the app for a week to generate memory observations automatically',
      }],
    }
  }

  // Compute freshness per observation
  const freshnessScores = observations.map(o => computeFreshnessScore(o, config.freshnessHalfLifeDays))
  const avgFreshness = freshnessScores.reduce((a, b) => a + b, 0) / freshnessScores.length
  const avgPercent = Math.round(avgFreshness * 100)

  // Find stale observations (freshness < 0.3)
  const staleCount = freshnessScores.filter(f => f < 0.3).length
  const staleObs = observations
    .filter((_, i) => freshnessScores[i] < 0.3)
    .map(o => `${o.entity} ${o.relation}`)

  // Find the oldest observation
  const sorted = [...observations].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const oldestAge = Math.round(
    (Date.now() - new Date(sorted[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  const newestAge = Math.round(
    (Date.now() - new Date(sorted[sorted.length - 1].createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  checks.push({
    id: 'avg_freshness',
    name: 'Average Freshness',
    status: avgFreshness >= 0.6 ? 'pass' : avgFreshness >= 0.4 ? 'warn' : 'fail',
    score: avgPercent,
    value: `${avgPercent}% (half-life: ${config.freshnessHalfLifeDays} days)`,
    threshold: '60%+',
    recommendation: avgFreshness < 0.4
      ? 'Memory data is stale. Re-run capacity metrics computation from Settings > AI'
      : undefined,
  })

  checks.push({
    id: 'stale_observations',
    name: 'Stale Observations',
    status: staleCount === 0 ? 'pass' : staleCount <= observations.length * 0.3 ? 'warn' : 'fail',
    score: Math.round(((observations.length - staleCount) / observations.length) * 100),
    value: `${staleCount} of ${observations.length} observations are stale (>30 days effective age)`,
    threshold: '<30% stale',
    details: staleObs.length > 0 ? staleObs.slice(0, 5) : undefined,
  })

  checks.push({
    id: 'age_range',
    name: 'Data Age Range',
    status: newestAge <= 7 ? 'pass' : newestAge <= 14 ? 'warn' : 'fail',
    score: Math.max(0, Math.round(100 - newestAge * 3)),
    value: `Newest: ${newestAge}d ago, Oldest: ${oldestAge}d ago`,
    threshold: 'Newest < 7 days',
  })

  return {
    id: 'freshness',
    name: 'Memory Freshness',
    score: avgPercent,
    weight: 0.20,
    checks,
  }
}

// ============================================================================
// Observation Density Assessment
// ============================================================================

export function assessDensity(
  observations: MemoryObservation[],
  config: MemoryAssessmentConfig = DEFAULT_CONFIG
): MemoryHealthSection {
  const checks: MemoryHealthCheck[] = []
  const count = observations.length

  // Total count
  const countScore = Math.min(100, Math.round((count / config.minObservationsForGood) * 100))
  checks.push({
    id: 'observation_count',
    name: 'Observation Count',
    status: count >= config.minObservationsForGood ? 'pass' : count >= config.minObservationsForGood / 2 ? 'warn' : 'fail',
    score: countScore,
    value: `${count} observations (target: ${config.minObservationsForGood}+)`,
    threshold: `${config.minObservationsForGood}+`,
    recommendation: count < config.minObservationsForGood / 2
      ? 'Use the app more to build up memory observations, or re-run capacity metrics'
      : undefined,
  })

  // Source diversity (how many different sources feed data)
  const sources = new Set(observations.map(o => o.source))
  const expectedSources = ['pomodoro_data', 'task_analysis', 'weekly_history', 'suggestion_feedback']
  const sourceCoverage = expectedSources.filter(s => sources.has(s)).length
  checks.push({
    id: 'source_diversity',
    name: 'Source Diversity',
    status: sourceCoverage >= 3 ? 'pass' : sourceCoverage >= 2 ? 'warn' : 'fail',
    score: Math.round((sourceCoverage / expectedSources.length) * 100),
    value: `${sourceCoverage}/${expectedSources.length} data sources active`,
    threshold: '3+ sources',
    details: expectedSources.filter(s => !sources.has(s)).map(s => `Missing: ${s}`),
  })

  // Confidence distribution
  const highConfidence = observations.filter(o => o.confidence >= 0.7).length
  const lowConfidence = observations.filter(o => o.confidence < 0.5).length
  const avgConfidence = count > 0
    ? observations.reduce((sum, o) => sum + o.confidence, 0) / count
    : 0
  checks.push({
    id: 'confidence_distribution',
    name: 'Confidence Quality',
    status: avgConfidence >= 0.7 ? 'pass' : avgConfidence >= 0.5 ? 'warn' : 'fail',
    score: Math.round(avgConfidence * 100),
    value: `Avg: ${(avgConfidence * 100).toFixed(0)}% | High (>=70%): ${highConfidence} | Low (<50%): ${lowConfidence}`,
    threshold: 'Avg >=70%',
  })

  // Entity diversity (how many different entities are tracked)
  const entities = new Set(observations.map(o => o.entity))
  checks.push({
    id: 'entity_diversity',
    name: 'Entity Diversity',
    status: entities.size >= 5 ? 'pass' : entities.size >= 3 ? 'warn' : 'fail',
    score: Math.min(100, Math.round((entities.size / 5) * 100)),
    value: `${entities.size} unique entities tracked`,
    threshold: '5+ entities',
    details: Array.from(entities).slice(0, 8),
  })

  // Suggestion feedback loop
  const feedbackCount = observations.filter(o => o.source === 'suggestion_feedback').length
  checks.push({
    id: 'feedback_loop',
    name: 'Suggestion Feedback Loop',
    status: feedbackCount >= 3 ? 'pass' : feedbackCount >= 1 ? 'warn' : 'fail',
    score: Math.min(100, Math.round((feedbackCount / 3) * 100)),
    value: `${feedbackCount} correction${feedbackCount !== 1 ? 's' : ''} recorded`,
    threshold: '3+ corrections',
    recommendation: feedbackCount === 0
      ? 'When AI suggests wrong values, reject them with a reason to train the memory system'
      : undefined,
  })

  const overallScore = checks.length > 0
    ? Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length)
    : 0

  return {
    id: 'density',
    name: 'Observation Density',
    score: overallScore,
    weight: 0.15,
    checks,
  }
}

// ============================================================================
// Contradiction Detection
// ============================================================================

export function assessContradictions(
  observations: MemoryObservation[],
  config: MemoryAssessmentConfig = DEFAULT_CONFIG
): MemoryHealthSection {
  const checks: MemoryHealthCheck[] = []
  const contradictions: string[] = []

  // Check known contradiction pairs
  for (const [relA, relB] of config.contradictionPairs) {
    const obsA = observations.find(o => o.relation === relA)
    const obsB = observations.find(o => o.relation === relB)
    if (obsA && obsB) {
      contradictions.push(
        `"${obsA.entity} ${obsA.relation}: ${obsA.value}" conflicts with "${obsB.entity} ${obsB.relation}: ${obsB.value}"`
      )
    }
  }

  // Check for same entity with contradicting confidence
  const entityMap = new Map<string, MemoryObservation[]>()
  for (const obs of observations) {
    const key = obs.entity
    if (!entityMap.has(key)) entityMap.set(key, [])
    entityMap.get(key)!.push(obs)
  }

  // Check for stale high-confidence vs recent low-confidence on same entity
  for (const [entity, obs] of entityMap) {
    if (obs.length < 2) continue
    const sorted = [...obs].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const newest = sorted[0]
    const oldest = sorted[sorted.length - 1]
    if (
      newest.confidence < 0.5 &&
      oldest.confidence >= 0.8 &&
      newest.relation !== oldest.relation
    ) {
      contradictions.push(
        `Entity "${entity}": recent low-confidence "${newest.relation}" may contradict older high-confidence "${oldest.relation}"`
      )
    }
  }

  const contradictionScore = contradictions.length === 0 ? 100 : Math.max(0, 100 - contradictions.length * 30)

  checks.push({
    id: 'contradiction_count',
    name: 'Contradictions Found',
    status: contradictions.length === 0 ? 'pass' : contradictions.length <= 1 ? 'warn' : 'fail',
    score: contradictionScore,
    value: `${contradictions.length} contradiction${contradictions.length !== 1 ? 's' : ''} detected`,
    threshold: '0 contradictions',
    details: contradictions,
    recommendation: contradictions.length > 0
      ? 'Reset learned data from Settings > AI, then use the app for a week to regenerate clean observations'
      : undefined,
  })

  return {
    id: 'contradictions',
    name: 'Consistency',
    score: contradictionScore,
    weight: 0.15,
    checks,
  }
}

// ============================================================================
// LLM-Based Contradiction Detection (full mode only)
// ============================================================================

/**
 * Build a prompt for the LLM to detect semantic contradictions across all
 * memory observations. Research shows heuristic detection catches <6% of
 * contradictions (MemoryStress benchmark). LLM detection is significantly better.
 */
export function buildContradictionDetectionPrompt(observations: MemoryObservation[]): string {
  const formatted = observations
    .map((o, i) => `[${i + 1}] Entity: "${o.entity}" | Relation: "${o.relation}" | Value: "${o.value}" | Confidence: ${(o.confidence * 100).toFixed(0)}% | Age: ${o.createdAt}`)
    .join('\n')

  return `You are a memory consistency auditor. Analyze these stored user observations for contradictions, inconsistencies, or outdated information.

## Stored Observations:
${formatted}

## Instructions:
Find ANY pairs of observations that:
1. Directly contradict each other (e.g., "prefers morning" vs "works best at night")
2. Are logically inconsistent (e.g., "completes 2 tasks/day" but "overplans by taking 10 tasks")
3. Have temporal conflicts (older observation says X, newer says not-X but both remain)

IMPORTANT: Respond with ONLY a JSON object (no markdown fences):
{
  "contradictions": [
    {
      "obsA": 1,
      "obsB": 3,
      "type": "direct_conflict",
      "explanation": "Observation 1 says user overplans but observation 3 says user is a reliable planner"
    }
  ],
  "assessment": "Brief overall consistency assessment"
}

If no contradictions found, return: { "contradictions": [], "assessment": "Memory is consistent" }`
}

/**
 * Parse the LLM contradiction detection response.
 */
export function parseContradictionResponse(content: string): {
  contradictions: { obsA: number; obsB: number; type: string; explanation: string }[]
  assessment: string
} | null {
  try {
    // Strip markdown fences if present
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed && Array.isArray(parsed.contradictions)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// ============================================================================
// With/Without Context Delta (Mem0 benchmark pattern)
// ============================================================================

/**
 * Build a simple delta judge prompt that compares two responses:
 * one generated WITH memory context, one WITHOUT.
 */
export function buildContextDeltaJudgePrompt(
  question: string,
  responseWithContext: string,
  responseWithoutContext: string,
): string {
  return `You are evaluating whether injecting user memory context improves AI response quality.

## User's Question:
${question}

## Response A (WITHOUT memory context):
${responseWithoutContext}

## Response B (WITH memory context):
${responseWithContext}

## Instructions:
Compare the two responses. Rate each on a 1-10 scale for:
1. **Specificity**: How specific and actionable is the advice?
2. **Personalization**: Does it reference user-specific data?
3. **Actionability**: Can the user immediately act on it?

IMPORTANT: Respond with ONLY a JSON object (no markdown fences):
{
  "withoutContext": { "specificity": 3, "personalization": 1, "actionability": 4 },
  "withContext": { "specificity": 7, "personalization": 8, "actionability": 7 },
  "delta": 4.7,
  "assessment": "Memory context significantly improved personalization and specificity"
}`
}

/**
 * Parse the delta judge response.
 */
export function parseDeltaJudgeResponse(content: string): {
  withoutContext: { specificity: number; personalization: number; actionability: number }
  withContext: { specificity: number; personalization: number; actionability: number }
  delta: number
  assessment: string
} | null {
  try {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed && parsed.withoutContext && parsed.withContext) {
      // Recalculate delta to prevent LLM math errors
      const avgWith = (parsed.withContext.specificity + parsed.withContext.personalization + parsed.withContext.actionability) / 3
      const avgWithout = (parsed.withoutContext.specificity + parsed.withoutContext.personalization + parsed.withoutContext.actionability) / 3
      parsed.delta = Math.round((avgWith - avgWithout) * 10) / 10
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// ============================================================================
// Context Utilization (LLM-as-judge, full mode only)
// ============================================================================

export function buildMemoryJudgePrompt(
  question: string,
  response: string,
  memoryContext: string
): string {
  const rubricDescriptions = MEMORY_RUBRICS
    .map(r => `- **${r.name}** (weight: ${r.weight}): ${r.description}`)
    .join('\n')

  return `You are evaluating whether an AI assistant effectively uses stored user memory/context.

## Memory Context Available to the AI:
${memoryContext}

## User's Question:
${question}

## AI Assistant's Response:
${response}

## Scoring Rubrics:
${rubricDescriptions}

## Instructions:
Score how well the AI utilized the memory context. Rate each rubric 1-10 where:
- 1-3: Poor (ignored memory data, gave generic response)
- 4-6: Partial (mentioned some data but didn't deeply apply it)
- 7-8: Good (referenced specific memory data and applied it)
- 9-10: Excellent (deeply personalized using multiple memory sources)

IMPORTANT: Respond with ONLY a JSON object (no markdown fences):
{
  "scores": [
    { "rubricId": "context_citation", "score": 7, "reasoning": "..." },
    { "rubricId": "pattern_application", "score": 6, "reasoning": "..." },
    { "rubricId": "feedback_learning", "score": 5, "reasoning": "..." },
    { "rubricId": "personalization_depth", "score": 7, "reasoning": "..." }
  ],
  "overallAssessment": "Brief assessment of memory utilization quality"
}`
}

// ============================================================================
// Behavioral Metrics Assessment
// ============================================================================

export interface BehavioralInput {
  acceptanceRate: number    // 0-100
  editRate: number          // 0-100
  retryRate: number         // 0-100
  avgSessionDepth: number   // avg turns per chat session
  totalEvents: number
  chatSessions: number
}

/**
 * Assess behavioral proxy metrics from event tracking data.
 * Research: DX Research, Google Cloud Gen AI KPIs
 *
 * Thresholds:
 * - Acceptance rate: 60%+ good (DX Research warns against over-indexing)
 * - Edit rate: <30% good (high edit = close but wrong)
 * - Retry rate: <15% good (high retry = misunderstood intent)
 * - Session depth: 2+ good (single-turn = not engaging AI deeply)
 */
export function assessBehavioralMetrics(metrics: BehavioralInput): MemoryHealthSection {
  const checks: MemoryHealthCheck[] = []

  // Minimum data check
  if (metrics.totalEvents < 10) {
    return {
      id: 'behavioral',
      name: 'Usage Effectiveness',
      score: 0,
      weight: 0.15,
      checks: [{
        id: 'insufficient_data',
        name: 'Sufficient Data',
        status: 'warn',
        score: 0,
        value: `${metrics.totalEvents} events tracked (need 10+ for meaningful metrics)`,
        threshold: '10+ events',
        recommendation: 'Use AI features more to generate behavioral data for assessment',
      }],
    }
  }

  // Acceptance rate
  const acceptScore = Math.min(100, Math.round(metrics.acceptanceRate * 1.25)) // 80% → 100 score
  checks.push({
    id: 'acceptance_rate',
    name: 'Suggestion Acceptance Rate',
    status: metrics.acceptanceRate >= 60 ? 'pass' : metrics.acceptanceRate >= 40 ? 'warn' : 'fail',
    score: acceptScore,
    value: `${metrics.acceptanceRate}% accepted`,
    threshold: '60%+',
    recommendation: metrics.acceptanceRate < 40
      ? 'Low acceptance suggests AI suggestions are not relevant. Check if profile data is populated.'
      : undefined,
  })

  // Edit rate (lower is better)
  const editScore = Math.max(0, 100 - metrics.editRate * 2) // 0% edit → 100, 50% → 0
  checks.push({
    id: 'edit_rate',
    name: 'Edit Rate (of accepted)',
    status: metrics.editRate <= 30 ? 'pass' : metrics.editRate <= 50 ? 'warn' : 'fail',
    score: editScore,
    value: `${metrics.editRate}% of accepted suggestions were edited`,
    threshold: '<=30%',
    recommendation: metrics.editRate > 50
      ? 'High edit rate means suggestions are close but wrong. Profile may need more specific data.'
      : undefined,
  })

  // Retry rate (lower is better)
  const retryScore = Math.max(0, 100 - metrics.retryRate * 4) // 0% → 100, 25% → 0
  checks.push({
    id: 'retry_rate',
    name: 'Chat Retry Rate',
    status: metrics.retryRate <= 15 ? 'pass' : metrics.retryRate <= 30 ? 'warn' : 'fail',
    score: retryScore,
    value: `${metrics.retryRate}% of messages were retries/rephrases`,
    threshold: '<=15%',
    recommendation: metrics.retryRate > 30
      ? 'High retry rate suggests the AI misunderstands intent. May need better context injection.'
      : undefined,
  })

  // Session depth
  const depthScore = Math.min(100, Math.round(metrics.avgSessionDepth * 20)) // 5 turns → 100
  checks.push({
    id: 'session_depth',
    name: 'Average Session Depth',
    status: metrics.avgSessionDepth >= 3 ? 'pass' : metrics.avgSessionDepth >= 1.5 ? 'warn' : 'fail',
    score: depthScore,
    value: `${metrics.avgSessionDepth} turns per session (${metrics.chatSessions} sessions)`,
    threshold: '3+ turns',
    recommendation: metrics.avgSessionDepth < 1.5 && metrics.chatSessions > 2
      ? 'Very shallow sessions suggest users aren\'t finding the AI useful beyond single exchanges.'
      : undefined,
  })

  const overallScore = checks.length > 0
    ? Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length)
    : 0

  return {
    id: 'behavioral',
    name: 'Usage Effectiveness',
    score: overallScore,
    weight: 0.15,
    checks,
  }
}

// ============================================================================
// Report Generation
// ============================================================================

export function computeOverallScore(sections: MemoryHealthSection[]): number {
  let totalWeight = 0
  let weightedSum = 0
  for (const section of sections) {
    weightedSum += section.score * section.weight
    totalWeight += section.weight
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
}

export function computeMemoryGrade(score: number): string {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function generateRecommendations(
  sections: MemoryHealthSection[]
): { priority: 'high' | 'medium' | 'low'; action: string }[] {
  const recs: { priority: 'high' | 'medium' | 'low'; action: string }[] = []

  for (const section of sections) {
    for (const check of section.checks) {
      if (check.recommendation) {
        const priority: 'high' | 'medium' | 'low' =
          check.status === 'fail' ? 'high' :
          check.status === 'warn' ? 'medium' : 'low'
        recs.push({ priority, action: check.recommendation })
      }
    }
  }

  // Sort: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return recs
}

export function getMemoryGradeColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green'
  if (score >= 45) return 'yellow'
  return 'red'
}
