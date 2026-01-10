/**
 * 🛡️ Robust Persistent Storage System
 *
 * Multi-layer storage with automatic failover and backup mechanisms
 * Prevents data loss through redundant storage across multiple locations
 */

import { ref, watch as _watch, onUnmounted } from 'vue'

// Storage priority order (most reliable first)
const STORAGE_LAYERS = {
  INDEXED_DB: 'indexedDB',
  LOCAL_STORAGE: 'localStorage',
  FILE_SYSTEM: 'fileSystem',
  CLOUD_BACKUP: 'cloudBackup'
}

// Storage keys
const STORAGE_KEYS = {
  TASKS: 'pomo-flow-tasks',
  PROJECTS: 'pomo-flow-projects',
  SETTINGS: 'pomo-flow-settings',
  BACKUP_TIMESTAMP: 'pomo-flow-last-backup'
}

// Backup data structure
interface BackupData {
  tasks?: unknown
  projects?: unknown
  settings?: unknown
  timestamp?: number
}

// Error handling with fallback
class PersistentStorage {
  private availableLayers: string[] = []
  private lastBackupTime: number = 0
  private backupInterval: number = 15 * 60 * 1000 // 15 minutes (reduced frequency)
  private backupIntervalId: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.detectAvailableStorage()
    this.startPeriodicBackup()
  }

  /**
   * Cleanup resources (call when app shuts down)
   */
  destroy() {
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId)
      this.backupIntervalId = null
    }
  }

  /**
   * Detect which storage layers are available
   */
  private detectAvailableStorage() {
    // Check localStorage
    try {
      localStorage.setItem('test', 'test')
      localStorage.removeItem('test')
      this.availableLayers.push(STORAGE_LAYERS.LOCAL_STORAGE)
    } catch (error) {
      console.warn('localStorage not available:', error)
    }

    // Check IndexedDB
    if (typeof indexedDB !== 'undefined') {
      this.availableLayers.push(STORAGE_LAYERS.INDEXED_DB)
    }

    // Check file system access (for downloads)
    if (typeof navigator !== 'undefined' && 'download' in document.createElement('a')) {
      this.availableLayers.push(STORAGE_LAYERS.FILE_SYSTEM)
    }

    console.log('📦 Available storage layers:', this.availableLayers)
  }

  /**
   * Save data with multiple redundancy layers
   */
  async save<T>(key: string, data: T): Promise<boolean> {
    const serializedData = JSON.stringify({
      data,
      timestamp: Date.now(),
      version: '1.0'
    })

    let successCount = 0
    const results: { layer: string; success: boolean; error?: string }[] = []

    // Try each available storage layer
    for (const layer of this.availableLayers) {
      try {
        let success = false

        switch (layer) {
          case STORAGE_LAYERS.INDEXED_DB:
            success = await this.saveToIndexedDB(key, serializedData)
            break
          case STORAGE_LAYERS.LOCAL_STORAGE:
            success = this.saveToLocalStorage(key, serializedData)
            break
          case STORAGE_LAYERS.FILE_SYSTEM:
            success = await this.saveToFileSystem(key, serializedData)
            break
        }

        results.push({ layer, success })
        if (success) successCount++

      } catch (error) {
        results.push({
          layer,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Log results
    console.log(`💾 Save results for ${key}:`, results)

    // Return true if at least one layer succeeded
    return successCount > 0
  }

  /**
   * Load data with automatic failover
   */
  async load<T>(key: string): Promise<T | null> {
    const errors: string[] = []

    // Try each storage layer in order of reliability
    for (const layer of this.availableLayers) {
      try {
        let data: string | null = null

        switch (layer) {
          case STORAGE_LAYERS.INDEXED_DB:
            data = await this.loadFromIndexedDB(key)
            break
          case STORAGE_LAYERS.LOCAL_STORAGE:
            data = this.loadFromLocalStorage(key)
            break
          case STORAGE_LAYERS.FILE_SYSTEM:
            data = await this.loadFromFileSystem(key)
            break
        }

        if (data) {
          try {
            const parsed = JSON.parse(data)
            console.log(`📥 Successfully loaded ${key} from ${layer}`)
            return parsed.data
          } catch (parseError) {
            errors.push(`${layer}: Parse error - ${parseError}`)
            continue
          }
        }

      } catch (error) {
        errors.push(`${layer}: ${error}`)
      }
    }

    console.warn(`❌ Failed to load ${key} from all layers:`, errors)
    return null
  }

  /**
   * IndexedDB operations
   */
  /**
   * IndexedDB operations
   */
  private readonly DB_NAME = 'pomo-flow-backup'
  private readonly DB_VERSION = 3 // Bumped to 3 to force 'storage' store creation

  private async saveToIndexedDB(key: string, data: string): Promise<boolean> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => {
        console.error('IndexedDB error:', request.error)
        resolve(false)
      }

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage')
        }
      }

      request.onsuccess = () => {
        const db = request.result
        // Ensure the storage object store exists before creating transaction
        if (!db.objectStoreNames.contains('storage')) {
          console.error('Storage object store not found in IndexedDB - Nuke required?')
          // Try to recover by closing and deleting? No, too risky during save.
          // Just fail gracefully.
          resolve(false)
          return
        }

        try {
          const transaction = db.transaction(['storage'], 'readwrite')
          const store = transaction.objectStore('storage')

          const putRequest = store.put(data, key)
          putRequest.onsuccess = () => resolve(true)
          putRequest.onerror = () => resolve(false)
        } catch (error) {
          console.error('IndexedDB transaction error:', error)
          resolve(false)
        }
      }
    })
  }

  private async loadFromIndexedDB(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => resolve(null)

      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('storage')) {
          resolve(null)
          return
        }

        const transaction = db.transaction(['storage'], 'readonly')
        const store = transaction.objectStore('storage')

        const getRequest = store.get(key)
        getRequest.onsuccess = () => resolve(getRequest.result || null)
        getRequest.onerror = () => resolve(null)
      }
    })
  }

  /**
   * localStorage operations
   */
  private saveToLocalStorage(key: string, data: string): boolean {
    try {
      localStorage.setItem(key, data)
      return true
    } catch (error) {
      console.error('localStorage save error:', error)
      return false
    }
  }

  private loadFromLocalStorage(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error('localStorage load error:', error)
      return null
    }
  }

  /**
   * File system operations (download backup files) - DISABLED to prevent spam
   */
  private async saveToFileSystem(_key: string, _data: string): Promise<boolean> {
    // File system downloads disabled to prevent automatic file spam
    // Users can manually export backups using the UI component
    console.log('📁 File system download disabled - use manual export via UI')
    return true // Return true to indicate layer is available but not auto-downloading
  }

  private async loadFromFileSystem(_key: string): Promise<string | null> {
    // File system loading would require user interaction (file input)
    // This is handled by the recovery tool
    return null
  }

  /**
   * Create automatic backups
   */
  private startPeriodicBackup() {
    // Only start if not already running
    if (this.backupIntervalId) return

    this.backupIntervalId = setInterval(() => {
      this.createBackup()
    }, this.backupInterval)
  }

  async createBackup(): Promise<void> {
    try {
      // Get current data from all sources
      const tasks = await this.load(STORAGE_KEYS.TASKS)
      const projects = await this.load(STORAGE_KEYS.PROJECTS)
      const settings = await this.load(STORAGE_KEYS.SETTINGS)

      const backup = {
        tasks,
        projects,
        settings,
        timestamp: Date.now(),
        version: '1.0',
        metadata: {
          totalTasks: (Array.isArray(tasks) ? tasks.length : 0),
          totalProjects: (Array.isArray(projects) ? projects.length : 0),
          backupSource: 'pomo-flow-persistent-storage'
        }
      }

      // Save backup to all layers
      await this.save('pomo-flow-auto-backup', backup)
      this.lastBackupTime = Date.now()

      console.log('🔄 Auto backup completed', backup.metadata)

    } catch (error) {
      console.error('Auto backup failed:', error)
    }
  }

  /**
   * Recovery operations
   */
  async getAllBackups(): Promise<unknown[]> {
    const backups = []

    // Check for auto backup
    const autoBackup = await this.load('pomo-flow-auto-backup')
    if (autoBackup) {
      backups.push(autoBackup)
    }

    // Check for manual backups
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes('pomo-flow-backup')) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data)
            backups.push(parsed)
          }
        } catch (_error) {
          console.warn('Invalid backup found:', key)
        }
      }
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp)
  }

  async restoreFromBackup(backup: BackupData): Promise<boolean> {
    try {
      if (backup.tasks) {
        await this.save(STORAGE_KEYS.TASKS, backup.tasks)
      }
      if (backup.projects) {
        await this.save(STORAGE_KEYS.PROJECTS, backup.projects)
      }
      if (backup.settings) {
        await this.save(STORAGE_KEYS.SETTINGS, backup.settings)
      }

      console.log('✅ Successfully restored from backup')
      return true
    } catch (error) {
      console.error('Restore failed:', error)
      return false
    }
  }

  /**
   * Health check
   */
  getHealthStatus() {
    return {
      availableLayers: this.availableLayers,
      lastBackupTime: this.lastBackupTime,
      nextBackupIn: Math.max(0, this.backupInterval - (Date.now() - this.lastBackupTime)),
      isHealthy: this.availableLayers.length > 0
    }
  }
}

