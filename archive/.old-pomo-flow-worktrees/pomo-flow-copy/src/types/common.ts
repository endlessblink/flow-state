/**
 * Common type definitions shared across the Pomo-Flow application
 *
 * This file contains utility types and interfaces that are used throughout
 * the application to maintain consistency and reduce duplication.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

/**
 * Generic API response interface
 * Standardizes the format of API responses across the application
 */
export interface ApiResponse<T = any> {
  /** Whether the operation was successful */
  success: boolean
  /** Response data */
  data?: T
  /** Error message if operation failed */
  error?: string
  /** Additional error details */
  details?: {
    [key: string]: any
  }
  /** Response timestamp */
  timestamp: Date
}

/**
 * Database operation result interface
 * Represents the outcome of database operations
 */
export interface DatabaseOperationResult {
  /** Whether the operation was successful */
  success: boolean
  /** Optional error message */
  error?: string
  /** Number of affected records */
  affectedRecords?: number
  /** Operation duration in milliseconds */
  duration: number
}

/**
 * Pagination configuration interface
 * Defines pagination parameters for list operations
 */
export interface PaginationConfig {
  /** Current page number (1-based) */
  page: number
  /** Number of items per page */
  limit: number
  /** Total number of items (for pagination metadata) */
  total?: number
  /** Whether there are more pages */
  hasNext?: boolean
  /** Whether there are previous pages */
  hasPrev?: boolean
}

/**
 * Sort configuration interface
 * Defines sorting parameters for list operations
 */
export interface SortConfig {
  /** Field to sort by */
  field: string
  /** Sort direction */
  direction: 'asc' | 'desc'
  /** Secondary sort field */
  secondaryField?: string
  /** Secondary sort direction */
  secondaryDirection?: 'asc' | 'desc'
}

/**
 * Filter configuration interface
 * Generic filter configuration for search operations
 */
export interface FilterConfig {
  /** Search query string */
  search?: string
  /** Field-specific filters */
  filters?: {
    [field: string]: any
  }
  /** Date range filters */
  dateRange?: {
    start: Date
    end: Date
    field: string
  }
}

/**
 * Date utility types
 */
export type DateString = string // YYYY-MM-DD format
export type DateTimeString = string // ISO 8601 format
export type TimeString = string // HH:MM format

/**
 * Color type definitions
 */
export type ColorHex = string // #RRGGBB or #RGB format
export type ColorRgb = { r: number; g: number; b: number; a?: number }
export type ColorHsl = { h: number; s: number; l: number; a?: number }
export type ColorValue = ColorHex | ColorRgb | ColorHsl

/**
 * Position and dimension types
 */
export interface Position {
  x: number
  y: number
}

export interface Dimensions {
  width: number
  height: number
}

export interface Bounds extends Position, Dimensions {
  /** x coordinate */
  x: number
  /** y coordinate */
  y: number
  /** width */
  width: number
  /** height */
  height: number
}

/**
 * Animation and transition types
 */
export interface AnimationConfig {
  /** Animation duration in milliseconds */
  duration: number
  /** Animation easing function */
  easing: string
  /** Animation delay in milliseconds */
  delay?: number
}

export interface TransitionConfig extends AnimationConfig {
  /** Property to animate */
  property: string
  /** Whether animation is reversible */
  reversible?: boolean
}

/**
 * Event handling types
 */
export interface EventHandler<T = any> {
  (event: T): void
}

export interface EventConfig<T = any> {
  /** Event handler function */
  handler: EventHandler<T>
  /** Whether to run handler only once */
  once?: boolean
  /** Additional event options */
  options?: boolean | AddEventListenerOptions
}

/**
 * Keyboard event types
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'ctrl+s', 'shift+a') */
  combination: string
  /** Action description */
  description: string
  /** Whether shortcut is enabled */
  enabled?: boolean
  /** Handler function */
  handler: (event: KeyboardEvent) => void
}

/**
 * Theme configuration types
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

export interface ThemeConfig {
  /** Current theme mode */
  mode: ThemeMode
  /** Whether to use system theme preference */
  useSystemPreference: boolean
  /** Custom theme colors */
  colors?: {
    [key: string]: ColorValue
  }
}

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  /** Unique notification ID */
  id: string
  /** Notification type */
  type: NotificationType
  /** Notification title */
  title: string
  /** Notification message */
  message?: string
  /** Whether notification can be dismissed */
  dismissible?: boolean
  /** Auto-dismiss duration in milliseconds */
  duration?: number
  /** Timestamp when notification was created */
  timestamp: Date
}

/**
 * Modal configuration types
 */
export interface ModalConfig {
  /** Modal title */
  title?: string
  /** Modal size */
  size?: 'small' | 'medium' | 'large' | 'fullscreen'
  /** Whether modal can be closed by clicking outside */
  closable?: boolean
  /** Whether to show close button */
  showCloseButton?: boolean
  /** Custom modal classes */
  class?: string
}

/**
 * Loading state types
 */
export interface LoadingState {
  /** Whether operation is in progress */
  isLoading: boolean
  /** Loading message */
  message?: string
  /** Loading progress (0-100) */
  progress?: number
  /** Operation identifier */
  operation?: string
}

/**
 * Error handling types
 */
export interface AppError {
  /** Error code */
  code: string
  /** Error message */
  message: string
  /** Stack trace (development only) */
  stack?: string
  /** Additional error context */
  context?: {
    [key: string]: any
  }
  /** Timestamp when error occurred */
  timestamp: Date
}

/**
 * Validation result types
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean
  /** Validation error messages */
  errors: string[]
  /** Validation warning messages */
  warnings: string[]
  /** Field-specific validation results */
  fieldResults?: {
    [field: string]: {
      isValid: boolean
      errors: string[]
      warnings: string[]
    }
  }
}

/**
 * Utility types for common operations
 */

/** Make all properties in T optional */
export type Partial<T> = {
  [P in keyof T]?: T[P]
}

/** Make all properties in T required */
export type Required<T> = {
  [P in keyof T]-?: T[P]
}

/** Make all properties in T readonly */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

/** Extract array element type */
export type ArrayElement<T> = T extends (infer U)[] ? U : never

/** Extract promise resolve type */
export type PromiseType<T> = T extends Promise<infer U> ? U : never

/** Create a type with omitted properties */
export type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

/** Create a type with specific properties only */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P]
}

/**
 * Performance monitoring types
 */
export interface PerformanceMetric {
  /** Metric name */
  name: string
  /** Metric value */
  value: number
  /** Unit of measurement */
  unit: 'ms' | 'bytes' | 'count' | 'percentage'
  /** Timestamp when metric was recorded */
  timestamp: Date
  /** Additional context */
  context?: {
    [key: string]: any
  }
}

export interface PerformanceReport {
  /** Report identifier */
  id: string
  /** Report generation timestamp */
  timestamp: Date
  /** Array of performance metrics */
  metrics: PerformanceMetric[]
  /** Overall performance score */
  score?: number
}

/**
 * Development and debugging types
 */
export interface DebugInfo {
  /** Component name */
  component: string
  /** Debug level */
  level: 'debug' | 'info' | 'warn' | 'error'
  /** Debug message */
  message: string
  /** Additional debug data */
  data?: any
  /** Timestamp */
  timestamp: Date
}

export interface DevToolsConfig {
  /** Whether development tools are enabled */
  enabled: boolean
  /** Debug log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  /** Whether to show performance metrics */
  showPerformance: boolean
  /** Whether to show component boundaries */
  showComponentBoundaries: boolean
}