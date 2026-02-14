import { ref } from 'vue'
import type { Ref } from 'vue'
import { createAIRouter } from '@/services/ai/router'
import type { ChatMessage } from '@/services/ai/types'
import type { WorkProfile } from '@/utils/supabaseMappers'
import { useSettingsStore } from '@/stores/settings'

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

export type WeeklyPlanStatus = 'idle' | 'interview' | 'loading' | 'review' | 'applying' | 'applied' | 'error'

export interface WeeklyPlanState {
  status: WeeklyPlanStatus
  plan: WeeklyPlan | null
  reasoning: string | null
  taskReasons: Record<string, string>
  error: string | null
  weekStart: Date
  weekEnd: Date
  interviewAnswers: InterviewAnswers | null
}

export interface TaskSummary {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high' | null
  dueDate: string
  estimatedDuration?: number
  status: string
  projectId: string
  description?: string
  subtaskCount?: number
  completedSubtaskCount?: number
}

export interface InterviewAnswers {
  topPriority?: string
  daysOff?: string[]
  heavyMeetingDays?: string[]
  maxTasksPerDay?: number
  preferredWorkStyle?: 'frontload' | 'balanced' | 'backload'
}

export interface BehavioralContext {
  recentlyCompletedTitles: string[]        // Titles of tasks completed in last 2 weeks
  activeProjectNames: string[]             // Projects with recent activity
  avgTasksCompletedPerDay: number | null   // From work profile
  avgWorkMinutesPerDay: number | null      // From work profile
  peakProductivityDays: string[]           // Days when user is most productive
  completionRate: number | null            // % of planned tasks actually completed
  frequentlyMissedProjects: string[]       // Projects where tasks often get skipped
}

// ============================================================================
// Day keys and helpers
// ============================================================================

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAY_KEYS[number]

const WEEKDAY_KEYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

// TASK-1321: Parameterized to support Sunday or Monday week start
function getWeekBounds(weekStartsOn: 0 | 1 = 0): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...6=Sat

  let diff: number
  if (weekStartsOn === 1) {
    // Monday start: go back to this week's Monday
    diff = day === 0 ? -6 : 1 - day
  } else {
    // Sunday start: go back to this week's Sunday
    diff = -day
  }

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return { weekStart, weekEnd }
}

// BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================================
// Prompt builders (distribution — the ONLY LLM job)
// Research consensus: deterministic rules for filtering, LLM for distribution.
// ============================================================================

