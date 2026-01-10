# Canvas View Refactor Prompt

## Overview
Refactor `src/views/CanvasView.vue` to reduce complexity while preserving Vue Flow functionality.

**Current State:**
- CanvasView.vue: **2,098 LOC** (Template: 154, Script: 1,767, Style: 2)
- Composables: 33 files, 6,025 LOC
- Console.log statements: **203 total** (59 in view, 144 in composables)

**Target:**
- CanvasView.vue: **<600 LOC**
- Console.log: **0**
- Health Score: 6.0/10 → 8.0+/10

---

## ⚠️ CRITICAL: Vue Flow Extraction Rules

**DO NOT EXTRACT from CanvasView.vue:**
- `v-model:nodes` and `v-model:edges` bindings
- `@node-drag-stop`, `@connect`, `@edge-created` event handlers
- `VueFlow` component and direct children
- `useVueFlow()` composable usage
- Node/edge synchronization logic

**SAFE TO EXTRACT:**
- Canvas controls (zoom, pan, toolbar)
- Modals and overlays
- Context menus
- Helper functions that don't touch Vue Flow state

---

## Phase 1: Console.log Cleanup (Priority)

### Goal
Remove all 203 console.log/warn/error statements across canvas system.

### Files to Clean
```bash
# Run to find all occurrences:
grep -rn "console\.\(log\|warn\|error\|debug\)" src/views/CanvasView.vue src/composables/canvas/
```

### Patterns to Replace

**Remove debugging logs:**
```typescript
// REMOVE these patterns:
console.log('[CanvasStore] loadFromDatabase called')
console.log('Initial tab visibility:', document.visibilityState)
console.log('[CanvasCore] Syncing nodes:', { groups, tasks })
```

**Convert error handling to proper patterns:**
```typescript
// BEFORE
console.error('❌ Operation failed:', error)

// AFTER - use error handler utility
import { handleError, ErrorCategory } from '@/utils/errorHandler'
handleError(error, ErrorCategory.CANVAS, 'Operation failed')
```

---

## Phase 2: Extract Orchestration Composable

### Goal
Move the coordination logic from CanvasView.vue to a new orchestration composable.

### Create `useCanvasOrchestrator.ts`

This composable should coordinate all canvas subsystems:

```typescript
// src/composables/canvas/useCanvasOrchestrator.ts
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Node, Edge } from '@vue-flow/core'

export function useCanvasOrchestrator(options: {
  taskStore: ReturnType<typeof useTaskStore>
  canvasStore: ReturnType<typeof useCanvasStore>
  canvasUiStore: ReturnType<typeof useCanvasUiStore>
  uiStore: ReturnType<typeof useUIStore>
}) {
  const { taskStore, canvasStore, canvasUiStore, uiStore } = options

  // Core reactive state
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const isCanvasReady = ref(false)
  const isInteracting = ref(false)

  // Coordinate all subsystems
  const lifecycle = useCanvasLifecycle(taskStore, canvasStore, uiStore)
  const navigation = useCanvasNavigation(canvasStore)
  const alignment = useCanvasAlignment()
  const sync = useCanvasSync(nodes, edges, taskStore, canvasStore)
  const actions = useCanvasActions(taskStore, canvasStore)
  const modals = useCanvasModals()
  const contextMenus = useCanvasContextMenus()
  const filtering = useCanvasFiltering(taskStore, canvasStore, isInteracting)
  const hotkeys = useCanvasHotkeys({ /* deps */ })

  // Expose unified interface
  return {
    // State
    nodes,
    edges,
    isCanvasReady,
    isInteracting,

    // From lifecycle
    storeHealth: lifecycle.storeHealth,

    // From navigation
    initialViewport: navigation.initialViewport,
    fitCanvas: navigation.fitCanvas,
    zoomToSelection: navigation.zoomToSelection,

    // From alignment
    ...alignment,

    // From sync
    syncNow: sync.syncNow,

    // From actions
    ...actions,

    // From modals
    ...modals,

    // From context menus
    ...contextMenus,

    // From filtering
    filteredTasks: filtering.filteredTasks,

    // From hotkeys
    handleKeyDown: hotkeys.handleKeyDown,
  }
}
```

### Resulting CanvasView.vue Structure

