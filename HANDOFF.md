# HANDOFF — 2026-06-07 13:26 Sunday

You are continuing work in **flow-state** on branch **fix/ai-week-plan-routing**.

## Current task & next step
**Goal: the installed Electron desktop app loads when the user clicks the dock icon (it currently opens BLANK), and build a gate so it can never regress.**

ROOT CAUSE FOUND — it is **NOT a renderer/white-screen bug**. The installed AppImage's **main process crashes on launch**:
```
A JavaScript error occurred in the main process
Error: Cannot find module 'universalify'
Require stack:
 - app.asar/node_modules/electron-updater/node_modules/fs-extra/lib/fs/index.js
 - app.asar/dist-electron/updater.js
 - app.asar/dist-electron/main.cjs
```
`electron-updater`'s nested `fs-extra` can't resolve `universalify` in the packaged asar → main process dies → no window → blank app.

**IN PROGRESS — fail-safe updater fix (electron/updater.ts), ~70% done. FINISH THESE EXACT STEPS:**
1. `electron/updater.ts` — DONE so far: replaced top-level `import { autoUpdater } from 'electron-updater'` with a lazy `loadAutoUpdater()` that `require('electron-updater')` inside try/catch and returns `null` on failure; `registerUpdater()` now does `const autoUpdater = loadAutoUpdater()` and `canUseUpdater = ... && autoUpdater !== null`. Updated guards in `updater:check` and `updater:download` to `if (!canUseUpdater || !autoUpdater)`.
   **STILL TODO in updater.ts:** (a) `updater:install` handler guard → change `if (!canUseUpdater) return true` to `if (!canUseUpdater || !autoUpdater) return true` (TS-narrows the `autoUpdater.quitAndInstall` inside setImmediate). (b) the main-body guard `if (!canUseUpdater) {` (the block that warns + returns before `autoUpdater.autoDownload = false`) → change to `if (!canUseUpdater || !autoUpdater) {` so TS narrows autoUpdater non-null for the rest of the function.
