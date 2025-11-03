# Pomo-Flow - Composables Catalog

## Overview

Pomo-Flow utilizes Vue 3's Composition API with 27+ composables that encapsulate reusable logic across the application. These composables provide clean, testable, and reusable functionality that can be shared across components and views.

## Composable Architecture

```
src/composables/
├── Core System Composables          # Foundational system logic
├── Feature-Specific Composables     # Specialized feature logic
├── Performance & UX Composables     # Performance and user experience
├── Utility Composables              # General utility functions
└── index.ts                         # Centralized exports
```

## 1. Core System Composables

### useUnifiedUndoRedo.ts - Centralized Undo/Redo System

**Purpose**: Single unified undo/redo system replacing multiple conflicting implementations
**Pattern**: Singleton with VueUse integration
**Capacity**: 50 entries with deep cloning

#### Core Features
- **State Tracking**: Automatic state change detection
- **History Management**: 50-entry circular buffer
- **Deep Cloning**: Complete state preservation
- **JSON Serialization**: Persistent undo history
- **Performance Optimized**: Efficient state management

#### API
```typescript
// Save current state
saveState(label?: string): void

// Undo to previous state
undo(): boolean

// Redo to next state
redo(): boolean

// Get history state
getHistoryState(): {
  past: any[]
  present: any
  future: any[]
}

// Clear history
clearHistory(): void

// Check if can undo/redo
canUndo(): boolean
canRedo(): boolean
```

#### Usage Pattern
```typescript
// In stores or components
const { saveState, undo, redo, canUndo, canRedo } = useUnifiedUndoRedo()

// Save state before mutations
const updateTask = (taskId: string, updates: Partial<Task>) => {
  saveState(`Update task ${taskId}`)
  // Apply updates...
}
```

#### Integration Points
- **Task Store**: All task CRUD operations
- **Canvas Store**: Canvas state changes
- **Timer Store**: Timer session changes
- **UI Store**: Preference changes

---

### useDatabase.ts - IndexedDB Abstraction Layer

**Purpose**: Unified database operations with LocalForage integration
**Pattern**: Generic typed database operations
**Features**: Error handling, fallbacks, performance optimization

#### Core Features
- **Type Safety**: Generic type parameters
- **Error Recovery**: Graceful failure handling
- **Performance**: Debounced writes and caching
- **Fallbacks**: localStorage fallback for IndexedDB failures
- **Batch Operations**: Efficient bulk operations

#### API
```typescript
// Generic save operation
save<T>(key: string, data: T): Promise<void>

// Generic load operation
load<T>(key: string, defaultValue?: T): Promise<T>

// Delete operation
remove(key: string): Promise<void>

// Clear all data
clear(): Promise<void>

// Check if key exists
exists(key: string): Promise<boolean>

// Get all keys
getKeys(): Promise<string[]>

// Batch operations
batchSave<T>(entries: Array<{ key: string; data: T }>): Promise<void>
batchLoad<T>(keys: string[]): Promise<Map<string, T>>
```

#### Usage Pattern
```typescript
// Type-safe database operations
const db = useDatabase()

// Save task data
await db.save('tasks', tasks)

// Load with default
const tasks = await db.load<Task[]>('tasks', [])

// Batch operations
const entries = [
  { key: 'tasks', data: tasks },
  { key: 'projects', data: projects }
]
await db.batchSave(entries)
```

#### Configuration Options
```typescript
interface DatabaseConfig {
  name: string              // Database name
  storeName: string         // Store/collection name
  version: number           // Database version
  fallbackToLocalStorage: boolean
  debounceMs: number        // Debounce delay for writes
}
```

---

### usePersistentStorage.ts - LocalStorage Management

**Purpose**: localStorage operations with fallbacks and type safety
**Pattern**: Reactive localStorage with automatic synchronization

#### Core Features
- **Type Safety**: Generic typed storage
- **Reactive**: Automatic UI updates on storage changes
- **Fallbacks**: SessionStorage fallback
- **Cross-Tab Sync**: Synchronize across browser tabs
- **Error Handling**: Graceful failure handling

