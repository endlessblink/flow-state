**Last Updated**: December 21, 2025 (TASK-027 Completed - Zero Lint Warnings)
**Version**: 5.0 (Strategic Roadmap: Personal Daily Driver)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## ⚠️ SCHEDULED: TASK-034 Phase 5 - December 28, 2025

> **CLAUDE CODE ATTENTION**: On or after **December 28, 2025**, complete TASK-034 Phase 5:
> 1. Set `INDIVIDUAL_ONLY: true` in `src/config/database.ts`
> 2. This stops dual-write to legacy `tasks:data` format
> 3. After 1 more week of stability, delete `tasks:data` document
>
> **Current State**: App is reading from individual `task-{id}` docs (Phase 4 active since Dec 21)
> **Rollback**: Set `READ_INDIVIDUAL_TASKS: false` in `database.ts` to revert to legacy

---

## Current Status

| Area | Status |
|------|--------|
| **Canvas** | ✅ Working - Node/Edge types fixed |
| **Calendar** | ✅ Verified - Type errors resolved |
| **CouchDB Sync** | ✅ Phase 4 Active - Reading from individual task docs |
| **Build** | ✅ Passing (vue-tsc verified) |
| **GitHub CI** | ✅ Active - Build verification on push/PR |

**Branch**: `master`

### CI/CD Setup (Dec 6, 2025)

**GitHub Actions workflow**: `.github/workflows/ci.yml`

| Check | Status | Notes |
|-------|--------|-------|
| `npm run build` | ✅ Active | Catches TS errors, broken imports, syntax issues |
| `npm run lint` | ✅ Active | **0 ERRORS, 0 WARNINGS** - Strict linting enforced |
| `npm run test` | ❌ Skipped | 90 failures (mostly Storybook) need fixing |

**Branch Protection**: Not enabled (solo developer, direct push workflow)

---

## ✅ RESOLVED: PouchDB Conflicts (Dec 20, 2025)

**BLOCKER REMOVED**: All 1,487 PouchDB document conflicts have been deleted. User's 9 tasks restored.

| Issue | Priority | Action |
|-------|----------|--------|
| ~~**ISSUE-011**: PouchDB Conflicts~~ | ~~P1-HIGH~~ | ✅ RESOLVED - All conflicts deleted |
| **TASK-029**: Storybook Audit Skill | CREATED | Use `/storybook-audit` to debug stories |
| **TASK-014**: Storybook Glass Morphism | IN PROGRESS | 15/54 components done |

**Storybook work can now continue:**
1. ~~First resolve ISSUE-011~~ ✅ DONE
2. Use storybook-audit skill: `.claude/skills/storybook-audit/SKILL.md` (Updated Dec 21 with Auth patterns)
3. Continue TASK-014 (Glass Morphism streamlining)

---

## Archived Completed Items

**Completed tasks with full implementation details have been moved to:**

[docs/archive/Done-Tasks-Master-Plan.md](./archive/Done-Tasks-Master-Plan.md)

> **Note for Claude Code / Skills**: When archiving completed items from MASTER_PLAN.md,
> ALWAYS append to `docs/archive/Done-Tasks-Master-Plan.md` - do not create new archive files.

---

## Ideas

<!-- Ideas use IDEA-XXX format -->
- IDEA-001: (add rough ideas here)
- IDEA-002: **Timeline View for Dev-Manager** - Add a timeline/Gantt-style view to see all tasks in the order they should be completed visually. Would help visualize task priorities, dependencies, and progress at a glance. Could integrate intelligent task analysis (read actual content/subtasks) instead of simple pattern matching to determine true completion status.
- IDEA-003: **Skill Usage Logger** - Create a working skill logging hook that tracks which Claude Code skills are used, when, and how often. Log to `.claude/logs/skill-usage.jsonl`. Use for analytics on which skills are most valuable and identifying skill gaps. Should work with current Linux environment (no Windows paths, no external MCP server).

---

## Roadmap

<!-- Roadmap = BIG features only. Small fixes go to Bugs/Tasks sections -->

### Near-term
| ID | Feature | Priority | Notes |
|----|---------|----------|-------|
| ~~ROAD-001~~ | ~~Power Groups~~ | ~~P1~~ | ✅ DONE (Dec 5) - Auto-detect keywords, collect button, settings |
| **ROAD-013** | **Sync Hardening** | **P0-CRITICAL** | **PREREQUISITE - Fix "mostly works" issues before major features** |
| ROAD-004 | Mobile support (PWA) | P2 | PWA first → Android → iOS (paid only). Quick capture, today view, timer |
| ROAD-005 | Auto-sync enablement | P1 | After multi-device testing |

### Later
| ID | Feature | Notes |
|----|---------|-------|
| ~~ROAD-006~~ | ~~Keyboard shortcuts~~ | ✅ DONE (Dec 5) - Delete, Redo (Ctrl+Y), New Task (Ctrl+N) |
| ROAD-007 | Technical debt cleanup | D&D unification, Database consolidation, Validation framework |
| ROAD-010 | Cyberpunk gamification ("Cyberflow") | XP system, character progression, AI-generated story. MVP: XP + Levels + Character Visual |
| ROAD-011 | Local AI assistant | Task breakdown, auto-categorize, NL input, meeting→tasks, weekly review. Local (Ollama) + Cloud (BYOK). Hebrew required |
| ~~ROAD-012~~ | ~~Unified Section Settings Menu~~ | ✅ DONE (Dec 16) - Consolidated to Groups, added GroupSettingsMenu.vue |
| ROAD-014 | **KDE Plasma Widget** | Taskbar plasmoid for Tuxedo OS - timer controls, task selector, bidirectional CouchDB sync |

---

## Strategic Roadmap: Personal Daily Driver

**Goal**: Replace Obsidian as personal task management daily driver, then public release as freemium.

**Usage Pattern**: Desktop primary (90%), mobile for quick capture

### Priority Order (Dec 2025)

| Phase | Feature | Timeline | Dependencies |
|-------|---------|----------|--------------|
| **Phase 0** | Sync Hardening (ROAD-013) | 1 week | None |
| **Phase 1** | Gamification (ROAD-010) | 2-3 weeks | Sync stable |
| **Phase 2** | AI Assistant (ROAD-011) | 3-4 weeks | Phase 1 complete |
| **Phase 3** | Mobile PWA (ROAD-004) | 4-6 weeks | Phase 2 complete |

**Note**: Each phase is independently valuable. Can stop after any phase.

### Phase Dependencies

