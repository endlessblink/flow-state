// TASK-1156: Barrel re-exports for backup system modules
export { useBackupSystem, default } from './useBackupSystem'
export type {
  BackupData,
  BackupConfig,
  BackupStats,
  BackupSystemState,
  GoldenBackupValidation,
  RestoreAnalysis,
  BackupContext
} from './types'
export {
  STORAGE_KEYS,
  MAX_GOLDEN_BACKUPS,
  DATA_LOSS_THRESHOLD,
  GOLDEN_BACKUP_MAX_AGE_MS,
  BACKUP_HISTORY_TTL_MS,
  BACKUP_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  calculateChecksum,
  generateBackupId,
  formatTimestamp
} from './types'
