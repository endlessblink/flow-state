/**
 * Type definitions export index for the Pomo-Flow application
 *
 * This file provides a centralized export point for all TypeScript types and interfaces,
 * making imports cleaner and more organized throughout the application.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

// Export all task-related types
export * from './task'

// Export all canvas-related types
export * from './canvas'

// Export all UI-related types
export * from './ui'

// Export all common utility types
export * from './common'

// Re-export commonly used types for convenience
export type {
  // Task types
  Task,
  Subtask,
  TaskInstance,
  Project,
  TaskStatus,
  TaskPriority,
  CreateTaskData,
  UpdateTaskData,
  TaskFilter,
  TaskStatistics
} from './task'

export type {
  // Canvas types
  CanvasSection,
  CanvasState,
  CanvasViewport,
  CanvasSelection,
  CanvasConnections,
  SectionFilter,
  SectionType,
  SectionLayout,
  CreateSectionData,
  UpdateSectionData,
  CanvasStatistics
} from './canvas'

export type {
  // UI types
  ViewType,
  ComponentSize,
  ComponentVariant,
  ButtonProps,
  ModalState,
  FormField,
  FormState,
  TableProps,
  SidebarState,
  UIState
} from './ui'

export type {
  // Common types
  ApiResponse,
  DatabaseOperationResult,
  PaginationConfig,
  SortConfig,
  FilterConfig,
  Position,
  Bounds,
  AnimationConfig,
  Notification,
  ThemeConfig,
  ValidationResult,
  PerformanceMetric
} from './common'

// Export type utilities
export type {
  Partial,
  Required,
  Readonly,
  ArrayElement,
  PromiseType,
  Omit,
  Pick
} from './common'