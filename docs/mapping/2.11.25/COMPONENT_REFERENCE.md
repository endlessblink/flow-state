# Pomo-Flow Component Reference

## Overview

This consolidated reference document combines component architecture, relationships, drag-and-drop systems, views analysis, and UI flows into a comprehensive guide for the Pomo-Flow Vue.js productivity application.

## Table of Contents

- [Application Architecture](#application-architecture)
- [View Components](#view-components)
- [Base Components](#base-components)
- [Specialized Components](#specialized-components)
- [Component Hierarchy](#component-hierarchy)
- [Drag & Drop System](#drag--drop-system)
- [UI Flows & Interactions](#ui-flows--interactions)
- [State Management Integration](#state-management-integration)
- [Performance Patterns](#performance-patterns)

---

## Application Architecture

### Component Relationship Tree

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

### Cross-Component Communication

#### Store-Based Communication
```typescript
// Parent component
const taskStore = useTaskStore()
const selectedTasks = computed(() => taskStore.selectedTasks)

// Child component
const taskStore = useTaskStore()
const toggleSelection = (taskId: string) => {
  taskStore.toggleTaskSelection(taskId)
}
```

#### Event Bus Communication
```typescript
// Component A (emitter)
emit('task:updated', { taskId, updates })

// Component B (listener)
const onTaskUpdated = (data) => {
  // Handle task update
}

onMounted(() => {
  window.addEventListener('task:updated', onTaskUpdated)
})
```

---

## View Components

### 1. BoardView.vue - Kanban Board

**Primary Function**: Kanban-style task organization with project-based swimlanes

**Key Features**:
- Project Swimlanes with horizontal lanes
- Status Columns (planned → in_progress → done)
- Drag-and-drop task movement
- Density settings (compact vs comfortable)
- Advanced filtering and bulk operations

**Component Structure**:
```
BoardView.vue
├── ViewControls.vue
│   ├── DensitySelector.vue
│   ├── FilterDropdown.vue
│   └── ViewToggleButton.vue
├── KanbanBoard.vue
│   ├── KanbanSwimlane.vue (per project)
│   │   ├── SwimlaneHeader.vue
│   │   │   ├── ProjectAvatar.vue
│   │   │   ├── ProjectName.vue
│   │   │   └── ProjectActions.vue
│   │   └── KanbanColumn.vue (per status)
│   │       ├── ColumnHeader.vue
│   │       │   ├── StatusIcon.vue
│   │       │   ├── TaskCount.vue
│   │       │   └── ColumnActions.vue
│   │       ├── TaskList.vue
│   │       │   ├── TaskCard.vue (per task)
│   │       │   │   ├── TaskCheckbox.vue
│   │       │   │   ├── TaskPriority.vue
│   │       │   │   ├── TaskTitle.vue
│   │       │   │   ├── TaskMeta.vue
│   │       │   │   │   ├── ProjectTag.vue
│   │       │   │   │   ├── DueDate.vue
│   │       │   │   │   └── PomodoroCount.vue
│   │       │   │   ├── TaskProgress.vue
│   │       │   │   └── TaskActions.vue
│   │       │   │       ├── EditButton.vue
│   │       │   │       ├── DeleteButton.vue
│   │       │   │       └── MenuButton.vue
│   │       │   └── QuickAddButton.vue
│   │       └── ColumnFooter.vue
│   │           └── AddTaskButton.vue
│   └── SwimlaneActions.vue
│       ├── CollapseButton.vue
│       └── SwimlaneMenu.vue
├── BoardToolbar.vue
│   ├── ViewModeToggle.vue
│   ├── FilterPanel.vue
│   └── BatchActions.vue
└── ContextMenus (Teleported)
    ├── TaskContextMenu.vue
    ├── ColumnContextMenu.vue
    └── SwimlaneContextMenu.vue
```

**Store Dependencies**: `taskStore`, `uiStore`

**Key Composables**: `useDragAndDrop`, `useUnifiedUndoRedo`, `useVirtualList`

---

### 2. CalendarView.vue - Time-Based Scheduling

**Primary Function**: Calendar interface for scheduling tasks with day/week/month views

**Key Features**:
- Multiple View Modes (Day, Week, Month)
- Drag-and-drop scheduling
- Ghost preview during drag operations
- Resize handles for task duration
- Calendar inbox for unscheduled tasks
- Status filtering and time zone support

**Component Structure**:
```
CalendarView.vue
├── CalendarHeader.vue
│   ├── NavigationControls.vue
│   │   ├── PreviousButton.vue
│   │   ├── NextButton.vue
│   │   └── TodayButton.vue
│   ├── ViewModeSelector.vue
│   │   ├── DayButton.vue
│   │   ├── WeekButton.vue
│   │   └── MonthButton.vue
│   └── CalendarActions.vue
│       ├── SettingsButton.vue
│       └── ExportButton.vue
├── CalendarToolbar.vue
│   ├── DateDisplay.vue
│   ├── FilterControls.vue
│   │   ├── StatusFilter.vue
│   │   ├── ProjectFilter.vue
│   │   └── PriorityFilter.vue
│   └── ViewControls.vue
│       ├── DensityToggle.vue
│       └── WeekendsToggle.vue
├── CalendarGrid.vue
│   ├── TimeScale.vue
│   │   ├── TimeSlot.vue (per hour)
│   │   └── CurrentTimeIndicator.vue
│   ├── DayColumn.vue (per day)
│   │   ├── DayHeader.vue
│   │   │   ├── DateDisplay.vue
│   │   │   └── DayActions.vue
│   │   ├── AllDaySection.vue
│   │   │   └── AllDayEvent.vue
│   │   ├── TimeSlots.vue
│   │   │   ├── TimeSlot.vue (per hour)
│   │   │   │   └── TaskEvent.vue (per task)
│   │   │   │       ├── EventContent.vue
│   │   │   │       │   ├── TaskTitle.vue
│   │   │   │       │   ├── TaskTime.vue
│   │   │   │       │   └── TaskMeta.vue
│   │   │   │       ├── EventResizeHandle.vue
│   │   │   │       └── EventDragHandle.vue
│   │   │   └── DropZone.vue
│   │   └── MoreEventsIndicator.vue
│   └── GhostEvent.vue (drag preview)
├── CalendarInbox.vue
│   ├── InboxHeader.vue
│   ├── UnscheduledTasks.vue
│   │   ├── InboxTaskCard.vue (per task)
│   │   │   ├── TaskTitle.vue
│   │   │   ├── TaskMeta.vue
│   │   │   └── ScheduleButton.vue
│   │   └── EmptyInbox.vue
│   └── InboxActions.vue
└── DragOverlays (Teleported)
    ├── DragGhost.vue
    ├── ResizeGhost.vue
    └── DropIndicator.vue
```

**Store Dependencies**: `taskStore`, `timerStore`, `uiStore`

**Key Composables**: `useCalendarDragCreate`, `useUnifiedUndoRedo`, `useVirtualList`

---

### 3. CanvasView.vue - Visual Task Organization

**Primary Function**: Free-form visual task organization using Vue Flow

**Key Features**:
- Node-based layout with free positioning
- Section management (priority, status, project)
- Task connections for dependencies
- Multi-selection tools (rectangle and lasso)
- Viewport controls (zoom and pan)
- Collapsible sections with context menus

**Component Structure**:
```
CanvasView.vue
├── CanvasToolbar.vue
│   ├── ViewportControls.vue
│   │   ├── ZoomInButton.vue
│   │   ├── ZoomOutButton.vue
│   │   ├── ZoomResetButton.vue
│   │   └── FitToScreenButton.vue
│   ├── SelectionTools.vue
│   │   ├── SelectTool.vue
│   │   ├── LassoTool.vue
│   │   └── ClearSelectionButton.vue
│   └── CanvasActions.vue
│       ├── AutoLayoutButton.vue
│       ├── CenterViewButton.vue
│       └── SettingsButton.vue
├── VueFlow.vue (Canvas Container)
│   ├── CanvasBackground.vue
│   │   └── GridBackground.vue
│   ├── CanvasViewport.vue
│   │   ├── CanvasSection.vue (per section)
│   │   │   ├── SectionHeader.vue
│   │   │   │   ├── SectionIcon.vue
│   │   │   │   ├── SectionTitle.vue
│   │   │   │   ├── SectionCount.vue
│   │   │   │   └── SectionActions.vue
│   │   │   │       ├── CollapseButton.vue
│   │   │   │       ├── EditSectionButton.vue
│   │   │   │       └── SectionMenu.vue
│   │   │   ├── SectionContent.vue
│   │   │   │   └── TaskNode.vue (per task)
│   │   │   │       ├── NodeHeader.vue
│   │   │   │       │   ├── TaskTitle.vue
│   │   │   │       │   ├── TaskPriority.vue
│   │   │   │       │   └── TaskStatus.vue
│   │   │   │       ├── NodeContent.vue
│   │   │   │       │   ├── TaskDescription.vue
│   │   │   │       │   ├── TaskMeta.vue
│   │   │   │       │   └── TaskProgress.vue
│   │   │   │       ├── NodeHandles.vue
│   │   │   │       │   ├── InputHandle.vue
│   │   │   │       │   └── OutputHandle.vue
│   │   │   │       └── NodeActions.vue
│   │   │   │           ├── EditButton.vue
│   │   │   │           └── NodeMenu.vue
│   │   │   └── DropZone.vue
│   │   ├── ConnectionLayer.vue
│   │   │   ├── TaskConnection.vue (per connection)
│   │   │   │   ├── ConnectionPath.vue
│   │   │   │   ├── ConnectionArrow.vue
│   │   │   │   └── ConnectionLabel.vue
│   │   │   └── GhostConnection.vue
│   │   └── InboxPanel.vue
│   │       ├── InboxHeader.vue
│   │       ├── InboxTasks.vue
│   │       │   └── InboxTaskNode.vue
│   │       └── InboxActions.vue
│   ├── SelectionOverlay.vue
│   │   ├── SelectionRectangle.vue
│   │   ├── SelectionLasso.vue
│   │   └── SelectionBox.vue
│   └── MiniMap.vue
│       ├── MiniMapViewport.vue
│       └── MiniMapNodes.vue
├── SectionManager.vue
│   ├── SectionList.vue
│   ├── CreateSectionButton.vue
│   └── SectionEditor.vue
└── CanvasContextMenus (Teleported)
    ├── CanvasContextMenu.vue
    ├── SectionContextMenu.vue
    ├── TaskContextMenu.vue
    └── ConnectionContextMenu.vue
```

**Store Dependencies**: `canvasStore`, `taskStore`, `uiStore`

**Key Composables**: Canvas-specific drag/drop handlers, viewport management, multi-selection logic

---

### 4. AllTasksView.vue - Master Task List

**Primary Function**: Comprehensive task management with list and table display modes

**Key Features**:
- Dual display modes (list vs table)
- Advanced sorting and multi-criteria filtering
- Batch operations with multi-select
- Task hierarchy with parent-child relationships
- Inline editing and export functionality

**Component Structure**:
```
AllTasksView.vue
├── ViewControls.vue
│   ├── ViewModeToggle.vue
│   │   ├── ListViewButton.vue
│   │   └── TableViewButton.vue
│   ├── SortControls.vue
│   │   ├── SortSelector.vue
│   │   └── SortDirectionToggle.vue
│   └── FilterControls.vue
│       ├── FilterDropdown.vue
│       ├── SearchInput.vue
│       └── ClearFiltersButton.vue
├── TaskList.vue (List Mode)
│   ├── ListHeader.vue
│   │   ├── ColumnHeaders.vue
│   │   └── BulkActions.vue
│   │       ├── SelectAllCheckbox.vue
│   │       ├── BulkEditButton.vue
│   │       ├── BulkDeleteButton.vue
│   │       └── BulkAssignButton.vue
│   ├── ListContent.vue
│   │   ├── TaskRow.vue (per task)
│   │   │   ├── TaskCheckbox.vue
│   │   │   ├── TaskExpandButton.vue
│   │   │   ├── TaskMainContent.vue
│   │   │   │   ├── TaskTitle.vue
│   │   │   │   ├── TaskDescription.vue
│   │   │   │   └── TaskMeta.vue
│   │   │   │       ├── ProjectTag.vue
│   │   │   │       ├── DueDate.vue
│   │   │   │       ├── PriorityBadge.vue
│   │   │   │       └── StatusBadge.vue
│   │   │   ├── TaskProgress.vue
│   │   │   ├── TaskActions.vue
│   │   │   │   ├── EditButton.vue
│   │   │   │   ├── DeleteButton.vue
│   │   │   │   └── MenuButton.vue
│   │   │   └── SubtaskList.vue
│   │   │       └── SubtaskRow.vue
│   │   └── VirtualScroller.vue
│   └── ListFooter.vue
│       ├── TaskCount.vue
│       └── Pagination.vue
├── TaskTable.vue (Table Mode)
│   ├── TableHeader.vue
│   │   ├── SortableColumn.vue (per column)
│   │   │   ├── ColumnTitle.vue
│   │   │   └── SortIndicator.vue
│   │   └── ColumnResizer.vue
│   ├── TableBody.vue
│   │   ├── TableRow.vue (per task)
│   │   │   ├── TableCell.vue (per column)
│   │   │   │   ├── CheckboxCell.vue
│   │   │   │   ├── TitleCell.vue
│   │   │   │   ├── ProjectCell.vue
│   │   │   │   ├── PriorityCell.vue
│   │   │   │   ├── StatusCell.vue
│   │   │   │   ├── DueDateCell.vue
│   │   │   │   ├── ProgressCell.vue
│   │   │   │   └── ActionsCell.vue
│   │   │   └── RowExpander.vue
│   │   └── TableVirtualScroller.vue
│   └── TableFooter.vue
│       ├── SelectedCount.vue
│       └── TableActions.vue
└── FilterPanel.vue (Collapsible)
    ├── FilterSection.vue
    │   ├── StatusFilter.vue
    │   ├── PriorityFilter.vue
    │   ├── ProjectFilter.vue
    │   └── DateRangeFilter.vue
    └── FilterActions.vue
        ├── ApplyFiltersButton.vue
        └── ClearFiltersButton.vue
```

**Store Dependencies**: `taskStore`, `timerStore`, `uiStore`

**Key Composables**: `useVirtualList`, `useUnifiedUndoRedo`, view management utilities

---

### 5. QuickSortView.vue - Rapid Task Categorization

**Primary Function**: Gamified rapid task sorting and categorization interface

**Key Features**:
- Session-based processing with gamification
- Keyboard shortcuts for rapid operation
- Undo/redo support for decisions
- Celebration effects for completion
- Category learning and statistics tracking

**Component Structure**:
```
QuickSortView.vue
├── SessionHeader.vue
│   ├── SessionTitle.vue
│   ├── SessionProgress.vue
│   │   ├── ProgressBar.vue
│   │   ├── ProgressText.vue
│   │   └── TimeRemaining.vue
│   ├── SessionControls.vue
│   │   ├── PauseButton.vue
│   │   ├── ResumeButton.vue
│   │   └── EndSessionButton.vue
│   └── SessionMenu.vue
├── TaskDisplay.vue
│   ├── TaskCard.vue
│   │   ├── TaskTitle.vue
│   │   ├── TaskDescription.vue
│   │   ├── TaskMeta.vue
│   │   └── TaskPreview.vue
│   ├── TaskNavigation.vue
│   │   ├── PreviousTaskButton.vue
│   │   ├── TaskCounter.vue
│   │   └── SkipTaskButton.vue
│   └── TaskActions.vue
│       ├── EditButton.vue
│       └── DeleteButton.vue
├── CategorySelector.vue
│   ├── CategoryGrid.vue
│   │   ├── CategoryButton.vue (per category)
│   │   │   ├── CategoryIcon.vue
│   │   │   ├── CategoryName.vue
│   │   │   ├── CategoryCount.vue
│   │   │   └── ShortcutKey.vue
│   │   └── CustomCategoryButton.vue
│   ├── CategoryKeyboard.vue
│   │   ├── KeyHint.vue
│   │   └── ShortcutLegend.vue
│   └── CategoryActions.vue
│       ├── ManageCategoriesButton.vue
│       └── ResetCategoriesButton.vue
├── KeyboardShortcuts.vue
│   ├── ShortcutList.vue
│   │   ├── ShortcutItem.vue
│   │   │   ├── KeyCombo.vue
│   │   │   └── ActionDescription.vue
│   └── ShortcutsHelp.vue
├── SessionStats.vue
│   ├── StatsGrid.vue
│   │   ├── StatCard.vue
│   │   │   ├── StatValue.vue
│   │   │   └── StatLabel.vue
│   │   └── ProgressChart.vue
│   └── PerformanceMetrics.vue
├── CelebrationModal.vue (Teleported)
│   ├── CelebrationAnimation.vue
│   ├── SessionSummary.vue
│   │   ├── StatsSummary.vue
│   │   └── AchievementBadges.vue
│   └── CelebrationActions.vue
│       ├── ContinueButton.vue
│       └── ReviewButton.vue
└── ExitConfirmation.vue (Teleported)
    ├── ConfirmationMessage.vue
    └── ConfirmationActions.vue
        ├── ConfirmExitButton.vue
        └── CancelButton.vue
```

**Store Dependencies**: `quickSortStore`, `taskStore`, `uiStore`

**Key Composables**: `useQuickSort`, `useUnifiedUndoRedo`, `useKeyboardShortcuts`

---

### 6. FocusView.vue - Deep Work Sessions

**Primary Function**: Distraction-free environment for focused work sessions

**Key Features**:
- Minimal interface with reduced UI elements
- Built-in Pomodoro timer integration
- Single task focus mode
- Break reminders and distraction blocking

**Component Structure**:
```
FocusView.vue
├── FocusHeader.vue
│   ├── SessionInfo.vue
│   │   ├── SessionTimer.vue
│   │   ├── TaskTitle.vue
│   │   └── SessionProgress.vue
│   └── FocusControls.vue
│       ├── PauseButton.vue
│       ├── StopButton.vue
│       └── SettingsButton.vue
├── MainContent.vue
│   ├── TaskDisplay.vue
│   │   ├── TaskTitle.vue
│   │   ├── TaskDescription.vue
│   │   ├── TaskGoals.vue
│   │   │   ├── GoalItem.vue
│   │   │   └── GoalProgress.vue
│   │   └── TaskNotes.vue
│   │       ├── NotesEditor.vue
│   │       └── NotesPreview.vue
│   ├── TimerDisplay.vue
│   │   ├── TimeRemaining.vue
│   │   ├── CircularProgress.vue
│   │   └── SessionType.vue
│   └── MotivationalContent.vue
│       ├── QuoteDisplay.vue
│       ├── ProgressReminder.vue
│       └── AchievementDisplay.vue
├── FocusToolbar.vue
│   ├── TimerControls.vue
│   │   ├── StartButton.vue
│   │   ├── PauseButton.vue
│   │   ├── SkipButton.vue
│   │   └── ResetButton.vue
│   ├── TaskControls.vue
│   │   ├── CompleteTaskButton.vue
│   │   ├── ChangeTaskButton.vue
│   │   └── AddPomodoroButton.vue
│   └── EnvironmentControls.vue
│       ├── BackgroundMusic.vue
│       ├── SoundToggle.vue
│       └── DistractionBlocker.vue
├── BreakView.vue (When on break)
│   ├── BreakTimer.vue
│   │   ├── TimeRemaining.vue
│   │   └── BreakProgress.vue
│   ├── BreakContent.vue
│   │   ├── StretchingExercises.vue
│   │   ├── BreathingExercise.vue
│   │   └── QuickTips.vue
│   └── BreakControls.vue
│       ├── ExtendBreakButton.vue
│       └── EndBreakButton.vue
└── FocusSettings.vue (Overlay)
    ├── TimerSettings.vue
    │   ├── DurationSelector.vue
    │   ├── BreakSettings.vue
    │   └── AutoStartSettings.vue
    ├── DistractionSettings.vue
    │   ├── WebsiteBlocker.vue
    │   ├── NotificationSettings.vue
    │   └── SoundSettings.vue
    └── EnvironmentSettings.vue
        ├── BackgroundSelector.vue
        ├── MusicSelector.vue
        └── ThemeSelector.vue
```

**Store Dependencies**: `timerStore`, `taskStore`, `uiStore`

**Key Composables**: `useFocusMode`, `useTimer`, `useNotification`

---

## Base Components

### BaseButton.vue
**Function**: Universal button component with multiple variants

**Variants**: primary, secondary, danger, ghost, link
**Props**: variant, size, disabled, loading, icon
**Usage**: Used throughout application for consistent button styling

**Usage Map**:
- BoardView: AddTaskButton, EditButton, DeleteButton
- CalendarView: NavigationControls, ViewModeSelector
- CanvasView: ZoomControls, SectionActions
- AllTasksView: BulkActions, RowActions
- QuickSortView: CategoryButtons, SessionControls
- FocusView: TimerControls, TaskControls
- AuthModal: SubmitButton, CancelButton

### BaseModal.vue
**Function**: Modal dialog container with overlay

**Features**: Escape to close, click-outside-to-close, focus management
**Props**: open, closable, size, title, persistent
**Usage**: Task editing, project management, confirmation dialogs

**Modal Containers**:
- TaskEditModal (Task editing interface)
- ProjectModal (Project management)
- AuthModal (Authentication)
- ConfirmationModal (Delete confirmations)
- CelebrationModal (QuickSort completion)
- FocusSettings (Focus mode settings)

### BaseCard.vue
**Function**: Card container component for content grouping

**Features**: Glass morphism styling, hover effects, responsive
**Props**: title, subtitle, actions, padding, elevation
**Usage**: Task cards, section containers, modal content

**Card Containers**:
- TaskCard (Board and list views)
- TaskEvent (Calendar events)
- TaskNode (Canvas tasks)
- StatCard (Statistics display)
- CategoryButton (QuickSort categories)
- SettingsCard (Settings panels)

### BaseInput.vue
**Function**: Form input component with validation

**Features**: Built-in validation, error states, icons
**Props**: type, placeholder, required, disabled, error
**Usage**: Task creation, project forms, authentication

### BaseDropdown.vue
**Function**: Dropdown selector component

**Features**: Search functionality, multi-select, keyboard navigation
**Props**: options, value, multiple, searchable, placeholder
**Usage**: Project selection, category assignment, status changes

### BasePopover.vue
**Function**: Popover container for contextual content

**Features**: Position calculation, click-outside-to-close
**Props**: trigger, position, offset, persistent
**Usage**: Tooltips, context menus, quick actions

---

## Specialized Components

### Canvas Components

#### TaskNode.vue
**Function**: Individual task representation on canvas
**Features**: Drag handles, connection points, status indicators
**Props**: task, selected, connections, position
**Store Integration**: canvasStore for position, taskStore for data

#### CanvasSection.vue
**Function**: Section container for organizing tasks
**Features**: Collapsible, auto-collecting, drag targets
**Props**: section, tasks, collapsed, position
**Store Integration**: canvasStore for section state

#### MultiSelectionOverlay.vue
**Function**: Selection rectangle for multi-select operations
**Features**: Visual feedback, keyboard modifiers, lasso tool
**Props**: selectionRect, isSelecting, selectionMode

#### InboxPanel.vue
**Function**: Container for unpositioned tasks
**Features**: Drag source, task preview, count display
**Props**: tasks, visible, position
**Store Integration**: canvasStore for inbox state

### Kanban Components

#### KanbanColumn.vue
**Function**: Status column in Kanban board
**Features**: Task limits, drop targets, column actions
**Props**: status, tasks, title, color, maxTasks
**Store Integration**: taskStore for task operations

#### KanbanSwimlane.vue
**Function**: Project-based row container
**Features**: Project info, column containers, expand/collapse
**Props**: project, tasks, visible, density
**Store Integration**: taskStore and uiStore

#### TaskCard.vue
**Function**: Task display card for board and list views
**Features**: Priority indicators, progress bars, actions menu
**Props**: task, compact, showProject, dragHandle
**Store Integration**: taskStore for task operations

### Authentication Components

#### AuthModal.vue
**Function**: Main authentication interface
**Features**: Login/signup tabs, form validation, loading states
**Props**: open, mode, onAuthSuccess
**Store Integration**: authStore for authentication

#### LoginForm.vue
**Function**: User login form
**Features**: Email/password, remember me, forgot password
**Props**: onSubmit, loading, errors

#### SignupForm.vue
**Function**: User registration form
**Features**: Account creation, validation, terms acceptance
**Props**: onSubmit, loading, errors

#### GoogleSignInButton.vue
**Function**: OAuth Google authentication
**Features**: One-click sign-in, error handling
**Props**: onSuccess, onError

#### UserProfile.vue
**Function**: User profile management
**Features**: Profile editing, preferences, account settings
**Props**: user, onSave, onLogout
**Store Integration**: authStore and uiStore

---

## Component Hierarchy

### Hierarchical Relationships

**App.vue (Root)**
├── **Router View**
│   ├── **BoardView.vue**
│   │   ├── KanbanSwimlane.vue
│   │   │   └── KanbanColumn.vue
│   │   │       └── TaskCard.vue
│   │   ├── ProjectModal.vue
│   │   └── TaskContextMenu.vue
│   ├── **CalendarView.vue**
│   │   ├── CalendarGrid.vue
│   │   │   ├── TaskEvent.vue
│   │   │   └── TimeSlot.vue
│   │   ├── CalendarInbox.vue
│   │   └── TaskEditModal.vue
│   ├── **CanvasView.vue**
│   │   ├── CanvasSection.vue
│   │   │   └── TaskNode.vue
│   │   ├── MultiSelectionOverlay.vue
│   │   └── InboxPanel.vue
│   ├── **AllTasksView.vue**
│   │   ├── TaskList.vue
│   │   │   └── TaskRow.vue
│   │   ├── TaskTable.vue
│   │   │   └── TableRow.vue
│   │   └── FilterPanel.vue
│   ├── **QuickSortView.vue**
│   │   ├── TaskDisplay.vue
│   │   ├── CategoryButtons.vue
│   │   └── SessionStats.vue
│   └── **FocusView.vue**
│       ├── FocusTimer.vue
│       └── TaskDisplay.vue

**Shared Components (Used across views)**
├── **BaseModal.vue** → TaskEditModal, ProjectModal, AuthModal
├── **BaseButton.vue** → Used throughout
├── **BaseDropdown.vue** → CategorySelector, ViewControls
├── **TaskContextMenu.vue** → Used in Board, Canvas, AllTasks
└── **ViewControls.vue** → Used in Board, Calendar, AllTasks

---

## Drag & Drop System

### System Architecture

#### TaskCard.vue - Primary Drag Initiation
```vue
<template>
  <article
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="endDrag"
  >
```

**Drag Event Handler**:
```typescript
const handleDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    const dragData: DragData = {
      type: 'task',
      taskId: props.task.id,
      title: props.task.title,
      source: 'kanban'
    }

    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'move'
  }
}
```

#### useDragAndDrop.ts - Drag State Management
```typescript
export interface DragData {
  type: 'task' | 'project'
  taskId?: string
  projectId?: string
  title: string
  source: 'kanban' | 'calendar' | 'canvas' | 'sidebar'
  payload?: any
}

export interface DragState {
  isDragging: boolean
  dragData: DragData | null
  dropTarget: string | null
}
```

#### KanbanSwimlane.vue - Drop Zone Container
```vue
<draggable
  v-model="localTasks.status[column.key]"
  group="swimlane-tasks"
  item-key="id"
  @change="handleDragChange($event, 'status', column.key)"
  class="drag-area-mini"
  :animation="30"
  :ghost-class="'ghost-card'"
  @dragstart="handleDragStart"
  @dragend="handleDragEnd"
  @dragover="handleDragOver"
>
```

### Current Issues

**Event Interception**: The `useHorizontalDragScroll.ts` component intercepts mousedown events before dragstart can fire, preventing drag operations from working properly.

**Root Cause**:
1. `handleMouseDown` calls `preventDefault()` before drag detection
2. Global CSS restrictions prevent drag preview rendering
3. Event timing issues between scroll handling and drag initiation

### Canvas Drag System (Working Alternative)

**Vue Flow Integration**: Canvas uses Vue Flow's built-in drag handling, which works independently of HTML5 drag-and-drop and doesn't conflict with the horizontal scroll system.

**Key Differences**:
- Uses canvas-based dragging, not HTML5
- Separate event system from Kanban
- Currently functional while Kanban dragging is broken

---

## UI Flows & Interactions

### Authentication Flows

#### Login Flow
1. **User Input** → Client-side validation
2. **API Call** → Loading state (`isLoading: true`)
3. **Success** → User profile loaded → Redirect to dashboard
4. **Error** → Error message display → Loading state cleared

#### Password Strength Validation
```typescript
const passwordStrength = computed(() => {
  const pwd = password.value
  let score = 0

  // Length checks
  if (pwd.length >= 8) score += 25
  if (pwd.length >= 12) score += 15

  // Character variety
  if (/[a-z]/.test(pwd)) score += 15  // lowercase
  if (/[A-Z]/.test(pwd)) score += 15  // uppercase
  if (/[0-9]/.test(pwd)) score += 15  // numbers
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 15  // special chars

  return { level, percent: Math.min(score, 100), text }
})
```

### Task CRUD Operations

#### Quick Task Creation
```typescript
const createQuickTask = async () => {
  if (newTaskTitle.value.trim()) {
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()

    undoRedoActions.createTaskWithUndo({
      title: newTaskTitle.value.trim(),
      description: '',
      status: 'planned',
      projectId: '1' // Default project
    })

    newTaskTitle.value = '' // Clear input
  }
}
```

#### Advanced Task Editing
**Progressive Disclosure Pattern**:
```typescript
const showDependencies = ref(false)
const showSubtasks = ref(true)     // Auto-expand if has subtasks
const showPomodoros = ref(false)

// Auto-expand Logic
watch(() => props.task, (newTask) => {
  if (newTask) {
    showSubtasks.value = (newTask.subtasks || []).length > 0
    showDependencies.value = (newTask.dependsOn?.length || 0) > 0
    showPomodoros.value = (newTask.completedPomodoros || 0) > 0
  }
}, { immediate: true })
```

### Modal Systems

#### Confirmation Modal
```vue
<BaseModal
  :is-open="isOpen"
  :title="title"
  :description="message"
  size="sm"
  variant="danger"
  :show-footer="false"
  :close-on-overlay-click="true"
  :close-on-escape="true"
  @close="$emit('cancel')"
  @after-open="handleAfterOpen"
>
```

#### Context Menu System
```typescript
interface ContextMenuItem {
  id: string
  label: string
  icon: Component
  action: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}
```

### Validation & Error Handling

#### Real-time Validation
```vue
<BaseInput
  v-model="email"
  type="email"
  :class="{ 'error': !isValidEmail(email) && email.length > 0 }"
  :aria-invalid="!isValidEmail(email) && email.length > 0"
  :aria-describedby="emailError ? 'email-error' : undefined"
  required
/>
```

#### Error Display
```vue
<div v-if="errorMessage" class="error-message" role="alert" aria-live="polite">
  <AlertCircle class="error-icon" aria-hidden="true" />
  <span>{{ errorMessage }}</span>
</div>
```

### Loading States

#### Button Loading
```vue
<BaseButton
  variant="primary"
  size="lg"
  :loading="isLoading"
  :disabled="!isFormValid || isLoading"
>
  <template v-if="isLoading">
    <LoadingSpinner :size="16" class="animate-spin" />
    Creating account...
  </template>
  <template v-else>
    Create Account
  </template>
</BaseButton>
```

### Keyboard Shortcuts

#### Global Keyboard Handler
```typescript
const handleKeydown = (event: KeyboardEvent) => {
  // Cmd/Ctrl+K to open Command Palette
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    commandPaletteRef.value?.open()
  }

  // Cmd/Ctrl+P to open search
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    showSearchModal.value = true
  }

  // Ctrl+Z/Cmd+Z for undo (not in text inputs)
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    const target = event.target as HTMLElement
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return // Don't interfere with text input
    }
    event.preventDefault()
    handleUndo()
  }

  // Escape to close modals
  if (event.key === 'Escape') {
    if (showConfirmModal.value) cancelConfirmAction()
    if (showTaskEditModal.value) showTaskEditModal.value = false
    if (showSearchModal.value) showSearchModal.value = false
  }
}
```

### Accessibility Features

#### ARIA Labels & Roles
```vue
<div v-if="errorMessage" class="error-message" role="alert" aria-live="polite">
  <AlertCircle class="error-icon" aria-hidden="true" />
  <span>{{ errorMessage }}</span>
</div>

<button
  class="password-toggle"
  :aria-label="showPassword ? 'Hide password' : 'Show password'"
  :aria-pressed="showPassword"
  tabindex="-1"
>
```

#### Focus Management
```typescript
// Focus trap for modals
const handleFocusTrap = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    const modal = document.querySelector('.modal-content') as HTMLElement
    const focusableElements = modal?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    if (!focusableElements || focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }
}
```

---

## State Management Integration

### Store Integration Patterns

#### Task Store Integration
- Direct store access in all views
- Task components connect via props and computed properties
- Real-time updates through store reactivity

#### Canvas Store Integration
- Canvas-specific components only
- Vue Flow integration for position management
- Section state managed centrally

#### UI Store Integration
- Global UI state (theme, sidebar, modals)
- View-specific preferences
- Responsive state management

#### Timer Store Integration
- Timer components and focus mode
- Session tracking and notifications
- Task-specific timer sessions

### Data Flow Patterns

#### Parent → Child Communication
- Props passing for configuration
- Event emission for user actions
- Computed properties for reactive data

#### Child → Parent Communication
- Event emission for state changes
- Callback functions for actions
- Store mutations for global changes

#### Cross-Component Communication
- Pinia stores for shared state
- Event bus for loose coupling
- Composables for shared logic

### Reactive Computed Properties

#### Task Counts with Automatic Updates
```typescript
const todayTaskCount = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return taskStore.tasks.filter(task => {
    // Check instances first (new format)
    const instances = getTaskInstances(task)
    if (instances.length > 0) {
      if (instances.some(inst => inst.scheduledDate === todayStr)) {
        return true
      }
    }

    // Fallback to legacy scheduledDate
    if (task.scheduledDate === todayStr) {
      return true
    }

    // Tasks created today
    const taskCreatedDate = new Date(task.createdAt)
    taskCreatedDate.setHours(0, 0, 0, 0)
    if (taskCreatedDate.getTime() === today.getTime()) {
      return true
    }

    // Tasks due today
    if (task.dueDate === todayStr) {
      return true
    }

    // Tasks currently in progress
    if (task.status === 'in_progress') {
      return true
    }

    return false
  }).length
})
```

---

## Performance Patterns

### Virtual Scrolling
- **AllTasksView**: Large task lists with `useVirtualList`
- **CalendarView**: Many time slots with virtual scrolling
- **CanvasView**: Many nodes with viewport culling

### Lazy Loading
- **Component Definition**: Async component loading
- **Data Loading**: On-demand data fetching
- **Image Loading**: Lazy image loading

### Memoization
- **Computed Properties**: Cached calculations
- **Expensive Operations**: Memoized results
- **Render Functions**: Optimized rendering

### Component Optimization
- **Shallow Prop Watching**: Reduce unnecessary re-renders
- **Event Handler Optimization**: Efficient event handling
- **Render Condition Optimization**: Smart conditional rendering

---

## Component Architecture Best Practices

### Single Responsibility
- Each component has one clear purpose
- Complex logic moved to composables
- UI separate from business logic

### Props Validation
```typescript
const props = defineProps<{
  task: Task
  variant?: 'default' | 'compact'
  readonly?: boolean
}>()
```

### Event Naming
```typescript
// Clear event naming
emit('task:created', task)
emit('task:updated', { taskId, updates })
emit('task:deleted', taskId)

// Avoid generic names
// emit('change', data) // ❌ Too generic
// emit('task:changed', data) // ✅ More specific
```

### Composition over Inheritance
```typescript
// Use composables instead of mixins
const { saveState, undo } = useUnifiedUndoRedo()
const { dragProps } = useDragSource(config)
```

---

## Testing Patterns

### Unit Testing Structure
```typescript
describe('TaskCard', () => {
  it('renders task title correctly', () => {
    const task = { id: '1', title: 'Test Task' }
    render(TaskCard, { props: { task } })
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('emits complete event on checkbox click', async () => {
    const task = { id: '1', title: 'Test Task' }
    const { getByRole } = render(TaskCard, { props: { task } })

    await fireEvent.click(getByRole('checkbox'))
    expect(emitted().complete).toBeTruthy()
  })
})
```

### Integration Testing
```typescript
describe('BoardView Integration', () => {
  it('creates new task when add button clicked', async () => {
    const taskStore = useTaskStore()
    const spy = vi.spyOn(taskStore, 'createTask')

    render(BoardView)
    await fireEvent.click(screen.getByText('Add Task'))

    expect(spy).toHaveBeenCalled()
  })
})
```

---

## Responsive Design Patterns

### Mobile-First Modal System
```scss
.modal-content {
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: var(--radius-2xl);

  // Mobile adjustments
  @media (max-width: 768px) {
    width: 95%;
    max-width: none;
    margin: var(--space-4);
    border-radius: var(--radius-xl);
  }
}
```

### Adaptive Navigation
```typescript
// Sidebar visibility management
const uiStore = useUIStore()

// Auto-hide on mobile
const handleResize = () => {
  if (window.innerWidth < 768) {
    uiStore.hideMainSidebar()
  }
}
```

---

## Animation & Transition Systems

### Page Transitions
```vue
<router-view v-slot="{ Component }">
  <transition name="fade" mode="out-in">
    <div class="view-wrapper">
      <component :is="Component" />
    </div>
  </transition>
</router-view>
```

```scss
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
```

### Modal Animations
```scss
// Modal content slide-up
.modal-content {
  animation: slideUp var(--duration-normal) var(--spring-gentle);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

---

## Summary

This consolidated component reference provides a comprehensive overview of the Pomo-Flow application's component architecture, from high-level view components down to specialized UI elements. The system follows Vue 3 best practices with Composition API, proper state management integration, and a focus on maintainable, scalable code.

**Key Principles**:
1. **Component Hierarchy**: Clear parent-child relationships with proper data flow
2. **State Management**: Centralized Pinia stores with reactive computed properties
3. **Performance**: Virtual scrolling, lazy loading, and memoization
4. **Accessibility**: Full keyboard navigation and ARIA support
5. **Responsive Design**: Mobile-first approach with adaptive layouts

**Current Issues**:
- **Drag & Drop**: Event conflicts between horizontal scroll and drag systems in Kanban view
- **Canvas System**: Working properly with Vue Flow, independent of HTML5 drag issues

---

**Last Updated**: November 2, 2025
**Architecture Version**: Vue 3.4.0, Composition API, TypeScript
**Document Consolidation**: Merged from 4 separate component documentation files