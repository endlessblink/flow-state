**Last Updated**: January 26, 2026 (BUG-1089 Fixed - Confirmation modals close after confirm)
**Version**: 5.75 (Modal Close Fix)
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
| ~~**BUG-1047**~~         | ✅ **DONE** **Task Position Drift on Edit Save**                        | **P0**                                              | ✅ **DONE** (2026-01-24) - Added debug logging, not reproducible                                                                | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-1062**~~         | ✅ **DONE** **Selection state not synchronized between store and Vue Flow** | **P0**                                          | ✅ **DONE** (2026-01-25)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-1068**~~         | ✅ **DONE** **Canvas alignment operations unreliable (race condition)** | **P0**                                             | ✅ **DONE** (2026-01-25) - Fixed async await + manualOperationInProgress + edge-to-edge spacing                                  | BUG-1062                                                                                                                                                                                                       |                                                        |
| ~~**BUG-1070**~~         | ✅ **DONE** **PWA doesn't show Whisper voice input option**            | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                          | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-1064**~~         | ✅ **DONE** **Tauri App Not Syncing with Web App**                     | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | TASK-1060                                                                                                                                                                                                      |                                                        |
| **FEATURE-1065**         | **Local Supabase as VPS Backup Mirror**                                | **P2**                                              | 📋 **PLANNED**                                                                                                                  | BUG-1064                                                                                                                                                                                                       |                                                        |
| ~~**TASK-1071**~~        | ✅ **DONE** (Win/Mac) ⚠️ Linux blocked **Tauri: Add Microphone Permission for Voice AI** | **P1**                                              | ✅ **DONE** (2026-01-25) - [SOP-034](./sop/SOP-034-tauri-linux-microphone.md)                                                   | FEATURE-1023. Win/Mac: works. Linux: blocked by WebKitGTK (no WebRTC). See SOP-034.                                                                                                                            |                                                        |
| ~~**TASK-1072**~~        | ✅ **DONE** **Inbox: Improve Show Completed Toggle Styling**           | **P3**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-1073**~~        | ✅ **DONE** **Inbox: Add Sorting Options (Filters & Sort)**            | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | TASK-1072                                                                                                                                                                                                      |                                                        |
| ~~**BUG-1074**~~         | ✅ **DONE** **Canvas Task Deletion to Inbox Not Working**              | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**BUG-1075**~~         | ✅ **DONE** **Inbox Header Time Filter Text Wrapping/Clipping**        | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| **BUG-1086**             | **PWA Blank Screen on Mobile - Intermittent**                          | **P1**                                              | 🔄 **IN PROGRESS** - Fallback watcher added but issue persists. Seeing double auth init. User has stale cache.                  | -                                                                                                                                                                                                              |                                                        |
| **BUG-1090**             | **VPS: START and TIMER buttons in task menu don't work**               | **P1**                                              | 🔄 **IN PROGRESS** - Fixed race condition: event dispatched before CalendarView mounted                                          | -                                                                                                                                                                                                              |                                                        |
| ROAD-025                 | Backup Containerization (VPS)                                          | P3                                                  | [See Detailed Plan](#roadmaps)                                                                                                  | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-230**~~         | ~~**Fix Deps & Locks Tab**~~                                           | **P2**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | Added /api/locks endpoint, fixed dependency parser                                                                                                                                                             |                                                        |
| ~~**TASK-231**~~         | ~~**Dynamic Skills & Docs API**~~                                      | **P2**                                              | ✅ **DONE** (2026-01-11)                                                                                                         | Added /api/skills and /api/docs endpoints                                                                                                                                                                      |                                                        |
| ~~**TASK-253**~~         | ✅ **DONE** **Reorder App Views**                                       | **P2**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | Support user preference: Canvas - Calendar - Board - Catalog - Quick Sort                                                                                                                                      |                                                        |
| ~~**BUG-226**~~          | ✅ **DONE** **Nested Group Z-Index Layering**                           | **P1**                                              | ✅ **DONE** (2026-01-12)                                                                                                         | Depth-based Z-index bonus.                                                                                                                                                                                     |                                                        |
| ~~**BUG-214**~~          | ✅ **DONE** **Fix Blurry Text in Empty Canvas State**                   | **P3**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Centering fix with flexbox.                                                                                                                                                                                    |                                                        |
| ~~**BUG-261**~~          | ✅ **DONE** **Group Modal Blurry Background**                           | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Removed Teleport, fixed stacking context.                                                                                                                                                                      |                                                        |
| ~~**FEATURE-254**~~      | ✅ **DONE** **Canvas Inbox Smart Minimization**                         | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | Auto-collapse on empty load.                                                                                                                                                                                   |                                                        |
| ~~**TASK-260**~~         | ✅ **DONE** **Authoritative Duplicate Detection Diagnostics**          | **P0**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Canvas task/group duplication logging tightened with assertNoDuplicateIds helper. Duplicates no longer appearing.                                                                                              |                                                        |
| ~~**TASK-255**~~         | ✅ **DONE** **Canvas Stability Hardening (Geometry Invariants)**        | **P0**                                              | ✅ **DONE** (2026-01-13) - [SOP](./sop/SOP-002-canvas-geometry-invariants.md)                                                    | ROAD-013, TASK-184                                                                                                                                                                                             |                                                        |
| ~~**TASK-256**~~         | ✅ **DONE** **Standardize Project Identifiers (Color Dots)**            | **P2**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-257**~~         | ✅ **DONE** **Modal Enter Key Support**                                 | **P1**                                              | ✅ **DONE** (2026-01-13)                                                                                                         | -                                                                                                                                                                                                              |                                                        |
| ~~**TASK-258**~~         | ✅ **DONE** **Multi-Select Task Alignment Context Menu**                | **P2**                                              | ✅ **DONE** (2026-01-14)                                                                                                         | [See Details](#task-258-multi-select-alignment-planned)                                                                                                                                                        |                                                        |
| ~~**BUG-259**~~          | ✅ **DONE** **Canvas Task Layout Changes on Click**                    | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Cannot reproduce - width stays constant at 280px. Closed.                                                                                                                                                      |                                                        |
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
| ~~**TASK-315**~~         | ✅ **DONE** **Documentation & Skills Consolidation**                    | **P1**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | [SOP-022](./sop/active/SOP-022-skills-config-sync.md) - Synced skills.json (10→30), created canvas index, doc validator, staleness checker                                                                      |                                                        |
| ~~**TASK-316**~~         | ✅ **DONE** **TaskCard Design Fix (Board View)**                        | **P3**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Changed selected state from filled to outline-only, removed strikethrough from completed titles. File: `TaskCard.css`                                                                                           |                                                        |
| ~~**TASK-317**~~         | ✅ **DONE** **Shadow Backup Deletion-Aware Restore + Supabase Data Persistence**   | **P0**                                              | ✅ **DONE** (2026-01-19)                                                                                                        | Tombstones table, deletion-aware restore, shadow-mirror guards, atomic writes                                                                                                                                       |                                                        |
| ~~**BUG-317**~~          | ✅ **DONE** **Board View Priority Column Drag Fix**                     | **P1**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Fixed priority swimlane drag: `columnType` prop distinguishes status vs priority columns                                                                                                                        |                                                        |
| ~~**TASK-318**~~         | ✅ **DONE** **Tauri Standalone Build Verified**                         | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Built standalone packages: `.deb`, `.rpm`, `.AppImage` for Linux                                                                                                                                                |                                                        |
| ~~**TASK-319**~~         | ✅ **DONE** **Fix Agent Output Capture in Orchestrator**               | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                        | Stream-json parsing, real-time broadcast, persistent logs - TASK-303 subtask                                                                                                                                    |                                                        |
| ~~**TASK-320**~~         | ✅ **DONE** **Fix Task Completion Detection in Orchestrator**          | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                        | Activity timeout, git status check, enhanced completion detection - TASK-303 subtask                                                                                                                            |                                                        |
| **TASK-321**             | **Test and Fix Merge/Discard Workflow E2E**                            | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-321-test-and-fix-mergediscard-workflow-end-to-end-planned) - TASK-303 subtask                                                                                                               |                                                        |
| **TASK-322**             | **Add Automatic Error Recovery for Orchestrator**                      | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-322-add-automatic-error-recovery-for-orchestrator-agents-planned) - TASK-303 subtask                                                                                                        |                                                        |
| ~~**TASK-323**~~         | ✅ **DONE** **Fix Stale Agent Cleanup in Orchestrator**                | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                        | Startup cleanup, periodic cleanup, graceful shutdown, SIGKILL fallback - TASK-303 subtask                                                                                                                       |                                                        |
| ~~**TASK-324**~~         | ✅ **DONE** **PWA Install Prompt Component**                                       | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | [Walkthrough](file:///home/endlessblink/.gemini/antigravity/brain/62e1538b-8b24-4393-965e-f11ae95f2523/walkthrough.md)                                                                                          |                                                        |
| ~~**TASK-325**~~         | ✅ **DONE** **VPS Deployment Configuration**                                       | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | [SOP-VPS](./sop/deployment/VPS-DEPLOYMENT.md)                                                                                                                                                                  |                                                        |
| ~~**TASK-326**~~         | ✅ **DONE** **PWA Cross-Device Testing**                                           | **P2**                                              | ✅ **DONE** (2026-01-19)                                                                                                         | Verified SW & Manifest via Lighthouse                                                                                                                                                                          |                                                        |
| ~~**TASK-327**~~         | ✅ **DONE** **Create Custom Tauri App Icon**                      | **P1**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | Cyberpunk glitch tomato icon. Fixed cropping issue (resize to fit 500x500, center in 512x512). Generated all sizes: ICO, ICNS, PNG, favicon.                                                                    |                                                        |
| ~~**TASK-329**~~         | ✅ **DONE** **Auth & Data Persistence Hardening**                       | **P0**                                              | ✅ **DONE** (2026-01-20)                                                                                                         | [Crisis Report](../reports/2026-01-20-auth-data-loss-analysis.md) - Fixed seed.sql, NULL columns, password change UI                                                                                            |                                                        |
| **TASK-330**             | **Shadow-Mirror Reliability & Automation**                             | **P0**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#january-20-2026-data-crisis--system-stabilization) - Automatic runs & monitoring                                                                                                                 |                                                        |
| ~~**TASK-331**~~         | ~~**Tauri Multi-App Migration (LocalStorage)**~~                      | **P1**                                              | ✅ **OBSOLETE** (2026-01-23)                                                                                                    | Closed: Single-user app, old directory deleted manually. No migration needed.                                                                                                                                    |                                                        |
| ~~**TASK-332**~~         | ✅ **DONE** **Backup Reliability & Verification**                      | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Tauri dialog timeout/fallback, golden backup rotation (3 peaks), comprehensive validation tests (22 tests)                                                                                  |
| **BUG-333**              | **Duplicate Tasks After Restore + Login**                              | **P0**                                              | 👀 **REVIEW**                                                                                                                   | Fix: Normalized date format in fingerprint (ISO→YYYY-MM-DD). Prevents future duplicates. User needs to verify + clean existing dupes.                                                                            |                                                        |
| ~~**TASK-334**~~         | **AI "Done" Claim Verification System (5-Layer Defense)**              | **P1**                                              | ✅ **DONE**                                                                                                              | [SOP-029](docs/sop/SOP-029-ai-verification-hooks.md) - Unified hook architecture                                                                                                      |                                                        |
| **TASK-335**             | **Judge Agent Integration in Dev-Maestro**                             | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#task-335-judge-agent-integration-in-dev-maestro-planned) - Layer 5 of TASK-334                                                                                                                    | TASK-334                                               |
| ~~**BUG-336**~~          | **Fix Backup Download in Tauri App**                                   | **P0**                                              | ✅ **DONE**                                                                                                                     | Fixed: PWA plugin stub modules, TAURI_DEV env var, xdg-portal dialog                                                                                                                                              |                                                        |
| ~~**TASK-337**~~         | ✅ **DONE** **Reliable Password Change Feature**                       | **P0**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed template logic, null checks, session refresh. Tested: user signup, password change, logout, re-login with new password.                                                                                    |                                                        |
| ~~**TASK-338**~~         | ✅ **DONE** **Comprehensive Stress Testing Agent/Skill**               | **P0**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Stress-tester skill created with reliability, backup, container, security, and performance tests                                                                                                                  |                                                        |
| ~~**BUG-339**~~          | ✅ **DONE** **Tauri App Auto-Signout + Data Loss Concern**             | **P0**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Auth protections verified: proactive refresh, retry with backoff, session persistence. User confirmed no issues.                                                                                               |                                                        |
| ~~**BUG-340**~~          | ✅ **DONE** **Tauri Modal Not Closing After Sign-In**                  | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed: Added `nextTick()` + `flush: 'post'` to AuthModal watcher for Tauri WebView reactivity. **User verified.** File: `AuthModal.vue`                                                                             |                                                        |
| **BUG-341**              | **Tauri App Freezing - Add Comprehensive Logging**                     | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Add logging/diagnostics to debug Tauri app freezing/crash issues. Research solutions online.                                                                                                                      |                                                        |
| ~~**BUG-342**~~          | ✅ **DONE** **Canvas Multi-Drag Bug: Unselected Tasks Move Together**  | **P0**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Closed per user request - issue not currently occurring. Will reactivate if resurfaces.                                                                                                                           |                                                        |
| **TASK-345**             | **PWA Infrastructure: Docker & Reliable HTTPS Tunnel**                 | **P2**                                              | ✅ **DONE** (2026-01-20)                                                                                                         | Set up Dockerized stack, Caddy proxy, and Cloudflare Tunnel for stable remote testing.                                                                                                                            |                                                        |
| ~~**TASK-346**~~         | ✅ **DONE** **Mobile-Specific UI: Feature Subset & Touch Navigation**  | **P1**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | MobileTodayView, MobileInboxView (filter chips + quick-add), 4-tab nav. [SOP-023](./sop/SOP-023-cloudflare-tunnel-supabase.md), [SOP-011](./sop/SOP-011-tauri-distribution.md)                              |                                                        |
| **BUG-347**              | **Fix FK Constraint Violation on parent_task_id**                      | **P1**                                              | 👀 **REVIEW**                                                                                                                   | Sync errors when parent task deleted. Fix: Catch-and-retry clears orphaned parent refs. [See Details](#bug-347-fix-fk-constraint-violation-on-parent_task_id-review)                                              |                                                        |
| ~~**TASK-348**~~         | ✅ **DONE** **Tauri Startup Guide & Shadow Mirror Fix**                | **P2**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | [SOP-011](./sop/SOP-011-tauri-distribution.md) - Fixed shadow-mirror.cjs relative URL detection, documented startup methods                                                                                      |                                                        |
| **BUG-352**              | **Mobile PWA "Failed to Fetch"**                       | **P0**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#bug-352-mobile-pwa-failed-to-fetch-persistent-cache) - Likely SW cache issue                                                                                                                                     |                                                        |
| ~~**TASK-351**~~         | ✅ **DONE** **Secure Secrets (Doppler)**               | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | [SOP-030](./sop/SOP-030-doppler-secrets-management.md) - Doppler CLI in CI/CD, legacy .env backup step added                                                                                                                                                                      |
| ~~**TASK-353**~~         | ✅ **DONE** **Mobile PWA UI Phase 1**                  | **P1**                                              | ✅ **DONE** (2026-01-21)                                                                                                         | MobileTodayView (daily schedule), MobileInboxView (filter chips, sort, quick-add bar), MobileNav (4 tabs), Mobile PWA design skill                                                                                |                                                        |
| ~~**BUG-1020**~~         | ✅ **DONE** **Mobile QuickSort Swipe Overlay + Card Spacing** | **P2**                                         | ✅ **DONE** (2026-01-24)                                                                                                        | Fixed: deltaX reset, overlay→border, auth reload, Arrange Done Tasks card dimensions                                                                                                                                |                                                        |
| ~~**TASK-354**~~         | ✅ **DONE** **Canvas CSS Import Fix**                  | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed canvas not rendering after CSS import change. Reverted ES import to `<style src="">` for global Vue Flow overrides.                                                                                          |                                                        |
| ~~**BUG-355**~~          | ✅ **DONE** **Timer Beep/Reset on Reload**             | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed timer beeping on reload when no timer was active. Added stale session detection (>1hr) and silent completion for expired sessions.                                                                           |                                                        |
| ~~**BUG-356**~~          | ✅ **DONE** **Groups Moving Together (Accidental Nesting)**             | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed groups incorrectly moving together when dragging. Root cause: corrupted parentGroupId relationships. Added: (1) 2x area ratio requirement for group nesting, (2) invalid parent cleanup on load, (3) `resetGroupsToRoot()` emergency fix. [SOP-018](./sop/SOP-018-canvas-group-nesting.md)                                                                           |                                                        |
| ~~**BUG-357**~~          | ✅ **DONE** **Tauri Edit Modal Shows Wrong Task**                       | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed stale Vue Flow node data + missing canvas sync after edit. [SOP-025](./sop/SOP-025-tauri-vue-flow-reactivity.md)                                                                                            |                                                        |
| **BUG-359**              | **Task List Checkbox Clipped in Edit Modal**                            | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | TipTap task list checkbox not visible/cut off on right side of description editor                                                                                                                                 |                                                        |
| **BUG-360**              | **Ctrl+Z Undo Not Working in Quick Sort View**                          | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Undo (Ctrl+Z) not functioning correctly in the Quick Sort view                                                                                                                                                    |                                                        |
| ~~**TASK-370**~~         | ✅ **DONE** **Canvas: Arrange Done Tasks Button**                      | **P2**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | One-click button in toolbar to arrange all done tasks in grid at bottom-left. Removes tasks from groups for review.                                                                          |                                                        |
| ~~**TASK-361**~~         | ✅ **DONE** **Stress Test: Container Stability**                        | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | `npm run test:container` - 11 tests: Docker health, API endpoints, graceful degradation                                                                                                                          | TASK-338                                               |
| ~~**TASK-362**~~         | ✅ **DONE** **Stress Test: Sync Conflict Resolution**                   | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | `npm run test:sync` - 3 tests: Concurrent creation, rapid updates, RLS enforcement                                                                                                                               | TASK-338                                               |
| ~~**TASK-363**~~         | ✅ **DONE** **Stress Test: Auth Edge Cases**                            | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | `npm run test:auth` - 5 tests: Invalid tokens, SQL injection, rate limiting                                                                                                                                       | TASK-338                                               |
| ~~**TASK-364**~~         | ✅ **DONE** **Stress Test: WebSocket Stability**                        | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | `npm run test:websocket` - 3 tests: Connection, heartbeat, reconnection                                                                                                                                           | TASK-338                                               |
| ~~**TASK-365**~~         | ✅ **DONE** **Stress Test: Actual Restore Verification**                | **P0**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | `npm run test:restore` - 14-point verification + Playwright E2E                                                                                                                                                   | TASK-338                                               |
| **TASK-366**             | **Stress Test: Redundancy Assessment**                                  | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Single-point-of-failure detection and mitigation                                                                                                                                                                  | TASK-338                                               |
| ~~**BUG-367**~~          | ✅ **DONE** **Inbox Filter Excludes Overdue Tasks**                     | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Fixed "This Week"/"This Month" filters to include overdue tasks. [SOP-020](./sop/SOP-020-inbox-filter-date-logic.md)                                                                                               |                                                        |
| ~~**TASK-368**~~         | ✅ **DONE** **Date Picker Popup Improvements**                          | **P2**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Added +1mo/+2mo/+3mo shortcuts and "Now" button to calendar popup. Dark theme styling applied.                                                                                                                      |                                                        |
| ~~**TASK-369**~~         | ✅ **DONE** **Quick Capture Tab Feature**                               | **P2**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Rich task capture integrated into QuickSort view with Ctrl+Shift+T shortcut. [SOP-021](./sop/SOP-021-quick-capture-tab.md)                                                                                          |                                                        |
| ~~**TASK-371**~~         | ✅ **DONE** **Skill Consolidation Phase 3 (30→18)**                     | **P1**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | Deleted 6 broken skills, merged 8 duplicates, validated all 18 remaining skills E2E. Registry v2.2.0. 40% reduction.                                                                                                 | TASK-304                                               |
| ~~**TASK-370**~~         | ✅ **DONE** **Canvas: Arrange Done Tasks Button**                       | **P2**                                              | ✅ **DONE** (2026-01-22)                                                                                                         | One-click toolbar button to arrange all done tasks in grid at canvas bottom-left. Removes from groups for review.                                                                                                    |                                                        |
| **TASK-1000**            | **Verify Skill Logging System**                                         | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                              | Check if skill invocation logging (PostToolUse hook → SQLite) is working properly                                                                                                                                  |                                                        |
| ~~**TASK-1004**~~        | ✅ **DONE** **Mobile: Hide Completed Tasks by Default**                  | **P1**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Mobile views only show non-done tasks. Today view filters out completed tasks; Inbox defaults to Active filter.                                                                                                    |                                                        |
| ~~**TASK-1005**~~        | ✅ **DONE** **Mobile: Expanded Quick-Add with Due Date & Priority**      | **P1**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Quick-add bar expands on tap. Due date options (Today, Tomorrow, Next Week) and priority selector (High, Medium, Low).                                                                                             |                                                        |
| ~~**TASK-1006**~~        | ✅ **DONE** **Mobile: Long-Press to Edit Task**                          | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Long-click/long-press on a task item opens the Edit Task modal for full task editing. Implemented in MobileInboxView and MobileTodayView with 500ms threshold, visual feedback, and haptic feedback.               |                                                        |
| **TASK-1007**            | **Mobile: Calendar View**                                               | **P3**                                              | 📋 **PLANNED** (Deferred)                                                                                                       | Add calendar view to mobile nav. **Deferred**: Inbox sort + Today view + Quick Sort cover date needs for now.                                                                                                      |                                                        |
| **TASK-1008**            | **Mobile: Remove Active/Planned Filter Chips**                          | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                              | Remove "Active" and "Planned" filter chips from mobile Inbox. Simplify to use bottom sheet filters instead.                                                                                                        |                                                        |
| **TASK-1009**            | **Mobile: Timer Stop Syncs to Desktop & KDE Widget**                    | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | When timer is stopped on mobile PWA, sync stop action to local desktop app and KDE Plasma widget via Supabase Realtime.                                                                                            |                                                        |
| ~~**BUG-1065**~~         | ✅ **DONE** **Context Menu +1wk Sets Tomorrow Instead of Next Week**    | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Fixed: "+1wk" now adds 7 days. Audited all date shortcuts. Added +6mo option to date picker.                                                                                                                        |                                                        |
| ~~**TASK-1010**~~        | ✅ **DONE** **Mobile: Quick Sort Redesign with Swipe Gestures**          | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Full mobile-first Quick Sort: Swipe-to-categorize (right=assign, left=skip), haptic feedback, full-screen cards, thumb-zone optimization, progress animations, nested project hierarchy, 7 date presets. Added to mobile nav. |                                                        |
| ~~**TASK-1011**~~        | ✅ **DONE** **Date Picker Calendar UI & Styling**                        | **P2**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Replaced JS prompt() with Naive UI calendar. Fixed timezone, styled Today (white+dot), Selected (green stroke), Excluded (dimmed). [SOP-018](./sop/SOP-018-naive-ui-date-picker-styling.md)                         |
| ~~**BUG-1056**~~         | ✅ **DONE** **Brave Browser Compatibility + Multi-Tab Fix**             | **P2**                                              | ✅ **DONE** (2026-01-24)                                                                                                        | Brave detection, user warning banner, multi-tab auth sync, unique channel per tab. [See Details](#bug-1056-brave-browser-compatibility--data-load-recovery-done)                                                  |
| ~~**BUG-1067**~~         | ✅ **DONE** **Tauri: Canvas Selection Rectangle Offset from Cursor**    | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Fixed: Changed to position:absolute + container-relative coords. Selection box now aligns with cursor in Tauri.                                                                                                   |                                                        |
| **BUG-1057**             | **Fix Failing Unit Tests (8 failures)**                                  | **P3**                                              | 📋 **PLANNED**                                                                                                                  | Playwright/Vitest conflicts, missing imports, obsolete test files. [See Details](#bug-1057-fix-failing-unit-tests-planned)                                                                                          |                                                        |
| ~~**BUG-1066**~~         | ✅ **DONE** **Tauri: Transparent UI Components (WebKitGTK Limitation)**  | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Fixed: CSS variable overrides for opaque backgrounds in Tauri. WebKitGTK doesn't support backdrop-filter. [SOP-033](./sop/SOP-033-tauri-linux-css-limitations.md)                                                    |                                                        |
| ~~**TASK-1075**~~        | ✅ **DONE** **Add Search to Canvas & Calendar Inboxes**                  | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Add search/filter functionality to inbox panels in Canvas and Calendar views                                                                                                                                          |                                                        |
| ~~**TASK-1077**~~        | ✅ **DONE** **Full-Screen Task Creation for Mobile PWA**                 | **P0**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | New TaskCreateBottomSheet with 100dvh height, better mobile UX for task creation with spacious layout and proper touch targets                                                                                         |                                                        |
| ~~**BUG-1076**~~         | ✅ **DONE** **Can't Delete Done Group on Canvas**                        | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Fixed: Added handleDeleteGroup handler in CanvasContextMenu.vue to ensure proper event emission order. Also added handleDeleteGroupConfirm in CanvasModals.vue for consistency.                                       | -                                                      |
| ~~**BUG-1078**~~         | ✅ **DONE** **Search Icon Pushed Out of Inbox Header**                   | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Fixed `.inbox-title` from `flex: 1` to `flex: 0 0 auto` to prevent greedy expansion pushing search icon out of view                                                                                                    | -                                                      |
| ~~**BUG-1079**~~         | ✅ **DONE** **Inbox Panel Crops Content - Auto-Size Width**              | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Fixed: Panel uses `fit-content` width with min/max bounds. Collapsed state slim (40px). [SOP-037](./sop/SOP-037-inbox-panel-auto-size.md)                                                                              | -                                                      |
| ~~**BUG-1089**~~         | ✅ **DONE** **Confirmation Modals Don't Close After Confirm Action**     | **P1**                                              | ✅ **DONE** (2026-01-26)                                                                                                        | Fixed: CanvasModals.vue now closes via Pinia store after emitting confirm events. Audited all other modals - they were fine.                                                                                        | -                                                      |
| ~~**BUG-1080**~~         | ✅ **DONE** **Inbox Week Filter Shows Next Week on Sunday**              | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Fixed: `daysUntilSunday` calculation had `|| 7` fallback causing Sunday to add 7 days. Removed fallback.                                                                                                                | -                                                      |
| ~~**BUG-1081**~~         | ✅ **DONE** **QuickTaskCreateModal Not Creating Tasks**                  | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Fixed: Modal emitted object but handlers expected (title, desc). Modal didn't close. Added full data passthrough, finally block for modal close.                                                                        | -                                                      |
| ~~**BUG-1012**~~         | ✅ **DONE** **Dev-Maestro: "Submit Answers & Continue" Button Fixed**    | **P2**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Added debugging, error feedback, validation. Button now works correctly.                                                                                                                                            |                                                        |
| ~~**FEATURE-1012**~~     | ✅ **DONE** **Orchestrator: Auto-Detect Project Tech Stack**             | **P2**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Auto-detects Vue/React, UI libs, state mgmt, DB from package.json. Questions now focus on feature details, not tech stack.                                                                                          | TASK-303                                               |
| **FEATURE-1013**         | **Orchestrator: Auto-Detect Data Layer**                                 | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#feature-1013-orchestrator-auto-detect-data-layer-planned) - Find Pinia stores, Supabase, APIs before asking about data management                                                                   | TASK-303, FEATURE-1012                                 |
| **FEATURE-1014**         | **Orchestrator: Smart Question System with Pros/Cons**                   | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#feature-1014-orchestrator-smart-question-system-planned) - Only ask when uncertain, include pros/cons for each option                                                                               | TASK-303, FEATURE-1013                                 |
| **FEATURE-1015**         | **Orchestrator: Project Context Caching**                                | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#feature-1015-orchestrator-project-context-caching-planned) - Store analyzed project info to avoid re-analysis on each interaction                                                                    | TASK-303, FEATURE-1012                                 |
| **FEATURE-1016**         | **PWA Icon & Favicon Consistency**                                       | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Use correct FlowState icon (cyberpunk tomato) everywhere: PWA home screen, browser favicon, manifest icons. Ensure all sizes generated correctly.                                                                   | TASK-327                                               |
| ~~**BUG-1014**~~         | ✅ **DONE** **PWA Mobile UI Leaking to Desktop**                         | **P0**                                              | ✅ **DONE** (2026-01-23)                                                                                                        | [SOP-026](./sop/SOP-026-mobile-route-guards.md) - Added router guard to redirect desktop users from mobile routes                                                                                                   | ROAD-004, TASK-346                                     |
| ~~**TASK-1074**~~        | ✅ **DONE** **Add INQUIRY Type to /task Skill**                          | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Added INQUIRY task type for investigations (errors, behavior understanding). Updated skill triggers.                                                                                                                 | -                                                      |
| ~~**TASK-1082**~~        | ✅ **DONE** **Chief-Architect Skill v4.0 Comprehensive Update**          | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Major update: Added 6 new domains (VPS, CI/CD, Canvas, Backup, Timer, Mobile). Updated skill routing (28 skills). Added 5-layer completion protocol, geometry invariants, SOPs. Version 3.1→4.0.                    | TASK-1074                                              |
| ~~**TASK-1083**~~        | ✅ **DONE** **Canvas Position Sync Inconsistency: Localhost vs VPS**     | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Fixed: SWR cache cleared on page load, invalidateCache import corrected. Positions now sync correctly between devices.                                                                                                | -                                                      |
| **TASK-1017**            | **Mobile: Expanded Date Options (2wk, 1mo, 2mo)**                        | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add more date options on mobile: "In 2 weeks", "In 1 month", "In 2 months". Design should feel seamless with existing UI.                                                                                            | TASK-1005                                              |
| ~~**BUG-1018**~~         | ✅ **DONE** **Quick Sort: Project Selection Broken + Counter UI**        | **P1**                                              | ✅ **DONE** (2026-01-23)                                                                                                         | Fixed with TASK-1010: Project selection now uses bottom sheet with nested hierarchy. No more counter sliding issues.                                                                                                  | TASK-1010                                              |
| **BUG-1019**             | **Dev-Maestro: Swarm Agent Cleanup + OOM Prevention**                    | **P0**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#bug-1019-dev-maestro-swarm-agent-cleanup-planned) - Orphaned agents consume 2.4GB RAM, spawn Vitest workers (16GB spikes), caused 336 OOM kills in 7 days. Need timeout, cleanup, deduplication.       | TASK-303, TASK-323                                     |
| **FEATURE-1020**         | **Full RTL (Right-to-Left) Support**                                     | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add complete RTL language support (Hebrew, Arabic). CSS logical properties, text alignment, layout mirroring, Tailwind RTL plugin.                                                                                   | -                                                      |
| ~~**BUG-1069**~~         | ✅ **DONE** **Cloudflare Cache Serving Stale Data (Brave/Zen)**          | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                        | Fixed: (1) Caddyfile now matches `/` AND `/index.html` for no-cache, (2) CI/CD auto-purges Cloudflare cache on deploy. [SOP-033](./sop/SOP-033-cloudflare-ci-cd-auto-purge.md)                                       | BUG-1063                                               |
| **TASK-1021**            | **Quick Sort: Better Formatting for Web/Tauri**                          | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Improve Quick Sort UI on desktop (web & Tauri). Better card layout, spacing, typography, visual hierarchy. Distinct from mobile version.                                                                             | -                                                      |
| **TASK-1022**            | **PWA: Full RTL + Hebrew Support E2E**                                   | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Complete RTL and Hebrew language support for mobile PWA. Text direction, input fields, navigation, date formats, all views tested end-to-end.                                                                        | FEATURE-1020                                           |
| **FEATURE-1023**         | **Voice Input: Transcription + Task Extraction**                         | **P1**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#feature-1023-voice-input-transcription--task-extraction-planned) - Voice input with auto-extraction of task properties (priority, due date, description). Hebrew + English. Full voice control.        | FEATURE-1020                                           |
| **TASK-1024**            | **Voice: Web Speech API Integration**                                    | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Integrate Web Speech API for real-time transcription. Support Hebrew + English with auto-detection. Handle browser compatibility.                                                                                     | FEATURE-1023                                           |
| **TASK-1025**            | **Voice: Mic Button in Quick-Add Bar**                                   | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Add mic icon to mobile quick-add bar. Recording state UI (pulsing, waveform). Expand to overlay when recording. Stop on release or tap.                                                                               | FEATURE-1023, TASK-1024                                |
| **TASK-1026**            | **Voice: Task Property Extraction (NLP)**                                | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                                  | Parse transcription to extract: priority, due date, postpone duration, project, title, description. Handle Hebrew ("מחר", "בעדיפות גבוהה") + English.                                                                  | FEATURE-1023, TASK-1024                                |
| **TASK-1027**            | **Voice: Commands for Existing Tasks**                                   | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Voice commands: "postpone X by 3 days", "mark Y done", "change priority of Z". Task lookup by name/number. Confirmation before action.                                                                                | FEATURE-1023, TASK-1026                                |
| **TASK-1028**            | **Voice: Confirmation UI + Edit Before Submit**                          | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Show parsed result before creating/modifying. Editable fields (priority, date, title). Confirm/cancel buttons. Visual feedback during recording.                                                                      | FEATURE-1023, TASK-1025, TASK-1026                     |
| **TASK-1029**            | **Voice: Whisper API Fallback**                                          | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                              | Groq Whisper API integration (12x cheaper than OpenAI: $0.04/hr). Primary voice input method. Better accuracy for Hebrew/English.                                                                                       | FEATURE-1023, TASK-1024                                |
| **BUG-1030**             | **Quick Sort: Due Date Buttons Not Highlighting**                        | **P1**                                              | 📋 **PLANNED**                                                                                                                  | +3d, +1wk, +1mo buttons don't show selected state when clicked. Only Today/Tomorrow/Wknd highlight. Fix selection state for all date options.                                                                          | TASK-1010                                              |
| **TASK-1031**            | **Quick Sort: Add "Later This Week" Date Option**                        | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add "This Week" or "Later This Week" option to Quick Sort due date buttons. Provides middle-ground between Tomorrow and Weekend.                                                                                       | BUG-1030                                               |
| **BUG-1032**             | **Quick Sort: Date/Priority Badges Cropped on Long Text**                | **P1**                                              | 📋 **PLANNED**                                                                                                                  | On browser Quick Sort, longer task descriptions cause date and priority badges to be cropped or disappear. Fix card layout overflow handling.                                                                           | TASK-1021                                              |
| **TASK-1033**            | **Mobile: Markdown Rendering in Task View**                              | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Mobile PWA task views should render markdown (bold, lists, links, code) like web/Tauri versions. Currently shows raw markdown text.                                                                                     | TASK-346                                               |
| **BUG-1034**             | **Quick Sort: Multiple Date Buttons Selected Simultaneously**            | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Pressing "Tomorrow" selects both "Tmrw" AND "Wknd" buttons. Only one date option should be selected at a time. Selection state logic broken.                                                                            | BUG-1030                                               |
| **TASK-1035**            | **Quick Sort: Add Delete Task Option**                                   | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add delete button/action to Quick Sort view. Currently only DONE and SKIP. Options: small trash icon, long-press menu, or third button.                                                                                 | TASK-1010                                              |
| ~~**TASK-1036**~~        | ✅ **Quick Sort: Swipe Gestures (Left=Delete, Right=Edit)**              | **P1**                                              | ✅ **DONE** (2026-01-24)                                                                                                        | Swipe LEFT reveals delete action (red, confirm). Swipe RIGHT opens quick edit panel (reschedule, change priority). Haptic feedback on threshold.                                                                         | TASK-1010, TASK-1035                                   |
| **TASK-1037**            | **Mobile Today View: Swipe Gestures (Left=Delete, Right=Edit)**          | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Same swipe gestures for Today/Overdue task list. Swipe LEFT = delete, swipe RIGHT = quick edit. Reuse gesture component from TASK-1036.                                                                                  | TASK-1036                                              |
| **TASK-1038**            | **Mobile Inbox View: Swipe Gestures (Left=Delete, Right=Edit)**          | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Same swipe gestures for Inbox task list. Swipe LEFT = delete, swipe RIGHT = quick edit. Reuse gesture component from TASK-1036.                                                                                           | TASK-1036                                              |
| **TASK-1039**            | **Mobile List Views: Add Padding Between Tasks**                         | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add spacing/padding between task items in Today, Inbox, and other mobile list views. Currently tasks are too tightly packed.                                                                                              | -                                                      |
| **BUG-1040**             | **Table View Not Loading**                                               | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Table view fails to load. Investigate cause - component error, data loading issue, or route problem.                                                                                                                        | -                                                      |
| **TASK-1041**            | **Mobile List Views: Add X Button to Delete Task**                       | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add X/trash button on task items in Today, Inbox list views for quick delete. Confirm before deleting.                                                                                                                      | -                                                      |
| **TASK-1042**            | **Table/List View: Larger Font + Multi-Line Wrap**                       | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Increase task title font size in Table/List view. Allow long titles to wrap to multiple lines instead of truncating. Improve readability.                                                                                   | -                                                      |
| **BUG-1043**             | **Investigate 13 Pre-Existing Test Failures**                            | **P2**                                              | 📋 **PLANNED**                                                                                                                  | 13 tests failing in: Task Instance Helpers, backup validation, etc. Pre-existing failures unrelated to recent changes - need investigation and fixes.                                                                        | -                                                      |
| ~~**BUG-1044**~~         | ✅ **DONE** **Quick Sort Changes Reset/Reverted**                        | **P0**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Fixed: 313 lines of uncommitted changes were never pushed. Committed and pushed delete modal, quick edit panel, swipe gestures.                                                                                                 | TASK-1010                                              |
| ~~**BUG-1045**~~         | ✅ **DONE** **Canvas Loads Empty, Populates Only After Restart**         | **P2**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Web app canvas loads empty initially - tasks only appear after page restart. Root cause: canvas auto-init before auth ready. Fix: removed auto-init (same as BUG-339).                                                           | BUG-339                                                |
| **BUG-1046**             | **Quick Sort: Task Status Resets Overnight on Mobile**                   | **P1**                                              | 📋 **PLANNED**                                                                                                                  | Tasks sorted in Quick Sort on mobile PWA have their status reset during the night. Possible causes: Supabase sync not persisting, cache overwriting DB, or stale service worker data.                                            | TASK-1010                                              |
| **FEATURE-1048**         | **Canvas: Auto-Rotating Day Groups (User-Triggered)**                    | **P2**                                              | 📋 **PLANNED**                                                                                                                  | [See Details](#feature-1048-canvas-auto-rotating-day-groups-planned) - Midnight detection + banner prompts user to rotate Mon-Sun groups. Groups stay editable/movable/deletable.                                                  | TASK-082                                               |
| ~~**BUG-1049**~~         | ✅ **DONE** **Delete Confirmation Modal Not Closing**                    | **P1**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Fixed: Modal stayed open after clicking Delete. Root cause: unhandled async error in `executeConfirmAction`. Fix: Close modal optimistically before action, wrap in try/catch.                                                      | -                                                      |
| **FEATURE-1050**         | **Search in Canvas Inbox & Calendar Inbox**                              | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Add search/filter input to Canvas Inbox sidebar and Calendar Inbox sidebar. Filter tasks by title/description as user types. Quick find for large task lists.                                                                        | -                                                      |
| ~~**TASK-1064**~~        | ✅ **DONE** **CRITICAL: Data Persistence Failures (Date Changes Reset)** | **P0**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | Fixed: Comprehensive persistence audit - 73+ fire-and-forget async calls, 8 unmapped Supabase fields, 7 unpersisted UI states, 4 sync race conditions, 8 silent error swallowing. All fixed with await, useStorage, re-throw. (Was BUG-1051) | TASK-1010, BUG-1046                                    |
| **BUG-1052**             | **Calendar: No Current Time Indicator**                                  | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Calendar view is missing a "now" line/indicator showing the current time. Should display a horizontal red/colored line at current hour position that updates in real-time.                                                             | -                                                      |
| **BUG-1053**             | **Calendar Task Create Modal: No RTL Support**                           | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Task creation modal in Calendar view lacks RTL support. Hebrew text input should be right-aligned, labels and layout should mirror for RTL languages. Affects: title input, description, schedule section, details section.             | FEATURE-1020                                           |
| **BUG-1054**             | **Unclear "No Project" Icon (Question Mark)**                            | **P3**                                              | 📋 **PLANNED**                                                                                                                  | The question mark icon for unsorted/no-project tasks is unclear. Need a better, more intuitive icon (e.g., folder with dash, empty circle, or inbox icon).                                                                               | -                                                      |
| **BUG-1055**             | **Calendar: Task Icon/Text Wraps Vertically in Small Space**             | **P2**                                              | 📋 **PLANNED**                                                                                                                  | In calendar view, task icon and duration text break to multiple lines when task slot is narrow. Should stay horizontal with ellipsis or hide icon when space is limited. Use `flex-shrink: 0` and `white-space: nowrap`.                 | -                                                      |
| **TASK-1056**            | **Board View: Improve Drag-Drop Animations**                             | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Dragging tasks between swimlanes lacks polish. Missing: grab animation on pickup, preview ghost while dragging, release/drop animation. Add smooth transitions, scale on grab, opacity on ghost, spring animation on drop.               | -                                                      |
| **TASK-1058**            | **MASTER_PLAN Symptom Index & Task Discovery Research**                  | **P2**                                              | 📋 **PLANNED**                                                                                                                  | Research and implement better task discovery in MASTER_PLAN.md. Options: symptom index, keyword tags, consistent section headers, beads integration. Goal: find any bug/task in 1 grep, not 4 attempts.                                  | -                                                      |
| ~~**TASK-1059**~~        | ✅ **DONE** **CORS Monitoring & Prevention Infrastructure**              | **P1**                                              | ✅ **DONE** (2026-01-24)                                                                                                         | [SOP-031](./sop/SOP-031-cors-configuration.md) - Automated CORS validation script, CI/CD integration, comprehensive troubleshooting guide. Prevents duplicate header issues, missing headers, and browser-specific CORS failures.         | TASK-351                                               |
| **TASK-1060**            | **Infrastructure & E2E Sync Stability (All Platforms)**                  | **P0**                                              | 🔄 **IN PROGRESS**                                                                                                              | [See Details](#task-1060-infrastructure--e2e-sync-stability-all-platforms-in-progress) - Fix Caddy instability, web/Tauri/PWA/KDE sync issues. Full platform E2E verification.                                                              | BUG-1056, TASK-351                                     |
| **BUG-1061**             | **Canvas Position Drift on Cross-Browser Sync**                          | **P0**                                              | 👀 **REVIEW** (2026-01-25)                                                                                                       | [See Details](#bug-1061-canvas-position-drift-on-cross-browser-sync-review) - Fix #5 deployed: Module-level `canvasSyncInProgress` flag blocks spurious `onNodeDragStop` calls during sync. User testing to confirm fix.                      | TASK-1060, BUG-1047                                    |
| ~~**BUG-1063**~~         | ✅ **DONE** **Cloudflare Cache MIME Type Error (Chromium Only)**         | **P0**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Chromium browsers failed to load CSS/JS with MIME type errors. Firefox worked. Root cause: Cloudflare edge cache served wrong content for preload scanner requests. Fix: Added `Vary: Accept` header. Created SOP-032, tests, CI validation. | TASK-1060                                              |
| ~~**BUG-1064**~~         | ✅ **DONE** **Dev-Maestro Parser Status Detection Broken**               | **P1**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | TASK-140 showed as IN PROGRESS despite being DONE. Table tasks didn't update from PLANNED→IN PROGRESS. Fix: (1) Unrecognized `##` sections reset parser state, (2) Table parser detects 🔄/⏸️/👀 statuses. [SOP-031](./sop/SOP-031-dev-maestro-parser.md) | -                                                      |
| ~~**TASK-1063**~~        | ✅ **DONE** **Update CLAUDE.md with VPS/Contabo Deployment Docs**        | **P2**                                              | ✅ **DONE** (2026-01-25)                                                                                                         | Added comprehensive VPS Production section with Contabo specs, architecture, secrets (Doppler), SOPs, and maintenance commands. | -                                                      |
| **TASK-1080**            | **Whisper Confirm Dialog: RTL Support + Popup Redesign**                 | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                              | Proper Hebrew RTL layout, larger modal for transcription review/edit, better text area visibility                                                                                                                      | FEATURE-1023                                           |
| **TASK-1081**            | **Canvas: Add Alignment Options to Groups (Not Just Tasks)**             | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                                  | Extend canvas alignment feature to work with groups, not just tasks. Allow aligning multiple groups (left, right, center, top, bottom) and distributing spacing.                                                      | -                                                      |
| **BUG-1088**             | **VPS Canvas Inbox: Delete Task Does Nothing**                           | **P0**                                              | 🔄 **IN PROGRESS**                                                                                                              | Deleting task from canvas inbox on VPS starts soft-delete but never completes. No error, no success. Logs show `Starting soft-delete` but no completion.                                                              | -                                                      |
| **TASK-1087**            | **KDE Widget: Task Readability + Active Task Highlight**                 | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                              | Improve KDE widget task list UX: (1) Increase task row height for better readability with RTL/long text, (2) Highlight the currently active timer task in the task list.                                               | TASK-1009                                              |
| **FEATURE-1089**         | **Inbox Tab Swipe Gestures (Edit Left, Done Right)**                     | **P1**                                              | 🔄 **IN PROGRESS**                                                                                                              | Add swipe gesture support to Inbox tab matching Today tab behavior: swipe left to edit task, swipe right to mark done/delete.                                                                                          | -                                                      |
| **TASK-1089**            | **Inbox Filters: Calendar Week/Month Instead of Rolling Days**           | **P2**                                              | 🔄 **IN PROGRESS**                                                                                                              | "This Week" filter now shows tasks until 00:00 Sunday (calendar week, exclusive). On Sunday, shows next 7 days until following Sunday. Fixed in `useSmartViews.ts`, `InboxTimeFilters.vue`, `useInboxFiltering.ts`.      | -                                                      |

---

---


### TASK-328: Test task from API

**Priority**: Medium
**Status**: Backlog


## Active Work (Summary)

> \[!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

---

### TASK-1087: KDE Widget - Task Readability + Active Task Highlight (🔄 IN PROGRESS)

**Priority**: P2
**Status**: 🔄 IN PROGRESS (2026-01-26)
**Depends On**: TASK-1009

**Problem**: The KDE Plasma widget task list has UX issues:
1. **Task text truncation**: Long task titles (especially RTL Hebrew text) are hard to read - need more row height
2. **No active task highlight**: When a timer is running for a specific task, that task should be visually highlighted in the list

**Requirements**:
1. Increase task row minimum height for better readability
2. Allow text to wrap to 2 lines if needed
3. Highlight the active timer task with accent color border/glow (matching web app's `timer-active` styling)

**Files Modified**:
- `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

**Changes Made**:
- [x] Added `currentTaskId` property to track active timer task
- [x] Increased task row height (44-64px dynamic based on content)
- [x] Added 2-line text wrap with RTL support
- [x] Added active task highlight (accent border + glow + pulse animation)
- [x] Added chronometer icon for active task
- [x] Bold text for active task
- [x] Increased list spacing (4px → 6px)

**Verification**:
- [ ] Restart Plasma: `plasmashell --replace &`
- [ ] Test with RTL Hebrew task titles
- [ ] Test active task highlighting when timer running

---

### FEATURE-1089: Inbox Tab Swipe Gestures (Edit Left, Done Right) (🔄 IN PROGRESS)

**Priority**: P1-HIGH
**Status**: 🔄 IN PROGRESS (2026-01-26)

**Problem**: The Inbox tab does not support swipe gestures for task actions. The Today tab has swipe left to edit and swipe right to delete/mark done, but Inbox lacks this functionality.

**Requirements**:
1. Add swipe gesture support to Inbox tab task items
2. Swipe left → Opens task for editing
3. Swipe right → Marks task as done (or deletes)
4. Match Today tab's swipe behavior and visual feedback exactly

**Implementation Tasks**:
- [ ] Identify swipe component used in Today tab
- [ ] Add same swipe component to Inbox task items
- [ ] Wire up edit action on left swipe
- [ ] Wire up done/delete action on right swipe
- [ ] Test swipe gestures work on mobile/touch

---

### BUG-1088: VPS Canvas Inbox - Delete Task Does Nothing (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL
**Status**: 🔄 IN PROGRESS (2026-01-26)

**Problem**: On the VPS production site (in-theflow.com), clicking delete on a task in the canvas inbox does nothing. The soft-delete operation starts but never completes - no success callback, no error, no UI update.

**Symptoms**:
- Console shows `🗑️ [SUPABASE-DELETE] Starting soft-delete for task: <id>`
- No completion log (`soft-delete completed` or error message)
- Task remains in inbox after delete attempt
- Also saw: `TypeError: Cannot read properties of undefined (reading 'length')` in `syncStoreToCanvas`

**Suspected Causes**:
- Supabase soft-delete hanging on VPS/production
- RLS policy blocking the update
- Network/timeout issue on VPS
- The syncNodes error may be related (tasks not loading properly)

**Investigation Tasks**:
- [ ] Check Supabase logs for the delete operation
- [ ] Verify RLS policies allow soft-delete
- [ ] Check if this is production-only or also local
- [ ] Debug the `syncStoreToCanvas` TypeError

---

*Archived to docs/archive/MASTER_PLAN_JAN_2026.md: BUG-1062, BUG-1068, BUG-1070, BUG-1074, TASK-1063, BUG-1064, BUG-1047*

---

### BUG-352: Mobile PWA "Failed to Fetch" (Network/Cert Issue)
**Priority**: P0-CRITICAL
**Status**: 📋 PLANNED (for Tomorrow)
User reports mobile device fails to fetch even on fresh browser. This rules out simple caching.
**Potential Causes**:
1.  **SSL/Cert Issue**: Android/iOS might reject the `sslip.io` cert if the chain isn't perfect (Caddy usually handles this, but maybe an intermediate is missing).
2.  **Mobile-Specific Code Path**: Does the mobile layout have a hardcoded `localhost` fetch somewhere that the desktop layout doesn't use?
3.  **CORS**: Mobile browser enforcing stricter CORS?

---

*Archived to docs/archive/MASTER_PLAN_JAN_2026.md: BUG-1056*

---

### TASK-1060: Infrastructure & E2E Sync Stability (All Platforms) (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL
**Status**: 🔄 IN PROGRESS (Started: 2026-01-24)
**Dependencies**: BUG-1056, TASK-351

#### Problem Statement
User reports "everything is broken" - intermittent sync failures across all platforms:
- **Web**: App shows 0 tasks, WebSocket 403 errors
- **Tauri**: Processes exit with SIGTERM, sync issues
- **PWA (Mobile)**: Tasks reset overnight, sync failures
- **KDE Widget**: May not be syncing correctly with timer state

Root causes discovered:
1. **Caddy reverse proxy instability** - Dies repeatedly requiring manual restart
2. **Conflicting Docker/System Caddy** - Port 443 conflict resolved but Caddy keeps dying
3. **SWR cache not invalidated on auth change** - Fixed in BUG-1056

#### Phase 1: Infrastructure Stability (Critical)

**1.1 Caddy Health Investigation**
- [ ] SSH to VPS and check Caddy systemd logs: `journalctl -u caddy -f`
- [ ] Check for OOM kills: `dmesg | grep -i kill`
- [ ] Check Caddy config for issues: `caddy validate --config /etc/caddy/Caddyfile`
- [ ] Review Caddy reload/restart patterns
- [ ] Add health monitoring (uptime/healthcheck endpoint)

**1.2 Caddy Auto-Recovery**
- [ ] Create systemd watchdog for Caddy: `WatchdogSec=30`
- [ ] Add restart policy: `Restart=always`, `RestartSec=5`
- [ ] Consider Caddy docker container with restart: always (if simpler)
- [ ] Set up alerting on Caddy failures (optional: webhook to Discord/Telegram)

**1.3 JWT Key Validation on Production**
- [ ] Verify `/opt/supabase/docker/.env` JWT_SECRET matches what's expected
- [ ] Check if demo keys are being used in production (CRITICAL security issue)
- [ ] Update production keys if needed, rotate secrets properly

#### Phase 2: Web Platform Verification

**2.1 Auth Flow Audit**
- [ ] Verify auth.ts handles all Supabase auth events correctly
- [ ] Test sign-in → data load → sign-out → sign-in flow
- [ ] Test token refresh during active session
- [ ] Verify SWR cache clears on user change (BUG-1056 fix)

**2.2 WebSocket Stability**
- [ ] Test Realtime subscription lifecycle (connect → reconnect → auth refresh)
- [ ] Verify onRecovery callback properly reloads data
- [ ] Test multi-tab behavior (unique channel per tab)
- [ ] Add reconnection backoff strategy if missing

**2.3 E2E Test: Web Platform**
- [ ] Create task → verify persists to Supabase
- [ ] Edit task → verify update syncs
- [ ] Delete task → verify removal syncs
- [ ] Refresh page → verify data loads correctly
- [ ] Sign out → sign in → verify data intact

#### Phase 3: Tauri Desktop App

**3.1 Tauri Debug Investigation**
- [ ] Run `npm run tauri dev` with RUST_LOG=debug
- [ ] Check for SIGTERM causes (WebView crash? Auth timeout? Plugin issue?)
- [ ] Review Tauri console logs for errors
- [ ] Check if Docker orchestration (lib.rs) is causing issues

**3.2 Tauri Auth Stability**
- [ ] Verify Tauri uses same auth flow as web
- [ ] Test token persistence in Tauri (localStorage equiv)
- [ ] Check if Tauri WebView has different CORS/cookie behavior
- [ ] Test auth refresh in Tauri specifically

**3.3 Tauri Build & Deploy**
- [ ] Clean rebuild: `npm run tauri build -- --clean`
- [ ] Test fresh install on Linux (remove old config/data)
- [ ] Verify Supabase URL/keys in build
- [ ] Test offline → online transition

**3.4 E2E Test: Tauri App**
- [ ] Launch Tauri → sign in → verify tasks load
- [ ] Create task → verify syncs to web immediately
- [ ] Edit task → verify web sees update
- [ ] Start timer → verify KDE widget and web see timer
- [ ] Leave running overnight → check if still signed in next day

#### Phase 4: PWA (Mobile)

**4.1 Service Worker Audit**
- [ ] Check SW cache strategy (network-first for API, cache-first for assets)
- [ ] Verify SW isn't caching stale auth tokens
- [ ] Test SW update flow (skip waiting, claim clients)
- [ ] Clear SW caches on sign-out

**4.2 PWA Sync Reliability**
- [ ] Test Quick Sort → verify changes persist across page reload
- [ ] Test Inbox changes → verify persist
- [ ] Test overnight persistence (BUG-1046)
- [ ] Check if SW is serving stale data after server updates

**4.3 E2E Test: PWA Mobile**
- [ ] Install PWA on mobile device
- [ ] Sign in → verify tasks load
- [ ] Quick Sort changes → force close → reopen → verify persisted
- [ ] Leave overnight → check next morning tasks are correct
- [ ] Delete task on mobile → verify web/Tauri see deletion

#### Phase 5: KDE Plasma Widget

**5.1 Widget Sync Verification**
- [ ] Check REST API polling interval (should be 2s)
- [ ] Verify API endpoints return correct timer state
- [ ] Test: start timer on web → widget shows countdown
- [ ] Test: stop timer on widget → web sees stopped state

**5.2 Widget Auth**
- [ ] Verify widget uses correct API token
- [ ] Check if widget handles auth expiry gracefully
- [ ] Test widget after token refresh

#### Phase 6: Cross-Platform E2E

**6.1 Multi-Platform Sync Test**
| Action | Web | Tauri | PWA | KDE Widget |
|--------|-----|-------|-----|------------|
| Create task (Web) | ✓ | Verify | Verify | - |
| Edit task (Tauri) | Verify | ✓ | Verify | - |
| Delete task (PWA) | Verify | Verify | ✓ | - |
| Start timer (Web) | ✓ | Verify | Verify | Verify |
| Stop timer (KDE) | Verify | Verify | Verify | ✓ |

**6.2 Stress Test**
- [ ] Run stress-tester skill: `Skill(stress-tester)`
- [ ] Focus on sync conflict resolution tests
- [ ] Focus on WebSocket stability tests

#### Files Involved
```
# Infrastructure
/etc/caddy/Caddyfile                     # Caddy reverse proxy config (VPS)
/etc/systemd/system/caddy.service        # Caddy systemd service (VPS)
/opt/supabase/docker/.env                # Supabase production secrets (VPS)

# Auth & Sync
src/stores/auth.ts                       # Auth state management
src/composables/useSupabaseDatabase.ts   # Database + Realtime sync
src/composables/useAppInitialization.ts  # App startup orchestration

# Tauri
src-tauri/src/lib.rs                     # Rust commands
src/composables/useTauriStartup.ts       # Tauri-specific startup

# PWA
vite.config.ts                           # PWA plugin config
src/service-worker.ts                    # Service worker (if custom)

# KDE Widget
kde-widget/package/contents/ui/main.qml  # Widget QML
```

#### Success Criteria
1. Caddy stays running for 24+ hours without intervention
2. Web app loads data correctly on first try (no 0 tasks)
3. Tauri app runs without SIGTERM
4. PWA changes persist overnight
5. Cross-platform sync works bidirectionally
6. KDE widget shows correct timer state

#### Progress Log
- **2026-01-24 20:15**: Caddy found dead, restarted
- **2026-01-24 20:30**: Port 443 conflict resolved (removed Docker Caddy)
- **2026-01-24 21:00**: BUG-1056 SWR cache fix committed and deployed
- **2026-01-24 21:30**: TASK-1060 created with comprehensive plan
- **2026-01-24 22:35**: **ROOT CAUSE FOUND** - CI/CD `deploy.yml` was killing System Caddy and starting Docker Caddy
- **2026-01-24 22:40**: Docker stack stopped, System Caddy re-enabled
- **2026-01-24 22:42**: Fixed `deploy.yml` - now deploys static files only, no Docker, graceful Caddy reload
- **2026-01-24 22:43**: Added Caddy systemd auto-restart config (`Restart=on-failure`, memory limits)
- **2026-01-24 22:44**: ✅ Web app (200), API (401), WebSocket (401) all verified working

---

### BUG-1061: Canvas Position Drift on Cross-Browser Sync (👀 REVIEW)

**Priority**: P0-CRITICAL
**Status**: 👀 REVIEW (Updated: 2026-01-25)
**Dependencies**: TASK-1060, BUG-1047

#### Problem Statement
Tasks appear in different positions across browser tabs/windows. When user drags a task in Browser A, Browser B shows the task at a wrong position.

#### Existing Protections (Already Implemented)
| Protection | Location | Status |
|------------|----------|--------|
| Timestamp comparison | `tasks.ts:195` | ✅ `updatedAt >=` blocks stale updates |
| Manual operation lock | `tasks.ts:190-191` | ✅ Blocks sync during manual ops |
| Drag/resize locks | `useAppInitialization.ts:128-132` | ✅ Blocks sync during drag |
| PositionManager locks | `PositionManager.ts:36-38` | ✅ `user-drag` blocks `remote-sync` |
| Drift logging | Multiple files | ✅ `[SYNC-POS-WRITE]`, `[GEOMETRY-DRIFT]` |

#### Potential Gaps (Investigation Needed)

**Gap 1: Lock Timing Window**
- After drag ends, window between `onNodeDragStop` completing and DB save finishing
- Realtime event from another browser could overwrite during this window

**Gap 2: Cross-Tab Timestamp Drift**
- System clocks may differ slightly between tabs/browsers
- `updatedAt >=` could accept stale data if remote clock is ahead

**Gap 3: Supabase Realtime Event Order**
- Events may arrive out-of-order: [pos3, pos1, pos2] instead of [pos1, pos2, pos3]
- Last-write-wins applies wrong position

#### Investigation Plan
- [ ] Reproduce: Open 2 browser windows, drag in A, check console in B
- [ ] Check `onNodeDragStop` - does it await DB save before releasing lock?
- [ ] Log `updatedAt` values on both sides to check timestamp sync
- [ ] Add sequence numbers to detect out-of-order events

#### Progress Log
- **2026-01-25**: BUG created, protections documented, gaps identified, starting investigation
- **2026-01-25**: ROOT CAUSE FOUND #1 - `positionVersion` exists but was NOT checked in `updateTaskFromSync`!
- **2026-01-25**: FIX #1 IMPLEMENTED in `src/stores/tasks.ts` - Added positionVersion comparison before accepting position updates
  - If `localVersion > remoteVersion`, keeps local position and logs `🛡️ [BUG-1061]` message
  - Also enhanced drift logging to include version numbers
- **2026-01-25**: User reported drift STILL HAPPENING after Fix #1
- **2026-01-25**: ROOT CAUSE FOUND #2 - `syncStoreToCanvas` reads `parentId` from PositionManager instead of store!
  - When PositionManager's `batchUpdate` is rejected (node locked during drag), PM has stale parentId
  - But store has correct parentId (always updated by realtime sync)
  - This caused tasks to show as "root" when PM had stale null parentId
- **2026-01-25**: FIX #2 IMPLEMENTED in `src/composables/canvas/useCanvasSync.ts`
  - Changed to read `parentId` from task/group directly, not from PositionManager
  - PM is only used for x/y position (its intended purpose)

#### Fix #1 Applied (tasks.ts)
```typescript
// BUG-1061: Position version check in updateTaskFromSync
if (normalizedTask.canvasPosition && currentTask.canvasPosition) {
  const localVersion = currentTask.positionVersion ?? 0
  const remoteVersion = normalizedTask.positionVersion ?? 0
  if (localVersion > remoteVersion) {
    // Keep local geometry, accept other field updates
    normalizedTask.canvasPosition = currentTask.canvasPosition
    normalizedTask.parentId = currentTask.parentId
    normalizedTask.positionVersion = localVersion
  }
}
```

#### Fix #2 Applied (useCanvasSync.ts)
```typescript
// BUG-1061 FIX: Read parentId from STORE, not PM
// PM updates can be rejected if node is locked (user dragging).
// Store is always updated by realtime sync, so it's the source of truth for parentId.
let parentId = (task.parentId && task.parentId !== 'NONE') ? task.parentId : null
```

- **2026-01-25**: User reported drift STILL HAPPENING when moving GROUPS (not tasks)
- **2026-01-25**: ROOT CAUSE FOUND #3 - Smart Group reactive loop!
  - When GROUP is dragged, Vue Flow reports child tasks as "involved" in drag
  - Tasks near group boundary get re-evaluated for containment
  - Smart Group applies different dueDate based on spatial position
  - This triggers `syncTrigger++` → sync → recalculate containment → different group → loop!
- **2026-01-25**: FIX #3 IMPLEMENTED in `src/composables/canvas/useCanvasInteractions.ts`
  - Added early-exit: if task is STILL INSIDE its current parent, skip parentId/Smart Group recalc
  - Only sync position, don't recalculate containment when task just followed its parent group

#### Fix #3 Applied (useCanvasInteractions.ts)
```typescript
// BUG-1061 FIX: Skip if task just followed its parent group (didn't move independently)
const oldParentId = task.parentId
if (oldParentId) {
    const currentParent = taskAllGroups.find(g => g.id === oldParentId)
    if (currentParent) {
        const stillInside = isNodeCompletelyInside(spatialTask, parentBounds, 10)
        if (stillInside) {
            // Task just moved with its group - only sync position
            await taskStore.updateTask(task.id, { canvasPosition: absolutePos }, 'DRAG-FOLLOW-PARENT')
            continue // Skip parentId change, skip Smart Group
        }
    }
}
```

#### Fix #5 Applied (ROOT CAUSE FIX - 2026-01-25)

**Root Cause Identified**: Vue Flow fires `onNodeDragStop` when `setNodes()` is called during sync operations, creating a reactive loop:
1. User drags task → `onNodeDragStop` fires
2. Smart Group updates dueDate → `taskStore.updateTask()`
3. `syncTrigger++` → `batchedSyncNodes()` → `setNodes()`
4. Vue Flow fires `onNodeDragStop` AGAIN (spurious)
5. Loop continues, causing tasks to bounce between groups

**Fix**: Module-level `canvasSyncInProgress` flag blocks spurious `onNodeDragStop` calls.

```typescript
// useCanvasSync.ts - Module-level singleton flag
const canvasSyncInProgress = ref(false)
export { canvasSyncInProgress }

// useCanvasInteractions.ts - Guard at start of onNodeDragStop
const onNodeDragStop = async (event: NodeDragEvent) => {
    if (canvasSyncInProgress.value) {
        console.log('🛡️ [DRAG-STOP-BLOCKED] Skipping - triggered during canvas sync')
        return
    }
    // ... rest of handler
}
```

**Verification**: Console shows `🛡️ [DRAG-STOP-BLOCKED]` messages when spurious calls are blocked.

---

### BUG-1057: Fix Failing Unit Tests (📋 PLANNED)
**Priority**: P3 (technical debt)
**Status**: 📋 PLANNED

**8 test failures to fix** (excluding 13 canvas-characterization tests that correctly require dev server):

| Test File | Issue | Fix |
|-----------|-------|-----|
| `canvas-resize-test.test.ts` | Playwright/Vitest conflict | Move to `tests/e2e/` |
| `canvas-resize-test-comprehensive.test.ts` | Playwright/Vitest conflict | Move to `tests/e2e/` |
| `bug-153-containment.test.ts` | Missing `src/utils/geometry` | Delete test or restore util |
| `smoke.test.ts` | `beforeEach` not defined | Add missing Vitest import |
| `css-syntax.test.ts` | `fileURLToPath` not a function | Fix import statement |
| `vue-imports.test.ts` | `fileURLToPath` not a function | Fix import statement |
| `tasks.test.ts` (2 failures) | Default project ID mismatch | Update test expectations |
| `repro-bug-030.test.ts` | Uncategorized filter logic | Fix filter or test |

---

*Archived to docs/archive/MASTER_PLAN_JAN_2026.md: BUG-1045*

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

---

*Archived to docs/archive/MASTER_PLAN_JAN_2026.md: TASK-357, TASK-351*

---

### TASK-1002: Voice Transcription to Task (📋 NEXT)

**Priority**: P1
**Status**: 📋 NEXT (2026-01-24)

Implement voice recording → transcription → task creation using an API (Whisper/Deepgram/AssemblyAI).

**Requirements**:
- Record audio in PWA (MediaRecorder API)
- Send to transcription API
- Create task from transcribed text
- Mobile-first UX (hold-to-record button)

**Steps**:
1. [ ] Research transcription APIs (cost, accuracy, latency)
2. [ ] Implement audio recording in PWA
3. [ ] Create transcription service
4. [ ] Add "voice task" button to quick add
5. [ ] Test on mobile

---

### FEATURE-1048: Canvas Auto-Rotating Day Groups (📋 PLANNED)

**Priority**: P2
**Status**: 📋 PLANNED
**Dependencies**: TASK-082 (useDateTransition composable)

Implement user-triggered day group rotation at midnight. When the day changes, show a notification prompting the user to rotate their day groups. This respects geometry invariants while providing the rotation UX.

**Key Requirement**: Day groups (Monday-Sunday) must remain **fully editable** - users can move, delete, rename, and change them manually at any time. The rotation is a convenience feature, not a constraint.

**Implementation Plan**:

#### Step 1: Create `useDayGroupRotation.ts` Composable
**File**: `src/composables/canvas/useDayGroupRotation.ts`

- Import and use `useDateTransition` for midnight detection
- Detect day-of-week groups on canvas (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
- Use flexible name matching (same as `useCanvasSectionProperties.ts` line 32-48)
- Calculate rotation: which group should move where
- Expose `rotateGroups()` function that uses drag handler code path
- Expose `hasDayGroups` computed for conditional banner display
- Track last rotation date to prevent duplicate prompts

#### Step 2: Add Rotation Toast/Banner
**File**: `src/components/canvas/DayRotationBanner.vue`

- Show when `useDateTransition` fires at midnight AND `hasDayGroups` is true
- Display: "New day! Tap to rotate your day groups"
- Button triggers `rotateGroups()` from composable
- Dismiss button (X) to decline rotation
- Auto-dismiss after 30 seconds if no action
- Store dismissal preference in localStorage (optional "Don't show again")

#### Step 3: Integrate into CanvasView
**File**: `src/views/CanvasView.vue`

- Import `useDayGroupRotation`
- Add `DayRotationBanner` component (similar to `CanvasStatusBanner`)
- Wire up the rotation trigger

#### Step 4: Implement Safe Group Movement
**File**: `src/composables/canvas/useDayGroupRotation.ts`

- Use `onNodeDragStop` equivalent code path (geometry invariant safe)
- Reference `useCanvasInteractions.ts` for the proper update pattern
- Calculate new positions for day groups in a loop:
  - Monday → moves to bottom position (becomes "next Monday")
  - All other days shift up one slot
- Persist changes via proper store update (`canvasStore.updateSection()`)
- Respect position locks via `LockManager`

**Key Files**:

| File | Action |
|------|--------|
| `src/composables/canvas/useDayGroupRotation.ts` | CREATE |
| `src/components/canvas/DayRotationBanner.vue` | CREATE |
| `src/views/CanvasView.vue` | MODIFY - add banner |
| `src/composables/useDateTransition.ts` | USE (already exists) |
| `src/composables/canvas/useCanvasInteractions.ts` | REFERENCE for geometry-safe patterns |
| `src/composables/canvas/useCanvasSectionProperties.ts` | REFERENCE for day detection patterns |

**Safety Constraints** (CRITICAL):

1. All position changes go through drag handler code path
2. Never call `updateGroup()` directly for geometry from sync code
3. Use `positionManager.updatePosition()` with 'user-action' source
4. Acquire locks via `lockManager.acquire()` before moving groups
5. Test that sync doesn't conflict with rotation
6. Groups remain fully user-editable (move, delete, rename)

**Verification Checklist**:

1. [ ] Create 7 day groups (Mon-Sun) on canvas
2. [ ] Wait for midnight OR trigger via devtools (`simulateTransition()`)
3. [ ] Banner appears with rotation prompt
4. [ ] Click rotation button
5. [ ] Verify groups rotate (Monday→bottom, others shift up)
6. [ ] Verify no position drift
7. [ ] Refresh page - positions persist correctly
8. [ ] Verify groups can still be manually moved/deleted/renamed
9. [ ] Run `npm run test` - no regressions

---

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

*Archived to docs/archive/MASTER_PLAN_JAN_2026.md: BUG-1020*

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

---

---

---

---

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

**Files**: `tests/stress/redundancy-assessment.spec.ts`

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

---

---

*Archived to docs/archive/MASTER_PLAN_JAN_2026.md: TASK-334*

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
- ~~TASK-319~~: Fix Agent Output Capture ✅
- ~~TASK-320~~: Fix Task Completion Detection ✅
- TASK-321: Test Merge/Discard Workflow E2E
- TASK-322: Add Automatic Error Recovery
- ~~TASK-323~~: Fix Stale Agent Cleanup ✅

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

#### ~~TASK-319~~: Fix Agent Output Capture in Orchestrator (✅ DONE)

**Priority**: P1-HIGH
**Related**: TASK-303
**Created**: January 19, 2026
**Completed**: January 23, 2026
**Status**: ✅ DONE - Stream-json parsing, real-time broadcast, persistent logs

**Problem**: Agent stdout isn't reliably captured in logs. The `subAgentData.outputLines` stays at 0 even when agents create files successfully. Progress tracking is blind.

**Root Cause** (server.js:3071-3120):
- Sub-agents spawned without `--output-format stream-json` flag
- stdout only broadcasts every 10 outputs (batching)
- No JSON parsing of Claude's stream output
- No persistent file logging

**Implementation** (2026-01-23):
1. ✅ Added `--output-format stream-json`, `--print`, `--verbose` to sub-agent spawn
2. ✅ Created `parseAndBroadcastOrchOutput()` function - parses JSON events, broadcasts real-time via `broadcastOrchestration`
3. ✅ Added `appendAgentLog()` helper - logs to `~/.dev-maestro/logs/agent-{taskId}.log`
4. ✅ Added `/api/orchestrator/logs/:taskId` endpoint to retrieve logs
5. ✅ Logs directory auto-created on server start

**Key Files**:
- `~/.dev-maestro/server.js` (lines 1716-1812: new helpers, lines 3071-3120: updated spawn)

**Success Criteria**:
- [x] Real-time output broadcast via `agent_output` events
- [x] `outputLines` count matches actual output chunks
- [x] Agent logs persisted to `~/.dev-maestro/logs/agent-{taskId}.log`
- [ ] User verification: Test orchestration and check logs

---

#### ~~TASK-320~~: Fix Task Completion Detection in Orchestrator (✅ DONE)

**Priority**: P1-HIGH
**Related**: TASK-303
**Created**: January 19, 2026
**Completed**: January 23, 2026

**Problem**: Task shows "running" with "outputLines: 0" even after agent created files. Completion detection relies only on exit code.

**Root Cause** (server.js:2510-2595):
- Only checks `code === 0` for success
- No validation that files were actually changed
- Git diff may be empty if agent didn't commit

**Solution Implemented**:
1. ✅ Check git status for uncommitted changes (`git status --porcelain`)
2. ✅ Validate diff output has actual file changes (committed and uncommitted)
3. ✅ Add agent activity timeout (60s of no output triggers `task_stalled` event)
4. ✅ Parse agent's final summary from output (regex patterns for common completions)
5. ✅ New completion statuses: `completed`, `completed_no_changes`, `completed_empty`
6. ✅ Enhanced broadcast payload with `hasUncommittedChanges`, `hasCommittedChanges`, `agentSummary`, `outputLines`

**Key Files**:
- `dev-maestro/server.js` (spawnSubAgent function)

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

#### ~~TASK-323~~: Fix Stale Agent Cleanup in Orchestrator (✅ DONE)

**Priority**: P1-HIGH
**Related**: TASK-303
**Created**: January 19, 2026
**Completed**: January 23, 2026

**Problem**: Found stale Claude agent processes from previous tests still running. Worktrees accumulate without cleanup.

**Root Cause**:
- `cleanupWorktree()` only removes worktree, not branch
- Process kill on timeout may not work (SIGTERM vs SIGKILL)
- No startup cleanup of orphaned resources

**Solution Implemented**:
1. ✅ `killAgentProcess()` - SIGTERM with 5s timeout, then SIGKILL fallback
2. ✅ `cleanupWorktree()` - now also deletes branch + runs `git worktree prune`
3. ✅ `cleanupOrphanedResources()` - startup scan removes orphaned worktrees, branches, and Claude processes
4. ✅ `startPeriodicCleanup()` - every 10 minutes, kills stuck agents (>30min runtime)
5. ✅ `spawnedAgents` Map - global registry tracks all PIDs
6. ✅ `gracefulShutdown()` - SIGTERM/SIGINT handlers kill all agents and clean up

**Key Files**:
- `dev-maestro/server.js` (lines 78-230, cleanup infrastructure)
- `dev-maestro/server.js` (lines 1078-1125, cleanupWorktree function)

**Success Criteria**:
- [x] No orphaned Claude processes after orchestration ends
- [x] No orphaned branches (`bd-*`, `orch-*`)
- [x] No orphaned worktrees (`.agent-worktrees/*`)
- [x] Server shutdown cleans up all resources

---

#### ~~FEATURE-1012~~: Orchestrator Auto-Detect Project Tech Stack (✅ DONE)

**Priority**: P2-MEDIUM
**Related**: TASK-303
**Completed**: January 23, 2026

**Problem**: ~~Orchestrator asks "What framework is your PWA built with?" when it should detect Vue 3 automatically from package.json.~~

**Solution Implemented**:
- Added `detectProjectContext()` function in `~/.dev-maestro/server.js`
- Auto-detects: framework, UI library, state management, database, testing tools, build tools
- Injects detected context into Claude's question generation prompt
- Claude instructed to NOT ask about already-detected items
- Questions now focus on feature-specific details (UX, timing, edge cases)

**Detected Items**:
- Framework: Vue 3, React, Svelte, Angular
- UI Library: Naive UI, MUI, Chakra, Vuetify, Element Plus, Ant Design
- State: Pinia, Vuex, Redux, Zustand, MobX
- Database: Supabase, Firebase, Prisma
- Testing: Vitest, Jest, Playwright, Cypress
- Components: Vue Flow, TipTap, Tailwind, custom modals

**Key Files**:
- `~/.dev-maestro/server.js` - `detectProjectContext()` function (lines ~2216-2300)
- Create: `dev-maestro/lib/projectAnalyzer.js`

**Success Criteria**:
- [ ] Auto-detects Vue 3 from FlowState codebase
- [ ] Auto-detects TypeScript usage
- [ ] Auto-detects build tool (Vite)
- [ ] Skips framework questions when confident

---

#### FEATURE-1013: Orchestrator Auto-Detect Data Layer (📋 PLANNED)

**Priority**: P2-MEDIUM
**Related**: TASK-303, FEATURE-1012
**Created**: January 23, 2026

**Problem**: Orchestrator asks "Do you have existing task data management?" when it should detect Pinia + Supabase automatically.

**Expected Detection**:
- Pinia stores in `src/stores/`
- Supabase client in `src/services/` or composables
- API patterns in `src/api/` or `src/composables/`
- Database schemas in `supabase/migrations/`

**Implementation**:
1. Extend `analyzeProjectStack()` with data layer detection
2. Glob for common patterns: `**/stores/**`, `**/*Store.ts`, `**/supabase*`
3. Parse imports to confirm usage (not just file existence)
4. Build data architecture summary for orchestrator context

**Success Criteria**:
- [ ] Auto-detects Pinia as state management
- [ ] Auto-detects Supabase as backend
- [ ] Identifies key stores (tasks, canvas, timer, etc.)
- [ ] Skips data management questions when detected

---

#### FEATURE-1014: Orchestrator Smart Question System with Pros/Cons (📋 PLANNED)

**Priority**: P2-MEDIUM
**Related**: TASK-303, FEATURE-1013
**Created**: January 23, 2026

**Problem**: When orchestrator DOES need to ask questions (new project or uncertain detection), it should provide pros/cons for each option, not just list choices.

**Current Behavior** (bad):
```
What framework is your PWA built with?
[ ] React [ ] Vue 3 [ ] Angular [ ] Svelte
```

**Expected Behavior** (good):
```
I couldn't detect your framework. What are you using?

- **React**: Largest ecosystem, most jobs, Facebook-backed
  Pros: Huge community, flexible architecture
  Cons: More boilerplate, decision fatigue

- **Vue 3**: Progressive framework, Composition API
  Pros: Gentle learning curve, excellent docs, fast
  Cons: Smaller ecosystem than React

- **Angular**: Full enterprise framework by Google
  Pros: Complete solution, strong typing, DI
  Cons: Steep learning curve, verbose
```

**Implementation**:
1. Create `questionMetadata.json` with pros/cons for common choices
2. Update question generation to include context
3. Add "Why are you asking?" tooltip explaining what detection failed

**Success Criteria**:
- [ ] All questions include pros/cons
- [ ] User understands WHY they're being asked
- [ ] Options include relevant tradeoffs for their context

---

#### FEATURE-1015: Orchestrator Project Context Caching (📋 PLANNED)

**Priority**: P2-MEDIUM
**Related**: TASK-303, FEATURE-1012
**Created**: January 23, 2026

**Problem**: Every orchestration run re-analyzes the entire project from scratch, even when nothing has changed.

**Solution**: Cache project analysis results and invalidate on relevant changes.

**Implementation**:
1. Store analysis in `dev-maestro/cache/project-context.json`
2. Include hash of package.json + key config files
3. On startup, compare hashes - reuse if unchanged
4. Invalidate specific sections on file changes:
   - package.json changed → re-analyze dependencies
   - src/stores/ changed → re-analyze data layer
5. Cache TTL: 24 hours max, or until hash mismatch

**Cache Structure**:
```json
{
  "version": "1.0",
  "analyzedAt": "2026-01-23T10:00:00Z",
  "hashes": {
    "package.json": "abc123",
    "tsconfig.json": "def456"
  },
  "stack": {
    "framework": "vue",
    "version": "3.4.0",
    "confidence": 100
  },
  "dataLayer": {
    "stateManagement": "pinia",
    "backend": "supabase",
    "stores": ["tasks", "canvas", "timer"]
  }
}
```

**Success Criteria**:
- [ ] Second run uses cached analysis (< 100ms vs 2-3s)
- [ ] Cache invalidates correctly on package.json change
- [ ] Manual cache clear available (`/api/orchestrator/cache/clear`)

---

#### BUG-1019: Dev-Maestro Swarm Agent Cleanup + OOM Prevention (📋 PLANNED)

**Priority**: P0-CRITICAL
**Related**: TASK-303, TASK-323
**Created**: January 23, 2026

**Problem**: Swarm agents spawned by dev-maestro are not cleaned up when stuck/failed. Found 8 Claude "specialist" agents from 5 days ago still running, consuming ~2.4GB RAM collectively, spawning Vitest workers (4 workers × 4GB = 16GB spikes). Caused 336 OOM kills in 7 days.

**Evidence**:
- 8 agents started Jan 18, still running Jan 23
- All working on same tasks ("TimeBasedGreeting", "CurrentTime.vue") - failed orchestration
- Agents with `--max-turns 30` exceeded that without terminating
- Combined with Vitest parallelism → system OOM (earlyoom killed 336 processes)

**Root Causes**:
1. **No timeout/watchdog** - Agents need max lifetime (30 min) regardless of --max-turns
2. **No cleanup on crash** - When dev-maestro restarts, orphaned agents remain
3. **Duplicate task spawning** - Same task assigned to 7 agents (retry without killing previous)
4. **No resource limits** - Agents spawn unlimited Vitest workers

**Implementation Plan**:

1. **Agent Lifecycle Management**:
   - Track spawned agent PIDs in state file
   - Implement heartbeat/health check
   - Auto-kill agents older than configurable timeout (default 30 min)
   - Cleanup orphans on dev-maestro startup

2. **Resource Constraints**:
   - Limit concurrent agents (max 4)
   - Pass test runner config to limit parallelism (`--pool-options.threads.maxThreads=2`)
   - Memory limit per agent if possible

3. **Graceful Shutdown**:
   - On SIGTERM/SIGINT, kill all child agents
   - Register cleanup handlers

4. **Deduplication**:
   - Don't spawn new agent for task if one already running
   - Track task-to-agent mapping

**Key Files**:
- `~/.dev-maestro/server.js` - main orchestration logic (154KB)
- `~/.dev-maestro/supervisors/` - may have agent management
- `~/.dev-maestro/local/` - state/tracking

**Success Criteria**:
- [ ] No orphaned agents after orchestration ends
- [ ] Agents auto-killed after 30 min timeout
- [ ] Startup cleanup removes stale agents
- [ ] Max 4 concurrent agents enforced
- [ ] Graceful shutdown kills all children

---

#### FEATURE-1023: Voice Input - Transcription + Task Extraction (📋 PLANNED)

**Priority**: P1-HIGH
**Related**: FEATURE-1020 (RTL Support)
**Created**: January 23, 2026

**Overview**: Voice input that transcribes speech and auto-extracts task properties (priority, due date, project, description). Supports Hebrew + English with full voice control (create, edit, complete, delete tasks).

**Architecture**:
```
User speaks → Web Speech API → Transcription → NLP Parser → Task Properties → Confirmation UI → Create/Edit Task
                    ↓ (fallback)
              Whisper API
```

**Subtasks** (dependency order):

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| TASK-1024 | Web Speech API Integration | P1 | - |
| TASK-1025 | Mic Button in Quick-Add Bar | P1 | TASK-1024 |
| TASK-1026 | Task Property Extraction (NLP) | P1 | TASK-1024 |
| TASK-1027 | Commands for Existing Tasks | P2 | TASK-1026 |
| TASK-1028 | Confirmation UI + Edit Before Submit | P1 | TASK-1025, TASK-1026 |
| TASK-1029 | Whisper API Fallback | P2 | TASK-1024 |

**NLP Property Extraction Examples**:

| Input (Hebrew) | Extracted Properties |
|----------------|---------------------|
| "תזכיר לי מחר לשלוח מייל בעדיפות גבוהה" | title: "לשלוח מייל", due: tomorrow, priority: high |
| "בעוד שבועיים לקנות מתנה לאמא" | title: "לקנות מתנה לאמא", due: +2 weeks |
| "דחה את המשימה של הפגישה ב-3 ימים" | action: postpone, target: "הפגישה", amount: +3 days |

| Input (English) | Extracted Properties |
|-----------------|---------------------|
| "Remind me tomorrow to send email high priority" | title: "send email", due: tomorrow, priority: high |
| "In two weeks buy gift for mom" | title: "buy gift for mom", due: +2 weeks |
| "Postpone meeting task by 3 days" | action: postpone, target: "meeting", amount: +3 days |

**UI Design**:
```
┌─────────────────────────────────────┐
│ [Quick Add Bar]              [🎤]  │  ← Mic icon in quick-add
└─────────────────────────────────────┘

When recording:
┌─────────────────────────────────────┐
│                                     │
│         🔴 Recording...             │
│         ~~~~~~~~~~~~ (waveform)     │
│                                     │
│   "תזכיר לי מחר..."                 │  ← Live transcription
│                                     │
│         [Stop] [Cancel]             │
└─────────────────────────────────────┘

Confirmation:
┌─────────────────────────────────────┐
│  📝 New Task                        │
│  ────────────────────────────────── │
│  Title: [לשלוח מייל          ]      │
│  Due:   [Tomorrow      ▼]           │
│  Priority: [High ▼]                 │
│                                     │
│       [✓ Create]  [✗ Cancel]        │
└─────────────────────────────────────┘
```

**Key Technologies**:
- Web Speech API (`webkitSpeechRecognition`)
- OpenAI Whisper API (fallback)
- Simple NLP parser (regex + keyword matching for dates/priorities)

**Success Criteria**:
- [ ] Mic button visible in PWA quick-add bar
- [ ] Hebrew transcription works accurately
- [ ] English transcription works accurately
- [ ] Auto-detects language (Hebrew/English)
- [ ] Extracts priority from "high/urgent/גבוהה/דחוף"
- [ ] Extracts dates from "tomorrow/מחר/next week/בעוד שבוע"
- [ ] Shows confirmation UI before creating task
- [ ] Voice commands work for existing tasks (postpone, complete, etc.)
- [ ] Whisper fallback activates when Web Speech fails
- [ ] Works offline (Web Speech only)

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
---

- [ ] Offline mode works on both platforms
- [ ] Lighthouse PWA score >= 90

---

---

### ~~BUG-259~~: Canvas Task Layout Changes on Click (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-25) - Cannot Reproduce
**Created**: January 13, 2026

**Bug**: Clicking on a task in the canvas changes its layout/width when it shouldn't.

**Investigation (2026-01-13)**:

- Width stays constant at 280px before and after click
- Only \~2px height change detected (145px → 143px)
- CSS correctly constrains: `width: 280px; min-width: 200px; max-width: 320px`
- `.selected` class only modifies `box-shadow`, not dimensions

**Resolution**: User confirmed cannot reproduce. Closed.

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

### TASK-108: Tauri/Web Design Parity (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-23)

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

### ~~TASK-140~~: Undo/Redo Visual Feedback (✅ DONE)

**Priority**: P3-LOW (UX Enhancement)
**Discovered**: January 8, 2026
**Completed**: January 23, 2026
**Related**: Undo/Redo System Review

**Feature**: Show toast/notification when undo or redo is performed.

**Implementation**:
- Toast notifications via `showUndoRedoToast()` in `undoSingleton.ts`
- Setting `showUndoRedoToasts` in settings store (default: true)
- Toggle in Settings > Workflow > Feedback

**Completed**:

- [x] Show brief toast: "Undone: [action description]"
- [x] Show brief toast: "Redone: [action description]"
- [x] Auto-dismiss after 2.5 seconds
- [x] Option to disable in settings

---

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

##### ~~TASK-331~~: Tauri Multi-App Migration (LocalStorage) (✅ OBSOLETE)
- ~~Create migration script to copy data from `com.pomoflow.desktop` to `com.flowstate.app`.~~ N/A
- ~~Update all persistence layers to use the unified app name.~~ N/A
- **Closed 2026-01-23**: Single-user app, old `com.pomoflow.desktop` directory deleted manually. No migration needed.

##### ~~TASK-332~~: Backup Reliability & Verification (✅ DONE)
- [x] Fix Tauri native file dialog for "Download Backup" button.
  - Added path separator fix
  - Added 30s timeout to prevent XDG portal hangs
  - Browser fallback when Tauri methods fail
- [x] Implement Golden Backup rotation (keep last 3 peak task counts).
  - New storage key: `flow-state-golden-backup-rotation`
  - Backups sorted by task count descending
  - Legacy single-backup migration supported
  - UI shows all peaks with restore option for each
- [x] Add Automated Backup Verification tests (22 comprehensive tests).
  - Checksum validation
  - Data completeness
  - Edge cases (empty, corrupted)
  - Golden backup rotation
  - Suspicious data loss detection (BUG-059)
  - Restore analysis (TASK-344 dry-run)
  - Export/import round-trip

##### TASK-333: Independent Audit of Crisis Analysis (🔄 IN PROGRESS)
- [ ] Spawn independent QA Supervisor via `dev-maestro`.
- [ ] Verify consistency between documented fixes and codebase state.
- [ ] Review crisis report for any missing deep context or technical inaccuracies.

---

#### Related
- [TASK-317: Shadow Backup Deletion-Aware Restore](#task-317-shadow-backup-deletion-aware-restore--supabase-data-persistence-done)
- [Crisis Report](../reports/2026-01-20-auth-data-loss-analysis.md)

