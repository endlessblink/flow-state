/**
 * Smart Sync Batch Manager
 * Intelligently batches and optimizes sync operations for performance
 */

import type { SyncableDocument } from '@/composables/documentFilters'
import type { SyncOptimizationConfig as _SyncOptimizationConfig, NetworkCondition as _NetworkCondition } from './networkOptimizer'
import { getNetworkOptimizer } from './networkOptimizer'

export interface SyncBatch {
  id: string
  documents: SyncableDocument[]
  priority: 'low' | 'normal' | 'high' | 'critical'
  timestamp: Date
  sizeBytes: number
  estimatedDuration: number
  retryCount: number
  maxRetries: number
}

export interface BatchMetrics {
  totalBatches: number
  pendingBatches: number
  processingBatches: number
  completedBatches: number
  failedBatches: number
  averageBatchSize: number
  totalDataSize: number
}

export interface BatchProcessingOptions {
  maxConcurrentBatches: number
  batchSize: number
  compressionThreshold: number
  priorityProcessing: boolean
  adaptiveBatching: boolean
}

export class SyncBatchManager {
  private static instance: SyncBatchManager
  private pendingBatches: Map<string, SyncBatch> = new Map()
  private processingBatches: Map<string, SyncBatch> = new Map()
  private completedBatches: SyncBatch[] = []
  private failedBatches: SyncBatch[] = []
  private processingQueue: string[] = []
  private isProcessing = false
  private networkOptimizer = getNetworkOptimizer()

  private constructor() {
    // Start batch processing loop
    this.startBatchProcessing()
  }

  public static getInstance(): SyncBatchManager {
    if (!SyncBatchManager.instance) {
      SyncBatchManager.instance = new SyncBatchManager()
    }
    return SyncBatchManager.instance
  }

  /**
   * Add documents to be batched for sync
   */
  public addDocuments(
    documents: SyncableDocument[],
    priority: SyncBatch['priority'] = 'normal',
    options: { batchSize?: number; immediate?: boolean } = {}
  ): string[] {
    const batchIds: string[] = []
    const config = this.networkOptimizer.getOptimizedConfig()
    const batchSize = options.batchSize || config.batchSize

    // Filter out invalid documents
    const validDocuments = documents.filter(doc =>
      doc && doc._id && typeof doc === 'object'
    )

    if (validDocuments.length === 0) {
      console.warn('⚠️ No valid documents to batch')
      return batchIds
    }

    // Split into batches
    for (let i = 0; i < validDocuments.length; i += batchSize) {
      const batchDocuments = validDocuments.slice(i, i + batchSize)
      const batchId = this.createBatch(batchDocuments, priority)
      batchIds.push(batchId)

      if (options.immediate) {
        this.processingQueue.unshift(batchId) // High priority
      }
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startBatchProcessing()
    }

    console.log(`📦 Created ${batchIds.length} batches for ${validDocuments.length} documents`)
    return batchIds
  }

  /**
   * Create a single batch
   */
  private createBatch(documents: SyncableDocument[], priority: SyncBatch['priority']): string {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const sizeBytes = this.calculateBatchSize(documents)
    const estimatedDuration = this.networkOptimizer.estimateSyncDuration(sizeBytes)

    const batch: SyncBatch = {
      id: batchId,
      documents: [...documents],
      priority,
      timestamp: new Date(),
      sizeBytes,
      estimatedDuration,
      retryCount: 0,
      maxRetries: this.getMaxRetries(priority)
    }

    this.pendingBatches.set(batchId, batch)
    this.processingQueue.push(batchId)

    return batchId
  }

  /**
   * Calculate total size of batch in bytes
   */
  private calculateBatchSize(documents: SyncableDocument[]): number {
    return documents.reduce((total, doc) => {
      return total + JSON.stringify(doc).length * 2 // Rough estimate (UTF-16)
    }, 0)
  }

  /**
   * Get maximum retries based on priority
   */
  private getMaxRetries(priority: SyncBatch['priority']): number {
    switch (priority) {
      case 'critical': return 10
      case 'high': return 7
      case 'normal': return 5
      case 'low': return 3
      default: return 5
    }
  }

