---
status: pending
priority: p2
issue_id: 022
tags: [code-review, performance, reactivity, canvas]
dependencies: []
---

# Synchronous Flush Watcher Blocks Main Thread

## Problem Statement

A watcher in CanvasView.vue uses `flush: 'sync'` which runs synchronously before DOM updates, blocking the main thread. Combined with expensive string operations in the getter, this creates jank during drag operations.

**Why it matters:** With 50+ section nodes, every reactive update triggers expensive string operations synchronously, causing UI stuttering.

## Findings

**Source:** Performance Oracle Agent

**Affected Files:**
- `src/views/CanvasView.vue` (lines 1767-1787)

**Problematic Code:**
```typescript
watch(
    () => nodes.value.filter(n => n.type === 'sectionNode')
        .map(n => `${n.id}:${n.position.x.toFixed(0)}:${n.position.y.toFixed(0)}`)
        .join('|'),  // Expensive string operations
    (newVal, oldVal) => {
        if (newVal === oldVal) return
        // ... tracking logic
    },
    { flush: 'sync' }  // SYNCHRONOUS - blocks main thread
)
```

**Issues:**
1. **flush: 'sync'**: Runs BEFORE DOM updates, blocking main thread
2. **Expensive getter**: filter() + map() + join() on every change
3. **String garbage**: Creates new strings for GC on every update
4. **Runs on every reactive change**: Not debounced

**Performance Impact with 50+ sections:**
1. Filter operation: O(n) - scans all nodes
2. Map operation: O(n) string allocations
3. Join operation: O(n) string concatenation
4. Callback execution blocks next frame

## Proposed Solutions

### Solution 1: Change to flush: 'post' + Debounce (Recommended)

```typescript
import { useDebounceFn } from '@vueuse/core'

const debouncedTracker = useDebounceFn((sections: Node[]) => {
    sections.forEach(n => {
        const prev = sectionPositionTracker.get(n.id)
        if (prev) {
            const dx = Math.abs(n.position.x - prev.x)
            const dy = Math.abs(n.position.y - prev.y)
            if (dx > 20 || dy > 20) {
                console.debug(`Position change...`)
            }
        }
        sectionPositionTracker.set(n.id, { x: n.position.x, y: n.position.y })
    })
}, 100)

watch(
    () => nodes.value.filter(n => n.type === 'sectionNode'),
    (sections) => debouncedTracker(sections),
    { flush: 'post' }  // After DOM updates, non-blocking
)
```

**Pros:** Non-blocking, debounced, simpler getter
**Cons:** 100ms delay before tracking updates
**Effort:** Small (1 hour)
**Risk:** None

### Solution 2: Remove Debug Watcher Entirely

This watcher appears to be for debugging position changes. Consider removing it in production.

```typescript
if (import.meta.env.DEV) {
    // Only enable position tracking in development
    resourceManager.addWatcher(
        watch(...)
    )
}
```

**Pros:** Zero performance impact in production
**Cons:** Lose debug capability in production
**Effort:** Small (15 minutes)
**Risk:** None

### Solution 3: Use watchEffect with Throttle

```typescript
import { useThrottleFn } from '@vueuse/core'

const throttledUpdate = useThrottleFn(() => {
    const sections = nodes.value.filter(n => n.type === 'sectionNode')
    // ... tracking logic
}, 100)

watchEffect(() => {
    if (nodes.value.length > 0) {
        throttledUpdate()
    }
})
```

**Pros:** Simpler API, automatic dependency tracking
**Cons:** May run more often than needed
**Effort:** Small (30 minutes)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/views/CanvasView.vue

**Components:** Canvas position change debugging

**Performance Budget:**
- Target: < 16ms per frame (60fps)
- Current watcher: Can exceed 16ms with 50+ sections
- Goal: Keep watcher execution < 5ms

## Acceptance Criteria

- [ ] Watcher does not block main thread during drag
- [ ] No UI jank with 50+ sections
- [ ] Position tracking still captures significant changes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Performance Oracle review |

## Resources

- Vue 3 watch flush modes: https://vuejs.org/guide/essentials/watchers.html#callback-flush-timing
- VueUse debounce: https://vueuse.org/shared/useDebounceFn/
