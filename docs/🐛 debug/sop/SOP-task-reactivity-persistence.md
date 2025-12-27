# SOP: Task Persistence and Reactivity Solution

**For:** Engineering Team
**Created:** December 25, 2025
**Context:** Resolution of "Task updates only show after refresh" and Zombie Task issues.

---

## 1. Problem Overview

Users experienced two critical persistence-related issues:
1.  **Delayed UI Updates:** Editing a task (title/description) in the Canvas or Board view did not reflect immediately. Changes only appeared after a page refresh.
2.  **Zombie Tasks (BUG-037):** Deleted tasks would sometimes reappear after a refresh, especially when using multiple devices or aggressive sync.

## 2. Root Cause Analysis

### Delayed UI Updates
The root cause was **over-optimized caching** in VUE components that bypassed Vue's reactivity system.

*   **`CanvasView.vue`**: Used computed properties (`filteredTasksWithProjectFiltering`, etc.) with manually generated "hash" strings to prevent unnecessary re-renders.
    *   *The Flaw:* The hash generation logic only included `id`, `position`, and `status`. It **omitted** `title`, `description`, and `updatedAt`.
    *   *Result:* When a user changed a title, the hash remained identical, so the component returned the cached (stale) array.

*   **`KanbanSwimlane.vue`**: Used a manual cache for grouping tasks by date/status.
    *   *The Flaw:* The cache key relied primarily on `tasks.length`.
    *   *Result:* Editing a task didn't change the array length, so the cache wasn't invalidated, and the Board showed stale data.

### Zombie Tasks (BUG-037)
The root cause was **lack of deletion intent tracking** in the sync logic.
*   PouchDB/CouchDB sync effectively merges datasets. If a remote database had a task that was locally deleted (but the deletion marker was lost or overridden by a "newer" update from another source), the task would be resurrected.

---

## 3. The Solution

### A. Reactivity Fixes (Canvas & Board)

**1. Comprehensive Hashing in `CanvasView.vue`**
We updated the hash generation to be content-aware. It now uses a composite key of all visual fields.

```typescript
// Old (Problematic):
// `${t.id}:${t.status}:${t.canvasPosition?.x}`

// New (Correct):
// Includes title, description, and timestamp to force updates on content change
`${t.id}:${t.title}:${t.description}:${t.updatedAt?.getTime()}:${t.canvasPosition?.x}...`
```

**2. Content Fingerprinting in `KanbanSwimlane.vue`**
We replaced the simple "length check" with a fingerprint function.

```typescript
const getTasksFingerprint = (tasks: Task[]) => {
  return tasks.map(t => `${t.id}:${t.updatedAt?.getTime()}`).join('|')
}
```
This ensures that if *any* task in the list updates its timestamp, the cache key changes and the UI re-renders.

### B. Persistence & Zombie Prevention (BUG-037)

**1. Deletion Intent Tracking**
We implemented a local-only document (`_local/deleted-tasks`) that tracks IDs of tasks the user explicitly deleted.

**2. `syncDeletedTasks` Function**
Located in `src/utils/individualTaskStorage.ts`. This function is correctly called during `saveTasksToStorage` and `loadFromDatabase`.
*   **On Load:** It filters out any incoming tasks that match IDs in the deletion tracking list.
*   **On Save:** It ensures deletion markers are propagated.

---

## 4. Maintenance Guidelines

### Adding New Task Fields
If you add a new visible field to the `Task` interface (e.g., `assignee`, `tags`):
1.  **Update `CanvasView.vue` Hash:** You MUST add the new field to the `currentHash` map function in `filteredTasks` computed properties. Failure to do this will result in the new field not updating on the canvas.
2.  **Update `KanbanSwimlane.vue` Fingerprint:** Ensure `updatedAt` is modified whenever the new field changes. The current fingerprint relies on `updatedAt`, so as long as `updatedAt` is managed correctly in the store, this should work automatically.

### Debugging Tips
*   **Logging:** Enhanced logging is enabled in `src/stores/tasks.ts`. Look for `📝 [updateTask]` and `🔄 Task state updated` logs in the console to verify state transitions.
*   **Verification:** Always test edits on *both* Canvas and Board views. They use different rendering pipelines and caching strategies.

---

## 5. Related Files
- `src/views/CanvasView.vue`
- `src/components/kanban/KanbanSwimlane.vue`
- `src/stores/tasks.ts`
- `src/utils/individualTaskStorage.ts`
