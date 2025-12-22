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
 * TASK-048: Individual Project & Section Documents Migration
 *
 * Phases:
 * - Phase 1 (DUAL_WRITE): Write to BOTH formats (safe, can rollback)
 * - Phase 2 (INDIVIDUAL_READ): Read from individual docs, write to both
 * - Phase 3 (INDIVIDUAL_ONLY): Full migration, stop writing to legacy format
 */
export const STORAGE_FLAGS = {
  // ============ TASKS (TASK-034) ============
  /**
   * When true: Save tasks to BOTH tasks:data (legacy) AND task-{id} (new)
   * This is the safest phase - can rollback by disabling flag
   * BUG-025: DISABLED - dual-write causes massive conflicts (121+ on tasks:data)
   */
  DUAL_WRITE_TASKS: import.meta.env.VITE_DUAL_WRITE_TASKS === 'true' || false, // DISABLED 2025-12-22 to fix conflicts

  /**
   * When true: Read from individual task-{id} documents instead of tasks:data
   * Only enable after confirming dual-write has populated all task-{id} docs
   */
  READ_INDIVIDUAL_TASKS: import.meta.env.VITE_READ_INDIVIDUAL_TASKS === 'true' || true, // TASK-034 Phase 4: ENABLED 2025-12-21

  /**
   * When true: Stop writing to tasks:data entirely (final phase)
   * BUG-025: ENABLED - eliminates conflict source by only using individual task-{id} docs
   */
  INDIVIDUAL_ONLY: import.meta.env.VITE_INDIVIDUAL_ONLY === 'true' || true, // ENABLED 2025-12-22 - fixes conflict root cause

  // ============ PROJECTS (TASK-048) ============
  /**
   * When true: Save projects to BOTH projects:data (legacy) AND project-{id} (new)
   * Phase 1: Safe dual-write for migration
   */
  DUAL_WRITE_PROJECTS: import.meta.env.VITE_DUAL_WRITE_PROJECTS === 'true' || true, // TASK-048: Start with dual-write

  /**
   * When true: Read from individual project-{id} documents instead of projects:data
   */
  READ_INDIVIDUAL_PROJECTS: import.meta.env.VITE_READ_INDIVIDUAL_PROJECTS === 'true' || false, // TASK-048: Enable after dual-write verified

  /**
   * When true: Stop writing to projects:data entirely
   */
  INDIVIDUAL_PROJECTS_ONLY: import.meta.env.VITE_INDIVIDUAL_PROJECTS_ONLY === 'true' || false, // TASK-048: Final phase

  // ============ CANVAS SECTIONS (TASK-048) ============
  /**
   * When true: Save sections to BOTH canvas:data (legacy) AND section-{id} (new)
   * Phase 1: Safe dual-write for migration
   */
  DUAL_WRITE_SECTIONS: import.meta.env.VITE_DUAL_WRITE_SECTIONS === 'true' || true, // TASK-048: Start with dual-write

  /**
   * When true: Read from individual section-{id} documents instead of canvas:data
   */
  READ_INDIVIDUAL_SECTIONS: import.meta.env.VITE_READ_INDIVIDUAL_SECTIONS === 'true' || false, // TASK-048: Enable after dual-write verified

  /**
   * When true: Stop writing to canvas:data entirely
   */
  INDIVIDUAL_SECTIONS_ONLY: import.meta.env.VITE_INDIVIDUAL_SECTIONS_ONLY === 'true' || false // TASK-048: Final phase
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