# System Consolidation Audit: One Lean System for Every Aspect

## Overview

Comprehensive audit and consolidation plan to eliminate duplicate, redundant, and competing systems across the Pomo-Flow codebase. Goal: **ONE lean system for every aspect without collisions.**

---

## Problem Statement

The codebase has evolved organically, resulting in multiple implementations doing the same thing, confusing naming, and competing systems that may conflict. This creates:

- **Developer confusion**: Which system should I use?
- **Maintenance burden**: Changes need to be made in multiple places
- **Potential bugs**: Systems may produce inconsistent results
- **Performance waste**: Duplicate code increases bundle size and memory usage

---

## Identified Systems Requiring Consolidation

### Category A: HIGH PRIORITY (Clear Duplicates - Remove)

#### 1. Context Menu Systems
| File | Purpose | Decision |
|------|---------|----------|
| `src/composables/useContextMenu.ts` | Unified context menu | **KEEP - Primary** |
| `src/composables/useContextMenuEvents.ts` | Click-outside detection | **REMOVE** (consolidated) |
| `src/composables/useContextMenuPositioning.ts` | Viewport positioning | **REMOVE** (consolidated) |

**Evidence**: `useContextMenu.ts` line 7-10 explicitly states consolidation occurred.
**Action**: Delete old files, update any remaining imports.

---

#### 2. Containment Detection Logic
| File | Lines | Purpose | Decision |
|------|-------|---------|----------|
| `src/composables/canvas/useCanvasGroupMembership.ts` | 22-57 | Point-in-rect for inbox filtering | **EXTRACT to shared util** |
| `src/composables/canvas/useCanvasDragDrop.ts` | 66-93 | Inline containment calculation | **IMPORT from shared util** |

**Issue**: Two separate implementations of identical geometric logic.
**Action**: Create `src/utils/geometry.ts` with `isPointInRect()`, both systems import it.

---

#### 3. Duration Filtering Logic
| File | Lines | Duration Categories | Decision |
|------|-------|---------------------|----------|
| `src/composables/tasks/useTaskFiltering.ts` | (implicit) | Via useSmartViews | **SOURCE OF TRUTH** |
| `src/composables/useInboxFiltering.ts` | 145-158 | quick ≤15, short 15-30, medium 30-60, long >60 | **IMPORT from useSmartViews** |
| `src/composables/useSmartViews.ts` | (explicit) | Same categories | **KEEP - Primary definition** |

**Issue**: Duration categories defined in 3 places.
**Action**: `useSmartViews.ts` owns duration definitions. Other systems import from there.

---

### Category B: MEDIUM PRIORITY (Merge or Clarify)

#### 4. Performance Monitoring Systems

| File | Lines | Features | Decision |
|------|-------|----------|----------|
| `src/composables/usePerformanceMonitor.ts` | 365 | FPS, memory, render time, scoring | **DEPRECATE** |
| `src/composables/usePerformanceManager.ts` | 403 | Debouncing, memoization, cache, RAF | **KEEP - Primary** |

**Overlap**: Both track `memoryUsage`, both have `PerformanceMetrics` interfaces.

**Action**:
1. Move unique features from Monitor to Manager (FPS tracking, scoring)
2. Add deprecation warning to usePerformanceMonitor
3. Create migration guide

---

#### 5. Virtual Scrolling Systems

| File | Lines | Implementation | Decision |
|------|-------|----------------|----------|
| `src/composables/useVirtualScrolling.ts` | ~300 | VueUse-based | **KEEP - General use** |
| `src/composables/useCanvasVirtualization.ts` | ~550 | Custom with LOD, node pooling | **KEEP - Canvas-specific** |

**Analysis**: Canvas has unique needs (LOD rendering, node pooling) that VueUse doesn't address.

**Decision**: **COEXIST** - Different legitimate use cases.

**Action**: Document when to use which:
- List virtualization (Board, Calendar) → `useVirtualScrolling`
- Canvas node virtualization → `useCanvasVirtualization`

---

#### 6. Smart Groups vs Smart Views (Naming Confusion)

| File | Concept | Purpose | Rename To |
|------|---------|---------|-----------|
| `src/composables/useSmartViews.ts` | SmartView | Sidebar filtering (today, week, etc.) | Keep as-is |
| `src/composables/useTaskSmartGroups.ts` | SmartGroup | Power keyword detection | `usePowerKeywords.ts` |
| `src/composables/canvas/useCanvasSmartGroups.ts` | Canvas automation | Overdue task collection | `useCanvasOverdueCollector.ts` |

**Issue**: "Smart Groups" and "Smart Views" sound similar but are different concepts.

**Action**: Rename for clarity to eliminate confusion.

---

#### 7. Sanitization Systems

