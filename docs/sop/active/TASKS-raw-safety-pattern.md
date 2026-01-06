# SOP: _raw* Safety Pattern for Pinia Stores

**Category**: TASKS (cross-cutting architecture)
**Status**: Active Reference
**Last Updated**: January 6, 2026
**Related Task**: TASK-101

---

## Overview

The `_raw*` safety pattern is an architectural safety measure to prevent accidental display of soft-deleted or hidden items in UI components. Components should default to filtered data, while mutations and internal operations use raw data.

---

## The Problem

### Root Cause (BUG discovered January 2026)

Components were directly accessing store arrays (e.g., `taskStore.tasks`) which included:
- Soft-deleted items (`_soft_deleted: true`)
- Hidden items (`isVisible: false`)

This caused deleted tasks to reappear in Calendar inbox because `CalendarInboxPanel.vue` used `taskStore.tasks` instead of `taskStore.filteredTasks`.

### The Pattern

**Before (Unsafe)**:
```typescript
// In store
const tasks = ref<Task[]>([])

return {
  tasks,  // Components access raw data directly
}
```

**After (Safe)**:
```typescript
// In store
// SAFETY: Named _rawTasks to discourage direct access
const _rawTasks = ref<Task[]>([])

// SAFETY: Filtered for display - excludes soft-deleted
const filteredTasks = computed(() =>
  _rawTasks.value.filter(t => !t._soft_deleted)
)

return {
  tasks: filteredTasks,  // Components get filtered data by default
  _rawTasks,             // For internal operations only
}
```

---

## Implementation Details

### Naming Convention

| Raw Ref Name | Exported As | Used For |
|--------------|-------------|----------|
| `_rawTasks` | `tasks` (filtered) | Task display in UI |
| `_rawNotifications` | `notifications` (filtered) | Notification display |
| `_rawGroups` | `groups` (filtered by visibility) | Canvas group display |
| `_rawProjects` | `projects` (filtered, future-proofed) | Project display |

### When to Use Raw vs Filtered

| Operation | Use Which | Why |
|-----------|-----------|-----|
| Display in components | Filtered (`tasks`) | Don't show deleted items |
| CRUD mutations | Raw (`_rawTasks.value`) | Need to mutate actual array |
| Save to database | Raw (`_rawTasks.value`) | Save all including soft-deleted |
| Sync operations | Raw (`_rawTasks.value`) | Sync all data |
| Find by ID (internal) | Raw (`_rawTasks.value.find()`) | May need to find soft-deleted |

---

## Stores Refactored

### 1. tasks.ts (Primary)

```typescript
// State
const _rawTasks = ref<Task[]>([])

// SAFETY: Filtered tasks for display - excludes soft-deleted
const filteredTasks = computed(() =>
  _rawTasks.value.filter(t => !t._soft_deleted)
)

// All mutations use _rawTasks.value
const createTask = async (taskData: Partial<Task>) => {
  _rawTasks.value.push(newTask)
}

return {
  tasks: filteredTasks,  // Safe default
  _rawTasks,             // For internal use
  filteredTasks,         // Explicit access
}
```

### 2. notifications.ts

```typescript
const _rawNotifications = ref<PomodoroNotification[]>([])

const notifications = computed(() =>
  _rawNotifications.value.filter(n => !n._soft_deleted)
)
```

### 3. canvas.ts (groups with isVisible flag)

```typescript
// SAFETY: Named _rawGroups to discourage direct access
const _rawGroups = ref<CanvasGroup[]>([])

// SAFETY: Filtered groups for display - excludes hidden groups
const visibleGroups = computed(() =>
  _rawGroups.value.filter(g => g.isVisible !== false)
)

return {
  groups: visibleGroups,
  _rawGroups,
  // Aliases for backward compatibility
  sections: visibleGroups,
  _rawSections: _rawGroups,
}
```

### 4. projects.ts (Future-proofed)

```typescript
// SAFETY: Named _rawProjects to discourage direct access
const _rawProjects = ref<Project[]>([])

// SAFETY: Filtered projects for display
// Future: could filter out _soft_deleted projects if that feature is added
const projects = computed(() => _rawProjects.value)

// projectMap uses _rawProjects for complete lookup coverage
const projectMap = computed(() => {
  const map = new Map<string, Project>()
  for (const p of _rawProjects.value) {
    map.set(p.id, p)
  }
  return map
})
```

---

## Stores Not Needing This Pattern

| Store | Reason |
|-------|--------|
| `taskCanvas.ts` | Utility store, no soft-delete/visibility logic |
| `quickSort.ts` | Historical session data only |
| `timer.ts` | Timer session history, no filtering needed |

---

## Critical Mutation Rules

### Rule 1: Always Mutate _rawX.value

```typescript
// ✅ CORRECT: Mutate raw ref
_rawTasks.value.push(newTask)
_rawTasks.value.splice(index, 1)
_rawTasks.value[index] = updatedTask

// ❌ WRONG: Trying to mutate computed
tasks.value.push(newTask)  // Error: computed is readonly
```

### Rule 2: Save from _rawX

```typescript
// ✅ CORRECT: Save all tasks including soft-deleted
await saveTasks(_rawTasks.value)

// ❌ WRONG: Would lose soft-deleted tasks!
await saveTasks(filteredTasks.value)
```

### Rule 3: Load into _rawX

```typescript
// ✅ CORRECT
const loadFromDatabase = async () => {
  const loadedTasks = await fetchTasks()
  _rawTasks.value = loadedTasks  // Assign to raw ref
}
```

### Rule 4: Lookup for Internal Operations

```typescript
// ✅ CORRECT: Use raw for lookups that might need soft-deleted items
const task = _rawTasks.value.find(t => t.id === taskId)

// Also acceptable: Use filtered when you know you want visible only
const visibleTask = tasks.value.find(t => t.id === taskId)
```

---

## Verification Checklist

When applying this pattern to a new store:

- [ ] Rename state ref from `xxx` to `_rawXxx`
- [ ] Create filtered computed property
- [ ] Export filtered as the original name (for backward compatibility)
- [ ] Export raw with `_raw` prefix for internal operations
- [ ] Update ALL mutations to use `_rawXxx.value`
- [ ] Update load functions to assign to `_rawXxx.value`
- [ ] Update save functions to save from `_rawXxx.value`
- [ ] Run `npm run build` - should pass
- [ ] Test that UI doesn't show deleted/hidden items
- [ ] Test that CRUD operations still work

---

## Related Files

| File | Changes |
|------|---------|
| `src/stores/tasks.ts` | `_rawTasks` + `filteredTasks` |
| `src/stores/tasks/taskOperations.ts` | Uses `_rawTasks` for mutations |
| `src/stores/tasks/taskPersistence.ts` | Uses `_rawTasks` for load/save |
| `src/stores/tasks/taskHistory.ts` | Uses `_rawTasks` for undo/redo |
| `src/stores/notifications.ts` | `_rawNotifications` + `notifications` |
| `src/stores/canvas.ts` | `_rawGroups` + `visibleGroups` |
| `src/stores/projects.ts` | `_rawProjects` + `projects` |

---

## Rollback

If issues arise, revert the pattern by:
1. Rename `_rawXxx` back to `xxx`
2. Remove computed wrappers
3. Remove `_raw*` exports
4. Ensure components that relied on filtered data add their own filters

---

**Key Insight**: The `_raw*` prefix acts as a visual warning to developers that they're accessing unfiltered data. Components should almost always use the filtered export (original name), while only internal store operations should use `_raw*`.
