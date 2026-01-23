---
status: complete
priority: p2
issue_id: 002
tags: [code-review, performance, canvas, vue-reactivity]
dependencies: []
---

# Canvas Sync Has Incomplete Change Detection

## Problem Statement

The canvas store's `syncTasksToCanvas` function only checks `position` and `updatedAt` to determine if a task node needs updating. This misses changes to other critical task properties (status, priority, title, tags), causing stale data to display on the canvas.

**Why it matters:** Users may see incorrect task status, priority, or title on the canvas after making edits, requiring a page refresh to see changes.

## Findings

**Source:** Performance Oracle Agent

**Affected File:** `src/stores/canvas.ts` (lines 352-359)

**Current Insufficient Check:**
```typescript
if (existingNode &&
  existingNode.position.x === t.canvasPosition?.x &&
  existingNode.position.y === t.canvasPosition?.y &&
  existingNode.data?.task?.updatedAt === t.updatedAt
) {
  existingTaskNodes.delete(t.id)
  return existingNode  // Returns OLD node with OLD task reference
}
```

**Missing Change Detection:**
- `status` - Task status badge incorrect
- `priority` - Priority color wrong
- `title` - Old title displayed
- `progress` - Progress bar stale
- `tags` - Tag pills missing/stale
- `dueDate` - Due date indicator wrong

**Contrast with useCanvasSync.ts (correct implementation):**
```typescript
if (oldTask.id !== newTask.id ||
    oldTask.status !== newTask.status ||
    oldTask.priority !== newTask.priority ||
    oldTask.title !== newTask.title ||
    oldTask.updatedAt !== newTask.updatedAt) {
  target.data = node.data
  changed = true
}
```

## Proposed Solutions

### Solution 1: Comprehensive Field Comparison (Recommended)

```typescript
if (existingNode) {
  const oldTask = existingNode.data?.task
  const positionUnchanged =
    existingNode.position.x === t.canvasPosition?.x &&
    existingNode.position.y === t.canvasPosition?.y

  const dataUnchanged = oldTask &&
    oldTask.status === t.status &&
    oldTask.priority === t.priority &&
    oldTask.title === t.title &&
    oldTask.updatedAt === t.updatedAt &&
    oldTask.progress === t.progress

  if (positionUnchanged && dataUnchanged) {
    existingTaskNodes.delete(t.id)
    return existingNode
  }
}
```

**Pros:** Catches all relevant changes, matches useCanvasSync pattern
**Cons:** More comparisons per task
**Effort:** Small
**Risk:** Low

### Solution 2: Always Update data.task Reference

```typescript
if (positionUnchanged) {
  // Always update task reference even when position unchanged
  existingNode.data = { task: t }
  existingTaskNodes.delete(t.id)
  return existingNode
}
```

**Pros:** Simpler logic, always fresh data
**Cons:** More object allocations
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/stores/canvas.ts (syncTasksToCanvas function)

**Components:** Canvas task node rendering

## Acceptance Criteria

- [ ] Task status changes reflect immediately on canvas
- [ ] Task priority changes reflect immediately on canvas
- [ ] Task title changes reflect immediately on canvas
- [ ] No unnecessary re-renders for unchanged tasks
- [ ] Performance benchmark shows <16ms sync time for 100 tasks

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Performance Oracle review |

## Resources

- Related: `src/composables/canvas/useCanvasSync.ts` (correct implementation)
