---
name: task-list-view
description: Expert skill for the Task List / Catalog view system — TaskList, HierarchicalTaskRow, row sub-components, grouping, sorting, filtering, DnD, selection, and inline editing. Use when debugging list rendering, fixing overdue styling, modifying row components, adding columns, changing grouping/sorting logic, or working on AllTasksView/BoardView list mode.
---

## When to Use This Skill

- Debugging task list rendering issues (missing tasks, wrong order, broken groups)
- Modifying row components (title, priority, due date, project, estimate, actions)
- Fixing overdue/timer-active styling
- Working on grouping, sorting, or filtering logic
- Adding new columns or inline editing capabilities
- Fixing drag-and-drop in list view (cross-group transfer, subtask nesting)
- Working on AllTasksView or BoardView's list sub-view
- Selection / bulk actions issues

## Architecture Overview

### Component Hierarchy

```
AllTasksView (orchestrator — owns sorting, grouping, filtering, all handlers)
  └─ TaskList (group rendering, selection, DnD routing, AI popover)
       └─ HierarchicalTaskRow (recursive — owns row state + actions via composables)
            └─ HierarchicalTaskRowContent (actual DOM grid row)
                 ├─ DoneToggle / checkbox
                 ├─ TaskRowTitle (expand/collapse subtasks, pin/recurrence badges)
                 ├─ TaskRowProject (teleported dropdown — project selector)
                 ├─ CustomSelect (inline status dropdown — NOT a separate component)
                 ├─ TaskRowPriority (teleported dropdown — priority selector)
                 ├─ TaskRowDueDate (teleported dropdown — date picker with overdue styling)
                 ├─ Progress bar (inline)
                 ├─ TaskRowEstimate (teleported dropdown — duration picker)
                 └─ TaskRowActions (AI suggest, focus mode, timer, edit, duplicate)
```

### File Locations (VERIFIED)

| File | Path | Lines | Role |
|------|------|-------|------|
| AllTasksView | `src/views/AllTasksView.vue` | ~905 | Orchestrator — sorting, grouping, handlers |
| BoardView | `src/views/BoardView.vue` | ~400 | Uses TaskList in "list" sub-view |
| BoardView CSS | `src/views/BoardView.css` | ~400 | List-mode overflow rules |
| TaskList | `src/components/tasks/TaskList.vue` | ~730 | Group headers, selection, DnD routing |
| HierarchicalTaskRow | `src/components/tasks/HierarchicalTaskRow.vue` | ~157 | Recursive row wrapper |
| HierarchicalTaskRowContent | `src/components/tasks/HierarchicalTaskRowContent.vue` | ~230 | Grid row DOM (NOT in row/ subdirectory!) |
| HierarchicalTaskRow.css | `src/components/tasks/HierarchicalTaskRow.css` | ~280 | Unscoped grid + state CSS |
| useTaskRowState | `src/composables/tasks/row/useTaskRowState.ts` | ~119 | All reactive row state |
| useTaskRowActions | `src/composables/tasks/row/useTaskRowActions.ts` | ~217 | All interaction handlers |
| TaskRowTitle | `src/components/tasks/row/TaskRowTitle.vue` | ~188 | Title text + expand + badges |
| TaskRowDueDate | `src/components/tasks/row/TaskRowDueDate.vue` | ~370 | Date picker + overdue classes |
| TaskRowPriority | `src/components/tasks/row/TaskRowPriority.vue` | ~326 | Priority badge + dropdown |
| TaskRowProject | `src/components/tasks/row/TaskRowProject.vue` | ~349 | Project emoji + dropdown |
| TaskRowEstimate | `src/components/tasks/row/TaskRowEstimate.vue` | ~338 | Duration picker |
| TaskRowActions | `src/components/tasks/row/TaskRowActions.vue` | ~99 | Action buttons (hover-revealed) |
| Task types | `src/types/tasks.ts` | ~248 | Task, TaskGroup interfaces |
| useTaskFiltering | `src/composables/tasks/useTaskFiltering.ts` | ~356 | Smart view filter engine |

**CRITICAL:** `HierarchicalTaskRowContent.vue` is at `src/components/tasks/`, NOT `src/components/tasks/row/`. There is NO `TaskRowStatus.vue` — status uses an inline `CustomSelect` inside `HierarchicalTaskRowContent.vue`.

## Data Flow

