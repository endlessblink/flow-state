import type { TaskPriority } from '@/types/tasks'

/**
 * TASK-2080: single source of truth for priority rank, labels and colors.
 * Every selector, filter, badge and sort must derive from this list so a new
 * or existing priority can never be missing or ordered differently somewhere.
 */
export type PriorityValue = NonNullable<TaskPriority>

/** Highest to lowest. Array index is the rank (0 = most urgent). */
export const PRIORITY_VALUES: readonly PriorityValue[] = [
  'immediate',
  'high',
  'medium',
  'low',
  'relaxed',
] as const

export const PRIORITY_RANK: Readonly<Record<PriorityValue, number>> = {
  immediate: 0,
  high: 1,
  medium: 2,
  low: 3,
  relaxed: 4,
}

/** Rank used for tasks with no priority: always after every real priority. */
export const NO_PRIORITY_RANK = PRIORITY_VALUES.length

export const PRIORITY_LABELS: Readonly<Record<PriorityValue, string>> = {
  immediate: 'Immediate',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  relaxed: 'Relaxed',
}

/** Design-token color variable per priority (defined in design-tokens.css). */
export const PRIORITY_COLOR_VARS: Readonly<Record<PriorityValue, string>> = {
  immediate: 'var(--color-priority-immediate)',
  high: 'var(--color-priority-high)',
  medium: 'var(--color-priority-medium)',
  low: 'var(--color-priority-low)',
  relaxed: 'var(--color-priority-relaxed)',
}

export function isPriorityValue(value: unknown): value is PriorityValue {
  return typeof value === 'string' && (PRIORITY_VALUES as readonly string[]).includes(value)
}

/** Rank for any raw value; unknown/empty values sort after every real priority. */
export function priorityRank(value: unknown): number {
  return isPriorityValue(value) ? PRIORITY_RANK[value] : NO_PRIORITY_RANK
}

/** Ascending = most urgent first. Never alphabetical. */
export function comparePriority(a: unknown, b: unknown): number {
  return priorityRank(a) - priorityRank(b)
}

/** Selector/filter options in canonical order, optionally with a trailing "none". */
export function priorityOptions(opts: { includeNone?: boolean; noneLabel?: string } = {}): Array<{ value: PriorityValue | null; label: string }> {
  const options: Array<{ value: PriorityValue | null; label: string }> = PRIORITY_VALUES.map(value => ({
    value,
    label: PRIORITY_LABELS[value],
  }))
  if (opts.includeNone) options.push({ value: null, label: opts.noneLabel ?? 'No Priority' })
  return options
}
