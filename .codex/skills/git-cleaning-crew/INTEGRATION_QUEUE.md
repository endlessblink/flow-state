# Preserved development integration queue

The active development branch is `main`. The archived refs under
`refs/archive/local-branches/` are preserved source material, not integrated
work. Review and land them in this order; do not merge an archived branch tip
wholesale when its diff contains deletions of files already present on `main`.

## Current ledger

- `integrated`: priority-consistency commits; the focused priority contract
  passed 2/2 tests.
- `integrated`: the non-duplicate board orchestration change; the remaining
  board commits were patch-equivalent after reconciliation and were skipped.
- `integrated`: the isolated updater stale-bridge fix; its focused suite passed
  32/32 tests.
- `integrated`: the subtask description focus-boundary behavior; its focused
  task-edit accessibility suite passed 3/3 tests.
- `integrated`: the unavailable-Supabase settings-write regression; its
  focused database suite passed 28/28 tests.
- `already-present`: the timer break-handoff behavior; the archived commit is
  patch-equivalent to current `main`.
- `already-present`: the reviewed settings and task-edit accessibility commits.
- `pending-review`: the newest canonical-recovery commit conflicted in core
  sync logic and was safely aborted for dedicated conflict review.
- `pending-review`: the recurrence-heavy work-block optimization conflicted in
  current plan and database contract tests; its archived migration remains
  preserved for deliberate extraction.
- `pending`: all other preserved refs below, to be reviewed by individual
  commit and changed-file scope.

## P0 — recovery and correctness

- `codex/sync-diagnostic-1485`
- `release/canonical-recovery-1.4.478`
- `codex/request-hash-recovery`
- `backup/request-hash-recovery-20260721`
- `integrate/request-hash-recovery-current`
- `fix/runtime-contract-tests`
- `fix/supabase-settings-sync-regression`
- `fix/updater-sidecar-readiness`
- `codex/fix-local-api-startup-20260824`

Extract commits individually, check their changed-file scope, and run focused
sync, runtime, updater, and local-API tests after each coherent batch.

## P1 — current product behavior

- `fix/priority-consistency-current`
- `codex/priority-release`
- `codex/board-priority-system`
- `fix/board-filter-sync`
- `codex/merge-board-filter-current-20260826`
- `codex/merge-board-filter-current-20260826-local`
- `codex/timer-break-handoff`
- `fix/task-1962-canonical-lifecycle-route`
- `fix/task-1962-current-main`
- `fix/bug-1968-subtask-description-focus`
- `fix/bug-1983-permanent-delete`
- `fix/canonical-duration-1.4.285`
- `wip/task-1964-martha-email`

Prefer the newest compatible implementation when several refs describe the
same behavior; keep older alternatives archived until the newer one passes.

## P1 — accessibility

- `integrate/a11y-canvas-current-20260827`
- `codex/replay-settings-a11y-20260827`
- `codex/replay-task-edit-a11y-test-20260827`
- `codex/replay-viewcontrols-a11y-20260827`
- `codex/merge-a11y-toggles-20260826`

Land focused code and its matching tests together, then run the relevant
keyboard and screen-reader contract checks.

## P2 — release and delivery

- `fix/release-receipt-20260827`
- `release/canonical-preview-1.4.477`
- `chore/release-1.4.470-20260827`
- `codex/release-1.4.469-20260827`
- `codex/direct-verify-1483-current`
- `codex/priority-current-local`
- `fix/pwa-sync-release`

Release branches are evidence sources until their changes are extracted and
the current Electron and public-release gates pass.

## P2 — canonical assistant and provenance work

- `codex/h3-canonical-receipts-sql`
- `codex/h4-task-lifecycle`
- `codex/h10-structured-breakdown`
- `codex/h11-monitor-provenance`
- `codex/h1-session-ack`
- `codex/flowstate-h0-provenance`
- `codex/hermes-reliability-h0-h3`
- `integrate/h10-canonical-subtasks-current-main`

Integrate only after the current API and database contracts are compared with
the archived commit’s exact parent and changed files.

## P3 — tests, maintenance, and experiments

- `codex/active-task-loading-fix-2`
- `codex/active-task-loading-fix-3`
- `codex/active-task-loading-fix-4`
- `codex/active-task-loading-fix-5`
- `codex/active-task-loading-fix-6`
- `codex/safe-e2e-fixes-20260825`
- `codex/untangled-local-e2e-20260825`
- `codex/untangled-local-concurrent-20260825`
- `codex/untangled-local-build-20260825`
- `codex/untangled-local-electron-20260825`
- `codex/untangled-local-canvas-20260825`
- `codex/untangled-local-tasks-20260825`
- `codex/untangled-local-ai-20260825`
- `codex/untangled-local-docs-20260825`
- `codex/untangled-local-generated-20260825`
- `codex/vps-electron-1456`
- `master`

These are not disposable: classify their individual commits, deduplicate by
patch identity, and integrate only a small coherent change at a time.

## Completion rule

Each queue item ends as `integrated`, `archived`, or `rejected-with-reason`.
The queue is complete only when every preserved ref has one of those states,
`main` is tested and clean, and the archive receipts remain verifiable.
