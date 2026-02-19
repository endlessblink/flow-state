import { ref } from 'vue'
import type { Ref } from 'vue'
import { getSharedRouter } from '@/services/ai/routerFactory'
import type { AIRouter } from '@/services/ai/router'
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
  weekTheme: string | null
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
  projectName?: string
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
  recentlyCompletedTitles: string[]
  activeProjectNames: string[]
  avgTasksCompletedPerDay: number | null
  avgWorkMinutesPerDay: number | null
  peakProductivityDays: string[]
  completionRate: number | null
  frequentlyMissedProjects: string[]
  workInsights: string[]
}

// TASK-1327: Enriched task with deterministic facts (Step 0 output)
interface EnrichedTask extends TaskSummary {
  language: 'he' | 'en'
  overdueDays: number
  urgencyCategory: 'OVERDUE' | 'IN_PROGRESS' | 'DUE_THIS_WEEK' | 'normal'
  complexityScore: number  // 0-10
  deterministicReasons: string[]  // 2-3 factual bullets in task's language
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
    diff = day === 0 ? -6 : 1 - day
  } else {
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
// STEP 0: Deterministic Enrichment (no LLM, instant)
// TASK-1327: Compute per-task facts and generate deterministic reason bullets
// ============================================================================

const HEBREW_RANGE = /[\u0590-\u05FF]/

function detectTaskLanguage(title: string): 'he' | 'en' {
  return HEBREW_RANGE.test(title) ? 'he' : 'en'
}

function computeOverdueDays(dueDate: string, today: string): number {
  if (!dueDate || dueDate >= today) return 0
  const due = new Date(dueDate + 'T00:00:00')
  const now = new Date(today + 'T00:00:00')
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

function computeComplexityScore(task: TaskSummary): number {
  let score = 0
  if (task.subtaskCount && task.subtaskCount > 0) {
    score += Math.min(task.subtaskCount, 5) // up to 5 points for subtasks
  }
  if (task.estimatedDuration) {
    if (task.estimatedDuration >= 120) score += 3
    else if (task.estimatedDuration >= 60) score += 2
    else if (task.estimatedDuration >= 30) score += 1
  }
  if (task.description && task.description.length > 100) score += 1
  return Math.min(score, 10)
}

function formatDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}

function formatHebrewDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr || ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  const months = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
  return `${d.getDate()} ב${months[d.getMonth()]}`
}

function formatEnglishDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr || ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function generateDeterministicReasons(task: EnrichedTask): string[] {
  const bullets: string[] = []
  const isHe = task.language === 'he'

  // 1. Urgency / overdue
  if (task.overdueDays > 0) {
    bullets.push(isHe
      ? `באיחור של ${task.overdueDays} ימים`
      : `${task.overdueDays} days overdue`)
  }

  // 2. Status
  if (task.status === 'in_progress') {
    bullets.push(isHe ? 'כבר בתהליך עבודה' : 'Already in progress')
  }

  // 3. Subtask progress
  if (task.subtaskCount && task.subtaskCount > 0) {
    const completed = task.completedSubtaskCount || 0
    bullets.push(isHe
      ? `${completed}/${task.subtaskCount} תתי-משימות הושלמו`
      : `${completed}/${task.subtaskCount} subtasks completed`)
  }

  // 4. Priority
  if (task.priority === 'high') {
    bullets.push(isHe ? 'עדיפות גבוהה' : 'High priority')
  }

  // 5. Due date (if not overdue — overdue already shown)
  if (task.dueDate && task.overdueDays === 0) {
    bullets.push(isHe
      ? `תאריך יעד: ${formatHebrewDate(task.dueDate)}`
      : `Due: ${formatEnglishDate(task.dueDate)}`)
  }

  // 6. Duration estimate
  if (task.estimatedDuration) {
    bullets.push(isHe
      ? `משך: ${formatDuration(task.estimatedDuration)}`
      : `Estimated: ${formatDuration(task.estimatedDuration)}`)
  }

  // 7. Project name
  if (task.projectName) {
    bullets.push(isHe
      ? `פרויקט: ${task.projectName}`
      : `Project: ${task.projectName}`)
  }

  // Cap at 3 bullets — take the most important ones (order above is by importance)
  return bullets.slice(0, 3)
}

