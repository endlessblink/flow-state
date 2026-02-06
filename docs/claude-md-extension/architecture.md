# Project Architecture

## High-Level Structure
```
src/
├── views/                    # Main application views (8 total)
│   ├── AllTasksView.vue      # Comprehensive task list
│   ├── BoardView.vue         # Kanban board with swimlanes
│   ├── CalendarView.vue      # Time-based task scheduling
│   ├── CalendarViewVueCal.vue # Alternative calendar (vue-cal)
│   ├── CanvasView.vue        # Free-form task organization
│   ├── FocusView.vue         # Dedicated Pomodoro interface
│   ├── PerformanceView.vue   # Gamification stats & achievements
│   └── QuickSortView.vue     # Priority-based sorting
├── components/               # Reusable UI components (22 directories)
│   ├── ai/                   # AI chat panel
│   ├── app/                  # App-level components
│   ├── auth/                 # Authentication components
│   ├── base/                 # Base components (Button, Modal, etc.)
│   ├── calendar/             # Calendar-specific components
│   ├── canvas/               # Canvas-specific components (nodes, menus)
│   ├── common/               # Shared common components
│   ├── debug/                # Debug/dev tools
│   ├── error/                # Error boundaries
│   ├── gamification/         # XP, achievements, shop UI
│   ├── inbox/                # Unified inbox & calendar cards
│   ├── kanban/               # Kanban board components
│   ├── layout/               # Layout & settings modal
│   ├── notifications/        # Notification components
│   ├── projects/             # Project management UI
│   ├── quicksort/            # QuickSort view components
│   ├── settings/             # Settings tabs
│   ├── startup/              # App startup/loading
│   ├── suggestions/          # Task suggestions
│   ├── sync/                 # Sync-related components
│   ├── tasks/                # Task editing & display
│   └── ui/                   # General UI components
├── stores/                   # Pinia state management (14 top-level + sub-modules)
│   ├── canvas/               # Canvas sub-modules (7 files)
│   └── tasks/                # Task sub-modules (4 files)
├── composables/              # Vue 3 composables (130 files across 12 directories)
│   ├── app/                  # App-level composables
│   ├── board/                # Board view composables
│   ├── bulk/                 # Bulk operations
│   ├── calendar/             # Calendar composables
│   ├── canvas/               # Canvas composables (30 files)
│   ├── inbox/                # Inbox composables
│   ├── mobile/               # Mobile-specific composables
│   ├── suggestions/          # Suggestion engine
│   ├── sync/                 # Sync orchestration
│   ├── tasks/                # Task-related composables
│   └── ui/                   # UI utility composables
├── services/                 # Service layer
│   ├── ai/                   # AI provider routing (Groq/Ollama)
│   ├── auth/                 # Supabase auth client
│   ├── canvas/               # Canvas service layer
│   ├── data/                 # Data services
│   ├── offline/              # Offline-first infrastructure
│   ├── trash/                # Trash/soft-delete service
│   ├── github-service.ts     # GitHub integration
│   └── unified-task-service.ts # Unified task operations
├── assets/                   # Static assets and styles
└── utils/                    # Utility functions
```

## State Management (Pinia Stores)

### Task Store (`src/stores/tasks.ts`)
**Largest store** - Central task management with sub-modules:
- Task CRUD operations with undo/redo support
- Project hierarchy with nesting support
- Task instances system for calendar scheduling
- Supabase persistence with optimistic updates
- Smart views (Today, Weekend) with complex filtering
- Backward compatibility with legacy scheduled fields

**Sub-modules** (`src/stores/tasks/`):
- `taskOperations.ts` - CRUD operation implementations
- `taskPersistence.ts` - Supabase save/load logic
- `taskHistory.ts` - Undo/redo history management
- `taskStates.ts` - Computed states and getters

### Canvas Store (`src/stores/canvas.ts`)
**Second largest** - Canvas-specific state with sub-modules:
- Vue Flow integration for node-based canvas
- Section management (priority, status, project sections)
- Collapsible sections with data preservation
- Multi-selection and batch operations
- Connection management for task dependencies
- Viewport controls and zoom management

**Sub-modules** (`src/stores/canvas/`):
- `canvasGroups.ts` - Group state management
- `canvasPersistence.ts` - Canvas save/load
- `canvasUi.ts` - Canvas UI state (toolbar, panels)
- `canvasViewport.ts` - Viewport position/zoom
- `contextMenus.ts` - Context menu state
- `modals.ts` - Canvas modal dialogs
- `types.ts` - TypeScript type definitions

### Timer Store (`src/stores/timer.ts`)
**Pomodoro timer functionality**:
- Session management with work/break cycles
- Cross-device sync via Supabase Realtime (device leadership model)
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
- **aiChat.ts** - AI chat state (messages, provider selection, Groq/Ollama)
- **auth.ts** - Authentication state (Supabase Auth)
- **gamification.ts** - XP, achievements, shop, streaks (Cyberflow system)
- **notifications.ts** - Notification management
- **projects.ts** - Project organization
- **quickSort.ts** - Quick sort view state
- **settings.ts** - User preferences and app settings
- **syncStatus.ts** - Sync status tracking (online/offline, pending changes)
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

### AI Chat (`src/composables/useAIChat.ts`)
**AI integration layer**:
- Multi-provider routing (Groq cloud, Ollama local, Tauri sidecar)
- Context-aware task suggestions
- Tauri-aware provider selection (prefers local in desktop app)

### Sync Orchestration (`src/composables/sync/`)
**Offline-first sync infrastructure** (TASK-1177):
- `useSyncOrchestrator.ts` - Central sync coordination
- Tombstone-based delete tracking
- Conflict resolution strategies

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
