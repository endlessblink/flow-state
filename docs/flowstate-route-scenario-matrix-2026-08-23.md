# FlowState Route and Scenario Matrix

Date: 2026-08-23  
Status: `in_progress` — inventory complete; signed-out production route smoke is partially verified, while authenticated, desktop, recovery, and release gates remain open.

This is the coverage ledger for the exhaustive stability review. A route or test name is only an inventory signal. `PASS` requires an executed test with read-back evidence on the matching runtime; `NOT TESTED` means no such evidence was found; `FAIL` requires a reproducible failure and cause.

## Route inventory

| Route | Surface | Guards or special behavior | Current evidence signal | Status |
| --- | --- | --- | --- | --- |
| `/` and `/canvas` | Desktop canvas | Public route; canvas is the default | Many canvas E2E files; current installed proof open | IN PROGRESS |
| `/board` | Desktop board | Public route; shared workspace-safe | Board and sync E2E files | IN PROGRESS |
| `/calendar` | Desktop calendar | Public route; Google/local calendar paths | Calendar E2E files | IN PROGRESS |
| `/calendar-test` | VueCal calendar test surface | Public route; separate implementation | Signed-out production browser rendered `Calendar Test` and `Vue-Cal Test Calendar` | PASS (signed-out browser) |
| `/design-system` | External Storybook handoff | Opens external URL then cancels navigation | Production browser returned to `/` as designed; external Storybook handoff not independently read back | PARTIAL |
| `/tasks` | All tasks | Public route; task list and query deep links | CRUD and task E2E files | IN PROGRESS |
| `/timer` | Mobile timer | Redirects to desktop canvas on desktop | Narrow production browser rendered the timer state and `25:00 Ready` controls | PASS (signed-out mobile browser) |
| `/today` | Mobile today | Redirects to desktop canvas on desktop | Narrow production browser rendered Sunday, task filters, and the empty-day state | PASS (signed-out mobile browser) |
| `/catalog` | Catalog/all tasks | Shares AllTasksView implementation | Catalog and CRUD E2E files | IN PROGRESS |
| `/quick-sort` | Quick Sort | Redirects from mobile quick sort on desktop; personal-only in shared workspace | Quick Sort E2E files | IN PROGRESS |
| `/ai` | AI fallback/sidebar | Personal-only in shared workspace | Direct signed-out production navigation opened the visible AI assistant panel and intentionally normalized the URL to `/` | PASS (signed-out browser) |
| `/mobile-quick-sort` | Mobile Quick Sort | Redirects to Quick Sort on desktop | Narrow production browser rendered Quick Sort and its capture controls; desktop redirect also verified | PASS (signed-out mobile browser) |
| `/mobile-ai-chat` | Mobile AI chat | Redirects to AI on desktop | Narrow production browser rendered AI Chat; desktop navigation normalized to `/` with the AI assistant panel visible | PASS (signed-out browser) |
| `/mobile-calendar` | Mobile calendar | Redirects to Calendar on desktop | Narrow production browser rendered the day timeline; desktop redirect also verified | PASS (signed-out mobile browser) |
| `/focus/:taskId` | Focus task view | Personal-only; parameter validity and missing task open | Focus-related E2E signal | IN PROGRESS |
| `/lane/:laneId` | Lane view | Parameter validity and missing lane open | Lane E2E file | IN PROGRESS |
| `/today-flow` | Today Flow | Personal-only in shared workspace | Signed-out production route rendered the Today Flow shell, but also made a CSP-blocked request to `hn.algolia.com` | FAIL (CSP/runtime request) |
| `/keyboard-test` | Development keyboard fixture | Included only in development builds | No production route expected; development-only execution remains open | NOT TESTED |
| `/ai-chat` | Legacy AI alias | Redirects to `/ai` | Signed-out production navigation ended at `/` with the AI panel behavior defined by `/ai` | PASS (signed-out browser) |
| `/performance` | Performance diagnostics | Admin-only; redirects non-admin to board | Signed-out production navigation ended at `/board`, matching the non-admin guard | PASS (signed-out browser) |
| `/invite/:token` | Invite acceptance | Public route; token, expired invite, wrong account, and workspace result open | Production browser rendered `You've been invited to a workspace` for a test token; acceptance outcome remains unverified | PARTIAL |
| unknown route | Router miss | No explicit catch-all route is declared | Production browser kept `#/unknown-route` while rendering the Canvas shell | FAIL (missing 404/catch-all) |

