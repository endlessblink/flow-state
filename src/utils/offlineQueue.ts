/**
 * Advanced Offline-First Queue System
 * Robust offline operation queuing with intelligent synchronization
 */

export interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete' | 'sync' | 'merge'
  entityType: 'task' | 'project' | 'settings' | 'user'
  entityId: string
  documentId?: string // Alias for entityId for compatibility
  data: any
  documentData?: any // Alias for data for compatibility
  originalData?: any
  timestamp: number
  priority: 'critical' | 'high' | 'normal' | 'low'
  retryCount: number
  maxRetries: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'conflict'
  conflictResolution?: 'local' | 'remote' | 'merge' | 'ask'
  optimisticId?: string
  dependencies: string[] // Operation IDs this depends on
  parentOperation?: string
  batchId?: string
  context?: {
    source?: string
    userId?: string
    deviceId?: string
    sessionId?: string
    metadata?: Record<string, any>
  }
}

export interface QueueStats {
  length: number
  processing: boolean
  isOnline: boolean
  byType: Record<QueuedOperation['type'], number>
  byPriority: Record<QueuedOperation['priority'], number>
  byStatus: Record<QueuedOperation['status'], number>
  oldestOperation?: number
  totalProcessingTime: number
  estimatedProcessingTime: number
  conflictCount: number
}

export interface QueueProcessingResult {
  processed: number
  successful: number
  failed: number
  conflicts: number
  remaining: number
  processingTime: number
  errors: Array<{ operation: QueuedOperation; error: Error }>
  conflictDetails: Array<{ operation: QueuedOperation; conflict: any }>
}

export interface ExponentialBackoff {
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  jitter: boolean
}

export interface DeferredResolution {
  autoResolveConflicts: boolean
  conflictTimeout: number
  userPromptRequired: boolean
  defaultResolution: 'local' | 'remote' | 'merge'
}

export interface OnlineStatus {
  isOnline: boolean
  connectionType: 'online' | 'offline' | 'slow' | 'unstable'
  lastConnected: number
  connectionQuality: number // 0-1
  syncStrategy: 'immediate' | 'batched' | 'manual'
  latency?: number
  bandwidth?: number
}

export interface OperationResult {
  success: boolean
  operationId: string
  serverId?: string
  conflict?: any
  error?: string
  retry: boolean
  nextRetryTime?: number
}

export class OfflineQueue {
  private queue: QueuedOperation[] = []
  private isOnline: boolean = navigator.onLine
  private processing: boolean = false
  private db: any = null
  private retryManager: any = null
  private totalProcessingTime: number = 0
  private processingHistory: Array<{ timestamp: number; result: QueueProcessingResult }> = []
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map()
  private processingInterval: number | null = null
  private connectivityMonitor: number | null = null
  private onlineStatus: OnlineStatus
  private retryStrategy: ExponentialBackoff
  private conflictHandling: DeferredResolution

  constructor(db?: any, retryManager?: any) {
    this.db = db
    this.retryManager = retryManager

    // Initialize advanced configuration
    this.onlineStatus = this.initializeOnlineStatus()
    this.retryStrategy = this.initializeRetryStrategy()
    this.conflictHandling = this.initializeConflictHandling()

    // Start monitoring and load persisted data
    this.startConnectivityMonitoring()
    this.setupNetworkListeners()
    this.loadPersistedQueue()
  }

  /**
   * Initialize online status
   */
  private initializeOnlineStatus(): OnlineStatus {
    return {
      isOnline: navigator.onLine,
      connectionType: 'online',
      lastConnected: Date.now(),
      connectionQuality: 1,
      syncStrategy: 'immediate'
    }
  }

  /**
   * Initialize retry strategy
   */
  private initializeRetryStrategy(): ExponentialBackoff {
    return {
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    }
  }

  /**
   * Initialize conflict handling
   */
  private initializeConflictHandling(): DeferredResolution {
    return {
      autoResolveConflicts: true,
      conflictTimeout: 30000,
      userPromptRequired: false,
      defaultResolution: 'merge'
    }
  }

