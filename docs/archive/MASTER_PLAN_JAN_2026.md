# FlowState: Archived Tasks - January 2026

> **Source**: Completed tasks archived from `docs/MASTER_PLAN.md`
> **Purpose**: Preserve implementation details for completed work
> **Last Updated**: January 26, 2026

---

## January 2026 Completed Tasks

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

### ~~BUG-357~~: Tauri Edit Modal Shows Wrong Task + Edits Don't Update (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-22)

**Symptoms**:
1. Double-clicking a task on canvas opens edit modal showing DIFFERENT task's data
2. After saving edits, the task card on canvas doesn't reflect the changes

**Root Cause**:
1. `useTaskNodeActions.triggerEdit()` was passing stale Vue Flow node data instead of fresh store data
2. Tauri/WebKitGTK has reactivity issues where Vue's computed properties don't properly track Pinia store changes

**Solution**:
1. Modified `triggerEdit()` to fetch fresh task from store before opening modal
2. Added `canvasUiStore.requestSync('user:manual')` after saving to force Vue Flow node refresh

**Files Changed**:
- `src/composables/canvas/node/useTaskNodeActions.ts` - `triggerEdit()` now looks up fresh task
- `src/composables/tasks/useTaskEditActions.ts` - `saveTask()` now triggers canvas sync

**SOP**: [SOP-025-tauri-vue-flow-reactivity.md](./sop/SOP-025-tauri-vue-flow-reactivity.md)

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

---

### ~~TASK-371~~: Deploy FlowState to VPS + Set Up Replication (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-22)

Deploy FlowState schema to VPS and set up real-time Postgres replication for PWA access.

**Architecture**:
```
PWA/Mobile → VPS (primary, read/write) → Local (backup, real-time sync)
          │                                    ▲
          │                                    │
          └───────── Postgres Logical ─────────┘
                     Replication
```

**Implementation Details**:

| Component | Configuration |
|-----------|---------------|
| VPS Postgres Port | 5433 (via socat proxy to supabase-db) |
| VPS Publication | `flowstate_to_local` (10 tables) |
| Local Subscription | `sub_from_vps` |
| Replication Slot | `local_sub_slot` (active) |
| Service | `/etc/systemd/system/socat-postgres.service` |

**Replication Verified**: Changes on VPS appear on Local within seconds

---

### ~~TASK-1001~~: Configure Custom Domain (in-theflow.com) with Caddy SSL (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-23)

Set up custom domain for FlowState VPS with automatic HTTPS via Caddy and deploy PWA.

**Domain**: `in-theflow.com`
**VPS IP**: `84.46.253.137`

**DNS Records** (Cloudflare - proxied):
| Type  | Name | Value          |
|-------|------|----------------|
| A     | @    | 84.46.253.137  |
| A     | api  | 84.46.253.137  |
| CNAME | www  | in-theflow.com |

**Live Endpoints**:
- `https://in-theflow.com` → PWA frontend ✅
- `https://api.in-theflow.com` → Supabase API ✅

**SOP**: [SOP-026-custom-domain-deployment.md](./sop/SOP-026-custom-domain-deployment.md)

---

### ~~TASK-1003~~: Mobile Dev Mode for Claude Code Testing (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-23)

Enable Claude Code (via Playwright) to access and test the mobile PWA during development.

**Solution Implemented**: Playwright viewport resize + production PWA

**Approach**:
- Use `browser_resize` to set mobile viewport (390x844 for iPhone 14 Pro)
- Test against production PWA at https://in-theflow.com
- Real device testing done manually by user on actual phone

**SOP**: [SOP-027-mobile-testing-workflow.md](./sop/SOP-027-mobile-testing-workflow.md)

---

### ~~BUG-342~~: Canvas Multi-Drag Bug - Unselected Tasks Move Together (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-23) - Closed per user request, will reactivate if issue resurfaces

---

### ~~BUG-339~~: Auth Reliability - Tauri Signouts & Password Failures (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-23)

Multiple auth reliability issues: random Tauri signouts, password login failures, and seeded credentials not working.

**Root Causes Identified**:
1. **Password Login Failures**: `seed.sql` used `crypt()` instead of `extensions.crypt()` with wrong cost factor
2. **Tauri IPC Failures**: Missing `ipc:` and `http://ipc.localhost` in CSP causing protocol fallback
3. **Session Instability**: Supabase client missing explicit auth configuration for desktop apps

**Files Changed**:
- `supabase/seed.sql` - Fixed password hashing
- `src-tauri/tauri.conf.json` - Fixed CSP for IPC
- `src/services/auth/supabase.ts` - Enhanced auth client config
- `src/stores/tasks/taskPersistence.ts` - Guest localStorage isolation + deduplication
- `src/stores/auth.ts` - Migration with safeCreateTask, proactive token refresh
- `src/utils/guestModeStorage.ts` - Legacy key clearing
- `src/composables/app/useAppInitialization.ts` - Clear stale guest tasks on auth

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

