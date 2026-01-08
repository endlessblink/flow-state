# System Selection Guide

Quick reference for choosing the right system/composable for your task.

## Decision Trees

### Need Filtering Logic?
```
Filtering tasks?
├─ Sidebar/Global filter → useSmartViews
├─ View-specific filter → View composable that wraps useTaskFiltering
│   ├─ Canvas → useCanvasFiltering
│   ├─ Inbox → useInboxFiltering
│   └─ Calendar → (inherits from useTaskFiltering)
└─ New filter type → Add to useSmartViews, import elsewhere
```

### Need Drag-Drop Functionality?
```
Drag-drop?
├─ Global state → useDragAndDrop
├─ View-specific behavior
│   ├─ Canvas (parent-child, multi-select) → useCanvasDragDrop
│   ├─ Calendar (ghost preview) → useCalendarDrag
│   └─ Inbox (simple) → useInboxDrag
└─ Shared calculation → Add to utils/
```

### Need Performance Optimization?
```
Performance?
└─ Use usePerformanceManager (single source)
   ├─ createDebounced() → Debounce functions
   ├─ createThrottled() → Throttle functions
   ├─ createMemoized() → Cache computations
   └─ setCache/getCache → Manual caching
```

### Need Containment Detection?
```
Geometric containment?
└─ Import from utils/geometry.ts
   ├─ isPointInRect()
   ├─ findSmallestContainingRect()
   ├─ findAllContainingRects()
   ├─ getTaskCenter()
   └─ isTaskCenterInRect()
```

### Need Duration Categories?
```
Duration filtering/assignment?
└─ Import from utils/durationCategories.ts
   ├─ Types: DurationCategory
   ├─ Constants: DURATION_THRESHOLDS, DURATION_DEFAULTS, DURATION_LABELS
   ├─ Functions: matchesDurationCategory(), getDurationCategory()
   └─ UI: DURATION_FILTER_OPTIONS
```

### Need Power Keywords Detection?
```
Detect keywords in group names?
└─ Import from composables/usePowerKeywords.ts
   ├─ detectPowerKeyword() → Detect keyword in name
   ├─ isPowerGroup() → Check if name has keyword
   ├─ getAllPowerKeywords() → Get all keywords for docs
   └─ Constants: SMART_GROUPS, PRIORITY_KEYWORDS, etc.
```

### Need Sanitization?
```
Sanitize user input?
└─ Import from utils/simpleSanitizer.ts (single source)
```

### Need Context Menu?
```
Context menu?
└─ Import from composables/useContextMenu.ts (single source)
```

---

## System Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      PINIA STORES                           │
│           (Single Source of Truth for Data)                 │
├─────────────────────────────────────────────────────────────┤
│  taskStore.ts    │  canvasStore.ts   │  timerStore.ts       │
│  OWNS: tasks     │  OWNS: viewport   │  OWNS: timer state   │
│                  │  positions, zoom  │                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SHARED UTILITIES                          │
│        (Stateless Functions - Pure Logic)                   │
├─────────────────────────────────────────────────────────────┤
│  utils/geometry.ts        │  utils/durationCategories.ts    │
│  utils/simpleSanitizer.ts │  utils/logger.ts                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 CORE COMPOSABLES                            │
│  (Shared Logic - Used by All Views)                         │
├─────────────────────────────────────────────────────────────┤
│  useTaskFiltering         │  useSmartViews       │  useDragAndDrop   │
│  usePowerKeywords         │  useContextMenu      │  usePerformanceManager │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               VIEW-SPECIFIC COMPOSABLES                     │
│   (Wrappers/Extensions - MUST Derive from Core)             │
├─────────────────────────────────────────────────────────────┤
│  useCanvasFiltering       │  useCanvasDragDrop   │  useCalendarDrag    │
│  useInboxFiltering        │  useInboxDrag        │  useCanvasOverdueCollector │
└─────────────────────────────────────────────────────────────┘
```

---

## Deprecated Systems (Migration Guide)

### usePerformanceMonitor → usePerformanceManager
**Status**: Deprecated, not imported anywhere

**Migration**: No migration needed (file is dead code). If you find usages:
- For debouncing/throttling: Use `createDebounced`/`createThrottled` from usePerformanceManager
- For caching: Use `setCache`/`getCache` from usePerformanceManager
- For memory monitoring: usePerformanceManager has built-in memory monitoring
- FPS/render tracking features were unused and removed

### useTaskSmartGroups → usePowerKeywords
**Status**: Renamed (old path re-exports from new)

**Migration**: Update import path:
```typescript
// Old (still works via re-export)
import { detectPowerKeyword } from '@/composables/useTaskSmartGroups'

// New (preferred)
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
```

### useCanvasSmartGroups → useCanvasOverdueCollector
**Status**: Renamed (old path re-exports from new)

**Migration**: Update import path:
```typescript
// Old (still works via re-export)
import { useCanvasSmartGroups } from '@/composables/canvas/useCanvasSmartGroups'

// New (preferred)
import { useCanvasOverdueCollector } from '@/composables/canvas/useCanvasOverdueCollector'
```

### inputSanitizer.ts → DELETED
**Status**: Removed (enterprise-grade overkill for personal app)

**Migration**: Use `simpleSanitizer.ts` instead if you need sanitization.

### useContextMenuEvents, useContextMenuPositioning → DELETED
**Status**: Removed (consolidated into useContextMenu.ts)

**Migration**: Use `useContextMenu` composable directly.

---

## Adding New Systems

When adding a new system, follow this checklist:

1. **Check if it already exists** - Search codebase first
2. **Choose the right layer** - Utility vs Composable vs Store
3. **Follow naming conventions** - `useXxx` for composables, `xxxUtils` or `xxx` for utilities
4. **Single responsibility** - One system, one purpose
5. **Document in this guide** - Update decision trees above

---

*Last updated: TASK-144 System Consolidation Audit*
