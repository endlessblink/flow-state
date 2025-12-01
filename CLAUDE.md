# CLAUDE.md

# NEVER EVER CLAIM SUCCSESS THAT SOMETHING IS READY, DONE, READY FOR PRODUCTION ETC UNTILL THE USER CONFIRMS IT by actually testing or using the feature!!!!


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pomo-Flow** is a sophisticated Vue 3 productivity application that combines Pomodoro timer functionality with task management across multiple views (Board, Calendar, Canvas). It features a unified undo/redo system, IndexedDB persistence, and a custom design system with glass morphism aesthetics.

## Technology Stack

### Core Framework
- **Vue 3** with Composition API and `<script setup>` syntax
- **TypeScript** for full type safety
- **Vite** for fast development server and optimized builds
- **Pinia** for centralized state management

### UI & Styling
- **Tailwind CSS** with custom design tokens and extensive configuration
- **Naive UI** component library with dark theme integration
- **Glass morphism** design system with CSS custom properties
- **Lucide Vue Next** for consistent iconography

### Canvas & Visualization
- **Vue Flow** (@vue-flow/core) for node-based canvas interactions
- **Vuedraggable** for drag-and-drop functionality

### Data & Storage
- **IndexedDB** via LocalForage for client-side persistence
- **PouchDB** for database operations

### Development Tools
- **Vitest** for unit testing
- **Playwright** for end-to-end testing
- **Storybook** for component documentation (port 6006)
- **ESLint** with TypeScript support

## Development Commands

### Essential Commands
```bash
# Start development server (port 5546)
npm run dev

# Kill all PomoFlow processes (CRITICAL - DO NOT REMOVE)
npm run kill

# Build for production
npm run build

# Run tests
npm run test

# Test in watch mode with UI
npm run test:watch

# Safety tests
npm run test:safety

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Validate all aspects (imports, CSS, dependencies)
npm run validate:all

# Storybook development
npm run storybook

# Build Storybook
npm run build-storybook
```

## Project Architecture

### High-Level Structure
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
├── composables/              # Vue 3 composables (56 files)
├── assets/                   # Static assets and styles
└── utils/                    # Utility functions
```

## State Management (Pinia Stores)

### Task Store (`src/stores/tasks.ts`)
**Largest store (3000 lines)** - Central task management with:
- Task CRUD operations with undo/redo support
- Project hierarchy with nesting support
- Task instances system for calendar scheduling
- IndexedDB persistence with debounced saves
- Smart views (Today, Weekend) with complex filtering
- Backward compatibility with legacy scheduled fields

### Canvas Store (`src/stores/canvas.ts`)
**Second largest (1166 lines)** - Canvas-specific state:
- Vue Flow integration for node-based canvas
- Section management (priority, status, project sections)
- Collapsible sections with data preservation
- Multi-selection and batch operations
- Connection management for task dependencies
- Viewport controls and zoom management

### Timer Store (`src/stores/timer.ts`)
**Pomodoro timer functionality (483 lines)**:
- Session management with work/break cycles
- Settings persistence in localStorage
- Browser notification integration
- Task-specific timer sessions
- Session history tracking

### UI Store (`src/stores/ui.ts`)
Application UI state (234 lines):
- Sidebar visibility states
- Theme management integration
- Modal and overlay controls
- Board density settings
- Active view management

### Additional Stores
- **auth.ts** (515 lines) - Authentication state
- **local-auth.ts** (302 lines) - Local authentication
- **notifications.ts** (488 lines) - Notification management
- **quickSort.ts** (214 lines) - Quick sort view state
- **taskCanvas.ts** (491 lines) - Canvas task state
- **taskCore.ts** (234 lines) - Core task utilities
- **taskScheduler.ts** (359 lines) - Task scheduling
- **theme.ts** (138 lines) - Theme management

## Key Composables

### Unified Undo/Redo System (`src/composables/useUnifiedUndoRedo.ts`)
**Critical system** - Replaces all conflicting undo/redo implementations:
- Uses VueUse's `useManualRefHistory` for consistent state tracking
- 50-entry capacity with deep cloning
- Task operations: create, update, delete with undo support
- JSON-based state serialization for persistence

### Database Operations (`src/composables/useDatabase.ts`)
**IndexedDB abstraction layer**:
- LocalForage integration with automatic fallbacks
- Type-safe generic save/load operations
- Error handling and data validation
- Performance optimizations with debounced writes

## Task Management System

### Task Data Model
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
  instances: TaskInstance[]    // Calendar occurrences (NEW)
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

### Task Instance System
**New flexible scheduling system**:
- Tasks can have multiple calendar instances
- Backward compatibility with legacy scheduledDate/scheduledTime
- Instance-specific pomodoro tracking
- "Later" instances for indefinite scheduling

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

### Critical Bug Fixes (October 2025)
1. **Task Dragging Constraints** - Removed `extent: 'parent'` to allow free movement
2. **Section Height Restoration** - Added `collapsedHeight` tracking for perfect restoration
3. **Task Transparency** - Improved visibility of completed tasks

## Development Patterns

### Component Structure
```vue
<script setup lang="ts">
// Imports at top
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'

