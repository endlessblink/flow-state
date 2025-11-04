# Pomo-Flow Architecture Reference

## Overview

This consolidated architecture reference combines project structure overview, state management ecosystem, store architecture, and development patterns into a comprehensive guide for understanding and working with the Pomo-Flow Vue.js productivity application.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Technology Stack](#technology-stack)
- [Project Architecture](#project-architecture)
- [State Management Ecosystem](#state-management-ecosystem)
- [Store Architecture](#store-architecture)
- [Development Patterns](#development-patterns)
- [Performance Architecture](#performance-architecture)
- [Critical Architecture Decisions](#critical-architecture-decisions)

---

## Executive Summary

**Pomo-Flow** is a sophisticated Vue 3 productivity application that combines Pomodoro timer functionality with advanced task management across multiple specialized views. This application demonstrates enterprise-level Vue.js architecture with comprehensive state management, visual task organization, and thoughtful performance optimizations.

### Project Statistics

- **Total Files**: 200+ source files
- **Vue Components**: 83 components
- **TypeScript/JavaScript Files**: 113 files
- **Main Views**: 8 specialized views
- **Pinia Stores**: 11 stores (5 task ecosystem + 6 feature stores)
- **Composables**: 25+ reusable composables

### Store Complexity
- **Largest Store**: `tasks.ts` (1,786 lines) - Central task management
- **Second Largest**: `canvas.ts` (974 lines) - Canvas state and Vue Flow
- **Third Largest**: `timer.ts` (539 lines) - Pomodoro functionality

### Development Ports
- **Main Application**: `http://localhost:5546`
- **Storybook**: `http://localhost:6006`
- **Alternative Design System**: `http://localhost:6008`

---

## Technology Stack

### Core Framework
- **Vue 3.4.0** with Composition API and `<script setup>` syntax
- **TypeScript 5.9.3** for full type safety
- **Vite 7.1.10** for fast development and optimized builds
- **Pinia** for centralized state management

### UI & Styling
- **Tailwind CSS** with extensive custom configuration (514 lines)
- **Naive UI** component library with dark theme integration
- **Glass morphism** design system with CSS custom properties
- **Lucide Vue Next** for consistent iconography

### Canvas & Visualization
- **Vue Flow** (@vue-flow/core) for node-based canvas interactions
- **Konva** and vue-konva for advanced canvas rendering
- **Vuedraggable** for drag-and-drop functionality

### Data & Storage
- **IndexedDB** via LocalForage for client-side persistence
- **YJS** for collaborative editing capabilities
- **WebSocket** integration for real-time features

### Development Tools
- **Vitest** for unit testing
- **Playwright** for end-to-end testing
- **ESLint** with TypeScript support

---

## Project Architecture

### Multi-View SPA Architecture

The application uses a single-page application pattern with 8 specialized views:

#### 1. BoardView.vue - Kanban Board
- Project-based swimlanes with horizontal lanes
- Status-based columns (planned → in_progress → done)
- Drag-and-drop task movement between columns and swimlanes
- Advanced filtering and bulk operations

#### 2. CalendarView.vue - Time-Based Scheduling
- Day, week, and month calendar views
- Drag-and-drop task scheduling
- Ghost preview during drag operations
- Task resizing with independent handles
- Calendar inbox for unscheduled tasks

#### 3. CanvasView.vue - Visual Task Organization
- Free-form visual organization using Vue Flow
- Node-based layout with drag-and-drop positioning
- Section management (priority, status, project-based)
- Task connections for dependency visualization
- Multi-selection tools (rectangle and lasso)

#### 4. AllTasksView.vue - Master Task List
- List and table display modes
- Advanced sorting and multi-criteria filtering
- Batch operations with multi-select
- Task hierarchy with parent-child relationships
- Virtual scrolling for large datasets

#### 5. QuickSortView.vue - Rapid Task Categorization
- Gamified rapid task sorting interface
- Session-based processing with progress tracking
- Keyboard shortcuts for power users
- Category learning and statistics tracking
- Celebration effects for completion

#### 6. FocusView.vue - Deep Work Sessions
- Minimal interface for focused work sessions
- Built-in Pomodoro timer integration
- Single task focus mode
- Break reminders and distraction blocking
- Session progress tracking

#### 7. CalendarViewVueCal.vue - Alternative Calendar
- VueCal library integration
- Different interaction model from main calendar
- Event management and view switching
- Alternative user experience option

### Component Architecture Patterns

#### Component Hierarchy
```
App.vue (Root Component)
├── RouterView
├── GlobalComponents (Teleported)
│   ├── BaseModal.vue
│   ├── TaskEditModal.vue
│   ├── ProjectModal.vue
│   ├── AuthModal.vue
│   └── ConfirmationModal.vue
├── Sidebar Components
│   ├── Sidebar.vue (Main Navigation)
│   └── RightSidebar.vue (Contextual Information)
└── View Components
    ├── BoardView.vue (Kanban Board)
    ├── CalendarView.vue (Calendar Scheduling)
    ├── CanvasView.vue (Visual Canvas)
    ├── AllTasksView.vue (Task List/Table)
    ├── QuickSortView.vue (Rapid Sorting)
    └── FocusView.vue (Focus Mode)
```

#### Component Categories

**Base Components (6)**
- `BaseButton.vue`, `BaseInput.vue`, `BaseCard.vue`
- `BaseBadge.vue`, `BaseIconButton.vue`, `BaseNavItem.vue`

**UI Components (9)**
- `TimeDisplay.vue`, `DensityController.vue`, `CustomSelect.vue`
- `ProjectTreeItem.vue`, `TaskManagerSidebar.vue`, `ProjectDropZone.vue`
- `EmojiPicker.vue`, `CommandPalette.vue`, `ErrorBoundary.vue`

**Board Components (3)**
- `KanbanColumn.vue`, `TaskCard.vue`, `KanbanSwimlane.vue`

**Canvas Components (9)**
- `TaskNode.vue`, `CanvasSection.vue`, `InboxPanel.vue`
- `SectionManager.vue`, `SectionNodeSimple.vue`, `MultiSelectionOverlay.vue`
- `CanvasContextMenu.vue`, `EdgeContextMenu.vue`, `InboxContextMenu.vue`

**Modal Components (9)**
- `QuickTaskCreate.vue`, `TaskEditModal.vue`, `TaskContextMenu.vue`
- `ContextMenu.vue`, `ProjectModal.vue`, `SettingsModal.vue`
- `SearchModal.vue`, `ConfirmationModal.vue`

### File Organization

```
src/
├── components/         # Reusable UI components
│   ├── base/          # Base components (Button, Modal, etc.)
│   ├── board/         # Kanban board components
│   ├── calendar/      # Calendar-specific components
│   ├── canvas/        # Canvas visualization components
│   ├── modals/        # Modal dialogs
│   ├── popups/        # Context menus and tooltips
│   └── right-click-menus/ # Context menu components
├── stores/            # Pinia state management
├── composables/       # Vue 3 composables
├── views/             # Main application views
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── assets/            # Static assets and styles
```

---

## State Management Ecosystem

### Store Architecture Summary

Pomo-Flow implements a sophisticated, modular Pinia state management architecture with **11 stores** that handle different aspects of the productivity application.

#### **Task Management Ecosystem** (5 stores)

| Store | Purpose | Lines | Status | Persistence |
|-------|---------|-------|--------|-------------|
| **tasks.ts** | Legacy monolithic task store | 1,786 | Legacy | IndexedDB |
| **tasks-new.ts** | Modern modular orchestrator | 447 | ✅ Current | IndexedDB |
| **taskCore.ts** | Basic CRUD operations | 285 | ✅ Current | IndexedDB |
| **taskScheduler.ts** | Calendar & scheduling | 360 | ✅ Current | IndexedDB |
| **taskCanvas.ts** | Canvas operations | 492 | ✅ Current | IndexedDB |

#### **Feature Stores** (6 stores)

| Store | Purpose | Lines | Persistence |
|-------|---------|-------|-------------|
| **timer.ts** | Pomodoro timer sessions | 539 | localStorage |
| **canvas.ts** | Canvas UI & Vue Flow | 981 | IndexedDB |
| **ui.ts** | Global UI state | 151 | localStorage |
| **auth.ts** | Authentication | 508 | Firestore + localStorage |
| **theme.ts** | Theme management | 139 | localStorage |
| **quickSort.ts** | Task categorization | 212 | localStorage |

### Task Management Ecosystem

#### tasks-new.ts - Modern Modular Orchestrator
**Purpose**: Unified interface for modern task management architecture
**Architecture**: Composes modular stores with backward compatibility

**Key Getters**:
- `allTasks` - Combined task list from all stores
- `tasksByStatus` - Tasks grouped by status
- `tasksByProject` - Tasks grouped by project
- `todayTasks` - Smart today view combining multiple criteria
- `overdueTasks` - Overdue task detection
- `activeTasks` - Non-completed tasks
- `completedTasks` - Completed tasks
- `projectsWithCounts` - Projects with task counts

**Key Actions**:
- `createTask(taskData)` - Unified task creation
- `updateTask(id, updates)` - Unified task updates
- `deleteTask(id)` - Unified task deletion
- `bulkUpdateTasks(updates)` - Batch operations
- `createProject(projectData)` - Project management
- `updateViewport(viewport)` - Canvas viewport control
- `setSelectedDate(date)` - Calendar navigation
- `addTaskInstance(taskId, instance)` - Calendar instances

#### taskCore.ts - Basic CRUD Operations
**Purpose**: Fundamental task and project data management

**Core Actions**:
- `createTask(taskData)` - Create new task
- `updateTask(id, updates)` - Update existing task
- `deleteTask(id)` - Delete task
- `createProject(projectData)` - Create project
- `updateProject(id, updates)` - Update project
- `deleteProject(id)` - Delete project
- `searchTasks(query)` - Full-text search
- `getTaskById(id)` - Task lookup
- `getProjectById(id)` - Project lookup

#### taskScheduler.ts - Calendar & Scheduling
**Purpose**: Task scheduling, calendar management, and smart views

**Smart Views (Computed)**:
- `todayTasks` - Tasks scheduled for today
- `weekTasks` - Tasks for current week
- `overdueTasks` - Overdue task detection
- `upcomingTasks` - Future scheduled tasks
- `laterTasks` - Tasks without dates
- `tasksByDate` - Tasks grouped by date
- `instanceMap` - Task instance lookup

**Key Actions**:
- `setSelectedDate(date)` - Calendar navigation
- `setCalendarView(view)` - View mode switching
- `addTaskInstance(taskId, instance)` - Create calendar instance
- `removeTaskInstance(instanceId)` - Remove instance
- `updateTaskInstance(instanceId, updates)` - Update instance
- `navigateToToday()` - Jump to today
- `navigateToDate(date)` - Jump to specific date
- `getTasksInDateRange(start, end)` - Date range filtering

#### taskCanvas.ts - Canvas Operations
**Purpose**: Canvas-specific task positioning and section management

**Section Types**:
- **Priority Sections**: Auto-collect tasks by priority level
- **Status Sections**: Auto-collect by completion status
- **Project Sections**: Auto-collect by project assignment
- **Custom Sections**: Manual organization with filters

**Key Actions**:
- `createSection(sectionData)` - Create canvas section
- `updateSection(id, updates)` - Update section
- `deleteSection(id)` - Delete section
- `setSelectedTasks(ids)` - Selection management
- `updateViewport(viewport)` - Viewport control
- `startMultiSelection()` - Enable multi-select
- `endMultiSelection()` - Disable multi-select
- `selectInRectangle(rect)` - Rectangle selection
- `getTasksInSection(sectionId)` - Section filtering

### Feature Stores

#### timer.ts - Pomodoro Timer (539 lines)
**Purpose**: Pomodoro timer sessions and configuration

**Timer Settings**:
```typescript
interface TimerSettings {
  workDuration: number // minutes
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  autoStartBreaks: boolean
  autoStartWork: boolean
  soundEnabled: boolean
  desktopNotifications: boolean
  taskSpecificSessions: boolean
}
```

**Key Actions**:
- `startSession(taskId?, type?)` - Start new session
- `pauseSession()` - Pause current session
- `resumeSession()` - Resume paused session
- `completeSession()` - Complete current session
- `skipSession()` - Skip current session
- `resetTimer()` - Reset timer
- `updateSettings(settings)` - Update timer settings
- `clearSessionHistory()` - Clear history

#### canvas.ts - Canvas UI & Vue Flow (981 lines)
**Purpose**: Canvas layout, interactions, and Vue Flow integration

**Key Computed**:
- `visibleNodes` - Nodes in current viewport
- `selectedNodes` - Selected task nodes
- `connections` - Task dependency connections
- `canvasBounds` - Canvas boundary calculations
- `zoomLevel` - Current zoom percentage
- `isConnectMode` - Connection mode status

**Key Actions**:
- `updateViewport(viewport)` - Update canvas position/zoom
- `setSelectedNodes(ids)` - Node selection
- `toggleConnectMode()` - Connection mode toggle
- `startDragging(dragState)` - Begin drag operation
- `updateDragging(position)` - Update drag position
- `endDragging()` - End drag operation
- `createConnection(from, to)` - Create task connection
- `deleteConnection(connectionId)` - Remove connection
- `fitToScreen()` - Auto-zoom to fit all content
- `centerView()` - Center canvas view

#### ui.ts - Global UI State (151 lines)
**Purpose**: Global UI state, modal management, and user preferences

**Key Computed**:
- `isDesktop` - Desktop device detection
- `isTablet` - Tablet device detection
- `sidebarState` - Combined sidebar state
- `anyModalOpen` - Any modal active
- `viewportClasses` - Responsive CSS classes

**Key Actions**:
- `toggleMainSidebar()` - Toggle main sidebar
- `toggleSecondarySidebar()` - Toggle secondary sidebar
- `setFocusMode(enabled)` - Focus mode toggle
- `setBoardDensity(density)` - Board density setting
- `openAuthModal()` - Open auth modal
- `closeAuthModal()` - Close auth modal
- `openSettingsModal()` - Open settings modal
- `closeSettingsModal()` - Close settings modal
- `addNotification(notification)` - Add notification
- `removeNotification(id)` - Remove notification
- `updateScreenSize()` - Update responsive state

#### auth.ts - Authentication (508 lines)
**Purpose**: Firebase authentication and user profile management

**Key Actions**:
- `signIn(email, password)` - Email/password sign in
- `signUp(email, password, name)` - Email/password sign up
- `signOut()` - Sign out
- `signInWithGoogle()` - Google OAuth sign in
- `updateProfile(updates)` - Update user profile
- `resetPassword(email)` - Password reset
- `updatePreferences(preferences)` - Update preferences
- `refreshUser()` - Refresh user data

#### theme.ts - Theme Management (139 lines)
**Purpose**: CSS theme management and design token system

**Key Actions**:
- `setTheme(themeId)` - Set active theme
- `toggleDarkMode()` - Toggle dark/light mode
- `createCustomTheme(theme)` - Create custom theme
- `updateCustomTheme(id, updates)` - Update custom theme
- `deleteCustomTheme(id)` - Delete custom theme
- `resetToDefault()` - Reset to default theme
- `detectSystemTheme()` - Detect system preference

#### quickSort.ts - Task Categorization (212 lines)
**Purpose**: Task categorization session management and gamification

**Key Actions**:
- `startSession(taskIds)` - Start categorization session
- `pauseSession()` - Pause session
- `resumeSession()` - Resume session
- `endSession()` - End session
- `categorizeTask(categoryId)` - Categorize current task
- `skipTask()` - Skip current task
- `undoAction()` - Undo last action
- `redoAction()` - Redo undone action
- `clearHistory()` - Clear action history

### Store Integration Patterns

#### Cross-Store Communication

**Task Store Integration**
- Direct store access in all views
- Task components connect via props and computed properties
- Real-time updates through store reactivity

**Canvas Store Integration**
- Canvas-specific components only
- Vue Flow integration for position management
- Section state managed centrally

**UI Store Integration**
- Global UI state (theme, sidebar, modals)
- View-specific preferences
- Responsive state management

**Timer Store Integration**
- Timer components and focus mode
- Session tracking and notifications
- Task-specific timer sessions

#### Data Flow Patterns

**Component-Store Relationships**
- **High-Impact Components**: App.vue, BoardView.vue, CalendarView.vue, CanvasView.vue, FocusView.vue
- **Task Management Components**: TaskManagerSidebar.vue, TaskList.vue, TaskEditModal.vue
- **Canvas Components**: InboxPanel.vue, TaskNode.vue, CanvasSection.vue
- **Timer Components**: SessionControls.vue, TimerDisplay.vue, PomodoroTimer.vue
- **Authentication Components**: AuthModal.vue, LoginForm.vue, SignupForm.vue
- **UI Components**: SettingsModal.vue, SearchModal.vue, ThemeToggle.vue

#### Store-to-Store Dependencies

**Direct Dependencies**:
```
tasks-new.ts → taskCore.ts (base operations)
tasks-new.ts → taskScheduler.ts (calendar features)
tasks-new.ts → taskCanvas.ts (canvas operations)
timer.ts → tasks.ts (task updates on completion)
canvas.ts → tasks.ts (task filtering and data)
auth.ts → ui.ts (modal management)
taskScheduler.ts → taskCore.ts (task data)
taskCanvas.ts → taskCore.ts (task data)
```

---

## Store Architecture

### 1. Tasks Store (tasks.ts) - Central Task Management

**File Size**: 1,786 lines (largest store)
**Primary Role**: Central hub for all task-related operations and data management

#### Task Instance System
- **Flexible Scheduling**: Tasks can have multiple calendar instances
- **Backward Compatibility**: Legacy `scheduledDate`/`scheduledTime` fields still supported
- **Instance-Specific Tracking**: Separate pomodoro tracking per instance
- **"Later" Instances**: Indefinite scheduling capability

#### Hierarchical Task Management
- **Parent-Child Relationships**: Tasks can have subtasks
- **Project Nesting**: Projects can contain sub-projects
- **Dependency Management**: Tasks can depend on other tasks
- **Progress Rollup**: Parent task progress calculated from children

#### Smart Views & Filtering
- **Today View**: Automatically filters tasks for today
- **Weekend View**: Tasks scheduled for weekend
- **Status Filtering**: Hide/show completed tasks
- **Project Filtering**: Filter by specific projects
- **Priority Filtering**: Filter by priority levels

**Enhanced Smart Views (November 2025)**:
- **above_my_tasks Smart View**: Filters tasks above current task in hierarchy
  - Integrates with parent-child task relationships
  - Provides focused task organization for complex projects
  - Maintains context within task hierarchy

- **Uncategorized Tasks ("My Tasks") Smart Filter**:
  - Primary check: `task.isUncategorized === true`
  - Fallback logic: Invalid or missing project assignments
  - Legacy support: projectId === '1' or empty string handling
  - Canvas integration: Respects canvas positioning and inbox status

- **Smart View Counter Consistency System**:
  - Real-time counter updates across all views
  - Synchronizes display count with filtered results
  - Prevents counter/display mismatch errors
  - Cross-view state synchronization

- **Dynamic State Persistence**:
  - Smart view selection saved to UI Store
  - Debounced persistence (1000ms) to IndexedDB
  - Cross-session recovery of filter preferences
  - Consistent UX maintained across application restarts

#### Core Actions
```typescript
// Create task with undo support
createTask(taskData: Partial<Task>): Promise<Task>

// Update task with undo support
updateTask(taskId: string, updates: Partial<Task>): Promise<void>

// Delete task with undo support
deleteTask(taskId: string): Promise<void>

// Batch operations
batchUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<void>
```

#### Persistence Strategy
- **IndexedDB Primary**: LocalForage for reliable storage
- **Debounced Saves**: 1-second delay prevents excessive writes
- **Automatic Migration**: Schema changes handled gracefully
- **Error Recovery**: Graceful fallback on storage failures

### 2. Canvas Store (canvas.ts) - Visual Canvas Management

**File Size**: 974 lines (second-largest store)
**Primary Role**: Canvas state management and Vue Flow integration

#### Section Management System
- **Priority Sections**: Auto-collect tasks by priority level
- **Status Sections**: Auto-collect by completion status
- **Project Sections**: Auto-collect by project assignment
- **Custom Sections**: Manual organization with filters

#### Vue Flow Integration
- **Node Management**: Individual task representations and section containers
- **Connection Points**: Handles for task dependencies
- **Viewport Controls**: Pan navigation and zoom controls
- **Multi-Selection**: Rectangle and lasso selection tools

#### Core Actions
```typescript
// Create section
createSection(sectionData: Partial<CanvasSection>): Promise<CanvasSection>

// Update section
updateSection(sectionId: string, updates: Partial<CanvasSection>): Promise<void>

// Update task position
updateTaskPosition(taskId: string, position: { x: number, y: number }): Promise<void>

// Create connection
createConnection(fromTaskId: string, toTaskId: string, type?: string): Promise<TaskConnection>
```

### 3. Timer Store (timer.ts) - Pomodoro Timer

**File Size**: 539 lines
**Primary Role**: Pomodoro timer functionality and session management

#### Session Management
- **Work/Break Cycles**: Automatic session type switching
- **Task Association**: Timer sessions linked to specific tasks
- **Progress Tracking**: Completed sessions per task
- **Session History**: Detailed session logs
- **Daily Statistics**: Today's productivity metrics

#### Core Actions
```typescript
// Start timer
startTimer(taskId?: string): Promise<void>

// Pause timer
pauseTimer(): Promise<void>

// Resume timer
resumeTimer(): Promise<void>

// Complete current session
completeSession(): Promise<void>
```

### 4. UI Store (ui.ts) - Application UI State

**File Size**: ~200 lines
**Primary Role**: Global UI state management and user preferences

#### UI Management Features
- **View Management**: Active view tracking and navigation history
- **Modal Management**: Modal stack and active modal tracking
- **Responsive Design**: Breakpoint detection and responsive state
- **Settings Management**: User preferences and visual settings

#### Core Actions
```typescript
// Set active view
setActiveView(view: string): void

// Toggle main sidebar
toggleSidebar(): void

// Open modal
openModal(modalId: string, props?: any): void

// Update board settings
updateBoardSettings(settings: Partial<BoardSettings>): void
```

---

## Development Patterns

### Core Development Philosophy

#### 1. Composition over Inheritance
- **Prefer composables** over mixins for reusable logic
- **Component composition** for building complex UIs
- **Functional patterns** for pure, testable code

#### 2. Type Safety First
- **Strict TypeScript** configuration
- **Comprehensive type definitions** for all data structures
- **Compile-time error checking** over runtime validation

#### 3. Reactive Programming
- **Reactive state management** with Pinia stores
- **Computed properties** for derived state
- **Watch patterns** for side effects

#### 4. Performance Conscious
- **Virtual scrolling** for large datasets
- **Lazy loading** for components and data
- **Memoization** for expensive computations

### Vue 3 Patterns

#### Component Definition Pattern
```typescript
// Standard component structure
<script setup lang="ts">
// 1. Imports at top
import { ref, computed, onMounted, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

// 2. Props definition with TypeScript
interface Props {
  taskId: string
  variant?: 'default' | 'compact'
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  readonly: false
})

// 3. Emits definition
interface Emits {
  update: [task: Task]
  delete: [taskId: string]
  statusChange: [taskId: string, status: TaskStatus]
}

const emit = defineEmits<Emits>()

// 4. Store and composable usage
const taskStore = useTaskStore()
const { saveState, undo } = useUnifiedUndoRedo()

// 5. Reactive state
const isLoading = ref(false)
const localTask = ref<Task | null>(null)

// 6. Computed properties
const task = computed(() => taskStore.getTask(props.taskId))
const canEdit = computed(() => !props.readonly && !isLoading.value)

// 7. Methods
const handleStatusChange = async (newStatus: TaskStatus) => {
  if (!task.value || !canEdit.value) return

  isLoading.value = true
  saveState(`Change status to ${newStatus}`)

  try {
    await taskStore.updateTask(task.value.id, { status: newStatus })
    emit('statusChange', task.value.id, newStatus)
  } catch (error) {
    console.error('Failed to update task:', error)
  } finally {
    isLoading.value = false
  }
}

// 8. Lifecycle hooks
onMounted(() => {
  // Initialize component
  if (task.value) {
    localTask.value = { ...task.value }
  }
})
</script>
```

#### Composable Pattern
```typescript
export function useTaskManager(taskId: Ref<string> | string) {
  // 1. State management
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const task = ref<Task | null>(null)

  // 2. Computed properties
  const isValidTask = computed(() => task.value && task.value.title.trim() !== '')
  const isCompleted = computed(() => task.value?.status === 'done')

  // 3. Methods
  const loadTask = async (id: string) => {
    if (!id) return

    isLoading.value = true
    error.value = null

    try {
      const taskStore = useTaskStore()
      task.value = taskStore.getTask(id) || null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load task'
    } finally {
      isLoading.value = false
    }
  }

  const updateTask = async (updates: Partial<Task>) => {
    if (!task.value || !isValidTask.value) return

    isLoading.value = true
    error.value = null

    try {
      const taskStore = useTaskStore()
      await taskStore.updateTask(task.value.id, updates)
      task.value = { ...task.value, ...updates }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update task'
    } finally {
      isLoading.value = false
    }
  }

  // 4. Return reactive interface
  return {
    task: readonly(task),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isValidTask,
    isCompleted,
    updateTask,
    reloadTask: () => loadTask(typeof taskId === 'string' ? taskId : taskId.value)
  }
}
```

#### Store Pattern
```typescript
export const useTaskStore = defineStore('tasks', () => {
  // 1. State
  const tasks = ref<Task[]>([])
  const projects = ref<Project[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 2. Getters (computed properties)
  const activeTasks = computed(() =>
    tasks.value.filter(task => task.status !== 'done')
  )

  const tasksByStatus = computed(() => {
    const grouped = activeTasks.value.reduce((acc, task) => {
      if (!acc[task.status]) {
        acc[task.status] = []
      }
      acc[task.status].push(task)
      return acc
    }, {} as Record<TaskStatus, Task[]>)
    return grouped
  })

  // 3. Actions
  const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    const task: Task = {
      id: generateId(),
      title: taskData.title || '',
      status: 'planned',
      priority: taskData.priority || null,
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: taskData.dueDate || '',
      projectId: taskData.projectId || 'default',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    tasks.value.push(task)
    await saveTasks()
    return task
  }

  // 4. Return store interface
  return {
    tasks: readonly(tasks),
    projects: readonly(projects),
    isLoading: readonly(isLoading),
    error: readonly(error),
    activeTasks,
    tasksByStatus,
    createTask
  }
})
```

### TypeScript Patterns

#### Type Definition Pattern
```typescript
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority | null
  progress: number // 0-100
  completedPomodoros: number
  subtasks: Subtask[]
  dueDate: string // ISO string
  instances: TaskInstance[]
  projectId: string
  parentTaskId?: string | null
  createdAt: Date
  updatedAt: Date
  canvasPosition?: Position
  isInInbox?: boolean
  dependsOn?: string[]
  tags: string[]
  estimatedTime?: number // minutes
  actualTime?: number // minutes
}

export type TaskStatus = 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
export type TaskPriority = 'low' | 'medium' | 'high' | null

// Union types for better type safety
export type ViewMode = 'board' | 'calendar' | 'canvas' | 'all-tasks' | 'quick-sort' | 'focus'
export type ThemeMode = 'light' | 'dark' | 'system'

// Discriminated unions
export type SyncOperation =
  | { type: 'create'; entity: 'task' | 'project' | 'section'; data: any }
  | { type: 'update'; entity: 'task' | 'project' | 'section'; id: string; data: any }
  | { type: 'delete'; entity: 'task' | 'project' | 'section'; id: string }
```

### Performance Patterns

#### Virtual Scrolling Pattern
```typescript
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[]
  itemHeight: number | ((index: number) => number)
  containerHeight: number
  overscan?: number
}) {
  const scrollTop = ref(0)
  const containerRef = ref<HTMLElement>()

  // Calculate visible range
  const visibleRange = computed(() => {
    const getItemHeight = (index: number) =>
      typeof itemHeight === 'function' ? itemHeight(index) : itemHeight

    let start = 0
    let end = 0
    let accumulatedHeight = 0

    // Find start index
    for (let i = 0; i < items.length; i++) {
      if (accumulatedHeight + getItemHeight(i) > scrollTop.value) {
        start = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += getItemHeight(i)
    }

    // Find end index
    accumulatedHeight = 0
    for (let i = start; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i)
      if (accumulatedHeight > containerHeight + overscan * getItemHeight(i)) {
        end = Math.min(items.length, i + overscan)
        break
      }
    }

    if (end === 0) end = Math.min(items.length, start + 20) // Fallback

    return { start, end }
  })

  // Visible items
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return items.slice(start, end).map((item, index) => ({
      item,
      index: start + index
    }))
  })

  return {
    containerRef,
    visibleItems,
    totalHeight: computed(() => items.length * (typeof itemHeight === 'number' ? itemHeight : 50))
  }
}
```

### Error Handling Patterns

#### Error Boundary Pattern
```typescript
export function useErrorBoundary() {
  const error = ref<Error | null>(null)
  const errorInfo = ref<string>('')

  const captureError = (err: Error, info?: string) => {
    error.value = err
    errorInfo.value = info || ''

    // Log to external service
    logError(err, info)

    // Show user-friendly message
    showErrorNotification('Something went wrong. Please try again.')
  }

  const resetError = () => {
    error.value = null
    errorInfo.value = ''
  }

  const handleError = async (operation: () => Promise<void>) => {
    try {
      await operation()
    } catch (err) {
      captureError(err instanceof Error ? err : new Error('Unknown error'))
    }
  }

  return {
    error: readonly(error),
    errorInfo: readonly(errorInfo),
    captureError,
    resetError,
    handleError
  }
}
```

---

## Performance Architecture

### Performance Optimizations

#### 1. Virtual Scrolling
- **AllTasksView**: Large task lists with `useVirtualList`
- **CalendarView**: Many time slots with virtual scrolling
- **CanvasView**: Many nodes with viewport culling

#### 2. Lazy Loading
- **Component Definition**: Async component loading
- **Data Loading**: On-demand data fetching
- **Image Loading**: Lazy image loading

#### 3. Memoization
- **Computed Properties**: Cached calculations
- **Expensive Operations**: Memoized results
- **Render Functions**: Optimized rendering

#### 4. Debounced Operations
- **Database Saves**: 1-second delay prevents excessive writes
- **Search Operations**: Debounced search input
- **UI Updates**: Batched DOM updates

### Component Optimization

#### Shallow Prop Watching
```typescript
// Watch only specific properties for performance
watch(() => props.task.id, (newId) => {
  if (newId) {
    loadTask(newId)
  }
}, { immediate: true })
```

#### Event Handler Optimization
```typescript
// Event delegation for multiple items
const handleTaskAction = (event: Event) => {
  const target = event.target as HTMLElement
  const taskId = target.dataset.taskId

  if (taskId) {
    // Handle action for specific task
  }
}
```

#### Render Condition Optimization
```typescript
// Smart conditional rendering
const shouldShowComponent = computed(() => {
  return props.task && props.task.title && !isLoading.value
})
```

### Memory Management

#### Cleanup Patterns
```typescript
onUnmounted(() => {
  // Cleanup event listeners
  window.removeEventListener('resize', handleResize)

  // Cleanup timers
  if (timerId.value) {
    clearTimeout(timerId.value)
  }

  // Cleanup subscriptions
  unsubscribe()
})
```

#### Garbage Collection
```typescript
// Clear references to prevent memory leaks
const clearState = () => {
  tasks.value = []
  selectedTasks.value = []
  filters.value = {}
}
```

---

## Critical Architecture Decisions

### 1. Unified Undo/Redo System

**Implementation**: Singleton pattern in `useUnifiedUndoRedo.ts`
**Scope**: Task operations, canvas moves, section management
**Features**:
- 50-entry capacity with deep cloning
- Visual restoration is the only metric that matters
- JSON serialization for persistence
- State tracking across multiple stores

### 2. Task Instance System

**Flexible Scheduling**: Tasks can have multiple calendar instances
**Backward Compatibility**: Legacy date fields still supported
**Instance-Specific Tracking**: Separate pomodoro tracking per instance
**Migration Strategy**: Smooth migration from legacy to new system

### 3. Canvas Architecture

**Vue Flow Integration**: Node-based organization with drag-and-drop
**Section Management**: Auto-collection rules and manual organization
**Task Connections**: Visual dependency management
**Multi-Selection**: Rectangle and lasso selection tools

### 4. Data Persistence Strategy

**Multi-Layer Approach**:
- **IndexedDB Primary**: LocalForage for all stores
- **Store-Specific Collections**: Separate storage per store
- **Debounced Writes**: Prevent excessive database operations
- **Error Recovery**: Handle sync failures gracefully

### 5. Modular Store Architecture

**Evolution from Monolithic**: Migration from single `tasks.ts` to modular ecosystem
**Backward Compatibility**: Maintain existing interfaces during transition
**Performance Benefits**: Smaller, focused bundles with better tree-shaking
**Developer Experience**: Clear separation of concerns and easier testing

---

## Architecture Best Practices Demonstrated

### 1. Single Responsibility
Each store has a clear, focused purpose with well-defined boundaries.

### 2. Composition over Inheritance
Modular stores composed into unified interfaces using composables.

### 3. Reactive Programming
Vue 3 reactivity patterns throughout with efficient computed properties.

### 4. Type Safety
Comprehensive TypeScript usage with strict type checking.

### 5. Performance First
Optimized for large datasets and frequent updates with virtual scrolling.

### 6. Developer Experience
Clear APIs and intuitive state management with good error handling.

### 7. Extensibility
Easy to add new stores and features without breaking existing code.

### 8. Testing
Testable architecture with clear separation between concerns.

This architecture represents a mature, production-ready Vue.js application that successfully balances complexity with maintainability while providing excellent performance and developer experience.

---

**Last Updated**: November 2, 2025
**Architecture Version**: Vue 3.4.0, Pinia, Composition API, TypeScript 5.9.3
**Consolidated From**: 4 separate architecture documents
**Document Type**: Comprehensive Architecture Reference