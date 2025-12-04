import { useTaskStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useDatabase } from './useDatabase'
import { filterMockTasks } from '@/utils/mockTaskDetector'

export interface SimpleBackupData {
  tasks: any[]
  projects: any[]
  canvas: any
  timestamp: number
  version: string
  exportedAt?: string
}

// ✅ STATE: Track readiness
const isTasksReady = ref(false)
const isBackupReady = ref(false)

export const useSimpleBackup = {
  // ✅ NEW: Wait for tasks to be loaded
  async waitForTasksReady(maxWaitTime = 10000) {
    console.log('⏳ Waiting for tasks to load...')

    const startTime = Date.now()
    const taskStore = useTaskStore()
    const { tasks } = storeToRefs(taskStore)

    return new Promise((resolve) => {
      // Check immediately
      if (Array.isArray(tasks.value) && tasks.value.length >= 0) {
        console.log('✅ Tasks already loaded:', tasks.value.length)
        isTasksReady.value = true
        resolve(true)
        return
      }

      // Watch for tasks to load
      const unwatch = watch(tasks, (newTasks) => {
        if (Array.isArray(newTasks)) {
          console.log('✅ Tasks loaded:', newTasks.length)
          isTasksReady.value = true
          unwatch()
          resolve(true)
        }
      })

      // Timeout after maxWaitTime
      setTimeout(() => {
        console.warn('⏳ Timeout waiting for tasks, continuing anyway')
        unwatch()
        isTasksReady.value = true
        resolve(false)
      }, maxWaitTime)
    })
  },

  // ✅ SAFE: Create backup with full validation
  async createBackup() {
    try {
      console.log('📦 Starting backup creation...')

      const taskStore = useTaskStore()
      const tasks = taskStore.tasks

      // Validation 1: Type check
      if (!Array.isArray(tasks)) {
        console.warn('⚠️ Tasks is not an array, skipping backup', {
          type: typeof tasks,
          value: tasks
        })
        return null
      }

      // Validation 2: Empty check
      if (tasks.length === 0) {
        console.log('ℹ️ No tasks to backup')
        return null
      }

      // Validation 3: Each task is valid
      const validTasks = tasks.filter(task => {
        if (!task.id || !task.title) {
          console.warn('⚠️ Invalid task found, skipping:', task)
          return false
        }
        return true
      })

      if (validTasks.length === 0) {
        console.warn('⚠️ No valid tasks found')
        return null
      }

      console.log(`✅ Creating backup of ${validTasks.length} valid tasks`)

      // Get data from IndexedDB
      const db = useDatabase()
      const [projects, canvas] = await Promise.all([
        db.load('projects'),
        db.load('canvas')
      ])

      // Apply mock task filtering
      const mockFilter = filterMockTasks(validTasks, { confidence: 'medium', logResults: true })
      const cleanTasks = mockFilter.cleanTasks

      if (mockFilter.mockTasks.length > 0) {
        console.log(`🧹 FILTERING: Removing ${mockFilter.mockTasks.length} mock tasks from backup`)
      }

      const backupData: SimpleBackupData = {
        tasks: cleanTasks,
        projects: (projects || []) as any[],
        canvas: canvas || {},
        timestamp: Date.now(),
        version: '1.0.0'
      }

      // Store latest backup
      localStorage.setItem('pomo-flow-simple-latest-backup', JSON.stringify(backupData))

      console.log('✅ Backup created successfully')
      console.log(`📊 Backed up ${backupData.tasks.length} clean tasks, ${backupData.projects.length} projects`)

      return backupData

    } catch (error) {
      console.error('❌ Backup error:', error)
      return null
    }
  },

  // ✅ SAFE: Auto-backup with guards
  async startAutoBackup() {
    try {
      console.log('🔄 Initializing auto-backup system...')

      // Wait for tasks to be ready
      await this.waitForTasksReady()

      // Create initial backup
      await this.createBackup()

      // Set interval for periodic backups (every 5 minutes)
      setInterval(async () => {
        await this.createBackup()
      }, 5 * 60 * 1000)

      isBackupReady.value = true
      console.log('✅ Auto-backup system running')

    } catch (error) {
      console.error('❌ Auto-backup initialization error:', error)
      // Don't crash app on backup error
    }
  },

  // ✅ Get status
  getStatus() {
    return {
      isTasksReady: isTasksReady.value,
      isBackupReady: isBackupReady.value,
      isOperational: isTasksReady.value && isBackupReady.value
    }
  },

  // Legacy methods for compatibility
  async restoreFromBackup(backup: SimpleBackupData | string): Promise<void> {
    try {
      console.log('🔄 Restoring from backup...')

      const backupData = typeof backup === 'string' ? JSON.parse(backup) : backup

      if (!backupData.tasks || !Array.isArray(backupData.tasks)) {
        throw new Error('Invalid backup format')
      }

      const db = useDatabase()

      // Restore to IndexedDB
      await db.atomicTransaction([
        () => db.save('tasks', backupData.tasks),
        () => db.save('projects', backupData.projects || []),
        () => db.save('canvas', backupData.canvas || {})
      ], 'restore-backup')

      console.log('✅ Backup restored successfully')

    } catch (error) {
      console.error('❌ Backup restoration failed:', error)
      throw new Error(`Restore failed: ${(error as any).message}`)
    }
  },

  getLatestBackup(): SimpleBackupData | null {
    try {
      const latest = localStorage.getItem('pomo-flow-simple-latest-backup')
      return latest ? JSON.parse(latest) : null
    } catch (error) {
      console.error('❌ Failed to get latest backup:', error)
      return null
    }
  },

  async exportTasks(): Promise<string> {
    try {
      const backup = await this.createBackup()
      if (!backup) {
        throw new Error('No backup data available')
      }

      const exportData = {
        ...backup,
        exportedAt: new Date().toISOString(),
        exportType: 'manual'
      }
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.error('❌ Export failed:', error)
      throw new Error(`Export failed: ${(error as any).message}`)
    }
  },

  async importTasks(jsonString: string): Promise<void> {
    try {
      console.log('📥 Importing tasks...')
      const importData = JSON.parse(jsonString)

      const backupData: SimpleBackupData = {
        tasks: importData.tasks || [],
        projects: importData.projects || [],
        canvas: importData.canvas || {},
        timestamp: Date.now(),
        version: importData.version || '1.0.0'
      }

      await this.restoreFromBackup(backupData)
      console.log('✅ Tasks imported successfully')
    } catch (error) {
      console.error('❌ Import failed:', error)
      throw new Error(`Import failed: ${(error as any).message}`)
    }
  },

  downloadBackup(backup?: SimpleBackupData): void {
    try {
      const data = backup || this.getLatestBackup()
      if (!data) {
        throw new Error('No backup available')
      }

      const filename = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
      const content = JSON.stringify(data, null, 2)

      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()

      URL.revokeObjectURL(url)
      console.log('💾 Backup downloaded successfully')
    } catch (error) {
      console.error('❌ Download failed:', error)
      throw new Error(`Download failed: ${(error as any).message}`)
    }
  },

  getHebrewTaskCount(backup: SimpleBackupData): number {
    if (!backup || !backup.tasks) return 0

    return backup.tasks.filter(task => {
      if (!task.title) return false
      const hebrewRegex = /[\u0590-\u05FF]/
      return hebrewRegex.test(task.title)
    }).length
  },

  hasHebrewContent(backup: SimpleBackupData): boolean {
    return this.getHebrewTaskCount(backup) > 0
  },

  initialize() {
    this.startAutoBackup()
  }
}

// Export default for backward compatibility
export default useSimpleBackup