import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, () => Promise<unknown>>()
  return {
    handlers,
    flushStore: vi.fn<() => Promise<void>>(),
    shutdownLocalApi: vi.fn<() => Promise<void>>(),
    resumeLocalApiAfterCancelledShutdown: vi.fn<() => Promise<void>>(),
    releaseSingleInstanceLock: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    quitAndInstall: vi.fn(),
    exit: vi.fn(),
    quit: vi.fn(),
    send: vi.fn(),
    pendingAppImagePath: vi.fn<() => string | null>(() => null),
    spawnSync: vi.fn(),
  }
})

vi.mock('node:child_process', () => {
  const spawn = vi.fn()
  return {
    spawn,
    spawnSync: mocks.spawnSync,
    default: { spawn, spawnSync: mocks.spawnSync },
  }
})

vi.mock('../../../electron/ipc/store', () => ({
  flushStore: mocks.flushStore,
}))

vi.mock('../../../electron/ipc/localApi', () => ({
  shutdownLocalApi: mocks.shutdownLocalApi,
  resumeLocalApiAfterCancelledShutdown: mocks.resumeLocalApiAfterCancelledShutdown,
}))

vi.mock('../../../electron/updater-pending', () => ({
  clearStalePendingUpdate: vi.fn(() => ({
    cleared: false,
    pendingVersion: null,
    updateInfoPath: '/tmp/update-info.json',
  })),
  pendingUpdateInfoPath: vi.fn(() => '/tmp/update-info.json'),
  pendingAppImagePath: mocks.pendingAppImagePath,
  versionFromUpdateFileName: vi.fn((fileName: string) => {
    const match = fileName.match(/(\d+\.\d+\.\d+)/)
    return match?.[1] ?? null
  }),
}))

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.4.269'),
    on: vi.fn(),
    once: vi.fn(),
    releaseSingleInstanceLock: mocks.releaseSingleInstanceLock,
    requestSingleInstanceLock: mocks.requestSingleInstanceLock,
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
    mocks.shutdownLocalApi.mockReset()
    mocks.shutdownLocalApi.mockResolvedValue(undefined)
    mocks.resumeLocalApiAfterCancelledShutdown.mockReset()
    mocks.resumeLocalApiAfterCancelledShutdown.mockResolvedValue(undefined)
    mocks.releaseSingleInstanceLock.mockReset()
    mocks.requestSingleInstanceLock.mockReset()
    mocks.requestSingleInstanceLock.mockReturnValue(true)
    mocks.quitAndInstall.mockReset()
    mocks.exit.mockReset()
    mocks.quit.mockReset()
    mocks.send.mockReset()
    mocks.pendingAppImagePath.mockReset()
    mocks.pendingAppImagePath.mockReturnValue(null)
    mocks.spawnSync.mockReset()
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
    expect(mocks.shutdownLocalApi).not.toHaveBeenCalled()
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
    expect(mocks.shutdownLocalApi).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.exit).not.toHaveBeenCalled()
  })

  it('drains the local bridge before releasing the single-instance lock', async () => {
    mocks.flushStore.mockResolvedValueOnce(undefined)
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).resolves.toBe(true)

    expect(mocks.shutdownLocalApi).toHaveBeenCalledOnce()
    expect(mocks.releaseSingleInstanceLock).toHaveBeenCalledOnce()
    expect(mocks.shutdownLocalApi.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.releaseSingleInstanceLock.mock.invocationCallOrder[0],
    )
  })

  it('keeps the running version and lock when bridge shutdown fails', async () => {
    mocks.flushStore.mockResolvedValueOnce(undefined)
    mocks.shutdownLocalApi.mockRejectedValueOnce(new Error('bridge did not stop'))
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).rejects.toThrow('could not safely stop the local bridge')

    expect(mocks.releaseSingleInstanceLock).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.exit).not.toHaveBeenCalled()
  })

  it('keeps the supervised app and bridge running when no detached handoff can be prepared', async () => {
    vi.stubEnv('FLOWSTATE_SUPERVISED', '1')
    mocks.flushStore.mockResolvedValueOnce(undefined)
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).rejects.toThrow('could not prepare the supervised update handoff')

    expect(mocks.shutdownLocalApi).not.toHaveBeenCalled()
    expect(mocks.releaseSingleInstanceLock).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.exit).not.toHaveBeenCalled()
  })

  it('restarts the known-good supervised app when the prepared handoff dies before exit', async () => {
    vi.stubEnv('FLOWSTATE_SUPERVISED', '1')
    vi.stubEnv('APPIMAGE', '/tmp/FlowState.AppImage')
    mocks.pendingAppImagePath.mockReturnValue('/tmp/FlowState-1.4.275-x86_64.AppImage')
    mocks.spawnSync.mockImplementation((command: string, args: string[]) => {
      if (command === 'systemctl' && args.includes('cat')) return { status: 0 }
      if (command === 'systemctl' && args.includes('show')) return { status: 0, stdout: '75\n' }
      if (command === 'systemd-run') return { status: 0 }
      if (command === 'systemctl' && args.includes('is-active')) return { status: 3 }
      return { status: 0 }
    })
    mocks.flushStore.mockResolvedValueOnce(undefined)
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.shutdownLocalApi).toHaveBeenCalledOnce()
    expect(mocks.exit).toHaveBeenCalledWith(1)
    expect(mocks.exit).not.toHaveBeenCalledWith(75)
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
  })

  it('restores the bridge and single-instance lock when quitAndInstall throws', async () => {
    mocks.flushStore.mockResolvedValueOnce(undefined)
    mocks.quitAndInstall.mockImplementationOnce(() => {
      throw new Error('installer handoff failed')
    })
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.shutdownLocalApi).toHaveBeenCalledOnce()
    expect(mocks.releaseSingleInstanceLock).toHaveBeenCalledOnce()
    expect(mocks.resumeLocalApiAfterCancelledShutdown).toHaveBeenCalledOnce()
    expect(mocks.requestSingleInstanceLock).toHaveBeenCalledOnce()
    expect(mocks.exit).not.toHaveBeenCalled()
  })

  it('surfaces every failed recovery boundary after an aborted updater handoff', async () => {
    mocks.flushStore.mockResolvedValueOnce(undefined)
    mocks.requestSingleInstanceLock.mockReturnValueOnce(false)
    mocks.resumeLocalApiAfterCancelledShutdown.mockRejectedValueOnce(new Error('bridge restart failed'))
    mocks.quitAndInstall.mockImplementationOnce(() => {
      throw new Error('installer handoff failed')
    })
    const install = mocks.handlers.get('updater:install')!

    await expect(install()).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.send).toHaveBeenCalledWith(
      'updater:error',
      expect.stringContaining('single-instance protection'),
    )
    expect(mocks.send).toHaveBeenCalledWith(
      'updater:error',
      expect.stringContaining('local task bridge'),
    )
  })
})
