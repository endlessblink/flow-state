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

  it('queues the renderer session through main and replays it only after the packaged child listens', async () => {
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
    shutdownLocalApi()
  })
})
