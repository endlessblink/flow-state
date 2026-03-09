# SOP-060: WebKitGTK Gotchas (Tauri Parity)

**Created**: 2026-03-09 | **Status**: Active | **Related**: TASK-1494

Tauri on Linux uses WebKitGTK, which has significant behavioral differences from Chromium. This document catalogs known gotchas and required workarounds.

## Pre-Deploy Testing

```bash
npm run test:tauri-parity    # Unit tests for all Tauri code paths + CSS safety
npm run test:tauri-e2e       # E2E tests in WebKit with Tauri simulation
```

The deploy script (`deploy-tauri-update.sh`) automatically runs `test:tauri-parity` before building.

---

## CSS Gotchas

### 1. `overflow: clip` Not Supported

**Bug**: Calendar grid collapsed to 0 height (v1.3.6)

WebKitGTK does not support `overflow: clip`. It silently ignores it, which can break flex layout chains where `overflow` affects scrollable area computation.

**Rule**: Use `overflow: hidden` instead. If `overflow: clip` is intentionally used (e.g., for swipe gestures), add `/* WebKitGTK-safe: [reason] */` comment.

**Test**: `tests/safety/css-syntax.test.ts` → "should not use overflow:clip without WebKitGTK-safe marker"

### 2. `perspective` Creates Containing Block for `position: fixed`

**Bug**: Swiping card trapped inside card stack (BUG-1453)

Per CSS spec, `perspective` on a parent creates a containing block that traps `position: fixed` descendants. Chromium sometimes ignores this; WebKitGTK enforces it strictly.

**Rule**: Never put `perspective` on a parent of `position: fixed` elements. Use 2D transforms only, or switch the child to `position: absolute` with a different escape strategy.

**Test**: `tests/safety/css-syntax.test.ts` → "should warn about perspective + position:fixed trap"

### 3. `backdrop-filter` Rendering Differences

WebKitGTK renders `backdrop-filter: blur()` differently (often with visible edges). The `.tauri-app` CSS class in `styles.css` applies Tauri-specific overrides.

**Rule**: Always test glass morphism effects in the Tauri build. Use `.tauri-app` selector for WebKitGTK-specific CSS overrides.

---

## JavaScript Gotchas

### 4. `dataTransfer.getData()` Returns Empty String in Drop Events

**Bug**: Catalog drag between categories broken (v1.3.9)

WebKitGTK's HTML5 DnD implementation returns empty strings from `event.dataTransfer.getData()` during intra-page `drop` events. This is a known Tauri/WebKitGTK bug ([tauri#12052](https://github.com/tauri-apps/tauri/issues/12052)).

**Rule**: Always read from the `dragData` singleton (from `useDragAndDrop()`) first, fall back to `dataTransfer.getData()` only when the singleton is null.

```typescript
// CORRECT pattern (works in both Chromium and WebKitGTK)
let dragData = activeDragData.value
if (!dragData) {
  const dataString = event.dataTransfer?.getData('application/json')
  if (dataString) {
    try { dragData = JSON.parse(dataString) } catch { /* ignore */ }
  }
}
```

**Test**: `tests/unit/tauri-parity/tauri-code-paths.test.ts` → "Drag-and-Drop Tauri Fallback"

### 5. `setDragImage()` Doesn't Work

WebKitGTK ignores `event.dataTransfer.setDragImage()`. The ghost pill is created via DOM element + `requestAnimationFrame` instead.

**Rule**: In Tauri mode, skip `setDragImage()` and use the deferred ghost pill pattern from `useDragAndDrop.ts`.

### 6. `Notification.requestPermission()` Hangs

**Bug**: BUG-1303

WebKitGTK's `Notification.requestPermission()` never resolves, causing the app to hang.

**Rule**: Skip `Notification.requestPermission()` when `isTauri()` is true. Tauri handles notifications through its own plugin.

**Test**: `tests/unit/tauri-parity/tauri-code-paths.test.ts` → "Notification Permission Guard"

### 7. IndexedDB Structured Clone Rejects Vue Proxies

**Bug**: DataCloneError spam (v1.3.8)

`toRaw()` is shallow — it strips the top-level Vue proxy but not nested reactive objects. IndexedDB's structured clone algorithm rejects Proxy objects.

**Rule**: Always deep-clone before IndexedDB storage: `JSON.parse(JSON.stringify(toRaw(obj)))`

**Test**: `tests/unit/tauri-parity/tauri-code-paths.test.ts` → "IndexedDB Structured Clone Safety"

### 8. Context Menu Coordinate Scale Factor

**Bug**: BUG-1116

WebKitGTK applies DPI scaling differently. Context menu coordinates from `event.clientX/Y` may need adjustment.

**Rule**: Use `contextMenuCoordinates.ts` utility which applies scale-factor correction in Tauri mode.

**Test**: `tests/unit/tauri-parity/tauri-code-paths.test.ts` → "Context Menu Coordinates"

---

## HTML Gotchas

### 9. Bare Boolean Attributes on vuedraggable

**Bug**: BUG-1335 (Kanban drag broken)

Vue 3 `$attrs` passes bare boolean HTML attributes as empty strings (`""`). SortableJS treats `""` as falsy.

**Rule**: Always use `:force-fallback="true"`, never bare `force-fallback`.

**Test**: `tests/safety/css-syntax.test.ts` → "should not have bare boolean attributes on vuedraggable"

---

## Filesystem Gotchas

### 10. Path Construction Must Include Separator

**Bug**: Session file forbidden path (v1.3.8)

`homeDir()` from `@tauri-apps/api/path` returns a path WITHOUT trailing slash. Always add `/` when concatenating.

```typescript
// WRONG: `${home}.config/flowstate`  → /home/user.config/flowstate
// RIGHT: `${home}/.config/flowstate` → /home/user/.config/flowstate
```

**Test**: `tests/unit/tauri-parity/tauri-code-paths.test.ts` → "Session File Path Construction"

---

## Feature Checklist (New Code)

When adding features that touch any of these areas, verify against this checklist:

- [ ] **CSS**: No `overflow: clip` without marker. No `perspective` + `position: fixed`.
- [ ] **Drag-and-drop**: Uses `dragData` singleton first, `dataTransfer` as fallback.
- [ ] **IndexedDB writes**: Deep-clones with `JSON.parse(JSON.stringify(toRaw()))`.
- [ ] **vuedraggable**: All boolean attrs use `:attr="true"` binding.
- [ ] **Filesystem paths**: Include `/` between segments from Tauri path APIs.
- [ ] **Notifications**: Guard with `isTauri()` check.
- [ ] **Run**: `npm run test:tauri-parity` passes.