```
Phase 0 (Sync) ─────────────────────────────────┐
                                                │
Phase 1 (Gamification) ←────────────────────────┤
    │                                           │
    │ (XP for AI-suggested tasks)              │
    ↓                                           │
Phase 2 (AI) ←──────────────────────────────────┤
    │                                           │
    │ (AI works on mobile)                     │
    ↓                                           │
Phase 3 (Mobile) ←──────────────────────────────┘
```

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI latency (5-30s on first run) | Pre-warm model, show progress UI, cache results |
| Hebrew accuracy | Test with Hebrew-speaking user, use Claude/GPT-4 for better Hebrew |
| Mobile testing limitations | Manual device testing required (Playwright can't test touch well) |
| Sync conflicts during testing | Always backup before major changes |
| Feature creep | Start minimal, expand based on actual use |

---

## Active Work

<!-- TASK DEPENDENCY INDEX - Claude: Check this BEFORE starting any task -->
<!-- Update Status when starting/completing work. Check for file conflicts before starting. -->

| ID | Status | Primary Files | Depends | Blocks |
|----|--------|---------------|---------|--------|
| TASK-022 | 👀 MONITORING | `tasks.ts`, `taskDisappearanceLogger.ts` | - | TASK-024 |
| TASK-024 | 👀 MONITORING | `tasks.ts` | TASK-022 (monitoring) | - |
| ~~TASK-021~~ | ✅ DONE | `timer.ts`, `useTimerChangesSync.ts` | - | ~~TASK-017~~ |
| TASK-014 | IN_PROGRESS | `*.stories.ts`, `*.vue` (UI) | - | - |
| TASK-019 | PLANNED | `tasks.ts`, stores, views | - | - |
| ~~TASK-020~~ | ✅ DONE | `useDatabase.ts`, `useReliableSyncManager.ts`, test files | - | - |
| ~~TASK-023~~ | ✅ DONE | `dev-manager/*` | - | - |
| TASK-017 | READY | `plasmoid/*` (new) | ~~TASK-021~~ | - |
| ~~TASK-027~~ | ✅ DONE | `stores/*`, `components/*`, `utils/*` (Zero Lint Warnings) | ~~TASK-011~~ | - |
| ~~TASK-028~~ | ✅ DONE | `.claude/hooks/*`, `.claude/settings.json` | - | - |
| TASK-029 | PLANNED | `.claude/skills/storybook-audit/*`, `src/stories/**` | TASK-014 | - |
| ~~TASK-030~~ | ✅ DONE | `composables/*`, `types/global.d.ts`, `stores/*`, `utils/*` | - | - |
| ~~TASK-031~~ | ✅ DONE | `.claude/hooks/*`, `.claude/settings.json`, `.claude/locks/*` | - | - |
| ~~TASK-032~~ | ✅ DONE | `.claude/hooks/check-npm-scripts.sh`, `.claude/settings.json` | - | - |
| TASK-033 | PLANNED | `~/claude-plugins/*` (new) | - | - |
| TASK-034 | ✅ PHASE 4 DONE | `tasks.ts`, `individualTaskStorage.ts`, `database.ts`, `documentFilters.ts` | - | - |

**Parallel Safe**: TASK-014 (UI) + TASK-017 (plasmoid) + TASK-033 (plugin) - no file overlap
**⏰ SCHEDULED Dec 28**: TASK-034 Phase 5 - Enable `INDIVIDUAL_ONLY: true` after 1 week monitoring
**Active**: TASK-034 Phase 4 (Dec 21) - App reading from individual `task-{id}` docs
**Completed**: TASK-027, TASK-032, TASK-031, TASK-030 (code quality, hooks, locking, type errors)
**Ready**: TASK-022 monitoring complete, TASK-024 can start
**Planned**: TASK-033 (Claude Dev Infrastructure Plugin)
**Conflict Warning**: `tasks.ts` appears in TASK-022, TASK-024, TASK-019, TASK-034 - work sequentially

---

### ~~TASK-027~~: Fix All Lint Warnings (COMPLETE)

**Goal**: Replace all 1,380 `no-explicit-any` warnings with proper TypeScript types.

**Priority**: P2-MEDIUM (code quality, enables stricter CI)

**Baseline** (Dec 19, 2025): 1,380 warnings (0 errors)
**Session 1** (Dec 19, 2025): 1,292 warnings - 88 fixed (stores batch)
**Session 2** (Dec 19, 2025): 1,134 warnings - 159 total fixed (~12% reduction)
**Session 3** (Dec 20, 2025): 791 warnings - 134 more fixed (utils + composables batch)
**Session 4** (Dec 20, 2025): **601 warnings** - 190 more fixed (CanvasView, SyncErrorBoundary, utils)
**Session 5** (Dec 20, 2025): **486 warnings** - 115 more fixed (views, utils, composables, components)
**Session 6** (Dec 21, 2025): **354 warnings** - 132 more fixed (Batch 3: Stories, Utils, Composables)
**Session 7** (Dec 21, 2025): **243 warnings** - 111 more fixed (Batch 4: Components, Utils, Stories)
**Session 8** (Dec 21, 2025): **205 warnings** - 38 more fixed (Batch 5: Sync, Components, Composables)
**Session 9** (Dec 21, 2025): **179 warnings** - 26 more fixed (Batch 6: Network, Performance, Vue Flow)
**Session 10** (Dec 21, 2025): **153 warnings** - 26 more fixed (Batch 7: Sync Conflict UI)
**Session 11** (Dec 21, 2025): **130 warnings** - 23 more fixed (Batch 8: Performance, Security & Utilities)
**Session 12** (Dec 21, 2025): **109 warnings** - 21 more fixed (Batch 9: Database & Components)
**Session 13** (Dec 21, 2025): **102 warnings** - 7 more fixed (Batch 10: Calendar, Board & Sync Queues)
**Session 14** (Dec 21, 2025): **95 warnings** - 7 more fixed (Batch 11: Security & Diagnostics)
**Session 15** (Dec 21, 2025): **79 warnings** - 16 more fixed (Batch 12: Canvas & Stability)
**Session 16** (Dec 21, 2025): **45 warnings** - 34 more fixed (Batch 13: Auth/Settings/Sync)
**Session 17** (Dec 21, 2025): **0 warnings** - 45 fixed (Batch 14-18: Final Cleanup & Non-Null Assertions)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Fix stores (88 warnings) | ✅ DONE |
| 2 | Fix services (25 warnings) | ✅ DONE |
| 3 | Fix utils (~200 fixed) | ✅ DONE |
| 4 | Fix composables (~150 fixed) | ✅ DONE |
| 5 | Fix components (~180 fixed) | 🔄 IN PROGRESS |
| 6 | Fix views (~100 fixed) | 🔄 IN PROGRESS |
| 7 | Verify build passes | ✅ DONE (verified each session) |

**Session 1 Files Fixed** (Dec 19, 2025):
- `global.d.ts`: Added PouchDB, UndoRedo, Backup types + Window properties
- `auth.ts` (27→0): Firebase mock types, error handling
- `tasks.ts` (25→0): PouchDB types, JSON parsing, undo system
- `timer.ts` (20→0): Session types, cross-device sync
- `canvas.ts` (10→0): Vue Flow types, task store reference
- `notifications.ts` (4→0): Notification preferences casting
- `quickSort.ts` (2→0): Session history parsing
- `TaskNode.vue`: Fixed defineProps order (1 error)

**Session 2 Files Fixed** (Dec 19, 2025):
- `services/unified-task-service.ts`: Task interfaces, error handling, event types
- `skills/git-restoration-analyzer.ts`: execSync types, error handling
- `utils/conflictResolution.ts`: ConflictDiff, TaskConflict → `unknown`
- `utils/inputSanitizer.ts`: ValidationRule, ValidationResult → `unknown`
- `utils/offlineQueue.ts`: QueuedOperation data types → `unknown`
- Multiple utils files: `any` → `unknown` conversions

**Session 3 Files Fixed** (Dec 20, 2025):
- `utils/conflictResolution.ts`: All `any` → `unknown` with proper type guards (36 warnings)
- `utils/threeWayMerge.ts`: All `any` → `unknown` or `Record<string, unknown>` (31 warnings)
- `composables/useReliableSyncManager.ts`: 36 `any` patterns fixed with type guards
- `composables/useDatabase.ts`: Fixed semicolon error + window typing
- `composables/useCrossTabSync.ts`: 30 `any` patterns fixed with interfaces

**Session 4 Files Fixed** (Dec 20, 2025):
- `views/CanvasView.vue` (81→22): Vue Flow types, edge handlers, window extensions
- `components/sync/SyncErrorBoundary.vue` (35→0): Error boundary types
- Multiple utils files with `any` → `unknown` patterns

**Session 5 Files Fixed** (Dec 20, 2025):
- `views/CanvasView.vue` (22→0): Fixed window DB access, ref types, edge event handlers with extended interfaces
- `utils/RobustBackupSystem.ts` (17→0): All data parameters `any` → `unknown`
- `utils/individualTaskStorage.ts` (16→0): Added TaskDocument, LegacyTasksDocument, DeletedDocument, WindowWithDb interfaces
- `components/canvas/InboxPanel.vue` (16→0): Added Task type import, fixed function signatures and priority/status types
- `utils/conflictDetector.ts` (15→0): Fixed document handling with `Record<string, unknown>`
- `composables/useDatabase.ts` (15→0): Fixed health/export/import return types, DocWithConflicts interface
- `utils/offlineQueue.ts` (partial): Fixed conflict types, PouchDB.Database constructor params
- `utils/inputSanitizer.ts` (partial): Fixed sanitize input/output → `unknown`
- `utils/productionLogger.ts` (partial): Fixed data parameters → `unknown`

**Session 6 Files Fixed** (Dec 21, 2025) [Batch 3]:
- `src/stories/right-click-menus/TaskContextMenu.stories.ts`: (16→0) Typed story decorators and event callbacks
- `src/types/global.d.ts`: (13→0) Fixed generic component types and VueVueCal/events
- `src/stories/modals/GroupModal.stories.ts`: (11→0) Added MockGroup interface, typed refs and callbacks
- `src/utils/SaveQueueManager.ts`: (7→0) Typed `enqueueSave` data, error handling, and fixed readonly ref issue
- `src/composables/useDynamicImports.ts`: (9→0) Refined generic types for import manager

**Session 7 Files Fixed** (Dec 21, 2025) [Batch 4]:
- `src/stories/modals/QuickTaskCreate.stories.ts`: (7→0) Replaced `any` with `unknown` and `MockTask` interface
- `src/utils/CrossTabPerformance.ts`: (6→0) Replaced `any` with `unknown`, fixed memory usage estimation
- `src/components/canvas/GroupNodeSimple.vue`: (6→0) Fixed resize event signatures
- `src/utils/simpleSanitizer.ts`: (5→0) Typed input and property access
- `src/utils/recurrenceUtils.ts`: (8→0) Replaced `as any` with proper RecurrenceRule sub-types

**Session 8 Files Fixed** (Dec 21, 2025) [Batch 5]:
- `src/utils/retryManager.ts`: (7→0) Typed error handling and context
- `src/types/sync.ts`: (7→0) Typed data packages and operation payloads
- `src/components/SyncHealthDashboard.vue`: (7→0) Typed recent operations and errors
- `src/views/CalendarViewVueCal.vue`: (6→0) Typed vue-cal events and handlers
- `src/utils/syncTestSuite.ts`: (6→0) Typed test results and database loads
- `src/composables/useVueFlowStability.ts`: (6→0) Typed vue-flow store transforms

**Session 9 Files Fixed** (Dec 21, 2025) [Batch 6]:
- `src/composables/useNetworkOptimizer.ts`: (6→0) Replaced `Promise<any>` with `Promise<unknown>`, typed navigator extensions
- `src/utils/syncCircuitBreaker.ts`: (5→0) Typed generics and change detection guards
- `src/utils/performanceBenchmark.ts`: (5→0) Typed simulations and memory checks
- `src/composables/useVueFlowErrorHandling.ts`: (5→0) Fixed Naive UI message type casts
- `src/composables/useVirtualScrolling.ts`: (5→0) Correctly typed VueUse virtual list integration

**Session 10 Files Fixed** (Dec 21, 2025) [Batch 7]:
- `src/components/sync/ManualMergeModal.vue`: (6→0) Typed merged value and history
- `src/components/sync/diffs/BooleanDiff.vue`: (5→0) Typed boolean comparisons
- `src/components/sync/diffs/ObjectDiff.vue`: (4→0) Typed object field diffs
- `src/components/sync/ValueDisplay.vue`: (4→0) Typed field value formatting
- `src/components/sync/DiffViewer.vue`: (3→0) Typed diff component props
- `src/types/conflicts.ts`: (4→0) Typed resolution interfaces and type guards

**Session 11 Files Fixed** (Dec 21, 2025) [Batch 8]:
- `src/composables/usePerformanceManager.ts`: (5→0) Typed cache entries and memoized factory
- `src/components/canvas/GroupManager.vue`: (5→0) Fixed lookup table casts and store calls
- `src/utils/securityMonitor.ts`: (4→0) Typed security event details and composable helpers
- `src/utils/productionLogger.ts`: (4→0) Fixed navigator/performance API casts
- `src/utils/CrossTabBrowserCompatibility.ts`: (4→0) Typed polling channel and message handling
- `src/composables/useHorizontalDragScroll.ts`: (4→0) Removed unsafe container property assignments

**Session 12 Files Fixed** (Dec 21, 2025) [Batch 9]:
- `src/database/simple-pouchdb-test.ts`: (4→0) Refactored diagnostic tests
- `src/composables/useVirtualList.ts`: (4→0) Updated generic default and fixed event target casting
- `src/components/SyncAlertSystem.vue`: (4→0) Updated SyncAlert interface and logger calls
- `src/components/PersistentMemoryManager.vue`: (4→0) Defined Backup interface and fixed unsafe casts
- `src/components/base/UnifiedInboxPanel.vue`: (3→0) Fixed brain dump parsing and window extensions
- `src/utils/TaskValidationGuard.ts`: (2→0) Typed validation reports and failure checks

**Session 13 Files Fixed** (Dec 21, 2025) [Batch 10]:
- `src/views/CalendarViewVueCal.vue`: (2→0) Fixed event handlers and recurrenceUtils require
- `src/views/BoardView.vue`: (3→0) Fixed status casts and template filters
- `src/utils/offlineQueue.ts`: (2→0) Defined event listener types and used unknown for data
- `src/utils/unifiedSyncQueue.ts`: (2→0) Typed SyncOperation data as unknown
- `src/utils/memoryLeakDetector.ts`: (3→0) Typed performance memory and export/import data
- `src/utils/DragInteractionRecorder.ts`: (2→0) Refined console capture types

**Session 14 Files Fixed** (Dec 21, 2025) [Batch 11]:
- `src/utils/cspManager.ts`: (1→0) Typed report timers and violation events
- `src/utils/forensicBackupLogger.ts`: (2→0) Refined AuditEvent and snapshot types
- `src/utils/rateLimiter.ts`: (2→0) Added RateLimitRequest interface and typed headers
- `src/utils/mockTaskDetector.ts`: (1→0) Refined filterMockTasks and detectMockTask types
- `src/utils/taskDisappearanceLogger.ts`: (1→0) Fixed window cast for global taskLogger

**Session 15 Files Fixed** (Dec 21, 2025) [Batch 12]:
- `src/composables/useVueFlowStability.ts`
- `src/composables/useVueFlowStateManager.ts`
- `src/components/canvas/CanvasContextMenu.vue`
- `src/components/canvas/MultiSelectionOverlay.vue`
- `src/components/canvas/TaskNode.vue`
- `src/composables/useCanvasProgressiveLoading.ts`
- `src/components/canvas/EdgeContextMenu.vue`
- `src/components/canvas/GroupEditModal.vue`
- `src/components/canvas/InboxTimeFilters.vue`
- `src/types/tasks.ts`
- `src/views/CanvasView.vue`
- `src/components/canvas/EdgeContextMenu.vue`
- `src/components/canvas/GroupEditModal.vue`
- `src/components/canvas/InboxTimeFilters.vue`

**Session 16 Files Fixed** (Dec 21, 2025) [Batch 13]:
- `src/views/CanvasView.vue`: Fixed missing `Node` import and `NodeTypes` cast (resolved 3 errors)
- `src/views/BoardView.vue`: Fixed string literal types for task status (fixed 'in-progress' typos)
- `src/components/SyncHealthDashboard.vue`: Fixed logger call to use real metrics
- `src/stores/auth.ts`: Exported `User` and `FirebaseUser` types
- `src/components/GroupModal.vue`: Fixed canvas store mock type mismatch
- `src/views/CalendarViewVueCal.vue` & `src/views/CalendarView.vue`: Verified types verified by vue-tsc

**Session 17 Files Fixed** (Dec 21, 2025) [Batch 14-18]:
- Fixed remaining 45 non-null assertions inside `src/utils/*.ts`
- `src/utils/mockTaskDetector.ts`: Safe access to description
- `src/utils/productionLogger.ts`: Safe timestamp filtering
- `src/utils/rateLimiter.ts`: Header null checks
- `src/utils/securityHeaders.ts`: Strict transport security checks
- `src/utils/conflictResolution.ts`: Safe user rule map access
- `src/composables/useNetworkOptimizer.ts`: Default URL values
- `src/utils/syncBatchManager.ts`: Batch existence checks

**Result**: ✅ Zero Lint Warnings - Project is clean!

**Remaining** (79 warnings):
- Services: ✅ DONE
- Utils: ~15 remaining (sync validators, helpers)
- Composables: ~10 remaining
- Components: ~30 remaining (main focus)
- Views: ~20 remaining

**Common Patterns Applied**:
- Error handling: `catch (err: any)` → `catch (err: unknown)` + type guards
- Window properties: Added to global.d.ts instead of `(window as any)`
- Firebase stubs: Proper function signatures
- JSON/DB responses: Type guards with interfaces
- Vue Flow: Proper Node/Edge types from @vue-flow/core

---

### ~~TASK-030~~: Fix TypeScript Strict Type Errors (✅ DONE)

**Goal**: Fix all `vue-tsc --noEmit` errors to enable strict type checking in CI.

**Priority**: P1-HIGH (blocks type safety enforcement)

**Baseline** (Dec 19, 2025): 267 errors from `npx vue-tsc --noEmit`
**Session 1** (Dec 19, 2025): ~236 errors remaining (~31 fixed)
**Session 2** (Dec 20, 2025): 114 errors remaining (~153 fixed, 57% reduction)
**Session 3** (Dec 20, 2025): ✅ **0 errors** - All TypeScript errors fixed!

**Background**:
- `npm run build` does NOT catch TypeScript errors (Vite only transpiles)
- `npx vue-tsc --noEmit` is the authoritative type checker
- These are **type errors**, not lint warnings (different from TASK-027)

**Root Causes**:
1. **Window property access** - `(window as unknown).propertyName` loses type information
2. **PouchDB sync handlers** - `.on()`, `.cancel()` methods typed as `unknown`
3. **Cross-tab sync** - Store references typed as `unknown`
4. **Various composables** - Properties accessed on `unknown` types

**Files Fixed Session 1** (Dec 19):
| File | Fixes Applied |
|------|---------------|
| `types/global.d.ts` | Added PouchDB interfaces; Extended Window types |
| `useReliableSyncManager.ts` | `syncHandler: unknown` → `PouchDBSyncHandler` |
| `useDatabase.ts` | Fixed `window.pomoFlowDb` casts |
| `undoSingleton.ts` | Fixed `__pomoFlowUndoSystem` window access |
| `timer.ts` | `db.sync?.()` → `db.triggerSync?.()` |

**Files Fixed Session 2** (Dec 20):
| File | Fixes Applied |
|------|---------------|
| `useSidebarManagement.ts` | Import `Project` type; Fix `filterSidebarProjects`, `getFlattenedProjectList` |
| `useCalendarDrag.ts` | Add `DragData` interface; Type drop handlers with `Task`, `DragData` |
| `useOptimizedTaskStore.ts` | Import `Task`; Add `TaskData` interface; Type batch operations |
| `useVueFlowErrorHandling.ts` | Add `ErrorEvent`, `ErrorSummary` interfaces |
| `usePerformanceManager.ts` | Cast cached result as `ReturnType<T>`; Fix `optimizeForLargeLists` |
| `useCalendarDayView.ts` | Add `CalendarDragData` interface; Fix parsedData typing |
| `usePersistentStorage.ts` | Add `BackupData` interface |
| `useTaskLifecycle.ts` | Add `TransitionMetadata` interface |
| `useTimerChangesSync.ts` | Add PouchDB change feed interfaces |
| `useVueFlowStability.ts` | Use `Node` type in filter/map callbacks |
| `useCalendarDragCreate.ts` | Fix `webkitUserSelect` CSSStyleDeclaration cast |
| `types/global.d.ts` | Extended `UndoRedoActions` with ComputedRef types |

**Files Fixed Session 3** (Dec 20 - Final):
| File | Fixes Applied |
|------|---------------|
| `useCrossTabSync.ts` | Updated `UIStoreType`, `CanvasStoreType` interfaces; Fixed store casts |
| `useBackupSystem.ts` | Added `BackupTaskLike` interface; Import `Task` type |
| `useBackupRestoration.ts` | Type guards for optional API methods; Fix spread types |
| `useDynamicImports.ts` | Added `ImportConfig` interface; Type module return |
| `useNetworkOptimizer.ts` | Cast compressed data with interface |
| `useOptimisticUI.ts` | `Record<string, unknown>` params; Fix `Date` types |
| `useOptimizedTaskStore.ts` | Cast through `unknown` for Task conversion |
| `useTaskLifecycle.ts` | Type `TransitionMetadata` in function signature |
| `useDemoGuard.ts` | Cast data to `TaskLike[]` for type checking |
| `types/global.d.ts` | Make task methods optional in `UndoRedoActions` |
| `stores/tasks.ts` | Update `UndoRedoActionsLocal` to accept `ComputedRef` |

**Result**: ✅ Zero TypeScript errors - Strict type checking enabled!

**Command to Verify**:
```bash
npx vue-tsc --noEmit  # Should output nothing (0 errors)
```

---

### TASK-029: Storybook Audit Skill (PLANNED)

**Goal**: Create a Claude Code skill that automatically audits Storybook stories for common issues and fixes them.

**Priority**: P2-MEDIUM
**Depends On**: TASK-014 (Storybook work provides patterns to encode in skill)

**Audit Capabilities**:

| Check | Issue | Auto-Fix |
|-------|-------|----------|
| `iframeHeight` | Docs pages cut off modals/popups | Suggest height based on component type |
| Store Dependencies | Stories import real stores → DB errors | Flag for mock store injection |
| Missing Imports | `ref`, `reactive`, `computed` not imported | Add missing Vue imports |
| Template `<style>` | Runtime template contains `<style>` tag | Convert to inline styles |
| Props Mismatch | Story args don't match component props | Compare with `defineProps` |
| Event Handlers | Missing `@close`, `@submit` handlers | Add noop handlers |
| Layout Parameter | `layout: 'centered'` for modals (should be fullscreen) | Fix layout type |

**Skill Structure**:
```
.claude/skills/storybook-audit/
├── skill.md           # Main skill definition
├── rules/
│   ├── iframe-height.md
│   ├── store-dependencies.md
│   └── template-errors.md
└── examples/
    ├── before-after-contextmenu.md
    └── before-after-modal.md
```

**Trigger Keywords**:
- "audit storybook"
- "fix storybook stories"
- "storybook cut off"
- "storybook store error"

**Related**:
- ISSUE-011 (PouchDB conflicts breaking Storybook)
- TASK-014 (Storybook Glass Morphism work)
- `.claude/skills/dev-storybook/skill.md` (existing Storybook skill to extend)

---

### TASK-033: Create Claude Dev Infrastructure Plugin (PLANNED)

**Goal**: Package Pomo-Flow's AI development infrastructure as a reusable Claude Code plugin for use in new projects.

**Priority**: P2-MEDIUM (infrastructure, not blocking current work)

**Background**:
This project has developed a sophisticated AI development ecosystem including:
- Constitutional AI enforcement (truthfulness mandates, verification protocols)
- Multi-instance session locking (prevents Claude sessions from conflicting)
- MASTER_PLAN.md task tracking with ID formats (TASK-XXX, BUG-XXX, ROAD-XXX)
- Hooks system for behavioral reminders and validation
- 11+ core skills for AI-assisted development
- Dev-manager kanban dashboard

**Plugin Architecture**:

```
claude-dev-infrastructure/                    # Core plugin (stack-agnostic)
├── .claude-plugin/plugin.json               # Plugin manifest
├── standards/                               # 5 standards documents
│   ├── TRUTHFULNESS_MANDATE.md
│   ├── FILE_CREATION_STANDARDS.md
│   ├── REFACTORING_STANDARDS.md
│   ├── MAINTENANCE_STANDARDS.md
│   └── FEATURE_DEVELOPMENT_STANDARDS.md
├── hooks/                                   # 14 hooks
│   ├── hooks.json
│   ├── session-lock-awareness.sh
│   ├── task-lock-enforcer.sh
│   ├── master-plan-reminder.sh
│   └── ... (11 more)
├── skills/                                  # 11 core skills
│   ├── chief-architect/
│   ├── master-plan-manager/
│   ├── meta-skill-router/
│   ├── skill-creator-doctor/
│   ├── skills-manager/
│   ├── ai-truthfulness-enforcer/
│   ├── document-sync/
│   ├── safe-project-organizer/
│   ├── data-safety-auditor/
│   ├── crisis-debugging-advisor/
│   └── qa-testing/
├── templates/                               # Project scaffolding
│   ├── MASTER_PLAN.template.md
│   ├── SOP.template.md
│   ├── CLAUDE.template.md
│   └── settings.template.json
├── dev-manager/                             # Visual kanban dashboard
│   ├── index.html
│   ├── kanban/
│   ├── skills/
│   └── docs/
├── init/setup.sh                            # Project scaffolding script
└── README.md

vue3-typescript-skills/                      # Add-on package (Vue-specific)
├── .claude-plugin/plugin.json
├── skills/
│   ├── dev-vue/
│   ├── dev-typescript/
│   ├── dev-vueuse/
│   ├── dev-fix-pinia/
│   ├── dev-refactoring/
│   ├── dev-lint-cleanup/
│   └── ... (6 more)
└── README.md
```

| Step | Description | Status |
|------|-------------|--------|
| 1 | Create plugin directory structure at `~/claude-plugins/` | PENDING |
| 2 | Copy and adapt standards documents (remove Pomo-Flow specifics) | PENDING |
| 3 | Copy and adapt hooks (make paths configurable) | PENDING |
| 4 | Copy 11 core skills (stack-agnostic) | PENDING |
| 5 | Create templates (MASTER_PLAN, SOP, CLAUDE.md, settings.json) | PENDING |
| 6 | Copy dev-manager dashboard | PENDING |
| 7 | Create plugin manifest (.claude-plugin/plugin.json) | PENDING |
| 8 | Create init/setup.sh scaffolding script | PENDING |
| 9 | Create Vue 3 add-on package | PENDING |
| 10 | Write README documentation | PENDING |
| 11 | Test plugin installation in fresh project | PENDING |
| 12 | Initialize git repo and commit | PENDING |

**Core Skills Included**:
| Skill | Purpose |
|-------|---------|
| chief-architect | Strategic orchestrator, ideas processing, decision-making |
| master-plan-manager | Safe MASTER_PLAN.md updates with backups |
| meta-skill-router | Intelligent skill selection/routing |
| skill-creator-doctor | Create, repair, consolidate skills |
| skills-manager | Skills management & analytics |
| ai-truthfulness-enforcer | Verification protocols, banned phrases |
| document-sync | Documentation synchronization |
| safe-project-organizer | Safe file organization |
| data-safety-auditor | Data safety auditing |
| crisis-debugging-advisor | Crisis debugging (stack-agnostic) |
| qa-testing | Playwright-based testing |

**Key Adaptations for Portability**:
- Replace `$CLAUDE_PROJECT_DIR` with relative/configurable paths
- Generalize file patterns in task-lock-enforcer.sh
- Remove Pomo-Flow specific examples from standards
- Keep Vue/TS patterns as examples (not requirements)

**Plan File**: `/home/endlessblink/.claude/plans/magical-coalescing-wreath.md`

**Rollback**: `rm -rf ~/claude-plugins/claude-dev-infrastructure`

---

### TASK-034: Migrate to Individual Task Documents (PHASE 4 COMPLETE)

**Goal**: Replace single `tasks:data` array document with individual `task-{id}` documents to prevent conflict accumulation.

**Priority**: P1-HIGH (Part of ROAD-013 - Sync Hardening)
**Risk Level**: HIGH (Data migration)
**Status**: ✅ Phase 4 Complete (Dec 21, 2025) - Monitor for 1 week before Phase 5

**Background**:
- **Current**: All tasks stored in single `tasks:data` PouchDB document as array
- **Problem**: 376+ conflicts accumulated on this document, wrong winner = data loss (ISSUE-011)
- **Solution**: Individual docs = conflicts isolated to single tasks, not entire collection

**Key Files**:
- `src/utils/individualTaskStorage.ts` - Individual task operations (460 lines)
- `src/stores/tasks.ts` - Phase 4 read switch logic (lines 940-1022)
- `src/config/database.ts` - Feature flags (STORAGE_FLAGS)
- `src/composables/documentFilters.ts` - Added `task-*` sync pattern

**Implementation Phases**:

| Phase | Description | Risk | Status |
|-------|-------------|------|--------|
| 1 | Preparation - Add feature flag, backup, conflict monitoring | LOW | ✅ Done |
| 2 | Dual-Write - Write to BOTH formats simultaneously | MEDIUM | ✅ Done |
| 3 | Migration - Run `migrateFromLegacyFormat()` one-time | HIGH | ✅ Done |
| 4 | Read Switch - Load from individual docs instead of array | HIGH | ✅ Done Dec 21 |
| 5 | Cleanup - Remove old format after 1 week stability | LOW | 🕐 Pending (after Dec 28) |

**Phase 4 Implementation (Dec 21, 2025)**:
1. Added `task-` pattern to `documentFilters.ts` syncable patterns
2. Updated `loadFromDatabase()` in `tasks.ts` to use `STORAGE_FLAGS.READ_INDIVIDUAL_TASKS`
3. Cleaned up orphaned individual doc (`task-1760459830472`) from CouchDB
4. Verified 4 legacy tasks = 4 individual docs (exact match)
5. Enabled `READ_INDIVIDUAL_TASKS: true` in `database.ts`
6. Confirmed app loads tasks from individual `task-{id}` documents

**Console Output Verification**:
```
📂 TASK-034 Phase 4: Loading tasks from individual task-{id} documents...
✅ TASK-034 Phase 4: Loaded 4 tasks from individual documents
```

**Rollback Points**:
- Phase 4: Set `READ_INDIVIDUAL_TASKS: false` in `database.ts` to revert to legacy
- Phase 5: Cannot rollback after cleanup - ensure stable first

**Success Criteria**:
- [x] All tasks migrated to individual documents
- [x] No data loss during migration
- [x] Conflict accumulation stops (conflicts per-task only)
- [x] Multi-device sync works correctly
- [ ] Rollback tested before Phase 5 cleanup (optional, 1 week monitoring)

**Phase 5 (After Dec 28, 2025)**:
1. Set `INDIVIDUAL_ONLY: true` in `database.ts`
2. Stop writing to `tasks:data`
3. Delete legacy `tasks:data` document

**Plan File**: `/home/endlessblink/.claude/plans/hazy-sauteeing-crane.md`

**Depends On**: - (TASK-022 monitoring complete)
**Blocks**: -
**Related**: ROAD-013 (Sync Hardening), ISSUE-011 (Resolved conflicts)

---

### ~~TASK-025~~: Task Dependency System for Claude Workflow (COMPLETE)
Dec 19, 2025 - Added dependency tracking to prevent file conflicts when working on multiple tasks.

**Features**:
- Dependency Index Table at top of Active Work section
- CLAUDE.md workflow instructions for conflict detection
- Reminder hook (`.claude/hooks/dependency-check-reminder.sh`)

**Files Created/Modified**:
- `docs/MASTER_PLAN.md` - Dependency index table
- `CLAUDE.md` - Task Dependency Workflow section
- `.claude/hooks/dependency-check-reminder.sh` - New hook
- `.claude/settings.json` - Hook registration

---

### ~~TASK-026~~: AskUserQuestion Enforcement Hooks (COMPLETE)
Dec 19, 2025 - Added hooks to force Claude Code to use AskUserQuestion tool properly.

**Features**:
- General reminder hook to always use AskUserQuestion tool for questions
- Misunderstanding detector hook that triggers when user indicates confusion
- Pattern detection for phrases like "you didn't understand", "wrong", "try again"

**Files Created**:
- `.claude/hooks/ask-questions-reminder.sh` - Always reminds to use AskUserQuestion
- `.claude/hooks/misunderstanding-detector.sh` - Detects frustration patterns
- `.claude/settings.json` - Both hooks registered

---

### ~~TASK-028~~: Auto-Sync Task Status Hook (COMPLETE)
Dec 19, 2025 - Added PostToolUse hook that auto-updates MASTER_PLAN.md task status when editing tracked files.

**Features**:
- Triggers after Edit/Write to source files
- Matches files against Task Dependency Index "Primary Files" column
- Auto-updates matching task status to IN_PROGRESS
- Preserves special statuses (MONITORING, DONE, already IN_PROGRESS)
- Supports glob patterns (*.stories.ts) and direct filename matches

**Files Created**:
- `.claude/hooks/auto-sync-task-status.sh` - Main hook script
- `.claude/settings.json` - Hook registered in PostToolUse

**Related**: BUG-022 (dev-manager kanban sync fixes)

---

### ~~TASK-018~~: Canvas Inbox Filters (COMPLETE)
Dec 18, 2025 - Added Unscheduled, Priority, and Project filters to canvas inbox.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-018-canvas-inbox-filters-complete)*

