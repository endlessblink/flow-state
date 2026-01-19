# Canvas Drag, Drop & Interaction System

**Last Updated**: January 18, 2026
**Components**: `useCanvasInteractions`, `useCanvasDragDrop`, `CanvasView`
**Related SOPs**: [CANVAS-POSITION-SYSTEM](./CANVAS-POSITION-SYSTEM.md)

---

## 1. Top-Level Safety Rules (The "Golden Rules")

1.  **Vue Flow Manages Children**: When a parent node moves, Vue Flow automatically moves its children visually because they use *relative positions*. **NEVER** manually update child positions when dragging a parent.
2.  **No `syncNodes()` After Drag**: Calling `syncNodes()` after a drag operation rebuilds the graph from the store, destroying the visual state and causing "position jumping".
3.  **Lock Before Write**: Always acquire a position lock *before* triggering a store update to prevent race conditions with watchers.
4.  **Mutate, Don't Replace**: When updating node data for reactivity (e.g., task counts), mutate `node.data` directly rather than replacing the node object.
5.  **Hash-Based Watchers Only**: Never use `deep: true` watchers on the task array. Use hash-strings of relevant properties to detect changes.

---

## 2. Drag & Drop Mechanics

### Nested Group Logic
The system supports infinite nesting of groups (Section -> Section -> Task).

*   **Visual Logic**:
    *   Parent `position` is ABSOLUTE.
    *   Child `position` is RELATIVE to Parent.
    *   When Parent drags, Child follows automatically.

*   **Store Logic**:
    *   Only the Parent's new absolute position is saved.
    *   Children in the store are **untouched** during a parent drag.

#### The "Settling Period"
To prevent "snap-back" issues where watchers trigger a re-sync immediately after a drag ends:
1.  **Drag End**: `isNodeDragging` = false.
2.  **Settling**: `isDragSettling` = true for **500ms**.
3.  **Completion**: `isDragSettling` = false.

*Sync is blocked during this entire window.*

### Position Locking System
To handle the delay between "User drops node" and "Database confirms save":
1.  **Acquire Lock**: `canvasStateLock.lockNode(id, x, y)` for 7 seconds.
2.  **Update Store**: `store.updatePosition(...)`.
3.  **Sync Protection**: If a sync triggers during this window, `syncNodes` will see the lock and **use the locked position** instead of the (potentially stale) database position.

---

## 3. Selection Standards

We follow standard desktop OS selection conventions.

### Interaction Rules

| Input | Action | Behavior |
|-------|--------|----------|
| **Click** | Select | Selects target. Deselects others (Replace). |
| **Click (on selected)** | Drag Prep | **Does NOT deselect others**. Allows dragging multiple items. |
| **Ctrl + Click** | Toggle | Toggles target state. Preserves others. |
| **Shift + Click** | Range/Toggle | Treated same as Ctrl+Click for now. |
| **Shift + Drag** | Box Select | Draws selection box. Selects all inside. |
| **Empty Click** | Deselect | Clears all selection. |

### Technical Implementation

#### Shift+Drag Box Selection
A known issue in Vue Flow captures drag events on nodes, preventing box selection starting *on top* of a group.
**Solution**:
1.  When `Shift` is held, a CSS class `.shift-selecting` is applied to the container.
2.  CSS enforces `pointer-events: none !important` on all nodes.
3.  Drag events fall through to the pane, triggering the native Selection Box.
4.  `nodes-draggable` is disabled when Shift is held.

#### Programmatic Selection
*   **Double-State Problem**: Vue Flow has `node.selected`. Pinia has `store.selectedIds`.
*   **Sync**: We use `applyNodeChanges` to drive Vue Flow selection, and a listener on `selectionChange` to update Pinia.

---

## 4. Updates & Reactivity

### Real-time Counters
Group task counts must update *instantly* when a task is dropped in/out.
*   **Pattern**: Use `useNode()` inside `GroupNodeSimple.vue`.
*   **Action**: `node.data.taskCount = newCount` (Direct Mutation).
*   **Result**: Reactivity triggers immediately without waiting for a full graph rebuild.

---

## 5. Troubleshooting Reference

### Common Symptoms

| Symptom | Cause | Fix |
|---------|-------|-----|
| **Positions reset 10s after move** | Race condition between sync and local state. | Ensure `lockNode` is called *before* store update. |
| **Child group doesn't move with parent** | `parentNode` not set or `extent` constraining it. | Verify `parentNode` matches `section-{id}`. Remove `extent` prop. |
| **Shift+Drag moves the group instead of selecting** | Nodes stealing pointer events. | Verify `.shift-selecting` CSS class is applied and `nodes-draggable` is false. |
| **Infinite loop / Browser Crash** | `deep: true` watcher or Store->Sync->Store cycle. | Use hash-watchers. Verify `isSyncing` guards. |

### Debug Logs (Console)
*   `🔒 [CANVAS-LOCK]`: Node locked for 7s.
*   `🛡️ [SYNC-BLOCK]`: Sync prevented by lock/guard.
*   `[TASK-072]`: Nested drag events.

---

## 6. Dangerous Anti-Patterns (NEVER DO)

1.  `watchEffect(() => syncNodes())`: Fires too early/often.
2.  `document.querySelectorAll(...)`: Never touch DOM directly; use Vue Flow state.
3.  `syncNodes()` on `dragStop`: **guaranteed** to break nested positions.
