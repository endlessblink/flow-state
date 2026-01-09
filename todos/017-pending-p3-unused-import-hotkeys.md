---
status: pending
priority: p3
issue_id: 017
tags: [code-review, code-quality, cleanup]
dependencies: []
---

# Unused Import in useCanvasHotkeys.ts

## Problem Statement

The `useCanvasHotkeys.ts` composable imports `onMounted` and `onBeforeUnmount` from Vue but never uses them. It also destructures `onPaneClick` from useVueFlow which is unused.

**Why it matters:** Dead imports clutter code and may cause linting warnings.

## Findings

**Source:** Architecture Strategist Agent

**Affected Files:**
- `src/composables/canvas/useCanvasHotkeys.ts` (lines 2, 19)

**Unused Imports:**
```typescript
import { onMounted, onBeforeUnmount } from 'vue'  // Never used
// ...
const { getSelectedNodes, onPaneClick } = useVueFlow()  // onPaneClick unused
```

## Proposed Solutions

### Solution 1: Remove Unused Imports (Recommended)

```typescript
// Remove lifecycle imports since they're not used
// Change destructuring to only include what's used
const { getSelectedNodes } = useVueFlow()
```

**Pros:** Clean code, no linting warnings
**Cons:** None
**Effort:** Trivial (1 minute)
**Risk:** None

## Recommended Action

Remove the unused imports - trivial fix.

## Technical Details

**Affected Files:**
- src/composables/canvas/useCanvasHotkeys.ts

**Components:** Canvas hotkeys composable

**Database Changes:** None

## Acceptance Criteria

- [ ] No unused imports in useCanvasHotkeys.ts
- [ ] ESLint no-unused-vars passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Architecture Strategist review |

## Resources

- ESLint no-unused-vars rule