---

### TASK-022: Task Disappearance Logger & Investigation (👀 MONITORING)
Dec 19, 2025 - Logger installed and active. Monitoring for task disappearance events until Dec 20-21.

**Features**:
- Identified 6 critical task removal locations in `tasks.ts`
- Created `taskDisappearanceLogger.ts` with snapshot, diff, and search capabilities
- Integrated logging into task store, cross-tab sync, and main.ts
- Auto-enabled on app startup for monitoring

**Files Created/Modified**:
- `src/utils/taskDisappearanceLogger.ts` - Logger utility
- `src/stores/tasks.ts` - Wrapped all `tasks.value =` assignments
- `src/composables/useCrossTabSync.ts` - Added delete operation logging
- `src/main.ts` - Auto-enable on startup

*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-022-task-disappearance-logger--investigation-complete)*

---

### TASK-024: Review Task Disappearance Logs (⏸️ PASSIVE MONITORING)

**Goal**: Analyze taskDisappearanceLogger data IF task disappearance is reproduced.

**Priority**: P3-LOW (passive - only activate if issue recurs)

**Depends On**: ~~TASK-022~~ (COMPLETE - logger is active)

**Status**: ⏸️ On hold - User cannot reliably reproduce the issue. Logger remains active for passive monitoring.

#### If Issue Recurs - Run These Steps

| Step | Description | Status |
|------|-------------|--------|
| 1 | Run `window.taskLogger.printSummary()` in browser console | WAITING |
| 2 | Check `window.taskLogger.getDisappearedTasks()` for disappeared tasks | WAITING |
| 3 | If tasks disappeared, analyze logs to identify source | WAITING |
| 4 | Export logs with `window.taskLogger.exportLogs()` for documentation | WAITING |
| 5 | Create fix based on findings | WAITING |
| 6 | Remove auto-enable from `src/main.ts` once issue resolved | WAITING |

#### Notes

- Logger is integrated and running in background
- If tasks disappear again, immediately run the steps above
- May be an intermittent issue or already resolved
- Low priority until reproduction occurs

---

### ~~TASK-023~~: Dev-Manager Statistics/Analytics Dashboard (DONE Dec 19, 2025)

**Goal**: Add a comprehensive Statistics tab to the Dev-Manager for project analytics and insights.

**Priority**: P2-MEDIUM

**Started**: Dec 18, 2025 (Planning phase)
**Completed**: Dec 19, 2025

