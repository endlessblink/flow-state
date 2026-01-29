# SOP-041: Route Error Boundary for Dynamic Import Failures

**Created**: 2026-01-29
**Related Task**: BUG-1101, TASK-1060
**Status**: Active

## Problem

When Vite dev server disconnects or dynamic imports fail during navigation:
1. Vue Router throws uncaught `TypeError: Failed to fetch dynamically imported module`
2. Navigation fails silently with no user feedback
3. App becomes unresponsive until manual page refresh

## Solution

Three-layer error handling for graceful recovery:

### 1. Router Error Handler (`src/router/index.ts`)

```typescript
router.onError((error, to, _from) => {
  if (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk')
  ) {
    // Store failed route for retry
    sessionStorage.setItem('failedRoute', to.fullPath)
    sessionStorage.setItem('importError', error.message)

    // Dispatch event for UI
    window.dispatchEvent(new CustomEvent('route-load-error', {
      detail: { error, route: to.fullPath }
    }))
  }
})
```

### 2. Error Boundary Component (`src/components/error/RouteErrorBoundary.vue`)

- Listens for `route-load-error` custom event
- Shows user-friendly overlay with error message
- Provides "Try Again" button with exponential backoff (1s → 2s → 4s)
- Provides "Full Reload" button for hard refresh
- Auto-closes on successful recovery

### 3. App Integration (`src/App.vue`)

```vue
<template>
  <RouteErrorBoundary />
  <!-- rest of app -->
</template>

<script setup>
import RouteErrorBoundary from '@/components/error/RouteErrorBoundary.vue'
</script>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/router/index.ts` | Catches router errors, dispatches events |
| `src/components/error/RouteErrorBoundary.vue` | Error overlay UI with retry logic |
| `src/App.vue` | Mounts error boundary globally |

## Verification

1. Start dev server: `npm run dev`
2. Open app in browser
3. Stop Vite server (Ctrl+C)
4. Click any navigation link
5. **Expected**: Error overlay appears with "Connection Lost" message
6. Restart Vite server
7. Click "Try Again"
8. **Expected**: App recovers, overlay closes

## Design Tokens Used

- `--overlay-component-bg` - Modal background
- `--border-subtle` - Card border
- `--radius-xl` - Card border radius
- `--space-*` - Spacing
- `--accent-primary` - Button color
- `--text-primary`, `--text-secondary` - Text colors

## Notes

- Error boundary uses `z-index: 10000` to appear above all content
- Retry uses exponential backoff to avoid hammering a recovering server
- After 3 failed retries, suggests full page reload
- Uses `Teleport` to render at document body level
