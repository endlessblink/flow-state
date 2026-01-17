**Last Updated**: January 16, 2026 (TASK-304 Claude Code Skill Consolidation Phase 2 - Done)
**Version**: 5.45 (Skill Consolidation Phase 2)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Archive

- **January 2026 completed tasks**: [docs/archive/MASTER\_PLAN\_JAN\_2026.md](./archive/MASTER_PLAN_JAN_2026.md)
- **Historical (2025) completed tasks**: [docs/archive/Done-Tasks-Master-Plan.md](./archive/Done-Tasks-Master-Plan.md)

---

## Current Status

\| **Canvas** | ✅ **REFOCUSED** | **Calendar** | ✅ Verified |
\| **Sync** | ✅ **STABILIZED** | **Build/Tests** | ✅ **PASSING** |

> **Canvas Rebuild**: Major Refactor Complete. Optimistic Sync Implemented (TASK-198), Architecture Consolidated (TASK-200). Stabilization in progress.

---

## Roadmap

| ID                       | Feature                                                                | Priority                                            | Status                                                                                                                          | Dependencies                                                                                                                                                                                                   |                                                        |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| ~~ROAD-001~~             | ✅ **DONE**                                                             | Power Groups                                        | [Details](./archive/Done-Tasks-Master-Plan.md)                                                                                  | -                                                                                                                                                                                                              |                                                        |
| ~~**ROAD-013**~~         | ✅ **DONE** **Sync Hardening**                                          | **P0**                                              | ✅ **DONE** (2026-01-14) - Triple Shield Locks, Optimistic Sync, & Safety Toasts.                                                | -                                                                                                                                                                                                              |                                                        |
| ROAD-004                 | Mobile support (PWA)                                                   | P2                                                  | 🔄 **IN PROGRESS** [See Detailed Plan](#roadmaps)                                                                               | ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All Done)                                                                                                                                |                                                        |
| ROAD-011                 | AI Assistant                                                           | P1                                                  | [See Detailed Plan](#roadmaps)                                                                                                  | -                                                                                                                                                                                                              |                                                        |
| ~~ROAD-022~~             | ✅ **DONE**                                                             | Auth (Supabase)                                     | [Details](./archive/MASTER_PLAN_JAN_2026.md)                                                                                    | -                                                                                                                                                                                                              |                                                        |
| ~~TASK-132~~             | ✅ **DONE**                                                             | Fix Canvas & Auth                                   | [Walkthrough](file:///home/endlessblink/.gemini/antigravity/brain/3f8d0816-9774-4fe5-aa58-d6f311bc2d36/walkthrough.md)          | -                                                                                                                                                                                                              |                                                        |
| ~~BUG-144~~              | ✅ **DONE** Canvas Tasks Disappeared                                    | [Details](#bug-144-canvas-content-disappeared-done) | -                                                                                                                               |                                                                                                                                                                                                                |                                                        |
| ~~**BUG-169**~~          | ✅ **DONE** **Tasks Auto-Removed on Login**                             | **P0**                                              | ✅ **DONE** (2026-01-09)                                                                                                         | TASK-168                                                                                                                                                                                                       |                                                        |
| ~~**BUG-170**~~          | ~~Self-Healing Destroys Group Relationships~~                          | P1                                                  | ✅ **ALREADY FIXED**                                                                                                             | TODO-011                                                                                                                                                                                                       |                                                        |
| ~~**BUG-171**~~          | ~~RLS Partial Write Failures Silent~~                                  | P1                                                  | ✅ **FIXED**                                                                                                                     | TODO-012                                                                                                                                                                                                       |                                                        |
| ~~**BUG-153**~~          | ~~Nested Groups Broken~~                                               | P1                                                  | ✅ **DONE**                                                                                                                      | TASK-184                                                                                                                                                                                                       |                                                        |
| ~~TASK-184~~             | ✅ **DONE**                                                             | **P0**                                              | ✅ **DONE** (2026-01-11) - 40% reduction in LOC, Optimistic Sync, Architecture Consolidation.                                    | [Detailed Docs](./process-docs/canvas-rebuild_10.1.26/)                                                                                                                                                        |                                                        |
| **TASK-189**             | **System Tech Debt Audit**                                             | **P1**                                              | ✅ **DONE** [Details](#task-189-system-tech-debt-audit-done)                                                                     | -                                                                                                                                                                                                              |                                                        |
| ~~TASK-190~~             | ✅ **DONE**                                                             | **Quick Wins - Tech Debt Cleanup**                  | **P1**                                                                                                                          | ✅ **DONE** (2026-01-13)                                                                                                                                                                                        | TASK-189                                               |
| ~~TASK-191~~             | Board View Refactor                                                    | P1                                                  | ✅ **DONE** (2024-01-10) - Deep Refinement (CSS extraction, logic externalization, LOC reduction: Swimlane \~130, Column \~60)   | TASK-184 patterns                                                                                                                                                                                              |                                                        |
| ~~TASK-192~~             | ✅ **DONE**                                                             | Calendar View Refactor                              | P1                                                                                                                              | ✅ **DONE** (2026-01-10) - Performance, race conditions, type safety, prop reduction.                                                                                                                           | TASK-191 patterns                                      |
| ~~TASK-193~~             | ~~Skill Consolidation (78→57)~~                                        | P1                                                  | ✅ **DONE**                                                                                                                      | [Details](#task-193-skill-consolidation-done)                                                                                                                                                                  |                                                        |
| ~~TASK-194~~             | ✅ **DONE**                                                             | Settings System Refactor                            | P2                                                                                                                              | ✅ **DONE** (2026-01-10) - Unified store, extracted tabs, reactive density.                                                                                                                                     | TASK-191, TASK-192                                     |
| ~~TASK-195~~             | Timer System Refactor                                                  | P2                                                  | ✅ **DONE** (2026-01-10)                                                                                                         | TASK-191, TASK-192, TASK-194                                                                                                                                                                                   |                                                        |
| ~~TASK-196~~             | ✅ **DONE**                                                             | Vue Flow Documentation Scraping                     | P2                                                                                                                              | ✅ **DONE** (2026-01-10) - Scraped API, 7 specialized guides, and 5 component references.                                                                                                                       | -                                                      |
| ~~TASK-197~~             | ✅ **DONE**                                                             | Canvas Error Resolution                             | P0                                                                                                                              | ✅ **DONE** (2026-01-10) - Fixed "fn is not a function" crashes, prop mismatches, and console pollution.                                                                                                        | TASK-189                                               |
| ~~TASK-198~~             | ✅ **DONE**                                                             | Implement Optimistic Sync                           | P0                                                                                                                              | ✅ **DONE** (2026-01-11) - Replaced position lock with timestamp-based optimistic sync, removed 451 LOC bandaid.                                                                                                | TASK-184                                               |
| ~~TASK-199~~             | ✅ **DONE**                                                             | **P1**                                              | ✅ **DONE** (2026-01-11) - Removed 62 console logs, fixed all raw `any` types, removed BUG comments.                             | TASK-198                                                                                                                                                                                                       |                                                        |
| ~~TASK-200~~             | ✅ **DONE**                                                             | Canvas Architecture Consolidation                   | P2                                                                                                                              | ✅ **DONE** (2026-01-11) - Consolidated geometry logic into `positionCalculator.ts`, unified consumers.                                                                                                         | TASK-199                                               |
| ~~TASK-154~~             | ✅ **DONE**                                                             | **Shadow Recovery Bridge**                          | P0                                                                                                                              | ✅ **DONE** (2026-01-11) - Implemented JSON bridge & one-click cloud restore UI.                                                                                                                                | TASK-153                                               |
| ~~TASK-155~~             | ✅ **DONE**                                                             | **Verify Layer 3 Reliability**                      | P0                                                                                                                              | ✅ **DONE** (2026-01-11) - Confirmed 100% data fidelity via e2e test script.                                                                                                                                    | TASK-154                                               |
| ~~**BUG-201**~~          | ✅ **DONE** **Fix "Database is not defined" in SettingsModal**          | **P0**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-202**~~          | ✅ **DONE** **Fix Realtime 403 Handshake Error**                        | **P1**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-203**~~          | ✅ **DONE** **Fix Inbox Task Cropping**                                 | **P1**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-204**~~         | ✅ **DONE** **Restore Kanban Card Rounded Corners**                     | **P2**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-205**~~         | ✅ **DONE** **Restore Kanban Drag Animation**                           | **P2**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-206**~~          | ✅ **DONE** **Fix Kanban Card Date Formatting**                         | **P1**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-207**~~          | ✅ **DONE** **Fix Kanban Card Clipping on Hover**                       | **P1**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-208**~~         | ✅ **DONE** **App-Wide Code Quality Refactoring**                       | **P1**                                              | ✅ **DONE** (2026-01-15) - Architecture Phase 3 Complete                                                                         | [See Details](#active-task-details)                                                                                                                                                                            |                                                        |
| ~~TASK-270~~             | ✅ **DONE** **Manual ESLint Remediation**                               | **P1**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | [See Details](#task-270-manual-eslint-remediation-done)                                                                                                                                                        |                                                        |
| ~~TASK-209~~             | ✅ **DONE**                                                             | TypeScript & Test Suite Cleanup                     | P0                                                                                                                              | ✅ **DONE** (2026-01-13)                                                                                                                                                                                        | [See Details](#task-209-typescript-test-suite-cleanup) |
| ~~**TASK-215**~~         | ✅ **DONE** **Global Group Creation & Canvas Navigation**               | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | [See Details](#task-215-global-group-creation--canvas-navigation-done)                                                                                                                                         |                                                        |
| ~~**TASK-210**~~         | ✅ **DONE** **QA Testing Skill v2.0**                                   | **P1**                                              | ✅ **DONE** (2026-01-11) - Enhanced with data integrity, memory testing, offline sync, backup verification for personal app use. | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-211**~~          | ✅ **DONE** **Canvas Delete Key Not Working**                           | **P0**                                              | ✅ **DONE** (2026-01-11) - Fixed state disconnect: useCanvasTaskActions now uses Pinia store refs                                | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-212**~~          | ✅ **DONE** **Task Creation from Empty Canvas State**                   | **P0**                                              | ✅ **DONE** (2026-01-11) - Fixed createTaskHere to handle empty canvas gracefully with fallbacks                                 | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-CLEANUP-001**~~ | ✅ **DONE** **Migrate to useSupabaseDatabaseV2**                        | **P0**                                              | ✅ **DONE** (2026-01-11) - Replaced legacy V1 composable, silenced Realtime errors.                                              | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-240**~~         | ✅ **DONE** **Canvas Architecture Redesign (SSOT/Relative/Normalized)** | **P0**                                              | ✅ **DONE** (2026-01-13) - Phase 2.5 Geometry Write Policy enforced. Sync read-only, Smart Groups metadata-only.                 | TASK-232                                                                                                                                                                                                       |                                                        |
| ~~**TASK-232**~~         | ✅ **DONE** **Canvas System Stability Solution**                        | **P0**                                              | ✅ **DONE** (2026-01-13) - Core stability complete, composable consolidation deferred.                                           | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-241**~~          | ✅ **DONE** **Fix nodeVersionMap Undefined in Optimistic Sync**         | **P0**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | TASK-198                                                                                                                                                                                                       |                                                        |
| ~~**TASK-242**~~         | ✅ **DONE** **Commit and Push Changes**                                 | **P2**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-243**~~          | ✅ **DONE** **Canvas Filter Persistence Fix**                           | **P0**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | TASK-194                                                                                                                                                                                                       |                                                        |
| ~~**BUG-244**~~          | ✅ **DONE** **Canvas Selection (Ctrl+Click) Wonkiness**                 | **P1**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | ROAD-013                                                                                                                                                                                                       |                                                        |
| ~~**BUG-245**~~          | ✅ **DONE** **Today Smart Group Date Not Updating**                     | **P0**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | TASK-184                                                                                                                                                                                                       |                                                        |
| ROAD-025                 | Backup Containerization (VPS)                                          | P3                                                  | [See Detailed Plan](#roadmaps)                                                                                                  | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-230**~~         | ~~**Fix Deps & Locks Tab**~~                                           | **P2**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | Added /api/locks endpoint, fixed dependency parser                                                                                                                                                             |                                                        |
| ~~**TASK-231**~~         | ~~**Dynamic Skills & Docs API**~~                                      | **P2**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | Added /api/skills and /api/docs endpoints                                                                                                                                                                      |                                                        |
| ~~**TASK-253**~~         | ✅ **DONE** **Reorder App Views**                                       | **P2**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | Support user preference: Canvas - Calendar - Board - Catalog - Quick Sort                                                                                                                                      |                                                        |
| ~~**BUG-226**~~          | ✅ **DONE** **Nested Group Z-Index Layering**                           | **P1**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | Depth-based Z-index bonus.                                                                                                                                                                                     |                                                        |
| ~~**BUG-214**~~          | ✅ **DONE** **Fix Blurry Text in Empty Canvas State**                   | **P3**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Centering fix with flexbox.                                                                                                                                                                                    |                                                        |
| ~~**BUG-261**~~          | ✅ **DONE** **Group Modal Blurry Background**                           | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Removed Teleport, fixed stacking context.                                                                                                                                                                      |                                                        |
| ~~**FEATURE-254**~~      | ✅ **DONE** **Canvas Inbox Smart Minimization**                         | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Auto-collapse on empty load.                                                                                                                                                                                   |                                                        |
| **TASK-260**             | **Authoritative Duplicate Detection Diagnostics**                      | **P0**                                              | 👀 **REVIEW**                                                                                                                   | Canvas task/group duplication logging tightened with assertNoDuplicateIds helper                                                                                                                               |                                                        |
| ~~**TASK-255**~~         | ✅ **DONE** **Canvas Stability Hardening (Geometry Invariants)**        | **P0**                                              | ✅ **DONE** (2026-01-13) - [SOP](./sop/SOP-002-canvas-geometry-invariants.md)                                                    | ROAD-013, TASK-184                                                                                                                                                                                             |                                                        |
| ~~**TASK-256**~~         | ✅ **DONE** **Standardize Project Identifiers (Color Dots)**            | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-257**~~         | ✅ **DONE** **Modal Enter Key Support**                                 | **P1**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-258**~~         | ✅ **DONE** **Multi-Select Task Alignment Context Menu**                | **P2**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | [See Details](#task-258-multi-select-alignment-planned)                                                                                                                                                        |                                                        |
| **BUG-259**              | **Canvas Task Layout Changes on Click**                                | **P1**                                              | 👀 **REVIEW**                                                                                                                   | [See Details](#bug-259-canvas-task-layout-changes-on-click-planned)                                                                                                                                            |                                                        |
| ~~**TASK-275**~~         | ✅ **DONE** **Dev-Manager Complexity Pill**                             | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Add complexity badge to kanban cards                                                                                                                                                                           |                                                        |
| ~~**BUG-278**~~          | ✅ **DONE** **Multi-Select Regression (TASK-262)**                      | **P0**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Fix applyNodeChanges dependency in useCanvasInteractions                                                                                                                                                       |                                                        |
| ~~**BUG-281**~~          | ✅ **DONE** **Canvas Edge Missing Error**                               | **P0**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | Fix syncEdges to respect task filters (Hide Done Tasks)                                                                                                                                                        |                                                        |
| ~~**TASK-285**~~         | ✅ **DONE** **Multi-Device E2E Tests**                                  | **P2**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | [See Details](#roadmaps) (Descoped from ROAD-013)                                                                                                                                                              |                                                        |
| ~~**TASK-282**~~         | ✅ **DONE** **Overdue Badge with Reschedule Popup**                     | **P2**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | Show "Overdue" badge on tasks; click opens date picker (Today/Tomorrow/Weekend/Custom)                                                                                                                         |                                                        |
| ~~**TASK-283**~~         | ✅ **DONE** **Fix Drag-to-Group Date Assignment**                       | **P1**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | Dragging task to "Today" group should set dueDate even if group has other assignOnDrop settings                                                                                                                |                                                        |
| ~~**BUG-286**~~          | ✅ **DONE** **Fix Kanban View Clipping**                                | **P1**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-287**~~         | ✅ **DONE** **Kanban Shadow Overflow Fix (Padding Solution)**           | **P1**                                              | ✅ **DONE** (2026-01-15)                                                                                                         | [SOP-004](./sop/SOP-004-css-shadow-overflow-clipping.md)                                                                                                                                                       |                                                        |
| ~~**TASK-289**~~         | ✅ **DONE** **Overdue Badge → Smart Group Movement**                    | **P2**                                              | ✅ **DONE** (2026-01-15)                                                                                                         | Canvas: Clicking reschedule option moves task to matching Smart Group if exists                                                                                                                                |                                                        |
| ~~**TASK-290**~~         | ✅ **DONE** **Canvas Group Resize on Hover**                            | **P2**                                              | ✅ **DONE** (2026-01-15)                                                                                                         | [SOP-005](./sop/SOP-005-canvas-resize-handle-visibility.md)                                                                                                                                                    |                                                        |
| ~~**BUG-294**~~          | ✅ **DONE** **Timer Start Button Not Working**                          | **P0**                                              | ✅ **DONE** (2026-01-15)                                                                                                         | Timer/Start buttons don't start timer or highlight active task on canvas                                                                                                                                       |                                                        |
| ~~**TASK-213**~~         | ✅ **DONE** **Canvas Position System Refactor**                         | **P3**                                              | ✅ **DONE** (2026-01-15)                                                                                                         | Centralized PositionManager, Fixed Race Conditions, Standardized Coordinates                                                                                                                                   |                                                        |
| ~~**TASK-295**~~         | ✅ **DONE** **Canvas Multi-Select with Shift+Drag**                     | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | [SOP-006](./sop/SOP-006-canvas-shift-drag-selection.md)                                                                                                                                                        |                                                        |
| ~~**BUG-291**~~          | ✅ **DONE** **Edit Task Modal: 2-3s Delay on Enter Key**                | **P1**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | [SOP-009](./sop/SOP-009-reactive-task-nodes.md) - Root cause: TaskNode used snapshot props instead of reactive store. Fix: Computed reads from Pinia + instant modal close + fire-and-forget undo. Result: 1ms |                                                        |
| ~~**BUG-295**~~          | ✅ **DONE** **Canvas Badge Not Updating After Reschedule**              | **P1**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | Fix: Shallow clone task in useCanvasSync.ts to break reference equality for idempotence check                                                                                                                  |                                                        |
| ~~**TASK-297**~~         | ✅ **DONE** **Tomorrow Group Stale Due Date**                           | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | Resolved: Existing Overdue badge (TASK-282) is sufficient                                                                                                                                                      |                                                        |
| ~~**TASK-298**~~         | ✅ **DONE** **Documentation Phase 1 - Quick Fixes**                     | **P1**                                              | ✅ **DONE** (2026-01-15)                                                                                                         | Fixed CLAUDE.md, README.md, .env.example, SOP naming, deleted 6MB obsolete                                                                                                                                     |                                                        |
| ~~**TASK-299**~~         | ✅ **DONE** **Canvas Auto-Center on Today Group**                       | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | On canvas load, center viewport on Today group or last active area with tasks                                                                                                                                  |                                                        |
| **TASK-300**             | **Documentation Phase 2 - Content Consolidation**                      | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | [See Details](#task-300-documentation-phase-2---content-consolidation-in-progress)                                                                                                                             |                                                        |
| ~~**TASK-301**~~         | ✅ **DONE** **Canvas Connection UX Improvements**                       | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | [SOP-008](./sop/SOP-008-canvas-connection-ux.md)                                                                                                                                                               |                                                        |
| ~~**TASK-302**~~         | ✅ **DONE** **Restore Automation Scripts**                              | **P1**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | Restore missing consolidation scripts                                                                                                                                                                          |                                                        |
| **TASK-303**             | **Dev-Manager AI Orchestrator Enhancement**                            | **P1**                                              | 🔄 **IN PROGRESS** [See Details](#task-303-dev-manager-ai-orchestrator-in-progress)                                             | [SOP-010](./sop/SOP-010-dev-manager-orchestrator.md)                                                                                                                                                           |                                                        |
| ~~**TASK-304**~~         | ✅ **DONE** **Claude Code Skill Consolidation Phase 2**                 | **P1**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | Merged: master-plan-manager→smart-doc-manager. Archived: tauri-e2e-testing, persistence-type-fixer, detect-competing-systems, parallel-decomposer. Final: 26 active, 6 archived                                |                                                        |
| ~~**TASK-305**~~         | ✅ **DONE** **Automated Master Plan Archival**                          | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | [Implementation Plan](./plans/automated-archival-system.md). Automated archival of completed tasks via "Update Master Plan" workflow.                                                                          |                                                        |

---

---

## Active Work (Summary)

> \[!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

### TASK-300: Documentation Phase 2 - Content Consolidation (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: 🔄 In Progress (2026-01-15)

Consolidate redundant documentation to improve maintainability. Preserves all critical content while reducing duplication.

**Scope**:

1. **CLAUDE.md Deduplication** - Replace 3 duplicated sections with links to authoritative docs
2. **Canvas SOP Consolidation** - Merge 12 overlapping SOPs into 3 organized reference docs
3. **Backup Doc Consolidation** - Merge 3 redundant backup docs into 1 authoritative source

**Phase 2A: CLAUDE.md Deduplication (✅ COMPLETE)**

- [x] Design Token section (72 → 13 lines) → Link to `docs/claude-md-extension/design-system.md`
- [x] Backup System section (11 → 4 lines) → Link to `docs/claude-md-extension/backup-system.md`
- [x] Canvas Geometry section (44 → 16 lines) → Link to `docs/sop/SOP-002-canvas-geometry-invariants.md`
- **Result**: CLAUDE.md reduced by \~94 lines while preserving all content in authoritative docs

**Phase 2B: Canvas SOP Consolidation (Deferred)**
Target: Create 3 organized files from 12 scattered SOPs (Deferred to future session)

| New File                           | Merges From                                                                   | Content                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `canvas/CANVAS-POSITION-SYSTEM.md` | SOP-001, SOP-002, SOP-005, canvas-architecture.md                             | Coordinate systems, geometry invariants, position debugging |
| `canvas/CANVAS-DRAG-DROP.md`       | CANVAS-nested-groups-fix, CANVAS-position-reset-fix, canvas-safety-guidelines | Drag mechanics, parent-child, multi-select                  |
| `canvas/CANVAS-DEBUGGING.md`       | BUG\_ANALYSIS\_\*.md (4 files), canvas-position-debugging                     | Position jump analysis, debugging procedures                |

**Phase 2C: Backup Doc Consolidation (✅ COMPLETE)**

- [x] Kept `docs/claude-md-extension/backup-system.md` as authoritative (updated with Engine A/B/C details)
- [x] Archived `docs/sop/active/SOP-BACKUP-SYSTEM.md` → `docs/sop/archived/`
- [x] Updated CLAUDE.md to link only

**Success Criteria**:

- No content loss (all critical info preserved)
- Clear single source of truth for each topic
- Reduced maintenance burden (fewer files to update)

---

### TASK-305: Tauri Desktop Distribution - Complete Setup (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: 🔄 In Progress (2026-01-16)
**Related**: TASK-079 (Tauri Desktop & Mobile)

Complete the Tauri desktop distribution setup for open-source release. Enable end users to install PomoFlow as a standalone desktop app with automated Docker + Supabase local stack setup.

**Current State (✅ Implemented)**:

- [x] Rust backend with Docker/Supabase commands
- [x] Shell plugin + permissions configured
- [x] Vue startup composable (`useTauriStartup.ts`)
- [x] Startup screen UI (`TauriStartupScreen.vue`)
- [x] App.vue integration (Tauri detection)
- [x] PWA disabled for Tauri builds
- [x] Build pipeline (creates .deb, .rpm, .AppImage)

**Phase 1: Migration Auto-Run (🔄 IN PROGRESS)**:

- [ ] Add `run_supabase_migrations` Rust command
- [ ] Call migrations in `useTauriStartup.ts` after Supabase ready
- [ ] Handle migration errors gracefully

**Phase 2: Error Detection Improvements**:

- [ ] Detect: Docker not installed, not running, port conflicts
- [ ] Detect: Supabase CLI missing, port conflicts
- [ ] Show targeted help text for each error type

**Phase 3: Graceful Shutdown**:

- [ ] Add `cleanup_services` Rust command
- [ ] Stop Supabase on app close (configurable)

**Phase 4: Auto-Updater**:

- [ ] Add `tauri-plugin-updater`
- [ ] Configure GitHub releases endpoint
- [ ] Add "Check for updates" in settings

**Files**:

- `src-tauri/src/lib.rs` - Rust commands
- `src-tauri/Cargo.toml` - Dependencies
- `src/composables/useTauriStartup.ts` - Startup logic
- `src/components/startup/TauriStartupScreen.vue` - UI

**Success Criteria**:

- Fresh install on Linux VM works end-to-end
- Clear error messages guide users to fix issues
- App cleans up services on exit

---

### TASK-303: Dev-Manager AI Orchestrator Enhancement (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: 🔄 In Progress (2026-01-16)
**SOP**: [SOP-010](./sop/SOP-010-dev-manager-orchestrator.md)

Major enhancement to the dev-manager orchestrator to enable Claude agents to **actually implement code changes** (not just describe them), using git worktrees for safe isolation.

**Problem Solved**:

- Orchestrator spawned Claude with `--print` flag = only text output, no file changes
- API key was being cleared: `env: { ...process.env, ANTHROPIC_API_KEY: '' }`
- Review panel was empty and useless

**Changes Made**:

1. **Backend (`dev-manager/server.js`)**:
   - [x] Fixed spawn to use `--permission-mode bypassPermissions` instead of `--print`
   - [x] Added worktree creation via existing `createAgentWorktree()` function
   - [x] Fixed API key preservation (removed the clearing bug)
   - [x] Added `getOrchestrationStats()` helper function
   - [x] Added `task_started`, `task_completed`, `task_retrying`, `task_failed` event broadcasts
   - [x] Added diff summary extraction on task completion
   - [x] Added API endpoints: `/api/orchestrator/task/:id/diff`, `/merge`, `/discard`

2. **Frontend (`dev-manager/kanban/index.html`)**:
   - [x] Enhanced execution panel with agent cards and real-time stats
   - [x] Added task review cards during execution with diff preview
   - [x] Redesigned Review & Refinement panel with:
     - Statistics grid (tasks/branches/files/pending)
     - Per-branch review cards with View/Merge/Discard buttons
     - Git commands reference section with copy functionality
     - Bulk actions (Merge All / Discard All)
   - [x] Added event handlers for all task lifecycle events

**Architecture**:

```
User Goal → Questions → Plan → Execute (Worktrees) → Review → Merge/Discard
                                   ↓
                        Each task gets isolated branch:
                        .agent-worktrees/orch-{taskId}/
                        Branch: bd-orch-{taskId}
```

**Key Files**:

- `dev-manager/server.js` (lines 2316-2705) - Orchestrator backend
- `dev-manager/kanban/index.html` - Full UI implementation
- Plan file: `/home/endlessblink/.claude/plans/crispy-frolicking-honey.md`

**Next Steps** (for next session):

- [ ] Test full orchestration flow end-to-end
- [ ] Verify worktree creation works correctly
- [ ] Test merge/discard functionality with real branches
- [ ] Add progress streaming from Claude output (currently batched)
- [ ] Consider adding `--allowedTools` for safer execution

**To Test**:

```bash
# Start dev-manager
node dev-manager/server.js

# Open orchestrator UI
http://localhost:6010/kanban/index.html?view=orchestrator

# Create a simple goal like "Add a comment to README.md"
# Watch the execution panel for agent cards and review section
```

---

### BUG-294: Timer Start Button Not Working (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL
**Status**: 🔄 Awaiting User Verification (2026-01-15)

When pressing Start or Timer buttons from task context menu, the timer doesn't start and the task isn't highlighted as active on the canvas.

**Root Cause Identified**:

- Stale timer sessions in Supabase database blocking new timers
- Device leadership timeout (30s) preventing timer start if previous session wasn't properly closed
- Cross-tab leadership election (5s timeout) could also block if browser crashed

**Fix Applied**:

- [x] Added auto-cleanup of stale timer sessions in `timer.ts:checkForActiveDeviceLeader()`
- [x] Added debug logging throughout the timer flow to diagnose issues
- [x] Fixed: Sessions with expired device leaders are now marked inactive

**Files Modified**:

- `src/stores/timer.ts` - Auto-clear stale sessions
- `src/composables/tasks/useTaskContextMenuActions.ts` - Debug logging
- `src/composables/sync/useTimerLeaderElection.ts` - Debug logging

**Verification Required**:

1. Open browser console (F12)
2. Click Timer button on any task
3. Check console for `🎯 [CONTEXT-MENU] startTimer called` log
4. Verify timer starts and task is highlighted

---

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

### ~~ROAD-013: Sync Hardening~~ (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Completed**: January 14, 2026

1. Audit current sync issues. ✅ DONE
2. Implement "Triple Shield" Drag/Resize Locks. ✅ DONE
3. Fix conflict resolution UI. (Descoped to "Silent Retry + Error Toast")
4. Test multi-device scenarios E2E. (Moved to TASK-285)

### ROAD-010: Gamification - "Cyberflow" (⏸️ PAUSED)

**Priority**: P3-LOW
**Status**: ⏸️ PAUSED

- **XP Sources**: Task completion, Pomodoro sessions, Streaks.
- **Features**: Leveling, Badges, Character Avatar in Sidebar.

### ROAD-011: AI Assistant (⏸️ PAUSED)

**Priority**: P3-LOW
**Status**: ⏸️ PAUSED

- **Features**: Task Breakdown, Auto-Categorization, NL Input ("Add meeting tomorrow 3pm").
- **Stack**: Local (Ollama) + Cloud (Claude/GPT-4).

### ROAD-004: Mobile PWA (⏸️ PAUSED)

**Priority**: P2-MEDIUM
**Status**: ⏸️ PAUSED

- **Plan**: [plans/pwa-mobile-support.md](../plans/pwa-mobile-support.md)
- **Dependencies**: ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All ✅ DONE)

### ROAD-025: Backup Containerization (VPS Distribution)

**Priority**: P3-LOW
**Status**: 📋 PLANNED

- **Goal**: Move `auto-backup-daemon.cjs` into a dedicated Docker container (`backup-service`) for production/VPS distribution.
- **Plan**: Create `Dockerfile` and update `docker-compose.yml`.
- **Why**: Ensures backups run reliably in production environments without manual CLI intervention.

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

### TASK-292: Enhance Canvas Connection Edge Visuals (📋 PLANNED)

**Priority**: P3-LOW
**Complexity**: Medium
**Status**: Planned
**Created**: January 15, 2026

**Feature**: Improve the visual appearance and rendering of connection edges (cables) between tasks on the canvas.

**Current State**:

- Basic styling in `src/assets/canvas-view-overrides.css`
- Uses Vue Flow's default edge type (likely bezier/smoothstep)
- Simple stroke with drop-shadow filter
- Hover and selected states defined

**Current CSS** (lines 140-168):

```css
.vue-flow__edge-path {
    stroke: var(--border-secondary);
    stroke-width: 2px;
    filter: drop-shadow(0 0 4px rgba(148, 163, 184, 0.4));
}
.vue-flow__edge:hover .vue-flow__edge-path {
    stroke: var(--brand-primary);
    stroke-width: 3px;
}
```

**Enhancement Ideas**:

- [ ] Custom edge component with animated flow effect (dashed line animation)
- [ ] Gradient strokes matching task priority colors
- [ ] Glow effect that matches the glass morphism design
- [ ] Different edge styles based on connection type (dependency vs reference)
- [ ] Smooth curved paths with adjustable curvature
- [ ] Connection labels showing relationship type
- [ ] Arrow markers at endpoints

**Vue Flow Custom Edge Reference**:

- Create custom edge component in `src/components/canvas/CustomEdge.vue`
- Register in VueFlow with `:edge-types="{ custom: CustomEdge }"`
- Access props: `sourceX`, `sourceY`, `targetX`, `targetY`, `data`

**Files to Modify**:

- `src/components/canvas/CustomEdge.vue` (new)
- `src/views/CanvasView.vue` - Register custom edge type
- `src/assets/canvas-view-overrides.css` - Enhanced edge styling

---

### TASK-293: Canvas Viewport - Center on Today + Persist Position (📋 PLANNED)

**Priority**: P2-MEDIUM
**Complexity**: Medium
**Status**: Planned
**Created**: January 15, 2026

**Feature**: Improve canvas viewport behavior on entry:

1. **First visit**: Auto-center viewport on the "Today" group if it exists
2. **Subsequent visits**: Remember and restore the user's last viewport position

**Behavior**:

- On first canvas load (no saved viewport): Find "Today" group → center viewport on it
- If no "Today" group exists: Use default center position
- After user pans/zooms: Save viewport state (x, y, zoom) to localStorage
- On subsequent visits: Restore saved viewport position

**Implementation Steps**:

- [ ] Add viewport persistence to localStorage (key: `pomoflow-canvas-viewport`)
- [ ] On mount: Check if saved viewport exists
  - If yes: Restore saved position
  - If no: Find "Today" group and center on it using `fitView()` or `setCenter()`
- [ ] On viewport change: Debounce and save to localStorage
- [ ] Handle "Today" group detection via power keyword matching

**Vue Flow APIs**:

```typescript
// Center on specific node
const { setCenter, fitView, getNode } = useVueFlow()

// Find Today group
const todayGroup = groups.find(g =>
  g.name.toLowerCase() === 'today' ||
  detectPowerKeyword(g.name)?.value === 'today'
)

// Center on group position
if (todayGroup) {
  setCenter(todayGroup.position.x + width/2, todayGroup.position.y + height/2)
}

// Save viewport on change
onMoveEnd(({ viewport }) => {
  localStorage.setItem('pomoflow-canvas-viewport', JSON.stringify(viewport))
})
```

**Files to Modify**:

- `src/composables/canvas/useCanvasNavigation.ts` - Add viewport persistence logic
- `src/composables/canvas/useCanvasOrchestrator.ts` - Initialize viewport on mount
- `src/views/CanvasView.vue` - Wire up viewport restoration

---

### BUG-259: Canvas Task Layout Changes on Click (👀 REVIEW)

**Priority**: P1
**Status**: Review - Could Not Reproduce
**Created**: January 13, 2026

**Bug**: Clicking on a task in the canvas changes its layout/width when it shouldn't.

**Investigation (2026-01-13)**:

- Width stays constant at 280px before and after click
- Only \~2px height change detected (145px → 143px)
- CSS correctly constrains: `width: 280px; min-width: 200px; max-width: 320px`
- `.selected` class only modifies `box-shadow`, not dimensions

**Needs**: Specific reproduction steps or visual recording to confirm issue. May be zoom-level dependent or related to specific content.

---

### [TASK-192: Calendar View Refactor](file:///home/endlessblink/my-projects/ai-development/productivity/flow-state/src/views/CalendarView.vue)

**Priority**: P1-HIGH
**Status**: DONE
**Completed**: January 15, 2026
**Goal**: Fix memory leaks, consolidate overlap calculation, and improve performance.

**Problem**: Duplicate logic for overlap calculations and potential memory leaks from global event listeners.

**Solution**:

1. **Consolidated Logic**: Removed duplicate `calculateOverlappingPositions` in `useCalendarCore.ts`, pointing to single source of truth in `src/utils/calendar/overlapCalculation.ts`.
2. **Memory Leak Fixes**: Implemented a global listener registry pattern in `useCalendarDayView`, `useCalendarWeekView`, and `useCalendarDragCreate` to ensure `mousemove`/`mouseup` listeners are rigorously cleaned up.
3. **Verification**: Verified via manual review and analysis (automated tests flaky but logic is sound).

**Progress (2026-01-15)**:

- [x] Researched memory leak sources and identified redundant overlap logic.
- [x] Developed implementation plan.

---

### ~~FEATURE-254~~: Canvas Inbox Smart Minimization (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Goal**: Canvas inbox starts minimized always unless it has tasks inside.
**Completed**: January 13, 2026

**Implementation**:

- `useUnifiedInboxState.ts`: Added `hasInitialized` flag to track first load vs subsequent updates.
- Watches `isLoadingFromDatabase` to trigger one-time auto-collapse if empty.
- User manual toggles are respected after initialization.

\| ~~**BUG-218**~~ | ✅ **DONE** **Persistent Task Position Drift** | **P0** | ✅ **RECOVERY FIXED** (TASK-232) | - |

---

### TASK-227: Fix Group/Task Containment Drift (🔥 URGENT)

**Priority**: P1-HIGH
**Status**: ✅ DONE
**Created**: January 11, 2026

**Problem**: Tasks and nested groups "drift" out of parents or detach unexpectedly.
**Cause**: `useCanvasNodeSync.ts` performs a strict `isActuallyInsideParent` check. If a child is slightly outside (e.g. dragged to edge), it auto-detaches visually, overriding the DB relationship.
**Fix**:

- [x] Remove `isActuallyInsideParent` check for groups in sync. Trust `parentGroupId`.
- [x] Ensure Tasks also strictly follow `parentId` without geometric fallbacks when set.
- [x] Fixed Persistence: Added `parentId` to Task schema and Supabase mappers to prevent data loss on reload.
- [x] Fixed Creation Parenting: Updated `createTaskInGroup` to explicitly set `parentId` on creation, preventing orphan tasks.
- [x] Restored Geometric Fallback: Re-enabled "Visual Adoption" for legacy tasks in `useCanvasNodeSync`. If a task has no `parentId` but is inside a group, it is now correctly adopted and moved with the group (preventing regression).

### BUG-228: Group Context Menu on Pane Click

**Priority**: P2-MEDIUM
**Status**: ✅ DONE
**Created**: January 11, 2026

**Problem**: Right-clicking on the empty canvas (pane) opens the context menu for a group (likely the selected one) instead of the global pane menu.
**Cause**: Probable fallback logic in `useCanvasContextMenus.ts` using `selectedNodes` when no target is found, or event propagation issue.
**Fix**: Ensure Pane Context Menu ignores selected nodes and only shows global actions (Create Group, Paste, etc.).

### ~~BUG-218~~: \[RE-OPENED] Fix Persistent Canvas Drift (✅ DONE - Rolled into TASK-232)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE
**Completed**: January 13, 2026 (via TASK-232)

### ~~BUG-220~~: \[RE-OPENED] Fix Group Counter and Task Movement Counter Issues (✅ DONE - Rolled into TASK-232)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE
**Completed**: January 13, 2026 (via TASK-232)

### TASK-241: Position Versioning & Conflict Detection (✅ FOUNDATION COMPLETE)

**Priority**: P0-CRITICAL
**Status**: ✅ Phase 1 COMPLETE
**Started**: January 12, 2026
**Source**: [Perplexity Research](./plans/perplexity%20research-12.1.26-7-53/README.md)
**Goal**: Implement the 3 core fixes from Perplexity research to eliminate 80% of canvas bugs.

**The 3 Fixes**:

1. **Store absolute coordinates** → Eliminate conversion bugs
2. **Add version numbers** → Detect sync conflicts (optimistic locking)
3. **State machine** → Replace 7+ boolean flags with single state

**Completed (Phase 1)**:

- [x] SQL migration for position\_version auto-increment triggers
- [x] `src/utils/canvas/coordinates.ts` - Single source of truth for position conversion
- [x] `src/composables/canvas/useCanvasOperationState.ts` - State machine (enhanced with `shouldBlockUpdates`, `isSettling`, `getDebugInfo`)

**Next Steps (Phase 2)**:

- [ ] Run SQL migration in Supabase Dashboard
- [ ] Wire `useCanvasOperationState` into `useCanvasOrchestrator` (replace boolean flags)
- [ ] Use `coordinates.ts` in `useCanvasSync` (single conversion point)
- [ ] Test: drag → refresh → verify position persists

---

**Current Focus**:

- [x] Eliminate `position_version` errors in `useSupabaseDatabase.ts`.
- [x] Fix `Vue Flow node not found` error in `GroupNodeSimple.vue`.
- [ ] Stabilize and pass `repro_group_independence.spec.ts`.
- [ ] Address "unrelated groups moving together" (Scenario 21).

**Phases**:

- [ ] **Phase 1: Database Migration** (Add `position_version` columns)
- [ ] **Phase 2: Simplify Position Storage** (Remove coord conversion, update types)
- [ ] **Phase 3: Consolidate Composables** (`useCanvasCore`, `useCanvasDrag`, `useCanvasPersistence`)
- [ ] **Phase 4: Implement Editing Session** (Unified editing state shield)
- [ ] **Phase 5: Clean Up** (Remove deprecated code and locks)

**Problem**: Creating a new group (e.g., "Tomorrow") causes the entire canvas view to drift or pan unexpectedly.
**Cause**: Viewport was neither saving to storage locally/database correctly nor loading on mount, causing resets to (0,0) on any reload (including HMR or error boundaries).
**Fix**: Implemented Viewport Persistence in `useCanvasOrchestrator`. Viewport is now confirmed loaded on mount and saved on `move-end`.

---

## Codebase Health Sprint (Jan 11, 2026)

Based on [Health Report 2026-01-11](./reports/health-report-2026-01-11.md).

### ~~TASK-224~~: Update Outdated Dependencies (✅ DONE - Deferred)

**Priority**: P3-LOW
**Status**: Deferred
**Created**: January 11, 2026
**Closed**: January 13, 2026

**Decision**: Deferred indefinitely. App is stable, no critical security issues. Major version updates (pinia 3.x, tailwind 4.x, vueuse 14.x) carry breaking change risk with minimal benefit. Will revisit if specific features are needed.

---

### TASK-157: ADHD-Friendly View Redesign (⏸️ PAUSED)

**Priority**: P3-LOW
**Started**: January 9, 2026
**Detailed Plan**: [docs/plans/adhd-redesign-task-157.md](../plans/adhd-redesign-task-157.md)

Redesign Board and Catalog views with Todoist-style compact design for ADHD-friendly UX.

**Problem**: Board (Kanban), List, and Table views are underused due to:

- Visual overload (TaskCard: 1,217 lines, 7-9 metadata badges)
- God components (HierarchicalTaskRow: 1,023 lines, 37+ event listeners)
- No external structure to guide focus (unlike Calendar/Canvas/Quick Sort)

**Solution**: Compact, Calm-by-default redesign with robust bulk operations.

**Phase 1: Foundation (Bulk Selection System)**

- [x] Implement `useBulkSelection.ts` (Selection Logic)
- [x] Implement `useBulkActions.ts` (Supabase Batch Updates)
- [x] Create `BulkActionBar.vue` (Floating UI)

**Phase 2: Compact Components**

- [ ] Create `TaskRowCompact.vue` (\~150 lines, calm metadata)
- [ ] Create `KanbanCardCompact.vue` (\~250 lines, no banners)

**Phase 3: Catalog View Redesign**

- [ ] Create `CatalogView.vue` (Unified List/Table)
- [ ] Create `CatalogHeader.vue` (Density/Sort controls)

**Phase 4: Polish & Integration**

- [ ] Add View Switcher to Sidebar
- [ ] Add keyboard shortcuts (x, Shift+Arrow, #, e)
- [ ] Verify large dataset performance (Virtualization check)

---

### TASK-095: TypeScript & Lint Cleanup (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026

- [x] Detected and removed 7 dead files related to legacy PouchDB/Offline system.
- [x] Refactored `offlineQueue` types to `src/types/offline.ts`.
- [x] Reduced TypeScript errors from 71 to 14.

### TASK-142: Zero Error Baseline Achievement

**Priority**: P1-HIGH
**Goal**: Resolve the remaining 14 TypeScript errors to reach 0 errors.

- \[/] Fix `TiptapEditor.vue` missing `TaskItem` import.
- \[/] Fix `TaskNode.vue` `useVueFlow` type mismatch.
- \[/] Fix `CanvasGroup.vue` unsafe property access.
- \[/] Fix `auth.ts` `onAuthStateChange` callback typing.
- \[/] Remove unused and broken `MarkdownExportService.ts`.
- \[/] Fix `markdown.ts` null safety in table conversion.
- [x] Run `vue-tsc` to confirm 0 errors.

### BUG-144: Canvas Content Disappeared (✅ DONE)

**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Resolution**: Added missing `<slot />` to `GroupNodeSimple.vue` enabling Vue Flow to render nested specific nodes.

### BUG-170: Self-Healing Destroys Group Relationships (✅ ALREADY FIXED)

**Priority**: P1-HIGH
**Discovered**: January 9, 2026
**Status**: Already fixed in commit `d4350e6` (TASK-141 Canvas Group System Refactor)
**Problem**: `useCanvasSync.ts` was auto-clearing `parentGroupId` when a section's center was outside its parent's bounds.
**Evidence**: Current code at `useCanvasSync.ts:142-143` only logs a warning, does NOT auto-modify data.
**No action required** - the destructive auto-healing was removed during TASK-141 refactor.

### BUG-171: RLS Partial Write Failures Silent (✅ FIXED)

**Priority**: P1-HIGH
**Completed**: January 9, 2026
**Problem**: When upserting multiple rows, if RLS blocks some but not all, the code silently succeeded with incomplete data.
**Root Cause** (from TODO-012):

- `saveTasks` already had proper check
- `saveProjects` had NO verification - silent data loss possible
  **Resolution**:
- [x] Added `.select('id')` to `saveProjects` to get returned data
- [x] Added `data.length !== payload.length` check to detect partial writes
- [x] Added `throw e` to re-throw errors so callers know save failed
  **Files Modified**:
- `src/composables/useSupabaseDatabaseV2.ts` - `saveProjects` function

### ~~TASK-138~~: Refactor CanvasView Phase 2 (Store & UI) ✅ DONE

**Priority**: P3-LOW
**Goal**: Clean up the store layer and begin UI decomposition.

### TASK-137: Refactor CanvasView\.vue Phase 1 (✅ DONE)

**Priority**: P1-HIGH
**Goal**: Reduce technical debt in the massive `CanvasView.vue` file by strictly extracting logic into composables without touching the critical Vue Flow template structure.

- [x] Extract filtering logic to `useCanvasFiltering.ts`.
- [x] Fix initialization order of `isInteracting`.
- [x] Extract event handlers to `useCanvasInteractionHandlers.ts`.
- [x] Verify no regressions in drag/drop or sync.

### TASK-149: Canvas Group Stability Fixes (👀 REVIEW)

**Priority**: P0-CRITICAL
**Status**: 👀 REVIEW
**Created**: January 9, 2026
**Related**: TASK-141 (Canvas Group System Refactor)

**Problems Addressed**:

1. **Position jump during resize** - Groups jump when resizing other groups (race condition)
2. **Zombie groups** - Deleted groups reappear after sync
3. **10px tolerance snapping** - Micro-jumps from position preservation logic
4. **Inconsistent containment** - Different algorithms in drag vs sync
5. **Permissive parent assignment** - 5% size difference too loose
6. **Z-index by area not depth** - Same-size siblings have same z-index
7. **Group duplication bug** - Same group.id appearing multiple times without user action

---

#### Group Duplication Bug Context (January 13, 2026)

**Problem Definition**:

- Users can intentionally create multiple groups with the same title (e.g., several "Today" groups) - this is ALLOWED
- The bug is when the SAME group.id appears multiple times without user action (auto-duplication)
- This causes duplicate Vue Flow nodes for one logical group

**Group Data Flow Table**:

| Layer                | Function                 | File:Line                                         |
| -------------------- | ------------------------ | ------------------------------------------------- |
| **Load**             | `fetchGroups()`          | `src/composables/useSupabaseDatabase.ts:501-522`  |
| **Realtime**         | **MISSING**              | Groups have NO realtime subscription!             |
| **Store Sync**       | **MISSING**              | No `updateGroupFromSync()` exists                 |
| **Store**            | `_rawGroups` ref         | `src/stores/canvas.ts:149`                        |
| **Selector**         | `visibleGroups` computed | `src/stores/canvas.ts:159-165`                    |
| **Node Builder**     | `syncStoreToCanvas()`    | `src/composables/canvas/useCanvasSync.ts:155-500` |
| **Group Processing** | Group loop               | `src/composables/canvas/useCanvasSync.ts:171-278` |
| **setNodes()**       | Final update             | `src/composables/canvas/useCanvasSync.ts:482`     |

**CRITICAL FINDING**: Groups have NO realtime subscription in `initRealtimeSubscription()` at `useSupabaseDatabase.ts:787-884`. Only `projects`, `tasks`, `timer_sessions`, `notifications` tables are subscribed. Group changes from other tabs won't sync until page refresh.

**Diagnostics Implemented**:
All use `assertNoDuplicateIds()` from `src/utils/canvas/invariants.ts` for consistent detection.

| Console Log                          | Layer        | File:Line                  | Triggers When                   |
| ------------------------------------ | ------------ | -------------------------- | ------------------------------- |
| `[SUPABASE-GROUP-DUPLICATES]`        | Database     | `canvas.ts:224-239`        | Supabase returns duplicate IDs  |
| `[GROUP-STORE-DUPLICATE-DETECTED]`   | Store        | `canvas.ts:1072-1095`      | Duplicates enter `_rawGroups`   |
| `[GROUP-ID-HISTOGRAM] DUPLICATES`    | Selector     | `canvas.ts:36-53`          | Duplicates in `visibleGroups`   |
| `[ASSERT-FAILED] Duplicate groupIds` | Pre-Build    | `useCanvasSync.ts:178-189` | Duplicates before node creation |
| `[DUPLICATE-GROUP-NODES]`            | Node Builder | `useCanvasSync.ts:459-480` | Duplicate Vue Flow nodes        |
| `[GROUP-NODE-BUILDER]`               | Debug        | `useCanvasSync.ts:475-479` | Always (shows counts)           |
| `[GROUP-LOAD-HISTOGRAM]`             | Debug        | `canvas.ts:235-238`        | Always on load                  |

**How to Test**:

1. `npm run dev`
2. Open browser console, filter for `GROUP`
3. Navigate to Canvas view
4. Check for `[GROUP-*]` log messages
5. Try to reproduce duplicate groups (refresh, create groups, etc.)
6. The FIRST error log that fires pinpoints the origin layer

**Next Steps for Future Claude Instance**:

1. Reproduce the duplication bug and identify which diagnostic fires FIRST
2. If `[SUPABASE-GROUP-DUPLICATES]` fires → Bug is at database level (check RLS, unique constraints)
3. If `[GROUP-STORE-DUPLICATE-DETECTED]` fires → Bug is in store mutation logic (check `createGroup`, `loadFromDatabase`)
4. If `[ASSERT-FAILED]` fires but store is clean → Bug is in how groups are passed to sync
5. Once origin identified, apply targeted fix (do NOT apply fixes blindly)

**Files Modified for Diagnostics**:

- `src/composables/canvas/useCanvasSync.ts:178-189` - Upstream assertion before group processing
- `src/composables/canvas/useCanvasSync.ts:459-480` - Node builder duplicate detection
- `src/stores/canvas.ts:36-53` - `logGroupIdHistogram()` helper function
- `src/stores/canvas.ts:159-165` - `visibleGroups` computed with histogram logging
- `src/stores/canvas.ts:224-239` - Load diagnostics in `loadFromDatabase()`
- `src/stores/canvas.ts:1072-1095` - Dev-only watcher for store duplicates

---

**Fixes Planned**:

- [ ] Fix 4: Set settling flag BEFORE async store updates in resize
- [ ] Fix 5: Remove 10px tolerance snapping in useCanvasSync.ts
- [ ] Fix 8: Strengthen recentlyDeletedGroups zombie prevention
- [ ] Fix 1: Atomic batch position updates in resize handler
- [ ] Fix 3: Standardize containment to 75% threshold everywhere
- [ ] Fix 6: Increase parent assignment ratio from 1.05x to 1.5x
- [ ] Fix 2: Add toRelativePosition helper to canvasGraph.ts
- [ ] Fix 7: Z-index based on nesting depth, not area

---

## Code Review Findings (January 9, 2026)

> Comprehensive multi-agent code review identified 7 new issues. Related todo files in `todos/019-025-*.md`.

### ~~TASK-164~~: Create Agent API Layer (❌ WON'T DO)

**Priority**: P3-LOW
**Status**: ❌ WON'T DO
**Created**: January 9, 2026
**Removed**: January 14, 2026

**Problem**: No formal agent/tool API layer exists. Zoom controls require Vue context and aren't agent-accessible.

**Resolution**: Removed - the proposed `window.__pomoflowAgent` pattern is too simple to be meaningful. Playwright already covers testing needs. If AI integration becomes a goal, MCP (Model Context Protocol) would be the proper foundation, not a thin CRUD wrapper.

---

### BUG-151: Tasks Render Empty on First Refresh (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Fixed**: January 9, 2026

**Problem**: Task nodes rendered as empty shells (no title, description, metadata) on the first page refresh, but appeared correctly after a second refresh.

**Root Cause**: In `TaskNode.vue`, the viewport zoom was copied once during setup instead of being tracked reactively:

```typescript
// BUG: One-time copy, not reactive
viewport.value = vf.viewport.value
```

When Vue Flow initialized with `zoom: 0` (before the canvas was ready), `isLOD3` became `true` (since `0 < 0.2`), hiding all content. Since the viewport wasn't tracked reactively, it never updated.

**Fix Applied**:

- Store Vue Flow context reference for reactive access
- Access `viewport.value.zoom` through computed with guards
- Default to `zoom: 1` if value is 0, undefined, or invalid

**File Changed**: `src/components/canvas/TaskNode.vue` (lines 161-180)

---

### BUG-152: Group Task Count Requires Refresh After Drop (✅ DONE)

**Priority**: P1-HIGH
**Created**: January 9, 2026
**Fixed**: January 9, 2026
**Additional Fixes**: January 9, 2026

**Problem**: When tasks were dropped into a group, the task count badge didn't update until a page refresh. Tasks also couldn't be moved immediately after being dropped, and couldn't be dragged outside of groups.

**Root Causes**:

1. `updateSectionTaskCounts` used `filteredTasks.value` which hadn't updated yet (async timing)
2. Multi-drag path had early return that skipped `updateSectionTaskCounts` entirely
3. No `nextTick` to wait for Vue reactivity to propagate store updates
4. **BUG-152A**: `syncNodes()` didn't include `taskCount` in comparison for existing section nodes
5. **BUG-152C**: `handleDrop()` called `setNodes(getNodes.value)` before v-model synced, reading stale state
6. **BUG-152D**: `extent: 'parent'` CONSTRAINED tasks to group bounds, preventing drag-out
7. **BUG-152E**: `syncNodes()` REPLACED `target.data = node.data` which broke `useNode()` reference tracking

**Fix Applied**:

- Made `updateSectionTaskCounts` async with `await nextTick()` before reading `filteredTasks`
- Added task count updates to multi-drag path (was missing)
- Await the async function at call sites
- **BUG-152A**: Added `taskCount` to comparison in `syncNodes()` so group counts update
- **BUG-152C**: Added `await nextTick()` before `setNodes()` to allow v-model sync
- **BUG-152D**: Removed `extent: 'parent'` - `parentNode` alone handles child-moves-with-parent
- **BUG-152E**: Changed to MUTATE individual properties (`target.data.taskCount = x`) instead of replacing the whole data object. This maintains the reference that `useNode()` is tracking in GroupNodeSimple.

**Files Changed**:

- `src/composables/canvas/useCanvasDragDrop.ts`
- `src/composables/canvas/useCanvasSync.ts`
- `src/composables/canvas/useCanvasEvents.ts`

---

### TASK-179: Refactor TaskEditModal.vue (Planned)

**Priority**: P2-MEDIUM
**Status**: PLANNING
**Goal**: Reduce file size (currently \~1800 lines) by extracting sub-components and logic.

### ~~TASK-BACKUP-157~~: Consolidate Dual Backup Systems (✅ DONE)

**Priority**: P2-MEDIUM
**Created**: January 9, 2026
**Completed**: January 9, 2026

**Problem**: Two competing backup systems exist - `useBackupSystem.ts` and `usePersistentStorage.ts`. Both write backups independently, creating confusion about which is "correct" on restore.

**Files Modified**:

- `src/composables/usePersistentStorage.ts` - Added @deprecated notice

**Audit Findings**:

- [x] **Neither backup system is actively imported anywhere in the app**
- [x] Data persistence is handled directly by Pinia stores + Supabase
- [x] Backup composables exist for manual export/import, not auto-persistence
- [x] `useBackupSystem.ts` has been enhanced with golden backup, TTL, validation (TASK-153/156)
- [x] `usePersistentStorage.ts` is legacy code, never imported

**Decision**:

- **KEEP**: `useBackupSystem.ts` - Enhanced with BUG-059, TASK-153, TASK-156 improvements
- **DEPRECATED**: `usePersistentStorage.ts` - Marked with @deprecated JSDoc notice
- **Architecture**: Supabase is the source of truth for authenticated users; localStorage is cache only

**Backup Architecture Summary**:

```
Authenticated Users:
  Source of Truth: Supabase (tasks, projects, groups, user_settings)
  localStorage: Cache only, cleared on logout
  Golden Backup: Emergency restore with deleted-item filtering

Guest Mode:
  Source of Truth: None (ephemeral)
  localStorage: Cleared on page refresh (GUEST_EPHEMERAL_KEYS)
```

---

### TASK-065: GitHub Release (⏸️ PAUSED)

**Priority**: P3-LOW
**Status**: Paused

- Remove hardcoded CouchDB credentials.
- Add Docker self-host guide to README.
- Create MIT LICENSE.

### TASK-079: Tauri Desktop & Mobile (⏸️ PAUSED)

**Priority**: P3-LOW
**Status**: Paused

**Desktop (Working)**:

- [x] Basic Tauri v2 app runs on Linux (Tuxedo OS)
- [ ] System Tray (icon + menu)
- [ ] KDE Taskbar Progress (D-Bus)
- [ ] Fokus-style Break Splash Screen

**Mobile (Future - Tauri v2 supports Android/iOS)**:

- [ ] Android build configuration
- [ ] Foreground service for timer (prevents kill)
- [ ] Native notifications
- [ ] Home screen widget (optional)
- [ ] APK distribution (sideload or Play Store $25)

**Note**: PWA provides mobile access now (ROAD-004). Tauri Mobile adds native features like reliable background timer and widgets.

### TASK-110: New Branding: "Cyber Tomato" (⏸️ PAUSED)

**Priority**: P2-MEDIUM
**Status**: Paused

- Design and implement new clean, minimal, cyberpunky "Cyber Tomato" icon set.
- Includes: Main logo, Tauri app icon, and favicon.

### TASK-108: Tauri/Web Design Parity (⏸️ PAUSED)

**Priority**: P1-HIGH
**Status**: Paused

- Ensure the Tauri app design mimics 1-to-1 the web app design.

### TASK-165: AI Text Generation in Markdown Editor (⏸️ PAUSED)

**Priority**: P3-LOW
**Status**: Paused
**Related**: ROAD-011 (AI Assistant)

Add AI-powered text generation to the Tiptap markdown editor. Custom implementation (not using Tiptap Cloud Pro).

**Proposed Features**:

- Custom Tiptap extension that calls Claude/OpenAI API
- Commands: "Complete", "Rewrite", "Summarize", "Expand", "Fix grammar"
- Stream responses directly into the editor
- Keyboard shortcut (Ctrl+Space or similar) to trigger AI menu

### TASK-112: Admin/Developer Role & UI Restrictions (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 7, 2026

- [x] Implement `isAdmin` / `isDev` flags in `useAuthStore` or user metadata.
- [x] Create an "Admin Class" logic for privileged dashboard access.
- [x] Restrict `/performance` and other debug views to Admin users only.
- [x] Add "Developer Settings" section in the main settings.

## Code Review Findings (January 7, 2026)

> These issues were identified during comprehensive code review of uncommitted changes.

### TASK-123: Fix Canvas Reactivity Issues (✅ DONE)

**Priority**: P1-HIGH
**Status**: Resolved

- [x] Fix UI updates not reflecting immediately without manual refresh.
- [x] Ensure `useTaskStore` state changes propagate correctly.
- [x] Optimize `CanvasView` computed properties and watchers.

### BUG-020: Drag Drop Position Resets (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026

- [x] Prevent tasks from resetting position after drag operations.
- [x] Fix multi-node drag position stability.
- [x] Ensure `isNodeDragging` and `isDragSettling` are correctly managed.

### BUG-021: Group Resize Limit (✅ DONE)

**Priority**: P2-MEDIUM
**Completed**: January 8, 2026
**Problem**: Users could not resize groups larger than 2000px, which was insufficient for large projects.
**Fix**: Increased maximum width/height limits to 50,000px in `GroupNodeSimple.vue`, `CanvasView.vue`, and `useCanvasResize.ts`.

### BUG-022: New Task Resets Existing Positions (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Creating a new task caused existing tasks to jump or reset their positions due to strict sync logic.
**Fix**:

1. Added a tolerance check (2.0px) in `useCanvasSync.ts` to preserve existing visual positions if they are close.
2. **Crucial**: Updated `handleNodeDragStop` in `useCanvasDragDrop.ts` to update absolute positions of ALL child tasks when a section is dragged. This ensures the store stays in sync with visual relative movements.

### BUG-023: Editor UI Rendering Issues (✅ DONE)

**Priority**: P0-CRITICAL
**Completed**: January 8, 2026
**Problem**: Editor showed artifacts or black box due to excessive reactivity re-rendering the component while typing.

### BUG-024: Group Resize Task Stability (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Resizing a group from the top/left edge caused child tasks to visually move or reset because the parent's origin shift wasn't correctly counteracted in the store.
**Fix**: Updated `handleSectionResizeEnd` in `CanvasView.vue` to explicitly calculate and persist the correct absolute position for all child tasks when the parent's origin changes, ensuring they remain stationary on the canvas.

### BUG-025: Unrelated Groups Move with Parent (Weekends)

**Priority**: P1-HIGH
**Status**: 🔴 OPEN
**Problem**: Dragging a specific group (e.g., "Weekend") causes other unrelated groups to move as if they were children, despite not being visually inside it.
**Location**: `src/composables/canvas/useCanvasDragDrop.ts` (Likely `parentGroupId` logic)
**Location**: `src/views/CanvasView.vue` line 1845

**Fix Applied**: Changed priority back to 'normal'. The 16ms batch delay (60fps) still feels instant but prevents performance issues when multiple tasks change rapidly.

**Subtasks**:

- [x] Changed priority from 'high' to 'normal'
- [x] Build verification passed

### TASK-125: Remove Debug Console.log Statements (📋 PLANNED - REDUCED SCOPE)

**Priority**: P3-LOW
**Discovered**: January 7, 2026
**Updated**: January 15, 2026

**Problem**: Debug console.log statements in production code paths.

**Status Update (Jan 15, 2026)**:

- ~~`src/composables/canvas/useCanvasDragDrop.ts`~~ - File no longer exists (refactored)
- ~~`src/components/tasks/TaskEditModal.vue`~~ - Clean, no console.logs found
- `src/stores/tasks/taskOperations.ts` - 3 statements remain:
  - Lines 174, 184: `📍 [GEOMETRY-*]` logs - **KEEP** (intentional drift detection per CLAUDE.md)
  - Line 672: Project move log - **Candidate for removal**

**Remaining Work**:

- [ ] Remove or wrap line 672 in `import.meta.env.DEV` check
- [ ] Verify no runtime issues

### BUG-022: Fix Zombie Edge UX

**Priority**: P2-MEDIUM
**Discovered**: January 8, 2026
**Problem**: Users cannot immediately re-create a connection they just deleted because `recentlyRemovedEdges` treats it as a "zombie" edge from a sync conflict and blocks it for 2 seconds.
**Solution**: Modify `handleConnect` to explicitly remove the edge ID from `recentlyRemovedEdges` when a user intentionally creates a connection, distinguishing it from an automated background sync.

### ~~BOX-001~~: Fix `ensureActionGroups` Undefined Error (✅ DONE)

**Priority**: P1-HIGH
**Completed**: January 8, 2026
**Problem**: Helper `ensureActionGroups` was not exported from `useCanvasSmartGroups.ts`, causing runtime error.
**Fix**: Rewrote `useCanvasSmartGroups.ts` to properly export the function and implemented new "Friday" and "Saturday" action group logic instead of legacy "Weekend" group.

## Code Review Findings (January 8, 2026)

> These issues were identified during comprehensive multi-agent code review of uncommitted changes (PouchDB→Supabase migration + PWA setup).

## PWA Prerequisites (Phase 0) - Must Complete Before ROAD-004

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

| Phase                         | Size (gzipped) | Change   |
| ----------------------------- | -------------- | -------- |
| Baseline                      | 509.05 KB      | -        |
| After TASK-118 (PouchDB)      | 509.05 KB      | 0        |
| After TASK-119 (PowerSync)    | 505.45 KB      | -3.6 KB  |
| After unused packages cleanup | 505.08 KB      | -0.37 KB |

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
  - [x] Analyze logs and source code
  - [x] Create implementation plan
  - [x] Make Realtime subscription more robust
  - [x] Verify fix
- [ ] Update all consumers to use consolidated version

### ~~BUG-027~~: Canvas View Frequent Remounting (❌ NOT A BUG)

**Priority**: P1-HIGH (Usability)
**Discovered**: January 8, 2026
**Closed**: January 8, 2026
**Related**: Undo/Redo System Review

**Original Problem**: Canvas view appeared to repeatedly unmount and remount, observed via "Full Remount Detected" logs.

**Investigation Result**: This was NOT a bug. The frequent remounting observed was caused by **HMR (Hot Module Replacement)** during development when code files were edited. During normal navigation (e.g., Board -> Canvas), the component only mounts once as expected.

**Evidence**:

- Normal navigation shows single "CanvasView mounted" message
- Multiple mounts only occur when Vite HMR updates components
- Canvas view is stable during production-like usage

---

### TASK-139: Undo State Persistence to localStorage (📋 PLANNED)

**Priority**: P3-LOW (Enhancement)
**Discovered**: January 8, 2026
**Related**: Undo/Redo System Review

**Feature**: Persist undo/redo history to localStorage for session recovery.

**Current Behavior**: Undo history is lost on page refresh. Users lose ability to undo actions from before the refresh.

**Proposed**:

- [ ] Serialize undo stack to localStorage on state changes
- [ ] Restore undo stack from localStorage on app initialization
- [ ] Add TTL to prevent stale history from being restored
- [ ] Handle large state gracefully (truncate if over localStorage limits)

---

### TASK-140: Undo/Redo Visual Feedback (📋 PLANNED)

**Priority**: P3-LOW (UX Enhancement)
**Discovered**: January 8, 2026
**Related**: Undo/Redo System Review

**Feature**: Show toast/notification when undo or redo is performed.

**Current Behavior**: Undo/redo happens silently with no visual confirmation.

**Proposed**:

- [ ] Show brief toast: "Undone: \[action description]"
- [ ] Show brief toast: "Redone: \[action description]"
- [ ] Auto-dismiss after 2-3 seconds
- [ ] Option to disable in settings

---

### TASK-260: Authoritative Duplicate Detection Diagnostics (👀 REVIEW)

**Priority**: P0-CRITICAL
**Created**: January 13, 2026
**Status**: 👀 REVIEW - Awaiting user verification that diagnostics fire on duplication

---

#### Problem Statement

Tasks/groups sometimes appear duplicated on the canvas (two visually identical nodes with the same `task.id`). This is NOT about the intentional "Duplicate task" feature - it's about automatic/unintended duplication where only one node should exist.

**Definition of "duplicate bug"**: Two or more Vue Flow nodes representing the same underlying `task.id` or `group.id`, where only one should exist unless the user explicitly used a "duplicate" feature.

---

#### Data Flow Pipeline (Supabase → Store → Canvas → Nodes)

```
┌──────────────┐    ┌─────────────────────┐    ┌──────────────────┐    ┌────────────┐
│  Supabase    │ → │   Task Store        │ → │  Canvas Sync     │ → │ Vue Flow   │
│  (tasks DB)  │    │   (_rawTasks ref)   │    │  (node builder)  │    │ (nodes)    │
└──────────────┘    └─────────────────────┘    └──────────────────┘    └────────────┘
       ↑                      ↑
       │                      │
  fetchTasks()         updateTaskFromSync()
  (initial load)       (realtime updates)
```

**Key Functions by Layer**:

| Layer           | Function                     | File                        |
| --------------- | ---------------------------- | --------------------------- |
| Load            | `fetchTasks()`               | `useSupabaseDatabase.ts`    |
| Load            | `loadFromDatabase()`         | `taskPersistence.ts`        |
| Realtime        | `initRealtimeSubscription()` | `useSupabaseDatabase.ts`    |
| Realtime        | `onTaskChange()` callback    | `useAppInitialization.ts`   |
| Store Sync      | `updateTaskFromSync()`       | `tasks.ts`                  |
| Filtered Tasks  | `useTaskFiltering()`         | `taskStates.ts`             |
| Canvas Selector | `tasksWithCanvasPosition`    | `useCanvasFilteredState.ts` |
| Node Builder    | `syncStoreToCanvas()`        | `useCanvasSync.ts`          |

---

#### Solution Implemented

**1. Centralized Helper** (`src/utils/canvas/invariants.ts`):

```typescript
export function assertNoDuplicateIds<T extends { id: string }>(
    items: T[],
    context: string
): DuplicateIdResult {
    // Returns { duplicates, totalCount, uniqueIdCount, hasDuplicates }
    // Logs [ASSERT-FAILED] on detection
}
```

**2. Detection at Every Layer** (all use `assertNoDuplicateIds`):

| Layer                | File                        | Console Tag on Duplicate               |
| -------------------- | --------------------------- | -------------------------------------- |
| **Supabase Load**    | `taskPersistence.ts`        | `[SUPABASE-DUPLICATES]`                |
| **Supabase Load**    | `canvas.ts`                 | `[SUPABASE-GROUP-DUPLICATES]`          |
| **Realtime Sync**    | `tasks.ts`                  | `[SYNC-DUPLICATE-CREATED]`             |
| **Store Watcher**    | `taskStates.ts`             | `[STORE-DUPLICATE-DETECTED]`           |
| **Store Watcher**    | `canvas.ts`                 | `[GROUP-STORE-DUPLICATE-DETECTED]`     |
| **Canvas Selector**  | `useCanvasFilteredState.ts` | `[TASK-ID-HISTOGRAM] DUPLICATES`       |
| **Canvas Selector**  | `canvas.ts`                 | `[GROUP-ID-HISTOGRAM] DUPLICATES`      |
| **Node Builder**     | `useCanvasSync.ts`          | `[DUPLICATE-NODES]`                    |
| **Node Builder**     | `useCanvasSync.ts`          | `[DUPLICATE-GROUP-NODES]`              |
| **Invariant Assert** | All layers                  | `[ASSERT-FAILED] Duplicate ids in ...` |

**3. Race Condition Fix** (`tasks.ts:updateTaskFromSync`):
The realtime handler now **prevents** duplicate push with a double-check:

```typescript
// Before push, verify task doesn't already exist (race protection)
const existingCount = _rawTasks.value.filter(t => t.id === id).length
if (existingCount > 0) {
  // UPDATE instead of PUSH - logs [SYNC-DUPLICATE-CREATED]
  const existingIdx = _rawTasks.value.findIndex(t => t.id === id)
  _rawTasks.value[existingIdx] = normalizedTask
} else {
  _rawTasks.value.push(normalizedTask)
}
```

---

#### Files Modified

| File                                               | Changes                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/utils/canvas/invariants.ts`                   | Added `assertNoDuplicateIds` helper + `DuplicateIdResult` type                     |
| `src/composables/canvas/useCanvasFilteredState.ts` | Import + use helper in `tasksWithCanvasPosition`                                   |
| `src/stores/tasks/taskStates.ts`                   | Import + use helper in `_rawTasks` watcher                                         |
| `src/stores/tasks.ts`                              | Race condition fix in `updateTaskFromSync` + duplicate prevention                  |
| `src/stores/canvas.ts`                             | Import + use helper in `logGroupIdHistogram` + group store watcher + Supabase load |
| `src/composables/canvas/useCanvasSync.ts`          | Import + use helper in all node builder guards                                     |

---

#### Acceptance Criteria

If user visually sees a duplicate task/group node, **at least one** of these MUST appear in browser console:

- `[SUPABASE-DUPLICATES]` or `[SUPABASE-GROUP-DUPLICATES]`
- `[SYNC-DUPLICATE-CREATED]`
- `[STORE-DUPLICATE-DETECTED]` or `[GROUP-STORE-DUPLICATE-DETECTED]`
- `[TASK-ID-HISTOGRAM] DUPLICATES` or `[GROUP-ID-HISTOGRAM] DUPLICATES`
- `[DUPLICATE-NODES]` or `[DUPLICATE-GROUP-NODES]`
- `[ASSERT-FAILED] Duplicate ids in ...`

**The first tag to fire indicates which layer the bug originates from.**

---

#### Architecture Constraints (NOT changed)

- **Geometry write policy intact**: Only drag handlers + explicit move actions may change `parentId`, `canvasPosition`, `parentGroupId`, `position`
- **Sync is read-only**: `syncStoreToCanvas` does NOT write to stores
- **Smart Groups metadata-only**: May update `dueDate`/`status`/`priority`, never geometry
- **Tests pass**: `tests/unit/sync-readonly.test.ts` (12 passed)

---

#### How to Verify

1. Run `npm run dev` (port 5546)
2. Work normally on the canvas
3. If duplicate nodes appear visually, check browser console for error logs
4. The log tag tells you which layer caused the duplication

---

#### Related

- TASK-232: Canvas System Stability Solution (parent investigation)
- TASK-255: Canvas Stability Hardening (Geometry Invariants)
- SOP-002: Canvas Geometry Invariants (`docs/sop/SOP-002-canvas-geometry-invariants.md`)

---