```vue
<script setup lang="ts">
import { useCanvasOrchestrator } from '@/composables/canvas/useCanvasOrchestrator'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { useUIStore } from '@/stores/ui'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const canvasUiStore = useCanvasUiStore()
const uiStore = useUIStore()

const {
  // Core state
  nodes,
  edges,
  isCanvasReady,

  // Navigation
  initialViewport,
  fitCanvas,

  // Actions
  handleAddTask,
  handleCreateGroup,
  deleteSelectedTasks,

  // Modals
  showTaskEditModal,
  closeTaskEditModal,

  // Context menus
  showCanvasContextMenu,
  closeCanvasContextMenu,

  // ... other destructured values
} = useCanvasOrchestrator({
  taskStore,
  canvasStore,
  canvasUiStore,
  uiStore
})

// Vue Flow event handlers (MUST stay in component)
const handleNodeDragStop = (event) => {
  // Minimal handler that calls composable methods
}

const handleNodesChange = (changes) => {
  // Minimal handler
}
</script>
```

---

## Phase 3: Consolidate Duplicate Composables

### Issue
Two sync folders exist with overlapping files:
- `src/composables/canvas/useCanvasNodeSync.ts` (419 LOC)
- `src/composables/canvas/sync/useCanvasNodeSync.ts` (419 LOC)
- `src/composables/canvas/useCanvasEdgeSync.ts` (103 LOC)
- `src/composables/canvas/sync/useCanvasEdgeSync.ts` (103 LOC)

### Action
1. Compare the files to identify differences
2. Keep the more complete/recent version
3. Update all imports to use the canonical location
4. Delete the duplicate

```bash
# Check differences:
diff src/composables/canvas/useCanvasNodeSync.ts src/composables/canvas/sync/useCanvasNodeSync.ts
diff src/composables/canvas/useCanvasEdgeSync.ts src/composables/canvas/sync/useCanvasEdgeSync.ts
```

### Canonical Location
Keep files in `src/composables/canvas/` (root), delete `/sync/` subfolder.

---

## Phase 4: Extract Remaining Inline Logic

### Functions to Extract from CanvasView.vue

| Function | Lines | Target Composable |
|----------|-------|-------------------|
| `safeStoreOperation` | 17 | `useCanvasLifecycle.ts` |
| `_getVisibleProjectIds` | 20 | `useCanvasFiltering.ts` |
| `withVueFlowErrorBoundary` | 20 | `useVueFlowErrorHandling.ts` |
| `systemHealthy` computed | 10 | `useCanvasLifecycle.ts` |
| `retryFailedOperation` | 50 | `useCanvasActions.ts` |

### Inline Refs to Consolidate

Move these from CanvasView.vue to appropriate composables:

```typescript
// These are scattered in CanvasView.vue:
const isHandlingNodeChange = ref(false)
const isSyncing = ref(false)
const isNodeDragging = ref(false)
const hasRunOverdueCheck = ref(false)
const recentlyRemovedEdges = ref(new Set<string>())
const recentlyDeletedGroups = ref(new Set<string>())

// Move to useCanvasSync.ts or useCanvasOrchestrator.ts
```

---

## Phase 5: Verification Checklist

After refactoring, verify:

- [ ] **Build passes**: `npm run build`
- [ ] **No console.log**: `grep -rn "console\." src/views/CanvasView.vue src/composables/canvas/`
- [ ] **CanvasView.vue < 600 LOC**: `wc -l src/views/CanvasView.vue`
- [ ] **Drag-drop works**: Drag task between groups
- [ ] **Node connections work**: Create edge between nodes
- [ ] **Viewport persists**: Refresh page, check zoom/pan preserved
- [ ] **Context menus work**: Right-click on canvas, node, edge
- [ ] **Modals work**: Edit task, create group modals open/close
- [ ] **Hotkeys work**: Test Ctrl+Z undo, Delete key

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| CanvasView.vue LOC | 2,098 | <600 |
| Console.log total | 203 | 0 |
| Duplicate composables | 4 files | 0 |
| Build | Pass | Pass |
| All features working | Yes | Yes |

---

## Files to Modify

### Primary
- `src/views/CanvasView.vue` - Slim down to <600 LOC

### Create
- `src/composables/canvas/useCanvasOrchestrator.ts` - New orchestration layer

### Modify (console.log removal)
- All 26 composable files with console statements

### Delete (duplicates)
- `src/composables/canvas/sync/useCanvasNodeSync.ts`
- `src/composables/canvas/sync/useCanvasEdgeSync.ts`
- `src/composables/canvas/sync/` directory

---

## Order of Operations

1. **Console.log cleanup** (lowest risk, immediate improvement)
2. **Delete duplicate sync files** (consolidation)
3. **Create useCanvasOrchestrator.ts** (new abstraction)
4. **Extract inline logic** to existing composables
5. **Slim CanvasView.vue** using orchestrator
6. **Verify all functionality**

---

## Notes

- The Vue Flow component MUST stay in CanvasView.vue per the critical rules
- Previous refactoring attempts that extracted Vue Flow caused complete breakage
- Focus on moving TypeScript logic, not Vue Flow template bindings
- Test frequently - canvas is critical functionality
