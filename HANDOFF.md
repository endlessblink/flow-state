# Handoff — 2026-05-25 10:48 Monday

You are continuing work in **flow-state** on branch **fix/self-host-clash-display**.

## Current task & next step
Investigating Hebrew list-view rendering issues in the **Electron** desktop app. RTL alignment
turned out to be a non-bug; the live issue is **blank-title tasks** rendering as empty rows in
the Catalog list. — next: with user approval, **pull the list of blank/whitespace-title tasks
from production Supabase** so they can be reviewed and soft-deleted.

## Files touched / in flight
- This RTL/blank-title session made **NO repo edits** — all probes are in `/tmp/rtl-probe/`
  (standalone Electron RTL probe + Playwright `_electron` inspector). Safe to delete.
- The working tree has **large uncommitted WIP from a prior/parallel session** (NOT authored or
  verified here — being backed up by this dropoff): `src/composables/canvas/*`,
  `src/composables/supabase/useRealtimeSubscription.ts`, `src/composables/sync/useSyncOrchestrator.ts`,
  `src/stores/tasks/taskOperations.ts`, `src/stores/canvas/canvasGroups.ts`,
  `src/components/settings/tabs/AccountSettingsTab.vue`, `electron/main.ts`, `electron/preload.ts`,
  new `electron/ipc/localApi.ts`, new `server/local-api/`, new `src/composables/useLocalApiBridge.ts`,
  new migration `supabase/migrations/20260525000000_add_linked_parent_task_to_groups.sql`.

## Key decisions & gotchas
- **RTL is NOT a code bug.** An Electron probe (`/tmp/rtl-probe/`, Electron 41 / Chromium 134)
  proved the title CSS renders Hebrew RTL correctly; the LTR rows were a **transient paint glitch**
  that clears on reload. The title spans ALREADY carry `direction:rtl !important` +
  `text-align:right !important` (`src/assets/design-tokens.css:1382`) — so adding a `dir` attribute
  (weaker than `!important`) would NOT fix a case where those rules already fail. **Do not change
  the RTL CSS on a one-off glitch.** Isolated combo renders fine in BOTH Chromium and Electron.
- **Empty rows = blank-title tasks** (console logged `🛠️ [TASK-TITLE-REPAIR] Repaired 10 blank
  task title(s)`). This is the **BUG-1799** class: LWW sync resurrects locally-deleted tasks by
  re-adding them with an empty title. DB trigger (BUG-1779) normalizes blanks → "Untitled Task"
  server-side, so seeing *empty* (not "Untitled Task") means they're coming from local IndexedDB
  cache / sync, not a fresh server read.
- **Verify BUG-1799 is actually shipped:** `git log --all --grep BUG-1799` returns **nothing**,
  even though MASTER_PLAN marks it DONE. Confirm the resurrection fix is genuinely in the running
  build before assuming cleanup sticks — otherwise blanks will keep returning.
- **Electron inspection recipe (worked):** single-instance lock (`electron/main.ts:17`) kills a 2nd
  instance on the same userData. To inspect the real app via Playwright `_electron`: copy
  `~/.config/flow-state` → temp dir, delete `Singleton*`/`LOCK`, launch with
  `--user-data-dir=<temp>`. BUT the local `dist/` is a **web** build (absolute `/assets/` paths) →
  fails under `file://` (`ERR_FILE_NOT_FOUND`, Vue never mounts). To load the authenticated app
  headless you need `ELECTRON_BUILD=true npm run build` (relative base) **and** prod Doppler env so
  the Supabase client matches the copied prod session.
- User runs against **production** Supabase (local is backup). Production DB reads/writes need
  explicit approval; prefer soft-delete (`is_deleted=true, deleted_at=now(), updated_at=now()`).

## Env / run state
Branch: fix/self-host-clash-display | Version: 1.4.52 | Last commit: 0d80f539 wip(TASK-1798) dropoff
Running: user's installed Electron app (authenticated, prod data). No dev server needed for this thread.

Start by: ask the user to approve a production read, then list every task with empty/whitespace
title (and whether `is_deleted=false`) for review before soft-deleting; in parallel confirm the
BUG-1799 resurrection fix is present in the running build.
