import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  clearStalePendingUpdate,
  compareVersions,
  pendingAppImagePath,
  pendingUpdateInfoPath,
  versionFromUpdateFileName,
} from '../../electron/updater-pending'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('Electron updater restart contract', () => {
  it('parses AppImage versions from pending update metadata filenames', () => {
    expect(versionFromUpdateFileName('FlowState-1.4.146-x86_64.AppImage')).toBe('1.4.146')
    expect(versionFromUpdateFileName('FlowState_1.4.146_amd64.deb')).toBe('1.4.146')
    expect(versionFromUpdateFileName('not-a-flowstate-update')).toBeNull()
    expect(versionFromUpdateFileName(null)).toBeNull()
  })

  it('orders semantic update versions without treating build metadata as newer', () => {
    expect(compareVersions('1.4.146', '1.4.146')).toBe(0)
    expect(compareVersions('1.4.147', '1.4.146')).toBeGreaterThan(0)
    expect(compareVersions('1.4.145', '1.4.146')).toBeLessThan(0)
    expect(compareVersions('1.4.146+build.1', '1.4.146')).toBe(0)
  })

  it('clears same-version pending AppImage markers so launcher restart does not loop through install handoff', () => {
    const cacheHome = resolve(projectRoot, 'test-results/electron-updater-cache')
    const updateInfoPath = pendingUpdateInfoPath(cacheHome)
    mkdirSync(resolve(cacheHome, 'flow-state-updater/pending'), { recursive: true })
    writeFileSync(updateInfoPath, JSON.stringify({ fileName: 'FlowState-1.4.146-x86_64.AppImage' }))

    expect(existsSync(updateInfoPath)).toBe(true)

    const result = clearStalePendingUpdate('1.4.146', cacheHome)

    expect(result).toEqual({
      cleared: true,
      pendingVersion: '1.4.146',
      updateInfoPath,
    })
    expect(existsSync(updateInfoPath)).toBe(false)
  })

  it('keeps newer pending AppImage markers so real upgrades can still install', () => {
    const cacheHome = resolve(projectRoot, 'test-results/electron-updater-cache-newer')
    const updateInfoPath = pendingUpdateInfoPath(cacheHome)
    mkdirSync(resolve(cacheHome, 'flow-state-updater/pending'), { recursive: true })
    writeFileSync(updateInfoPath, JSON.stringify({ fileName: 'FlowState-1.4.147-x86_64.AppImage' }))

    const result = clearStalePendingUpdate('1.4.146', cacheHome)

    expect(result).toEqual({
      cleared: false,
      pendingVersion: '1.4.147',
      updateInfoPath,
    })
    expect(existsSync(updateInfoPath)).toBe(true)
  })

  it('resolves the pending AppImage path from updater metadata', () => {
    const cacheHome = resolve(projectRoot, 'test-results/electron-updater-cache-pending-appimage')
    const updateInfoPath = pendingUpdateInfoPath(cacheHome)
    mkdirSync(resolve(cacheHome, 'flow-state-updater/pending'), { recursive: true })
    writeFileSync(updateInfoPath, JSON.stringify({ fileName: 'FlowState-1.4.150-x86_64.AppImage' }))
    writeFileSync(resolve(cacheHome, 'flow-state-updater/pending/FlowState-1.4.150-x86_64.AppImage'), 'appimage')

    expect(pendingAppImagePath(cacheHome)).toBe(
      resolve(cacheHome, 'flow-state-updater/pending/FlowState-1.4.150-x86_64.AppImage'),
    )
  })

  it('does not leave stale pending AppImage update metadata unhandled', () => {
    const updaterSource = readSource('electron/updater.ts')
    const pendingSource = readSource('electron/updater-pending.ts')

    expect(pendingSource).toContain('flow-state-updater')
    expect(pendingSource).toContain('pending')
    expect(pendingSource).toContain('update-info.json')
    expect(updaterSource).toContain("from './updater-pending'")
    expect(updaterSource).toContain('const stalePendingUpdate = clearStalePendingUpdate(appVersion)')
    expect(updaterSource).toContain('stalePendingUpdate.cleared')
  })

  it('returns from IPC before install handoff and has a bounded quit fallback', () => {
    const updaterSource = readSource('electron/updater.ts')

    expect(updaterSource).toContain("ipcMain.handle('updater:install', async () => {")
    // BUG-1874: in-flight auth/store writes are flushed to disk BEFORE the handoff/exit,
    // and that flush happens before the single-instance lock is released.
    expect(updaterSource).toContain('await flushStoreBeforeExit()')
    expect(updaterSource.indexOf('await flushStoreBeforeExit()')).toBeLessThan(
      updaterSource.indexOf('app.releaseSingleInstanceLock()'),
    )
    expect(updaterSource).toContain('app.releaseSingleInstanceLock()')
    expect(updaterSource).toContain('setImmediate(() => {')
    expect(updaterSource).toContain('autoUpdater.quitAndInstall(false, true)')
    expect(updaterSource).toContain('quitAndInstall did not terminate the app within 8s')
    expect(updaterSource).toContain('app.quit()')
    expect(updaterSource).toContain('app.exit(0)')
    expect(updaterSource).toContain('return true')
  })

  it('aborts update installation when durable auth storage cannot be flushed', () => {
    const updaterSource = readSource('electron/updater.ts')
    const installHandlerStart = updaterSource.indexOf("ipcMain.handle('updater:install'")
    const releaseLockIndex = updaterSource.indexOf('app.releaseSingleInstanceLock()', installHandlerStart)
    const installHandler = updaterSource.slice(
      installHandlerStart,
      releaseLockIndex + 'app.releaseSingleInstanceLock()'.length,
    )

    expect(updaterSource).toContain('Store flush before exit timed out')
    expect(updaterSource).toContain('Store flush before exit failed')
    expect(installHandler).toContain('await flushStoreBeforeExit()')
    expect(installHandler).toContain('throw new Error')
    expect(installHandler.indexOf('await flushStoreBeforeExit()')).toBeLessThan(
      installHandler.indexOf('app.releaseSingleInstanceLock()'),
    )
    expect(installHandler.indexOf('throw new Error')).toBeLessThan(
      installHandler.indexOf('app.releaseSingleInstanceLock()'),
    )
  })

  it('waits for the durable store before every ordinary app quit', () => {
    const mainSource = readSource('electron/main.ts')
    const beforeQuitHandler = mainSource.slice(
      mainSource.indexOf("app.on('before-quit'"),
      mainSource.indexOf("app.on('window-all-closed'"),
    )

    expect(mainSource).toContain("import { registerStoreHandlers, flushStore } from './ipc/store'")
    expect(beforeQuitHandler).toContain('event.preventDefault()')
    expect(beforeQuitHandler).toContain('flushStore(),')
    expect(beforeQuitHandler).toContain('app.quit()')
    expect(beforeQuitHandler.indexOf('event.preventDefault()')).toBeLessThan(
      beforeQuitHandler.indexOf('flushStore(),'),
    )
    expect(beforeQuitHandler.indexOf('await flushStore()')).toBeLessThan(
      beforeQuitHandler.indexOf('app.quit()'),
    )
  })

  it('uses a detached AppImage installer before falling back to quitAndInstall', () => {
    const updaterSource = readSource('electron/updater.ts')

    expect(updaterSource).toContain('function launchDetachedAppImageInstaller()')
    expect(updaterSource).toContain('pendingAppImagePath()')
    expect(updaterSource).toContain("spawn(\n    '/bin/sh'")
    expect(updaterSource).toContain('Started detached AppImage installer handoff')
    expect(updaterSource).toContain('launchDetachedAppImageInstaller()')
    expect(updaterSource.indexOf('launchDetachedAppImageInstaller()')).toBeLessThan(
      updaterSource.indexOf('autoUpdater.quitAndInstall(false, true)'),
    )
  })

  it('keeps the restart fallback armed until the app is actually quitting', () => {
    const updaterSource = readSource('electron/updater.ts')

    expect(updaterSource).toContain("app.once('will-quit', clearFallback)")
    expect(updaterSource).toContain("app.once('quit', clearFallback)")
    expect(updaterSource).not.toContain("app.once('before-quit', () => clearTimeout(fallbackTimer))")
  })

  it('surfaces a renderer error when restart does not complete', () => {
    const composableSource = readSource('src/composables/useElectronUpdater.ts')

    expect(composableSource).toContain("| 'installing'")
    expect(composableSource).toContain("status.value = 'installing'")
    expect(composableSource).toContain('Restart did not complete automatically')
    expect(composableSource).toContain('}, 10_000)')
    expect(composableSource).not.toContain('Auth flush before install failed (continuing)')
    expect(composableSource.indexOf('await flushAuthForUpdate()')).toBeLessThan(
      composableSource.indexOf('await api.installUpdate()'),
    )
  })
})
