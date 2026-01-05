# Pomo-Flow: Archived Tasks from MASTER_PLAN (January 2026)

> **Source**: This file contains completed tasks archived from `docs/MASTER_PLAN.md`
> **Purpose**: Preserve implementation details for completed work
> **Last Updated**: January 5, 2026

---

## January 2026 Completed Tasks & Bugs

### ~~TASK-093~~: Database Engine Migration (PouchDB → SQLite) (✅ DONE)
**Status**: ✅ **DONE** (Jan 4, 2026) | **100% complete**
**Goal**: Replace unstable IndexedDB adapter with PowerSync (SQLite WASM) for crash-proof local storage, cross-device sync, and 5x mobile performance.
**Phases**:
1. [x] **Phase 1: Plumbing & Isolation** (Jan 3) ✅
   - Installed `powersync` + `sqlite-wasm`
   - Defined strict SQL Schema (Tasks/Projects)
   - Created `SqlTaskStore` & `SqlProjectStore` replacements
   - Implemented `migratePouchToSql` utility
2. [x] **Phase 2: The Swap** (Complete - Jan 4) ✅
   - [x] Expose `window.migrate()` & UI Button
   - [x] Fix Schema Runtime Errors
   - [x] Connect UI to new SQL stores
   - [x] Perform data verification
3. [x] **Phase 3: Cleanup** (Complete - Jan 4) ✅
   - Delete PouchDB code & legacies
4. [x] **Phase 4: PowerSync Backend Deployment** (Complete - Jan 4) ✅
   - [x] Start Docker stack (`docker-compose up -d`)
   - [x] Initialize PostgreSQL schema (`scripts/init-postgres.sql`)
   - [x] Verify PowerSync replication connection (logs show "Replication lag: 0s")
   - [x] PostgreSQL has data: 6 tasks, 1 project
   - [ ] Production deployment (optional - for remote server)

**Infrastructure Ready** (all files exist):
- `docker-compose.yml` - Full stack (PostgreSQL, MongoDB, Redis, PowerSync, Sync Backend)
- `powersync-config.yaml` - PowerSync service configuration
- `sync-rules.yaml` - Sync bucket definitions
- `scripts/init-postgres.sql` - Complete database schema
- `scripts/sync-backend.cjs` - Upload handler API
- `Dockerfile.postgres`, `Dockerfile.sync-backend` - Container definitions

**Deployment Guide**: `docs/POWERSYNC-DEPLOYMENT.md`

---

### ✅ BUG-062: Backup Blocking & Verbose Logs (Jan 3, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| Backup blocked (>50% loss false positive) | CRITICAL | ✅ **FIXED** |
| Console flood (1300+ logs) | HIGH | ✅ **FIXED** |

**Symptom**: Auto-backups blocked with "Task count dropped from 144 to 0". Console unusable due to spam.

**Root Cause**:
1. **False Positive**: `mockTaskDetector` identified timestamp-based IDs (13 digits) as "Auto-generated Mock IDs" (Medium Confidence). Backup system filters Medium+ mock tasks, resulting in 0 valid tasks found.
2. **Log Noise**: `CanvasView`, `useAppInitialization`, and `canvas.ts` had high-frequency logs left active.

**Fix Applied**:
1. ✅ **Downgraded Confidence**: Changed `Auto-generated ID Pattern` confidence from `medium` to `low` in `mockTaskDetector.ts`.
2. ✅ **Silenced Logs**: Commented out verbose logs in identified files.
3. ✅ **Recovery UI**: Added "Rescue Tasks" button to Settings.

**SOP**: `docs/🐛 debug/sop/backup-false-positive-and-logs-fix-2026-01-03.md`

---

### ✅ BUG-063: Tauri Sync Discrepancy (Jan 3, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| Local tasks (7/10) vs Remote (17) | HIGH | ✅ **FIXED** |