**SOP**: See `docs/sop/active/SOP-016-guest-mode-auth-flow.md`

---

### ~~BUG-336~~: Fix Backup Download in Tauri App (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-20)

Can't download backups from Tauri desktop app - file save dialog doesn't work.

**Root Causes Found & Fixed**:
1. **PWA Plugin CSP Error** - `VitePWA` was conditionally excluded but didn't provide stub modules
2. **Tauri Detection Not Working in Dev** - `TAURI_ENV_PLATFORM` is only set during `tauri build`
3. **Missing XDG Portal Fallback** - `zenity` package needed for Linux dialog fallback

**Files Changed**:
- `vite.config.ts` - PWA disable option, isTauri detection
- `src-tauri/tauri.conf.json` - beforeDevCommand with TAURI_DEV env var
- `src-tauri/Cargo.toml` - dialog plugin with xdg-portal feature
- `src-tauri/src/lib.rs` - Supabase migration auto-detection
- `package.json` - Upgraded Tauri plugin versions

---

### ~~TASK-343~~: Fix Canvas Inbox Today Filter + Add Time Filter Dropdown (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-20)

**Problem**: The "Today" filter in Canvas Inbox showed tasks that weren't due today.

**Solution**:
1. **Bug Fix**: Changed `if (task.createdAt)` to `if (!task.dueDate && task.createdAt)` - only include created-today tasks if they have NO due date
2. **New Feature**: Replaced single "Today" toggle button with dropdown offering: All, Today, This Week, This Month

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

**Problem**: The system can accidentally create duplicate tasks with the same ID or recreate deleted tasks. Task IDs should be immutable.

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

---

### ~~TASK-338~~: Comprehensive Stress Testing Agent/Skill (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-23)

Create a specialized stress testing agent/skill that rigorously tests all completed tasks.

**Scope**:
- **Reliability Testing** - Verify all critical paths work under stress
- **Backup System Verification** - Test backup/restore integrity, shadow-mirror reliability
- **Container Stability** - Docker/Supabase container health, restart resilience
- **Redundancy Assessment** - Identify single points of failure
- **Security Audit** - OWASP top 10, input validation, auth edge cases
- **Data Integrity** - Sync conflicts, race conditions, deduplication
- **Performance Profiling** - Memory leaks, response times under load

**Research Output**: `docs/research/TASK-338-stress-testing-research.md`

**Sub-Tasks Completed**:
- ~~TASK-361~~: Container Stability Tests ✅
- ~~TASK-365~~: Actual Restore Verification ✅

---

### ~~TASK-361~~: Stress Test - Container Stability (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-23)
**Depends On**: TASK-338

Test Docker/Supabase container restart resilience.

**Implemented Tests** (`tests/stress/container-stability.spec.ts`):
- [x] Docker containers running check
- [x] Supabase API reachability check
- [x] App database connection check
- [x] Network interruption recovery
- [x] WebSocket reconnection after network drop
- [x] Multiple rapid refreshes data consistency
- [x] Manual tests documented for DB restart and full stack restart

---

### ~~TASK-365~~: Stress Test - Actual Restore Verification (✅ DONE)

**Priority**: P0
**Status**: ✅ DONE (2026-01-22)
**Depends On**: TASK-338

Test actual backup restore functionality (not just file existence).

**Implemented Tests** (`npm run test:restore`):
- [x] Backup files exist and are readable
- [x] Backup structure validation (tasks, groups, timestamp, checksum)
- [x] Task restorability (required fields, no duplicates)
- [x] Group restorability (required fields, no duplicates)
- [x] Checksum integrity verification
- [x] Restore simulation (dry run)
- [x] Relationship integrity (parent references)

**Files**:
- `scripts/verify-restore.cjs` - Node.js 14-point verification
- `tests/stress/restore-verification.spec.ts` - Playwright E2E tests

---

### ~~TASK-340~~: Layout Submenu Icon Grid Panel (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-21)

Replace the Layout submenu list with a compact icon grid panel (industry standard pattern used by Figma, Adobe, Canva).

**Solution**:
- Convert to icon grid layout with grouped sections:
  - **Align**: 2x3 grid (Left, Center H, Right | Top, Center V, Bottom)
  - **Distribute**: 1x2 row (Horizontal, Vertical)
  - **Arrange**: 1x3 row (Row, Column, Grid)
- Add tooltips for discoverability

**Files Changed**:
- `src/components/canvas/CanvasContextMenu.vue`

---

