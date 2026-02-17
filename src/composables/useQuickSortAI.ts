/**
 * Quick Sort AI Commands Composable (TASK-1221)
 *
 * Provides 1 AI-powered action for the Quick Sort workflow:
 * - autoSuggest: Suggest priority, date, project for current task (one at a time)
 *
 * Reuses AI Router singleton pattern from useAITaskAssist.ts
 */

import { ref, computed } from 'vue'
import { getSharedRouter } from '@/services/ai/routerFactory'
import type { ChatMessage as RouterChatMessage } from '@/services/ai/types'
import type { Task } from '@/types/tasks'
import type { SmartSuggestion } from '@/composables/useAITaskAssist'

import { useProjectStore } from '@/stores/projects'
import { getAIUserContext } from '@/services/ai/userContext'

// ============================================================================
// Types
// ============================================================================

export type AIAction = 'suggest'

// ============================================================================
// Router Singleton (same pattern as useAITaskAssist)
// ============================================================================

// TASK-1350: Use shared router singleton (reads user's API key from settings)
async function getRouter() {
  return getSharedRouter()
}

// ============================================================================
// Language Detection (copied from useAITaskAssist to avoid coupling)
// ============================================================================

function detectLanguageInstruction(text: string): string {
  if (!text) return ''
  const rtlChars = text.match(/[\u0590-\u05FF\u0600-\u06FF]/g)
  if (rtlChars && rtlChars.length > text.replace(/\s/g, '').length * 0.3) {
    const hebrewChars = text.match(/[\u0590-\u05FF]/g)
    if (hebrewChars && hebrewChars.length > 0) {
      return ' IMPORTANT: The user writes in Hebrew. Write ALL text values in Hebrew. JSON keys must remain in English.'
    }
    const arabicChars = text.match(/[\u0600-\u06FF]/g)
    if (arabicChars && arabicChars.length > 0) {
      return ' IMPORTANT: The user writes in Arabic. Write ALL text values in Arabic. JSON keys must remain in English.'
    }
    return ' IMPORTANT: Respond with text values in the same language as the user\'s task. JSON keys must remain in English.'
  }
  return ''
}

// ============================================================================
// JSON Parsing (copied from useAITaskAssist to avoid coupling)
// ============================================================================

function parseAIResponse<T>(content: string): T | null {
  try { return JSON.parse(content) }
  catch { /* continue */ }

  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]) }
    catch { /* continue */ }
  }

  const braceMatch = content.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]) }
    catch { /* continue */ }
  }

  const arrayMatch = content.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]) as T }
    catch { /* continue */ }
  }

  return null
}

// ============================================================================
// Composable
// ============================================================================

