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

// ============================================================================
// Deterministic Distribution Types
// ============================================================================

interface DayBucket {
  key: DayKey
  capacity: number
  complexityCap: number
  weight: number            // work-style weight (frontload/backload/balanced)
  routineKeywords: string[] // from memory graph scheduling_preference observations
  isPeakDay: boolean
  tasks: string[]           // placed task IDs
  totalComplexity: number
}

type TaskTier = 1 | 2 | 3 | 4
interface ClassifiedTask extends EnrichedTask {
  tier: TaskTier
  constrainedDay: DayKey | null  // for Tier 1 tasks
}

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
// STEP 1: Deterministic Distribution Algorithm (no LLM, instant)
// ============================================================================

/** Parse scheduling_preference observations into day→keywords map */
function parseSchedulingPreferences(
  profile?: WorkProfile | null
): Map<DayKey, string[]> {
  const map = new Map<DayKey, string[]>()
  if (!profile?.memoryGraph) return map

  const dayNameMap: Record<string, DayKey> = {
    sunday: 'sunday', monday: 'monday', tuesday: 'tuesday',
    wednesday: 'wednesday', thursday: 'thursday', friday: 'friday', saturday: 'saturday',
  }

  for (const obs of profile.memoryGraph) {
    if (obs.relation !== 'scheduling_preference' || obs.confidence < 0.6) continue
    // Format: "wednesday (context: Which day do you go to school?)"
    const match = obs.value.match(/^(\w+)\s*\(context:\s*(.+?)\??\s*\)/)
    if (!match) continue
    const [, dayStr, context] = match
    const dayKey = dayNameMap[dayStr.toLowerCase()]
    if (!dayKey) continue

    // Extract keywords from the context question
    const topic = context
      .replace(/^Which day (?:do you |does the |is |are you )?(?:go to |at |for |usually )?/i, '')
      .replace(/^I see .+? — which day (?:do you |does the )?(?:go to |usually )?/i, '')
      .replace(/^You have .+? — which day/i, '')
      .trim()
      .toLowerCase()

    const existing = map.get(dayKey) || []
    existing.push(topic)
    map.set(dayKey, existing)
  }

  return map
}

/** Routine keyword patterns for matching tasks to routine days (Hebrew + English) */
const ROUTINE_PATTERNS: Array<{ keywords: RegExp; label: string }> = [
  { keywords: /תיכון|בית.?ספר|school|high.?school/i, label: 'school' },
  { keywords: /אוניברסיטה|university|uni|campus|college|לימודים/i, label: 'university' },
  { keywords: /משרד|office|עבודה|work/i, label: 'office' },
  { keywords: /חדר.?כושר|gym|fitness|אימון|workout/i, label: 'gym' },
  { keywords: /סופר|קניות|grocery|shopping|errands|סידורים/i, label: 'errand' },
]

/** Check if a task's text matches any of the given routine keywords */
function matchesRoutineKeywords(taskText: string, routineKeywords: string[]): string | null {
  const textLower = taskText.toLowerCase()
  for (const kw of routineKeywords) {
    const kwLower = kw.toLowerCase()
    // Direct substring match
    if (textLower.includes(kwLower)) return kw
    // Check against known routine patterns
    for (const pattern of ROUTINE_PATTERNS) {
      if (pattern.label.includes(kwLower) || kwLower.includes(pattern.label)) {
        if (pattern.keywords.test(taskText)) return kw
      }
    }
  }
  return null
}

/** Get the DayKey for a date within the current week, or null if outside */
function dateToDayKey(dateStr: string, weekStart: Date): DayKey | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return null

  const diffMs = d.getTime() - weekStart.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0 || diffDays > 6) return null

  // weekStart is the first day of the week; map offset to DAY_KEYS
  // DAY_KEYS = [monday, tuesday, ..., sunday]
  // We need to know what day of week weekStart is
  const startDow = weekStart.getDay() // 0=Sun, 1=Mon...6=Sat
  const targetDow = (startDow + diffDays) % 7

  // Map JS day-of-week to DayKey
  const dowToDayKey: Record<number, DayKey> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday',
  }
  return dowToDayKey[targetDow] || null
}

