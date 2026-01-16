# SOP-007: Task Node Selection Indicators

**Related Task**: TASK-296
**Created**: 2026-01-16
**Status**: Resolved

## Problem

Teal corner squares were appearing on selected task nodes in the canvas view. Users reported wanting these removed as they were visually distracting.

## Root Cause

The `TaskNodeSelection.vue` component rendered four corner indicator divs when a task was selected:

```vue
<template>
  <div class="selection-indicator">
    <div class="selection-corner top-left" />
    <div class="selection-corner top-right" />
    <div class="selection-corner bottom-left" />
    <div class="selection-corner bottom-right" />
  </div>
</template>
```

These had teal (`--brand-primary`) background color and appeared at all four corners of selected tasks.

## Investigation Path

Initial assumption was that these were Vue Flow connection handles (`<Handle>` components). Investigation steps:

1. **Removed Handle components from TaskNode.vue** - Did not fix the issue
2. **Added aggressive CSS rules to hide `.vue-flow__handle`** - Did not fix the issue
3. **Searched codebase for "bottom-left" positioning** - Found `TaskNodeSelection.vue`
4. **User confirmed via browser DevTools inspection** - Elements had class `selection-corner`

## Solution

Removed the corner indicator elements from `TaskNodeSelection.vue`:

**Before:**
```vue
<template>
  <div class="selection-indicator">
    <div class="selection-corner top-left" />
    <div class="selection-corner top-right" />
    <div class="selection-corner bottom-left" />
    <div class="selection-corner bottom-right" />
  </div>
</template>
```

**After:**
```vue
<template>
  <!-- TASK-296: Selection corners removed - selection shown via CSS border/glow on .selected class -->
  <div class="selection-indicator" />
</template>
```

Selection feedback is still provided via the `.selected` CSS class on `TaskNode.vue` which shows a border and glow effect.

## Files Modified

| File | Change |
|------|--------|
| `src/components/canvas/node/TaskNodeSelection.vue` | Removed corner indicator elements |
| `src/components/canvas/TaskNode.vue` | Removed Handle components (bonus cleanup) |
| `src/assets/canvas-view-overrides.css` | Added handle hiding rules (defensive) |

## Debugging Lesson

When a visual element won't disappear despite CSS changes:

1. **Don't assume** - The element may not be what you think it is
2. **Use DevTools** - Right-click > Inspect to see actual element classes
3. **Search by position** - Search codebase for position keywords (e.g., "bottom-left")
4. **Ask user to inspect** - User can provide exact element details from DevTools

## Prevention

When adding visual indicators to canvas nodes:
- Document their purpose clearly
- Consider if they're truly necessary
- Use consistent styling that matches the design system
- Ensure they can be easily disabled if needed
