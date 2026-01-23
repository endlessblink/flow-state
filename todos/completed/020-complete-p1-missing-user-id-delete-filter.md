---
status: pending
priority: p1
issue_id: 020
tags: [code-review, security, supabase, defense-in-depth]
dependencies: []
---

# Missing user_id Filter in Delete Operations

## Problem Statement

While `deleteGroup()` correctly implements the user_id filter pattern for defense-in-depth, other delete operations rely solely on RLS without explicit user_id filtering. If RLS is misconfigured or disabled, users could delete other users' data by guessing/brute-forcing UUIDs.

**Why it matters:** Defense-in-depth security principle violated. RLS is the last line of defense, not the only line.

## Findings

**Source:** Security Sentinel Agent

**Affected Files:**
- `src/composables/useSupabaseDatabase.ts`

**Good Pattern (deleteGroup - lines 463-468):**
```typescript
const { data, error, count } = await supabase
    .from('groups')
    .update({ is_deleted: true })
    .eq('id', groupId)
    .eq('user_id', userId)  // CORRECT: Has user_id filter
    .select('id, is_deleted', { count: 'exact' })
```

**Missing Pattern (other operations):**
```typescript
// Line 163-167: deleteProject - Missing user_id filter
const { error } = await supabase
    .from('projects')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', projectId)  // Only ID check - relies on RLS

// Line 193-198: permanentlyDeleteProject - Missing user_id filter
const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)  // Only ID check

// Line 363-369: permanentlyDeleteTask - Missing user_id filter
const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)  // Only ID check
```

**All Affected Operations:**
1. `deleteProject` (line 163-167)
2. `restoreProject` (line 175-180)
3. `permanentlyDeleteProject` (line 193-198)
4. `deleteTask` (line 327-336)
5. `restoreTask` (line 348-353)
6. `permanentlyDeleteTask` (line 363-369)
7. `bulkDeleteTasks` (line 385-396)
8. `deleteNotification` (line 526-530)
9. `deleteTimerSession` (line 630-634)

## Proposed Solutions

### Solution 1: Add user_id Filter to All Delete Operations (Recommended)

Add `.eq('user_id', userId)` to all delete/restore operations.

```typescript
const deleteProject = async (projectId: string): Promise<void> => {
    const userId = getUserId()
    const { error, count } = await supabase
        .from('projects')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', userId)  // ADD THIS
        .select('*', { count: 'exact' })

    if (error) throw error
    if (!count || count === 0) {
        throw new Error(`Delete failed for project ${projectId} - no rows affected`)
    }
}
```

**Pros:** Consistent defense-in-depth, matches deleteGroup pattern
**Cons:** More verbose code
**Effort:** Medium (1-2 hours - 9 functions to update)
**Risk:** None

### Solution 2: Create Helper Function

Extract pattern to reusable helper.

```typescript
const softDelete = async (table: string, id: string, options?: { permanent?: boolean }) => {
    const userId = getUserId()
    if (options?.permanent) {
        return supabase.from(table).delete().eq('id', id).eq('user_id', userId)
    }
    return supabase.from(table)
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*', { count: 'exact' })
}
```

**Pros:** DRY, consistent pattern
**Cons:** Less explicit, abstracts Supabase API
**Effort:** Medium (2-3 hours)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/useSupabaseDatabase.ts (9 functions)

**Components:** All delete/restore operations

**Database Changes:** None (RLS already exists, this is additional protection)

## Acceptance Criteria

- [ ] All delete operations include `.eq('user_id', userId)` filter
- [ ] All restore operations include `.eq('user_id', userId)` filter
- [ ] All operations verify row count affected
- [ ] Unit tests verify user_id filtering

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Security Sentinel review |

## Resources

- Related: TASK-149 (deleteGroup already has correct pattern)
- Security principle: Defense-in-depth
