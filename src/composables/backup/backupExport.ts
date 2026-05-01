import type { BackupContext, BackupData } from './types'
import type { CoreOperations } from './backupCore'
import type { RestoreOperations } from './backupRestore'
import type { HistoryOperations } from './backupHistory'

export interface ExportOperations {
  exportBackup: () => Promise<string>
  importBackup: (jsonString: string) => Promise<boolean>
  downloadBackup: (backup?: BackupData) => Promise<void>
  restoreFromFile: (file: File) => Promise<boolean>
}

export function createExportOperations(
  ctx: BackupContext,
  coreOps: CoreOperations,
  restoreOps: RestoreOperations,
  historyOps: HistoryOperations
): ExportOperations {
  /**
   * Export backup as JSON string
   */
  async function exportBackup(): Promise<string> {
    const backup = await coreOps.createBackup('manual')
    if (!backup) {
      throw new Error('Failed to create backup for export')
    }

    return JSON.stringify({
      ...backup,
      metadata: {
        ...backup.metadata,
        exportedAt: new Date().toISOString()
      }
    }, null, 2)
  }

  /**
   * Import backup from JSON string
   * TASK-344: Updated to handle new restore signature
   */
  async function importBackup(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString)
      const result = await restoreOps.restoreBackup(data, { dryRun: false, backupSource: 'import' })
      return result === true
    } catch (error) {
      console.error('[Backup] Import failed:', error)
      ctx.state.value.error = 'Invalid backup file format'
      return false
    }
  }

  /** Download backup as a browser file. */
  async function downloadBackup(backup?: BackupData): Promise<void> {
    const data = backup || historyOps.getLatestBackup()
    if (!data) {
      throw new Error('No backup available to download')
    }

    const filename = `flow-state-backup-${new Date().toISOString().split('T')[0]}.json`
    const content = JSON.stringify(data, null, 2)

    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log('[Backup] Downloaded:', filename)
  }

  /**
   * Restore from uploaded file
   */
  async function restoreFromFile(file: File): Promise<boolean> {
    try {
      const text = await file.text()
      return await importBackup(text)
    } catch (error) {
      console.error('[Backup] Failed to restore from file:', error)
      ctx.state.value.error = 'Failed to read backup file'
      return false
    }
  }

  return {
    exportBackup,
    importBackup,
    downloadBackup,
    restoreFromFile
  }
}
