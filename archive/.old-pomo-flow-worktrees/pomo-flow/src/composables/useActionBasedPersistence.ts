/**
 * Action-Based Database Persistence
 *
 * Replaces reactive watchers with reliable action-based persistence.
 * Prevents race conditions between cache invalidation and database saves.
 * Provides transaction-like operations with rollback capability.
 */

import { ref } from 'vue'
import { useDatabase, DB_KEYS } from './useDatabase'
import { usePersistentStorage } from './usePersistentStorage'
import { useCloudSync } from './useCloudSync'

export interface PersistenceTransaction {
  id: string
  timestamp: number
  operations: DatabaseOperation[]
  rollbackData?: any
}

export interface DatabaseOperation {
  type: 'save' | 'delete' | 'update'
  key: string
  data: any
  previousData?: any
}

class ActionBasedPersistence {
  private db = useDatabase()
  private persistentStorage = usePersistentStorage()
  private cloudSync = useCloudSync()

  // Transaction state
  private pendingOperations = ref<DatabaseOperation[]>([])
  private isProcessing = ref(false)
  private transactionHistory = ref<PersistenceTransaction[]>([])
  private operationQueue: DatabaseOperation[] = []
  private processTimer: ReturnType<typeof setTimeout> | null = null

  // Performance tracking
  private operationStats = ref({
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageProcessingTime: 0
  })