function enrichTasksForPlanning(tasks: TaskSummary[], weekEnd: Date): EnrichedTask[] {
  const today = formatDate(new Date())
  const weekEndStr = formatDate(weekEnd)

  return tasks.map(t => {
    const overdueDays = computeOverdueDays(t.dueDate, today)
    let urgencyCategory: EnrichedTask['urgencyCategory'] = 'normal'
    if (overdueDays > 0) urgencyCategory = 'OVERDUE'
    else if (t.status === 'in_progress') urgencyCategory = 'IN_PROGRESS'
    else if (t.dueDate && t.dueDate <= weekEndStr) urgencyCategory = 'DUE_THIS_WEEK'

    const language = detectTaskLanguage(t.title)
    const complexityScore = computeComplexityScore(t)

    const enriched: EnrichedTask = {
      ...t,
      language,
      overdueDays,
      urgencyCategory,
      complexityScore,
      deterministicReasons: [],
    }
    enriched.deterministicReasons = generateDeterministicReasons(enriched)
    return enriched
  })
}

// ============================================================================
// STEP 2: Deterministic Reason Assembly (no LLM, instant)
// Merges Step 0 facts + day-specific scheduling context
// ============================================================================

function assembleTaskReasons(
  enrichedTasks: EnrichedTask[],
  plan: WeeklyPlan,
): Record<string, string> {
  const taskMap = new Map(enrichedTasks.map(t => [t.id, t]))
  const reasons: Record<string, string> = {}

  // Build project-per-day map for batching notes
  const projectDayCount: Record<string, Record<string, number>> = {}
  for (const dayKey of DAY_KEYS) {
    for (const taskId of plan[dayKey]) {
      const task = taskMap.get(taskId)
      if (task?.projectName) {
        if (!projectDayCount[dayKey]) projectDayCount[dayKey] = {}
        projectDayCount[dayKey][task.projectName] = (projectDayCount[dayKey][task.projectName] || 0) + 1
      }
    }
  }

  for (const dayKey of [...DAY_KEYS, 'unscheduled'] as const) {
    for (const taskId of plan[dayKey]) {
      const task = taskMap.get(taskId)
      if (!task) continue

      const bullets = [...task.deterministicReasons]

      // Add batching note if 2+ tasks from same project on same day
      if (dayKey !== 'unscheduled' && task.projectName) {
        const count = projectDayCount[dayKey]?.[task.projectName] || 0
        if (count >= 2) {
          const isHe = task.language === 'he'
          const otherCount = count - 1
          bullets.push(isHe
            ? `מקובץ עם ${otherCount} משימות מ-${task.projectName}`
            : `Grouped with ${otherCount} ${task.projectName} tasks`)
        }
      }

      reasons[taskId] = bullets.slice(0, 3).join('\n')
    }
  }

  return reasons
}

// ============================================================================
// STEP 1: LLM Distribution Prompt (distribution ONLY — no reasoning)
// TASK-1327: Stripped down to ~300 tokens system + compact task data
// ============================================================================

function buildDistributionSystemPrompt(interview?: InterviewAnswers, profile?: WorkProfile | null): string {
  let base = `You distribute tasks across a work week. Return ONLY valid JSON.

JSON keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday, unscheduled, reasoning.
Each day key = array of task ID strings. "reasoning" = brief distribution logic string.

Rules:
- OVERDUE tasks → Monday or Tuesday.
- IN_PROGRESS tasks → early in week.
- DUE_THIS_WEEK → on or before due date.
- 3-6 tasks max per day. Weekdays preferred.
- Group same-project tasks on same day.
- Each task ID in exactly ONE day or unscheduled.
- OK to put tasks in unscheduled if week is full.`

  if (interview) {
    const extras: string[] = []
    if (interview.topPriority) {
      extras.push(`- TOP PRIORITY: "${interview.topPriority}". Schedule related tasks earliest.`)
    }
    if (interview.daysOff && interview.daysOff.length > 0) {
      extras.push(`- Days OFF (zero tasks): ${interview.daysOff.join(', ')}.`)
    }
    if (interview.heavyMeetingDays && interview.heavyMeetingDays.length > 0) {
      extras.push(`- Heavy meeting days (fewer tasks): ${interview.heavyMeetingDays.join(', ')}.`)
    }
    if (interview.maxTasksPerDay) {
      extras.push(`- Max tasks/day: ${interview.maxTasksPerDay}.`)
    }
    if (interview.preferredWorkStyle === 'frontload') {
      extras.push('- Front-load: more Mon-Tue, lighter Thu-Fri.')
    } else if (interview.preferredWorkStyle === 'backload') {
      extras.push('- Back-load: lighter Mon-Tue, heavier Thu-Fri.')
    }
    if (extras.length > 0) {
      base += `\n\nPreferences:\n${extras.join('\n')}`
    }
  }

  if (profile) {
    const insights: string[] = []
    if (profile.avgTasksCompletedPerDay) {
      insights.push(`- Capacity: ~${profile.avgTasksCompletedPerDay} tasks/day`)
    }
    if (profile.peakProductivityDays?.length) {
      insights.push(`- Peak days: ${profile.peakProductivityDays.join(', ')}`)
    }
    if (profile.avgPlanAccuracy && profile.avgPlanAccuracy < 60) {
      insights.push(`- Past plans ${profile.avgPlanAccuracy}% accurate — schedule fewer tasks.`)
    }
    if (insights.length > 0) {
      base += `\n\nPatterns:\n${insights.join('\n')}`
    }
  }

  return base
}

