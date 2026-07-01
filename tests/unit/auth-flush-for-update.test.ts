import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({
    data: {
      session: {
        refresh_token: 'rt-current',
        access_token: 'at-current',
        expires_at: 9_999_999_999,
        user: { id: 'user-1' },
      },
    },
  })),
}))

vi.mock('@/utils/platform', () => ({
  isTauri: () => false,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession },
    channel: () => ({}),
    removeChannel: () => {},
  }),
}))

describe('flushAuthForUpdate (BUG-1874)', () => {
  let flushAuthForUpdate: any
  let AUTH_SESSION_BACKUP_KEY: any
  let STORAGE_KEYS: any

  beforeEach(async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    // reset modules to re-evaluate supabase.ts
    vi.resetModules()

    const mod = await import('@/services/auth/supabase')
    flushAuthForUpdate = mod.flushAuthForUpdate
    AUTH_SESSION_BACKUP_KEY = mod.AUTH_SESSION_BACKUP_KEY

    const keysMod = await import('@/constants/storageKeys')
    STORAGE_KEYS = keysMod.STORAGE_KEYS

    localStorage.clear()
    getSession.mockClear()
  })

  it('writes the current session to both the primary key and the replayable backup', async () => {
    await flushAuthForUpdate()

    expect(getSession).toHaveBeenCalledTimes(1)

    const primary = localStorage.getItem(STORAGE_KEYS.SUPABASE_AUTH)
    expect(primary).toBeTruthy()
    expect(JSON.parse(primary!).refresh_token).toBe('rt-current')

    const backupRaw = localStorage.getItem(AUTH_SESSION_BACKUP_KEY)
    expect(backupRaw).toBeTruthy()
    const backup = JSON.parse(backupRaw!)
    expect(backup.session.refresh_token).toBe('rt-current')
    expect(typeof backup.savedAt).toBe('number')
  })

  it('is a safe no-op when there is no session', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } } as never)
    await flushAuthForUpdate()
    expect(localStorage.getItem(STORAGE_KEYS.SUPABASE_AUTH)).toBeNull()
    expect(localStorage.getItem(AUTH_SESSION_BACKUP_KEY)).toBeNull()
  })
})
