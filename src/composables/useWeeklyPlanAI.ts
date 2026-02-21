import { ref } from 'vue'
import type { Ref } from 'vue'
import { getSharedRouter } from '@/services/ai/routerFactory'
import type { AIRouter } from '@/services/ai/router'
import type { ChatMessage } from '@/services/ai/types'
import type { WorkProfile } from '@/utils/supabaseMappers'
import { useSettingsStore } from '@/stores/settings'
import { WEEKLY_PLAN_DEFAULTS } from '@/config/aiModels'
import { formatDateKey as formatDate } from '@/utils/dateUtils'

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

export type WeeklyPlanStatus = 'idle' | 'interview' | 'ai-questions' | 'loading' | 'review' | 'applying' | 'applied' | 'error'

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
  skipFeedback: boolean
  dynamicQuestions: DynamicQuestion[]
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

export interface DynamicQuestion {
  id: string
  question: string
  type: 'choice' | 'day-select'
  options: string[]
  answer: string  // selected option value
}

export interface InterviewAnswers {
  topPriority?: string
  daysOff?: string[]
  heavyMeetingDays?: string[]
  maxTasksPerDay?: number
  preferredWorkStyle?: 'frontload' | 'balanced' | 'backload'
  personalContext?: string
  dynamicAnswers?: DynamicQuestion[]
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
  llmTaskReasons?: Record<string, string>,
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

