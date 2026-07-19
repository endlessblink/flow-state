import { readFile, writeFile, rename, mkdir, open, copyFile, chmod } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname } from 'path'

/**
 * BUG-1874: Atomic, corruption-safe, serialized JSON key-value store.
 *
 * Pure (no `electron` import) so it is unit-testable. `electron/ipc/store.ts` wires this to the
 * IPC channels with the real `userData/store.json` path.
 *
 * Durability properties:
 *  - Atomic writes: write to `<file>.tmp`, fsync, rename over `<file>` (atomic on the same FS).
 *    A kill mid-write can never leave a truncated `store.json` — the old file stays intact until
 *    rename. This is what stops "store.json corrupted → all auth wiped → Sign In".
 *  - `.bak` fallback: the previous good file is copied to `<file>.bak` before each rename; a
 *    corrupt primary falls back to it on load instead of resetting to `{}`.
 *  - Write mutex: a promise-chain queue serializes saves so concurrent `set()` calls (e.g. the
 *    Supabase token write racing the backup write) can't read-modify-write clobber each other.
 *  - `flush()`: awaits the in-flight write queue so the updater can guarantee the latest
 *    (possibly just-rotated) refresh token is on disk before the app exits.
 */
export interface JsonStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  /** Resolves once every queued write has been flushed to disk. */
  flush(): Promise<void>
}

export function createJsonStore(filePath: string): JsonStore {
  const tmpPath = `${filePath}.tmp`
  const bakPath = `${filePath}.bak`

  let storeData: Record<string, unknown> = {}
  let loaded = false
  let primaryIsKnownGood = false
  let hasPendingWriteError = false
  let pendingWriteError: unknown
  // Tail of the serialized write queue (the mutex). Each save chains onto this.
  let writeQueue: Promise<void> = Promise.resolve()

  const parseRecord = (raw: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Store root must be a JSON object')
    }
    return parsed as Record<string, unknown>
  }

  async function load(): Promise<void> {
    if (loaded) return
    try {
      if (existsSync(filePath)) {
        storeData = parseRecord(await readFile(filePath, 'utf-8'))
        primaryIsKnownGood = true
      } else if (existsSync(bakPath)) {
        // Primary missing but a backup survived (e.g. crash between writes) — recover from it.
        storeData = parseRecord(await readFile(bakPath, 'utf-8'))
      }
    } catch {
      // Primary is corrupt/truncated. Try the last known-good backup before giving up.
      try {
        if (existsSync(bakPath)) {
          storeData = parseRecord(await readFile(bakPath, 'utf-8'))
        } else {
          storeData = {}
        }
      } catch {
        storeData = {}
      }
    }
    loaded = true
  }

  async function writeAtomic(): Promise<void> {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true, mode: 0o700 })
    }
    await chmod(dir, 0o700)

    const payload = JSON.stringify(storeData, null, 2)

    // Write + fsync the temp file so the bytes are durably on disk before the rename.
    const handle = await open(tmpPath, 'w', 0o600)
    try {
      await handle.chmod(0o600)
      await handle.writeFile(payload, 'utf-8')
      await handle.sync()
    } finally {
      await handle.close()
    }

    // Preserve the previous good file as .bak so a crash can recover the last committed state.
    if (primaryIsKnownGood && existsSync(filePath)) {
      try {
        await copyFile(filePath, bakPath)
        await chmod(bakPath, 0o600)
      } catch {
        // A missing/locked .bak must not block the primary write.
      }
    }

    // Atomic replace.
    await rename(tmpPath, filePath)
    await chmod(filePath, 0o600)
    primaryIsKnownGood = true
  }

  /**
   * Serialize the WHOLE load+mutate+write as one unit behind the previous op. Enqueuing happens
   * synchronously when set() is called, so the queue tail advances before set() returns — that
   * way flush() (which awaits the tail) covers even a set() whose promise hasn't been awaited yet,
   * and two concurrent sets cannot interleave their read-modify-write.
   */
  function enqueueSet(key: string, value: unknown): Promise<void> {
    const op = async () => {
      await load()
      storeData[key] = value
      await writeAtomic()
    }
    const next = writeQueue.then(op, op)
    // Swallow rejection on the tail so one failed write doesn't poison the chain, while still
    // surfacing the error to the specific caller that awaited `next`.
    writeQueue = next.catch((error) => {
      if (!hasPendingWriteError) {
        hasPendingWriteError = true
        pendingWriteError = error
      }
    })
    return next
  }

  return {
    async get(key: string): Promise<unknown> {
      // Reads must see writes already queued ahead of them.
      await writeQueue
      await load()
      return storeData[key] ?? null
    },
    set(key: string, value: unknown): Promise<void> {
      return enqueueSet(key, value)
    },
    async flush(): Promise<void> {
      await writeQueue
      if (hasPendingWriteError) {
        const error = pendingWriteError
        hasPendingWriteError = false
        pendingWriteError = undefined
        throw error
      }
    },
  }
}