  /**
   * Start batch processing loop
   */
  private async startBatchProcessing(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true
    console.log('🔄 Starting batch processing loop')

    while (this.processingQueue.length > 0 || this.pendingBatches.size > 0) {
      try {
        await this.processNextBatch()

        // Adaptive delay based on network conditions
        const delay = this.networkOptimizer.getSyncDelay()
        await this.sleep(delay)

      } catch (error) {
        console.error('❌ Batch processing error:', error)
        await this.sleep(5000) // Wait 5 seconds before retrying
      }
    }

    this.isProcessing = false
    console.log('✅ Batch processing loop completed')
  }

  /**
   * Process the next batch in queue
   */
  private async processNextBatch(): Promise<void> {
    if (!this.networkOptimizer.shouldSync()) {
      console.log('⏸️ Network conditions not suitable for sync, waiting...')
      return
    }

    // Sort queue by priority and timestamp
    this.sortProcessingQueue()

    const batchId = this.processingQueue.shift()
    if (!batchId || !this.pendingBatches.has(batchId)) {
      return
    }

    const batch = this.pendingBatches.get(batchId)
    if (!batch) return

    this.pendingBatches.delete(batchId)
    this.processingBatches.set(batchId, batch)

    try {
      console.log(`📦 Processing batch ${batchId} (${batch.documents.length} docs, ${batch.priority} priority)`)

      // Process the batch (this would be connected to actual sync logic)
      await this.processBatch(batch)

      // Mark as completed
      this.processingBatches.delete(batchId)
      this.completedBatches.push(batch)

      // Record success
      this.networkOptimizer.recordSyncResult(true)

      console.log(`✅ Batch ${batchId} completed successfully`)

    } catch (error) {
      console.error(`❌ Batch ${batchId} failed:`, error)

      batch.retryCount++
      this.networkOptimizer.recordSyncResult(false)

      // Retry if under limit
      if (batch.retryCount <= batch.maxRetries) {
        console.log(`🔄 Retrying batch ${batchId} (attempt ${batch.retryCount}/${batch.maxRetries})`)
        this.pendingBatches.set(batchId, batch)
        this.processingQueue.push(batchId)
      } else {
        console.error(`💥 Batch ${batchId} failed permanently after ${batch.retryCount} attempts`)
        this.processingBatches.delete(batchId)
        this.failedBatches.push(batch)
      }
    }
  }

  /**
   * Process individual batch
   */
  private async processBatch(batch: SyncBatch): Promise<void> {
    // Optimize batch before processing
    const optimizedBatch = await this.optimizeBatch(batch)

    // Simulate processing time (in real implementation, this would call the sync manager)
    const processingTime = Math.max(1000, optimizedBatch.estimatedDuration)
    await this.sleep(processingTime)

    // Simulate occasional failures for testing
    if (Math.random() < 0.1) { // 10% failure rate for testing
      throw new Error('Simulated batch processing failure')
    }
  }

  /**
   * Optimize batch for current network conditions
   */
  private async optimizeBatch(batch: SyncBatch): Promise<SyncBatch> {
    const optimized = { ...batch }

    // Apply compression if beneficial
    if (this.networkOptimizer.shouldCompress(batch.sizeBytes)) {
      optimized.documents = batch.documents.map(doc => ({
        ...doc,
        _compressed: true,
        _originalSize: JSON.stringify(doc).length
      }))
    }

    // Adjust batch size if needed
    const config = this.networkOptimizer.getOptimizedConfig()
    if (batch.documents.length > config.batchSize) {
      // Split into smaller batches
      const chunks = []
      for (let i = 0; i < batch.documents.length; i += config.batchSize) {
        chunks.push(batch.documents.slice(i, i + config.batchSize))
      }

      // Create new batches for chunks beyond the first
      for (let i = 1; i < chunks.length; i++) {
        const newBatchId = this.createBatch(chunks[i], batch.priority)
        this.processingQueue.unshift(newBatchId) // Process chunks immediately
      }

      // Keep first chunk as current batch
      optimized.documents = chunks[0]
    }

    return optimized
  }

  /**
   * Sort processing queue by priority and timestamp
   */
  private sortProcessingQueue(): void {
    this.processingQueue.sort((a, b) => {
      const batchA = this.pendingBatches.get(a)
      const batchB = this.pendingBatches.get(b)

      if (!batchA || !batchB) return 0

      // Priority order: critical > high > normal > low
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
      const priorityDiff = priorityOrder[batchB.priority] - priorityOrder[batchA.priority]

      if (priorityDiff !== 0) return priorityDiff

      // If same priority, sort by timestamp (older first)
      return batchA.timestamp.getTime() - batchB.timestamp.getTime()
    })
  }

