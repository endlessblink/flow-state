/**
 * Event Bus Service for decoupled component communication
 *
 * Provides a centralized event system that allows components to communicate
 * without direct dependencies, supporting better modularity and testability.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

import type { EventHandler } from '@/types/common'

/**
 * Event listener interface
 */
interface EventListener<T = any> {
  /** Event handler function */
  handler: EventHandler<T>
  /** Whether listener should run only once */
  once: boolean
  /** Listener creation timestamp */
  createdAt: Date
}

/**
 * Event Bus implementation
 * Provides publish-subscribe pattern for decoupled communication
 */
export class EventBus {
  /** Map of event names to arrays of listeners */
  private listeners: Map<string, EventListener[]> = new Map()

  /** Maximum number of listeners per event to prevent memory leaks */
  private maxListeners: number = 100

  /** Event history for debugging (limited size) */
  private eventHistory: Array<{
    event: string
    data: any
    timestamp: Date
    listenerCount: number
  }> = []

  /** Maximum event history size */
  private maxEventHistory: number = 1000

  /**
   * Subscribe to an event
   *
   * @param event - Event name to listen for
   * @param handler - Function to call when event is emitted
   * @param once - Whether to listen only once (default: false)
   * @returns Unsubscribe function
   */
  on<T = any>(event: string, handler: EventHandler<T>, once: boolean = false): () => void {
    // Validate inputs
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string')
    }

    if (!handler || typeof handler !== 'function') {
      throw new Error('Event handler must be a function')
    }

    // Get or create listeners array for this event
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    const listeners = this.listeners.get(event)!

    // Check for maximum listeners
    if (listeners.length >= this.maxListeners) {
      console.warn(`EventBus: Maximum listeners (${this.maxListeners}) reached for event "${event}"`)
    }

    // Add listener
    const listener: EventListener<T> = {
      handler,
      once,
      createdAt: new Date()
    }

    listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to an event only once
   *
   * @param event - Event name to listen for
   * @param handler - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  once<T = any>(event: string, handler: EventHandler<T>): () => void {
    return this.on(event, handler, true)
  }

  /**
   * Emit an event to all listeners
   *
   * @param event - Event name to emit
   * @param data - Event data to pass to listeners
   * @returns Number of listeners notified
   */
  emit<T = any>(event: string, data?: T): number {
    const listeners = this.listeners.get(event)

    if (!listeners || listeners.length === 0) {
      return 0
    }

    // Record event in history
    this.recordEvent(event, data, listeners.length)

    // Create a copy of listeners to handle removal during iteration
    const listenersToNotify = [...listeners]
    let notifiedCount = 0

    // Notify all listeners
    for (const listener of listenersToNotify) {
      try {
        listener.handler(data)
        notifiedCount++

        // Remove one-time listeners after notification
        if (listener.once) {
          const index = listeners.indexOf(listener)
          if (index > -1) {
            listeners.splice(index, 1)
          }
        }
      } catch (error) {
        console.error(`EventBus: Error in event handler for "${event}":`, error)
      }
    }

    return notifiedCount
  }

  /**
   * Remove all listeners for an event
   *
   * @param event - Event name to clear listeners for
   */
  off(event: string): void {
    this.listeners.delete(event)
  }

  /**
   * Remove a specific listener for an event
   *
   * @param event - Event name
   * @param handler - Handler function to remove
   */
  removeListener<T = any>(event: string, handler: EventHandler<T>): void {
    const listeners = this.listeners.get(event)
    if (!listeners) return

    const index = listeners.findIndex(listener => listener.handler === handler)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }

  /**
   * Get the number of listeners for an event
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0
  }

  /**
   * Get all event names that have listeners
   *
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * Clear all listeners and event history
   */
  clear(): void {
    this.listeners.clear()
    this.eventHistory = []
  }

  /**
   * Get event history for debugging
   *
   * @param limit - Maximum number of events to return
   * @returns Array of historical events
   */
  getEventHistory(limit: number = 100): Array<{
    event: string
    data: any
    timestamp: Date
    listenerCount: number
  }> {
    return this.eventHistory.slice(-limit)
  }

