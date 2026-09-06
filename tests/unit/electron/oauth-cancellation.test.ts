import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, createServerMock } = vi.hoisted(() => ({
  handlers: new Map<string, () => Promise<unknown>>(),
  createServerMock: vi.fn(),
}))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: () => Promise<unknown>) => handlers.set(name, handler) } }))
vi.mock('http', () => ({ createServer: createServerMock, default: { createServer: createServerMock } }))
import { registerOAuthHandlers } from '../../../electron/ipc/oauth'

describe('Electron OAuth main process cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    createServerMock.mockImplementation(() => Object.assign(new EventEmitter(), {
      listen: vi.fn((_port: number, _host: string, ready: () => void) => ready()),
      close: vi.fn(),
    }))
    registerOAuthHandlers()
  })
  afterEach(async () => {
    await handlers.get('oauth:cancel')?.()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('rejects the waiter immediately on cancellation and clears its timeout', async () => {
    await handlers.get('oauth:start')!()
    let settled = false
    const outcome = handlers.get('oauth:waitForCallback')!().catch(error => { settled = true; return error })
    await handlers.get('oauth:cancel')!()
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(true)
    expect(await outcome).toEqual(expect.objectContaining({ message: expect.stringMatching(/cancel/i) }))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cannot let a cancelled waiter timeout erase a newer server', async () => {
    await handlers.get('oauth:start')!()
    void handlers.get('oauth:waitForCallback')!().catch(() => undefined)
    await handlers.get('oauth:cancel')!()
    await handlers.get('oauth:start')!()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    const callback = handlers.get('oauth:waitForCallback')!()
    const server = createServerMock.mock.results.at(-1)!.value
    server.emit('request', { url: '/?code=test-code' }, { writeHead: vi.fn(), end: vi.fn() })
    await expect(callback).resolves.toBe('http://127.0.0.1/?code=test-code')
  })
})
