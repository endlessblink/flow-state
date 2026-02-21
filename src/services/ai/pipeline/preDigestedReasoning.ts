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
 */
export function digestToolResults(
  toolName: string,
  data: unknown,
  message: string
): string {
  if (!data) return message

  // Dispatch to specific digesters based on tool type
  if (Array.isArray(data)) {
    if (data.length === 0) return message

    // Task list tools (list_tasks, search_tasks, get_overdue_tasks, suggest_next_task)
    if (data[0]?.title !== undefined) {
      return digestTaskList(toolName, data as ToolResultData[], message)
    }
  }

  // Object-shaped results (stats, summary, timer, plan)
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>

    // Productivity stats
    if ('todayCompleted' in d || 'statusBreakdown' in d) {
      return digestProductivityStats(d, message)
    }

    // Weekly summary
    if ('completedThisWeek' in d || 'totalFocusMinutes' in d) {
      return digestWeeklySummary(d, message)
    }

    // Timer status
    if ('isRunning' in d || 'currentTask' in d) {
      return digestTimerStatus(d, message)
    }

    // Weekly plan
    if ('plan' in d && 'reasoning' in d) {
      return message // Plan has its own rendering, don't re-digest
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
  message: string
): string {
  const today = new Date().toISOString().split('T')[0]
  const lines: string[] = [message, '']

  // Compute analysis
  const overdue = tasks.filter(t => t.daysOverdue && t.daysOverdue > 0)
  const highPri = tasks.filter(t => t.priority === 'high' || t.priority === 'critical')
  const withProgress = tasks.filter(t => t.subtasks)
  const inProgress = tasks.filter(t => t.status === 'in_progress')

  // Pre-digested facts section
  lines.push('PRE-ANALYZED FACTS (computed by system — treat as ground truth):')

  if (overdue.length > 0) {
    lines.push(`- OVERDUE (${overdue.length}): ${overdue.map(t =>
      `"${t.title}" (${t.daysOverdue}d late${t.priority ? ', ' + t.priority + ' priority' : ''}${t.project ? ', project: ' + t.project : ''})`
    ).join('; ')}`)
  }

  if (highPri.length > 0 && highPri.some(t => !t.daysOverdue)) {
    const nonOverdueHighPri = highPri.filter(t => !t.daysOverdue)
    if (nonOverdueHighPri.length > 0) {
      lines.push(`- HIGH PRIORITY (${nonOverdueHighPri.length}): ${nonOverdueHighPri.map(t =>
        `"${t.title}"${t.project ? ' (' + t.project + ')' : ''}${t.dueDate ? ' due:' + t.dueDate.slice(0, 10) : ''}`
      ).join('; ')}`)
    }
  }

  if (inProgress.length > 0) {
    lines.push(`- IN PROGRESS (${inProgress.length}): ${inProgress.map(t =>
      `"${t.title}"${t.pomodorosCompleted ? ' (' + t.pomodorosCompleted + ' pomodoros done)' : ''}${t.subtasks ? ' [subtasks: ' + t.subtasks + ']' : ''}`
    ).join('; ')}`)
  }

  if (withProgress.length > 0) {
    const progDetails = withProgress.map(t => {
      const [done, total] = (t.subtasks || '0/0').split('/')
      const pct = total !== '0' ? Math.round((parseInt(done) / parseInt(total)) * 100) : 0
      return `"${t.title}": ${t.subtasks} subtasks (${pct}% complete)`
    })
    lines.push(`- PROGRESS: ${progDetails.join('; ')}`)
  }

  // Time estimates
  const withEstimates = tasks.filter(t => t.estimatedMinutes)
  if (withEstimates.length > 0) {
    const totalMinutes = withEstimates.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0)
    lines.push(`- ESTIMATED EFFORT: ${totalMinutes} minutes total across ${withEstimates.length} tasks`)
  }

  // Project grouping
  const projects = new Map<string, number>()
  for (const t of tasks) {
    if (t.project) projects.set(t.project, (projects.get(t.project) || 0) + 1)
  }
  if (projects.size > 1) {
    const projList = Array.from(projects.entries()).map(([name, count]) => `${name}(${count})`).join(', ')
    lines.push(`- SPREAD ACROSS PROJECTS: ${projList}`)
  }

  // Recommendation computed by code
  lines.push('')
  lines.push('RECOMMENDATION (computed):')
  if (overdue.length > 0) {
    const worst = overdue.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0))[0]
    lines.push(`- Start with: "${worst.title}" — ${worst.daysOverdue} days overdue${worst.priority === 'high' || worst.priority === 'critical' ? ', high priority' : ''}`)
  } else if (highPri.length > 0) {
    lines.push(`- Start with: "${highPri[0].title}" — highest priority${highPri[0].dueDate ? ', due ' + formatRelativeDate(highPri[0].dueDate, today) : ''}`)
  } else if (inProgress.length > 0) {
    lines.push(`- Continue: "${inProgress[0].title}" — already in progress`)
  } else if (tasks.length > 0) {
    lines.push(`- Start with: "${tasks[0].title}"${tasks[0].dueDate ? ' — due ' + formatRelativeDate(tasks[0].dueDate, today) : ''}`)
  }

  return lines.join('\n')
}

/**
 * Digest productivity stats.
 */
function digestProductivityStats(data: Record<string, unknown>, message: string): string {
  const lines: string[] = [message, '', 'PRE-ANALYZED FACTS:']

  if (data.todayCompleted !== undefined) lines.push(`- Completed today: ${data.todayCompleted} tasks`)
  if (data.todayPomodoros !== undefined) lines.push(`- Pomodoros today: ${data.todayPomodoros}`)
  if (data.currentStreak !== undefined && (data.currentStreak as number) > 0) {
    lines.push(`- Current streak: ${data.currentStreak} days`)
  }

  const breakdown = data.statusBreakdown as Record<string, number> | undefined
  if (breakdown) {
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
    const done = breakdown.done || 0
    const inProg = breakdown.in_progress || 0
    lines.push(`- Task breakdown: ${total} total — ${done} done, ${inProg} in progress, ${total - done - inProg} remaining`)
  }

  return lines.join('\n')
}

/**
 * Digest weekly summary.
 */
function digestWeeklySummary(data: Record<string, unknown>, message: string): string {
  const lines: string[] = [message, '', 'PRE-ANALYZED FACTS:']

  if (data.completedThisWeek !== undefined) lines.push(`- Completed this week: ${data.completedThisWeek} tasks`)
  if (data.totalFocusMinutes !== undefined) {
    const hours = Math.floor((data.totalFocusMinutes as number) / 60)
    const mins = (data.totalFocusMinutes as number) % 60
    lines.push(`- Focus time: ${hours}h ${mins}m`)
  }

  return lines.join('\n')
}

/**
 * Digest timer status.
 */
function digestTimerStatus(data: Record<string, unknown>, message: string): string {
  const lines: string[] = [message, '', 'PRE-ANALYZED FACTS:']

  if (data.isRunning) {
    lines.push(`- Timer: RUNNING on "${data.currentTask || 'unknown'}"`)
    if (data.remainingSeconds !== undefined) {
      const mins = Math.ceil((data.remainingSeconds as number) / 60)
      lines.push(`- Time remaining: ${mins} minutes`)
    }
    if (data.completedToday !== undefined) {
      lines.push(`- Pomodoros completed today: ${data.completedToday}`)
    }
  } else {
    lines.push('- Timer: NOT RUNNING')
    if (data.completedToday !== undefined) {
      lines.push(`- Pomodoros completed today: ${data.completedToday}`)
    }
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
