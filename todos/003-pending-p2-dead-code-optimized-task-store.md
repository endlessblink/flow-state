---
status: pending
priority: p2
issue_id: 003
tags: [code-review, architecture, dead-code, cleanup]
dependencies: []
---

# Dead Code: useOptimizedTaskStore.ts is Never Used

## Problem Statement

The file `src/composables/useOptimizedTaskStore.ts` (387 lines) is never imported anywhere in the codebase. It's a PouchDB-era batching/memoization layer that imports the deprecated `useDatabase` stub and calls no-op methods.

**Why it matters:** 387 lines of dead code creates maintenance burden, confuses developers, and increases bundle size.

## Findings

**Source:** Architecture Strategist + Code Simplicity Reviewer

**Affected File:** `src/composables/useOptimizedTaskStore.ts`

**Evidence:**
```bash
# No imports found
grep -r "useOptimizedTaskStore" src/
# Only the file definition itself appears
```

**Issues with the file:**
- Imports deprecated `useDatabase` stub
- Uses deprecated `DB_KEYS`
- Has a global singleton that is never accessed
- Complex batching logic irrelevant for Supabase

## Proposed Solutions

### Solution 1: Delete Entirely (Recommended)

```bash
rm src/composables/useOptimizedTaskStore.ts
```

**Pros:** -387 lines, cleaner codebase
**Cons:** None (file is unused)
**Effort:** Trivial (5 minutes)
**Risk:** None

### Solution 2: Archive to _archived Directory

```bash
mv src/composables/useOptimizedTaskStore.ts src/_archived/legacy-pouchdb/
```

**Pros:** Preserves for reference
**Cons:** Still exists in repo
**Effort:** Trivial
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/useOptimizedTaskStore.ts (DELETE)

**Dependencies:** None (file is orphaned)

## Acceptance Criteria

- [ ] File is deleted or archived
- [ ] Build still succeeds
- [ ] No runtime errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Code Simplicity review |

## Resources

- TASK-117 tracks stub cleanup
