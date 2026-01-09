---
status: pending
priority: p2
issue_id: 013
tags: [code-review, performance, canvas]
dependencies: []
---

# O(n²) Performance in Nested Group Detection

## Problem Statement

The new nested group detection logic in `useCanvasSync.ts` has O(n²) algorithmic complexity due to nested loops with `sections.find()` calls inside. This will degrade canvas performance as the number of sections increases.

**Why it matters:** Users with 50+ groups will experience noticeable lag during drag operations and canvas rendering.

## Findings

**Source:** Performance Oracle Agent

**Affected Files:**
- `src/composables/canvas/useCanvasSync.ts` (lines 99-241)

**Performance Issues:**

1. **O(n) lookup inside O(d) loop:**
```typescript
while (currentParentId && currentParentId !== 'NONE') {
    const parent = sections.find(s => s.id === currentParentId) // O(n) per iteration
    // ...
}
```

2. **Auto-detection is O(n²):**
```typescript
for (const potentialParent of sections) { // O(n)
    if (isActuallyInsideParent(section, potentialParent)) { // calls find() inside
        // ...
    }
}
```

3. **`sectionRects` created per task:**
```typescript
tasks.forEach(task => {
    const sectionRects = sections.map(s => ({...})) // O(n) array creation per task
})
```

**Projected Impact:**
| Sections | Tasks | Est. Sync Time |
|----------|-------|----------------|
| 10 | 20 | <5ms |
| 50 | 100 | ~60ms |
| 100 | 200 | ~150ms |
| 200 | 500 | ~450ms |

## Proposed Solutions

### Solution 1: Build Lookup Map + Memoize (Recommended)

Create a Map for O(1) lookups and memoize absolute positions.

```typescript
// At start of syncNodes():
const sectionsById = new Map(sections.map(s => [s.id, s]))

const absolutePositionCache = new Map<string, { x: number, y: number }>()

const getAbsolutePosition = (sect: CanvasSection): { x: number, y: number } => {
    const cached = absolutePositionCache.get(sect.id)
    if (cached) return cached

    // ... calculation using sectionsById.get() instead of find()

    absolutePositionCache.set(sect.id, result)
    return result
}
```

**Pros:** O(1) lookups, memoization prevents recalculation
**Cons:** Small memory overhead
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Solution 2: Pre-compute sectionRects

Move sectionRects creation outside the tasks loop.

```typescript
// Create ONCE before tasks.forEach
const sectionRects = sections.map(s => ({
    ...s,
    x: s.position.x,
    y: s.position.y,
    width: s.position.width || 300,
    height: s.position.height || 200
}))

tasks.forEach(task => {
    // Use shared sectionRects
    const section = findSmallestContainingRect(center.x, center.y, sectionRects)
})
```

**Pros:** Eliminates n*m array allocations
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/canvas/useCanvasSync.ts

**Components:** Canvas sync, nested group detection

**Database Changes:** None

## Acceptance Criteria

- [ ] syncNodes() completes in <50ms for 100 sections, 200 tasks
- [ ] No sections.find() calls inside loops
- [ ] sectionRects computed once per sync cycle
- [ ] No performance regression tests fail

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Performance Oracle review |

## Resources

- Related Tasks: TASK-141 (nested group handling)