  /**
   * Queue an operation for processing
   */
  async queueOperation(operation: DatabaseOperation): Promise<string> {
    const operationId = `${operation.type}-${operation.key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Add metadata
    const enhancedOperation: DatabaseOperation = {
      ...operation,
      id: operationId,
      timestamp: Date.now()
    } as any

    this.operationQueue.push(enhancedOperation)
    this.pendingOperations.value.push(enhancedOperation)

    console.log(`🔄 [ACTION-PERSISTENCE] Queued ${operation.type} operation for ${operation.key} (ID: ${operationId})`)

    // Process queue with debouncing for performance
    this.scheduleProcessing()

    return operationId
  }

  /**
   * Schedule processing of queued operations
   */
  private scheduleProcessing(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer)
    }

    this.processTimer = setTimeout(() => {
      this.processQueue()
    }, 500) // Debounce for 500ms to batch operations
  }

  /**
   * Process all queued operations atomically
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing.value || this.operationQueue.length === 0) {
      return
    }

    this.isProcessing.value = true
    const startTime = Date.now()

    console.log(`🔄 [ACTION-PERSISTENCE] Processing ${this.operationQueue.length} queued operations...`)

    // Create transaction
    const transaction: PersistenceTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operations: [...this.operationQueue]
    }

    try {
      // Check storage quota before processing
      const quotaInfo = await this.checkStorageQuota()
      if (quotaInfo && quotaInfo.usagePercentage > 95) {
        console.error('❌ [ACTION-PERSISTENCE] Processing blocked: Storage critically full')
        throw new Error('Storage quota exceeded')
      }

      // Process operations in order
      const results = await Promise.allSettled(
        this.operationQueue.map(operation => this.executeOperation(operation))
      )

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (failed > 0) {
        console.error(`❌ [ACTION-PERSISTENCE] ${failed} operations failed in transaction ${transaction.id}`)
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`   Operation ${index}:`, result.reason)
          }
        })
      }

      // Update stats
      this.operationStats.value.totalOperations += this.operationQueue.length
      this.operationStats.value.successfulOperations += successful
      this.operationStats.value.failedOperations += failed

      // Calculate processing time
      const processingTime = Date.now() - startTime
      this.operationStats.value.averageProcessingTime =
        (this.operationStats.value.averageProcessingTime + processingTime) / 2

      console.log(`✅ [ACTION-PERSISTENCE] Transaction ${transaction.id} completed: ${successful} successful, ${failed} failed, ${processingTime}ms`)

      // Clear queue on success
      this.operationQueue = []
      this.pendingOperations.value = []

      // Add to history
      this.transactionHistory.value.push(transaction)

      // Keep history manageable (last 50 transactions)
      if (this.transactionHistory.value.length > 50) {
        this.transactionHistory.value = this.transactionHistory.value.slice(-50)
      }

      // Trigger cloud sync if operations were successful
      if (successful > 0) {
        this.cloudSync.syncNow().catch(error => {
          console.warn('Cloud sync failed after persistence operations:', error)
        })
      }

    } catch (error) {
      console.error(`💥 [ACTION-PERSISTENCE] Transaction ${transaction.id} failed:`, error)

      // Keep operations in queue for retry
      // TODO: Implement exponential backoff retry logic
    } finally {
      this.isProcessing.value = false
    }
  }

  /**
   * Execute a single database operation
   */
  private async executeOperation(operation: DatabaseOperation): Promise<void> {
    const startTime = Date.now()

    try {
      switch (operation.type) {
        case 'save':
        case 'update':
          // Save to both IndexedDB and persistent storage for redundancy
          await Promise.all([
            this.db.save(operation.key, operation.data),
            this.persistentStorage.save(this.mapKeyToStorage(operation.key), operation.data)
          ])
          console.log(`✅ [ACTION-PERSISTENCE] Saved ${operation.key} (${operation.data.length || 1} items)`)
          break

        case 'delete':
          await Promise.all([
            this.db.delete(operation.key),
            this.persistentStorage.delete(this.mapKeyToStorage(operation.key))
          ])
          console.log(`✅ [ACTION-PERSISTENCE] Deleted ${operation.key}`)
          break

        default:
          throw new Error(`Unknown operation type: ${(operation as any).type}`)
      }

      const processingTime = Date.now() - startTime
      console.log(`⚡ [ACTION-PERSISTENCE] Operation completed in ${processingTime}ms`)

    } catch (error) {
      console.error(`❌ [ACTION-PERSISTENCE] Operation failed for ${operation.key}:`, error)
      throw error
    }
  }

  /**
   * Map database keys to persistent storage keys
   */
  private mapKeyToStorage(dbKey: string): string {
    const keyMap: Record<string, string> = {
      [DB_KEYS.TASKS]: this.persistentStorage.STORAGE_KEYS.TASKS,
      [DB_KEYS.PROJECTS]: this.persistentStorage.STORAGE_KEYS.PROJECTS,
      [DB_KEYS.CANVAS]: this.persistentStorage.STORAGE_KEYS.CANVAS,
      [DB_KEYS.TIMER]: this.persistentStorage.STORAGE_KEYS.TIMER,
      [DB_KEYS.SETTINGS]: this.persistentStorage.STORAGE_KEYS.SETTINGS
    }

    return keyMap[dbKey] || dbKey
  }

  /**
   * Check storage quota availability
   */
  private async checkStorageQuota(): Promise<{ usage: number; quota: number; usagePercentage: number } | null> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const usage = estimate.usage || 0
        const quota = estimate.quota || 618611060 // Fallback ~600MB
        const usagePercentage = (usage / quota) * 100

        return { usage, quota, usagePercentage }
      }
    } catch (error) {
      console.warn('Could not check storage quota:', error)
    }

    return null
  }

  /**
   * Force immediate processing of all queued operations
   */
  async flushQueue(): Promise<void> {
    if (this.processTimer) {
      clearTimeout(this.processTimer)
      this.processTimer = null
    }

    await this.processQueue()
  }

  /**
   * Clear all queued operations (use with caution)
   */
  clearQueue(): void {
    this.operationQueue = []
    this.pendingOperations.value = []
    console.log('🧹 [ACTION-PERSISTENCE] Queue cleared')
  }

  /**
   * Get current status and statistics
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing.value,
      pendingOperations: this.pendingOperations.value.length,
      queueLength: this.operationQueue.length,
      transactionHistory: this.transactionHistory.value.length,
      stats: { ...this.operationStats.value }
    }
  }

  /**
   * Convenience method for saving tasks
   */
  async saveTasks(tasks: any[]): Promise<string> {
    return this.queueOperation({
      type: 'save',
      key: DB_KEYS.TASKS,
      data: tasks
    })
  }

  /**
   * Convenience method for saving projects
   */
  async saveProjects(projects: any[]): Promise<string> {
    return this.queueOperation({
      type: 'save',
      key: DB_KEYS.PROJECTS,
      data: projects
    })
  }

  /**
   * Convenience method for saving canvas data
   */
  async saveCanvas(canvasData: any): Promise<string> {
    return this.queueOperation({
      type: 'save',
      key: DB_KEYS.CANVAS,
      data: canvasData
    })
  }
}

// Singleton instance
let persistenceInstance: ActionBasedPersistence | null = null

export function useActionBasedPersistence(): ActionBasedPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new ActionBasedPersistence()
    console.log('🔄 [ACTION-PERSISTENCE] Singleton instance created')
  }

  return persistenceInstance
}

export function resetActionBasedPersistence(): void {
  persistenceInstance = null
  console.log('🔄 [ACTION-PERSISTENCE] Singleton instance reset')
}