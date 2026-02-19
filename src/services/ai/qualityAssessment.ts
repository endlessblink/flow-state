/**
 * AI Quality Assessment v2 — Rubrics, Test Prompts, Rule Checks, and Scoring
 *
 * Improvements over v1:
 * - 1-5 categorical scale with explicit level definitions (LLMs score better)
 * - Rule-based pre-checks catch known-bad patterns instantly (free, deterministic)
 * - 25 test prompts across 7 categories for better coverage
 * - Chain-of-thought judge prompt (reasoning before scoring)
 * - Multi-run support with confidence intervals
 *
 * Used by: useAIQualityAssessment composable + scripts/test-ai-quality.cjs
 */

// ============================================================================
// Types
// ============================================================================

export interface QualityRubric {
  id: string
  name: string
  description: string
  weight: number // 1-3
  levels: Record<1 | 2 | 3 | 4 | 5, string> // Explicit definition per score level
}

export interface TestPrompt {
  id: string
  prompt: string
  category: 'analytical' | 'priority' | 'assessment' | 'greeting' | 'action' | 'language' | 'edge_case'
  expectedBehavior: string
  antiPatterns: string[]
}

export interface RubricScore {
  rubricId: string
  score: number // 1-5
  reasoning: string
}

/** Deterministic rule check result (no LLM needed) */
export interface RuleCheckResult {
  id: string
  name: string
  passed: boolean
  detail: string
}

/** Single run of a test prompt */
export interface TestRun {
  response: string
  rubricScores: RubricScore[]
  overallScore: number
  latencyMs: number
  judgeReasoning: string
}

export interface TestResult {
  promptId: string
  prompt: string
  category: string
  /** Best/representative response (from median run) */
  response: string
  rubricScores: RubricScore[]
  overallScore: number
  grade: string
  latencyMs: number
  judgeReasoning: string
  timestamp: string
  /** Rule-based pre-checks (deterministic, no LLM) */
  ruleChecks: RuleCheckResult[]
  /** Number of runs performed */
  runCount: number
  /** Standard deviation across runs (0 if single run) */
  scoreStdDev: number
  /** 95% confidence interval [low, high] */
  confidenceInterval: [number, number]
  /** All individual run results */
  runs: TestRun[]
}

export interface QualityReport {
  id: string
  results: TestResult[]
  averageScore: number
  grade: string
  provider: string
  model: string
  timestamp: string
  durationMs: number
  /** How many times each test was run */
  runsPerTest: number
  /** Overall rule check pass rate (0-1) */
  ruleCheckPassRate: number
}

// ============================================================================
// Rubrics (1-5 categorical scale)
// ============================================================================

