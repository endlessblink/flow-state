# FlowState Stability, Auth, and Google Integration Audit

Date: 2026-08-23  
Status: `in_progress` — validated investigation and repair plan; no production fix claimed.

## Executive finding

FlowState is not failing in one isolated place. It has several state machines that can disagree about the same account and runtime: Electron main-process ownership, renderer auth, durable auth storage, Supabase refresh state, Local API sidecar state, Google provider-token state, and the installed updater/runtime. Existing fixes improved individual transitions, but the acceptance surface is still not closed end to end.

The most actionable confirmed defect is a cross-boundary state mismatch: the auth store deliberately keeps a remembered account during passive/null-session recovery, while `syncLocalApiSession()` clears the Local API session whenever its input session is null. A transient auth-js null session can therefore leave the UI signed in while the sidecar/KDE/API surface is disconnected. The live machine also has two top-level FlowState runtimes, and the active diagnostics repeatedly show a hidden mounted runtime with no auth token; this makes stale-process evidence a first-class part of the failure, not noise.

## Evidence captured

- Current checkout: `master`, package version `1.4.422`, with unrelated user-owned dirty changes preserved and not edited by this audit.
- Live process scan: two FlowState top-level processes started together at 18:50:26, one from a mounted development AppImage path and one from `/home/endlessblink/.local/bin/FlowState.AppImage`.
- Live profile: `/home/endlessblink/.config/flow-state` contains `runtime-diagnostics.log` (~4.9 MB), renderer logs, drag diagnostics, Local API configuration, and Chromium profile state; credentials and authorization contents were not read.
- Runtime diagnostics: repeated renderer-console entries from the mounted runtime say `No auth token available, scheduling retry`; main-health entries show the renderer route from the mounted runtime, a roughly four-second heartbeat age, and `windowVisible:false`. No renderer-crash or main-uncaught event was established from the inspected tail, so “crash” is not yet proven for this runtime; hidden/stale/duplicate ownership is proven.
- Focused verification: auth/Electron/Local API/runtime-diagnostic suites passed `100` tests across `8` files; Google Calendar integration passed `14` tests. These are source and mocked-boundary evidence, not installed-app or production proof.
- Existing project history already records incomplete live gates for remembered-auth recovery, renderer freezes, and cross-client convergence; those entries were used as leads and were not treated as current proof.

### Deep-dive verification added after the initial triage

- Full unit run: the runner returned exit `0`, but the actual summary was `3` failing files, `34` failing tests, `4,597` passing tests, and `6` skipped tests. The exit code is therefore not a trustworthy green signal in this repository.
- The `28` Smart Merge failures and both rollback failures share a concrete contract mismatch: the current dirty working tree gates remote persistence on `authStore.canSyncRemotely`, while those test doubles provide only `user` and `isAuthenticated`. They are consequently exercising guest behavior, not the authenticated path they claim to cover. This is both a test-harness defect and a release-risk signal: any production caller with a remembered user but no usable session is intentionally routed to a different data path.
- The four tidy-layout failures have a separate direct cause: the new shared adoption helper requires a due date, but the spatial recovery tests use undated loose or stale-parent tasks. The previous tidy implementation used the task's rendered position and group bounds; the replacement silently drops that behavior. This is a confirmed behavior regression in the current working tree, not an auth failure.
- Type checking completed successfully. The combined validation job did not complete within five minutes; its captured lint output contains `427` errors and `541` warnings, including three irregular-whitespace errors in a shared utility file. The validation job must not be described as passed.
- The E2E inventory contains authenticated and offline/reconnect scenarios, including real-fixture auth setup and Google-related test names, but inventory is not execution evidence. No current run against the installed Electron artifact, a real Google callback, a real calendar response, or the public updater was captured during this audit.
- Source review found multiple independent “continue anyway” paths around startup, cache loading, auth recovery, background refresh, realtime, Local API delivery, and Google proxy calls. They protect the UI from throwing, but several are best-effort or warning-only; the visible shell can therefore remain open while remote sync, helper access, or Google access is unavailable.
- The Local API has useful missing-auth classifications and restart machinery, but the live scan did not prove whether the sidecar was disabled, absent, crashed, or owned by another runtime. A live port/health/session-replay probe is still mandatory.
- The working tree contains unrelated user changes and an untracked adoption helper/test. All failures above were observed without cleaning or overwriting those changes; the report distinguishes current checkout behavior from the last pushed commit.
- The exhaustive route ledger is now captured separately in `docs/flowstate-route-scenario-matrix-2026-08-23.md`: 22 route patterns, six mobile views, guard/redirect cases, state dimensions, action dimensions, and cross-boundary scenarios. It identifies four route surfaces with no execution evidence and keeps all installed/Google/helper/updater/production gates open.
- Safe focused verification added `97` passing tests across `11` files. Public read-back found the homepage reachable (`HTTP 200`), the updater manifest reachable at version `1.4.422` (matching the current package), and the Google Calendar proxy reachable but correctly rejecting an unauthenticated request (`HTTP 401`). Browser E2E was deliberately not run because the available wrapper handles a service key and the alternate path can consume existing auth state; this remains an open manual/runtime gate.

