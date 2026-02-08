/**
 * FEATURE-1248: Quick Tasks — Pinned & Frequent Task Shortcuts
 */

/** A user-created pinned task shortcut (stored in pinned_tasks table) */
export interface PinnedTask {
    id: string
    userId: string
    title: string
    description: string
    projectId: string | null
    priority: string | null
    sortOrder: number
    createdAt: Date
    updatedAt: Date
}

/** Unified display item for the Quick Tasks dropdown */
export interface QuickTaskItem {
    /** Unique key for rendering (pinned: pin ID, frequent: task ID) */
    key: string
    type: 'pinned' | 'frequent'
    title: string
    /** For pinned: the pin ID. For frequent: the task ID */
    sourceId: string
    projectId: string | null
    projectName: string | null
    projectColor: string | null
    priority: string | null
    /** Number of completed pomodoros (frequent tasks only) */
    frequency: number
    /** Whether this item has a corresponding pin */
    isPinned: boolean
}
