/**
 * TASK-1881 (follow-up to TASK-1871/BUG-1874): restoreAuthSessionFromBackup must NOT
 * locally refuse + delete a backup just because its access token expired and it's older
 * than ~62 min. GoTrue refresh tokens live far longer server-side; refusing locally
 * guaranteed the recurring Electron "signed out on restart" (the only recovery source
 * was erased). The server — not a local age heuristic — is the authority on whether the
 * refresh token is dead (handled downstream in auth.ts via the "Already Used" path).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// supabase.ts builds a client at module load; stub the SDK so importing it needs no env/network.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: {}, channel: () => ({}), removeChannel: () => {} }),
}))

const HOUR = 60 * 60 * 1000

describe('restoreAuthSessionFromBackup — never discard a recoverable backup (TASK-1881)', () => {
  let store: Record<string, unknown>

  beforeEach(() => {
    store = {}
    ;(window as any).electronAPI = {
      isElectron: true,
      storeGet: vi.fn(async (k: string) => store[k] ?? null),
      storeSet: vi.fn(async (k: string, v: unknown) => { store[k] = v }),
    }
  })

  afterEach(() => {
    delete (window as any).electronAPI
    vi.restoreAllMocks()
  })

  it('restores a stale backup (old + access token expired) and KEEPS it for the server to validate', async () => {
    const { restoreAuthSessionFromBackup, AUTH_SESSION_BACKUP_KEY } = await import('@/services/auth/supabase')
    const { STORAGE_KEYS } = await import('@/constants/storageKeys')

    const staleSession = {
      access_token: 'expired-access',
      refresh_token: 'still-good-refresh',
      // expired hours ago
      expires_at: Math.floor((Date.now() - 3 * HOUR) / 1000),
      user: { id: 'user-1' },
    }
    store[AUTH_SESSION_BACKUP_KEY] = JSON.stringify({
      savedAt: Date.now() - 5 * HOUR, // older than the ~62min guard
      session: staleSession,
    })

    const restored = await restoreAuthSessionFromBackup()

    // It must hand the session back so init can attempt a real refresh...
    expect(restored).not.toBeNull()
    expect(restored?.refresh_token).toBe('still-good-refresh')
    // ...write it to the primary key so getSession() sees it...
    expect(store[STORAGE_KEYS.SUPABASE_AUTH]).toBeTruthy()
    // ...and must NOT have deleted the backup (regression: it used to clear it here).
    expect(store[AUTH_SESSION_BACKUP_KEY]).toBeTruthy()
  })

  it('returns null only when there is genuinely no usable backup (no refresh token)', async () => {
    const { restoreAuthSessionFromBackup, AUTH_SESSION_BACKUP_KEY } = await import('@/services/auth/supabase')
    store[AUTH_SESSION_BACKUP_KEY] = JSON.stringify({
      savedAt: Date.now(),
      session: { access_token: 'a', refresh_token: null, user: { id: 'u' } },
    })
    expect(await restoreAuthSessionFromBackup()).toBeNull()
  })

  it('peeks the primary session without mutating durable auth storage', async () => {
    const { readPersistedAuthSessionCandidate, AUTH_SESSION_BACKUP_KEY } = await import('@/services/auth/supabase')
    const { STORAGE_KEYS } = await import('@/constants/storageKeys')
    const primary = {
      access_token: 'primary-access',
      refresh_token: 'primary-refresh',
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: 'primary-user' },
    }
    const backup = {
      access_token: 'backup-access',
      refresh_token: 'backup-refresh',
      user: { id: 'backup-user' },
    }
    store[STORAGE_KEYS.SUPABASE_AUTH] = JSON.stringify(primary)
    store[AUTH_SESSION_BACKUP_KEY] = JSON.stringify({ savedAt: Date.now(), session: backup })

    const candidate = await readPersistedAuthSessionCandidate()

    expect(candidate?.user.id).toBe('primary-user')
    expect((window as any).electronAPI.storeSet).not.toHaveBeenCalled()
  })

  it('falls back to the backup session when the primary value is absent or malformed', async () => {
    const { readPersistedAuthSessionCandidate, AUTH_SESSION_BACKUP_KEY } = await import('@/services/auth/supabase')
    const { STORAGE_KEYS } = await import('@/constants/storageKeys')
    store[STORAGE_KEYS.SUPABASE_AUTH] = '{malformed'
    store[AUTH_SESSION_BACKUP_KEY] = JSON.stringify({
      savedAt: Date.now(),
      session: {
        access_token: 'backup-access',
        refresh_token: 'backup-refresh',
        user: { id: 'backup-user' },
      },
    })

    expect((await readPersistedAuthSessionCandidate())?.user.id).toBe('backup-user')
    expect((window as any).electronAPI.storeSet).not.toHaveBeenCalled()
  })
})
