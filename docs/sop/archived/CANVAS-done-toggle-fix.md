# SOP: Canvas Done Toggle Button Positioning

**Date**: 2026-01-01
**Task**: TASK-076 (Separate Done Filter for Canvas vs Calendar)
**Status**: Resolved

## Problem Summary

The Canvas Done toggle button needed to be repositioned from inside the canvas container to outside the rounded canvas box, aligned with its top border on the right side.

## Root Cause Analysis

1. **Initial Issue**: Button was hidden behind `canvas-empty-state` overlay (z-index: 1000)
2. **Positioning Issue**: Tailwind arbitrary values (`z-[1010]`, `top-4`) weren't compiling
3. **Location Issue**: Button positioned inside `canvas-drop-zone` appeared inside the rounded box
4. **Absolute Positioning**: Button with `position: absolute` was relative to parent container, not viewport

## Solution Implemented

### Final Button Configuration

```vue
<button
  class="hide-done-toggle fixed px-1.5 py-0.5 backdrop-blur-sm border rounded-md text-[10px] font-medium flex items-center gap-1 shadow-md transition-all"
  :class="hideCanvasDoneTasks ? 'text-purple-300' : 'text-gray-300'"
  :style="{
    top: '232px',
    right: '12px',
    zIndex: 1010,
    background: hideCanvasDoneTasks ? 'rgba(139,92,246,0.2)' : 'rgba(30,30,40,0.95)',
    borderColor: hideCanvasDoneTasks ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.1)'
  }"
>
```

### Key Changes

| Property | Before | After | Reason |
|----------|--------|-------|--------|
| Position | `absolute` | `fixed` | Use viewport-relative positioning |
| Top | `16px` | `232px` | Align with canvas box top border |
| Right | `340px` → `16px` | `12px` | Position at far right edge |
| Location | Inside `canvas-drop-zone` | Outside, sibling element | Place outside rounded box |
| Text size | `text-sm` | `text-[10px]` | Smaller, less intrusive |
| Padding | `px-3 py-2` | `px-1.5 py-0.5` | Compact button |
| Icon size | `16px` | `12px` | Match smaller text |

### Files Modified

| File | Changes |
|------|---------|
| `src/views/CanvasView.vue` | Moved button outside canvas-drop-zone, changed to fixed positioning |

## Verification Steps

1. Navigate to Canvas view
2. Verify button appears at top-right, just above the rounded canvas box
3. Click button to toggle - should switch between "Done" (gray) and "Hidden" (purple)
4. Verify button is clickable and visible on all viewport sizes

## Rollback Procedure

```bash
git checkout HEAD -- src/views/CanvasView.vue
```

## Lessons Learned

1. **Tailwind Arbitrary Values**: May not compile in all contexts; use inline `:style` bindings as fallback
2. **Fixed vs Absolute**: Use `fixed` positioning for elements that need viewport-relative placement
3. **CSS Stacking Context**: Overlays with high z-index can block clicks; use `pointer-events: none` on overlays
4. **DOM Measurements**: Use Playwright's `evaluate()` to measure actual element positions when debugging

## Related Issues

- **Fixed**: Canvas Done toggle incorrectly synced with Inbox done filter

### Inbox Separation Fix

The inbox panel was using `hideCanvasDoneTasks` from the store, causing both toggles to sync. Fixed by giving the inbox its own local state:

**File**: `src/components/inbox/UnifiedInboxPanel.vue`

```typescript
// Before (broken - synced with canvas):
const hideCanvasDoneTasks = computed(() => taskStore.hideCanvasDoneTasks)
const currentHideDoneTasks = computed(() => hideCanvasDoneTasks.value)

// After (fixed - independent local state):
const hideInboxDoneTasks = ref(false)
const currentHideDoneTasks = computed(() => hideInboxDoneTasks.value)
```

**Result**: Canvas "Done" toggle and Inbox "Show Done" button now operate independently.

### Canvas Node Sync Watcher Fix

**Problem**: Clicking the canvas Done toggle changed the `hideCanvasDoneTasks` state but canvas nodes were not refreshing. The previous `filteredTasks` watcher was removed to prevent auto-positioning issues.

**Root Cause**: When `hideCanvasDoneTasks` changes, `filteredTasks` computed property updates, but no watcher triggered `syncNodes()` to rebuild the canvas nodes.

**File**: `src/views/CanvasView.vue` (line ~2245)

```typescript
// TASK-076: Watch hideCanvasDoneTasks toggle to refresh canvas nodes
// This ensures clicking the Done toggle immediately shows/hides completed tasks
resourceManager.addWatcher(
  watch(hideCanvasDoneTasks, () => {
    console.log('🔄 [TASK-076] hideCanvasDoneTasks changed, syncing nodes...')
    syncNodes()
  })
)
```

**Result**: Canvas Done toggle now properly filters/shows completed tasks on the canvas.
