/**
 * Dynamic Import Manager - Standardized Import System
 *
 * Fixes dynamic import conflicts by providing a centralized, caching system
 * for all composables and components that need lazy loading
 */

import { ref, reactive } from 'vue'

// Type definitions for dynamic imports
type DynamicImport<T = any> = () => Promise<T>
type ImportCache = Map<string, any>

// Global import cache to prevent duplicate loading
const importCache: ImportCache = new Map()

// Loading states for tracking imports
const loadingStates = reactive<Record<string, boolean>>({})

// Error states for tracking failed imports
const errorStates = reactive<Record<string, Error | null>>({})

/**
 * Import configuration for common composables
 */
export const IMPORT_CONFIG = {
  // Database-related imports
  useDatabase: {
    path: () => import('@/composables/useDatabase'),
    preload: true, // Critical for app startup
    timeout: 5000
  },

  // Undo/Redo system imports
  useUnifiedUndoRedo: {
    path: () => import('@/composables/useUnifiedUndoRedo'),
    preload: false, // Load on demand
    timeout: 3000
  },

  // Sync system imports (consolidated - ReliableSyncManager removed - file no longer exists)
  // useReliableSyncManager: {
  //   path: () => import('@/composables/useReliableSyncManager'),
  //   preload: true, // Critical for sync functionality
  //   timeout: 5000
  // },

  // UI component imports
  SyncStatusIndicator: {
    path: () => import('@/components/SyncStatusIndicator.vue'),
    preload: false, // Load on demand
    timeout: 3000
  },

  SyncErrorBoundary: {
    path: () => import('@/components/SyncErrorBoundary.vue'),
    preload: false, // Load on demand
    timeout: 3000
  },

  // Canvas-related imports
  CanvasView: {
    path: () => import('@/views/CanvasView.vue'),
    preload: false, // Load on demand
    timeout: 5000
  },

  // Store imports
  useTasksStore: {
    path: () => import('@/stores/tasks'),
    preload: false, // Load on demand
    timeout: 3000
  },

  useCanvasStore: {
    path: () => import('@/stores/canvas'),
    preload: false, // Load on demand
    timeout: 3000
  }
} as const

type ImportKey = keyof typeof IMPORT_CONFIG

/**
 * Dynamic import manager with caching and error handling
 */
export class DynamicImportManager {
  private cache: ImportCache = new Map()
  private loadingPromises: Map<string, Promise<any>> = new Map()

  /**
   * Import a module with caching, timeout, and error handling
   */
  async import<T = any>(key: ImportKey): Promise<T> {
    const config = IMPORT_CONFIG[key]

    if (!config) {
      throw new Error(`Import key "${key}" not found in IMPORT_CONFIG`)
    }

    // Return cached version if available
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    // Return existing promise if currently loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)
    }

    // Create and store loading promise
    const loadingPromise = this.performImport<T>(key, config)
    this.loadingPromises.set(key, loadingPromise)