/** Classify enriched tasks into tiers */
function classifyIntoTiers(
  enriched: EnrichedTask[],
  interview: InterviewAnswers | undefined,
  schedulingPrefs: Map<DayKey, string[]>,
  weekStart: Date,
): ClassifiedTask[] {
  const topPriorityProject = interview?.topPriority?.toLowerCase() || ''

  return enriched.map(task => {
    const taskText = `${task.title} ${task.description || ''} ${task.projectName || ''}`
    let tier: TaskTier = 4
    let constrainedDay: DayKey | null = null

    // Check Tier 1: hard-constrained by due date this week
    const dueDayKey = dateToDayKey(task.dueDate, weekStart)
    if (dueDayKey && task.urgencyCategory !== 'OVERDUE') {
      tier = 1
      constrainedDay = dueDayKey
    }

    // Check Tier 1: routine keyword match to a specific day
    if (tier !== 1) {
      for (const [dayKey, keywords] of schedulingPrefs.entries()) {
        const matchedKw = matchesRoutineKeywords(taskText, keywords)
        if (matchedKw) {
          tier = 1
          constrainedDay = dayKey
          break
        }
      }
    }

    // Tier 2: overdue or in-progress
    if (tier > 2 && (task.urgencyCategory === 'OVERDUE' || task.urgencyCategory === 'IN_PROGRESS')) {
      tier = 2
    }

    // Tier 3: high priority, top priority project, or due this week
    if (tier > 3) {
      const isHighPriority = task.priority === 'high'
      const isTopPriorityProject = topPriorityProject && (task.projectName?.toLowerCase() || '').includes(topPriorityProject)
      const isDueThisWeek = task.urgencyCategory === 'DUE_THIS_WEEK'
      if (isHighPriority || isTopPriorityProject || isDueThisWeek) {
        tier = 3
      }
    }

    return { ...task, tier, constrainedDay }
  })
}

/** Find the nearest available day to a target day */
function findNearestAvailableDay(
  targetKey: DayKey,
  buckets: DayBucket[],
  maxPerDay: number,
): DayKey | null {
  const targetIdx = DAY_KEYS.indexOf(targetKey)
  // Search outward from target: +1, -1, +2, -2, ...
  for (let offset = 0; offset <= 6; offset++) {
    for (const dir of [1, -1]) {
      if (offset === 0 && dir === -1) continue // skip duplicate at 0
      const idx = targetIdx + offset * dir
      if (idx < 0 || idx >= DAY_KEYS.length) continue
      const bucket = buckets[idx]
      if (bucket.capacity > 0 && bucket.tasks.length < maxPerDay) {
        return bucket.key
      }
    }
  }
  return null
}

/**
 * Deterministic task distribution algorithm.
 * Pure function — no async, no LLM calls.
 */
