# SOP-021: Quick Capture Tab Feature

**Created**: January 22, 2026
**Task**: TASK-369
**Status**: Complete

## Overview

The Quick Capture Tab is a feature integrated into the QuickSort view that enables rapid task capture with rich metadata, followed by batch categorization. This replaces the previous modal-based quick capture approach.

## UX Flow

```
[Ctrl+Shift+T] or navigate to QuickSort
              ↓
┌──────────────────────────────────────────────────────┐
│  ⚡ Quick Sort                                  [X]  │
│  ┌──────────┐  ┌──────────┐                         │
│  │  ⚡ Sort  │  │ + Capture │  ← Tab buttons         │
│  └──────────┘  └──────────┘                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  CAPTURE TAB CONTENT:                                │
│  ┌────────────────────────────────────────────────┐  │
│  │ Task title...                                  │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ Description (optional, markdown)...            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Priority: [None] [Low] [Med] [High]                 │
│                                                      │
│  Due: [Today] [Tomorrow] [This Week] [Next Week]     │
│       [This Weekend] [Clear]                         │
│                                                      │
│  [+ Add Task]  or  Enter                             │
│                                                      │
│  ─────────────────────────────────────────────────── │
│  Pending Tasks (3):                                  │
│  ┌────────────────────────────────────────────────┐  │
│  │ ☐ Review Q4 budget              🔴 High  Today │  │
│  │ ☐ Call dentist                  ⚪ None        │  │
│  │ ☐ Fix login bug - the auth...  🟡 Med   Fri   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Sort All (3)] → switches to Sort tab               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Opens QuickSort view with Capture tab active |

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/views/QuickSortView.vue` | Main view with tab navigation (Sort/Capture) |
| `src/components/quicksort/QuickCaptureTab.vue` | Rich task capture form component |
| `src/composables/useQuickCapture.ts` | State management for pending tasks |
| `src/composables/app/useAppShortcuts.ts` | Global keyboard shortcut handler |

### Data Model

```typescript
interface PendingTask {
  id: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  projectId?: string
}
```

### State Management

The `useQuickCapture` composable uses singleton state (shared across all instances):

- `phase`: 'capture' | 'sort' | 'done'
- `pendingTasks`: Array of tasks waiting to be sorted
- `currentSortIndex`: Index of task being sorted
- `defaultTabOnOpen`: Which tab to show when QuickSort opens

## Features

### Capture Tab

1. **Title Input** (required)
   - Auto-focuses on tab switch
   - Enter key adds task

2. **Description** (optional)
   - Markdown support
   - Multi-line textarea

3. **Priority Selection**
   - None (default), Low, Medium, High
   - Visual color coding

4. **Due Date Shortcuts**
   - Today, Tomorrow, This Week, Next Week, This Weekend
   - Clear option to remove date
   - Smart date calculation

5. **Pending Tasks List**
   - Shows all captured tasks with metadata badges
   - Edit/delete individual tasks
   - "Sort All" button to proceed to categorization

### Sort Tab

- Existing QuickSort functionality
- Processes pending tasks from Capture tab
- Assigns projects to each task

## Integration Points

### Route Query Parameter

The view responds to `?tab=capture` query parameter:

```typescript
// In QuickSortView.vue
watch(() => route.query.tab, (tab) => {
  if (tab === 'capture') {
    activeTab.value = 'capture'
  }
}, { immediate: true })
```

### Keyboard Shortcut

```typescript
// In useAppShortcuts.ts
if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
    event.preventDefault()
    router.push({ path: '/quick-sort', query: { tab: 'capture' } })
}
```

## Design Tokens Used

- Tab navigation: `--glass-bg-soft`, `--glass-border`, `--radius-xl`
- Active tab: `--brand-gradient`, `--brand-primary`
- Priority colors: `--priority-high`, `--priority-medium`, `--priority-low`
- Form inputs: `--glass-bg-medium`, `--text-primary`, `--text-secondary`

## Testing Checklist

- [ ] `Ctrl+Shift+T` navigates to QuickSort with Capture tab active
- [ ] Can enter title, description, priority, and due date
- [ ] "Add Task" adds task to pending list with metadata displayed
- [ ] Pending list shows all task metadata without truncation
- [ ] "Sort All" switches to Sort tab with pending tasks
- [ ] Sort tab processes pending tasks correctly
- [ ] Tasks created with all metadata preserved

## Related Documentation

- [QuickSort View](../claude-md-extension/architecture.md)
- [Keyboard Shortcuts](../claude-md-extension/code-patterns.md)