```
taskStore.filteredTasks (applies smart view + project + status + duration filters)
  → AllTasksView local hideDoneTasks filter
    → sortedTasks (sort by: dueDate/priority/title/created/manual/status/progress/estimatedTime)
      → groupedTasks (group by: none/project/status/priority/dueDate)
        → TaskList receives { tasks: sortedTasks, groups: groupedTasks }
          → Renders group.parentTasks via HierarchicalTaskRow (NOT group.tasks!)
```

## TaskGroup Interface

```typescript
interface TaskGroup {
  key: string              // Unique group ID (project UUID, status value, 'noDate', 'day-2026-03-31')
  title: string            // Display name
  emoji?: string           // Optional emoji for header
  color?: string | string[]  // Color dot (hex or gradient pair)
  tasks: Task[]            // ALL tasks in group (used for count badge, AI suggest)
  parentTasks: Task[]      // ROOT-LEVEL tasks only — what HierarchicalTaskRow iterates!
  indent?: number          // Visual indent for nested project groups
}
```

**CRITICAL:** `parentTasks` is what gets rendered. `tasks` is for metadata only (counts, AI batch). If `parentTasks` is empty, zero tasks render even if `tasks` is populated. This was a confirmed bug in BoardView's `listViewGroups` computed.

## CSS Grid Layout

Defined in `HierarchicalTaskRow.css` (UNSCOPED — intentional for cross-component styling):

```
Grid: 32px 1fr 40px 120px 72px 96px 72px 72px 112px
Areas: "done title project status priority due progress estimate actions"
Mobile (≤768px): 40px 1fr 40px → "done title project" only
```

**Cross-component CSS dependency:** `.task-row__actions` opacity is controlled in `HierarchicalTaskRow.css`, not in `TaskRowActions.vue`'s scoped styles. Rule: `.task-row:hover .task-row__actions { opacity: 1 }`. Any new action buttons get visibility for free.

**State classes on `.task-row`:**
- `task-row--selected` → teal left border + bg tint
- `task-row--timer-active` → amber pulse animation (uses `--timer-active-border`, `--timer-active-glow`)
- `task-row--drop-target` → drop hover highlight
- `data-status` attribute → left border color by status

## Overdue Detection (3 independent implementations!)

| Location | Method | Timezone-safe? |
|----------|--------|----------------|
| `useTaskRowState.ts:70-77` | `new Date(dueDate)` + `setHours(0,0,0,0)` | NO — UTC parse risk |
| `TaskRowDueDate.vue:127-140` | Same `new Date()` + `diffDays` calculation | NO — UTC parse risk |
| `AllTasksView.vue:479-491` | `dueDate.split('T')[0].split('-')` → `new Date(y, m-1, d)` | YES — local constructor |

**The correct pattern** (timezone-safe) is AllTasksView's approach:
```typescript
const [y, m, d] = task.dueDate.split('T')[0].split('-').map(Number)
const dueDate = new Date(y, m - 1, d) // local midnight, no UTC shift
```

**Overdue CSS classes** (in `TaskRowDueDate.vue`):
- `task-row__due-date--overdue` → `color: var(--color-danger)` (red)
- `task-row__due-date--today` → amber
- `task-row__due-date--soon` → blue (≤3 days)

## Drag-and-Drop Architecture

**Two-layer system:**

### Layer 1: Row-level DnD (`useTaskRowActions`)
- `handleDragStart` → creates `DragData`, calls `useDragAndDrop().startDrag` for ghost pill
- `handleDrop` → reads `activeDragData.value` FIRST (singleton), falls back to `dataTransfer.getData()` (WebKitGTK compatibility!)
- Emits `moveTask(dragTaskId, targetProjectId, targetTaskId)`

### Layer 2: Group-level DnD (`TaskList`)
- `applyGroupTransfer` intercepts `moveTask` when `groupBy !== 'none'`
- Maps drop target to property update instead of subtask nesting:
  - `groupBy === 'project'` → updates `projectId`
  - `groupBy === 'status'` → updates `status`
  - `groupBy === 'priority'` → updates `priority`
  - `groupBy === 'dueDate'` → updates `dueDate` (handles `day-YYYY-MM-DD` keys by slicing prefix)
- Drop on group header → `onHeaderDrop` → `applyGroupTransfer` directly
- Multi-drag: augments drag payload with all `selectedTaskIds`

**When `groupBy === 'none'`:** Drop on task = make subtask (via `moveTask` with `targetParentId`).

## Selection System