export const QUALITY_RUBRICS: QualityRubric[] = [
  {
    id: 'analytical_depth',
    name: 'Analytical Depth',
    description: 'Does the AI THINK and analyze rather than just listing data?',
    weight: 3,
    levels: {
      1: 'Raw data dump, no analysis. Just lists tasks or shows tool output.',
      2: 'Minimal analysis. Mentions some tasks but doesn\'t weigh or compare them.',
      3: 'Adequate analysis. Identifies key items and provides basic reasoning.',
      4: 'Good analysis. Weighs multiple factors, explains trade-offs, gives reasoned conclusions.',
      5: 'Excellent analysis. Deep reasoning about priorities, context-aware trade-offs, anticipates follow-up needs.',
    },
  },
  {
    id: 'task_awareness',
    name: 'Task Awareness',
    description: 'Does the AI reference specific tasks by name from the user\'s data?',
    weight: 2,
    levels: {
      1: 'No reference to any specific tasks. Generic response ignoring user data.',
      2: 'Mentions 1-2 tasks vaguely without details (no dates, priorities, projects).',
      3: 'References several tasks with some context (names + at least one of: date, priority, project).',
      4: 'References relevant tasks with full context (name, date, priority, project).',
      5: 'Comprehensive awareness. References tasks by name, groups by project, notes overdue items, tracks in-progress work.',
    },
  },
  {
    id: 'recommendation_quality',
    name: 'Recommendation Quality',
    description: 'Are suggestions actionable with clear WHY reasoning?',
    weight: 3,
    levels: {
      1: 'No recommendations, or just restates what the user already knows.',
      2: 'Vague suggestions without reasoning ("you should focus on important tasks").',
      3: 'Some actionable suggestions with basic reasoning.',
      4: 'Clear, actionable recommendations with explained reasoning for each.',
      5: 'Outstanding recommendations: specific actions, clear reasoning, considers consequences and alternatives.',
    },
  },
  {
    id: 'priority_reasoning',
    name: 'Priority Reasoning',
    description: 'Does the AI properly weigh urgency, deadlines, and priority levels?',
    weight: 2,
    levels: {
      1: 'No priority reasoning. Lists items without ordering by importance.',
      2: 'Acknowledges priorities exist but doesn\'t use them to rank recommendations.',
      3: 'Uses priority levels or due dates to order recommendations.',
      4: 'Weighs both priority and due dates, identifies overdue items, explains urgency.',
      5: 'Sophisticated reasoning: weighs priority + due date + project context + workload, identifies critical path.',
    },
  },
  {
    id: 'no_data_dumps',
    name: 'No Data Dumps',
    description: 'Does the AI avoid showing raw JSON, tool syntax, field names, or unprocessed data?',
    weight: 3,
    levels: {
      1: 'Raw data dump: JSON, tool_call syntax, field names like "estimatedDuration", confidence percentages, arrow notation ("none → 30").',
      2: 'Mostly data with thin wrapper text. Shows structured fields/cards instead of prose.',
      3: 'Mix of analysis and data. Some raw elements leak through but mostly conversational.',
      4: 'Conversational response. No raw data visible. May have minor formatting issues.',
      5: 'Fully conversational and natural. Insights derived from data, never showing the data itself.',
    },
  },
  {
    id: 'language_compliance',
    name: 'Language Compliance',
    description: 'Does the AI respond in the same language the user writes?',
    weight: 3,
    levels: {
      1: 'Wrong language entirely (e.g., English response to Hebrew question).',
      2: 'Heavily mixed languages. More than 30% of response in wrong language.',
      3: 'Mostly correct language with some foreign words/phrases (beyond technical terms).',
      4: 'Correct language throughout with at most 1-2 technical terms in English.',
      5: 'Perfect language match. Natural, fluent response in the user\'s language.',
    },
  },
  {
    id: 'appropriate_length',
    name: 'Appropriate Length',
    description: 'Is the response appropriately sized for the question?',
    weight: 1,
    levels: {
      1: 'Severely wrong: one-liner for analytical question, or wall of text for greeting.',
      2: 'Too short or too long for the question type.',
      3: 'Acceptable length, slightly off for the context.',
      4: 'Good length that matches the question complexity.',
      5: 'Perfect length. Concise where appropriate, detailed where needed.',
    },
  },
]

// ============================================================================
// Test Prompts (25 prompts across 7 categories)
// ============================================================================

