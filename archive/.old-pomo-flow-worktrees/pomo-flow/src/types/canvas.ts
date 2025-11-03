/**
 * Canvas-related type definitions for the Pomo-Flow application
 *
 * This file contains all TypeScript interfaces and types related to canvas management,
 * extracted from the monolithic canvas.ts store for better modularity and reusability.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

import type { Task, TaskStatus } from './task'

/**
 * Section filter configuration
 * Defines criteria for auto-collecting tasks into canvas sections
 */
export interface SectionFilter {
  /** Priority levels to include in section */
  priorities?: ('low' | 'medium' | 'high')[]
  /** Task statuses to include in section */
  statuses?: TaskStatus[]
  /** Project IDs to include in section */
  projects?: string[]
  /** Tags to include in section */
  tags?: string[]
  /** Date range for filtering tasks */
  dateRange?: { start: Date; end: Date }
}

/**
 * Task position information on canvas
 * Represents both absolute and relative positioning for tasks
 */
export interface TaskPosition {
  /** Task ID */
  id: string
  /** Absolute position on canvas */
  position: { x: number; y: number }
  /** Position relative to parent section */
  relativePosition: { x: number; y: number }
}

/**
 * Canvas section types
 * Defines the different types of sections that can exist on canvas
 */
export type SectionType = 'priority' | 'status' | 'timeline' | 'custom' | 'project'

/**
 * Canvas section layout types
 * Defines how tasks are arranged within a section
 */
export type SectionLayout = 'vertical' | 'horizontal' | 'grid' | 'freeform'

/**
 * Section property values
 * Defines the values that sections can assign to tasks
 */
export type SectionPropertyValue =
  | string
  | 'high'
  | 'medium'
  | 'low'
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'backlog'

/**
 * Canvas container for organizing tasks
 *
 * **Terminology**:
 * - **Groups** (`type: 'custom'`): Visual organization only, no property updates
 * - **Sections** (`type: 'priority'|'status'|'timeline'|'project'`): Smart automation, auto-updates task properties
 *
 * When a task is dragged into a Section, its properties (priority, status, dueDate, etc.)
 * are automatically updated based on the section's type and propertyValue.
 * Groups do not modify task properties.
 */
export interface CanvasSection {
  /** Unique identifier for the section */
  id: string
  /** Display name of the section */
  name: string
  /** Type of section (determines behavior) */
  type: SectionType
  /** Position and dimensions on canvas */
  position: { x: number; y: number; width: number; height: number }
  /** Color theme for the section */
  color: string
  /** Filtering criteria for auto-collection */
  filters?: SectionFilter
  /** Layout method for tasks within section */
  layout: SectionLayout
  /** Visibility state of the section */
  isVisible: boolean
  /** Collapsed state of the section */
  isCollapsed: boolean
  /** Property value to assign to tasks (for smart sections) */
  propertyValue?: SectionPropertyValue
  /** Whether to auto-collect matching tasks from inbox */
  autoCollect?: boolean
  /** Stored height when collapsed for restoration */
  collapsedHeight?: number
}

/**
 * Viewport configuration for canvas
 * Defines the current view state and zoom level
 */
export interface CanvasViewport {
  /** Horizontal scroll position */
  x: number
  /** Vertical scroll position */
  y: number
  /** Current zoom level */
  zoom: number
}

/**
 * Selection state for canvas nodes
 * Manages which tasks/sections are currently selected
 */
export interface CanvasSelection {
  /** Array of selected node IDs */
  selectedNodeIds: string[]
  /** Multi-selection mode state */
  multiSelectMode: boolean
  /** Current selection tool type */
  selectionMode: 'rectangle' | 'lasso' | 'click'
  /** Selection rectangle bounds */
  selectionRect: { x: number; y: number; width: number; height: number } | null
  /** Whether selection is currently active */
  isSelecting: boolean
}

/**
 * Connection state for task dependencies
 * Manages creation and editing of task connections
 */
export interface CanvasConnections {
  /** Connection mode state */
  connectMode: boolean
  /** ID of node currently connecting from */
  connectingFrom: string | null
  /** Connection types between tasks */
  connectionTypes: { [targetTaskId: string]: 'sequential' | 'blocker' | 'reference' }
}

/**
 * Canvas interaction settings
 * Defines user preferences for canvas behavior
 */
