# Board View Refactor Prompt

**Task ID**: TASK-191
**Priority**: P1
**Estimated Effort**: 24-32 hours
**Dependencies**: Follow patterns from TASK-184 (Canvas Rebuild)

---

## Context

You are refactoring the Board View system in a Vue 3 + TypeScript + Pinia application. The Board View currently scores **4.5/10** in a tech debt audit with critical issues that mirror problems found in the Canvas system (which required a complete rebuild).

**Goal**: Reduce complexity, improve performance, and establish maintainable patterns - WITHOUT breaking existing functionality.

---

## Current State (Problems to Fix)

### File Overview

| File | LOC | Issues |
|------|-----|--------|
| `src/views/BoardView.vue` | 835 | God object, 10 try-catch, 40+ console.log |
| `src/components/kanban/KanbanSwimlane.vue` | 798 | 6-level nesting, ineffective cache |
| `src/components/kanban/TaskCard.vue` | 637 | Excessive CSS (61%), inline badge logic |
| `src/components/kanban/KanbanColumn.vue` | 387 | Duplicate local state |

**Total**: ~2,657 LOC across 4 core files

### Critical Anti-Patterns

1. **God Object** (`BoardView.vue`)
   - Handles: filters, modals, context menus, settings, CRUD, density settings
   - Should be: ~200-300 lines max, delegating to composables

2. **Deep Watchers** (`BoardView.vue:182-190`)
   ```typescript
   // PROBLEM: Fires on ANY change to filtered tasks or projects
   watch([filteredTasks, projects], handler, { deep: true })
   ```
   - Solution: Use `watchDebounced` from VueUse or watch specific fields

3. **Triple State Copying**
   - Tasks are copied to `localTasks` in BoardView, Swimlane, AND Column
   - Creates sync issues and performance overhead
   - Solution: Single source of truth from store, pass refs down

4. **Scattered Try-Catch** (13 blocks)
   - Error handling is inconsistent and verbose
   - Solution: Centralized error boundary or composable

5. **Console.log Pollution** (60+ statements)
   - Remove all before refactoring

---

## Target Architecture

### New File Structure

```
src/
├── views/
│   └── BoardView.vue              # ~200 LOC - Layout + orchestration only
├── composables/
│   └── board/
│       ├── useBoardState.ts       # Task filtering, swimlane data
│       ├── useBoardActions.ts     # CRUD operations
│       ├── useBoardModals.ts      # Modal state management
│       ├── useBoardContextMenu.ts # Context menu logic
│       └── useBoardDensity.ts     # Density/display settings
├── components/
│   └── kanban/
│       ├── KanbanSwimlane.vue     # ~300 LOC - Project swimlane
│       ├── KanbanColumn.vue       # ~200 LOC - Status column
│       ├── TaskCard.vue           # ~200 LOC - Task display
│       └── TaskCardBadges.vue     # NEW - Extracted badge logic
```

### Composable Pattern (Follow Canvas)

Use dependency injection pattern like Canvas rebuild:

```typescript
// useBoardState.ts
interface BoardStateDependencies {
  taskStore: ReturnType<typeof useTaskStore>
  projectStore: ReturnType<typeof useProjectStore>
  filterStore: ReturnType<typeof useFilterStore>
}

export function useBoardState(deps: BoardStateDependencies) {
  const { taskStore, projectStore, filterStore } = deps

  // Computed with specific field watching
  const tasksByProject = computed(() => {
    // Group tasks by project
  })

  // Use throttled watcher for expensive operations
  watchThrottled(
    () => filterStore.activeFilters,
    () => { /* recalculate */ },
    { throttle: 100 }
  )

  return {
    tasksByProject,
    projectsWithTasks,
    // ...
  }
}
```

---

## Implementation Phases

### Phase 1: Preparation (2-3 hours)

1. **Remove console.log statements**
   ```bash
   grep -rn "console.log" src/views/BoardView.vue src/components/kanban/
   ```
   Remove all 60+ occurrences.

2. **Create composables directory**
   ```bash
   mkdir -p src/composables/board
   ```

3. **Add baseline test**
   - Verify current functionality works before changes
   - Take screenshots of board in different states

### Phase 2: Extract Composables (8-10 hours)

#### 2.1 Extract `useBoardModals.ts`

From BoardView.vue, extract:
- `showEditModal`, `showQuickTaskCreate`, `showConfirmModal` refs
- `handleEditTask`, `closeEditModal`, `handleQuickTaskCreate` functions
- Modal-related event handlers