- `selectedTaskIds: ref<string[]>` — internal to TaskList
- `selectionMode: computed` — true when any tasks selected
- Ctrl+Click on checkbox → enters multi-select
- Select-all per group (indeterminate state supported)
- Bulk action bar replaces column headers: **Edit (BatchEditModal), Delete (ConfirmationModal), Clear**
- Exposed to parent via `defineExpose({ selectedTaskIds, clearSelection, expandAll, collapseAll })`

## Grouping Logic (AllTasksView.groupedTasks)

| groupBy | Buckets | Key format |
|---------|---------|------------|
| `'none'` | Single group `key: 'all'` | `'all'` |
| `'project'` | Recursive project tree → children → orphans → uncategorized at top | project UUID |
| `'status'` | `todo`, `done` | status string |
| `'priority'` | `high`, `medium`, `low`, `none` | priority string |
| `'dueDate'` | `overdue`, `today`, `tomorrow`, per-weekday, `later`, `noDate` | `'day-YYYY-MM-DD'` or bucket name |

**Persistent state:** `collapsedGroupKeys` via `usePersistentRef('flowstate:catalog-collapsed-groups')`.

## Teleported Dropdown Pattern

All row sub-components (DueDate, Priority, Project, Estimate) follow the same pattern:
1. `Teleport to="body"` — avoids overflow clipping from row/group containers
2. `calculateDropdownPosition()` — `getBoundingClientRect()` + auto-flip above if insufficient space below
3. Click-outside detection — checks both `triggerWrapperRef` and `dropdownRef`
4. Close on: Escape key, click-outside, scroll event

## Event Chain

```
HierarchicalTaskRowContent emits granular events:
  updateStatus(val), updatePriority(val), updateDueDate(val), updateEstimate(val), updateProjectId(val)
    ↓
HierarchicalTaskRow catches each → re-emits as single: updateTask(taskId, { field: val })
    ↓
TaskList passes through: updateTask(taskId, updates) → parent
    ↓
AllTasksView handler: handleUpdateTask → validates, calls taskStore.updateTask()
```

## Consumers

### AllTasksView (primary consumer)
- Passes: `tasks`, `groups`, `groupBy`, `emptyMessage`, `sortBy`, `sortDirection`
- Handles ALL 14 events from TaskList
- Uses `taskListRef` for `selectedTaskIds`, `expandAll`, `collapseAll`, `clearSelection`

### BoardView (list sub-view)
- Passes: `tasks` (allFilteredTasks), `groups` (listViewGroups), `groupBy="project"`, `density`
- Handles subset of events: `select`, `startTimer`, `edit`, `updateTask`, `contextMenu`
- **Must also handle:** `toggleComplete`, `moveTask`, `deleteSelected`, `addTaskToGroup`
- **CRITICAL:** `listViewGroups` must populate BOTH `tasks` AND `parentTasks` arrays
- **CSS:** `.kanban-scroll-container.list-mode .kanban-board` overflow must allow TaskList to scroll

## Persisted Refs (localStorage keys)

| Key | Type | Default | Used by |
|-----|------|---------|---------|
| `flowstate:catalog-collapsed-groups` | `string[]` | `[]` | TaskList — collapsed group keys |
| `flowstate:all-tasks-sort-by` | `string` | `'dueDate'` | AllTasksView |
| `flowstate:all-tasks-sort-direction` | `'asc'\|'desc'` | `'asc'` | AllTasksView |
| `flowstate:all-tasks-group-by` | `string` | `'none'` | AllTasksView |
| `flowstate-catalog-view-mode` | `'list'\|'table'` | `'list'` | AllTasksView (DEPRECATED after merge) |
| `flowstate-show-all-week-days` | `boolean` | `false` | AllTasksView (dueDate grouping) |

## Common Pitfalls

1. **Iterating `group.tasks` instead of `group.parentTasks`** → double-renders subtasks
2. **Forgetting WebKitGTK DnD fallback** → `activeDragData.value` first, then `dataTransfer.getData()`
3. **Adding scoped CSS for `.task-row__actions`** → won't work, must be in unscoped `HierarchicalTaskRow.css`
4. **Using `new Date(dateString)` for overdue check** → UTC parse risk, use `new Date(y, m-1, d)` instead
5. **Not populating `parentTasks` in new group computeds** → TaskList renders zero tasks
6. **Modifying `HierarchicalTaskRowContent` path assumption** → it's at `src/components/tasks/`, NOT `row/`
7. **Cross-group DnD in grouped mode** → goes through `applyGroupTransfer`, not subtask nesting
8. **`data-task-id` attribute** → required on rows for AI popover positioning
