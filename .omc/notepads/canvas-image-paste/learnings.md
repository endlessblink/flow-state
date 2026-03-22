# Canvas Image Paste — TASK-1690 Learnings

## Architecture Pattern Used
- `canvasImagesStore` (Pinia, localStorage) is intentionally separate from the main `canvas.ts` store to avoid entangling image persistence with the complex group/task store machinery.
- Image nodes are injected into `syncStoreToCanvas` by importing `useCanvasImagesStore` directly in `useCanvasSync.ts` and pushing `imageNode` entries into `newNodes` before the idempotence check.

## Key Decision: No Supabase Table
- Images use Supabase Storage (bucket: `canvas-images`) for the file itself but localStorage for the node metadata (id, position, etc). This avoids needing a DB migration.
- Offline/guest fallback: `uploadCanvasImage` returns a base64 data URL when Supabase is null.

## Reactivity Trigger
- `useCanvasOrchestrator` watches `canvasImagesStore.images.length` with `{ force: true }` to trigger `batchedSyncNodes` whenever an image is added/removed. Force is needed to bypass the drag-settling guard.

## Drag Position Persistence
- `useCanvasInteractions.onNodeDragStop` checks `node.type === 'imageNode'` BEFORE the generic `else` (task) block. This prevents image nodes from falling into the task handler (which calls `taskStore.getTask(node.id)` → undefined → `continue`).
- Position is saved synchronously (no DB write, just localStorage).

## CanvasView.vue Consideration
- `screenToFlowCoordinate` is reused from the orchestrator destructure rather than calling `useVueFlow()` again at the view level. This avoids creating a second VueFlow context.
- `onMounted`/`onUnmounted` added to `vue` import (combined with existing `markRaw`).

## WebKitGTK Note
- `ImageNode.vue` uses `-webkit-backdrop-filter` alongside `backdrop-filter` for WebKitGTK parity (per SOP-060).
