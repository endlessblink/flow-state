/**
 * BUG-2103: Sidebar filters (Today, This Week, All Active, duration, project,
 * status) stopped narrowing Canvas after Canvas switched to the raw task
 * projection. Canvas must never drop nodes (geometry invariants), so filtered
 * tasks are hidden in the render projection instead of removed.
 *
 * Returns null when no view filter is active (show everything), otherwise the
 * set of task ids the shared filter pipeline keeps visible.
 */
export interface CanvasViewFilterState {
  activeSmartView?: string | null
  activeProjectId?: string | null
  activeDurationFilter?: string | null
  activeStatusFilter?: string | null
  filteredTasks: ReadonlyArray<{ id: string }>
}

export function getCanvasViewFilterVisibleIds(state: CanvasViewFilterState): Set<string> | null {
  const isActive = Boolean(state.activeSmartView)
    || Boolean(state.activeProjectId)
    || Boolean(state.activeDurationFilter)
    || Boolean(state.activeStatusFilter && state.activeStatusFilter !== 'all')
  if (!isActive) return null
  return new Set(state.filteredTasks.map(task => task.id))
}
