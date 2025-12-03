/**
 * Lazy Loading Component Utilities
 * Provides utilities for lazy loading heavy components with loading states
 */

import { defineAsyncComponent, h, type AsyncComponentLoader } from 'vue'
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
 * Uses render function instead of template to avoid runtime compiler requirement
 */
export const DefaultLoadingComponent = {
  render() {
    return h('div', { class: 'flex items-center justify-center p-8' }, [
      h('div', { class: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500' }),
      h('span', { class: 'ml-2 text-gray-600' }, 'Loading...')
    ])
  }
}

/**
 * Default error component for lazy loaded components
 * Uses render function instead of template to avoid runtime compiler requirement
 */
export const DefaultErrorComponent = {
  render() {
    return h('div', { class: 'flex items-center justify-center p-8 text-red-600' }, [
      h('div', { class: 'text-center' }, [
        h('div', { class: 'text-xl mb-2' }, '⚠️ Failed to load component'),
        h('div', { class: 'text-sm opacity-75' }, 'Please try refreshing the page')
      ])
    ])
  }
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
 * Uses render function instead of template to avoid runtime compiler requirement
 */
export function createLazyDashboard(loader: AsyncComponentLoader) {
  return createLazyComponent(loader, {
    delay: 500, // Slightly longer delay for dashboard components
    timeout: 45000, // Longer timeout for heavy dashboard components
    loadingComponent: {
      render() {
        return h('div', { class: 'flex items-center justify-center p-12' }, [
          h('div', { class: 'text-center' }, [
            h('div', { class: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4' }),
            h('div', { class: 'text-gray-600' }, 'Loading dashboard...'),
            h('div', { class: 'text-sm text-gray-500 mt-2' }, 'This may take a moment')
          ])
        ])
      }
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
    // Use simplified error component with render function to avoid runtime compiler requirement
    errorComponent: {
      render() {
        return h('div', { class: 'flex items-center justify-center p-8 text-red-600' }, [
          h('div', { class: 'text-center' }, [
            h('div', { class: 'text-xl mb-2' }, '⚠️ Failed to load component'),
            h('div', { class: 'text-sm opacity-75 mb-4' }, 'Please try refreshing the page'),
            h('div', { class: 'text-xs text-gray-500' }, `Retried ${retryCount}/${maxRetries} times`)
          ])
        ])
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