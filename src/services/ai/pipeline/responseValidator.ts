/**
 * Response Validator for AI Chat Pipeline
 *
 * Consolidates all response cleaning from useAIChat.ts and ChatMessage.vue
 * into a single, testable post-processing guardrail.
 *
 * Strips: tool blocks, raw JSON, tool names, preamble lines, UUIDs,
 * technical field dumps, confidence scores, HTML tags.
 *
 * @see TASK-1378 in MASTER_PLAN.md
 */

import type { PostGuardrail } from './types'

/** All known AI tool names (kept in sync with tools.ts AI_TOOLS) */
const TOOL_NAMES = [
  'list_tasks', 'get_overdue_tasks', 'search_tasks', 'get_daily_summary',
  'get_timer_status', 'get_productivity_stats', 'suggest_next_task',
  'get_weekly_summary', 'get_gamification_status', 'get_active_challenges',
  'get_achievements_near_completion', 'list_projects', 'list_groups',
  'create_task', 'update_task', 'delete_task', 'mark_task_done',
  'start_timer', 'stop_timer', 'bulk_update_tasks', 'bulk_delete_tasks',
]

/** UUID v4 pattern (partial — enough to detect task IDs) */
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

// ── Format enforcement ──────────────────────────────────────────────────────

/**
 * Check if text already has structural formatting.
 * Returns true if bullets, numbered lists, or multiple content lines exist.
 */
function hasStructure(text: string): boolean {
  // Bullet points (-, •, *)
  if (/^\s*[-•*]\s+\S/m.test(text)) return true
  // Numbered lists (1., 2., 1), etc.)
  if (/^\s*\d+[.)]\s+\S/m.test(text)) return true
  // Markdown headings
  if (/^#+\s+/m.test(text)) return true
  // Already multi-line with 3+ content lines (paragraphs, etc.)
  const contentLines = text.split('\n').filter(l => l.trim().length > 0)
  if (contentLines.length >= 3) return true
  return false
}

/**
 * Enforce structured format on wall-of-text LLM responses.
 *
 * When the LLM ignores formatting instructions and returns a single long
 * paragraph, this function splits it into an intro sentence + bullet points.
 *
 * Only activates when ALL conditions are met:
 * - Response is > 200 characters (short responses left as-is)
 * - No existing structure detected (bullets, numbers, headings, multi-line)
 * - At least 3 sentences detected (otherwise not enough to structure)
 *
 * Handles both English and Hebrew sentence boundaries.
 */
export function enforceStructuredFormat(text: string): string {
  if (!text || text.length < 200) return text
  if (hasStructure(text)) return text

  // Split on sentence boundaries: period/exclamation/question + space + letter
  // Handles both Latin (A-Z) and Hebrew (\u0590-\u05FF) sentence starts
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z\u0590-\u05FF])/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (sentences.length < 3) return text

  // First sentence is the intro, rest become bullet points
  const intro = sentences[0]
  const bullets = sentences.slice(1).map(s => `- ${s}`)

  return `${intro}\n\n${bullets.join('\n')}`
}

/**
 * Strip all known artifacts from LLM response text.
 * This is a pure function — no side effects.
 */
export function cleanResponse(text: string): string {
  if (!text) return ''

  let cleaned = text

  // 1. Strip ```json tool call blocks (from useAIChat.ts stripToolBlocks)
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '')

  // 2. Strip bare JSON tool calls (models sometimes output without code fences)
  cleaned = cleaned.replace(/\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[^}]*\}\s*\}/g, '')

  // 3. Strip "I'll use the X tool" preamble lines
  cleaned = cleaned.replace(/^I['']ll (?:use|call|invoke) the \w[\w\s]* tool.*$/gm, '')

  // 4. Strip standalone tool name references
  const toolNamePattern = TOOL_NAMES.map(n => n.replace(/_/g, '[_ ]')).join('|')
  cleaned = cleaned.replace(new RegExp(`\\b(${toolNamePattern})\\b`, 'g'), '')

  // 5. Strip UUIDs (task IDs leaking into response text)
  cleaned = cleaned.replace(UUID_PATTERN, '')

  // 6. Strip raw HTML tags that AI models may hallucinate
  cleaned = cleaned.replace(/<[^>]+>/g, '')

  // 7. Strip technical field names (JSON-style key dumps)
  cleaned = cleaned.replace(/\b(taskId|projectId|groupId|_soft_deleted|is_deleted|created_at|updated_at|canvasPosition)\b:?\s*/gi, '')

  // 8. Strip confidence percentage patterns ("I'm 85% confident", "confidence: 92%")
  cleaned = cleaned.replace(/\b\d{1,3}%\s*(confident|confidence|sure|certain)\b/gi, '')
  cleaned = cleaned.replace(/\b(confidence|certainty)\s*[:=]\s*\d{1,3}%/gi, '')

  // 9. Clean up extra blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  // 10. Enforce structured format on wall-of-text responses
  cleaned = enforceStructuredFormat(cleaned)

  return cleaned
}

/**
 * Post-processing guardrail that validates and cleans LLM responses.
 * Registered in the pipeline via configurePipeline().
 */
export const responseValidatorGuardrail: PostGuardrail = (input) => {
  return {
    ...input,
    rawResponse: cleanResponse(input.rawResponse),
  }
}
