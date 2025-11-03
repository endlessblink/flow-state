/**
 * Persistence Service for unified data management
 *
 * Provides a high-level interface for data persistence operations,
 * coordinating between different storage mechanisms and ensuring data integrity.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

import type {
  ApiResponse,
  DatabaseOperationResult,
  PerformanceMetric
} from '@/types'
import { eventBus } from './EventBus'

/**
 * Storage configuration interface
 */
export interface StorageConfig {
  /** Primary storage method */
  primary: 'indexedDB' | 'localStorage' | 'memory'
  /** Backup storage method */
  backup?: 'localStorage' | 'memory'
  /** Whether to enable automatic backups */
  enableAutoBackup: boolean
  /** Backup interval in milliseconds */
  backupInterval: number
  /** Maximum number of backups to keep */
  maxBackups: number
  /** Whether to enable compression */
  enableCompression: boolean
}

/**
 * Data migration interface
 */
export interface DataMigration {
  /** Migration version */
  version: string
  /** Migration description */
  description: string
  /** Migration function */
  migrate: (data: any) => Promise<any>
  /** Whether migration is reversible */
  reversible: boolean
  /** Reverse migration function */
  reverse?: (data: any) => Promise<any>
}

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  /** Backup ID */
  id: string
  /** Backup timestamp */
  timestamp: Date
  /** Backup version */
  version: string
  /** Backup size in bytes */
  size: number
  /** Data types included */
  dataTypes: string[]
  /** Backup description */
  description?: string
}

/**
 * Persistence Service implementation
 * Manages data storage, backup, migration, and integrity
 */
