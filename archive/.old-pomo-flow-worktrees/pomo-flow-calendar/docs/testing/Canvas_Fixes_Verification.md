# Canvas Bug Fixes Verification

## Fixed Issues

### 1. ✅ Task Dragging Constraints - FIXED
**Problem**: Tasks were stuck inside sections due to Vue Flow's `extent: 'parent'` constraint.
**Fix**: Removed the constraint and updated drag handling logic.
**Location**: `src/views/CanvasView.vue:489-498`

**Before**:
```javascript
extent = 'parent' // Constrains task within section bounds
```

**After**:
```javascript
// REMOVED: extent = 'parent' to allow tasks to be dragged outside sections
// Tasks can now be dragged outside sections - no extent constraint
```

### 2. ✅ Section Height Restoration - FIXED
**Problem**: When sections were collapsed, they didn't restore their original height on expand.
**Fix**: Added `collapsedHeight` property to track and restore original dimensions.
**Location**: `src/stores/canvas.ts:32,188-192`

**Before**: No height tracking during collapse
**After**:
```typescript
collapsedHeight?: number // Store height when collapsed to restore on expand

// Store current height before collapsing
section.collapsedHeight = section.position.height

// Restore original height if it was stored
if (section.collapsedHeight) {
  section.position.height = section.collapsedHeight
  section.collapsedHeight = undefined
}
```

### 3. ✅ Task Transparency - FIXED
**Problem**: Done tasks had `opacity: 0.5` making them too transparent everywhere.
**Fix**: Reduced opacity and added context-aware override for sections.
**Location**: `src/components/canvas/TaskNode.vue:260-271`

**Before**:
```css
.status-done {
  opacity: 0.5;
}
```

**After**:
```css
.status-done {
  opacity: 0.8; /* Reduced transparency - still visible but muted */
}

/* Override opacity for tasks inside sections to maintain visibility */
.vue-flow__node[data-id^="section-"] .task-node.status-done {
  opacity: 0.9; /* Even less transparent inside sections */
}
```

## Testing

The application is running on http://localhost:5546

### Manual Test Steps:

1. **Task Dragging Test**:
   - Create a section and add tasks to it
   - Try dragging tasks outside the section boundaries
   - ✅ Expected: Tasks should be able to leave the section

2. **Section Collapse/Expand Test**:
   - Create a section with some height (resize it taller)
   - Collapse the section (it should become 80px tall)
   - Expand the section
   - ✅ Expected: Section should return to its original height

3. **Task Transparency Test**:
   - Mark some tasks as "done"
   - Check their visibility both inside and outside sections
   - ✅ Expected: Done tasks should be visible but muted (80% opacity outside, 90% inside)

## Technical Details

All fixes preserve existing functionality while solving the specific issues:

- **Dragging**: Maintains parent-child relationships but allows boundary crossing
- **Height**: Tracks dimensions separately from task positions during collapse
- **Transparency**: Context-aware styling maintains visual hierarchy

The fixes are minimal and targeted, avoiding any breaking changes to the canvas system.