```typescript
// src/composables/board/useBoardModals.ts
import { ref } from 'vue'
import type { Task } from '@/types/tasks'

export function useBoardModals() {
  const showEditModal = ref(false)
  const showQuickTaskCreate = ref(false)
  const showConfirmModal = ref(false)
  const selectedTask = ref<Task | null>(null)
  const taskToDelete = ref<Task | null>(null)

  const openEditModal = (task: Task) => {
    selectedTask.value = task
    showEditModal.value = true
  }

  const closeEditModal = () => {
    showEditModal.value = false
    selectedTask.value = null
  }

  // ... other modal handlers

  return {
    showEditModal,
    showQuickTaskCreate,
    showConfirmModal,
    selectedTask,
    taskToDelete,
    openEditModal,
    closeEditModal,
    // ...
  }
}
```

#### 2.2 Extract `useBoardContextMenu.ts`

From BoardView.vue, extract:
- `showContextMenu`, `contextMenuX`, `contextMenuY`, `contextMenuTask` refs
- `handleContextMenu`, `closeContextMenu` functions

#### 2.3 Extract `useBoardActions.ts`

From BoardView.vue, extract:
- `handleSelectTask`, `handleStartTimer`, `handleDeleteTask`, `handleMoveTask`
- `handleAddTask`, `confirmDeleteTask`, `cancelDeleteTask`

Use centralized error handling:
```typescript
export function useBoardActions(deps: { taskStore: any; timerStore: any }) {
  const { taskStore, timerStore } = deps

  const handleWithError = async <T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T | null> => {
    try {
      return await operation()
    } catch (error) {
      console.error(errorMessage, error)
      // Could emit to error boundary
      return null
    }
  }

  const deleteTask = (taskId: string) =>
    handleWithError(
      () => taskStore.deleteTask(taskId),
      'Failed to delete task'
    )

  // ...
}
```

#### 2.4 Extract `useBoardDensity.ts`

From BoardView.vue, extract:
- `currentDensity` ref and related logic
- `showDoneColumn` toggle
- Settings persistence (pick ONE source: localStorage OR Supabase)

#### 2.5 Extract `useBoardState.ts`

This is the main data composable:
```typescript
export function useBoardState(deps: BoardStateDependencies) {
  const tasksByProject = computed(() => {
    const grouped: Record<string, Task[]> = {}
    for (const task of deps.taskStore.filteredTasks) {
      const projectId = task.projectId || 'inbox'
      if (!grouped[projectId]) grouped[projectId] = []
      grouped[projectId].push(task)
    }
    return grouped
  })

  const projectsWithTasks = computed(() => {
    return deps.projectStore.projects.filter(p =>
      tasksByProject.value[p.id]?.length > 0
    )
  })

  const totalDisplayedTasks = computed(() =>
    Object.values(tasksByProject.value).flat().length
  )

  return { tasksByProject, projectsWithTasks, totalDisplayedTasks }
}
```

### Phase 3: Refactor BoardView.vue (4-6 hours)

After extracting composables, BoardView.vue should become:

```vue
<script setup lang="ts">
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useTimerStore } from '@/stores/timer'

// Composables
import { useBoardState } from '@/composables/board/useBoardState'
import { useBoardActions } from '@/composables/board/useBoardActions'
import { useBoardModals } from '@/composables/board/useBoardModals'
import { useBoardContextMenu } from '@/composables/board/useBoardContextMenu'
import { useBoardDensity } from '@/composables/board/useBoardDensity'

// Stores
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const timerStore = useTimerStore()

// Composables with dependencies
const { tasksByProject, projectsWithTasks, totalDisplayedTasks } =
  useBoardState({ taskStore, projectStore })

const { deleteTask, moveTask, startTimer } =
  useBoardActions({ taskStore, timerStore })

const {
  showEditModal, showQuickTaskCreate, showConfirmModal,
  selectedTask, openEditModal, closeEditModal
} = useBoardModals()

const {
  showContextMenu, contextMenuX, contextMenuY, contextMenuTask,
  openContextMenu, closeContextMenu
} = useBoardContextMenu()

const { currentDensity, showDoneColumn, showFilters, toggleDoneColumn } =
  useBoardDensity()
</script>

<template>
  <!-- Same template, but much cleaner script -->
</template>
```

**Target**: ~200-250 LOC for BoardView.vue

### Phase 4: Fix Child Components (6-8 hours)

#### 4.1 KanbanSwimlane.vue

**Current issues**:
- 798 LOC with 6-level nesting
- Maintains its own `localTasks` copy
- Ineffective computed caching

**Fix**:
- Remove `localTasks` - use props directly
- Extract column rendering logic to simple computed
- Reduce to ~300 LOC

```vue
<script setup lang="ts">
// Props are the source of truth - no local copying
const props = defineProps<{
  project: Project
  tasks: Task[]
  showDoneColumn: boolean
  density: DensityType
}>()

// Simple computed, no local state
const tasksByStatus = computed(() => {
  const result: Record<TaskStatus, Task[]> = {
    todo: [], in_progress: [], done: []
  }
  for (const task of props.tasks) {
    result[task.status].push(task)
  }
  return result
})
</script>
```

