/**
 * Cleanup Manager Composable
 * Provides comprehensive cleanup and resource management for Vue components and composables
 */

import { onUnmounted, onMounted, onBeforeUnmount, ref } from 'vue'
import { useMemoryLeakDetector } from '@/utils/memoryLeakDetector'

export interface CleanupTask {
  id: string
  type: 'timer' | 'eventListener' | 'subscription' | 'observer' | 'custom'
  cleanup: () => void
  description?: string
  priority: 'high' | 'medium' | 'low'
  component?: string
  timestamp: number
}

export interface CleanupMetrics {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  memoryFreed: number
  cleanupTime: number
  activeTimers: number
  activeListeners: number
  activeObservers: number
}

export function useCleanupManager(componentName?: string) {
  const memoryDetector = useMemoryLeakDetector()
  const cleanupTasks = ref<CleanupTask[]>([])
  const isCleaningUp = ref(false)
  const metrics = ref<CleanupMetrics>({
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    memoryFreed: 0,
    cleanupTime: 0,
    activeTimers: 0,
    activeListeners: 0,
    activeObservers: 0
  })

  // Register cleanup task
  const addCleanupTask = (
    cleanup: () => void,
    type: CleanupTask['type'],
    description?: string,
    priority: CleanupTask['priority'] = 'medium'
  ): string => {
    const taskId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const task: CleanupTask = {
      id: taskId,
      type,
      cleanup,
      description,
      priority,
      component: componentName,
      timestamp: Date.now()
    }

    cleanupTasks.value.push(task)
    metrics.value.totalTasks++

    // Track with memory leak detector
    if (type === 'timer') {
      metrics.value.activeTimers++
    } else if (type === 'eventListener') {
      metrics.value.activeListeners++
    } else if (type === 'observer') {
      metrics.value.activeObservers++
    }

    return taskId
  }

  // Remove cleanup task
  const removeCleanupTask = (taskId: string): boolean => {
    const index = cleanupTasks.value.findIndex(task => task.id === taskId)
    if (index !== -1) {
      const task = cleanupTasks.value[index]

      // Update metrics
      if (task.type === 'timer') {
        metrics.value.activeTimers = Math.max(0, metrics.value.activeTimers - 1)
      } else if (task.type === 'eventListener') {
        metrics.value.activeListeners = Math.max(0, metrics.value.activeListeners - 1)
      } else if (task.type === 'observer') {
        metrics.value.activeObservers = Math.max(0, metrics.value.activeObservers - 1)
      }

      cleanupTasks.value.splice(index, 1)
      return true
    }
    return false
  }

  // Execute cleanup task
  const executeCleanupTask = async (task: CleanupTask): Promise<boolean> => {
    try {
      const startTime = performance.now()
      await task.cleanup()
      const duration = performance.now() - startTime

      metrics.value.completedTasks++
      metrics.value.cleanupTime += duration

      console.log(`✅ [CLEANUP] ${task.type} completed: ${task.description || task.id} (${duration.toFixed(2)}ms)`)
      return true

    } catch (error) {
      metrics.value.failedTasks++
      console.error(`❌ [CLEANUP] ${task.type} failed: ${task.description || task.id}`, error)
      return false
    }
  }

  // Execute all cleanup tasks
  const executeCleanup = async (): Promise<void> => {
    if (isCleaningUp.value) {
      console.warn('[CLEANUP] Cleanup already in progress')
      return
    }

    isCleaningUp.value = true
    console.log(`🧹 [CLEANUP] Starting cleanup for component: ${componentName || 'unknown'}`)

    // Get initial memory snapshot
    const initialMemory = memoryDetector.currentMemory().usedJSHeapSize

    try {
      // Sort tasks by priority (high first)
      const sortedTasks = [...cleanupTasks.value].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })

      // Execute tasks in order
      for (const task of sortedTasks) {
        await executeCleanupTask(task)
      }

      // Clear all tasks
      cleanupTasks.value = []

      // Calculate memory freed
      const finalMemory = memoryDetector.currentMemory().usedJSHeapSize
      metrics.value.memoryFreed = Math.max(0, initialMemory - finalMemory)

      console.log(`✅ [CLEANUP] All cleanup tasks completed. Memory freed: ${(metrics.value.memoryFreed / 1024).toFixed(1)}KB`)

    } finally {
      isCleaningUp.value = false
    }
  }

  // Cleanup helpers for common patterns

  // Timer cleanup
  const registerTimer = (timerId: number, description?: string): string => {
    memoryDetector.detector.registerTimer(timerId, componentName)
    return addCleanupTask(
      () => {
        clearTimeout(timerId)
        clearInterval(timerId)
        memoryDetector.detector.unregisterTimer(timerId)
      },
      'timer',
      description || `Timer ${timerId}`,
      'high'
    )
  }

  // Event listener cleanup
  const registerEventListener = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    description?: string
  ): string => {
    memoryDetector.detector.registerEventListener(target, type, componentName)

    // Add the event listener
    target.addEventListener(type, listener, options)

    return addCleanupTask(
      () => {
        target.removeEventListener(type, listener, options)
      },
      'eventListener',
      description || `${target.constructor.name} ${type}`,
      'high'
    )
  }

  // Observer cleanup
  const registerObserver = (observer: { disconnect: () => void }, description?: string): string => {
    return addCleanupTask(
      () => observer.disconnect(),
      'observer',
      description || 'Observer',
      'medium'
    )
  }

  // Subscription cleanup
  const registerSubscription = (subscription: { unsubscribe: () => void }, description?: string): string => {
    return addCleanupTask(
      () => subscription.unsubscribe(),
      'subscription',
      description || 'Subscription',
      'medium'
    )
  }

  // Custom cleanup function
  const registerCustomCleanup = (cleanup: () => void, description?: string, priority: CleanupTask['priority'] = 'medium'): string => {
    return addCleanupTask(cleanup, 'custom', description, priority)
  }

  // Window event cleanup
  const registerWindowEvent = (type: string, listener: EventListener, description?: string): string => {
    return registerEventListener(window, type, listener, undefined, description || `Window ${type}`)
  }

  // Document event cleanup
  const registerDocumentEvent = (type: string, listener: EventListener, description?: string): string => {
    return registerEventListener(document, type, listener, undefined, description || `Document ${type}`)
  }

  // Resize observer cleanup
  const registerResizeObserver = (callback: ResizeObserverCallback, target?: Element): ResizeObserver => {
    const observer = new ResizeObserver(callback)
    if (target) {
      observer.observe(target)
    }

    registerObserver(observer, `ResizeObserver${target ? ` on ${target.tagName}` : ''}`)
    return observer
  }

  // Mutation observer cleanup
  const registerMutationObserver = (callback: MutationCallback, target: Node, options?: MutationObserverInit): MutationObserver => {
    const observer = new MutationObserver(callback)
    observer.observe(target, options)

    registerObserver(observer, `MutationObserver on ${target.nodeName}`)
    return observer
  }

  // Intersection observer cleanup
  const registerIntersectionObserver = (callback: IntersectionObserverCallback, target: Element, options?: IntersectionObserverInit): IntersectionObserver => {
    const observer = new IntersectionObserver(callback, options)
    observer.observe(target)

    registerObserver(observer, `IntersectionObserver on ${target.tagName}`)
    return observer
  }

  // Performance observer cleanup
  const registerPerformanceObserver = (callback: PerformanceObserverCallback, options: PerformanceObserverInit): PerformanceObserver => {
    const observer = new PerformanceObserver(callback)
    observer.observe(options)

    registerObserver(observer, 'PerformanceObserver')
    return observer
  }

  // Safe setTimeout with cleanup
  const safeSetTimeout = (callback: () => void, delay: number, description?: string): number => {
    const timerId = setTimeout(() => {
      callback()
      // Auto-remove from cleanup tasks after execution
      removeCleanupTask(`timer-${timerId}`)
    }, delay)

    registerTimer(Number(timerId), description || `setTimeout ${delay}ms`)
    return Number(timerId)
  }

  // Safe setInterval with cleanup
  const safeSetInterval = (callback: () => void, delay: number, description?: string): number => {
    const timerId = setInterval(callback, delay)
    registerTimer(Number(timerId), description || `setInterval ${delay}ms`)
    return Number(timerId)
  }

  // Safe requestAnimationFrame with cleanup
  const safeRequestAnimationFrame = (callback: FrameRequestCallback, description?: string): number => {
    const frameId = requestAnimationFrame((timestamp) => {
      callback(timestamp)
      // Auto-remove from cleanup tasks after execution
      removeCleanupTask(`timer-${frameId}`)
    })

    registerTimer(Number(frameId), description || 'requestAnimationFrame')
    return frameId
  }

  // Get cleanup statistics
  const getCleanupStats = () => {
    const tasksByType = cleanupTasks.value.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const tasksByPriority = cleanupTasks.value.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalTasks: cleanupTasks.value.length,
      tasksByType,
      tasksByPriority,
      metrics: metrics.value,
      isCleaningUp: isCleaningUp.value
    }
  }

  // Force cleanup of specific type
  const forceCleanupType = async (type: CleanupTask['type']): Promise<void> => {
    const tasksToCleanup = cleanupTasks.value.filter(task => task.type === type)

    for (const task of tasksToCleanup) {
      await executeCleanupTask(task)
      removeCleanupTask(task.id)
    }
  }

  // Force cleanup of specific priority
  const forceCleanupPriority = async (priority: CleanupTask['priority']): Promise<void> => {
    const tasksToCleanup = cleanupTasks.value.filter(task => task.priority === priority)

    for (const task of tasksToCleanup) {
      await executeCleanupTask(task)
      removeCleanupTask(task.id)
    }
  }

  // Emergency cleanup - clear everything
  const emergencyCleanup = async (): Promise<void> => {
    console.warn('🚨 [CLEANUP] Emergency cleanup triggered!')

    // Execute all tasks regardless of priority
    for (const task of cleanupTasks.value) {
      try {
        await task.cleanup()
        metrics.value.completedTasks++
      } catch (error) {
        metrics.value.failedTasks++
        console.error(`❌ [EMERGENCY CLEANUP] Failed: ${task.id}`, error)
      }
    }

    // Clear everything
    cleanupTasks.value = []

    // Force garbage collection if available
    if ('gc' in window) {
      (window as Window & typeof globalThis).gc?.()
    }
  }

  // Auto-setup on mount
  onMounted(() => {
    if (componentName) {
      memoryDetector.registerComponent(componentName)
    }
  })

  // Auto-cleanup on unmount
  onBeforeUnmount(async () => {
    if (componentName) {
      memoryDetector.unregisterComponent(componentName)
    }
    await executeCleanup()
  })

  // Emergency cleanup on page unload
  onUnmounted(() => {
    if (cleanupTasks.value.length > 0) {
      console.warn(`⚠️ [CLEANUP] ${cleanupTasks.value.length} cleanup tasks remaining after component unmount`)
    }
  })

  // Listen for page unload to ensure cleanup
  const handleUnload = () => {
    emergencyCleanup()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('unload', handleUnload)
    registerCustomCleanup(
      () => window.removeEventListener('unload', handleUnload),
      'Window unload handler',
      'high'
    )
  }

  return {
    // Task management
    addCleanupTask,
    removeCleanupTask,
    executeCleanup,
    forceCleanupType,
    forceCleanupPriority,
    emergencyCleanup,

    // Registration helpers
    registerTimer,
    registerEventListener,
    registerObserver,
    registerSubscription,
    registerCustomCleanup,
    registerWindowEvent,
    registerDocumentEvent,

    // Observer helpers
    registerResizeObserver,
    registerMutationObserver,
    registerIntersectionObserver,
    registerPerformanceObserver,

    // Safe async functions
    safeSetTimeout,
    safeSetInterval,
    safeRequestAnimationFrame,

    // Utilities
    getCleanupStats,

    // Reactive state
    isCleaningUp,
    metrics,
    tasks: cleanupTasks
  }
}

// Global cleanup manager for app-level resources
export const globalCleanupManager = useCleanupManager('GlobalApp')

export default useCleanupManager