export const TEST_PROMPTS: TestPrompt[] = [
  // ── Analytical (5) ──
  {
    id: 'analytical_week',
    prompt: 'What should I focus on this week?',
    category: 'analytical',
    expectedBehavior: 'Analyze overdue tasks, upcoming deadlines, in-progress work, and provide a reasoned weekly plan',
    antiPatterns: ['Just listing all tasks', 'One-line response', 'Raw JSON output'],
  },
  {
    id: 'analytical_overwhelmed',
    prompt: 'I feel overwhelmed with my tasks. Help me figure out what to do.',
    category: 'analytical',
    expectedBehavior: 'Acknowledge the feeling, analyze workload, suggest what to defer/delegate/prioritize',
    antiPatterns: ['Listing all tasks without analysis', 'Generic productivity advice'],
  },
  {
    id: 'analytical_tomorrow',
    prompt: 'Plan my day for tomorrow.',
    category: 'analytical',
    expectedBehavior: 'Pick 3-5 tasks based on priority and deadlines, suggest time blocks, consider workload',
    antiPatterns: ['Listing everything', 'No time structure', 'Ignoring priorities'],
  },
  {
    id: 'analytical_stuck',
    prompt: 'I\'ve been procrastinating all day. What\'s the ONE thing I should do right now?',
    category: 'analytical',
    expectedBehavior: 'Pick a single specific task with reasoning, not a list. Be decisive.',
    antiPatterns: ['Giving a list instead of one item', 'Generic advice about procrastination'],
  },
  {
    id: 'analytical_delegate',
    prompt: 'Which tasks could I delegate or drop entirely?',
    category: 'analytical',
    expectedBehavior: 'Identify low-priority or low-value tasks, suggest specific ones to delegate/drop with reasoning',
    antiPatterns: ['Saying "it depends"', 'Not naming specific tasks'],
  },

  // ── Priority (4) ──
  {
    id: 'priority_urgent',
    prompt: 'What are my most urgent tasks right now?',
    category: 'priority',
    expectedBehavior: 'Identify overdue tasks first, then upcoming deadlines, explain why each is urgent',
    antiPatterns: ['Just listing tasks sorted by date', 'Showing tool call syntax'],
  },
  {
    id: 'priority_neglected',
    prompt: 'Are there any tasks I\'ve been neglecting?',
    category: 'priority',
    expectedBehavior: 'Find old/stale tasks, low-priority items getting pushed back repeatedly',
    antiPatterns: ['Only looking at overdue tasks', 'Not considering task age'],
  },
  {
    id: 'priority_conflict',
    prompt: 'I have a client presentation due tomorrow and a critical bug. Which do I handle first?',
    category: 'priority',
    expectedBehavior: 'Weigh both against each other considering impact, deadlines, and consequences',
    antiPatterns: ['Just picking one without reasoning', 'Suggesting both at once'],
  },
  {
    id: 'priority_overdue',
    prompt: 'Show me everything that\'s overdue.',
    category: 'priority',
    expectedBehavior: 'List overdue items with context about how late they are and severity, suggest triage order',
    antiPatterns: ['Raw list without analysis', 'No severity assessment'],
  },

  // ── Assessment (4) ──
  {
    id: 'assessment_progress',
    prompt: 'How am I doing on my projects overall?',
    category: 'assessment',
    expectedBehavior: 'Project-by-project assessment with completion rates, bottlenecks, suggestions',
    antiPatterns: ['Just listing project names', 'No progress estimation'],
  },
  {
    id: 'assessment_productivity',
    prompt: 'Analyze my productivity patterns. What could I improve?',
    category: 'assessment',
    expectedBehavior: 'Analyze completion rates, task aging, project balance, give specific suggestions',
    antiPatterns: ['Generic productivity tips', 'Not using actual task data'],
  },
  {
    id: 'assessment_backend',
    prompt: 'How is the Backend Rewrite project going? What\'s left?',
    category: 'assessment',
    expectedBehavior: 'Focus on Backend Rewrite tasks specifically, count done vs remaining, identify blockers',
    antiPatterns: ['Talking about all projects', 'Not filtering to Backend Rewrite'],
  },
  {
    id: 'assessment_capacity',
    prompt: 'Am I taking on too much? Be honest.',
    category: 'assessment',
    expectedBehavior: 'Count open tasks, in-progress items, overdue count, give honest capacity assessment',
    antiPatterns: ['Always saying "yes you\'re fine"', 'Not using actual numbers'],
  },

  // ── Greeting (2) ──
  {
    id: 'greeting_simple',
    prompt: 'Hi!',
    category: 'greeting',
    expectedBehavior: 'Respond warmly and briefly, optionally give a quick status snapshot',
    antiPatterns: ['Calling tools on a greeting', 'Long multi-paragraph response'],
  },
  {
    id: 'greeting_morning',
    prompt: 'Good morning! What\'s on my plate today?',
    category: 'greeting',
    expectedBehavior: 'Warm greeting + today\'s tasks due, brief prioritized overview',
    antiPatterns: ['Just a greeting without today\'s tasks', 'Dumping all tasks'],
  },

  // ── Action (3) ──
  {
    id: 'action_create',
    prompt: 'Create a task called "Review quarterly report" with high priority, due next Friday',
    category: 'action',
    expectedBehavior: 'Create the task and confirm with details, without showing JSON or tool syntax',
    antiPatterns: ['Showing raw JSON', 'Showing tool_call syntax', 'Not confirming'],
  },
  {
    id: 'action_update',
    prompt: 'Mark the authentication bug as done.',
    category: 'action',
    expectedBehavior: 'Confirm the task was updated, maybe congratulate on closing a critical bug',
    antiPatterns: ['Showing field changes like "status: done"', 'Raw data'],
  },
  {
    id: 'action_suggest',
    prompt: 'What priority should I set for the database migration?',
    category: 'action',
    expectedBehavior: 'Suggest a priority with reasoning based on deadlines and project context, don\'t just dump suggestions as cards',
    antiPatterns: ['Showing "Priority -> medium" card-style output', 'No reasoning for suggestion'],
  },

  // ── Language (4) ──
  {
    id: 'language_hebrew_urgent',
    prompt: '\u05DE\u05D4 \u05D4\u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05D4\u05DB\u05D9 \u05D3\u05D7\u05D5\u05E4\u05D5\u05EA \u05E9\u05DC\u05D9?',
    category: 'language',
    expectedBehavior: 'Respond ENTIRELY in Hebrew, analyzing urgent tasks with same quality as English',
    antiPatterns: ['Responding in English', 'Mixing Hebrew and English'],
  },
  {
    id: 'language_hebrew_analysis',
    prompt: '\u05EA\u05E0\u05EA\u05D7 \u05D0\u05EA \u05D4\u05E2\u05D5\u05DE\u05E1 \u05E9\u05DC\u05D9 \u05D5\u05EA\u05D2\u05D9\u05D3 \u05DC\u05D9 \u05DE\u05D4 \u05DC\u05E2\u05E9\u05D5\u05EA \u05D4\u05E9\u05D1\u05D5\u05E2',
    category: 'language',
    expectedBehavior: 'Full weekly analysis and action plan ENTIRELY in Hebrew',
    antiPatterns: ['Any English text', 'Tool syntax visible', 'Shallow analysis'],
  },
  {
    id: 'language_hebrew_project',
    prompt: '\u05D0\u05D9\u05DA \u05DE\u05EA\u05E7\u05D3\u05DD \u05D4\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8 \u05E9\u05DC \u05D4-Backend Rewrite?',
    category: 'language',
    expectedBehavior: 'Project assessment in Hebrew. OK to use "Backend Rewrite" as a proper noun.',
    antiPatterns: ['Response in English', 'Field names in English like "status: in_progress"'],
  },
  {
    id: 'language_hebrew_greeting',
    prompt: '\u05D4\u05D9\u05D9, \u05DE\u05D4 \u05E7\u05D5\u05E8\u05D4?',
    category: 'language',
    expectedBehavior: 'Casual Hebrew greeting, brief status. Natural and conversational.',
    antiPatterns: ['English response', 'Formal/robotic Hebrew', 'Tool dumps'],
  },

  // ── Edge Cases (3) ──
  {
    id: 'edge_empty',
    prompt: '',
    category: 'edge_case',
    expectedBehavior: 'Handle gracefully — offer help or show a brief status, don\'t crash or dump errors',
    antiPatterns: ['Error messages', 'Raw exceptions', 'Doing nothing'],
  },
  {
    id: 'edge_ambiguous',
    prompt: 'tasks',
    category: 'edge_case',
    expectedBehavior: 'Interpret as "show me my tasks" or ask for clarification politely',
    antiPatterns: ['Raw task list dump', 'JSON output', 'Confusion/error'],
  },
  {
    id: 'edge_nonsense',
    prompt: 'asdfjkl;',
    category: 'edge_case',
    expectedBehavior: 'Handle gracefully — say it didn\'t understand and offer to help',
    antiPatterns: ['Trying to interpret as a real request', 'Error dump', 'Tool calls'],
  },
]

