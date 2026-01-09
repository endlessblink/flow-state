---
status: pending
priority: p2
issue_id: 021
tags: [code-review, performance, memory-leak, canvas]
dependencies: []
---

# Unbounded Map Growth - Memory Leak Risk

## Problem Statement

The `sectionPositionTracker` Map in CanvasView.vue is never cleared when sections are deleted. Over time, it will accumulate stale entries leading to unbounded memory growth in long-running sessions.

**Why it matters:** Long-running sessions with heavy canvas editing could experience memory issues and degraded performance.

## Findings

**Source:** Performance Oracle Agent

**Affected Files:**
- `src/views/CanvasView.vue` (line 1764)

**Problematic Code:**
```typescript
const sectionPositionTracker = new Map<string, { x: number; y: number }>()

resourceManager.addWatcher(
  watch(
    () => nodes.value.filter(n => n.type === 'sectionNode')
        .map(n => `${n.id}:${n.position.x.toFixed(0)}:${n.position.y.toFixed(0)}`)
        .join('|'),
    (newVal, oldVal) => {
      // Adds entries but never removes stale ones
      nodes.value.filter(n => n.type === 'sectionNode').forEach(n => {
        sectionPositionTracker.set(n.id, { x: n.position.x, y: n.position.y })
      })
    },
    { flush: 'sync' }
  )
)
```

**Issues:**
1. **Never cleared**: When sections are deleted, their entries remain in Map
2. **Unbounded growth**: After 1000 creates/deletes, ~50KB leaked
3. **Module-level persistence**: Similar issue in `useCanvasDragDrop.ts` with `dragStartPositions` Map

## Proposed Solutions

### Solution 1: Cleanup Stale Entries in Watcher (Recommended)

Add cleanup logic to remove entries for deleted sections.

```typescript
watch(
  () => nodes.value.filter(n => n.type === 'sectionNode'),
  (sections) => {
    const currentIds = new Set(sections.map(s => s.id))

    // Remove stale entries
    sectionPositionTracker.forEach((_, id) => {
      if (!currentIds.has(id)) {
        sectionPositionTracker.delete(id)
      }
    })

    // Update current entries
    sections.forEach(n => {
      sectionPositionTracker.set(n.id, { x: n.position.x, y: n.position.y })
    })
  },
  { flush: 'post' }
)
```

**Pros:** Simple, automatic cleanup
**Cons:** Slightly more complex watcher logic
**Effort:** Small (30 minutes)
**Risk:** None

### Solution 2: Clear on Component Unmount

Clear Map when leaving canvas view.

```typescript
onBeforeUnmount(() => {
  sectionPositionTracker.clear()
})
```

**Pros:** Simple cleanup
**Cons:** Only clears on navigation, not during session
**Effort:** Small (15 minutes)
**Risk:** None

### Solution 3: Use WeakMap (If Keys Can Be Node References)

```typescript
const sectionPositionTracker = new WeakMap<Node, { x: number; y: number }>()
```

**Pros:** Automatic garbage collection
**Cons:** Requires node reference keys, not string IDs
**Effort:** Medium (would need refactoring)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/views/CanvasView.vue (sectionPositionTracker)
- src/composables/canvas/useCanvasDragDrop.ts (dragStartPositions - similar issue)

**Components:** Canvas position tracking

**Memory Impact:**
- Each entry: ~50 bytes
- After 1000 creates/deletes: ~50KB leaked
- Long session (4+ hours heavy editing): Could grow to 200KB+

## Acceptance Criteria

- [ ] Map entries are removed when sections are deleted
- [ ] Memory doesn't grow unbounded during session
- [ ] Position tracking still works correctly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Performance Oracle review |

## Resources

- Similar cleanup pattern: resourceManager cleanup functions