## Failure-class matrix

| Failure class | Finding | Evidence status | Required repair gate |
| --- | --- | --- | --- |
| Runtime ownership | Two concurrent top-level FlowState runtimes are active; the single-instance contract is not trustworthy across mounted/installed launch paths. | Confirmed live; exact lock/profile divergence still needs capture. | Launch installed app twice, mounted app once, inspect userData/lock identity, and prove one visible owner plus deterministic handoff. |
| Renderer crash/freeze | Diagnostics now persist heartbeat, unresponsive, renderer-gone, console, and main-process events, but the inspected runtime shows a hidden renderer repeatedly retrying auth rather than a proven crash. | Instrumentation present; repro not closed. | Fresh installed headed run, deliberate renderer hang/crash fixture, restart recovery, and screenshot/log correlation. |
| Main/preload bridge | Auth storage depends on a lazy Electron bridge and refuses volatile fallback when the bridge is missing; this is safer, but bridge availability/retry is not proven in the installed artifact. | Source and unit evidence only. | Cold launch/read/write/relaunch test against the real disk-backed store, with bridge-missing and late-bridge cases. |
| Auth state model | Remembered identity, usable session, remote-sync permission, and explicit sign-out are separate concepts, but several watchers still react to `session === null`. | Concrete source hazard at `src/composables/useLocalApiBridge.ts:41-69` and auth watcher around `src/stores/auth.ts:230-235`; focused tests do not cover the exact post-init null-session bridge case. | Add a failing test for passive null-session after initialization, then make only explicit sign-out clear sidecar/auth ownership. |
| Refresh-token rotation | Refresh tokens are single-use and multiple runtimes can rotate them; backups and the primary key can diverge. Existing recovery preserves a shell, but concurrent-owner behavior is unproven. | Source comments and unit coverage; live rotation not proven. | Single-owner refresh test, interrupted-write test, backup/primary reconciliation test, and relaunch after forced refresh failure. |
| Supabase connectivity | Realtime reports no token in the live mounted runtime; reconnect loops can continue while the UI remains visible or hidden. | Confirmed live symptom; backend cause not isolated. | Correlate auth heartbeat → realtime token → WebSocket status → API request in one fresh runtime, online/offline/expired-token matrix. |
| Google sign-in | Electron uses a loopback OAuth server and PKCE exchange; unit coverage exercises error branches, but no real Google callback/consent/exchange receipt was captured. | Source and mocked tests only. | Installed app, real Google account, callback receipt, resulting Supabase session, relaunch, and account identity read-back. |
| Google provider tokens | Provider tokens are captured only on `SIGNED_IN`/`INITIAL_SESSION`; calendar calls separately require an active Supabase session and stored provider token. Token capture, persistence, refresh, and revoked-token recovery are not proven together. | Source and mocked tests only. | Real Google Calendar list/read, token expiry/refresh, revoked refresh token, reconnect, and settings persistence across relaunch. |
| Google Calendar proxy | The client sends Google tokens to the edge proxy but authenticates the proxy with the current Supabase access token; a remembered shell without a usable Supabase session will fail even if Google tokens exist. | Inferred directly from `googleCalendarService.ts:87-125`; production response not captured. | Verify edge-function auth and Google-token refresh against production without exposing tokens; classify 401/403/5xx separately. |
| Local API sidecar | The sidecar is designed to restart and receive the latest session, but no matching sidecar process appeared in the live process scan and the bridge uses best-effort fire-and-forget calls. | Live absence plus source evidence; disabled-vs-crashed state not yet distinguished. | Enable sidecar in installed app, verify process/port/health/auth context, kill child, verify restart/backoff/session replay, then query timer endpoint. |
| Data/sync state | App initialization, workspace hydration, realtime catch-up, offline queue replay, and auth recovery all touch the same stores; large cognitive-complexity hotspots increase regression risk. | Source health hints and existing matrix; broad causal repro not completed. | Build a scenario matrix covering cold start, relaunch, offline edit, refresh rotation, reconnect, cross-client mutation, and renderer restart. |
| Updater/runtime drift | Project rules require version bump, Electron build, artifact deployment, public manifest read-back, and installed-runtime proof; current audit did not perform those mutations. | Open. | Release only after focused/broad/E2E gates, fresh AppImage launch, version/provenance/checksum match, and public manifest/artifact verification. |
| Stale process/cache state | Mounted and installed runtimes coexist; diagnostics identify the mounted asset path, so source fixes can be invisible in the visible/active process. | Confirmed live. | Stop only task-owned runtimes through the existing safe lifecycle, launch exactly one installed artifact, record provenance, then repeat every visual/auth test there. |
| Test contract drift | Authenticated tests omit the newer remote-sync condition, so they silently run guest branches; the full runner can also return exit 0 with failed tests. | Confirmed in current checkout: 30 failures plus misleading exit status. | Make auth fixtures model the full state machine, make the test command fail on any failed test, and rerun focused, full, and packaged gates. |
| Canvas recovery regression | Tidy's replacement adoption rule only accepts due-dated tasks, so undated loose cards and stale-parent cards are not recovered from their visible positions. | Confirmed by 4 failing tests and direct diff. | Restore spatial containment as a separate rule, keep due-date adoption separate, and test both rendered and persisted positions. |
| Quality-gate health | Type checking is green, but lint has 427 errors/541 warnings and combined validation timed out; full unit exit code masks failures. | Confirmed. | Fix or explicitly baseline lint errors, make validation fail reliably, and publish per-gate results instead of one aggregate status. |

