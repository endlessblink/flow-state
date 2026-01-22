# SOP-018: Canvas Group Nesting & Parent Relationships

**Created**: 2026-01-22
**Status**: Active
**Related**: BUG-356, TASK-255 (Geometry Invariants)

---

## Overview

This SOP documents how canvas groups determine parent-child relationships and how to troubleshoot issues where groups incorrectly move together.

## The Problem

**Symptom**: Dragging one group causes other unrelated groups (or tasks) to move with it.

**Root Cause**: Corrupted `parentGroupId` relationships in the database where groups were incorrectly nested under each other.

**How Corruption Happens**:
1. When a group is dragged, its **center point** is checked against all other groups
2. If the center lands inside another group's bounds, a parent-child relationship is created
3. Similar-sized groups placed near each other can accidentally become nested

## Architecture

### Parent Detection Logic

Located in: `src/utils/canvas/spatialContainment.ts`

```
┌──────────────────────────────────────────────────────────────┐
│  User drags group                                            │
│       ↓                                                      │
│  Calculate group's center point (absolute coordinates)       │
│       ↓                                                      │
│  Check: Is center inside any other group's bounds?           │
│       ↓                                                      │
│  YES: Set parentGroupId = containing group's ID              │
│  NO:  Set parentGroupId = null (root level)                  │
│       ↓                                                      │
│  BUG-356 FIX: Additional check for groups:                   │
│  "Is potential parent at least 2x our area?"                 │
│  NO:  Don't nest (prevents sibling nesting)                  │
└──────────────────────────────────────────────────────────────┘
```

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `findContainingGroups()` | spatialContainment.ts | Find all groups containing a node's center |
| `getDeepestContainingGroup()` | spatialContainment.ts | Find smallest (deepest) containing group |
| `updateGroupParentAfterDrag()` | useCanvasInteractions.ts | Update parentGroupId after drag |
| `breakGroupCycles()` | storeHelpers.ts | Fix cycles and invalid parents on load |
| `resetAllGroupsToRoot()` | storeHelpers.ts | Emergency fix - clear all nesting |

## Safeguards (BUG-356 Fix)

### 1. Area Ratio Requirement

Groups can only nest inside other groups that are **at least 2x their area**.

```typescript
// In findContainingGroups()
const isNodeLikelyGroup = nodeWidth > DEFAULT_TASK_WIDTH * 1.5 || nodeHeight > DEFAULT_TASK_HEIGHT * 1.5
const minAreaRatio = isNodeLikelyGroup ? 2.0 : 1.0

if (groupArea < nodeArea * minAreaRatio) {
    return false // Parent too small - reject nesting
}
```

**Why 2x?** Prevents similar-sized groups (like day columns) from accidentally nesting when placed adjacent.

### 2. Invalid Parent Cleanup on Load

The `breakGroupCycles()` function now runs on every load and:
- Clears parentGroupId pointing to non-existent groups
- Clears parentGroupId pointing to task IDs (invalid)
- Breaks any circular references (A → B → A)

### 3. Emergency Reset Function

If groups are still incorrectly nested, users can run from browser console:

```javascript
useCanvasStore().resetGroupsToRoot()
// Then refresh the page
```

This clears ALL parentGroupId values, making all groups root-level.

## Troubleshooting

### Problem: Groups moving together when I drag one

1. **Refresh the page** - The enhanced `breakGroupCycles()` will auto-fix invalid parents
2. If still broken, run in console: `useCanvasStore().resetGroupsToRoot()`
3. Refresh again

### Problem: Task dragging moves a group

This means the group has `parentGroupId` set to the task's ID (impossible in valid state).

1. Refresh - auto-cleanup should fix it
2. If not, run `resetGroupsToRoot()` in console

### Problem: Intentional nesting not working

Check if the parent group is **at least 2x the area** of the child group. If not, nesting is blocked to prevent accidental nesting.

**Workaround**: Resize the parent group to be larger.

## Vue Flow Parent-Child Behavior

When a node has `parentNode` set in Vue Flow:
- Its `position` is interpreted as **relative to the parent's top-left corner**
- Moving the parent moves all children automatically
- This is correct behavior - the bug is in corrupted parentGroupId data

## Database Schema

```sql
-- groups table
parent_group_id UUID REFERENCES groups(id) NULL
-- NULL = root level group
-- Valid UUID = nested inside that group
```

## Related Documentation

- [CANVAS-POSITION-SYSTEM.md](./canvas/CANVAS-POSITION-SYSTEM.md) - Position/coordinate system
- [SOP-002-canvas-geometry-invariants.md](./SOP-002-canvas-geometry-invariants.md) - Geometry write policy
- vue-flow-debug skill - Expert knowledge for Vue Flow parent-child debugging

## Changelog

| Date | Change |
|------|--------|
| 2026-01-22 | Initial creation (BUG-356) |
