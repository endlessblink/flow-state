# CLAUDE.md

# NEVER EVER CLAIM SUCCSESS THAT SOMETHING IS READY, DONE, READY FOR PRODUCTION ETC UNTILL THE USER CONFIRMS IT by actually testing or using the feature!!!!


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pomo-Flow** is a sophisticated Vue 3 productivity application that combines Pomodoro timer functionality with task management across multiple views (Board, Calendar, Canvas). It features a unified undo/redo system, PouchDB + CouchDB persistence, and a custom design system with glass morphism aesthetics.

## Current Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| Canvas | ✅ Working | All major bugs fixed |
| Calendar | ⚠️ Partial | Resize issues remain |
| CouchDB Sync | ✅ Working | Manual sync operational |
| Build/CI | ✅ Passing | GitHub Actions active |

**Full Tracking**: See `docs/MASTER_PLAN.md` for:
- Active work (TASK-XXX)
- Bug tracking (BUG-XXX)
- Roadmap items (ROAD-XXX)
- Known issues (ISSUE-XXX)

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
- **PouchDB** (v9.0.0) - Local-first database with IndexedDB adapter
- **CouchDB** (remote) - Optional cross-device synchronization
- **Singleton Pattern** - Single database instance across all stores
- **Conflict Detection** - Built-in conflict detection and resolution

### Development Tools
- **Vitest** (v3.2.4) for unit testing
- **Playwright** for end-to-end testing
- **Storybook** (v10.1.4) for component documentation (port 6006)
- **ESLint** (v8.55.0) with TypeScript support

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
├── composables/              # Vue 3 composables (64 files)
├── assets/                   # Static assets and styles
└── utils/                    # Utility functions
```

## State Management (Pinia Stores)

### Task Store (`src/stores/tasks.ts`)
**Largest store (3,073 lines)** - Central task management with:
- Task CRUD operations with undo/redo support
- Project hierarchy with nesting support
- Task instances system for calendar scheduling
- PouchDB persistence with debounced saves
- Smart views (Today, Weekend) with complex filtering
- Backward compatibility with legacy scheduled fields

### Canvas Store (`src/stores/canvas.ts`)
**Second largest (1,464 lines)** - Canvas-specific state:
- Vue Flow integration for node-based canvas
- Section management (priority, status, project sections)
- Collapsible sections with data preservation
- Multi-selection and batch operations
- Connection management for task dependencies
- Viewport controls and zoom management

### Timer Store (`src/stores/timer.ts`)
**Pomodoro timer functionality (534 lines)**:
- Session management with work/break cycles
- Settings persistence in localStorage
- Browser notification integration
- Task-specific timer sessions
- Session history tracking

### UI Store (`src/stores/ui.ts`)
Application UI state (269 lines):
- Sidebar visibility states
- Theme management integration
- Modal and overlay controls
- Board density settings
- Active view management

### Additional Stores
- **auth.ts** (515 lines) - Authentication state
- **local-auth.ts** (302 lines) - Local authentication
- **notifications.ts** (540 lines) - Notification management
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
**PouchDB abstraction layer (953 lines)**:
- Direct PouchDB integration with IndexedDB adapter
- Optional CouchDB remote sync via useReliableSyncManager
- Conflict detection and monitoring
- Health monitoring with automatic retry logic
- Type-safe generic save/load operations
- Singleton pattern for shared database instance

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

### PouchDB + CouchDB Stack
```typescript
// Configuration from src/config/database.ts
export interface DatabaseConfig {
  local: { name: string; adapter?: string }
  remote?: { url: string; auth?: { username: string; password: string } }
  sync?: { live: boolean; retry: boolean; timeout?: number }
}
```

### Local Storage (PouchDB)
- **Adapter**: IndexedDB (`adapter: 'idb'`)
- **Database Name**: `pomoflow-app-dev`
- **Features**: Auto-compaction, revision limiting (5)
- **Singleton**: Single instance shared across all stores

### Remote Sync (CouchDB)
- **Optional**: Configured via environment variables
- **Live Sync**: Real-time bidirectional synchronization
- **Retry Logic**: Automatic reconnection with backoff
- **Conflict Detection**: Built-in with manual resolution UI

### Document Structure
```typescript
export const DB_KEYS = {
  TASKS: 'tasks',           // Main task storage
  PROJECTS: 'projects',     // Project definitions
  CANVAS: 'canvas',         // Canvas layout data
  TIMER: 'timer',           // Timer session history
  SETTINGS: 'settings',     // App preferences
  NOTIFICATIONS: 'notifications'  // Notification state
} as const
```

### Persistence Strategy
- **Debounced saves** (1 second) to prevent excessive writes
- **Auto-migration** for schema changes
- **Backward compatibility** preservation
- **Error recovery** with graceful degradation
- **Conflict resolution** via enterprise-grade system

## Cross-Device Synchronization

### Architecture Overview
- **Local-First**: All data stored locally in PouchDB first
- **Sync Optional**: CouchDB sync is opt-in via settings
- **Conflict Resolution**: Enterprise-grade system with UI

### Configuration
Environment variables for CouchDB sync:
- `VITE_COUCHDB_URL` - CouchDB server URL
- `VITE_COUCHDB_USERNAME` - Authentication username
- `VITE_COUCHDB_PASSWORD` - Authentication password

### Key Files
- `src/config/database.ts` - Database configuration
- `src/composables/useDatabase.ts` - PouchDB abstraction (953 lines)
- `src/composables/useReliableSyncManager.ts` - Sync orchestration
- `src/composables/useCouchDBSync.ts` - CouchDB-specific sync
- `docs/conflict-systems-resolution/` - Conflict resolution docs

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

### UI Component & Design Token Standards

**⚠️ CRITICAL: All design tokens are defined in:**
`.claude/skills/🎨 css-design-token-enforcer/assets/token_definitions.json`

**Quick Reference - Mandatory Components:**

| Component Type | Standard Component | Key Rule |
|----------------|-------------------|----------|
| **Dropdowns** | `CustomSelect.vue` | NEVER use native `<select>` |
| **Context Menus** | `ContextMenu.vue` | NEVER use browser context menus |
| **Modals** | `BaseModal.vue`, `BasePopover.vue` | Dark glass morphism required |

**When user says "fix dropdowns"** → Replace native `<select>` with `CustomSelect` component

**Full token definitions including:**
- Priority colors (`--color-priority-high`, `--color-priority-medium`, `--color-priority-low`)
- UI component specs (dropdown, context menu, modal backgrounds/borders/shadows)
- Alpha variants and glow effects
- Enforcement rules and forbidden patterns

See `token_definitions.json` for complete specifications

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
7. **Check Task Dependencies** - Before starting work, check the Task Dependency Index in `docs/MASTER_PLAN.md`

### Task Dependency Workflow

**Before starting any task from MASTER_PLAN.md:**

1. **Read the Dependency Index Table** at the top of the Active Work section
2. **Check for file conflicts** - If your task's Primary Files overlap with an IN_PROGRESS task, warn the user
3. **Check dependencies** - If task has "Depends" entry, verify that task is DONE first
4. **Suggest alternatives** - If blocked, recommend parallel-safe tasks that don't conflict
5. **Update the table** - When starting work: change Status to IN_PROGRESS. When done: change to DONE

**Example conflict detection:**
```
TASK-024 wants to modify tasks.ts
TASK-022 is IN_PROGRESS and also modifies tasks.ts
→ WARN: "TASK-024 conflicts with IN_PROGRESS TASK-022 (both modify tasks.ts).
   Recommend working on TASK-014 or TASK-023 instead."