      // TASK-1385: Prepend LLM "why this day" reason as the FIRST bullet
      if (llmTaskReasons?.[taskId]) {
        bullets.unshift(llmTaskReasons[taskId])
      }

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

function buildDistributionSystemPrompt(interview?: InterviewAnswers, profile?: WorkProfile | null, taskCount?: number): string {
  // Calculate distribution targets
  const daysOff = new Set(interview?.daysOff || [])
  const availableDayCount = DAY_KEYS.filter(d => !daysOff.has(d)).length
  const maxPerDay = interview?.maxTasksPerDay || 6
  const targetPerDay = taskCount ? Math.min(Math.ceil(taskCount / availableDayCount), maxPerDay) : 4

  let base = `You are a personal weekly planner who DEEPLY understands each task. You must READ every task title and description to understand its nature, then schedule intelligently.

YOUR JOB: Create a weekly plan with REAL reasoning — not random distribution.

SCHEDULING STRATEGY:
1. READ each task title — understand what it IS (coding, design, meetings, errands, learning, planning, etc.)
2. GROUP related tasks on the same day (same project, same type of work) to minimize context-switching
3. SEQUENCE dependencies — if task B builds on task A, put A earlier in the week
4. MATCH task nature to the day — complex/creative work on peak days, admin/errands on lighter days
5. RESPECT deadlines — DUE_THIS_WEEK tasks must go on or before their due date
6. Spread OVERDUE tasks across Mon–Wed (NOT all on Monday)
7. Target ~${targetPerDay} tasks per available day. NEVER exceed ${maxPerDay} per day
8. Weekends (Sat/Sun) = overflow only. Each task ID in exactly ONE day or "unscheduled"

RESPONSE FORMAT — Return ONLY valid JSON:
{
  "monday": ["id1", "id2"], "tuesday": [...], ..., "sunday": [...], "unscheduled": [...],
  "reasoning": "2-3 sentences: your OVERALL strategy referencing specific projects and task types",
  "taskReasons": {
    "taskId1": "Specific reason WHY this day (10-20 words)",
    "taskId2": "Another specific reason..."
  }
}

CRITICAL — taskReasons must be SPECIFIC to each task. Examples:
  GOOD: "Overdue 3 days — clear early before new project work starts"
  GOOD: "Groups with 2 other FlowState tasks for focused coding block"
  GOOD: "Quick 15m admin task — fits Wednesday's lighter schedule after meetings"
  GOOD: "Creative design work — scheduled on peak productivity Thursday"
  BAD: "Scheduled for balanced distribution" (generic, says nothing)
  BAD: "Medium priority task" (just restates metadata)
  BAD: "Placed on Tuesday" (no reasoning at all)`

  if (interview) {
    const extras: string[] = []
    if (interview.topPriority) {
      extras.push(`- TOP PRIORITY this week: "${interview.topPriority}". Schedule related tasks on the best days, earliest in the week.`)
    }
    if (interview.daysOff && interview.daysOff.length > 0) {
      extras.push(`- Days OFF (ZERO tasks): ${interview.daysOff.join(', ')}.`)
    }
    if (interview.heavyMeetingDays && interview.heavyMeetingDays.length > 0) {
      extras.push(`- Heavy meeting days: ${interview.heavyMeetingDays.join(', ')}. Only schedule quick/simple tasks on these days (max 2).`)
    }
    if (interview.maxTasksPerDay) {
      extras.push(`- HARD LIMIT: max ${interview.maxTasksPerDay} tasks per day.`)
    }
    if (interview.preferredWorkStyle === 'frontload') {
      extras.push('- Work style: front-load (heavier Mon-Tue, lighter Thu-Fri)')
    } else if (interview.preferredWorkStyle === 'backload') {
      extras.push('- Work style: back-load (lighter Mon-Tue, heavier Thu-Fri)')
    }
    if (extras.length > 0) {
      base += `\n\nUSER PREFERENCES (use these to make scheduling decisions):\n${extras.join('\n')}`
    }
  }

  if (profile) {
    const insights: string[] = []
    if (profile.avgTasksCompletedPerDay) {
      insights.push(`- This user typically completes ~${profile.avgTasksCompletedPerDay} tasks/day — don't overload beyond this.`)
    }
    if (profile.peakProductivityDays?.length) {
      insights.push(`- Peak productivity days: ${profile.peakProductivityDays.join(', ')}. Schedule complex/demanding tasks HERE. Lighter tasks on other days.`)
    }
    if (profile.avgPlanAccuracy && profile.avgPlanAccuracy < 60) {
      insights.push(`- Past plans were only ${profile.avgPlanAccuracy}% followed — schedule conservatively.`)
    }
    if (profile.preferredWorkStyle) {
      insights.push(`- Preferred work style: ${profile.preferredWorkStyle}`)
    }
    if (insights.length > 0) {
      base += `\n\nUSER HISTORY (learned patterns — USE these in your reasoning):\n${insights.join('\n')}`
    }
  }

  return base
}

function buildDistributionUserPrompt(enriched: EnrichedTask[], weekStart: Date, weekEnd: Date, behavioral?: BehavioralContext, interview?: InterviewAnswers): string {
  const today = formatDate(new Date())
  const weekEndStr = formatDate(weekEnd)

  // Compact task list — only fields the LLM needs for distribution
  const taskList = enriched.map(t => ({
    id: t.id,
    title: t.title,
    desc: t.description ? t.description.slice(0, 80) : null,
    project: t.projectName || null,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate || null,
    urgency: t.urgencyCategory,
    complexity: t.complexityScore,
    estimatedMinutes: t.estimatedDuration || null,
  }))

  // Count urgency categories to guide the LLM
  const overdueCount = enriched.filter(t => t.urgencyCategory === 'OVERDUE').length
  const inProgressCount = enriched.filter(t => t.urgencyCategory === 'IN_PROGRESS').length
  const dueThisWeekCount = enriched.filter(t => t.urgencyCategory === 'DUE_THIS_WEEK').length

  let personalSection = ''
  if (interview?.personalContext) {
    personalSection = `\nAbout the user (their own words):\n"${interview.personalContext}"\n`
  }

  let dynamicQASection = ''
  if (interview?.dynamicAnswers && interview.dynamicAnswers.length > 0) {
    const qaLines = interview.dynamicAnswers
      .filter(qa => qa.answer.trim())
      .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join('\n\n')
    if (qaLines) {
      dynamicQASection = `\nUser's scheduling preferences (from interview):\n${qaLines}\n`
    }
  }

  let behavioralSection = ''
  if (behavioral) {
    const lines: string[] = []
    if (behavioral.activeProjectNames.length > 0) {
      lines.push(`Active projects: ${behavioral.activeProjectNames.join(', ')}`)
    }
    if (behavioral.peakProductivityDays.length > 0) {
      lines.push(`Peak productivity days: ${behavioral.peakProductivityDays.join(', ')} — put complex tasks HERE`)
    }
    if (behavioral.avgTasksCompletedPerDay) {
      lines.push(`Typical daily capacity: ~${behavioral.avgTasksCompletedPerDay} tasks/day`)
    }
    if (behavioral.completionRate !== null && behavioral.completionRate !== undefined) {
      lines.push(`Plan follow-through: ${Math.round(behavioral.completionRate)}%${behavioral.completionRate < 60 ? ' (LOW — schedule fewer tasks to be realistic)' : ''}`)
    }
    if (behavioral.frequentlyMissedProjects.length > 0) {
      lines.push(`Often-missed projects: ${behavioral.frequentlyMissedProjects.join(', ')} — schedule these EARLY in the week`)
    }
    if (behavioral.recentlyCompletedTitles.length > 0) {
      lines.push(`Recently completed: ${behavioral.recentlyCompletedTitles.slice(0, 5).join(', ')}`)
    }
    if (behavioral.workInsights.length > 0) {
      lines.push(`Work patterns:\n${behavioral.workInsights.slice(0, 5).map(i => `  - ${i}`).join('\n')}`)
    }
    if (lines.length > 0) {
      behavioralSection = `\nIMPORTANT — What I know about this user (USE this for scheduling decisions):\n${lines.join('\n')}\n`
    }
  }

  // Build project summary for grouping awareness
  const projectGroups: Record<string, number> = {}
  for (const t of enriched) {
    if (t.projectName) {
      projectGroups[t.projectName] = (projectGroups[t.projectName] || 0) + 1
    }
  }
  const projectSummary = Object.entries(projectGroups)
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => `${name} (${count} tasks)`)
    .join(', ')

