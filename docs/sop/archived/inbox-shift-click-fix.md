# SOP: Inbox Shift+Click Multi-Select Fix

**Date**: December 25, 2025
**Bug ID**: BUG-038
**Severity**: MEDIUM
**Status**: RESOLVED

## Problem Statement

User reported: "shift select just deselects the first selected task"

When attempting to use Shift+Click for range selection in the Inbox panel, the selection was being cleared instead of selecting a range of tasks.

## Root Cause Analysis

### Investigation

1. Searched for shift-related code across components
2. Found two inbox implementations:
   - `src/components/canvas/InboxPanel.vue` - Canvas-specific inbox (HAD shift+click)
   - `src/components/inbox/UnifiedInboxPanel.vue` - Main inbox panel (MISSING shift+click)

3. `UnifiedInboxPanel.vue` `handleTaskClick()` only handled:
   - `Ctrl/Cmd+Click` - Toggle individual selection
   - Single click - Clear selection and select clicked task

4. **Missing**: `event.shiftKey` handling for range selection

### Why TASK-051 Missed This

TASK-051 "Inbox Shift+Click Multi-Select" was marked complete, but the implementation was only added to `InboxPanel.vue` (canvas inbox), not the main `UnifiedInboxPanel.vue` which is used in most views.

## Solution

### Changes Made

**File**: `src/components/inbox/UnifiedInboxPanel.vue`

1. **Added anchor tracking ref** (line 277):
```typescript
const lastSelectedTaskId = ref<string | null>(null) // Anchor for shift+click range selection
```

2. **Implemented shift+click handler** (lines 497-528):
```typescript
// Handle Shift+Click (Range Selection)
if (event.shiftKey) {
  if (!lastSelectedTaskId.value) {
    // No anchor set - treat as first selection
    selectedTaskIds.value = new Set([task.id])
    lastSelectedTaskId.value = task.id
    return
  }

  // Has anchor - perform range selection
  const tasks = inboxTasks.value
  const lastIndex = tasks.findIndex(t => t.id === lastSelectedTaskId.value)
  const currentIndex = tasks.findIndex(t => t.id === task.id)

  if (lastIndex === -1) {
    // Anchor task no longer in list - reset to clicked task
    selectedTaskIds.value = new Set([task.id])
    lastSelectedTaskId.value = task.id
    return
  }

  if (currentIndex !== -1) {
    const start = Math.min(lastIndex, currentIndex)
    const end = Math.max(lastIndex, currentIndex)
    const rangeTasks = tasks.slice(start, end + 1)

    // Merge with existing selection
    const newSet = new Set(selectedTaskIds.value)
    rangeTasks.forEach(t => newSet.add(t.id))
    selectedTaskIds.value = newSet
  }
  return
}
```

3. **Updated clearSelection()** (line 557):
```typescript
const clearSelection = () => {
  selectedTaskIds.value.clear()
  selectedTaskIds.value = new Set()
  lastSelectedTaskId.value = null  // Also clear anchor
}
```

## Testing

### Manual Test Procedure

1. Navigate to Canvas view (http://localhost:5546/#/canvas)
2. Create 4+ tasks in the Inbox
3. Click Task 1 (sets anchor, shows "1 selected")
4. Shift+Click Task 3
5. **Expected**: "3 selected" with Tasks 1, 2, 3 highlighted
6. **Actual**: Working as expected

### Playwright Verification

```typescript
// Click first task
await page.locator('[data-task="task-1"]').click();
// Shift+click third task
await page.locator('[data-task="task-3"]').click({ modifiers: ['Shift'] });
// Verify selection count
await expect(page.locator('.selection-count')).toContainText('3 selected');
```

## Rollback Procedure

If issues arise, revert the three changes in `UnifiedInboxPanel.vue`:

1. Remove `lastSelectedTaskId` ref (line 277)
2. Restore original `handleTaskClick()` without shift handling
3. Remove `lastSelectedTaskId.value = null` from `clearSelection()`

## Related Files

- `src/components/inbox/UnifiedInboxPanel.vue` - Main fix location
- `src/components/canvas/InboxPanel.vue` - Reference implementation (already had shift+click)

## Lessons Learned

1. When implementing a feature across multiple similar components, verify ALL instances are covered
2. TASK-051 should have been tested in both Inbox locations
3. Code search for feature keywords (e.g., "shiftKey") helps identify incomplete implementations
