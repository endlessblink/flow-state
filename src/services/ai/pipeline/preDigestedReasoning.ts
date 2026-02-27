/**
 * Pre-Digested Reasoning Engine
 *
 * Computes task analysis IN CODE and sends pre-written facts
 * to the LLM, so it only needs to format them naturally — not discover them.
 *
 * Instead of: raw JSON → hope LLM reasons about it
 * Now: code computes "3 days overdue, 0/5 subtasks, high priority" → LLM writes prose
 *
 * Pattern from Cursor/Linear: minimize what the LLM invents,
 * maximize what deterministic code computes.
 *
 * @see TASK-1388 in MASTER_PLAN.md
 */

// ---------------------------------------------------------------------------
// Language helper
// ---------------------------------------------------------------------------

type Lang = 'he' | 'en'

const STRINGS: Record<string, Record<Lang, string>> = {
  // digestTaskList
  preAnalyzedFacts:   { en: 'PRE-ANALYZED FACTS (computed by system — treat as ground truth):', he: 'עובדות מנותחות מראש (חושבו אוטומטית — התייחס כאמת):' },
  overdue:            { en: 'OVERDUE',            he: 'באיחור' },
  highPriority:       { en: 'HIGH PRIORITY',      he: 'עדיפות גבוהה' },
  inProgress:         { en: 'IN PROGRESS',        he: 'בביצוע' },
  progress:           { en: 'PROGRESS',           he: 'התקדמות' },
  estimatedEffort:    { en: 'ESTIMATED EFFORT',   he: 'הערכת מאמץ' },
  spreadAcrossProj:   { en: 'SPREAD ACROSS PROJECTS', he: 'מפוזר בין פרויקטים' },
  recommendation:     { en: 'RECOMMENDATION (computed):', he: 'המלצה (חושבה אוטומטית):' },
  startWith:          { en: 'Start with:',        he: 'התחל עם:' },
  continueWith:       { en: 'Continue:',          he: 'המשך:' },
  // inline task metadata
  daysLate:           { en: 'd late',             he: 'ימים באיחור' },
  priorityLabel:      { en: 'priority',           he: 'עדיפות' },
  projectLabel:       { en: 'project',            he: 'פרויקט' },
  dueLabel:           { en: 'due',                he: 'תאריך יעד' },
  pomodorosLabel:     { en: 'pomodoros done',     he: 'פומודורו הושלמו' },
  subtasksLabel:      { en: 'subtasks',           he: 'תת-משימות' },
  subtasksComplete:   { en: 'complete',           he: 'הושלמו' },
  minutesTotal:       { en: 'minutes total across', he: 'דקות סה"כ עבור' },
  tasks:              { en: 'tasks',              he: 'משימות' },
  highPriorityNote:   { en: 'highest priority',  he: 'עדיפות גבוהה ביותר' },
  alreadyInProgress:  { en: 'already in progress', he: 'כבר בביצוע' },
  highPriorityShort:  { en: 'high priority',     he: 'עדיפות גבוהה' },
  daysOverdueNote:    { en: 'days overdue',       he: 'ימים באיחור' },
  // digestProductivityStats
  preAnalyzedFactsShort: { en: 'PRE-ANALYZED FACTS:', he: 'עובדות מנותחות:' },
  completedToday:     { en: 'Completed today:',  he: 'הושלמו היום:' },
  pomodorosToday:     { en: 'Pomodoros today:',  he: 'פומודורו היום:' },
  currentStreak:      { en: 'Current streak:',   he: 'רצף נוכחי:' },
  taskBreakdown:      { en: 'Task breakdown:',   he: 'פירוט משימות:' },
  // digestWeeklySummary
  completedThisWeek:  { en: 'Completed this week:', he: 'הושלמו השבוע:' },
  focusTime:          { en: 'Focus time:',        he: 'זמן מיקוד:' },
  // digestTimerStatus
  timerRunning:       { en: 'Timer: RUNNING',    he: 'טיימר: פעיל' },
  timerNotRunning:    { en: 'Timer: NOT RUNNING', he: 'טיימר: לא פעיל' },
  timeRemaining:      { en: 'Time remaining:',   he: 'זמן שנותר:' },
  pomodorosCompletedToday: { en: 'Pomodoros completed today:', he: 'פומודורו שהושלמו היום:' },
}

function t(lang: Lang, key: string): string {
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.['en'] ?? key
}

