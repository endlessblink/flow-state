// Database configuration for PouchDB + CouchDB sync
export interface DatabaseConfig {
  local: {
    name: string
    adapter?: string
  }
  remote?: {
    url: string
    auth?: {
      username: string
      password: string
    }
    batchSize?: number
    batchesLimit?: number
  }
  sync?: {
    live: boolean
    retry: boolean
    timeout?: number
    heartBeat?: number
  }
}

// Default configuration
export const defaultDatabaseConfig: DatabaseConfig = {
  local: {
    name: 'pomoflow-app'
  },
  remote: {
    url: import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984/pomoflow-tasks',
    auth: (import.meta.env.VITE_COUCHDB_USERNAME && import.meta.env.VITE_COUCHDB_PASSWORD) ? {
      username: import.meta.env.VITE_COUCHDB_USERNAME,
      password: import.meta.env.VITE_COUCHDB_PASSWORD
    } : undefined,
    batchSize: 100,
    batchesLimit: 10
  },
  sync: {
    live: true,
    retry: true,
    timeout: 30000,
    heartBeat: 10000
  }
}

// Development configuration (local only)
export const devDatabaseConfig: DatabaseConfig = {
  local: {
    name: 'pomoflow-app-dev'
  }
}

// Production configuration (with sync)
export const prodDatabaseConfig: DatabaseConfig = {
  local: {
    name: 'pomoflow-app'
  },
  remote: {
    url: import.meta.env.VITE_COUCHDB_URL || '',
    auth: {
      username: import.meta.env.VITE_COUCHDB_USERNAME || '',
      password: import.meta.env.VITE_COUCHDB_PASSWORD || ''
    },
    batchSize: 100,
    batchesLimit: 10
  },
  sync: {
    live: true,
    retry: true,
    timeout: 30000,
    heartBeat: 10000
  }
}

// Get configuration based on environment
export const getDatabaseConfig = (): DatabaseConfig => {
  // CouchDB remote sync configuration
  const couchdbUrl = import.meta.env.VITE_COUCHDB_URL || 'http://84.46.253.137:5984/pomoflow-tasks'
  const couchdbUsername = import.meta.env.VITE_COUCHDB_USERNAME || 'admin'
  const couchdbPassword = import.meta.env.VITE_COUCHDB_PASSWORD || 'pomoflow-2024'

  console.log('🔧 [DATABASE CONFIG] URL:', couchdbUrl)

  return {
    local: {
      name: 'pomoflow-app-dev'
    },
    remote: {
      url: couchdbUrl,
      auth: {
        username: couchdbUsername,
        password: couchdbPassword
      },
      batchSize: 100,
      batchesLimit: 10
    },
    sync: {
      live: true,
      retry: true,
      timeout: 30000,
      heartBeat: 10000
    }
  }
}

// Document constants
export const DOCUMENT_TYPES = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  CANVAS: 'canvas',
  TIMER: 'timer',
  SETTINGS: 'settings'
} as const

export const DOCUMENT_IDS = {
  TASKS: `local/${DOCUMENT_TYPES.TASKS}`,
  PROJECTS: `local/${DOCUMENT_TYPES.PROJECTS}`,
  CANVAS: `local/${DOCUMENT_TYPES.CANVAS}`,
  TIMER: `local/${DOCUMENT_TYPES.TIMER}`,
  SETTINGS: `local/${DOCUMENT_TYPES.SETTINGS}`
} as const

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'error' | 'paused'

/**
 * Feature Flags for Database Storage
 *
 * TASK-034: Individual Task Documents Migration
 *
 * Phases:
 * - Phase 1 (DUAL_WRITE): Write to BOTH formats (safe, can rollback)
 * - Phase 2 (INDIVIDUAL_READ): Read from individual docs, write to both
 * - Phase 3 (INDIVIDUAL_ONLY): Full migration, stop writing to tasks:data
 */
export const STORAGE_FLAGS = {
  /**
   * When true: Save tasks to BOTH tasks:data (legacy) AND task-{id} (new)
   * This is the safest phase - can rollback by disabling flag
   */
  DUAL_WRITE_TASKS: import.meta.env.VITE_DUAL_WRITE_TASKS === 'true' || true, // Default ON for Phase 1

  /**
   * When true: Read from individual task-{id} documents instead of tasks:data
   * Only enable after confirming dual-write has populated all task-{id} docs
   */
  READ_INDIVIDUAL_TASKS: import.meta.env.VITE_READ_INDIVIDUAL_TASKS === 'true' || false, // Default OFF

  /**
   * When true: Stop writing to tasks:data entirely (final phase)
   * Only enable after READ_INDIVIDUAL_TASKS has been stable for 1+ week
   */
  INDIVIDUAL_ONLY: import.meta.env.VITE_INDIVIDUAL_ONLY === 'true' || false // Default OFF
} as const

// Sync event types
export interface SyncEvent {
  direction: 'push' | 'pull'
  changeCount: number
  docs: Record<string, unknown>[]
  errors?: unknown[]
}

// Database health check interface
export interface DatabaseHealth {
  isOnline: boolean
  lastSyncTime?: Date
  pendingChanges: number
  syncStatus: SyncStatus
  remoteConnected: boolean
}