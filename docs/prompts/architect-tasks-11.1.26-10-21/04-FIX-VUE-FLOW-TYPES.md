# Fix: Vue Flow Type Mismatches

**Priority**: P1-HIGH
**Time Estimate**: 45 minutes
**Dependencies**: None

---

## Problem

6 TypeScript errors from accessing properties that don't exist on Vue Flow types:

| File | Line | Error | Property |
|------|------|-------|----------|
| `useCanvasNodeSync.ts` | 113 | TS2339 | `positionAbsolute` |
| `useCanvasNodeSync.ts` | 138 | TS2339 | `positionAbsolute` |
| `useNodeAttachment.ts` | 110 | TS2339 | `positionAbsolute` (x2) |
| `useNodeAttachment.ts` | 111 | TS2339 | `positionAbsolute` |
| `useCanvasTaskDrag.ts` | 205 | TS2339 | `selected` |
| `useCanvasDragDrop.ts` | 53 | TS2322 | `undefined` not assignable |
| `useCanvasSelection.ts` | 251 | TS2367 | `in_progress` vs `in-progress` |

---

## Fixes

### Fix 1: `src/composables/canvas/useCanvasNodeSync.ts`

**Lines 113, 138** - Use optional chaining and fallback:

```typescript
// Line 113 - CHANGE:
x: existingNode.positionAbsolute?.x ?? existingNode.position.x

// TO:
x: (existingNode as any).positionAbsolute?.x ?? existingNode.position?.x ?? 0

// Line 138 - CHANGE:
x: existingNode.positionAbsolute?.x ?? existingNode.position.x

// TO:
x: (existingNode as any).positionAbsolute?.x ?? existingNode.position?.x ?? 0
```

**Better Solution** - Add type extension at top of file:
```typescript
// At top of file, add:
type NodeWithAbsolute = GraphNode & {
  positionAbsolute?: { x: number; y: number };
};

// Then cast when needed:
const node = existingNode as NodeWithAbsolute;
```

### Fix 2: `src/composables/canvas/useNodeAttachment.ts`

**Lines 110-111** - Same pattern:

```typescript
// CHANGE lines 110-111:
const nodeX = node.positionAbsolute?.x ?? node.positionAbsolute?.x ?? 0;
const nodeY = node.positionAbsolute?.y ?? 0;

// TO:
const pos = (node as any).positionAbsolute ?? node.position ?? { x: 0, y: 0 };
const nodeX = pos.x ?? 0;
const nodeY = pos.y ?? 0;
```

### Fix 3: `src/composables/canvas/useCanvasTaskDrag.ts`

**Line 205** - Cast node for selected property:

```typescript
// CHANGE:
if (node.selected) {

// TO:
if ((node as any).selected) {

// OR use Vue Flow's selection API:
import { useVueFlow } from '@vue-flow/core';
const { getSelectedNodes } = useVueFlow();
// Then check: if (getSelectedNodes.value.some(n => n.id === node.id)) {
```

### Fix 4: `src/composables/canvas/useCanvasDragDrop.ts`

**Line 53** - Add default values:

```typescript
// CHANGE:
x: someValue.x,
y: someValue.y,

// TO:
x: someValue?.x ?? 0,
y: someValue?.y ?? 0,
```

### Fix 5: `src/composables/canvas/useCanvasSelection.ts`

**Line 251** - Fix status comparison:

```typescript
// CHANGE:
if (task.status === 'in-progress') {

// TO (match the actual enum values):
if (task.status === 'in_progress') {
```

---

## Type Helper (Optional)

Create `src/types/vue-flow-extended.ts`:

```typescript
import type { GraphNode, Node } from '@vue-flow/core';

export interface ExtendedGraphNode extends GraphNode {
  positionAbsolute?: { x: number; y: number };
  selected?: boolean;
}

export interface ExtendedNode extends Node {
  positionAbsolute?: { x: number; y: number };
  selected?: boolean;
}

export function hasAbsolutePosition(
  node: GraphNode
): node is ExtendedGraphNode & { positionAbsolute: { x: number; y: number } } {
  return 'positionAbsolute' in node && node.positionAbsolute != null;
}
```

---

## Verification

```bash
# After fixes:
npx vue-tsc --noEmit 2>&1 | grep -E "useCanvas|useNode"

# Expected: No errors from canvas composables

# Test the canvas:
npm run dev
# Navigate to canvas, drag nodes, verify no console errors
```

---

## Success Criteria

- [ ] No TS2339 errors for `positionAbsolute`
- [ ] No TS2339 errors for `selected`
- [ ] No TS2322 errors for undefined assignments
- [ ] No TS2367 errors for status comparisons
- [ ] Canvas drag/drop works without console errors