export class PersistenceService {
  private config: StorageConfig
  private backups: Map<string, { data: any; metadata: BackupMetadata }> = new Map()
  private migrations: DataMigration[] = []
  private performanceMetrics: PerformanceMetric[] = []

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      primary: 'indexedDB',
      enableAutoBackup: true,
      backupInterval: 60000, // 1 minute
      maxBackups: 10,
      enableCompression: false,
      ...config
    }

    this.initialize()
  }

  /**
   * Initialize the persistence service
   */
  private async initialize(): Promise<void> {
    try {
      // Start auto-backup if enabled
      if (this.config.enableAutoBackup) {
        this.startAutoBackup()
      }

      // Emit initialization event
      eventBus.emit('persistence:initialized', { config: this.config })

      console.log('PersistenceService initialized with config:', this.config)
    } catch (error) {
      console.error('Failed to initialize PersistenceService:', error)
      eventBus.emit('persistence:error', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  /**
   * Save data with validation and error handling
   *
   * @param key - Storage key
   * @param data - Data to save
   * @param options - Save options
   * @returns Promise resolving to save result
   */
  async save<T>(key: string, data: T, options?: {
    compress?: boolean
    backup?: boolean
    validate?: boolean
  }): Promise<ApiResponse<void>> {
    const startTime = performance.now()

    try {
      // Validate inputs
      if (!key?.trim()) {
        return {
          success: false,
          error: 'Storage key is required',
          timestamp: new Date()
        }
      }

      if (data === undefined || data === null) {
        return {
          success: false,
          error: 'Data cannot be null or undefined',
          timestamp: new Date()
        }
      }

      // Emit save start event
      eventBus.emit('persistence:saving', { key, options })

      // Validate data if requested
      if (options?.validate !== false) {
        const validation = this.validateData(data)
        if (!validation.isValid) {
          return {
            success: false,
            error: 'Data validation failed',
            details: { errors: validation.errors }
          }
        }
      }

      // Prepare data for storage
      let serializedData = JSON.stringify(data)

      // Compress if requested and enabled
      if ((options?.compress ?? this.config.enableCompression) && serializedData.length > 1024) {
        serializedData = await this.compressData(serializedData)
      }

      // Save to primary storage
      const saveResult = await this.saveToStorage(this.config.primary, key, serializedData)

      if (!saveResult.success) {
        // Try backup storage if primary fails
        if (this.config.backup) {
          const backupResult = await this.saveToStorage(this.config.backup, key, serializedData)
          if (!backupResult.success) {
            return {
              success: false,
              error: 'Failed to save to both primary and backup storage',
              details: { primaryError: saveResult.error, backupError: backupResult.error }
            }
          }
        } else {
          return saveResult
        }
      }

      // Create backup if requested
      if (options?.backup !== false && this.config.enableAutoBackup) {
        await this.createBackup(key, data)
      }

      // Record performance metric
      const duration = performance.now() - startTime
      this.recordPerformanceMetric('save', duration, { key, dataSize: serializedData.length })

      // Emit save success event
      eventBus.emit('persistence:saved', { key, duration, size: serializedData.length })

      return {
        success: true,
        timestamp: new Date()
      }
    } catch (error) {
      const duration = performance.now() - startTime

      // Record error metric
      this.recordPerformanceMetric('save_error', duration, { key, error: error instanceof Error ? error.message : 'Unknown error' })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Load data with validation and error handling
   *
   * @param key - Storage key
   * @param options - Load options
   * @returns Promise resolving to loaded data or error
   */
  async load<T>(key: string, options?: {
    fallbackToBackup?: boolean
    validate?: boolean
  }): Promise<ApiResponse<T>> {
    const startTime = performance.now()

    try {
      // Validate inputs
      if (!key?.trim()) {
        return {
          success: false,
          error: 'Storage key is required',
          timestamp: new Date()
        }
      }

      // Emit load start event
      eventBus.emit('persistence:loading', { key, options })

      // Try primary storage first
      let loadData = await this.loadFromStorage(this.config.primary, key)
      let storageUsed = this.config.primary

      // Try backup storage if primary fails and fallback is enabled
      if (!loadData.success && options?.fallbackToBackup !== false && this.config.backup) {
        loadData = await this.loadFromStorage(this.config.backup, key)
        storageUsed = this.config.backup
      }

      if (!loadData.success) {
        return {
          success: false,
          error: loadData.error || 'Data not found',
          timestamp: new Date()
        }
      }

      // Decompress if needed
      let deserializedData = loadData.data!
      if (this.config.enableCompression && deserializedData.length > 1024) {
        try {
          deserializedData = await this.decompressData(deserializedData)
        } catch (error) {
          console.warn('Failed to decompress data, treating as plain JSON:', error)
        }
      }

      // Parse JSON
      let parsedData: T
      try {
        parsedData = JSON.parse(deserializedData)
      } catch (error) {
        return {
          success: false,
          error: 'Failed to parse stored data',
          details: { parseError: error instanceof Error ? error.message : 'Unknown error' }
        }
      }

      // Validate data if requested
      if (options?.validate !== false) {
        const validation = this.validateData(parsedData)
        if (!validation.isValid) {
          return {
            success: false,
            error: 'Loaded data validation failed',
            details: { errors: validation.errors }
          }
        }
      }

      // Record performance metric
      const duration = performance.now() - startTime
      this.recordPerformanceMetric('load', duration, { key, storageUsed, dataSize: deserializedData.length })

      // Emit load success event
      eventBus.emit('persistence:loaded', { key, duration, storageUsed })

      return {
        success: true,
        data: parsedData,
        timestamp: new Date()
      }
    } catch (error) {
      const duration = performance.now() - startTime

      // Record error metric
      this.recordPerformanceMetric('load_error', duration, { key, error: error instanceof Error ? error.message : 'Unknown error' })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Delete data from storage
   *
   * @param key - Storage key to delete
   * @returns Promise resolving to delete result
   */
  async delete(key: string): Promise<ApiResponse<void>> {
    try {
      if (!key?.trim()) {
        return {
          success: false,
          error: 'Storage key is required',
          timestamp: new Date()
        }
      }

      // Emit delete start event
      eventBus.emit('persistence:deleting', { key })

      // Delete from primary storage
      const deleteResult = await this.deleteFromStorage(this.config.primary, key)

      // Delete from backup storage if configured
      if (this.config.backup) {
        await this.deleteFromStorage(this.config.backup, key)
      }

      // Remove backups for this key
      this.removeBackupsForKey(key)

      if (deleteResult.success) {
        eventBus.emit('persistence:deleted', { key })
      }

      return deleteResult
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Create a backup of data
   *
   * @param key - Storage key
   * @param data - Data to backup
   * @param description - Backup description
   * @returns Promise resolving to backup result
   */
  async createBackup(key: string, data: any, description?: string): Promise<ApiResponse<string>> {
    try {
      const backupId = `backup_${key}_${Date.now()}`
      const serializedData = JSON.stringify(data)

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        version: '1.0.0',
        size: serializedData.length,
        dataTypes: [this.getDataType(data)],
        description
      }

      this.backups.set(backupId, { data, metadata })

      // Cleanup old backups
      this.cleanupOldBackups()

      // Emit backup created event
      eventBus.emit('persistence:backup:created', { backupId, key, metadata })

      return {
        success: true,
        data: backupId,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Restore data from backup
   *
   * @param backupId - Backup ID to restore
   * @returns Promise resolving to restore result
   */
  async restoreFromBackup(backupId: string): Promise<ApiResponse<any>> {
    try {
      const backup = this.backups.get(backupId)
      if (!backup) {
        return {
          success: false,
          error: 'Backup not found',
          timestamp: new Date()
        }
      }

      // Emit restore start event
      eventBus.emit('persistence:backup:restoring', { backupId })

      return {
        success: true,
        data: backup.data,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }
    }
  }

  /**
   * Register a data migration
   *
   * @param migration - Migration to register
   */
  registerMigration(migration: DataMigration): void {
    this.migrations.push(migration)
    this.migrations.sort((a, b) => a.version.localeCompare(b.version))
  }

  /**
   * Get performance statistics
   *
   * @returns Performance metrics
   */
  getPerformanceStats(): {
    averageSaveTime: number
    averageLoadTime: number
    totalOperations: number
    errorRate: number
  } {
    const saveMetrics = this.performanceMetrics.filter(m => m.name === 'save')
    const loadMetrics = this.performanceMetrics.filter(m => m.name === 'load')
    const errorMetrics = this.performanceMetrics.filter(m => m.name.includes('error'))

    const averageSaveTime = saveMetrics.length > 0
      ? saveMetrics.reduce((sum, m) => sum + m.value, 0) / saveMetrics.length
      : 0

    const averageLoadTime = loadMetrics.length > 0
      ? loadMetrics.reduce((sum, m) => sum + m.value, 0) / loadMetrics.length
      : 0

    const totalOperations = this.performanceMetrics.length
    const errorRate = totalOperations > 0 ? errorMetrics.length / totalOperations : 0

    return {
      averageSaveTime,
      averageLoadTime,
      totalOperations,
      errorRate
    }
  }

  /**
   * Save data to specific storage mechanism
   */
  private async saveToStorage(storage: string, key: string, data: string): Promise<DatabaseOperationResult> {
    const startTime = performance.now()

    try {
      switch (storage) {
        case 'indexedDB':
          return await this.saveToIndexedDB(key, data)
        case 'localStorage':
          return this.saveToLocalStorage(key, data)
        case 'memory':
          return this.saveToMemory(key, data)
        default:
          throw new Error(`Unsupported storage type: ${storage}`)
      }
    } catch (error) {
      const duration = performance.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      }
    }
  }

  /**
   * Load data from specific storage mechanism
   */
  private async loadFromStorage(storage: string, key: string): Promise<DatabaseOperationResult> {
    const startTime = performance.now()

    try {
      switch (storage) {
        case 'indexedDB':
          return await this.loadFromIndexedDB(key)
        case 'localStorage':
          return this.loadFromLocalStorage(key)
        case 'memory':
          return this.loadFromMemory(key)
        default:
          throw new Error(`Unsupported storage type: ${storage}`)
      }
    } catch (error) {
      const duration = performance.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      }
    }
  }

  /**
   * Delete data from specific storage mechanism
   */
  private async deleteFromStorage(storage: string, key: string): Promise<ApiResponse<void>> {
    try {
      switch (storage) {
        case 'indexedDB':
          return await this.deleteFromIndexedDB(key)
        case 'localStorage':
          return this.deleteFromLocalStorage(key)
        case 'memory':
          return this.deleteFromMemory(key)
        default:
          throw new Error(`Unsupported storage type: ${storage}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  // Storage implementation methods (simplified for this example)
  private async saveToIndexedDB(key: string, data: string): Promise<DatabaseOperationResult> {
    // This would integrate with the actual IndexedDB implementation
    // For now, return a placeholder result
    return { success: true, duration: 10 }
  }

  private async loadFromIndexedDB(key: string): Promise<DatabaseOperationResult> {
    // This would integrate with the actual IndexedDB implementation
    // For now, return a placeholder result
    return { success: false, error: 'Not implemented', duration: 5 }
  }

  private async deleteFromIndexedDB(key: string): Promise<ApiResponse<void>> {
    // This would integrate with the actual IndexedDB implementation
    return { success: true, timestamp: new Date() }
  }

  private saveToLocalStorage(key: string, data: string): DatabaseOperationResult {
    try {
      localStorage.setItem(key, data)
      return { success: true, duration: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: 1
      }
    }
  }

  private loadFromLocalStorage(key: string): DatabaseOperationResult {
    try {
      const data = localStorage.getItem(key)
      if (data === null) {
        return { success: false, error: 'Key not found', duration: 1 }
      }
      return { success: true, data, duration: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: 1
      }
    }
  }

  private deleteFromLocalStorage(key: string): ApiResponse<void> {
    try {
      localStorage.removeItem(key)
      return { success: true, timestamp: new Date() }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  // Memory storage implementation
  private memoryStorage: Map<string, string> = new Map()

  private saveToMemory(key: string, data: string): DatabaseOperationResult {
    this.memoryStorage.set(key, data)
    return { success: true, duration: 0.1 }
  }

  private loadFromMemory(key: string): DatabaseOperationResult {
    const data = this.memoryStorage.get(key)
    if (data === undefined) {
      return { success: false, error: 'Key not found', duration: 0.1 }
    }
    return { success: true, data, duration: 0.1 }
  }

  private deleteFromMemory(key: string): ApiResponse<void> {
    this.memoryStorage.delete(key)
    return { success: true, timestamp: new Date() }
  }

  // Utility methods
  private async compressData(data: string): Promise<string> {
    // This would implement actual compression
    // For now, return data as-is
    return data
  }

  private async decompressData(data: string): Promise<string> {
    // This would implement actual decompression
    // For now, return data as-is
    return data
  }

  private validateData(data: any): { isValid: boolean; errors: string[] } {
    // Basic validation - can be extended
    const errors: string[] = []

    try {
      JSON.stringify(data)
    } catch (error) {
      errors.push('Data is not serializable')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private getDataType(data: any): string {
    if (Array.isArray(data)) return 'array'
    if (typeof data === 'object' && data !== null) return 'object'
    return typeof data
  }

  private startAutoBackup(): void {
    setInterval(() => {
      eventBus.emit('persistence:backup:auto')
    }, this.config.backupInterval)
  }

  private cleanupOldBackups(): void {
    if (this.backups.size <= this.config.maxBackups) return

    const sortedBackups = Array.from(this.backups.entries())
      .sort(([, a], [, b]) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime())

    const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - this.config.maxBackups)

    for (const [backupId] of backupsToDelete) {
      this.backups.delete(backupId)
    }
  }

  private removeBackupsForKey(key: string): void {
    const backupsToDelete: string[] = []

    for (const [backupId, { metadata }] of this.backups) {
      if (backupId.startsWith(`backup_${key}_`)) {
        backupsToDelete.push(backupId)
      }
    }

    for (const backupId of backupsToDelete) {
      this.backups.delete(backupId)
    }
  }

  private recordPerformanceMetric(name: string, value: number, context?: any): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit: 'ms',
      timestamp: new Date(),
      context
    }

    this.performanceMetrics.push(metric)

    // Keep only last 1000 metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics.shift()
    }
  }
}

// Create singleton instance
export const persistenceService = new PersistenceService()

// Export type for dependency injection
export type PersistenceServiceInterface = PersistenceService

/**
 * Composable for using the persistence service
 * Provides a Vue-friendly interface to the persistence service
 */
export function usePersistenceService() {
  return {
    // Core operations
    save: persistenceService.save.bind(persistenceService),
    load: persistenceService.load.bind(persistenceService),
    delete: persistenceService.delete.bind(persistenceService),

    // Backup operations
    createBackup: persistenceService.createBackup.bind(persistenceService),
    restoreFromBackup: persistenceService.restoreFromBackup.bind(persistenceService),

    // Migration and stats
    registerMigration: persistenceService.registerMigration.bind(persistenceService),
    getPerformanceStats: persistenceService.getPerformanceStats.bind(persistenceService)
  }
}