  /**
   * Get batch metrics
   */
  public getMetrics(): BatchMetrics {
    const totalBatches = this.pendingBatches.size + this.processingBatches.size +
      this.completedBatches.length + this.failedBatches.length

    const totalDataSize = this.completedBatches.reduce((sum, batch) => sum + batch.sizeBytes, 0) +
      this.failedBatches.reduce((sum, batch) => sum + batch.sizeBytes, 0) +
      Array.from(this.pendingBatches.values()).reduce((sum, batch) => sum + batch.sizeBytes, 0) +
      Array.from(this.processingBatches.values()).reduce((sum, batch) => sum + batch.sizeBytes, 0)

    const averageBatchSize = totalBatches > 0 ? totalDataSize / totalBatches : 0

    return {
      totalBatches,
      pendingBatches: this.pendingBatches.size,
      processingBatches: this.processingBatches.size,
      completedBatches: this.completedBatches.length,
      failedBatches: this.failedBatches.length,
      averageBatchSize,
      totalDataSize
    }
  }

  /**
   * Get batch by ID
   */
  public getBatch(batchId: string): SyncBatch | null {
    return this.pendingBatches.get(batchId) ||
      this.processingBatches.get(batchId) ||
      this.completedBatches.find(b => b.id === batchId) ||
      this.failedBatches.find(b => b.id === batchId) ||
      null
  }

  /**
   * Cancel a batch
   */
  public cancelBatch(batchId: string): boolean {
    // Cancel if pending
    if (this.pendingBatches.has(batchId)) {
      this.pendingBatches.delete(batchId)
      const queueIndex = this.processingQueue.indexOf(batchId)
      if (queueIndex > -1) {
        this.processingQueue.splice(queueIndex, 1)
      }
      console.log(`🚫 Batch ${batchId} cancelled`)
      return true
    }

    // Can't cancel if processing
    if (this.processingBatches.has(batchId)) {
      console.warn(`⚠️ Cannot cancel batch ${batchId} - already processing`)
      return false
    }

    return false
  }

  /**
   * Clear completed and failed batches
   */
  public clearHistory(): void {
    this.completedBatches = []
    this.failedBatches = []
    console.log('🧹 Batch history cleared')
  }

  /**
   * Force immediate processing of pending batches
   */
  public forceProcessing(): void {
    console.log('⚡ Force processing all pending batches')
    if (!this.isProcessing) {
      this.startBatchProcessing()
    }
  }

  /**
   * Get pending batches by priority
   */
  public getPendingBatchesByPriority(): Record<string, SyncBatch[]> {
    const result: Record<string, SyncBatch[]> = {
      critical: [],
      high: [],
      normal: [],
      low: []
    }

    for (const batch of this.pendingBatches.values()) {
      result[batch.priority].push(batch)
    }

    return result
  }

  /**
   * Get network-aware recommendations
   */
  public getRecommendations(): {
    shouldIncreaseBatchSize: boolean
    shouldDecreaseBatchSize: boolean
    shouldIncreaseConcurrency: boolean
    shouldPauseProcessing: boolean
  } {
    const metrics = this.getMetrics()
    const networkMetrics = this.networkOptimizer.getMetrics()
    const condition = networkMetrics.currentCondition

    return {
      shouldIncreaseBatchSize: condition.type === 'excellent' && metrics.averageBatchSize < 100,
      shouldDecreaseBatchSize: condition.type === 'poor' && metrics.averageBatchSize > 10,
      shouldIncreaseConcurrency: condition.type === 'excellent' && metrics.pendingBatches > 10,
      shouldPauseProcessing: !this.networkOptimizer.shouldSync() || metrics.failedBatches > 5
    }
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Reset all batch data
   */
  public reset(): void {
    this.pendingBatches.clear()
    this.processingBatches.clear()
    this.completedBatches = []
    this.failedBatches = []
    this.processingQueue = []
    this.isProcessing = false
    console.log('🔄 Batch manager reset')
  }
}

// Export singleton instance
export const getBatchManager = () => SyncBatchManager.getInstance()

// Export types
// Types already exported as interfaces above