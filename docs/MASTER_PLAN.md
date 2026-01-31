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

### BUG-1121: KDE Plasma Widget Dropdown Options Disappearing (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS

**Problem**: In the KDE Plasma widget task list, dropdown menus (sort order, filter) are cutting off options. Should show 4 options but some are invisible/unpickable.

**Screenshot Evidence**: User-provided screenshot shows "A-Z" and "Priority" visible but other options missing from the dropdown.

**Investigation Needed**:
- Check dropdown height/overflow CSS in `main.qml`
- Verify `ComboBox` model has all 4 items
- Check if z-index or clipping is hiding options
- Test with different panel heights/positions

**Files**: `kde-widget/package/contents/ui/main.qml`

---

### BUG-1122: KDE Widget Lost Timer Sync with Web App and Tauri (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: KDE Plasma widget has lost timer sync with BOTH the web app and Tauri desktop app. Timer state changes are not reflecting across devices.

**Expected Behavior**:

---

### BUG-1129: Quick Sort Project Buttons Truncating Names on Desktop (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: In the Quick Sort view on desktop, project category buttons have fixed width causing long project names to be truncated with ellipsis. Hebrew text "נטלי כה..." and other long names are cut off.

**Screenshot**: Shows "Categorize as:" buttons where project 3 displays "...כה נטלי" (truncated)

**Expected Behavior**:
- Project names should be fully visible or have reasonable truncation with tooltip
- Buttons should expand to fit content or use flexible width
- Long names should have tooltip on hover showing full text

**Investigation Needed**:
- Check Quick Sort component button styling
- Review flex/grid layout for category buttons
- Consider `text-overflow: ellipsis` + `title` attribute for accessibility

**Files**: `src/components/layout/CategorySelector.vue`, `src/views/QuickSortView.vue`

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

### BUG-1122: KDE Widget Lost Timer Sync with Web App and Tauri (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: KDE Plasma widget has lost timer sync with BOTH the web app and Tauri desktop app.

**Expected Behavior**:
- KDE widget, web app, and Tauri app should share timer state via Supabase Realtime
- Timer start/pause/reset on any device should reflect on all others
- Device leadership model should coordinate which device "leads" the countdown

**Investigation Needed**:
- Check if KDE widget Supabase credentials are still valid
- Verify Realtime WebSocket connection in KDE widget
- Check device leadership heartbeat mechanism
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

### BUG-1124: Task Positions Don't Sync Between Tauri App and Web App (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: Task positions on canvas don't sync correctly between the production Tauri desktop app and the web app (PWA). Changes made in one don't reflect properly in the other.

**Investigation Needed**:
- Identify which app's positions are being overwritten
- Check Supabase Realtime subscription differences between Tauri and PWA
- Review canvas position persistence logic in `useCanvasSync.ts`
- Verify device leadership model isn't conflicting with position updates

**Related**: TASK-131 (position reset issues), TASK-142 (positions reset on refresh)

**Files**: `src/composables/canvas/useCanvasSync.ts`, `src/stores/canvas.ts`, `src/composables/useSupabaseDatabase.ts`

---

### BUG-1125: Canvas Edge/Cable Connections Between Nodes Broken (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED

**Problem**: Connecting cables/edges between nodes on the canvas is broken. Users cannot create new connections between tasks/groups. Affects both local dev and Tauri desktop app.

**Investigation Needed**:
- Check Vue Flow edge creation handlers in `useCanvasEvents.ts`
- Verify `onConnect` and `onEdgesChange` callbacks
- Review edge validation logic in canvas composables
- Check if recent refactoring broke connection handle visibility or functionality

**Related**: Canvas position system, Vue Flow event handlers

**Files**: `src/composables/canvas/useCanvasEvents.ts`, `src/composables/canvas/useCanvasInteractions.ts`, `src/views/CanvasView.vue`

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

### BUG-1127: Cannot Create Group Inside Another Group (Nested Groups) (📋 PLANNED)

**Priority**: P2-MEDIUM | **Status**: 📋 PLANNED

**Problem**: It's not possible to create a new group inside an existing group. Nested group creation is blocked or ignored.

**Expected Behavior**: Users should be able to create groups inside other groups for hierarchical organization.

**Investigation Needed**:
- Check if group creation logic explicitly prevents nested groups
- Verify parentId assignment during group creation
- Review Vue Flow nesting validation

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

### BUG-1116: Tauri Mouse Offset During Drag (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: When dragging tasks in Tauri app, the mouse cursor is not positioned correctly above the dragged task - there's an offset.

**Root Cause Analysis**:
1. Possible WebView coordinate transformation issues
2. Window scale factor / HiDPI handling
3. Vue Flow drag offset calculation not accounting for Tauri window chrome
4. CSS transform origin differences in WebView vs browser

**Files to Investigate**: `src/composables/canvas/useCanvasInteractions.ts`, `src-tauri/tauri.conf.json` (window config)

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
- [ ] Phase 5: KDE widget sync verification (requires testing)
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

### TASK-1119: Remove Web Speech API - Use Whisper Only (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Rationale**: Web Speech API has poor quality compared to Whisper:
- Browser-dependent (different results on Chrome/Firefox/Safari)
- Poor Hebrew support
- No mixed-language (code-switching) support
- Requires manual language selection

**Proposed Changes**:
1. Remove `useSpeechRecognition.ts` composable
2. Remove Browser/AI mode toggle from MobileInboxView
3. Make Whisper (via Groq) the only voice input method
4. Simplify voice UI - single mic button, no mode selection

**Files to Modify**:
- `src/composables/useSpeechRecognition.ts` (DELETE)
- `src/mobile/views/MobileInboxView.vue` (simplify voice UI)
- `src/components/inbox/unified/UnifiedInboxInput.vue` (if used)

**Related**: ~~FEATURE-1023~~, ~~BUG-1109~~

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
| TASK-1120 | P2 | Deep UX/UI analysis and enhancement of catalog views |

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