## Live signed-out production route smoke (2026-08-23)

The isolated browser opened the real public deployment without using credentials. `/`, `/calendar`, `/tasks`, `/catalog`, `/quick-sort`, `/calendar-test`, `/focus/nonexistent`, `/lane/nonexistent`, `/invite/test-token`, and the guarded `/performance` path rendered a visible shell or expected guard/error state. Desktop navigation to `/timer`, `/today`, `/mobile-calendar`, and `/mobile-quick-sort` followed the declared desktop redirects; `/ai` and `/mobile-ai-chat` returned to `/` while opening the visible AI panel, which is the current intentional AI fallback behavior.

The same run captured three production quality issues: the Google Fonts request failed in the browser environment; startup emitted cache-scope warnings while signed out; and Today Flow attempted `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=7`, which the deployed Content Security Policy blocks. The font failure may be environment-dependent, but the cache warning and blocked Today Flow request are application/deployment findings that require classification and a fix or explicit removal of the dependency. The AI route’s URL normalization is intentional and is not counted as a defect.

The unknown-route result is not a pass: the URL remained unknown while the Canvas view stayed visible, so users receive no clear “page not found” or redirect. The invite surface renders its entry state, but token validity, acceptance, wrong-account handling, and workspace membership are still not proven.

At a narrow production viewport (`390x844`), `/today`, `/timer`, `/mobile-quick-sort`, `/mobile-ai-chat`, and `/mobile-calendar` rendered their intended mobile content while signed out. This is positive surface evidence only: task mutations, mobile persistence, offline behavior, and authenticated data remain open.

Guest authentication entry also rendered the expected sign-in, invalid-input, password-reset, sign-up, and Google-launch states. The first-run Welcome overlay and open AI panel intercepted the sidebar Sign In click until closed; this is tracked as an access-flow issue, not an authentication validation failure.

## Required state dimensions for every applicable route

| Dimension | Cases that must be exercised |
| --- | --- |
| Account | guest; remembered account while restoring; valid signed-in session; expired session; refresh failure; explicit sign-out; account switch |
| Network | online; offline before launch; offline after launch; connection loss during save; reconnect; repeated flapping; slow response; server error |
| Runtime | browser; installed Electron; duplicate launch; mounted/old artifact; renderer restart; main restart; helper-service restart; app relaunch |
| Workspace | personal workspace; shared workspace; workspace switch during load; empty workspace; unauthorized workspace; stale previous workspace data |
| Storage | empty cache; fresh cache; newer local edit; pending queue; corrupt cache; interrupted write; updater restart before queue flush |
| Screen size | desktop; narrow desktop; mobile portrait; mobile landscape; zoomed display; reduced motion where applicable |
| Release state | current source; packaged artifact; installed artifact; update available; update applied; stale service worker/chunk; public production route |

## Required action dimensions

For each surface that supports the action, test create, edit title/description, change status, complete, reopen, delete, undo, restore, move project, change due date, schedule, tag, priority, duplicate, refresh, navigate away, return, and reload. For canvas/board/calendar/quick-sort/mobile this must also cover drag, drop, reorder, group membership, collapse/expand, viewport persistence, and cross-view read-back.

## Cross-boundary scenarios