// Props and emits
interface Props {
  taskId: string
  variant?: 'default' | 'compact'
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})

// Store and composable usage
const taskStore = useTaskStore()
const { createTaskWithUndo } = useUnifiedUndoRedo()

// Reactive state
const isLoading = ref(false)
const localState = computed(() => taskStore.getTask(props.taskId))

// Methods
const handleClick = async () => {
  isLoading.value = true
  try {
    await createTaskWithUndo({ title: 'New Task' })
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(() => {
  // Initialization
})
</script>
```

### Store Pattern
```typescript
export const useTaskStore = defineStore('tasks', () => {
  // State
  const tasks = ref<Task[]>([])
  const projects = ref<Project[]>([])

  // Getters
  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status !== 'done')
  )

  // Actions
  const createTask = async (taskData: Partial<Task>) => {
    const task: Task = {
      id: generateId(),
      title: taskData.title || '',
      description: taskData.description || '',
      // ... rest of task
    }
    tasks.value.push(task)
    await saveToDatabase()
    return task
  }

  return {
    tasks,
    activeTasks,
    createTask
  }
})
```

## Testing Strategy

### Playwright Testing (Mandatory)
**CRITICAL: Always verify with Playwright MCP before claiming functionality works**

```typescript
// Example test pattern
test('task creation workflow', async ({ page }) => {
  await page.goto('http://localhost:5546')

  // Create task via quick add
  await page.fill('[data-testid="quick-task-input"]', 'Test task')
  await page.press('[data-testid="quick-task-input"]', 'Enter')

  // Verify task appears
  await expect(page.locator('[data-testid="task-card"]')).toContainText('Test task')
})
```

### Vitest Unit Testing
```typescript
// Store testing example
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

describe('Task Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates task with default values', () => {
    const store = useTaskStore()
    const task = store.createTask({ title: 'Test' })

    expect(task.status).toBe('planned')
    expect(task.priority).toBe(null)
  })
})
```

## Database Architecture

### IndexedDB Schema
```typescript
export const DB_KEYS = {
  TASKS: 'tasks',           // Main task storage
  PROJECTS: 'projects',     // Project definitions
  CANVAS: 'canvas',         // Canvas layout data
  TIMER: 'timer',          // Timer session history
  SETTINGS: 'settings',    // App preferences
  VERSION: 'version'       // Schema version tracking
} as const
```

### Persistence Strategy
- **Debounced saves** (1 second) to prevent excessive writes
- **Auto-migration** for schema changes
- **Backward compatibility** preservation
- **Error recovery** with graceful degradation

## Design System

### Design Tokens
Located in `src/assets/design-tokens.css`:
- Color system with CSS custom properties
- Typography scale and spacing system
- Animation timing functions
- Shadow and border radius libraries

### Tailwind Configuration
**Extensive customization** (`tailwind.config.js`, 592 lines):
- Custom color palette mapped to design tokens
- Component classes (`.task-base`, `.btn`, etc.)
- Canvas-specific utilities
- GPU acceleration helpers

### Glass Morphism Theme
- Consistent dark/light mode support
- Backdrop filters for modern glass effects
- Smooth transitions between themes
- CSS custom property integration

## Port Management

### Development Ports
- **Main Application**: `http://localhost:5546` (npm run dev)
- **Storybook**: `http://localhost:6006` (npm run storybook)
- **Design System**: Alternative to Storybook on port 6008

### Port Conflict Resolution
The application uses port 5546 by default. Vite will auto-allocate alternative ports if 5546 is occupied.

## Key Development Rules