// ============================================================================
// Rule-Based Pre-Checks (deterministic, no LLM needed)
// ============================================================================

/**
 * Run deterministic rule checks on an AI response.
 * These catch known-bad patterns instantly without needing an LLM judge.
 * Each check is binary (pass/fail) and 100% reliable.
 */
export function runRuleChecks(response: string, prompt: string, category: string): RuleCheckResult[] {
  const checks: RuleCheckResult[] = []

  // 1. Not empty
  checks.push({
    id: 'not_empty',
    name: 'Response Not Empty',
    passed: response.trim().length > 0,
    detail: response.trim().length > 0 ? 'Response has content' : 'Response is empty',
  })

  // 2. No raw JSON
  const hasRawJson = /\{[\s\S]*"[a-zA-Z_]+"[\s\S]*:[\s\S]*\}/.test(response) &&
    (response.includes('"tool"') || response.includes('"parameters"') || response.includes('"rubricId"'))
  checks.push({
    id: 'no_raw_json',
    name: 'No Raw JSON',
    passed: !hasRawJson,
    detail: hasRawJson ? 'Contains raw JSON structures' : 'No raw JSON found',
  })

  // 3. No tool call syntax
  const hasToolSyntax = /tool_call|__tool__|tool_name|function_call|\btool\b\s*:\s*"/.test(response)
  checks.push({
    id: 'no_tool_syntax',
    name: 'No Tool Call Syntax',
    passed: !hasToolSyntax,
    detail: hasToolSyntax ? 'Contains tool call syntax' : 'No tool syntax found',
  })

  // 4. No field name dumps (camelCase technical fields shown to user)
  const fieldDumpPattern = /\b(estimatedDuration|projectId|dueDate|taskId|parentId|canvasPosition|_soft_deleted)\b/i
  const hasFieldDumps = fieldDumpPattern.test(response)
  checks.push({
    id: 'no_field_dumps',
    name: 'No Technical Field Names',
    passed: !hasFieldDumps,
    detail: hasFieldDumps ? 'Contains technical field names (e.g., estimatedDuration, projectId)' : 'No field names exposed',
  })

  // 5. No confidence percentages (tool suggestion artifacts like "80%")
  const hasConfidencePattern = /\b\d{1,3}%\b/.test(response) &&
    /(confidence|certainty|probability|score)/i.test(response)
  checks.push({
    id: 'no_confidence_scores',
    name: 'No Confidence Percentages',
    passed: !hasConfidencePattern,
    detail: hasConfidencePattern ? 'Contains confidence/probability percentages' : 'No confidence scores exposed',
  })

  // 6. No arrow notation (data transformation artifacts like "none → 30")
  const arrowPattern = /\bnone\s*\u2192|→\s*\w+\s*$/m
  const hasArrowNotation = arrowPattern.test(response)
  checks.push({
    id: 'no_arrow_notation',
    name: 'No Arrow Data Notation',
    passed: !hasArrowNotation,
    detail: hasArrowNotation ? 'Contains "none \u2192 value" data transformation notation' : 'No arrow notation found',
  })

  // 7. Minimum length for analytical questions
  const isAnalytical = ['analytical', 'priority', 'assessment'].includes(category)
  const minLength = isAnalytical ? 100 : 20
  checks.push({
    id: 'minimum_length',
    name: `Min Length (${minLength} chars)`,
    passed: response.trim().length >= minLength,
    detail: `Response is ${response.trim().length} chars (min: ${minLength})`,
  })

  // 8. Language check for Hebrew prompts
  if (category === 'language' || /[\u0590-\u05FF]/.test(prompt)) {
    // Count Hebrew vs Latin characters (excluding digits, punctuation, spaces)
    const hebrewChars = (response.match(/[\u0590-\u05FF]/g) || []).length
    const latinChars = (response.match(/[a-zA-Z]/g) || []).length
    // Allow some Latin for proper nouns/technical terms (up to 20%)
    const totalAlpha = hebrewChars + latinChars
    const hebrewRatio = totalAlpha > 0 ? hebrewChars / totalAlpha : 0
    const passed = hebrewRatio >= 0.7 // At least 70% Hebrew characters
    checks.push({
      id: 'hebrew_language',
      name: 'Hebrew Language',
      passed,
      detail: `Hebrew ratio: ${(hebrewRatio * 100).toFixed(0)}% (${hebrewChars} Hebrew, ${latinChars} Latin chars)`,
    })
  }

  // 9. Not just a tool result card (detects structured suggestion format)
  const toolResultPattern = /(?:\u2192|->)\s*(?:[\w-]+|"[^"]*")\s*$/m
  const looksLikeToolResults = (response.match(toolResultPattern) || []).length >= 2
  checks.push({
    id: 'no_tool_result_cards',
    name: 'Not Tool Result Cards',
    passed: !looksLikeToolResults,
    detail: looksLikeToolResults ? 'Response looks like structured tool result cards' : 'Response is conversational',
  })

  return checks
}

