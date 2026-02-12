/**
 * AI Task Assist Composable
 *
 * Provides 7 AI-powered task assist actions:
 * 1. suggestSubtasks - Generate subtask suggestions
 * 2. suggestPriorityDuration - Analyze priority and time estimate
 * 3. breakDownTask - Split into smaller tasks
 * 4. suggestDate - Recommend optimal scheduling date
 * 5. improveTitle - Rewrite vague titles to be actionable
 * 6. findRelatedTasks - Fuzzy-match related tasks (no AI)
 * 7. summarizeBatch - Summarize a group of tasks
 *
 * Uses the AI Router singleton for streaming inference.
 *
 * @see TASK-1302 in MASTER_PLAN.md
 */

import { ref } from 'vue'
import { createAIRouter } from '@/services/ai'
import type { ChatMessage as RouterChatMessage } from '@/services/ai/types'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'

// ============================================================================
// Types
// ============================================================================

export interface AIAssistResult {
  type: 'subtasks' | 'priority' | 'breakdown' | 'date' | 'title' | 'related' | 'summary'
  subtasks?: string[]
  priority?: { priority: string; duration: number; reasoning: string }
  breakdown?: Array<{ title: string; priority?: string }>
  date?: { date: string; reasoning: string }
  title?: string
  related?: Task[]
  summary?: { summary: string; suggestedGroup: string }
}

// ============================================================================
// Router Singleton
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
// Language Detection
// ============================================================================

/**
 * Detect if text is primarily RTL/non-Latin (Hebrew, Arabic, etc.)
 * Returns a language instruction to append to system prompts.
 */
function detectLanguageInstruction(text: string): string {
  if (!text) return ''
  // Hebrew range: \u0590-\u05FF, Arabic range: \u0600-\u06FF
  const rtlChars = text.match(/[\u0590-\u05FF\u0600-\u06FF]/g)
  if (rtlChars && rtlChars.length > text.replace(/\s/g, '').length * 0.3) {
    // Check if Hebrew specifically
    const hebrewChars = text.match(/[\u0590-\u05FF]/g)
    if (hebrewChars && hebrewChars.length > 0) {
      return ' IMPORTANT: The user writes in Hebrew. Write ALL text values (subtask titles, reasoning, titles, summaries) in Hebrew. JSON keys must remain in English.'
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
// JSON Parsing
// ============================================================================

function parseAIResponse<T>(content: string): T | null {
  // Try direct parse
  try { return JSON.parse(content) }
  catch { /* continue */ }

  // Try extracting JSON from markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]) }
    catch { /* continue */ }
  }

  // Try finding first { ... }
  const braceMatch = content.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]) }
    catch { /* continue */ }
  }

  // Try finding first [ ... ] (some models return raw arrays)
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