#### API
```typescript
// Reactive storage
useStorage<T>(key: string, defaultValue: T): Ref<T>

// Manual operations
setItem<T>(key: string, value: T): Promise<void>
getItem<T>(key: string, defaultValue?: T): Promise<T>
removeItem(key: string): Promise<void>

// Storage management
getStorageSize(): number
clearStorage(): Promise<void>
getUsedKeys(): string[]
```

#### Usage Pattern
```typescript
// Reactive user preferences
const theme = useStorage<'light' | 'dark'>('theme', 'dark')
const sidebarOpen = useStorage('sidebarOpen', true)

// Manual operations
const storage = usePersistentStorage()
await storage.setItem('userPreferences', preferences)
```

---

## 2. Feature-Specific Composables

### useQuickSort.ts - Rapid Task Categorization

**Purpose**: Session management for rapid task sorting and categorization
**Pattern**: State machine with progress tracking

#### Core Features
- **Session Management**: Start, pause, resume sessions
- **Progress Tracking**: Real-time progress metrics
- **Keyboard Shortcuts**: Rapid keyboard-only operation
- **Gamification**: Motivational elements and celebrations
- **Performance Analytics**: Session efficiency metrics

#### API
```typescript
// Session control
startSession(taskIds: string[]): Promise<void>
pauseSession(): void
resumeSession(): void
endSession(): Promise<void>

// Task processing
processCurrentTask(categoryId: string): Promise<void>
skipCurrentTask(): Promise<void>
goBackTask(): Promise<void>

// Session state
const {
  isActive,
  isPaused,
  currentTask,
  progress,
  sessionStats
} = useQuickSort()

// Session configuration
configureSession(settings: QuickSortSettings): void
```

#### State Management
```typescript
interface QuickSortState {
  // Session state
  isActive: boolean
  isPaused: boolean
  currentTaskId: string | null

  // Progress tracking
  totalTasks: number
  processedTasks: number
  remainingTasks: number

  // Task queue
  taskQueue: string[]
  processedTaskIds: string[]
  skippedTaskIds: string[]

  // Performance metrics
  sessionStartTime: Date | null
  averageTimePerTask: number
  categoryStats: Map<string, number>
}
```

#### Keyboard Integration
```typescript
// Keyboard shortcuts
useKeyboardShortcuts({
  'Space': () => processCurrentTask('inbox'),
  '1': () => processCurrentTask('today'),
  '2': () => processCurrentTask('week'),
  '3': () => processCurrentTask('later'),
  'Escape': () => skipCurrentTask(),
  'Ctrl+Z': () => goBackTask()
})
```

---

### useUncategorizedTasks.ts - Uncategorized Task Filtering

**Purpose**: Consistent uncategorized task detection and filtering across all views
**Pattern**: Smart view filtering with backward compatibility

#### Core Features
- **Task Categorization**: Identifies uncategorized tasks using multiple criteria
- **Smart View Integration**: Works with "My Tasks" smart filter
- **Backward Compatibility**: Handles legacy project assignments
- **View Filtering**: Filters tasks for regular and smart views
- **State Management**: Integrates with task store and smart filter state

#### API
```typescript
// Task categorization
isTaskUncategorized(task: Task): boolean

// Task filtering
getUncategorizedTasks(tasks: Task[]): Task[]

// Smart view filtering
filterTasksBySmartView(tasks: Task[], activeSmartView: 'today' | 'week' | 'uncategorized' | null): Task[]

// View visibility logic
shouldShowUncategorizedInViews(activeSmartView: 'today' | 'week' | 'uncategorized' | null): boolean

// Regular view filtering
filterTasksForRegularViews(tasks: Task[], activeSmartView: 'today' | 'week' | 'uncategorized' | null): Task[]
```

#### Categorization Logic
```typescript
// Primary criteria: explicit uncategorized flag
if (task.isUncategorized === true) return true

// Backward compatibility: tasks without proper project assignment
if (!task.projectId || task.projectId === '' || task.projectId === null || task.projectId === '1') {
  return true
}
```