### MUST Follow
1. **Test with Playwright First** - Visual confirmation is mandatory before claiming features work
2. **Preserve npm kill script** - NEVER remove the "kill" script from package.json (line 9) - it's critical for process cleanup
3. **Use Design Tokens** - Never hardcode colors, spacing, or typography values
4. **Maintain Backward Compatibility** - Especially for data migrations and task scheduling
5. **Type Safety** - All new code must have proper TypeScript types
6. **Component Structure** - Follow established patterns for script setup, props, and state management

### Best Practices
1. **Composables over Mixins** - Use Vue 3 composables for reusable logic
2. **Pinia for State** - Centralized state management with proper reactivity
3. **Error Boundaries** - Wrap components in error handling
4. **Performance Optimization** - Use computed properties and debounced operations
5. **Accessibility** - Include ARIA labels and keyboard navigation

## Critical Gotchas

### Undo/Redo System
- **Always use unified system** - Don't create separate undo implementations
- **Save state before mutations** - Call `saveState()` before making changes
- **Test both directions** - Verify both undo and redo work correctly

### Canvas System
- **Task dragging constraints removed** - Tasks can now be dragged outside sections
- **Section collapse data** - Heights are preserved in `collapsedHeight` property
- **Vue Flow parent-child** - Understand parentNode relationships for proper rendering

### Task Instances
- **Backward compatibility** - Legacy `scheduledDate`/`scheduledTime` still supported
- **Instance creation** - Use `getTaskInstances()` helper for consistent access
- **Calendar integration** - Instances enable flexible multi-date scheduling

### Database Operations
- **Debounced saves** - Don't manually call save, let the system handle it
- **Type safety** - Use generic `<T>` type parameters for database operations
- **Error handling** - Always wrap database operations in try/catch

## Development Workflow

### 1. Feature Development
```bash
# Start development
npm run dev

# Make changes following established patterns
# Test in browser at localhost:5546

# CRITICAL: Verify with Playwright
npm run test

# If tests pass, commit changes
git add .
git commit -m "feat: description"
```

### 2. Debugging Process
1. **Browser DevTools** - Check console for errors
2. **Vue DevTools** - Inspect component state and store data
3. **Playwright MCP** - Automated visual verification
4. **Network Tab** - Verify IndexedDB operations

### 3. Performance Monitoring
- **Lighthouse** - Check performance scores
- **Vue DevTools Performance** - Profile component updates
- **Bundle Analysis** - `npm run build` and analyze output

## Common Issues & Solutions

### **Task Creation Not Working**
1. Check undo/redo system is properly initialized
2. Verify task store has database connection
3. Test with Playwright for visual confirmation
4. Check browser console for errors

### **Canvas Tasks Not Dragging**
1. Verify Vue Flow parent-child relationships
2. Check if `extent: 'parent'` constraint is removed
3. Test drag handlers in TaskNode.vue
4. Verify mouse event propagation

### **Database Not Persisting**
1. Check LocalForage instance configuration
2. Verify browser supports IndexedDB
3. Check for quota exceeded errors
4. Test with manual save operations

### **Theme Switching Issues**
1. Verify CSS custom properties are loaded
2. Check Naive UI theme configuration
3. Test design token application
4. Verify Tailwind dark mode configuration

## File Organization

### Project Documentation
**⚠️ CRITICAL FILES - DO NOT DELETE - Keep these files updated as the project evolves:**

- **`CLAUDE.md`** (this file) - Development guidance for Claude Code
  - Update when adding new patterns, gotchas, or best practices
  - Document new major features and their architecture
  - Keep technology stack and port information current

- **`README.md`** - User-facing project overview
  - Update for major feature additions
  - Keep setup instructions accurate

### When Adding New Features
1. **Components** - Add to appropriate feature directory
2. **Composables** - Create in `/src/composables/` if reusable
3. **Store Logic** - Add to existing stores or create new if needed
4. **Types** - Add TypeScript interfaces near implementation
5. **Tests** - Create corresponding test files
6. **Documentation** - Update `CLAUDE.md` if introducing new patterns

### Naming Conventions
- **Components**: PascalCase (TaskCard.vue, CalendarView.vue)
- **Composables**: camelCase with `use` prefix (useTaskManager.ts)
- **Stores**: camelCase (taskStore, canvasStore)
- **Utilities**: camelCase (formatDateKey.ts)
- **CSS Classes**: kebab-case with BEM-style modifiers

---

**Last Updated**: December 1, 2025
**Framework Version**: Vue 3.4.0, Vite 7.2.4, TypeScript 5.9.3
**Development Focus**: Productivity application with advanced task management and Pomodoro integration