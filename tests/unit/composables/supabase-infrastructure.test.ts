import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

const reportMock = vi.fn()

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn()
    }
  }
}))

vi.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    report: reportMock
  },
  ErrorSeverity: {
    WARNING: 'WARNING',
    ERROR: 'ERROR'
  },
  ErrorCategory: {
    SYNC: 'SYNC'
  }
}))

describe('Supabase database infrastructure', () => {
  beforeEach(() => {
    reportMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries generic Supabase fetch failures for active timer polling', async () => {
    vi.useFakeTimers()
    const { createDatabaseHelpers } = await import('@/composables/supabase/_infrastructure')
    const { withRetry } = createDatabaseHelpers(ref(null))
    const operation = vi.fn()
      .mockRejectedValueOnce({ message: 'An unexpected error occurred', status: 0 })
      .mockRejectedValueOnce({ message: 'An unexpected error occurred', status: 0 })
      .mockResolvedValueOnce('recovered')

    const resultPromise = withRetry(operation, 'fetchActiveTimerSession')
    await vi.runAllTimersAsync()

    await expect(resultPromise).resolves.toBe('recovered')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('does not surface generic active timer fetch failures in user-facing sync state', async () => {
    const lastSyncError = ref<string | null>(null)
    const { createDatabaseHelpers } = await import('@/composables/supabase/_infrastructure')
    const { handleError } = createDatabaseHelpers(lastSyncError)

    handleError({ message: 'An unexpected error occurred', status: 0 }, 'fetchActiveTimerSession')

    expect(reportMock).not.toHaveBeenCalled()
    expect(lastSyncError.value).toBeNull()
  })

  it('suppresses punctuated generic active timer fetch failures from Electron', async () => {
    const lastSyncError = ref<string | null>(null)
    const { createDatabaseHelpers } = await import('@/composables/supabase/_infrastructure')
    const { handleError } = createDatabaseHelpers(lastSyncError)

    handleError({ message: 'An unexpected error occurred.', code: 'unexpected_failure' }, 'fetchActiveTimerSession')

    expect(reportMock).not.toHaveBeenCalled()
    expect(lastSyncError.value).toBeNull()
  })

  it('suppresses generic fetchTasks failures in user-facing sync state', async () => {
    const lastSyncError = ref<string | null>(null)
    const { createDatabaseHelpers } = await import('@/composables/supabase/_infrastructure')
    const { handleError } = createDatabaseHelpers(lastSyncError)

    handleError({ message: 'An unexpected error occurred' }, 'fetchTasks')

    expect(reportMock).not.toHaveBeenCalled()
    expect(lastSyncError.value).toBeNull()
  })

  it('still surfaces generic mutation failures', async () => {
    const lastSyncError = ref<string | null>(null)
    const { createDatabaseHelpers } = await import('@/composables/supabase/_infrastructure')
    const { handleError } = createDatabaseHelpers(lastSyncError)

    handleError({ message: 'An unexpected error occurred' }, 'saveTask')

    expect(reportMock).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Sync Error(saveTask): An unexpected error occurred',
      severity: 'ERROR',
      showNotification: true
    }))
    expect(lastSyncError.value).toBe('An unexpected error occurred')
  })
})