#### Usage Pattern
```typescript
// In views (BoardView, CalendarView, CanvasView, AllTasksView)
const { filterTasksForRegularViews } = useUncategorizedTasks()
const taskStore = useTaskStore()

const filteredTasks = computed(() => {
  const allTasks = taskStore.getAllTasks
  return filterTasksForRegularViews(allTasks, activeSmartView.value)
})
```

#### Integration Points
- **Task Store**: Smart filter state management
- **BoardView**: Kanban board task filtering
- **CalendarView**: Calendar task display
- **CanvasView**: Canvas task organization
- **AllTasksView**: Master task list filtering

---

### useHorizontalDragScroll.ts - Horizontal Scroll with Drag Physics

**Purpose**: Smooth horizontal scrolling with drag interactions and momentum physics
**Pattern**: Touch-enabled drag scrolling with conflict resolution

#### Core Features
- **Drag Scrolling**: Horizontal scrolling via mouse/touch drag
- **Momentum Physics**: Smooth momentum scrolling with friction
- **Conflict Resolution**: Smart detection of draggable elements
- **Touch Support**: Mobile device compatibility
- **Performance**: GPU-accelerated smooth scrolling
- **Accessibility**: Proper cursor and touch feedback

#### API
```typescript
// Composable setup
const {
  isDragging,
  isScrolling,
  scrollTo,
  scrollBy,
  scrollToElement
} = useHorizontalDragScroll(scrollContainer, options)

// Configuration options
interface HorizontalDragScrollOptions {
  threshold?: number        // Minimum drag distance (default: 10)
  sensitivity?: number      // Scroll multiplier (default: 1)
  friction?: number         // Momentum friction (default: 0.95)
  touchEnabled?: boolean    // Touch support (default: true)
  dragCursor?: string       // Drag cursor (default: 'grabbing')
  onDragStart?: () => void  // Drag start callback
  onDragEnd?: () => void    // Drag end callback
}
```

#### Smart Drag Detection
```typescript
// Detects draggable elements to prevent conflicts
const draggableSelectors = [
  '.draggable', '[data-draggable="true"]', '[draggable="true"]',
  '.task-card', '.inbox-task-card', '[data-inbox-task="true"]',
  '.vuedraggable', '.vue-flow__node', '.vue-flow__handle'
]

// Allows interactive elements within task cards
const interactiveSelectors = [
  'button', 'input', 'textarea', 'select', '[role="button"]',
  '.draggable-handle', '.status-icon-button', '.task-title',
  '.card-header', '.metadata-badges', '.card-actions'
]
```

#### Momentum Physics
```typescript
// Smooth momentum scrolling with configurable friction
const applyMomentum = () => {
  if (Math.abs(velocity.value) > 0.1) {
    scrollContainer.value.scrollLeft += velocity.value
    velocity.value *= friction // Apply friction
    requestAnimationFrame(applyMomentum)
  }
}
```

#### Usage Pattern
```typescript
// In Kanban board components
const scrollContainer = ref<HTMLElement>()

const { isDragging, isScrolling } = useHorizontalDragScroll(scrollContainer, {
  threshold: 10,
  sensitivity: 1.2,
  friction: 0.95,
  dragCursor: 'grabbing',
  onDragStart: () => console.log('Drag scroll started'),
  onDragEnd: () => console.log('Drag scroll ended')
})
```

#### Conflict Resolution
- **Task Cards**: Preserves existing drag-and-drop functionality
- **Vue Flow Canvas**: Allows canvas-specific interactions
- **Interactive Elements**: Maintains button/input functionality
- **Container Boundaries**: Respects scroll container limits
- **Touch Events**: Proper touch-action management

#### Integration Points
- **Kanban Board**: Horizontal scrolling for project swimlanes
- **Canvas View**: Smooth panning alongside Vue Flow interactions
- **Mobile Support**: Touch events with proper gesture handling
- **Performance**: GPU acceleration and event optimization

---

### useCalendarDragCreate.ts - Calendar Drag-and-Drop

**Purpose**: Drag-and-drop scheduling for calendar interface
**Pattern**: Visual drag management with ghost preview

