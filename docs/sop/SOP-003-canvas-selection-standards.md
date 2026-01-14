# SOP-003: Canvas Selection & Interaction Standards

**Version**: 1.0
**Last Updated**: 2026-01-14
**Status**: Active

## 1. Core Principle: Standardized Selection
To ensure a predictable user experience, the canvas selection logic must strictly adhere to standard UI conventions.

### Rules
1.  **Single Click**:
    *   **MUST** select the target node.
    *   **MUST** deselect all other nodes (Replace Selection).
    *   **EXCEPTION**: If the node is *already selected*, do NOT deselect others immediately (this enables dragging multiple pre-selected items).
2.  **Ctrl/Meta/Shift + Click**:
    *   **MUST** toggle the selection state of the target node.
    *   **MUST NOT** affect other selected nodes.
3.  **Empty Space Click**:
    *   **MUST** deselect all nodes (Clear Selection).

## 2. Implementation Architecture
We use a **Programmatic Selection** model to ensure state consistency between our Pinia stores and Vue Flow's internal state.

### The "Double-State" Problem
Vue Flow maintains its own internal selection state (`node.selected`). Our app maintains a Pinia state (`canvasStore.selectedNodeIds`). These MUST be kept in sync.

### Requirement: Dependency Injection
Any composable handling selection (like `useCanvasInteractions`) **MUST** receive `applyNodeChanges` from `useVueFlow()` or `useCanvasCore` as a dependency.

```typescript
// ✅ CORRECT
export function useCanvasInteractions(deps: {
    applyNodeChanges: (changes: any[]) => void // REQUIRED
}) {
    // ...
}
```

**Why?**
Vue Flow's `useVueFlow()` hook only works reliably when called inside a component within the Vue Flow provider. Standalone composables often lose context. Passing `applyNodeChanges` explicitly bridges this gap.

## 3. Event Handling Patterns

### `useTaskNodeActions.ts`
Do NOT stop propagation blindly.
*   **Ctrl+Click**: Valid to stop propagation if handling manually, but usually safer to let Vue Flow handle the toggle if possible.
*   **Single Click**: Use manual handling to enforce the "Replace unless dragging" logic.

### `CanvasView.vue`
Sync listener MUST accept empty updates.
```typescript
const handleSelectionChange = (params: any) => {
  // Allow clearing selection (empty array is valid)
  const newSelection = params?.nodes?.map((n: any) => n.id) ?? []
  canvasStore.selectedNodeIds = newSelection
}
```

## 4. Regression Tests
Before modifying selection logic, verify:
1.  **Standard Click**: Click A (selects A). Click B (selects B, deselects A).
2.  **Multi-Select**: Click A. Ctrl+Click B (A and B selected).
3.  **Deselect**: Click empty space (nothing selected).
4.  **Drag Selection**: Select A and B. Click (down) on A. Drag. Both A and B should move. (Clicking A should not deselect B *on mousedown*).
