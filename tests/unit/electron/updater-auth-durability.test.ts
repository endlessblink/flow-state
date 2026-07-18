import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, () => Promise<unknown>>()
  return {
    handlers,
    flushStore: vi.fn<() => Promise<void>>(),
    releaseSingleInstanceLock: vi.fn(),
    quitAndInstall: vi.fn(),
    exit: vi.fn(),
    quit: vi.fn(),
    send: vi.fn(),
  }
})

vi.mock('../../../electron/ipc/store', () => ({
  flushStore: mocks.flushStore,
}))

vi.mock('../../../electron/updater-pending', () => ({
  clearStalePendingUpdate: vi.fn(() => ({
    cleared: false,
    pendingVersion: null,
    updateInfoPath: '/tmp/update-info.json',
  })),
  pendingUpdateInfoPath: vi.fn(() => '/tmp/update-info.json'),
  pendingAppImagePath: vi.fn(() => null),
}))

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.4.269'),
    on: vi.fn(),
    once: vi.fn(),
    releaseSingleInstanceLock: mocks.releaseSingleInstanceLock,
    exit: mocks.exit,
    quit: mocks.quit,
  },
  ipcMain: {
    handle: vi.fn((name: string, handler: () => Promise<unknown>) => {
      mocks.handlers.set(name, handler)
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ webContents: { send: mocks.send } }]),
  },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn(async () => null),
    downloadUpdate: vi.fn(async () => undefined),
    quitAndInstall: mocks.quitAndInstall,
    on: vi.fn(),
  },
}))

import { registerUpdater } from '../../../electron/updater'

describe('Electron updater durable-auth gate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_DEV_SERVER_URL', '')
    mocks.handlers.clear()
    mocks.flushStore.mockReset()
    mocks.releaseSingleInstanceLock.mockReset()
    mocks.quitAndInstall.mockReset()
    mocks.exit.mockReset()
    mocks.quit.mockReset()
    mocks.send.mockReset()
    registerUpdater()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('does not release the lock or restart when the durable store rejects its flush', async () => {
    mocks.flushStore.mockRejectedValueOnce(new Error('disk unavailable'))
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).rejects.toThrow('could not save the current session')

    expect(mocks.releaseSingleInstanceLock).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.exit).not.toHaveBeenCalled()
    expect(mocks.send).toHaveBeenCalledWith(
      'updater:error',
      expect.stringContaining('could not save the current session'),
    )
  })

  it('does not release the lock or restart when the durable store flush times out', async () => {
    mocks.flushStore.mockReturnValueOnce(new Promise<void>(() => {}))
    const install = mocks.handlers.get('updater:install')!
    const result = expect(install()).rejects.toThrow('could not save the current session')

    await vi.advanceTimersByTimeAsync(5_001)
    await result

    expect(mocks.releaseSingleInstanceLock).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.exit).not.toHaveBeenCalled()
  })
})