#### Core Features
- **Drag Creation**: Create tasks by dragging on calendar
- **Time Slot Selection**: Precise time slot selection
- **Ghost Preview**: Visual feedback during drag operations
- **Resize Handling**: Adjust event duration by resizing
- **Multi-Day Events**: Support for multi-day task creation

#### API
```typescript
// Drag state management
const {
  isDragging,
  dragState,
  ghostEvent,
  startDrag,
  updateDrag,
  endDrag,
  cancelDrag
} = useCalendarDragCreate()

// Event creation
createEventFromDrag(dragState: DragState): Promise<TaskInstance>
resizeEvent(eventId: string, newDuration: number): Promise<void>

// Validation
validateTimeSlot(startTime: Date, endTime: Date): boolean
getConflictingEvents(startTime: Date, endTime: Date): TaskInstance[]
```

#### Drag State
```typescript
interface DragState {
  type: 'create' | 'move' | 'resize'
  startTime: Date
  endTime: Date
  startY: number
  endY: number
  targetDate: Date
  originalEvent?: TaskInstance
}
```

#### Visual Integration
```typescript
// Ghost event rendering
const ghostStyle = computed(() => {
  if (!ghostEvent.value) return {}

  return {
    top: `${calculateTopPosition(ghostEvent.value.startTime)}px`,
    height: `${calculateHeight(ghostEvent.value.duration)}px`,
    left: `${calculateLeftPosition(ghostEvent.value.date)}px`,
    width: '100%'
  }
})
```

---

### useDragAndDrop.ts - Generic Drag-and-Drop

**Purpose**: Reusable drag-and-drop functionality across components
**Pattern**: Flexible drag management with multiple drop targets

#### Core Features
- **Drag Source Management**: Configure draggable elements
- **Drop Target Registration**: Register drop zones
- **Drag Preview**: Custom drag preview/ghost
- **Transfer Data**: Pass data during drag operations
- **Multi-Type Support**: Handle different data types

#### API
```typescript
// Drag source
const { dragProps, isDragging } = useDragSource({
  type: 'task',
  data: computed(() => ({ taskId: task.id })),
  onDragStart: handleDragStart,
  onDragEnd: handleDragEnd
})

// Drop target
const { dropProps, isDragOver } = useDropTarget({
  acceptTypes: ['task'],
  onDrop: handleDrop,
  onDragOver: handleDragOver,
  onDragLeave: handleDragLeave
})

// Drag and drop context
const { registerDragSource, registerDropTarget, unregister } = useDragAndDrop()
```

#### Configuration Options
```typescript
interface DragSourceConfig {
  type: string                    // Data type identifier
  data: any | (() => any)         // Data to transfer
  preview?: Component            // Custom drag preview
  canDrag?: boolean | (() => boolean)
  onDragStart?: (event: DragEvent) => void
  onDragEnd?: (event: DragEvent) => void
}

interface DropTargetConfig {
  acceptTypes: string[]          // Accepted data types
  canDrop?: (data: any) => boolean
  onDrop: (data: any, event: DragEvent) => void
  onDragOver?: (event: DragEvent) => void
  onDragLeave?: (event: DragEvent) => void
}
```

---

### useTheme.ts - Theme Management

**Purpose**: Theme switching and visual preference management
**Pattern**: Reactive theme management with system integration

#### Core Features
- **Theme Switching**: Light/dark/system themes
- **System Integration**: Follow system preference
- **Custom Themes**: User-defined color schemes
- **Accessibility**: High contrast and reduced motion
- **Persistence**: Remember theme preferences

#### API
```typescript
// Theme management
const {
  currentTheme,
  isDarkMode,
  systemTheme,
  setTheme,
  toggleTheme,
  updateAccentColor
} = useTheme()

// Custom themes
createCustomTheme(name: string, colors: ThemeColors): void
applyCustomTheme(name: string): void
removeCustomTheme(name: string): void

// Accessibility
enableHighContrast(enabled: boolean): void
enableReducedMotion(enabled: boolean): void
```

#### Theme Configuration
```typescript
interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  error: string
  warning: string
  success: string
}
```

---

### useAuth.ts - Authentication Management

**Purpose**: User authentication and session management
**Pattern**: Reactive authentication state with OAuth integration

