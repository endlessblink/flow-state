/**
 * STORE CONTEXT INTERFACE
 *
 * Provides dependency injection for services to access stores
 * without creating direct Pinia dependencies outside component context.
 * This eliminates the need for lazy-loading patterns in services.
 */

import type { Pinia } from 'pinia'
import { useServiceOrchestrator } from './ServiceOrchestrator'
import { useMigrationAdapter } from '@/utils/migration/migration-adapter'
import { useTaskStore } from '@/stores/tasks'
import { useFilterStore } from '@/stores/filters'
import { useCanvasStore } from '@/stores/canvas-focused'
import { useUndoRedo } from '@/stores/undo-redo'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'

export interface StoreContext {
  pinia: Pinia

  // Service Orchestrator and Migration Adapter
  serviceOrchestrator: ReturnType<typeof useServiceOrchestrator>
  taskStoreAdapter: ReturnType<ReturnType<typeof useMigrationAdapter>['getTaskStore']>

  // Store instances - these are actual store instances, not functions
  taskStore: ReturnType<typeof useTaskStore>
  filterStore: ReturnType<typeof useFilterStore>
  canvasStore: ReturnType<typeof useCanvasStore>
  undoRedoStore: ReturnType<typeof useUndoRedo>
  timerStore: ReturnType<typeof useTimerStore>
  uiStore: ReturnType<typeof useUIStore>
}

/**
 * Creates a store context from an active Pinia instance
 * This should be called within component context to ensure proper initialization
 */
export function createStoreContext(pinia: Pinia): StoreContext {
  // CRITICAL FIX: Avoid circular dependency by not creating ServiceOrchestrator here
  // Initialize Migration Adapter only
  const { getTaskStore } = useMigrationAdapter({
    componentId: 'StoreContext',
    enablePerformanceMonitoring: true,
    enableErrorTracking: true
  })
  const taskStoreAdapter = getTaskStore()

  return {
    pinia,

    // Service Orchestrator and Migration Adapter
    // Note: serviceOrchestrator will be injected later by ServiceOrchestrator itself
    serviceOrchestrator: null as any,
    taskStoreAdapter,

    // Store instances
    taskStore: useTaskStore(pinia),
    filterStore: useFilterStore(pinia),
    canvasStore: useCanvasStore(pinia),
    undoRedoStore: useUndoRedo(pinia),
    timerStore: useTimerStore(pinia),
    uiStore: useUIStore(pinia)
  }
}

/**
 * Validates that a store context is properly initialized
 */
export function validateStoreContext(context: StoreContext): boolean {
  return !!(
    context.pinia &&
    context.taskStoreAdapter &&
    context.taskStore &&
    context.filterStore &&
    context.canvasStore &&
    context.undoRedoStore &&
    context.timerStore &&
    context.uiStore
  )
}