// ============================================================================
// Judge Prompt Builder (Chain-of-Thought, 1-5 scale)
// ============================================================================

/**
 * Build the judge prompt with chain-of-thought reasoning.
 * Judge reasons through each rubric BEFORE assigning a score.
 */
export function buildJudgePrompt(
  question: string,
  category: string,
  response: string,
  rubrics: QualityRubric[]
): string {
  const rubricDescriptions = rubrics
    .map(r => {
      const levels = Object.entries(r.levels)
        .map(([score, desc]) => `    ${score}: ${desc}`)
        .join('\n')
      return `- **${r.name}** (weight: ${r.weight}): ${r.description}\n${levels}`
    })
    .join('\n\n')

  return `You are an AI quality judge. Evaluate this productivity assistant's response.

## Context
- Test Category: ${category}
- User's Question: "${question}"

## AI Assistant's Response:
---
${response}
---

## Scoring Rubrics (1-5 scale):
${rubricDescriptions}

## Instructions:
For each rubric:
1. THINK about what the rubric requires
2. Examine the response for evidence
3. Match to the closest level definition
4. Assign the score

CRITICAL rules for accurate scoring:
- A response that dumps raw data/JSON/tool results = score 1 on "No Data Dumps"
- A response showing field names like "estimatedDuration" or arrows like "none \u2192 30" = score 1 on "No Data Dumps"
- A response in the wrong language = score 1 on "Language Compliance"
- Do NOT favor longer responses automatically. Judge substance, not length.
- Do NOT inflate scores. If the response is mediocre, give a 3, not a 4.

Respond with ONLY a JSON object (no markdown fences):
{
  "scores": [
    { "rubricId": "analytical_depth", "score": 3, "reasoning": "..." },
    { "rubricId": "task_awareness", "score": 4, "reasoning": "..." },
    { "rubricId": "recommendation_quality", "score": 2, "reasoning": "..." },
    { "rubricId": "priority_reasoning", "score": 3, "reasoning": "..." },
    { "rubricId": "no_data_dumps", "score": 5, "reasoning": "..." },
    { "rubricId": "language_compliance", "score": 5, "reasoning": "..." },
    { "rubricId": "appropriate_length", "score": 4, "reasoning": "..." }
  ],
  "overallAssessment": "Brief overall assessment"
}`
}