#### Core Features
- **User Authentication**: Login, logout, registration
- **OAuth Integration**: Google sign-in support
- **Session Management**: Token refresh and expiration
- **Profile Management**: User profile and preferences
- **Security**: Session timeout and activity tracking

#### API
```typescript
// Authentication operations
const {
  user,
  isAuthenticated,
  isLoading,
  login,
  logout,
  register,
  refreshSession
} = useAuth()

// OAuth
const signInWithGoogle = () => auth.signInWithGoogle()
const linkGoogleAccount = () => auth.linkGoogleAccount()

// Profile management
const updateProfile = (updates: Partial<User>) => auth.updateProfile(updates)
const changePassword = (oldPassword: string, newPassword: string) =>
  auth.changePassword(oldPassword, newPassword)
```

#### Session Management
```typescript
// Session monitoring
useSessionMonitor({
  onTimeout: () => logout(),
  onActivity: (lastActivity: Date) => refreshSession(),
  warningThreshold: 5 * 60 * 1000 // 5 minutes
})
```

---

## 3. Performance & UX Composables

### useVirtualList.ts - Virtual Scrolling

**Purpose**: Efficient rendering of large lists with virtual scrolling
**Pattern**: Performance optimization for large datasets

#### Core Features
- **Virtual Scrolling**: Only render visible items
- **Dynamic Item Heights**: Support for variable height items
- **Smooth Scrolling**: Smooth scroll to items
- **Performance**: Handles thousands of items efficiently
- **Accessibility**: Screen reader compatibility

#### API
```typescript
// Virtual list setup
const {
  containerProps,
  wrapperProps,
  items,
  scrollToItem,
  scrollToTop,
  scrollToBottom
} = useVirtualList({
  items: allItems,
  itemHeight: 48,
  containerHeight: 400,
  overscan: 5
})

// Dynamic heights
const {
  items,
  updateItemHeight,
  getTotalHeight
} = useVirtualList({
  items: allItems,
  getItemHeight: (index: number) => itemHeights[index],
  estimateHeight: 48,
  containerHeight: 400
})
```

#### Configuration Options
```typescript
interface VirtualListConfig {
  items: any[]                   // Data items
  itemHeight?: number           // Fixed item height
  getItemHeight?: (index: number) => number  // Dynamic height
  estimateHeight?: number       // Estimated height for dynamic items
  containerHeight: number       // Container height
  overscan?: number             // Extra items to render
  scrollElement?: HTMLElement   // Custom scroll element
}
```

---

### usePerformanceMonitor.ts - Performance Tracking

**Purpose**: Application performance monitoring and optimization
**Pattern**: Performance metrics collection and analysis

#### Core Features
- **Frame Rate Monitoring**: Track FPS and frame drops
- **Memory Usage**: Monitor memory consumption
- **Render Performance**: Component render time tracking
- **User Interaction**: Response time measurement
- **Performance Alerts**: Automatic performance warnings

#### API
```typescript
// Performance monitoring
const {
  fps,
  memoryUsage,
  renderTimes,
  startMonitoring,
  stopMonitoring,
  getPerformanceReport
} = usePerformanceMonitor()

// Render performance
const { measureRender } = useRenderPerformance()
const renderTime = measureRender(() => {
  // Component render logic
})

// Memory monitoring
const { checkMemoryUsage } = useMemoryMonitor()
const memoryInfo = checkMemoryUsage()
```

#### Performance Metrics
```typescript
interface PerformanceReport {
  fps: {
    current: number
    average: number
    min: number
    max: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  renders: {
    averageTime: number
    slowRenders: Array<{ component: string; time: number }>
  }
  interactions: {
    averageResponseTime: number
    slowInteractions: Array<{ action: string; time: number }>
  }
}
```

---

### useBrowserTab.ts - Browser Tab Management

**Purpose**: Browser tab visibility and synchronization
**Pattern**: Cross-tab communication and state management

#### Core Features
- **Tab Visibility**: Track tab visibility state
- **Cross-Tab Sync**: Synchronize state across tabs
- **Tab Naming**: Custom tab titles
- **Focus Management**: Handle tab focus/blur events
- **Resource Management**: Pause/resume based on tab state

