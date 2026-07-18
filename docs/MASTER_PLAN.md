# FlowState MASTER_PLAN.md

## 🔁 Restart Cursor — Android Gemma Voice E2E WIP (2026-06-23)

**Task**: TASK-1883 remains IN PROGRESS. Do not mark complete until Android Gemma is proven on device with a readable Gemma 3n `.task`/`.litertlm` model, real microphone capture, native MediaPipe inference, and a transcript returned without `whisper-transcribe`.

**Current WIP commit context**: The interrupted run converted the placeholder Android Gemma route into a real implementation attempt: added `com.google.mediapipe:tasks-genai:0.10.27`, rewrote `AndroidGemmaTranscriptionPlugin` to persist/import a FlowState-owned model path, validate WAV audio, expose `setModelPath`, and call MediaPipe LLM inference; added a browser WAV recorder so Gemma gets mono 16 kHz WAV while Whisper keeps MediaRecorder; default non-mobile transcription now stays on Whisper unless a caller explicitly selects `auto`; the mobile voice pill now shows Auto/Whisper/Gemma instead of a generic AI badge; settings gained an Android Gemma model-path field.

**Verified before save**: RED/green `npm run test -- tests/unit/voice/transcription-provider.test.ts` now passes 4/4 and proves default callers do not silently probe Android Gemma. `npm run type-check` passes.

**Blocked proof**: Android build/device proof is not complete. A local JDK was found at `/home/endlessblink/.antigravity/extensions/redhat.java-1.54.0-linux-x64/jre/21.0.10-linux-x86_64`, but `JAVA_HOME=... ./gradlew assembleDebug` is blocked by missing Android SDK configuration: no `ANDROID_HOME` and no `android/local.properties` `sdk.dir`. No `adb`/`sdkmanager` was found in the searched local paths. Resume by installing or locating Android SDK, setting `ANDROID_HOME` or `android/local.properties`, then compile to catch any exact MediaPipe audio API mismatches. After compile, install/run on the Android device, set/import a FlowState-readable model path, select Android Gemma/local or Auto, and confirm the native route returns a transcript without Whisper.

**Research anchor**: Use official Google/MediaPipe sources only for the next patch. The Android LLM Inference docs say `tasks-genai:0.10.27` is the dependency, models should be hosted/downloaded/imported rather than bundled, and Gemma 3n audio input requires mono WAV via MediaPipe LLM Inference. The official `google-ai-edge/gallery` repo exists at `google-ai-edge/gallery`; inspect its Android model manager and LLM helper code before changing native API calls further.

## 🔜 Next Up — AI Co-Pilot Product Lanes (start here after restart)

**Goal**: Evolve FlowState AI from a helpful chat panel into a safe, layered, observable productivity co-pilot across tasks, lanes, calendar, canvas, focus sessions, and long-term memory.

**Research context (2026-06-13)**:
- The useful 2026 pattern is agentic autonomy with long-term memory, proactive intelligence, and human-in-the-loop control, not just better chat prose.
- Relevant product references include Motion-style auto-scheduling/replanning, Reclaim-style focus and habit defense, Notion AI workspace agents, Sunsama planning rituals, and emerging persistent-memory agent systems.
- FlowState's differentiator is the combination of spatial canvas, task/lane/project state, calendar/focus context, and personal memory. The roadmap should exploit that full surface.
- Safety is not a later polish step. All write-capable AI features must use preview, explicit apply, undo/rollback, audit logs, confidence/uncertainty display, and scoped commands.

**Execution order**:

| Order | Lane | Task | Depends on | Outcome |
| --- | --- | --- | --- | --- |
| 1 | Safety and command substrate | TASK-1855 | TASK-1854 | Bot actions become previewable, idempotent, duplicate-aware, auditable, and undoable instead of direct hidden mutations. |
| 2 | AI command center | TASK-1856 | TASK-1855 | The chat/sidebar becomes an action surface with suggestions, diffs, apply/edit/reject, and visible agent progress. |
| 3 | Intake and organization | TASK-1857 | TASK-1856 | Messy captures, inbox tasks, and canvas notes can be clustered, deduped, decomposed, and turned into tasks/lanes. |
| 4 | Daily/weekly planning agent | TASK-1858 | TASK-1856, TASK-1857 | Bot proposes day/week plans using tasks, lanes, calendar, focus capacity, memory, and goals. |
| 5 | Next-best-action engine | TASK-1859 | TASK-1858 | "What should I do now?" becomes context-aware and personalized instead of a static priority list. |
| 6 | Calendar and focus defense | TASK-1860 | TASK-1858, TASK-1859 | Bot protects focus blocks, detects overcommitment, and proposes reschedules without silent calendar changes. |
| 7 | Canvas intelligence | TASK-1861 | TASK-1857, TASK-1858 | Bot can organize selected canvas regions spatially and explain visual grouping decisions. |
| 8 | Review and risk radar | TASK-1862 | TASK-1858, TASK-1859 | Bot detects blockers, neglected goals, overload, slipping work, and end-of-day/week learning. |
| 9 | Memory and personalization | TASK-1863 | TASK-1855, TASK-1862 | Bot learns preferences, chronotype, recurring traps, accepted/rejected advice, and project patterns. |
| 10 | User-defined automations | TASK-1864 | TASK-1855, TASK-1860, TASK-1863 | User can create safe recurring agents/workflows with autonomy levels and circuit breakers. |

**Non-negotiable constraints across all lanes**:
- AI proposes/enables; the user owns decisions.
- No non-trivial writes without preview + explicit apply until the command substrate proves low-risk auto-apply policies.
- Every applied AI change must be reversible and traceable.
- Manual task/project/lane/calendar/canvas flows must keep working without AI.
- Each lane needs regression coverage for the selected behavior and a real localhost/browser proof before Electron release.

### ~~TASK-1930~~: Local API sidecar startup diagnostics and live-boundary process detection (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-08) — added redacted Electron-main sidecar lifecycle diagnostics and fixed packaged-process detection for the live boundary probe. | **Depends on**: TASK-1797, TASK-1927, TASK-1928

**Why**: Hermes reported the Local Task API toggle enabled while `127.0.0.1:5577` refused connections and no sidecar process appeared. The existing Electron bridge only set `listening` after a sidecar message and did not expose enough non-secret failure state to tell whether `utilityProcess.fork()` was skipped, threw, spawned then exited, or never found the packaged sidecar. The live-boundary script could also misclassify the lowercase packaged `flowstate` process as not running.

**Acceptance**:
- Electron main records non-secret Local API sidecar lifecycle state for set-enabled, start attempt, resolved sidecar path existence, child pid, spawn, message, error, and exit.
- `localApi:status` exposes only safe diagnostics: no bearer token, Supabase keys, JWTs, auth headers, refresh tokens, sessions, or request bodies.
- Live-boundary diagnostics count the packaged lowercase `flowstate` process so a running Electron app is not skipped incorrectly.
- Regression tests cover sidecar diagnostics fields and packaged-process detection.
- Fresh Electron package still contains `/dist-electron/local-api-server.cjs`, and the real local AppImage can bind `127.0.0.1:5577`.

**Implementation**: `electron/ipc/localApi.ts` now tracks and logs safe lifecycle events around `localApi:setEnabled` and `utilityProcess.fork()`, including last start timestamp, sidecar path, path existence, child pid, last child message type, child error, and child exit marker. `electron/preload.ts` exposes the expanded safe status type. `scripts/diagnose-live-boundary.cjs` now recognizes `/flowstate` packaged processes without counting `flowstate-local-api` as the main app.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Toggle enabled plus `127.0.0.1:5577` refusing connections and no visible sidecar process. | Yes, diagnostics and live proof |
| Data shape / persisted row shape | N/A | No task rows or production data mutated. | N/A |
| Renderer store/state | Partial | Preload status type updated; settings continues to consume existing `enabled/running/port` fields. | Safe status extension only |
| Electron main/preload bridge | Yes | `localApi:status` now exposes safe startup failure fields and child lifecycle state. | Yes |
| Localhost sidecar endpoint | Yes | Fresh local AppImage logged startup and `curl http://127.0.0.1:5577/api/health` returned `{"ok":true}`. | Yes |
| KDE polling/control path | Partial | Same localhost sidecar boundary now has better diagnostics; KDE code unchanged. | Boundary only |
| Supabase persistence/realtime | N/A | No Supabase writes or task mutations performed. | N/A |
| Updater/runtime version | Partial | Local AppImage package rebuilt; public updater deploy not part of this fix. | Local install only |
| Stale live process/cache state | Yes | Freshly launched local AppImage bound `127.0.0.1:5577`; existing stale/closed process state is now distinguishable. | Yes |

**Exact failure mode fixed**: Local API sidecar startup could fail silently from the user's point of view, and live diagnostics could incorrectly skip a running packaged `flowstate` process.

**Explicitly not covered**: public updater deploy, local Supabase/Kong argv secret cleanup, Hermes MCP, task mutations, or rewriting the KDE widget watchdog.

**Regression added for reported repro**: `tests/unit/electron/local-api-lifecycle.test.ts` now requires sidecar lifecycle diagnostics in status and child spawn/error/exit/message handling. `tests/unit/scripts/live-boundary-diagnostics.test.ts` now covers lowercase packaged `flowstate` process detection.

**Live boundary proof**: After launching `/home/endlessblink/.local/bin/FlowState.AppImage --no-sandbox --class=flow-state`, Electron logged the Local API startup, `curl -sS http://127.0.0.1:5577/api/health` returned `{"ok":true}`, and escalated `ss -ltnp` showed `127.0.0.1:5577` listening under `flowstate`.

**Tests**: RED first failed in `npm test -- tests/unit/electron/local-api-lifecycle.test.ts tests/unit/scripts/live-boundary-diagnostics.test.ts` because status lacked sidecar failure fields and child event diagnostics. Green proof: `npm test -- tests/unit/electron/local-api-lifecycle.test.ts tests/unit/scripts/live-boundary-diagnostics.test.ts`; `npm test -- tests/unit/local-api/server-contract.test.ts`; `node --check server/local-api/server.cjs`; `npm run type-check`; `npm run electron:build-main`; `node scripts/validate-electron-package.cjs`; `npm run electron:build`. Installed `release/FlowState-1.4.239-x86_64.AppImage` to `/home/endlessblink/.local/bin/FlowState.AppImage` and relaunched it. Live sidecar proof passed: health `200`, `127.0.0.1:5577` listening under `flowstate`, assistant context endpoint available. Separate remaining watchdog signal: `node scripts/diagnose-live-boundary.cjs` now correctly detects the running app but fails `missing-renderer-timer-snapshot`, which belongs to the KDE/timer heartbeat failure class rather than the Local API listener startup failure.

### ~~TASK-1931~~: Refresh inactive timer snapshot for KDE/local watchdog (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-08) — fixed the live-boundary `missing-renderer-timer-snapshot`, stale inactive snapshot, and stale renderer auth heartbeat failures when FlowState launches with no active timer. | **Depends on**: TASK-1927, TASK-1930

**Why**: After the Local API listener was fixed, `node scripts/diagnose-live-boundary.cjs` correctly saw the running Electron app but failed `missing-renderer-timer-snapshot`, then `stale-inactive-timer-snapshot` after the initial snapshot fix, then `stale-renderer-auth-heartbeat` after a longer live wait. The sidecar had auth and was listening, but diagnostics could not distinguish "renderer is inactive" from "renderer never published timer state" because the timer store only watched future `currentSession` changes. Vue watchers do not fire for the initial `null` value unless `immediate` is set, and the sidecar treats inactive/auth snapshots older than their grace windows as stale.

**Acceptance**:
- FlowState renderer publishes an initial inactive Local API timer snapshot on timer store creation.
- FlowState renderer refreshes inactive snapshots before the sidecar stale cutoff while no timer is active.
- FlowState renderer refreshes safe renderer auth-state heartbeat before the watchdog stale cutoff.
- Sidecar diagnostics report `hasLocalTimerSnapshot: true` even when no timer is active.
- KDE/local watchdog no longer fails `missing-renderer-timer-snapshot`, `stale-inactive-timer-snapshot`, or `stale-renderer-auth-heartbeat` on a healthy signed-in idle launch.
- No production task/timer rows are mutated by verification.

**Implementation**: `src/stores/timer.ts` now makes the `currentSession` Local API bridge watcher immediate, so startup publishes `syncLocalApiTimerSnapshot(null, deviceId)` before any active timer exists. It also refreshes the inactive snapshot every 10 seconds while no local timer session is active, keeping the sidecar snapshot fresh without touching persisted task/timer data. `src/stores/auth.ts` now republishes the already-sanitized renderer auth-state booleans every 30 seconds so the watchdog has a fresh auth heartbeat without forwarding credentials.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Live boundary diagnostic failed `missing-renderer-timer-snapshot` after listener fix. | Yes |
| Data shape / persisted row shape | N/A | No persisted task or timer rows changed. | N/A |
| Renderer store/state | Yes | Timer store now publishes initial inactive snapshot from `currentSession = null` and refreshes it while idle. | Yes |
| Electron main/preload bridge | Yes | Existing `setLocalApiTimerSnapshot` bridge receives inactive snapshot. | Existing bridge |
| Localhost sidecar endpoint | Yes | Sidecar diagnostics consumes the renderer timer/auth snapshots and reports presence/age. | Yes |
| KDE polling/control path | Yes | KDE-local timer boundary now has renderer-owned inactive timer and auth heartbeats on idle launch and during idle runtime. | Yes |
| Supabase persistence/realtime | N/A | Fix is renderer-to-sidecar heartbeat only. | N/A |
| Updater/runtime version | Partial | Local Electron package rebuild/install required for live app proof. | Local install only |
| Stale live process/cache state | Yes | Live verification requires relaunching updated AppImage. | Yes |

**Exact failure mode fixed**: idle Electron launches never sent any Local API timer snapshot because the watcher did not run for the initial `null` session; inactive snapshots could age past the sidecar stale cutoff without a renderer heartbeat; and renderer auth status could age past the diagnostic stale cutoff while the user stayed signed in.

**Explicitly not covered**: stuck-at-zero timer countdown bugs, Supabase active-row cleanup, public updater deploy, or KDE widget UI rendering.

**Regression added for reported repro**: `tests/unit/stores/timer-state-machine.test.ts` now asserts timer store creation publishes an initial inactive Electron/KDE snapshot and refreshes it after 10 seconds of idle runtime. `tests/unit/stores/auth-flow.test.ts` asserts renderer auth-state heartbeat refreshes after 30 seconds.

**Tests**: RED first failed in `npm test -- tests/unit/stores/timer-state-machine.test.ts` because `syncLocalApiTimerSnapshot(null, deviceId)` was never called on store creation. Green proof: `npm test -- tests/unit/stores/auth-flow.test.ts tests/unit/stores/timer-state-machine.test.ts`; `npm test -- tests/unit/stores/timer-state-machine.test.ts tests/unit/stores/auth-flow.test.ts tests/unit/local-api/renderer-bridge.test.ts tests/unit/scripts/live-boundary-diagnostics.test.ts tests/unit/kde/timer-sync.test.ts tests/unit/composables/useLocalApiBridge.test.ts`; `npm run type-check`; `npm run electron:build`. Installed rebuilt `release/FlowState-1.4.239-x86_64.AppImage` locally and verified `node scripts/diagnose-live-boundary.cjs` no longer reports missing/stale renderer timer/auth heartbeat failures.

### ~~TASK-1929~~: Local API task-instance scheduling for Hermes time blocking (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-08) — added bearer-protected preview/apply Local API task-instance endpoints for Hermes time blocking. | **Depends on**: TASK-1928, TASK-1797

**Why**: Hermes should act as the chat controller for lightweight scheduling questions, but FlowState must remain the renderer/source of truth for actual time blocks. The Local API can currently read/update simple task fields, but it cannot preview or create calendar task instances with `scheduledDate`, `scheduledTime`, and `duration`.

**Acceptance**:
- Local Task API exposes bearer-protected `GET /api/tasks/:id/instances` and `POST /api/tasks/:id/instances`.
- `POST` validates task ownership, non-deleted state, `scheduledDate`, `scheduledTime`, `duration`, and `preview`.
- `preview=true` returns the exact proposed instance and task identity without mutating.
- `preview=false` appends a real `instances[]` time block in the same persisted shape used by FlowState calendar surfaces.
- Endpoint never changes task status/title/priority/due date, never deletes tasks, and never exposes secrets/session tokens/auth headers.
- Contract tests cover bearer-boundary placement, `.eq('user_id', userId)`, preview non-mutation, apply mutation shape, cross-user 404, validation failures, and safe response fields.

**Implementation**: `GET /api/tasks/:id/instances` returns only task id/title and that task's `instances[]`. `POST /api/tasks/:id/instances` validates `scheduledDate`, `scheduledTime`, `duration`, and optional `preview`; defaults to non-mutating preview mode; and only appends one `{ id, scheduledDate, scheduledTime, duration }` instance to `tasks.instances` when `preview:false`.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Hermes prompt requires chat-controlled preview/apply for FlowState-rendered time blocks. | Yes, API primitive only |
| Data shape / persisted row shape | Yes | Existing app uses `tasks.instances[]`; `src/stores/__tests__/tasks.test.ts` and AI calendar scheduling tests passed. | Yes |
| Renderer store/state | Partial | No renderer code changed; existing calendar/store tests passed. | Existing renderer consumes instances |
| Electron main/preload bridge | N/A | Local API sidecar route only; no preload/main bridge change required. | N/A |
| Localhost sidecar endpoint | Yes | `server/local-api/server.cjs` exposes bearer-protected GET/POST instance routes. | Yes |
| KDE polling/control path | N/A | This is calendar scheduling, not KDE timer control. | N/A |
| Supabase persistence/realtime | Partial | Endpoint updates `tasks.instances` and `updated_at`; live mutation intentionally not run against real tasks. | Code path only |
| Updater/runtime version | Partial | `npm run electron:build` passed and local AppImage was replaced; updater deploy intentionally skipped. | Local build only |
| Stale live process/cache state | Partial | Safe live/config probe found FlowState closed; no endpoint mutation attempted. | Not a live mutation proof |

**Exact failure mode fixed**: Hermes had no bearer-protected Local API primitive to preview and apply a FlowState calendar task instance for an approved time block.

**Explicitly not covered**: full day planner, MCP, automatic scheduling decisions, overwrite/reschedule endpoints, deleting instances, task completion/status changes, and live apply against a real production task.

**Regression added for reported repro**: Local API contract tests cover route placement behind bearer auth, user scoping, preview non-mutation, append-only apply shape, validation failures, cross-user 404 behavior, and safe response fields.

**Live boundary proof**: `node scripts/diagnose-live-boundary.cjs` read only safe local config/status fields and skipped endpoint execution because FlowState was closed; no real task mutation was performed.

**Tests**: RED first failed because the route and handlers did not exist. Green proof: `npm test -- tests/unit/local-api/server-contract.test.ts` 20/20; `npm test -- tests/unit/local-api/server-contract.test.ts tests/unit/ai-action-command-substrate.test.ts tests/unit/ai-tools-execution.test.ts` 58/58; `npm test -- src/stores/__tests__/tasks.test.ts` 45/45; `node --check server/local-api/server.cjs`; `npm run type-check`; `npm run electron:build-main`; `npm run electron:build`. Safe live/config probe skipped mutation because FlowState was closed; config existed, enabled=true, port=5577, token present length 48, with no token printed.

### TASK-1928: Local API assistant context endpoint for Hermes personal assistant (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-08) | **Depends on**: TASK-1858, TASK-1859, TASK-1863, TASK-1797

**Why**: Hermes can already read FlowState tasks and timer state through the app-mediated Local Task API, but the personal-assistant workflow needs richer read-only context without dumping raw tables: task pressure, focus/session signals, AI memory/clarification signals, gamification/usage summaries, and project activity. This should let Hermes reason about overload and the next useful block while keeping writes preview-gated.

**Acceptance**:
- Local Task API exposes a bearer-protected `GET /api/assistant/context` endpoint.
- Endpoint is read-only, RLS/user-scoped, loopback-only, and uses the existing app-mediated Local API auth boundary.
- Response summarizes task pressure, project signals, focus/timer history, gamification, AI memory/context counts, and recent AI usage without returning raw secrets or full conversation/task dumps.
- Missing optional tables fail soft with `available: false` / zero counts rather than breaking the endpoint.
- Contract tests cover route placement behind bearer auth, user scoping, safe table selection, and no secret/session fields in the assistant context payload.

**2026-07-08 update**: Endpoint implementation, docs, and contract tests are in place. Verified `npm test -- tests/unit/local-api/server-contract.test.ts` (15/15), `node --check server/local-api/server.cjs`, `npm run electron:build-main`, `npm run type-check`, `npm run guard:electron-sync` (182/182), full `npm run test` (3166 passed, 6 skipped), and `npm run electron:build` through the no-upload release script. Built and locally installed FlowState Electron `1.4.238`; `release/latest-linux.yml` is `version: 1.4.238`, and the bundled sidecar contains `/api/assistant/context`, `taskPressure`, and `assistantMemory`. VPS updater upload was blocked by the approval layer, so public updater delivery is not complete. Remaining proof: launch the updated installed app from `/home/endlessblink/.local/bin/FlowState.AppImage`, confirm port 5577 is listening from `/home/endlessblink/.config/flow-state`, and rerun the redacted bearer probe for `GET /api/assistant/context`.

### ~~TASK-1927~~: Daily FlowState regression hunt loop (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-07) — added a non-mutating daily/weekly regression runner, report summaries, npm entry points, and an optional user-level systemd timer installer. | **Depends on**: BUG-1920, BUG-1921, BUG-1923, BUG-1924, BUG-1925, BUG-1926

**Why**: the same failure classes kept recurring after fixes: auth/update grace surfacing false sync errors, canvas tasks/groups disappearing after view changes or sign-in, permanent delete silently doing nothing on some surfaces, KDE/local timer state sticking at zero or resetting, duplicate realtime warnings, and updater/runtime boundary drift. The project needs a daily loop that hunts these classes proactively instead of waiting for screenshots.

**Fix**: `scripts/daily-regression-hunt.cjs` now orchestrates a bounded regression pack and writes JSON/Markdown reports under ignored `reports/regression-hunt/`. The default daily pack checks git dirty state, `guard:electron-sync`, typecheck, a focused recurring unit pack, the Electron/KDE timer boundary diagnostic, the live desktop auth/KDE timer boundary diagnostic, the live Electron updater manifest, and one rotating heavier user-flow suite. `--mode weekly` runs the broader rotating set; `--only` targets one boundary; `--dry-run` proves the plan without executing commands; `--latest` prints the newest report; `--notify` sends a critical desktop notification on failed runs with the failed check, likely failure class, and report path. `scripts/install-daily-regression-hunt.sh` installs a user systemd timer for 09:30 Asia/Jerusalem with notifications enabled.

**Failure-class coverage**:

| Class | Daily check |
| --- | --- |
| Auth/sync and update grace | `npm run guard:electron-sync`, focused sync/auth tests, zero-error Sync Errors popover watchdog |
| Supabase/realtime warning regressions | guard pack + classifier on failed output |
| Canvas data/state | focused canvas composable test + Monday/Thursday canvas flows |
| Permanent delete/undo | focused undo entrypoint test + Wednesday task flows |
| KDE/local sidecar | `node scripts/diagnose-timer-boundary.cjs`, `node scripts/diagnose-live-boundary.cjs` + Tuesday/Friday timer flows |
| Electron updater/runtime | live `latest-linux.yml` probe |
| Stale process/cache | git/process boundary output and timer diagnostic snippets |

**Explicitly not covered**: the runner does not mutate production data, clear sync queues, commit, deploy, update snapshots, or auto-install itself. It reports likely failure class, failed command, output snippet, and next repro command so a fix lane can start with evidence.

**Tests**: RED first failed in `npm test -- tests/unit/scripts/daily-regression-hunt.test.ts` because `scripts/daily-regression-hunt.cjs` and the npm scripts did not exist. Follow-up RED failed because `--notify` and installer notification wiring did not exist. Green proof: `npm test -- tests/unit/scripts/daily-regression-hunt.test.ts`; `npm run regression:daily -- --dry-run --date 2026-07-06 --report-dir /tmp/flowstate-regression-hunt-smoke --json`; `npm run regression:daily -- --dry-run --notify --date 2026-07-06 --report-dir /tmp/flowstate-regression-hunt-notify-smoke --json`; `npm run regression:report -- --report-dir /tmp/flowstate-regression-hunt-smoke`; `npm test -- tests/unit/sync/sync-orchestrator.test.ts tests/unit/stores/auth-flow.test.ts tests/unit/canvas/canvas-composables.test.ts tests/unit/undo-entrypoint-contract.test.ts tests/unit/kde/timer-sync.test.ts`; `npm run guard:electron-sync`; `npm run type-check`; `npm run lint`; `npm run electron:build`. 2026-07-08 watchdog hardening added `tests/unit/sync/sync-status-popover.test.ts` to the focused recurring pack so `0 errors` plus stale sign-in-expired UI cannot regress silently. 2026-07-08 live-boundary hardening added a non-secret renderer auth heartbeat and `scripts/diagnose-live-boundary.cjs`; the daily watchdog now fails when the app is running but renderer auth disagrees with sidecar auth, the renderer timer snapshot is missing, or the timer heartbeat is stale. 2026-07-09 rotation hardening retargeted stale canvas/timer flow scripts from deleted user-flow specs to maintained Playwright packs and added a package-script existence guard; proof: RED then green `npm test -- tests/unit/scripts/daily-regression-hunt.test.ts`, `npm run test:canvas-flows` 16/16, `npm run test:timer-flows` 7/7, Tuesday/Thursday dry-run rotations, `npm run type-check`, `npm run guard:electron-sync`, and `npm run electron:build`. Live updater manifest probe passed outside sandbox DNS and served `version: 1.4.236`. Activation proof: `bash scripts/install-daily-regression-hunt.sh`; `systemctl --user status flowstate-daily-regression-hunt.timer --no-pager` showed `active (waiting)` and next trigger `Wed 2026-07-08 09:30:00 IDT`.

**2026-07-14 clean-runner follow-up**: ~~**BUG-1946**~~ makes the installed timer fetch and test a dedicated detached `origin/master` worktree while keeping reports and notifications in the primary checkout. This prevents stale or uncommitted development changes from being reported as released-code regressions without hiding real master failures.

### ~~TASK-1882~~: Add Android Gemma transcription provider contract and safe Whisper fallback (DONE)

**Priority**: P1 | **Status**: DONE (2026-06-23) — provider abstraction, Android bridge stub, settings selector, fallback tests, typecheck, and PWA build verified. | **Depends on**: TASK-1131

**Why**: `gemma-3n-e4b-it` was downloaded through Google AI Edge Gallery on Android, but Edge Gallery is a separate app/sample UI and does not expose its private model runtime to the FlowState PWA. FlowState needs its own Android-native transcription bridge before it can reliably use local Gemma.

**Fix**: Added a transcription provider layer with `auto`, `whisper-cloud`, and `android-gemma-local`. Mobile voice capture and queued offline audio now go through the shared provider service. Android has a registered Capacitor plugin contract for Gemma status/import/transcribe and explicit microphone permission; until native MediaPipe/Gemma inference is bundled, local-only mode fails clearly and `auto` falls back to Whisper.

**Tests**: `npm run test -- tests/unit/voice/transcription-provider.test.ts` passed; `npm run type-check` passed; `npm run build` passed and generated the PWA service worker precache. Android compile is environment-blocked in this shell because no JDK is installed or on `PATH` (`JAVA_HOME` unset, no `java` command).

### TASK-1883: Bundle real Android MediaPipe/Gemma inference for local voice transcription

**Priority**: P1 | **Status**: PLANNED (filed 2026-06-23) | **Depends on**: TASK-1882

**Why**: TASK-1882 makes FlowState choose and call an Android Gemma provider safely, but the native plugin intentionally does not claim local transcription works until FlowState owns a model import/copy path and bundles the MediaPipe/Gemma runtime. Edge Gallery private app storage must not be treated as FlowState-readable.

**Acceptance**:
- FlowState Android can import or bundle a Gemma 3n-compatible model into app-accessible storage.
- `AndroidGemmaTranscriptionPlugin.getStatus()` returns available only when the runtime and model are loaded.
- `transcribe()` returns a real Hebrew/English transcript without calling `whisper-transcribe`.
- `auto` still falls back to Whisper on model/runtime failure, while `android-gemma-local` reports a clear local-only error.
- Android build proof runs with a configured JDK.

### BUG-1885: Cloud Whisper forces Hebrew, mangling mixed Hebrew/English dictation (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-23) | **Depends on**: TASK-1882

**Why**: User dictates voice tasks in mixed Hebrew + English. `whisperCloud.ts` hardcoded `language: 'he'` and always injected an all-Hebrew prompt, so English speech came back as Hebrew-script gibberish ("failed horribly"). Root cause is purely client-side — the Supabase edge function only forwards `language`/`prompt` when present.

**Fix**: Default cloud Whisper to language auto-detect (omit `language` unless explicitly set) and drop the forced Hebrew prompt for auto mode via an optional `language?: 'auto' | 'he' | 'en'` on `WhisperCloudOptions`. Add regression coverage that auto mode sends no `language=he` / no forced Hebrew prompt, and explicit `he`/`en` still sets it.

**Acceptance**:
- `auto` (default) transcription request sends no `language` field and no Hebrew-only prompt.
- Explicit `he`/`en` selection still forwards the language.
- Mixed Hebrew/English voice capture no longer transliterates English into Hebrew script (user-verified real capture).

### ~~BUG-1920~~: Sign-in can hide cached canvas tasks/groups and KDE misses break prompt after Electron completion (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-05) — restored cache-backed tasks/groups during authenticated reload, fixed KDE local-inactive completion fallback, added stale active-zero Local API fallback, and shipped Electron updater `1.4.232`. | **Depends on**: BUG-1891, BUG-1893, BUG-1896, BUG-1919

**User evidence**: after signing in, many tasks and groups disappeared from the canvas, and the KDE widget got stuck/returned to ready while Electron showed `Session Complete! Great work! Time for a break.` KDE did not offer the break transition.

**Root cause**: authenticated reload treated server absence too aggressively: task smart-merge only preserved cache-backed tasks that already existed in memory, and canvas group load used plain cache data instead of pending-write-aware recovery candidates. Separately, KDE treated a Local API `{ active:false }` response as final and cleared to ready before falling through to Supabase/completion detection, while stale active local snapshots that drifted to zero could still mask signed-in lookup.

**Fix**: task smart-merge now restores cache-backed tasks even when the local store is already empty and queues a create to repopulate Supabase unless deletion markers prove deletion. Canvas group load now uses `getCachedGroupsWithPendingWrites()` and preserves cache-backed groups missing from the server result. The Local API now returns `null` for stale active snapshots whose drift-corrected remaining time reaches zero, allowing signed-in lookup to run. KDE now falls through to Supabase completion detection when the localhost sidecar returns inactive instead of silently clearing to ready.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | User reported sign-in data loss and provided screenshot showing Electron completion notification while KDE stayed ready. | Yes |
| Data shape / persisted row shape | Yes | Cache-backed tasks/groups are restored only when not tombstoned/soft-deleted; task IDs and group IDs are preserved. | Yes |
| Renderer store/state | Yes | `taskPersistence.ts` now repopulates empty local task state from pending-aware cache; `canvas.ts` preserves cached groups. | Yes |
| Electron main/preload bridge | Partial | Existing local snapshot bridge remains unchanged; Local API server behavior is hardened. | Boundary only |
| Localhost sidecar endpoint | Yes | `server/local-api/server.cjs` no longer lets stale active-zero snapshots mask signed-in timer lookup. | Yes |
| KDE polling/control path | Yes | `main.qml` local inactive path now falls through to Supabase/completion handling. | Yes |
| Supabase persistence/realtime | Partial | Recovered cached tasks are enqueued for create; group pending-write cache is applied. Remote writes still depend on auth/session availability. | Partly |
| Updater/runtime version | Yes | Electron updater `1.4.232` built/deployed and public manifest verified. | Yes |
| Stale live process/cache state | Partial | Existing running Electron/KDE processes must update/restart to load the fix. | Not fully |

**Exact failure modes fixed**: cache-backed tasks/groups can no longer vanish permanently from the visible canvas solely because sign-in/auth recovery returns an empty or partial remote load; KDE no longer treats an inactive localhost timer response as final when a prior active work session still needs completion/break detection; stale active local snapshots at zero no longer block signed-in fallback.

**Explicitly not covered**: this does not restore items that were intentionally soft-deleted or tombstoned, and it does not guarantee remote restore while no valid Supabase session exists. It restores visible local state from durable cache/pending writes and queues safe remote create when deletion is not proven.

**Regression added for reported repro**: smart-merge tests cover preserving cache-backed local-only tasks and repopulating an empty local store from cache after authenticated empty loads. Canvas merge tests cover cache-backed local-only group recovery outside the fresh-create grace. Local API tests cover stale active-zero snapshot fallback. KDE tests cover local inactive falling through to Supabase completion detection instead of clearing to ready.

**Tests**: RED/green focused pack `npm test -- tests/unit/stores/smart-merge.test.ts tests/unit/canvas/merge-group-load.test.ts tests/unit/local-api/server-contract.test.ts tests/unit/kde/timer-sync.test.ts` passed 83/83. Related proof: `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1920: restore cached canvas tasks/groups and fix KDE break completion fallback" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.232`; AppImage/deb artifact endpoints return HTTP 200.

### ~~BUG-1923~~: Stale Electron heartbeat can reset KDE and app timer countdown upward (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-05) — killed the live hidden duplicate process, clamped stale same-session remote timer updates, and shipped Electron updater `1.4.234`. | **Depends on**: BUG-1892, BUG-1893, BUG-1896, BUG-1920

**User evidence**: KDE widget timer was looping/resetting, and the regular Electron timer also reset. Live sampling of `http://127.0.0.1:5577/api/timer/current` reproduced the jump: remaining time decreased `1187 → 1185 → 1183`, then jumped upward to `1192`. `wmctrl` showed the visible FlowState window was PID `152961`, while a hidden duplicate AppImage process PID `4019126` was still alive.

**Root cause**: the visible Electron renderer accepted a fresh Realtime heartbeat for the same active session from another device id/process and overwrote its local countdown from that row's stale `remaining_time`. When an old hidden Electron process survived the updater/relaunch path, it could keep writing stale same-session heartbeat state; the visible app and KDE sidecar then reflected the backward jump.

**Fix**: `handleRemoteTimerUpdate()` now clamps active, unpaused, same-session remote updates so they cannot increase the visible countdown unless the remote update represents a real duration increase/extension. The hidden live duplicate was also terminated, and live localhost sampling immediately became monotonic (`1037 → 1035 → 1033 → 1031 → 1029 → 1027`).

**Exact failure mode fixed**: a stale duplicate Electron process or stale same-session remote heartbeat can no longer reset the visible app/KDE countdown upward while the same work session is already running locally.

**Explicitly not covered**: this does not claim duplicate Electron processes can never exist during updater handoff; it prevents stale same-session timer writes from moving a running countdown backward if they do.

**Regression added for reported repro**: `tests/unit/composables/timer-realtime-backstop.test.ts` now reproduces the stale same-session heartbeat shape and asserts that `remainingTime` cannot increase from the local running value.

**Tests**: RED first failed in `npm test -- tests/unit/composables/timer-realtime-backstop.test.ts` with `expected 1191 to be less than or equal to 1183`, then green passed 10/10 after the fix. Related proof: `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1923: prevent stale Electron heartbeat timer resets" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.234`; AppImage/deb artifact endpoints return HTTP 200.

### ~~BUG-1924~~: KDE active-task pill can stay stuck at 0 after completion (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-05) — fixed the QML completion cleanup path that left `/tmp/flowstate-active-task.json` active at `00:00` after the real timer was inactive. | **Depends on**: BUG-1893, BUG-1920, BUG-1923

**User evidence**: KDE panel screenshot at 17:05 on 2026-07-05 showed the active-task companion pill stuck on `0` with "משימה לא נבחרה" while the timer was no longer running.

**Live boundary proof**: `node scripts/diagnose-timer-boundary.cjs` showed `/api/timer/current` returning `{"active":false,"session":null}` and diagnostics branch `local-snapshot-inactive-stale`, but `/tmp/flowstate-active-task.json` still contained `{"taskId":"general","isActive":true,"isWork":false,"timeDisplay":"00:00","progress":1,...}`. The live stale file was manually rewritten inactive so the current panel state could clear immediately.

**Root cause**: `onSessionComplete()` cleared `hasActiveSession`, `currentSessionId`, and leadership state, but did not clear `currentTaskId` / cached active-task fields or rewrite the active-task bridge file. If the last bridge write happened at `00:00`, the companion plasmoid kept rendering that stale active task even though the sidecar and Supabase path were inactive.

**Fix**: KDE completion now clears `currentTaskId`, `_cachedActiveTaskId`, `_cachedActiveTaskName`, and calls `writeActiveTaskFile()` after marking the session inactive.

**Exact failure mode fixed**: after a KDE-observed session completes at zero, the active-task companion bridge can no longer remain active solely because the completion handler failed to publish an inactive bridge-file state.

**Explicitly not covered**: this does not change Electron updater handoff behavior or duplicate-process handling from BUG-1923. The QML fix becomes active in the installed plasmoid after Plasma reload; the existing install is a symlink to this repo.

**Regression added for reported repro**: `tests/unit/kde/timer-sync.test.ts` now extracts `onSessionComplete()` from `main.qml` and requires it to clear `currentTaskId` and rewrite the active-task file.

**Tests**: RED first failed in `npm test -- tests/unit/kde/timer-sync.test.ts` because `onSessionComplete()` did not contain `root.currentTaskId = ""`; green passed 44/44 after the fix.

### ~~BUG-1926~~: Sync Errors popover reports sign-in expired during Electron update auth grace (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-06) — sync queue now respects bounded auth reconnect grace after Electron updates instead of surfacing a misleading sign-in-expired write error. | **Depends on**: BUG-1898, BUG-1913, BUG-1922

**User evidence**: after updating, the desktop app kept showing the Sync Errors popover with `Sign-in expired — changes are kept on this device and will sync after you sign in again`; the user pointed at the close and Dismiss controls and reported it happens after every update.

**Root cause**: `auth.ts` intentionally keeps a signed-in shell during post-update reconnect grace (`canSyncRemotely === false`) while token refresh is still recovering. The sync queue ignored that boundary and fell through to the generic no-session auth gate, so pending writes plus a transient updater/auth gap became a persistent "Sign-in expired" write-health error.

**Fix**: `processQueue()` now checks `authStore.user` + `authStore.canSyncRemotely === false` before calling the Supabase session gate. In that bounded reconnect-grace state it keeps queued writes pending, clears the stale auth-gate last error, and waits until remote auth is actually allowed to hit RLS again.

**Exact failure mode fixed**: an Electron update/restart auth-grace window can no longer produce the Sync Errors popover solely because Supabase storage has not rehydrated while the app is deliberately preserving the signed-in shell.

**Explicitly not covered**: if the grace deadline expires and the refresh token is truly dead, FlowState still requires re-authentication and queued writes remain local until sign-in recovers.

**Regression added for reported repro**: `tests/unit/sync/sync-orchestrator.test.ts` now covers pending writes + signed-in user + `canSyncRemotely=false`, requiring no "sign in again" error, no `writesFailing`, no RLS write, and no failed-queue mutation.

**Tests**: RED first failed in `npm test -- tests/unit/sync/sync-orchestrator.test.ts` because `syncState.value.status` became `error`; green passed 90/90 after the reconnect-grace guard. Related proof: `npm test -- tests/unit/sync/sync-orchestrator.test.ts tests/unit/sync/write-health.test.ts tests/unit/stores/auth-flow.test.ts tests/unit/stores/auth-grace-bound.test.ts`; `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1926: respect auth reconnect grace after Electron updates" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.236`; AppImage/deb artifact range requests return HTTP 206.

### ~~BUG-1927~~: Sync Errors popover can show stale sign-in-expired banner with 0 errors (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-08) — stopped queue auth-gate skips from poisoning global direct-write health and added daily watchdog coverage for the exact `0 errors` + sign-in-expired popover shape. | **Depends on**: BUG-1913, BUG-1922, BUG-1926, TASK-1927

**User evidence**: desktop screenshot on 2026-07-08 showed the Sync Errors popover header reporting `0 errors` while the body still showed `Sign-in expired — changes are kept on this device and will sync after you sign in again`.

**Root cause**: the queue auth-gate branch used `reportWriteFailure('queueFlushAuthGate', ...)`, which wrote the auth-gate text into global `writeHealth`. That global direct-write health channel is independent from the queue's failed-operation list, so it could outlive the queue state and render a stale banner in a popover that had no concrete failed sync operations.

**Fix**: `writeHealth.isWriteContext()` now treats `queueFlushAuthGate` as non-direct-write context, so auth-gate skips stay in queue state instead of global direct-write health. `SyncErrorPopover` only renders a last-error summary when it has concrete failed operations, shows a neutral empty state for zero errors, and hides Clear All when there is nothing to clear.

**Exact failure mode fixed**: the Sync Errors popover can no longer show the sign-in-expired auth-gate banner while simultaneously reporting `0 errors`.

**Regression added for reported repro**: `tests/unit/sync/sync-status-popover.test.ts` covers both the store aggregation boundary and the rendered popover boundary, requiring no sign-in-expired text for the zero-error shape. `scripts/daily-regression-hunt.cjs` now includes that watchdog in the fixed recurring pack.

**Tests**: RED first failed in `npm test -- tests/unit/sync/sync-status-popover.test.ts` because `failedCount` became `1` from writeHealth and the popover rendered the stale sign-in-expired summary with `0 errors`; green passed after the writeHealth and popover fixes. Related proof: `npm test -- tests/unit/sync/write-health.test.ts tests/unit/sync/sync-orchestrator.test.ts tests/unit/sync/sync-status-popover.test.ts`.

### ~~BUG-1925~~: Permanent delete and Canvas visibility regress through shared view-state boundaries (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-06) — added boundary guardrails for the two recurring Electron-visible failures: edit-modal permanent delete silently doing nothing on some views, and Canvas disappearing after switching views. | **Depends on**: BUG-1673, BUG-1850, BUG-1891, BUG-1910

**User evidence**: user reported "permanent delete doesnt work on the electron app again", then immediately "after switching views everything suddenly dissapaers from the canvas", followed by "both of these things keep breaking no matter how many times we fix them".

**Root cause**: these were separate symptoms of weak task-boundary contracts. Several `TaskEditModal` mount points rendered the permanent-delete action but did not listen for its `permanent-delete` event, so the modal could close without invoking a hard delete. Separately, `useCanvasOrchestrator()` fed Canvas from `taskStore.filteredTasks`, so Board/List smart/status/project filters could shrink the Canvas source list to zero when switching views.

**Fix**: all `TaskEditModal` mount points now wire `@permanent-delete` to a hard-delete handler or existing permanent-delete confirmation path. Canvas orchestration now reads `taskStore.tasksWithCanvasPosition`, which is raw-task based and only applies workspace/canvas-position selection before Canvas-specific visibility filtering.

**Exact failure modes fixed**: edit-modal permanent delete can no longer be silently unwired on Electron-visible task edit surfaces; Canvas nodes can no longer disappear solely because another view changed global task filters.

**Explicitly not covered**: this does not claim Supabase hard-delete policies can never reject a delete, and it does not resolve the broader multi-writer canvas group boot-load work tracked under BUG-1910. It hardens the client-side UI/data-source contracts that repeatedly let these symptoms reappear.

**Regression added for reported repro**: `tests/unit/undo-entrypoint-contract.test.ts` now requires every `TaskEditModal` usage to handle `@permanent-delete`. `tests/unit/canvas/canvas-composables.test.ts` now requires Canvas orchestration to use raw canvas-position tasks instead of cross-view `filteredTasks`.

**Tests**: RED first failed in `npm test -- tests/unit/undo-entrypoint-contract.test.ts` because `BoardView.vue` lacked `@permanent-delete`; RED first failed in `npm test -- tests/unit/canvas/canvas-composables.test.ts` because `useCanvasOrchestrator.ts` still used `filteredTasks`. Both focused tests passed green after the fix. Related proof: `npm test -- tests/unit/undo-entrypoint-contract.test.ts tests/unit/canvas/canvas-composables.test.ts tests/unit/undo-task-operations.test.ts tests/unit/composables/useSupabaseDatabase-delete.test.ts tests/unit/sync/sync-orchestrator.test.ts`; `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1925: wire edit-modal permanent delete and isolate Canvas from cross-view filters"`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.235`; AppImage/deb artifact endpoints return HTTP 200.

### ~~BUG-1921~~: Realtime cleanup and duplicate terminal statuses spam console warnings (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-05) — suppressed misleading duplicate/cleanup realtime drop warnings and shipped Electron updater `1.4.233`. | **Depends on**: BUG-1320, BUG-1723, BUG-1799, BUG-1920

**User evidence**: production console showed repeated `📡 [REALTIME] Connection dropped (CHANNEL_ERROR): unknown reason` and `📡 [REALTIME] Connection dropped (CLOSED): unknown reason` warnings from the bundled `index-BdUkLseU.js`.

**Root cause**: `useRealtimeSubscription.ts` logged every terminal Supabase realtime status before checking existing guards. Supabase can emit `CLOSED` after `CHANNEL_ERROR` for the same drop, and `removeChannel()` during explicit cleanup can also trigger `CLOSED`. Because logging happened before `isExplicitlyClosed` and `reconnectTimer` checks, normal cleanup and duplicate terminal statuses looked like repeated runtime failures even though reconnect backoff was already deduped.

**Fix**: moved the explicit-close, duplicate-reconnect, and remove recursion guards ahead of the warning. The first real terminal status still logs and drives recovery; duplicate terminal statuses and explicit cleanup callbacks return quietly.

**Exact failure mode fixed**: one realtime drop no longer produces both `CHANNEL_ERROR` and follow-up `CLOSED` warnings, and explicit unsubscribe/cleanup no longer logs `Connection dropped` warnings.

**Explicitly not covered**: this does not claim Supabase websocket transport will never drop. Real first drops still log once and still use the existing reconnect/backoff path.

**Regression added for reported repro**: `tests/unit/sync/websocket-resilience.test.ts` now asserts that a `CHANNEL_ERROR` followed by `CLOSED` logs only one drop warning, and that an explicit cleanup-triggered `CLOSED` logs no drop warning.

**Tests**: RED first failed in `npm test -- tests/unit/sync/websocket-resilience.test.ts` with 2 failing warnings regressions, then green passed 19/19 after the fix. Related proof: `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1921: suppress duplicate realtime drop warnings" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.233`; AppImage/deb artifact endpoints return HTTP 200.

### ~~BUG-1922~~: Sync Errors popover repeats “Sign-in expired” before trying recoverable refresh (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-05) — sync queue now refreshes an empty Supabase session before surfacing the auth gate, included in Electron updater `1.4.233`. | **Depends on**: BUG-1898, BUG-1913, BUG-1921

**User evidence**: Sync Errors popover kept appearing with `Sign-in expired — changes are kept on this device and will sync after you sign in again`, while the app shell was still open and edits were being retained locally.

**Root cause**: the sync queue auth gate called `supabase.auth.getSession()` and, when it returned no usable session, immediately skipped queue processing. After repeated skips it surfaced the auth-gate error via `writeHealth`. That was correct for a truly dead session, but too early for a recoverable storage/refresh gap: it did not call `refreshSession()` before declaring pending writes blocked.

**Fix**: `getCurrentAuthUserId()` now attempts `supabase.auth.refreshSession()` when `getSession()` has no usable access token. If refresh succeeds, the queue processes the pending operation in the same pass and avoids the misleading expired-session popover. If refresh fails, the existing bounded auth-gate warning remains.

**Exact failure mode fixed**: queued local edits no longer surface the “Sign-in expired” sync error solely because `getSession()` was briefly empty while `refreshSession()` could still return a valid session.

**Explicitly not covered**: if the refresh token is truly invalid/expired and `refreshSession()` fails, FlowState still shows the sync error and keeps changes local until re-authentication.

**Regression added for reported repro**: `tests/unit/sync/sync-orchestrator.test.ts` now covers empty `getSession()` plus successful `refreshSession()` flushing a pending write without setting the auth-gate error.

**Tests**: RED first failed because `refreshSession()` was not called; green `npm test -- tests/unit/sync/sync-orchestrator.test.ts` passed 89/89. Related proof: `npm test -- tests/unit/sync/websocket-resilience.test.ts tests/unit/sync/sync-orchestrator.test.ts`; `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1921/1922: suppress duplicate realtime warnings and recover sync auth gate" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.233`; AppImage/deb artifact endpoints return HTTP 200.

### ~~BUG-1887~~: Sync Errors popover is translucent over canvas content (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-24) — fixed the Sync Errors popover and Storybook mirror to render opaque surfaces instead of inheriting glass/translucent tokens. | **Depends on**: TASK-1183

**Why**: Permanent sync/RLS errors opened a Sync Errors popover where the canvas and task nodes showed through the panel, rows, badges, and buttons. The popover used global glass tokens (`--glass-bg-medium`, `--surface-subtle`, `--danger-bg-subtle`) that are intentionally translucent in the current desktop theme.

**Fix**: `SyncErrorPopover.vue` now defines local opaque popover, row, danger-row, and control backgrounds. Red danger surfaces keep their tint by layering translucent red over an opaque base, and popover/button backdrop filters are disabled. The Storybook layout story uses the same opaque treatment for visual regression review.

**Tests**: `npx eslint src/components/sync/SyncErrorPopover.vue src/stories/layout/SyncErrorPopover.stories.ts`; `npm run type-check`; Storybook Playwright proof for `🏢-layout-syncerrorpopover--permanent-error` captured `/tmp/sync-error-popover-opaque.png` and confirmed popover/action backgrounds resolve to solid `rgb(...)` colors with `backdrop-filter: none`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1887: make Sync Errors popover opaque"`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.213`; AppImage and deb endpoints both return HTTP 200 with sizes `180343544` and `131335688`.

### ~~BUG-1888~~: KDE widget misses Electron timer during auth recovery and sync queue hammers RLS (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-24) — fixed with Electron local timer snapshots, auth-session-gated sync replay, regression coverage, and shipped via Electron updater `1.4.214`. | **Depends on**: TASK-1797, BUG-1301

**Why**: During Electron auth recovery, FlowState can preserve cached authenticated data and keep the timer usable locally while Supabase has no fresh access token. The KDE widget depended on the Electron local API sidecar having a Supabase session, so `/api/timer/current` could go unavailable even though the Electron timer was running. At the same time, recovered RLS-failed queue entries were replayed with only cached user state, causing repeated 401/RLS failures.

**Fix**: The renderer now publishes the active timer as a local snapshot to Electron main, Electron keeps the sidecar alive for that snapshot, and the sidecar serves `/api/timer/current` from loopback-local state before requiring Supabase auth. Sync queue RLS recovery and queue processing now require a fresh Supabase session access token; cache-only auth recovery waits instead of replaying writes into RLS failures.

**Tests**: RED/green `npm test -- tests/unit/electron/local-api-lifecycle.test.ts tests/unit/local-api/server-contract.test.ts`; `npm test -- tests/unit/sync/sync-orchestrator.test.ts`; combined focused pack `npm test -- tests/unit/electron/local-api-lifecycle.test.ts tests/unit/local-api/server-contract.test.ts tests/unit/sync/sync-orchestrator.test.ts`; `npm run guard:electron-sync`; `npm run type-check`; `npm run electron:build`. `npm run lint` was retried with an explicit timeout and produced no diagnostics before timing out. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.214`; AppImage and deb endpoints both return HTTP 200 with sizes `180339492` and `131335912`.

### ~~BUG-1889~~: Electron can read/write web localStorage before preload bridge, causing restart sign-out (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-06-24) — fixed with regression coverage and shipped via Electron updater `1.4.215`. | **Depends on**: BUG-1874, BUG-1888

**Why**: The user still saw Electron randomly lose auth after restart/update. Console evidence showed two related startup failure shapes: no restored auth session while cached private data existed, and stale backup replay failing with `Invalid Refresh Token: Already Used`. Supabase JS officially relies on the configured auth storage for persisted sessions and refreshes sessions from that storage; in Electron, that storage must be the durable preload IPC store, not Chromium `file://` localStorage. The remaining hole was `createLazyAuthStorage()`: it resolved the backend at call time, but if the Electron runtime was known by user-agent/process while `window.electronAPI` was momentarily absent, it still fell through to web localStorage. That could make startup miss the real disk-backed session or persist a rotated token into the wrong store.

**Fix**: `authStorage.ts` now treats Electron user-agent/process detection as a durable-store-only runtime. Auth `getItem`/`setItem`/`removeItem` wait briefly for the preload bridge and use `storeGet`/`storeSet` when it appears; if the bridge never appears in Electron, auth writes refuse to persist into unreliable `file://` localStorage instead of poisoning the session path. Existing web/PWA behavior still uses localStorage.

**Tests**: `src/services/auth/__tests__/authStorage.test.ts` now covers a late Electron preload bridge and proves Electron tokens are not written to localStorage when the bridge is missing. Related auth/storage suite passed: `npm test -- src/services/auth/__tests__/authStorage.test.ts tests/unit/electron-runtime-detection.test.ts tests/unit/auth-backup-replayable.test.ts tests/unit/restore-auth-backup.test.ts tests/unit/auth-flush-for-update.test.ts tests/unit/electron/store-atomic.test.ts tests/unit/stores/auth-flow.test.ts` (55/55). Additional proof: `npm run type-check`; `npm run guard:electron-sync`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --skip-guard --notes "BUG-1889: keep Electron auth storage on durable preload bridge"`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.215`; AppImage and deb endpoints both return HTTP 200 with sizes `180339671` and `131335920`.

### ~~BUG-1890~~: Electron Google OAuth opens no sign-in page because loopback port drifted from allow-list (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-06-25) — fixed with regression coverage and shipped via Electron updater `1.4.216`. | **Depends on**: BUG-1889

**Why**: Electron Google sign-in started a local OAuth callback server on `127.0.0.1:24895-24897`, but the documented Google/Supabase allow-listed desktop redirect ports are `127.0.0.1:24892-24894`, matching the Tauri flow. That mismatch can make Supabase reject the OAuth `redirectTo` before the Google sign-in page loads. A second UX failure hid the root cause: if Electron/Linux fails to open the system browser, the renderer moved straight to `oauthWaitForCallback()` and looked stuck.

**Fix**: Electron OAuth now uses the same documented loopback ports as Tauri and the setup docs (`24892`, `24893`, `24894`). The Electron Google sign-in path now cancels the local OAuth server and surfaces `Failed to open browser for authentication` immediately if `openExternal()` fails instead of waiting for a callback that cannot arrive.

**Tests**: `tests/unit/electron/oauth-port-contract.test.ts` locks Electron, Tauri, and `docs/GOOGLE-CLOUD-SETUP.md` to the same allowed loopback ports and rejects the drifted `24895-24897` range. `tests/unit/stores/auth-google-electron.test.ts` now covers 11 Electron Google sign-in regressions: PKCE success, implicit-token fallback, callback-server start failure, Supabase provider failure, missing provider URL, browser-launch failure with server cancel, provider callback errors, PKCE exchange failure, implicit session failure, empty callback, and callback wait failure. Related auth pack passed: `npm test -- tests/unit/stores/auth-google-electron.test.ts tests/unit/stores/auth-google-guest-mode.test.ts tests/unit/stores/auth-flow.test.ts tests/unit/auth-flush-for-update.test.ts tests/unit/electron/oauth-port-contract.test.ts` (47/47); `npm run type-check`; `npm run guard:electron-sync` (178/178); `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --skip-guard --notes "BUG-1890: align Electron Google OAuth loopback ports"`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.216`; AppImage and deb endpoints both return HTTP 200 with sizes `180339560` and `131336080`.

### ~~BUG-1895~~: Electron update reconnect grace can still collapse into visible sign-out (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE 2026-06-30 (shipped Electron updater `1.4.225`) | **Depends on**: BUG-1894, BUG-1881, BUG-1871

**User evidence**: after updating to the auth-write guard build, the app still signed the user out after update. This was a different failure from the timer/project 401/RLS cascade: the app lost the visible signed-in shell.

**Root cause**: reconnect/offline grace preserved `user` and blocked remote writes, but later auth recovery paths still cleared the shell. Specifically, online retry exhaustion after an expired session and the non-explicit `SIGNED_OUT` grace timer could still set `session.value = null` and `user.value = null` when Supabase storage had no refreshed session. In reconnect grace, missing Supabase storage is expected, so clearing the cached shell was the regression.

**Fix**: failed online/post-grace refresh exhaustion now re-enters reconnect shell instead of clearing auth state. Non-explicit `SIGNED_OUT` events during reconnect grace are ignored, and the delayed 2s clear also re-checks reconnect grace before clearing. Explicit sign-out remains unchanged.

**Exact failure mode fixed**: update/restart with an expired or already-used refresh token can no longer turn the preserved reconnect shell into a visible sign-out merely because retries exhausted without a fresh Supabase session.

**Explicitly not covered**: this still does not create a valid Supabase token from a dead refresh token. Remote sync remains disabled through `canSyncRemotely === false` until a valid session is restored or the user signs in again.

**Regression added for reported repro**: auth-flow now covers expired-session update startup, offline/reconnect grace, online retry exhaustion with `Invalid Refresh Token: Already Used`, and verifies the user remains signed in locally with `canSyncRemotely === false` and `initializationFailed === false`.

**Tests**: `npm run test -- tests/unit/stores/auth-flow.test.ts` passed 33/33. Broader pack `npm run test -- tests/unit/stores/auth-flow.test.ts tests/unit/stores/timer-state-machine.test.ts tests/unit/composables/useLocalApiBridge.test.ts tests/unit/composables/timer-realtime-backstop.test.ts` passed 85/85. Related proof: `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1895: preserve signed-in shell after Electron update reconnect retry exhaustion" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.225`; AppImage and deb endpoints both return HTTP 200 with sizes `180343701` and `131337312`.

### ~~BUG-1896~~: Electron Stop can stay visibly active while remote timer stop persistence stalls (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE 2026-06-30 (shipped Electron updater `1.4.226`) | **Depends on**: BUG-1895, BUG-1894, BUG-1893

**User evidence**: after updating, Electron showed auth recovery logs (`No restored session, but cached authenticated data exists`), realtime channel drops, and then the timer did not stop and stayed stuck active.

**Root cause**: `stopTimer()` still used the older remote-first stop path: it paused countdown/heartbeat, built a stopped session, then awaited Supabase timer persistence and sync queue work before clearing `currentSession` and updating the Electron/KDE local timer snapshot. If the remote stop write stalled or failed during auth recovery, the visible app and localhost sidecar could remain active even though Stop had been clicked. `completeSession()` already had the correct local-first pattern; `stopTimer()` had drifted behind that hardening.

**Fix**: Stop is now local-first. It pushes the stopped session to local history, marks the session id completed, clears `currentSession`, sends a null Electron/KDE local snapshot, and resumes follower polling before any remote persistence. Remote save failures are logged and kept non-fatal so stale auth cannot turn Stop into a Vue runtime error or leave the timer active.

**Exact failure mode fixed**: a Stop click can no longer keep Electron/KDE visibly active just because `saveActiveTimerSession` or downstream sync work stalls during auth recovery.

**Explicitly not covered**: this does not repair the dead Supabase refresh token or guarantee remote timer stop persistence while offline/reconnect auth is active. It guarantees the local Electron/KDE timer stops immediately and remote persistence becomes best-effort.

**Regression added for reported repro**: timer state-machine test now stalls the remote stop save and verifies `currentSession` is cleared and the Electron/KDE local snapshot receives `null` before that stalled save can resolve.

**Tests**: Red regression first failed because `currentSession` stayed active while a remote stop save stalled. `npm run test -- tests/unit/stores/timer-state-machine.test.ts` passed 42/42 after the fix. Broader pack `npm run test -- tests/unit/stores/timer-state-machine.test.ts tests/unit/stores/auth-flow.test.ts tests/unit/composables/useLocalApiBridge.test.ts tests/unit/composables/timer-realtime-backstop.test.ts` passed 86/86. Related proof: `npm run type-check`; `npm run lint`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1896: stop timer clears Electron/KDE local state before remote persistence" --skip-guard`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.226`; AppImage and deb endpoints both return HTTP 200 with sizes `180343469` and `131337464`.

### ~~BUG-1894~~: Reconnect-grace auth shell sends unauthorized timer/project writes after stale Electron backup (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE 2026-06-30 (shipped Electron updater `1.4.224`) | **Depends on**: BUG-1881, BUG-1871, BUG-1893

**User evidence**: after updating Electron, the console showed `Invalid Refresh Token: Already Used`, `[AUTH] Electron backup refresh token already used — cleared stale backup, keeping signed-in shell for reconnect`, repeated `No auth token available`, and then unauthorized Supabase writes: `saveProjects` / `saveActiveTimerSession` returned 401/RLS errors.

**Root cause**: FlowState intentionally keeps a signed-in shell during Electron reconnect grace so cached data stays visible after a stale backup token is rejected. That made `isAuthenticated === true` even though Supabase had no usable access token. Timer/project persistence gates treated that shell as a valid remote-sync state, so user actions attempted Supabase writes with no auth token.

**Fix**: auth now exposes `canSyncRemotely`, true only when a usable session access token exists and the app is not in reconnect/offline grace. Timer sync, timer start/stop/complete queueing, pomodoro history writes, project bulk saves, and direct project create/update/delete persistence now use that stricter capability. In reconnect grace, timer starts remain local and still update the Electron/KDE-facing local snapshot, but Supabase writes, leadership claims, and sync-queue enqueues are skipped until a real session is restored.

**Exact failure mode fixed**: stale Electron auth backup replay could leave the UI signed in for cached data while remote timer/project writes still ran and failed as 401/RLS.

**Explicitly not covered**: this does not mint a new Supabase session from an already-used refresh token. If the backup token is dead, the app still needs an interactive sign-in or a later valid refresh source; this fix prevents corrupt/noisy remote writes while in that recovery shell.

**Regression added for reported repro**: auth-flow tests assert reconnect-grace remains visibly signed in but `canSyncRemotely` is false until refresh recovery succeeds. Timer state-machine tests assert `startTimer` during reconnect grace creates a local running timer without calling `fetchActiveTimerSession`, `saveActiveTimerSession`, `claimLeadership`, or sync queue enqueue.

**Tests**: `npm run test -- tests/unit/stores/auth-flow.test.ts tests/unit/stores/timer-state-machine.test.ts` passed 73/73. Broader pack `npm run test -- tests/unit/stores/auth-flow.test.ts tests/unit/stores/timer-state-machine.test.ts tests/unit/composables/timer-realtime-backstop.test.ts tests/unit/composables/useLocalApiBridge.test.ts tests/unit/stores/all-stores.test.ts tests/unit/stores/project-workspace-sync-scope.test.ts` passed 121/121. Related proof: `npm run type-check`; `npm run electron:build`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1894: block unauthorized remote writes during Electron reconnect grace" --skip-guard` completed. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.224`; AppImage and deb endpoints both return HTTP 200 with content lengths `180343650` and `131337264`.

### ~~BUG-1893~~: Recurring Electron/KDE timer failures lack a complete live boundary diagnostic (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE 2026-06-30 (shipped Electron updater `1.4.223`) | **Depends on**: BUG-1891, BUG-1888, TASK-1797

**Why**: The timer/KDE path has broken repeatedly across renderer state, Electron main/preload forwarding, localhost sidecar state, Supabase timer rows, KDE polling, updater/runtime version, and stale live processes. The latest recurrence could not be safely fixed from symptoms alone: the live sidecar was running, `/api/timer/current` returned inactive without `source:"local-snapshot"`, and the existing tests were green. Root cause for this slice: the app had no non-secret diagnostic surface that correlated the hidden timer boundary state, so agents could not prove which class failed before patching.

**Fix**: The Local API sidecar now exposes loopback-only `GET /api/timer/diagnostics` with non-secret timer boundary state: app version, auth context, local snapshot presence/age/active flag, current branch, and Supabase active-row lookup status. Electron main now forwards the loaded app version into the sidecar and reports non-secret bridge state through `localApi:status` including child PID, latest session presence, latest timer snapshot presence/activity, and snapshot age. `scripts/diagnose-timer-boundary.cjs` captures the sidecar diagnostics, `/api/timer/current`, KDE active-task bridge file, local/public updater manifests, package version, and matching FlowState processes in one report.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Partial | User reported the timer broke again; current live probe showed inactive localhost/KDE state but not a visible active Electron timer at the same moment. | Not directly |
| Data shape / persisted row shape | Yes | Diagnostics reports only Supabase active-row presence, not row contents. | Yes |
| Renderer store/state | Yes | Existing watcher still publishes `currentSession`; diagnostics distinguishes missing forwarded snapshot from sidecar/Supabase state. | Yes |
| Electron main/preload bridge | Yes | `localApi:status` now reports child PID, app version, latest session, latest timer snapshot, active flag, and snapshot age. | Yes |
| Localhost sidecar endpoint | Yes | `/api/timer/diagnostics` reports branch state beside `/api/timer/current`; routes stay loopback-only and non-secret. | Yes |
| KDE polling/control path | Partial | Script captures `/tmp/flowstate-active-task.json`; no QML behavior changed in this slice. | Observability only |
| Supabase persistence/realtime | Partial | Diagnostics checks whether signed-in lookup finds an active row without exposing row contents; no persistence behavior changed. | Observability only |
| Updater/runtime version | Yes | Script compares package, local release, public updater, and running process evidence. | Yes |
| Stale live process/cache state | Yes | Script captures matching FlowState/AppImage processes and showed the pre-update runtime returned `401` for the new diagnostics route. | Yes |

**Exact failure mode fixed**: recurring timer/KDE investigations could not prove whether the renderer snapshot, Electron bridge, sidecar branch, Supabase active row, KDE bridge file, updater version, or stale runtime was failing before code changes were attempted.

**Explicitly not covered**: a specific timer behavior regression is not claimed fixed here; KDE clearing semantics, Supabase writes/realtime, and renderer timer state machine behavior are unchanged.

**Regression added for reported repro**: local API, Electron lifecycle, and diagnostics-script tests now require the non-secret boundary evidence needed before the next timer behavior fix.

**Live boundary proof**: before shipping `1.4.223`, `node scripts/diagnose-timer-boundary.cjs` showed the old live sidecar returned `401` for `/api/timer/diagnostics`, `/api/timer/current` returned inactive, KDE active-task file was inactive, and public updater was still `1.4.222`. After shipping, the public updater manifest served `version: 1.4.223`, and both AppImage/deb artifact URLs returned HTTP 200 with content lengths `180343605` and `131337648`. The same diagnostic script then showed package/local/public release versions all at `1.4.223`, while the already-running desktop process still returned `401` for `/api/timer/diagnostics`; the endpoint becomes live after that process updates/restarts into `1.4.223`.

**Tests**: RED/green `npm run test -- tests/unit/local-api/server-contract.test.ts tests/unit/electron/local-api-lifecycle.test.ts tests/unit/scripts/timer-boundary-diagnostics-script.test.ts` passed 22/22. Focused timer pack `npm run test -- tests/unit/local-api/server-contract.test.ts tests/unit/kde/timer-sync.test.ts tests/unit/local-api/renderer-bridge.test.ts tests/unit/electron/local-api-lifecycle.test.ts tests/unit/stores/timer-state-machine.test.ts tests/unit/composables/timer-realtime-backstop.test.ts tests/unit/scripts/timer-boundary-diagnostics-script.test.ts` passed 116/116. Related proof: `npm run type-check`; `npm run guard:electron-sync` passed 178/178; `npm run lint` exited with no diagnostics; `git diff --check` passed; `npm run electron:build` passed; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1893: add timer boundary diagnostics for recurring KDE/Electron failures" --skip-guard` completed.

### ~~BUG-1891~~: KDE widget clears an Electron-running timer from stale inactive local snapshot (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE 2026-06-29 (shipped Electron updater `1.4.222`) | **Depends on**: BUG-1888, TASK-1797

**Why**: The KDE widget could reset to no active timer while Electron still showed an Electron-started timer running. Live probe during the recurrence showed the Local API sidecar was alive on `127.0.0.1:5577`, but `/api/timer/current` returned `200 {"active":false,"session":null,"source":"local-snapshot"}` and KDE's `/tmp/flowstate-active-task.json` had already been cleared. Root cause: inactive renderer-owned local snapshots were authoritative forever, so a stale inactive snapshot masked signed-in Supabase timer lookup and KDE fallback.

**Fix**: `server/local-api/server.cjs` now treats inactive local snapshots as short stop/complete tombstones only. Active local snapshots still win and drift-correct the KDE clock; fresh inactive snapshots can still clear the widget for real stop/complete transitions; stale inactive snapshots return `null` so `/api/timer/current` falls through to signed-in Supabase lookup or KDE's own fallback instead of killing the widget.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | User reported Electron timer still active while KDE widget reset; live probe showed `/api/timer/current` returned inactive local snapshot. | Yes |
| Data shape / persisted row shape | Partial | Fix falls through to signed-in Supabase lookup when local inactive snapshot is stale. | Not directly |
| Renderer store/state | Yes | Active renderer snapshots remain authoritative; inactive snapshots now expire after short tombstone window. | Yes |
| Electron main/preload bridge | Yes | Existing lifecycle bridge regressions passed in focused pack. | Yes |
| Localhost sidecar endpoint | Yes | `server-contract.test.ts` covers stale inactive local snapshot fallback behavior. | Yes |
| KDE polling/control path | Yes | `timer-sync.test.ts` documents KDE must not treat stale sidecar inactive state as durable truth. | Yes |
| Supabase persistence/realtime | Partial | Fallback path is preserved; no Supabase write/realtime behavior changed. | Not directly |
| Updater/runtime version | Yes | Electron updater `1.4.222` deployed and public manifest verified. | Yes |
| Stale live process/cache state | Partial | Runtime update is shipped; existing running Electron/KDE processes still need to update/restart to load it. | Not fully |

**Exact failure mode fixed**: stale inactive renderer-owned local timer snapshots could remain authoritative forever and mask a still-running Electron/Supabase timer from the KDE sidecar endpoint.

**Explicitly not covered**: unrelated KDE polling crashes, Supabase auth expiry, realtime lag, and already-running desktop/KDE processes that have not loaded Electron `1.4.222`.

**Regression added for reported repro**: local API and KDE timer-sync tests now cover a stale inactive local snapshot after an Electron-started timer path.

**Live boundary proof**: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.222`; AppImage and deb endpoints return HTTP 200.

**Tests**: RED/green `npm run test -- tests/unit/local-api/server-contract.test.ts tests/unit/kde/timer-sync.test.ts tests/unit/local-api/renderer-bridge.test.ts tests/unit/electron/local-api-lifecycle.test.ts` passed 62/62. Related proof: `npm run type-check`; `npm run guard:electron-sync` passed 178/178; `npm run lint` completed with no diagnostics printed; `npm run electron:build` passed and generated local updater `release/latest-linux.yml` version `1.4.222`; `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "BUG-1891: stop stale inactive local timer snapshots from clearing KDE"` completed. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.222`; AppImage and deb endpoints both return HTTP 200 with content lengths `180339780` and `262672728`.

### ~~BUG-1886~~: Project bulk sync can hit RLS when stale workspace rows are cached (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-23) — fixed with regression coverage and locally packaged as Electron `1.4.206`; public updater deploy was not run because production upload requires explicit approval. | **Depends on**: TASK-1537, TASK-1547

**Why**: `Sync Error(saveProjects): new row violates row-level security policy for table "projects"` can happen when the project store bulk-saves every visible/cached project after a small project edit. Cached/realtime state can temporarily contain personal rows plus shared-workspace rows from a different workspace; one inaccessible `workspace_id` in the bulk upsert makes Postgres reject the whole batch under the workspace-aware projects RLS policy.

**Fix**: `saveProjectsToStorage()` now scopes authenticated bulk project saves to the active workspace before calling `saveProjects`. Personal sync includes only `workspaceId` missing/null projects; shared sync includes only rows whose `workspaceId` equals the active workspace.

**Tests**: `npm run test -- tests/unit/stores/project-workspace-sync-scope.test.ts`; `npm run test -- tests/unit/utils/supabaseMappers.test.ts tests/contract/rls-enforcement.test.ts`; `npm run test -- tests/unit/stores/all-stores.test.ts`; `npm run type-check`; `npm run lint`; `VPS_HOST=84.46.253.137 ./scripts/deploy-electron-update.sh --notes "BUG-1886: scope project bulk sync to active workspace" --skip-deploy`. Local updater manifest `release/latest-linux.yml` is `version: 1.4.206` with AppImage `180339468` bytes and deb `131333404` bytes.

### ~~BUG-1884~~: Task context-menu project/category changes can revert or appear to do nothing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-23) — fixed with regression coverage and shipped via Electron updater `1.4.205`. | **Depends on**: TASK-1871

**Why**: The task context-menu project picker updated local task state, but the selective sync payload skipped `project_id` whenever the updated local `projectId` became `undefined` for Uncategorized. That field-completeness gap meant clearing a category never sent `project_id: null`, so realtime/refresh could restore the old project and make the menu action look like it did nothing.

**Fix**: `updateTask()` now emits `project_id` for every explicit `projectId` change. Valid UUID project IDs sync as the UUID; Uncategorized/empty/legacy placeholder values sync as `null`.

**Tests**: RED/green `npm run test -- tests/unit/sync/task-sync-payload-completeness.test.ts` covers the missing `project_id: null` path. Related proof: `npm run test -- tests/unit/components/task-row-project.test.ts tests/unit/task-context-menu-dismiss-contract.test.ts`; `npm run test -- src/stores/__tests__/tasks.test.ts`; `npm run type-check`; `npm run lint`; `npm run electron:build` for `1.4.205`. Live updater proof: `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.205`; AppImage and deb endpoints both return HTTP 200 with sizes `180306014` and `131322040`.

### ~~BUG-1880~~: PWA Today task view shows stale overdue tasks before rescheduled today tasks (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-22) — fixed with regression coverage and deployed to the production PWA. | **Depends on**: BUG-1877, BUG-1867

**Why**: Phone/PWA Today mode can feel out of sync with Electron after desktop reschedules because the mobile task view still lets overdue rows win visible ordering in Today mode. The standalone Today route already had a narrow Today-before-Overdue unit guard, but the main PWA task view (`MobileInboxView` / `MobileInboxTaskList`) rendered the ungrouped Today mode as Overdue first, and the composable kept canvas/project/priority ordering inside Today mode instead of pinning tasks due today before overdue tasks.

**Acceptance**:
- In PWA/mobile Today mode, tasks due today appear at the top and overdue tasks appear afterwards.
- The rule holds for the normal task view and grouped task modes, not only the standalone `/today` route.
- Regression coverage fails on the old Overdue-first behavior and passes after the fix.

**Fix**: `MobileInboxTaskList.vue` now renders the Today section before Overdue in the normal PWA task view. `useMobileInboxLogic.ts` also applies a Today-mode ordering pass so tasks due today stay above overdue tasks even when canvas/project/priority grouping would otherwise preserve stale overdue-first order.

**Tests**: RED proof: `tests/unit/mobile-inbox-today-order.test.ts` failed on old behavior with `['Overdue', 'Today']` and stale canvas order before the fix. Green proof: `npm run test -- tests/unit/mobile-inbox-today-order.test.ts tests/unit/mobile-today-order.test.ts tests/unit/pwa-offline-regression.test.ts` passed 21/21; `npm run type-check` passed; `npm run build` passed and generated the PWA service worker precache; `npm run lint` exited 0 under the repo wrapper.

**Production PWA proof**: Deployed `dist/` to `root@84.46.253.137:/var/www/flowstate/` with `rsync -avz --delete --exclude='updates/'`, reloaded Caddy, and verified `https://in-theflow.com/` serves the new `index-DE18XqFj.js` bundle. `DOMAIN=https://in-theflow.com ./scripts/validate-chunks.sh` passed with 164/164 chunks verified; live `sw.js` and VPS `/var/www/flowstate/sw.js` both contain the 36,443-byte current service worker.

### ~~BUG-1879~~: Catalogue context-menu date picker closes when clicking calendar controls (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-22) — fixed with regression coverage and shipped through Electron updater `1.4.202`; public manifest and artifact URLs verified. | **Depends on**: none | **Related**: TASK-1518, BUG-1519

**Why**: In catalogue/list context menus, the due-date picker panel is teleported outside the menu. The outside-dismiss guard already allowed teleported date-picker DOM, but it only accepted `HTMLElement` targets. Clicking Naive UI calendar arrows can dispatch from an SVG element inside `.n-date-panel`, so the guard misclassified the click as outside the menu and closed the panel.

**Fix**: `TaskContextMenu.vue` now treats any DOM `Element` as eligible for owned-surface matching before checking `.closest('.submenu, .n-date-picker, .n-date-panel, .n-popover, .ai-assist-popover')`.

**Tests**: `tests/unit/task-context-menu-dismiss-contract.test.ts` covers SVG controls inside `.n-date-panel` and keeps the menu open. Shipped: Electron updater `1.4.202`; `https://in-theflow.com/updates/electron/latest-linux.yml` returns `version: 1.4.202`; `FlowState-1.4.202-x86_64.AppImage` returns HTTP 200 with `content-length: 180302013`; `FlowState_1.4.202_amd64.deb` returns HTTP 200 with `content-length: 131319652`.

### ~~BUG-1874~~: "Signed out after Electron update + restart" — fix at main/preload/storage layer (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-06-18) — shipped through Electron updater `1.4.200`; public manifest and artifact URLs verified. | **Depends on**: none | **Related**: BUG-1870, BUG-1865

**Why**: Recurring sign-out after auto-update+restart. BUG-1870/1865 hardened the renderer grace logic (`src/stores/auth.ts`), but the recurrence lives in the Electron main/preload/storage layer those fixes never touched. Root causes (Perplexity review + two code explorations): (1) **module-eval runtime detection race** — `isElectronRuntime` evaluated at import in `supabase.ts:17`; if the preload bridge isn't present yet, auth storage falls back to volatile localStorage → detection flip between runs loses the session; (2) **no quit-flush during update** — AppImage path `app.exit(0)` (`updater.ts:124`) bypasses before-quit/will-quit and there's no `before-quit-for-update`, so an in-flight `store:set` (just-rotated refresh token) is lost → next launch replays a stale token → "Already Used" → Sign In; (3) **non-atomic write + read-modify-write race** in `electron/ipc/store.ts` (direct `writeFile`, no temp+rename, no mutex) → corruption wipes all auth / concurrent sets clobber. `appId`/`userData` are stable (ruled out).

**Fix (atomic in-place, NOT electron-store — CJS main can't require ESM-only v9+)**:
- Fix 1: lazy runtime detection in the `supabase.ts` storage adapter (resolve backend at call time).
- Fix 2: atomic `store.json` writes (temp+fsync+rename), `.bak` fallback on corrupt load, write mutex, `flushStore()`.
- Fix 3: flush auth before update exit — `before-quit-for-update` + bounded renderer flush handshake before `app.exit(0)`/`quitAndInstall`.

**Acceptance**: signed-in shell survives update+restart; corrupt-store recovers from `.bak`; concurrent sets don't clobber; ships via versioned updater. NOT adopting the "bump auth_version → clear session" pattern (that causes the sign-out). Plan: `~/.claude/plans/got-it-the-proud-nygaard.md`.

**Shipped**: Electron updater `1.4.200` deployed on 2026-06-18 with the storage/auth updater fixes and the Calendar inbox filter-toolbar design regression fix. Verified `https://in-theflow.com/updates/electron/latest-linux.yml` returns `version: 1.4.200`; `FlowState-1.4.200-x86_64.AppImage` returns HTTP 200 with `content-length: 180302305`; `FlowState_1.4.200_amd64.deb` returns HTTP 200 with `content-length: 131319924`.

### ~~BUG-1877~~: Rotate day groups re-homes dated tasks into matching smart groups (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-18) — included in Electron updater `1.4.200`; public manifest and artifact URLs verified. | **Depends on**: BUG-1787

**Why**: Explicit rotate/catchup could normalize a task's date to today while leaving the task under its stale day-of-week parent. The visible result was a task that should be in Today still living under yesterday/Thursday after rotate days.

**Fix**: `rotateDayGroupPositions()` now computes the matching smart group for each visible dated task before layout, treats the matched parent as canonical for stacking, and persists `parentId` together with the canonical absolute canvas position when the task needs to move.

**Tests**: `tests/unit/canvas/day-group-position-rotation.test.ts` includes `4d: explicit rotate re-homes dated tasks into their matching smart group`, covering a stale Thursday child with today's due date moving into Today.

### ~~BUG-1878~~: Electron canvas reopens to an empty saved viewport after restart (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-06-18) — fixed, regression-proven, and packaged locally as Electron `1.4.201`; public updater still serves `1.4.200` because production upload was not authorized in this turn. | **Depends on**: BUG-1867

**Why**: The canvas could recover visually when a persisted viewport pointed at empty space, but the recovery did not heal the persisted viewport. Electron then reloaded the same stale local/cloud viewport on restart and appeared empty again even though tasks/groups still existed.

**Fix**: Startup viewport recovery now persists the actual recovered Vue Flow viewport after it verifies that at least one canvas node is visible, using the existing `canvasStore.setViewport()` persistence path.

**Tests**: `tests/e2e/canvas-geometry-local.spec.ts` now asserts both visible-node recovery and that `flowstate-canvas-viewport` no longer contains the stale off-canvas coordinates after recovery. Red proof: the new assertion failed with `{"x":-20000,"y":-20000,"zoom":1}` before the fix; green proof passes after the fix. Local package proof: `release/latest-linux.yml` is `version: 1.4.201` with AppImage/deb artifacts built and package-validated.

### ~~BUG-1881~~: Electron signs user out after update + random restart (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-06-22) — fixed + unit-proven; version bumped to `1.4.204`, awaiting deploy authorization. | **Depends on**: BUG-1874, TASK-1871

**Why**: Recurring Electron sign-out, confirmed pattern: after auto-update and randomly on restart (not while using). Telltale: after sign-out a refresh shows tasks (local IndexedDB cache) but the UI stays signed-out — i.e. the auth-session *rehydration* failed while data rendered from cache.

**Root causes (confirmed by reading code)**:
1. The ~62-min stale-backup guard in `restoreAuthSessionFromBackup` (`src/services/auth/supabase.ts`) *refused AND deleted* a recoverable session on restart. GoTrue refresh tokens live far longer server-side, so refusing locally guaranteed the sign-out and erased the only recovery source.
2. `isElectronRuntime` was frozen at module-eval (only the storage adapter was de-frozen in BUG-1874). A momentary bridge absence could flip to the web branch → relative Supabase URL resolved against a `file://` origin → broken client.
3. Updater store-flush timeout (1500 ms) was too tight before `app.exit(0)`, risking loss of a just-rotated refresh token after auto-update.

**Fix**:
1. Always restore the backup and let the SERVER validate the refresh token; the genuine "Already Used" case is already handled in `auth.ts` (clears dead backup, keeps signed-in shell). No local refuse/delete.
2. `detectElectronRuntime()` now also checks the Electron user-agent / `process.type`; `resolveSupabaseUrl()` refuses to resolve a relative URL against a non-http(s) origin.
3. Raised `STORE_FLUSH_TIMEOUT_MS` 1500 → 5000 ms in `electron/updater.ts`.

**Not a cause (verified)**: KDE widget. `~/.config/flowstate/session.json` exists but is 3 months stale with a dead token; Electron never writes it (Tauri-only), so the widget cannot rotate the app's live token. Recommend deleting the stale file as hygiene.

**Tests**: `tests/unit/restore-auth-backup.test.ts` (red→green: stale backup is restored, not deleted), `tests/unit/electron-runtime-detection.test.ts`. 13 auth/electron tests pass; changed files typecheck clean.

### TASK-1875: Encrypt Supabase refresh token at rest with Electron safeStorage (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED (filed 2026-06-18) | **Depends on**: BUG-1874

**Why**: Deferred hardening follow-up. The auth session (incl. refresh token) is stored as plaintext JSON in `userData/store.json`. Encrypt at rest with Electron `safeStorage.encryptString` (OS keychain), decrypt on read, with a first-run migration that re-encrypts existing plaintext sessions — **PRESERVE, never clear** (clearing on update is the BUG-1874 sign-out). Depends on the BUG-1874 atomic store landing first.

### ~~TASK-1876~~: Make Superpowers load reliably across local agent harnesses (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (filed and verified 2026-06-18) | **Depends on**: TASK-1823, TASK-1825, TASK-1826, TASK-1836

**Why**: The FlowState-safe Superpowers router proved useful, but the original Superpowers plugin model requires each agent harness to install or expose skills separately. Codex already sees the project wrappers, while Claude Code and OpenCode need explicit verification so future sessions do not silently miss the router. Keep the solution context-safe: install/expose per harness, keep the FlowState router as the entrypoint, and prove fresh-session behavior with smoke checks instead of loading long upstream instructions into every prompt.

**Acceptance**:
- Codex reports `superpowers@openai-curated` installed/enabled and fresh read-only Codex sessions use `superpowers-flowstate-auto-router`.
- Claude Code has a Superpowers plugin installed or an explicit documented blocker.
- OpenCode exposes the FlowState Superpowers wrappers through its configured skill paths.
- Verification is repeatable with a compact repo script and does not add verbose always-on prompt text.

**Progress**:
- 2026-06-18: Added `scripts/verify-superpowers-routing.sh`, `npm run verify:superpowers` for context-safe static harness checks, and `npm run verify:superpowers:smoke` for fresh Codex routing smokes when model quota is available.
- 2026-06-18: Installed Claude Code `superpowers@claude-plugins-official` (`6.0.2`), re-added Codex `superpowers@openai-curated` from the local curated snapshot (`015c0dff`), verified OpenCode exposes the FlowState wrapper skill paths, and kept the Claude session-start reminder to two short FlowState-router lines to avoid context bloat.
- 2026-06-18: Static `npm run verify:superpowers` passed. Earlier full fresh-smoke verification showed Codex planning and bug/fix prompts both reporting `Skills used: superpowers-flowstate-auto-router`; a later rerun of `npm run verify:superpowers:smoke` was blocked by Codex account usage limits before the first smoke completed.

### ~~BUG-1872~~: Task description "keeps resetting" while editing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-17) — fixed at state layer + regression test (branch task-1871-canvas-sync-stability). **Data loss confirmed**: the user's typed description for task `ad1ea052…` was wiped client-side before autosave ever persisted it — every prod backup (10:00 & 17:00 UTC) shows the description already empty (row untouched since 2026-06-16), so it was unrecoverable.

**Why**: The TipTap editor stores markdown but renders HTML, round-tripping `htmlToMarkdown(parseMarkdown(md))` on every autosave echo. That hand-rolled regex converter (`src/utils/markdown.ts`) is **not byte-stable** (proven: `- a\n\n- b` → `- a\n\n\n- b` grows a newline each pass). Chain: autosave → `markCurrentTaskSaved()` clears `isFormDirty` → the `props.task` watcher's dirty-guard (`useTaskEditState.ts`) no longer blocks → an echo of our own save (description differing only by normalization) overwrites `editedTask.description` → `MarkdownEditor` modelValue changes → TipTap `setContent` wipes in-progress typing. Re-surfaced on this branch because the canvas-sync work re-enabled realtime echoes that ride the `props.task` update path.

**Fix**: While the modal owns this task (`props.isOpen && editedTask.id === newTask.id`), the in-editor description is authoritative — the incoming `props.task` description is pinned to the editor's value so echoes/autosave round-trips can never reset it (`useTaskEditState.ts`). Other fields still update from echoes. Root-cause (lossy converter) tracked separately as TASK-1873.

**Tests**: `src/composables/tasks/__tests__/useTaskEditState.descriptionReset.test.ts` (RED→GREEN verified: fails without the guard, passes with it). `src/utils/__tests__/markdownRoundtrip.test.ts` documents converter stability contract + the known list-drift skip for TASK-1873.

### ~~TASK-1873~~: Replace lossy regex markdown converter with a real serializer (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-17) — editor moved onto `tiptap-markdown@0.9.0`; guard pile collapsed to one fallback; single local-draft durability fallback added; backup coverage asserted. Typecheck clean; 19 unit/integration + 1 e2e green. | **Depends on**: BUG-1872 (state-layer guard already shipped)

**Shipped**:
- `TiptapEditor.vue` now parses/serializes through the real `tiptap-markdown` extension (`editor.storage.markdown.getMarkdown()`); removed `parseMarkdown`/`htmlToMarkdown` from the edit path. The guard pile (`isInternalUpdate`, `lastEmittedMarkdown`, HTML-diff) collapsed to **one** guard: ignore an incoming value equal to the editor's current markdown.
- **Single durability fallback** (`useTaskEditState.ts`): in-progress description persisted to `localStorage` (`flowstate:desc-draft:<id>`) the instant it changes, restored on reopen if the app died pre-save (read as dirty so autosave re-persists), cleared on confirmed save. Exactly one fallback, no second path.
- **Backup coverage**: `backupPreservesDescription.test.ts` asserts the local-backup task transform keeps `description`. VPS pg_dump already includes it (confirmed).
- Tests: `tiptapMarkdownRoundtrip.test.ts` (8 idempotency cases incl. lists/Hebrew), `useTaskEditState.descriptionReset.test.ts` (reset guard + draft restore/clear), `markdownRoundtrip.test.ts` (legacy regex documented), `task-description-roundtrip.spec.ts` (real-app e2e).

_Original plan below._

**Priority**: P2 | **Status**: ✅ DONE (filed 2026-06-17) | **Depends on**: BUG-1872 (state-layer guard already shipped)

**Why**: `src/utils/markdown.ts` (`parseMarkdown` via marked + a hand-rolled regex `htmlToMarkdown`) is the root of a class of editor bugs. It is not idempotent, so editor↔store round-trips drift (BUG-1872 list-newline growth is one instance). `TiptapEditor.vue` has accreted guard-on-guard scar tissue to paper over it: `isInternalUpdate`, `lastEmittedMarkdown`, the 150ms debounce, and markdown-vs-markdown comparison (BUG-013, BUG-014, BUG-276). Each guard exists only because the converter is unstable.

**Goal**: Keep markdown as the storage format (board, AI, search depend on it) but replace the regex with a real serializer (`tiptap-markdown@0.9.0`, peer `@tiptap/core ^3.0.1` — compatible; `prosemirror-markdown` already present) so `editor ↔ markdown` is byte-stable and idempotent. Collapse the guard pile in `TiptapEditor.vue` down to **exactly one fallback** path.

**Durability requirements (user, 2026-06-17 — "this can't get lost again"):**
- **Can't-lose-again**: in-progress description text must survive a reset, failed save, crash, or reload. Persist a local draft (keyed by task id) the moment the user types; restore it on reopen; clear it only after a confirmed successful save.
- **Exactly one fallback**: ONE durable fallback layer, not the current stack of guards (`isInternalUpdate`, `lastEmittedMarkdown`, debounce-vs-watch juggling) nor multiple competing draft stores. One serializer + one local-draft fallback. If the serializer ever throws, the single fallback is "treat content as plain text" — no second regex path.
- **Backup reliably captures it**: the description column must be provably present in BOTH (a) the VPS pg_dump (confirmed — full dump includes `description`) and (b) the app's local auto-backup payload. Add a regression test asserting the local-backup task payload includes `description` so a future field-completeness regression can't silently drop it (the BUG-1872 data loss was never-saved; this guards the saved-but-not-backed-up case).

**Acceptance**:
- `htmlToMarkdown(parseMarkdown(md)) === md` for plain text, Hebrew/RTL, multi-paragraph, **bullet/numbered/task lists**, tables, highlights, links, bold/italic/strike (un-skip the TASK-1873 case in `markdownRoundtrip.test.ts`).
- Existing stored descriptions (authored by the old regex) render without visible change — verify a sample against prod before/after; migration only if needed.
- Editor guards collapsed to one fallback; no editor reset, cursor-jump, or RTL regression (Playwright proof on real seeded data).
- Local-draft fallback restores unsaved text after a forced reload; test covers it.
- Backup payload test asserts `description` is present.
- Do under deliberate test coverage, not under bug pressure.

### BUG-1870: Electron update/restart can show Sign In while authenticated cache still exists (🔄 IN PROGRESS)

**Priority**: P0-CRITICAL | **Status**: 🔄 IN PROGRESS (filed 2026-06-16) | **Depends on**: none

**Why**: After an Electron update/restart, FlowState can render cached authenticated tasks and canvas state while the sidebar auth state falls back to `Sign In`. The earlier BUG-1865 fix preserved cached data when auth restore missed, but it did not preserve the signed-in shell itself when Electron's disk-backed auth backup restored yet Supabase still reported no session, or when an expired session could not refresh immediately during restart.

**Acceptance**:
- Electron startup restores a signed-in shell from the disk-backed auth backup even if Supabase has not rehydrated the primary session yet.
- Expired startup sessions that fail to refresh immediately enter reconnect/offline grace instead of clearing `user`/`session`.
- Explicit user sign-out remains the only destructive path that clears auth backups and private local stores.
- The Electron Local Task API/KDE bridge does not receive expired reconnect-grace JWTs; it clears the stale sidecar token, retries refresh, and republishes the fresh session when recovery succeeds.
- Desktop fix ships through the versioned Electron updater flow.

**Progress**:
- 2026-06-16: Added RED regressions for Electron backup restore returning a recoverable session while Supabase still reports null, and expired-session startup refresh failure keeping the signed-in shell.
- 2026-06-16: Changed the auth backup restore contract to return the recovered session snapshot and keep reconnect-grace auth state instead of showing `Sign In`; guarded the Local API bridge from forwarding expired JWTs.
- 2026-06-16: Added the missing Electron/KDE recovery regression: reconnect grace retries session refresh and republishes the fresh token to the Electron Local API bridge. Verification: `npm run test -- tests/unit/electron/local-api-lifecycle.test.ts tests/unit/local-api/server-contract.test.ts tests/unit/kde/timer-sync.test.ts tests/unit/kde/auth-flow.test.ts tests/unit/stores/auth-flow.test.ts tests/unit/composables/useLocalApiBridge.test.ts` passed 105/105.
- 2026-06-16: Local quality gates passed: `npm run type-check`, `npm run lint`, and `npm run electron:build`. Built local updater artifacts for `1.4.185`: `FlowState-1.4.185-x86_64.AppImage` 180171005 bytes, `FlowState_1.4.185_amd64.deb` 131222200 bytes, `latest-linux.yml` 548 bytes.
- 2026-06-16: Updater VPS directory creation succeeded, but artifact upload/deploy is blocked in this Codex session by the sandbox escalation usage limit. The fix is committed-ready but not yet public on `https://in-theflow.com/updates/electron/latest-linux.yml`.
- 2026-06-18: Added the Electron sync regression sentinel `npm run guard:electron-sync` and wired `scripts/deploy-electron-update.sh` to run it before `npm run electron:build`/upload unless explicitly skipped. Guard coverage includes auth restart recovery, sync orchestrator backpressure, queue-authoritative task/group writes, delete/undo resurrection, Supabase delete contracts, and canvas local-first readiness.

### ~~BUG-1869~~: Skipped realtime task updates can leave Electron, localhost, and KDE out of sync (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed and shipped 2026-06-15) | **Depends on**: none

**Why**: The previous timer-specific fix did not cover the larger sync class. Task edits add a pending-write guard to block stale realtime echoes, but the sync queue was not clearing that guard after successful task writes. Realtime task updates skipped during pending writes, interaction locks, or database loads also had no replay path for non-delete events. That could leave one runtime stuck on local state while the shared Supabase state, localhost, and KDE moved ahead.

**Acceptance**:
- Successful queued task sync clears the task pending-write guard instead of waiting for the five-minute safety timeout.
- Realtime task events skipped because of pending writes, interaction locks, or database loading invalidate cache and schedule a recovery reload.
- Delete recovery still works through the same recovery path.
- Desktop fix ships through the versioned Electron updater flow.

**Progress**:
- 2026-06-15: Added RED regressions for successful queued task sync clearing the pending-write guard and skipped non-delete realtime task events scheduling recovery reload instead of being dropped.
- 2026-06-15: Cleared task pending-write guards on successful sync queue completion and routed skipped task realtime events through a shared cache invalidation/reload helper across the primary, post-login, and workspace-switch realtime handlers.
- 2026-06-15: Verified widened sync/timer/KDE regression suite passes 178/178 tests, plus type-check and lint.
- 2026-06-15: Shipped desktop updater `1.4.184`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.184`. `FlowState-1.4.184-x86_64.AppImage` returns HTTP 200 with `content-length: 180171158`, and `FlowState_1.4.184_amd64.deb` returns HTTP 200 with `content-length: 131222324`.

### ~~BUG-1868~~: Timer start can look active locally while Electron, localhost, and KDE see no synced session (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed and shipped 2026-06-15) | **Depends on**: none

**Why**: Starting a task timer must create an active `timer_sessions` row before the local Electron UI claims the timer is running. If the initial Supabase write fails because the auth token/session is stale or the network rejects the write, the previous path could leave `currentSession` active locally while the Electron sidecar and KDE widget still return no active timer. That creates the exact cross-runtime split the user reported: Electron appears to start a task, but localhost and KDE have nothing to sync.

**Acceptance**:
- `startTimer()` rolls back local active/leader state when the initial timer-session persistence write fails.
- Timer persistence failures propagate to callers after the sync error is recorded; they are not swallowed as false success.
- Existing timer state-machine, realtime backstop, Electron local API, and KDE widget wire-contract regressions pass.
- Desktop fix ships through the versioned Electron updater flow.

**Progress**:
- 2026-06-15: Reproduced the code-level false-success contract with `tests/unit/stores/timer-state-machine.test.ts -t "7b"`; RED showed `currentSession` stayed active after the write threw.
- 2026-06-15: Propagated `saveActiveTimerSession` failures and rolled back countdown, heartbeat, leadership, wake lock, and `currentSession` when `startTimer()` cannot persist the initial active session. Focused cross-runtime timer verification passes 65/65 tests.
- 2026-06-15: Shipped desktop updater `1.4.183`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.183`. `FlowState-1.4.183-x86_64.AppImage` returns HTTP 200 with `content-length: 180171239`, and `FlowState_1.4.183_amd64.deb` returns HTTP 200 with `content-length: 131222188`.

### BUG-1865: Preserve cached authenticated tasks on transient startup auth restore miss (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-13, shipped 2026-06-13) | **Depends on**: none

**Why**: A severe desktop regression showed FlowState appearing signed out and rendering an empty Canvas/All Active view even though the Electron profile still had a valid persisted Supabase session and IndexedDB task/cache state. Startup was treating a passive auth restore miss like an explicit sign-out, clearing authenticated task/project/canvas/workspace state and the read cache before auth could recover.

**Acceptance**:
- Passive startup auth misses preserve already-loaded authenticated IndexedDB task, project, and canvas cache instead of clearing stores or read cache.
- Explicit user sign-out remains the only destructive auth path that clears authenticated stores and IndexedDB read cache.
- Cacheless unauthenticated startup still loads guest-local data normally.
- Regression coverage rejects the old startup contract that cleared authenticated read cache on passive auth miss.
- Electron-facing verification includes focused tests and an Electron build before release.

**Progress**:
- 2026-06-13: Reproduced the bad contract with `tests/unit/ai-chat-startup-sync.test.ts`; the RED test failed because app initialization still expected `[AUTH] No restored session; clearing authenticated read cache from signed-out view`.
- 2026-06-13: Fixed app initialization so a passive auth restore miss preserves usable authenticated IndexedDB task/project/canvas cache while explicit sign-out remains destructive.
- 2026-06-13: Verified focused regressions with `npm run test -- tests/unit/ai-chat-startup-sync.test.ts tests/unit/stores/auth-flow.test.ts` (30/30 passed), `npm run type-check`, `npm run lint`, and Electron package validation.
- 2026-06-13: Shipped desktop updater `1.4.166`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.166` with `FlowState-1.4.166-x86_64.AppImage` and `FlowState_1.4.166_amd64.deb`.

### ~~BUG-1866~~: Malformed due date crashes Calendar view in Electron (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed and shipped 2026-06-15) | **Depends on**: none

**Why**: Opening Calendar could throw `RangeError: Invalid time value` from the packaged `CalendarView` chunk. The exact minified offset mapped to `CalendarTaskCard.formatDueDateLabel()`, where a malformed or legacy `task.dueDate` reached `Intl.DateTimeFormat.format(new Date(value))` without validation and crashed the full view.

**Acceptance**:
- Calendar inbox cards tolerate malformed due-date values without throwing.
- Invalid due dates do not render a misleading date badge.
- Valid local `YYYY-MM-DD` and legacy ISO due dates retain the existing overdue/today/future behavior.
- A component-level regression reproduces the packaged render crash before the fix.
- The desktop fix ships through a versioned Electron updater release.

**Progress**:
- 2026-06-15: Added RED/green component regression `tests/unit/components/calendar-task-card-invalid-due-date.test.ts`. The RED run reproduced `RangeError: Invalid time value`; the green run passes after normalizing the value with the existing `normalizeDueDate()` utility and omitting the badge when normalization fails.
- 2026-06-15: Focused calendar tests pass (19/19), `npm run type-check`, `npm run lint`, `git diff --check`, and the canonical Electron build/package validation pass.
- 2026-06-15: Shipped desktop updater `1.4.181`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.181`. `FlowState-1.4.181-x86_64.AppImage` returns HTTP 200 with `content-length: 180167072`, and `FlowState_1.4.181_amd64.deb` returns HTTP 200 with `content-length: 131220680`.
- 2026-06-15: Expanded the component regression to reject impossible date-shaped values (`2026-99-99`, `2026-02-30`, and invalid ISO prefixes) while preserving valid local-date and legacy ISO behavior. Focused component/timezone verification passes 22/22 tests; commit `942624d4` is pushed to `origin/master`.

### ~~BUG-1867~~: Canvas geometry drifts across Electron and localhost while idle (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed and shipped 2026-06-15) | **Depends on**: none

**Why**: Electron and localhost use the same Supabase backend, but each runtime has its own IndexedDB read cache and pending-write queue. Startup and background refresh replayed field-level pending updates through full-row Supabase mappers, so a title/status/reminder update could inject mapper defaults such as missing `canvasPosition`, `parentId`, group `position`, or reset `positionVersion`. Separately, group moves queued the post-move position version as their optimistic-lock base, causing immediate conflicts and last-write-wins fallback. Together these paths made layouts diverge or appear to move without the Canvas being open.

**Acceptance**:
- Replaying a non-geometry pending task update preserves cached task position, parent, and position version.
- Replaying a non-geometry pending group update preserves cached group position, parent, and position version.
- Startup/background pending-write replay uses the same selective patch contract as cache-first startup.
- Group moves enqueue the server's pre-move position version as `baseVersion`.
- Existing canvas geometry, sync orchestrator, conflict-resolution, and smart-merge regression suites pass.
- The fix ships through a versioned Electron updater release.

**Progress**:
- 2026-06-15: Added RED/green cache regressions proving partial task/group updates previously erased geometry during pending-write replay.
- 2026-06-15: Added RED/green group move regression proving the queue previously sent post-move `baseVersion: 5` when the server expected pre-move version `4`.
- 2026-06-15: Introduced selective Supabase-payload patch helpers and reused them in both IndexedDB startup merge and background refresh replay. Wider canvas/sync verification passes 179/179 tests; `npm run type-check`, `npm run lint`, and `git diff --check` pass.
- 2026-06-15: Canonical Electron build/package validation passes for `1.4.182`. Shipped the updater after explicit authorization; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.182` with matching local/public hashes and sizes. `FlowState-1.4.182-x86_64.AppImage` returns HTTP 200 with `content-length: 180171129`, and `FlowState_1.4.182_amd64.deb` returns HTTP 200 with `content-length: 131221332`.
- 2026-06-16: Added generated patch-invariant coverage over the actual task/group pending-write allowlists. The new guard iterates every non-geometry patch field and proves it cannot mutate canvas geometry/topology/version; focused verification passes 133/133 tests plus `npm run type-check`.

### TASK-1855: AI action command substrate with preview, apply, undo, and audit trail (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-13, completed 2026-06-14) | **Depends on**: TASK-1854

**Why**: Every useful bot feature eventually wants to change tasks, lanes, calendar blocks, canvas layout, or memory. Before adding more agentic features, FlowState needs a shared safety layer so AI actions are staged, inspectable, reversible, idempotent, duplicate-aware, and observable. The immediate motivating failure is the weekly-plan follow-up path creating repeated real child tasks like `מעקב: <source task title>`, but the fix must cover the wider class of repeated applies, stale persisted cards, background retries, and future planner/organizer/canvas/calendar agent writes.

**Acceptance**:
- Define a typed AI command/diff model for task, lane, calendar, canvas, focus, and memory proposals.
- Define an AI action identity/fingerprint model using action kind, source message/run, target entity, normalized payload, and scope.
- AI-generated changes can be rendered as a preview before mutation.
- Repeated applies of the same AI action are idempotent: double-clicks, retries, stale cards, and hydration replays reuse or skip existing effects instead of creating another entity.
- Semantic duplicate checks exist for AI-created tasks, subtasks/follow-ups, lanes/groups, calendar/focus blocks, and memory/feedback events.
- Weekly-plan `add_followup` is the first consumer: if an active follow-up already exists for the same parent/source task, the UI reports/reuses that task by default instead of creating another `מעקב:` / `Follow up:` child.
- Applying a proposal routes through existing store/service APIs, not direct hidden writes.
- Applied proposals create an audit entry with source prompt, data used, commands applied, rejected commands, timestamp, and rollback pointer.
- Undo/rollback restores the pre-AI state for the applied command batch.
- Low-confidence or high-impact proposals are blocked from auto-apply and require explicit approval.
- Manual task/project/lane/calendar/canvas creation remains unchanged; duplicate prevention is scoped to AI/proposal/tool writes.

**Relevant context**:
- Reuse existing task/lane/project stores and undo patterns where possible.
- This lane is the foundation for every later lane; do not build one-off apply buttons that bypass it.
- Treat "reuse existing" as the default duplicate behavior. Creating another anyway must require explicit secondary user intent.
- Regression coverage should prove preview-only proposals do not mutate state, apply mutates only selected commands, repeated apply is idempotent, stale cards do not duplicate work, semantic duplicates are reused/skipped, manual duplicate creation still works, and rollback restores state.

**Progress**:
- 2026-06-13: Shipped the first duplicate-aware weekly-plan `add_followup` consumer. `ChatMessage` now detects an existing active same-title follow-up under the same parent task, tells the user it already exists, opens/reuses that task by default, and creates another only after explicit duplicate override. Regression coverage added for default duplicate blocking and explicit duplicate creation. Released via Electron updater `1.4.164`; public `latest-linux.yml`, AppImage, and deb artifact checks passed.
- 2026-06-13: Extracted the first shared AI action guardrail in `src/services/ai/actionGuardrails.ts` for task/subtask create identity fingerprints and semantic duplicate decisions. `create_task` now reuses an existing active same-title/due-date AI-created target instead of duplicating on double-click/retry/stale-card replay; `create_subtasks` skips existing active same-title subtasks under the parent. Weekly-plan follow-up duplicate detection now calls the shared helper while preserving the explicit "create another" override. Regression proof: `npm run test -- tests/unit/ai-tools-execution.test.ts`, `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "weekly follow-up"`, `npm run type-check`, `npm run lint`, Electron build/package validation, and updater deployment `1.4.167` verified via `https://in-theflow.com/updates/electron/latest-linux.yml`; public artifacts returned HTTP 200 with `FlowState-1.4.167-x86_64.AppImage` `content-length: 180158732` and `FlowState_1.4.167_amd64.deb` `content-length: 262430300`.
- 2026-06-13: Added the first reusable preview/apply command batch substrate in `src/services/ai/actionCommands.ts`, exported from `src/services/ai/index.ts`. It supports task and subtask create proposals with typed previews/diffs, selected-command apply, low-confidence/high-impact approval blocking, semantic duplicate reuse during apply, local audit trail entries with source prompt/run/message/data plus applied/rejected commands, and rollback pointers that restore the pre-AI task state. Regression proof: `npm run test -- tests/unit/ai-action-command-substrate.test.ts`, `npm run test -- tests/unit/ai-tools-execution.test.ts`, `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.168`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.168`, `FlowState-1.4.168-x86_64.AppImage` returns HTTP 200 with `content-length: 180158867`, and `FlowState_1.4.168_amd64.deb` returns HTTP 200 with `content-length: 131214884`.
- 2026-06-13: Backed the AI command audit trail with a Dexie IndexedDB store in `src/services/ai/actionCommandAuditStore.ts` while preserving the existing localStorage fallback for the synchronous reader. Applied batches now durably persist audit entries and rollback snapshots; `loadAICommandAuditTrail()` supports future command-center queries by batch/source run/source message, and rollback can restore from IndexedDB after localStorage is cleared. Regression proof: RED/green `tests/unit/ai-action-command-substrate.test.ts`, `npm run test -- tests/unit/ai-tools-execution.test.ts`, `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.169`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.169`, `FlowState-1.4.169-x86_64.AppImage` returns HTTP 200 with `content-length: 180158864`, and `FlowState_1.4.169_amd64.deb` returns HTTP 200 with `content-length: 131215464`.
- 2026-06-13: Extended the command substrate beyond tasks with the first `lane.create` command family. `actionGuardrails.ts` now builds lane identities/fingerprints and reuses existing active same-name lanes; `actionCommands.ts` previews lane diffs, applies selected lane creates through `useLaneStore.createLane`, reuses semantic duplicates on replay, stores lane snapshots in rollback records, and deletes/restores lanes during rollback. Regression proof: RED/green `tests/unit/ai-action-command-substrate.test.ts`, `npm run test -- tests/unit/ai-tools-execution.test.ts`, `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.170`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.170`, `FlowState-1.4.170-x86_64.AppImage` returns HTTP 200 with `content-length: 180154704`, and `FlowState_1.4.170_amd64.deb` returns HTTP 200 with `content-length: 131215400`.
- 2026-06-13: Added the first calendar/focus command family with `calendar.schedule_task`. `actionGuardrails.ts` now builds calendar scheduling identities/fingerprints from task/date/time/duration scope and reuses an existing active matching task instance; `actionCommands.ts` previews calendar diffs, applies selected schedules through `taskStore.createTaskInstance`, reuses same task/date/time/duration instances on replay, and relies on the task rollback snapshot to restore the pre-AI instance state. Regression proof: RED/green `tests/unit/ai-action-command-substrate.test.ts`, `npm run test -- tests/unit/ai-tools-execution.test.ts`, `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.171`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.171`, `FlowState-1.4.171-x86_64.AppImage` returns HTTP 200 with `content-length: 180158808`, and `FlowState_1.4.171_amd64.deb` returns HTTP 200 with `content-length: 131215376`.
- 2026-06-13: Added the first canvas command family with `canvas.group.create`. `actionGuardrails.ts` now builds canvas group identities/fingerprints and reuses existing active same-name canvas groups; `actionCommands.ts` previews canvas group diffs, applies selected groups through `useCanvasStore.createGroup`, reuses semantic duplicates on replay, stores canvas group snapshots in rollback records, and deletes/restores groups during rollback. `actionCommandAuditStore.ts` now JSON-normalizes Dexie payloads so reactive canvas diff objects remain durably storable. Regression proof: RED/green `tests/unit/ai-action-command-substrate.test.ts`, `npm run test -- tests/unit/ai-tools-execution.test.ts`, `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.172`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.172`, `FlowState-1.4.172-x86_64.AppImage` returns HTTP 200 with `content-length: 180158799`, and `FlowState_1.4.172_amd64.deb` returns HTTP 200 with `content-length: 131214876`.
- 2026-06-13: Added the first canvas layout/move command family with `canvas.node.move`. `actionGuardrails.ts` now builds task/group canvas move identities/fingerprints from node type, node id, normalized geometry, and parent scope; `actionCommands.ts` previews `canvas_layout` diffs, applies task moves through `taskStore.updateTask`, applies group moves through `useCanvasStore.updateGroup`, reuses already-applied moves on replay, and relies on task/canvas rollback snapshots to restore pre-AI geometry. Regression proof: RED/green `tests/unit/ai-action-command-substrate.test.ts` (19/19), `npm run test -- tests/unit/ai-tools-execution.test.ts` (8/8), `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.173`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.173`, `FlowState-1.4.173-x86_64.AppImage` returns HTTP 200 with `content-length: 180158864`, and `FlowState_1.4.173_amd64.deb` returns HTTP 200 with `content-length: 131215384`.
- 2026-06-13: Added memory/feedback command families with `memory.patch` and `memory.feedback.record`. `actionGuardrails.ts` now builds memory patch and recommendation feedback identities/fingerprints, detects already-applied memory facts, and reuses matching prior feedback events. `actionCommands.ts` previews `memory`/`memory_feedback` diffs, applies patches through `applyAIMemoryPatch`, records feedback through `recordAIRecommendationFeedback`, snapshots memory adapter state for rollback, and restores via the memory command adapter. Regression proof: RED/green `tests/unit/ai-action-command-substrate.test.ts` (22/22), `npm run test -- tests/unit/ai-tools-execution.test.ts tests/unit/ai-memory-pending-writes.test.ts` (34/34), `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.174`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.174`, `FlowState-1.4.174-x86_64.AppImage` returns HTTP 200 with `content-length: 180154812`, and `FlowState_1.4.174_amd64.deb` returns HTTP 200 with `content-length: 131215324`.
- 2026-06-13: Converted the first real non-test AI card consumer to the shared command substrate: `ChatMessage` inline and weekly recommendation feedback cards now build a `memory.feedback.record` command preview and apply it through `applyAICommandBatch` instead of calling `recordAIRecommendationFeedback` directly. Immediate card suppression/status behavior is preserved, but the write now creates the same audit/rollback command record path as tool-generated commands. Regression proof: RED/green `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "persists broad inline card postponement feedback outside weekly plans"`, `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "saves explicit weekly recommendation feedback"`, `npm run test -- tests/unit/ai-action-command-substrate.test.ts` (22/22), `npm run test -- tests/unit/ai-sidebar-first.test.ts` (81/81), `npm run type-check`, `npm run lint`, and localhost browser proof `npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "broad postpone feedback suppresses the same task"` (1/1). Hardened the Electron build wrapper so the managed sandbox can precompute npm's dependency tree for electron-builder before packaging. Shipped desktop updater `1.4.175`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.175`, `FlowState-1.4.175-x86_64.AppImage` returns HTTP 200 with `content-length: 180166976`, and `FlowState_1.4.175_amd64.deb` returns HTTP 200 with `content-length: 131219492`.
- 2026-06-13: Converted `ChatMessage` weekly-question and clarification memory patches to the shared command substrate. The weekly option/free-text memory patch path and response-quality clarification answer path now build `memory.patch` command previews and apply them through `applyAICommandBatch` instead of calling `applyAIMemoryPatch` directly. Regression proof: RED/green `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "continues immediately after a button-only response-quality clarification"`, `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "keeps first-answer free text as explicit evidence"`, `npm run test -- tests/unit/ai-action-command-substrate.test.ts` (22/22), `npm run test -- tests/unit/ai-sidebar-first.test.ts` (81/81), `npm run type-check`, `npm run lint`, and localhost browser proof `npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "weekly planning asks first"` (1/1). Direct-write audit proof: `rg -n "applyAIMemoryPatch\\(|recordAIRecommendationFeedback\\(" src/components/ai/ChatMessage.vue src/services/ai/tools.ts` returns no matches. Shipped desktop updater `1.4.176`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.176`, `FlowState-1.4.176-x86_64.AppImage` returns HTTP 200 with `content-length: 180167194`, and `FlowState_1.4.176_amd64.deb` returns HTTP 200 with `content-length: 131218888`.
- 2026-06-14: Converted `ChatMessage` smart-lane apply from direct lane/task writes to command batches. Added the `task.update` command family for AI-owned metadata changes, extended `task.create` previews/applies with `laneId`, and now apply smart-lane lane creation, existing-task lane assignment, and suggested task creation through `buildAICommandBatchPreview` + `applyAICommandBatch` instead of direct `laneStore.createLane`, `createTaskWithUndo`, and `bulkUpdateTasksWithUndo` calls from the card handler. Regression proof: RED/green `npm run test -- tests/unit/ai-action-command-substrate.test.ts -t "applies AI task metadata updates"`, RED/green `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "applies smart-lane cards through command batches"`, `npm run test -- tests/unit/ai-action-command-substrate.test.ts` (23/23), `npm run test -- tests/unit/ai-sidebar-first.test.ts` (82/82), `npm run type-check`, `npm run lint`, direct-write audit `rg -n "laneStore\\.createLane\\(|createTaskWithUndo\\(|bulkUpdateTasksWithUndo\\(|taskStore\\.createTask\\(|taskStore\\.updateTask\\(|taskStore\\.deleteTask\\(|canvasStore\\.createGroup\\(" src/components/ai/ChatMessage.vue src/services/ai/tools.ts` (no remaining smart-lane direct writes in `ChatMessage`; remaining hits are `src/services/ai/tools.ts` plus separate ChatMessage day-plan/follow-up undo paths), and localhost browser proof `npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "Suggest smart lanes for my current tasks"` (1/1 clarification path). Authenticated smart-lane apply E2E `npx playwright test tests/e2e/ai-react-cards.spec.ts --grep "smart-lane prompt"` was blocked by missing `SUPABASE_SERVICE_ROLE_KEY` global setup in this sandbox. Shipped desktop updater `1.4.177`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.177`, `FlowState-1.4.177-x86_64.AppImage` returns HTTP 200 with `content-length: 180167270`, and `FlowState_1.4.177_amd64.deb` returns HTTP 200 with `content-length: 131219200`.
- 2026-06-14: Converted `src/services/ai/tools.ts` write tools to the shared command substrate. Added the `task.delete` command family and routed AI tool create/update/delete writes through `task.create`, `task.update`, `task.delete`, `task.subtask.create`, and `canvas.group.create` command batches instead of direct `taskStore`/`canvasStore` mutations from `executeTool`. Covered `create_group`, `create_task`, `update_task_status`, `update_task`, `assign_task_to_project`, `set_task_due_date`, `bulk_update_status`, `mark_task_done`, `create_subtasks`, and confirmed `delete_task`; unconfirmed delete still returns before mutation. Regression proof: RED/green `npm run test -- tests/unit/ai-tools-execution.test.ts -t "routes task mutation tools through AI command batches"`, RED/green `npm run test -- tests/unit/ai-tools-execution.test.ts -t "routes create task and create group tools through AI command batches"`, RED/green `npm run test -- tests/unit/ai-tools-execution.test.ts -t "routes create_subtasks through an AI command batch"`, RED/green `npm run test -- tests/unit/ai-tools-execution.test.ts -t "requires explicit confirmation before destructive task deletion"`, `npm run test -- tests/unit/ai-tools-execution.test.ts` (11/11), `npm run test -- tests/unit/ai-action-command-substrate.test.ts` (23/23), `npm run type-check`, `npm run lint`, and direct-write audit `rg -n "taskStore\\.createTask\\(|taskStore\\.updateTask\\(|taskStore\\.createSubtask\\(|taskStore\\.deleteTask\\(|canvasStore\\.createGroup\\(" src/services/ai/tools.ts` returns no matches. Shipped desktop updater `1.4.178`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.178`, `FlowState-1.4.178-x86_64.AppImage` returns HTTP 200 with `content-length: 180167203`, and `FlowState_1.4.178_amd64.deb` returns HTTP 200 with `content-length: 131220020`.
- 2026-06-14: Converted the two remaining audited `ChatMessage` AI card write paths to the shared command substrate. Weekly follow-up explicit duplicate override now uses a `task.create` command with `allowDuplicate: true` instead of `createTaskWithUndo`, preserving the required secondary intent while still recording preview/apply/audit state. Day-plan apply now maps planned task placements to `task.update` commands instead of `bulkUpdateTasksWithUndo`, with task update fields extended to cover canvas/day-plan placement metadata. Regression proof: RED/green `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "creates another weekly follow-up only after the explicit duplicate override"`, RED/green `npm run test -- tests/unit/ai-sidebar-first.test.ts -t "applies day-plan cards through command batches"`, `npm run test -- tests/unit/ai-action-command-substrate.test.ts` (23/23), `npm run test -- tests/unit/ai-sidebar-first.test.ts` (83/83), `npm run type-check`, `npm run lint`, `git diff --check`, and direct-write audit `rg -n "laneStore\\.createLane\\(|createTaskWithUndo\\(|bulkUpdateTasksWithUndo\\(|taskStore\\.createTask\\(|taskStore\\.updateTask\\(|taskStore\\.createSubtask\\(|taskStore\\.deleteTask\\(|canvasStore\\.createGroup\\(" src/components/ai/ChatMessage.vue src/services/ai/tools.ts` returns no matches. Shipped desktop updater `1.4.179`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.179`, `FlowState-1.4.179-x86_64.AppImage` returns HTTP 200 with `content-length: 180171218`, and `FlowState_1.4.179_amd64.deb` returns HTTP 200 with `content-length: 131220248`.
- 2026-06-14: Completed the final TASK-1855 acceptance audit and filled the explicit focus gap. Added `focus.timer.start` and `focus.timer.stop` command families with preview diffs, identity/fingerprint duplicate checks, selected apply through `useTimerStore`, audit snapshots, and rollback for the pre-AI timer state. Routed AI `start_timer` and `stop_timer` tools through command batches instead of direct timer store mutation. Stabilized replay reporting for AI-created subtasks when store-generated subtask ids collide within the same millisecond by matching skipped existing subtasks by normalized command title before id. Acceptance audit now covers task/subtask create/update/delete, lane create, calendar schedule, focus timer start/stop, canvas group create/node move, memory patch, and recommendation feedback; real `ChatMessage` recommendation feedback, memory patch, smart-lane, weekly follow-up override, day-plan, and AI tool consumers route through the substrate. Intentionally out of scope: normal user/manual writes and internal memory adapter persistence after a `memory.patch` command applies. Regression proof: RED/green `npm run test -- tests/unit/ai-action-command-substrate.test.ts -t "focus timer starts"`, RED/green `npm run test -- tests/unit/ai-action-command-substrate.test.ts -t "focus timer stops"`, RED/green `npm run test -- tests/unit/ai-tools-execution.test.ts -t "focus timer starts"`, RED/green `npm run test -- tests/unit/ai-tools-execution.test.ts -t "focus timer stops"`, `npm run test -- tests/unit/ai-action-command-substrate.test.ts` (25/25), `npm run test -- tests/unit/ai-tools-execution.test.ts` (13/13), `npm run type-check`, `npm run lint`, `git diff --check`, direct-write audit `rg -n "laneStore\\.createLane\\(|createTaskWithUndo\\(|bulkUpdateTasksWithUndo\\(|taskStore\\.createTask\\(|taskStore\\.updateTask\\(|taskStore\\.createSubtask\\(|taskStore\\.deleteTask\\(|canvasStore\\.createGroup\\(|timerStore\\.startTimer\\(|timerStore\\.stopTimer\\(" src/components/ai/ChatMessage.vue src/services/ai/tools.ts` returns no matches, broader AI write audit over `src/services/ai`, AI components, and AI composables returns no direct task/lane/canvas/memory writes outside `actionCommands.ts`, and the timer audit shows only command-substrate internals mutate `timerStore.startTimer`/`timerStore.stopTimer`. Built and shipped desktop updater `1.4.180`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.180`, `FlowState-1.4.180-x86_64.AppImage` returns HTTP 200 with `content-length: 180171169`, and `FlowState_1.4.180_amd64.deb` returns HTTP 200 with `content-length: 131220976`.

**Next implementation cursor**:
- Start TASK-1856 next. Build the command-center UI around the real converted consumers and command audit records from TASK-1855 rather than a parallel proposal abstraction.
- The command-center surface should render/edit/reject selected commands from `buildAICommandBatchPreview`, show command diffs and `AIActionIdentity`/duplicate status, expose audit entries from `loadAICommandAuditTrail()`, and reuse rollback pointers for undo.
- Preserve TASK-1855 boundaries: manual user writes remain unchanged; new AI write consumers must add a typed command family or route through an existing one before mutating stores/services.

### TASK-1856: AI command center and agent progress UI (📋 PLANNED)

**Priority**: P0-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1855

**Why**: The bot needs a consistent visible surface for suggestions, command previews, step progress, confidence, "why", apply/edit/reject controls, and failure recovery. Otherwise each feature becomes a different ad hoc card.

**Acceptance**:
- Chat/sidebar can render AI proposal cards backed by the shared command substrate.
- Multi-step agent runs show visible progress: reading context, building proposal, validating, waiting for approval, applying, verifying.
- Users can edit/reject individual proposed commands before apply.
- Every suggestion exposes "why this" with concrete sources such as task metadata, calendar slots, memory facts, focus history, or explicit uncertainty.
- Failed agent steps show a recoverable status, not a stuck spinner.

**Relevant context**:
- This should replace single-purpose bot cards over time, not add another parallel UI system.
- The surface should support later proactive cards like "3 risks detected" or "recommended focus block" without requiring a new component family.

### TASK-1857: Intake and messy-work organizer agent (📋 PLANNED)

**Priority**: P0-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1856

**Why**: A high-value bot can reduce task chaos: messy captures, vague tasks, duplicate tasks, canvas scraps, and unstructured notes should become clean projects, lanes, subtasks, or clarified next actions.

**Acceptance**:
- Bot can analyze selected inbox tasks, selected canvas nodes, or a pasted brain dump.
- It proposes clusters by theme, project, energy, deadline, risk, or workflow stage.
- It can propose deduplication, task decomposition, title cleanup, missing next actions, project/lane assignment, and archive/delete candidates.
- User can apply only selected clusters/changes.
- New task/lane creation uses the command substrate from TASK-1855.

**Relevant context**:
- This is broader than "smart lanes". Smart lanes become one mode inside the organizer: a clustering/apply workflow, not the whole product direction.
- Regression coverage should include apply-selected-only behavior, no mutation on preview, duplicate protection, and vague-task clarification fallback.

### TASK-1858: Daily and weekly planning agent (📋 PLANNED)

**Priority**: P0-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1856, TASK-1857

**Why**: FlowState already has weekly planning quality work, but the broader co-pilot should generate and revise practical plans from tasks, lanes, projects, calendar availability, focus capacity, memory, and user goals.

**Acceptance**:
- Bot can create a day plan or week plan with proposed task order, focus blocks, lane priorities, tradeoffs, and explicit dropped/deferred work.
- Plans show load/capacity warnings before apply.
- User can ask for variants: aggressive, conservative, energy-aware, deadline-first, deep-work-first, admin-batch.
- Plan apply can assign lanes, reorder tasks, create focus sessions/calendar blocks where supported, and record a decision journal entry.
- Replanning after a change explains what moved and why.

**Relevant context**:
- Build on the existing weekly planner reliability work rather than starting from scratch.
- Avoid generic "found N tasks" summaries; each plan needs concrete reasoning and bounded output.

### TASK-1859: Context-aware next-best-action engine (📋 PLANNED)

**Priority**: P0-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1858

**Why**: "What should I work on right now?" should be FlowState's sharpest bot feature. The answer should account for time, energy, deadline risk, calendar, task size, recent focus behavior, active lane, and user preferences.

**Acceptance**:
- Bot ranks a small set of next actions with concrete reasons and uncertainty.
- Recommendations include "do now", "if low energy", "if blocked", and "safe to ignore" options.
- User feedback such as accept, skip, too much, not now, or wrong reason updates future recommendations.
- The engine avoids repeated stale recommendations and explains when it lacks enough context.

**Relevant context**:
- This lane depends on plan quality but should remain usable outside formal daily/weekly planning.
- It should integrate with focus mode: starting a recommendation can begin a focused work session or create a short next action.

### TASK-1860: Calendar negotiation and focus-defense agent (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1858, TASK-1859

**Why**: Tools like Motion and Reclaim are valuable because they defend time, not because they chat. FlowState should propose calendar/focus changes while keeping the user in control.

**Acceptance**:
- Bot detects overcommitment, missing focus blocks, double-booking risks, and plan/calendar mismatch.
- Bot proposes reschedules and protected focus blocks with preview.
- User can set autonomy level: suggest only, auto-apply low-risk focus blocks, or require approval for all calendar changes.
- Existing calendar/manual planning flows remain unaffected if AI is disabled.

**Relevant context**:
- High-impact scheduling changes must stay human-approved until the command substrate proves rollback and conflict validation.
- This lane should feed signals back into next-best-action and planning.

### TASK-1861: Spatial canvas copilot (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1857, TASK-1858

**Why**: FlowState has a unique spatial surface. The bot should be able to "see" selected canvas regions and propose organization, links, clusters, dependencies, and visual layouts.

**Acceptance**:
- User can select a canvas region and ask the bot to organize, summarize, cluster, sequence, or extract tasks.
- Bot previews visual layout changes before applying.
- Suggestions can include grouping, lane creation, task decomposition, dependency links, archive candidates, and memory links.
- Visual explanations identify why nodes belong together.

**Relevant context**:
- Keep canvas layout changes reversible and scoped to selected regions.
- Avoid global canvas rewrites until selected-region flows are reliable.

### TASK-1862: Review, blocker, and risk radar agent (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1858, TASK-1859

**Why**: A personal chief of staff should notice slipping work, repeated deferrals, overloaded lanes, neglected goals, blocked projects, and mismatches between plan and execution.

**Acceptance**:
- Bot can generate end-of-day, weekly, and project-level reviews.
- Risk cards cite evidence: overdue tasks, repeated postponements, calendar density, missing next actions, stale lanes, or focus-session mismatch.
- Bot proposes mitigations such as defer, split, schedule, ask a blocker question, archive, or change lane priority.
- User can dismiss/snooze risks and the bot remembers that feedback.

**Relevant context**:
- This lane should not become nagging. Sensitivity, snooze, and explanation quality are part of acceptance.
- The review output should create learning signals for TASK-1863.

### TASK-1863: Personal memory and recommendation learning layer (📋 PLANNED)

**Priority**: P0-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1855, TASK-1862

**Why**: The bot becomes genuinely useful when it learns the user's chronotype, working preferences, recurring traps, rejected advice, successful planning patterns, project semantics, and decision history.

**Acceptance**:
- Memory stores preference facts, decision journal entries, repeated behavior patterns, accepted/rejected recommendations, and project-specific heuristics.
- User can inspect, correct, delete, or disable memory facts.
- Recommendations cite memory when used and show uncertainty when memory is stale or weak.
- Memory retrieval is bounded, prompt-injection-safe, and fail-open.

**Relevant context**:
- Build on existing AI memory work, but aim at product-visible personalization rather than schema completeness alone.
- Correction and deletion are core UX, not admin-only tooling.

### TASK-1864: User-defined safe automation agents (📋 PLANNED)

**Priority**: P1-HIGH | **Status**: 📋 PLANNED (filed 2026-06-13) | **Depends on**: TASK-1855, TASK-1860, TASK-1863

**Why**: Once command safety, planning, calendar/focus, and memory are reliable, users should be able to define recurring agents: weekly review, client follow-up, invoice workflow, content publishing, bug triage, or cleanup routines.

**Acceptance**:
- User can create a named automation with trigger, scope, allowed actions, autonomy level, review cadence, and circuit breakers.
- Automations can run in suggest-only mode before any auto-apply mode.
- Each run produces an audit log, applied command batch, skipped actions, and rollback path.
- "Pause all agents" is available globally.

**Relevant context**:
- This is intentionally last. Do not add background autonomous mutation before preview/apply/undo, calendar safety, and memory correction are proven.
- Start with templates before custom freeform automations.

### TASK-1854: Non-weekly AI bot action regression coverage and memory-substrate cursor correction (✅ DONE)

**Priority**: P0-HIGH | **Status**: ✅ DONE (filed 2026-06-13, completed 2026-06-13) | **Depends on**: TASK-1842

**Why**: Weekly-plan proof alone is not enough. The assistant also acts through FlowState tools and broad non-weekly prompts, so regressions in task creation, completion, subtask creation, destructive confirmation, ReAct card rendering, day-plan/smart-lane features, memory readiness, or broad clarification would still break the product even if weekly planning stayed green.

**Acceptance**:
- Live AI memory substrate readiness is re-verified and the stale "schema missing" lane cursor is corrected.
- Non-weekly bot action/tool behavior has focused regression coverage.
- Broad localhost chat proof covers weekly and non-weekly prompts before the next lane starts.

**Progress**:
- 2026-06-13: Added `tests/unit/ai-tools-execution.test.ts` for real AI tool execution against the task store: `create_task` rejects invalid dates and creates real tasks, `mark_task_done` accepts title fragments and default `list_tasks` hides done tasks, `create_subtasks` validates payloads and writes child rows, and `delete_task` requires explicit confirmation before mutating state.
- 2026-06-13: Re-verified live AI memory substrate with `npm run check:ai-memory-live-readiness` (`OK` for all six AI-memory tables through Supabase REST) and guarded `AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud` (probe rows inserted, read, and deleted successfully).
- 2026-06-13: Re-ran broad localhost chat proof with `npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts` → 22/22 passed. This covers weekly planning, Hebrew prompt variants, stream-hang fallback, old follow-up suppression, answer/escape continuation, feedback learning, mechanical overdue list, local memory debug, and targeted clarification/no-repeat behavior for prioritization, next-task, overdue triage, day planning, smart lanes, and task breakdown.
- 2026-06-13: `tests/e2e/ai-react-cards.spec.ts` was attempted to cover ReAct grouped cards/day-plan/smart-lane feature apply flows, but the default Playwright global setup requires `SUPABASE_SERVICE_ROLE_KEY`; keep that suite as the signed-in feature surface gate when service-role env is available.

### TASK-1853: Weekly planner regression coverage for activity and lane semantics (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-13, completed 2026-06-13) | **Depends on**: TASK-1852

**Why**: TASK-1852 shipped the real Electron fix, but two important guards were still too weak: weekly-plan activity scrubbing was protected mostly by source-shape assertions, and the narrowed FlowState semantic lane needed an explicit positive guard so real FlowState assistant reliability work still keeps its product lane.

**Completion proof (2026-06-13)**:
- Added behavior-level regression coverage for weekly-plan activity messages: English `Found N tasks`, English `Found N tasks matching ...`, English `Found N overdue tasks`, Hebrew `נמצאו N משימות`, Hebrew matching-task counts, and Hebrew overdue-task counts are scrubbed only for `week_plan` read activity.
- Added negative coverage that task-count messages remain unchanged outside weekly planning and for write activity.
- Exported the scrub helper as a pure tested display function and kept the live tool-activity path scoped by `activityTypeForTool(call.tool)`.
- Added a positive weekly-lane semantic regression proving real FlowState assistant reliability work still becomes `FlowState AI reliability` after removing bare generic `ai` matching.
- Verification: `npm test -- tests/unit/ai-chat-activity-message.test.ts tests/unit/ai-sidebar-first.test.ts` → 82/82 passed.
- Verification: `npm run type-check` → passed; `npm run electron:build` → passed and validated package metadata.
- Electron updater deployment verified at `https://in-theflow.com/updates/electron/latest-linux.yml` with `version: 1.4.160`; both `FlowState-1.4.160-x86_64.AppImage` and `FlowState_1.4.160_amd64.deb` returned HTTP 200.

### TASK-1852: Post-restart updater proof and AI chat quality continuation (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-12, completed 2026-06-13) | **Depends on**: TASK-1851

**Why**: TASK-1851 is shipped and proved in a signed-in packaged Electron debug session, but the next instance must resume from the same real-app verification path after restart. Do not lose the lesson from this session: demo fixtures and unit tests were insufficient; the decisive proof came from a headed, signed-in app flow with real task data.

**Resume snapshot**:
- Last completed commit: `15da970e Keep weekly lane subtitles from leaking buckets`.
- Shipped Electron updater version: `1.4.158`.
- Updater manifest proof: `https://in-theflow.com/updates/electron/latest-linux.yml` reports `version: 1.4.158`; AppImage and deb returned HTTP 200.
- Real signed-in packaged Electron proof screenshot: `/tmp/flowstate-1.4.158-electron-weekly-lanes.png`.
- Known local dirty file before restart: `stats.html` only; generated noise, do not commit unless intentionally regenerated.

**Required first actions after restart**:
1. Pull/rebase to `origin/master` and confirm the working tree contains no unexpected product-code drift.
2. Verify the updater manifest still serves `1.4.158`.
3. Verify the user-installed Electron app updates to, or is already running, `1.4.158`; do not rely only on the local build artifact if the user is checking the installed app.
4. Re-run a headed signed-in user flow against real tasks, not demo content.

**Headed real-app verification method to preserve**:
- If the normal installed app is hard to inspect, launch the packaged AppImage with Chromium remote debugging:
  `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs ./release/FlowState-1.4.158-x86_64.AppImage --no-sandbox --remote-debugging-port=9333 --class=flow-state`
- Attach Playwright over CDP to `http://127.0.0.1:9333`.
- Use DOM clicks where window-coordinate clicks are unreliable:
  `button[title^="AI Assistant"]` to open chat, `.header-btn.resize-btn` to widen/fullscreen.
- Inspect the real rendered DOM for:
  `[data-testid="weekly-lane-board"]`, `[data-testid="weekly-visual-lane"]`, `[data-testid="weekly-related-chip"]`, and absence of `.weekly-plan-cards`.

**Acceptance before moving on**:
- The prompt `תעזור לי לתכנן את שארית השבוע` in the signed-in app produces either a useful clarification card or a real visual weekly lane board.
- Wide/expanded chat shows horizontal lanes with readable cards, not a clipped carousel or stacked task list.
- There are no raw UUIDs, no `מבוסס על Work`, no `עבודה לא מסווגת`, and no generic `Work`/`My Projects` subtitle leaks.
- If the user already answered a prioritization clarification, the app does not ask the exact same question again without a new reason.
- Evidence is a screenshot plus DOM counts for lane boards, visual lanes, legacy weekly cards, generic labels, and lane widths.

**Completion proof (2026-06-13)**:
- Rebased from `origin/master`; only pre-existing dirty file was generated `stats.html`, stashed before rebase and kept out of the release commit.
- Live updater pre-check confirmed `https://in-theflow.com/updates/electron/latest-linux.yml` served `version: 1.4.158`; both `FlowState-1.4.158-x86_64.AppImage` and `FlowState_1.4.158_amd64.deb` returned HTTP 200.
- Installed `~/.local/bin/FlowState.AppImage` was byte-identical to `release/FlowState-1.4.158-x86_64.AppImage` before the fix.
- Fresh signed-in packaged Electron proof reproduced the next quality issue: the weekly lane board rendered, but the visible activity timeline still exposed raw `נמצאו 40 משימות`, and bare `ai` wording could over-trigger the FlowState reliability lane.
- Fix narrowed FlowState-AI semantic lane matching so generic AI-credit work no longer becomes `אמינות FlowState וה-AI`, and weekly-plan read activity now shows `נטענו מועמדים לתכנון השבוע` instead of raw `Found/Nמצאו N tasks` counts.
- Packaged Electron `1.4.159` proof screenshot: `/tmp/flowstate-1.4.159-electron-weekly-lanes.png`; DOM evidence showed 1 weekly lane board, 3 visual lanes, 6 related chips, 0 legacy `.weekly-plan-cards`, 0 raw UUIDs, no `מבוסס על Work` / `עבודה לא מסווגת`, and no raw task-count dump in chat or activity.
- Verification: `npm test -- tests/unit/ai-sidebar-first.test.ts` → 78/78 passed; `npm run type-check` → passed; `npm run electron:build` → passed and validated package metadata.
- Electron updater deployment verified at `https://in-theflow.com/updates/electron/latest-linux.yml` with `version: 1.4.159`; both `FlowState-1.4.159-x86_64.AppImage` and `FlowState_1.4.159_amd64.deb` returned HTTP 200.

**Next product slice after this proof**:
- Continue the AI chat quality lane from the first still-red proof gate below. The likely next work is memory/answer-quality continuity: repeated clarification suppression, stronger reasoning from saved context, and better "why this lane/task" explanations across real data.
- Do not start unrelated architecture work, broad Electron work, or cosmetic redesign until the signed-in weekly-planning flow is visually and behaviorally stable.

## Current Focused Lane — Localhost Weekly Planning Must Become Useful

**Goal**: Make the localhost AI chat weekly-planning flow reliably useful before any more architecture work.

**Why this lane overrides the broader memory lane for now**: The live user flow still produced a generic task-card dump for a Hebrew "plan the rest of the week" request. That means the product-visible planner is not ready, regardless of memory-schema progress. Resume here until the browser flow proves the assistant can clarify, learn, and produce a compact plan without embarrassing output.

**Current cursor**: ✅ Localhost proof now covers prompt-class routing, stuck follow-up click, compact continuation output, and no duplicate inline follow-up question after the user answers it.

**Hard rules for this focused lane**:
- Do not add more broad memory architecture work until this lane passes real localhost browser proof.
- Do not hardcode a single user phrase. Intent handling must recognize categories: planning/organizing/help intent plus future horizon such as this week, rest of week, remaining week, end of week, today, or tomorrow.
- Ask one question per screen, but not only one question total. Continue the interview while coverage/EVPI says more context is needed.
- Every clarification card must include user escape controls: generate with current info, show candidates only, pause/stop asking.
- Every saved answer must update memory/beliefs/events so the next turn does not ask the same thing again.
- Weekly output must be either a useful clarification card or a compact weekly plan. Never end as a generic "found 40 tasks" dump.
- Memory retrieval and memory writes must be bounded/fail-open and cannot block the visible next step.
- Electron stays deferred. Proof is localhost browser behavior first.

**Focused lane tasks**:

### TASK-1844: Flexible weekly-planning intent and route proof (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-08, proved 2026-06-08) | **Depends on**: TASK-1831

**Acceptance**:
- Hebrew and English "plan/organize/help me plan" prompts with rest/remaining/end-of-week horizons route to `week_plan`.
- The route is category/rule based, not exact-prompt hardcoding.
- Retrospective requests such as weekly summaries still route to review/summary, not forward planning.
- User-flow browser proof uses at least one Hebrew "rest of week" prompt and one English flexible prompt.

**Proof**:
- `npm run test:unit -- tests/unit/ai-sidebar-first.test.ts tests/unit/weekly-memory-retrieval.test.ts tests/unit/week-plan-request.test.ts tests/unit/deterministic-pipeline.test.ts` → 215/215 passed.
- `npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts` → 13/13 passed, including Hebrew `תעזור לי לתכנן את שארית השבוע` routing to weekly planning without a generic task dump.
- 2026-06-09: Added prompt-class regression proof for `תעזור לי לארגן את שארית השבוע`, `תעזור לי לתכנן את שארית השבוע`, `ארגן לי את שארית השבוע`, and `organize the rest of my week`. The browser assertions require weekly planning or a clarification card, forbid `Found N tasks` / `נמצאו N משימות`, forbid asking `What kind of project is "Work"`, require compact plans to stay at 1-3 sections, and require `[AIChat:WeeklyPlanDecision]` logs.
- 2026-06-09 verification: `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "weekly planning prompt variants|weekly bridge stream hang|weekly inline follow-up|old answered weekly inline|too-much feedback"` → 8/8 passed.
- 2026-06-09 headed spot checks: isolated headed runs passed for `תעזור לי לתכנן את שארית השבוע` and `organize the rest of my week`; the focused suite also passed the exact user phrase `תעזור לי לארגן את שארית השבוע` in localhost Chromium.

### TASK-1845: Iterative weekly clarification ladder with stop/generate controls (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-08, proved 2026-06-08) | **Depends on**: TASK-1844, TASK-1831A

**Acceptance**:
- The chat may ask multiple questions when needed, but only one question is visible at a time.
- Answering one clarification does not force a final plan if coverage is still weak.
- The user can stop the flow or generate with current info at any point.
- Saved answers become durable/local fallback memory and suppress repeated questions.

**Proof**:
- Clarification answers now await persistence before emitting the continuation, so retrieval can see the saved answer before deciding the next question.
- Weekly clarification continuation remains iterative; only the explicit generate/current-info escape forces the bounded compact draft.
- Escape controls remain visible and iconized with accessible labels.
- Browser suite proves no stuck activity row after answers and no-repeat broad clarification behavior.

### TASK-1846: Weekly planner visible-output quality gate (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed 2026-06-08, proved 2026-06-08) | **Depends on**: TASK-1844, TASK-1845

**Acceptance**:
- Final weekly plan shows 3-5 recommendations max.
- Each recommendation has a clear "why this now" grounded in task data, saved context, or explicit uncertainty.
- No generic task dump, no broad wall of text, no unsupported importance claims, no "found 40 tasks" as the final answer.
- Playwright/localhost proof checks rendered UI, not only unit contracts.

**Proof**:
- Weekly fallback now uses a bounded quick-draft plan with recommendation cards instead of an empty "not reliable enough" artifact.
- Weekly plan/clarification metadata clears raw `toolResults`/`cardGroups` so `ChatMessage` does not render `Found N tasks` under planning artifacts.
- Browser proof checks English weekly planning, Hebrew rest-of-week planning, accept/postpone/simplify feedback controls, no generic task dump, and enabled input/no stuck running state.

### TASK-1847: Weekly inline follow-up continuation logging and headed stuck-click proof (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed/proved 2026-06-09) | **Depends on**: TASK-1845, TASK-1846

**Why**: The real localhost UI could stay on the inline "create follow-up task" card after the user clicked the add-follow-up control, and previous verification missed it because it did not run the headed sidebar flow.

**Acceptance**:
- Clicking the inline follow-up apply control must not wait on task persistence before continuing the chat.
- The card must show a visible non-stuck status while the follow-up task write runs in the background.
- Console logs must identify the boundary: child card apply, follow-up create start/success/failure, continuation emit, parent receive/queue/send.
- Browser proof must run the real sidebar flow in headed localhost before the user is asked to test this path again.

**Proof**:
- `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "weekly inline follow-up click" --headed` → 1/1 passed.
- `npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "weekly inline follow-up click|weekly planning asks first|weekly bridge stream hang"` → 3/3 passed.
- `npm run test:unit -- tests/unit/ai-sidebar-first.test.ts -t "continues weekly planning immediately|lets weekly-plan question buttons create"` → 2/2 focused tests passed.
- `npm run type-check` → passed.

### TASK-1848: Compact post-continuation weekly answer rendering (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed/proved 2026-06-09) | **Depends on**: TASK-1847

**Why**: After the follow-up click advanced, the next answer could still render like a mini weekly report: source label, multiple prose paragraphs per task, risks, and deferral footer. That made a working continuation still feel useless.

**Acceptance**:
- Post-clarification weekly plans carry an explicit compact presentation mode.
- The compact continuation path returns at most 2 recommendations.
- Compact rendering shows title, one grounded reason, next action, controls, and task card only.
- Compact rendering hides full-plan tradeoff prose, focus labels, risk paragraphs, and deferral footers.
- Headed browser proof must check rendered content length and visible section count.

**Proof**:
- `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "weekly inline follow-up click" --headed` → 1/1 passed with compact-output assertions.
- `npm run test:unit -- tests/unit/ai-sidebar-first.test.ts -t "structured artifact|weekly plan quality gate|continues weekly planning immediately|lets weekly-plan question buttons create"` → 3/3 focused tests passed.
- `npm run type-check` → passed.

### TASK-1849: Weekly inline follow-up answers suppress the same question (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed/proved 2026-06-09) | **Depends on**: TASK-1847, TASK-1848

**Why**: The real localhost UI could ask the same inline follow-up question again after the user already answered it. The previous proof checked that the chat advanced and got compact, but not that the answered semantic question was recorded and suppressed.

**Acceptance**:
- Generated follow-up questions must be keyed to the related task, not anonymous weekly text.
- Clicking an inline weekly question answer must record an `ai_clarification_events` answer with `entityKey = task:<taskId>` and `questionId = followup_<taskId>` before the continuation decision reruns.
- Historical weekly follow-up cards must hydrate from saved clarification events and render as already answered instead of showing active answer controls.
- Browser proof must fail if the same inline follow-up question text appears twice after the user answers it.
- Console logs must show the clarification-event write boundary: `clarification_event_record_started` and `clarification_event_record_succeeded`.
- Console logs must show the old-card hydration boundary: `answered_hydration_started` and `answered_hydration_finished`.

**Proof**:
- `npm run test:unit -- tests/unit/ai-sidebar-first.test.ts` → 66/66 passed.
- `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --headed --grep "weekly inline follow-up"` → 1/1 passed.
- `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --headed --grep "old answered weekly inline"` → 1/1 passed.
- `DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_Mqgwcs npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts --grep "weekly bridge stream hang|weekly inline follow-up|old answered weekly inline|too-much feedback"` → 4/4 passed.
- `npm run type-check` → passed.
- 2026-06-09: The focused 8-test localhost suite includes old answered-card hydration and prompt-variant routing together, so answered follow-up memory and flexible weekly intent are verified in the same browser regression lane.

### TASK-1850: Weekly planner rejects generic Hebrew unclassified lanes (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (filed/proved 2026-06-12) | **Depends on**: TASK-1846, TASK-1849

**Why**: The real signed-in Electron flow still accepted a structured weekly plan with the Hebrew generic lane `עבודה לא מסווגת`, producing shallow reasoning instead of asking for useful context or falling back to a better grounded draft.

**Acceptance**:
- Weekly plan validation rejects Hebrew/English unclassified-work focus labels as generic.
- The regression uses the same validator path that accepts/rejects structured model weekly-plan output, not only rendered demo content.
- Desktop delivery includes a newer Electron updater version so the fix is available to the app under test.

**Proof**:
- Real signed-in Electron smoke on 2026-06-12 reproduced the failure before the fix: prompt `תעזור לי לתכנן את שארית השבוע` rendered a weekly plan containing `עבודה לא מסווגת`.
- `npm test -- tests/unit/ai-sidebar-first.test.ts -t "rejects shallow weekly plan JSON"` → 1/1 focused test passed.
- `npm test -- tests/unit/ai-sidebar-first.test.ts` → 77/77 passed.
- `npm run type-check` → passed.
- `npm run electron:build` → passed and validated package metadata.
- Public updater manifest verified at `https://in-theflow.com/updates/electron/latest-linux.yml` with `version: 1.4.155`; AppImage and deb URLs returned HTTP 200.

### ~~TASK-1851: Expanded weekly plan visual lane board~~ ✅ DONE

**Priority**: P0-HIGH | **Status**: ✅ DONE (filed 2026-06-12, completed 2026-06-12) | **Depends on**: TASK-1850

**Why**: The compact card carousel can still feel like a squeezed stack instead of a visual lane board, especially in the widened AI chat panel. The next product slice should make the lane relationship visible left-to-right rather than relying on semantic labels and clipped task cards.

**Acceptance**:
- Expanded/wide chat mode renders weekly recommendations as real horizontal lanes with all related task cards visible or intentionally paged without clipping.
- Compact mode does not collapse into a broken carousel or cut off task-card text.
- Lane titles explain the actual workstream, not generic buckets like `Work` or `עבודה לא מסווגת`.
- Headed verification uses the signed-in app/browser flow with the user's real task data, plus regression tests guarding against clipped carousel lanes.

**Focused proof gate before user testing**:
- Unit tests for flexible weekly intent, iterative clarification continuation, no blocking memory persistence, and no repeated questions.
- Playwright localhost user flow with seeded tasks:
  1. Ask in Hebrew for help planning the rest of the week.
  2. See one concise clarification or compact plan, not task dump cards.
  3. Answer at least one clarification.
  4. If more context is needed, see the next question with stop/generate controls.
  5. Choose generate/current-info escape and receive a compact 3-5 item weekly plan.
  6. Repeat with an English flexible prompt and verify it routes to weekly planning.

**Current implementation proof (2026-06-12)**:
- `ChatMessage` now keeps compact weekly-plan artifacts in the visual lane renderer when the chat is widened, instead of falling back to the legacy vertical recommendation-card renderer.
- Expanded weekly lane board renders as a CSS grid of lane columns; compact mode remains a small preview with a visible wide-open control.
- Storybook fixture `AI/ChatMessage/Weekly Lane Board` covers Hebrew RTL compact and wide layouts with related task cards.
- Headed Storybook visual check captured `/tmp/flowstate-weekly-lane-story.png`: wide board measured `display: grid`, 2 visible lane columns, no generic `עבודה לא מסווגת`/`Unclassified work`, no legacy `.weekly-plan-cards`, no horizontal scrollbar, and all cards inside their tracks.
- Headed signed-in FlowState desktop flow exercised the user's real task data and exposed the remaining raw-ID subtitle problem in fullscreen lanes; the lane layout itself rendered as a real horizontal board rather than the previous squeezed carousel.
- `ChatMessage` now resolves generic work-lane subtitles through the project display-name store and falls back to the lane focus instead of leaking UUID/project IDs.
- Updated headed Storybook label check captured `/tmp/flowstate-weekly-lane-label-story.png`: 2 boards, 4 visual lanes, wide board `display: grid`, no raw UUID-like text, no legacy `.weekly-plan-cards`, and human subtitle `מבוסס על בינה מעצבת`.
- Headed signed-in packaged Electron 1.4.157 check exposed one remaining generic subtitle (`מבוסס על Work`), so `ChatMessage` now treats generic bucket labels (`Work`, `My Projects`, `Personal`, `Uncategorized`, `מסירת עבודה`, `עבודה לא מסווגת`) as non-labels and renders `נתיב משימות קשורות` instead of leaking the bucket.
- Headed signed-in packaged Electron 1.4.158 check via Chromium remote debugging captured `/tmp/flowstate-1.4.158-electron-weekly-lanes.png`: 1 weekly lane board, 3 visual lanes, no legacy `.weekly-plan-cards`, no UUID-like text, no `מבוסס על Work`, no `עבודה לא מסווגת`, and lane widths of 349px each.
- Electron updater deployment verified at `https://in-theflow.com/updates/electron/latest-linux.yml` with `version: 1.4.158`; both `FlowState-1.4.158-x86_64.AppImage` and `FlowState_1.4.158_amd64.deb` returned HTTP 200.
- `npm test -- tests/unit/ai-sidebar-first.test.ts` → 77/77 passed.
- `npm run type-check` → passed.
- `npm run electron:build` → passed and validated package metadata.
- `VPS_HOST=84.46.253.137 VPS_USER=root ./scripts/deploy-electron-update.sh --notes "TASK-1851: weekly lane board generic labels"` → deployed 1.4.158.

**Gate status**: ✅ Follow-up stuck-click, compact post-continuation output, duplicate inline follow-up suppression, old-card answered-memory hydration, visual lane regression coverage, and signed-in packaged Electron lane proof are complete.

---

## AI Chat Quality System Full Delivery Lane — localhost first, Electron later

**Goal**: Make FlowState chat consistently useful across weekly planning, "what should I do", prioritization, task breakdown, smart lanes, follow-up tasks, and general agent help by combining server-backed memory, explicit uncertainty, low-overwhelm UX, feedback learning, and testable answer-quality gates.

**Current execution cursor**: **LANE-3 — clarification decision quality and broader bot action coverage**. The live AI memory substrate is visible through Supabase REST and the broad localhost chat suite now covers weekly planning, non-weekly planning prompts, feedback loops, and stuck-state regressions. Resume the clarification/EVPI quality lane before broad user testing, and keep the bot action/tool regression suite current as new capabilities are added.

**Why this lane exists**: This work has too many coupled failure modes to track as isolated fixes. Use this lane as the single source of truth so every change is tied to a phase, a proof gate, and a user-visible quality outcome. If a future session feels lost, resume from the current execution cursor and the first incomplete proof gate below.

**Hard lane rules**:
- Work stages in order. Do not jump to polish, Electron, or broad UI expansion while the current stage lacks localhost proof.
- Do not ask the user to test until the relevant stage passes automated checks plus a real localhost browser smoke.
- Default response contract: ask one high-value button-based clarification before broad recommendations when missing context would materially change the answer.
- Suppress broad plan/recommendation prose until the user answers, chooses "continue with uncertainty", or the system has enough grounded context.
- Every recommendation must cite task evidence plus memory/context evidence, or explicitly mark the missing evidence.
- User-authored facts and corrections outrank model inference. Project/task names alone never establish importance, stakes, domain, or success criteria.
- Electron packaging/update work is deferred until localhost behavior is reliable and the user re-enables Electron for this lane.

**Execution checklist**:
1. Finish the current stage only. Do not start later UI polish or Electron delivery while the stage proof gate is red.
2. After every code slice, update the relevant task progress note with what changed and what was proven.
3. Run focused tests for the slice, then the AI-focused suite, then localhost/browser smoke when user-visible behavior changed.
4. If localhost smoke fails, keep fixing. Do not ask the user to test a flow that is stuck, verbose, or missing persistence proof.
5. Commit and push only after the plan file, tests, and proof evidence match the actual current state.

**Operator board for the active lane**:
- **Current slice**: LANE-3 clarification decision quality. Improve and prove ask/proceed/uncertainty decisions now that the memory substrate is ready and broad localhost flows are covered.
- **Current proof**: `npm run check:ai-memory-live-readiness` reports all six AI-memory tables visible through Supabase REST; guarded `AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud` inserted/read/deleted probe rows successfully; the local AI chat suite passes 22/22 across weekly and broad prompts; `tests/unit/ai-tools-execution.test.ts` locks non-weekly bot actions.
- **Next slice after current proof**: TASK-1840/TASK-1831A/TASK-1831 clarification scoring and durable belief behavior, with special attention to non-weekly bot prompts and action/tool flows.
- **Blocked until current proof is green**: broad user testing and Electron delivery for this lane. Background summarization and semantic recall remain deferred until clarification quality is stable.
- **User-test rule**: no user test request until Stage 8/LANE-10 proves the full localhost loop in browser: prompt -> one clarification -> answer/uncertainty -> no barrage -> no stuck activity -> feedback/debug visible.

**Authoritative task lane queue**:

| Lane | Status | Task refs | Product outcome | Files/surfaces | Proof gate |
| --- | --- | --- | --- | --- | --- |
| LANE-0: Regroup and cursor discipline | ✅ DONE | This top lane + TASK-1842 | One source of truth that prevents scattered fixes and stale "current slice" drift | `docs/MASTER_PLAN.md` | Lane lists all packets, current cursor, blocked work, and user-test gate |
| LANE-1: VPS-safe memory substrate | ✅ Substrate proof green | TASK-1830, TASK-1839 | Durable memory for real projects, synthetic buckets, preferences, corrections, and events; no UUID failures for `Work`, `My Projects`, or `uncategorized` | Supabase migrations, memory repositories, schema contract tests | Contract/retrieval tests pass; live schema and guarded CRUD pass; missing-schema fallback remains covered |
| LANE-2: Hybrid retrieval and latency budget | 🔄 In progress | TASK-1838 | Fast exact-key retrieval first; bounded recent events/feedback/edges; optional pgvector later without blocking the hot path | `weeklyMemoryRetrieval`, `broadMemoryRetrieval`, memory diagnostics, timeout/cache helpers | Retrieval tests prove bounded diagnostics, synthetic-key safety, and timeout fallback |
| LANE-3: Coverage, uncertainty, and EVPI question choice | 🔄 CURRENT | TASK-1840, TASK-1831A, TASK-1831 | Ask the most valuable non-repeated question; do not treat one random button answer as enough context | uncertainty policy, EVPI scoring, parameter beliefs, clarification events | Tests prove high-value question selection, cooldown/dedupe, answer-to-belief update, and no immediate re-ask |
| LANE-4: Low-overwhelm answer contract | 🔄 In progress | TASK-1831, TASK-1832 | Broad requests start with one concise card or a visible uncertainty escape; no generic plan dump by default | chat pipeline, deterministic fallback, repair/audit helpers, clarification UI | Tests fail overlong first answers, name-only importance, unsupported ranking, and filler prose |
| LANE-5: Broad-flow coverage beyond weekly planning | ✅ First proof done | TASK-1835 | Same contract for "what should I do", day plan, smart lanes, prioritization, task breakdown, follow-up task suggestions, and general agent help | intent router, deterministic flows, formatter prompts, fallback cards | Non-weekly tests prove ask/proceed/neutral behavior and no hidden task-card barrage while asking |
| LANE-6: Feedback learning and suppression | ✅ First proof done | TASK-1833, TASK-1836 | Accept/postpone/dismiss/simplify actions immediately change current UI and later retrieval/ranking | inline recommendation cards, feedback store, memory retrieval, cooldown rules | UI/unit tests prove postponed/dismissed items suppress until revisit and accepted/timeblocked items become positive signals |
| LANE-7: Memory lifecycle and safety | 🔄 First refresh proof done | TASK-1837, TASK-1839 | Memory stays useful over time: stale refresh, confidence decay, summaries, retention, correction audit, prompt-injection-safe evidence | lifecycle policy, retrieval diagnostics, prompt evidence builders | Lifecycle/security tests prove stale facts are refreshed, old/noisy events are flagged, and free text is quoted evidence only |
| LANE-8: Observability and speed | 🔄 In progress | TASK-1834 | User can see concise phases and debug reasons without reading internal dumps; no duplicate thinking rows or stuck spinner after saving | activity timeline, clarification debug disclosure, phase timing metadata | Activity/UI tests and browser smoke show phase changes, slow-step attribution, and no stuck running row |
| LANE-9: Answer-quality evaluation rubric | 🔄 In progress | TASK-1841 | Bad/acceptable/excellent scoring becomes executable, not subjective vibe review | eval fixtures, citation audit, adversarial scenarios | Eval fails fake reasoning, repeated questions, excess length, missing evidence, and conflicting-correction misuse |
| LANE-10: Localhost E2E proof | ✅ Broad-flow proof done | TASK-1842 | Real browser proves the end-to-end loop before the user is asked to test | Playwright/localhost smoke, seeded tasks, bridge stubs, screenshots | Prompt -> one clarification -> answers/follow-ups -> concise plan/uncertainty -> feedback/debug -> no barrage -> no stuck activity -> too-much feedback changes next broad answer |
| LANE-11: Electron delivery gate | ⏸ Deferred | TASK-1843 | Desktop packaging/updater only after localhost proves behavior and user re-enables Electron | Electron build/update/deploy surfaces | Explicit user re-enable, then Electron build/update verification |

**Current lane cursor**: LANE-3 is the next product slice after live memory substrate proof and broad-flow localhost proof. The latest localhost smoke covers weekly planning, prioritization, next-task, overdue triage, day planning, smart lanes, task breakdown, compact post-clarification planning, debug disclosure, no stuck running row, no-repeat broad clarification, a simplify/too-much feedback loop that changes the next broad answer, and broad postpone feedback suppressing the same task in the next broad answer. Continue with EVPI/uncertainty quality and non-weekly bot action coverage before asking for broad user testing or shipping Electron.

**Resume rule for future agents**: Start from the operator board above, then the first non-green proof gate in the stage table. Do not reinterpret this lane as a weekly-plan copywriting task, a local-only memory hack, or an Electron updater task. The intended product behavior is a durable AI chat quality system that learns useful context, asks the right low-friction questions, avoids overwhelming answers, and proves that behavior locally before desktop delivery.

| Stage | Task(s) | Required outcome | Status | Proof gate before moving on |
| --- | --- | --- | --- | --- |
| 0 | This lane + TASK-1842 | Single execution lane, active cursor, localhost-only gate, no vague partial phases | ✅ Done | MASTER_PLAN lane lists all stages, dependencies, proof, and user-test gate |
| 1 | TASK-1830, TASK-1838, TASK-1839 | VPS-safe memory substrate: server entities/events/edges, synthetic keys, missing-schema fallback, SQL-first retrieval, RLS/prompt-injection safety | ✅ Substrate proof green | Contract tests, retrieval tests, live REST readiness, guarded CRUD, no UUID errors for `Work`/`My Projects`/`uncategorized`, bounded retrieval diagnostics |
| 2 | TASK-1840, TASK-1831A, TASK-1831 | Clarification decision engine: coverage/materiality policy, heuristic EVPI, one-question ladder, cooldown/dedupe, continue-with-uncertainty escapes | 🔄 CURRENT | Unit + mounted tests prove highest-value non-repeated question appears and answering it does not re-ask or dump content |
| 3 | TASK-1835 | Apply the same ask-before-answer contract to all broad chat flows, not only weekly planning | ✅ First proof done | Non-weekly tests for day plan, smart lanes, prioritization, "what should I do", and task breakdown prompts |
| 4 | TASK-1832, TASK-1841 | Answer-quality evaluator: groundedness, brevity, evidence, unsupported-ranking rejection, bad/acceptable/excellent rubric | 🔄 In progress | Eval/tests fail generic prose, name-only importance, repeated templates, missing evidence, and overlong answers |
| 5 | TASK-1833, TASK-1836 | User feedback loop: accept/postpone/dismiss/simplify controls, reason chips, cooldowns, revisit dates, implicit positives | ✅ First proof done | UI tests prove feedback persists, current suggestions suppress immediately, future ranking respects feedback |
| 6 | TASK-1834 | Observability and speed: concise phases, timings, path type, slow-step diagnostics, no duplicate thinking rows | 🔄 In progress | Activity-row tests plus localhost smoke show answer phase changes and no stuck spinner after saving clarification |
| 7 | TASK-1837 | Memory lifecycle: fact promotion, confidence decay, summaries/snapshots, stale confirmations, export/delete policy | 🔄 First refresh proof done | Lifecycle tests prove stale facts refresh, corrections stay auditable, retrieval stays bounded |
| 8 | TASK-1842 | Localhost end-to-end QA: real browser flow from prompt → clarification → answer/uncertainty → feedback/debug | ✅ First proof done | Playwright/browser evidence proves no content barrage before clarification and no stuck card after answer |
| 9 | TASK-1843 | Electron packaging/updater gate after localhost stabilization | ⏸ Deferred | Only run Electron build/update when user explicitly re-enables Electron for this lane |

**Research-backed requirements captured in the stages**:
- Hybrid memory: session, episodic events, semantic facts/summaries, procedural preferences.
- Server-backed persistence for VPS/localhost parity: `ai_context_entities`, `ai_clarification_events`, `ai_context_edges`, recommendation feedback, and later `ai_parameter_beliefs`.
- Hybrid retrieval: exact entity key lookup first, structured filters and recent events second, optional pgvector/semantic recall only when needed and timeout-safe.
- EVPI-inspired clarification selection: information value ~= uncertainty * impact * expected reduction - user cost.
- Low-overwhelm UX: one question per turn, 3-5 buttons, optional free text, visible escape hatches, concise output, progressive disclosure.
- Feedback learning: dismissed/postponed/ignored recommendations affect cooldowns and preference facts; accepted/time-blocked/completed/timer-started actions are positive signals.
- Lifecycle: confidence decay, stale refresh, summarization/snapshots, retention, export/delete, and correction auditability.
- Evaluation: groundedness, specificity, brevity, uncertainty handling, learning/adaptation, user control, realism, safety, citation audit, and adversarial free-text tests.
- Accepted architecture decision: defer a dedicated graph database. Use Postgres-native `ai_context_entities` + `ai_context_edges` + optional pgvector embeddings first; add recursive CTE/app-layer traversal only when concrete multi-hop queries demand it.
- Accepted fallback decision: after structured-output failure, retry once with validation feedback; on second failure, show a deterministic compact draft with visible coverage/uncertainty and feedback controls. Do not loop into another clarification unless EVPI is high and the question is not recently answered.
- Accepted quality decision: broad low-context outputs default to 1-3 recommendations with controls, not 5+ ranked items and prose. If coverage is low and materiality is high, ask one high-EVPI question; if proceeding, mark uncertainty visibly.

**User-test gate**: The user should only be asked to test after Stage 8 has a passing localhost browser smoke and the final response says exactly what changed, what to try, what should no longer happen, and what is still intentionally not built.

**Not ready for user testing until**:
- Stage 2 proves answering a clarification saves/updates durable belief state and continues without a stuck activity row across weekly and non-weekly prompts.
- Stage 7 proves stale context/lifecycle behavior and Stage 9 proves answer-quality evals beyond the current smoke matrix.
- Stage 8 proves the complete localhost flow in a real browser.

---

### TASK-1830: Server-backed AI context memory for all chat flows (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1828, TASK-1829

**Why**: AI chat quality cannot be fixed by prettier weekly-plan prose or local-only clarification state. The assistant needs a VPS-safe, cross-device system of record for what projects, task groups, recurring workflows, and user preferences mean, including synthetic entities like `Work`, `My Projects`, and `uncategorized`.

**Scope**:
- Add durable server-backed entities for project/task/week/preference/synthetic/workflow context.
- Store clarification history, answers, dismissals, corrections, and "generate with uncertainty" choices so the assistant does not repeatedly ask the same questions.
- Support non-UUID entity keys without writing them into UUID-only Supabase columns.
- Retrieve relevant memory before planning or ranking, then merge it with existing project/task context rows.
- Keep memory editable and auditable through event history instead of overwriting meaning silently.
- Research validation update: treat memory as tiered session/episodic/semantic/procedural state, not one generic blob.
- Research validation update: add lifecycle rules for confidence decay, stale confirmation, summarization, retention, and selective retrieval so memory does not become slow or noisy.
- Research validation update 2: add `memory_type`, `scope`, `reinforcement_count`, `last_reinforced`, `related_entities`, and optional vector embedding support when the schema graduates beyond the first clarification slice.
- Research validation update 2: user-authored facts and corrections outrank model inferences; model inferences stay low confidence until confirmed.
- Graph update: add a Postgres-native `ai_context_edges` relation table before considering a separate graph database. Treat projects/tasks/weeks/preferences/workflows as nodes and store edges such as `belongs_to`, `blocks`, `follow_up`, `part_of_week`, and `preference_affects`.
- Research decision update: do not introduce Neo4j/Memgraph/Graphiti as a separate runtime now. Postgres entities/edges plus pgvector keeps RLS, migrations, VPS ops, and localhost parity simpler; revisit only after concrete temporal multi-hop use cases exceed recursive CTE/app-layer traversal.

**Acceptance**:
- Synthetic buckets persist through `ai_context_entities`/`ai_clarification_events`, not localStorage.
- UUID-only project/task context calls filter non-UUID IDs and never throw `invalid input syntax for type uuid`.
- Weekly planning can recall saved answers for `Work`, `My Projects`, and `uncategorized` across sessions/devices.
- Memory retrieval is bounded/cached enough that the sidebar does not feel stuck.
- Free-text clarification answers are stored as user-authored evidence, not prompt instructions.
- Memory rows can be versioned or audited so correction history remains inspectable after summaries are compacted.
- Entity relationships can be queried server-side without introducing Neo4j/Memgraph deployment complexity.

**Progress**:
- 2026-06-08: Pending AI memory write tests now prove clarification events, recommendation feedback, and parameter beliefs all queue during schema-cache/migration misses and flush after the server schema becomes available. This protects saved clarification answers, postpone/dismiss/simplify learning signals, and EVPI belief updates during VPS rollout timing gaps.
- 2026-06-08: Broad non-weekly task answers now retrieve server-backed `ai_context_entities`, `ai_clarification_events`, `ai_parameter_beliefs`, and `ai_recommendation_feedback` by text entity key before formatting task-list responses. This closes the gap where weekly planning could recall synthetic bucket context but general "what should I do" answers still ignored durable `Work`/`My Projects`/`uncategorized` memory.
- 2026-06-08: Ordinary freeform/ReAct prompts and non-task deterministic formatter paths now receive a bounded global memory packet from server-backed workflow/preference entities, recent clarification events, and parameter beliefs. This makes the first Slice 1 requirement closer to true: assistant responses are no longer prompt-only when no task-list tool result is present.
- 2026-06-08: Postgres-native graph edges are now readable, not only write-only. `fetchAIContextEdges` retrieves bounded source/target relationships by text entity key, weekly/broad/global retrieval include edge counts or compact relationship evidence, and Settings > AI memory debug shows recent edge counts/labels. This keeps `Work`, `My Projects`, and `uncategorized` graph memory VPS-safe without a dedicated graph database.
- 2026-06-08: ReAct/freeform tool loops now append the same bounded broad task-memory packet after native or text-detected tool calls. Freeform answers that first ask tools for task lists can use saved entities, clarification events, parameter beliefs, recommendation feedback, and graph relationship evidence instead of reverting to prompt-only task formatting.
- 2026-06-08: Broad task-memory retrieval now has the same bounded timeout/fallback contract as weekly retrieval. It returns source/timing/entity-count diagnostics and an empty evidence packet on timeout, so broad prompts can continue without inventing memory or losing proof of whether memory came from `hybrid_sql` or fallback.
- 2026-06-08: Added a dedicated AI memory schema contract test that checks runtime table usage against the Supabase migrations for `ai_context_entities`, `ai_clarification_events`, `ai_parameter_beliefs`, `ai_recommendation_feedback`, and `ai_context_edges`. The test now guards text-key synthetic entities, RLS enablement, hot retrieval indexes, check-enum parity, and every runtime-read/write column before VPS rollout.
- 2026-06-08: Settings > AI memory debug now reports server schema status (`ready`, `partial`, `missing`, or `local_only`) plus missing table names and queued writes. This makes Supabase schema-cache/migration drift visible during localhost/VPS testing instead of showing an empty memory panel with no diagnosis.
- 2026-06-08: Broad task-list memory now also retrieves global workflow/preference keys such as `preference:brevity` and response-quality workflow memories. A saved simplify/too-much signal becomes a direct `compactPreference` flag, and deterministic broad fallbacks cap the next non-weekly draft to one recommendation instead of repeating a dense answer.
- 2026-06-08: Authenticated schema-cache misses now mirror queued clarification events, recommendation feedback, and parameter beliefs into the local AI-memory fallback immediately, and schema-missing reads return those local rows. This prevents repeated clarification/stale-refresh questions while VPS migrations or Supabase schema cache visibility lag behind the UI.
- 2026-06-08: Added server-backed `ai_memory_snapshots` for lifecycle summarization. Snapshots are keyed by text `snapshot_key`, scoped by user/project/task/week/workflow, RLS-protected, indexed for hot retrieval, visible in Settings > AI memory debug, and clearable with the rest of the AI memory layer.
- 2026-06-08: Broad task-list and global/freeform memory retrieval now consume bounded `ai_memory_snapshots` as quoted prompt evidence, with `snapshotCount` diagnostics on broad retrieval. This turns lifecycle summaries into real answer context instead of leaving them as debug-only rows.
- 2026-06-08: Compact memory snapshots now use the same local fallback and pending-write queue as clarification events, parameter beliefs, and recommendation feedback. Guest/localhost snapshots are visible in AI memory debug and schema-missing snapshot writes are mirrored locally, queued, then flushed when `ai_memory_snapshots` becomes available.
- 2026-06-08: Weekly and broad retrieval now separate stale/refresh-needed memory from active planning evidence. Expired, old-confirmation, or low-confidence project/task context remains visible in lifecycle diagnostics and refresh signals, but is not promoted into `projectContexts`, `taskContexts`, remembered answers, or active broad-answer summary lines that could justify ranking as if it were fresh.
- 2026-06-08: Added an end-to-end local stale-refresh regression: answering a stale-context clarification writes a fresh local context entity, broad retrieval then treats it as active evidence, and lifecycle diagnostics no longer report `refresh_needed` for that entity. This protects guest/schema-cache fallback from asking the same stale-refresh question immediately after the user answered it.
- 2026-06-08: Patch-only memory updates now write text-key and synthetic entities into `ai_context_entities` instead of being skipped by the legacy UUID-only `project_contexts`/`task_contexts` path. Schema-cache misses queue and mirror those patch writes locally, so stale-context confirmations from UI cards refresh entity freshness even before server schema visibility catches up.
- 2026-06-08: Added `npm run check:ai-memory-schema`, a read-only Supabase REST readiness check for all server AI-memory tables and runtime columns. The schema contract test now asserts this live checker stays aligned with migrations/runtime. Current live result: `https://api.in-theflow.com` returns PGRST205 for `ai_context_entities`, `ai_clarification_events`, `ai_parameter_beliefs`, `ai_recommendation_feedback`, `ai_context_edges`, and `ai_memory_snapshots`, so server/VPS AI memory is not ready until migrations are applied or the REST schema cache is refreshed.
- 2026-06-08: Added `npm run build:ai-memory-migration-bundle`, which builds a deterministic `/tmp/flowstate-ai-memory-live-migration.sql` payload from the six server AI-memory migrations missing from live REST. The bundle guards `create policy` statements with `drop policy if exists` so a partial/manual apply can be retried, and the schema contract test now checks this production-apply artifact stays aligned with the required migration files. Applying this bundle to live Postgres remains a production DB operation and must be followed by `npm run check:ai-memory-schema`.
- 2026-06-08: Local dry-run caught and fixed a real schema mismatch before production apply: FlowState `projects.id` and `tasks.id` are `text`, so `ai_context_entities.canonical_project_id`, `ai_context_entities.canonical_task_id`, and `ai_recommendation_feedback.task_id` must also be text references, not UUID references. Regenerated `/tmp/flowstate-ai-memory-live-migration.sql`, applied it successfully to local `supabase_db_flow-state` with `psql -v ON_ERROR_STOP=1`, and verified local PostgREST can see all six AI-memory tables through `scripts/check-ai-memory-schema.cjs` against `http://127.0.0.1:54321`. VPS upload/apply is still awaiting explicit production DB approval.
- 2026-06-08: Added `npm run check:ai-memory-crud`, a guarded write/read/delete smoke for the six server AI-memory tables. It refuses to run unless `AI_MEMORY_CRUD_PROBE=1` is set, writes only `probe:ai-memory:*` rows, and deletes them before exiting. Local Supabase verification passed after the migration dry-run: temporary context entity, clarification event, parameter belief, recommendation feedback, context edge, and memory snapshot rows were inserted, read through REST, and cleaned up successfully.
- 2026-06-08: Added `npm run apply:ai-memory-live-migration`, a dry-run-by-default production helper that regenerates the SQL bundle and prints the exact VPS `scp`/`ssh psql -v ON_ERROR_STOP=1` commands. It only mutates the live database when both `APPLY_AI_MEMORY_LIVE=1` and `CONFIRM_AI_MEMORY_LIVE=APPLY` are set, then instructs the operator to run the read-only schema check and guarded CRUD smoke. Dry-run passed and made no production changes.
- 2026-06-08: Hardened the live migration handoff so the generated AI memory SQL bundle notifies PostgREST to reload its schema cache, and the confirmed apply path now runs the read-only `npm run check:ai-memory-schema` gate before declaring completion. The guarded CRUD probe remains explicit because it writes temporary rows.
- 2026-06-08: Re-ran the read-only live schema checker after the handoff hardening. `https://api.in-theflow.com` still returns PGRST205 for all six AI-memory tables, so the server-backed memory lane remains gated on the explicit live migration/schema-cache apply step.
- 2026-06-08: The read-only live schema checker now retries PGRST205 schema-cache misses with configurable `AI_MEMORY_SCHEMA_RETRIES`/`AI_MEMORY_SCHEMA_RETRY_MS`, and the live apply helper uses a longer post-apply wait window before failing. This keeps the VPS handoff strict while avoiding false failure when PostgREST needs a few seconds to reload after `notify pgrst, 'reload schema';`.
- 2026-06-08: The read-only AI memory schema checker now emits machine-readable readiness evidence via `--json`/`--json-out` and an offline `--print-contract` mode. The schema contract test executes the offline mode and compares its required tables/columns to the migration/runtime contract, so VPS handoff can archive exact readiness reports instead of scraping human logs. This is proof tooling only; live Supabase still needs the explicit schema apply/cache-refresh gate before cross-device AI memory is ready.
- 2026-06-08: Re-ran the read-only live schema checker with `--json-out`; `/tmp/flowstate-ai-memory-live-readiness.json` reports `status: "missing"`, `okTableCount: 0`, and PGRST205 for `ai_context_entities`, `ai_clarification_events`, `ai_parameter_beliefs`, `ai_recommendation_feedback`, `ai_context_edges`, and `ai_memory_snapshots`. Localhost fallback remains the only current runtime path until production DB migration/cache refresh is explicitly applied.
- 2026-06-08: Clarification saved-state copy now distinguishes local-only memory from durable server memory. In unauthenticated/localhost mode the card says "Saved locally on this device. Sign in for cross-device memory."; authenticated schema-missing writes still report queued memory updates. Unit coverage plus the localhost Playwright smoke now assert this wording so the UI does not falsely imply cross-device memory before the VPS schema gate is green.
- 2026-06-08: Re-ran the live read-only schema checker after the latest localhost proof. `/tmp/flowstate-ai-memory-live-readiness-current.json` reports `status: "missing"`, `okTableCount: 0`, and PGRST205 for all six AI-memory tables at `https://api.in-theflow.com`. `npm run apply:ai-memory-live-migration` dry-run regenerated `/tmp/flowstate-ai-memory-live-migration.sql` cleanly, but the actual production DB apply remains gated on explicit live-migration approval.
- 2026-06-08: Hardened the confirmed live migration path with a read-only VPS database preflight before upload/apply. The helper now detects the Supabase/Postgres container, fails clearly if no DB container is found, runs `select current_database();` through `psql`, and only then uploads/applies the SQL bundle. Dry-run output now prints the concrete preflight and apply commands while still making no production changes.
- 2026-06-08: Added `AI_MEMORY_PREFLIGHT_ONLY=1 npm run apply:ai-memory-live-migration` for standalone read-only VPS database preflight. This regenerates the bundle, verifies SSH/container/`psql` access, and exits before upload/apply so production migration readiness can be checked without mutating the live database.
- 2026-06-08: Ran the standalone read-only VPS preflight against the real server. It found database container `supabase-db`, completed `psql` connectivity, and exited with "No production database changes were made." Live schema remains missing until the explicit apply step is approved.
- 2026-06-08: Added `npm run check:ai-memory-live-readiness`, a combined read-only live gate that runs the VPS DB preflight and then writes the REST schema readiness JSON report. It intentionally does not upload SQL, apply migrations, or run the guarded CRUD write probe.
- 2026-06-08: Ran `npm run check:ai-memory-live-readiness` against the real VPS/API. The read-only preflight found `supabase-db` and made no production changes; the command then failed the readiness gate because the REST schema check still reports PGRST205 for all six AI-memory tables and writes `/tmp/flowstate-ai-memory-live-readiness-current.json`.
- 2026-06-08: Added `npm run check:ai-memory-migration-safety`, a read-only destructive-operation gate for the generated live AI-memory SQL bundle. It allows retry-safe `drop policy if exists` and `drop trigger if exists`, but rejects table/schema/index/function/view drops, truncation, data deletes, and column drops. The live apply helper now runs this safety check immediately after bundle generation in dry-run, preflight-only, and confirmed-apply modes.
- 2026-06-08: Added localhost browser proof that the weekly `Accept` feedback control saves a positive signal without hiding the recommendation, leaving a running activity row, or disabling the chat input. The AI chat quality local Playwright suite now covers ask-before-answer, post-answer continuation, no-repeat clarification, postpone/dismiss suppression, too-much compacting, local-only memory debug, mechanical no-clarify requests, and positive accept feedback (`12 passed`).
- 2026-06-08: AI memory debug clear confirmation now matches the actual persistence state. Local-only mode says it clears memory on this device, missing-schema mode says it clears local fallback and queued memory, partial mode warns some server tables are unavailable, and only ready mode says server-backed memory. Unit coverage prevents the Settings UI from implying durable cross-device memory before the schema gate is green.
- 2026-06-08: Applied the approved live AI-memory migration to the VPS Supabase/Postgres database. The first live apply exposed a real local/live schema drift: live `projects.id`/`tasks.id` are UUID while the AI-memory bundle had text FKs from `canonical_project_id`, `canonical_task_id`, and recommendation `task_id`. Fixed the server AI-memory migrations to keep those columns as text without direct project/task FKs, preserving synthetic/text entity-key support without coupling to local/live ID column types. Rebuilt the bundle, passed the destructive-operation safety check, uploaded it to the VPS, applied it through `docker exec -i supabase-db psql -v ON_ERROR_STOP=1`, and verified `/tmp/flowstate-ai-memory-live-readiness-current.json` reports `status: "ready"`, `okTableCount: 6`, and `failedTableCount: 0`.
- 2026-06-08: Ran the guarded live AI-memory CRUD smoke after schema readiness. `AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud` inserted, read, and deleted temporary probe rows successfully against `https://api.in-theflow.com`, proving the server-backed AI memory tables are writable/readable through the expected REST path.
- 2026-06-08: Re-ran the localhost AI chat quality suite after the VPS schema migration and migration-source FK fix. `npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts` passed `12/12`, and the focused AI-memory unit bundle plus `npm run type-check` passed, so the live schema unlock did not regress the local ask-before-answer, feedback, no-repeat, debug, or compact-answer behavior.

---

### TASK-1831: Global low-overwhelm clarify-before-answer contract (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830

**Why**: The chat should not dump long, generic recommendations when context is missing. This applies broadly to planning, prioritization, task breakdowns, "what should I do", and other agent answers, not only weekly planning.

**Scope**:
- Before producing a broad recommendation, detect missing context that would materially change the answer.
- Ask one concise button-based clarification with optional free text by default.
- Provide escape actions: generate with current info, show candidates only, pause/save.
- Keep default responses short, scannable, and grounded; avoid walls of text unless the user asks for detail.
- Use recent clarification history and cooldowns before asking.
- Research validation update: compute an explicit coverage/uncertainty score before asking or ranking.
- Research validation update: ask first when weak context would materially affect planning; otherwise proceed with visible uncertainty.
- Research validation update 2: use a concrete coverage policy: coverage > 0.8 proceeds, 0.5-0.8 proceeds with visible uncertainty when materiality is low/medium, and < 0.5 with high materiality asks one question first.
- Research validation update 2: choose the question with highest expected value: missing impact, stakes, energy fit, stakeholder/commitment, dependency, history, or preference dimension that most changes the current answer.
- Research decision update: one button answer is only enough when it resolves a low-EVPI slot or the user chooses to proceed with uncertainty. Complex/cold-start planning may use a short ladder, but still one question per turn with cooldown/dedupe.

**Acceptance**:
- Missing meaning/stakes/success criteria triggers one clarification card, not a full generic plan.
- The assistant can proceed only when the user explicitly chooses to generate with uncertainty.
- No answer ranks importance from project/task names alone.
- Recently answered, dismissed, or uncertainty-accepted questions are not asked again inside the cooldown window.
- Cold-start users get one lightweight question or neutral candidates, not a dense interview.
- Clarification events record `coverage_score_at_time`, `uncertainty_dimensions`, and answer path type when available.

**Progress**:
- 2026-06-08: Added server-backed `ai_parameter_beliefs` schema keyed by text `entity_key` rather than UUIDs, so synthetic buckets and workflow entities can store uncertainty slots such as impact, preferences, stakes, dependencies, and success criteria.
- 2026-06-08: Clarification cards now continue automatically after the first saved answer, so the user never gets stuck in a required follow-up ladder. Additional context questions must be asked later only when they are high-value and non-repeated.
- 2026-06-08: Added a focused AI memory schema contract test for server-backed entities, clarification events, recommendation feedback, Postgres-native graph edges, RLS, migration order, and missing-schema client fallback before any live Supabase migration step.
- 2026-06-08: Clarification continuation messages now include the actual selected button/free-text answer as compact quoted context, so localhost flows still proceed correctly before live Supabase memory migrations are applied.
- 2026-06-08: Clarification continuations now run as hidden control messages with a typed mode marker and bypass the ask gate once, so answering a card does not add noisy chat content or immediately re-ask the same question while persistence is delayed.
- 2026-06-08: Broad response-quality clarification now checks saved `ai_parameter_beliefs` for the workflow key before asking. A high-confidence saved `rankingFocus`/preference belief raises coverage to `proceed`, so the same broad-answer guidance question is not re-asked after it has already been answered and persisted.
- 2026-06-08: Weekly clarification no longer blocks the answer behind a multi-step ladder. Button-only answers are treated as enough to generate a compact, uncertainty-aware result; the next high-value question can appear later instead of delaying visible progress.
- 2026-06-08: Response-quality clarification now continues immediately after a button-only answer. This keeps the ask-before-answer gate lightweight while preserving the saved answer as evidence for the continuation.
- 2026-06-08: The "generate with current info" escape now explicitly continues the chat through the clarification-continuation path with instructions to mark missing context as unknown, rather than only showing local candidate cards.
- 2026-06-08: Localhost generate-current smoke now shows a limited uncertainty-marked draft instead of confident impact/risk fallback prose, with no long-plan dump and no stuck generation state.
- 2026-06-08: Clarification follow-up answers are now preserved as user-authored evidence in the deterministic formatter prompt, including free-text follow-up notes, so the answer after clarification can use what the user actually said instead of only bypassing the ask gate.
- 2026-06-08: Formatter timeout, missing-card fallback, and quality-repair paths now use the same clarification evidence as the main formatter, so post-clarification fallback prose and card reasons do not revert to generic ranking claims.
- 2026-06-08: Missing-card repair now replaces noisy model prose with the concise grounded fallback when the formatter output already fails quality checks or follows a clarification continuation, instead of appending fallback cards under a broad content dump.
- 2026-06-08: Added an in-memory pending AI memory write queue for missing-schema/schema-cache timing failures. Clarification events, recommendation feedback, parameter beliefs, and context edges now enqueue instead of being lost when migrations are not visible yet, and can flush after schema availability without blocking the chat UI.
- 2026-06-08: Added a broad-clarification cooldown regression that proves unanswered `asked` cards suppress immediate duplicate broad questions but expire after the short asked-only cooldown. This keeps the assistant from barraging the user while still allowing a fresh high-EVPI question later if they never answered the old card.
- 2026-06-08: Broad ask-before-answer routing now distinguishes prioritization, next-task, overdue-triage, and task-breakdown response modes instead of collapsing them into generic task answers. This lets the clarification gate ask a relevant one-card question for "prioritize", "what should I do next", and overdue triage flows before broad recommendations.
- 2026-06-08: Guest/localhost clarification answers now persist in the AI memory database composable's local fallback, including derived `rankingFocus` parameter beliefs. This makes saved response-direction answers retrievable immediately without Supabase auth, so the same broad card is not re-asked in the next prompt while server sync is unavailable.
- 2026-06-08: Broad clarification continuations now use the recognized `general` mode instead of leaking entity IDs such as `day_plan` into the continuation marker. This keeps "what should I do next" and similar response-quality cards on the deterministic low-overwhelm path instead of falling into freeform/ReAct and surfacing bridge auth errors.
- 2026-06-08: Response-quality clarification cards now preserve a typed `responseMode` for real broad flows (`day_plan`, `prioritization`, `next_task`, `overdue_triage`, `task_breakdown`, or `smart_lanes`) while keeping `general` as the legacy/unknown fallback. Post-answer continuations now reroute through the correct deterministic tool/query instead of generic next-task selection.
- 2026-06-08: Deterministic task answers now fall back to local formatter cards when the provider fails after task data has already been read. Guest/localhost users see a compact grounded task answer instead of `AI bridge unavailable: not_signed_in`.
- 2026-06-08: Localhost Playwright smoke passed for the full ask-before-answer loop: weekly planning asks first with no recommendation dump, answering continues without a stuck running state, broad prompts ask one targeted card for prioritization/next-task/overdue/day/smart-lane/breakdown flows, recent answers suppress repeats, "too much" feedback compacts the next answer, and postpone feedback suppresses repeated tasks. Verified with `npx playwright test tests/e2e/ai-chat-quality-local.spec.ts --config=tests/e2e/playwright.ai-chat-quality-local.config.ts` after manually starting Vite on `127.0.0.1:5564`.
- 2026-06-08: Re-ran the localhost AI chat quality smoke after stale-memory active-evidence filtering and stale-refresh local retrieval proof. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed 9/9 against a manually started Vite server on `127.0.0.1:5564`, covering weekly ask-first, no pre-answer barrage, no stuck running row, compact continuation, too-much feedback, postpone suppression, and no-repeat broad clarification across prioritization/next-task/overdue/day-plan/smart-lane/task-breakdown prompts.
- 2026-06-08: Weekly post-clarification continuations now use a compact 1-3 recommendation contract across the structured prompt, validator/parser, repair prompt, and quick-draft fallback. Answering one question can produce a short useful result, but not a broad weekly dump.
- 2026-06-08: Mechanical overdue-list requests are now separated from overdue triage. `show/list overdue tasks` keeps the deterministic overdue-data tool but bypasses the broad clarification gate, while explicit triage/rank/prioritize overdue prompts still ask one targeted question before recommendations. Localhost Playwright passed 10/10 on `127.0.0.1:5564`, including the new no-clarification mechanical overdue-list case plus the explicit overdue-triage clarification case.
- 2026-06-08: Broad clarification cooldown now dedupes recently resolved identical question wording across workflow buckets, not only exact entity/question IDs. This prevents the assistant from asking the same "what should guide this answer?" prompt again for a different broad mode while still allowing mode-specific questions such as prioritization.

---

### TASK-1831A: EVPI-style clarification scoring and parameter belief tracking (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: "Ask one question at a time" is not enough unless the system asks the right question. Clarification should be chosen because it has high expected value for the answer, not because it appears first in a hardcoded list.

**Scope**:
- Define structured planning parameters: project meaning, task context, impact/stakes, stakeholders, dependencies, energy fit, history, preferences, stale context, and later deadline/scope/success criteria.
- Add heuristic EVPI scoring: uncertainty × task-planning impact × expected reduction − user-cost.
- Use EVPI scoring to select the highest-value non-repeated clarification question.
- Store EVPI details in debug/context metadata: targeted parameters, heuristic EVPI, user cost, selected score, threshold, skipped/recently-resolved candidates.
- Add `ai_parameter_beliefs` or equivalent server-backed belief records after the heuristic is proven locally.
- Update belief confidence after user answers and use answer/feedback outcomes to learn impact weights over time.

**Acceptance**:
- When multiple clarification questions are possible, the selected card is the highest-value non-repeated question by EVPI score.
- The assistant does not ask a lower-value question just because it appears first in the question list.
- Clarification debug/event context includes targeted parameters and score metadata.
- Recent answered/dismissed/generated-with-uncertainty questions are skipped and appear as skipped candidates in debug metadata.
- The heuristic remains local/fast and does not add extra LLM calls to the hot path.

**Progress**:
- 2026-06-08: Added local heuristic EVPI scoring over existing coverage dimensions, including targeted parameters, user cost, selected score, skipped candidates, clarification debug display, and event context metadata. Mounted tests verify project-meaning questions outrank broad week questions when project meaning is the high-value missing context, and recently answered questions are skipped.
- 2026-06-08: Answered clarification events now derive/update server parameter beliefs with confidence, impact weight, selected label/free text, question evidence, and missing-dimension keys. This keeps EVPI inputs durable for VPS/local parity instead of recalculating only from transient chat state.
- 2026-06-08: Broad clarification coverage now consumes durable parameter beliefs, not only recent events. Unit tests prove a saved high-confidence `rankingFocus` belief suppresses the response-direction card and lets the assistant proceed without repeating the ladder question.
- 2026-06-08: Response-quality coverage now treats prioritization, next-task, overdue-triage, and task-breakdown modes as high-materiality even when only a few task candidates are visible. A saved high-confidence `rankingFocus` belief still suppresses re-asking for those modes.
- 2026-06-08: Prioritization routing now loads the active task list rather than the overdue-only tool. This prevents "prioritize my tasks" from skipping the clarification gate simply because there are no overdue tasks.
- 2026-06-08: Broad clarification now uses heuristic EVPI candidate scoring instead of a single hardcoded mode prompt. It scores targeted parameters, skips recently resolved prompt variants, records selected score/user cost/candidate metadata in debug, and can ask the next high-value missing dimension without repeating the same generic ranking-focus question.
- 2026-06-08: Weekly planning retrieval now loads scoped `ai_parameter_beliefs` and uses them in coverage/EVPI scoring. Week/preference beliefs can raise impact or preference confidence, but project meaning and task context still require project/task-scoped evidence, so one broad answer cannot fake full project understanding.
- 2026-06-08: Broad EVPI prompt selection now refuses below-threshold fallback questions. If coverage says high-materiality context is missing but no available prompt actually targets that missing dimension with enough information value, the clarification builder returns no weak card instead of asking an unrelated low-value question just because it appears in the prompt list.
- 2026-06-08: Weekly EVPI selection now has the same below-threshold guard as broad clarification: if no non-repeated weekly question clears the EVPI ask threshold, the interview returns no card instead of falling back to any available question. Weekly coverage also consumes saved stakeholder/commitment beliefs, and regression coverage proves high-confidence weekly/stakeholder beliefs suppress a weak week-priority re-ask.

---

### TASK-1832: High-quality planning rubric and anti-fake-reasoning evaluator (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: "High quality" must be testable. The current failures are not only bugs; they are answer-quality regressions: filler prose, unsupported importance, overwhelming length, repeated questions, and recommendations that ignore consequences, commitments, dependencies, emotional friction, and project momentum.

**Scope**:
- Add a strict task-ranking rubric with bounded weights: importance/impact, life consequences, commitments, dependencies, project momentum, avoided work, energy/fit, urgency, workload realism, and confidence.
- Add bad/acceptable/excellent answer criteria for weekly planning and broader chat recommendations.
- Add automated checks that penalize generic phrases, unsupported ranking, missing evidence, excess length, and repeated clarification questions.
- Require every recommendation to cite task evidence plus project/context evidence or mark "context unknown."
- Research validation update: normalize ranking inputs with explicit caps, decay functions, and user override signals so due dates, priority, or project names cannot dominate alone.
- Research validation update: add adversarial tests for ambiguous names, conflicting corrections, prompt-injection-like free text, stale context, and high-uncertainty task sets.
- Research validation update 2: use tunable ranking bands: impact/life consequences/commitments 25-30%, dependencies/project momentum/avoided work 20-25%, energy/workload/confidence 20%, urgency/effort 15-20%, and user overrides/recency about 10%.
- Research validation update 2: aggregate repeated postpone/dismiss reasons into preference facts, for example "deep work often postponed Friday" or "not important this month."

**Acceptance**:
- Regression tests fail if answers say a task is high stakes or meaningful from a name alone.
- Tests fail on generic phrases like "looks like meaningful work" without evidence.
- Tests cover postponed/dismissed suggestions, stale context, correction overrides, and uncertainty handling.
- Tests assert visible evidence, confidence, omissions, and user override controls so ranking does not become a black box.
- Tests include cold-start, conflicting corrections, high-uncertainty sets, adversarial free text, and citation audits for unsupported prioritization.

**Progress**:
- 2026-06-08: Added `auditWeeklyPlanQuality()` with bad/acceptable/excellent scoring and validation rejection for unsupported importance, generic substantial-work phrasing, weak consequence coverage, repeated templates, and overlong plans.
- 2026-06-08: Added shared `auditChatResponseQuality()` for broader deterministic task answers so non-weekly outputs can be repaired when they are verbose, generic, metadata-only, or missing task cards.
- 2026-06-08: Broad post-clarification answers now fail the chat-quality audit when they do not visibly honor the user's clarification evidence, forcing repair to the concise grounded fallback instead of accepting a plausible but context-ignoring answer.
- 2026-06-08: Research policy update accepted: structured-output failure must retry once and then degrade to a deterministic compact draft with visible uncertainty and feedback controls; repeated clarification after a saved answer is a quality failure; low-context fallback should cap visible recommendations around 1-3 by default.
- 2026-06-08: The chat-quality audit now treats `prioritization`, `next_task`, `overdue_triage`, and `task_breakdown` as broad task-answer modes. Mode-specific regressions prove these flows fail when they ignore saved clarification evidence, cite only shallow metadata, or claim high stakes without visible uncertainty.
- 2026-06-08: Broad card answers now feed parsed card reasons into the structured recommendation-evidence audit, and the audit rejects repeated reason/evidence templates across multiple cards. Post-clarification deterministic fallback reasons now combine the user's clarification with task-specific evidence, so the fallback cannot pass by repeating the same generic clarification sentence on every recommendation.
- 2026-06-08: The broad chat-quality audit now catches visible answer prose that ignores user corrections in clarification evidence. English and Hebrew regressions fail when the user has corrected a project/task as not important or wrong-context but the assistant still calls it important, strategic, or critical.
- 2026-06-08: The broad chat-quality rubric now requires visible confidence and tradeoff/omission signals for recommendation-card answers. Tests fail card answers that hide confidence or omit what was deferred/held back, while concise answers with medium-confidence wording, explicit omissions, uncertainty, feedback controls, and learning signals remain acceptable.
- 2026-06-08: The deterministic broad formatter fallbacks now emit the same confidence and held-back/omission signals required by the stricter rubric. Browser smoke caught that the new audit initially pushed the "too much" compact path into the quality-floor candidate-only fallback; the fallback copy now stays compact while still passing the executable confidence/omission gate.
- 2026-06-08: Broad card-answer quality now fails if recommendation cards skip structured evidence auditing. Positive fixtures must provide task/context/missing-evidence arrays, so prose alone with confidence/tradeoff language cannot score acceptable.

---

### TASK-1833: Planning UI controls for accept/postpone/dismiss/feedback (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (filed 2026-06-08) | **Depends on**: TASK-1831, TASK-1832

**Why**: A trustworthy AI planner needs user agency. Suggestions should be reviewable cards with controls, not prose the user has to mentally parse and correct.

**Scope**:
- Render concise recommendation cards with "why now", expected impact, tradeoff, confidence, and inline reasoning disclosure.
- Add controls for accept/time-block, postpone, dismiss with reason, explain more, and adjust preferences.
- Save feedback as memory events so dismissed or postponed suggestions do not keep reappearing unchanged.
- Add "Too much" / simplify controls that reduce plan size and defer nice-to-haves.
- Research validation update: persist recommendation feedback separately from clarification memory: accept/postpone/dismiss/simplify/explain actions, revisit dates, outcome signals, and reasons.
- Research validation update: treat postponement as lightweight deferral, not permanent rejection.
- Research validation update 2: recommendation feedback should link back to generated plan/recommendation IDs and aggregate into preferences when patterns repeat.
- Research validation update 2: add reason categories such as too_hard, low_energy, not_important, wrong_context, already_done, needs_more_info, and free-text evidence.

**Acceptance**:
- Dismissed suggestions are downranked or hidden until cooldown/re-engagement.
- Postponed suggestions respect the chosen revisit window.
- User feedback changes future recommendations and is visible in memory/event history.
- Accepted/time-blocked/completed/timer-started suggestions become implicit positive signals for future planning.
- Postponement uses exponential backoff plus revisit triggers such as deadline proximity, weekly review, or user re-engagement.

**Progress**:
- 2026-06-08: Weekly recommendation controls now collect explicit postpone/dismiss/simplify reasons with button choices, persist `reasonCategory` + `revisitAt`, and immediately hide the rejected recommendation visually so the chat does not keep showing work the user just pushed back on.
- 2026-06-08: Broad non-weekly inline recommendation cards now persist accept/timeblock/postpone/dismiss feedback directly to `ai_recommendation_feedback` even without a weekly-plan recommendation object, and the new Later control hides the card immediately with a revisit date.
- 2026-06-08: Guest/localhost inline recommendation feedback now persists to the AI-memory local fallback instead of throwing without auth, so postpone/dismiss reasons can influence later broad answers before Supabase auth or schema availability.
- 2026-06-08: Added a localhost E2E regression proving that saved "Too much" feedback changes the next broad fallback answer into an extra-compact one-card response, even when the bridge formatter returns unusable prose or is unavailable.

---

### TASK-1834: Chat observability for slow or low-quality answers (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: The sidebar currently appears to hang while the bridge thinks. The user needs to see what phase is slow and the app needs debug data to explain latency and quality failures.

**Scope**:
- Show concise live phases: reading tasks, retrieving memory, deciding whether to ask, generating answer, formatting.
- Add timing metadata for each phase and structured fallback reasons.
- Avoid duplicate "Thinking" rows when a more specific phase is running.
- Log enough local/server debug data to diagnose bridge timeout vs memory timeout vs formatting timeout.
- Research validation update: log retrieval source counts, cache hit/miss, and path type without exposing private details in normal prose.
- Research validation update: distinguish clarify-first, generated-with-uncertainty, structured-model, reliability-fallback, and feedback-updated answer paths.
- Research validation update 2: timeline phases should map to the agent loop: Retrieve, score uncertainty, clarify/generate, cite/format, record outcome.

**Acceptance**:
- The activity timeline shows the current phase within one second.
- Weekly planning has bounded timeouts and a safe reliability fallback instead of spinning.
- Debug metadata identifies whether the answer was clarification-first, generated with uncertainty, model-planned, or fallback.
- Slow answers can be attributed to task read, memory retrieval, bridge generation, formatting, or persistence.

**Progress**:
- 2026-06-08: Chat phase activity events now update in place, preserve elapsed timing metadata, and annotate key paths such as clarify-first, structured-model, reliability-fallback, and quality-repair.
- 2026-06-08: Sidebar activity rows show concise elapsed timing so slow phases are visible without dumping debug prose into the answer.
- 2026-06-08: Clarification continuations now add a visible "Answer queued" activity row when the user answers while generation is settling, then mark it as accepted when the queued continuation is sent. This prevents the UI from looking inert after saving a clarification answer.
- 2026-06-08: Clarification cards now expose pending AI-memory write status: normal saved copy says when memory updates are queued for sync, while "Why ask?" debug includes the pending write count. This makes schema-cache/migration fallback visible without adding broad answer prose.
- 2026-06-08: Settings > AI > Memory Health now includes an "AI memory debug" snapshot for the new server-backed memory layer. It shows bounded counts for context entities, parameter beliefs, clarification events, recommendation feedback, pending sync writes, and the latest compact entity/belief/event labels so saved context is inspectable without reading raw database rows.
- 2026-06-08: Broad answer quality repair now records the exact fallback path in activity/message metadata. If the formatter fallback still fails audit, the final quality-floor guardrail is marked as `quality_floor` with source, repair stage, original failures, fallback failures, and quality-floor failures so localhost/debug proof can explain why a concise fallback appeared instead of a verbose model answer.
- 2026-06-08: Inline recommendation feedback status now renders at the message level, so postponing/dismissing the last visible inline card still shows the saved-feedback confirmation after the card is suppressed.
- 2026-06-08: AI memory debug now shows the same local fallback rows that retrieval uses during guest mode and schema-cache/missing-table rollouts. Local refreshed context entities, answered clarification events, parameter beliefs, and pending write counts remain visible instead of rendering an empty debug panel while the chat is actually using queued local memory.
- 2026-06-08: Settings > AI memory debug now uses status-aware copy instead of always saying "server-backed context." Ready state says server-backed context is available, local-only tells the user it is device-local, missing schema says chat is using local fallback and queued writes, and missing table names are shown inline. This prevents the UI from implying cross-device memory while the VPS schema gate is still red.
- 2026-06-08: Added mounted component tests for the Settings AI memory debug panel. The tests render missing-schema, local-only, and ready snapshots through `AISettingsTab` and assert the actual user-visible text, replacing source-string-only confidence with runtime component proof.
- 2026-06-08: The bounded activity timeline now preserves active `running` and `waiting_confirmation` rows before trimming completed history. A focused sidebar regression proves the specific live chat phase and path metadata stay visible even after many completed activity rows arrive, instead of falling back to a generic Thinking row.

---

### TASK-1835: Broaden memory-aware chat beyond weekly planning (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: The system should improve all FlowState chat answers over time, not only "plan my week." The assistant should remember user preferences, corrections, recurring project meanings, task-selection hints, and answer-quality feedback.

**Scope**:
- Introduce shared context retrieval for planning, prioritization, task breakdown, next-action, grouping, and reflective coaching intents.
- Add preference memory for concise/detailed mode, question frequency, planning style, and tolerated uncertainty.
- Promote user corrections into memory and suppress previously rejected framings.
- Refresh stale context with confirmation rather than silently reusing it.
- Research validation update: use hybrid retrieval: exact entity key lookup first, structured filters second, semantic/vector recall only when needed.
- Research validation update: add procedural memory for repeated workflows such as weekly planning style, preferred controls, and low-overwhelm defaults.
- Research validation update 2: keep retrieval staged: exact key lookup must be fast enough for clarify-first; semantic/vector recall can be skipped under timeout without creating fake certainty.
- Research validation update 2: add procedural preferences for concise/detailed mode, question tolerance, planning ritual style, and preferred amount of automation.

**Acceptance**:
- The same project/context answer improves later "what should I do", weekly plan, and task breakdown requests.
- User corrections stop repeated wrong framing.
- Stale context prompts are short, button-based, and respect cooldowns.
- Retrieval remains selective: only relevant facts enter the model prompt, never raw memory dumps.
- Cold-start behavior degrades gracefully to neutral candidates or one lightweight preference question.

**Progress**:
- 2026-06-08: Added a deterministic `response_quality` clarification card before high-materiality non-weekly task recommendations so day plans, smart lanes, and prioritization/overwhelm prompts can ask one button-based direction question instead of dumping broad prose.
- 2026-06-08: Response-quality clarification answers now route back into the matching deterministic flow (`day_plan`, `smart_lanes`, or general task recommendation) instead of falling through as vague freeform continuation text.
- 2026-06-08: Broader non-weekly task answers now use the shared uncertainty policy for ask/proceed/neutral decisions instead of a fixed hardcoded ask path. Focused tests cover high-materiality broad recommendations, tiny task sets that proceed with uncertainty, and cold-start neutral candidates.
- 2026-06-08: Clarification messages now suppress the generic tool-result task list while asking. Candidate tasks only appear through explicit "show candidates" style escapes, preventing the old barrage of task cards under a question.
- 2026-06-08: Broad non-weekly memory summaries now retrieve recent recommendation feedback by task/project entity keys, so later broad answers can see postponed/dismissed inline-card signals instead of only weekly plans learning from feedback.
- 2026-06-08: Broad fallback card selection now applies recent recommendation feedback: dismissed/postponed inline cards are filtered out during cooldown, while accepted/timeblocked cards get a small positive boost. Inline task feedback is matched by recommendation ID so one postponed task does not suppress the whole project.
- 2026-06-08: Broad response modes now pass their exact intent into the shared quality gate instead of collapsing to `general`, so prioritization, next-task, overdue-triage, and task-breakdown answers are held to the same groundedness and low-overwhelm contract as weekly/day planning.
- 2026-06-08: Broad task-list memory calls now pass the chat memory timeout into `retrieveBroadAIMemory`, and the retriever itself degrades to a bounded fallback with diagnostics. This keeps "what should I do" / prioritization answers responsive when server memory is slow.
- 2026-06-08: Extracted broad clarification policy into a tested pipeline module. Regression coverage now proves cold-start day/smart/general broad requests ask one concise direction question, recent answered/proceed-with-uncertainty events suppress repeats, stale decisions can refresh, and weekly planning stays on its separate interview path.
- 2026-06-08: Broad clarification cards are now mode-specific: prioritization asks what should decide the priority order, next-task asks what makes one task right now, and overdue triage asks how to treat overdue items. Tests prove these paths no longer ask the generic "what should guide this answer?" question.
- 2026-06-08: Localhost Playwright now proves broad-flow behavior for `prioritize my tasks`, `what should I do next?`, and `show me overdue tasks`: each prompt asks one mode-specific card before recommendations, hides task cards while asking, saves the button answer, leaves no stuck running activity, and does not re-ask the same question on the next prompt.
- 2026-06-08: Extracted broad fallback task ranking into a tested pipeline module so non-weekly fallback answers use the same feedback-aware suppression/boost rules as retrieved memory. The chat path now imports the tested ranker instead of hiding feedback logic inside the composable.
- 2026-06-08: Broad clarification coverage now includes energy fit, dependencies, history, and stakeholders for the modes where those dimensions materially affect output. This lets next-task prompts ask about energy when impact is already known and prioritization prompts move from impact to dependency/momentum questions after the first answer.
- 2026-06-08: Localhost Playwright broad-flow proof now also covers day planning (`I'm overwhelmed, reorder my day`), smart lanes (`Suggest smart lanes for my current tasks`), and broad task breakdown (`break down my tasks into next steps`). These flows ask one clarification card before recommendations, hide task cards while asking, save the answer, avoid re-asking on the next prompt, and leave no stuck running activity.
- 2026-06-08: Broad task breakdown routing is now read-first. Generic requests to break down current tasks load the active task list and use `task_breakdown` response mode instead of firing the `create_subtasks` write action before clarification/confirmation.

---

### TASK-1836: Recommendation feedback and postponement memory (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1833

**Why**: Research validation flagged that plans will keep feeling repetitive unless accept/postpone/dismiss actions become durable learning signals. Postponed work should not reappear every plan unchanged, and accepted work should become evidence of what the user actually follows through on.

**Scope**:
- Add a server-backed `recommendation_feedback` table or equivalent event type.
- Persist action, reason enum, optional free text, revisit date, recommendation/task IDs, and outcome signals.
- Downrank or hide postponed/dismissed suggestions until revisit/cooldown.
- Use accepted/time-blocked/completed/timer-started suggestions as positive follow-through signals.
- Link feedback to generated plan/recommendation IDs when available.
- Aggregate repeated explicit and implicit feedback into durable preference facts.
- Store `implicit_positive` signals from timer start/completion separately from explicit feedback.

**Acceptance**:
- A dismissed recommendation does not immediately reappear as a top suggestion.
- A postponed recommendation respects the revisit date.
- Feedback changes ranking evidence in later weekly/next-action responses.

**Progress**:
- 2026-06-08: Added mounted regression coverage that verifies a postponed weekly recommendation saves `generatedPlanId`, `recommendationId`, task/project entity key, reason category, revisit date, and becomes visually suppressed in the current plan.
- Feedback reason patterns become inspectable preference memory rather than hidden ranking magic.
- 2026-06-08: Broad non-weekly task-answer memory now retrieves recent `ai_recommendation_feedback` by UUID task IDs and text entity keys (`task:*`, `project:*`), so inline accept/postpone/dismiss signals can affect later broad answers even when task IDs are local or synthetic.
- 2026-06-08: Guest/localhost recommendation feedback now uses the same local AI-memory fallback as clarification answers. Local postpone/dismiss feedback is retrievable by task/entity key and derives parameter beliefs such as `energy_fit`, `ranking_focus`, and `task_recommendation_fit` for later suppression/reweighting.
- 2026-06-08: Broad fallback ranking now uses retrieved feedback directly: recent dismiss/postpone events suppress tasks until cooldown/revisit, simplify applies a smaller penalty, and accept/timeblock/implicit-positive events boost follow-through.
- 2026-06-08: Recommendation feedback now promotes conservative durable parameter beliefs after the raw feedback event is saved. Simplify/too-much updates `preference:brevity`, low-energy/too-hard updates `energy_fit`, not-important/wrong-context/needs-more-info updates `rankingFocus`, and accept/timeblock/implicit positives update `history`; rollout tests prove feedback still flushes even if the belief table is unavailable.
- 2026-06-08: Added direct broad fallback ranking regressions for local task IDs: dismissed cards are suppressed during cooldown, postponed cards stay hidden until revisit, inline project feedback does not suppress every task in the project, and accept/timeblock-style feedback boosts later follow-through ranking.
- 2026-06-08: Broad inline recommendation feedback now shows a visible saved/local status after postpone/dismiss-style actions, not only weekly-plan feedback. Localhost E2E proves postponing a broad inline card hides that exact card immediately and suppresses the same task from the next broad fallback answer without asking the same clarification again.
- 2026-06-08: Repeated recommendation feedback now aggregates into durable preference-level beliefs after three matching signals. Too-much feedback strengthens `preference:brevity`, low-energy/too-hard strengthens `preference:energy_fit`, weak-context/not-important feedback strengthens `preference:ranking_focus`, and repeated accept/timeblock signals strengthen `preference:follow_through`; broad and global memory retrieval now fetch those aggregate preference keys so saved learning can influence later chat answers instead of staying as isolated events.
- 2026-06-08: Weekly recommendation feedback now records the exact task entity key as the primary correction target and preserves project context as outcome metadata. Legacy project-key feedback from task cards is treated as task-specific when the recommendation ID names the task, so rejecting one weekly card does not suppress sibling tasks in the same project.
- 2026-06-08: Broad fallback ranking now has direct regression coverage for time-blocked and implicit-positive recommendation feedback, not only explicit accept. These follow-through signals boost matching tasks in later broad answers, protecting the required positive-learning path for accept/timeblock/timer-style outcomes.
- 2026-06-08: Added `ignore` as a first-class recommendation feedback action in TypeScript, migrations, schema contracts, local fallback memory, and broad fallback ranking. Ignored recommendations now create a mild ranking-focus backoff signal without fully suppressing the task, matching the research requirement for ignored suggestions to become learning data rather than disappearing as no-ops.

---

### TASK-1837: Memory lifecycle, summarization, and retention policy (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830

**Why**: Research validation flagged memory bloat and stale facts as the biggest architectural gap. Append-only clarification events are useful for auditability, but without summarization and retention the system will get slower, noisier, and harder to trust.

**Scope**:
- Define fact promotion rules: what becomes durable memory vs. event-only evidence.
- Add confidence decay and stale confirmation rules.
- Summarize old events into compact semantic facts while preserving corrections.
- Archive or compact old low-value events after a retention window.
- Re-index summaries for semantic retrieval.
- Use reinforcement count and last reinforced date to slow decay for repeatedly confirmed facts.
- Summarize on schedule or size threshold; only promote high-confidence verified facts.
- Archive old low-value events after a defined window while keeping corrections and source links auditable.

**Acceptance**:
- Memory retrieval stays bounded as event count grows.
- Old facts become stale and ask for confirmation instead of being reused as fresh truth.
- Corrections remain auditable after summarization.
- Stale facts trigger confirmation when accessed for a materially important recommendation.

**Progress**:
- 2026-06-08: Added a central `memoryLifecycle` policy that computes effective confidence with decay/reinforcement, flags explicit stale dates and old confirmations for refresh, detects noisy event history for summarization, and counts year-old events for retention/archive follow-up.
- 2026-06-08: Weekly memory retrieval diagnostics now include lifecycle summary fields (`staleEntityKeys`, `refreshEntityKeys`, `summarizeEntityKeys`, `archiveEventCount`, `lowConfidenceEntityCount`) without injecting raw memory text into normal prompts.
- 2026-06-08: Verified the lifecycle slice with focused lifecycle/retrieval/sidebar tests, the AI regression bundle, `npm run type-check`, and localhost web `npm run build`; Electron packaging remains intentionally deferred for this lane.
- 2026-06-08: Clarification-card debug disclosure now surfaces memory lifecycle pressure (`need refresh`, `need summary`, old events, low confidence) behind "Why ask?" so diagnostics are inspectable without adding normal-response clutter.
- 2026-06-08: Localhost browser smoke on isolated `http://127.0.0.1:5562` loaded the app, dismissed onboarding, opened the AI sidebar, and captured `/tmp/flowstate-ai-debug-smoke-sidebar.png`; this proves the updated chat UI is not blank or blocked, but Stage 8 full prompt-to-answer smoke is still pending.
- 2026-06-08: Broad task-memory retrieval now computes the same lifecycle diagnostics as weekly retrieval. Stale synthetic/project facts, refresh-needed context, noisy summaries, old events, and low-confidence counts are exposed through retrieval diagnostics and a compact `memory lifecycle` evidence line, while the chat activity metadata carries those lifecycle counts for debug disclosure instead of adding normal answer prose.
- 2026-06-08: Added a deterministic lifecycle snapshot builder that compacts selected entities and clarification events into a bounded, sanitized `AIMemorySnapshotInput` with source counts, confidence, summary facts, and a future `staleAfter`. This creates the concrete artifact background summarization jobs can write later, without blocking the current localhost chat flow.
- 2026-06-08: Broad ask-before-answer now turns refresh-needed lifecycle signals into a first-class stale-context card before broad ranking. The card asks whether the old context is still true, stores the answer against the stale entity key, and fetches recent events for that entity so the same refresh is not asked again immediately. Focused tests prove stale refresh outranks generic broad-ranking questions and recent refresh answers suppress repeats.
- 2026-06-08: Server-backed clarification answers now refresh `ai_context_entities` lifecycle fields directly: answered events update `last_answered_at`, `last_reinforced_at`, increment `reinforcement_count`, reset `decay_score`, and roll `stale_after` forward by 45 days. This makes stale-context confirmations actually fresh in server memory instead of only adding an audit event.
- 2026-06-08: Guest and schema-cache fallback clarification answers now maintain local `AIContextEntity` rows as well as events/beliefs. Fetching `ai_context_entities` during localhost or missing-schema rollout returns the refreshed local entity, including `last_answered_at`, `last_reinforced_at`, `reinforcement_count`, `decay_score`, and future `stale_after`, so stale refresh cards do not immediately repeat before Supabase tables are ready.
- 2026-06-08: Parameter beliefs now have the same lifecycle metadata needed for repeat-question suppression and stale refresh. Added server columns/indexes for `stale_after`, `last_reinforced_at`, `reinforcement_count`, and `decay_score`; authenticated and local fallback belief writes now refresh those fields so saved clarification preferences can decay or refresh instead of staying permanently fresh.
- 2026-06-08: Weekly and broad memory retrieval now treat stale/low-confidence parameter beliefs as refresh-needed rather than active evidence. Stale remembered answers no longer suppress clarification, force compact-answer preferences, or enter planning prompts; lifecycle diagnostics expose stale/refresh-needed belief keys so debug output can explain why a saved answer was not reused.
- 2026-06-08: Broad clarification now turns stale parameter-belief diagnostics into a refresh card, not just debug metadata. The card targets the owning workflow/preference entity, stores the refreshed belief field, and fetches recent refresh events for stale belief entity keys so answered refreshes do not immediately repeat.
- 2026-06-08: Weekly planning now has the same stale-belief refresh path as broad planning. Weekly retrieval fetches clarification events for week/preference/workflow belief keys, and `buildWeeklyPlanningInterview` asks a focused refresh card for stale remembered answers before ranking from old saved priorities.
- 2026-06-08: Post-clarification weekly continuation now avoids the slow broad model pass and returns a bounded local 1-3 item quick draft from saved context/task signals. The sidebar also flushes queued clarification continuations on the next tick after generation settles, so answers are not dropped while the prior clarification card is completing. Verified with the AI regression bundle and the localhost Playwright AI-chat quality smoke (`10 passed`).
- 2026-06-08: Lifecycle snapshot compaction now preserves user corrections as bounded, sanitized snapshot facts and includes a short corrections line in the compact summary. This keeps correction history auditable after noisy clarification events are summarized, instead of letting summarization erase "the user corrected this framing" evidence.
- 2026-06-08: Authenticated clarification-derived parameter beliefs now refresh the same lifecycle fields as local fallback beliefs: `stale_after`, `last_reinforced_at`, `reinforcement_count`, and `decay_score`. This keeps VPS/server-backed answers from immediately aging out or being re-asked after a stale-context refresh confirmation.
- 2026-06-08: Memory snapshots now obey the same freshness policy as entities and parameter beliefs. Weekly, broad, and global retrieval filter stale or low-confidence compact summaries out of prompt evidence, keep their keys in lifecycle diagnostics, and expose stale/refresh-needed snapshot counts so old summaries cannot silently suppress clarification or create fake certainty.
- 2026-06-08: Weekly and broad memory retrieval now convert lifecycle summarize-needed diagnostics into bounded compact snapshot write suggestions, and the chat pipeline persists up to three suggestions in the background through the resilient `ai_memory_snapshots` local/queued/server upsert path. This turns noisy clarification history into compact memory without blocking visible answers.

---

### TASK-1838: Hybrid retrieval and latency budget for AI memory (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1835

**Why**: Research validation flagged retrieval latency as a risk. Server memory improves answer quality but can make the sidebar feel slow unless retrieval is exact, selective, cached, and progressively enhanced.

**Scope**:
- Retrieval order: exact entity keys, structured filters, recent events, semantic/vector recall only when needed.
- Add cache keys and short TTLs for active conversation/project memory.
- Track retrieval timings and source counts in debug metadata.
- Limit prompt injection exposure by summarizing retrieved user text as evidence, not instructions.
- Add memory coverage score computation to retrieval output.
- Support optional pgvector/vector_embedding later, but keep exact key lookup as the primary source of truth.

**Acceptance**:
- Clarify-first path appears quickly even when semantic retrieval is skipped or slow.
- Memory retrieval has a clear timeout/fallback that does not produce fake certainty.
- Debug data identifies cache hit/miss and retrieval stage timings.
- Memory retrieval can return "insufficient coverage" as an intentional state instead of forcing generation.

**Progress**:
- 2026-06-08: Extracted weekly memory retrieval into a bounded SQL-first helper. The helper retrieves UUID-only legacy contexts, server context entities, clarification events, recommendation feedback, and graph edges separately so synthetic buckets never enter UUID-only calls. Semantic/vector recall remains pgvector-ready metadata only until the database function is available. Focused tests cover bounded diagnostics, feedback/event counts, synthetic bucket safety, and timeout fallback.
- 2026-06-08: Added `broadMemoryRetrieval` for non-weekly task-list answers. The helper keeps UUID-only legacy calls filtered to real UUIDs, sends synthetic/local entities through text keys (`project:uncategorized`, `task:local-task`), includes safe quoted evidence from parameter beliefs and recent clarification answers, and returns concise retrieval diagnostics for future debug display.
- 2026-06-08: Added `globalChatMemory` for non-task/freeform responses. It exact-fetches workflow/preference entities, recent clarification decisions, and selected parameter beliefs with a 1.5s timeout in the chat pipeline, producing a compact quoted-evidence packet instead of raw memory prose.
- 2026-06-08: Broad/global retrieval now exact-fetches compact `ai_memory_snapshots` before generation. Snapshot evidence is bounded, sanitized, counted in diagnostics, and covered by focused retrieval tests so future summarization jobs can reduce prompt bloat without adding a separate graph/vector dependency.
- 2026-06-08: Weekly planning retrieval now exact-fetches compact `ai_memory_snapshots` for user/project/task/week scopes, passes sanitized snapshot evidence into the weekly-plan prompt, and carries `snapshotCount` through diagnostics/debug metadata. Focused tests cover retrieval, prompt sanitization, and timeout fallback.
- 2026-06-08: Playwright global setup now clears `ai_memory_snapshots` with the other AI memory tables, preventing stale summarized memory from hiding clarification-first regressions in localhost smoke tests.
- 2026-06-08: Weekly and broad memory retrieval diagnostics now include per-stage timing data for legacy contexts, exact entities, clarification events, parameter beliefs, recommendation feedback, graph edges, and snapshots. The clarification debug disclosure surfaces the slowest memory stages behind "Why ask?", so slow answer reports can point to the retrieval stage instead of only showing one total elapsed time.

---

### TASK-1839: Privacy, RLS, and prompt-injection hardening for AI memory (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830

**Why**: Research validation flagged privacy and prompt injection risk. User-authored memory can contain private data and arbitrary text, so it must remain tenant-scoped and must not become an instruction channel.

**Scope**:
- Verify RLS for context entities, clarification events, and recommendation feedback.
- Add cross-user access tests for memory tables.
- Sanitize/free-text handling: store raw user text as evidence but inject it into prompts only as quoted data.
- Add export/delete hooks or documented paths for future privacy controls.
- Add prompt-injection regression tests where free text tries to override the system or reveal unrelated memory.
- Keep raw user text out of system-role instructions; inject as quoted evidence with source labels only.

**Acceptance**:
- One user cannot read or write another user's AI memory rows.
- Free-text memory cannot override system rules in prompt construction.
- Memory rows are inspectable and deletable through supported code paths or documented migration follow-up.
- Prompt-injection-like memory text cannot change output policy or cross-entity retrieval boundaries.

**Progress**:
- 2026-06-08: Added quoted/sanitized prompt evidence handling for AI memory and an explicit policy that saved user free text is evidence only, not an instruction channel.
- 2026-06-08: Weekly planning now treats stale project/task context as an uncertainty dimension and asks a short refresh question instead of silently ranking from expired memory.
- 2026-06-08: Settings > AI memory debug now has a Clear action for the new server-backed AI memory layer. It removes user-scoped AI context edges, recommendation feedback, parameter beliefs, clarification events, context entities, pending AI-memory writes, and local fallback rows, with tests covering both guest/local and authenticated server deletion paths.
- 2026-06-08: Chat-quality audits now fail prompt-injection-like clarification or recommendation evidence (`ignore previous instructions`, `system prompt`, reveal-memory requests, etc.). This turns the "quoted evidence only" policy into an executable safety gate for memory-backed broad answers.
- 2026-06-08: AI memory snapshots are now included in schema contracts, debug inspection, and clear/delete paths, so compacted memory rows inherit the same user-scoped privacy/debug behavior as context entities, clarification events, parameter beliefs, feedback, and graph edges.
- 2026-06-08: Added the missing RLS delete policy for `ai_clarification_events`. Clarification history remains append-only during normal assistant operation, but authenticated users can now clear their own event rows through the memory clear/delete path. Schema contract tests now require user-owned delete policies for every clearable AI memory table.
- 2026-06-08: Added authenticated schema-missing clear/delete regression coverage. When the server AI-memory tables are still absent from PostgREST, clearing AI memory now proves local fallback rows and queued writes are removed so old clarification/feedback events cannot flush later and repopulate memory after a user clear.

---

### TASK-1840: Explicit uncertainty scoring and cold-start policy (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: Research validation flagged that "uncertainty score" was too vague to implement consistently. The assistant needs a deterministic policy for ask vs. proceed with uncertainty vs. neutral candidates.

**Scope**:
- Compute coverage across impact, energy fit, stakeholders/commitments, dependencies, history, and preferences.
- Compute materiality by intent: weekly planning and prioritization are high materiality; mechanical list/show actions are low materiality.
- Ask one question when coverage is below 0.5 and materiality is high.
- Proceed with visible uncertainty when coverage is 0.5-0.8 or materiality is medium/low.
- For cold-start, show one lightweight question or neutral candidates without ranking claims.

**Acceptance**:
- The same task set consistently chooses ask/proceed/neutral based on coverage and intent.
- Low-context weekly planning does not produce a ranked plan unless the user chooses uncertainty.
- Mechanical actions are not blocked by unnecessary clarification.

**Progress**:
- 2026-06-08: Extracted the ask/proceed/neutral decision rule into a shared uncertainty policy, including high-materiality ask thresholds, medium-coverage proceed-with-uncertainty behavior, and neutral cold-start handling. Focused tests cover high/medium/low materiality, forced missing project/stale context, sufficient context, and cold-start behavior.
- 2026-06-08: Routed mechanical overdue display requests separately from overdue triage. Unit coverage proves `show overdue` / `list overdue tasks` still retrieve overdue tasks but have no `overdue_triage` response mode, while `triage overdue tasks` remains high-materiality and asks before ranking. Browser coverage proves the visible chat shows data without a clarification gate for `show me overdue tasks`.
- 2026-06-08: Added a direct uncertainty-policy regression for low-materiality mechanical requests with non-empty candidates and very low coverage. These now proceed with visible uncertainty instead of being blocked behind a clarification question, preserving the distinction between list/show actions and high-materiality ranking.

---

### TASK-1841: Agent-memory evaluation rubric and citation audit (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1832

**Why**: Research validation recommended scoring answer quality across groundedness, brevity, uncertainty, learning, user control, realism, and safety. FlowState needs this as an evaluation suite, not subjective review.

**Scope**:
- Add a bad/acceptable/excellent rubric for groundedness, scannability, uncertainty handling, learning/adaptation, user control, realism, and safety.
- Add citation audits proving recommendations reference supplied task/memory evidence or explicitly mark unknown.
- Add LLM-as-judge or scripted checks for filler, unsupported prioritization, repeated questions, and prompt-injection vulnerability.
- Include human-review scenarios for cold-start and conflicting memory.

**Acceptance**:
- Eval fails on fake reasoning even when prose sounds polished.
- Eval fails on broad generic plans that exceed the low-overwhelm contract.
- Eval catches repeated clarification questions inside cooldown.
- Eval fails when structured output fails but the response does not use deterministic fallback.
- Eval fails when low coverage/high materiality produces broad ranking instead of a high-EVPI question or visible uncertainty escape.
- Eval fails when recommendation cards lack feedback controls or learning signals.

**Progress**:
- 2026-06-08: Extended `auditChatResponseQuality()` with executable checks for response path, coverage score, high materiality, structured-output failure, deterministic fallback, repeated post-clarification questions, visible uncertainty, feedback controls, escape hatches, debug disclosure, and learning signals.
- 2026-06-08: Added a structured recommendation citation audit. Recommendations now fail quality checks when they cite only task metadata or project names as context, pass when they explicitly mark project/context evidence unknown, and score excellent only when task evidence is paired with real success/stakes/why/dependency context.
- 2026-06-08: Wired the structured citation audit into weekly-plan validation and weekly quality scoring. A model weekly plan can no longer satisfy "project understanding" by citing a grounded project label; it must cite real project/task context or explicitly mark context unknown.
- 2026-06-08: Added a regression for the realistic cache-first weekly-planning case where task notes/subtasks exist but project meaning is still unknown. The clarification policy now treats project meaning and stale context as forced missing dimensions in EVPI scoring, so a project-understanding question beats a broader week-priority question when project meaning is the blocker.
- 2026-06-08: Added mode-specific chat-quality regressions for prioritization, next-task, and overdue-triage outputs. These tests prevent polished but fake broad answers from bypassing the audit just because they are not weekly/day-plan response modes.
- 2026-06-08: Broad post-clarification quality gates now check the actual selected/free-text clarification value, not just generic "your clarification" wording. Answers that claim to honor a clarification but omit the user's chosen value fail with `clarification_value_not_reflected`; paraphrased free-text answers pass when they preserve meaningful terms.
- 2026-06-08: Broad answer scannability audits now inspect the rendered line structure before whitespace normalization. Numbered recommendation dumps with too many visible items fail with `too_many_visible_items`/`too_many_low_context_recommendations`, which routes them into the deterministic repair path instead of letting a long prose list reach the chat.
- 2026-06-08: Added prompt-injection evidence regressions to the answer-quality suite. Saved clarification/free-text memory and recommendation evidence that tries to become instructions now fails with explicit safety errors instead of relying only on prompt wording.
- 2026-06-08: Added conflicting-correction citation audits. If saved context evidence says the user corrected prior high-stakes/importance framing, a recommendation that still calls the task high stakes, strategic, critical, or meaningful fails with `conflicting_correction_ignored`; neutral handling of the correction remains acceptable.
- 2026-06-08: Added stale-context citation audits. Recommendation evidence now fails with `stale_context_used_as_active_evidence` when expired/refresh-needed memory is cited as active project understanding, while stale context marked as missing/needs refresh remains valid uncertainty evidence.
- 2026-06-08: Added a deterministic broad-answer quality floor after the normal formatter and fallback both fail audit. The final user-visible fallback is capped to one candidate card, marks project context as unknown/needs refresh, and preserves the user's clarification value instead of leaking verbose or fake reasoning.
- 2026-06-08: Recommendation-card learning signals are now an executable quality gate. If broad task cards expose feedback controls but the response path does not prove those controls feed memory/learning, the audit fails with `feedback_not_recorded_as_learning_signal`; the runtime marks inline card groups as learning-enabled because accept/postpone/dismiss actions write recommendation feedback.
- 2026-06-08: The bad/acceptable/excellent chat-quality rubric now includes an explicit realism/load dimension. Broad card sets with 4-5 recommendations are capped at acceptable with a `broad_recommendation_load` warning, while 6+ broad recommendations fail with `unrealistic_recommendation_load`; warnings now prevent an answer from scoring excellent.
- 2026-06-08: Missing debug disclosure on deterministic fallback, clarification-first, or structured-output-failure paths is now a hard answer-quality failure instead of a warning. This keeps reliability fallbacks inspectable and prevents low-overwhelm repair paths from hiding why the model output was replaced.
- 2026-06-08: Unknown-context broad answers now fail if they still claim a task is strategic, high stakes, important, critical, meaningful, or consequential, even when the prose also says context is unknown. The only passing pattern is to explicitly avoid the importance claim, for example "project context unknown, so do not treat this as high stakes." Focused quality tests now cover both the rejected fake-certainty case and the allowed negated-importance case.
- 2026-06-08: Added Hebrew/RTL coverage for the same unknown-context fake-certainty rule. A Hebrew next-task answer that says context is missing but still calls the work meaningful/critical now fails the answer-quality audit, protecting the actual Hebrew sidebar flow from the English-only version of the regression.
- 2026-06-08: Broad card answers now fail with `missing_recommendation_evidence_audit` when they omit structured recommendation evidence entirely. This prevents polished confidence/omission prose from bypassing the task/context/missing-evidence citation audit.

---

### TASK-1842: Localhost end-to-end QA lane for AI chat quality (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (filed 2026-06-08, completed 2026-06-13) | **Depends on**: TASK-1830, TASK-1831, TASK-1832, TASK-1833, TASK-1838

**Why**: The user should not be asked to test half-built behavior. Localhost must prove the full chat loop before Electron or user validation: context retrieval, one-question clarification, saved answer continuation, concise output, feedback controls, and slow-phase debug.

**Scope**:
- Run the localhost app and test the chat in browser against the real UI, not only unit tests.
- Verify the weekly plan path asks before broad output when context is missing.
- Verify answering a clarification persists locally/server-side when schema exists or continues with quoted answer fallback when schema is missing.
- Verify the assistant does not dump long generic plan prose unless the user chooses "continue with uncertainty."
- Verify feedback controls suppress/postpone recommendations and show concise state changes.
- Capture debug evidence for retrieval, clarification, generation, and persistence phases.

**Acceptance**:
- Browser test evidence shows the user-visible behavior changed.
- No active test case leaves the sidebar stuck after a clarification answer.
- No generic plan dump appears before the clarification gate is satisfied or bypassed explicitly.
- Known missing pieces are listed as lane tasks, not handed to the user as "please test."

**Progress**:
- 2026-06-08: Localhost smoke against `http://127.0.0.1:5546` seeded ambiguous tasks, sent "what should I do next?", verified exactly one clarification card, no recommendation cards/long-plan markers before answering, a second follow-up after a button-only answer, enabled input, and no stuck running activity. Screenshot evidence: `/tmp/flowstate-ai-chat-quality-smoke-pass.png`.
- 2026-06-08: Added repeatable guest-mode Playwright smoke `tests/e2e/ai-chat-quality-local.spec.ts` plus dedicated localhost config `tests/e2e/playwright.ai-chat-quality-local.config.ts`. The smoke seeds the real `FlowStateReadCache` IndexedDB layer used by the current cache-first app boot, opens the real AI sidebar, sends "Help me plan this week from my tasks", verifies exactly one clarification before any weekly plan/inline cards/candidate-card barrage, answers one clarification, verifies no follow-up gate appears, verifies no running activity row remains, verifies the input is enabled, and captures `/tmp/flowstate-ai-chat-quality-stage8.png`.
- 2026-06-08: Extended the localhost smoke to cover the post-clarification plan and feedback loop. After the user answers the clarification ladder, structured-model failure now falls back to a compact deterministic quick draft instead of the empty "not reliable enough" plan, no second "quick question before ranking" appears, repeated unknown-stakes wording is suppressed, the "Why ask?" debug disclosure exposes coverage/retrieval/EVPI details, postponing a recommendation opens reason/revisit controls, saving feedback hides the recommendation immediately even in guest mode, and no running activity row remains.
- 2026-06-08: Re-ran the localhost smoke after fixing the project-meaning clarification gap. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed on localhost: the flow loaded seeded cache-first tasks, asked before broad weekly output, continued after saved answers, showed compact recommendation cards, saved postpone feedback, hid the postponed card, and left zero running activity rows.
- 2026-06-08: Extended and re-ran `tests/e2e/ai-chat-quality-local.spec.ts` for broad non-weekly prompts. The localhost browser proof now covers weekly planning plus prioritization, next-task, and overdue-triage one-card clarification loops with no pre-answer recommendation barrage and guest-mode no-repeat memory.
- 2026-06-08: Extended and re-ran the localhost browser proof for day-plan, smart-lane, and broad task-breakdown prompts. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` now covers 8 prompt paths and passes with no pre-answer recommendation barrage, no repeated clarification after the saved answer, and no stuck activity row.
- 2026-06-08: Extended and re-ran the localhost browser proof for broad feedback suppression. The suite now covers 9 prompt/feedback paths, including broad postpone feedback that visibly saves, hides the exact card immediately, and prevents the same task from reappearing in the next broad answer.
- 2026-06-08: Re-ran the 9-path localhost smoke after quality-floor observability and inline feedback-status fixes. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed 9/9 against a manually started Vite server on `127.0.0.1:5564`.
- 2026-06-08: Re-ran the 9-path localhost smoke after turning recommendation-card learning signals into an audit failure. The Playwright webServer helper still timed out before tests started, so Vite was started manually on `127.0.0.1:5564`; `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` then passed 9/9.
- 2026-06-08: Extended and re-ran the localhost smoke for mechanical-vs-triage overdue behavior. The suite now has 10 paths and proves `show me overdue tasks` displays overdue data without any clarification card, while `triage my overdue tasks` still asks the mode-specific "How should I treat overdue tasks?" card, saves the answer, suppresses repeats, and leaves no stuck activity row.
- 2026-06-08: The AI chat quality localhost smoke is now self-contained: Playwright starts Vite through `scripts/start-ai-chat-quality-server.cjs` instead of requiring a manually started server. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed 10/10 from a clear port, proving the prompt -> clarification -> concise answer/feedback/no-repeat loop can be verified before user testing.
- 2026-06-08: Re-ran the self-starting localhost AI chat quality smoke after stale-snapshot lifecycle filtering. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed 10/10, covering weekly ask-first, no pre-answer recommendation barrage, no stuck post-answer activity, compact/too-much feedback behavior, broad postpone suppression, mechanical overdue list bypass, targeted broad clarifications, and no-repeat memory across broad modes.
- 2026-06-08: Re-ran the real localhost AI chat quality smoke after the weekly EVPI threshold hardening to guard against hollow unit-only progress. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed 10/10 with the self-starting Vite server on `127.0.0.1:5564`, proving the current UI still handles weekly ask-first, post-answer continuation, compact fallback, too-much feedback, broad postpone suppression, mechanical overdue bypass, targeted broad clarifications, no-repeat memory, and no stuck activity rows.
- 2026-06-08: Re-ran the real localhost smoke after adding confidence/omission answer-quality gates. The first full run exposed a real regression where the "too much" compact path fell through to the candidate-only quality floor; after updating deterministic fallback wording, the targeted compact-path smoke passed and the full self-starting Playwright smoke passed 10/10 again.
- 2026-06-08: Re-ran the real localhost smoke after requiring structured recommendation-evidence audits for broad card answers. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed 10/10, including weekly ask-first, post-answer continuation, no stuck activity rows, compact "too much" feedback behavior, broad postpone suppression, no-repeat memory, and mechanical overdue-list bypass.
- 2026-06-08: Extended the self-starting localhost AI quality smoke to open the real Settings modal and verify AI memory debug shows local-only fallback truthfully in guest mode. `npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts` now passes 11/11, covering the original chat loop plus Settings > AI memory debug not claiming server-backed context before the VPS schema gate is green.
- 2026-06-13: Re-ran the self-starting localhost QA lane and exposed a shared startup regression: all 22 AI chat paths failed before opening chat because `/#/tasks` rendered zero seeded tasks. Root cause: cache-first startup loaded the seeded `FlowStateReadCache`, auth resolved signed-out, then the signed-out cache cleanup cleared the task store/read cache and never reloaded guest `flowstate-guest-tasks`.
- 2026-06-13: Fixed signed-out startup to reload guest-local task/project/canvas data after authenticated read-cache cleanup, preserving the cache privacy boundary without dropping guest data. Added `tests/unit/ai-chat-startup-sync.test.ts` coverage for that startup contract.
- 2026-06-13: Verification: `npm test -- tests/unit/ai-chat-startup-sync.test.ts` → 2/2 passed; `npx playwright test -c tests/e2e/playwright.ai-chat-quality-local.config.ts` → 22/22 passed. The suite now covers weekly ask-first, Hebrew rest-of-week routing, weekly prompt variants, bridge stream timeout fallback, obsolete weekly follow-up suppression, answered priority continuation, generate-now escape, broad compact feedback, weekly accept feedback, broad postpone suppression, mechanical overdue bypass, Settings AI memory debug, and six broad clarification/no-repeat paths.
- 2026-06-13: Release verification: `npm run type-check` → passed; `npm run electron:build` → passed and validated package metadata. Electron updater deployment verified at `https://in-theflow.com/updates/electron/latest-linux.yml` with `version: 1.4.161`; both `FlowState-1.4.161-x86_64.AppImage` and `FlowState_1.4.161_amd64.deb` returned HTTP 200.
- 2026-06-13: Fixed canvas regular multi-delete so selected task nodes are removed from Vue Flow in one synchronous update before the async move-to-inbox undo/persistence loop, preventing tasks from disappearing one by one. Verification: targeted red/green regression in `canvasDeleteUndo.test.ts`, `npm test -- src/composables/canvas/__tests__/canvasDeleteUndo.test.ts`, `npm test -- tests/unit/canvas-delete-contract.test.ts`, `npm test -- tests/unit/undo-entrypoint-contract.test.ts`, `npm run type-check`, and Electron updater deployment `1.4.162` verified via `https://in-theflow.com/updates/electron/latest-linux.yml`; both `FlowState-1.4.162-x86_64.AppImage` and `FlowState_1.4.162_amd64.deb` returned HTTP 200.

---

### TASK-1843: Electron packaging and updater gate after localhost stabilization (⏸ DEFERRED)

**Priority**: P1 | **Status**: ⏸ DEFERRED (filed 2026-06-08) | **Depends on**: TASK-1842

**Why**: The user explicitly paused Electron work for this flow. Electron packaging and updater verification should happen only after localhost proves the behavior is correct.

**Scope**:
- Re-enable Electron build only after localhost AI chat QA passes.
- Run desktop-specific UI checks for the sidebar and updater delivery.
- Build Electron, verify update artifacts, then deploy only when explicitly re-enabled.

**Acceptance**:
- `npm run electron:build` is not used as proof for this lane until localhost is stable.
- Electron updater work resumes only when the user asks to move from localhost to desktop delivery.

---

### TASK-1828: Apply AI context memory migration and validate live chat learning (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (filed 2026-06-07)

**Why**: The project/task understanding memory layer is implemented in code, but production still needs the Supabase migration applied and a live chat pass confirming that button answers persist, are recalled, and change future planning evidence.

**Scope**:
- Apply `supabase/migrations/20260607190000_ai_context_memory.sql` to the live Supabase project.
- In Electron, answer one project-understanding clarification card and verify `project_contexts` plus `memory_events` rows are created.
- Ask for a weekly plan again and verify recommendations cite `projectContext`/`taskContext` or explicitly mark `missingContext`.

---

### TASK-1829: Apply AI clarification memory migration after UI wiring (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED (filed 2026-06-08)

**Why**: `supabase/migrations/20260608090000_ai_clarification_memory.sql` adds a general clarification-memory schema, but the current app still uses the earlier project/task context tables. Keep the additive migration preserved in git, then apply it only when the UI/service path writes and reads these records.

**Scope**:
- Wire the clarification answer flow to `ai_context_entities` and `ai_clarification_events`, or remove the migration before release if the older `project_contexts`/`task_contexts` schema remains the chosen path.
- Apply the migration to production only after the code path is live-ready.
- Validate RLS with one user-owned answer and one rejected cross-user access attempt.

---

### ~~TASK-1815~~: Flagship flow — "Overwhelmed → AI reorders my day" (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.93 deployed) | **Depends on**: TASK-1814 (AI chat now intelligent)

**Why**: The original primary ask. When the user feels overwhelmed, the AI should propose a concrete reordered plan for the day — not just list tasks. TASK-1814 made the chat reason well + render grouped prioritization cards; this turns that reasoning into an *actionable reorder* (sequence + time-blocks the user can accept/apply).

**Scope**:
- An "I'm overwhelmed" entry point (button + natural-language trigger) that runs the prioritization brain and returns a sequenced day plan.
- Reuse the grouped-cards rendering (`cardGroups` metadata, `cardsBlock.ts`) — each group becomes a block of the day, ordered, with the stake reason.
- "Apply this order" action: write the proposed order back (respect canvas geometry invariants — only via the proper task-order write path, never sync).
- Honest fallback when capacity says "don't do all of it" (the model already surfaces this — make it actionable: defer/snooze the rest).

**Context**: Builds directly on `useAIChat.ts` deterministic + ReAct paths, `buildRichTaskData`, and the holistic prompt. Measure with `tests/manual/ai-prioritization-eval.mjs`. See skill `flowstate-ai-chat`.

**Shipped**: Explicit overwhelm/reorder prompts now route to a deterministic day-plan mode (`list_tasks` with rich task context), instruct the bridge brain to emit ordered focus blocks via `cards kind=day_plan`, and render an **Apply this order** action on grouped AI cards. Applying the plan uses the existing undo-aware bulk task update path to set selected tasks for today and stack them at the top of the Today canvas group, preserving existing Today tasks after the AI-ordered sequence. Regression coverage: `ai-day-plan.test.ts`, `ai-intent-day-plan.test.ts`, `ai-cards-block.test.ts`, plus an e2e spec for the stubbed bridge day-plan UI path. Local e2e run was blocked by invalid local Supabase service-role JWT; direct Vite/browser smoke mounted the AI route.

---

### ~~TASK-1816~~: Flagship flow — Smart task lanes (AI suggests lanes + breaks big tasks into them) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.94 deployed) | **Depends on**: TASK-1814, TASK-1812 (add-tasks-to-lane shipped)

**Why**: The second original ask. When creating a task lane, the AI should (a) suggest strong lanes for the user's work, and (b) break a large task down into actionable sub-tasks placed into that lane.

**Scope**:
- "Suggest lanes" — AI proposes lane names/themes from the user's actual tasks + work patterns (reuse rich-data context).
- "Break this down into the lane" — given a large task, emit a structured breakdown (reuse the `useAITaskAssist` `breakDownTask` JSON contract, already tested) and create the sub-tasks into the chosen lane via TASK-1812's add-to-lane path.
- Structured output + index-referenced items like the cards block, so results render as reviewable items before commit.

**Context**: Combine `useAITaskAssist` (breakdown JSON parsing, 7 unit tests) + TASK-1812 lane plumbing + the bridge. Reuse `cardsBlock.ts` structured-output pattern. Est. below.

**Shipped**: Explicit lane/smart-lane prompts now route to a deterministic `smart_lanes` mode (`list_tasks` with rich task context). The bridge formatter emits `cards kind=smart_lanes` with existing task refs plus optional `newTasks` for child-task breakdowns. AI chat renders reviewable lane cards with an **Apply lanes** action. Applying creates lanes via the existing lane store, assigns referenced existing tasks through undo-aware bulk updates, and creates suggested child tasks in the new lane through `createTaskWithUndo`. Regression coverage: `ai-intent-smart-lanes.test.ts`, `ai-cards-block.test.ts`, plus an e2e stub for the smart-lanes UI path. Local authenticated Playwright remains blocked by local Supabase service-role configuration; direct Vite/browser smoke mounted the AI route.

---

### ~~TASK-1822~~: Claude↔Codex failover brain for the AI chat (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, v1.4.106) | **Depends on**: TASK-1814

**Why**: The subscription brain ran a single fixed CLI (Claude OR Codex by setting) with no automatic failover — if it errored or ran out of credits, the chat hard-failed (or fell to weak Groq/Ollama). User wants the two CLI brains to be a failover chain, no Groq/Ollama.

**Shipped**: Internal failover in `bridgeProvider.ts` — `generate()`/`generateStream()` try the preferred brain (`aiBrain`), then fail over to the other on `BridgeUnavailableError` thrown before any token (auth/429/502/no-credits); never switches mid-stream. `routerFactory.ts`: when the subscription is on, the chain is the bridge only (Claude+Codex) — dropped Groq/Ollama (OpenRouter possible future tail). Low blast radius (no `RouterProviderType`/`isBridgeActive`/cards-gating changes). 6 failover unit tests (`tests/unit/bridge-failover.test.ts`, mocked brains).

---

### ~~TASK-1823~~: Project-local Superpowers skills trial (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-07)

**Why**: Trial the useful parts of `obra/superpowers` inside FlowState without letting its always-on workflow override this repo's existing MASTER_PLAN, OMX, autonomy, Electron release, and push rules.

**Scope**:
- Add only namespaced, project-local Superpowers support skills for debugging, TDD, verification, and code review.
- Do not install the intrusive always-on `using-superpowers` workflow or branch-completion/worktree flows in v1.
- Keep the install limited to `.claude/skills` plus the local skill registry; no app runtime files, Codex global install, Electron build, or deploy.

**Shipped**: Added namespaced project-local Superpowers support skills under `.claude/skills/superpowers-*` for systematic debugging, TDD, verification, requesting/receiving code review, and writing plans. Registered them in `.claude/config/skills.json` with explicit `superpowers-*` triggers and documented in `CLAUDE.md` that they are support-only and do not override FlowState/OMX/Master Plan/Electron rules. Intentionally omitted the always-on `using-superpowers`, worktree, and branch-finishing flows.

---

### ~~TASK-1824~~: Ground weekly planner recommendations and AI chat sync state (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, Electron v1.4.138 deployed) | **Depends on**: TASK-1814

**Why**: Weekly planning still treated small home errands and substantial work too similarly, could miss subtask evidence, and produced weak follow-up questions. AI chat sync also had a resurrection path where locally cached conversations could be uploaded again after remote deletion or when Supabase already had real history.

**Shipped**: Weekly planner snapshots now include subtasks, domain classification, substantial-work scoring, quick-errand scoring, weekend deferrals, and option-based follow-up questions. Quick drafts prefer meaningful work commitments over small errands, cite open subtasks as evidence, and propose next actions from the first open subtask when available. AI chat conversation merge now stores sync metadata, remembers remote-known/deleted conversation IDs, suppresses welcome-only local ghosts when real remote history exists, and avoids re-uploading conversations already known to be deleted remotely. Project labels now stay visible across task surfaces. Regression coverage: weekly planner/sidebar tests, AI chat sync resurrection tests, task project row tests, and undo entrypoint contract coverage.

---

### ~~TASK-1825~~: FlowState-safe Superpowers auto-router trial (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-07)

**Why**: Make the project-local Superpowers trial activate more naturally without installing the upstream always-on `using-superpowers` behavior that can conflict with FlowState autonomy, MASTER_PLAN tracking, OMX routing, and Electron shipping rules.

**Shipped**: Added `.claude/skills/superpowers-flowstate-auto-router/SKILL.md` as a FlowState-safe routing layer for bugs, behavior changes, reviews, planning, and completion checks. Registered broad-but-subordinate triggers in `.claude/config/skills.json` and documented the auto-routing trial in `CLAUDE.md`. The router explicitly preserves FlowState authority and routes to the existing namespaced `superpowers-*` support skills instead of upstream always-on Superpowers.

---

### ~~TASK-1826~~: Surface Superpowers auto-router to Codex instances (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-07)

**Why**: The FlowState-safe Superpowers router was documented in `CLAUDE.md`, but new Codex/AGENTS-driven instances primarily receive `AGENTS.md`, so they would not reliably know to use it.

**Shipped**: Added a project-local Superpowers auto-router section to `AGENTS.md` that points agents at `.claude/skills/superpowers-flowstate-auto-router/SKILL.md`, lists the task shapes where it should be used, and keeps FlowState rules authoritative over Superpowers.

---

### ~~TASK-1836~~: Add Codex-discoverable Superpowers wrappers (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-08)

**Why**: Other Codex instances still did not reliably use Superpowers because the canonical project skills lived only under `.claude/skills`, which is not a Codex skill-discovery surface.

**Shipped**: Added `.codex/skills/superpowers-*` wrapper skills that point to the canonical `.claude/skills/superpowers-*` project skills, and strengthened `AGENTS.md` so Codex/AGENTS-driven instances MUST use `superpowers-flowstate-auto-router` for bugs, fixes, behavior changes, reviews, planning, and completion checks unless the request is trivial or another higher-priority workflow clearly applies.

---

### ~~BUG-1821~~: "Plan my week" misrouted to the completed-tasks summary (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, v1.4.105) | **Depends on**: BUG-1820

**Why**: "תעזור לי לתכנן את השבוע" (plan ahead) returned a retrospective list of already-completed tasks. The greedy bare `'השבוע'` keyword (`toolHints.ts`) matched the planning phrase and routed it to `get_weekly_summary`. Also a "no focus time in the data" prose leak.

**Shipped**: Predicate/tense decides intent, not the time word. Added `isWeekPlanRequest` + `normalizeForRouting` (Hebrew niqqud/particle tolerant) in `dayPlan.ts`; removed the greedy bare `'this week'`/`'weekly'`/`'השבוע'` triggers; added a forward `week_plan` card mode (`intentRouter`/`cardsBlock`/`useAIChat`). Ambiguous phrasing now falls to the model (rides the TASK-1822 failover chain) instead of guessing. Fixed the `weekly_review` focus-time prose leak. Red→green routing matrix + `isWeekPlanRequest` truth table (`deterministic-pipeline.test.ts`, `week-plan-request.test.ts`).

---

### ~~BUG-1820~~: Weekly AI summary fabricated tasks instead of showing real cards (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07) | **Depends on**: TASK-1814

**Why**: The weekly summary ("סיכום שבועי") named tasks in prose but showed no clickable cards, and the count/task-names/categories/insights were all LLM-fabricated. Root cause: `get_weekly_summary` returned only 3 integers (a stats object), so the card pipeline's `hasTaskList` gate never fired and `parseCardGroups` had no task array to index; the model only saw a count + ≤10 generic titles, so it invented the rest. Tool descriptions over-promised "focus time/streak/XP" (priming hallucination) and downstream code read phantom `totalFocusMinutes`/`currentStreak` never populated.

**Fixed**: `get_weekly_summary` now returns the real array of completed-this-week tasks (`{id,title,priority,projectId,status,completedAt}`) + real focus minutes from non-break timer sessions (omitted, never faked, when none) — so `hasTaskList` engages and the tasks render as real clickable cards. Added `responseMode:'weekly_review'` (both router return points) + a weekly cards instruction in `useAIChat` that groups completed tasks by project and forbids inventing numbers/names/categories/insights (ungrounded trends/recommendations dropped per decision). `ChatMessage` renders `kind:'weekly_review'` cards read-only (done badge, no done/timer actions, still clickable). `cardsBlock` whitelists the new kind; `useAgentChains` end-of-day review + non-bridge `preDigestedReasoning` digest adapted to the array shape; over-promising tool descriptions trimmed. Coverage: weekly-review parse test + grounded weekly-digest test (ai-cards-block + ai-pipeline green; full vue-tsc clean on all touched files).

**Files**: `src/services/ai/tools.ts`, `src/services/ai/pipeline/intentRouter.ts`, `src/composables/useAIChat.ts`, `src/components/ai/ChatMessage.vue`, `src/composables/useAgentChains.ts`, `src/services/ai/pipeline/preDigestedReasoning.ts`, `src/services/ai/pipeline/cardsBlock.ts`, tests.

---

### ~~TASK-1817~~: Ship the AI chat improvements beyond localhost (web + Electron) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.92 deployed) | **Depends on**: TASK-1814

**Why**: All TASK-1814 work is committed + verified on localhost dev only. Per project rules 6/7, a production push must ship BOTH web (VITE_SITE_URL) and an Electron auto-updater build in the same release. Desktop users are otherwise left on the old dumb AI.

**Shipped**: Safely replayed the TASK-1814 AI stack onto fresh `origin/master` to avoid reverting already-live v1.4.89-v1.4.91 work, bumped to `1.4.92`, built Electron, deployed via `./scripts/deploy-electron-update.sh --notes "TASK-1814: intelligent AI chat + grouped cards"`, and verified `https://in-theflow.com/updates/electron/latest-linux.yml` returns `version: 1.4.92`. Bridge server on the VPS is unchanged (client-only changes) — no bridge redeploy needed.

---

### ~~TASK-1818~~: AI cards polish — suppress mid-stream JSON flash + pin common phrasings to deterministic (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.95 deployed) | **Depends on**: TASK-1814

**Why**: Two known soft spots from TASK-1814 review. (1) During streaming, the `cards` JSON block briefly shows as raw text before it's stripped on completion (cosmetic). (2) Freeform phrasings (e.g. "מה המשימות הכי דחופות", "help me prioritize", "i'm overwhelmed") route to ReAct, where cards are reliable-but-not-100%; common prioritization phrasings should be pinned to the deterministic path (100% reliable) + added to the regression suite.

**Scope**: Strip `stripCardsBlock` from the streaming display path (not just finalize). Broaden `toolHints.ts` keyword coverage (Hebrew plural "דחופות", "המשימות הכי", "help me prioritize", "overwhelmed", "מה חשוב עכשיו") → `get_overdue_tasks`. Add an e2e asserting no JSON ever appears mid-stream.

**Shipped**: ReAct streaming now keeps raw model output for parsing but displays a `stripStreamingCardsBlock`-sanitized copy on every chunk, including split code-fence prefixes like ` ```ca`, so `cards` JSON cannot flash before final parsing attaches grouped cards. Common prioritization/overwhelm phrasings in English and Hebrew now pin to `get_overdue_tasks` through `toolHints.ts`. Regression coverage: `ai-cards-block.test.ts` for streaming partial fences, `ai-pipeline.test.ts` for deterministic hint routing, and an authenticated Playwright spec with a delayed bridge `ReadableStream` asserting no `cards` JSON appears while the answer is still streaming. Local Playwright remains blocked before test execution by missing `SUPABASE_SERVICE_ROLE_KEY`; unit/type/build gates pass.

---

### ~~TASK-1819~~: AI chat message language override (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.96 deployed) | **Depends on**: TASK-1814

**Why**: The AI chat header already lets the user control text direction, but mixed Hebrew/English work still tied assistant replies to detected input language. Users need a separate setting for the assistant's message language so replies can be forced to English or Hebrew without changing layout direction or app language.

**Scope**: Add a **Message Language** selector in the AI chat settings header with Auto, English, and Hebrew. Persist the choice in AI chat settings. Apply it only to assistant output language in deterministic and ReAct chat paths; keep intent detection based on the user's actual prompt.

**Shipped**: AI chat settings now include a persisted Message Language control. Auto keeps the previous detected-language behavior; English and Hebrew force assistant replies in that language across deterministic tool responses, bridge/ReAct prompts, confirmations, cancellations, and selected-task helpers. Regression coverage: pure language resolution/mismatch tests, AI chat store persistence tests, AIChatPanel selector interaction test, full unit suite, typecheck, import validation, CSS validation, and Electron build.

### ~~TASK-1821~~: Fix canvas group collapse silently no-opping on Electron (settling-guard race) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07) | **Depends on**: BUG-1813

**Why**: Canvas group collapse/expand was unreliable on the Electron desktop app while passing the existing local test. Child-task hiding only recomputes inside `syncStoreToCanvas`. The orchestrator collapse-signature watcher re-synced via `batchedSyncNodes()` **without `force`**, so `syncNodes()` dropped it whenever the canvas was inside the drag-settling / remote-update guard window (`canAcceptRemoteUpdate=false`), and it also early-returned on `persistence.isSyncing`. Because it's a signature watcher, a dropped fire never recovers — children stay visible until the next toggle. Electron realtime storms (BUG-1799) keep that guard closed far more often than a quiet browser, so the existing test (realtime off, guard always open) never reproduced it.

**Shipped**: Collapse watcher in `useCanvasOrchestrator.ts` now calls `batchedSyncNodes(undefined, { force: true })` (collapse is user-initiated, mirroring the other forced syncs) and no longer early-returns on `isSyncing`/`isSyncingFromWatcher` (read-only sync can't re-trigger the collapse signature, so there's no loop to guard). Added a DEV/test-only `window.__canvasOpState` seam in `useCanvasOperationState.ts` so e2e can drive the real state machine into drag-settling. New regression test `tests/e2e/canvas-collapse-local.spec.ts` → "group collapse hides children during the drag-settling guard window (TASK-1821)" collapses inside the guarded window; it fails without the fix and passes with it. Verified: collapse e2e (2 passed), 185 canvas/geometry unit tests pass. **Not yet deployed** — needs version bump + `deploy-electron-update.sh` per rules 6/7.

---

### ~~TASK-1820~~: Make desktop AI sidebar-first with visible live action feedback (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, Electron v1.4.103 deployed) | **Depends on**: TASK-1814

**Why**: Desktop AI had two competing surfaces: a standalone `/ai` section and the global right-side assistant panel. The assistant should feel like an always-available sidebar tool, and users need to see what it is doing when it reads tasks or performs actions.

**Shipped**: Removed the desktop `/ai` header tab, kept the sparkles button as the primary desktop entrypoint, preserved mobile `/mobile-ai-chat`, and changed `/ai` into a compatibility fallback that opens the sidebar then returns to the main workspace. Added a compact live Activity timeline in `AIChatPanel` backed by real AI tool execution state: thinking, read/write/destructive execution, confirmation waiting, success/failure, cancellation, and undo availability. Added an explicit `New Chat` control in the sidebar header so a fresh thread is discoverable without opening history or using the destructive clear-chat icon. Follow-up v1.4.98 adds canvas visual grounding: AI tool results now carry affected task IDs, timeline rows can reveal linked tasks, and canvas cards receive subtle read/pending/changed/removed spotlight states without transform-based motion. Follow-up v1.4.99 hides raw tool-result task cards while the assistant is still thinking, adds a deterministic formatter timeout/fallback so task answers do not spin indefinitely, and tightens card-answer prose to a clear "start with X, then Y" recommendation. Regression coverage: `tests/unit/ai-sidebar-first.test.ts` covers desktop nav removal, mobile route preservation, `/ai` fallback wiring, activity state semantics, rendered timeline rows, visible New Chat conversation creation, activity reveal events, transform-free canvas spotlight wiring, no pre-answer task-card flash, and formatter timeout fallback wiring. Verified: focused Vitest, `vue-tsc`, Playwright browser smoke, Electron build, live updater manifest/artifacts.

---

> **Last Updated**: 2026-06-06
> **Token Target**: <25,000 (condensed from ~50,000)
> **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md`

---

## Active Tasks

### TASK-1943: Reliable Hermes–FlowState personal-assistant program (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-13) | **Depends on**: TASK-1797, BUG-1942 | **Related**: FEATURE-1943

**Goal**: Deliver one reliable personal-assistant lane in which VPS Supabase is the canonical signed-user task authority; Hermes dynamically clarifies and decomposes vague work; FlowState mutations are previewed, applied exactly once, and read back; monitor events do not self-interrupt; and Notion is safely writable according to explicit user needs.

**Program scope**:
- Safe branch recovery and complete production-writer inventory.
- Canonical operation, revision, receipt, replay, and change-sequence contract.
- Migration of task, subtask, instance, recurrence, timer, focus, project, group, lane, settings, and context writers.
- Compact interactive Hermes decomposition with directly editable ordered steps.
- Durable monitor assessment, suppression, retry, dead-letter, and attention lifecycle.
- Writable Notion task creation/property updates plus explicit FlowState activation and stable provenance.
- Regression, fault-injection, watchdog, packaged Electron, PWA, Hermes, and approval-gated production verification.

**Subtasks**:
- [ ] **TASK-1944 — Canonical operation, revision, and change-sequence foundation**: recover onto a fresh branch, classify existing work, inventory every production writer, add the signed-user operation ledger and canonical revisions, preserve legacy writers through compatibility triggers, return replayable read-back receipts, and provide durable sequence catch-up.
- [ ] **TASK-1945 — Canonical Local API task patch adoption**: replace direct sidecar task patches and Hermes HTTP-success inference with the TASK-1944 preview/apply/base-revision contract, validate canonical receipts at both boundaries, and preserve exact replay after response loss.
- [ ] **TASK-1947 — Deterministic canonical change-sequence catch-up**: persist a signed-user personal/workspace cursor, consume bounded ordered change-log pages as invalidation hints, reconcile exact task IDs authoritatively, and advance only after projection persistence succeeds.
- [x] **TASK-1946 — Canonical web/PWA offline scalar task-patch adoption**: after TASK-1947, preserve stable operation identity through the Dexie queue for eligible scalar task edits, execute preview/apply with the signed-user TASK-1944 command, persist receipts before completion, and quarantine conflicts without weakening status, recurrence, geometry, instance, or subtask invariants. Completed 2026-07-13.
- [x] **TASK-1948 — Canonical Notion task activation**: add signed-user preview/apply activation from stable Notion provenance through the TASK-1944 operation, preview, revision, and change-log authority; create at most one active FlowState task per user/source/page; atomically add an exact approved work block even when the task already exists; and return a replayable canonical receipt verified by the Local API. Completed 2026-07-14.
- [x] ~~**TASK-1949 — Canonical assistant reliability harness and watchdog**: execute the combined canonical task and Notion activation contracts against a disposable database, inject same-operation and conflicting-operation races, keep the focused cohort in the fixed daily regression lane, and alert on redacted canonical/Notion integrity failures without touching production data.~~ Completed 2026-07-14.
- [x] ~~**TASK-1950 — Classify renderer-to-sidecar auth recovery precisely**: distinguish an expired cached signed-in shell, bounded token-refresh recovery, and a genuinely blind sidecar; return actionable protected-route errors and keep the live-boundary diagnostic from raising false sidecar-delivery incidents.~~ Completed 2026-07-14.
- [x] ~~**TASK-1951 — Production UUID compatibility for canonical assistant contracts**: make canonical task/Notion RPCs, rollback suites, and the VPS watchdog portable across text-ID development schemas and UUID production schemas; ship a forward migration and repeat live rollback-only proof before enabling writers.~~ Completed 2026-07-14.
- [ ] **TASK-1952 — Hydrate Electron auth backup into the live Supabase client**: replace the ineffective post-startup storage reread with supported session hydration, preserve stale-token reconnect behavior, and prove packaged protected assistant reads recover after restart.
- [x] ~~**TASK-1953 — Preserve blocked remote Canvas projection updates**: coalesce remote task/group projection requests while Canvas interaction guards are active, replay the latest store state after the operation returns idle, and prove two-client geometry cannot remain stale after Realtime updates the store.~~ Completed 2026-07-14.
- [x] **BUG-1954 — Recover signed-in Electron from an empty renderer projection**: shipped in Electron 1.4.255; authenticated empty projections now rebaseline the still-active scope, and the true Canvas empty-state surface uses the opaque design-system overlay.
- [x] ~~**BUG-1955 — Restore packaged exact-task reads**: make the detailed Local Task API serializer execute safely with absent, null, empty, or malformed subtasks; add an executable source-and-bundle regression; and ship a version above Electron 1.4.255 with live Hermes read-back proof.~~ Completed 2026-07-14 in Electron 1.4.256.
- [ ] **TASK-1956 — Reliable complete FlowState task inventory for Hermes**: recover renderer-to-sidecar auth after restart, expose a typed complete paginated open-task inventory with stable receipts, and prevent partial or stale samples from becoming exact assistant counts.
- [ ] **TASK-1957 — Atomic recurrence-aware duplicate merge for Hermes**: let an approved merge preview resolve an explicit canonical recurrence only for safe root tasks with no occurrence history, bind that resolution into the receipt, and make unresolved recurrence conflicts stop further assistant mutations.
- [x] ~~**TASK-1959 — Receipt-backed audit coverage, claim guardrails, and screenshot reconciliation**: add a durable machine-checkable audit coverage receipt (scope, source surface, snapshot, exact reviewed/unreviewed IDs, unresolved rows, completeness class, per-item evidence class), a claim classification guardrail (verified/partial/inferred/blocked/unknown) that blocks "reviewed everything" wording without proven full item coverage, and a screenshot-row reconciliation workflow where visible rows (incl. Hebrew/multiline) never count as exact reviewed tasks without identity proof.~~ Completed 2026-07-15.
- [x] ~~**TASK-1958 — Canonical non-recurring task completion for Hermes**: dedicated `flowstate_complete_task_v1` preview/apply completion with approval digest, committed receipt, `completedAt` read-back, typed `recurring_task`/`already_completed` rejections, and disposable-DB runtime regression.~~ Completed 2026-07-15; production migration + Electron ship still pending.
- [x] ~~**TASK-1959 — Redacted FlowState source-to-runtime truth ledger**: generate one stable, secret-free ledger across source, local build, public release, installed AppImage, and live sidecar truth; keep release builds non-live by default and expose mismatches instead of inferring deployment success.~~ Completed 2026-07-15.
- [ ] **TASK-1960 — Make complete inventory the only exhaustive assistant task boundary**: label capped list/search responses as filtered samples, align inventory item revisions with the canonical receipt contract, and fail closed across large scans, repeated concurrent changes, and scope switches.
- [ ] **TASK-1961 — Shared canonical assistant receipt validation**: validate canonical JSON hashes, operation/request identity, revisions, sequences, timestamps, and domain read-backs through one Local API boundary before any renderer notification; migrate patch, completion, recurring completion, and duplicate merge without accepting legacy HTTP-only success.
- [ ] **TASK-1962 — Preflight every Hermes-to-FlowState route and ship canonical task creation**: deliver the receipt-backed task lifecycle route, make source and bundled-sidecar runtime tests exercise the real HTTP boundary, publish a safe capability manifest, and fail Hermes/package/watchdog checks before work starts when any required route or contract is absent.
- [ ] **TASK-1963 — Canonical atomic subtask breakdown contract**: port the preview-bound, revision-checked, replay-safe subtask batch RPC onto current main without reverting newer receipt/auth work; expose canonical ordered subtask reads for Hermes and reject malformed existing arrays before mutation.
- [x] **BUG-1964 — Sign in once, stay signed in until explicit Sign Out**: replace destructive passive auth-event handling with durable account identity retention, reject invalid Electron release credentials before packaging, and prove sign-in plus close/relaunch/update persistence in the packaged app. ✅ DONE 2026-07-18

**Acceptance**:
- No production surface can claim a canonical mutation from only an optimistic cache write, queued intent, Local API HTTP success, or Realtime delivery.
- One operation ID replays the original durable receipt after timeout, retry, process restart, or duplicate submission.
- Hermes exposes a compact editable breakdown and asks only the first unresolved consequential question.
- Notion reads and approved writes are user-scoped, previewable, idempotent, and verified by read-back.
- Monitor-originated work is structured, coalesced, retryable, causally suppressible, and marked seen only after durable handling.
- All synchronized entity cohorts and packaged production surfaces pass their program gates before this parent closes.

**Safety**: Repository-local tests and disposable fixtures are autonomous. Production mutations, deployments, credentials, destructive cleanup, and scope expansion remain exact approval boundaries.

**2026-07-14 release repair**: Public Electron 1.4.257 was held after inspection found two complete Debian member triplets appended into one `.deb`; the AppImage itself remained structurally valid. The package validator now requires exactly one `debian-binary`, one `control.tar.*`, and one `data.tar.*`, while the builder removes only same-version target artifacts and the manifest before packaging. Local 1.4.258 built successfully: the AppImage is `180392753` bytes, the deb is `131375480` bytes with one exact member triplet, and the manifest names 1.4.258. The disposable reliable-assistant database harness now also applies `20260713011000_merge_tasks_rpc.sql` and executes the rollback-only merge suite; merge preview/apply, transfer, replay, conflict, scope, injected failure rollback, canonical task, and Notion contracts all passed. Public deployment and the production merge migration remain held at their explicit approval boundaries.

### TASK-1963: Canonical atomic subtask breakdown contract (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-16) | **Depends on**: TASK-1944, TASK-1945, TASK-1961

**Scope**:
- Recover only the canonical subtask batch contract from the stale H10 history onto a fresh current-main worktree; never merge or cherry-pick the divergent branch wholesale.
- Replace Local API in-memory/direct JSONB batch writes with the signed-user `flowstate_subtask_batch_v1` preview/apply RPC using operation identity, base revision, preview digest/expiry, request hash, and canonical receipt validation.
- Return exact ordered subtask reads with workspace, revision, and canonical timestamp metadata through revision-bound pages of at most 100 rows; validate the complete stored array before slicing and fail closed on malformed or duplicate persisted identities.
- Preserve current main's auth recovery, scope enforcement, shared receipt validation, audit guardrails, and unrelated Local API routes.
- Prove normalization, preview non-mutation, exact apply/read-back, replay, stale revision, altered payload, malformed existing rows, cross-scope denial, and concurrent operation safety without touching production data.

**Acceptance**:
- Hermes can preview one exact ordered create/update/delete breakdown, approve that immutable proof, and apply it exactly once against the same parent revision.
- The Local API cannot report canonical success without verifying the RPC result, primary affected task, canonical receipt, and reflected subtask read-back.
- Duplicate client IDs, subtask IDs, malformed existing rows, stale revisions, expired previews, and changed payloads return typed errors without partial writes.
- Existing current-main fixes are preserved, focused tests pass, and no package, deployment, or live task mutation occurs in this slice.

**Progress (2026-07-16)**: The current-main recovery now uses the H3 read-back and shared receipt validator already present on `origin/master`, avoiding the stale H4 lifecycle dependency. Source and Electron-bundle runtime tests cover bounded pages, invalid cursors and limits, malformed rows beyond the first page, and typed revision conflicts; the disposable database harness covers preview/apply/replay/rollback and simultaneous stale writes without production data.

**Cross-review hardening (2026-07-16)**: Exact normalized approval operations are now separated from enriched execution/read-back rows, including deep Canvas position equality. The migration losslessly backfills the current-main no-order shape, rejects post-state overflow above 10,001 rows in preview and apply, and returns the current revision from both stale paths. Signed-user source and Electron runtime tests preserve legacy singular preview fields while proving that receipt-free apply remains blocked.

### BUG-1964: Sign in once, stay signed in until explicit Sign Out (✅ DONE 2026-07-18)

**Priority**: P0 | **Status**: ✅ DONE 2026-07-18 (filed 2026-07-18) | **Depends on**: TASK-1952

**Exact failure mode**: Electron 1.4.268 embedded a Supabase public key that production rejected with HTTP 401 during PKCE exchange and refresh. A passive auth-js `SIGNED_OUT` event then erased the renderer account after two seconds, while terminal refresh recovery deleted the token backup without retaining a credential-free identity for the next cold start.

**Acceptance**:
- A valid production public key is recognized before an Electron build starts; rejected, unreachable, redirected, or timed-out credentials fail closed without logging credentials or response bodies.
- Background refresh, focus, sleep/resume, network recovery, app close/relaunch, and updater restarts cannot erase the remembered account or account-owned cache.
- A terminal refresh token may be removed, but the credential-free account identity survives cold restart and all remote writes remain gated until a fresh server session exists.
- Only the explicit Sign Out action clears the remembered identity, auth storage, account stores, caches, and pending account writes.
- Focused regressions, full type/lint/test gates, Electron package validation, live updater manifest, real sign-in, and packaged close/relaunch proof pass before completion.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Packaged Google sign-in returned to FlowState but stayed on the sign-in modal. | Yes |
| Renderer auth state | Yes | Passive `SIGNED_OUT` cleared user/session after a two-second timer. | Yes |
| Electron main/preload | Yes | PKCE callback reached the renderer; failure occurred at the backend token exchange. | Release credential boundary |
| Supabase/auth persistence | Yes | Installed key returned 401; current production key was recognized; terminal backup cleanup lost cold-start identity. | Yes |
| Updater/runtime version | Yes | Installed runtime remained 1.4.268 and carried the rejected key. | New version and release gate |
| Stale live process state | Yes | Reproduced twice against the actual packaged profile and callback listener. | Relaunch proof required |

**Explicitly not covered**: silently granting remote access with an expired/rejected token. The remembered account shell and local ownership persist, while remote sync remains fail-closed until authentication recovers.

**Follow-up hardening (2026-07-18)**: Expanded the recurring-issue audit beyond the original rejected-key failure. Regression coverage now protects identity-only startup errors, every passive null-session event, auth-js listener lock safety, cross-account reconnects, durable Electron storage failures, updater and ordinary-quit checkpoints, and recovery UI that must not present a remembered user as signed out. Explicit Sign Out remains the sole account-clearing transition and cancels all delayed recovery work.

**Remaining operational classes**: Future production-key rotations must overlap old and new public keys until released clients have adopted the replacement. Multiple independently installed builds or deliberately changed Electron profile directories remain separate profiles and cannot share a local session by design; release validation and single-instance/profile pinning are the controls for the supported app path.

**Completion proof (2026-07-18)**: 58 focused auth/release regressions and the full 3,893-test suite passed, type-check and Electron build completed, and the live updater published 1.4.269. On the installed packaged app, Google sign-in created the primary session, Electron backup, and credential-free identity; after every packaged process was terminated and the app relaunched, diagnostics again reported 1.4.269 with an authenticated user, remote sync enabled, and no reauthentication requirement.

### TASK-1944: Canonical operation, revision, and change-sequence foundation (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-13) | **Depends on**: TASK-1943, TASK-1797, BUG-1942 | **Related**: FEATURE-1943

**Scope**:
- Recover compatible work onto a fresh branch from current `origin/master`; never merge the divergent stale branch or discard the dirty worktree.
- Produce an exhaustive writer matrix for web, PWA/offline queue, Electron, Local API, recurrence, subtasks, instances, timers, Canvas, and Hermes.
- Add an RLS-scoped durable operation ledger keyed by user and operation ID.
- Add independent canonical row revisions, tombstones, and a monotonic change sequence.
- Install compatibility triggers before writer migration so legacy writes receive revisions and change events.
- Add preview/apply/read-back contracts whose committed response is a durable replayable receipt.
- Prove duplicate replay, dropped responses, restart recovery, stale-base conflicts, cross-user denial, and missed-Realtime catch-up.

**Acceptance**:
- A committed response always names the canonical revision, sequence, timestamp, read-back projection, and read-back hash.
- A repeated operation ID with the same request returns the original receipt; a changed payload returns a typed conflict.
- Legacy writers remain functional while being marked as legacy and emitting canonical revisions/change events.
- A client with Realtime disabled converges through its durable sequence cursor.
- No production write or deployment is used for this slice without explicit approval.

**Progress (2026-07-13)**: The repository-local W0 task foundation now includes actor-bound idempotent previews, a signed-user patch RPC, independent task revisions, compatibility capture, a global RLS-filtered change cursor, replayable read-back receipts, workspace role/scope protection, and the dependency-ordered production writer matrix in `docs/process/canonical-writer-matrix.md`. Static contracts, a rollback-only SQL suite, injected-failure coverage, and multi-session preview/apply races pass against a disposable local database. Production remains unchanged; Local API/offline writer migration and explicit catch-up clients are still pending.

### TASK-1945: Canonical Local API task patch adoption (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-13) | **Depends on**: TASK-1944, TASK-1797

**Scope**:
- Add failing Local API and Hermes adapter tests that reject HTTP-only, queued, malformed, mismatched-operation, or incomplete receipt responses.
- Make task patch preview the default and require the exact issued operation ID, preview digest/expiry, base canonical revision, and normalized payload for apply.
- Call `flowstate_patch_task_v1` under the renderer user's signed-in Supabase session instead of updating `tasks` directly.
- Return the canonical preview/result unchanged across the sidecar boundary and validate committed receipt/read-back/hash fields before Hermes reports success.
- Preserve legacy endpoint compatibility only as an explicit non-canonical response; do not silently translate a legacy direct patch into committed success.
- Prove preview zero-write, apply receipt, dropped-response replay, stale base, altered payload, unauthenticated/offline, and renderer reconciliation behavior.

**Acceptance**:
- Local API task patches cannot return canonical success without a validated TASK-1944 receipt.
- Hermes never mutates from a plain-language task update without first returning an exact preview for approval.
- Repeating an approved operation after a lost response returns the original receipt with `replayed=true` and no second revision.
- Existing list/search reads and unrelated Local API actions remain compatible while writer cohorts migrate incrementally.
- Production remains unchanged until the migration, signed-in packaged verification, and deployment boundary are separately approved.

**Progress (2026-07-13)**: The Local API task PATCH path is now preview-first and calls the signed-user `flowstate_patch_task_v1` contract instead of directly updating `tasks`. It validates complete preview and committed receipt identities, revisions, sequences, timestamps, read-back projections, and SHA-256 fields before renderer reconciliation; safely preserves durable success when renderer notification fails; redacts connector failures; refuses service-role impersonation; and exposes canonical revisions through personal/shared task reads using one workspace-scoping helper. The complete Local API regression cohort passes. Hermes adapter migration and packaged signed-in proof remain pending, so this task stays in progress.

### TASK-1947: Deterministic canonical change-sequence catch-up (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-13) | **Depends on**: TASK-1944, TASK-1945

**Scope**:
- Add a durable cursor keyed by signed-in user and exact personal/workspace scope; never let one visible scope advance another scope's cursor.
- Read `canonical_change_log` under RLS in ascending bounded pages after the persisted sequence and treat rows only as invalidation evidence, not as mutation authority.
- Batch exact task IDs and tombstones into authoritative task reconciliation while preserving unrelated pending local writes.
- Advance and persist the cursor only after the corresponding authoritative projection update succeeds; failed reads or reconciliation retain the prior cursor for retry.
- Establish a race-safe first-run baseline by reading the visible high-water sequence before the full authoritative load and persisting it only after that reload succeeds.
- Trigger serialized/coalesced catch-up on sign-in, reconnect, visibility recovery, Realtime subscription recovery, and workspace switch, plus a single-flight 60-second foreground backstop while authenticated, online, and visible.
- Prove personal/workspace isolation, removed-member denial, pagination, tombstones, duplicate invocation, concurrent triggers, failed reconciliation, and deliberately dropped Realtime.

**Progress (2026-07-13)**:
- Implemented signed-user personal/workspace cursors, high-water baselines and rollback recovery, ordered bounded change pages, exact task/tombstone reconciliation, single-flight execution, and the 60-second authenticated foreground backstop.
- Authoritative reloads now reject and rerun across scope changes, use count-aware immutable-ID keyset pages beyond server row caps, overlay exact-scope durable offline operations after restart, refuse ambiguous unscoped intent, capture workspace queue scope through the packaged ESM boundary, and await strict IndexedDB projection persistence before cursor advancement.
- Repo-local verification is green: 197 convergence/realtime/cache/queue/Local-API tests, TypeScript type-check, source lint with no errors, and diff whitespace validation. Packaged signed-in and production rollout proof remain approval-gated and outstanding.

**Acceptance**:
- A client that misses every Realtime notification converges deterministically through its durable sequence cursor.
- Cursor advancement cannot outrun authoritative projection persistence or cross user/workspace scope.
- Tombstoned task IDs remove missing/deleted visible rows while unrelated optimistic pending writes remain protected.
- Clearing local cursor state causes a safe full-load baseline, not history replay from an untrusted sequence.
- A continuously visible client with silently missed Realtime converges within the bounded foreground interval without overlapping catch-up runs.
- Realtime and Electron IPC remain fast invalidation hints and are never treated as canonical proof.
- Production remains unchanged until signed-in packaged/web verification and deployment are separately approved.

### TASK-1946: Canonical web/PWA offline scalar task-patch adoption (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-13) | **Depends on**: TASK-1944, TASK-1945, TASK-1947

**Scope**:
- Carry canonical task revisions through Supabase task mapping and visible renderer state.
- Give eligible title, description, priority, due-date, and progress edits a stable operation ID that survives Dexie persistence, retry, restart, reconnect, and response loss.
- Route those queued operations through signed-user `flowstate_patch_task_v1` preview/apply, persist the issued digest/expiry and validated receipt before queue completion, and replay the same apply after transport ambiguity.
- Keep status, recurrence, geometry, instances, subtasks, create, delete, restore, and mixed updates on explicit legacy compatibility capture until their domain command cohorts are implemented.
- Preserve every canonical operation identity through coalescing and exempt unresolved canonical intent from stale-operation purge.
- Process multiple offline edits to one task in durable order: rebase only a not-yet-previewed dependent operation to its predecessor receipt revision, record the linkage, and never mutate a patch/base after its preview is issued.
- Represent stale revision, altered approval, malformed response, missing authentication, and unsupported mutation as durable pending/conflict/quarantine states rather than false success.

**Implementation progress (2026-07-13)**:
- Web/PWA scalar task edits now retain a signed-user/workspace-scoped operation through Dexie preview, apply, receipt persistence, authoritative projection, restart-safe replay, and deterministic same-task ordering across canonical and compatibility operations.
- Preview normalization and committed receipts are schema-validated; malformed success, missing rows/auth, response loss, cross-account proof collisions, viewer writes, unsupported fields, and unavailable IndexedDB cannot become false completion. Date/timestamp receipts project through the app's date-only/status contract.
- Successful compatibility updates now atomically retain the returned canonical revision before completion, so a later unpreviewed canonical edit rebases across the same or a later queue pass. Shared-workspace member updates preserve the task owner instead of attempting an immutable ownership transfer. A predecessor receipt/server echo cannot clear or overwrite a later durable optimistic edit while that successor remains unresolved.
- Verification passes TypeScript, the 215-test focused canonical cohort, production renderer/PWA build, Electron main/preload/sidecar compilation, disposable SQL preview/apply/RLS/rollback coverage, and concurrent same-operation/stale-base races. The full suite reports 3,464 passing tests, 6 intentional skips, and one unrelated pre-existing auth-backup fixture failure when Supabase env is intentionally absent. A full Electron package remains correctly blocked without build-time Supabase variables; signed-in packaged/web and production rollout proof remain approval-gated.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Online, reconnect, response-loss, same-task successor, mixed compatibility/canonical, and shared-member update regressions | Yes, for eligible scalar web/PWA edits |
| Data shape / persisted row shape | Yes | Disposable SQL preview/apply/read-back, revision, sequence, RLS, rollback, and race tests | Yes |
| Renderer store/state | Yes | Canonical projection, date/status normalization, restart ledger, and later-optimistic-edit preservation tests | Yes |
| Electron main/preload bridge | Yes | Main/preload/sidecar TypeScript and bundle compilation | No behavior change in this slice |
| Localhost sidecar endpoint | N/A | TASK-1945 owns canonical Local API adoption | No |
| KDE polling/control path | N/A | No timer or KDE control behavior changed | No |
| Supabase persistence/realtime | Yes | Canonical receipt SQL, scoped change-log read policy, and deterministic catch-up contract tests | Persistence covered; Realtime remains an invalidation hint |
| Updater/runtime version | No | Production package and updater were intentionally not changed | No |
| Stale live process/cache state | Yes | Dexie v4-to-v5 migration, restart replay, missed-response, cache invalidation, and durable cursor regressions | Repository/disposable coverage only |

**Exact failure mode fixed**: Eligible web/PWA scalar task edits could be reported locally successful without a durable canonical receipt, lose operation identity across retry/restart, replay against a stale predecessor revision, overwrite a later optimistic edit, or attempt to replace a shared task owner.

**Explicitly not covered**: Status, recurrence, geometry, task instances, subtasks, create/delete/restore, timers/focus, non-task entities, signed-in packaged runtime proof, production deployment, and the separate missing-env auth-backup test fixture.

**Regression added for reported repro**: Yes; canonical and compatibility predecessors followed by a failing successor preserve the later optimistic state, and shared members update without sending `user_id`.

**Live boundary proof**: Repository builds and disposable database fixtures pass. Signed-in packaged/web and production mutation proof remain deliberately pending exact approval.

**Acceptance**:
- Online and reconnect scalar edits are called committed only after a complete TASK-1944 receipt is durably stored.
- Preview and apply reuse the same operation ID, base revision, normalized patch, server digest, and expiry; retry after a lost response returns the replayed receipt without a second revision.
- Browser/PWA restart cannot discard or coalesce away an unresolved canonical operation or its receipt.
- Two offline scalar edits to the same task either produce ordered revision-linked receipts or one explicit receipt-linked parent with durable child outcomes; the second edit is never silently dropped or replayed against a stale base.
- Missing authentication, missing rows, queued transport, HTTP success, and malformed `{ok:true}` responses never complete the operation.
- Unsupported task mutations continue through named compatibility capture and are not silently translated into the generic scalar command.
- Production remains unchanged until signed-in packaged/web verification and deployment are separately approved.

### ~~TASK-1948~~: Canonical Notion task activation (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-14) | **Depends on**: TASK-1943, TASK-1944, TASK-1945

**Scope**:
- Add stable Notion page provenance to tasks with per-user active uniqueness, without introducing a second receipt ledger.
- Preview and apply under the signed-in user through `canonical_operation_previews`, `canonical_operations`, task revisions, and `canonical_change_log`.
- Preserve one global operation identity across preview, commit, response-loss replay, and process restart; reject altered payload reuse.
- Create a task only when provenance is not already active, but append the exact optional approved work block atomically for both new and already-activated tasks.
- Return the `notion-activation-v1` canonical receipt with revision, timestamp, change sequence, read-back projection/hash, and provenance.
- Expose a dedicated Local API adapter and route that validate the complete canonical response before notifying the renderer.

**Acceptance**:
- Preview performs no task or instance mutation and its digest/expiry are durable and exact-request bound.
- Apply after preview expiry rejects unless the exact operation was already committed, in which case it replays the original receipt without a second task or work block.
- Concurrent or repeated activation of one Notion page cannot produce duplicate active FlowState tasks for the same user.
- An optional approved work block is appended exactly once even when the Notion task was activated by an earlier operation.
- Authenticated clients retain no direct write access to canonical operation, preview, or change-log tables; all mutations pass through the typed RPC.
- Disposable database proof covers cross-user denial, replay, altered operation conflict, duplicate provenance, existing-task scheduling, and rollback; production remains unchanged.

### ~~TASK-1949~~: Canonical assistant reliability harness and watchdog (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-14) | **Depends on**: TASK-1943, TASK-1944, TASK-1945, TASK-1947, TASK-1948

**Scope**:
- Create an executable disposable database harness that clones schema only, applies the ordered TASK-1944 and TASK-1948 migrations, runs both rollback-only SQL suites, and always drops its temporary database.
- Add a multi-session Notion activation race/fault probe covering identical operation replay, changed-payload conflict, exact work-block duplicate safety, and transaction rollback without orphaned tasks, operations, changes, or consumed previews.
- Expose the harness as a package command and keep the canonical contract, Local API adapter, convergence, and database proof in the fixed daily regression lane.
- Extend the production database watchdog with read-only, count-only checks for canonical schema/RPC/trigger/index readiness, stale applying operations, incomplete committed receipts, task/change revision divergence, malformed Notion provenance, and committed Notion activations missing their task or change evidence.
- Emit explicit query-failure anomaly types without task titles, Notion page contents, credentials, or other private payloads.

**Acceptance**:
- One command runs the complete repository-local canonical assistant database proof against a unique disposable database and removes it after success or failure.
- Concurrent identical Notion submissions produce one committed operation, one active task, one exact block, and one canonical change; altered reuse fails closed without extra state.
- Daily regression cannot pass by exercising only source-shape tests while the executable SQL contract is broken.
- The VPS watchdog reports missing/broken canonical authority and integrity drift using counts and stable anomaly labels, but never treats valid global sequence gaps as corruption.
- Production data, deployment, and credentials remain untouched in this slice.

**Implementation**: Added one package-level disposable database command that clones schema into a unique temporary database, restores only the signed-user task grants needed by the RLS contract, applies both canonical migrations in order, executes the task and Notion rollback suites, verifies the exact RPC/index authority used by the watchdog, and drops the database on every exit. The multi-session Notion probe proves one commit plus one replay for a duplicated operation, typed conflict for altered reuse, serialized different-operation activation with one exact work block, and complete rollback after an injected task-trigger failure. The fixed daily hunt now runs that executable database proof plus 90 canonical contract, Local API, and catch-up tests. The VPS watchdog now checks canonical tables/RPCs, enabled triggers, a valid/ready/unique provenance index, stale applying rows, incomplete committed receipts, revision drift, malformed Notion provenance, and missing activation evidence through read-only count queries with explicit failure labels.

**Verification**: RED first failed 10 focused tests because the harness, daily check, and watchdog coverage did not exist. The first executable run then correctly exposed an unrealistic privilege-stripped schema clone; the final harness preserves the intended signed-user task grants explicitly and passes the canonical task SQL suite, Notion SQL suite, executable watchdog authority probe, same/different-operation races, conflict, and injected rollback. The exact scheduled check passed 1/1 and its focused Vitest cohort passed 90/90. Final combined repository proof passed 113/113 tests, TypeScript type-check, source lint, all three shell syntax checks, diff whitespace validation, and a read-back confirming no disposable database remained.

**Failure-class matrix**:

| Failure class | Checked | Evidence | Covered by this fix |
| --- | --- | --- | --- |
| User repro shape | Yes | Duplicate, altered, concurrent, and trigger-failure activation submissions are executable fixtures | Yes |
| Data shape / persisted row shape | Yes | Rollback suites and watchdog assertions cover operations, previews, tasks, work blocks, changes, revisions, and provenance | Yes |
| Renderer store/state | N/A | This slice verifies the canonical database and Local API contract, not renderer projection | No |
| Electron main/preload bridge | N/A | No Electron bridge behavior changed | No |
| Localhost sidecar endpoint | Yes | Fixed daily cohort includes the canonical task and Notion activation Local API adapters | Yes |
| KDE polling/control path | N/A | No timer or KDE behavior changed | No |
| Supabase persistence/realtime | Partial | Disposable PostgreSQL proves atomic persistence and revision/change evidence; live Realtime delivery is not exercised | Persistence only |
| Updater/runtime version | N/A | No package or production deployment occurred | No |
| Stale live process/cache state | N/A | Disposable database isolation intentionally excludes live process and cache state | No |

**Exact failure mode fixed**: the canonical assistant and Notion activation contracts could regress across SQL ordering, concurrent submissions, rollback, or watchdog coverage while source-shape unit tests still passed; the fixed daily lane now executes those joined database failure classes and the production watchdog can report redacted integrity drift.

**Explicitly not covered**: production deployment, real-user mutations, renderer cache convergence, Realtime transport loss, packaged Electron behavior, and the separate renderer-to-sidecar authentication recovery lane.

**Regression added for reported repro**: executable same-operation replay, altered-operation conflict, serialized provenance races, injected trigger rollback, both canonical SQL suites, fixed daily scheduling, and read-only watchdog contract tests.

**Live boundary proof**: N/A for this repository-local slice; production data and deployment were explicitly excluded, and the disposable database was read back as removed after verification.

### ~~TASK-1950~~: Classify renderer-to-sidecar auth recovery precisely (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-14) | **Depends on**: BUG-1933, TASK-1949

**Failure-class matrix**: documented with the exact failure mode, uncovered boundaries, regression proof, and live observation below.

**Scope**:
- Use the renderer auth heartbeat as the authority for why the Local API has no usable auth context instead of collapsing every state into `not signed in`.
- Preserve the security boundary: never forward an expired access token and never let the sidecar race the renderer for a single-use refresh token.
- Return stable protected-route responses for re-authentication required, bounded reconnect recovery, and actual signed-out state.
- Teach the live-boundary diagnostic to report re-authentication as actionable, refresh grace as a warning, and renderer-to-sidecar blindness only when the renderer says remote sync is available.

**Acceptance**:
- A cached signed-in shell with an exhausted session is not misreported as a renderer-to-sidecar delivery failure.
- A renderer inside bounded refresh recovery does not raise a hard incident while waiting for a fresh session.
- A renderer that can sync remotely while the sidecar has no context still fails as a genuine bridge fault.
- Protected Local API callers can distinguish sign-in, re-authentication, and reconnect states without receiving credentials or session details.

**Implementation**: Added one pure missing-auth classifier shared by protected Local API routes. It derives only stable error/action output from the existing redacted renderer heartbeat. The live-boundary evaluator now uses `canSyncRemotely` and `reauthRequired` to separate a valid refresh grace period and an expired cached shell from an actual sidecar handoff failure.

**Verification**: The two diagnostic regressions failed first against the broad sidecar-blind classification. The Local API classifier and server-contract regressions then failed before the module and routing seam existed, and the genuine bridge-fault case failed when it still received `not_signed_in`. Final host execution passed 44/44 focused auth, Local API, and live-boundary tests plus the joined 67/67 auth/watchdog reliability cohort; all changed CommonJS files passed syntax checks and the diff passed whitespace validation.

**Failure-class matrix**:

| Failure class | Checked | Evidence | Covered by this fix |
| --- | --- | --- | --- |
| User repro shape | Yes | Signed-in renderer heartbeat plus absent sidecar auth context is covered in re-auth, reconnect, and bridge-fault variants | Yes |
| Data shape / persisted row shape | N/A | No task or database row changes | No |
| Renderer store/state | Yes | Existing redacted heartbeat fields drive the classifier fixtures | Classification only |
| Electron main/preload bridge | Partial | Existing heartbeat delivery is exercised through diagnostics; IPC transport code is unchanged | Classification only |
| Localhost sidecar endpoint | Yes | Protected-route contract and pure response classifier cover all missing-context states | Yes |
| KDE polling/control path | N/A | Timer route ordering and KDE behavior are unchanged | No |
| Supabase persistence/realtime | N/A | No persistence or Realtime behavior changes | No |
| Updater/runtime version | Partial | The active packaged runtime was observed recovering its auth context; this source change is not packaged or deployed | No |
| Stale live process/cache state | Yes | Cached signed-in shell with unusable session is the exact classified state | Yes |

**Exact failure mode fixed**: a cached signed-in renderer shell without a usable JWT was reported as a blind sidecar, and every protected Local API request returned the same `not signed in` 503 even when the renderer was reconnecting or required explicit re-authentication.

**Explicitly not covered**: changing Supabase refresh semantics, forwarding expired tokens, sidecar-owned token refresh, packaged Electron publication, production deployment, or changing timer/KDE endpoint ordering.

**Regression added for reported repro**: pure classifier tests for re-authentication, reconnect grace, and signed-out state; Local API routing contract; diagnostic tests proving re-authentication is not sidecar blindness and refresh grace remains a warning.

**Live boundary proof**: the active packaged app moved from `hasAuthContext=false`, `canSyncRemotely=false`, and `reauthRequired=true` to a restored sidecar context and remote-sync capability without intervention. This proves the observed 503 was bounded renderer auth recovery; packaged verification of the new classification remains in the program's release lane.

### TASK-1951: Production UUID compatibility for canonical assistant contracts (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-14) | **Depends on**: TASK-1943, TASK-1944, TASK-1945, TASK-1948, TASK-1949

**Failure class**: The disposable development schema stores task/project IDs as text, while production stores them as UUID. The merged RPCs, rollback fixtures, and two watchdog joins compared or inserted text IDs directly, so repository proof passed but the approved live rollback suites failed before exercising the contract.

**Scope**:
- Add production-UUID regression fixtures that still run on text-ID development schemas.
- Make RPC lookup, insert, operation/change evidence, and provenance guards compare IDs through stable text projections while preserving typed task/project columns.
- Add an idempotent forward migration; do not rewrite production history as the only repair.
- Keep the VPS watchdog count-only and portable across both schema variants.
- Re-run both rollback-only SQL suites against production and verify zero retained fixture rows before enabling Hermes writers.

**Acceptance**:
- Canonical task preview/apply and Notion activation work with UUID task/project columns and retain string IDs at external/ledger boundaries.
- Both production rollback suites reach `ROLLBACK` with no failures and leave no fixture users, tasks, projects, previews, operations, or changes.
- The production watchdog reports `OK` without query-failure suppression.
- Existing text-ID disposable database tests continue passing.

**Verification**: The disposable database harness passes canonical preview/apply/replay/conflict/RLS/sequence coverage, Notion same-operation/different-operation/conflict/fault races, and double application of the forward migration. The 28 focused source regressions and `vue-tsc` pass. The forward migration applied to production, both SQL contracts reached explicit `ROLLBACK`, exact read-back found zero retained fixture users, tasks, projects, operations, or previews, index/revision integrity remained clean, and the installed VPS watchdog reported `OK` with no suppressed query failure.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Protected canonical and Notion mutations exercised through preview/apply/read-back contracts | Yes |
| Data shape / persisted row shape | Yes | Text-ID disposable schema and UUID production schema both pass; typed task/project keys and text ledger IDs verified | Yes |
| Renderer store/state | N/A | This repair changes database contracts and watchdog queries only | No |
| Electron main/preload bridge | N/A | Covered by the separate authenticated sidecar release lane | No |
| Localhost sidecar endpoint | N/A | Covered by TASK-1945 and TASK-1950 | No |
| KDE polling/control path | N/A | No timer or KDE behavior changed | No |
| Supabase persistence/realtime | Yes | Production transaction proof, revision/change evidence, RLS checks, and zero-residue rollback read-back | Yes |
| Updater/runtime version | Not yet | Electron packaging remains in the parent TASK-1943 release lane | No |
| Stale live process/cache state | Yes | Installed VPS watchdog rerun after migration and reported `OK` | Yes |

**Exact failure mode fixed**: Canonical RPCs, SQL proofs, and watchdog joins assumed text task/project primary keys and failed against production UUID columns.

**Explicitly not covered**: Packaged Electron delivery, renderer-to-sidecar credential propagation, Hermes profile/plugin installation, and live Notion credential configuration remain in the parent release lane.

**Regression added for reported repro**: UUID-shaped fixtures that remain valid on the text development schema, typed RPC variable assertions, text-projected ledger/watchdog joins, and double-application migration proof.

**Live boundary proof**: The forward migration applied to the VPS Supabase database; both production suites completed and rolled back, exact fixture read-back was zero, and the installed watchdog reported `OK`.

### TASK-1952: Hydrate Electron auth backup into the live Supabase client (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-14) | **Depends on**: TASK-1950, TASK-1951

**Failure class**: The packaged renderer can load a durable backup identity while the primary auth key is null, but copying that backup into the async store after auth-js initializes does not hydrate auth-js memory. A second `getSession()` can therefore remain null, restore the primary key to null, and leave the Local API protected routes at 503.

**Scope**:
- Reproduce the already-initialized-client failure in the auth-store regression suite.
- Hydrate the recovered token pair through Supabase auth's supported session API instead of assuming a storage write triggers a reread.
- Preserve stale/already-used refresh-token cleanup and bounded reconnect behavior.
- Ship a new Electron updater version and require live diagnostics to show a durable primary session, remote sync, protected assistant context, and no failures.

**Acceptance**:
- A valid backup session makes the initialized auth client authenticated and persists the refreshed primary session.
- A rejected backup remains write-blocked, clears only the dead backup, and keeps the user shell available for explicit reconnect.
- Focused auth tests, type-check, release gates, package validation, and public updater proof pass.
- The installed packaged app reports the new version with authenticated protected reads and zero live-boundary failures.

**2026-07-14 recovery follow-up**: Live 1.4.258 verification found a real profile with cached local tasks and durable identity but no recoverable primary or backup token. Protected routes correctly remained blocked, but the sidebar exposed only a non-interactive “Restoring account” state for the full reconnect grace window. The recovery state now preserves that warning while also offering an immediate Sign In action; the focused sidebar regression failed first, then passed 2/2 with the TypeScript check.

### ~~TASK-1953~~: Preserve blocked remote Canvas projection updates (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-14) | **Depends on**: TASK-1871

**Failure class**: A Realtime task update can reach the second client's Pinia store while Canvas is dragging, resizing, editing, or settling. The one-shot projection request is then rejected by the interaction guard and never retried, leaving the rendered Vue Flow node permanently at stale geometry until another refresh or unrelated sync.

**Scope**:
- Keep interaction guards authoritative; never force remote geometry through an active local operation.
- Coalesce blocked node and edge reconciliation requests and replay them from the latest store state when Canvas returns idle.
- Flush queued work for both settling completion and explicit reset-to-idle transitions.
- Preserve the existing no-nudge and no-feedback-loop projection invariants.

**Acceptance**:
- Blocked remote projection work does not mutate rendered geometry during the protected operation.
- Returning to idle applies the latest store geometry exactly once even when several triggers arrived while blocked.
- Focused state-machine regressions and repeated two-independent-client R5 propagation pass.
- The full Canvas/sync release gate passes before the held Electron release resumes.

**Failure-class matrix**:

| Failure class | Checked | Evidence | Covered by this fix |
|---|---:|---|---:|
| Realtime / canonical store delivery | Yes | R5 proves client B receives `{2850,2850}` in Pinia before render reconciliation | Existing path retained |
| Interaction guard behavior | Yes | State-machine regressions prove no queued work runs during drag/settling | Yes |
| Deferred renderer projection | Yes | Keyed queue keeps only the latest projection and flushes on settle or explicit reset to idle | Yes |
| Canvas node geometry | Yes | R5 rendered-node propagation passed 10/10 repeated independent-client runs | Yes |
| Canvas edge projection | Yes | Node and edge requests use separate coalescing keys and read latest store state on replay | Yes |
| No-nudge / structural Canvas behavior | Yes | Full R1–R8 independent-client suite passed 8/8 | Yes |
| Broader Canvas/sync contracts | Yes | Focused cohort passed 32 files / 362 tests; type-check passed | Yes |
| Electron package/runtime | Not yet | Release remains held until this merged repair is included in the next package | Covered by TASK-1952 release |

**Exact failure mode fixed**: A protected Canvas interaction could reject the only store-to-render projection trigger after Realtime updated client B, leaving Pinia correct while Vue Flow stayed permanently at the old position.

**Explicitly not covered**: This task does not change conflict resolution, database geometry writes, auth recovery, or updater delivery. Those remain under their existing tasks and release gates.

**Regression added for reported repro**: Keyed pending updates replace stale work, survive consecutive local drags, remain blocked through settling, and replay exactly once from the latest state on both timeout completion and explicit reset. Deterministic R8 locks client B, delivers client A's Realtime geometry into B's store, proves the rendered node remains protected, then clears the guard and proves the node catches up without reload.

**Verification**: Focused RED tests failed before keyed coalescing, consecutive-drag retention, and owner cleanup; after implementation, the state suite passed 14/14, the Canvas/sync cohort passed 32 files / 362 tests, R5 passed 10/10 repeated two-client runs, deterministic blocked-client R8 passed, the full R1–R8 E2E passed 8/8, type-check passed, and focused lint had zero errors (two pre-existing `no-explicit-any` warnings).

### ~~BUG-1939~~: Quick Sort postpone also persists the app session state (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-10, Electron v1.4.246 deployed and locally installed) | **Opened**: 2026-07-10

**User repro**: In packaged Electron Quick Sort, clicking a `Postpone` destination changes the task date as intended but also saves the active Quick Sort application/session snapshot.

**Required behavior**: A postpone click persists only the selected task due date, closes only the quick-edit popup, keeps the same task and progress, and does not write Quick Sort recovery/session state as a side effect. The action remains undoable during the live session.

**Verification**: A RED regression captured the active-session localStorage value before postponing and proved the click rewrote it with a new non-advancing `SAVE_TASK` entry. After removing the stray session-persistence call, the focused Quick Sort queue suite passes 17/17, `vue-tsc` passes, lint exits cleanly, and the full suite passes 245 files with 3,264 tests passing and 6 intentional skips. A focused blocker review found no Critical or Important code issue. Electron v1.4.246 built and passed package validation, the guarded remote promotion reported `new-version`, and the public updater manifest serves v1.4.246 with AppImage size `180429637` and SHA-512 `bvtFNpWakaoBZD4b2ybQlZQ2DwqATkISCBguLZHHVrSVpBX0SJXGhGsGdERNheQAEZA5HznEt3LfjB2uHHWjYg==`. The installed launcher AppImage has the same size and byte-for-byte SHA-512 and was fully relaunched without the temporary verification debugging port.

**Failure-class matrix**:

| Failure class | Checked | Evidence | Covered by this fix |
|---|---:|---|---:|
| Task data persistence | Yes | Canonical awaited task-store due-date write remains intact | Yes |
| Renderer / Quick Sort session state | Yes | Regression proves current task/progress remain unchanged and active-session storage is not rewritten | Yes |
| Undo/redo | Yes | Non-advancing in-memory action remains available for immediate Undo | Yes |
| Electron main / preload | Yes | v1.4.246 package validation passed; no bridge change required | No change required |
| Localhost sidecar / KDE | N/A | Quick Sort postpone does not use these boundaries | Not applicable |
| Updater / runtime version | Yes | Public manifest, local release artifact, and installed launcher AppImage match v1.4.246 size and SHA-512 | Yes |
| Stale live process | Yes | v1.4.245 was terminated; the v1.4.246 AppImage is mounted and running normally | Yes |

**Exact failure mode fixed**: `rescheduleCurrentTask()` explicitly called `persistSession()` after the due-date mutation, serializing the Quick Sort undo stack and active application state even though postpone is a task edit that must not commit session state.

**Outside this fix**: The task due-date write itself is intentionally persistent, and an ordinary later Quick Sort lifecycle save may capture the then-current live session for crash recovery.

---

### ~~BUG-1938~~: Postpone feedback is transparent and the task advances instead of only closing the popup (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-10, Electron v1.4.245 deployed and locally verified) | **Opened**: 2026-07-10

**User repro**: In packaged Electron Quick Sort, clicking a postpone destination closes the task and reveals the next task. The centered `Moved to …` confirmation uses a translucent glass background, so the current task title, due date, priority, and card border visibly bleed through the message.

**Required behavior**: Persist the selected due date, close only the quick-edit popup, keep the same task active with unchanged progress, preserve undo/redo, and render the confirmation on a fully opaque surface on desktop and mobile.

**Subtasks**:
- [x] ~~BUG-1938 — lock the user's exact behavior with a failing current-task/progress regression and opaque-feedback source contract.~~
- [x] ~~Keep reschedule actions undoable without counting or advancing the task; update desktop/mobile copy to stop promising the next task.~~
- [x] ~~Replace translucent feedback glass with the opaque primary surface on desktop and mobile.~~
- [x] ~~Build, deploy, install, relaunch, and verify Electron v1.4.245 against the real packaged window.~~

**Verification**: RED reproduced five queue failures under the new expectation, then exposed same-task and cross-task snapshot ownership variants. GREEN passes 48 focused queue, preset, undo/redo, store, UI-contract, and release-guard tests plus `vue-tsc`; final blocker review found no Critical or Important issues. The full Electron ship gate passed 245 test files with 3,263 tests passing and 6 intentional skips, then built and validated the renderer, main process, sidecar, AppImage, and deb. The locked release path deployed v1.4.245. The public manifest and installed launcher target both report AppImage size `180429705` and SHA-512 `Ni4Qhu4o76F5tl5lMl5NoBlxWNRmmE/EiS4oQTnU3wwZx/p3Qm1b0e+RS0BTXqupgN5MiYRZgC4o1WxmrMFSoA==`.

**Packaged-app proof**: A full v1.4.245 process restart mounted the new AppImage and started its localhost sidecar. On the real Quick Sort card, clicking `Next weekend` closed only the quick-edit popup, kept the same Hebrew task and progress at 31, updated the context date to `Tomorrow` (the next Saturday from Friday), and rendered `Moved to next weekend` on a fully opaque primary-surface card with no task text, date, priority, or border bleeding through it. The action was immediately undone and direct capture confirmed the original `4 days ago` / `Jul 6` due date was restored.

**Failure-class matrix**:

| Failure class | Checked | Evidence | Covered by this fix |
|---|---:|---|---:|
| Data shape / persistence | Yes | Awaited task-store due-date update; packaged Undo restored the original live due date | Yes |
| Renderer state | Yes | Direct v1.4.245 X11 capture shows popup dismissal, same card, unchanged progress, and opaque feedback | Yes |
| Undo/redo snapshot ownership | Yes | Regressions cover unsaved fields, immediate undo/redo, and returning from another task with distinct project/priority | Yes |
| Electron main / preload | Yes | Canonical package validation passed for renderer, main, preload, and sidecar | No change required |
| Localhost sidecar | Yes | Fresh packaged process reported the v1.4.245 sidecar listening on port 5577 | No change required |
| Updater / runtime version | Yes | Live manifest, local artifact, installed AppImage, and generated Electron metadata all match v1.4.245 | Yes |
| Stale live process | Yes | v1.4.244 mount and wrapper were terminated before the v1.4.245 launch | Yes |

**Outside this fix**: Authenticated Playwright remains unavailable in this shell because `SUPABASE_SERVICE_ROLE_KEY` is not present. The stronger packaged Electron proof covers the user's actual surface. BUG-1939 separately removes the active-session persistence side effect from postpone clicks.

---

### ~~BUG-1937~~: Same-version Electron release overwrote the Quick Sort build (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-10, Electron v1.4.244 deployed and locally verified) | **Opened**: 2026-07-10

**User repro**: After installing and fully relaunching Electron v1.4.243, Quick Sort still rendered the old `+1 / +3 / Wknd / +7` due-date controls.

**Exact failure mode**: Two independent same-day release lanes published different AppImages as v1.4.243. The correct Quick Sort artifact was live first, then the Board due-date lane overwrote the same manifest/version two minutes later. Electron installed the later checksum correctly, but the version label could not reveal that the renderer contents had changed.

**Subtasks**:
- [x] ~~BUG-1937 — prove the running executable, installed AppImage, pending updater file, and live manifest all shared the later checksum while differing from the first v1.4.243 artifact.~~
- [x] ~~Merge the committed Board due-date lane and Quick Sort lane so the recovery release preserves both fixes.~~
- [x] ~~Add a deploy preflight that rejects downgrades and same-version/different-checksum artifacts before upload.~~
- [x] ~~Build and deploy combined v1.4.244, atomically install it locally, fully relaunch, and verify the actual visible Quick Sort surface.~~

**Verification**: Nine RED/GREEN collision-guard tests cover new-version, idempotent, downgrade, same-version changes to either artifact or top-level updater target, mandatory manifests, manifest-bound filename/size/SHA-512 validation, cross-version filename reuse, and lock-before-promotion ordering. A blocker review exposed and then verified closure of the original preflight/upload race: artifacts now upload to a unique staging directory, and a remote `flock` serializes the live-manifest recheck plus manifest-last promotion. The hardened remote path accepted a byte-identical v1.4.244 redeploy as `idempotent`. The Electron release gate passed the full test suite, renderer/main/sidecar build, Linux AppImage and deb validation, and deployment. The public manifest reported v1.4.244 with AppImage size `180429523` and SHA-512 `jKLIflrJBWoPakZTQpcHpdhnbcSJQJdspnjs5fBg7vSS6MGmJy+ViUv++XDxybPSyL3VwCZliIxXUuTqffhSAw==`; the installed launcher target matched both exactly. A full process restart mounted the new AppImage, started the localhost sidecar, and direct capture of the real packaged window showed the explicit destinations and combinable `Change pools` surface. BUG-1938 subsequently changed postpone from advance-after-click to keep-the-current-task-open.

**Failure-class matrix**:

| Failure class | Checked | Evidence | Covered by this fix |
|---|---:|---|---:|
| Data shape / Supabase persistence | Yes | The symptom reproduced before any task mutation; installed renderer contents, not task data, selected the old controls | No change required |
| Renderer state | Yes | Direct packaged-window capture after restart shows the explicit destination controls and task-pool picker | Yes |
| Electron main / preload | Yes | v1.4.244 packaged and validated main, preload, renderer, and sidecar resources | Yes |
| Localhost sidecar | Yes | Fresh packaged process reported the v1.4.244 sidecar listening on port 5577 | No change required |
| KDE polling / control | Yes | Not involved in due-date rendering; desktop relaunch and X11 window capture succeeded | No change required |
| Updater / runtime version | Yes | The live v1.4.243 checksum had been overwritten by another v1.4.243 artifact; v1.4.244 is unique, and locked manifest-last promotion now rejects collisions/downgrades while validating every staged artifact | Yes |
| Stale live process | Yes | The surviving mounted v1.4.243 process was terminated before the v1.4.244 AppImage launch | Yes |

**Outside this fix**: This guard protects the canonical `deploy-electron-update.sh` path. Direct manual writes to the VPS release directory remain an operational bypass and must not be used.

---

### ~~BUG-1936~~: Quick Sort postpone shortcuts require a second Save and use ambiguous offsets (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-10, effective combined release Electron v1.4.244) | **Opened**: 2026-07-10

**User repro**: In the Quick Sort edit panel, clicking a due-date shortcut such as `Wknd` changes the date but leaves the same card open. The user must infer that a separate Save action is still required, while labels such as `+1`, `+3`, and `+7` do not explain the destination or whether the task will advance.

**Exact failure mode**: Date shortcuts were implemented as ordinary field edits instead of Quick Sort decisions. Desktop and mobile duplicated their date math, several presets never rendered an active state, and the compact desktop row hid later actions behind an invisible horizontal scroll.

**Implementation**:
- [x] ~~BUG-1936 — add a single `rescheduleCurrentTask` action that persists the selected due date and records the Quick Sort undo action (initially advancing; BUG-1938 now keeps the task open).~~
- [x] Share local-date preset resolution across desktop and mobile, including next-Saturday weekend semantics.
- [x] Replace offset-only copy with explicit destinations, put Next weekend among the first three actions, and wrap desktop actions. (BUG-1938 removed the later-superseded next-task promise.)
- [x] Guard rapid double-clicks so the following task cannot be skipped.
- [x] Complete review, final verification, and Electron updater delivery.

**Verification**: 36 focused Vitest tests pass for preset boundaries, month-end clamping, one-click advance, no-date undo/redo, conflicting clicks, competing card actions, final-task Undo, and mobile reachability. Focused ESLint and `vue-tsc` pass. Authenticated desktop Chromium proof clicks Next weekend and verifies confirmation/advance; the seven-test mobile Chromium pack passes, including a 360px viewport assertion that all action buttons fit. Final review found no Critical or Important issues. The original v1.4.243 artifact passed 3,228 tests with 6 intentional skips, but a second same-version release replaced it; BUG-1937 recovered the fix in the verified combined v1.4.244 release.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Authenticated desktop/mobile E2E clicks Next weekend, sees confirmation, and advances | Yes |
| Data shape / persisted row shape | Yes | Regressions preserve empty-string/no-date transitions through Quick Sort undo/redo | Yes, for due-date actions |
| Renderer store/state | Yes | Single-flight and competing-action tests cover processed IDs, current card, undo, redo, and completion preview | Yes |
| Electron main/preload bridge | N/A | Renderer-only interaction; packaged Electron contents validated | No bridge change required |
| Localhost sidecar endpoint | N/A | Quick Sort postponement does not use the sidecar | Not applicable |
| KDE polling/control path | N/A | Quick Sort postponement does not use KDE integration | Not applicable |
| Supabase persistence/realtime | Yes | Canonical task-store update path is awaited before the Quick Sort action advances | Yes, through existing task persistence |
| Updater/runtime version | Yes | Public manifest serves the effective combined v1.4.244 release; installed AppImage checksum and size match | Yes |
| Stale live process/cache state | Yes | Captured-queue semantics remain stable and the final action stays undoable until explicit session finalization | Yes, for Quick Sort state |

**Exact failure mode fixed**: Quick Sort date buttons acted like silent field edits, so postponing required a second Save and ambiguous offset labels did not communicate the result. They now perform one atomic, explicit postpone-and-next decision.

**Explicitly not covered**: General task-editor due-date behavior, recurring-instance reconciliation outside the existing canonical task update path, and unrelated Electron/KDE/sidecar failures remain outside this Quick Sort interaction fix.

**Regression added for reported repro**: Shared preset and queue tests cover date semantics, atomic advance, race prevention, undo/redo, and final-task completion; desktop and mobile authenticated E2E cover the actual Next weekend button and narrow viewport.

**Live boundary proof**: Electron v1.4.244 packaged successfully; `latest-linux.yml` reports 1.4.244; the locally installed AppImage matches the manifest checksum and size; direct capture of the packaged Electron window shows the new one-click postpone controls.

---

### ~~FEATURE-1935~~: Combinable Quick Sort task pools (✅ DONE)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS | **Opened**: 2026-07-10

**Goal**: Let users build a Quick Sort session from any combination of Uncategorized, Overdue, Today, Next 3 days, Next 7 days, and No due date tasks on desktop and mobile.

**Implementation**: Added a shared responsive source picker, due-date-only local-date predicates with OR/deduplication semantics, captured session queues, remembered source selection, crash-safe source/queue persistence, legacy session recovery, and explicit restart confirmation before changing active pools. Assigned and uncategorized tasks can coexist in one session; done, pinned, and soft-deleted tasks remain excluded.

**Subtasks**:
- [x] FEATURE-1935 — lock task-pool boundaries, combinations, captured queues, recovery, and desktop/mobile picker behavior with regressions.
- [x] Verify responsive rendering and mobile internal scrolling so the Start action remains reachable.
- [ ] Build, deploy, and verify Electron updater v1.4.242; then close all tracking entries.

**Verification so far**: 30 focused Vitest tests, `vue-tsc`, ESLint, reviewer re-check, and Playwright desktop/mobile render probes pass. Full-suite Vitest enumerated the complete suite without a test failure but retained an existing open handle after completion; Electron release gate will rerun the repository checks.

---

### ~~TASK-1814~~: Subscription-powered AI brain (Claude/Codex CLI bridge) + overwhelm-reorder & smart-lanes flows (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.95 deployed)

**Progress (2026-06-06):** Bridge live + both brains work. Fixed the core "strong model = weak answers" trap — the pipeline was pre-digesting tasks into "X days overdue" lines (LLM reduced to a formatter). Now feeds FULL task content + skips the pre-computed directive + prompts holistically (group/dependencies/trend). Eval harness shows **1.3→4.9/5**. Built grouped prioritization **cards** (model emits a `cards` JSON block → parsed → interactive cards with per-task reasons; raw-JSON-leak bug fixed + regression tests). Made the **ReAct/freeform path** intelligent too so no phrasing bypasses it. Prose tightened to 1-2 sentences. Added skills: cross-project `llm-feature-quality` + project `flowstate-ai-chat`. Deployed Electron v1.4.92 beyond localhost; TASK-1815 overwhelm-reorder shipped in Electron v1.4.93; TASK-1816 smart-lanes shipped in Electron v1.4.94; TASK-1818 streaming/card polish shipped in Electron v1.4.95. Full local Vitest gate: 2408 tests green.

**Why**: Current in-app AI is "not usable" — verified by running the exact app prompts (`useAITaskAssist`) on the default model (Ollama llama3.2 3B) against real tasks: English breakdown returned prose not JSON (→ "could not be parsed" error), Hebrew breakdown returned nonsense words in a medical-prep task, smart-suggest gave "15 min to plan a weekend trip, confidence 1.0". Three root causes: weak brain, shallow prompts (title-only, no workload context), and the requested "overwhelmed → reorder my day" flow does not exist at all.

**Approach**: Add a subscription-based brain via a tiny auth-gated **AI bridge** on the VPS that wraps the local `claude` / `codex` CLIs (no per-token API billing). Claude and Codex are equal, switchable per AI action. New router provider `'bridge'`, auto-selected when reachable, transparent **Groq-free fallback** when a brain's token is dead so AI never hard-fails. Then deepen prompts + build the two flagship flows.

**Architecture (decided + verified)**:
- VPS has `claude` 2.1.111 + `codex` 0.133 installed; 16GB RAM free.
- Claude re-authed via `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` stored root-only at `/root/.flowstate-ai-bridge.env` (verified: `claude -p` → OK).
- Codex existing `~/.codex/auth.json` still valid (verified: `codex exec` → OK, model gpt-5.5). No re-login needed.
- Bridge auth: Supabase HS256 JWT, CORS-locked to app origin, per-user rate limit, binds 127.0.0.1 behind Caddy `/ai-bridge`.

**Progress (2026-06-04) — Phase 1 COMPLETE (deployed, untested end-to-end)**:
- Bridge server `infra/ai-bridge/server.mjs` (zero-dep Node): HS256 *or* Supabase `/auth/v1/user` token validation, multi-origin CORS (prod same-origin + localhost dev + Electron `null`), per-user rate limit, Groq-fallback on dead brain. Local-tested with stub brain (no quota): health/routing/400/401/rate-limit all pass.
- **Deployed to VPS**: systemd `ai-bridge.service` active, env at `/root/.flowstate-ai-bridge.env`, Caddy route `in-theflow.com/ai-bridge/*` → `127.0.0.1:8788` (validated + reloaded). Public verified: `/ai-bridge/health` → both brains; unauth `/v1/chat` → 401; CORS echo for localhost + null confirmed.
- **App wired**: `bridgeClient.ts` + `bridgeProvider.ts`, `'bridge'` added to `AIProviderType`/`RouterProviderType`, router creates+prefers bridge (incl. complex-tier), settings `aiUseSubscription`/`aiBrain` + Settings UI brain-selector (Claude default, Codex switchable). vue-tsc clean on touched files; full unit suite **2348 pass**.
- **NOT yet verified**: a real authenticated `claude -p`/`codex exec --json` round-trip through the bridge (avoided burning subscription quota — validates on first in-app use; codex JSON parser is tolerant + has plain-text fallback).
- **Pending**: user end-to-end test → web+Electron deploy (version bump per rules 6/7) → Phase 2 overwhelm-reorder → Phase 3 smart-lanes. Work is uncommitted (current branch unrelated; needs its own branch off master).

**Files**: new `infra/ai-bridge/{server.mjs,ai-bridge.service,README.md}`, new `src/services/ai/proxy/bridgeClient.ts`, new `src/services/ai/providers/bridgeProvider.ts`, `src/services/ai/types.ts`, `src/services/ai/router.ts`, `src/services/ai/routerFactory.ts`, `src/stores/settings.ts`, `src/components/settings/tabs/AISettingsTab.vue`; VPS `/etc/caddy/Caddyfile` (ai-bridge route).

---

### ~~TASK-1809~~: Hold F2 + drag to reorder tasks within a canvas column (✅ DONE)

**Priority**: P2 | **Status**: ✅ **DONE** (2026-06-04, v1.4.89)

Hold **F2** while dragging a task inside a day/smart column → the column restacks (insert-and-shift): the dropped card takes the slot its drop-Y lands in, the rest shift down. Plain drops keep free placement. F2 chosen because Shift/Control/Meta disable node dragging and Alt is grabbed by KDE's window-move gesture.

Reuses `computeCanonicalLayout` scoped to one group (`useTidyLayout.reorderColumn`/`planReorderColumn`). **Instant paint (TASK-1809b):** `reorderColumn` is split into a synchronous plan+group-geometry+moves part and a deferred `commit()`; the `CanvasView` wrapper paints via `applyCanonicalMoves` in the drop frame, then `await`s the drag save and calls `commit()` so reorder writes win last-write-wins. Same-column path detected via `getDeepestContainingGroup`; cross-group falls back to await-then-reorder. Shipped on top of the 1.4.88 group-collapse line as 1.4.89 (web + electron). Tests: `tidy-layout.test.ts` (reorderColumn split) + `canonical-layout.test.ts` (insert-shift).

### ~~BUG-1813~~: Canvas group collapse (minimize) does nothing (✅ DONE)

**Priority**: P1 | **Status**: ✅ **DONE** (2026-06-04)

**Problem**: Clicking a canvas group's collapse chevron didn't minimize the group (reported on Electron). The store toggled `isCollapsed`, but the group never visually collapsed and contained tasks stayed visible.

**Root cause (two layers)**: (1) `GroupNodeSimple.vue` read `props.data.isCollapsed`, but `useCanvasSync` writes the node field as `collapsed` — so the read was always `false`. (2) Deeper: `updateGroup` never bumps `syncTrigger` and the orchestrator only re-syncs groups on `groups.length` change, so a collapse never refreshed node data at all — and nothing ever hid the child task/group nodes (only `done` tasks were hidden). Platform-agnostic; not Electron-specific.

**Fix**: (a) `GroupNodeSimple` now reads collapse state reactively from the store group (same approach as `groupColor`/BUG-225), so the header reacts immediately. (b) `useCanvasOrchestrator` watches a per-group collapse signature and re-syncs on change. (c) `useCanvasSync` hides task nodes and nested child-group nodes whose parent/ancestor group is collapsed (`isUnderCollapsedAncestor`).

**Verified visually**: `tests/e2e/canvas-collapse-local.spec.ts` drives the chevron and asserts collapse (header dashed + body hidden + child task hidden) and expand (restored), with before/after screenshots. Typecheck clean; 154 canvas unit tests pass.

**Files**: `src/components/canvas/GroupNodeSimple.vue`, `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasSync.ts`, `tests/e2e/canvas-collapse-local.spec.ts`, `tests/e2e/playwright.collapse-local.config.ts`.

---

### ~~TASK-1812~~: Lanes — sprint-style cross-project goals for tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-04) — shipped to production (prod Supabase migrated + verified; Electron v1.4.84 deployed, `latest-linux.yml` live)

**Goal**: Add a new first-class **Lane** entity — a sprint-like path toward a goal that pulls in tasks from *different* projects. A task belongs to at most one lane (nullable `laneId` FK, not a join table). v1 is a named bucket + view: `Lane = { id, name, color }` (no dates/progress/lifecycle yet). Lane is orthogonal to project (a task keeps its single `projectId`).

**Approach**: `Lane` mirrors `Project` through the whole stack (type → mapper → DB module → store → sync queue → realtime → UI). Lane is **pure metadata** — never touches canvas geometry (`canvasPosition`/`parentId`/`position_version`); rides the normal task-update sync path and plain `updated_at` LWW (not the position-version path). Highest risk: `lane_id` must round-trip in both `toSupabaseTask`/`fromSupabaseTask` or realtime echo nulls it every save (same class as the documented `parentId` bug, `supabaseMappers.ts:532-539`).

**Files**: `src/types/tasks.ts`, `src/types/sync.ts`, `src/utils/supabaseMappers.ts`, new `src/composables/supabase/useLanesDatabase.ts`, `src/composables/supabase/index.ts`, `src/composables/supabase/_tombstone.ts`, `src/composables/sync/useSyncOrchestrator.ts`, `src/composables/supabase/useRealtimeSubscription.ts`, `src/composables/app/useAppInitialization.ts`, new `src/stores/lanes.ts`, `src/views/AllTasksView.vue`, new `src/views/LaneView.vue`, new `src/components/sidebar/SidebarLanesSection.vue`, `src/layouts/AppSidebar.vue`, `src/router/index.ts`, `src/components/tasks/edit/TaskEditMetadata.vue`, new `supabase/migrations/20260603000000_lanes.sql`. Plan: `~/.claude/plans/check-work-lanes-in-wiggly-dragonfly.md`.

**Progress (2026-06-03)**: Implementation complete + verified locally. ✅ vue-tsc clean, ✅ full unit suite 2342 pass (incl. 6 new lane mapper round-trip tests proving the realtime-echo safety), ✅ contract tests updated (lanes table + lane_id column), ✅ `npm run build` succeeds, ✅ migration applied to LOCAL DB (table + RLS + `lane_id` FK `ON DELETE SET NULL` + realtime publication verified), ✅ E2E `tests/e2e/lanes.spec.ts` 4/4 pass (chromium+webkit): cross-project lane view, group-by-lane, sidebar create→route. **Pending (needs user approval — NOT done):** (1) apply migration to PRODUCTION Supabase, (2) deploy web + Electron build.

### TASK-1811: Group header button — apply group due date / properties to its tasks (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-06-01)

**Goal**: Add an icon button to canvas group headers that applies the group's resolved due date to every task inside the group. Two separate actions in a small popover: "Set due date on all tasks" (due date only) and "Apply all group properties" (due date + priority + status + project). Button shows **only** on groups with a resolvable due date (power-keyword `Today`/`Tomorrow`/weekday groups, or `assignOnDrop.dueDate`). Overwrites existing task dates.

**Approach**: Reuse `getSectionProperties(group, allGroups)` (`useCanvasSectionProperties.ts:147`) — the same resolver used on drop — as the single source of truth for the group's date. Metadata-only (`dueDate`/`priority`/`status`/`projectId`), never geometry, so it respects the Canvas Geometry Invariants. Apply via `taskStore.bulkUpdateTasksWithUndo` (one undo entry). Wiring mirrors the existing `@collect`/`collectTasksForSection` path: `GroupNodeSimple.vue` emit → `CanvasView.vue` → `useCanvasOrchestrator.ts` → new `applyGroupPropsToTasks(groupId, mode)` in `useCanvasTaskActions.ts`. Children enumerated from `taskStore._rawTasks` (the `.tasks` getter applies smart-view filters), skipping done/soft-deleted/completion-record/pinned.

**Files**: `src/components/canvas/GroupNodeSimple.vue`, `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, new unit test under `tests/unit/canvas/`.

---

### ~~BUG-1810~~: Inbox "3 Days" filter shows far-future recurring tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ **DONE** (2026-06-01)

**Problem**: With the inbox time filter set to **3 Days**, a recurring task displaying a far-future date (e.g. "Jun 8", 7 days out) still appeared — making the filter look broken.

**Root cause**: Display/filter mismatch, not a filter bug. The filter (`isNext3DaysTask`, `src/composables/useSmartViews.ts`) treats calendar **instances** as authoritative (BUG-1188) and correctly matched the task via a near-term instance. But the task card (`UnifiedInboxTaskCard.vue`) used the master `dueDate` first and only fell back to instances when `dueDate` was absent — so it showed the far-future master date while the task surfaced via a near-term instance.

**Fix**: Card now honors the same instance-authoritative rule as the filter. Extracted badge logic to a pure, testable `dueStatus.ts`; the badge shows the **representative instance** (soonest upcoming ≥ today, else latest overdue) instead of the master `dueDate` when instances exist. Also fixed a latent gap: a past representative instance is now labeled "Overdue", not "future".

**Files**: `src/components/inbox/unified/dueStatus.ts` (new), `src/components/inbox/unified/UnifiedInboxTaskCard.vue`, `src/components/inbox/unified/__tests__/dueStatus.spec.ts` (new, 9 tests).

---

### TASK-1809: Shift-drag to reorder tasks within a canvas column (🔄 IN PROGRESS)

**Goal**: Let users reorder a task inside a day/smart canvas column by holding **Shift** while dragging. On a Shift-drop, the column restacks cleanly from the header down — the dragged card takes the slot its drop-Y lands in and the rest shift down (insert-and-shift). Non-Shift drops keep today's free placement, unchanged.

**Approach**: Reuse the tested `computeCanonicalLayout` primitive (`useCanonicalDayGroupLayout.ts`) scoped to a single group. Tasks already order by Y, so the dropped card's new Y decides its slot.
- `useTidyLayout.ts`: add pure `planReorderColumn(groupId)` + `reorderColumn(groupId)` (store writes + position locks + undo snapshot, mirrors `tidyDayGroups`).
- `CanvasView.vue`: window keydown/keyup/blur listeners track `reorderKeyHeld` (F2); wrap `@node-drag-stop` — if held, run `reorderColumn` on the dropped task's group via `applyCanonicalMoves` + `syncNodes({force})`.
- Stays inside the single sanctioned geometry writer (drag handler + Tidy primitive) → no sync-loop/invariant violation.

**Perf (TASK-1809b — instant paint)**: First version awaited the drag handler's Supabase write (~1–2s on VPS, BUG-1051) *before* painting the restack → 2–4s lag. Fixed by splitting `reorderColumn` into a synchronous part (plan + group geometry + moves) and a deferred `commit()` (task `updateTask` writes + PositionManager + undo). The wrapper now: starts the drag save without awaiting (its sync prefix passes the `canvasSyncInProgress` guard first), runs `reorderColumn` + `applyCanonicalMoves` **synchronously** (instant paint), then `await dragDone` → `commit()` so reorder's writes land last and win LWW (a refresh keeps the reordered slot). Same-column drops use this instant path (detected via `getDeepestContainingGroup`); rare cross-group drops fall back to await-then-reorder. Covered by `tidy-layout.test.ts` reorderColumn tests.

### ~~TASK-1871~~: Stop recurring canvas/sync regressions — root-cause campaign (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-17) — root causes fixed + durable guardrails shipped (v1.4.194) and pushed (branch task-1871-canvas-sync-stability). Optional hardening (formal allowlist geometry guard; payload allowlist→denylist refactor) noted below as future defense-in-depth, not blocking.

**Why**: Canvas/sync bugs (all-nodes-shift, sync "cut", self-repositioning, tasks vanishing) keep getting fixed and resurfacing because invariants are documented-not-enforced, the sync payload silently drops new fields (field-completeness trap), and CI runs zero behavioral canvas/sync tests. Goal: fix root causes AND add permanent guardrails so the class can't return.

**Phase 0 (✅ done)**: Built the first true two-independent-client + Realtime harness (`tests/fixtures/two-client.ts` — separate `browser.newContext()` per client, not same-context tabs). Added observable geometry-write + sync-payload-drop instrumentation (`src/utils/canvas/geometryWriteLog.ts`, `src/utils/sync/payloadDropLog.ts`). Added behavioral regression suite `tests/e2e/canvas-sync-regressions.spec.ts` (R1 no-shift, R2 cross-client field propagation, R3 no auto-reposition on open, R4 group-delete keeps children).

**First root cause fixed (R4, verified RED→GREEN)**: `updateTask` only wrote the `position` column (which holds canvas-group `parentId`) when `canvasPosition` was in the changed keys. A parentId-only change (group delete clearing children's parentId, BUG-1510) cleared locally but never persisted → DB kept stale parentId → sync/realtime re-applied it → dangling parentId hides the task. Fix: widen the position-write gate to `canvasPosition || parentId` (`src/stores/tasks/taskOperations.ts:853`). This is a concrete instance of the field-completeness trap (same shape as the laneId TASK-1812 fix).

**Second root cause fixed (Electron "can't quit", confirmed live)**: `useBeforeUnload` (mounted app-wide via `useAppInitialization.ts:44`) calls `preventDefault()` + `returnValue=''` whenever `syncStore.hasPendingChanges || hasErrors`. In Electron this silently cancels the window close, and the app menu had **no Quit item and no Ctrl+Q** (`autoHideMenuBar:true`, mac-only `hiddenInset`), so the app couldn't quit at all — common because pending changes/errors are frequent. Fix: skip the beforeunload guard in Electron (offline-first queue persists writes across restarts, TASK-1177, so no data loss) + add a File → Quit menu item with `CommandOrControl+Q` that force-destroys the window (`electron/main.ts`). Shipped local build v1.4.187.

**Phase 3 core fixed (realtime "sync cuts on long sessions")**: Two-client harness proved the sync/render LOGIC is correct (task R5 + group R6 both propagate live) — so the user's "doesn't sync until reload" was realtime DELIVERY degrading, not logic. Root causes in `useRealtimeSubscription.ts`: (a) any throw between `isConnecting=true` and its reset left the flag stuck → every future setup early-returned → realtime never recovered; (b) the no-auth-token branch aborted with NO retry (Electron late disk-auth). Fix: wrap setup in try/finally so the flag always clears + a generation-guarded `scheduleSetupRetry` for both the throw and no-token paths. Regression tests #16/#17 in `tests/unit/sync/websocket-resilience.test.ts`. Shipped v1.4.188. (Remaining Phase 3: realtimeInitialized failed-init latch, KDE atomic leadership — lower priority.) Also surfaced: groups with legacy non-UUID IDs silently skip sync (`toSupabaseGroup`), and local Supabase was missing the `linked_parent_task_id` migration.

**ACTUAL root cause of "localhost ≠ Electron" (confirmed from user's prod console)**: realtime was healthy (🟢); the user's day-column groups (Monday–Sunday, Tomorrow) have **legacy non-UUID ids**, so `toSupabaseGroup` silently skipped them (`⏭️ [LEGACY-GROUP] Skipping save`). They were NEVER in Supabase — each device kept a private local-only copy and drifted. Fix: auto-migrate legacy group ids → **deterministic** UUIDs (`uuid v5` of userId+power-keyword, so every device's "Monday" converges to one row via upsert), re-point child tasks/groups, drop the local legacy copy, backup-first to localStorage. New: `src/utils/canvas/legacyGroupId.ts`, `migrateLegacyGroupIds` in `canvasGroups.ts`, hooked in `useAppInitialization.ts` after the authoritative load. Tests: `tests/unit/canvas/legacy-group-id.test.ts` (convergence) + e2e R7. Also fixed a Vite crash: `uuid` was wrongly in `needsInterop` (it's pure ESM, no default export) → "does not provide an export named 'default'" broke app init; removed it and pre-bundled `uuid`. Shipped v1.4.189. Two-client e2e R1–R7 all green; 318 unit tests green.

**Prod dedup (the real "messy/out-of-sync" cause)**: read-only prod queries (user-approved) revealed 41 groups with heavy duplication — each weekday ×2, Today ×4, "1" ×9, "Done" ×8 — accumulated since Jan; the migration had also added empty UUID day-copies. Verified every duplicate-to-delete had **0 tasks** (checked both `position.parentId` AND the `parent_id` column; confirmed no surviving group nested under a delete target). Backed up groups+tasks to `.dev/prod-backups/`, then **soft-deleted + tombstoned 30 empty duplicates/junk** (reversible). Prod now: 10 clean groups (Mon–Sun, Today, Tomorrow, 1 project), zero dupes. Hardened the migration to **only convert day-column groups** (`date`/`day_of_week` keywords) so it can't resurrect junk (`isMigratableDayGroup`). Shipped v1.4.190.

**Auth refresh-token contention (root of the "doesn't sync"/406/queue-stall cascade)**: multi-client/multi-instance single-use refresh-token rotation → "Invalid Refresh Token: Already Used" → dead token → realtime.setAuth fails + RLS 406s + queue stalls. Confirmed Realtime infra is healthy (publication has tasks+groups, REPLICA IDENTITY default-PK is sufficient, R5/R6 prove delivery under valid auth). Fixes: (1) v1.4.191 — backup-restore refresh failure no longer hard-fails auth init (clears stale backup + keepSessionForReconnect). (2) v1.4.192 — `restoreAuthSessionFromBackup` skips replaying a STALE backup (access token expired AND saved > ~JWT_EXP ago) via pure `isAuthBackupReplayable` (tested). Normal use (single Electron instance + separate-origin web clients) avoids the contention; today's was self-inflicted by ~6 force-spawned instances. Open followup: verify VPS `GOTRUE_REFRESH_TOKEN_REUSE_INTERVAL`=10s (default).

**Electron launch "doesn't load" (KDE Plasma X11)**: dock `.desktop` `Exec` pointed at the `flowstate` Hermes DB CLI (not the app) → animation then nothing; also Electron 41 + KDE X11 GPU/sandbox needs flags. Fixed via wrapper `~/.local/bin/FlowState-launch.sh` (`--no-sandbox --ozone-platform=x11 --disable-gpu`) + repointed `.desktop` + kbuildsycoca. App loads. (Agent shell CANNOT launch the GUI — sandbox blocks FUSE/namespaces; verify via user.)

**API rate-limit write storm (the "won't STAY in sync" root cause)**: localhost console showed `[TIDY] Wrote 10 group moves + 31 task moves` repeating, with `[CANONICAL-LAYOUT:VF] x=1616 -> 1616` (moving to the SAME position) → hundreds of `Save Group Error: API rate limit exceeded`. Cause: `useTidyLayout`/`useDayGroupRotation` emit a move for EVERY group/task and wrote them ALL unconditionally, so every canvas load/sync re-wrote identical positions → flooded the self-hosted API → rate-limit → cascaded into token-refresh failures, 406s, sign-outs across clients. Fix (v1.4.193): both paths now filter NO-OP moves (target within 0.5px of current, and unchanged parent) before writing → idempotent re-runs write nothing → no storm. Lint clean, 21 day-group unit tests pass. Follow-up test to add: assert tidy/rotation produce zero writes when positions are already canonical.

**Durable prevention guardrails (so the class can't return) — all 3 done v1.4.194**:
1. **Systemic no-op write guard + write-storm tripwire** — `updateGroup` now drops position writes that don't change anything (skips the write entirely if it's a pure no-op), so ANY caller (not just tidy/rotation) is storm-proof. `recordWrite` (`src/utils/sync/writeRateGuard.ts`) is wired into `updateGroup`/`updateTask`: keyed per-(entity), it THROWS in tests/CI when the same row is written >15×/s (a feedback loop) and console.errors in the app (never throws in dev/prod — must not break the user's app). Test: `tests/unit/sync/write-rate-guard.test.ts`.
2. **Two-client harness wired into CI** — new `canvas-sync` job in `.github/workflows/ci.yml` boots local Supabase and runs the R1–R7 two-independent-client Realtime e2e + canvas/sync unit suites on every PR.
3. **Schema-vs-payload completeness test** — `tests/unit/sync/task-sync-payload-completeness.test.ts` fails the build when a column syncs on CREATE but not UPDATE (the field-completeness trap), with an explicit create-only allowlist. 333 unit tests + R1–R7 e2e green.

**Phases 1–4 (📋 planned)**: enforce geometry invariants (allowlist guard + group guard, throw in dev), invert sync payload to denylist + schema-completeness test, harden Realtime recovery (try/finally on setupSubscription, no-token reschedule, KDE atomic leadership), wire canvas/sync tests into CI on local Supabase. Plan: `~/.claude/plans/there-are-many-returning-sorted-anchor.md`.

**Note**: R1 (all-nodes-shift) passes headless because that symptom is BUG-1807 (Electron GPU compositor, not reproducible in headless Chromium). R1 guards the complementary store-level invariant. R3 needs strengthening with day-grouped (dueDate) tasks to actually exercise `useDayGroupRotation`.

### BUG-1807: Canvas nudge — all nodes shift on inbox drop (Electron) (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (2026-05-31)

**Problem**: On the Electron desktop build, dragging a task from the canvas inbox onto the canvas makes every rendered canvas node shift together for a frame, then settle — the "nudge". Earlier fixes (autoPanOnNodeDrag, setNodes refeed) addressed node-drag and viewport nudges but not the inbox-drop case.

**Root cause**: `useCanvasSync.syncStoreToCanvas` only had an in-place patch path for equal node counts. Adding a node (inbox→canvas drop) changed the count (N→N+1), forcing a full `setNodes()` that replaces the entire reactive node array. Vue Flow then re-parses every node (position/dimensions). Chromium's keyed reuse hides this, but Electron's GPU compositor re-rasterizes all node layers → visible collective shift.

**Fix**: Added an incremental add/remove path in `syncStoreToCanvas`. When the only structural change is added/removed nodes and surviving nodes keep their type/parent, it patches changed survivors with `updateNode`, removes deletions with `removeNodes`, and appends new nodes with `addNodes` (groups first for parent-before-child). Existing node instances are never re-mounted → no compositor reflow → no nudge. Falls back to full `setNodes()` when topology actually changes.

**Regression tests**: New `tests/e2e/canvas-inbox-nudge.spec.ts` fires a real HTML5 drop and samples every existing node's screen rect + the viewport transform across animation frames, asserting no drift and a stable viewport. (Note: headless Chromium cannot reproduce the Electron-only compositor shift, so this guards behavior/no-regression; the actual nudge is verified on the deployed Electron build.)

**v1.4.80 attempt (did NOT fix)**: Shipped incremental `addNodes` instead of full `setNodes` on count change. Kept (safe perf improvement) but not the culprit — paint profiling showed it identical to the old path (337 vs 341 paints).

**Root cause (FOUND, v1.4.81)**: The shift is invisible to layout APIs (`getBoundingClientRect` = 0px drift), so it's a **GPU-compositor repaint**. Using CDP `LayerTree.layerPainted` profiling, the inbox drop produced ~341 paints; disabling `.task-node.is-recently-created` dropped that to **32** — a 90% reduction. The culprit is the `animate-creation` keyframes in `TaskNode.vue`: a 2s `transform: scale(0.6→1.1→…→1)` bounce that fires when a node mounts with `createdAt < 5s` (exactly a just-created task dragged from the inbox). **Accurate mechanism** (corrected — the card is NOT glass; `.task-node` has `backdrop-filter` removed per BUG-1216): the transform pane uses `transform-style: preserve-3d` (text-crispness fix, BUG-041/1408); animating a child's `transform: scale()` inside that shared 3D context forces the browser to re-rasterize the **entire** context every frame (→ the observed full-viewport 1280×720 repaint), and on Electron's GPU compositor that full re-raster lands sub-pixel-shifted → the whole canvas appears to shift together. The scale also violated the BUG-1328 invariant ("no transform on the node root"). (An earlier note here said "backdrop-filter re-sample" — that was wrong; the fix is identical regardless.)

**Fix (v1.4.81 → hardened in v1.4.82)**: Rewrote `animate-creation`. v1.4.81 removed `scale()` (paints 341→146). v1.4.82 made it **opacity-only** (removed `filter: brightness` and the animated `box-shadow` too — `filter` on a glass card also re-composites the backdrop), 0.45s. Paints during drop: 341 → **36** (near the 32 "no animation" floor). Zero transform, zero filter, zero geometry change → nothing can re-sample the backdrop or shift.

**Regression tests**: `tests/unit/canvas/creation-animation-no-transform.test.ts` asserts the keyframes contain no `scale()`/`transform`. `tests/e2e/canvas-inbox-nudge.spec.ts` guards no node/viewport drift on real drop.

**Verified**: `vue-tsc` clean, 171/171 canvas unit tests, e2e passes, CDP paint count 341→146. Shipping to Electron updater as **v1.4.82**. **Awaiting user confirmation on desktop** that the canvas no longer shifts.

**Files**: `src/components/canvas/TaskNode.vue` (fix), `src/composables/canvas/useCanvasSync.ts` (v1.4.80 perf), `tests/unit/canvas/creation-animation-no-transform.test.ts`, `tests/e2e/canvas-inbox-nudge.spec.ts`.

**Related follow-up (not part of this bug)**: `task-flash-green/red/amber/blue` keyframes in `TaskNode.vue` also use `transform: scale(1.02)` on the glass card. They fire on the `task-action-flash` event (explicit date/status edits), NOT on inbox drop, so they don't affect BUG-1807. But they're the same latent class (scale on a backdrop-filter card → Electron compositor shift) and should likely be made transform-free too if a similar nudge is ever reported on date/status edits. `transition: all` on `GroupNodeSimple`/`CanvasGroup`/`ImageNode` roots is a related concern (animates transform on glass). → **Surfaced as BUG-1808.**

---

### BUG-1808: Canvas nudge on date edit (overdue → today / context-menu reschedule) (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (2026-06-01)

**Problem**: On the Electron desktop build, rescheduling a task to a new date — e.g. picking **Today** from the canvas context menu / overdue reschedule — makes every canvas node nudge/shift together for a frame, exactly like BUG-1807 but triggered by a date edit instead of an inbox drop.

**Root cause**: The `task-action-flash-*` keyframes in `TaskNode.vue` (fired via the `task-action-flash` event by `useTaskContextMenuActions.setDueDate`) animated `transform: scale(1)→scale(1.02)→scale(1)` on the `.task-node` card. Same compositor-shift class BUG-1807 identified: a `transform` inside the shared `preserve-3d` context forces a full re-rasterization, which Electron's GPU compositor lands sub-pixel-shifted → the whole canvas appears to shift. This was the exact "related follow-up" BUG-1807 predicted.

**Fix**: Made all four `task-flash-{green,red,amber,blue}` keyframes transform-free — the brightness + box-shadow glow pulse carries the feedback, no `scale()`. The OverdueBadge reschedule path (`useTaskNodeActions.handleReschedule`) does not flash and only performs a legitimate single-node reparent into the matching smart group; the group root (`.section-node`) is already transform-free with backdrop-filter removed, so it is not a nudge source.

**Regression tests**: Extended `tests/unit/canvas/creation-animation-no-transform.test.ts` with a `BUG-1808` block asserting none of the four flash keyframes contain `scale()`/`transform`. 6/6 pass.

**Files**: `src/components/canvas/TaskNode.vue` (flash keyframes), `tests/unit/canvas/creation-animation-no-transform.test.ts`.

**Awaiting**: Electron build + deploy and user confirmation on desktop that the date-edit nudge is gone.

---

### ~~BUG-1806~~: Mark-done can still trigger phantom nudge state (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-28)

**Problem**: After the first KDE mark-done cleanup, the generic nudge timer could still interrupt later because its final gate only checked idle/session timing. It did not prove there was an actionable reminder task after the completed task was hidden/refreshed.

**Fix**: The KDE nudge path is now task-backed. The timer refreshes the unfiltered nanny task cache, rebuilds the reminder list, and only calls `sendNannyNotification()` when `hasActionableNannyTasks()` finds a non-hidden, non-done pinned task or a non-hidden, non-done task due today. `sendNannyNotification()` has the same guard defensively, and the nanny REST query is scoped by `user_id`.

**Regression tests**: KDE unit coverage now verifies the final actionable reminder task blocks future nudges, while another visible pinned task still allows reminders. Canvas mark-done E2E now waits for initial Vue Flow transform settling and verifies mark-done does not move sibling task geometry.

**Verified**: `npm test -- --run tests/unit/kde/nudge-popup.test.ts tests/unit/kde/nanny-gates.test.ts tests/unit/kde/task-list-building.test.ts` (59/59), `npm test -- --run tests/unit/kde` (151/151), focused Playwright mark-done canvas regression, `npm run type-check`, `npm run electron:build`, `./scripts/deploy-electron-update.sh`; public updater manifest shows `1.4.78`.

**Files**: `packages/kde-widget/contents/ui/main.qml`, `tests/unit/kde/nudge-popup.test.ts`, `tests/e2e/canvas-geometry-local.spec.ts`.

---

### ~~BUG-1805~~: KDE nanny nudge resurfaced after marking a task done (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-27)

**Problem**: In the KDE widget, marking a task done could immediately let the nanny/nudge reminder resurface or keep the completed task in reminder-backed caches. The mark-done path only refreshed the visible task list, leaving popup state, idle timing, pinned tasks, and the unfiltered nanny task cache stale.

**Fix**: `markTaskDone()` now treats completion as user activity: it dismisses nanny/nudge popups, resets the reminder timing gates, removes the task optimistically from visible/pinned/nanny caches, hides it from same-day reminder rebuilding, PATCHes `completed_at`/`updated_at`, and refreshes all reminder task caches after Supabase confirms. Failed PATCHes remove the hidden guard and refresh caches so the task is restored instead of silently disappearing. The nanny list builder also excludes stale done pinned entries defensively.

**Regression tests**: KDE unit coverage now verifies mark-done popup dismissal, nudge timing reset, immediate cache removal, failed-completion hidden-guard rollback, and stale done pinned task exclusion. Full KDE unit suite passes.

**Files**: `packages/kde-widget/contents/ui/main.qml`, `tests/unit/kde/nudge-popup.test.ts`, `tests/unit/kde/task-list-building.test.ts`.

---

### ~~BUG-1804~~: Canvas refresh/update reload could mix fresh group geometry with stale task geometry (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-26)

**Problem**: After Electron updates, hard refreshes, or other cold reloads, the Canvas could appear rearranged even though the user did not ask for layout changes.

**Root cause**: Group reload already preferred newer IndexedDB/local geometry when the offline sync queue had not yet flushed to Supabase, but task reload always started from Supabase when the in-memory store was empty. A restart could therefore combine fresh local group positions with stale remote task positions. Startup also still ran an automatic containment reconciliation path that could rewrite `parentId` during reload based on partially mixed geometry.

**Fix**: Task load now mirrors group load: if IndexedDB has newer canvas geometry by `positionVersion`/`updatedAt`, it preserves local `canvasPosition`, `parentId`, `positionFormat`, and version, then queues a catch-up write so Supabase converges. Canvas startup no longer writes parent topology from spatial reconciliation; parent changes are limited to explicit drag/drop flows.

**Regression tests**: Added Smart Merge coverage for newer cached task geometry winning on cold reload and older cached geometry losing to remote. Existing Canvas E2E nudge coverage now verifies root task drag, group drag, grouped-task topology sync, and inbox drop do not move unrelated nodes or the viewport.

**Files**: `src/stores/tasks/taskPersistence.ts`, `src/composables/canvas/useCanvasOrchestrator.ts`, `tests/unit/stores/smart-merge.test.ts`, `tests/e2e/canvas-geometry-local.spec.ts`.

### ~~BUG-1803~~: Complete undo/redo action audit across Canvas and task workflows (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-26)

**Problem**: The current pass fixed task-to-group connection undo/redo and a field-clearing redo asymmetry, but the user goal is broader: every undo/redo flow for every action must work at least three consecutive times. That broader claim is not proven yet.

**Current verified pass**: Task-to-group Canvas links are now group-level only (`CanvasGroup.linkedParentTaskId`) and no longer rewrite child tasks' `parentTaskId` on link, unlink, drop, or drag-settle. `canvas-connection` undo/redo restores only group link state. Task-to-task Canvas connect/disconnect now has direct three-cycle undo/redo coverage, ignores duplicate connects without adding undo entries, and refuses stale-edge disconnects whose source is not the target task's current parent. Canvas task/group drag and group resize now commit a single `canvas-geometry` undo entry after the drag/resize operation settles; mixed task/group geometry restores across three undo/redo cycles. The Tidy layout toolbar command and physical day-group rotation now preserve their synchronous CanvasView contract while recording explicit before/after `canvas-geometry` snapshots after pending task writes finish; both snapshot-backed geometry entries restore across three undo/redo cycles. Keyboard undo/redo now routes app-level shortcuts through the singleton, defers while Quick Sort owns the active view, and preserves native input undo. Quick Sort keyboard redo now handles Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z, and composable redo re-applies `MARK_DONE` status plus `MARK_DONE_AND_DELETE` deletion for three consecutive cycles. Context-menu/modal entry points now use undo-aware APIs for pin, calendar lock, done fully, AI breakdown task creation, recurrence permanent delete, and recurring remove-from-canvas. `bulkMoveToInboxWithUndo` now restores and re-clears `canvasPosition` for three undo/redo cycles. Group create/delete/resize undo/redo now preserves group IDs across three consecutive cycles, preventing snapshot restores from recreating groups under new IDs. Task create/update/delete/permanent delete/bulk delete, public Kanban/status move, public project move wrappers, and Kanban multi-field drops now have direct three-cycle regression coverage. Kanban status/priority/date/category/sidebar-project drops route through undo-aware APIs instead of plain task mutations. Board list-mode updates, All Tasks create/update/move/complete flows, Batch Edit quick/bulk updates, direct edit-modal saves, quick task creation, command-palette creation, task-card status/duration edits, task assignment, Morning Dashboard quick creation, pinned quick-task changes, mini-canvas edits, calendar drag/resize/date moves, and grouped reorder persistence now route through undo-aware APIs with regression/source-contract coverage. Canvas image delete now has direct three-cycle regression coverage and verifies restored images do not duplicate. Quick Sort local undo/redo now has direct three-cycle coverage across categorize, mark done, mark done/delete, and save actions. Canvas drag/drop regression coverage now proves root task drag, group drag, grouped-task topology sync, and inbox-to-canvas drop do not nudge unrelated rendered nodes or viewport transform. Shipped to Electron updater as v1.4.77.

**Completion note**: Remaining layout/system-maintenance writes were reviewed as intentional non-user undo boundaries (initial auto-placement, migration/reconcile writes, metadata-only day-group date rotation). User-facing undoable mutations now have direct regression coverage or source-contract coverage.

**Files in current pass**: `src/components/canvas/TaskNode.vue`, `src/components/kanban/KanbanColumn.vue`, `src/components/kanban/card/TaskCardBadges.vue`, `src/components/layout/CommandPalette.vue`, `src/components/morning-dashboard/BigThreeCard.vue`, `src/components/morning-dashboard/MorningQuickCapture.vue`, `src/components/tasks/BatchEditModal.vue`, `src/components/tasks/QuickTaskCreate.vue`, `src/components/tasks/TaskContextMenu.vue`, `src/components/tasks/TaskList.vue`, `src/composables/calendar/useCalendarDayView.ts`, `src/composables/calendar/useCalendarMonthView.ts`, `src/composables/calendar/useCalendarWeekView.ts`, `src/composables/canvas/useCanvasConnections.ts`, `src/composables/canvas/useCanvasEvents.ts`, `src/composables/canvas/useCanvasInteractions.ts`, `src/composables/canvas/useDayGroupRotation.ts`, `src/composables/canvas/useTidyLayout.ts`, `src/composables/mini-canvas/useMiniCanvasActions.ts`, `src/composables/tasks/card/useTaskCardActions.ts`, `src/composables/tasks/useTaskContextMenuActions.ts`, `src/composables/tasks/useTaskEditActions.ts`, `src/composables/useCalendarCore.ts`, `src/composables/useQuickSort.ts`, `src/composables/useQuickTasks.ts`, `src/composables/useUnifiedUndoRedo.ts`, `src/composables/undoSingleton.ts`, `src/composables/workspace/useTaskAssignment.ts`, `src/layouts/ModalManager.vue`, `src/stores/canvas/canvasGroups.ts`, `src/stores/tasks/taskHistory.ts`, `src/utils/globalKeyboardHandlerSimple.ts`, `src/views/AllTasksView.vue`, `src/views/BoardView.vue`, `src/views/CalendarViewVueCal.vue`, `src/views/CanvasView.vue`, `src/views/QuickSortView.vue`, `tests/e2e/canvas-geometry-local.spec.ts`, `tests/unit/canvas-connection-undo.test.ts`, `tests/unit/canvas-geometry-undo.test.ts`, `tests/unit/global-keyboard-undo-redo.test.ts`, `tests/unit/use-quick-sort-undo-redo.test.ts`, `tests/unit/undo-entrypoint-contract.test.ts`, `tests/unit/undo-selective-restore.test.ts`, `tests/unit/undo-task-operations.test.ts`, `tests/unit/undo-image-delete.test.ts`.

---

### ~~BUG-1802~~: Supabase REST outage blanked localhost canvas and surfaced sync errors (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-26) — localhost fixed; shipping in v1.4.62.

**Problem**: Localhost started showing `Sync Error(fetchTasks): An unexpected error occurred` and `Sync Error(saveTasks): An unexpected error occurred`; Canvas could load blank because cached tasks referenced groups while the group fetch returned HTTP 500.

**Root cause**: VPS `supabase-rest` had exited, so Kong could not resolve its `rest` upstream and returned HTTP 500 for every `/rest/v1/*` route. On the client, `useCanvasSync` deferred all parented tasks when `groups.length === 0`, which is correct for a partial group load but blanked the canvas when the entire groups request failed.

**Fix**: Restarted `supabase-rest` on the VPS and verified `tasks`/`groups` REST queries returned 200 with no fresh Kong REST 500/DNS errors. Hardened Canvas so, when groups are entirely unavailable, parented tasks render as root fallback nodes using their absolute coordinates; a later successful group load re-parents them without writing the fallback to storage. Kept write failures visible while suppressing generic transient read-fetch noise.

**Regression tests**: Added local Canvas E2E coverage for cached parented tasks remaining visible when group loading fails, plus Supabase infrastructure unit coverage that suppresses generic read fetch failures but still surfaces mutation failures.

---

### ~~BUG-1801~~: Background timer fetch showed noisy generic sync error (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-26) — shipping in v1.4.62.

**Problem**: The app could show `Sync Error(fetchActiveTimerSession): An unexpected error occurred` from the background timer poll, even though this is a transient Supabase/PostgREST fetch-layer failure and the timer read path safely returns `null`.

**Root cause**: The shared Supabase retry/error helper recognized explicit network messages (`Failed to fetch`, `AbortError`, timeout, etc.) but not Supabase's generic collapsed message `An unexpected error occurred` with status `0`, so the 15s active-timer poll surfaced a visible sync warning.

**Fix**: Centralized transient sync classification in `_infrastructure.ts`, treats the generic collapsed message as transient for read fetches, retries it, and suppresses both visible notifications and user-facing last-sync state for those fetch-only failures.

**Regression tests**: `tests/unit/composables/supabase-infrastructure.test.ts` covers retry behavior, notification/state suppression for generic read fetch failures, and confirms mutation failures still surface.

---

### ~~BUG-1800~~: Canvas Tidy/Rotate left phantom vertical gaps and could stale-lock tasks (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-26)

**Problem**: Canvas **Tidy** and **Rotate day groups** moved groups but still left large unexplained blank gaps inside Today. Earlier Tidy attempts also made tasks feel locked after the programmatic layout ran.

**Root causes**: (1) Tidy/Rotate stacked from `rawTasks`, so done/filtered/hidden canvas tasks still consumed invisible rows. The visible cards looked uneven because the hidden cards were being laid out between them. (2) Rotate still used `taskPositioning: 'preserveRelative'`, carrying old Y gaps forward instead of compacting like Tidy. (3) Vue Flow controlled-mode updates were fed internal fields (`computedPosition`, stale dimensions) or stale in-place arrays, which could desync dragging after reparent/restack. (4) The forced post-layout sync rebuilt group nodes without top-level `width`/`height`/`dimensions`, so Vue Flow bounds could revert to stale sizes.

**Fix**: Tidy and explicit Rotate now share the same layout concept: operate on visible canvas tasks only, measure rendered card heights, stack from the group header with compact consistent visual gaps, keep single-column day groups, release layout locks after writes settle, and force a clean store→Vue Flow projection. Programmatic Vue Flow application strips internal fields, uses one atomic `setNodes(...)`, converts child positions to parent-relative values, leaves `extent` unset, and keeps tasks draggable/selectable.

**Regression tests**: Added/updated focused unit coverage for hidden done tasks not consuming blank rows in both Tidy and Rotate, measured-height compact gaps, group dimension preservation after forced sync, controlled-mode node publishing after `applyNodeChanges`, lock release after Tidy, and no manual `computedPosition` stamping in the apply path.

**Files**: `src/composables/canvas/useTidyLayout.ts`, `src/composables/canvas/useDayGroupRotation.ts`, `src/composables/canvas/useCanonicalDayGroupLayout.ts`, `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasSync.ts`, `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasInteractions.ts`, `src/components/canvas/CanvasToolbar.vue`, `tests/unit/canvas/tidy-layout.test.ts`, `tests/unit/canvas/day-group-position-rotation.test.ts`, `tests/unit/canvas/canonical-layout.test.ts`, `tests/unit/canvas/tidy-atomic-apply.test.ts`.

**Verified**: User confirmed the populated signed-in localhost canvas now visually works after Tidy. Focused regression suite passed: `npm test -- --run tests/unit/canvas/day-group-position-rotation.test.ts tests/unit/canvas/tidy-layout.test.ts tests/unit/canvas/canonical-layout.test.ts tests/unit/canvas/tidy-atomic-apply.test.ts` → 53/53. Targeted source ESLint has 0 errors; remaining output is existing `no-explicit-any` warnings in canvas sync/interaction files.

---

### ~~BUG-1799~~: Electron realtime storm + sync double-write + blank-title resurrection (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-25) — deployed v1.4.51 to VPS auto-updater; user confirmed the realtime/sync console issues are resolved on the updated Electron build.

**Problem** (from production Electron console): (1) endless `📡 [REALTIME] Connection dropped (CHANNEL_ERROR)`→`(CLOSED)` loop; (2) `⚠️ [SYNC] LWW: Server wins … DISCARDED (delta 2–7s)` spam for tasks AND groups + 1–1.5s update latency (`[BUG-291]`); (3) `🛠️ [TASK-TITLE-REPAIR] … (permanentlyDeleteTask)` blank titles; (4) downstream `[NODE-SYNC] Conflict detected` bursts.

**Root causes** (verified vs source + supabase-js + local DB): (1) **Realtime** — supabase-js dedupes channels by topic, so re-entrant `setupSubscription()` re-binds `postgres_changes` listeners (events handled N×) + competes with realtime-js's own rejoinTimer, and `retryCount` was reset to 0 on every Electron `visibilitychange`/`online` tick → no backoff → storm. (2) **Double-write** — `updateTask`/`updateGroup` enqueue a sync op AND then unconditionally direct-save; the direct save's fresh `updated_at` (now) out-timestamps the queued op → false `position_version` conflict → LWW "server wins" discards a duplicate. (3) **Resurrection** — LWW writeback `updateTaskFromSync(id, data, false)` ADDS a task when absent (`tasks.ts:248`), re-adding a locally-deleted task with a sanitized blank title.

**Fix**: (1) `useRealtimeSubscription.ts` — `isConnecting` single-flight guard + single cancellable `reconnectTimer` (collapses CHANNEL_ERROR+CLOSED double-schedule), tear down stale channel before re-create, stop resetting `retryCount` outside SUBSCRIBED, visibility/online only reconnect when dead & not already connecting/scheduled. (2) Sync queue becomes the single writer: completed the task queue payload with the 7 fields it was missing (`planning_notes, connection_types, depends_on, column_id, calendar_locked, notification_prefs, parent_task_id` + `total_pomodoros`) mirroring `toSupabaseTask`, then removed the unconditional direct save in `taskOperations.ts` (kept enqueue-failure fallback); made the group `saveGroupToStorage` a fallback-only in `canvasGroups.ts`. Queue keeps `position_version` optimistic lock + field-level merge. (3) `useSyncOrchestrator.ts` writeback honors `serverData.is_deleted` and skips re-adding tasks absent from `rawTasks`.

**Files**: `src/composables/supabase/useRealtimeSubscription.ts`, `src/stores/tasks/taskOperations.ts`, `src/stores/canvas/canvasGroups.ts`, `src/composables/sync/useSyncOrchestrator.ts`. Plan: `~/.claude/plans/stateful-scribbling-thompson.md`.

**Verified**: vue-tsc 0 new errors on the 4 files (166 pre-existing elsewhere, TASK-1789); lint clean; 82/82 unit+integration pass (`sync-retry-strategy`, `task-sync-flow`, `task-rollback`, `task-completeness`, `sync-readonly`, `realtime-drag-race`); production build green. Deployed v1.4.51 (`FlowState-1.4.51-x86_64.AppImage`) to VPS; `https://in-theflow.com/updates/electron/latest-linux.yml` → 1.4.51. User confirmed resolved on the updated Electron build (2026-05-25).

---

### ~~TASK-1798~~: Canvas Tidy pulls tasks into matching group + stacks at top (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-24)

**Problem**: The Canvas **Tidy** button didn't pull tasks into the group they belong to, and didn't move group members to the top. Tasks sitting low stayed low; a task due today stuck in another group was never moved into Today.

**Root cause** (`src/composables/canvas/useTidyLayout.ts`): (1) restacked with `taskPositioning: 'compactFromCurrentTop'`, which anchored the stack at the current topmost task instead of the header; (2) the re-home pass only touched orphans (`if (task.parentId) continue`) and only restacked `parentId === group.id` tasks — so dated tasks in the wrong group / loose tasks inside custom groups were never adopted.

**Fix**: (1) switched Tidy to `taskPositioning: 'fromHeader'` (tasks stack at `groupY + HEADER 50 + PADDING 20`). (2) Date-association pass now runs over **all** dated tasks (dropped the orphan guard) and re-parents each into its `findMatchingGroupForDueDate` group (today→Today, etc.); undated tasks are left alone. (3) Spatial-adoption fallback adopts loose tasks whose center sits inside a **custom** group's bounds via `getDeepestContainingGroup`, skipping date-claimed tasks so the date rule wins. All writes use the `'DRAG'` origin (within Single-Writer geometry invariant; `useCanvasSync.ts` untouched).

**Follow-up (v1.4.52)**: v1.4.50 still overflowed — tasks pulled into Today stacked from the top but spilled out the bottom because group height was summed from raw task heights independently of the grid-snapped position loop, so the box under-sized and clipped tail tasks (worse as more tasks piled in). Fixed in `useCanonicalDayGroupLayout.ts` by deriving group height from the tasks' ACTUAL placed footprint (`maxTaskBottomRelative + GROUP_PADDING`, floored at `DAY_GROUP_HEIGHT`) instead of a parallel sum — the box now always contains its tasks.

**Files**: `src/composables/canvas/useTidyLayout.ts`, `src/composables/canvas/useCanonicalDayGroupLayout.ts`, `tests/unit/canvas/tidy-layout.test.ts`, `tests/unit/canvas/canonical-layout.test.ts`.

**Verified**: `tests/unit/canvas/` 124 pass (incl. new overflow-regression test with 13 tall tasks exceeding the height floor); lint clean. Shipped v1.4.52 to Electron auto-updater.

---

### TASK-1797: Local task API for Life OS Advisor (Electron-integrated, token-based) (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW (opened 2026-05-24) — implemented + verified locally; pending in-app round-trip + ship.

**Problem**: Life OS Advisor (separate local app) needs to read FlowState tasks for context and create/update them on explicit user approval, over a tiny localhost API.

**Approach**: Node `http` sidecar (`server/local-api/server.cjs`, zero new runtime deps — reuses `@supabase/supabase-js`) over the same Supabase `tasks` table. Additive; UI keeps syncing via realtime. Two modes:
- **Token mode (shipped)**: Electron auto-spawns the sidecar via `utilityProcess` when enabled in Settings; renderer forwards the logged-in session (anon key + user JWT) so all queries are RLS-scoped. No service-role key shipped. Off by default; random per-machine bearer shown in Settings.
- **Service-role mode (standalone)**: `doppler run -- npm run api` for headless/app-closed use on your own machine; never bundled.

Binds 127.0.0.1 only, rejects non-loopback Host (403), bearer required in token mode, no CORS headers. Default port 5577.

**Endpoints**: `GET /api/health`, `GET /api/tasks?status=&limit=` (≤25, fields id/title/status/priority/dueDate/projectId), `POST /api/tasks`, `PATCH /api/tasks/:id`. App↔DB status map `todo→planned`/`done` (self-contained copy of `toDbStatus`, since `supabaseMappers.ts` imports Pinia).

**Files**: `server/local-api/server.cjs` + `README.md`, `electron/ipc/localApi.ts` (new), `electron/main.ts`, `electron/preload.ts`, `src/composables/useLocalApiBridge.ts` (new), `src/stores/auth.ts`, `src/services/auth/supabase.ts`, `src/components/settings/tabs/AccountSettingsTab.vue`, `package.json` (`api` script + esbuild bundle in `electron:build-main` + esbuild devDep). Plan: `~/.claude/plans/linked-wobbling-blanket.md`.

**Verified**: (1) `setSession` RLS-scoping in plain Node — anon→0 rows, with-session→only the user's rows; (2) full token-mode integration through a real Electron `utilityProcess` + bundled sidecar — pre-session 503, post-session correct RLS-scoped reads, POST 200; (3) HTTP layer (health/401/403/400/404/DB-error→JSON); (4) esbuild bundles supabase-js self-contained (537KB); (5) standalone service-role mode boots (no regression); (6) no new type/lint errors. **Pending (user-run)**: `npm run electron:dev` → sign in → enable in Settings → curl with bearer → POST shows in UI via realtime. Then ship per rules 6/7 (version bump + Electron deploy).

**Completed integration follow-up**: ~~**BUG-1942**~~ — v1.4.249 directly reconciles Local API mutations; v1.4.250 adds authoritative visible-resume reconciliation for missed PWA realtime events. The named task was recovered visibly in Electron without restarting.

**Completed startup-ownership follow-up**: ~~**BUG-1944**~~ — v1.4.252 separates persisted-account restoration from confirmed guest state, keeps remote operations gated until validation, and clears every account store on confirmed guest/sign-out.

**Completed Canvas deletion follow-up**: ~~**BUG-1945**~~ — v1.4.252 makes image deletion local-first and authoritatively removes protected image nodes from the rendered Canvas, with delete/undo/redo browser proof.

**Recurring completion follow-up**: **FEATURE-1943** adds an authenticated,
preview-first, idempotent `Done for now` action shared by the renderer and Local
Task API, with exact read-back and authoritative renderer reconciliation.

**Personal-assistant reliability follow-up**:
- [ ] **TASK-1943 — reliable Hermes–FlowState personal-assistant program**, beginning with dependency-linked **TASK-1944** for the canonical operation, revision, receipt, replay, and change-sequence boundary.

---

### ~~TASK-1791~~: Design overhaul — fix critique findings across all views (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-25) — shipped to production. Rebased onto master and merged via PR #157, deployed to in-theflow.com (web) + Electron auto-updater (1.4.50). Follow-up PR #158 self-hosted the Clash Display font (was blocked by the edge CSP). Restore tag `pre-design-overhaul-2026-05-21`.

**Phases (all ✅ implemented, each its own commit):**
- ✅ Phase 1: text contrast — `--text-muted` 0.45→0.55, `--text-subtle` 0.35→0.45 (WCAG AA)
- ✅ Phase 2: project-color left accent on board cards (project identity in mixed-project views)
- ✅ Phase 3: quick-add elevated to primary (brand accent), Create project demoted to ghost
- ✅ Phase 4: clock/timer divider, idle-timer resting border, long-break icon User→Armchair
- ✅ Phase 5: guiding inbox/canvas-group empty states; confirmed calendar empty inbox is filter behavior, not a bug

Type-check: 0 new errors introduced (GroupNodeSimple's 9 pre-existing errors tracked under TASK-1789).

**Problem**: Whole-app design critique flagged 5 priority issues: (1) low-contrast actionable text (dates/estimates at 35-45% opacity), (2) color double-encoding (priority shown as both dots and pills; teal overloaded across brand/active/status/project), (3) no clear primary action (Create project louder than quick-add), (4) unlabeled 7-icon header soup with clock+timer jammed together, (5) weak/possibly-buggy empty states (Calendar filter-empty hides seeded tasks; canvas partially-populated groups have no add prompt).

**Approach**: Safe phased overhaul, each phase checkpointed + screenshot-diffed against baseline. Restore via `git reset --hard pre-design-overhaul-2026-05-21`.
- Phase 1: text contrast tokens (design-tokens.css)
- Phase 2: color semantics — pills as single priority encoding, project identity on cards, teal=brand only (TaskCardStatus.vue, TaskRowPriority.vue, TaskRowProject.vue)
- Phase 3: primary action — quick-add loudest, demote Create project (SidebarQuickTaskInput.vue, SidebarProjectsSection.vue)
- Phase 4: header — group/label icons, separate clock from Pomodoro timer (AppHeader.vue)
- Phase 5: empty/edge states + investigate Calendar default-filter bug (CalendarInboxList.vue, canvas)

**Baseline screenshots**: `.dev/screenshots/critique-{board,canvas,calendar,tasks}.png`

---

### ~~BUG-1796~~: Canvas rendered zero nodes — `toRelativePosition` used but not imported (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-23)

**Problem**: After v1.4.48, the app loaded but the Canvas was completely empty (no nodes, no groups) for users with parented canvas data, while the inbox panel listed tasks normally.

**Root cause**: `src/composables/canvas/useCanvasSync.ts` calls `toRelativePosition(...)` at lines 302 (group nodes) and 457 (task nodes) but never imported it (exported from `src/utils/canvas/coordinates.ts:50`). Introduced by BUG-1792 (commit 9c92acc3). Both call sites only run for a node with a *visible parent*, so a nested group / task-in-group triggered `ReferenceError: toRelativePosition is not defined`. `syncStoreToCanvas` is `try { …build… setNodes() } finally {}` with no `catch`, so the throw skipped `setNodes()` entirely → empty canvas. Surfaced via Vue's effect error handler (logged, non-fatal) so no white screen.

**Why it slipped through**: `npm run build` (Vite/esbuild) doesn't type-check; CI type-check is disabled by TASK-1789 (~160 errors). `vue-tsc` *does* flag it (`TS2304: Cannot find name 'toRelativePosition'`), ESLint does not (typescript-eslint disables `no-undef`). The e2e harness can't reproduce it: in-memory seeded groups get wiped by the DB realtime reload, so seeded parented nodes lose their parent before sync.

**Fix**: Add `toRelativePosition` to the existing `@/utils/canvas/coordinates` import in `useCanvasSync.ts`.

**Regression test**: `tests/unit/canvas/useCanvasSync-imports.test.ts` statically asserts every coordinates helper *called* in `useCanvasSync.ts` is imported. Verified it fails pre-fix (names `toRelativePosition`) and passes after. `geometry-invariants` + `sync-readonly` suites still green (54 tests).

**Follow-up**: TASK-1789 (re-enable CI type-check) is the systemic guard for this class of bug.

**Files**: `src/composables/canvas/useCanvasSync.ts`, `tests/unit/canvas/useCanvasSync-imports.test.ts`. Version bump 1.4.48 → 1.4.49.

---

### ~~BUG-1795~~: Null task title crashed Board and Canvas via TaskCardBadges (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-23)

**Problem**: Electron app showed "Something went wrong — Cannot read properties of undefined (reading 'trim')" on the Board view, and the Canvas rendered empty (37 placed tasks, none visible).

**Root cause**: `TaskCardBadges.vue` computed `hasTaskTitle` as `props.task.title.trim()`. A task with a `null`/`undefined` title threw during render. `TaskCard` (which renders `TaskCardBadges`) appears on the Board AND in the Canvas inbox panel (`UnifiedInboxList`), so one bad task took down both views. Render-side companion to the sync/DB defenses in BUG-1777/BUG-1779.

**Fix**: Guard the computed — `(props.task.title ?? '').trim().length > 0`.

**Regression test**: `tests/unit/components/task-card-badges-null-title.test.ts` mounts the component with `null` and `undefined` titles. Verified it fails on the pre-fix code (reproduces the exact throw) and passes after.

**Files**: `src/components/kanban/card/TaskCardBadges.vue`, `tests/unit/components/task-card-badges-null-title.test.ts`. Version bump 1.4.47 → 1.4.48.

---

### ~~BUG-1792~~: Canvas idle sync persisted stale group/task positions (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-22)

**Problem**: Canvas groups and tasks could move without user dragging, then stay wrong after refresh. That meant a passive sync/render path was not just displaying stale geometry; it could replay stale Vue Flow/PositionManager coordinates into persistent store state.

**Root cause**: `useCanvasSync.ts` treated existing Vue Flow node positions and `PositionManager` as authoritative during read/sync paths. `PositionManager` is an interaction-time cache, so idle syncs triggered by unrelated task/title/filter activity could reuse stale drag/frame coordinates instead of store/Supabase absolute coordinates.

**Fix**: Make store/Supabase absolute coordinates authoritative for canvas read paths. Group nodes now read from `group.position`; task nodes read from `task.canvasPosition`; nested Vue Flow positions are derived with `toRelativePosition(absolutePos, getGroupAbsolutePosition(parentId, groups))`. Removed the idle sync block that preserved existing Vue Flow positions over freshly derived store positions.

**Hardening**: `taskOperations.updateTask()` now strips forbidden geometry fields from `SYNC` and `SMART-GROUP` updates before persistence. These sources can still update metadata, but cannot mutate `parentId`, `canvasPosition`, `positionFormat`, or `positionVersion`.

**Regression tests**: Added `tests/e2e/canvas-geometry-local.spec.ts` coverage for both group and task idle drift. The tests create canvas geometry, trigger unrelated idle sync activity, refresh, and assert positions are unchanged with no geometry write logs.

**Verification**:
- `./scripts/run-e2e.sh tests/e2e/canvas-geometry-local.spec.ts -g "idle sync activity and refresh do not persist (group|task) position changes" --project=chromium` passed.
- `npm test -- --run tests/unit/geometry-invariants.test.ts tests/unit/sync-readonly.test.ts tests/unit/smartgroup-metadata.test.ts` passed.
- `npm test -- --run tests/unit/stores/task-store-crud.test.ts tests/unit/geometry-invariants.test.ts tests/unit/sync-readonly.test.ts tests/unit/smartgroup-metadata.test.ts` passed.
- `npm run build` passed.
- `npm run electron:build` passed.

**Files**: `src/composables/canvas/useCanvasSync.ts`, `src/stores/tasks/taskOperations.ts`, `tests/e2e/canvas-geometry-local.spec.ts`, `tests/unit/stores/task-store-crud.test.ts`, `tests/global-setup.ts`.

---

### TASK-1789: Fix ~160 pre-existing type-check errors blocking CI (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (opened 2026-05-18) — **NEXT UP**

**Problem**: `npm run type-check` reports ~166 errors across ~50 files (CanvasView, BoardView, PerformanceView, auth.ts, GroupNodeSimple, AISettingsTab, KanbanColumn, etc.). CI has been failing on the `check` job for 5+ consecutive runs. The VPS deploy workflow runs separately from CI so deploys aren't blocked, but the red-CI state masks regressions any future PR might introduce.

**Scope**: pure type-fix sweep. No behavior changes. Errors fall into known buckets — wrong vue-flow prop signatures on Canvas, missing null-guards on optional types, `Record<string, unknown>` mismatches on wrapper handlers, Pinia auth.ts typing drift, missing `from` field on NodeChange objects. Split into one PR per high-error file to keep blast radius small.

**Why now**: TASK-1785 (calendar ripple + lock) landed clean type-wise and dropped 4 errors. Every fix from here should keep the bar green. Letting CI stay red trains the team to ignore the gate.

**Top files by error count** (npm run type-check, 2026-05-18):
- src/views/CanvasView.vue — 13
- src/views/PerformanceView.vue — 12
- src/stores/auth.ts — 12
- src/components/settings/tabs/AISettingsTab.vue — 9
- src/components/canvas/GroupNodeSimple.vue — 9
- src/views/CalendarView.vue — 8
- src/components/kanban/KanbanColumn.vue — 7

**First step on resume**: `npm run type-check 2>&1 | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -rn` to confirm error-code distribution, then fix the highest-count file first.

**Out of scope**: no runtime/UX changes, no refactors, no behavior tweaks. Pure type annotations and minimal restructuring.

---

### ~~TASK-1790~~: Restore timer follower poll as Realtime backstop (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (shipped 2026-05-18, v1.4.37, commit 4b68d919)

**Problem**: KDE widget shows a running Pomodoro (e.g. 9m on task "לארגן משימות / טאבים") while the Vue/Electron app on the same machine shows idle `25:00`. Cross-device sync is broken.

**Root cause**: Commit `f616303a` ("accumulated fixes — timer sync") removed `resumeFollowerPoll()` from two idle-transition sites in `src/stores/timer.ts` and made the no-active-session branch of `initializeSync()` in `src/composables/timer/useTimerSync.ts` rely **solely** on Supabase Realtime to detect sessions started by other devices. The same file (`src/composables/supabase/useRealtimeSubscription.ts:168`) explicitly handles `CLOSED`/`TIMED_OUT`/`CHANNEL_ERROR` as expected runtime conditions (BUG-1320). Any missed Realtime INSERT (cold-start race, WS drop, replication hiccup) leaves Vue permanently deaf — verified against VPS DB: matching session existed in `timer_sessions` with the right `user_id` and `task_id` while Vue showed idle.

**Fix**:
- `useTimerSync.ts:17` — bump `FOLLOWER_POLL_INTERVAL_MS` from 3000 to 15000 so continuous polling is cheap (~4 queries/min) and BUG-1085's anti-spam intent is preserved.
- `useTimerSync.ts:~159` — don't auto-pause the poll on no-session; the poll IS the backstop.
- `useTimerSync.ts:~640` — resume follower poll in init's no-session branch.
- `useTimerSync.ts:~255` — drop `currentSession.value` requirement from the 30s backoff retry so idle polling resumes after network failures.
- `timer.ts:~441, ~546` — restore `sync.resumeFollowerPoll()` on the two idle-transition paths f616303a stripped.
- `packages/kde-widget/contents/ui/main.qml:4277` — defensive: add `&user_id=eq.<root.userId>` to widget's active-session SELECT (RLS already enforces server-side, this is hygiene).

**Verification**: VPS DB confirms task `7009f622-e45f-428e-be41-f0e0900ee549` ("לארגן משימות / טאבים") had an active `timer_sessions` row during screenshot while Vue showed 25:00 idle.

---

### ~~TASK-1785~~: Calendar Shift+drag ripple-push reschedule mode (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-21, Push 1 v1.4.37 + Push 2 v1.4.41)

**Problem**: Dragging a calendar task to a later time only re-times that one task. When a meeting runs long or a block shifts, users have to manually re-time every later task on the day — N drags for one logical "everything moved later" action.

**Goal**: Add a Shift modifier on calendar drag. Hold Shift + drag a task to a later time → every later task on the same day shifts forward by the same delta. Locked tasks are skipped. Crossing midnight spills into the next day. One drag = one undo step.

**User-confirmed scope (v1)**:
- Same day, all later tasks (not just colliders)
- Spill into next day past midnight
- Per-task `calendarLocked` field; ripple skips locked tasks (Push 2)
- Live ghost-shift preview while Shift is held mid-drag
- Negative delta (drag earlier) explicitly out of scope for v1

**Status**:
- **Push 1 + 1.5** (PR #149, shipped v1.4.37): pure ripple math + 15 unit tests, day + week view wiring (handlers shared via CalendarView), live ghost preview via `rippleGhostOffsets` map.
- **Push 2** (PR #152, shipped v1.4.41): per-task `calendarLocked` field. Migration `20260520000000_add_calendar_locked_to_tasks.sql` applied to local + production Supabase (682 rows defaulted false). Mapper round-trip + ripple skip-protect (`if (task.calendarLocked) continue`). "Lock time on calendar" toggle in calendar context menu only (gated by `context` prop in ModalManager). 🔒 corner indicator in day + week view. Tests: mapper round-trip + api-contract allowlist.

**Out of scope (deferred)**: compress mode (Shift+drag earlier), bulk-lock, lock-from-board/list/canvas.

**Plan file**: `~/.claude/plans/yes-and-ask-me-flickering-river.md`

---

### TASK-1773: Planning canvas interaction polish (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (opened 2026-05-01)

**Problem**: The mini planning canvas has the core graph interactions now, but the creation flow still feels mechanical: cable-dropped nodes do not immediately enter edit mode, selected nodes lack an obvious local action surface, and messy sessions need a lightweight tidy affordance.

**Planned slices**:
1. ~~Auto-focus the title field when cable-drop creates a connected subtask.~~ ✅ DONE (commit `98d5b5df`)
2. ~~Add a selected-node floating toolbar for add/edit/delete actions.~~ ✅ DONE (2026-05-03, v1.4.9 — `MiniCanvasFloatingToolbar.vue` via `@vue-flow/node-toolbar`)
3. Add a mini-canvas Tidy action that cleans up subtask/note spacing. 📋 PLANNED
4. Add restrained node/edge microinteractions with reduced-motion support. 📋 PLANNED

**Files**: `src/components/mini-canvas/`, `src/composables/mini-canvas/`.

---

### ~~BUG-1781~~: Canvas "Hide overdue tasks" toggle flipped state without re-filtering visible nodes (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-03, v1.4.10)

**Problem**: Clicking the calendar/Hide-overdue button on the canvas right-side toolbar flipped `taskStore.hideCanvasOverdueTasks` (icon swapped Calendar↔CalendarX correctly) but the canvas didn't visually hide/show overdue task nodes.

**Root cause**: `useCanvasOrchestrator.ts:158-164` wrapped `taskStore` inside a plain object with getters before passing to `useCanvasFilteredState`. The getter wrapper around Pinia refs is a brittle reactivity pattern — Vue's tracking through plain-object getters can break depending on consumer access patterns, and the `...canvasStore` spread immediately above stripped reactivity off everything else.

**Fix**: pass the live Pinia `taskStore` directly to `useCanvasFilteredState`. Native Pinia auto-tracking applies; no plain-object indirection.

**Regression test**: `tests/e2e/canvas-toolbar-regressions.spec.ts` — describe "BUG-1781 — Canvas hide-overdue toggle reactively re-filters". Mutates two seeded test-user tasks (one overdue, one future) with canvas positions, clicks the Hide-overdue button, asserts the overdue node leaves the DOM via its `data-id` selector, clicks again, asserts the overdue node returns. Runs on both chromium + webkit.

**Files**: `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasFilteredState.ts`, `tests/e2e/canvas-toolbar-regressions.spec.ts`.

---

### ~~BUG-1782~~: Canvas Tidy button silently no-op'd for users without day-of-week groups (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-03, v1.4.10)

**Problem**: Clicking the LayoutGrid/Tidy button on the canvas right-side toolbar did nothing for users whose canvas only had custom-named groups (no Today/Tomorrow/Mon-Sun). `tidyDayGroups()` filtered inputs by `detectPowerKeyword` and bailed early when none matched.

**Fix (user-approved)**: broaden the input collector at `useTidyLayout.ts:75-93` to include every group with a position. Tidy now lays out custom + smart + day groups uniformly in a canonical single row, preserving the user's left-to-right X order and restacking tasks inside each.

**Side effect**: custom groups get resized to canonical day-group width/height (350-700w × 1000h). Documented; user explicitly chose this scope.

**Test contract update**: `tests/unit/canvas/tidy-layout.test.ts` — renamed "ignores custom-named groups" → "includes custom-named groups alongside day groups" with corresponding assertion flip.

**Regression test**: `tests/e2e/canvas-toolbar-regressions.spec.ts` — describe "BUG-1782 — Canvas Tidy works on custom-named groups". Creates 3 custom groups (no day-keyword) at non-canonical positions via `canvasStore.createGroup`, clicks Tidy, asserts all 3 settle to the same Y (canonical row) and X values are evenly spaced. Runs on both chromium + webkit.

**Files**: `src/composables/canvas/useTidyLayout.ts`, `tests/unit/canvas/tidy-layout.test.ts`, `tests/e2e/canvas-toolbar-regressions.spec.ts`.

---

### ~~BUG-1783~~: RecurrenceDeleteModal action buttons looked dim / low contrast (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-05-03, v1.4.10)

**Problem**: User reported "Skip this occurrence" + "Stop all future occurrences" buttons in `RecurrenceDeleteModal.vue` looked broken/dim.

**Cause**: prior styling commits (5 in total since the modal was added) progressively reduced background opacity and used fractional-alpha border colours (`rgba(78,205,196,0.8)`) that read as washed-out against the modal's dark surface. The current outlined-only design didn't visually communicate "primary action".

**Fix**: subtle CSS contrast bump in `RecurrenceDeleteModal.vue` scoped style:
- Border switched from `rgba(*, 0.8)` to full-saturation `var(--brand-primary)` / `var(--color-danger)`.
- Default background gains a tinted gradient (`linear-gradient(180deg, rgba(*, 0.12), rgba(*, 0.06))`) plus a 1px inset shadow ring so the brand colour reads at a glance.
- Hover deepens the gradient + adds a coloured drop-shadow halo.

**Why not BaseButton**: BaseButton enforces `white-space: nowrap` which would clip the two-line label/subtitle pattern these action buttons use. Bespoke styling is appropriate for this multi-line-action pattern.

**Regression test**: `tests/unit/recurrence-delete-modal-styles.test.ts` — source-text assertions on the SFC's scoped style block (jsdom doesn't apply Vue scoped CSS reliably). 5 tests: Skip border references `var(--brand-primary)`, Stop border references `var(--color-danger)`, neither contains a fractional-alpha rgba (the washed-out shape), both have `linear-gradient` backgrounds with brand RGB tints, label colours still resolve to brand tokens.

**Files**: `src/components/common/RecurrenceDeleteModal.vue`, `tests/unit/recurrence-delete-modal-styles.test.ts`.

---

### ~~BUG-1780~~: Canvas group positions reset to canonical on every launch (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-22, v1.3.72)

**Problem**: User drags or resizes a day-group to a new position/size; closes Electron; relaunches; group jumps back to pre-rearrange position. The resize + drag persistence pipeline writes `groups.position_json = {x, y, width, height}` correctly (verified). The regression is on the LOAD side — `src/views/CanvasView.vue:520` runs `runDayGroupCatchup()` as soon as Vue Flow is ready on every launch, which calls `applyCanonicalLayoutMoves(groupMoves)` and overwrites user-arranged positions with canonical values.

**Fix**: Subtractive edit at `CanvasView.vue:514-524` — `runDayGroupCatchup` now skips `applyCanonicalLayoutMoves` and only applies `taskMoves` (dueDate-driven task re-homing on midnight is preserved). `applyCanonicalTaskMoves` has a three-tier fallback for parent-position lookup (groupMoves map → Vue Flow node → canvas store), so passing `[]` makes it use the current user-customized group positions. Explicit canonical layout is still available on demand via the Tidy button (`handleTidyLayout`, unchanged).

**Risk**: BUG-1776 adjacency. Subtractive change; rollback is a one-line revert.

**Files**: `src/views/CanvasView.vue`.

---

### ~~BUG-1779~~: DB-level defense against blank task titles (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-22)

**Problem**: `public.tasks.title` is only `text not null` — empty string accepted. Client-side `toSupabaseTask` sanitizes but any bypass (RPC, direct SQL, future code that forgets the mapper) can write blanks. Defense-in-depth gap exposed by BUG-1777 post-mortem.

**Fix**: New migration `supabase/migrations/20260422T000000_task_title_normalize_trigger.sql` creating `trg_normalize_task_title()` function + `BEFORE INSERT OR UPDATE OF title` trigger on `public.tasks`. Normalizes NULL/empty/whitespace-only titles to `'Untitled Task'` and trims non-blank titles. Applied to VPS production; `pg_trigger` confirms registration.

**Files**: `supabase/migrations/20260422T000000_task_title_normalize_trigger.sql`.

---

### ~~BUG-1778~~: Content fields wiped for 7 tasks (description, priority, due_date, etc.) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-22)

**Problem**: The 2026-04-21 22:54 corruption wiped more than titles. Diff against pg_dump backup `flowstate_20260421_223002.sql.gz` showed lost fields across the 7 previously-blank tasks: `description` (1), `priority` (5), `due_date` (all 7), `estimated_duration` (2), `project_id` (2), `is_pinned` (2), `is_in_inbox` flipped (4 — via BUG-1777 repair side effect). `subtasks`, `tags`, `recurrence_rule`, `depends_on`, `reminders` unchanged in both snapshots — no loss there.

**Fix**: Same non-destructive pattern as BUG-1777 — backup restored into temp DB `bug1777_restore` on VPS, 7 rows extracted as JSONB, loaded into prod via temp table + `UPDATE FROM`. COALESCE for nullable scalars (only restore when current is NULL/empty); direct overwrite for booleans. Single transaction with `RETURNING` verification. All 7 rows updated; pixielabs got its long Hebrew project note back + pinned + 180min + project_id. Temp DB dropped, backup file removed.

**Files**: `scripts/recover-blank-task-titles.sql`, `scripts/recover-titles-from-backup.sh` (reused from BUG-1777).

---

### ~~BUG-1777~~: Blank task titles bypass sync guard, cause "Untitled Task" artifacts (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-22, v1.3.71)

**Problem**: 7 tasks in VPS production Supabase have `title = ""` / NULL. They reach the Electron app because `fromSupabaseTask` at `src/utils/supabaseMappers.ts:584` passes `record.title` through unchanged, and `updateTaskFromSync` at `src/stores/tasks.ts:217` only rejected `title === undefined` — empty strings slipped through. The load-time `repairTaskTitles` relabels them "Untitled Task" and is supposed to move them to Inbox, but the user's screenshot on v1.3.70 still shows them on the Canvas "Today" column.

**Root cause (verified)**: `taskValidation.ts:108` treats blank title as a *warning*, so `sanitizeLoadedTasks` passes blanks through. `updateTaskFromSync` guard missed empty strings. Source of the 7 blank rows predates 1.3.69's preventive sanitization.

**Fix**:
1. `src/stores/tasks.ts:217` — replace `title === undefined` guard with `sanitizeTaskTitle()` call. Empty/whitespace/non-string titles become "Untitled Task" at the sync-ingress chokepoint.
2. Deliberately NOT touching `fromSupabaseTask` — the existing `repairTaskTitles` on load depends on seeing blank titles to trigger its inbox-move side effect.
3. VPS recovery: pull original titles from `public.task_audit_log` (indexed by `task_id, event_at DESC`), `UPDATE tasks SET title = … WHERE id = … AND (title IS NULL OR title = '')`. Realtime propagates the restored titles to all clients.
4. Version bump 1.3.70 → 1.3.71 + `./scripts/deploy-electron-update.sh` (CLAUDE.md rules 6 & 7).

**Tests added**:
- `src/utils/__tests__/taskValidation.test.ts` — 10 cases covering `sanitizeTaskTitle` for ''/null/undefined/whitespace/non-string and `repairTaskTitles` counts + side effects (canvasPosition/parentId cleared, isInInbox=true).
- `src/stores/__tests__/tasks.test.ts` — 4 cases on `updateTaskFromSync`: sanitizes '', sanitizes whitespace, still drops missing-id updates, passes valid titles through.

All 43 store tests + 10 validation tests pass. (Pre-existing circular dep `taskValidation.ts ↔ taskOperations.ts` from 1.3.69/1.3.70 is NOT introduced by this fix.)

**Files**: `src/stores/tasks.ts`, `src/utils/__tests__/taskValidation.test.ts`, `src/stores/__tests__/tasks.test.ts`, `package.json`.

**Plan**: `~/.claude/plans/getting-untitled-tasks-in-eventual-seahorse.md`.

---

### ~~BUG-1776~~: Canvas day-group Tidy/Rotate still produces overlap + orphans (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-04, v1.4.16)

**Problem**: The Canvas "Tidy day-group layout" button (and the "Rotate day groups" auto/manual path) still produces visually broken state in production despite 10 shipped versions of fixes. Symptoms across v1.3.55 → v1.3.64:
  - Day-groups render at inconsistent widths despite `updateNode({ width, height, style })` in v1.3.64.
  - Adjacent day-groups overlap horizontally (Monday visually collides with Wednesday).
  - Tasks tear out of their parent group and float below it (BUG-1203 `isNodeCompletelyInside` zero-padding detach path).
  - Orphan-recovery pass added in v1.3.64 doesn't visibly rehome previously-detached tasks.
  - Clicking Tidy repeatedly doesn't converge — layout stays wrong.

**What's already shipped (NOT enough)**:
  - v1.3.57: removed xSpread gate + wired catchup on `isVueFlowReady`.
  - v1.3.59: removed `<Teleport to="body">` wrapper from CanvasToolbar (previous "button does nothing" fix).
  - v1.3.60–61: fixed right-click reschedule (`skipDueDateInheritance`, strict exact-date matching).
  - v1.3.62: canonical layout primitive, Tidy button, uniform widths/heights.
  - v1.3.63: bumped `DAY_GROUP_HEIGHT` 920 → 1000 (fixed off-by-40 that overflowed 8th task past parent).
  - v1.3.64: added `width`/`height` top-level fields to `updateNode` (not just style), double `nextTick` before sync release, orphan-rehome pre-pass.

**Perplexity research (external, 2026-04-20)** confirmed Vue Flow 1.48+ internals:
  - `updateNode({ style: { width: '350px' } })` is fragile — must use top-level `width`/`height` fields too. ✅ Applied in v1.3.64.
  - Single `nextTick` lags Vue Flow's dimension bookkeeping. Double `nextTick` or `setTimeout(r, 0)` required. ✅ Applied in v1.3.64.
  - **Unverified suspicion**: when a node has `parentNode` set, its `position` must be RELATIVE to parent. My rotation/tidy writes absolute to store; `useCanvasSync.ts:89` claims to translate abs→rel for parented nodes during sync — but never verified live under the tidy batch conditions. Could still be the root cause.

**Resolution (v1.4.11-v1.4.16)**:
- `useCanvasInteractions.ts` now persists group drags together with descendant task/group absolute positions.
- `useNodeSync.ts` persists nested Vue Flow nodes from relative positions instead of stale `computedPosition`.
- `useCanonicalDayGroupLayout.ts` centralizes group width/height/spacing and task placement.
- `useDayGroupRotation.ts` anchors explicit toolbar rotation to the live weekday clock so weekday-only groups start at today.
- `useTidyLayout.ts` uses today's semantic order for day groups, keeps Tidy compact at `400px`, and stacks tasks vertically with visible spacing instead of widening groups into a horizontal layout.
- `CanvasView.vue` forces Vue Flow node refresh after explicit canonical layout writes to clear stale internal `computedPosition` state.

**Regression coverage**:
- `tests/e2e/canvas-geometry-local.spec.ts` covers real toolbar clicks for compact Tidy, today-first Tidy order, Today/Tomorrow rotation, weekday-only rotation, visible DOM order, group widths, and task spacing.
- `tests/e2e/playwright.canvas-local.config.ts` runs those canvas checks without the Supabase auth global setup.
- `tests/unit/canvas/tidy-layout.test.ts` covers today's semantic order and vertical task stack positions.
- `tests/unit/canvas/day-group-position-rotation.test.ts` covers rotation order, Today/Tomorrow offset, child task positions, and sync suppression release.
- `tests/unit/canvas/canonical-layout.test.ts` covers canonical spacing/size math.

**Verification**:
- `npx playwright test --config tests/e2e/playwright.canvas-local.config.ts` passed 4/4.
- `npx vitest run --maxWorkers=4 tests/unit/canvas/tidy-layout.test.ts tests/unit/canvas/canonical-layout.test.ts tests/unit/canvas/day-group-position-rotation.test.ts` passed 32/32.
- `npm run electron:build` passed.
- Electron updater deployed and manifest verified at `1.4.16`.

**User confirmation**: User reported the Tidy button looks like it is working after v1.4.16.

**Files to revisit** (DON'T blindly re-edit):
  - `src/composables/canvas/useCanonicalDayGroupLayout.ts` — pure layout math (verified correct in 10 unit tests).
  - `src/composables/canvas/useDayGroupRotation.ts` — rotation entry + sort order.
  - `src/composables/canvas/useTidyLayout.ts` — tidy entry + orphan rehome.
  - `src/views/CanvasView.vue::applyCanonicalLayoutMoves` — the updateNode bridge.
  - `src/composables/canvas/useCanvasSync.ts:89` — claims to translate abs→rel for parented nodes. VERIFY THIS ACTUALLY RUNS inside the tidy batch, given `canvasSyncInProgress=true` suppresses sync.

**Risk note**: Do not reintroduce horizontal Tidy task layout for day groups. That was the cause of stretched groups and insufficient vertical spacing.

**Related artifacts**:
  - [SOP-069](./sop/SOP-069-teleport-async-mount-trap.md) — Teleport + async-mount trap (fixed in v1.3.59, still relevant).
  - `src/constants/canvas.ts::DAY_GROUP_*` — canonical layout constants.

---

### ~~TASK-1758~~: Deploy World's Greatest Bot + rename WhatsApp bot to Botty (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-19)

**What was done**:
- Renamed `packages/whatsapp-bot/` → `packages/botty/` (package name, log prefixes, docker-compose service name)
- Deployed Botty to VPS (`/opt/botty/`) — built Docker image, runs on `supabase_default` network, WAHA webhook updated to point to Botty
- Deployed World's Greatest Bot (`/opt/worlds-greatest-bot/`) — Discord bot with voice join notifications, AI posts, activity tracking; registered 17 slash commands; dashboard at `http://84.46.253.137:3049`
- Updated watchpost `bots.json` with both new entries

**Files**: `packages/botty/`, `watchpost/vps/bots.json`

---

### ~~BUG-1773~~: Canvas auto-placement overlaps tasks in day-groups + not left-aligned (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-18)

**Problem**: When tasks are automatically routed into day-of-week groups (on canvas mount via `autoPlaceEligibleTasks`, multi-select "Move to Tomorrow", or "Send to Canvas" from inbox), siblings land at the same starting position or overlap each other, and the first task is indented 20px from the group's left padding instead of being true-left-aligned.

**Goal**: Left-align tasks at the group's padding edge, always stack subsequent tasks vertically with a consistent gap, even across batch placements where reactivity may lag.

**Fix**:
1. `useSmartGroupMatcher.ts::calculatePositionInGroup` — dropped the `+20` empty-group nudge; replaced center-fallback (overlap source) with continued below-stack; added optional `alreadyPlacedPositions` param so batch callers stay immune to reactivity timing
2. `useCanvasAutoPlacement.ts::autoPlaceEligibleTasks` — maintains a local `Map<groupId, positions[]>` across the loop and passes into the helper
3. `useCanvasTaskActions.ts` Move-to-Tomorrow multi-select — same local tracker pattern

**Tests added**: `tests/unit/canvas/smart-group-matcher.test.ts` (5 tests, all green): first-task left-align, stacking gap, batch `alreadyPlacedPositions`, overflow-below-not-center, other-group isolation.

**Files**: `src/composables/canvas/useSmartGroupMatcher.ts`, `src/composables/canvas/useCanvasAutoPlacement.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, `tests/unit/canvas/smart-group-matcher.test.ts`

---

### ~~FEATURE-1774~~: Allow hiding items from Quick Tasks Frequent list (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-18)

**Problem**: The Quick Tasks dropdown's "Frequent" section (derived from tasks with completedPomodoros > 0) had no way to dismiss a specific task. Users who stopped caring about a historically-frequent task had no affordance to hide it.

**Goal**: Add a per-user "hide from Frequent" action that persists locally and filters the list immediately.

**Fix**:
1. `useQuickTasks.ts` — module-scoped `dismissedFrequentIds` Set hydrated from `localStorage['flowstate:dismissed-frequent']`, `dismissFromFrequent(id)` action, `restoreFrequentDismissals()` escape hatch, filter applied in `frequentTasks` computed
2. `QuickTaskDropdown.vue` — X button in the Frequent `v-for` row (before the Pin button), wired via `handleHideFrequent`

**Tests added**: `tests/unit/composables/useQuickTasks-dismiss.test.ts` (3 tests, all green): persists to localStorage, excludes dismissed from `frequentTasks`, restore clears.

**Storage**: localStorage-only (intentionally not cross-device synced — display preference, not task data).

**Files**: `src/composables/useQuickTasks.ts`, `src/components/timer/QuickTaskDropdown.vue`, `tests/unit/composables/useQuickTasks-dismiss.test.ts`

---

### ~~BUG-1775~~: Quick Sort chips mirror sidebar; deletes roll back on remote failure (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-18)

**Problem**: Quick Sort EDIT popover's project chips show projects the user cannot see in the sidebar tree (e.g., `flow-state`, `משחק Blood And Rust` appeared as chips while absent from sidebar). Two defects combine:

1. **CategorySelector flattens what the sidebar hides.** `src/components/layout/CategorySelector.vue:90-133` walks the whole project tree up to depth 10 and slices to `maxShortcuts=9` — zero coupling to `useSidebarManagement.expandedProjects`. Children of collapsed sidebar parents still appear as chips.
2. **Silent remote-delete failures.** `src/stores/projects.ts:271-352` (`deleteProject`) and `:357-429` (`deleteProjects`) splice `_rawProjects` optimistically, then `await deleteProjectRemote(...)`, but catch only logs — no rollback, no toast. A failed remote call leaves UI "deleted" while the server keeps the row. Next fetch/realtime resurrects it.
3. **Inline `!p.parentId` root filters duplicated** across 5 callsites instead of consuming the existing `projectStore.rootProjects`.

Confirmed live on VPS production Supabase — both reported rows have `is_deleted=false`, non-null `parent_id`, identical `updated_at=2026-04-18 08:32:24+00`.

**Goal**: (a) Quick Sort chips reflect exactly what the sidebar tree shows. (b) A failed remote delete restores local state + surfaces an error. (c) One canonical root-projects getter across sidebar, Quick Sort, Kanban, AllTasks, useSidebarManagement.

**Plan**: See `~/.claude/plans/iridescent-stargazing-cat.md`.

**Files**: `src/stores/projects.ts`, `src/stores/tasks.ts`, `src/types/tasks.ts`, `src/components/layout/CategorySelector.vue`, `src/components/sidebar/SidebarProjectsSection.vue`, `src/views/AllTasksView.vue`, `src/components/kanban/KanbanSwimlane.vue`, `src/composables/app/useSidebarManagement.ts`.

---

### ~~TASK-1772~~: Unify Pinned lists — drop pinned_tasks table, use task.isPinned everywhere (✅ DONE)

**Priority**: P2 | **Status**: ✅ **DONE** (2026-04-18)

**Problem**: Calendar view shows two "Pinned" sections with different contents — top-right lightning-icon dropdown (4 shortcut rows from `pinned_tasks` table) vs left Inbox sidebar (1 real task with `isPinned=true`). Two independent systems share one label; user didn't know there were two.

**Goal**: One unified pinned list backed by `task.isPinned`. Every pinned item is a real task editable/removable from any surface.

**Approach**:
1. Rewrite `useQuickTasks.ts` pinned source to computed over `taskStore.tasks.filter(t => t.isPinned)`
2. Rewire pin/unpin/pinFromTask to `taskStore.createTask/updateTask`
3. Rewire KDE widget `main.qml` 3 REST endpoints from `/pinned_tasks` to `/tasks?is_pinned=eq.true`
4. One-time client migration: convert 4 existing `pinned_tasks` rows into real tasks with `isPinned=true`
5. Delete `usePinnedTasksDatabase.ts`, `PinnedTask` type, `pinned_tasks` dbTables entry
6. Supabase migration: `DROP TABLE pinned_tasks CASCADE`
7. Bump version, deploy web + Electron, update KDE widget

**Files**: `src/composables/useQuickTasks.ts`, `src/components/timer/QuickTaskDropdown.vue`, `src/types/quickTasks.ts`, `src/composables/supabase/usePinnedTasksDatabase.ts` (DELETE), `src/constants/dbTables.ts`, `packages/kde-widget/contents/ui/main.qml`, `supabase/migrations/<ts>_drop_pinned_tasks.sql`

---

### BUG-1771: Canvas "Add Task to Group" overlaps existing tasks at group center (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: Right-clicking inside a day-group and choosing "Add Task to Group" creates the new task at the geometric center of the group, overlapping existing siblings. Users perceive this as sibling tasks "moving" when in fact only the new node renders on top. The creation path also lacks any diagnostic log for the chosen position.

**Goal**: Use the existing collision-aware `calculatePositionInGroup` helper on the menu path and add two DEV-gated logs that expose the placement decision.

**Approach**:
1. In `createTaskInGroup` else-branch, call `calculatePositionInGroup(group, taskStore._rawTasks)` instead of centering
2. Add `[TASK-CREATE]` log before `finalPosition` compose (group, entry path, sibling count, chosen pos)
3. Add `[TASK-CREATE]` log before `createTaskWithUndo` call (parentId, canvasPosition, isDefaultPosition)
4. Leave `screenPos` branch untouched (drag-to-place path); leave `calculatePositionInGroup` internals untouched

**Files**: `src/composables/canvas/useCanvasTaskActions.ts`

---

### FEATURE-1759: Unified Knowledge + Custom Lists roadmap foundation (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: FlowState is strong as an action system, but it does not yet support a coherent second-brain / data-management workflow or lightweight custom lists like groceries without overloading the task model.

**Goal**: Extend FlowState into a unified action + knowledge system where tasks remain the execution layer, notes become the thinking/reference layer, and custom lists become the lightweight execution layer.

**Approach**:
1. Add a shared content taxonomy and visibility rules first
2. Turn `/catalog` into a real knowledge surface
3. Add note/page workflows optimized for capture and retrieval
4. Add grouped custom lists with lightweight list items
5. Reuse AI and search infrastructure only after the base model is stable

**Files**: `src/types/tasks.ts`, `src/stores/tasks.ts`, `src/views/AllTasksView.vue`, `src/router/index.ts`, `src/services/ai/`, `src/components/common/TiptapEditor.vue`

---

### TASK-1760: Content taxonomy: task, note, list + shared visibility rules (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: The app currently treats most rich content as tasks, but there is no explicit content kind or rules for where notes/lists should appear.

**Goal**: Introduce a minimal content taxonomy so the app can distinguish task, note, and list behavior without splitting into multiple disconnected systems.

**Approach**:
1. Add a content-kind field and shared display rules
2. Define where each kind appears: inbox, board, calendar, catalog, AI context
3. Ensure note/list entities do not pollute scheduling/task-focused views by default
4. Preserve reuse of existing task persistence and offline/sync patterns where possible

**Files**: `src/types/tasks.ts`, `src/stores/tasks/taskOperations.ts`, `src/stores/tasks/taskPersistence.ts`, `src/composables/tasks/useTaskFiltering.ts`, `src/utils/supabaseMappers.ts`

---

### TASK-1761: Catalog -> Knowledge Hub MVP with type filters and capture entry (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: `/catalog` is labeled as a knowledge base in UI copy, but it is still just the flat tasks view.

**Goal**: Make Catalog the home for knowledge browsing and capture across tasks, notes, and lists.

**Approach**:
1. Add content-type filters and segmented views
2. Add quick capture entry points for note and list creation
3. Support browsing by project/container/tag/type
4. Preserve fast categorization and bulk actions

**Files**: `src/views/AllTasksView.vue`, `src/layouts/AppHeader.vue`, `src/components/base/FilterControls.vue`, `src/components/filters/SavedViewsDropdown.vue`

---

### TASK-1762: Note/Page MVP using task-based content, markdown, tags, attachments (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: There is no dedicated second-brain note/page workflow despite existing rich-text, attachments, and task description support.

**Goal**: Ship a first useful note/page system without introducing a fully separate note architecture.

**Approach**:
1. Reuse the task-based model for note/page entities
2. Use existing markdown/Tiptap editor and attachment support
3. Support tags and project/container placement
4. Optimize note UX for quick capture and later retrieval
5. Defer full graph/backlink semantics to later tasks

**Files**: `src/types/tasks.ts`, `src/components/common/TiptapEditor.vue`, `src/components/tasks/TaskEditModal.vue`, `src/components/tasks/TaskAttachments.vue`

---

### TASK-1763: Custom Lists MVP: lightweight items, groups, reorder, check off (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: Lists like groceries, packing, shopping, and household supplies are too lightweight and repetitive to model as full tasks by default.

**Goal**: Add list containers with lightweight list items and grouped sections that feel native and fast.

**Approach**:
1. Add list entities and lightweight list items
2. Support grouped sections like Produce, Pantry, Household
3. Support fast add, check/uncheck, drag reorder, regroup, clear completed
4. Keep promotion to full task as an explicit action, not the default

**Files**: `src/types/tasks.ts`, `src/stores/tasks.ts`, `src/views/AllTasksView.vue`, `src/components/tasks/`, `src/components/common/`

---

### TASK-1764: Recurring list templates and reset/reuse workflow (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: Reusable lists such as weekly groceries or packing checklists need a reset/template workflow, not task recurrence semantics.

**Goal**: Allow a list to be reused or regenerated on demand and optionally on a recurring schedule.

**Approach**:
1. Add list template/reset behavior
2. Support duplicate-from-template and clear-completed reset
3. Add optional recurrence for list regeneration
4. Keep this separate from task clone-on-complete recurrence rules

**Files**: `src/types/tasks.ts`, `src/stores/tasks/taskOperations.ts`, `src/stores/tasks/taskPersistence.ts`, `src/types/recurrence.ts`

---

### TASK-1765: Unified search across tasks, notes, and lists (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: A second brain is only useful if capture and retrieval are excellent; current search is task-centric.

**Goal**: Make search a cross-content retrieval surface for tasks, notes, lists, and list items where appropriate.

**Approach**:
1. Extend search indexing/filtering across content kinds
2. Search title, body, tags, project/container, and list/group names
3. Add content-type and scope filters
4. Defer semantic/vector search until structured search proves insufficient

**Files**: `src/components/layout/SearchModal.vue`, `src/composables/tasks/useTaskFiltering.ts`, `src/services/ai/tools.ts`, `src/stores/tasks.ts`

---

### TASK-1766: Promote note or list item into full task flow (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: Some notes and list items become actionable, but there is no explicit conversion flow.

**Goal**: Let users promote lightweight knowledge/list content into full tasks with minimal friction.

**Approach**:
1. Add "Convert to task" or "Promote to task" actions
2. Preserve source context and backlinks/reference where useful
3. Optionally prefill project, due date, tags, and metadata
4. Keep the original source item intact unless user chooses move/replace semantics

**Files**: `src/stores/tasks/taskOperations.ts`, `src/components/tasks/TaskContextMenu.vue`, `src/components/tasks/TaskEditModal.vue`

---

### TASK-1767: AI can read notes/lists and turn them into useful actions (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: AI memory/context currently leans on task/work-profile data, not on a richer personal knowledge layer.

**Goal**: Let AI search notes/lists, summarize them, and convert them into useful actions or plans.

**Approach**:
1. Expose notes/lists to AI retrieval tools and user context building
2. Add flows like summarize note, extract actions, build grocery list, regroup list items
3. Feed note/list interactions into existing work-profile and memory graph systems
4. Defer embeddings/RAG until normal structured retrieval is in place

**Files**: `src/services/ai/tools.ts`, `src/services/ai/userContext.ts`, `src/composables/useWorkProfile.ts`, `src/stores/aiChat.ts`

---

### ~~TASK-1768~~: Persist mini-canvas planning notes for knowledge workflows (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-02)

**Problem**: `planningNotes` already existed and were a strong fit for second-brain thinking, but persistence was deferred — three commented placeholders in `src/utils/supabaseMappers.ts` skipped the field, so notes vanished on reload.

**Resolution**: Stored as `planning_notes JSONB DEFAULT '[]'` on the `tasks` table (mirrors the existing `subtasks` jsonb pattern — same offline queue, same realtime sync, same RLS).

1. ✅ New migration `20260502000000_add_planning_notes_to_tasks.sql` (idempotent — column already existed locally; migration locks it in git for production parity).
2. ✅ Uncommented three lines in `src/utils/supabaseMappers.ts` (row-type field, `toSupabaseTask` write, `fromSupabaseTask` read) and added `PlanningNote` to imports.
3. ✅ Round-trip verified by new unit test in `tests/unit/data-integrity-crud.test.ts` ("planningNotes JSONB array preserves structure after round-trip"). Contract test allowlist updated in `tests/contract/api-contract.test.ts`.
4. ⏳ Production migration application — needs explicit user approval before SSH'ing to VPS.

**Files**: `src/utils/supabaseMappers.ts`, `supabase/migrations/20260502000000_add_planning_notes_to_tasks.sql`, `tests/unit/data-integrity-crud.test.ts`, `tests/contract/api-contract.test.ts`. No client-code changes needed — `useMiniCanvasActions.ts` already wrote `task.planningNotes` through `taskStore.updateTask`.

**Out of scope** (separate tasks): TASK-1767 (AI context from notes), TASK-1769 (backlinks), separate `planning_notes` table for cross-task sharing.

---

### TASK-1769: Lightweight links/backlinks between notes and tasks (📋 PLANNED)

**Priority**: P3 | **Status**: 📋 PLANNED

**Problem**: Capture and search are the first priority, but over time note-to-note and note-to-task relationships will matter.

**Goal**: Add simple explicit links/backlinks without committing to a heavy graph feature too early.

**Approach**:
1. Support explicit references between tasks, notes, and lists
2. Show related items in detail views
3. Track backlinks automatically where practical
4. Defer graph visualization and advanced knowledge navigation

**Files**: `src/types/tasks.ts`, `src/components/tasks/TaskEditModal.vue`, `src/views/AllTasksView.vue`, `src/services/ai/`

---

### ~~BUG-1758~~: Inbox Canvas Order sort ignored X for same-Y rows (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-12)

- Calendar, Board (Unified) and Mobile inboxes sorted canvas-order tasks by `canvasPosition.y` only
- Grid rows (multiple tasks sharing a Y) came out in arbitrary array order instead of matching canvas reading order
- Added an X tiebreaker driven by `useDirection().isRTL` (LTR: left→right, RTL: right→left)
- Made group-level X sort direction-aware in the same pass (preserves existing RTL behavior, fixes LTR)
- Confirmed root cause against the user's real DB: rows at y=210/440/670/900/1130 with 4 tasks each at distinct X

**Files**: `src/composables/inbox/useCalendarInboxState.ts`, `src/composables/inbox/useUnifiedInboxState.ts`, `src/mobile/composables/useMobileInboxLogic.ts`, `src/composables/inbox/__tests__/useUnifiedInboxState.spec.ts`

---

### ~~BUG-1794~~: Rotate day groups sends same-day Saturday tasks to next Saturday (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-29)

**Problem**: Pressing **Rotate day groups** with Today/Tomorrow smart groups present could resolve the current weekday group to next week. A Saturday group on Saturday wrote task `dueDate` to next Saturday instead of today.

**Fix**: `getDayGroupDate()` now treats weekday groups as the literal next occurrence including today, regardless of Today/Tomorrow groups. Today/Tomorrow still win automatic placement through matcher specificity instead of forcing weekday groups a week forward.

**Verified**: `npm run test -- tests/unit/canvas/day-group-date-suffix.test.ts tests/unit/canvas/day-group-catchup.test.ts tests/unit/canvas/smart-group-matcher.test.ts tests/unit/canvas/day-group-position-rotation.test.ts` (41/41), `npm run type-check`, `npx eslint src/utils/dayGroupDate.ts`, `npm run electron:build` for v1.4.79, `./scripts/deploy-electron-update.sh --notes "Fix rotate day groups keeping same-day Saturday tasks on today"`, public updater manifest check. Full `npm run lint` still reports repo-wide pre-existing lint debt; touched source file is clean.

**Release status**: v1.4.79 deployed to the Electron updater. `https://in-theflow.com/updates/electron/latest-linux.yml` returns `version: 1.4.79`.

**Files**: `src/utils/dayGroupDate.ts`, `tests/unit/canvas/day-group-date-suffix.test.ts`, `tests/unit/canvas/day-group-catchup.test.ts`, `tests/unit/canvas/smart-group-matcher.test.ts`.

---

### ~~TASK-1756~~: Canvas day group date rotation + dynamic Today/Tomorrow dates (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-19)

**Final fix (2026-04-19, shipped as v1.3.59)**: The real blocker turned out to be a `<Teleport to="body">` wrapper in `CanvasToolbar.vue` — it left the toolbar's click handler bound to a component instance whose parent link got severed by an async-mount race, so `$emit('rotateDayGroups')` was a silent no-op. Removed the Teleport entirely (CanvasView already renders CanvasToolbar as a sibling to VueFlow, so `position: fixed` works without Teleport). See [SOP-069](./sop/SOP-069-teleport-async-mount-trap.md) for the full write-up. Companion improvements shipped in the same release: persisted `lastRotationDate` guard via `useStorage`, `useCurrentDay` now listens to `pageshow`/`focus`/`online`, catchup wiring keyed on `isVueFlowReady`. 88 unit tests green.

**Reopen reason (2026-04-17)**: User reports day-of-week groups still don't update to the correct dates. Today is Friday 17.4.26 — reproducing in dev to capture exact failure mode before patching.

**Fix applied 2026-04-17** (commit pending):

1. **Shared date helper** — new `src/utils/dayGroupDate.ts::getDayGroupDate()` used by both the group header (`GroupNodeSimple.vue`) and rotation (`useDayGroupRotation.ts`). Removes the formula drift that caused header suffix and rotation dueDate to disagree.
2. **`|| 7` bug** — the old `((…) % 7) || 7` fall-through in `GroupNodeSimple.vue` turned today=target into +7 days. Fixed. The Friday group on a Friday now shows today (17.4.26) instead of next Friday when no Today/Tomorrow smart group exists. Live-verified in dev server: Friday=17.4.26, Monday=20.4.26.
3. **Midnight reactivity** — new singleton composable `src/composables/useCurrentDay.ts` exposes a reactive "today" ref that flips at 00:00 and on tab-visibility regain. `dayOfWeekDateSuffix` + `currentTargetTimestamp` in `GroupNodeSimple.vue` now depend on this ref, so the header label re-renders at midnight without a reload.
4. **onMoves / Vue Flow bridge** — confirmed `applyDayGroupMoves` in `CanvasView.vue:362` calls `updateNode` with `section-`-prefixed IDs, wiring the rotation to the Vue Flow node layout. Added `tests/unit/canvas/day-group-onmoves.test.ts` (5 tests) pinning: return payload uses `section-<id>`, midnight callback fires with correct payload, feature-flag off suppresses callback, no-op when already sorted, `getNodePosition` overrides stale store positions.

**Test coverage** (all green as of 2026-04-17):
- `tests/unit/canvas/day-group-date-suffix.test.ts` (7 tests)
- `tests/unit/composables/useCurrentDay.test.ts` (3 tests)
- `tests/unit/canvas/day-group-onmoves.test.ts` (5 tests)
- `tests/unit/canvas/day-group-position-rotation.test.ts` (11 tests, pre-existing)
- Total: 77 canvas + composables tests green, no new TS errors.

**Live verification** (dev server, Friday 2026-04-17 14:18):
- "Friday" group header reads `17.4.26` (today). "Monday" reads `20.4.26` (+3 days).
- "Rotate day groups" toolbar button fires `[DAY-ROTATION]` logs with correct sort order (Friday first as today).
- "2 day groups updated for today" banner shown after rotation.

**Symptoms to verify in-app** (Friday 2026-04-17):
- Day-of-week group for today's weekday shows next week's date (e.g. Friday group shows 24.4 instead of 17.4) when no Today/Tomorrow smart group exists — **should be fixed** by formula change.
- Visual position rotation still pending from prior pass (Vue Flow controlled-mode blocker).
- Possible regression interacting with BUG-1757 fix (dueDate edit leaving task in old group).

**Previous scope (2026-04-11, now partial; corrected by BUG-1794 on 2026-05-29)**:
- Today/Tomorrow smart groups show dynamic date suffixes (e.g., "Today / 11.4.26")
- Day-of-week groups no longer skip dates covered by Today/Tomorrow; placement priority handles overlaps.
- Rotation button (CalendarClock icon) in canvas toolbar
- Midnight auto-rotation updates task dueDates, respects weekStartsOn
- Visual position rotation pending — algorithm works but Vue Flow controlled-mode prevents visual updates

**Files**: `src/composables/canvas/useDayGroupRotation.ts`, `src/components/canvas/GroupNodeSimple.vue`, `src/components/canvas/CanvasToolbar.vue`, `src/views/CanvasView.vue`, `src/stores/settings.ts`

---

### ~~TASK-1753~~: Constitution reminder PreToolUse hook (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-05)

**Problem**: Constitution and project docs are referenced in CLAUDE.md but no enforcement exists — agents could skip reading them.

**Changes**: Added `.claude/hooks/constitution-reminder.sh` PreToolUse hook. Fires once per session on first source file edit, reminds agent to check Constitution + project docs. Never blocks. Skips docs, tests, configs.

**Files**: `.claude/hooks/constitution-reminder.sh`, `.claude/settings.json`

---

### ~~TASK-1751~~: Documentation deep audit + Constitution extraction (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-05)

**Problem**: Core documentation (system-architecture.md, design-system.md, SOPs, CLAUDE.md) had significant staleness — wrong values, missing features, dead Tauri references — causing AI agents to make incorrect decisions.

**Changes**:
- Fixed CLAUDE.md: all Tauri→Electron refs (13 locations), table count 19→32
- Fixed design-system.md: 5 wrong glass-bg opacity values, 12 missing BaseModal props, 7 new token subsystems
- Fixed system-architecture.md: version, counts, 5 missing directories
- Archived 6 dead Tauri SOPs, fixed SOP-065 ID collision, corrected README
- Created `~/.claude/knowledge/constitution.md` (167 lines) — reusable dev standards
- Slimmed CLAUDE.md from 476→405 lines by extracting universal rules to Constitution

**Files**: `CLAUDE.md`, `docs/claude-md-extension/design-system.md`, `docs/claude-md-extension/system-architecture.md`, `docs/sop/` (20+ files), `~/.claude/knowledge/constitution.md`

---

### ~~TASK-1744~~: Redesign Inbox Filter/Sort into Compact Toolbar (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-03)

**Summary**: Replaced the multi-row sort buttons + filter chips (consuming ~40% viewport) with a single 32px compact toolbar. Sort dropdown collapses 5 buttons into 1, filter popover organizes all options in sections, active filter pills show only enabled filters as removable pills. ~60% vertical space reduction.

**Files**:
- `src/components/inbox/unified/InboxSortDropdown.vue` (new)
- `src/components/inbox/unified/InboxFilterPopover.vue` (new)
- `src/components/inbox/unified/ActiveFilterPills.vue` (new)
- `src/components/inbox/unified/InboxToolbar.vue` (new)
- `src/components/inbox/unified/UnifiedInboxHeader.vue` (modified)
- `src/components/inbox/UnifiedInboxPanel.vue` (modified)

---

### ~~TASK-1741~~: Regression Test Gap Analysis + Fix Pre-Existing Failures (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01)

**Summary**: Architect-driven gap analysis identified the top 5 untested critical systems. Wrote 71 regression tests across 5 new files covering: supabase mappers (28 tests, guards BUG-1211/1286/1562), smart merge algorithm (12 tests, guards BUG-1738), timer race guard (5 tests, guards BUG-TIMER-RACE), recurrence scheduler (12 tests), and cross-tab sync (10 tests). Also fixed all 14 pre-existing test failures caused by stale Tauri assertions after TASK-1718 Electron migration, version drift, and missing allow-list entries.

**Files**:
- `tests/unit/utils/supabaseMappers.test.ts` (new, 28 tests)
- `tests/unit/stores/smart-merge.test.ts` (new, 12 tests)
- `tests/unit/stores/timer-race-guard.test.ts` (new, 5 tests)
- `tests/unit/composables/recurrence-scheduler.test.ts` (new, 12 tests)
- `tests/unit/sync/cross-tab-sync.test.ts` (new, 10 tests)
- 8 existing test/config files updated to fix 14 failures

**Result**: 95 files, 1959 tests, all passing (0 failures).

---

### ~~BUG-1741~~: Switching Shared→Personal Workspace Doesn't Load Tasks (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-02)

**Root cause**: Race condition in `switchWorkspace()` — presence disconnect hung on a dead channel. The watch in `useAppInitialization.ts` called `removeAllChannels()` when `activeWorkspaceId` changed, killing the presence channel before `switchWorkspace` could cleanly disconnect it. Also added re-entry guard to prevent concurrent switch calls.

**Fix**: (1) Disconnect presence BEFORE changing `activeWorkspaceId`, (2) add `isSwitchingWorkspace` re-entry guard.

**Files**: `src/stores/workspace.ts`

---

### BUG-1743: PWA blank screen when fully offline (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS

**Problem**: PWA shows blank screen when opened offline with expired JWT. Auth `refreshSession()` blocks the entire init chain — no timeout, no fallback to cached data.

**Root causes**:
1. `useAppInitialization.ts:57` — Cache load (Phase A) gated behind `await authStore.initialize()` which makes network calls
2. `auth.ts:210` — `refreshSession()` has no timeout; hangs indefinitely on flaky networks
3. `auth.ts:263-269` — Failed refresh wipes session (`user.value = null`), preventing cached data load even when IndexedDB has data

**Fixes**:
1. Add 5s AbortController timeout to `refreshSession()` in auth.ts
2. Reorder init: load IndexedDB cache BEFORE auth (cache doesn't need auth)
3. Keep expired session when refresh fails and IndexedDB has cached data (extend grace period)

**Files**: `src/stores/auth.ts`, `src/composables/app/useAppInitialization.ts`

---

### ~~BUG-1742~~: Calendar: can't schedule tasks between hours (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-02)

**Problem**: Three calendar issues prevented scheduling tasks at half-hour boundaries (e.g. 3:30-4:30 PM). Also fixed a crash in AllTasksView and useMobileInboxLogic when sorting by title on tasks with undefined title.

**Root causes**:
1. QuickTaskCreate end time input was cosmetic — ignored by duration dropdown, no bidirectional binding
2. Week view drag-to-create hardcoded `minute: 0` for calculated end time
3. Week view double-click to create hardcoded `minute: 0` for calculated end time
4. Sort by title crashed on undefined title in AllTasksView and useMobileInboxLogic

**Fixes**:
- QuickTaskCreate end time input now wired bidirectionally with duration dropdown
- Week view drag-to-create and double-click now respect half-hour precision
- Sort comparators now handle undefined title gracefully

**Files**: `src/components/calendar/CalendarDayView.vue`, `src/components/calendar/CalendarWeekView.vue`, `src/views/AllTasksView.vue`, `src/composables/mobile/useMobileInboxLogic.ts`

---

### ~~BUG-1740~~: Leave/Delete Workspace Does Nothing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Fix**: Added `leaveWorkspace()` store action + "Delete Workspace" button for owners. Both remove workspace locally and switch to personal.

**Files**: `src/stores/workspace.ts`, `src/components/settings/tabs/WorkspaceSettingsTab.vue`, i18n locales

---

### ~~BUG-1739~~: Canvas Bulk Delete Stops Working After First Delete (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE

**Problem**: When deleting multiple tasks from canvas sequentially (not Shift+Delete), after a few deletions the delete stops working. The confirmation modal appears but pressing confirm does nothing.

**Root Cause**: `undoSingleton.ts:783` — `commitOperation` accesses `pendingOperation.description` but `pendingOperation` is `null`. The undo singleton tracks only one pending operation at a time. Rapid sequential deletes from canvas bulk-delete (`useCanvasTaskActions.ts:408 confirmBulkDelete`) each call `deleteTaskWithUndo` which calls `commitOperation`, but the first delete consumes `pendingOperation`, leaving it `null` for subsequent deletes.

**Error**: `TypeError: can't access property "description", pendingOperation is null` at `undoSingleton.ts:783`

**Stacktrace path**: `confirmBulkDelete → deleteTaskWithUndo → commitOperation → pendingOperation.description (null)`

**Fix**: Canvas Delete key now removes tasks from canvas only (moves to inbox) instead of soft-deleting from system. Shift+Delete still performs actual deletion. Ctrl+Z undo works for both. Batch delete uses single undo operation (`beginOperation` once, delete all, `commitOperation` once) to avoid race conditions with drag settling.

**Files**: `src/composables/canvas/useCanvasTaskActions.ts:408`, `src/stores/undoSingleton.ts:783`

---

### ~~BUG-1738~~: Workspace Switch Causes Task Deletion — Data Integrity (✅ DONE)

**Priority**: P0 (Critical) | **Status**: ✅ DONE (2026-04-04)

**Problem**: Switching workspaces triggers a cascade that soft-deletes real tasks from the production database. Affects all users with multiple workspaces.

**Root Cause Chain** (verified from production logs 2026-03-31):
1. User switches workspace (`personal → other-workspace`)
2. Other workspace loads with 0 groups, 2 tasks
3. Canvas sync (BUG-1203 stale parentId cleanup) sees tasks with `parentId` pointing to groups from the **previous** workspace → clears their `parentId` because groups "don't exist" in current workspace
4. When switching back to personal workspace, `SMART-MERGE` sees ~130 tasks modified locally (parentId cleared) that "don't match the DB" → drops them as "stale local-only"
5. Dropped tasks trigger `deleteTask()` → **soft-deletes real tasks from production DB**
6. Result: 26 tasks soft-deleted, user sees "most tasks disappeared"

**Evidence**: Production DB showed 26 tasks soft-deleted between 12:22–22:23 on 2026-03-31. All restored via `UPDATE tasks SET is_deleted = false`.

**Fix Strategy** (multi-layer):

1. **BUG-1203 scope guard** — `useCanvasSync.ts` line 454: Before clearing `parentId`, verify the group truly doesn't exist in the **current workspace's** group set. During workspace transitions (groups=0 transient state), skip the cleanup entirely.
   - File: `src/composables/canvas/useCanvasSync.ts`
   - Guard: `if (canvasStore._rawGroups.length === 0) return` — don't clear parentIds when no groups loaded

2. **SMART-MERGE guard** — Don't drop local-only tasks during workspace switch transitions. Add a `isWorkspaceSwitching` flag that suppresses the "stale local-only" logic.
   - File: `src/stores/tasks/taskPersistence.ts` (or wherever SMART-MERGE runs)
   - Guard: skip dropping during `workspaceStore.isSwitching`

3. **Canvas sync workspace scope** — `syncStoreToCanvas` should only process tasks belonging to the current workspace. Filter tasks by `workspace_id` before sync.
   - File: `src/composables/canvas/useCanvasSync.ts`

4. **Delete safety net** — Before any batch soft-delete triggered by sync/merge, log the count and require threshold confirmation (e.g., refuse to delete >5 tasks in a single sync cycle without explicit user action).
   - File: `src/composables/supabase/useTasksDatabase.ts`

**Testing**:
- [ ] Switch workspaces back and forth 5 times — zero task count changes
- [ ] Switch to empty workspace and back — all tasks preserved
- [ ] Canvas parentIds survive workspace round-trip

**Dependencies**: None (standalone fix)

---

### ~~TASK-1734~~: Task Audit Log — Forensic Task Lifecycle Tracker (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-30)

**Problem**: When tasks disappear, there's no way to definitively answer "what happened to my task about X?". Tombstones only store UUIDs (no title/content), and hard-deleted tasks lose their identity entirely.

**Solution**: Postgres trigger-based immutable audit log (`task_audit_log` table) that automatically captures every task lifecycle event (CREATED, SOFT_DELETED, RESTORED, STATUS_CHANGED, HARD_DELETED) with the task's title and key fields. Uses `pg_trgm` for fuzzy title search. Immutable via Postgres rules (no UPDATE/DELETE). Test user events excluded via email pattern check.

**Files**: `supabase/migrations/20260329120000_task_audit_log.sql`, `src/composables/supabase/useTaskAuditLog.ts`, `src/composables/supabase/index.ts`

---

### BUG-1737: Canvas Delete + Ctrl+Z undo unreliable — task reappears then vanishes (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: After deleting a task on canvas and pressing Ctrl+Z, the task sometimes reappears briefly then vanishes again due to race conditions in the dual-write delete architecture.

**Root cause**: `deleteTask()` both enqueues a sync queue DELETE and directly soft-deletes in Supabase. Undo cancels the queue DELETE but the direct soft-delete's realtime echo re-splices the restored task. Secondary: sync queue DELETE-cancels-CREATE swallows undo's CREATE.

**Files**: `src/composables/undoSingleton.ts`, `src/stores/tasks/taskOperations.ts`, `src/services/offline/writeQueueDB.ts`

---

### ~~BUG-1736~~: Flaky E2E — "create task in Canvas → node appears" fails on WebKit (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-01)

**Problem**: Playwright E2E test `crud-workflows.spec.ts:429` intermittently fails on WebKit. Likely a timing issue with Vue Flow node mounting.

**Files**: `tests/e2e/crud-workflows.spec.ts`

---

### ~~BUG-1735~~: KDE widget calendar block shows pomodoro time instead of scheduled duration (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-30)

**Problem**: KDE system tray widget's "Xm" calendar block countdown displayed pomodoro remaining time instead of the actual calendar event's wall-clock remaining time. A 60-min scheduled block showed "21m" (pomodoro countdown) instead of the true remaining calendar time.

**Root cause**: `updateCurrentBlock()` in `main.qml` had logic that (1) extended the calendar block's end time when pomodoro ran past it, and (2) used `Math.ceil(root.secondsRemaining / 60)` (pomodoro time) instead of `endMinutes - nowMinutes` (calendar time) when a timer was active.

**Fix**: Removed block extension logic and simplified `bestMinutesLeft` to always use `endMinutes - nowMinutes`. The circular pomodoro timer continues showing pomodoro countdown independently.

**Files**: `packages/kde-widget/contents/ui/main.qml`

---

### ~~TASK-1730~~: Fix Electron OAuth Google sign-in flow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: `signInWithGoogle()` in `src/stores/auth.ts` has branches for Tauri and Capacitor but no branch for Electron. It falls through to the PWA path which calls `supabase.auth.signInWithOAuth()` with `redirectTo: window.location.origin` — which in Electron's `file://` context navigates the window to the production website, losing app context and the electronStorage adapter.

**Fix**:
1. Add Electron branch in `signInWithGoogle()` using `skipBrowserRedirect: true` + `openExternal()` to open OAuth URL in system browser
2. Add `will-navigate` interceptor in `electron/main.ts` to catch the OAuth callback and inject the auth code into the renderer
3. Add `electron-auth-code` event listener in auth.ts to exchange the code for a session
4. Create `public/auth/callback/index.html` as the OAuth redirect landing page

**Files**: `src/stores/auth.ts`, `electron/main.ts`, `public/auth/callback/index.html`

---

### ~~BUG-1733~~: Production errors — FK violation, dev CSS preload, undo safeClone SyntaxError (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-28)

**Problems fixed**:
1. `tasks_parent_id_fkey` FK violation — orphaned constraint on production DB blocks task sync
2. `/src/assets/styles.css` 404 in production — hardcoded dev path in preload
3. `permanentlyDeleteTaskWithUndo` SyntaxError — `safeClone()` returns Vue reactive proxies
4. `claim_timer_leadership` RPC 404 — migration not deployed to production

**Fix**: Dropped orphaned FK constraint via migration, removed dead CSS preload from main.ts, added `toRaw()` to undo safeClone. Timer RPC requires manual migration deploy.

**Files**: `src/main.ts`, `src/composables/undoSingleton.ts`, `supabase/migrations/20260327120000_drop_tasks_parent_id_fkey.sql`

---

### ~~BUG-1726~~: `useBeforeUnload()` called outside setup context in useAppInitialization.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-30)

**Problem**: Vue warns that `useBeforeUnload()` is being called outside a component setup context. The call in `useAppInitialization.ts` needs to be moved or restructured so it runs during the component's `setup()` phase.

**Fix**: Removed duplicate `useBeforeUnload()` call from `MainLayout.vue`. The composable was already correctly called in `useAppInitialization.ts` (via `App.vue` setup context). The duplicate in MainLayout could fire outside proper setup timing.

**Files**: `src/layouts/MainLayout.vue`

---

### ~~BUG-1727~~: BaseModal extraneous non-props attributes warning (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-31) — Duplicate of BUG-1724

**Problem**: Vue warns about extraneous non-props attributes being passed to `BaseModal`. The component needs `inheritAttrs: false` added to its options so it can control where attrs are applied (typically the inner wrapper, not the fragment root).

**Resolution**: Already fixed by BUG-1724 (`defineOptions({ inheritAttrs: false })` added at line 105). No callers pass extraneous attrs.

**Files**: `src/components/base/BaseModal.vue`

---

### ~~BUG-1728~~: Projects store sync race condition (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-31)

**Problem**: Projects store has a sync race condition — concurrent sync operations can interleave and produce inconsistent state. Needs a `syncUpdateInProgress` guard flag to prevent overlapping sync calls.

**Fix**: Added promise-based deduplication to `loadProjectsFromDatabase()`. If a load is already in flight, concurrent callers await the same promise instead of starting a new one.

**Files**: `src/stores/projects.ts` (or equivalent projects store)

---

### ~~BUG-1729~~: CanvasView duplicate attribute in template (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE

**Problem**: `CanvasView.vue` template has a duplicate attribute on an element, causing a Vue compile warning. The duplicate attribute needs to be identified and removed.

**Files**: `src/views/CanvasView.vue`

---

### ~~BUG-1717~~: Fix `ref is not defined` runtime error in CanvasView production build (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-28)

**Problem**: Production build (both web and Electron) throws `ReferenceError: ref is not defined` at `CanvasView-*.js:2:151250` during the `setup()` function. The error crashes the Canvas view. All source files correctly import `ref` from `vue` — the issue is in the production bundle (tree-shaking or chunk splitting bug).

**Impact**: Canvas view broken in production web (`in-theflow.com`) and Electron. Board/Calendar/Catalog views work fine.

**Fix**: `src/stores/canvasTaskBridge.ts` uses module-level `ref()` calls that evaluate at import time. Pinned the module to the `vue-vendor` manualChunks entry in `vite.config.ts` so it always bundles in the same chunk as Vue, eliminating the chunk-ordering race condition.

**Files changed**: `vite.config.ts` (manualChunks), `src/stores/canvasTaskBridge.ts` (BUG-1717 comment)

---

### BUG-1723: Supabase Realtime connection drops with CHANNEL_ERROR cycling (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-04-04)

---

### ~~BUG-1724~~: BaseModal Vue warning — extraneous class attribute on fragment root (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-25)

---

### ~~BUG-1725~~: Lifecycle hooks called outside component setup context (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-25)

---

### ~~BUG-1731~~: Electron auth persistence — sessions lost on app restart (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-26)

**Problem**: Electron's `file://` protocol didn't reliably persist localStorage across app restarts. Auth tokens were lost and users were logged out after closing and reopening the app.

**Fix**:
1. **electronStorage adapter** — IPC-backed storage adapter that routes auth tokens through `electron-store` disk-backed store (survives restarts)
2. **localhost HTTP OAuth server** — Same pattern as Tauri: start `http://localhost:3001` server in Electron main process to capture OAuth callback (since `file://` can't handle redirects)
3. **Settings > Account Updates section** — Added in Electron to show auto-updater status (parallel to Tauri)

**Files**: `src/services/auth/electronStorage.ts`, `src/composables/useElectronAuth.ts`, `electron/ipc/auth.ts`, `src/components/settings/tabs/AccountSettingsTab.vue`

---

### ~~BUG-1732~~: Canvas group badge counts task not rendered (parentId without canvasPosition) (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-26)

---

### ~~TASK-1718~~: Electron Phase 2 — Platform Detection Swap (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Replace all Tauri detection with Electron detection.

**Tasks**:
1. Update `src/utils/platform.ts`: add `isElectron()` using `window.electronAPI !== undefined`
2. Update all 9 raw `window.__TAURI__` / `window.__TAURI_INTERNALS__` checks across the codebase
3. Update `src/main.ts`: swap `.tauri-app` class → `.electron-app` (or remove entirely since Electron = Chromium)
4. Delete 186 `.tauri-app` CSS rules from `src/assets/styles.css` — Electron uses Chromium, no WebKitGTK workarounds needed
5. Update `vite.config.ts`: swap `isTauri` → `isElectron` for PWA disable logic

**Files to modify**: `src/utils/platform.ts`, `src/main.ts`, `src/assets/styles.css`, `vite.config.ts`, + 9 files with raw `__TAURI__` checks

---

### ~~TASK-1719~~: Electron Phase 3 — IPC Handlers (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Create Electron IPC handlers to replace Tauri's 13 `invoke()` commands and 10 plugins.

**Tasks**:
1. Create `electron/ipc/shell.ts` — `shell.openExternal()` for URLs, `child_process.exec()` for Docker/Supabase
2. Create `electron/ipc/store.ts` — `electron-store` for settings persistence (replaces `@tauri-apps/plugin-store`)
3. Create `electron/ipc/fs.ts` — Node.js `fs` for auth token file at `~/.config/flowstate`
4. Create `electron/ipc/dialog.ts` — `dialog.showSaveDialog()` for backup export
5. Create `electron/ipc/http.ts` — Node.js `fetch` in main process for CORS-free requests (Ollama, iCal)
6. Register all handlers in `electron/main.ts`
7. Update renderer-side composables to use `window.electronAPI.invoke()` instead of Tauri `invoke()`

**Composables to update**: `useTauriStartup.ts` → `useElectronStartup.ts`, `usePersistentRef.ts`, `backup/backupExport.ts`, `useTauriOAuth.ts`, `useTauriUpdater.ts`, `useTauriDebug.ts`

---

### ~~TASK-1720~~: Electron Phase 4 — Auto-Updater + Deploy Pipeline (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Set up `electron-updater` and deploy pipeline to VPS.

**Tasks**:
1. Install `electron-updater`
2. Create `electron/updater.ts` — check/download/install flow
3. Rewrite `scripts/deploy-tauri-update.sh` → `scripts/deploy-electron-update.sh`
4. Update VPS to serve Electron updates at `/updates/electron/`
5. Update `TauriUpdateNotification.vue` → `ElectronUpdateNotification.vue`
6. First production Electron build + deploy
7. Verify auto-update works end-to-end

---

### ~~TASK-1721~~: Electron Phase 5 — Cleanup & CI/CD (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Clean up Tauri remnants and set up CI/CD for Electron.

**Tasks**:
1. Remove `src-tauri/` from active development (keep in git history at `tauri-archive-v1.3.28` tag)
2. Remove all `@tauri-apps/*` npm dependencies
3. Update `.github/workflows/` for Electron builds
4. Update CLAUDE.md — replace Tauri references with Electron
5. Update `docs/sop/SOP-011-tauri-distribution.md` → Electron distribution SOP
6. Final E2E test run to verify nothing broke

---

### ~~TASK-1715~~: Migrate Desktop App from Tauri to Electron (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-25) | **Archive**: `tauri-archive-v1.3.28`

**Why**: WebKitGTK (Tauri) has too many rendering bugs vs Chromium. Electron uses Chromium = zero CSS parity issues with web app.

**Scope**: Replace Tauri shell only. Vue 3 + Vite frontend stays identical.

**Phase 1: Electron Setup (Foundation)** ✅
- [x] Install electron, electron-builder, electron-updater
- [x] Create `electron/main.ts` (main process), `electron/preload.ts`
- [x] Configure Vite for Electron (manual, `base: './'`)
- [x] Basic window opens with the Vue app

**Phase 2: Platform Detection Swap** ✅ (TASK-1718)
- [x] Update `src/utils/platform.ts`: `isElectron()` via `window.electronAPI`, `isTauri()` returns false
- [x] Update all 3 raw `window.__TAURI__` checks
- [x] Delete 38 `.tauri-app` CSS rule blocks — Electron uses Chromium, no workarounds needed
- [x] Add `.electron-app` class in `main.ts`

**Phase 3+4: IPC Handlers + Plugin Replacements** ✅ (TASK-1719)
- [x] `electron/ipc/shell.ts` — `shell.openExternal()`
- [x] `electron/ipc/store.ts` — JSON key-value store (replaces `@tauri-apps/plugin-store`)
- [x] `electron/ipc/fs.ts` — Node.js `fs` via IPC
- [x] `electron/ipc/dialog.ts` — `dialog.showSaveDialog()`
- [x] `electron/ipc/http.ts` — `net.fetch` in main process (CORS bypass)
- [x] `electron/ipc/window.ts` — minimize, maximize, close
- [x] All handlers registered in `electron/main.ts`

**Remaining (separate tasks):**
- Phase 5: Auto-updater → TASK-1720
- Phase 6: Build & Deploy → TASK-1721

**Files to modify:**
- `src/utils/platform.ts` — swap detection
- `src/main.ts` — swap `.tauri-app` → `.electron-app`
- `src/assets/styles.css` — delete 186 `.tauri-app` rules
- `vite.config.ts` — Electron build integration
- `package.json` — swap deps + scripts
- 38 files using `isTauri()` → `isElectron()`

---

### ~~BUG-1706~~: Set up Epiphany WebKitGTK testing workflow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Goal**: Install Epiphany (GNOME Web) as a fast WebKitGTK testing environment. Same engine as Tauri's wry — point at `localhost:5546` to test CSS without building Tauri.

**Tasks**:
- Install `epiphany-browser` (uses system WebKitGTK)
- Verify it reproduces the sidebar clipping bug
- Document workflow in CLAUDE.md

---

### ~~BUG-1707~~: Fix sidebar width calculation for WebKitGTK (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE | **Depends on**: ~~BUG-1706~~

**Root Cause Analysis** (confirmed via Perplexity research):
- `.sidebar` has redundant `width: 100%; min-width: 240px; max-width: 340px` PLUS the grid track `minmax(240px, 340px)` — double-constraining causes WebKitGTK to miscalculate
- `overflow: hidden` on `.sidebar` + nested flex with `min-width: 0` triggers known cross-engine shrinkage bugs
- `contain: style` may have side effects in WebKitGTK despite spec saying it shouldn't

**Fix order** (test each in Epiphany):
1. Change `.sidebar` to `width: auto; min-width: 0` — let grid track own the width
2. If still broken: remove `overflow: hidden` from `.sidebar`
3. If still broken: remove `contain: style`
4. If still broken: temporarily remove `backdrop-filter` to isolate compositing effects

**Files**: `src/layouts/AppSidebar.vue`, `src/layouts/MainLayout.vue`

---

### ~~BUG-1708~~: Deploy verified WebKitGTK sidebar fix to Tauri (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE | **Depends on**: ~~BUG-1707~~

**Scope**: Version bump + `./scripts/deploy-tauri-update.sh` — only after fix confirmed in Epiphany.

---

### ~~TASK-1596~~: Test infrastructure setup — coverage + factories + helpers (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-21)

**Scope**: Install `@vitest/coverage-v8`, update `vitest.config.ts` with coverage config, remove `tests/integration/**` from exclude, create `tests/factories/index.ts` with `createMockTask/Project/TimerSession` factories, and add `tests/helpers/selectors.ts` with `data-testid` selectors. No production source code changes.

**Files**: `vitest.config.ts`, `tests/factories/index.ts`, `tests/helpers/selectors.ts`, `package.json`

---

### ~~BUG-1583~~: Timer starts then stops + KDE widget session sync (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-21)

**Bug 1 — Timer race condition**: `startTimer()` had an async gap between `clearExistingSession()` and `saveTimerSessionWithLeadership()`. During this gap, the follower poll (3s interval) or visibility handler would query DB, find no active session, and null out `currentSession`. Fixed by moving `isDeviceLeader=true` + `pauseFollowerPoll()` before the first `await`, and adding an `isStarting` guard flag that blocks both the follower poll and `resyncFromDatabase` during the start sequence.

**Bug 2 — KDE widget orphaned sessions**: Widget's `startNewSession()` and `startSessionForTask()` POSTed new sessions without clearing existing ones, leaving multiple `is_active=true` rows. Fixed by PATCHing all active sessions to `is_active: false` before creating the new one.

**Files**: `src/stores/timer.ts`, `src/composables/timer/useTimerSync.ts`, `packages/kde-widget/contents/ui/main.qml`

---

### BUG-1582: IndexedDB cache corruption (444k tasks) + Tauri time-filter dropdown unresponsive (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-21)

**Bug 1 — IndexedDB cache corruption**: Inbox badge showed 444,000 tasks (actual DB: 227). Corrupted IndexedDB cache persisted across restarts. Fixed by adding a self-healing guard in `useAppInitialization.ts` — if cached task count exceeds 1,000, the cache is cleared and skipped (falls through to Phase B Supabase load). Also added a write-side guard in `readCacheDB.ts::cacheTasks()` that refuses to write arrays > 1,000 tasks, preventing re-corruption. The dedup post-check now also enforces the 1,000-task ceiling.

**Bug 2 — Tauri time-filter dropdown unresponsive**: The `NPopover` dropdowns (time filter and group filter) in `UnifiedInboxHeader.vue` used `raw` prop which removes Naive UI's default DOM injection. In Tauri's WebKitGTK, the popover content was clipped by parent `overflow: hidden` containers. Fixed by adding `to="body"` to both `NPopover` components so content teleports out of the clipped container to `<body>`. Added `z-index: var(--z-popover)` and `position: relative` to `.time-filter-options` and `.group-filter-chips` CSS so they stack correctly when teleported.

**Files**: `src/composables/app/useAppInitialization.ts`, `src/services/offline/readCacheDB.ts`, `src/components/inbox/unified/UnifiedInboxHeader.vue`

---

### ~~TASK-1579~~: Consolidate canvas viewport to single source of truth in canvasViewport.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Canvas viewport `{x, y, zoom}` existed in 3 separate locations with no sync:
1. `canvasUi.ts` — duplicate `viewport` ref with its own localStorage + Supabase watcher
2. `canvasViewport.ts` — the actual owner, used by `canvas.ts`
3. `settings.ts` — `canvasViewport` field in `AppSettings` (data transport vessel for DB mapper)

**Fix**: Removed `viewport` ref, `setViewport`, `setViewportWithHistory`, `saveZoomToHistory`, `zoomHistory`, `loadSavedViewport`, and the viewport watcher from `canvasUi.ts`. Added debounced (2s) Supabase write to `canvasViewport.ts`'s `setViewport`. `settings.ts` `canvasViewport` field kept as the DB transport vessel used by `supabaseMappers.ts`.

**Files**: `src/stores/canvas/canvasUi.ts`, `src/stores/canvas/canvasViewport.ts`

---

### ~~TASK-1560~~: Redesign SidebarWorkspaceSwitcher — always-visible with create workspace flow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-16)

**Scope**: Redesign `src/components/sidebar/SidebarWorkspaceSwitcher.vue` to always show (remove `v-if="shouldShowSwitcher"`), add inline workspace creation with name input + teal confirm button, add copy-invite-link per shared workspace, and add 5 missing translation keys to both locale files.

---

## Workspace Collaboration — Post-Implementation Bugs

### ~~BUG-1561~~: Sync queue classifyError fails on Supabase PostgrestError objects (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE

**Problem**: `classifyError()` in `retryStrategy.ts` called `String(error)` on Supabase `PostgrestError` objects (plain objects, NOT `instanceof Error`). Produced `"[object Object]"` — all PostgREST errors fell through to `'unknown'` → retried infinitely → rate limit cascade.

**Fix**: Three-branch message extraction (instanceof Error → plain object .message → String fallback). Regression tests added for PostgrestError shapes.

**Files**: `src/services/offline/retryStrategy.ts`, `src/services/offline/__tests__/retryStrategy.spec.ts`

---

### ~~BUG-1562~~: taskPersistence smart-merge enqueues raw camelCase payloads to sync queue (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-24)

**Problem**: `taskPersistence.ts:416-420` enqueues raw app-side task objects (with `_soft_deleted`, `projectId`, `isInInbox` etc.) directly to the sync queue, bypassing `toSupabaseTask()`. When the queue processes these, Supabase returns 400 because camelCase fields don't exist as DB columns.

**Root cause**: Smart-merge local-only task preservation used `payload: localTask as unknown as Record<string, unknown>` instead of mapping through `toSupabaseTask()`.

**Fix**: Use `toSupabaseTask()` mapper before enqueueing. Already implemented in `src/stores/tasks/taskPersistence.ts`.

**Files**: `src/stores/tasks/taskPersistence.ts`

---

### ~~BUG-1563~~: Workspace switch shows personal tasks in shared workspace (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-24)

**Problem**: When switching to a shared workspace, the empty-overwrite protection in `taskPersistence.ts` and `canvas.ts` blocks loading 0 tasks (legitimate for an empty workspace), keeping 216 personal tasks visible.

**Root cause**: BUG-169 safety guard treats "0 loaded, N existing" as data loss — doesn't account for workspace switches where 0 tasks IS correct.

**Fix**: Check `isSwitchingWorkspace` flag from workspace store to bypass protection during switches. Already implemented in `taskPersistence.ts`, `canvas.ts`, `canvasGroups.ts`.

**Files**: `src/stores/tasks/taskPersistence.ts`, `src/stores/canvas.ts`, `src/stores/canvas/canvasGroups.ts`

---

### BUG-1564: loadMembers() PGRST200 — cross-schema JOIN to auth.users fails (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17)

**Problem**: `loadMembers()` in workspace store uses PostgREST JOIN to `auth.users` which is in a different schema. PostgREST can't resolve the FK.

**Fix**: Removed the JOIN, fetch raw member records only. Display names deferred to Phase 3 profiles table.

**Files**: `src/stores/workspace.ts`

---

### BUG-1565: Sync queue processes during workspace switch causing 400s (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17)

**Problem**: When switching workspaces, realtime events for departing tasks trigger sync queue operations that upsert with stale context.

**Fix**: Added `isSwitchingWorkspace` flag to workspace store, sync queue's `processQueue()` checks it before processing.

**Files**: `src/stores/workspace.ts`, `src/composables/sync/useSyncOrchestrator.ts`

---

### ~~BUG-1566~~: One-time IndexedDB cleanup needed after camelCase payload contamination (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-24)

**Problem**: Stale sync queue ops with camelCase payloads accumulated in IndexedDB before BUG-1562 fix. These ops retry infinitely (due to BUG-1561), causing rate limit cascades that take down the entire app on every page load.

**Fix**: One-time `indexedDB.deleteDatabase()` cleanup at app startup in `main.ts`. Cleanup guard uses localStorage key so it runs only once. Safe because all tasks exist in production DB. Should be removed after cleanup completes.

**Files**: `src/main.ts`

---

## Data Architecture Debt — Single Source of Truth Fixes

### ~~TASK-1572~~: Consolidate canvas viewport from 3 stores into 1 (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `viewport: {x, y, zoom}` exists in 3 independent places with NO sync mechanism between them:
1. `canvasUi.ts → viewport` (in-memory only)
2. `canvasViewport.ts → viewport` (persisted to localStorage + Supabase `user_settings.canvas_viewport`)
3. `settings.ts → canvasViewport` (inside settings blob, goes through settings save path)

On a new device, all three can restore to different positions. On pan/zoom, only `canvasViewport.ts` and `canvasUi.ts` update — Supabase only gets the value when a full settings save fires.

**Fix**: Delete `canvasUi.ts → viewport` field. Use `canvasViewport.ts` as the single owner. Remove `settingsStore.canvasViewport` field and replace with a read-on-startup from `canvasViewport` store. Add a debounced watcher that pushes viewport changes to Supabase.

**Files**: `src/stores/canvas/canvasUi.ts`, `src/stores/canvas/canvasViewport.ts`, `src/stores/settings.ts`

---

### ~~TASK-1573~~: Fix settings auto-sync gap — timer/API settings never reach Supabase (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `syncSettingsToSupabase()` in `settings.ts` only writes `pushNotifications` and `timeBlockNotifications` to Supabase automatically. All other settings (timer durations, Groq API key, Google tokens, saved views) only reach Supabase on explicit full save. On a new/second device, these settings are always stale.

**Fix**: Expand `syncSettingsToSupabase()` to write the full `AppSettings` blob on every debounced change (debounce 2s). This mirrors the pattern already used by `useAISync.ts` for AI conversations.

**Files**: `src/stores/settings.ts`

---

### ~~TASK-1574~~: Unify theme/locale/sidebarCollapsed — remove duplication between ui.ts and settings.ts (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Three fields are independently maintained in both `ui.ts` and `settings.ts` with NO sync:
- `theme`: `ui.ts` uses `'auto'`, `settings.ts` uses `'system'` — different type strings, `uiStore.theme` is NOT persisted
- `locale`/`language`: written to `flowstate-app-locale` by `ui.ts` AND embedded inside `flowstate-settings-v2` by `settings.ts` — two code paths, no reconciliation
- `sidebarCollapsed`: in `settings.ts` blob but never written (orphaned field)

**Fix**: Make `uiStore.theme` a computed reading from `settingsStore.theme`. Standardize on `'auto'` vs `'system'` (pick one). Remove standalone `flowstate-app-locale` key, drive everything from `settingsStore.language`. Remove orphaned `sidebarCollapsed` from settings schema.

**Files**: `src/stores/ui.ts`, `src/stores/settings.ts`, `src/i18n/useDirection.ts`

---

### ~~TASK-1575~~: Fix hideDoneTasks — 7 independent copies, mobile not persisted (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-18)

**Problem**: The "hide done tasks" concept has 7 independent, unsynchronized copies:
1. `hideBoardDoneTasks` (task store, persisted)
2. `hideCanvasDoneTasks` (task store, persisted)
3. `hideCalendarDoneTasks` (task store, persisted)
4. `showDoneOnly` canvas inbox (usePersistentRef, separate key)
5. `showDoneOnly` calendar inbox (usePersistentRef, separate key)
6. `useMobileFilters.hideDoneTasks` — NOT persisted, defaults `true` on every reload
7. `SearchModal.activeFilters.hideDone` — resets every time modal opens

**Fix**: Mobile `useMobileFilters.hideDoneTasks` should use `usePersistentRef`. `SearchModal` initial value should read from `taskStore.hideBoardDoneTasks`. Document that the 3 per-view flags in the store are intentionally independent (board/canvas/calendar have separate hide-done states).

**Files**: `src/composables/mobile/useMobileFilters.ts`, `src/components/layout/SearchModal.vue`

---

### ~~TASK-1576~~: Create src/constants/ — storageKeys, taskConstants, dbTables, routes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Magic strings scattered throughout the codebase with no single source of truth:
- Task status strings (`'todo'`, `'done'`) in 120 files — TypeScript type exists but no runtime constant
- Priority strings (`'high'`, `'medium'`, `'low'`) in 144 files — same
- ~40 localStorage `flowstate-*` keys — only backup keys have a `STORAGE_KEYS` object; `flowstate-canvas-viewport` written by 2 independent files, `flowstate-recurrence-lock-{date}` generated in 3 places
- Supabase table names in 40+ `.from()` calls — 3 leak outside the DB composable layer
- Route paths as string literals in ~15 `router.push()` call sites

**Fix**:
1. `src/constants/taskConstants.ts` — `TASK_STATUS` and `TASK_PRIORITY` `as const` objects
2. `src/constants/storageKeys.ts` — all `flowstate-*` keys, extending backup system's pattern
3. `src/constants/dbTables.ts` — all Supabase table name strings
4. Export `ROUTES` const from `src/router/index.ts`, replace bare string `router.push()` calls

**Files**: `src/constants/` (new files), `src/types/tasks.ts`, `src/router/index.ts`, `src/utils/guestModeStorage.ts`, `src/stores/tasks/taskOperations.ts`, `src/composables/useRecurrenceScheduler.ts`

---

### ~~TASK-1577~~: Load completedSessions from pomodoro_history on timer init (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `timerStore.completedSessions` starts empty on every page load. Supabase has `pomodoro_history` table but it's only written to (never read). Code in `ai/tools.ts` reads `completedSessions.length` to count "sessions today" — always returns 0 after reload, giving wrong AI context.

**Fix**: Added `loadTodaySessionsFromDB()` async function to timer store that:
1. Queries `pomodoro_history` using `fetchPomodoroHistory(0)` from `useWorkProfileDatabase`
2. Maps DB records to `PomodoroSession` shape (generates UUIDs for session IDs which DB doesn't store)
3. Populates `completedSessions.value` with loaded records
4. Only runs when authenticated AND `aiLearningEnabled` is true
5. Watcher on `authStore` triggers load when auth becomes available
6. Cleanup unsubscribes watcher on store disposal

**Files**: `src/stores/timer.ts`

---

### ~~TASK-1578~~: Fix hardcoded brand colors in JS — useDragAndDrop.ts and KanbanColumn.vue (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Design token violations where CSS variables should be used:
- `useDragAndDrop.ts:71` — ghost element CSS string contains `rgba(78,205,196,0.4)` (brand teal hardcoded in JavaScript, completely outside token system)
- `KanbanColumn.vue:291-293` — priority color map with `#ef4444`, `#f59e0b`, `#3b82f6` (should use `--color-priority-*` tokens)
- `FlowTaskCard.vue:281-292` — hardcoded `#f59e0b`, `#4ade80` for status colors
- `FaviconManager.vue:48-50` — hardcoded `#ef4444`, `#22c55e`, `#6b7280` for timer states

**Fix**: Replace with CSS custom property reads in JS (`getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')`) or inject the ghost element as a class with CSS styles instead of inline string.

**Files**: `src/composables/useDragAndDrop.ts`, `src/components/tasks/KanbanColumn.vue`, `src/components/canvas/FlowTaskCard.vue`, `src/services/FaviconManager.ts`

---

## Test Failures (P2)

### ~~BUG-1568~~: WebKitGTK CSS safety test fails — text-overflow: clip in CategorySelector (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `CategorySelector.vue` style block line 198 uses `text-overflow: clip !important` without the required `/* WebKitGTK-safe */` annotation. The `css-syntax.test.ts` safety test catches this as a potential Tauri/WebKitGTK compatibility issue.

**Fix**: Add `/* WebKitGTK-safe */` annotation on the same line, or replace `text-overflow: clip` with a WebKitGTK-compatible alternative.

**Files**: `src/components/layout/CategorySelector.vue`

---

### ~~BUG-1569~~: Circular dependency — timer.ts → tasks.ts → taskStates.ts → projects.ts → taskOperations.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `dependencies.test.ts` detects a circular import cycle: `timer.ts` → `tasks.ts` → `taskStates.ts` → `projects.ts` → `taskOperations.ts` → back to `timer.ts`. This can cause initialization ordering issues and makes the codebase harder to reason about.

**Fix**: Extract shared types/utilities into a separate module, use dynamic imports, or restructure store dependencies to break the cycle.

**Files**: `src/stores/timer.ts`, `src/stores/tasks.ts`, `src/stores/tasks/taskStates.ts`, `src/stores/projects.ts`, `src/stores/tasks/taskOperations.ts`

---

### ~~BUG-1570~~: Task filtering test fails — "today" smart view returns 0 tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `tasks.test.ts` "filters tasks by today smart view" expects `filteredTasks.length >= 1` after `setSmartView('today')`, but gets 0. Either the test seed data isn't creating a task with today's date correctly, or the smart view filter logic has a date comparison bug.

**Fix**: Investigate whether the test setup creates tasks with `dueDate` set to today correctly, and whether `setSmartView('today')` filter matches the expected format. Fix the test or the filter logic.

**Files**: `src/stores/__tests__/tasks.test.ts`, `src/stores/tasks/taskStates.ts`

---

## Active Bugs (P0-P1)

### ~~BUG-1954~~: Signed-in Electron remains empty after one renderer hydration failure (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (Electron 1.4.255, 2026-07-14) | **Depends on**: BUG-1942, BUG-1944, TASK-1947

**User repro**: Electron 1.4.254 shows the authenticated account footer but every sidebar count is zero and Canvas renders `Your spatial canvas awaits`. At the same time the renderer auth heartbeat reports authenticated/remote-capable and the user-scoped Local Task API returns 25 open tasks, including `לשלוח כביסה`.

**Root cause**: the authenticated renderer starts with an empty read cache and performs one fire-and-forget core-data load. If that load rejects while `navigator.onLine` is already true, recovery waits only for a future `online` event that never occurs. The persisted personal canonical cursor then reports no new changes and skips its authoritative baseline, so unchanged remote tasks remain absent indefinitely. Separately, the Canvas empty-state card uses a weak glass background even though global flat mode disables blur, making the columns behind it bleed through.

**Acceptance**:
- A failed authenticated load with an empty renderer projection invalidates only the still-active personal/workspace cursor and immediately attempts an authoritative baseline.
- A failed baseline leaves the cursor empty so the existing bounded foreground poll retries; a successful baseline persists high-water only after tasks are visible.
- Auth or workspace changes cannot clear/reload another scope.
- A genuinely empty Canvas uses the canonical opaque overlay surface tokens under flat mode.
- Focused red/green regressions, typecheck, lint, Electron build, packaged signed-in UI, updater manifest, and artifact reachability are verified.

**Regression and live proof**: RED tests first failed because no authenticated-empty recovery helper existed and the Canvas card still used the translucent glass token. Green focused coverage passed 74/74 across canonical catch-up, auth reload, persistence boundaries, and Canvas behavior; the Electron sync guard passed 243/243; the full ship gate passed 3,538 tests with 6 skipped; typecheck and the packaged Electron build passed. The touched-file lint probe reported only pre-existing template formatting debt and the pre-existing unused cache flag. Electron 1.4.255 was deployed, the public updater manifest serves 1.4.255, and both AppImage and deb range requests return 206. The installed signed-in app was relaunched against the real profile: the footer remained authenticated, sidebar counts recovered to Today 4 / This Week 33 / All Active 59, Canvas tasks rendered, and the false empty-state card was absent. The redacted Local Task API read returned 25 tasks and the exact record `f4658470-fa2f-41e0-ac20-867750278e92` as `לשלוח כביסה`, `todo`, `high`, due `2026-07-13`; live diagnostics reported app version 1.4.255, authenticated renderer sync capability, and no failures or warnings.

**Exact failure mode fixed**: an already-authenticated Electron renderer with zero local task projection can no longer remain permanently empty merely because its saved canonical cursor has no newer change rows.

**Explicitly not covered**: this does not hide legitimate first-run guidance for a genuinely empty account; it makes that real empty-state surface opaque and design-system compliant.

### ~~BUG-1955~~: Packaged exact-task reads crash because the subtask normalizer is missing (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-14; shipped Electron 1.4.256) | **Depends on**: TASK-1797, TASK-1943

**User repro**: Electron 1.4.255 is authenticated and its compact task, search, assistant-context, timer, task-instance, and Supabase reads work, but `GET /api/tasks/:id` returns HTTP 500 with `normalizeSubtasks is not defined`, blocking Hermes from reading the task's detailed planning context.

**Root cause**: PR #207 introduced the detailed serializer call without its helper definition, and the 1.4.255 release faithfully bundled that incomplete committed source. Existing coverage asserted source text but never executed the detailed route from source or the packaged sidecar, so the runtime crash passed every release gate.

**Acceptance**:
- The detailed exact-task path executes with subtasks absent, null, empty, or containing null/malformed entries and always returns a safe array.
- Runtime coverage executes the same detailed serializer in source and freshly generated Electron bundle; source-text presence and syntax-only checks are insufficient.
- User scoping and deleted-task exclusion remain intact, expected detailed fields remain present, and auth/session/token secrets remain absent.
- Local API suites, typecheck, lint, full tests, Electron main build, package validation, and Electron packaging pass.
- A version above 1.4.255 is deployed; the installed real-profile app returns HTTP 200 for the reported exact task and Hermes reads it end to end without mutating production data.

**Verification**: PR #220 merged after both required checks passed. The canonical ship gate passed 3,540 tests with 6 skipped plus the 243-test Electron synchronization guard, package validation, and the executable source/package regression. The public 1.4.256 AppImage checksum matched its updater manifest and the installed file matched those public bytes. The live real-profile diagnostic reported app version 1.4.256, healthy remote authentication, and no boundary failures; the reported task returned HTTP 200 with normalized subtask and instance arrays, and the office-work Hermes `flowstate_get_task` handler read it successfully without exposing authentication fields or mutating task data.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Installed 1.4.255 exact-task read returned HTTP 500; installed 1.4.256 returned HTTP 200 for the reported task | Yes |
| Data shape / persisted row shape | Yes | Runtime fixtures execute absent, null, empty, scalar, object, mixed, and valid subtask shapes; the live row returned normalized arrays | Yes |
| Renderer store/state | N/A | The crash occurred in the sidecar serializer before a response reached Hermes; the renderer was not the failing boundary | No |
| Electron main/preload bridge | Yes | The extracted public AppImage executes the bundled sidecar regression and package validation confirms the main/preload/sidecar payload | Yes, for packaged sidecar inclusion |
| Localhost sidecar endpoint | Yes | Authenticated live `GET /api/tasks/:id` returned HTTP 200 with the expected safe detailed shape | Yes |
| KDE polling/control path | N/A | No KDE timer or control path participates in exact-task serialization | No |
| Supabase persistence/realtime | Read path only | The signed-in sidecar read the canonical live row under user/workspace/deleted filters; no mutation or Realtime behavior changed | No |
| Updater/runtime version | Yes | Public manifest and artifacts report 1.4.256; public checksum matches the installed AppImage and live diagnostics report 1.4.256 | Yes |
| Stale live process/cache state | Yes | The running real-profile process reports fresh renderer auth, remote-sync capability, and zero live-boundary failures | Yes, for the reported installed-runtime repro |

**Exact failure mode fixed**: the committed detailed-task serializer called an undefined subtask normalizer, so the packaged Electron Local Task API crashed only on `GET /api/tasks/:id` even though health and other routes remained available.

**Explicitly not covered**: this does not claim to repair unrelated protected-route auth recovery tracked by TASK-1952, mutation/Realtime behavior, KDE timer paths, or every possible Local Task API route.

### TASK-1956: Reliable complete FlowState task inventory for Hermes (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-14) | **Depends on**: TASK-1943, TASK-1950, TASK-1952

**User repro**: Hermes can see a healthy packaged Local Task API while protected reads are signed out or limited to one 25-row page. It then falls back to stale snapshots or ledger-file parsing and can present a partial count as the complete live FlowState backlog.

**Acceptance**:
- A valid remotely syncable renderer session reaches or deterministically repairs a blind sidecar after Electron restart; cached/offline shells return `reauth_required`, genuine sign-out returns `signed_out`, and expired backups are never replayed.
- A bearer-protected read-only inventory returns all open visible tasks with stable keyset pagination, exact UUID deduplication, receipt metadata, one authenticated scope, and `complete=true` only after every page succeeds.
- Partial pages, failed later pages, and cached fallbacks cannot emit an exact current total; cached evidence is explicitly `fresh=false` and `complete=false`.
- Soft-deleted, completed, completion-history, and cross-scope rows are excluded; exact UUID reads preserve canonical revision and supported metadata.
- Source, packaged-sidecar, renderer/main/preload, redacted diagnostic, and Hermes connector regressions cover the reported restart, truncation, stale-cache, and invalid-search shapes.
- Full tests, lint, build, Electron packaging, installed-runtime auth/inventory proof, updater manifest/artifact verification, commit, and push are complete before this task is marked done.

**Explicitly not covered**: authoritative Notion or Obsidian inventory validation; this task makes FlowState complete and reconcilable without using file parsing as a substitute for its API.

**Regression added for reported repro**: the executable test spawns both source and freshly bundled or extracted packaged sidecars, performs authenticated exact-task reads across malformed and valid subtask shapes, and verifies user/workspace/deleted filters plus the response allowlist.

**Live boundary proof**: the public and installed 1.4.256 bytes match; redacted diagnostics show healthy real-profile authentication and remote sync; the reported exact task returns HTTP 200; Hermes' office-work `flowstate_get_task` handler reads it end to end.

### ~~TASK-1959~~: Receipt-backed audit coverage, claim guardrails, and screenshot reconciliation (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-15) | **Depends on**: TASK-1943, TASK-1956

**User repro**: Hermes reviewed a representative subset of tasks (or capability classes, or screenshot-visible rows without exact identity) and then summarized the work as "reviewed everything". No durable evidence distinguished full coverage from sampled coverage, so the over-broad claim could not be caught.

**Acceptance**:
- A durable, machine-checkable `audit-coverage-v2` receipt records audit scope, source surface, snapshot time, expected item count/IDs when known, exact reviewed item IDs with per-item evidence class AND per-item provenance (`server-read` vs `declared`), declared-only reviewed IDs, weak title-only candidate IDs, ambiguous candidates with all candidate IDs, exact unreviewed IDs, unresolved observations, an `evidenceBasis`, and a completeness class of `full` / `declared_full` / `partial` / `representative_sample` / `unknown`.
- The trust boundary is server-side: the route re-reads claimed records itself (RLS/workspace scoped). Completeness `full` and claim level `verified` are only reachable when every expected ID was reviewed with exact evidence the server re-read at audit time; caller-declared evidence classes, caller `knownTasks`, and caller `liveVerified` can never produce `full`/`verified`/"Live workflow verified" (declared coverage caps at `declared_full` → claim level `declared`). The digest proves integrity, not provenance; provenance is a recorded server-assigned class.
- A claim guardrail classifies summaries as verified/declared/partial/inferred/blocked/unknown and enforces semantically, not by wording blacklist: universal-completeness claims (all/every/entire/whole/each/fully/complete/"nothing was missed"-class negated omission over the audit domain) are blocked below `verified`, and every non-verified summary must explicitly disclose incomplete/declared/unknown coverage (default-deny). Capability audits must say so; live blockers must survive into the wording; live-verified wording requires server-owned live proof, which does not exist in this API shape.
- Screenshot reconciliation records visible text (Hebrew/multiline safe), proven exact task ID matches, weak title-only candidates, ambiguous candidates, and unresolved rows as separate durable receipt fields with their candidate IDs; review level reflects reviewed evidence (`exact-task-level` / `identity-only` / `mixed` / `screenshot-level`) — a proven identity row with `reviewed:false` can never read as exact-task-level.
- Blocked over-claim attempts (draft, violations, receipt) are durably appended to `audit-coverage-blocked.jsonl`, so refusals leave the same audit trail as accepted receipts; the 422 response reports whether the blocked attempt persisted.
- Regression covers the actual failures: fabricated IDs/evidence/knownTasks/liveVerified cannot certify verified/full/live; equivalent broad-claim wording variants are blocked; weak/ambiguous candidates are durable; blocked attempts persist (110 tests across `tests/unit/local-api/audit-coverage*.test.ts`, `claim-guardrail.test.ts`, `screenshot-reconciliation.test.ts`, incl. `audit-coverage-hardening.test.ts`).

**Explicitly not covered**: retroactive classification of historical Hermes summaries; enforcement inside Hermes' own prompt/runtime (this ships the FlowState-side receipt and guard surface it must consume); DB-table persistence of audit receipts (they persist as JSONL under the sidecar data dir); server-owned proof of LIVE workflow verification (deliberately unreachable rather than trusted); packaged-Electron/live-route proof (unit + contract level only so far).

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Regression: a representative-sample/subset receipt blocks "I reviewed everything in FlowState." with 422 `broad_claim_blocked` and a safe rewording | Yes |
| Data shape / persisted row shape | Yes | `audit-coverage-v2` receipts are digest-bound; JSONL receipt + blocked-attempt ledgers re-validate offline via `validAuditCoverageReceipt()` | Yes |
| Renderer store/state | N/A | No renderer surface changed | No |
| Electron main/preload bridge | N/A | No bridge change; sidecar route only | No |
| Localhost sidecar endpoint | Yes | `POST /api/audit/coverage` registered behind bearer token + auth context; source-order contract test | Yes |
| KDE polling/control path | N/A | Untouched | No |
| Supabase persistence/realtime | Yes | `server-read` provenance re-reads claimed records RLS/workspace-scoped at audit time | Yes, for provenance lookups |
| Updater/runtime version | Not yet | Isolated tree builds with electron-builder; no version bump or updater deploy in this commit | No |
| Stale live process/cache state | Not yet | A running older sidecar serves this route only after update/restart | No |

**Exact failure mode fixed**: FlowState-side over-claiming — a subset, sample, capability-class, declared-only, or screenshot-title review being summarized as full/verified item coverage through the Local API audit surface.

**Explicitly not covered**: Hermes-side adoption (Hermes must route summaries through `POST /api/audit/coverage` or validate receipts itself); Hebrew-language broad-claim lexicon (the mandatory coverage-disclosure rule is the backstop); Supabase-table receipt persistence; live packaged-app and updater delivery of this route.

**Regression added for reported repro**: representative-sample and partial receipts cannot emit "reviewed everything"/"all tasks" wording; declared/weak/ambiguous evidence can never reach `full`/`verified`; unresolved screenshot rows block "reviewed all visible tasks".

**Live boundary proof**: local vitest packs (local-api + electron) and an isolated-tree `electron-builder` build only; the packaged live sidecar route and Hermes end-to-end use are not yet proven and remain the tracked follow-up.


### TASK-1957: Atomic recurrence-aware duplicate merge for Hermes (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-15) | **Depends on**: TASK-1943, FEATURE-1943

**User repro**: after the user confirmed that two tasks are duplicates and supplied the intended cadence, Hermes called the merge operation, received `incompatible_recurrence`, then continued with separate task updates. The duplicate remained unresolved and the separate writes were not one approved, atomic merge.

**Acceptance**:
- A merge without an explicit recurrence resolution remains non-mutating and returns a typed stop-and-clarify action.
- A preview may select one validated canonical recurrence rule only when both rows are living root tasks and neither task participates in recurrence parents, children, completion history, legacy generated recurrence state, or another series identity.
- The selected recurrence is included in the preview version, idempotency payload, exact approval UI, apply receipt, and read-back; apply updates the survivor and archives the duplicate in one transaction.
- Unsupported series/history shapes still fail closed without changing either task, and a rejected merge cannot be treated as approval for follow-up task updates or deletion.
- FlowState RPC/Local API and Hermes connector regressions cover absent, conflicting, invalid, stale-preview, replay, and rollback paths before packaged verification.

**Explicitly not covered**: merging two established recurrence chains or rewriting completion history. Those require the broader series-management contract tracked by FEATURE-1945.

### ~~TASK-1958~~: Canonical non-recurring task completion for Hermes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (filed and completed 2026-07-15) | **Depends on**: TASK-1944, TASK-1951

**User repro**: several real non-recurring tasks are complete in reality but still show as todo, and Hermes had no dedicated safe completion capability — only the generic canonical patch, which is not a completion command and bypasses completion semantics.

**Shipped**:
- `flowstate_complete_task_v1` (`supabase/migrations/20260715020000_complete_task_rpc.sql`): preview/approval-digest/apply/receipt contract cloned from `flowstate_patch_task_v1`; apply sets `status='done'` and stamps `completed_at` in one transaction; receipt `action='complete'` with read-back and `readBackHash`.
- Recurring identity fails closed with typed `recurring_task` (recurrence rule, chain parent, or completion record); already-done tasks return `already_completed`; workspace scoping including exact personal `null` scope preserved.
- Local API route `POST /api/tasks/:id/complete` via `server/local-api/complete-task.cjs`; renderer notification only after a verified committed receipt.
- Regression coverage: `tests/unit/local-api/complete-task-handler.test.ts` (12 tests) + route contract test; disposable-DB runtime contract `scripts/db/test-complete-task-rpc.sql` wired into `scripts/db/test-reliable-assistant-contract.sh` (preview non-mutation, forged-approval refusal, commit, replay, hash recomputation, recurring/scope/stale rejections).

**Remaining to go live**: apply the migration to production Supabase and ship the Electron sidecar bundle; then register a `flowstate_complete_task` tool in the Hermes repo.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Four real non-recurring tasks stuck as todo; representative IDs recorded in the 2026-07-15 reconciliation source-of-truth note | Capability exists; the four live tasks still need the shipped endpoint plus an approved apply |
| Data shape / persisted row shape | Yes | Disposable-DB contract proves `status='done'`, `completed_at` stamped, `canonical_revision` incremented, change-log row written | Yes |
| Renderer store/state | Partial | `notifyTaskMutation('update', id)` fires only after receipt verification, reusing the existing reconciliation path; no new renderer UI | Yes for reconciliation; no dedicated completion UI added |
| Electron main/preload bridge | N/A | No bridge change; the sidecar route is reached through the existing supervised utility process | N/A |
| Localhost sidecar endpoint | Yes | `POST /api/tasks/:id/complete` + `complete-task.cjs`; 12 handler unit tests, route contract test, esbuild bundle verified to include the route | Yes |
| KDE polling/control path | N/A | No timer involvement | N/A |
| Supabase persistence/realtime | Yes | Single-transaction RPC with idempotency ledger and canonical change log, proven in the disposable-DB harness | Yes |
| Updater/runtime version | No | Electron build/deploy intentionally not run in this change | Not covered; ship step pending |
| Stale live process/cache state | No | The live sidecar keeps the old bundle until the next packaged ship/restart | Not covered; ship step pending |

**Exact failure mode fixed**: absence of a dedicated, receipt-backed non-recurring completion command — the generic canonical patch could not complete a task with proof of `status`/`completedAt`, and Hermes had no safe completion surface at all.

**Explicitly not covered**: recurring completion (stays on `flowstate_done_for_now`), production Supabase migration and Electron ship, Hermes-repo tool registration, and a live approved apply against the four real stuck tasks.

**Regression added for reported repro**: `tests/unit/local-api/complete-task-handler.test.ts`, `tests/unit/local-api/complete-task-route-contract.test.ts`, and `scripts/db/test-complete-task-rpc.sql` inside `scripts/db/test-reliable-assistant-contract.sh` (preview non-mutation, forged-approval refusal, commit, replay, read-back hash recomputation, recurring/scope/stale rejections).

**Live boundary proof**: deliberately deferred — requires the production migration plus a packaged sidecar; recorded above as the remaining go-live steps.

### ~~TASK-1959~~: Redacted FlowState source-to-runtime truth ledger (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (filed and completed 2026-07-15) | **Depends on**: TASK-1937, TASK-1942, TASK-1956

**Why**: A green source test or local bundle check does not prove which commit, version, updater manifest, installed AppImage, or Local API sidecar is actually active. Repeated release and packaging failures have shown that these surfaces can diverge while each isolated probe looks healthy.

**Acceptance**:
- One script emits a versioned JSON ledger with explicit source, build, public, installed, and sidecar sections plus machine-readable mismatches.
- Output contains no tokens, auth headers, task content, user identity, home paths, query strings, or environment values.
- Non-live mode performs no network, installed-app, or localhost probes and can be generated safely during Electron packaging.
- Local release metadata binds the package version, updater manifest, named artifacts, and bundled sidecar digest without claiming public or installed truth.
- Full mode keeps public, installed, and sidecar checks independently typed so an unavailable surface is not confused with a version mismatch.
- Focused regressions prove redaction, non-live isolation, mismatch detection, and release-output integration.

**Explicitly not covered**: deploying a release, installing/relaunching an AppImage, mutating production data, authenticating the sidecar, or declaring any live surface current without running full mode against that surface.

**Implementation**: `scripts/flowstate-truth-ledger.cjs` emits the `flowstate-truth-ledger-v1` contract with a full Git commit, clean/dirty bit, build timestamp, FlowState contract set, package version, updater manifest and local artifact digests, embedded sidecar digest, and independently normalized public/installed/sidecar evidence. The canonical Electron builder creates a non-live ledger before packaging so `app.asar` carries source provenance, then writes an enriched non-live ledger beside the finished release artifacts. Package validation now fails when embedded provenance is absent, malformed, or contains forbidden sensitive field names. The loopback-only `/api/provenance` endpoint returns a dedicated `flowstate-sidecar-provenance-v1` allowlist from that embedded ledger; it does not reuse timer diagnostics, auth state, raw process arguments, or task data. Full mode is explicit and retains only allowlisted status/version/hash/provenance fields from live probes.

**Tests**: RED first failed because the ledger script and builder integration did not exist; the second RED proved the package validator accepted an AppImage with no embedded provenance; the third RED proved the full-mode sidecar probe still depended on timer diagnostics and no dedicated provenance route existed. Green proof: `npm test -- tests/unit/scripts/flowstate-truth-ledger.test.ts tests/unit/local-api/server-contract.test.ts tests/unit/scripts/validate-electron-package.test.ts` (48/48); `npm run type-check`; `npm run lint`; `node --check scripts/flowstate-truth-ledger.cjs`; `bash -n scripts/run-electron-builder-with-npm-tree.sh`; `git diff --check`; and the canonical `npm run electron:build`, whose package validator confirmed renderer, main, sidecar, launcher metadata, and embedded truth ledger.

**Package/release proof**: the built `app.asar` contains `/dist-electron/flowstate-truth-ledger.json` with the full source commit, build timestamp, dirty bit, five-contract set, local sidecar digest, and all live surfaces marked `not_checked`. `release/flowstate-truth-ledger.json` binds the same embedded provenance digest to manifest `1.4.262` and both locally verified Linux artifacts. Because this verification build intentionally preceded the commit, its verdict correctly reports only `source.dirty=true` rather than claiming a clean release.

**Live read-only proof**: explicit full mode observed public updater `1.4.262` with reachable artifacts and installed AppImage `1.4.262` with a digest. The currently installed sidecar predates the dedicated provenance route, so that surface honestly reports `http_404` until a later release is shipped and relaunched; it is not inferred current from version equality. No task data, credentials, raw process arguments, timer session, or production state was read or written.

### TASK-1960: Make complete inventory the only exhaustive assistant task boundary (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-15) | **Depends on**: TASK-1944, TASK-1956

**Why**: The complete inventory endpoint already traverses stable pages, but capped list and search responses do not identify themselves as filtered samples. Inventory rows also expose `revision` while the canonical Hermes receipt validator requires `canonicalRevision`, causing a complete FlowState receipt to fail at the integration boundary.

**Acceptance**:
- Successful capped list and search responses explicitly return `complete=false`, `scope=filtered_sample`, their effective `limit`, and conservative `hasMore=true`; they never expose an exact total or fresh complete-inventory receipt.
- Complete inventory rows expose positive `canonicalRevision` values under the same field name used by exact reads and Hermes validation.
- Regression coverage proves more than 100 rows traverse all pages, repeated mid-read sequence changes fail closed without a total, and a cursor cannot cross personal/workspace scope.
- Focused tests, typecheck, lint, Electron packaging, installed-runtime proof, release verification, commit, and push complete before this task is marked done.

**Implementation progress**: capped list and search responses now share one conservative filtered-sample marker, and complete inventory rows use the canonical `canonicalRevision` field expected at the Hermes boundary. The source and freshly bundled sidecar regressions traverse 151 rows and assert the response shape; unit regressions cover repeated sequence churn and personal-to-workspace cursor rejection.

**Verification so far**: RED first failed on the absent sample metadata helper and the mismatched `revision` field. GREEN proof: the focused Local API cohort passes 59/59 for source and bundled sidecars, `npm run type-check` passes, `npm run lint` completes without findings, and `git diff --check` passes. Electron packaging, installed-runtime proof, release deployment, and push remain intentionally pending for the later release stage, so this task stays in progress.

**Explicitly not covered**: migrating Hermes monitor reads or shipping a new Electron release; those remain later H2/release steps after this FlowState contract slice lands.

### TASK-1961: Shared canonical assistant receipt validation (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-15) | **Depends on**: TASK-1944, TASK-1945, TASK-1957, TASK-1958

**Why**: task patch and non-recurring completion duplicated a receipt shape check that accepted any well-shaped SHA-256 string without recomputing the read-back hash. Recurring completion and duplicate merge treated any Local API HTTP response with `ok=true` as committed and notified the renderer without canonical operation, revision, sequence, timestamp, or read-back proof.

**Acceptance**:
- One sidecar validator recomputes SHA-256 over the existing FlowState canonical JSON format and binds operation ID, request hash, positive canonical revision/change sequence, aware commit timestamp, exact read-back, and committed/replayed status.
- Patch and non-recurring completion use the shared validator instead of duplicated permissive checks.
- Recurring completion and duplicate merge reject legacy or malformed success envelopes before renderer notification; operation-specific read-back validation proves every affected task identity and state.
- Regression coverage fails first for forged well-shaped hashes, HTTP-only success, mismatched operation/request identity, incomplete revisions/sequences/timestamps, and altered replay.
- The database receipt migration, disposable response-loss proof, Electron package, installed signed-user proof, production migration, and public release all complete before this task is marked done.

**Implementation progress**: test-first Local API foundation in progress. One shared validator now recomputes canonical read-back hashes and binds both envelope and receipt request identity before mutation notifications; patch, completion, recurring completion, merge, and Notion activation share the primitive. The four task mutations use the unified `task-v1` envelope and require exact canonical affected-task evidence: patch/completion require one primary task row, recurring completion/merge require two exact distinct rows, and every primary identity/revision/sequence plus per-row read-back hash is bound to the top receipt and read-back. Every canonical field in the primary affected row must also match the corresponding top read-back field by canonical deep equality, while operation-specific enriched top fields remain allowed. Replay aliases are optional but fail on contradiction. Focused mutation coverage passes 188 tests, broader Local API reliability coverage passes 45 tests, and type-check/lint are green. The SQL receipt migration is implemented as a separate dependency-safe slice; legacy receipts are not accepted as canonical during the transition.

**Reversible production gate**: H3 now has a transaction-owned, idempotent inverse that removes only the five request-hash wrapper signatures, restores the preserved legacy bodies and their exact authenticated/anon/PUBLIC privileges, removes private H3 helpers after wrapper removal, keeps additive receipt columns and committed data intact, and reloads the PostgREST schema. The standard disposable database gate injects an `ALTER FUNCTION` failure after wrapper drops and proves the entire inverse rolls back, then proves inverse replay, executable legacy patch/completion/merge contracts, forward reapplication, and the complete canonical receipt/race suite. No production database was contacted.

### TASK-1962: Preflight every Hermes-to-FlowState route and ship canonical task creation (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-16) | **Depends on**: TASK-1944, TASK-1959, TASK-1961

**Why**: Hermes health and search succeeded while all canonical task-creation previews returned HTTP 404. Live package inspection proved FlowState Electron 1.4.264 was serving an older sidecar bundle with no task lifecycle route even though dirty local source contained the handler. A health-only availability check therefore let work begin against an incomplete runtime and discovered contract drift only at the first blocked mutation.

**Acceptance**:
- The canonical task lifecycle route, handler, database migration, preview/apply validation, receipt verification, exact read-back, idempotency, conflict handling, and legacy-create refusal are committed together on current master history.
- One safe capability contract identifies every Hermes-required Local API method/path family and canonical contract version without exposing tokens, user identity, task content, or private configuration.
- Hermes or the redacted runtime audit compares its required capabilities with the live packaged sidecar before exposing write work and returns a typed contract/version mismatch instead of a late generic 404.
- Source and freshly bundled sidecars execute the Hebrew canonical create preview through real HTTP and prove preview non-mutation; apply, replay, conflicting operation reuse, exact revision-1 read-back, and canonical soft-delete are independently verified with disposable data.
- Electron package validation inspects the bundled sidecar capability contract and fails when a required route/handler is missing, rather than checking only that the sidecar file exists.
- The released Electron version is newer than the installed 1.4.264 runtime, the public updater manifest and artifact are reachable, the installed process uses the delivered bytes, and the real Hermes preview/apply/read-back/delete loop succeeds without a legacy fallback.

**Cleanup plan**: reuse the existing Local API sidecar, truth-ledger provenance, runtime-test harness, and package validator; add no dependency and no parallel server. Keep route capability data in one small contract module, delete disposable test tasks through the same canonical lifecycle, preserve the existing legacy-create rejection, and leave unrelated dirty reliability work untouched.

### ~~BUG-1946~~: Daily regression hunt tests a stale dirty development checkout (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-14)

**User repro**: the 09:30 desktop alert reported `electron-sync-guard: auth/sync` and `2/9` failures immediately after v1.4.252 had passed release CI and packaged UI verification.

**Root cause**: the systemd service ran directly inside the primary checkout. That checkout was v1.4.247, 33 commits behind current master, eight commits ahead locally, and contained an unfinished recurring-task rewrite. One outdated undo test called the new RPC path with a deliberately null Supabase mock; the same test belonged to two packs, so one stale-worktree failure appeared as two release regressions.

**Fix**: the installed service now invokes a stable copied runner. Before each hunt the runner fetches `origin/master`, creates or resets a dedicated detached worktree, removes only that runner's generated and ignored files, installs dependencies into a runner-owned cache keyed by the tested lockfile, package metadata, install patch, platform/architecture, Node ABI/version, and npm version, and writes reports back to the primary checkout. It never resets, cleans, rebases, checks out, or imports dependencies from the user's active development tree.

**Regression and live proof**: the installer contract test failed first because the clean runner did not exist. Review then caught dependency drift and source-only test gaps; RED tests failed until the runner used a runtime-and-install-input-keyed dependency cache and an executable temporary Git remote proved a dirty primary checkout/HEAD remained byte-for-byte untouched, the detached runner advanced to remote master, report arguments targeted the primary report directory, and a notified npm failure propagated its exit code. The final suite passed 12/12. The installed systemd service built the exact-input dependency cache and completed the Tuesday daily hunt 10/10, including the 228-test Electron sync guard, lifecycle durability, live Electron auth/timer diagnostics, updater manifest v1.4.252, and seven timer-flow browser tests.

**Exact failure mode fixed**: local WIP or a stale primary branch being labelled as a regression in the currently shipped/master FlowState code.

**Explicitly not covered**: failures in the dirty development checkout remain developer work and are intentionally preserved; a failing check reproduced in the clean master runner will still notify normally.

### ~~BUG-1944~~: Persisted Electron account renders as a guest while auth validation is pending (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (v1.4.252, 2026-07-14) | **Depends on**: TASK-1797, BUG-1942

**User repro**: after using the PWA, Electron rendered the signed-in account's cached tasks while the footer showed **Sign In**. Hermes/Local API reads and writes succeeded against the account, but the desktop renderer could stay on guest-owned state, so `לשלוח כביסה` and status changes appeared missing.

**Root cause**: Electron loaded account-owned task caches before Supabase's asynchronous `getSession()` completed, but the auth store exposed only `user`/`isAuthenticated`. During that gap the UI labelled the process a guest and task persistence was allowed to write or clear the guest namespace. A failed/slow validation therefore conflated three distinct states: restoring an account, confirmed signed in, and confirmed guest.

**Fix**: startup now peeks the durable primary/backup session for local identity only, exposes an explicit restoring state, and keeps every remote read/write gate closed until auth-js validates the session. Account-owned cache remains visible during restoration; confirmed guest startup and explicit sign-out clear all account stores before loading guest-local data. The Local API bridge receives no session while restoration is pending.

**Regression**: deterministic deferred/rejected `getSession()` tests prove persisted identity appears immediately without enabling remote sync, guest persistence is untouched during restoration, confirmed guests clear account caches, and sign-out clears tasks/projects/lanes/canvas/workspaces. The Electron sync guard passes with these boundaries.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Account cache visible with a false Sign In footer while session validation was delayed. | Yes |
| Data shape / persisted row shape | Yes | Named task row remains valid and was already proven visible after authoritative account reload in BUG-1942. | No change needed |
| Renderer store/state | Yes | Startup previously classified the unresolved state as guest and could load/retain the wrong ownership namespace. | Yes |
| Electron main/preload bridge | Yes | Durable auth primary/backup reads use the existing lazy Electron storage adapter; no token is exposed to the UI. | Yes |
| Localhost sidecar endpoint | Yes | Renderer sends a null Local API session until validation, then the validated account session. | Yes |
| KDE polling/control path | N/A | Task ownership restoration does not use KDE timer polling. | N/A |
| Supabase persistence/realtime | Yes | Auth-js remains authoritative; the durable candidate never enables network operations. | Yes |
| Updater/runtime version | Yes | v1.4.252 Electron package and live updater are required closeout evidence. | Yes |
| Stale live process/cache state | Yes | Confirmed guest/sign-out clears every account store before guest data loads. | Yes |

**Exact failure mode fixed**: an unresolved persisted Electron session being presented and persisted as a confirmed guest during slow or failed startup validation.

**Explicitly not covered**: invalid/revoked credentials still require reconnect or sign-in; continuously visible missed-realtime events remain covered by BUG-1942's Local API and visibility reconciliation paths.

**Live boundary proof**: installed and launched the packaged v1.4.252 AppImage against the real Electron profile. The footer rendered the validated account online rather than a false guest. Search found `לשלוח כביסה`; its actual persisted state was `done`, explaining why the normal **Hide Done** filter concealed it. A Local Task API update restored the requested `todo` / `high` / `2026-07-13` / no-project state, exact API read-back matched, and the already-open Electron search reconciled immediately to `Todo`. Re-enabling **Hide Done** left the task as the single visible result. The public updater manifest serves v1.4.252 and both AppImage/deb range requests return HTTP 206.

### ~~BUG-1945~~: Confirmed Canvas image deletion leaves the image rendered (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (v1.4.252, 2026-07-14)

**User repro**: selecting the WhatsApp screenshot image on Canvas and approving Delete closed the dialog, but the image remained and could not be removed.

**Root cause**: image deletion awaited remote cleanup before updating the canonical local image store. After making that local-first, the store-to-Canvas incremental projection still called Vue Flow's guarded `removeNodes()` for an image node deliberately marked `deletable:false`; Vue Flow silently refused the removal.

**Fix**: confirmed deletion snapshots for undo, removes the canonical image locally, and persists that state synchronously. The backing blob is retained because the undo record contains only its URL; deleting it would make a valid later undo render a broken image. Store projection uses its authoritative replacement path only when a removed node is intentionally non-deletable; normal task/group removal retains the incremental anti-jitter path.

**Regression**: the real Chromium Canvas flow now hard-asserts render, select, lightbox, confirmation, immediate disappearance, local persistence removal, undo restore, and redo removal. Unit coverage proves deletion does not destroy the blob URL that undo must restore.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Approval handler ran and canonical store emptied while the Vue Flow image node remained. | Yes |
| Data shape / persisted row shape | Yes | Image record and id were valid in the dedicated local image store. | No change needed |
| Renderer store/state | Yes | `deletable:false` caused incremental projection removal to be ignored. | Yes |
| Electron main/preload bridge | N/A | Image deletion is renderer/local-store behavior. | N/A |
| Localhost sidecar endpoint | N/A | Canvas images are not Local Task API entities. | N/A |
| KDE polling/control path | N/A | Canvas images do not use KDE integration. | N/A |
| Supabase persistence/realtime | Yes | Image metadata is local-only; the backing blob is retained so undo cannot restore a broken URL. | Yes |
| Updater/runtime version | Yes | v1.4.252 Electron package and live updater are required closeout evidence. | Yes |
| Stale live process/cache state | Yes | Delete/undo/redo assertions cover canonical storage and rendered projection together. | Yes |

**Exact failure mode fixed**: approved deletion of a protected Canvas image node being ignored by Vue Flow's incremental removal guard.

**Explicitly not covered**: generic cable/edge disconnection and software-compositing zoom glitches remain BUG-1912.

**Release proof**: the real Chromium Canvas repro passed delete, persistence removal, undo restore, and redo removal; the packaged v1.4.252 Electron artifact passed validation and the public updater manifest/artifacts are live.

### FEATURE-1943: Hermes-safe recurring `Done for now` (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (2026-07-13) | **Depends on**: TASK-1797, BUG-1942

**Root cause**: the existing renderer action implemented recurrence as several
client writes, while the Local API exposed only task-row PATCH. Updating the
living row to `done` bypassed the completion-history row, recurrence count/date,
next instance, and renderer reconciliation. The API could therefore report a
done task while the UI still resolved the open recurring occurrence.

**Existing call path before the fix**: task context menu → task-store
`doneForNow` → local completion-record construction → queued create/update
writes → Supabase realtime/store reload → Search/Today/Inbox/Canvas filters.
Recurrence date calculation lived in client utilities and the multi-write
sequence was not transactional or retry-safe.

**Canonical call paths after the fix**:
- UI: context menu → task-store `doneForNow` → shared domain adapter →
  `flowstate_done_for_now` transaction → receipt projected locally + realtime.
- Local API: authenticated POST → validation/workspace context → same RPC →
  mutation notice → authoritative affected-ID reload.
- Hermes: dedicated preview-default tool → Local API → explicit approved apply
  with request/preview IDs → exact receipt/read-back.

**Ranked falsifiable hypotheses**:
1. Missing Local API operation — confirmed: no recurring action route existed,
   while the UI had a separate action.
2. Generic completion bypasses occurrence state — confirmed: PATCH touched the
   living task row only and could not create history/advance recurrence.
3. Missing invalidation/subscription — contributing cause: correct external
   mutations could remain hidden after missed realtime; BUG-1942's bridge now
   reloads the exact affected IDs authoritatively.
4. Different identity/storage boundaries — falsified for the reproduced path:
   signed-in Local API and UI use the same user/project; active workspace is now
   explicitly bridged and transactionally enforced.
5. Recurrence calculation only in UI — confirmed as an architectural gap; the
   planner was extracted into the authenticated database transaction rather
   than duplicated in Hermes.

**Acceptance**: zero-write preview; explicit preview-version approval; atomic
history + living-definition advance + exactly-one next instance; stable retry
receipt and typed payload conflict; personal/shared scope; generic PATCH guard;
Search hides history while the living task remains discoverable; Today, Inbox,
and Canvas reconcile without restart; disposable database and Electron proof;
Hermes connector and 24-hour approval-form input; migration/docs/build/release.

**Safety**: the two named real tasks from the report are never mutated. Tests
use rollback-only disposable fixtures and do not print auth/session secrets.

**Completed foundational slices (2026-07-14)**:
- Exact user-scoped task read and search are exposed through the signed-in
  Local API and dedicated Hermes tools; reads remain non-mutating and preserve
  personal/shared-workspace boundaries.
- Recurring `Done for now` uses one atomic, previewable, idempotent transaction
  for completion history, recurrence advancement, and authoritative read-back.
- Duplicate merge uses one conservative, previewable, idempotent transaction;
  incompatible recurrence, dependency, assistant-memory, active-timer, and
  pending-notification cases are rejected instead of guessed.

These foundations do not complete FEATURE-1943: packaged UI reconciliation,
release/deploy proof, and the broader capability slices below remain gated by
their own tests and real-surface verification.

### FEATURE-1944: Hermes-safe work-block move, resize, and remove lifecycle (📋 PLANNED)

**Priority**: P0 | **Status**: 📋 PLANNED (2026-07-14) | **Depends on**: FEATURE-1943

**Outcome**: expose one shared transactional lifecycle for moving, resizing,
and removing a specific task instance/work block. The UI and Local API must use
the same command rather than independently editing embedded instance arrays.

**Acceptance**:
- Preview identifies the exact task/instance, before/after interval, due-date or
  inbox effects, and non-blocking overlap warnings without mutation.
- Apply is atomic, idempotent, scoped to the signed-in user/workspace, and
  rejects stale preview versions, generated recurrence instances, missing
  instances, and conflicting request-ID payloads.
- Move/resize/remove preserves unrelated instances; last-block removal follows
  existing Inbox/Canvas rules and never silently deletes the task.

**Test boundary**: rollback-only database tests cover preview, apply,
idempotency, conflict, authorization, and forced rollback; Local API contract
tests and renderer store tests exercise the same command path.

**UI verification boundary**: Calendar day/week, Today, Search, Inbox, and
Canvas update without restart; moving/resizing/removing one block is visible in
the running signed-in Electron app and does not alter sibling blocks.

### FEATURE-1945: Hermes-safe recurrence chain read and lifecycle editing (📋 PLANNED)

**Priority**: P0 | **Status**: 📋 PLANNED (2026-07-14) | **Depends on**: FEATURE-1943

**Outcome**: expose recurrence definition, occurrence chain, and completion
history reads plus preview/apply commands to edit cadence, pause, resume, or end
a series without rewriting historical occurrences.

**Acceptance**:
- Exact reads distinguish the living recurring definition, completed history,
  current occurrence, and calculated next occurrence.
- Cadence edits, pause/resume, and end-series operations are atomic,
  idempotent, preview-version guarded, timezone-safe, and reject incompatible
  dates or ambiguous current occurrences.
- Editing future recurrence never erases completion history or duplicates the
  next occurrence; explicit next-date overrides obey the recurrence model.

**Test boundary**: planner/domain and rollback-only database tests cover finite
and infinite rules, timezone boundaries, pause/resume/end, retries, stale
previews, conflicts, and transaction failure; connector tests prove preview is
the default and apply requires approval.

**UI verification boundary**: Search remains discoverable, overdue views drop
closed occurrences, and Today/Inbox/Calendar/Canvas show only the appropriate
current or future occurrence without restart.

### FEATURE-1946: Hermes-safe project and group reads and assignment (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (2026-07-14) | **Depends on**: FEATURE-1943

**Outcome**: add exact/list reads for accessible projects and task groups plus
preview/apply assignment and removal commands that preserve workspace scope and
existing project/group invariants.

**Acceptance**:
- Reads return stable IDs and user-visible names only for the authenticated
  personal or active shared workspace.
- Assignment previews show source/destination and downstream visibility effects;
  apply is idempotent and rejects inaccessible, deleted, or cross-workspace
  destinations and stale approvals.
- Project assignment and group membership remain distinct operations; no title
  similarity or null project is treated as identity evidence.

**Test boundary**: API/domain tests cover personal/shared membership, missing or
unauthorized destinations, retries, conflicts, and rollback; Hermes schemas
require exact IDs and approval for writes.

**UI verification boundary**: Project views, group lanes, Search, Inbox, and
Canvas resolve the same assignment immediately in the signed-in running app.

### FEATURE-1947: Hermes-safe timer start, pause, resume, and stop (📋 PLANNED)

**Priority**: P0 | **Status**: 📋 PLANNED (2026-07-14) | **Depends on**: FEATURE-1943, BUG-1868, BUG-1898

**Outcome**: expose the existing timer state machine through authenticated
preview/apply commands while preserving single-session leadership, offline stop
tombstones, elapsed time, and Electron/KDE synchronization.

**Acceptance**:
- Exact current-timer read includes stable session/task state without exposing
  credentials; start/pause/resume/stop previews describe the precise transition.
- Apply is idempotent, leadership-aware, and rejects stale session IDs,
  conflicting active sessions, unauthorized tasks, and reused request IDs with
  different payloads.
- Agent actions cannot create two active sessions, resurrect a stopped timer,
  or bypass reconnect-grace/offline correction rules.

**Test boundary**: timer state-machine, Local API, leadership, retry, offline,
and rollback tests cover Electron and sidecar boundaries; watchdog contracts
detect contradictory active sessions without logging private task content.

**UI verification boundary**: app header, task controls, Calendar, Canvas, and
KDE widget converge on the same timer state without restart or duplicate timer.

### FEATURE-1948: Hermes-safe Canvas read and placement operations (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (2026-07-14) | **Depends on**: FEATURE-1944, FEATURE-1946, BUG-1899

**Outcome**: expose bounded Canvas reads and preview/apply commands to move a
task, group/ungroup selected tasks, and remove placement without deleting the
underlying task or bypassing Canvas write ordering.

**Acceptance**:
- Reads return bounded user-scoped placement/group state with stable IDs and a
  revision suitable for preview conflict detection.
- Apply uses exact task/group IDs, preserves locked/group geometry invariants,
  is idempotent, and rejects stale revisions or cross-workspace selections.
- Removing Canvas placement leaves the task discoverable; grouping never
  merges task identity or work-block history.

**Test boundary**: domain/store tests cover geometry, group membership, locked
groups, stale revisions, retries, undo, and rollback; Local API and Hermes tests
prove bounded reads and approval-gated writes.

**UI verification boundary**: the running Canvas reflects move/group/ungroup/
remove immediately, while Search, Today, Inbox, and Calendar retain consistent
task identity and work-block state.

### FEATURE-1949: Complete bounded Hermes task/context capability surface (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (2026-07-14) | **Depends on**: FEATURE-1944, FEATURE-1945, FEATURE-1946, FEATURE-1947, FEATURE-1948

**Outcome**: close the remaining safe capability-matrix gaps: cursor pagination,
soft-delete restore, bounded batch actions, and exact context/audit reads using
the same authenticated, preview-first, idempotent command substrate.

**Acceptance**:
- List/search endpoints use stable cursors and deterministic ordering with
  explicit limits; no unbounded task, history, Canvas, or audit dumps.
- Restore and batch writes preview every affected stable ID, reject mixed
  workspace/authorization scope, apply atomically where product semantics
  require it, and return per-item receipts where partial success is intended.
- Context/audit reads expose user-visible facts and mutation receipts only;
  secrets, auth state, hidden prompts, and unrelated users' content remain out
  of scope.

**Test boundary**: pagination stability, batch retry/conflict/rollback, restore,
authorization, redaction, and connector approval tests run at the real shared
data seam; the capability matrix maps every exposed tool to its domain command.

**UI verification boundary**: restored and batched tasks reconcile in Search,
Today, Inbox, project/group views, Calendar, and Canvas without restart; audit
receipts match visible state and a packaged build smoke proves the running seam.

### ~~BUG-1942~~: Cross-runtime task writes can stay absent from Electron after missed realtime (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (v1.4.250 shipped and verified, 2026-07-13) | **Depends on**: TASK-1797

**User repro**: Hermes patched task `f4658470-fa2f-41e0-ac20-867750278e92` (`לשלוח כביסה`) from due date 2026-07-12 to 2026-07-13. Local API PATCH returned `{ ok: true }` and Local API GET returned the new date, but the running Personal-workspace UI could not find the task in global Search or Inbox.

**Evidence so far**: the production row is non-deleted, personal-workspace, `is_in_inbox=true`, `status=planned`, `priority=high`, due 2026-07-13, with no project or canvas position. A cold Electron restart loaded the same unchanged row and immediately rendered it in Canvas Inbox. This rules out persisted shape, workspace scope, project/status/date filters, and stale updater version for the reported incident. The remaining confirmed failure class is the missing deterministic sidecar-to-renderer reconciliation after a successful mutation; current code relies entirely on Supabase Realtime.

**Acceptance**:
- A successful Local Task API create/update/delete emits a non-secret mutation notice from sidecar to Electron main and the renderer.
- The renderer invalidates task read cache and reloads the active workspace so the mutation becomes visible even when realtime delivery is missed.
- Mutation notices contain only operation and task id; no task body, bearer token, session, or Supabase credentials.
- Regression proves the Local API→main→preload→renderer reconciliation contract and the exact missed-realtime recovery shape.
- The named task remains visible in the real Electron UI after an API mutation without restarting the app.

**Shipped evidence**: v1.4.249 adds the explicit sidecar → Electron main → preload → renderer mutation signal and reloads the active task store after successful Local API writes. The focused Local API regression pack passes 41/41, the Electron sync guard passes 221/221, type-check/lint/import/CSS/dependency validation pass, the Electron package validates, and the live updater manifest serves v1.4.249 with both artifacts. The full suite passed 3,279 tests and failed one unrelated pre-existing AI weekly-planning assertion, which also fails alone. The exact named-task post-fix mutation check remains pending because the local Electron profile became signed out after installing the package; the sidecar correctly rejected the attempted write before changing production data.

**Recurrence/root cause (2026-07-13)**: the named task was created in the PWA, not through the Local API. Its production row and Electron's exact Supabase query were correct, but global Search proved it was absent from the renderer store. A no-op Local API PATCH then triggered the v1.4.249 bridge, reloaded authoritative data, and made the task visibly appear in Search and Canvas Inbox without restarting. This proves the remaining gap was a missed PWA realtime event while the channel still reported `joined`; visibility recovery previously reloaded only when the channel reported dead. v1.4.250 reconciles authoritative data on a genuine visible resume even for a healthy-looking channel, while retaining edit-modal protection and a bounded refresh cooldown, with a regression for the exact missed-PWA-event shape.

**Final live proof**: the public updater serves v1.4.250 and both Linux artifacts. The installed signed-in Electron v1.4.250 displayed `לשלוח כביסה` in Canvas Inbox. A Local API status change to done removed it immediately and decremented Today/All Active/Inbox; restoring `{ status: todo, progress: 0 }` made it immediately reappear with the original due date. No restart was used between status transitions.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | PWA-created `לשלוח כביסה` existed in API/DB but not Electron Search or Inbox; Hermes status transitions were replayed live. | Yes |
| Data shape / persisted row shape | Yes | Correct owner, personal workspace, planned/high, due 2026-07-13, inbox true, non-deleted. | No change needed |
| Renderer store/state | Yes | Exact global Search returned no result until authoritative reload; sidebar counts changed with the reload. | Yes |
| Electron main/preload bridge | Yes | v1.4.249 Local API mutation signal made the task appear without restart. | Yes, Local API writes |
| Localhost sidecar endpoint | Yes | Authenticated GET returned the row; reversible status PATCH calls returned 200 and changed visible Electron state. | Yes |
| KDE polling/control path | N/A | Task visibility does not use KDE timer polling/control. | N/A |
| Supabase persistence/realtime | Yes | Electron's exact Supabase query included the row while a healthy-looking realtime channel had missed it. | Yes, visible-resume backstop |
| Updater/runtime version | Yes | Installed v1.4.250 and public manifest/artifacts verified. | Yes |
| Stale live process/cache state | Yes | Authoritative reload recovered the row and corrected stale counts without restart. | Yes |

**Exact failure mode fixed**: PWA task INSERT/UPDATE events missed while Electron realtime still reports `joined`, plus direct Local API mutations in the running Electron process.

**Explicitly not covered**: a continuously visible Electron window that never receives a visibility-resume event still depends on realtime or a Local API mutation; KDE timer sync and unrelated task-filter semantics are outside this fix.

**Regression added for reported repro**: a healthy joined channel must still invoke authoritative reconciliation after Electron returns to visible state; the existing Local API bridge regression covers direct Hermes mutations.

**Live boundary proof**: signed-in packaged Electron v1.4.250 visibly removed the named task on `todo → done` and restored it on `done → todo` through Local API PATCH, with the production row restored to todo/progress 0.

### ~~BUG-1907~~: Quick Tasks typed pin can look like a no-op (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-03, prepared for Electron updater v1.4.229; VPS upload pending explicit approval) | **Opened**: 2026-07-03

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | typed Quick Task pin clicked from the visible create row | ✅ component regression: quick-task-dropdown-pin.test.ts |
| Data shape / persisted row shape | ✅ | existing task vs new task vs pinned task are distinct outcomes | ✅ `PinTaskResult` contract |
| Renderer store/state | ✅ | `pinTask()` previously returned `undefined` for no-op branches | ✅ explicit statuses + visible feedback |
| Electron main/preload bridge | ✅ | renderer-only task action; no bridge change | N/A |
| Localhost sidecar endpoint | ✅ | not involved | N/A |
| KDE polling/control path | ✅ | not involved | N/A |
| Supabase persistence/realtime | ✅ | task create/update paths unchanged | ✅ existing store APIs still own writes |
| Updater/runtime version | ✅ | desktop-facing renderer change built as v1.4.229; live manifest still 1.4.228 until VPS upload is approved | pending deploy |
| Stale live process state | ✅ | old build keeps old silent behavior until update | noted |

**Exact failure mode fixed**: the header Quick Tasks create row no longer silently clears/refocuses or appears inert when `pinTask()` hits an existing pinned task, existing unpinned task, unauthenticated state, or create failure. `pinTask()` now returns an explicit result and `QuickTaskDropdown` surfaces no-op/error states with toasts.
**Explicitly not covered**: KDE widget Quick Task controls and broader pinned-task sync behavior; this fix is limited to the Electron/web header dropdown pin-create path.
**Regression added for reported repro**: `tests/unit/composables/useQuickTasks-dismiss.test.ts` result-contract cases and `tests/unit/components/quick-task-dropdown-pin.test.ts` visible create-row click path.

### ~~BUG-1897~~: Stopped timer resurrects on app + KDE when remote save fails (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-02, v1.4.227, commit 3f94f8d5) | **Opened**: 2026-07-02

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | stop → failed save → poll re-adopts within 15s | ✅ regression: timer-stop-durability.test.ts (a) |
| Data shape / persisted row shape | ✅ | timer_sessions row stays is_active=true on failed save | ✅ correction op enqueued (is_active=false) |
| Renderer store/state | ✅ | completedSessionIds guard added to poll adoption + stale-leader claim (useTimerSync.ts) | ✅ |
| Electron main/preload bridge | ✅ | unchanged; snapshot push unchanged | N/A (no bridge change needed) |
| Localhost sidecar endpoint | ✅ | 15s inactive grace then Supabase fallback | ✅ indirectly — server row now corrected via queue |
| KDE polling/control path | ✅ | KDE re-adopted via sidecar Supabase fallback | ✅ indirectly (server correction); KDE code unchanged |
| Supabase persistence/realtime | ✅ | Realtime path already had BUG-1318 guard | ✅ poll now mirrors it |
| Updater/runtime version | ✅ | fix ships v1.4.227 | pending user update/restart |
| Stale live process state | ✅ | running v1.4.226 keeps old behavior until restart | noted |

**Exact failure mode fixed**: follower-poll re-adoption (normal + stale-leader-claim branches) of a session this device already stopped, and the missing durable is_active=false correction when the direct save fails.
**Explicitly not covered**: another device legitimately re-starting the same task (new session id — unaffected by design); sidecar restart mid-window (falls back to corrected server row once queue drains).
**Regression added for reported repro**: tests/unit/stores/timer-stop-durability.test.ts (5 tests).
**Live boundary proof** ✅ (2026-07-03, v1.4.228 running live): CDP probe — renderer adopted active session → network blackholed (CDP offline) → stopTimer cleared local → rode a full 18s follower-poll cycle STILL offline with NO resurrection (isActive:false, hasSession:false) → network restored → queued is_active=false correction drained → sidecar `/api/timer/current` returned `{"active":false,"session":null}`. Exact goal success condition met on the shipped build.

Regression from 196b171a: `stopTimer` clears local state first and swallows remote-save failure (`timer.ts:444-446`), leaving `timer_sessions.is_active=true`. The follower poll adoption path (`useTimerSync.ts:215-248`) has no `completedSessionIds` guard (only the Realtime path does, `:378`) and `stopTimer` resumes that poll — a stopped timer re-adopts within ~15s on the Vue app, and KDE re-shows it after the sidecar's 15s inactive grace falls back to Supabase. BUG-1892 class via the stop path. Fix: guard poll adoption (normal + stale-leader-claim branches) with `completedSessionIds`, and enqueue a durable `is_active=false` correction when the direct save fails.

### ~~BUG-1898~~: Timer stop lost during auth reconnect-grace; grace unbounded (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-02, v1.4.227, commit 3f94f8d5) | **Opened**: 2026-07-02

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | stop during grace → neither saved nor queued | ✅ regression: timer-stop-durability (grace test) |
| Data shape / persisted row shape | ✅ | server row stays is_active=true through grace | ✅ stop enqueued whenever user exists; queue's auth gate defers drain |
| Renderer store/state | ✅ | grace lifecycle centralized (enter/clearOfflineGrace); reauthRequired exposed | ✅ auth-grace-bound.test.ts (4 tests) |
| Electron main/preload bridge | ✅ | unchanged | N/A |
| Localhost sidecar endpoint | ✅ | KDE polls Supabase past 15s grace | ✅ via queued correction after auth recovery |
| KDE polling/control path | ✅ | same as above | ✅ indirectly |
| Supabase persistence/realtime | ✅ | a49cf3f1's direct-write gate PRESERVED (no RLS-failing writes) | ✅ |
| Updater/runtime version | ✅ | ships v1.4.227 | pending restart |
| Stale live process state | ✅ | old build unbounded-grace until update | noted |

**Exact failure mode fixed**: stop-op dropped during reconnect-grace (userId gated on canSyncRemotely) + grace period with NO recovery on some entry paths and NO upper bound (dead refresh token = silent permanent write-block).
**Explicitly not covered**: UI surface for `reauthRequired` (flag is exposed and set; a banner/prompt wiring is follow-up UX).
**Regression added for reported repro**: tests/unit/stores/auth-grace-bound.test.ts + grace test in timer-stop-durability.test.ts.
**Live boundary proof**: post-deploy verification with updated build.

`timer.ts:453` nulls userId when `canSyncRemotely` is false, so a stop during reconnect-grace is neither saved nor queued — KDE (polls Supabase directly) shows the timer active indefinitely. Independently, the grace period (`auth.ts`) only clears on a successful refresh: refresh exhaustion while online neither reschedules nor surfaces re-auth, so a dead refresh token write-blocks the app until restart. Fix: always enqueue the stop (queue drains after auth recovers) while keeping the direct-write gate from a49cf3f1; bound the grace with an explicit re-auth state.

### BUG-1899: Canvas group echo-stomp + dual-writer LWW discards (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (4 failure modes fixed 2026-07-02; residual boot-race documented below) | **Opened**: 2026-07-02

**Fixed (unit-tested, probe-verified)**: (1) version-0/NULL creation echoes bypassed the guard and stomped positions (`canvasGroups.ts` total-order version guard); (2) equal-version echoes with drain-time server timestamps applied stale geometry (geometry version-authority: only strictly newer versions may move a group; metadata still merges); (3) `createGroup` was a DOUBLE remote writer (own enqueue + `saveGroupToStorage`'s second create op) — mirror of updateGroup's `!queued` guard; (4) `loadFromDatabase` wiped freshly-created groups absent from the server result (`preserveRecentLocalGroups`, 10min pending-create grace). Also: `useNodeSync` no longer writes Supabase directly — geometry routes through the store single-writer (`node-sync-single-writer.test.ts`).

**Explicitly NOT covered (architecture question)**: full serialization of boot-time canvas load vs user mutations. Group state still has 5+ writers (`updateGroup`, `updateGroupFromSync`, two internal `setGroups` call sites, `removeGroupFromSync`) and a group-side LWW writeback is absent. Recorder probes show residual Tidy-spec flake (~1 in 4 isolated runs) when Tidy fires while the initial load is mid-flight — groups tidied against a partial store. Fix direction: gate canvas mutations until first load settles, or replace wholesale `setGroups` with a keyed merge. DEV diagnostic added: `[SETGROUPS-DIAG]` logs dropped ids + caller stack.

Two mechanisms in one subsystem (BUG-1799 residue): (a) group realtime applies have no self-echo/version guard — creation/update echoes (~0.2-2s later) stomp store positions written in between; probe-proven as the cause of flaky Tidy "3 rows" (BUG-1782 recurrence) and "group move doesn't stick". (b) `useNodeSync.ts:183-255` writes geometry directly with a private version map that queue writes never update → NODE-SYNC conflict loops + `LWW: Server wins... DISCARDED` (3.5-4.7s deltas) losing user edits/parent changes. Fix: single-writer geometry path or shared version source + echo guards at group apply (task parity).

### ~~BUG-1900~~: Group resize silently ignores lock acquire failures (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-02, v1.4.227, commit 8652b581) — fixed: resize acquires via LockManager.acquireOrAdopt (adopts stale user-drag locks when no drag live; excludes actively-locked children; aborts on locked group). Regression: tests/unit/canvas/lock-manager-resize-adopt.test.ts. Kills the live `[LockManager] Unauthorized release attempt` wall + resize snap-backs. | **Opened**: 2026-07-02

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | live console wall: `Unauthorized release attempt … by user-resize (owned by user-drag)` during group resize | ✅ acquireOrAdopt + child exclusion |
| Data shape / persisted row shape | ✅ | no row change — lock state is in-memory only | N/A |
| Renderer store/state | ✅ | BUG-1492 stale-handler skip leaks 15s user-drag locks; resize ignored acquire() result | ✅ adopt-if-no-drag / exclude-if-drag |
| Electron main/preload bridge | ✅ | not involved | N/A |
| Localhost sidecar endpoint | ✅ | not involved | N/A |
| KDE polling/control path | ✅ | not involved | N/A |
| Supabase persistence/realtime | ✅ | downstream effect only (rejected updates → later sync snap-back) | ✅ children now actually locked during resize |
| Updater/runtime version | ✅ | shipped v1.4.227/228 | user on 1.4.228 ✅ |
| Stale live process state | ✅ | pre-update builds keep old behavior | resolved by user's 1.4.228 restart |

**Exact failure mode fixed**: silent acquire() failure at resize-start + asymmetric release. **Explicitly not covered**: the underlying BUG-1492 stale-handler lock leak itself (locks still auto-expire at 15s; adoption papers over it) — belongs to the BUG-1899 write-path architecture follow-up.

`onSectionResizeStart` ignores `lockManager.acquire()` returning false (`useCanvasInteractions.ts:1035,1040`); children still holding 15s `user-drag` locks (incl. leaks via the BUG-1492 stale-handler skip at `:966-988`) reject resize position updates in PositionManager, diverge visually, and snap back on next sync. Produces the live `[LockManager] Unauthorized release attempt` console wall. Fix: force-adopt stale drag locks when no drag is active, else exclude the child from the resize set so release stays symmetric.

### ~~BUG-1901~~: Due-date edit leaves stale calendar instance; +1mo anchors on today (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-02, v1.4.227, commit 616ad4e5) — fixed: (a) non-recurring tasks with dueDate newer than a stale PAST instance show the dueDate (recurring keep BUG-1810 instance authority); (b) +Nmo anchors on current due date; (c) TZ-safe currentDueDateLabel. Regressions: dueStatus.spec.ts (user repro as test), due-date-submenu-month-offset.test.ts. Precise label: fixed badge/anchor/format paths — the edit still does not MOVE the stored instance (calendar view placement unchanged by design). | **Opened**: 2026-07-02

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | screenshot 2026-07-02: card "Overdue Jul 1" while menu shows Aug 2 | ✅ dueStatus.spec.ts encodes it |
| Data shape / persisted row shape | ✅ | stale `instances[]` entry + newer `dueDate` on same task | ✅ badge rule; instance intentionally NOT moved |
| Renderer store/state | ✅ | both surfaces read same store — split was field-level, not staleness | ✅ |
| Electron main/preload bridge | ✅ | not involved | N/A |
| Localhost sidecar endpoint | ✅ | not involved | N/A |
| KDE polling/control path | ✅ | not involved | N/A |
| Supabase persistence/realtime | ✅ | ruled out (LWW logs were a separate issue — BUG-1899) | N/A |
| Updater/runtime version | ✅ | shipped v1.4.227/228 | ✅ |
| Stale live process state | ✅ | old build until restart | resolved |

**Exact failure mode fixed**: badge/anchor/format paths for one-off tasks. **Explicitly not covered**: reconciling (moving/clearing) the stored calendar instance on due-date edit — calendar-view placement of the stale instance is unchanged by design; revisit if users report calendar-side confusion.

User repro (2026-07-02 screenshot): card badge shows "Overdue Jul 1" forever while context menu shows the updated date. Badge derives from calendar `instances[]` (`dueStatus.ts:29-63`, authoritative per BUG-1810); menu reads `task.dueDate`; the due-date edit (`TaskContextMenu.vue:473-477`) only moves `dueDate` for non-calendar tasks, never reconciling the stale instance. Also `+1mo` (`DueDateSubmenu.vue:175-180`) does `setMonth(+1)` from today (Jul 2 → Aug 2, not Aug 1), and `currentDueDateLabel` (`TaskContextMenu.vue:419,429`) is the only TZ-sensitive due-date formatter. Fix: reconcile/clear the stale representative instance on due-date edit, anchor +1mo on the current due date, harden the formatter.

### ~~BUG-1902~~: Saved canvas viewport never applied at startup (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-02, v1.4.227, commit 616ad4e5) — fixed: saved viewport applied via setViewport once load+paneReady settle; recovery waits for the apply (without consuming render attempts); heal persists unconditionally post-pan; chosen viewport reconciled to localStorage+cloud. Heal E2E 3/3 (was 0/N). Gotcha recorded: consoleFilter.ts suppresses [NAV]/[ORCHESTRATOR] logs — masked this for weeks. | **Opened**: 2026-07-02

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | canvas always reopened at origin regardless of saved viewport (probe: transform stayed translate(0,0)) | ✅ canvas-viewport-restore.spec.ts |
| Data shape / persisted row shape | ✅ | localStorage vs cloud (user_settings.canvas_viewport) could diverge; cloud wins on load | ✅ chosen value reconciled to both |
| Renderer store/state | ✅ | :default-viewport captured pre-load; no setViewport call existed anywhere | ✅ applySavedViewportOnce on load+paneReady |
| Electron main/preload bridge | ✅ | not involved | N/A |
| Localhost sidecar endpoint | ✅ | not involved | N/A |
| KDE polling/control path | ✅ | not involved | N/A |
| Supabase persistence/realtime | ✅ | cloud copy is preferred source on load | ✅ reconcile keeps stores converged |
| Updater/runtime version | ✅ | shipped v1.4.227/228 | ✅ user-confirmed live (canvas restored zoomed-out after re-login) |
| Stale live process state | ✅ | old build until restart | resolved |

**Exact failure mode fixed**: apply-never-happens + heal-unreachable + stale-localStorage-divergence. **Explicitly not covered**: transient empty canvas while data hydrates after login (render lag, not viewport — BUG-1899 boot-load residual).

Probe-proven: no code ever calls Vue Flow `setViewport` — the saved viewport is only wired via one-shot `:default-viewport`, which initializes before async `loadSavedViewport()` resolves. Canvas always opens at origin; the d78dfa54 heal-persist step is unreachable (recovery early-returns when origin shows content). Fix: apply the loaded viewport via `setViewport` on pane-ready, then run recovery; heal test goes green as a side effect. Note: `consoleFilter.ts` suppresses `[NAV]`/`[ORCHESTRATOR]` logs — masked this for weeks.

### ~~BUG-1903~~: Mobile deep-links stomped by /tasks default on mount (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-02, v1.4.227, commit 616ad4e5) — fixed: MobileLayout awaits router.isReady() before the /tasks default (main.ts mounts before initial route resolution; beforeEach awaits auth init). mobile-timer E2E 7/7 (was 0/7); mobile-today 7/7 serial. Affects real PWA reload/deep-link, not just tests. | **Opened**: 2026-07-02

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | ✅ | every mobile deep-link/reload (/#/timer, /#/today) landed on /tasks | ✅ mobile-deeplink-survives.spec.ts (3/3) |
| Data shape / persisted row shape | ✅ | no data involved — pure routing | N/A |
| Renderer store/state | ✅ | route was unresolved '/' at MobileLayout mount → replace('/tasks') stomped deep-link | ✅ awaits router.isReady() |
| Electron main/preload bridge | ✅ | mobile PWA path; Electron unaffected | N/A |
| Localhost sidecar endpoint | ✅ | not involved | N/A |
| KDE polling/control path | ✅ | not involved | N/A |
| Supabase persistence/realtime | ✅ | not involved (auth-init await was the delay source, not a data issue) | N/A |
| Updater/runtime version | ✅ | web PWA ships with next master deploy; Electron v1.4.227/228 | ✅ |
| Stale live process state | ✅ | old PWA SW until refresh | standard SW update cycle |

**Exact failure mode fixed**: /tasks default racing initial route resolution. **Explicitly not covered**: none known — all mobile routes go through the same gate.

`MobileLayout.vue:343-347` replaces to `/tasks` when the route is `/` at mount — but `main.ts` never awaits `router.isReady()` and the router `beforeEach` awaits auth init, so the layout always mounts while the initial route is still unresolved `/`. Every mobile reload/deep-link (`/#/timer`, etc.) lands on Tasks. Root cause of all 7 mobile-timer E2E failures + mobile-core-flows. Fix: await `router.isReady()` before the default redirect (or move the default into the router config).

### ~~TASK-1904~~: Test-suite truthfulness sweep after July 2 regression hunt (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-02, commits a0111a60 + 9d37edc2) — unit suite 3113/3113 green (was 17 failing); chromium E2E 22 failures → 5, all five verified worker/order interference on the shared test user (pass isolated/serial; tracked TASK-1906). AI-chat specs pending rewrite = TASK-1905. PERMA-DELETE-TRACE gated behind DEV. | **Opened**: 2026-07-02

All 17 failing unit tests are stale, not product bugs: 7 AI date-bombs (fixed June-2026 fixtures vs real `Date.now()` 7/14-day windows — need fake clocks/injectable now), 4 rollback/offline tests asserting pre-hardening boundaries (update mocks: auth store, `getSession`, leaked `mockResolvedValueOnce`), 2 rate_limit assertions (flip to new classification, add cooldown regression), 2 mobile-Today tests missing Pinia (ordering currently untested), canvas-substrate (assert `syncOrchestrator.enqueue`), electron-builder (match wrapper script). E2E: fix invalid multi-tab delete selector (comma-in-regex swallowed by `.catch(()=>false)` — never clicked Delete; product verified healthy), delete dead specs (morning-dashboard ×16, debug-workspace, tauri-simulation project), rewrite or pend 19 AI specs targeting removed `/#/ai` full-page view (d0f90130 sidebar), fix sync-system hardcoded port 5546. Gate `PERMA-DELETE-TRACE` (`permanentDeleteTrace.ts:49`) behind DEV.

### ~~BUG-1908~~: KDE widget Today list hides tasks the app's Today shows (instances-before-scheduled_date) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-03, shipped in the v1.4.229 release; QML itself is delivered via the repo→plasmoid symlink + plasmashell reload, NOT the Electron updater) | **Opened**: 2026-07-03

**User repro**: KDE Plasma widget doesn't show all the tasks that show in the main Electron app. Live widget config (`plasma-org.kde.plasma.desktop-appletsrc`): `todayOnly=true` against production `https://api.in-theflow.com` — so the comparison surface is the widget's Today list vs the app's Today smart view.

**Root cause (code divergence, precise)**: `taskMatchesToday()` in `packages/kde-widget/contents/ui/main.qml` checks calendar `instances[]` BEFORE `scheduled_date` and returns `false` terminally when instances exist but none is today. The Vue side (`useSmartViews.isTodayTask`, `src/composables/useSmartViews.ts:77`) was explicitly fixed to check `scheduledDate` BEFORE instances ("Today must include tasks explicitly scheduled for the day even when stale calendar instances exist"). The widget never got that fix → a task scheduled for today that carries stale calendar instances shows in the app's Today but silently vanishes from the widget. Related data-shape context: date edits don't move stale instances (regression-hunt 2026-07 item 5), so stale-instance rows are a real population.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Live widget config `todayOnly=true` (appletsrc) vs app Today; parity test on scheduled-today + stale-instances row RED→GREEN | Yes |
| Data shape / persisted row shape | Yes | `instances` jsonb camelCase `scheduledDate` verified against mappers + initial schema; stale past instances are a real prod population (BUG-1901/1909 lineage) | Yes (ordering) |
| Renderer store/state | N/A | Vue `isTodayTask` untouched — it is the reference side of the parity test | — |
| Electron main/preload bridge | N/A | Widget fetches tasks from Supabase REST directly | — |
| Localhost sidecar endpoint | N/A | Sidecar serves timer only; task list never touches :5577 | — |
| KDE polling/control path | Yes | `fetchTasks()` URL audited — limit caps + `neq.done` NULL exclusion found | No — listed below |
| Supabase persistence/realtime | Partial | REST query semantics audited; no mutation involved | No (NULL-status class) |
| Updater/runtime version | Yes | Plasmoid dir symlinks to the repo working tree — Electron updater irrelevant for QML | Yes after reload |
| Stale live process/cache state | Yes | qmlcache can serve stale compiled QML; needs `rm -rf ~/.cache/plasmashell/qmlcache/*` + plasmashell restart (user declined mid-session; command provided) | Pending reload |

**Exact failure mode fixed**: today-filter parity — `scheduled_date`/instances ordering in the widget's `taskMatchesToday`.
**Regression added for reported repro**: `tests/unit/kde/today-filter-parity.test.ts` extracts the live QML date/filter functions and compares them against Vue `useSmartViews().isTodayTask()` for the stale-instance scheduled-today row.
**Live boundary proof**: widget runs the repo QML via symlink — live after plasmashell reload (pending user action). Prod REST probe of the exact widget query was prepared but denied by the permission gate (production reads need explicit approval); probe script retained in session scratchpad.

**Explicitly not covered** (other classes that can also make the widget show fewer tasks):
- Non-today mode fetch cap `limit=100` (`fetchTasks()`), app has no such cap — >100 non-done tasks truncate oldest-first.
- Today-mode fetch cap `limit=1000`.
- `status=neq.done` excludes NULL-status rows in PostgREST (schema CHECK permits NULL); app maps/shows them.
- Widget sync silently stopping (token-refresh class, BUG-1490 lineage) — makes *new* tasks missing until restart.

### BUG-1910: Canvas groups disappeared after restart into v1.4.229 (BUG-1899 boot-load class recurrence) (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (needs prod-data confirmation) | **Opened**: 2026-07-03

User restarted the desktop app (~11:49, verified running genuine v1.4.229 via asar-root package.json — earlier "1.4.226" readings were a probe artifact matching the cosmetic nested `dist-electron/package.json`) and "almost all the groups disappeared again". This is the BUG-1899 boot-load serialization residual class (canvas group state has 5+ writers — open architecture follow-up from the 2026-07-02 hunt). Renderer log (`~/.config/flow-state/logs/renderer.log`) is stale since May 18 — no live evidence; distinguishing renderer-state loss from DB data loss requires read-only prod queries (user approval pending). Recovery options if DB rows lost: Settings > Storage backups, VPS nightly dumps.

### ~~BUG-1911~~: Deleted calendar events "resurrect" (2026-07-03, on v1.4.229) (✅ RESOLVED AS DUPLICATE → BUG-1913)

**Priority**: P0 | **Status**: ✅ RESOLVED AS DUPLICATE of BUG-1913 (2026-07-03, prod-data proven) | **Opened**: 2026-07-03

User: "events I deleted are returning for no reason" (both calendar blocks AND whole tasks). **Prod DB forensics (read-only, user-approved) disproved resurrection**: zero alive-with-tombstone rows, zero undelete flips (`is_deleted=false AND deleted_at IS NOT NULL`), only 1 task created today (legit user add), 3 tombstones (11:52 local, persisted fine). Nothing was resurrected server-side — the afternoon **deletions never reached the database** (silent write-drop windows, see BUG-1913). BUG-1909's reconcile write was initially suspected but is exonerated by the same evidence: no writes at all landed during the affected windows.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | "Deleted events return" reproduced as lost-write, not resurrection — prod histogram dead windows align with reports | Reclassified → BUG-1913 |
| Data shape / persisted row shape | Yes | 0 alive-with-tombstone, 0 undelete flips, 1 created-today, 3 tombstones (morning only) | N/A — no bad data to fix |
| Renderer store/state | Partial | Client showed deletions applied locally then re-synced server truth | BUG-1913 scope |
| Electron main/preload bridge | Not checked | — | BUG-1913 scope |
| Localhost sidecar endpoint | N/A | Task CRUD doesn't use :5577 | — |
| KDE polling/control path | N/A | Not involved | — |
| Supabase persistence/realtime | Yes | Server never received the writes; nothing to resurrect | N/A |
| Updater/runtime version | Yes | Genuine v1.4.229 confirmed via asar-root package.json | N/A |
| Stale live process/cache state | Partial | Old instance killed/relaunched during window; write silence spans both | BUG-1913 scope |

**Exact failure mode fixed**: none — no product change; report reclassified as duplicate of BUG-1913 (silent write-drop). No "resurrection" fix should be built from this report.
**Explicitly not covered**: everything in BUG-1913 (the actual write-drop root cause, still open).
**Regression added for reported repro**: none here — belongs to BUG-1913 once the drop mechanism is isolated.
**Live boundary proof**: read-only prod queries 2026-07-03 (counts above; write sentinel `max(updated_at)`=11:34:46Z during active use).

### BUG-1913: Silent write-drop windows — task edits/deletions vanish without error, then server truth "resurrects" them (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (root-cause isolation needs live repro) | **Opened**: 2026-07-03

**Prod evidence (read-only queries, user-approved, all times local=UTC+3)**: user's task-write histogram for 2026-07-03 shows activity 10-12h (22 writes incl. 3 persisted deletions at 11:52), a **dead window 12:00-13:00 (0 writes)** matching the "dates not fixed / groups gone" reports, sparse 13-14h (2), burst 14:00-14:34 (34), then **total silence after 14:34:46** while the user was demonstrably interacting (edge-drag attempts at 14:31+, deletions that later "returned"). Nothing the user did in dead windows produced tombstones, soft-deletes, or updates — the client dropped writes silently and later re-synced server truth (perceived as resurrection, BUG-1911).

**Candidate mechanisms (Phase-1 shortlist, not yet isolated)**:
1. Auth reconnect-grace write-gating — BUG-1898 added GRACE_MAX_MS=10min + reauthRequired prompt, but dead windows exceeded 60min with no re-login prompt reported → either grace re-enters cyclically (each entry resets the deadline), the prompt UI never surfaces, or the gate is entered without the BUG-1898 path.
2. Task writes failing (401/RLS/network) and being swallowed without enqueue — TASK-1177 offline queue is half-built; hunt 2026-07 item 2 documents skip-both-save-AND-enqueue during grace for the timer stop path; task CRUD path needs the same audit.
3. Realtime/visibility retry storms (BUG-1799 lineage) starving the write path in Electron.

**Next steps**: reproduce with live client + `max(updated_at)` sentinel probe; audit useSupabaseDatabase error paths for silent catch; verify reauthRequired actually reaches a visible UI in Electron; add a write-outcome toast/telemetry so dropped writes are USER-VISIBLE (defense regardless of root cause).

**2026-07-03 evening update (v1.4.231)**: mechanism chain isolated in code and two links fixed:
1. `processQueue` auth-gate (`useSyncOrchestrator.ts`) skipped SILENTLY (debug-only log) whenever `supabase.auth.getSession()` had no session — with a dead session under the BUG-1874 signed-in shell, the queue stranded forever behind a green/amber indicator. **Fixed**: ≥2 consecutive auth-gate skips with pending operations now set queue status `error` + `lastError` ("Sign-in expired — …sign in again") and report into writeHealth (red indicator + toast). Never touches RLS. Regression: `sync-orchestrator.test.ts` "BUG-1913: repeated auth-gate skips…".
2. `reauthRequired` (BUG-1898's 10-min grace cap) had **zero UI consumers** — the cap fired into the void. **Fixed**: setting it now also fires a direct 15s error toast telling the user to sign out/in.
Live evidence same evening: user's fresh v1.4.230 session showed amber "2 pending" stuck; prod sentinel `max(updated_at)` frozen at 11:34Z for 3+ hours; upgraded watchdog fired `write-gap … 192min` on first run. **Still open**: WHY the session dies under the shell (suspect: multi-instance refresh-token rotation collisions from today's parallel app instances), and recovery UX (re-login currently manual).

**2026-07-04 00:19 — recovery confirmed end-to-end**: user signed out/in after a ~9.5h stranded-queue window (watchdog logged the gap up to 565min); 33 queued task writes flushed to prod within seconds of re-auth (sentinel `max(updated_at)` jumped to 21:19:33Z). Mechanism chain fully validated: dead session under signed-in shell → silent queue strand → re-auth → immediate flush. Remaining: session-death root cause + refresh-free recovery UX (BUG-1918).

### ~~TASK-1914~~: VPS DB write-watchdog — cron invariant checks + alerts (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-03 — installed on VPS, cron `*/15min`, first run OK: `manifest=1.4.229 last_write_age_min=48`; alerts → ntfy.sh topic `flowstate-watchdog-eb7k2` + `/var/log/flowstate-watchdog.log`; repo copy `scripts/vps/flowstate-db-watchdog.sh`) | **Opened**: 2026-07-03

Production watchdog born from BUG-1913: cron on the VPS runs read-only SQL invariants against supabase-db every 15 min and alerts on anomalies instead of the user discovering them live. Checks: (a) deletions-without-tombstones (BUG-1891 asymmetry), (b) alive-with-tombstone rows (true resurrection), (c) undelete flips (`is_deleted=false AND deleted_at IS NOT NULL`), (d) write-gap heuristic (recent active timer heartbeat but no task writes ≥90 min), (e) updater manifest health (`/updates/electron/latest-linux.yml` reachable + parseable). Alerts: `/var/log/flowstate-watchdog.log` + ntfy.sh push (counts only, no task content).

2026-07-12 BUG-1941 hardening added immutable lifecycle-audit schema/trigger presence checks plus latest-event consistency checks for delete, restore, and status changes. Production audit schema and triggers are now live, the rollback-only lifecycle smoke passed, and the installed 15-minute watchdog reports healthy.

### ~~TASK-1915~~: Nightly automated regression hunt (scheduled cloud agent) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-03 — cloud routine `trig_012JbWAxVNY6PiFa1DvK1Ynb`, cron 00:00 UTC (~03:00 Israel), Sonnet, clones GitHub repo, unit suite + type-check + 24h commit audit (geometry single-writer, full-array overwrites, silent catches, version drift), emails report to endlessblink@gmail.com even when green; manage at claude.ai/code/routines) | **Opened**: 2026-07-03

Nightly scheduled agent (repo is on GitHub → cloud-clonable) that runs the hunt playbook: full unit suite, type-check, targeted invariant greps (canvas geometry single-writer, sync double-write, silent-catch audit), diff review of the day's commits for regression risk, and files a report. DB-side invariants are TASK-1914's job (cloud agent has no VPS access) — the two are complementary.

### ~~TASK-1916~~: In-app write-failure visibility — no more silent dropped writes (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-03, shipped Electron v1.4.230 — live manifest verified AND packaged asar-root version verified 1.4.230) | **Opened**: 2026-07-03

BUG-1913's core harm was silence: the app dropped deletions/edits without telling the user. **Shipped**: `src/composables/sync/writeHealth.ts` fed by the `withRetry` funnel in `supabase/_infrastructure.ts` (covers ALL direct DB writes; queue writes were already visible) — 2 consecutive write failures turn the header SyncStatusIndicator red ("Changes aren't saving — retrying") + rate-limited toast; any successful write clears it with a recovery toast. `stores/syncStatus.ts` overlays the signal on the existing indicator. Regression: `tests/unit/sync/write-health.test.ts` (6 tests: threshold, toast cooldown, read-context immunity, withRetry wiring both directions). Precise scope: this makes BUG-1913 *visible*, it does not fix the drop root cause (still open under BUG-1913); writes that bypass `withRetry` are not covered.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | BUG-1913 silent hour: direct writes died, indicator stayed green — now 2 consecutive failures turn it red + toast (unit-proven) | Yes (visibility only) |
| Data shape / persisted row shape | N/A | No data written by this feature | — |
| Renderer store/state | Yes | syncStatus overlays writeHealth on status/failedCount/lastError/statusText; indicator consumes `status` | Yes |
| Electron main/preload bridge | N/A | Renderer-only | — |
| Localhost sidecar endpoint | N/A | Not involved | — |
| KDE polling/control path | No | Widget has no writeHealth equivalent — widget write failures still silent | No — future work |
| Supabase persistence/realtime | Yes | Fed from `withRetry`, the funnel all supabase/* modules use; bypassing writes uncovered | Partial |
| Updater/runtime version | Yes | v1.4.230 live manifest + packaged asar-root version both verified | Yes |
| Stale live process/cache state | Yes | User's running app needs update/restart to v1.4.230 to gain the signal | Pending user restart |

**Exact failure mode fixed**: invisibility of exhausted direct-write failures (defense for BUG-1913, not its root cause).
**Explicitly not covered**: the write-drop root cause itself (BUG-1913 open); writes bypassing `withRetry`; grace-gated writes that never *attempt* (no failure event fires — only the VPS watchdog write-gap check catches those); KDE widget write failures.
**Regression added for reported repro**: `tests/unit/sync/write-health.test.ts` — withRetry failure→red, success→clear, read-context immunity.
**Live boundary proof**: `https://in-theflow.com/updates/electron/latest-linux.yml` serves 1.4.230; packaged asar-root `package.json` verified 1.4.230 (the BUG-1908-era probe pitfall avoided).

### BUG-1917: Updater "Restart" quits the app but never swaps the AppImage or relaunches (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (hardening+instrumentation shipped v1.4.231; root cause pending first instrumented run) | **Opened**: 2026-07-03

**User repro**: clicked Restart on the 1.4.230 update toast → app exited, nothing relaunched, AppImage on disk stayed 1.4.229. `~/.cache/flow-state-updater/pending/` is a graveyard (1.4.223/224/226/229/230 all downloaded, none auto-installed) → the detached installer handoff (`launchDetachedAppImageInstaller`, `electron/updater.ts`) has been failing silently for many releases: it ran `stdio:'ignore'` with no log, inherited a cwd inside the FUSE mount, ignored spawn errors (returned true → `app.exit(0)` dead-end), and relaunched WITHOUT the FlowState-launch.sh flags (TASK-1871: bare AppImage launch can die on chrome-sandbox SUID/GPU init = "nothing happens" even after a successful swap).

**Shipped v1.4.231**: installer script logs every step to `$TMPDIR/flowstate-appimage-install.log` and aborts loudly per-step; `cwd:'/'`; missing `child.pid` falls back to electron-updater's own quitAndInstall; relaunch uses `--no-sandbox --ozone-platform=x11 --disable-gpu --class=flow-state`. The NEXT update cycle (1.4.231→next) is the instrumented experiment — read the log before closing this bug. User unblocked meanwhile via manual install of checksum-verified pending 1.4.230.

### ~~BUG-1919~~: KDE timer zombie after "+5 min" — BUG-1892 guard swallows the extended session's completion (✅ DONE — awaiting plasmashell reload)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-04 fix; NOT live until plasmashell reload — running shell predates the fix, zombie row heart-beaten through 2026-07-05 05:40) | **Opened**: 2026-07-04

**User repro**: "the timer in kde broke again" (2026-07-04), re-reported 2026-07-05 — second report was the same zombie: the fixed QML was never loaded (plasmashell up since Jul 3 13:48, fix written Jul 4 14:41). Live prod row 52e15e1c: duration 1800 (25min + 300s extension), `remaining_time=0`, `is_active=true`, `completed_at=null`, `device_leader_id=kde-widget`.

**Root cause (precise)**: `postponeTimer`'s extension success handler (main.qml ~:4904) resumes with `currentSessionId = lastCompletedSessionId` but never clears the BUG-1892 per-session-id idempotency guard. When the extended session hits zero, `onSessionComplete` matches `currentSessionId === lastCompletedSessionId` → treated as duplicate re-fire → completion PATCH never sent, leadership never released → heartbeat keeps the zombie row active forever. Vue's BUG-1892 fix cleared its guard in `addExtraTime`; the QML side didn't — fix-asymmetry regression.

**Fix**: clear `lastCompletedSessionId` + `sessionJustCompleted` in the extension success handler.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Live zombie row matches extension arithmetic exactly (1500+300, 0 remaining, active, widget-leader heartbeats) | Yes |
| Data shape / persisted row shape | Yes | Fixed widget re-adopts the expired-active row and completes it — self-heal, no manual DB write | Yes after reload |
| Renderer store/state | Yes | Vue `addExtraTime` already clears its guard (BUG-1892) — Vue unaffected | N/A |
| Electron main/preload bridge | N/A | Widget-side state machine | — |
| Localhost sidecar endpoint | Yes | Sidecar faithfully reported the zombie (active, 0 remaining) — transport healthy | N/A |
| KDE polling/control path | Yes | Guard interplay traced: applyFetchedSession clears the boolean guard (:4371); only the id-guard blocked | Yes |
| Supabase persistence/realtime | Yes | Heartbeats succeeded throughout (token fine) — completion PATCH was never attempted, not failing | Yes |
| Updater/runtime version | Yes | QML ships via repo symlink; needs qmlcache clear + plasmashell restart | Pending reload |
| Stale live process/cache state | Yes | CONFIRMED live: running shell predates fix; second user report was stale-process, not regression | Pending reload |

**Exact failure mode fixed**: extension-path guard leak — legitimate re-completion after "+5 min" swallowed.
**Explicitly not covered**: any future path resuming a completed session id (none exist in QML today).
**Regression added for reported repro**: `tests/unit/kde/timer-extension-completion.test.ts` — complete→extend→zero→must-complete-again, BUG-1892 non-regression, and a mirror-drift check grepping main.qml's extend handler for the guard-clear lines (RED before fix). KDE pack 173/173.
**Live boundary proof**: pending user's plasmashell reload — then verify row 52e15e1c flips `is_active=false`.

### ~~BUG-1935~~: Board due-date column drops don't register; drag clone frozen at origin (✅ DONE)

**Two independent faults stack on the same gesture.**

1. **Drop doesn't stick.** `groupTasksByDate` (`useBoardState.ts:212`) forces any task with a past calendar instance into `overdue`, ignoring `dueDate` entirely. The drop handler (`KanbanColumn.vue:146`) writes only `{ dueDate }`; `syncDateFields` never touches instances on a dueDate change. So the write lands, `handleDragEndBroadcast` resyncs from the store, and the card re-buckets to Overdue. Real data shape confirming it: `due_date = 2026-01-24`, `instances[0].scheduledDate = 2026-01-20`.
2. **Drag clone never follows the cursor.** `.task-card.sortable-fallback` sets `transform: … !important` (`global-overrides.css:235`). With `forceFallback: true`, SortableJS positions the clone by writing an inline, non-important `transform` each frame (`sortable.esm.js:1705-1708`, via `css()` at :273), which the `!important` rule outranks. It then re-reads the computed transform through `matrix(ghostEl, true)` (:1674), so the offset resets every frame and can never accumulate. `_emulateDragOver` (:1623) still hit-tests by pointer coords on a 50ms interval, which is why the drop fires anyway — the two bugs are separable.

**Latent third fault found while reading**: `instances.forEach(… result[bucket].push(task))` renders one task in N columns under a duplicate `item-key="id"`.

**Fix**: `groupTasksByDate` buckets each task exactly once on an effective date (dueDate wins; instances are a fallback for calendar-only tasks). Drop patch extracted to `src/composables/board/dateColumnUpdates.ts` — it now also rebases past instances onto the target day (preserving time), clears `recurringInstances` on the `noDate` drop, and returns `null` for `overdue`, which `dragGroup` mirrors as `put: false`. All `transform: … !important` rules on SortableJS-controlled elements removed (`.sortable-fallback`, `.chosen-card`, `.ghost-card`, and the `:hover`/`:active` rules that match the dragged card for the whole drag), along with the `transform` transition that eased every pointer move and the `transition: all` on `.task-item` that fought SortableJS's reflow. `backdrop-filter` dropped from the moving clone (BUG-1807 class).

**Explicitly not covered**: `dueDate` now overrides a *future* calendar instance for column placement — a task scheduled tomorrow but due today shows in Today. That is the intended semantics of a Due Date grouping; the Calendar is unaffected.

**Regressions added for reported repro**: `tests/e2e/board-date-drag.spec.ts` drives a real pointer drag (Overdue→Today), asserts the clone's computed transform actually translates, that the card lands and survives a reload, and that the DB row's `due_date` and instance both moved. Verified RED on the pre-fix tree — the clone's translation was ~0px, proving it never left its origin. Plus `tests/board-date-grouping.test.ts` (+4), `tests/board-date-column-updates.test.ts` (new, 9), and three CSS invariants in `tests/safety/css-syntax.test.ts` that fail if a `transform`/`!important` or transform-transition is reintroduced on a drag element. That safety test previously *pinned the buggy values* (`transform 120ms`, `tolerance 8`) and was rewritten to assert the invariant.

**Live boundary proof**: pending — `npm run build` clean, Electron deploy not run (`VPS_HOST` unset in this shell).

### ~~BUG-1941~~: Permanent-delete/done actions can vanish before becoming durable (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-12, shipped Electron v1.4.248) | **Related**: BUG-1911, BUG-1913, BUG-1891, BUG-1850

**User repro**: Tasks/events that were permanently deleted or marked done later reappear, and FlowState appears to forget decisions over time. A screenshot identified task `71418368-35cb-42fa-ae10-f6cf7c6ff955` (`ליצור סקיל על בסיס המומחה של מרתה`) as a concrete permanent-delete repro.

**Production evidence**: The exact task remains a live `planned` row, `is_deleted=false`, with no `deleted_at` and no tombstone; its server `updated_at` is still 2026-07-10 08:54:04 UTC. The current app is authenticated and its localhost sidecar reports healthy renderer auth, but the last 72-hour production histogram contains done writes and no recent delete for this row. This is a lost lifecycle write, not a successful server delete followed by resurrection. Production also lacks `task_audit_log`, so attempted lifecycle actions have no immutable server-side evidence.

**Exact failure mode fixed**: Soft delete and permanent-delete auth recovery could optimistically remove a task, fail to enroll the write in the durable offline queue, and still resolve successfully. The app now restores the task, clears its pending-write guard, refreshes the local cache, shows a persistence error, and rejects the action. Done updates retain the existing two-path rollback contract and now have an explicit regression alongside both delete paths. A failed lifecycle write is visible immediately instead of masquerading as success until reload restores server truth.

**Explicitly not covered**: The historical click cannot be attributed to one UI entrypoint or packaged version because production has no `task_audit_log`. This fix does not add that missing production migration, mutate the old live row, or claim that a server-confirmed delete can never be resurrected by a separate future sync bug.

**Regression and release proof**: RED/green `tests/unit/undo-task-operations.test.ts` covers soft-delete queue rejection, permanent-delete fallback queue rejection, and done-update rollback. Focused integration pack passed 140/140; Electron sync guard passed 220/220; full unit suite passed 3271 with 6 skipped across 245 files; `npm run type-check`, `npm run lint`, and `npm run electron:build` passed. The guarded deploy completed without skips, and the public updater manifest serves `version: 1.4.248`; both AppImage and deb artifact endpoints return HTTP 206 with byte sizes matching the manifest.

**2026-07-12 permanent guard follow-up**: The fixed daily regression hunt now runs a named `lifecycle-durability` gate covering delete queue rejection, done rollback, smart-merge resurrection shields, Supabase delete semantics, and queued permanent-delete replay. The VPS watchdog now fails closed when `task_audit_log` or either task audit trigger is missing, and compares each task's latest 24-hour `SOFT_DELETED`/`HARD_DELETED`/`RESTORED`/`STATUS_CHANGED` audit event with live task and tombstone truth. The previously missing immutable audit migration was applied transactionally to production; a rollback-only live smoke proved the complete `CREATED → STATUS_CHANGED → SOFT_DELETED → RESTORED → HARD_DELETED` sequence and final tombstone. The widened cron watchdog was installed and returned `OK manifest=1.4.248 last_write_age_min=14`. This cannot prove an action the client never emits, so the client-side false-success regressions and server-side audit monitor deliberately remain independent layers.

---

### ~~BUG-1940~~: Spaces reset while typing in planning-canvas bubbles (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-07-12, shipped Electron v1.4.247) | **Opened**: 2026-07-12

**User repro**: In the planning canvas, typing a space in a subtask or note title appears to reset the bubble text, making multi-word titles unreliable.

**Root cause**: Both title inputs treated every debounced task-state echo as authoritative while the editor was still focused. Trimming made a trailing-space echo visibly lossy, but the broader failure was that any delayed autosave echo could re-render an older multi-word value over newer text still under the cursor. Description fields use a separate path and were unaffected by this reported repro.

**Exact failure mode fixed**: A focused bubble title now owns a local draft until blur. Autosave preserves the raw title, including trailing spaces and Shift+Enter content, while delayed state echoes cannot repaint over continuous typing; normalization still happens on blur when editing is complete.

**Explicitly not covered**: This does not change planning-canvas drag, connection, layout, description autosave, or title normalization after blur.

**Regression added for reported repro**: `tests/unit/mini-canvas/node-autosave.test.ts` covers both subtask and note titles. The trailing-space RED failed with `Two words` instead of `Two words `. The continuous-typing RED then simulated successive autosave/store echoes and failed when `Several words` replaced the newer `Several words typed`; green passes 7/7 with the focused-draft guard. The first public build reused `1.4.246`, which was already embedded in an older local AppImage, so the updater reported current while running pre-fix code. The corrected artifact is shipped as the strictly newer `1.4.247`. Related proof: `npm run type-check`; `npm run lint`; `npm run electron:build`; live updater manifest and artifacts verified for `1.4.247`.

### ~~BUG-1932~~: Phantom sign-out when a launcher rewrites HOME (✅ DONE)

**Root cause**: Electron derives `userData` from `$XDG_CONFIG_HOME`/`$HOME`. The Hermes agent sandboxes each session by rewriting `HOME` for spawned processes (`HOME=~/.hermes/profiles/<p>/home`, `HERMES_REAL_HOME=/home/endlessblink`). FlowState launched from such a session opened a pristine, empty profile — no `store.json`, no auth, no `local-api.json` — and rendered "Sign In" while the real session sat untouched in `~/.config/flow-state/store.json`. Once the launching session exits, the process reparents to `systemd --user` and is indistinguishable from a normally-started app, so it reads as a random sign-out.

**Second fault, same cause**: `local-api.json` also lives under `userData`. The sandboxed instance bound port 5577 with token `c0d8afa4…` while every client (KDE widget, scripts, Hermes flow-state skill) read `b02dfdd3…` from the canonical path → 401. Two profiles, one port, two secrets.

**Exact failure mode fixed**: auth store + Local API config landing in a launcher-supplied directory. `userData` is now pinned to the home recorded in `/etc/passwd` (`os.userInfo().homedir` — `os.homedir()` is unusable, it prefers `$HOME`), via `resolveUserDataDir()` called before any handler registration.

**Explicitly NOT covered** (separate, intentional — do not touch): single-use refresh-token rotation / "Already Used" handling; `restoreAuthSessionFromBackup` always restoring and letting the server validate (BUG-1881); lazy Electron-runtime detection (`createLazyAuthStorage`, `detectElectronRuntime`); atomic `store.json` writes + flush-before-exit (BUG-1874).

**Key subtlety**: for `HOME`, containment is not enough — agent sandboxes nest their profile *inside* the real home, so a `startsWith` check passes while still yielding an empty profile. Only exact equality means "not hijacked". `XDG_CONFIG_HOME` still uses containment (a legitimate user preference). Linux-only; macOS/Windows use Application Support/APPDATA and are never rewritten.

**Escape hatch**: `FLOWSTATE_ALLOW_HOME_OVERRIDE=1` for deliberate profile isolation. A pin is never silent — main logs it and the renderer shows a warning toast (`app:getHomeOverride`).

**Files**: `electron/userDataPath.ts` (new), `electron/main.ts`, `electron/preload.ts`, `src/App.vue`.
**Regression added for reported repro**: `tests/unit/user-data-path.test.ts` — 9 cases incl. the literal Hermes path, the nested-sandbox trap, sibling-home (`/home/endlessblink2`), unset HOME, XDG in/out of home, opt-out, non-Linux. The Hermes-path case was RED against the first implementation (caught the containment bug).
**Live boundary proof**: `HOME=/tmp/fake-home electron dist-electron/main.cjs` → logs `userData pinned to /home/endlessblink/.config/flow-state`, and nothing is written under `/tmp/fake-home`. With `FLOWSTATE_ALLOW_HOME_OVERRIDE=1` the same command creates `/tmp/fake-home/.config/flow-state` instead.

### ~~BUG-1933~~: Restored session never re-persisted; stale access token blinded the Local API sidecar (✅ DONE)

**Two independent faults, one symptom** (UI signed in, but `store.json` auth = null and sidecar `hasAuthContext: false`, so KDE widget + agent tools 401):

1. **Primary key never rewritten.** When a refresh fails, supabase-js calls `removeItem` on the storage adapter, which in Electron writes `flowstate-supabase-auth: null` (`authStorage.ts:85-90`). `keepSessionForReconnect` then kept the session in memory and re-persisted only the *backup* key — never the primary. Fix: new `persistPrimaryAuthSession()` in `src/services/auth/supabase.ts`, called from `keepSessionForReconnect`.
2. **Sidecar cleared on a stale token.** `syncLocalApiSession` (`useLocalApiBridge.ts`) sent `clear` whenever the access token was within 30s of expiry — including a freshly restored backup session whose refresh was still in flight. Fix: only a real sign-out (no session / no user id) clears; a stale-but-present session holds the last good context and waits for the watcher to re-fire with refreshed tokens.

**Explicitly NOT covered**: the sidecar does not read auth from disk (it receives it over IPC) — fault 1 affects the next launch and any disk reader, fault 2 affects the live sidecar. They were fixed together because one symptom masked the other.

**Regression added**: `tests/unit/composables/useLocalApiBridge.test.ts` — the pre-existing "clears on expired session" case was inverted to "neither forwards nor clears" (the anti-forward invariant it really protected is preserved), plus a new sign-out-clears case. And a `persistPrimaryAuthSession` assertion on the reconnect-grace path in `tests/unit/stores/auth-flow.test.ts:8e`.

### ~~BUG-1934~~: Regular multi-delete removes tasks sequentially instead of instantly (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-10, shipped Electron v1.4.241) | **Opened**: 2026-07-10

**User repro**: Regular deletion of multiple selected tasks is visibly slow and removes tasks one at a time. Permanent deletion is explicitly outside this report.

**Root cause**: Board and Unified Inbox bypass the existing `bulkDeleteTasksWithUndo(taskIds)` path and invoke `deleteTaskWithUndo(id)` once per selected task. Each call creates a separate undo operation and performs a separate optimistic splice/cache/queue cycle, so the UI visibly drains instead of applying one local batch.

**Acceptance**:
- Board, Unified Inbox, and All Tasks route regular multi-delete through one bulk undo operation.
- All selected tasks leave reactive local state together before remote queue processing completes.
- One Ctrl/Cmd+Z restores the entire batch; redo removes the entire batch again.
- Per-task offline queue entries, echo suppression, `positionVersion`, soft-delete resurrection guards, and the direct database batch safety limit remain intact.
- Canvas regular Delete continues to move tasks to Inbox; Shift+Delete/permanent-delete behavior is unchanged.

**Implementation**: Board and Unified Inbox now call the existing `bulkDeleteTasksWithUndo(taskIds)` entry point once instead of fanning out to `deleteTaskWithUndo(id)`. The store already filters every selected ID from reactive state before awaiting cache or queue persistence, so all cards disappear in one paint while the existing per-task offline queue remains the sole remote writer. Bulk redo now uses the same atomic local batch path instead of replaying sequential single deletes.

**Exact failure mode fixed**: regular multi-select delete and its redo visibly drained task lists one row at a time because Board, Inbox, and redo bypassed the atomic local bulk mutation.

**Explicitly not covered**: single-task delete latency; permanent deletion; Canvas regular Delete semantics (move to Inbox); recurrence-dialog behavior; or changing remote sync from durable per-task queue entries to a direct database batch.

**Regression added for reported repro**: `tests/unit/undo-entrypoint-contract.test.ts` pins Board, Inbox, and All Tasks to one bulk undo call. `tests/unit/undo-task-operations.test.ts` holds the first queue write open and proves the full local batch is already absent for both initial delete and redo, while preserving each delete payload and `positionVersion`.

**Verification**: focused RED/GREEN regressions 32/32; Electron sync guard 185/185; full unit suite, typecheck, lint, package validation, and `git diff --check` passed. Public `latest-linux.yml` serves `1.4.241`; AppImage (`180364145` bytes) and deb (`131350324` bytes) both return HTTP 200.

### ~~BUG-1918~~: Sign-in needs a manual refresh — empty canvas and zeroed counts until reload (✅ DONE)

**Root cause**: the `SIGNED_IN` handler in `src/stores/auth.ts` loaded tasks/projects/canvas **before** workspaces. Task and canvas fetches are workspace-scoped and read `activeWorkspaceId`, which is only restored inside `loadWorkspaces()` (`stores/workspace.ts:96-102`). They queried a null workspace, returned empty, and nothing reloaded once the workspace arrived. Lanes were never reloaded at all. A page reload works because `useAppInitialization` loads workspaces first (`:219-223`) and includes lanes (`:250`).

**Exact failure mode fixed**: reload ordering + missing lane load on the sign-in path. Extracted to `reloadStoresAfterSignIn()`: invalidate SWR cache → `loadWorkspaces()` → then projects/tasks/canvas/lanes in parallel. A failed reload now resets `handledSignInForUserId` so the next `SIGNED_IN` retries instead of latching.

**Explicitly NOT covered**: the BUG-1207 double-load guard is retained (`appInitLoadComplete` + empty-tasks check) — a normal launch still lets `useAppInitialization` own the load. The "broken sign-out view" half of the original BUG-1918 report is untouched.

**Regression added for reported repro**: `tests/unit/stores/auth-signin-reload.test.ts` — records real call order; RED against the old code on 3 of 4 cases (workspaces-before-tasks, lanes reloaded, all core stores).

**Priority**: P1 | **Status**: 📋 PLANNED | **Opened**: 2026-07-04

Sign-out/in is now the documented recovery for a stranded sync queue (BUG-1913), but the path is rough (user report 2026-07-04 00:19, v1.4.230 Electron): (1) the signed-out state "doesn't look good" — visual/layout breakage on the logged-out view; (2) after signing back in the app required a manual refresh before becoming usable (auth-state propagation doesn't rehydrate stores/views without reload — SOP-050 auth-aware init class). Recovery WORKED (33 queued writes flushed within seconds of re-auth, prod-verified) — this bug is about making the escape hatch presentable and refresh-free.

### BUG-1912: Canvas edge can't be disconnected; dragging a line glitches the whole screen (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED | **Opened**: 2026-07-03

User screenshot: dragging a connection line makes the entire screen glitch for a couple of seconds (self-recovers), and the edge cannot be disconnected. App runs with `--disable-gpu` (FlowState-launch.sh, TASK-1871) → software compositing; edge-drag causes full-canvas repaint storms. Disconnect path: verify Vue Flow `edges-updatable` endpoint-drag support vs EdgeContextMenu delete affordance — the user found no working way to remove a line.

### ~~BUG-1909~~: Due-date quick-set looks like it does nothing — stale past instances pin the badge (recurring residual of BUG-1901) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-07-03, shipped Electron v1.4.229 — live `updates/electron/latest-linux.yml` verified serving 1.4.229 with reachable AppImage) | **Opened**: 2026-07-03

**User repro (2 reports, same class)**: (1) clicking "Next Week" in the Due Date submenu "doesn't do anything"; (2) context menu shows Due Date "Tomorrow" while the card badge shows "Overdue May 30". Runtime verified current (running Electron v1.4.228 contains the BUG-1901 read-side fix) — NOT a stale-runtime recurrence.

**Root cause**: the due-date write path never reconciles stale calendar instances. `updateDueDateWithCalendarInstance` (`src/composables/tasks/useTaskContextMenuActions.ts:37`) only moves an instance when the menu was opened ON a calendar event; from a task card it writes `dueDate` alone. BUG-1901 fixed the badge read-side for NON-recurring tasks only — for recurring tasks (`recurrence`/`recurrenceRule`/`recurrenceParentId`), `computeDueStatus` keeps instance authority (BUG-1810), so a stale past instance pins "Overdue <old>" forever and every due-date edit looks like a no-op (the write actually succeeds).

**Fix**: write-side reconciliation — when the user explicitly sets a due date, stale PAST instances (scheduledDate < today, ≠ new date) are rescheduled to the picked date. Read-side stays untouched (BUG-1810 instance authority preserved for genuinely surfaced occurrences). Regression coverage: `src/utils/__tests__/dueDateInstances.spec.ts` and `src/composables/tasks/__tests__/useTaskContextMenuActions.spec.ts`.

**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape | Yes | Recurring-shaped task, stale May 30 instance, pick Tomorrow/Next Week — end-to-end badge test (`Overdue May 30` → `Tomorrow`) + writer payload regression RED→GREEN | Yes |
| Data shape / persisted row shape | Yes | `instances` jsonb; reconcile only past ≠ picked date; `instances` omitted from payload when unchanged (BUG-1799 double-write lesson) | Yes |
| Renderer store/state | Yes | Single `updateTaskWithUndo` write carries dueDate + reconciled instances atomically | Yes |
| Electron main/preload bridge | N/A | Pure renderer logic | — |
| Localhost sidecar endpoint | N/A | Not involved | — |
| KDE polling/control path | Yes | Sibling BUG-1908 covers the widget read side; reconciled instances also unpin widget filters | Via BUG-1908 |
| Supabase persistence/realtime | Yes | Write goes through the normal updateTask queue path; no new writer introduced | Yes |
| Updater/runtime version | Yes | User was on v1.4.228 (contains BUG-1901 read fix — confirmed NOT stale-runtime); fix ships v1.4.229, manifest verified live | Yes after app update/restart |
| Stale live process/cache state | Yes | Running app must auto-update/restart to v1.4.229 to pick up the fix | Pending user restart |

**Exact failure mode fixed**: due-date picks (quick options + date picker) now reschedule stale PAST calendar instances onto the picked date.
**Explicitly not covered**: "Clear date" (stale instances remain → recurring badge stays pinned after clearing); "Done for now" flows (`handleDoneForNowTomorrow`/`handleDoneForNowPickDate` stamp dueDate/scheduledDate/doneForNowUntil but not instances; recurring path goes through `doneForNow()` with its own occurrence semantics); task edit modal due-date path; batch multi-select path (delegates to parent handler).
**Regression added for reported repro**: `src/utils/__tests__/dueDateInstances.spec.ts` (incl. end-to-end computeDueStatus badge assertion for a recurring task) + `src/composables/tasks/__tests__/useTaskContextMenuActions.spec.ts` (writer payload for quick-set, no-double-write, calendar-event path).
**Live boundary proof**: deployed via `deploy-electron-update.sh` (full ship gate passed); `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.229` and `FlowState-1.4.229-x86_64.AppImage` answers HTTP 206 range requests. NOTE: earlier "updates 404 incident" was a false alarm — the feed lives under `/updates/electron/`, not `/updates/latest-linux.yml`.

### TASK-1905: Rewrite AI-chat E2E specs for the sidebar UX (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED | **Opened**: 2026-07-02

d0f90130 "Make desktop AI an inspectable sidebar tool" removed the full-page `/#/ai` view (AISidebarFallbackView now opens the panel and redirects home). 19 specs across ai-bridge-chat, ai-react-cards, ai-usage-comprehensive, ai-weekly-plan-quality, ai-chat-quality-local still navigate to `/#/ai` and wait for `.chat-input` — all skip-tagged pending rewrite against the sidebar panel (network stubs are still valid; only navigation/selectors changed).

### TASK-1906: Per-worker E2E test users (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED | **Opened**: 2026-07-02

All E2E specs share ONE test user (`playwright@test.flowstate`); under `fullyParallel` with 2 workers, two canvas spec files mutate the same user's data concurrently via Supabase realtime and clobber each other's seed state (proven: files with `test.describe.configure({mode:'serial'})` still failed under the parallel suite — serial mode is per-file only). Fix: key the test user on `TEST_WORKER_INDEX` in `tests/global-setup.ts` + fixtures, or pin canvas specs to a `workers:1` project. Until then, canvas E2E failures under the full parallel suite that pass isolated/serial are suite-interference, not product regressions.

**2026-07-02 addendum**: four interference-prone files (`canvas-geometry-local`, `mini-canvas-floating-toolbar`, `task-description-roundtrip`, `workblock-interaction`) carry an explicit in-code gate (`test.skip(workers > 1, 'TASK-1906…')`) — they run under `--workers=1` and skip in multi-worker suites. Second mode measured: INTRA-file order dependence in `canvas-geometry-local` whole-file runs — exactly one failure per run with varying identity (the `:969/:1022/:1045` day-rotate/tidy family; every test passes when run alone). ~14 tests seed/clear the same user sequentially and prior tests' realtime echoes land during later tests' seeds. Same root cause; fixed properly by per-worker/per-test users, not by test-side waits. Named canvas gates all pass 5/5 isolated: BUG-1782 Tidy spec, canvas-sync-regressions, canvas-group-echo-window (new BUG-1899 regression), and the Position Persistence pack (TASK-131/142) — the latter was an orphaned Jan-17 spec outside `testDir` that had never run and had rotted; rewritten to store-truth assertions, relocated into `tests/e2e/`, and now 5/5 isolated (4 tests × 5 rounds green).

### ~~BUG-1892~~: "Time for a break" popup loops endlessly until the app is closed (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-06-25, shipped Electron v1.4.218 + web) | **Opened**: 2026-06-25

**Root cause (3-agent trace + live DB):** The break notification is a fire-and-forget side effect of `completeSession()` (`src/stores/timer.ts:560`). `completeSession` is NOT idempotent per session id — its only top guard is the concurrency lock `isCompleting` (`:469`); it never checks `completedSessionIds`, and that set self-deleted after 2 min (`:484`, `PENDING_WRITE_TIMEOUT_MS`). When the 15s follower poll / resync (`useTimerSync.ts:139,235-244,570-588`) re-adopts an expired-but-still-`is_active=true` session row (completion DB write failed/offline, or a remote leader/KDE widget keeps heart-beating it), `onCountdownComplete → completeSession` runs again for the SAME session and re-fires the OS notification — looping until the poll stops (app closed). The KDE widget had the same class of bug: its only guard is a single boolean `sessionJustCompleted` that `applyFetchedSession` resets whenever a poll sees an active row (`packages/kde-widget/contents/ui/main.qml:4371,4777`).

**Fix:**
- `src/stores/timer.ts`: idempotency guard at the top of `completeSession` (skip + clear local session if id already in `completedSessionIds`); made `completedSessionIds` durable for the store lifetime (removed the 2-min self-delete). `addExtraTime` still clears the id to allow legitimate re-completion.
- `packages/kde-widget/contents/ui/main.qml`: per-session-id guard in `onSessionComplete` (`currentSessionId === lastCompletedSessionId` → ignore re-fire), independent of the resettable boolean.

**Verified:** `tests/unit/stores/timer-break-popup-loop.test.ts` (2 tests RED→GREEN — same session completed twice, and again after the 2-min window, notifies once); all 96 timer unit tests pass; typecheck clean. KDE QML guard is additive/logically safe but needs widget-reinstall verification.

### ~~BUG-1891~~: Deleted tasks keep resurfacing — unify deletion truth on tombstones (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-06-25) | **Opened**: 2026-06-25

**Root cause (proven by 3 code traces + live DB diagnostics):** Two sources of "deleted" truth. A SOFT delete (normal delete) only set `is_deleted=true` and **never wrote a tombstone**, while every resurrection guard (sync CREATE guard, `safe_create_task`, load-merge) keys off the tombstones table. Local DB showed **153/153 soft-deleted tasks had zero tombstone protection** and 8 live rows already carried a tombstone (resurrection captured in data). Two vectors: (1) load-merge fail-open — `fetchTombstones`/`fetchDeletedTaskIds` silently return `[]` on error → merge re-CREATEs every in-memory deleted task with `is_deleted:false`; (2) stale queued CREATE passes the tombstone-only guard and flips `is_deleted` back.

**Fix:** Enforce the invariant server-side + harden app:
- Migration `20260625000000_unify_soft_delete_tombstones.sql`: BEFORE UPDATE trigger on `tasks` — `is_deleted` false→true writes a permanent tombstone, true→false removes it (makes Trash-restore safe automatically); backfills tombstones for existing soft-deleted rows; reports (does not auto-resolve) existing zombies.
- `taskPersistence.ts`: fail CLOSED — when deletion markers don't load reliably, do not re-enqueue ambiguous local-only tasks as CREATE.
- `useTasksDatabase.restoreTask`: explicit tombstone clear (defense-in-depth for un-migrated DBs).
- Dropped the "block CREATE when live is_deleted=true" idea — it would break undo (undo re-creates a soft-deleted row via CREATE, clearing only the tombstone first).

**Verified:** DB trigger test (RED→GREEN) `scripts/db/test-soft-delete-tombstone.sql`; local asymmetry 153→0; typecheck clean; `canvasDeleteUndo` 8/8; e2e resurrection + undo-delete pass against migrated local DB.

**Shipped:** migration applied to VPS prod (319→0 unprotected soft-deletes; trigger smoke test passed); 7 prod zombies healed (stale tombstones removed from live rows — 0 zombies remain); Electron v1.4.217 built + deployed (auto-updater manifest shows 1.4.217); web JS (fail-closed merge) committed + pushed to master for CI/CD PWA deploy. DB trigger is server-side so it protects web/Electron/KDE immediately.

### BUG-1850: Canvas permanent-delete does nothing (soft-delete + resurrection) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-11) | **Opened**: 2026-06-11

**Problem**: On the Canvas (Electron), permanently deleting a task did nothing — the task stayed put. Root cause: both canvas delete paths (`useCanvasTaskActions.confirmBulkDelete` and `ModalManager.canvasSafeDeleteTaskWithUndo`) were rerouted to a **soft delete** (`bulkDeleteTasksWithUndo`) by a now-stale workaround ("permanentlyDeleteTaskWithUndo corrupts shared pendingOperation state"). Soft delete writes `is_deleted=true` but **no tombstone**, so the sync layer's CREATE-upsert (BUG-1509 force-clears `is_deleted:false`; BUG-1534 guard only blocks when a tombstone exists) resurrected the task immediately → net "nothing happens."

**Fix**:
- Added `bulkPermanentlyDeleteTasksWithUndo` to `src/composables/undoSingleton.ts` (mirrors `bulkDeleteTasksWithUndo` but calls `permanentlyDeleteTask`, type `task-bulk-delete` → single-press undo; exported via `useUnifiedUndoRedo`). The old `pendingOperation` hazard is gone — `beginOperation`/`commitOperation` is now handle-based.
- Canvas Shift+Delete (`useCanvasTaskActions.ts`) now calls `bulkPermanentlyDeleteTasksWithUndo`; context-menu Permanent Delete (`ModalManager.canvasSafeDeleteTaskWithUndo`) now calls `permanentlyDeleteTaskWithUndo`. Both write a real tombstone (DB trigger `trg_task_tombstone`), so the deletion can't be resurrected and propagates across views/devices. Undo restores via `clearTombstoneForUndo` (already in place).
- Hardened `useTasksDatabase.permanentlyDeleteTask` to `.select('id')` and throw on a 0-row delete (RLS/already-gone) instead of a silent fake success.
- BUG-1850b follow-up: production console showed mass `406/PGRST116` "not found on server" sync updates for cached local tasks. `permanentlyDeleteTask` now distinguishes zero-row causes: visible row + 0 deleted still throws as a DELETE-policy failure, but absent/inaccessible row is treated as already deleted and gets a best-effort permanent tombstone so the local cache cannot resurrect it.
- 2026-06-22 follow-up: auth-recovery permanent-delete fallback no longer downgrades to ordinary soft-delete sync. `taskStore.permanentlyDeleteTask` now queues failed remote hard deletes with `payload.permanentDelete=true`, and `useSyncOrchestrator` honors that marker by retrying the hard delete and upserting a permanent task tombstone. Regression proof: `npm run test -- tests/unit/undo-task-operations.test.ts tests/unit/sync/sync-orchestrator.test.ts tests/unit/composables/useSupabaseDatabase-delete.test.ts tests/unit/stores/smart-merge.test.ts --run`, `npm run guard:electron-sync`, `npm run type-check`, `npm run lint`, and `npm run electron:build`. Shipped desktop updater `1.4.203`; `https://in-theflow.com/updates/electron/latest-linux.yml` serves `version: 1.4.203`, `FlowState-1.4.203-x86_64.AppImage` returns HTTP 200 with `content-length: 180302271`, and `FlowState_1.4.203_amd64.deb` returns HTTP 200 with `content-length: 131319820`.
- Flipped `canvasDeleteUndo.test.ts` and `undo-entrypoint-contract.test.ts` which previously asserted the buggy soft-delete routing.

**Files**: `src/composables/undoSingleton.ts`, `src/composables/useUnifiedUndoRedo.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, `src/layouts/ModalManager.vue`, `src/composables/supabase/useTasksDatabase.ts`, `src/composables/canvas/__tests__/canvasDeleteUndo.test.ts`, `tests/unit/undo-entrypoint-contract.test.ts`, `tests/unit/composables/useSupabaseDatabase-delete.test.ts`

### ~~TASK-1788~~: Extract canvas rotation handlers from CanvasView.vue into useCanvasRotationLayout composable (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-18) | **Opened**: 2026-05-18

**Problem**: BUG-1786 (v1.4.33) and BUG-1787 (v1.4.34) both touched canvas rotation/render logic locked inside `src/views/CanvasView.vue`. The newly-added findNode null-retry and canvasSyncInProgress pre-acquire could only be tested via E2E because they were inside an SFC, not a composable.

**Fix**: Pure refactor — extracted `applyCanonicalLayoutMoves`, `applyCanonicalTaskMoves` (with BUG-1787 null-retry), `refreshRenderedNodesFromModel`, `releaseOnDoubleNextTick`, `getVisualNodePosition`, `getRenderedNodeSize`, `getRenderedCanvasZoom`, `handleRotateDayGroups` (with BUG-1787 sync-lock pre-acquire), `handleTidyLayout`, `runDayGroupCatchup`, plus `useDayGroupRotation`/`useTidyLayout` initialization into new composable `src/composables/canvas/useCanvasRotationLayout.ts`. CanvasView.vue net diff: -249 lines. Added 7 new unit tests covering the previously-uncovered paths.

**Files**:
- New: `src/composables/canvas/useCanvasRotationLayout.ts` (~360 lines, moved from CanvasView.vue)
- Modified: `src/views/CanvasView.vue` (-249 net lines)
- New: `tests/unit/canvas/canvas-rotation-layout.test.ts` (7 cases)

**Verification**: 184/184 unit tests pass. No new TS errors. Build clean.

**Plan file**: `~/.claude/plans/mighty-petting-stearns.md`

---

### ~~BUG-1787~~: Canvas rotate-days makes tasks visually disappear from groups (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-17, shipped v1.4.34)

**Problem**: Clicking the rotate-days toolbar button left tasks counted in their groups but visually rendered outside the group rectangle. Day-of-week groups rotated correctly, but Today/Tomorrow power-keyword groups were skipped, leaving stale `dueDate` on their children.

**Root cause**: (1) `rotateDayGroups()` only iterated `keyword.category === 'day_of_week'` groups, skipping Today/Tomorrow `date`-category groups. (2) `handleRotateDayGroups` did NOT pre-acquire `canvasSyncInProgress=true` before calling `rotateDayGroups()` — the SMART-GROUP `dueDate` writes fired the sync watcher mid-rotation, leaving Vue Flow node positions stale. `applyCanonicalTaskMoves` then silently skipped tasks whose `findNode` returned null.

**Fix**: (1) Extended `rotateDayGroups` to rotate Today/Tomorrow too (left "this week"/"this weekend"/"later" alone as span keywords). (2) `handleRotateDayGroups` sets `canvasSyncInProgress.value = true` BEFORE invoking `rotateDayGroups`. (3) `applyCanonicalTaskMoves` collects null-findNode tasks and retries on `nextTick`. Still-missing tasks log a `[BUG-1787]` warning.

**Files**: `src/composables/canvas/useDayGroupRotation.ts`, `src/views/CanvasView.vue`, `tests/unit/canvas/day-group-today-tomorrow-rotation.test.ts` (new, 8 cases), `tests/e2e/canvas-rotate-render-bug-1787.spec.ts` (new, 2 cases)

**Shipped in**: v1.4.34 (deployed via `deploy-electron-update.sh` 2026-05-17)

---

### ~~BUG-1786~~: Canvas "Move to Today" leaves tasks bucketed as Tomorrow when they carry a calendar instance (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-17, shipped v1.4.33)

**Problem**: On Canvas (Electron), moving a task to Today via drag, right-click date menu, or overdue "Reschedule → Today" updated `task.dueDate` and (for drag) `parentId`, but never touched `task.instances[].scheduledDate`. Because `getTaskInstances` (`src/stores/tasks.ts:30`) makes any reader prefer `instances[]` over `dueDate`, Board view, smart-group matchers, and day-rotation continued to bucket the task as Tomorrow.

**Fix**: Added `realignInstancesToDate(task, dateStr)` helper in `src/stores/tasks/taskOperations.ts`. Skips recurring tasks and tasks with no instances (preserves BUG-1467). Wired into three canvas writers so the new `dueDate` and realigned `instances` ship atomically in a single `updateTask` call.

**Files**: `src/stores/tasks/taskOperations.ts`, `src/composables/canvas/useCanvasInteractions.ts:855` (drag), `src/composables/canvas/node/useTaskNodeActions.ts:295` (overdue reschedule), `src/composables/tasks/useTaskContextMenuActions.ts` (context menu — dropped `isCalendarEvent` gate), `src/stores/__tests__/tasks.test.ts` (3 new helper cases).

**Shipped in**: v1.4.33 (deployed via `deploy-electron-update.sh` 2026-05-17)

---

### ~~BUG-1784~~: Canvas Tidy button flips 9+ tasks into a messy 2-column staggered grid (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-09)

**Problem**: User arranges 9 tasks vertically in the Today group, clicks Tidy, and the cards rearrange into a 2-column staggered layout instead of staying in a clean single column. Five prior commits on `regression-canvas-recovery` (c9c5b651, 137ca809, c4e939a4, af37a03e, 79ceedbb) addressed adjacent symptoms (zoom-aware DOM measurement, persistence, gap math, rotation alignment) but did not touch the actual trigger.

**Root cause**: `useCanonicalDayGroupLayout.ts:110` flipped `hasOverflow = true` whenever `taskCount > CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN` (8). Tasks 9+ moved to column 1 at `groupX + 260`, while column 1's Y cursor started at `firstTaskY` (top of group) — producing the staggered pattern visible in the user's screenshot.

**Fix**: Added `maxTasksPerColumn?: number | null` to `CanonicalLayoutOptions`. When `null`, `maxPerColumn = Infinity` so all tasks land in column 0 and the group height grows via the existing `requiredHeight` math. Tidy passes `maxTasksPerColumn: null`. Rotation still uses the default 8-task threshold. Added a 9-task regression unit test asserting all `taskMoves[*].position.x === 20` and Y monotonically increases.

**Files**: `src/composables/canvas/useCanonicalDayGroupLayout.ts`, `src/composables/canvas/useTidyLayout.ts`, `tests/unit/canvas/tidy-layout.test.ts`

**Shipped in**: v1.4.22 (deployed via `deploy-electron-update.sh` 2026-05-09)

---

### ~~BUG-1757~~: Editing task due date to another day leaves it inside canvas day-group, date resets to today (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-12)

**Problem**: When a task parented to a canvas smart day-group (e.g. "Today = 12/04/2026") had its due date edited to another day (e.g. 19/04/2026), the task stayed visually inside the today-group. Worse, `useDayGroupRotation` (`src/composables/canvas/useDayGroupRotation.ts:111-112`) re-applied the group's current date to every `parentId === group.id` child, silently overwriting the user's edit back to today.

**Fix**: In `updateTask()` (`src/stores/tasks/taskOperations.ts`), when `updates.dueDate` is present, the call didn't come from `'SMART-GROUP'` source, the task has a `parentId`, and the caller isn't already managing `parentId` — look up the parent group, confirm it has a power keyword (skip freeform groups per user preference), and use `findMatchingGroupForDueDate(newDueDate, canvasStore.groups)` to check whether the new date still belongs in that group. If not, clear `parentId`, `canvasPosition`, set `isInInbox: true`, bump `positionVersion`. This detaches the Vue Flow child (visual exit), and the rotation loop stops touching the task (`useDayGroupRotation` filters on `parentId === group.id`). Mirrors the `doneForNow` v1.3.43 pattern at lines 1177-1189.

**Files**: `src/stores/tasks/taskOperations.ts` (added imports + new branch before `syncDateFields`)

---

### ~~BUG-1733~~: Production errors — FK violation, dev CSS preload, undo safeClone SyntaxError (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-28)

**Problems fixed**:
1. `tasks_parent_id_fkey` FK violation — orphaned constraint on production DB blocks task sync
2. `/src/assets/styles.css` 404 in production — hardcoded dev path in preload
3. `permanentlyDeleteTaskWithUndo` SyntaxError — `safeClone()` returns Vue reactive proxies
4. `claim_timer_leadership` RPC 404 — migration not deployed to production

**Fix**: Dropped orphaned FK constraint via migration, removed dead CSS preload from main.ts, added `toRaw()` to undo safeClone. Timer RPC requires manual migration deploy.

**Files**: `src/main.ts`, `src/composables/undoSingleton.ts`, `supabase/migrations/20260327120000_drop_tasks_parent_id_fkey.sql`

---

### ~~BUG-1523~~: iCal parser skips ALL recurring events — RRULE expansion missing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `useExternalCalendar.ts` lines 96-98 explicitly `continue` on any event with `RRULE:` that lacks a `RECURRENCE-ID`. This means every recurring event (weekly standups, daily check-ins, monthly 1:1s) is silently dropped. Only one-off events appear in the calendar.

**Fix**: Implement lightweight RRULE expansion (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY) generating instances in a -30/+90 day window. Cap at 500 instances. Replace the `continue` with expansion logic. Keep `RECURRENCE-ID` override detection.

---

### ~~BUG-1526~~: Push notification click actions dead — no client-side SW message handler (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `src/sw.ts` sends `NAVIGATE_TO_TASK`, `NAVIGATE_TO`, and `SNOOZE_NOTIFICATION` messages to open clients after a push notification click. No handler existed on the client to act on these messages — clicks had zero effect.

**Fix**: Added a `navigator.serviceWorker` `message` event listener in `useAppInitialization.ts` (lines 864–905). Handles all three message types: routes to `/focus/:taskId`, pushes arbitrary URLs via router, and snoozes the matching notification via `notificationStore.snoozeNotification()`. Listener is registered at composable setup time and cleaned up in `onUnmounted`.

---

### ~~BUG-1533~~: Task duplication, ghost reappearance, and sync resurrection bugs (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-16)

**12 bugs fixed**: Canvas Delete moved to inbox instead of deleting, sync queue CREATE resurrected deleted tasks (tombstone check added), cross-tab DELETE spliced wrong array, doneForNow double-invocation guard, calendarFilteredTasks missing dedup, createTask pre-push duplicate guard, done tasks staying in inbox, smart merge 5-min resurrection window (→30s), coalescer blind to syncing ops, stale queue 24h purge, recurrence unique DB constraint, stale comment fix. Production DB cleanup: 174 done tasks cleared from inbox.

### ~~BUG-1508~~: Permanently deleting a recurring task causes infinite recreation loop (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-24)

**Problem**: When a recurring task is permanently deleted, the deferred recurrence scheduler (`useRecurrenceScheduler.ts`) finds an older `done` ancestor with `recurrenceRule` still set, sees no active successor (deleted task is gone from `_rawTasks`), and creates a new clone — effectively resurrecting the deleted task. This loops infinitely: delete → scheduler recreates → delete → recreates.

**Fix approach**: When permanently deleting a recurring task, advance the recurrence chain first (bump `recurrenceCount`/`lastRecurrenceDate` on the ancestor) so the scheduler creates the *next* occurrence, not the same one again. This preserves the recurring series while respecting the deletion.

---

### ~~BUG-1509~~: Undo deleted task vanishes on next refresh — is_deleted not cleared (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Ctrl+Z after deleting a task re-creates it locally via `createTask` upsert, but the upsert payload never includes `is_deleted: false`. The DB row stays `is_deleted: true`. On next page refresh, `fetchTasks` filters it out and the task silently disappears.

**Root cause**: `createTask` in `taskOperations.ts` spreads `taskDataWithoutPositionAndInstances` which carries `_soft_deleted: true` from undo snapshots (if realtime echo processed before undo). The sync queue payload was patched but the direct Supabase write via `toSupabaseTask` still read `_soft_deleted` → wrote `is_deleted: true`.

**Fix**: Added `_soft_deleted: false, deletedAt: undefined` after the spread in `createTask` (`taskOperations.ts:144-148`) so they always override any stale flags from the undo snapshot.

---

### ~~BUG-1510~~: Delete canvas group orphans child tasks — they vanish (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `deleteGroup` in `canvasGroups.ts` removes the group but doesn't clear `parentId` on child tasks. Canvas renderer skips tasks with missing parent. Deferred cleanup has no retry — if it fails, tasks stay invisible.

**Fix**: Before deleting a group, explicitly clear `parentId` on all child tasks. Positions are already absolute — no conversion needed.

---

### ~~BUG-1511~~: Timer dual leadership — no atomic CAS allows two leaders (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: Timer leadership is claimed by writing `device_leader_id` without checking if someone else already claimed it. Two devices can both become leader → timer counts at 2x speed → session completes twice → double XP (BUG-1513).

**Fix implemented**:
- `supabase/migrations/20260313210000_atomic_timer_leadership.sql`: `claim_timer_leadership` RPC with conditional UPDATE
- `src/composables/supabase/useTimerDatabase.ts`: added `claimLeadership()` wrapper
- `src/composables/timer/useTimerSync.ts`: all 3 leadership-claim sites + heartbeat now use atomic RPC; heartbeat demotes itself if lease lost
- `src/stores/timer.ts`: passes `claimLeadership` through to `useTimerSync` deps

---

### ~~BUG-1512~~: Timer session expires while app closed — silently discarded (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: When app reopens and recovery detects `remainingTime <= 0`, it marks session inactive but never calls `completeSession()`. No pomodoro count, no XP, no history entry.

**Fix**: In `useTimerSync.ts` recovery path, set `currentSession.value` with the expired session (remainingTime=0) then call `onCountdownComplete()` instead of the manual DB-only update. This routes through `completeSession()` for full credit.

---

### ~~BUG-1513~~: Double XP under dual timer leadership (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14, resolved by BUG-1511 fix)

**Problem**: When two devices are both timer leaders (BUG-1511), both independently call `completeSession()` and award XP. The `isCompleting` lock only protects within a single JS context.

**Fix**: Resolves automatically when BUG-1511 is fixed (atomic leadership).

---

### ~~BUG-1514~~: Auth refresh fails after offline — pending writes permanently orphaned (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: When token expires offline and refresh fails on reconnect, `auth.ts` cleared the session unconditionally on the first refresh attempt. Pending sync writes were orphaned with no auth token and permanently failed.

**Fix**: Replaced the single raw `refreshSession()` call in the `window.addEventListener('online', ...)` handler with a retry loop (up to 3 attempts, exponential backoff: 1s, 3s, 9s). Session is only cleared if ALL retries fail. Each attempt is logged. The existing `performTokenRefresh` function (proactive timer refresh) already had retry logic — the online reconnect handler now follows the same pattern.

---

### ~~BUG-1515~~: Undo task completion doesn't revert XP or stats (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: Complete task → earn XP. Ctrl+Z → task goes back to todo. XP stays. No `onTaskUncompleted` hook exists. Exploitable: complete-undo-complete loop for infinite XP.

**Fix**: Added `deductXp()` and `decrementStat()` to `gamification.ts`. Added `onTaskUncompleted()` to `useGamificationHooks.ts`. Wired into the `wasDone && isNowNotDone` branch in `taskOperations.ts`. Levels are intentionally not decremented (they are permanent). XP deduction is clamped at 0. Negative xp_log entries written for auditability.

---

### ~~BUG-1516~~: Multi-device edit overwrites — whole-document LWW loses field-level changes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: Sync payload includes ALL task fields, not just changed ones. Edit title on phone, edit description on desktop → last save overwrites the other's field. Silent data loss.

**Fix**: Track which fields changed in `updateTask`, send only those in the sync payload.

---

### ~~BUG-1517~~: Auth token expires mid-sync — remaining operations permanently abandoned (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: 401 during sync is classified as `permanent` error. Retry set to 1 year out. All remaining queued operations also fail and get abandoned. No token refresh attempted.

**Fix**: Add `auth` error category in retry strategy. On 401, call `supabase.auth.refreshSession()` before retrying. Only permanent-fail if refresh itself fails.

---

### ~~BUG-1530~~: Dragging task to Today canvas group doesn't update Calendar inbox (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: When a task is dragged into the "Today" group on the canvas, the due date gets set to today but the task doesn't appear in the Calendar inbox when filtered to "Today". The calendar inbox shows stale data and doesn't reflect the canvas group assignment.

**Fix**: Investigate whether the canvas drop handler properly sets `due_date` and whether the calendar inbox's Today filter watches for reactive due_date changes. Likely a reactivity or sync issue between canvas group membership and the calendar view's task filtering.

---

### ~~BUG-1529~~: Context menu shows wrong multi-select count (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-24)

**Problem**: Right-clicking a single task in the calendar/board view shows "Mark 6 as Done" and "Delete 6" instead of just "Mark as Done" — the selection count is wrong, showing stale/phantom selections. The menu displays an inflated count of selected tasks (6) even when only 1 task is actually selected.

**Root cause**: `handleContextMenu` in AllTasksView.vue/TaskList.vue never cleared the multi-selection when right-clicking a task outside the current selection. The stale `selectedTaskIds` persisted, inflating the count shown in the menu.

**Fix applied (2026-03-24)**:
- `AllTasksView.vue` handleContextMenu: clear selection when right-clicked task is not in current selection
- `TaskList.vue` handleContextMenu: same guard before emitting contextMenu event
- `BoardView.vue` onUnmounted: call `taskStore.clearSelection()` to prevent phantom selections across view switches

---

### ~~BUG-1502~~: "Sync external calendars" button doesn't sync Google Calendar (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-12)

**Problem**: Clicking "Sync external calendars" in the calendar header dropdown only triggered iCal sync (`externalCalendar.syncNow`), not Google Calendar sync. Google Calendar events only refreshed on page mount or every 30 minutes via polling interval — manual sync button was ineffective.

**Fix**: Created `syncAllExternalCalendars()` handler in `CalendarView.vue` that calls both `externalCalendar.syncNow()` and `googleCalendar.syncNow()`. Wired it to the `@sync-external-calendar` event.

---

### ~~BUG-1449~~: KDE widget notification barrage + popup dismiss + nanny task selection (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-05)

**Problems**: Six KDE widget bugs — pre-end warning & overlay card inner MouseArea absorbed clicks instead of dismissing; session completion triggered multiple notifications (barrage) when concurrent `checkSessionCompletion()` XHR calls each fired `onSessionComplete()`; nanny popup task click passed pinned_tasks table ID instead of real task ID; nanny popup too narrow (buttons clipped); overlay card too short (dismiss text clipped); Start Work button used solid fill.

**Fixes**: Dismiss on card click; dual barrage guard (`checkingCompletion` + `sessionJustCompleted`); nanny uses `selectPinnedTask()`; popup 500x380; overlay card height 400; glass morphism button.

---

### ~~BUG-1432~~: Overdue tasks display today's date instead of actual due date (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-05)

**Problem**: Tasks that should appear as overdue are shown with today's date everywhere — visible in the "Today" group on the canvas. Their actual due date is being overwritten or misread as the current date.

**Root cause**: Two paths: (1) `useMoveToCanvasGroup.ts` — "Move to Group" context menu blindly spread `getSectionProperties()` into task updates, overwriting existing dueDate with today's date. (2) `taskValidation.ts` sanitizer defaulted missing dueDate to today instead of empty string.

**Fix**: Added dueDate guard in `useMoveToCanvasGroup.ts` (matching existing guard in `useUnifiedInboxActions.ts`). Changed sanitizer fallback to empty string.

---

### ~~BUG-1430~~: Sidebar Date Filters Navigate to Catalog View (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-02)

**Problem**: Clicking "Today", "This Week", or other smart view filters in the sidebar navigated users to the Catalog view (`/tasks`) instead of staying on the current view (Canvas, Board, Calendar).

**Root cause**: `AppSidebar.vue:976` had an unconditional `router.push('/tasks')` in the local `selectSmartView` function (from TASK-1330).

**Fix**: Made navigation conditional — only navigate to `/tasks` if the current route doesn't support smart view filters (Canvas `/`, Board `/board`, Calendar `/calendar`, Catalog `/tasks`/`/catalog` all support them natively).

---

### ~~BUG-1429~~: Calendar Inbox Duplicate Display (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-02)

**Problem**: Tasks dragged from Calendar Inbox onto calendar grid remain visible in the inbox after being scheduled, creating duplicate task entries.

**Root cause**: TASK-1412 added `canvasOrder` sort which bypasses the scheduling check in `useUnifiedInboxState.ts`. When a task is dragged to the calendar and assigned a date, the inbox filter should remove it (task is now scheduled), but the inbox still displays it due to the filter logic being skipped.

**Fix** (in progress):
1. `useUnifiedInboxState.ts`: Restore scheduling check in filter logic even when using `canvasOrder` sort
2. Verify inbox filter properly excludes scheduled tasks regardless of sort mode
3. Test drag-drop from inbox to calendar grid doesn't leave duplicate entries

---

### ~~BUG-1411~~: Supabase fetch timeout storm — cascading AbortErrors crash sync (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-23)

**Problem**: `fetchActiveTimerSession` polls every ~10s. When VPS/network is slow, each call times out at `supabase.ts:105` (`AbortError`), spawning 3 retries (500ms → 1s → 2s). Before retries finish, the next poll fires — creating overlapping retry cascades.

**Fix** (7 files changed + 1 new):
1. **Timer poll guards** (`useTimerSync.ts`): `isSaving` mutex on heartbeat, `isPolling` mutex on follower poll, consecutive failure backoff (30s after 3 failures)
2. **Fetch timeout 10s → 30s** (`supabase.ts`): VPS can be slow under load, 10s was too aggressive
3. **Offline-first read cache** (`readCacheDB.ts` NEW): Dexie IndexedDB database caches tasks/groups/projects after every successful Supabase fetch
4. **Cache fallback** (`taskPersistence.ts`, `projects.ts`, `canvas.ts`): When Supabase is unreachable, load last-known-good data from IndexedDB cache
5. **Offline mode indicator** (`syncStatus.ts`): Shows "Offline — showing cached data (Xmin old)" in sync status
6. **Auto-reconnect** (`useAppInitialization.ts`): Listens for `online` event, auto-reloads from Supabase when connectivity returns
7. **Cache isolation** (`auth.ts`): Clears read cache on sign-out to prevent data leaking between users
8. **75 tests** covering cache CRUD, offline fallback cycles, large datasets, sign-out isolation

---

### ~~BUG-1410~~: Done tasks still appear on canvas after marking as done (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-13)

**Problem**: When marking a task as done, it remains visible on the canvas instead of being removed/hidden.

**Root causes**: (1) Auto-archive didn't increment `positionVersion`, so sync could restore old position. (2) Sync handler restored canvas positions for done tasks. (3) No UI toggle to control `hideCanvasDoneTasks` on canvas.

**Fix**: 4 changes across 3 files:
1. `taskOperations.ts`: Auto-archive now increments `positionVersion`; merge respects it via `syncedUpdates.positionVersion ?? newVersion`
2. `tasks.ts`: Sync handler skips position restoration for `status === 'done'` tasks (2 locations)
3. `CanvasToolbar.vue`: Added "Show/Hide done tasks" toggle button

---

### ~~BUG-1408~~: Canvas tasks get blurry when zooming out (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-23)

**Problem**: Task nodes on the canvas become blurry/pixelated when zooming out. Regression from BUG-1216 which removed `transform-style: preserve-3d` and changed `backface-visibility` to `hidden` on the viewport.

**Fix**: Restored `transform-style: preserve-3d !important` and `backface-visibility: visible !important` on `.vue-flow__transformation-pane`/`.vue-flow__viewport` in `vue-flow-overrides.css`. This prevents the browser from flattening all nodes into a single bitmap texture — each node renders independently at display resolution, staying crisp at any zoom level.

---

### ~~TASK-1428~~: Auto-inherit group properties when creating task in a group (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-03)

**Problem**: Creating a task inside a group like "Today" should automatically assign that group's properties to the new task (e.g., today's due date). Currently the user must manually set properties after creation.

**Scope**: Investigate which group types carry inheritable properties (date-based groups, status groups, priority groups, project groups) and implement reliable auto-assignment on task creation within those groups.

---

### ~~TASK-1412~~: Calendar Inbox Canvas Order Sort — right-to-left DFS + sort direction toggle (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Problem**: The Calendar inbox `canvasOrder` sort used simple group X position (left→right), without connection-aware DFS for nested tasks and with no way to reverse the order. Users wanted right-to-left ordering (rightmost canvas columns first) and a toggle to flip any sort direction.

**Fix**:
1. `useUnifiedInboxState.ts`: Added `SortDirection` type + `sortDirection` persistent state. `canvasOrder` now sorts groups by descending X (right-to-left), then DFS within each group using `parentTaskId` tree structure. Other sort modes multiplied by `dir` to support asc/desc.
2. `UnifiedInboxPanel.vue`: Destructures and passes `sortDirection` down to header.
3. `UnifiedInboxHeader.vue`: Imports `SortDirection`, adds prop + emit, passes to `InboxFilters`.
4. `InboxFilters.vue`: Imports icons + type, adds prop/emit, renders toggle button after canvas-order sort button.

---

### ~~TASK-1435~~: Active Task Glass Pill — KDE Companion Widget + AppHeader (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-03)

**Problem/Opportunity**: When a Pomodoro timer is running on a task, the user wants to see the active task name at a glance — both in the web app header and in the KDE Plasma panel next to the timer widget.

**Approach**: Two-part implementation:
1. **Web app**: Glass-morphism pill in `AppHeader.vue` next to the timer, showing project color dot + task name with smooth enter/leave transitions
2. **KDE Plasma widget**: Separate companion widget (`com.pomoflow.activetask`) that reads task state from `/tmp/flowstate-active-task.json` written by the main timer widget via a temp file bridge

**Key decisions**:
- Temp file bridge avoids duplicating Supabase auth in the companion widget
- Main widget resolves task name inline in `writeActiveTaskFile()` for reliable reactivity
- Companion widget uses `Plasma5Support.DataSource` with shell `cat` command (not XMLHttpRequest, which is sandboxed in Plasma widgets)

**Steps**:
- [x] ~~AppHeader.vue: add glass pill with project dot + task name + transitions~~ ✅
- [x] ~~Main KDE widget: add `currentTaskName` property + `writeActiveTaskFile()` bridge~~ ✅
- [x] ~~New KDE widget: `packages/kde-widget-active-task/` with compact pill + full popup~~ ✅
- [x] ~~Install script + metadata.json for `com.pomoflow.activetask`~~ ✅

---

### ~~TASK-1424~~: KDE Widget Nanny Notifications — Schedule-Gated Idle Reminders (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-03)

**Problem/Opportunity**: User wants a gentle reminder from the KDE widget when no Pomodoro session is active during configured work hours. Must be helpful without being counterproductive (notification fatigue, guilt, off-hours annoyance).

**Research findings**: Clockify/Toggl Track model is best practice — schedule-gated, low-frequency, invitation-framed. Guilt framing (Duolingo-style) backfires long-term. Key: reminders should feel like a friendly assistant, not a boss.

**Approach** (evidence-based):
1. **Settings**: opt-in (default OFF), configurable work hours (Mon-Fri 9am-6pm default), trigger threshold (30/60/90 min of no active session), intensity/tone preference
2. **Trigger logic**: `IF (current day in active_days) AND (current time in work_hours) AND (no timer running for >= threshold) THEN notify`
3. **Notification**: KDE system notification with positive framing, rotating message bank (5-10 variants), one-click "Start Session" action
4. **Escape valves**: "Snooze 1hr", "Quiet today", configurable or disable entirely
5. **Never fire** if Pomodoro or break timer is currently active
6. **Cap**: max 1 notification per hour

**Steps**:
- [ ] Add nanny notification settings to KDE widget config UI (enable/disable, work hours, days, interval, tone)
- [ ] Implement idle detection timer in widget (poll timer status, track idle duration)
- [ ] Create message bank with 5-10 positive-framed rotation variants
- [ ] Wire KDE system notifications with "Start Session" + "Snooze" actions
- [ ] Add "Quiet today" toggle to widget UI
- [ ] Test edge cases (break timer active, outside work hours, snooze expiry)

---

### ~~FEATURE-1414~~: Task Image Attachments via Google Drive (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-02)

**Problem/Opportunity**: Users want to attach images to tasks. VPS storage is limited (Contabo), so images must be stored externally. Google Drive is the chosen backend — user already has Google OAuth configured via Supabase for Calendar integration.

**Approach**: Add `drive.file` scope to existing OAuth, create `google-drive-proxy` edge function (mirrors calendar proxy pattern), add `attachments` JSONB column to tasks table, build drag-drop upload UI in task editor. Client-side image compression (max 1920px, JPEG 0.8). Files stored in auto-created `FlowState/` Drive folder. Client-side thumbnail generation for instant preview.

**Steps**:
- [x] ~~Add `drive.file` scope to OAuth in `auth.ts`~~ ✅
- [x] ~~Rename calendar-specific token keys to generic (`googleCalendarToken` → `googleProviderToken`)~~ ✅
- [x] ~~Create `google-drive-proxy` edge function~~ ✅
- [x] ~~Create `googleDriveService.ts` client service~~ ✅
- [x] ~~Add `TaskAttachment` type + `attachments` field to Task + mappers + migration~~ ✅
- [x] ~~Build `TaskAttachments.vue` upload UI in task editor~~ ✅
- [x] ~~Self-hoster setup guide (SOP-038)~~ ✅

---

### ~~TASK-1409~~: Highlight active/in-progress tasks in Calendar view (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-23)

**Problem**: In the Calendar day/week view, tasks that are active (status = "in progress") look identical to other tasks. They should have a visual highlight (e.g., teal border glow or accent indicator) so the user can instantly see what they're currently working on.

**Fix**: Added `status-active` CSS class to all 3 calendar views (Day, Week, Month). In-progress tasks get a teal left border (`--brand-primary`) with subtle inset glow (`--brand-primary-dim`). Follows same pattern as existing `status-done` class. Uses design tokens only — no hardcoded colors.

---

### ~~TASK-1405~~: Replace LLM Distribution with Deterministic Algorithm in Weekly Plan (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Weekly Plan AI used LLM (Llama 3.3 70B via Groq) to assign tasks to days. Even with detailed MANDATORY RULES prompts, the LLM ignored routine preferences, misplaced tasks, and produced generic reasoning.

**Fix**: Replaced Step 1 (LLM distribution) with a deterministic 4-tier algorithm:
- **Tier 1**: Hard constraints (due dates, routine keyword matches from memory graph)
- **Tier 2**: Urgency (overdue spread via round-robin across Mon-Wed, in-progress early)
- **Tier 3**: Priority (high-priority on peak days, top-priority project batching)
- **Tier 4**: Fill (day scoring by capacity, project batching, complexity/meeting-day penalties)

Kept: LLM week theme (Step 3), dynamic questions, all memory/profile infrastructure. Removed ~300 lines of LLM prompt building + rebalancer + fallback plan code.

---

### ~~TASK-1403~~: Recurring Tasks — Clone-on-Complete with recurrence_rule column (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-22)

Added `recurrence_rule`, `recurrence_parent_id`, `recurrence_count` columns to tasks table. When a recurring task is completed, the system clones it as a new task with the next due date. Replaces old pre-generated instances approach.

### ~~TASK-1402~~: Decouple canvas/calendar inbox filtering — isInInbox now user-controlled (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-22)

**Problem**: Placing a task on canvas set `isInInbox: false`, hiding it from **both** canvas AND calendar inboxes. Same for scheduling on calendar. `isInInbox` was auto-toggled by 13 placement actions instead of being a user-controlled flag.

**Fix**: Removed all 13 auto-set `isInInbox: false` from placement actions across 10 files. Inbox visibility now uses position-based filtering: canvas inbox checks `!canvasPosition`, calendar inbox checks `!isScheduledOnCalendar`. `isInInbox` is now purely a user-controlled "remove from inbox" flag. Data migration applied (213 rows restored on VPS).

---

### ~~BUG-1407~~: Canvas node connections don't work (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-23)

**Problem**: Cannot connect canvas task nodes by dragging from handle to handle. Connections silently fail with no feedback.

**Root Cause**: 5 issues: (1) `connect-on-drag-nodes` invalid Vue Flow prop (silently ignored), (2) no `connectionMode` (default "strict" too restrictive), (3) no `connectionRadius` (20px too small), (4) silent rejection when target had `parentTaskId` (no re-parenting), (5) `syncEdges()` without `force: true`.

**Fix**: Removed invalid prop, added `connection-mode="loose"` + `:connection-radius="30"`, allowed re-parenting, force-synced edges on user-initiated connections.

---

### ~~BUG-1404~~: Context menu dropdowns don't work from search right-click (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-22)

**Problem**: Right-clicking a task in the SearchModal (Cmd+K) opens the TaskContextMenu correctly, but the hover submenus (Project, Status, Duration) are unreachable — they render behind the search overlay.

**Root Cause**: Z-index layering. SearchModal overlay is `z-index: 1400` (`--z-popover`). TaskContextMenu is `z-index: 9999` (above overlay ✅). But submenus are Teleported to `<body>` with `z-index: calc(--z-dropdown + 1) = 1001` — below the search overlay (1400) ❌.

**Fix**:
1. All 4 submenu components: Changed `z-index` from `calc(var(--z-dropdown) + 1)` to `10001` (above search overlay)
2. `SectionSelector.vue`: Added missing `class="select-dropdown"` + `ref="dropdownRef"` on Teleported div, fixed click-outside handler with `capture: true`, fixed CSS syntax error
3. `useAppShortcuts.ts`: Added `event.code === 'KeyF'` for Hebrew keyboard layout compatibility

**Files Changed**: `StatusSubmenu.vue`, `DurationSubmenu.vue`, `ProjectSubmenu.vue`, `MoreSubmenu.vue`, `SectionSelector.vue`, `useAppShortcuts.ts`

---

### ~~TASK-1488~~: Fix Search Modal Z-Index — Confirmation Dialog Hidden Behind Overlay (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-08)

**Problem**: When deleting a task from search results via right-click context menu, the ConfirmationModal opens BEHIND the SearchModal overlay and is invisible. Additionally, search results would close unexpectedly after certain context menu actions.

**Root Cause**: Z-index layering issue. SearchModal used `--z-modal: 1300` and ConfirmationModal (BaseModal) also used `--z-modal: 1300`. Since both have the same z-index in ModalManager, and ConfirmationModal is rendered first in the DOM (line 65-73 before SearchModal at 76-81), the SearchModal appeared on top, blocking the confirmation dialog.

**Fix**:
1. `ConfirmationModal.vue`: Added `class="confirmation-modal-override"` to BaseModal wrapper
2. Added CSS rule `:deep(.confirmation-modal-override .modal-overlay) { z-index: var(--z-toast); }` to elevate ConfirmationModal to `--z-toast: 1450` (above SearchModal's 1300)
3. Result: Confirmation dialogs now always appear on top of search modals, and users can interact with them properly

**Files Changed**: `src/components/common/ConfirmationModal.vue`

---

### ~~BUG-1490~~: KDE Widget Stops Syncing — Token Refresh Chain Break (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-09)

**Problem**: KDE widget silently stops syncing with the main app after some period. Tasks, pinned tasks, and projects stop updating and require a manual widget restart to recover.

**Root Cause**: Three compounding bugs in `main.qml`:
1. **Token refresh timer chain break**: `tokenRefreshTimer` has `repeat: false`. On network errors or non-200/non-401 responses, `refreshAccessToken()` never restarts the timer → token eventually expires → all polling silently fails with auth errors.
2. **Missing 401 handling in fetch functions**: Only `fetchCurrentSession` handled 401 by calling `refreshAccessToken()`. `fetchTasks`, `fetchPinnedTasks`, and `fetchProjects` just logged and silently failed when the token expired mid-session.
3. **`isRefreshingToken` deadlock**: If an XHR hangs (network issue), `isRefreshingToken` stays `true` forever, blocking all future refresh attempts permanently.

**Fix**:
1. Added fallback `else` branch in `refreshAccessToken()` for non-200/non-400/401 statuses: restarts timer with 60s retry interval. Also restores normal interval on success.
2. Added `401 → refreshAccessToken()` handling to all three fetch functions.
3. Added `refreshTokenStartTime` property + timestamp-based stuck detection: if `isRefreshingToken` is true for >30s, forces reset and proceeds.

**Files Changed**: `packages/kde-widget/contents/ui/main.qml`

---

### ~~BUG-1492~~: Canvas Position Drift — Consecutive Drags Cause parentId Flip-Flopping (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Dragging canvas tasks in quick succession causes visible position drift. Tasks alternately get assigned to a group and then back to root on each drag.

**Root Cause A — BUG-1191 handler skips saves**: The stale-parentNode guard in `useCanvasInteractions.ts` detected when Vue Flow's `node.parentNode` diverged from the store's `task.parentId` (valid during rapid consecutive drags before VF syncs). It was restoring the node position from the store (overwriting the user's actual drag position) and calling `continue` to skip saving. This threw away Drag N+1's real position, causing drift.

**Root Cause B — Containment padding gap causes flip-flop**: The "still inside parent" early-exit used `padding=2` while `getDeepestContainingGroup` used `padding=10`. A task with center 2–10px from the group edge failed the early-exit check, fell through, failed containment detection, and was assigned as root. Next drag with 16px grid snap shifted it back in → assigned to group. This cycled on every drag.

**Fix**:
1. **BUG-1191 handler**: Removed position restoration and `continue`. Now only fixes `node.parentNode` alignment and falls through to the normal path which uses the snapshotted absolute position (always the correct visual position).
2. **Hysteresis padding**: Changed both containment checks from `padding=2` to `padding=-20`. Negative padding expands the parent boundary outward by 20px — a task only detaches when dragged >20px outside the boundary. The 16px grid snap can never cause a flip-flop across a 20px hysteresis zone.

**Files Changed**: `src/composables/canvas/useCanvasInteractions.ts`

---

### ~~BUG-1493~~: Catalog view — collapsed state resets, expand/collapse broken, cross-group drag regression (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-09)

**Problems**:
1. `expandedGroups` in `TaskList.vue` is a plain `ref<Set>` — resets to all-expanded on every remount (navigation away and back).
2. `expandAll()`/`collapseAll()` work momentarily but reset on next reactive update or remount.
3. Cross-group drag in Catalog view (e.g., Overdue → Today with dueDate grouping) may be broken.

**Fix**: Persist collapsed group keys in localStorage via `usePersistentRef`, key `flowstate:catalog-collapsed-groups`. Update `toggleGroupExpand`, `expandAll`, `collapseAll`, initialization, and the new-group watcher to respect persisted state. Investigate drag regression.

**Files**: `src/components/tasks/TaskList.vue`

---

### ~~BUG-1320~~: Production console log spam — WakeLock, LWW echo, legacy IDs, Realtime drops (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Production console (in-theflow.com) flooded with 5 categories of noise:
1. Hundreds of `[WakeLock] Failed to request wake lock: DOMException` when tab is hidden
2. `[SYNC] LWW: Server wins` on every sync cycle (echo from direct save + sync queue race)
3. `[SUPABASE-MAPPER] Invalid UUID detected` on every sync for legacy group "Today"
4. `[REALTIME] Connection dropped (CHANNEL_ERROR)` when browser suspends background WebSockets
5. Transient CORS/network failures from ServiceWorker during tab sleep (handled by existing retry)

**Fix**: 4 targeted changes:
- `useWakeLock.ts`: Guard `requestWakeLock()` with `document.visibilityState === 'hidden'` check
- `useSyncOrchestrator.ts`: Downgrade LWW echo logs (delta < 2s) from `warn` to `debug`
- `supabaseMappers.ts`: Deduplicate warnings via `Set` — legacy group/UUID warnings fire once per session
- `useSupabaseDatabase.ts`: Downgrade CHANNEL_ERROR/CLOSED to `debug` when tab is hidden

**Files**: `src/composables/useWakeLock.ts`, `src/composables/sync/useSyncOrchestrator.ts`, `src/utils/supabaseMappers.ts`, `src/composables/useSupabaseDatabase.ts`

---

### ~~TASK-1337~~: Storybook Design Streamlining — Align All Stories with Design System (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-02)

**Goal**: Review and streamline every Storybook story to use the project's design system consistently. Replace all non-design-system elements with proper project components and tokens.

**What "Streamlining" Means**:
- Native `<select>` → `CustomSelect.vue`
- Native checkboxes → project checkbox components
- Hardcoded colors → design tokens from `design-tokens.css`
- Solid-fill buttons → glass bg + colored border pattern (`--glass-bg-soft` + `backdrop-filter: blur(8px)`)
- Any non-glass-morphism UI → proper glass morphism styling
- Primary action color is TEAL (`--brand-primary` / #4ECDC4), NOT green

**Progress Tracker**: `.claude/storybook-review-progress.md` (163 stories, 18 categories)

**Categories** (in review order):
- [ ] ai (4 stories)
- [ ] auth (8 stories)
- [ ] calendar (5 stories)
- [ ] canvas (15 stories) — 1 done (MultiSelectionOverlay)
- [ ] canvas/inbox (3 stories)
- [ ] canvas/node (6 stories)
- [ ] design-system (1 story)
- [ ] gamification (11 stories)
- [ ] kanban (7 stories)
- [ ] layout (12 stories)
- [ ] modals (12 stories)
- [ ] primitives (21 stories)
- [ ] pwa (1 story)
- [ ] settings (11 stories)
- [ ] task-management (22 stories)
- [ ] task-management/context-menu (3 stories)
- [ ] task-management/row (4 stories)
- [ ] views (8 stories)

**Related**: ~~BUG-1311~~ (3 story files fail to import — ✅ FIXED 2026-02-17)

---

### ~~BUG-1290~~: Week View Not Loading (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: Calendar week view doesn't render at all. Switching to week mode shows blank content.

**Root Cause**: `CalendarWeekView.vue` injects `getWeekEventStyle` and `isCurrentWeekTimeCell` from `calendar-helpers`, but `CalendarView.vue` never provides them. Both functions are `undefined`, crashing the week view template when `:style="getWeekEventStyle(event)"` is called.

**Fix**: Added `getWeekEventStyle` and `isCurrentWeekTimeCell` to the `provide('calendar-helpers')` object in `CalendarView.vue` and destructured them from `weekView` composable.

**Files**: `src/views/CalendarView.vue`

**Progress (2026-02-10):** Root cause identified and fixed — added missing `getWeekEventStyle` and `isCurrentWeekTimeCell` to `provide('calendar-helpers')`. Type-check passes. Awaiting user verification.

---

### ~~BUG-1218~~: RTL Missing in Calendar Task Create Dialog and Timer Task Name (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: The Calendar-specific QuickTaskCreate dialog and the header timer task name don't support RTL/Hebrew text, while the rest of the app does. Hebrew text in the calendar task title input shows LTR cursor position. Timer task name in the header bar doesn't auto-detect Hebrew direction.

**Fix**:
1. Add `useHebrewAlignment` to `QuickTaskCreate.vue` (Calendar variant) — matches `QuickTaskCreateModal.vue`
2. Fix `.timer-task` CSS in `AppHeader.vue` — use `unicode-bidi: plaintext` unconditionally instead of `:dir(rtl)` selector that never matches in LTR documents

---

### ~~TASK-1220~~: Quick Sort Pull-Down Capture Panel (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Goal**: When user drags the screen down in any mobile view, reveal a command center panel with:
- Search existing tasks
- Create a new task (spacious input with keyboard)
- Record a task with audio (voice-to-text via Whisper)
- Quick action tiles: Quick Sort, Timer, Today, Settings

**Changes**: Implemented as pull-down gesture in `MobileLayout.vue` (available from ALL mobile views, not just Quick Sort). Panel includes task input, voice recording, search with results, and 4 action tiles.

**Files**: `src/mobile/layouts/MobileLayout.vue`

---

### ~~BUG-1286~~: PWA Today View Shows 2:00 AM on All Tasks Due to UTC Timezone Parsing (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Tasks in the Mobile Today View all showed "2:00 AM" even though the user never set any due time. Additionally, the time-based grouping broke — all untimed tasks landed in "Evening" instead of "Anytime Today".

**Root Cause**: `MobileTodayView.vue` extracted time from `dueDate` (a date-only field) instead of checking the explicit `dueTime` field. Date-only strings like "2026-02-08" are parsed by `new Date()` as UTC midnight, which becomes 2:00 AM in Israel (UTC+2). The untimed task filter used `getHours() === 0` which only works in UTC+0 and fails in other timezones.

**Fix Applied (2026-02-08)**:
1. **Changed `getTaskHour()`** — Now uses `task.dueTime` instead of parsing time from `dueDate`
2. **Fixed untimed task filter** — Changed from `getHours() === 0` to `getTaskHour() === null`, making it timezone-agnostic
3. **Replaced `formatDueTime()`** — Now uses `getDueBadge()` which only shows time when explicit `dueTime` is set
4. **Fixed `sanitizeTimestamp()` in supabaseMappers.ts** — Preserves date-only strings (YYYY-MM-DD) instead of converting to UTC ISO

**Files Changed**:
- `src/mobile/views/MobileTodayView.vue` — Display and grouping fixes
- `src/utils/supabaseMappers.ts` — Preserve date-only strings

**Test Case**: Create a task with due date "2026-02-08" but no due time. In Israel (UTC+2), it should show "Anytime Today", not "2:00 AM".

---

### ~~BUG-1204~~: Challenges Table 404 / Initialization Failure (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Console errors show `user_challenges` table returning 404 and `[Challenges] Initialization failed`. The challenges migration existed locally but was never applied to the VPS database.

**Root Cause**: VPS has no Supabase CLI migration tracking (`supabase_migrations.schema_migrations` doesn't exist). Migrations were applied manually via direct SQL but the challenges migration was missed.

**Additional Issue Found**: Two conflicting migration files existed (`20260206070234` and `20260206163002`) creating the same tables with different schemas. Code expected columns from both (e.g., `created_at`/`updated_at` from older, computed `completion_rate` from newer).

**Fix Applied (2026-02-07)**:
1. Merged both migrations into single canonical file (`20260206163002_challenges.sql`)
2. Deleted duplicate migration (`20260206070234_challenges.sql`)
3. Applied merged migration directly to VPS via SSH (`docker exec -i supabase-db psql`)
4. Verified PostgREST serves both endpoints (HTTP 200)

**Tables Created**: `user_challenges`, `challenge_history` (VPS now has 19 tables)
**Columns Added to `user_gamification`**: 9 new RPG fields (corruption, multiplier, class, counters)
**Also Created**: RLS policies, indexes, helper functions, auto-archive trigger, realtime subscription

**Known Remaining Issue**: `updateChallengeCounters()` uses `supabase.rpc('increment')` which doesn't exist — but the function is scaffolded MVP code that just logs (line 680). Not blocking.

**Errors**:
- `Failed to load resource: 404 (Not Found) (user_challenges)` — **FIXED**
- `[Challenges] Initialization failed` — **FIXED** (pending user verification)

---

### ~~TASK-1217~~: Add "Today" Filter to KDE Plasma Widget (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-22)

Add a "Today" button/filter option to the KDE Plasma widget's task list that filters to only show tasks with today's due date. Queries `due_date` column via Supabase REST API.

**Files**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~TASK-1177~~: Offline-First Sync System to Prevent Data Loss (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-23)

**Problem**: User lost significant work on production (in-theflow.com) due to silent sync failures.

**Root Causes Identified** (6 agents investigated):
1. **Silent error swallowing** (`taskOperations.ts:290-301`) - Save failures logged but not retried
2. **Smart merge drops tasks** (`taskPersistence.ts:272-287`) - Local-only tasks dropped after 5 min
3. **No write queue** - Failed writes lost forever
4. ~~**Optimistic UI no rollback**~~ ✅ - updateTask now has rollback on failure (Phase 4)
5. **Sync timeout silent** (`useNodeSync.ts:252-256`) - Timeout errors explicitly silenced
6. **No beforeunload** - Can close tab with unsaved data

**Solution Architecture (Offline-First)**:

1. ~~**Phase 1: Write Queue with IndexedDB**~~ ✅ (P0)
   - All writes go to IndexedDB FIRST, then sync to Supabase
   - Retry with exponential backoff: 1s, 2s, 4s, 8s... up to 60s max
   - 10 retry attempts before marking as "failed" (requires manual retry)
   - Never discard operations - persist until confirmed synced

2. ~~**Phase 2: Sync Status Indicator**~~ ✅ (P0)
   - Visual indicator in AppHeader.vue control panel
   - States: Synced (green), Syncing (blue), Pending (amber), Error (red), Offline (gray)
   - Error state NEVER auto-dismisses

3. ~~**Phase 3: Fix Smart Merge Logic**~~ ✅ (P0)
   - NEVER drop local-only tasks automatically
   - Queue for sync retry instead

4. ~~**Phase 4: Add Rollback to updateTask**~~ ✅ (P1) — DONE 2026-02-23
   - ~~Capture previous state before update~~
   - ~~Rollback local state on failure~~
   - Synchronous rollback via `persisted` flag: snapshot → optimistic mutation → track persistence → rollback if ALL paths fail
   - `onPermanentFailure` pub/sub callback in sync orchestrator for UI notification
   - Removed unused `RollbackState<T>` type

5. ~~**Phase 5: beforeunload Protection**~~ ✅ (P1)
   - Warn user before closing tab with unsaved changes

**Files to Create**:
- `src/types/sync.ts` - WriteOperation, WriteConflict, SyncStatus types
- `src/services/offline/writeQueueDB.ts` - Dexie.js IndexedDB schema
- `src/services/offline/operationSorter.ts` - Create→Update→Delete ordering
- `src/services/offline/operationCoalescer.ts` - Merge multiple updates
- `src/services/offline/retryStrategy.ts` - Exponential backoff calculation
- `src/composables/sync/useSyncOrchestrator.ts` - Main queue processing
- `src/stores/syncStatus.ts` - Pinia store for sync state
- `src/components/sync/SyncStatusIndicator.vue` - Header indicator
- `src/components/sync/SyncErrorPopover.vue` - Error details popover
- `src/composables/useBeforeUnload.ts` - Page close protection

**Files to Modify**:
- `src/stores/tasks/taskOperations.ts` - Use sync queue, add rollback
- `src/stores/tasks/taskPersistence.ts` - Fix smart merge, extend protection
- `src/stores/tasks.ts` - Fix 5s pending timeout
- `src/layouts/AppHeader.vue` - Add SyncStatusIndicator

**Success Criteria**:
- [x] User NEVER loses data, even with network failures
- [x] User ALWAYS sees current sync status
- [x] User CANNOT close tab with unsaved changes (without warning)
- [x] Failed syncs retry automatically with backoff
- [x] Offline edits persist across browser sessions
- [x] Smart merge NEVER drops local-only tasks

---

### ~~BUG-1182~~: saveTasks Fails After Realtime Disconnect (✅ DONE)

**Root Cause**: After sleep/wake, the JWT token expires but `withRetry()` retries 401 errors with the same stale token (all 3 attempts fail). The save failure was silently swallowed in `saveTasksToStorage()`, causing data loss.

**Fix (3 layers)**:
1. Token refresh in `withRetry()` before retrying on 401/403 (`useSupabaseDatabase.ts`)
2. Proactive token refresh on visibility change / wake-up (`useSupabaseDatabase.ts`)
3. Surface save failures when authenticated — re-throw instead of silently swallowing (`taskPersistence.ts`)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: After realtime connection drops (BUG-1179), task save operations fail:
```
i@.../index-CAXNPz-Z.js:144:4526
saveTasks@.../index-CAXNPz-Z.js:144:14019
```

---

### ~~TASK-1128~~: Add "Create Group From Selection" Context Menu Option (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Feature**: When multiple tasks are selected on canvas, right-click should show "Add to New Group" option that:
1. Creates a new group at the bounding box location of selected tasks
2. Automatically parents all selected tasks to the new group
3. Sizes the group to contain all selected tasks with padding

**Implementation**:
- [x] Add context menu option when `selectedNodes.length > 1`
- [x] Calculate bounding box of selected nodes
- [x] Create group with appropriate position and dimensions
- [x] Update selected tasks' parentId to new group

**Awaiting**: User verification

**Files Changed**:
- `src/components/canvas/CanvasContextMenu.vue` - Added "Add to New Group" menu option
- `src/components/canvas/CanvasContextMenus.vue` - Event forwarding
- `src/composables/canvas/useCanvasActions.ts` - `createGroupFromSelection()` implementation
- `src/views/CanvasView.vue` - Wired up event handler

---

### ~~BUG-1103~~: Local Dev Auth Signs Out Both Tabs on Second Tab Sign-In (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-28)

**Problem**: In local development, when user has two browser tabs open:
1. Sign in on first tab - works
2. Open second tab and try to sign in
3. Both tabs get signed out

**Symptoms**: Auth session not persisting across multiple browser tab instances during local development.

**Likely Causes**:
1. Session token overwrite/conflict between tabs
2. `onAuthStateChange` listener firing logout event to all tabs
3. Supabase local storage key collision
4. Race condition in auth initialization across tabs

**Files to Investigate**: `src/stores/auth.ts`, `src/services/auth/supabase.ts`

**Related**: BUG-1086 (auth persistence issues on VPS)

---

### ~~BUG-347~~: FK Constraint Violation on parent_task_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Root Cause**: Tasks saved with `parent_task_id` refs to deleted tasks, no existence validation, race conditions in batch upserts.

**Solution**: Catch-and-retry on FK error code `23503` - clear parent refs and retry once. Applied in `useSupabaseDatabase.ts` (`saveTask()`, `saveTasks()`).

---

### ~~BUG-309~~: Ctrl+Z Keyboard Shortcut Not Triggering Undo (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Fix Applied**: Added `executeUndo()`, `executeRedo()`, `executeNewTask()` calls + `shouldIgnoreElement()` check in `src/utils/globalKeyboardHandlerSimple.ts`.

---

### ~~TASK-1524~~: Migrate old `recurrence` field to new `recurrenceRule` on app init (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-14)

**Problem**: Tasks created before TASK-1403 use `recurrence: TaskRecurrence` (old format) but not `recurrenceRule: SimpleRecurrenceRule` (new format). Recurring badge, delete dialog, and scheduler all depend on `recurrenceRule`, so old tasks appeared non-recurring.

**Solution**: Created `src/composables/useRecurrenceMigration.ts` with:
- `convertOldToNew(oldRecurrence)` — converts `TaskRecurrence` → `SimpleRecurrenceRule` for patterns `daily`/`weekly`/`monthly`/`yearly` (skips `none` and `custom`)
- `migrateIfNeeded()` — iterates `taskStore._rawTasks`, skips tasks that already have `recurrenceRule`, updates via `taskStore.updateTask()` (hits Supabase), marks done in localStorage key `flowstate-recurrence-migration-v1`
- Migration is idempotent, runs once per device, preserves old `recurrence` field

Wired into `src/composables/app/useAppInitialization.ts` — runs after tasks load (Phase B background refresh), before recurrence scheduler (`useRecurrenceScheduler`).

**Files changed**:
- `src/composables/useRecurrenceMigration.ts` (new)
- `src/composables/app/useAppInitialization.ts` (added migration call)

---

### ~~TASK-1521~~: Calendar day/week drag deferred to mouseup (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-24)

**Problem**: The `_startEventDrag` (day view) and `_startWeekDrag` (week view) handlers called `taskStore.updateTask()` inside the mousemove handler on every slot change. This caused excessive DB writes and had no undo support.

**Fix**: Applied preview-then-commit pattern (mirrors the existing resize handler):
- Added `dragPreview` ref in `useCalendarDayView.ts` and `weekDragPreview` ref in `useCalendarWeekView.ts`
- `getEventStyle` / `getWeekEventStyle` use the preview slot/dayIndex during drag for visual feedback
- `mousemove` only updates the local preview refs — zero store writes
- `mouseup` calls `taskStore.updateTaskWithUndo()` once (supports Ctrl+Z)
- `Escape` key cancels the drag with no persistence
- Duplicate-mode (Alt+drag) still creates a task on mouseup only

**Files changed**:
- `src/composables/calendar/useCalendarDayView.ts`
- `src/composables/calendar/useCalendarWeekView.ts`

---

### ~~TASK-1520~~: Add recurring indicator badge to task cards (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-14)

**What**: Added a small `Repeat` icon badge (teal, `var(--brand-primary)`) to task cards in all views when `task.recurrenceRule` is set. Tooltip shows `describeRecurrenceRule()` output (e.g., "Repeats every day").

**Files changed**:
- `src/components/kanban/card/TaskCardBadges.vue` — recurring badge after attachments badge
- `src/components/canvas/node/TaskNodeMeta.vue` — recurring badge with "Recurring" text label + new `recurrenceRule` prop
- `src/components/canvas/TaskNode.vue` — passes `task?.recurrenceRule` to `TaskNodeMeta`
- `src/components/tasks/HierarchicalTaskRowContent.vue` — recurring icon between due date and progress bar

---

### ~~TASK-1525~~: Recurring task delete dialog — Skip/Stop/Cancel (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**What**: Phase 1 of recurring task management. When deleting a recurring task, shows a dialog with three options:
- **Skip this occurrence** — advances recurrence chain to next date (calls `skipRecurringOccurrence()`)
- **Stop all future occurrences** — clears `recurrenceRule` chain-wide (calls `stopRecurrence()`)
- **Cancel** — do nothing

All 11 delete paths in the app now route through the recurrence-aware dialog globally via CustomEvent pattern.

**Files changed**:
- `src/components/modals/RecurrenceDeleteModal.vue` — modal dialog with Skip/Stop/Cancel buttons, shows recurrence preview
- `src/composables/useRecurrenceAwareDelete.ts` — composable that intercepts all delete operations, shows dialog if task is recurring
- `src/stores/tasks/taskOperations.ts` — `skipRecurringOccurrence()` and `stopRecurrence()` operations
- `src/services/modals/ModalManager.ts` — updated to emit custom delete events that composable listens to
- Multiple delete paths updated: Kanban context menu, Canvas context menu, Quick Sort, Calendar drag, Board, etc. (all 11 entry points)

**Key insight**: Instead of updating 11 delete call sites individually, created a global composable that listens for CustomEvent "delete-task" emissions from ModalManager. All delete paths emit the event, composable intercepts and shows dialog if needed.

---

## Active Tasks (IN PROGRESS)

### ~~BUG-1580~~: Replace native confirm() dialogs broken in Tauri/WebKitGTK (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-21)

**Problem**: Three places use native `confirm()` / `window.confirm()` which silently fails in Tauri's WebKitGTK webview — the dialog never appears and the call returns `false`, making task deletion impossible from the canvas.

**Files**:
1. `src/composables/canvas/useCanvasTaskActions.ts:321` — `deleteSelectedTasks()` uses `confirm()`
2. `src/components/canvas/MultiSelectionOverlay.vue:214` — `bulkDelete()` uses `confirm()`
3. `src/components/sidebar/SidebarWorkspaceSwitcher.vue:364` — `handleDeleteWorkspace()` uses `window.confirm()`

**Fix**:
1. `useCanvasTaskActions.ts`: Populate `bulkDeleteItems` + open `isBulkDeleteModalOpen` (same pattern as `useCanvasHotkeys.ts`)
2. `MultiSelectionOverlay.vue`: Route through same canvas bulk delete modal (emit to parent or use modals store)
3. `SidebarWorkspaceSwitcher.vue`: Add `ConfirmationModal` component with reactive state

---

### ~~TASK-1581~~: Audit and update system-architecture.md (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-21)

**Summary**: Comprehensive audit of `docs/claude-md-extension/system-architecture.md` against the actual codebase. Removed stale `architecture.md` (redirected 8 references). Fixed 28 discrepancies: wrong file counts (composables, components, services), missing directories, outdated route info (`/morning` is an overlay not a route), disabled Tauri notification plugin, expanded DB schema from 19→24+ tables, and added new i18n and Utilities sections.

---

### ~~BUG-1437~~: Task doesn't inherit group properties on move (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-03)

**Problem**: When moving a task into a canvas group, the task doesn't inherit the group's properties (e.g., due date from a date-based group). The task retains its old values instead of adopting the group's context.

**Fix**: Removed the overly aggressive BUG-1432 guard (`if (key === 'dueDate' && task.dueDate) continue`) from `src/composables/canvas/useCanvasInteractions.ts` lines 774-779. The guard was inside the `if (targetGroup && oldParentId !== newParentId)` block — meaning it only ran on cross-group moves anyway. The outer condition already prevents same-group repositioning from overwriting dates, making the inner guard redundant and harmful. Cross-group moves now correctly inherit the new group's dueDate.

---

### ~~TASK-1436~~: Active Task Glass Pill next to Pomodoro Timer (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-07)

**Problem**: The Pomodoro timer shows the task name as a small muted text inside the timer display. This lacks visual prominence and doesn't match the glass morphism design system.

**Scope**:
1. Remove old `.timer-task` inline text from timer display
2. Add a separate glass pill component after the timer in `.control-panel`
3. Pill shows project color dot (or emoji) + task name with fade+slide transition

**Files**: `src/layouts/AppHeader.vue`

---

### ~~TASK-1060~~: Infrastructure & E2E Sync Stability (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-22)

**Problem**: Intermittent sync failures across Web, Tauri, PWA, KDE Widget - 0 tasks shown, WebSocket 403 errors, SIGTERM exits.

**Root Causes Found**:
1. CI/CD `deploy.yml` was killing System Caddy, starting Docker Caddy (conflict)
2. SWR cache not invalidated on auth change (fixed in BUG-1056)
3. Silent session refresh failure didn't set error state (fixed 2026-01-30)
4. No retry on initial database load (fixed 2026-01-30)
5. Fetch functions started before auth ready (fixed 2026-01-30)
6. Tauri `.expect()` panic on startup failure (fixed 2026-01-30)
7. Circular dependency causing TDZ error in production build (BUG-1099, fixed 2026-01-30)

**Infrastructure Fixes Applied** (2026-01-24):
- Docker stack stopped, System Caddy re-enabled
- Fixed `deploy.yml` - static files only, graceful Caddy reload

**Phase 2 Fixes Applied** (2026-01-30):
- Mark `initializationFailed` when session refresh fails (`auth.ts`)
- Add retry wrapper (3x with backoff) for initial database load (`useAppInitialization.ts`)
- Add auth initialization guard to `fetchTasks`, `fetchProjects`, `fetchGroups` (`useSupabaseDatabase.ts`)

**Phase 3 Fixes Applied** (2026-01-30):
- Replace `.expect()` panic with graceful error handling + helpful messages (`lib.rs`)

**Phase 4 Audit Findings** (2026-01-30):
- Offline database (`useOfflineDatabase.ts`) is a shell - NOT integrated with Supabase
- Notification fallback lacks action buttons when SW unavailable
- SWR cache 3s stale window acceptable but may cause brief position flash
- Added Caddy systemd auto-restart config

**Remaining Phases** (condensed):
- [ ] Phase 1.3: Verify JWT keys in `/opt/supabase/docker/.env` (requires VPS SSH)
- [x] Phase 2: Auth flow audit + fixes (DONE 2026-01-30)
- [x] Phase 3: Tauri debug + panic fix (DONE 2026-01-30)
- [x] Phase 4: PWA service worker audit (DONE 2026-01-30 - offline DB gap identified)
- [x] Phase 5: KDE widget token refresh on startup (DONE 2026-01-31 - was loading expired tokens)
- [ ] Phase 6: Cross-platform E2E matrix test (requires testing)

**Success Criteria**: Caddy 24h+ uptime, no 0-task loads, Tauri no SIGTERM, PWA overnight persistence.

**Key Files**: `/etc/caddy/Caddyfile`, `src/stores/auth.ts`, `src/composables/useSupabaseDatabase.ts`, `src-tauri/src/lib.rs`, `kde-widget/package/contents/ui/main.qml`

---

### TASK-1214: Child Groups Inherit Parent Group Properties (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (Started: 2026-02-06)

**Problem**: When dropping a task into a nested child group, the task only inherits properties from the immediate child group. Parent group properties (especially dates like "Today") are NOT inherited.

**Expected Behavior**: Task dropped into child group → inherits date from parent group + any properties from child group (child overrides parent for conflicts).

**Solution Implemented**:
1. Added `getParentChain()` utility in `storeHelpers.ts` - traverses from child to parent groups
2. Modified `getSectionProperties()` to traverse parent chain and merge properties (root → child order)
3. Updated `useCanvasInteractions.ts` to pass `allGroups` for inheritance

**Current Status**: Implementation verified with 16 unit tests. Debug logging cleaned up. `applyAllNestedSectionProperties` fixed to thread `allGroups` param.

**Key Files**:
- `src/utils/canvas/storeHelpers.ts` - `getParentChain()` function (cycle-safe, depth-limited)
- `src/composables/canvas/useCanvasSectionProperties.ts` - Parent chain traversal + merge (root→child)
- `src/composables/canvas/useCanvasInteractions.ts` - Passes allGroups to enable inheritance
- `tests/unit/canvas/parentChainInheritance.test.ts` - 16 unit tests covering chain traversal + property merge

---

### ~~TASK-149~~: Canvas Group Stability Fixes (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-04-04)

**Problems**: Position jump during resize, zombie groups, tolerance snapping, inconsistent containment, group duplication.

**Diagnostics**: `assertNoDuplicateIds()` helper in `src/utils/canvas/invariants.ts`.

**Pending Fixes**: 4 (settling flag timing), 5 (remove tolerance snapping), 8 (zombie prevention).

---

### TASK-241: Position Versioning & Conflict Detection (✅ Phase 1 COMPLETE)

**Priority**: P0-CRITICAL | **Status**: ✅ Phase 1 COMPLETE

**Phase 1 Done**:
- [x] SQL migration for `position_version` auto-increment triggers
- [x] `src/utils/canvas/coordinates.ts` - position conversion source of truth
- [x] `src/composables/canvas/useCanvasOperationState.ts` - state machine

**Phase 2 Pending**:
- [ ] Run SQL migration in Supabase Dashboard
- [ ] Wire state machine into `useCanvasOrchestrator`
- [ ] Test: drag → refresh → verify position persists

---

### ~~FEATURE-1223~~: AI Chat System Overhaul — RTL, Inline Editing, Full-Screen, Agent Chains (✅ DONE)

**Priority**: P0-P3 (phased) | **Status**: ✅ DONE (2026-03-25) — Phases 1-3+5 complete. Phase 4 (polish) deferred to P4.

**Problem**: The AI Chat panel has critical UX issues (RTL broken for Hebrew, task names truncated, raw ISO dates, no inline editing) and lacks key features (full-screen mode, conversation history, voice input, gamification integration, multi-step agent workflows).

**5-Agent Expert Research (2026-02-08)**: UX Expert, AI Automation Expert, AI Agent Chains Expert, RTL/i18n Expert, Product Strategy Expert all completed deep analysis. Full findings in conversation history.

#### Phase 1: Fix & Foundation (P0 — IMMEDIATE)

- [x] ~~**TASK-1223**~~: ✅ RTL fix — CSS logical properties, `dir="auto"` on task titles, panel position mirroring
- [x] ~~**TASK-1224**~~: ✅ Task name truncation — replace `nowrap` with 2-line clamp (`-webkit-line-clamp: 2`)
- [x] ~~**TASK-1225**~~: ✅ Date formatting — new `formatRelativeDate()` utility using `Intl.RelativeTimeFormat` (auto Hebrew/English)
- [x] ~~**TASK-1226**~~: ✅ Inline task editing in chat results — clickable priority/status/date dropdowns on task list items
- [x] ~~**TASK-1227**~~: ✅ Task list item 2-row layout — priority dot + title (row 1), date + status badges (row 2)

#### Phase 2: Expand & Enrich (P1 — ✅ DONE)

- [x] ~~**TASK-1228**~~: ✅ Expandable panel — toggle 380px → 600px → fullscreen with keyboard shortcut (Ctrl+Shift+F)
- [x] ~~**TASK-1229**~~: ✅ Gamification tools — `get_gamification_status`, `get_active_challenges`, `get_achievements_near_completion`
- [x] ~~**TASK-1230**~~: ✅ Cyberflow AI personality mode — "Grid Handler" netrunner persona via system prompt toggle
- [x] ~~**TASK-1231**~~: ✅ Voice input — microphone button with Web Speech API, auto-fills input, pulse animation
- [x] ~~**TASK-1232**~~: ✅ Productivity tools — `get_productivity_stats`, `suggest_next_task`, `get_weekly_summary`
- [x] ~~**TASK-1233**~~: ✅ Native function calling — Groq/OpenRouter `tools[]` API parameter with text-based regex fallback for Ollama

#### Phase 3: Deep Features (P2 — ✅ DONE)

- [x] ~~**TASK-1234**~~: ✅ Conversation history — multiple conversations, auto-naming, localStorage model, conversation list UI
- [x] ~~**TASK-1235**~~: ✅ Full-screen `/ai-chat` route — dedicated view with conversation sidebar, two-column layout
- [x] ~~**TASK-1236**~~: ✅ Deterministic agent chains — "Plan my day", "End of day review", "Focus mode setup" (works with Ollama)
- [x] ~~**TASK-1237**~~: ✅ ReAct agentic loop — multi-step reasoning for Groq/OpenRouter (circuit-breaker, abort, error recovery)
- [x] ~~**TASK-1238**~~: ✅ AI challenge narrator — push narrative events to chat on challenge complete/fail
- [x] ~~**TASK-1239**~~: ✅ Inline actions on results — "Mark done", "Start timer" hover buttons on task items

#### Phase 4: Polish & Innovation (P4 — DEFERRED)

- [ ] **TASK-1240**: Supabase chat persistence — `ai_conversations` + `ai_messages` tables, cross-device sync
- [ ] **TASK-1241**: Mobile bottom sheet — replace side panel with bottom sheet on mobile
- [ ] **TASK-1243**: ⏸️ PAUSED — AI Game Master boss fights — real-time narrated boss encounters via chat
- [ ] **TASK-1245**: Dynamic prompt assembly — only include relevant tool definitions per request type
- [ ] **TASK-1296**: AI Assist composable — `useAITaskAssist` with 7 actions (subtasks, priority, breakdown, date, title, related, summarize)
- [ ] **TASK-1297**: AI Assist popover component — `AITaskAssistPopover.vue` with action buttons + result display
- [ ] **TASK-1298**: Context menu AI Assist — ✨ button in TaskContextMenu with AI popover
- [ ] **TASK-1299**: Edit modal AI Assist — ✨ button in TaskEditModal footer, auto-populate form fields
- [ ] **TASK-1300**: Quick create AI Assist — ✨ button in QuickTaskCreate next to title input
  **Progress (2026-02-12):** All 5 files implemented + integrated. Hebrew/RTL language detection added. Sticky bar translucency fixed. Awaiting user testing.

#### Phase 5: AI Chat Intelligence Improvements (P1 — ONGOING)

- [x] ~~**TASK-1329**~~: ✅ Fix mixed-language responses — localized pipeline headers (preDigestedReasoning, reasoningDirective, contextOptimizer), localized ReAct tool feedback injection, added ReAct language retry loop, added agent chain language directive. 8 gaps identified, 6 high/medium fixed. (✅ DONE 2026-02-23)
- [x] ~~**TASK-1330**~~: ✅ Improve prompt quality — 14-finding audit: consolidated 6 contradictory length instructions into 1 canonical rule, disambiguated 3 overlapping tools, slimmed tool feedback (~600 tokens/step saved), expanded intent classifier (13→25 tools), removed anti-fluff contradictions, fixed personality prompt override, fixed field name mismatches in pre-digested reasoning, removed broad keywords, added agent chain language awareness. (✅ DONE 2026-02-23)
- [x] ~~**TASK-1331**~~: ✅ Weekly plan AI quality — 7-gap audit: (1) pass BehavioralContext through chat tool path, (2) resolve project names for batching, (3) replace plan digest/directive short-circuits with structured scheduling facts, (4) agent chain passes frontload preference when 3+ overdue, (5) enriched chain prompt with per-day distribution + unscheduled, (6) added on_hold/future-dated task filters, (7) skip past weekdays in chat-triggered plans. (✅ DONE 2026-02-25)
- [x] ~~**TASK-1332**~~: ✅ Add Kimi K2 to Groq model dropdown — DONE (added `moonshotai/kimi-k2-instruct-0905`)
- [ ] **TASK-1363**: AI chat shows done tasks + raw UUIDs + unstructured verbose responses — filter done from list/search by default, hide IDs from AI output, tighten response formatting rules
- [x] ~~**BUG-1374**~~: ✅ AI Chat 4-bug combo — (1) English input → Hebrew response (task data context overrides language), (2) Hebrew text renders LTR (Step indicator breaks `dir="auto"`), (3) fluffy generic advice instead of concise analysis, (4) wrong tasks returned (`list_tasks` has no date/priority filter). Pipeline + prompt-level fixes all applied 2026-02-21. (✅ DONE 2026-02-21)

**Key Files**:
- `src/components/ai/ChatMessage.vue` — message rendering, task list items, inline actions, RTL CSS
- `src/components/ai/AIChatPanel.vue` — panel layout, settings, quick actions, full-screen nav
- `src/components/ai/AITaskAssistPopover.vue` — AI assist popover with context-aware actions + results (Phase 4)
- `src/views/AIChatView.vue` — full-screen AI chat with conversation sidebar (Phase 3)
- `src/composables/useAIChat.ts` — chat logic, tool execution, agent chains, ReAct loop
- `src/composables/useAITaskAssist.ts` — 7 AI-powered task assist actions (Phase 4)
- `src/composables/useAgentChains.ts` — deterministic multi-step tool chains (Phase 3)
- `src/composables/useAIChallengeNarrator.ts` — gamification event narrator (Phase 3)
- `src/stores/aiChat.ts` — conversation model, multi-chat persistence
- `src/services/ai/tools.ts` — tool definitions (20 current, 6+ planned)
- `src/services/ai/router.ts` — provider routing
- `src/utils/dateUtils.ts` — date formatting utilities

**Competitors Analyzed**: Linear AI, ClickUp Brain, Notion AI 3.0, Todoist Ramble, Motion, GitHub Copilot Chat, Cursor IDE

#### Phase 6: Programmatic Guardrails Pipeline — ChatGPT-Level Reliability (P1 — PLANNED)

**Goal:** Move AI chat from prompt-engineering-dependent to code-enforced reliability. Pre/post-processing pipeline between user input and LLM output ensures language, quality, and formatting are enforced deterministically — not hoped for via prompts.

**Architecture:**
```
User Input → [Pre-Processing] → LLM (ReAct loop) → [Post-Processing] → Render
```

**New file structure:** `src/services/ai/pipeline/` (types, preprocess, postprocess, languageDetector, contextOptimizer, responseValidator)

**Infrastructure:**
- [x] ~~**TASK-1375**~~: ✅ Pipeline orchestrator + types — create `src/services/ai/pipeline/` with `types.ts` (PreProcessResult, PostProcessResult, Guardrail, PipelineConfig interfaces) and `index.ts` (createPipeline, runPreProcess, runPostProcess). Pure function composition, fully testable.
- [x] ~~**TASK-1376**~~: ✅ Language detector — `languageDetector.ts` with `detectLanguage(text)` using Unicode range analysis (extract from qualityAssessment.ts:468-483) and `detectLanguageMismatch(input, output)`. No LLM calls — deterministic.
- [x] ~~**TASK-1377**~~: ✅ Context optimizer — `contextOptimizer.ts` to replace inline task injection in `buildSystemPrompt` (lines 360-418). Separate Hebrew titles from English metadata labels, character budget (3000 chars), date-relative filtering (today/overdue first). **Highest single ROI fix** — reduces language contamination at the source.

**Post-Processing Guardrails:**
- [x] ~~**TASK-1378**~~: ✅ Response validator — consolidate ALL response cleanup from 3 locations (stripToolBlocks, stripTextToolCalls, ChatMessage.vue renderedContent regex) into one `responseValidator.ts`. Add UUID stripping, reuse `runRuleChecks` from qualityAssessment.ts.
- [x] ~~**TASK-1379**~~: ✅ Language enforcer — post-processing guardrail using TASK-1376's `detectLanguageMismatch()`. V1: detect + flag in metadata (`languageMismatch: true`) for UI indicator. V2 (future): re-call LLM for translation.
- [x] ~~**TASK-1380**~~: ✅ Response length enforcer — cap responses by intent (greetings: 200 chars, tool summaries: 500 chars, analytical: warn on >2000 chars without structure).

**Integration:**
- [x] ~~**TASK-1381**~~: ✅ Wire pre-processing into useAIChat — call `runPreProcess()` before ReAct loop, replace inline `buildSystemPrompt` task injection with contextOptimizer, pass `PreProcessResult` through loop. Depends: TASK-1375, 1376, 1377.
- [x] ~~**TASK-1382**~~: ✅ Wire post-processing into useAIChat — run `runPostProcess()` after ReAct loop (before `completeStreamingMessage`), replace inline cleanup. Depends: TASK-1378, 1379, 1380, 1381.
- [x] ~~**TASK-1383**~~: ✅ Simplify ChatMessage.vue renderedContent — remove redundant regex stripping (now handled by pipeline). `renderedContent` becomes: sanitize + markdown render only. Depends: TASK-1382.
- [x] ~~**TASK-1384**~~: ✅ Unit tests for pipeline — test each guardrail independently (language detection, response cleaning, context optimization, pipeline composition). Depends: TASK-1375–1380.

**Dependency graph:**
```
Wave 1: TASK-1375, TASK-1376 (no deps)
Wave 2: TASK-1377, TASK-1378, TASK-1379, TASK-1380 (depend on Wave 1)
Wave 3: TASK-1381, TASK-1384 (depend on Wave 2)
Wave 4: TASK-1382 (depends on Wave 3)
Wave 5: TASK-1383 (cleanup, depends on Wave 4)
```

#### Phase 7: AI Intelligence Layer — From Prompt-Dependent to Code-Enforced Reliability (P1 — PLANNED)

**Goal:** Make AI chat as reliable as ChatGPT/Claude Desktop. Four pillars: (1) pre-digested reasoning so the LLM formats facts rather than discovers them, (2) generic fluff detection with retry, (3) tool hints so the right tool is called first try, (4) fuzzy title resolution so "mark the auth bug as done" just works.

**Research basis (2025-2026):** Linear AI / Cursor pattern: compute reasoning in code, LLM only writes prose. Groq Llama 3.3 70B tool calling is documented as intermittent (Agno #4090). uFuzzy outperforms Fuse.js for short string matching. Rule-based validation before LLM-as-judge is the cost-effective quality gate.

**Pillar 1: Pre-Digested Reasoning (highest ROI)**
- [x] ~~**TASK-1388**~~: ✅ Pre-digested reasoning engine — instead of sending raw JSON tool results and hoping the LLM reasons, compute the analysis IN CODE (days overdue, subtask progress %, project context, priority ranking) and send pre-written facts the LLM only needs to format naturally. Pattern: `"Task X: 3 days overdue, 0/5 subtasks, high priority in Project Auth"` → LLM writes connecting prose. Inject into tool result follow-up prompt in `useAIChat.ts`. Key insight from Cursor/Linear: minimize what the LLM invents, maximize what deterministic code computes.
- [x] ~~**TASK-1389**~~: ✅ Skeleton prompting for agent chains — refactor `useAgentChains.ts` chain prompts to use skeleton pattern: code generates structured sections (overdue analysis, today's priorities, progress summary), LLM fills only 1-sentence natural language bridges between sections. Eliminates "wall of generic text" from plan_my_day and end_of_day_review chains.

**Pillar 2: Generic Response Detection + Retry**
- [x] ~~**TASK-1390**~~: ✅ Fluff detector guardrail — `src/services/ai/pipeline/fluffDetector.ts`. Heuristic scoring: check if response references actual task titles from context (0.3 weight), contains specific data points like dates/numbers (0.15), has no generic advisory phrases like "consider", "it's essential", "you might want to" (0.05 each). Score 0-1, threshold 0.5 = retry. Based on 2025 "Detecting Prompt Knowledge Gaps" paper specificity dimensions. Zero-cost, runs client-side.
- [x] ~~**TASK-1391**~~: ✅ Validation + retry loop — when fluff detector score < 0.5 after tool results, retry once with stricter prompt: append the validation feedback ("your response referenced no specific tasks, try again naming actual tasks from the results"). Max 1 retry to avoid latency. If retry also fails, return best attempt with post-processing cleanup. Wire into `useAIChat.ts` post-ReAct section.

**Pillar 3: Tool Hints + Intent Routing**
- [x] ~~**TASK-1392**~~: ✅ Keyword-based tool hints — `src/services/ai/pipeline/toolHints.ts`. Deterministic keyword → tool mapping: "overdue" → `get_overdue_tasks`, "plan my week" → `generate_weekly_plan`, "timer" → `get_timer_status`/`start_timer`, "what should I" → `suggest_next_task`. Inject hint into system prompt: "Consider using `get_overdue_tasks` for this query." Reduces ReAct steps from 2-3 to 1. Supports Hebrew keywords too.
- [x] ~~**TASK-1393**~~: ✅ `projectId` filter on `list_tasks` — add optional `projectId` parameter to `list_tasks` tool definition and execution. Already has project data accessible. 15-minute quick win.
- [x] ~~**TASK-1394**~~: ✅ Counting vs listing system prompt clarification — add explicit rule: "For COUNTING questions (how many, what's total), answer from context — do NOT call tools. For LISTING questions (show me, what are my tasks), use tools to show interactive cards." Prevents unnecessary tool calls.

**Pillar 4: Fuzzy Title Resolution**
- [x] ~~**TASK-1395**~~: ✅ Install uFuzzy + `resolveTask()` helper — `npm install @leeoniya/ufuzzy`. Create `src/services/ai/entityResolver.ts` with `resolveTask(idOrTitle, tasks)`: (1) exact UUID match, (2) exact TASK-XXX ID match, (3) uFuzzy title search. Returns best match or top-3 candidates if ambiguous. uFuzzy chosen over Fuse.js: 7.5KB, ~1ms for 1k items, better quality on short strings without tuning.
- [x] ~~**TASK-1396**~~: ✅ Wire `resolveTask()` into write tools — modify `validateTaskExists()` in `tools.ts` to fall through to `resolveTask()` when UUID lookup fails. Affects: `update_task`, `update_task_status`, `delete_task`, `start_timer`, `stop_timer`. User says "mark the video as done" → LLM passes title fragment → `resolveTask` finds the task.
- [x] ~~**TASK-1397**~~: ✅ `mark_task_done` convenience tool — new tool alias that accepts `taskTitle` (string) instead of requiring UUID. Internally calls `resolveTask()` + `taskStore.updateTask(id, { status: 'done' })`. Most common user action shouldn't depend on UUID resolution.
- [x] ~~**TASK-1398**~~: ✅ Conversation entity memory — track recently-mentioned task IDs in conversation metadata. When user says "it", "that task", "the last one", resolve to most recently mentioned entity. Store in `aiChat` store alongside messages. Enables multi-turn: "show overdue tasks" → "mark the first one as done."

**Dependency graph:**
```
Wave 1 (no deps):     TASK-1388, TASK-1390, TASK-1392, TASK-1393, TASK-1394, TASK-1395
Wave 2 (dep Wave 1):  TASK-1389, TASK-1391, TASK-1396, TASK-1397
Wave 3 (dep Wave 2):  TASK-1398
```

**npm packages to install:** `@leeoniya/ufuzzy` (7.5KB, fuzzy matching)

---

### ~~TASK-1249~~: Codebase Hygiene Audit — Placeholders, Hardcoded Values, Debug Leftovers (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-27)

**Summary**: Comprehensive 7-agent audit found 10 CRITICAL, 34 MEDIUM, 29 LOW issues across placeholders, hardcoded values, demo content, debug leftovers, design token violations, AI config, and metadata.

**Sub-Tasks (ordered by priority)**:

#### P0 — Security & Broken Functionality
- [x] **~~TASK-1250~~**: ✅ Fix API key storage — removed plaintext localStorage inputs since proxy handles keys server-side (`AIChatPanel.vue`)
- [x] **~~TASK-1251~~**: ✅ Fix direct API calls bypassing proxy — route model-listing through `aiChatProxy.ts` instead of direct fetch to groq.com/openrouter.ai (`AIChatPanel.vue:275,290`)
- [x] **~~TASK-1252~~**: ✅ Remove or gate `/keyboard-test` debug route — ships without auth, exposes task creation/deletion debug panel (`router/index.ts:105-108`)
- [x] **~~TASK-1253~~**: ✅ Gate `window.__flowstate_tauri_debug` behind `import.meta.env.DEV` (`useTauriDebug.ts:270-276`)
- [x] **~~TASK-1254~~**: ✅ Fix CORS wildcard on Supabase Edge Functions — restricted to `in-theflow.com` + Tauri + dev origins (`supabase/functions/*/index.ts`)
- [x] **~~TASK-1255~~**: ✅ Fix WelcomeModal dead buttons — removed non-functional saveDisplayName, exportData, and stubbed userStats (`WelcomeModal.vue`)
- [x] **~~TASK-1256~~**: ✅ Fix stale production origins — `flowstate.app` → `in-theflow.com` (`environments.ts`)
- [x] **~~TASK-1257~~**: ✅ Fix `productionLogger.ts` — now uses Supabase session token via `supabase.auth.getSession()`

#### P1 — Production Quality
- [x] **~~TASK-1258~~**: ✅ Replace httpbin.org with self-hosted endpoint — production code now uses `in-theflow.com` (`performanceBenchmark.ts`, `useNetworkOptimizer.ts`)
- [x] **~~TASK-1259~~**: ✅ Remove unconditional `%c[DEBUG]` styled log from `useCanvasOrchestrator.ts`
- [x] **~~TASK-1260~~**: ✅ Remove ~30 bug-specific debug tags across 10 files (`[BUG-339-DEBUG]`, `[TASK-288-DEBUG]`, `[DELETE-DEBUG]`, `[BUG-1116:DRAG-DEBUG]`, `[KEYBOARD]` etc.)
- [x] **~~TASK-1261~~**: ✅ Fix silent no-op stubs — now throw Error or console.warn (`taskPersistence.ts`)
- [x] **~~TASK-1262~~**: ✅ Re-enable CI lint & unit tests (`.github/workflows/ci.yml`)
- [x] **~~TASK-1263~~**: ✅ Add Open Graph + Twitter Card meta tags + improved description (`index.html`)
- [x] **~~TASK-1264~~**: ✅ Update stale AI model references — router.ts, types.ts, openrouterProxy.ts
- [x] **~~TASK-1265~~**: ✅ Fix AI proxy health check consuming real API tokens every 60s — switched to OPTIONS request instead of chat completion (`aiChatProxy.ts:412-421`)

#### P2 — Code Quality & Design System
- [x] **~~TASK-1266~~**: ✅ CSS design token migration — top offending files migrated. Original: 1,420 raw rgba + 434 hex across 129 files. Migrated 15 top-offending component files (MultiSelectToggle, DragHandleVisuals, BaseCard, TaskRow, KanbanColumn.css, KanbanSwimlane.css, TaskCard.css, GroupModal, EmojiPicker, AccountSettingsTab, useToast, errorHandler, GamificationPanel, DoneToggleVisuals, AchievementToast). True violations reduced to ~101 rgba + ~170 hex (long tail of 2-7 per file across many components).
- [x] **~~TASK-1267~~**: ✅ Standardize localStorage key prefixes — settings.ts migrated with migration logic for old keys
- [x] **~~TASK-1268~~**: ✅ Extract magic timeout numbers to named constants — created `src/config/timing.ts` with PENDING_WRITE_TIMEOUT_MS, DRAG_SETTLE_TIMEOUT_MS, FILE_DIALOG_TIMEOUT_MS, CROSS_TAB_DEDUP_TIMEOUT_MS, RESIZE_SETTLE_TIMEOUT_MS
- [x] **~~TASK-1269~~**: ✅ Create centralized `src/config/urls.ts` — EXTERNAL_URLS with DiceBear, GitHub, production site, Storybook dev
- [x] **~~TASK-1270~~**: ✅ Fix hardcoded i18n defaults — updated ui.ts comment, wrapped password strength labels in `t()` calls, added en/he translations
- [x] **~~TASK-1271~~**: ✅ Improve Cyberflow empty states — added explanatory subtext to CyberSkillTree, CyberAchievements, CyberShop
- [x] **~~TASK-1272~~**: ✅ Mobile design token compliance — MobileTodayView migrated to tokens
- [x] **~~TASK-1273~~**: ✅ Update PWA manifest description — updated to FlowState branding with full feature description
- [x] **~~TASK-1274~~**: ✅ Migrate `'uncategorized'` sentinel to constant — created UNCATEGORIZED_PROJECT_ID in taskOperations.ts, used in supabaseMappers + useSupabaseDatabase

#### P3 — Backlog / Polish
- [x] **~~TASK-1275~~**: ✅ Remove 5 obsolete verification scripts in `scripts/` (verify-shadow-layer, verify-auth-user, verify-backup-system, verify-bug339-migration, verify-restore)
- [x] **~~TASK-1276~~**: ✅ Remove Storybook `title: 'PLACEHOLDER'` duplicate key (`OverflowTooltip.stories.ts:4`)
- [x] **~~TASK-1277~~**: ✅ Standardize z-index usage — replaced ~60 hardcoded values across 50 files with `var(--z-*)` tokens (dropdown, modal, popover, tooltip layers)
- [x] **~~TASK-1278~~**: ✅ Standardize font-size usage — replaced ~100 hardcoded px/rem values across 32 files with `var(--text-*)` tokens
- [x] **~~TASK-1279~~**: ✅ Add missing package.json metadata — homepage, repository, bugs fields
- [x] **~~TASK-1280~~**: ✅ Add copyright field to Tauri bundle config (`tauri.conf.json`)
- [x] **~~TASK-1281~~**: ✅ Adopt build-time console.log stripping — esbuild `pure` config strips console.log/debug in production
- [x] **~~TASK-1282~~**: ✅ Stop filtering console.error/warn in consoleFilter.ts — now always pass through

---

### ~~TASK-1494~~: Tauri Parity Testing Suite (✅ DONE)

**Priority**: P1 | **Status**: ✅ **DONE** — Obsolete (Tauri removed)

---

### ~~TASK-1495~~: Morning Dashboard Redesign — Opt-in Ritual + State Machine (✅ DONE)

**Priority**: Medium | **Status**: ✅ DONE (2026-03-13)

**Problem/Opportunity**: Morning dashboard was a forced full-page takeover that interrupted users during onboarding. Users need an opt-in ritual that fits into their morning workflow — suggested during the "golden window" (06:00-11:00) but always dismissible.

**Solution**: Redesigned as a lightweight, non-blocking ritual with two-step flow:
1. **Step 1**: Pick focus tasks (up to 3) from prioritized candidates (overdue, high-priority, active)
2. **Step 2**: Schedule them via auto-placement or manual time-blocking
3. **Summary chip**: Shows completion status throughout the day

**Architecture**:
- **`useMorningRitual.ts`**: State machine (idle → picking → scheduling → done/dismissed) + time window gating (06:00-11:00) + one-time-per-day enforcement via localStorage
- **UI Components**:
  - `MorningBanner.vue`: Dismissible banner with call-to-action, only shows during golden window
  - `MorningRitualPanel.vue`: Bottom sheet with step indicator + action buttons (Skip/Start)
  - `MorningCandidateCard.vue`: Compact task preview (title, priority badge, duration estimate)
  - `MorningSummaryChip.vue`: Shows "3/3 tasks scheduled" or "Ritual dismissed" after completion
- **Reuse**: CustomSelect (time picker), TaskContextMenu (priority/due date quick edits), TaskEditModal (full edit), BaseBadge (priority indicators)

**Integration**:
- `App.vue`: Mount banner + panel + summary chip globally (always available)
- `MorningDashboardView.vue`: Auto-open ritual on `/morning` route, show summary chip in header

**New Files**:
- `src/composables/useMorningRitual.ts`
- `src/components/morning-dashboard/MorningBanner.vue`
- `src/components/morning-dashboard/MorningRitualPanel.vue`
- `src/components/morning-dashboard/MorningCandidateCard.vue`
- `src/components/morning-dashboard/MorningSummaryChip.vue`

**Modified Files**:
- `src/App.vue`
- `src/views/MorningDashboardView.vue`

---

## Planned Tasks (NEXT/BACKLOG)

### ~~TASK-1484~~: Escape key closes TaskContextMenu (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-08)

**Problem**: TaskContextMenu had no Escape key handler. Pressing Escape did nothing while the context menu was open.

**Fix**: Added `handleKeyDown` listener on `document` when context menu becomes visible, calls `closeAllSubmenusNow()` + `emit('close')` on Escape. Includes `stopPropagation` to prevent other global Escape handlers from interfering. All other context menus (ContextMenu.vue, EdgeContextMenu.vue, useContextMenu.ts) already had Escape handling.

### ~~TASK-1473~~: Add calendar view to mobile PWA (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-07)

**Goal**: Add a mobile-optimized calendar view to the PWA bottom navigation. Replace the AI Chat tab with Calendar in the nav bar; move AI Chat into the Menu overlay instead.

**Implementation**:
- Created `MobileCalendarView.vue` — day view with time grid (6AM-11PM), task cards color-coded by priority, date navigation, current time indicator, unscheduled tasks section, RTL support
- Added mobile route `/mobile-calendar` in router with desktop redirect to `/calendar`
- Replaced AI nav tab with Calendar tab in `MobileNav.vue` (Calendar icon)
- Added AI Chat as a menu item in `MobileNav.vue` menu overlay (Sparkles icon + "AI Chat" label)

---

### ~~TASK-1474~~: Move AI Chat from mobile nav bar to menu overlay (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-07)

**Goal**: Remove AI Chat from the mobile bottom navigation bar (currently 4th tab) and add it as an item in the hamburger Menu overlay instead. This frees the nav slot for Calendar.

**Changes**:
- `MobileNav.vue`: Removed AI `router-link`, added menu item with Sparkles icon that navigates to `/mobile-ai-chat`
- AI Chat view works when accessed from menu

---

### ~~TASK-1500~~: Memory auto-refresh and verify memory health wired into Settings (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-10)

**Goal**: Add `refreshIfStale()` to `useWorkProfile.ts` that only runs `computeCapacityMetrics()` when observations are >24h old (instead of always on startup). Wire into app initialization. Verify AISettingsTab already has memory health UI.

**Changes**:
- `src/composables/useWorkProfile.ts`: Added `refreshIfStale()` — checks `memoryGraph` timestamps, skips refresh if freshest observation is <24h old, generates initial observations if none exist
- `src/composables/app/useAppInitialization.ts`: Replaced unconditional `computeCapacityMetrics()` call with `refreshIfStale()` (fire-and-forget, respects `aiLearningEnabled` setting)
- `AISettingsTab.vue`: Already had full Memory Health section (TASK-1356) — grade badge, section dots, progress, "Run Quick Check" button, hint to full dashboard. No changes needed.

---

### INQUIRY-1413: Evaluate open-source readiness for community sharing (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED (2026-02-23)

**Question**: Is FlowState ready to share with the open-source community? Users should be able to connect their own Supabase instance and use all features — no paid tiers, no locked features.

**Audit Areas**:
- Hardcoded secrets, API keys, VPS IPs in committed code
- Supabase setup documentation (schema, migrations, RLS policies)
- Environment variable documentation (.env.example completeness)
- First-run experience (can a new user self-host?)
- License file
- README quality for OSS contributors
- Doppler/proprietary service dependencies
- Build reproducibility without private infra

---

### ~~INQUIRY-1249~~: WhatsApp Bot Integration for Task Creation via WAHA + Groq (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Concept**: WhatsApp bot that receives forwarded messages, parses them with Groq AI, and creates tasks in FlowState automatically.

**Implementation**: Built complete bot at `packages/whatsapp-bot/` (~375 LOC):
- `src/index.ts` — Express webhook server, WAHA event handler, chat ID allowlist security
- `src/groqParser.ts` — Llama 3.3 70B via Groq API, extracts title/priority/dueDate/duration from Hebrew/English messages
- `src/supabaseClient.ts` — Direct REST insert to FlowState tasks table, sets `is_in_inbox: true` for triage
- `src/wahaClient.ts` — WhatsApp confirmation messages via WAHA API
- `docker-compose.yml` — WAHA (NOWEB engine) + bot, ready to deploy

**Architecture**:
```
WhatsApp (dedicated number) → WAHA (Docker, Contabo VPS) → Webhook → Supabase Edge Function
                                                                          ↓
                                                                   Groq API (free)
                                                                          ↓
                                                                   Supabase REST → FlowState
```

**Estimated Cost**: $0/month (all free tiers)

**Deployment steps** (user manual):
- [x] ~~Build webhook handler (Node.js/TypeScript)~~ ✅
- [x] ~~Integrate Groq for message parsing~~ ✅
- [x] ~~Connect to FlowState Supabase via REST API~~ ✅
- [x] ~~Deploy WAHA Docker container on Contabo VPS~~ ✅ (port 3050, Doppler secrets)
- [x] ~~Set up Doppler integration for WAHA secrets~~ ✅ (restart script at `/opt/waha/restart-waha.sh`)
- [ ] Buy dedicated SIM card for WhatsApp number
- [ ] Link WhatsApp number via WAHA dashboard (scan QR)
- [ ] Test end-to-end flow

---

### TASK-1458: WhatsApp Bot — Link Number & E2E Test (⏸️ PAUSED)

**Priority**: P2 | **Status**: ⏸️ PAUSED (2026-03-06) — waiting for user to buy a SIM card

**Blocked on**: Dedicated phone number (SIM card purchase)

**What's done**:
- WAHA container deployed on VPS (port 3050, `supabase_default` network)
- Doppler secrets configured (`WAHA_API_KEY`, `WAHA_DASHBOARD_USERNAME/PASSWORD`, `GROQ_API_KEY`)
- Restart script at `/opt/waha/restart-waha.sh` pulls fresh secrets from Doppler
- Dashboard accessible at `http://84.46.253.137:3050/dashboard`

**Remaining**:
- [ ] Buy dedicated SIM card
- [ ] Start session in WAHA dashboard, scan QR with new number
- [ ] Test: send WhatsApp message → verify task appears in FlowState inbox
- [ ] Configure chat ID allowlist for the new number

---

### ~~TASK-1118~~: Test Suite Cleanup - Reduce 615 Tests to ~100 Essential (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-10)

**Result**: Reduced 985 → 878 tests (-11%), fixed 3 pre-existing failures, halved execution time (10s → 5s). Removed duplicates, tautologies, and collapsed redundant tests into `it.each`. All 878 tests pass.

---

### TASK-1386: Google Calendar Proxy Edge Function (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE | **Completed**: 2026-02-21

**Problem/Opportunity**: FlowState needs to display Google Calendar events in the calendar views without exposing OAuth tokens or making Google API calls from the client.

**Scope**: Create `supabase/functions/google-calendar-proxy/index.ts` — a Supabase Edge Function that:
- Validates the caller via Supabase JWT before proxying to Google
- Supports `list-calendars` and `list-events` actions
- Performs automatic token refresh on Google 401 and returns `newAccessToken` to client
- Follows the same CORS/auth pattern as `ai-chat-proxy`

**Implementation**:
- [x] Create `supabase/functions/google-calendar-proxy/index.ts`
- [x] CORS headers matching ai-chat-proxy (ALLOWED_ORIGINS, getCorsHeaders)
- [x] Supabase JWT validation via `createClient` + `getUser()`
- [x] `list-calendars` → GET `/users/me/calendarList`, returns `{ calendars: { id, summary, backgroundColor }[] }`
- [x] `list-events` → GET `/calendars/{calendarId}/events` with singleEvents/orderBy/timeMin/timeMax/maxResults=250
- [x] Token refresh on 401: POST to `oauth2.googleapis.com/token`, retry, return `newAccessToken`
- [x] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `Deno.env.get()`

**Files**:
- `supabase/functions/google-calendar-proxy/index.ts` (new)

---

### ~~TASK-359~~: Quick Add + Sort Feature (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

Batch capture mode: `Ctrl+.` opens Quick Capture modal, type titles + Enter, Tab to sort phase, 1-9 assigns project.

**Files**: `src/composables/useQuickCapture.ts`, `src/components/quicksort/QuickCaptureModal.vue`

---

### ~~TASK-1119~~: Remove Web Speech API - Use Whisper Only (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-13)

**Rationale**: Web Speech API has poor quality compared to Whisper:
- Browser-dependent (different results on Chrome/Firefox/Safari)
- Poor Hebrew support
- No mixed-language (code-switching) support
- Requires manual language selection

**Scope**: Mobile only (desktop components still use browser speech as fallback)

**Changes Made**:
1. Removed Browser/AI mode toggle from MobileInboxView
2. Made Whisper (via Groq) the only voice input method for mobile
3. Simplified voice UI - single mic button, no mode selection
4. Simplified cancelVoice to Whisper-only
5. Removed all `voiceMode`, `voiceLanguage`, `toggleVoiceMode` references

**Files Modified**:
- `src/mobile/views/MobileInboxView.vue` - Whisper-only voice UI

**Note**: `useSpeechRecognition.ts` kept for desktop components (UnifiedInboxInput, QuickCaptureTab, AppSidebar)

**Related**: ~~FEATURE-1023~~, ~~BUG-1109~~, ~~TASK-1131~~

---

### ~~TASK-1131~~: Offline Voice Queue - Save & Retry When Online (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: With Whisper-only voice input (TASK-1119), offline recording fails silently.

**Solution**: Save audio blob to IndexedDB, show badge, auto-transcribe when back online.

**Implementation Complete**:
1. Created `useOfflineVoiceQueue.ts` composable
   - Saves audio blob to IndexedDB when offline
   - Uses VueUse `useOnline()` for connectivity detection
   - Watches online status and processes queue when reconnected
   - Auto-retries failed transcriptions (max 3 attempts)
2. Modified `useWhisperSpeech.ts`:
   - Added `onOfflineRecord` callback option
   - Added `isQueued` status for UI feedback
   - Exposed `isOnline` state
3. Updated `MobileInboxView.vue`:
   - Badge on mic button shows pending count
   - Offline indicator when not connected
   - Voice feedback shows "Saved offline" status
   - Haptic feedback on queue save

**Files Created/Modified**:
- `src/composables/useOfflineVoiceQueue.ts` (CREATE) - IndexedDB queue management
- `src/composables/useWhisperSpeech.ts` (MODIFY) - Offline callback support
- `src/mobile/views/MobileInboxView.vue` (MODIFY) - UI integration

**Depends On**: ~~TASK-1119~~ (Whisper-only simplification) ✅

**Effort**: ~2-3 hours

---

### ~~TASK-353~~: Design Better Canvas Empty State (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-13)

Current empty state is minimal. Add visual illustration, feature highlights, guest mode sign-in prompt.

**File**: `src/components/canvas/CanvasEmptyState.vue`

**Resolution**: Redesigned with animated SVG illustration (floating task cards with connecting lines), 4 feature pills, engaging copy ("Your spatial canvas awaits"), glass-morphism action buttons with keyboard hints (N/G), ambient grid dots, sparkle effects, and full prefers-reduced-motion support. Storybook stories updated with 3 variants.

---

### Stress Test Suite (📋 PLANNED)

| Task | Description |
|------|-------------|
| TASK-362 | Sync conflict resolution (2 tabs editing, offline+online, race conditions) |
| TASK-363 | Auth edge cases (expired JWT, session timeout, concurrent sessions) |
| TASK-364 | WebSocket stability (disconnect, reconnect, subscribe cycles) |
| TASK-366 | Redundancy assessment (SPOF mapping, fallback testing) |

---

### ~~BUG-1199~~: Canvas Inbox Right-Click Acts as Ctrl+Click (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: Right-clicking on a task in the canvas inbox behaves as if Ctrl+Click was pressed (multi-select behavior) instead of opening a context menu or doing nothing.

**Root Cause**: The native `@click` event fires for ALL mouse buttons (left=0, right=2). When right-clicking, `@click` fires first (running selection logic), then `@contextmenu` fires. Canvas nodes don't have this issue because Vue Flow's `@node-click` filters by button internally.

**Fix Applied**: Added `event.button !== 0` early return in `handleTaskClick()` so only left-clicks trigger selection logic. Right-clicks now only fire the `@contextmenu` handler.

**Files Changed**:
- `src/composables/inbox/useUnifiedInboxActions.ts` - Added button check (1 line)

---

### ~~FEATURE-1200~~: Quick Add Full RTL Support + Auto-Expand for Long Tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Feature**: Two improvements to the Quick Add input in the main sidebar:

1. **Full RTL support**: The quick add input should properly support RTL text (Hebrew). Text direction should auto-detect or follow app locale.
2. **Auto-expand to fullscreen**: When typing a long task title that exceeds the input width, automatically open a fullscreen task creator popup/modal so the user has more space to write.

**Requirements**:
- [x] Add `dir="auto"` or RTL detection to quick add input — ✅ Done by TASK-1324 (`quickTaskDirection` computed in AppSidebar.vue)
- [x] RTL-aware placeholder text and icons — ✅ Done by TASK-1324 (Hebrew translations in `he.json`)
- [x] Character/width threshold to trigger fullscreen expansion — ✅ Auto-opens at 20+ words or 150+ chars
- [x] Smooth transition from inline input to fullscreen modal — ✅ Expand button + auto-trigger via `QuickTaskCreateModal`
- [x] Carry over typed text to the fullscreen creator — ✅ `initialTitle` prop on `QuickTaskCreateModal`
- [x] Fullscreen creator should also be fully RTL-aware — ✅ Uses `useHebrewAlignment` composable

**Implementation**:
- `AppSidebar.vue`: Expand button (Maximize2 icon) on textarea + auto-trigger at high threshold + `QuickTaskCreateModal` integration
- `QuickTaskCreateModal.vue`: Added `initialTitle` prop for text carry-over
- RTL: `quickTaskDirection` computed (regex on first char), Hebrew i18n placeholders, `useHebrewAlignment` in modal

---

### ~~FEATURE-1201~~: Intro/Onboarding Page for Guest and Signed-In Users (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

**Feature**: Single-screen welcome modal replacing the old WelcomeModal. Same flow for guest and signed-in users.

**Design Pivot**: Initially built as 4-step wizard, then pivoted to single screen based on UX research showing multi-step wizards have ~10-19% completion rates with 72% user abandonment. Linear (most admired productivity UX) uses zero wizards. Single screen gets users to first task faster.

**Design Decisions (Resolved)**:
- [x] What to show: Logo, 3 feature highlights, "Get Started" CTA, optional sign-up link for guests
- [x] Format: Single welcome screen (research-backed — "quick win" retains 80% more users)
- [x] Reappear: No — dismissed permanently via localStorage (`flowstate-onboarding-v2`)

**Implementation**:
- [x] `useOnboardingWizard.ts` composable — visibility, dismiss, keyboard, localStorage persistence
- [x] `OnboardingWizard.vue` — single-screen modal with Teleport, glass morphism, auth-aware sign-up CTA
- [x] Moved from MainLayout to App.vue — now shows on both desktop and mobile
- [x] Removed old WelcomeModal from MainLayout (component kept for reference)
- [x] Keyboard: Enter or Escape to dismiss
- [x] Storybook stories (Guest + Signed In variants)
- [x] Build passes, zero new TS errors

**Files Created**: `src/composables/app/useOnboardingWizard.ts`, `src/components/onboarding/OnboardingWizard.vue`, `src/stories/modals/OnboardingWizard.stories.ts`
**Files Modified**: `src/App.vue`, `src/layouts/MainLayout.vue`

---

### ~~TASK-1283~~: Google Calendar Plugin — Calendar View Integration (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-22) | **Blocked By**: ~~FEATURE-1202~~

**Feature**: Add a plugin/settings option to connect Google Calendar. Once connected, display Google Calendar events alongside FlowState tasks in the Calendar view.

**Requirements**:
- [ ] Google OAuth must include `calendar.readonly` scope (extends FEATURE-1202)
- [ ] Settings UI: "Connect Google Calendar" toggle in Settings > Integrations
- [ ] Fetch events from Google Calendar API (read-only)
- [ ] Display events in Calendar view with distinct styling (differentiate from tasks)
- [ ] Handle token refresh for long-lived sessions
- [ ] Graceful degradation when offline or token expired

**Key Decisions Needed**:
- Read-only vs read-write (create FlowState tasks from calendar events?)
- Which calendars to sync (primary only vs user-selectable)
- Event display style (overlay, side-by-side, merged timeline)

---

### ~~TASK-1452~~: KDE Widget — Switch Active Timer to Different Task (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-05)

**Task**: When a Pomodoro timer is running on task A and user clicks play on task B, reassign the running timer session to task B instead of creating a new session.

**Implementation**:
1. Added `switchTaskForSession()` method to KDE widget backend
2. Implemented 3-state play icon:
   - Stopped state: play icon
   - Running on OTHER task: skip-forward icon (indicates timer switch)
   - Running on THIS task: chronometer icon (indicates timer active)
3. Smart click handler:
   - Checks if timer running and on different task
   - If yes: calls `switchTaskForSession()` to reassign
   - If no: starts new timer session normally

---

### ~~BUG-1453~~: Production CSS Preload + Mobile Quick Sort Swipe Broken (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-07)

**Two issues reported:**
1. Production CSS preload failure (`MorningDashboardView-7ECQeecR.css`)
2. Mobile PWA Quick Sort card swipe/drag not working (user says "used to work")

#### Sub-issue 1: CSS Preload Failure — RESOLVED

**Root cause**: `SITE_URL` and `API_URL` GitHub Actions repository variables were deleted (between Mar 3-4). This broke the Cloudflare cache purge step in `.github/workflows/deploy.yml`, causing 18 consecutive deploy failures. VPS got new assets via rsync but Cloudflare CDN served stale `index.html` referencing old CSS/JS hashes that no longer existed on VPS.

**Fixes applied (3 commits pushed):**
- Restored `SITE_URL` (`https://in-theflow.com`) and `API_URL` (`https://api.in-theflow.com`) via `gh variable set`
- Made CF purge step resilient: guards against empty SITE_URL with graceful skip instead of `exit 1`
- Fixed 6 pre-existing CI type/lint errors in ChatMessage.vue, BaseModal.vue, AIQualityDashboard.vue, QuickSortCard.vue
- Deploy pipeline now fully green (all steps pass including chunk integrity verification)

#### Sub-issue 2: Mobile Quick Sort Swipe — RESOLVED

**Three layers of root cause fixed:**

1. **Touch event regression** (commit `072eea6c`): `preventDefault()` in `touchstart` before direction known — Android Chrome drops entire touch sequence. Fixed: `touchstart` always `{ passive: true }`, `preventDefault()` deferred to `touchmove` after 10px lock threshold.

2. **CSS `!important` overrides killing transform**: `global-overrides.css` had `.task-card:hover { transform: none !important }` and `.task-card:active { transform: scale(0.99) !important }` — both override the inline `translateX` during drag. Fixed: added `:not(.swiping)` to both selectors.

3. **Overflow clipping on mobile**: Ancestor containers (`.mobile-content`, `.sort-phase`, `.qs-main`) had `overflow: hidden/auto` which clips the card's `translateX` displacement. CSS doesn't allow `overflow-x: visible` with `overflow-y: auto` (browsers force both to `auto`). **Fix: Card switches to `position: fixed` during swipe**, capturing `getBoundingClientRect()` on swipe start and pinning to viewport coordinates. This escapes ALL ancestor overflow clipping. Also removed `perspective: 1000px` from `.card-stack` (CSS spec: perspective creates containing block for fixed descendants).

**Additional improvements:**
- Mobile-friendly edit bottom sheet with toggle pills, project picker with emoji icons
- Overlay dead zone (50px before showing, max 0.7 opacity)
- Velocity-based swipe minimum distance (40% threshold) to prevent accidental triggers
- SOP: `docs/sop/SOP-063-mobile-swipe-gestures.md`
- `.github/workflows/deploy.yml` — deploy pipeline (fixed)

**Relevant commits:**
- `072eea6c` — batch update (useSwipeGestures refactor + user's QuickSortCard rewrite)
- `3a149cb6` — last known working version of useSwipeGestures
- `af3a63b7` — mobile QuickSort visual fixes
- `939ce6a5` — split MobileQuickSortView into sub-components

**Files**: `packages/kde-widget/contents/ui/main.qml`

**Architecture**:
- Reuses existing session management (`timer_sessions` table)
- Updates `task_id` on running session instead of creating duplicate
- Preserves elapsed time, start time, pomodoro count
- No breaking changes to sync protocol

**Progress (2026-03-05):** Feature implemented and verified. Play icon now shows 3 states correctly. Timer successfully switches to different task when user clicks play. Tested with both timer running and idle states.

---

### Other Planned Tasks

| Task | Priority | Description |
|------|----------|-------------|
| ~~**BUG-1897**~~ | **P0** | ✅ **Stopped timer resurrects on app + KDE when remote save fails (poll re-adoption unguarded)** (✅ DONE 2026-07-02, v1.4.227) |
| ~~**BUG-1898**~~ | **P0** | ✅ **Timer stop lost during auth reconnect-grace; grace period unbounded** (✅ DONE 2026-07-02, v1.4.227) |
| **BUG-1899** | **P0** | 🔄 **Canvas group echo-stomp + dual-writer LWW discards (BUG-1799 residue, Tidy 3-rows)** (4 modes fixed v1.4.227; boot-load serialization residual) |
| ~~**BUG-1900**~~ | **P1** | ✅ **Group resize silently ignores lock acquire failures (children snap back)** (✅ DONE 2026-07-02, v1.4.227) |
| ~~**BUG-1901**~~ | **P1** | ✅ **Due-date edit leaves stale calendar instance; +1mo anchors on today** (✅ DONE 2026-07-02, v1.4.227) |
| ~~**BUG-1902**~~ | **P1** | ✅ **Saved canvas viewport never applied at startup (no setViewport after load)** (✅ DONE 2026-07-02, v1.4.227) |
| ~~**BUG-1903**~~ | **P1** | ✅ **Mobile deep-links stomped by /tasks default before router ready** (✅ DONE 2026-07-02, v1.4.227) |
| ~~**TASK-1904**~~ | **P1** | ✅ **Test-suite truthfulness sweep (17 stale unit tests, dead E2E specs, trace noise)** (✅ DONE 2026-07-02 — unit 3113/3113; chromium E2E residual = TASK-1906 interference) |
| ~~**BUG-1908**~~ | **P1** | ✅ **KDE widget Today list hides scheduled-today tasks with stale calendar instances (Vue parity)** (✅ DONE 2026-07-03, v1.4.229 shipped; widget live after plasmashell reload) |
| ~~**BUG-1909**~~ | **P1** | ✅ **Due-date quick-set looks like no-op when stale past instances pin badge** (✅ DONE 2026-07-03, v1.4.229 shipped, live manifest verified) |
| **BUG-1910** | **P0** | 🔄 **Canvas groups disappeared after restart into v1.4.229 (BUG-1899 boot-load class; DB rows intact, display-side)** |
| ~~**BUG-1911**~~ | **P0** | ✅ **"Deleted events resurrect" — disproven by prod forensics; deletions never persisted → duplicate of BUG-1913** |
| **BUG-1913** | **P0** | 🔄 **Silent write-drop windows — client drops writes without error; server re-sync looks like resurrection** |
| ~~**TASK-1914**~~ | **P0** | ✅ **VPS DB write-watchdog — cron invariant checks + ntfy alerts** (✅ DONE 2026-07-03, live on VPS) |
| ~~**TASK-1915**~~ | **P1** | ✅ **Nightly automated regression hunt as scheduled cloud agent** (✅ DONE 2026-07-03, first run tonight) |
| ~~**TASK-1916**~~ | **P0** | ✅ **In-app write-failure visibility — indicator + toast when saves fail** (✅ DONE 2026-07-03, v1.4.230 shipped) |
| **BUG-1917** | **P0** | 🔄 **Updater Restart quits but never swaps/relaunches — silent installer handoff (instrumented+hardened v1.4.231)** |
| ~~**BUG-1919**~~ | **P0** | ✅ **KDE timer zombie after +5min extension — BUG-1892 guard swallowed re-completion** (✅ DONE 2026-07-04, widget reload pending) |
| ~~**BUG-1932**~~ | **P0** | ✅ **Phantom sign-out when a launcher rewrites HOME — pin Electron userData to passwd home** (✅ DONE 2026-07-10) |
| ~~**BUG-1933**~~ | **P0** | ✅ **Restored session never re-persisted; stale token blinded Local API sidecar** (✅ DONE 2026-07-10) |
| ~~**BUG-1934**~~ | **P1** | ✅ **Regular multi-delete is atomic locally across task lists and redo** (✅ DONE 2026-07-10, v1.4.241 shipped) |
| ~~**FEATURE-1935**~~ | **P1** | ✅ **Combinable Quick Sort task pools — overdue, today, next 3/7 days, no date, and Uncategorized** (✅ DONE 2026-07-10, v1.4.242 shipped) |
| ~~**BUG-1936**~~ | **P1** | ✅ **Quick Sort postpone shortcuts use explicit destinations and persist in one click** (✅ DONE 2026-07-10, superseded behavior refined in BUG-1938) |
| ~~**BUG-1937**~~ | **P0** | ✅ **Same-version Electron release collision replaced the Quick Sort renderer** (✅ DONE 2026-07-10, v1.4.244 deployed and locally verified) |
| ~~**BUG-1938**~~ | **P0** | ✅ **Postpone keeps the task open and shows feedback on an opaque surface** (✅ DONE 2026-07-10, v1.4.245 deployed and locally verified) |
| ~~**BUG-1939**~~ | **P0** | ✅ **Postpone changes only the task due date without saving Quick Sort app/session state** (✅ DONE 2026-07-10, v1.4.246 deployed and locally installed) |
| ~~**BUG-1918**~~ | **P1** | ✅ **Sign-in needs manual refresh — SIGNED_IN loaded tasks before workspaces** (✅ DONE 2026-07-10) |
| ~~**BUG-1935**~~ | **P0** | ✅ **Board due-date column drops don't register; drag clone frozen at origin** (✅ DONE 2026-07-10, v1.4.243 shipped) |
| ~~**BUG-1940**~~ | **P0** | ✅ **Planning-canvas bubble titles preserve spaces while autosaving** (✅ DONE 2026-07-12, v1.4.247 shipped) |
| **BUG-1941** | **P0** | ✅ **Failed permanent-delete/done persistence now rolls back visibly instead of returning as false success** (shipped v1.4.248, 2026-07-12) |
| ~~**BUG-1942**~~ | **P0** | ✅ **PWA-created task and Hermes status changes now reconcile visibly in Electron; v1.4.250 shipped** |
| ~~**BUG-1944**~~ | **P0** | ✅ **Persisted Electron identity stays account-owned while auth validation is pending; remote writes remain gated** |
| ~~**BUG-1945**~~ | **P1** | ✅ **Confirmed Canvas image deletion now removes the canonical record and rendered node; undo/redo verified** |
| ~~**BUG-1946**~~ | **P1** | ✅ **Daily regression hunt now tests a clean current-master worktree without touching active development changes** |
| **TASK-1943** | **P0** | 🔄 **Reliable Hermes–FlowState personal-assistant program: canonical sync, dynamic decomposition, monitor reliability, writable Notion, watchdogs, and packaged proof** |
| **TASK-1944** | **P0** | 🔄 **Canonical operation/revision/change-sequence foundation with safe branch recovery, signed-user receipts, replay, compatibility triggers, and deterministic catch-up** |
| **TASK-1945** | **P0** | 🔄 **Canonical Local API task patch adoption with preview/apply approval binding, receipt validation, and exact replay** |
| **TASK-1947** | **P0** | 🔄 **Deterministic canonical change-sequence catch-up with scoped durable cursors, ordered invalidation pages, and persistence-gated advancement** |
| **TASK-1946** | **P0** | ✅ **Canonical web/PWA offline scalar task-patch adoption with durable operation identity, receipts, restart-safe replay, and conflict quarantine** |
| **TASK-1948** | **P0** | ✅ **Canonical Notion task activation with stable provenance, exact optional work blocks, replayable canonical receipts, and Local API verification** |
| ~~**TASK-1949**~~ | **P0** | ✅ **Canonical assistant disposable DB harness, race/fault injection, fixed daily regression coverage, and redacted VPS integrity watchdog** |
| ~~**TASK-1950**~~ | **P0** | ✅ **Renderer-to-sidecar auth recovery classification with actionable protected-route errors and false-incident suppression** |
| ~~**TASK-1951**~~ | **P0** | ✅ **Production UUID compatibility for canonical task/Notion RPCs, rollback suites, and VPS watchdog** |
| **TASK-1952** | **P0** | 🔄 **Hydrate Electron auth backup into the live Supabase client and restore protected sidecar reads after restart** |
| ~~**TASK-1953**~~ | **P0** | ✅ **Preserve blocked remote Canvas projection updates and replay latest store geometry after interaction guards clear** |
| ~~**BUG-1954**~~ | **P0** | ✅ **DONE — shipped Electron 1.4.255; authenticated empty projections recover and the real Canvas empty state is opaque** |
| ~~**BUG-1955**~~ | **P0** | ✅ **DONE — shipped Electron 1.4.256 with executable source/package coverage and live Hermes exact-task read-back** |
| **TASK-1956** | **P0** | 🔄 **Reliable complete FlowState inventory with restart-safe sidecar auth, typed freshness/completeness, stable pagination, and packaged proof** |
| **TASK-1957** | **P0** | 🔄 **Atomic recurrence-aware duplicate merge with preview-bound cadence resolution and stop-on-conflict assistant behavior** |
| ~~**TASK-1959**~~ | **P0** | ✅ **Receipt-backed audit coverage with completeness classes, broad-claim guardrails, and screenshot-row reconciliation for Hermes summaries** |
| ~~**TASK-1958**~~ | **P1** | ✅ **Canonical non-recurring task completion with approval digest, committed receipt, completedAt read-back, and recurring fail-closed rejection** |
| ~~**TASK-1959**~~ | **P0** | ✅ **Redacted source/build/public/installed/sidecar truth ledger with embedded non-live package provenance and mismatch evidence** |
| **TASK-1960** | **P0** | 🔄 **Make complete inventory the only exhaustive assistant task boundary with typed samples and fail-closed large scans** |
| **TASK-1961** | **P0** | 🔄 **Shared canonical assistant receipt validation with recomputed hashes and fail-closed mutation notifications** |
| **TASK-1962** | **P0** | 🔄 **Preflight every Hermes-to-FlowState route, package the canonical task lifecycle, and reject incomplete runtimes before work starts** |
| **TASK-1963** | **P0** | 🔄 **Canonical atomic subtask breakdown with immutable preview approval, parent revisions, replay-safe receipts, and validated ordered read-back** |
| **BUG-1964** | **P0** | ✅ **DONE 2026-07-18 — Sign in once and retain the account through refresh failures, close/relaunch, and updates until explicit Sign Out** |
| **FEATURE-1943** | **P0** | 🔄 **Hermes-safe recurring Done for now: atomic history, recurrence advance, idempotent preview/apply, and live UI reconciliation** |
| **FEATURE-1944** | **P0** | 📋 **Shared transactional work-block move/resize/remove lifecycle for UI, Local API, and Hermes** |
| **FEATURE-1945** | **P0** | 📋 **Recurrence chain/history reads plus safe cadence edit, pause, resume, and end-series actions** |
| **FEATURE-1946** | **P1** | 📋 **Authenticated project/group reads and previewed exact-ID assignment** |
| **FEATURE-1947** | **P0** | 📋 **Leadership-safe timer start/pause/resume/stop through the signed-in Local API** |
| **FEATURE-1948** | **P1** | 📋 **Bounded Canvas read plus move/group/ungroup/remove-placement actions** |
| **FEATURE-1949** | **P1** | 📋 **Cursor pagination, restore, bounded batch actions, and context/audit reads** |
| **BUG-1912** | **P1** | 📋 **Canvas edge can't be disconnected; edge drag glitches whole screen (software compositing)** |
| **TASK-1905** | **P2** | 📋 **Rewrite 19 AI-chat E2E specs for the sidebar UX (full-page /#/ai removed in d0f90130)** |
| **TASK-1906** | **P2** | 📋 **Per-worker E2E test users (cross-file canvas interference under parallel workers)** |
| ~~**BUG-1907**~~ | **P1** | ✅ **Quick Tasks typed pin can look like a no-op — explicit result contract + visible feedback** (✅ DONE 2026-07-03) |
| ~~**BUG-1892**~~ | **P0** | ✅ **"Time for a break" popup loops endlessly until app close — make completion idempotent per session id (durable guard) + KDE per-session-id guard** (✅ DONE 2026-06-25 — shipped Electron v1.4.218 + web; KDE guard needs widget-reinstall verify) |
| ~~**BUG-1891**~~ | **P0** | ✅ **Deleted tasks keep resurfacing — unify deletion truth on tombstones (soft-delete writes/removes tombstone via DB trigger + fail-closed load merge)** (✅ DONE 2026-06-25 — DB trigger live on prod 319→0, 7 zombies healed, Electron v1.4.217 shipped, web JS pushed) |
| ~~**BUG-1869**~~ | **P0** | ✅ **Skipped realtime task updates can leave Electron, localhost, and KDE out of sync** (✅ DONE 2026-06-15, shipped v1.4.184) |
| ~~**BUG-1868**~~ | **P0** | ✅ **Timer start can look active locally while Electron, localhost, and KDE see no synced session** (✅ DONE 2026-06-15, shipped v1.4.183) |
| ~~**BUG-1867**~~ | **P0** | ✅ **Canvas geometry drifts across Electron and localhost while idle** (✅ DONE 2026-06-15, shipped v1.4.182) |
| ~~**BUG-1866**~~ | **P0** | ✅ **Malformed due date crashes Calendar view in Electron** (✅ DONE 2026-06-15, shipped v1.4.181) |
| ~~**TASK-1289**~~ | **P0** | ✅ **Investigate severe task position drift episode** |
| ~~**TASK-1285**~~ | **P0** | ✅ **Commit deploy safeguards & clean up 20 dead Claude hooks** (2026-02-10) |
| ~~**FEATURE-1293**~~ | **P2** | ✅ **Catalog View UX/UI Redesign — bulk ops, scanning, inline editing, review/triage** |
| ~~BUG-1199~~ | P1 | ✅ Canvas inbox right-click acts as Ctrl+Click |
| ~~BUG-1206~~ | P0 | ✅ Task details not saved when pressing Save in canvas (3-layer fix: pending write guard + extended isVeryRecent + modal-aware recovery) |
| ~~BUG-1208~~ | P1 | ✅ Task edit modal closes on text selection release |
| ~~BUG-1212~~ | P0 | ✅ Sync queue CREATE retry causes "duplicate key" corruption |
| ~~BUG-1286~~ | P2 | ✅ PWA Today View shows 2:00 AM on all tasks due to UTC timezone parsing |
| ~~**BUG-1291**~~ | **P0** | ✅ **Timer not starting from calendar play btn / context menu Start btn / canvas; Calendar has no right-click context menu** |
| ~~**BUG-1292**~~ | **P1** | ✅ **KDE Widget intermittently fails to start break timer (30s polling gap after session complete)** |
| ~~**TASK-1292**~~ | **P0** | ✅ **Quick task creation in KDE widget — quick-add input (+ / play buttons) + pinned task chips (monorepo)** |
| ~~**BUG-1293**~~ | **P1** | ✅ **Canvas CSS tokenization damage — broken shadows, phantom tokens, debug elements** |
| ~~**BUG-1294**~~ | **P1** | ✅ **Calendar play button shouldn't reset timer or create new instances when timer is already running for that task** |
| ~~**BUG-1296**~~ | **P1** | ✅ **Time block notifications never fire — _rawTasks → rawTasks property name mismatch** |
| ~~**BUG-1302**~~ | **P1** | **✅ Time block notifications still not firing — milestones silently missed despite BUG-1296 fix** |
| ~~**BUG-1303**~~ | **P2** | ✅ **Mark Done doesn't stop active timer running on that task** (✅ DONE — fix in taskOperations.ts:431) |
| ~~**BUG-1304**~~ | **P2** | ✅ **Done tasks in calendar view have no visual done indicator** (✅ DONE — visual indicator in all 3 calendar views) |
| ~~**BUG-1305**~~ | **P2** | ✅ **TaskQuickEditPopover renders behind AI Chat panel — z-index stacking issue** |
| ~~**TASK-1337**~~ | **P3** | ✅ **Storybook Design Streamlining — align all stories with design system** |
| ~~**TASK-1338**~~ | **P0** | ✅ **Configurable PWA Push Notifications — per-category controls, quiet hours, server-side push service** |
| ~~**BUG-1311**~~ | **P3** | ✅ **Storybook: 3 story files fail to import (ReloadPrompt, CalendarDayView, CalendarWeekView)** |
| ~~**TASK-1311**~~ | **P2** | ✅ **Add date picker to Quick Sort** |
| ~~**TASK-1312**~~ | **P2** | ✅ **Quick Sort context panel — date/day, priority, project info (desktop + PWA responsive)** |
| ~~**TASK-1313**~~ | **P3** | ✅ **UI polish: FocusView pause & leave, kanban tooltips, date picker popover, RTL dir** |
| ~~**FEATURE-1314**~~ | **P2** | ✅ **AI Weekly Quick Sort — sort week's tasks with AI + push to canvas date groups** |
| **TASK-1326** | **P2** | **👀 Weekly Plan AI Enhancements (Batching, Theme, Feedback Loop)** |
| ~~**TASK-1385**~~ | **P2** | ✅ **Weekly Plan AI — deterministic rebalancer + smarter model routing + prompt quality** |
| ~~**TASK-1399**~~ | **P2** | ✅ **Weekly Plan — model/provider selector connected to centralized AI model registry** |
| ~~**TASK-1400**~~ | **P2** | ✅ **SOP-045 Tauri AppImage Update Workflow + fix stale binary — created SOP, fixed user's stale v1.2.18 AppImage, removed debug logging from canvas drag** |
| ~~**FEATURE-1317**~~ | **P3** | ✅ **AI Work Profile / Persistent Memory — learn user work patterns for smarter weekly plans** |
| ~~**TASK-1316**~~ | **P2** | ✅ **AI Provider Usage & Cost Tracking — new Settings tab with per-provider token/cost totals** |
| ~~**TASK-1341**~~ | **P2** | ✅ **Quick Sort UX Polish — left sidebar action buttons, arrow key shortcuts, action feedback overlays, swipe fix** (✅ DONE 2026-02-16) |
| **FEATURE-1342** | **P2** | **🔄 AI Task Suggestions — per-task/group button to auto-suggest priority, due date, status based on user data** |
| ~~**BUG-1343**~~ | **P2** | ✅ **Quick Sort exits when swiping right on PWA mobile** (✅ DONE 2026-02-17) |
| ~~**BUG-1350**~~ | **P0** | ✅ **New Task transcription page closes prematurely — transcription doesn't appear on PWA mobile** (✅ DONE 2026-02-18) |
| ~~**BUG-1352**~~ | **P1** | ✅ **Calendar inbox filtered by board smart view — only shows 4 tasks instead of all unscheduled** (✅ DONE 2026-02-17) |
| ~~**BUG-1353**~~ | **P0** | ✅ **Sidebar quick task: metadata buttons disappear on click + no save confirmation** (✅ DONE 2026-02-17) |
| ~~**BUG-1355**~~ | **P1** | ✅ **Can't log out — Supabase signOut fails silently, session re-establishes. Buttons squashed. Post-logout UI stuck** (✅ DONE 2026-02-17) |
| ~~**BUG-1357**~~ | **P0** | ✅ **Mobile PWA timer sync broken with web app** (✅ DONE 2026-02-18) |
| ~~**TASK-1354**~~ | **P2** | ✅ **AI quality assessment + timer fixes + CSS cleanup** (✅ DONE 2026-02-18) |
| ~~**BUG-1351**~~ | **P0** | ✅ **Calendar drag ghost stuck after inbox→day drop** (✅ DONE 2026-02-17) |
| ~~**BUG-1349**~~ | **P2** | ✅ **QuickSort progress bar jumps when pressing number keys to assign project** (✅ DONE 2026-02-17) |
| ~~**BUG-1359**~~ | **P0** | ✅ **vue-i18n version mismatch causing $t() SyntaxErrors — upgraded vue-i18n 9→11, re-applied i18n translations across 11 files (EN+HE)** (✅ DONE 2026-02-19) |
| ~~**BUG-1348**~~ | **P0** | ✅ **Priority badge color mismatch — medium badge gray instead of orange** (✅ DONE 2026-02-17) |
| ~~**TASK-1356**~~ | **P2** | ✅ **AI Memory Assessment System — test/evaluate memory effectiveness for user context + AI usage across app, CLI + admin settings UI** (✅ DONE 2026-02-18) |
| **TASK-1358** | **P2** | **🔄 Rewrite 28 canvas todo tests — replace over-designed Vue Flow mocking with direct store/handler unit tests using real data shapes** |
| ~~**BUG-1347**~~ | **P0** | ✅ **KDE Plasma widget freeze — gated 40+ console.log behind debug flag, staggered concurrent XHR with Qt.callLater(), reactive transition timer, throttled canvas repaints** (✅ DONE 2026-02-19) |
| ~~**BUG-1365**~~ | **P0** | ✅ **Calendar day view — task disappears after editing and saving (false positive scheduleExplicitlyRemoved for instance-based tasks)** (✅ DONE 2026-02-19) |
| ~~**BUG-1360**~~ | **P0** | ✅ **Canvas long task cards cut off when zooming — removed LOD content hiding, overflow:hidden chain, title 3-line clamp** (✅ DONE 2026-02-20) |
| ~~**BUG-1567**~~ | **P2** | ✅ **Deleted projects still appear in QuickSort CategorySelector — project store `projects` computed doesn't filter soft-deleted projects (is_deleted=true)** (✅ DONE 2026-03-18) |
| ~~**TASK-1571**~~ | **P2** | ✅ **Edit Task modal RTL support — added dir="auto" to 7 inputs across TaskEditHeader, QuickTaskCreate, QuickTaskCreateModal, TaskEditSubtasks, TaskTable** (✅ DONE 2026-03-18) |
| ~~**TASK-1692**~~ | **P2** | ✅ **Desktop task list RTL + chat Hebrew paragraphs — reversed TaskRow/TaskTable grid in [dir="rtl"], fixed priority indicator logical props, added unicode-bidi:plaintext to markdown block elements** (✅ DONE 2026-03-23) |
| **TASK-1693** | **P2** | 🔄 **Calendar virtual timer block — inject virtual CalendarEvent for the currently-timed task when it has no real instance for today, so it always appears on the day view** |
| ~~**BUG-1361**~~ | **P1** | ✅ **Calendar inbox drag ghost pills stuck on screen — endGlobalDrag() never called when source element removed by reactive filtering** (✅ DONE 2026-02-19) |
| **FEATURE-1363** | **P2** | **📋 Add reminders & notifications to all platforms (PWA, Electron, KDE widget)** |
| ~~**BUG-1346**~~ | **P1** | ✅ **Mobile Inbox tab broken in PWA on mobile — layout/design broken** (✅ DONE 2026-03-04) |
| ~~**TASK-1362**~~ | **P0** | ✅ **Calendar task selection, multi-select & keyboard actions — click to select, Ctrl+click multi-select, Delete→inbox, Shift+Delete→remove, drag-back to inbox** (✅ DONE 2026-02-20) |
| ~~**BUG-1366**~~ | **P1** | ✅ **i18n locale desync — UI stays Hebrew when English selected, store locale hardcoded to 'en' ignoring localStorage** (✅ DONE 2026-02-20) |
| ~~**BUG-1367**~~ | **P2** | ✅ **Canvas inbox panel on wrong side — parent CSS overrode is-right-side to left, flipped to right** (✅ DONE 2026-02-20) |
| ~~**BUG-1368**~~ | **P2** | ✅ **? keyboard shortcut broken on Hebrew layout — event.key check fails on non-Latin layouts, added event.code fallback** (✅ DONE 2026-02-20) |
| ~~**BUG-1374**~~ | **P1** | ✅ **AI Chat 4-bug combo — Hebrew response on English input, LTR for Hebrew text, fluffy advice, wrong tasks returned (all fixed 2026-02-21)** |
| ~~**TASK-1375**~~ | **P1** | ✅ **AI Pipeline orchestrator + types — create pipeline/ with guardrail interfaces and function composition** (✅ DONE 2026-02-21) |
| ~~**TASK-1376**~~ | **P1** | ✅ **Language detector — deterministic Unicode-range detection, detectLanguageMismatch()** (✅ DONE 2026-02-21) |
| ~~**TASK-1377**~~ | **P1** | ✅ **Context optimizer — separate task titles from metadata, character budget, date-relative filtering** (✅ DONE 2026-02-21) |
| ~~**TASK-1378**~~ | **P1** | ✅ **Response validator — consolidate 3 cleanup locations into one, add UUID stripping, reuse qualityAssessment rules** (✅ DONE 2026-02-21) |
| ~~**TASK-1379**~~ | **P1** | ✅ **Language enforcer — post-processing guardrail, detect mismatch + flag in metadata** (✅ DONE 2026-02-21) |
| ~~**TASK-1380**~~ | **P1** | ✅ **Response length enforcer — cap by intent (greetings, tool summaries, analytical)** (✅ DONE 2026-02-21) |
| ~~**TASK-1381**~~ | **P1** | ✅ **Wire pre-processing into useAIChat — call runPreProcess before ReAct, use contextOptimizer** (✅ DONE 2026-02-21) |
| ~~**TASK-1382**~~ | **P1** | ✅ **Wire post-processing into useAIChat — runPostProcess after ReAct, replace inline cleanup** (✅ DONE 2026-02-21) |
| ~~**TASK-1383**~~ | **P1** | ✅ **Simplify ChatMessage.vue renderedContent — remove redundant regex, pipeline handles cleanup** (✅ DONE 2026-02-21) |
| ~~**TASK-1384**~~ | **P1** | ✅ **Unit tests for pipeline — guardrails, language detection, context optimization, composition** (✅ DONE 2026-02-21) |
| ~~**TASK-1388**~~ | **P1** | **✅ Pre-digested reasoning engine — compute task analysis in code, LLM formats facts naturally** (✅ DONE) |
| ~~**TASK-1389**~~ | **P1** | **✅ Skeleton prompting for agent chains — code generates sections, LLM writes bridges** (✅ DONE) |
| ~~**TASK-1390**~~ | **P1** | **✅ Fluff detector guardrail — heuristic scoring: task name references, data points, no generic phrases** (✅ DONE) |
| ~~**TASK-1391**~~ | **P1** | **✅ Validation + retry loop — retry once with feedback when fluff score < 0.5** (✅ DONE) |
| ~~**TASK-1392**~~ | **P1** | **✅ Keyword-based tool hints — deterministic keyword→tool mapping injected into system prompt** (✅ DONE) |
| ~~**TASK-1393**~~ | **P1** | **✅ `projectId` filter on `list_tasks` — quick win, 15 minutes** (✅ DONE) |
| ~~**TASK-1394**~~ | **P1** | **✅ Counting vs listing clarification — system prompt rule to prevent unnecessary tool calls** (✅ DONE) |
| ~~**TASK-1395**~~ | **P1** | **✅ Install uFuzzy + `resolveTask()` helper — fuzzy title matching for entity resolution** (✅ DONE) |
| ~~**TASK-1396**~~ | **P1** | **✅ Wire `resolveTask()` into write tools — title-based resolution fallback in `validateTaskExists()`** (✅ DONE) |
| ~~**TASK-1397**~~ | **P1** | **✅ `mark_task_done` convenience tool — accepts title string, most common user action** (✅ DONE) |
| ~~**TASK-1398**~~ | **P1** | **✅ Conversation entity memory — track mentioned tasks, resolve pronouns ("it", "that one")** (✅ DONE) |
| **TASK-1386** | **P2** | **✅ Google Calendar proxy Edge Function — list-calendars, list-events, token refresh on 401** |
| ~~**BUG-1417**~~ | **P1** | ✅ **Canvas nodes nearly invisible — undefined `--shadow-color-sm` token + near-identical bg = no depth** (✅ DONE 2026-02-27) |
| ~~**TASK-1420**~~ | **P1** | ✅ **Add project selector to task edit modal — TaskEditMetadata missing project field** (✅ DONE 2026-02-27) |
| ~~**TASK-1419**~~ | **P1** | ✅ **Inbox multi-select bulk property updates — context menu actions apply to all selected tasks** (✅ DONE 2026-02-27) |
| ~~**TASK-1418**~~ | **P1** | ✅ **Too many buttons on calendar dashboard — consolidate into dropdown or settings** (✅ DONE 2026-02-27) |
| ~~**TASK-1435**~~ | **P2** | ✅ **Active task glass pill — KDE companion widget + AppHeader pill showing current Pomodoro task** (✅ DONE 2026-03-03) |
| ~~**TASK-1424**~~ | **P2** | ✅ **KDE widget nanny notifications — schedule-gated idle reminders when no Pomodoro active** (✅ DONE 2026-03-03) |
| ~~**TASK-1423**~~ | **P2** | ✅ **KDE widget: add button to open Tauri or web app** (✅ DONE 2026-03-03) |
| ~~**TASK-1431**~~ | **P2** | ✅ **KDE widget "Today" toggle button — standalone chip in pinned row, composable with any dropdown filter** (✅ DONE 2026-03-02) |
| ~~**TASK-1429**~~ | **P0** | ✅ **KDE Widget Task Editing — inline edit panel (status/priority/due date) + "Open in App" deep link + perm delete + duration presets** (✅ DONE 2026-03-03) |
| ~~**TASK-1428**~~ | **P0** | ✅ **Auto-inherit group properties when creating task in a group (e.g. "Today" → today's due date)** (✅ DONE 2026-03-03) |
| ~~**TASK-1440**~~ | **P1** | ✅ **Gamification offline resilience — local-first state updates + try/catch wrapping for all Supabase writes** (✅ DONE 2026-03-03) |
| ~~**TASK-1441**~~ | **P2** | ✅ **Graceful offline UX for non-cacheable features — AI chat, file uploads, Drive show informative messages instead of failing silently** (✅ DONE 2026-03-03) |
| ~~**BUG-1442**~~ | **P1** | ✅ **timer_sessions.position_version column does not exist — DB schema mismatch** (✅ DONE 2026-03-04 — code already guards correctly, no path queries this column) |
| ~~**TASK-1443**~~ | **P2** | ✅ **Calendar Delete key shows confirmation dialog before unscheduling event (instead of silent action)** (✅ DONE 2026-03-04) |
| ~~**TASK-1448**~~ | **P2** | ✅ **KDE Widget quick-add due date dropdown — default "Today" so tasks appear in today views** (✅ DONE 2026-03-05) |
| ~~**TASK-1450**~~ | **P2** | ✅ **Integrate Quick Sort sessions into offline sync queue for full PWA offline support** (✅ DONE 2026-03-05) |
| ~~**TASK-1451**~~ | **P2** | ✅ **Auto-inherit filter context when creating tasks — useFilterDefaults composable** (✅ DONE 2026-03-05) |
| ~~**TASK-1452**~~ | **P2** | ✅ **KDE Widget — Switch Active Timer to Different Task** (✅ DONE 2026-03-05) |
| ~~**TASK-1460**~~ | **P2** | ✅ **KDE Widget — Bump task limit to 100 + group by project** (✅ DONE 2026-03-06) |
| ~~**BUG-1461**~~ | **P1** | ✅ **KDE widget hard-DELETE caused ghost tasks in web app — changed to soft-delete + smart merge fix** (✅ DONE 2026-03-06) |
| ~~**BUG-1806**~~ | **P1** | ✅ **Mark-done can still trigger phantom nudge state** (✅ DONE 2026-05-28, shipped v1.4.78) |
| ~~**BUG-1805**~~ | **P1** | ✅ **KDE nanny nudge resurfaced after marking a task done** (✅ DONE 2026-05-27) |
| ~~**TASK-1484**~~ | **P3** | ✅ **Escape key closes TaskContextMenu** (✅ DONE 2026-03-08) |
| ~~**TASK-1496**~~ | **P2** | ✅ **Non-obstructive overflow tooltips on all truncated text app-wide** (✅ DONE 2026-03-09) |
| **BUG-1498** | **P2** | 🔄 **Taskbar nanny not triggering after 5min idle without active task (INQUIRY-1489 regression)** |
| **BUG-1497** | **P2** | 📋 **CSS safety test failing due to missing fileURLToPath import** |
| ~~**BUG-1732**~~ | **P2** | ✅ **Canvas group badge counts task not rendered — parentId without canvasPosition** (✅ DONE 2026-03-26) |
| ~~**TASK-1487**~~ | **P2** | ✅ **Search modal: delete fix + filter pills (Today, Hide Done, High Priority, No Date)** (✅ DONE 2026-03-08) |
| ~~**BUG-1490**~~ | **P2** | ✅ **KDE widget stops syncing — token refresh chain break, missing 401 handling, isRefreshingToken deadlock** (✅ DONE 2026-03-09) |
| ~~**BUG-1530**~~ | **P2** | ✅ **Dragging task to Today canvas group doesn't update Calendar inbox** (✅ DONE 2026-03-14) |
| **BUG-1491** | **P0** | 🔄 **Canvas duplicate tasks appear sporadically across views** (🔄 IN PROGRESS 2026-03-09) |
| ~~**INQUIRY-1489**~~ | **P2** | ✅ **Nanny activation for unchosen tasks idle >5min in taskbar** (✅ DONE 2026-03-09) |
| ~~**TASK-1501**~~ | **P3** | ✅ **AI tools audit: fix byStatus stale keys, add undo to update_task and create_group** (✅ DONE 2026-03-10) |
| ~~**BUG-1504**~~ | **P2** | ✅ **Canvas inbox: left-click multi-selects tasks unexpectedly, can't deselect** (✅ DONE 2026-03-12) |
| ~~**BUG-1521**~~ | **P2** | ✅ **KDE Widget: pinned task chip click does nothing — searches only filtered tasks, misses match** (✅ DONE 2026-03-14) |
| ~~**BUG-1506**~~ | **P0** | ✅ **Edit Task: description loses bullet points on save — htmlToMarkdown regex truncation** (✅ DONE 2026-03-14) |
| ~~**BUG-1505**~~ | **P2** | ✅ **KDE Widget: Nanny popup only shows ~2 tasks — increase limit and sort by due date** (✅ DONE 2026-03-13) |
| **TASK-1499** | **P2** | 📋 **KDE widget: fix canvas sort/filter — wrong column + missing Y-position sorting** (📋 PLANNED) |
| ~~**TASK-1500**~~ | **P2** | ✅ **Smart model routing: complexity classifier + hybrid pricing (free for simple, premium for complex)** (✅ DONE 2026-03-13) |
| ~~**TASK-1486**~~ | **P2** | ✅ **Pinned/persistent tasks — always-visible utility tasks (e.g. "General Dev", "Organize Tasks") separate from regular task list** (✅ DONE 2026-03-13) |
| ~~**TASK-1485**~~ | **P2** | ✅ **Move AI Assist to More submenu + teal Mark Done line** (✅ DONE 2026-03-09) |
| ~~**TASK-1457**~~ | **P2** | ✅ **Demo test user + Playwright fixtures — seeded user with tasks, groups, and data for E2E testing** (✅ DONE 2026-03-13) |
| ~~**TASK-1456**~~ | **P0** | ✅ **Add permanent delete button to right-click context menu** (✅ DONE 2026-03-06) |
| ~~**TASK-1455**~~ | **P2** | ✅ **Catalog view: show uncategorized tasks so they can be categorized in-place** (✅ DONE 2026-03-09) |
| ~~**TASK-1454**~~ | **P2** | ✅ **Quick Sort: match PWA look/behavior on desktop + confirm permanent delete** (✅ DONE 2026-03-09) |
| ~~**BUG-1472**~~ | **P1** | ✅ **Canvas and Calendar inbox filters synced — persistence keys not context-scoped** (✅ DONE 2026-03-07) |
| ~~**BUG-1453**~~ | **P0** | ✅ **Production CSS preload + mobile Quick Sort swipe broken** (✅ DONE 2026-03-07) |
| ~~**BUG-1477**~~ | **P1** | ✅ **Zombie tasks reappear after permanent delete — tombstone/delete ordering + DB trigger conflict** (✅ DONE 2026-03-07) |
| ~~**BUG-1479**~~ | **P2** | ✅ **Date picker calendar closes when moving cursor to it — NPopover mouseleave** (✅ DONE 2026-03-07) |
| ~~**BUG-1447**~~ | **P2** | ✅ **Pin task disappears on Enter + task search + widget sync** (✅ DONE 2026-03-05) |
| **TASK-1446** | **P2** | ✅ **BUG-1137: Add Guest Session ID for migration tracking — explicit UUID links guest data to new account on sign-up** (✅ DONE 2026-03-04) |
| ~~**TASK-1445**~~ | **P2** | ✅ **Fix focus mode dropdown closing on hover + overlapping menus — UX research & redesign** (✅ DONE 2026-03-05) |
| ~~**TASK-1459**~~ | **P2** | ✅ **Storybook story quality pass — fix broken/unclear stories for Teleport components and PWA Screens** (✅ DONE 2026-03-07) |
| ~~**TASK-1444**~~ | **P1** | ✅ **Tauri desktop app design parity — investigate and fix visual discrepancies vs web/Storybook** (✅ DONE — Obsolete) **Archived**: Superseded by TASK-1715 (Electron migration) |
| **INQUIRY-1438** | **P0** | 📋 **Assess open-source self-hosting readiness — what's needed for GitHub sharing (Win/Mac/Linux)** (📋 PLANNED) |
| ~~**BUG-1451**~~ | **P1** | ✅ **Task done/deleted state inconsistent across views — Board hideDoneTasks coupled to Canvas/Calendar** (✅ DONE 2026-03-05) |
| ~~**BUG-1449**~~ | **P1** | ✅ **KDE widget notification barrage + popup dismiss + nanny task selection** (✅ DONE 2026-03-05) |
| ~~**TASK-1434**~~ | **P0** | ✅ **Calendar drag-to-create — click and drag on time slots to create a new task** (✅ DONE 2026-03-03) |
| ~~**TASK-1433**~~ | **P0** | ✅ **Right-click task context menu UX overhaul — reduce bloat, fix hierarchy, progressive disclosure** (✅ DONE 2026-03-03) |
| ~~**BUG-1432**~~ | **P1** | ✅ **Overdue tasks display today's date instead of actual due date** (✅ DONE 2026-03-05) |
| ~~**TASK-1427**~~ | **P0** | ✅ **Offline: merge write queue into read cache on offline load** (✅ DONE 2026-03-04) |
| ~~**TASK-1426**~~ | **P0** | ✅ **Offline: auth grace period — keep expired session for local ops** (✅ DONE 2026-03-04) |
| ~~**TASK-1425**~~ | **P0** | ✅ **Offline: fast startup — skip Supabase when navigator.onLine=false** (✅ DONE 2026-03-04) |
| **TASK-1422** | **P0** | 🔄 **Full offline mobile support — PWA works E2E without network** (🔄 IN PROGRESS 2026-03-02) |
| ~~**TASK-1421**~~ | **P0** | ✅ **Investigate & fix sluggish localhost performance** (✅ DONE 2026-03-02) |
| ~~**BUG-1416**~~ | **P0** | ✅ **Calendar inbox "today" filter shows wrong tasks — dueDate format mismatch (ISO vs YYYY-MM-DD)** (✅ DONE 2026-03-13) |
| ~~**BUG-1415**~~ | **P0** | ✅ **Catalog drag doesn't move task to target group — drops on task rows make subtasks instead of transferring between groups** (✅ DONE 2026-02-25) |
| ~~**TASK-1405**~~ | **P1** | ✅ **Replace LLM Distribution with Deterministic Algorithm in Weekly Plan** (✅ DONE 2026-03-13) |
| ~~**TASK-1403**~~ | **P2** | ✅ **Recurring Tasks — Clone-on-Complete with recurrence_rule column** (✅ DONE 2026-02-22) |
| ~~**TASK-1402**~~ | **P1** | ✅ **Decouple canvas/calendar inbox filtering — isInInbox now user-controlled, placement uses position-based filtering** (✅ DONE 2026-02-22) |
| ~~**TASK-1387**~~ | **P1** | **✅ Centralize all AI model references to single source of truth** (✅ DONE 2026-02-21) |
| ~~**TASK-1372**~~ | **P1** | **✅ Calendar delete should warn tasks will return to inbox — left-click + Delete on calendar needs confirmation dialog** (✅ DONE 2026-03-13) |
| ~~**BUG-1371**~~ | **P0** | ✅ **Connected canvas node persists after deletion — deleting a node with edges leaves it visible on canvas** (✅ DONE 2026-02-20) |
| ~~**BUG-1370**~~ | **P0** | ✅ **Canvas inbox drag broken — can't drag tasks from canvas inbox to canvas (Tauri + possibly local dev)** (✅ DONE 2026-02-20) |
| ~~**BUG-1369**~~ | **P0** | ✅ **Canvas tasks persist after marked done — completed tasks remain visible on canvas instead of being removed** (✅ DONE 2026-02-21) |
| ~~**TASK-1345**~~ | **P2** | ✅ **Perfect Hebrew Whisper Transcription on Mobile PWA — language param, Hebrew prompt, temperature=0, iOS Safari .m4a fix, verbose_json confidence filtering** |
| ~~**TASK-1344**~~ | **P2** | ✅ **AI Feature Parity Desktop→PWA + API Pricing/Usage Settings Sync — code done, useAISync.ts implemented** |
| **FEATURE-1345** | **P2** | **🔄 Capacitor Android App — wrap Vue PWA for Play Store distribution (config + build scaffold done)** |
| ~~**TASK-1339**~~ | **P0** | ✅ **Tasks must persist over refresh in guest mode** (✅ DONE 2026-02-17) |
| ~~**BUG-1340**~~ | **P0** | ✅ **Kanban drag-drop broken — Vue 3 $attrs boolean bug (forceFallback/delayOnTouchOnly passed as empty string)** |
| ~~**TASK-1327**~~ | **P0** | ✅ **Centralized LLM Model Registry — single source of truth for all AI model lists, updating one place updates all dropdowns** (✅ DONE 2026-02-17) |
| ~~**TASK-1324**~~ | **P0** | ✅ **URL Display Truncation — shorten long pasted URLs/links across all views (CSS ellipsis, full URL preserved)** (✅ DONE 2026-02-17) |
| ~~**BUG-1333**~~ | **P0** | ✅ **Calendar inbox shows only 2 tasks — stale auto-instances + wrong filter source** |
| ~~**TASK-1323**~~ | **P1** | ✅ **Console Log Cleanup — reduce verbose/debug logging noise across app** (✅ DONE 2026-02-14) |
| ~~**TASK-1322**~~ | **P1** | ✅ **Calendar Month View Fixes — remove dueDate pollution, vertical event layout, drag-move fix, hover tooltips** (✅ DONE 2026-02-17) |
| ~~**TASK-1319**~~ | **P0** | ✅ **Keyboard Shortcuts Help Panel — ? button + Shift+? shortcut, organized categories, blurred backdrop** (✅ DONE 2026-02-14) |
| ~~**TASK-1320**~~ | **P1** | ✅ **Quick Sort UX Redesign — Edit-in-Place with Explicit Advancement (pin-by-ID, Save button, swipe swap)** |
| ~~**BUG-1309**~~ | **P0** | ✅ **Remove corruption overlay, arena, and all gamification UI — visual noise and disconnected UX** |
| ~~**BUG-1301**~~ | **P0** | ✅ **Sync indicator stuck on "Syncing 1 changes..." — orphaned 'syncing' ops in IndexedDB never recover** |
| ~~TASK-1215~~ | P0 | ✅ Persist full UI state across restarts (filters, view prefs, canvas toggles) via useStorage |
| ~~TASK-1246~~ | P2 | ✅ Multi-select filters for inbox (priority, project, duration) with checkboxes + persistence |
| ~~TASK-1247~~ | P2 | ✅ Add "Next 3 Days" filter to inbox (canvas icon bar + unified inbox dropdown) |
| ~~TASK-1248~~ | P1 | ✅ Design token audit & cleanup — all 7 phases complete, ~100+ violations fixed across 30 files |
| ~~TASK-1249~~ | P0 | ✅ Codebase Hygiene Audit — placeholders, hardcoded values, debug leftovers (33/33 sub-tasks done) |
| ~~TASK-1250~~ | P0 | ✅ Fix API key storage — removed plaintext localStorage (proxy handles keys server-side) |
| ~~TASK-1251~~ | P0 | ✅ Fix direct API calls bypassing proxy (AIChatPanel.vue) |
| ~~TASK-1252~~ | P0 | ✅ Remove/gate /keyboard-test debug route (ships without auth) |
| ~~TASK-1253~~ | P0 | ✅ Gate window.__flowstate_tauri_debug behind DEV |
| ~~TASK-1254~~ | P0 | ✅ Fix CORS wildcard on Edge Functions — restricted to allowed origins |
| ~~TASK-1255~~ | P0 | ✅ Fix WelcomeModal — removed dead buttons and stubbed stats |
| ~~TASK-1256~~ | P0 | ✅ Fix stale flowstate.app → in-theflow.com origins |
| ~~TASK-1257~~ | P0 | ✅ Fix productionLogger — now uses Supabase session token |
| ~~TASK-1258~~ | P1 | ✅ Replace httpbin.org with self-hosted endpoint |
| ~~TASK-1259~~ | P1 | ✅ Remove unconditional %c[DEBUG] styled canvas log |
| ~~TASK-1260~~ | P1 | ✅ Remove ~30 bug-specific debug tags across 10 files |
| ~~TASK-1261~~ | P1 | ✅ Fix silent no-op stubs — now throw or warn |
| ~~TASK-1262~~ | P1 | ✅ Re-enable CI lint & unit tests |
| ~~TASK-1263~~ | P1 | ✅ Add Open Graph + Twitter Card meta tags |
| ~~TASK-1264~~ | P1 | ✅ Update stale AI model references |
| ~~TASK-1265~~ | P1 | ✅ Fix AI proxy health check consuming real API tokens (OPTIONS request) |
| ~~TASK-1266~~ | P2 | ✅ CSS design token migration — ~305 values migrated in 20+ files, remaining violations still exist |
| ~~TASK-1267~~ | P2 | ✅ Standardize localStorage key prefixes |
| ~~TASK-1268~~ | P2 | ✅ Extract magic timeout numbers to named constants (src/config/timing.ts) |
| ~~TASK-1269~~ | P2 | ✅ Create centralized src/config/urls.ts |
| ~~TASK-1270~~ | P2 | ✅ Fix hardcoded i18n defaults (ui.ts, SignupForm.vue) |
| ~~TASK-1271~~ | P2 | ✅ Improve Cyberflow empty states (terse text) |
| ~~TASK-1272~~ | P2 | ✅ Mobile design token compliance |
| ~~TASK-1273~~ | P2 | ✅ Update PWA manifest description |
| ~~TASK-1274~~ | P2 | ✅ Migrate 'uncategorized' sentinel to constant |
| ~~TASK-1275~~ | P3 | ✅ Remove 5 obsolete verification scripts |
| ~~TASK-1276~~ | P3 | ✅ Remove Storybook PLACEHOLDER duplicate key |
| ~~TASK-1277~~ | P3 | ✅ Standardize z-index usage (~60 values in 50 files) |
| ~~TASK-1278~~ | P3 | ✅ Standardize font-size usage (~100 values in 32 files) |
| ~~TASK-1279~~ | P3 | ✅ Add missing package.json metadata fields |
| ~~TASK-1280~~ | P3 | ✅ Add copyright to Tauri bundle config |
| ~~TASK-1281~~ | P3 | ✅ Adopt build-time console.log stripping (esbuild pure config) |
| ~~TASK-1282~~ | P3 | ✅ Stop filtering console.error/warn in consoleFilter.ts |
| ~~FEATURE-1200~~ | P2 | ✅ Quick Add full RTL support + auto-expand for long tasks (✅ DONE 2026-02-27) |
| ~~FEATURE-1201~~ | P2 | ✅ Single-screen welcome modal — research-backed, auth-aware, replaces WelcomeModal |
| ~~FEATURE-1202~~ | P1 | ✅ Google Auth sign-in (OAuth) |
| ~~TASK-1283~~ | P1 | ✅ Google Calendar plugin — show events in Calendar view (depends on FEATURE-1202) |
| ~~**TASK-1284**~~ | **P0** | ✅ **Add quick task creation to KDE Plasma widget (monorepo)** |
| ~~**BUG-1793**~~ | **P2** | ✅ **KDE widget "Today" filter reset on reload (todayOnly not persisted)** |
| ~~**BUG-1794**~~ | **P1** | ✅ **Electron app flickers signed-out then back in on window focus changes** |
| TASK-292 | P3 | Canvas connection edge visuals (animations, gradients) |
| TASK-310 | P2 | Automated SQL backup to cloud storage |
| TASK-293 | P2 | Canvas viewport - center on Today + persist position |
| TASK-313 | P2 | Canvas multi-select batch status change |
| TASK-179 | P2 | Refactor TaskEditModal.vue (~1800 lines) |
| TASK-123 | P2 | Consolidate network status implementations |
| TASK-139 | P3 | Undo state persistence to localStorage |
| TASK-125 | P3 | Remove debug console.log (reduced scope) |
| TASK-065 | P3 | GitHub release (remove hardcoded creds, Docker guide) |
| ~~TASK-079~~ | P3 | ✅ ~~Tauri mobile (Android/iOS)~~ — Archived: Tauri replaced by Electron (TASK-1715). Mobile strategy TBD. |
| TASK-157 | P3 | ADHD-Friendly view redesign (Phases 2-4 pending) |
| TASK-1120 | P2 | 🔄 Deep UX/UI analysis and enhancement of catalog views |
| ~~**FEATURE-1443**~~ | **P0** | ✅ ~~**Morning Dashboard — removed route/auto-redirect (Morning Ritual banner kept)**~~ (✅ DONE 2026-03-18) |
| **TASK-1464** | **P1** | **Break Timer On-Screen Overlay — full-screen pomodoro overlay during break with countdown, minimize/stop/+5min controls, glass morphism** |
| ~~**TASK-1465**~~ | **P2** | ✅ ~~**AI Features Audit — review all AI features, decide what to keep vs ditch (broken/no value)**~~ |
| ~~**TASK-1466**~~ | **P2** | ✅ **Start task without resetting timer — allow switching active task while timer runs (web + pinned), add reset option to KDE widget** |
| ~~**BUG-1462**~~ | **P1** | ✅ **Notification spam — clicking any action (Start Work/Break/+5min) should dismiss ALL notification types** (✅ DONE) |
| ~~**TASK-1469**~~ | **P2** | ✅ **AI Chat anti-spam fix — fix ReAct loop spam, limit tool calls per turn, rewrite system prompt to be concise, add output truncation** |
| **TASK-1470** | **P2** | **Task Assist UX resurface — Ctrl+. shortcut hint, smart inline hint, 28-test AI effectiveness suite** | 👀 REVIEW |
| ~~**BUG-1467**~~ | **P2** | ~~**Tasks auto-appear on calendar at 9:00 AM when dragged to Board date columns — moveTaskToDate created calendar instances instead of only setting dueDate**~~ (✅ DONE 2026-03-07) |
| **TASK-1473** | **P0** | **KDE Widget: Add task search/filter — search box to find tasks without scrolling through long lists** |
| ~~**TASK-1475**~~ | **P1** | ~~**KDE Widget: Nanny popup show recent tasks — show commonly used tasks alongside pinned tasks, not only pinned**~~ (✅ DONE 2026-03-07) |
| **TASK-1476** | **P2** | **Catalog: drag tasks to collapsed project groups — allow dropping on closed categories, remove darkening overlay during drag** |
| ~~**TASK-1478**~~ | **P1** | ~~**KDE Widget: Unify dropdown & overlay styling — replace PlasmaComponents.ComboBox with QQC2 glass morphism popups for Sort/Filter; replace Kirigami.Icon with styled emoji in fullscreen overlay**~~ (✅ DONE 2026-03-07) |
| ~~**BUG-1481**~~ | **P2** | ~~**Calendar inbox hides canvas tasks with non-canvasOrder sorts — isInInbox gate too restrictive**~~ (✅ DONE 2026-03-07) |
| ~~**TASK-1480**~~ | **P2** | ~~**Remove beads dependency — MASTER_PLAN.md as single source of truth, delete .beads/, sync scripts, hooks, update docs**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1483**~~ | **P2** | ~~**PWA Today mode shows overdue tasks mixed with today's tasks without visual separation — add distinct Overdue section**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1492**~~ | **P2** | **✅ Canvas position drift when dragging multiple tasks consecutively — race between lock release, settling state, and realtime echoes** (✅ DONE 2026-03-13) |
| ~~**BUG-1493**~~ | **P2** | ~~**Catalog view: collapsed categories reset on navigation, expand/collapse buttons broken, cross-group drag regression**~~ (✅ DONE 2026-03-09) |
| ~~**TASK-1492**~~ | **P2** | ~~**Fix Due Date kanban view — flat layout (no per-project rows) + dateless tasks route to No Date column**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1503**~~ | **P2** | ~~**Tauri desktop: tasks not updating when adding/deleting on canvas or canvas inbox — WebKitGTK dataTransfer.getData() returns empty, needed dragData singleton fallback**~~ (✅ DONE 2026-03-12) |
| ~~**TASK-1507**~~ | **P2** | ~~**Quick Sort swipe UX polish — center approval notification with fun animation + add "nothing set" reminder popup on accidental swipe**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1518**~~ | **P2** | ✅ **Catalogue view: context menu can't dismiss by clicking away + category drag lag** (✅ DONE 2026-03-13) |
| ~~**BUG-1519**~~ | **P2** | ~~**Date picker calendar blurry — stacked backdrop-filter blur on context menu + submenu + NDatePicker panel**~~ (✅ DONE 2026-03-13) |
| **TASK-1520** | **P2** | **Add recurring indicator badge to task cards (Kanban, Canvas, Table views)** (✅ DONE 2026-03-14) |
| **~~TASK-1525~~** | **P1** | **Recurring task delete dialog — Skip/Stop/Cancel with global recurrence-aware delete** (✅ DONE 2026-03-14) |
| ~~**TASK-1521**~~ | **P1** | **Calendar day/week view drag deferred to mouseup — preview-then-commit pattern, adds undo support** (✅ DONE 2026-03-24) |
| ~~**TASK-1522**~~ | **P2** | ~~**Blank screen on refresh — add loading animation to index.html**~~ (✅ DONE 2026-03-14) |
| **TASK-1523** | **P1** | **Undo/sync race fix — cancel stale sync queue ops when undo/redo restores task create/delete** (✅ DONE 2026-03-14) |
| **~~TASK-1524~~** | **P1** | **Migrate old `recurrence` field to new `recurrenceRule` format on app init** (✅ DONE) |
| **IDEA-1482** | **P3** | **Try CodeGraphContext for codebase graph analysis — Python tool that indexes code into a graph DB for relationship queries (callers/callees/call chains) across 130+ composables. Could help navigate complex canvas/ dependencies. Repo: github.com/CodeGraphContext/CodeGraphContext** |
| ~~**BUG-1526**~~ | **P1** | ~~**Push notification click actions dead — SW posts NAVIGATE_TO_TASK/NAVIGATE_TO/SNOOZE_NOTIFICATION but no client handler existed; added SW message listener in useAppInitialization.ts**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1527**~~ | **P2** | ~~**Remove entire gamification system (XP, achievements, challenges, shop, Cyberflow RPG) — ~23,700 lines removed, DB tables left dormant**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1531**~~ | **P2** | ~~**KDE dock: show current scheduled calendar block next to pomodoro timer — always-visible context of what's planned now, with toggle in KDE widget settings**~~ (✅ DONE) |
| **TASK-1532** | **P1** | **"Done for Now" vs "Done Fully" for recurring tasks — Hybrid clone model: "done for now" creates completion record + advances original to next occurrence; "done fully" stops recurrence (current behavior). DoneToggle click = done-for-now for recurring, context menu offers both options.** (🔄 IN PROGRESS) |
| **FEATURE-1759** | **P1** | **📋 Unified Knowledge + Custom Lists roadmap foundation** |
| **TASK-1760** | **P1** | **📋 Content taxonomy: task, note, list + shared visibility rules** |
| **TASK-1761** | **P1** | **📋 Catalog -> Knowledge Hub MVP with type filters and capture entry** |
| **TASK-1762** | **P1** | **📋 Note/Page MVP using task-based content, markdown, tags, attachments** |
| **TASK-1763** | **P1** | **📋 Custom Lists MVP: lightweight items, groups, reorder, check off** |
| **TASK-1764** | **P2** | **📋 Recurring list templates and reset/reuse workflow** |
| **TASK-1765** | **P1** | **📋 Unified search across tasks, notes, and lists** |
| **TASK-1766** | **P2** | **📋 Promote note or list item into full task flow** |
| **TASK-1767** | **P2** | **📋 AI can read notes/lists and turn them into useful actions** |
| ~~**TASK-1768**~~ | **P2** | ✅ **Persist mini-canvas planning notes for knowledge workflows** (✅ DONE (2026-05-02)) |
| **TASK-1769** | **P3** | **📋 Lightweight links/backlinks between notes and tasks** |
| ~~**TASK-1533**~~ | **P0** | ✅ **Epic: Workspace Collaboration — multi-user workspace layer for FlowState (26 sub-tasks across 4 phases)** (✅ DONE (2026-04-02)) |
| ~~**TASK-1534**~~ | **P0** | **DB migration: Create workspace tables (workspaces, workspace_members, workspace_invites, task_comments, workspace_activity)** (✅ DONE (2026-03-17)) |
| ~~**TASK-1535**~~ | **P0** | **DB migration: Add workspace_id to tasks, projects, groups + assigned_to on tasks** (✅ DONE (2026-03-17)) |
| ~~**TASK-1536**~~ | **P0** | **DB migration: SECURITY DEFINER function user_workspace_ids() for RLS performance** (✅ DONE (2026-03-17)) |
| ~~**TASK-1537**~~ | **P0** | **DB migration: Rewrite 32+ RLS policies to be workspace-aware** (✅ DONE (2026-03-17)) |
| ~~**TASK-1538**~~ | **P0** | **DB migration: Add new tables to supabase_realtime publication** (✅ DONE (2026-03-17)) |
| ~~**TASK-1539**~~ | **P1** | **Pinia store: workspaces.ts — activeWorkspaceId, CRUD, switchWorkspace** (✅ DONE (2026-03-17)) |
| ~~**TASK-1540**~~ | **P1** | **Update supabaseMappers.ts with workspace_id** (✅ DONE (2026-03-17)) |
| ~~**TASK-1541**~~ | **P1** | ✅ **Update useTaskFiltering.ts with workspace filter** (✅ DONE (2026-04-01)) |
| ~~**TASK-1542**~~ | **P1** | **Update taskPersistence.ts + useTasksDatabase.ts for workspace context** (✅ DONE (2026-03-17)) |
| ~~**TASK-1543**~~ | **P1** | **Update projects.ts store for workspace filtering** (✅ DONE (2026-03-17)) |
| ~~**TASK-1544**~~ | **P1** | **Update canvas store (groups) for workspace filtering** (✅ DONE (2026-03-17)) |
| ~~**TASK-1545**~~ | **P1** | **UI: Workspace switcher component in sidebar** (✅ DONE (2026-03-17)) |
| ~~**TASK-1546**~~ | **P1** | **Update auth.ts: fetch workspaces on login** (✅ DONE (2026-03-17)) |
| ~~**TASK-1547**~~ | **P0** | **Offline sync queue: inject workspace_id into queued payloads** (✅ DONE (2026-03-17)) |
| ~~**TASK-1548**~~ | **P0** | **Realtime subscriptions: workspace_id filtering + workspace switch handling** (✅ DONE (2026-03-17)) |
| ~~**TASK-1549**~~ | **P0** | **Cross-tab sync: add workspaceId to protocol** (✅ DONE (2026-03-17)) |
| ~~**TASK-1550**~~ | **P1** | ✅ **Guest mode isolation for workspace feature** (✅ DONE (2026-04-01)) |
| ~~**TASK-1551**~~ | **P1** | **Invite flow: generate link, accept via Edge Function, /#/invite/:token route** (✅ DONE (2026-03-17)) |
| ~~**TASK-1552**~~ | **P1** | ✅ **Task assignment UI: assigned_to dropdown, avatar badges, filters** (✅ DONE (2026-04-01)) |
| ~~**TASK-1553**~~ | **P1** | **Task comments: CRUD + realtime + UI** (✅ DONE (2026-03-31)) |
| ~~**TASK-1554**~~ | **P2** | **Activity feed: logging + display** (✅ DONE (2026-04-01)) |
| ~~**TASK-1555**~~ | **P1** | **Partner-friendly UX: hide complexity for single-workspace users** (✅ DONE (2026-04-01)) |
| ~~**TASK-1556**~~ | **P1** | **Hebrew translations for all workspace strings** (✅ DONE (2026-03-17)) |
| ~~**TASK-1557**~~ | **P2** | ✅ **Member management UI** (✅ DONE (2026-04-02)) |
| ~~**TASK-1558**~~ | **P2** | **Empty states for workspaces** (✅ DONE (2026-04-01)) |
| ~~**TASK-1559**~~ | **P3** | ✅ **Member presence (v2 nice-to-have)** (✅ DONE (2026-04-02)) |

---

## Workspace Collaboration (TASK-1533 Epic)

> **Goal**: Add multi-user workspace collaboration to FlowState. Personal workspace stays as-is (workspace_id IS NULL). Shared workspaces allow 2+ members to share tasks, projects, and canvas.
> **Priority**: P0 | **Status**: 🔄 IN PROGRESS
> **Brief**: User-provided implementation brief covers DB schema, RLS, stores, UI, and phased rollout.
> **Architect Assessment**: Feasibility confirmed with 5 HIGH-risk areas identified (RLS migration, offline sync queue, realtime subscriptions, cross-tab sync, invite chicken-and-egg).

### Phase 1: Foundation

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1533**~~ | **P0** | ✅ **Epic: Workspace Collaboration — tracking parent for all sub-tasks** | ✅ DONE (2026-04-02) | — |
| ~~**TASK-1534**~~ | **P0** | **DB migration: Create workspaces, workspace_members, workspace_invites, task_comments, workspace_activity tables** | ✅ DONE (2026-03-17) | — |
| ~~**TASK-1535**~~ | **P0** | **DB migration: Add workspace_id (NULLABLE) to tasks, projects, groups tables + assigned_to on tasks** | ✅ DONE (2026-03-17) | TASK-1534 |
| ~~**TASK-1536**~~ | **P0** | **DB migration: Create `user_workspace_ids()` SECURITY DEFINER function for RLS performance** | ✅ DONE (2026-03-17) | TASK-1534 |
| ~~**TASK-1537**~~ | **P0** | **DB migration: Rewrite ALL RLS policies to be workspace-aware (32+ policies across 8+ tables). Must handle workspace_id IS NULL for personal tasks. TEST AGAINST PRODUCTION DATA COPY.** | ✅ DONE (2026-03-17) | TASK-1535, TASK-1536 |
| ~~**TASK-1538**~~ | **P0** | **DB migration: Add workspace_id to supabase_realtime publication for task_comments and workspace_activity** | ✅ DONE (2026-03-17) | TASK-1534 |
| ~~**TASK-1539**~~ | **P1** | **Pinia store: Create src/stores/workspaces.ts — activeWorkspaceId, workspaces[], members[], switchWorkspace(), createWorkspace(), inviteMember(), acceptInvite(), removeMember()** | ✅ DONE (2026-03-17) | TASK-1537 |
| ~~**TASK-1540**~~ | **P1** | **Update supabaseMappers.ts: Add workspace_id to toSupabaseTask(), toSupabaseProject(), toSupabaseGroup() mappers** | ✅ DONE (2026-03-17) | TASK-1535 |
| ~~**TASK-1541**~~ | **P1** | ✅ **Update useTaskFiltering.ts: Add workspace_id filter predicate so board/canvas/calendar/inbox respect active workspace** | ✅ DONE (2026-04-01) | TASK-1539, TASK-1540 |
| ~~**TASK-1542**~~ | **P1** | **Update taskPersistence.ts + useTasksDatabase.ts: Pass workspace context to fetchTasks, add .eq('workspace_id', ...) filter** | ✅ DONE (2026-03-17) | TASK-1539, TASK-1540 |
| ~~**TASK-1543**~~ | **P1** | **Update projects.ts store: Filter projects by activeWorkspaceId, same pattern as tasks** | ✅ DONE (2026-03-17) | TASK-1539, TASK-1540 |
| ~~**TASK-1544**~~ | **P1** | **Update canvas store (groups): Filter groups by activeWorkspaceId, validate workspace match on parentId assignment** | ✅ DONE (2026-03-17) | TASK-1539, TASK-1540 |
| ~~**TASK-1545**~~ | **P1** | **UI: Workspace switcher component in sidebar — dropdown with "Personal" + shared workspaces + "Create Workspace" action** | ✅ DONE (2026-03-17) | TASK-1539 |
| ~~**TASK-1546**~~ | **P1** | **Update auth.ts: On login, fetch workspaces via workspace_members join, restore last-used workspace from localStorage** | ✅ DONE (2026-03-17) | TASK-1539 |

### Phase 2: Sync Safety (CRITICAL — must be done before enabling workspaces)

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1547**~~ | **P0** | **Offline sync queue: Inject workspace_id into queued payloads in useSyncOrchestrator.ts. Defense-in-depth for ops created before migration (existing IndexedDB queue entries lack workspace_id)** | ✅ DONE (2026-03-17) | TASK-1540 |
| ~~**TASK-1548**~~ | **P0** | **Realtime subscriptions: Update useRealtimeSubscription.ts to filter by workspace_id instead of user_id. Handle workspace switch (teardown old channel, create new). Add isWorkspaceSwitching flag to prevent reconnect logic from fighting intentional disconnects.** | ✅ DONE (2026-03-17) | TASK-1538, TASK-1539 |
| ~~**TASK-1549**~~ | **P0** | **Cross-tab sync: Add workspaceId to CrossTabMessage and TaskOperation interfaces in useCrossTabSync.ts. Handler must ignore messages from different workspace. Broadcast workspace switch events.** | ✅ DONE (2026-03-17) | TASK-1539 |
| ~~**TASK-1550**~~ | **P1** | ✅ **Guest mode isolation: Ensure workspace store returns empty/disabled state when !isAuthenticated. Verify migrateGuestData() targets personal workspace (NULL workspace_id) only.** | ✅ DONE (2026-04-01) | TASK-1539 |

### Phase 3: Collaboration Features

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1551**~~ | **P1** | **Invite flow: Generate invite link (workspace_invites table), copy/share UI, route /#/invite/:token, accept-invite Edge Function (SECURITY DEFINER — must add user to workspace_members server-side, chicken-and-egg problem)** | ✅ DONE (2026-03-17) | TASK-1539 |
| ~~**TASK-1552**~~ | **P1** | ✅ **Task assignment: Add assigned_to dropdown in task detail showing workspace members, avatar badge on Board/Kanban cards, "My tasks" / "All" / "Unassigned" filter** | ✅ DONE (2026-04-01) | TASK-1539, TASK-1551 |
| ~~**TASK-1553**~~ | **P1** | **Task comments: CRUD for task_comments, real-time via Supabase Realtime, comment thread UI in task detail panel + simplified workspace edit modal** | ✅ DONE (2026-03-31) | TASK-1548 |
| ~~**TASK-1554**~~ | **P2** | **Activity feed: Log writes to workspace_activity (task_created, task_completed, comment_added, member_joined), sidebar panel or view with feed UI** | ✅ DONE (2026-04-01) | TASK-1539 |

### Phase 4: Partner UX & Polish

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1555**~~ | **P1** | **Partner-friendly UX: Hide workspace switcher when user has exactly 1 workspace. Invite-only onboarding path (sign up → land directly in shared workspace). Auto-assign tasks to default workspace for single-workspace users.** | ✅ DONE (2026-04-01) | TASK-1545, TASK-1551 |
| ~~**TASK-1556**~~ | **P1** | **Hebrew translations: Add workspaces namespace to he.json — workspace, members, invite, comments, activity feed, all new UI strings** | ✅ DONE (2026-03-17) | TASK-1545 |
| ~~**TASK-1557**~~ | **P2** | ✅ **Member management UI: Remove member, transfer ownership, role display (owner/admin/member)** | ✅ DONE (2026-04-02) | TASK-1539 |
| ~~**TASK-1558**~~ | **P2** | **Empty states: New workspace welcome, no tasks yet, no members yet, pending invite states** | ✅ DONE (2026-04-01) | TASK-1545 |
| ~~**TASK-1559**~~ | **P3** | ✅ **Member presence: Show who's online in workspace using Supabase Realtime Presence (nice-to-have v2)** | ✅ DONE (2026-04-02) | TASK-1548 |

### Key Architecture Decisions

1. **workspace_id IS NULLABLE** — NULL means "personal workspace". No data migration needed for existing tasks.
2. **SECURITY DEFINER function** `user_workspace_ids()` for RLS performance — caches per-transaction, avoids correlated subquery per row.
3. **Invite acceptance via Edge Function** — accepting user can't INSERT into workspace_members (not yet a member → RLS blocks). Server-side function required.
4. **Realtime per-workspace** — subscribe to active workspace only, teardown/rebuild on switch. No multi-workspace listening.
5. **Sync queue defense-in-depth** — inject workspace_id into payloads at queue processing time for legacy operations that predate the migration.
6. **Timer, gamification, AI chat remain personal** — not workspace-scoped.

### Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS policy rewrite (32+ policies) — wrong policy = data leakage or lockout | CRITICAL | Test against production data copy. Deploy schema-only first, let sync queue drain. |
| Offline sync queue — existing IndexedDB ops lack workspace_id | HIGH | workspace_id NULLABLE + inject at processing time |
| Realtime filter change — breaking for existing subscriptions | HIGH | Workspace switch tears down old channel cleanly |
| Cross-tab workspace mismatch — Tab A workspace A, Tab B workspace B | MEDIUM | Add workspaceId to cross-tab protocol, ignore mismatches |
| Invite chicken-and-egg — user can't join workspace they're not in | MEDIUM | Edge Function with service_role key |
| Canvas parentId cross-workspace — task in workspace B references group in workspace A | LOW | App-level validation in drag handlers |

#### ~~BUG-1793~~: KDE widget "Today" filter reset on reload (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-23) | **Depends On**: —
**Description**: The widget's "Today" toggle (`todayOnly`) was a runtime-only QML property, not backed by `plasmoid.configuration`. It silently reset to `false` on every widget reload / plasmashell restart, so the list showed ALL non-done tasks (~59) instead of just tasks due today — appearing as a "completely different set" than the Electron app. The filter *logic* (`filterTasksForToday`/`taskMatchesToday`) was already correct and matches the app's `useSmartViews.isTodayTask` (verified against live production data: shows exactly the due-today tasks, overdue excluded by design).
**Fix**: Added persisted `todayOnly` Bool key to `contents/config/main.xml`; initialize `property bool todayOnly: plasmoid.configuration.todayOnly` and write back on toggle in `main.qml`. Bumped widget `metadata.json` 1.1.0→1.1.1. Verified live via journal: Today-on fetch uses `limit=1000` + client filter and loads only the due-today count; choice now survives restarts.

---

#### ~~BUG-1794~~: Electron app flickers signed-out then back in on window focus changes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-23) | **Depends On**: —
**Description**: On the Electron desktop app, the UI intermittently flashed the login screen and then re-signed-in a few seconds later — a transient flicker, not a real logout. Root cause: `useRealtimeSubscription.ts` called `auth.refreshSession()` *unconditionally* on every `visibilitychange → visible` (BUG-1182). Electron fires focus/visibility changes far more often than a browser tab (window focus/blur/occlusion, OS notifications), so this redundant refresh ran on top of Supabase `autoRefreshToken` + the scheduled refresh in `auth.ts`. The resulting auth-event churn produced spurious `SIGNED_OUT` events, and the UI reads `isAuthenticated = !!user.value` with no debounce, so it flashed logged-out until the next refresh recovered the session.
**Fix**: (A) Expiry-gate the wake-up refresh in `src/composables/supabase/useRealtimeSubscription.ts` — only `refreshSession()` when a real session is missing-expiry or within 120s of expiry; `autoRefreshToken` covers the rest. (B) Defense-in-depth in `src/stores/auth.ts`: a non-explicit `SIGNED_OUT` with no recoverable session now defers clearing `user`/`session` behind a 2s grace timer; a valid session re-appearing (SIGNED_IN/TOKEN_REFRESHED) cancels it, so no login-screen flash. Explicit user sign-out (`isSigningOut`) still clears immediately. Tests: `tests/unit/stores/auth-flow.test.ts` updated (#24 grace-period clear) + new #24b (transient SIGNED_OUT→SIGNED_IN stays signed in); 30/30 pass.

---

#### ~~TASK-1533~~: Epic: Workspace Collaboration — Tracking Parent (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-04-02) | **Depends On**: —
**Description**: Epic tracking parent for all workspace collaboration sub-tasks (TASK-1534 through TASK-1559). No implementation work — exists to group and track the full collaboration milestone.

---

#### ~~TASK-1534~~: DB Migration — Core Workspace Tables (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: —
**Description**: Create `workspaces`, `workspace_members`, `workspace_invites`, `task_comments`, and `workspace_activity` tables via Supabase migration. These tables form the foundational schema for all collaboration features.

---

#### ~~TASK-1535~~: DB Migration — Add workspace_id to Existing Tables (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1534
**Description**: Add `workspace_id` (NULLABLE) column to `tasks`, `projects`, and `groups` tables, plus `assigned_to` column on `tasks`. NULL workspace_id means "personal workspace" — no data migration needed for existing rows.

---

#### ~~TASK-1536~~: DB Migration — user_workspace_ids() SECURITY DEFINER Function (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1534
**Description**: Create `user_workspace_ids()` SECURITY DEFINER function for RLS performance. Caches per-transaction to avoid correlated subquery per row when evaluating workspace-aware RLS policies.

---

#### ~~TASK-1537~~: DB Migration — Rewrite All RLS Policies (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1535, TASK-1536
**Description**: Rewrite ALL RLS policies to be workspace-aware (32+ policies across 8+ tables). Must handle `workspace_id IS NULL` for personal tasks. TEST AGAINST PRODUCTION DATA COPY before applying. This is the highest-risk migration in the epic.

---

#### ~~TASK-1538~~: DB Migration — Realtime Publication for Workspace Tables (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1534
**Description**: Add `workspace_id` filter to supabase_realtime publication for `task_comments` and `workspace_activity` tables so realtime events are scoped per workspace.

---

#### ~~TASK-1539~~: Pinia Store — workspaces.ts (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1537
**Description**: Create `src/stores/workspaces.ts` with `activeWorkspaceId`, `workspaces[]`, `members[]`, and actions: `switchWorkspace()`, `createWorkspace()`, `inviteMember()`, `acceptInvite()`, `removeMember()`. Central source of truth for workspace context across all stores.

---

#### ~~TASK-1540~~: Update supabaseMappers.ts for workspace_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1535
**Description**: Add `workspace_id` to `toSupabaseTask()`, `toSupabaseProject()`, and `toSupabaseGroup()` mapper functions in `supabaseMappers.ts` so all write operations include workspace context.

---

#### ~~TASK-1541~~: Update useTaskFiltering.ts for workspace_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539, TASK-1540
**Description**: Add `workspace_id` filter predicate to `useTaskFiltering.ts` so board, canvas, calendar, and inbox views all respect the active workspace and only show tasks belonging to it.

---

#### ~~TASK-1542~~: Update taskPersistence.ts + useTasksDatabase.ts for workspace context (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539, TASK-1540
**Description**: Pass workspace context to `fetchTasks` and add `.eq('workspace_id', ...)` filter in `taskPersistence.ts` and `useTasksDatabase.ts` so database reads are scoped to the active workspace.

---

#### ~~TASK-1543~~: Update projects.ts Store for workspace filtering (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539, TASK-1540
**Description**: Filter projects by `activeWorkspaceId` in `projects.ts` store, following the same pattern applied to tasks in TASK-1541/1542.

---

#### ~~TASK-1544~~: Update Canvas Store (groups) for workspace filtering (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539, TASK-1540
**Description**: Filter canvas groups by `activeWorkspaceId` in the canvas store. Validate workspace match on `parentId` assignment in drag handlers to prevent cross-workspace canvas group references.

---

#### ~~TASK-1545~~: UI — Workspace Switcher Component (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: Build workspace switcher component in the sidebar — dropdown listing "Personal" plus shared workspaces, with a "Create Workspace" action at the bottom. Hides automatically when user has exactly 1 workspace (see TASK-1555).

---

#### ~~TASK-1546~~: Update auth.ts — Fetch Workspaces on Login (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: On login, fetch workspaces via `workspace_members` join and restore last-used workspace from `localStorage` in `auth.ts`. Ensures workspace context is available immediately after authentication.

---

#### ~~TASK-1547~~: Offline Sync Queue — Inject workspace_id into Payloads (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1540
**Description**: Inject `workspace_id` into queued payloads in `useSyncOrchestrator.ts`. Defense-in-depth for ops created before the migration — existing IndexedDB queue entries lack `workspace_id` and must be patched at processing time.

---

#### ~~TASK-1548~~: Realtime Subscriptions — Filter by workspace_id (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1538, TASK-1539
**Description**: Update `useRealtimeSubscription.ts` to filter by `workspace_id` instead of `user_id`. Handle workspace switch by tearing down the old channel and creating a new one. Add `isWorkspaceSwitching` flag to prevent reconnect logic from fighting intentional disconnects.

---

#### ~~TASK-1549~~: Cross-Tab Sync — Add workspaceId to Message Protocol (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: Add `workspaceId` to `CrossTabMessage` and `TaskOperation` interfaces in `useCrossTabSync.ts`. Handlers must ignore messages from a different workspace. Broadcast workspace switch events so all tabs stay in sync.

---

#### ~~TASK-1550~~: Guest Mode Isolation (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539
**Description**: Ensure workspace store returns empty/disabled state when `!isAuthenticated`. Verify `migrateGuestData()` targets personal workspace (`NULL workspace_id`) only so guest data never bleeds into shared workspaces.

---

#### ~~TASK-1551~~: Invite Flow — Link Generation, Route, Edge Function (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: Generate invite links via the `workspace_invites` table, copy/share UI, route `/#/invite/:token`, and an accept-invite Edge Function with `SECURITY DEFINER` (required because accepting user can't INSERT into `workspace_members` until they're already a member — RLS chicken-and-egg).

---

#### ~~TASK-1552~~: Task Assignment — assigned_to Dropdown + Board Badges (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539, TASK-1551
**Description**: Add `assigned_to` dropdown in task detail showing workspace members, avatar badge on Board/Kanban cards, and "My tasks" / "All" / "Unassigned" filter options.

---

#### ~~TASK-1553~~: Task Comments — CRUD + Realtime Thread UI + Workspace Edit Modal (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-31) | **Depends On**: TASK-1548
**Description**: Full CRUD for `task_comments` with real-time updates via Supabase Realtime. Comment thread UI inside the task detail panel. Simplified workspace edit modal with collaboration bar (assignee, status, due date pills), workspace context strip, "More options" disclosure, and permission gating.

- [x] `src/types/workspace.ts` — `TaskComment` interface appended
- [x] `src/composables/supabase/useTaskComments.ts` — composable with fetchComments, addComment, updateComment, deleteComment, subscribeToComments
- [x] `src/components/tasks/edit/TaskComments.vue` — comment thread with realtime, optimistic CRUD, initials avatars, hover edit/delete
- [x] Simplified workspace edit modal (5-zone layout, collab bar, "More options" disclosure)
- [x] Workspace switch redirects from Canvas to Catalog
- [x] Production DB columns fixed (`is_deleted`, `reply_to_comment_id`)
- [x] E2E tests for workspace and personal task flows

---

#### ~~TASK-1554~~: Activity Feed — workspace_activity Log + UI (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539
**Description**: Log writes to `workspace_activity` for events: `task_created`, `task_completed`, `comment_added`, `member_joined`. Sidebar panel or dedicated view with activity feed UI showing recent workspace events.

---

#### ~~TASK-1555~~: Partner-Friendly UX Polish (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1545, TASK-1551
**Description**: Hide workspace switcher when user has exactly 1 workspace. Invite-only onboarding path (sign up → land directly in shared workspace). Auto-assign tasks to default workspace for single-workspace users.

---

#### ~~TASK-1556~~: Hebrew Translations for Workspace Features (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1545
**Description**: Add `workspaces` namespace to `he.json` covering all new UI strings: workspace, members, invite, comments, activity feed, and all related actions and states.

---

#### ~~TASK-1557~~: Member Management UI (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539
**Description**: Member management UI with remove member, transfer ownership, and role display (owner / admin / member) actions accessible from workspace settings.

---

#### ~~TASK-1558~~: Empty States for Workspace Flows (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1545
**Description**: New workspace welcome screen, "no tasks yet", "no members yet", and pending invite states — covering all empty-state scenarios introduced by the workspace collaboration feature.

---

#### ~~TASK-1559~~: Member Presence via Supabase Realtime Presence (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-02) | **Depends On**: TASK-1548
**Description**: Show who's online in a workspace using Supabase Realtime Presence API. Implemented via separate Realtime channel (`presence:{workspaceId}`), tracks active/idle tab state via visibilitychange API. Online indicators shown on AssigneeAvatar (green/amber dot) and in WorkspaceSettingsTab member list.

---

## System Review 2026-01-31 Findings

> **Source**: Comprehensive system review with 4 parallel agents (Security, Code Quality, Architecture, Health Check)
> **Validated**: npm test (587 passed), npm audit (16 vulnerabilities), npm outdated, npm run lint (349 errors)
> **Total Issues**: 48 (P0: 2, P1: 14, P2: 19, P3: 13)

---

### ~~BUG-1136~~: Add Entity Ownership Check to Tombstone RLS (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-04)

**Problem**: Tombstone soft-delete RLS policy was missing UPDATE policy — upsert with onConflict silently failed for authenticated users.

**Solution**: Added UPDATE RLS policy with `auth.uid() = user_id` check. Migration: `20260304000000_tombstone_rls_update_policy.sql`. Applied to local + production.

**Files**: `supabase/migrations/20260304000000_tombstone_rls_update_policy.sql`

---

### ~~BUG-1137~~: Add Guest Session ID for Migration (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-07)

**Problem**: When guest user signs up, their guest data may leak or not migrate properly.

**Solution**: Generate and store unique guest session ID, use it to migrate guest data on sign-up.

**Files**: `src/stores/auth.ts:361`

---

### ~~BUG-1141~~: Add CSP Headers to Limit XSS Impact (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-04)

**Problem**: No Content Security Policy headers configured on production web app.

**Solution**: Added enforcing CSP header to VPS Caddyfile. Policy: `default-src 'self'`, SHA-256 hash for FOUC inline script, `'unsafe-inline'` for Vue scoped styles, explicit allowlist for Google Fonts, Dicebear avatars, Supabase API/WebSocket. Tauri CSP was already configured. `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` for XSS mitigation.

**Files**: `/etc/caddy/Caddyfile` (VPS), `src-tauri/tauri.conf.json` (already had CSP)

---

### ~~BUG-1142~~: Add Rate Limiting to API Calls (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-04)

**Problem**: No rate limiting on API endpoints, vulnerable to abuse. Edge functions (whisper-transcribe, url-scraper-proxy) had no auth check.

**Solution**: (1) Enabled Kong `rate-limiting` plugin on VPS: auth 20/min, REST 300/min. (2) Added `validateSupabaseAuth()` to `whisper-transcribe` and `url-scraper-proxy` edge functions. (3) Added auth token headers to client-side callers (urlScraper.ts, useWhisperSpeech.ts, useMobileInboxLogic.ts).

**Files**: `docker/self-host/volumes/api/kong.yml`, `supabase/functions/whisper-transcribe/index.ts`, `supabase/functions/url-scraper-proxy/index.ts`, `src/services/ai/urlScraper.ts`, `src/composables/useWhisperSpeech.ts`, `src/mobile/composables/useMobileInboxLogic.ts`

---

### ~~BUG-1143~~: Add onUnmounted Cleanup to MobileQuickSortView (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: Memory leak - MobileQuickSortView creates setTimeout timers but never cleans them up on unmount.

**Root Cause**: `handleSave()` and `handleMarkDone()` both create `setTimeout` for celebration overlay (600ms) without tracking or clearing on unmount. If component unmounts before timeout fires, stale refs are set.

**Fix**:
1. Added `celebrationTimers` array to track all setTimeout IDs
2. Updated `handleSave()` and `handleMarkDone()` to push timer IDs to tracking array
3. Added `onUnmounted()` hook to clear all pending timers

**Note**: `useSwipeGestures` and `useQuickSort` composables already have their own `onUnmounted` cleanup — no additional cleanup needed for those.

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### ~~BUG-1406~~: Mobile Quick Sort — Bottom Controls Cut Off + Missing Project Assignment (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: On mobile Quick Sort view, the bottom thumb zone (action buttons: Done/Save/Assign/Delete) is clipped by the bottom navigation bar. The date pill row is also truncated (only Today/Tmrw/+3d visible, missing Wknd/+1wk/+1mo). No visible way to assign projects from the sort phase.

**Root Cause**: The `MobileQuickSortFilters.vue` thumb zone padding-bottom didn't account for the 64px mobile bottom nav bar. The sort phase had `overflow: hidden` preventing scroll to bottom controls.

**Fix**:
1. ✅ Added `var(--space-16)` (64px nav) + `var(--space-6)` + `env(safe-area-inset-bottom)` to thumb zone padding-bottom
2. ✅ Changed sort phase from `overflow: hidden` to `overflow-y: auto` so all controls are reachable
3. ✅ Verified Assign button visible and wired to project sheet via `openProjectSheet`
4. ✅ Fixed thumb zone gradient (`linear-gradient` → `transparent`)
5. ✅ Fixed AI "Apply All" to set values locally without persisting — user reviews then hits Save

---

### ~~TASK-1144~~: Split MobileQuickSortView.vue (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: File is 2518 lines, exceeding 500-line limit. Hard to maintain and test.

**Solution**: Extract into composables and sub-components:
- `useMobileQuickSortLogic.ts` - business logic
- `MobileQuickSortCard.vue` - card component
- `MobileQuickSortFilters.vue` - filter UI

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### ~~TASK-1145~~: Split MobileInboxView.vue (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: File is 1919 lines, exceeding 500-line limit.

**Solution**: Extract into composables and sub-components.

**Files**: `src/mobile/views/MobileInboxView.vue`

---

### ~~TASK-1146~~: Split useSupabaseDatabase.ts by Domain (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-22)

**Problem**: File was 1736 lines with mixed concerns.

**Solution**: Split into 10 domain composables under `src/composables/supabase/` + shared infrastructure. Original file is now a 3-line re-export.

**Files**: `src/composables/supabase/` (13 files)

---

### ~~TASK-1147~~: Replace 199 `any` Types with Proper Interfaces (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-27)

**Problem**: 199 instances of `any` type across 90 files weaken type safety.

**Solution**: Audited and replaced all remaining `any` types with proper TypeScript interfaces. Key changes:
- Added `isVirtual?: boolean` to `CalendarEvent` interface, eliminating 31 `as any` casts across 3 calendar views
- Replaced markdown-it `any` params with `Token`, `Renderer`, `MarkdownIt.Options` types in ChatMessage.vue
- Added `TaskListItem`, `CalendarHelpers`, `WeekDay` type definitions to replace unsafe casts
- Changed `Record<*, any>` icon maps to `Record<*, Component>` in gamification/mobile files
- Fixed `ComputedRef<any[]>` in undoSingleton.ts with proper `UseRefHistoryRecord` type
- Fixed `Ref<any[]>` in useCanvasInteractions.ts with proper `Node[]` type

**Files**: src/types/tasks.ts, src/components/ai/ChatMessage.vue, src/components/calendar/Calendar{Day,Month,Week}View.vue, src/composables/undoSingleton.ts, src/composables/canvas/useCanvasInteractions.ts, src/components/gamification/cyber/CyberShop.vue, src/components/gamification/cyber/CyberAchievements.vue, src/components/gamification/ShopModal.vue, src/mobile/components/MobileInboxFilters.vue

---

### ~~TASK-1149~~: Split timer.ts into 4 Services (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: Timer store was 1328 lines with mixed concerns.

**Solution**: Split into focused services:
- `src/stores/timer.ts` — slim orchestrator (456 lines)
- `src/composables/timer/useTimerSync.ts` — intervals, leadership, DB, Realtime (763 lines)
- `src/composables/timer/useTimerNotifications.ts` — browser/SW notifications (163 lines)
- `src/composables/timer/useTimerAudio.ts` — sound playback (86 lines)

Public API unchanged — zero consumer migration needed.

**Files**: `src/stores/timer.ts`

---

### ~~TASK-1152~~: Fix 40 eslint-disable/@ts-ignore Suppressions (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: 40 eslint-disable and @ts-ignore comments indicate tech debt.

**Solution**: Audit each suppression and fix underlying issues.

**Files**: 17 files with suppressions

---

### ~~TASK-1154~~: Standardize Error Handling Pattern (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: Inconsistent error handling - some functions throw, others return null.

**Solution**: Standardized DB layer: write ops re-throw after `handleError()`, read ops return empty/null. Fixed 4 files: `permanentlyDeleteGroup/Project` now re-throw, `fetchUserSettings` uses structured `handleError`, AI sync fire-and-forget calls now have `.catch()` handlers.

**Files**: `src/composables/supabase/useGroupsDatabase.ts`, `useProjectsDatabase.ts`, `useSettingsDatabase.ts`, `src/composables/useAISync.ts`

---

### ~~TASK-1155~~: Split AppSidebar.vue (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-04)

**Problem**: File was 1974 lines, exceeding 500-line limit.

**Solution**: Extracted 6 sub-components + 1 composable. AppSidebar.vue reduced to 104-line shell.

**Files**: `src/layouts/AppSidebar.vue`, `src/components/sidebar/` (6 files), `src/composables/app/useQuickTaskInput.ts`

---

### ~~TASK-1156~~: Split useBackupSystem.ts (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: File was 1412 lines, exceeding 500-line limit.

**Solution**: Split into 8 modular sub-composables under `src/composables/backup/` using Context + Factory pattern. Old import path preserved as re-export barrel. 22/22 tests pass.

**Files**: `src/composables/backup/` (8 files), `src/composables/useBackupSystem.ts` (barrel)

---

### ~~TASK-1157~~: Extract Magic Numbers to Named Constants (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-13)

**Problem**: Magic numbers scattered throughout code.

**Solution**: Create `src/constants/` directory with named constants.

**Files**: Multiple files

**Resolution**: Extracted ~40 magic numbers across 17 files into named constants. Created `src/constants/calendar.ts` (slot height, snap minutes), `src/constants/breakpoints.ts` (mobile breakpoint). Extended `src/config/timing.ts` (flash, toast, startup delays) and `src/constants/canvas.ts` (navigation animation). Fixed stale raw `30000` in timer.ts. Zero logic changes.

---

### ~~TASK-1160~~: Add Virtualized Task Lists (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: Rendering 500+ tasks causes performance issues.

**Solution**: Implement `@tanstack/vue-virtual` for Board and Calendar views.

**Files**: Board view, Calendar view components

---

### TASK-1161: Create Shared Domain Layer for Mobile (📋 PLANNED)

**Priority**: P4 | **Status**: 📋 PLANNED

**Problem**: Mobile views duplicate logic from desktop views.

**Solution**: Create `src/domain/` with shared composables.

**Files**: `src/domain/` (new), mobile views

---

### ~~FEATURE-1162~~: Smart Filters / Saved Views (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Feature**: Allow users to save filter combinations as named views.

**Implementation**:
1. ~~Create `saved_filters` Supabase table~~ → Stored in settings JSONB (syncs via existing pipeline)
2. ✅ SavedViewsDropdown component with glass-morphism design
3. ✅ Quick access bookmark dropdown in FilterControls + InboxFilters
4. ✅ Composable `useSavedViews.ts` for capture/apply/save/delete
5. ✅ Persists via localStorage + Tauri Store + Supabase user_settings

**Files**: `src/types/savedViews.ts`, `src/composables/useSavedViews.ts`, `src/components/filters/SavedViewsDropdown.vue`, `src/stores/settings.ts`, `src/components/base/FilterControls.vue`, `src/components/canvas/InboxFilters.vue`

---

### FEATURE-1164: Habit Tracking Mode (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: Extend recurring tasks to support habit tracking with streaks and statistics.

**Files**: Task types, new views

---

### FEATURE-1166: Create Public API (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: REST API for external integrations (Zapier, IFTTT, custom scripts).

**Files**: New Edge Functions, API documentation

---

### ~~TASK-1169~~: Add Unit Tests for Database Layer (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: No dedicated tests for database composable.

**Solution**: Add tests with mocked Supabase client.

**Files**: `tests/unit/composables/useSupabaseDatabase.spec.ts`

---

### TASK-1171: Add Mobile View E2E Tests (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS

**Problem**: Mobile views have E2E test coverage gaps.

**Solution**: Add Playwright tests for mobile viewport.

**Files**: `tests/e2e/mobile/`

---

### ~~TASK-1172~~: Update VueUse 10.11 → 14.1 (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE

**Problem**: VueUse is 4 major versions behind.

**Prerequisites**: Requires Vue 3.5+ upgrade first.

**Files**: `package.json`

**Resolution**: Already upgraded to @vueuse/core@14.2.1 with Vue 3.5.26. No action needed.

---

### ~~TASK-1175~~: Fix 349 Linter Errors (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-14)

**Problem**: 349 ESLint errors and 292 warnings.

**Solution**: Run `npm run lint --fix` and manually fix remaining issues.

**Files**: Multiple files

**Resolution**: Reduced from 349 errors to 12 (all intentionally skipped). Fixed: unused vars/imports (29), extra semicolons, useless v-binds, boolean shorthand, define-macros-order, max-attributes-per-line. Remaining 12: 11 `vue/custom-event-name-casing` (kebab-case events can't be renamed without breaking parents) + 1 `no-unsafe-finally` (logic issue, not lint fix).

---

### System Review Summary

**Metrics**:
- Tests: 587 passed, 28 todo (615 total)
- Linter: 349 errors, 292 warnings
- npm audit: 16 vulnerabilities (0 critical, 2 high)
- Codebase: 585 files, 136,067 lines of code


---


## Roadmaps

### ROAD-004: Mobile PWA (✅ DONE)

**Status**: ✅ DONE (2026-01-19) - All phases complete.

See archive for TASK-324, TASK-325, TASK-326 details.

---

### ROAD-013: Sync Hardening (✅ DONE)

**Status**: ✅ DONE (2026-01-14)

Implemented "Triple Shield" Drag/Resize Locks. Multi-device E2E moved to TASK-285.

---

### ~~ROAD-010~~: Gamification - "Cyberflow" (✅ DONE — Obsolete)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE — Obsolete (2026-01-30)

**Archived**: Gamification removed in TASK-1527

**Parent Feature**: FEATURE-1118

**Sub-Features**:
- FEATURE-1132: AI Game Master Challenge System (🔄 IN PROGRESS)
  - Database migration: `user_challenges`, `challenge_history` tables
  - Types: `src/types/challenges.ts`
  - Store: `src/stores/challenges.ts`
  - AI Game Master: `src/services/ai/gamemaster.ts`, `challengeTemplates.ts`
  - UI: CorruptionOverlay, ChallengeCard, DailyChallengesPanel, BossFightPanel
  - Integration: `useGamificationHooks.ts` tracks challenge progress
  - Skill: `.claude/skills/cyberflow-rpg/SKILL.md`
- [ ] **TASK-1242**: Corruption-influenced AI personality — glitchy tone at high corruption levels (moved from Phase 4)

**Blocking**: BUG-1204 - Apply migration to database (table returns 404)

---

### ~~TASK-1317~~: Cyberflow RPG — Full Cyberpunk Game UI Overhaul (✅ DONE — Obsolete)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE — Obsolete (2026-02-07)

**Archived**: Gamification removed in TASK-1527

**Parent**: FEATURE-1118

**Goal**: Complete cyberpunk visual overhaul of the gamification system with dedicated Cyberflow command center, Anti-Chore game design, and system interconnections.

**Phase 1: Visual Foundation** ✅
- Installed augmented-ui, added cyberpunk fonts (Rajdhani, Orbitron, Space Mono)
- Created `src/assets/cyberflow-tokens.css` (neon palette, glow effects, clip-paths, animations)
- Created `src/composables/useCyberflowTheme.ts` (intensity-aware theme composable)

**Phase 2: Cyberflow Hub Page** ✅
- New `/cyberflow` route with 5-tab navigation (Overview/Missions/Boss/Upgrades/Trophies)
- Created 12 new cyber components (CyberDashboardHub, CyberMissionBriefing, CyberBossFight, CyberCharacterProfile, CyberSkillTree, CyberAchievements, CyberShop, etc.)
- Hub-and-spoke layout: Overview cards → drill into tabs

**Phase 3: Header Widget Redesign + Intensity Levels** ✅
- Restyled LevelBadge, XpBar, StreakCounter with cyberpunk aesthetics
- Intensity filtering wired up (minimal/moderate/intense)
- Exposure toast system (shielded/exposed) with proper icon rendering

**Phase P0: Anti-Chore Game Mechanics** ✅
- Created `docs/game-mechanics.md` — authoritative game design reference
- Removed exposed penalty (timer = invitation, not obligation)
- Removed XP decay (earned XP permanent forever)
- Updated SHIELDED_XP_BONUS from 1.10 to 1.15
- Suppressed nagging "EXPOSED" toast per Distraction Test

**Progress (2026-02-08):** Phases 1-3 complete + P0 anti-chore constants applied. 624 tests passing, zero TS errors. Next: P1 items (streak multiplier, corruption XP modifier, partial boss credit).

**Phase 4: RPG HUD Header Redesign** (TASK-1305, 🔄 IN PROGRESS)
- Created `GamificationHUD.vue` — single RPG-styled component replacing inline header widgets
- 4 visual states: unauth CTA ("CONNECT TO THE GRID"), minimal (text only), moderate (full bar), intense (glow + shine + narrative)
- Uses cyberflow design tokens: corner-cut-sm clip-path, cf-dark-3 bg, cf-cyan border/glow, Space Mono typography
- Backdrop blur via `::before` pseudo-element (clip-path + backdrop-filter incompatibility fix)
- Refactored AppHeader.vue: removed ~80 lines of inline widgets, replaced with `<GamificationHUD />`
- Added challenge pick animation to DailyChallengesPanel (glow + collapse + auto-navigate)
- Fixed kill-flow-state.sh hanging on zombie PIDs (added timeout to pwdx)
- Fixed missing verify-auth script reference in package.json dev script

**Progress (2026-02-12):** Phase 4 HUD implemented. Challenge pick animations working. User testing in progress — multiplier and penalty visualization discussed but not yet implemented.

---

### ~~BUG-1302~~: Time Block Notifications Still Not Firing (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: Despite BUG-1296 fix (`_rawTasks` → `rawTasks`), time block notifications are still not firing. User has a 120-min calendar block scheduled and received no milestone alerts (halfway, 1-min-before, ended).

**Root Causes Found** (multi-agent investigation):
1. **Late tolerance too tight** (2 min) — desktop apps sleep/background, `setInterval` skips ticks, milestones silently missed
2. **Singleton guard fragile** — module-level `isInitialized` survives but interval could die, `start()` refuses to restart
3. **Silent notification delivery** — `deliverNotification()` had no error handling, no logging, failed invisibly
4. **Missing permission request** — Timer store requests Notification permission at init, but time blocks didn't
5. **Instance data not in sync queue** — `createTaskInstance` was fire-and-forget, instances not backed up by sync queue
6. **Toast too short** — 5s duration easy to miss

**Fixes Applied** (4 files):
1. `useTimeBlockNotifications.ts` — Late tolerance 2min→10min, resilient singleton (restarts if interval died), delivery logging, toast duration 5s→8s, skip completed/soft-deleted tasks
2. `notificationDelivery.ts` — Added try-catch, logging on permission denied/API unavailable/delivery success, returns boolean
3. `useAppInitialization.ts` — Explicit `Notification.requestPermission()` before starting time block polling
4. `taskOperations.ts` — Added `instances` to sync queue payload for offline backup

**Files**:
- `src/composables/useTimeBlockNotifications.ts` — Core composable (polling, milestone detection, delivery)
- `src/utils/notificationDelivery.ts` — Browser Notification API wrapper
- `src/composables/app/useAppInitialization.ts` — Where composable is mounted
- `src/stores/tasks/taskOperations.ts` — Sync queue payload for instance persistence

---

### ~~BUG-1307~~: Week View Events Render as Thin Slivers on Thu-Sun Columns (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: In the calendar week view, events on Monday and Tuesday render correctly with proper width, title, time, and duration. However, events on Thursday through Sunday appear as nearly invisible thin vertical lines/slivers instead of proper event blocks.

**Root Cause**: CSS `.week-event { left: var(--space-1); right: var(--space-1); }` overrode the JS-computed percentage-based `left`/`width` from `getWeekEventStyle()`. The fixed CSS values clamped all events to the same position regardless of day column.

**Fix Applied**:
- [x] Removed CSS `left`/`right` overrides from `.week-event` in `CalendarWeekView.vue`
- [x] Added 2px inset padding via `calc()` in `getWeekEventStyle()` for column gap

**Files Changed**:
- `src/components/calendar/CalendarWeekView.vue` — Removed conflicting CSS left/right
- `src/composables/calendar/useCalendarWeekView.ts` — `calc()` padding in left/width

---

### ~~BUG-1308~~: Month View Shows Only 2 Columns Instead of 7 (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: The calendar month view grid was missing day-of-week header row (MON-SUN).

**Root Cause**: Template had no weekday header component. CSS grid was correct (`repeat(7, 1fr)`) and 42 cells were generated correctly, but without header labels the layout appeared broken.

**Fix Applied**:
- [x] Added `month-weekday-header` row with Mon-Sun labels above the grid
- [x] Added CSS for header grid matching 7-column layout

**Files Changed**:
- `src/components/calendar/CalendarMonthView.vue` — Added weekday header row + CSS

---

### ~~FEATURE-1118~~: Gamification System - Design & Implementation (✅ DONE — Obsolete)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE — Obsolete (2026-01-30)

**Archived**: Gamification removed in TASK-1527

**Goal**: Add game-like elements to FlowState to increase engagement and make productivity feel rewarding.

**Design**: See `docs/game-mechanics.md` for full game design document (Anti-Chore Manifesto, system interconnections, ARIA personality, progression curve).

---

### ROAD-011: AI Assistant (⏸️ PAUSED)

**Priority**: P3 | Task breakdown, auto-categorization, NL input. Stack: Ollama + Claude/GPT-4.

---

### ROAD-025: Backup Containerization (📋 PLANNED)

**Priority**: P3 | Move `auto-backup-daemon.cjs` into Docker container for VPS distribution.

---

### TASK-1471: Docker Self-Host E2E Test (🔄 IN PROGRESS)

**Priority**: P3 | **Status**: 🔄 IN PROGRESS

**Goal**: Verify a fresh self-hosted installation works end-to-end before sharing repo publicly.

**Bugs found & fixed (committed)**:
- [x] Kong `rate-limiting` plugin not declared in `KONG_PLUGINS` — added
- [x] `init-db.sh` had wrong filename (`fix_id_types.sql` → `20260106000000_fix_id_types.sql`) and was missing 12 of 24 migrations — fixed
- [x] `.env.self-host` / `.env.self-host.test` not gitignored — added
- [x] `supabase/postgres:17.2.0` image tag doesn't exist — updated to `17.6.1.095`
- [x] Created `scripts/test-self-host.sh` with 6 E2E tests + `--keep` flag for browser testing

**Remaining**:
- [ ] Run `./scripts/test-self-host.sh --keep` — builds full Docker stack and runs 6 E2E tests
- [ ] Once tests pass, verify in browser at `http://localhost:13050`
- [ ] To tear down: `docker compose -p flowstate-test -f docker-compose.self-host.yml --env-file .env.self-host.test down -v`

**Files**: `.gitignore`, `docker-compose.self-host.yml`, `docker/self-host/init-db.sh`, `scripts/test-self-host.sh`

---

## Task Dependency Index (PWA Prerequisites) - ✅ ALL COMPLETE

All blocking tasks (TASK-118, 119, 120, 121, 122) completed. See archive for details.

---

## Architecture Constraints

- **Geometry write policy**: Only drag handlers + explicit move actions may change `parentId`, `canvasPosition`, `parentGroupId`, `position`
- **Sync is read-only**: `syncStoreToCanvas` does NOT write to stores
- **Smart Groups metadata-only**: May update `dueDate`/`status`/`priority`, never geometry

---

### ~~TASK-1440~~: Gamification Offline Resilience (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-03)

**Problem**: Gamification store writes directly to Supabase. When offline, XP awards, streak updates, stat increments, achievement unlocks, and purchases silently fail — causing data loss for gamification state.

**Strategy**: Local-first state updates — update Pinia state BEFORE Supabase writes. Wrap all Supabase writes in try/catch with `console.warn`. On failure, local state stays updated; server reconciles on next load.

**Changes** (`src/stores/gamification.ts`):
- `awardXp`: Local XP/level update first, notifications fire immediately, Supabase write in try/catch, reconcile from server on success
- `recordDailyActivity`: Local streak update first (streak loss is critical UX), Supabase write in try/catch + warn on failure; streak freeze deduction also local-first via fire-and-forget
- `incrementStat`: Local stat update first, Supabase write in try/catch
- `unlockAchievement`: Local achievement unlock first + toast shows immediately, Supabase upsert in try/catch
- `purchaseItem`: Local XP deduction + item ownership first, all Supabase writes in try/catch with warn (purchase still succeeds locally)

**Marker**: All wrapped calls tagged with `[OFFLINE-SAFE]` comment for traceability.

**Files**: `src/stores/gamification.ts`

---

### ~~TASK-1463~~: Clean Up Project Root — Remove/Consolidate Temp Files (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-07)

**Problem**: Project root has 141 debug PNG screenshots, tracked temp reports/scripts, stale lockfiles, and other clutter that doesn't belong at the root level.

**Cleanup plan**:
1. Delete 141 debug PNG screenshots from root (all untracked)
2. Remove tracked temp files: `full_report.txt`, `lint_report.txt`, `ts_errors.txt`, `unused_vars_report.txt`, `console-task-1348.txt`, `current-state.md`, `snapshot-*.md`, `bulk_replace*.js`, `components_lint_report.json`, `lint_report.json`, `lint_output.log`, `test_output.log`, `typecheck_output.txt`, `any_files.txt`
3. Remove stale `pnpm-lock.yaml` (project uses npm), `.cursorrules`
4. Remove `stats.html` (2.9MB build artifact)
5. Add `*.png` and temp patterns to `.gitignore` to prevent recurrence

---

### ~~TASK-1465~~: AI Features Audit — Review and Clean Up All AI Features (✅ DONE)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: Multiple AI features exist across the app in various states — some broken, some unused, some duplicated. No clear picture of what's working, what's valuable, and what should be removed.

**Scope**: Review all AI features and decide what to keep vs ditch.

**Findings**:
- Weekly Plan AI: LLM distribution replaced with deterministic algorithm (TASK-1405). LLM used only for week theme (Step 3) — keep.
- ARIA Game Master: Challenge generation broken. Template fallback preserved. AI rebuild removed from scope.
- AI Chat (Groq/Ollama): Working but ReAct loop dumps walls of tool result data (→ TASK-1469).
- Task Assist: Working but hidden in context menu — users never find it (→ TASK-1470).
- AI Memory Health Dashboard: Low value, internal tooling only — evaluate for removal.
- AI Quality Dashboard: Low value, internal tooling only — evaluate for removal.

**Outcome**: Spawned 2 follow-up tasks (TASK-1469, TASK-1470). Deleted broken/no-value AI files. Simplified AIHubView to surface only working features.

---

### ~~TASK-1469~~: AI Chat Anti-Spam Fix (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-14)

**Problem**: AI Chat ReAct loop dumps walls of raw tool result data into the conversation instead of answering questions concisely. Users see JSON blobs, long lists, and repeated tool calls before getting an answer.

**Fix**:
1. Limit tool calls per turn (max 3-5 before forcing a synthesis step)
2. Rewrite system prompt to emphasize concise, conversational responses — tool results are context, not output
3. Add output truncation for tool results shown in UI (collapse long results with "show more")
4. Review ReAct loop termination conditions — ensure it stops when answer is found, not when tool quota is exhausted

**Category**: AI / Chat

**Resolution**: Hidden step indicators from message content (metadata only), reduced MAX_REACT_STEPS 5→3, added forceful synthesis instruction after tool results, added 4 conciseness rules to system prompt, added step-indicator cleanup regex to cleanResponse(), capped digest length (fallback 1500→800, all paths 2000 max).

---

### TASK-1500: Supabase Chat Persistence + Usage Log Sync (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-10)

**Problem**: AI chat conversations and usage log entries were stored in localStorage only, meaning no cross-device sync.

**Fix**:
- Created `src/services/ai/chatPersistence.ts` — Supabase CRUD (load/save/delete) for `ai_conversations` table. Uses existing `supabase` client from `@/services/auth/supabase`. Silently fails on error.
- Created `src/services/ai/usageSync.ts` — 60s interval flush of accumulated usage entries to `ai_usage_log` via `upsert_ai_usage_log` RPC. Aggregates by date/provider/model before upserting.
- Modified `src/stores/aiChat.ts` — `initialize()` now async; tries Supabase first (VPS-first), falls back to localStorage. Debounced Supabase save wired into `debouncedSaveConversations`. Delete mirrors to Supabase. `startUsageSync()` called on init. Added `syncStatus` ref.

**Category**: AI / Persistence / Sync

---

### TASK-1470: Task Assist UX Resurface (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW (2026-03-31)

**Problem**: AI Task Assist is functional but buried in a context menu popover. Most users never discover it. It provides real value (AI suggestions for task breakdown, priority, time estimates) but zero discoverability.

**Implemented**:
1. ✅ AI Assist button with `Ctrl+.` shortcut hint in TaskEditModal toolbar
2. ✅ `Ctrl+.` keyboard shortcut registered in KeyboardShortcutsPanel (searchable)
3. ✅ Smart inline suggestion prompt — persistent for new users, re-triggers for incomplete tasks (completeness < 0.5)
4. ✅ `useTaskCompleteness` composable — scores task metadata completeness (priority, dueDate, duration, subtasks)
5. ✅ localStorage-backed AI discovery tracking (`AI_ASSIST_DISCOVERED` key)
6. ✅ **28-test AI effectiveness suite** — validates result quality, task improvement measurement, acceptance tracking, parsing robustness, and UX flow
7. ✅ Fixed vitest Tauri stub — resolved 17 previously broken test files

**Category**: AI / UX

---

### ~~TASK-1527~~: Remove Entire Gamification System (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-14)

Removed the entire gamification system (~23,700 lines): XP, achievements, challenges, shop, boss fights, corruption, Cyberflow RPG view, cyberflow design tokens, and all integration hooks. DB tables left dormant (no migration needed, reversible). Build passes, 883/884 tests pass.

**Category**: Cleanup / Architecture

---

### ~~BUG-1528~~: Tiny gray dot appears on today's date in date picker (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-14)

**Problem**: Naive UI's built-in `<div class="n-date-panel-date__sup">` rendered a gray dot on today's date, overlapping with our custom `::after` dot indicators.

**Fix**: Hidden the default element with `display: none !important` in `global-overrides.css`. Our custom white/teal dots remain.

**Category**: UI Bug

---

### ~~BUG-1531~~: Duplicated tasks keep being created (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (fixed via BUG-1533 on 2026-03-16)

**Problem**: Tasks were being duplicated — same task appeared multiple times, causing massive inflation (333,111 tasks). Root cause: recurrence scheduler cloning on every page load + calendar view missing dedup + 300s smart merge window too wide.

**Resolution**: Fixed by BUG-1533 commit `46cb445a` (12 duplication fixes): localStorage lock on recurrence, DB-level dedup check + unique index, Map-based calendar dedup, smart merge window tightened to 30s. DB verified clean: 0 duplicates, 96 healthy tasks.

**Category**: Data Integrity / Sync

---

---

## ~~Epic: Comprehensive Testing Strategy (TASK-1584 — TASK-1670)~~ — 🗄️ ARCHIVED

> 🗄️ ARCHIVED (2026-03-25) — Over-engineered 87-task plan deleted. Writing tests reactively on bugs is more practical. TASK-1586 and TASK-1589 were completed and remain useful.

## Bugs Found by E2E Tests (TASK-1671 — TASK-1682)

> **Goal**: Fix all real bugs discovered by the E2E test suite.
> **Priority**: P0-P1 | **Status**: 📋 PLANNED

| ID | Task | Priority | Status |
|----|------|----------|--------|
| ~~BUG-1671~~ | Fix workspace migration — `workspace_id` column missing from tasks/projects/groups, `workspace_members` table missing. Migration exists but fails due to `projects.id` type conflict (uuid vs text). Fix migration or drop FK constraint first. | P0 | ✅ **DONE** — Obsolete (Tauri removed). Note: workspace migration schema issue (projects.id type conflict) may still need fixing independently. |
| ~~BUG-1672~~ | Fix sidebar clipping in Tauri — sidebar text cut off, only icons visible. CSS grid `minmax(240px, 340px)` not respected in WebKitGTK. | P1 | ✅ **DONE** |
| ~~BUG-1673~~ | Fix Catalog view empty — status filter 'all' treated as literal match + WebKitGTK Realtime desync. Fixed in browser, Tauri deferred to Electron migration. | P0 | ✅ **DONE** (2026-03-24) |
| ~~BUG-1674~~ | Fix Inbox dropdown behind sidebar — calendar dropdown z-index lower than sidebar stacking context. | P1 | ✅ **DONE** |
| ~~BUG-1675~~ | Fix Canvas view empty in E2E — Vue Flow nodes don't render for test user. Workspace query errors prevent task loading. | P0 | ✅ **DONE** — Obsolete (dependency on BUG-1671) |
| ~~BUG-1676~~ | Fix Board view empty — kanban columns render but no task cards. Same workspace root cause. | P0 | ✅ **DONE** — Obsolete (dependency on BUG-1671) |
| ~~BUG-1677~~ | Fix context menu positioning — right-click menu not appearing or appearing outside viewport bounds. | P2 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~BUG-1678~~ | Fix tooltip z-index — tooltips render with z-index 'auto' instead of explicit value, may appear behind content. | P2 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~BUG-1679~~ | Fix PWA manifest not linked in dev mode — `<link rel="manifest">` missing when devOptions.enabled=false. | P2 | ✅ **DONE** |
| ~~BUG-1680~~ | Fix card border-radius not rendering — task cards missing rounded corners in some views. | P3 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~BUG-1681~~ | Fix Inbox panel shows no content — inbox collapsed by default, badge/content not accessible. | P2 | ✅ **DONE** — Obsolete (Tauri removed). Note: inbox empty state should be verified in Electron. |
| ~~BUG-1682~~ | Fix sidebar project names not loading — seeded project data not reaching sidebar due to workspace query errors. | P0 | ✅ **DONE** — Obsolete (dependency on BUG-1671) |
| ~~BUG-1691~~ | Fix tasks turning untitled (empty title saved) | P0 | ✅ **DONE** |
| ~~BUG-1696~~ | Tauri: Project names clipped to 24px in sidebar (WebKitGTK confirmed) | P1 | ✅ **DONE** |
| ~~BUG-1697~~ | Tauri: overflow:clip hides scrollable content in WebKitGTK | P1 | ✅ **DONE** |
| ~~BUG-1698~~ | Tauri: Views render blank pages when navigating (WebDriver test confirmed) | P1 | ✅ **DONE** |
| ~~BUG-1699~~ | E2E: 126 of 602 Playwright tests failing (CRUD, morning dashboard, multi-tab sync, mobile, PWA, performance) | P1 | ✅ **DONE** |
| ~~BUG-1700~~ | E2E: Initial render takes 12.7s (performance test expects <3s FCP) | P1 | ✅ **DONE** |
| ~~BUG-1701~~ | E2E: Memory growth >20MB across create/delete cycles | P2 | ✅ **DONE** — Obsolete (Tauri removed). Note: memory growth on create/delete cycles is a general concern, not Tauri-specific. |
| ~~BUG-1709~~ | Tauri: Inbox task cards — left done-toggle icons unclear + right action icons cover RTL text | P2 | ✅ **DONE** |
| ~~BUG-1710~~ | ✅ Tauri: "Unhandled promise rejection" error on launch (Promise:undefined:undefined) | P1 | ✅ **DONE** |
| ~~BUG-1711~~ | Tauri: Task completion celebration overlay is see-through (should be opaque) | P2 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~TASK-1712~~ | Tauri visual parity: task cards/UI degrade vs web app — need automated WebKitGTK visual regression | P1 | ✅ **DONE** (Tauri archived) |
| ~~BUG-1702~~ | Tauri: WebDriver test infra — view navigation uses localhost:1420 instead of embedded URLs | P2 | ✅ **DONE** |
| ~~BUG-1703~~ | Tauri: WebDriver font test false positive — "serif" substring matches "sans-serif" | P3 | ✅ **DONE** |
| ~~BUG-1704~~ | HTML: `<button>` nested inside `<button>` in SavedViewsDropdown.vue — invalid HTML | P2 | ✅ **DONE** |
| ~~BUG-1705~~ | CSS: 2 unannotated overflow:clip usages in MobileQuickSortView.vue (unit test failing) | P2 | ✅ **DONE** |

#### ~~BUG-1671~~: Workspace Migration Failure (✅ DONE)

> ✅ **DONE** — Obsolete (Tauri removed). Note: workspace migration schema issue (projects.id type conflict) may still need fixing independently.

- **Priority**: P0-CRITICAL
- **Root Cause**: `20260317000000_workspace_collaboration.sql` adds `workspace_id` to tasks/projects/groups and creates `workspace_members` table. Migration fails because `20260106000000_fix_id_types.sql` changes `projects.id` from uuid to text, but `pinned_tasks.project_id` FK still expects uuid. The FK constraint must be dropped/recreated first.
- **Impact**: ALL views fail to load data because every query now includes `.is('workspace_id', null)` which errors on missing column.
- **Fix**: Either fix the migration chain order, or manually drop the FK constraint before running migrations.

#### ~~BUG-1672~~: Sidebar Clipping in Tauri (✅ DONE)
- **Priority**: P1-HIGH
- **Root Cause**: CSS `grid-template-columns: minmax(240px, 340px) 1fr` in MainLayout.vue not respected by WebKitGTK. Sidebar renders at icon-only width. Fixed by removing `contain: layout`, CSP fix via `dangerousDisableAssetCspModification`, and OverflowTooltip inline-flex→flex.
- **Files**: `src/layouts/MainLayout.vue`, `src/layouts/AppSidebar.vue`

#### ~~BUG-1673~~: Catalog View Empty (✅ DONE)
- **Priority**: P0 | **Fixed**: 2026-03-24
- **Root Cause**: (1) Status filter `'all'` from ViewControls stored literally — `filteredTasks` matched `task.status === 'all'` (nothing). Persisted in localStorage, making bug permanent. (2) In Tauri/WebKitGTK, Supabase Realtime CHANNEL_ERROR drops likely cause data desync where rawTasks has data but filteredTasks empties.
- **Fix**: Normalized 'all' → null in setActiveStatusFilter + applyFilterState migration + defense-in-depth guard in useTaskFiltering. TaskTable groups watcher gets immediate:true. Diagnostic logging added for Tauri desync detection.
- **Status**: Fixed in browser. Tauri-specific Realtime desync deferred to Electron migration (TASK-1715).

#### ~~BUG-1675~~ to ~~BUG-1676~~: Empty Views (✅ DONE)

> ✅ **DONE** — Obsolete (dependency on BUG-1671)

- **Priority**: P0-CRITICAL
- **Root Cause**: Caused by BUG-1671 (workspace migration). Fixing the migration fixes these.
- **Dependency**: BUG-1671

#### ~~BUG-1674~~: Inbox Dropdown Behind Sidebar (✅ DONE)
- **Priority**: P1-HIGH
- **Root Cause**: Inbox panel's NPopover dropdowns rendered inside a stacking context trapped by sidebar z-index.
- **Fix**: Already resolved in BUG-1582 — `to="body"` added to both NPopover components in UnifiedInboxHeader.vue. No NDatePicker exists in inbox components.
- **Files**: `src/components/inbox/unified/UnifiedInboxHeader.vue`

---

### ~~BUG-1691~~: Fix tasks turning untitled (empty title saved) (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-22)

**Problem**: Tasks lose their titles and become "untitled" after editing. Users save tasks with content but the title field becomes empty.

**Root Causes**:
1. **TaskTable.vue** `saveEdit()` — no empty-string guard allowed blank titles to be saved on blur when user edits and clears the field
2. **tasks.ts** realtime sync — operator precedence bug (`!taskDoc.title === undefined` always false due to `!` binding tighter than `===`) disabled title validation, allowing empty strings through sync
3. **AllTasksView.vue** `handleUpdateTask()` — added guard blocking empty title updates to prevent user-triggered saves

**Files**: `src/components/common/TaskTable.vue`, `src/stores/tasks/tasks.ts`, `src/views/AllTasksView.vue`

---

## Tauri & E2E Test Audit Findings (BUG-1696 — BUG-1705)

> **Goal**: Fix all bugs found during the March 2026 comprehensive test audit.
> **Context**: E2E suite was completely broken (Vitest/Playwright collision). After fixing `playwright.config.ts`, 126 failures surfaced. WebDriver tests against real WebKitGTK confirmed additional Tauri-specific bugs.
> **Priority**: P1-P2 | **Status**: 📋 PLANNED

#### ~~BUG-1696~~: Tauri Project Names Clipped to 24px (✅ DONE)
- **Priority**: P1 | **Confirmed by**: WebDriver test against real WebKitGTK (wry 0.54.1)
- **Symptom**: Project items in sidebar render at 24px width instead of >100px. Only icons visible, names clipped.
- **Related**: BUG-1672 (broader sidebar clipping). This is a specific sub-issue — project name elements are narrower than the sidebar itself.
- **Evidence**: WebDriver test `sidebar project names have readable width` — Expected >100, Received 24
- **Fix**: Removed `contain: layout` from `.sidebar` (breaks flex sizing in WebKitGTK wry 0.54.1). Added defensive `width: 100%` to BaseNavItem and projects-list. CSS-only, 3 files.
- **Files**: `src/layouts/AppSidebar.vue`, `src/components/base/BaseNavItem.vue`, `src/components/sidebar/SidebarProjectsSection.vue`

#### ~~BUG-1697~~: overflow:clip Hides Content in WebKitGTK (✅ DONE)
- **Priority**: P1 | **Confirmed by**: WebDriver test + Vitest css-syntax safety test
- **Symptom**: 1 element using `overflow:clip` with scrollable content — content vanishes in WebKitGTK.
- **Fix**: Replace `overflow: clip` with `overflow: hidden` per SOP-060. Also fix 2 unannotated usages in MobileQuickSortView.vue (BUG-1705).
- **Reference**: `docs/sop/SOP-060-webkitgtk-gotchas.md`

#### ~~BUG-1698~~: Tauri Views Render Blank on Navigation (✅ DONE)
- **Priority**: P1 | **Confirmed by**: WebDriver test + screenshot showing "Could not connect to localhost"
- **Root Cause**: Tests navigate to `http://localhost:1420/` but the debug build embeds the frontend — no dev server running. App loads initially (first test page works) but subsequent `browser.url()` calls fail.
- **Fix**: WebDriver tests should navigate using relative paths or detect the embedded base URL from the initial page.
- **Screenshot**: `.dev/screenshots/webdriver/view-canvas-*.png` shows "Could not connect to localhost: Connection refused"

#### ~~BUG-1699~~: 126 Playwright E2E Tests Failing (✅ DONE)
- **Priority**: P1 | **Scope**: 126 of 602 tests across chromium + webkit + tauri-simulation
- **Breakdown**:
  - CRUD Workflows: 6 failures (TimeoutError on task edit modal selectors)
  - Morning Dashboard: ~12 failures (drag-to-slot, pool rendering)
  - Multi-Tab Sync: ~9 failures (cross-tab data sync)
  - Mobile Core Flows: 6 failures (bottom nav, menu, timer)
  - PWA Runtime: 6 failures (SW, offline, FCP >3s)
  - CSS Rendering: multiple (layout, scrollbars, RTL)
  - Tauri Layout/Specific: ~9 failures (sidebar collapse, calendar, drag)
  - Data Integrity: 1 failure (data stuck empty after reload)
  - Self-Host: 1 failure (quick add task)
  - Taskbar Nanny: 1 failure (threshold without chosen task)
- **Note**: These were previously invisible because the entire E2E suite crashed before running (Vitest/Playwright `Symbol($$jest-matchers-object)` collision). Fixed by changing `testDir` in `playwright.config.ts`.

#### ~~BUG-1700~~: Initial Render Takes 12.7s (✅ DONE)
- **Priority**: P1 | **Confirmed by**: Playwright memory-perf test
- **Resolution**: FCP is actually ~1s (Chromium) / ~1.8s (WebKit). The 12.7s was from broken test infra. Verified 2026-03-24.
- ~~**Symptom**: Performance test expects FCP under 3 seconds, actual initial render took 12.7s~~

#### ~~BUG-1701~~: Memory Growth >20MB (✅ DONE)

> ✅ **DONE** — Obsolete (Tauri removed). Note: memory growth on create/delete cycles is a general concern, not Tauri-specific.

- **Priority**: P2 | **Confirmed by**: Playwright memory-perf test
- **Symptom**: Memory grows >20MB across create/delete cycles, suggesting leak in task store or Supabase subscriptions

#### ~~BUG-1711~~: Tauri Task Completion Celebration Overlay See-Through (✅ DONE)

> ✅ **DONE** — Obsolete (Tauri removed)

- **Priority**: P2 | **Confirmed by**: User screenshot in Tauri production app
- **Symptom**: "Sweet!" celebration overlay with checkmark is transparent — background content visible through it. Should have opaque/glass background.
- **Root cause**: Likely same CSP issue as BUG-1674 — `backdrop-filter` or background styles not applying in Tauri production. Or `.tauri-app` override missing for this component.
- **Files**: `src/components/tasks/` (DoneToggle celebration overlay)

#### ~~BUG-1710~~: Tauri Unhandled Promise Rejection on Launch (✅ DONE)
- **Priority**: P1 | **Confirmed by**: User report in Tauri production app (v1.3.25)
- **Error**: `Error: Unhandled promise rejection` at `Promise:undefined:undefined`
- **Impact**: Error dialog on app launch, may block functionality

#### ~~BUG-1713~~: DnD to specific day group in Catalog fails (Unknown dueDate group key) (✅ DONE)
- **Priority**: P2 | **Status**: ✅ DONE (2026-03-24)
- **Problem**: Dragging a task to a per-day group (e.g., Wednesday) in the Catalog view's dueDate grouping failed silently. The `applyGroupTransfer` function in TaskList.vue only recognized generic bucket keys (today, tomorrow, thisWeek, etc.) but not the `day-YYYY-MM-DD` keys generated for individual weekday groups.
- **Root Cause**: Missing handler for per-day group keys in the dueDate assignment logic. Only generic bucket grouping was supported, not individual calendar days.
- **Fix**: Added `else if (group.key.startsWith('day-'))` handler to extract the date from the key format and set it as dueDate. The handler parses the `day-YYYY-MM-DD` format and assigns that date to the task.
- **Files**: `src/components/tasks/TaskList.vue`

#### ~~BUG-1714~~: RTL: Project names with mixed Hebrew/Latin text render in wrong direction (✅ DONE)
- **Priority**: P2 | **Status**: ✅ DONE (2026-03-24)
- **Problem**: Project names containing both Hebrew and Latin characters (e.g., "פרויקטים עם קבוצת AI מעצבים ב") displayed in wrong text direction (LTR instead of RTL) in sidebar nav items, app header subtitle, and canvas group headers.
- **Root Cause**: Text-rendering elements lacked proper directionality hints, causing the browser to default to LTR for mixed-direction text.
- **Fix**: Added `dir="auto"` to text-rendering elements in `BaseNavItem` (`.nav-label`), `AppHeader` (`.title-filter`), and `CanvasGroup` (`.section-name`) so the browser auto-detects base direction from the first strong character.
- **Files**: `src/components/base/BaseNavItem.vue`, `src/layouts/AppHeader.vue`, `src/components/canvas/CanvasGroup.vue`

#### ~~TASK-1712~~: Tauri Visual Parity — Automated WebKitGTK Regression Testing (✅ DONE)

> ⏸️ **ARCHIVED**: Deferred to Electron migration. See [MASTER_PLAN_TAURI_ARCHIVE.md](MASTER_PLAN_TAURI_ARCHIVE.md)

- **Priority**: P1 | **Type**: Infrastructure + Bug fixes
- **Problem**: Task cards, icons, overlays, and UI components look/work better in the web app than in Tauri. Multiple visual issues reported (BUG-1709 icons, BUG-1711 overlay, text overlap). No automated way to detect these before deploying.
- **Goal**: Build a testing pipeline that catches Tauri/WebKitGTK visual regressions BEFORE deployment, so Claude can fix them without the user manually testing each build.
- **Approach**:
  1. Extend `scripts/webkit-test.py` to run with `cargo tauri dev` (real Tauri IPC, not HTTP mock)
  2. Add screenshot comparison (baseline vs current) for each view
  3. Add checks for: element overlap, icon sizing, opacity, glass morphism, RTL text rendering
  4. Integrate into deploy pipeline (block deploy if visual regression detected)
- **Depends on**: Working `cargo tauri dev --no-dev-server-wait` workflow
- **Files**: `scripts/webkit-test.py`, `scripts/deploy-tauri-update.sh`, `tests/webdriver/`

#### ~~BUG-1709~~: Tauri Inbox Task Cards — Icons Unclear + Text Overlap (✅ DONE)
- **Priority**: P2 | **Confirmed by**: User screenshot in Tauri production app
- **Issue 1**: ~~Left done-toggle icons appear as unclear blobs instead of recognizable checkmark circles~~ — Fixed: size 14→16, added `background: var(--success-bg-subtle)` + 20px circle behind icon in `.done-indicator`
- **Issue 2**: ~~Right-side action icons overlap Hebrew RTL task title text~~ — Fixed: all physical `right`/`left` properties on `.task-actions`, `.timer-indicator`, `.done-indicator` replaced with `inset-inline-end`/`inset-inline-start`; added `padding-inline-end: var(--space-8)` to task content in both cards
- **Files**: `src/components/inbox/unified/UnifiedInboxTaskCard.vue`, `src/components/inbox/calendar/CalendarTaskCard.vue`

#### ~~BUG-1702~~: WebDriver Test Navigation Uses Wrong URLs (✅ DONE)
- **Priority**: P2 | **Type**: Test infrastructure
- **Problem**: `webkitgtk-layout-bugs.ts` tests 4 & 5 navigate to `http://localhost:1420/` which is the Tauri dev server port. Debug builds embed the frontend, so no dev server is running.
- **Fix**: Use the initial page URL as base, or navigate via JS (`window.location.hash = '#/board'`) instead of `browser.url()`
- **File**: `tests/webdriver/specs/webkitgtk-layout-bugs.ts`

#### ~~BUG-1703~~: WebDriver Font Test False Positive (✅ DONE)
- **Priority**: P3 | **Type**: Test infrastructure
- **Problem**: Font test checks `fontFamily.not.toContain('serif')` but actual value `"v-sans, system-ui, ... sans-serif"` matches because "sans-serif" contains "serif"
- **Fix**: Use regex `/(?<!sans-)serif/` or check for exact "serif" as standalone font name
- **File**: `tests/webdriver/specs/webkitgtk-layout-bugs.ts:351`

#### ~~BUG-1704~~: Nested `<button>` in SavedViewsDropdown (✅ DONE)
- **Priority**: P2 | **Confirmed by**: Vite build warning
- **Problem**: `<button>` element nested inside another `<button>` at lines 45-51 of `SavedViewsDropdown.vue`. Invalid HTML per spec, causes click handling issues.
- **File**: `src/components/filters/SavedViewsDropdown.vue:45-51`

#### ~~BUG-1705~~: Unannotated overflow:clip in MobileQuickSortView (✅ DONE)
- **Priority**: P2 | **Confirmed by**: Vitest css-syntax safety test (1 of 1812 failing)
- **Problem**: 2 usages of `overflow: hidden` with SOP-060 comment but missing `/* WebKitGTK-safe */` annotation on lines 13 and 280
- **Fix**: Add `/* WebKitGTK-safe */` annotation or verify the fallback is correct
- **File**: `src/mobile/views/MobileQuickSortView.vue`

---

## TypeScript Strict Mode Errors (TASK-1683 — TASK-1689)

> **Goal**: Fix all 388 `tsc --noEmit` errors to achieve strict type safety. Build passes (Vite skips these) but they mask real bugs.
> **Priority**: P2 | **Status**: 📋 PLANNED

| ID | Task | Priority | Status |
|----|------|----------|--------|
| ~~TASK-1683~~ | ✅ Fix Supabase database composable types (85 errors, 11 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1684~~ | ✅ Fix Canvas composable types (120 errors, 9 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1685~~ | ✅ Fix App initialization & sidebar types (40 errors, 2 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1686~~ | ✅ Fix Calendar composable types (22 errors, 4 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1687~~ | ✅ Fix Sync & timer types (29 errors, 3 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1688~~ | ✅ Fix AI, board, and cross-tab types (41 errors, 8 files) | P2 | ✅ **DONE** (2026-04-02) |
| TASK-1689 | Fix miscellaneous type errors (51 errors, 18 files) | P3 | 📋 PLANNED |

#### ~~TASK-1683~~: Supabase Database Composable Types (✅ DONE)
- **Priority**: P2
- **Error count**: 85 errors across 11 files in `src/composables/supabase/`
- **Root patterns**: (1) `supabase` client imported as possibly null — needs non-null assertion or guard. (2) Supabase `.select('*')` returns `{}` type — needs explicit type parameter or cast. (3) `Record<string, unknown>` vs concrete interface mismatches in `.forEach()` callbacks.
- **Fix approach**: Add `supabase!` non-null assertion in `_infrastructure.ts` or add null guards. Add type parameters to `.select<T>()` calls. Type callback parameters with concrete interfaces.

#### ~~TASK-1684~~: Canvas Composable Types (✅ DONE)
- **Priority**: P2
- **Error count**: 120 errors across 9 files in `src/composables/canvas/`
- **Root patterns**: (1) Vue Flow `findNode()` returns `unknown` — needs type assertion. (2) `NodeChange[]` vs `unknown[]` in `onNodesChange` handlers. (3) Untyped `payload` in Realtime event handlers. (4) `undoHistory` ref typed as `unknown`.
- **Fix approach**: Add proper Vue Flow type imports (`GraphNode`, `NodeChange`). Type the Realtime payload handlers. Fix `undoHistory` ref generic parameter.

#### ~~TASK-1685~~: App Initialization & Sidebar Types (✅ DONE)
- **Priority**: P2
- **Error count**: 40 errors across 2 files
- **Root patterns**: Supabase Realtime `.on('postgres_changes')` callback payload is typed as `{}`. Properties like `id`, `is_deleted`, `title`, `name` accessed on it.
- **Fix approach**: Type the Realtime payload with `RealtimePostgresChangesPayload<{[key: string]: unknown}>` and cast `.new`/`.old` to task/project/group interfaces.

#### ~~TASK-1686~~: Calendar Composable Types (✅ DONE)
- **Priority**: P2
- **Error count**: 22 errors across 4 files
- **Root patterns**: (1) `instance` callbacks typed as `Record<string, unknown>` instead of `TaskInstance | RecurringTaskInstance`. (2) Catch clause `e` is `unknown` — needs `instanceof Error` guard. (3) Property destructuring from `unknown` objects.
- **Fix approach**: Change callback parameter types to use proper interfaces. Add error guards in catch blocks.

#### ~~TASK-1687~~: Sync & Timer Types (✅ DONE)
- **Priority**: P2
- **Error count**: 29 errors across 3 files
- **Root patterns**: (1) `useTimerLeaderElection.ts` — `handleLeaderMessage(sync: unknown)` uses `sync.action`, `sync.leaderId` etc. without narrowing. (2) `useSyncOrchestrator.ts` — various payload types.
- **Fix approach**: Define a `LeaderMessage` discriminated union type. Type sync operation payloads.

#### ~~TASK-1688~~: AI, Board, and Cross-Tab Types (✅ DONE)
- **Priority**: P2
- **Error count**: 41 errors across 8 files
- **Root patterns**: Mixed — `Record<string, unknown>` vs concrete types, `unknown` assertions, missing generics.
- **Fix approach**: Add proper type annotations file by file. Most are simple type parameter additions.

#### TASK-1689: Miscellaneous Type Errors (📋 PLANNED)
- **Priority**: P3
- **Error count**: 51 errors across 18 files
- **Root patterns**: Scattered minor type issues — `unknown` catch variables, missing properties, test mock types.
- **Fix approach**: Fix individually. Low priority since these are in less critical paths.

---

## Canvas Image Paste Feature (TASK-1690)

### ~~TASK-1690~~: Ctrl+V paste-image support for CanvasView (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-25)

**Goal**: Allow users to paste screenshots from clipboard directly onto the canvas. Pasted images appear as draggable `imageNode` nodes, with click-to-zoom lightbox. Images are compressed and stored in Supabase Storage (with data URL fallback for offline/guest mode).

**What works**: Paste (Ctrl+V), render on canvas, click-to-select (teal ring), drag, double-click lightbox, Delete key removes, undo via global operation stack.

**Follow-up**: ~~TASK-1722~~ (✅ DONE — context menu overlap, delete+undo, lightbox focus)

---

### ~~TASK-1722~~: Canvas ImageNode interaction polish (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-01)

**Parent**: TASK-1690 follow-up

**Issues fixed**:
1. ✅ Right-click context menu overlap — added `.image-node` guard to `handleCanvasRightClick`
2. ✅ Delete + Ctrl+Z undo — fixed global keydown listener (was skipping Delete), replaced broken `permanentlyDeleteTaskWithUndo` with `bulkDeleteTasksWithUndo`, always push image deletes to undo stack
3. ✅ Lightbox focus return — already working from TASK-1690

**Root causes found**: Delete key not reaching handler (focus stolen by VueFlow nodes), `permanentlyDeleteTaskWithUndo` corrupting shared `pendingOperation` singleton state, tombstone blocking undo restore, console filter swallowing debug logs (`[TASK-` pattern)

**Files**: `src/composables/canvas/useCanvasEvents.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, `src/views/CanvasView.vue`, `src/composables/undoSingleton.ts`

---

### BUG-1723: Supabase Realtime connection drops with CHANNEL_ERROR cycling (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-04-04)

**Problem**: Realtime WebSocket connection repeatedly drops with `CHANNEL_ERROR` and `CLOSED` events (unknown reason), then reconnects. This causes unnecessary data reloads, duplicate PROJECT event floods (6 projects × multiple reconnects), and potential missed events during the disconnect window.

**Symptoms from console**:
- `📡 [REALTIME] Connection dropped (CHANNEL_ERROR): unknown reason`
- `📡 [REALTIME] Connection dropped (CLOSED): unknown reason`
- Duplicate `removeChannel` calls (recursion guard catches them)
- After reconnect: full recovery reload + PROJECT event storm (all 6 projects re-emitted multiple times)

**Investigation areas**:
1. Check Supabase Realtime server health / connection limits on VPS
2. Review channel subscription cleanup — recursion guard suggests double-teardown
3. Check if tab visibility changes trigger disconnects
4. Review reconnect backoff strategy (currently ~1s)
5. Deduplicate PROJECT events after reconnect recovery

**Files**: `src/composables/useRealtimeSubscription.ts`, `src/composables/useAppInitialization.ts`

---

### BUG-1724: BaseModal Vue warning — extraneous class attribute on fragment root (📋 PLANNED)

**Priority**: P3 | **Status**: 📋 PLANNED

**Problem**: Every `BaseModal` usage triggers Vue warning: "Extraneous non-props attributes (class) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes." Affects `ConfirmationModal`, `RecurrenceDeleteModal`, and all modals across Canvas, Calendar, and Sidebar views.

**Root cause**: `BaseModal` renders a fragment (multiple root nodes) or uses `<Teleport>` as root, so Vue can't auto-inherit the `class` attribute from parent components like `ConfirmationModal`.

**Fix options**:
1. Wrap `BaseModal` template in a single root element
2. Use `inheritAttrs: false` and manually bind `$attrs` to the correct element
3. Remove `class` pass-through from `ConfirmationModal` wrapper

**Files**: `src/components/base/BaseModal.vue`, `src/components/common/ConfirmationModal.vue`

---

### ~~BUG-1725~~: Lifecycle hooks called outside component setup context (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-08)

**Problem**: Console warns `onMounted is called when there is no active component instance` and `onUnmounted is called when there is no active component instance`. This happens during app initialization, likely from an async composable that registers lifecycle hooks after an `await` statement.

**Root cause**: Vue 3 requires lifecycle hooks to be registered synchronously during `setup()`. If a composable uses `async setup()` or calls `onMounted`/`onUnmounted` after an `await`, the hooks won't bind to any component instance.

**Investigation**:
1. Search for `onMounted` / `onUnmounted` calls inside async functions or after `await` in composables
2. Check `useAppInitialization.ts` — it orchestrates many async operations during startup
3. Check Realtime subscription setup — connection happens async

**Impact**: Hooks silently fail to register, meaning cleanup code in `onUnmounted` never runs (potential memory leaks).

**Files**: `src/composables/useAppInitialization.ts`, composables called during init

---

### ~~BUG-1731~~: Electron auth persistence — sessions lost on app restart (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-26)

**Problem**: Electron's `file://` protocol didn't reliably persist `localStorage` across app restarts. Auth tokens were lost whenever users closed and reopened the app, forcing re-authentication.

**Root cause**:
1. Electron's `file://` scheme doesn't support persistent storage across restarts (localStorage is ephemeral)
2. OAuth callback couldn't be captured in Electron's `file://` context (no HTTP server to receive redirects)
3. Settings > Account section didn't show update status for Electron users

**Fix**:
1. **electronStorage adapter** (`src/services/auth/electronStorage.ts`) — IPC-backed storage adapter that routes auth tokens through `electron-store` (disk-persisted key-value store)
2. **localhost OAuth server** (`electron/ipc/auth.ts`) — Start `http://localhost:3001` in main process to capture OAuth callback (same pattern as Tauri)
3. **Electron-aware auth flow** (`src/composables/useElectronAuth.ts`) — Routes Electron through `skipBrowserRedirect: true` + `openExternal()` for browser-based OAuth
4. **Account settings mirror** (`src/components/settings/tabs/AccountSettingsTab.vue`) — Added "Updates" section for Electron showing auto-updater status (parallel to Tauri)

**Files**: `src/services/auth/electronStorage.ts`, `src/composables/useElectronAuth.ts`, `electron/ipc/auth.ts`, `src/components/settings/tabs/AccountSettingsTab.vue`

---

### ~~BUG-1732~~: Canvas group badge counts task not rendered (parentId without canvasPosition) (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-26)

**Problem**: Canvas group badge showed inflated task count — tasks with `parentId` but no `canvasPosition` were counted in the group's task total but never rendered as Vue Flow nodes. Additionally, the task edit modal's section selector would change the `canvasPosition` but forget to set `parentId`, causing tasks assigned to canvas sections via the modal to render as root nodes instead of being contained inside their assigned groups.

**Root cause**:
1. `canvasGroups.ts` badge count computed property counted all tasks with a `parentId` without verifying they also had a valid `canvasPosition`
2. `useTaskEditActions.ts` section change logic set `canvasPosition` (for rendering) but didn't set `parentId` (for group membership), creating orphaned visual nodes

**Fix**:
1. **canvasGroups.ts**: Updated badge count to require BOTH `parentId` AND `canvasPosition` to be present — tasks missing geometry are excluded from the count
2. **useTaskEditActions.ts**: Section change now atomically sets both `parentId` and `canvasPosition` together, ensuring task becomes a proper group child on save

**Files**: `src/stores/canvas/canvasGroups.ts`, `src/composables/tasks/useTaskEditActions.ts`

---

### BUG-1737: Canvas Delete + Ctrl+Z undo unreliable — task reappears then vanishes (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: After deleting a task on canvas and pressing Ctrl+Z, the task sometimes reappears briefly then vanishes again. Undo is unreliable.

**Root cause**: Three race conditions in the dual-write delete architecture:
1. **Realtime echo re-delete (primary)**: `deleteTask()` both enqueues a sync queue DELETE *and* directly soft-deletes in Supabase. Undo cancels the queue DELETE but the direct soft-delete already triggered a realtime echo that re-splices the restored task.
2. **Sync queue DELETE-cancels-CREATE**: The sync orchestrator's DELETE handler proactively cancels pending CREATEs for the same entity — including the CREATE that undo just enqueued.
3. **`deleteOperationsByType` not status-aware**: If the sync queue DELETE is already `syncing` (in-flight HTTP), deleting it from IndexedDB doesn't cancel the request.

**Recommended fixes** (prioritized):
1. Suppress realtime DELETE echoes for 5s after undo restore (`addPendingWrite` window)
2. Make `deleteOperationsByType` status-aware (warn on `syncing` operations)
3. Consider single-write path for DELETEs (sync queue only, no direct save)

**Files**: `src/composables/undoSingleton.ts`, `src/stores/tasks/taskOperations.ts`, `src/services/offline/writeQueueDB.ts`, `src/composables/app/useAppInitialization.ts`

---

### ~~BUG-1736~~: Flaky E2E — "create task in Canvas → node appears" fails on WebKit (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-01)

**Problem**: Playwright E2E test `crud-workflows.spec.ts:429` ("create task in Canvas → node appears") intermittently fails on WebKit. Likely a timing issue — Vue Flow node mounting is slower in WebKit, or canvas ready state isn't properly awaited.

**Potential fixes**:
1. Add `waitForSelector` with longer timeout for the Vue Flow node
2. Wait for canvas `isCanvasReady` state before interacting
3. Skip on WebKit if it's a known platform limitation

**Files**: `tests/e2e/crud-workflows.spec.ts`

---

## Partner Collaboration Roadmap — Shared Task OS

### FEATURE-1805: Partner collaboration — shared task operating system (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Goal**: Make FlowState usable as a shared daily operating system for two people: shared projects, tasks, board/calendar planning, assignment, comments, activity, and realtime updates. This is intentionally not a full Notion clone; docs/databases/pages are out of scope unless later proven necessary.

**Existing foundation**: Workspace tables/RLS/invites/members, workspace switcher, task assignment, presence, activity feed, workspace-aware task/project/group queries, and realtime filters already exist. The work is to harden and complete the shared-workspace experience.

**Non-goals for first release**:
- Full Notion-style page/database/block editor
- Public team/organization product surface
- Shared Canvas as the first milestone
- Complex granular permissions beyond owner/admin/member/viewer basics

#### Phase 1: Shared workspace hardening MVP

**Priority**: P1 | **Target**: 2-4 weeks

**Scope**:
- Verify workspace create/invite/accept/switch flows end-to-end in Electron.
- Ensure task/project loads, writes, realtime updates, and offline queue operations are always scoped by `workspaceId`.
- Make Board usable for shared workspaces: create/edit/delete/move tasks, project grouping, assignment filter, and partner visibility.
- Keep Canvas personal-only during this phase; redirect behavior is acceptable.
- Add focused RLS, sync-queue, realtime, and workspace-switch regression coverage.

**Acceptance criteria**:
- User and partner can both see and mutate the same shared workspace tasks.
- Personal tasks never appear in shared workspace, and shared tasks never appear in personal workspace.
- Simultaneous edits do not duplicate, resurrect, or silently discard tasks in normal Board workflows.
- Electron build ships the feature behind existing workspace UI.

#### Phase 2: Shared planning workflow

**Priority**: P1 | **Target**: 2-3 weeks after Phase 1

**Scope**:
- Make Calendar safe and useful in shared workspaces.
- Support assignment, unassigned work, and "mine/all" filters across Board and Calendar.
- Add task comments and activity feed polish for real partner handoff.
- Add notifications or visible badges for partner changes where low-risk.

**Acceptance criteria**:
- Both users can plan shared work on Board and Calendar without losing updates.
- Comments/activity make it clear who changed what recently.
- Shared planning remains reliable through reloads, Electron restarts, and realtime reconnects.

#### Phase 3: Daily-use reliability pass

**Priority**: P1 | **Target**: 2-3 weeks after Phase 2

**Scope**:
- Stress-test sync, offline recovery, conflict behavior, workspace switching, tombstones, and undo/redo in shared workspaces.
- Add regression tests around the historically risky paths: LWW conflicts, deletion/undo, realtime reconnect, cached stale data, and workspace cache isolation.
- Tighten role behavior: owner/admin/member/viewer permissions should match RLS and UI affordances.
- Build and deploy through the Electron updater flow.

**Acceptance criteria**:
- Shared task OS is safe enough for daily use by two people.
- Known sync/realtime failure modes have direct regression coverage.
- `npm run electron:build` passes and updater manifest is verified after release.

#### Phase 4: Shared Canvas evaluation

**Priority**: P2 | **Status**: 📋 PLANNED, defer until Phases 1-3 are stable

**Scope**:
- Decide whether shared Canvas is actually needed after daily task collaboration is working.
- If needed, design shared Canvas around explicit workspace geometry ownership, conflict handling, and realtime update safety.
- Do not enable shared Canvas by default until geometry sync has strong tests.

**Acceptance criteria**:
- A clear go/no-go decision exists for shared Canvas.
- If implemented, Canvas group/task positions do not jump, overwrite, or cross-leak between users/workspaces.

---

## Formatting Guide

**Task Format**: `### TASK-XXX: Title (STATUS)` with `🔄 IN PROGRESS`, `✅ DONE`, `📋 PLANNED`

**Priority**: `P0-CRITICAL`, `P1-HIGH`, `P2-MEDIUM`, `P3-LOW`

**Progress**: Checked boxes `- [x]` calculate % automatically.

---

## References

- **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md` (completed tasks)
- **Code Review Archive**: `docs/archive/CODE_REVIEW_FINDINGS_JAN_2026.md`
- **Crisis Analysis**: `docs/reports/2026-01-20-auth-data-loss-analysis.md`

---

*Condensed January 27, 2026 - Reduced from ~2,300 lines to ~380 lines (84% reduction)*