2. `electron/main.ts` line ~194 `registerUpdater()` — wrap in try/catch as defense-in-depth: `try { registerUpdater() } catch (e) { console.error('[main] updater init failed, continuing', e) }`.
3. Run `npm run type-check` (must be 0 errors — the nullable autoUpdater needs all guards above).
4. ROOT-FIX the packaging too (so the updater actually works, not just no-ops): figure out why `universalify` is missing from the asar. Fastest reliable fix: add to `electron-builder.yml` `files:` an explicit include `- node_modules/universalify/**/*` (and if still broken, `- node_modules/fs-extra/**/*`, `- node_modules/jsonfile/**/*`, `- node_modules/graceful-fs/**/*`). Verify with: `npx asar list release/linux-unpacked/resources/app.asar | grep universalify`.
5. `npm run electron:build` → then COPY the new AppImage over `~/.local/bin/FlowState.AppImage` (the dock icon's real target — see dual-install trap below).
6. Verify the user's app loads: `~/.local/bin/FlowState.AppImage --no-sandbox --enable-logging=stderr 2>&1 | grep -iE "error|module"` should show NO "Cannot find module".
7. Add the 4th GATE LAYER so this packaging class is caught forever: in `scripts/verify-build-renders.sh` add (when `--check-file-protocol`) an assertion that the built asar contains electron-updater's fs-extra closure, e.g. `npx asar list dist asar | grep universalify`; OR better, a post-package smoke that launches the packaged Electron with a short timeout and asserts no main-process "Cannot find module". Wire it into `electron:build` + `deploy-electron-update.sh`.

## Files touched / in flight
**TASK-1823 blank-screen gate (NEW, uncommitted — being committed by this dropoff):**
- `tests/smoke/prod-build-render.spec.ts` — render smoke: serves real `dist/` via vite preview, asserts `#fs-loader` detaches (Vue mounted) + no fatal console/pageerror across `/ #/board #/canvas #/calendar`. Auth-free.
- `playwright.smoke.config.ts` — smoke config, NO global-setup, serves built dist.
- `scripts/verify-build-renders.sh` — runner: type-check + build + render smoke (+ `--check-file-protocol` static guard that ELECTRON_BUILD bundle uses relative `./assets/`).
- `package.json` — added `verify:build`, `verify:rendered`, `verify:rendered:electron`; gated `electron:build` with type-check + verify:rendered:electron.
- `.github/workflows/ci.yml`, `deploy.yml` — added type-check + render-smoke gates.
- `scripts/deploy-electron-update.sh` — Step 0 type-check + Step 1b render smoke before packaging/upload.
- `docs/MASTER_PLAN.md` — TASK-1823 entry (DONE, gate built/proven, not yet shipped). Note: referenced `docs/sop/SOP-070-blank-screen-gate.md` is NOT yet written.

**Pre-existing TASK-1821 work (uncommitted, left in tree — separate concern):**
- `src/composables/canvas/useCanvasOperationState.ts`, `useCanvasOrchestrator.ts`, `tests/e2e/canvas-collapse-local.spec.ts` (canvas collapse on Electron).

**Do NOT commit:** `stats.html` (vite build-visualizer artifact, auto-regenerated).

## Key decisions & gotchas
- **The render-smoke gate (TASK-1823) does NOT catch THIS bug.** It tests the renderer bundle; the universalify crash is a MAIN-PROCESS packaging failure. The gate still needs a 4th layer: **launch the actually-packaged Electron app post-build and assert a window loads**, OR statically assert the asar contains electron-updater's full fs-extra closure (`universalify`, `graceful-fs`, `jsonfile`). Add this so packaging regressions are caught.
- **`release/linux-unpacked/resources/app.asar` (an EARLIER build) DOES contain `universalify`** — so packaging *can* include it. The currently-installed `~/.local/bin/FlowState.AppImage` (138MB, built today 13:08) does NOT. Something in a recent build dropped it. Compare a fresh `npm run electron:build` asar vs the broken AppImage.
- **Dual-install trap (memory `project_flowstate_dual_install.md`):** the dock icon runs `~/.local/share/applications/flowstate.desktop` → `~/.local/bin/flowstate` → **`~/.local/bin/FlowState.AppImage`**. The dpkg `/opt/FlowState/` install (and `/usr/share/applications/flowstate.desktop`) is NOT what launches. To fix the user's app you MUST replace `~/.local/bin/FlowState.AppImage` with the freshly built AppImage.
- **electron-builder dependency parser is monkey-patched** (`scripts/patch-electron-builder-dependency-parser.cjs`) for an npm-list JSON-parse bug — unrelated to universalify, but it shows the dep-collection here is fragile.
- **Reproduce the crash:** `~/.local/bin/FlowState.AppImage --no-sandbox --enable-logging=stderr 2>&1 | grep -iE "error|module"`.
- HARD RULE: no live cloud-LLM calls for debugging. App boot doesn't call them; safe.
- Version is 1.4.107 (package.json). Per project rules 6/7, any real fix must bump version + run `deploy-electron-update.sh` to ship to the auto-updater.

## Env / run state
Branch: fix/ai-week-plan-routing | Last commit: e3dd2fea chore: bump to 1.4.107
Running: nothing relevant to this repo (a rough-cut-mvp Electron dev is running, unrelated).
Verified this session: `bash scripts/verify-build-renders.sh` passes end-to-end on current source (type-check 0 errors, prod bundle mounts) — so the RENDERER is fine; the failure is packaging-only.

Start by: open `electron/main.ts` + `electron/updater.ts`, wrap updater require/init in try/catch, then `npm run electron:build` and inspect the new asar for `node_modules/universalify/package.json` before replacing `~/.local/bin/FlowState.AppImage`.
