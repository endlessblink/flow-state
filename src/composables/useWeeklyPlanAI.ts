import { ref } from 'vue'
import type { Ref } from 'vue'
import { createAIRouter } from '@/services/ai/router'
import type { ChatMessage } from '@/services/ai/types'

// ============================================================================
// Types
// ============================================================================

export interface WeeklyPlan {
  monday: string[]
  tuesday: string[]
  wednesday: string[]
  thursday: string[]
  friday: string[]
  saturday: string[]
  sunday: string[]
  unscheduled: string[]
}

export type WeeklyPlanStatus = 'idle' | 'loading' | 'review' | 'applying' | 'applied' | 'error'

export interface WeeklyPlanState {
  status: WeeklyPlanStatus
  plan: WeeklyPlan | null
  reasoning: string | null
  error: string | null
  weekStart: Date
  weekEnd: Date
}

export interface TaskSummary {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high' | null
  dueDate: string
  estimatedDuration?: number
  status: string
  projectId: string
}

// ============================================================================
// Day keys and helpers
// ============================================================================

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAY_KEYS[number]

const WEEKDAY_KEYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon
  // If today is Monday (1), use today. Otherwise calculate next Monday.
  // But if today is Sun (0), next Monday is tomorrow (+1).
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return { weekStart, weekEnd }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ============================================================================
// Prompt builders
// ============================================================================

function buildSystemPrompt(): string {
  return `You are a productivity assistant that plans a user's work week.

Your job: distribute the given tasks across Monday through Sunday.

Rules:
- Return ONLY valid JSON (no markdown, no explanation outside the JSON).
- The JSON must have these keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday, unscheduled, reasoning.
- Each day key is an array of task ID strings.
- "unscheduled" contains task IDs that don't fit the week.
- "reasoning" is a brief string explaining your distribution logic.
- Schedule high-priority tasks earlier in the week.
- Overdue tasks (due date in the past) should be scheduled on Monday or Tuesday.
- In-progress tasks should be prioritized over pending ones.
- Keep daily load to 5-8 tasks maximum.
- Prefer weekdays (Mon-Fri) for work tasks; use Sat/Sun only for overflow.
- Each task ID must appear in exactly ONE day or in unscheduled — no duplicates.
- If there are more tasks than a week can hold, put extras in unscheduled.`
}

function buildUserPrompt(tasks: TaskSummary[], weekStart: Date, weekEnd: Date): string {
  const today = formatDate(new Date())
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today)

  const taskList = tasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate,
    estimatedDuration: t.estimatedDuration,
    status: t.status,
    overdue: t.dueDate ? t.dueDate < today : false,
  }))

  return `Today: ${today}
Week range: ${formatDate(weekStart)} (Monday) to ${formatDate(weekEnd)} (Sunday)
Total tasks: ${tasks.length}
Overdue tasks: ${overdueTasks.length}

Tasks:
${JSON.stringify(taskList, null, 2)}

Distribute these tasks across the week. Return ONLY the JSON object.`
}

// ============================================================================
// Response parsing
// ============================================================================

function parseWeeklyPlanResponse(
  response: string,
  validTaskIds: Set<string>
): { plan: WeeklyPlan; reasoning: string | null } {
  // Strip markdown code fences if present
  let json = response.trim()
  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim()
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('AI response is not valid JSON')
  }

  // Validate day keys exist
  for (const key of DAY_KEYS) {
    if (!Array.isArray(parsed[key])) {
      parsed[key] = []
    }
  }
  if (!Array.isArray(parsed.unscheduled)) {
    parsed.unscheduled = []
  }

  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : null

  // Filter invalid IDs and deduplicate across days
  const seen = new Set<string>()
  const plan: WeeklyPlan = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
    unscheduled: [],
  }

  for (const key of [...DAY_KEYS, 'unscheduled'] as const) {
    const ids = parsed[key] as unknown[]
    for (const id of ids) {
      if (typeof id === 'string' && validTaskIds.has(id) && !seen.has(id)) {
        seen.add(id)
        plan[key].push(id)
      }
    }
  }

  // Check result isn't completely empty
  const totalAssigned = Object.values(plan).reduce((sum, arr) => sum + arr.length, 0)
  if (totalAssigned === 0) {
    throw new Error('Parsed plan contains no valid task assignments')
  }

  return { plan, reasoning }
}

// ============================================================================
// Fallback plan
// ============================================================================

function generateFallbackPlan(tasks: TaskSummary[], _weekStart: Date): WeeklyPlan {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }

  const sorted = [...tasks].sort((a, b) => {
    const pa = a.priority ? priorityOrder[a.priority] ?? 3 : 3
    const pb = b.priority ? priorityOrder[b.priority] ?? 3 : 3
    if (pa !== pb) return pa - pb
    // Then by due date (earlier first, nulls last)
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  const plan: WeeklyPlan = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
    unscheduled: [],
  }

  const MAX_PER_DAY = 8
  let dayIndex = 0

  for (const task of sorted) {
    if (dayIndex < WEEKDAY_KEYS.length) {
      const dayKey = WEEKDAY_KEYS[dayIndex]
      plan[dayKey].push(task.id)
      if (plan[dayKey].length >= MAX_PER_DAY) {
        dayIndex++
      }
    } else {
      plan.unscheduled.push(task.id)
    }
  }

  return plan
}

// ============================================================================
// Composable
// ============================================================================

export function useWeeklyPlanAI() {
  const isGenerating = ref(false) as Ref<boolean>

  async function generatePlan(
    tasks: TaskSummary[]
  ): Promise<{ plan: WeeklyPlan; reasoning: string | null }> {
    if (tasks.length === 0) {
      return {
        plan: {
          monday: [], tuesday: [], wednesday: [], thursday: [],
          friday: [], saturday: [], sunday: [], unscheduled: [],
        },
        reasoning: 'No tasks to schedule.',
      }
    }

    const { weekStart, weekEnd } = getWeekBounds()
    const validTaskIds = new Set(tasks.map(t => t.id))

    isGenerating.value = true

    try {
      const router = createAIRouter()
      await router.initialize()

      const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(tasks, weekStart, weekEnd) },
      ]

      // First attempt
      try {
        const response = await router.chat(messages, {
          taskType: 'planning',
          temperature: 0.3,
        })
        return parseWeeklyPlanResponse(response.content, validTaskIds)
      } catch (firstError) {
        console.warn('[WeeklyPlanAI] First attempt failed, retrying...', firstError)
      }

      // Retry once
      try {
        const response = await router.chat(messages, {
          taskType: 'planning',
          temperature: 0.3,
        })
        return parseWeeklyPlanResponse(response.content, validTaskIds)
      } catch (retryError) {
        console.warn('[WeeklyPlanAI] Retry failed, using fallback plan', retryError)
      }

      // Fallback: deterministic round-robin
      return {
        plan: generateFallbackPlan(tasks, weekStart),
        reasoning: 'AI was unavailable. Tasks distributed by priority using a round-robin schedule.',
      }
    } finally {
      isGenerating.value = false
    }
  }

  return {
    generatePlan,
    isGenerating,
  }
}
