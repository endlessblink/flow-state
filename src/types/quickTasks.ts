/**
 * Quick Tasks — Pinned & Frequent Task Shortcuts
 *
 * TASK-1772: `PinnedTask` type removed. Pinned items are real tasks
 * (filtered by `task.isPinned`); only the merged display type remains.
 */

/** Unified display item for the Quick Tasks dropdown */
export interface QuickTaskItem {
    /** Unique key for rendering */
    key: string
    type: 'pinned' | 'frequent' | 'search'
    title: string
    /** The backing task id (always a real task post-unification) */
    sourceId: string
    projectId: string | null
    projectName: string | null
    projectColor: string | null
    priority: string | null
    /** Number of completed pomodoros (frequent tasks only) */
    frequency: number
    /** Whether the backing task is flagged pinned */
    isPinned: boolean
}
