import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sourceSidecarFixture = join(process.cwd(), 'electron', 'local-api-server.cjs')

const runtime = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  children: [] as Array<EventEmitter & { pid: number; postMessage: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }>,
  userData: '',
}))

const session = {
  supabaseUrl: 'http://127.0.0.1:9999',
  anonKey: 'synthetic-anon-key',
  accessToken: 'synthetic-access-token',
  refreshToken: 'synthetic-refresh-token',
  userId: '11111111-1111-4111-8111-111111111111',
}

vi.mock('electron', () => ({
  app: {
    getPath: () => runtime.userData,
    getVersion: () => '1.4.260',
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {
    handle: (channel: string, handler: (...args: any[]) => any) => runtime.handlers.set(channel, handler),
  },
  utilityProcess: {
    fork: () => {
      const child = Object.assign(new EventEmitter(), {
        pid: 9000 + runtime.children.length,
        postMessage: vi.fn(),
        kill: vi.fn(),
      })
      runtime.children.push(child)
      return child
    },
  },
}))

describe('Electron Local API session replay runtime', () => {
  beforeEach(() => {
    vi.useRealTimers()
    runtime.handlers.clear()
    runtime.children.length = 0
    runtime.userData = mkdtempSync(join(tmpdir(), 'flowstate-local-api-main-'))
    vi.resetModules()
  })

  afterEach(() => rmSync(sourceSidecarFixture, { force: true }))

  it('queues the renderer session through main and replays it only after the packaged child listens', async () => {
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()

    expect(runtime.handlers.get('localApi:setSession')?.({}, session)).toEqual({ ok: true })
    const child = runtime.children[0]
    expect(child).toBeDefined()
    expect(child.postMessage).not.toHaveBeenCalled()

    child.emit('message', { type: 'listening', port: 5577 })

    expect(child.postMessage).toHaveBeenCalledWith({ type: 'session', ...session })
    const status = runtime.handlers.get('localApi:status')?.({})
    expect(status.hasLatestSession).toBe(true)
    expect(JSON.stringify(status)).not.toContain('synthetic-access-token')
    expect(JSON.stringify(status)).not.toContain('synthetic-refresh-token')
    const shutdown = shutdownLocalApi()
    child.emit('exit', 0, null)
    await shutdown
  })

  it('waits for the stopping child to exit before forking one coalesced replacement', async () => {
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()

    runtime.handlers.get('localApi:setSession')?.({}, session)
    const first = runtime.children[0]
    expect(first).toBeDefined()
    await Promise.resolve()

    runtime.handlers.get('localApi:clearSession')?.({})
    expect(first.kill).toHaveBeenCalledOnce()

    runtime.handlers.get('localApi:setSession')?.({}, session)
    runtime.handlers.get('localApi:setTimerSnapshot')?.({}, { active: false, updatedAt: Date.now(), session: null })
    runtime.handlers.get('localApi:setEnabled')?.({}, true)
    expect(runtime.children).toHaveLength(1)

    first.emit('exit', 0, null)
    await Promise.resolve()

    expect(runtime.children).toHaveLength(2)
    const replacement = runtime.children[1]
    first.emit('exit', 0, null)
    expect(runtime.handlers.get('localApi:status')?.({}).childPid).toBe(replacement.pid)

    const shutdown = shutdownLocalApi()
    replacement.emit('exit', 0, null)
    await shutdown
  })

  it('restarts unexpected exits with backoff bounded at five seconds while still desired', async () => {
    vi.useFakeTimers()
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    runtime.handlers.get('localApi:setSession')?.({}, session)

    for (let crash = 0; crash < 8; crash += 1) {
      const current = runtime.children[crash]
      expect(current).toBeDefined()
      current.emit('exit', 1, null)
      expect(runtime.children).toHaveLength(crash + 1)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(runtime.children).toHaveLength(crash + 2)
    }

    const finalChild = runtime.children.at(-1)!
    const shutdown = shutdownLocalApi()
    finalChild.emit('exit', 0, null)
    await shutdown
  })

  it('coalesces start triggers without bypassing an unexpected-exit backoff', async () => {
    vi.useFakeTimers()
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    runtime.handlers.get('localApi:setSession')?.({}, session)

    runtime.children[0].emit('exit', 1, null)
    runtime.handlers.get('localApi:setSession')?.({}, session)
    runtime.handlers.get('localApi:setTimerSnapshot')?.({}, { active: false, updatedAt: Date.now(), session: null })

    await vi.advanceTimersByTimeAsync(99)
    expect(runtime.children).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(runtime.children).toHaveLength(2)

    const replacement = runtime.children[1]
    const shutdown = shutdownLocalApi()
    replacement.emit('exit', 0, null)
    await shutdown
  })

  it('final shutdown rejects new starts and resolves only after the child exits', async () => {
    vi.useFakeTimers()
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    runtime.handlers.get('localApi:setSession')?.({}, session)
    const child = runtime.children[0]

    let settled = false
    const shutdown = shutdownLocalApi().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(child.kill).toHaveBeenCalledOnce()
    expect(settled).toBe(false)

    runtime.handlers.get('localApi:setSession')?.({}, session)
    child.emit('exit', 0, null)
    await shutdown
    await vi.runAllTimersAsync()

    expect(settled).toBe(true)
    expect(runtime.children).toHaveLength(1)
  })

  it('final shutdown cancels an unexpected-exit restart that is already pending', async () => {
    vi.useFakeTimers()
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    runtime.handlers.get('localApi:setSession')?.({}, session)

    runtime.children[0].emit('exit', 1, null)
    expect(vi.getTimerCount()).toBe(1)

    await shutdownLocalApi()
    await vi.runAllTimersAsync()

    expect(runtime.children).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds final shutdown when a killed child never emits exit', async () => {
    vi.useFakeTimers()
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    runtime.handlers.get('localApi:setSession')?.({}, session)
    const child = runtime.children[0]

    let settled = false
    const shutdown = shutdownLocalApi().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(child.kill).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(4_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await shutdown

    expect(settled).toBe(true)
    expect(runtime.children).toHaveLength(1)
  })
})