| Boundary | Required scenario | Current status |
| --- | --- | --- |
| Auth → renderer | Sign in, refresh, passive null session, explicit sign-out, relaunch | Source and focused tests; installed proof open |
| Auth → Supabase | Access-token expiry, refresh-token rotation, concurrent launch prevention, RLS scope | Source and mocked tests; live proof open |
| Auth → Local API | Session delivery, stale session, clear on sign-out only, renderer auth heartbeat | Source and unit tests; sidecar proof open |
| Renderer → Local API | Helper unavailable, child exit, backoff, replay, timer endpoint, task mutation receipt | Installed guest runtime proves health, timer, and child respawn; authenticated replay and mutation receipt remain open |
| Renderer → sync queue | Offline edit, queue persistence, reconnect drain, duplicate echo, permanent failure, rollback | E2E inventory; current unit failures open |
| Supabase → renderer | Empty response, partial response, tombstone response, workspace switch during load | Current unit failures and source risks open |
| Google OAuth → app | Consent, denial, callback timeout, port conflict, repeated callback, expired session, relaunch | Mocked/source evidence; real flow not tested |
| Google token → Calendar | List calendars, list events, expiry refresh, revoked token, proxy 401/403/5xx, settings persistence | Unit/source evidence; production not tested |
| Updater → installed app | Version bump, artifact build, manifest, download, install, relaunch, provenance read-back | Not tested in this audit |
| Crash/freeze → recovery | Renderer hang, renderer crash, main crash, hidden window, duplicate owner, helper crash, recovery screenshot/log binding | Diagnostics exist; deliberate installed repro not tested |

## Current gaps that prevent completion

- The route inventory is complete, but several routes have no executed coverage evidence.
- Credential-safe focused verification passed `97` tests across `11` files for route configuration, auth boundaries, offline fallback, mobile ordering, Quick Sort, Calendar filtering, Electron runtime/diagnostics, and updater contracts.
- Signed-out browser smoke is now executed against production, but it does not prove authenticated persistence, account switching, Google callback completion, or Calendar data access.
- Public read-back succeeded for the app homepage (`HTTP 200`), updater manifest (`HTTP 200`, version `1.4.422`, matching the package), and Google Calendar proxy reachability (`HTTP 401` without authorization, confirming the endpoint is live and auth-protected). The installed AppImage does not match the manifest’s published size or SHA-512, so update provenance is not proven. None of these proves an authenticated user flow.
- The full unit suite currently has 34 failures; type checking passes, while lint and combined validation are not green.
- Real installed Electron, Google callback/Calendar data, Local API health/session replay, updater install/relaunch, and authenticated production read-back remain unproven.
- The exact installed AppImage now starts under a virtual display and reports runtime version `1.4.420`; its Local API health and timer endpoints pass, while protected task access correctly remains unauthenticated. The package/public manifest are `1.4.422`, so installed authenticated Today synchronization, session replay, update recovery, and visual screenshot read-back remain open alongside the stale-version reconciliation.
- The requested independent challenge review is unavailable because the canonical challenge runner and isolated reviewer surface are absent.
- Source route policy review found that every currently declared application route except the admin diagnostic route is marked `requiresAuth: false`; this may be intentional for guest-first use, but it leaves no route-level enforcement proof for authenticated-only product data. The guard also allows navigation when the workspace store is not ready, so workspace-specific restrictions need an explicit post-load check rather than relying only on the initial guard.
- The Playwright auth harness has an ordering defect: `hasAuth` is computed while the config module loads, but `globalSetup` creates `tests/.auth/user.json` later. A clean first run therefore omits `storageState` and may run as guest; a later run may reuse an old snapshot. A snapshot currently exists from 2026-08-22, but its contents were not read. Authenticated E2E results are not trustworthy until the state is loaded after setup and the snapshot identity/expiry is asserted per run.

## Execution order

1. Separate the current dirty working tree from the pushed baseline and rerun the route inventory against both where behavior differs.
2. Add or run route smoke coverage for every `NOT TESTED` or `PARTIAL` row, including guard/redirect/unknown-route behavior and the AI/CSP findings above.
3. Run the state/action matrix against authenticated browser fixtures, then the installed Electron artifact.
4. Run real Google, helper-service, updater, and production read-back scenarios.
5. Re-run all failed and previously untested rows, bind each verdict to evidence, and only then update the stability report to complete.