export interface CanvasInteractionSettings {
  /** Whether to show section guides */
  showSectionGuides: boolean
  /** Whether to snap tasks to sections */
  snapToSections: boolean
  /** Whether to show grid */
  showGrid: boolean
  /** Grid size for snapping */
  gridSize: number
  /** Whether to enable drag and drop */
  enableDragDrop: boolean
  /** Whether to enable multi-selection */
  enableMultiSelection: boolean
}

/**
 * Complete canvas state
 * Aggregates all canvas-related state into a single interface
 */
export interface CanvasState {
  /** Current viewport state */
  viewport: CanvasViewport
  /** Selection state */
  selection: CanvasSelection
  /** Connection state */
  connections: CanvasConnections
  /** Array of canvas sections */
  sections: CanvasSection[]
  /** ID of currently active section */
  activeSectionId: string | null
  /** Interaction settings */
  settings: CanvasInteractionSettings
}

/**
 * Canvas creation data interface
 * Represents data needed to create a new canvas section
 */
export interface CreateSectionData {
  /** Section name */
  name: string
  /** Section type */
  type: SectionType
  /** Position on canvas */
  position: { x: number; y: number; width: number; height: number }
  /** Section color */
  color: string
  /** Optional layout type */
  layout?: SectionLayout
  /** Optional property value */
  propertyValue?: SectionPropertyValue
  /** Optional filters */
  filters?: SectionFilter
}

/**
 * Canvas update data interface
 * Represents partial data for updating canvas sections
 */
export interface UpdateSectionData {
  /** Optional updated name */
  name?: string
  /** Optional updated position */
  position?: { x: number; y: number; width: number; height: number }
  /** Optional updated color */
  color?: string
  /** Optional updated layout */
  layout?: SectionLayout
  /** Optional updated property value */
  propertyValue?: SectionPropertyValue
  /** Optional updated filters */
  filters?: SectionFilter
  /** Optional updated visibility */
  isVisible?: boolean
  /** Optional updated collapsed state */
  isCollapsed?: boolean
}

/**
 * Canvas event types
 * Defines the different types of events that can occur on canvas
 */
export type CanvasEventType =
  | 'section-created'
  | 'section-updated'
  | 'section-deleted'
  | 'section-moved'
  | 'task-moved-to-section'
  | 'task-positioned'
  | 'selection-changed'
  | 'viewport-changed'
  | 'connection-created'
  | 'connection-deleted'

/**
 * Canvas event data interface
 * Represents data associated with canvas events
 */
export interface CanvasEventData {
  /** Type of event */
  type: CanvasEventType
  /** Timestamp when event occurred */
  timestamp: Date
  /** ID of the affected section (if applicable) */
  sectionId?: string
  /** ID of the affected task (if applicable) */
  taskId?: string
  /** Event-specific data */
  data?: {
    [key: string]: any
  }
}

/**
 * Canvas statistics interface
 * Represents aggregated data about canvas usage
 */
export interface CanvasStatistics {
  /** Total number of sections */
  totalSections: number
  /** Number of visible sections */
  visibleSections: number
  /** Number of collapsed sections */
  collapsedSections: number
  /** Total number of tasks positioned on canvas */
  positionedTasks: number
  /** Number of tasks in inbox */
  inboxTasks: number
  /** Canvas dimensions */
  canvasBounds: {
    width: number
    height: number
  }
  /** Current viewport coverage percentage */
  viewportCoverage: number
}

/**
 * Canvas export/import data interface
 * Represents canvas layout data for export/import operations
 */
export interface CanvasExportData {
  /** Version of export format */
  version: string
  /** Export timestamp */
  exportedAt: Date
  /** Array of canvas sections */
  sections: CanvasSection[]
  /** Viewport state */
  viewport: CanvasViewport
  /** Interaction settings */
  settings: CanvasInteractionSettings
  /** Export metadata */
  metadata?: {
    [key: string]: any
  }
}

/**
 * Canvas performance metrics interface
 * Represents performance data for canvas operations
 */
export interface CanvasPerformanceMetrics {
  /** Render time in milliseconds */
  renderTime: number
  /** Number of rendered nodes */
  renderedNodes: number
  /** Frame rate (FPS) */
  frameRate: number
  /** Memory usage in MB */
  memoryUsage: number
  /** Number of visible tasks */
  visibleTasks: number
  /** Number of visible sections */
  visibleSections: number
}