**Last Updated**: January 6, 2026 (TASK-095 TypeScript Cleanup)
**Version**: 5.20 (TypeScript Clean Baseline)
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

### ~~TASK-095~~: Complete TypeScript & Lint Cleaning (✅ DONE)
- [x] Address remaining TS/Lint errors system-wide (Zero errors baseline achieved).
- [x] Fix `ConflictResolutionDialog` and `SyncHealthDashboard` type mismatches.
- [x] Standardize auth store getters and component access.
- [x] Align Canvas store actions and exports.

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

### ~~BUG-001~~: Fix Shift+Drag Selection Inside Groups (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [CANVAS-shift-drag-selection-fix.md](./sop/active/CANVAS-shift-drag-selection-fix.md)

Fixed rubber-band (shift+drag) selection failing inside groups while working outside groups.

**Root Causes Fixed**:
- [x] CSS `:deep()` selector not working in unscoped style block (only works in scoped styles)
- [x] `useVueFlow()` returning stale viewport `{x:0, y:0, zoom:1}` in event handlers
- [x] Groups selected instead of tasks (selection logic didn't filter properly)
- [x] Ctrl+click not working for multi-selection on tasks
- [x] Click on empty space not clearing selection

**Changes**:
- [x] `CanvasView.vue`: Removed `:deep()` from unscoped CSS selector
- [x] `CanvasView.vue`: Added `handleCanvasContainerClick` for clearing selection
- [x] `useCanvasSelection.ts`: Added `getViewportFromDOM()` helper to read viewport from CSS transform
- [x] `useCanvasSelection.ts`: Added recursive `getAbsolutePosition()` for nested nodes
- [x] `useCanvasEvents.ts`: Added Ctrl/Meta+click support for group selection toggle
- [x] `TaskNode.vue`: Fixed Ctrl/Cmd/Shift+click for multi-select

**Key Learnings**:
- Vue Flow uses flat DOM structure - child nodes are NOT DOM children of parent nodes
- CSS `:deep()` only works in `<style scoped>`, not unscoped styles
- Read viewport from `.vue-flow__transformationpane` CSS transform for reliable values in event handlers

### ~~BUG-002~~: Fix Timer Session UUID Type Error (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [SYNC-timer-uuid-validation.md](./sop/active/SYNC-timer-uuid-validation.md)

Fixed PostgreSQL UUID type error when saving timer sessions: `invalid input syntax for type uuid: "1767688720801"`.

**Root Cause**:
- [x] Timer session ID was a Unix timestamp instead of UUID (likely from legacy/corrupted session)
- [x] `toSupabaseTimerSession()` mapper passed ID directly without validation
- [x] Supabase `timer_sessions.id` column requires valid UUID format

**Changes**:
- [x] `supabaseMappers.ts`: Added UUID validation to `toSupabaseTimerSession()`
- [x] `supabaseMappers.ts`: Added UUID validation to `toSupabaseQuickSortSession()`
- [x] Invalid IDs now auto-generate new UUIDs with warning logged

**Key Pattern**:
```typescript
const validId = isValidUUID(session.id) ? session.id : crypto.randomUUID()
```

### ~~TASK-106~~: Canvas Group Filter for Calendar Inbox (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 6, 2026

Reduced cognitive overload in calendar inbox by adding canvas group filtering.

**Problem**:
- Too many tasks even with "Today" filter active
- Current filter buttons (Priority, Project, Duration) were overwhelming
- User wanted to filter calendar inbox by canvas groups

**Solution**:
- [x] Add "Show from: [Canvas Group]" dropdown as primary filter
- [x] Collapse existing filters into "More filters" toggle (hidden by default)
- [x] Create `useCanvasGroupMembership.ts` composable for group membership helpers
- [x] Test with various group configurations

**Changes**:
- `src/composables/canvas/useCanvasGroupMembership.ts` (NEW) - Group membership helpers
- `src/components/inbox/UnifiedInboxPanel.vue` - Added dropdown + collapsible filters
- `src/components/inbox/CalendarInboxPanel.vue` - Storybook version updated for consistency

**Key Features**:
- Canvas group dropdown shows all groups with task counts
- "More filters" button collapses advanced filters (hidden by default)
- Contextual empty state: "No tasks in this group. Drag tasks to this group on Canvas."
- Group membership computed dynamically from task.canvasPosition vs group.position bounds

</details>

<details>
<summary><b>Rollback & Reference</b></summary>

**Stable Baseline**: `93d5105` (Dec 5, 2025)
**Tag**: `v2.2.0-pre-mytasks-removal`

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
</details>
