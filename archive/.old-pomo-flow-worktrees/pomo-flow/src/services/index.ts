/**
 * Services export index for the Pomo-Flow application
 *
 * This file provides a centralized export point for all service layer abstractions,
 * making imports cleaner and more organized throughout the application.
 *
 * @since 2.0.0
 * @author Pomo-Flow Development Team
 */

// Export all services
export * from './EventBus'
export * from './TaskService'
export * from './CanvasService'
export * from './PersistenceService'

// Export service instances for direct use
export { eventBus, type EventBusService } from './EventBus'
export { taskService, type TaskServiceInterface } from './TaskService'
export { canvasService, type CanvasServiceInterface } from './CanvasService'
export { persistenceService, type PersistenceServiceInterface } from './PersistenceService'

// Export service composables
export { useEventBus } from './EventBus'
export { useTaskService } from './TaskService'
export { useCanvasService } from './CanvasService'
export { usePersistenceService } from './PersistenceService'

/**
 * Simple service manager without circular dependencies
 * Services are accessed through direct imports, not properties
 */
export class ServiceManager {
  private static instance: ServiceManager

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager()
    }
    return ServiceManager.instance
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    // Services are auto-initialized in their constructors
    // This method can be used for additional setup if needed
    console.log('ServiceManager initialized')
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<{
    eventBus: any
    persistence: any
    servicesReady: boolean
  }> {
    const { eventBus } = await import('./EventBus')
    const { persistenceService } = await import('./PersistenceService')

    return {
      eventBus: eventBus.getStats(),
      persistence: persistenceService.getPerformanceStats(),
      servicesReady: true
    }
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    const { eventBus } = await import('./EventBus')
    eventBus.clear()
    console.log('ServiceManager shutdown complete')
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance()

/**
 * Composable for using services directly
 * Services are accessed through direct imports to avoid circular dependencies
 */
export function useServiceManager() {
  return {
    // Service access through direct imports
    getEventBus: () => import('./EventBus').then(m => m.eventBus),
    getTaskService: () => import('./TaskService').then(m => m.taskService),
    getCanvasService: () => import('./CanvasService').then(m => m.canvasService),
    getPersistenceService: () => import('./PersistenceService').then(m => m.persistenceService),

    // Manager operations
    initialize: serviceManager.initialize.bind(serviceManager),
    getServiceStats: serviceManager.getServiceStats.bind(serviceManager),
    shutdown: serviceManager.shutdown.bind(serviceManager)
  }
}