function buildSystemPrompt(interview?: InterviewAnswers, profile?: WorkProfile | null): string {
  let base = `You are a productivity assistant that distributes tasks across a user's work week.

ALL tasks given to you have already been pre-filtered for relevance. Your ONLY job is to distribute them across Monday through Sunday.

Rules:
- Return ONLY valid JSON (no markdown, no explanation outside the JSON).
- The JSON must have these keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday, unscheduled, reasoning.
- Each day key is an array of task ID strings.
- "unscheduled" contains task IDs that don't fit the available capacity.
- "reasoning" is a brief string explaining your distribution logic.
- "taskReasons" is an object mapping each task ID to a short (5-15 word) explanation of WHY you placed it on that specific day. Write from the AI's perspective, e.g. "Overdue — needs immediate attention", "Continues momentum from recent project work", "Light task for your heavy meeting day".

SCHEDULING PRIORITY:
1. Overdue tasks (due date in the past) — MUST go on Monday or Tuesday.
2. In-progress tasks — already started, schedule early in the week.
3. Tasks due this week — place on or before their due date.
4. High-priority tasks — schedule on weekdays.
5. Lower priority / no-date tasks — fill remaining capacity, or put in unscheduled if the week is full.

DISTRIBUTION:
- Keep daily load to 3-6 tasks maximum per day.
- Prefer weekdays (Mon-Fri) for work tasks; use Sat/Sun only for overflow or light tasks.
- Each task ID must appear in exactly ONE day or in unscheduled — no duplicates.
- Consider task COMPLEXITY: tasks with many subtasks need their own day. Don't stack complex tasks.
- Distribute EVENLY across the working week unless the user prefers otherwise.
- It's OK to put tasks in unscheduled if the week is already full.`

  if (interview) {
    const extras: string[] = []
    if (interview.topPriority) {
      extras.push(`- The user's TOP PRIORITY this week: "${interview.topPriority}". Schedule related tasks earliest.`)
    }
    if (interview.daysOff && interview.daysOff.length > 0) {
      extras.push(`- Days OFF (schedule ZERO tasks): ${interview.daysOff.join(', ')}.`)
    }
    if (interview.heavyMeetingDays && interview.heavyMeetingDays.length > 0) {
      extras.push(`- Heavy MEETING days (schedule fewer/lighter tasks): ${interview.heavyMeetingDays.join(', ')}.`)
    }
    if (interview.maxTasksPerDay) {
      extras.push(`- Maximum tasks per day: ${interview.maxTasksPerDay}.`)
    }
    if (interview.preferredWorkStyle === 'frontload') {
      extras.push('- User prefers front-loading: schedule more tasks Mon-Tue, lighter Thu-Fri.')
    } else if (interview.preferredWorkStyle === 'backload') {
      extras.push('- User prefers ramping up: lighter Mon-Tue, heavier Thu-Fri.')
    }
    if (extras.length > 0) {
      base += `\n\nUser preferences for this week:\n${extras.join('\n')}`
    }
  }

  if (profile) {
    const insights: string[] = []

    if (profile.avgTasksCompletedPerDay) {
      insights.push(`- Historical capacity: user completes ~${profile.avgTasksCompletedPerDay} tasks/day on average`)
    }
    if (profile.avgWorkMinutesPerDay) {
      insights.push(`- Average focused work time: ~${Math.round(profile.avgWorkMinutesPerDay)} minutes/day`)
    }
    if (profile.peakProductivityDays?.length) {
      insights.push(`- Most productive days: ${profile.peakProductivityDays.join(', ')}. Schedule demanding tasks here.`)
    }
    if (profile.avgPlanAccuracy) {
      if (profile.avgPlanAccuracy < 60) {
        insights.push(`- Past plans were only ${profile.avgPlanAccuracy}% accurate. Schedule FEWER tasks than requested.`)
      } else if (profile.avgPlanAccuracy > 90) {
        insights.push(`- Past plans were ${profile.avgPlanAccuracy}% accurate. User executes well — schedule confidently.`)
      }
    }
    if (profile.preferredWorkStyle === 'frontload') {
      insights.push('- User prefers front-loading: schedule more tasks Mon-Tue, lighter Thu-Fri.')
    } else if (profile.preferredWorkStyle === 'backload') {
      insights.push('- User prefers ramping up: lighter Mon-Tue, heavier Thu-Fri.')
    }

    if (insights.length > 0) {
      base += `\n\nLearned work patterns:\n${insights.join('\n')}`
    }
  }

  return base
}