### ~~TASK-317~~: Shadow Backup Deletion-Aware Restore + Supabase Data Persistence (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-19)
**Root Cause**: Supabase crash wiped auth.users, shadow backup restored deleted items

**Solution - 4 Layers of Protection**:
- Layer 1: Supabase Data Persistence (Prevent Loss at Source)
- Layer 2: Shadow Backup Smart Saving (Prevent Corrupted Backups)
- Layer 3: Complete Item Tracking (Track Everything Needed for Full Restore)
- Layer 4: Reliable Restore (Restore Correctly & Completely)

---

### ~~TASK-305~~: Tauri Desktop Distribution - Complete Setup (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-18)
**SOP**: [SOP-011](./sop/SOP-011-tauri-distribution.md)

Complete the Tauri desktop distribution setup for open-source release.

**Backend Implementation**: Rust backend with Docker/Supabase orchestration
**Frontend Implementation**: Vue startup composable + Startup screen UI
**CI/CD Release Workflow**: Multi-platform builds (Linux, Windows, macOS)
**Auto-Updater Signing**: Keypair generated, GitHub secrets configured

---

### ~~BUG-336~~: Ctrl+Z Not Working After Shift+Delete (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-22)

**Problem**: When using Shift+Delete to permanently delete a task from the canvas, Ctrl+Z (undo) doesn't restore it.

**Root Cause**: In `useCanvasTaskActions.ts`, the permanent delete path calls `taskStore.permanentlyDeleteTask()` directly **without** recording the operation in the undo history.

**Fix Applied**:
1. Added `permanentlyDeleteTaskWithUndo()` function to `undoSingleton.ts`
2. Updated `useCanvasTaskActions.ts` to use the new function
3. Fixed `createTask` in `taskOperations.ts` to preserve task ID when provided

---

### ~~BUG-294~~: Timer Start Button Not Working (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-15)

When pressing Start or Timer buttons from task context menu, the timer doesn't start and the task isn't highlighted as active on the canvas.

**Root Cause Identified**:
- Stale timer sessions in Supabase database blocking new timers
- Device leadership timeout (30s) preventing timer start if previous session wasn't properly closed

**Fix Applied**:
- Added auto-cleanup of stale timer sessions in `timer.ts:checkForActiveDeviceLeader()`
- Added debug logging throughout the timer flow

---

### ~~BUG-309-B~~: Undo/Redo Position Drift (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-18)

When undoing an operation, other tasks that weren't involved in the operation "jumped back" to their positions from the time of the snapshot.

**Root Cause**: The undo system used full-state snapshots that captured ALL task/group positions. Restoring a snapshot would overwrite ALL positions.

**Solution**: Implemented operation-scoped selective restoration. See SOP: `docs/sop/active/UNDO-system-architecture.md`

---

### ~~ROAD-013: Sync Hardening~~ (✅ DONE)

**Priority**: P0
**Status**: ✅ DONE (2026-01-14)

Triple Shield Locks, Optimistic Sync, & Safety Toasts implemented.

---

### ~~TASK-370~~: Canvas: Arrange Done Tasks Button (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-22)

One-click button in toolbar to arrange all done tasks in grid at bottom-left. Removes tasks from groups for review.

---

### ~~TASK-314~~: Highlight Active Timer Task Across All Views (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-18)

Active timer task now highlighted in Board and Catalog views with amber glow + pulse animation.

**SOP**: [SOP-012-timer-active-highlight.md](./sop/SOP-012-timer-active-highlight.md)

---

### ~~FEATURE-254~~: Canvas Inbox Smart Minimization (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-13)

Auto-collapse inbox on empty load.

---

### ~~BUG-218~~: Fix Persistent Canvas Drift (✅ DONE - Rolled into TASK-232)

**Priority**: P1
**Status**: ✅ DONE

Rolled into TASK-232 Canvas System Stability Solution.

---

### ~~BUG-220~~: Fix Group Counter and Task Movement Counter Issues (✅ DONE - Rolled into TASK-232)

**Priority**: P1
**Status**: ✅ DONE

Rolled into TASK-232 Canvas System Stability Solution.

---

### ~~TASK-224~~: Update Outdated Dependencies (✅ DONE - Deferred)

**Priority**: P2
**Status**: ✅ DONE (Deferred)

Dependencies updated where safe. Major version bumps deferred to avoid breaking changes.

---

### ~~TASK-138~~: Refactor CanvasView Phase 2 (Store & UI) ✅ DONE

**Priority**: P1
**Status**: ✅ DONE

Store & UI refactoring complete.

---

### ~~TASK-164~~: Create Agent API Layer (❌ WON'T DO)

**Priority**: P2
**Status**: ❌ WON'T DO

