---
status: pending
priority: p2
issue_id: 004
tags: [code-review, architecture, dead-code, cleanup]
dependencies: []
---

# Dead Code: SyncRetryService.ts is Never Used

## Problem Statement

The file `src/services/sync/SyncRetryService.ts` (52 lines) contains a singleton service that is never imported or called. It only imports a type from the stub `useReliableSyncManager`.

**Why it matters:** Dead service code creates maintenance confusion and suggests functionality that doesn't exist.

## Findings

**Source:** Architecture Strategist + Code Simplicity Reviewer

**Affected File:** `src/services/sync/SyncRetryService.ts`

**Evidence:**
```bash
# Only type import found, no actual usage
grep -r "SyncRetryService\|syncRetryService" src/
# Result: Only the file definition
```

## Proposed Solutions

### Solution 1: Delete Entirely (Recommended)

```bash
rm src/services/sync/SyncRetryService.ts
```

**Pros:** -52 lines, cleaner services directory
**Cons:** None (file is unused)
**Effort:** Trivial (2 minutes)
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/services/sync/SyncRetryService.ts (DELETE)

## Acceptance Criteria

- [ ] File is deleted
- [ ] Build still succeeds
- [ ] No runtime errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Code Simplicity review |

## Resources

- Related to overall PouchDB cleanup