#### API
```typescript
// Tab visibility
const { isVisible, isFocused } = useBrowserTab()

// Cross-tab synchronization
const { broadcast, receive, clear } = useTabBroadcast()

// Tab management
const setTabTitle = (title: string) => browserTab.setTitle(title)
const focusTab = () => browserTab.focus()

// Resource management
useTabVisibility({
  onVisible: () => resumeOperations(),
  onHidden: () => pauseOperations()
})
```

#### Cross-Tab Communication
```typescript
// Broadcast events
broadcast('task-updated', { taskId, updates })

// Receive events
receive('task-updated', (data) => {
  updateTaskInStore(data.taskId, data.updates)
})
```

---

### useKeyboardShortcuts.ts - Keyboard Shortcuts

**Purpose**: Global keyboard shortcut management
**Pattern**: Declarative keyboard event handling

#### Core Features
- **Global Shortcuts**: Application-wide keyboard shortcuts
- **Context-Aware**: Shortcuts that change based on context
- **Chord Support**: Multi-key combinations
- **Conflict Prevention**: Handle shortcut conflicts
- **Accessibility**: Screen reader compatibility

#### API
```typescript
// Keyboard shortcuts
const { register, unregister, trigger } = useKeyboardShortcuts()

// Register shortcuts
register('Ctrl+S', () => saveCurrentTask())
register('Ctrl+N', () => createNewTask())
register('Escape', () => cancelCurrentOperation())
register('Ctrl+Z', () => undo(), { scope: 'global' })
register('Space', () => playPauseTimer(), { scope: 'timer' })

// Context-aware shortcuts
useKeyboardShortcuts([
  { keys: 'Ctrl+Enter', action: submitForm, scope: 'form' },
  { keys: 'Ctrl+/', action: showHelp, scope: 'global' }
])
```

#### Configuration Options
```typescript
interface ShortcutConfig {
  keys: string                   // Key combination
  action: () => void            // Handler function
  scope?: string                // Context scope
  preventDefault?: boolean      // Prevent default behavior
  stopPropagation?: boolean     // Stop event propagation
  enabled?: boolean | (() => boolean)  // Conditional enabling
}
```

---

## 4. Utility Composables

### useDebounce.ts - Debounced Functions

**Purpose**: Debounce function calls for performance optimization
**Pattern**: Function debouncing with cancellation support

#### API
```typescript
// Debounced function
const debouncedSave = useDebounce((data: any) => {
  saveToDatabase(data)
}, 1000)

// Manual trigger and cancel
const { trigger, cancel, flush } = debouncedSave

// Reactive debounce
const debouncedValue = useDebounce(reactiveValue, 500)
```

---

### useThrottle.ts - Throttled Functions

**Purpose**: Throttle function calls for rate limiting
**Pattern**: Function throttling with immediate options

#### API
```typescript
// Throttled function
const throttledSearch = useThrottle((query: string) => {
  searchAPI(query)
}, 1000, { leading: true, trailing: true })

// Manual trigger
const { trigger, cancel } = throttledSearch
```

---

### useLocalStorage.ts - Local Storage Utilities

**Purpose**: Enhanced localStorage with type safety and reactivity
**Pattern**: Reactive localStorage with automatic sync

#### API
```typescript
// Reactive storage
const userPreferences = useLocalStorage('preferences', {
  theme: 'dark',
  language: 'en'
})

// Manual operations
const { set, get, remove, clear } = useLocalStorage()
await set('key', value)
const value = await get('key', defaultValue)
```

---

### useClickOutside.ts - Click Outside Detection

**Purpose**: Detect clicks outside of elements
**Pattern**: Event listener for outside click detection

#### API
```typescript
// Click outside detection
const targetRef = ref<HTMLElement>()
const { isOutside } = useClickOutside(targetRef)

// Callback on outside click
useClickOutside(targetRef, () => {
  closeDropdown()
})
```

---

### useIntersectionObserver.ts - Intersection Detection

**Purpose**: Detect element visibility and intersection
**Pattern**: Efficient visibility detection

