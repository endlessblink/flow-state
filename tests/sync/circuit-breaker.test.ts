import { test, expect } from '@playwright/test'
import { SyncCircuitBreaker } from '@/utils/syncCircuitBreaker'

test.describe('SyncCircuitBreaker - Infinite Loop Prevention', () => {
  let circuitBreaker: SyncCircuitBreaker

  test.beforeEach(() => {
    circuitBreaker = new SyncCircuitBreaker({
      cooldownMs: 100, // Faster for testing
      maxConsecutiveErrors: 2,
      maxSyncDuration: 5000,
      enableMetrics: true
    })
  })

  test('prevents concurrent sync operations', async () => {
    const results: string[] = []

    const slowOperation = () => new Promise(resolve => {
      setTimeout(() => {
        results.push('operation-completed')
        resolve('success')
      }, 200)
    })

    // Start multiple operations concurrently
    const promises = [
      circuitBreaker.executeSync(slowOperation, 'test1').catch(e => results.push(`test1-error: ${e.message}`)),
      circuitBreaker.executeSync(slowOperation, 'test2').catch(e => results.push(`test2-error: ${e.message}`)),
      circuitBreaker.executeSync(slowOperation, 'test3').catch(e => results.push(`test3-error: ${e.message}`))
    ]

    await Promise.all(promises)

    // Only one should complete, others should be prevented
    expect(results).toContain('operation-completed')
    expect(results.some(r => r.includes('already in progress'))).toBeTruthy()
  })

  test('debounces rapid sync attempts', async () => {
    const results: string[] = []

    const operation = () => {
      results.push('operation-called')
      return Promise.resolve('success')
    }

    // Execute multiple operations rapidly
    await circuitBreaker.executeSync(operation, 'rapid1')
    await circuitBreaker.executeSync(operation, 'rapid2').catch(e => results.push(`rapid2-error: ${e.message}`))
    await circuitBreaker.executeSync(operation, 'rapid3').catch(e => results.push(`rapid3-error: ${e.message}`))

    // First should succeed, others should be debounced
    expect(results.filter(r => r === 'operation-called')).toHaveLength(1)
    expect(results.some(r => r.includes('debounced'))).toBeTruthy()
  })

  test('opens circuit after consecutive errors', async () => {
    const failingOperation = () => Promise.reject(new Error('Test error'))

    // Execute failing operations to trigger circuit opening
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.executeSync(failingOperation, `test${i}`)
      } catch (error) {
        // Expected to fail
      }
    }

    // Circuit should now be open
    expect(circuitBreaker.isHealthy()).toBeFalsy()

    // Next operation should be rejected
    await expect(
      circuitBreaker.executeSync(() => Promise.resolve('success'), 'after-circuit-open')
    ).rejects.toThrow('Circuit breaker open')
  })

  test('tracks metrics correctly', async () => {
    const successfulOperation = () => Promise.resolve('success')
    const failingOperation = () => Promise.reject(new Error('Test error'))

    // Execute successful operation
    await circuitBreaker.executeSync(successfulOperation, 'success')

    // Execute failing operation
    try {
      await circuitBreaker.executeSync(failingOperation, 'failure')
    } catch (error) {
      // Expected to fail
    }

    const metrics = circuitBreaker.getMetrics()

    expect(metrics.attempts).toBeGreaterThan(0)
    expect(metrics.successes).toBe(1)
    expect(metrics.consecutiveErrors).toBe(1)
    expect(metrics.averageDuration).toBeGreaterThanOrEqual(0)
  })

  test('can be reset after circuit opens', async () => {
    // Trigger circuit opening
    const failingOperation = () => Promise.reject(new Error('Test error'))

    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.executeSync(failingOperation, `test${i}`)
      } catch (error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.isHealthy()).toBeFalsy()

    // Reset circuit breaker
    circuitBreaker.reset()

    expect(circuitBreaker.isHealthy()).toBeTruthy()
    expect(circuitBreaker.canSync()).toBeTruthy()

    // Should be able to execute operations again
    const result = await circuitBreaker.executeSync(() => Promise.resolve('recovered'), 'recovery')
    expect(result).toBe('recovered')
  })
})

test.describe('Change Detection Guard', () => {
  test('prevents unnecessary updates', async () => {
    const { createChangeDetectionGuard } = await import('@/utils/syncCircuitBreaker')
    const guard = createChangeDetectionGuard()

    const testData1 = { id: 1, name: 'test', timestamp: Date.now() }
    const testData2 = { id: 1, name: 'test', timestamp: Date.now() } // Same data

    // First call should return true
    expect(guard.shouldUpdate(testData1)).toBeTruthy()

    // Second call with same data should return false
    expect(guard.shouldUpdate(testData2)).toBeFalsy()

    // Third call with different data should return true
    const testData3 = { id: 1, name: 'test-updated', timestamp: Date.now() }
    expect(guard.shouldUpdate(testData3)).toBeTruthy()
  })

  test('freezes data to prevent reactivity issues', async () => {
    const { createChangeDetectionGuard } = await import('@/utils/syncCircuitBreaker')
    const guard = createChangeDetectionGuard()

    const mutableData = { id: 1, items: ['a', 'b'] }
    const frozenData = guard.freezeData(mutableData)

    // Frozen data should be immutable
    expect(() => {
      (frozenData as any).items = ['c', 'd']
    }).toThrow()

    // Original data should remain mutable
    mutableData.items = ['c', 'd']
    expect(mutableData.items).toEqual(['c', 'd'])
  })
})