**Symptom**: Tauri app showed fewer tasks than remote. API logs showed successful pull, but tasks didn't appear.
**Root Cause**: Local PouchDB had "deleted" revisions that were winning conflict resolution against the remote active revisions, likely due to history truncation or sync timing issues.
**Fix Implemented**:
1. **Added "Reset Local Data" Tool**: New "Danger Zone" button in `BackupSettings.vue`.
   - Calls `nucleaurReset()` on SyncManager.
   - Wipes local database + reloads app.
   - Forces fresh clone from server.
2. **Result**: Application re-syncs clean state from remote, resolving the discrepancy.

---

### ✅ BUG-064: CustomSelect Tauri CSS Visual Discrepancy (Jan 3, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| CustomSelect dropdowns have prominent white borders in Tauri | MEDIUM | ✅ **FIXED** |

**Symptom**: Filter dropdowns ("All Projects", "All Tasks", "All Status") displayed with visible white borders and glow effects in Tauri, appearing different from Storybook/browser version.

**Root Cause**:
1. Tauri uses WebKitGTK on Linux which has limited `backdrop-filter` support
2. Initial CSS fallbacks used `border: 1px solid rgba(255, 255, 255, 0.12)` which was too bright
3. The glass morphism effect relies on backdrop-blur which fails in WebKitGTK, making borders stand out more

**Visual Comparison**:
- **Reference (Storybook)**: Subtle, nearly invisible borders that blend with dark background
- **Broken (Tauri)**: Prominent white borders, visible glow effects

**Fix Implemented** (`src/assets/styles.css`):
1. **Reduced border opacity**: Changed from `rgba(255, 255, 255, 0.12)` → `rgba(255, 255, 255, 0.06)`
2. **Removed box-shadow from trigger**: Eliminated all glow effects
3. **Adjusted background colors**: Made slightly lighter (`rgba(40, 42, 52, 0.9)`) to blend better
4. **Added comprehensive state overrides**: Hover, focus, open, selected states all updated

---

### ~~BUG-050~~: Ghost Preview Positioning During Resize/Status Change (✅ RESOLVED - Removed Dec 31)

| Issue | Severity | Status |
|-------|----------|--------|
| Ghost preview at wrong position | HIGH | ✅ RESOLVED BY REMOVAL |

**User Report**: Ghost preview appears at incorrect canvas coordinates during:
1. Group/Section resize on canvas
2. Task status change in kanban board

**Screenshot**: `docs/🐛 debug/debugging-screenshot/image copy 7.png`

**Resolution** (Dec 31, 2025):
**Removed ghost preview overlay entirely for canvas operations** - Vue Flow already provides smooth real-time visual feedback during resize/drag, making the ghost overlay redundant and a source of bugs.

**What was removed:**
- [x] Template: `<div v-if="resizeState.isResizing" class="resize-preview-overlay-fixed">` block
- [x] Function: `getSectionResizeStyle()` (~40 lines)
- [x] CSS: `.resize-preview-overlay-fixed`, `.resize-preview-section-overlay`, `.resize-size-indicator`, `@keyframes resize-preview-pulse` (~50 lines)

**Ghost preview KEPT for:**
- Inbox → Canvas drag (needed for drop zone feedback)
- Calendar inbox → Calendar grid drag
- Kanban drag (kept fallback mode for horizontal scroll compat)

**Benefits:**
- ~100 lines of code removed
- No more positioning bugs for canvas resize
- Better performance (no extra DOM during resize)
- Simpler, more maintainable codebase

---

### ~~BUG-053~~: Projects/Tasks Disappeared from IndexedDB (✅ RECOVERED - Dec 31)

| Issue | Severity | Status |
|-------|----------|--------|
| All projects and tasks vanished from app | CRITICAL | ✅ DATA RECOVERED |

**User Report**: "Projects that I created were removed from the projects area" - happened "programmatically" without user action.

**Symptom**:
- Sidebar showed 0 projects, 0 tasks
- IndexedDB only contained `settings:data` document
- Local backups were empty (created after data loss)