interface ToolResultData {
  // Task list fields (from list_tasks, search_tasks, get_overdue_tasks)
  id?: string
  title?: string
  status?: string
  priority?: string | null
  dueDate?: string | null
  daysOverdue?: number
  estimatedMinutes?: number
  project?: string
  subtasks?: string  // "2/5" format
  pomodorosCompleted?: number
  hasDescription?: boolean
  tags?: string[]
  // Suggestion fields (from suggest_next_task)
  score?: number
  reason?: string
  // Stats fields (from get_productivity_stats)
  todayCompleted?: number
  todayPomodoros?: number
  currentStreak?: number
  // Weekly fields (from get_weekly_summary)
  completedThisWeek?: number
  totalFocusMinutes?: number
}

/**
 * Transform raw tool result data into pre-digested reasoning text.
 * The LLM receives this instead of raw JSON.
 *
 * @param language - Target language for section headers and labels ('he' | 'en'). Defaults to 'en'.
 */
export function digestToolResults(
  toolName: string,
  data: unknown,
  message: string,
  language: Lang = 'en'
): string {
  if (!data) return message

  // Dispatch to specific digesters based on tool type
  if (Array.isArray(data)) {
    if (data.length === 0) return message

    // Task list tools (list_tasks, search_tasks, get_overdue_tasks, suggest_next_task)
    if (data[0]?.title !== undefined) {
      return digestTaskList(toolName, data as ToolResultData[], message, language)
    }
  }

  // Object-shaped results (stats, summary, timer, plan)
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>

    // Productivity stats
    if ('completedToday' in d || 'byStatus' in d) {
      return digestProductivityStats(d, message, language)
    }

    // Weekly summary
    if ('completedThisWeek' in d || 'totalFocusMinutes' in d) {
      return digestWeeklySummary(d, message, language)
    }

    // Timer status
    if ('isActive' in d || 'currentTaskName' in d) {
      return digestTimerStatus(d, message, language)
    }

    // Weekly plan
    if ('plan' in d && 'reasoning' in d) {
      return digestWeeklyPlan(d, message, language)
    }
  }

  // Fallback: cap JSON at 1500 chars (down from 2000)
  const jsonStr = JSON.stringify(data)
  return `${message}\nData: ${jsonStr.slice(0, 1500)}`
}

/**
 * Digest a task list into pre-analyzed reasoning text.
 */
