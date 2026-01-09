# SOP: Vue Flow Parent-Child Refactoring (BUG-153)

**Created**: January 9, 2026
**Status**: 🔄 IN PROGRESS
**Related**: BUG-153, TASK-072, TASK-131, TASK-142

---

## Problem Statement

We have ~1200 lines of custom coordinate conversion logic that fights with Vue Flow's native parent-child handling. This causes:
- Tasks not moving with parent groups
- Position jumping on refresh
- Inconsistent containment detection
- Complex code that's hard to maintain

## Goal

Simplify to trust Vue Flow's native `parentNode` behavior:
- When `node.parentNode = 'parent-id'`, Vue Flow treats `node.position` as relative
- Moving parent automatically moves children
- No custom coordinate conversion needed

---

## Implementation Steps

### Phase 1: Understand Current Flow
- [ ] Map all places where `parentNode` is set/read
- [ ] Map all custom coordinate conversion functions
- [ ] Identify what can be deleted vs what must stay

### Phase 2: Simplify Attachment Logic
- [ ] In `useCanvasDragDrop.ts` on drop:
  1. Detect if task dropped inside a group (simple bounds check)
  2. Set `node.parentNode = 'section-{groupId}'`
  3. Calculate relative position: `relPos = dropPos - groupPos`
  4. Set `node.position = relPos`
  5. Persist `parentId` to task store
- [ ] Delete: Custom coordinate conversion, position locking, settling periods

### Phase 3: Simplify Sync Logic
- [ ] In `useCanvasSync.ts`:
  1. If task has `parentId` in store, set `parentNode` on node
  2. Trust stored position as relative (don't recalculate)
  3. Remove containment re-validation on every sync

### Phase 4: Test Scenarios
- [ ] Drag task into group → task attached, moves with group
- [ ] Drag task out of group → task detached, stays at drop position
- [ ] Refresh page → relationships preserved
- [ ] Drag group → all children move together
- [ ] Nested groups → still work correctly

---

## Files to Modify

| File | Action |
|------|--------|
| `useCanvasDragDrop.ts` | Simplify `handleNodeDragStop` task logic |
| `useCanvasSync.ts` | Remove containment re-calculation |
| `useNodeAttachment.ts` | Keep but simplify |
| `useCanvasParentChild.ts` | Review what's still needed |

## Code to Delete

```typescript
// DELETE: Custom coordinate conversion
getSectionAbsolutePosition()  // Vue Flow handles this
calculateRelativePosition()   // Vue Flow handles this

// DELETE: Position locking
lockTaskPosition()
getLockedTaskPosition()

// DELETE: Settling period
isDragSettling
dragSettleTimeoutId

// DELETE: Complex containment re-validation in sync
// (Simple bounds check on drop is enough)
```

## Code to Keep

```typescript
// KEEP: Simple bounds check for drop detection
isPointInRect(dropX, dropY, groupBounds)

// KEEP: Task count updates
updateSectionTaskCounts()

// KEEP: Basic helpers
getTaskCenter()
```

---

## Vue Flow Native Behavior

```typescript
// This is ALL Vue Flow needs:
node.parentNode = 'section-group-123'  // Set parent
node.position = { x: 50, y: 30 }       // Relative to parent

// Vue Flow automatically:
// - Renders child at parent.position + child.position
// - Moves child when parent moves
// - Handles coordinate conversion internally
```

---

## Progress Log

### Jan 9, 2026
- [x] Identified root cause: Custom code fights Vue Flow
- [x] Updated MASTER_PLAN.md with new approach
- [x] Created this SOP
- [ ] Started Phase 1: Understanding current flow
- [ ] Phase 2: Simplify attachment
- [ ] Phase 3: Simplify sync
- [ ] Phase 4: Testing

---

## Rollback Plan

If refactoring fails:
1. Git stash current changes
2. Revert to commit before refactoring
3. Document what didn't work
4. Consider alternative approach (different library)

---

## Success Criteria

1. Task dragged into group → moves with group on drag
2. Relationships persist across page refresh
3. Code reduced from ~1200 lines to ~200 lines
4. No position jumping or resetting
