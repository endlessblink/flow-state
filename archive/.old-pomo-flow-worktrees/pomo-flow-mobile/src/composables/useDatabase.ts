import localforage from 'localforage'

// Configure localforage for Pomo-Flow
const db = localforage.createInstance({
  name: 'pomo-flow',
  version: 1.0,
  storeName: 'pomo_flow_data',
  description: 'Pomo-Flow productivity data storage'
})

export interface DatabaseStore {
  tasks: string
  projects: string
  canvas: string
  timer: string
  settings: string
}

export const DB_KEYS = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  CANVAS: 'canvas',
  TIMER: 'timer',
  SETTINGS: 'settings',
  VERSION: 'version'
} as const

export function useDatabase() {
  // Save data to IndexedDB
  const save = async <T>(key: string, data: T): Promise<void> => {
    try {
      await db.setItem(key, JSON.stringify(data))
      console.log(`💾 Saved ${key} to IndexedDB`)
    } catch (error) {
      console.error(`❌ Failed to save ${key}:`, error)
      throw error
    }
  }

  // Load data from IndexedDB
  const load = async <T>(key: string): Promise<T | null> => {
    try {
      const data = await db.getItem<string>(key)
      if (!data) return null

      const parsed = JSON.parse(data) as T
      console.log(`📂 Loaded ${key} from IndexedDB`)
      return parsed
    } catch (error) {
      console.error(`❌ Failed to load ${key}:`, error)
      return null
    }
  }

  // Remove data from IndexedDB
  const remove = async (key: string): Promise<void> => {
    try {
      await db.removeItem(key)
      console.log(`🗑️ Removed ${key} from IndexedDB`)
    } catch (error) {
      console.error(`❌ Failed to remove ${key}:`, error)
      throw error
    }
  }

  // Clear all data
  const clear = async (): Promise<void> => {
    try {
      await db.clear()
      console.log('🗑️ Cleared all IndexedDB data')
    } catch (error) {
      console.error('❌ Failed to clear IndexedDB:', error)
      throw error
    }
  }

  // Get all keys
  const keys = async (): Promise<string[]> => {
    try {
      return await db.keys()
    } catch (error) {
      console.error('❌ Failed to get keys:', error)
      return []
    }
  }

  // Check if database has data
  const hasData = async (key: string): Promise<boolean> => {
    try {
      const data = await db.getItem(key)
      return data !== null
    } catch (error) {
      console.error(`❌ Failed to check ${key}:`, error)
      return false
    }
  }

  // Export data as JSON (for backup)
  const exportAll = async (): Promise<Record<string, any>> => {
    try {
      const allKeys = await db.keys()
      const data: Record<string, any> = {}

      for (const key of allKeys) {
        const value = await db.getItem<string>(key)
        if (value) {
          data[key] = JSON.parse(value)
        }
      }

      console.log('📦 Exported all data from IndexedDB')
      return data
    } catch (error) {
      console.error('❌ Failed to export data:', error)
      throw error
    }
  }

  // Import data from JSON (for restore)
  const importAll = async (data: Record<string, any>): Promise<void> => {
    try {
      for (const [key, value] of Object.entries(data)) {
        await db.setItem(key, JSON.stringify(value))
      }
      console.log('📥 Imported all data to IndexedDB')
    } catch (error) {
      console.error('❌ Failed to import data:', error)
      throw error
    }
  }

  return {
    save,
    load,
    remove,
    clear,
    keys,
    hasData,
    exportAll,
    importAll
  }
}