**Investigation**:
1. Confirmed IndexedDB was cleared (only 1 document remained)
2. **Remote CouchDB still had all 54 documents** including 20 tasks and 26 projects
3. CouchDB sync manager wasn't reading saved URL configuration (bug in `useReliableSyncManager.ts`)

**Recovery Process**:
1. ✅ Fetched data directly from CouchDB server via curl
2. ✅ Created recovery JSON file with tasks and projects
3. ✅ Imported tasks via Recovery Center "Upload File" feature
4. ✅ Injected projects via Pinia store direct manipulation

**Data Recovered**:
- 20 tasks restored
- 6 main projects restored (Work, Personal, Side Project, proji, projiz, Proji)

---

### ~~BUG-054~~: Cross-Browser CouchDB Sync Failures (✅ FIXED - Jan 1, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| Sync not working across different browsers | P1-HIGH | ✅ **FIXED** |
| UI blocked 10+ seconds waiting for sync | P1-HIGH | ✅ **FIXED** |
| Deleted projects reappearing after sync | P1-HIGH | ✅ **FIXED** |
| Each browser required manual credential entry | P1-HIGH | ✅ **FIXED** |

**User Reports**:
- "Projects/tasks don't sync between Zen and Brave browsers"
- "Sync should be automatic without configuring each browser"
- "UI is blocked for 10+ seconds on page load"
- "Deleted projects keep coming back"

**Root Causes Identified**:

1. **Configuration Disconnect**: Settings UI saved to `localStorage` keys, but sync manager only read from environment variables (`import.meta.env.VITE_COUCHDB_*`). Two independent systems that never communicated.
2. **Blocking Initialization**: App waited for `waitForInitialSync(10000)` before loading any local data, causing 10+ second UI freeze.
3. **Race Condition**: Data-pulled callback registered inside `onMounted`, but sync started when stores were created (before mount) - callback missed initial sync.
4. **Missing Tombstones**: Project deletion only removed from array, no PouchDB tombstone created, so CouchDB sync restored "non-deleted" remote version.
5. **IndexedDB Corruption**: Brave browser had corrupted IndexedDB with errors:
   - `Database has a global failure UnknownError: Failed to read large IndexedDB value`
   - `InvalidStateError: The database connection is closing`

---

### ~~TASK-063~~: Storybook Modal Stories Fixes (✅ DONE)

**Priority**: P2-MEDIUM

**Goal**: Fix and streamline all Storybook modal stories to render correctly with proper glassmorphism styling.

**Problem**: Multiple modal stories in Storybook are broken or not rendering:
- BatchEditModal - nothing appears
- ConfirmationModal - nothing appears
- GroupModal - nothing appears
- QuickTaskCreateModal - broken
- SearchModal - needs streamlining
- SettingsModal - broken
- TaskEditModal - needs streamlining

**Solution**: Applied consistent story patterns with:
- Emoji-prefixed titles (🪟 Modals & Dialogs/ComponentName)
- Dark gradient background decorators
- Proper TypeScript types
- Pinia initialization to prevent store errors
- Mock data instead of real store dependencies
- Event handlers for all emitted events
- Multiple story variants

**Files Fixed**:
- [x] `src/stories/modals/BatchEditModal.stories.ts` - Fixed prop names (isOpen, taskIds), added variants
- [x] `src/stories/modals/ConfirmationModal.stories.ts` - Fixed prop name (isOpen not show), added 4 variants
- [x] `src/stories/modals/GroupModal.stories.ts` - Fixed prop name (isOpen not modelValue), added variants
- [x] `src/stories/modals/QuickTaskCreateModal.stories.ts` - Added event handlers, proper styling
- [x] `src/stories/modals/SearchModal.stories.ts` - Added Pinia init, event handlers
- [x] `src/stories/modals/SettingsModal.stories.ts` - Added Pinia init, proper render function
- [x] `src/stories/modals/TaskEditModal.stories.ts` - Added mock Task data, 5 story variants

**Started**: 2025-12-25
**Completed**: 2025-12-25

---

### ~~TASK-064~~: Dev-Manager Comprehensive Redesign (✅ DONE)