| File | Lines | Purpose | Decision |
|------|-------|---------|----------|
| `src/utils/simpleSanitizer.ts` | 133 | Basic XSS protection for personal app | **KEEP - Primary** |
| `src/utils/inputSanitizer.ts` | 333+ | Enterprise-grade sanitization | **REMOVE** (overkill) |

**Rationale**: Per CLAUDE.md, this is a personal productivity app targeting 10-100 users. Enterprise-grade sanitization is unnecessary complexity.

**Action**: Verify no critical imports, then remove `inputSanitizer.ts`.

---

### Category C: LOW PRIORITY (Already Correct or Minor Cleanup)

#### 8. Undo/Redo Systems
| File | Status |
|------|--------|
| `src/composables/undoSingleton.ts` | **CORRECT** - Singleton pattern |
| `src/composables/useUnifiedUndoRedo.ts` | **CORRECT** - Thin wrapper |

**Status**: Already properly consolidated. No action needed.

---

#### 9. Logger Systems
| File | Purpose | Decision |
|------|---------|----------|
| `src/utils/logger.ts` | Development logging | **KEEP** |
| `src/utils/productionLogger.ts` | Production monitoring | **KEEP** |

**Status**: Different purposes (dev vs prod). **COEXIST** is correct.

---

#### 10. Error Handling Systems
| File | Purpose | Decision |
|------|---------|----------|
| `src/utils/errorHandler.ts` | Global singleton | **KEEP** |
| `src/composables/useErrorHandler.ts` | Vue composable wrapper | **KEEP** |

**Status**: Correct util + composable pattern. No action needed.

---

#### 11. Cross-Tab Sync Systems
| File | Purpose | Decision |
|------|---------|----------|
| `src/composables/useCrossTabSync.ts` | Infrastructure | **KEEP** |
| `src/composables/useCrossTabSyncIntegration.ts` | Pinia integration | **KEEP** |

**Status**: Correct separation of concerns. No action needed.

---

#### 12. Task Core Store
| File | Purpose | Decision |
|------|---------|----------|
| `src/stores/tasks.ts` | Main composed store (256 imports) | **KEEP - Primary** |
| `src/stores/taskCore.ts` | Simple CRUD with debug logging | **EVALUATE** |

**Action**: Check if `taskCore.ts` is used. If only internal to `tasks.ts`, consider merging. Remove debug console.trace calls regardless.

---

### Category D: LEGITIMATE SPECIALIZATION (Keep Separate)

#### 13. View-Specific Drag-Drop Composables

| File | View | Decision |
|------|------|----------|
| `src/composables/useDragAndDrop.ts` | Global state | **KEEP** |
| `src/composables/canvas/useCanvasDragDrop.ts` | Canvas (parent-child, multi-select) | **KEEP** |
| `src/composables/calendar/useCalendarDrag.ts` | Calendar (ghost preview) | **KEEP** |
| `src/composables/useInboxDrag.ts` | Inbox (simple) | **KEEP** |

**Rationale**: Each view has legitimately different drag-drop requirements. This is specialization, not duplication.

**Action**: Extract any SHARED patterns to `useDragAndDrop.ts`. View-specific composables use it as base.

---

#### 14. View-Specific Filtering

| File | View | Decision |
|------|------|----------|
| `src/composables/tasks/useTaskFiltering.ts` | Source of truth | **KEEP - Primary** |
| `src/composables/canvas/useCanvasFiltering.ts` | Canvas wrapper | **KEEP** (uses useTaskFiltering) |
| `src/composables/useInboxFiltering.ts` | Inbox-specific | **KEEP** (different UX needs) |
| `src/composables/documentFilters.ts` | CouchDB sync | **KEEP** (different purpose) |

**Rationale**: Filtering hierarchy is acceptable IF all derive from `useTaskFiltering`.

**Action**: Ensure all view-specific filters import from `useTaskFiltering` or `useSmartViews` for shared logic.

---

## Architectural Principles for Consolidation

### Single Source of Truth Hierarchy

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
│  utils/geometry.ts      │  utils/sanitization.ts            │
│  - isPointInRect()      │  - sanitizeInput()                │
│  - calculateBounds()    │  - sanitizeHTML()                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 CORE COMPOSABLES                            │
│  (Shared Logic - Used by All Views)                         │
├─────────────────────────────────────────────────────────────┤
│  useTaskFiltering       │  useSmartViews       │  useDragAndDrop │
│  SOURCE OF TRUTH        │  Duration categories │  Shared state   │
│  for filtering          │  Date predicates     │                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               VIEW-SPECIFIC COMPOSABLES                     │
│   (Wrappers/Extensions - MUST Derive from Core)             │
├─────────────────────────────────────────────────────────────┤
│  useCanvasFiltering     │  useCanvasDragDrop   │  useCalendarDrag │
│  Extends useTaskFiltering│ Extends useDragAndDrop│ Extends useDragAndDrop │
└─────────────────────────────────────────────────────────────┘
```

### Decision Tree for Developers

```
Need to add filtering logic?
├─ Global/Sidebar filter → useSmartViews
├─ View-specific enhancement → view composable that wraps useTaskFiltering
└─ New filter type → Add to useSmartViews, then import in view composables

