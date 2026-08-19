import { autoUpdater } from 'electron-updater'
import { app, ipcMain, BrowserWindow } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import {
  pendingUpdateInfoPath,
  clearStalePendingUpdate,
  pendingAppImagePath,
  versionFromUpdateFileName,
  pendingUpdateFailureVersion,
  clearResolvedPendingUpdateFailure,
  clearObsoletePendingAppImages,
  compareVersions,
} from './updater-pending'
import { flushStore } from './ipc/store'
import {
  resumeLocalApiAfterCancelledShutdown,
  shutdownLocalApi,
} from './ipc/localApi'
import { SUPERVISED_UPDATE_EXIT_CODE, resolveUpdateRelaunch } from './supervisedUpdate'

// BUG-1874: bound the store flush, but never install/restart unless it actually succeeds. A timeout
// used to resolve the race as if persistence had completed, allowing a just-rotated single-use
// refresh token to be lost when app.exit(0) terminated the old process.
const STORE_FLUSH_TIMEOUT_MS = 5000

async function flushStoreBeforeExit(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    await Promise.race([
      flushStore(),
      new Promise<void>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Store flush before exit timed out')),
          STORE_FLUSH_TIMEOUT_MS,
        )
      }),
    ])
  } catch (err) {
    console.error('[Updater] Store flush before exit failed:', (err as Error).message)
    throw err
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function hasValidAppVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
}

function emitUpdaterError(message: string) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.send('updater:error', message)
}

async function recoverRunningAppAfterAbortedUpdate(): Promise<void> {
  let lockRecovered = false
  try {
    lockRecovered = app.requestSingleInstanceLock()
  } catch (err) {
    console.error('[Updater] Failed to reacquire the single-instance lock:', (err as Error).message)
  }
  if (!lockRecovered) {
    emitUpdaterError('FlowState could not restore its single-instance protection after the update was aborted.')
  }

  try {
    await resumeLocalApiAfterCancelledShutdown()
  } catch (err) {
    const message = 'FlowState could not restore the local task bridge after the update was aborted.'
    console.error('[Updater]', message, (err as Error).message)
    emitUpdaterError(message)
  }
}

interface PreparedAppImageInstaller {
  cancel: () => void
  isArmed: () => boolean
}