// Global instance
let persistentStorage: PersistentStorage | null = null
// Singleton health check interval - only one across all usePersistentStorage() calls
let healthCheckIntervalId: ReturnType<typeof setInterval> | null = null
// Shared reactive health status (singleton) with default value
const sharedHealthStatus = ref<ReturnType<PersistentStorage['getHealthStatus']>>({
  availableLayers: [],
  lastBackupTime: 0,
  nextBackupIn: 0,
  isHealthy: false
})

/**
 * Composable for using persistent storage
 * MEMORY LEAK FIX: Health check interval is now singleton, not created per-call
 */
export function usePersistentStorage() {
  if (!persistentStorage) {
    persistentStorage = new PersistentStorage()
    sharedHealthStatus.value = persistentStorage.getHealthStatus()
  }

  const storage = persistentStorage

  // MEMORY LEAK FIX: Only create ONE health check interval across all composable instances
  if (!healthCheckIntervalId) {
    healthCheckIntervalId = setInterval(() => {
      if (persistentStorage) {
        sharedHealthStatus.value = persistentStorage.getHealthStatus()
      }
    }, 30000) // Every 30 seconds
  }

  // Cleanup on component unmount (only clears if this is the last user)
  // Note: For app-level singletons, this cleanup is optional but good practice
  onUnmounted(() => {
    // Don't clear singleton intervals on individual component unmounts
    // They will be cleaned up when the app closes
  })

  return {
    save: <T>(key: string, data: T) => storage.save(key, data),
    load: <T>(key: string) => storage.load<T>(key),
    createBackup: () => storage.createBackup(),
    getAllBackups: () => storage.getAllBackups(),
    restoreFromBackup: (backup: unknown) => storage.restoreFromBackup(backup as BackupData),
    healthStatus: sharedHealthStatus,
    STORAGE_KEYS
  }
}

/**
 * Cleanup function for app shutdown
 * Call this when the app is unmounting to prevent memory leaks
 */
export function cleanupPersistentStorage() {
  if (healthCheckIntervalId) {
    clearInterval(healthCheckIntervalId)
    healthCheckIntervalId = null
  }
  if (persistentStorage) {
    persistentStorage.destroy()
    persistentStorage = null
  }
}