// ============================================================================
// Judge Response Parser
// ============================================================================

/**
 * Parse judge response, handling markdown-wrapped JSON.
 */
export function parseJudgeResponse(raw: string): { scores: RubricScore[]; overallAssessment: string } | null {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(raw)
    if (parsed.scores && Array.isArray(parsed.scores)) {
      return {
        scores: parsed.scores.map((s: any) => ({
          rubricId: s.rubricId,
          score: Math.min(5, Math.max(1, Number(s.score) || 3)),
          reasoning: s.reasoning || '',
        })),
        overallAssessment: parsed.overallAssessment || '',
      }
    }
  } catch {
    // Not direct JSON
  }

  // Try extracting JSON from markdown code blocks
  const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.scores && Array.isArray(parsed.scores)) {
        return {
          scores: parsed.scores.map((s: any) => ({
            rubricId: s.rubricId,
            score: Math.min(5, Math.max(1, Number(s.score) || 3)),
            reasoning: s.reasoning || '',
          })),
          overallAssessment: parsed.overallAssessment || '',
        }
      }
    } catch {
      // Failed
    }
  }

  // Regex fallback
  const scores: RubricScore[] = []
  const scorePattern = /"rubricId"\s*:\s*"([^"]+)"\s*,\s*"score"\s*:\s*(\d+)\s*,\s*"reasoning"\s*:\s*"([^"]*)"/g
  let match
  while ((match = scorePattern.exec(raw)) !== null) {
    scores.push({
      rubricId: match[1],
      score: Math.min(5, Math.max(1, Number(match[2]))),
      reasoning: match[3],
    })
  }

  if (scores.length > 0) {
    return { scores, overallAssessment: '' }
  }

  return null
}

// ============================================================================
// Scoring Utilities
// ============================================================================

/** Compute weighted average score from rubric scores. */
export function computeWeightedScore(rubricScores: RubricScore[], rubrics: { id: string; weight: number }[]): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const rs of rubricScores) {
    const rubric = rubrics.find(r => r.id === rs.rubricId)
    const weight = rubric?.weight ?? 1
    weightedSum += rs.score * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/** Compute letter grade from 1-5 score. */
export function computeGrade(score: number): string {
  if (score >= 4.2) return 'A'
  if (score >= 3.5) return 'B'
  if (score >= 2.8) return 'C'
  if (score >= 2.0) return 'D'
  return 'F'
}

/** Get color class for a 1-5 score. */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 3.5) return 'green'
  if (score >= 2.5) return 'yellow'
  return 'red'
}

/** Compute standard deviation of an array of numbers. */
export function computeStdDev(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => (v - mean) ** 2)
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1))
}

/** Compute 95% confidence interval for a set of scores. */
export function computeConfidenceInterval(values: number[]): [number, number] {
  if (values.length <= 1) return [values[0] || 0, values[0] || 0]
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const stdDev = computeStdDev(values)
  const margin = 1.96 * (stdDev / Math.sqrt(values.length))
  return [Math.max(1, mean - margin), Math.min(5, mean + margin)]
}