  /**
   * Add an operation to the queue with enhanced validation and conflict handling
   */
  async addToQueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>): Promise<string> {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
      dependencies: []
    }

    // Validate operation data
    const validation = await this.validateOperation(queuedOp)
    if (!validation.valid) {
      throw new Error(`Operation validation failed: ${validation.errors.join(', ')}`)
    }

    // Check for conflicting operations and handle dependencies
    await this.handleOperationConflicts(queuedOp)

    // Add to queue
    this.queue.push(queuedOp)

    // Sort by priority and timestamp
    this.sortQueue(this.queue)

    // Persist to storage
    this.persistQueue()

    console.log(`📝 Operation queued: ${operation.type} ${operation.entityId} (${operation.priority} priority)`)

    // Emit event
    this.emitEvent('operation-added', queuedOp)

    // Start processing immediately if online and strategy allows
    if (this.onlineStatus.isOnline && this.onlineStatus.syncStrategy === 'immediate' && !this.processing) {
      this.processQueue()
    }

    return queuedOp.id
  }

  /**
   * Validate operation data with comprehensive checks
   */
  private async validateOperation(operation: QueuedOperation): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Basic validation
    if (!operation.entityId) {
      errors.push('Entity ID is required')
    }

    if (!operation.type || !['create', 'update', 'delete', 'sync', 'merge'].includes(operation.type)) {
      errors.push('Invalid operation type')
    }

    if (!operation.entityType || !['task', 'project', 'settings', 'user'].includes(operation.entityType)) {
      errors.push('Invalid entity type')
    }

    // Type-specific validation
    switch (operation.type) {
      case 'create':
      case 'update':
        if (!operation.data || typeof operation.data !== 'object') {
          errors.push('Data is required for create/update operations')
        }
        break

      case 'delete':
        if (operation.data && Object.keys(operation.data).length > 0) {
          errors.push('Delete operations should not include data')
        }
        break

      case 'merge':
        if (!operation.data || !operation.data.local || !operation.data.remote) {
          errors.push('Merge operations require local and remote data')
        }
        break
    }

    // Entity-specific validation
    if (operation.entityType === 'task') {
      const taskValidation = await this.validateTaskData(operation.data)
      errors.push(...taskValidation)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate task-specific data
   */
  private async validateTaskData(data: any): Promise<string[]> {
    const errors: string[] = []

    if (data && typeof data === 'object') {
      // Title validation
      if (data.title && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
        errors.push('Task title must be a non-empty string')
      }

      if (data.title && data.title.length > 500) {
        errors.push('Task title is too long (max 500 characters)')
      }

      // Priority validation
      if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
        errors.push('Invalid priority level')
      }

      // Due date validation
      if (data.dueDate) {
        const dueDate = new Date(data.dueDate)
        if (isNaN(dueDate.getTime())) {
          errors.push('Invalid due date format')
        }
      }

      // Tags validation
      if (data.tags && (!Array.isArray(data.tags) || data.tags.some((tag: any) => typeof tag !== 'string'))) {
        errors.push('Tags must be an array of strings')
      }
    }

    return errors
  }

  /**
   * Handle operation conflicts and dependencies
   */
  private async handleOperationConflicts(operation: QueuedOperation): Promise<void> {
    // Check for conflicting operations on the same entity
    const conflictingOps = this.queue.filter(existing => {
      if (existing.id === operation.id) return false
      if (existing.entityId !== operation.entityId) return false
      if (existing.entityType !== operation.entityType) return false
      if (existing.status === 'completed') return false

      // Different operations on same entity
      return true
    })

    if (conflictingOps.length > 0) {
      // Add dependencies
      operation.dependencies = conflictingOps.map(op => op.id)

      // Handle merge scenarios
      const lastOp = conflictingOps[conflictingOps.length - 1]
      if (lastOp.type === operation.type && operation.type === 'update') {
        // Merge the updates
        operation.data = { ...lastOp.data, ...operation.data }
        operation.originalData = lastOp.originalData || lastOp.data
      }
    }
  }

  /**
   * Process queued operations
   */
  async processQueue(): Promise<QueueProcessingResult> {
    if (this.processing || this.queue.length === 0) {
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        conflicts: 0,
        remaining: this.queue.length,
        processingTime: 0,
        errors: [],
        conflictDetails: []
      }
    }

    this.processing = true
    const startTime = Date.now()
    console.log(`🔄 Processing offline queue (${this.queue.length} operations)`)

    const result: QueueProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      conflicts: 0,
      remaining: 0,
      processingTime: 0,
      errors: [],
      conflictDetails: []
    }

    try {
      // Sort queue by priority and timestamp
      const sortedQueue = this.sortQueue(this.queue)

      for (const operation of sortedQueue) {
        if (!this.isOnline) {
          console.log('📵 Went offline, pausing queue processing')
          break
        }

        result.processed++
        console.log(`⚙️ Processing queued operation: ${operation.type} ${operation.documentId} (attempt ${operation.retryCount + 1})`)

        try {
          const success = await this.executeOperation(operation)

          if (success) {
            result.successful++
            this.removeFromQueue(operation.id)
            console.log(`✅ Processed queued operation: ${operation.type} ${operation.documentId}`)
          } else {
            result.failed++
            operation.retryCount++

            if (operation.retryCount >= 3) {
              console.error(`💥 Giving up on operation after 3 retries:`, operation)
              result.errors.push({
                operation,
                error: new Error(`Operation failed after 3 retries`)
              })
              this.removeFromQueue(operation.id)
            } else {
              console.warn(`⚠️ Operation failed, will retry later (attempt ${operation.retryCount}/3):`, operation)
            }
          }
        } catch (error) {
          result.failed++
          operation.retryCount++
          const errorObj = error as Error

          console.error(`❌ Failed to process queued operation:`, errorObj)
          result.errors.push({ operation, error: errorObj })

          if (operation.retryCount >= 3) {
            console.error(`💥 Giving up on operation after 3 retries:`, operation)
            this.removeFromQueue(operation.id)
          } else {
            console.warn(`⚠️ Operation failed, will retry later (attempt ${operation.retryCount}/3):`, operation)
          }
        }
      }

      this.persistQueue()
      this.totalProcessingTime += Date.now() - startTime

    } finally {
      this.processing = false
      result.processingTime = Date.now() - startTime
      result.remaining = this.queue.length

      // Store processing history
      this.processingHistory.push({
        timestamp: Date.now(),
        result
      })

      // Keep only last 100 processing results
      if (this.processingHistory.length > 100) {
        this.processingHistory = this.processingHistory.slice(-100)
      }

      console.log(`✅ Queue processing complete: ${result.successful}/${result.processed} successful (${result.processingTime}ms)`)
    }

    return result
  }

  /**
   * Execute a single queued operation
   */
  private async executeOperation(operation: QueuedOperation): Promise<boolean> {
    if (!this.db) {
      console.warn('⚠️ No database available for operation execution')
      return false
    }

    try {
      switch (operation.type) {
        case 'create':
          return await this.executeCreate(operation)
        case 'update':
          return await this.executeUpdate(operation)
        case 'delete':
          return await this.executeDelete(operation)
        case 'sync':
          return await this.executeSync(operation)
        default:
          throw new Error(`Unknown operation type: ${operation.type}`)
      }
    } catch (error) {
      console.error(`❌ Error executing ${operation.type} operation for ${operation.documentId}:`, error)
      throw error
    }
  }

  /**
   * Execute create operation
   */
  private async executeCreate(operation: QueuedOperation): Promise<boolean> {
    if (!operation.documentData) {
      throw new Error('Create operation requires document data')
    }

    try {
      await this.db.save(operation.documentId, operation.documentData)
      return true
    } catch (error) {
      console.error(`❌ Failed to create document ${operation.documentId}:`, error)
      throw error
    }
  }

  /**
   * Execute update operation
   */
  private async executeUpdate(operation: QueuedOperation): Promise<boolean> {
    if (!operation.documentData) {
      throw new Error('Update operation requires document data')
    }

    try {
      await this.db.save(operation.documentId, operation.documentData)
      return true
    } catch (error) {
      console.error(`❌ Failed to update document ${operation.documentId}:`, error)
      throw error
    }
  }

  /**
   * Execute delete operation
   */
  private async executeDelete(operation: QueuedOperation): Promise<boolean> {
    try {
      await this.db.remove(operation.documentId)
      return true
    } catch (error) {
      console.error(`❌ Failed to delete document ${operation.documentId}:`, error)
      throw error
    }
  }

  /**
   * Execute sync operation
   */
  private async executeSync(operation: QueuedOperation): Promise<boolean> {
    if (!this.retryManager) {
      console.warn('⚠️ No retry manager available for sync operation')
      return true // Don't fail sync operations if retry manager not available
    }

    try {
      const syncResult = await this.retryManager.executeWithRetry(
        async () => {
          // This would trigger the actual sync operation
          console.log(`🔄 Triggering sync for ${operation.documentId}`)
          return true // Placeholder for actual sync implementation
        },
        `sync-operation-${operation.documentId}`,
        { documentId: operation.documentId }
      )

      return syncResult.success
    } catch (error) {
      console.error(`❌ Failed to execute sync operation for ${operation.documentId}:`, error)
      throw error
    }
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueue(operations: QueuedOperation[]): QueuedOperation[] {
    return [...operations].sort((a, b) => {
      // First sort by priority (critical > high > medium > low > normal)
      const priorityOrder = { critical: 4, high: 3, medium: 2, normal: 1, low: 0 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) {
        return priorityDiff
      }

      // Then sort by timestamp (older operations first)
      return a.timestamp - b.timestamp
    })
  }

  /**
   * Remove an operation from the queue
   */
  private removeFromQueue(operationId: string): void {
    this.queue = this.queue.filter(op => op.id !== operationId)
  }

  
  /**
   * Start advanced connectivity monitoring
   */
  private startConnectivityMonitoring(): void {
    // Periodic connectivity check with quality assessment
    this.connectivityMonitor = setInterval(() => {
      this.checkConnectivity()
    }, 30000) as any // Check every 30 seconds
  }

  /**
   * Check connectivity quality and adjust sync strategy
   */
  private async checkConnectivity(): Promise<void> {
    try {
      const start = Date.now()
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      const latency = Date.now() - start

      if (response.ok) {
        this.onlineStatus.isOnline = true
        this.onlineStatus.connectionType = this.getConnectionType(latency)
        this.onlineStatus.connectionQuality = this.calculateConnectionQuality(latency)
        this.onlineStatus.latency = latency
        this.onlineStatus.lastConnected = Date.now()

        // Adjust sync strategy based on connection quality
        this.adjustSyncStrategy()

        // Start processing if we just came online
        if (!this.processing && this.queue.length > 0) {
          this.processQueue()
        }
      } else {
        this.onlineStatus.isOnline = false
        this.onlineStatus.connectionType = 'offline'
      }
    } catch {
      this.onlineStatus.isOnline = false
      this.onlineStatus.connectionType = 'offline'
    }

    this.emitEvent('connectivity-checked', this.onlineStatus)
  }

  /**
   * Determine connection type based on latency
   */
  private getConnectionType(latency: number): OnlineStatus['connectionType'] {
    if (latency < 200) return 'online'
    if (latency < 1000) return 'slow'
    return 'unstable'
  }

  /**
   * Calculate connection quality (0-1)
   */
  private calculateConnectionQuality(latency: number): number {
    // Map latency to quality score (0-1)
    if (latency < 100) return 1.0
    if (latency < 300) return 0.8
    if (latency < 1000) return 0.6
    if (latency < 3000) return 0.4
    return 0.2
  }

  /**
   * Adjust sync strategy based on connection quality
   */
  private adjustSyncStrategy(): void {
    const quality = this.onlineStatus.connectionQuality

    if (quality >= 0.8) {
      this.onlineStatus.syncStrategy = 'immediate'
    } else if (quality >= 0.4) {
      this.onlineStatus.syncStrategy = 'batched'
    } else {
      this.onlineStatus.syncStrategy = 'manual'
    }
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    const handleOnline = () => {
      console.log('🌐 Back online, updating connection status')
      this.onlineStatus.isOnline = true
      this.onlineStatus.lastConnected = Date.now()
      this.emitEvent('connection-status-changed', this.onlineStatus)

      // Start processing if strategy allows
      if (this.onlineStatus.syncStrategy === 'immediate' && !this.processing) {
        this.processQueue()
      }
    }

    const handleOffline = () => {
      console.log('📵 Gone offline, pausing queue processing')
      this.onlineStatus.isOnline = false
      this.onlineStatus.connectionType = 'offline'
      this.emitEvent('connection-status-changed', this.onlineStatus)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  /**
   * Event handling system
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emitEvent(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetryTime(retryCount: number): number {
    const delay = Math.min(
      this.retryStrategy.baseDelay * Math.pow(this.retryStrategy.backoffFactor, retryCount),
      this.retryStrategy.maxDelay
    )

    // Add jitter if enabled
    const jitterAmount = this.retryStrategy.jitter ? Math.random() * delay * 0.1 : 0

    return Date.now() + delay + jitterAmount
  }

  /**
   * Check if operation can be processed based on dependencies and timing
   */
  private canProcessOperation(operation: QueuedOperation): boolean {
    // Check if dependencies are completed
    if (operation.dependencies.length > 0) {
      const allDepsCompleted = operation.dependencies.every(depId => {
        const dep = this.queue.find(op => op.id === depId)
        return dep && dep.status === 'completed'
      })
      if (!allDepsCompleted) return false
    }

    // Check retry timing - this would need to be added to the operation interface
    // For now, just check if we haven't exceeded max retries
    return operation.retryCount < operation.maxRetries
  }

  /**
   * Generate unique operation ID
   */
  private generateId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Persist queue to localStorage
   */
  private persistQueue(): void {
    try {
      const queueData = {
        queue: this.queue,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      localStorage.setItem('pomoflow-offline-queue', JSON.stringify(queueData))
    } catch (error) {
      console.error('Failed to persist offline queue:', error)
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadPersistedQueue(): void {
    try {
      const persisted = localStorage.getItem('pomoflow-offline-queue')
      if (persisted) {
        const queueData = JSON.parse(persisted)
        this.queue = queueData.queue || []
        this.queue = this.queue.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }))
        console.log(`📂 Loaded ${this.queue.length} operations from offline queue`)

        // Process queue if online
        if (this.isOnline && this.queue.length > 0) {
          setTimeout(() => this.processQueue(), 1000) // Delay to ensure app is ready
        }
      }
    } catch (error) {
      console.error('Failed to load persisted offline queue:', error)
      this.queue = []
    }
  }

  /**
   * Get current queue status
   */
  getQueueStats(): QueueStats {
    const byType = this.queue.reduce((acc, op) => {
      acc[op.type] = (acc[op.type] || 0) + 1
      return acc
    }, {} as Record<QueuedOperation['type'], number>)

    const byPriority = this.queue.reduce((acc, op) => {
      acc[op.priority] = (acc[op.priority] || 0) + 1
      return acc
    }, {} as Record<QueuedOperation['priority'], number>)

    const oldestOperation = this.queue.length > 0
      ? this.queue.reduce((oldest, op) => op.timestamp < oldest.timestamp ? op : oldest).timestamp
      : undefined

    return {
      length: this.queue.length,
      processing: this.processing,
      isOnline: this.isOnline,
      byType,
      byPriority,
      oldestOperation,
      totalProcessingTime: this.totalProcessingTime,
      byStatus: {} as any, // Add missing property
      estimatedProcessingTime: 0, // Add missing property
      conflictCount: 0 // Add missing property
    }
  }

  /**
   * Get operations by type or priority
   */
  getOperations(filter?: { type?: QueuedOperation['type']; priority?: QueuedOperation['priority'] }): QueuedOperation[] {
    let filtered = [...this.queue]

    if (filter?.type) {
      filtered = filtered.filter(op => op.type === filter.type)
    }

    if (filter?.priority) {
      filtered = filtered.filter(op => op.priority === filter.priority)
    }

    return filtered
  }

  /**
   * Get operations that have failed multiple times
   */
  getFailedOperations(maxRetries: number = 2): QueuedOperation[] {
    return this.queue.filter(op => op.retryCount >= maxRetries)
  }

  /**
   * Retry specific operations
   */
  async retryOperations(operationIds: string[]): Promise<void> {
    for (const id of operationIds) {
      const operation = this.queue.find(op => op.id === id)
      if (operation) {
        operation.retryCount = 0 // Reset retry count
        console.log(`🔄 Queued operation ${id} for retry`)
      }
    }

    if (this.isOnline && !this.processing) {
      await this.processQueue()
    }
  }

  /**
   * Clear the queue
   */
  clearQueue(keepFailed: boolean = false): void {
    if (keepFailed) {
      const failedOps = this.queue.filter(op => op.retryCount >= 3)
      this.queue = failedOps
    } else {
      this.queue = []
    }

    this.persistQueue()
    console.log('🧹 Queue cleared' + (keepFailed ? ' (kept failed operations)' : ''))
  }

  /**
   * Get processing history
   */
  getProcessingHistory(limit: number = 10): Array<{ timestamp: Date; result: QueueProcessingResult }> {
    return this.processingHistory.slice(-limit).map(item => ({
      timestamp: new Date(item.timestamp),
      result: item.result
    }))
  }

  /**
   * Update database and retry manager references
   */
  updateReferences(db: any, retryManager: any): void {
    this.db = db
    this.retryManager = retryManager
    console.log('🔄 OfflineQueue references updated')
  }

  /**
   * Check if the queue has high priority operations
   */
  hasHighPriorityOperations(): boolean {
    return this.queue.some(op => op.priority === 'high')
  }

  /**
   * Get estimated processing time for remaining operations
   */
  getEstimatedProcessingTime(): number {
    if (this.processingHistory.length === 0) {
      return this.queue.length * 500 // Default 500ms per operation
    }

    // Calculate average time per operation from recent history
    const recentHistory = this.processingHistory.slice(-5)
    const totalTime = recentHistory.reduce((sum, entry) => sum + entry.result.processingTime, 0)
    const totalOps = recentHistory.reduce((sum, entry) => sum + entry.result.processed, 0)
    const avgTimePerOp = totalOps > 0 ? totalTime / totalOps : 500

    return this.queue.length * avgTimePerOp
  }
}