## Root-cause model

The recurring “different spot every time” symptom is consistent with an architectural coupling problem: independent producers can publish contradictory partial truth, and the UI often exposes a cached or remembered shell before the downstream boundary is healthy. The fix must establish explicit state ownership and evidence at every boundary, not add another retry around an individual error.

The target model is:

`single Electron owner → durable auth candidate → validated Supabase session → remote-sync gate → Google provider-token gate → sidecar session/health → renderer projection → installed/public release provenance`

Each edge needs a durable status, timestamp, generation/owner identifier, and user-visible recovery action. A null or stale intermediate value must not be interpreted as explicit sign-out, successful sync, or a healthy sidecar.

## End-to-end repair plan

### Workstream 1 — Make the runtime reproducible

1. Add an installed-runtime fixture that records executable path, app version, userData path, lock identity, PID/parent PID, sidecar PID, and renderer heartbeat owner without reading credentials.
2. Reproduce the duplicate mounted/installed launch and determine whether the lock is split by app name, userData path, packaging mode, or stale process.
3. Enforce one canonical owner and make the second launch forward/focus the existing owner or exit with a diagnostic reason.
4. Add a crash/freeze harness that distinguishes main crash, renderer crash, renderer unresponsive, hidden background launch, sidecar exit, and stale old artifact.

### Workstream 2 — Close auth ownership and recovery

1. Write failing tests for passive `SIGNED_OUT`/`INITIAL_SESSION` null events after initialization, auth-js refresh failure, late preload bridge, and concurrent refresh-token rotation.
2. Separate `explicitSignOut`, `rememberedIdentity`, `usableSession`, and `sidecarAuthContext` into explicit transitions.
3. Change sidecar clearing to occur only from the explicit sign-out transition; passive null-session recovery retains the last valid sidecar context until a bounded re-auth state is reached.
4. Make session writes serialized and generation-aware so an older runtime cannot overwrite a newer rotated session.
5. Verify cold launch, relaunch, update restart, offline expiry, online recovery, invalid refresh token, and explicit sign-out in the installed app.

### Workstream 3 — Make Google auth and provider access one tested flow

1. Add a real callback contract fixture for loopback PKCE, including callback timeout, denial, missing code, repeated callback, and port collision.
2. Verify Google OAuth provider configuration and redirect allow-list in the actual Supabase/Google deployment; do not infer this from source.
3. Persist provider-token metadata separately from Supabase session state, with explicit expiry, refresh, revoked-token, and reconnect transitions.
4. Ensure the UI distinguishes “FlowState account connected,” “Google provider connected,” and “Google Calendar proxy reachable.”
5. Run a real authenticated installed-app flow: Google consent → Supabase session → provider token capture → calendar list/events → relaunch → expiry refresh → revoked-token reconnect.

### Workstream 4 — Stabilize the sidecar and sync boundary

