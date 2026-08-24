import type { Task } from '@/types/tasks'
import type { MemoryObservation } from '@/utils/supabaseMappers'

type Insight = Omit<MemoryObservation, 'createdAt'>

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const LOOKBACK_DAYS = 56

function dateKey(value: Date | string | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
}

function normalizeLabel(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function recent(date: string, since: string, until: string): boolean {
  return date >= since && date <= until
}

function addWeekdayObservation(
  observations: Insight[],
  entity: string,
  relation: 'routine_weekday' | 'completion_weekday',
  dates: string[],
  source: string
): void {
  if (dates.length < 3) return
  const counts = new Map<string, number>()
  for (const date of dates) counts.set(weekday(date), (counts.get(weekday(date)) || 0) + 1)
  const [day, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const share = count / dates.length
  if (count < 3 || share < 0.6) return

  observations.push({
    entity,
    relation,
    value: `usually ${day} (${count}/${dates.length} recent occurrences)`,
    confidence: Math.min(0.95, 0.55 + dates.length * 0.05),
    source
  })
}

/** Build behavioral signals from task history without assuming specific routines. */
export function buildTaskBehaviorInsights(tasks: Task[], now = new Date()): Insight[] {
  const sinceDate = new Date(now)
  sinceDate.setDate(sinceDate.getDate() - LOOKBACK_DAYS)
  const since = sinceDate.toISOString().slice(0, 10)
  const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const observations: Insight[] = []
  const taskDates = new Map<string, { scheduled: string[]; completed: string[] }>()

  for (const task of tasks) {
    if (task._soft_deleted) continue
    const label = normalizeLabel(task.title)
    if (label.length < 3) continue
    const scheduled = new Set<string>()
    for (const instance of task.instances || []) {
      const value = dateKey(instance.scheduledDate)
      if (value) scheduled.add(value)
    }
    for (const instance of task.recurringInstances || []) {
      if (instance.isSkipped) continue
      const value = dateKey(instance.scheduledDate)
      if (value) scheduled.add(value)
    }
    if (scheduled.size === 0) {
      for (const value of [task.scheduledDate, task.dueDate]) {
        const key = dateKey(value)
        if (key) scheduled.add(key)
      }
    }

    const completed = task.status === 'done' ? dateKey(task.completedAt) : null
    const scheduledRecent = [...scheduled].filter(value => recent(value, since, until))
    const completedRecent = completed && recent(completed, since, until) ? [completed] : []
    if (scheduledRecent.length || completedRecent.length) {
      const bucket = taskDates.get(label) || { scheduled: [], completed: [] }
      bucket.scheduled.push(...scheduledRecent)
      bucket.completed.push(...completedRecent)
      taskDates.set(label, bucket)
    }
  }

  for (const [label, dates] of taskDates) {
    const entity = `routine:${label}`
    addWeekdayObservation(observations, entity, 'routine_weekday', dates.scheduled, 'task_history')
    if (dates.scheduled.length === 0) {
      addWeekdayObservation(observations, entity, 'completion_weekday', dates.completed, 'task_history')
    }
  }

  const deadlineTasks = tasks.filter(task => {
    const due = dateKey(task.dueDate)
    const completed = task.status === 'done' ? dateKey(task.completedAt) : null
    return due !== null && completed !== null && recent(due, since, until) && recent(completed, since, until)
  })
  if (deadlineTasks.length >= 3) {
    const onTime = deadlineTasks.filter(task => {
      const due = dateKey(task.dueDate)
      const completed = dateKey(task.completedAt)
      return due !== null && completed !== null && completed <= due
    }).length
    observations.push({
      entity: 'user',
      relation: 'deadline_reliability',
      value: `${Math.round((onTime / deadlineTasks.length) * 100)}% completed by the due date (${onTime}/${deadlineTasks.length})`,
      confidence: Math.min(0.9, 0.5 + deadlineTasks.length * 0.05),
      source: 'task_history'
    })
  }

  const planningLeadTimes = tasks.flatMap(task => {
    const created = dateKey(task.createdAt)
    const due = dateKey(task.dueDate)
    if (!created || !due || !recent(due, since, until)) return []
    const days = Math.round((new Date(`${due}T12:00:00Z`).getTime() - new Date(`${created}T12:00:00Z`).getTime()) / 86400000)
    return days >= 0 ? [days] : []
  })
  if (planningLeadTimes.length >= 3) {
    const typicalDays = median(planningLeadTimes)
    observations.push({
      entity: 'user',
      relation: 'planning_horizon',
      value: `typically sets due dates about ${typicalDays} day${typicalDays === 1 ? '' : 's'} after creation (${planningLeadTimes.length} tasks measured)`,
      confidence: Math.min(0.9, 0.5 + planningLeadTimes.length * 0.04),
      source: 'task_history'
    })
  }

  return observations
}
