# Canvas flows investigation — 2026-10-26

Scope: local guest-mode Playwright suite on `fix/canvas-flows-20261026`, based on `origin/main` plus `f4cc3cc8`. No application code, deployment, remote push, or cloud LLM calls.

## Reproduced failure and cause

The unmodified full check failed with 6 passed, 1 failed, and 25 not run. `seedCanvas` expected four root-drag tasks, but the renderer retained only three. The trace puts task creation before the guest initialization load. The helper checked for store instances and a mounted pane; those exist before auth initialization clears the stores and reloads guest-local tasks. That reload can replace the just-seeded array with a partially persisted snapshot. Repeated sync requests cannot reconstruct the missing task.

A regression delays the actual guest startup dependency (`writeQueueDB.ts`) by one second, then calls the real setup helper. Before the fix it fails because both stores' initialization flags are false; after the fix it passes and both seeded tasks survive reload. The helper now waits for both initial-load completion flags before seeding. No timeout was increased and no test was removed.

Other harness defects were exposed during verification:

- The viewport reset passed an object to a positional `(x, y, zoom)` API; the trace logged its rejection. The helper now uses the correct arguments.
- At the default 1280×720 viewport, the planning banner and app chrome leave the root-drag target below the clipped canvas. Raw mouse calls silently miss it. A pointer actionability check reproduced `.view-wrapper` intercepting the pointer, and independent screenshot inspection confirmed clipping. The suite now uses a 1920×1080 desktop viewport and checks node actionability before dragging. The existing drag assertions pass without forcing pointer events.
- The inbox defaults to Today (`0e180fa7a`, September 11), while the drop fixture creates an undated task. The failure snapshot showed one inbox task but zero shown. Setup now explicitly selects All for these geometry fixtures; the inbox drag test then passes.
- The tidy/reload test's pre-reload wait checked finite coordinates and widths that were already true in the seed. It captured untidied positions while the asynchronous tidy was still running, then compared them against the correctly persisted tidy result after reload. It now waits for compact group spacing and restacked task coordinates before taking that snapshot; the targeted reload test passes.

## History checked

Recent canvas history on `origin/main` includes `e79f0862` (explicit hide-completed mode), `07c95eea` (shared task ordering), `22c4f32f` (date rotation), and `051a8aa9` (tidy/rotation geometry). None explains a missing task during fixture creation. Blame traces the guest clear/reload boundary to `b7a7b5ec9` (July 14), guest cache scoping to `1af6fa191` (July 24), and hidden startup geometry to `8d7e371e4` (August 24). This is a readiness/interaction contract defect in the local harness; application startup protections remain intact.

## Verification

Three consecutive complete runs of `npm run test:canvas-flows` passed on the same test/config source: **33/33 (3.1m), 33/33 (2.9m), 33/33 (2.7m)**. The sequential command chain exited 0. Per-test verdicts are preserved in `2026-10-26-canvas-flows-output.txt`.

The delayed-startup regression was demonstrated red before the helper fix and green afterward. The root-drag test was demonstrated failing at the clipped viewport and green after the viewport/actionability corrections.

Full-run progression before final acceptance: baseline 6 passed / 1 failed / 25 not run (lost seed); readiness fix 7 / 1 / 25 (clipped root drag); viewport correction 12 / 1 / 20 (inbox filter); explicit inbox filter 15 / 1 / 17 (premature tidy snapshot). One exploratory run was cancelled to retain the original width assertion alongside the stronger tidy completion check. Its replacement briefly reused the terminating Vite process and failed with `ERR_CONNECTION_REFUSED`; the acceptance sequence starts after that process exited. Neither interrupted run is counted as acceptance evidence.

Quality checks: application type checking passes; syntax lint of both changed test/config files passes with 61 existing warnings and no errors (the repository's typed ESLint project excludes E2E files, so `--parser-options '{"project":null}'` is required for them). Repository-wide `npm run lint:ci` reports 417 errors in unchanged application files; `git diff origin/main -- src` is empty. No unrelated lint fixes are included.

## Coverage boundary

This proves the local guest-mode browser suite at 1920×1080 and local task reload behavior. Smaller-window interaction behavior remains unverified. It does not prove signed-in Supabase convergence, installed Electron behavior, KDE integration, sidecar behavior, or updater delivery. Those surfaces were not changed or released in this task.

Independent read-only review found no concrete correctness issues in the test/config diff and confirmed existing cases/assertions remain intact. The configured project-note helper was unavailable at its documented path; this report and the master-plan entry carry the durable local evidence instead.