1. Add contract tests for renderer-to-main delivery failure, child exit, restart backoff, stale child generation, session replay, and explicit shutdown.
2. Replace silent best-effort failures with bounded diagnostic receipts: accepted, queued, delivered, rejected, or unavailable.
3. Verify the real `127.0.0.1:5577` health/timer boundary from the installed app and a KDE/client consumer.
4. Run two-client offline/reconnect and cross-client mutation tests without reload, then repeat after renderer restart and sidecar restart.

### Workstream 5 — Reduce regression surface

1. First restore the current failing contracts: make authenticated mocks provide the complete remote-sync state, make the full test command fail when tests fail, and restore spatial tidy recovery without merging it into due-date adoption.
2. Split the high-complexity auth and initialization paths around pure transition/recovery helpers without changing behavior first.
3. Add a durable regression matrix with one repro per failure class and an explicit evidence type: source, unit, package, installed runtime, authenticated, production, or updater.
4. Add a challenge acceptance item for every user-facing claim; no item passes from exit codes or telemetry alone.

### Workstream 6 — Release and prove the actual surface

1. Run focused tests, full unit tests, type-check, lint, static validation, and Electron build; record unrelated baseline failures separately.
2. Bump the Electron version, deploy artifacts, verify the public updater manifest and artifact checksums, and launch the exact installed artifact.
3. Perform headed authenticated visual proof for sign-in, reconnect, Google Calendar, sidecar health, crash recovery, and relaunch/update persistence.
4. Read back production state: updater manifest, public artifact reachability, Supabase auth/API behavior, and the installed runtime’s version/provenance.
5. Only then mark the work complete and push; missing any installed, authenticated, or production receipt keeps the task `in_progress`.

## Acceptance checklist

- [ ] One installed Electron owner is proven under repeated launch/update/crash scenarios.
- [ ] A passive auth null event cannot clear remembered account ownership or sidecar context.
- [ ] Explicit sign-out clears all account-scoped state and sidecar context exactly once.
- [ ] Supabase refresh rotation survives relaunch and concurrent-runtime prevention.
- [ ] Real Google OAuth completes in the installed app and survives relaunch.
- [ ] Google Calendar reads, refreshes, revoked-token recovery, and reconnect are proven against the real proxy.
- [ ] Sidecar restart/session replay and timer endpoint are proven from the installed runtime.
- [ ] Renderer freeze/crash classification has a reproduction and durable evidence.
- [ ] Focused, broad, package, installed, authenticated, updater, and production results are reported separately.
- [ ] Independent challenge review returns `PASS` with snapshot-bound SHA-256 evidence.

## Current confidence gate

1. **Root cause:** The broad instability is caused by competing runtime/auth/provider/sidecar state machines whose partial states are not bound to one owner and one evidence-backed lifecycle; the concrete disconnect defect is the null-session sidecar clear in `src/composables/useLocalApiBridge.ts:41-69`.
2. **HIGH / PASS for planning; not a fix claim:** The evidence is sufficient to implement the repair workstreams, but not to claim FlowState is fixed.
3. **Current implementation gate:** The checkout is not clean: 34 unit tests fail, tidy recovery regressed, lint is not green, and the full test exit code is misleading. No repair should be declared complete until these are resolved or explicitly separated as baseline.
4. **Before implementation:** Capture the duplicate-owner lock/profile cause, add the passive-null-session regression, restore spatial tidy recovery, correct the auth fixture contract, and complete the real installed Google callback and sidecar probes.
5. **Fix:** Make ownership and auth transitions explicit, preserve sidecar context through passive recovery, add Google provider-token lifecycle handling, instrument receipts, and prove the exact installed/public runtime.
6. **Side effects:** Auth changes can affect task queues, realtime, AI sync, Local API/KDE consumers, account switching, and sign-out; Google-token changes can affect Calendar/Drive; runtime ownership changes can affect updater/background launch. Every one is covered by a dedicated matrix row and must be rechecked before release.

## Challenge-loop status

The requested challenge protocol is fail-closed at this checkout: `.claude/skills/challenge/SKILL.md` and `.claude/scripts/challenge_runner.py` are absent, and no isolated read-only reviewer execution surface is available through this session. The `challenge-review` skill exists as instructions, but substituting this agent’s opinion would violate the requested protocol; the report therefore remains `in_progress` until an independent reviewer can validate a snapshot-bound evidence bundle.

## Evidence limitations

- No credentials, token files, authorization files, or raw private session contents were read.
- The Obsidian canonical vault could not be read because the active lean-ctx jail rejects its path; repository docs and live repository state were used instead, so durable-context reconciliation remains open.
- No production mutation, release deployment, updater manifest refresh, or user-account Google consent was performed during this audit.
- Existing dirty work and live FlowState processes were preserved; they are part of the observed state and must not be silently cleaned up.
