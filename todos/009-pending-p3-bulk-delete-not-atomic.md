---
status: pending
priority: p3
issue_id: 009
tags: [code-review, data-integrity, supabase]
dependencies: []
---

# Bulk Delete Operations Are Not Atomic

## Problem Statement

The `bulkDeleteTasks` function deletes tasks sequentially in a loop. If the loop fails partway through, some tasks are soft-deleted in Supabase while others remain, creating inconsistent state.

**Why it matters:** Partial failures can leave database in inconsistent state.

## Findings

**Source:** Data Integrity Guardian Agent

**Affected File:** `src/stores/tasks/taskOperations.ts`

**Current Non-Atomic Implementation:**
```typescript
const bulkDeleteTasks = async (taskIds: string[]) => {
    // BUGFIX: Persist deletions to Supabase FIRST
    for (const taskId of taskIds) {
        await deleteTaskFromStorage(taskId)  // Sequential, not batched!
    }
    // ...
}
```

**Risk:** If loop fails at task N:
- Tasks 1..N-1 are soft-deleted in Supabase
- Tasks N..end are not deleted
- Memory state not yet updated
- User sees inconsistent state

## Proposed Solutions

### Solution 1: Batch Supabase Operations (Recommended)

```typescript
const bulkDeleteTasks = async (taskIds: string[]) => {
    manualOperationInProgress.value = true
    try {
        // Single atomic batch operation
        const { error } = await supabase
            .from('tasks')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString()
            })
            .in('id', taskIds)

        if (error) throw error

        // Update memory only after successful batch
        _rawTasks.value = _rawTasks.value.filter(t => !taskIds.includes(t.id))
        triggerCanvasSync()
    } finally {
        manualOperationInProgress.value = false
    }
}
```

**Pros:** Atomic operation, all-or-nothing
**Cons:** Requires useSupabaseDatabase changes
**Effort:** Medium
**Risk:** Low

### Solution 2: Add Transaction Wrapper

Use Supabase RPC function for transactional delete.

**Pros:** True ACID transaction
**Cons:** Requires Supabase function
**Effort:** Large
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/stores/tasks/taskOperations.ts
- src/composables/useSupabaseDatabase.ts (may need bulk delete method)

## Acceptance Criteria

- [ ] Bulk delete is single operation or atomic batch
- [ ] Partial failures don't leave inconsistent state
- [ ] Error handling rolls back cleanly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Data Integrity Guardian review |
