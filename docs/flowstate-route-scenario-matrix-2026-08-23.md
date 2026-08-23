# FlowState Route and Scenario Matrix

Date: 2026-08-23  
Status: `in_progress` — inventory complete; execution and live proof remain open.

This is the coverage ledger for the exhaustive stability review. A route or test name is only an inventory signal. `PASS` requires an executed test with read-back evidence on the matching runtime; `NOT TESTED` means no such evidence was found; `FAIL` requires a reproducible failure and cause.

## Route inventory

| Route | Surface | Guards or special behavior | Current evidence signal | Status |
| --- | --- | --- | --- | --- |
| `/` and `/canvas` | Desktop canvas | Public route; canvas is the default | Many canvas E2E files; current installed proof open | IN PROGRESS |
| `/board` | Desktop board | Public route; shared workspace-safe | Board and sync E2E files | IN PROGRESS |
| `/calendar` | Desktop calendar | Public route; Google/local calendar paths | Calendar E2E files | IN PROGRESS |
| `/calendar-test` | VueCal calendar test surface | Public route; separate implementation | No matching E2E evidence found | NOT TESTED |
| `/design-system` | External Storybook handoff | Opens external URL then cancels navigation | Source only | NOT TESTED |
| `/tasks` | All tasks | Public route; task list and query deep links | CRUD and task E2E files | IN PROGRESS |
| `/timer` | Mobile timer | Redirects to desktop canvas on desktop | Mobile timer E2E files | IN PROGRESS |
| `/today` | Mobile today | Redirects to desktop canvas on desktop | Mobile today E2E files | IN PROGRESS |
| `/catalog` | Catalog/all tasks | Shares AllTasksView implementation | Catalog and CRUD E2E files | IN PROGRESS |
| `/quick-sort` | Quick Sort | Redirects from mobile quick sort on desktop; personal-only in shared workspace | Quick Sort E2E files | IN PROGRESS |
| `/ai` | AI fallback/sidebar | Personal-only in shared workspace | AI E2E files | IN PROGRESS |
| `/mobile-quick-sort` | Mobile Quick Sort | Redirects to Quick Sort on desktop | One mobile E2E signal | IN PROGRESS |
| `/mobile-ai-chat` | Mobile AI chat | Redirects to AI on desktop | No matching E2E evidence found | NOT TESTED |
| `/mobile-calendar` | Mobile calendar | Redirects to Calendar on desktop | Mobile calendar E2E files | IN PROGRESS |
| `/focus/:taskId` | Focus task view | Personal-only; parameter validity and missing task open | Focus-related E2E signal | IN PROGRESS |
| `/lane/:laneId` | Lane view | Parameter validity and missing lane open | Lane E2E file | IN PROGRESS |
| `/today-flow` | Today Flow | Personal-only in shared workspace | One E2E signal | IN PROGRESS |
| `/keyboard-test` | Development keyboard fixture | Included only in development builds | No E2E evidence found | NOT TESTED |
| `/ai-chat` | Legacy AI alias | Redirects to `/ai` | Redirect source only | NOT TESTED |
| `/performance` | Performance diagnostics | Admin-only; redirects non-admin to board | Performance E2E signal | IN PROGRESS |
| `/invite/:token` | Invite acceptance | Public route; token, expired invite, wrong account, and workspace result open | No matching E2E evidence found | NOT TESTED |
| unknown route | Router miss | No explicit catch-all route is declared | Source only; visible fallback not proven | NOT TESTED |

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
| Renderer → Local API | Helper unavailable, child exit, backoff, replay, timer endpoint, task mutation receipt | Unit tests; live endpoint proof open |
| Renderer → sync queue | Offline edit, queue persistence, reconnect drain, duplicate echo, permanent failure, rollback | E2E inventory; current unit failures open |
| Supabase → renderer | Empty response, partial response, tombstone response, workspace switch during load | Current unit failures and source risks open |
| Google OAuth → app | Consent, denial, callback timeout, port conflict, repeated callback, expired session, relaunch | Mocked/source evidence; real flow not tested |
| Google token → Calendar | List calendars, list events, expiry refresh, revoked token, proxy 401/403/5xx, settings persistence | Unit/source evidence; production not tested |
| Updater → installed app | Version bump, artifact build, manifest, download, install, relaunch, provenance read-back | Not tested in this audit |
| Crash/freeze → recovery | Renderer hang, renderer crash, main crash, hidden window, duplicate owner, helper crash, recovery screenshot/log binding | Diagnostics exist; deliberate installed repro not tested |

## Current gaps that prevent completion

- The route inventory is complete, but several routes have no executed coverage evidence.
- The full unit suite currently has 34 failures; type checking passes, while lint and combined validation are not green.
- Real installed Electron, Google OAuth/Calendar, Local API health/session replay, updater, and production read-back remain unproven.
- The requested independent challenge review is unavailable because the canonical challenge runner and isolated reviewer surface are absent.

## Execution order

1. Separate the current dirty working tree from the pushed baseline and rerun the route inventory against both where behavior differs.
2. Add or run route smoke coverage for every `NOT TESTED` row, including guard/redirect/unknown-route behavior.
3. Run the state/action matrix against authenticated browser fixtures, then the installed Electron artifact.
4. Run real Google, helper-service, updater, and production read-back scenarios.
5. Re-run all failed and previously untested rows, bind each verdict to evidence, and only then update the stability report to complete.
