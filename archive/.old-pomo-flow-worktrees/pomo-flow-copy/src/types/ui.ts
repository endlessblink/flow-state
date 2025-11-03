/**
 * UI-related type definitions for the Pomo-Flow application
 *
 * This file contains all TypeScript interfaces and types related to UI components,
 * theming, and user interface interactions.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

import type { Position, Bounds, AnimationConfig, ModalConfig, Notification, ThemeConfig, ThemeMode } from './common'

/**
 * UI view types
 * Defines the main application views
 */
export type ViewType = 'board' | 'calendar' | 'canvas' | 'all-tasks' | 'settings'

/**
 * Component size variants
 */
export type ComponentSize = 'small' | 'medium' | 'large' | 'xlarge'

/**
 * Component color variants
 */
export type ComponentVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'

/**
 * Button component props interface
 */
export interface ButtonProps {
  /** Button text or content */
  label?: string
  /** Button variant */
  variant?: ComponentVariant
  /** Button size */
  size?: ComponentSize
  /** Whether button is disabled */
  disabled?: boolean
  /** Whether button is loading */
  loading?: boolean
  /** Whether button is outlined */
  outlined?: boolean
  /** Whether button is text only (no background) */
  text?: boolean
  /** Whether button is rounded */
  rounded?: boolean
  /** Icon to display */
  icon?: string
  /** Icon position */
  iconPosition?: 'left' | 'right'
  /** Click handler */
  onClick?: () => void
  /** Additional CSS classes */
  class?: string
}

/**
 * Modal component state interface
 */
export interface ModalState {
  /** Whether modal is open */
  isOpen: boolean
  /** Modal configuration */
  config: ModalConfig
  /** Modal component name */
  component?: string
  /** Modal component props */
  componentProps?: {
    [key: string]: any
  }
}

/**
 * Dropdown component props interface
 */
export interface DropdownProps {
  /** Dropdown placeholder text */
  placeholder?: string
  /** Whether dropdown is disabled */
  disabled?: boolean
  /** Whether dropdown is clearable */
  clearable?: boolean
  /** Whether to allow multiple selections */
  multiple?: boolean
  /** Whether to allow searching */
  filterable?: boolean
  /** Dropdown options */
  options: DropdownOption[]
  /** Selected value(s) */
  value?: any | any[]
  /** Change handler */
  onChange?: (value: any | any[]) => void
  /** Additional CSS classes */
  class?: string
}

/**
 * Dropdown option interface
 */
export interface DropdownOption {
  /** Option value */
  value: any
  /** Option label */
  label: string
  /** Whether option is disabled */
  disabled?: boolean
  /** Option icon */
  icon?: string
  /** Option group */
  group?: string
}

/**
 * Form field interface
 */
export interface FormField {
  /** Field name */
  name: string
  /** Field label */
  label: string
  /** Field type */
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'number' | 'email'
  /** Field value */
  value: any
  /** Whether field is required */
  required?: boolean
  /** Whether field is disabled */
  disabled?: boolean
  /** Field placeholder */
  placeholder?: string
  /** Field validation rules */
  validation?: ValidationRule[]
  /** Field error message */
  error?: string
  /** Field help text */
  help?: string
  /** Additional CSS classes */
  class?: string
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  /** Rule name */
  name: string
  /** Validation function */
  validate: (value: any) => boolean | string
  /** Error message */
  message?: string
}

/**
 * Form state interface
 */
export interface FormState {
  /** Form fields */
  fields: {
    [fieldName: string]: FormField
  }
  /** Whether form is valid */
  isValid: boolean
  /** Whether form is submitting */
  isSubmitting: boolean
  /** Form-level errors */
  errors: string[]
  /** Submit handler */
  onSubmit?: (data: any) => void | Promise<void>
}

/**
 * Table column interface
 */
export interface TableColumn {
  /** Column key */
  key: string
  /** Column title */
  title: string
  /** Column width */
  width?: number | string
  /** Whether column is sortable */
  sortable?: boolean
  /** Whether column is resizable */
  resizable?: boolean
  /** Whether column is filterable */
  filterable?: boolean
  /** Custom render function */
  render?: (value: any, record: any) => any
  /** Column alignment */
  align?: 'left' | 'center' | 'right'
}

/**
 * Table props interface
 */
export interface TableProps {
  /** Table columns */
  columns: TableColumn[]
  /** Table data */
  data: any[]
  /** Whether table is loading */
  loading?: boolean
  /** Whether to show table header */
  showHeader?: boolean
  /** Whether to show table border */
  bordered?: boolean
  /** Whether rows are selectable */
  selectable?: boolean
  /** Table size */
  size?: ComponentSize
  /** Row click handler */
  onRowClick?: (record: any, index: number) => void
  /** Selection change handler */
  onSelectionChange?: (selectedRows: any[]) => void
  /** Additional CSS classes */
  class?: string
}

/**
 * Sidebar state interface
 */
export interface SidebarState {
  /** Whether sidebar is open */
  isOpen: boolean
  /** Current active view */
  activeView: ViewType
  /** Sidebar width */
  width: number
  /** Whether sidebar is collapsible */
  collapsible: boolean
  /** Sidebar position */
  position: 'left' | 'right'
}

/**
 * Header state interface
 */
export interface HeaderState {
  /** Header title */
  title: string
  /** Header subtitle */
  subtitle?: string
  /** Whether to show breadcrumbs */
  showBreadcrumbs: boolean
  /** Header actions */
  actions: HeaderAction[]
}