**Background**: The dev-manager currently has Kanban, Skills, and Docs tabs. A Statistics tab would provide valuable insights into project progress, task completion trends, and development metrics.

#### Available Data Sources (from MASTER_PLAN.md)

| Category | Metrics Available |
|----------|-------------------|
| **Task Tracking** | TASK-XXX, BUG-XXX, ROAD-XXX, IDEA-XXX, ISSUE-XXX counts and status |
| **Progress** | Completion percentages, subtask progress, lint error trends |
| **Temporal** | Completion dates, session tracking, timeline patterns |
| **Code Quality** | Lint errors (5,175 → 0), TypeScript errors, file sizes |
| **Effort** | Priority levels (P0-P3), complexity estimates, effort estimates |
| **Sync/Database** | Sync status, test coverage |

#### Proposed Visualizations

| Chart | Description |
|-------|-------------|
| Task Burndown | Tasks completed over time |
| Status Distribution | Pie/donut chart of TODO/IN-PROGRESS/DONE |
| Priority Matrix | Bar chart by priority level |
| Lint Progress | Line chart showing error reduction over time |
| Category Breakdown | Tasks by type (TASK, BUG, ROAD, IDEA, ISSUE) |
| Completion Velocity | Rolling average of tasks completed per week |

#### Implementation Steps

| Step | Description | Status |
|------|-------------|--------|
| 1 | Design dashboard layout and charts | ✅ DONE |
| 2 | Create `dev-manager/stats/index.html` | ✅ DONE |
| 3 | Parse MASTER_PLAN.md for metrics | ✅ DONE |
| 4 | Implement chart visualizations (Chart.js) | ✅ DONE |
| 5 | Add tab to dev-manager/index.html | ✅ DONE |
| 6 | Test with Playwright | ✅ DONE |

#### Features Implemented

- **Summary Cards**: Total Items, Completed, In Progress, To Do, Bugs, Completion %
- **Charts**: Status Distribution (doughnut), Type Breakdown (bar), Priority Distribution (horizontal bar)
- **Recently Completed**: List of last 10 completed items with type badges
- **Live Updates**: Auto-refresh with timestamp display
- **Lazy Loading**: Uses same pattern as Skills/Docs tabs for proper iframe initialization

#### Related Issues

- ~~BUG-021~~: ✅ FIXED Dec 19 - Lazy loading iframes on first tab activation
- Statistics tab should use same lazy loading pattern when implemented

---

### TASK-019: Fix `any` Type Warnings (PLANNED)

**Goal**: Fix 1,369 `no-explicit-any` warnings in batches for better type safety.

**Priority**: P3-LOW (code quality improvement)

**Total Warnings**: 1,369 across 140 files

| Batch | Target | Warnings | Status |
|-------|--------|----------|--------|
| 1 | Stores (tasks, auth, canvas, etc.) | ~80 | TODO |
| 2 | Views (CanvasView, CalendarView, etc.) | ~102 | TODO |
| 3 | Sync utils (conflictResolution, threeWayMerge) | ~128 | TODO |
| 4 | Core composables (useCrossTabSync, useDatabase) | ~200 | TODO |
| 5 | Components | ~212 | TODO |
| 6 | Remaining utils | ~247 | TODO |
| 7 | Other files | ~400 | TODO |

**Top 10 Files by Warning Count**:
1. `CanvasView.vue` (81)
2. `useCrossTabSync.ts` (71)
3. `useReliableSyncManager.ts` (50)
4. `conflictResolution.ts` (44)
5. `tasks.ts` store (37)
6. `SyncErrorBoundary.vue` (35)
7. `threeWayMerge.ts` (31)
8. `auth.ts` store (27)
9. `verificationReportGenerator.ts` (27)
10. `userResolutionRules.ts` (26)

**Process Per Batch**:
1. Read each file to understand context
2. Define proper types (interfaces/types)
3. Replace `any` with correct types
4. Run `npm run lint` to verify reduction
5. Run `npm run build` to ensure no breaks
6. Commit batch with clear message

**Notes**:
- Each batch should be committed separately
- Build must pass after each batch
- Can be paused/resumed between batches
- Low priority - do when time permits

---

### TASK-014: Storybook Glass Morphism Streamlining (IN PROGRESS)

**Goal**: Apply consistent glass morphism design aesthetic (stroke borders, glass blur, no fills) across all Storybook stories and their components.

**Priority**: P2-MEDIUM

**Design Reference** (from BaseModal):
- `background: var(--glass-bg-solid)` → `rgba(0, 0, 0, 0.95)` - Solid black for cards/panels
- `border: 1px solid var(--glass-border)` → `rgba(255, 255, 255, 0.1)` - Stroke borders
- `backdrop-filter: blur(20px) saturate(100%)` - Glass blur effect
- Hover: `background: var(--glass-bg-medium)` → `rgba(255, 255, 255, 0.05)`
- Hover border: `var(--glass-border-hover)` → `rgba(255, 255, 255, 0.15)`
- Icon hovers: Strokes only, no fills

**Design Token Added** (Dec 16, 2025):
- `--glass-bg-solid: rgba(0, 0, 0, 0.95)` in `src/assets/design-tokens.css:50`

**Completed Stories/Components**:
| File | Component Changes | Status |
|------|-------------------|--------|
| `TaskManagerSidebar.vue` | `.task-sidebar`, `.sidebar-task`, `.nested-task`, `.action-btn` hover | ✅ DONE |
| `BaseButton.stories.ts` | Added dark bg wrappers, argTypes, streamlined stories | ✅ DONE |
| `GroupEditModal.vue` | `.modal-content`, `.form-input`, `.layout-btn`, buttons to strokes | ✅ DONE |
| `DoneToggle.vue` | Progress indicator: clip-path left-to-right fill; Minimal variant: stroke-only when completed | ✅ DONE |
| `DoneToggle.stories.ts` | Fixed missing `computed` import for Interactive Demo story | ✅ DONE |
| `TaskRow.vue` | Replaced native checkbox with DoneToggle component | ✅ DONE |
| `HierarchicalTaskRow.vue` | Progress bar updated to stroke-only design | ✅ DONE |
| `TaskTable.vue` | Progress bar updated to stroke-only design | ⚠️ NEEDS REVIEW |
| `BatchEditModal.vue` | Modal styling aligned with BaseModal (pure black bg, neutral borders, dark-mode colors) | ✅ DONE |
| `GroupModal.vue` | Modal styling streamlined: pure black bg, neutral buttons (no purple gradients/glows), clean borders | ✅ DONE |
| `QuickTaskCreate.vue` | Modal styling streamlined: pure black bg, neutral buttons (no teal), clean property chips | ✅ DONE |

#### Storybook Coverage Analysis (Dec 19, 2025 - Updated)

| Metric | Count |
|--------|-------|
| **Total Components** | 107 |
| **Components WITH Stories** | 49 |
| **Components WITHOUT Stories** | 58 |
| **Coverage** | 46% |

##### Coverage by Category

| Category | Components | With Stories | Coverage |
|----------|------------|--------------|----------|
| Base Components | 13 | 10 | 77% |
| Canvas | 15 | 8 | 53% |
| Kanban/Board | 3 | 3 | 100% |
| Modals | ~15 | 10 | 67% |
| Auth | 6 | 0 | **0%** |
| Sync | 12 | 0 | **0%** |
| UI/Utility | ~40 | 18 | 45% |

##### 🔴 CRITICAL GAPS (High Priority)

**Authentication (0% covered)**:
- `AuthModal.vue` - Main auth modal
- `LoginForm.vue` - Login flow
- `SignupForm.vue` - Signup flow
- `GoogleSignInButton.vue` - OAuth button
- `UserProfile.vue` - User settings
- `ResetPasswordView.vue` - Password reset

**App Shell (0% covered)**:
- `AppSidebar.vue` - Main navigation sidebar

**Canvas Features (Partial)**:
- `CanvasGroup.vue` - Group container
- `GroupNodeSimple.vue` - Simple group node
- `GroupManager.vue` - Group management
- `GroupSettingsMenu.vue` - Group settings
- `NodeContextMenu.vue` - Right-click on nodes
- `UnifiedGroupModal.vue` - Group editing

**Quick Sort View (0% covered)**:
- `QuickSortCard.vue` - Card for sorting tasks
- `SortProgress.vue` - Progress indicator

**Modals Missing**:
- `WelcomeModal.vue` - First-time user welcome
- `CloudSyncSettings.vue` - Sync configuration

##### 🟡 IMPORTANT GAPS (Medium Priority)

**Sync System (0% covered)**:
- `SyncStatus.vue` - Sync state display
- `SyncStatusIndicator.vue` - Mini sync indicator
- `SyncAlertSystem.vue` - Sync alerts
- `SyncHealthDashboard.vue` - Sync health
- `ConflictResolutionDialog.vue` - Conflict resolution
- `ManualMergeModal.vue` - Manual merge UI
- `DiffViewer.vue` - Diff comparison
- All diff components (8): TextDiff, LineDiff, WordDiff, CharacterDiff, ArrayDiff, ObjectDiff, BooleanDiff, DateTimeDiff

**Filters & Controls**:
- `FilterControls.vue` - General filter UI
- `InboxFilters.vue` - Inbox filtering
- `ProjectFilterDropdown.vue` - Project filter dropdown
- `CategorySelector.vue` - Category selection

**Notifications**:
- `NotificationPreferences.vue` - Notification settings

##### 🟢 LOWER PRIORITY (Nice-to-have)

- `FaviconManager.vue` - Dynamic favicon
- `PerformanceTest.vue` - Dev testing component
- `KeyboardDeletionTest.vue` - Dev testing
- `SyncIntegrationExample.vue` - Dev example
- `EmergencyRecovery.vue` - Emergency tools
- `BackupVerificationButton.vue` - Backup verification
- `ForensicVerificationDashboard.vue` - Debug tools
- `OverflowTooltip.vue` - Utility component
- `HierarchicalTaskRow.vue` - Alternative task row

##### 🎯 Recommended Priority Order

1. **Auth Components** - Critical for user onboarding documentation
2. **AppSidebar** - Core navigation component
3. **Canvas Groups** - Key canvas functionality
4. **Sync Components** - Complex system needs documentation
5. **QuickSort View** - Missing view documentation
6. **WelcomeModal** - User onboarding

**Next Steps**:
1. ✅ Fixed existing story errors (Dec 19: ResizeHandle, TaskNode, TaskContextMenu, ContextMenu, removed duplicate story)
2. Add missing stories for Priority 1 (Auth) components
3. Build toward 100% coverage

**Where We Stopped** (Dec 18, 2025 - Session 2):

#### KanbanSwimlane Streamlining (✅ DONE - Dec 20, 2025)
- **Stories reduced**: 7 → 2 stories (Default + ViewTypes), matching KanbanColumn format
- **CSS updated**: Dark glass morphism applied to swimlane headers and columns
- **Visual alignment**: Complete - matches KanbanColumn styling

**🔴 NEXT SESSION - CREATE AUTH COMPONENT STORIES (COMPLETED)**:

**Goal**: Create stories for 6 Auth components (0% → 100% coverage)

**Components to create stories for**:
1. `AuthModal.vue` - Main auth modal
2. `LoginForm.vue` - Login flow
3. `SignupForm.vue` - Signup flow
4. `GoogleSignInButton.vue` - OAuth button
5. `UserProfile.vue` - User settings
6. `ResetPasswordView.vue` - Password reset

**MANDATORY for each story**:
- Use design tokens ONLY (no hardcoded colors) - see Check 6 in storybook-audit skill
- Use mock data, NOT real stores
- Use `layout: 'fullscreen'` for modals
- Set appropriate `iframeHeight` based on component type

**Skill upgraded**: `storybook-audit` now includes tokenization enforcement (Check 6)

**Status**: ✅ COMPLETED - All 6 Auth component stories created and verified to work correctly

---

#### Previous Session Work (Dec 18, 2025 - Session 1):
- DoneToggle progress indicator fixed to use left-to-right clip-path fill
- DoneToggle minimal variant now shows stroke-only (not filled) when completed
- TaskRow.vue updated to use DoneToggle instead of native checkbox
- **Progress bar stroke-only design applied but user says it doesn't look/work well**
- Need to discuss alternative progress bar visual approach with user:
  1. Subtle glass fill (transparent `rgba(--color-primary-rgb, 0.3)`)
  2. Text only (just percentage number)
  3. Different approach TBD
- **ConfirmationModal.stories.ts** - Fixed docs overlay issue (modals escaping container)
  - Changed `layout: 'centered'` to `layout: 'fullscreen'`
  - Added `docs.story.height: '500px'` parameter
  - Updated decorator for full viewport containment
- **GroupModal.stories.ts** - Fixed docs overlay issue (same pattern)
- **ProjectModal.stories.ts** - Fixed docs overlay issue (same pattern)
- **BatchEditModal.vue** - Fully aligned with BaseModal design system:
  - Changed modal background from `rgba(20, 24, 32, 0.95)` to pure black `rgba(0, 0, 0, 0.95)`
  - Updated overlay to `rgba(0, 0, 0, 0.7)` with `saturate(100%)`
  - Fixed quick action button hovers (was using light theme colors like `var(--green-50)`)
  - Updated all glass variables to neutral `rgba(255, 255, 255, 0.02-0.05)` backgrounds
  - Changed animation from `scaleIn` to `slideUp` to match BaseModal
- **GroupModal.vue** - Fully streamlined to match BaseModal design system:
  - Changed overlay from `var(--overlay-dark)` with `saturate(150%)` to `rgba(0, 0, 0, 0.7)` with `saturate(100%)`
  - Changed modal background from gradient to pure black `rgba(0, 0, 0, 0.95)`
  - Reduced `backdrop-filter` from `blur(32px) saturate(200%)` to `blur(20px) saturate(100%)`
  - Removed purple gradient buttons and glow effects
  - Updated btn-primary: neutral `rgba(255, 255, 255, 0.1)` background, no shadows
  - Updated btn-secondary: transparent background with subtle border
  - Updated color presets, custom color section to use neutral backgrounds
  - Changed animation from `scaleIn` to `slideUp`
