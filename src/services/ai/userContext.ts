/**
 * Centralized AI User Context (TASK-1350)
 *
 * Builds a unified context string that ALL AI features include in their prompts.
 * Pulls from the user's work profile, memory graph, current workload, and active projects.
 *
 * Every AI call should include this context so the AI understands:
 * - User's work patterns and capacity
 * - Current workload and overload level
 * - Active projects and what they're working on
 * - Past corrections and learned preferences
 */

import { useWorkProfile } from '@/composables/useWorkProfile'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'

/**
 * Get the full AI user context string.
 * Call this from any AI composable and include it in the system prompt.
 *
 * @param feature - Which AI feature is calling (adjusts context emphasis)
 * @returns Context string to append to system prompts, or empty string if unavailable
 */
export async function getAIUserContext(
  feature: 'quicksort' | 'taskassist' | 'chat' | 'weeklyplan' = 'chat'
): Promise<string> {
  const sections: string[] = []

  // ── Work Profile (habits, capacity, memory) ──
  try {
    const { loadProfile, getProfileContext } = useWorkProfile()
    await loadProfile()
    const profileCtx = getProfileContext()
    if (profileCtx) {
      sections.push(profileCtx)
    }
  } catch {
    // Work profile unavailable — continue without it
  }

  // ── Current Workload Snapshot ──
  try {
    const workload = getCurrentWorkload()
    if (workload) {
      sections.push(workload)
    }
  } catch {
    // Task store unavailable — continue
  }

  // ── Active Projects ──
  try {
    const projects = getActiveProjectsSummary()
    if (projects) {
      sections.push(projects)
    }
  } catch {
    // Project store unavailable — continue
  }

  // ── Feature-specific framing ──
  const framing = getFeatureFraming(feature)
  if (framing) {
    sections.push(framing)
  }

  if (sections.length === 0) return ''
  return '\n\n--- USER CONTEXT ---\n' + sections.join('\n\n')
}

/**
 * Current workload snapshot — gives AI awareness of overload level
 */
function getCurrentWorkload(): string | null {
  const taskStore = useTaskStore()
  const tasks = taskStore.tasks
  const today = new Date().toISOString().split('T')[0]

  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const overdue = tasks.filter(t =>
    t.dueDate && t.dueDate.slice(0, 10) < today &&
    t.status !== 'done' && !t._soft_deleted
  ).length
  const dueToday = tasks.filter(t =>
    t.dueDate && t.dueDate.slice(0, 10) === today &&
    t.status !== 'done' && !t._soft_deleted
  ).length
  const totalOpen = tasks.filter(t => t.status !== 'done' && !t._soft_deleted).length
  const plannedUnsorted = tasks.filter(t =>
    t.status === 'planned' && !t.priority && !t._soft_deleted
  ).length

  const lines: string[] = ['Current workload:']

  if (inProgress > 0) lines.push(`- ${inProgress} tasks in progress`)
  if (dueToday > 0) lines.push(`- ${dueToday} tasks due today`)
  if (overdue > 0) lines.push(`- ${overdue} overdue tasks`)
  lines.push(`- ${totalOpen} total open tasks`)
  if (plannedUnsorted > 0) lines.push(`- ${plannedUnsorted} unsorted (no priority)`)

  // Overload indicator
  if (overdue > 5 || (inProgress > 8 && overdue > 2)) {
    lines.push('- ⚠ User appears overloaded — suggest conservative actions, fewer new commitments')
  } else if (overdue === 0 && inProgress <= 3) {
    lines.push('- User workload is light — can take on more')
  }

  return lines.length > 1 ? lines.join('\n') : null
}

/**
 * Active projects summary — gives AI awareness of project landscape
 */
function getActiveProjectsSummary(): string | null {
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()
  const projects = projectStore.projects

  if (projects.length === 0) return null

  // Count active tasks per project
  const projectActivity = projects.map(p => {
    const activeTasks = taskStore.tasks.filter(t =>
      t.projectId === p.id && t.status !== 'done' && !t._soft_deleted
    ).length
    return { name: p.name, id: p.id, activeTasks }
  }).filter(p => p.activeTasks > 0)
    .sort((a, b) => b.activeTasks - a.activeTasks)
    .slice(0, 8)

  if (projectActivity.length === 0) return null

  const lines = ['Active projects:']
  for (const p of projectActivity) {
    lines.push(`- "${p.name}" (${p.activeTasks} open tasks)`)
  }

  return lines.join('\n')
}

/**
 * Feature-specific framing — tells the AI how to USE the context
 */
function getFeatureFraming(feature: string): string | null {
  switch (feature) {
    case 'quicksort':
      return 'Use this context to make suggestions that fit the user\'s actual work patterns. If they\'re overloaded, avoid suggesting high priority. Match projects based on what they\'re actively working on.'
    case 'taskassist':
      return 'Use this context to tailor suggestions to the user\'s capacity and habits. Suggest realistic durations based on their historical pace.'
    case 'chat':
      return 'You are the user\'s AI assistant in their task management app. Use this context to give personalized, relevant advice about their actual work situation.'
    case 'weeklyplan':
      return 'Use this context to create a realistic weekly plan that matches the user\'s actual capacity and patterns.'
    default:
      return null
  }
}
