/**
 * AI Quality Assessment - Rubrics, Test Prompts, and Scoring Utilities
 *
 * Provides the data and logic for evaluating AI response quality using
 * an LLM-as-judge approach. Test prompts are sent to the configured AI,
 * and a separate judge call scores the responses against weighted rubrics.
 *
 * Used by: useAIQualityAssessment composable
 */

// ============================================================================
// Types
// ============================================================================

export interface QualityRubric {
  id: string
  name: string
  description: string
  weight: number // 1-3
}

export interface TestPrompt {
  id: string
  prompt: string
  category: 'analytical' | 'priority' | 'assessment' | 'greeting' | 'action' | 'language'
  expectedBehavior: string
  antiPatterns: string[]
}

export interface RubricScore {
  rubricId: string
  score: number // 1-10
  reasoning: string
}

export interface TestResult {
  promptId: string
  prompt: string
  category: string
  response: string
  rubricScores: RubricScore[]
  overallScore: number
  grade: string
  latencyMs: number
  judgeReasoning: string
  timestamp: string
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
}

// ============================================================================
// Rubrics
// ============================================================================

export const QUALITY_RUBRICS: QualityRubric[] = [
  {
    id: 'analytical_depth',
    name: 'Analytical Depth',
    description: 'Does the AI THINK and analyze rather than just listing data? Does it weigh factors, consider trade-offs, and provide reasoned conclusions?',
    weight: 3,
  },
  {
    id: 'task_awareness',
    name: 'Task Awareness',
    description: 'Does the AI reference specific tasks by name, acknowledge due dates, priorities, and project context from the user\'s actual data?',
    weight: 2,
  },
  {
    id: 'recommendation_quality',
    name: 'Recommendation Quality',
    description: 'Are suggestions actionable with clear reasoning? Does the AI explain WHY something should be prioritized, not just WHAT?',
    weight: 3,
  },
  {
    id: 'priority_reasoning',
    name: 'Priority Reasoning',
    description: 'Does the AI properly weigh urgency, deadlines, overdue items, and priority levels when making recommendations?',
    weight: 2,
  },
  {
    id: 'no_data_dumps',
    name: 'No Data Dumps',
    description: 'Does the AI avoid showing raw JSON, tool call syntax, one-liner responses, or just repeating task lists without analysis?',
    weight: 2,
  },
  {
    id: 'language_compliance',
    name: 'Language Compliance',
    description: 'Does the AI respond entirely in the same language the user writes in? No mixing languages.',
    weight: 3,
  },
  {
    id: 'appropriate_length',
    name: 'Appropriate Length',
    description: 'Is the response appropriately sized? Not too short (one-liners) and not an overwhelming wall of text?',
    weight: 1,
  },
]

// ============================================================================
// Test Prompts
// ============================================================================

export const TEST_PROMPTS: TestPrompt[] = [
  {
    id: 'analytical_week',
    prompt: 'What should I focus on this week?',
    category: 'analytical',
    expectedBehavior: 'Should analyze overdue tasks, upcoming deadlines, in-progress work, and provide a reasoned weekly plan with clear priorities',
    antiPatterns: ['Just listing all tasks', 'One-line response', 'Raw JSON output'],
  },
  {
    id: 'analytical_overwhelmed',
    prompt: 'I feel overwhelmed with my tasks. Help me figure out what to do.',
    category: 'analytical',
    expectedBehavior: 'Should acknowledge the feeling, analyze workload, suggest what to defer/delegate/prioritize, and give a clear action plan',
    antiPatterns: ['Listing all tasks without analysis', 'Generic productivity advice without referencing actual tasks'],
  },
  {
    id: 'priority_urgent',
    prompt: 'What are my most urgent tasks right now?',
    category: 'priority',
    expectedBehavior: 'Should identify overdue tasks first, then upcoming deadlines, weigh priority levels, and explain why each is urgent',
    antiPatterns: ['Just listing tasks sorted by date', 'Showing tool call syntax', 'Not explaining urgency reasoning'],
  },
  {
    id: 'priority_neglected',
    prompt: 'Are there any tasks I\'ve been neglecting?',
    category: 'priority',
    expectedBehavior: 'Should find old tasks with no recent activity, low-priority items that keep getting pushed back, and stale in-progress tasks',
    antiPatterns: ['Only looking at overdue tasks', 'Not considering task age or staleness'],
  },
  {
    id: 'assessment_progress',
    prompt: 'How am I doing on my projects overall?',
    category: 'assessment',
    expectedBehavior: 'Should give a project-by-project assessment with completion rates, bottlenecks, and suggestions for each active project',
    antiPatterns: ['Just listing project names', 'Not calculating or estimating progress'],
  },
  {
    id: 'assessment_productivity',
    prompt: 'Analyze my productivity patterns. What could I improve?',
    category: 'assessment',
    expectedBehavior: 'Should analyze completion rates, task aging patterns, project balance, and give specific improvement suggestions',
    antiPatterns: ['Generic productivity tips', 'Not using actual task data for analysis'],
  },
  {
    id: 'greeting_simple',
    prompt: 'Hi!',
    category: 'greeting',
    expectedBehavior: 'Should respond warmly, briefly mention what it can help with, optionally give a quick status snapshot',
    antiPatterns: ['Calling tools on a greeting', 'Long multi-paragraph response', 'Asking what the user wants without offering anything'],
  },
  {
    id: 'action_create',
    prompt: 'Create a task called "Review quarterly report" with high priority, due next Friday',
    category: 'action',
    expectedBehavior: 'Should create the task and confirm with details, without showing JSON or tool call syntax',
    antiPatterns: ['Showing raw JSON', 'Showing tool_call syntax', 'Not confirming the action was taken'],
  },
  {
    id: 'language_hebrew',
    prompt: 'מה המשימות הכי דחופות שלי?',
    category: 'language',
    expectedBehavior: 'Should respond ENTIRELY in Hebrew, analyzing urgent tasks with the same quality as English responses',
    antiPatterns: ['Responding in English', 'Mixing Hebrew and English', 'Lower quality analysis just because of Hebrew'],
  },
  {
    id: 'language_hebrew_analysis',
    prompt: 'תנתח את העומס שלי ותגיד לי מה לעשות השבוע',
    category: 'language',
    expectedBehavior: 'Should respond ENTIRELY in Hebrew with a full weekly analysis and action plan',
    antiPatterns: ['Any English text in the response', 'Tool syntax visible', 'Shallow analysis'],
  },
]

