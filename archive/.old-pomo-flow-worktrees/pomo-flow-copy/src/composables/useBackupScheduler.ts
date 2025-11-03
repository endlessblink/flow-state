/**
 * ⏰ Automatic Backup Scheduler
 *
 * Provides intelligent, scheduled backups with user-configurable frequency
 * and smart backup strategies to prevent data loss.
 */

import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useBulletproofPersistence } from './useBulletproofPersistence'

export type BackupFrequency = 'off' | '5min' | '15min' | '30min' | '1hour' | '6hours' | 'daily' | 'weekly'

export interface BackupSchedule {
  frequency: BackupFrequency
  lastBackup: number
  nextBackup: number
  autoDownload: boolean
  maxBackups: number
  storageLocation: 'local' | 'cloud' | 'both'
}

export interface BackupStats {
  totalBackups: number
  totalSize: number
  averageSize: number
  successRate: number
  lastBackupTime: number
  nextBackupTime: number
}

class BackupScheduler {
  private persistence = useBulletproofPersistence()
  private interval: NodeJS.Timeout | null = null
  private isRunning = ref(false)
  private isPaused = ref(false)
  private schedule = ref<BackupSchedule>({
    frequency: 'off',
    lastBackup: 0,
    nextBackup: 0,
    autoDownload: false,
    maxBackups: 50,
    storageLocation: 'both'
  })
  private stats = ref<BackupStats>({
    totalBackups: 0,
    totalSize: 0,
    averageSize: 0,
    successRate: 100,
    lastBackupTime: 0,
    nextBackupTime: 0
  })
  private onBackupCallbacks: Array<(success: boolean, error?: string) => void> = []
  private backupHistory: Array<{ timestamp: number; success: boolean; size: number; error?: string }> = []

  constructor() {
    this.loadSettings()
    this.startScheduler()
  }

  /**
   * 🚀 Start the backup scheduler
   */
  start() {
    if (this.isRunning.value) return

    this.isRunning.value = true
    this.isPaused.value = false
    this.calculateNextBackup()
    this.startInterval()

    console.log('⏰ Backup scheduler started')
  }

  /**
   * ⏸️ Pause the backup scheduler
   */
  pause() {
    this.isPaused.value = true
    this.stopInterval()
    console.log('⏸️ Backup scheduler paused')
  }

  /**
   * ⏹️ Stop the backup scheduler
   */
  stop() {
    this.isRunning.value = false
    this.isPaused.value = false
    this.stopInterval()
    console.log('⏹️ Backup scheduler stopped')
  }

  /**
   * ⚙️ Update backup schedule settings
   */
  updateSchedule(settings: Partial<BackupSchedule>) {
    this.schedule.value = { ...this.schedule.value, ...settings }
    this.saveSettings()

    if (this.isRunning.value && !this.isPaused.value) {
      this.calculateNextBackup()
      this.restartInterval()
    }

    console.log('⚙️ Backup schedule updated:', settings)
  }