function launchDetachedAppImageInstaller(): PreparedAppImageInstaller | null {
  if (process.platform !== 'linux') return null

  const targetAppImage = process.env.APPIMAGE
  const pendingAppImage = pendingAppImagePath()
  if (!targetAppImage || !pendingAppImage) return null
  const expectedVersion = versionFromUpdateFileName(pendingAppImage)
  if (!expectedVersion) return null

  const updateInfoPath = pendingUpdateInfoPath()
  const relaunch = resolveUpdateRelaunch(process.env)
  if (relaunch.strategy === 'systemd') {
    const serviceCheck = spawnSync(
      'systemctl',
      ['--user', 'cat', 'flowstate-background.service'],
      { stdio: 'ignore' },
    )
    if (serviceCheck.error || serviceCheck.status !== 0) {
      console.error('[Updater] Supervised update preflight could not find the background service')
      return null
    }
    const restartGuard = spawnSync(
      'systemctl',
      ['--user', 'show', '--property=RestartPreventExitStatus', '--value', 'flowstate-background.service'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const guardedExitCodes = restartGuard.stdout?.trim().split(/\s+/) ?? []
    if (
      restartGuard.error ||
      restartGuard.status !== 0 ||
      !guardedExitCodes.includes(String(SUPERVISED_UPDATE_EXIT_CODE))
    ) {
      console.error('[Updater] Background service would race the supervised update handoff')
      return null
    }
  }
  // BUG-1917: the previous script ran blind (stdio ignored, no log) and clicking
  // Restart could end with the app exited, the AppImage NOT swapped, and no
  // relaunch — with zero forensic trail (pending/ kept a graveyard of 1.4.223/
  // 224/226/229 that never installed). Every step now logs to LOG, each step
  // aborts loudly on failure, and the relaunch uses the same flags as
  // FlowState-launch.sh (TASK-1871) — a bare relaunch can die on chrome-sandbox
  // SUID / GPU init and look exactly like "nothing happened".
  const script = `
LOG="$(dirname "$2")/update-install.log"
exec >> "$LOG" 2>&1
echo "=== $(date -u +%FT%TZ) installer start target=$1 pending=$2 parent=$4 ==="
target="$1"
pending="$2"
info="$3"
parent="$4"
strategy="$5"
expected_version="$6"
known_good_version="$7"
tmp="$target.flowstate-update-tmp"
backup="$target.flowstate-update-backup"
restart_supervised_on_failure() {
  if [ "$strategy" = "systemd" ]; then
    systemctl --user reset-failed flowstate-background.service || true
    systemctl --user start flowstate-background.service || true
  fi
}
cleanup_competing_flowstate_processes() {
  flowstate_pids() {
    # Keep the predicate on one awk line. The installed updater runs mawk,
    # whose parser rejects the multiline parenthesized expression generated
    # here on some releases, causing every otherwise-valid swap to roll back.
     ps -eo pid=,args= | awk -v self="$$" -v target="$target" '$1 != self && ((index($0, "/.mount_FlowSt") > 0 && index($0, "/flowstate") > 0) || index($0, target) > 0) { print $1 }'
  }
  terminate_flowstate_process_groups() {
    signal="$1"
    for pid in $(flowstate_pids); do
      pgid=$(ps -o pgid= -p "$pid" | tr -d ' ')
      if [ -n "$pgid" ] && [ "$pgid" != "1" ] && [ "$pgid" != "$$" ]; then
        kill "$signal" -- "-$pgid" 2>/dev/null || true
      fi
      # Some AppImage wrapper processes detach from their original group while
      # the mounted child is shutting down; always signal the exact PID too.
      kill "$signal" "$pid" 2>/dev/null || true
    done
  }
  terminate_flowstate_process_groups -TERM
  sleep 1
  terminate_flowstate_process_groups -KILL
}
fail_install() {
  echo "FAIL $1"
  printf '%s\\n%s\\n%s\\n' "$(basename "$pending")" "$1" "$(date -u +%FT%TZ)" > "$info.failed"
  rm -f "$tmp"
  restart_supervised_on_failure
  exit 1
}
restore_known_good() {
  echo "restoring known-good AppImage"
  if [ "$strategy" = "systemd" ]; then
    systemctl --user stop flowstate-background.service || true
  fi
  mv -f "$backup" "$target" || {
    echo "FAIL restore known-good AppImage"
    exit 1
  }
  cleanup_competing_flowstate_processes
  restart_supervised_on_failure
  if wait_for_direct_health_version "$known_good_version"; then
    echo "known-good app is already healthy after rollback"
    return 0
  fi
  if [ "$strategy" != "systemd" ]; then
    "$target" --no-sandbox --ozone-platform=x11 --disable-gpu --class=flow-state >/dev/null 2>&1 &
  fi
}
fail_after_swap() {
  echo "FAIL $1"
  printf '%s\\n%s\\n%s\\n' "$(basename "$pending")" "$1" "$(date -u +%FT%TZ)" > "$info.failed"
  restore_known_good
  exit 1
}
wait_for_supervised_health() {
  health_attempt=0
  # A cold Electron/AppImage start can take over 20 seconds while the local
  # bridge and renderer initialize; do not roll back a valid replacement too
  # early when the process is still starting normally.
  while [ "$health_attempt" -lt 300 ]; do
    if systemctl --user is-active --quiet flowstate-background.service && \
      curl -fsS http://127.0.0.1:5577/api/provenance 2>/dev/null | \
        grep -F "\"appVersion\":\"$expected_version\"" >/dev/null; then
      return 0
    fi
    health_attempt=$((health_attempt + 1))
    sleep 0.2
  done
  return 1
}
wait_for_direct_health() {
  wait_for_direct_health_version "$expected_version"
}
wait_for_direct_health_version() {
  expected_health_version="$1"
  health_attempt=0
  while [ "$health_attempt" -lt 300 ]; do
    if curl -fsS http://127.0.0.1:5577/api/provenance 2>/dev/null | \
      grep -F "\"appVersion\":\"$expected_health_version\"" >/dev/null; then
      return 0
    fi
    health_attempt=$((health_attempt + 1))
    sleep 0.2
  done
  return 1
}
i=0
while kill -0 "$parent" 2>/dev/null && [ "$i" -lt 300 ]; do
  i=$((i + 1))
  sleep 0.1
done
if kill -0 "$parent" 2>/dev/null; then
  fail_install "parent did not exit before update deadline"
fi
echo "parent gone after $i ticks"
cleanup_competing_flowstate_processes
chmod 755 "$pending" || fail_install "chmod pending"
cp -f "$pending" "$tmp" || fail_install "copy pending"
chmod 755 "$tmp" || fail_install "chmod temporary target"
if [ "$strategy" = "systemd" ]; then
  systemctl --user stop flowstate-background.service || fail_install "stop supervisor before swap"
  rm -f "$backup"
  cp -p "$target" "$backup" || fail_install "backup known-good target"
  mv -f "$tmp" "$target" || fail_after_swap "swap target"
  echo "swap complete, starting supervised replacement"
  systemctl --user reset-failed flowstate-background.service || true
  systemctl --user start flowstate-background.service || fail_after_swap "supervised restart"
  wait_for_supervised_health || fail_after_swap "supervised readiness"
  rm -f "$backup"
  rm -f "$info"
  echo "supervised replacement is healthy"
  exit 0
fi
rm -f "$backup"
cp -p "$target" "$backup" || fail_install "backup known-good target"
mv -f "$tmp" "$target" || fail_after_swap "swap target"
echo "swap complete, relaunching direct replacement"
"$target" --no-sandbox --ozone-platform=x11 --disable-gpu --class=flow-state >/dev/null 2>&1 &
replacement_pid=$!
if ! wait_for_direct_health; then
  kill "$replacement_pid" 2>/dev/null || true
  fail_after_swap "direct replacement readiness"
fi
rm -f "$backup"
rm -f "$info"
echo "direct replacement is healthy"
`

  const installerArgs = [
    '-c',
    script,
    'flowstate-appimage-install',
    targetAppImage,
    pendingAppImage,
    updateInfoPath,
    String(process.pid),
    relaunch.strategy,
    expectedVersion,
    app.getVersion(),
  ]
  const installerEnv = {
    ...process.env,
    APPIMAGE_SILENT_INSTALL: 'true',
  }

  if (relaunch.strategy === 'systemd') {
    const handoffUnit = `flowstate-update-handoff-${process.pid}-${Date.now()}`
    const handoff = spawnSync('systemd-run', [
      '--user',
      `--unit=${handoffUnit}`,
      '--collect',
      '--property=Type=exec',
      '--working-directory=/',
      '/bin/sh',
      ...installerArgs,
    ], {
      stdio: 'ignore',
      cwd: '/',
      env: installerEnv,
    })
    if (handoff.error || handoff.status !== 0) {
      console.error('[Updater] Failed to create isolated supervised update handoff')
      return null
    }
    return {
      cancel: () => {
        spawnSync('systemctl', ['--user', 'stop', handoffUnit], { stdio: 'ignore' })
      },
      isArmed: () => {
        const status = spawnSync('systemctl', ['--user', 'is-active', '--quiet', handoffUnit], {
          stdio: 'ignore',
        })
        return !status.error && status.status === 0
      },
    }
  }

  const child = spawn(
    '/bin/sh',
    installerArgs,
    {
      detached: true,
      stdio: 'ignore',
      // BUG-1917: never inherit a cwd inside the soon-to-unmount AppImage FUSE dir
      cwd: '/',
      env: installerEnv,
    },
  )
  child.once('error', (err) => {
    console.error('[Updater] Detached installer failed to spawn:', err.message)
  })
  child.unref()
  // BUG-1917: spawn failures are async, but a missing pid means the process
  // never started — fall back to electron-updater's own quitAndInstall path.
  if (!child.pid) {
    console.error('[Updater] Detached installer has no pid — falling back to quitAndInstall')
    return null
  }
  return {
    cancel: () => {
      if (!child.killed) child.kill('SIGTERM')
    },
    isArmed: () => child.exitCode === null && !child.killed,
  }
}

function prepareDetachedAppImageInstaller(): PreparedAppImageInstaller | null {
  return launchDetachedAppImageInstaller()
}

/**
 * Electron auto-updater setup.
 * Uses generic provider pointing to VPS at /updates/electron/
 * Replaces Tauri's auto-updater (SOP-037).
 */

export function registerUpdater() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const appVersion = app.getVersion()
  const canUseUpdater = !isDev && hasValidAppVersion(appVersion)
  if (!isDev && hasValidAppVersion(appVersion)) {
    try {
      if (clearResolvedPendingUpdateFailure(appVersion)) {
        console.warn('[Updater] Cleared a resolved update failure marker', { appVersion })
      }
      const stalePendingUpdate = clearStalePendingUpdate(appVersion)
      if (stalePendingUpdate.cleared) {
        console.warn('[Updater] Cleared stale pending update marker', {
          pendingVersion: stalePendingUpdate.pendingVersion ?? 'unknown',
          appVersion,
          updateInfoPath: stalePendingUpdate.updateInfoPath,
        })
      }
      const obsoletePendingAppImages = clearObsoletePendingAppImages(appVersion)
      if (obsoletePendingAppImages.length > 0) {
        console.warn('[Updater] Removed obsolete pending AppImages', { count: obsoletePendingAppImages.length })
      }
    } catch (err) {
      console.warn('[Updater] Failed to inspect pending update marker:', (err as Error).message)
    }
  }

  app.on('before-quit', () => {
    console.log('[Updater] before-quit received')
  })

  app.on('will-quit', () => {
    console.log('[Updater] will-quit received')
  })

  // BUG-1874: Electron's `app` emits this (instead of before-quit) when quitAndInstall tears the
  // app down. The authoritative flush is awaited in the updater:install handler before we reach
  // here; this is a synchronous best-effort backstop for any other quit-for-update path.
  ;(app as unknown as { on(event: 'before-quit-for-update', listener: () => void): void })
    .on('before-quit-for-update', () => {
      console.log('[Updater] before-quit-for-update received')
      void flushStoreBeforeExit().catch((err) => {
        console.error('[Updater] Update-triggered quit could not flush durable store:', (err as Error).message)
      })
    })

  // Register IPC handlers in all environments so renderer invocations don't
  // fail during local dev. In dev or unpackaged preview mode, updater actions
  // become safe no-ops.
  ipcMain.handle('updater:check', async () => {
    if (!canUseUpdater) return null

    try {
      return await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('[Updater] Check failed:', (err as Error).message)
      throw err
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (!canUseUpdater) return

    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', async () => {
    if (!canUseUpdater) return true

    // BUG-1874: flush any in-flight auth/store writes (a just-rotated refresh token) to disk
    // BEFORE we tear the process down. The AppImage path exits via app.exit(0), which bypasses
    // before-quit/will-quit, so this is the only place the flush can happen for that path.
    try {
      await flushStoreBeforeExit()
    } catch (err) {
      const message = 'Update restart aborted because FlowState could not save the current session.'
      emitUpdaterError(message)
      throw new Error(message, { cause: err })
    }

    const relaunch = resolveUpdateRelaunch(process.env)
    let preparedInstaller = prepareDetachedAppImageInstaller()
    if (relaunch.strategy === 'systemd' && !preparedInstaller) {
      const message = 'Update restart aborted because FlowState could not prepare the supervised update handoff.'
      emitUpdaterError(message)
      throw new Error(message)
    }

    try {
      await shutdownLocalApi()
    } catch (err) {
      preparedInstaller?.cancel()
      const message = 'Update restart aborted because FlowState could not safely stop the local bridge.'
      emitUpdaterError(message)
      throw new Error(message, { cause: err })
    }

    // A prepared AppImage handoff keeps the lock until this process exits; the
    // fallback updater still needs the lock released before quitAndInstall.
    if (!preparedInstaller) app.releaseSingleInstanceLock()

    // Return from IPC first, then hand off to the updater on the next tick.
    // Calling quitAndInstall() inline from an invoke handler can leave the
    // renderer stuck in a half-dead state while the app is trying to exit.
    setImmediate(async () => {
      console.log('[Updater] Starting quitAndInstall handoff')
      if (preparedInstaller && !preparedInstaller.isArmed()) {
        preparedInstaller = null
        const message = 'The prepared updater handoff stopped before FlowState could exit.'
        emitUpdaterError(message)
        if (relaunch.strategy === 'systemd') {
          // Exit normally so Restart=always brings the known-good supervised app back.
          app.exit(1)
          return
        }
      }
      if (preparedInstaller) {
        console.log('[Updater] Started detached AppImage installer handoff')
        app.exit(relaunch.exitCode === SUPERVISED_UPDATE_EXIT_CODE ? SUPERVISED_UPDATE_EXIT_CODE : 0)
        return
      }

      if (relaunch.strategy === 'systemd') {
        emitUpdaterError('The supervised updater handoff was lost; FlowState will remain open.')
        await recoverRunningAppAfterAbortedUpdate()
        return
      }

      const fallbackTimer = setTimeout(() => {
        console.error('[Updater] quitAndInstall did not terminate the app within 8s; forcing quit fallback')
        emitUpdaterError('The updater could not restart automatically. FlowState will close; reopen it manually to complete the update.')
        app.quit()
        setTimeout(() => {
          console.error('[Updater] Graceful quit fallback did not terminate the app; forcing process exit')
          app.exit(0)
        }, 2000)
      }, 8000)

      const clearFallback = () => clearTimeout(fallbackTimer)
      app.once('will-quit', clearFallback)
      app.once('quit', clearFallback)

      try {
        // Force quit: isSilent=false (show installer), isForceRunAfter=true (relaunch after)
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        clearTimeout(fallbackTimer)
        const message = (err as Error).message
        console.error('[Updater] quitAndInstall failed:', message)
        emitUpdaterError(message)
        await recoverRunningAppAfterAbortedUpdate()
      }
    })

    return true
  })

  if (!canUseUpdater) {
    if (!isDev) {
      console.warn(`[Updater] Skipping updater initialization for invalid app version: ${appVersion}`)
    }
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  // Forward events to renderer via IPC
  autoUpdater.on('update-available', (info) => {
    const blockedVersion = pendingUpdateFailureVersion()
    if (blockedVersion && compareVersions(blockedVersion, appVersion) > 0 && blockedVersion === info.version) {
      console.warn('[Updater] Suppressing a previously failed update to prevent a notification loop', {
        blockedVersion,
      })
      return
    }
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('updater:available', {
        ...info,
        currentVersion: appVersion,
      })
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:progress', progress)
  })

  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:downloaded')
  })

  autoUpdater.on('update-not-available', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:not-available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:error', err.message)
  })

  // Check shortly after launch...
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // ...and re-check periodically. Without this the app only ever checked once
  // at startup, so an update published while the app stayed open was never
  // noticed until a manual relaunch (root cause of the 1.4.45 "didn't update"
  // report). Re-check every 4 hours.
  const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, RECHECK_INTERVAL_MS)
}
