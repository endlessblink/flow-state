/**
 * Context Optimizer for AI Chat Pipeline
 *
 * Transforms raw task data into an optimized context string for the LLM system prompt.
 * Key improvements over the inline approach in buildSystemPrompt:
 *
 * 1. Structural separation — task titles are quoted and isolated from English metadata labels.
 *    This dramatically reduces language contamination (Hebrew titles causing Hebrew responses).
 *
 * 2. Character budget — caps total context size to prevent overwhelming the LLM.
 *
 * 3. Date-relative filtering — today's tasks and overdue items are prominent;
 *    backlog/low-priority tasks are pushed to the end or omitted.
 *
 * 4. Section-based grouping — tasks grouped by urgency tier for better LLM reasoning.
 *
 * @see TASK-1377 in MASTER_PLAN.md
 */

/** Default character budget for task context in system prompt */
const DEFAULT_CHAR_BUDGET = 3000

/** Minimal task shape needed by the optimizer (avoid coupling to full Task type) */
export interface OptimizableTask {
  id: string
  title: string
  priority?: string | null
  dueDate?: string | null
  status?: string | null
  projectId?: string | null
  _soft_deleted?: boolean
}

/** Project name lookup */
export interface ProjectLookup {
  id: string
  name: string
}

interface OptimizeOptions {
  /** Max character budget for the context string (default: 3000) */
  charBudget?: number
  /** Today's date in YYYY-MM-DD format (injectable for testing) */
  today?: string
}

/**
 * Build an optimized task context string for the AI system prompt.
 *
 * Groups tasks into tiers:
 * - Tier 1: OVERDUE (past due date, not done)
 * - Tier 2: TODAY (due today)
 * - Tier 3: THIS WEEK (due within 7 days)
 * - Tier 4: IN PROGRESS (regardless of due date)
 * - Tier 5: OTHER (remaining, sorted by priority)
 *
 * Each task is formatted with structural English metadata labels
 * and the title quoted — keeping the title visually distinct from metadata:
 *
 * ```
 * - Title: "לתקן באג" | Priority: high | Status: in_progress | Due: TODAY | Project: Auth
 * ```
 */
