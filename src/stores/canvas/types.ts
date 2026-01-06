import type { Task } from '../tasks'
import type { PowerKeywordResult } from '@/composables/useTaskSmartGroups'

export interface GroupFilter {
    priorities?: ('low' | 'medium' | 'high')[]
    statuses?: Task['status'][]
    projects?: string[]
    tags?: string[]
    dateRange?: { start: Date; end: Date }
}

export interface TaskPosition {
    id: string
    position: { x: number; y: number }
    relativePosition: { x: number; y: number }
}

/**
 * Settings for auto-assigning properties when a task is dropped into a group
 */
export interface AssignOnDropSettings {
    priority?: 'high' | 'medium' | 'low' | null  // null = don't change
    status?: Task['status'] | null
    dueDate?: 'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'later' | string | null
    projectId?: string | null
    estimatedDuration?: number | null
}

/**
 * Settings for the collect/magnet feature - which tasks to match
 */
export interface CollectFilterSettings {
    matchPriority?: 'high' | 'medium' | 'low' | null
    matchStatus?: Task['status'] | null
    matchDueDate?: 'today' | 'tomorrow' | 'this_week' | 'overdue' | null
    matchProjectId?: string | null
    matchDuration?: string | null
}

export interface CanvasGroup {
    id: string
    name: string
    type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
    position: { x: number; y: number; width: number; height: number }
    color: string
    filters?: GroupFilter
    layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
    isVisible: boolean
    isCollapsed: boolean
    /** @deprecated Use assignOnDrop instead */
    propertyValue?: string | 'high' | 'medium' | 'low' | 'planned' | 'in_progress' | 'done' | 'backlog'
    autoCollect?: boolean // Auto-collect matching tasks from inbox
    collapsedHeight?: number // Store height when collapsed to restore on expand
    // Power group fields
    isPowerMode?: boolean // Whether power mode is enabled (auto-detected from name, can be toggled off)
    powerKeyword?: PowerKeywordResult | null // Detected power keyword info
    // NEW: Explicit property assignment settings (user-configurable via settings menu)
    assignOnDrop?: AssignOnDropSettings
    // NEW: Collect filter settings for magnet button
    collectFilter?: CollectFilterSettings
    // TASK-072: Nested groups support - optional parent group ID
    parentGroupId?: string | null
    updatedAt?: string
    isPinned?: boolean
}

// Backward compatibility alias - keeping CanvasSection as alias for CanvasGroup
/** @deprecated Use CanvasGroup instead */
export type CanvasSection = CanvasGroup

export interface CanvasState {
    viewport: {
        x: number
        y: number
        zoom: number
    }
    selectedNodeIds: string[]
    connectMode: boolean
    connectingFrom: string | null
    groups: CanvasGroup[]
    activeGroupId: string | null
    showGroupGuides: boolean
    snapToGroups: boolean
    multiSelectMode: boolean
    selectionRect: { x: number; y: number; width: number; height: number } | null
    selectionMode: 'rectangle' | 'lasso' | 'click'
    isSelecting: boolean
    // Vue Flow integration properties
    nodes: import('@vue-flow/core').Node[] // Vue Flow nodes
    edges: import('@vue-flow/core').Edge[] // Vue Flow edges
    // Additional state properties
    zoomHistory: { zoom: number; timestamp: number }[]
    multiSelectActive: boolean
}
