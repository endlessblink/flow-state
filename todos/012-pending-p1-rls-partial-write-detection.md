---
status: complete
priority: p1
issue_id: 012
resolved_by: BUG-171 (saveProjects fix in useSupabaseDatabaseV2.ts)
tags: [code-review, security, supabase, data-integrity]
dependencies: []
---

# RLS Partial Write Detection Missing

## Problem Statement

The new RLS detection pattern only checks if `data.length === 0`, which misses **partial write failures**. When upserting multiple rows, if RLS blocks some but not all, the current code silently succeeds with incomplete data.

**Why it matters:** Users may think their data is saved when it's actually partially lost, leading to data corruption and sync issues.

## Findings

**Source:** Security Sentinel Agent

**Affected Files:**
- `src/composables/useSupabaseDatabase.ts` (lines 286-301, 428-436)

**Problematic Code:**
```typescript
const { data, error } = await supabase.from('tasks').upsert(payload).select('id, position')
if (error) throw error
if (!data || data.length === 0) {
    throw new Error(`RLS blocked write - upsert returned no data (expected ${payload.length} rows)`)
}
// If payload has 10 tasks but only 8 are saved, no error is thrown!
```

**Scenario:**
- Payload contains 10 tasks
- RLS blocks 2 due to user_id mismatch
- `data.length` is 8 (not 0)
- Check passes silently
- 2 tasks are lost

## Proposed Solutions

### Solution 1: Verify Complete Write (Recommended)

Change the check to verify ALL rows were written.

```typescript
const { data, error } = await supabase.from('tasks').upsert(payload).select('id, position')
if (error) throw error
if (!data || data.length !== payload.length) {
    const writtenIds = new Set(data?.map(d => d.id) || [])
    const failedIds = payload.filter(p => !writtenIds.has(p.id)).map(p => p.id)
    throw new Error(`RLS blocked ${failedIds.length} of ${payload.length} writes. Failed IDs: ${failedIds.join(', ')}`)
}
```

**Pros:** Complete detection, identifies which rows failed
**Cons:** None
**Effort:** Small
**Risk:** None

### Solution 2: Log Warning But Don't Fail

For resilience, log the partial failure but continue.

```typescript
if (data.length !== payload.length) {
    console.error(`⚠️ Partial write: ${data.length}/${payload.length} rows saved`)
    // Continue execution but surface warning to user
    uiStore.showWarning(`Some data may not have saved (${payload.length - data.length} items affected)`)
}
```

**Pros:** More resilient, doesn't block user workflow
**Cons:** Data loss may go unnoticed
**Effort:** Small
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/useSupabaseDatabase.ts

**Components:** Supabase data persistence

**Database Changes:** None

## Acceptance Criteria

- [ ] Partial writes (fewer rows returned than sent) are detected
- [ ] Error message includes which specific items failed
- [ ] All save functions have consistent RLS detection

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Security Sentinel review |

## Resources

- Related Tasks: TASK-142 (position persistence)
- Supabase RLS Docs: https://supabase.com/docs/guides/auth/row-level-security