function digestTaskList(
  toolName: string,
  tasks: ToolResultData[],
  message: string,
  lang: Lang = 'en'
): string {
  const today = new Date().toISOString().split('T')[0]
  const lines: string[] = [message, '']

  // Compute analysis
  const overdue = tasks.filter(task => task.daysOverdue && task.daysOverdue > 0)
  const highPri = tasks.filter(task => task.priority === 'high' || task.priority === 'critical')
  const withProgress = tasks.filter(task => task.subtasks)
  const inProgress = tasks.filter(task => task.status === 'todo')

  // Pre-digested facts section
  lines.push(t(lang, 'preAnalyzedFacts'))

  if (overdue.length > 0) {
    lines.push(`- ${t(lang, 'overdue')} (${overdue.length}): ${overdue.map(task =>
      `"${task.title}" (${task.daysOverdue}${t(lang, 'daysLate')}${task.priority ? ', ' + task.priority + ' ' + t(lang, 'priorityLabel') : ''}${task.project ? ', ' + t(lang, 'projectLabel') + ': ' + task.project : ''})`
    ).join('; ')}`)
  }

  if (highPri.length > 0 && highPri.some(task => !task.daysOverdue)) {
    const nonOverdueHighPri = highPri.filter(task => !task.daysOverdue)
    if (nonOverdueHighPri.length > 0) {
      lines.push(`- ${t(lang, 'highPriority')} (${nonOverdueHighPri.length}): ${nonOverdueHighPri.map(task =>
        `"${task.title}"${task.project ? ' (' + task.project + ')' : ''}${task.dueDate ? ' ' + t(lang, 'dueLabel') + ':' + task.dueDate.slice(0, 10) : ''}`
      ).join('; ')}`)
    }
  }

  if (inProgress.length > 0) {
    lines.push(`- ${t(lang, 'inProgress')} (${inProgress.length}): ${inProgress.map(task =>
      `"${task.title}"${task.pomodorosCompleted ? ' (' + task.pomodorosCompleted + ' ' + t(lang, 'pomodorosLabel') + ')' : ''}${task.subtasks ? ' [' + t(lang, 'subtasksLabel') + ': ' + task.subtasks + ']' : ''}`
    ).join('; ')}`)
  }

  if (withProgress.length > 0) {
    const progDetails = withProgress.map(task => {
      const [done, total] = (task.subtasks || '0/0').split('/')
      const pct = total !== '0' ? Math.round((parseInt(done) / parseInt(total)) * 100) : 0
      return `"${task.title}": ${task.subtasks} ${t(lang, 'subtasksLabel')} (${pct}% ${t(lang, 'subtasksComplete')})`
    })
    lines.push(`- ${t(lang, 'progress')}: ${progDetails.join('; ')}`)
  }

  // Time estimates
  const withEstimates = tasks.filter(task => task.estimatedMinutes)
  if (withEstimates.length > 0) {
    const totalMinutes = withEstimates.reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0)
    lines.push(`- ${t(lang, 'estimatedEffort')}: ${totalMinutes} ${t(lang, 'minutesTotal')} ${withEstimates.length} ${t(lang, 'tasks')}`)
  }

  // Project grouping
  const projects = new Map<string, number>()
  for (const task of tasks) {
    if (task.project) projects.set(task.project, (projects.get(task.project) || 0) + 1)
  }
  if (projects.size > 1) {
    const projList = Array.from(projects.entries()).map(([name, count]) => `${name}(${count})`).join(', ')
    lines.push(`- ${t(lang, 'spreadAcrossProj')}: ${projList}`)
  }

  // Recommendation computed by code
  lines.push('')
  lines.push(t(lang, 'recommendation'))
  if (overdue.length > 0) {
    const worst = overdue.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0))[0]
    lines.push(`- ${t(lang, 'startWith')} "${worst.title}" — ${worst.daysOverdue} ${t(lang, 'daysOverdueNote')}${worst.priority === 'high' || worst.priority === 'critical' ? ', ' + t(lang, 'highPriorityShort') : ''}`)
  } else if (highPri.length > 0) {
    lines.push(`- ${t(lang, 'startWith')} "${highPri[0].title}" — ${t(lang, 'highPriorityNote')}${highPri[0].dueDate ? ', ' + t(lang, 'dueLabel') + ' ' + formatRelativeDate(highPri[0].dueDate, today) : ''}`)
  } else if (inProgress.length > 0) {
    lines.push(`- ${t(lang, 'continueWith')} "${inProgress[0].title}" — ${t(lang, 'alreadyInProgress')}`)
  } else if (tasks.length > 0) {
    lines.push(`- ${t(lang, 'startWith')} "${tasks[0].title}"${tasks[0].dueDate ? ' — ' + t(lang, 'dueLabel') + ' ' + formatRelativeDate(tasks[0].dueDate, today) : ''}`)
  }

  return lines.join('\n')
}

/**
 * Digest productivity stats.
 */
function digestProductivityStats(data: Record<string, unknown>, message: string, lang: Lang = 'en'): string {
  const lines: string[] = [message, '', t(lang, 'preAnalyzedFactsShort')]

  if (data.completedToday !== undefined) lines.push(`- ${t(lang, 'completedToday')} ${data.completedToday} ${t(lang, 'tasks')}`)
  if (data.pomodorosToday !== undefined) lines.push(`- ${t(lang, 'pomodorosToday')} ${data.pomodorosToday}`)
  if (data.currentStreak !== undefined && (data.currentStreak as number) > 0) {
    lines.push(`- ${t(lang, 'currentStreak')} ${data.currentStreak} ${lang === 'he' ? 'ימים' : 'days'}`)
  }

  const breakdown = data.byStatus as Record<string, number> | undefined
  if (breakdown) {
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
    const done = breakdown.done || 0
    const inProg = breakdown.in_progress || 0
    if (lang === 'he') {
      lines.push(`- ${t(lang, 'taskBreakdown')} ${total} סה"כ — ${done} הושלמו, ${inProg} בביצוע, ${total - done - inProg} נותרו`)
    } else {
      lines.push(`- ${t(lang, 'taskBreakdown')} ${total} total — ${done} done, ${inProg} in progress, ${total - done - inProg} remaining`)
    }
  }

  return lines.join('\n')
}

/**
 * Digest weekly summary.
 */
