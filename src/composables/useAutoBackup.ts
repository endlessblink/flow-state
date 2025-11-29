import { ref, onMounted, onUnmounted } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'

export interface BackupData {
  tasks: any[]
  projects: any[]
  canvas: any[]
  timestamp: number
  version: string
}

interface BackupHistory {
  backups: BackupData[]
  maxSize: number
}

export function useAutoBackup() {
  const db = useDatabase()
  const isBackupEnabled = ref(true)
  const lastBackupTime = ref<number | null>(null)
  const backupHistory = ref<BackupData[]>([])
  const maxBackupHistory = 10

  // Generate backup
  const createBackup = async (): Promise<BackupData> => {
    console.log('💾 Creating automatic backup...')

    try {
      const [tasks, projects, canvas] = await Promise.all([
        db.load(DB_KEYS.TASKS),
        db.load(DB_KEYS.PROJECTS),
        db.load(DB_KEYS.CANVAS)
      ])

      const backup: BackupData = {
        tasks: Array.isArray(tasks) ? tasks : [],
        projects: Array.isArray(projects) ? projects : [],
        canvas: Array.isArray(canvas) ? canvas : [],
        timestamp: Date.now(),
        version: '1.0.0'
      }

      console.log(`✅ Backup created with ${backup.tasks.length} tasks`)
      return backup

    } catch (error) {
      console.error('❌ Failed to create backup:', error)
      throw error
    }
  }

  // Save backup to localStorage
  const saveBackupToStorage = (backup: BackupData): void => {
    try {
      // Load existing backup history
      const existingHistory = loadBackupHistory()

      // Add new backup to beginning
      existingHistory.unshift(backup)

      // Trim to max history size
      if (existingHistory.length > maxBackupHistory) {
        existingHistory.splice(maxBackupHistory)
      }

      // Save to localStorage
      localStorage.setItem('pomo-flow-auto-backups', JSON.stringify(existingHistory))

      // Also save latest backup for quick restore
      localStorage.setItem('pomo-flow-latest-backup', JSON.stringify(backup))

      lastBackupTime.value = backup.timestamp
      backupHistory.value = existingHistory

      console.log(`💾 Backup saved to localStorage (${existingHistory.length} backups in history)`)

    } catch (error) {
      console.error('❌ Failed to save backup to localStorage:', error)
    }
  }

  // Load backup history from localStorage
  const loadBackupHistory = (): BackupData[] => {
    try {
      const stored = localStorage.getItem('pomo-flow-auto-backups')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('❌ Failed to load backup history:', error)
      return []
    }
  }

  // Restore from backup
  const restoreFromBackup = async (backup: BackupData): Promise<void> => {
    console.log('🔄 Restoring from backup...')

    try {
      // Verify backup integrity
      if (!backup.tasks || !backup.projects || !backup.canvas) {
        throw new Error('Invalid backup: missing required data')
      }

      // Use atomic transaction for restore
      await db.atomicTransaction([
        () => db.save(DB_KEYS.TASKS, backup.tasks),
        () => db.save(DB_KEYS.PROJECTS, backup.projects),
        () => db.save(DB_KEYS.CANVAS, backup.canvas)
      ], 'restore-from-backup')

      console.log(`✅ Restored ${backup.tasks.length} tasks from backup`)

    } catch (error) {
      console.error('❌ Failed to restore from backup:', error)
      throw error
    }
  }

  // Auto-backup scheduler
  let backupInterval: NodeJS.Timeout | null = null

  const startAutoBackup = (intervalMinutes: number = 5): void => {
    console.log(`⏰ Starting auto-backup every ${intervalMinutes} minutes`)

    backupInterval = setInterval(async () => {
      if (!isBackupEnabled.value) {
        return
      }

      try {
        const backup = await createBackup()
        saveBackupToStorage(backup)
      } catch (error) {
        console.error('❌ Auto-backup failed:', error)
      }
    }, intervalMinutes * 60 * 1000)
  }

  const stopAutoBackup = (): void => {
    if (backupInterval) {
      clearInterval(backupInterval)
      backupInterval = null
      console.log('⏹️ Auto-backup stopped')
    }
  }

  // Manual backup trigger
  const createManualBackup = async (): Promise<void> => {
    console.log('🖱️ Creating manual backup...')
    try {
      const backup = await createBackup()
      saveBackupToStorage(backup)
      console.log('✅ Manual backup completed')
    } catch (error) {
      console.error('❌ Manual backup failed:', error)
      throw error
    }
  }

  // Download backup as file
  const downloadBackup = (backup?: BackupData): void => {
    const backupToDownload = backup || backupHistory.value[0]

    if (!backupToDownload) {
      throw new Error('No backup available to download')
    }

    const dataStr = JSON.stringify(backupToDownload, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })

    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pomo-flow-backup-${new Date(backupToDownload.timestamp).toISOString().split('T')[0]}.json`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
    console.log('💾 Backup downloaded as file')
  }

  // Restore from file
  const restoreFromFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const backup = JSON.parse(text) as BackupData

      // Validate backup structure
      if (!backup.tasks || !backup.projects || !backup.canvas || !backup.timestamp) {
        throw new Error('Invalid backup file format')
      }

      await restoreFromBackup(backup)
      console.log('✅ Restored from file successfully')

    } catch (error) {
      console.error('❌ Failed to restore from file:', error)
      throw error
    }
  }

  // Initialize
  onMounted(() => {
    // Load existing backup history
    backupHistory.value = loadBackupHistory()

    // Get latest backup time
    const latestBackup = localStorage.getItem('pomo-flow-latest-backup')
    if (latestBackup) {
      try {
        const backup = JSON.parse(latestBackup) as BackupData
        lastBackupTime.value = backup.timestamp
      } catch (error) {
        console.error('❌ Failed to parse latest backup:', error)
      }
    }

    // Start auto-backup
    startAutoBackup()
  })

  onUnmounted(() => {
    stopAutoBackup()
  })

  return {
    isBackupEnabled,
    lastBackupTime,
    backupHistory,
    createManualBackup,
    restoreFromBackup,
    downloadBackup,
    restoreFromFile,
    startAutoBackup,
    stopAutoBackup
  }
}