/**
 * Header action interface
 */
export interface HeaderAction {
  /** Action identifier */
  key: string
  /** Action label */
  label: string
  /** Action icon */
  icon?: string
  /** Action variant */
  variant?: ComponentVariant
  /** Whether action is disabled */
  disabled?: boolean
  /** Action handler */
  handler: () => void
}

/**
 * Loading overlay interface
 */
export interface LoadingOverlay {
  /** Whether overlay is shown */
  visible: boolean
  /** Loading message */
  message?: string
  /** Loading progress */
  progress?: number
  /** Whether overlay is fullscreen */
  fullscreen?: boolean
}

/**
 * Toast notification interface
 */
export interface ToastNotification extends Notification {
  /** Notification position */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Whether to show progress bar */
  showProgress?: boolean
  /** Custom CSS classes */
  class?: string
}

/**
 * Tooltip interface
 */
export interface Tooltip {
  /** Tooltip content */
  content: string
  /** Tooltip position */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Whether to show arrow */
  showArrow?: boolean
  /** Tooltip trigger */
  trigger?: 'hover' | 'click' | 'focus' | 'manual'
  /** Tooltip delay in milliseconds */
  delay?: number
  /** Maximum width */
  maxWidth?: number
}

/**
 * Context menu item interface
 */
export interface ContextMenuItem {
  /** Item key */
  key: string
  /** Item label */
  label: string
  /** Item icon */
  icon?: string
  /** Whether item is disabled */
  disabled?: boolean
  /** Whether item is a separator */
  separator?: boolean
  /** Submenu items */
  children?: ContextMenuItem[]
  /** Click handler */
  handler?: () => void
}

/**
 * Context menu interface
 */
export interface ContextMenu {
  /** Whether menu is visible */
  visible: boolean
  /** Menu position */
  position: Position
  /** Menu items */
  items: ContextMenuItem[]
  /** Selected item key */
  selectedKey?: string
}

/**
 * Keyboard navigation interface
 */
export interface KeyboardNavigation {
  /** Whether keyboard navigation is enabled */
  enabled: boolean
  /** Current focused element index */
  currentIndex: number
  /** Total number of focusable elements */
  totalElements: number
  /** Navigation wrap-around */
  wrapAround: boolean
  /** Key bindings */
  keyBindings: {
    [key: string]: () => void
  }
}

/**
 * Drag and drop interface
 */
export interface DragDropState {
  /** Whether drag operation is active */
  isDragging: boolean
  /** Dragged item data */
  draggedItem?: any
  /** Drag start position */
  dragStartPosition?: Position
  /** Current drag position */
  currentPosition?: Position
  /** Drop target zone */
  dropTarget?: string
  /** Drag constraints */
  constraints?: {
    x?: { min: number; max: number }
    y?: { min: number; max: number }
  }
}

/**
 * Responsive breakpoint interface
 */
export interface ResponsiveBreakpoint {
  /** Breakpoint name */
  name: string
  /** Minimum width */
  minWidth: number
  /** Maximum width */
  maxWidth?: number
  /** Device type */
  device: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Responsive state interface
 */
export interface ResponsiveState {
  /** Current breakpoint */
  breakpoint: ResponsiveBreakpoint
  /** Screen dimensions */
  screen: {
    width: number
    height: number
  }
  /** Whether device is touch-enabled */
  isTouch: boolean
  /** Whether device is mobile */
  isMobile: boolean
  /** Whether device is tablet */
  isTablet: boolean
  /** Whether device is desktop */
  isDesktop: boolean
}

/**
 * UI theme interface extending common theme config
 */
export interface UITheme extends ThemeConfig {
  /** Design tokens */
  tokens: {
    colors: {
      primary: string
      secondary: string
      success: string
      warning: string
      error: string
      background: string
      surface: string
      text: string
      border: string
    }
    spacing: {
      xs: string
      sm: string
      md: string
      lg: string
      xl: string
    }
    typography: {
      fontFamily: string
      fontSize: {
        xs: string
        sm: string
        md: string
        lg: string
        xl: string
      }
      fontWeight: {
        normal: number
        medium: number
        bold: number
      }
    }
    shadows: {
      sm: string
      md: string
      lg: string
    }
    borderRadius: {
      sm: string
      md: string
      lg: string
      full: string
    }
  }
}

/**
 * Component animation presets
 */
export interface AnimationPresets {
  /** Fade animation */
  fade: AnimationConfig
  /** Slide animation */
  slide: AnimationConfig
  /** Scale animation */
  scale: AnimationConfig
  /** Bounce animation */
  bounce: AnimationConfig
}

/**
 * UI state interface
 * Aggregates all UI-related state
 */
export interface UIState {
  /** Current view */
  currentView: ViewType
  /** Theme configuration */
  theme: UITheme
  /** Sidebar state */
  sidebar: SidebarState
  /** Header state */
  header: HeaderState
  /** Modal states */
  modals: {
    [modalId: string]: ModalState
  }
  /** Toast notifications */
  notifications: ToastNotification[]
  /** Loading overlay */
  loadingOverlay: LoadingOverlay
  /** Context menu */
  contextMenu: ContextMenu
  /** Keyboard navigation */
  keyboardNavigation: KeyboardNavigation
  /** Drag and drop */
  dragDrop: DragDropState
  /** Responsive state */
  responsive: ResponsiveState
  /** Animation presets */
  animations: AnimationPresets
}