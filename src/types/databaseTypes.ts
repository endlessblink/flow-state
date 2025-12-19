/**
 * Shared Database Types
 *
 * This file contains interfaces shared between database-related modules
 * to prevent circular dependencies between:
 * - useDatabase.ts
 * - useReliableSyncManager.ts
 * - localBackupManager.ts
 *
 * TASK-020: Created to break circular dependency chain
 */

/**
 * Interface for data source operations
 * Used by LocalBackupManager to access database without direct import
 */
export interface IBackupDataSource {
  load<T>(key: string): Promise<T | null>
  save<T>(key: string, data: T): Promise<void>
}

/**
 * Backup snapshot structure
 */
export interface BackupSnapshot {
  id: string
  timestamp: Date
  operation: 'sync' | 'conflict_resolution' | 'bulk_update'
  data: {
    tasks?: unknown[]
    projects?: unknown[]
    canvas?: unknown
  }
  checksum: string
  compressed: boolean
}

/**
 * Backup configuration options
 */
export interface BackupConfig {
  maxBackups: number          // Maximum number of backups to keep
  maxAge: number              // Maximum age in milliseconds (default: 7 days)
  compressThreshold: number   // Size threshold for compression in bytes
  autoCleanup: boolean        // Automatically clean old backups
}

/**
 * Database document interface for PouchDB operations
 */
export interface PouchDBDocument {
  _id: string
  _rev?: string
  data?: unknown
  updatedAt?: string
}
