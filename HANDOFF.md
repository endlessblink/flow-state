# Handoff — 2026-05-25 10:27 Monday

```
You are continuing work in flow-state (FlowState, Vue 3 + Electron) on branch fix/self-host-clash-display.

## Current task & next step
REGRESSION (live, reported by user): after shipping Electron v1.4.52, in the desktop app
(1) Canvas "Tidy" does nothing at all, (2) "Rotate days" also broke, (3) Ctrl+Shift+I no
longer opens DevTools. I was mid-diagnosis when context was cleared.
— next: build + run Electron locally (`npm run electron:preview`) and read the renderer/main
console to find the actual error. DO NOT ship another fix on unit tests alone — I did that
twice this session and both shipped builds were still broken in the real app.

## Files touched / in flight (ALL uncommitted unless noted)
MINE this session (TASK-1798 Canvas Tidy) — committed via this handoff:
- src/composables/canvas/useCanonicalDayGroupLayout.ts  (group height now derived from placed
  task footprint, not a parallel sum — shared by BOTH Tidy and Rotate)
- src/composables/canvas/useTidyLayout.ts  (date-association pull-in for all dated tasks +
  spatial adoption into custom groups + fromHeader stacking)
- tests/unit/canvas/canonical-layout.test.ts, tests/unit/canvas/tidy-layout.test.ts  (124 pass)
- docs/MASTER_PLAN.md (TASK-1798 entry)

OTHER tasks' work also in the tree (NOT mine, left as-is — verify with their owners/sessions):
- BUG-1799 realtime/sync: src/composables/supabase/useRealtimeSubscription.ts,
  src/stores/tasks/taskOperations.ts, src/stores/canvas/canvasGroups.ts,
  src/composables/sync/useSyncOrchestrator.ts
- TASK-1797 local-api sidecar (PRIME SUSPECT for the app-level breakage):
  electron/main.ts, electron/preload.ts, electron/ipc/localApi.ts (NEW, uses
  utilityProcess.fork of dist-electron/local-api-server.cjs), src/composables/useLocalApiBridge.ts (NEW),
  server/local-api/ (NEW), package.json `electron:build-main` now esbuilds the sidecar.
- auth: src/services/auth/supabase.ts, src/stores/auth.ts, src/components/settings/tabs/AccountSettingsTab.vue
- build artifacts (noise): dist-electron/*, stats.html

## Key decisions & gotchas
- Tidy + Rotate share `computeCanonicalLayout` in useCanonicalDayGroupLayout.ts. If BOTH broke,
  suspect a runtime throw there OR the apply path in CanvasView.vue (applyCanonicalLayoutMoves /
  handleTidyLayout / handleRotateDayGroups) — BUT 124 canvas unit tests pass, so the pure
  function doesn't throw in tests. The break is likely app-level, not the math.
- DevTools shortcut dying is the loudest clue: it points to the Electron MAIN process, not my
  canvas code. The local-api sidecar was just wired into electron/main.ts + the build now
  esbuilds local-api-server.cjs. A failing/hanging utilityProcess.fork or a main-process throw
  could explain devtools + canvas both being dead. Check electron/main.ts and electron/ipc/localApi.ts FIRST.
- My v1.4.52 deploy likely did NOT include the esbuild sidecar step (package.json was modified
  AFTER that deploy). So the broken build the user has may differ from a fresh local build —
  confirm which version/build the user is actually running.
- Deploy: `VITE_SITE_URL=https://in-theflow.com VPS_HOST=84.46.253.137 ./scripts/deploy-electron-update.sh --notes "..."`
  package.json is at 1.4.52 (already deployed). Bump to 1.4.53 before the next deploy.
  Updater manifest: https://in-theflow.com/updates/electron/latest-linux.yml
- HARD RULE: never make live cloud LLM/API calls with the user's accounts (see ~/.claude/CLAUDE.md).
- Auto-update needs user to click Download toast + restart; `flowstate` launcher uses
  ~/.local/bin/FlowState.AppImage (see memory project_flowstate_dual_install).

## Env / run state
Branch: fix/self-host-clash-display | Last commit: 6d69eaff fix(fonts): self-host Clash Display (TASK-1791b)
Running: nothing relevant confirmed this session.
Memory: project_canvas_group_height_from_positions (the height-from-positions fix rationale).

Start by: run `npm run electron:preview` (or electron:dev), open the canvas, click Tidy, and
read the console for the actual error — diagnose before changing code.
```