function distributeTasksDeterministically(
  enriched: EnrichedTask[],
  interview?: InterviewAnswers,
  profile?: WorkProfile | null,
  behavioral?: BehavioralContext
): { plan: WeeklyPlan; reasoning: string; placementReasons: Record<string, string> } {
  const maxPerDay = interview?.maxTasksPerDay || 6
  const daysOff = new Set(interview?.daysOff || [])
  const heavyMeetingDays = new Set(interview?.heavyMeetingDays || [])
  const workStyle = interview?.preferredWorkStyle || 'balanced'

  // Work-style weights
  const frontloadWeights: Record<DayKey, number> = {
    monday: 1.4, tuesday: 1.3, wednesday: 1.0, thursday: 0.8,
    friday: 0.6, saturday: 0.5, sunday: 0.4,
  }
  const backloadWeights: Record<DayKey, number> = {
    monday: 0.4, tuesday: 0.5, wednesday: 0.6, thursday: 0.8,
    friday: 1.0, saturday: 1.3, sunday: 1.4,
  }

  const getWeight = (day: DayKey): number => {
    if (workStyle === 'frontload') return frontloadWeights[day]
    if (workStyle === 'backload') return backloadWeights[day]
    return 1.0
  }

  // Parse scheduling preferences from memory graph
  const schedulingPrefs = parseSchedulingPreferences(profile)

  // Peak productivity days
  const peakDays = new Set<string>(
    (behavioral?.peakProductivityDays || profile?.peakProductivityDays || [])
      .map(d => d.toLowerCase())
  )

  // ── Phase 1: Initialize Day Buckets ──
  const buckets: DayBucket[] = DAY_KEYS.map(key => {
    const isOff = daysOff.has(key)
    const isHeavyMeeting = heavyMeetingDays.has(key)

    return {
      key,
      capacity: isOff ? 0 : isHeavyMeeting ? 2 : maxPerDay,
      complexityCap: isHeavyMeeting ? 3 : 10,
      weight: isOff ? 0 : getWeight(key),
      routineKeywords: schedulingPrefs.get(key) || [],
      isPeakDay: peakDays.has(key),
      tasks: [],
      totalComplexity: 0,
    }
  })

  const bucketMap = new Map(buckets.map(b => [b.key, b]))

  // Helper to place a task on a day
  const placeTask = (taskId: string, dayKey: DayKey, complexity: number): boolean => {
    const bucket = bucketMap.get(dayKey)!
    if (bucket.tasks.length >= bucket.capacity) return false
    bucket.tasks.push(taskId)
    bucket.totalComplexity += complexity
    return true
  }

  // Get current week start for date calculations
  const settingsStore = useSettingsStore()
  const weekStartDate = (() => {
    const now = new Date()
    const day = now.getDay()
    const weekStartsOn = settingsStore.weekStartsOn
    let diff: number
    if (weekStartsOn === 1) {
      diff = day === 0 ? -6 : 1 - day
    } else {
      diff = -day
    }
    const start = new Date(now)
    start.setDate(now.getDate() + diff)
    start.setHours(0, 0, 0, 0)
    return start
  })()

  // ── Phase 2: Classify Tasks into Tiers ──
  const classified = classifyIntoTiers(enriched, interview, schedulingPrefs, weekStartDate)

  // Sort by tier, then by urgency within tier
  const tier1 = classified.filter(t => t.tier === 1)
  const tier2 = classified.filter(t => t.tier === 2)
  const tier3 = classified.filter(t => t.tier === 3)
  const tier4 = classified.filter(t => t.tier === 4)

  const placementReasons: Record<string, string> = {}
  const unscheduled: string[] = []

  // ── Phase 3: Place tasks tier by tier ──

  // Tier 1: Place on constrained day, spill to nearest if full
  for (const task of tier1) {
    const targetDay = task.constrainedDay!
    if (placeTask(task.id, targetDay, task.complexityScore)) {
      // Determine reason
      const bucket = bucketMap.get(targetDay)!
      const matchedKw = matchesRoutineKeywords(
        `${task.title} ${task.description || ''} ${task.projectName || ''}`,
        bucket.routineKeywords,
      )
      if (matchedKw) {
        const isHe = task.language === 'he'
        const dayDisplay = targetDay.charAt(0).toUpperCase() + targetDay.slice(1)
        placementReasons[task.id] = isHe
          ? `משימת ${matchedKw} → ${dayDisplay} (היום שלך ל${matchedKw})`
          : `${matchedKw} task → ${dayDisplay} (your ${matchedKw} day)`
      } else {
        const isHe = task.language === 'he'
        const dayDisplay = targetDay.charAt(0).toUpperCase() + targetDay.slice(1)
        placementReasons[task.id] = isHe
          ? `תאריך יעד ב${dayDisplay}`
          : `Due ${dayDisplay}`
      }
    } else {
      // Spill to nearest available day
      const spillDay = findNearestAvailableDay(targetDay, buckets, maxPerDay)
      if (spillDay && placeTask(task.id, spillDay, task.complexityScore)) {
        const isHe = task.language === 'he'
        const targetDisplay = targetDay.charAt(0).toUpperCase() + targetDay.slice(1)
        const spillDisplay = spillDay.charAt(0).toUpperCase() + spillDay.slice(1)
        placementReasons[task.id] = isHe
          ? `${targetDisplay} מלא → ${spillDisplay} (היום הקרוב הפנוי)`
          : `${targetDisplay} full → ${spillDisplay} (nearest available)`
      } else {
        unscheduled.push(task.id)
        placementReasons[task.id] = task.language === 'he' ? 'אין מקום ביום הנדרש' : 'No room on required day'
      }
    }
  }

  // Tier 2: Overdue → spread across early-week; In-progress → early too
  const tier2Overdue = tier2.filter(t => t.urgencyCategory === 'OVERDUE')
    .sort((a, b) => b.overdueDays - a.overdueDays) // most overdue first
  const tier2InProgress = tier2.filter(t => t.urgencyCategory === 'IN_PROGRESS')

  // Get early available weekdays (Mon-Wed) for spreading overdue
  const earlyWeekdays: DayKey[] = (['monday', 'tuesday', 'wednesday'] as DayKey[])
    .filter(d => !daysOff.has(d))
  // Fallback to any available day if all early days are off
  const earlyDays = earlyWeekdays.length > 0
    ? earlyWeekdays
    : DAY_KEYS.filter(d => !daysOff.has(d))

  // Round-robin overdue tasks across early days
  let earlyIdx = 0
  for (const task of tier2Overdue) {
    let placed = false
    for (let attempts = 0; attempts < earlyDays.length; attempts++) {
      const dayKey = earlyDays[earlyIdx % earlyDays.length]
      earlyIdx++
      if (placeTask(task.id, dayKey, task.complexityScore)) {
        const isHe = task.language === 'he'
        const dayDisplay = dayKey.charAt(0).toUpperCase() + dayKey.slice(1)
        placementReasons[task.id] = isHe
          ? `${task.overdueDays} ימים באיחור → פינוי ב${dayDisplay}`
          : `${task.overdueDays} days overdue → clearing ${dayDisplay}`
        placed = true
        break
      }
    }
    if (!placed) {
      // Try any available day
      const anyDay = findNearestAvailableDay('monday', buckets, maxPerDay)
      if (anyDay && placeTask(task.id, anyDay, task.complexityScore)) {
        const isHe = task.language === 'he'
        const dayDisplay = anyDay.charAt(0).toUpperCase() + anyDay.slice(1)
        placementReasons[task.id] = isHe
          ? `${task.overdueDays} ימים באיחור → ${dayDisplay}`
          : `${task.overdueDays} days overdue → ${dayDisplay}`
      } else {
        unscheduled.push(task.id)
        placementReasons[task.id] = task.language === 'he' ? 'באיחור — אין מקום פנוי' : 'Overdue — no room available'
      }
    }
  }

  // In-progress tasks → early in the week
  for (const task of tier2InProgress) {
    let placed = false
    for (const dayKey of earlyDays) {
      if (placeTask(task.id, dayKey, task.complexityScore)) {
        const isHe = task.language === 'he'
        const dayDisplay = dayKey.charAt(0).toUpperCase() + dayKey.slice(1)
        placementReasons[task.id] = isHe
          ? `כבר בתהליך → ${dayDisplay} (מוקדם בשבוע)`
          : `In progress → ${dayDisplay} (early in week)`
        placed = true
        break
      }
    }
    if (!placed) {
      const anyDay = findNearestAvailableDay('monday', buckets, maxPerDay)
      if (anyDay && placeTask(task.id, anyDay, task.complexityScore)) {
        const isHe = task.language === 'he'
        const dayDisplay = anyDay.charAt(0).toUpperCase() + anyDay.slice(1)
        placementReasons[task.id] = isHe
          ? `כבר בתהליך → ${dayDisplay}`
          : `In progress → ${dayDisplay}`
      } else {
        unscheduled.push(task.id)
        placementReasons[task.id] = task.language === 'he' ? 'בתהליך — אין מקום' : 'In progress — no room'
      }
    }
  }

  // Tier 3: High priority / topPriority project / DUE_THIS_WEEK
  // Peak days first, batch same-project tasks
  const topPriorityProject = interview?.topPriority?.toLowerCase() || ''
  const peakBuckets = buckets.filter(b => b.isPeakDay && b.capacity > 0)
  const availableBuckets = buckets.filter(b => b.capacity > 0)

  // Group tier3 tasks by project for batching
  const tier3ByProject = new Map<string, ClassifiedTask[]>()
  for (const task of tier3) {
    const projKey = task.projectName?.toLowerCase() || '_none_'
    const group = tier3ByProject.get(projKey) || []
    group.push(task)
    tier3ByProject.set(projKey, group)
  }

  // Place topPriority project tasks together on peak days first
  for (const [projKey, tasks] of tier3ByProject.entries()) {
    const isTopPriority = topPriorityProject && projKey.includes(topPriorityProject)

    // For top priority project, try to batch on the same peak day
    if (isTopPriority && peakBuckets.length > 0) {
      // Find peak day with most capacity
      const bestPeakDay = peakBuckets
        .filter(b => b.tasks.length < b.capacity)
        .sort((a, b) => (b.capacity - b.tasks.length) - (a.capacity - a.tasks.length))[0]

      if (bestPeakDay) {
        for (const task of tasks) {
          if (placeTask(task.id, bestPeakDay.key, task.complexityScore)) {
            const isHe = task.language === 'he'
            const dayDisplay = bestPeakDay.key.charAt(0).toUpperCase() + bestPeakDay.key.slice(1)
            const projName = task.projectName || topPriorityProject
            placementReasons[task.id] = isHe
              ? `עדיפות עליונה (${projName}) → ${dayDisplay} (יום שיא)`
              : `Top priority (${projName}) → peak day (${dayDisplay})`
          }
        }
        continue
      }
    }

    // Non-top-priority or no peak days available: place by scoring
    for (const task of tasks) {
      if (placementReasons[task.id]) continue // already placed

      // DUE_THIS_WEEK: place on or before due date
      if (task.urgencyCategory === 'DUE_THIS_WEEK' && task.dueDate) {
        const dueDayKey = dateToDayKey(task.dueDate, weekStartDate)
        if (dueDayKey) {
          // Try the due day first, then days before it
          const dueIdx = DAY_KEYS.indexOf(dueDayKey)
          let placed = false
          for (let i = dueIdx; i >= 0; i--) {
            const candidate = buckets[i]
            if (candidate.capacity > 0 && candidate.tasks.length < candidate.capacity) {
              placeTask(task.id, candidate.key, task.complexityScore)
              const isHe = task.language === 'he'
              const dayDisplay = candidate.key.charAt(0).toUpperCase() + candidate.key.slice(1)
              placementReasons[task.id] = isHe
                ? `יעד ב${dueDayKey} → ${dayDisplay}`
                : `Due ${dueDayKey} → placed ${dayDisplay}`
              placed = true
              break
            }
          }
          if (placed) continue
        }
      }

      // High priority: prefer peak days
      const candidateBuckets = task.priority === 'high' && peakBuckets.length > 0
        ? [...peakBuckets, ...availableBuckets]
        : availableBuckets

      let placed = false
      for (const bucket of candidateBuckets) {
        if (bucket.tasks.length < bucket.capacity) {
          placeTask(task.id, bucket.key, task.complexityScore)
          const isHe = task.language === 'he'
          const dayDisplay = bucket.key.charAt(0).toUpperCase() + bucket.key.slice(1)
          if (task.priority === 'high' && bucket.isPeakDay) {
            placementReasons[task.id] = isHe
              ? `עדיפות גבוהה → ${dayDisplay} (יום שיא)`
              : `High priority on peak day (${dayDisplay})`
          } else if (task.priority === 'high') {
            placementReasons[task.id] = isHe
              ? `עדיפות גבוהה → ${dayDisplay}`
              : `High priority → ${dayDisplay}`
          } else {
            placementReasons[task.id] = isHe
              ? `${dayDisplay}`
              : `Placed ${dayDisplay}`
          }
          placed = true
          break
        }
      }
      if (!placed) {
        unscheduled.push(task.id)
        placementReasons[task.id] = task.language === 'he' ? 'אין מקום פנוי' : 'No room available'
      }
    }
  }

  // Tier 4: Fill remaining tasks using scoring
  // Build a project-day map for batching bonus
  const projectDayMap = new Map<string, Set<DayKey>>()
  for (const bucket of buckets) {
    for (const taskId of bucket.tasks) {
      const task = enriched.find(t => t.id === taskId)
      if (task?.projectName) {
        const existing = projectDayMap.get(task.projectName) || new Set()
        existing.add(bucket.key)
        projectDayMap.set(task.projectName, existing)
      }
    }
  }

  for (const task of tier4) {
    // Score each available day
    let bestDay: DayBucket | null = null
    let bestScore = -Infinity

    for (const bucket of buckets) {
      if (bucket.capacity <= 0 || bucket.tasks.length >= bucket.capacity) continue

      let score = (bucket.capacity - bucket.tasks.length) * bucket.weight

      // Project batch bonus
      if (task.projectName) {
        const projDays = projectDayMap.get(task.projectName)
        if (projDays?.has(bucket.key)) {
          score += 4
        }
      }

      // Complexity penalty for heavy meeting days
      if (bucket.complexityCap < 10 && task.complexityScore > bucket.complexityCap) {
        score -= 5
      }

      // Peak day bonus for complex tasks
      if (bucket.isPeakDay && task.complexityScore >= 5) {
        score += 3
      }

      if (score > bestScore) {
        bestScore = score
        bestDay = bucket
      }
    }

    if (bestDay && bestScore > -Infinity) {
      placeTask(task.id, bestDay.key, task.complexityScore)
      const isHe = task.language === 'he'
      const dayDisplay = bestDay.key.charAt(0).toUpperCase() + bestDay.key.slice(1)

      // Check if batched with same project
      const projDays = task.projectName ? projectDayMap.get(task.projectName) : null
      if (projDays?.has(bestDay.key) && task.projectName) {
        placementReasons[task.id] = isHe
          ? `מקובץ עם משימות ${task.projectName} → ${dayDisplay}`
          : `Grouped with ${task.projectName} tasks → ${dayDisplay}`
      } else {
        placementReasons[task.id] = isHe ? dayDisplay : `Placed ${dayDisplay}`
      }

      // Update project-day map
      if (task.projectName) {
        const existing = projectDayMap.get(task.projectName) || new Set()
        existing.add(bestDay.key)
        projectDayMap.set(task.projectName, existing)
      }
    } else {
      unscheduled.push(task.id)
      placementReasons[task.id] = task.language === 'he' ? 'אין מקום פנוי' : 'No room available'
    }
  }

  // ── Phase 4: Build plan and reasoning ──
  const plan: WeeklyPlan = {
    monday: bucketMap.get('monday')!.tasks,
    tuesday: bucketMap.get('tuesday')!.tasks,
    wednesday: bucketMap.get('wednesday')!.tasks,
    thursday: bucketMap.get('thursday')!.tasks,
    friday: bucketMap.get('friday')!.tasks,
    saturday: bucketMap.get('saturday')!.tasks,
    sunday: bucketMap.get('sunday')!.tasks,
    unscheduled,
  }

  // Generate overall reasoning
  const totalScheduled = enriched.length - unscheduled.length
  const routineCount = tier1.length
  const urgentCount = tier2.length
  const parts: string[] = []
  if (routineCount > 0) parts.push(`${routineCount} tasks placed by routine`)
  if (urgentCount > 0) parts.push(`${urgentCount} urgent tasks spread early in week`)
  if (tier3.length > 0) parts.push(`${tier3.length} high-priority tasks on best days`)
  if (tier4.length > 0) parts.push(`${tier4.length} tasks filled by scoring`)
  if (workStyle !== 'balanced') parts.push(`${workStyle}ed per your preference`)
  const reasoning = `${totalScheduled} of ${enriched.length} tasks scheduled. ${parts.join(', ')}.`

  return { plan, reasoning, placementReasons }
}