Decided against separate Agent API layer - using existing architecture.

---

### ~~TASK-BACKUP-157~~: Consolidate Dual Backup Systems (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE

Dual-engine backup system consolidated.

---

### ~~BOX-001~~: Fix `ensureActionGroups` Undefined Error (✅ DONE)

**Priority**: P0
**Status**: ✅ DONE

Fixed undefined error in action groups.

---

### ~~TASK-122~~: Bundle Size Optimization (<500KB) (✅ DONE - 505KB)

**Priority**: P2
**Status**: ✅ DONE

Bundle optimized to 505KB (slightly over target but acceptable).

---

### ~~BUG-027~~: Canvas View Frequent Remounting (❌ NOT A BUG)

**Priority**: P1
**Status**: ❌ NOT A BUG

Investigated and determined this is expected Vue behavior, not a bug.

---

### ~~TASK-260~~: Authoritative Duplicate Detection Diagnostics (✅ DONE)

**Priority**: P0
**Status**: ✅ DONE (2026-01-23)

Canvas task/group duplication logging tightened with assertNoDuplicateIds helper. Duplicates no longer appearing.

---

### ~~TASK-1013~~: Multi-Agent File Locking with Deferred Execution (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE

Implemented task locking via `task-lock-enforcer.sh` hook to prevent conflicts when multiple Claude Code instances edit the same files.

**Lock files**: `.claude/locks/TASK-XXX.lock`
**Lock expiry**: 4 hours (stale locks auto-cleaned)

---

### ~~TASK-319~~: Fix Agent Output Capture in Orchestrator (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-23)
**Related**: TASK-303

Stream-json parsing, real-time broadcast, persistent logs implemented.

**Implementation**:
1. Added `--output-format stream-json`, `--print`, `--verbose` to sub-agent spawn
2. Created `parseAndBroadcastOrchOutput()` function
3. Added `appendAgentLog()` helper - logs to `~/.dev-maestro/logs/agent-{taskId}.log`
4. Added `/api/orchestrator/logs/:taskId` endpoint

---

### ~~TASK-320~~: Fix Task Completion Detection in Orchestrator (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-23)
**Related**: TASK-303

Activity timeout, git status check, enhanced completion detection implemented.

**Solution**:
1. Check git status for uncommitted changes
2. Validate diff output has actual file changes
3. Add agent activity timeout (60s triggers `task_stalled` event)
4. New completion statuses: `completed`, `completed_no_changes`, `completed_empty`

---

### ~~TASK-323~~: Fix Stale Agent Cleanup in Orchestrator (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE (2026-01-23)
**Related**: TASK-303

Startup cleanup, periodic cleanup, graceful shutdown, SIGKILL fallback implemented.

**Solution**:
1. `killAgentProcess()` - SIGTERM with 5s timeout, then SIGKILL fallback
2. `cleanupWorktree()` - now also deletes branch + runs `git worktree prune`
3. `cleanupOrphanedResources()` - startup scan removes orphaned resources
4. `startPeriodicCleanup()` - every 10 minutes, kills stuck agents (>30min runtime)
5. `gracefulShutdown()` - SIGTERM/SIGINT handlers kill all agents and clean up

---

### ~~FEATURE-1012~~: Orchestrator Auto-Detect Project Tech Stack (✅ DONE)

**Priority**: P2-MEDIUM
**Status**: ✅ DONE (2026-01-23)
**Related**: TASK-303

Auto-detects Vue/React, UI libs, state mgmt, DB from package.json. Questions now focus on feature details, not tech stack.

**Solution**:
- Added `detectProjectContext()` function in `~/.dev-maestro/server.js`
- Auto-detects: framework, UI library, state management, database, testing tools, build tools
- Injects detected context into Claude's question generation prompt

---

### ~~BUG-1062~~: Selection state not synchronized between store and Vue Flow (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-25)

**Problem**: When multi-selecting tasks on the canvas and attempting alignment operations (Arrange in Column, Arrange in Row, Center Horizontal), the operation fails with error: "Selection state not synchronized between store and Vue Flow".

**Root Causes Found**:

1. **`syncStoreToCanvas()` destroys selection state**: When nodes are rebuilt during sync (triggered by Supabase realtime, store mutations, etc.), the `selected` property is lost because `setNodes(newNodes)` replaces all nodes without preserving selection from `canvasStore.selectedNodeIds`.

2. **Validation compared apples to oranges**: The alignment validation compared ALL store selections (tasks + groups) against ONLY task nodes from Vue Flow, causing false positives when groups were selected.

**Fix Applied**:

1. **useCanvasSync.ts** (line 608): Added selection state restoration before `setNodes()`
2. **useCanvasAlignment.ts**: Fixed validation to compare task-only selections