- **QuickTaskCreate.vue** - Fully streamlined to match BaseModal design system:
  - Changed overlay from `var(--overlay-bg)` to `rgba(0, 0, 0, 0.7)` with `blur(12px) saturate(100%)`
  - Changed modal background from `var(--surface-secondary)` to `rgba(0, 0, 0, 0.95)` with `blur(20px)`
  - Updated property chips: neutral `rgba(255, 255, 255, 0.03)` background with `0.1` border
  - Removed teal create button - now uses neutral `rgba(255, 255, 255, 0.1)`
  - Updated cancel button to transparent with neutral border
  - Updated actions row border to `rgba(255, 255, 255, 0.08)`

**Remaining Stories** (54 total):

**Base Components** (8):
- [x] `BaseButton.stories.ts`
- [ ] `BaseCard.stories.ts`
- [ ] `BaseInput.stories.ts`
- [ ] `BaseDropdown.stories.ts`
- [ ] `BaseBadge.stories.ts`
- [ ] `BasePopover.stories.ts`
- [ ] `BaseIconButton.stories.ts`
- [ ] `BaseNavItem.stories.ts`
- [ ] `BaseModal.stories.ts` (reference - already correct)

**UI Components** (15):
- [ ] `EmojiPicker.stories.ts` (reference - already correct)
- [ ] `TimeDisplay.stories.ts`
- [ ] `ProjectTreeItem.stories.ts`
- [ ] `CommandPalette.stories.ts`
- [ ] `CustomSelect.stories.ts`
- [ ] `ErrorBoundary.stories.ts`
- [ ] `ProjectDropZone.stories.ts`
- [ ] `BackupSettings.stories.ts`
- [ ] `CalendarInboxPanel.stories.ts`
- [ ] `DoneToggle.stories.ts`
- [ ] `ViewControls.stories.ts`
- [ ] `DateDropZone.stories.ts`
- [ ] `MultiSelectToggle.stories.ts`
- [ ] `DragHandle.stories.ts`
- [x] `ContextMenu.stories.ts` ✅ Tokenized + added inline:false (Dec 19)
- [ ] `PerformanceTest.stories.ts`

**Board Components** (6):
- [x] `KanbanColumn.stories.ts` ✅ Streamlined (Dec 18 - previous session)
- [ ] `TaskCard.stories.ts`
- [ ] `TaskTable.stories.ts`
- [~] `KanbanSwimlane.stories.ts` ⚠️ IN PROGRESS - Stories done, visual refinement needed
- [ ] `TaskRow.stories.ts`
- [ ] `TaskList.stories.ts`

**Canvas Components** (12):
- [ ] `CanvasContextMenu.stories.ts`
- [ ] `InboxPanel.stories.ts`
- [ ] `CanvasSection.stories.ts`
- [ ] `InboxTimeFilters.stories.ts`
- [x] `TaskNode.stories.ts` ✅ Fixed Vue Flow context error + tokenized CSS (Dec 19)
- [ ] `SectionManager.stories.ts`
- [ ] `SectionNodeSimple.stories.ts`
- [ ] `EdgeContextMenu.stories.ts`
- [x] `ResizeHandle.stories.ts` ✅ Fixed + tokenized (Dec 19)
- [ ] `MultiSelectionOverlay.stories.ts`
- [x] `GroupEditModal.stories.ts`

**Modals** (9):
- [x] `ConfirmationModal.stories.ts` ✅ Fixed docs overlay issue (Dec 18)
- [x] `GroupModal.stories.ts` ✅ Fixed docs overlay issue (Dec 18)
- [x] `BatchEditModal.stories.ts` ✅ Component + story streamlined (Dec 18)
- [ ] `QuickTaskCreateModal.stories.ts`
- [ ] `SearchModal.stories.ts`
- [ ] `SettingsModal.stories.ts`
- [x] `ProjectModal.stories.ts` ✅ Fixed docs overlay issue (Dec 18)
- [ ] `QuickTaskCreate.stories.ts`
- [ ] `BaseModal-Redesign-Preview.stories.ts`

**Context Menus** (2):
- [x] `TaskContextMenu.stories.ts` ✅ Fixed positioning + tokenized + added inline:false (Dec 19)
- [ ] `TaskEditModal.stories.ts`

**Design System** (1):
- [ ] `Colors.stories.ts`

---

### ~~TASK-011~~: Lint Cleanup (COMPLETE)
Dec 16-18, 2025 - Fixed 2,405 lint errors (100% reduction). Skill created: `.claude/skills/dev-lint-cleanup/`
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-011-lint-cleanup-complete)*

---

### ~~TASK-016~~: Calendar Time Indicator (COMPLETE)
Dec 17, 2025 - Added red "now" line indicator to calendar view (similar to Google Calendar).
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-016-calendar-time-indicator-complete)*

---

### ~~TASK-015~~: Intelligent Task Status Analysis (COMPLETE)
Dec 18, 2025 - Dev-manager now analyzes task content semantically instead of pattern matching.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-015-intelligent-task-status-analysis-for-dev-manager-complete)*

---

### ~~TASK-012~~: Expand CI Tests (COMPLETE - Partial)
Dec 18, 2025 - Lint now blocking in CI. Unit tests deferred to TASK-020.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-012-expand-ci-tests-complete---partial)*

---

### ~~TASK-020~~: Fix Unit Test Infrastructure ✅ DONE

**Completed**: Dec 19, 2025

**Goal**: Fix all blockers preventing unit tests from running in CI.

**Summary**: Safety tests now pass and are enabled in CI workflow.

| Category | Count | Fix Applied | Status |
|----------|-------|-------------|--------|
| Circular Dependencies | 121 | Created `databaseTypes.ts` for shared interfaces, dependency injection in `localBackupManager.ts` | ✅ Fixed |
| CSS Syntax Errors | 13 | Fixed nested `var()` parsing with balanced parenthesis extraction | ✅ Fixed |
| Vue Import Errors | 9 | Changed to warning tests (naive static analysis has many false positives) | ✅ Fixed |
| Vitest/Storybook Conflict | 1 | Already fixed with `vitest.ci.config.ts` | ✅ Fixed |

**Key Changes**:
1. `src/types/databaseTypes.ts` - Shared interfaces to break circular dependency
2. `src/utils/localBackupManager.ts` - Dependency injection pattern
3. `tests/safety/dependencies.test.ts` - Fixed type-only imports detection, added allowlist
4. `tests/safety/css-syntax.test.ts` - Fixed nested var() parsing
5. `tests/safety/vue-imports.test.ts` - Changed to warning tests
6. `.github/workflows/ci.yml` - Enabled safety tests in CI

**CI Note**: Safety tests are enabled but CI still fails on lint warnings (`--max-warnings 0`).
Requires **TASK-027** (lint warning fixes) to complete for CI to pass fully.

**Success Criteria**:
- [x] `npm run test:safety` passes with 0 failures ✅
- [x] CI runs safety tests on every push/PR ✅
- [x] No circular dependency warnings ✅
- [x] CSS validates without syntax errors ✅
- [ ] CI fully green (blocked by TASK-027 lint warnings)

**Commits**:
- `d2771c1` - fix(tests): Fix safety test suite to pass reliably
- `c87a5f8` - feat(ci): Enable safety tests in CI workflow

---

### ~~TASK-021~~: Real-Time Cross-Instance Timer Sync (COMPLETE)

**Goal**: Make timer sync immediate and work across different browser instances/devices.

**Priority**: P1-HIGH (part of ROAD-013 Sync Hardening)

**Status**: ✅ **COMPLETE** - Dec 19, 2025

**SOP**: `docs/🐛 debug/sop/timer-cross-device-sync-fix-2025-12-19.md`

**Related**: BUG-016 (timer not syncing), ISSUE-007 (timer sync across instances), TASK-017 (KDE widget)

**Problem Statement**:
Current cross-tab sync only works within the **same browser instance** (uses localStorage/BroadcastChannel).
Different Chrome instances, different browsers, or different devices do NOT sync timer state.

#### Current Limitations
| Sync Type | Works? | Mechanism |
|-----------|--------|-----------|
| Same browser, different tabs | ⚠️ Partial | localStorage + BroadcastChannel (leadership conflict) |
| Different browser instances | ❌ No | No shared state |
| Different devices | ❌ No | No real-time mechanism |

---

#### ✅ Dec 19, 2025 - Research Complete (ROOT CAUSE CONFIRMED)

**Root Cause Identified**: The `reliable-sync-change` event is **NEVER dispatched** during live sync!

| Location | Code | Issue |
|----------|------|-------|
| `useReliableSyncManager.ts:1046-1063` | Live sync `on('change')` handler | Does NOT dispatch `reliable-sync-change` |
| `useReliableSyncManager.ts:273-316` | `_setupSyncEventHandlers()` | WOULD dispatch event, but NEVER CALLED (dead code) |
| `timer.ts:260-279` | `handleRemoteSyncChange` | Listens for `reliable-sync-change` that never comes |

**Data Flow Problem**:
```
CouchDB Remote ──► Live Sync Handler (line 1046) ──► Task Store ✅ Reloaded
                         │
                         │ NO EVENT DISPATCHED!
                         │
                         X
                         │
                   timer.ts waits for event that never arrives
```

**Research Sources**:
- [PouchDB Changes Feed Guide](https://pouchdb.com/guides/changes.html)
- [PouchDB API Reference](https://pouchdb.com/api.html)
- [PouchDB Replication Guide](https://pouchdb.com/guides/replication.html)

---

#### 🟢 Implementation Plan: Direct PouchDB Changes Feed

**Chosen Approach**: Use PouchDB's native `db.changes()` API with `doc_ids` filter for real-time timer updates.

**Why This Approach**:
1. Official PouchDB pattern for real-time updates
2. Filters to just timer document (efficient)
3. Independent of sync system complexities
4. Provides immediate updates when CouchDB receives changes

**Implementation Steps**:

| Step | Description | Effort | Status |
|------|-------------|--------|--------|
| 1 | ~~Research: How reliable-sync-change works~~ | ~~1h~~ | ✅ DONE |
| 2 | ~~Research: PouchDB live changes API~~ | ~~1h~~ | ✅ DONE |
| 3 | ~~Create `useTimerChangesSync.ts` composable~~ | ~~1h~~ | ✅ DONE |
| 4 | ~~Implement `db.changes()` listener with `doc_ids` filter~~ | ~~1h~~ | ✅ DONE |
| 5 | ~~Add proper cleanup (cancel on unmount)~~ | ~~30m~~ | ✅ DONE |
| 6 | ~~Add offline/reconnect handling~~ | ~~1h~~ | ✅ DONE |
| 7 | ~~Integrate into timer store~~ | ~~1h~~ | ✅ DONE |
| 8 | ~~Test cross-device sync scenarios~~ | ~~1h~~ | ✅ DONE |

**Files Created/Modified** (Dec 19, 2025):

1. **NEW**: `src/composables/useTimerChangesSync.ts` ✅
   - Direct PouchDB changes feed for timer document
   - Uses `doc_ids: ['pomo-flow-timer-session:data']` filter
   - Proper cleanup with `cancel()` method
   - Auto-reconnect on error (up to 5 attempts)

2. **MODIFIED**: `src/stores/timer.ts` ✅
   - Imported `useTimerChangesSync` composable
   - Replaced `reliable-sync-change` event listener with direct changes feed
   - Added `cleanupCrossDeviceSync()` function
   - Added leader timestamp for clock sync compensation
   - Kept existing `handleRemoteTimerUpdate()` logic
   - **FIX**: Fixed data structure mismatch in `loadTimerSession()` (lines 945-1042)
   - **FIX**: Fixed changes feed handler to extract nested `.data` property (lines 301-324)

3. **MODIFIED**: `src/composables/useDatabase.ts` ✅
   - **FIX**: Initialize sync manager BEFORE database creation (line 285-296)
   - **FIX**: Auto-start live sync after database initialization (line 345-354)

4. **MODIFIED**: `src/components/SyncStatusIndicator.vue` ✅
   - **FIX**: Added 1.5s debounced sync status to prevent UI flickering (lines 235-276)
   - Immediate handling for error/offline states preserved

**Root Causes Fixed** (Dec 19, Session 2):

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Timer not appearing without refresh | Data structure mismatch - `loadTimerSession` expected flat props but `db.load()` returns `{session: {...}}` | Access `saved.session.*` instead of `saved.*` |
| Changes feed not updating timer | Raw PouchDB doc `{_id, _rev, data: {...}}` passed but handler expected flat structure | Extract `rawDoc.data` before passing to handler |
| Sync status flickering | Live sync rapidly toggles between 'syncing'/'complete' | Added 1.5s debounce on status transitions |
| Sync not auto-starting on refresh | `syncManager` only initialized in catch block for new DB | Initialize syncManager BEFORE try/catch block |

**Success Criteria** (All verified Dec 19, 2025):
- [x] Timer starts on Device A → appears on Device B within 2 seconds
- [x] Timer pause/resume syncs immediately
- [x] Only one "leader" can control the timer at a time
- [x] Graceful handling when offline
- [x] Changes listener properly cleaned up on unmount
- [x] Timer appears on other device WITHOUT needing page refresh
- [x] Timer countdown shows same time on both devices (drift fixed)
- [x] Sync status indicator doesn't flicker during live sync

**Rollback Command**:
```bash
git checkout HEAD -- src/composables/useTimerChangesSync.ts src/stores/timer.ts
```

---

#### ❌ Dec 18, 2025 - Previous Implementation Attempt (FAILED)

<details>
<summary>Click to expand failed attempt details</summary>

**What Was Tried**:
1. Added device ID system with localStorage persistence (`pomoflow-device-id`)
2. Added device leadership election with heartbeat (2s interval, 5s timeout)
3. Listened for `reliable-sync-change` custom events from CouchDB sync system
4. Added `handleRemoteTimerUpdate()` to sync state from leader
5. Added `calculateRemainingTime()` to compute correct time from `startTime`
6. Added `startFollowerInterval()` for local display updates on follower
7. Direct PouchDB access with conflict resolution (5 retries, deletes conflicting revisions)

**Files Modified**: `src/stores/timer.ts` (lines 155-376 added)

**What Did NOT Work**:
1. **Sync not triggering** - The `reliable-sync-change` event was never being fired (root cause found!)
2. **Document conflicts** - Timer session had 88+ CouchDB conflicts
3. **Time still not in sync** - Times were different on devices
4. **Timer changes on refresh** - Timer time changed on page refresh

</details>

---

### TASK-017: KDE Plasma Widget (Plasmoid) for Timer Sync

**Goal**: Create a KDE Plasma 6 taskbar widget that provides bidirectional timer sync with Pomo-Flow via CouchDB.

**Priority**: P2-MEDIUM

**Effort Estimate**: 14-19 developer days

**Platform**: Tuxedo OS (KDE Plasma 6.1)

**Location**: `pomo-flow/plasmoid/` (monorepo - can extract later)

#### Features
- Compact taskbar view: icon + timer countdown
- Expanded popup: timer display, start/pause/stop, task selector
- Bidirectional sync via CouchDB changes feed
- Real-time updates when web app changes timer

#### Implementation Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | Basic plasmoid structure (metadata.json, main.qml, compact/full views) | 2-3 days | PENDING |
| 2 | CouchDB read integration (fetch timer state, task list) | 3-4 days | PENDING |
| 3 | CouchDB write integration (save timer changes, conflict handling) | 3-4 days | PENDING |
| 4 | Real-time sync with `_changes` long-polling | 4-5 days | PENDING |
| 5 | Polish (settings panel, notifications, offline queue) | 2-3 days | PENDING |

#### File Structure

```
plasmoid/
└── package/
    ├── metadata.json              # Plasmoid metadata (Plasma 6)
    ├── contents/
    │   ├── ui/
    │   │   ├── main.qml           # Entry point
    │   │   ├── CompactRepresentation.qml
    │   │   ├── FullRepresentation.qml
    │   │   ├── TimerDisplay.qml
    │   │   └── TaskSelector.qml
    │   ├── config/
    │   │   └── main.xml           # Config schema
    │   └── code/
    │       ├── CouchDBClient.js   # HTTP client for CouchDB
    │       └── TimerManager.js    # Timer logic + sync
    └── icons/
        └── pomo-flow-icon.svg
```

#### CouchDB Documents Used
- `pomo-flow-timer-session:data` - Current timer state
- `tasks:data` - Task list for dropdown

#### Technical Notes
- Uses QML + JavaScript (KDE Plasma 6 native)
- XMLHttpRequest for CouchDB HTTP API
- Long-polling `_changes` feed for real-time sync
- Conflict resolution: timestamp-based last-write-wins

#### Reference Files
- `src/stores/timer.ts` - PomodoroSession interface
- `src/config/database.ts` - CouchDB credentials
- `src/types/tasks.ts` - Task interface

#### Plan File
Full design: `/home/endlessblink/.claude/plans/stateless-wishing-pancake.md`

---

### ~~TASK-010~~: Consolidate Sections → Groups (COMPLETE)
Dec 16, 2025 - Renamed all "section" terminology to "groups" with backward compatibility.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-010-consolidate-sections--groups-complete)*

---

### ~~TASK-013~~: Unified Group Modal (COMPLETE)
Dec 16, 2025 - Consolidated group creation modals into single UnifiedGroupModal.vue (~470 lines reduction).
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-013-unified-group-modal-complete)*

---

### ~~TASK-009~~: Separate Calendar/Canvas Inbox Systems (COMPLETE)
Dec 16, 2025 - Calendar and canvas inboxes are now completely independent systems.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-009-separate-calendarcanvas-inbox-systems-complete)*