export function useAITaskAssist() {
  const isLoading = ref(false)
  const currentAction = ref<string | null>(null)
  const result = ref<AIAssistResult | null>(null)
  const error = ref<string | null>(null)

  let aborted = false

  // ============================================================================
  // Helpers
  // ============================================================================

  function resetState(action: string) {
    isLoading.value = true
    currentAction.value = action
    result.value = null
    error.value = null
    aborted = false
  }

  function finishWithError(message: string) {
    error.value = message
    isLoading.value = false
    currentAction.value = null
  }

  function finishWithResult(r: AIAssistResult) {
    result.value = r
    isLoading.value = false
    currentAction.value = null
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

  // ============================================================================
  // 1. Suggest Subtasks
  // ============================================================================

  async function suggestSubtasks(task: Task) {
    resetState('suggestSubtasks')
    try {
      const langHint = detectLanguageInstruction(task.title)
      const messages: RouterChatMessage[] = [
        {
          role: 'system',
          content: 'You are a task planning assistant. Given a task title and optional description, suggest 3-5 actionable subtasks. Return ONLY valid JSON: { "subtasks": ["subtask1", "subtask2", ...] }' + langHint
        },
        {
          role: 'user',
          content: `Task: "${task.title}"${task.description ? `\nDescription: ${task.description}` : ''}`
        }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      let parsed = parseAIResponse<{ subtasks: string[] }>(raw)
      // Handle case where AI returns a raw array instead of { subtasks: [...] }
      if (!parsed?.subtasks) {
        const arr = parseAIResponse<string[]>(raw)
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
          parsed = { subtasks: arr }
        }
      }
      if (!parsed?.subtasks || !Array.isArray(parsed.subtasks)) {
        finishWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      finishWithResult({ type: 'subtasks', subtasks: parsed.subtasks })
    } catch (e) {
      if (aborted) return
      finishWithError(e instanceof Error ? e.message : 'Failed to suggest subtasks')
    }
  }

  // ============================================================================
  // 2. Suggest Priority & Duration
  // ============================================================================

  async function suggestPriorityDuration(task: Task) {
    resetState('suggestPriorityDuration')
    try {
      const langHint = detectLanguageInstruction(task.title)
      const currentInfo: string[] = []
      if (task.priority) currentInfo.push(`Current priority: ${task.priority}`)
      if (task.estimatedDuration) currentInfo.push(`Current estimated duration: ${task.estimatedDuration} minutes`)

      const messages: RouterChatMessage[] = [
        {
          role: 'system',
          content: 'Analyze this task and suggest priority (low/medium/high) and estimated duration in minutes. Return ONLY valid JSON: { "priority": "medium", "duration": 30, "reasoning": "..." }' + langHint
        },
        {
          role: 'user',
          content: `Task: "${task.title}"${task.description ? `\nDescription: ${task.description}` : ''}${currentInfo.length > 0 ? '\n' + currentInfo.join('\n') : ''}`
        }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ priority: string; duration: number; reasoning: string }>(raw)
      if (!parsed?.priority || typeof parsed.duration !== 'number') {
        finishWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      finishWithResult({ type: 'priority', priority: parsed })
    } catch (e) {
      if (aborted) return
      finishWithError(e instanceof Error ? e.message : 'Failed to suggest priority/duration')
    }
  }

  // ============================================================================
  // 3. Break Down Task
  // ============================================================================

  async function breakDownTask(task: Task) {
    resetState('breakDownTask')
    try {
      const langHint = detectLanguageInstruction(task.title)
      const messages: RouterChatMessage[] = [
        {
          role: 'system',
          content: 'Break this task into 2-4 smaller, actionable tasks. Return ONLY valid JSON: { "tasks": [{ "title": "...", "priority": "medium" }, ...] }' + langHint
        },
        {
          role: 'user',
          content: `Task: "${task.title}"${task.description ? `\nDescription: ${task.description}` : ''}`
        }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ tasks: Array<{ title: string; priority?: string }> }>(raw)
      if (!parsed?.tasks || !Array.isArray(parsed.tasks)) {
        finishWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      finishWithResult({ type: 'breakdown', breakdown: parsed.tasks })
    } catch (e) {
      if (aborted) return
      finishWithError(e instanceof Error ? e.message : 'Failed to break down task')
    }
  }

  // ============================================================================
  // 4. Suggest Date
  // ============================================================================

  async function suggestDate(task: Task) {
    resetState('suggestDate')
    try {
      const langHint = detectLanguageInstruction(task.title)
      const today = new Date().toISOString().split('T')[0]
      const dateInfo = task.dueDate ? `\nCurrent due date: ${task.dueDate}` : ''

      const messages: RouterChatMessage[] = [
        {
          role: 'system',
          content: 'Suggest the optimal date to work on this task. Consider the task nature. Return ONLY valid JSON: { "date": "YYYY-MM-DD", "reasoning": "..." }' + langHint
        },
        {
          role: 'user',
          content: `Task: "${task.title}"${task.description ? `\nDescription: ${task.description}` : ''}\nToday's date: ${today}${dateInfo}`
        }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ date: string; reasoning: string }>(raw)
      if (!parsed?.date) {
        finishWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      finishWithResult({ type: 'date', date: parsed })
    } catch (e) {
      if (aborted) return
      finishWithError(e instanceof Error ? e.message : 'Failed to suggest date')
    }
  }

  // ============================================================================
  // 5. Improve Title
  // ============================================================================

  async function improveTitle(currentTitle: string) {
    resetState('improveTitle')
    try {
      const langHint = detectLanguageInstruction(currentTitle)
      const messages: RouterChatMessage[] = [
        {
          role: 'system',
          content: 'Rewrite this vague task title to be specific and actionable. Keep it concise (under 60 chars). Return ONLY valid JSON: { "title": "..." }' + langHint
        },
        {
          role: 'user',
          content: currentTitle
        }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ title: string }>(raw)
      if (!parsed?.title) {
        finishWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      finishWithResult({ type: 'title', title: parsed.title })
    } catch (e) {
      if (aborted) return
      finishWithError(e instanceof Error ? e.message : 'Failed to improve title')
    }
  }

  // ============================================================================
  // 6. Find Related Tasks (no AI - pure logic)
  // ============================================================================

  function findRelatedTasks(task: Task) {
    resetState('findRelatedTasks')
    try {
      const taskStore = useTaskStore()
      const allTasks = taskStore.tasks

      // Split title into meaningful words (3+ chars)
      const words = task.title
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length >= 3)

      const scored: Array<{ task: Task; score: number }> = []

      for (const candidate of allTasks) {
        // Skip self and completed tasks
        if (candidate.id === task.id || candidate.status === 'done') continue

        const candidateTitle = candidate.title.toLowerCase()
        const taskTitle = task.title.toLowerCase()

        let score = 0

        // Check shared words
        const candidateWords = candidateTitle.split(/\s+/).filter(w => w.length >= 3)
        for (const word of words) {
          if (candidateWords.includes(word)) score++
        }

        // Substring match bonus
        if (candidateTitle.includes(taskTitle) || taskTitle.includes(candidateTitle)) {
          score += 3
        }

        // Need at least 2 shared words or a substring match
        if (score >= 2) {
          scored.push({ task: candidate, score })
        }
      }

      // Sort by relevance (highest score first)
      scored.sort((a, b) => b.score - a.score)

      const related = scored.map(s => s.task)
      finishWithResult({ type: 'related', related })
    } catch (e) {
      finishWithError(e instanceof Error ? e.message : 'Failed to find related tasks')
    }
  }

  // ============================================================================
  // 7. Summarize Batch
  // ============================================================================

  async function summarizeBatch(taskIds: string[]) {
    resetState('summarizeBatch')
    try {
      const taskStore = useTaskStore()
      const tasks = taskIds
        .map(id => taskStore.getTask(id))
        .filter((t): t is Task => t != null)

      if (tasks.length === 0) {
        finishWithError('No valid tasks found for the provided IDs.')
        return
      }

      const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')
      const langHint = detectLanguageInstruction(tasks[0]?.title || '')

      const messages: RouterChatMessage[] = [
        {
          role: 'system',
          content: 'Summarize what these tasks have in common and suggest how to group them. Return ONLY valid JSON: { "summary": "...", "suggestedGroup": "..." }' + langHint
        },
        {
          role: 'user',
          content: `Tasks:\n${taskList}`
        }
      ]

      const raw = await streamAI(messages)
      if (aborted) return

      const parsed = parseAIResponse<{ summary: string; suggestedGroup: string }>(raw)
      if (!parsed?.summary) {
        finishWithError('AI response could not be parsed. Try again or check your AI provider connection.')
        return
      }

      finishWithResult({ type: 'summary', summary: parsed })
    } catch (e) {
      if (aborted) return
      finishWithError(e instanceof Error ? e.message : 'Failed to summarize batch')
    }
  }

  // ============================================================================
  // Controls
  // ============================================================================

  function abort() {
    aborted = true
    isLoading.value = false
    currentAction.value = null
  }

  function clearResult() {
    result.value = null
    error.value = null
    currentAction.value = null
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Actions
    suggestSubtasks,
    suggestPriorityDuration,
    breakDownTask,
    suggestDate,
    improveTitle,
    findRelatedTasks,
    summarizeBatch,

    // State
    isLoading,
    currentAction,
    result,
    error,

    // Controls
    abort,
    clearResult
  }
}
