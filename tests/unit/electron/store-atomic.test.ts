import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createJsonStore } from '../../../electron/ipc/jsonStore'

/**
 * BUG-1874: the auth session lives in this store. A truncated/corrupt store.json or a
 * clobbered concurrent write = "signed out after update". These lock in the durability.
 */
describe('jsonStore — atomic, corruption-safe, serialized (BUG-1874)', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'flowstate-store-'))
    file = join(dir, 'store.json')
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists and reads back a value via atomic temp+rename (no leftover .tmp)', async () => {
    const store = createJsonStore(file)
    await store.set('flowstate-supabase-auth', { refresh_token: 'r1' })
    await store.flush()

    expect(existsSync(file)).toBe(true)
    expect(existsSync(`${file}.tmp`)).toBe(false) // tmp was renamed away
    expect(JSON.parse(readFileSync(file, 'utf-8'))['flowstate-supabase-auth']).toEqual({ refresh_token: 'r1' })

    const fresh = createJsonStore(file)
    expect(await fresh.get('flowstate-supabase-auth')).toEqual({ refresh_token: 'r1' })
  })

  it('concurrent set() on different keys both persist (no read-modify-write clobber)', async () => {
    const store = createJsonStore(file)
    // Fire both without awaiting between them — the mutex must serialize them.
    await Promise.all([
      store.set('flowstate-supabase-auth', { token: 'primary' }),
      store.set('flowstate-supabase-auth-backup-v1', { token: 'backup' }),
    ])
    await store.flush()

    const fresh = createJsonStore(file)
    expect(await fresh.get('flowstate-supabase-auth')).toEqual({ token: 'primary' })
    expect(await fresh.get('flowstate-supabase-auth-backup-v1')).toEqual({ token: 'backup' })
  })

  it('recovers the session from .bak when the primary store.json is corrupt', async () => {
    const store = createJsonStore(file)
    await store.set('flowstate-supabase-auth', { refresh_token: 'good' })
    await store.set('flowstate-supabase-auth', { refresh_token: 'good2' }) // creates .bak from first write
    await store.flush()
    expect(existsSync(`${file}.bak`)).toBe(true)

    // Simulate a kill mid-write: primary truncated to garbage.
    writeFileSync(file, '{ "flowstate-supabase-auth": ') // invalid JSON

    const recovered = createJsonStore(file)
    const value = await recovered.get('flowstate-supabase-auth')
    // Falls back to the last good backup instead of wiping to {} (which would force Sign In).
    expect(value).toEqual({ refresh_token: 'good' })
  })

  it('recovers from backup when the primary is valid JSON but not an object', async () => {
    writeFileSync(file, 'null')
    writeFileSync(`${file}.bak`, JSON.stringify({
      'flowstate-supabase-auth': { refresh_token: 'backup-token' },
    }))

    const recovered = createJsonStore(file)

    expect(await recovered.get('flowstate-supabase-auth')).toEqual({ refresh_token: 'backup-token' })
  })

  it('flush() resolves only after the queued writes are on disk', async () => {
    const store = createJsonStore(file)
    store.set('a', 1)
    store.set('b', 2)
    store.set('flowstate-supabase-auth', { token: 'final' })
    await store.flush()

    const onDisk = JSON.parse(readFileSync(file, 'utf-8'))
    expect(onDisk['flowstate-supabase-auth']).toEqual({ token: 'final' })
    expect(onDisk.a).toBe(1)
    expect(onDisk.b).toBe(2)
  })

  it('flush() rejects when a queued write failed', async () => {
    const nonDirectory = join(dir, 'not-a-directory')
    writeFileSync(nonDirectory, 'blocks child paths')
    const store = createJsonStore(join(nonDirectory, 'store.json'))

    await expect(store.set('flowstate-supabase-auth', { token: 'must-surface' })).rejects.toThrow()
    await expect(store.flush()).rejects.toThrow()
  })

  it('preserves the last good backup when writing after corrupt-primary recovery', async () => {
    const store = createJsonStore(file)
    await store.set('flowstate-supabase-auth', { refresh_token: 'backup-token' })
    await store.set('flowstate-supabase-auth', { refresh_token: 'primary-token' })
    await store.flush()

    writeFileSync(file, '{ corrupt primary')

    const recovered = createJsonStore(file)
    expect(await recovered.get('flowstate-supabase-auth')).toEqual({ refresh_token: 'backup-token' })
    await recovered.set('another-key', 'another-value')
    await recovered.flush()

    const backup = JSON.parse(readFileSync(`${file}.bak`, 'utf-8'))
    expect(backup['flowstate-supabase-auth']).toEqual({ refresh_token: 'backup-token' })
  })
})