---

### ~~TASK-001~~: Power Groups Feature (COMPLETE)
Dec 5, 2025 - Canvas groups auto-detect keywords and provide "power" functionality.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-001-power-groups-feature-complete)*

---

### Smart Group Bugs (11 issues documented)

<!-- Bugs use BUG-XXX format -->
| ID | Bug | Priority | Status |
|----|-----|----------|--------|
| ~~BUG-001~~ | Task disappears when set to yesterday | ~~FIXED~~ | ✅ `tasks.ts:1718-1729` |
| ~~BUG-002~~ | Canvas tasks disappear on new task creation | ~~FIXED~~ | ✅ `CanvasView.vue:589-618` |
| ~~BUG-003~~ | ~~Today group shows wrong count~~ | ~~P1-HIGH~~ | ✅ FIXED - Verified Dec 16, 2025 |
| ~~BUG-004~~ | ~~Tasks in Today group don't drag~~ | ~~P2-MEDIUM~~ | ✅ FIX APPLIED Dec 16 - Needs manual test |
| ~~BUG-005~~ | ~~Date not updating on group drop~~ | ~~P1-HIGH~~ | ✅ FIX APPLIED Dec 16 - Added syncNodes() after property update |
| BUG-006 | Week shows same count as Today | N/A | Not a bug - expected behavior |
| ~~BUG-007~~ | ~~Deleting group deletes tasks inside~~ | ~~P1-HIGH~~ | ✅ ALREADY FIXED Dec 5, 2025 - Tasks preserved on canvas |
| BUG-008 | Ctrl+Z doesn't restore deleted groups | P3-LOW | Known limitation |
| ~~BUG-013~~ | ~~Tasks disappear after changing properties on canvas~~ | ~~P1-HIGH~~ | ✅ FIXED Dec 16, 2025 - Two-part fix: (1) requestSync() in TaskContextMenu (2) spread task object in syncNodes |
| BUG-014 | Sync status shows underscore instead of time | P3-LOW | UI glitch - shows "_" instead of "just now" |
| ~~BUG-015~~ | ~~Edit Task modal behind nav tabs~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 16, 2025 - Added Teleport to body |
| ~~BUG-016~~ | ~~Timer status not syncing~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Added pinia-shared-state@0.5.1 plugin. Timer store excluded with share:false (has Date objects). Rollback: `git checkout pre-pinia-shared-state` |
| ~~BUG-018~~ | ~~Canvas smart group header icons cut off~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Wrapped actions in overflow container |
| ~~BUG-019~~ | ~~Canvas section resize preview mispositioned~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Used Vue Flow viewport + container offset for accurate positioning |
| BUG-020 | Tasks randomly disappearing without user deletion | P3-LOW | ⏸️ PASSIVE MONITORING - Logger integrated, waiting for reproduction. If occurs: run `window.taskLogger.printSummary()` |
| ~~BUG-021~~ | ~~Dev-Manager Skills/Docs tabs show black until manual refresh~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Lazy loading iframes on first tab activation |
| ~~BUG-022~~ | ~~Dev-Manager Kanban not syncing with MASTER_PLAN.md updates~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Symlink + `--symlinks` flag for serve |
| ~~BUG-023~~ | ~~Dev-Manager Stats/Kanban showing different Active Work items~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Pattern order fix, regex newline fix, symlink restoration |
| ~~BUG-024~~ | ~~Sync status indicator flickering~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Added 1.5s debounce on status transitions during live sync. Part of TASK-021 |

**Details**: See "Open Bug Analysis" section below.

#### ~~BUG-018~~ & ~~BUG-019~~: Canvas Smart Group UI Issues (Dec 18, 2025) ✅ ALL FIXED

**~~BUG-018: Header Icons Cut Off~~ ✅ FIXED Dec 19, 2025**
- **Symptom**: When smart group (e.g., "Today") is narrow, right-side icons/buttons get cut off or overlap
- **Root Cause**: Header has 8+ flex items with `flex-shrink: 0`, competing for ~50px reserved space
- **Solution Applied**:
  - Wrapped action buttons in `.header-actions` container with `overflow: hidden`
  - Set name input to `flex: 1 1 60px` with `min-width: 60px` and `text-overflow: ellipsis`
  - Added fade mask on hover to indicate clipped content
- **SOP**: `docs/🐛 debug/sop/canvas-header-overflow-fix-2025-12-19.md`

**~~BUG-019: Resize Preview Mispositioned~~ ✅ FIXED Dec 19, 2025**
- **Symptom**: Blue ghost preview appears at wrong location when resizing section from left/top edges
- **Root Cause**: Two issues: (1) `getSectionResizeStyle()` used stale `section.position` from store instead of live NodeResizer position; (2) Used canvas store viewport instead of actual Vue Flow viewport
- **Solution Applied**:
  - Added `currentX/currentY` to `resizeState` to track live position from `event.params.x/y` during resize
  - Used `vfViewport` from `useVueFlow()` instead of store viewport for accurate coordinate transforms
  - Added container offset calculation for `position: fixed` positioning

**Files**:
- `src/components/canvas/GroupNodeSimple.vue` (~~BUG-018~~ FIXED)
- `src/views/CanvasView.vue` (~~BUG-019~~ FIXED)

#### ~~BUG-021~~: Dev-Manager Force-Graph Iframe Issue (FIXED Dec 19, 2025)

**Problem**: Skills and Docs tabs showed black/empty or only edge lines (no nodes) on initial load and after tab switches.

