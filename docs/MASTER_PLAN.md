# FlowState MASTER_PLAN.md

> **Last Updated**: February 2, 2026
> **Token Target**: <25,000 (condensed from ~50,000)
> **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md`

---

## Active Bugs (P0-P1)

### ~~BUG-1105~~: JWT Signature Mismatch - All Supabase Requests Return 401 (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-01-29)

**Problem**: Production Supabase JWT keys mismatched after VPS JWT_SECRET configuration.

**Root Cause**:
1. VPS Supabase had JWT_SECRET but ANON_KEY/SERVICE_ROLE_KEY were signed with demo secret
2. Production build had outdated keys after regeneration

**Fix Applied**:
1. Generated new JWT keys signed with VPS JWT_SECRET (see SOP-036)
2. Updated VPS `/opt/supabase/docker/.env` with new keys
3. Updated Doppler secrets
4. Redeployed production: `doppler run -- npm run build && rsync dist/ VPS`

**SOP Created**: `docs/sop/SOP-036-supabase-jwt-key-regeneration.md`

---

### ~~BUG-1106~~: Realtime Sync Not Initializing After Sign-In via Modal (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-29)

**Problem**: Canvas realtime sync between localhost and VPS stopped working. Tasks/groups created on one device didn't appear on others.

**Root Causes**:
1. VPS Caddyfile missing WebSocket upgrade headers for Supabase Realtime
2. `initRealtimeSubscription` only called in `onMounted`, not re-initialized when user signs in via modal after loading as guest

**Fix Applied**:
1. Added WebSocket headers to VPS `/etc/caddy/Caddyfile`:
   ```
   header_up Connection {header.Connection}
   header_up Upgrade {header.Upgrade}
   ```
2. Added `watch` on `authStore.isAuthenticated` in `useAppInitialization.ts` to re-initialize realtime when user signs in after initial page load

**Files**: `src/composables/app/useAppInitialization.ts`, VPS `/etc/caddy/Caddyfile`

---

### ~~TASK-1009~~: Unified Timer Completion Notifications (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-01-29)

**Enhancement**: Timer completion notifications with actionable buttons across all platforms.

**Implementation**:
1. **Web App**: Service Worker notifications with "Start Break" / "+5 min" action buttons (`src/sw.ts`, `src/stores/timer.ts`)
2. **KDE Widget**: notify-send notifications + full-screen overlay with action buttons (`main.qml`)
3. **Deduplication**: Tag-based notification deduplication prevents duplicate alerts
4. **Auto-start removed**: User must explicitly choose next action via notification buttons

**Additional Fixes**:
- Fixed KDE widget auth by correcting Supabase anon key mismatch in plasma config
- Added Tab/Enter key navigation to KDE widget login form

**SOP Created**: `docs/sop/SOP-038-kde-widget-supabase-config.md`

**Files**: `src/sw.ts`, `src/stores/timer.ts`, `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~BUG-1095~~: Calendar Current Time Indicator Not Showing (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-01-29)

**Problem**: Red horizontal line showing current time position on calendar was invisible because CSS color variables were referenced but never defined.

**Root Cause**: `--color-danger: hsl(var(--red-500))` referenced `--red-500` which was never defined in `design-tokens.css`.

**Solution**:
1. Added missing color palette variables (`--red-500`, `--green-500`, `--blue-500`) to design-tokens.css
2. Fixed invalid CSS syntax: `margin-left: -var()` → `margin-left: calc(-1 * var())`
3. Made indicator less aggressive: lower z-index (behind tasks), reduced opacity, smaller dot

**Files**: `src/assets/design-tokens.css`, `src/components/calendar/CalendarDayView.vue`

**SOP**: `docs/sop/SOP-040-calendar-time-indicator.md`

---

### ~~BUG-1211~~: Tasks Disappearing Across Platforms (PWA/Tauri/Web) (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-07)

**Problem**: Tasks may still be disappearing across platforms — PWA on mobile, Tauri desktop app, and web. A task created or edited on one platform can vanish when synced to another. This is the highest severity data loss bug possible.

**5-Agent Investigation (2026-02-06)** — 5 Opus agents investigated independent hypotheses and debated findings:

**ROOT CAUSE FOUND: `_soft_deleted` Column Mismatch Kill Chain**

`useSyncOrchestrator.ts:329` writes `{ _soft_deleted: true }` but DB column is `is_deleted`. The sync orchestrator bypasses `supabaseMappers.ts`, so the update ALWAYS fails. Fallback at line 335 escalates to a HARD DELETE (`supabase.from(tableName).delete()`). This fires on 100% of task deletions:

1. User deletes task → direct path soft-deletes correctly (`is_deleted: true`) ✅
2. 0-5s later → sync queue tries `_soft_deleted: true` → **FAILS** (column doesn't exist)
3. Fallback → `DELETE FROM tasks WHERE id = X` → **HARD DELETE** (permanent)
4. DB trigger `trg_task_tombstone` → permanent tombstone created
5. Realtime broadcasts DELETE event to ALL connected devices
6. All devices blindly splice task from local state (`tasks.ts:205-208`)
7. Any pending updates on other devices silently discarded as "not found" (`useSyncOrchestrator.ts:277-284`)

**Secondary Bugs Found (6 total, ranked by severity):**

| Rank | Bug | Severity | File:Line | Fix |
|------|-----|----------|-----------|-----|
| **1** | `_soft_deleted` → `is_deleted` column mismatch | **CRITICAL** | `useSyncOrchestrator.ts:329` | Change to `{ is_deleted: true, deleted_at: new Date().toISOString() }` |
| **2** | Hard-delete fallback should not exist | **CRITICAL** | `useSyncOrchestrator.ts:335` | Remove fallback or add logging/alerting |
| **3** | LWW "server wins" drops local changes silently | HIGH | `useSyncOrchestrator.ts:309-318` | Apply `serverData` to local state |
| **4** | CREATE upsert overwrites newer server data | HIGH | `useSyncOrchestrator.ts:237-242` | Add timestamp comparison before upsert |
| **5** | Entity "not found" discards queued updates silently | HIGH | `useSyncOrchestrator.ts:277-284` | Log warning, don't mark as `success: true` |
| **6** | No `addPendingWrite` for delete operations | MEDIUM | `taskOperations.ts:474` | Add `addPendingWrite(taskId)` before delete |

**Disproved Hypotheses:**
- ~~Tombstones cause false-positive deletions~~ → Tombstones are passive/defensive only (checked during restore/import, never during sync)
- ~~Store init race conditions~~ → Fixed by BUG-1207 (auth await, reentrancy guard, `appInitLoadComplete` flag)
- ~~Smart merge drops local tasks~~ → TASK-1177 fix preserves ALL local-only tasks (never drops them)
- ~~PiniaSharedState overwrites~~ → Globally disabled at `main.ts:106-111`

**Zombie Resurrection Risk:** Smart merge preserves local-only tasks and re-queues CREATE via sync orchestrator. However, the DB tombstone (created by `trg_task_tombstone` trigger during the hard delete) may block re-creation depending on whether the upsert path checks tombstones (it does NOT — raw `upsert` bypasses `safeCreateTask`). Debate conclusion: 1-2 resurrection cycles possible before realtime DELETE propagates to all devices, then tombstone causes permanent ID poisoning. Not an infinite loop but makes deleted task IDs permanently unusable.

**Debate Consensus (5/5 agents agree):**
1. `_soft_deleted` kill chain is the **#1 confirmed cause** — deterministic, 100% blast radius, cross-platform
2. Zombie resurrection is **real but self-dampening** (1-2 cycles, not infinite)
3. Cross-tab create path (`useCrossTabSync.ts:84`) — H3 found `broadcastTaskOperation` is **dead code** (never called from outside the file), downgrading this from MEDIUM to NOT A VECTOR
4. Two BUG-1211 sub-scenarios identified: (a) intentionally deleted tasks become unrecoverable (primary), (b) tasks disappearing without user action requires additional trigger (LWW silent discard or recovery reload)

**Residual Risks (lower priority):**
- `isVeryRecent` window (30s) misaligned with recovery cooldown (60s) (`taskPersistence.ts:284`)
- Auth SIGNED_IN handler has no interaction cooldown (`auth.ts:316-320`)
- `deleteTask()` missing `addPendingWrite` causes echo processing (`taskOperations.ts:474`)

**Investigation Areas** (original, now resolved):
1. ~~Sync orchestrator~~ → **ROOT CAUSE** (`_soft_deleted` mismatch + 5 secondary bugs)
2. ~~Tombstones~~ → **DISPROVED** (passive/defensive only, but amplified by kill chain)
3. ~~Realtime subscriptions~~ → **CONFIRMED** as propagation mechanism (DELETE handler has zero validation)
4. ~~Store initialization~~ → **DISPROVED** (fixed by BUG-1207)
5. ~~Cross-platform sync~~ → **DISPROVED** (smart merge safe, cross-tab sync is dead code)
6. ~~BUG-1207~~ ✅ regression — task changes resetting in Tauri app (FIXED 2026-02-06)

---

### BUG-1197: Canvas Group Drag Moves Unrelated Tasks (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-05)

**Problem**: Dragging a group (e.g., "Wednesday") on the canvas also drags tasks that don't belong to that group.

**Root Cause**: Tasks can have stale `parentId` pointing to a group they're no longer spatially inside. `syncStoreToCanvas` blindly sets Vue Flow `parentNode` from `task.parentId` without spatial validation. When the group is dragged, Vue Flow includes all nodes with matching `parentNode` — including stale children — moving them to wrong positions.

**Fix (Two-Part)**:
1. **Sync spatial validation** (`useCanvasSync.ts`): Before setting `parentNode`, validate task's center is actually inside claimed parent group. If outside, treat as root node.
2. **Drag stale detection** (`useCanvasInteractions.ts`): In `onNodeDragStop`, detect when `node.parentNode` doesn't match `task.parentId`. Restore correct position and skip processing.

**Files**: `src/composables/canvas/useCanvasSync.ts`, `src/composables/canvas/useCanvasInteractions.ts`

---

### BUG-1203: Canvas Position Drift in Tauri Desktop App (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-06)

**Problem**: Task positions drift/shift on the canvas in the Tauri desktop app. Positions change unexpectedly, causing tasks to end up in wrong locations.

**Investigation**: TBD - checking canvas sync, drag handlers, and geometry invariant violations.

---

### BUG-1218: RTL Missing in Calendar Task Create Dialog and Timer Task Name (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-07)

**Problem**: The Calendar-specific QuickTaskCreate dialog and the header timer task name don't support RTL/Hebrew text, while the rest of the app does. Hebrew text in the calendar task title input shows LTR cursor position. Timer task name in the header bar doesn't auto-detect Hebrew direction.

**Fix**:
1. Add `useHebrewAlignment` to `QuickTaskCreate.vue` (Calendar variant) — matches `QuickTaskCreateModal.vue`
2. Fix `.timer-task` CSS in `AppHeader.vue` — use `unicode-bidi: plaintext` unconditionally instead of `:dir(rtl)` selector that never matches in LTR documents

---

### ~~BUG-1216~~: Canvas Mouse Drift + Performance on Tauri (👀 REVIEW)

**Priority**: P0-CRITICAL | **Status**: 👀 REVIEW (2026-02-07)

**Problem**: Canvas drag drift, sluggish pan/zoom, and typing lag on Tauri desktop app.

**Root Causes Found & Fixed**:
1. **Cursor drift**: CSS `transform: scale()` on drag/hover overriding Vue Flow's `transform: translate()` — removed 3 conflicting scale transforms
2. **Drag sluggishness**: `transition: all` and orphaned `transition: transform` on nodes — replaced with explicit property transitions
3. **Pan/zoom lag**: `backdrop-filter: blur(20px)` on TaskNode/GroupNode, edge `transition: all`, production console.logs in hot paths — removed/fixed/dev-gated
4. **Zoom "double take"**: `onMoveEnd` on every scroll-wheel tick writing to reactive Pinia store — debounced 150ms
5. **Pan sluggishness**: `only-render-visible-elements` mount/unmount during pan — removed
6. **Typing lag**: `will-change: transform` on viewport, `text-rendering: optimizeLegibility`, `contain: layout paint` — reverted/simplified

---

### BUG-1212: Sync Queue CREATE Retry Causes "Duplicate Key" Corruption (📋 PLANNED)

**Priority**: P0-CRITICAL | **Status**: 📋 PLANNED (2026-02-06)

**Problem**: When a task CREATE operation fails in the offline sync queue (network issue, timeout), retries attempt `.insert()` again. If the original insert actually succeeded server-side before the client detected the error, the retry hits `duplicate key value violates unique constraint "tasks_pkey"`. The operation gets stuck as "corrupted" in the sync queue — cannot retry, cannot auto-resolve.

**Root Cause**: `useSyncOrchestrator.ts` line ~238 uses raw `.insert()` for CREATE operations with no conflict handling. Retries blindly re-insert instead of using `.upsert()`.

**Fix (3 layers)**:
1. **Make CREATE idempotent** — Change `.insert()` to `.upsert({ onConflict: 'id' })` in `executeOperation()`
2. **Pre-retry existence check** — Before retrying a CREATE, query if entity already exists → mark completed if so
3. **Smarter error classification** — Treat duplicate key errors on CREATE as "conflict-resolved" (success) not "permanent failure"

**Files**: `src/composables/sync/useSyncOrchestrator.ts`, `src/services/offline/retryStrategy.ts`

---

### BUG-1204: Challenges Table 404 / Initialization Failure (👀 REVIEW)

**Priority**: P2-MEDIUM | **Status**: 👀 REVIEW (2026-02-07)

**Problem**: Console errors show `user_challenges` table returning 404 and `[Challenges] Initialization failed`. The challenges migration existed locally but was never applied to the VPS database.

**Root Cause**: VPS has no Supabase CLI migration tracking (`supabase_migrations.schema_migrations` doesn't exist). Migrations were applied manually via direct SQL but the challenges migration was missed.

**Additional Issue Found**: Two conflicting migration files existed (`20260206070234` and `20260206163002`) creating the same tables with different schemas. Code expected columns from both (e.g., `created_at`/`updated_at` from older, computed `completion_rate` from newer).

**Fix Applied (2026-02-07)**:
1. Merged both migrations into single canonical file (`20260206163002_challenges.sql`)
2. Deleted duplicate migration (`20260206070234_challenges.sql`)
3. Applied merged migration directly to VPS via SSH (`docker exec -i supabase-db psql`)
4. Verified PostgREST serves both endpoints (HTTP 200)

**Tables Created**: `user_challenges`, `challenge_history` (VPS now has 19 tables)
**Columns Added to `user_gamification`**: 9 new RPG fields (corruption, multiplier, class, counters)
**Also Created**: RLS policies, indexes, helper functions, auto-archive trigger, realtime subscription

**Known Remaining Issue**: `updateChallengeCounters()` uses `supabase.rpc('increment')` which doesn't exist — but the function is scaffolded MVP code that just logs (line 680). Not blocking.

**Errors**:
- `Failed to load resource: 404 (Not Found) (user_challenges)` — **FIXED**
- `[Challenges] Initialization failed` — **FIXED** (pending user verification)

---

### ~~BUG-1205~~: "This Week" Sidebar Filter Includes Sunday (Next Week) (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-06)

**Problem**: The "This Week" sidebar filter count includes tasks due on Sunday, but Sunday is the start of next week. The sidebar's `weekTaskCount` in `useSidebarManagement.ts` uses `<=` comparison instead of `<`, which includes Sunday in the week boundary.

**Root Cause**: `useSidebarManagement.ts` duplicates week-end logic from `useSmartViews.ts` but uses `<= weekEndStr` (includes Sunday) instead of `< weekEndStr` (excludes Sunday, consistent with the centralized `isWeekTask` filter).

**Fix**: Changed `<=` to `<` in all three date comparisons (dueDate, instances, scheduledDate) within `weekTaskCount` computed property. User confirmed working 2026-02-06.

**Files**: `src/composables/app/useSidebarManagement.ts`

---

### BUG-1210: "This Week" Filter Shows Tasks From Next Week (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-06)

**Problem**: The "This Week" view/filter displays tasks due after Saturday 23:59 (next week). Two root causes:

**Root Cause 1**: `useTaskFiltering.ts` nested task bypass — child/subtasks added back WITHOUT re-applying smart view filter. Parent due this week pulled in ALL children regardless of dates.

**Root Cause 2**: `useSidebarManagement.ts` duplicated `weekTaskCount`/`todayTaskCount` with divergent logic (included all `in_progress` regardless of date, excluded overdue).

**Fix (code committed)**:
1. `useTaskFiltering.ts`: Apply `applySmartViewFilter()` to nested tasks before merging
2. `useSidebarManagement.ts`: Replaced duplicated count logic with centralized `useSmartViews` calls

**Pending**: Tauri auto-updater deploy (signing key password mismatch)

**Files**: `src/composables/tasks/useTaskFiltering.ts`, `src/composables/app/useSidebarManagement.ts`

---

### TASK-1215: Persist Full UI State Across Restarts (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-07)

**Problem**: Several UI preferences reset on app restart — inbox advanced filters, All Tasks view type/sort/density, canvas display toggles (priority/status/duration badges), canvas snap/guides, and the task duration filter are all volatile.

**Approach**: Use VueUse `useStorage` (already a dependency, already used in 5 places) to persist the gaps. No new dependencies, no DB changes.

**Changes**:
1. `src/composables/inbox/useUnifiedInboxState.ts` — Persist advanced filters (priority, project, duration, unscheduled, showDone)
2. `src/views/AllTasksView.vue` — Persist viewType, density, sortBy
3. `src/stores/canvas/canvasUi.ts` — Persist display toggles + snap/guides
4. `src/stores/tasks/taskPersistence.ts` — Add missing `activeDurationFilter` to persisted filters
5. Key naming convention: `flowstate:` prefix with kebab-case

---

### TASK-1217: Add "Today" Filter to KDE Plasma Widget (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (2026-02-07)

Add a "Today" button/filter option to the KDE Plasma widget's task list that filters to only show tasks with today's due date. Queries `due_date` column via Supabase REST API.

**Files**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### BUG-1209: Comprehensive Canvas Position Drift - All Causes (👀 REVIEW)

**Priority**: P0-CRITICAL | **Status**: 👀 REVIEW (2026-02-06)

**Problem**: Task positions still drift when moving tasks on canvas. 47 drift vectors identified across 6 subsystems. Subsumes BUG-1203, relates to BUG-1197.

**Root Cause (Systemic)**: Three position authorities (Vue Flow nodes, PositionManager, Pinia store) updated non-atomically through async operations, with 5 unsynchronized guard mechanisms.

**P0 Fixes (6)**:
1. `isDragging=false` moved to finally block — closes realtime overwrite window (`useCanvasInteractions.ts`)
2. Vue Flow node updates moved BEFORE store write — prevents sync reading inconsistent state (`useCanvasInteractions.ts`)
3. Position set BEFORE parentNode for tasks — eliminates micro-tick flash (`useCanvasInteractions.ts`)
4. `__FlowStateIsSettling` flag set in operationState — realtime handlers now block during settling (`useCanvasOperationState.ts`)
5. Online resume cooldown added — WiFi flickers no longer clobber in-flight drags (`useSupabaseDatabase.ts`)
6. PositionManager missing parent → return absolute — prevents double-offset drift (`PositionManager.ts`)

**P1 Fixes (4)**:
7. Grid-aligned positions — `Math.round()` before saving to prevent 16px snap accumulation (`useCanvasInteractions.ts`)
8. `isPendingWrite` check in `updateTaskFromSync` — defense-in-depth against recovery/merge bypassing realtime guard (`tasks.ts`)
9. Stale parentId cleanup uses `setTimeout(500ms)` instead of `nextTick` — breaks sync feedback loop (`useCanvasSync.ts`)
10. Unified `isPositionModificationBlocked` computed — single guard checking all state sources (`useCanvasOperationState.ts`)

**P2 Fixes (3)**:
11. `taskAllGroups` re-snapshot per iteration in multi-node drag loop (`useCanvasInteractions.ts`)
12. `await nextTick()` before descendant sync for fresh computedPosition (`useCanvasInteractions.ts`)
13. `removePendingWrite` delayed 3s to catch Supabase realtime echo (`useCanvasInteractions.ts`)

**Files Modified**: `useCanvasInteractions.ts`, `useCanvasOperationState.ts`, `useSupabaseDatabase.ts`, `PositionManager.ts`, `coordinates.ts`, `useCanvasSync.ts`, `tasks.ts`
**Tests**: 95/95 files pass, 616/616 tests pass

---

### BUG-1206: Task Details Not Saved When Pressing Save in Canvas (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-06)

**Problem**: After editing task details (description) in the canvas edit modal and pressing Save, data appears lost when re-opening the modal. Save itself works (data persists in Supabase after full refresh). Bug is Tauri-specific - does NOT reproduce in browser/PWA guest mode.

**Root Cause Analysis** (3 vectors identified):
- **A (FIXED)**: Async rollback after modal close - removed rollback, added await (commit 0c92101)
- **B (Low risk)**: Realtime echo outside pendingWrites window - mitigated by timestamp checks
- **C (Most likely)**: Visibility change recovery clobber in Tauri/WebKitGTK - `loadFromDatabase()` smart merge may overwrite local with stale remote data when app loses/regains focus

**Progress (2026-02-06):** Added debug logging across 7 files to trace description data through save→sync→reopen cycle. Awaiting Tauri console output to pinpoint exact root cause.

**Files modified**: `useTaskEditActions.ts`, `tasks.ts`, `taskPersistence.ts`, `useTaskNodeActions.ts`, `useTaskEditState.ts`, `useAppInitialization.ts`, `taskOperations.ts`

---

### ~~BUG-1208~~: Task Edit Modal Closes on Text Selection Release (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-06)

**Problem**: When selecting all text in the task details modal (e.g., triple-click or Ctrl+A on title field) and releasing the mouse, the modal closes unexpectedly. The `@click` handler on the overlay fires when `mouseup` from a text selection lands on the overlay backdrop.

**Root Cause**: `TaskEditModal.vue` line 4 uses `@click="$emit('close')"` on the overlay. When text selection starts inside `.modal-content` but the mouseup drifts onto the overlay, the browser fires a click event on the overlay, closing the modal.

**Fix**: Replace `@click` with `@mousedown.self` — only closes when the press *starts* on the overlay itself.

**Files**: `src/components/tasks/TaskEditModal.vue`

---

### ~~BUG-1207~~: Task Changes Reset in Tauri App (Board Position, Edits) (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-06)

**Problem**: Changes made to tasks in the Tauri desktop app (e.g., board position/order, edits) get reverted/reset. Broader than canvas-only position drift (BUG-1203) — affects task mutations across views.

**Root Causes Found (7)**: Recovery reload clobbering edits (no cooldown on WebSocket retry), double `loadFromDatabase()` on startup, smart merge full-array replacement, 30s pendingWrite timeout too short, board position dead code, group sync no protection, PiniaSharedState global conflicts.

**Fixes Applied**:
- Recovery cooldown on ALL 3 paths (WebSocket retry + visibility + online) + `input` event tracking + 60s cooldown
- Dedup startup loads via `appInitLoadComplete` flag + reentrancy guard on `loadFromDatabase()`
- Granular in-place array updates instead of full `_rawTasks.value` replacement
- PendingWrites 120s safety fallback + explicit `removePendingWrite()` on sync completion
- Direct Supabase save preserved as primary (VPS-first), sync queue as backup
- Board position persistence: `event.moved` handler + `sortByOrder()` in grouping functions + `.order()` in fetchTasks
- Group sync: version/timestamp checks in `updateGroupFromSync` + `pendingGroupWrites` + `fromSupabaseGroup` mapper in post-login handler
- PiniaSharedState disabled globally (stores opt in individually)
- Canvas sync stale parent write-back removed (read-only invariant restored)
- Post-login handlers: added missing window flag checks (`__FlowStateIsDragging`, `__FlowStateIsResizing`, `__FlowStateIsSettling`)

---

### TASK-1177: Offline-First Sync System to Prevent Data Loss (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-02-01)

**Problem**: User lost significant work on production (in-theflow.com) due to silent sync failures.

**Root Causes Identified** (6 agents investigated):
1. **Silent error swallowing** (`taskOperations.ts:290-301`) - Save failures logged but not retried
2. **Smart merge drops tasks** (`taskPersistence.ts:272-287`) - Local-only tasks dropped after 5 min
3. **No write queue** - Failed writes lost forever
4. **Optimistic UI no rollback** - updateTask has no rollback on failure
5. **Sync timeout silent** (`useNodeSync.ts:252-256`) - Timeout errors explicitly silenced
6. **No beforeunload** - Can close tab with unsaved data

**Solution Architecture (Offline-First)**:

1. **Phase 1: Write Queue with IndexedDB** (P0)
   - All writes go to IndexedDB FIRST, then sync to Supabase
   - Retry with exponential backoff: 1s, 2s, 4s, 8s... up to 60s max
   - 10 retry attempts before marking as "failed" (requires manual retry)
   - Never discard operations - persist until confirmed synced

2. **Phase 2: Sync Status Indicator** (P0)
   - Visual indicator in AppHeader.vue control panel
   - States: Synced (green), Syncing (blue), Pending (amber), Error (red), Offline (gray)
   - Error state NEVER auto-dismisses

3. **Phase 3: Fix Smart Merge Logic** (P0)
   - NEVER drop local-only tasks automatically
   - Queue for sync retry instead

4. **Phase 4: Add Rollback to updateTask** (P1)
   - Capture previous state before update
   - Rollback local state on failure

5. **Phase 5: beforeunload Protection** (P1)
   - Warn user before closing tab with unsaved changes

**Files to Create**:
- `src/types/sync.ts` - WriteOperation, WriteConflict, SyncStatus types
- `src/services/offline/writeQueueDB.ts` - Dexie.js IndexedDB schema
- `src/services/offline/operationSorter.ts` - Create→Update→Delete ordering
- `src/services/offline/operationCoalescer.ts` - Merge multiple updates
- `src/services/offline/retryStrategy.ts` - Exponential backoff calculation
- `src/composables/sync/useSyncOrchestrator.ts` - Main queue processing
- `src/stores/syncStatus.ts` - Pinia store for sync state
- `src/components/sync/SyncStatusIndicator.vue` - Header indicator
- `src/components/sync/SyncErrorPopover.vue` - Error details popover
- `src/composables/useBeforeUnload.ts` - Page close protection

**Files to Modify**:
- `src/stores/tasks/taskOperations.ts` - Use sync queue, add rollback
- `src/stores/tasks/taskPersistence.ts` - Fix smart merge, extend protection
- `src/stores/tasks.ts` - Fix 5s pending timeout
- `src/layouts/AppHeader.vue` - Add SyncStatusIndicator

**Success Criteria**:
- [ ] User NEVER loses data, even with network failures
- [ ] User ALWAYS sees current sync status
- [ ] User CANNOT close tab with unsaved changes (without warning)
- [ ] Failed syncs retry automatically with backoff
- [ ] Offline edits persist across browser sessions
- [ ] Smart merge NEVER drops local-only tasks

---

### ~~BUG-1112~~: No Notification or Audio When Pomodoro Timer Finishes (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-02)

**Problem**: When the Pomodoro timer finishes a work/break session, there is no notification and no audio alert to inform the user.

**Root Cause**:
1. `silent: true` in Service Worker notification suppressed OS notification sounds
2. Audio volume was 0.1 (barely audible)
3. Service Worker disabled in dev mode (`devOptions.enabled: false`)
4. KDE Widget used pw-play which didn't work reliably

**Fix Applied**:
1. Changed `silent: false` in `src/sw.ts` and fallback notifications in `timer.ts`
2. Increased audio volume to 0.25-0.3 with 3-note chime
3. Enabled Service Worker in dev mode (`vite.config.ts`)
4. **Tauri Desktop**: Added native OS notification with `sound: 'default'` using `@tauri-apps/plugin-notification`
5. **KDE Widget (Plasma 6)**: System notification with FUNCTIONAL action buttons
   - Removed in-widget popup completely (user only wants system notification)
   - **Key fix**: Must use `Plasma5Support.DataSource` not `PlasmaCore.DataSource` for Plasma 6
   - Buttons call Supabase API directly to start next session
   - Bell sound via `paplay` (more reliable than `pw-play`)
   - Added `isKdeWidgetActive` computed in timer.ts to skip Tauri notification when widget active

**Files Changed**:
- `src/sw.ts`, `src/stores/timer.ts`, `vite.config.ts`
- `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`
- `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/scripts/notify.sh`

**SOP Created**: `docs/sop/SOP-043-kde-plasma6-notifications.md`

---

### ~~TASK-1183~~: Fix Tauri Production Sync Version Conflicts (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-02)

**Problem**: Tauri desktop app in production shows "Sync Errors - Version conflict - entity was modified by another device" when syncing with Supabase.

**Requirements**:
- **Bidirectional sync**: Tauri ↔ VPS ↔ Web (changes flow both directions)
- **Single source of truth**: VPS Supabase is authoritative
- **Multi-device support**: Same user on multiple devices must stay in sync

**Root Cause Found** (2026-02-02):
1. **BUG-1179** (Realtime drops) causes local `positionVersion` to become stale
2. Code uses **local cached version** (`task.positionVersion || 0`) at `taskOperations.ts:285`
3. When realtime drops, Device B has stale version (e.g., 4) while server has 5
4. UPDATE with `WHERE position_version = 4` returns 0 rows → false conflict

**Fix Applied** (2026-02-02):
Implemented **Last-Write-Wins (LWW)** auto-conflict resolution in `useSyncOrchestrator.ts`:

1. Try UPDATE with optimistic lock first (existing behavior)
2. If 0 rows returned (conflict), fetch current server state
3. Compare timestamps: `local.updated_at` vs `server.updated_at`
4. If local timestamp ≥ server: Force update without version check (local wins)
5. If server timestamp > local: Accept server version (stale local discarded)

**Benefits**:
- No user-facing "version conflict" errors
- Bidirectional sync works correctly
- Single source of truth (VPS) respected
- Handles offline/reconnect scenarios gracefully

**Files Changed**:
- `src/composables/sync/useSyncOrchestrator.ts` - Added LWW resolution logic
- `src/types/sync.ts` - Added `serverData` to SyncResult type
- `src/stores/canvas/canvasGroups.ts` - Fixed group IDs to use proper UUIDs
- `src/utils/supabaseMappers.ts` - Added UUID validation for groups and task parentId
- `src/stores/projects.ts` - Fixed 'uncategorized' → null for projectId
- `src/services/offline/retryStrategy.ts` - Permanent error classification for data validation
- `src/components/sync/SyncErrorPopover.vue` - "Corrupted" badge, smart Retry button
- `src/stores/tasks.ts` - Added cleanupCorruptedTasks()
- `src/components/settings/tabs/StorageSettingsTab.vue` - Data Cleanup section

**Related**: BUG-1179 (Realtime Drops) - should still be fixed to reduce conflicts

---

### ~~BUG-1185~~: Timer Auto-Continues After Session Completes (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-04)

**Problem**: Timer automatically starts a new 25-minute session after break/work completes, without waiting for user to choose "Start Work" or "+5 min".

**Root Causes Found**:
1. `completeSession()` in `timer.ts` did NOT save `is_active=false` to Supabase — session stayed active in DB, could be picked up by sync
2. Service Worker notification body click auto-started opposite session type — accidental clicks triggered new sessions

**Fix**:
- Added DB save in `completeSession()` to mark session inactive (matching `stopTimer()` behavior)
- Changed notification body click to only focus window, not start a timer (action buttons still work)

**Files**: `src/stores/timer.ts`, `src/sw.ts`

---

### BUG-1186: Tauri Today Group Not Counting Tasks or Moving Children (📋 PLANNED)

**Priority**: P0-CRITICAL | **Status**: 📋 PLANNED (2026-02-03)

**Problem**: In Tauri desktop app, the "Today" smart group has two issues:
1. **Badge not counting tasks** - The task count badge stopped showing the correct number
2. **Children don't move with group** - When dragging the Today group, child tasks don't follow

**Context**: This is Tauri-specific - may be related to recent sync changes or group handling differences between web and desktop.

**Investigation Steps**:
- [ ] Check if Today group exists and has correct `filter_type`
- [ ] Verify task-to-group relationship (parentId matching)
- [ ] Compare behavior between web and Tauri builds
- [ ] Check console for errors when dragging group

**Files to Investigate**:
- `src/stores/canvas/canvasGroups.ts` - Group logic
- `src/composables/canvas/useCanvasSync.ts` - Sync handling
- `src/components/canvas/GroupNode.vue` - Badge display

---

### ~~BUG-1187~~: "Done for now" Badge Resets and Doesn't Persist (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-06)

**Problem**: The "Done for now" badge on tasks gets reset automatically and doesn't persist across sessions or refreshes.

**Root Causes Found**:
1. The `doneForNowUntil` field was NOT included in the sync payload sent to Supabase
2. Badge display logic (`dueDate === doneForNowUntil`) was fragile - any dueDate change hid it

**Fix Applied**:
- [x] Added `done_for_now_until` to updateTask sync payload (`taskOperations.ts`)
- [x] Added `done_for_now_until` to createTask sync payload (`taskOperations.ts`)
- [x] Changed badge logic to show when `doneForNowUntil` has any value, not just matching dates (`TaskNodeMeta.vue`)

**Files Changed**:
- `src/stores/tasks/taskOperations.ts` - Added `done_for_now_until` to sync payloads
- `src/components/canvas/node/TaskNodeMeta.vue` - Badge shows when `doneForNowUntil` exists

---

### ~~BUG-1188~~: Today View Shows Non-Today Tasks Due to Hidden Hour Data (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-03)

**Problem**: Tasks scheduled for future dates were incorrectly appearing in the "Today" smart view due to stale legacy `scheduledDate` field values conflicting with the newer instances-based scheduling system.

**Root Cause**: The smart view filters checked BOTH `task.instances[].scheduledDate` (new system, authoritative) AND `task.scheduledDate` (legacy field, may have stale data). When a task had instances with future dates but the legacy `scheduledDate` field contained "today", the filter incorrectly included the task.

**Fix Applied**:
- [x] Fixed `isTodayTask()` in `useSmartViews.ts` - When instances exist, ONLY check instance dates (skip legacy scheduledDate)
- [x] Fixed `isWeekTask()` in `useSmartViews.ts` - Same fix, instances are authoritative
- [x] Fixed `isThisMonthTask()` in `useSmartViews.ts` - Same fix, instances are authoritative
- [x] Fixed `useCalendarDrag.ts` - Clear legacy `scheduledDate`/`scheduledTime` when creating instances to prevent future stale data

**Files Changed**:
- `src/composables/useSmartViews.ts` - Prioritize instances over legacy field in all smart view filters
- `src/composables/calendar/useCalendarDrag.ts` - Clear legacy fields when creating instances

---

### BUG-1184: Production Site Down - Chunk Load Failure + Network Errors (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS (2026-02-02)

**Problem**: Production site at `in-theflow.com` is broken with two critical issues:

1. **Chunk Load Failure**:
   ```
   error loading dynamically imported module: https://in-theflow.com/assets/AllTasksView-BA62OH4U.js
   ```

2. **Network Errors on All Sync Operations**:
   - `fetchActiveTimerSession`: NetworkError
   - `fetchGroups`: NetworkError
   - `fetchTasks`: NetworkError
   - `fetchProjects`: NetworkError
   - `fetchNotifications`: NetworkError
   - `fetchQuickSortHistory`: NetworkError

**Symptoms**:
- UI loads but shows "No tasks yet"
- Multiple sync error popups appear
- All Supabase API calls fail with "NetworkError when attempting to fetch resource"

**Likely Causes**:
1. Stale build deployed - chunk hash mismatch between index.html and actual assets
2. VPS Supabase service down or unreachable
3. CORS misconfiguration after recent changes
4. Caddy reverse proxy issue

**Investigation Steps**:
- [ ] Check if VPS is reachable: `ssh root@84.46.253.137`
- [ ] Check Caddy status: `systemctl status caddy`
- [ ] Check Supabase status: `cd /opt/supabase/docker && docker compose ps`
- [ ] Check if chunk file exists: `ls -la /var/www/flowstate/assets/AllTasksView*`
- [ ] Check CORS headers: `curl -I https://api.in-theflow.com/rest/v1/`
- [ ] Redeploy if needed: `doppler run -- npm run build && rsync -avz dist/ root@84.46.253.137:/var/www/flowstate/`

**Files**: VPS `/var/www/flowstate/`, `/etc/caddy/Caddyfile`, `/opt/supabase/docker/`

---

### BUG-1113: Stale Worktrees Not Cleaned Up - Forces Claude Code Context Bloat (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS | **Parent**: TASK-303

**Problem**: The Dev-Maestro orchestrator creates git worktrees in `.agent-worktrees/` for each task but does not clean them up after completion. These stale directories force Claude Code to load them into context, wasting tokens and causing confusion.

**Evidence** (2026-01-27):
```
.agent-worktrees/
├── orch-audit-task-1/   # Jan 20 - 10+ days old
├── orch-audit-task-2/
├── orch-audit-task-3/
├── orch-task-1/         # Jan 18 - 12+ days old
├── task-1 through task-18/  # Jan 27 - multiple stale worktrees
```

**Impact**:
1. Claude Code loads all these directories into context on startup
2. Wastes context tokens on stale/irrelevant code
3. Git worktrees consume disk space (~100MB+ each)
4. Confuses Claude when it sees duplicate file structures

**Expected Behavior**:
1. Worktrees should be cleaned up after task completion (merge OR discard)
2. Automatic cleanup of worktrees older than 24 hours
3. Manual cleanup command available in UI

**Related**: BUG-1019 (Swarm agent cleanup + OOM prevention)

**Files**: `~/.dev-maestro/server.js` (`cleanupWorktree()`, `createAgentWorktree()`)

---

### ~~BUG-1121~~: KDE Plasma Widget Dropdown Options Disappearing (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-02)

**Problem**: In the KDE Plasma widget task list, dropdown menus (sort order, filter) were cutting off options. Only 2 of 4 options were visible/pickable.

**Root Cause**: Using `QQC2.ComboBox` (Qt Quick Controls 2) in Plasma widgets causes popup clipping issues because the widget's `fullRepresentation` is not a top-level window. The popup gets clipped by parent container boundaries.

**Solution**: Replace `QQC2.ComboBox` with `PlasmaComponents.ComboBox` which is specifically designed for Plasma widgets and handles popup positioning correctly. Custom styling (background, contentItem, indicator) can still be applied for glass morphism look.

**Key Learning**: In KDE Plasma 6 widgets, always use `PlasmaComponents.ComboBox` instead of `QQC2.ComboBox` for dropdowns to ensure proper popup handling.

**SOP Created**: `docs/sop/SOP-041-kde-widget-combobox-popup.md`

**Files**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~BUG-1122~~: KDE Widget Lost Timer Sync with Web App and Tauri (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-02)

**Problem**: KDE Plasma widget has lost timer sync with BOTH the web app and Tauri desktop app. Timer state changes are not reflecting across devices.

**Root Cause**:
1. Timer session in DB has stale leader heartbeat (2+ hours old)
2. KDE widget only checked `device_leader_id === "kde-widget"` without checking for stale leadership
3. Web/Tauri follower poll didn't take over when leader heartbeat was stale
4. All devices stayed as "followers" waiting for a dead leader

**Fix Applied**:
1. **KDE Widget** (`~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`):
   - Added stale leadership detection (30 second timeout)
   - Widget now claims leadership when leader heartbeat is stale
   - Calls `patchSession()` to update `device_leader_id` to "kde-widget"

2. **Web/Tauri App** (`src/stores/timer.ts`):
   - Added stale leadership check to follower poll
   - Follower now claims leadership if heartbeat is older than `DEVICE_LEADER_TIMEOUT_MS` (30s)
   - Starts heartbeat and stops follower polling after claiming

**Files Changed**: `src/stores/timer.ts`, `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~BUG-1178~~: Break Button in Timer Notification Doesn't Start Break Timer (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-02)

**Problem**: Clicking "Break" button in work-complete notification doesn't start break timer. After break completes, no popup with "Start Work" / "+5 min".

**Root Cause**: SW message listener registered before SW controller was ready + race condition where message sent before window fully focused.

**Fix Applied**:
1. Wait for `navigator.serviceWorker.ready` before registering message listener (`timer.ts`)
2. Add 100ms delay after focusing window before sending message (`sw.ts`)
3. URL query param fallback when opening new window (`useAppInitialization.ts`)
4. Enhanced debug logging throughout SW message flow

**Files Changed**: `src/stores/timer.ts`, `src/sw.ts`, `src/composables/app/useAppInitialization.ts`

---

### ~~BUG-1179~~: Supabase Realtime Connection Drops (CHANNEL_ERROR/CLOSED) (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-03)

**Problem**: Production console shows repeated realtime connection drops:
```
📡 [REALTIME] Connection dropped (CHANNEL_ERROR): unknown reason
📡 [REALTIME] Connection dropped (CLOSED): unknown reason
```

**Impact**: Causes `saveTasks` failures and potential data loss if writes happen during disconnect.

**Investigation Results** (2026-02-02):
1. ✅ VPS Caddy WebSocket headers already correct (checked `/etc/caddy/Caddyfile`)
2. 🔍 Supabase Realtime logs show: `Killing X transport pids with no channels open`
3. 🔍 Cloudflare has 100-second idle timeout for WebSockets
4. ❌ Supabase client had NO realtime configuration (using defaults)

**Root Cause**: Default Supabase heartbeat interval (25s) may be too infrequent, and idle connections are being killed by Supabase Realtime garbage collection.

**Fix Applied** (2026-02-02):
Added realtime configuration to Supabase client in `src/services/auth/supabase.ts`:
```typescript
realtime: {
    heartbeatIntervalMs: 15000,  // More frequent heartbeats (was 25s)
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 30000),
    log_level: import.meta.env.DEV ? 'info' : 'error',
}
```

**Awaiting**: User verification - monitor console for connection drops after refresh

**Related**: TASK-1177 (Offline-First Sync), BUG-1106 (Realtime Init)

**Files Changed**: `src/services/auth/supabase.ts`

**Sources**:
- [Supabase Realtime Heartbeat Docs](https://supabase.com/docs/guides/troubleshooting/realtime-heartbeat-messages)

---

### ~~BUG-1180~~: Ollama Localhost CORS Errors in Production (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-03)

**Problem**: Production site (`in-theflow.com`) attempts to call `localhost:11434` (Ollama), which fails with CORS:
```
Cross-Origin Request Blocked: http://localhost:11434/api/tags
(Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 403.
```

**Root Cause**: AI provider detection runs in browser, checks if Ollama is available locally. Works on localhost dev, but CORS blocks it from production domain.

**Fix Applied** (2026-02-02):
- Added production domain check in `createOllamaProvider()` - skips Ollama detection when:
  - Running on non-localhost domain AND
  - `VITE_OLLAMA_HOST` env var is NOT set
- Users who want Ollama from production can set `OLLAMA_ORIGINS=https://in-theflow.com` on their Ollama instance AND set `VITE_OLLAMA_HOST` to enable detection

**Files Changed**: `src/services/ai/router.ts`

**Awaiting**: User verification on production

---

### TASK-1186: Make AI Accessible in Tauri App (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (2026-02-06)

**Problem**: AI features (Ollama local, Groq/OpenRouter cloud) reliability in Tauri desktop context is unknown. Key concerns:
1. **Ollama detection skipped** on "production domains" (BUG-1180) - may incorrectly skip in Tauri
2. **Cloud AI requires internet** + Supabase Edge Functions - not offline-capable
3. **No CORS-free HTTP** - Browser fetch in Tauri WebView has same CORS restrictions

**Current Architecture**:
| Provider | Method | Works Offline? |
|----------|--------|----------------|
| Ollama | localhost:11434 | Yes (if running) |
| Groq | Direct API | No |
| OpenRouter | Edge Function proxy | No |

**Progress (2026-02-06)**:
- ✅ **Groq Provider Added** - Direct API calls to `api.groq.com` (no edge function needed)
- ✅ **Provider Visibility Badge** - Shows "Local"/"Groq"/"OpenRouter" in chat header
- ✅ **Provider/Model Switcher** - Settings dropdown to switch between Auto/Groq/Local + model picker
- ✅ **Tool Execution System** - AI can create groups, tasks, list items via `src/services/ai/tools.ts`
- ✅ **Hebrew Language Support** - AI responds in user's language
- ✅ **Conversational Behavior** - Only uses tools when user explicitly asks to create/modify

**Solution**:
1. ~~**Phase 1: Fix Tauri Detection**~~ - ✅ DONE - Removed hard block, graceful Ollama detection
2. **Phase 2: Tauri HTTP Plugin** - Use `@tauri-apps/plugin-http` for CORS-free Ollama requests
3. **Phase 3: (Future) Direct API Option** - Store API keys locally for offline cloud AI

**Files Modified**:
- `src/services/ai/router.ts` - Groq provider, removed production hard-block for Ollama
- `src/services/ai/providers/groq.ts` - NEW: Groq provider implementation
- `src/services/ai/tools.ts` - NEW: Tool definitions and execution
- `src/composables/useAIChat.ts` - Provider/model state, tool execution, improved prompts
- `src/components/ai/AIChatPanel.vue` - Provider badge, settings dropdown, model selector

**Remaining**:
- [ ] Test Ollama in Tauri with `OLLAMA_ORIGINS` configured
- [ ] Tauri HTTP plugin for CORS-free requests (Phase 2)
- [ ] Clear "AI unavailable" message when all providers fail

**Related**: BUG-1180 (Ollama CORS in production)

---

### BUG-1181: Cloudflare Insights SRI Hash Mismatch (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED (2026-02-02)

**Problem**: Console shows integrity hash mismatch for Cloudflare beacon script:
```
None of the "sha512" hashes in the integrity attribute match the content of the subresource at
"https://static.cloudflareinsights.com/beacon.min.js/..."
```

**Root Cause**: Cloudflare updates their beacon.min.js periodically, but the HTML references a cached integrity hash.

**Impact**: Low - Cloudflare analytics may not load, but app functionality unaffected.

**Fix**: Remove integrity attribute from Cloudflare script tag, or let Cloudflare CDN handle it automatically.

**Files**: `index.html` or Cloudflare dashboard Web Analytics settings

---

### BUG-1182: saveTasks Fails After Realtime Disconnect (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED (2026-02-02)

**Problem**: After realtime connection drops (BUG-1179), task save operations fail:
```
i@.../index-CAXNPz-Z.js:144:4526
saveTasks@.../index-CAXNPz-Z.js:144:14019
```

---

### ~~BUG-1189~~: Can't Drag Tasks from Overdue Swimlane in My Projects (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-06)

**Problem**: In the Board view (Date view), tasks cannot be dragged from the "Overdue" column to other columns. The task appears to move but snaps back to Overdue.

**Root Cause Found**:
1. `moveTaskToDate()` only updated `instances`, not `dueDate`
2. `groupTasksByDate()` checks BOTH `task.dueDate` AND `instances` for overdue status
3. If a task had a past `dueDate`, it stayed stuck in Overdue even after updating instances
4. Missing handling for 'inbox' and 'noDate' columns in `moveTaskToDate()`

**Fix Applied**:
- [x] Added handling for 'inbox' column (sets `isInInbox: true`, clears dates)
- [x] Added handling for 'noDate' column (clears all date info)
- [x] When moving a task with an overdue `dueDate`, update `dueDate` to the target date

**Files Changed**:
- `src/stores/tasks/taskOperations.ts` - Fixed `moveTaskToDate()` function

**Verification**: User should test by:
1. Switch to Board view → Due Date view
2. Find a task in the "Overdue" column
3. Drag it to "Today" or "Tomorrow"
4. Task should move and STAY in the target column
5. Also test dragging to "Inbox" and "No Date" columns

**Root Cause**: Likely the optimistic update happens but Supabase write fails silently. No retry or rollback.

---

### ~~BUG-1190~~: Subtasks Not Saved, Poor Design, Missing Badge (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-06)

**Problem**: Three subtask-related issues:
1. **Subtasks not saved** - After editing a main task and pressing Save, subtasks are not persisted
2. **Poor subtask design** - The subtask UI in the main task editing panel needs visual improvement
3. **Missing subtask badge** - Tasks with subtasks show no indicator/badge in the UI (Board, Canvas, Calendar views)

**Success Criteria**:
- [ ] Subtasks persist correctly when saving the parent task
- [ ] Subtask section in task editor has clean, polished design
- [ ] Tasks with subtasks show a badge/count indicator across all views

**Impact**: User thinks task is saved, but it's lost on refresh.

**Fix**: This is addressed by TASK-1177 (Offline-First Sync) which adds:
- Write queue with IndexedDB persistence
- Automatic retry with exponential backoff
- Visual sync status indicator
- Rollback on failure

**Blocked By**: TASK-1177

**Files**: `src/stores/tasks/taskOperations.ts`, `src/composables/sync/useSyncOrchestrator.ts`

---

### ~~BUG-1191~~: Overdue Badge Logic Inverted for Today Group Tasks (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-06)

**Problem**: Overdue badges on tasks have inverted behavior related to the Today group:
1. **Tasks staying in Today group** that become overdue → badge does NOT appear (should show)
2. **Tasks moved OUT of Today group** that are overdue → badge does NOT appear (should show)
3. **Tasks returned TO Today group** → badge DOES appear (should NOT, because the due date should be updated to today on move)

**Root Cause**: `new Date()` inside Vue `computed()` is NOT a reactive dependency. Computeds cache results until reactive dependencies change. Since time isn't reactive, overdue badges never update when midnight passes.

**Fix Applied**:
- Created `src/composables/useReactiveDate.ts` with reactive `reactiveToday` ref that updates every 60 seconds
- Updated all overdue computations to depend on `reactiveToday.value` (creates reactive dependency)
- At midnight, ref updates → all overdue computeds re-evaluate → badges appear/disappear correctly

**Files Changed**:
- `src/composables/useReactiveDate.ts` (NEW)
- `src/composables/canvas/node/useTaskNodeState.ts`
- `src/components/kanban/card/TaskCardBadges.vue`
- `src/components/inbox/unified/UnifiedInboxTaskCard.vue`
- `src/components/inbox/calendar/CalendarTaskCard.vue`

---

### ~~BUG-1192~~: Canvas Inbox Double-Click Opens Selection Instead of Edit Menu (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-06)

**Problem**: Three issues with canvas inbox task interactions:
1. **Double-click** on a task in the canvas inbox should open the edit menu — currently triggers selection
2. **Ctrl+Click** should toggle multi-selection — currently not the trigger for selection toolbar
3. **Multi-selection toolbar** styling doesn't use design tokens — needs sync with visual system

**Solution**:
- Added `multiSelectActive` flag to separate "highlighted" (single click) from "multi-selected" (Ctrl/Shift click)
- Single click now highlights task visually but does NOT show selection bar
- Ctrl+Click and Shift+Click activate multi-select mode and show the selection bar
- Updated selection bar CSS to use glass morphism design tokens instead of solid brand-primary

**Success Criteria**:
- [x] Double-clicking a task in canvas inbox opens the task edit panel
- [x] Ctrl+Click toggles task selection (shows multi-selection toolbar)
- [x] Multi-selection toolbar uses design tokens (colors, spacing, border-radius)
- [x] Regular single-click highlights task without showing selection bar

**Files**:
- `src/composables/inbox/useUnifiedInboxActions.ts` - Click behavior logic
- `src/components/inbox/unified/UnifiedInboxList.vue` - Selection bar CSS

---

### ~~BUG-1193~~: Kanban Drag-and-Drop Deep Regression - Drags Wrong Tasks, Groups Don't Move Children (👀 REVIEW)

**Priority**: P0-CRITICAL | **Status**: 👀 REVIEW (2026-02-06)

**Problem**: Deep regression in Kanban/Board view drag-and-drop:
1. Dragging a task in kanban drags unrelated tasks instead
2. Group drag doesn't move child tasks
3. Tauri app and main app don't sync at all

**Root Cause**:
1. `group="tasks"` was a static string shared across ALL swimlanes - vuedraggable allowed cross-project drag
2. `localTasks` watch fired during drag, overwriting vuedraggable's internal state causing wrong element selection
3. `createTask` sync threw error when auth unavailable, breaking entire task creation
4. Legacy canvas groups with `group-xxx` IDs threw error on sync instead of gracefully skipping

**Fix Applied**:
- **KanbanColumn.vue**: Scoped drag group per swimlane (`:group="dragGroup"` with `tasks-{projectId}`), added `isDragActive` guard to prevent reactive overwrites during drag, added `@start`/`@end` handlers
- **KanbanSwimlane.vue**: Pass `:swimlane-id="project.id"` to all KanbanColumn instances
- **taskOperations.ts**: Changed auth check from throw to graceful skip for sync queue, fixed TypeScript errors (`dueDate: undefined` instead of `null`)
- **supabaseMappers.ts**: Changed `toSupabaseGroup` to return `null` and warn for legacy IDs instead of throwing

---

### ~~BUG-1183~~: Production App Crash - Circular Dependency in Vite Chunks (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-02)

**Problem**: Production app crashes on load with error:
```
ReferenceError: can't access lexical declaration 'Ie' before initialization
    Ye vue-vendor-DkWNH6qz.js:2
    <anonymous> naive-ui-CbR0xL5r.js:33
```

**Root Cause**: Vite's manualChunks split `naive-ui` and `vue-vendor` into separate chunks. When loaded in parallel, naive-ui tried to access Vue before it was initialized.

**Fix Applied**: Combined naive-ui into vue-vendor chunk in `vite.config.ts`:
```typescript
if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('naive-ui')) {
  return 'vue-vendor'
}
```

**Files Changed**: `vite.config.ts`

---

### ~~BUG-1129~~: Quick Sort Project Buttons Truncating Names on Desktop (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-01-31)

**Problem**: In the Quick Sort view on desktop, project category buttons have fixed width causing long project names to be truncated with ellipsis. Hebrew text "נטלי כה..." and other long names are cut off.

**Fix Applied**:
1. Changed `.category-grid` from fixed grid to flexbox (`flex-wrap: wrap`)
2. Added `title` attribute to project names for hover tooltip
3. Buttons now size to content naturally with `min-width: 120px`
4. Set `max-width: 250px` on text to prevent overly long names
5. Mobile responsive: full width buttons on small screens

**Files**: `src/components/layout/CategorySelector.vue`

---

### ~~TASK-1130~~: QuickSort Desktop UX/UI Comprehensive Improvements (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-02)

**Problem**: Desktop QuickSort view has multiple UX issues preventing efficient task categorization:
1. Cannot view as "one-pager" - requires scrolling (850-1050px content vs 900px viewport)
2. Task titles scroll out of view when viewing project options (context loss)
3. Project names truncated, especially Hebrew/RTL text ("נטלי כה...")
4. Keyboard shortcuts (1-9) exist but badges are hidden (`display: none`)

**Solution Applied - Single-Column Focus Layout** (2026-02-02):
Instead of the original 3-phase plan, implemented a radical simplification:
- [x] Converted from 2-column to single-column centered layout (max 600px)
- [x] Combined priority + date shortcuts into one compact row
- [x] Moved action buttons (Done/Skip/Edit/Undo) to consolidated bottom row
- [x] Removed redundant metadata display and "MOVE TO PROJECT" header
- [x] Simplified date shortcuts: Tomorrow → +1, Next Week → +7, removed Weekend
- [x] Task title is now the hero element with clear vertical flow

**Files**: `src/views/QuickSortView.vue`, `src/components/QuickSortCard.vue`, `src/components/layout/CategorySelector.vue`

---

### ~~BUG-1176~~: Done Tasks Sometimes Remain Visible on Canvas (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-01-31)

**Problem**: When a task is marked as "Done", it sometimes remains visible on the canvas instead of being hidden/removed.

**Root Cause**: `useCanvasSync.ts` synced ALL tasks with `canvasPosition` regardless of status, bypassing the `hideCanvasDoneTasks` flag that exists in `useCanvasFilteredState.ts`.

**Fix Applied**: Added done-task filter to `syncStoreToCanvas()` function:
```typescript
const shouldHideDone = taskStore.hideCanvasDoneTasks
const tasksToSync = (tasks || taskStore.tasks)
    .filter(t => t.canvasPosition)
    .filter(t => !shouldHideDone || t.status !== 'done')
```

**Files**: `src/composables/canvas/useCanvasSync.ts`

---

### ~~BUG-1122~~: KDE Widget Lost Timer Sync with Web App and Tauri (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-02)

**Problem**: KDE Plasma widget has lost timer sync with BOTH the web app and Tauri desktop app.

**Root Cause**: Timer session had stale leader heartbeat (2+ hours), all devices stayed as "followers" waiting for dead leader. Fixed by adding stale leadership detection (30s timeout) to both KDE widget and web/Tauri app.

**Files Changed**: `src/stores/timer.ts`, `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`
- Compare timer session IDs across all three apps
- Verify KDE widget is polling/subscribing to correct Supabase endpoint

**Related**: TASK-1009 (Timer Sync), SOP-038 (KDE Widget Supabase Config)

**Files**: `kde-widget/package/contents/ui/main.qml`, `src/stores/timer.ts`

---

### ~~BUG-1123~~: Tauri Desktop App Performance Issues (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-02)

**Problem**: Performance issues reported in Tauri desktop application. Main bundle was 1.9MB monolithic file.

**Root Cause**: No vendor chunking in vite.config.ts - all dependencies bundled into single index.js

**Fix Applied**:
- Added `manualChunks` configuration to vite.config.ts
- Split vendors: vue-vendor, naive-ui, tiptap, supabase, vueuse, date-fns, tauri
- Main bundle reduced from 1.9MB → 729KB (61% reduction)

**Results**:
| Bundle | Before | After |
|--------|--------|-------|
| index.js | 1.9MB | 729KB |
| vue-vendor | - | 758KB |
| naive-ui | - | 433KB |
| tiptap | - | 392KB |

**Files Changed**: `vite.config.ts`

---

### ~~BUG-1124~~: Task Positions Don't Sync Between Tauri App and Web App (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-02)

**Problem**: Task positions on canvas didn't sync correctly between the production Tauri desktop app and the web app (PWA). Changes made in one didn't reflect properly in the other.

**Root Causes Found**:
1. Group realtime handler wasn't using `fromSupabaseGroup` mapper - `position_json` from DB was passed as-is instead of mapped to `position`
2. Task position version logic blocked cross-device sync - when versions matched, local was always preserved instead of comparing timestamps

**Fixes Applied**:
1. Added `fromSupabaseGroup` mapper to realtime handler in `useAppInitialization.ts`
2. Updated position version logic in `tasks.ts` to compare `updatedAt` timestamps when versions equal
3. Extended pending write timeout from 5s to 30s to handle VPS latency

**SOP**: `docs/sop/SOP-040-cross-device-position-sync.md`

**Related**: TASK-131 (position reset issues), TASK-142 (positions reset on refresh)

**Files Changed**: `src/composables/app/useAppInitialization.ts`, `src/stores/tasks.ts`

---

### ~~BUG-1125~~: Canvas Edge/Cable Connections Between Nodes Broken (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-31)

**Problem**: Connecting cables/edges between nodes on the canvas is broken. Users cannot create new connections between tasks/groups. Affects both local dev and Tauri desktop app.

**Root Cause**: The `Handle` component from Vue Flow was lazy-loaded with `defineAsyncComponent`, causing timing issues where Vue Flow couldn't register connection handles during node mount in dev/Tauri environments. Production builds worked because bundling made the component available synchronously.

**Fix**: Changed from lazy loading to direct import in `TaskNode.vue`.

**Files**: `src/components/canvas/TaskNode.vue`

---

### ~~BUG-1126~~: Group Created at Wrong Location (Not Where Clicked) (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-02)

**Problem**: When right-clicking on the canvas to create a new group, the group does not appear at the clicked location.

**Root Cause**: `screenToFlowCoordinate` had issues with container offset detection. Also, `canvasGroups.ts` was hardcoding `parentGroupId: null` and `UnifiedGroupModal.vue` was converting to relative coords instead of keeping absolute (violating Fully Absolute Architecture).

**Fix**:
- Manual coordinate conversion using `getBoundingClientRect()` in `useCanvasGroupActions.ts`
- Preserved `parentGroupId` from groupData in `canvasGroups.ts`
- Kept absolute position for nested groups in `UnifiedGroupModal.vue`

**Files**: `src/composables/canvas/useCanvasGroupActions.ts`, `src/stores/canvas/canvasGroups.ts`, `src/components/canvas/UnifiedGroupModal.vue`

---

### BUG-1127: Cannot Create Group Inside Another Group (Nested Groups) (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS

**Problem**: It's not possible to create a new group inside an existing group. Nested group creation is blocked or ignored.

**Root Cause**: The "Create Group" button in `CanvasContextMenu.vue` had `v-if="!contextSection"` which explicitly hid it when right-clicking inside a group.

**Fix Applied**:
1. Removed `v-if="!contextSection"` from Create Group button
2. Groups use position-based containment (like tasks) - no parentId needed

**Files Changed**: `src/components/canvas/CanvasContextMenu.vue`

**Files**: `src/composables/canvas/useCanvasGroups.ts`, `src/composables/canvas/useCanvasActions.ts`

---

### TASK-1128: Add "Create Group From Selection" Context Menu Option (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (2026-02-04)

**Feature**: When multiple tasks are selected on canvas, right-click should show "Add to New Group" option that:
1. Creates a new group at the bounding box location of selected tasks
2. Automatically parents all selected tasks to the new group
3. Sizes the group to contain all selected tasks with padding

**Implementation**:
- [x] Add context menu option when `selectedNodes.length > 1`
- [x] Calculate bounding box of selected nodes
- [x] Create group with appropriate position and dimensions
- [x] Update selected tasks' parentId to new group

**Awaiting**: User verification

**Files Changed**:
- `src/components/canvas/CanvasContextMenu.vue` - Added "Add to New Group" menu option
- `src/components/canvas/CanvasContextMenus.vue` - Event forwarding
- `src/composables/canvas/useCanvasActions.ts` - `createGroupFromSelection()` implementation
- `src/views/CanvasView.vue` - Wired up event handler

---

### ~~BUG-1097~~: Due Date Not Persisting from Edit Modal (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-30)

**Symptoms**:
1. Due date in Edit Task modal shows previous date, not current - even after opening modal on task WITH a date
2. Due date changes from modal don't persist on refresh
3. Canvas overdue reschedule badge updates card display but doesn't save to database

**Investigation**: `TaskEditMetadata.vue` logging traces date values through flow.

**Files**: `src/components/tasks/TaskEditMetadata.vue`, `src/composables/tasks/useTaskEditActions.ts`

---

### ~~BUG-1099~~: VPS: Done Tasks Not Filtered Until Refresh - ReferenceError (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-30)

**Problem**: On VPS production (in-theflow.com), completed/done tasks appear on canvas when they should be hidden. They only disappear after a page refresh.

**Console Error**:
```
ReferenceError: can't access lexical declaration 'xe' before initialization
    xe https://in-theflow.com/assets/CanvasView-DB2EuB-i.js:27
```

**Root Cause**: Circular dependency chain causing Temporal Dead Zone (TDZ) error:
`CanvasView → useCanvasOrchestrator → useCanvasFilteredState → @/stores/tasks → @/stores/canvas → circular!`

Type imports from `@/stores/tasks` instead of `@/types/tasks` triggered module evaluation during bundling.

**Fix Applied (2026-01-30)**:
1. Changed type imports in 4 files from `@/stores/tasks` → `@/types/tasks`:
   - `useCanvasFilteredState.ts`
   - `useCanvasGroups.ts`
   - `useCanvasSectionProperties.ts`
   - `stores/canvas/modals.ts`
2. Made `tasks.ts` → `canvas.ts` import dynamic to break runtime cycle

**Verification**: Build succeeds, tests pass. Needs VPS deployment + manual testing.

**Files to Investigate**: `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasFilteredState.ts`, `src/composables/canvas/useCanvasOrchestrator.ts`, `vite.config.ts`

---

### BUG-1103: Local Dev Auth Signs Out Both Tabs on Second Tab Sign-In (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS (2026-01-28)

**Problem**: In local development, when user has two browser tabs open:
1. Sign in on first tab - works
2. Open second tab and try to sign in
3. Both tabs get signed out

**Symptoms**: Auth session not persisting across multiple browser tab instances during local development.

**Likely Causes**:
1. Session token overwrite/conflict between tabs
2. `onAuthStateChange` listener firing logout event to all tabs
3. Supabase local storage key collision
4. Race condition in auth initialization across tabs

**Files to Investigate**: `src/stores/auth.ts`, `src/services/auth/supabase.ts`

**Related**: BUG-1086 (auth persistence issues on VPS)

---

### ~~BUG-1111~~: Tauri Desktop App Not Syncing from Main Database (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-30)

**Problem**: Tauri desktop app doesn't sync data from the main Supabase database. Tasks/groups created on web app don't appear in Tauri app.

**Root Cause**: `.env.production` had the correct VPS URL but the **wrong ANON_KEY** (demo key instead of production key). When `tauri build` runs, Vite uses `.env.production` which baked the demo JWT into the bundle.

**Fix Applied**:
1. Fixed `.env.production` with correct production ANON_KEY (signed by VPS JWT_SECRET)
2. Rebuilt Tauri app with `npx tauri build`
3. Created `FlowState-Dev.desktop` launcher for dev mode workflow

**Files Changed**: `.env.production`, `FlowState-Dev.desktop` (new)

**Dev Workflow Improvement**: Added "FlowState (Dev)" desktop launcher that runs `npm run tauri` directly - no need to rebuild deb for testing

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

### ~~BUG-1107~~: PWA Mobile - Sync Error fetchGroups Failed to Fetch (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-31)

**Problem**: Mobile PWA shows sync error during fetchGroups - `TypeError: Failed to fetch` in fetch → fetchAndCache flow.

**Root Cause**: Multiple fetch functions were missing `withRetry()` wrapper. Network failures on mobile weren't being retried with exponential backoff.

**Fix Applied**: Added `withRetry()` to ALL fetch functions:
- `fetchGroups()`
- `fetchActiveTimerSession()`
- `fetchNotifications()`
- `fetchTrash()`

**File Changed**: `src/composables/useSupabaseDatabase.ts`

**SOP**: `docs/sop/SOP-041-mobile-pwa-network-resilience.md`

**Verified**: User confirmed sync errors resolved on mobile PWA.

---

### BUG-1108: PWA Mobile - Task Input Needs RTL Support (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW (2026-01-30)

**Problem**: Hebrew text in "New Task" modal displays left-to-right instead of right-to-left.

**Root Cause**: Two issues:
1. Textarea/input elements missing `dir` attribute binding
2. CSS missing `text-align: right` for RTL elements (dir attribute sets direction but not alignment)

**Fix Applied**:
1. Added RTL auto-detection computed property (checks first character against Hebrew/Arabic/Persian/Urdu Unicode ranges)
2. Bound `:dir="titleDirection"` to inputs
3. Added CSS: `.task-text-block[dir="rtl"] { text-align: right; }`

**Files Changed**:
- `src/mobile/components/TaskCreateBottomSheet.vue` - `titleDirection` computed + `:dir` binding + CSS
- `src/mobile/components/TaskEditBottomSheet.vue` - `titleDirection` + `descriptionDirection` + CSS

**SOP**: `docs/sop/SOP-042-rtl-support-pattern.md`

**Verification**: User must test on mobile with Hebrew text input - text should align right.

---

### ~~BUG-1109~~: PWA Mobile - Hebrew Voice Transcription Issues (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-31)

**Problem**: Voice transcription has multiple issues with Hebrew:
1. Transcribes Arabic instead of Hebrew
2. Makes mistakes during regular Hebrew transcription
3. Problems when mixing Hebrew and English in speech

**Solution**: Auto-detection + Arabic retry strategy. Let Whisper auto-detect first, then if result contains Arabic script (likely Hebrew misdetection), retry with `language='he'`. This preserves English and code-switching support while fixing the Arabic confusion.

**Files Added/Modified**:
- `src/utils/scriptDetection.ts` - Script detection utility (Hebrew/Arabic/Latin)
- `src/services/groqWhisper.ts` - Added `transcribeWithRetry()` function
- `src/composables/useGroqWhisper.ts` - Uses new retry function
- `tests/unit/script-detection.test.ts` - 11 unit tests

**Related**: TASK-1002 (Voice Transcription to Task), FEATURE-1023 (Voice Input)

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

### ~~BUG-1101~~: Route Navigation Crashes on Module Load Failure (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-01-29)

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

### BUG-1120: Test Environment localStorage Not Available (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

`tests/repro-bug-030.test.ts` fails with localStorage issue - test environment doesn't have localStorage mocked/available. This is a test infrastructure issue, not a code bug.

**Fix**: Add localStorage mock to Vitest setup or the specific test file.

---

### ~~BUG-025~~: Unrelated Groups Move with Parent (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE

Dragging a group causes unrelated groups to move. Location: `useCanvasDragDrop.ts` parentGroupId logic.

**Resolution** (verified Jan 2026):
- Original `useCanvasDragDrop.ts` was refactored into `useCanvasInteractions.ts`
- `collectDescendantGroups()` function now properly filters by `parentGroupId === rootId`
- Only actual descendants are collected and synced on group drag
- Cycle protection added via `visited` Set
- Unrelated groups are never included in descendant collection

---

### ~~TASK-1114~~: Tauri Auto-Update from GitHub Releases (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-30)

**Request**: Enable Tauri app to automatically update when new versions are pushed to GitHub releases.

**Implementation**:
1. Added `tauri-plugin-updater` to Cargo.toml
2. Registered updater plugin in `lib.rs`
3. Added `updater:default` capability for update permissions
4. Enhanced `useTauriUpdater.ts` composable with check/download/install flow
5. Created `TauriUpdateNotification.vue` component with glass morphism styling
6. Integrated update banner in `App.vue` (Tauri-only, shows when update available)

**Files Changed**: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src/composables/useTauriUpdater.ts`, `src/components/common/TauriUpdateNotification.vue`, `src/App.vue`

**Testing**: Requires GitHub release with higher version number to trigger update flow

---

### ~~BUG-1115~~: Tauri App Performance is Slow (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-31)

**Problem**: Tauri desktop app feels sluggish compared to web version.

**Root Cause Analysis**:
1. ✅ **Missing release profile optimizations** - FIXED
2. ✅ **DevTools feature always enabled** - FIXED (dev-only now)
3. ⚠️ **10 Tauri plugins loaded** - Minor impact, not addressed
4. ✅ Logging gated by `debug_assertions` - Already good
5. ✅ CSP is null (not blocking) - Already good

**Fix Applied**:
1. Added `[profile.release]` to Cargo.toml:
   - `lto = true` (Link-Time Optimization)
   - `codegen-units = 1` (better optimization)
   - `strip = true` (smaller binary)
   - `opt-level = 3` (max optimization)
   - `panic = "abort"` (no unwinding overhead)
2. Made devtools conditional via `[features]` section
3. Added `"features": ["devtools"]` to tauri.conf.json (dev builds only)

**Expected Improvement**: 10-30% faster startup, smaller binary, snappier UI

**Files Changed**: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`

**Verification**: User must build release (`npm run tauri build`) and compare performance

---

### ~~BUG-1116~~: Tauri Mouse Offset During Drag (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-31)

**Problem**: When dragging tasks in Tauri app on Linux, there was visible lag - the task would animate to cursor position instead of snapping instantly.

**Root Cause**: CSS transitions on `transform` property in `canvas-view-overrides.css` (line 137) were causing the dragged node to animate to cursor position.

**Fix Applied** (`src/assets/vue-flow-overrides.css`):
```css
.vue-flow__node.dragging,
.vue-flow__node.dragging * {
    transition: none !important;
    animation: none !important;
}
```

**Additional Changes**:
- Added `isLinuxTauri()`, `getPlatformDiagnostics()`, `getLinuxTauriScaleFactor()` utilities in `src/utils/contextMenuCoordinates.ts`
- Added diagnostic logging in `useCanvasInteractions.ts` for future debugging

---

### ~~BUG-1195~~: Pomoflow Widget syncTimer polls every 2s even when idle (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-05)

**Problem**: The KDE Pomoflow widget's syncTimer fires HTTP requests every 2 seconds unconditionally when authenticated, even with no active timer session. This wastes bandwidth and battery.

**File**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml` (line ~1204)

**Fix Applied**: Changed `interval: 2000` to `interval: root.hasActiveSession ? 2000 : 30000` for adaptive polling.

---

### ~~BUG-1196~~: Pomoflow Widget filterMenu/sortMenu undefined references (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-05)

**Problem**: `onExpandedChanged` handler references `filterMenu` and `sortMenu` objects that don't exist in the QML, causing runtime errors when the popup closes.

**File**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml` (line ~1853)

**Fix Applied**: Added `typeof` and truthiness guards before accessing menu properties.

---

## Active Tasks (IN PROGRESS)

### TASK-1060: Infrastructure & E2E Sync Stability (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (Started: 2026-01-24)

**Problem**: Intermittent sync failures across Web, Tauri, PWA, KDE Widget - 0 tasks shown, WebSocket 403 errors, SIGTERM exits.

**Root Causes Found**:
1. CI/CD `deploy.yml` was killing System Caddy, starting Docker Caddy (conflict)
2. SWR cache not invalidated on auth change (fixed in BUG-1056)
3. Silent session refresh failure didn't set error state (fixed 2026-01-30)
4. No retry on initial database load (fixed 2026-01-30)
5. Fetch functions started before auth ready (fixed 2026-01-30)
6. Tauri `.expect()` panic on startup failure (fixed 2026-01-30)
7. Circular dependency causing TDZ error in production build (BUG-1099, fixed 2026-01-30)

**Infrastructure Fixes Applied** (2026-01-24):
- Docker stack stopped, System Caddy re-enabled
- Fixed `deploy.yml` - static files only, graceful Caddy reload

**Phase 2 Fixes Applied** (2026-01-30):
- Mark `initializationFailed` when session refresh fails (`auth.ts`)
- Add retry wrapper (3x with backoff) for initial database load (`useAppInitialization.ts`)
- Add auth initialization guard to `fetchTasks`, `fetchProjects`, `fetchGroups` (`useSupabaseDatabase.ts`)

**Phase 3 Fixes Applied** (2026-01-30):
- Replace `.expect()` panic with graceful error handling + helpful messages (`lib.rs`)

**Phase 4 Audit Findings** (2026-01-30):
- Offline database (`useOfflineDatabase.ts`) is a shell - NOT integrated with Supabase
- Notification fallback lacks action buttons when SW unavailable
- SWR cache 3s stale window acceptable but may cause brief position flash
- Added Caddy systemd auto-restart config

**Remaining Phases** (condensed):
- [ ] Phase 1.3: Verify JWT keys in `/opt/supabase/docker/.env` (requires VPS SSH)
- [x] Phase 2: Auth flow audit + fixes (DONE 2026-01-30)
- [x] Phase 3: Tauri debug + panic fix (DONE 2026-01-30)
- [x] Phase 4: PWA service worker audit (DONE 2026-01-30 - offline DB gap identified)
- [x] Phase 5: KDE widget token refresh on startup (DONE 2026-01-31 - was loading expired tokens)
- [ ] Phase 6: Cross-platform E2E matrix test (requires testing)

**Success Criteria**: Caddy 24h+ uptime, no 0-task loads, Tauri no SIGTERM, PWA overnight persistence.

**Key Files**: `/etc/caddy/Caddyfile`, `src/stores/auth.ts`, `src/composables/useSupabaseDatabase.ts`, `src-tauri/src/lib.rs`, `kde-widget/package/contents/ui/main.qml`

---

### TASK-1214: Child Groups Inherit Parent Group Properties (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (Started: 2026-02-06)

**Problem**: When dropping a task into a nested child group, the task only inherits properties from the immediate child group. Parent group properties (especially dates like "Today") are NOT inherited.

**Expected Behavior**: Task dropped into child group → inherits date from parent group + any properties from child group (child overrides parent for conflicts).

**Solution Implemented**:
1. Added `getParentChain()` utility in `storeHelpers.ts` - traverses from child to parent groups
2. Modified `getSectionProperties()` to traverse parent chain and merge properties (root → child order)
3. Updated `useCanvasInteractions.ts` to pass `allGroups` for inheritance

**Current Status**: Enhanced debug logging added to diagnose why inheritance isn't working in all cases. Testing in progress.

**Key Files**:
- `src/utils/canvas/storeHelpers.ts` - `getParentChain()` function
- `src/composables/canvas/useCanvasSectionProperties.ts` - Parent chain traversal
- `src/composables/canvas/useCanvasInteractions.ts` - Passes allGroups to enable inheritance

---

### ~~TASK-1087~~: KDE Widget - Task Readability + Active Task Highlight (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-30)

**Changes Made**:
- [x] Added `currentTaskId` property for active timer task
- [x] Increased task row height (44-64px dynamic)
- [x] Added 2-line text wrap with RTL support
- [x] Added active task highlight (accent border + glow + pulse)
- [x] Added chronometer icon + bold text for active task

**Verified**: Plasma restarted, widget displays correctly.

**File**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~TASK-1121~~: QuickTaskCreateModal UI/UX Redesign (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-02)

**Problem**: Modal had inconsistent styling - inputs had no visible borders, multiple different border-radii (6px/8px/16px), hardcoded rgba colors violating design token system, low placeholder contrast failing WCAG, and inconsistent visual hierarchy between sections.

**Changes Made**:
- Unified all inputs with glass container styling (visible borders + rounded corners)
- Standardized ALL border-radii to `var(--radius-md)` (8px)
- Replaced 10+ hardcoded rgba() colors with `--purple-*` and `--glass-*` tokens
- Fixed placeholder contrast (opacity 0.5 → 0.8, color to `--text-tertiary`)
- Removed "SCHEDULE" / "DETAILS" section labels (visual noise)
- Progressive voice disclosure (mic button fades in on focus/hover)
- RTL support with logical CSS properties (`inset-inline-start`, etc.)
- Removed purple gradient box around Schedule section (equal visual weight)

**Files**: `src/components/tasks/QuickTaskCreateModal.vue`

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

### ~~TASK-333~~: Independent Audit of Crisis Analysis (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-30)

QA Supervisor verification of January 20, 2026 Data Crisis. See `docs/reports/2026-01-20-auth-data-loss-analysis.md`.

**Audit Result**: All 10 crisis items resolved. All remediation tasks (TASK-329, TASK-330, TASK-332) verified complete. Report created at `docs/reports/2026-01-20-auth-data-loss-analysis.md`.

---

### ~~INQUIRY-1112~~: Supabase Function Search Path Mutable Warnings (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-01-30)

**Problem**: Supabase Security Advisor shows 7 warnings for "Function Search Path Mutable" on database functions:
- `public.check_task_ids_availability`
- `public.create_task_tombstone`
- `public.safe_create_task`
- `public.update_updated_at_column`
- `public.increment_task_position_version`
- `public.increment_group_position_version`
- `public.cleanup_expired_tombstones`

**Conclusion**: LOW PRIORITY - Safe to ignore for personal productivity app.
- RLS is enabled (users can only access their own data)
- Not multi-tenant (no shared database access)
- Attack requires database superuser access (which would bypass all security anyway)
- Fix is simple if desired later: Add `SET search_path = public` to each function

---

### ~~INQUIRY-1113~~: Terminal UI Task Picker for Claude Code (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-01-30)

**Question**: Can we build an interactive terminal app that works within Claude Code to show scrollable/clickable task options?

**Answer**: YES - Prototype built and working at `tools/task-picker/`

**Research Findings**:
| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Ink v6 + @inkjs/ui** | Modern, maintained, used by Claude Code itself | Select has no built-in search | ✅ CHOSEN |
| **ink-select-input v6** | Lightweight, j/k navigation | No search, basic | Good alternative |
| **ink-search-select** | Has incremental search | Uses old Ink v2.x (outdated) | ❌ Outdated |
| **Bubbletea** | Very polished, great ecosystem | Go-only (not Node.js) | N/A for this project |

**Implementation**:
- Built with: `ink` v5 + `@inkjs/ui` v2 + `tsx` runtime
- Features: Filter by type, show/hide done, j/k navigation, Enter to select
- Non-interactive mode: `--list` flag for CI/scripting
- Location: `tools/task-picker/index.tsx`

**Usage**:
```bash
npm run tasks          # Interactive mode (requires TTY)
npm run tasks:list     # Non-interactive list
npm run tasks:bugs     # Filter by BUG type
```

**Sources**: [Ink GitHub](https://github.com/vadimdemedes/ink), [@inkjs/ui](https://github.com/vadimdemedes/ink-ui), [LogRocket TUI Comparison](https://blog.logrocket.com/7-tui-libraries-interactive-terminal-apps/)

---

### ~~INQUIRY-1184~~: Safe Due Date → Group Assignment on Send to Canvas (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-02-02)

**Feature**: Added "Send to Canvas" button to inbox task cards. When clicked, tasks are automatically placed in matching Smart Groups based on their due date:
- Tasks with due dates are placed in matching groups (Today, Tomorrow, This Week, day-of-week)
- Tasks without due dates default to the Today group
- Supports multi-select batch operations for sending multiple tasks at once

**Implementation**:
- [x] NEW: `src/composables/canvas/useSmartGroupMatcher.ts` - Smart group matching logic
- [x] Modified: `src/composables/inbox/useUnifiedInboxActions.ts` - Action handler for send to canvas
- [x] Modified: `src/components/inbox/unified/UnifiedInboxTaskCard.vue` - Button UI in task cards
- [x] Modified: `src/components/inbox/unified/UnifiedInboxList.vue` - Multi-select support
- [x] Modified: `src/components/inbox/UnifiedInboxPanel.vue` - Integration with panel

**Testing**: User tested "Send to Canvas" flow with various due dates and verified smart group assignment works correctly.

---

### ~~TASK-1111~~: Sync Design Tokens with KDE Widget Dropdowns (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-30)

**Problem**: KDE Plasma widget dropdowns (task filter, sort) used default Qt styling instead of matching the main app's glass morphism design.

**Solution**: Styled QQC2.ComboBox components in the KDE widget with custom glass morphism appearance matching design tokens.

**Implemented**:
- [x] Custom background with purple-tinted glass morphism (`rgba(28, 25, 45, 0.95)`)
- [x] Subtle white border with hover state (`rgba(255, 255, 255, 0.12)`)
- [x] Custom popup with rounded corners and glass styling
- [x] Hover highlight with teal accent color
- [x] Custom chevron indicator

**File**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~TASK-1213~~: MASTER_PLAN.md → Beads One-Way Sync (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (Completed: 2026-02-06)

**Goal**: Automate bead creation/updates from MASTER_PLAN.md so agents can use `bd ready`, `bd blocked`, and task claiming without maintaining two systems manually.

**Implementation**:
- Created `scripts/sync-masterplan-to-beads.cjs` (~220 LOC)
- Added npm scripts: `mp:sync`, `mp:sync:dry`, `mp:sync:force`
- Updated CLAUDE.md with beads coordination documentation
- Created optional hook: `.claude/hooks/masterplan-beads-sync.sh`

**Features**:
- Parses MASTER_PLAN.md task headers (`### TASK-XXX: Title (STATUS)`)
- Uses `--external-ref` for cross-referencing (TASK-123 → flow-state-abc)
- Status mapping: PLANNED→open, IN PROGRESS→in_progress, DONE→closed
- Priority mapping: P0-P4 → 0-4
- Idempotent sync (145 tasks synced, detects unchanged)

**Verification**:
- `bd ready` shows prioritized unblocked tasks
- `bd show <id> --json` confirms external_ref mapping
- `npm run mp:sync:dry` previews changes

---

## Planned Tasks (NEXT/BACKLOG)

### TASK-1118: Test Suite Cleanup - Reduce 615 Tests to ~100 Essential (📋 PLANNED)

**Priority**: P3 | **Status**: 📋 PLANNED

**Problem**: Test suite has grown to 615 tests, many are one-off debug tests that were never cleaned up. This adds maintenance burden and slows test runs.

**Cleanup Targets**:
- `debug-*.spec.ts` - One-off debugging tests
- `repro_*.spec.ts` - Bug reproduction tests (bugs already fixed)
- `quick-*.spec.ts` - Quick check scripts
- `inspect-*.spec.ts` - Visual inspection tests
- `verify-*.spec.ts` - One-time verification tests

**Keep (Essential Tests)**:
- Data persistence / Supabase sync tests
- Auth flow tests
- Known bug regression tests
- Stress tests (`tests/stress/`)
- Safety tests (`tests/safety/`)
- Core component integration tests

**Target**: ~100 essential tests with fast execution (<30s)

---

### ~~TASK-1104~~: Enhanced Task Filtering and Grouping Options (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-29)

Replaced status-based filters with flexible filtering and grouping system in Mobile Inbox and Today views.

**Implemented**:
- **Time filters**: All, Due Today, Due This Week, Overdue (Inbox)
- **Grouping options**: None, By Date, By Project, By Priority
- **Filter dropdowns**: Project filter, Priority filter (Today view)
- **Hide Done toggle**: Show/hide completed tasks

**Files Modified**: `src/mobile/views/MobileInboxView.vue`, `src/mobile/views/MobileTodayView.vue`

---

### ~~TASK-1102~~: Calendar View Start on Current Day with Time Scroll (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE

When entering calendar view: default to current day's date and auto-scroll to current time position.

**Solution**: Changed `useCalendarNavigation.ts` to use a regular `ref` instead of `useStorage` for the current date. This ensures each time the CalendarView component mounts, it starts fresh at today's date. The existing `scrollToCurrentTime()` call in `onMounted` handles scrolling to current time.

**Files Modified**: `src/composables/calendar/useCalendarNavigation.ts`

---

### ~~TASK-1002~~: Voice Transcription to Task (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-01-31)

Record audio → transcription API (Whisper/Deepgram) → create task. Mobile-first UX.

**Implementation Complete**:
- Groq Whisper API service (`src/services/groqWhisper.ts`)
- Recording composable (`src/composables/useGroqWhisper.ts`)
- NLP parser with Hebrew+English support (`src/composables/useVoiceTaskParser.ts`)
- Confirmation UI with RTL support (`src/mobile/components/VoiceTaskConfirmation.vue`)
- Mobile integration (`src/mobile/components/TaskCreateBottomSheet.vue`)

---

### ~~TASK-1110~~: PWA Mobile - Add Re-Record Option in Task Creation (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-01-31)

**Feature**: Add ability to re-record voice input from the task creation modal. Currently no way to redo a recording once made.

**Implementation**:
- Desktop: Added re-record props and button to `VoiceTaskConfirmation.vue`
- Mobile: Added re-record button to `TaskCreateBottomSheet.vue`
- Button shows "Record" when empty, "Re-record" when has existing text
- Fixed bug where button disappeared when clearing text

**Related**: TASK-1002, FEATURE-1023

---

### FEATURE-1111: PWA Mobile - Batch Voice Recording for Multiple Tasks (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Feature**: Record multiple tasks in sequence without leaving the creation flow.

**Proposed UX**:
1. "Record another task" button after recording
2. Approve current recording → record next
3. See all previous recordings in same panel
4. "Add all" button to create all recorded tasks at once

**Needs**: UX design/breakdown session before implementation

**Related**: TASK-1002, TASK-1110, FEATURE-1023

---

### TASK-359: Quick Add + Sort Feature (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW

Batch capture mode: `Ctrl+.` opens Quick Capture modal, type titles + Enter, Tab to sort phase, 1-9 assigns project.

**Files**: `src/composables/useQuickCapture.ts`, `src/components/quicksort/QuickCaptureModal.vue`

---

### TASK-1117: Enhance Quick Sort UX on Mobile (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-01-30)

**Problem**: Mobile Quick Sort has unclear UX hierarchy and confusing swipe interactions:
1. Sliding right opens Quick Edit modal instead of sorting
2. Project selection is required before sorting happens
3. The process flow is not intuitive - users don't understand the hierarchy

**Implementation (Phase 1 Complete)**:
- [x] Swipe Right = Directly opens project picker (instant categorization)
- [x] Swipe Left = Mark Done instantly (no confirmation delay)
- [x] "Keep in Inbox" option allows sorting without project assignment
- [x] Process flow indicator shows hierarchy: Swipe → Assign → Sorted!
- [x] Updated swipe indicators: green "Done!" (left), teal "Assign" (right)
- [x] 4 action buttons in thumb zone: Done, Assign, Skip, Delete
- [ ] User testing and feedback

**Related**: TASK-359 (Quick Add + Sort desktop), FEATURE-1023 (Voice Input)

**Files Modified**: `src/mobile/views/MobileQuickSortView.vue`

---

### FEATURE-1048: Canvas Auto-Rotating Day Groups (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

User-triggered rotation of day groups (Mon-Sun) with midnight notification.

**Key Files**: `src/composables/canvas/useDayGroupRotation.ts` (CREATE), `src/components/canvas/DayRotationBanner.vue` (CREATE)

---

### ~~FEATURE-1023~~: Voice Input - Transcription + Task Extraction (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-30)

Voice input → Web Speech API / Whisper → NLP extracts task properties (priority, due date). Supports Hebrew + English.

**Implementation**:
- `useSpeechRecognition.ts` - Web Speech API with language auto-detect
- `useWhisperSpeech.ts` - Groq Whisper fallback (12x cheaper than OpenAI)
- `useVoiceNLPParser.ts` - Extracts title, due date, priority from natural language
- Mic button in Mobile Inbox with AI/Browser mode toggle
- Integrated NLP parsing in `TaskCreateBottomSheet.vue`

**Completed Subtasks**: ~~TASK-1024~~ (Web Speech API), ~~TASK-1025~~ (Mic Button), ~~TASK-1026~~ (NLP Parser), ~~TASK-1027~~ (Commands), ~~TASK-1028~~ (Confirmation UI), ~~TASK-1029~~ (Whisper Fallback)

**Known Issues**: ~~BUG-1109~~ (Hebrew voice transcription - FIXED via Arabic retry)

---

### TASK-1119: Remove Web Speech API - Use Whisper Only (👀 REVIEW)

**Priority**: P3-LOW | **Status**: 👀 REVIEW

**Rationale**: Web Speech API has poor quality compared to Whisper:
- Browser-dependent (different results on Chrome/Firefox/Safari)
- Poor Hebrew support
- No mixed-language (code-switching) support
- Requires manual language selection

**Scope**: Mobile only (desktop components still use browser speech as fallback)

**Changes Made**:
1. Removed Browser/AI mode toggle from MobileInboxView
2. Made Whisper (via Groq) the only voice input method for mobile
3. Simplified voice UI - single mic button, no mode selection
4. Simplified cancelVoice to Whisper-only
5. Removed all `voiceMode`, `voiceLanguage`, `toggleVoiceMode` references

**Files Modified**:
- `src/mobile/views/MobileInboxView.vue` - Whisper-only voice UI

**Note**: `useSpeechRecognition.ts` kept for desktop components (UnifiedInboxInput, QuickCaptureTab, AppSidebar)

**Related**: ~~FEATURE-1023~~, ~~BUG-1109~~, ~~TASK-1131~~

---

### TASK-1131: Offline Voice Queue - Save & Retry When Online (👀 REVIEW)

**Priority**: P2-MEDIUM | **Status**: 👀 REVIEW

**Problem**: With Whisper-only voice input (TASK-1119), offline recording fails silently.

**Solution**: Save audio blob to IndexedDB, show badge, auto-transcribe when back online.

**Implementation Complete**:
1. Created `useOfflineVoiceQueue.ts` composable
   - Saves audio blob to IndexedDB when offline
   - Uses VueUse `useOnline()` for connectivity detection
   - Watches online status and processes queue when reconnected
   - Auto-retries failed transcriptions (max 3 attempts)
2. Modified `useWhisperSpeech.ts`:
   - Added `onOfflineRecord` callback option
   - Added `isQueued` status for UI feedback
   - Exposed `isOnline` state
3. Updated `MobileInboxView.vue`:
   - Badge on mic button shows pending count
   - Offline indicator when not connected
   - Voice feedback shows "Saved offline" status
   - Haptic feedback on queue save

**Files Created/Modified**:
- `src/composables/useOfflineVoiceQueue.ts` (CREATE) - IndexedDB queue management
- `src/composables/useWhisperSpeech.ts` (MODIFY) - Offline callback support
- `src/mobile/views/MobileInboxView.vue` (MODIFY) - UI integration

**Depends On**: ~~TASK-1119~~ (Whisper-only simplification) ✅

**Effort**: ~2-3 hours

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

### FEATURE-1198: Task Image Attachments with Cloud Storage and Compression (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Feature**: Allow users to attach images to tasks. Images should be compressed client-side before upload to reduce storage. Optionally store images in Google Drive or Dropbox so the VPS doesn't run out of disk space.

**Requirements**:
- [ ] Image upload UI in task editor (drag-drop + file picker)
- [ ] Client-side image compression before upload (e.g., browser-image-compression)
- [ ] Cloud storage integration (Google Drive and/or Dropbox) to offload VPS storage
- [ ] Fallback to Supabase Storage if no cloud provider configured
- [ ] Image preview/gallery in task detail view
- [ ] Max file size limit and format validation

**Investigation Needed**:
- Google Drive API vs Dropbox API for image storage
- Supabase Storage bucket as default backend
- Compression ratio targets (quality vs size tradeoff)
- Tauri desktop: local file access vs cloud sync

---

### BUG-1199: Canvas Inbox Right-Click Acts as Ctrl+Click (👀 REVIEW)

**Priority**: P1-HIGH | **Status**: 👀 REVIEW (2026-02-06)

**Problem**: Right-clicking on a task in the canvas inbox behaves as if Ctrl+Click was pressed (multi-select behavior) instead of opening a context menu or doing nothing.

**Root Cause**: The native `@click` event fires for ALL mouse buttons (left=0, right=2). When right-clicking, `@click` fires first (running selection logic), then `@contextmenu` fires. Canvas nodes don't have this issue because Vue Flow's `@node-click` filters by button internally.

**Fix Applied**: Added `event.button !== 0` early return in `handleTaskClick()` so only left-clicks trigger selection logic. Right-clicks now only fire the `@contextmenu` handler.

**Files Changed**:
- `src/composables/inbox/useUnifiedInboxActions.ts` - Added button check (1 line)

---

### FEATURE-1200: Quick Add Full RTL Support + Auto-Expand for Long Tasks (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Feature**: Two improvements to the Quick Add input in the main sidebar:

1. **Full RTL support**: The quick add input should properly support RTL text (Hebrew). Text direction should auto-detect or follow app locale.
2. **Auto-expand to fullscreen**: When typing a long task title that exceeds the input width, automatically open a fullscreen task creator popup/modal so the user has more space to write.

**Requirements**:
- [ ] Add `dir="auto"` or RTL detection to quick add input
- [ ] RTL-aware placeholder text and icons
- [ ] Character/width threshold to trigger fullscreen expansion
- [ ] Smooth transition from inline input to fullscreen modal
- [ ] Carry over typed text to the fullscreen creator
- [ ] Fullscreen creator should also be fully RTL-aware

**Files to Investigate**:
- Quick add component in sidebar
- `TaskEditModal.vue` or equivalent fullscreen creator

---

### FEATURE-1201: Intro/Onboarding Page for Guest and Signed-In Users (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Feature**: Add an intro/onboarding page when users first enter the app, both in guest mode and after signing in. Need to decide what content belongs on each.

**Design Decisions Needed**:
- [ ] What to show guest users (feature highlights, sign-up CTA, quick tour?)
- [ ] What to show signed-in users on first visit (workspace setup, quick tutorial, keyboard shortcuts?)
- [ ] Should it be a single splash page, multi-step wizard, or dismissable overlay?
- [ ] Should it reappear after major updates?

**Requirements**:
- [ ] Guest mode intro: explain app capabilities, encourage sign-up
- [ ] Signed-in intro: workspace orientation, key features walkthrough
- [ ] "Don't show again" option
- [ ] Mobile-responsive design
- [ ] Matches glass morphism design system

---

### FEATURE-1202: Google Auth Sign-In (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Feature**: Add Google OAuth sign-in as an authentication option alongside existing email/password auth.

**Requirements**:
- [ ] Configure Google OAuth provider in Supabase Dashboard
- [ ] Add "Sign in with Google" button to login/signup UI
- [ ] Handle OAuth callback flow
- [ ] Link Google accounts with existing email accounts (if same email)
- [ ] Test on both PWA and Tauri desktop

**Files to Modify**:
- `src/services/auth/supabase.ts` - Add Google OAuth method
- `src/stores/auth.ts` - Handle OAuth flow state
- Login/signup components - Add Google button

**Supabase Setup**:
- Enable Google provider in Supabase Auth settings
- Configure OAuth credentials in Google Cloud Console
- Set redirect URLs for both PWA and Tauri

---

### Other Planned Tasks

| Task | Priority | Description |
|------|----------|-------------|
| FEATURE-1198 | P2 | Task image attachments + cloud storage (GDrive/Dropbox) + compression |
| BUG-1199 | P1 | 👀 Canvas inbox right-click acts as Ctrl+Click |
| BUG-1206 | P0 | 🔄 Task details not saved when pressing Save in canvas (Tauri-specific, debug logging added) |
| ~~BUG-1208~~ | P1 | ✅ Task edit modal closes on text selection release |
| BUG-1212 | P0 | Sync queue CREATE retry causes "duplicate key" corruption |
| TASK-1215 | P0 | Persist full UI state across restarts (filters, view prefs, canvas toggles) via useStorage |
| FEATURE-1200 | P2 | Quick Add full RTL support + auto-expand for long tasks |
| FEATURE-1201 | P2 | Intro/onboarding page for guest + signed-in users |
| FEATURE-1202 | P2 | Google Auth sign-in (OAuth) |
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
| TASK-1120 | P2 | 🔄 Deep UX/UI analysis and enhancement of catalog views |

---

## System Review 2026-01-31 Findings

> **Source**: Comprehensive system review with 4 parallel agents (Security, Code Quality, Architecture, Health Check)
> **Validated**: npm test (587 passed), npm audit (16 vulnerabilities), npm outdated, npm run lint (349 errors)
> **Total Issues**: 48 (P0: 2, P1: 14, P2: 19, P3: 13)

---

### BUG-1131: Move All Exposed API Keys to Backend Proxy (📋 PLANNED)

**Priority**: P0-CRITICAL | **Status**: 📋 PLANNED

**Problem**: API keys with `VITE_*` prefix are bundled into client JavaScript by Vite, making them visible to anyone who inspects the bundle:
- `VITE_GROQ_API_KEY` - Groq Whisper for voice transcription
- `VITE_DEEPSEEK_API_KEY` - DeepSeek AI chat
- `VITE_ANTHROPIC_API_KEY` - Anthropic Claude API
- `VITE_OPENAI_API_KEY` - OpenAI API

**Root Cause**: Using `import.meta.env.VITE_*` to access API keys. Even when stored in Doppler, the VITE_ prefix causes client bundling.

**Solution**: Create Supabase Edge Functions as backend proxies:
1. Create `supabase/functions/ai-proxy/` for all AI API calls
2. Move API keys to Supabase Edge Function secrets (not VITE_ prefixed)
3. Update frontend services to call Edge Functions instead of direct API calls

**Files**: `src/services/groqWhisper.ts`, `src/services/ai/deepseek.ts`, `src/services/ai/anthropic.ts`, `src/services/ai/openai.ts`

---

### BUG-1132: Allowlist CORS Origins - Replace Dynamic Reflection (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Current CORS configuration reflects any origin back, which is insecure. Should use explicit allowlist.

**Solution**: Configure explicit allowed origins in Caddy:
```
header Access-Control-Allow-Origin "https://in-theflow.com"
```

**Files**: VPS `/etc/caddy/Caddyfile`

---

### BUG-1133: Audit v-html XSS Sources (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: `v-html` directive used with potentially untrusted SVG content in ProjectEmojiIcon component.

**Investigation Needed**:
- Check if SVG content comes from user input or trusted source
- Add DOMPurify sanitization if user-generated
- Consider using `v-text` or component-based rendering

**Files**: `src/components/base/ProjectEmojiIcon.vue:21`

---

### BUG-1134: Enable Tauri CSP (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Tauri Content Security Policy is disabled (`"csp": null`), allowing any scripts to execute.

**Solution**: Enable CSP with appropriate policy:
```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
```

**Files**: `src-tauri/tauri.conf.json`

---

### BUG-1135: Restrict Tauri Shell Permissions (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Shell capability has `"args": true` which allows arbitrary command execution.

**Solution**: Replace with explicit command allowlist.

**Files**: `src-tauri/capabilities/default.json`

---

### BUG-1136: Add Entity Ownership Check to Tombstone RLS (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Tombstone soft-delete RLS policy may not verify entity ownership before allowing operations.

**Solution**: Ensure RLS policies check `auth.uid() = user_id` before soft delete operations.

**Files**: `supabase/migrations/`

---

### BUG-1137: Add Guest Session ID for Migration (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: When guest user signs up, their guest data may leak or not migrate properly.

**Solution**: Generate and store unique guest session ID, use it to migrate guest data on sign-up.

**Files**: `src/stores/auth.ts:361`

---

### BUG-1138: Remove isAdmin localStorage Override in Production (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Admin status can be overridden via localStorage, security risk in production.

**Solution**: Remove localStorage override or restrict to development mode only.

**Files**: `src/stores/auth.ts:122`

---

### BUG-1139: Restrict Tauri Filesystem Write Scope (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Tauri filesystem capability allows writes to `$HOME/**` which is overly broad.

**Solution**: Restrict to specific directories: `$APPDATA/**`, `$DOCUMENT/FlowState/**`

**Files**: `src-tauri/capabilities/default.json`

---

### BUG-1140: Remove Supabase URL Console Logs in Production (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Problem**: Supabase configuration URLs logged to console in production builds.

**Solution**: Wrap console.log statements with `if (import.meta.env.DEV)` check.

**Files**: `src/services/auth/supabase.ts`

---

### BUG-1141: Add CSP Headers to Limit XSS Impact (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Problem**: No Content Security Policy headers configured.

**Solution**: Add CSP headers to Caddy and Tauri config.

**Files**: `/etc/caddy/Caddyfile`, `src-tauri/tauri.conf.json`

---

### BUG-1142: Add Rate Limiting to API Calls (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Problem**: No rate limiting on API endpoints, vulnerable to abuse.

**Solution**: Implement rate limiting in Supabase Edge Functions or Caddy.

**Files**: Edge Functions, Caddy config

---

### BUG-1143: Add onUnmounted Cleanup to MobileQuickSortView (📋 PLANNED)

**Priority**: P0-CRITICAL | **Status**: 📋 PLANNED

**Problem**: Memory leak - MobileQuickSortView creates intervals/subscriptions but never cleans them up.

**Solution**: Add proper cleanup in onUnmounted lifecycle hook.

**Files**: `src/mobile/views/MobileQuickSortView.vue:979`

---

### TASK-1144: Split MobileQuickSortView.vue (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: File is 2518 lines, exceeding 500-line limit. Hard to maintain and test.

**Solution**: Extract into composables and sub-components:
- `useMobileQuickSortLogic.ts` - business logic
- `MobileQuickSortCard.vue` - card component
- `MobileQuickSortFilters.vue` - filter UI

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### TASK-1145: Split MobileInboxView.vue (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: File is 1919 lines, exceeding 500-line limit.

**Solution**: Extract into composables and sub-components.

**Files**: `src/mobile/views/MobileInboxView.vue`

---

### TASK-1146: Split useSupabaseDatabase.ts by Domain (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: File is 1736 lines with mixed concerns (tasks, groups, projects, settings).

**Solution**: Split into domain-specific composables:
- `useSupabaseTasks.ts`
- `useSupabaseGroups.ts`
- `useSupabaseProjects.ts`
- `useSupabaseSettings.ts`

**Files**: `src/composables/useSupabaseDatabase.ts`

---

### TASK-1147: Replace 199 `any` Types with Proper Interfaces (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: 199 instances of `any` type across 90 files weaken type safety.

**Solution**: Audit and replace with proper TypeScript interfaces.

**Files**: 90 files throughout codebase

---

### TASK-1148: Remove 2302 Console Statements from Production (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: 2302 console statements across 256 files pollute production logs.

**Solution**: Configure Vite to strip console in production, replace critical logs with logger service.

**Files**: 256 files, `vite.config.ts`

---

### TASK-1149: Split timer.ts into 4 Services (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Timer store is 960 lines with mixed concerns.

**Solution**: Split into focused services:
- `useTimerState.ts` - core timer state
- `useTimerSync.ts` - cross-device sync
- `useTimerAudio.ts` - sound playback
- `useTimerNotifications.ts` - notification handling

**Files**: `src/stores/timer.ts`

---

### TASK-1150: Consolidate formatDueDate/formatDateKey Duplicates (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Date formatting functions duplicated in 6 locations.

**Solution**: Create single `src/utils/dateFormatters.ts` utility.

**Files**: Multiple files with date formatting

---

### TASK-1151: Add Cleanup to Timer Store Intervals (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Timer store creates intervals that may not be properly cleaned up.

**Solution**: Track all interval IDs and clear in cleanup function.

**Files**: `src/stores/timer.ts:79-154`

---

### TASK-1152: Fix 40 eslint-disable/@ts-ignore Suppressions (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: 40 eslint-disable and @ts-ignore comments indicate tech debt.

**Solution**: Audit each suppression and fix underlying issues.

**Files**: 17 files with suppressions

---

### TASK-1153: Remove Corrupted Files from Repo (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Corrupted backup files (`.dirty`, `.clean`) exist in repo.

**Solution**: `git rm useCalendarDayView.ts.dirty useCalendarDayView.ts.clean`

**Files**: `useCalendarDayView.ts.*`

---

### TASK-1154: Standardize Error Handling Pattern (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Inconsistent error handling - some functions throw, others return null.

**Solution**: Standardize to Result type pattern or consistent throw behavior.

**Files**: `src/composables/useSupabaseDatabase.ts`

---

### TASK-1155: Split AppSidebar.vue (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: File is 1578 lines, exceeding 500-line limit.

**Solution**: Extract sections into sub-components.

**Files**: `src/layouts/AppSidebar.vue`

---

### TASK-1156: Split useBackupSystem.ts (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: File is 1411 lines, exceeding 500-line limit.

**Solution**: Split into backup strategy composables.

**Files**: `src/composables/useBackupSystem.ts`

---

### TASK-1157: Extract Magic Numbers to Named Constants (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Problem**: Magic numbers scattered throughout code.

**Solution**: Create `src/constants/` directory with named constants.

**Files**: Multiple files

---

### TASK-1158: Resolve tasks.ts ↔ canvas.ts Circular Dependency (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Circular import between tasks.ts and canvas.ts requires dynamic import workaround.

**Solution**: Extract shared types to `src/types/`, restructure imports.

**Related**: BUG-1099 (TDZ error from circular deps)

**Files**: `src/stores/tasks.ts`, `src/stores/canvas.ts`

---

### TASK-1159: Implement Optimistic Updates for Task CRUD (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: UI waits for network response before updating, causing perceived lag.

**Solution**: Update UI immediately, sync to server in background, rollback on failure.

**Files**: `src/stores/tasks.ts`, `src/composables/useSupabaseDatabase.ts`

---

### TASK-1160: Add Virtualized Task Lists (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Rendering 500+ tasks causes performance issues.

**Solution**: Implement `@tanstack/vue-virtual` for Board and Calendar views.

**Files**: Board view, Calendar view components

---

### TASK-1161: Create Shared Domain Layer for Mobile (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Mobile views duplicate logic from desktop views.

**Solution**: Create `src/domain/` with shared composables.

**Files**: `src/domain/` (new), mobile views

---

### FEATURE-1162: Smart Filters / Saved Views (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Feature**: Allow users to save filter combinations as named views.

**Implementation**:
1. Create `saved_filters` Supabase table
2. Add filter save/load UI
3. Quick access dropdown

**Files**: New migration, new components

---

### FEATURE-1163: Comments on Tasks (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Feature**: Allow users to add comments/notes to tasks.

**Implementation**:
1. Create `task_comments` Supabase table with RLS
2. Add comments UI in task detail view
3. Show comment count on task cards

**Files**: New migration, new components

---

### FEATURE-1164: Habit Tracking Mode (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: Extend recurring tasks to support habit tracking with streaks and statistics.

**Files**: Task types, new views

---

### FEATURE-1165: Universal Quick Capture (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: System-wide task capture via menu bar (Mac), system tray (Windows/Linux).

**Files**: Tauri system tray, platform-specific implementations

---

### FEATURE-1166: Create Public API (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: REST API for external integrations (Zapier, IFTTT, custom scripts).

**Files**: New Edge Functions, API documentation

---

### FEATURE-1167: Mobile Canvas (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: Simplified canvas for mobile with touch gestures (pinch-zoom, drag).

**Files**: New mobile canvas component

---

### ~~FEATURE-1194~~: Tauri In-App Auto-Updater via VPS (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-06)

**Feature**: "Update App" button inside FlowState that checks VPS for newer builds, downloads, and installs them automatically - no terminal or `dpkg -i` needed.

**Architecture**:
1. **VPS endpoint** (`in-theflow.com/updates/`) - Caddy serves update manifest JSON + AppImage binaries
2. **Tauri updater plugin** (`@tauri-apps/plugin-updater@2.10.0`) - built-in self-update mechanism
3. **CI/CD pipeline** - GitHub Actions builds multi-platform Tauri binaries on push/tag, rsyncs to VPS
4. **App UI** - "Check for Updates" button in Settings, notification on app launch when update available
5. **AppImage ONLY** - .deb installs cannot self-update (Tauri limitation). User runs AppImage from `~/Applications/`

**Implementation Steps**:
- [x] Configure `@tauri-apps/plugin-updater` in `tauri.conf.json` with VPS update endpoint
- [x] Set up VPS directory structure (`/var/www/flowstate/updates/`) with Caddy serving
- [x] Create update manifest generation script (`scripts/generate-update-manifest.cjs`)
- [x] Modify GitHub Actions release workflow to build + upload binaries to VPS
- [x] Code-signing configured (signing keys + pubkey, password in KWallet)
- [x] Add "Check for Updates" UI in Settings > About tab
- [x] Auto-check on app launch with non-intrusive notification (existing `TauriUpdateNotification.vue`)
- [x] Automated deploy script (`scripts/deploy-tauri-update.sh`)
- [x] Fix `createUpdaterArtifacts` from "v1Compatible" to `true` (v2 format)
- [x] Fix manifest generator to filter by current version (was picking up old artifacts)
- [x] Bump tauri crate to 2.10, plugin-updater to 2.10.0
- [x] Test full update cycle: build → upload → detect → download → install → restart ✅ VERIFIED

**Completed (2026-02-06):** Full E2E update cycle verified: v1.2.15 AppImage detected v1.2.16 on VPS, downloaded, installed, and restarted successfully. Key fixes: switched to v2 artifact format, fixed manifest generator version filtering, regenerated signing keys, updated all documentation.

**Key Files**:
- `src-tauri/tauri.conf.json` - Updater plugin config (endpoint: `in-theflow.com/updates/latest.json`)
- `.github/workflows/release.yml` - CI/CD for multi-platform builds + VPS deploy
- `.github/workflows/deploy.yml` - Modified to exclude `/updates/` from rsync delete
- `scripts/generate-update-manifest.cjs` - Generates `latest.json` from build artifacts
- `scripts/tauri-build-signed.sh` - Build script with signing key loading
- `scripts/tauri-upload-update.sh` - Upload artifacts to VPS
- `src/components/settings/tabs/AboutSettingsTab.vue` - Update UI in Settings
- `src/composables/useTauriUpdater.ts` - Updater composable
- `src/components/common/TauriUpdateNotification.vue` - Launch notification
- VPS `/var/www/flowstate/updates/` - Hosted binaries + manifest

---

### TASK-1168: Add Unit Tests for Sync/Conflict Resolution (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Sync and conflict resolution logic has only 4 unit tests, high risk area.

**Solution**: Add comprehensive test coverage for sync edge cases.

**Files**: `tests/unit/sync/`

---

### TASK-1169: Add Unit Tests for Database Layer (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: No dedicated tests for database composable.

**Solution**: Add tests with mocked Supabase client.

**Files**: `tests/unit/composables/useSupabaseDatabase.spec.ts`

---

### TASK-1170: Add Cross-Device Timer Sync Tests (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Timer sync between devices has limited test coverage.

**Solution**: Add tests for device leadership, heartbeat, and state sync.

**Files**: `tests/unit/stores/timer.spec.ts`

---

### TASK-1171: Add Mobile View E2E Tests (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Mobile views have E2E test coverage gaps.

**Solution**: Add Playwright tests for mobile viewport.

**Files**: `tests/e2e/mobile/`

---

### TASK-1172: Update VueUse 10.11 → 14.1 (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: VueUse is 4 major versions behind.

**Prerequisites**: Requires Vue 3.5+ upgrade first.

**Files**: `package.json`

---

### TASK-1173: Replace Deprecated crypto-js (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: crypto-js has CVE-2023-46233 vulnerability and is deprecated.

**Solution**: Replace with Web Crypto API or modern alternative.

**Files**: Files using crypto-js

---

### TASK-1174: Fix 16 npm Audit Vulnerabilities (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: 16 vulnerabilities (0 critical, 2 high, 14 moderate).

**Solution**: Run `npm audit fix` and address remaining issues.

**Files**: `package.json`, `package-lock.json`

---

### TASK-1175: Fix 349 Linter Errors (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Problem**: 349 ESLint errors and 292 warnings.

**Solution**: Run `npm run lint --fix` and manually fix remaining issues.

**Files**: Multiple files

---

### System Review Summary

**Metrics**:
- Tests: 587 passed, 28 todo (615 total)
- Linter: 349 errors, 292 warnings
- npm audit: 16 vulnerabilities (0 critical, 2 high)
- Codebase: 585 files, 136,067 lines of code


---


## Dev-Maestro Orchestrator (TASK-303)

**Status**: ⏸️ PAUSED | **SOP**: `docs/sop/SOP-010-dev-manager-orchestrator.md`

Enables Claude agents to implement code changes using git worktrees for isolation.

**Architecture**: User Goal → Questions → Plan → Execute (Worktrees) → Review → Merge/Discard

**Completed Subtasks**: ~~TASK-319~~ (output capture), ~~TASK-320~~ (completion detection), ~~TASK-323~~ (stale cleanup), ~~FEATURE-1012~~ (tech stack detection) - See archive.

### Pending Subtasks

| Task | Priority | Description |
|------|----------|-------------|
| BUG-1113 | P0 | Stale worktrees not cleaned up - forces Claude Code context bloat |
| BUG-1019 | P0 | Swarm agent cleanup + OOM prevention |
| TASK-321 | P2 | Test merge/discard workflow E2E |
| TASK-322 | P2 | Automatic error recovery (exponential backoff, partial progress) |
| FEATURE-1013 | P2 | Auto-detect data layer (Pinia, Supabase) |
| FEATURE-1014 | P2 | Smart questions with pros/cons |
| FEATURE-1015 | P2 | Project context caching |

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

### ROAD-010: Gamification - "Cyberflow" (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (2026-01-30)

**Parent Feature**: FEATURE-1118

**Sub-Features**:
- FEATURE-1132: AI Game Master Challenge System (🔄 IN PROGRESS)
  - Database migration: `user_challenges`, `challenge_history` tables
  - Types: `src/types/challenges.ts`
  - Store: `src/stores/challenges.ts`
  - AI Game Master: `src/services/ai/gamemaster.ts`, `challengeTemplates.ts`
  - UI: CorruptionOverlay, ChallengeCard, DailyChallengesPanel, BossFightPanel
  - Integration: `useGamificationHooks.ts` tracks challenge progress
  - Skill: `.claude/skills/cyberflow-rpg/SKILL.md`

**Blocking**: BUG-1204 - Apply migration to database (table returns 404)

---

### FEATURE-1118: Gamification System - Design & Implementation (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (2026-01-30)

**Goal**: Add game-like elements to FlowState to increase engagement and make productivity feel rewarding.

**Design Session**: In progress...

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
