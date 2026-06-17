/**
 * TASK-1871 regression: never replay a STALE Electron auth-session backup.
 * A backup whose single-use refresh token has likely been rotated (old + access
 * token expired) must NOT be restored — replaying it caused the hard
 * "Invalid Refresh Token: Already Used" auth-init failure.
 */
import { describe, it, expect, vi } from 'vitest'

// supabase.ts initializes a client at module load; stub the SDK so importing the
// pure helper doesn't require real env/network.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: {}, channel: () => ({}), removeChannel: () => {} }),
}))

import { isAuthBackupReplayable } from '@/services/auth/supabase'

const HOUR = 60 * 60 * 1000
const NOW = 1_700_000_000_000
const future = (secs: number) => Math.floor(NOW / 1000) + secs

describe('isAuthBackupReplayable (TASK-1871)', () => {
  it('replays a fresh backup (saved seconds ago)', () => {
    expect(isAuthBackupReplayable({ refresh_token: 'r', expires_at: future(-9999) }, NOW - 5_000, NOW)).toBe(true)
  })

  it('replays when the access token is still valid, even if backup is old', () => {
    expect(isAuthBackupReplayable({ refresh_token: 'r', expires_at: future(600) }, NOW - 5 * HOUR, NOW)).toBe(true)
  })

  it('does NOT replay a stale backup (old + access token expired)', () => {
    expect(isAuthBackupReplayable({ refresh_token: 'r', expires_at: future(-600) }, NOW - 5 * HOUR, NOW)).toBe(false)
  })

  it('does NOT replay without a refresh token', () => {
    expect(isAuthBackupReplayable({ refresh_token: null, expires_at: future(600) }, NOW - 1_000, NOW)).toBe(false)
    expect(isAuthBackupReplayable(null, NOW, NOW)).toBe(false)
  })

  it('treats missing savedAt as ancient (not replayable if access expired)', () => {
    expect(isAuthBackupReplayable({ refresh_token: 'r', expires_at: future(-600) }, undefined, NOW)).toBe(false)
  })
})
