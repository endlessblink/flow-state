export type QuickSortDuePreset =
  | 'today'
  | 'tomorrow'
  | 'in3days'
  | 'weekend'
  | 'nextweek'
  | 'in2weeks'
  | 'in1month'
  | 'clear'

const PRESETS: Exclude<QuickSortDuePreset, 'clear'>[] = [
  'today',
  'tomorrow',
  'in3days',
  'weekend',
  'nextweek',
  'in2weeks',
  'in1month'
]

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

export function resolveQuickSortDueDate(preset: QuickSortDuePreset, now = new Date()): string {
  if (preset === 'clear') return ''

  const date = new Date(now)
  date.setHours(0, 0, 0, 0)

  if (preset === 'tomorrow') date.setDate(date.getDate() + 1)
  else if (preset === 'in3days') date.setDate(date.getDate() + 3)
  else if (preset === 'weekend') {
    const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7
    date.setDate(date.getDate() + daysUntilSaturday)
  } else if (preset === 'nextweek') date.setDate(date.getDate() + 7)
  else if (preset === 'in2weeks') date.setDate(date.getDate() + 14)
  else if (preset === 'in1month') {
    const originalDay = date.getDate()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    date.setDate(Math.min(originalDay, lastDayOfTargetMonth))
  }

  return localDateKey(date)
}

export function getActiveQuickSortDuePreset(
  dueDate: string | null | undefined,
  now = new Date()
): QuickSortDuePreset | null {
  if (!dueDate) return 'clear'
  const dueDateKey = dueDate.slice(0, 10)
  return PRESETS.find(preset => resolveQuickSortDueDate(preset, now) === dueDateKey) ?? null
}
