---
status: pending
priority: p2
issue_id: 014
tags: [code-review, code-quality, duplication]
dependencies: []
---

# Duplicate getAbsolutePosition Implementations

## Problem Statement

The function to calculate absolute position from nested relative positions is implemented twice:
1. Inline in `useCanvasSync.ts` (lines 99-116)
2. As utility in `canvasGraph.ts` (lines 17-36)

This violates DRY and creates maintenance burden with potential for drift.

**Why it matters:** Future fixes to position calculation may only be applied to one implementation, causing subtle bugs.

## Findings

**Source:** Code Simplicity Reviewer, Pattern Recognition Specialist Agents

**Affected Files:**
- `src/composables/canvas/useCanvasSync.ts` (lines 99-116)
- `src/utils/canvasGraph.ts` (lines 17-36)

**Implementation 1 (useCanvasSync.ts):**
```typescript
const getAbsolutePosition = (sect: typeof section): { x: number, y: number } => {
    let x = sect.position.x
    let y = sect.position.y
    let currentParentId = sect.parentGroupId

    while (currentParentId && currentParentId !== 'NONE') {
        const parent = sections.find(s => s.id === currentParentId)
        if (parent) {
            x += parent.position.x
            y += parent.position.y
            currentParentId = parent.parentGroupId
        } else {
            break
        }
    }
    return { x, y }
}
```

**Implementation 2 (canvasGraph.ts):**
```typescript
export function getAbsoluteNodePosition(nodeId: string, nodes: Node[]): { x: number; y: number } {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return { x: 0, y: 0 }

    const nodeX = Number.isNaN(node.position.x) ? 0 : node.position.x
    const nodeY = Number.isNaN(node.position.y) ? 0 : node.position.y

    if (!node.parentNode) {
        return { x: nodeX, y: nodeY }
    }

    const parentAbsolute = getAbsoluteNodePosition(node.parentNode, nodes)
    return {
        x: parentAbsolute.x + nodeX,
        y: parentAbsolute.y + nodeY
    }
}
```

**Differences:**
- canvasGraph.ts handles NaN (more robust)
- canvasGraph.ts uses recursion (cleaner)
- useCanvasSync.ts uses iteration with `sections.find()` (O(n) per step)

## Proposed Solutions

### Solution 1: Use canvasGraph.ts Only (Recommended)

Remove inline implementation and adapt canvasGraph.ts for CanvasSection.

```typescript
// In canvasGraph.ts, add overload for CanvasSection
export function getAbsolutePosition<T extends { id: string; position: Position; parentGroupId?: string | null }>(
    item: T,
    items: T[]
): { x: number; y: number } {
    // Unified implementation
}
```

**Pros:** Single source of truth, better NaN handling
**Cons:** Requires adapting API
**Effort:** Medium
**Risk:** Low

### Solution 2: Keep Both, Document Usage

Add clear documentation about when to use each.

```typescript
// canvasGraph.ts - For Vue Flow Node objects
// useCanvasSync.ts inline - For CanvasSection objects during sync
```

**Pros:** No code changes
**Cons:** Duplication persists, drift risk
**Effort:** Small
**Risk:** Medium (future maintenance)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/canvas/useCanvasSync.ts
- src/utils/canvasGraph.ts

**Components:** Position calculation utilities

**Database Changes:** None

## Acceptance Criteria

- [ ] Only one implementation of absolute position calculation exists
- [ ] OR clear documentation explains when to use each
- [ ] NaN handling is consistent
- [ ] All callers use the appropriate function

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Code Simplicity review |

## Resources

- Related Tasks: TASK-141 (nested group handling)
