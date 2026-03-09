# SOP: Task Store Patterns & Reactivity

**Category**: TASKS
**Status**: Active Reference
**Last Updated**: January 2026
**Merged From**: task-store-refactoring-sop.md, SOP-task-reactivity-persistence.md

---

## Overview

Comprehensive guide for working with the task store, including refactoring strategies, reactivity patterns, and persistence solutions. Critical reading before modifying `src/stores/tasks.ts`.

---

## 1. Task Store Architecture

### File Overview

| File | Lines | Purpose |
|------|-------|---------|
| `src/stores/tasks.ts` | ~3,000 | Main task store (state, CRUD, filtering) |
| `src/stores/tasks/taskPersistence.ts` | ~500 | PouchDB persistence layer |
| `src/stores/projects.ts` | ~600 | Project management (extracted) |

### Core State

```typescript
interface TaskStoreState {
  tasks: Ref<Task[]>
  projects: Ref<Project[]>
  isLoadingFromDatabase: boolean  // CRITICAL: Prevents sync loops
}
```

---

## 2. Reactivity Patterns

### Problem: Delayed UI Updates

**Symptom**: Editing task title/status doesn't reflect until page refresh.

**Root Cause**: Over-optimized caching bypassed Vue's reactivity.

### Cache Hash Bug

```typescript
// ❌ WRONG: Hash only uses IDs - misses property changes
const currentHash = tasks.map(t => t.id).join('|')

// ✅ CORRECT: Include mutable properties in hash
const currentHash = tasks.map(t =>
  `${t.id}:${t.title}:${t.status}:${t.priority}:${t.updatedAt?.getTime()}`
).join('|')
```

### Fingerprint Pattern

For computed properties that group/filter tasks:

```typescript
const getTasksFingerprint = (tasks: Task[]) => {
  return tasks.map(t => `${t.id}:${t.updatedAt?.getTime()}`).join('|')
}

// Use in computed
const groupedTasks = computed(() => {
  const fingerprint = getTasksFingerprint(tasks.value)
  // fingerprint changes when ANY task updates
  return groupTasksByStatus(tasks.value)
})
```

---

## 3. Persistence & Sync Safety

### The isLoadingFromDatabase Flag

**CRITICAL**: Prevents infinite sync loops.

```typescript
// Line 152 in tasks.ts
let isLoadingFromDatabase = false

// Set during load
const loadFromDatabase = async () => {
  isLoadingFromDatabase = true
  try {
    // Load tasks from PouchDB
    const data = await db.get('tasks')
    tasks.value = data.items
  } finally {
    isLoadingFromDatabase = false
    console.log('✅ Database load complete, auto-save re-enabled')
  }
}

// Check in watcher
watch(
  () => tasks.value,
  () => {
    if (isLoadingFromDatabase) {
      console.log('⏸️ Skipping auto-save during database load')
      return
    }
    saveState()
  },
  { deep: true }
)
```

### Sync Loop Prevention

**The Loop Pattern**:
1. Live sync pulls changes
2. `loadFromDatabase()` called
3. Debug code modifies tasks with `Date.now()`
4. Watch triggers auto-save
5. Auto-save pushes to remote
6. Remote receives "new" data
7. Live sync detects changes → **INFINITE LOOP**

**Prevention**:
- Never use `Date.now()` in load paths
- Always check `isLoadingFromDatabase` before saving
- Use one-time flags for debug code

---

## 4. Zombie Task Prevention (BUG-037)

### Problem

Deleted tasks reappear after sync because PouchDB merges datasets.

### Solution: Deletion Intent Tracking

```typescript
// Track deleted task IDs in local-only document
const DELETED_TASKS_DOC = '_local/deleted-tasks'

const trackDeletion = async (taskId: string) => {
  const doc = await db.get(DELETED_TASKS_DOC).catch(() => ({ deletedIds: [] }))
  doc.deletedIds.push(taskId)
  await db.put(doc)
}

// Filter on load
const loadFromDatabase = async () => {
  const deletedIds = await getDeletedTaskIds()
  const allTasks = await db.get('tasks')
  tasks.value = allTasks.filter(t => !deletedIds.includes(t.id))
}
```