#### API
```typescript
// Intersection observer
const targetRef = ref<HTMLElement>()
const { isIntersecting, entry } = useIntersectionObserver(targetRef, {
  threshold: 0.5
})

// Infinite scrolling
const { isIntersecting } = useIntersectionObserver(loadMoreTrigger, {
  threshold: 0.1,
  onIntersect: loadMoreItems
})
```

---

## Composable Patterns

### 1. Reactive State Pattern
```typescript
export function useComposable() {
  // Reactive state
  const state = ref(initialState)
  const computedValue = computed(() => state.value * 2)

  // Methods
  const updateState = (newValue: any) => {
    state.value = newValue
  }

  // Return reactive interface
  return {
    state: readonly(state),
    computedValue,
    updateState
  }
}
```

### 2. Lifecycle Management Pattern
```typescript
export function useComposable() {
  const state = ref(initialState)

  // Setup
  onMounted(() => {
    // Initialize
  })

  // Cleanup
  onUnmounted(() => {
    // Cleanup resources
  })

  return { state }
}
```

### 3. Provider/Injection Pattern
```typescript
// Provider
export function provideComposable() {
  const composable = useComposable()
  provide('composable-key', composable)
  return composable
}

// Consumer
export function useInjectedComposable() {
  const composable = inject('composable-key')
  if (!composable) throw new Error('Composable not provided')
  return composable
}
```

### 4. Async Composable Pattern
```typescript
export function useAsyncComposable() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const fetchData = async () => {
    loading.value = true
    error.value = null

    try {
      data.value = await apiCall()
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  return {
    data: readonly(data),
    loading: readonly(loading),
    error: readonly(error),
    fetchData
  }
}
```

## Best Practices

### 1. Composable Design
- **Single Responsibility**: Each composable has one clear purpose
- **Reactive Interface**: Return reactive refs and computed properties
- **Optional Dependencies**: Make dependencies optional and configurable
- **Cleanup Resources**: Proper cleanup in onUnmounted
- **Type Safety**: Full TypeScript support with proper typing

### 2. Performance Considerations
- **Lazy Evaluation**: Compute values only when needed
- **Efficient Dependencies**: Minimize reactive dependencies
- **Memory Management**: Proper cleanup of event listeners and timers
- **Batch Operations**: Batch multiple operations for efficiency

### 3. Error Handling
- **Graceful Degradation**: Handle errors gracefully
- **Error Boundaries**: Provide error recovery mechanisms
- **Validation**: Validate inputs and provide meaningful errors
- **Logging**: Log errors for debugging

### 4. Testing
- **Unit Testable**: Design composables for easy unit testing
- **Mock Dependencies**: Allow dependency injection for testing
- **Isolation**: Test composables in isolation
- **Integration Testing**: Test integration with components

## Usage Examples

### Component Integration
```typescript
<template>
  <div>
    <h1>{{ task.title }}</h1>
    <button @click="saveTask">Save</button>
    <button @click="undoTask">Undo</button>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/tasks'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

const props = defineProps<{ taskId: string }>()
const taskStore = useTaskStore()
const { saveState, undo } = useUnifiedUndoRedo()

const task = computed(() => taskStore.getTask(props.taskId))

const saveTask = () => {
  saveState(`Save task ${props.taskId}`)
  taskStore.updateTask(props.taskId, task.value)
}

const undoTask = () => {
  undo()
}
</script>
```

### Cross-Composable Integration
```typescript
export function useTaskManager() {
  const taskStore = useTaskStore()
  const { saveState } = useUnifiedUndoRedo()
  const db = useDatabase()

  const createTask = async (taskData: Partial<Task>) => {
    saveState('Create task')

    const task = taskStore.createTask(taskData)
    await db.save(`task-${task.id}`, task)

    return task
  }

  return { createTask }
}
```

This comprehensive composable architecture provides reusable, testable, and efficient functionality across the Pomo-Flow application, following Vue 3 best practices and patterns.

**Last Updated**: November 2, 2025
**Architecture Version**: Vue 3.4.0, Composition API
**Recent Additions**: useUncategorizedTasks.ts (task filtering), useHorizontalDragScroll.ts (drag physics)