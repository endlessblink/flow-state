/**
 * Duration Categories - Single Source of Truth
 *
 * TASK-144: Consolidated from multiple files that had duplicate duration definitions:
 * - useInboxFiltering.ts
 * - useCanvasDragDrop.ts
 * - useGroupSettings.ts
 * - useSmartViews.ts
 * - InboxFilters.vue
 * - UnifiedInboxPanel.vue
 * - CalendarInboxPanel.vue
 * - UnifiedGroupModal.vue
 *
 * ALL duration-related logic should import from this file.
 */

export type DurationCategory = 'quick' | 'short' | 'medium' | 'long' | 'unestimated'

/**
 * Duration thresholds in minutes
 */
export const DURATION_THRESHOLDS = {
  QUICK_MAX: 15,      // 0-15 minutes
  SHORT_MAX: 30,      // 15-30 minutes
  MEDIUM_MAX: 60,     // 30-60 minutes
  // Long is anything > 60 minutes
} as const

/**
 * Default duration values when assigning a category to a task
 */
export const DURATION_DEFAULTS: Record<DurationCategory, number> = {
  quick: 15,
  short: 30,
  medium: 60,
  long: 120,
  unestimated: 0
} as const

/**
 * Human-readable labels for duration categories
 */
export const DURATION_LABELS: Record<DurationCategory, string> = {
  quick: 'Quick (<15m)',
  short: 'Short (15-30m)',
  medium: 'Medium (30-60m)',
  long: 'Long (>60m)',
  unestimated: 'No Estimate'
} as const

/**
 * Icons for duration categories (used in UI)
 */
export const DURATION_ICONS: Record<DurationCategory, string> = {
  quick: '⚡',
  short: '☕',
  medium: '⏳',
  long: '🕐',
  unestimated: '❓'
} as const

/**
 * Check if a duration (in minutes) matches a given category
 */
export function matchesDurationCategory(
  durationMinutes: number | undefined | null,
  category: DurationCategory
): boolean {
  const d = durationMinutes ?? 0

  switch (category) {
    case 'quick':
      return d > 0 && d <= DURATION_THRESHOLDS.QUICK_MAX
    case 'short':
      return d > DURATION_THRESHOLDS.QUICK_MAX && d <= DURATION_THRESHOLDS.SHORT_MAX
    case 'medium':
      return d > DURATION_THRESHOLDS.SHORT_MAX && d <= DURATION_THRESHOLDS.MEDIUM_MAX
    case 'long':
      return d > DURATION_THRESHOLDS.MEDIUM_MAX
    case 'unestimated':
      return !durationMinutes || d === 0
    default:
      return false
  }
}

/**
 * Get the duration category for a given duration in minutes
 */
export function getDurationCategory(durationMinutes: number | undefined | null): DurationCategory {
  const d = durationMinutes ?? 0

  if (!d || d === 0) return 'unestimated'
  if (d <= DURATION_THRESHOLDS.QUICK_MAX) return 'quick'
  if (d <= DURATION_THRESHOLDS.SHORT_MAX) return 'short'
  if (d <= DURATION_THRESHOLDS.MEDIUM_MAX) return 'medium'
  return 'long'
}

/**
 * Get the default duration in minutes for a category
 */
export function getDefaultDuration(category: DurationCategory): number {
  return DURATION_DEFAULTS[category]
}

/**
 * Duration filter options for UI dropdowns/selects
 */
export const DURATION_FILTER_OPTIONS = [
  { value: 'quick' as const, label: DURATION_LABELS.quick, icon: DURATION_ICONS.quick },
  { value: 'short' as const, label: DURATION_LABELS.short, icon: DURATION_ICONS.short },
  { value: 'medium' as const, label: DURATION_LABELS.medium, icon: DURATION_ICONS.medium },
  { value: 'long' as const, label: DURATION_LABELS.long, icon: DURATION_ICONS.long },
  { value: 'unestimated' as const, label: DURATION_LABELS.unestimated, icon: DURATION_ICONS.unestimated }
] as const
