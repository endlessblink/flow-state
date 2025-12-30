# Perplexity Query: Vue Flow Viewport Persistence Across Page Refresh

## Problem Summary

In a Vue 3 + Vue Flow application, the canvas viewport (pan position and zoom level) resets to default (x:0, y:0, zoom:1) every time the page is refreshed. Users expect their view position to be remembered.

## Technical Context

### Stack
- Vue 3.4.0 with Composition API (`<script setup>`)
- Vue Flow v1.41.6 (@vue-flow/core)
- Pinia for state management
- PouchDB (IndexedDB) for local persistence
- Vite 7.2.4 dev server

### Current Architecture

**Vue Flow Setup (CanvasView.vue):**
```typescript
const {
  fitView: vueFlowFitView,
  viewport: vfViewport,   // Vue Flow's reactive viewport ref
  setViewport: vueFlowSetViewport,  // Function to programmatically set viewport
  // ... other destructured functions
} = useVueFlow()
```

**Canvas Store (canvas.ts):**
```typescript
// Viewport state - syncs with Vue Flow
const viewport = ref({
  x: 0,
  y: 0,
  zoom: 1
})

const setViewport = (x: number, y: number, zoom: number) => {
  viewport.value = { x, y, zoom }
}
```

### What I've Tried

1. **Added viewport watcher to auto-save to IndexedDB:**
```typescript
watch(viewport, (newViewport) => {
  setTimeout(async () => {
    await db.save('canvas_viewport', newViewport)
  }, 500)
}, { deep: true })
```

2. **Added loadSavedViewport function:**
```typescript
const loadSavedViewport = async () => {
  const savedViewport = await db.load('canvas_viewport')
  if (savedViewport) {
    viewport.value = savedViewport
    return true
  }
  return false
}
```

3. **Called it in onMounted:**
```typescript
onMounted(async () => {
  const restored = await canvasStore.loadSavedViewport()
  if (restored) {
    setTimeout(() => {
      vueFlowSetViewport({
        x: canvasStore.viewport.x,
        y: canvasStore.viewport.y,
        zoom: canvasStore.viewport.zoom
      })
    }, 100)
  }
})
```

### Problems

1. **Store viewport not syncing with Vue Flow viewport** - When user pans/zooms, the Vue Flow internal `vfViewport` changes, but our store's `viewport` doesn't update unless we explicitly sync them.

2. **Vue Flow's `onViewportChange` event** - Not sure if we're listening to viewport changes correctly.

3. **Timing issues** - Vue Flow might not be ready when we try to restore the viewport.

## Questions

1. **How to properly sync Vue Flow's viewport changes to Pinia store?**
   - Should I use `@viewport-change` event on the VueFlow component?
   - Or watch `vfViewport` from `useVueFlow()`?

2. **Best practice for restoring viewport on mount?**
   - When is Vue Flow "ready" to accept `setViewport()` calls?
   - Is there an `onInit` or `onReady` event to wait for?

3. **Vue Flow viewport persistence patterns?**
   - Does Vue Flow have built-in support for viewport persistence?
   - What's the recommended approach from Vue Flow documentation?

4. **Common pitfalls with Vue Flow viewport management?**
   - Does `fitView()` override custom viewport?
   - Are there conflicting watchers/events?

## Expected Behavior

1. User pans/zooms the canvas
2. Viewport position is auto-saved to IndexedDB
3. On page refresh, viewport is restored to saved position
4. Canvas displays at the exact same view location as before refresh

## Code References

- Vue Flow docs: https://vueflow.dev/
- Viewport section: https://vueflow.dev/guide/vue-flow/controlled-flow.html
- `@viewport-change` event: https://vueflow.dev/typedocs/interfaces/VueFlowProps.html

## Search Terms

- vue flow save viewport position
- vue flow persist pan zoom on refresh
- vue flow onViewportChange event
- vue flow restore viewport after reload
- vue flow viewport state management pinia
