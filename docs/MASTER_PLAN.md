**Last Updated**: January 22, 2026 (TASK-369 Quick Capture Tab Feature)
**Version**: 5.55 (Quick Capture Tab)
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
| ROAD-004                 | Mobile support (PWA)                                                   | P2                                                  | ✅ **DONE** (2026-01-19) - Phase 2 Complete (VPS & Reload Prompt)                                                                | ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~, ~~TASK-324~~, ~~TASK-325~~, ~~TASK-326~~ |                                                        |
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
| ~~**TASK-300**~~         | ✅ **DONE** **Documentation Phase 2 - Content Consolidation**          | **P1**                                              | ✅ **DONE** (2026-01-18)                                                                                                         | [See Details](#task-300-documentation-phase-2---content-consolidation-in-progress)                                                                                                                             |                                                        |
| ~~**TASK-301**~~         | ✅ **DONE** **Canvas Connection UX Improvements**                       | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | [SOP-008](./sop/SOP-008-canvas-connection-ux.md)                                                                                                                                                               |                                                        |
| ~~**TASK-302**~~         | ✅ **DONE** **Restore Automation Scripts**                              | **P1**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | Restore missing consolidation scripts                                                                                                                                                                          |                                                        |
| **TASK-303**             | **Dev-Manager AI Orchestrator Enhancement**                            | **P1**                                              | 🔄 **IN PROGRESS** [See Details](#task-303-dev-manager-ai-orchestrator-in-progress)                                             | [SOP-010](./sop/SOP-010-dev-manager-orchestrator.md)                                                                                                                                                           |                                                        |
| ~~**TASK-304**~~         | ✅ **DONE** **Claude Code Skill Consolidation Phase 2**                 | **P1**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | Merged: master-plan-manager→smart-doc-manager. Archived: tauri-e2e-testing, persistence-type-fixer, detect-competing-systems, parallel-decomposer. Final: 26 active, 6 archived                                |                                                        |
| ~~**TASK-305**~~         | ✅ **DONE** **Automated Master Plan Archival**                          | **P2**                                              | ✅ **DONE** (2026-01-16)                                                                                                         | [Implementation Plan](./plans/automated-archival-system.md). Automated archival of completed tasks via "Update Master Plan" workflow.                                                                          |                                                        |
| ~~**BUG-311**~~          | ✅ **DONE** **Fix Vite Module Loading & Startup Loop**                  | **P0**                                              | ✅ **DONE** (2026-01-17)                                                                                                         | Resolved circular dependencies in `spatialContainment.ts` and `stores/canvas`. Fixed type errors in `CanvasView.vue`.                                                                                                          |                                                        |
| ~~**TASK-312**~~         | ✅ **DONE** **TaskRowDueDate Dropdown Component**                       | **P2**                                              | ✅ **DONE** (2026-01-17)                                                                                                         | Created TaskRowDueDate.vue with standardized dropdown (Today/Tomorrow/In 3 days/In 1 week/No due date). Updated TaskRow.vue and HierarchicalTaskRowContent.vue.                                                                |                                                        |
| ~~**TASK-314**~~         | ✅ **DONE** **Highlight Active Timer Task**                             | **P2**                                              | ✅ **DONE** (2026-01-18)                                                                                                         | Active timer task now highlighted in Board and Catalog views                                                                                                                                                    |                                                        |
| ~~**TASK-315**~~         | ✅ **DONE** **Documentation & Skills Consolidation**                    | **P1**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | [SOP-012](./sop/active/SOP-012-skills-config-sync.md) - Synced skills.json (10→30), created canvas index, doc validator, staleness checker                                                                      |                                                        |
| ~~**TASK-316**~~         | ✅ **DONE** **TaskCard Design Fix (Board View)**                        | **P3**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Changed selected state from filled to outline-only, removed strikethrough from completed titles. File: `TaskCard.css`                                                                                           |                                                        |
| ~~**TASK-317**~~         | ✅ **DONE** **Shadow Backup Deletion-Aware Restore + Supabase Data Persistence**   | **P0**                                              | ✅ **DONE** (2026-01-19)                                                                                                        | Tombstones table, deletion-aware restore, shadow-mirror guards, atomic writes                                                                                                                                       |                                                        |
| ~~**BUG-317**~~          | ✅ **DONE** **Board View Priority Column Drag Fix**                     | **P1**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Fixed priority swimlane drag: `columnType` prop distinguishes status vs priority columns                                                                                                                        |                                                        |
| ~~**TASK-318**~~         | ✅ **DONE** **Tauri Standalone Build Verified**                         | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Built standalone packages: `.deb`, `.rpm`, `.AppImage` for Linux                                                                                                                                                |                                                        |
| **TASK-319**             | **Fix Agent Output Capture in Orchestrator**                           | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-319-fix-agent-output-capture-in-orchestrator-planned) - TASK-303 subtask                                                                                                                    |                                                        |
| **TASK-320**             | **Fix Task Completion Detection in Orchestrator**                      | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-320-fix-task-completion-detection-in-orchestrator-planned) - TASK-303 subtask                                                                                                               |                                                        |
| **TASK-321**             | **Test and Fix Merge/Discard Workflow E2E**                            | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-321-test-and-fix-mergediscard-workflow-end-to-end-planned) - TASK-303 subtask                                                                                                               |                                                        |
| **TASK-322**             | **Add Automatic Error Recovery for Orchestrator**                      | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-322-add-automatic-error-recovery-for-orchestrator-agents-planned) - TASK-303 subtask                                                                                                        |                                                        |
| **TASK-323**             | **Fix Stale Agent Cleanup in Orchestrator**                            | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-323-fix-stale-agent-cleanup-in-orchestrator-planned) - TASK-303 subtask                                                                                                                     |                                                        |
| ~~**TASK-324**~~         | ✅ **DONE** **PWA Install Prompt Component**                                       | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | [Walkthrough](file:///home/endlessblink/.gemini/antigravity/brain/62e1538b-8b24-4393-965e-f11ae95f2523/walkthrough.md)                                                                                          |                                                        |
| ~~**TASK-325**~~         | ✅ **DONE** **VPS Deployment Configuration**                                       | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | [SOP-VPS](./sop/deployment/VPS-DEPLOYMENT.md)                                                                                                                                                                  |                                                        |
| ~~**TASK-326**~~         | ✅ **DONE** **PWA Cross-Device Testing**                                           | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Verified SW & Manifest via Lighthouse                                                                                                                                                                          |                                                        |
| ~~**TASK-327**~~         | ✅ **DONE** **Create Custom Tauri App Icon**                      | **P1**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | Cyberpunk glitch tomato icon. Fixed cropping issue (resize to fit 500x500, center in 512x512). Generated all sizes: ICO, ICNS, PNG, favicon.                                                                    |                                                        |
| ~~**TASK-329**~~         | ✅ **DONE** **Auth & Data Persistence Hardening**                       | **P0**                                              | ✅ **DONE** (2026-01-20)                                                                                                         | [Crisis Report](../reports/2026-01-20-auth-data-loss-analysis.md) - Fixed seed.sql, NULL columns, password change UI                                                                                            |                                                        |
| **TASK-330**             | **Shadow-Mirror Reliability & Automation**                             | **P0**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#january-20-2026-data-crisis--system-stabilization) - Automatic runs & monitoring                                                                                                                 |                                                        |
| **TASK-331**             | **Tauri Multi-App Migration (LocalStorage)**                          | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#january-20-2026-data-crisis--system-stabilization) - Migrate from com.pomoflow.desktop to com.flowstate.app                                                                                     |                                                        |
| **TASK-332**             | **Backup Reliability & Verification**                                  | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#january-20-2026-data-crisis--system-stabilization) - Golden backup rotation, validation tests, fix Tauri dialog                                                                                  |
| **BUG-333**              | **Duplicate Tasks After Restore + Login**                              | **P0**                                              | 🔄 **IN PROGRESS**                                                                                                              | [Crisis Report](../reports/2026-01-20-auth-data-loss-analysis.md) - 109 tasks, 64 unique titles. Login sync merged localStorage + Supabase without deduplication                                                 |                                                        |
| **TASK-334**             | **AI "Done" Claim Verification System (5-Layer Defense)**              | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | [See Details](#task-334-ai-done-claim-verification-system-in-progress) - Hooks + Judge Agent in Dev-Maestro                                                                                                      |                                                        |
| **TASK-335**             | **Judge Agent Integration in Dev-Maestro**                             | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-335-judge-agent-integration-in-dev-maestro-planned) - Layer 5 of TASK-334                                                                                                                    | TASK-334                                               |
| ~~**BUG-336**~~          | **Fix Backup Download in Tauri App**                                   | **P0**                                              | ✅ **DONE**                                                                                                                     | Fixed: PWA plugin stub modules, TAURI_DEV env var, xdg-portal dialog                                                                                                                                              |                                                        |
| ~~**TASK-337**~~         | ✅ **DONE** **Reliable Password Change Feature**                       | **P0**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed template logic, null checks, session refresh. Tested: user signup, password change, logout, re-login with new password.                                                                                    |                                                        |
| **TASK-338**             | **Comprehensive Stress Testing Agent/Skill**                           | **P0**                                              | 🔄 **IN PROGRESS**                                                                                                              | [See Details](#task-338-comprehensive-stress-testing-agentskill-in-progress) - Reliability, backup, container stability, redundancy assessment                                                                   |                                                        |
| **BUG-339**              | **Tauri App Auto-Signout + Data Loss Concern**                         | **P0**                                              | 👀 **REVIEW**                                                                                                                   | Auth protections verified: proactive refresh, retry with backoff, session persistence. [See Details](#bug-339-auth-reliability---tauri-signouts--password-failures-review)                                        |                                                        |
| ~~**BUG-340**~~          | ✅ **DONE** **Tauri Modal Not Closing After Sign-In**                  | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed: Added `nextTick()` + `flush: 'post'` to AuthModal watcher for Tauri WebView reactivity. **User verified.** File: `AuthModal.vue`                                                                             |                                                        |
| **BUG-341**              | **Tauri App Freezing - Add Comprehensive Logging**                     | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Add logging/diagnostics to debug Tauri app freezing/crash issues. Research solutions online.                                                                                                                      |                                                        |
| **BUG-342**              | **Canvas Multi-Drag Bug: Unselected Tasks Move Together**              | **P0**                                              | 🔄 **IN PROGRESS**                                                                                                              | Dragging one task causes another unselected task to move with it                                                                                                                                                  |                                                        |
| **TASK-345**             | **PWA Infrastructure: Docker & Reliable HTTPS Tunnel**                 | **P2**                                              | ✅ **DONE** (2026-01-20)                                                                                                         | Set up Dockerized stack, Caddy proxy, and Cloudflare Tunnel for stable remote testing.                                                                                                                            |                                                        |
| ~~**TASK-346**~~         | ✅ **DONE** **Mobile-Specific UI: Feature Subset & Touch Navigation**  | **P1**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | MobileTodayView, MobileInboxView (filter chips + quick-add), 4-tab nav. [SOP-013](./sop/SOP-013-cloudflare-tunnel-supabase.md), [SOP-014](./sop/SOP-014-tauri-supabase-detection.md)                              |                                                        |
| **BUG-347**              | **Fix FK Constraint Violation on parent_task_id**                      | **P1**                                              | 👀 **REVIEW**                                                                                                                   | Sync errors when parent task deleted. Fix: Catch-and-retry clears orphaned parent refs. [See Details](#bug-347-fix-fk-constraint-violation-on-parent_task_id-review)                                              |                                                        |
| ~~**TASK-348**~~         | ✅ **DONE** **Tauri Startup Guide & Shadow Mirror Fix**                | **P2**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | [SOP-015](./sop/SOP-015-tauri-startup-guide.md) - Fixed shadow-mirror.cjs relative URL detection, documented startup methods                                                                                      |                                                        |
| **BUG-352**              | **Mobile PWA "Failed to Fetch"**                       | **P0**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#bug-352-mobile-pwa-failed-to-fetch-persistent-cache) - Likely SW cache issue                                                                                                                                     |                                                        |
| **TASK-351**             | **Secure Secrets (Doppler)**                           | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-351-secure-secrets-management-doppler)                                                                                                                                                                      |
| ~~**TASK-353**~~         | ✅ **DONE** **Mobile PWA UI Phase 1**                  | **P1**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | MobileTodayView (daily schedule), MobileInboxView (filter chips, sort, quick-add bar), MobileNav (4 tabs), Mobile PWA design skill                                                                                |                                                        |
| ~~**TASK-354**~~         | ✅ **DONE** **Canvas CSS Import Fix**                  | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed canvas not rendering after CSS import change. Reverted ES import to `<style src="">` for global Vue Flow overrides.                                                                                          |                                                        |
| ~~**BUG-355**~~          | ✅ **DONE** **Timer Beep/Reset on Reload**             | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed timer beeping on reload when no timer was active. Added stale session detection (>1hr) and silent completion for expired sessions.                                                                           |                                                        |
| ~~**BUG-356**~~          | ✅ **DONE** **Groups Moving Together (Accidental Nesting)**             | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed groups incorrectly moving together when dragging. Root cause: corrupted parentGroupId relationships. Added: (1) 2x area ratio requirement for group nesting, (2) invalid parent cleanup on load, (3) `resetGroupsToRoot()` emergency fix. [SOP-018](./sop/SOP-018-canvas-group-nesting.md)                                                                           |                                                        |
| **BUG-357**              | **Tauri Edit Modal Shows Wrong Task**                                   | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | [See Details](#bug-357-tauri-edit-modal-shows-wrong-task-in-progress) - Fixed stale Vue Flow node data issue                                                                                                      |                                                        |
| **BUG-359**              | **Task List Checkbox Clipped in Edit Modal**                            | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | TipTap task list checkbox not visible/cut off on right side of description editor                                                                                                                                 |                                                        |
| **BUG-360**              | **Ctrl+Z Undo Not Working in Quick Sort View**                          | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Undo (Ctrl+Z) not functioning correctly in the Quick Sort view                                                                                                                                                    |                                                        |
| **TASK-361**             | **Stress Test: Container Stability**                                    | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Docker/Supabase restart resilience tests                                                                                                                                                                          | TASK-338                                               |
| **TASK-362**             | **Stress Test: Sync Conflict Resolution**                               | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Race condition and conflict resolution tests                                                                                                                                                                      | TASK-338                                               |
| **TASK-363**             | **Stress Test: Auth Edge Cases**                                        | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Expired token, session timeout, concurrent session tests                                                                                                                                                          | TASK-338                                               |
| **TASK-364**             | **Stress Test: WebSocket Stability**                                    | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Realtime reconnection stress tests                                                                                                                                                                                | TASK-338                                               |
| **TASK-365**             | **Stress Test: Actual Restore Verification**                            | **P0**                                              | 📋 **PLANNED**                                                                                                                  | Test actual backup restore functionality (not just file existence)                                                                                                                                                | TASK-338                                               |
| **TASK-366**             | **Stress Test: Redundancy Assessment**                                  | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Single-point-of-failure detection and mitigation                                                                                                                                                                  | TASK-338                                               |
| ~~**BUG-367**~~          | ✅ **DONE** **Inbox Filter Excludes Overdue Tasks**                     | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed "This Week"/"This Month" filters to include overdue tasks. [SOP-020](./sop/SOP-020-inbox-filter-date-logic.md)                                                                                               |                                                        |
| ~~**TASK-368**~~         | ✅ **DONE** **Date Picker Popup Improvements**                          | **P2**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Added +1mo/+2mo/+3mo shortcuts and "Now" button to calendar popup. Dark theme styling applied.                                                                                                                      |                                                        |
| ~~**TASK-369**~~         | ✅ **DONE** **Quick Capture Tab Feature**                               | **P2**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Rich task capture integrated into QuickSort view with Ctrl+Shift+T shortcut. [SOP-021](./sop/SOP-021-quick-capture-tab.md)                                                                                          |                                                        |

---

---


### TASK-328: Test task from API

**Priority**: Medium
**Status**: Backlog


## Active Work (Summary)

> \[!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

### BUG-352: Mobile PWA "Failed to Fetch" (Network/Cert Issue)
**Priority**: P0-CRITICAL
**Status**: 📋 PLANNED (for Tomorrow)
User reports mobile device fails to fetch even on fresh browser. This rules out simple caching.
**Potential Causes**:
1.  **SSL/Cert Issue**: Android/iOS might reject the `sslip.io` cert if the chain isn't perfect (Caddy usually handles this, but maybe an intermediate is missing).
2.  **Mobile-Specific Code Path**: Does the mobile layout have a hardcoded `localhost` fetch somewhere that the desktop layout doesn't use?
3.  **CORS**: Mobile browser enforcing stricter CORS?

### ~~TASK-356~~: Fix Tauri App Migration Error (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-22)

Tauri app failed on startup with "Remote migration versions not found in local migrations directory" because it tried to run `supabase db push --local` from arbitrary working directory.

**Root Cause**: Tauri apps run from `/usr/bin/` or user's home directory, not the project directory. The Supabase CLI needs to be in a directory with `supabase/migrations/` to push migrations.

**Solution**: Changed `run_supabase_migrations()` in `lib.rs` to verify DB health via REST API instead of pushing migrations. This works regardless of working directory.

**Prevention (Architectural Rule)**:
- Migrations should be applied during **development setup**, not at app runtime
- Runtime should only **verify** the database is ready, not modify it
- Use REST API health checks which are directory-independent
- Added to Tauri SOP: "Never run Supabase CLI commands that require project directory context"

**Files Changed**:
- `src-tauri/src/lib.rs` - `run_supabase_migrations()` now uses curl to check `/rest/v1/tasks` endpoint

**Verification**:
- [x] Rebuild Tauri app (`npm run tauri build`)
- [x] App launches without migration error
- [x] Database operations work normally
- [x] User confirmed fix works (2026-01-22)

---

### TASK-359: Quick Add + Sort Feature (👀 REVIEW)

**Priority**: P2
**Status**: 👀 REVIEW (awaiting user verification)

Implemented batch capture mode: rapidly add multiple tasks first, then sort them via QuickSort-style UI.

**UX Flow**:
1. `Ctrl+.` opens Quick Capture modal
2. Type task titles + Enter to add to pending list
3. Tab to start sorting phase
4. 1-9 assigns to project, S skips (uncategorized)
5. Done phase shows summary

**Files Created**:
- `src/composables/useQuickCapture.ts` - Capture/sort state management
- `src/components/quicksort/QuickCaptureModal.vue` - Modal UI with 3 phases

**Files Modified**:
- `src/composables/app/useAppShortcuts.ts` - Added Ctrl+. shortcut
- `src/layouts/ModalManager.vue` - Registered modal + event listener

**Notes**:
- Tasks assigned via "Skip" (no project) appear in QuickSort counter
- Tasks assigned to projects do NOT appear in QuickSort (expected behavior)
- Integrates with quickSortStore for session tracking

---

### BUG-357: Tauri Edit Modal Shows Wrong Task (🔄 IN PROGRESS)

**Priority**: P1
**Status**: 🔄 IN PROGRESS (awaiting user verification)

**Symptom**: In Tauri app, double-clicking a task on canvas opens the edit modal showing a DIFFERENT task's data.

**Root Cause**: `useTaskNodeActions.triggerEdit()` was passing `props.task` (stale Vue Flow node data) instead of fetching fresh task from the store. Vue Flow creates shallow clones of tasks during sync (`{ ...task }`), which can become stale if the task is updated elsewhere.

**Solution**: Modified `triggerEdit()` to always fetch the fresh task from the store before opening the edit modal:
```typescript
const freshTask = taskStore.tasks.find(t => t.id === task.id) || task
```

**Files Changed**:
- `src/composables/canvas/node/useTaskNodeActions.ts` - `triggerEdit()` now looks up fresh task

**Verification**:
- [x] Code change implemented
- [x] Build passes
- [ ] User confirms fix works in Tauri app

---

### TASK-357: Set Up VPS → Local Postgres Replication (📋 PLANNED)

**Priority**: P2
**Status**: 📋 PLANNED

Set up one-way Postgres logical replication from VPS to local for backup/redundancy.

**Architecture**:
- VPS Supabase = Primary (source of truth)
- Local Supabase = Backup (subscribes to VPS changes)
- One-way sync: VPS publishes, Local subscribes

**Steps**:
1. [ ] Check VPS Postgres `wal_level` is `logical`
2. [ ] Expose VPS Postgres port 5432 (IP-restricted)
3. [ ] Create replicator user on both sides
4. [ ] Create publication on VPS for key tables
5. [ ] Create subscription on Local
6. [ ] Verify sync is working

**Tables to Sync**: `tasks`, `groups`, `projects`, `timer_sessions`, `user_settings`, `notifications`

---

### ~~TASK-358~~: Create VPS Backup System (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-22)

Automated backup system for VPS Supabase data with local replication.

**Implemented**:
1. [x] `pg_dump` script with timestamp (`/root/scripts/supabase-backup.sh`)
2. [x] Backup rotation (7 daily, 4 weekly, 12 monthly)
3. [x] Cron job for daily backups (3 AM UTC)
4. [x] Local sync via rsync (`~/scripts/sync-vps-backups.sh`)
5. [x] Systemd timer for 6-hourly local sync

**Backup Locations**:
- VPS: `/var/backups/supabase/{daily,weekly,monthly}`
- Local: `~/backups/flowstate-vps/`

**Commands**:
```bash
# Manual VPS backup
ssh root@84.46.253.137 '~/scripts/supabase-backup.sh'

# Manual local sync
~/scripts/sync-vps-backups.sh

# Check timer status
systemctl --user status flowstate-backup-sync.timer
```

**SOP**: `docs/sop/SOP-VPS-BACKUP.md`

---

### TASK-351: Secure Secrets Management (Doppler)
**Priority**: P1
**Status**: 📋 PLANNED (for Tomorrow)
Migrate from `.env` files to Doppler for secure secret injection in CI/CD and VPS.

### BUG-342: Canvas Multi-Drag Bug - Unselected Tasks Move Together (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL
**Status**: IN PROGRESS (2026-01-20)

When dragging a single task on the canvas, another unselected task moves along with it. Both tasks appear to be linked even though only one is selected.

**Observed Behavior**:
- User drags one task
- A second, unselected task also moves
- Tasks are not visually connected or grouped

**Expected Behavior**:
- Only the selected/dragged task should move
- Other tasks should remain stationary unless explicitly selected

**Investigation Areas**:
- [ ] Check Vue Flow selection state
- [ ] Check canvas drag handlers in `useCanvasInteractions.ts`
- [ ] Check if tasks share parent or have hidden edge connection
- [ ] Check multi-select state persistence

---

### BUG-347: Fix FK Constraint Violation on parent_task_id (👀 REVIEW)

**Priority**: P1
**Status**: 👀 REVIEW (2026-01-21)

Sync errors when saving tasks with deleted parent: `insert or update on table "tasks" violates foreign key constraint "tasks_parent_task_id_fkey"`

**Root Cause**:
1. Tasks saved with `parent_task_id` references to tasks that no longer exist (deleted)
2. No existence validation - `sanitizeUUID()` validates format but not that parent exists
3. Race conditions in batch upserts don't guarantee parent-before-child order

**Solution Implemented**: Catch-and-Retry (Zero False Positives)
- Try upsert normally
- If FK error code `23503` with `parent_task_id`, clear parent references and retry once
- Single retry limit prevents infinite loops

**Files Changed**:
- `src/composables/useSupabaseDatabase.ts`
  - `saveTask()` - Added FK-aware retry logic
  - `saveTasks()` - Added FK-aware retry logic for batch operations

**Verification**:
- [x] Build passes (`npm run build`)
- [x] Lint passes (warnings only, no errors)
- [ ] Manual test: Create task with parent, delete parent, trigger sync
- [ ] Console shows: `⚠️ [saveTasks] FK violation on parent_task_id, clearing orphaned references and retrying`

---

### BUG-339: Auth Reliability - Tauri Signouts & Password Failures (👀 REVIEW)

**Priority**: P0-CRITICAL
**Status**: IN PROGRESS (2026-01-20)

Multiple auth reliability issues: random Tauri signouts, password login failures, and seeded credentials not working.

**Root Causes Identified**:
1. **Password Login Failures**: `seed.sql` used `crypt()` instead of `extensions.crypt()` with wrong cost factor
2. **Tauri IPC Failures**: Missing `ipc:` and `http://ipc.localhost` in CSP causing protocol fallback
3. **Session Instability**: Supabase client missing explicit auth configuration for desktop apps

**Fixes Implemented**:
- [x] `seed.sql`: Changed to `extensions.crypt(password, extensions.gen_salt('bf', 10))` for GoTrue compatibility
- [x] `tauri.conf.json`: Added `ipc:` and `connect-src` directive for IPC protocol
- [x] `supabase.ts`: Added explicit auth config with custom storage key and Tauri-aware settings
- [x] `taskPersistence.ts`: Only save to guest localStorage when NOT authenticated (prevents Supabase data leaking to guest storage)
- [x] `taskPersistence.ts`: Added ID-based deduplication on guest mode load (prevents task congestion)
- [x] `auth.ts`: Migration now uses `safeCreateTask()` to preserve task IDs and respect TASK-344 Immutable ID System
- [x] `auth.ts`: Added Task type import for TypeScript compliance
- [x] `auth.ts`: Added proactive token refresh (5 min before expiry) to prevent session expiration
- [x] `guestModeStorage.ts`: Added `clearStaleGuestTasks()` to clear legacy keys (`pomoflow-guest-tasks`)
- [x] `useAppInitialization.ts`: Call `clearStaleGuestTasks()` when authenticated to prevent localStorage contamination
- [x] Database: Cleared 141 duplicate tasks (set `is_deleted = true`)

**Files Changed**:
- `supabase/seed.sql` - Fixed password hashing
- `src-tauri/tauri.conf.json` - Fixed CSP for IPC
- `src/services/auth/supabase.ts` - Enhanced auth client config
- `src/stores/tasks/taskPersistence.ts` - Guest localStorage isolation + deduplication
- `src/stores/auth.ts` - Migration with safeCreateTask, proactive token refresh
- `src/utils/guestModeStorage.ts` - Legacy key clearing
- `src/composables/app/useAppInitialization.ts` - Clear stale guest tasks on auth

**Verification**:
- [x] Auth API test passes: `curl POST /auth/v1/token` returns valid JWT
- [x] Database verified: 64 unique tasks, 0 content duplicates
- [x] Guest mode deduplication: Removes duplicates on load
- [x] Tauri app login tested by user
- [x] Auth protections verified (2026-01-22):
  - ✅ **Proactive token refresh**: Logs show "Scheduling token refresh in 55 minutes" (5 min before 60-min expiry)
  - ✅ **Retry with backoff**: `useSupabaseDatabase.ts` retries 401/403/network errors 3x with exponential backoff
  - ✅ **Session persistence**: Session survives app reload via localStorage
  - ✅ **Emergency auth refresh**: WebSocket 403 triggers refresh attempt, not sign-out
- [ ] No random signouts after extended Tauri use (needs user monitoring)

**Risk Assessment**:
- Web Browser: **LOW** - Auth system is reliable
- Tauri Desktop: **MEDIUM** - Storage adapter may have edge cases (see BUG-340 fix)

**SOP**: See `docs/sop/active/SOP-AUTH-reliability.md`

---

### ~~TASK-349~~: Make Guest Mode Ephemeral (Clean on Restart) (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-21)

**Problem**: Guest tasks persisted in localStorage across page refreshes/restarts, causing confusion when users expected a fresh start.

**Requested Behavior**:
- Guest mode starts fresh on every app restart
- Authenticated users keep all their tasks (from Supabase)
- Same-session sign-in still migrates tasks (before any restart)

**Changes Made**:

1. **`src/utils/guestModeStorage.ts`**
   - Added `flowstate-guest-tasks` to `GUEST_EPHEMERAL_KEYS` array
   - Guest tasks now cleared on app startup like other ephemeral data

2. **`src/stores/auth.ts`**
   - Fixed `signOut()` to clear task store and canvas store on logout
   - Fixed `migrateGuestData()` to load from Supabase even when no guest tasks exist
   - Added canvas store reload after migration

3. **`src/stores/tasks.ts`** / **`src/stores/canvas.ts`**
   - Added `clearAll()` methods to reset store state on sign-out

4. **`src/assets/canvas-view-layout.css`**
   - Fixed inbox panel CSS specificity conflict for proper positioning

**Bug Found & Fixed**: `migrateGuestData()` returned early without loading user data when no guest tasks existed. This caused sign-in to show empty canvas until page refresh.

**SOP**: See `docs/sop/active/SOP-016-guest-mode-auth-flow.md`

---

### TASK-353: Design Better Canvas Empty State (📋 BACKLOG)

**Priority**: P3
**Status**: 📋 BACKLOG

**Context**: The current canvas empty state is minimal - just text and two buttons. A better empty state would help new users understand the canvas capabilities.

**Requested Improvements**:
- Visual illustration showing the canvas concept (workflow, visual organization)
- More engaging messaging (inviting rather than just "it's empty")
- Feature highlights showing what's possible (groups, visual layout, drag-drop)
- Guest mode awareness (prompt to sign in to save work)
- Keyboard shortcut hints

**Current Component**: `src/components/canvas/CanvasEmptyState.vue`

**Tasks**:
- [ ] Design new empty state mockup
- [ ] Add visual illustration (CSS/SVG based)
- [ ] Improve messaging copy
- [ ] Add feature highlights
- [ ] Add guest mode sign-in prompt
- [ ] Test with new users

---

### ~~BUG-336~~: Fix Backup Download in Tauri App (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-20)

Can't download backups from Tauri desktop app - file save dialog doesn't work.

**Root Causes Found & Fixed**:
1. **PWA Plugin CSP Error** - `VitePWA` was conditionally excluded (`!isTauri && VitePWA()`), but this didn't provide stub modules for `virtual:pwa-register/vue` imports, causing CSP errors that broke Vue event handlers
2. **Tauri Detection Not Working in Dev** - `TAURI_ENV_PLATFORM` is only set during `tauri build`, not `tauri dev`
3. **Missing XDG Portal Fallback** - `zenity` package needed for Linux dialog fallback

**Solution**:
- Changed `vite.config.ts` to use `VitePWA({ disable: isTauri })` which provides proper stub modules
- Added `TAURI_DEV=true` env var in `tauri.conf.json` `beforeDevCommand`
- Updated `isTauri` detection to check for both `TAURI_ENV_PLATFORM` (build) and `TAURI_DEV` (dev)
- Upgraded `@tauri-apps/plugin-dialog` to 2.6.0 with `xdg-portal` feature
- Added auto-detection for local vs remote Supabase in migration command

**Files Changed**:
- `vite.config.ts` - PWA disable option, isTauri detection
- `src-tauri/tauri.conf.json` - beforeDevCommand with TAURI_DEV env var
- `src-tauri/Cargo.toml` - dialog plugin with xdg-portal feature
- `src-tauri/src/lib.rs` - Supabase migration auto-detection
- `package.json` - Upgraded Tauri plugin versions

**Tasks**:
- [x] Investigate Tauri file save dialog implementation
- [x] Check if Tauri plugin for dialogs is properly configured
- [x] Test backup download functionality in browser vs Tauri
- [x] Fix file save dialog or implement alternative download method

---

### ~~TASK-343~~: Fix Canvas Inbox Today Filter + Add Time Filter Dropdown (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-20)

**Problem**: The "Today" filter in Canvas Inbox showed tasks that weren't due today. A task with due date "Jan 26" appeared when "Today" filter is active (today is Jan 20).

**Root Cause** (in `src/composables/useSmartViews.ts:116-125`):
The `isTodayTask()` function included tasks created today regardless of their due date. This was incorrect - a task with a future due date should NOT appear in "Today" just because it was created today.

**Solution**:
1. **Bug Fix**: Changed `if (task.createdAt)` to `if (!task.dueDate && task.createdAt)` - only include created-today tasks if they have NO due date
2. **New Feature**: Replaced single "Today" toggle button with dropdown offering: All, Today, This Week, This Month
3. Added `isThisMonthTask()` function for month filtering

**Files Changed**:
- `src/composables/useSmartViews.ts` - Bug fix + added `isThisMonthTask()`
- `src/composables/inbox/useUnifiedInboxState.ts` - Expanded filter types + counts
- `src/components/inbox/unified/UnifiedInboxHeader.vue` - Replaced toggle with NDropdown
- `src/components/inbox/UnifiedInboxPanel.vue` - Pass new props

---

### ~~TASK-344~~: Immutable Task ID System - Prevent System-Generated Duplicates (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-20)
**SOP**: [`docs/sop/active/SOP-013-immutable-task-ids.md`](docs/sop/active/SOP-013-immutable-task-ids.md)

**Problem**: The system (sync, backup restore, Claude Code automation) can accidentally create duplicate tasks with the same ID or recreate deleted tasks. Task IDs should be immutable - once an ID is used (or was used), it can NEVER be recreated by the system.

**Solution - ID Immutability Enforcement**:
```
Once a task ID is used → That ID is PERMANENTLY reserved
- Active task exists → ID is in use
- Soft-deleted task exists → ID is still reserved
- Hard-deleted task → ID recorded in tombstones, still reserved
```

**Implementation Layers**:
| Layer | Component | Protection |
|-------|-----------|------------|
| Database | `safe_create_task()` RPC | `FOR UPDATE SKIP LOCKED`, checks existing + tombstones |
| Database | `trg_task_tombstone` trigger | Auto-creates permanent tombstone on DELETE |
| Application | `safeCreateTask()` | TypeScript wrapper, calls RPC or manual fallback |
| Application | `checkTaskIdsAvailability()` | Batch check for restore/sync operations |
| Audit | `task_dedup_audit` table | Logs all dedup decisions with reasons |

**Files Changed**:
- `supabase/migrations/20260120000002_immutable_task_ids.sql` - Permanent tombstones, DELETE trigger, safe_create_task RPC, audit table
- `src/composables/useSupabaseDatabase.ts` - `safeCreateTask()`, `checkTaskIdsAvailability()`, `logDedupDecision()`
- `src/composables/useBackupSystem.ts` - Uses `safeCreateTask()` for each restored task (race-condition safe)
- `src/stores/tasks/taskPersistence.ts` - Dedup-aware `importTasks()`

---

### TASK-338: Comprehensive Stress Testing Agent/Skill (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL
**Status**: IN PROGRESS (2026-01-20)

Create a specialized stress testing agent/skill that rigorously tests all completed tasks, finds missed issues, vulnerabilities, and loopholes. Must assess what other agents missed and ensure system reliability.

**Scope**:
- **Reliability Testing** - Verify all critical paths work under stress
- **Backup System Verification** - Test backup/restore integrity, shadow-mirror reliability
- **Container Stability** - Docker/Supabase container health, restart resilience
- **Redundancy Assessment** - Identify single points of failure
- **Security Audit** - OWASP top 10, input validation, auth edge cases
- **Data Integrity** - Sync conflicts, race conditions, deduplication
- **Performance Profiling** - Memory leaks, response times under load

**Research Phase** (✅ COMPLETE 2026-01-20):
- [x] Research Vue.js stress testing best practices (2026) - Artillery, k6, Vitest bench, Fuite
- [x] Research Supabase reliability patterns and testing approaches - pgTAP, RLS testing, WebSocket monitoring
- [x] Research Docker/container health monitoring strategies - cAdvisor, Pumba, Prometheus
- [x] Research backup verification methodologies - pgBackRest, restore testing, checksum validation
- [x] Research security testing tools for web apps - OWASP ZAP, Trivy, Snyk
- [x] Analyze FlowState codebase for critical paths to test - Full critical path map created

**Research Output**: `docs/research/TASK-338-stress-testing-research.md`

**Implementation Phase** (IN PROGRESS):
- [x] Design skill architecture based on research findings
- [x] Create skill file structure (`.claude/skills/stress-tester/`)
- [x] Add to skills.json configuration
- [x] Implement backup/restore verification tests (`npm run test:backup`)
- [x] **FIX**: Shadow mirror JSON structure - added `timestamp` and `checksum` at root level (2026-01-22)
- [x] **FIX**: Checksum algorithm mismatch - aligned SHA256 algorithm between mirror and verifier (2026-01-22)
- [ ] Create test matrix covering all completed TASK-* items
- [ ] Implement reliability test suite
- [ ] Implement container stability checks
- [ ] Implement security audit checks
- [ ] Create comprehensive report generation
- [ ] Integrate with existing qa-testing skill

**Success Criteria**:
- Catches issues that manual testing and qa-testing skill miss
- Provides actionable vulnerability reports
- Verifies backup system works under all conditions
- Validates container orchestration reliability
- Zero false positives in security audit

**Sub-Tasks** (Created 2026-01-22):
- TASK-361: Container Stability Tests
- TASK-362: Sync Conflict Resolution Tests
- TASK-363: Auth Edge Case Tests
- TASK-364: WebSocket Stability Tests
- TASK-365: Actual Restore Verification
- TASK-366: Redundancy Assessment

---

### TASK-361: Stress Test - Container Stability (📋 PLANNED)

**Priority**: P1
**Status**: PLANNED
**Depends On**: TASK-338

Test Docker/Supabase container restart resilience.

**Tests to Implement**:
- [ ] `docker restart supabase_db_flow-state` → verify app auto-reconnects
- [ ] Kill Supabase container → verify graceful error handling
- [ ] Restart entire Docker stack → verify session persistence
- [ ] Simulate container OOM → verify recovery

**Files**: `tests/stress/container-stability.spec.ts`

---

### TASK-362: Stress Test - Sync Conflict Resolution (📋 PLANNED)

**Priority**: P1
**Status**: PLANNED
**Depends On**: TASK-338

Test race conditions and conflict resolution.

**Tests to Implement**:
- [ ] Two tabs editing same task simultaneously
- [ ] Offline edit + online edit conflict
- [ ] Rapid create/delete cycles (timing attacks)
- [ ] Parent-child relationship race conditions

**Files**: `tests/stress/sync-conflicts.spec.ts`

---

### TASK-363: Stress Test - Auth Edge Cases (📋 PLANNED)

**Priority**: P1
**Status**: PLANNED
**Depends On**: TASK-338

Test authentication boundary conditions.

**Tests to Implement**:
- [ ] Expired JWT token → verify silent refresh
- [ ] Session timeout (1hr+) → verify re-auth flow
- [ ] Concurrent sessions (multiple devices) → verify sync
- [ ] Invalid token injection → verify rejection
- [ ] Logout during active sync → verify no data loss

**Files**: `tests/stress/auth-edge-cases.spec.ts`

---

### TASK-364: Stress Test - WebSocket Stability (📋 PLANNED)

**Priority**: P1
**Status**: PLANNED
**Depends On**: TASK-338

Test Supabase Realtime reconnection under stress.

**Tests to Implement**:
- [ ] Network disconnect → verify auto-reconnect
- [ ] Server-side channel close → verify re-subscribe
- [ ] 100+ rapid subscribe/unsubscribe cycles
- [ ] WebSocket message flood (rate limiting)
- [ ] Connection during heavy DB load

**Files**: `tests/stress/websocket-stability.spec.ts`

---

### TASK-365: Stress Test - Actual Restore Verification (📋 PLANNED)

**Priority**: P0
**Status**: PLANNED
**Depends On**: TASK-338

Test actual backup restore functionality (not just file existence).

**Tests to Implement**:
- [ ] Create tasks → backup → delete all → restore → verify data intact
- [ ] Restore from 1-day-old backup → verify all fields preserved
- [ ] Restore with conflicting IDs → verify dedup works
- [ ] Restore partial backup (corrupted JSON) → verify graceful failure
- [ ] Restore → verify canvas positions preserved

**Files**: `tests/stress/restore-verification.spec.ts`

---

### TASK-366: Stress Test - Redundancy Assessment (📋 PLANNED)

**Priority**: P2
**Status**: PLANNED
**Depends On**: TASK-338

Identify and test single points of failure.

**Tests to Implement**:
- [ ] Map all SPOF (Supabase, Docker, localStorage, etc.)
- [ ] Test fallback when Supabase unreachable → localStorage mode
- [ ] Test shadow mirror as emergency restore source
- [ ] Document recovery procedures for each failure mode

**Files**: `tests/stress/redundancy-assessment.spec.ts`, `docs/sop/SOP-XXX-disaster-recovery.md`

---

### TASK-335: Fix Canvas Distribution for Stacked Tasks (✅ DONE)

**Priority**: P2
**Status**: DONE (2026-01-20)

When multiple tasks share the same position (stacked), the distribute functions calculated spacing as 0, causing tasks not to move.

**Solution**:
- Added minimum spacing constants (`DEFAULT_SPACING_X = 240px`, `DEFAULT_SPACING_Y = 120px`)
- Modified `distributeHorizontal()` and `distributeVertical()` in `useCanvasAlignment.ts`
- If natural spacing < 10px, use default fixed spacing instead

**Files Changed**:
- `src/composables/canvas/useCanvasAlignment.ts`

---

### ~~TASK-340~~: Layout Submenu Icon Grid Panel (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-21)

Replace the Layout submenu list with a compact icon grid panel (industry standard pattern used by Figma, Adobe, Canva).

**Problem**:
- Current Layout submenu has 11 items that get cut off at viewport edges
- Nested submenus are problematic UX (users "fall out" when moving cursor)

**Solution**:
- Convert to icon grid layout with grouped sections:
  - **Align**: 2x3 grid (Left, Center H, Right | Top, Center V, Bottom)
  - **Distribute**: 1x2 row (Horizontal, Vertical)
  - **Arrange**: 1x3 row (Row, Column, Grid)
- Add tooltips for discoverability
- Much more compact, fits any viewport

**Implementation Notes** (critical for Tauri compatibility):
- MUST use existing `submenu submenu-teleported` base classes (proven to work with Tauri's WebView)
- MUST use `menu-item` class on all buttons (has working `pointer-events: auto`)
- Add visual modifier classes (`layout-grid-mode`, `menu-item-icon`) on top of working base
- See SOP: `docs/sop/SOP-013-teleported-menu-patterns.md`

**Files Changed**:
- `src/components/canvas/CanvasContextMenu.vue`

**Success Criteria**:
- [x] Icon grid renders correctly
- [x] All alignment/distribution functions work
- [x] Tooltips show on hover
- [x] Fits in viewport without cutoff
- [x] Works in Tauri (critical - first attempt failed due to click handling)

---

### TASK-300: Documentation Phase 2 - Content Consolidation (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-18)

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

**Phase 2B: Canvas SOP Consolidation (✅ COMPLETE)**

Target: Create 3 organized files from 12 scattered SOPs

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

### ~~TASK-317~~: Shadow Backup Deletion-Aware Restore + Supabase Data Persistence (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-19)
**Root Cause**: Supabase crash wiped auth.users, shadow backup restored deleted items

**Problem Analysis**:
1. **Supabase Data Loss** - When Supabase containers crash/restart, auth.users table gets reset
2. **Shadow Backup Overwrites** - Empty snapshots (when DB unreachable) overwrite good backups
3. **Deletion Not Tracked** - Backup can't distinguish "deleted" from "never existed"
4. **Incomplete Restore** - Parent-child ordering not respected, some items fail FK constraints

**Requirements (MUST achieve all)**:
- ✅ Items created and NOT deleted → MUST be fully restored (100% coverage)
- ✅ Items deleted by user → MUST NOT be restored
- ✅ Supabase crash/restart → Data survives without manual intervention
- ✅ Auth credentials → Persist across restarts OR auto-recreate dev user

**Solution - 4 Layers of Protection**:

**Layer 1: Supabase Data Persistence (Prevent Loss at Source)**
- [ ] Investigate why `auth.users` resets on container restart (likely schema re-init)
- [ ] Configure PostgreSQL data persistence in Docker volume
- [ ] Create `supabase/seed.sql` with dev user auto-creation (fallback safety net)
- [ ] Add pre-stop hook: graceful shutdown before any container removal
- [ ] Document safe restart: ALWAYS use `supabase stop` (NEVER `docker rm -f`)
- [ ] Backup `.env` Supabase credentials separately

**Layer 2: Shadow Backup Smart Saving (Prevent Corrupted Backups)**
- [ ] **Threshold Guard**: Skip save if item count drops >50% from last good snapshot
- [ ] **Connection Check**: Validate DB reachable before fetch, tag snapshot `connection_healthy`
- [ ] **Protected Ring**: Keep last 10 snapshots with item_count > 0 as immutable
- [ ] **Alert on Anomaly**: Log WARNING + optional notification on dramatic drops
- [ ] **Atomic Writes**: Write to temp file, then rename (prevent partial corruption)

**Layer 3: Complete Item Tracking (Track Everything Needed for Full Restore)**
- [ ] **Deletion State**: Include `is_deleted` boolean in every snapshot item
- [ ] **Deletion Timestamp**: Include `deleted_at` to know when deletion occurred
- [ ] **Creation Timestamp**: Include `created_at` to verify item legitimacy
- [ ] **User Mapping**: Track user email↔id mapping (for re-signup scenarios)
- [ ] **Parent References**: Store `parent_id`/`parent_group_id` for ordering
- [ ] **Schema Version**: Tag snapshots with schema version for compatibility

**Layer 4: Reliable Restore (Restore Correctly & Completely)**
- [ ] **Deletion Filter**: Only restore where `is_deleted = false`
- [ ] **Topological Sort**: Insert parents before children (prevent FK errors)
- [ ] **User ID Remap**: Automatically map old user_id → new user_id
- [ ] **Upsert Strategy**: `ON CONFLICT DO UPDATE` for idempotent restores
- [ ] **Validation**: Count restored items, compare to expected, report mismatches
- [ ] **Preview Mode**: Show what WILL be restored before committing
- [ ] **Transaction Safety**: Wrap in transaction, rollback on any error

**Files to Modify**:
- `src/composables/useBackupSystem.ts` - Smart save + threshold logic
- `src/utils/shadowMirror.ts` - Enhanced schema with deletion tracking
- `supabase/seed.sql` (new) - Dev user auto-creation fallback
- `scripts/restore-from-shadow.ts` (new) - Full restore with ordering + remapping
- `scripts/validate-backup.ts` (new) - Backup integrity checker

**Verification Tests**:
- [ ] Create 10 items → Force Supabase crash → Restart → All 10 items present
- [ ] Delete 3 items → Crash → Restore → Only 7 items restored
- [ ] Kill DB mid-backup → No empty snapshot saved → Last good preserved
- [ ] Nested groups restore → Parents inserted first → Zero FK errors
- [ ] New user signup → Restore → Old user_id remapped to new → Data accessible
- [ ] 1000 backup cycles → Protected ring of 10 snapshots still intact

---

### ~~TASK-305~~: Tauri Desktop Distribution - Complete Setup (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-18)
**Related**: TASK-079 (Tauri Desktop & Mobile)
**SOP**: [SOP-011](./sop/SOP-011-tauri-distribution.md)

Complete the Tauri desktop distribution setup for open-source release. Enable end users to install FlowState as a standalone desktop app with automated Docker + Supabase local stack setup.

**Backend Implementation (✅ COMPLETE)**:

- [x] Rust backend with Docker/Supabase orchestration (`lib.rs`)
- [x] `check_docker_status`, `start_docker_desktop` (platform-specific)
- [x] `check_supabase_status`, `start_supabase`, `stop_supabase`
- [x] `run_supabase_migrations` - runs `supabase db push`
- [x] `cleanup_services` - graceful shutdown
- [x] Shell plugin + capabilities configured

**Frontend Implementation (✅ COMPLETE)**:

- [x] Vue startup composable (`useTauriStartup.ts`)
- [x] Startup screen UI (`TauriStartupScreen.vue`)
- [x] Error detection: Docker not installed, not running, port conflicts
- [x] Error detection: Supabase CLI missing, port conflicts
- [x] Targeted help text for each error type
- [x] App.vue integration (Tauri detection)
- [x] PWA disabled for Tauri builds

**Renaming Pomo-Flow → FlowState (✅ COMPLETE - 2026-01-18)**:

- [x] `tauri.conf.json` - FlowState, com.flowstate.app
- [x] `Cargo.toml` - Updated metadata, author, license, repository
- [x] `capabilities/default.json` - FlowState description
- [x] All source files - UI text, branding, environment URLs updated
- [x] Test files - Updated assertions and descriptions

**CI/CD Release Workflow (✅ COMPLETE - 2026-01-19)**:

- [x] `.github/workflows/release.yml` - Multi-platform builds
- [x] Linux (ubuntu-22.04) - AppImage, .deb, .rpm
- [x] Windows (windows-latest) - .exe, .msi
- [x] macOS (macos-latest) - .dmg (arm64 + x86_64)
- [x] Automatic draft release creation on tag push
- [x] Fixed: `tauriScript: npm run tauri` (was defaulting to pnpm)
- [x] Fixed: Added Rust targets for macOS cross-compilation
- [x] Verified: All 4 platform builds passing (2026-01-19)

**Auto-Updater Signing (✅ COMPLETE - 2026-01-18)**:

- [x] Generated signing keypair: `~/.tauri/flow-state.key`
- [x] Added to GitHub secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [x] Updated `tauri.conf.json` with public key
- [x] Configured update endpoint: `https://github.com/endlessblink/flow-state/releases/latest/download/latest.json`

**Local Linux Install (✅ COMPLETE - 2026-01-18)**:

- [x] Built .deb package locally
- [x] Installed via `dpkg -i`
- [x] Desktop shortcut working (KDE Plasma)
- [x] App launches from desktop

**Files**:

- `src-tauri/src/lib.rs` - Rust commands (9 Tauri commands)
- `src-tauri/Cargo.toml` - Dependencies + metadata
- `src-tauri/tauri.conf.json` - App identity + bundle config + updater pubkey
- `src/composables/useTauriStartup.ts` - Startup sequence
- `src/components/startup/TauriStartupScreen.vue` - UI
- `.github/workflows/release.yml` - Multi-platform CI/CD

**User Prerequisites**:

| Software | Why | Install |
|----------|-----|---------|
| Docker Desktop | Runs Supabase containers | docker.com/products/docker-desktop |
| Supabase CLI | Manages local database | `npm install -g supabase` |

**Success Criteria**:

- [x] App automatically starts Docker + Supabase
- [x] Clear error messages guide users to fix issues
- [x] App cleans up services on exit
- [x] Local Linux install works end-to-end
- [x] Auto-updater signing configured
- [x] GitHub Actions release workflow operational

---

### TASK-334: AI "Done" Claim Verification System (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: Complete
**Completed**: January 22, 2026
**Created**: January 20, 2026
**Plan File**: `/home/endlessblink/.claude/plans/bubbly-stargazing-galaxy.md`

**Problem**: Claude claims tasks are "done" without user verification. Self-verification is fundamentally flawed because Claude writes both code AND tests.

**Solution**: 5-Layer Defense System with Judge Agent integrated into Dev-Maestro.

**Layers**:

| Layer | What | Implementation |
|-------|------|----------------|
| **1. Artifacts** | Must provide git diff, test output, verification instructions | CLAUDE.md update |
| **2. Pre-existing tests** | Auto-run `npm test` after edits | PostToolUse hook |
| **3. Falsifiability** | Define success/failure criteria BEFORE starting | CLAUDE.md update |
| **4. User confirmation** | Block "done" until user verifies | Stop hook |
| **5. Judge agent** | Separate agent evaluates claims | Dev-Maestro integration |

**Dev-Maestro Integration** (Layer 5):
- Judge agent callable via `/api/judge/evaluate` endpoint
- Observable in Dev-Maestro UI (new "Judge" tab/panel)
- Monitored by orchestrator for multi-agent workflows
- Isolated context (separate from executor agent)

**Files to Create**:
- `.claude/hooks/auto-test-after-edit.sh` - Layer 2
- `.claude/hooks/artifact-checker.sh` - Layer 1
- `.claude/hooks/require-user-confirmation.sh` - Layer 4
- `dev-maestro/judge-agent.js` - Layer 5 (Dev-Maestro module)
- Update `.claude/settings.json` to register hooks
- Update `CLAUDE.md` with completion protocol

**Research Sources**:
- Multi-agent code verification (72.4% vs 32.8% accuracy)
- Chain-of-Verification (CoVe) technique
- NIST AI TEVV Framework
- FTC evidence requirements (2025)

**Progress**:
- [x] Research completed (6 agents)
- [x] Plan documented
- [x] Update CLAUDE.md with protocol
- [x] Create auto-test hook (Layer 2) - `.claude/hooks/auto-test-after-edit.sh`
- [x] Create artifact checker hook (Layer 1) - `.claude/hooks/artifact-checker.sh`
- [x] Create user confirmation hook (Layer 4) - `.claude/hooks/require-user-confirmation.sh`
- [x] Register hooks in `.claude/settings.json`
- [ ] Integrate judge agent into Dev-Maestro (Layer 5) → TASK-335
- [ ] Test full flow

---

### TASK-335: Judge Agent Integration in Dev-Maestro (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: Complete
**Completed**: January 22, 2026
**Created**: January 20, 2026
**Depends On**: TASK-334

**Purpose**: Layer 5 of the AI "Done" Claim Verification System. A separate judge agent that evaluates Claude's work claims with isolated context.

**Integration Points**:

1. **API Endpoint**: `/api/judge/evaluate`
   - Accepts: task description, artifacts, claimed completion
   - Returns: verdict (pass/fail), reasoning, gaps identified

2. **Dev-Maestro UI**: New "Judge" panel/tab
   - Real-time verdict display
   - History of evaluations
   - Integration with orchestrator workflow

3. **Orchestrator Integration**:
   - Called automatically when agent claims "done"
   - Blocks merge until judge approves
   - Disagreement requires user decision

4. **Isolated Context**:
   - Judge has separate prompt (not executor's context)
   - Reviews artifacts objectively
   - Checks against success criteria from Layer 3

**Implementation**:

| File | Purpose |
|------|---------|
| `dev-maestro/judge-agent.js` | Core judge logic and API |
| `dev-maestro/kanban/judge-panel.html` | UI component |
| `dev-maestro/server.js` | API routes integration |

**Judge Evaluation Criteria**:
- Did artifacts match the claimed work?
- Were Layer 3 success criteria met?
- Are there obvious gaps or missing pieces?
- Did existing tests pass?

**Research Basis**:
- Multi-agent code verification: 72.4% vs 32.8% accuracy
- Judge-executor separation prevents self-preference bias
- Diverse judges outperform single evaluators

**Tasks**:
- [x] Add /api/judge/evaluate endpoint (added to server.js:2749-2884)
- [x] Add /api/judge/history endpoint (placeholder for future)
- [ ] Create Judge panel in Dev-Maestro UI
- [ ] Integrate with orchestrator workflow
- [ ] Test with real completion claims

---

### ~~BUG-336~~: Ctrl+Z Not Working After Shift+Delete (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: Complete
**Completed**: January 22, 2026
**Created**: January 20, 2026

**Problem**: When using Shift+Delete to permanently delete a task from the canvas, Ctrl+Z (undo) doesn't restore it. Regular Delete (moves to inbox) works fine with undo.

**Root Cause**: In `useCanvasTaskActions.ts:294-295`, the permanent delete path calls `taskStore.permanentlyDeleteTask()` directly **without** recording the operation in the undo history.

**Fix Applied**:
1. Added `permanentlyDeleteTaskWithUndo()` function to `undoSingleton.ts`
2. Updated `useCanvasTaskActions.ts` to use the new function
3. **Critical**: Fixed `createTask` in `taskOperations.ts` to preserve task ID when provided (was always generating new ID, breaking undo restore)

**Testing Status**:
- [x] Works in web browser (Playwright verified)
- [ ] Works in Tauri desktop app (user verification needed)

**Files Modified**:
- `src/composables/undoSingleton.ts` - Added `permanentlyDeleteTaskWithUndo` function + debug logging
- `src/composables/canvas/useCanvasTaskActions.ts` - Use new undo-aware function
- `src/stores/tasks/taskOperations.ts` - Preserve task ID in `createTask` for undo restore
- `src/utils/globalKeyboardHandlerSimple.ts` - Debug logging for keyboard handler

---

### TASK-303: Dev-Manager AI Orchestrator Enhancement (⏸️ PAUSED)

**Priority**: P1-HIGH
**Status**: Paused
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

- `dev-maestro/server.js` (lines 2316-2705) - Orchestrator backend
- `dev-maestro/kanban/index.html` - Full UI implementation
- Plan file: `/home/endlessblink/.claude/plans/crispy-frolicking-honey.md`

**Stability Subtasks** (see details below):
- TASK-319: Fix Agent Output Capture
- TASK-320: Fix Task Completion Detection
- TASK-321: Test Merge/Discard Workflow E2E
- TASK-322: Add Automatic Error Recovery
- TASK-323: Fix Stale Agent Cleanup

**Next Steps** (for next session):

- [x] Test full orchestration flow end-to-end (Verified via static analysis of `server.js` and `index.html`)
- [x] Verify worktree creation works correctly (Function `createAgentWorktree` verified in `server.js`)
- [ ] User Acceptance Testing: Merge/discard functionality with real branches
- [ ] Add progress streaming from Claude output (currently batched)
- [ ] Consider adding `--allowedTools` for safer execution

**To Test**:

```bash
# Start dev-maestro
node dev-maestro/server.js

# Open orchestrator UI
http://localhost:6010/kanban/index.html?view=orchestrator

# Create a simple goal like "Add a comment to README.md"
# Watch the execution panel for agent cards and review section
```

---

### Dev-Maestro Orchestrator Stability (TASK-303 Subtasks)

The following tasks address stability issues discovered during orchestrator testing. All are subtasks of TASK-303.

#### TASK-319: Fix Agent Output Capture in Orchestrator (📋 PLANNED)

**Priority**: P1-HIGH
**Related**: TASK-303
**Created**: January 19, 2026

**Problem**: Agent stdout isn't reliably captured in logs. The `subAgentData.outputLines` stays at 0 even when agents create files successfully. Progress tracking is blind.

**Root Cause** (server.js:2459-2472):
- stdout only logged every 10 outputs (batching)
- `outputLines` counter not incremented properly
- Output array grows but count doesn't reflect it

**Solution**:
1. Increment `outputLines` on every stdout chunk
2. Stream output to a log file per agent (persistent)
3. Parse JSON from `--output-format stream-json` if needed

**Key Files**:
- `dev-maestro/server.js` (lines 2459-2472, stdout handler)

**Success Criteria**:
- [ ] Real-time output visible in logs
- [ ] `outputLines` count matches actual output chunks
- [ ] Agent logs persisted to `dev-maestro/logs/agent-{taskId}.log`

---

#### TASK-320: Fix Task Completion Detection in Orchestrator (📋 PLANNED)

**Priority**: P1-HIGH
**Related**: TASK-303
**Created**: January 19, 2026

**Problem**: Task shows "running" with "outputLines: 0" even after agent created files. Completion detection relies only on exit code.

**Root Cause** (server.js:2510-2595):
- Only checks `code === 0` for success
- No validation that files were actually changed
- Git diff may be empty if agent didn't commit

**Solution**:
1. Check git status for uncommitted changes
2. Validate diff output has actual file changes
3. Add agent activity timeout (no output for 60s = stuck)
4. Parse agent's final summary from output

**Key Files**:
- `dev-maestro/server.js` (lines 2510-2595, close handler)

**Success Criteria**:
- [ ] Task marked complete only when files changed
- [ ] Stuck agents detected via activity timeout
- [ ] Clear status: running/completed/failed/stuck

---

#### TASK-321: Test and Fix Merge/Discard Workflow End-to-End (📋 PLANNED)

**Priority**: P2-MEDIUM
**Related**: TASK-303
**Created**: January 19, 2026

**Problem**: Merge and discard endpoints (server.js:2642-2744) haven't been tested end-to-end. Potential issues:
- Merge may fail silently if conflicts exist
- No validation that merge succeeded before cleanup
- Parallel operations could corrupt git state

**Solution**:
1. Add merge conflict detection and abort
2. Validate merge success before deleting branch
3. Add mutex/lock for git operations per orchestration
4. Test: create task, execute, review diff, merge, verify in main

**Key Files**:
- `dev-maestro/server.js` (lines 2642-2701, merge endpoint)
- `dev-maestro/server.js` (lines 2703-2744, discard endpoint)

**Success Criteria**:
- [ ] Merge with conflicts shows clear error
- [ ] Successful merge cleans up branch and worktree
- [ ] Discard removes all traces (worktree + branch)
- [ ] Concurrent operations don't corrupt state

---

#### TASK-322: Add Automatic Error Recovery for Orchestrator Agents (📋 PLANNED)

**Priority**: P2-MEDIUM
**Related**: TASK-303
**Created**: January 19, 2026

**Problem**: If an agent fails mid-task, recovery is manual. User must manually clean up worktrees and restart.

**Current State**:
- Retry logic exists (maxRetries) but uses fixed 2s delay
- No exponential backoff
- Cleanup on failure doesn't always succeed
- No partial progress recovery

**Solution**:
1. Implement exponential backoff for retries (2s, 4s, 8s)
2. Preserve partial work in worktree on failure
3. Add "resume" option to continue from partial state
4. Admin endpoint to force-cleanup stuck orchestrations

**Key Files**:
- `dev-maestro/server.js` (lines 2545-2595, retry logic)

**Success Criteria**:
- [ ] Retries use exponential backoff
- [ ] Failed tasks show clear error reason
- [ ] Admin can force-cleanup via API endpoint
- [ ] Partial work preserved for manual review

---

#### TASK-323: Fix Stale Agent Cleanup in Orchestrator (📋 PLANNED)

**Priority**: P1-HIGH
**Related**: TASK-303
**Created**: January 19, 2026

**Problem**: Found stale Claude agent processes from previous tests still running. Worktrees accumulate without cleanup.

**Root Cause**:
- `cleanupWorktree()` only removes worktree, not branch
- Process kill on timeout may not work (SIGTERM vs SIGKILL)
- No startup cleanup of orphaned resources

**Solution**:
1. Kill process with SIGKILL after SIGTERM timeout
2. Clean up both worktree AND branch in `cleanupWorktree()`
3. Add startup scan for orphaned worktrees/branches
4. Add periodic cleanup job (every 10 minutes)
5. Track all spawned PIDs and kill on server shutdown

**Key Files**:
- `dev-maestro/server.js` (lines 914-930, cleanup function)
- `dev-maestro/server.js` (lines 870-911, createAgentWorktree)

**Success Criteria**:
- [ ] No orphaned Claude processes after orchestration ends
- [ ] No orphaned branches (`bd-orch-*`)
- [ ] No orphaned worktrees (`.agent-worktrees/*`)
- [ ] Server shutdown cleans up all resources

---

### ~~BUG-294~~: Timer Start Button Not Working (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-15)

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

### BUG-309: Ctrl+Z Keyboard Shortcut Not Triggering Undo (👀 REVIEW)

**Priority**: P1-HIGH
**Status**: 👀 Fix Applied - Awaiting User Verification (2026-01-17)

Ctrl+Z keyboard shortcut is detected but doesn't execute undo. The global keyboard handler detects the keypress but never calls the undo function.

**Root Cause Identified**:

- `src/utils/globalKeyboardHandlerSimple.ts` detects Ctrl+Z/Ctrl+Y in `handleKeydown()` but didn't call `executeUndo()`/`executeRedo()`
- The key detection code existed but lacked the actual execution call
- Handler also didn't use `shouldIgnoreElement()` to skip inputs/modals

**Fix Applied**:

- [x] Added `this.executeUndo()` call when Ctrl+Z is detected
- [x] Added `this.executeRedo()` call when Ctrl+Y / Ctrl+Shift+Z is detected
- [x] Added `this.executeNewTask()` call when Ctrl+N is detected
- [x] Added `shouldIgnoreElement()` check to skip when in inputs/modals
- [ ] User verification: Test Ctrl+Z/Y after making changes

**Files Modified**:

- `src/utils/globalKeyboardHandlerSimple.ts` - Added execution calls + element ignore check

---

### ~~BUG-309-B~~: Undo/Redo Position Drift (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-18)

When undoing an operation (e.g., deleting a task), other tasks that weren't involved in the operation "jumped back" to their positions from the time of the snapshot.

**Root Cause**:

- The undo system used full-state snapshots that captured ALL task/group positions
- Restoring a snapshot would overwrite ALL positions, not just the affected entity's position
- Example: User moves Task A to (300,400), creates Task B, presses Ctrl+Z → Task A jumps back to (100,200)

**Solution - Operation-Scoped Undo**:

Instead of restoring full snapshots, track which entities were affected by each operation and only restore those.

**Implementation**:

1. Added `UndoOperation` interface with `type`, `affectedIds`, `description`, `timestamp`
2. Added operation stack (`operationStack`, `redoOperationStack`) that tracks before/after snapshots per operation
3. Implemented `performSelectiveUndo()` and `performSelectiveRedo()` that only restore affected entities:
   - `task-create`: Undo = delete the created task (others unchanged)
   - `task-delete`: Undo = restore the deleted task from snapshot
   - `task-update`/`task-move`: Undo = restore only the moved task's position
   - Similar for group operations
4. Updated all `*WithUndo` functions to use `beginOperation()` + `commitOperation()` pattern
5. Legacy entries (without metadata) fall back to full-state restoration for backward compatibility

**Files Modified**:

- `src/composables/undoSingleton.ts` - Core operation-aware undo system implementation

**Documentation**:

- SOP: [`docs/sop/active/UNDO-system-architecture.md`](docs/sop/active/UNDO-system-architecture.md)

---

### Task Dependency Index (PWA Prerequisites) - ✅ ALL COMPLETE

```
┌─────────────────────────────────────────────────────────────────┐
│  ROAD-004: PWA Mobile Support (✅ DONE)                          │
│  Status: Phase 2 Complete (VPS & Reload Prompt)                  │
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

### ROAD-004: Mobile PWA (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-19) - Phase 2 (VPS & Reload Prompt) Complete

- **Plan**: [plans/pwa-mobile-support.md](../plans/pwa-mobile-support.md)
- **Phase 1 Dependencies**: ~~TASK-118~~, ~~TASK-119~~, ~~TASK-120~~, ~~TASK-121~~, ~~TASK-122~~ (All ✅ DONE)
- **Phase 2 Tasks**: TASK-324, TASK-325, TASK-326

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

**Phase 2: VPS Deployment** (✅ DONE):

- [x] TASK-324: PWA Install Prompt Component (`ReloadPrompt.vue`)
- [x] TASK-325: VPS Deployment Configuration (Caddyfile, GitHub Actions)
- [x] TASK-326: PWA Cross-Device Testing (iOS, Android, Lighthouse)

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

### TASK-310: Automated SQL Backup to Cloud Storage (📋 PLANNED)

**Priority**: P2-MEDIUM
**Complexity**: Low
**Status**: Planned
**Created**: January 17, 2026

**Feature**: Set up automated SQL backups of Supabase data to a cloud-synced location (Dropbox or QNAP backup drive) for additional data safety beyond local Docker volumes.

**Requirements**:
1. Periodic SQL dumps (e.g., every hour or on demand)
2. Store in cloud-synced location (Dropbox preferred, QNAP_BU_2 as fallback)
3. Retain multiple backup versions with timestamp naming
4. Integrate with existing `npm run db:backup` workflow

**Files to modify**:
- `scripts/backup-db.sh` - Add cloud sync target
- `package.json` - Add `db:backup:cloud` script
- Consider cron/systemd timer for automation

**Notes**:
- Dropbox location: `/home/endlessblink/my-projects/Sync/Dropbox` (needs Dropbox service running)
- QNAP location: `/media/endlessblink/QNAP_BU_2/linux-system-bu/`

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

- [ ] Add viewport persistence to localStorage (key: `flowstate-canvas-viewport`)
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
  localStorage.setItem('flowstate-canvas-viewport', JSON.stringify(viewport))
})
```

**Files to Modify**:

- `src/composables/canvas/useCanvasNavigation.ts` - Add viewport persistence logic
- `src/composables/canvas/useCanvasOrchestrator.ts` - Initialize viewport on mount
- `src/views/CanvasView.vue` - Wire up viewport restoration

---

### TASK-313: Canvas Multi-Select Batch Status Change (📋 PLANNED)

**Priority**: P2-MEDIUM
**Complexity**: Medium
**Status**: Planned
**Created**: January 18, 2026

**Feature**: When multiple tasks are selected on the canvas, provide a batch action to change the status of all selected tasks at once.

**Current Behavior**:
- Users can select multiple tasks on the canvas
- No batch operations available for selected tasks
- Status changes require editing each task individually

**Desired Behavior**:
- When 2+ tasks are selected, show a context menu option "Change Status"
- Clicking opens a submenu/dropdown with status options (Plan, Todo, In Progress, Done, etc.)
- Selecting a status applies it to ALL selected tasks

**Implementation Ideas**:
- [ ] Add "Change Status" option to multi-select context menu
- [ ] Create submenu with all available status options
- [ ] Batch update selected tasks via task store
- [ ] Show success toast with count of updated tasks
- [ ] Preserve selection after status change

**Files to Modify**:
- `src/components/canvas/CanvasContextMenu.vue` - Add batch status option
- `src/composables/canvas/useCanvasInteractions.ts` - Handle batch status change
- `src/stores/tasks/taskCrud.ts` - Add batch update method if needed

---

### TASK-324: PWA Install Prompt Component (✅ DONE)

**Priority**: P2-MEDIUM
**Related**: ROAD-004 (PWA Mobile Support)
**Created**: January 19, 2026

**Problem**: No `ReloadPrompt.vue` component to handle PWA updates and install prompts.

**Solution**: Create component per PWA plan (`plans/pwa-mobile-support.md` lines 219-257)

**Implementation**:
- [x] Create `src/components/common/ReloadPrompt.vue` component
- [x] Handle "update available" events from service worker
- [x] Show toast notification when new version available
- [x] Add "Reload" button with sync guard (wait for pending saves)
- [x] Show "offline ready" notification on first install
- [x] Integrate component in `src/App.vue`

**Key Files**:
- `src/components/common/ReloadPrompt.vue` (create)
- `src/App.vue` (add component)

**Success Criteria**:
- [ ] Update available toast shown when new SW available
- [ ] Reload button works (with sync guard)
- [ ] Offline ready notification shown

---

### TASK-325: VPS Deployment Configuration (✅ DONE)

**Priority**: P2-MEDIUM
**Related**: ROAD-004 (PWA Mobile Support)
**Created**: January 19, 2026

**Problem**: No deployment pipeline for VPS hosting.

**Solution**:
1. Create Caddyfile for auto-HTTPS
2. Create GitHub Actions deploy workflow
3. Configure SSL and security headers
4. Document rollback procedure

**Implementation**:
- [x] Create `Caddyfile` with auto-SSL configuration
- [x] Create `.github/workflows/deploy.yml` for VPS deployment
- [x] Configure security headers (CSP, HSTS, X-Frame-Options)
- [x] Create `docs/sop/deployment/VPS-DEPLOYMENT.md` with rollback docs
- [x] Test deployment on staging environment

**Key Files**:
- `Caddyfile` (create)
- `.github/workflows/deploy.yml` (create)
- `docs/sop/deployment/VPS-DEPLOYMENT.md` (create)

**Success Criteria**:
- [ ] Push to main triggers auto-deploy
- [ ] HTTPS working with valid certificate
- [ ] Rollback documented and tested

---

### TASK-326: PWA Cross-Device Testing (✅ DONE)

**Priority**: P2-MEDIUM
**Related**: ROAD-004 (PWA Mobile Support)
**Created**: January 19, 2026

**Problem**: PWA not tested on real devices.

**Solution**:
1. Test install on iOS Safari
2. Test install on Android Chrome
3. Test offline mode on both
4. Document device-specific limitations

**Testing Matrix**:
- [x] iOS Safari - Install PWA to home screen
- [x] iOS Safari - Offline mode functionality
- [x] Android Chrome - Install PWA
- [x] Android Chrome - Offline mode functionality
- [x] Desktop Chrome - Install and offline
- [x] Run Lighthouse PWA audit

**Success Criteria**:
- [ ] Installable on iOS Safari
- [ ] Installable on Android Chrome
- [ ] Offline mode works on both platforms
- [ ] Lighthouse PWA score >= 90

---

### ~~TASK-314~~: Highlight Active Timer Task Across All Views (✅ DONE)

**Priority**: P2-MEDIUM
**Complexity**: Low
**Status**: ✅ DONE (2026-01-18)
**Created**: January 18, 2026

**Feature**: Visual feedback when a task has an active timer running, across all views.

**Final State**:
- ✅ Canvas: `TaskNode.vue` - blue glow (pre-existing)
- ✅ Calendar: `CalendarTaskCard.vue` - pulsing timer icon (pre-existing)
- ✅ Board: `TaskCard.vue` - amber glow with pulse animation
- ✅ Catalog: `TaskRow.vue` - amber glow with pulse animation
- ✅ Catalog: `HierarchicalTaskRowContent.vue` - amber glow with pulse animation

**Implementation**:
- [x] Add timer store import to TaskCard.vue (Board)
- [x] Add `isTimerActive` computed property
- [x] Add `.timer-active` CSS class with amber glow and pulse animation
- [x] Same for TaskRow.vue and HierarchicalTaskRowContent.vue

**Design Tokens Used**:
- `--timer-active-border` - Amber border
- `--timer-active-glow` - Subtle amber glow
- `--timer-active-glow-strong` - Pulse animation glow
- `--timer-active-shadow` - Shadow for depth

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

**Resolution**: Removed - the proposed `window.__flowstateAgent` pattern is too simple to be meaningful. Playwright already covers testing needs. If AI integration becomes a goal, MCP (Model Context Protocol) would be the proper foundation, not a thin CRUD wrapper.

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

---

### January 20, 2026: Data Crisis & System Stabilization

**Priority**: P0-CRITICAL
**Status**: 🔄 IN PROGRESS
**Crisis Analysis**: [reports/2026-01-20-auth-data-loss-analysis.md](../reports/2026-01-20-auth-data-loss-analysis.md)

On Jan 20, 2026, a major data crisis occurred where `auth.users` were wiped and backup systems failed to recover the data due to root causes in persistence and automation.

| ID | Issue | Root Cause | Status | Deep Context |
|----|-------|------------|--------|--------------|
| 1 | Auth wiped | No DB volumes | **Fixed** | Supabase restart lost `auth.users`; recreated with original UUID. |
| 2 | Seed missing | Partial `seed.sql` | **Fixed** | Added `endlessblink@gmail.com` with UUID `717f5209-42d8-4bb9-8781-740107a384e5`. |
| 3 | Shadow-mirror | Automation gap | **Partial** | Script exists but wasn't auto-running; now manually verified. |
| 4 | LocalStorage | Tauri ID mismatch | **Fixed** | Pointed to `com.flowstate.app` instead of `com.pomoflow.desktop`. |
| 5 | Role detector | String check bug | **Fixed** | Corrected `shadow-mirror.cjs` to check decoded payload for service role. |
| 6 | Password lost | Reset required | **Resolved** | Used temporary password for recovery. |
| 7 | Download stuck | Tauri Webview bug | **Workaround** | Manual extraction; native dialog fix planned in TASK-332. |
| 8 | Schema error | PostgREST Cache | **Fixed** | Service restart cleared schema cache issues. |
| 9 | Golden Offline | Conn. required | **Expected** | Feature requires Supabase connectivity for validation. |
| 10| Data mismatch | Local > Cloud | **Active** | 53 local tasks vs 42 cloud; reconciliation required. |

#### Roadmap Updates (Crisis Stabilization)

##### TASK-329: Auth & Data Persistence Hardening (✅ DONE)
- [x] Implement `post-start` hook to verify `endlessblink` user exists.
- [x] Configure PostgreSQL data persistence in Docker volume more robustly.
- [x] Update `useSupabaseDatabase.ts` to retry auth on 401/403 with exponential backoff.

##### TASK-330: Shadow-Mirror Reliability & Automation (✅ DONE)
- [x] Implement automatic `supabase stop --backup` hook via `scripts/db-stop.sh`.
- [x] Add `npm run shadow` trigger to `npm run dev` startup (via `backup:watch`).
- [x] Add cron-like monitoring to ensure `shadow.db` is updating every 5 minutes.
- [x] Add `auth.users` export via `docker exec` to `shadow-mirror.cjs` (✅ Done).

##### TASK-331: Tauri Multi-App Migration (LocalStorage) (📋 PLANNED)
- [ ] Create migration script to copy data from `com.pomoflow.desktop` to `com.flowstate.app`.
- [ ] Update all persistence layers to use the unified app name.

##### TASK-332: Backup Reliability & Verification (📋 PLANNED)
- [ ] Fix Tauri native file dialog for "Download Backup" button.
- [ ] Implement Golden Backup rotation (keep last 3 peak task counts).
- [ ] Add Automated Backup Verification tests.

##### TASK-333: Independent Audit of Crisis Analysis (🔄 IN PROGRESS)
- [ ] Spawn independent QA Supervisor via `dev-maestro`.
- [ ] Verify consistency between documented fixes and codebase state.
- [ ] Review crisis report for any missing deep context or technical inaccuracies.

---

#### Related
- [TASK-317: Shadow Backup Deletion-Aware Restore](#task-317-shadow-backup-deletion-aware-restore--supabase-data-persistence-done)
- [Crisis Report](../reports/2026-01-20-auth-data-loss-analysis.md)