// ============================================================================
// Judge Prompt Builder
// ============================================================================

/**
 * Build the judge prompt for LLM-as-judge scoring.
 */
export function buildJudgePrompt(
  question: string,
  category: string,
  response: string,
  rubrics: QualityRubric[]
): string {
  const rubricDescriptions = rubrics
    .map(r => `- **${r.name}** (weight: ${r.weight}): ${r.description}`)
    .join('\n')

  return `You are an AI quality judge evaluating a productivity assistant's response.

## Test Category: ${category}

## User's Question:
${question}

## AI Assistant's Response:
${response}

## Scoring Rubrics:
${rubricDescriptions}

## Instructions:
Score the AI's response on each rubric from 1-10 where:
- 1-3: Poor (fails the criteria)
- 4-6: Acceptable (partially meets criteria)
- 7-8: Good (meets criteria well)
- 9-10: Excellent (exceeds expectations)

IMPORTANT: Respond with ONLY a JSON object (no markdown fences, no extra text):
{
  "scores": [
    { "rubricId": "analytical_depth", "score": 7, "reasoning": "..." },
    { "rubricId": "task_awareness", "score": 8, "reasoning": "..." },
    { "rubricId": "recommendation_quality", "score": 6, "reasoning": "..." },
    { "rubricId": "priority_reasoning", "score": 7, "reasoning": "..." },
    { "rubricId": "no_data_dumps", "score": 9, "reasoning": "..." },
    { "rubricId": "language_compliance", "score": 10, "reasoning": "..." },
    { "rubricId": "appropriate_length", "score": 8, "reasoning": "..." }
  ],
  "overallAssessment": "Brief overall assessment of the response quality"
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
          score: Number(s.score) || 5,
          reasoning: s.reasoning || '',
        })),
        overallAssessment: parsed.overallAssessment || '',
      }
    }
  } catch {
    // Not direct JSON, try extracting from markdown
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
            score: Number(s.score) || 5,
            reasoning: s.reasoning || '',
          })),
          overallAssessment: parsed.overallAssessment || '',
        }
      }
    } catch {
      // Failed to parse extracted JSON
    }
  }

  // Last resort: regex extraction for individual scores
  const scores: RubricScore[] = []
  const scorePattern = /"rubricId"\s*:\s*"([^"]+)"\s*,\s*"score"\s*:\s*(\d+)\s*,\s*"reasoning"\s*:\s*"([^"]*)"/g
  let match
  while ((match = scorePattern.exec(raw)) !== null) {
    scores.push({
      rubricId: match[1],
      score: Number(match[2]),
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

/**
 * Compute weighted average score from rubric scores.
 */
export function computeWeightedScore(rubricScores: RubricScore[], rubrics: QualityRubric[]): number {
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

/**
 * Compute letter grade from numeric score.
 */
export function computeGrade(score: number): string {
  if (score >= 8) return 'A'
  if (score >= 7) return 'B'
  if (score >= 6) return 'C'
  if (score >= 5) return 'D'
  return 'F'
}

/**
 * Get CSS color class for a score.
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 7) return 'green'
  if (score >= 5) return 'yellow'
  return 'red'
}