function buildUserPrompt(tasks: TaskSummary[], weekStart: Date, weekEnd: Date, behavioral?: BehavioralContext): string {
  const today = formatDate(new Date())
  const weekEndStr = formatDate(weekEnd)
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today)
  const dueThisWeek = tasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= weekEndStr)
  const inProgress = tasks.filter(t => t.status === 'in_progress')

  const taskList = tasks.map(t => {
    // Compute urgency category for the AI
    let urgency = 'normal'
    if (t.dueDate && t.dueDate < today) urgency = 'OVERDUE'
    else if (t.status === 'in_progress') urgency = 'IN_PROGRESS'
    else if (t.dueDate && t.dueDate <= weekEndStr) urgency = 'DUE_THIS_WEEK'

    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate || null,
      estimatedDuration: t.estimatedDuration,
      status: t.status,
      urgency,
      subtasks: t.subtaskCount || 0,
      completedSubtasks: t.completedSubtaskCount || 0,
    }
  })

  // Build behavioral section
  let behavioralSection = ''
  if (behavioral) {
    const lines: string[] = []
    if (behavioral.recentlyCompletedTitles.length > 0) {
      lines.push(`Recently completed (user momentum): ${behavioral.recentlyCompletedTitles.slice(0, 8).join(', ')}`)
    }
    if (behavioral.activeProjectNames.length > 0) {
      lines.push(`Active projects: ${behavioral.activeProjectNames.join(', ')}`)
    }
    if (behavioral.peakProductivityDays.length > 0) {
      lines.push(`Most productive days: ${behavioral.peakProductivityDays.join(', ')} — schedule demanding tasks here`)
    }
    if (behavioral.avgTasksCompletedPerDay) {
      lines.push(`User capacity: ~${behavioral.avgTasksCompletedPerDay} tasks/day`)
    }
    if (behavioral.frequentlyMissedProjects.length > 0) {
      lines.push(`Often skipped projects: ${behavioral.frequentlyMissedProjects.join(', ')} — put these in unscheduled unless high priority`)
    }
    if (lines.length > 0) {
      behavioralSection = `\nUser behavior data:\n${lines.join('\n')}\n`
    }
  }

  return `Today: ${today}
Week: ${formatDate(weekStart)} to ${weekEndStr}
Tasks: ${tasks.length} (${overdueTasks.length} overdue, ${dueThisWeek.length} due this week, ${inProgress.length} in-progress)
${behavioralSection}
All tasks below are pre-filtered for this week's relevance. Distribute them across Mon-Sun.
Urgency guide: OVERDUE → must be Mon/Tue. IN_PROGRESS → early in week. DUE_THIS_WEEK → on/before due date.

Tasks:
${JSON.stringify(taskList, null, 2)}

Return ONLY the JSON object with monday...sunday, unscheduled, reasoning, and taskReasons keys.
taskReasons example: { "task-id-1": "Overdue — needs immediate attention", "task-id-2": "Continues your recent frontend work" }`
}

function buildDayResuggestPrompt(
  dayKey: DayKey,
  currentPlan: WeeklyPlan,
  allTasks: TaskSummary[]
): string {
  const taskMap = new Map(allTasks.map(t => [t.id, t]))

  const otherDays = DAY_KEYS.filter(k => k !== dayKey)
  const otherScheduled: Record<string, string[]> = {}
  for (const d of otherDays) {
    if (currentPlan[d].length > 0) {
      otherScheduled[d] = currentPlan[d]
    }
  }

  const currentDayTasks = currentPlan[dayKey].map(id => taskMap.get(id)).filter(Boolean)
  const unscheduledTasks = currentPlan.unscheduled.map(id => taskMap.get(id)).filter(Boolean)
  const availableTasks = [...currentDayTasks, ...unscheduledTasks]

  return `Re-suggest tasks for ${dayKey}.

Currently scheduled on other days (DO NOT move these):
${JSON.stringify(otherScheduled, null, 2)}

Available tasks for ${dayKey} (pick from these):
${JSON.stringify(availableTasks.map(t => ({ id: t!.id, title: t!.title, priority: t!.priority, estimatedDuration: t!.estimatedDuration })), null, 2)}

Return ONLY a JSON object with two keys:
- "${dayKey}": array of task ID strings for this day
- "unscheduled": array of remaining task IDs not placed on ${dayKey}
- "reasoning": brief explanation`
}

// ============================================================================
// Response parsing
// ============================================================================

