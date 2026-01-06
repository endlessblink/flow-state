**Last Updated**: January 6, 2026 (TASK-105 Supabase Migration & Sync Fixes)
**Version**: 5.18 (Supabase Migration Complete)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Archive

- **January 2026 completed tasks**: [docs/archive/MASTER_PLAN_JAN_2026.md](./archive/MASTER_PLAN_JAN_2026.md)
- **Historical (2025) completed tasks**: [docs/archive/Done-Tasks-Master-Plan.md](./archive/Done-Tasks-Master-Plan.md)

---

## Current Status

| **Canvas** | ✅ **WORKING** | **Calendar** | ✅ Verified |
| **Sync** | ✅ **WORKING** | **Build/Tests** | ✅ **PASSING** |

---

## Roadmap

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| ~~ROAD-001~~ | ✅ **DONE** | Power Groups | [Details](./archive/Done-Tasks-Master-Plan.md) |
| **ROAD-013** | **Sync Hardening** | **P0** | 🔄 [See Detailed Plan](#roadmaps) |
| ROAD-004 | Mobile support (PWA) | P2 | [See Detailed Plan](#roadmaps) |
| ROAD-011 | AI Assistant | P1 | [See Detailed Plan](#roadmaps) |
| ~~ROAD-022~~ | ✅ **DONE** | Auth (Supabase)| [Details](./archive/MASTER_PLAN_JAN_2026.md) |

---

## Active Work (Summary)

> [!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

---

<details>
<summary><b>Formatting Guide (For AI/Automation)</b></summary>

### Tasks
- `### TASK-XXX: Title (STATUS)`
- Use `(🔄 IN PROGRESS)`, `(✅ DONE)`, `(📋 PLANNED)`.
- Progress: Checked boxes `- [x]` calculate % automatically.

### Priority
- `P1-HIGH`, `P2-MEDIUM`, `P3-LOW` in header or `**Priority**: Level`.
</details>

<details id="roadmaps">
<summary><b>Detailed Feature Roadmaps</b></summary>

### ROAD-013: Sync Hardening (🔄 IN PROGRESS)
1. Audit current sync issues.
2. Fix conflict resolution UI.
3. Test multi-device scenarios E2E.

### ROAD-010: Gamification - "Cyberflow"
- **XP Sources**: Task completion, Pomodoro sessions, Streaks.
- **Features**: Leveling, Badges, Character Avatar in Sidebar.

### ROAD-011: AI Assistant
- **Features**: Task Breakdown, Auto-Categorization, NL Input ("Add meeting tomorrow 3pm").
- **Stack**: Local (Ollama) + Cloud (Claude/GPT-4).

### ROAD-004: Mobile PWA 
- **Phases**: PWA Manifest → Responsive Layout → Bottom Nav → Mobile Today View.
</details>

<details id="active-task-details">
<summary><b>Active Task Details</b></summary>

### ~~TASK-099~~: Auth Store & Database Integration (✅ DONE)
- [x] Integration with Supabase.
- [x] Refactor `useAuthStore.ts` and `useDatabase.ts`.
- [x] Migrated from PouchDB/CouchDB to Supabase.

### TASK-017: KDE Plasma Widget (Plasmoid) (READY)
- Create a KDE Plasma 6 taskbar widget.

### TASK-039: Duplicate Systems Consolidation (📋 PLANNED)
- Consolidate conflict resolution and backup systems.

### TASK-041: Implement Custom Recurrence Patterns (📋 PLANNED)
- Define custom recurrence syntax and parsing logic.

### TASK-046: Establish Canvas Performance Baselines (📋 PLANNED)
- Establishment of latency metrics using `performanceBenchmark.ts`.

### TASK-065: GitHub Release (📋 TODO)
- Remove hardcoded CouchDB credentials.
- Add Docker self-host guide to README.
- Create MIT LICENSE.

### TASK-079: Tauri Desktop (📋 PLANNED)
- System Tray (icon + menu).
- KDE Taskbar Progress (D-Bus).
- Fokus-style Break Splash Screen.

### TASK-095: Complete TypeScript & Lint Cleaning (🔄 IN PROGRESS)
- [x] Stabilize merged PRs (17 PRs merged & verified).
- [ ] Address remaining TS/Lint errors system-wide.

### ~~TASK-100~~: Implement Overdue Smart Group in Canvas (✅ DONE)
- Create "Overdue" smart group logic.
- Implement auto-collection of overdue non-recurring tasks.

### TASK-096: System Refactor Analysis (📋 TODO)
- Analyze codebase for refactoring opportunities.

### ~~TASK-101~~: Store Safety Pattern (`_raw*` prefix) (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [TASKS-raw-safety-pattern.md](./sop/active/TASKS-raw-safety-pattern.md)

Implemented architectural safety pattern across all Pinia stores to prevent accidental display of soft-deleted or hidden items in UI components.

**Changes**:
- [x] `tasks.ts`: Renamed `tasks` → `_rawTasks`, created `filteredTasks` computed
- [x] `notifications.ts`: Renamed to `_rawNotifications`, created filtered `notifications`
- [x] `canvas.ts`: Renamed `groups` → `_rawGroups`, created `visibleGroups` (filters `isVisible !== false`)
- [x] `projects.ts`: Renamed to `_rawProjects`, created computed `projects` (future-proofed)
- [x] Deleted 6 dead code files (legacy sync/migration code)
- [x] All mutations updated to use `_rawX.value`
- [x] Build verified passing

**Stores analyzed but not needing pattern**:
- `taskCanvas.ts` - utility store, no soft-delete
- `quickSort.ts` - historical session data
- `timer.ts` - timer session history

### ~~TASK-102~~: Fix Shift+Drag Selection (✅ DONE)
- Fixed "stuck" rubber-band selection.
- Fixed selection inside groups (absolute positioning).
- Moved selection box outside VueFlow for visual stability.

### ~~TASK-103~~: Debug Sync Error (Auth Guard) (✅ DONE)
- Fixed "User not authenticated" sync errors in Guest Mode.
- Implemented Auth Guards in `projects`, `tasks`, and `canvas` stores.

### ~~TASK-104~~: Fix Critical Notification Store Crash (✅ DONE)
- Fixed `ReferenceError: scheduledNotifications is not defined` in `notifications.ts`.

### ~~TASK-105~~: Supabase Migration & Sync Loop Fixes (✅ DONE)
**Priority**: P0-CRITICAL
**Completed**: January 6, 2026
**SOP**: [SYNC-supabase-circular-loop-fix.md](./sop/active/SYNC-supabase-circular-loop-fix.md)

Fixed critical bugs after Supabase migration causing app not to load and ghost projects.

**Root Causes Fixed**:
- [x] Supabase 400 errors from invalid UUID values (string 'undefined' sent to DB)
- [x] Circular sync loop: Realtime → store update → watcher → auto-save → realtime
- [x] Corrupted projects from `updateProjectFromSync` spreading incomplete data
- [x] Ghost/empty projects appearing in sidebar

**Changes**:
- [x] `supabaseMappers.ts`: Added UUID validation & sanitization helpers
- [x] `supabaseMappers.ts`: Sanitize `parent_id`, `project_id`, `parent_task_id` fields
- [x] `projects.ts`: Added `syncUpdateInProgress` flag to break circular loop
- [x] `projects.ts`: `updateProjectFromSync` now validates incoming data
- [x] `projects.ts`: `projects` computed filters out corrupted entries
- [x] `projects.ts`: Added `cleanupCorruptedProjects()` utility
- [x] `supabaseMigrationCleanup.ts`: Added `clearAllLocalData()` helper
- [x] Deleted 18+ legacy PouchDB/CouchDB files (~10,000 lines removed)
- [x] Build verified passing

**Files Deleted** (legacy code removal):
- `useCouchDBSync.ts`, `useConflictPruning.ts`, `useCrossTabCoordination.ts`
- `useDatabaseHealthCheck.ts`, `conflictDetector.ts`, `conflictResolution.ts`
- `debugHelper.ts`, `legacyStorageCleanup.ts`, `migratePouchToSql.ts`
- `SqlCanvasStore.ts`, `SqlProjectStore.ts`, `SqlTaskStore.ts`
- `PowerSyncConnector.ts`, `PowerSyncDatabase.ts`, `SqlDatabaseTypes.ts`
- Various mapper files (`groupMapper.ts`, `projectMapper.ts`, `taskMapper.ts`)

</details>

<details>
<summary><b>Rollback & Reference</b></summary>

**Stable Baseline**: `93d5105` (Dec 5, 2025)
**Tag**: `v2.2.0-pre-mytasks-removal`

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
</details>
