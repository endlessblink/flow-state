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
- Current follow-up process/port check found no running FlowState Electron process and no listener on `127.0.0.1:5577`; both helper health and timer requests failed to connect. The installed AppImage is present, but a direct `--version` probe exited before startup because this execution environment has no X server/`$DISPLAY`, so installed visual proof still requires the host runner.
- The public updater manifest is reachable at version `1.4.422`, but the installed AppImage does not match the public artifact receipt: the manifest declares `180207920` bytes and SHA-512 beginning `kBXdBD...`, while the installed file is `182832193` bytes with SHA-512 beginning `8ed81c...`. Version equality alone is therefore not provenance proof.
- A host-independent virtual-display run started the exact installed AppImage and exposed DevTools on port `9229`. Its Local API sidecar started from the packaged resource, `/api/health` returned `200 {"ok":true}`, `/api/timer/current` returned `200` with no active timer, and protected `/api/tasks` returned the expected `401 unauthorized` without a session. The installed Today sync verifier then stopped at the Catalogue Today selector because this runtime had no authenticated Today task data; this is an authentication/data gate failure, not evidence of an Electron crash.
- The installed runtime logged `[Updater] Suppressing a previously failed update ... blockedVersion: '1.4.422'`, proving persistent failed-update suppression is active and must be cleared or reconciled as part of updater recovery.
- DevTools read-back identifies the running installed runtime as `flow-state/1.4.420` while the repository package and public manifest are `1.4.422`. The installed artifact mismatch is therefore a concrete stale-installed-version problem; the failed-update suppression is the attempted but incomplete transition from `1.4.420` to `1.4.422`.
- Installed helper recovery was exercised safely: terminating the packaged child caused the Electron runtime to spawn generation `2`, keep port `5577` listening, return `200 {"ok":true}` from health, and continue returning `401 unauthorized` for protected tasks without a session. Authenticated session replay and task receipt remain unproven.
- Runtime diagnostics: repeated renderer-console entries from the mounted runtime say `No auth token available, scheduling retry`; main-health entries show the renderer route from the mounted runtime, a roughly four-second heartbeat age, and `windowVisible:false`. No renderer-crash or main-uncaught event was established from the inspected tail, so “crash” is not yet proven for this runtime; hidden/stale/duplicate ownership is proven.
- Focused verification: auth/Electron/Local API/runtime-diagnostic suites passed `100` tests across `8` files; Google Calendar integration passed `14` tests. These are source and mocked-boundary evidence, not installed-app or production proof.
- Existing project history already records incomplete live gates for remembered-auth recovery, renderer freezes, and cross-client convergence; those entries were used as leads and were not treated as current proof.

### Deep-dive verification added after the initial triage

