/**
 * Quick Sort AI Commands Composable (TASK-1221)
 *
 * Provides 4 AI-powered actions for the Quick Sort workflow:
 * 1. autoSuggest - Suggest priority, date, project for current task
 * 2. aiSort - Rank remaining tasks by importance (reorders queue)
 * 3. aiBatch - Auto-categorize all remaining tasks (preview before apply)
 * 4. aiExplain - Expand vague task titles into descriptions + action steps
 *
 * Reuses AI Router singleton pattern from useAITaskAssist.ts
 */

import { ref, computed } from 'vue'
import { createAIRouter } from '@/services/ai'
import type { ChatMessage as RouterChatMessage } from '@/services/ai/types'
import type { Task } from '@/types/tasks'
import type { SmartSuggestion } from '@/composables/useAITaskAssist'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'

// ============================================================================
// Types
// ============================================================================

export interface AutoCategorizeResult {
  taskId: string
  taskTitle: string
  suggestedPriority?: 'low' | 'medium' | 'high'
  suggestedDueDate?: string // YYYY-MM-DD
  suggestedProjectId?: string
  suggestedProjectName?: string
  confidence: number
}

export interface AIExplainResult {
  description: string
  actionSteps: string[]
}

export type AIAction = 'suggest' | 'sort' | 'batch' | 'explain'

// ============================================================================
// Router Singleton (same pattern as useAITaskAssist)
// ============================================================================

let routerInstance: ReturnType<typeof createAIRouter> | null = null
let routerInitPromise: Promise<void> | null = null

