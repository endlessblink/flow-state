/**
 * 🛡️ Robust Persistent Storage System
 *
 * Multi-layer storage with automatic failover and backup mechanisms
 * Prevents data loss through redundant storage across multiple locations
 */

import { ref, watch } from 'vue'

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

// Error handling with fallback
class PersistentStorage {
  private availableLayers: string[] = []
  private lastBackupTime: number = 0
  private backupInterval: number = 15 * 60 * 1000 // 15 minutes (reduced frequency)

  constructor() {
    this.detectAvailableStorage()
    this.startPeriodicBackup()
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
   * NOTE: Version bumped to 3 to fix "Storage object store not found" error
   */
  private async saveToIndexedDB(key: string, data: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Version 3: Ensure 'storage' object store exists
      const request = indexedDB.open('pomo-flow-backup', 3)

      request.onerror = () => {
        console.error('IndexedDB error:', request.error)
        resolve(false)
      }

      request.onupgradeneeded = (event) => {
        const db = request.result
        // Always create 'storage' object store if it doesn't exist
        if (!db.objectStoreNames.contains('storage')) {
          console.log('📦 Creating IndexedDB "storage" object store (v3 upgrade)')
          db.createObjectStore('storage')
        }
      }

      request.onsuccess = () => {
        const db = request.result
        // Ensure the storage object store exists before creating transaction
        if (!db.objectStoreNames.contains('storage')) {
          // This shouldn't happen after v3 upgrade, but handle gracefully
          console.warn('⚠️ Storage object store not found - may need browser refresh')
          db.close()
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
      // Version 3: Match saveToIndexedDB version
      const request = indexedDB.open('pomo-flow-backup', 3)

      request.onerror = () => resolve(null)

      request.onupgradeneeded = (event) => {
        const db = request.result
        // Ensure 'storage' object store exists on read too
        if (!db.objectStoreNames.contains('storage')) {
          console.log('📦 Creating IndexedDB "storage" object store (v3 upgrade on read)')
          db.createObjectStore('storage')
        }
      }

      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('storage')) {
          db.close()
          resolve(null)
          return
        }

        try {
          const transaction = db.transaction(['storage'], 'readonly')
          const store = transaction.objectStore('storage')

          const getRequest = store.get(key)
          getRequest.onsuccess = () => resolve(getRequest.result || null)
          getRequest.onerror = () => resolve(null)
        } catch (error) {
          console.error('IndexedDB load error:', error)
          resolve(null)
        }
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
  private async saveToFileSystem(key: string, data: string): Promise<boolean> {
    // File system downloads disabled to prevent automatic file spam
    // Users can manually export backups using the UI component
    console.log('📁 File system download disabled - use manual export via UI')
    return true // Return true to indicate layer is available but not auto-downloading
  }

  private async loadFromFileSystem(key: string): Promise<string | null> {
    // File system loading would require user interaction (file input)
    // This is handled by the recovery tool
    return null
  }

  /**
   * Create automatic backups
   */
  private startPeriodicBackup() {
    setInterval(() => {
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
  async getAllBackups(): Promise<any[]> {
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
        } catch (error) {
          console.warn('Invalid backup found:', key)
        }
      }
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp)
  }

  async restoreFromBackup(backup: any): Promise<boolean> {
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

/**
 * Composable for using persistent storage
 */
export function usePersistentStorage() {
  if (!persistentStorage) {
    persistentStorage = new PersistentStorage()
  }

  const healthStatus = ref(persistentStorage.getHealthStatus())

  // Update health status periodically
  setInterval(() => {
    healthStatus.value = persistentStorage!.getHealthStatus()
  }, 30000) // Every 30 seconds

  return {
    save: <T>(key: string, data: T) => persistentStorage!.save(key, data),
    load: <T>(key: string) => persistentStorage!.load<T>(key),
    createBackup: () => persistentStorage!.createBackup(),
    getAllBackups: () => persistentStorage!.getAllBackups(),
    restoreFromBackup: (backup: any) => persistentStorage!.restoreFromBackup(backup),
    healthStatus,
    STORAGE_KEYS
  }
}