/**
 * 🔄 Unified Sync Architecture Types
 *
 * Comprehensive type definitions for unified sync system supporting both:
 * - Cloud backup providers (JSONBin, GitHub Gist)
 * - PouchDB/CouchDB synchronization with advanced conflict resolution
 */

import type { ConflictInfo } from './conflicts'

// ============================================================================
// CORE SYNC INTERFACES
// ============================================================================

/**
 * Main sync provider types supported by the unified system
 */
export enum SyncProviderType {
  CLOUD_BACKUP = 'cloud_backup',    // JSONBin, GitHub Gist, etc.
  COUCHDB_SYNC = 'couchdb_sync',    // PouchDB + CouchDB
  HYBRID = 'hybrid'                 // Both cloud backup + CouchDB
}

/**
 * Current sync status across all providers
 */
export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'complete'
  | 'error'
  | 'offline'
  | 'paused'
  | 'resolving_conflicts'
  | 'validating'
  | 'connecting'

/**
 * Priority levels for sync operations
 */
export type SyncPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Sync direction for bidirectional operations
 */
export type SyncDirection = 'upload' | 'download' | 'bidirectional'

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

/**
 * Base interface for all sync providers
 */
export interface SyncProvider {
  type: SyncProviderType
  name: string
  isConfigured: boolean
  isOnline: boolean
  capabilities: SyncCapabilities
  config: SyncProviderConfig
}

/**
 * Capabilities supported by each provider
 */
export interface SyncCapabilities {
  realtime: boolean          // Real-time sync support
  conflictResolution: boolean // Advanced conflict resolution
  offlineQueue: boolean      // Offline operation queuing
  validation: boolean        // Sync result validation
  encryption: boolean        // Data encryption support
  versioning: boolean        // Document versioning
  metrics: boolean          // Detailed sync metrics
  maxFileSize?: number      // Max file size in bytes
  supportedFormats?: string[] // Supported data formats
}

/**
 * Configuration for cloud backup providers
 */
export interface CloudBackupConfig {
  provider: 'jsonbin' | 'github-gist' | 'custom'
  apiKey?: string
  endpoint?: string
  headers?: Record<string, string>
  syncInterval?: number     // milliseconds
  autoSync?: boolean
  compressionEnabled?: boolean
}

/**
 * Configuration for CouchDB sync providers
 */
export interface CouchDBSyncConfig {
  url: string
  auth?: {
    username: string
    password: string
  }
  localDbName: string
  liveSync: boolean
  batchSize?: number
  batchesLimit?: number
  timeout?: number
  retryAttempts?: number
  conflictResolution?: ConflictResolutionStrategy
}

/**
 * Configuration for hybrid mode (both providers)
 */
export interface HybridSyncConfig {
  cloud: CloudBackupConfig
  couchdb: CouchDBSyncConfig
  primaryProvider: 'cloud' | 'couchdb'
  fallbackEnabled: boolean
  syncOrder: ('cloud' | 'couchdb')[]
}

/**
 * Union type for all provider configurations
 */
export type SyncProviderConfig =
  | CloudBackupConfig
  | CouchDBSyncConfig
  | HybridSyncConfig

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Core sync data package
 */
export interface SyncDataPackage {
  id: string
  type: 'tasks' | 'projects' | 'settings' | 'canvas' | 'full'
  data: unknown
  metadata: SyncDataMetadata
  timestamp: Date
  checksum: string
  deviceId: string
}

/**
 * Metadata for sync data packages
 */
export interface SyncDataMetadata {
  version: string
  dataType: string
  size: number
  compression?: 'gzip' | 'brotli' | 'none'
  encryption?: 'aes256' | 'none'
  schemaVersion?: string
  dependencies?: string[]   // Other data packages required
}

/**
 * Sync operation request
 */
export interface SyncOperation {
  id: string
  type: 'sync' | 'upload' | 'download' | 'validate' | 'resolve-conflicts'
  provider: SyncProviderType
  direction: SyncDirection
  priority: SyncPriority
  data?: SyncDataPackage
  options?: SyncOperationOptions
  createdAt: Date
  scheduledAt?: Date
  retryCount?: number
  maxRetries?: number
}

/**
 * Options for sync operations
 */
export interface SyncOperationOptions {
  force?: boolean              // Force sync even if up-to-date
  validateAfter?: boolean      // Validate after sync
  conflictStrategy?: ConflictResolutionStrategy
  timeout?: number             // Operation timeout in ms
  progressCallback?: (progress: SyncProgress) => void
  cancelToken?: CancellationToken
}