async function getRouter() {
  if (!routerInstance) {
    routerInstance = createAIRouter({ debug: false })
    routerInitPromise = routerInstance.initialize()
  }
  await routerInitPromise
  return routerInstance
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

  // Sort state
  const sortedTaskOrder = ref<string[] | null>(null)

  // Batch categorize state
  const batchResults = ref<AutoCategorizeResult[]>([])

  // Explain state
  const explainResult = ref<AIExplainResult | null>(null)

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

      const systemPrompt = `You suggest task metadata for a Quick Sort workflow. The user is rapidly categorizing uncategorized tasks. Return ONLY valid JSON.
Format: { "suggestions": [{ "field": "priority|dueDate|status|estimatedDuration|projectId", "value": ..., "confidence": 0.0-1.0, "reason": "..." }] }
Rules:
- priority: "high", "medium", "low"
- dueDate: "YYYY-MM-DD" (today or future)
- status: "planned", "in_progress", "backlog"
- estimatedDuration: minutes (15, 30, 60, 90, 120)
- projectId: one of the provided project IDs, or omit if unsure
- Only suggest fields that need changing
- confidence 0.9+ = very sure, 0.7 = fairly sure, <0.7 = guess
- reason: 1 short sentence` + langHint

      const userPrompt = `Task: "${task.title}"${descSnippet ? `\nDescription: "${descSnippet}"` : ''}
Current: priority=${task.priority || 'none'}, dueDate=${task.dueDate || 'none'}, status=${task.status || 'planned'}
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
      const validFields = new Set(['priority', 'dueDate', 'status', 'estimatedDuration'])
      const validPriorities = new Set(['high', 'medium', 'low'])
      const validStatuses = new Set(['planned', 'in_progress', 'backlog'])
      const validDurations = new Set([15, 30, 60, 90, 120])

      const currentValues: Record<string, string | number | null> = {
        priority: task.priority || null,
        dueDate: task.dueDate || null,
        status: task.status || null,
        estimatedDuration: task.estimatedDuration || null
      }

      const suggestions: SmartSuggestion[] = parsed.suggestions
        .filter(s => validFields.has(s.field))
        .filter(s => {
          if (s.field === 'priority') return validPriorities.has(String(s.value))
          if (s.field === 'status') return validStatuses.has(String(s.value))
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
  // 2. AI Sort (rank tasks by importance)
  // ============================================================================

  async function aiSort(tasks: Task[]) {
    resetForAction('sort')
    try {
      const capped = tasks.slice(0, 30)
      const langHint = detectLanguageInstruction(capped[0]?.title || '')
      const today = new Date().toISOString().split('T')[0]

      const systemPrompt = `Rank these tasks by importance for a productivity app user. Consider urgency (overdue/due soon), priority level, and task complexity. Return ONLY valid JSON: { "rankedIds": ["id1", "id2", ...] }` + langHint

      const taskList = capped.map(t =>
        `[${t.id}] "${t.title}" — priority=${t.priority || 'none'}, due=${t.dueDate || 'none'}, status=${t.status || 'planned'}`
      ).join('\n')

      const messages: RouterChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Today: ${today}\nTasks:\n${taskList}` }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ rankedIds: string[] }>(raw)
      if (!parsed?.rankedIds || !Array.isArray(parsed.rankedIds)) {
        // Fallback: deterministic sort
        sortedTaskOrder.value = getFallbackSortOrder(capped)
        aiState.value = 'idle'
        return
      }

      // Ensure all task IDs are included (AI may miss some)
      const taskIdSet = new Set(capped.map(t => t.id))
      const validRanked = parsed.rankedIds.filter(id => taskIdSet.has(id))
      const missing = capped.filter(t => !validRanked.includes(t.id)).map(t => t.id)
      sortedTaskOrder.value = [...validRanked, ...missing]
      aiState.value = 'idle'
    } catch (e) {
      if (aborted) return
      try {
        sortedTaskOrder.value = getFallbackSortOrder(tasks.slice(0, 30))
        aiState.value = 'idle'
        return
      } catch { /* ignore */ }
      failWithError(e instanceof Error ? e.message : 'Failed to sort tasks')
    }
  }

  // ============================================================================
  // 3. AI Batch (auto-categorize all remaining tasks)
  // ============================================================================

  async function aiBatch(tasks: Task[]) {
    resetForAction('batch')
    try {
      const capped = tasks.slice(0, 20)
      const langHint = detectLanguageInstruction(capped[0]?.title || '')
      const today = new Date().toISOString().split('T')[0]
      const projectCtx = getProjectContext()

      const systemPrompt = `For each task, suggest priority, dueDate, and projectId. The user is doing a Quick Sort to categorize all uncategorized tasks at once. Return ONLY valid JSON: { "tasks": [{ "taskId": "...", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD", "projectId": "...", "confidence": 0.0-1.0 }] }
Rules:
- priority: "high", "medium", "low"
- dueDate: "YYYY-MM-DD" (today or future)
- projectId: one of the provided project IDs, or omit if unsure
- confidence 0.9+ = very sure, 0.7 = fairly sure, <0.7 = guess` + langHint

      const taskList = capped.map(t =>
        `[${t.id}] "${t.title}" — priority=${t.priority || 'none'}, due=${t.dueDate || 'none'}, status=${t.status || 'planned'}`
      ).join('\n')

      const messages: RouterChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Today: ${today}\nAvailable projects: ${projectCtx}\nTasks:\n${taskList}` }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{
        tasks: Array<{
          taskId: string
          priority?: string
          dueDate?: string
          projectId?: string
          confidence?: number
        }>
      }>(raw)

      if (!parsed?.tasks || !Array.isArray(parsed.tasks)) {
        // Fallback: deterministic batch
        batchResults.value = getFallbackBatch(capped)
        aiState.value = 'preview'
        return
      }

      const projectStore = useProjectStore()
      const taskMap = new Map(capped.map(t => [t.id, t]))
      const validPriorities = new Set(['high', 'medium', 'low'])

      batchResults.value = parsed.tasks
        .filter(r => taskMap.has(r.taskId))
        .map(r => {
          const task = taskMap.get(r.taskId)!
          const project = r.projectId
            ? projectStore.projects.find(p => p.id === r.projectId)
            : null

          const result: AutoCategorizeResult = {
            taskId: r.taskId,
            taskTitle: task.title,
            confidence: Math.max(0, Math.min(1, r.confidence ?? 0.5))
          }

          if (r.priority && validPriorities.has(r.priority)) {
            result.suggestedPriority = r.priority as 'low' | 'medium' | 'high'
          }
          if (r.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)) {
            result.suggestedDueDate = r.dueDate
          }
          if (project) {
            result.suggestedProjectId = project.id
            result.suggestedProjectName = project.name
          }

          return result
        })

      aiState.value = 'preview'
    } catch (e) {
      if (aborted) return
      try {
        batchResults.value = getFallbackBatch(tasks.slice(0, 20))
        aiState.value = 'preview'
        return
      } catch { /* ignore */ }
      failWithError(e instanceof Error ? e.message : 'Failed to batch categorize tasks')
    }
  }

  // ============================================================================
  // 4. AI Explain (expand vague task titles)
  // ============================================================================

  async function aiExplain(task: Task) {
    resetForAction('explain')
    try {
      const langHint = detectLanguageInstruction(task.title)

      const systemPrompt = `The user has a vague task title in their todo list. Provide a clearer description (2-3 sentences) and suggest 2-3 specific action steps. Return ONLY valid JSON: { "description": "...", "actionSteps": ["step1", "step2"] }` + langHint

      const userPrompt = `Task: "${task.title}"${task.description ? `\nExisting description: "${task.description.slice(0, 200)}"` : ''}`

      const messages: RouterChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ description: string; actionSteps: string[] }>(raw)
      if (!parsed?.description || !Array.isArray(parsed?.actionSteps)) {
        failWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      explainResult.value = {
        description: parsed.description,
        actionSteps: parsed.actionSteps
      }
      aiState.value = 'preview'
    } catch (e) {
      if (aborted) return
      failWithError(e instanceof Error ? e.message : 'AI not available')
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

  function getFallbackSortOrder(tasks: Task[]): string[] {
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }
    return [...tasks]
      .sort((a, b) => {
        const aPri = priorityWeight[a.priority || ''] || 0
        const bPri = priorityWeight[b.priority || ''] || 0
        if (aPri !== bPri) return bPri - aPri
        // Then by due date (soonest first, no-date last)
        if (a.dueDate && !b.dueDate) return -1
        if (!a.dueDate && b.dueDate) return 1
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        return 0
      })
      .map(t => t.id)
  }

  function getFallbackBatch(tasks: Task[]): AutoCategorizeResult[] {
    const today = new Date().toISOString().split('T')[0]
    return tasks.map(t => {
      const isOverdue = t.dueDate && t.dueDate < today
      const result: AutoCategorizeResult = {
        taskId: t.id,
        taskTitle: t.title,
        confidence: 0.3
      }
      if (!t.priority) {
        result.suggestedPriority = isOverdue ? 'high' : 'medium'
      }
      if (!t.dueDate) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        result.suggestedDueDate = tomorrow.toISOString().split('T')[0]
      }
      return result
    })
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
    batchResults.value = []
    explainResult.value = null
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

    // Sort
    sortedTaskOrder,

    // Batch
    batchResults,

    // Explain
    explainResult,

    // Actions
    autoSuggest,
    aiSort,
    aiBatch,
    aiExplain,

    // Controls
    abort,
    dismiss
  }
}
