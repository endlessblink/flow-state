# Canvas Rebuild - Failed Attempt (January 10, 2026)

## Why This Code Was Archived

This directory contains an abandoned canvas rebuild attempt that was **never integrated** into the application. The rebuild was meant to replace the complex 22,500+ line canvas implementation with a simpler ~2,500 line version, but was never completed.

## What's Here

### Views
- `CanvasViewNew.vue` - Fresh canvas view (never routed)

### Store
- `canvasNew.ts` - New Pinia store for canvas state

### Composables (5 files)
- `useCanvasCore.ts` - Core Vue Flow setup
- `useCanvasDrag.ts` - Drag-drop handlers
- `useCanvasGroups.ts` - Group management
- `useCanvasNodes.ts` - Node sync logic
- `useCanvasTasks.ts` - Task operations

### Components (3 files)
- `CanvasInbox.vue` - Inbox panel component
- `GroupNodeNew.vue` - Group node component
- `TaskNodeNew.vue` - Task node component

### Backup Files
- `CanvasView.vue.bak.phase2` - Backup from failed rebuild phase
- `canvas.ts.bak.phase2` - Store backup from failed rebuild phase
- `useCalendarDayView.ts.bak` - Unrelated calendar backup

## Working Canvas Location

The **working** canvas implementation remains at:
- `src/views/CanvasView.vue` (routed at `/canvas`)
- `src/stores/canvas.ts`
- `src/composables/canvas/`
- `src/components/canvas/`

## Context

See `docs/process-docs/canvas-rebuild_10.1.26/` for detailed documentation about why the rebuild was attempted and what problems it aimed to solve.

---

Archived: January 10, 2026
