# TASK-157: ADHD-Friendly View Redesign - Detailed Design

## 1. Executive Summary
**Goal**: Replace "God Components" (`HierarchicalTaskRow`, `TaskCard`) with lightweight, focused, and visually calm components.
**Core Philosophy**: "Calm by Default." Information should be revealed on hover/focus, not constantly shouting at the user.
**Key Feature**: Robust **Bulk Operations** (Gmail/Todoist style) to allow rapid processing of tasks, essential for ADHD workflows (cleaning up "doom piles").

## 2. Architecture: Bulk Selection System

### 2.1 `useBulkSelection.ts`
A global composable (scoped to the active view) that manages the set of selected task IDs.

```typescript
interface BulkSelectionState {
  selectedIds: Set<string>
  lastSelectedId: string | null // For Shift+Click range selection
  isSelectionActive: boolean
}

interface BulkSelectionActions {
  toggle(id: string, event: MouseEvent): void // Handles Ctrl/Shift logic
  selectRange(fromId: string, toId: string): void
  selectAll(ids: string[]): void
  clear(): void
}
```

### 2.2 `useBulkActions.ts`
The "Acting" layer that operations on the selection.

```typescript
const { updateTasks, deleteTasks } = useBulkActions()

// Example Usage
await updateTasks(selectedIds, { status: 'done' })
await updateTasks(selectedIds, { priority: 'high' })
```

### 2.3 `BulkActionBar.vue`
A floating, dynamic bottom bar (like Gmail's mobile or desktop action bar) that appears when `isSelectionActive` is true.
- **Position**: Fixed bottom-center (z-index: high).
- **Actions**:
  - Done / Undone
  - Date (Reschedule)
  - Priority (1/2/3/4)
  - Project (Move)
  - Delete (Trash)
  - Clear Selection (X)

## 3. Component Redesign

### 3.1 Catalog View (`CatalogView.vue`)
Replaces the current generic table/list implementations.
- **Modes**: List (Simple), Table (Structured Columns).
- **Density**: Compact (32px rows), Comfortable (48px rows).
- **Virtualization**: Uses `vue-virtual-scroller` (existing in project?) or simple pagination to handle 1000+ tasks without DOM overload.

### 3.2 `TaskRowCompact.vue`
The core atomic unit for List/Table views.
**Layout (Left to Right)**:
1.  **Drag Handle**: Invisible unless hovered (6 dots).
2.  **Selection Checkbox**: Replaces the status circle on hover OR specific column in Table mode.
3.  **Status Circle**: Click to complete.
4.  **Content**: Text title.
5.  **Meta (Conditional)**:
    -   *Due Date*: Red if overdue, grey if future.
    -   *Tags*: Small pill, max 2 visible.
    -   *Subtasks*: `1/3` icon only if exist.
6.  **Actions (Hover only)**: Edit, Date, Delete.

### 3.3 `KanbanCardCompact.vue`
Replaces `TaskCard.vue`.
**Changes**:
-   **Remove**: Banner image (distracting).
-   **Remove**: Full description preview (clutter).
-   **Style**: Flat white/dark card, single pixel border selection.
-   **Focus**: Title + Priority Color Border + 1 key metadata line.

## 4. Interaction Design
**Keyboard Shortcuts** (Global when view is focused):
-   `x`: Select current focused task.
-   `Shift + Up/Down`: Extend selection.
-   `Ctrl + A`: Select all in current group/view.
-   `Esc`: Clear selection.
-   `#`: Delete selected.
-   `1-4`: Set Priority of selected.
-   `e`: Archive/Done selected.

## 5. Transition Strategy to "Do This Properly"
We will not overwrite existing views immediately. We will build parallel "Next" views.

1.  **Build Foundation**: `useBulkSelection` + `BulkActionBar`.
2.  **Build Components**: Create `src/components/catalog/...` directory.
3.  **Route**: Add `/catalog-next` or toggle in Settings -> "Try New View".
4.  **Verify**: Ensure drag-and-drop works with the new lighter DOM.
5.  **Replace**: Once feature parity is reached (subtasks, editing), swap the imports.

## 6. Execution Plan (Refined)

### Phase 1: Logic Core
- [ ] Implement `useBulkSelection.ts` (with multi-select logic tests).
- [ ] Implement `useBulkActions.ts` (with Supabase batch updates).

### Phase 2: The "Compact" UI Components
- [ ] Implement `TaskRowCompact.vue` - The pixel-perfect calm row.
- [ ] Implement `BulkActionBar.vue` - The interaction hub.

### Phase 3: The Catalog View
- [ ] Implement `CatalogView.vue` - The orchestrator.
- [ ] Integrate with `TaskRowCompact`.

### Phase 4: Integration
- [ ] Add "View Switcher" to Sidebar.
- [ ] Test with large datasets (1000+ tasks).

## 7. Questions for User
- **Virtualization**: Do we need to support 1000+ tasks per view? (If yes, we probably need `vue-virtual-scroller` or similar).
- **Subtasks**: In "Compact Mode", should subtasks be indented rows (tree view) or just a metadata icon "1/5"? (Suggestion: Tree view for Project Lists, Icon for Smart Lists like "Today").