Need drag-drop functionality?
├─ Global state → useDragAndDrop
├─ View-specific behavior → Create view composable that uses useDragAndDrop
└─ Shared calculation → Add to utils/

Need sanitization?
└─ Use simpleSanitizer.ts (single source)

Need performance monitoring?
└─ Use usePerformanceManager (single source)

Need containment detection?
└─ Import from utils/geometry.ts (single source)
```

---

## Implementation Phases

### Phase 1: Zero-Risk Cleanup

**Files to Delete** (already consolidated, no imports):
- [ ] `src/composables/useContextMenuEvents.ts`
- [ ] `src/composables/useContextMenuPositioning.ts`

**Verification Step**: `grep -r "useContextMenuEvents\|useContextMenuPositioning" src/`

---

### Phase 2: Utility Extraction

**Create**: `src/utils/geometry.ts`
```typescript
// Extracted from useCanvasGroupMembership.ts
export function isPointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

export function findSmallestContainingRect<T extends { x: number; y: number; width: number; height: number }>(
  x: number,
  y: number,
  rects: T[]
): T | null {
  const containing = rects.filter(rect => isPointInRect(x, y, rect))
  if (containing.length === 0) return null

  return containing.reduce((smallest, current) => {
    const smallestArea = smallest.width * smallest.height
    const currentArea = current.width * current.height
    return currentArea < smallestArea ? current : smallest
  })
}
```

**Update**:
- [ ] `useCanvasGroupMembership.ts` - Import from geometry utils
- [ ] `useCanvasDragDrop.ts` - Import from geometry utils

---

### Phase 3: Duration Category Consolidation

**Update**: `src/composables/useInboxFiltering.ts`
```typescript
// BEFORE: Inline duration logic
const durationCategories = {
  quick: (d: number) => d <= 15,
  short: (d: number) => d > 15 && d <= 30,
  // ...
}