/**
 * Progress tracking for sync operations
 */
export interface SyncProgress {
  operationId: string
  status: SyncStatus
  progress: number              // 0-100
  bytesTransferred?: number
  totalBytes?: number
  itemsProcessed?: number
  totalItems?: number
  currentOperation?: string
  estimatedTimeRemaining?: number
  errors?: SyncError[]
}

/**
 * Cancellation token for async operations
 */
export interface CancellationToken {
  cancelled: boolean
  cancel: () => void
  onCancelled: (callback: () => void) => void
}

// ============================================================================
// CONFLICT HANDLING
// ============================================================================

/**
 * Import existing conflict types
 */
export type { ConflictInfo, ResolutionResult, ConflictType, ResolutionType } from './conflicts'

/**
 * Strategy for automatic conflict resolution
 */
export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  MANUAL = 'manual',
  SMART_MERGE = 'smart_merge',
  PRESERVE_BOTH = 'preserve_both',
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins'
}

/**
 * Enhanced conflict information with unified context
 */
export interface UnifiedConflictInfo extends ConflictInfo {
  provider: SyncProviderType
  affectedDataTypes: string[]
  impactAssessment: ConflictImpactAssessment
  suggestedResolutions: ConflictResolutionStrategy[]
  canAutoResolve: boolean
  requiresUserIntervention: boolean
}

/**
 * Impact assessment for conflicts
 */
export interface ConflictImpactAssessment {
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedUsers: number
  dataLossRisk: 'none' | 'partial' | 'significant' | 'total'
  functionalImpact: string[]   // Which features are affected
  urgencyLevel: 'low' | 'medium' | 'high' | 'immediate'
}

// ============================================================================
// SYNC HEALTH AND MONITORING
// ============================================================================

/**
 * Comprehensive health status for unified sync system
 */
export interface UnifiedSyncHealth {
  overall: {
    status: SyncStatus
    lastSyncTime?: Date
    uptime: number
    isHealthy: boolean
  }
  providers: ProviderHealthStatus[]
  conflicts: {
    active: number
    resolved: number
    autoResolved: number
    manualRequired: number
  }
  performance: SyncPerformanceMetrics
  errors: SyncError[]
  recommendations: SyncHealthRecommendation[]
}

/**
 * Health status for individual providers
 */
export interface ProviderHealthStatus {
  provider: SyncProviderType
  name: string
  status: SyncStatus
  isOnline: boolean
  isConfigured: boolean
  lastSyncTime?: Date
  errorMessage?: string
  successRate: number
  averageLatency: number
}

/**
 * Performance metrics for sync operations
 */
export interface SyncPerformanceMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  averageSyncTime: number
  successRate: number
  throughput: {           // bytes per second
    upload: number
    download: number
  }
  latency: {
    average: number
    p95: number
    p99: number
  }
  conflicts: {
    detectionRate: number
    resolutionRate: number
    averageResolutionTime: number
  }
}

/**
 * Health recommendations
 */
export interface SyncHealthRecommendation {
  type: 'warning' | 'error' | 'info'
  category: 'performance' | 'configuration' | 'conflicts' | 'network'
  title: string
  description: string
  action?: string
  priority: 'low' | 'medium' | 'high'
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized sync error
 */
export interface SyncError {
  code: string
  message: string
  provider: SyncProviderType
  operation?: string
  documentId?: string
  timestamp: Date
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, unknown>
  originalError?: Error
}

/**
 * Error codes for sync operations
 */
export enum SyncErrorCode {
  // Network errors
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',

  // Configuration errors
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MISSING_API_KEY = 'MISSING_API_KEY',

  // Data errors
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',

  // Conflict errors
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  CONFLICT_RESOLUTION_FAILED = 'CONFLICT_RESOLUTION_FAILED',

  // System errors
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// ============================================================================
// EVENTS AND NOTIFICATIONS
// ============================================================================

/**
 * Sync event types
 */
export enum SyncEventType {
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  SYNC_PAUSED = 'sync_paused',
  SYNC_RESUMED = 'sync_resumed',

  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',

  PROVIDER_CONNECTED = 'provider_connected',
  PROVIDER_DISCONNECTED = 'provider_disconnected',
  PROVIDER_ERROR = 'provider_error',

  DATA_VALIDATED = 'data_validated',
  DATA_MERGED = 'data_merged',

