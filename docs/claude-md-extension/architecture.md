# Project Architecture

## High-Level Structure
```
src/
├── views/                    # Main application views (7 total)
│   ├── AllTasksView.vue      # Comprehensive task list
│   ├── BoardView.vue         # Kanban board with swimlanes
│   ├── CalendarView.vue      # Time-based task scheduling
│   ├── CalendarViewVueCal.vue # Alternative calendar (vue-cal)
│   ├── CanvasView.vue        # Free-form task organization
│   ├── FocusView.vue         # Dedicated Pomodoro interface
│   └── QuickSortView.vue     # Priority-based sorting
├── components/               # Reusable UI components
│   ├── app/                  # App-level components
│   ├── auth/                 # Authentication components
│   ├── base/                 # Base components (Button, Modal, etc.)
│   ├── canvas/               # Canvas-specific components
│   ├── kanban/               # Kanban board components
│   ├── notifications/        # Notification components
│   ├── recurrence/           # Recurring task components
│   ├── settings/             # Settings components
│   ├── sync/                 # Sync-related components
│   └── ui/                   # General UI components
├── stores/                   # Pinia state management (12 stores)
├── composables/              # Vue 3 composables (64 files)
├── assets/                   # Static assets and styles
└── utils/                    # Utility functions
```

## State Management (Pinia Stores)

### Task Store (`src/stores/tasks.ts`)
**Largest store** - Central task management with:
- Task CRUD operations with undo/redo support
- Project hierarchy with nesting support
- Task instances system for calendar scheduling
- Supabase persistence with optimistic updates
- Smart views (Today, Weekend) with complex filtering
- Backward compatibility with legacy scheduled fields

### Canvas Store (`src/stores/canvas.ts`)
**Second largest** - Canvas-specific state:
- Vue Flow integration for node-based canvas
- Section management (priority, status, project sections)
- Collapsible sections with data preservation
- Multi-selection and batch operations
- Connection management for task dependencies
- Viewport controls and zoom management

### Timer Store (`src/stores/timer.ts`)
**Pomodoro timer functionality**:
- Session management with work/break cycles
- Settings persistence in localStorage
- Browser notification integration
- Task-specific timer sessions
- Session history tracking

### UI Store (`src/stores/ui.ts`)
Application UI state:
- Sidebar visibility states
- Theme management integration
- Modal and overlay controls
- Board density settings
- Active view management

### Additional Stores
- **auth.ts** - Authentication state (Supabase Auth)
- **local-auth.ts** - Local authentication fallback
- **notifications.ts** - Notification management
- **projects.ts** - Project organization
- **quickSort.ts** - Quick sort view state
- **settings.ts** - User preferences and app settings
- **taskCore.ts** - Core task utilities
- **taskScheduler.ts** - Task scheduling
- **theme.ts** - Theme management

## Key Composables

### Unified Undo/Redo System (`src/composables/useUnifiedUndoRedo.ts`)
**Critical system** - Replaces all conflicting undo/redo implementations:
- Uses VueUse's `useManualRefHistory` for consistent state tracking
- 50-entry capacity with deep cloning
- Task operations: create, update, delete with undo support
- JSON-based state serialization for persistence

### Database Operations (`src/composables/useSupabaseDatabaseV2.ts`)
**Supabase abstraction layer**:
- PostgreSQL backend with Row Level Security (RLS)
- Real-time subscriptions via Supabase Realtime
- Type mappers in `src/utils/supabaseMappers.ts`
- Optimistic UI updates with conflict resolution
- Type-safe generic save/load operations
- Auth integration via `src/stores/auth.ts`

## Task Data Model
```typescript
interface Task {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null
  progress: number
  completedPomodoros: number
  subtasks: Subtask[]
  dueDate: string
  instances: TaskInstance[]    // Calendar occurrences
  projectId: string
  parentTaskId?: string | null
  createdAt: Date
  updatedAt: Date
  // Canvas-specific fields
  canvasPosition?: { x: number; y: number }
  isInInbox?: boolean
  dependsOn?: string[]
}
```

## Canvas System Architecture

### Vue Flow Integration
- Parent-child relationships (sections → tasks)
- Collapsible sections with height preservation
- Task dependency connections with handles
- Context menus for canvas operations
- Multi-selection with rectangle/lasso tools

### Section Types
- **Priority Sections**: Auto-collect by priority level
- **Status Sections**: Auto-collect by completion status
- **Project Sections**: Auto-collect by project assignment
- **Custom Sections**: Manual organization with filters
