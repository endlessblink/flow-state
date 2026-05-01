import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

/**
 * Simple JSON key-value store persisted to disk.
 */

const storePath = () => join(app.getPath('userData'), 'store.json')
let storeData: Record<string, unknown> = {}
let loaded = false

async function loadStore() {
  if (loaded) return
  const path = storePath()
  try {
    if (existsSync(path)) {
      const raw = await readFile(path, 'utf-8')
      storeData = JSON.parse(raw)
    }
  } catch {
    storeData = {}
  }
  loaded = true
}

async function saveStore() {
  const path = storePath()
  const dir = join(path, '..')
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(path, JSON.stringify(storeData, null, 2), 'utf-8')
}

export function registerStoreHandlers() {
  ipcMain.handle('store:get', async (_event, key: string) => {
    await loadStore()
    return storeData[key] ?? null
  })

  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    await loadStore()
    storeData[key] = value
    await saveStore()
  })
}
