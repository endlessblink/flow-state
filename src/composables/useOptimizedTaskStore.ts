/**
 * Optimized Task Store Operations
 * Provides debounced, memoized, and performance-optimized task store operations
 */

import { ref, computed, onUnmounted } from 'vue'
import { usePerformanceManager } from './usePerformanceManager'
import { useDatabase } from './useDatabase'
import { DB_KEYS } from './useDatabase'

export interface OptimizedTaskStoreOptions {
  debounceDelay?: number
  enableBatching?: boolean
  batchSize?: number
  batchDelay?: number
  enableMemoization?: boolean
  enableCompression?: boolean
}

export interface BatchOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
  priority?: 'high' | 'normal' | 'low'
}

export function useOptimizedTaskStore(options: OptimizedTaskStoreOptions = {}) {
  const {
    debounceDelay = 1000,
    enableBatching = true,
    batchSize = 10,
    batchDelay = 500,
    enableMemoization = true,
    enableCompression: _enableCompression = true
  } = options

  // Performance manager
  const performance = usePerformanceManager({
    debounceDelay,
    enableMemoization,
    maxCacheSize: 200,
    cleanupInterval: 30000
  })

  // Database composable
  const db = useDatabase()

  // Reactive state
  const pendingOperations = ref<Map<string, BatchOperation>>(new Map())
  const operationQueue = ref<BatchOperation[]>([])
  const isProcessing = ref(false)
  const lastSaveTime = ref(0)

  // Metrics
  const metrics = ref({
    totalOperations: 0,
    batchedOperations: 0,
    debouncedSaves: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageSaveTime: 0,
    errorCount: 0,
    lastError: null as Error | null
  })

  // Create debounced save function
  const debouncedSave = performance.createDebounced(async (tasks: any[], operationType: string) => {
    const startTime = Date.now()

    try {
      await db.save(DB_KEYS.TASKS, tasks)
      const saveTime = Date.now() - startTime

      lastSaveTime.value = Date.now()
      metrics.value.debouncedSaves++
      metrics.value.averageSaveTime = (metrics.value.averageSaveTime + saveTime) / 2

      // Cache the saved tasks
      const cacheKey = `tasks_${Date.now()}`
      performance.setCache(cacheKey, tasks)

      console.log(`✅ [OPTIMIZED] Debounced save completed in ${saveTime.toFixed(2)}ms (${operationType})`)

    } catch (error) {
      metrics.value.errorCount++
      metrics.value.lastError = error as Error
      console.error('❌ [OPTIMIZED] Debounced save failed:', error)
      throw error
    }
  }, debounceDelay)

  // Create batched save function
  const batchedSave = performance.createDebounced(async () => {
    if (operationQueue.value.length === 0 || isProcessing.value) return

    isProcessing.value = true
    const batch = operationQueue.value.splice(0, batchSize)

    try {
      const startTime = Date.now()

      // Group operations by type for optimal processing
      const groupedOps = batch.reduce((acc, op) => {
        if (!acc[op.type]) acc[op.type] = []
        acc[op.type].push(op)
        return acc
      }, {} as Record<string, BatchOperation[]>)

      // Process batch
      await processBatchOperations(groupedOps)

      const batchTime = Date.now() - startTime
      metrics.value.batchedOperations += batch.length

      console.log(`✅ [OPTIMIZED] Batch processed ${batch.length} operations in ${batchTime.toFixed(2)}ms`)

    } catch (error) {
      metrics.value.errorCount++
      metrics.value.lastError = error as Error
      console.error('❌ [OPTIMIZED] Batch processing failed:', error)

      // Re-queue failed operations
      operationQueue.value.unshift(...batch)
    } finally {
      isProcessing.value = false
    }
  }, batchDelay)

  // Process batch operations
  const processBatchOperations = async (groupedOps: Record<string, BatchOperation[]>) => {
    // Load current tasks
    const currentTasks = ((await db.load(DB_KEYS.TASKS) || []) as any[]) as any[]

    // Apply operations in order
    for (const [operationType, operations] of Object.entries(groupedOps)) {
      switch (operationType) {
        case 'create':
          for (const op of operations) {
            if (!currentTasks.find((t: any) => t.id === op.data.id)) {
              currentTasks.push(op.data)
            }
          }
          break

        case 'update':
          for (const op of operations) {
            const index = currentTasks.findIndex((t: any) => t.id === op.data.id)
            if (index !== -1) {
              currentTasks[index] = { ...currentTasks[index], ...op.data }
            }
          }
          break

        case 'delete': {
          const idsToDelete = operations.map(op => op.data.id)
          for (const id of idsToDelete) {
            const index = currentTasks.findIndex((t: any) => t.id === id)
            if (index !== -1) {
              currentTasks.splice(index, 1)
            }
          }
          break
        }
      }
    }

    // Save once for the entire batch
    await db.save(DB_KEYS.TASKS, currentTasks)
  }

  // Optimized save task function
  const saveTask = async (task: any, operationType: 'create' | 'update' = 'update') => {
    const operation: BatchOperation = {
      id: `task_${task.id}_${Date.now()}`,
      type: operationType,
      data: task,
      timestamp: Date.now(),
      priority: 'normal'
    }

    metrics.value.totalOperations++

    if (enableBatching) {
      // Add to batch queue
      operationQueue.value.push(operation)

      // Trigger batch processing
      await batchedSave()
    } else {
      // Immediate debounced save
      const currentTasks = (await db.load(DB_KEYS.TASKS) || []) as any[]

      if (operationType === 'create' && !currentTasks.find((t: any) => t.id === task.id)) {
        currentTasks.push(task)
      } else if (operationType === 'update') {
        const index = currentTasks.findIndex((t: any) => t.id === task.id)
        if (index !== -1) {
          currentTasks[index] = { ...currentTasks[index], ...task }
        }
      }

      await debouncedSave(currentTasks, operationType)
    }
  }

  // Optimized delete task function
  const deleteTask = async (taskId: string) => {
    const operation: BatchOperation = {
      id: `delete_${taskId}_${Date.now()}`,
      type: 'delete',
      data: { id: taskId },
      timestamp: Date.now(),
      priority: 'high'
    }

    metrics.value.totalOperations++

    if (enableBatching) {
      // High priority operations go to the front of the queue
      operationQueue.value.unshift(operation)
      await batchedSave()
    } else {
      const currentTasks = (await db.load(DB_KEYS.TASKS) || []) as any[]
      const index = currentTasks.findIndex((t: any) => t.id === taskId)

      if (index !== -1) {
        currentTasks.splice(index, 1)
        await debouncedSave(currentTasks, 'delete')
      }
    }
  }

  // Optimized bulk operations
  const bulkSaveTasks = async (tasks: any[], operationType: 'create' | 'update' = 'update') => {
    if (!enableBatching) {
      // Fall back to individual saves
      for (const task of tasks) {
        await saveTask(task, operationType)
      }
      return
    }

    // Create batch operations for all tasks
    const operations = tasks.map(task => ({
      id: `bulk_${task.id}_${Date.now()}_${Math.random()}`,
      type: operationType,
      data: task,
      timestamp: Date.now(),
      priority: 'normal'
    } as BatchOperation))

    // Add all to queue
    operationQueue.value.push(...operations)
    metrics.value.totalOperations += operations.length

    // Trigger batch processing
    await batchedSave()
  }

  // Optimized load with caching
  const loadTasks = async (): Promise<any[]> => {
    const cacheKey = 'tasks_current'

    // Check cache first
    const cached = performance.getCache<any[]>(cacheKey)
    if (cached) {
      metrics.value.cacheHits++
      return cached
    }

    metrics.value.cacheMisses++

    // Load from database
    const tasks = (await db.load(DB_KEYS.TASKS) || []) as any[]

    // Cache the result
    performance.setCache(cacheKey, tasks)

    return tasks
  }

  // Memoized computed properties for task filtering
  const createMemoizedFilter = (filterFn: (task: any) => boolean, deps: any[] = []) => {
    return performance.createMemoized(
      (tasks: any[]) => tasks.filter(filterFn),
      `filter_${filterFn.name || 'anonymous'}`,
      deps
    )
  }

  // Common memoized filters
  const activeTasksFilter = createMemoizedFilter(
    (task: any) => task.status !== 'done',
    ['status']
  )

  const completedTasksFilter = createMemoizedFilter(
    (task: any) => task.status === 'done',
    ['status']
  )

  const highPriorityTasksFilter = createMemoizedFilter(
    (task: any) => task.priority === 'high',
    ['priority']
  )

  // Performance monitoring
  const performanceStats = computed(() => ({
    ...metrics.value,
    ...performance.metrics.value,
    queueLength: operationQueue.value.length,
    isProcessing: isProcessing.value,
    lastSaveTime: lastSaveTime.value,
    cacheHitRate: metrics.value.cacheHits / (metrics.value.cacheHits + metrics.value.cacheMisses) || 0,
    batchingEfficiency: enableBatching ?
      (metrics.value.batchedOperations / metrics.value.totalOperations) * 100 : 0
  }))

  // Force immediate save (bypasses debouncing)
  const forceSave = async (tasks?: any[]) => {
    try {
      const tasksToSave = tasks || await db.load(DB_KEYS.TASKS)
      await db.save(DB_KEYS.TASKS, tasksToSave)
      lastSaveTime.value = Date.now()

      // Clear any pending operations
      operationQueue.value = []
      pendingOperations.value.clear()

      console.log('✅ [OPTIMIZED] Force save completed')
    } catch (error) {
      metrics.value.errorCount++
      metrics.value.lastError = error as Error
      throw error
    }
  }

  // Cleanup operations
  const cleanup = () => {
    operationQueue.value = []
    pendingOperations.value.clear()
    performance.clearCache()
    console.log('🧹 [OPTIMIZED] Task store cleanup completed')
  }

  // Setup cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // Core operations
    saveTask,
    deleteTask,
    bulkSaveTasks,
    loadTasks,
    forceSave,

    // Filters
    activeTasksFilter,
    completedTasksFilter,
    highPriorityTasksFilter,
    createMemoizedFilter,

    // Performance
    performanceStats,
    performance,

    // Utilities
    cleanup,
    isProcessing,
    queueLength: computed(() => operationQueue.value.length)
  }
}

// Global optimized task store instance
export const globalOptimizedTaskStore = useOptimizedTaskStore()

export default useOptimizedTaskStore