    try {
      const result = await loadingPromise
      this.cache.set(key, result)
      errorStates[key] = null
      return result
    } catch (error) {
      errorStates[key] = error as Error
      throw error
    } finally {
      this.loadingPromises.delete(key)
    }
  }

  /**
   * Perform the actual import with timeout
   */
  private async performImport<T>(key: string, config: any): Promise<T> {
    loadingStates[key] = true

    try {
      const importPromise = config.path()

      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Import timeout for "${key}" after ${config.timeout}ms`))
        }, config.timeout)
      })

      const module = await Promise.race([importPromise, timeoutPromise])

      console.log(`✅ Successfully imported: ${key}`)
      return module.default || module

    } catch (error) {
      console.error(`❌ Failed to import: ${key}`, error)
      throw new Error(`Failed to import ${key}: ${(error as Error).message}`)
    } finally {
      loadingStates[key] = false
    }
  }

  /**
   * Preload critical imports
   */
  async preloadCritical(): Promise<void> {
    const criticalImports = Object.entries(IMPORT_CONFIG)
      .filter(([_, config]) => config.preload)
      .map(([key]) => key as ImportKey)

    console.log('🔄 Preloading critical imports...', criticalImports)

    await Promise.allSettled(
      criticalImports.map(key =>
        this.import(key).catch(error => {
          console.warn(`⚠️ Failed to preload ${key}:`, error.message)
          return null
        })
      )
    )

    console.log('✅ Critical imports preloaded')
  }

  /**
   * Check if an import is currently loading
   */
  isLoading(key: ImportKey): boolean {
    return loadingStates[key] || this.loadingPromises.has(key)
  }

  /**
   * Check if an import has failed
   */
  hasError(key: ImportKey): boolean {
    return errorStates[key] !== null
  }

  /**
   * Get the error for an import
   */
  getError(key: ImportKey): Error | null {
    return errorStates[key]
  }

  /**
   * Clear cache for a specific import or all imports
   */
  clearCache(key?: ImportKey): void {
    if (key) {
      this.cache.delete(key)
      errorStates[key] = null
    } else {
      this.cache.clear()
      Object.keys(errorStates).forEach(k => {
        errorStates[k] = null
      })
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cached: this.cache.size,
      loading: this.loadingPromises.size,
      errors: Object.values(errorStates).filter(e => e !== null).length,
      total: Object.keys(IMPORT_CONFIG).length
    }
  }
}

// Global instance
const dynamicImportManager = new DynamicImportManager()

/**
 * Composable for using dynamic imports
 */
export function useDynamicImports() {
  /**
   * Import a composable or component
   */
  const importModule = async <T = any>(key: ImportKey): Promise<T> => {
    return await dynamicImportManager.import<T>(key)
  }

  /**
   * Import multiple modules in parallel
   */
  const importModules = async <T = any>(keys: ImportKey[]): Promise<T[]> => {
    const promises = keys.map(key => dynamicImportManager.import<T>(key))
    return await Promise.all(promises)
  }

  /**
   * Import with fallback
   */
  const importWithFallback = async <T = any>(
    key: ImportKey,
    fallback: T | (() => T)
  ): Promise<T> => {
    try {
      return await dynamicImportManager.import<T>(key)
    } catch (error) {
      console.warn(`⚠️ Import failed for ${key}, using fallback:`, (error as any).message)
      return typeof fallback === 'function' ? (fallback as any)() : fallback
    }
  }

  /**
   * Check import status
   */
  const getStatus = (key: ImportKey) => ({
    loading: dynamicImportManager.isLoading(key),
    error: dynamicImportManager.hasError(key),
    errorDetail: dynamicImportManager.getError(key)
  })

  /**
   * Preload specific imports
   */
  const preload = async (keys: ImportKey[]): Promise<void> => {
    await Promise.allSettled(
      keys.map(key =>
        dynamicImportManager.import(key).catch(error => {
          console.warn(`⚠️ Failed to preload ${key}:`, error.message)
        })
      )
    )
  }

  return {
    import: importModule,
    importModules,
    importWithFallback,
    getStatus,
    preload,
    manager: dynamicImportManager
  }
}

/**
 * Convenience functions for common imports
 */

// Database composable with caching
export const getDatabaseComposable = async () => {
  const module = await dynamicImportManager.import('useDatabase')
  return module.useDatabase || module
}

// Undo/Redo composable with caching
export const getUndoRedoComposable = async () => {
  const module = await dynamicImportManager.import('useUnifiedUndoRedo')
  return module.useUnifiedUndoRedo || module
}

// Sync manager with caching (consolidated - ReliableSyncManager removed)
// export const getSyncManager = async () => {
//   const module = await dynamicImportManager.import('useReliableSyncManager')
//   return module.getGlobalReliableSyncManager || module
// }

// Store imports with caching
export const getTasksStore = async () => {
  const module = await dynamicImportManager.import('useTasksStore')
  return module.useTasksStore || module.default || module
}

export const getCanvasStore = async () => {
  const module = await dynamicImportManager.import('useCanvasStore')
  return module.useCanvasStore || module.default || module
}

// Vue component imports
export const getSyncStatusIndicator = async () => {
  const module = await dynamicImportManager.import('SyncStatusIndicator')
  return module.default || module.SyncStatusIndicator
}

export const getSyncErrorBoundary = async () => {
  const module = await dynamicImportManager.import('SyncErrorBoundary')
  return module.default || module.SyncErrorBoundary
}

/**
 * Initialize the dynamic import system
 * Call this early in app startup
 */
export const initializeDynamicImports = async (): Promise<void> => {
  console.log('🚀 Initializing dynamic import system...')

  // Preload critical imports
  await dynamicImportManager.preloadCritical()

  console.log('✅ Dynamic import system initialized')

  // Log statistics
  const stats = dynamicImportManager.getStats()
  console.log('📊 Import system stats:', stats)
}

// Export the ImportKey type for external use
export type { ImportKey }

export default useDynamicImports