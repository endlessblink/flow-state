# Canvas View Fix Plan

**Date**: 2025-11-29
**Status**: Ready for Implementation
**Priority**: CRITICAL
**Validated**: Online research confirms approach

---

## Research Validation

### Key Findings from Online Research

1. **Vue Flow manages its own DOM** - Direct DOM manipulation bypasses Vue's reactivity
   - Source: [Vue Flow Nodes Guide](https://vueflow.dev/guide/node.html)
   - "If you directly modify the nodes array, Vue Flow does not know that the node was removed"

2. **Use Vue Flow API for node operations** - Not `node.remove()`
   - Source: [Vue Flow Controlled Flow](https://vueflow.dev/guide/controlled-flow.html)
   - Use `removeNodes()` from `useVueFlow` composable

3. **Known race conditions exist** with node removal
   - Source: [GitHub Issue #1630](https://github.com/bcakmakoglu/vue-flow/issues/1630)
   - Manual DOM manipulation makes this worse

4. **Context menu coordinates** need proper transformation
   - Source: [Vue Flow Viewport Functions](https://vueflow.dev/guide/utils/instance.html)
   - Use `project()` to convert screen coords to canvas coords (for node creation)
   - Use raw `clientX/clientY` for menu positioning (screen-relative)

### Conclusion
**My fix plan is validated** - The `cleanupStaleNodes` function violates Vue Flow best practices by:
- Directly manipulating DOM instead of using Vue Flow API
- Bypassing Vue's reactivity system
- Not using `removeNodes()` from `useVueFlow`

---

## Issue Summary

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | Tasks not rendering on canvas | CRITICAL | `cleanupStaleNodes` removes valid nodes |
| 2 | Context menu outside viewport | HIGH | Positioning issue with canvas coordinates |
| 3 | Over-aggressive cleanup | HIGH | Same as #1 |

---

## Fix #1: Stale Node Cleanup Bug (CRITICAL)

### Root Cause Analysis

**Location**: `src/views/CanvasView.vue` lines 4663-4683

**Problem**: The `cleanupStaleNodes` function is called at the wrong time and with flawed logic:

```javascript
// Current broken code:
const cleanupStaleNodes = () => {
  const taskNodeElements = document.querySelectorAll('.vue-flow__node-taskNode')
  taskNodeElements.forEach(node => {
    const nodeId = node.getAttribute('data-nodeid')  // Returns null if not set yet!
    const taskExists = taskStore.tasks.some(t => t.id === nodeId)  // null !== any task id
    if (!taskExists) {
      node.remove()  // Removes ALL nodes because nodeId is null
    }
  })
}
```

**Why it fails**:
1. Called on mount (line 4694) BEFORE `loadFromDatabase()` and `syncNodes()` (lines 4696-4697)
2. Called in `nextTick` after `syncNodes` - but Vue Flow hasn't rendered `data-nodeid` attributes yet
3. When `nodeId` is `null`, `taskStore.tasks.some(t => t.id === null)` returns `false`
4. So ALL nodes are removed as "stale"

### Recommended Fix

**Option A: Disable aggressive cleanup entirely (Safest)**

```javascript
// Replace the entire cleanupStaleNodes function:
const cleanupStaleNodes = () => {
  // DISABLED: This cleanup was removing valid nodes due to timing issues
  // Vue Flow handles its own DOM cleanup - manual intervention causes bugs
  console.log('🧹 [DISABLED] Stale node cleanup skipped - Vue Flow manages DOM')
}
```

**Option B: Fix the logic with proper guards (If cleanup is truly needed)**

```javascript
const cleanupStaleNodes = () => {
  // Only run if we have tasks loaded and Vue Flow is stable
  if (!taskStore.tasks.length || !isVueFlowMounted.value) {
    console.log('🧹 Skipping cleanup - not ready')
    return
  }

  // Wait for Vue Flow to fully render
  setTimeout(() => {
    const taskNodeElements = document.querySelectorAll('.vue-flow__node-taskNode')
    let removedCount = 0

    taskNodeElements.forEach(node => {
      const nodeId = node.getAttribute('data-nodeid')

      // CRITICAL: Skip if nodeId is not set (Vue Flow hasn't rendered it yet)
      if (!nodeId) {
        console.log('⏳ Skipping node without data-nodeid - not yet rendered')
        return
      }

      const taskExists = taskStore.tasks.some(t => String(t.id) === String(nodeId))

      if (!taskExists) {
        console.log(`Removing stale node: ${nodeId}`)
        node.remove()
        removedCount++
      }
    })

    if (removedCount > 0) {
      console.log(`✅ Removed ${removedCount} stale Vue Flow nodes`)
    }
  }, 500)  // Give Vue Flow time to render
}
```

**Option C: Remove all cleanup calls (Most aggressive fix)**

Remove the cleanup calls entirely:
- Line 4694: `cleanupStaleNodes()` - on mount
- Line 1887: `cleanupStaleNodes()` - after syncNodes

---

## Fix #2: Context Menu Positioning Bug (HIGH)

### Root Cause Analysis

**Location**: `src/components/canvas/CanvasContextMenu.vue` + `src/composables/useContextMenuPositioning.ts`

**Problem**: The x/y coordinates passed to the context menu are canvas-relative (accounting for zoom/pan), but the positioning logic treats them as screen coordinates.

**Evidence**: Menu appears at coordinates that are off-screen when canvas is zoomed or panned.

### Recommended Fix

**In CanvasView.vue** - Check how right-click coordinates are passed:

```javascript
// Find the right-click handler in CanvasView.vue
// Look for: @contextmenu, handleRightClick, or similar

// Current (likely broken):
const handleRightClick = (event: MouseEvent) => {
  canvasContextMenuX.value = event.clientX  // Should be correct
  canvasContextMenuY.value = event.clientY  // Should be correct
}

// If coordinates come from Vue Flow events, they might be transformed:
const handleVueFlowRightClick = ({ event, node }) => {
  // Transform canvas coordinates to screen coordinates
  const { x, y } = project({ x: event.clientX, y: event.clientY })
  // This is WRONG - we need SCREEN coordinates, not canvas coordinates
}
```

**Fix**: Ensure screen coordinates are used:

```javascript
const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()

  // Use raw screen coordinates, not transformed canvas coordinates
  canvasContextMenuX.value = event.clientX
  canvasContextMenuY.value = event.clientY
  showCanvasContextMenu.value = true

  console.log(`📋 Context menu at screen coords: ${event.clientX}, ${event.clientY}`)
}
```

---

## Fix #3: TypeScript Import Errors (MEDIUM)

### Files to Fix

```
src/composables/useCanvasPerformanceTesting.ts
src/composables/useCanvasProgressiveLoading.ts
src/composables/useCanvasRenderingOptimization.ts
src/composables/useCanvasVirtualization.ts
```

### Change Required

```typescript
// FROM (wrong):
import type { Node, Edge } from '@braks/vueflow'

// TO (correct):
import type { Node, Edge } from '@vue-flow/core'
```

Also add missing Vue imports:
```typescript
import { ref, Ref, onUnmounted } from 'vue'
```

---

## Implementation Order

### Phase 1: Critical Fix (Do First)

1. **Disable `cleanupStaleNodes`** - Line 4663-4683 in CanvasView.vue
   - Comment out the entire function body
   - Or return early without doing anything
   - This is the safest immediate fix

### Phase 2: Verify Fix Worked

2. **Test with Playwright**
   - Navigate to canvas
   - Check Vue Flow Status shows nodes
   - Verify task cards are VISIBLE on canvas
   - Take screenshot for evidence

### Phase 3: Context Menu Fix

3. **Fix context menu positioning**
   - Verify right-click coordinates use `clientX/clientY`
   - Test context menu appears near click position
   - Test "Create Task Here" is clickable

### Phase 4: Cleanup

4. **Fix TypeScript imports**
   - Update 4 composable files
   - Run `npx vue-tsc --noEmit` to verify

---

## Testing Checklist

After implementing fixes:

- [ ] Run `npm run build` - should succeed
- [ ] Navigate to Canvas view - no console errors
- [ ] Vue Flow Status shows correct node count
- [ ] **Task cards are VISIBLE on canvas** (not just in inbox)
- [ ] Right-click on canvas shows context menu
- [ ] "Create Task Here" button is clickable
- [ ] New task appears on canvas at click position
- [ ] Drag task from inbox to canvas works
- [ ] Navigation between views preserves canvas state

---

## Code Locations Reference

| File | Line | Purpose |
|------|------|---------|
| `src/views/CanvasView.vue` | 4663-4683 | `cleanupStaleNodes` function |
| `src/views/CanvasView.vue` | 1887 | Cleanup call after syncNodes |
| `src/views/CanvasView.vue` | 4694 | Cleanup call on mount |
| `src/composables/useContextMenuPositioning.ts` | 34-96 | Menu positioning logic |
| `src/components/canvas/CanvasContextMenu.vue` | 196-204 | Menu positioning usage |

---

## Rollback Plan

If fixes cause new issues:

1. Restore from backup: `src/views/CanvasView.vue.backup`
2. Git revert: `git checkout HEAD -- src/views/CanvasView.vue`
3. Re-enable cleanup if truly needed (but with proper guards)

---

## Success Criteria

The fix is successful when:

1. **Tasks render on canvas** - Visual task cards appear, not just in inbox
2. **Vue Flow Status matches reality** - If it shows 23 nodes, 23 cards are visible
3. **Context menu works** - Can create tasks via right-click
4. **No regressions** - Existing features (inbox, drag, filters) still work
