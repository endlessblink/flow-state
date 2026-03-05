import { isTauri } from '@/composables/useTauriStartup'
import { FILE_DIALOG_TIMEOUT_MS } from '@/config/timing'
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

  /**
   * Download backup as file
   * BUG-336: Fixed for Tauri - uses native file dialog instead of browser download
   */
  async function downloadBackup(backup?: BackupData): Promise<void> {
    const data = backup || historyOps.getLatestBackup()
    if (!data) {
      throw new Error('No backup available to download')
    }

    const filename = `flow-state-backup-${new Date().toISOString().split('T')[0]}.json`
    const content = JSON.stringify(data, null, 2)

    // BUG-336: Use Tauri dialog for file save in desktop app
    if (isTauri()) {
      console.log('[Backup] Tauri detected, attempting native save dialog...')

      try {
        // Method 1: Try dynamic imports (preferred)
        console.log('[Backup] Importing Tauri plugins...')
        const dialogModule = await import('@tauri-apps/plugin-dialog')
        const fsModule = await import('@tauri-apps/plugin-fs')
        const pathModule = await import('@tauri-apps/api/path')

        console.log('[Backup] Plugins loaded successfully')

        // Get downloads directory for default path
        let defaultPath = filename
        try {
          const downloadsPath = await pathModule.downloadDir()
          // Ensure proper path separator (join not available in path module)
          const separator = downloadsPath.includes('\\') ? '\\' : '/'
          const cleanPath = downloadsPath.endsWith(separator) ? downloadsPath : downloadsPath + separator
          defaultPath = `${cleanPath}${filename}`
          console.log('[Backup] Default path:', defaultPath)
        } catch (pathError) {
          console.warn('[Backup] Could not get downloads dir, using filename only:', pathError)
        }

        // Open save dialog - the selected path is automatically added to FS scope
        // TASK-332: Add timeout to prevent hanging on XDG Portal issues
        console.log('[Backup] Opening save dialog...')

        const dialogPromise = dialogModule.save({
          defaultPath,
          filters: [{
            name: 'JSON',
            extensions: ['json']
          }]
        })

        // Race against a 30-second timeout (XDG Portal can sometimes hang)
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Dialog timeout after 30s - falling back to browser')), FILE_DIALOG_TIMEOUT_MS)
        })

        const filePath = await Promise.race([dialogPromise, timeoutPromise])

        console.log('[Backup] Dialog result:', filePath)

        if (filePath) {
          // Write file to selected path (scope automatically granted by dialog)
          console.log('[Backup] Writing file to:', filePath)
          await fsModule.writeTextFile(filePath, content)
          console.log('[Backup] Downloaded successfully (Tauri):', filePath)
        } else {
          console.log('[Backup] Download cancelled by user')
        }
        return
      } catch (error) {
        console.error('[Backup] Tauri save failed:', error)

        // Method 2: Try global __TAURI__ object as fallback
        const win = window as unknown as any
        if (win.__TAURI__?.dialog?.save && win.__TAURI__?.fs?.writeTextFile) {
          console.log('[Backup] Attempting fallback via __TAURI__ global...')
          try {
            const filePath = await win.__TAURI__.dialog.save({
              defaultPath: filename,
              filters: [{ name: 'JSON', extensions: ['json'] }]
            })
            if (filePath) {
              await win.__TAURI__.fs.writeTextFile(filePath, content)
              console.log('[Backup] Downloaded via __TAURI__ global:', filePath)
              return
            }
          } catch (fallbackError) {
            console.error('[Backup] __TAURI__ fallback also failed:', fallbackError)
          }
        }

        console.warn('[Backup] All Tauri methods failed, falling back to browser download')
        // Fall through to browser method
      }
    }

    // Browser fallback method
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
