---
status: pending
priority: p3
issue_id: 010
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Commented Code in canvas.ts Should Be Removed

## Problem Statement

The `src/stores/canvas.ts` file contains several commented-out lines of code that add noise and confusion.

**Why it matters:** Dead code creates cognitive load and may confuse developers.

## Findings

**Source:** Code Simplicity Reviewer Agent

**Affected File:** `src/stores/canvas.ts`

**Lines to Remove:**
```typescript
// Line 5: import { errorHandler... } - dead import (commented)
// Line 62: // const groups = visibleGroups - redundant alias never used
// Line 71: // const collapsedTaskPositions = ref<Map<...>> - unused state
// Lines 436-438: // const togglePowerMode = ... - commented function
```

## Proposed Solutions

### Solution 1: Delete Commented Lines (Recommended)

Remove all commented-out code references.

**Pros:** Cleaner code
**Cons:** None
**Effort:** Trivial (3 minutes)
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/stores/canvas.ts

## Acceptance Criteria

- [ ] Commented dead code removed
- [ ] Build still succeeds
- [ ] No functional changes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Code Simplicity review |
