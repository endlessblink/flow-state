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

/**
 * BUG-054 FIX: Get CouchDB configuration with automatic defaults
 *
 * Priority order:
 * 1. localStorage (runtime user settings from Settings UI)
 * 2. Environment variables (build-time configuration)
 * 3. Hardcoded defaults (automatic sync for personal use)
 *
 * This ensures sync works automatically on any browser without manual configuration.
 */
const DEFAULT_COUCHDB_URL = 'http://84.46.253.137:5984/pomoflow-tasks'
const DEFAULT_COUCHDB_USERNAME = 'admin'
const DEFAULT_COUCHDB_PASSWORD = 'pomoflow-2024'

const getStoredCouchDBConfig = () => {
  // Check if we're in a browser environment with localStorage
  if (typeof localStorage === 'undefined') {
    // SSR or non-browser environment - use env vars or defaults
    return {
      url: import.meta.env.VITE_COUCHDB_URL || DEFAULT_COUCHDB_URL,
      username: import.meta.env.VITE_COUCHDB_USERNAME || DEFAULT_COUCHDB_USERNAME,
      password: import.meta.env.VITE_COUCHDB_PASSWORD || DEFAULT_COUCHDB_PASSWORD
    }
  }

  // FIX: Use relative proxy path in development to bypass CORS
  // CRITICAL: PouchDB requires 'http' to use Network/HTTP adapter!
  // V3: Clean DB to avoid conflict history bloat
  const defaultUrl = import.meta.env.DEV
    ? 'http://localhost:5546/pomoflow-tasks-v3'
    : 'http://84.46.253.137:5984/pomoflow-tasks-v3'

  // Browser environment - check localStorage first, then env vars, then defaults
  // IMPORTANT: Use .trim() and check for empty strings, not just null
  const storedUrl = localStorage.getItem('pomo-couchdb-url')?.trim()
  const storedUsername = localStorage.getItem('pomo-couchdb-username')?.trim()
  const storedPassword = localStorage.getItem('pomo-couchdb-password')?.trim()

  const config = {
    url: storedUrl || import.meta.env.VITE_COUCHDB_URL || defaultUrl,
    username: storedUsername || import.meta.env.VITE_COUCHDB_USERNAME || DEFAULT_COUCHDB_USERNAME,
    password: storedPassword || import.meta.env.VITE_COUCHDB_PASSWORD || DEFAULT_COUCHDB_PASSWORD
  }

  return config
}

/**
 * Check if CouchDB sync is enabled
 * Sync is only enabled when URL, username, and password are all configured
 * (either via localStorage settings from UI or environment variables)
 */
export const isSyncEnabled = (): boolean => {
  // Sync globally disabled during PouchDB decommissioning
  return false
}

// Get configuration based on environment and user state
export const getDatabaseConfig = (userId?: string | null): DatabaseConfig => {
  // Get dynamic config each time (reads from localStorage → env vars)
  const couchConfig = getStoredCouchDBConfig()
  const syncEnabled = isSyncEnabled()

  // Determine if we should sync based on authentication
  // 1. If explicit dev flag is on, trust it
  // 2. If valid user ID is provided, allow sync (Authenticated Mode)
  // 3. Otherwise default to Guest Mode (Local Only)
  const shouldSync = syncEnabled && (
    import.meta.env.VITE_ENABLE_DEV_SYNC === 'true' ||
    (!!userId && import.meta.env.PROD)
  )

  return {
    local: {
      // FIX: Isolate dev browser from Tauri app/production
      // NEW: Total Data Insulation - include userId in local name to prevent data leaking between users/guest
      name: (import.meta.env.DEV ? 'pomoflow-app-dev' : 'pomoflow-app') + (userId ? `-${userId}` : '')
    },
    remote: shouldSync ? {
      url: couchConfig.url,
      auth: {
        username: couchConfig.username,
        password: couchConfig.password
      },
      batchSize: 100,
      batchesLimit: 10
    } : undefined,
    sync: shouldSync ? {
      live: true,
      retry: true,
      timeout: 30000,
      heartBeat: 10000
    } : undefined
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
  INDIVIDUAL_ONLY: true, // TASK-034 Phase 5: ENFORCED 2026-01-03
  READ_INDIVIDUAL_TASKS: true,

  // ============ PROJECTS (TASK-048) ============
  DUAL_WRITE_PROJECTS: false,
  READ_INDIVIDUAL_PROJECTS: true,
  INDIVIDUAL_PROJECTS_ONLY: true, // TASK-048 Phase 3: ENFORCED 2026-01-03

  // ============ CANVAS SECTIONS (TASK-048) ============
  DUAL_WRITE_SECTIONS: false,
  READ_INDIVIDUAL_SECTIONS: true,
  INDIVIDUAL_SECTIONS_ONLY: true // TASK-048 Phase 3: ENFORCED 2026-01-03
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