import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf-8')
}

describe('Electron updater guest-mode contract', () => {
  it('keeps the Updates settings section outside authenticated account content', () => {
    const source = read('src/components/settings/tabs/AccountSettingsTab.vue')

    const authOnlyStart = source.indexOf('<template v-if="isAuthReady">')
    const authOnlyEnd = source.indexOf('<!-- Loading state while auth initializes -->')
    const updatesSection = source.indexOf('<SettingsSection v-if="showUpdater" title="Updates">')

    expect(authOnlyStart).toBeGreaterThan(-1)
    expect(authOnlyEnd).toBeGreaterThan(authOnlyStart)
    expect(updatesSection).toBeGreaterThan(authOnlyEnd)
    expect(source.slice(authOnlyStart, authOnlyEnd)).not.toContain('title="Updates"')
  })

  it('surfaces updater not-available and error events to the renderer', () => {
    const preload = read('electron/preload.ts')
    const composable = read('src/composables/useElectronUpdater.ts')

    expect(preload).toContain("ipcRenderer.on('updater:not-available'")
    expect(preload).toContain("ipcRenderer.on('updater:blocked'")
    expect(preload).toContain("updater:retry-failed")
    expect(preload).toContain("ipcRenderer.on('updater:error'")
    expect(composable).toContain('api.onUpdateNotAvailable?.')
    expect(composable).toContain('api.onUpdateBlocked?.')
    expect(composable).toContain("status.value = 'blocked'")
    expect(composable).toContain('retryFailedUpdate')
    expect(composable).toContain('api.onUpdateError?.')
    expect(composable).toContain("status.value = 'up-to-date'")
    expect(composable).toContain("status.value = 'error'")
  })

  it('passes the authoritative Electron version to update notifications', () => {
    const updater = read('electron/updater.ts')
    const composable = read('src/composables/useElectronUpdater.ts')

    expect(updater).toContain("currentVersion: appVersion")
    expect(composable).toContain('resolveCurrentVersion(info)')
    expect(composable).toContain("return typeof buildVersion === 'string' && buildVersion.trim() ? buildVersion : 'unknown'")
  })

  it('does not let updater console EPIPE writes crash the main process', () => {
    const main = read('electron/main.ts')

    expect(main).toContain('installBrokenPipeConsoleGuard')
    expect(main).toContain("code === 'EPIPE'")
    expect(main).toContain("process.on('uncaughtException'")
    expect(main).toContain("for (const method of ['log', 'info', 'warn', 'error']")
  })

  it('does not swallow updater check failures as a fake up-to-date result', () => {
    const updater = read('electron/updater.ts')
    const checkHandler = updater.slice(
      updater.indexOf("ipcMain.handle('updater:check'"),
      updater.indexOf("ipcMain.handle('updater:download'"),
    )

    expect(checkHandler).toContain('autoUpdater.checkForUpdates()')
    expect(checkHandler).toContain('throw err')
    expect(checkHandler).not.toContain('return null\n    }')
    expect(updater).toContain('autoUpdater.logger = null')
    expect(updater).toContain("ipcMain.handle('updater:retry-failed'")
    expect(updater).toContain("webContents.send('updater:blocked'")
  })
})