- Full unit run: the runner returned exit `0`, but the actual summary was `3` failing files, `34` failing tests, `4,597` passing tests, and `6` skipped tests. The exit code is therefore not a trustworthy green signal in this repository.
- The `28` Smart Merge failures and both rollback failures share a concrete contract mismatch: the current dirty working tree gates remote persistence on `authStore.canSyncRemotely`, while those test doubles provide only `user` and `isAuthenticated`. They are consequently exercising guest behavior, not the authenticated path they claim to cover. This is both a test-harness defect and a release-risk signal: any production caller with a remembered user but no usable session is intentionally routed to a different data path.
- The four tidy-layout failures have a separate direct cause: the new shared adoption helper requires a due date, but the spatial recovery tests use undated loose or stale-parent tasks. The previous tidy implementation used the task's rendered position and group bounds; the replacement silently drops that behavior. This is a confirmed behavior regression in the current working tree, not an auth failure.
- Type checking completed successfully. The combined validation job did not complete within five minutes; its captured lint output contains `427` errors and `541` warnings, including three irregular-whitespace errors in a shared utility file. The validation job must not be described as passed.
- The E2E inventory contains authenticated and offline/reconnect scenarios, including real-fixture auth setup and Google-related test names, but inventory is not execution evidence. No authenticated run against the installed Electron artifact, a real Google callback, a real calendar response, or an installed updater transition was captured during this audit.
- Source review found multiple independent “continue anyway” paths around startup, cache loading, auth recovery, background refresh, realtime, Local API delivery, and Google proxy calls. They protect the UI from throwing, but several are best-effort or warning-only; the visible shell can therefore remain open while remote sync, helper access, or Google access is unavailable.
- The Local API has useful missing-auth classifications and restart machinery, but the live scan did not prove whether the sidecar was disabled, absent, crashed, or owned by another runtime. A live port/health/session-replay probe is still mandatory.
- The working tree contains unrelated user changes and an untracked adoption helper/test. All failures above were observed without cleaning or overwriting those changes; the report distinguishes current checkout behavior from the last pushed commit.
- The exhaustive route ledger is now captured separately in `docs/flowstate-route-scenario-matrix-2026-08-23.md`: 22 route patterns, six mobile views, guard/redirect cases, state dimensions, action dimensions, and cross-boundary scenarios. Signed-out desktop and narrow-mobile smoke now cover the public route surfaces, while authenticated actions and installed/Google/helper/updater gates remain open.
- Safe focused verification added `97` passing tests across `11` files. Public read-back found the homepage reachable (`HTTP 200`), the updater manifest reachable at version `1.4.422` (matching the current package), and the Google Calendar proxy reachable but correctly rejecting an unauthenticated request (`HTTP 401`).
- Isolated signed-out production browser smoke is now captured: core routes, missing-task focus, missing-lane view, invite entry, and the non-admin performance redirect rendered visible states. Google OAuth reached the Google Accounts sign-in page with the expected production callback and requested email/profile/calendar/Drive scopes; no account credentials or callback session were used.
- The live browser confirmed two route/runtime defects: an unknown hash route leaves the Canvas shell visible without a not-found state, and Today Flow attempts a request to `hn.algolia.com` that the deployed Content Security Policy blocks. The `/ai` and `/mobile-ai-chat` URL normalization is intentional: the visible AI assistant panel was present after navigation. The font-load failure and signed-out cache-scope warnings are recorded as additional production-quality findings, with the font result still requiring environment classification.
- Narrow signed-out production smoke at `390x844` rendered Today, Timer, Mobile Quick Sort, Mobile AI Chat, and Mobile Calendar content, confirming the mobile surfaces work; the AI routes intentionally open the panel and normalize their URL on desktop.
- Source tracing explains the signed-out cache warnings: startup explicitly configures a `null` pre-auth cache scope when no persisted identity/session pair exists, then still calls cached task/group/project reads and cache clearing; the cache database correctly rejects those calls with `Read cache scope is not configured`, but the startup path surfaces them as warnings.
- Guest auth-entry checks passed for validation and navigation: invalid email keeps Sign In disabled, Forgot Password opens the reset form, Back to Login returns, Sign Up opens the account form, and Google opens the provider login. The first-run Welcome overlay and the open AI panel both intercept clicks on the sidebar Sign In control until dismissed, so sign-in is reachable but not immediately discoverable from the initial shell.
- Installed-helper authorization probe passed safely: an unauthenticated `POST /api/timer/start` returned `401 {"error":"unauthorized"}`; the helper stayed healthy afterward, the current timer remained inactive, and the stale installed runtime remained reachable as `flow-state/1.4.420`. This proves guest mutation rejection and post-request stability, but not authenticated mutation, replay, or cross-view receipt.
- Route-guard source review found a broad policy gap that signed-out route smoke cannot settle: all main product routes are currently declared `requiresAuth: false`, while the global guard uses remembered identity (`isAuthenticated`) rather than validated remote-sync readiness. Workspace-specific restrictions are also skipped when the workspace store is still loading; the repair must decide and test the intended guest-first versus authenticated-only boundary, then verify it after startup and workspace switching.
- E2E authentication itself has a reproducibility defect: the Playwright config checks for the auth snapshot before global setup creates it. Clean runs can therefore omit authenticated storage, while subsequent runs can silently reuse an old snapshot; the repair must make setup and storage-state loading deterministic and assert the test user identity before any scenario runs.
- The E2E fixture is explicitly a disposable password user against a local-by-default Supabase URL, with privileged setup supplied by an environment key. This is a useful isolated fixture but cannot validate the real user’s Google callback, provider-token capture, Calendar access, or production RLS; the environment target and test identity must be printed as non-sensitive metadata and asserted before execution.
- Electron Google OAuth has a source-level reliability gap beyond credentials: the localhost callback server accepts and closes on the first request, without requiring a code or OAuth error, and its implicit-flow fallback relies on a fragment that an HTTP callback server cannot receive. The packaged-app plan must cover port collision, denial, timeout, stray request, repeated callback, PKCE exchange failure, and successful callback read-back.
- Google credential persistence is a confirmed high-severity defect: the automatic settings writer strips provider tokens, but the explicit `toSupabaseUserSettings` path writes the full settings object, including Google access/refresh token fields, to the shared user-settings record. This creates both credential exposure and cross-device token confusion; no credential contents were read during this audit, so database exposure and rotation remain mandatory manual gates.
- Existing settings tests verify the safe debounced writer only; the explicit database mapper path has no equivalent assertion that sensitive fields are absent. This explains how the unsafe path can regress independently while the focused settings-sync tests remain green.

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
| Google credential storage | The debounced settings writer strips provider credentials, but the explicit settings mapper serializes the complete settings object into shared `user_settings` JSON. | Confirmed source defect; no credential contents were read. | Remove credentials from every shared-settings and backup path, audit existing records, rotate any exposed Google credentials, and prove device-bound storage plus cross-device isolation. |
| Google Calendar proxy | The client sends Google tokens to the edge proxy but authenticates the proxy with the current Supabase access token; a remembered shell without a usable Supabase session will fail even if Google tokens exist. | Inferred directly from `googleCalendarService.ts:87-125`; production response not captured. | Verify edge-function auth and Google-token refresh against production without exposing tokens; classify 401/403/5xx separately. |
| Local API sidecar | The sidecar was absent before launch; the exact installed AppImage started it successfully, and after the child was terminated it respawned as generation `2` with port `5577` still available. Health returned `200`, while protected task access correctly returned `401` without a session. | Installed guest runtime health and child restart are proven; session replay and authenticated task receipt remain open. | Authenticate the installed app, verify session replay across child restart, then query task and timer endpoints with receipt binding. |
| Data/sync state | App initialization, workspace hydration, realtime catch-up, offline queue replay, and auth recovery all touch the same stores; large cognitive-complexity hotspots increase regression risk. | Source health hints and existing matrix; broad causal repro not completed. | Build a scenario matrix covering cold start, relaunch, offline edit, refresh rotation, reconnect, cross-client mutation, and renderer restart. |
| Updater/runtime drift | Project rules require version bump, Electron build, artifact deployment, public manifest read-back, and installed-runtime proof; the installed runtime is `1.4.420` while the package/manifest are `1.4.422`, its file size and SHA-512 do not match the published receipt, and it suppresses the failed `1.4.422` update. | Confirmed stale installed version, provenance mismatch, and failed-update suppression; runtime launch now proven under a virtual display. | Reconcile the installed artifact with the public manifest, clear/recover the failed-update state, verify size/checksum byte-for-byte, then prove update/download/relaunch behavior from `1.4.420` to `1.4.422`. |
| Stale process/cache state | Mounted and installed runtimes coexist; diagnostics identify the mounted asset path, so source fixes can be invisible in the visible/active process. | Confirmed live. | Stop only task-owned runtimes through the existing safe lifecycle, launch exactly one installed artifact, record provenance, then repeat every visual/auth test there. |
| Test contract drift | Authenticated tests omit the newer remote-sync condition, so they silently run guest branches; the full runner can also return exit 0 with failed tests. | Confirmed in current checkout: 30 failures plus misleading exit status. | Make auth fixtures model the full state machine, make the test command fail on any failed test, and rerun focused, full, and packaged gates. |
| Canvas recovery regression | Tidy's replacement adoption rule only accepts due-dated tasks, so undated loose cards and stale-parent cards are not recovered from their visible positions. | Confirmed by 4 failing tests and direct diff. | Restore spatial containment as a separate rule, keep due-date adoption separate, and test both rendered and persisted positions. |
| Quality-gate health | Type checking is green, but lint has 427 errors/541 warnings and combined validation timed out; full unit exit code masks failures. | Confirmed. | Fix or explicitly baseline lint errors, make validation fail reliably, and publish per-gate results instead of one aggregate status. |
| Guest cache startup | Signed-out startup configures no cache scope but still reads/clears scoped cache, producing repeated warnings before the public shell renders. | Confirmed in production browser and source trace. | Make guest cache handling explicit: skip scoped reads when no scope exists or assign a safe guest scope, and test cold signed-out launch plus sign-in/account-switch isolation. |
| Guest auth entry | The first-run Welcome overlay and open AI panel can intercept the visible Sign In control; after dismissal, sign-in, reset-password, sign-up, and Google entry points render and validate correctly. | Confirmed in signed-out production browser. | Provide a direct sign-in action from the first-run surface or keep the account entry control above non-blocking overlays, then recheck keyboard, mobile, and Electron entry. |
| Route fallback | Unknown hashes render the Canvas shell while preserving the unknown URL, so a user can believe navigation succeeded when no matching page exists. | Confirmed in signed-out production browser. | Add an explicit catch-all/not-found route, then verify unknown paths, stale links, and reload behavior on browser and Electron. |
| AI route delivery | `/ai` and desktop `/mobile-ai-chat` normalize to `/` after opening the visible AI assistant panel; this is the declared fallback behavior, not a broken page route. | Confirmed as intentional by source and signed-out production browser accessibility state. | Keep a regression proving panel visibility after route navigation and verify the same behavior in the installed runtime. |
| Today Flow external dependency | Today Flow requests Algolia Hacker News data, but production CSP blocks the request; the route remains visible with a partially degraded experience and console errors. | Confirmed in signed-out production browser. | Decide whether the feed is required; remove it or add an approved backend/CSP path, then verify the route with zero app-owned console errors. |

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
4. **Before implementation:** Capture the duplicate-owner lock/profile cause, add the passive-null-session regression, restore spatial tidy recovery, correct the auth fixture contract, repair the unknown-route and Today Flow findings, and complete the real installed Google callback and sidecar probes.
5. **Fix:** Make ownership and auth transitions explicit, preserve sidecar context through passive recovery, add Google provider-token lifecycle handling, instrument receipts, and prove the exact installed/public runtime.
6. **Side effects:** Auth changes can affect task queues, realtime, AI sync, Local API/KDE consumers, account switching, and sign-out; Google-token changes can affect Calendar/Drive; runtime ownership changes can affect updater/background launch. Every one is covered by a dedicated matrix row and must be rechecked before release.

## Challenge-loop status

The requested challenge protocol is fail-closed at this checkout: `.claude/skills/challenge/SKILL.md` and `.claude/scripts/challenge_runner.py` are absent, and no isolated read-only reviewer execution surface is available through this session. The `challenge-review` skill exists as instructions, but substituting this agent’s opinion would violate the requested protocol; the report therefore remains `in_progress` until an independent reviewer can validate a snapshot-bound evidence bundle.

## Evidence limitations

- No credentials, token files, authorization files, or raw private session contents were read.
- The Obsidian canonical vault could not be read because the active lean-ctx jail rejects its path; repository docs and live repository state were used instead, so durable-context reconciliation remains open.
- No production mutation, release deployment, updater manifest refresh, or user-account Google consent was performed during this audit.
- Signed-out production route smoke is real deployment evidence, but it does not prove authenticated persistence, Google callback completion, Calendar data, or cross-client sync.
- Existing dirty work and live FlowState processes were preserved; they are part of the observed state and must not be silently cleaned up.