#### 4.2 KanbanColumn.vue

**Current issues**:
- Duplicate local state pattern
- 387 LOC

**Fix**:
- Remove local task copying
- Use VueDraggable with direct store updates
- Reduce to ~200 LOC

#### 4.3 TaskCard.vue + TaskCardBadges.vue

**Current issues**:
- 637 LOC with 61% CSS
- 7 inline badge types

**Fix**:
1. Extract `TaskCardBadges.vue` component:
   ```vue
   <script setup lang="ts">
   defineProps<{
     priority: Priority
     dueDate?: Date
     projectColor?: string
     estimatedPomodoros?: number
     completedPomodoros?: number
     hasSubtasks?: boolean
     subtaskProgress?: { done: number; total: number }
   }>()
   </script>
   ```

2. Move 400+ lines of CSS to separate file or use Tailwind classes

3. Reduce TaskCard.vue to ~200 LOC

### Phase 5: Watcher Optimization (2-3 hours)

Replace all deep watchers with specific watches:

```typescript
// BEFORE (fires on every task property change)
watch(filteredTasks, handler, { deep: true })

// AFTER (fires only on structural changes)
import { watchDebounced } from '@vueuse/core'

watchDebounced(
  () => filteredTasks.value.map(t => t.id).join(','),
  () => { /* handle task list changes */ },
  { debounce: 100 }
)

// For status changes specifically
watch(
  () => filteredTasks.value.map(t => `${t.id}:${t.status}`),
  () => { /* handle status changes */ }
)
```

---

## Verification Checklist

After each phase, verify:

- [ ] `npm run build` passes with no new errors
- [ ] `npm run lint` passes
- [ ] Board View renders correctly
- [ ] Tasks display in correct swimlanes
- [ ] Drag-drop between columns works
- [ ] Context menu works
- [ ] Edit modal opens/saves correctly
- [ ] Delete confirmation works
- [ ] Density toggle works
- [ ] Done column toggle works
- [ ] Filter controls work

### Manual Testing Script

```
1. Open Board View
2. Create task in Inbox
3. Drag task to "In Progress" column
4. Right-click task → Edit
5. Change project → Save
6. Verify task moved to new swimlane
7. Toggle density (compact/comfortable)
8. Toggle Done column visibility
9. Delete task with confirmation
10. Refresh page - verify state persists
```

---

## Files to Modify

### Create New Files
- `src/composables/board/useBoardState.ts`
- `src/composables/board/useBoardActions.ts`
- `src/composables/board/useBoardModals.ts`
- `src/composables/board/useBoardContextMenu.ts`
- `src/composables/board/useBoardDensity.ts`
- `src/components/kanban/TaskCardBadges.vue`

### Modify Existing Files
- `src/views/BoardView.vue` (835 → ~200 LOC)
- `src/components/kanban/KanbanSwimlane.vue` (798 → ~300 LOC)
- `src/components/kanban/KanbanColumn.vue` (387 → ~200 LOC)
- `src/components/kanban/TaskCard.vue` (637 → ~200 LOC)

### Do NOT Modify
- `src/stores/tasks.ts` - Store is source of truth
- `src/stores/projects.ts` - Store is source of truth
- Any other views or unrelated components

---

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| BoardView.vue LOC | 835 | <250 |
| Total Board system LOC | 2,657 | <1,200 |
| Deep watchers | 2 | 0 |
| Console.log statements | 60+ | 0 |
| Try-catch blocks | 13 | <3 (centralized) |
| Health Score | 4.5/10 | 7+/10 |

---

## Reference Patterns

Look at these files for established patterns:

1. **Canvas Composables** (good examples):
   - `src/composables/canvas/useCanvasSync.ts` - Dependency injection
   - `src/composables/canvas/useCanvasActions.ts` - Action handlers
   - `src/composables/canvas/useCanvasParentChild.ts` - State management

2. **Existing Board Tests** (if any):
   - Check `src/stories/kanban/` for Storybook stories

---

## IMPORTANT RULES

1. **Do NOT break existing functionality** - Verify after each change
2. **One composable at a time** - Extract, test, commit
3. **Remove console.log FIRST** - Clean before refactoring
4. **No new features** - This is refactoring only
5. **Update MASTER_PLAN.md** - Mark progress as you go
6. **Commit after each phase** - Small, reversible commits

---

## Getting Started

```bash
# 1. Create a new branch
git checkout -b refactor/board-view-TASK-191

# 2. Verify current state works
npm run dev
# Manually test board functionality

# 3. Remove console.log first
grep -rn "console.log" src/views/BoardView.vue src/components/kanban/
# Remove all occurrences

# 4. Start with Phase 2.1 (useBoardModals)
mkdir -p src/composables/board
# Extract modal logic...
```

Good luck!
