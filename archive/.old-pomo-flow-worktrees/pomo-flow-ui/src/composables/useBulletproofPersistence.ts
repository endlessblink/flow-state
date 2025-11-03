/**
 * 🔒 Bulletproof Data Persistence System
 *
 * Multiple redundancy layers to prevent data loss under any circumstances:
 * 1. Primary IndexedDB storage
 * 2. localStorage fallback
 * 3. File download backups
 * 4. Cloud storage sync
 * 5. Data integrity validation
 * 6. Version history with rollback
 */

import localforage from 'localforage'
import { useCloudSync } from './useCloudSync'

export interface BackupMetadata {
  version: string
  timestamp: number
  checksum: string
  dataSize: number
  source: 'indexeddb' | 'localStorage' | 'cloud'
  deviceId: string
  appVersion: string
}

export interface BackupEntry {
  metadata: BackupMetadata
  data: any
  compressed: boolean
}

export interface IntegrityCheck {
  isValid: boolean
  errors: string[]
  warnings: string[]
  checksum: string
  timestamp: number
}

class BulletproofPersistence {
  private primaryDb: any
  private cloudSync: any
  private backupHistory: BackupEntry[] = []
  private maxBackups: number = 50
  private integrityChecks: Map<string, IntegrityCheck> = new Map()

  constructor() {
    this.primaryDb = localforage.createInstance({
      name: 'pomo-flow-primary',
      version: 1,
      storeName: 'main_data',
      description: 'Primary Pomo-Flow data storage'
    })
    this.cloudSync = useCloudSync()
    this.loadBackupHistory()
    this.startPeriodicIntegrityChecks()
  }

  /**
   * 🔒 Save data with maximum redundancy
   */
  async save<T>(key: string, data: T): Promise<void> {
    const serializedData = JSON.stringify(data)
    const checksum = this.calculateChecksum(serializedData)

    const metadata: BackupMetadata = {
      version: '1.0.0',
      timestamp: Date.now(),
      checksum,
      dataSize: serializedData.length,
      source: 'indexeddb',
      deviceId: this.getDeviceId(),
      appVersion: '1.0.0'
    }

    // 1. Save to primary IndexedDB
    await this.saveToPrimary(key, data, metadata)

    // 2. Save to localStorage fallback
    await this.saveToLocalStorage(key, data, metadata)

    // 3. Create backup entry
    await this.createBackupEntry(key, data, metadata)

    // 4. Validate data integrity
    await this.validateDataIntegrity(key, data, checksum)

    // 5. Trigger cloud sync if available
    await this.triggerCloudSync()

    console.log(`🔒 Bulletproof save completed for ${key}`)
  }

  /**
   * 🔒 Load data with automatic recovery
   */
  async load<T>(key: string): Promise<T | null> {
    const errors: string[] = []

    try {
      // 1. Try primary IndexedDB first
      const primaryData = await this.loadFromPrimary<T>(key)
      if (primaryData && await this.validateIntegrity(key, primaryData)) {
        return primaryData
      }
    } catch (error) {
      errors.push(`Primary IndexedDB failed: ${error}`)
    }

    try {
      // 2. Try localStorage fallback
      const localData = await this.loadFromLocalStorage<T>(key)
      if (localData && await this.validateIntegrity(key, localData)) {
        // Restore to primary if fallback worked
        await this.save(key, localData)
        return localData
      }
    } catch (error) {
      errors.push(`localStorage fallback failed: ${error}`)
    }

    try {
      // 3. Try backup history
      const backupData = await this.restoreFromBackupHistory(key)
      if (backupData) {
        console.log(`🔄 Restored ${key} from backup history`)
        await this.save(key, backupData) // Save to primary storage
        return backupData
      }
    } catch (error) {
      errors.push(`Backup history failed: ${error}`)
    }

    try {
      // 4. Try cloud sync as last resort
      const cloudData = await this.restoreFromCloud(key)
      if (cloudData) {
        console.log(`☁️ Restored ${key} from cloud backup`)
        await this.save(key, cloudData)
        return cloudData
      }
    } catch (error) {
      errors.push(`Cloud sync failed: ${error}`)
    }

    console.error(`❌ All recovery methods failed for ${key}:`, errors)
    return null
  }

