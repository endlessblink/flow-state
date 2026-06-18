import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createLazyAuthStorage } from '../authStorage'

/**
 * BUG-1874: the storage backend must be resolved at CALL TIME. If it were frozen at module-eval
 * and the preload bridge appeared late, the session would go to volatile localStorage and be
 * lost on the next launch ("signed out after update").
 */
describe('createLazyAuthStorage — call-time backend resolution (BUG-1874)', () => {
  afterEach(() => {
    delete (window as any).electronAPI
    localStorage.clear()
    vi.restoreAllMocks()
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

  it('ignores a non-Electron bridge object (isElectron falsy)', async () => {
    ;(window as any).electronAPI = { isElectron: false, storeGet: vi.fn(), storeSet: vi.fn() }
    const storage = createLazyAuthStorage()!
    await storage.setItem('flowstate-supabase-auth', 'web-token')
    expect(localStorage.getItem('flowstate-supabase-auth')).toBe('web-token')
    expect((window as any).electronAPI.storeSet).not.toHaveBeenCalled()
  })
})
