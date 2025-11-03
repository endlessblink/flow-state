<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <AlertTriangle :size="24" />
      </div>
      <div class="error-details">
        <h3 class="error-title">{{ errorTitle }}</h3>
        <p class="error-message">{{ errorMessage }}</p>
        <div class="error-actions">
          <BaseButton
            variant="primary"
            size="sm"
            @click="retry"
            :disabled="isRetrying"
          >
            <RefreshCw :size="16" :class="{ 'animate-spin': isRetrying }" />
            {{ isRetrying ? 'Retrying...' : 'Try Again' }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            size="sm"
            @click="reportError"
            v-if="showReportButton"
          >
            <Bug :size="16" />
            Report Issue
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="sm"
            @click="dismiss"
          >
            Dismiss
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Developer error details (development only) -->
    <details v-if="isDevelopment && errorDetails" class="error-technical">
      <summary>Technical Details</summary>
      <pre class="error-stack">{{ errorDetails }}</pre>
    </details>
  </div>

  <!-- Normal content when no error -->
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured, type PropType } from 'vue'
import { AlertTriangle, RefreshCw, Bug } from 'lucide-vue-next'
import { BaseButton } from '@/components/base'
import { useErrorHandler, ErrorSeverity, ErrorType } from '@/utils/errorHandling'

interface ErrorBoundaryProps {
  fallbackTitle?: string
  fallbackMessage?: string
  showReportButton?: boolean
  maxRetries?: number
  onError?: (error: unknown, errorInfo: any) => void
  onRetry?: () => Promise<void> | void
  onDismiss?: () => void
}

const props = withDefaults(defineProps<ErrorBoundaryProps>(), {
  fallbackTitle: '',
  fallbackMessage: '',
  showReportButton: true,
  maxRetries: 3
})

const emit = defineEmits<{
  error: [error: unknown, errorInfo: any]
  retry: []
  dismiss: []
}>()

const { handleError, getUserMessage, classifyError } = useErrorHandler()

// Error state
const hasError = ref(false)
const error = ref<unknown>(null)
const errorInfo = ref<any>(null)
const retryCount = ref(0)
const isRetrying = ref(false)

// Computed properties
const isDevelopment = computed(() => import.meta.env.DEV)

const errorTitle = computed(() => {
  if (props.fallbackTitle) return props.fallbackTitle

  if (!error.value) return 'Something went wrong'

  const { type } = classifyError(error.value)

  switch (type) {
    case ErrorType.NETWORK:
      return 'Connection Problem'
    case ErrorType.AUTHENTICATION:
      return 'Authentication Required'
    case ErrorType.DATABASE:
      return 'Data Storage Issue'
    case ErrorType.FILE_OPERATION:
      return 'File Operation Failed'
    case ErrorType.VALIDATION:
      return 'Invalid Input'
    default:
      return 'Unexpected Error'
  }
})

const errorMessage = computed(() => {
  if (props.fallbackMessage) return props.fallbackMessage

  if (!error.value) return 'An unexpected error occurred.'

  return getUserMessage(error.value)
})

const errorDetails = computed(() => {
  if (!error.value) return null

  if (error.value instanceof Error) {
    return `${error.value.name}: ${error.value.message}\n\n${error.value.stack}`
  }

  return String(error.value)
})

const canRetry = computed(() => {
  if (!error.value || isRetrying.value) return false
  if (retryCount.value >= props.maxRetries) return false

  const { retryable } = classifyError(error.value)
  return retryable
})

// Methods
const retry = async () => {
  if (!canRetry.value) return

  isRetrying.value = true
  retryCount.value++

  try {
    await props.onRetry?.()
    emit('retry')

    // Reset error state on successful retry
    hasError.value = false
    error.value = null
    errorInfo.value = null
    retryCount.value = 0
  } catch (retryError) {
    console.error('Retry failed:', retryError)
    error.value = retryError
  } finally {
    isRetrying.value = false
  }
}

const reportError = () => {
  if (!error.value) return

  // Create error report data
  const reportData = {
    error: error.value instanceof Error ? {
      name: error.value.name,
      message: error.value.message,
      stack: error.value.stack
    } : error.value,
    errorInfo: errorInfo.value,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    retryCount: retryCount.value
  }

  // Log error with context
  handleError(error.value, 'error_boundary_report')

  // In development, show technical details
  if (isDevelopment.value) {
    console.group('📋 Error Report Data')
    console.info('Report Data:', reportData)
    console.groupEnd()
  }

  // TODO: Send to error reporting service
  // await sendErrorReport(reportData)

  // Show user feedback
  alert('Error report has been logged. Thank you for helping improve the application.')
}

const dismiss = () => {
  hasError.value = false
  error.value = null
  errorInfo.value = null
  retryCount.value = 0

  props.onDismiss?.()
  emit('dismiss')
}

const captureError = (err: unknown, info: any) => {
  hasError.value = true
  error.value = err
  errorInfo.value = info
  retryCount.value = 0

  // Log the error
  handleError(err, 'vue_component_error_boundary')

  // Notify parent components
  emit('error', err, info)

  // Call custom error handler
  props.onError?.(err, info)

  // Prevent error from propagating
  return false
}

// Set up error capturing
onErrorCaptured(captureError)
</script>

<style scoped>
.error-boundary {
  @apply flex flex-col items-center justify-center p-6 min-h-[200px];
  @apply bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg;
  @apply text-red-900 dark:text-red-100;
}

.error-content {
  @apply flex flex-col items-center text-center max-w-md;
}

.error-icon {
  @apply mb-4 p-3 bg-red-100 dark:bg-red-800/50 rounded-full;
  @apply text-red-600 dark:text-red-400;
}

.error-title {
  @apply text-lg font-semibold mb-2;
}

.error-message {
  @apply text-sm mb-6 opacity-90;
}

.error-actions {
  @apply flex flex-wrap gap-2 justify-center;
}

.error-technical {
  @apply mt-4 w-full max-w-2xl;
  @apply border-t border-red-200 dark:border-red-800 pt-4;
}

.error-technical summary {
  @apply cursor-pointer text-sm font-medium mb-2;
  @apply hover:text-red-700 dark:hover:text-red-300;
}

.error-stack {
  @apply text-xs bg-red-100 dark:bg-red-900/50 p-3 rounded;
  @apply text-red-800 dark:text-red-200 overflow-x-auto;
  @apply font-mono whitespace-pre-wrap break-all;
}

/* Animations */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .error-boundary {
    @apply bg-red-900/20 border-red-800 text-red-100;
  }
}
</style>