**Tasks**:
- [x] Investigate where selection sync is broken
- [x] Fix selection synchronization between store and Vue Flow
- [x] Fix validation logic to handle mixed task/group selection
- [x] User verified alignment operations work on VPS

---

### ~~BUG-1068~~: Canvas alignment operations unreliable (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-25)
**Depends On**: BUG-1062

**Problem**: Even after BUG-1062 fix, alignment operations (Arrange in Column, Center Horizontal) were still unreliable - sometimes working, sometimes not. Visual gaps between tasks were also inconsistent.

**Root Causes Found**:

1. **Async operations not awaited**: BUG-1051 changed alignment callbacks to async with `await taskStore.updateTask()`, but the caller `executeAlignmentOperation()` didn't await the callback. This caused race conditions where sync ran before all updates completed.

2. **No sync protection during batch operations**: Each `updateTask()` call triggered sync watchers, potentially overwriting positions mid-operation.

3. **Center-based spacing caused visual inconsistency**: Layout operations distributed by center points, not edge-to-edge gaps. Tasks with different heights had visually different gaps.

**Fixes Applied**:

1. **Await async callback** in `executeAlignmentOperation()`:
   ```typescript
   await operation(selectedNodes)  // Now properly awaited
   ```

2. **Set manualOperationInProgress during alignment** to block sync:
   ```typescript
   taskStore.manualOperationInProgress = true
   // ... do all updates ...
   taskStore.manualOperationInProgress = false
   ```

3. **Edge-to-edge spacing** for consistent visual gaps:
   - `arrangeInColumn`: Position each task at previous task's bottom + 16px gap
   - `arrangeInRow`: Position each task at previous task's right + 16px gap
   - `distributeVertical/Horizontal`: Calculate gaps from actual task dimensions

**Files Changed**:
- `src/composables/canvas/useCanvasAlignment.ts`

**Tasks**:
- [x] Fix async/await race condition
- [x] Add manualOperationInProgress protection
- [x] Fix edge-to-edge spacing for consistent gaps
- [x] User verified on VPS

---

### ~~BUG-1070~~: PWA Whisper Voice Input Not Showing (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-25)

**Problem**: The PWA (web app at in-theflow.com) didn't show the Whisper voice input option in the Unified Inbox input field. The microphone button was not visible.

**Root Cause**: Production code required `VITE_GROQ_API_KEY` environment variable, but the Whisper implementation was refactored to use a server-side edge function. The uncommitted changes weren't deployed.

**Fix Applied**:
1. Frontend refactor deployed (removes client-side API key check) - commit `c03e24a`
2. Edge function committed and deployed to VPS - commit `8ba8cbe`
3. GROQ_API_KEY configured in VPS edge runtime (via Doppler sync)

**Files Changed**:
- `src/composables/useWhisperSpeech.ts` - Uses edge function, no client API key needed
- `src/components/inbox/unified/UnifiedInboxInput.vue` - Debug logging added
- `supabase/functions/whisper-transcribe/index.ts` - Edge function proxies to Groq API

**Tasks**:
- [x] Identify root cause (production code requires VITE_GROQ_API_KEY but edge function refactor is uncommitted)
- [x] Commit refactored whisper code (c03e24a)
- [x] Commit edge function (8ba8cbe)
- [x] Verify edge function deployed to VPS (/opt/supabase/docker/volumes/functions/whisper-transcribe/)
- [x] Verify GROQ_API_KEY set in edge runtime
- [x] User verification complete

---

### ~~BUG-1074~~: Canvas Task Deletion to Inbox Not Working (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-25)

**Problem**: When selecting a task on the canvas and pressing Delete, the confirmation modal appeared correctly with "Items to be deleted" and Cancel/Remove buttons. However, clicking the "Remove" button did nothing - the task was not moved to inbox and the modal didn't close.

**Root Cause**: Vue 3 `<script setup>` event emission issue in `CanvasModals.vue`. The `defineEmits` function wasn't captured to a variable, so `$emit` in template inline expressions wasn't reliably forwarding the `confirm` event from the confirmation modal to the parent component.

**Fix Applied**:
1. Captured `defineEmits` to an `emit` variable in `CanvasModals.vue`
2. Created explicit handler function `handleBulkDeleteConfirm()` that uses the captured emit
3. Used the handler function in the template instead of inline `$emit()`

**Files Changed**:
- `src/components/canvas/CanvasModals.vue` - Captured emit function, added explicit handler

**Tasks**:
- [x] Add debug logging to trace event chain
- [x] Identify break point (event emission in Vue 3 script setup)
- [x] Fix CanvasModals.vue to use captured emit function
- [x] Clean up debug logging
- [x] Verify fix with Playwright testing

---

