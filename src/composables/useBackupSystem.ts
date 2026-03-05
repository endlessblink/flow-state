// TASK-1156: This file is now a re-export barrel for backward compatibility.
// The backup system has been split into modular sub-composables under ./backup/
export { useBackupSystem, default } from './backup'
export type {
  BackupData,
  BackupConfig,
  BackupStats,
  BackupSystemState,
  GoldenBackupValidation,
  RestoreAnalysis
} from './backup'
