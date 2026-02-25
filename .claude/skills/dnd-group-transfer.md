# Drag-and-Drop Group Transfer Skill

## When to Use
- Debugging drag-and-drop between grouped sections in the Catalog list/table views
- Adding drag-to-group support to new views
- Fixing timezone/date bugs in date-based group transfers

## Architecture Overview
- TaskList.vue (list mode) and TaskTable.vue (table mode) handle grouped task display
- HierarchicalTaskRow.vue wraps each task row with native HTML5 DnD events
- useTaskRowActions.ts provides drag handlers that emit 'moveTask' events
- useDragAndDrop.ts manages drag state, ghost pill, body.dragging-active class
- AllTasksView.vue creates groups with keys: overdue, today, tomorrow, thisWeek, later, noDate (for dueDate grouping)

## Key Files
| File | Role |
|------|------|
| src/components/tasks/TaskList.vue | List view - handleMoveTask intercepts drops and calls applyGroupTransfer |
| src/components/tasks/TaskTable.vue | Table view - similar structure |
| src/components/tasks/HierarchicalTaskRow.vue | Task row wrapper, emits drag events |
| src/composables/tasks/row/useTaskRowActions.ts | Drag start/end/drop handlers, ghostMode setting |
| src/composables/useDragAndDrop.ts | Shared drag state, ghost pill, body.dragging-active class |
| src/views/AllTasksView.vue | Creates group structures, group keys (overdue/today/etc) |

## How Group Transfer Works

1. User drags a task row (dragstart in useTaskRowActions.ts sets DragData with ghostMode: 'always')
2. Drop lands on another task row → handleDrop in useTaskRowActions.ts emits 'moveTask' with targetParentId = drop target task's ID
3. TaskList.vue's handleMoveTask intercepts: if groupBy !== 'none', finds which group the target task belongs to
4. applyGroupTransfer() updates the appropriate task property based on groupBy type:
   - project: changes projectId via moveTask emit
   - status: emits updateTask with new status
   - priority: emits updateTask with new priority
   - dueDate: maps group key to a local date string and emits updateTask with new dueDate
5. Group header also has @drop.prevent handler that delegates to same applyGroupTransfer()

## Critical Bug: Timezone in Date Formatting

**NEVER use `toISOString().split('T')[0]` for local dates!**

```typescript
// WRONG - converts to UTC, gives wrong date in non-UTC timezones
const formatDate = (d: Date) => d.toISOString().split('T')[0]
// In UTC+2: new Date(2026, 1, 24) → "2026-02-23" (YESTERDAY!)

// CORRECT - uses local timezone
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

This bug affects ANY code that converts dates to YYYY-MM-DD strings for storage. Always use local date methods (getFullYear, getMonth, getDate), never toISOString().

## Date Group Key Mapping

```typescript
const dateMap: Record<string, string | null> = {
  overdue: formatLocalDate(today),      // Move to today
  today: formatLocalDate(today),
  tomorrow: formatLocalDate(tomorrow),
  thisWeek: formatLocalDate(endOfWeek),
  later: formatLocalDate(new Date(today.getTime() + 14 * 86400000)),
  noDate: null                           // Remove due date
}
```

## Drag Reliability Patterns

### Pattern 1: pointer-events: none on interactive children during drag
The `body.dragging-active` class (set by useDragAndDrop.ts) disables pointer-events on buttons, badges, and other interactive elements inside task rows during drag. This prevents them from intercepting drop events.

```css
:global(body.dragging-active) .task-group .task-row__actions,
:global(body.dragging-active) .task-group .task-row__priority,
:global(body.dragging-active) .task-group .task-row__estimate,
:global(body.dragging-active) .task-group .task-row__project {
  pointer-events: none;
}
```

**IMPORTANT**: Don't use `.hierarchical-task-row *` — that would disable the row's own @drop handler.

### Pattern 2: data-group-key attributes
Each `.task-group` div has `data-group-key` attribute for debugging and future `closest()` lookups.

### Pattern 3: Ghost pill visibility
Set `ghostMode: 'always'` in DragData for catalog/list views (default 'sidebar-only' makes ghost invisible outside sidebar).

### Pattern 4: Consolidate drop logic
Both handleGroupDrop (header drop) and handleMoveTask (task-to-task drop) delegate to the same applyGroupTransfer() function to avoid duplicate logic and bugs.

## Debugging Console Logs

All drag-and-drop logs use `[DND-GROUP]` prefix:
- `[DND-GROUP] handleMoveTask` - fires when a task emits moveTask
- `[DND-GROUP] Transferring to group:` - confirms group found
- `[DND-GROUP] handleGroupDrop` - fires when dropping on group header
- `[DND-GROUP] applyGroupTransfer` - shows the actual property update
- `[DND-GROUP] dueDate mapping` - shows date calculation result

## Common Issues and Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| Drag shows wrong date (yesterday) | `toISOString()` converts to UTC | Use `formatLocalDate()` with local date methods |
| Ghost pill invisible | `ghostMode: 'sidebar-only'` default | Set `ghostMode: 'always'` in DragData |
| Drop makes subtask instead of transferring | groupBy check missing | handleMoveTask checks groupBy !== 'none' |
| Drop does nothing | Group key not in dateMap | Add missing keys (e.g., 'overdue') |
| Drop unreliable on buttons/badges | Child elements intercept drop | pointer-events: none during drag |
| Table view missing group drag | Different component | Ensure TaskTable.vue has equivalent logic |

## Vue 3 DnD Best Practices (from research)
1. **dragCounter pattern**: Use integer counter for dragenter/dragleave to avoid flicker on nested elements
2. **closest() for group resolution**: Walk up DOM with `closest('[data-group-key]')` for reliable group finding
3. **Never use bare boolean attrs on vuedraggable** (BUG-1335 lesson): Vue 3 $attrs passes them as "" (falsy)
4. **For complex scenarios**: Consider vue-draggable-plus (SortableJS) for automatic cross-group support with @add event

## Project Color Indicator Sizing

The project color circle in task rows should use `--project-indicator-size-sm` (20px), not `--project-indicator-size-md` (24px). Hover glow should be subtle: `0 0 6px color-mix(in srgb, var(--project-color) 50%, transparent)` — NOT the aggressive 16px+32px glow.
