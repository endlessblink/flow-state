# SOP: Canvas Viewport Jump Fix (BUG-052)

**Date**: December 31, 2025
**Status**: FIXED
**Severity**: P1-HIGH

## Problem Description

Canvas view would abruptly change/jump when:
- Switching between views (e.g., Calendar → Canvas)
- Hot Module Replacement (HMR) during development
- Page refresh after viewport was saved

Users experienced a jarring jump from position (0, 0) at zoom 1.0 to their saved viewport position.

## Root Cause Analysis

The Vue Flow component was initialized with a **hardcoded default viewport**:

```vue
<VueFlow
  :default-viewport="{ zoom: 1, x: 0, y: 0 }"
  ...
/>
```

The initialization sequence was:
1. `loadSavedViewport()` loads saved viewport into `canvasStore.viewport`
2. `isCanvasReady` set to `true` → Vue Flow renders
3. Vue Flow initializes at (0, 0, 1) due to hardcoded default
4. After 100ms `setTimeout`, `vueFlowSetViewport()` applies saved viewport
5. **Visible jump occurs** during the 100ms gap

## Solution

### 1. Created computed property for initial viewport (line 524-528)

```typescript
// BUG-052: Initial viewport from saved state - prevents jump when Vue Flow initializes
const initialViewport = computed(() => ({
  x: canvasStore.viewport.x,
  y: canvasStore.viewport.y,
  zoom: canvasStore.viewport.zoom
}))
```

### 2. Updated Vue Flow to use saved viewport (line 229)

```vue
<VueFlow
  :default-viewport="initialViewport"
  ...
/>
```

### 3. Removed redundant setTimeout (lines 3047-3054)

Before:
```typescript
setTimeout(() => {
  vueFlowSetViewport({...})
  isCanvasReady.value = true
}, 100)
```

After:
```typescript
if (viewportRestored) {
  hasInitialFit.value = true
  isCanvasReady.value = true
  isVueFlowReady.value = true
}
```

## Files Modified

| File | Change |
|------|--------|
| `src/views/CanvasView.vue` | Added `initialViewport` computed, updated `:default-viewport` prop, removed setTimeout delay |
| `src/composables/useVueFlowStability.ts` | Earlier fix: removed `fitView()` from recovery functions |

## Verification

1. Build passes: `npm run build`
2. No viewport jump on view switching
3. No viewport jump on HMR reload
4. Saved viewport position persists correctly

## Rollback Procedure

If issues occur, revert to hardcoded default:

```vue
<VueFlow
  :default-viewport="{ zoom: 1, x: 0, y: 0 }"
  ...
/>
```

And restore the setTimeout in onMounted for viewport restoration.

## Related Issues

- **BUG-048**: Viewport doesn't persist (prerequisite - FIXED Dec 30)
- **TASK-072**: Viewport persistence feature (completed)

## Key Insight

The fix follows Vue's reactivity model: since `loadSavedViewport()` runs BEFORE Vue Flow renders (it sets `isCanvasReady` which gates the `v-if`), the `canvasStore.viewport` already has correct values when Vue Flow mounts. Using a computed property ensures Vue Flow starts at the right position.