---

## 5. Refactoring Strategy

### When to Refactor

- Store exceeds 2,000 lines
- Multiple unrelated domains in same file
- Circular dependencies between stores

### Module Boundaries

Break down by logical domain:

| Module | Contents |
|--------|----------|
| Core State | `ref` declarations, basic CRUD |
| Filtering | Computed properties, grouping logic |
| Migrations | One-time data transformations |
| External Domain | Logic for other entities (extract) |

### Dependency Injection Pattern

```typescript
// useTaskFiltering.ts
export const useTaskFiltering = (
  tasks: Ref<Task[]>,
  activeProjectId: Ref<string | null>
) => {
  const filteredByProject = computed(() =>
    tasks.value.filter(t =>
      !activeProjectId.value || t.projectId === activeProjectId.value
    )
  )
  return { filteredByProject }
}

// In store
const { filteredByProject } = useTaskFiltering(tasks, activeProjectId)
```

### Circular Dependency Solution

```typescript
// ❌ WRONG: Top-level import causes circular dependency
import { useProjectStore } from './projects'
const projectStore = useProjectStore()

// ✅ CORRECT: Lazy access inside actions
const getProjectName = (projectId: string) => {
  const projectStore = useProjectStore()  // Access when needed
  return projectStore.projects.find(p => p.id === projectId)?.name
}
```

### Backward Compatibility

When extracting logic, re-export from original store:

```typescript
// src/stores/tasks.ts
const projectStore = useProjectStore()

return {
  ...taskActions,
  // Delegated for backward compatibility
  createProject: projectStore.createProject,
  projects: computed(() => projectStore.projects),
}
```

---

## 6. Adding New Task Fields

When adding a visible field (e.g., `assignee`, `tags`):

### Step 1: Update Type

```typescript
// src/types/tasks.ts
interface Task {
  // ...existing fields
  assignee?: string  // NEW
}
```

### Step 2: Update Cache Hash (CanvasView.vue)

```typescript
const currentHash = currentTasks.map(t =>
  `${t.id}:${t.title}:${t.status}:${t.priority}:${t.assignee}:${t.updatedAt?.getTime()}`
).join('|')
```

### Step 3: Ensure updatedAt Updates

```typescript
const updateTask = (taskId: string, updates: Partial<Task>) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (task) {
    Object.assign(task, updates, { updatedAt: new Date() })
  }
}
```

---

## 7. Debugging Tips

### Console Log Patterns

```
📝 [updateTask] Task X updated with {...}
🔄 Task state updated, triggering save
⏸️ Skipping auto-save during database load
✅ Database load complete, auto-save re-enabled
```

### Verification Commands

```javascript
// In browser console
taskStore = useTaskStore()
taskStore.tasks.length  // Check task count
taskStore.tasks.find(t => t.id === 'xxx')  // Find specific task
```

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Task edits not showing | Cache hash missing field | Add field to hash |
| Infinite sync loop | Missing `isLoadingFromDatabase` check | Add guard |
| Deleted tasks return | No deletion tracking | Implement tracking |
| Circular dependency | Top-level store import | Use lazy access |

---

## 8. Verification Checklist

- [ ] **Build Check**: `npm run build` passes
- [ ] **Data Hydration**: Refresh app, data persists
- [ ] **Undo/Redo**: Operations work correctly
- [ ] **Lint**: New files have 0 errors
- [ ] **Canvas Updates**: Title/status changes reflect immediately
- [ ] **Board Updates**: Same as canvas

---

## 9. Related Files

| File | Purpose |
|------|---------|
| `src/views/CanvasView.vue` | Uses cache hash for task rendering |
| `src/components/kanban/KanbanSwimlane.vue` | Uses fingerprint for grouping |
| `src/utils/individualTaskStorage.ts` | Task-level persistence |
| `src/composables/useUnifiedUndoRedo.ts` | Undo/redo integration |

---

**Key Insight**: Most task store issues stem from Vue reactivity edge cases. Always include mutable fields in cache hashes, and protect load operations with the `isLoadingFromDatabase` flag.