**Status**: ✅ **DONE** (Jan 5, 2026) | **100% complete**

**Priority**: P1-HIGH

**Goal**: Complete UI overhaul of the dev-manager dashboard with modern design, stroke-based icons, and new Timeline/Gantt view.

**Design Principles**:
- [x] **Strokes over fills**: All icons use outline/stroke style, no filled icons
- [x] **Glass morphism**: Consistent with PomoFlow's design system
- [x] **Modern aesthetics**: Clean, minimal, professional developer tooling feel

**Scope**:
- [x] **Icon System**: Replace emoji icons (📋, 🎯, 📚, 📊) with custom SVG stroke icons
- [x] **Header Redesign**: Modern navigation with refined tab styling
- [x] **Kanban Board Overhaul**: Improved task cards, better visual hierarchy
- [x] **Timeline/Gantt View**: New tab implementing IDEA-002 for task visualization
- [x] **Panel Consistency**: Update Skills, Docs, and Stats panels to match new design

**Files to Modify**:
- [x] `dev-manager/index.html` - Main dashboard, icons, header
- [x] `dev-manager/kanban/index.html` - Kanban board UI
- [x] `dev-manager/skills/index.html` - Skills panel styling
- [x] `dev-manager/docs/index.html` - Docs panel styling
- [x] `dev-manager/stats/index.html` - Stats panel styling
- [x] Create: `dev-manager/timeline/index.html` - New Timeline/Gantt view

**Implementation Phases**:
- [x] Phase 1: SVG stroke icon set design and integration
- [x] Phase 2: Header and navigation redesign
- [x] Phase 3: Kanban board UI overhaul
- [x] Phase 4: Timeline/Gantt view implementation
- [x] Phase 5: Skills, Docs, Stats panel updates

**Related**: Incorporates IDEA-002 (Timeline View for Dev-Manager)

**Started**: 2025-12-25
**Completed**: 2026-01-05

---

### ~~BUG-065~~: Kanban Vertical Scroll & Layout Conflicts (✅ DONE - Jan 3, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| App-wide vertical scroll blocked | CRITICAL | ✅ **FIXED** |
| Scroller listener leaks | HIGH | ✅ **FIXED** |
| Browser-specific scroll lock (Zen/WebKitGTK) | CRITICAL | ✅ **FIXED** |

**Symptom**: After drag-and-drop improvements, vertical scrolling was completely blocked across Zen, Brave, and Tauri apps. The UI felt "stuck" or unscrollable.

**Root Causes**:
1. **Scroller Conflict**: `useHorizontalDragScroll.ts` had a logic error where it was eagerly consuming all touch/mouse moves without a direction check, blocking native vertical results.
2. **Layout Collapse**: Recent structural changes to `BoardView.vue` and `MainLayout.vue` omitted essential `flex: 1` and `height: 100%` rules on wrappers, causing the scrollable area to effectively have zero height.
3. **Restrictive CSS**: Implementation of `contain: layout style` and `isolation: isolate` on global containers disrupted the scroll chain in certain browser engines.
4. **Listener Leak**: Global `mousemove` and `mouseup` listeners were not correctly removed if a drag was yielded, bogging down the main thread.

**Fixes Applied**:
- [x] **Directional Awareness**: Refactored `handleMove` to yield immediately if movement is primarily vertical (|dy| > |dx|).
- [x] **Structural Flex**: Added `display: flex; flex: 1; min-height: 0` to `.view-wrapper` and `.board-view-wrapper` to ensure a concrete scrollable height.
- [x] **CSS Cleanup**: Removed restrictive containment and added `touch-action: pan-y` to allow native vertical gestures in all environments.
- [x] **Safe Scoping**: Fixed scoping errors in `useHorizontalDragScroll.ts` that were crashing the listener attachment logic.

**Files Modified**:
- `src/composables/useHorizontalDragScroll.ts` - Refactored yield logic & global listener safety.
- `src/layouts/MainLayout.vue` - Fixed `.view-wrapper` flex expansion.
- `src/views/BoardView.vue` - Fixed `.board-view-wrapper` and scroller constraints.
- `src/components/kanban/KanbanSwimlane.vue` - Adjusted overflow and touch-action.