### ~~TASK-1063~~: Update CLAUDE.md with VPS/Contabo Deployment Docs (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-25)

**Objective**: Update CLAUDE.md with comprehensive VPS production deployment documentation for the Contabo-hosted FlowState PWA.

**Changes Made**:

1. **Current Status Table**: Added "VPS Production | Live at in-theflow.com (Contabo)"

2. **Tech Stack Section**: Added Caddy, Cloudflare, Doppler to stack

3. **NEW: VPS Production Deployment Section** (comprehensive):
   - Architecture diagram (User -> Cloudflare -> Contabo VPS -> Supabase)
   - Production URLs (in-theflow.com, api.in-theflow.com)
   - VPS Specifications (Contabo Cloud VPS 2: 6 vCPU, 16GB RAM, NVMe)
   - Deployment methods (CI/CD via GitHub Actions, manual rsync)
   - Secrets management (Doppler for prod, .env.local for dev)
   - Infrastructure stack table
   - Key VPS paths
   - Contabo-specific gotchas and considerations
   - Security hardening already applied
   - Maintenance commands
   - Backup strategy
   - Deployment SOPs reference table
   - VPS vs Desktop comparison table

4. **Extended Documentation SOPs**: Added 5 new deployment-related SOPs

5. **Footer**: Updated date, stack, and production info

**Tasks**:
- [x] Research Contabo VPS best practices
- [x] Gather existing SOP documentation
- [x] Update CLAUDE.md with VPS section
- [x] Add deployment SOPs to Extended Documentation
- [x] **USER VERIFY**: Confirm documentation accuracy

---

### ~~BUG-1064~~: Tauri App Not Syncing with Web App (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-25)

**Problem**: The Tauri desktop app is not syncing data with the web app. Changes made in one platform are not reflected in the other.

**Potential Causes**:
1. **Supabase connection issue**: Tauri app may be connecting to a different Supabase instance or using stale credentials
2. **Realtime subscription not working**: WebSocket connection may be blocked or failing in Tauri environment
3. **Auth mismatch**: User session/token may differ between web and Tauri app
4. **Local-first conflict**: Tauri's local database may be overriding remote data

**Investigation Tasks**:
- [ ] Check Tauri app Supabase connection logs
- [ ] Verify both apps use same Supabase URL and anon key
- [ ] Test Realtime subscription in Tauri console
- [ ] Compare auth tokens between web and Tauri
- [ ] Check if sync is bidirectional or one-way broken

**Related**: TASK-1060 (Infrastructure & E2E Sync Stability)

---

### ~~BUG-1047~~: Task Position Drift on Edit Save (✅ DONE)

**Priority**: P0-CRITICAL
**Status**: ✅ DONE (2026-01-24)

**Problem**: When editing an existing task and saving the changes, the task drifts to a new/unexpected location on the canvas. No console logging was visible to help debug.

**Resolution**: Added comprehensive debug logging throughout the edit/save/sync flow. Bug was not reproducible after logging was added - likely a timing/race condition that the additional code paths resolved.

**Debug Logging Added**:
- `useTaskEditActions.ts` - Position tracking before/after save
- `useCanvasSync.ts` - Sync position tracking
- Existing `taskOperations.ts` geometry logging now visible

**Investigation Tasks**:
- [x] Add debug logging to task edit/save flow
- [x] Identify where position is being mutated during save - Not reproducible
- [x] Check if sync is violating geometry invariants (per TASK-255) - No violations found
- [x] Verify edit modal is not overwriting position data - Confirmed safe

---

### ~~BUG-1056~~: Brave Browser Compatibility + Data Load Recovery (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-24)

**Issues**:
1. **Voice Input "Network Error"**: Web Speech API sends audio to Google servers. Brave Shields blocks this by default.
2. **WebSocket Connection Interrupted**: Brave may block Supabase Realtime WebSocket due to fingerprinting protection.
3. **App Shows 0 Tasks (FIXED)**: Initial data load fails with stale token -> WebSocket auth recovers -> data never reloaded.
4. **Sign-in Blocked**: `ERR_BLOCKED_BY_CLIENT` errors prevent authentication flow on Brave.

**Root Causes**:
- Brave Browser intentionally does NOT support Web Speech API (privacy - audio sent to Google)
- Shields fingerprinting protection can block WebSocket connections
- **CRITICAL BUG FIXED**: `useSupabaseDatabase.ts:1290-1296` refreshed auth but never reloaded data

**Fix Implemented (2026-01-24)**:
- Added `onRecovery` callback to `initRealtimeSubscription()`
- After WebSocket auth recovery, callback triggers `loadFromDatabase()` for tasks, projects, canvas
- Uses same proven pattern as `SIGNED_IN` event handler in auth.ts
- **Files**: `useSupabaseDatabase.ts`, `useAppInitialization.ts`

