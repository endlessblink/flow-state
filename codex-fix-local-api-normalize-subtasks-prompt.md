# Codex brief: fix packaged FlowState exact-task reads failing with `normalizeSubtasks is not defined`

Work in:

`/media/endlessblink/data/my-projects/ai-development/productivity/flow-state`

## Objective

Fix the real packaged Electron/Local Task API failure that prevents Hermes from reading one exact FlowState task in full.

A bearer-authenticated request to:

`GET /api/tasks/ab5c14ed-a815-49c7-888a-aa014cc011de`

currently returns HTTP 500 with:

`normalizeSubtasks is not defined`

The failure blocks Hermes task characterization because compact task-list metadata is available, but the exact record’s description, notes/tags, recurrence, subtasks, instances, dependencies, and other planning context cannot be read safely.

This is a live packaged-runtime bug, not merely a request to add a helper to the current working copy.

## Mandatory project workflow

1. Read and follow `AGENTS.md`, `CLAUDE.md`, and `docs/MASTER_PLAN.md`.
2. Use `.claude/skills/superpowers-flowstate-auto-router/SKILL.md`; route this as systematic debugging plus TDD.
3. Treat `docs/MASTER_PLAN.md` as the task source of truth. Add a parser-safe BUG entry using the next valid ID only after checking the file. Preserve the required `### BUG-####` header and Priority/Status/Dependencies format.
4. Do not reset, stash, overwrite, commit, or reformat unrelated user work. The working tree is heavily dirty with existing local changes. Inspect `git status` before and after and keep the fix narrowly scoped.
5. Do not read, print, copy, or expose raw tokens, `.env` values, auth material, Supabase keys, bearer headers, or credential files. Any live probe must operate internally and print only status/redacted output.
6. This is desktop-facing work. Follow the Electron-first release rules: version bump above the running version, Electron build/package, updater deploy, manifest verification, commit, pull/rebase as safely required, and push. Do not stop at a source-only or browser-only fix unless a real external blocker prevents shipping.

## Verified live evidence

Verified on 2026-07-14:

- FlowState Local Task API health is good.
- Running packaged app version: `1.4.255`.
- Mode: token.
- `hasAuthContext: true`.
- Renderer reports authenticated, has user, can sync remotely, and does not require reauth.
- Supabase lookup works and an active timer session is visible.
- `GET /api/tasks`, task search, assistant context, timer diagnostics, and task-instance reads work.
- Exact-task reads fail consistently with HTTP 500 and `normalizeSubtasks is not defined`.
- The failure reproduced multiple times through the Hermes `flowstate_get_task` connector.
- The task ID above is a safe reproduction target. Do not mutate it.

This rules out a generic health, bearer-token, sign-in, renderer↔sidecar auth, or Supabase availability failure. The exact failure class is a packaged sidecar runtime containing an unresolved helper call in the detailed task-read path.

## Packaged-artifact audit already performed

The installed AppImage was extracted safely from:

`/home/endlessblink/.local/bin/FlowState.AppImage`

Its `resources/app.asar` identifies version `1.4.255`.

In the packaged file:

`dist-electron/local-api-server.cjs`

there is exactly one textual occurrence of `normalizeSubtasks`. It is this call inside the detailed exact-task response:

`subtasks: normalizeSubtasks(task.subtasks)`

The packaged bundle contains no `function normalizeSubtasks` definition.

Therefore the `1.4.255` artifact is internally inconsistent: the exact-task handler references a helper that was not included in the artifact.

## Important source/artifact mismatch

The current working copy is not the same source state as the installed package:

- Current working-copy `package.json` says version `1.4.247`.
- Running installed app says `1.4.255`.
- Current `server/local-api/server.cjs` contains a `normalizeSubtasks` definition near the subtask helpers and calls it from detailed task serialization and subtask endpoints.
- Current `dist-electron/local-api-server.cjs` also contains the helper definition.
- The installed `1.4.255` AppImage bundle does not contain the definition.

Do not conclude “already fixed” merely because the current source file contains the helper. Determine which source/branch/integration state produced `1.4.255`, why its packaged bundle retained the call but omitted the definition, and ensure the repaired integrated source produces a correct artifact.

Likely possibilities to test, not assume:

1. `1.4.255` was built from a separate integration branch where the detailed task-read handler was cherry-picked without the helper.
2. A conflict resolution or manual merge retained the call but dropped the helper.
3. The release pipeline packaged a stale or partially rebuilt `dist-electron/local-api-server.cjs`.
4. Existing tests inspect source text only and never execute the packaged detailed-read path, allowing an unresolved runtime identifier to ship.

Rank and falsify these hypotheses using git history, branch ancestry, the actual installed artifact, and deterministic tests.

## Relevant code

Start with:

- `server/local-api/server.cjs`
  - `normalizeSubtasks`
  - `toSafeTask(record, detailed)`
  - `handleGetTask(id, res)`
  - `handleGetSubtasks`
  - exact task and subtask routes
- `tests/unit/local-api/server-contract.test.ts`
  - currently contains mostly source-contract assertions
  - it checks that exact task reads are user-scoped, but it did not catch the runtime missing-helper failure
- `package.json`
  - `electron:build-main` bundles `server/local-api/server.cjs` with esbuild to `dist-electron/local-api-server.cjs`
  - `electron:build` packages the Electron app
- `electron/ipc/localApi.ts`
  - starts the bundled sidecar from `dist-electron/local-api-server.cjs`
- `scripts/validate-electron-package.cjs`
  - validates required packaged entries but apparently not executable detailed task reads