  return `Today: ${today}
Week: ${formatDate(weekStart)} to ${weekEndStr}
Total tasks: ${enriched.length} (${overdueCount} overdue, ${inProgressCount} in-progress, ${dueThisWeekCount} due this week)
${projectSummary ? `Projects with multiple tasks (GROUP these on same day): ${projectSummary}` : ''}
${personalSection}${behavioralSection}${dynamicQASection}
Tasks:
${JSON.stringify(taskList, null, 2)}

Schedule these ${enriched.length} tasks across the week. READ each task title to understand its nature. Return ONLY JSON with monday..sunday, unscheduled, reasoning, taskReasons.`
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
// STEP 1.5: Deterministic Rebalancer (no LLM, instant)
// TASK-1385: Safety net that ensures even distribution regardless of LLM quality
// ============================================================================

function rebalancePlan(
  plan: WeeklyPlan,
  enrichedTasks: EnrichedTask[],
  interview?: InterviewAnswers
): WeeklyPlan {
  const taskMap = new Map(enrichedTasks.map(t => [t.id, t]))

  // Determine available days
  const daysOff = new Set(interview?.daysOff || [])
  const availableDays = DAY_KEYS.filter(d => !daysOff.has(d))

  if (availableDays.length === 0) return plan

  // Count total scheduled (exclude unscheduled)
  const totalScheduled = DAY_KEYS.reduce((sum, d) => sum + plan[d].length, 0)
  if (totalScheduled === 0) return plan

  const maxPerDay = interview?.maxTasksPerDay || 6
  const targetPerDay = Math.ceil(totalScheduled / availableDays.length)

  // Check if rebalancing is needed: any day has > 120% of target
  const needsRebalance = availableDays.some(d => plan[d].length > Math.ceil(targetPerDay * 1.2))
  // Also check if any available day has 0 tasks while others have > target
  const hasEmptyDays = availableDays.some(d => plan[d].length === 0) && totalScheduled > availableDays.length

  if (!needsRebalance && !hasEmptyDays) return plan

  console.log(`[WeeklyPlanAI] Rebalancer triggered: target=${targetPerDay}/day, max=${maxPerDay}, rebalancing across ${availableDays.length} days`)

  // Collect all scheduled tasks with their priority for redistribution
  const allTasks: Array<{ id: string; priority: number; urgency: string }> = []
  for (const day of DAY_KEYS) {
    for (const taskId of plan[day]) {
      const task = taskMap.get(taskId)
      const priorityScore = task?.priority === 'high' ? 3 : task?.priority === 'medium' ? 2 : 1
      const urgency = task?.urgencyCategory || 'normal'
      allTasks.push({ id: taskId, priority: priorityScore, urgency })
    }
  }

  // Sort: overdue first, then in-progress, then by priority
  const urgencyOrder: Record<string, number> = { 'OVERDUE': 0, 'IN_PROGRESS': 1, 'DUE_THIS_WEEK': 2, 'normal': 3 }
  allTasks.sort((a, b) => {
    const ua = urgencyOrder[a.urgency] ?? 3
    const ub = urgencyOrder[b.urgency] ?? 3
    if (ua !== ub) return ua - ub
    return b.priority - a.priority
  })

  // Redistribute evenly across available days
  const newPlan: WeeklyPlan = {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [], unscheduled: [...plan.unscheduled],
  }

  // Round-robin assignment respecting maxPerDay
  let dayIdx = 0
  for (const task of allTasks) {
    // Find next available day that isn't full
    let attempts = 0
    while (newPlan[availableDays[dayIdx]].length >= maxPerDay && attempts < availableDays.length) {
      dayIdx = (dayIdx + 1) % availableDays.length
      attempts++
    }

    if (attempts >= availableDays.length) {
      // All days full — send to unscheduled
      newPlan.unscheduled.push(task.id)
    } else {
      newPlan[availableDays[dayIdx]].push(task.id)
      dayIdx = (dayIdx + 1) % availableDays.length
    }
  }

  const distribution = availableDays.map(d => `${d}:${newPlan[d].length}`).join(', ')
  console.log(`[WeeklyPlanAI] Rebalanced: ${distribution}`)

  return newPlan
}

// ============================================================================
// Response parsing (distribution only — no taskReasons/weekTheme expected)
// ============================================================================

function parseDistributionResponse(
  response: string,
  validTaskIds: Set<string>
): { plan: WeeklyPlan; reasoning: string | null; llmTaskReasons: Record<string, string> } {
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

  // Extract per-task reasons from LLM (TASK-1385: "why this day")
  const llmTaskReasons: Record<string, string> = {}
  if (parsed.taskReasons && typeof parsed.taskReasons === 'object' && !Array.isArray(parsed.taskReasons)) {
    for (const [taskId, reason] of Object.entries(parsed.taskReasons as Record<string, unknown>)) {
      if (typeof reason === 'string' && validTaskIds.has(taskId)) {
        llmTaskReasons[taskId] = reason
      }
    }
  }

  return { plan, reasoning, llmTaskReasons }
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
    timeout: 60000,  // TASK-1385: Increased from 30s — better models need more time
    contextFeature: 'weeklyplan', // TASK-1350: Enable user context injection
  }

