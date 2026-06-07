import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('Electron updater restart contract', () => {
  it('does not leave stale pending AppImage update metadata unhandled', () => {
    const updaterSource = readSource('electron/updater.ts')

    expect(updaterSource).toContain('flow-state-updater')
    expect(updaterSource).toContain('pending')
    expect(updaterSource).toContain('update-info.json')
    expect(updaterSource).toContain('clearStalePendingUpdate(appVersion)')
    expect(updaterSource).toContain('compareVersions(pendingVersion, appVersion) <= 0')
    expect(updaterSource).toContain('rmSync(updateInfoPath, { force: true })')
  })

  it('returns from IPC before install handoff and has a bounded quit fallback', () => {
    const updaterSource = readSource('electron/updater.ts')

    expect(updaterSource).toContain("ipcMain.handle('updater:install', () => {")
    expect(updaterSource).toContain('app.releaseSingleInstanceLock()')
    expect(updaterSource).toContain('setImmediate(() => {')
    expect(updaterSource).toContain('autoUpdater.quitAndInstall(false, true)')
    expect(updaterSource).toContain('quitAndInstall did not terminate the app within 8s')
    expect(updaterSource).toContain('app.quit()')
    expect(updaterSource).toContain('return true')
  })

  it('surfaces a renderer error when restart does not complete', () => {
    const composableSource = readSource('src/composables/useElectronUpdater.ts')

    expect(composableSource).toContain("| 'installing'")
    expect(composableSource).toContain("status.value = 'installing'")
    expect(composableSource).toContain('Restart did not complete automatically')
    expect(composableSource).toContain('}, 10_000)')
  })
})
