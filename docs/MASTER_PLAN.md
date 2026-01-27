# FlowState MASTER_PLAN.md

> **Last Updated**: January 27, 2026
> **Token Target**: <25,000 (condensed from ~50,000)
> **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md`

---

## Active Bugs (P0-P1)

### BUG-1097: Due Date Not Persisting from Edit Modal (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS (2026-01-27)

**Symptoms**:
1. Due date in Edit Task modal shows previous date, not current - even after opening modal on task WITH a date
2. Due date changes from modal don't persist on refresh
3. Canvas overdue reschedule badge updates card display but doesn't save to database

**Investigation**: `TaskEditMetadata.vue` logging traces date values through flow.

**Files**: `src/components/tasks/TaskEditMetadata.vue`, `src/composables/tasks/useTaskEditActions.ts`

---

### BUG-1099: VPS: Done Tasks Not Filtered Until Refresh - ReferenceError (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS (2026-01-27)

**Problem**: On VPS production (in-theflow.com), completed/done tasks appear on canvas when they should be hidden. They only disappear after a page refresh.

**Console Error**:
```
ReferenceError: can't access lexical declaration 'xe' before initialization
    xe https://in-theflow.com/assets/CanvasView-DB2EuB-i.js:27
```

**Root Cause Analysis**: The minified CanvasView bundle has a JavaScript initialization error, likely caused by:
1. Circular dependency between modules
2. Vite/Rollup minification issue with variable hoisting
3. Temporal dead zone violation in bundled code

**Related Bugs**: BUG-1097 (due date persistence) - may share same root cause with build/sync issues

**Investigation Steps**:
1. Check for circular imports in canvas-related files
2. Review recent changes to CanvasView.vue and its imports
3. Test with `npm run build && npm run preview` locally to reproduce
4. Check if error appears in development mode
5. Consider using `vite-plugin-circular-dependency` to detect cycles

**Files to Investigate**: `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasFilteredState.ts`, `src/composables/canvas/useCanvasOrchestrator.ts`, `vite.config.ts`

---

### BUG-1086: VPS/PWA Auth Not Persisting + Blank Screen (👀 REVIEW)

**Priority**: P0-CRITICAL | **Status**: 👀 REVIEW (2026-01-26)
**SOP**: `docs/sop/SOP-035-auth-initialization-race-fix.md`

**Root Cause**: Triple auth initialization race condition - 3 places called `authStore.initialize()` simultaneously.

**Fixes Applied**:
1. Removed fire-and-forget init from `AppSidebar.vue`
2. Added promise lock (`initPromise`) in `auth.ts`
3. Added `handledSignInForUserId` guard for duplicate `SIGNED_IN` events

**Files**: `src/stores/auth.ts`, `src/layouts/AppSidebar.vue`

**Verification Pending**: User must confirm single init log, sign-in persistence across refresh/browser close.

---

### BUG-1061: Canvas Position Drift on Cross-Browser Sync (👀 REVIEW)

**Priority**: P0-CRITICAL | **Status**: 👀 REVIEW (2026-01-25)

**Problem**: Tasks appear in different positions across browser tabs.

**Existing Protections** (all implemented):
| Protection | Location |
|------------|----------|
| Timestamp comparison | `tasks.ts:195` |
| Manual operation lock | `tasks.ts:190-191` |
| Drag/resize locks | `useAppInitialization.ts:128-132` |
| PositionManager locks | `PositionManager.ts:36-38` |

**Fixes Applied** (5 total):
1. **Fix #1**: Added `positionVersion` comparison in `updateTaskFromSync` (`tasks.ts`)
2. **Fix #2**: Read `parentId` from store, not PositionManager (`useCanvasSync.ts`)
3. **Fix #3**: Skip parentId recalc when task follows parent group (`useCanvasInteractions.ts`)
4. **Fix #5**: `canvasSyncInProgress` flag blocks spurious `onNodeDragStop` (`useCanvasSync.ts`, `useCanvasInteractions.ts`)

**Verification**: Console shows `[DRAG-STOP-BLOCKED]` when spurious calls blocked.

---

### BUG-352: Mobile PWA "Failed to Fetch" (📋 PLANNED)

**Priority**: P0-CRITICAL | **Status**: 📋 PLANNED

Mobile device fails to fetch on fresh browser. Potential causes: SSL/Cert issue with `sslip.io`, mobile-specific hardcoded localhost, stricter CORS.

---

### BUG-347: FK Constraint Violation on parent_task_id (👀 REVIEW)

**Priority**: P1 | **Status**: 👀 REVIEW (2026-01-21)

**Root Cause**: Tasks saved with `parent_task_id` refs to deleted tasks, no existence validation, race conditions in batch upserts.

**Solution**: Catch-and-retry on FK error code `23503` - clear parent refs and retry once. Applied in `useSupabaseDatabase.ts` (`saveTask()`, `saveTasks()`).

---

### BUG-309: Ctrl+Z Keyboard Shortcut Not Triggering Undo (👀 REVIEW)

**Priority**: P1-HIGH | **Status**: 👀 REVIEW (2026-01-17)

**Fix Applied**: Added `executeUndo()`, `executeRedo()`, `executeNewTask()` calls + `shouldIgnoreElement()` check in `src/utils/globalKeyboardHandlerSimple.ts`.

---

### BUG-1101: Route Navigation Crashes on Module Load Failure (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-01-27)

**Problem**: When Vite server disconnects or dynamic imports fail, Vue Router throws uncaught `TypeError: Failed to fetch dynamically imported module` with no graceful error handling.

**Observed Behavior**:
1. `[vite] server connection lost. Polling for restart...`
2. User navigates to a route (e.g., Board view)
3. `Failed to load resource: net::ERR_CONNECTION_REFUSED`
4. `TypeError: Failed to fetch dynamically imported module` (uncaught)
5. `[Vue Router warn]: uncaught error during route navigation`
6. Navigation fails silently - no user feedback

**Expected Behavior**: Show error boundary/fallback UI when route modules fail to load, with "Reload" button option.

**Fix Approach**:
1. Add global error handler for dynamic import failures in `router/index.ts`
2. Create `ErrorBoundary.vue` component for route-level errors
3. Add retry logic with exponential backoff for failed imports

**Files**: `src/router/index.ts`, `src/components/ErrorBoundary.vue` (CREATE), `src/App.vue`

---

### ~~BUG-1100~~: Shift+G Creates Group While Typing in Modals (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-27)

**Problem**: Canvas hotkey Shift+G (create group) triggered even when user was typing in the Create Task modal, preventing input of capital "G".

**Fix Applied**: Added input protection at the start of `handleKeyDown()` in `src/composables/canvas/useCanvasHotkeys.ts`:
- Checks for `INPUT`, `TEXTAREA`, `contentEditable` elements
- Checks for modal containers (`[role="dialog"]`, `.modal`, `.n-modal`, `.n-dialog`)
- Returns early to allow normal typing when in these contexts

**File Changed**: `src/composables/canvas/useCanvasHotkeys.ts`

---

### BUG-1057: Fix Failing Unit Tests (📋 PLANNED)

**Priority**: P3 | **Status**: 📋 PLANNED

8 test failures to fix (excluding 13 canvas-characterization tests that require dev server):

| Test | Fix |
|------|-----|
| `canvas-resize-test*.ts` | Move to `tests/e2e/` |
| `bug-153-containment.test.ts` | Delete or restore util |
| `smoke.test.ts` | Add missing Vitest import |
| `css-syntax.test.ts`, `vue-imports.test.ts` | Fix `fileURLToPath` import |
| `tasks.test.ts` | Update default project ID |
| `repro-bug-030.test.ts` | Fix filter logic |

---

### BUG-025: Unrelated Groups Move with Parent (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

Dragging a group causes unrelated groups to move. Location: `useCanvasDragDrop.ts` parentGroupId logic.

---

## Active Tasks (IN PROGRESS)

### TASK-1060: Infrastructure & E2E Sync Stability (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (Started: 2026-01-24)

**Problem**: Intermittent sync failures across Web, Tauri, PWA, KDE Widget - 0 tasks shown, WebSocket 403 errors, SIGTERM exits.

**Root Causes Found**:
1. CI/CD `deploy.yml` was killing System Caddy, starting Docker Caddy (conflict)
2. SWR cache not invalidated on auth change (fixed in BUG-1056)

**Infrastructure Fixes Applied** (2026-01-24):
- Docker stack stopped, System Caddy re-enabled
- Fixed `deploy.yml` - static files only, graceful Caddy reload
- Added Caddy systemd auto-restart config

**Remaining Phases** (condensed):
- [ ] Phase 1.3: Verify JWT keys in `/opt/supabase/docker/.env`
- [ ] Phase 2: Auth flow audit, WebSocket stability tests
- [ ] Phase 3: Tauri debug (SIGTERM causes, auth stability)
- [ ] Phase 4: PWA service worker audit
- [ ] Phase 5: KDE widget sync verification
- [ ] Phase 6: Cross-platform E2E matrix test

**Success Criteria**: Caddy 24h+ uptime, no 0-task loads, Tauri no SIGTERM, PWA overnight persistence.

**Key Files**: `/etc/caddy/Caddyfile`, `src/stores/auth.ts`, `src/composables/useSupabaseDatabase.ts`, `src-tauri/src/lib.rs`, `kde-widget/package/contents/ui/main.qml`

---

### TASK-1087: KDE Widget - Task Readability + Active Task Highlight (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-01-26)

**Changes Made**:
- [x] Added `currentTaskId` property for active timer task
- [x] Increased task row height (44-64px dynamic)
- [x] Added 2-line text wrap with RTL support
- [x] Added active task highlight (accent border + glow + pulse)
- [x] Added chronometer icon + bold text for active task

**Verification Pending**: Restart Plasma, test RTL Hebrew titles, test active highlighting.

**File**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### TASK-149: Canvas Group Stability Fixes (👀 REVIEW)

**Priority**: P0-CRITICAL | **Status**: 👀 REVIEW

**Problems**: Position jump during resize, zombie groups, tolerance snapping, inconsistent containment, group duplication.

**Diagnostics**: `assertNoDuplicateIds()` helper in `src/utils/canvas/invariants.ts`.

**Pending Fixes**: 4 (settling flag timing), 5 (remove tolerance snapping), 8 (zombie prevention).

---

### TASK-241: Position Versioning & Conflict Detection (✅ Phase 1 COMPLETE)

**Priority**: P0-CRITICAL | **Status**: ✅ Phase 1 COMPLETE

**Phase 1 Done**:
- [x] SQL migration for `position_version` auto-increment triggers
- [x] `src/utils/canvas/coordinates.ts` - position conversion source of truth
- [x] `src/composables/canvas/useCanvasOperationState.ts` - state machine

**Phase 2 Pending**:
- [ ] Run SQL migration in Supabase Dashboard
- [ ] Wire state machine into `useCanvasOrchestrator`
- [ ] Test: drag → refresh → verify position persists

---

### TASK-333: Independent Audit of Crisis Analysis (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS

QA Supervisor verification of January 20, 2026 Data Crisis. See `docs/reports/2026-01-20-auth-data-loss-analysis.md`.

---

## Planned Tasks (NEXT/BACKLOG)

### TASK-1002: Voice Transcription to Task (📋 NEXT)

**Priority**: P1 | **Status**: 📋 NEXT

Record audio → transcription API (Whisper/Deepgram) → create task. Mobile-first UX.

**Steps**: Research APIs, implement recording, create transcription service, add voice button, test mobile.

---

### TASK-359: Quick Add + Sort Feature (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW

Batch capture mode: `Ctrl+.` opens Quick Capture modal, type titles + Enter, Tab to sort phase, 1-9 assigns project.

**Files**: `src/composables/useQuickCapture.ts`, `src/components/quicksort/QuickCaptureModal.vue`

---

### FEATURE-1048: Canvas Auto-Rotating Day Groups (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

User-triggered rotation of day groups (Mon-Sun) with midnight notification.

**Key Files**: `src/composables/canvas/useDayGroupRotation.ts` (CREATE), `src/components/canvas/DayRotationBanner.vue` (CREATE)

---

### FEATURE-1023: Voice Input - Transcription + Task Extraction (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

Voice input → Web Speech API → NLP extracts task properties (priority, due date, project). Supports Hebrew + English.

**Subtasks**: TASK-1024 (Web Speech API), TASK-1025 (Mic Button), TASK-1026 (NLP Parser), TASK-1027 (Commands for Existing Tasks), TASK-1028 (Confirmation UI), TASK-1029 (Whisper Fallback)

---

### TASK-353: Design Better Canvas Empty State (📋 BACKLOG)

**Priority**: P3 | **Status**: 📋 BACKLOG

Current empty state is minimal. Add visual illustration, feature highlights, guest mode sign-in prompt.

**File**: `src/components/canvas/CanvasEmptyState.vue`

---

### Stress Test Suite (📋 PLANNED)

| Task | Description |
|------|-------------|
| TASK-362 | Sync conflict resolution (2 tabs editing, offline+online, race conditions) |
| TASK-363 | Auth edge cases (expired JWT, session timeout, concurrent sessions) |
| TASK-364 | WebSocket stability (disconnect, reconnect, subscribe cycles) |
| TASK-366 | Redundancy assessment (SPOF mapping, fallback testing) |

---

### Other Planned Tasks

| Task | Priority | Description |
|------|----------|-------------|
| TASK-292 | P3 | Canvas connection edge visuals (animations, gradients) |
| TASK-310 | P2 | Automated SQL backup to cloud storage |
| TASK-293 | P2 | Canvas viewport - center on Today + persist position |
| TASK-313 | P2 | Canvas multi-select batch status change |
| TASK-179 | P2 | Refactor TaskEditModal.vue (~1800 lines) |
| TASK-123 | P2 | Consolidate network status implementations |
| TASK-139 | P3 | Undo state persistence to localStorage |
| TASK-125 | P3 | Remove debug console.log (reduced scope) |
| TASK-065 | P3 | GitHub release (remove hardcoded creds, Docker guide) |
| TASK-079 | P3 | Tauri mobile (Android/iOS) |
| TASK-157 | P3 | ADHD-Friendly view redesign (Phases 2-4 pending) |

---

## Dev-Maestro Orchestrator (TASK-303)

**Status**: ⏸️ PAUSED | **SOP**: `docs/sop/SOP-010-dev-manager-orchestrator.md`

Enables Claude agents to implement code changes using git worktrees for isolation.

**Architecture**: User Goal → Questions → Plan → Execute (Worktrees) → Review → Merge/Discard

**Completed Subtasks**: ~~TASK-319~~ (output capture), ~~TASK-320~~ (completion detection), ~~TASK-323~~ (stale cleanup), ~~FEATURE-1012~~ (tech stack detection) - See archive.

### Pending Subtasks

| Task | Priority | Description |
|------|----------|-------------|
| TASK-321 | P2 | Test merge/discard workflow E2E |
| TASK-322 | P2 | Automatic error recovery (exponential backoff, partial progress) |
| FEATURE-1013 | P2 | Auto-detect data layer (Pinia, Supabase) |
| FEATURE-1014 | P2 | Smart questions with pros/cons |
| FEATURE-1015 | P2 | Project context caching |
| BUG-1019 | P0 | Swarm agent cleanup + OOM prevention |

**Key Files**: `~/.dev-maestro/server.js`, `~/.dev-maestro/kanban/index.html`

---

## Roadmaps

### ROAD-004: Mobile PWA (✅ DONE)

**Status**: ✅ DONE (2026-01-19) - All phases complete.

See archive for TASK-324, TASK-325, TASK-326 details.

---

### ROAD-013: Sync Hardening (✅ DONE)

**Status**: ✅ DONE (2026-01-14)

Implemented "Triple Shield" Drag/Resize Locks. Multi-device E2E moved to TASK-285.

---

### ROAD-010: Gamification - "Cyberflow" (⏸️ PAUSED)

**Priority**: P3 | XP sources, leveling, badges, character avatar.

---

### ROAD-011: AI Assistant (⏸️ PAUSED)

**Priority**: P3 | Task breakdown, auto-categorization, NL input. Stack: Ollama + Claude/GPT-4.

---

### ROAD-025: Backup Containerization (📋 PLANNED)

**Priority**: P3 | Move `auto-backup-daemon.cjs` into Docker container for VPS distribution.

---

## Task Dependency Index (PWA Prerequisites) - ✅ ALL COMPLETE

All blocking tasks (TASK-118, 119, 120, 121, 122) completed. See archive for details.

---

## Architecture Constraints

- **Geometry write policy**: Only drag handlers + explicit move actions may change `parentId`, `canvasPosition`, `parentGroupId`, `position`
- **Sync is read-only**: `syncStoreToCanvas` does NOT write to stores
- **Smart Groups metadata-only**: May update `dueDate`/`status`/`priority`, never geometry

---

## Formatting Guide

**Task Format**: `### TASK-XXX: Title (STATUS)` with `🔄 IN PROGRESS`, `✅ DONE`, `📋 PLANNED`

**Priority**: `P0-CRITICAL`, `P1-HIGH`, `P2-MEDIUM`, `P3-LOW`

**Progress**: Checked boxes `- [x]` calculate % automatically.

---

## References

- **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md` (completed tasks)
- **Code Review Archive**: `docs/archive/CODE_REVIEW_FINDINGS_JAN_2026.md`
- **Crisis Analysis**: `docs/reports/2026-01-20-auth-data-loss-analysis.md`

---

*Condensed January 27, 2026 - Reduced from ~2,300 lines to ~380 lines (84% reduction)*
