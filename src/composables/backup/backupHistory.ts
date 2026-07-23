import { STORAGE_KEYS, BACKUP_HISTORY_TTL_MS } from './types'
import type { BackupContext, BackupData } from './types'

export interface HistoryOperations {
  saveToHistory: (backup: BackupData) => boolean
  loadHistory: () => void
  getLatestBackup: () => BackupData | null
  clearHistory: () => void
}

export function createHistoryOperations(ctx: BackupContext): HistoryOperations {
  /**
   * Save backup to history (localStorage)
   */
  function saveToHistory(backup: BackupData): boolean {
    const previousHistory = [...ctx.backupHistory.value]
    try {
      // Add to beginning of history
      ctx.backupHistory.value.unshift(backup)

      // Trim to max size
      if (ctx.backupHistory.value.length > ctx.config.value.maxHistorySize) {
        ctx.backupHistory.value = ctx.backupHistory.value.slice(0, ctx.config.value.maxHistorySize)
      }

      // Save to localStorage — handle quota overflow by trimming oldest entries
      const serialized = JSON.stringify(ctx.backupHistory.value)
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, serialized)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.warn('[Backup] localStorage quota exceeded — trimming oldest backups and retrying')
          let persisted = false
          while (ctx.backupHistory.value.length > 1) {
            ctx.backupHistory.value.pop()
            try {
              localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(ctx.backupHistory.value))
              persisted = true
              break
            } catch { continue }
          }
          if (!persisted) throw e
        } else {
          throw e
        }
      }

      try {
        localStorage.setItem(STORAGE_KEYS.LATEST, JSON.stringify(backup))
      } catch {
        // Non-critical if latest can't be saved
      }

      ctx.stats.value.historyCount = ctx.backupHistory.value.length
      const durableHistory: BackupData[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]'
      )
      const durableBackup = durableHistory.find(item => item.id === backup.id)
      if (!durableBackup || durableBackup.checksum !== backup.checksum) {
        throw new Error('Backup history write could not be verified')
      }
      return true

    } catch (error) {
      ctx.backupHistory.value = previousHistory
      ctx.stats.value.historyCount = previousHistory.length
      console.error('[Backup] Failed to save to history:', error)
      return false
    }
  }

  /**
   * Load backup history from localStorage
   * TASK-156: Added TTL pruning for old backups
   */
  function loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
      if (stored) {
        const rawHistory: BackupData[] = JSON.parse(stored)
        const now = Date.now()

        // TASK-156: Filter out backups older than TTL (30 days)
        const validBackups: BackupData[] = []
        const expiredBackups: BackupData[] = []

        for (const backup of rawHistory) {
          const age = now - backup.timestamp
          if (age > BACKUP_HISTORY_TTL_MS) {
            expiredBackups.push(backup)
          } else {
            validBackups.push(backup)
          }
        }

        ctx.backupHistory.value = validBackups
        ctx.stats.value.historyCount = validBackups.length

        // Log pruned backups
        if (expiredBackups.length > 0) {
          console.log(`🧹 [TASK-156] Pruned ${expiredBackups.length} backups older than 30 days`)
          // Save updated history without expired backups
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(validBackups))
        }
      }

      // Load last backup time from latest
      const latest = localStorage.getItem(STORAGE_KEYS.LATEST)
      if (latest) {
        const latestBackup = JSON.parse(latest)
        ctx.stats.value.lastBackupTime = latestBackup.timestamp
      }
    } catch (error) {
      console.error('[Backup] Failed to load history:', error)
    }
  }

  /**
   * Get the latest backup
   */
  function getLatestBackup(): BackupData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LATEST)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('[Backup] Failed to get latest backup:', error)
      return null
    }
  }

  /**
   * Clear all backup history
   */
  function clearHistory(): void {
    ctx.backupHistory.value = []
    localStorage.removeItem(STORAGE_KEYS.HISTORY)
    localStorage.removeItem(STORAGE_KEYS.LATEST)
    ctx.stats.value.historyCount = 0
  }

  return {
    saveToHistory,
    loadHistory,
    getLatestBackup,
    clearHistory
  }
}
