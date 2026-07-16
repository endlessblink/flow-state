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
    runtime.handlers.clear()
    runtime.children.length = 0
    runtime.userData = mkdtempSync(join(tmpdir(), 'flowstate-local-api-main-'))
    vi.resetModules()
  })

  afterEach(() => rmSync(sourceSidecarFixture, { force: true }))

  it('resolves renderer delivery only after the packaged child applies the exact session generation', async () => {
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    const session = {
      supabaseUrl: 'http://127.0.0.1:9999',
      anonKey: 'synthetic-anon-key',
      accessToken: 'synthetic-access-token',
      refreshToken: 'synthetic-refresh-token',
      userId: '11111111-1111-4111-8111-111111111111',
    }

    const delivery = Promise.resolve(runtime.handlers.get('localApi:setSession')?.({}, session))
    let settled = false
    void delivery.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    const child = runtime.children[0]
    expect(child).toBeDefined()
    expect(child.postMessage).not.toHaveBeenCalled()

    child.emit('message', { type: 'listening', port: 5577 })

    expect(child.postMessage).toHaveBeenCalledWith({ type: 'session', generation: 1, ...session })
    expect(settled).toBe(false)

    child.emit('message', {
      type: 'sessionApplied',
      generation: 1,
      userId: session.userId,
    })

    await expect(delivery).resolves.toEqual({
      ok: true,
      generation: 1,
      userId: session.userId,
    })
    const status = runtime.handlers.get('localApi:status')?.({})
    expect(status.hasLatestSession).toBe(true)
    expect(JSON.stringify(status)).not.toContain('synthetic-access-token')
    expect(JSON.stringify(status)).not.toContain('synthetic-refresh-token')
    shutdownLocalApi()
  })

  it('rejects stale and wrong-user acknowledgements after a newer session delivery starts', async () => {
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    const firstSession = {
      supabaseUrl: 'http://127.0.0.1:9999',
      anonKey: 'synthetic-anon-key',
      accessToken: 'first-access-token',
      refreshToken: 'first-refresh-token',
      userId: '11111111-1111-4111-8111-111111111111',
    }
    const secondSession = {
      ...firstSession,
      accessToken: 'second-access-token',
      refreshToken: 'second-refresh-token',
      userId: '22222222-2222-4222-8222-222222222222',
    }

    const firstDelivery = Promise.resolve(runtime.handlers.get('localApi:setSession')?.({}, firstSession))
    const child = runtime.children[0]
    child.emit('message', { type: 'listening', port: 5577 })
    const secondDelivery = Promise.resolve(runtime.handlers.get('localApi:setSession')?.({}, secondSession))

    await expect(firstDelivery).resolves.toEqual({ ok: false, code: 'superseded', generation: 1 })
    child.emit('message', { type: 'sessionApplied', generation: 1, userId: firstSession.userId })
    child.emit('message', { type: 'sessionApplied', generation: 2, userId: firstSession.userId })
    let secondSettled = false
    void secondDelivery.then(() => { secondSettled = true })
    await Promise.resolve()
    expect(secondSettled).toBe(false)

    child.emit('message', { type: 'sessionApplied', generation: 2, userId: secondSession.userId })
    await expect(secondDelivery).resolves.toEqual({
      ok: true,
      generation: 2,
      userId: secondSession.userId,
    })
    shutdownLocalApi()
  })

  it('fails a renderer delivery after the bounded acknowledgement timeout', async () => {
    vi.useFakeTimers()
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    const session = {
      supabaseUrl: 'http://127.0.0.1:9999',
      anonKey: 'synthetic-anon-key',
      accessToken: 'synthetic-access-token',
      refreshToken: 'synthetic-refresh-token',
      userId: '11111111-1111-4111-8111-111111111111',
    }

    const delivery = Promise.resolve(runtime.handlers.get('localApi:setSession')?.({}, session))
    await vi.advanceTimersByTimeAsync(5_001)

    await expect(delivery).resolves.toEqual({
      ok: false,
      code: 'session_apply_timeout',
      generation: 1,
    })
    shutdownLocalApi()
    vi.useRealTimers()
  })

  it('ignores a stopped child exit after a replacement child starts', async () => {
    writeFileSync(sourceSidecarFixture, '')
    const { registerLocalApiHandlers, shutdownLocalApi } = await import('../../../electron/ipc/localApi')
    registerLocalApiHandlers()
    const firstSession = {
      supabaseUrl: 'http://127.0.0.1:9999',
      anonKey: 'synthetic-anon-key',
      accessToken: 'first-access-token',
      refreshToken: 'first-refresh-token',
      userId: '11111111-1111-4111-8111-111111111111',
    }
    const secondSession = {
      ...firstSession,
      accessToken: 'second-access-token',
      refreshToken: 'second-refresh-token',
      userId: '22222222-2222-4222-8222-222222222222',
    }

    const firstDelivery = Promise.resolve(runtime.handlers.get('localApi:setSession')?.({}, firstSession))
    const firstChild = runtime.children[0]
    firstChild.emit('message', { type: 'listening', port: 5577 })
    expect(runtime.handlers.get('localApi:clearSession')?.({})).toEqual({ ok: true })
    await expect(firstDelivery).resolves.toEqual({ ok: false, code: 'superseded', generation: 1 })

    const secondDelivery = Promise.resolve(runtime.handlers.get('localApi:setSession')?.({}, secondSession))
    const secondChild = runtime.children[1]
    secondChild.emit('message', { type: 'listening', port: 5577 })
    firstChild.emit('exit', 0)
    secondChild.emit('message', {
      type: 'sessionApplied',
      generation: 2,
      userId: secondSession.userId,
    })

    await expect(secondDelivery).resolves.toEqual({
      ok: true,
      generation: 2,
      userId: secondSession.userId,
    })
    expect(runtime.handlers.get('localApi:status')?.({}).childPid).toBe(secondChild.pid)
    shutdownLocalApi()
  })
})