function digestWeeklySummary(data: Record<string, unknown>, message: string, lang: Lang = 'en'): string {
  const lines: string[] = [message, '', t(lang, 'preAnalyzedFactsShort')]

  if (data.completedThisWeek !== undefined) lines.push(`- ${t(lang, 'completedThisWeek')} ${data.completedThisWeek} ${t(lang, 'tasks')}`)
  if (data.totalFocusMinutes !== undefined) {
    const hours = Math.floor((data.totalFocusMinutes as number) / 60)
    const mins = (data.totalFocusMinutes as number) % 60
    lines.push(`- ${t(lang, 'focusTime')} ${hours}h ${mins}m`)
  }

  return lines.join('\n')
}

/**
 * Digest timer status.
 */
function digestTimerStatus(data: Record<string, unknown>, message: string, lang: Lang = 'en'): string {
  const lines: string[] = [message, '', t(lang, 'preAnalyzedFactsShort')]

  if (data.isActive) {
    lines.push(`- ${t(lang, 'timerRunning')} on "${data.currentTaskName || 'unknown'}"`)
    if (data.remainingSeconds !== undefined) {
      const mins = Math.ceil((data.remainingSeconds as number) / 60)
      lines.push(`- ${t(lang, 'timeRemaining')} ${mins} ${lang === 'he' ? 'דקות' : 'minutes'}`)
    }
    if (data.sessionsCompleted !== undefined) {
      lines.push(`- ${t(lang, 'pomodorosCompletedToday')} ${data.sessionsCompleted}`)
    }
  } else {
    lines.push(`- ${t(lang, 'timerNotRunning')}`)
    if (data.sessionsCompleted !== undefined) {
      lines.push(`- ${t(lang, 'pomodorosCompletedToday')} ${data.sessionsCompleted}`)
    }
  }

  return lines.join('\n')
}

/**
 * Digest a weekly plan result into pre-analyzed reasoning.
 * Extracts scheduling facts so the LLM can explain WHY tasks go where.
 */
function digestWeeklyPlan(
  data: Record<string, unknown>,
  message: string,
  lang: Lang = 'en'
): string {
  const lines: string[] = [message, '']

  const plan = data.plan as Record<string, unknown> | undefined
  const reasoning = data.reasoning as string | undefined
  const totalScheduled = data.totalScheduled as number | undefined
  const daysUsed = data.daysUsed as number | undefined
  const unscheduled = data.unscheduled as Array<{ title?: string }> | undefined

  if (totalScheduled !== undefined && daysUsed !== undefined) {
    lines.push(lang === 'he'
      ? `סה"כ: ${totalScheduled} משימות מתוזמנות ב-${daysUsed} ימים`
      : `Total: ${totalScheduled} tasks scheduled across ${daysUsed} days`)
  }

  if (plan && typeof plan === 'object') {
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const dayNamesHe: Record<string, string> = {
      monday: 'שני', tuesday: 'שלישי', wednesday: 'רביעי', thursday: 'חמישי',
      friday: 'שישי', saturday: 'שבת', sunday: 'ראשון'
    }
    for (const day of dayKeys) {
      const dayTasks = plan[day] as Array<{ title?: string; priority?: string }> | undefined
      if (dayTasks && Array.isArray(dayTasks) && dayTasks.length > 0) {
        const dayName = lang === 'he' ? dayNamesHe[day] : day.charAt(0).toUpperCase() + day.slice(1)
        const titles = dayTasks.map(t => t.title || '?').join(', ')
        lines.push(`${dayName}: ${dayTasks.length} — ${titles}`)
      }
    }
  }

  if (unscheduled && Array.isArray(unscheduled) && unscheduled.length > 0) {
    lines.push(lang === 'he'
      ? `לא מתוזמן: ${unscheduled.length} משימות`
      : `Unscheduled: ${unscheduled.length} tasks`)
  }

  if (reasoning && typeof reasoning === 'string') {
    lines.push('')
    lines.push(lang === 'he' ? `לוגיקת התזמון: ${reasoning}` : `Scheduling logic: ${reasoning}`)
  }

  return lines.join('\n')
}

/**
 * Format a date relative to today.
 */
function formatRelativeDate(dateStr: string, today: string): string {
  const date = dateStr.slice(0, 10)
  if (date === today) return 'today'

  const todayDate = new Date(today + 'T00:00:00')
  const targetDate = new Date(date + 'T00:00:00')
  const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / 86400000)

  if (diffDays === 1) return 'tomorrow'
  if (diffDays === -1) return 'yesterday'
  if (diffDays > 1 && diffDays <= 7) return `in ${diffDays} days`
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  return date
}
