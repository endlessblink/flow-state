# SOP-047: Tauri WebKitGTK Drag-and-Drop Fix

**Created**: 2026-02-21
**Status**: Active
**Related**: BUG-1370, SOP-045

## Problem

HTML5 drag-and-drop (inbox task → canvas) works in browser but **immediately cancels** in Tauri on Linux. The drag starts (`dragstart` fires) then instantly ends (`dragend` fires) — no `dragover` or `drop` events ever fire.

## Root Cause

Tauri on Linux uses **WebKitGTK** as its webview engine. WebKitGTK has two critical differences from Chromium/Firefox:

1. **`setDragImage()` with detached elements cancels the drag.** Chromium allows passing a DOM element that's not in the document tree. WebKitGTK requires the element to be mounted and visible.

2. **DOM mutations during `dragstart` cancel the drag.** If `document.body.appendChild()` is called synchronously inside a `dragstart` handler, WebKitGTK cancels the drag operation.

Both issues occurred in `useDragAndDrop.ts`:

```typescript
// BROKEN in WebKitGTK:
ghostEl = createGhostPill(title)
document.body.appendChild(ghostEl)        // DOM mutation during dragstart → cancel

const transparent = document.createElement('canvas')
transparent.width = 1; transparent.height = 1
event.dataTransfer.setDragImage(transparent, 0, 0)  // Detached element → cancel
```

## Fix (BUG-1370)

In `src/composables/useDragAndDrop.ts`:

1. **Skip `setDragImage`** in Tauri mode — let the browser use its default drag ghost
2. **Defer ghost pill creation** using `requestAnimationFrame` in Tauri mode — DOM mutation happens after `dragstart` completes

```typescript
const inTauri = isTauri()

if (inTauri) {
  // Defer ghost creation — WebKitGTK cancels drag if DOM is mutated during dragstart
  requestAnimationFrame(() => {
    ghostEl = createGhostPill(title)
    ghostEl.style.cssText = GHOST_CSS + 'left:-9999px;top:-9999px;'
    document.body.appendChild(ghostEl)
  })
} else {
  ghostEl = createGhostPill(title)
  ghostEl.style.cssText = GHOST_CSS + 'left:-9999px;top:-9999px;'
  document.body.appendChild(ghostEl)
}

if (event?.dataTransfer && !inTauri) {
  // Skip in Tauri/WebKitGTK — setDragImage with detached element cancels drag
  const transparent = document.createElement('canvas')
  transparent.width = 1; transparent.height = 1
  event.dataTransfer.setDragImage(transparent, 0, 0)
}
```

## Diagnostic

If drag-and-drop breaks in Tauri again, add this to `App.vue` inside `if (isTauriApp.value)`:

```typescript
document.addEventListener('dragstart', (e) => {
  console.warn('[DRAG-DIAG] dragstart', (e.target as HTMLElement)?.className)
}, true)
document.addEventListener('dragover', (e) => {
  console.warn('[DRAG-DIAG] dragover')
}, true)
document.addEventListener('drop', (e) => {
  console.warn('[DRAG-DIAG] drop')
}, true)
document.addEventListener('dragend', (e) => {
  console.warn('[DRAG-DIAG] dragend')
}, true)
```

**Healthy output**: `dragstart → dragover (many) → drop → dragend`
**Broken output**: `dragstart → dragend` (no dragover/drop = immediate cancel)

## Key Facts

| Item | Value |
|------|-------|
| File | `src/composables/useDragAndDrop.ts` |
| Platform | Linux (WebKitGTK) |
| Config | `dragDropEnabled: false` in `tauri.conf.json` |
| `dragDropEnabled` purpose | Disables OS-level file drag into webview (required for HTML5 drag to work) |
| Trade-off | Tauri shows browser's default drag ghost instead of custom transparent 1x1 |

## Related

- **SOP-045**: Tauri AppImage update workflow (manual override for old builds)
- **BUG-1335**: Kanban drag broken (different root cause — vuedraggable bare boolean attrs)
- **tauri.conf.json line 27**: `dragDropEnabled: false` (must stay false)