---

### ~~BUG-066~~: Canvas Node Dragging Performance Lag (✅ DONE - Jan 3, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| Canvas node dragging lag | CRITICAL | ✅ **FIXED** |
| Reactive traversal overhead | HIGH | ✅ **FIXED** |
| Deep watcher CPU spikes | HIGH | ✅ **FIXED** |

**Symptom**: Dragging nodes on the canvas (Vue Flow) resulted in significant interaction lag (up to 1s frame drops) in the Tauri app, especially with custom nodes.

**Root Causes**:
1. **Deep Watchers**: `useVueFlowStateManager` and `useVueFlowStability` used `deep: true` watchers on the `nodes` array. Moving a node triggered full array traversal on every frame.
2. **Selection Logic**: O(N^2) store-based selection checks in `CanvasView.vue` slots performed `.includes()` on every node every frame.
3. **Expensive Filters**: Done tasks used `filter: grayscale()` and `backdrop-filter`, which added significant composition overhead during movement.
4. **IPC Logs**: Excessive logging in the drag path caused IPC congestion in Tauri.

**Fixes Applied**:
- [x] **Guarded Watchers**: Modified watch sources to return `null` during `isInteracting`, pausing deep traversal during movement.
- [x] **Efficient Diffing**: Replaced O(N^2) search logic with O(N) Map-based diffing in `useVueFlowStateManager`.
- [x] **CSS Silencing**: Added `.is-dragging` state to custom nodes to disable `backdrop-filter`, `filter`, and `transition` during drag.
- [x] **Internal State Optimization**: Switched to `nodeProps.selected` and `nodeProps.dragging` in `CanvasView.vue` slots to eliminate store lookups.

**Files Modified**:
- `src/composables/useVueFlowStateManager.ts` - Guarded watchers & O(N) diffing.
- `src/composables/useVueFlowStability.ts` - Guarded watchers.
- `src/components/canvas/TaskNode.vue` - CSS silencing & optimized props.
- `src/views/CanvasView.vue` - Slot optimization & interaction state passing.
- `src/composables/canvas/useCanvasDragDrop.ts` - Silenced IPC logs.

---

### ~~TASK-092~~: Canvas Custom Node Performance Guard (✅ DONE - Jan 3, 2026)

**Goal**: Ensure custom canvas nodes remain performant under heavy interaction.

**Actions**:
- [x] Added `isDragging` prop support to `TaskNode.vue` and `GroupNodeSimple.vue`.
- [x] Implemented interaction-aware CSS that automatically silences expensive filters during movement.
- [x] Optimized selection detection logic to leverage Vue Flow internal state.
- [x] Documented for future custom node types.

---

### ~~TASK-070~~: Fix context menu in groups (wrong menu) (✅ DONE)
**Priority**: P1-HIGH
**Completed**: Dec 31, 2025
*Full details now archived.*

### ~~TASK-071~~: Fix Task Card Text Wrapping (✅ DONE)
**Priority**: P1-HIGH
**Completed**: Dec 31, 2025
*Full details now archived.*

### ~~TASK-072~~: Add Nested Groups Support (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: Dec 30, 2025 (real-time counters, drag fix), Dec 29, 2025 (initial)
*Full details now archived.*

### ~~TASK-073~~: Improve Group Outline Styling (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: Jan 1, 2026
*Full details now archived.*

### ~~TASK-074~~: Task Node Background Blur (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: Dec 29, 2025
*Full details now archived.*

### ~~TASK-075~~: Markdown Support for Task Descriptions (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: Jan 1, 2026
*Full details now archived.*

### ~~TASK-076~~: Separate Done Filter for Canvas vs Calendar Inbox (✅ DONE)
**Priority**: P1-HIGH
**Completed**: Dec 31, 2025
*Full details now archived.*

