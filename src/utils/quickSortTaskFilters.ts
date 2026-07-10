import type { Task } from '@/types/tasks'
import { formatDateKey, normalizeDueDate } from '@/utils/dateUtils'

export const QUICK_SORT_SOURCES = [
  'uncategorized',
  'overdue',
  'today',
  'next-3-days',
  'next-7-days',
  'no-due-date'
] as const

export type QuickSortSource = typeof QUICK_SORT_SOURCES[number]

export const DEFAULT_QUICK_SORT_SOURCES: QuickSortSource[] = ['uncategorized']

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function normalizeQuickSortSources(sources: readonly string[] | null | undefined): QuickSortSource[] {
  if (!sources?.length) return [...DEFAULT_QUICK_SORT_SOURCES]
  const valid = new Set<string>(QUICK_SORT_SOURCES)
  const normalized = [...new Set(sources.filter(source => valid.has(source)))] as QuickSortSource[]
  return normalized.length ? normalized : [...DEFAULT_QUICK_SORT_SOURCES]
}

export function selectQuickSortTasks(
  tasks: readonly Task[],
  sources: readonly QuickSortSource[],
  isUncategorizedTask: (task: Task) => boolean,
  now = new Date()
): Task[] {
  const selected = new Set(sources)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayKey = formatDateKey(today)
  const tomorrowKey = formatDateKey(addDays(today, 1))
  const next3EndKey = formatDateKey(addDays(today, 3))
  const next7EndKey = formatDateKey(addDays(today, 7))

  return tasks.filter(task => {
    if (task.status === 'done' || task._soft_deleted || task.isPinned) return false

    const dueDate = normalizeDueDate(task.dueDate)
    return (
      (selected.has('uncategorized') && isUncategorizedTask(task)) ||
      (selected.has('overdue') && Boolean(dueDate) && dueDate < todayKey) ||
      (selected.has('today') && dueDate === todayKey) ||
      (selected.has('next-3-days') && dueDate >= tomorrowKey && dueDate <= next3EndKey) ||
      (selected.has('next-7-days') && dueDate >= tomorrowKey && dueDate <= next7EndKey) ||
      (selected.has('no-due-date') && !dueDate)
    )
  })
}
