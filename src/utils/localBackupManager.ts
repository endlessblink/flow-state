/**
 * Local Backup Manager for Data Loss Prevention
 * Creates snapshots of critical data before remote operations
 *
 * TASK-020: Refactored to use dependency injection for data source
 * to break circular dependency with useDatabase
 */

import PouchDB from 'pouchdb-browser'
import type { IBackupDataSource, BackupSnapshot, BackupConfig } from '@/types/databaseTypes'

// Re-export types for backward compatibility
export type { BackupSnapshot, BackupConfig }

export class LocalBackupManager {
  private db: PouchDB.Database
  private config: BackupConfig
  private dataSource: IBackupDataSource | null = null

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      maxBackups: 10,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      compressThreshold: 1024 * 100, // 100KB
      autoCleanup: true,
      ...config
    }

    // Use separate database for backups
    this.db = new PouchDB('pomo-flow-backups', {
      adapter: 'idb'
    })

    console.log('🔒 LocalBackupManager initialized:', this.config)
  }

  /**
   * Set the data source for backup operations
   * This breaks the circular dependency by using dependency injection
   */
  setDataSource(source: IBackupDataSource): void {
    this.dataSource = source
    console.log('🔒 LocalBackupManager: Data source connected')
  }

  /**
   * Check if data source is available
   */
  private ensureDataSource(): IBackupDataSource {
    if (!this.dataSource) {
      throw new Error('LocalBackupManager: Data source not set. Call setDataSource() first.')
    }
    return this.dataSource
  }

  /**
   * Create backup snapshot before operation
   */
  async createBackup(operation: BackupSnapshot['operation'], _description?: string): Promise<string> {
    try {
      const snapshotId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const timestamp = new Date()

      console.log(`🔒 Creating backup for ${operation} (${snapshotId})...`)

      // Collect current data using injected data source
      const data: BackupSnapshot['data'] = {}
      const dataSource = this.ensureDataSource()

      try {
        // Backup tasks
        const tasks = await dataSource.load<unknown[]>('tasks')
        if (tasks && Array.isArray(tasks)) {
          data.tasks = tasks
        }
      } catch (error) {
        console.warn('⚠️ Failed to backup tasks:', error)
      }

      try {
        // Backup projects if available
        const projects = await dataSource.load<unknown[]>('projects')
        if (projects && Array.isArray(projects)) {
          data.projects = projects
        }
      } catch (error) {
        console.warn('⚠️ Failed to backup projects:', error)
      }

      try {
        // Backup canvas state if available
        const canvas = await dataSource.load<unknown>('canvas')
        if (canvas) {
          data.canvas = canvas
        }
      } catch (error) {
        console.warn('⚠️ Failed to backup canvas:', error)
      }

      const snapshot: BackupSnapshot = {
        id: snapshotId,
        timestamp,
        operation,
        // description: description || operation, // Commented out - not part of BackupSnapshot interface
        data,
        checksum: this.calculateChecksum(data),
        compressed: false
      }

      // Compress if data is large
      if (JSON.stringify(data).length > this.config.compressThreshold) {
        snapshot.data = this.compressData(data)
        snapshot.compressed = true
      }

      // Store backup
      await this.db.put(snapshot)

      // Cleanup old backups if enabled
      if (this.config.autoCleanup) {
        await this.cleanupOldBackups()
      }

      console.log(`✅ Backup created successfully: ${snapshotId}`)
      return snapshotId
    } catch (error) {
      console.error('❌ Failed to create backup:', error)
      throw new Error(`Backup creation failed: ${(error as Error).message}`)
    }
  }

  /**
   * Restore data from backup snapshot
   */
  async restoreBackup(backupId: string, options: { tasks?: boolean; projects?: boolean; canvas?: boolean } = {}): Promise<void> {
    try {
      console.log(`🔄 Restoring from backup: ${backupId}`)

      const backup = await this.db.get(backupId) as BackupSnapshot
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`)
      }

      // Decompress if needed
      const data = backup.compressed ? this.decompressData(backup.data) : backup.data

      // Validate checksum
      const currentChecksum = this.calculateChecksum(data)
      if (currentChecksum !== backup.checksum) {
        console.warn('⚠️ Backup checksum mismatch - data may be corrupted')
      }

      const restoreOptions = { tasks: true, projects: true, canvas: true, ...options }
      const dataSource = this.ensureDataSource()

      // Restore data based on options
      if (restoreOptions.tasks && data.tasks) {
        await dataSource.save('tasks', data.tasks)
        console.log('✅ Tasks restored from backup')
      }

      if (restoreOptions.projects && data.projects) {
        await dataSource.save('projects', data.projects)
        console.log('✅ Projects restored from backup')
      }

      if (restoreOptions.canvas && data.canvas) {
        await dataSource.save('canvas', data.canvas)
        console.log('✅ Canvas restored from backup')
      }

      console.log('✅ Backup restoration completed')
    } catch (error) {
      console.error('❌ Failed to restore backup:', error)
      throw new Error(`Backup restoration failed: ${(error as Error).message}`)
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupSnapshot[]> {
    try {
      const result = await this.db.allDocs({
        include_docs: true,
        descending: true
      })

      return result.rows
        .map(row => row.doc as unknown as BackupSnapshot)
        .filter(doc => doc.id.startsWith('backup_'))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      console.error('❌ Failed to list backups:', error)
      return []
    }
  }

  /**
   * Delete specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backup = await this.db.get(backupId)
      await this.db.remove(backup)
      console.log(`🗑️ Backup deleted: ${backupId}`)
    } catch (error) {
      console.error('❌ Failed to delete backup:', error)
    }
  }

  /**
   * Cleanup old backups based on config
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups()
      const now = Date.now()

      for (const backup of backups) {
        const age = now - backup.timestamp.getTime()
        const shouldDeleteByAge = age > this.config.maxAge
        const shouldDeleteByCount = backups.indexOf(backup) >= this.config.maxBackups

        if (shouldDeleteByAge || shouldDeleteByCount) {
          await this.deleteBackup(backup.id)
        }
      }

      console.log('🧹 Backup cleanup completed')
    } catch (error) {
      console.error('❌ Failed to cleanup backups:', error)
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    count: number
    totalSize: number
    oldestBackup?: Date
    newestBackup?: Date
  }> {
    try {
      const backups = await this.listBackups()
      const totalSize = backups.reduce((sum, backup) => {
        return sum + JSON.stringify(backup).length
      }, 0)

      return {
        count: backups.length,
        totalSize,
        oldestBackup: backups[backups.length - 1]?.timestamp,
        newestBackup: backups[0]?.timestamp
      }
    } catch (error) {
      console.error('❌ Failed to get backup stats:', error)
      return { count: 0, totalSize: 0 }
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: BackupSnapshot['data']): string {
    const str = JSON.stringify(data, Object.keys(data).sort())
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Simple data compression (placeholder - replace with proper compression)
   */
  private compressData(data: BackupSnapshot['data']): BackupSnapshot['data'] {
    // For now, just return the data as-is
    // In production, you'd use LZ-string or similar compression
    return data
  }

  /**
   * Simple data decompression (placeholder - replace with proper decompression)
   */
  private decompressData(data: BackupSnapshot['data']): BackupSnapshot['data'] {
    // For now, just return the data as-is
    // In production, you'd use LZ-string or similar decompression
    return data
  }

  /**
   * Cleanup all backups
   */
  async cleanupAllBackups(): Promise<void> {
    try {
      console.log('🧹 Cleaning up all backups...')
      const backups = await this.listBackups()

      for (const backup of backups) {
        await this.deleteBackup(backup.id)
      }

      console.log('✅ All backups cleaned up')
    } catch (error) {
      console.error('❌ Failed to cleanup all backups:', error)
    }
  }
}

// Singleton instance
let backupManagerInstance: LocalBackupManager | null = null

export const getBackupManager = (config?: Partial<BackupConfig>): LocalBackupManager => {
  if (!backupManagerInstance) {
    backupManagerInstance = new LocalBackupManager(config)
  }
  return backupManagerInstance
}