# Canvas System Documentation

**Last Updated**: January 18, 2026

The canvas view uses Vue Flow for a node-based task visualization system. This directory contains all canvas-related SOPs and architectural documentation.

---

## Quick Reference

| Document | Purpose |
|----------|---------|
| [CANVAS-POSITION-SYSTEM.md](./CANVAS-POSITION-SYSTEM.md) | Position/coordinate architecture, geometry invariants |
| [CANVAS-DRAG-DROP.md](./CANVAS-DRAG-DROP.md) | Drag, drop, and selection behavior |
| [CANVAS-DEBUGGING.md](./CANVAS-DEBUGGING.md) | Troubleshooting tools and debugging techniques |

---

## Key Architecture Points

### Geometry Invariants (CRITICAL)

1. **Single Writer Rule**: Only drag handlers may change `parentId`, `canvasPosition`, `position`
2. **Sync is Read-Only**: `useCanvasSync.ts` MUST NEVER call `updateTask()` or `updateGroup()`
3. **Metadata Only**: Smart-Groups update `dueDate`/`status`/`priority`, NEVER geometry

### Key Composables

| Composable | Purpose |
|------------|---------|
| `useCanvasSync.ts` | **CRITICAL** - Single source of truth for node sync |
| `useCanvasInteractions.ts` | Drag-drop, selection, and node interactions |
| `useCanvasParentChildHelpers.ts` | Parent-child relationship utilities |
| `useCanvasEvents.ts` | Vue Flow event handlers |
| `useCanvasActions.ts` | Task/group CRUD operations |

---

## Quarantined Features

These features were disabled because they violated geometry invariants:

| Feature | Reason |
|---------|--------|
| `useMidnightTaskMover.ts` | Auto-moved tasks at midnight, caused position drift |
| `useCanvasOverdueCollector.ts` | Auto-collected overdue tasks, caused position drift |

See ADR comments in each quarantined file for full context.

---

## Related Documentation

- `CLAUDE.md` - Canvas Geometry Invariants section
- `docs/claude-md-extension/architecture.md` - Full architecture reference
- `docs/sop/active/` - Active canvas-related SOPs (prefixed `CANVAS-*`)
