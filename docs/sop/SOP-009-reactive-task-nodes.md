# SOP-009: Reactive Task Nodes in Vue Flow

**Created**: 2026-01-16
**Status**: Active
**Related**: BUG-291, TASK-255

## Problem Statement

Vue Flow nodes display task data from **snapshots** rather than reactive store references. When a task is updated in the Pinia store, the canvas node continues showing stale data until a full `syncNodes()` rebuild occurs.

### Symptoms
- Edit Task modal: pressing Enter updates the store instantly, but the canvas node title doesn't change for 2-3 seconds
- Drag-drop between groups: task's dueDate updates in store, but badge doesn't reflect the change
- Any task property change appears delayed on canvas

### Root Cause

1. **Node data is a snapshot**: In `useCanvasSync.ts`, nodes are built with:
   ```typescript
   data: {
     task: { ...task },  // SNAPSHOT - not reactive!
     label: task.title
   }
   ```

2. **Watcher only triggers on count changes**: The orchestrator's watcher (line 492) only watches `tasksWithCanvasPosition.value.length`, so property changes don't trigger `syncNodes()`.

3. **Component reads from props**: `TaskNode.vue` receives `task` as a prop from Vue Flow, which is the snapshot.

## Solution Pattern

### Make Component State Reactive to Store

In any composable that processes task data for display, read from the **store** instead of **props**:

```typescript
// useTaskNodeState.ts

import { useTaskStore } from '@/stores/tasks'

export function useTaskNodeState(props: { task: Task }) {
    const taskStore = useTaskStore()

    // BUG-291 FIX: Read from STORE (reactive) instead of PROPS (snapshot)
    const task = computed(() =>
        taskStore.tasks.find(t => t.id === props.task?.id) || props.task
    )

    // All other computed properties use task.value
    const statusLabel = computed(() => labels[task.value?.status] || 'Unknown')
    const formattedDueDate = computed(() => formatDate(task.value?.dueDate))
    // etc.

    return {
        task,  // Export reactive task
        statusLabel,
        formattedDueDate,
        // ...
    }
}
```

### Key Principles

1. **Props provide the ID, store provides the data**
   - Props: `props.task.id` (stable reference for finding the task)
   - Display: `task.value` (reactive data from store)

2. **Fallback to props for safety**
   - `taskStore.tasks.find(...) || props.task` ensures the component still works if the task is briefly missing from the store

3. **Don't change the sync mechanism**
   - `syncNodes()` still builds snapshots (needed for Vue Flow's internal tracking)
   - The reactivity happens at the component level, not the node level

## Files Modified (BUG-291)

| File | Change |
|------|--------|
| `src/composables/canvas/node/useTaskNodeState.ts` | Added reactive `task` computed, updated all property reads to use `task.value` |
| `src/components/canvas/TaskNode.vue` | Destructure `task` from composable for template use |
| `src/composables/tasks/useTaskEditActions.ts` | Use direct `updateTask()` + fire-and-forget undo for instant feedback |
| `src/components/tasks/TaskEditModal.vue` | Vue `<Transition>` with instant leave animation |

## Performance Considerations

- **Computed efficiency**: Vue's computed caching ensures the `find()` only re-runs when `taskStore.tasks` changes
- **No extra watchers**: We don't add deep watchers on the task store - reactivity is through computed refs
- **Minimal re-renders**: Only the specific TaskNode whose task changed will re-render

## When to Apply This Pattern

Apply this pattern when:
- A Vue Flow node component needs to display task data that changes frequently
- You see "stale data" issues where the store updates but the UI doesn't reflect it
- A component receives data through Vue Flow's node.data but needs live reactivity

Do NOT apply when:
- The data truly is static and won't change during the node's lifetime
- You're working on sync/orchestration code (that should remain read-only per SOP-002)

## Testing Checklist

- [ ] Edit task title in modal, press Enter - title updates instantly on canvas
- [ ] Change task status in modal - status badge updates instantly
- [ ] Drag task to different group - dueDate badge updates instantly
- [ ] Change task priority - priority indicator updates instantly
- [ ] Undo (Ctrl+Z) - changes revert and display updates instantly

## Related Documentation

- SOP-002: Canvas Geometry Invariants (sync is read-only)
- CLAUDE.md: Canvas Position Persistence rules
