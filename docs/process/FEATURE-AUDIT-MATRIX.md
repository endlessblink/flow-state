# FlowState Feature-Audit Matrix

A living, machine-readable catalog of every user-facing feature/action in
FlowState, each with the surfaces it appears on, the behaviour it must hold,
the states it must hold under, and a pointer to the test evidence that proves
it. This is the artifact to audit reliability against — from moving a card in
Kanban, to marking a task done, to typing a description, to backup/restore.

## Files

- **`feature-audit-matrix.json`** — the catalog. **100 features across 24
  areas**: Task lifecycle, Board/Kanban, Calendar, Canvas, Mini Canvas,
  Timer/Focus, Quick Sort, Recurrence, Lanes, Backup/Restore, Sync/Offline,
  Inbox/Catalog, AI assistant, Local Task API/KDE, Auth, Projects,
  Notifications/Reminders, Workspace collaboration, Settings/Preferences,
  Canvas selection/viewport/images, AI chat conversations, Gamification,
  Navigation/UI/search, Onboarding/capture. Derived from the real codebase
  (routes, all Pinia store actions, component handlers) — never invent features
  that do not exist. Current coverage: 62 audited / 22 partial / 16 unaudited.
- **`../../scripts/audit-feature-matrix.cjs`** — the auditor.

## Audit it

```bash
npm run audit:features
```

The auditor:

1. validates structure (every feature has id / action / surfaces / expected /
   states / status),
2. **verifies every `evidence` file path actually exists** — so an "audited"
   claim can never silently rot into a lie when a test is renamed or deleted
   (this caught 4 wrong pointers on its first run),
3. reports coverage (audited / partial / unaudited) overall and per area,
4. exits non-zero on any structural error or missing evidence file.

## Status legend

- `audited` — an automated test asserts this feature's behaviour.
- `partial` — some facets covered; the row lists the named `gaps`.
- `unaudited` — no direct evidence yet; a candidate for the next regression.

## How to extend

When a feature ships (or a gap is found), add a row to the relevant area in
`feature-audit-matrix.json` with a real `evidence` pointer and run
`npm run audit:features`. Keep it honest: mark `partial`/`unaudited` truthfully
and list the gaps rather than over-claiming `audited`.

## Relationship to the failure-scenario ledger

`flowstate-failure-scenario-audit-ledger.md` tracks the 115-vector **failure**
matrix (ways things break under adverse states). This feature matrix tracks the
**features** themselves (what the app does) and their evidence. They are
complementary: features here reference the vectors/tests that harden them.

## Known open items (as of 2026-07-25)

- `board.move-between-status-columns` — webkit drop intermittently does not
  register (open product defect).
- `canvas.create-group` / `sync.realtime` — a newly-created canvas group does
  not propagate live to other clients (open product defect, R7).
- `board.reorder-within-column` — currently `unaudited`.
- The 5 team-workspace shared-restore vectors remain deferred (need a live
  multi-member workspace harness).

## The 16 unaudited actions (next regressions to write)

Surfaced by the matrix as having NO direct test yet — the honest to-do list:
project rename/icon, project color, project Kanban view-type; notification
snooze/dismiss, notification preferences; auto-start pomodoros/breaks setting;
language/RTL-direction setting; Electron auto-update toggle; canvas hotkeys
(delete/group/select); AI-chat conversation CRUD; AI panel open/close +
language; gamification shop (spend XP) and challenges; brain-dump quick capture;
first-run onboarding. Run `npm run audit:features` to see the live list as it
shrinks.