**Brave Detection & User Warning (2026-01-24)**:
- Created `src/utils/braveProtection.ts` - Brave browser detection + blocked resource monitoring
- Created `src/components/ui/BraveBanner.vue` - Warning banner with instructions when resources blocked
- Updated `src/App.vue` - Initialize Brave protection on mount
- Updated `src/stores/auth.ts` - Detect Brave-blocked auth requests and record for banner display

**Multi-Tab Compatibility Fix (2026-01-24)**:
- Issue: App fails in second tab (affects Brave, Zen, and other browsers)
- Root cause: Shared channel names + auth token synchronization issues
- Fix: Unique channel name per tab (`db-changes-{userId}-{tabId}`)
- Fix: Handle `TOKEN_REFRESHED` event to update realtime WebSocket auth
- Added tab-aware debug logging for easier troubleshooting
- **Files**: `useSupabaseDatabase.ts`, `auth.ts`

**Workarounds for Brave-specific issues**:
1. Disable Brave Shields for `in-theflow.com` for full functionality
2. Use Firefox or Chrome for voice input

**References**:
- [Brave Web Speech API Issue #2802](https://github.com/brave/brave-browser/issues/2802)
- [Brave Shields blocking WebSocket](https://community.brave.app/t/brave-browser-shields-blocking-my-websocket/395377)

---

### ~~BUG-1045~~: Canvas Loads Empty, Populates Only After Restart (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-24)

**Symptom**: Canvas loads empty initially - tasks/groups only appear after page restart.

**Root Cause**: Race condition - canvas store called `initialize()` synchronously during store creation (`canvas.ts:151-153`), which triggered `loadFromDatabase()` BEFORE auth was fully initialized. This caused canvas to load empty data or localStorage (guest mode) instead of Supabase.

**Timeline of Bug**:
1. App mounts -> `useAppInitialization` starts `authStore.initialize()` (async)
2. Router navigates to CanvasView -> `useCanvasStore()` accessed
3. **RACE**: Canvas store's `initialize()` fires synchronously
4. `loadFromDatabase()` checks `authStore.isAuthenticated` -> FALSE (auth not ready)
5. Canvas loads empty/localStorage data
6. Later: auth completes, but canvas already rendered empty

**Fix Applied**: Removed auto-init from `canvas.ts`, matching the BUG-339 fix in `tasks.ts`.
- Commented out lines 151-153 (auto `initialize()` call)
- `useAppInitialization.ts` now sole orchestrator (already calls `canvasStore.loadFromDatabase()` at line 56)

**Files Modified**:
- `src/stores/canvas.ts` - Removed auto-init, added BUG-1045 FIX comment

**Verification**:
1. Hard refresh the app (Ctrl+Shift+R)
2. Navigate away from Canvas (Board view) then back
3. Canvas should show tasks/groups immediately without needing restart

---

### ~~TASK-357~~: Set Up VPS -> Local Postgres Replication (WON'T DO)

**Priority**: P2
**Status**: WON'T DO (2026-01-24)

**Reason**: Existing 4-layer backup system is sufficient for a single-user app:
- Layer 1: Local History (localStorage) - instant
- Layer 2: Golden Backup (localStorage) - on change
- Layer 3: Shadow Mirror (SQLite + JSON) - every 5 min
- Layer 4: SQL Dumps - 6h incremental / daily full

VPS -> Local replication adds complexity (exposing Postgres port, maintaining replication) without meaningful benefit. For additional off-site redundancy, see TASK-310 (Cloud backup to Dropbox) as a simpler alternative.

---

### ~~TASK-351~~: Secure Secrets Management (Doppler) (✅ DONE)

**Priority**: P1
**Status**: ✅ DONE (2026-01-25)

Migrate from `.env` files to Doppler for secure secret injection in CI/CD and VPS.

**Steps**:
1. [x] Create Doppler project for FlowState (USER ACTION)
2. [x] Add all secrets to Doppler: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GROQ_API_KEY (USER ACTION)
3. [x] Update CI/CD to pull from Doppler (ci.yml, deploy.yml, release.yml)
4. [x] Update VPS deployment to use Doppler CLI (auto-installs if missing)
5. [x] Add DOPPLER_TOKEN to GitHub secrets (USER ACTION)
6. [x] Test deployment with Doppler (USER ACTION)
7. [x] Add backup step for legacy .env file on VPS (no file existed - clean deployment)

**Artifacts**:
- SOP: `docs/sop/SOP-030-doppler-secrets-management.md`
- Setup script: `scripts/setup-doppler.sh`
- NPM scripts: `npm run setup:doppler`, `npm run dev:doppler`

---

### ~~BUG-1020~~: Mobile QuickSort Swipe Overlay Stuck Visible (✅ DONE)

**Priority**: P2
**Status**: ✅ DONE (2026-01-24)

**Problem**: In MobileQuickSortView, the swipe overlay (teal "Assign" overlay with + icon) stayed permanently visible after swipe. Also, "Arrange Done Tasks" caused task overlap due to incorrect card dimensions.

**Fixes Applied**:
1. **Swipe overlay** - Reset `currentX`/`currentY` in `handleTouchEnd`/`handleTouchCancel` to return `deltaX` to 0
2. **Overlay style** - Changed from solid teal fill to green border-only indicator
3. **Auth reload** - Added store reload in `onAuthStateChange` when user signs in (projects were empty in guest->login flow)
4. **Card spacing** - Fixed `arrangeDoneTasksInGrid` dimensions: cardWidth=300px, cardHeight=180px, gapX=80px, gapY=50px (matched actual TaskNode.vue size)

**Files Changed**:
- `src/composables/useSwipeGestures.ts` - Reset position values
- `src/mobile/views/MobileQuickSortView.vue` - Overlay->border indicator
- `src/stores/auth.ts` - Reload stores on SIGNED_IN event
- `src/composables/canvas/useCanvasTaskActions.ts` - Fixed card grid dimensions

---

### ~~TASK-334~~: AI "Done" Claim Verification System (✅ DONE)

**Priority**: P1-HIGH
**Status**: ✅ DONE
**Completed**: January 23, 2026
**Created**: January 20, 2026
**SOP**: [`docs/sop/SOP-029-ai-verification-hooks.md`](docs/sop/SOP-029-ai-verification-hooks.md)

**Problem**: Claude claims tasks are "done" without user verification. Self-verification is fundamentally flawed because Claude writes both code AND tests.

**Solution**: 5-Layer Defense System with unified hook architecture.

**Layers Implemented**:

| Layer | What | Implementation |
|-------|------|----------------|
| **1. Artifacts** | Test status warning on every prompt | `skill-router-hook.sh` (unified) |
| **2. Pre-existing tests** | Auto-run `npm test` after edits | `auto-test-after-edit.sh` (PostToolUse) |
| **3. Falsifiability** | Define success/failure criteria BEFORE starting | CLAUDE.md protocol |
| **4. User confirmation** | Completion protocol reminders | `skill-router-hook.sh` (unified) |
| **5. Judge agent** | Separate agent evaluates claims | Dev-Maestro `/api/judge/evaluate` |

**Key Finding**: Only first hook in UserPromptSubmit chain receives stdin. Solution: Merged Layer 1 + Layer 4 into `skill-router-hook.sh`.

**What Claude Now Sees** (on every user message):
```
[LAYER 1] Warning: TESTS FAILED: 16 failed, 438 passed | [SKILL] dev-debugging
```

**Behavioral Change**: When Layer 1 fires, Claude must run tests FIRST before responding.

**Files Created/Modified**:
- `.claude/hooks/skill-router-hook.sh` - Unified Layer 1 + 4 + skill suggestions
- `.claude/hooks/auto-test-after-edit.sh` - Layer 2 (PostToolUse)
- `.claude/hooks/user-prompt-handler.sh` - Backup unified handler
- `.claude/last-test-results.json` - Test results storage
- `dev-maestro/server.js` - Added `/api/judge/evaluate` endpoint

**Progress**:
- [x] Research completed (6 agents)
- [x] Plan documented
- [x] Update CLAUDE.md with protocol
- [x] Create auto-test hook (Layer 2)
- [x] Create unified artifact checker (Layer 1) - merged into skill-router
- [x] Create unified user confirmation (Layer 4) - merged into skill-router
- [x] Register hooks in `.claude/settings.json`
- [x] Judge endpoint in Dev-Maestro (Layer 5)
- [x] Test and verify hooks fire correctly
- [x] Verify behavioral change (Claude runs tests when Layer 1 fires)

---

### ~~BUG-259~~: Canvas Task Layout Changes on Click (DONE - Cannot Reproduce)

**Priority**: P1
**Status**: DONE (2026-01-25) - Cannot Reproduce
**Created**: January 13, 2026

**Bug**: Clicking on a task in the canvas changes its layout/width when it shouldn't.

**Investigation (2026-01-13)**:

- Width stays constant at 280px before and after click
- Only ~2px height change detected (145px to 143px)
- CSS correctly constrains: `width: 280px; min-width: 200px; max-width: 320px`
- `.selected` class only modifies `box-shadow`, not dimensions

**Resolution**: User confirmed cannot reproduce. Closed.

---

*End of January 2026 Archive*
