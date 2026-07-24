import type { SmartView } from '@/composables/tasks/useTaskFiltering'

export type DurationFilter = 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null

export interface ExclusiveTaskFilters {
  activeSmartView: SmartView
  activeStatusFilter: string | null
  activeDurationFilter: DurationFilter
}

export function normalizeExclusiveTaskFilters(
  filters: ExclusiveTaskFilters
): ExclusiveTaskFilters {
  const status = filters.activeStatusFilter === 'all' ? null : filters.activeStatusFilter

  if (status) {
    return {
      activeSmartView: null,
      activeStatusFilter: status,
      activeDurationFilter: null,
    }
  }

  if (filters.activeDurationFilter) {
    return {
      activeSmartView: null,
      activeStatusFilter: null,
      activeDurationFilter: filters.activeDurationFilter,
    }
  }

  return {
    activeSmartView: filters.activeSmartView,
    activeStatusFilter: null,
    activeDurationFilter: null,
  }
}

export function areExclusiveTaskFiltersEqual(
  current: ExclusiveTaskFilters,
  candidate: ExclusiveTaskFilters
): boolean {
  const normalizedCurrent = normalizeExclusiveTaskFilters(current)
  const normalizedCandidate = normalizeExclusiveTaskFilters(candidate)

  return (
    normalizedCurrent.activeSmartView === normalizedCandidate.activeSmartView &&
    normalizedCurrent.activeStatusFilter === normalizedCandidate.activeStatusFilter &&
    normalizedCurrent.activeDurationFilter === normalizedCandidate.activeDurationFilter
  )
}

export function shouldHideDoneTasksForStatus(
  hideDoneTasks: boolean,
  activeStatusFilter: string | null
): boolean {
  return hideDoneTasks && activeStatusFilter !== 'done'
}
