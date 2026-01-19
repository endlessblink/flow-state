# SOP-005: Canvas Position Coordinate System

## Overview

This SOP documents the coordinate system used for canvas task and group positions in FlowState, and the critical distinction between **absolute** and **relative** coordinates.

## The Problem (TASK-288)

Tasks created via "Create Task in Group" were appearing at wrong positions because of coordinate system confusion:
- User clicks at position A
- Task appears at position B (wrong)

### Root Cause

The `canvasPosition` field stores **ABSOLUTE** coordinates, but the code was incorrectly storing **RELATIVE** coordinates (position relative to parent group). The node builder then attempted to convert what it thought was absolute to relative for Vue Flow, causing double-conversion.

## Coordinate System Rules

### 1. `canvasPosition` (Task Store) - ABSOLUTE

The `canvasPosition` field in tasks stores **ABSOLUTE** canvas coordinates:

```typescript
task.canvasPosition = {
    x: -1200,  // Absolute X on canvas
    y: 500     // Absolute Y on canvas
}
```

- These are the coordinates in the Vue Flow canvas space
- Independent of any parent group
- Used for persistence and sync

### 2. Vue Flow Node Position - RELATIVE (when parented)

When a node has a `parentId`, Vue Flow expects **RELATIVE** position to the parent:

```typescript
// For a task inside a group at (-1200, 500) where group is at (-1400, 400)
node.position = {
    x: 200,  // Relative: -1200 - (-1400) = 200
    y: 100   // Relative: 500 - 400 = 100
}
```

### 3. Conversion (Node Builder)

The node builder handles conversion from absolute → relative:

```typescript
// In node builder when creating Vue Flow nodes
if (task.parentId) {
    const parentGroup = groups.find(g => g.id === task.parentId)
    node.position = {
        x: task.canvasPosition.x - parentGroup.position.x,
        y: task.canvasPosition.y - parentGroup.position.y
    }
} else {
    node.position = task.canvasPosition  // No conversion needed
}
```

## Creating Tasks at Click Position

When creating a task at a click position within a group:

### CORRECT Approach

```typescript
const createTaskInGroup = (group, screenPos) => {
    // 1. Convert screen → flow coordinates
    const flowCoords = screenToFlowCoordinate(screenPos)

    // 2. Store ABSOLUTE position (centered on click)
    const absolutePos = {
        x: flowCoords.x - (TASK_WIDTH / 2),
        y: flowCoords.y - (TASK_HEIGHT / 2)
    }

    // 3. Clamp to group bounds (in absolute coordinates)
    absolutePos.x = Math.max(groupX + padding, Math.min(absolutePos.x, groupX + groupWidth - TASK_WIDTH - padding))
    absolutePos.y = Math.max(groupY + padding, Math.min(absolutePos.y, groupY + groupHeight - TASK_HEIGHT - padding))

    // 4. Store absolute position with parentId
    task.canvasPosition = absolutePos
    task.parentId = group.id
}
```

### WRONG Approach (caused TASK-288)

```typescript
// DON'T DO THIS - stores relative coordinates in canvasPosition
const relativePos = {
    x: flowCoords.x - groupX - (TASK_WIDTH / 2),  // WRONG: subtracting groupX
    y: flowCoords.y - groupY - (TASK_HEIGHT / 2)  // WRONG: subtracting groupY
}
task.canvasPosition = relativePos  // This will be double-converted!
```

## Debugging Position Issues

### 1. Add Debug Prefix to Whitelist

The console filter blocks `[TASK-` patterns. Add your debug prefix to the whitelist in `consoleFilter.ts`:

```typescript
// In shouldFilter function
if (msg.includes('[MY-DEBUG]')) {
    return false  // Don't filter
}
```

### 2. Log the Position Flow

```typescript
console.log('[MY-DEBUG] Screen position:', screenPos)
console.log('[MY-DEBUG] Flow coordinates:', flowCoords)
console.log('[MY-DEBUG] Group position:', { groupX, groupY })
console.log('[MY-DEBUG] Final absolute position:', absolutePos)
```

### 3. Check INVARIANT Violations

The invariant checker will report position mismatches:
```
[INVARIANT] Vue Flow position doesn't match expected (relative)
{ storeAbsolute: {...}, expectedVueFlowPos: {...}, actualVueFlowPos: {...} }
```

This indicates the node builder's conversion result doesn't match what Vue Flow shows.

## Summary

| Storage Location | Coordinate Type | Notes |
|-----------------|-----------------|-------|
| `task.canvasPosition` | ABSOLUTE | Stored in DB, used for sync |
| `group.position` | ABSOLUTE | Group's position on canvas |
| Vue Flow node (no parent) | ABSOLUTE | Same as canvasPosition |
| Vue Flow node (with parent) | RELATIVE | Relative to parent group |

**Golden Rule**: `canvasPosition` is always ABSOLUTE. The node builder handles conversion to relative for Vue Flow when needed.

## Related Documents

- `docs/sop/SOP-002-canvas-geometry-invariants.md` - Geometry write rules
- `src/composables/canvas/useCanvasTaskActions.ts` - Task creation logic
- `src/utils/canvas/nodeBuilder.ts` - Node conversion logic

## History

- **TASK-288** (2026-01-15): Fixed regression where tasks created in groups appeared at wrong position due to storing relative instead of absolute coordinates.
