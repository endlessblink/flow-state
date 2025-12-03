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

  // Check if CouchDB URL is explicitly configured via environment variable
  const couchdbUrl = import.meta.env.VITE_COUCHDB_URL
  const couchdbUsername = import.meta.env.VITE_COUCHDB_USERNAME
  const couchdbPassword = import.meta.env.VITE_COUCHDB_PASSWORD

  // Only enable remote sync if VITE_COUCHDB_URL is explicitly set in .env
  // This prevents CORS errors when no properly configured CouchDB is available
  if (couchdbUrl && couchdbUsername && couchdbPassword) {
    // CRITICAL: PouchDB needs an absolute URL to recognize it as a remote database
    // If the URL is relative (starts with /), prepend the current origin
    // Otherwise PouchDB creates a local IndexedDB with the path as its name!
    const isRelativeUrl = couchdbUrl.startsWith('/')
    const absoluteUrl = isRelativeUrl
      ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5546'}${couchdbUrl}`
      : couchdbUrl

    console.log('🔧 [DATABASE CONFIG] Remote sync ENABLED via environment variables')
    console.log('🔧 [DATABASE CONFIG] Original URL:', couchdbUrl)
    console.log('🔧 [DATABASE CONFIG] Absolute URL:', absoluteUrl)

    return {
      local: {
        name: 'pomoflow-app-dev'
      },
      remote: {
        url: absoluteUrl,
        auth: {
          username: couchdbUsername,
          password: couchdbPassword
        },
        batchSize: 100,
        batchesLimit: 10
      },
      sync: {
        live: true,
        retry: false, // Keep disabled - manual retry only to prevent infinite loops
        timeout: 10000,
        heartBeat: 30000
      }
    }
  }

  // Local-only mode (no remote sync = no CORS errors)
  console.log('📱 [DATABASE CONFIG] Local-only mode - no remote CouchDB configured')
  console.log('📱 [DATABASE CONFIG] To enable sync, set VITE_COUCHDB_URL, VITE_COUCHDB_USERNAME, VITE_COUCHDB_PASSWORD in .env')

  return {
    local: {
      name: 'pomoflow-app-dev'
    }
    // No remote config = no CORS errors
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
  direction: 'push' | 'pull' | 'cross-tab'
  changeCount: number
  docs: any[]
  errors?: any[]
  timestamp?: Date
  changeType?: 'create' | 'update' | 'delete'
  source?: string
}

// Database health check interface
export interface DatabaseHealth {
  isOnline: boolean
  lastSyncTime?: Date
  pendingChanges: number
  syncStatus: SyncStatus
  remoteConnected: boolean
}