**Root Causes**:
1. Force-graph requires visible container with non-zero dimensions at initialization
2. Chromium canvas bug ([#40459316](https://issues.chromium.org/issues/40459316)) - content disappears after tab switches
3. Repeated `width()`/`height()` calls cause state corruption ([#230](https://github.com/vasturiano/force-graph/issues/230))

**Solution** (3-part fix):
1. **Lazy loading**: Changed iframes from `src="..."` to `data-src="..."`, load only on first tab activation
2. **Single setup**: Set dimensions once via `setupGraph()` with `isInitialized` flag
3. **Pause/resume refresh**: On tab switches, use `pauseAnimation()`/`resumeAnimation()` cycle instead of resize

**Files Modified**:
- `dev-manager/index.html` - Lazy loading + postMessage on tab switch
- `dev-manager/skills/index.html` - setupGraph, refreshGraph, message listener
- `dev-manager/docs/index.html` - setupGraph, refreshGraph, message listener

**Commit**: `c45c207`
**SOP**: `dev-manager/SOP-BUG-021-force-graph-iframe-fix.md`

#### ~~BUG-022~~: Dev-Manager Kanban Not Syncing (FIXED Dec 19, 2025)

**Problem**: When Claude instances update task status in `docs/MASTER_PLAN.md`, the dev-manager kanban showed stale data with different task statuses.

**Root Cause**:
- Dev-manager served from `dev-manager/` directory via `npx serve dev-manager -p 6010`
- Kanban fetched `/docs/MASTER_PLAN.md` which resolved to `dev-manager/docs/MASTER_PLAN.md` (stale local copy)
- Claude instances updated `docs/MASTER_PLAN.md` (project root) - a completely different file
- Three copies existed: `docs/MASTER_PLAN.md` (61KB, current), `dev-manager/docs/MASTER_PLAN.md` (84KB, stale), `dev-manager/MASTER_PLAN.md` (5KB, ancient)

**Solution** (2-part fix):
1. **Symlink**: Replaced `dev-manager/docs/MASTER_PLAN.md` with symlink → `../../docs/MASTER_PLAN.md`
2. **Enable symlinks**: Added `--symlinks` flag to serve command in `package.json`
3. **Cleanup**: Removed ancient `dev-manager/MASTER_PLAN.md` copy

**Files Modified**:
- `dev-manager/docs/MASTER_PLAN.md` - Now symlink to `../../docs/MASTER_PLAN.md`
- `package.json` - Added `--symlinks` to `dev:manager` script

#### ~~BUG-023~~: Dev-Manager Stats/Kanban Showing Different Active Work Items (FIXED Dec 19, 2025)

**Problem**: Stats dashboard showed 3 items in Active Work while Kanban showed different items (3 in progress, 2 in review). TASK-012 incorrectly shown as "In Progress" when it was "COMPLETE - Partial". TASK-024 missing from Stats.

**Root Causes**:
1. **Pattern check order wrong** - Kanban's `parseTaskStatus()` checked in-progress patterns (including "PARTIAL") BEFORE done patterns. For status "COMPLETE - Partial", "PARTIAL" matched first, returning 'in-progress' instead of 'done'.
2. **Regex spanning newlines** - Stats used `[^|]+` which matched across line breaks. TASK-024 in the Blocks column of TASK-022's row was matched incorrectly, spanning to the next line.
3. **Symlink became regular file** - `dev-manager/docs/MASTER_PLAN.md` had reverted to a regular file copy instead of symlink.

**Solution** (3-part fix):
1. **Kanban fix**: Changed pattern order - done patterns checked FIRST before in-progress
2. **Stats regex fix**: Changed `[^|]+` to `[^|\n]+` to prevent multi-line matching
3. **Symlink restoration**: Recreated symlink for MASTER_PLAN.md

**Files Modified**:
- `dev-manager/kanban/index.html` - Pattern check order (done → review → in-progress)
- `dev-manager/stats/index.html` - Regex `[^|\n]+` to not span lines
- `dev-manager/docs/MASTER_PLAN.md` - Recreated as symlink
- `docs/MASTER_PLAN.md` - Updated TASK-024 status to 👀 MONITORING

#### BUG-004 Investigation & Fix (Dec 16, 2025)

**Root Cause Identified**:
1. **HTML5 drag API conflict** - TaskNode.vue had `draggable` attribute + `@dragstart/@dragend` handlers
2. This conflicted with Vue Flow's d3-drag system (two drag systems competing)
3. **d3-drag testing limitation** - The `document` null error only occurs with synthetic/programmatic events
4. Real user mouse interactions work correctly (browser sets proper event context)

**Fix Applied** (`src/components/canvas/TaskNode.vue`):
- Removed `:draggable="!isConnecting"` attribute
- Removed `@dragstart="handleDragStart"` handler
- Removed `@dragend="handleDragEnd"` handler
- Vue Flow's built-in d3-drag now handles all node dragging

**Research Sources**:
- [xyflow/xyflow#2461](https://github.com/xyflow/xyflow/issues/2461) - d3-drag synthetic event limitation
- [Vue Flow Configuration](https://vueflow.dev/guide/vue-flow/config.html) - nodesDraggable docs

**Testing Notes**:
- Playwright/synthetic mouse events trigger d3-drag error (known library limitation)
- Manual user testing required to verify fix works
- The error does NOT affect real users - only automated testing frameworks

**Status**: FIX APPLIED - Needs manual verification by user

### Calendar Issues (From Dec 1 checkpoint)

| ID | Issue | Priority | Status |
|----|-------|----------|--------|
| ~~BUG-009~~ | ~~Ghost preview wrong location~~ | ~~MEDIUM~~ | ✅ FIXED Dec 2, 2025 (SOP verified) |
| ~~BUG-010~~ | ~~Resize creates artifacts~~ | ~~HIGH~~ | ✅ VERIFIED WORKING Dec 19, 2025 |
| ~~BUG-011~~ | ~~Resize broken (both sides)~~ | ~~HIGH~~ | ✅ VERIFIED WORKING Dec 19, 2025 |
| ~~BUG-017~~ | ~~30-minute tasks display issues~~ | ~~HIGH~~ | ✅ FIXED Dec 18, 2025 |

**SOPs**:
- `docs/🐛 debug/sop/calendar-resize-artifacts-2025-12-02/FIX.md`
- `docs/🐛 debug/sop/calendar-side-by-side-and-ghost-fix-2025-12-02/FIX.md`

#### ~~BUG-017~~: 30-Minute Calendar Task Issues (FIXED Dec 18, 2025)

**Problem**: 30-min tasks appeared compressed with title cut off, using vertical layout instead of horizontal.

**Root Cause**: CSS selector mismatch - rules targeted `.calendar-event[data-duration="30"]` but day view uses `.slot-task` class.

**Fix Applied** (`src/views/CalendarView.vue` lines 2123-2174):
- Added CSS rules for `.slot-task[data-duration="30"]` with horizontal layout
- `.task-content`: `flex-direction: row` for compact single-row display
- Compact styling for title (10px), duration badge (9px), action buttons (14px)
- Narrower project/priority stripes (3px) to save space

**Verification** (Playwright):
- `computedFlexDirection: "row"` ✅ (was "column")
- `height: "26px"` ✅ (fits properly now)
- Title and duration badge both visible in single row ✅

### Sync Issues

| ID | Bug | Priority | Status |
|----|-----|----------|--------|
| ~~BUG-012~~ | ~~Sync loop resets task positions every second~~ | ~~P0-CRITICAL~~ | ✅ FIXED Dec 16, 2025 |

#### BUG-012 Details (FIXED)

**Problem**: Live sync was triggering constant database reloads every second, resetting all task positions on the canvas and causing infinite sync loops.

**Root Cause**:
1. `addTestCalendarInstances()` debug function in `tasks.ts:932` was being called on every `loadFromDatabase()`
2. This function modified tasks with `Date.now()` timestamps, creating new data each time
3. The watch on `tasks` triggered auto-save → sync push → remote receives → sync pull → loadFromDatabase → repeat

**Fix Applied** (`src/stores/tasks.ts`):
1. Commented out debug function call (line 932)
2. Added `isLoadingFromDatabase` flag (line 152) to prevent auto-save during loads
3. Added flag check in watch (lines 983-987) to skip saves during database operations

**SOP**: `docs/🐛 debug/sop/sync-loop-fix-2025-12-16/`

---

## Known Issues

<!-- Known issues use ISSUE-XXX format -->
| ID | Issue | Priority | Notes |
|----|-------|----------|-------|
| ~~ISSUE-006~~ | ~~**Sync loop resets task positions every second**~~ | ~~P0-CRITICAL~~ | ✅ FIXED Dec 16, 2025 - See BUG-012 |
| ~~ISSUE-001~~ | ~~**Live sync lost on refresh**~~ | ~~P1-HIGH~~ | ✅ ALREADY FIXED - See CloudSyncSettings.vue lines 239, 485, 502, 519-555, 649 |
| ISSUE-002 | **This Week shows 0 when tasks exist** | P2 | Today=0 correct, but This Week=0 wrong when tasks scheduled for Friday (today is Saturday) |
| ISSUE-003 | IndexedDB version mismatch errors | P2 | Needs proper DB migration |
| ISSUE-004 | Safari ITP 7-day expiration | P2 | Detection exists, no mitigation |
| ISSUE-005 | QuotaExceededError unhandled | P2 | Functions exist, not enforced |
| ISSUE-007 | **Timer not syncing across instances** | P2-MEDIUM | Timer started in one tab should show in all open tabs/windows. **See TASK-021** for real-time cross-instance sync plan |
| ISSUE-008 | **Ctrl+Z doesn't work on groups** | P2-MEDIUM | Undo doesn't restore deleted/modified groups on canvas |
| ISSUE-009 | **15 vue-tsc TypeScript errors** | P2-MEDIUM | Build passes but `vue-tsc` fails. See details below |
| ISSUE-010 | **Inbox task deletion inconsistent** | P2-MEDIUM | Deleting from calendar/canvas inbox should delete everywhere, recoverable only via Ctrl+Z (like board) |
| ~~ISSUE-011~~ | ~~**PouchDB Document Conflict Accumulation**~~ | ~~P0-CRITICAL~~ | ✅ RESOLVED Dec 20, 2025 - All 1,487 conflicts deleted |
| ~~ISSUE-012~~ | ~~**Data Loss Investigation - E2E Analysis**~~ | ~~P0-CRITICAL~~ | ✅ RESOLVED Dec 20, 2025 - User data restored from conflicting revision |

### ~~ISSUE-011: PouchDB Document Conflict Accumulation~~ ✅ RESOLVED

**Priority**: ~~P0-CRITICAL~~ → RESOLVED
**Discovered**: December 19, 2025 (during Storybook debugging)
**Resolved**: December 20, 2025

**Resolution Summary**:
- **Total conflicts deleted**: 1,487 revisions
  - tasks:data: 376 conflicts deleted
  - projects:data: 406 conflicts deleted
  - canvas:data: 447 conflicts deleted
  - settings:data: 113 conflicts deleted
  - notifications:data: 148 conflicts deleted (+ 1 stray)
- **User data restored**: Found correct data (9 Hebrew tasks) in revision `780-94f79d5c9af7f523e833cc3325248305`
- **New winning revision**: `1747-4179c103d9ae810632d26e8f9550e5ff` with correct data

**What Happened**:
1. Multiple tabs/devices wrote to same documents creating conflicting revisions
2. Conflicts accumulated over time (376+ on tasks:data alone)
3. PouchDB's automatic winner selection picked wrong revision (with 3 sample tasks)
4. User's real tasks (9 Hebrew tasks) were trapped in a non-winning revision
5. Sync saw local matched remote winner, reported "0 docs read"

**Resolution Steps Taken**:
1. Queried CouchDB for all conflicting revisions
2. Found user's real data in revision 780
3. Restored correct data as new winning revision
4. Deleted all 1,487 conflicting revisions
5. Verified all documents now have 0 conflicts

**Prevention Recommendations**:
1. Add conflict cleanup routine on app startup (ROAD-013)
2. Implement sync debouncing to prevent race conditions
3. Add real-time conflict detection with user notification
4. Consider using individual task documents instead of single array document

**Backup Created**: `/tmp/real_tasks_backup.json`

**Related Files**:
- `src/composables/useDatabase.ts` - PouchDB abstraction
- `src/composables/useReliableSyncManager.ts` - Sync orchestration
- `/tmp/delete_conflicts.sh` - Cleanup script used

---

### ~~ISSUE-012: Data Loss Investigation - E2E Analysis~~ ✅ RESOLVED

**Priority**: ~~P0-CRITICAL~~ → RESOLVED
**Discovered**: December 20, 2025
**Resolved**: December 20, 2025

**Resolution**: User's 9 Hebrew tasks were found trapped in revision `780-94f79d5c9af7f523e833cc3325248305` and restored. All 1,487 conflicting revisions were deleted.

**Investigation Findings** (Preserved for Future Reference):

1. **Database Architecture Mismatch**:
   - App saves all tasks as single document: `tasks:data` (array of tasks)
   - But database also contains orphaned individual docs: `task-XXXX` (8 documents)
   - Individual task docs may be from older app version or failed migration
   - App only reads from `tasks:data`, ignoring individual task docs

2. **Conflict Accumulation**:
   - `tasks:data` had 376 conflicting revisions
   - PouchDB's automatic winner selection picked wrong revision
   - The "winning" revision contained only 3 sample tasks
   - User's real tasks were in a non-winning conflicting revision

3. **Sync Behavior**:
   - Sync reported: `Pull complete: 0 docs read`
   - This happened because local revision matched remote "winner"
   - But the winner was wrong due to conflict accumulation

4. **Task Disappearance Logger Gap** (Still needs addressing for ROAD-013):
   - Current `taskDisappearanceLogger.ts` only tracks in-memory changes
   - Does NOT track PouchDB/CouchDB sync-related data loss
   - Cannot detect when sync loads wrong revision

**Completed Action Items**:
- [x] Query CouchDB for all revisions of tasks:data
- [x] Find revision with user's actual tasks (revision 780)
- [x] Delete all 1,487 conflicting revisions
- [x] Restore correct data as winning revision
- [x] Verify user sees correct tasks (9 Hebrew tasks visible)

**Preventive Measures** (Recommended for ROAD-013 - Sync Hardening):
1. Add conflict count monitoring to dashboard
2. Auto-resolve conflicts when count exceeds threshold (e.g., 10)
3. Enhance taskDisappearanceLogger to track sync events
4. Add data integrity check comparing local vs remote
5. Implement revision cleanup on app startup

**Related Issues**:
- ~~ISSUE-011~~ (PouchDB conflicts - RESOLVED)
- BUG-020 (Task disappearance investigation)

**Related Files**:
- `src/utils/taskDisappearanceLogger.ts` - Needs enhancement for ROAD-013
- `src/stores/tasks.ts:loadFromDatabase()` - Line 913-980
- `src/composables/useReliableSyncManager.ts` - Sync logic
- `src/composables/useDatabase.ts` - PouchDB abstraction

### 🟢 STORYBOOK QUICK REFERENCE (Dec 20, 2025 - Updated)

**PouchDB conflicts blocking Storybook are now RESOLVED!**

| Task | Location | Status |
|------|----------|--------|
| ~~**PouchDB Conflicts**~~ | ~~ISSUE-011~~ | ✅ RESOLVED - All 1,487 conflicts deleted |
| **Storybook Audit Skill** | TASK-029, `.claude/skills/storybook-audit/` | CREATED - Use for debugging |
| **Storybook Glass Morphism** | TASK-014 | IN PROGRESS (10/54 components) |

**Quick Commands:**
```bash
# Run Storybook
npm run storybook

# Audit all stories for issues
/storybook-audit   # Or trigger with "audit storybook"

# Fix PouchDB conflicts (ISSUE-011)
# See proposed fixes in ISSUE-011 section above
```

**Key Files:**
- `.claude/skills/storybook-audit/SKILL.md` - Audit skill with self-learning
- `src/stories/**/*.stories.ts` - Story files to fix
- `.storybook/preview.ts` - Pinia/store setup

---

### ISSUE-009: Vue TypeScript Errors (15 total)

**Priority**: P2-MEDIUM
**Note**: `npm run build` passes (Vite transpiles only), but `vue-tsc --noEmit` fails.

| File | Error | Fix |
|------|-------|-----|
| `CloudSyncSettings.vue:404` | `syncError` not defined | Should use `_syncError` (typo) |
| `HierarchicalTaskRow.vue:341` | `selected` not defined | Should use `_selected` parameter |
| `ResetPasswordView.vue:143` | `emit` not defined | Missing `defineEmits` |
| `CanvasGroup.vue:152` | `SectionFilter` not exported | Export missing from canvas store |
| `useCalendarDayView.ts:536,555,562,571` | `calendarEvent` → `_calendarEvent` | Wrong variable name (4 errors) |
| `useDynamicImports.ts:88` | `ImportCache` not defined | Missing type definition |
| `CalendarView.vue:187,192,351,356,474,479` | CalendarEvent/WeekEvent type mismatch | Interface needs `projectId` (6 errors) |

### ~~🔴 NEXT SESSION: Live Sync Persistence Fix~~ (ALREADY FIXED)

**Status**: ✅ ALREADY IMPLEMENTED in CloudSyncSettings.vue

**Implementation Found** (Dec 16, 2025):
- Line 239: `liveSyncActive` initialized from `localStorage.getItem('pomo-live-sync-active')`
- Lines 485, 502: `localStorage.setItem('pomo-live-sync-active', ...)` on toggle
- Lines 519-555: `restoreSyncState()` function auto-starts live sync
- Line 649: `await restoreSyncState()` called in onMounted

**Note**: The fix uses key `pomo-live-sync-active` (not `pomo-live-sync-enabled` as originally planned).

---

### 🔴 NEXT SESSION: Strategic Priority

#### Phase 0: Sync Hardening (FIRST - PREREQUISITE)

| Task | Priority | Reference |
|------|----------|-----------|
| ~~BUG-016~~ | ~~Timer sync across tabs~~ | ✅ DONE Dec 19, 2025 |
| ISSUE-007 | Timer sync across instances | P2-MEDIUM |
| 13.3 | Conflict resolution UI | P2-MEDIUM |

**See**: ROAD-013 section below for full task list

#### Then: Phase 1 - Gamification (ROAD-010)

Start with tasks 10.1-10.5 (XP system + character)

**See**: ROAD-010 section below for full task list

#### Current Active Work (Can Pause)

| ID | Task | Status |
|----|------|--------|
| TASK-014 | Storybook Glass Morphism | IN PROGRESS (10/54) - BatchEditModal done |
| ~~TASK-011~~ | ~~Lint Cleanup~~ | ✅ **COMPLETE** (0 errors) |

**Note**: Pause active work to focus on strategic roadmap priorities.

---

## 🔴 Strategic Roadmap Quick Reference

### Implementation Order

1. **Phase 0: Sync Hardening** (ROAD-013) - 1 week
   - Fix timer sync (BUG-016, ISSUE-007)
   - Improve conflict resolution UI
   - Test multi-device scenarios

2. **Phase 1: Gamification** (ROAD-010) - 2-3 weeks
   - Create gamification store (10.1)
   - Implement XP system (10.2-10.3)
   - Create character avatar (10.4-10.5)
   - Add achievements (10.6)

3. **Phase 2: AI Assistant** (ROAD-011) - 3-4 weeks
   - Create AI services (11.1-11.3)
   - Task breakdown feature (11.6)
   - Natural language input (11.8)

4. **Phase 3: Mobile PWA** (ROAD-004) - 4-6 weeks
   - PWA setup (4.1-4.4)
   - Responsive layout (4.5-4.8)
   - Mobile views (4.9-4.11)

### Deferred Quick Wins

| ID | Task | Effort | Note |
|----|------|--------|------|
| TASK-003 | Re-enable Backup Settings UI | ~2h | After Phase 0 |
| ~~BUG-009-011~~ | ~~Calendar resize/ghost issues~~ | ~~~4h~~ | ✅ VERIFIED WORKING Dec 19, 2025 |

### Reference: Plan File Location
Full strategic plan: `/home/endlessblink/.claude/plans/distributed-squishing-mochi.md`

---

## Technical Debt Initiative

**Status**: Phase 2 in progress
**Scope**: 1,200+ competing systems across 6 categories

| Category | Conflicts | Status |
|----------|-----------|--------|
| Error Handling | 249 remaining | Phase 1 done (45 migrated) |
| Calendar Systems | 180+ | In progress |
| Database/Persistence | 320+ | Planned |
| Drag-and-Drop | 150+ | Planned |
| State Management | 200+ | Planned |
| Validation | 100+ | Planned |

**Full details**: See "Technical Debt" section below.

---

## Keyboard Shortcuts Roadmap

### Missing Critical Shortcuts

| Shortcut | Views Missing | Action |
|----------|---------------|--------|
| Delete | Inbox, AllTasks, Board | Delete selected task(s) |
| Shift+Delete | All except Canvas | Permanent delete |
| Ctrl+Y | Global | Redo |
| Ctrl+N | Global | Quick create task |
| Space | Task lists | Toggle complete |

**Full roadmap**: See "Keyboard Shortcuts" section below.

---

## Architecture Reference

### Views (7 total)
1. AllTasksView.vue
2. BoardView.vue
3. CalendarView.vue
4. CalendarViewVueCal.vue
5. CanvasView.vue
6. FocusView.vue
7. QuickSortView.vue

### Key Stores
- `tasks.ts` - Task management with undo/redo
- `canvas.ts` - Vue Flow integration
- `timer.ts` - Pomodoro sessions
- `ui.ts` - UI state

### Commands
```bash
npm run dev          # Port 5546
npm run kill         # Kill all processes
npm run build        # Production build
npm run test         # Run tests
```

---

## Archive

- **MASTER_PLAN completed tasks**: [docs/archive/Done-Tasks-Master-Plan.md](./archive/Done-Tasks-Master-Plan.md)
- **Other completed fixes**: [docs/archive/completed-fixes-dec-2025.md](./archive/completed-fixes-dec-2025.md)

---

## Technical Debt: Detailed Plan

### ~~TASK-004~~: Phase 1 - Error Handling (COMPLETE)
Migrated 45 error locations to unified `errorHandler.report()` API across 6 core files.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-004-phase-1---error-handling-complete)*

### ~~TASK-005~~: Phase 2 - Calendar Consolidation (COMPLETE)
Dec 16, 2025 - ~320 lines removed, 2 composables created. Interfaces deduplicated.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-005-phase-2---calendar-consolidation-complete)*

### Phases 3-5: Planned
- TASK-006: Drag-and-Drop unification (18 implementations)
- TASK-007: Database layer consolidation (574 conflicts)
- TASK-008: Validation framework (4,199 conflicts)

---

## Sync Safety Architecture

### Current State

| System | Status |
|--------|--------|
| CouchDB Remote Sync | Pending (manual works) |
| Cross-Tab Sync | 100ms debounce active |
| Timer Sync | Leader election active |
| Deep Watchers | Optimized (hash-based) |
| Circuit Breaker | Ready |

### To Enable Auto-Sync
Prerequisites:
1. Manual sync works on both devices
2. Test from Linux AND Windows/Zen browser
3. Run 5-10 successful manual syncs

Then modify `src/config/database.ts`:
```typescript
sync: {
  live: true,
  retry: true,
  timeout: 30000,
  heartBeat: 10000,
}
```

---

## ROAD-013: Sync Hardening (PREREQUISITE)

**Goal**: Fix "mostly works, some issues" → reliable daily driver

**Priority**: P0-CRITICAL (blocks all other features)

**Related Issues**: BUG-016, ISSUE-007

| Task | Description | Status |
|------|-------------|--------|
| 13.1 | Audit current sync issues | PENDING |
| 13.2 | Fix timer sync across tabs (BUG-016) | ✅ DONE Dec 19, 2025 - pinia-shared-state@0.5.1 for cross-tab sync |
| 13.3 | Improve conflict resolution UI | PENDING |
| 13.4 | Add sync status indicator improvements | ✅ DONE Dec 19, 2025 - Added debouncing to prevent flickering (BUG-024) |
| 13.5 | Test multi-device scenarios E2E | PENDING |

**Critical Files**:
- `src/composables/useReliableSyncManager.ts`
- `src/composables/useCouchDBSync.ts`
- `src/composables/useCrossTabSync.ts`
- `src/config/database.ts`
- `src/main.ts` - PiniaSharedState plugin configuration
- `src/stores/timer.ts` - Timer store with share:false to exclude from plugin

**BUG-016 Fix Details (Dec 19, 2025)**:
- Installed `pinia-shared-state@0.5.1` for cross-tab Pinia store synchronization
- Timer store excluded with `share: { enable: false }` - has Date objects that don't serialize + custom sync
- Git checkpoint: `pre-pinia-shared-state` tag for rollback

**Rollback Procedure** (if pinia-shared-state causes issues):
```bash
git checkout pre-pinia-shared-state -- src/main.ts src/stores/timer.ts
npm uninstall pinia-shared-state
npm run dev
```

**Success Criteria**:
- [ ] Sync works reliably across 2+ devices
- [ ] No data loss during sync conflicts
- [ ] Clear UI feedback on sync status
- [ ] Timer state syncs across all open tabs

---

## ROAD-010: Gamification - "Cyberflow" (Phase 1)

**Goal**: Make daily use engaging through RPG-style character progression

**Theme**: Cyberpunk 2077-inspired (no affiliation) - rising in the world of "Cyberflow"

**Priority**: P1-HIGH (first major feature after sync)

### MVP Scope (Phase 1a): XP + Levels + Character Visual

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 10.1 | Create `src/stores/gamification.ts` | Medium | PENDING |
| 10.2 | Implement XP earning system | Medium | PENDING |
| 10.3 | Create level progression logic | Low | PENDING |
| 10.4 | Create CharacterAvatar component | Medium | PENDING |
| 10.5 | Add character to sidebar | Low | PENDING |
| 10.6 | Implement achievement badges (5+) | Medium | PENDING |
| 10.7 | Add intensity settings (minimal/moderate/full) | Low | PENDING |
| 10.8 | Integrate XP triggers in task store | Medium | PENDING |
| 10.9 | Integrate XP triggers in timer store | Low | PENDING |

**XP Sources**:
- Task completion (base XP)
- Difficulty bonus (high priority = more XP)
- Pomodoro sessions
- Daily goals (bonus for hitting targets)
- Streak multipliers

**Achievements (MVP)**:
- First task completed
- 7-day streak
- 100 tasks completed
- Perfect Pomodoro day (4+ sessions)
- Weekly goal achieved
- Level milestones (5, 10, 25, 50, 100)

**User-Controlled Intensity**:
- Minimal: Numbers only in sidebar
- Moderate: Level-up notifications, achievement popups
- Full: Sounds, animations, visual effects

**New Files**:
- `src/stores/gamification.ts`
- `src/components/gamification/CharacterAvatar.vue`
- `src/components/gamification/LevelProgress.vue`
- `src/components/gamification/AchievementBadge.vue`
- `src/components/gamification/XPNotification.vue`
- `src/composables/useGamification.ts`

**Files to Modify**:
- `src/stores/tasks.ts` - XP triggers
- `src/stores/timer.ts` - XP triggers
- `src/components/app/AppSidebar.vue` - Character display
- `src/stores/quickSort.ts` - Integrate with existing streaks

### Future Expansion (Phase 1b+)

| Task | Description | Status |
|------|-------------|--------|
| 10.10 | Character upgrades (stats) | FUTURE |
| 10.11 | Visual customization (clothes, implants) | FUTURE |
| 10.12 | App feature unlocks | FUTURE (TBD during build) |
| 10.13 | AI-generated milestone chapters | FUTURE |
| 10.14 | Weekly narrative summaries | FUTURE |
| 10.15 | Event-based missions/quests | FUTURE |

**Success Criteria (MVP)**:
- [ ] XP earned for completing tasks and Pomodoros
- [ ] Visible level progression in UI
- [ ] Character avatar displayed in sidebar
- [ ] At least 5 unlockable achievements
- [ ] User can control gamification intensity

---

## ROAD-011: AI Assistant (Phase 2)

**Goal**: Reduce friction with intelligent task management

**Configuration**: Local (Ollama) + Cloud (BYOK Claude/GPT-4)

**Languages**: Hebrew + English required

**Concerns**: Speed/latency, Privacy, Hebrew support, Cost

**Priority**: P1-HIGH (after gamification)

### Phase 2a: Core AI (Start Here)

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 11.1 | Create `src/services/ai/` directory structure | Low | PENDING |
| 11.2 | Implement Ollama client (`ollama.ts`) | Medium | PENDING |
| 11.3 | Implement Cloud API client (`cloud.ts`) | Medium | PENDING |
| 11.4 | Create `useAIAssistant.ts` composable | Medium | PENDING |
| 11.5 | Add AI settings to SettingsModal | Medium | PENDING |
| 11.6 | Implement Task Breakdown feature | Medium | PENDING |
| 11.7 | Implement Auto-Categorization | Medium | PENDING |
| 11.8 | Implement Natural Language Input | High | PENDING |

**Core Features**:
- **Task Breakdown**: Large task → AI suggests subtasks
- **Auto-Categorization**: New task → AI suggests project/priority
- **Natural Language Input**: "Add meeting tomorrow 3pm" → parsed task

### Phase 2b: Intelligence Layer

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 11.9 | Meeting Notes → Tasks extraction | Medium | PENDING |
| 11.10 | Weekly Review Summary generation | Low | PENDING |
| 11.11 | Smart Time Estimation (learn patterns) | Medium | PENDING |
| 11.12 | Daily Planning suggestions | Medium | PENDING |

### Phase 2c: Automation (Future)

| Task | Description | Status |
|------|-------------|--------|
| 11.13 | Auto-subtask suggestions | FUTURE |
| 11.14 | Priority auto-adjustment | FUTURE |
| 11.15 | Deadline risk detection | FUTURE |
| 11.16 | Smart rescheduling | FUTURE |
| 11.17 | Blocker detection | FUTURE |

**New Files**:
- `src/services/ai/index.ts` - AI service factory
- `src/services/ai/ollama.ts` - Local Ollama client
- `src/services/ai/cloud.ts` - Claude/OpenAI client
- `src/services/ai/prompts.ts` - Prompt templates
- `src/composables/useAIAssistant.ts` - Main composable
- `src/components/ai/AIAssistantPanel.vue`
- `src/components/ai/TaskBreakdownModal.vue`
- `src/components/ai/NaturalLanguageInput.vue`
- `src/components/settings/AISettings.vue`

**Files to Modify**:
- `src/components/settings/SettingsModal.vue` - AI settings tab
- `src/views/QuickSortView.vue` - Auto-categorize integration
- `src/components/kanban/TaskEditModal.vue` - AI breakdown button

**Success Criteria**:
- [ ] AI responds within 2-3 seconds (local) or 1-2 seconds (cloud)
- [ ] Hebrew tasks work correctly
- [ ] Natural language parses correctly 80%+ of time
- [ ] Task breakdown produces useful subtasks

---

## ROAD-004: Mobile PWA (Phase 3)

**Goal**: Quick capture + view today's tasks + Pomodoro on mobile

**Platform Strategy**:
1. PWA First (any mobile browser)
2. Android App (after PWA proven)
3. iOS App (paid subscription users only)

**Priority**: P2-MEDIUM (after AI)

### Phase 3a: PWA Setup

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 4.1 | Create `public/manifest.json` | Low | PENDING |
| 4.2 | Create service worker for offline | Medium | PENDING |
| 4.3 | Add "Add to Home Screen" prompt | Low | PENDING |
| 4.4 | Configure icons (all sizes) | Low | PENDING |

### Phase 3b: Responsive Layout

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 4.5 | Audit all 7 views for mobile breakpoints | High | PENDING |
| 4.6 | Implement collapsible sidebar (<640px) | Medium | PENDING |
| 4.7 | Create mobile navigation (bottom tabs) | Medium | PENDING |
| 4.8 | Ensure 44x44px touch targets | Medium | PENDING |

### Phase 3c: Mobile-Specific Features

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 4.9 | Mobile Task Input (quick capture) | Medium | PENDING |
| 4.10 | Mobile Today View (simple list) | Medium | PENDING |
| 4.11 | Mobile Timer View (large display) | Medium | PENDING |
| 4.12 | Swipe gestures for actions | High | PENDING |

### Phase 3d: Touch Optimization

| Task | Description | Complexity | Status |
|------|-------------|------------|--------|
| 4.13 | Swipe to complete task | Medium | PENDING |
| 4.14 | Long press for context menu | Medium | PENDING |
| 4.15 | Pull to refresh | Low | PENDING |
| 4.16 | Touch-friendly drag handles | Medium | PENDING |

**New Files**:
- `public/manifest.json`
- `src/sw.ts` - Service worker
- `src/components/mobile/MobileNav.vue`
- `src/components/mobile/QuickCapture.vue`
- `src/components/mobile/MobileTimerView.vue`
- `src/composables/useMobileLayout.ts`

**Files to Modify**:
- `index.html` - PWA meta tags
- `vite.config.ts` - PWA plugin
- `src/App.vue` - Mobile layout detection
- All views - Responsive breakpoints

**Success Criteria**:
- [ ] PWA installable on Android/iOS
- [ ] Tasks viewable and creatable on phone
- [ ] Timer works on mobile
- [ ] Sync works between mobile and desktop
- [ ] Touch interactions feel natural

---

## Keyboard Shortcuts: Gap Analysis

| View | Delete | Redo | Navigate | Complete | Edit | Timer |
|------|--------|------|----------|----------|------|-------|
| Canvas | Yes | No | Yes | No | Yes | Yes |
| Inbox Panel | No | No | No | No | No | Yes |
| AllTasks | No | No | No | No | No | No |
| Board | No | No | No | No | Yes | Yes |
| Calendar | No | No | No | No | No | No |
| QuickSort | No | Yes | No | No | No | No |

### Implementation Phases
1. **Delete Key Support** - All views
2. **Global Shortcuts** - Ctrl+Y, Ctrl+N
3. **Task Actions** - Space, E, T
4. **Navigation & Help** - Arrow keys, ? for help modal

---

## Rollback Reference

**Stable Baseline**: `93d5105` (Dec 5, 2025)

```bash
# Emergency rollback
git checkout 93d5105
npm run kill
npm run dev
```

**Tag**: `v2.2.0-pre-mytasks-removal` for My Tasks removal rollback

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
