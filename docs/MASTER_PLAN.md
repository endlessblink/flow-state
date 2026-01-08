**Last Updated**: January 8, 2026 (ROAD-004 PWA Phase 1 In Progress)
**Version**: 5.29 (PWA Foundation - vite-plugin-pwa configured)
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

| ID | Feature | Priority | Status | Dependencies |
|----|---------|----------|--------|--------------|
| ~~ROAD-001~~ | ✅ **DONE** | Power Groups | [Details](./archive/Done-Tasks-Master-Plan.md) | - |
| **ROAD-013** | **Sync Hardening** | **P0** | 🔄 [See Detailed Plan](#roadmaps) | - |
| **ROAD-004** | Mobile support (PWA) | P2 | 🔄 **IN PROGRESS** [See Detailed Plan](#roadmaps) | ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All Done) |
| ROAD-011 | AI Assistant | P1 | [See Detailed Plan](#roadmaps) | - |
| ~~ROAD-022~~ | ✅ **DONE** | Auth (Supabase)| [Details](./archive/MASTER_PLAN_JAN_2026.md) | - |

---

## Active Work (Summary)

> [!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

### Task Dependency Index (PWA Prerequisites) - ✅ ALL COMPLETE

```
┌─────────────────────────────────────────────────────────────────┐
│  ROAD-004: PWA Mobile Support (🔄 IN PROGRESS)                   │
│  Status: Phase 1 Implementation - PWA Plugin Configured          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ All Prerequisites Done
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ~~TASK-118~~     │ │ ~~TASK-119~~     │ │ ~~TASK-120~~     │
│ Remove PouchDB   │ │ Remove PowerSync │ │ Fix CSP          │
│ Status: ✅ DONE  │ │ Status: ✅ DONE  │ │ Status: ✅ DONE  │
└──────────────────┘ └──────────────────┘ └──────────────────┘

       ┌──────────────────┐        ┌──────────────────┐
       │ ~~TASK-122~~     │        │ ~~TASK-121~~     │
       │ Bundle 505KB     │        │ Remove IP        │
       │ Status: ✅ DONE  │        │ Status: ✅ DONE  │
       └──────────────────┘        └──────────────────┘
```

**Prerequisites Complete**: All blocking tasks done, PWA Phase 1 in progress

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

### ROAD-004: Mobile PWA (🔄 IN PROGRESS - Phase 1)
- **Plan**: [plans/pwa-mobile-support.md](../plans/pwa-mobile-support.md)
- **Status**: Phase 1 - PWA Foundation in progress
- **Dependencies**: ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All ✅ DONE)

**Phase 0: Prerequisites** ✅ COMPLETE:
1. ~~TASK-118~~: Remove PouchDB packages (✅ 71 packages removed)
2. ~~TASK-119~~: Remove PowerSync packages (✅ 19 packages removed)
3. ~~TASK-120~~: Fix CSP for service workers (✅ worker-src configured)
4. ~~TASK-121~~: Remove hardcoded IP from database.ts (✅ uses env vars)
5. ~~TASK-122~~: Bundle size optimization (✅ 505KB - close to 500KB target)

**Phase 1: PWA Foundation** (✅ COMPLETE - January 8, 2026):
- [x] Install vite-plugin-pwa
- [x] Configure Workbox caching (NetworkFirst for Supabase API, CacheFirst for assets)
- [x] Create icon set (64, 192, 512, maskable)
- [x] Add PWA meta tags (theme-color, apple-touch-icon, description)
- [x] Build verified with service worker generation
- [x] Tested: Service worker registered & activated, manifest linked

**Phase 2: VPS Deployment** (Pending):
- Setup Caddy with auto-SSL
- GitHub Actions CI/CD
- Monitoring (Sentry, UptimeRobot)
</details>

<details id="active-task-details">
<summary><b>Active Task Details</b></summary>

### ~~TASK-099~~: Auth Store & Database Integration (✅ DONE)
- [x] Integration with Supabase.
- [x] Refactor `useAuthStore.ts` and `useDatabase.ts`.
- [x] Migrated from PouchDB/CouchDB to Supabase.

### TASK-017: KDE Plasma Widget (Plasmoid) (READY)
**Priority**: P3-LOW
- Create a KDE Plasma 6 taskbar widget.

### ~~TASK-039~~: Duplicate Systems Consolidation (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
- [x] Consolidate `ConflictResolver` and `conflict-resolution` service.
- [x] Create unified `integrity.ts` for hashing and checksums.
- [x] Refactor `useBackupSystem` and `ForensicLogger` to use `integrity.ts`.
- [x] Fixed all broken imports and MIME type errors following file deletions.

### TASK-041: Implement Custom Recurrence Patterns (📋 PLANNED)
**Priority**: P2-MEDIUM
- Define custom recurrence syntax and parsing logic.

### ~~TASK-046~~: Establish Canvas Performance Baselines (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

### TASK-065: GitHub Release (📋 TODO)
**Priority**: P3-LOW
- Remove hardcoded CouchDB credentials.
- Add Docker self-host guide to README.
- Create MIT LICENSE.

### TASK-079: Tauri Desktop (📋 PLANNED)
**Priority**: P1-HIGH
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
**Priority**: P1-HIGH
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

### ~~TASK-106~~: Brain Dump RTL Support (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 6, 2026
- [x] Implement correct RTL and Hebrew/English mix support for Brain Dump section in canvas inbox.
- [x] Automatic text direction detection in `useBrainDump.ts`.
- [x] Bidirectional rendering support in Inbox components.

### TASK-110: New Branding: "Cyber Tomato" (📋 PLANNED)
**Priority**: P2-MEDIUM
- Design and implement new clean, minimal, cyberpunky "Cyber Tomato" icon set.
- Includes: Main logo, Tauri app icon, and favicon.

### TASK-111: Landing Page for Early Access (📋 PLANNED)
**Priority**: P1-HIGH
**Plan**: [plans/pomo-flow-landing-page.md](../plans/pomo-flow-landing-page.md)
- Create landing page hosted on GitHub Pages (free)
- Showcase features: Board, Calendar, Canvas views, Pomodoro timer
- Email signup for early access waitlist
- Explain open-core business model:
  - Free (Self-Host): Deploy your own Supabase instance
  - Cloud ($): Our hosted Supabase + backups + support
  - Pro ($): AI features + gamification

### TASK-108: Tauri/Web Design Parity (📋 PLANNED)
**Priority**: P1-HIGH
- Ensure the Tauri app design mimics 1-to-1 the web app design.



### ~~TASK-109~~: Premium "Obsidian-Like" Markdown Editor (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026

Implemented a professional, seamless Live Preview (WYSIWYG) experience using the **Milkdown** editor core, delivering an Obsidian-like behavior for task descriptions.

**Features**:
- [x] **Live Preview (WYSIWYG)**: Content renders instantly as you type (headings, bold, lists), eliminating the need for a separate "Preview" tab for basic editing.
- [x] **Milkdown Core**: Sophisticated ProseMirror-based engine for high-performance editing and reliable GFM support.
- [x] **Stable Architecture**: Implemented a parent-child structure (`MarkdownEditor` shell + `MilkdownEditorSurface`) to ensure reliable context injection and application stability.
- [x] **Interactive Checkboxes**: Users can toggle task list checkboxes directly within the live editor surface.
- [x] **Full RTL & Mixed Content**: Deep integration with our Hebrew alignment logic, ensuring perfectly aligned right-to-left text flow with automatic detection.
- [x] **Premium UI**: Custom-styled glassmorphism surface with a floating toolbar (Bold, Italic, Lists, Links, Undo/Redo).

**Critical Bug Fixes (January 6, 2026)**:
- [x] Fixed `MilkdownError: Context "editorView" not found` on Enter key press
- [x] Removed incorrect `.create()` call from useEditor chain (Milkdown Vue handles creation internally)
- [x] Added `rows` prop to MarkdownEditor to prevent Vue attribute fallthrough to MilkdownProvider
- [x] Updated TaskEditModal keyboard handler to recognize ProseMirror contenteditable elements
- [x] Enter key now creates newlines in editor, Ctrl/Cmd+Enter saves the task

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

### ~~BUG-009~~: Milkdown Editor Security & Stability Fixes (✅ DONE)
**Priority**: P0-CRITICAL (Security) / P1-HIGH (Stability)
**Completed**: January 7, 2026

Comprehensive security and stability fixes for the Milkdown markdown editor following TASK-109 implementation.

**Security Fixes**:
- [x] **CRITICAL**: Removed hardcoded CouchDB credentials from `database.ts` (admin/pomoflow-2024)
- [x] Added URL sanitization to markdown link renderer - blocks `javascript:`, `vbscript:`, `data:` protocols
- [x] Implemented protocol allowlist (http, https, mailto only)

**Stability Fixes (Vue Proxy + Private Fields)**:
- [x] Added `toRaw()` wrapper pattern to prevent "Cannot read private member" TypeError
- [x] Created `safeEditorAction()` function that unwraps Vue proxy before accessing Milkdown Editor
- [x] Added `isUnmounting` ref guard to prevent operations on destroyed editor instances
- [x] Added `view.isDestroyed` check before ProseMirror view operations

**TaskList Toolbar Button Fix**:
- [x] Fixed TaskList toolbar to create proper checkboxes instead of raw `[ ]` text
- [x] Uses `wrapInBulletListCommand` + `setNodeMarkup` with `checked: false` attribute
- [x] Checkboxes now render as `□` and toggle to `☑` on click
- [x] Compatible with `listItemBlockComponent` from `@milkdown/components`

**Race Condition Guards**:
- [x] Added `isSaving` ref to TaskEditModal to prevent double-save on rapid Ctrl+S
- [x] Guard in `handleKeyDown` to skip keystrokes while save in progress
- [x] try/finally pattern ensures `isSaving` resets even on error

**Performance Improvements**:
- [x] Changed RTL detection from computed to debounced ref (300ms)
- [x] Prevents expensive regex execution on every keystroke

**Type Safety**:
- [x] Added `ToolbarCommand` union type for toolbar actions
- [x] Implemented exhaustive switch with `never` type for compile-time safety

**Test Suite**:
- [x] Created `tests/markdown-editor.spec.ts` with 6 Playwright scenarios
- [x] Tests: Basic editing, Bold toolbar, TaskList, Race conditions, Large content, Clean unmount
- [x] Console error monitoring for private field and TypeError detection

**Files Changed**:
- `src/config/database.ts` - Security: removed credentials
- `src/components/common/MilkdownEditorSurface.vue` - toRaw wrapper, guards
- `src/components/common/MarkdownEditor.vue` - Debounced RTL
- `src/components/tasks/TaskEditModal.vue` - Save race guard
- `src/utils/markdown.ts` - URL sanitization
- `tests/markdown-editor.spec.ts` - New test suite

### ~~BUG-010~~: Milkdown Auto-Conversion Issue → Tiptap Migration (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Milkdown's aggressive input rules continued to auto-convert `-` to bullet lists before users could complete `- [ ]` task list syntax. After multiple fix attempts (disabling individual inputRules imports), the issue persisted.

**Solution**: Migrated from Milkdown to Tiptap
- Tiptap offers `enableInputRules: false` - single option to disable all auto-conversion
- Better Vue 3 integration with official `@tiptap/vue-3`
- Smaller bundle size (~100KB reduction)
- Cleaner API for toolbar commands

**Changes**:
- [x] Created `TiptapEditor.vue` with `enableInputRules: false`
- [x] Updated `MarkdownEditor.vue` to use TiptapEditor instead of MilkdownEditorSurface
- [x] Full toolbar retained: Bold, Italic, Lists, Task Lists, Links, Undo/Redo
- [x] Build passes, bundle 100KB smaller

**Packages Added**:
- `@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`
- `@tiptap/extension-task-item`, `@tiptap/extension-link`, `@tiptap/pm`

**Skill Updates**:
- [x] Created `tiptap-vue3` skill with working patterns
- [x] Deprecated `milkdown-vue3` skill (kept for historical reference)
- [x] Updated `skills.json` registry

**Files**:
- `src/components/common/TiptapEditor.vue` - New
- `src/components/common/MarkdownEditor.vue` - Updated
- `.claude/skills/tiptap-vue3/SKILL.md` - New skill
- `.claude/skills/milkdown-vue3/SKILL.md` - Deprecated
- `.claude/config/skills.json` - Updated

**Note**: Milkdown packages remain in `package.json` but are unused. Can be removed in future cleanup.

---

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

### ~~BUG-002~~: Fix Timer Session UUID & Auth Errors (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**SOP**: [SYNC-timer-uuid-validation.md](./sop/active/SYNC-timer-uuid-validation.md)

Fixed PostgreSQL UUID type error and "User not authenticated" errors when saving timer sessions.

**Root Causes Fixed**:
- [x] Timer session ID was Unix timestamp instead of UUID (legacy code used `Date.now().toString()`)
- [x] `saveActiveTimerSession()` and `deleteTimerSession()` used `getUserId()` which throws when not authenticated
- [x] Timer failed in local-only mode (not logged into Supabase)

**Changes**:
- [x] `timer.ts`: Changed session ID generation to `crypto.randomUUID()`
- [x] `timer.ts`: Added UUID validation safeguard in `saveTimerSessionWithLeadership()` before every save
- [x] `useSupabaseDatabase.ts`: Changed `saveActiveTimerSession` to use `getUserIdSafe()` and skip sync when not authenticated
- [x] `useSupabaseDatabase.ts`: Changed `deleteTimerSession` to use `getUserIdSafe()` and skip sync when not authenticated
- [x] `supabaseMappers.ts`: Added UUID validation to `toSupabaseTimerSession()` (triple-layer protection)

**Key Pattern - Three Layer UUID Protection**:
```typescript
// Layer 1: Creation - timer.ts startTimer()
id: crypto.randomUUID()

// Layer 2: Pre-save validation - timer.ts saveTimerSessionWithLeadership()
if (!uuidRegex.test(session.id)) session.id = crypto.randomUUID()

// Layer 3: Mapper validation - supabaseMappers.ts toSupabaseTimerSession()
const validId = isValidUUID(session.id) ? session.id : crypto.randomUUID()
```

### ~~TASK-107~~: Shift+Enter for Newlines in Task Edit Modal (✅ DONE)
**Priority**: P3-LOW
**Completed**: January 6, 2026

Allow users to insert newlines in text fields (description, subtask descriptions) using Shift+Enter in the TaskEditModal.

**Problem**:
- Pressing Enter anywhere in the modal triggered save
- Users couldn't add line breaks to descriptions

**Solution**:
- [x] Modified `handleKeyDown` to check for Shift modifier and target element type
- [x] Enter in textareas naturally creates newlines (no save)
- [x] Ctrl/Cmd+Enter anywhere triggers save
- [x] Tested and verified with Playwright

**Changes**:
- `src/components/tasks/TaskEditModal.vue`: Updated `handleKeyDown` function (lines 338-358)

### ~~BUG-003~~: Task Jumps to Different Location After Edit (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026
**Plan**: [plans/fix-task-position-jump-after-edit.md](../plans/fix-task-position-jump-after-edit.md)

Fixed task position jumping after editing by preserving existing Vue Flow node positions when position is locked.

**Root Cause**:
When task position was locked (from drag or edit), syncNodes() still recalculated relative position from absolute coordinates. If section position had slightly changed, this caused position drift.

**Fix Applied** (`useCanvasSync.ts`):
- [x] Added `existingNodePositions` map to track current Vue Flow node positions
- [x] When position is locked AND task exists with parentNode, preserve existing node position
- [x] Skip absolute→relative conversion when position is locked to prevent drift
- [x] Build passes, no TypeScript errors

### ~~BUG-005~~: Milkdown Checkboxes & Task Lists Not Working (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Checkboxes in markdown editor weren't rendering or clickable due to plugin initialization order issues.

**Root Causes Fixed**:
- Listener context was accessed BEFORE `.use(listener)` registration
- Theme was applied via `.config(nord)` instead of `.use(nord)`

**Fixes Applied** (`MilkdownEditorSurface.vue`):
- [x] Reordered plugins: `.use(listener)` now comes before config that uses `listenerCtx`
- [x] Changed `.config(nord)` to `.use(nord)` for proper theme initialization
- [x] Verified checkbox rendering works when typing `- [ ]` at line start
- [x] Verified checkbox toggle (click) functionality works (□ ↔ ☑)

**Note**: TaskList toolbar button inserts raw `- [ ]` text which doesn't trigger input rules. This is expected behavior - users type the pattern manually for it to convert.

**Files**:
- `src/components/common/MilkdownEditorSurface.vue`

---

### ~~BUG-004~~: Multi-Drag Positions Reset After Click (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 6, 2026

Fixed multi-selected tasks (Ctrl+click) losing their relative positions after drag and click-to-deselect.

**Root Causes**:
- `onNodeDragStop` handler only processed `event.node` (single node), ignoring other selected nodes in `event.nodes`
- `syncNodes()` recalculated section containment for each task individually, causing mixed coordinate systems
- Tasks near section boundaries got different parentNode assignments, breaking relative arrangement

**Fix Applied**:
- [x] `useCanvasDragDrop.ts`: Updated `handleNodeDragStart` to store positions for ALL nodes in `event.nodes`
- [x] `useCanvasDragDrop.ts`: Updated `handleNodeDragStop` to process ALL dragged nodes together
- [x] For multi-drag, save all positions without recalculating containment
- [x] `useCanvasSync.ts`: Preserve existing parentNode relationships using `.has()` check
- [x] `useCanvasSync.ts`: Preserve existing node positions when position is locked

**Key Insight** (from [Vue Flow TypeDocs](https://vueflow.dev/typedocs/interfaces/NodeDragEvent.html)):
`NodeDragEvent.nodes` contains ALL nodes being dragged, not just the primary `node`.

### ~~BUG-006~~: Ctrl+Click Toggle Deselect Not Working (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Fixed Ctrl+click not properly toggling off selected nodes during multi-select.

**Problem**:
- When selecting 3 tasks with Ctrl+click, then Ctrl+clicking the middle one to deselect
- Expected: Middle task deselected, others remain selected
- Actual: Only middle task selected, others cleared

**Root Cause**:
- Vue Flow's internal click handling was still processing clicks even after our custom handler
- Vue Flow uses `multi-selection-key-code="Shift"` (doesn't recognize Ctrl as multi-select key)
- Vue Flow treated Ctrl+click as regular click, setting ONLY clicked node as selected
- This overrode our store's selection state via `@selection-change` and `@nodes-change` events

**Fix Applied**:
- [x] `TaskNode.vue`: Added `event.stopPropagation()` in `handleClick()` for modifier key clicks
- [x] This prevents Vue Flow from processing the click and overriding our custom multi-select

**Key Insight**: When implementing custom selection behavior that differs from Vue Flow's defaults, prevent event propagation to stop Vue Flow's internal handlers from conflicting.

### ~~BUG-008~~: Shift+Click Incorrectly Triggers Multi-Select Toggle (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
**SOP**: [CANVAS-shift-ctrl-selection-separation.md](./sop/active/CANVAS-shift-ctrl-selection-separation.md)

Fixed Shift+click being treated the same as Ctrl+click for multi-select toggle.

**Problem**:
- Ctrl+click and Shift+click were treated identically (both toggled selection)
- Expected: Ctrl+click toggles individual selection, Shift is reserved for rubber-band drag
- Actual: Shift+click was intercepting clicks and toggling selection instead of allowing Vue Flow's native Shift behavior

**Root Cause**:
- `TaskNode.vue` line 306: `const isModifierClick = event.ctrlKey || event.metaKey || event.shiftKey` treated all modifiers the same
- `useCanvasEvents.ts` handlePaneClick also treated Shift as multi-select trigger
- This conflicted with Vue Flow's `multi-selection-key-code="Shift"` setting

**Fix Applied**:
- [x] `TaskNode.vue`: Changed to `const isMultiSelectClick = event.ctrlKey || event.metaKey` (removed shiftKey)
- [x] `useCanvasEvents.ts`: Same change in handlePaneClick
- [x] Click outside to deselect verified working (handled in handlePaneClick)

**Behavior After Fix**:
- Ctrl/Cmd+click: Toggle individual task selection (our custom behavior)
- Shift+click: Add to selection (Vue Flow's native behavior via multi-selection-key-code)
- Shift+drag: Rubber-band selection
- Click empty space: Clear all selections

### ~~TASK-111~~: Canvas Group Filter for Calendar Inbox (✅ DONE)
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
- Canvas group filter chips (replaced dropdown for better UX)
- **Ctrl+click multi-select**: Select multiple groups at once (OR logic)
- "More filters" button collapses advanced filters (hidden by default)
- Contextual empty state: "No tasks in this group. Drag tasks to this group on Canvas."
- Group membership computed dynamically from task.canvasPosition vs group.position bounds

**Enhancement (January 7, 2026)**: Added Ctrl+click multi-select support
- Changed `selectedCanvasGroup` (string) → `selectedCanvasGroups` (Set)
- Regular click: single-select toggle
- Ctrl/Cmd+click: multi-select toggle (add/remove groups)
- Filter shows tasks in ANY selected group (OR logic)

### ~~BUG-007~~: Sidebar Date Filters Not Matching Tasks (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Fixed "Today" and "This Week" sidebar filters not correctly showing tasks due to date format mismatch.

**Problem**:
- "Today" filter showed only 2 tasks when there were 6+ tasks due today
- Date comparison used direct string equality (e.g., `task.dueDate === todayStr`)
- Stored dates were in various malformed formats:
  - `07T00:00:00+00:00-01-2026` (malformed from database)
  - `07-01-2026` (DD-MM-YYYY)
  - Expected: `2026-01-07` (YYYY-MM-DD)

**Root Cause**:
The `isTodayTask()` and `isWeekTask()` functions in `useSmartViews.ts` assumed `dueDate` was already normalized to `YYYY-MM-DD` format, but database contained various date formats.

**Solution**:
- [x] Added `normalizeDateString()` helper function to handle all date formats
- [x] Updated `isTodayTask()` to normalize dates before comparison
- [x] Updated `isWeekTask()` to normalize dates before comparison
- [x] Handles ISO 8601, DD-MM-YYYY, and malformed legacy formats

**Changes**:
- `src/composables/useSmartViews.ts`: Added `normalizeDateString()` and updated both filter functions

**Verification**:
- Today filter: 2 → 6 tasks (correctly shows all tasks due today)
- All sidebar filters (Today, This Week, All Active, Inbox, Duration) working correctly
- Build passes

### TASK-112: Admin/Developer Role & UI Restrictions (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
- [x] Implement `isAdmin` / `isDev` flags in `useAuthStore` or user metadata.
- [x] Create an "Admin Class" logic for privileged dashboard access.
- [x] Restrict `/performance` and other debug views to Admin users only.
- [x] Add "Developer Settings" section in the main settings.

### ~~TASK-113~~: Canvas Performance Optimization (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
- [x] Implement Level-of-Detail (LOD) rendering for canvas nodes.
- [x] Replace `syncTasksToCanvas` with a more efficient incremental update logic.
- [x] Reduce reactive overhead in node data mapping (O(N) Optimization).
- [x] Verify drag performance (< 16ms/frame).

### ~~TASK-117~~: Fix Lint and TS Errors (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026
- [x] Analyzed and fixed 558 lint errors/warnings.
- [x] Fixed TypeScript module resolution errors (`TS2307`).
- [x] Implemented type safety in `SyncOrchestrator` and `useSupabaseDatabase`.
- [x] Verified application stability with clean production build.
- [x] Zero critical lint errors remaining (warnings reviewed).

### TASK-114: Virtual Scrolling Smoothness (📋 PLANNED)
**Priority**: P2-MEDIUM
- Profile and eliminate layout thrashing in list components.
- Implement optimized rendering strategy for large lists.
- Reduce computed property complexity in task items.

### TASK-115: Memory Efficiency & Leak Fixes (📋 PLANNED)
**Priority**: P2-MEDIUM
- Profile heap snapshots to identify node pooling leaks.
- Implement specialized cleanup for detached Vue Flow elements.
- Optimize task store internal representation for reduced memory footprint.

---

## Code Review Findings (January 7, 2026)

> These issues were identified during comprehensive code review of uncommitted changes.

### ~~BUG-011~~: Index-Based Node Access After Removal (✅ DONE)
**Priority**: P0-CRITICAL (Data Corruption Risk)
**Completed**: January 7, 2026

**Problem**: `useCanvasSync.ts` removes nodes BEFORE applying updates, but updates use stored array indices. After removal, indices shift causing updates to be applied to WRONG nodes.

**Location**: `src/composables/canvas/useCanvasSync.ts` lines 313-337

**Fix Applied**: Changed to ID-based `.find()` lookup instead of index-based access. Also removed duplicate node removal code.

**Subtasks**:
- [x] Change to ID-based lookup for node updates
- [x] Remove duplicate node removal code
- [x] Build verification passed

### ~~BUG-012~~: localStorage Dev-Mode Bypass in Production (✅ DONE)
**Priority**: P0-CRITICAL (Security)
**Completed**: January 7, 2026

**Problem**: Any user can grant themselves admin privileges in production by setting localStorage.

**Locations**:
- `src/stores/auth.ts:33`
- `src/stores/local-auth.ts:66-70`

**Fix Applied**: Changed `||` to `&&` - localStorage override now ONLY works in DEV builds.

**Subtasks**:
- [x] Fix auth.ts isAdmin and isDev computed properties
- [x] Fix local-auth.ts isAdmin and isDev computed properties
- [x] Build verification passed

### ~~BUG-013~~: TiptapEditor Emits HTML Instead of Markdown (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 7, 2026

**Problem**: The TiptapEditor component was emitting HTML content instead of markdown.

**Fix Applied**:
- Added `htmlToMarkdown()` function to `src/utils/markdown.ts`
- TiptapEditor now converts HTML to markdown on emit
- TiptapEditor converts incoming markdown to HTML for Tiptap display

**Subtasks**:
- [x] Added htmlToMarkdown conversion function
- [x] Updated TiptapEditor to use markdown I/O
- [x] Build verification passed

### ~~BUG-014~~: TiptapEditor Link Input Not Sanitized (✅ DONE)
**Priority**: P2-MEDIUM (Security)
**Completed**: January 7, 2026

**Problem**: User input from `window.prompt()` was passed directly to `setLink()` without URL sanitization.

**Location**: `src/components/common/TiptapEditor.vue`

**Fix Applied**:
- Exported `sanitizeUrl()` from `src/utils/markdown.ts`
- TiptapEditor now validates URLs and blocks unsafe protocols (javascript:, data:, etc.)
- Shows alert when unsafe URL is entered

**Subtasks**:
- [x] Export sanitizeUrl function from markdown.ts
- [x] Import and use in TiptapEditor setLink function
- [x] Build verification passed

### ~~BUG-015~~: Watch Priority 'high' Bypasses Batching (✅ DONE)
**Priority**: P2-MEDIUM (Performance)
**Completed**: January 7, 2026

**Problem**: CanvasView.vue was using 'high' priority which runs synchronously and bypasses the batching system entirely.

**Location**: `src/views/CanvasView.vue` line 1845

**Fix Applied**: Changed priority back to 'normal'. The 16ms batch delay (60fps) still feels instant but prevents performance issues when multiple tasks change rapidly.

**Subtasks**:
- [x] Changed priority from 'high' to 'normal'
- [x] Build verification passed

### ~~BUG-016~~: moveTaskToSmartGroup Default Case Clears dueDate (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 7, 2026

**Problem**: Unknown smart group types were logging a warning but still calling `updateTask`, potentially clearing dueDate unintentionally.

**Location**: `src/stores/tasks/taskOperations.ts` line 437

**Fix Applied**: Added early `return` in default case to prevent unintended update when unknown type is passed.

**Subtasks**:
- [x] Added early return in default case
- [x] Build verification passed

### TASK-124: Remove Dead Milkdown Code (📋 PLANNED)
**Priority**: P2-MEDIUM
**Discovered**: January 7, 2026

**Problem**: `MilkdownEditorSurface.vue` is no longer imported (MarkdownEditor uses TiptapEditor), but received 120+ lines of changes and Milkdown packages remain in package.json.

**Impact**: Bundle bloat, maintenance confusion.

**Subtasks**:
- [ ] Confirm MilkdownEditorSurface.vue is not imported anywhere
- [ ] Delete MilkdownEditorSurface.vue
- [ ] Remove Milkdown packages from package.json
- [ ] Verify build passes
- [ ] Measure bundle size reduction

### TASK-125: Remove Debug Console.log Statements (📋 PLANNED)
**Priority**: P3-LOW
**Discovered**: January 7, 2026

**Problem**: 10+ debug console.log statements with emoji prefixes in production code paths.

**Locations**:
- `src/composables/canvas/useCanvasDragDrop.ts` (7 statements)
- `src/stores/tasks/taskOperations.ts` (3 statements)
- `src/components/tasks/TaskEditModal.vue` (1 statement)

**Subtasks**:
- [ ] Remove or wrap in `import.meta.env.DEV` check
- [ ] Verify no runtime issues

### ~~BUG-017~~: Fix Dropdown Cutoff (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: "All Tasks" dropdown in calendar inbox (and potentially others) was cut off because it was constrained to the trigger button's width, causing wider options to be truncated.
**Fix**: Updated `CustomSelect.vue` to use `min-width` instead of fixed `width`, allowing the dropdown to expand to fit its content.

### ~~BUG-018~~: Dropdown Closes on Scroll (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: The custom dropdown closed immediately when users tried to scroll the list of options.
**Fix**: Updated `handleScroll` in `CustomSelect.vue` to ignore scroll events originating from within the dropdown itself.

### ~~BOX-001~~: Fix `ensureActionGroups` Undefined Error (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Helper `ensureActionGroups` was not exported from `useCanvasSmartGroups.ts`, causing runtime error.
**Fix**: Rewrote `useCanvasSmartGroups.ts` to properly export the function and implemented new "Friday" and "Saturday" action group logic instead of legacy "Weekend" group.

### ~~BUG-019~~: Fix `saveUserSettings` Sync Error (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Sync Error `[object Object]` which turned out to be a duplicate key violation on `user_settings`.
**Fix**:
1. Improved error handling in `useSupabaseDatabase.ts` to parse object errors.
2. Added `{ onConflict: 'user_id' }` to `saveUserSettings` upsert call to handle existing records correctly.

### ~~TASK-126~~: Fix Catalog Filter Logic & Position (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: "Hide Done Tasks" filter was misplaced in the view and logic needed verification.
**Fix**:
1. Moved toggle button to `ViewControls.vue` for consistent layout.
2. Verified `taskStore` logic correctly toggles visibility.

### ~~BUG-019~~: Fix ISO Date Display in Overdue Badge (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: Overdue badge showed raw ISO timestamp (e.g., 2026-01-06T00:00:00+00:00).
**Fix**: Updated `formatDueDateLabel` in `CalendarInboxPanel.vue` to nice formatting (e.g., "Overdue Jan 6").

### ~~TASK-128~~: Friday & Saturday Action Groups (✅ DONE)
**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Feature**: Replaced "Weekend" group with "Friday" and "Saturday" Action Groups.
**Logic**: Dropping a task into these groups automatically sets its due date to the closest upcoming Friday or Saturday.

### ~~TASK-126~~: Fix Dead Code - Redundant Ternary (✅ DONE)
**Priority**: P3-LOW
**Completed**: January 7, 2026

**Problem**: Useless ternary that always returns the same value.

**Location**: `src/composables/canvas/useCanvasDragDrop.ts` (2 occurrences)

**Fix Applied**: Removed redundant ternary, now uses `height` directly.

**Subtasks**:
- [x] Removed the redundant ternary (2 occurrences)
- [x] Build verification passed

### ~~TASK-127~~: Remove PouchDB-Era Task Disappearance Logger (✅ DONE)
**Priority**: P2-MEDIUM
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Blocks**: None (cleanup)

**Problem**: The `taskDisappearanceLogger` utility was created to debug mysterious task disappearances caused by PouchDB sync race conditions and IndexedDB issues. Now that PouchDB has been removed (TASK-118), this 450+ line debugging tool serves no purpose.

**Files removed/cleaned**:
- `src/utils/taskDisappearanceLogger.ts` (DELETED - 457 lines)
- `src/main.ts` (removed import)
- `src/stores/tasks/taskOperations.ts` (removed usage)
- `src/stores/tasks/taskHistory.ts` (removed usage)
- `src/composables/useCrossTabSync.ts` (removed usage)

**Subtasks**:
- [x] Remove import and usage from main.ts
- [x] Remove import and usage from taskOperations.ts
- [x] Remove import and usage from taskHistory.ts
- [x] Remove import and usage from useCrossTabSync.ts
- [x] Delete taskDisappearanceLogger.ts
- [x] Build verification passed

### ~~TASK-129~~: Remove TransactionManager & Clean Database Config (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Blocks**: None (cleanup)
**Related**: TASK-117 (originally tracked in stub file comment)

**Problem**: The `TransactionManager` was the PouchDB Write-Ahead Log (WAL) system. Now that PouchDB is removed, the TransactionManager is just a no-op stub that clutters the codebase. Also, `config/database.ts` is full of dead PouchDB/CouchDB configuration.

**Files removed/cleaned**:
- `src/services/sync/TransactionManager.ts` (DELETED - 35 lines)
- `src/stores/tasks/taskOperations.ts` (removed 9 transactionManager calls)
- `src/stores/tasks.ts` (removed crash recovery block ~40 lines)
- `src/services/trash/TrashService.ts` (removed 6 transactionManager calls)
- `src/wal_test_script.ts` (DELETED - unused test file)
- `src/config/database.ts` (added deprecation notice, kept for compatibility)

**Subtasks**:
- [x] Remove transactionManager calls from taskOperations.ts
- [x] Remove transactionManager calls from tasks.ts
- [x] Remove transactionManager calls from TrashService.ts
- [x] Delete TransactionManager.ts stub
- [x] Delete wal_test_script.ts
- [x] Add deprecation notice to config/database.ts
- [x] Build verification passed

---

## PWA Prerequisites (Phase 0) - Must Complete Before ROAD-004

### ~~TASK-118~~: Remove PouchDB Packages & Code (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 7, 2026
**Completed**: January 7, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

PouchDB packages and dead sync code removed from codebase.

**Results**:
- [x] Removed packages from `package.json`: `pouchdb`, `pouchdb-browser`, `@types/pouchdb`
- [x] Deleted 4 dead sync service files:
  - `src/services/sync/DatabaseService.ts`
  - `src/services/sync/SyncOrchestrator.ts`
  - `src/services/sync/SyncOperationService.ts`
  - `src/services/doctor/IntegrityDoctorService.ts`
- [x] `npm install` removed 71 packages (PouchDB dependency tree)
- [x] Build passes: 509 KB gzipped

**Note**: Bundle size did not decrease as expected (was 496 KB before). Further optimization needed in TASK-122.

**Kept as no-op stubs** (still imported by TrashService/task operations):
- `src/services/sync/TransactionManager.ts` - Returns stub transaction IDs

### ~~TASK-119~~: Remove PowerSync Packages (✅ DONE)
**Priority**: P1-HIGH
**Started**: January 8, 2026
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

PowerSync packages removed. Never used - code was tree-shaken. Using Workbox BackgroundSync for PWA instead.

**Results**:
- [x] Removed packages: `@powersync/vue`, `@powersync/web`, `vite-plugin-wasm`, `vite-plugin-top-level-await`
- [x] Deleted `src/database/AppSchema.ts` (unused PowerSync schema)
- [x] Updated `vite.config.ts` to remove PowerSync-specific config
- [x] `npm install` removed 19 packages
- [x] Build passes: **505.45 KB** gzipped (down from 509 KB)
- [x] Build time improved: 13.62s (28% faster)

**Note**: Bundle size reduction modest (~3.6KB) because code was already tree-shaken (never imported). Main benefit is cleaner dependencies and faster builds.

### ~~TASK-120~~: Fix CSP for Service Workers (✅ DONE)
**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

**Results**:
- [x] Updated `src/utils/cspManager.ts` production `worker-src` from `["'none'"]` to `["'self'", "blob:"]`
- [x] CSP now allows service workers for PWA

### ~~TASK-121~~: Remove Hardcoded IP from Database Config (✅ DONE)
**Priority**: P1-HIGH (Security)
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)

**Results**:
- [x] Removed hardcoded IP `84.46.253.137` from all files:
  - `src/config/database.ts` - Now uses env var fallback
  - `src/components/sync/SyncErrorBoundary.vue` - Uses `getCouchDBConfig()`
  - `src/utils/cspManager.ts` - Removed from CSP directives
  - `src/utils/securityHeaders.ts` - Removed from CSP
- [x] Exported `getCouchDBConfig()` from database.ts for dynamic URL access

### ~~TASK-122~~: Bundle Size Optimization (<500KB) (✅ DONE - 505KB)
**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Blocks**: ROAD-004 (PWA Mobile Support)
**Final**: 505.08 KB gzipped | **Target**: <500KB gzipped

**Results**:
- [x] Removed 9 Milkdown packages (unused - TipTap is used instead)
- [x] Removed unused backend packages: `pg`, `express`, `cors`, `jose`, `jsonwebtoken`, `chokidar`, `top-level-await`
- [x] Deleted unused `MilkdownEditorSurface.vue`
- [x] Total packages removed: 226 (71 + 19 + 72 + 154)
- [x] Build time improved: 13.04s

**Bundle size progression**:
| Phase | Size (gzipped) | Change |
|-------|----------------|--------|
| Baseline | 509.05 KB | - |
| After TASK-118 (PouchDB) | 509.05 KB | 0 |
| After TASK-119 (PowerSync) | 505.45 KB | -3.6 KB |
| After unused packages cleanup | 505.08 KB | -0.37 KB |

**Note**: Bundle at 505KB (5KB over target). Most removed packages were already tree-shaken. Further reduction would require code-splitting core features or removing used libraries.

### TASK-123: Consolidate Network Status Implementations (📋 PLANNED)
**Priority**: P2-MEDIUM
**Related**: ROAD-004 (PWA Mobile Support)

Codebase has 3 competing network status implementations. Adding PWA would create a 4th.

**Current Implementations**:
1. `src/services/sync/NetworkMonitorService.ts`
2. `src/composables/useNetworkOptimizer.ts` (line 108)
3. `src/composables/useOptimisticUI.ts` (line 44)

**Recommended**: Consolidate into single `useNetworkStatus.ts` or use VueUse's `useOnline()`.

**Subtasks**:
- [ ] Audit all 3 implementations for feature differences
- [ ] Create single source of truth composable
- [ ] Deprecate or delete redundant implementations
- [ ] Update all consumers to use consolidated version

### TASK-130: Canvas Day-of-Week Groups & Z-Index Fixes (🔄 IN PROGRESS)
**Priority**: P1-HIGH
**Started**: January 8, 2026

Multi-part fix for canvas group issues affecting day-of-week groups and z-index during drag.

**Problems**:
1. Groups reset locations on refresh (persistence issue)
2. Friday/Saturday/all day-of-week groups don't update task due dates correctly when same-day
3. Day groups should show upcoming date in label (e.g., "Friday / Jan 10")
4. Groups appear under other groups when dragging (z-index issue)

**Subtasks**:
- [ ] Fix day-of-week date calculation (handle same-day edge case → next week)
- [ ] Add all days of week to power keyword detection (Monday-Sunday)
- [ ] Add date suffix to day group labels in GroupNodeSimple.vue
- [ ] Fix z-index elevation during group drag
- [ ] Investigate/fix group position persistence on refresh
- [ ] Test with Playwright

**Files to modify**:
- `src/composables/canvas/useCanvasDragDrop.ts` - Day-of-week date logic
- `src/composables/useTaskSmartGroups.ts` - Add day-of-week keywords
- `src/components/canvas/GroupNodeSimple.vue` - Date labels
- `src/composables/canvas/useCanvasSync.ts` - Z-index handling

---

### ~~TASK-116~~: Smart Group Drop Should Update Task Due Date Instantly (✅ DONE)
**Priority**: P1-HIGH
**Completed**: January 7, 2026

Moving a task to a smart group (Today, Tomorrow, This Week, etc.) now instantly updates the task's properties without requiring a page refresh.

**Problem Fixed**:
- User moved task to "Tomorrow" group but dueDate didn't update visually until refresh
- Hash-based watcher only watched `title:status:priority`, not `dueDate`
- NodeUpdateBatcher used 16ms delay for 'normal' priority updates

**Root Cause**:
The watcher in `CanvasView.vue` (line ~1835) only watched title, status, and priority changes. dueDate changes weren't triggering UI sync. Additionally, the batcher priority was 'normal' (16ms delay) instead of 'high' (instant).

**Fixes Applied**:
- [x] Added `dueDate` and `estimatedDuration` to hash-based watcher in CanvasView.vue
- [x] Changed batcher priority from 'normal' to 'high' for instant feedback
- [x] Added missing 'later' case to `moveTaskToSmartGroup` (clears dueDate)
- [x] Added 'duration' case to drag-drop handler for duration keywords (Quick, Short, Medium, Long)

**New Feature - Nested Group Inheritance**:
When dropping a task on a group that is inside another group, the task now receives properties from ALL containing groups.

Example: "High Priority" group inside "Today" group → task gets both `priority: high` AND `dueDate: today`

**Implementation**:
- [x] `getAllContainingSections()` - Finds all sections containing a point, sorted by size (largest first)
- [x] `getSectionProperties()` - Extracts properties from a single section (assignOnDrop, keyword detection, or legacy)
- [x] `applyAllNestedSectionProperties()` - Merges and applies properties from all containing sections
- [x] Console logs `🎯 [NESTED-GROUPS] Applying properties from X sections:` for debugging

**All Power Group Keywords Now Working**:
| Category | Keywords |
|----------|----------|
| Date | today, tomorrow, this weekend, this week, later |
| Priority | high, medium, low |
| Status | todo, active, done, paused |
| Duration | quick (15m), short (30m), medium (1h), long (2h), unestimated (0) |

**Files Changed**:
- `src/views/CanvasView.vue` - Watcher hash + priority
- `src/composables/canvas/useCanvasDragDrop.ts` - Nested groups + duration handler
- `src/stores/tasks/taskOperations.ts` - Added 'later' case

</details>

<details>
<summary><b>Rollback & Reference</b></summary>

**Stable Baseline**: `93d5105` (Dec 5, 2025)
**Tag**: `v2.2.0-pre-mytasks-removal`

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
</details>
