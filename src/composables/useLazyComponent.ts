/**
 * Lazy Loading Component Utilities
 * Provides utilities for lazy loading heavy components with loading states
 */

import { defineAsyncComponent, type AsyncComponentLoader } from 'vue'
import type { Component } from 'vue'

export interface LazyComponentOptions {
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
  timeout?: number
  suspensible?: boolean
  onError?: (error: Error) => void
}

/**
 * Default loading component for lazy loaded components
 */
export const DefaultLoadingComponent = {
  template: `
    <div class="flex items-center justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span class="ml-2 text-gray-600">Loading...</span>
    </div>
  `
}

/**
 * Default error component for lazy loaded components
 */
export const DefaultErrorComponent = {
  template: `
    <div class="flex items-center justify-center p-8 text-red-600">
      <div class="text-center">
        <div class="text-xl mb-2">⚠️ Failed to load component</div>
        <div class="text-sm opacity-75">Please try refreshing the page</div>
      </div>
    </div>
  `
}

/**
 * Creates a lazy loaded component with loading and error states
 */
export function createLazyComponent(
  loader: AsyncComponentLoader,
  options: LazyComponentOptions = {}
) {
  const {
    loadingComponent = DefaultLoadingComponent,
    errorComponent = DefaultErrorComponent,
    delay = 200,
    timeout = 30000,
    suspensible = false,
    onError
  } = options

  return defineAsyncComponent({
    loader,
    loadingComponent,
    errorComponent,
    delay,
    timeout,
    suspensible,
    onError: (error) => {
      console.error('Lazy component loading failed:', error)
      onError?.(error)
    }
  })
}

/**
 * Lazy loading wrapper for heavy modal components
 */
export function createLazyModal(loader: AsyncComponentLoader) {
  return createLazyComponent(loader, {
    delay: 100, // Faster loading for modals
    timeout: 15000, // Shorter timeout for modals
    suspensible: true
  })
}

/**
 * Lazy loading wrapper for dashboard/chart components
 */
export function createLazyDashboard(loader: AsyncComponentLoader) {
  return createLazyComponent(loader, {
    delay: 500, // Slightly longer delay for dashboard components
    timeout: 45000, // Longer timeout for heavy dashboard components
    loadingComponent: {
      template: `
        <div class="flex items-center justify-center p-12">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <div class="text-gray-600">Loading dashboard...</div>
            <div class="text-sm text-gray-500 mt-2">This may take a moment</div>
          </div>
        </div>
      `
    }
  })
}

/**
 * Creates a lazy loaded component with retry functionality
 */
export function createRetryableLazyComponent(
  loader: AsyncComponentLoader,
  maxRetries = 3,
  options: LazyComponentOptions = {}
) {
  let retryCount = 0

  const retryableLoader: AsyncComponentLoader = () => {
    return loader().catch((error) => {
      if (retryCount < maxRetries) {
        retryCount++
        console.warn(`Lazy component failed to load, retrying (${retryCount}/${maxRetries}):`, error)
        // Add exponential backoff
        const delay = Math.pow(2, retryCount) * 1000
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(retryableLoader())
          }, delay)
        })
      }
      throw error
    })
  }

  return createLazyComponent(retryableLoader, {
    ...options,
    errorComponent: {
      ...DefaultErrorComponent,
      props: ['canRetry'],
      emits: ['retry'],
      template: `
        <div class="flex items-center justify-center p-8 text-red-600">
          <div class="text-center">
            <div class="text-xl mb-2">⚠️ Failed to load component</div>
            <div class="text-sm opacity-75 mb-4">Please try refreshing the page</div>
            <button
              v-if="canRetry && retryCount < 3"
              @click="$emit('retry')"
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry ({{ retryCount }}/3)
            </button>
          </div>
        </div>
      `,
      setup() {
        return { retryCount }
      }
    }
  })
}

/**
 * Preloads a component without rendering it
 */
export function preloadComponent(loader: AsyncComponentLoader): Promise<void> {
  return loader().catch((error) => {
    console.warn('Component preloading failed:', error)
    // Don't throw the error, just log it
  })
}

/**
 * Creates a component that preloads on hover
 */
export function createHoverPreloadComponent(
  loader: AsyncComponentLoader,
  options: LazyComponentOptions = {}
) {
  let preloadStarted = false

  const startPreload = () => {
    if (!preloadStarted) {
      preloadStarted = true
      preloadComponent(loader)
    }
  }

  return defineAsyncComponent({
    loader: () => loader(),
    loadingComponent: {
      ...options.loadingComponent || DefaultLoadingComponent,
      mounted() {
        // Start preload when component is mounted
        startPreload()
      }
    },
    errorComponent: options.errorComponent || DefaultErrorComponent,
    delay: options.delay || 200,
    timeout: options.timeout || 30000,
    suspensible: options.suspensible || false
  })
}

// Predefined lazy loaders for commonly used heavy components
export const LazyComponents = {
  TaskEditModal: () => createLazyModal(() => import('@/components/TaskEditModal.vue')),
  UnifiedInboxPanel: () => createLazyComponent(() => import('@/components/base/UnifiedInboxPanel.vue')),
  ForensicVerificationDashboard: () => createLazyDashboard(() => import('@/components/ForensicVerificationDashboard.vue')),
  MultiSelectToggle: () => createLazyComponent(() => import('@/components/MultiSelectToggle.vue')),
  HierarchicalTaskRow: () => createLazyComponent(() => import('@/components/HierarchicalTaskRow.vue')),
  PerformanceTest: () => createLazyDashboard(() => import('@/components/PerformanceTest.vue')),
  KanbanTaskCard: () => createLazyComponent(() => import('@/components/kanban/TaskCard.vue')),
  KanbanSwimlane: () => createLazyComponent(() => import('@/components/kanban/KanbanSwimlane.vue')),
  SettingsModal: () => createLazyModal(() => import('@/components/SettingsModal.vue')),
  ProjectModal: () => createLazyModal(() => import('@/components/ProjectModal.vue')),
  GroupModal: () => createLazyModal(() => import('@/components/GroupModal.vue')),
  BatchEditModal: () => createLazyModal(() => import('@/components/BatchEditModal.vue')),
  SyncSettings: () => createLazyModal(() => import('@/components/CloudSyncSettings.vue')),
  BackupSettings: () => createLazyModal(() => import('@/components/BackupSettings.vue')),
  TaskContextMenu: () => createLazyComponent(() => import('@/components/TaskContextMenu.vue')),
  SearchModal: () => createLazyModal(() => import('@/components/SearchModal.vue')),
  CommandPalette: () => createLazyModal(() => import('@/components/CommandPalette.vue'))
} as const

// Type definitions for better TypeScript support
export type LazyComponentName = keyof typeof LazyComponents