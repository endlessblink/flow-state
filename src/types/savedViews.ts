/**
 * FEATURE-1162: Smart Filters / Saved Views
 * Types for persisting and restoring named filter configurations.
 */

export interface SavedFilterState {
    activeProjectId: string | null
    activeSmartView: string | null  // SmartView type ('today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null)
    activeStatusFilter: string | null
    activeDurationFilter: string | null  // 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null
    hideBoardDoneTasks: boolean
    hideCanvasDoneTasks: boolean
    hideCalendarDoneTasks: boolean
    hideCanvasOverdueTasks: boolean
    showFutureRecurring: boolean
}

export interface SavedView {
    id: string
    name: string
    filters: SavedFilterState
    icon?: string    // lucide icon name
    color?: string   // hex color for chip accent
    createdAt: string
    updatedAt: string
}