function buildDistributionUserPrompt(enriched: EnrichedTask[], weekStart: Date, weekEnd: Date, behavioral?: BehavioralContext): string {
  const today = formatDate(new Date())
  const weekEndStr = formatDate(weekEnd)

  // Compact task list — only fields the LLM needs for distribution
  const taskList = enriched.map(t => ({
    id: t.id,
    title: t.title,
    project: t.projectName || null,
    priority: t.priority,
    dueDate: t.dueDate || null,
    urgency: t.urgencyCategory,
    complexity: t.complexityScore,
  }))

  let behavioralSection = ''
  if (behavioral) {
    const lines: string[] = []
    if (behavioral.activeProjectNames.length > 0) {
      lines.push(`Active projects: ${behavioral.activeProjectNames.join(', ')}`)
    }
    if (behavioral.peakProductivityDays.length > 0) {
      lines.push(`Peak days: ${behavioral.peakProductivityDays.join(', ')}`)
    }
    if (behavioral.avgTasksCompletedPerDay) {
      lines.push(`Capacity: ~${behavioral.avgTasksCompletedPerDay} tasks/day`)
    }
    if (lines.length > 0) {
      behavioralSection = `\n${lines.join('\n')}\n`
    }
  }

  return `Today: ${today}
Week: ${formatDate(weekStart)} to ${weekEndStr}
${behavioralSection}
Tasks:
${JSON.stringify(taskList, null, 2)}

Return ONLY JSON with monday..sunday, unscheduled, reasoning.`
}

// ============================================================================
// STEP 3: LLM Week Theme (optional, tiny call — ~170 tokens)
// ============================================================================

