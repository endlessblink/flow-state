# SOP-020: Inbox Filter Date Logic

**Created**: January 22, 2026
**Related**: BUG-362, useSmartViews.ts

## Overview

This SOP documents the correct date filtering logic for inbox time filters ("This Week", "This Month") to ensure overdue tasks are included.

## Problem

The original filter logic excluded overdue tasks from time-based filters:

```typescript
// WRONG - excludes overdue tasks
if (normalizedDueDate >= todayStr && normalizedDueDate <= weekEndStr) {
  return true
}
```

This caused:
- "This Week (1)" showing only 1 task when there were 3+ tasks (2 overdue)
- "This Month (2)" showing only 2 tasks when there were 4+ tasks

## Solution

Remove the lower bound (`>= todayStr`) to include overdue tasks:

```typescript
// CORRECT - includes overdue tasks
if (normalizedDueDate && normalizedDueDate <= weekEndStr) {
  return true
}
```

## Affected Functions

### `isWeekTask()` in `useSmartViews.ts`

Checks if a task should appear in "This Week" filter:
- **Includes**: Overdue tasks + tasks due from today through end of week (Sunday)
- **Week calculation**: `daysUntilSunday = (7 - dayOfWeek) % 7 || 7`

### `isThisMonthTask()` in `useSmartViews.ts`

Checks if a task should appear in "This Month" filter:
- **Includes**: Overdue tasks + tasks due from today through end of current month
- **Month end**: Last day of current month

## Date Fields Checked

Both functions check multiple date fields in order:
1. `task.dueDate` - Primary due date
2. `task.instances[].scheduledDate` - Calendar instances
3. `task.scheduledDate` - Legacy scheduled date

## Additional Inclusions

Both filters also include:
- Tasks with `status === 'in_progress'`
- Tasks created today (if they have no due date)

## Key Files

| File | Purpose |
|------|---------|
| `src/composables/useSmartViews.ts` | Core filter logic |
| `src/composables/inbox/useUnifiedInboxState.ts` | Applies filters to inbox |
| `src/components/inbox/unified/UnifiedInboxHeader.vue` | Displays filter counts |

## Testing

To verify filter counts are correct:

1. Create tasks with various due dates (past, today, this week, next month)
2. Open the inbox panel
3. Check dropdown shows correct counts:
   - "Today (X)" - tasks due today + in_progress
   - "This Week (Y)" - overdue + tasks due through Sunday
   - "This Month (Z)" - overdue + tasks due through month end

## Date Normalization

The `normalizeDateString()` function handles various date formats:
- `YYYY-MM-DD` (standard)
- `YYYY-MM-DDTHH:mm:ss` (ISO 8601)
- `DD-MM-YYYY` (legacy)
- Malformed strings
