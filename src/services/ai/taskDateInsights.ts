import type { Task } from '@/types/tasks'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DATE_WINDOW_DAYS = 21

export interface DatePlanningProfile {
  workDays?: string[] | null
  daysOff?: string[] | null
  heavyMeetingDays?: string[] | null
  maxTasksPerDay?: number | null
  avgWorkMinutesPerDay?: number | null
}

export interface TaskDateEvidence {
  date: string
  confidence: number
  basis: string
}

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isFinite(date.getTime()) ? date : null
}

function tokens(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^a-z0-9א-ת]+/i).filter(token => token.length >= 3))
}

function sharedWords(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const token of left) if (right.has(token)) count++
  return count
}

function normalizeDays(days: string[] | null | undefined, fallback: string[]): Set<number> {
  const source = days?.length ? days : fallback
  return new Set(source.map(day => DAY_NAMES.indexOf(day.toLowerCase())).filter(day => day >= 0))
}

function isMatchingTask(task: Task, candidate: Task): boolean {
  const overlap = sharedWords(tokens(task.title), tokens(candidate.title))
  return overlap >= 2 || (Boolean(task.projectId) && task.projectId === candidate.projectId && overlap >= 1)
}

function findRoutineDay(task: Task, history: Task[]): { day: number; count: number } | null {
  const matches = history
    .filter(candidate => candidate.status === 'done' && candidate.completedAt && isMatchingTask(task, candidate))
    .map(candidate => parseDate(candidate.completedAt))
    .filter((date): date is Date => date !== null)

  if (matches.length < 3) return null
  const counts = new Map<number, number>()
  for (const date of matches) counts.set(date.getDay(), (counts.get(date.getDay()) || 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [day, count] = ranked[0]
  if (count / matches.length < 0.6) return null
  return { day, count }
}

function nextDateForDay(day: number, today: Date): Date {
  const date = new Date(today)
  const distance = (day - today.getDay() + 7) % 7
  date.setDate(date.getDate() + distance)
  return date
}

/** Choose a safe date from observed routines and workload constraints. */
export function getTaskDateEvidence(
  task: Task,
  history: Task[],
  profile: DatePlanningProfile | null = null,
  now = new Date(),
): TaskDateEvidence {
  const today = new Date(now)
  today.setHours(12, 0, 0, 0)
  const workDays = normalizeDays(profile?.workDays, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  const blockedDays = new Set([
    ...normalizeDays(profile?.daysOff, []),
    ...normalizeDays(profile?.heavyMeetingDays, []),
  ])
  const routine = findRoutineDay(task, history)

  if (routine && workDays.has(routine.day) && !blockedDays.has(routine.day)) {
    const date = nextDateForDay(routine.day, today)
    return {
      date: dateKey(date),
      confidence: Math.min(0.95, 0.7 + routine.count * 0.05),
      basis: `your task history places similar work on ${DAY_NAMES[routine.day]} (${routine.count} consistent completions)`,
    }
  }

  const openByDate = new Map<string, number>()
  for (const candidate of history) {
    if (candidate.status === 'done' || !candidate.dueDate) continue
    const key = candidate.dueDate.slice(0, 10)
    openByDate.set(key, (openByDate.get(key) || 0) + 1)
  }

  for (let offset = 0; offset <= DATE_WINDOW_DAYS; offset++) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    const day = date.getDay()
    if (!workDays.has(day) || blockedDays.has(day)) continue
    const key = dateKey(date)
    const openCount = openByDate.get(key) || 0
    const openMinutes = history
      .filter(candidate => candidate.status !== 'done' && candidate.dueDate?.slice(0, 10) === key)
      .reduce((sum, candidate) => sum + (candidate.estimatedDuration || 0), 0)
    const requestedMinutes = task.estimatedDuration || 30
    const maxTasks = profile?.maxTasksPerDay ?? 6
    const hasTimeCapacity = !profile?.avgWorkMinutesPerDay
      || openMinutes + requestedMinutes <= profile.avgWorkMinutesPerDay
    if (openCount < maxTasks && hasTimeCapacity) {
      const capacityNote = profile?.avgWorkMinutesPerDay
        ? `, ${openMinutes + requestedMinutes}/${Math.round(profile.avgWorkMinutesPerDay)} planned minutes`
        : ''
      return {
        date: key,
        confidence: profile?.maxTasksPerDay || profile?.avgWorkMinutesPerDay ? 0.75 : 0.55,
        basis: `earliest ${DAY_NAMES[day]} with room for work (${openCount}/${maxTasks} open tasks${capacityNote})`,
      }
    }
  }

  const fallback = new Date(today)
  for (let offset = 1; offset <= DATE_WINDOW_DAYS + 7; offset++) {
    fallback.setDate(today.getDate() + offset)
    if (workDays.has(fallback.getDay()) && !blockedDays.has(fallback.getDay())) break
  }
  return {
    date: dateKey(fallback),
    confidence: 0.3,
    basis: 'no reliable routine or capacity signal was available',
  }
}
