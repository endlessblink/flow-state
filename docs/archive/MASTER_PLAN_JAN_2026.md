# FlowState: Archived Tasks - January 2026

> **Source**: Completed tasks archived from `docs/MASTER_PLAN.md`
> **Purpose**: Preserve implementation details for completed work
> **Last Updated**: January 23, 2026

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

*End of January 2026 Archive*