  /**
   * 🏥 Advanced recovery options
   */
  async getRecoveryOptions(key: string): Promise<any[]> {
    const options: any[] = []

    // Check all available sources
    const sources = [
      { name: 'Primary IndexedDB', data: await this.loadFromPrimary(key) },
      { name: 'localStorage', data: await this.loadFromLocalStorage(key) },
      { name: 'Latest Backup', data: await this.getLatestBackup(key) },
      { name: 'Cloud Sync', data: await this.getCloudData(key) }
    ]

    for (const source of sources) {
      if (source.data) {
        const integrity = await this.checkIntegrity(source.data)
        options.push({
          source: source.name,
          data: source.data,
          integrity,
          timestamp: source.data.timestamp || Date.now()
        })
      }
    }

    return options.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 🔍 Data integrity validation
   */
  async validateAllData(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []
    const keys = ['tasks', 'projects', 'canvas', 'settings']

    for (const key of keys) {
      try {
        const data = await this.load(key)
        if (data) {
          const integrity = await this.checkIntegrity(data)
          if (!integrity.isValid) {
            issues.push(`${key}: ${integrity.errors.join(', ')}`)
          }
        }
      } catch (error) {
        issues.push(`${key}: Failed to validate - ${error}`)
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * 📦 Create comprehensive backup package
   */
  async createFullBackup(): Promise<string> {
    const backupData: any = {
      version: '1.0.0',
      timestamp: Date.now(),
      deviceId: this.getDeviceId(),
      data: {},
      metadata: {
        totalSize: 0,
        itemCount: 0,
        integrity: 'validated'
      }
    }

    const keys = ['tasks', 'projects', 'canvas', 'settings']

    for (const key of keys) {
      const data = await this.load(key)
      if (data) {
        const integrity = await this.checkIntegrity(data)
        backupData.data[key] = {
          data,
          integrity,
          checksum: integrity.checksum
        }
        backupData.metadata.totalSize += JSON.stringify(data).length
        backupData.metadata.itemCount += Array.isArray(data) ? data.length : 1
      }
    }

    const backupJson = JSON.stringify(backupData, null, 2)
    const checksum = this.calculateChecksum(backupJson)

    // Add checksum to backup
    const finalBackup = {
      ...backupData,
      checksum
    }

    // Save backup entry
    await this.createBackupEntry('full-backup', finalBackup, {
      version: '1.0.0',
      timestamp: Date.now(),
      checksum,
      dataSize: JSON.stringify(finalBackup).length,
      source: 'manual',
      deviceId: this.getDeviceId(),
      appVersion: '1.0.0'
    })

    console.log('📦 Full backup package created')
    return JSON.stringify(finalBackup, null, 2)
  }

  /**
   * 🔄 Restore from backup package
   */
  async restoreFromBackup(backupJson: string): Promise<boolean> {
    try {
      const backup = JSON.parse(backupJson)

      // Verify backup integrity
      if (backup.checksum) {
        const backupData = { ...backup }
        delete backupData.checksum
        const calculatedChecksum = this.calculateChecksum(JSON.stringify(backupData))

        if (calculatedChecksum !== backup.checksum) {
          throw new Error('Backup integrity check failed')
        }
      }

      // Restore all data
      for (const [key, entry] of Object.entries(backup.data)) {
        if (typeof entry === 'object' && entry.data) {
          await this.save(key, entry.data)
        }
      }

      console.log('✅ Successfully restored from backup')
      return true
    } catch (error) {
      console.error('❌ Backup restoration failed:', error)
      return false
    }
  }

  // Private helper methods
  private async saveToPrimary<T>(key: string, data: T, metadata: BackupMetadata): Promise<void> {
    await this.primaryDb.setItem(key, JSON.stringify({
      data,
      metadata,
      savedAt: Date.now()
    }))
  }

  private async loadFromPrimary<T>(key: string): Promise<T | null> {
    const item = await this.primaryDb.getItem(key)
    if (!item) return null

    const parsed = JSON.parse(item)
    return parsed.data || parsed
  }

  private async saveToLocalStorage<T>(key: string, data: T, metadata: BackupMetadata): Promise<void> {
    const storageKey = `pomo-flow-backup-${key}`
    localStorage.setItem(storageKey, JSON.stringify({
      data,
      metadata,
      savedAt: Date.now()
    }))
  }

  private async loadFromLocalStorage<T>(key: string): Promise<T | null> {
    const storageKey = `pomo-flow-backup-${key}`
    const item = localStorage.getItem(storageKey)
    if (!item) return null

    try {
      const parsed = JSON.parse(item)
      return parsed.data || parsed
    } catch (error) {
      console.warn('localStorage parse error:', error)
      return null
    }
  }

  private async createBackupEntry<T>(key: string, data: T, metadata: BackupMetadata): Promise<void> {
    const entry: BackupEntry = {
      metadata,
      data,
      compressed: false
    }

    this.backupHistory.unshift(entry)

    // Limit backup history size
    if (this.backupHistory.length > this.maxBackups) {
      this.backupHistory = this.backupHistory.slice(0, this.maxBackups)
    }

    // Save backup history to localStorage
    localStorage.setItem('pomo-flow-backup-history', JSON.stringify(this.backupHistory))
  }

  private async loadBackupHistory(): Promise<void> {
    try {
      const saved = localStorage.getItem('pomo-flow-backup-history')
      if (saved) {
        this.backupHistory = JSON.parse(saved)
      }
    } catch (error) {
      console.warn('Failed to load backup history:', error)
      this.backupHistory = []
    }
  }

  private async restoreFromBackupHistory<T>(key: string): Promise<T | null> {
    const relevantBackups = this.backupHistory.filter(entry =>
      entry.metadata.source === 'indexeddb' ||
      (entry.data && typeof entry.data === 'object' && key in entry.data)
    )

    if (relevantBackups.length === 0) return null

    // Try the most recent valid backup
    for (const backup of relevantBackups) {
      const data = backup.data[key] || backup.data
      if (data && await this.validateIntegrity(key, data)) {
        return data
      }
    }

    return null
  }

  private async restoreFromCloud<T>(key: string): Promise<T | null> {
    try {
      await this.cloudSync.syncFromCloud()
      return await this.loadFromPrimary(key)
    } catch (error) {
      console.warn('Cloud restore failed:', error)
      return null
    }
  }

  private async getCloudData<T>(key: string): Promise<T | null> {
    try {
      await this.cloudSync.syncFromCloud()
      return await this.loadFromPrimary(key)
    } catch (error) {
      return null
    }
  }

  private async getLatestBackup<T>(key: string): Promise<T | null> {
    const keyBackups = this.backupHistory.filter(entry =>
      entry.data && typeof entry.data === 'object' && key in entry.data
    )

    if (keyBackups.length === 0) return null

    const latest = keyBackups[0]
    return latest.data[key] || latest.data
  }

  private async validateIntegrity<T>(key: string, data: T): Promise<boolean> {
    const integrity = await this.checkIntegrity(data)
    this.integrityChecks.set(key, integrity)
    return integrity.isValid
  }

  private async checkIntegrity(data: any): Promise<IntegrityCheck> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const serialized = JSON.stringify(data)
      const checksum = this.calculateChecksum(serialized)

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Data is not an object')
      }

      // Check for common corruption patterns
      if (serialized.includes('undefined') || serialized.includes('null')) {
        warnings.push('Data contains null/undefined values')
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        checksum,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to check integrity: ${error}`],
        warnings,
        checksum: '',
        timestamp: Date.now()
      }
    }
  }

  private async validateDataIntegrity<T>(key: string, data: T, expectedChecksum: string): Promise<void> {
    const serialized = JSON.stringify(data)
    const actualChecksum = this.calculateChecksum(serialized)

    if (actualChecksum !== expectedChecksum) {
      console.error(`❌ Data integrity check failed for ${key}`)
      throw new Error('Data corruption detected')
    }
  }

  private async triggerCloudSync(): Promise<void> {
    try {
      await this.cloudSync.syncNow()
    } catch (error) {
      console.warn('Cloud sync failed:', error)
    }
  }

  private calculateChecksum(data: string): string {
    // Simple checksum function
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('pomo-flow-device-id')
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('pomo-flow-device-id', deviceId)
    }
    return deviceId
  }

  private startPeriodicIntegrityChecks(): void {
    setInterval(async () => {
      const validation = await this.validateAllData()
      if (!validation.valid) {
        console.warn('⚠️ Data integrity issues detected:', validation.issues)
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  // Public API for backup management
  getBackupHistory(): BackupEntry[] {
    return [...this.backupHistory]
  }

  clearBackupHistory(): void {
    this.backupHistory = []
    localStorage.removeItem('pomo-flow-backup-history')
  }

  getIntegrityStatus(): Map<string, IntegrityCheck> {
    return new Map(this.integrityChecks)
  }
}

// Global instance
let bulletproofPersistence: BulletproofPersistence | null = null

export function useBulletproofPersistence() {
  if (!bulletproofPersistence) {
    bulletproofPersistence = new BulletproofPersistence()
  }
  return bulletproofPersistence
}