function parseWeeklyPlanResponse(
  response: string,
  validTaskIds: Set<string>
): { plan: WeeklyPlan; reasoning: string | null; taskReasons: Record<string, string> } {
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

  // Extract per-task AI reasons
  const taskReasons: Record<string, string> = {}
  if (parsed.taskReasons && typeof parsed.taskReasons === 'object') {
    for (const [id, reason] of Object.entries(parsed.taskReasons as Record<string, unknown>)) {
      if (typeof reason === 'string' && validTaskIds.has(id)) {
        taskReasons[id] = reason
      }
    }
  }

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

  return { plan, reasoning, taskReasons }
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
    tasks: TaskSummary[],
    interview?: InterviewAnswers,
    profile?: WorkProfile | null,
    behavioral?: BehavioralContext
  ): Promise<{ plan: WeeklyPlan; reasoning: string | null; taskReasons: Record<string, string> }> {
    if (tasks.length === 0) {
      return {
        plan: {
          monday: [], tuesday: [], wednesday: [], thursday: [],
          friday: [], saturday: [], sunday: [], unscheduled: [],
        },
        reasoning: 'No tasks to schedule.',
        taskReasons: {},
      }
    }

    const { weekStart, weekEnd } = getWeekBounds(useSettingsStore().weekStartsOn)

    isGenerating.value = true

    try {
      const router = createAIRouter()
      await router.initialize()

      // Architecture: Deterministic filtering (done by caller) → LLM distribution.
      // Research consensus: LLMs are unreliable at scoring/filtering tasks.
      // The caller (useWeeklyPlan) already hard-filtered to only relevant tasks.
      // The LLM's only job is to distribute them across Mon-Sun.
      console.log(`[WeeklyPlanAI] Distributing ${tasks.length} pre-filtered tasks across week ${formatDate(weekStart)}-${formatDate(weekEnd)}`)

      const validTaskIds = new Set(tasks.map(t => t.id))
      const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(interview, profile) },
        { role: 'user', content: buildUserPrompt(tasks, weekStart, weekEnd, behavioral) },
      ]

      // First attempt
      try {
        const response = await router.chat(messages, {
          taskType: 'planning',
          temperature: 0.3,
        })
        return parseWeeklyPlanResponse(response.content, validTaskIds)
      } catch (firstError) {
        console.warn('[WeeklyPlanAI] Distribution attempt failed, retrying...', firstError)
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
        taskReasons: {},
      }
    } finally {
      isGenerating.value = false
    }
  }

  async function regenerateDay(
    dayKey: DayKey,
    currentPlan: WeeklyPlan,
    allTasks: TaskSummary[],
    profile?: WorkProfile | null
  ): Promise<{ dayTasks: string[]; unscheduled: string[]; reasoning: string | null }> {
    const validTaskIds = new Set(allTasks.map(t => t.id))

    isGenerating.value = true

    try {
      const router = createAIRouter()
      await router.initialize()

      const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(undefined, profile) },
        { role: 'user', content: buildDayResuggestPrompt(dayKey, currentPlan, allTasks) },
      ]

      try {
        const response = await router.chat(messages, {
          taskType: 'planning',
          temperature: 0.5,
        })

        let json = response.content.trim()
        const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) json = codeBlockMatch[1].trim()

        const parsed = JSON.parse(json) as Record<string, unknown>
        const dayTasks = (Array.isArray(parsed[dayKey]) ? parsed[dayKey] : [])
          .filter((id: unknown): id is string => typeof id === 'string' && validTaskIds.has(id as string))
        const unscheduled = (Array.isArray(parsed.unscheduled) ? parsed.unscheduled : [])
          .filter((id: unknown): id is string => typeof id === 'string' && validTaskIds.has(id as string))
        const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : null

        return { dayTasks, unscheduled, reasoning }
      } catch (err) {
        console.warn('[WeeklyPlanAI] Day re-suggest failed, shuffling by priority', err)

        // Fallback: shuffle current day + unscheduled by priority
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
        const taskMap = new Map(allTasks.map(t => [t.id, t]))
        const available = [...currentPlan[dayKey], ...currentPlan.unscheduled]
        available.sort((a, b) => {
          const ta = taskMap.get(a)
          const tb = taskMap.get(b)
          const pa = ta?.priority ? priorityOrder[ta.priority] ?? 3 : 3
          const pb = tb?.priority ? priorityOrder[tb.priority] ?? 3 : 3
          return pa - pb
        })
        const dayTasks = available.slice(0, 6)
        const unscheduled = available.slice(6)
        return { dayTasks, unscheduled, reasoning: 'Shuffled by priority (AI unavailable).' }
      }
    } finally {
      isGenerating.value = false
    }
  }

  return {
    generatePlan,
    regenerateDay,
    isGenerating,
  }
}
