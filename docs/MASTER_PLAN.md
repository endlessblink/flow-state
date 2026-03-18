# FlowState MASTER_PLAN.md

> **Last Updated**: February 19, 2026
> **Token Target**: <25,000 (condensed from ~50,000)
> **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md`

---

## Active Tasks

### ~~TASK-1560~~: Redesign SidebarWorkspaceSwitcher — always-visible with create workspace flow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-16)

**Scope**: Redesign `src/components/sidebar/SidebarWorkspaceSwitcher.vue` to always show (remove `v-if="shouldShowSwitcher"`), add inline workspace creation with name input + teal confirm button, add copy-invite-link per shared workspace, and add 5 missing translation keys to both locale files.

---

## Workspace Collaboration — Post-Implementation Bugs

### BUG-1561: Sync queue classifyError fails on Supabase PostgrestError objects (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (2026-03-17)

**Problem**: `classifyError()` in `retryStrategy.ts` calls `String(error)` on Supabase `PostgrestError` objects (plain objects, NOT `instanceof Error`). This produces `"[object Object]"` — all PostgREST errors fall through to `'unknown'` → retried infinitely → rate limit cascade → app goes offline.

**Root cause**: PostgrestError has `.message` property but is not an `Error` instance. `classifyError` only checks `instanceof Error`.

**Fix**: Extract `.message` from plain objects before classification. Already implemented in `src/services/offline/retryStrategy.ts`.

**Files**: `src/services/offline/retryStrategy.ts`

---

### BUG-1562: taskPersistence smart-merge enqueues raw camelCase payloads to sync queue (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (2026-03-17)

**Problem**: `taskPersistence.ts:416-420` enqueues raw app-side task objects (with `_soft_deleted`, `projectId`, `isInInbox` etc.) directly to the sync queue, bypassing `toSupabaseTask()`. When the queue processes these, Supabase returns 400 because camelCase fields don't exist as DB columns.

**Root cause**: Smart-merge local-only task preservation used `payload: localTask as unknown as Record<string, unknown>` instead of mapping through `toSupabaseTask()`.

**Fix**: Use `toSupabaseTask()` mapper before enqueueing. Already implemented in `src/stores/tasks/taskPersistence.ts`.

**Files**: `src/stores/tasks/taskPersistence.ts`

---

### BUG-1563: Workspace switch shows personal tasks in shared workspace (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (2026-03-17)

**Problem**: When switching to a shared workspace, the empty-overwrite protection in `taskPersistence.ts` and `canvas.ts` blocks loading 0 tasks (legitimate for an empty workspace), keeping 216 personal tasks visible.

**Root cause**: BUG-169 safety guard treats "0 loaded, N existing" as data loss — doesn't account for workspace switches where 0 tasks IS correct.

**Fix**: Check `isSwitchingWorkspace` flag from workspace store to bypass protection during switches. Already implemented in `taskPersistence.ts`, `canvas.ts`, `canvasGroups.ts`.

**Files**: `src/stores/tasks/taskPersistence.ts`, `src/stores/canvas.ts`, `src/stores/canvas/canvasGroups.ts`

---

### BUG-1564: loadMembers() PGRST200 — cross-schema JOIN to auth.users fails (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17)

**Problem**: `loadMembers()` in workspace store uses PostgREST JOIN to `auth.users` which is in a different schema. PostgREST can't resolve the FK.

**Fix**: Removed the JOIN, fetch raw member records only. Display names deferred to Phase 3 profiles table.

**Files**: `src/stores/workspace.ts`

---

### BUG-1565: Sync queue processes during workspace switch causing 400s (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17)

**Problem**: When switching workspaces, realtime events for departing tasks trigger sync queue operations that upsert with stale context.

**Fix**: Added `isSwitchingWorkspace` flag to workspace store, sync queue's `processQueue()` checks it before processing.

**Files**: `src/stores/workspace.ts`, `src/composables/sync/useSyncOrchestrator.ts`

---

### BUG-1566: One-time IndexedDB cleanup needed after camelCase payload contamination (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (2026-03-17)

**Problem**: Stale sync queue ops with camelCase payloads accumulated in IndexedDB before BUG-1562 fix. These ops retry infinitely (due to BUG-1561), causing rate limit cascades that take down the entire app on every page load.

**Fix**: One-time `indexedDB.deleteDatabase()` cleanup at app startup in `main.ts`. Cleanup guard uses localStorage key so it runs only once. Safe because all tasks exist in production DB. Should be removed after cleanup completes.

**Files**: `src/main.ts`

---

## Test Failures (P2)

### ~~BUG-1568~~: WebKitGTK CSS safety test fails — text-overflow: clip in CategorySelector (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `CategorySelector.vue` style block line 198 uses `text-overflow: clip !important` without the required `/* WebKitGTK-safe */` annotation. The `css-syntax.test.ts` safety test catches this as a potential Tauri/WebKitGTK compatibility issue.

**Fix**: Add `/* WebKitGTK-safe */` annotation on the same line, or replace `text-overflow: clip` with a WebKitGTK-compatible alternative.

**Files**: `src/components/layout/CategorySelector.vue`

---

### ~~BUG-1569~~: Circular dependency — timer.ts → tasks.ts → taskStates.ts → projects.ts → taskOperations.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `dependencies.test.ts` detects a circular import cycle: `timer.ts` → `tasks.ts` → `taskStates.ts` → `projects.ts` → `taskOperations.ts` → back to `timer.ts`. This can cause initialization ordering issues and makes the codebase harder to reason about.

**Fix**: Extract shared types/utilities into a separate module, use dynamic imports, or restructure store dependencies to break the cycle.

**Files**: `src/stores/timer.ts`, `src/stores/tasks.ts`, `src/stores/tasks/taskStates.ts`, `src/stores/projects.ts`, `src/stores/tasks/taskOperations.ts`

---

### ~~BUG-1570~~: Task filtering test fails — "today" smart view returns 0 tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `tasks.test.ts` "filters tasks by today smart view" expects `filteredTasks.length >= 1` after `setSmartView('today')`, but gets 0. Either the test seed data isn't creating a task with today's date correctly, or the smart view filter logic has a date comparison bug.

**Fix**: Investigate whether the test setup creates tasks with `dueDate` set to today correctly, and whether `setSmartView('today')` filter matches the expected format. Fix the test or the filter logic.

**Files**: `src/stores/__tests__/tasks.test.ts`, `src/stores/tasks/taskStates.ts`

---

## Active Bugs (P0-P1)

### ~~BUG-1523~~: iCal parser skips ALL recurring events — RRULE expansion missing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `useExternalCalendar.ts` lines 96-98 explicitly `continue` on any event with `RRULE:` that lacks a `RECURRENCE-ID`. This means every recurring event (weekly standups, daily check-ins, monthly 1:1s) is silently dropped. Only one-off events appear in the calendar.

**Fix**: Implement lightweight RRULE expansion (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY) generating instances in a -30/+90 day window. Cap at 500 instances. Replace the `continue` with expansion logic. Keep `RECURRENCE-ID` override detection.

---

### ~~BUG-1526~~: Push notification click actions dead — no client-side SW message handler (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `src/sw.ts` sends `NAVIGATE_TO_TASK`, `NAVIGATE_TO`, and `SNOOZE_NOTIFICATION` messages to open clients after a push notification click. No handler existed on the client to act on these messages — clicks had zero effect.

**Fix**: Added a `navigator.serviceWorker` `message` event listener in `useAppInitialization.ts` (lines 864–905). Handles all three message types: routes to `/focus/:taskId`, pushes arbitrary URLs via router, and snoozes the matching notification via `notificationStore.snoozeNotification()`. Listener is registered at composable setup time and cleaned up in `onUnmounted`.

---

### ~~BUG-1533~~: Task duplication, ghost reappearance, and sync resurrection bugs (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-16)

**12 bugs fixed**: Canvas Delete moved to inbox instead of deleting, sync queue CREATE resurrected deleted tasks (tombstone check added), cross-tab DELETE spliced wrong array, doneForNow double-invocation guard, calendarFilteredTasks missing dedup, createTask pre-push duplicate guard, done tasks staying in inbox, smart merge 5-min resurrection window (→30s), coalescer blind to syncing ops, stale queue 24h purge, recurrence unique DB constraint, stale comment fix. Production DB cleanup: 174 done tasks cleared from inbox.

### BUG-1508: Permanently deleting a recurring task causes infinite recreation loop (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (being fixed in separate instance)

**Problem**: When a recurring task is permanently deleted, the deferred recurrence scheduler (`useRecurrenceScheduler.ts`) finds an older `done` ancestor with `recurrenceRule` still set, sees no active successor (deleted task is gone from `_rawTasks`), and creates a new clone — effectively resurrecting the deleted task. This loops infinitely: delete → scheduler recreates → delete → recreates.

**Fix approach**: When permanently deleting a recurring task, advance the recurrence chain first (bump `recurrenceCount`/`lastRecurrenceDate` on the ancestor) so the scheduler creates the *next* occurrence, not the same one again. This preserves the recurring series while respecting the deletion.

---

### ~~BUG-1509~~: Undo deleted task vanishes on next refresh — is_deleted not cleared (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Ctrl+Z after deleting a task re-creates it locally via `createTask` upsert, but the upsert payload never includes `is_deleted: false`. The DB row stays `is_deleted: true`. On next page refresh, `fetchTasks` filters it out and the task silently disappears.

**Root cause**: `createTask` in `taskOperations.ts` spreads `taskDataWithoutPositionAndInstances` which carries `_soft_deleted: true` from undo snapshots (if realtime echo processed before undo). The sync queue payload was patched but the direct Supabase write via `toSupabaseTask` still read `_soft_deleted` → wrote `is_deleted: true`.

**Fix**: Added `_soft_deleted: false, deletedAt: undefined` after the spread in `createTask` (`taskOperations.ts:144-148`) so they always override any stale flags from the undo snapshot.

---

### ~~BUG-1510~~: Delete canvas group orphans child tasks — they vanish (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `deleteGroup` in `canvasGroups.ts` removes the group but doesn't clear `parentId` on child tasks. Canvas renderer skips tasks with missing parent. Deferred cleanup has no retry — if it fails, tasks stay invisible.

**Fix**: Before deleting a group, explicitly clear `parentId` on all child tasks. Positions are already absolute — no conversion needed.

---

### ~~BUG-1511~~: Timer dual leadership — no atomic CAS allows two leaders (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: Timer leadership is claimed by writing `device_leader_id` without checking if someone else already claimed it. Two devices can both become leader → timer counts at 2x speed → session completes twice → double XP (BUG-1513).

**Fix implemented**:
- `supabase/migrations/20260313210000_atomic_timer_leadership.sql`: `claim_timer_leadership` RPC with conditional UPDATE
- `src/composables/supabase/useTimerDatabase.ts`: added `claimLeadership()` wrapper
- `src/composables/timer/useTimerSync.ts`: all 3 leadership-claim sites + heartbeat now use atomic RPC; heartbeat demotes itself if lease lost
- `src/stores/timer.ts`: passes `claimLeadership` through to `useTimerSync` deps

---

### ~~BUG-1512~~: Timer session expires while app closed — silently discarded (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: When app reopens and recovery detects `remainingTime <= 0`, it marks session inactive but never calls `completeSession()`. No pomodoro count, no XP, no history entry.

**Fix**: In `useTimerSync.ts` recovery path, set `currentSession.value` with the expired session (remainingTime=0) then call `onCountdownComplete()` instead of the manual DB-only update. This routes through `completeSession()` for full credit.

---

### ~~BUG-1513~~: Double XP under dual timer leadership (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14, resolved by BUG-1511 fix)

**Problem**: When two devices are both timer leaders (BUG-1511), both independently call `completeSession()` and award XP. The `isCompleting` lock only protects within a single JS context.

**Fix**: Resolves automatically when BUG-1511 is fixed (atomic leadership).

---

### ~~BUG-1514~~: Auth refresh fails after offline — pending writes permanently orphaned (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: When token expires offline and refresh fails on reconnect, `auth.ts` cleared the session unconditionally on the first refresh attempt. Pending sync writes were orphaned with no auth token and permanently failed.

**Fix**: Replaced the single raw `refreshSession()` call in the `window.addEventListener('online', ...)` handler with a retry loop (up to 3 attempts, exponential backoff: 1s, 3s, 9s). Session is only cleared if ALL retries fail. Each attempt is logged. The existing `performTokenRefresh` function (proactive timer refresh) already had retry logic — the online reconnect handler now follows the same pattern.

---

### ~~BUG-1515~~: Undo task completion doesn't revert XP or stats (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: Complete task → earn XP. Ctrl+Z → task goes back to todo. XP stays. No `onTaskUncompleted` hook exists. Exploitable: complete-undo-complete loop for infinite XP.

**Fix**: Added `deductXp()` and `decrementStat()` to `gamification.ts`. Added `onTaskUncompleted()` to `useGamificationHooks.ts`. Wired into the `wasDone && isNowNotDone` branch in `taskOperations.ts`. Levels are intentionally not decremented (they are permanent). XP deduction is clamped at 0. Negative xp_log entries written for auditability.

---

### ~~BUG-1516~~: Multi-device edit overwrites — whole-document LWW loses field-level changes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: Sync payload includes ALL task fields, not just changed ones. Edit title on phone, edit description on desktop → last save overwrites the other's field. Silent data loss.

**Fix**: Track which fields changed in `updateTask`, send only those in the sync payload.

---

### ~~BUG-1517~~: Auth token expires mid-sync — remaining operations permanently abandoned (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: 401 during sync is classified as `permanent` error. Retry set to 1 year out. All remaining queued operations also fail and get abandoned. No token refresh attempted.

**Fix**: Add `auth` error category in retry strategy. On 401, call `supabase.auth.refreshSession()` before retrying. Only permanent-fail if refresh itself fails.

---

### ~~BUG-1530~~: Dragging task to Today canvas group doesn't update Calendar inbox (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: When a task is dragged into the "Today" group on the canvas, the due date gets set to today but the task doesn't appear in the Calendar inbox when filtered to "Today". The calendar inbox shows stale data and doesn't reflect the canvas group assignment.

**Fix**: Investigate whether the canvas drop handler properly sets `due_date` and whether the calendar inbox's Today filter watches for reactive due_date changes. Likely a reactivity or sync issue between canvas group membership and the calendar view's task filtering.

---

### BUG-1529: Context menu shows wrong multi-select count (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: Right-clicking a single task in the calendar/board view shows "Mark 6 as Done" and "Delete 6" instead of just "Mark as Done" — the selection count is wrong, showing stale/phantom selections. The menu displays an inflated count of selected tasks (6) even when only 1 task is actually selected.

**Root cause**: Context menu selection count not clearing properly between interactions, or multi-select state persisting across view switches/interactions.

**Fix**: Investigate and resolve stale multi-select state in context menu rendering. Ensure selection count matches actual selected tasks on each context menu open.

---

### ~~BUG-1502~~: "Sync external calendars" button doesn't sync Google Calendar (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-12)

**Problem**: Clicking "Sync external calendars" in the calendar header dropdown only triggered iCal sync (`externalCalendar.syncNow`), not Google Calendar sync. Google Calendar events only refreshed on page mount or every 30 minutes via polling interval — manual sync button was ineffective.

**Fix**: Created `syncAllExternalCalendars()` handler in `CalendarView.vue` that calls both `externalCalendar.syncNow()` and `googleCalendar.syncNow()`. Wired it to the `@sync-external-calendar` event.

---

### ~~BUG-1449~~: KDE widget notification barrage + popup dismiss + nanny task selection (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-05)

**Problems**: Six KDE widget bugs — pre-end warning & overlay card inner MouseArea absorbed clicks instead of dismissing; session completion triggered multiple notifications (barrage) when concurrent `checkSessionCompletion()` XHR calls each fired `onSessionComplete()`; nanny popup task click passed pinned_tasks table ID instead of real task ID; nanny popup too narrow (buttons clipped); overlay card too short (dismiss text clipped); Start Work button used solid fill.

**Fixes**: Dismiss on card click; dual barrage guard (`checkingCompletion` + `sessionJustCompleted`); nanny uses `selectPinnedTask()`; popup 500x380; overlay card height 400; glass morphism button.

---

### ~~BUG-1432~~: Overdue tasks display today's date instead of actual due date (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-05)

**Problem**: Tasks that should appear as overdue are shown with today's date everywhere — visible in the "Today" group on the canvas. Their actual due date is being overwritten or misread as the current date.

**Root cause**: Two paths: (1) `useMoveToCanvasGroup.ts` — "Move to Group" context menu blindly spread `getSectionProperties()` into task updates, overwriting existing dueDate with today's date. (2) `taskValidation.ts` sanitizer defaulted missing dueDate to today instead of empty string.

**Fix**: Added dueDate guard in `useMoveToCanvasGroup.ts` (matching existing guard in `useUnifiedInboxActions.ts`). Changed sanitizer fallback to empty string.

---

### ~~BUG-1430~~: Sidebar Date Filters Navigate to Catalog View (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-02)

**Problem**: Clicking "Today", "This Week", or other smart view filters in the sidebar navigated users to the Catalog view (`/tasks`) instead of staying on the current view (Canvas, Board, Calendar).

**Root cause**: `AppSidebar.vue:976` had an unconditional `router.push('/tasks')` in the local `selectSmartView` function (from TASK-1330).

**Fix**: Made navigation conditional — only navigate to `/tasks` if the current route doesn't support smart view filters (Canvas `/`, Board `/board`, Calendar `/calendar`, Catalog `/tasks`/`/catalog` all support them natively).

---

### ~~BUG-1429~~: Calendar Inbox Duplicate Display (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-02)

**Problem**: Tasks dragged from Calendar Inbox onto calendar grid remain visible in the inbox after being scheduled, creating duplicate task entries.

**Root cause**: TASK-1412 added `canvasOrder` sort which bypasses the scheduling check in `useUnifiedInboxState.ts`. When a task is dragged to the calendar and assigned a date, the inbox filter should remove it (task is now scheduled), but the inbox still displays it due to the filter logic being skipped.

**Fix** (in progress):
1. `useUnifiedInboxState.ts`: Restore scheduling check in filter logic even when using `canvasOrder` sort
2. Verify inbox filter properly excludes scheduled tasks regardless of sort mode
3. Test drag-drop from inbox to calendar grid doesn't leave duplicate entries

---

### ~~BUG-1411~~: Supabase fetch timeout storm — cascading AbortErrors crash sync (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-23)

**Problem**: `fetchActiveTimerSession` polls every ~10s. When VPS/network is slow, each call times out at `supabase.ts:105` (`AbortError`), spawning 3 retries (500ms → 1s → 2s). Before retries finish, the next poll fires — creating overlapping retry cascades.

**Fix** (7 files changed + 1 new):
1. **Timer poll guards** (`useTimerSync.ts`): `isSaving` mutex on heartbeat, `isPolling` mutex on follower poll, consecutive failure backoff (30s after 3 failures)
2. **Fetch timeout 10s → 30s** (`supabase.ts`): VPS can be slow under load, 10s was too aggressive
3. **Offline-first read cache** (`readCacheDB.ts` NEW): Dexie IndexedDB database caches tasks/groups/projects after every successful Supabase fetch
4. **Cache fallback** (`taskPersistence.ts`, `projects.ts`, `canvas.ts`): When Supabase is unreachable, load last-known-good data from IndexedDB cache
5. **Offline mode indicator** (`syncStatus.ts`): Shows "Offline — showing cached data (Xmin old)" in sync status
6. **Auto-reconnect** (`useAppInitialization.ts`): Listens for `online` event, auto-reloads from Supabase when connectivity returns
7. **Cache isolation** (`auth.ts`): Clears read cache on sign-out to prevent data leaking between users
8. **75 tests** covering cache CRUD, offline fallback cycles, large datasets, sign-out isolation

---

### ~~BUG-1410~~: Done tasks still appear on canvas after marking as done (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-13)

**Problem**: When marking a task as done, it remains visible on the canvas instead of being removed/hidden.

**Root causes**: (1) Auto-archive didn't increment `positionVersion`, so sync could restore old position. (2) Sync handler restored canvas positions for done tasks. (3) No UI toggle to control `hideCanvasDoneTasks` on canvas.

**Fix**: 4 changes across 3 files:
1. `taskOperations.ts`: Auto-archive now increments `positionVersion`; merge respects it via `syncedUpdates.positionVersion ?? newVersion`
2. `tasks.ts`: Sync handler skips position restoration for `status === 'done'` tasks (2 locations)
3. `CanvasToolbar.vue`: Added "Show/Hide done tasks" toggle button

---

### ~~BUG-1408~~: Canvas tasks get blurry when zooming out (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-23)

**Problem**: Task nodes on the canvas become blurry/pixelated when zooming out. Regression from BUG-1216 which removed `transform-style: preserve-3d` and changed `backface-visibility` to `hidden` on the viewport.

**Fix**: Restored `transform-style: preserve-3d !important` and `backface-visibility: visible !important` on `.vue-flow__transformation-pane`/`.vue-flow__viewport` in `vue-flow-overrides.css`. This prevents the browser from flattening all nodes into a single bitmap texture — each node renders independently at display resolution, staying crisp at any zoom level.

---

### ~~TASK-1428~~: Auto-inherit group properties when creating task in a group (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-03)

**Problem**: Creating a task inside a group like "Today" should automatically assign that group's properties to the new task (e.g., today's due date). Currently the user must manually set properties after creation.

**Scope**: Investigate which group types carry inheritable properties (date-based groups, status groups, priority groups, project groups) and implement reliable auto-assignment on task creation within those groups.

---

### ~~TASK-1412~~: Calendar Inbox Canvas Order Sort — right-to-left DFS + sort direction toggle (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Problem**: The Calendar inbox `canvasOrder` sort used simple group X position (left→right), without connection-aware DFS for nested tasks and with no way to reverse the order. Users wanted right-to-left ordering (rightmost canvas columns first) and a toggle to flip any sort direction.

**Fix**:
1. `useUnifiedInboxState.ts`: Added `SortDirection` type + `sortDirection` persistent state. `canvasOrder` now sorts groups by descending X (right-to-left), then DFS within each group using `parentTaskId` tree structure. Other sort modes multiplied by `dir` to support asc/desc.
2. `UnifiedInboxPanel.vue`: Destructures and passes `sortDirection` down to header.
3. `UnifiedInboxHeader.vue`: Imports `SortDirection`, adds prop + emit, passes to `InboxFilters`.
4. `InboxFilters.vue`: Imports icons + type, adds prop/emit, renders toggle button after canvas-order sort button.

---

### ~~TASK-1435~~: Active Task Glass Pill — KDE Companion Widget + AppHeader (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-03)

**Problem/Opportunity**: When a Pomodoro timer is running on a task, the user wants to see the active task name at a glance — both in the web app header and in the KDE Plasma panel next to the timer widget.

**Approach**: Two-part implementation:
1. **Web app**: Glass-morphism pill in `AppHeader.vue` next to the timer, showing project color dot + task name with smooth enter/leave transitions
2. **KDE Plasma widget**: Separate companion widget (`com.pomoflow.activetask`) that reads task state from `/tmp/flowstate-active-task.json` written by the main timer widget via a temp file bridge

**Key decisions**:
- Temp file bridge avoids duplicating Supabase auth in the companion widget
- Main widget resolves task name inline in `writeActiveTaskFile()` for reliable reactivity
- Companion widget uses `Plasma5Support.DataSource` with shell `cat` command (not XMLHttpRequest, which is sandboxed in Plasma widgets)

**Steps**:
- [x] ~~AppHeader.vue: add glass pill with project dot + task name + transitions~~ ✅
- [x] ~~Main KDE widget: add `currentTaskName` property + `writeActiveTaskFile()` bridge~~ ✅
- [x] ~~New KDE widget: `packages/kde-widget-active-task/` with compact pill + full popup~~ ✅
- [x] ~~Install script + metadata.json for `com.pomoflow.activetask`~~ ✅

---

### ~~TASK-1424~~: KDE Widget Nanny Notifications — Schedule-Gated Idle Reminders (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-03)

**Problem/Opportunity**: User wants a gentle reminder from the KDE widget when no Pomodoro session is active during configured work hours. Must be helpful without being counterproductive (notification fatigue, guilt, off-hours annoyance).

**Research findings**: Clockify/Toggl Track model is best practice — schedule-gated, low-frequency, invitation-framed. Guilt framing (Duolingo-style) backfires long-term. Key: reminders should feel like a friendly assistant, not a boss.

**Approach** (evidence-based):
1. **Settings**: opt-in (default OFF), configurable work hours (Mon-Fri 9am-6pm default), trigger threshold (30/60/90 min of no active session), intensity/tone preference
2. **Trigger logic**: `IF (current day in active_days) AND (current time in work_hours) AND (no timer running for >= threshold) THEN notify`
3. **Notification**: KDE system notification with positive framing, rotating message bank (5-10 variants), one-click "Start Session" action
4. **Escape valves**: "Snooze 1hr", "Quiet today", configurable or disable entirely
5. **Never fire** if Pomodoro or break timer is currently active
6. **Cap**: max 1 notification per hour

**Steps**:
- [ ] Add nanny notification settings to KDE widget config UI (enable/disable, work hours, days, interval, tone)
- [ ] Implement idle detection timer in widget (poll timer status, track idle duration)
- [ ] Create message bank with 5-10 positive-framed rotation variants
- [ ] Wire KDE system notifications with "Start Session" + "Snooze" actions
- [ ] Add "Quiet today" toggle to widget UI
- [ ] Test edge cases (break timer active, outside work hours, snooze expiry)

---

### ~~FEATURE-1414~~: Task Image Attachments via Google Drive (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-02)

**Problem/Opportunity**: Users want to attach images to tasks. VPS storage is limited (Contabo), so images must be stored externally. Google Drive is the chosen backend — user already has Google OAuth configured via Supabase for Calendar integration.

**Approach**: Add `drive.file` scope to existing OAuth, create `google-drive-proxy` edge function (mirrors calendar proxy pattern), add `attachments` JSONB column to tasks table, build drag-drop upload UI in task editor. Client-side image compression (max 1920px, JPEG 0.8). Files stored in auto-created `FlowState/` Drive folder. Client-side thumbnail generation for instant preview.

**Steps**:
- [x] ~~Add `drive.file` scope to OAuth in `auth.ts`~~ ✅
- [x] ~~Rename calendar-specific token keys to generic (`googleCalendarToken` → `googleProviderToken`)~~ ✅
- [x] ~~Create `google-drive-proxy` edge function~~ ✅
- [x] ~~Create `googleDriveService.ts` client service~~ ✅
- [x] ~~Add `TaskAttachment` type + `attachments` field to Task + mappers + migration~~ ✅
- [x] ~~Build `TaskAttachments.vue` upload UI in task editor~~ ✅
- [x] ~~Self-hoster setup guide (SOP-038)~~ ✅

---

### ~~TASK-1409~~: Highlight active/in-progress tasks in Calendar view (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-23)

**Problem**: In the Calendar day/week view, tasks that are active (status = "in progress") look identical to other tasks. They should have a visual highlight (e.g., teal border glow or accent indicator) so the user can instantly see what they're currently working on.

**Fix**: Added `status-active` CSS class to all 3 calendar views (Day, Week, Month). In-progress tasks get a teal left border (`--brand-primary`) with subtle inset glow (`--brand-primary-dim`). Follows same pattern as existing `status-done` class. Uses design tokens only — no hardcoded colors.

---

### ~~TASK-1405~~: Replace LLM Distribution with Deterministic Algorithm in Weekly Plan (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Weekly Plan AI used LLM (Llama 3.3 70B via Groq) to assign tasks to days. Even with detailed MANDATORY RULES prompts, the LLM ignored routine preferences, misplaced tasks, and produced generic reasoning.

**Fix**: Replaced Step 1 (LLM distribution) with a deterministic 4-tier algorithm:
- **Tier 1**: Hard constraints (due dates, routine keyword matches from memory graph)
- **Tier 2**: Urgency (overdue spread via round-robin across Mon-Wed, in-progress early)
- **Tier 3**: Priority (high-priority on peak days, top-priority project batching)
- **Tier 4**: Fill (day scoring by capacity, project batching, complexity/meeting-day penalties)

Kept: LLM week theme (Step 3), dynamic questions, all memory/profile infrastructure. Removed ~300 lines of LLM prompt building + rebalancer + fallback plan code.

---

### ~~TASK-1403~~: Recurring Tasks — Clone-on-Complete with recurrence_rule column (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-22)

Added `recurrence_rule`, `recurrence_parent_id`, `recurrence_count` columns to tasks table. When a recurring task is completed, the system clones it as a new task with the next due date. Replaces old pre-generated instances approach.

### ~~TASK-1402~~: Decouple canvas/calendar inbox filtering — isInInbox now user-controlled (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-22)

**Problem**: Placing a task on canvas set `isInInbox: false`, hiding it from **both** canvas AND calendar inboxes. Same for scheduling on calendar. `isInInbox` was auto-toggled by 13 placement actions instead of being a user-controlled flag.

**Fix**: Removed all 13 auto-set `isInInbox: false` from placement actions across 10 files. Inbox visibility now uses position-based filtering: canvas inbox checks `!canvasPosition`, calendar inbox checks `!isScheduledOnCalendar`. `isInInbox` is now purely a user-controlled "remove from inbox" flag. Data migration applied (213 rows restored on VPS).

---

### ~~BUG-1407~~: Canvas node connections don't work (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-23)

**Problem**: Cannot connect canvas task nodes by dragging from handle to handle. Connections silently fail with no feedback.

**Root Cause**: 5 issues: (1) `connect-on-drag-nodes` invalid Vue Flow prop (silently ignored), (2) no `connectionMode` (default "strict" too restrictive), (3) no `connectionRadius` (20px too small), (4) silent rejection when target had `parentTaskId` (no re-parenting), (5) `syncEdges()` without `force: true`.

**Fix**: Removed invalid prop, added `connection-mode="loose"` + `:connection-radius="30"`, allowed re-parenting, force-synced edges on user-initiated connections.

---

### ~~BUG-1404~~: Context menu dropdowns don't work from search right-click (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-22)

**Problem**: Right-clicking a task in the SearchModal (Cmd+K) opens the TaskContextMenu correctly, but the hover submenus (Project, Status, Duration) are unreachable — they render behind the search overlay.

**Root Cause**: Z-index layering. SearchModal overlay is `z-index: 1400` (`--z-popover`). TaskContextMenu is `z-index: 9999` (above overlay ✅). But submenus are Teleported to `<body>` with `z-index: calc(--z-dropdown + 1) = 1001` — below the search overlay (1400) ❌.

**Fix**:
1. All 4 submenu components: Changed `z-index` from `calc(var(--z-dropdown) + 1)` to `10001` (above search overlay)
2. `SectionSelector.vue`: Added missing `class="select-dropdown"` + `ref="dropdownRef"` on Teleported div, fixed click-outside handler with `capture: true`, fixed CSS syntax error
3. `useAppShortcuts.ts`: Added `event.code === 'KeyF'` for Hebrew keyboard layout compatibility

**Files Changed**: `StatusSubmenu.vue`, `DurationSubmenu.vue`, `ProjectSubmenu.vue`, `MoreSubmenu.vue`, `SectionSelector.vue`, `useAppShortcuts.ts`

---

### ~~TASK-1488~~: Fix Search Modal Z-Index — Confirmation Dialog Hidden Behind Overlay (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-08)

**Problem**: When deleting a task from search results via right-click context menu, the ConfirmationModal opens BEHIND the SearchModal overlay and is invisible. Additionally, search results would close unexpectedly after certain context menu actions.

**Root Cause**: Z-index layering issue. SearchModal used `--z-modal: 1300` and ConfirmationModal (BaseModal) also used `--z-modal: 1300`. Since both have the same z-index in ModalManager, and ConfirmationModal is rendered first in the DOM (line 65-73 before SearchModal at 76-81), the SearchModal appeared on top, blocking the confirmation dialog.

**Fix**:
1. `ConfirmationModal.vue`: Added `class="confirmation-modal-override"` to BaseModal wrapper
2. Added CSS rule `:deep(.confirmation-modal-override .modal-overlay) { z-index: var(--z-toast); }` to elevate ConfirmationModal to `--z-toast: 1450` (above SearchModal's 1300)
3. Result: Confirmation dialogs now always appear on top of search modals, and users can interact with them properly

**Files Changed**: `src/components/common/ConfirmationModal.vue`

---

### ~~BUG-1490~~: KDE Widget Stops Syncing — Token Refresh Chain Break (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-09)

**Problem**: KDE widget silently stops syncing with the main app after some period. Tasks, pinned tasks, and projects stop updating and require a manual widget restart to recover.

**Root Cause**: Three compounding bugs in `main.qml`:
1. **Token refresh timer chain break**: `tokenRefreshTimer` has `repeat: false`. On network errors or non-200/non-401 responses, `refreshAccessToken()` never restarts the timer → token eventually expires → all polling silently fails with auth errors.
2. **Missing 401 handling in fetch functions**: Only `fetchCurrentSession` handled 401 by calling `refreshAccessToken()`. `fetchTasks`, `fetchPinnedTasks`, and `fetchProjects` just logged and silently failed when the token expired mid-session.
3. **`isRefreshingToken` deadlock**: If an XHR hangs (network issue), `isRefreshingToken` stays `true` forever, blocking all future refresh attempts permanently.

**Fix**:
1. Added fallback `else` branch in `refreshAccessToken()` for non-200/non-400/401 statuses: restarts timer with 60s retry interval. Also restores normal interval on success.
2. Added `401 → refreshAccessToken()` handling to all three fetch functions.
3. Added `refreshTokenStartTime` property + timestamp-based stuck detection: if `isRefreshingToken` is true for >30s, forces reset and proceeds.

**Files Changed**: `packages/kde-widget/contents/ui/main.qml`

---

### ~~BUG-1492~~: Canvas Position Drift — Consecutive Drags Cause parentId Flip-Flopping (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Dragging canvas tasks in quick succession causes visible position drift. Tasks alternately get assigned to a group and then back to root on each drag.

**Root Cause A — BUG-1191 handler skips saves**: The stale-parentNode guard in `useCanvasInteractions.ts` detected when Vue Flow's `node.parentNode` diverged from the store's `task.parentId` (valid during rapid consecutive drags before VF syncs). It was restoring the node position from the store (overwriting the user's actual drag position) and calling `continue` to skip saving. This threw away Drag N+1's real position, causing drift.

**Root Cause B — Containment padding gap causes flip-flop**: The "still inside parent" early-exit used `padding=2` while `getDeepestContainingGroup` used `padding=10`. A task with center 2–10px from the group edge failed the early-exit check, fell through, failed containment detection, and was assigned as root. Next drag with 16px grid snap shifted it back in → assigned to group. This cycled on every drag.

**Fix**:
1. **BUG-1191 handler**: Removed position restoration and `continue`. Now only fixes `node.parentNode` alignment and falls through to the normal path which uses the snapshotted absolute position (always the correct visual position).
2. **Hysteresis padding**: Changed both containment checks from `padding=2` to `padding=-20`. Negative padding expands the parent boundary outward by 20px — a task only detaches when dragged >20px outside the boundary. The 16px grid snap can never cause a flip-flop across a 20px hysteresis zone.

**Files Changed**: `src/composables/canvas/useCanvasInteractions.ts`

---

### ~~BUG-1493~~: Catalog view — collapsed state resets, expand/collapse broken, cross-group drag regression (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-09)

**Problems**:
1. `expandedGroups` in `TaskList.vue` is a plain `ref<Set>` — resets to all-expanded on every remount (navigation away and back).
2. `expandAll()`/`collapseAll()` work momentarily but reset on next reactive update or remount.
3. Cross-group drag in Catalog view (e.g., Overdue → Today with dueDate grouping) may be broken.

**Fix**: Persist collapsed group keys in localStorage via `usePersistentRef`, key `flowstate:catalog-collapsed-groups`. Update `toggleGroupExpand`, `expandAll`, `collapseAll`, initialization, and the new-group watcher to respect persisted state. Investigate drag regression.

**Files**: `src/components/tasks/TaskList.vue`

---

### ~~BUG-1320~~: Production console log spam — WakeLock, LWW echo, legacy IDs, Realtime drops (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Production console (in-theflow.com) flooded with 5 categories of noise:
1. Hundreds of `[WakeLock] Failed to request wake lock: DOMException` when tab is hidden
2. `[SYNC] LWW: Server wins` on every sync cycle (echo from direct save + sync queue race)
3. `[SUPABASE-MAPPER] Invalid UUID detected` on every sync for legacy group "Today"
4. `[REALTIME] Connection dropped (CHANNEL_ERROR)` when browser suspends background WebSockets
5. Transient CORS/network failures from ServiceWorker during tab sleep (handled by existing retry)

**Fix**: 4 targeted changes:
- `useWakeLock.ts`: Guard `requestWakeLock()` with `document.visibilityState === 'hidden'` check
- `useSyncOrchestrator.ts`: Downgrade LWW echo logs (delta < 2s) from `warn` to `debug`
- `supabaseMappers.ts`: Deduplicate warnings via `Set` — legacy group/UUID warnings fire once per session
- `useSupabaseDatabase.ts`: Downgrade CHANNEL_ERROR/CLOSED to `debug` when tab is hidden

**Files**: `src/composables/useWakeLock.ts`, `src/composables/sync/useSyncOrchestrator.ts`, `src/utils/supabaseMappers.ts`, `src/composables/useSupabaseDatabase.ts`

---

### TASK-1337: Storybook Design Streamlining — Align All Stories with Design System (👀 REVIEW)

**Priority**: P3 | **Status**: 🔄 IN PROGRESS

**Goal**: Review and streamline every Storybook story to use the project's design system consistently. Replace all non-design-system elements with proper project components and tokens.

**What "Streamlining" Means**:
- Native `<select>` → `CustomSelect.vue`
- Native checkboxes → project checkbox components
- Hardcoded colors → design tokens from `design-tokens.css`
- Solid-fill buttons → glass bg + colored border pattern (`--glass-bg-soft` + `backdrop-filter: blur(8px)`)
- Any non-glass-morphism UI → proper glass morphism styling
- Primary action color is TEAL (`--brand-primary` / #4ECDC4), NOT green

**Progress Tracker**: `.claude/storybook-review-progress.md` (163 stories, 18 categories)

**Categories** (in review order):
- [ ] ai (4 stories)
- [ ] auth (8 stories)
- [ ] calendar (5 stories)
- [ ] canvas (15 stories) — 1 done (MultiSelectionOverlay)
- [ ] canvas/inbox (3 stories)
- [ ] canvas/node (6 stories)
- [ ] design-system (1 story)
- [ ] gamification (11 stories)
- [ ] kanban (7 stories)
- [ ] layout (12 stories)
- [ ] modals (12 stories)
- [ ] primitives (21 stories)
- [ ] pwa (1 story)
- [ ] settings (11 stories)
- [ ] task-management (22 stories)
- [ ] task-management/context-menu (3 stories)
- [ ] task-management/row (4 stories)
- [ ] views (8 stories)

**Related**: ~~BUG-1311~~ (3 story files fail to import — ✅ FIXED 2026-02-17)

---

### ~~BUG-1290~~: Week View Not Loading (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: Calendar week view doesn't render at all. Switching to week mode shows blank content.

**Root Cause**: `CalendarWeekView.vue` injects `getWeekEventStyle` and `isCurrentWeekTimeCell` from `calendar-helpers`, but `CalendarView.vue` never provides them. Both functions are `undefined`, crashing the week view template when `:style="getWeekEventStyle(event)"` is called.

**Fix**: Added `getWeekEventStyle` and `isCurrentWeekTimeCell` to the `provide('calendar-helpers')` object in `CalendarView.vue` and destructured them from `weekView` composable.

**Files**: `src/views/CalendarView.vue`

**Progress (2026-02-10):** Root cause identified and fixed — added missing `getWeekEventStyle` and `isCurrentWeekTimeCell` to `provide('calendar-helpers')`. Type-check passes. Awaiting user verification.

---

### ~~BUG-1218~~: RTL Missing in Calendar Task Create Dialog and Timer Task Name (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: The Calendar-specific QuickTaskCreate dialog and the header timer task name don't support RTL/Hebrew text, while the rest of the app does. Hebrew text in the calendar task title input shows LTR cursor position. Timer task name in the header bar doesn't auto-detect Hebrew direction.

**Fix**:
1. Add `useHebrewAlignment` to `QuickTaskCreate.vue` (Calendar variant) — matches `QuickTaskCreateModal.vue`
2. Fix `.timer-task` CSS in `AppHeader.vue` — use `unicode-bidi: plaintext` unconditionally instead of `:dir(rtl)` selector that never matches in LTR documents

---

### ~~TASK-1220~~: Quick Sort Pull-Down Capture Panel (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Goal**: When user drags the screen down in any mobile view, reveal a command center panel with:
- Search existing tasks
- Create a new task (spacious input with keyboard)
- Record a task with audio (voice-to-text via Whisper)
- Quick action tiles: Quick Sort, Timer, Today, Settings

**Changes**: Implemented as pull-down gesture in `MobileLayout.vue` (available from ALL mobile views, not just Quick Sort). Panel includes task input, voice recording, search with results, and 4 action tiles.

**Files**: `src/mobile/layouts/MobileLayout.vue`

---

### ~~BUG-1286~~: PWA Today View Shows 2:00 AM on All Tasks Due to UTC Timezone Parsing (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Tasks in the Mobile Today View all showed "2:00 AM" even though the user never set any due time. Additionally, the time-based grouping broke — all untimed tasks landed in "Evening" instead of "Anytime Today".

**Root Cause**: `MobileTodayView.vue` extracted time from `dueDate` (a date-only field) instead of checking the explicit `dueTime` field. Date-only strings like "2026-02-08" are parsed by `new Date()` as UTC midnight, which becomes 2:00 AM in Israel (UTC+2). The untimed task filter used `getHours() === 0` which only works in UTC+0 and fails in other timezones.

**Fix Applied (2026-02-08)**:
1. **Changed `getTaskHour()`** — Now uses `task.dueTime` instead of parsing time from `dueDate`
2. **Fixed untimed task filter** — Changed from `getHours() === 0` to `getTaskHour() === null`, making it timezone-agnostic
3. **Replaced `formatDueTime()`** — Now uses `getDueBadge()` which only shows time when explicit `dueTime` is set
4. **Fixed `sanitizeTimestamp()` in supabaseMappers.ts** — Preserves date-only strings (YYYY-MM-DD) instead of converting to UTC ISO

**Files Changed**:
- `src/mobile/views/MobileTodayView.vue` — Display and grouping fixes
- `src/utils/supabaseMappers.ts` — Preserve date-only strings

**Test Case**: Create a task with due date "2026-02-08" but no due time. In Israel (UTC+2), it should show "Anytime Today", not "2:00 AM".

---

### ~~BUG-1204~~: Challenges Table 404 / Initialization Failure (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

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

### ~~TASK-1217~~: Add "Today" Filter to KDE Plasma Widget (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-22)

Add a "Today" button/filter option to the KDE Plasma widget's task list that filters to only show tasks with today's due date. Queries `due_date` column via Supabase REST API.

**Files**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~TASK-1177~~: Offline-First Sync System to Prevent Data Loss (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-23)

**Problem**: User lost significant work on production (in-theflow.com) due to silent sync failures.

**Root Causes Identified** (6 agents investigated):
1. **Silent error swallowing** (`taskOperations.ts:290-301`) - Save failures logged but not retried
2. **Smart merge drops tasks** (`taskPersistence.ts:272-287`) - Local-only tasks dropped after 5 min
3. **No write queue** - Failed writes lost forever
4. ~~**Optimistic UI no rollback**~~ ✅ - updateTask now has rollback on failure (Phase 4)
5. **Sync timeout silent** (`useNodeSync.ts:252-256`) - Timeout errors explicitly silenced
6. **No beforeunload** - Can close tab with unsaved data

**Solution Architecture (Offline-First)**:

1. ~~**Phase 1: Write Queue with IndexedDB**~~ ✅ (P0)
   - All writes go to IndexedDB FIRST, then sync to Supabase
   - Retry with exponential backoff: 1s, 2s, 4s, 8s... up to 60s max
   - 10 retry attempts before marking as "failed" (requires manual retry)
   - Never discard operations - persist until confirmed synced

2. ~~**Phase 2: Sync Status Indicator**~~ ✅ (P0)
   - Visual indicator in AppHeader.vue control panel
   - States: Synced (green), Syncing (blue), Pending (amber), Error (red), Offline (gray)
   - Error state NEVER auto-dismisses

3. ~~**Phase 3: Fix Smart Merge Logic**~~ ✅ (P0)
   - NEVER drop local-only tasks automatically
   - Queue for sync retry instead

4. ~~**Phase 4: Add Rollback to updateTask**~~ ✅ (P1) — DONE 2026-02-23
   - ~~Capture previous state before update~~
   - ~~Rollback local state on failure~~
   - Synchronous rollback via `persisted` flag: snapshot → optimistic mutation → track persistence → rollback if ALL paths fail
   - `onPermanentFailure` pub/sub callback in sync orchestrator for UI notification
   - Removed unused `RollbackState<T>` type

5. ~~**Phase 5: beforeunload Protection**~~ ✅ (P1)
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
- [x] User NEVER loses data, even with network failures
- [x] User ALWAYS sees current sync status
- [x] User CANNOT close tab with unsaved changes (without warning)
- [x] Failed syncs retry automatically with backoff
- [x] Offline edits persist across browser sessions
- [x] Smart merge NEVER drops local-only tasks

---

### ~~BUG-1113~~: Stale Worktrees Not Cleaned Up - Forces Claude Code Context Bloat (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-22) | **Parent**: TASK-303

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

**Status Note (2026-02-14):** No activity since 2026-01-27. Likely resolved or superseded.

**Related**: BUG-1019 (Swarm agent cleanup + OOM prevention)

**Files**: `~/.dev-maestro/server.js` (`cleanupWorktree()`, `createAgentWorktree()`)

---

### ~~BUG-1182~~: saveTasks Fails After Realtime Disconnect (✅ DONE)

**Root Cause**: After sleep/wake, the JWT token expires but `withRetry()` retries 401 errors with the same stale token (all 3 attempts fail). The save failure was silently swallowed in `saveTasksToStorage()`, causing data loss.

**Fix (3 layers)**:
1. Token refresh in `withRetry()` before retrying on 401/403 (`useSupabaseDatabase.ts`)
2. Proactive token refresh on visibility change / wake-up (`useSupabaseDatabase.ts`)
3. Surface save failures when authenticated — re-throw instead of silently swallowing (`taskPersistence.ts`)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: After realtime connection drops (BUG-1179), task save operations fail:
```
i@.../index-CAXNPz-Z.js:144:4526
saveTasks@.../index-CAXNPz-Z.js:144:14019
```

---

### ~~TASK-1128~~: Add "Create Group From Selection" Context Menu Option (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

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

### BUG-1103: Local Dev Auth Signs Out Both Tabs on Second Tab Sign-In (👀 REVIEW)

**Priority**: P1-HIGH | **Status**: 👀 REVIEW (2026-01-28)

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

### ~~BUG-347~~: FK Constraint Violation on parent_task_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Root Cause**: Tasks saved with `parent_task_id` refs to deleted tasks, no existence validation, race conditions in batch upserts.

**Solution**: Catch-and-retry on FK error code `23503` - clear parent refs and retry once. Applied in `useSupabaseDatabase.ts` (`saveTask()`, `saveTasks()`).

---

### ~~BUG-309~~: Ctrl+Z Keyboard Shortcut Not Triggering Undo (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Fix Applied**: Added `executeUndo()`, `executeRedo()`, `executeNewTask()` calls + `shouldIgnoreElement()` check in `src/utils/globalKeyboardHandlerSimple.ts`.

---

### ~~TASK-1524~~: Migrate old `recurrence` field to new `recurrenceRule` on app init (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-14)

**Problem**: Tasks created before TASK-1403 use `recurrence: TaskRecurrence` (old format) but not `recurrenceRule: SimpleRecurrenceRule` (new format). Recurring badge, delete dialog, and scheduler all depend on `recurrenceRule`, so old tasks appeared non-recurring.

**Solution**: Created `src/composables/useRecurrenceMigration.ts` with:
- `convertOldToNew(oldRecurrence)` — converts `TaskRecurrence` → `SimpleRecurrenceRule` for patterns `daily`/`weekly`/`monthly`/`yearly` (skips `none` and `custom`)
- `migrateIfNeeded()` — iterates `taskStore._rawTasks`, skips tasks that already have `recurrenceRule`, updates via `taskStore.updateTask()` (hits Supabase), marks done in localStorage key `flowstate-recurrence-migration-v1`
- Migration is idempotent, runs once per device, preserves old `recurrence` field

Wired into `src/composables/app/useAppInitialization.ts` — runs after tasks load (Phase B background refresh), before recurrence scheduler (`useRecurrenceScheduler`).

**Files changed**:
- `src/composables/useRecurrenceMigration.ts` (new)
- `src/composables/app/useAppInitialization.ts` (added migration call)

---

### TASK-1521: Calendar day/week drag deferred to mouseup (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS

**Problem**: The `_startEventDrag` (day view) and `_startWeekDrag` (week view) handlers called `taskStore.updateTask()` inside the mousemove handler on every slot change. This caused excessive DB writes and had no undo support.

**Fix**: Applied preview-then-commit pattern (mirrors the existing resize handler):
- Added `dragPreview` ref in `useCalendarDayView.ts` and `weekDragPreview` ref in `useCalendarWeekView.ts`
- `getEventStyle` / `getWeekEventStyle` use the preview slot/dayIndex during drag for visual feedback
- `mousemove` only updates the local preview refs — zero store writes
- `mouseup` calls `taskStore.updateTaskWithUndo()` once (supports Ctrl+Z)
- `Escape` key cancels the drag with no persistence
- Duplicate-mode (Alt+drag) still creates a task on mouseup only

**Files changed**:
- `src/composables/calendar/useCalendarDayView.ts`
- `src/composables/calendar/useCalendarWeekView.ts`

---

### ~~TASK-1520~~: Add recurring indicator badge to task cards (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-14)

**What**: Added a small `Repeat` icon badge (teal, `var(--brand-primary)`) to task cards in all views when `task.recurrenceRule` is set. Tooltip shows `describeRecurrenceRule()` output (e.g., "Repeats every day").

**Files changed**:
- `src/components/kanban/card/TaskCardBadges.vue` — recurring badge after attachments badge
- `src/components/canvas/node/TaskNodeMeta.vue` — recurring badge with "Recurring" text label + new `recurrenceRule` prop
- `src/components/canvas/TaskNode.vue` — passes `task?.recurrenceRule` to `TaskNodeMeta`
- `src/components/tasks/HierarchicalTaskRowContent.vue` — recurring icon between due date and progress bar

---

### ~~TASK-1525~~: Recurring task delete dialog — Skip/Stop/Cancel (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**What**: Phase 1 of recurring task management. When deleting a recurring task, shows a dialog with three options:
- **Skip this occurrence** — advances recurrence chain to next date (calls `skipRecurringOccurrence()`)
- **Stop all future occurrences** — clears `recurrenceRule` chain-wide (calls `stopRecurrence()`)
- **Cancel** — do nothing

All 11 delete paths in the app now route through the recurrence-aware dialog globally via CustomEvent pattern.

**Files changed**:
- `src/components/modals/RecurrenceDeleteModal.vue` — modal dialog with Skip/Stop/Cancel buttons, shows recurrence preview
- `src/composables/useRecurrenceAwareDelete.ts` — composable that intercepts all delete operations, shows dialog if task is recurring
- `src/stores/tasks/taskOperations.ts` — `skipRecurringOccurrence()` and `stopRecurrence()` operations
- `src/services/modals/ModalManager.ts` — updated to emit custom delete events that composable listens to
- Multiple delete paths updated: Kanban context menu, Canvas context menu, Quick Sort, Calendar drag, Board, etc. (all 11 entry points)

**Key insight**: Instead of updating 11 delete call sites individually, created a global composable that listens for CustomEvent "delete-task" emissions from ModalManager. All delete paths emit the event, composable intercepts and shows dialog if needed.

---

## Active Tasks (IN PROGRESS)

### ~~BUG-1437~~: Task doesn't inherit group properties on move (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-03)

**Problem**: When moving a task into a canvas group, the task doesn't inherit the group's properties (e.g., due date from a date-based group). The task retains its old values instead of adopting the group's context.

**Fix**: Removed the overly aggressive BUG-1432 guard (`if (key === 'dueDate' && task.dueDate) continue`) from `src/composables/canvas/useCanvasInteractions.ts` lines 774-779. The guard was inside the `if (targetGroup && oldParentId !== newParentId)` block — meaning it only ran on cross-group moves anyway. The outer condition already prevents same-group repositioning from overwriting dates, making the inner guard redundant and harmful. Cross-group moves now correctly inherit the new group's dueDate.

---

### ~~TASK-1436~~: Active Task Glass Pill next to Pomodoro Timer (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-07)

**Problem**: The Pomodoro timer shows the task name as a small muted text inside the timer display. This lacks visual prominence and doesn't match the glass morphism design system.

**Scope**:
1. Remove old `.timer-task` inline text from timer display
2. Add a separate glass pill component after the timer in `.control-panel`
3. Pill shows project color dot (or emoji) + task name with fade+slide transition

**Files**: `src/layouts/AppHeader.vue`

---

### ~~TASK-1060~~: Infrastructure & E2E Sync Stability (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-22)

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

### TASK-1214: Child Groups Inherit Parent Group Properties (👀 REVIEW)

**Priority**: P2-MEDIUM | **Status**: 👀 REVIEW (Started: 2026-02-06)

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

### FEATURE-1223: AI Chat System Overhaul — RTL, Inline Editing, Full-Screen, Agent Chains (🔄 IN PROGRESS)

**Priority**: P0-P3 (phased) | **Status**: 🔄 IN PROGRESS (Phase 1-2 done, Phase 3-4 remaining)

**Problem**: The AI Chat panel has critical UX issues (RTL broken for Hebrew, task names truncated, raw ISO dates, no inline editing) and lacks key features (full-screen mode, conversation history, voice input, gamification integration, multi-step agent workflows).

**5-Agent Expert Research (2026-02-08)**: UX Expert, AI Automation Expert, AI Agent Chains Expert, RTL/i18n Expert, Product Strategy Expert all completed deep analysis. Full findings in conversation history.

#### Phase 1: Fix & Foundation (P0 — IMMEDIATE)

- [x] ~~**TASK-1223**~~: ✅ RTL fix — CSS logical properties, `dir="auto"` on task titles, panel position mirroring
- [x] ~~**TASK-1224**~~: ✅ Task name truncation — replace `nowrap` with 2-line clamp (`-webkit-line-clamp: 2`)
- [x] ~~**TASK-1225**~~: ✅ Date formatting — new `formatRelativeDate()` utility using `Intl.RelativeTimeFormat` (auto Hebrew/English)
- [x] ~~**TASK-1226**~~: ✅ Inline task editing in chat results — clickable priority/status/date dropdowns on task list items
- [x] ~~**TASK-1227**~~: ✅ Task list item 2-row layout — priority dot + title (row 1), date + status badges (row 2)

#### Phase 2: Expand & Enrich (P1 — ✅ DONE)

- [x] ~~**TASK-1228**~~: ✅ Expandable panel — toggle 380px → 600px → fullscreen with keyboard shortcut (Ctrl+Shift+F)
- [x] ~~**TASK-1229**~~: ✅ Gamification tools — `get_gamification_status`, `get_active_challenges`, `get_achievements_near_completion`
- [x] ~~**TASK-1230**~~: ✅ Cyberflow AI personality mode — "Grid Handler" netrunner persona via system prompt toggle
- [x] ~~**TASK-1231**~~: ✅ Voice input — microphone button with Web Speech API, auto-fills input, pulse animation
- [x] ~~**TASK-1232**~~: ✅ Productivity tools — `get_productivity_stats`, `suggest_next_task`, `get_weekly_summary`
- [x] ~~**TASK-1233**~~: ✅ Native function calling — Groq/OpenRouter `tools[]` API parameter with text-based regex fallback for Ollama

#### Phase 3: Deep Features (P2 — ✅ DONE)

- [x] ~~**TASK-1234**~~: ✅ Conversation history — multiple conversations, auto-naming, localStorage model, conversation list UI
- [x] ~~**TASK-1235**~~: ✅ Full-screen `/ai-chat` route — dedicated view with conversation sidebar, two-column layout
- [x] ~~**TASK-1236**~~: ✅ Deterministic agent chains — "Plan my day", "End of day review", "Focus mode setup" (works with Ollama)
- [x] ~~**TASK-1237**~~: ✅ ReAct agentic loop — multi-step reasoning for Groq/OpenRouter (circuit-breaker, abort, error recovery)
- [x] ~~**TASK-1238**~~: ✅ AI challenge narrator — push narrative events to chat on challenge complete/fail
- [x] ~~**TASK-1239**~~: ✅ Inline actions on results — "Mark done", "Start timer" hover buttons on task items

#### Phase 4: Polish & Innovation (P3 — FUTURE)

- [ ] **TASK-1240**: Supabase chat persistence — `ai_conversations` + `ai_messages` tables, cross-device sync
- [ ] **TASK-1241**: Mobile bottom sheet — replace side panel with bottom sheet on mobile
- [ ] **TASK-1243**: ⏸️ PAUSED — AI Game Master boss fights — real-time narrated boss encounters via chat
- [ ] **TASK-1245**: Dynamic prompt assembly — only include relevant tool definitions per request type
- [ ] **TASK-1296**: AI Assist composable — `useAITaskAssist` with 7 actions (subtasks, priority, breakdown, date, title, related, summarize)
- [ ] **TASK-1297**: AI Assist popover component — `AITaskAssistPopover.vue` with action buttons + result display
- [ ] **TASK-1298**: Context menu AI Assist — ✨ button in TaskContextMenu with AI popover
- [ ] **TASK-1299**: Edit modal AI Assist — ✨ button in TaskEditModal footer, auto-populate form fields
- [ ] **TASK-1300**: Quick create AI Assist — ✨ button in QuickTaskCreate next to title input
  **Progress (2026-02-12):** All 5 files implemented + integrated. Hebrew/RTL language detection added. Sticky bar translucency fixed. Awaiting user testing.

#### Phase 5: AI Chat Intelligence Improvements (P1 — ONGOING)

- [x] ~~**TASK-1329**~~: ✅ Fix mixed-language responses — localized pipeline headers (preDigestedReasoning, reasoningDirective, contextOptimizer), localized ReAct tool feedback injection, added ReAct language retry loop, added agent chain language directive. 8 gaps identified, 6 high/medium fixed. (✅ DONE 2026-02-23)
- [x] ~~**TASK-1330**~~: ✅ Improve prompt quality — 14-finding audit: consolidated 6 contradictory length instructions into 1 canonical rule, disambiguated 3 overlapping tools, slimmed tool feedback (~600 tokens/step saved), expanded intent classifier (13→25 tools), removed anti-fluff contradictions, fixed personality prompt override, fixed field name mismatches in pre-digested reasoning, removed broad keywords, added agent chain language awareness. (✅ DONE 2026-02-23)
- [x] ~~**TASK-1331**~~: ✅ Weekly plan AI quality — 7-gap audit: (1) pass BehavioralContext through chat tool path, (2) resolve project names for batching, (3) replace plan digest/directive short-circuits with structured scheduling facts, (4) agent chain passes frontload preference when 3+ overdue, (5) enriched chain prompt with per-day distribution + unscheduled, (6) added on_hold/future-dated task filters, (7) skip past weekdays in chat-triggered plans. (✅ DONE 2026-02-25)
- [ ] **TASK-1332**: Add Kimi K2 to Groq model dropdown — ✅ DONE (added `moonshotai/kimi-k2-instruct-0905`)
- [ ] **TASK-1363**: AI chat shows done tasks + raw UUIDs + unstructured verbose responses — filter done from list/search by default, hide IDs from AI output, tighten response formatting rules
- [x] ~~**BUG-1374**~~: ✅ AI Chat 4-bug combo — (1) English input → Hebrew response (task data context overrides language), (2) Hebrew text renders LTR (Step indicator breaks `dir="auto"`), (3) fluffy generic advice instead of concise analysis, (4) wrong tasks returned (`list_tasks` has no date/priority filter). Pipeline + prompt-level fixes all applied 2026-02-21. (✅ DONE 2026-02-21)

**Key Files**:
- `src/components/ai/ChatMessage.vue` — message rendering, task list items, inline actions, RTL CSS
- `src/components/ai/AIChatPanel.vue` — panel layout, settings, quick actions, full-screen nav
- `src/components/ai/AITaskAssistPopover.vue` — AI assist popover with context-aware actions + results (Phase 4)
- `src/views/AIChatView.vue` — full-screen AI chat with conversation sidebar (Phase 3)
- `src/composables/useAIChat.ts` — chat logic, tool execution, agent chains, ReAct loop
- `src/composables/useAITaskAssist.ts` — 7 AI-powered task assist actions (Phase 4)
- `src/composables/useAgentChains.ts` — deterministic multi-step tool chains (Phase 3)
- `src/composables/useAIChallengeNarrator.ts` — gamification event narrator (Phase 3)
- `src/stores/aiChat.ts` — conversation model, multi-chat persistence
- `src/services/ai/tools.ts` — tool definitions (20 current, 6+ planned)
- `src/services/ai/router.ts` — provider routing
- `src/utils/dateUtils.ts` — date formatting utilities

**Competitors Analyzed**: Linear AI, ClickUp Brain, Notion AI 3.0, Todoist Ramble, Motion, GitHub Copilot Chat, Cursor IDE

#### Phase 6: Programmatic Guardrails Pipeline — ChatGPT-Level Reliability (P1 — PLANNED)

**Goal:** Move AI chat from prompt-engineering-dependent to code-enforced reliability. Pre/post-processing pipeline between user input and LLM output ensures language, quality, and formatting are enforced deterministically — not hoped for via prompts.

**Architecture:**
```
User Input → [Pre-Processing] → LLM (ReAct loop) → [Post-Processing] → Render
```

**New file structure:** `src/services/ai/pipeline/` (types, preprocess, postprocess, languageDetector, contextOptimizer, responseValidator)

**Infrastructure:**
- [x] ~~**TASK-1375**~~: ✅ Pipeline orchestrator + types — create `src/services/ai/pipeline/` with `types.ts` (PreProcessResult, PostProcessResult, Guardrail, PipelineConfig interfaces) and `index.ts` (createPipeline, runPreProcess, runPostProcess). Pure function composition, fully testable.
- [x] ~~**TASK-1376**~~: ✅ Language detector — `languageDetector.ts` with `detectLanguage(text)` using Unicode range analysis (extract from qualityAssessment.ts:468-483) and `detectLanguageMismatch(input, output)`. No LLM calls — deterministic.
- [x] ~~**TASK-1377**~~: ✅ Context optimizer — `contextOptimizer.ts` to replace inline task injection in `buildSystemPrompt` (lines 360-418). Separate Hebrew titles from English metadata labels, character budget (3000 chars), date-relative filtering (today/overdue first). **Highest single ROI fix** — reduces language contamination at the source.

**Post-Processing Guardrails:**
- [x] ~~**TASK-1378**~~: ✅ Response validator — consolidate ALL response cleanup from 3 locations (stripToolBlocks, stripTextToolCalls, ChatMessage.vue renderedContent regex) into one `responseValidator.ts`. Add UUID stripping, reuse `runRuleChecks` from qualityAssessment.ts.
- [x] ~~**TASK-1379**~~: ✅ Language enforcer — post-processing guardrail using TASK-1376's `detectLanguageMismatch()`. V1: detect + flag in metadata (`languageMismatch: true`) for UI indicator. V2 (future): re-call LLM for translation.
- [x] ~~**TASK-1380**~~: ✅ Response length enforcer — cap responses by intent (greetings: 200 chars, tool summaries: 500 chars, analytical: warn on >2000 chars without structure).

**Integration:**
- [x] ~~**TASK-1381**~~: ✅ Wire pre-processing into useAIChat — call `runPreProcess()` before ReAct loop, replace inline `buildSystemPrompt` task injection with contextOptimizer, pass `PreProcessResult` through loop. Depends: TASK-1375, 1376, 1377.
- [x] ~~**TASK-1382**~~: ✅ Wire post-processing into useAIChat — run `runPostProcess()` after ReAct loop (before `completeStreamingMessage`), replace inline cleanup. Depends: TASK-1378, 1379, 1380, 1381.
- [x] ~~**TASK-1383**~~: ✅ Simplify ChatMessage.vue renderedContent — remove redundant regex stripping (now handled by pipeline). `renderedContent` becomes: sanitize + markdown render only. Depends: TASK-1382.
- [x] ~~**TASK-1384**~~: ✅ Unit tests for pipeline — test each guardrail independently (language detection, response cleaning, context optimization, pipeline composition). Depends: TASK-1375–1380.

**Dependency graph:**
```
Wave 1: TASK-1375, TASK-1376 (no deps)
Wave 2: TASK-1377, TASK-1378, TASK-1379, TASK-1380 (depend on Wave 1)
Wave 3: TASK-1381, TASK-1384 (depend on Wave 2)
Wave 4: TASK-1382 (depends on Wave 3)
Wave 5: TASK-1383 (cleanup, depends on Wave 4)
```

#### Phase 7: AI Intelligence Layer — From Prompt-Dependent to Code-Enforced Reliability (P1 — PLANNED)

**Goal:** Make AI chat as reliable as ChatGPT/Claude Desktop. Four pillars: (1) pre-digested reasoning so the LLM formats facts rather than discovers them, (2) generic fluff detection with retry, (3) tool hints so the right tool is called first try, (4) fuzzy title resolution so "mark the auth bug as done" just works.

**Research basis (2025-2026):** Linear AI / Cursor pattern: compute reasoning in code, LLM only writes prose. Groq Llama 3.3 70B tool calling is documented as intermittent (Agno #4090). uFuzzy outperforms Fuse.js for short string matching. Rule-based validation before LLM-as-judge is the cost-effective quality gate.

**Pillar 1: Pre-Digested Reasoning (highest ROI)**
- [x] ~~**TASK-1388**~~: ✅ Pre-digested reasoning engine — instead of sending raw JSON tool results and hoping the LLM reasons, compute the analysis IN CODE (days overdue, subtask progress %, project context, priority ranking) and send pre-written facts the LLM only needs to format naturally. Pattern: `"Task X: 3 days overdue, 0/5 subtasks, high priority in Project Auth"` → LLM writes connecting prose. Inject into tool result follow-up prompt in `useAIChat.ts`. Key insight from Cursor/Linear: minimize what the LLM invents, maximize what deterministic code computes.
- [x] ~~**TASK-1389**~~: ✅ Skeleton prompting for agent chains — refactor `useAgentChains.ts` chain prompts to use skeleton pattern: code generates structured sections (overdue analysis, today's priorities, progress summary), LLM fills only 1-sentence natural language bridges between sections. Eliminates "wall of generic text" from plan_my_day and end_of_day_review chains.

**Pillar 2: Generic Response Detection + Retry**
- [x] ~~**TASK-1390**~~: ✅ Fluff detector guardrail — `src/services/ai/pipeline/fluffDetector.ts`. Heuristic scoring: check if response references actual task titles from context (0.3 weight), contains specific data points like dates/numbers (0.15), has no generic advisory phrases like "consider", "it's essential", "you might want to" (0.05 each). Score 0-1, threshold 0.5 = retry. Based on 2025 "Detecting Prompt Knowledge Gaps" paper specificity dimensions. Zero-cost, runs client-side.
- [x] ~~**TASK-1391**~~: ✅ Validation + retry loop — when fluff detector score < 0.5 after tool results, retry once with stricter prompt: append the validation feedback ("your response referenced no specific tasks, try again naming actual tasks from the results"). Max 1 retry to avoid latency. If retry also fails, return best attempt with post-processing cleanup. Wire into `useAIChat.ts` post-ReAct section.

**Pillar 3: Tool Hints + Intent Routing**
- [x] ~~**TASK-1392**~~: ✅ Keyword-based tool hints — `src/services/ai/pipeline/toolHints.ts`. Deterministic keyword → tool mapping: "overdue" → `get_overdue_tasks`, "plan my week" → `generate_weekly_plan`, "timer" → `get_timer_status`/`start_timer`, "what should I" → `suggest_next_task`. Inject hint into system prompt: "Consider using `get_overdue_tasks` for this query." Reduces ReAct steps from 2-3 to 1. Supports Hebrew keywords too.
- [x] ~~**TASK-1393**~~: ✅ `projectId` filter on `list_tasks` — add optional `projectId` parameter to `list_tasks` tool definition and execution. Already has project data accessible. 15-minute quick win.
- [x] ~~**TASK-1394**~~: ✅ Counting vs listing system prompt clarification — add explicit rule: "For COUNTING questions (how many, what's total), answer from context — do NOT call tools. For LISTING questions (show me, what are my tasks), use tools to show interactive cards." Prevents unnecessary tool calls.

**Pillar 4: Fuzzy Title Resolution**
- [x] ~~**TASK-1395**~~: ✅ Install uFuzzy + `resolveTask()` helper — `npm install @leeoniya/ufuzzy`. Create `src/services/ai/entityResolver.ts` with `resolveTask(idOrTitle, tasks)`: (1) exact UUID match, (2) exact TASK-XXX ID match, (3) uFuzzy title search. Returns best match or top-3 candidates if ambiguous. uFuzzy chosen over Fuse.js: 7.5KB, ~1ms for 1k items, better quality on short strings without tuning.
- [x] ~~**TASK-1396**~~: ✅ Wire `resolveTask()` into write tools — modify `validateTaskExists()` in `tools.ts` to fall through to `resolveTask()` when UUID lookup fails. Affects: `update_task`, `update_task_status`, `delete_task`, `start_timer`, `stop_timer`. User says "mark the video as done" → LLM passes title fragment → `resolveTask` finds the task.
- [x] ~~**TASK-1397**~~: ✅ `mark_task_done` convenience tool — new tool alias that accepts `taskTitle` (string) instead of requiring UUID. Internally calls `resolveTask()` + `taskStore.updateTask(id, { status: 'done' })`. Most common user action shouldn't depend on UUID resolution.
- [x] ~~**TASK-1398**~~: ✅ Conversation entity memory — track recently-mentioned task IDs in conversation metadata. When user says "it", "that task", "the last one", resolve to most recently mentioned entity. Store in `aiChat` store alongside messages. Enables multi-turn: "show overdue tasks" → "mark the first one as done."

**Dependency graph:**
```
Wave 1 (no deps):     TASK-1388, TASK-1390, TASK-1392, TASK-1393, TASK-1394, TASK-1395
Wave 2 (dep Wave 1):  TASK-1389, TASK-1391, TASK-1396, TASK-1397
Wave 3 (dep Wave 2):  TASK-1398
```

**npm packages to install:** `@leeoniya/ufuzzy` (7.5KB, fuzzy matching)

---

### ~~TASK-1249~~: Codebase Hygiene Audit — Placeholders, Hardcoded Values, Debug Leftovers (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-27)

**Summary**: Comprehensive 7-agent audit found 10 CRITICAL, 34 MEDIUM, 29 LOW issues across placeholders, hardcoded values, demo content, debug leftovers, design token violations, AI config, and metadata.

**Sub-Tasks (ordered by priority)**:

#### P0 — Security & Broken Functionality
- [x] **~~TASK-1250~~**: ✅ Fix API key storage — removed plaintext localStorage inputs since proxy handles keys server-side (`AIChatPanel.vue`)
- [x] **~~TASK-1251~~**: ✅ Fix direct API calls bypassing proxy — route model-listing through `aiChatProxy.ts` instead of direct fetch to groq.com/openrouter.ai (`AIChatPanel.vue:275,290`)
- [x] **~~TASK-1252~~**: ✅ Remove or gate `/keyboard-test` debug route — ships without auth, exposes task creation/deletion debug panel (`router/index.ts:105-108`)
- [x] **~~TASK-1253~~**: ✅ Gate `window.__flowstate_tauri_debug` behind `import.meta.env.DEV` (`useTauriDebug.ts:270-276`)
- [x] **~~TASK-1254~~**: ✅ Fix CORS wildcard on Supabase Edge Functions — restricted to `in-theflow.com` + Tauri + dev origins (`supabase/functions/*/index.ts`)
- [x] **~~TASK-1255~~**: ✅ Fix WelcomeModal dead buttons — removed non-functional saveDisplayName, exportData, and stubbed userStats (`WelcomeModal.vue`)
- [x] **~~TASK-1256~~**: ✅ Fix stale production origins — `flowstate.app` → `in-theflow.com` (`environments.ts`)
- [x] **~~TASK-1257~~**: ✅ Fix `productionLogger.ts` — now uses Supabase session token via `supabase.auth.getSession()`

#### P1 — Production Quality
- [x] **~~TASK-1258~~**: ✅ Replace httpbin.org with self-hosted endpoint — production code now uses `in-theflow.com` (`performanceBenchmark.ts`, `useNetworkOptimizer.ts`)
- [x] **~~TASK-1259~~**: ✅ Remove unconditional `%c[DEBUG]` styled log from `useCanvasOrchestrator.ts`
- [x] **~~TASK-1260~~**: ✅ Remove ~30 bug-specific debug tags across 10 files (`[BUG-339-DEBUG]`, `[TASK-288-DEBUG]`, `[DELETE-DEBUG]`, `[BUG-1116:DRAG-DEBUG]`, `[KEYBOARD]` etc.)
- [x] **~~TASK-1261~~**: ✅ Fix silent no-op stubs — now throw Error or console.warn (`taskPersistence.ts`)
- [x] **~~TASK-1262~~**: ✅ Re-enable CI lint & unit tests (`.github/workflows/ci.yml`)
- [x] **~~TASK-1263~~**: ✅ Add Open Graph + Twitter Card meta tags + improved description (`index.html`)
- [x] **~~TASK-1264~~**: ✅ Update stale AI model references — router.ts, types.ts, openrouterProxy.ts
- [x] **~~TASK-1265~~**: ✅ Fix AI proxy health check consuming real API tokens every 60s — switched to OPTIONS request instead of chat completion (`aiChatProxy.ts:412-421`)

#### P2 — Code Quality & Design System
- [x] **~~TASK-1266~~**: ✅ CSS design token migration — top offending files migrated. Original: 1,420 raw rgba + 434 hex across 129 files. Migrated 15 top-offending component files (MultiSelectToggle, DragHandleVisuals, BaseCard, TaskRow, KanbanColumn.css, KanbanSwimlane.css, TaskCard.css, GroupModal, EmojiPicker, AccountSettingsTab, useToast, errorHandler, GamificationPanel, DoneToggleVisuals, AchievementToast). True violations reduced to ~101 rgba + ~170 hex (long tail of 2-7 per file across many components).
- [x] **~~TASK-1267~~**: ✅ Standardize localStorage key prefixes — settings.ts migrated with migration logic for old keys
- [x] **~~TASK-1268~~**: ✅ Extract magic timeout numbers to named constants — created `src/config/timing.ts` with PENDING_WRITE_TIMEOUT_MS, DRAG_SETTLE_TIMEOUT_MS, FILE_DIALOG_TIMEOUT_MS, CROSS_TAB_DEDUP_TIMEOUT_MS, RESIZE_SETTLE_TIMEOUT_MS
- [x] **~~TASK-1269~~**: ✅ Create centralized `src/config/urls.ts` — EXTERNAL_URLS with DiceBear, GitHub, production site, Storybook dev
- [x] **~~TASK-1270~~**: ✅ Fix hardcoded i18n defaults — updated ui.ts comment, wrapped password strength labels in `t()` calls, added en/he translations
- [x] **~~TASK-1271~~**: ✅ Improve Cyberflow empty states — added explanatory subtext to CyberSkillTree, CyberAchievements, CyberShop
- [x] **~~TASK-1272~~**: ✅ Mobile design token compliance — MobileTodayView migrated to tokens
- [x] **~~TASK-1273~~**: ✅ Update PWA manifest description — updated to FlowState branding with full feature description
- [x] **~~TASK-1274~~**: ✅ Migrate `'uncategorized'` sentinel to constant — created UNCATEGORIZED_PROJECT_ID in taskOperations.ts, used in supabaseMappers + useSupabaseDatabase

#### P3 — Backlog / Polish
- [x] **~~TASK-1275~~**: ✅ Remove 5 obsolete verification scripts in `scripts/` (verify-shadow-layer, verify-auth-user, verify-backup-system, verify-bug339-migration, verify-restore)
- [x] **~~TASK-1276~~**: ✅ Remove Storybook `title: 'PLACEHOLDER'` duplicate key (`OverflowTooltip.stories.ts:4`)
- [x] **~~TASK-1277~~**: ✅ Standardize z-index usage — replaced ~60 hardcoded values across 50 files with `var(--z-*)` tokens (dropdown, modal, popover, tooltip layers)
- [x] **~~TASK-1278~~**: ✅ Standardize font-size usage — replaced ~100 hardcoded px/rem values across 32 files with `var(--text-*)` tokens
- [x] **~~TASK-1279~~**: ✅ Add missing package.json metadata — homepage, repository, bugs fields
- [x] **~~TASK-1280~~**: ✅ Add copyright field to Tauri bundle config (`tauri.conf.json`)
- [x] **~~TASK-1281~~**: ✅ Adopt build-time console.log stripping — esbuild `pure` config strips console.log/debug in production
- [x] **~~TASK-1282~~**: ✅ Stop filtering console.error/warn in consoleFilter.ts — now always pass through

---

### TASK-1494: Tauri Parity Testing Suite (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (2026-03-09)

**Problem**: Zero Tauri-specific test coverage. Recurring production bugs caused by WebKitGTK differences (overflow:clip, dataTransfer empty, DataCloneError, path bugs, coordinate scaling). All E2E runs Chromium only.

**Plan**: 6-phase comprehensive parity suite:
- Phase 1: Enable WebKit in Playwright + fix failures
- Phase 2: Unit tests for all `isTauri()` code paths
- Phase 3: CSS safety scanner (overflow:clip, perspective traps)
- Phase 4: Tauri simulation E2E (inject `__TAURI_INTERNALS__`)
- Phase 5: Pre-deploy gate in `/tauri` skill
- Phase 6: Maintenance tooling (SOP, checklist, CLAUDE.md rule)

---

### ~~TASK-1495~~: Morning Dashboard Redesign — Opt-in Ritual + State Machine (✅ DONE)

**Priority**: Medium | **Status**: ✅ DONE (2026-03-13)

**Problem/Opportunity**: Morning dashboard was a forced full-page takeover that interrupted users during onboarding. Users need an opt-in ritual that fits into their morning workflow — suggested during the "golden window" (06:00-11:00) but always dismissible.

**Solution**: Redesigned as a lightweight, non-blocking ritual with two-step flow:
1. **Step 1**: Pick focus tasks (up to 3) from prioritized candidates (overdue, high-priority, active)
2. **Step 2**: Schedule them via auto-placement or manual time-blocking
3. **Summary chip**: Shows completion status throughout the day

**Architecture**:
- **`useMorningRitual.ts`**: State machine (idle → picking → scheduling → done/dismissed) + time window gating (06:00-11:00) + one-time-per-day enforcement via localStorage
- **UI Components**:
  - `MorningBanner.vue`: Dismissible banner with call-to-action, only shows during golden window
  - `MorningRitualPanel.vue`: Bottom sheet with step indicator + action buttons (Skip/Start)
  - `MorningCandidateCard.vue`: Compact task preview (title, priority badge, duration estimate)
  - `MorningSummaryChip.vue`: Shows "3/3 tasks scheduled" or "Ritual dismissed" after completion
- **Reuse**: CustomSelect (time picker), TaskContextMenu (priority/due date quick edits), TaskEditModal (full edit), BaseBadge (priority indicators)

**Integration**:
- `App.vue`: Mount banner + panel + summary chip globally (always available)
- `MorningDashboardView.vue`: Auto-open ritual on `/morning` route, show summary chip in header

**New Files**:
- `src/composables/useMorningRitual.ts`
- `src/components/morning-dashboard/MorningBanner.vue`
- `src/components/morning-dashboard/MorningRitualPanel.vue`
- `src/components/morning-dashboard/MorningCandidateCard.vue`
- `src/components/morning-dashboard/MorningSummaryChip.vue`

**Modified Files**:
- `src/App.vue`
- `src/views/MorningDashboardView.vue`

---

## Planned Tasks (NEXT/BACKLOG)

### ~~TASK-1484~~: Escape key closes TaskContextMenu (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-08)

**Problem**: TaskContextMenu had no Escape key handler. Pressing Escape did nothing while the context menu was open.

**Fix**: Added `handleKeyDown` listener on `document` when context menu becomes visible, calls `closeAllSubmenusNow()` + `emit('close')` on Escape. Includes `stopPropagation` to prevent other global Escape handlers from interfering. All other context menus (ContextMenu.vue, EdgeContextMenu.vue, useContextMenu.ts) already had Escape handling.

### ~~TASK-1473~~: Add calendar view to mobile PWA (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-07)

**Goal**: Add a mobile-optimized calendar view to the PWA bottom navigation. Replace the AI Chat tab with Calendar in the nav bar; move AI Chat into the Menu overlay instead.

**Implementation**:
- Created `MobileCalendarView.vue` — day view with time grid (6AM-11PM), task cards color-coded by priority, date navigation, current time indicator, unscheduled tasks section, RTL support
- Added mobile route `/mobile-calendar` in router with desktop redirect to `/calendar`
- Replaced AI nav tab with Calendar tab in `MobileNav.vue` (Calendar icon)
- Added AI Chat as a menu item in `MobileNav.vue` menu overlay (Sparkles icon + "AI Chat" label)

---

### ~~TASK-1474~~: Move AI Chat from mobile nav bar to menu overlay (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-07)

**Goal**: Remove AI Chat from the mobile bottom navigation bar (currently 4th tab) and add it as an item in the hamburger Menu overlay instead. This frees the nav slot for Calendar.

**Changes**:
- `MobileNav.vue`: Removed AI `router-link`, added menu item with Sparkles icon that navigates to `/mobile-ai-chat`
- AI Chat view works when accessed from menu

---

### ~~TASK-1500~~: Memory auto-refresh and verify memory health wired into Settings (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-10)

**Goal**: Add `refreshIfStale()` to `useWorkProfile.ts` that only runs `computeCapacityMetrics()` when observations are >24h old (instead of always on startup). Wire into app initialization. Verify AISettingsTab already has memory health UI.

**Changes**:
- `src/composables/useWorkProfile.ts`: Added `refreshIfStale()` — checks `memoryGraph` timestamps, skips refresh if freshest observation is <24h old, generates initial observations if none exist
- `src/composables/app/useAppInitialization.ts`: Replaced unconditional `computeCapacityMetrics()` call with `refreshIfStale()` (fire-and-forget, respects `aiLearningEnabled` setting)
- `AISettingsTab.vue`: Already had full Memory Health section (TASK-1356) — grade badge, section dots, progress, "Run Quick Check" button, hint to full dashboard. No changes needed.

---

### INQUIRY-1413: Evaluate open-source readiness for community sharing (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-02-23)

**Question**: Is FlowState ready to share with the open-source community? Users should be able to connect their own Supabase instance and use all features — no paid tiers, no locked features.

**Audit Areas**:
- Hardcoded secrets, API keys, VPS IPs in committed code
- Supabase setup documentation (schema, migrations, RLS policies)
- Environment variable documentation (.env.example completeness)
- First-run experience (can a new user self-host?)
- License file
- README quality for OSS contributors
- Doppler/proprietary service dependencies
- Build reproducibility without private infra

---

### ~~INQUIRY-1249~~: WhatsApp Bot Integration for Task Creation via WAHA + Groq (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Concept**: WhatsApp bot that receives forwarded messages, parses them with Groq AI, and creates tasks in FlowState automatically.

**Implementation**: Built complete bot at `packages/whatsapp-bot/` (~375 LOC):
- `src/index.ts` — Express webhook server, WAHA event handler, chat ID allowlist security
- `src/groqParser.ts` — Llama 3.3 70B via Groq API, extracts title/priority/dueDate/duration from Hebrew/English messages
- `src/supabaseClient.ts` — Direct REST insert to FlowState tasks table, sets `is_in_inbox: true` for triage
- `src/wahaClient.ts` — WhatsApp confirmation messages via WAHA API
- `docker-compose.yml` — WAHA (NOWEB engine) + bot, ready to deploy

**Architecture**:
```
WhatsApp (dedicated number) → WAHA (Docker, Contabo VPS) → Webhook → Supabase Edge Function
                                                                          ↓
                                                                   Groq API (free)
                                                                          ↓
                                                                   Supabase REST → FlowState
```

**Estimated Cost**: $0/month (all free tiers)

**Deployment steps** (user manual):
- [x] ~~Build webhook handler (Node.js/TypeScript)~~ ✅
- [x] ~~Integrate Groq for message parsing~~ ✅
- [x] ~~Connect to FlowState Supabase via REST API~~ ✅
- [x] ~~Deploy WAHA Docker container on Contabo VPS~~ ✅ (port 3050, Doppler secrets)
- [x] ~~Set up Doppler integration for WAHA secrets~~ ✅ (restart script at `/opt/waha/restart-waha.sh`)
- [ ] Buy dedicated SIM card for WhatsApp number
- [ ] Link WhatsApp number via WAHA dashboard (scan QR)
- [ ] Test end-to-end flow

---

### TASK-1458: WhatsApp Bot — Link Number & E2E Test (⏸️ PAUSED)

**Priority**: P2 | **Status**: ⏸️ PAUSED (2026-03-06) — waiting for user to buy a SIM card

**Blocked on**: Dedicated phone number (SIM card purchase)

**What's done**:
- WAHA container deployed on VPS (port 3050, `supabase_default` network)
- Doppler secrets configured (`WAHA_API_KEY`, `WAHA_DASHBOARD_USERNAME/PASSWORD`, `GROQ_API_KEY`)
- Restart script at `/opt/waha/restart-waha.sh` pulls fresh secrets from Doppler
- Dashboard accessible at `http://84.46.253.137:3050/dashboard`

**Remaining**:
- [ ] Buy dedicated SIM card
- [ ] Start session in WAHA dashboard, scan QR with new number
- [ ] Test: send WhatsApp message → verify task appears in FlowState inbox
- [ ] Configure chat ID allowlist for the new number

---

### TASK-1471: Docker Self-Host E2E Test (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (2026-03-06)

**Goal**: Verify a fresh self-hosted installation works end-to-end before sharing repo publicly.

**Bugs found & fixed (committed)**:
- [x] Kong `rate-limiting` plugin not declared in `KONG_PLUGINS` — added
- [x] `init-db.sh` had wrong filename (`fix_id_types.sql` → `20260106000000_fix_id_types.sql`) and was missing 12 of 24 migrations — fixed
- [x] `.env.self-host` / `.env.self-host.test` not gitignored — added
- [x] `supabase/postgres:17.2.0` image tag doesn't exist — updated to `17.6.1.095`
- [x] Created `scripts/test-self-host.sh` with 6 E2E tests + `--keep` flag for browser testing

**Remaining — NEXT SESSION START HERE**:
- [ ] Run `./scripts/test-self-host.sh --keep` — this builds the full Docker stack and runs 6 E2E tests, then keeps it up for browser testing
- [ ] Once tests pass, open `http://localhost:13050` in browser and verify: app loads, signup works, create a task, check it persists
- [ ] If tests fail, check logs with: `docker compose -p flowstate-test -f docker-compose.self-host.yml --env-file .env.self-host.test logs --tail=50`
- [ ] To tear down after testing: `docker compose -p flowstate-test -f docker-compose.self-host.yml --env-file .env.self-host.test down -v`

**Test script details** (`scripts/test-self-host.sh --keep`):
- Generates fresh secrets (JWT, Postgres password, anon/service_role keys)
- Uses isolated ports: frontend `:13050`, Kong API `:18000`, Postgres `:15432`
- Project name: `flowstate-test` (won't conflict with any running stack)
- 6 tests: frontend HTML, /health, Kong reachable, signup, sign-in, REST API tasks query
- `--keep` flag keeps stack running after tests pass so you can test in browser
- Previous run failed due to root disk full (0 bytes). Freed 6.7GB via `docker system prune`. Docker data-root is already on `/media/endlessblink/docker` (341GB free) so the build context issue was transient.

**Files**: `.gitignore`, `docker-compose.self-host.yml`, `docker/self-host/init-db.sh`, `scripts/test-self-host.sh`

---

### ~~TASK-1118~~: Test Suite Cleanup - Reduce 615 Tests to ~100 Essential (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-10)

**Result**: Reduced 985 → 878 tests (-11%), fixed 3 pre-existing failures, halved execution time (10s → 5s). Removed duplicates, tautologies, and collapsed redundant tests into `it.each`. All 878 tests pass.

---

### TASK-1386: Google Calendar Proxy Edge Function (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE | **Completed**: 2026-02-21

**Problem/Opportunity**: FlowState needs to display Google Calendar events in the calendar views without exposing OAuth tokens or making Google API calls from the client.

**Scope**: Create `supabase/functions/google-calendar-proxy/index.ts` — a Supabase Edge Function that:
- Validates the caller via Supabase JWT before proxying to Google
- Supports `list-calendars` and `list-events` actions
- Performs automatic token refresh on Google 401 and returns `newAccessToken` to client
- Follows the same CORS/auth pattern as `ai-chat-proxy`

**Implementation**:
- [x] Create `supabase/functions/google-calendar-proxy/index.ts`
- [x] CORS headers matching ai-chat-proxy (ALLOWED_ORIGINS, getCorsHeaders)
- [x] Supabase JWT validation via `createClient` + `getUser()`
- [x] `list-calendars` → GET `/users/me/calendarList`, returns `{ calendars: { id, summary, backgroundColor }[] }`
- [x] `list-events` → GET `/calendars/{calendarId}/events` with singleEvents/orderBy/timeMin/timeMax/maxResults=250
- [x] Token refresh on 401: POST to `oauth2.googleapis.com/token`, retry, return `newAccessToken`
- [x] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `Deno.env.get()`

**Files**:
- `supabase/functions/google-calendar-proxy/index.ts` (new)

---

### ~~TASK-359~~: Quick Add + Sort Feature (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

Batch capture mode: `Ctrl+.` opens Quick Capture modal, type titles + Enter, Tab to sort phase, 1-9 assigns project.

**Files**: `src/composables/useQuickCapture.ts`, `src/components/quicksort/QuickCaptureModal.vue`

---

### ~~TASK-1119~~: Remove Web Speech API - Use Whisper Only (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-13)

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

### ~~TASK-1131~~: Offline Voice Queue - Save & Retry When Online (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

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

### ~~TASK-353~~: Design Better Canvas Empty State (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-13)

Current empty state is minimal. Add visual illustration, feature highlights, guest mode sign-in prompt.

**File**: `src/components/canvas/CanvasEmptyState.vue`

**Resolution**: Redesigned with animated SVG illustration (floating task cards with connecting lines), 4 feature pills, engaging copy ("Your spatial canvas awaits"), glass-morphism action buttons with keyboard hints (N/G), ambient grid dots, sparkle effects, and full prefers-reduced-motion support. Storybook stories updated with 3 variants.

---

### Stress Test Suite (📋 PLANNED)

| Task | Description |
|------|-------------|
| TASK-362 | Sync conflict resolution (2 tabs editing, offline+online, race conditions) |
| TASK-363 | Auth edge cases (expired JWT, session timeout, concurrent sessions) |
| TASK-364 | WebSocket stability (disconnect, reconnect, subscribe cycles) |
| TASK-366 | Redundancy assessment (SPOF mapping, fallback testing) |

---

### ~~BUG-1199~~: Canvas Inbox Right-Click Acts as Ctrl+Click (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: Right-clicking on a task in the canvas inbox behaves as if Ctrl+Click was pressed (multi-select behavior) instead of opening a context menu or doing nothing.

**Root Cause**: The native `@click` event fires for ALL mouse buttons (left=0, right=2). When right-clicking, `@click` fires first (running selection logic), then `@contextmenu` fires. Canvas nodes don't have this issue because Vue Flow's `@node-click` filters by button internally.

**Fix Applied**: Added `event.button !== 0` early return in `handleTaskClick()` so only left-clicks trigger selection logic. Right-clicks now only fire the `@contextmenu` handler.

**Files Changed**:
- `src/composables/inbox/useUnifiedInboxActions.ts` - Added button check (1 line)

---

### ~~FEATURE-1200~~: Quick Add Full RTL Support + Auto-Expand for Long Tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Feature**: Two improvements to the Quick Add input in the main sidebar:

1. **Full RTL support**: The quick add input should properly support RTL text (Hebrew). Text direction should auto-detect or follow app locale.
2. **Auto-expand to fullscreen**: When typing a long task title that exceeds the input width, automatically open a fullscreen task creator popup/modal so the user has more space to write.

**Requirements**:
- [x] Add `dir="auto"` or RTL detection to quick add input — ✅ Done by TASK-1324 (`quickTaskDirection` computed in AppSidebar.vue)
- [x] RTL-aware placeholder text and icons — ✅ Done by TASK-1324 (Hebrew translations in `he.json`)
- [x] Character/width threshold to trigger fullscreen expansion — ✅ Auto-opens at 20+ words or 150+ chars
- [x] Smooth transition from inline input to fullscreen modal — ✅ Expand button + auto-trigger via `QuickTaskCreateModal`
- [x] Carry over typed text to the fullscreen creator — ✅ `initialTitle` prop on `QuickTaskCreateModal`
- [x] Fullscreen creator should also be fully RTL-aware — ✅ Uses `useHebrewAlignment` composable

**Implementation**:
- `AppSidebar.vue`: Expand button (Maximize2 icon) on textarea + auto-trigger at high threshold + `QuickTaskCreateModal` integration
- `QuickTaskCreateModal.vue`: Added `initialTitle` prop for text carry-over
- RTL: `quickTaskDirection` computed (regex on first char), Hebrew i18n placeholders, `useHebrewAlignment` in modal

---

### ~~FEATURE-1201~~: Intro/Onboarding Page for Guest and Signed-In Users (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

**Feature**: Single-screen welcome modal replacing the old WelcomeModal. Same flow for guest and signed-in users.

**Design Pivot**: Initially built as 4-step wizard, then pivoted to single screen based on UX research showing multi-step wizards have ~10-19% completion rates with 72% user abandonment. Linear (most admired productivity UX) uses zero wizards. Single screen gets users to first task faster.

**Design Decisions (Resolved)**:
- [x] What to show: Logo, 3 feature highlights, "Get Started" CTA, optional sign-up link for guests
- [x] Format: Single welcome screen (research-backed — "quick win" retains 80% more users)
- [x] Reappear: No — dismissed permanently via localStorage (`flowstate-onboarding-v2`)

**Implementation**:
- [x] `useOnboardingWizard.ts` composable — visibility, dismiss, keyboard, localStorage persistence
- [x] `OnboardingWizard.vue` — single-screen modal with Teleport, glass morphism, auth-aware sign-up CTA
- [x] Moved from MainLayout to App.vue — now shows on both desktop and mobile
- [x] Removed old WelcomeModal from MainLayout (component kept for reference)
- [x] Keyboard: Enter or Escape to dismiss
- [x] Storybook stories (Guest + Signed In variants)
- [x] Build passes, zero new TS errors

**Files Created**: `src/composables/app/useOnboardingWizard.ts`, `src/components/onboarding/OnboardingWizard.vue`, `src/stories/modals/OnboardingWizard.stories.ts`
**Files Modified**: `src/App.vue`, `src/layouts/MainLayout.vue`

---

### ~~TASK-1283~~: Google Calendar Plugin — Calendar View Integration (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-22) | **Blocked By**: ~~FEATURE-1202~~

**Feature**: Add a plugin/settings option to connect Google Calendar. Once connected, display Google Calendar events alongside FlowState tasks in the Calendar view.

**Requirements**:
- [ ] Google OAuth must include `calendar.readonly` scope (extends FEATURE-1202)
- [ ] Settings UI: "Connect Google Calendar" toggle in Settings > Integrations
- [ ] Fetch events from Google Calendar API (read-only)
- [ ] Display events in Calendar view with distinct styling (differentiate from tasks)
- [ ] Handle token refresh for long-lived sessions
- [ ] Graceful degradation when offline or token expired

**Key Decisions Needed**:
- Read-only vs read-write (create FlowState tasks from calendar events?)
- Which calendars to sync (primary only vs user-selectable)
- Event display style (overlay, side-by-side, merged timeline)

---

### ~~TASK-1452~~: KDE Widget — Switch Active Timer to Different Task (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-05)

**Task**: When a Pomodoro timer is running on task A and user clicks play on task B, reassign the running timer session to task B instead of creating a new session.

**Implementation**:
1. Added `switchTaskForSession()` method to KDE widget backend
2. Implemented 3-state play icon:
   - Stopped state: play icon
   - Running on OTHER task: skip-forward icon (indicates timer switch)
   - Running on THIS task: chronometer icon (indicates timer active)
3. Smart click handler:
   - Checks if timer running and on different task
   - If yes: calls `switchTaskForSession()` to reassign
   - If no: starts new timer session normally

---

### ~~BUG-1453~~: Production CSS Preload + Mobile Quick Sort Swipe Broken (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-07)

**Two issues reported:**
1. Production CSS preload failure (`MorningDashboardView-7ECQeecR.css`)
2. Mobile PWA Quick Sort card swipe/drag not working (user says "used to work")

#### Sub-issue 1: CSS Preload Failure — RESOLVED

**Root cause**: `SITE_URL` and `API_URL` GitHub Actions repository variables were deleted (between Mar 3-4). This broke the Cloudflare cache purge step in `.github/workflows/deploy.yml`, causing 18 consecutive deploy failures. VPS got new assets via rsync but Cloudflare CDN served stale `index.html` referencing old CSS/JS hashes that no longer existed on VPS.

**Fixes applied (3 commits pushed):**
- Restored `SITE_URL` (`https://in-theflow.com`) and `API_URL` (`https://api.in-theflow.com`) via `gh variable set`
- Made CF purge step resilient: guards against empty SITE_URL with graceful skip instead of `exit 1`
- Fixed 6 pre-existing CI type/lint errors in ChatMessage.vue, BaseModal.vue, AIQualityDashboard.vue, QuickSortCard.vue
- Deploy pipeline now fully green (all steps pass including chunk integrity verification)

#### Sub-issue 2: Mobile Quick Sort Swipe — RESOLVED

**Three layers of root cause fixed:**

1. **Touch event regression** (commit `072eea6c`): `preventDefault()` in `touchstart` before direction known — Android Chrome drops entire touch sequence. Fixed: `touchstart` always `{ passive: true }`, `preventDefault()` deferred to `touchmove` after 10px lock threshold.

2. **CSS `!important` overrides killing transform**: `global-overrides.css` had `.task-card:hover { transform: none !important }` and `.task-card:active { transform: scale(0.99) !important }` — both override the inline `translateX` during drag. Fixed: added `:not(.swiping)` to both selectors.

3. **Overflow clipping on mobile**: Ancestor containers (`.mobile-content`, `.sort-phase`, `.qs-main`) had `overflow: hidden/auto` which clips the card's `translateX` displacement. CSS doesn't allow `overflow-x: visible` with `overflow-y: auto` (browsers force both to `auto`). **Fix: Card switches to `position: fixed` during swipe**, capturing `getBoundingClientRect()` on swipe start and pinning to viewport coordinates. This escapes ALL ancestor overflow clipping. Also removed `perspective: 1000px` from `.card-stack` (CSS spec: perspective creates containing block for fixed descendants).

**Additional improvements:**
- Mobile-friendly edit bottom sheet with toggle pills, project picker with emoji icons
- Overlay dead zone (50px before showing, max 0.7 opacity)
- Velocity-based swipe minimum distance (40% threshold) to prevent accidental triggers
- SOP: `docs/sop/SOP-063-mobile-swipe-gestures.md`
- `.github/workflows/deploy.yml` — deploy pipeline (fixed)

**Relevant commits:**
- `072eea6c` — batch update (useSwipeGestures refactor + user's QuickSortCard rewrite)
- `3a149cb6` — last known working version of useSwipeGestures
- `af3a63b7` — mobile QuickSort visual fixes
- `939ce6a5` — split MobileQuickSortView into sub-components

**Files**: `packages/kde-widget/contents/ui/main.qml`

**Architecture**:
- Reuses existing session management (`timer_sessions` table)
- Updates `task_id` on running session instead of creating duplicate
- Preserves elapsed time, start time, pomodoro count
- No breaking changes to sync protocol

**Progress (2026-03-05):** Feature implemented and verified. Play icon now shows 3 states correctly. Timer successfully switches to different task when user clicks play. Tested with both timer running and idle states.

---

### Other Planned Tasks

| Task | Priority | Description |
|------|----------|-------------|
| ~~**TASK-1289**~~ | **P0** | ✅ **Investigate severe task position drift episode** |
| ~~**TASK-1285**~~ | **P0** | ✅ **Commit deploy safeguards & clean up 20 dead Claude hooks** (2026-02-10) |
| ~~**FEATURE-1293**~~ | **P2** | ✅ **Catalog View UX/UI Redesign — bulk ops, scanning, inline editing, review/triage** |
| ~~BUG-1199~~ | P1 | ✅ Canvas inbox right-click acts as Ctrl+Click |
| ~~BUG-1206~~ | P0 | ✅ Task details not saved when pressing Save in canvas (3-layer fix: pending write guard + extended isVeryRecent + modal-aware recovery) |
| ~~BUG-1208~~ | P1 | ✅ Task edit modal closes on text selection release |
| ~~BUG-1212~~ | P0 | ✅ Sync queue CREATE retry causes "duplicate key" corruption |
| ~~BUG-1286~~ | P2 | ✅ PWA Today View shows 2:00 AM on all tasks due to UTC timezone parsing |
| ~~**BUG-1291**~~ | **P0** | ✅ **Timer not starting from calendar play btn / context menu Start btn / canvas; Calendar has no right-click context menu** |
| ~~**BUG-1292**~~ | **P1** | ✅ **KDE Widget intermittently fails to start break timer (30s polling gap after session complete)** |
| ~~**TASK-1292**~~ | **P0** | ✅ **Quick task creation in KDE widget — quick-add input (+ / play buttons) + pinned task chips (monorepo)** |
| ~~**BUG-1293**~~ | **P1** | ✅ **Canvas CSS tokenization damage — broken shadows, phantom tokens, debug elements** |
| ~~**BUG-1294**~~ | **P1** | ✅ **Calendar play button shouldn't reset timer or create new instances when timer is already running for that task** |
| ~~**BUG-1296**~~ | **P1** | ✅ **Time block notifications never fire — _rawTasks → rawTasks property name mismatch** |
| ~~**BUG-1302**~~ | **P1** | **✅ Time block notifications still not firing — milestones silently missed despite BUG-1296 fix** |
| ~~**BUG-1303**~~ | **P2** | ✅ **Mark Done doesn't stop active timer running on that task** (✅ DONE — fix in taskOperations.ts:431) |
| ~~**BUG-1304**~~ | **P2** | ✅ **Done tasks in calendar view have no visual done indicator** (✅ DONE — visual indicator in all 3 calendar views) |
| ~~**BUG-1305**~~ | **P2** | ✅ **TaskQuickEditPopover renders behind AI Chat panel — z-index stacking issue** |
| **TASK-1337** | **P3** | **👀 Storybook Design Streamlining — align all 163 stories with design system (glass morphism, tokens, components)** |
| ~~**TASK-1338**~~ | **P0** | ✅ **Configurable PWA Push Notifications — per-category controls, quiet hours, server-side push service** |
| ~~**BUG-1311**~~ | **P3** | ✅ **Storybook: 3 story files fail to import (ReloadPrompt, CalendarDayView, CalendarWeekView)** |
| ~~**TASK-1311**~~ | **P2** | ✅ **Add date picker to Quick Sort** |
| ~~**TASK-1312**~~ | **P2** | ✅ **Quick Sort context panel — date/day, priority, project info (desktop + PWA responsive)** |
| ~~**TASK-1313**~~ | **P3** | ✅ **UI polish: FocusView pause & leave, kanban tooltips, date picker popover, RTL dir** |
| ~~**FEATURE-1314**~~ | **P2** | ✅ **AI Weekly Quick Sort — sort week's tasks with AI + push to canvas date groups** |
| **TASK-1326** | **P2** | **👀 Weekly Plan AI Enhancements (Batching, Theme, Feedback Loop)** |
| ~~**TASK-1385**~~ | **P2** | ✅ **Weekly Plan AI — deterministic rebalancer + smarter model routing + prompt quality** |
| ~~**TASK-1399**~~ | **P2** | ✅ **Weekly Plan — model/provider selector connected to centralized AI model registry** |
| ~~**TASK-1400**~~ | **P2** | ✅ **SOP-045 Tauri AppImage Update Workflow + fix stale binary — created SOP, fixed user's stale v1.2.18 AppImage, removed debug logging from canvas drag** |
| ~~**FEATURE-1317**~~ | **P3** | ✅ **AI Work Profile / Persistent Memory — learn user work patterns for smarter weekly plans** |
| ~~**TASK-1316**~~ | **P2** | ✅ **AI Provider Usage & Cost Tracking — new Settings tab with per-provider token/cost totals** |
| ~~**TASK-1341**~~ | **P2** | ✅ **Quick Sort UX Polish — left sidebar action buttons, arrow key shortcuts, action feedback overlays, swipe fix** (✅ DONE 2026-02-16) |
| **FEATURE-1342** | **P2** | **🔄 AI Task Suggestions — per-task/group button to auto-suggest priority, due date, status based on user data** |
| ~~**BUG-1343**~~ | **P2** | ✅ **Quick Sort exits when swiping right on PWA mobile** (✅ DONE 2026-02-17) |
| ~~**BUG-1350**~~ | **P0** | ✅ **New Task transcription page closes prematurely — transcription doesn't appear on PWA mobile** (✅ DONE 2026-02-18) |
| ~~**BUG-1352**~~ | **P1** | ✅ **Calendar inbox filtered by board smart view — only shows 4 tasks instead of all unscheduled** (✅ DONE 2026-02-17) |
| ~~**BUG-1353**~~ | **P0** | ✅ **Sidebar quick task: metadata buttons disappear on click + no save confirmation** (✅ DONE 2026-02-17) |
| ~~**BUG-1355**~~ | **P1** | ✅ **Can't log out — Supabase signOut fails silently, session re-establishes. Buttons squashed. Post-logout UI stuck** (✅ DONE 2026-02-17) |
| ~~**BUG-1357**~~ | **P0** | ✅ **Mobile PWA timer sync broken with web app** (✅ DONE 2026-02-18) |
| ~~**TASK-1354**~~ | **P2** | ✅ **AI quality assessment + timer fixes + CSS cleanup** (✅ DONE 2026-02-18) |
| ~~**BUG-1351**~~ | **P0** | ✅ **Calendar drag ghost stuck after inbox→day drop** (✅ DONE 2026-02-17) |
| ~~**BUG-1349**~~ | **P2** | ✅ **QuickSort progress bar jumps when pressing number keys to assign project** (✅ DONE 2026-02-17) |
| ~~**BUG-1359**~~ | **P0** | ✅ **vue-i18n version mismatch causing $t() SyntaxErrors — upgraded vue-i18n 9→11, re-applied i18n translations across 11 files (EN+HE)** (✅ DONE 2026-02-19) |
| ~~**BUG-1348**~~ | **P0** | ✅ **Priority badge color mismatch — medium badge gray instead of orange** (✅ DONE 2026-02-17) |
| ~~**TASK-1356**~~ | **P2** | ✅ **AI Memory Assessment System — test/evaluate memory effectiveness for user context + AI usage across app, CLI + admin settings UI** (✅ DONE 2026-02-18) |
| **TASK-1358** | **P2** | **🔄 Rewrite 28 canvas todo tests — replace over-designed Vue Flow mocking with direct store/handler unit tests using real data shapes** |
| ~~**BUG-1347**~~ | **P0** | ✅ **KDE Plasma widget freeze — gated 40+ console.log behind debug flag, staggered concurrent XHR with Qt.callLater(), reactive transition timer, throttled canvas repaints** (✅ DONE 2026-02-19) |
| ~~**BUG-1365**~~ | **P0** | ✅ **Calendar day view — task disappears after editing and saving (false positive scheduleExplicitlyRemoved for instance-based tasks)** (✅ DONE 2026-02-19) |
| ~~**BUG-1360**~~ | **P0** | ✅ **Canvas long task cards cut off when zooming — removed LOD content hiding, overflow:hidden chain, title 3-line clamp** (✅ DONE 2026-02-20) |
| ~~**BUG-1567**~~ | **P2** | ✅ **Deleted projects still appear in QuickSort CategorySelector — project store `projects` computed doesn't filter soft-deleted projects (is_deleted=true)** (✅ DONE 2026-03-18) |
| ~~**BUG-1361**~~ | **P1** | ✅ **Calendar inbox drag ghost pills stuck on screen — endGlobalDrag() never called when source element removed by reactive filtering** (✅ DONE 2026-02-19) |
| **FEATURE-1363** | **P2** | **📋 Add reminders & notifications to all platforms (PWA, Tauri, KDE widget)** |
| **BUG-1346** | **P1** | **🔄 Mobile Inbox tab broken in PWA on mobile — layout/design broken** (🔄 IN PROGRESS 2026-03-04) |
| ~~**TASK-1362**~~ | **P0** | ✅ **Calendar task selection, multi-select & keyboard actions — click to select, Ctrl+click multi-select, Delete→inbox, Shift+Delete→remove, drag-back to inbox** (✅ DONE 2026-02-20) |
| ~~**BUG-1366**~~ | **P1** | ✅ **i18n locale desync — UI stays Hebrew when English selected, store locale hardcoded to 'en' ignoring localStorage** (✅ DONE 2026-02-20) |
| ~~**BUG-1367**~~ | **P2** | ✅ **Canvas inbox panel on wrong side — parent CSS overrode is-right-side to left, flipped to right** (✅ DONE 2026-02-20) |
| ~~**BUG-1368**~~ | **P2** | ✅ **? keyboard shortcut broken on Hebrew layout — event.key check fails on non-Latin layouts, added event.code fallback** (✅ DONE 2026-02-20) |
| ~~**BUG-1374**~~ | **P1** | ✅ **AI Chat 4-bug combo — Hebrew response on English input, LTR for Hebrew text, fluffy advice, wrong tasks returned (all fixed 2026-02-21)** |
| ~~**TASK-1375**~~ | **P1** | ✅ **AI Pipeline orchestrator + types — create pipeline/ with guardrail interfaces and function composition** (✅ DONE 2026-02-21) |
| ~~**TASK-1376**~~ | **P1** | ✅ **Language detector — deterministic Unicode-range detection, detectLanguageMismatch()** (✅ DONE 2026-02-21) |
| ~~**TASK-1377**~~ | **P1** | ✅ **Context optimizer — separate task titles from metadata, character budget, date-relative filtering** (✅ DONE 2026-02-21) |
| ~~**TASK-1378**~~ | **P1** | ✅ **Response validator — consolidate 3 cleanup locations into one, add UUID stripping, reuse qualityAssessment rules** (✅ DONE 2026-02-21) |
| ~~**TASK-1379**~~ | **P1** | ✅ **Language enforcer — post-processing guardrail, detect mismatch + flag in metadata** (✅ DONE 2026-02-21) |
| ~~**TASK-1380**~~ | **P1** | ✅ **Response length enforcer — cap by intent (greetings, tool summaries, analytical)** (✅ DONE 2026-02-21) |
| ~~**TASK-1381**~~ | **P1** | ✅ **Wire pre-processing into useAIChat — call runPreProcess before ReAct, use contextOptimizer** (✅ DONE 2026-02-21) |
| ~~**TASK-1382**~~ | **P1** | ✅ **Wire post-processing into useAIChat — runPostProcess after ReAct, replace inline cleanup** (✅ DONE 2026-02-21) |
| ~~**TASK-1383**~~ | **P1** | ✅ **Simplify ChatMessage.vue renderedContent — remove redundant regex, pipeline handles cleanup** (✅ DONE 2026-02-21) |
| ~~**TASK-1384**~~ | **P1** | ✅ **Unit tests for pipeline — guardrails, language detection, context optimization, composition** (✅ DONE 2026-02-21) |
| ~~**TASK-1388**~~ | **P1** | **✅ Pre-digested reasoning engine — compute task analysis in code, LLM formats facts naturally** (✅ DONE) |
| ~~**TASK-1389**~~ | **P1** | **✅ Skeleton prompting for agent chains — code generates sections, LLM writes bridges** (✅ DONE) |
| ~~**TASK-1390**~~ | **P1** | **✅ Fluff detector guardrail — heuristic scoring: task name references, data points, no generic phrases** (✅ DONE) |
| ~~**TASK-1391**~~ | **P1** | **✅ Validation + retry loop — retry once with feedback when fluff score < 0.5** (✅ DONE) |
| ~~**TASK-1392**~~ | **P1** | **✅ Keyword-based tool hints — deterministic keyword→tool mapping injected into system prompt** (✅ DONE) |
| ~~**TASK-1393**~~ | **P1** | **✅ `projectId` filter on `list_tasks` — quick win, 15 minutes** (✅ DONE) |
| ~~**TASK-1394**~~ | **P1** | **✅ Counting vs listing clarification — system prompt rule to prevent unnecessary tool calls** (✅ DONE) |
| ~~**TASK-1395**~~ | **P1** | **✅ Install uFuzzy + `resolveTask()` helper — fuzzy title matching for entity resolution** (✅ DONE) |
| ~~**TASK-1396**~~ | **P1** | **✅ Wire `resolveTask()` into write tools — title-based resolution fallback in `validateTaskExists()`** (✅ DONE) |
| ~~**TASK-1397**~~ | **P1** | **✅ `mark_task_done` convenience tool — accepts title string, most common user action** (✅ DONE) |
| ~~**TASK-1398**~~ | **P1** | **✅ Conversation entity memory — track mentioned tasks, resolve pronouns ("it", "that one")** (✅ DONE) |
| **TASK-1386** | **P2** | **✅ Google Calendar proxy Edge Function — list-calendars, list-events, token refresh on 401** |
| ~~**BUG-1417**~~ | **P1** | ✅ **Canvas nodes nearly invisible — undefined `--shadow-color-sm` token + near-identical bg = no depth** (✅ DONE 2026-02-27) |
| ~~**TASK-1420**~~ | **P1** | ✅ **Add project selector to task edit modal — TaskEditMetadata missing project field** (✅ DONE 2026-02-27) |
| ~~**TASK-1419**~~ | **P1** | ✅ **Inbox multi-select bulk property updates — context menu actions apply to all selected tasks** (✅ DONE 2026-02-27) |
| ~~**TASK-1418**~~ | **P1** | ✅ **Too many buttons on calendar dashboard — consolidate into dropdown or settings** (✅ DONE 2026-02-27) |
| ~~**TASK-1435**~~ | **P2** | ✅ **Active task glass pill — KDE companion widget + AppHeader pill showing current Pomodoro task** (✅ DONE 2026-03-03) |
| ~~**TASK-1424**~~ | **P2** | ✅ **KDE widget nanny notifications — schedule-gated idle reminders when no Pomodoro active** (✅ DONE 2026-03-03) |
| ~~**TASK-1423**~~ | **P2** | ✅ **KDE widget: add button to open Tauri or web app** (✅ DONE 2026-03-03) |
| ~~**TASK-1431**~~ | **P2** | ✅ **KDE widget "Today" toggle button — standalone chip in pinned row, composable with any dropdown filter** (✅ DONE 2026-03-02) |
| ~~**TASK-1429**~~ | **P0** | ✅ **KDE Widget Task Editing — inline edit panel (status/priority/due date) + "Open in App" deep link + perm delete + duration presets** (✅ DONE 2026-03-03) |
| ~~**TASK-1428**~~ | **P0** | ✅ **Auto-inherit group properties when creating task in a group (e.g. "Today" → today's due date)** (✅ DONE 2026-03-03) |
| ~~**TASK-1440**~~ | **P1** | ✅ **Gamification offline resilience — local-first state updates + try/catch wrapping for all Supabase writes** (✅ DONE 2026-03-03) |
| ~~**TASK-1441**~~ | **P2** | ✅ **Graceful offline UX for non-cacheable features — AI chat, file uploads, Drive show informative messages instead of failing silently** (✅ DONE 2026-03-03) |
| ~~**BUG-1442**~~ | **P1** | ✅ **timer_sessions.position_version column does not exist — DB schema mismatch** (✅ DONE 2026-03-04 — code already guards correctly, no path queries this column) |
| ~~**TASK-1443**~~ | **P2** | ✅ **Calendar Delete key shows confirmation dialog before unscheduling event (instead of silent action)** (✅ DONE 2026-03-04) |
| ~~**TASK-1448**~~ | **P2** | ✅ **KDE Widget quick-add due date dropdown — default "Today" so tasks appear in today views** (✅ DONE 2026-03-05) |
| ~~**TASK-1450**~~ | **P2** | ✅ **Integrate Quick Sort sessions into offline sync queue for full PWA offline support** (✅ DONE 2026-03-05) |
| ~~**TASK-1451**~~ | **P2** | ✅ **Auto-inherit filter context when creating tasks — useFilterDefaults composable** (✅ DONE 2026-03-05) |
| ~~**TASK-1452**~~ | **P2** | ✅ **KDE Widget — Switch Active Timer to Different Task** (✅ DONE 2026-03-05) |
| ~~**TASK-1460**~~ | **P2** | ✅ **KDE Widget — Bump task limit to 100 + group by project** (✅ DONE 2026-03-06) |
| ~~**BUG-1461**~~ | **P1** | ✅ **KDE widget hard-DELETE caused ghost tasks in web app — changed to soft-delete + smart merge fix** (✅ DONE 2026-03-06) |
| ~~**TASK-1484**~~ | **P3** | ✅ **Escape key closes TaskContextMenu** (✅ DONE 2026-03-08) |
| ~~**TASK-1496**~~ | **P2** | ✅ **Non-obstructive overflow tooltips on all truncated text app-wide** (✅ DONE 2026-03-09) |
| **BUG-1498** | **P2** | 🔄 **Taskbar nanny not triggering after 5min idle without active task (INQUIRY-1489 regression)** |
| **BUG-1497** | **P2** | 📋 **CSS safety test failing due to missing fileURLToPath import** |
| ~~**TASK-1487**~~ | **P2** | ✅ **Search modal: delete fix + filter pills (Today, Hide Done, High Priority, No Date)** (✅ DONE 2026-03-08) |
| ~~**BUG-1490**~~ | **P2** | ✅ **KDE widget stops syncing — token refresh chain break, missing 401 handling, isRefreshingToken deadlock** (✅ DONE 2026-03-09) |
| **BUG-1530** | **P2** | 📋 **Dragging task to Today canvas group doesn't update Calendar inbox** (📋 PLANNED 2026-03-14) |
| **BUG-1491** | **P0** | 🔄 **Canvas duplicate tasks appear sporadically across views** (🔄 IN PROGRESS 2026-03-09) |
| ~~**INQUIRY-1489**~~ | **P2** | ✅ **Nanny activation for unchosen tasks idle >5min in taskbar** (✅ DONE 2026-03-09) |
| ~~**TASK-1501**~~ | **P3** | ✅ **AI tools audit: fix byStatus stale keys, add undo to update_task and create_group** (✅ DONE 2026-03-10) |
| ~~**BUG-1504**~~ | **P2** | ✅ **Canvas inbox: left-click multi-selects tasks unexpectedly, can't deselect** (✅ DONE 2026-03-12) |
| ~~**BUG-1521**~~ | **P2** | ✅ **KDE Widget: pinned task chip click does nothing — searches only filtered tasks, misses match** (✅ DONE 2026-03-14) |
| ~~**BUG-1506**~~ | **P0** | ✅ **Edit Task: description loses bullet points on save — htmlToMarkdown regex truncation** (✅ DONE 2026-03-14) |
| ~~**BUG-1505**~~ | **P2** | ✅ **KDE Widget: Nanny popup only shows ~2 tasks — increase limit and sort by due date** (✅ DONE 2026-03-13) |
| **TASK-1499** | **P2** | 🔄 **KDE widget: fix canvas sort/filter — wrong column + missing Y-position sorting** (🔄 IN PROGRESS 2026-03-10) |
| ~~**TASK-1500**~~ | **P2** | ✅ **Smart model routing: complexity classifier + hybrid pricing (free for simple, premium for complex)** (✅ DONE 2026-03-13) |
| ~~**TASK-1486**~~ | **P2** | ✅ **Pinned/persistent tasks — always-visible utility tasks (e.g. "General Dev", "Organize Tasks") separate from regular task list** (✅ DONE 2026-03-13) |
| ~~**TASK-1485**~~ | **P2** | ✅ **Move AI Assist to More submenu + teal Mark Done line** (✅ DONE 2026-03-09) |
| **TASK-1483** | **P2** | 📋 **Redesign Dev-Maestro Dashboard UI** (📋 PLANNED 2026-03-08) |
| ~~**TASK-1457**~~ | **P2** | ✅ **Demo test user + Playwright fixtures — seeded user with tasks, groups, and data for E2E testing** (✅ DONE 2026-03-13) |
| ~~**TASK-1456**~~ | **P0** | ✅ **Add permanent delete button to right-click context menu** (✅ DONE 2026-03-06) |
| ~~**TASK-1455**~~ | **P2** | ✅ **Catalog view: show uncategorized tasks so they can be categorized in-place** (✅ DONE 2026-03-09) |
| ~~**TASK-1454**~~ | **P2** | ✅ **Quick Sort: match PWA look/behavior on desktop + confirm permanent delete** (✅ DONE 2026-03-09) |
| ~~**BUG-1472**~~ | **P1** | ✅ **Canvas and Calendar inbox filters synced — persistence keys not context-scoped** (✅ DONE 2026-03-07) |
| ~~**BUG-1453**~~ | **P0** | ✅ **Production CSS preload + mobile Quick Sort swipe broken** (✅ DONE 2026-03-07) |
| ~~**BUG-1477**~~ | **P1** | ✅ **Zombie tasks reappear after permanent delete — tombstone/delete ordering + DB trigger conflict** (✅ DONE 2026-03-07) |
| ~~**BUG-1479**~~ | **P2** | ✅ **Date picker calendar closes when moving cursor to it — NPopover mouseleave** (✅ DONE 2026-03-07) |
| **BUG-1447** | **P2** | 👀 **Pin task disappears on Enter + task search + widget sync** (👀 REVIEW 2026-03-05) |
| **TASK-1446** | **P2** | ✅ **BUG-1137: Add Guest Session ID for migration tracking — explicit UUID links guest data to new account on sign-up** (✅ DONE 2026-03-04) |
| ~~**TASK-1445**~~ | **P2** | ✅ **Fix focus mode dropdown closing on hover + overlapping menus — UX research & redesign** (✅ DONE 2026-03-05) |
| ~~**TASK-1459**~~ | **P2** | ✅ **Storybook story quality pass — fix broken/unclear stories for Teleport components and PWA Screens** (✅ DONE 2026-03-07) |
| **TASK-1444** | **P1** | 🔄 **Tauri desktop app design parity — investigate and fix visual discrepancies vs web/Storybook** (🔄 IN PROGRESS 2026-03-04) |
| **INQUIRY-1438** | **P0** | 🔄 **Assess open-source self-hosting readiness — what's needed for GitHub sharing (Win/Mac/Linux)** (🔄 IN PROGRESS 2026-03-03) |
| ~~**BUG-1451**~~ | **P1** | ✅ **Task done/deleted state inconsistent across views — Board hideDoneTasks coupled to Canvas/Calendar** (✅ DONE 2026-03-05) |
| ~~**BUG-1449**~~ | **P1** | ✅ **KDE widget notification barrage + popup dismiss + nanny task selection** (✅ DONE 2026-03-05) |
| ~~**TASK-1434**~~ | **P0** | ✅ **Calendar drag-to-create — click and drag on time slots to create a new task** (✅ DONE 2026-03-03) |
| ~~**TASK-1433**~~ | **P0** | ✅ **Right-click task context menu UX overhaul — reduce bloat, fix hierarchy, progressive disclosure** (✅ DONE 2026-03-03) |
| ~~**BUG-1432**~~ | **P1** | ✅ **Overdue tasks display today's date instead of actual due date** (✅ DONE 2026-03-05) |
| ~~**TASK-1427**~~ | **P0** | ✅ **Offline: merge write queue into read cache on offline load** (✅ DONE 2026-03-04) |
| ~~**TASK-1426**~~ | **P0** | ✅ **Offline: auth grace period — keep expired session for local ops** (✅ DONE 2026-03-04) |
| ~~**TASK-1425**~~ | **P0** | ✅ **Offline: fast startup — skip Supabase when navigator.onLine=false** (✅ DONE 2026-03-04) |
| **TASK-1422** | **P0** | 🔄 **Full offline mobile support — PWA works E2E without network** (🔄 IN PROGRESS 2026-03-02) |
| ~~**TASK-1421**~~ | **P0** | ✅ **Investigate & fix sluggish localhost performance** (✅ DONE 2026-03-02) |
| ~~**BUG-1416**~~ | **P0** | ✅ **Calendar inbox "today" filter shows wrong tasks — dueDate format mismatch (ISO vs YYYY-MM-DD)** (✅ DONE 2026-03-13) |
| ~~**BUG-1415**~~ | **P0** | ✅ **Catalog drag doesn't move task to target group — drops on task rows make subtasks instead of transferring between groups** (✅ DONE 2026-02-25) |
| ~~**TASK-1405**~~ | **P1** | ✅ **Replace LLM Distribution with Deterministic Algorithm in Weekly Plan** (✅ DONE 2026-03-13) |
| ~~**TASK-1403**~~ | **P2** | ✅ **Recurring Tasks — Clone-on-Complete with recurrence_rule column** (✅ DONE 2026-02-22) |
| ~~**TASK-1402**~~ | **P1** | ✅ **Decouple canvas/calendar inbox filtering — isInInbox now user-controlled, placement uses position-based filtering** (✅ DONE 2026-02-22) |
| ~~**TASK-1387**~~ | **P1** | **✅ Centralize all AI model references to single source of truth** (✅ DONE 2026-02-21) |
| ~~**TASK-1372**~~ | **P1** | **✅ Calendar delete should warn tasks will return to inbox — left-click + Delete on calendar needs confirmation dialog** (✅ DONE 2026-03-13) |
| ~~**BUG-1371**~~ | **P0** | ✅ **Connected canvas node persists after deletion — deleting a node with edges leaves it visible on canvas** (✅ DONE 2026-02-20) |
| ~~**BUG-1370**~~ | **P0** | ✅ **Canvas inbox drag broken — can't drag tasks from canvas inbox to canvas (Tauri + possibly local dev)** (✅ DONE 2026-02-20) |
| ~~**BUG-1369**~~ | **P0** | ✅ **Canvas tasks persist after marked done — completed tasks remain visible on canvas instead of being removed** (✅ DONE 2026-02-21) |
| ~~**TASK-1345**~~ | **P2** | ✅ **Perfect Hebrew Whisper Transcription on Mobile PWA — language param, Hebrew prompt, temperature=0, iOS Safari .m4a fix, verbose_json confidence filtering** |
| ~~**TASK-1344**~~ | **P2** | ✅ **AI Feature Parity Desktop→PWA + API Pricing/Usage Settings Sync — code done, useAISync.ts implemented** |
| **FEATURE-1345** | **P2** | **🔄 Capacitor Android App — wrap Vue PWA for Play Store distribution (config + build scaffold done)** |
| ~~**TASK-1339**~~ | **P0** | ✅ **Tasks must persist over refresh in guest mode** (✅ DONE 2026-02-17) |
| ~~**BUG-1340**~~ | **P0** | ✅ **Kanban drag-drop broken — Vue 3 $attrs boolean bug (forceFallback/delayOnTouchOnly passed as empty string)** |
| ~~**TASK-1327**~~ | **P0** | ✅ **Centralized LLM Model Registry — single source of truth for all AI model lists, updating one place updates all dropdowns** (✅ DONE 2026-02-17) |
| ~~**TASK-1324**~~ | **P0** | ✅ **URL Display Truncation — shorten long pasted URLs/links across all views (CSS ellipsis, full URL preserved)** (✅ DONE 2026-02-17) |
| ~~**BUG-1333**~~ | **P0** | ✅ **Calendar inbox shows only 2 tasks — stale auto-instances + wrong filter source** |
| ~~**TASK-1323**~~ | **P1** | ✅ **Console Log Cleanup — reduce verbose/debug logging noise across app** (✅ DONE 2026-02-14) |
| ~~**TASK-1322**~~ | **P1** | ✅ **Calendar Month View Fixes — remove dueDate pollution, vertical event layout, drag-move fix, hover tooltips** (✅ DONE 2026-02-17) |
| ~~**TASK-1319**~~ | **P0** | ✅ **Keyboard Shortcuts Help Panel — ? button + Shift+? shortcut, organized categories, blurred backdrop** (✅ DONE 2026-02-14) |
| ~~**TASK-1320**~~ | **P1** | ✅ **Quick Sort UX Redesign — Edit-in-Place with Explicit Advancement (pin-by-ID, Save button, swipe swap)** |
| ~~**BUG-1309**~~ | **P0** | ✅ **Remove corruption overlay, arena, and all gamification UI — visual noise and disconnected UX** |
| ~~**BUG-1301**~~ | **P0** | ✅ **Sync indicator stuck on "Syncing 1 changes..." — orphaned 'syncing' ops in IndexedDB never recover** |
| ~~TASK-1215~~ | P0 | ✅ Persist full UI state across restarts (filters, view prefs, canvas toggles) via useStorage |
| ~~TASK-1246~~ | P2 | ✅ Multi-select filters for inbox (priority, project, duration) with checkboxes + persistence |
| ~~TASK-1247~~ | P2 | ✅ Add "Next 3 Days" filter to inbox (canvas icon bar + unified inbox dropdown) |
| ~~TASK-1248~~ | P1 | ✅ Design token audit & cleanup — all 7 phases complete, ~100+ violations fixed across 30 files |
| ~~TASK-1249~~ | P0 | ✅ Codebase Hygiene Audit — placeholders, hardcoded values, debug leftovers (33/33 sub-tasks done) |
| ~~TASK-1250~~ | P0 | ✅ Fix API key storage — removed plaintext localStorage (proxy handles keys server-side) |
| ~~TASK-1251~~ | P0 | ✅ Fix direct API calls bypassing proxy (AIChatPanel.vue) |
| ~~TASK-1252~~ | P0 | ✅ Remove/gate /keyboard-test debug route (ships without auth) |
| ~~TASK-1253~~ | P0 | ✅ Gate window.__flowstate_tauri_debug behind DEV |
| ~~TASK-1254~~ | P0 | ✅ Fix CORS wildcard on Edge Functions — restricted to allowed origins |
| ~~TASK-1255~~ | P0 | ✅ Fix WelcomeModal — removed dead buttons and stubbed stats |
| ~~TASK-1256~~ | P0 | ✅ Fix stale flowstate.app → in-theflow.com origins |
| ~~TASK-1257~~ | P0 | ✅ Fix productionLogger — now uses Supabase session token |
| ~~TASK-1258~~ | P1 | ✅ Replace httpbin.org with self-hosted endpoint |
| ~~TASK-1259~~ | P1 | ✅ Remove unconditional %c[DEBUG] styled canvas log |
| ~~TASK-1260~~ | P1 | ✅ Remove ~30 bug-specific debug tags across 10 files |
| ~~TASK-1261~~ | P1 | ✅ Fix silent no-op stubs — now throw or warn |
| ~~TASK-1262~~ | P1 | ✅ Re-enable CI lint & unit tests |
| ~~TASK-1263~~ | P1 | ✅ Add Open Graph + Twitter Card meta tags |
| ~~TASK-1264~~ | P1 | ✅ Update stale AI model references |
| ~~TASK-1265~~ | P1 | ✅ Fix AI proxy health check consuming real API tokens (OPTIONS request) |
| ~~TASK-1266~~ | P2 | ✅ CSS design token migration — ~305 values migrated in 20+ files, remaining violations still exist |
| ~~TASK-1267~~ | P2 | ✅ Standardize localStorage key prefixes |
| ~~TASK-1268~~ | P2 | ✅ Extract magic timeout numbers to named constants (src/config/timing.ts) |
| ~~TASK-1269~~ | P2 | ✅ Create centralized src/config/urls.ts |
| ~~TASK-1270~~ | P2 | ✅ Fix hardcoded i18n defaults (ui.ts, SignupForm.vue) |
| ~~TASK-1271~~ | P2 | ✅ Improve Cyberflow empty states (terse text) |
| ~~TASK-1272~~ | P2 | ✅ Mobile design token compliance |
| ~~TASK-1273~~ | P2 | ✅ Update PWA manifest description |
| ~~TASK-1274~~ | P2 | ✅ Migrate 'uncategorized' sentinel to constant |
| ~~TASK-1275~~ | P3 | ✅ Remove 5 obsolete verification scripts |
| ~~TASK-1276~~ | P3 | ✅ Remove Storybook PLACEHOLDER duplicate key |
| ~~TASK-1277~~ | P3 | ✅ Standardize z-index usage (~60 values in 50 files) |
| ~~TASK-1278~~ | P3 | ✅ Standardize font-size usage (~100 values in 32 files) |
| ~~TASK-1279~~ | P3 | ✅ Add missing package.json metadata fields |
| ~~TASK-1280~~ | P3 | ✅ Add copyright to Tauri bundle config |
| ~~TASK-1281~~ | P3 | ✅ Adopt build-time console.log stripping (esbuild pure config) |
| ~~TASK-1282~~ | P3 | ✅ Stop filtering console.error/warn in consoleFilter.ts |
| ~~FEATURE-1200~~ | P2 | ✅ Quick Add full RTL support + auto-expand for long tasks (✅ DONE 2026-02-27) |
| ~~FEATURE-1201~~ | P2 | ✅ Single-screen welcome modal — research-backed, auth-aware, replaces WelcomeModal |
| ~~FEATURE-1202~~ | P1 | ✅ Google Auth sign-in (OAuth) |
| ~~TASK-1283~~ | P1 | ✅ Google Calendar plugin — show events in Calendar view (depends on FEATURE-1202) |
| ~~**TASK-1284**~~ | **P0** | ✅ **Add quick task creation to KDE Plasma widget (monorepo)** |
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
| **FEATURE-1443** | **P0** | **Morning Dashboard — futuristic news headline page with playful task setting** |
| **TASK-1464** | **P1** | **Break Timer On-Screen Overlay — full-screen pomodoro overlay during break with countdown, minimize/stop/+5min controls, glass morphism** |
| ~~**TASK-1465**~~ | **P2** | ✅ ~~**AI Features Audit — review all AI features, decide what to keep vs ditch (broken/no value)**~~ |
| ~~**TASK-1466**~~ | **P2** | ✅ **Start task without resetting timer — allow switching active task while timer runs (web + pinned), add reset option to KDE widget** |
| **BUG-1462** | **P1** | **Notification spam — clicking any action (Start Work/Break/+5min) should dismiss ALL notification types** (👀 REVIEW) |
| ~~**TASK-1469**~~ | **P2** | ✅ **AI Chat anti-spam fix — fix ReAct loop spam, limit tool calls per turn, rewrite system prompt to be concise, add output truncation** |
| **TASK-1470** | **P2** | **Task Assist UX resurface — make AI Task Assist discoverable: inline suggestions, keyboard shortcut (Ctrl+/), visible button in task edit modal** |
| ~~**BUG-1467**~~ | **P2** | ~~**Tasks auto-appear on calendar at 9:00 AM when dragged to Board date columns — moveTaskToDate created calendar instances instead of only setting dueDate**~~ (✅ DONE 2026-03-07) |
| **TASK-1473** | **P0** | **KDE Widget: Add task search/filter — search box to find tasks without scrolling through long lists** |
| ~~**TASK-1475**~~ | **P1** | ~~**KDE Widget: Nanny popup show recent tasks — show commonly used tasks alongside pinned tasks, not only pinned**~~ (✅ DONE 2026-03-07) |
| **TASK-1476** | **P2** | **Catalog: drag tasks to collapsed project groups — allow dropping on closed categories, remove darkening overlay during drag** |
| ~~**TASK-1478**~~ | **P1** | ~~**KDE Widget: Unify dropdown & overlay styling — replace PlasmaComponents.ComboBox with QQC2 glass morphism popups for Sort/Filter; replace Kirigami.Icon with styled emoji in fullscreen overlay**~~ (✅ DONE 2026-03-07) |
| ~~**BUG-1481**~~ | **P2** | ~~**Calendar inbox hides canvas tasks with non-canvasOrder sorts — isInInbox gate too restrictive**~~ (✅ DONE 2026-03-07) |
| ~~**TASK-1480**~~ | **P2** | ~~**Remove beads dependency — MASTER_PLAN.md as single source of truth, delete .beads/, sync scripts, hooks, update docs**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1483**~~ | **P2** | ~~**PWA Today mode shows overdue tasks mixed with today's tasks without visual separation — add distinct Overdue section**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1492**~~ | **P2** | **✅ Canvas position drift when dragging multiple tasks consecutively — race between lock release, settling state, and realtime echoes** (✅ DONE 2026-03-13) |
| ~~**BUG-1493**~~ | **P2** | ~~**Catalog view: collapsed categories reset on navigation, expand/collapse buttons broken, cross-group drag regression**~~ (✅ DONE 2026-03-09) |
| ~~**TASK-1492**~~ | **P2** | ~~**Fix Due Date kanban view — flat layout (no per-project rows) + dateless tasks route to No Date column**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1503**~~ | **P2** | ~~**Tauri desktop: tasks not updating when adding/deleting on canvas or canvas inbox — WebKitGTK dataTransfer.getData() returns empty, needed dragData singleton fallback**~~ (✅ DONE 2026-03-12) |
| ~~**TASK-1507**~~ | **P2** | ~~**Quick Sort swipe UX polish — center approval notification with fun animation + add "nothing set" reminder popup on accidental swipe**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1518**~~ | **P2** | ✅ **Catalogue view: context menu can't dismiss by clicking away + category drag lag** (✅ DONE 2026-03-13) |
| ~~**BUG-1519**~~ | **P2** | ~~**Date picker calendar blurry — stacked backdrop-filter blur on context menu + submenu + NDatePicker panel**~~ (✅ DONE 2026-03-13) |
| **TASK-1520** | **P2** | **Add recurring indicator badge to task cards (Kanban, Canvas, Table views)** (✅ DONE 2026-03-14) |
| **~~TASK-1525~~** | **P1** | **Recurring task delete dialog — Skip/Stop/Cancel with global recurrence-aware delete** (✅ DONE 2026-03-14) |
| **TASK-1521** | **P1** | **Calendar day/week view drag deferred to mouseup — preview-then-commit pattern, adds undo support** (🔄 IN PROGRESS) |
| ~~**TASK-1522**~~ | **P2** | ~~**Blank screen on refresh — add loading animation to index.html**~~ (✅ DONE 2026-03-14) |
| **TASK-1523** | **P1** | **Undo/sync race fix — cancel stale sync queue ops when undo/redo restores task create/delete** (✅ DONE 2026-03-14) |
| **~~TASK-1524~~** | **P1** | **Migrate old `recurrence` field to new `recurrenceRule` format on app init** (✅ DONE) |
| **IDEA-1482** | **P3** | **Try CodeGraphContext for codebase graph analysis — Python tool that indexes code into a graph DB for relationship queries (callers/callees/call chains) across 130+ composables. Could help navigate complex canvas/ dependencies. Repo: github.com/CodeGraphContext/CodeGraphContext** |
| ~~**BUG-1526**~~ | **P1** | ~~**Push notification click actions dead — SW posts NAVIGATE_TO_TASK/NAVIGATE_TO/SNOOZE_NOTIFICATION but no client handler existed; added SW message listener in useAppInitialization.ts**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1527**~~ | **P2** | ~~**Remove entire gamification system (XP, achievements, challenges, shop, Cyberflow RPG) — ~23,700 lines removed, DB tables left dormant**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1531**~~ | **P2** | ~~**KDE dock: show current scheduled calendar block next to pomodoro timer — always-visible context of what's planned now, with toggle in KDE widget settings**~~ (✅ DONE) |
| **TASK-1532** | **P1** | **"Done for Now" vs "Done Fully" for recurring tasks — Hybrid clone model: "done for now" creates completion record + advances original to next occurrence; "done fully" stops recurrence (current behavior). DoneToggle click = done-for-now for recurring, context menu offers both options.** (🔄 IN PROGRESS) |
| **TASK-1533** | **P0** | **Epic: Workspace Collaboration — multi-user workspace layer for FlowState (26 sub-tasks across 4 phases)** (📋 PLANNED) |
| **TASK-1534** | **P0** | **DB migration: Create workspace tables (workspaces, workspace_members, workspace_invites, task_comments, workspace_activity)** (📋 PLANNED) |
| **TASK-1535** | **P0** | **DB migration: Add workspace_id to tasks, projects, groups + assigned_to on tasks** (📋 PLANNED) |
| **TASK-1536** | **P0** | **DB migration: SECURITY DEFINER function user_workspace_ids() for RLS performance** (📋 PLANNED) |
| **TASK-1537** | **P0** | **DB migration: Rewrite 32+ RLS policies to be workspace-aware** (📋 PLANNED) |
| **TASK-1538** | **P0** | **DB migration: Add new tables to supabase_realtime publication** (📋 PLANNED) |
| **TASK-1539** | **P1** | **Pinia store: workspaces.ts — activeWorkspaceId, CRUD, switchWorkspace** (📋 PLANNED) |
| **TASK-1540** | **P1** | **Update supabaseMappers.ts with workspace_id** (📋 PLANNED) |
| **TASK-1541** | **P1** | **Update useTaskFiltering.ts with workspace filter** (📋 PLANNED) |
| **TASK-1542** | **P1** | **Update taskPersistence.ts + useTasksDatabase.ts for workspace context** (📋 PLANNED) |
| **TASK-1543** | **P1** | **Update projects.ts store for workspace filtering** (📋 PLANNED) |
| **TASK-1544** | **P1** | **Update canvas store (groups) for workspace filtering** (📋 PLANNED) |
| **TASK-1545** | **P1** | **UI: Workspace switcher component in sidebar** (📋 PLANNED) |
| **TASK-1546** | **P1** | **Update auth.ts: fetch workspaces on login** (📋 PLANNED) |
| **TASK-1547** | **P0** | **Offline sync queue: inject workspace_id into queued payloads** (📋 PLANNED) |
| **TASK-1548** | **P0** | **Realtime subscriptions: workspace_id filtering + workspace switch handling** (📋 PLANNED) |
| **TASK-1549** | **P0** | **Cross-tab sync: add workspaceId to protocol** (📋 PLANNED) |
| **TASK-1550** | **P1** | **Guest mode isolation for workspace feature** (📋 PLANNED) |
| **TASK-1551** | **P1** | **Invite flow: generate link, accept via Edge Function, /#/invite/:token route** (📋 PLANNED) |
| **TASK-1552** | **P1** | **Task assignment UI: assigned_to dropdown, avatar badges, filters** (📋 PLANNED) |
| **TASK-1553** | **P1** | **Task comments: CRUD + realtime + UI** (📋 PLANNED) |
| **TASK-1554** | **P2** | **Activity feed: logging + display** (📋 PLANNED) |
| **TASK-1555** | **P1** | **Partner-friendly UX: hide complexity for single-workspace users** (📋 PLANNED) |
| **TASK-1556** | **P1** | **Hebrew translations for all workspace strings** (📋 PLANNED) |
| **TASK-1557** | **P2** | **Member management UI** (📋 PLANNED) |
| **TASK-1558** | **P2** | **Empty states for workspaces** (📋 PLANNED) |
| **TASK-1559** | **P3** | **Member presence (v2 nice-to-have)** (📋 PLANNED) |

---

## Workspace Collaboration (TASK-1533 Epic)

> **Goal**: Add multi-user workspace collaboration to FlowState. Personal workspace stays as-is (workspace_id IS NULL). Shared workspaces allow 2+ members to share tasks, projects, and canvas.
> **Priority**: P0 | **Status**: 📋 PLANNED
> **Brief**: User-provided implementation brief covers DB schema, RLS, stores, UI, and phased rollout.
> **Architect Assessment**: Feasibility confirmed with 5 HIGH-risk areas identified (RLS migration, offline sync queue, realtime subscriptions, cross-tab sync, invite chicken-and-egg).

### Phase 1: Foundation

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| **TASK-1533** | **P0** | **Epic: Workspace Collaboration — tracking parent for all sub-tasks** | 📋 PLANNED | — |
| **TASK-1534** | **P0** | **DB migration: Create workspaces, workspace_members, workspace_invites, task_comments, workspace_activity tables** | 📋 PLANNED | — |
| **TASK-1535** | **P0** | **DB migration: Add workspace_id (NULLABLE) to tasks, projects, groups tables + assigned_to on tasks** | 📋 PLANNED | TASK-1534 |
| **TASK-1536** | **P0** | **DB migration: Create `user_workspace_ids()` SECURITY DEFINER function for RLS performance** | 📋 PLANNED | TASK-1534 |
| **TASK-1537** | **P0** | **DB migration: Rewrite ALL RLS policies to be workspace-aware (32+ policies across 8+ tables). Must handle workspace_id IS NULL for personal tasks. TEST AGAINST PRODUCTION DATA COPY.** | 📋 PLANNED | TASK-1535, TASK-1536 |
| **TASK-1538** | **P0** | **DB migration: Add workspace_id to supabase_realtime publication for task_comments and workspace_activity** | 📋 PLANNED | TASK-1534 |
| **TASK-1539** | **P1** | **Pinia store: Create src/stores/workspaces.ts — activeWorkspaceId, workspaces[], members[], switchWorkspace(), createWorkspace(), inviteMember(), acceptInvite(), removeMember()** | 📋 PLANNED | TASK-1537 |
| **TASK-1540** | **P1** | **Update supabaseMappers.ts: Add workspace_id to toSupabaseTask(), toSupabaseProject(), toSupabaseGroup() mappers** | 📋 PLANNED | TASK-1535 |
| **TASK-1541** | **P1** | **Update useTaskFiltering.ts: Add workspace_id filter predicate so board/canvas/calendar/inbox respect active workspace** | 📋 PLANNED | TASK-1539, TASK-1540 |
| **TASK-1542** | **P1** | **Update taskPersistence.ts + useTasksDatabase.ts: Pass workspace context to fetchTasks, add .eq('workspace_id', ...) filter** | 📋 PLANNED | TASK-1539, TASK-1540 |
| **TASK-1543** | **P1** | **Update projects.ts store: Filter projects by activeWorkspaceId, same pattern as tasks** | 📋 PLANNED | TASK-1539, TASK-1540 |
| **TASK-1544** | **P1** | **Update canvas store (groups): Filter groups by activeWorkspaceId, validate workspace match on parentId assignment** | 📋 PLANNED | TASK-1539, TASK-1540 |
| **TASK-1545** | **P1** | **UI: Workspace switcher component in sidebar — dropdown with "Personal" + shared workspaces + "Create Workspace" action** | 📋 PLANNED | TASK-1539 |
| **TASK-1546** | **P1** | **Update auth.ts: On login, fetch workspaces via workspace_members join, restore last-used workspace from localStorage** | 📋 PLANNED | TASK-1539 |

### Phase 2: Sync Safety (CRITICAL — must be done before enabling workspaces)

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| **TASK-1547** | **P0** | **Offline sync queue: Inject workspace_id into queued payloads in useSyncOrchestrator.ts. Defense-in-depth for ops created before migration (existing IndexedDB queue entries lack workspace_id)** | 📋 PLANNED | TASK-1540 |
| **TASK-1548** | **P0** | **Realtime subscriptions: Update useRealtimeSubscription.ts to filter by workspace_id instead of user_id. Handle workspace switch (teardown old channel, create new). Add isWorkspaceSwitching flag to prevent reconnect logic from fighting intentional disconnects.** | 📋 PLANNED | TASK-1538, TASK-1539 |
| **TASK-1549** | **P0** | **Cross-tab sync: Add workspaceId to CrossTabMessage and TaskOperation interfaces in useCrossTabSync.ts. Handler must ignore messages from different workspace. Broadcast workspace switch events.** | 📋 PLANNED | TASK-1539 |
| **TASK-1550** | **P1** | **Guest mode isolation: Ensure workspace store returns empty/disabled state when !isAuthenticated. Verify migrateGuestData() targets personal workspace (NULL workspace_id) only.** | 📋 PLANNED | TASK-1539 |

### Phase 3: Collaboration Features

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| **TASK-1551** | **P1** | **Invite flow: Generate invite link (workspace_invites table), copy/share UI, route /#/invite/:token, accept-invite Edge Function (SECURITY DEFINER — must add user to workspace_members server-side, chicken-and-egg problem)** | 📋 PLANNED | TASK-1539 |
| **TASK-1552** | **P1** | **Task assignment: Add assigned_to dropdown in task detail showing workspace members, avatar badge on Board/Kanban cards, "My tasks" / "All" / "Unassigned" filter** | 📋 PLANNED | TASK-1539, TASK-1551 |
| **TASK-1553** | **P1** | **Task comments: CRUD for task_comments, real-time via Supabase Realtime, comment thread UI in task detail panel** | 📋 PLANNED | TASK-1548 |
| **TASK-1554** | **P2** | **Activity feed: Log writes to workspace_activity (task_created, task_completed, comment_added, member_joined), sidebar panel or view with feed UI** | 📋 PLANNED | TASK-1539 |

### Phase 4: Partner UX & Polish

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| **TASK-1555** | **P1** | **Partner-friendly UX: Hide workspace switcher when user has exactly 1 workspace. Invite-only onboarding path (sign up → land directly in shared workspace). Auto-assign tasks to default workspace for single-workspace users.** | 📋 PLANNED | TASK-1545, TASK-1551 |
| **TASK-1556** | **P1** | **Hebrew translations: Add workspaces namespace to he.json — workspace, members, invite, comments, activity feed, all new UI strings** | 📋 PLANNED | TASK-1545 |
| **TASK-1557** | **P2** | **Member management UI: Remove member, transfer ownership, role display (owner/admin/member)** | 📋 PLANNED | TASK-1539 |
| **TASK-1558** | **P2** | **Empty states: New workspace welcome, no tasks yet, no members yet, pending invite states** | 📋 PLANNED | TASK-1545 |
| **TASK-1559** | **P3** | **Member presence: Show who's online in workspace using Supabase Realtime Presence (nice-to-have v2)** | 📋 PLANNED | TASK-1548 |

### Key Architecture Decisions

1. **workspace_id IS NULLABLE** — NULL means "personal workspace". No data migration needed for existing tasks.
2. **SECURITY DEFINER function** `user_workspace_ids()` for RLS performance — caches per-transaction, avoids correlated subquery per row.
3. **Invite acceptance via Edge Function** — accepting user can't INSERT into workspace_members (not yet a member → RLS blocks). Server-side function required.
4. **Realtime per-workspace** — subscribe to active workspace only, teardown/rebuild on switch. No multi-workspace listening.
5. **Sync queue defense-in-depth** — inject workspace_id into payloads at queue processing time for legacy operations that predate the migration.
6. **Timer, gamification, AI chat remain personal** — not workspace-scoped.

### Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS policy rewrite (32+ policies) — wrong policy = data leakage or lockout | CRITICAL | Test against production data copy. Deploy schema-only first, let sync queue drain. |
| Offline sync queue — existing IndexedDB ops lack workspace_id | HIGH | workspace_id NULLABLE + inject at processing time |
| Realtime filter change — breaking for existing subscriptions | HIGH | Workspace switch tears down old channel cleanly |
| Cross-tab workspace mismatch — Tab A workspace A, Tab B workspace B | MEDIUM | Add workspaceId to cross-tab protocol, ignore mismatches |
| Invite chicken-and-egg — user can't join workspace they're not in | MEDIUM | Edge Function with service_role key |
| Canvas parentId cross-workspace — task in workspace B references group in workspace A | LOW | App-level validation in drag handlers |

---

## System Review 2026-01-31 Findings

> **Source**: Comprehensive system review with 4 parallel agents (Security, Code Quality, Architecture, Health Check)
> **Validated**: npm test (587 passed), npm audit (16 vulnerabilities), npm outdated, npm run lint (349 errors)
> **Total Issues**: 48 (P0: 2, P1: 14, P2: 19, P3: 13)

---

### ~~BUG-1136~~: Add Entity Ownership Check to Tombstone RLS (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-04)

**Problem**: Tombstone soft-delete RLS policy was missing UPDATE policy — upsert with onConflict silently failed for authenticated users.

**Solution**: Added UPDATE RLS policy with `auth.uid() = user_id` check. Migration: `20260304000000_tombstone_rls_update_policy.sql`. Applied to local + production.

**Files**: `supabase/migrations/20260304000000_tombstone_rls_update_policy.sql`

---

### ~~BUG-1137~~: Add Guest Session ID for Migration (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-07)

**Problem**: When guest user signs up, their guest data may leak or not migrate properly.

**Solution**: Generate and store unique guest session ID, use it to migrate guest data on sign-up.

**Files**: `src/stores/auth.ts:361`

---

### ~~BUG-1141~~: Add CSP Headers to Limit XSS Impact (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-04)

**Problem**: No Content Security Policy headers configured on production web app.

**Solution**: Added enforcing CSP header to VPS Caddyfile. Policy: `default-src 'self'`, SHA-256 hash for FOUC inline script, `'unsafe-inline'` for Vue scoped styles, explicit allowlist for Google Fonts, Dicebear avatars, Supabase API/WebSocket. Tauri CSP was already configured. `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` for XSS mitigation.

**Files**: `/etc/caddy/Caddyfile` (VPS), `src-tauri/tauri.conf.json` (already had CSP)

---

### ~~BUG-1142~~: Add Rate Limiting to API Calls (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-04)

**Problem**: No rate limiting on API endpoints, vulnerable to abuse. Edge functions (whisper-transcribe, url-scraper-proxy) had no auth check.

**Solution**: (1) Enabled Kong `rate-limiting` plugin on VPS: auth 20/min, REST 300/min. (2) Added `validateSupabaseAuth()` to `whisper-transcribe` and `url-scraper-proxy` edge functions. (3) Added auth token headers to client-side callers (urlScraper.ts, useWhisperSpeech.ts, useMobileInboxLogic.ts).

**Files**: `docker/self-host/volumes/api/kong.yml`, `supabase/functions/whisper-transcribe/index.ts`, `supabase/functions/url-scraper-proxy/index.ts`, `src/services/ai/urlScraper.ts`, `src/composables/useWhisperSpeech.ts`, `src/mobile/composables/useMobileInboxLogic.ts`

---

### ~~BUG-1143~~: Add onUnmounted Cleanup to MobileQuickSortView (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: Memory leak - MobileQuickSortView creates setTimeout timers but never cleans them up on unmount.

**Root Cause**: `handleSave()` and `handleMarkDone()` both create `setTimeout` for celebration overlay (600ms) without tracking or clearing on unmount. If component unmounts before timeout fires, stale refs are set.

**Fix**:
1. Added `celebrationTimers` array to track all setTimeout IDs
2. Updated `handleSave()` and `handleMarkDone()` to push timer IDs to tracking array
3. Added `onUnmounted()` hook to clear all pending timers

**Note**: `useSwipeGestures` and `useQuickSort` composables already have their own `onUnmounted` cleanup — no additional cleanup needed for those.

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### ~~BUG-1406~~: Mobile Quick Sort — Bottom Controls Cut Off + Missing Project Assignment (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: On mobile Quick Sort view, the bottom thumb zone (action buttons: Done/Save/Assign/Delete) is clipped by the bottom navigation bar. The date pill row is also truncated (only Today/Tmrw/+3d visible, missing Wknd/+1wk/+1mo). No visible way to assign projects from the sort phase.

**Root Cause**: The `MobileQuickSortFilters.vue` thumb zone padding-bottom didn't account for the 64px mobile bottom nav bar. The sort phase had `overflow: hidden` preventing scroll to bottom controls.

**Fix**:
1. ✅ Added `var(--space-16)` (64px nav) + `var(--space-6)` + `env(safe-area-inset-bottom)` to thumb zone padding-bottom
2. ✅ Changed sort phase from `overflow: hidden` to `overflow-y: auto` so all controls are reachable
3. ✅ Verified Assign button visible and wired to project sheet via `openProjectSheet`
4. ✅ Fixed thumb zone gradient (`linear-gradient` → `transparent`)
5. ✅ Fixed AI "Apply All" to set values locally without persisting — user reviews then hits Save

---

### ~~TASK-1144~~: Split MobileQuickSortView.vue (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: File is 2518 lines, exceeding 500-line limit. Hard to maintain and test.

**Solution**: Extract into composables and sub-components:
- `useMobileQuickSortLogic.ts` - business logic
- `MobileQuickSortCard.vue` - card component
- `MobileQuickSortFilters.vue` - filter UI

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### ~~TASK-1145~~: Split MobileInboxView.vue (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: File is 1919 lines, exceeding 500-line limit.

**Solution**: Extract into composables and sub-components.

**Files**: `src/mobile/views/MobileInboxView.vue`

---

### ~~TASK-1146~~: Split useSupabaseDatabase.ts by Domain (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-22)

**Problem**: File was 1736 lines with mixed concerns.

**Solution**: Split into 10 domain composables under `src/composables/supabase/` + shared infrastructure. Original file is now a 3-line re-export.

**Files**: `src/composables/supabase/` (13 files)

---

### ~~TASK-1147~~: Replace 199 `any` Types with Proper Interfaces (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-27)

**Problem**: 199 instances of `any` type across 90 files weaken type safety.

**Solution**: Audited and replaced all remaining `any` types with proper TypeScript interfaces. Key changes:
- Added `isVirtual?: boolean` to `CalendarEvent` interface, eliminating 31 `as any` casts across 3 calendar views
- Replaced markdown-it `any` params with `Token`, `Renderer`, `MarkdownIt.Options` types in ChatMessage.vue
- Added `TaskListItem`, `CalendarHelpers`, `WeekDay` type definitions to replace unsafe casts
- Changed `Record<*, any>` icon maps to `Record<*, Component>` in gamification/mobile files
- Fixed `ComputedRef<any[]>` in undoSingleton.ts with proper `UseRefHistoryRecord` type
- Fixed `Ref<any[]>` in useCanvasInteractions.ts with proper `Node[]` type

**Files**: src/types/tasks.ts, src/components/ai/ChatMessage.vue, src/components/calendar/Calendar{Day,Month,Week}View.vue, src/composables/undoSingleton.ts, src/composables/canvas/useCanvasInteractions.ts, src/components/gamification/cyber/CyberShop.vue, src/components/gamification/cyber/CyberAchievements.vue, src/components/gamification/ShopModal.vue, src/mobile/components/MobileInboxFilters.vue

---

### ~~TASK-1149~~: Split timer.ts into 4 Services (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: Timer store was 1328 lines with mixed concerns.

**Solution**: Split into focused services:
- `src/stores/timer.ts` — slim orchestrator (456 lines)
- `src/composables/timer/useTimerSync.ts` — intervals, leadership, DB, Realtime (763 lines)
- `src/composables/timer/useTimerNotifications.ts` — browser/SW notifications (163 lines)
- `src/composables/timer/useTimerAudio.ts` — sound playback (86 lines)

Public API unchanged — zero consumer migration needed.

**Files**: `src/stores/timer.ts`

---

### ~~TASK-1152~~: Fix 40 eslint-disable/@ts-ignore Suppressions (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: 40 eslint-disable and @ts-ignore comments indicate tech debt.

**Solution**: Audit each suppression and fix underlying issues.

**Files**: 17 files with suppressions

---

### ~~TASK-1154~~: Standardize Error Handling Pattern (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: Inconsistent error handling - some functions throw, others return null.

**Solution**: Standardized DB layer: write ops re-throw after `handleError()`, read ops return empty/null. Fixed 4 files: `permanentlyDeleteGroup/Project` now re-throw, `fetchUserSettings` uses structured `handleError`, AI sync fire-and-forget calls now have `.catch()` handlers.

**Files**: `src/composables/supabase/useGroupsDatabase.ts`, `useProjectsDatabase.ts`, `useSettingsDatabase.ts`, `src/composables/useAISync.ts`

---

### ~~TASK-1155~~: Split AppSidebar.vue (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-04)

**Problem**: File was 1974 lines, exceeding 500-line limit.

**Solution**: Extracted 6 sub-components + 1 composable. AppSidebar.vue reduced to 104-line shell.

**Files**: `src/layouts/AppSidebar.vue`, `src/components/sidebar/` (6 files), `src/composables/app/useQuickTaskInput.ts`

---

### ~~TASK-1156~~: Split useBackupSystem.ts (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: File was 1412 lines, exceeding 500-line limit.

**Solution**: Split into 8 modular sub-composables under `src/composables/backup/` using Context + Factory pattern. Old import path preserved as re-export barrel. 22/22 tests pass.

**Files**: `src/composables/backup/` (8 files), `src/composables/useBackupSystem.ts` (barrel)

---

### ~~TASK-1157~~: Extract Magic Numbers to Named Constants (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-13)

**Problem**: Magic numbers scattered throughout code.

**Solution**: Create `src/constants/` directory with named constants.

**Files**: Multiple files

**Resolution**: Extracted ~40 magic numbers across 17 files into named constants. Created `src/constants/calendar.ts` (slot height, snap minutes), `src/constants/breakpoints.ts` (mobile breakpoint). Extended `src/config/timing.ts` (flash, toast, startup delays) and `src/constants/canvas.ts` (navigation animation). Fixed stale raw `30000` in timer.ts. Zero logic changes.

---

### ~~TASK-1160~~: Add Virtualized Task Lists (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: Rendering 500+ tasks causes performance issues.

**Solution**: Implement `@tanstack/vue-virtual` for Board and Calendar views.

**Files**: Board view, Calendar view components

---

### TASK-1161: Create Shared Domain Layer for Mobile (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS

**Problem**: Mobile views duplicate logic from desktop views.

**Solution**: Create `src/domain/` with shared composables.

**Files**: `src/domain/` (new), mobile views

---

### ~~FEATURE-1162~~: Smart Filters / Saved Views (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Feature**: Allow users to save filter combinations as named views.

**Implementation**:
1. ~~Create `saved_filters` Supabase table~~ → Stored in settings JSONB (syncs via existing pipeline)
2. ✅ SavedViewsDropdown component with glass-morphism design
3. ✅ Quick access bookmark dropdown in FilterControls + InboxFilters
4. ✅ Composable `useSavedViews.ts` for capture/apply/save/delete
5. ✅ Persists via localStorage + Tauri Store + Supabase user_settings

**Files**: `src/types/savedViews.ts`, `src/composables/useSavedViews.ts`, `src/components/filters/SavedViewsDropdown.vue`, `src/stores/settings.ts`, `src/components/base/FilterControls.vue`, `src/components/canvas/InboxFilters.vue`

---

### FEATURE-1164: Habit Tracking Mode (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: Extend recurring tasks to support habit tracking with streaks and statistics.

**Files**: Task types, new views

---

### FEATURE-1166: Create Public API (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: REST API for external integrations (Zapier, IFTTT, custom scripts).

**Files**: New Edge Functions, API documentation

---

### ~~TASK-1169~~: Add Unit Tests for Database Layer (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: No dedicated tests for database composable.

**Solution**: Add tests with mocked Supabase client.

**Files**: `tests/unit/composables/useSupabaseDatabase.spec.ts`

---

### TASK-1171: Add Mobile View E2E Tests (👀 REVIEW)

**Priority**: P2-MEDIUM | **Status**: 👀 REVIEW (partial coverage — 1 basic file, needs assessment)

**Problem**: Mobile views have E2E test coverage gaps.

**Solution**: Add Playwright tests for mobile viewport.

**Files**: `tests/e2e/mobile/`

---

### ~~TASK-1172~~: Update VueUse 10.11 → 14.1 (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE

**Problem**: VueUse is 4 major versions behind.

**Prerequisites**: Requires Vue 3.5+ upgrade first.

**Files**: `package.json`

**Resolution**: Already upgraded to @vueuse/core@14.2.1 with Vue 3.5.26. No action needed.

---

### ~~TASK-1175~~: Fix 349 Linter Errors (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-14)

**Problem**: 349 ESLint errors and 292 warnings.

**Solution**: Run `npm run lint --fix` and manually fix remaining issues.

**Files**: Multiple files

**Resolution**: Reduced from 349 errors to 12 (all intentionally skipped). Fixed: unused vars/imports (29), extra semicolons, useless v-binds, boolean shorthand, define-macros-order, max-attributes-per-line. Remaining 12: 11 `vue/custom-event-name-casing` (kebab-case events can't be renamed without breaking parents) + 1 `no-unsafe-finally` (logic issue, not lint fix).

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
| ~~BUG-1113~~ | P0 | ✅ Stale worktrees not cleaned up - forces Claude Code context bloat |
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
- [ ] **TASK-1242**: Corruption-influenced AI personality — glitchy tone at high corruption levels (moved from Phase 4)

**Blocking**: BUG-1204 - Apply migration to database (table returns 404)

---

### TASK-1317: Cyberflow RPG — Full Cyberpunk Game UI Overhaul (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (2026-02-07)

**Parent**: FEATURE-1118

**Goal**: Complete cyberpunk visual overhaul of the gamification system with dedicated Cyberflow command center, Anti-Chore game design, and system interconnections.

**Phase 1: Visual Foundation** ✅
- Installed augmented-ui, added cyberpunk fonts (Rajdhani, Orbitron, Space Mono)
- Created `src/assets/cyberflow-tokens.css` (neon palette, glow effects, clip-paths, animations)
- Created `src/composables/useCyberflowTheme.ts` (intensity-aware theme composable)

**Phase 2: Cyberflow Hub Page** ✅
- New `/cyberflow` route with 5-tab navigation (Overview/Missions/Boss/Upgrades/Trophies)
- Created 12 new cyber components (CyberDashboardHub, CyberMissionBriefing, CyberBossFight, CyberCharacterProfile, CyberSkillTree, CyberAchievements, CyberShop, etc.)
- Hub-and-spoke layout: Overview cards → drill into tabs

**Phase 3: Header Widget Redesign + Intensity Levels** ✅
- Restyled LevelBadge, XpBar, StreakCounter with cyberpunk aesthetics
- Intensity filtering wired up (minimal/moderate/intense)
- Exposure toast system (shielded/exposed) with proper icon rendering

**Phase P0: Anti-Chore Game Mechanics** ✅
- Created `docs/game-mechanics.md` — authoritative game design reference
- Removed exposed penalty (timer = invitation, not obligation)
- Removed XP decay (earned XP permanent forever)
- Updated SHIELDED_XP_BONUS from 1.10 to 1.15
- Suppressed nagging "EXPOSED" toast per Distraction Test

**Progress (2026-02-08):** Phases 1-3 complete + P0 anti-chore constants applied. 624 tests passing, zero TS errors. Next: P1 items (streak multiplier, corruption XP modifier, partial boss credit).

**Phase 4: RPG HUD Header Redesign** (TASK-1305, 🔄 IN PROGRESS)
- Created `GamificationHUD.vue` — single RPG-styled component replacing inline header widgets
- 4 visual states: unauth CTA ("CONNECT TO THE GRID"), minimal (text only), moderate (full bar), intense (glow + shine + narrative)
- Uses cyberflow design tokens: corner-cut-sm clip-path, cf-dark-3 bg, cf-cyan border/glow, Space Mono typography
- Backdrop blur via `::before` pseudo-element (clip-path + backdrop-filter incompatibility fix)
- Refactored AppHeader.vue: removed ~80 lines of inline widgets, replaced with `<GamificationHUD />`
- Added challenge pick animation to DailyChallengesPanel (glow + collapse + auto-navigate)
- Fixed kill-flow-state.sh hanging on zombie PIDs (added timeout to pwdx)
- Fixed missing verify-auth script reference in package.json dev script

**Progress (2026-02-12):** Phase 4 HUD implemented. Challenge pick animations working. User testing in progress — multiplier and penalty visualization discussed but not yet implemented.

---

### ~~BUG-1302~~: Time Block Notifications Still Not Firing (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: Despite BUG-1296 fix (`_rawTasks` → `rawTasks`), time block notifications are still not firing. User has a 120-min calendar block scheduled and received no milestone alerts (halfway, 1-min-before, ended).

**Root Causes Found** (multi-agent investigation):
1. **Late tolerance too tight** (2 min) — desktop apps sleep/background, `setInterval` skips ticks, milestones silently missed
2. **Singleton guard fragile** — module-level `isInitialized` survives but interval could die, `start()` refuses to restart
3. **Silent notification delivery** — `deliverNotification()` had no error handling, no logging, failed invisibly
4. **Missing permission request** — Timer store requests Notification permission at init, but time blocks didn't
5. **Instance data not in sync queue** — `createTaskInstance` was fire-and-forget, instances not backed up by sync queue
6. **Toast too short** — 5s duration easy to miss

**Fixes Applied** (4 files):
1. `useTimeBlockNotifications.ts` — Late tolerance 2min→10min, resilient singleton (restarts if interval died), delivery logging, toast duration 5s→8s, skip completed/soft-deleted tasks
2. `notificationDelivery.ts` — Added try-catch, logging on permission denied/API unavailable/delivery success, returns boolean
3. `useAppInitialization.ts` — Explicit `Notification.requestPermission()` before starting time block polling
4. `taskOperations.ts` — Added `instances` to sync queue payload for offline backup

**Files**:
- `src/composables/useTimeBlockNotifications.ts` — Core composable (polling, milestone detection, delivery)
- `src/utils/notificationDelivery.ts` — Browser Notification API wrapper
- `src/composables/app/useAppInitialization.ts` — Where composable is mounted
- `src/stores/tasks/taskOperations.ts` — Sync queue payload for instance persistence

---

### ~~BUG-1307~~: Week View Events Render as Thin Slivers on Thu-Sun Columns (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: In the calendar week view, events on Monday and Tuesday render correctly with proper width, title, time, and duration. However, events on Thursday through Sunday appear as nearly invisible thin vertical lines/slivers instead of proper event blocks.

**Root Cause**: CSS `.week-event { left: var(--space-1); right: var(--space-1); }` overrode the JS-computed percentage-based `left`/`width` from `getWeekEventStyle()`. The fixed CSS values clamped all events to the same position regardless of day column.

**Fix Applied**:
- [x] Removed CSS `left`/`right` overrides from `.week-event` in `CalendarWeekView.vue`
- [x] Added 2px inset padding via `calc()` in `getWeekEventStyle()` for column gap

**Files Changed**:
- `src/components/calendar/CalendarWeekView.vue` — Removed conflicting CSS left/right
- `src/composables/calendar/useCalendarWeekView.ts` — `calc()` padding in left/width

---

### ~~BUG-1308~~: Month View Shows Only 2 Columns Instead of 7 (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: The calendar month view grid was missing day-of-week header row (MON-SUN).

**Root Cause**: Template had no weekday header component. CSS grid was correct (`repeat(7, 1fr)`) and 42 cells were generated correctly, but without header labels the layout appeared broken.

**Fix Applied**:
- [x] Added `month-weekday-header` row with Mon-Sun labels above the grid
- [x] Added CSS for header grid matching 7-column layout

**Files Changed**:
- `src/components/calendar/CalendarMonthView.vue` — Added weekday header row + CSS

---

### FEATURE-1118: Gamification System - Design & Implementation (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (2026-01-30)

**Goal**: Add game-like elements to FlowState to increase engagement and make productivity feel rewarding.

**Design**: See `docs/game-mechanics.md` for full game design document (Anti-Chore Manifesto, system interconnections, ARIA personality, progression curve).

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

### ~~TASK-1440~~: Gamification Offline Resilience (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-03)

**Problem**: Gamification store writes directly to Supabase. When offline, XP awards, streak updates, stat increments, achievement unlocks, and purchases silently fail — causing data loss for gamification state.

**Strategy**: Local-first state updates — update Pinia state BEFORE Supabase writes. Wrap all Supabase writes in try/catch with `console.warn`. On failure, local state stays updated; server reconciles on next load.

**Changes** (`src/stores/gamification.ts`):
- `awardXp`: Local XP/level update first, notifications fire immediately, Supabase write in try/catch, reconcile from server on success
- `recordDailyActivity`: Local streak update first (streak loss is critical UX), Supabase write in try/catch + warn on failure; streak freeze deduction also local-first via fire-and-forget
- `incrementStat`: Local stat update first, Supabase write in try/catch
- `unlockAchievement`: Local achievement unlock first + toast shows immediately, Supabase upsert in try/catch
- `purchaseItem`: Local XP deduction + item ownership first, all Supabase writes in try/catch with warn (purchase still succeeds locally)

**Marker**: All wrapped calls tagged with `[OFFLINE-SAFE]` comment for traceability.

**Files**: `src/stores/gamification.ts`

---

### TASK-1462: Dev-Maestro TUI — Multi-Project Support (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: `maestro tui` currently only works with FlowState. Running from another project directory shows 0 tasks.

**Goal**: Make `maestro tui` work with any project that has a `MASTER_PLAN.md` by parsing it directly.

**Approach**:
1. Verify `~/.bashrc` alias (`~/.local/bin/maestro` wrapper) propagates `MAESTRO_CWD` after PC restart
2. Parse tasks directly from MASTER_PLAN.md headers (`### TASK-XXX: Title (STATUS)`)
3. Map MASTER_PLAN.md statuses to TUI columns (PLANNED→backlog, IN PROGRESS→wip, REVIEW→review, DONE→done)
4. ~~Remove dead beads code from dev-maestro server.js and kanban/index.html~~ (done via TASK-1480)

**Files**: `~/.dev-maestro/tui/src/lib/bd-client.js`, `~/.dev-maestro/tui/src/lib/masterplan-parser.js`, `~/.dev-maestro/tui/src/hooks/use-board-data.js`

---

### ~~TASK-1463~~: Clean Up Project Root — Remove/Consolidate Temp Files (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-07)

**Problem**: Project root has 141 debug PNG screenshots, tracked temp reports/scripts, stale lockfiles, and other clutter that doesn't belong at the root level.

**Cleanup plan**:
1. Delete 141 debug PNG screenshots from root (all untracked)
2. Remove tracked temp files: `full_report.txt`, `lint_report.txt`, `ts_errors.txt`, `unused_vars_report.txt`, `console-task-1348.txt`, `current-state.md`, `snapshot-*.md`, `bulk_replace*.js`, `components_lint_report.json`, `lint_report.json`, `lint_output.log`, `test_output.log`, `typecheck_output.txt`, `any_files.txt`
3. Remove stale `pnpm-lock.yaml` (project uses npm), `.cursorrules`
4. Remove `stats.html` (2.9MB build artifact)
5. Add `*.png` and temp patterns to `.gitignore` to prevent recurrence

---

### ~~TASK-1465~~: AI Features Audit — Review and Clean Up All AI Features (✅ DONE)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: Multiple AI features exist across the app in various states — some broken, some unused, some duplicated. No clear picture of what's working, what's valuable, and what should be removed.

**Scope**: Review all AI features and decide what to keep vs ditch.

**Findings**:
- Weekly Plan AI: LLM distribution replaced with deterministic algorithm (TASK-1405). LLM used only for week theme (Step 3) — keep.
- ARIA Game Master: Challenge generation broken. Template fallback preserved. AI rebuild removed from scope.
- AI Chat (Groq/Ollama): Working but ReAct loop dumps walls of tool result data (→ TASK-1469).
- Task Assist: Working but hidden in context menu — users never find it (→ TASK-1470).
- AI Memory Health Dashboard: Low value, internal tooling only — evaluate for removal.
- AI Quality Dashboard: Low value, internal tooling only — evaluate for removal.

**Outcome**: Spawned 2 follow-up tasks (TASK-1469, TASK-1470). Deleted broken/no-value AI files. Simplified AIHubView to surface only working features.

---

### ~~TASK-1469~~: AI Chat Anti-Spam Fix (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-14)

**Problem**: AI Chat ReAct loop dumps walls of raw tool result data into the conversation instead of answering questions concisely. Users see JSON blobs, long lists, and repeated tool calls before getting an answer.

**Fix**:
1. Limit tool calls per turn (max 3-5 before forcing a synthesis step)
2. Rewrite system prompt to emphasize concise, conversational responses — tool results are context, not output
3. Add output truncation for tool results shown in UI (collapse long results with "show more")
4. Review ReAct loop termination conditions — ensure it stops when answer is found, not when tool quota is exhausted

**Category**: AI / Chat

**Resolution**: Hidden step indicators from message content (metadata only), reduced MAX_REACT_STEPS 5→3, added forceful synthesis instruction after tool results, added 4 conciseness rules to system prompt, added step-indicator cleanup regex to cleanResponse(), capped digest length (fallback 1500→800, all paths 2000 max).

---

### TASK-1500: Supabase Chat Persistence + Usage Log Sync (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-10)

**Problem**: AI chat conversations and usage log entries were stored in localStorage only, meaning no cross-device sync.

**Fix**:
- Created `src/services/ai/chatPersistence.ts` — Supabase CRUD (load/save/delete) for `ai_conversations` table. Uses existing `supabase` client from `@/services/auth/supabase`. Silently fails on error.
- Created `src/services/ai/usageSync.ts` — 60s interval flush of accumulated usage entries to `ai_usage_log` via `upsert_ai_usage_log` RPC. Aggregates by date/provider/model before upserting.
- Modified `src/stores/aiChat.ts` — `initialize()` now async; tries Supabase first (VPS-first), falls back to localStorage. Debounced Supabase save wired into `debouncedSaveConversations`. Delete mirrors to Supabase. `startUsageSync()` called on init. Added `syncStatus` ref.

**Category**: AI / Persistence / Sync

---

### TASK-1470: Task Assist UX Resurface (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-03-08)

**Problem**: AI Task Assist is functional but buried in a context menu popover. Most users never discover it. It provides real value (AI suggestions for task breakdown, priority, time estimates) but zero discoverability.

**Fix**:
1. Add visible "AI Assist" button in `TaskEditModal.vue` toolbar (next to other action buttons)
2. Add keyboard shortcut `Ctrl+/` to trigger Task Assist from anywhere a task is focused
3. Add inline suggestion prompt below task title in edit modal ("Want AI suggestions for this task?")
4. Consider subtle indicator on tasks that haven't been AI-assisted (optional, evaluate UX impact)

**Category**: AI / UX

---

### ~~TASK-1527~~: Remove Entire Gamification System (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-14)

Removed the entire gamification system (~23,700 lines): XP, achievements, challenges, shop, boss fights, corruption, Cyberflow RPG view, cyberflow design tokens, and all integration hooks. DB tables left dormant (no migration needed, reversible). Build passes, 883/884 tests pass.

**Category**: Cleanup / Architecture

---

### ~~BUG-1528~~: Tiny gray dot appears on today's date in date picker (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-14)

**Problem**: Naive UI's built-in `<div class="n-date-panel-date__sup">` rendered a gray dot on today's date, overlapping with our custom `::after` dot indicators.

**Fix**: Hidden the default element with `display: none !important` in `global-overrides.css`. Our custom white/teal dots remain.

**Category**: UI Bug

---

### BUG-1531: Duplicated tasks keep being created (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (2026-03-15)

**Problem**: Tasks are being duplicated — the same task appears multiple times in the app, causing massive task inflation (user reports 333,111 tasks). Screenshot shows identical Hebrew tasks appearing twice in calendar view.

**Investigation**: Multi-agent root cause analysis in progress.

**Category**: Data Integrity / Sync

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