  /**
   * 🔄 Trigger immediate backup
   */
  async triggerBackup(immediate = false): Promise<boolean> {
    if (!immediate && this.isPaused.value) {
      console.log('⏸️ Scheduler paused, backup skipped')
      return false
    }

    console.log('🔄 Triggering backup...')
    const startTime = Date.now()

    try {
      const backupJson = await this.persistence.createFullBackup()
      const size = backupJson.length

      // Update schedule
      this.schedule.value.lastBackup = Date.now()
      this.calculateNextBackup()

      // Update stats
      this.updateStats(true, size)
      this.backupHistory.unshift({
        timestamp: Date.now(),
        success: true,
        size
      })

      // Auto-download if enabled
      if (this.schedule.value.autoDownload) {
        await this.downloadBackup(backupJson)
      }

      // Clean old backups if needed
      await this.cleanOldBackups()

      // Notify callbacks
      this.notifyCallbacks(true)

      console.log(`✅ Backup completed successfully (${(size / 1024).toFixed(1)} KB)`)
      return true

    } catch (error) {
      console.error('❌ Backup failed:', error)

      this.updateStats(false, 0)
      this.backupHistory.unshift({
        timestamp: Date.now(),
        success: false,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      this.notifyCallbacks(false, error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }

  /**
   * 📊 Get backup statistics
   */
  getStats(): BackupStats {
    return { ...this.stats.value }
  }

  /**
   * 📅 Get current schedule
   */
  getSchedule(): BackupSchedule {
    return { ...this.schedule.value }
  }

  /**
   * 📜 Get backup history
   */
  getHistory(limit = 10) {
    return this.backupHistory.slice(0, limit)
  }

  /**
   * 🎯 Add backup callback
   */
  onBackup(callback: (success: boolean, error?: string) => void) {
    this.onBackupCallbacks.push(callback)
  }

  /**
   * 🗑️ Remove backup callback
   */
  offBackup(callback: (success: boolean, error?: string) => void) {
    const index = this.onBackupCallbacks.indexOf(callback)
    if (index > -1) {
      this.onBackupCallbacks.splice(index, 1)
    }
  }

  /**
   * 🔔 Get next backup time in human readable format
   */
  getNextBackupTime(): string {
    if (this.schedule.value.frequency === 'off') {
      return 'Disabled'
    }

    if (this.isPaused.value) {
      return 'Paused'
    }

    const now = Date.now()
    const next = this.schedule.value.nextBackup
    const remaining = Math.max(0, next - now)

    if (remaining === 0) {
      return 'Now'
    }

    const minutes = Math.floor(remaining / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days} day${days === 1 ? '' : 's'}`
    } else if (hours > 0) {
      return `${hours} hour${hours === 1 ? '' : 's'}`
    } else if (minutes > 0) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`
    } else {
      return 'Less than 1 minute'
    }
  }

  // Private methods
  private startScheduler() {
    if (this.schedule.value.frequency !== 'off') {
      this.start()
    }
  }

  private startInterval() {
    this.stopInterval()

    const intervalMs = this.getIntervalMs()
    if (intervalMs > 0) {
      this.interval = setInterval(async () => {
        if (!this.isPaused.value && this.shouldBackup()) {
          await this.triggerBackup()
        }
      }, intervalMs)
    }
  }

  private stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private restartInterval() {
    this.stopInterval()
    if (!this.isPaused.value) {
      this.startInterval()
    }
  }

  private getIntervalMs(): number {
    const frequency = this.schedule.value.frequency

    switch (frequency) {
      case '5min': return 5 * 60 * 1000
      case '15min': return 15 * 60 * 1000
      case '30min': return 30 * 60 * 1000
      case '1hour': return 60 * 60 * 1000
      case '6hours': return 6 * 60 * 60 * 1000
      case 'daily': return 24 * 60 * 60 * 1000
      case 'weekly': return 7 * 24 * 60 * 60 * 1000
      default: return 0
    }
  }

  private shouldBackup(): boolean {
    const now = Date.now()
    return now >= this.schedule.value.nextBackup
  }

  private calculateNextBackup() {
    if (this.schedule.value.frequency === 'off') {
      this.schedule.value.nextBackup = 0
      return
    }

    const intervalMs = this.getIntervalMs()
    const now = Date.now()
    this.schedule.value.nextBackup = now + intervalMs
    this.stats.value.nextBackupTime = this.schedule.value.nextBackup
  }

  private async downloadBackup(backupJson: string) {
    try {
      const blob = new Blob([backupJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pomo-flow-auto-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('📁 Auto-backup downloaded')
    } catch (error) {
      console.warn('Failed to download auto-backup:', error)
    }
  }

  private async cleanOldBackups() {
    const maxBackups = this.schedule.value.maxBackups
    const history = this.persistence.getBackupHistory()

    if (history.length > maxBackups) {
      // Keep only the most recent backups
      const toKeep = history.slice(0, maxBackups)

      // Update the backup history in localStorage
      localStorage.setItem('pomo-flow-backup-history', JSON.stringify(toKeep))

      console.log(`🗑️ Cleaned ${history.length - maxBackups} old backups`)
    }
  }

  private updateStats(success: boolean, size: number) {
    if (success) {
      this.stats.value.totalBackups++
      this.stats.value.totalSize += size
      this.stats.value.averageSize = this.stats.value.totalSize / this.stats.value.totalBackups
      this.stats.value.lastBackupTime = Date.now()
    }

    // Calculate success rate from recent history
    const recentHistory = this.backupHistory.slice(0, 20)
    const successCount = recentHistory.filter(h => h.success).length
    this.stats.value.successRate = recentHistory.length > 0 ? (successCount / recentHistory.length) * 100 : 100
  }

  private notifyCallbacks(success: boolean, error?: string) {
    this.onBackupCallbacks.forEach(callback => {
      try {
        callback(success, error)
      } catch (callbackError) {
        console.error('Backup callback error:', callbackError)
      }
    })
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('pomo-flow-backup-schedule')
      if (saved) {
        this.schedule.value = { ...this.schedule.value, ...JSON.parse(saved) }
      }

      // Load stats
      const savedStats = localStorage.getItem('pomo-flow-backup-stats')
      if (savedStats) {
        this.stats.value = { ...this.stats.value, ...JSON.parse(savedStats) }
      }

      // Load history
      const savedHistory = localStorage.getItem('pomo-flow-backup-schedule-history')
      if (savedHistory) {
        this.backupHistory = JSON.parse(savedHistory)
      }
    } catch (error) {
      console.warn('Failed to load backup settings:', error)
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem('pomo-flow-backup-schedule', JSON.stringify(this.schedule.value))
      localStorage.setItem('pomo-flow-backup-stats', JSON.stringify(this.stats.value))
      localStorage.setItem('pomo-flow-backup-schedule-history', JSON.stringify(this.backupHistory))
    } catch (error) {
      console.warn('Failed to save backup settings:', error)
    }
  }
}

// Global instance
let backupScheduler: BackupScheduler | null = null

export function useBackupScheduler() {
  if (!backupScheduler) {
    backupScheduler = new BackupScheduler()
  }

  return {
    // State
    isRunning: () => backupScheduler!.isRunning.value,
    isPaused: () => backupScheduler!.isPaused.value,

    // Control
    start: () => backupScheduler!.start(),
    pause: () => backupScheduler!.pause(),
    stop: () => backupScheduler!.stop(),
    triggerBackup: (immediate?: boolean) => backupScheduler!.triggerBackup(immediate),

    // Configuration
    updateSchedule: (settings: Partial<BackupSchedule>) => backupScheduler!.updateSchedule(settings),

    // Information
    getStats: () => backupScheduler!.getStats(),
    getSchedule: () => backupScheduler!.getSchedule(),
    getHistory: (limit?: number) => backupScheduler!.getHistory(limit),
    getNextBackupTime: () => backupScheduler!.getNextBackupTime(),

    // Events
    onBackup: (callback: (success: boolean, error?: string) => void) => backupScheduler!.onBackup(callback),
    offBackup: (callback: (success: boolean, error?: string) => void) => backupScheduler!.offBackup(callback)
  }
}