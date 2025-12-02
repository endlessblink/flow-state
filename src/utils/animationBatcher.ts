/**
 * Global Animation Batcher for GPU Performance Optimization
 *
 * Consolidates multiple requestAnimationFrame calls into a single
 * animation loop to reduce GPU overhead and improve performance.
 */

export interface AnimationCallback {
  (): void
  id?: string
  priority?: number
}

export class GlobalAnimationBatcher {
  private static instance: GlobalAnimationBatcher | null = null
  private callbacks: Set<AnimationCallback> = new Set()
  private rafId: number | null = null
  private isRunning = false
  private lastFrameTime = 0
  private targetFPS = 60
  private frameInterval = 1000 / this.targetFPS

  private constructor() {}

  static getInstance(): GlobalAnimationBatcher {
    if (!GlobalAnimationBatcher.instance) {
      GlobalAnimationBatcher.instance = new GlobalAnimationBatcher()
    }
    return GlobalAnimationBatcher.instance
  }

  /**
   * Add a callback to be executed on the next animation frame
   */
  add(callback: AnimationCallback): void {
    this.callbacks.add(callback)

    if (!this.isRunning) {
      this.start()
    }
  }

  /**
   * Add a high-priority callback (executed first)
   */
  addHighPriority(callback: AnimationCallback): void {
    callback.priority = 1
    this.add(callback)
  }

  /**
   * Add a low-priority callback (executed last, can be skipped for performance)
   */
  addLowPriority(callback: AnimationCallback): void {
    callback.priority = 2
    this.add(callback)
  }

  /**
   * Remove a specific callback
   */
  remove(callback: AnimationCallback): void {
    this.callbacks.delete(callback)

    if (this.callbacks.size === 0 && this.isRunning) {
      this.stop()
    }
  }

  /**
   * Clear all pending callbacks
   */
  clear(): void {
    this.callbacks.clear()
    this.stop()
  }

  /**
   * Set target FPS for performance optimization
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = Math.max(1, Math.min(120, fps))
    this.frameInterval = 1000 / this.targetFPS
  }

  /**
   * Start the animation loop
   */
  private start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.scheduleNextFrame()
  }

  /**
   * Stop the animation loop
   */
  private stop(): void {
    this.isRunning = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /**
   * Schedule the next frame with FPS limiting
   */
  private scheduleNextFrame(): void {
    if (!this.isRunning) return

    const now = performance.now()
    const deltaTime = now - this.lastFrameTime

    if (deltaTime >= this.frameInterval) {
      this.rafId = requestAnimationFrame((timestamp) => {
        this.processFrame(timestamp)
      })
    } else {
      // Not enough time has passed, schedule for later
      const delay = this.frameInterval - deltaTime
      setTimeout(() => this.scheduleNextFrame(), delay)
    }
  }

  /**
   * Process a single animation frame
   */
  private processFrame(timestamp: number): void {
    if (!this.isRunning) return

    // Update timing
    this.lastFrameTime = timestamp

    // Sort callbacks by priority (high priority first)
    const sortedCallbacks = Array.from(this.callbacks).sort((a, b) => {
      const priorityA = a.priority || 0
      const priorityB = b.priority || 0
      return priorityB - priorityA
    })

    // Execute callbacks with error handling
    for (const callback of sortedCallbacks) {
      try {
        callback()
      } catch (error) {
        console.error('Error in animation callback:', error)
        // Remove problematic callback to prevent breaking the loop
        this.callbacks.delete(callback)
      }
    }

    // Clear low-priority callbacks to reduce overhead
    this.callbacks = new Set(
      Array.from(this.callbacks).filter(cb => (cb.priority || 0) <= 1)
    )

    // Schedule next frame if we still have callbacks
    if (this.callbacks.size > 0) {
      this.scheduleNextFrame()
    } else {
      this.stop()
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      callbackCount: this.callbacks.size,
      targetFPS: this.targetFPS,
      hasHighPriorityCallbacks: Array.from(this.callbacks).some(cb => (cb.priority || 0) > 0)
    }
  }

  /**
   * Force cleanup and reset
   */
  destroy(): void {
    this.clear()
    GlobalAnimationBatcher.instance = null
  }
}

/**
 * Composable for easy integration with Vue components
 */
export function useAnimationBatcher() {
  const batcher = GlobalAnimationBatcher.getInstance()

  return {
    add: batcher.add.bind(batcher),
    addHighPriority: batcher.addHighPriority.bind(batcher),
    addLowPriority: batcher.addLowPriority.bind(batcher),
    remove: batcher.remove.bind(batcher),
    clear: batcher.clear.bind(batcher),
    setTargetFPS: batcher.setTargetFPS.bind(batcher),
    getStats: batcher.getStats.bind(batcher),

    // Helper for component lifecycle
    onUnmounted: (callback: AnimationCallback) => {
      // This will be called when component unmounts
      batcher.remove(callback)
    }
  }
}

/**
 * Performance-optimized throttling using the global animation batcher
 */
export function createAnimationThrottle<T extends (...args: any[]) => any>(
  fn: T,
  priority: number = 0
): T {
  const batcher = GlobalAnimationBatcher.getInstance()

  return ((...args: Parameters<T>) => {
    const callback = () => fn(...args)
    callback.priority = priority
    batcher.add(callback)
  }) as T
}

export default GlobalAnimationBatcher