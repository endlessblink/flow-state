import IntegrityService from '@/utils/integrity'
import type { Task, Project } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'
import type { Ref } from 'vue'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BackupData {
  id: string
  tasks: Task[]
  projects: Project[]
  groups: CanvasGroup[]
  /** App settings snapshot (Bug 3 fix). Sensitive fields excluded at capture time. */
  settings?: Record<string, unknown>
  timestamp: number
  version: string
  checksum: string
  type: 'auto' | 'manual' | 'emergency'
  metadata?: {
    taskCount: number
    projectCount: number
    groupCount: number
    size?: number
    exportedAt?: string
  }
}

export interface BackupConfig {
  enabled: boolean
  autoSaveInterval: number // milliseconds (default: 5 min)
  maxHistorySize: number   // max backups to keep (default: 10)
  filterMockTasks: boolean // remove mock/test tasks (default: true)
}

export interface BackupStats {
  lastBackupTime: number | null
  totalBackups: number
  isBackupInProgress: boolean
  historyCount: number
}

export interface BackupSystemState {
  isReady: boolean
  isRestoring: boolean
  restoreProgress: number
  error: string | null
}

// TASK-153: Types for golden backup validation
export interface GoldenBackupValidation {
  isValid: boolean
  ageMs: number
  ageWarning: string | null
  preview: {
    tasks: { total: number; filtered: number; toRestore: number }
    projects: { total: number; filtered: number; toRestore: number }
    groups: { total: number; filtered: number; toRestore: number }
  }
  warnings: string[]
}

// TASK-344: Dry-run restore analysis result
export interface RestoreAnalysis {
  backup: BackupData
  tasks: {
    total: number
    available: number      // Can be created
    existsActive: number   // Already exists (active)
    existsDeleted: number  // Already exists (soft-deleted)
    tombstoned: number     // Permanently deleted - cannot restore
    toRestore: Task[]      // Tasks that will be restored
    skipped: Array<{ task: Task; reason: string }>  // Tasks that will be skipped
  }
  projects: {
    total: number
    toRestore: number
    skipped: number
  }
  groups: {
    total: number
    toRestore: number
    skipped: number
  }
  warnings: string[]
  canProceed: boolean
}

// ============================================================================
// Constants
// ============================================================================

export const STORAGE_KEYS = {
  HISTORY: 'flowstate-backup-history',
  LATEST: 'flowstate-backup-latest',
  STATS: 'flowstate-backup-stats',
  // BUG-059 FIX: Golden backup that can NEVER be overwritten by auto-backups
  // Only updated when manually triggered OR when task count reaches new maximum
  GOLDEN: 'flowstate-backup-golden',
  // TASK-332: Array of golden backups for rotation (keeps last 3 peaks)
  GOLDEN_ROTATION: 'flowstate-backup-golden-rotation',
  // Tracks the maximum task count ever seen - used to detect data loss
  MAX_TASK_COUNT: 'flowstate-max-task-count'
} as const

// TASK-332: Maximum number of golden backups to keep in rotation
export const MAX_GOLDEN_BACKUPS = 3

// BUG-059 FIX: Threshold for detecting suspicious data loss
// If new backup has less than this % of previous max tasks, block auto-backup
export const DATA_LOSS_THRESHOLD = 0.5 // 50%

// TASK-153: Maximum age for golden backup before warning (7 days in ms)
export const GOLDEN_BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// TASK-156: Maximum age for backup history entries (30 days in ms)
export const BACKUP_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000

// TASK-156: Current backup schema version
export const BACKUP_SCHEMA_VERSION = '3.2.0'

export const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  autoSaveInterval: 5 * 60 * 1000, // 5 minutes
  maxHistorySize: 10,
  filterMockTasks: true
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate simple checksum for data integrity verification
 */
export function calculateChecksum(data: unknown): string {
  const serialized = JSON.stringify(data)
  const jsonStableData = serialized === undefined ? null : JSON.parse(serialized)
  return IntegrityService.calculateChecksum(jsonStableData)
}

/**
 * Generate unique backup ID
 */
export function generateBackupId(): string {
  return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Format timestamp to human-readable string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// ============================================================================
// BackupContext (Factory Pattern)
// ============================================================================

export interface BackupContext {
  config: Ref<BackupConfig>
  state: Ref<BackupSystemState>
  stats: Ref<BackupStats>
  backupHistory: Ref<BackupData[]>
  taskStore: any
  projectStore: any
  canvasStore: any
  db: any
}