export function optimizeTaskContext(
  tasks: OptimizableTask[],
  projects: ProjectLookup[],
  options: OptimizeOptions = {}
): string {
  const charBudget = options.charBudget ?? DEFAULT_CHAR_BUDGET
  const today = options.today ?? new Date().toISOString().split('T')[0]

  // Filter: only open, non-deleted tasks
  const openTasks = tasks.filter(t => t.status !== 'done' && !t._soft_deleted)
  if (openTasks.length === 0) return ''

  // Build project lookup map
  const projectMap = new Map(projects.map(p => [p.id, p.name]))

  // Compute week-end boundary (7 days from today)
  const todayDate = new Date(today + 'T00:00:00')
  const weekEnd = new Date(todayDate)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Classify into tiers, tracking placed IDs to avoid duplicates
  const overdue: OptimizableTask[] = []
  const dueToday: OptimizableTask[] = []
  const thisWeek: OptimizableTask[] = []
  const inProgress: OptimizableTask[] = []
  const other: OptimizableTask[] = []
  const placed = new Set<string>()

  // Pass 1: Overdue (past due, not done)
  for (const t of openTasks) {
    if (t.dueDate && t.dueDate < today) {
      overdue.push(t)
      placed.add(t.id)
    }
  }

  // Pass 2: Due today
  for (const t of openTasks) {
    if (!placed.has(t.id) && t.dueDate && t.dueDate.startsWith(today)) {
      dueToday.push(t)
      placed.add(t.id)
    }
  }

  // Pass 3: This week (due after today, within 7 days)
  for (const t of openTasks) {
    if (!placed.has(t.id) && t.dueDate && t.dueDate > today && t.dueDate <= weekEndStr) {
      thisWeek.push(t)
      placed.add(t.id)
    }
  }

  // Pass 4: In progress (not already placed by date tier)
  for (const t of openTasks) {
    if (!placed.has(t.id) && t.status === 'in_progress') {
      inProgress.push(t)
      placed.add(t.id)
    }
  }

  // Pass 5: Everything else, sorted by priority descending
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  for (const t of openTasks) {
    if (!placed.has(t.id)) {
      other.push(t)
    }
  }
  other.sort((a, b) => {
    const aPri = priorityOrder[a.priority || ''] ?? 4
    const bPri = priorityOrder[b.priority || ''] ?? 4
    return aPri - bPri
  })

  // Format a single task using structural English labels with title quoted.
  // The quoting visually separates the (potentially non-English) title from the
  // English metadata tokens, preventing the LLM from treating the title text as
  // part of the metadata language.
  function formatTask(t: OptimizableTask): string {
    const parts: string[] = [`Title: "${t.title}"`]
    if (t.priority) parts.push(`Priority: ${t.priority}`)
    if (t.status && t.status !== 'planned') parts.push(`Status: ${t.status}`)
    if (t.dueDate) {
      const dueStr = t.dueDate.slice(0, 10)
      if (dueStr === today) {
        parts.push('Due: TODAY')
      } else if (dueStr < today) {
        parts.push(`Due: ${dueStr} (OVERDUE)`)
      } else {
        parts.push(`Due: ${dueStr}`)
      }
    }
    if (t.projectId) {
      const projName = projectMap.get(t.projectId)
      if (projName) parts.push(`Project: ${projName}`)
    }
    return `- ${parts.join(' | ')}`
  }

  // Build output sections respecting the character budget.
  // The header note is critical — it tells the LLM that titles may be in a
  // different language and it should still respond in the user's language.
  const sectionHeader =
    '## YOUR TASK DATA (use this to think and reason — titles may be in a DIFFERENT language than the user — ALWAYS reply in the user\'s language):'

  const sections: string[] = [sectionHeader]
  let charCount = sectionHeader.length

  // Track remaining unplaced tasks for the truncation message
  let totalPlaced = 0

  function addSection(label: string, items: OptimizableTask[]): boolean {
    if (items.length === 0) return true // nothing to add, continue

    const header = `\n### ${label} (${items.length}):`
    const lines = items.map(formatTask)
    const sectionText = header + '\n' + lines.join('\n')

    if (charCount + sectionText.length > charBudget && sections.length > 1) {
      // Budget exceeded — compute how many tasks we haven't shown
      const shownSoFar = totalPlaced
      const totalOpen = openTasks.length
      const remaining = totalOpen - shownSoFar
      if (remaining > 0) {
        sections.push(`\n(${remaining} more open tasks omitted due to space — ask to see more)`)
      }
      return false // stop adding sections
    }

    sections.push(sectionText)
    charCount += sectionText.length
    totalPlaced += items.length
    return true // continue
  }

  // Emit sections in urgency order (most critical first)
  if (!addSection('OVERDUE', overdue)) return sections.join('\n')
  if (!addSection('DUE TODAY', dueToday)) return sections.join('\n')
  if (!addSection('THIS WEEK', thisWeek)) return sections.join('\n')
  if (!addSection('IN PROGRESS', inProgress)) return sections.join('\n')
  if (!addSection('OTHER OPEN TASKS', other)) return sections.join('\n')

  return sections.join('\n')
}

/**
 * Build the task statistics line (unchanged from current buildSystemPrompt behavior).
 * Extracted here for reuse in the pre-processing step of the pipeline.
 */
export function buildTaskStats(tasks: OptimizableTask[], today?: string): string {
  const todayStr = today ?? new Date().toISOString().split('T')[0]

  const byStatus: Record<string, number> = {
    planned: 0,
    in_progress: 0,
    done: 0,
    backlog: 0,
    on_hold: 0,
  }
  let overdueCount = 0

  for (const t of tasks) {
    if (t.status && t.status in byStatus) {
      byStatus[t.status]++
    }
    if (t.dueDate && t.dueDate < todayStr && t.status !== 'done') {
      overdueCount++
    }
  }

  return `Tasks: ${tasks.length} total, ${byStatus.planned} planned, ${byStatus.in_progress} in progress, ${byStatus.done} done, ${overdueCount} overdue`
}
