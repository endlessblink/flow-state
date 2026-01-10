# Canvas Rebuild - Implementation Checklist

**Purpose**: Track ALL features, ensure nothing is forgotten, verify each before moving on.

**Reference**: All features defined in `03-USER-SCENARIOS.md` (36 scenarios)

---

## Layer 1: Foundation (MUST work perfectly before Layer 2)

| # | Feature | Status | Verified | Notes |
|---|---------|--------|----------|-------|
| 1.1 | Groups load from Supabase | ? | [ ] | `loadGroups()` fetches and displays |
| 1.2 | Groups display at correct positions | ? | [ ] | Position from DB matches visual |
| 1.3 | Drag group to new position | ? | [ ] | Group moves smoothly |
| 1.4 | Position persists on drag stop | ? | [ ] | `persistGroup()` called |
| 1.5 | Position persists after refresh | ? | [ ] | **CRITICAL** - reload shows same position |
| 1.6 | Tasks load from task store | ? | [ ] | Canvas tasks display |
| 1.7 | Tasks display at correct positions | ? | [ ] | `canvasPosition` matches visual |
| 1.8 | Drag task to new position | ? | [ ] | Task moves smoothly |
| 1.9 | Task position persists | ? | [ ] | Refresh keeps position |

**Architecture decisions for Layer 1:**
- Store holds ABSOLUTE positions for root-level items
- Store holds RELATIVE positions for child items
- Vue Flow's `parentNode` handles parent-child rendering
- NO watchers - explicit sync calls only

---

## Layer 2: Parent-Child Basics (After Layer 1 verified)

| # | Feature | Status | Verified | Notes |
|---|---------|--------|----------|-------|
| 2.1 | Child group moves with parent | ? | [ ] | Via `parentNode` in Vue Flow |
| 2.2 | Child task moves with parent group | ? | [ ] | Via `parentNode` in Vue Flow |
| 2.3 | Children stay visible during parent drag | ? | [ ] | No flickering/disappearing |
| 2.4 | Nested positions persist correctly | ? | [ ] | Relative positions saved/loaded |
| 2.5 | Task count shows on groups | ? | [ ] | Direct children counted |
| 2.6 | Recursive task count (parent includes nested) | ? | [ ] | Parent shows total of all descendants |

**Architecture decisions for Layer 2:**
- `parentNode` set on Vue Flow node for children
- `parentGroupId` stored in database
- Position is RELATIVE when has parent
- Sort nodes: parents before children (for Vue Flow)

---

## Layer 3: Containment Detection (After Layer 2 verified)

| # | Feature | Status | Verified | Notes |
|---|---------|--------|----------|-------|
| 3.1 | Drag task INTO group | ? | [ ] | Detect drop inside group bounds |
| 3.2 | Task becomes child of group | ? | [ ] | `parentGroupId` set |
| 3.3 | Drag task OUT of group | ? | [ ] | Parent removed, absolute position |
| 3.4 | Drag small group INTO large group | ? | [ ] | Size determines parent-child |
| 3.5 | Drag child group OUT of parent | ? | [ ] | Parent stays, child becomes independent |
| 3.6 | Parent does NOT move when dragging child out | ? | [ ] | Only child moves |

**Architecture decisions for Layer 3:**
- Use `computedPosition` (absolute) for containment checks
- Exclude current parent from containment candidates (allows drag-out)
- Smaller group inside larger = child of larger
- Convert to relative position when assigning parent

---

## Layer 4: Z-Index & Visual Layering (After Layer 3 verified)

| # | Feature | Status | Verified | Notes |
|---|---------|--------|----------|-------|
| 4.1 | Child groups appear ABOVE parent groups | ? | [ ] | DOM order handles this |
| 4.2 | Tasks appear ABOVE all groups | ? | [ ] | CSS z-index 1000+ |
| 4.3 | Dragging element on top of everything | ? | [ ] | z-index 10000 |
| 4.4 | No z-index traps from stacking contexts | ? | [ ] | Groups don't set z-index |

**Architecture decisions for Layer 4:**
- Groups: NO inline z-index (avoid stacking contexts)
- Tasks: CSS `z-index: 1000 !important`
- Dragging: CSS `z-index: 10000 !important`
- Node array order: parents before children

---

## Layer 5: Inbox Integration (After Layer 4 verified)

| # | Feature | Status | Verified | Notes |
|---|---------|--------|----------|-------|
| 5.1 | Inbox panel shows inbox tasks | ? | [ ] | `isInInbox: true` tasks |
| 5.2 | Drag task from inbox to canvas | ? | [ ] | Sets position, clears inbox flag |
| 5.3 | Drag task from inbox to group | ? | [ ] | Sets position + parent |
| 5.4 | Task count updates immediately on drop | ? | [ ] | No refresh needed |

---

## Layer 6: Advanced Features (After Layer 5 verified)

| # | Feature | Status | Verified | Notes |
|---|---------|--------|----------|-------|
| 6.1 | Group collapse/expand | ? | [ ] | Hides/shows children |
| 6.2 | Group resize | ? | [ ] | Only resized group changes |
| 6.3 | Multi-select tasks | ? | [ ] | Ctrl+click selection |
| 6.4 | Multi-drag (move selection together) | ? | [ ] | Preserve relative spacing |
| 6.5 | Context menu on tasks | ? | [ ] | Right-click actions |
| 6.6 | Context menu on groups | ? | [ ] | Right-click actions |
| 6.7 | Delete group (tasks become floating) | ? | [ ] | Orphan tasks, not delete |
| 6.8 | Smart groups (date/priority auto-assign) | ? | [ ] | Future feature |

---

## Verification Protocol

For EACH feature:
1. Implement the code
2. Test manually in browser
3. Check console for errors
4. Refresh page and verify persistence
5. Mark as verified in this checklist
6. Only then move to next feature

---

## Current Status

**Working on**: Layer 1 - Foundation
**Next verification**: 1.1 Groups load from Supabase

---

## Files to Track

| File | Purpose | Layer |
|------|---------|-------|
| `CanvasViewNew.vue` | Orchestration | 1 |
| `canvasNew.ts` (store) | State management | 1 |
| `useCanvasCore.ts` | Vue Flow setup | 1 |
| `useCanvasGroups.ts` | Group loading/sync | 1 |
| `useCanvasNodes.ts` | Task nodes | 1 |
| `useCanvasDrag.ts` | Drag handlers | 2-3 |
| `GroupNodeNew.vue` | Group component | 1 |
| `TaskNodeNew.vue` | Task component | 1 |
| `CanvasInbox.vue` | Inbox panel | 5 |