export function useQuickSortAI() {
  // State
  const aiState = ref<'idle' | 'loading' | 'preview' | 'error'>('idle')
  const aiAction = ref<AIAction | null>(null)
  const aiError = ref<string | null>(null)

  // Auto-suggest state
  const currentSuggestions = ref<SmartSuggestion[]>([])
  const suggestedProjectId = ref<string | null>(null)
  const suggestedProjectName = ref<string | null>(null)

  const isAIBusy = computed(() => aiState.value === 'loading')

  let aborted = false

  // ============================================================================
  // Helpers
  // ============================================================================

  function resetForAction(action: AIAction) {
    aiState.value = 'loading'
    aiAction.value = action
    aiError.value = null
    aborted = false
  }

  function failWithError(message: string) {
    aiError.value = message
    aiState.value = 'error'
    aiAction.value = null
  }

  async function streamAI(messages: RouterChatMessage[]): Promise<string> {
    const router = await getRouter()
    let fullContent = ''
    for await (const chunk of router.chatStream(messages, { taskType: 'suggestion' })) {
      if (aborted) throw new Error('Aborted')
      fullContent += chunk.content
    }
    return fullContent
  }

  function getProjectContext(): string {
    const projectStore = useProjectStore()
    const projects = projectStore.projects
    if (projects.length === 0) return 'No projects available'
    return projects.map(p => `${p.id}: "${p.name}"`).join(', ')
  }

  // ============================================================================
  // 1. Auto Suggest (single task)
  // ============================================================================

  async function autoSuggest(task: Task) {
    resetForAction('suggest')
    try {
      const langHint = detectLanguageInstruction(task.title)
      const today = new Date().toISOString().split('T')[0]
      const projectCtx = getProjectContext()
      const descSnippet = task.description ? task.description.slice(0, 100) : ''
      const userContext = await getAIUserContext('quicksort')

      const systemPrompt = `You are a task triage assistant in a Quick Sort workflow. The user is rapidly categorizing uncategorized tasks one at a time. Your job: suggest metadata ONLY when the task title/description clearly implies a specific value.

Return ONLY valid JSON:
{ "suggestions": [{ "field": "priority|dueDate|estimatedDuration|projectId", "value": ..., "confidence": 0.0-1.0, "reason": "..." }] }

## Field Rules

**priority** ("high" | "medium" | "low"):
- "high": deadline pressure, blocking others, urgent keywords (ASAP, urgent, broken, outage, overdue)
- "low": nice-to-have, someday, research, explore, optional
- Do NOT suggest "medium" as a default — only suggest priority when the task clearly implies one

**dueDate** ("YYYY-MM-DD"):
- ONLY suggest when the title mentions a specific time reference ("by Friday", "before the meeting", "this week", "tomorrow")
- For "this week" → next Friday. For "today/tonight" → today. For "tomorrow" → tomorrow.
- NEVER guess a date when no time reference exists — omit the field entirely

**estimatedDuration** (minutes: 15 | 30 | 60 | 90 | 120):
- Quick actions (email, call, review) → 15
- Standard tasks (write, fix, implement small thing) → 30
- Larger work (design, plan, build feature) → 60-120
- Only suggest when task scope is reasonably clear from the title

**projectId** (one of the provided IDs):
- ONLY suggest when the task title clearly names or strongly implies a specific project
- "Fix login bug" → probably belongs to an auth/app project
- "Buy groceries" → no project match, omit entirely

## Critical Rules
- NEVER suggest a field just to fill it in — empty is better than a bad guess
- confidence 0.85+ = obvious from task content, 0.7-0.84 = reasonable inference. Below 0.7 = don't include it.
- reason: ONE sentence explaining why THIS specific task gets THIS value. Never generic like "tasks should have priorities".
- If the task is too vague to suggest anything meaningful, return { "suggestions": [] }` + langHint + userContext

      const userPrompt = `Task: "${task.title}"${descSnippet ? `\nDescription: "${descSnippet}"` : ''}
Current: priority=${task.priority || 'none'}, dueDate=${task.dueDate || 'none'}, estimatedDuration=${task.estimatedDuration || 'none'}
Available projects: ${projectCtx}
Today: ${today}`

      const messages: RouterChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{
        suggestions: Array<{ field: string; value: string | number; confidence: number; reason: string }>
      }>(raw)

      if (!parsed?.suggestions || !Array.isArray(parsed.suggestions)) {
        const fallback = getFallbackSuggestions(task)
        currentSuggestions.value = fallback
        suggestedProjectId.value = null
        suggestedProjectName.value = null
        aiState.value = fallback.length > 0 ? 'preview' : 'idle'
        return
      }

      // Separate project suggestions from standard SmartSuggestion fields
      const projectSuggestion = parsed.suggestions.find(s => s.field === 'projectId')
      if (projectSuggestion) {
        const projectStore = useProjectStore()
        const project = projectStore.projects.find(p => p.id === String(projectSuggestion.value))
        suggestedProjectId.value = project ? project.id : null
        suggestedProjectName.value = project ? project.name : null
      } else {
        suggestedProjectId.value = null
        suggestedProjectName.value = null
      }

      // Validate and normalize standard suggestions
      const validFields = new Set(['priority', 'dueDate', 'estimatedDuration'])
      const validPriorities = new Set(['high', 'medium', 'low'])
      const validDurations = new Set([15, 30, 60, 90, 120])

      const currentValues: Record<string, string | number | null> = {
        priority: task.priority || null,
        dueDate: task.dueDate || null,
        estimatedDuration: task.estimatedDuration || null
      }

      const suggestions: SmartSuggestion[] = parsed.suggestions
        .filter(s => validFields.has(s.field))
        .filter(s => {
          if (s.field === 'priority') return validPriorities.has(String(s.value))
          if (s.field === 'dueDate') return /^\d{4}-\d{2}-\d{2}$/.test(String(s.value))
          if (s.field === 'estimatedDuration') return validDurations.has(Number(s.value))
          return false
        })
        .filter(s => String(s.value) !== String(currentValues[s.field]))
        .map(s => ({
          field: s.field as SmartSuggestion['field'],
          currentValue: currentValues[s.field],
          suggestedValue: s.field === 'estimatedDuration' ? Number(s.value) : s.value,
          confidence: Math.max(0, Math.min(1, s.confidence)),
          reasoning: s.reason || ''
        }))

      currentSuggestions.value = suggestions
      aiState.value = 'preview'
    } catch (e) {
      if (aborted) return
      // Fallback to deterministic suggestions on AI failure
      try {
        const fallback = getFallbackSuggestions(task)
        if (fallback.length > 0) {
          currentSuggestions.value = fallback
          suggestedProjectId.value = null
          suggestedProjectName.value = null
          aiState.value = 'preview'
          return
        }
      } catch { /* ignore fallback errors */ }
      failWithError(e instanceof Error ? e.message : 'Failed to generate suggestions')
    }
  }


  // ============================================================================
  // Deterministic Fallbacks
  // ============================================================================

  function getFallbackSuggestions(task: Task): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []
    const today = new Date().toISOString().split('T')[0]

    if (!task.priority) {
      const isOverdue = task.dueDate && task.dueDate < today
      suggestions.push({
        field: 'priority',
        currentValue: null,
        suggestedValue: isOverdue ? 'high' : 'medium',
        confidence: 0.4,
        reasoning: isOverdue ? 'Task is overdue' : 'Default suggestion'
      })
    }

    if (!task.dueDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      suggestions.push({
        field: 'dueDate',
        currentValue: null,
        suggestedValue: tomorrow.toISOString().split('T')[0],
        confidence: 0.3,
        reasoning: 'Default: tomorrow'
      })
    }

    if (!task.estimatedDuration) {
      suggestions.push({
        field: 'estimatedDuration',
        currentValue: null,
        suggestedValue: task.title.length < 20 ? 15 : 30,
        confidence: 0.3,
        reasoning: 'Default estimate'
      })
    }

    return suggestions
  }


  // ============================================================================
  // Controls
  // ============================================================================

  function abort() {
    aborted = true
    aiState.value = 'idle'
    aiAction.value = null
  }

  function dismiss() {
    aiState.value = 'idle'
    aiAction.value = null
    currentSuggestions.value = []
    suggestedProjectId.value = null
    suggestedProjectName.value = null
    aiError.value = null
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    aiState,
    aiAction,
    aiError,
    isAIBusy,

    // Suggest
    currentSuggestions,
    suggestedProjectId,
    suggestedProjectName,

    // Actions
    autoSuggest,

    // Controls
    abort,
    dismiss
  }
}
