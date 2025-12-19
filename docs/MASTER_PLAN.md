# Pomo-Flow Master Plan & Roadmap

**Last Updated**: December 19, 2025
**Version**: 5.0 (Strategic Roadmap: Personal Daily Driver)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Current Status

| Area | Status |
|------|--------|
| **Canvas** | Working - All 7 bugs fixed |
| **Calendar** | Partial - Resize/ghost preview issues remain |
| **CouchDB Sync** | Phases 1-4 complete, manual sync working |
| **Build** | Passing |
| **GitHub CI** | ✅ Active - Build verification on push/PR |

**Branch**: `master`

### CI/CD Setup (Dec 6, 2025)

**GitHub Actions workflow**: `.github/workflows/ci.yml`

| Check | Status | Notes |
|-------|--------|-------|
| `npm run build` | ✅ Active | Catches TS errors, broken imports, syntax issues |
| `npm run lint` | ✅ Ready | **0 ERRORS** achieved (Dec 18), can enable blocking |
| `npm run test` | ❌ Skipped | 90 failures (mostly Storybook) need fixing |

**Branch Protection**: Not enabled (solo developer, direct push workflow)

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

<!-- Active work items use TASK-XXX format -->

### ~~TASK-018~~: Canvas Inbox Filters (COMPLETE)
Dec 18, 2025 - Added Unscheduled, Priority, and Project filters to canvas inbox.
*Full details: [Archive](./archive/Done-Tasks-Master-Plan.md#task-018-canvas-inbox-filters-complete)*

---

### TASK-022: Task Disappearance Logger & Investigation (IN PROGRESS)

**Goal**: Create comprehensive logging system to track and debug mysteriously disappearing tasks (BUG-020).

**Priority**: P1-HIGH

**Started**: Dec 18, 2025

**Problem**: Tasks are randomly disappearing without user deletion - need to identify the source.

#### Analysis Complete

**Critical Task Removal Locations Identified** in `src/stores/tasks.ts`:

| Location | Risk | Code | Description |
|----------|------|------|-------------|
| Lines 918, 922, 926 | **HIGH** | `tasks.value = []` | Direct wipe to empty array |
| Line 229 | **HIGH** | `tasks.value = createSampleTasks()` | Replaces with sample data |
| Line 193 | MEDIUM | `tasks.value = loadedTasks` | PouchDB load overwrites |
| Lines 205, 218, 260 | MEDIUM | `tasks.value = backupTasks` | Backup restoration |
| Line 2826 | MEDIUM | `tasks.value = [...newTasks]` | Undo operation |
| Line 1769 | LOW | `tasks.value.splice(taskIndex, 1)` | Intentional deletion |

**Other Files with deleteTask**:
- `useCrossTabSyncIntegration.ts` - Overrides deleteTask for cross-tab sync
- `useUnifiedUndoRedo.ts` - Undo/redo wrapper
- Various components call `taskStore.deleteTask()`

#### Progress

| Step | Description | Status |
|------|-------------|--------|
| 1 | Create `taskDisappearanceLogger.ts` utility | ✅ DONE |
| 2 | Integrate logger into task store | ✅ DONE (Dec 19, 2025) |
| 3 | Add logging to all `tasks.value =` assignments | ✅ DONE (Dec 19, 2025) |
| 4 | Add logging to sync change handlers | ✅ DONE (Dec 19, 2025) |
| 5 | Add logging to cross-tab sync | ✅ DONE (Dec 19, 2025) |
| 6 | Monitor for 24-48 hours | **IN PROGRESS** (Started Dec 19) |
| 7 | Analyze logs and identify root cause | TODO |

#### Files Created

- `src/utils/taskDisappearanceLogger.ts` - Comprehensive logging utility

#### Files Modified (Dec 19, 2025)

- `src/stores/tasks.ts` - Added logger import and wrapped all `tasks.value =` assignments with `logArrayReplacement()`. Added `markUserDeletion()` before intentional deletes. Added `takeSnapshot()` after deletions.
- `src/composables/useCrossTabSync.ts` - Added logger import and wrapped delete/bulk_delete operations with `logArrayReplacement()`
- `src/main.ts` - Added auto-enable of logger on app startup (2 second delay for store init)

#### Logger Features

```typescript
// Enable monitoring (run in browser console)
window.taskLogger.enable()

// Check for disappeared tasks
window.taskLogger.getDisappearedTasks()

// Search for a specific task in history
window.taskLogger.findTaskInHistory("task title or id")

// Print summary
window.taskLogger.printSummary()

// Export logs for analysis
window.taskLogger.exportLogs()
```

#### Next Steps (for next session)

1. **Integrate into task store** - Add `takeSnapshot()` calls at all critical points:
   ```typescript
   // In tasks.ts, wrap all tasks.value assignments
   const oldTasks = [...tasks.value]
   tasks.value = newTasks
   taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'loadFromPouchDB')
   ```

2. **Hook into deleteTask** - Add `markUserDeletion()` before intentional deletes:
   ```typescript
   taskDisappearanceLogger.markUserDeletion(taskId)
   await deleteTask(taskId)
   ```

3. **Add to sync handlers** - Log when sync changes come in:
   ```typescript
   // In useReliableSyncManager.ts handleSyncChange
   taskDisappearanceLogger.takeSnapshot(tasks.value, 'sync-change-received')
   ```

4. **Enable by default temporarily** - Auto-enable on app load for monitoring

5. **Add data-task-count attribute** - For auto-monitoring:
   ```vue
   <div :data-task-count="tasks.length">...</div>
   ```

#### Rollback

```bash
# Remove logger if not needed
git checkout -- src/utils/taskDisappearanceLogger.ts
rm src/utils/taskDisappearanceLogger.ts
```

---

### TASK-024: Review Task Disappearance Logs (PLANNED)

**Goal**: After 24-48 hour monitoring period, analyze taskDisappearanceLogger data to identify root cause of BUG-020.

**Priority**: P1-HIGH

**Depends On**: TASK-022 Step 6 (monitoring period)

**Scheduled Review**: Dec 20-21, 2025

#### Steps

| Step | Description | Status |
|------|-------------|--------|
| 1 | Run `window.taskLogger.printSummary()` in browser console | TODO |
| 2 | Check `window.taskLogger.getDisappearedTasks()` for disappeared tasks | TODO |
| 3 | If tasks disappeared, analyze logs to identify source | TODO |
| 4 | Export logs with `window.taskLogger.exportLogs()` for documentation | TODO |
| 5 | Create fix based on findings | TODO |
| 6 | Remove auto-enable from `src/main.ts` once issue resolved | TODO |

#### Expected Outcomes

- If no tasks disappeared: BUG-020 may be intermittent or resolved
- If tasks disappeared: Stack traces will reveal the culprit code path
- Logger can be disabled once root cause is identified

---

### TASK-023: Dev-Manager Statistics/Analytics Dashboard (PLANNED)

**Goal**: Add a comprehensive Statistics tab to the Dev-Manager for project analytics and insights.

**Priority**: P2-MEDIUM

**Started**: Dec 18, 2025 (Planning phase)

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
| 1 | Design dashboard layout and charts | PLANNED |
| 2 | Create `dev-manager/stats/index.html` | PLANNED |
| 3 | Parse MASTER_PLAN.md for metrics | PLANNED |
| 4 | Implement chart visualizations (Chart.js or D3) | PLANNED |
| 5 | Add tab to dev-manager/index.html | PLANNED |
| 6 | Test with Playwright | PLANNED |

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

**Where We Stopped** (Dec 18, 2025 - Session 2):

#### KanbanSwimlane Streamlining (IN PROGRESS)
- **Stories reduced**: 7 → 2 stories (Default + ViewTypes), matching KanbanColumn format
- **CSS updated**: Dark glass morphism applied to swimlane headers and columns
- **⚠️ NEEDS MORE WORK**: KanbanSwimlane visual appearance still differs from KanbanColumn
  - KanbanColumn looks cleaner/more polished in Storybook
  - KanbanSwimlane needs visual refinement to match KanbanColumn's look

**🔴 NEXT SESSION - CONTINUE FROM HERE**:
1. Open both pages side-by-side:
   - KanbanColumn: `http://localhost:6006/?path=/docs/%E2%9C%A8-features-%F0%9F%93%8B-board-view-kanbancolumn--docs`
   - KanbanSwimlane: `http://localhost:6006/?path=/docs/%E2%9C%A8-features-%F0%9F%93%8B-board-view-kanbanswimlane--docs`
2. **ASK USER**: "What specific visual differences do you see between KanbanColumn and KanbanSwimlane that need fixing?"
3. Common areas that may need alignment:
   - Column header styling (borders, backgrounds, spacing)
   - Task card appearance within swimlanes
   - Empty state styling
   - Overall column/swimlane container borders/shadows

**Issues Encountered This Session**:
- Initial streamlining attempt had correct story count but wrong format
- Had to read KanbanColumn.stories.ts to understand exact structure expected
- Event handler syntax needed to be kebab-case (`@select-task` not `@selectTask`)

**Files Modified**:
- `src/stories/board/KanbanSwimlane.stories.ts` - Reduced to 2 stories, matched KanbanColumn format
- `src/components/kanban/KanbanSwimlane.vue` - CSS updated for dark glass morphism

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
- [ ] `ContextMenu.stories.ts`
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
- [ ] `TaskNode.stories.ts`
- [ ] `SectionManager.stories.ts`
- [ ] `SectionNodeSimple.stories.ts`
- [ ] `EdgeContextMenu.stories.ts`
- [ ] `ResizeHandle.stories.ts`
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
- [ ] `TaskContextMenu.stories.ts`
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

### TASK-020: Fix Unit Test Infrastructure (PLANNED)

**Goal**: Fix all blockers preventing unit tests from running in CI.

**Priority**: P3-LOW (code quality / CI improvement)

**Depends On**: None (can start anytime)

**Total Failures**: ~143 (121 circular deps + 13 CSS + 9 Vue imports)

| Category | Count | Description | Status |
|----------|-------|-------------|--------|
| Circular Dependencies | 121 | `useDatabase` ↔ `useReliableSyncManager` ↔ `localBackupManager` | TODO |
| CSS Syntax Errors | 13 | Mismatched parentheses in CSS variables | TODO |
| Vue Import Errors | 9 | Component import validation failures | TODO |
| Vitest/Storybook Conflict | 1 | Browser tests override include patterns | TODO |
| Playwright/Chai Compat | ~10 | Integration tests use wrong assertion library | TODO |

#### Blocker Details

**1. Circular Dependencies (121 failures)**
- **Root cause**: Three-way circular import between database composables
- **Files involved**:
  - `src/composables/useDatabase.ts`
  - `src/composables/useReliableSyncManager.ts`
  - `src/utils/localBackupManager.ts`
- **Fix approach**: Extract shared types/interfaces to separate file, use lazy imports, or restructure dependencies

**2. CSS Variable Syntax Errors (13 failures)**
- **Root cause**: Mismatched parentheses in CSS custom property definitions
- **Files to audit**: `src/assets/*.css`, component `<style>` blocks
- **Fix approach**: Run CSS linter, fix syntax errors

**3. Vue Import Validation Errors (9 failures)**
- **Root cause**: Components fail Vitest's Vue import validation
- **Fix approach**: Check component exports, ensure proper SFC structure

**4. Vitest/Storybook Integration Conflict**
- **Root cause**: Storybook browser tests (`*.stories.ts`) override Vitest include patterns
- **Workaround created**: `vitest.ci.config.ts` excludes Storybook files
- **Fix approach**: Use separate test configs for unit vs browser tests

**5. Playwright/Chai Compatibility (~10 failures)**
- **Root cause**: Integration tests use Playwright's `expect` but some assertions expect Chai syntax
- **Fix approach**: Standardize on Playwright assertions or add Chai compatibility

#### Implementation Steps

| Step | Description | Effort | Status |
|------|-------------|--------|--------|
| 1 | Audit and fix CSS syntax errors (13) | ~1h | TODO |
| 2 | Fix Vue import validation errors (9) | ~2h | TODO |
| 3 | Refactor circular dependencies (121) | ~4-8h | TODO |
| 4 | Update integration tests for Playwright assertions | ~2h | TODO |
| 5 | Enable unit tests in CI workflow | ~30min | TODO |
| 6 | Add E2E test step to CI (optional) | ~2h | TODO |

**Files to Modify**:
- `src/composables/useDatabase.ts` - Break circular dep
- `src/composables/useReliableSyncManager.ts` - Break circular dep
- `src/utils/localBackupManager.ts` - Break circular dep
- `src/assets/*.css` - Fix CSS syntax
- `.github/workflows/ci.yml` - Add test step
- `vitest.config.ts` - Ensure proper excludes

**Success Criteria**:
- [ ] `npm run test` passes with 0 failures
- [ ] CI runs unit tests on every push/PR
- [ ] No circular dependency warnings
- [ ] CSS validates without syntax errors

**Notes**:
- Can be done incrementally (fix one category at a time)
- CSS and Vue import fixes are quick wins
- Circular dependency fix is the largest effort
- E2E tests (Playwright) can be added as separate step after unit tests work

---

### TASK-021: Real-Time Cross-Instance Timer Sync (IN PROGRESS)

**Goal**: Make timer sync immediate and work across different browser instances/devices.

**Priority**: P1-HIGH (part of ROAD-013 Sync Hardening)

**Status**: 🟡 **IN PROGRESS** - Root cause identified, implementing fix

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
| 3 | Create `useTimerChangesSync.ts` composable | ~1h | 🟡 IN PROGRESS |
| 4 | Implement `db.changes()` listener with `doc_ids` filter | ~1h | TODO |
| 5 | Add proper cleanup (cancel on unmount) | ~30m | TODO |
| 6 | Add offline/reconnect handling | ~1h | TODO |
| 7 | Integrate into timer store | ~1h | TODO |
| 8 | Test cross-device sync scenarios | ~1h | TODO |

**File Changes Required**:

1. **NEW**: `src/composables/useTimerChangesSync.ts`
   - Direct PouchDB changes feed for timer document
   - Uses `doc_ids: ['pomo-flow-timer-session:data']` filter
   - Proper cleanup with `cancel()` method

2. **MODIFY**: `src/stores/timer.ts`
   - Import and use `useTimerChangesSync`
   - Replace `reliable-sync-change` listener with direct changes feed
   - Keep existing `handleRemoteTimerUpdate()` logic

**Success Criteria**:
- [ ] Timer starts on Device A → appears on Device B within 2 seconds
- [ ] Timer pause/resume syncs immediately
- [ ] Only one "leader" can control the timer at a time
- [ ] Graceful handling when offline
- [ ] Changes listener properly cleaned up on unmount

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
| BUG-016 | Timer status not syncing | P2-MEDIUM | **IN PROGRESS** Dec 18 - Cross-tab sync infrastructure added (timer.ts + useCrossTabSync.ts + CrossTabPerformance.ts), but leadership election conflict exists - auto-break starts override leader. |
| BUG-018 | Canvas smart group header icons cut off | P2-MEDIUM | TODO - Right-side icons overlap when group is narrow |
| BUG-019 | Canvas section resize preview mispositioned | P2-MEDIUM | TODO - Ghost preview shows wrong position during resize |
| BUG-020 | Tasks randomly disappearing without user deletion | P1-HIGH | **INVESTIGATING** Dec 18 - Logger utility created, needs integration |
| ~~BUG-021~~ | ~~Dev-Manager Skills/Docs tabs show black until manual refresh~~ | ~~P2-MEDIUM~~ | ✅ FIXED Dec 19, 2025 - Lazy loading iframes on first tab activation |

**Details**: See "Open Bug Analysis" section below.

#### BUG-018 & BUG-019: Canvas Smart Group UI Issues (Dec 18, 2025)

**BUG-018: Header Icons Cut Off**
- **Symptom**: When smart group (e.g., "Today") is narrow, right-side icons/buttons get cut off or overlap
- **Root Cause**: Header has 8+ flex items with `flex-shrink: 0`, competing for ~50px reserved space
- **Fix**: Wrap actions in overflow container with fade mask, allow name input to shrink

**BUG-019: Resize Preview Mispositioned**
- **Symptom**: Blue ghost preview appears at wrong location when resizing section from left/top edges
- **Root Cause**: `getSectionResizeStyle()` uses stale `section.position` from store instead of live NodeResizer position
- **Fix**: Track `currentX/currentY` in resizeState from `event.params.x/y` during resize

**Files**:
- `src/components/canvas/GroupNodeSimple.vue` (BUG-018)
- `src/views/CanvasView.vue` (BUG-019)

**Plan**: `/home/endlessblink/.claude/plans/wiggly-tumbling-fairy.md`

#### ~~BUG-021~~: Dev-Manager Force-Graph Iframe Issue (FIXED Dec 19, 2025)

**Problem**: Skills and Docs tabs in dev-manager showed black/empty until manual page refresh.

**Root Cause**: Force-graph library requires a container with visible dimensions. When iframes loaded but hidden (Kanban tab active by default), the container had zero dimensions causing the graph to not render properly.

**Solution**: Lazy loading iframes on first tab activation.

Instead of loading all iframes immediately with hidden tabs, the fix delays iframe `src` loading until the tab is first activated. This ensures the container is visible and has correct dimensions when the force-graph initializes.

**Fix Applied** (Dec 19, 2025):
1. Changed Skills/Docs iframes from `src="..."` to `data-src="..."` (lazy load)
2. Updated `switchTab()` in `dev-manager/index.html` to set `src` from `data-src` on first activation
3. Simplified Skills/Docs initialization code - removed failed `safeInit()` loop and message listeners

**Files Modified**:
- `dev-manager/index.html` - Lines 194-200 (lazy iframe markup), 233-239 (switchTab logic)
- `dev-manager/skills/index.html` - Lines 634-641 (simplified init)
- `dev-manager/docs/index.html` - Lines 659-666 (simplified init)

**Verification**: Tested with Playwright - Skills graph renders 69 skills, Docs shows 46 active/65 archived docs on first tab activation.

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
| BUG-009 | Ghost preview wrong location | MEDIUM | TODO |
| BUG-010 | Resize creates artifacts | HIGH | TODO |
| BUG-011 | Resize broken (both sides) | HIGH | TODO |
| ~~BUG-017~~ | ~~30-minute tasks display issues~~ | ~~HIGH~~ | ✅ FIXED Dec 18, 2025 |

**SOP**: `docs/debug/sop/calendar-drag-inside-calendar/`

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
| BUG-016 | Timer sync across tabs | P2-MEDIUM |
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
| BUG-009-011 | Calendar resize/ghost issues | ~4h | Non-blocking |

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
| 13.2 | Fix timer sync across tabs (BUG-016) | IN PROGRESS - Infrastructure done, leadership conflict remains |
| 13.3 | Improve conflict resolution UI | PENDING |
| 13.4 | Add sync status indicator improvements | PENDING |
| 13.5 | Test multi-device scenarios E2E | PENDING |

**Critical Files**:
- `src/composables/useReliableSyncManager.ts`
- `src/composables/useCouchDBSync.ts`
- `src/composables/useCrossTabSync.ts`
- `src/config/database.ts`

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