```

### Automatic Task Locking (Multi-Instance Coordination)

**This project has automatic task locking to prevent multiple Claude Code instances from editing the same task files simultaneously.**

**How it works:**
1. **PreToolUse hook** (`task-lock-enforcer.sh`) runs before every Edit/Write operation
2. If the file belongs to a MASTER_PLAN tracked task, the hook checks `.claude/locks/`
3. If another session owns the lock → **Edit is BLOCKED with exit code 2**
4. If no lock exists → Lock is acquired and edit proceeds

**What you'll see when blocked:**
```
TASK CONFLICT BLOCKED: Cannot edit tasks.ts

TASK-022 is currently locked by another Claude Code session.
  - Locked by session: abc123...
  - Locked at: 2025-12-20 09:58:58

To resolve:
1. Wait for the other session to complete
2. Or manually delete: .claude/locks/TASK-022.lock
```

**Session lifecycle:**
- **SessionStart**: You'll be informed of any active locks from other sessions
- **SessionEnd**: Your locks are automatically released

**Lock files location:** `.claude/locks/TASK-XXX.lock`
**Lock expiry:** 4 hours (stale locks auto-cleaned)

**SOP Reference:** `docs/🐛 debug/sop/multi-instance-task-locking-2025-12-20.md`

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

## Standard Operating Procedures (SOPs)

**Location**: `docs/🐛 debug/sop/`

SOPs document production fixes with root cause analysis, solution steps, and rollback procedures.

### Active SOPs (14 total)
| SOP | Purpose |
|-----|---------|
| sync-loop-fix-2025-12-16 | Task position reset infinite loop fix |
| competing-systems-consolidation-2025-12-03 | Unified undo/redo consolidation |
| calendar-resize-artifacts-2025-12-02 | Calendar grid resize fixes |
| sidebar-categories-fix-2025-11-28 | Smart view count fixes |
| canvas-development-safety-2025-12-04 | Canvas safety guidelines |

### When to Create SOPs
- After fixing production bugs
- When implementing complex system changes
- For rollback procedures

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
1. Check PouchDB instance is initialized (singleton pattern)
2. Verify browser supports IndexedDB
3. Check for quota exceeded errors
4. Test with manual save operations
5. Check CouchDB sync status if remote sync enabled

### **Theme Switching Issues**
1. Verify CSS custom properties are loaded
2. Check Naive UI theme configuration
3. Test design token application
4. Verify Tailwind dark mode configuration

### **Tasks Mysteriously Disappearing (BUG-020)**
A built-in task disappearance logger exists for debugging data loss:
- **Location**: `src/utils/taskDisappearanceLogger.ts`
- **Skill**: Use `dev-debug-data-loss` skill for detailed instructions
- **Currently**: Auto-enabled on app startup (for BUG-020 investigation)

Quick console commands:
```javascript
window.taskLogger.getDisappearedTasks()  // Check for disappeared tasks
window.taskLogger.printSummary()          // Get logging summary
window.taskLogger.exportLogs()            // Export for analysis
```

## File Organization

### Project Documentation
**⚠️ CRITICAL FILES - DO NOT DELETE - Keep these files updated as the project evolves:**

- **`CLAUDE.md`** (this file) - Development guidance for Claude Code
  - Update when adding new patterns, gotchas, or best practices
  - Document new major features and their architecture
  - Keep technology stack and port information current

- **`docs/MASTER_PLAN.md`** - Project roadmap, ideas, and active work tracking
  - **Ideas Section**: When user says "add to ideas" or "I have an idea", add it here
  - **Roadmap Section**: When user says "add to roadmap", add feature with priority
  - **Active Work Section**: Track current implementation progress with steps and rollback commands
  - When user says "process an idea" or "pick up from ideas", look here first
  - Update status when features are completed or bugs are fixed

### MASTER_PLAN.md Task ID Format (MANDATORY)

**All items in MASTER_PLAN.md MUST have unique IDs. Use the following prefixes:**

| Prefix | Usage | Example |
|--------|-------|---------|
| `TASK-XXX` | Active work features/tasks | `TASK-001: Power Groups Feature` |
| `BUG-XXX` | Bug fixes | `BUG-003: Today group shows wrong count` |
| `ROAD-XXX` | Roadmap items | `ROAD-002: Smart Group bug fixes` |
| `IDEA-XXX` | Ideas | `IDEA-001: New feature concept` |
| `ISSUE-XXX` | Known issues | `ISSUE-001: Live sync lost on refresh` |

**Format Rules:**
1. IDs must be sequential within their type (TASK-001, TASK-002, TASK-003...)
2. Completed items should have `~~strikethrough~~` on the ID: `~~TASK-001~~`
3. Tables MUST include an ID column as the first column
4. When adding new items, find the highest existing ID and increment by 1
5. Never reuse IDs - even after deletion

**Example Table Format:**
```markdown
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| ROAD-001 | Feature name | P1 | IN PROGRESS |
| ~~ROAD-002~~ | ~~Done feature~~ | ~~P1~~ | ✅ DONE |
```

**When to assign IDs:**
- Adding new roadmap items → use `ROAD-XXX`
- Adding new bugs → use `BUG-XXX`
- Adding new active work tasks → use `TASK-XXX`
- Adding new ideas → use `IDEA-XXX`
- Documenting known issues → use `ISSUE-XXX`

### Dev-Manager Kanban Compatibility (IMPORTANT)

The dev-manager at `http://localhost:6010` parses MASTER_PLAN.md. For tasks to display correctly:

**Task Header Format:**
```markdown
### TASK-XXX: Task Title (STATUS)
### ~~TASK-XXX~~: Completed Task Title (✅ DONE)
```

**Status Keywords** (parser detects these in header or body):
| Status | Keywords Detected | Column |
|--------|-------------------|--------|
| Done | `DONE`, `COMPLETE`, `✅`, `~~strikethrough~~` | Done |
| In Progress | `IN PROGRESS`, `IN_PROGRESS`, `🔄`, `ACTIVE` | In Progress |
| Review | `REVIEW`, `MONITORING`, `👀` | Review |
| Todo | Default (no status keyword) | To Do |

**Priority Format:**
- In header: `(P1)`, `(HIGH)`, `(P2-MEDIUM)`
- Or as line: `**Priority**: P1-HIGH`

**Progress via Subtasks:**
```markdown
- [x] Completed step ✅
- [x] Another done step
- [ ] Pending step
```
Parser calculates: 2/3 = 67% progress

**Full formatting guide**: See `docs/MASTER_PLAN.md` → "Formatting Guide for AI/Automation"

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

**Last Updated**: December 16, 2025
**Framework Version**: Vue 3.4.0, Vite 7.2.4, TypeScript 5.9.3
**Database**: PouchDB 9.0.0 + CouchDB (optional sync)
**Development Focus**: Productivity app with advanced task management, Pomodoro integration, and cross-device sync