// AFTER: Import from useSmartViews
import { DURATION_CATEGORIES } from './useSmartViews'
```

---

### Phase 4: Rename for Clarity

| Old Name | New Name | Reason |
|----------|----------|--------|
| `useTaskSmartGroups.ts` | `usePowerKeywords.ts` | Avoid SmartView/SmartGroup confusion |
| `useCanvasSmartGroups.ts` | `useCanvasOverdueCollector.ts` | Clarify actual purpose |

---

### Phase 5: Deprecation Warnings

**Add to**: `src/composables/usePerformanceMonitor.ts`
```typescript
export function usePerformanceMonitor() {
  if (import.meta.env.DEV) {
    console.warn(
      '[DEPRECATED] usePerformanceMonitor is deprecated. ' +
      'Use usePerformanceManager instead. ' +
      'This file will be removed in a future release.'
    )
  }
  // ... existing implementation
}
```

---

### Phase 6: Sanitization Cleanup

**Verify no critical usage**:
```bash
grep -r "inputSanitizer" src/
```

**If safe**: Delete `src/utils/inputSanitizer.ts`

---

### Phase 7: Documentation

**Create**: `docs/architecture/system-guide.md`
- System selection decision tree
- Composable hierarchy diagram
- Migration guide for deprecated systems

---

## Acceptance Criteria

### Functional Requirements

- [ ] **FR-1**: All filtering derives from `useTaskFiltering` or `useSmartViews`
- [ ] **FR-2**: Single containment detection implementation in `utils/geometry.ts`
- [ ] **FR-3**: One sanitization system (`simpleSanitizer.ts`)
- [ ] **FR-4**: One performance system (`usePerformanceManager.ts`)
- [ ] **FR-5**: Clear naming (no SmartView/SmartGroup confusion)

### Non-Functional Requirements

- [ ] **NFR-1**: Bundle size reduced by at least 5KB
- [ ] **NFR-2**: No behavioral changes from user perspective
- [ ] **NFR-3**: All existing tests pass
- [ ] **NFR-4**: No TypeScript errors

### Documentation Requirements

- [ ] **DR-1**: System selection guide created
- [ ] **DR-2**: Migration notes for deprecated systems
- [ ] **DR-3**: Architecture diagram updated

---

## Testing Strategy

### Before Each Phase
1. Run full test suite: `npm run test`
2. Build verification: `npm run build`
3. Visual verification: Manual check of affected views

### Regression Checklist
- [ ] Canvas drag-drop works with groups
- [ ] Inbox filtering by project/time works
- [ ] Smart views (Today, This Week) show correct tasks
- [ ] Calendar drag creates events correctly
- [ ] Board column drag-drop works
- [ ] Context menus open in correct positions
- [ ] Performance monitoring shows metrics

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Break existing filters | Medium | High | Phase by phase, test after each |
| Performance regression | Low | High | Benchmark before/after |
| Import errors after file moves | High | Low | TypeScript will catch |
| Developer confusion during transition | Medium | Medium | Clear deprecation warnings |

---

## Success Metrics

After consolidation:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Duplicate systems | 0 | Code audit |
| Clear "which to use" | 100% | Developer survey |
| Bundle size reduction | ≥5KB | Build output comparison |
| Test coverage | Maintained | Coverage report |
| TypeScript errors | 0 | Build verification |

---

## References

### Internal Files (Primary Sources)
- `src/composables/useContextMenu.ts:7-10` - Consolidation evidence
- `src/composables/canvas/useCanvasGroupMembership.ts:22-57` - Containment logic
- `src/composables/canvas/useCanvasDragDrop.ts:66-93` - Duplicate containment
- `src/composables/useInboxFiltering.ts:145-158` - Duration definitions
- `src/composables/useSmartViews.ts` - Duration source of truth
- `src/composables/usePerformanceMonitor.ts` - To deprecate
- `src/composables/usePerformanceManager.ts` - To keep

### Best Practices Sources
- Vue.js Official Composables Guide
- Pinia Store Composition Documentation
- Strangler Fig Pattern (Microsoft Azure Architecture)
- Branch-by-Abstraction Pattern (Martin Fowler)

---

## Appendix: Full System Inventory

| # | Category | System | File | Decision |
|---|----------|--------|------|----------|
| 1 | Context Menu | Unified | useContextMenu.ts | KEEP |
| 2 | Context Menu | Events | useContextMenuEvents.ts | DELETE |
| 3 | Context Menu | Positioning | useContextMenuPositioning.ts | DELETE |
| 4 | Containment | Group Membership | useCanvasGroupMembership.ts | EXTRACT |
| 5 | Containment | Drag-Drop | useCanvasDragDrop.ts | IMPORT |
| 6 | Duration | Smart Views | useSmartViews.ts | KEEP (source) |
| 7 | Duration | Inbox | useInboxFiltering.ts | IMPORT |
| 8 | Duration | Task Filtering | useTaskFiltering.ts | IMPORT |
| 9 | Performance | Monitor | usePerformanceMonitor.ts | DEPRECATE |
| 10 | Performance | Manager | usePerformanceManager.ts | KEEP |
| 11 | Virtual Scroll | General | useVirtualScrolling.ts | KEEP |
| 12 | Virtual Scroll | Canvas | useCanvasVirtualization.ts | KEEP (specialized) |
| 13 | Smart Groups | Task Smart Groups | useTaskSmartGroups.ts | RENAME |
| 14 | Smart Groups | Canvas Smart Groups | useCanvasSmartGroups.ts | RENAME |
| 15 | Sanitization | Simple | simpleSanitizer.ts | KEEP |
| 16 | Sanitization | Enterprise | inputSanitizer.ts | DELETE |
| 17 | Undo/Redo | Singleton | undoSingleton.ts | KEEP |
| 18 | Undo/Redo | Unified | useUnifiedUndoRedo.ts | KEEP |
| 19 | Logging | Dev | logger.ts | KEEP |
| 20 | Logging | Prod | productionLogger.ts | KEEP |
| 21 | Error | Handler | errorHandler.ts | KEEP |
| 22 | Error | Composable | useErrorHandler.ts | KEEP |
| 23 | Cross-Tab | Core | useCrossTabSync.ts | KEEP |
| 24 | Cross-Tab | Integration | useCrossTabSyncIntegration.ts | KEEP |
| 25 | Task Store | Main | tasks.ts | KEEP |
| 26 | Task Store | Core | taskCore.ts | EVALUATE |
| 27 | Drag-Drop | Global | useDragAndDrop.ts | KEEP |
| 28 | Drag-Drop | Canvas | useCanvasDragDrop.ts | KEEP |
| 29 | Drag-Drop | Calendar | useCalendarDrag.ts | KEEP |
| 30 | Drag-Drop | Inbox | useInboxDrag.ts | KEEP |
| 31 | Filtering | Task | useTaskFiltering.ts | KEEP (source) |
| 32 | Filtering | Canvas | useCanvasFiltering.ts | KEEP |
| 33 | Filtering | Inbox | useInboxFiltering.ts | KEEP |
| 34 | Filtering | Document | documentFilters.ts | KEEP |

**Summary**:
- **DELETE**: 4 files
- **DEPRECATE**: 1 file
- **RENAME**: 2 files
- **EXTRACT**: 1 new utility file
- **KEEP**: 26 files (some need import updates)
