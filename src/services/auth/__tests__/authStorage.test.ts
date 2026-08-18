import { describe, it, expect,  afterEach, vi } from 'vitest'
import { createLazyAuthStorage } from '../authStorage'

/**
 * BUG-1874: the storage backend must be resolved at CALL TIME. If it were frozen at module-eval
 * and the preload bridge appeared late, the session would go to volatile localStorage and be
 * lost on the next launch ("signed out after update").
 */
describe('createLazyAuthStorage — call-time backend resolution (BUG-1874)', () => {
  const realUA = navigator.userAgent
  const realWindowProcess = (window as any).process

  afterEach(() => {
    delete (window as any).electronAPI
    if (realWindowProcess === undefined) {
      delete (window as any).process
    } else {
      (window as any).process = realWindowProcess
    }
    Object.defineProperty(navigator, 'userAgent', { value: realUA, configurable: true })
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('uses localStorage when there is no Electron bridge (web/PWA)', async () => {
    const storage = createLazyAuthStorage()!
    await storage.setItem('flowstate-supabase-auth', 'web-token')
    expect(localStorage.getItem('flowstate-supabase-auth')).toBe('web-token')
    expect(await storage.getItem('flowstate-supabase-auth')).toBe('web-token')
  })

  it('routes to the Electron IPC store when the bridge is present at CALL time (even if absent at adapter creation)', async () => {
    // Adapter created BEFORE the preload bridge exists — the original module-eval bug.
    const storage = createLazyAuthStorage()!

    // Bridge injected later (preload contextBridge after first render).
    const store: Record<string, unknown> = {}
    ;(window as any).electronAPI = {
      isElectron: true,
      storeGet: vi.fn(async (k: string) => store[k] ?? null),
      storeSet: vi.fn(async (k: string, v: unknown) => { store[k] = v }),
    }

    await storage.setItem('flowstate-supabase-auth', 'electron-token')
    // Went to the IPC store, NOT localStorage.
    expect((window as any).electronAPI.storeSet).toHaveBeenCalledWith('flowstate-supabase-auth', 'electron-token')
    expect(localStorage.getItem('flowstate-supabase-auth')).toBeNull()
    expect(await storage.getItem('flowstate-supabase-auth')).toBe('electron-token')
  })

  it('waits for a late Electron preload bridge instead of falling back to file:// localStorage', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 FlowState/1.4.215 Chrome/120 Electron/28.0.0 Safari/537.36',
      configurable: true,
    })
    localStorage.setItem('flowstate-supabase-auth', 'wrong-web-token')
    const store: Record<string, unknown> = { 'flowstate-supabase-auth': 'durable-electron-token' }
    const storage = createLazyAuthStorage()!

    const read = storage.getItem('flowstate-supabase-auth')
    await vi.advanceTimersByTimeAsync(50)
    ;(window as any).electronAPI = {
      isElectron: true,
      storeGet: vi.fn(async (k: string) => store[k] ?? null),
      storeSet: vi.fn(async (k: string, v: unknown) => { store[k] = v }),
    }
    await vi.advanceTimersByTimeAsync(25)

    expect(await read).toBe('durable-electron-token')
    expect((window as any).electronAPI.storeGet).toHaveBeenCalledWith('flowstate-supabase-auth')
  })

  it('does not persist Electron auth tokens to localStorage when the preload bridge never appears', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 FlowState/1.4.215 Chrome/120 Electron/28.0.0 Safari/537.36',
      configurable: true,
    })
    const storage = createLazyAuthStorage()!
    const write = storage.setItem('flowstate-supabase-auth', 'token-that-must-not-enter-localStorage')
    const settledWrite = write.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(1100)
    await settledWrite

    expect(localStorage.getItem('flowstate-supabase-auth')).toBeNull()
  })

  it('rejects Electron auth writes when the preload bridge never appears', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 FlowState/1.4.215 Chrome/120 Electron/28.0.0 Safari/537.36',
      configurable: true,
    })
    const storage = createLazyAuthStorage()!

    const outcome = storage
      .setItem('flowstate-supabase-auth', 'token-that-was-not-persisted')
      .then(() => null, error => error as Error)
    await vi.advanceTimersByTimeAsync(1100)

    expect(await outcome).toEqual(expect.objectContaining({
      message: expect.stringContaining('Electron preload bridge unavailable'),
    }))
    expect(localStorage.getItem('flowstate-supabase-auth')).toBeNull()
  })

  it('rejects unavailable Electron reads instead of reporting a signed-out null session', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 FlowState Chrome/120 Electron/28.0.0',
      configurable: true,
    })
    const storage = createLazyAuthStorage()!

    const outcome = storage.getItem('flowstate-supabase-auth').then(() => null, error => error as Error)
    await vi.advanceTimersByTimeAsync(1100)

    expect(await outcome).toEqual(expect.objectContaining({
      message: expect.stringContaining('auth state is unknown'),
    }))
  })

  it('removeItem stores null via the Electron bridge (absent-key semantics)', async () => {
    const store: Record<string, unknown> = { 'flowstate-supabase-auth': 'tok' }
    ;(window as any).electronAPI = {
      isElectron: true,
      storeGet: vi.fn(async (k: string) => store[k] ?? null),
      storeSet: vi.fn(async (k: string, v: unknown) => { store[k] = v }),
    }
    const storage = createLazyAuthStorage()!
    await storage.removeItem('flowstate-supabase-auth')
    expect((window as any).electronAPI.storeSet).toHaveBeenCalledWith('flowstate-supabase-auth', null)
    expect(await storage.getItem('flowstate-supabase-auth')).toBeNull()
  })

  it('rejects Electron auth removal when the durable bridge never appears', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 FlowState Chrome/120 Electron/28.0.0',
      configurable: true,
    })
    const storage = createLazyAuthStorage()!

    const outcome = storage.removeItem('flowstate-supabase-auth').then(() => null, error => error as Error)
    await vi.advanceTimersByTimeAsync(1100)

    expect(await outcome).toEqual(expect.objectContaining({
      message: expect.stringContaining('refusing to clear auth'),
    }))
  })

  it('ignores a non-Electron bridge object (isElectron falsy)', async () => {
    (window as any).electronAPI = { isElectron: false, storeGet: vi.fn(), storeSet: vi.fn() }
    const storage = createLazyAuthStorage()!
    await storage.setItem('flowstate-supabase-auth', 'web-token')
    expect(localStorage.getItem('flowstate-supabase-auth')).toBe('web-token')
    expect((window as any).electronAPI.storeSet).not.toHaveBeenCalled()
  })
})