// ============================================================================
// STEP 2: Deterministic Reason Assembly (no LLM, instant)
// Merges Step 0 facts + day-specific scheduling context
// ============================================================================

function assembleTaskReasons(
  enrichedTasks: EnrichedTask[],
  plan: WeeklyPlan,
  placementReasons?: Record<string, string>,
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

      // Prepend placement reason as the FIRST bullet
      if (placementReasons?.[taskId]) {
        bullets.unshift(placementReasons[taskId])
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
// Deterministic Routine Detection (no LLM needed — ALWAYS works)
// ============================================================================

/**
 * Detect location/routine-related tasks and generate hardcoded questions.
 * This is the RELIABLE fallback — no LLM needed.
 */
function detectRoutineQuestions(
  tasks: TaskSummary[],
  pastLearnings?: string[],
): Array<{ question: string; type: 'choice' | 'day-select'; options: string[] }> {
  const ALL_DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const questions: Array<{ question: string; type: 'choice' | 'day-select'; options: string[] }> = []

  // Location/routine keyword patterns (Hebrew + English)
  const routinePatterns: Array<{
    keywords: RegExp
    questionTemplate: string
    alreadyKnownCheck: string
  }> = [
    {
      keywords: /תיכון|בית.?ספר|school|high.?school/i,
      questionTemplate: 'I see school-related tasks — which day do you go to school?',
      alreadyKnownCheck: 'school',
    },
    {
      keywords: /אוניברסיטה|university|uni|campus|college|לימודים/i,
      questionTemplate: 'You have university-related tasks — which day are you on campus?',
      alreadyKnownCheck: 'university',
    },
    {
      keywords: /משרד|office|עבודה|work/i,
      questionTemplate: 'I see work/office tasks — which day are you in the office?',
      alreadyKnownCheck: 'office',
    },
    {
      keywords: /חדר.?כושר|gym|fitness|אימון|workout/i,
      questionTemplate: 'You have fitness tasks — which day do you usually go to the gym?',
      alreadyKnownCheck: 'gym',
    },
    {
      keywords: /סופר|קניות|grocery|shopping|errands|סידורים/i,
      questionTemplate: 'I see errands/shopping tasks — which day do you usually run errands?',
      alreadyKnownCheck: 'errand',
    },
  ]

  const allText = tasks.map(t => `${t.title} ${t.description || ''} ${t.projectName || ''}`).join(' ')

  for (const pattern of routinePatterns) {
    if (pattern.keywords.test(allText)) {
      // Check if we already know this preference
      const alreadyKnown = pastLearnings?.some(l =>
        l.toLowerCase().includes(pattern.alreadyKnownCheck)
      )
      if (!alreadyKnown) {
        questions.push({
          question: pattern.questionTemplate,
          type: 'day-select',
          options: ALL_DAY_OPTIONS,
        })
      }
    }
  }

  // If no routine questions detected, add general scheduling questions for 5+ tasks
  if (questions.length === 0 && tasks.length >= 5) {
    const today = new Date().toISOString().split('T')[0]
    const overdueCount = tasks.filter(t => {
      if (!t.dueDate) return false
      return t.dueDate < today
    }).length

    if (overdueCount >= 2) {
      questions.push({
        question: `You have ${overdueCount} overdue tasks — how should I prioritize them?`,
        type: 'choice',
        options: ['Clear them first (Mon-Tue)', 'Spread across the week', 'Mix with new tasks'],
      })
    }

    // Check for multiple projects
    const projects = new Set(tasks.map(t => t.projectName).filter(Boolean))
    if (projects.size >= 2) {
      questions.push({
        question: 'Should I group tasks by project on the same day or spread them?',
        type: 'choice',
        options: ['Group by project', 'Spread them out', 'Doesn\'t matter'],
      })
    }
  }

  console.log(`[WeeklyPlanAI] Routine detection: ${questions.length} questions from ${tasks.length} tasks`)
  return questions.slice(0, 3)
}

// ============================================================================
// Composable
// ============================================================================

export function useWeeklyPlanAI() {
  const isGenerating = ref(false) as Ref<boolean>

  /**
   * Hybrid Pipeline:
   *
   * Step 0: Deterministic enrichment (no LLM, instant)
   * Step 1: Deterministic distribution (no LLM, instant)
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

    const { weekEnd } = getWeekBounds(useSettingsStore().weekStartsOn)

    isGenerating.value = true

    try {
      // ── Step 0: Deterministic Enrichment (instant) ──
      const enriched = enrichTasksForPlanning(tasks, weekEnd)
      console.log(`[WeeklyPlanAI] Step 0: Enriched ${enriched.length} tasks (${enriched.filter(t => t.language === 'he').length} Hebrew, ${enriched.filter(t => t.urgencyCategory === 'OVERDUE').length} overdue)`)

      // ── Step 1: Deterministic Distribution (instant) ──
      const { plan, reasoning, placementReasons } =
        distributeTasksDeterministically(enriched, interview, profile, behavioral)
      console.log(`[WeeklyPlanAI] Step 1: Deterministic distribution complete (${Object.values(plan).flat().length - plan.unscheduled.length} scheduled, ${plan.unscheduled.length} unscheduled)`)

      // ── Step 2: Deterministic Reason Assembly (instant) ──
      const taskReasons = assembleTaskReasons(enriched, plan, placementReasons)
      console.log(`[WeeklyPlanAI] Step 2: Assembled reasons for ${Object.keys(taskReasons).length} tasks`)

      // ── Step 3: LLM Week Theme (optional, silent fail) ──
      const router = await getSharedRouter()
      const routerOpts = getRouterOptions()
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
    _profile?: WorkProfile | null
  ): Promise<{ dayTasks: string[]; unscheduled: string[]; reasoning: string | null }> {
    isGenerating.value = true

    try {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      const taskMap = new Map(allTasks.map(t => [t.id, t]))

      // Gather available tasks: current day's tasks + unscheduled
      const available = [...currentPlan[dayKey], ...currentPlan.unscheduled]

      // Score each task for this day
      const scored = available.map(id => {
        const task = taskMap.get(id)
        let score = 0

        // Urgency score
        if (task?.dueDate && task.dueDate < new Date().toISOString().split('T')[0]) score += 100
        else if (task?.status === 'in_progress') score += 80

        // Due date proximity
        if (task?.dueDate) {
          const daysUntilDue = Math.floor(
            (new Date(task.dueDate + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
          if (daysUntilDue <= 0) score += 50
          else if (daysUntilDue <= 3) score += 30
          else if (daysUntilDue <= 7) score += 15
        }

        // Priority score
        const pScore = task?.priority ? (3 - (priorityOrder[task.priority] ?? 3)) * 10 : 0
        score += pScore

        // Project batching bonus: if another task from the same project is already scored higher
        // (implicit through stable sort)

        return { id, score }
      })

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score)

      const maxPerDay = 6
      const dayTasks = scored.slice(0, maxPerDay).map(s => s.id)
      const unscheduled = scored.slice(maxPerDay).map(s => s.id)

      return {
        dayTasks,
        unscheduled,
        reasoning: 'Re-sorted by priority and urgency.',
      }
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * Generate 2-3 structured questions with clickable answer options.
   * Aware of past memory observations to avoid re-asking known preferences.
   *
   * RELIABILITY: ALWAYS generates deterministic routine-detection questions first.
   * LLM questions are a nice-to-have enhancement that gets merged in if available.
   */
  async function generateDynamicQuestions(
    tasks: TaskSummary[],
    personalContext?: string,
    interview?: InterviewAnswers,
    pastLearnings?: string[],
  ): Promise<Array<{ question: string; type: 'choice' | 'day-select'; options: string[] }>> {
    // ALWAYS generate deterministic routine questions first (no LLM needed)
    const fallbackQuestions = detectRoutineQuestions(tasks, pastLearnings)

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
      if (!Array.isArray(parsed)) {
        console.log('[WeeklyPlanAI] LLM returned non-array, using fallback questions')
        return fallbackQuestions
      }

      const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      const llmQuestions = parsed.slice(0, 3).map((q: Record<string, unknown>) => {
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

      // Merge: Routine day-select questions FIRST (they learn the user's schedule),
      // then fill remaining slots with LLM questions
      const routineQuestions = fallbackQuestions.filter(q => q.type === 'day-select')
      const otherFallbacks = fallbackQuestions.filter(q => q.type !== 'day-select')

      if (llmQuestions.length > 0 || routineQuestions.length > 0) {
        // Deduplicate LLM questions — remove any that overlap with routine topics
        const routineText = routineQuestions.map(q => q.question.toLowerCase()).join(' ')
        const ROUTINE_KEYWORDS = ['school', 'university', 'office', 'gym', 'errands', 'grocery',
          'תיכון', 'אוניברסיטה', 'משרד', 'כושר', 'קניות', 'סידורים']
        const filteredLLM = llmQuestions.filter(lq => {
          const lqLower = lq.question.toLowerCase()
          // Remove LLM question if it covers the same routine topic
          return !ROUTINE_KEYWORDS.some(kw => lqLower.includes(kw) && routineText.includes(kw))
        })

        const merged = [...routineQuestions, ...filteredLLM, ...otherFallbacks].slice(0, 3)
        console.log(`[WeeklyPlanAI] Questions: ${routineQuestions.length} routine + ${filteredLLM.length} LLM + ${otherFallbacks.length} other = ${merged.length} total`)
        return merged
      }

      // No questions at all — use whatever fallback we have
      console.log('[WeeklyPlanAI] No LLM or routine questions, using fallback')
      return fallbackQuestions
    } catch (err) {
      console.warn('[WeeklyPlanAI] LLM question generation failed, using routine detection:', err)
      return fallbackQuestions
    }
  }

  return {
    generatePlan,
    regenerateDay,
    generateDynamicQuestions,
    isGenerating,
  }
}