async function generateWeekTheme(
  router: AIRouter,
  tasks: EnrichedTask[],
  routerOptions: Record<string, unknown>,
): Promise<string | null> {
  try {
    // Detect dominant language
    const heCount = tasks.filter(t => t.language === 'he').length
    const langHint = heCount > tasks.length / 2 ? 'Hebrew' : 'English'

    const titles = tasks.slice(0, 15).map(t => t.title).join(', ')
    const projects = [...new Set(tasks.map(t => t.projectName).filter(Boolean))].join(', ')

    const messages: ChatMessage[] = [
      { role: 'system', content: `Return a 5-10 word motivating week theme in ${langHint}. Just the theme text, nothing else.` },
      { role: 'user', content: `Tasks: ${titles}\nProjects: ${projects}` },
    ]

    const response = await router.chat(messages, {
      ...routerOptions,
      temperature: 0.7,
      timeout: 10000,
      maxTokens: 50,
    })

    const theme = response.content.trim().replace(/^["']|["']$/g, '')
    return theme.length > 0 && theme.length < 100 ? theme : null
  } catch {
    return null // Silent fail — theme is optional
  }
}

// ============================================================================
// Response parsing (distribution only — no taskReasons/weekTheme expected)
// ============================================================================

function parseDistributionResponse(
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
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [], unscheduled: [],
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
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  const plan: WeeklyPlan = {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [], unscheduled: [],
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
// Day re-suggest prompt (kept mostly as-is, still useful)
// ============================================================================

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
// Router options helper — reads weekly plan provider/model from settings
// ============================================================================

function getRouterOptions(): Record<string, unknown> {
  const settings = useSettingsStore()
  const opts: Record<string, unknown> = {
    taskType: 'planning',
    temperature: 0.3,
    timeout: 30000,
    contextFeature: 'weeklyplan', // TASK-1350: Enable user context injection
  }

  // TASK-1327: Use weekly plan specific provider/model if configured
  if (settings.weeklyPlanProvider && settings.weeklyPlanProvider !== 'auto') {
    opts.forceProvider = settings.weeklyPlanProvider
  }
  if (settings.weeklyPlanModel) {
    opts.model = settings.weeklyPlanModel
  }

  return opts
}

// ============================================================================
// Composable
// ============================================================================

export function useWeeklyPlanAI() {
  const isGenerating = ref(false) as Ref<boolean>

  /**
   * TASK-1327: 2-Call Hybrid Pipeline
   *
   * Step 0: Deterministic enrichment (no LLM, instant)
   * Step 1: LLM distribution only (~2400 tokens)
   * Step 2: Deterministic reason assembly (no LLM, instant)
   * Step 3: LLM week theme (optional, ~170 tokens)
   */
  async function generatePlan(
    tasks: TaskSummary[],
    interview?: InterviewAnswers,
    profile?: WorkProfile | null,
    behavioral?: BehavioralContext
  ): Promise<{ plan: WeeklyPlan; reasoning: string | null; taskReasons: Record<string, string>; weekTheme: string | null }> {
    if (tasks.length === 0) {
      return {
        plan: {
          monday: [], tuesday: [], wednesday: [], thursday: [],
          friday: [], saturday: [], sunday: [], unscheduled: [],
        },
        reasoning: 'No tasks to schedule.',
        taskReasons: {},
        weekTheme: null,
      }
    }

    const { weekStart, weekEnd } = getWeekBounds(useSettingsStore().weekStartsOn)

    isGenerating.value = true

    try {
      // ── Step 0: Deterministic Enrichment (instant) ──
      const enriched = enrichTasksForPlanning(tasks, weekEnd)
      console.log(`[WeeklyPlanAI] Step 0: Enriched ${enriched.length} tasks (${enriched.filter(t => t.language === 'he').length} Hebrew, ${enriched.filter(t => t.urgencyCategory === 'OVERDUE').length} overdue)`)

      const router = getSharedRouter()
      const routerOpts = getRouterOptions()

      const validTaskIds = new Set(tasks.map(t => t.id))

      // ── Step 1: LLM Distribution Only ──
      let plan: WeeklyPlan
      let reasoning: string | null = null

      const messages: ChatMessage[] = [
        { role: 'system', content: buildDistributionSystemPrompt(interview, profile) },
        { role: 'user', content: buildDistributionUserPrompt(enriched, weekStart, weekEnd, behavioral) },
      ]

      console.log(`[WeeklyPlanAI] Step 1: Requesting distribution from LLM`)

      try {
        const response = await router.chat(messages, routerOpts)
        const result = parseDistributionResponse(response.content, validTaskIds)
        plan = result.plan
        reasoning = result.reasoning
      } catch (firstError) {
        console.warn('[WeeklyPlanAI] Step 1 failed, retrying at temp 0.1...', firstError)

        // Retry once at lower temperature
        try {
          const retryOpts = { ...routerOpts, temperature: 0.1 }
          const response = await router.chat(messages, retryOpts)
          const result = parseDistributionResponse(response.content, validTaskIds)
          plan = result.plan
          reasoning = result.reasoning
        } catch (retryError) {
          console.warn('[WeeklyPlanAI] Step 1 retry failed, using fallback', retryError)
          plan = generateFallbackPlan(tasks, weekStart)
          reasoning = 'AI was unavailable. Tasks distributed by priority using a round-robin schedule.'
        }
      }

      // ── Step 2: Deterministic Reason Assembly (instant) ──
      const taskReasons = assembleTaskReasons(enriched, plan)
      console.log(`[WeeklyPlanAI] Step 2: Assembled reasons for ${Object.keys(taskReasons).length} tasks`)

      // ── Step 3: LLM Week Theme (optional, silent fail) ──
      const weekTheme = await generateWeekTheme(router, enriched, routerOpts)
      console.log(`[WeeklyPlanAI] Step 3: Week theme: ${weekTheme || '(none)'}`)

      return { plan, reasoning, taskReasons, weekTheme }
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
      const router = getSharedRouter()
      const routerOpts = getRouterOptions()

      const messages: ChatMessage[] = [
        { role: 'system', content: buildDistributionSystemPrompt(undefined, profile) },
        { role: 'user', content: buildDayResuggestPrompt(dayKey, currentPlan, allTasks) },
      ]

      try {
        const response = await router.chat(messages, {
          ...routerOpts,
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
