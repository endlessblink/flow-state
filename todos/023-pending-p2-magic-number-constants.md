---
status: pending
priority: p2
issue_id: 023
tags: [code-review, code-quality, maintainability]
dependencies: []
---

# Magic Number Constants Scattered Across Codebase

## Problem Statement

Hardcoded timeout values and dimension constants are scattered across multiple files with no single source of truth. This makes maintenance difficult and can lead to inconsistent behavior.

**Why it matters:** Changing a constant requires finding and updating it in multiple locations, risking inconsistency and bugs.

## Findings

**Source:** Pattern Recognition Specialist Agent

**Timeout Magic Numbers:**
| File | Line | Value | Purpose |
|------|------|-------|---------|
| `useCanvasDragDrop.ts` | 996 | `50` | nodeDragging reset delay |
| `useCanvasDragDrop.ts` | 998-1001 | `500` | Drag settling period |
| `useCanvasResize.ts` | 326-329 | `1000` | Resize settling period |
| `useCanvasActions.ts` | 245, 379, 419 | `10000` | Zombie group prevention |
| `useSupabaseDatabase.ts` | 67 | `1000` | Retry delay |

**Dimension Magic Numbers:**
| Value | Locations | Purpose |
|-------|-----------|---------|
| `220` | 6+ locations | Task width |
| `100` | 6+ locations | Task height |
| `280` | TaskNode.vue:381 | Task node CSS width |
| `300` | Multiple | Default group width |
| `200` | Multiple | Default group height |

**Specific Locations for Dimension 220/100:**
- `useCanvasSync.ts:366,367`
- `useCanvasDragDrop.ts:65,77,100`
- `useMidnightTaskMover.ts:78,79`
- `canvas.ts:374`

## Proposed Solutions

### Solution 1: Extract to Constants File (Recommended)

Create a centralized constants file.

```typescript
// src/constants/canvas.ts
export const CANVAS_TIMING = {
  DRAG_SETTLING_MS: 500,
  RESIZE_SETTLING_MS: 1000,
  ZOMBIE_PREVENTION_MS: 10000,
  NODE_DRAGGING_RESET_MS: 50,
  SUPABASE_RETRY_MS: 1000,
} as const

export const TASK_DIMENSIONS = {
  WIDTH: 220,
  HEIGHT: 100,
  NODE_WIDTH: 280,  // CSS width in TaskNode.vue
} as const

export const GROUP_DIMENSIONS = {
  DEFAULT_WIDTH: 300,
  DEFAULT_HEIGHT: 200,
  MIN_WIDTH: 200,
  MIN_HEIGHT: 150,
} as const
```

Usage:
```typescript
import { TASK_DIMENSIONS, CANVAS_TIMING } from '@/constants/canvas'

const TASK_WIDTH = TASK_DIMENSIONS.WIDTH
setTimeout(callback, CANVAS_TIMING.DRAG_SETTLING_MS)
```

**Pros:** Single source of truth, easy to find and update
**Cons:** Need to update imports in many files
**Effort:** Medium (2-3 hours)
**Risk:** None

### Solution 2: Use Design Token System

Integrate with existing design tokens.

```typescript
// In Tailwind/CSS custom properties
:root {
  --task-width: 220px;
  --task-height: 100px;
}

// In TypeScript, read from getComputedStyle or import from config
```

**Pros:** Consistent with design system
**Cons:** More complex for JS-only constants
**Effort:** Medium-High
**Risk:** Low

### Solution 3: Gradual Migration

Start with highest-impact constants (timing), defer dimensions.

**Phase 1:** Extract timing constants (most bug-prone)
**Phase 2:** Extract dimensions (less critical)

**Pros:** Lower risk, incremental
**Cons:** Takes longer to complete
**Effort:** Small per phase
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**New File to Create:**
- src/constants/canvas.ts

**Affected Files:**
- src/composables/canvas/useCanvasDragDrop.ts
- src/composables/canvas/useCanvasSync.ts
- src/composables/canvas/useCanvasResize.ts
- src/composables/canvas/useCanvasActions.ts
- src/composables/canvas/useMidnightTaskMover.ts
- src/composables/useSupabaseDatabase.ts
- src/stores/canvas.ts
- src/components/canvas/TaskNode.vue

## Acceptance Criteria

- [ ] All timing constants in single file
- [ ] All dimension constants in single file
- [ ] No magic numbers for timing/dimensions in composables
- [ ] Constants have descriptive names

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Pattern Recognition review |

## Resources

- Design tokens doc: docs/claude-md-extension/design-system.md