- `scripts/diagnose-live-boundary.cjs`
  - current safe diagnostics pass because they do not probe the exact detailed-task endpoint

Current source detailed response includes fields such as description, status, priority, progress, due date/time, project, tags, subtasks, instances, recurrence metadata, inbox state, Canvas position, timestamps, workspace ID/canonical revision depending on the integrated branch. Preserve the intended safe response contract and user scoping.

## Required diagnosis loop

### 1. Reproduce before editing

Build a deterministic failing test or harness at the real seam. It must execute the detailed exact-task serialization/handler path, not merely search source text.

Preferred options:

- a runtime unit/integration harness that invokes the exact-task handler with a mocked user-scoped Supabase row; or
- a child-process/server harness that exercises `GET /api/tasks/:id` with controlled auth/session and fixture data; or
- another seam that provably executes the same bundled code path and fails with a `ReferenceError` before the fix.

Also retain the safe live reproduction against the installed `1.4.255` app, without printing bearer credentials or task bodies.

### 2. Prove the cause

Inspect git history and artifact provenance. Establish whether this was a partial cherry-pick/merge, stale bundle, release packaging error, or another exact cause. Do not fix only the symptom without explaining how `1.4.255` acquired the unresolved call.

### 3. Write the regression first

The regression must fail against the broken shape and pass after the fix. It should cover at minimum:

- exact detailed task read with `subtasks` absent, `null`, empty, and containing malformed/null entries;
- no unresolved helper reference at runtime;
- user scoping and deleted-task exclusion remain intact;
- safe detailed response contains expected fields and no auth/token/session secrets;
- packaged/bundled `dist-electron/local-api-server.cjs` can execute the detailed serializer/handler path, not only parse via `node --check`.

A source-text assertion that the helper name appears somewhere is insufficient. The broken AppImage had the call and still passed syntax checks.

### 4. Fix the class

Implement the smallest robust fix in the integrated source. Prefer one canonical task/subtask normalizer or a serializer module with explicit import/export over duplicated helpers if that reduces merge fragility. Do not perform unrelated refactors.

Check sibling call paths for the same class of unresolved helper or partial-integration problem:

- detailed exact-task read;
- subtask list/create/update/delete/batch;
- task-instance normalization;
- search/list serializers;
- any bundled-only code path added in the same integration series.

Name exactly which failure mode is fixed and what remains outside scope.

## Verification requirements

Run fresh evidence, not cached claims:

1. Focused red/green regression for the detailed exact-task runtime path.
2. Relevant Local API suites, including at least:
   - `tests/unit/local-api/server-contract.test.ts`
   - subtask contract tests
   - task mutation/reconciliation tests
   - any new runtime/bundle regression test
3. `node --check server/local-api/server.cjs`
4. `npm run type-check`
5. `npm run electron:build-main`
6. Inspect the newly generated `dist-electron/local-api-server.cjs` and prove the detailed task path executes, not merely that the helper text exists.
7. `npm run test`
8. `npm run lint`
9. `npm run electron:build`

If a broad pre-existing failure occurs, distinguish it from regressions introduced by this work and report it precisely. Do not hide failures with `|| true` beyond the project’s existing script behavior.

## Live packaged verification

The fix is not complete until tested in a newly packaged/running app using the real FlowState user-data boundary.

1. Bump the app version above `1.4.255`.
2. Build/package Electron according to project SOP.
3. Install or launch the new package using the real FlowState user data, not a Hermes sandbox profile.
4. Confirm `/api/timer/diagnostics` reports the new app version, auth context present, and renderer remote sync healthy.
5. Re-run a redacted bearer-authenticated `GET /api/tasks/ab5c14ed-a815-49c7-888a-aa014cc011de`.
6. Require HTTP 200 and a safe structured task response containing at least the exact ID, title, description, subtasks array, instances array, and recurrence representation.
7. Run the same probe for a task with no subtasks and, if available, a task with subtasks.
8. Re-run Hermes `flowstate_get_task` and confirm it succeeds end to end.
9. Verify compact list/search, assistant context, timer diagnostics, subtask routes, and task-instance routes still work.
10. Do not mutate production task data for this verification.

## Release and completion

Because this is a desktop-facing fix the user needs in the installed app:

- deploy Electron updater artifacts;
- verify `https://in-theflow.com/updates/electron/latest-linux.yml` points to the new version;
- verify the referenced AppImage/deb artifacts are reachable;
- update the BUG entry in all required `MASTER_PLAN.md` locations;
- commit only the intended fix plus required generated/release metadata;
- preserve unrelated dirty work;
- pull/rebase safely, push, and verify the branch is up to date with origin.

Do not claim success from source code, unit tests, `node --check`, a local bundle, or HTTP health alone. Report these layers separately:

- reproduced;
- source fixed;
- regression passing;
- bundled artifact verified;
- packaged app running;
- exact endpoint live-tested;
- Hermes connector verified;
- updater deployed;
- commit pushed.

## Non-goals

- Do not redesign the whole Local Task API.
- Do not modify real tasks as part of testing.
- Do not change recurrence, merge, Notion activation, timer, or monitor semantics unless a directly related regression is proven.
- Do not clean or rewrite unrelated working-tree changes.
- Do not expose credentials.

## Expected final report

Return:

1. Exact root cause and why existing tests missed it.
2. Files changed.
3. Regression test and its red/green evidence.
4. Focused and full quality-gate results.
5. Built/package version.
6. Live exact-task endpoint status.
7. Hermes `flowstate_get_task` status.
8. Updater manifest/artifact verification.
9. Commit and push status.
10. Any remaining uncovered failure classes.
