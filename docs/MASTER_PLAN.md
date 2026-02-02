# FlowState MASTER_PLAN.md

> **Last Updated**: January 30, 2026
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

### BUG-1112: No Notification or Audio When Pomodoro Timer Finishes (👀 REVIEW)

**Priority**: P1-HIGH | **Status**: 👀 REVIEW (2026-01-30)

**Problem**: When the Pomodoro timer finishes a work/break session, there is no notification and no audio alert to inform the user.

**Expected Behavior** (per TASK-1009 implementation):
1. Web App: Service Worker notification with "Start Break" / "+5 min" action buttons
2. KDE Widget: notify-send notification + full-screen overlay
3. Audio alert sound

**Investigation Needed**:
- Check if Service Worker notifications are registered and working
- Verify browser notification permissions
- Check if audio file exists and is being played
- Review `timer.ts` `onComplete` handler

**Root Cause**:
1. `silent: true` in Service Worker notification suppressed OS notification sounds
2. Audio volume was 0.1 (barely audible)
3. Service Worker disabled in dev mode (`devOptions.enabled: false`)

**Fix Applied**:
1. Changed `silent: false` in `src/sw.ts` and fallback notifications in `timer.ts`
2. Increased audio volume to 0.25-0.3 with 3-note chime
3. Enabled Service Worker in dev mode (`vite.config.ts`)
4. **Tauri Desktop**: Added native OS notification with `sound: 'default'` using `@tauri-apps/plugin-notification`
   - Priority: Tauri native → Service Worker → Browser Notification API
   - Plays native OS notification sound on desktop

**Verification**: User must test timer completion to confirm system notification + audio works
- Web: Service Worker notification + Web Audio chime
- Tauri Desktop: Native OS notification + sound + Web Audio chime

**Files Changed**: `src/sw.ts`, `src/stores/timer.ts`, `vite.config.ts`

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

### BUG-1178: Break Button in Timer Notification Doesn't Start Break Timer (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS (2026-02-02)

**Problem**: User reports two issues on Linux desktop:
1. Clicking "Break" button in work-complete notification doesn't start break timer
2. After break completes, no popup appears with "Start Work" / "+5 min" options

**Root Cause Analysis**:
The notification with action buttons comes from Service Worker (not Tauri native). Flow:
1. Work timer completes → `showTimerNotification()` in timer.ts
2. Posts 'TIMER_COMPLETE' to Service Worker
3. SW shows notification with [☕ Break] [+5 min] actions
4. User clicks "Break" → SW notificationclick handler fires
5. SW posts `{ type: 'START_BREAK' }` to client
6. **BUG**: timer.ts `handleServiceWorkerMessage()` not receiving messages

**Likely causes**:
1. SW message listener registered before SW controller is ready
2. Race condition: message sent before window focused

**Fix Plan**:
1. Add debug logging to identify exact failure point
2. Wait for `navigator.serviceWorker.ready` before registering listener
3. Add small delay after focusing window before sending message
4. Add URL query param fallback for when postMessage fails

**Files**: `src/stores/timer.ts`, `src/sw.ts`

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

### TASK-1130: QuickSort Desktop UX/UI Comprehensive Improvements (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Desktop QuickSort view has multiple UX issues preventing efficient task categorization:
1. Cannot view as "one-pager" - requires scrolling (850-1050px content vs 900px viewport)
2. Task titles scroll out of view when viewing project options (context loss)
3. Project names truncated, especially Hebrew/RTL text ("נטלי כה...")
4. Keyboard shortcuts (1-9) exist but badges are hidden (`display: none`)

**Root Causes Identified**:
- `.card-container` has `min-height: 350px` (excessive)
- `.category-grid` uses `minmax(180px, 1fr)` (too narrow for long names)
- `.project-name` has `white-space: nowrap` (forces truncation)
- Header + progress + tabs consume ~240px before content
- Gaps/padding total ~128px additional

**Improvement Plan (3 Phases)**:

**Phase 1 - Quick Wins** (Solves scrolling + truncation):
- [ ] Add `max-height: 240px; overflow-y: auto` to `.category-grid`
- [ ] Change `.project-name` to `white-space: normal; -webkit-line-clamp: 2`
- [ ] Increase grid minimum from `180px` to `200px`
- [ ] Reduce `.quick-sort-card` min-height from `300px` to `200px`
- [ ] Unhide `.shortcut-badge` (remove `display: none`)

**Phase 2 - Layout Compression** (Fits in 700px viewport):
- [ ] Compress header: inline title, hide subtitle, reduce font size
- [ ] Move tab navigation inline with header using CSS grid
- [ ] Single-line inline progress indicator
- [ ] Reduce container padding from 64px to 40px

**Phase 3 - Mobile Feature Parity**:
- [ ] Add project search/filter (like `MobileQuickSortView.vue`)
- [ ] Add recent projects section (4 most-used)
- [ ] Add "Keep in Inbox" option
- [ ] Add colored left border to project buttons for visual scanning

**Target Metrics**:
- Total height: 744-964px (fits 1080p without scroll)
- Hebrew name visibility: 95% fully readable
- Keyboard shortcut discovery: Visible badges

**Related**: BUG-1129 (project button truncation)

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

### BUG-1123: Tauri Desktop App Performance Issues (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Performance issues reported in Tauri desktop application.

**Investigation Needed**:
- Identify specific performance bottlenecks (startup time, UI responsiveness, memory usage)
- Check if issue is Rust backend, frontend rendering, or IPC communication
- Compare performance between Tauri app and PWA version
- Review release profile optimizations from BUG-1115

**Related**: BUG-1115 (release profile optimizations)

**Files**: `src-tauri/`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`

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

### BUG-1126: Group Created at Wrong Location (Not Where Clicked) (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS

**Problem**: When right-clicking on the canvas to create a new group, the group does not appear at the clicked location. It appears at a different position instead.

**Expected Behavior**: New group should be created at the exact canvas coordinates where the user right-clicked.

**Investigation Needed**:
- Check context menu coordinate capture in canvas right-click handler
- Verify coordinate transformation from screen/viewport to canvas coordinates
- Review group creation in `useCanvasActions.ts` or `useCanvasGroups.ts`

**Files**: `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasActions.ts`, `src/composables/canvas/useCanvasGroups.ts`

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

### TASK-1128: Add "Create Group From Selection" Context Menu Option (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Feature**: When multiple tasks are selected on canvas, right-click should show "Add to New Group" option that:
1. Creates a new group at the bounding box location of selected tasks
2. Automatically parents all selected tasks to the new group
3. Sizes the group to contain all selected tasks with padding

**Implementation**:
- Add context menu option when `selectedNodes.length > 1`
- Calculate bounding box of selected nodes
- Create group with appropriate position and dimensions
- Update selected tasks' parentId to new group

**Files**: `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasActions.ts`, `src/components/canvas/CanvasContextMenu.vue`

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

**Subtasks**: (Pending design session)

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
