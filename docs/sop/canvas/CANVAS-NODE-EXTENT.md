# Canvas Node Extent System (BUG-1310)

## Overview
Vue Flow's `nodeExtent` prop constrains where nodes can be positioned. FlowState uses a dynamic extent computed from all visible content (tasks AND groups) with generous padding.

## Architecture

**File**: `src/composables/canvas/useCanvasFilteredState.ts` — `dynamicNodeExtent` computed

**How it works:**
1. Collects all task canvas positions from `tasksWithCanvasPosition`
2. Collects all group positions from `canvasStore.groups`
3. Computes bounding box (minX, minY, maxX, maxY) from ALL content
4. Adds 10,000px padding on each side
5. Returns as `[[minX-10000, minY-10000], [maxX+10000, maxY+10000]]`

**Fallback**: When no tasks AND no groups exist, returns `[[-50000, -50000], [50000, 50000]]`

**Passed as**: `:node-extent="dynamicNodeExtent"` on the `<VueFlow>` component in `CanvasView.vue`

## Key Files
| File | Role |
|------|------|
| `src/composables/canvas/useCanvasFilteredState.ts` | Computes `dynamicNodeExtent` |
| `src/views/CanvasView.vue` | Passes extent as `:node-extent` prop |
| `src/composables/canvas/useCanvasOrchestrator.ts` | Wires filtered state to VueFlow |

## BUG-1310: Invisible Barrier (Feb 14, 2026)

### Symptom
Dragging groups on the canvas would stop at an invisible barrier. Some groups could be dragged, others couldn't. No error messages in console.

### Root Cause
`dynamicNodeExtent` only computed from **task positions**, ignoring **group positions**. When `taskNodes=0` (tasks not rendered on canvas), the extent defaulted to `[[-2000, -2000], [5000, 5000]]` — a tiny 7000x7000px box.

Groups positioned near the edge (e.g., Thursday at x=4556) had only ~444px of room before hitting the invisible wall at x=5000.

### Why taskNodes=0?
The sync orchestrator's `syncNodes()` was called before task data was fully reactive. The NODE-BUILDER log showed `totalNodes: 9, taskNodes: 0` despite 154 tasks in the database. This is a timing/reactivity issue where `tasksWithCanvasPosition` evaluates to empty during early canvas initialization.

### Fix
1. `dynamicNodeExtent` now includes group positions in the bounds calculation
2. Default extent expanded from `[-2000, 5000]` to `[-50000, 50000]`
3. Cache hash includes both task and group positions for invalidation

### Diagnostic Logging
BUG-1310 added diagnostic logs (DEV only, prefix `[BUG-1310:]`):
- `[BUG-1310:EXTENT]` — Logs extent recalculation with content bounds
- `[BUG-1310:DRAG-START]` — Logs node extent/dimensions at drag start
- `[BUG-1310:DRAGGING]` — Throttled (500ms) position logging during drag
- `[BUG-1310:INIT]` — Logs extent at VueFlow pane ready

## Debugging Invisible Barriers

### Quick Checklist
1. Check `[BUG-1310:EXTENT]` log — is the extent large enough for all content?
2. Check `[NODE-BUILDER]` log — are `taskNodes > 0`? If 0, extent may be too small
3. Check node's `extent` property in `[BUG-1310:DRAG-START]` — should be `'none'`, NOT `'parent'`
4. Compare node position against extent bounds — is the node near an edge?

### Common Causes
| Cause | Symptom | Fix |
|-------|---------|-----|
| `taskNodes=0` | Extent uses small default | Ensure `dynamicNodeExtent` includes group bounds (BUG-1310 fix) |
| `extent: 'parent'` on node | Node constrained to parent bounds | Remove `extent: 'parent'` from node creation |
| Stale extent cache | Extent doesn't update when content moves | Check cache hash includes all relevant positions |
| Group at edge of extent | Group can move in some directions but not others | Increase padding or include group in extent calc |

## Invariants
- `dynamicNodeExtent` MUST include both task AND group positions
- Default extent MUST be large enough for any reasonable canvas layout (50,000px)
- `extent: 'parent'` MUST NOT be set on any node (groups or tasks) — prevents escape from parent
- Extent padding should be 10x the base padding (10,000px) for generous room