### ~~TASK-078~~: Dev-Manager Hide Done Tasks Filter (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: Dec 30, 2025
*Full details now archived.*

### TASK-082: Auto-Move Today Tasks to Overdue at Midnight (✅ DONE)
**Status**: 🔄 IMPLEMENTED (Dec 31, 2025)
*Full details now archived.*

### TASK-083: "All Projects" Filter (✅ DONE)
**Status**: ✅ DONE
*Full details now archived.*

### TASK-084: Multi-Select Projects Filter (✅ DONE)
**Status**: ✅ DONE
*Full details now archived.*

---

### ~~TASK-091~~: Kanban Board Drag-and-Drop Refactor (✅ DONE - Jan 3, 2026)

| Feature | Priority | Status |
|---------|----------|--------|
| `vuedraggable` Integration | P1-HIGH | ✅ **DONE** |
| Direction-aware Horizontal Scroll | P1-HIGH | ✅ **DONE** |
| Native Drag Conflict Resolution | P2-MEDIUM | ✅ **DONE** |

**Goal**: Implement a smooth, multi-swipe Kanban board where vertical task sorting and horizontal row scrolling coexist without conflict.

**Implementation**:
- [x] **Decoupled Interactions**: Removed native HTML5 `draggable="true"` from `TaskCard.vue` to prevent browser drag-preview interference with `vuedraggable`.
- [x] **Improved Sensitivity**: Increased `vuedraggable` delay (100ms) and touch-threshold (5px) to better distinguish between clicking, sorting, and board scrolling.
- [x] **Intent Detection**: Added `data-draggable="true"` attributes to help the horizontal scroller identify when to yield to children immediately.
- [x] **Horizontal Momentum**: Maintained momentum-based scrolling for the board while ensuring it doesn't "catch" during vertical task movement.

**Result**: Butter-smooth dragging in both directions across all platforms.
### ~~BUG-050~~: Ghost Preview Positioning During Resize/Status Change (✅ RESOLVED - Removed Dec 31)

| Issue | Severity | Status |
|-------|----------|--------|
| Ghost preview at wrong position | HIGH | ✅ RESOLVED BY REMOVAL |

**User Report**: Ghost preview appears at incorrect canvas coordinates during:
1. Group/Section resize on canvas
2. Task status change in kanban board

**Screenshot**: `docs/🐛 debug/debugging-screenshot/image copy 7.png`

**Resolution** (Dec 31, 2025):
**Removed ghost preview overlay entirely for canvas operations** - Vue Flow already provides smooth real-time visual feedback during resize/drag, making the ghost overlay redundant and a source of bugs.

**What was removed:**
- [x] Template: `<div v-if="resizeState.isResizing" class="resize-preview-overlay-fixed">` block
- [x] Function: `getSectionResizeStyle()` (~40 lines)
- [x] CSS: `.resize-preview-overlay-fixed`, `.resize-preview-section-overlay`, `.resize-size-indicator`, `@keyframes resize-preview-pulse` (~50 lines)

**Ghost preview KEPT for:**
- Inbox → Canvas drag (needed for drop zone feedback)
- Calendar inbox → Calendar grid drag
- Kanban drag (kept fallback mode for horizontal scroll compat)

**Benefits:**
- ~100 lines of code removed
- No more positioning bugs for canvas resize
- Better performance (no extra DOM during resize)
- Simpler, more maintainable codebase

---

### ~~BUG-053~~: Projects/Tasks Disappeared from IndexedDB (✅ RECOVERED - Dec 31)

| Issue | Severity | Status |
|-------|----------|--------|
| All projects and tasks vanished from app | CRITICAL | ✅ DATA RECOVERED |

**User Report**: "Projects that I created were removed from the projects area" - happened "programmatically" without user action.

**Symptom**:
- Sidebar showed 0 projects, 0 tasks
- IndexedDB only contained `settings:data` document
- Local backups were empty (created after data loss)

