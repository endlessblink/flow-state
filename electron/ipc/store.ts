import { ipcMain, app } from 'electron'
import { join } from 'path'
import { createJsonStore } from './jsonStore'

/**
 * Simple JSON key-value store persisted to disk.
 * Replaces @tauri-apps/plugin-store.
 *
 * BUG-1874: backed by the atomic, serialized, corruption-safe store in `jsonStore.ts` so a kill
 * during an update handoff can't truncate `store.json` (which would wipe the auth session), and
 * concurrent writes (Supabase token + auth backup) can't clobber each other.
 */

let store: ReturnType<typeof createJsonStore> | null = null

function getStore() {
  if (!store) {
    store = createJsonStore(join(app.getPath('userData'), 'store.json'))
  }
  return store
}

/**
 * Flush any pending store writes to disk. Called from the updater before the app exits so the
 * latest (possibly just-rotated) refresh token is durably persisted across the restart.
 */
export async function flushStore(): Promise<void> {
  if (!store) return
  await store.flush()
}

export function registerStoreHandlers() {
  ipcMain.handle('store:get', async (_event, key: string) => {
    return getStore().get(key)
  })

  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    await getStore().set(key, value)
  })
}