  OPERATION_QUEUED = 'operation_queued',
  OPERATION_CANCELLED = 'operation_cancelled'
}

/**
 * Sync event payload
 */
export interface SyncEvent {
  type: SyncEventType
  timestamp: Date
  provider?: SyncProviderType
  operationId?: string
  data?: unknown
  error?: SyncError
  metadata?: Record<string, unknown>
}

// ============================================================================
// CONFIGURATION AND SETTINGS
// ============================================================================

/**
 * Main configuration for unified sync system
 */
export interface UnifiedSyncConfig {
  enabled: boolean
  providers: SyncProviderConfig[]
  primaryProvider: SyncProviderType
  fallbackEnabled: boolean
  autoSync: {
    enabled: boolean
    interval: number           // milliseconds
    onlyOnWifi?: boolean
    onlyWhenCharging?: boolean
  }
  conflictResolution: {
    strategy: ConflictResolutionStrategy
    autoResolve: boolean
    notifyOnConflicts: boolean
  }
  performance: {
    maxConcurrentOperations: number
    batchSize: number
    compressionEnabled: boolean
    validationEnabled: boolean
  }
  security: {
    encryptionEnabled: boolean
    apiKeyEncryption: boolean
    dataRetentionDays?: number
  }
  monitoring: {
    metricsEnabled: boolean
    healthChecks: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
  }
}

/**
 * User preferences for sync behavior
 */
export interface SyncUserPreferences {
  enabledProviders: SyncProviderType[]
  syncFrequency: 'realtime' | 'frequent' | 'periodic' | 'manual'
  conflictNotifications: boolean
  autoResolveConflicts: boolean
  dataUsageLimits: {
    wifiOnly: boolean
    dailyLimitMB?: number
  }
  privacy: {
    analyticsEnabled: boolean
    crashReportingEnabled: boolean
  }
}

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

/**
 * Type guard for sync provider
 */
export function isSyncProvider(obj: unknown): obj is SyncProvider {
  if (!obj || typeof obj !== 'object') return false
  const p = obj as Record<string, unknown>
  return (
    Object.values(SyncProviderType).includes(p.type as SyncProviderType) &&
    typeof p.name === 'string' &&
    typeof p.isConfigured === 'boolean' &&
    typeof p.isOnline === 'boolean' &&
    typeof p.capabilities === 'object' &&
    typeof p.config === 'object'
  )
}

/**
 * Type guard for sync operation
 */
export function isSyncOperation(obj: unknown): obj is SyncOperation {
  if (!obj || typeof obj !== 'object') return false
  const op = obj as Record<string, unknown>
  return (
    typeof op.id === 'string' &&
    ['sync', 'upload', 'download', 'validate', 'resolve-conflicts'].includes(op.type as string) &&
    Object.values(SyncProviderType).includes(op.provider as SyncProviderType) &&
    ['upload', 'download', 'bidirectional'].includes(op.direction as string) &&
    ['low', 'medium', 'high', 'critical'].includes(op.priority as string)
  )
}

/**
 * Type guard for unified sync health
 */
export function isUnifiedSyncHealth(obj: unknown): obj is UnifiedSyncHealth {
  if (!obj || typeof obj !== 'object') return false
  const h = obj as Record<string, unknown>
  return (
    typeof h.overall === 'object' &&
    Array.isArray(h.providers) &&
    typeof h.conflicts === 'object' &&
    typeof h.performance === 'object' &&
    Array.isArray(h.errors)
  )
}

/**
 * Get default sync configuration
 */
export function getDefaultSyncConfig(): UnifiedSyncConfig {
  return {
    enabled: true,
    providers: [],
    primaryProvider: SyncProviderType.COUCHDB_SYNC,
    fallbackEnabled: true,
    autoSync: {
      enabled: true,
      interval: 5 * 60 * 1000, // 5 minutes
      onlyOnWifi: false,
      onlyWhenCharging: false
    },
    conflictResolution: {
      strategy: ConflictResolutionStrategy.SMART_MERGE,
      autoResolve: true,
      notifyOnConflicts: true
    },
    performance: {
      maxConcurrentOperations: 3,
      batchSize: 100,
      compressionEnabled: true,
      validationEnabled: true
    },
    security: {
      encryptionEnabled: false,
      apiKeyEncryption: true
    },
    monitoring: {
      metricsEnabled: true,
      healthChecks: true,
      logLevel: 'info'
    }
  }
}