  // TASK-1327: Use weekly plan specific provider/model if configured
  if (settings.weeklyPlanProvider && settings.weeklyPlanProvider !== 'auto') {
    opts.forceProvider = settings.weeklyPlanProvider
  }
  if (settings.weeklyPlanModel) {
    opts.model = settings.weeklyPlanModel
  } else {
    // TASK-1385/1387: Smart model defaults from centralized registry
    const wpDefault = WEEKLY_PLAN_DEFAULTS[settings.weeklyPlanProvider as keyof typeof WEEKLY_PLAN_DEFAULTS]
    if (wpDefault) {
      opts.model = wpDefault
    }
    // 'auto' and 'ollama' use their provider's default model
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

      const router = await getSharedRouter()
      const routerOpts = getRouterOptions()

      const validTaskIds = new Set(tasks.map(t => t.id))

      // ── Step 1: LLM Distribution Only ──
      let plan: WeeklyPlan
      let reasoning: string | null = null
      let llmReasons: Record<string, string> = {}

      const messages: ChatMessage[] = [
        { role: 'system', content: buildDistributionSystemPrompt(interview, profile, enriched.length) },
        { role: 'user', content: buildDistributionUserPrompt(enriched, weekStart, weekEnd, behavioral, interview) },
      ]

      console.log(`[WeeklyPlanAI] Step 1: Requesting distribution from LLM`)

      try {
        const response = await router.chat(messages, routerOpts)
        const result = parseDistributionResponse(response.content, validTaskIds)
        plan = result.plan
        reasoning = result.reasoning
        llmReasons = result.llmTaskReasons
      } catch (firstError) {
        console.warn('[WeeklyPlanAI] Step 1 failed, retrying at temp 0.1...', firstError)

        // Retry once at lower temperature
        try {
          const retryOpts = { ...routerOpts, temperature: 0.1 }
          const response = await router.chat(messages, retryOpts)
          const result = parseDistributionResponse(response.content, validTaskIds)
          plan = result.plan
          reasoning = result.reasoning
          llmReasons = result.llmTaskReasons
        } catch (retryError) {
          console.warn('[WeeklyPlanAI] Step 1 retry failed, using fallback', retryError)
          plan = generateFallbackPlan(tasks, weekStart)
          reasoning = 'AI was unavailable. Tasks distributed by priority using a round-robin schedule.'
        }
      }

      // ── Step 1.5: Deterministic Rebalancer (instant) ──
      plan = rebalancePlan(plan, enriched, interview)

      // ── Step 2: Deterministic Reason Assembly (instant) ──
      const taskReasons = assembleTaskReasons(enriched, plan, llmReasons)
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
      const router = await getSharedRouter()
      const routerOpts = getRouterOptions()

      const messages: ChatMessage[] = [
        { role: 'system', content: buildDistributionSystemPrompt(undefined, profile, allTasks.length) },
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

  /**
   * Generate 2-3 structured questions with clickable answer options.
   * Aware of past memory observations to avoid re-asking known preferences.
   */
  async function generateDynamicQuestions(
    tasks: TaskSummary[],
    personalContext?: string,
    interview?: InterviewAnswers,
    pastLearnings?: string[],
  ): Promise<Array<{ question: string; type: 'choice' | 'day-select'; options: string[] }>> {
    try {
      const router = await getSharedRouter()
      const routerOpts = getRouterOptions()

      // Build a compact task summary for the LLM
      const taskSummary = tasks.slice(0, 20).map(t => {
        const parts = [t.title]
        if (t.projectName) parts.push(`[${t.projectName}]`)
        if (t.priority) parts.push(`(${t.priority})`)
        if (t.status === 'in_progress') parts.push('— in progress')
        if (t.dueDate) parts.push(`due: ${t.dueDate}`)
        if (t.description) parts.push(`| ${t.description.slice(0, 60)}`)
        return parts.join(' ')
      }).join('\n')

      let contextSection = ''
      if (personalContext) {
        contextSection = `\nUser's self-description:\n"${personalContext}"\n`
      }

      let interviewSection = ''
      if (interview) {
        const parts: string[] = []
        if (interview.topPriority) parts.push(`Top priority: ${interview.topPriority}`)
        if (interview.daysOff?.length) parts.push(`Days off: ${interview.daysOff.join(', ')}`)
        if (interview.preferredWorkStyle) parts.push(`Work style: ${interview.preferredWorkStyle}`)
        if (parts.length > 0) interviewSection = `\nUser preferences:\n${parts.join('\n')}\n`
      }

      let pastLearningsSection = ''
      if (pastLearnings && pastLearnings.length > 0) {
        pastLearningsSection = `\nAlready known about this user (DON'T re-ask these):\n${pastLearnings.map(l => `- ${l}`).join('\n')}\n`
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a weekly planning assistant. Generate 2-3 STRUCTURED questions with clickable answer options to help schedule the user's tasks.

QUESTION TYPES:
1. "day-select" — ask which DAY something should happen. Options are day names.
   Use when: tasks relate to a specific location, routine, or commitment tied to a day.
2. "choice" — ask a preference with 2-4 short options.
   Use when: batching, priority, energy, or approach decisions.

WHAT TO ASK ABOUT:
- Location/routine connections: If tasks mention a place (school, office, gym), ask which day the user goes there
- Task batching: Group similar tasks? Errands together? Project work together?
- Priority trade-offs: Which overdue tasks matter most? What can wait?
- Energy matching: Creative vs admin work — when?

RULES:
- Return ONLY a JSON array of objects
- Each object has: "question" (string), "type" ("choice" or "day-select"), "options" (string array)
- For "day-select": options = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
- For "choice": provide 2-4 short option labels (max 5 words each)
- Questions must reference SPECIFIC tasks from the list
- Skip things already known from past interviews
- Keep questions short (1 sentence)

EXAMPLE OUTPUT:
[
  {"question":"I see school-related tasks — which day do you go to school?","type":"day-select","options":["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},
  {"question":"Blog post and video editing are both creative — batch them together?","type":"choice","options":["Yes, same day","No, spread them out","Doesn't matter"]},
  {"question":"You have 3 overdue tasks — how should I handle them?","type":"choice","options":["Clear them first (Mon-Tue)","Spread across the week","Mix with new tasks"]}
]`
        },
        {
          role: 'user',
          content: `${contextSection}${interviewSection}${pastLearningsSection}
This week's tasks:
${taskSummary}`
        }
      ]

      const response = await router.chat(messages, {
        ...routerOpts,
        temperature: 0.4,
        timeout: 15000,
        maxTokens: 600,
      })

      // Parse response — expect JSON array of structured questions
      let content = response.content.trim()
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) content = codeBlockMatch[1].trim()

      const parsed = JSON.parse(content)
      if (!Array.isArray(parsed)) return []

      const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      return parsed.slice(0, 3).map((q: Record<string, unknown>) => {
        const question = typeof q.question === 'string' ? q.question : ''
        const type = q.type === 'day-select' ? 'day-select' as const : 'choice' as const
        let options = Array.isArray(q.options) ? q.options.filter((o: unknown) => typeof o === 'string') as string[] : []

        // Normalize day-select to always have all 7 days
        if (type === 'day-select') {
          options = DAY_OPTIONS
        }

        // Ensure choice has at least 2 options
        if (type === 'choice' && options.length < 2) return null

        return question ? { question, type, options } : null
      }).filter(Boolean) as Array<{ question: string; type: 'choice' | 'day-select'; options: string[] }>
    } catch (err) {
      console.warn('[WeeklyPlanAI] Dynamic question generation failed:', err)
      return []
    }
  }

  return {
    generatePlan,
    regenerateDay,
    generateDynamicQuestions,
    isGenerating,
  }
}