  /**
   * Set maximum number of listeners per event
   *
   * @param max - Maximum listeners (default: 100)
   */
  setMaxListeners(max: number): void {
    if (max < 1) {
      throw new Error('Maximum listeners must be at least 1')
    }
    this.maxListeners = max
  }

  /**
   * Get statistics about the event bus
   *
   * @returns Event bus statistics
   */
  getStats(): {
    totalEvents: number
    totalListeners: number
    eventsWithListeners: number
    averageListenersPerEvent: number
    oldestListener?: Date
    newestListener?: Date
  } {
    const totalEvents = this.listeners.size
    let totalListeners = 0
    let oldestListener: Date | undefined
    let newestListener: Date | undefined

    for (const [event, listeners] of this.listeners) {
      totalListeners += listeners.length

      for (const listener of listeners) {
        if (!oldestListener || listener.createdAt < oldestListener) {
          oldestListener = listener.createdAt
        }
        if (!newestListener || listener.createdAt > newestListener) {
          newestListener = listener.createdAt
        }
      }
    }

    return {
      totalEvents,
      totalListeners,
      eventsWithListeners: totalEvents,
      averageListenersPerEvent: totalEvents > 0 ? totalListeners / totalEvents : 0,
      oldestListener,
      newestListener
    }
  }

  /**
   * Record an event in history
   *
   * @param event - Event name
   * @param data - Event data
   * @param listenerCount - Number of listeners notified
   */
  private recordEvent(event: string, data: any, listenerCount: number): void {
    this.eventHistory.push({
      event,
      data,
      timestamp: new Date(),
      listenerCount
    })

    // Limit event history size
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift()
    }
  }

  /**
   * Validate event bus state for debugging
   *
   * @returns Validation result
   */
  validate(): {
    isValid: boolean
    issues: string[]
    warnings: string[]
  } {
    const issues: string[] = []
    const warnings: string[] = []

    // Check for event name format
    for (const eventName of this.listeners.keys()) {
      if (!eventName || typeof eventName !== 'string') {
        issues.push(`Invalid event name: ${eventName}`)
      }
    }

    // Check for listeners with invalid handlers
    for (const [event, listeners] of this.listeners) {
      for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i]
        if (typeof listener.handler !== 'function') {
          issues.push(`Invalid handler for event "${event}" at index ${i}`)
        }
      }
    }

    // Check for potential memory leaks
    for (const [event, listeners] of this.listeners) {
      if (listeners.length > this.maxListeners * 0.8) {
        warnings.push(`Event "${event}" has ${listeners.length} listeners (near limit of ${this.maxListeners})`)
      }
    }

    // Check for very old listeners (potential memory leaks)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    for (const [event, listeners] of this.listeners) {
      for (const listener of listeners) {
        if (listener.createdAt < oneDayAgo) {
          warnings.push(`Event "${event}" has listener from ${listener.createdAt.toISOString()} (potential memory leak)`)
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    }
  }
}

// Create singleton instance
export const eventBus = new EventBus()

// Export type for dependency injection
export type EventBusService = EventBus

/**
 * Composable for using the event bus
 * Provides a Vue-friendly interface to the event bus
 */
export function useEventBus() {
  return {
    // Event methods
    on: eventBus.on.bind(eventBus),
    once: eventBus.once.bind(eventBus),
    emit: eventBus.emit.bind(eventBus),
    off: eventBus.off.bind(eventBus),
    removeListener: eventBus.removeListener.bind(eventBus),

    // Utility methods
    listenerCount: eventBus.listenerCount.bind(eventBus),
    eventNames: eventBus.eventNames.bind(eventBus),
    clear: eventBus.clear.bind(eventBus),
    getStats: eventBus.getStats.bind(eventBus),
    validate: eventBus.validate.bind(eventBus),
    getEventHistory: eventBus.getEventHistory.bind(eventBus)
  }
}