<template>
  <div class="async-loader" :class="loaderClasses">
    <!-- Loading State -->
    <div v-if="status.loading" class="loading-state">
      <div v-if="showSpinner" class="loading-spinner">
        <svg
          class="animate-spin h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <div class="loading-content">
        <h4 v-if="title" class="loading-title">
          {{ title }}
        </h4>
        <p v-if="message" class="loading-message">
          {{ message }}
        </p>
        <div v-if="showProgress" class="loading-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <span v-if="showPercentage" class="progress-text">{{ progress }}%</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="status.error && showError" class="error-state">
      <div class="error-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="error-content">
        <h4 v-if="errorTitle" class="error-title">
          {{ errorTitle }}
        </h4>
        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>
        <div class="error-actions">
          <button
            v-if="showRetry"
            class="btn btn-primary btn-sm"
            :disabled="status.loading"
            @click="retry"
          >
            <span v-if="status.loading" class="flex items-center gap-2">
              <svg
                class="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Retrying...
            </span>
            <span v-else>Retry</span>
          </button>
          <button v-if="showFallback" class="btn btn-secondary btn-sm" @click="useFallback">
            Use Fallback
          </button>
        </div>
      </div>
    </div>

    <!-- Loaded Content -->
    <div v-else-if="component" class="loaded-content">
      <component :is="component" v-bind="componentProps" />
    </div>

    <!-- Fallback Content -->
    <div v-else-if="showFallbackContent && fallbackComponent" class="fallback-content">
      <component :is="fallbackComponent" v-bind="fallbackProps" />
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p v-if="emptyMessage">
        {{ emptyMessage }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue'
import { useDynamicImports } from '@/composables/useDynamicImports'
import type { ImportKey } from '@/composables/useDynamicImports'

interface Props {
  // Required
  importKey: ImportKey
  loader: () => Promise<any>

  // Loading customization
  title?: string
  message?: string
  showSpinner?: boolean
  showProgress?: boolean
  showPercentage?: boolean
  progress?: number

  // Error handling
  showError?: boolean
  errorTitle?: string
  errorMessage?: string
  showRetry?: boolean
  maxRetries?: number
  retryDelay?: number

  // Fallback options
  showFallback?: boolean
  showFallbackContent?: boolean
  fallbackComponent?: any
  fallbackProps?: Record<string, any>
  fallbackMessage?: string

  // Empty state
  emptyMessage?: string

  // Component props
  componentProps?: Record<string, any>

  // Styling
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal' | 'overlay'
}

const props = withDefaults(defineProps<Props>(), {
  showSpinner: true,
  showProgress: false,
  showPercentage: true,
  showError: true,
  showRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  showFallback: false,
  showFallbackContent: true,
  size: 'md',
  variant: 'default'
})

const emit = defineEmits<{
  loaded: [component: any]
  error: [error: Error]
  retry: [attempt: number]
  fallback: []
}>()

// Dynamic imports composable
const { import: dynamicImport, getStatus } = useDynamicImports()

// Reactive state
const component = ref<any>(null)
const retryCount = ref(0)
const isLoading = ref(false)

// Computed status
const status = computed(() => {
  if (isLoading.value) return { loading: true, error: null }
  const importStatus = getStatus(props.importKey)
  return {
    loading: importStatus.loading,
    error: importStatus.error ? importStatus.errorDetail : null
  }
})

// Computed classes
const loaderClasses = computed(() => ({
  'async-loader--sm': props.size === 'sm',
  'async-loader--md': props.size === 'md',
  'async-loader--lg': props.size === 'lg',
  'async-loader--minimal': props.variant === 'minimal',
  'async-loader--overlay': props.variant === 'overlay',
  'async-loader--loading': status.value.loading,
  'async-loader--error': status.value.error,
  'async-loader--loaded': !!component.value
}))

// Methods
const loadComponent = async () => {
  try {
    isLoading.value = true

    // Clear previous errors
    if (status.value.error) {
      const { manager } = useDynamicImports()
      manager.clearCache(props.importKey)
    }

    // Load the component
    const module = await props.loader()
    component.value = module.default || module

    emit('loaded', component.value)
    retryCount.value = 0

  } catch (error) {
    console.error(`Failed to load component for ${props.importKey}:`, error)
    emit('error', error as Error)

    // Auto-retry if configured
    if (props.maxRetries > 0 && retryCount.value < props.maxRetries) {
      setTimeout(retry, props.retryDelay)
    }
  } finally {
    isLoading.value = false
  }
}

const retry = async () => {
  if (status.value.loading) return

  retryCount.value++
  emit('retry', retryCount.value)

  if (retryCount.value <= props.maxRetries) {
    await loadComponent()
  } else {
    console.warn(`Max retries (${props.maxRetries}) exceeded for ${props.importKey}`)
  }
}

const useFallback = () => {
  emit('fallback')
}

// Watch for changes and auto-load
watch(() => props.importKey, () => {
  if (props.importKey && !component.value) {
    loadComponent()
  }
}, { immediate: true })

// Initialize on mount
onMounted(() => {
  if (props.importKey && !component.value && !status.value.loading) {
    loadComponent()
  }
})
</script>

<style scoped>
.async-loader {
  @apply relative;
}

.async-loader--sm {
  @apply p-2;
}

.async-loader--md {
  @apply p-4;
}

.async-loader--lg {
  @apply p-6;
}

.async-loader--minimal {
  @apply p-1;
}

.async-loader--overlay {
  @apply fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50;
}

.loading-state {
  @apply flex flex-col items-center justify-center space-y-3;
}

.loading-spinner {
  @apply text-blue-500;
}

.loading-content {
  @apply text-center;
}

.loading-title {
  @apply text-lg font-medium text-gray-900 dark:text-gray-100;
}

.loading-message {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.loading-progress {
  @apply w-full max-w-xs;
}

.progress-bar {
  @apply w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2;
}

.progress-fill {
  @apply bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out;
}

.progress-text {
  @apply text-xs text-gray-500 dark:text-gray-400 mt-1;
}

.error-state {
  @apply flex flex-col items-center justify-center space-y-3 text-center;
}

.error-icon {
  @apply text-red-500;
}

.error-content {
  @apply max-w-md;
}

.error-title {
  @apply text-lg font-medium text-red-900 dark:text-red-100;
}

.error-message {
  @apply text-sm text-red-700 dark:text-red-300 mb-4;
}

.error-actions {
  @apply flex gap-2 justify-center;
}

.btn {
  @apply px-4 py-2 rounded font-medium transition-colors duration-200;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white;
}

.btn-secondary {
  @apply bg-gray-600 hover:bg-gray-700 text-white;
}

.btn-sm {
  @apply px-3 py-1 text-sm;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.loaded-content {
  @apply contents;
}

.fallback-content {
  @apply contents;
}

.empty-state {
  @apply flex items-center justify-center p-8 text-gray-500 dark:text-gray-400;
}

/* Animation utilities */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .loading-spinner {
    @apply text-blue-400;
  }

  .error-title {
    @apply text-red-100;
  }

  .error-message {
    @apply text-red-300;
  }
}
</style>