**Investigation**:
1. Confirmed IndexedDB was cleared (only 1 document remained)
2. **Remote CouchDB still had all 54 documents** including 20 tasks and 26 projects
3. CouchDB sync manager wasn't reading saved URL configuration (bug in `useReliableSyncManager.ts`)

**Recovery Process**:
1. ✅ Fetched data directly from CouchDB server via curl
2. ✅ Created recovery JSON file with tasks and projects
3. ✅ Imported tasks via Recovery Center "Upload File" feature
4. ✅ Injected projects via Pinia store direct manipulation

**Data Recovered**:
- 20 tasks restored
- 6 main projects restored (Work, Personal, Side Project, proji, projiz, Proji)

**Root Cause**: Under investigation - suspected issue with sync manager not reading URL configuration from settings. See BUG-054 for sync manager URL bug.

**Related Bug**: Created BUG-054 for ReliableSyncManager URL configuration issue.

---

### ~~BUG-054~~: Cross-Browser CouchDB Sync Failures (✅ FIXED - Jan 1, 2026)

| Issue | Severity | Status |
|-------|----------|--------|
| Sync not working across different browsers | P1-HIGH | ✅ **FIXED** |
| UI blocked 10+ seconds waiting for sync | P1-HIGH | ✅ **FIXED** |
| Deleted projects reappearing after sync | P1-HIGH | ✅ **FIXED** |
| Each browser required manual credential entry | P1-HIGH | ✅ **FIXED** |

**User Reports**:
- "Projects/tasks don't sync between Zen and Brave browsers"
- "Sync should be automatic without configuring each browser"
- "UI is blocked for 10+ seconds on page load"
- "Deleted projects keep coming back"

**Root Causes Identified**:

1. **Configuration Disconnect**: Settings UI saved to `localStorage` keys, but sync manager only read from environment variables (`import.meta.env.VITE_COUCHDB_*`). Two independent systems that never communicated.

2. **Blocking Initialization**: App waited for `waitForInitialSync(10000)` before loading any local data, causing 10+ second UI freeze.

3. **Race Condition**: Data-pulled callback registered inside `onMounted`, but sync started when stores were created (before mount) - callback missed initial sync.

4. **Missing Tombstones**: Project deletion only removed from array, no PouchDB tombstone created, so CouchDB sync restored "non-deleted" remote version.

5. **IndexedDB Corruption**: Brave browser had corrupted IndexedDB with errors:
   - `Database has a global failure UnknownError: Failed to read large IndexedDB value`
   - `InvalidStateError: The database connection is closing`

**Fixes Applied**:

1. **Unified Configuration** (`src/config/database.ts`):
   - Added `getStoredCouchDBConfig()` that reads localStorage first → env vars → hardcoded defaults
   - Fixed empty string handling with `.trim()` checks
   - Added automatic fallback credentials for seamless multi-browser sync

2. **Local-First Loading** (`src/composables/app/useAppInitialization.ts`):
   - Load local data immediately (< 1 second to UI)
   - Sync runs in background with 30-second timeout
   - Callback registered OUTSIDE `onMounted` to catch early sync

3. **Tombstone Creation** (`src/stores/projects.ts`):
   - Added `deleteProjectDoc()` calls to create proper PouchDB deletion markers
   - Tombstones sync to CouchDB, preventing resurrection

4. **Callback Mechanism** (`src/composables/useReliableSyncManager.ts`):
   - Added `registerDataPulledCallback()` for post-sync store reloading
   - Stores refresh automatically when sync pulls new data

**Files Modified**:
- `src/config/database.ts` - Configuration unification
- `src/composables/app/useAppInitialization.ts` - Local-first loading
- `src/stores/projects.ts` - Tombstone creation on delete
- `src/composables/useReliableSyncManager.ts` - Callback mechanism

**SOP**: `docs/🐛 debug/sop/cross-browser-sync-fix-2026-01-01.md`

**Troubleshooting for Corrupted IndexedDB**:
1. DevTools → Application → Storage → IndexedDB
2. Delete `_pouch_pomoflow-app-dev`
3. Refresh page - app syncs fresh data from CouchDB

---

