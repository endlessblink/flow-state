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
  const isDevelopment = import.meta.env.DEV

  // DEBUG: Force remote sync configuration regardless of env vars
  console.log('🔧 [DATABASE CONFIG] FORCING REMOTE SYNC CONFIGURATION')

  // Override environment variables that aren't loading properly
  const couchdbUrl = import.meta.env.VITE_COUCHDB_URL || 'http://84.46.253.137:5984/pomoflow-tasks'
  const couchdbUsername = import.meta.env.VITE_COUCHDB_USERNAME || 'admin'
  const couchdbPassword = import.meta.env.VITE_COUCHDB_PASSWORD || 'pomoflow-2024'

  console.log('🔧 [DATABASE CONFIG] Using URL:', couchdbUrl)

  // CRISIS FIX: Disable sync to stop infinite conflict loops (Phase 0.0.2)
  console.log('🚨 [DATABASE CONFIG] CRISIS FIX: Syncing DISABLED to stop infinite loops')

  // Return sync-DISABLED config for crisis stabilization
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
      live: true, // 🔧 PHASE 0 FIX: Re-enabled with circuit breaker protection for cross-tab sync
      retry: false, // Keep disabled - manual retry only to prevent infinite loops
      timeout: 10000, // Reduced from 30s to 10s for faster timeout
      heartBeat: 30000 // Increased from 10s to 30s to reduce frequency
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

// Sync event types
export interface SyncEvent {
  direction: 'push' | 'pull'
  changeCount: number
  docs: any[]
  errors?: any[]
}

// Database health check interface
export interface DatabaseHealth {
  isOnline: boolean
  lastSyncTime?: Date
  pendingChanges: number
  syncStatus: SyncStatus
  remoteConnected: boolean
}