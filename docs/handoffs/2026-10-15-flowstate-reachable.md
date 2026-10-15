# FlowState reachable for the Desk without opening the app — 2026-10-15

TASK-2114 (+ BUG-2115 found on the way). Electron **1.4.574** is live on the updater feed
(`/updates/electron/latest-linux.yml` → 1.4.574, AppImage HTTP 200) and installed on this PC.

## What failed

15.10 09:11: the Freelance Desk planning read got "Connection refused" on the Local Task API
(127.0.0.1:5577), because the API only exists while the Electron app runs. Every time FlowState
was closed, the Desk showed "FLOWSTATE: NOT CHECKED".

## Noam's spec

- 09:14: "צריך להיות לה תהליך שתמיד מפועל ברקע ולא לוקח הרבה משאבים במערכת (כמו משהו ב taskbar)
  שאפשר לסגור ידנית אם צריך אבל שנגיש לך תמיד עד שאני סוגר אותו ואז נגיש לך שוב בריסטארט"
- 09:42: "כן, לאחד": one tray icon. The existing PomoFlow panel widget keeps FlowState running.
  The app shows no tray icon of its own (the first build's separate icon, a default "P", was removed).

## The chosen fix and why

The smallest safe fix reuses what was already there. The always-on supervised service
(TASK-1968, `flowstate-background.service`) existed but was disabled, and it started a visible window.

- **At login**, the service now starts FlowState hidden (`--background`): no window, no extra
  tray icon, and the Local API is up. It's enabled under `graphical-session.target`. The PomoFlow
  widget also starts the service when it loads. That's a no-op if it's already running, and it
  never restarts the app after a manual Quit.
- **Closing the window** only hides it. The API stays up.
- **One control: the PomoFlow widget.** Right-click gives "Open FlowState" (shows the running
  instance through the launcher; TASK-1871 flags `--no-sandbox --ozone-platform=x11
  --disable-gpu` kept) and "Quit FlowState (stops the background app)".
- **Quit** runs `FlowState-launch.sh --quit`, which reaches the running instance over the
  single-instance channel and runs the durable quit path: store flush, Local API shutdown, exit 0.
  `--quit` never starts the app when nothing is running. The service's `Restart=on-failure`
  leaves it stopped until the next login.
- **Logout/stop** (`ExecStop`) uses the same `--quit` and waits for the exit. Before this, the
  stop signal hit the AppImage runtime and the app died with SIGBUS, without a flush.
- If FlowState is closed, the Desk still says NOT CHECKED plainly. No silent gap.

## Resource cost (Noam asked for low resources)

The always-on app first used **~100-115% of one core** while idle. Visible windows were the same:
a pre-existing problem, now always running. Fixed under BUG-2115:

1. Shared Canvas order sections were a lazy computed, re-evaluated ~84 times a second during task
   reloads (each pass re-sorted every date bucket). It's now a batched watcher plus a cached map.
2. The authoritative reload replaced every task object even when nothing changed. Unchanged tasks
   are now kept.
3. The reload rewrote the whole offline task cache every 15s (~7 MB written per 20s). Unchanged
   reloads now skip the write.
4. The 15s projection backstop now backs off to 60s while the window is unfocused or hidden.
   Focus still reloads at once.
5. The sync queue's 5s pass, and the queue stats, ran several status-index scans on an **empty**
   queue. LevelDB tombstones made each scan 60-700 ms. An instant primary-store count now
   short-circuits them.

**Measured on the installed final build, hidden, idle, settled (3 min sample):
total ~6.9% of one core (main 4.3%, page 1.7%), ~505 MB.**
Disk writes are ~0 at idle (they were ~7 MB per 20s).

## Proof (all run by the agent, read-only against the live API)

| Check | Result |
|---|---|
| App closed → API | `Connection refused`; Desk preflight: `FLOWSTATE: NOT CHECKED (URLError)` |
| Login path (panel restart → widget starts the service) | `/api/health` 200, service active, process has `--background`, 0 visible windows, no widget load errors |
| One tray icon | FlowState app tray icons registered: 0; the PomoFlow widget is the only control |
| Desk read (`python3 scripts/plan_preflight.py --days 1`) | `FlowState read live`; no FLOWSTATE NOT CHECKED line |
| Open FlowState (widget command) | Window shown at 1400x900; closing it hides it, same PID, health still 200 |
| Quit FlowState (widget command) | App gone in ~1s, still closed after 15s, service `Result=success`, exit status 0, API refused |
| Logout/stop | `systemctl --user stop` took 1.4s, `Result=success`, exit 0 (was SIGBUS before) |
| Tests | Full unit suite 445 files / 5073 passed (3 skipped); type-check clean; new regressions for each fix fail on the old code |

## Not covered or still open

- Not tested: a real logout/login or reboot. The login path was proven through a panel restart
  plus the service being enabled under `graphical-session.target`.
- While FlowState is hidden, the renderer still holds ~500 MB. Reducing memory would need a
  lighter background mode. Not attempted.
- Each authoritative reload (now every 60s while unfocused) still reads the offline task cache.
- `--quit` sent when nothing is running briefly launches and exits a second Electron process (~1s).
- Web PWA: the renderer performance fixes reach the web build when this branch merges to main
  (CI deploy). This release shipped Electron only.

## Files

`electron/main.ts`, `infra/electron-background/flowstate-background.service`,
`packages/kde-widget/contents/ui/main.qml`, `src/stores/canvas.ts`,
`src/stores/tasks/taskPersistence.ts`, `src/composables/app/useAppInitialization.ts`,
`src/composables/sync/useSyncOrchestrator.ts`, `src/services/offline/writeQueueDB.ts`, plus tests.
Branch `feat/tray-background-20261015` (worktree off `origin/main`).
