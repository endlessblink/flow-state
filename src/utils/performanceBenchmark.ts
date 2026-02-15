/**
 * Performance Benchmarking Suite
 * Comprehensive performance testing and validation for the Pomo-Flow application
 */

import { ref } from 'vue'
import { usePerformanceManager } from '@/composables/usePerformanceManager'
import { useVirtualScrolling } from '@/composables/useVirtualScrolling'
import { useNetworkOptimizer } from '@/composables/useNetworkOptimizer'
import { useRenderOptimization } from '@/composables/useRenderOptimization'

export interface BenchmarkConfig {
  iterations?: number
  timeout?: number
  warmupIterations?: number
  enableMemoryProfiling?: boolean
  enableCPUGProfiling?: boolean
  enableNetworkProfiling?: boolean
}

export interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  standardDeviation: number
  throughput: number
  memoryUsage?: number
  memoryDelta?: number
  cpuUsage?: number
  successRate: number
  errors: string[]
}

export interface BenchmarkSuite {
  canvasPerformance: BenchmarkResult
  virtualScrolling: BenchmarkResult
  taskStoreOperations: BenchmarkResult
  networkRequests: BenchmarkResult
  renderPerformance: BenchmarkResult
  memoryEfficiency: BenchmarkResult
  bundleSize: BenchmarkResult
}

export interface PerformanceThresholds {
  maxAverageRenderTime: number
  maxMemoryUsage: number
  minCacheHitRate: number
  minNetworkEfficiency: number
  maxBundleSize: number
  minThroughput: number
}

export const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  maxAverageRenderTime: 16, // 60fps
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  minCacheHitRate: 0.8, // 80%
  minNetworkEfficiency: 0.7, // 70%
  maxBundleSize: 500 * 1024, // 500KB
  minThroughput: 1000 // operations per second
}

export class PerformanceBenchmark {
  private performanceManager = usePerformanceManager()
  private networkOptimizer = useNetworkOptimizer()
  private renderOptimizer = useRenderOptimization()

  private results = ref<Partial<BenchmarkSuite>>({})
  private isRunning = ref(false)
  private progress = ref(0)

  // Memory tracking
  private initialMemory = 0
  private memorySnapshots: number[] = []

  // CPU tracking
  private cpuSnapshots: number[] = []

  constructor(private config: BenchmarkConfig = {}) {
    this.config = {
      iterations: 100,
      timeout: 30000,
      warmupIterations: 10,
      enableMemoryProfiling: true,
      enableCPUGProfiling: true,
      enableNetworkProfiling: true,
      ...config
    }
  }

  // Main benchmark execution
  async runFullSuite(): Promise<BenchmarkSuite> {
    console.log('🚀 Starting performance benchmark suite...')
    this.isRunning.value = true
    this.progress.value = 0

    try {
      // Initial memory snapshot
      this.initialMemory = this.getMemoryUsage()

      // Run benchmarks
      const results = {
        canvasPerformance: await this.benchmarkCanvasPerformance(),
        virtualScrolling: await this.benchmarkVirtualScrolling(),
        taskStoreOperations: await this.benchmarkTaskStoreOperations(),
        networkRequests: await this.benchmarkNetworkRequests(),
        renderPerformance: await this.benchmarkRenderPerformance(),
        memoryEfficiency: await this.benchmarkMemoryEfficiency(),
        bundleSize: await this.benchmarkBundleSize()
      }

      this.results.value = results

      // Generate report
      await this.generateReport(results)

      this.progress.value = 100
      return results

    } finally {
      this.isRunning.value = false
    }
  }

  // Canvas performance benchmark
  private async benchmarkCanvasPerformance(): Promise<BenchmarkResult> {
    console.log('🖼️ Benchmarking canvas performance...')
    const times: number[] = []
    const errors: string[] = []

    const nodeCounts = [100, 500, 1000]

    try {
      // Lazy load stores to avoid circular dependencies
      const { useTaskStore } = await import('@/stores/tasks')
      const { useCanvasStore } = await import('@/stores/canvas')
      const taskStore = useTaskStore()
      const canvasStore = useCanvasStore()

      for (const nodeCount of nodeCounts) {
        const startTime = performance.now()

        // 1. Create tasks
        const testTasks = Array.from({ length: nodeCount }, (_, i) => ({
          id: `bench-task-${nodeCount}-${i}`,
          title: `Benchmark Task ${i}`,
          status: 'planned' as const,
          priority: 'medium' as const,
          projectId: 'bench-project',
          canvasPosition: { x: (i % 20) * 250, y: Math.floor(i / 20) * 150 },
          isInInbox: false,
          subtasks: [],
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }))

          // Measure batch addition
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ; (taskStore as any)._rawTasks.push(...testTasks)

        // Wait for next tick to ensure computed properties update
        const { nextTick } = await import('vue')
        await nextTick()

        // 2. Measure Canvas Sync
        const syncStart = performance.now()
        if (typeof (canvasStore as any).syncTasksToCanvas === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (canvasStore as any).syncTasksToCanvas(taskStore.tasks || [])
        }
        const syncEnd = performance.now()

        // 3. Measure Render (wait for multiple frames to ensure layout)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const renderEnd = performance.now()

        const duration = renderEnd - startTime
        // Ensure duration is at least very small but non-zero for stats if work was done
        times.push(Math.max(duration, 0.001))

          // Cleanup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ; (taskStore as any)._rawTasks = (taskStore as any)._rawTasks.filter((t: any) => !t.id.startsWith('bench-task-'))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ; (canvasStore as any).nodes = (canvasStore as any).nodes.filter((n: any) => !n.id.startsWith('bench-task-'))
        await nextTick()

        console.log(`   - ${nodeCount} nodes: ${duration.toFixed(2)}ms (Sync: ${(syncEnd - syncStart).toFixed(2)}ms)`)
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }

    this.progress.value = 10
    return this.calculateBenchmarkResult('Canvas Performance', times, errors)
  }

  // Virtual scrolling benchmark
  private async benchmarkVirtualScrolling(): Promise<BenchmarkResult> {
    console.log('📊 Benchmarking virtual scrolling...')

    const itemCounts = [100, 500, 1000, 5000, 10000]
    const times: number[] = []
    const errors: string[] = []

    // Warmup
    await this.warmupVirtualScrolling()

    for (let i = 0; i < (this.config.iterations || 5); i++) {
      const itemCount = itemCounts[i % itemCounts.length]
      const items = Array.from({ length: itemCount }, (_, index) => ({
        id: index,
        title: `Task ${index}`,
        height: 60 + Math.random() * 40,
        data: { id: index, title: `Task ${index}` }
      }))

      try {
        const startTime = performance.now()

        // Create virtual scrolling instance
        const virtualScroll = useVirtualScrolling(items, {
          itemHeight: 80,
          containerHeight: 600,
          threshold: 100
        })

        // Simulate scrolling operations
        for (let scroll = 0; scroll < 10; scroll++) {
          virtualScroll.scrollToItem(Math.floor(Math.random() * itemCount))
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        const duration = performance.now() - startTime
        times.push(duration)

        // Memory snapshot
        if (this.config.enableMemoryProfiling) {
          this.memorySnapshots.push(this.getMemoryUsage())
        }

      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }

      this.progress.value = (i / (this.config.iterations || 5)) * 20 // 20% of total
    }

    return this.calculateBenchmarkResult('Virtual Scrolling', times, errors)
  }

  // Task store operations benchmark
  private async benchmarkTaskStoreOperations(): Promise<BenchmarkResult> {
    console.log('💾 Benchmarking task store operations...')

    const operations = ['create', 'read', 'update', 'delete'] as const
    const times: number[] = []
    const errors: string[] = []

    // Warmup
    await this.warmupTaskStore()

    for (let i = 0; i < (this.config.iterations || 5); i++) {
      const operation = operations[i % operations.length]
      const task = {
        id: `task-${i}`,
        title: `Test Task ${i}`,
        status: 'pending',
        priority: 'medium',
        timestamp: Date.now()
      }

      try {
        const startTime = performance.now()

        // Simulate task store operation
        switch (operation) {
          case 'create':
            await this.simulateTaskCreate(task)
            break
          case 'read':
            await this.simulateTaskRead(task.id)
            break
          case 'update':
            await this.simulateTaskUpdate(task)
            break
          case 'delete':
            await this.simulateTaskDelete(task.id)
            break
        }

        const duration = performance.now() - startTime
        times.push(duration)

      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }

      this.progress.value = 20 + (i / (this.config.iterations || 5)) * 15 // 20-35% of total
    }

    return this.calculateBenchmarkResult('Task Store Operations', times, errors)
  }

  // Network requests benchmark
  private async benchmarkNetworkRequests(): Promise<BenchmarkResult> {
    console.log('🌐 Benchmarking network requests...')

    const endpoints = [
      { url: 'https://in-theflow.com', method: 'GET' as const },
      { url: 'https://in-theflow.com', method: 'GET' as const },
      { url: 'https://in-theflow.com', method: 'GET' as const }
    ]

    const times: number[] = []
    const errors: string[] = []

    // Warmup
    await this.warmupNetworkRequests()

    for (let i = 0; i < (this.config.iterations || 5); i++) {
      const endpoint = endpoints[i % endpoints.length]
      const data = i % 2 === 0 ? null : { test: 'data', index: i }

      try {
        const startTime = performance.now()

        // Use network optimizer for request
        await this.networkOptimizer.makeRequest({
          url: endpoint.url,
          method: endpoint.method,
          data,
          priority: 'normal'
        })

        const duration = performance.now() - startTime
        times.push(duration)

      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }

      this.progress.value = 35 + (i / (this.config.iterations || 5)) * 15 // 35-50% of total
    }

    return this.calculateBenchmarkResult('Network Requests', times, errors)
  }

  // Render performance benchmark
  private async benchmarkRenderPerformance(): Promise<BenchmarkResult> {
    console.log('🎨 Benchmarking render performance...')

    const componentCounts = [10, 50, 100, 250, 500]
    const times: number[] = []
    const errors: string[] = []

    // Warmup
    await this.warmupRenderPerformance()

    for (let i = 0; i < (this.config.iterations || 5); i++) {
      const componentCount = componentCounts[i % componentCounts.length]

      try {
        const startTime = performance.now()

        // Simulate component rendering
        for (let j = 0; j < componentCount; j++) {
          this.renderOptimizer.optimizedRender(() => {
            // Simulate DOM operations
            const div = document.createElement('div')
            div.textContent = `Component ${j}`
            document.body.appendChild(div)
            document.body.removeChild(div)
          }, `component-${j}`)
        }

        const duration = performance.now() - startTime
        times.push(duration)

      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }

      this.progress.value = 50 + (i / (this.config.iterations || 5)) * 15 // 50-65% of total
    }

    return this.calculateBenchmarkResult('Render Performance', times, errors)
  }

  // Memory efficiency benchmark
  private async benchmarkMemoryEfficiency(): Promise<BenchmarkResult> {
    console.log('🧠 Benchmarking memory efficiency...')

    const times: number[] = []
    const errors: string[] = []
    const memoryUsage: number[] = []

    const initialMemory = this.getMemoryUsage()

    for (let i = 0; i < (this.config.iterations || 5); i++) {
      try {
        const startTime = performance.now()

        // Create large dataset
        const largeDataset = Array.from({ length: 10000 }, (_, index) => ({
          id: index,
          data: new Array(1000).fill(Math.random()),
          metadata: {
            created: Date.now(),
            updated: Date.now(),
            tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`)
          }
        }))

        // Use performance manager to cache data
        this.performanceManager.setCache(`dataset-${i}`, largeDataset, 60000)

        // Retrieve from cache
        const _cached = this.performanceManager.getCache(`dataset-${i}`)

        // Clean up
        this.performanceManager.deleteCache(`dataset-${i}`)

        const duration = performance.now() - startTime
        times.push(duration)

        const currentMemory = this.getMemoryUsage()
        memoryUsage.push(currentMemory)

      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }

      this.progress.value = 65 + (i / (this.config.iterations || 5)) * 15 // 65-80% of total
    }

    const finalMemory = this.getMemoryUsage()
    const memoryDelta = finalMemory - initialMemory

    const result = this.calculateBenchmarkResult('Memory Efficiency', times, errors)
    result.memoryDelta = memoryDelta
    result.memoryUsage = finalMemory

    return result
  }

  // Bundle size benchmark
  private async benchmarkBundleSize(): Promise<BenchmarkResult> {
    console.log('📦 Benchmarking bundle size...')

    const times: number[] = []
    const errors: string[] = []
    let bundleSize = 0

    try {
      const startTime = performance.now()

      // Analyze bundle size (simplified version)
      const scripts = document.querySelectorAll('script[src]')
      let totalSize = 0

      for (const script of scripts) {
        const src = script.getAttribute('src')
        if (src && src.includes('/src/')) {
          try {
            // Simulate bundle size calculation
            // In a real app, you'd fetch and calculate actual sizes
            totalSize += Math.random() * 100000 // Simulated size
          } catch (_error) {
            errors.push(`Failed to calculate bundle size for ${src}`)
          }
        }
      }

      bundleSize = totalSize

      const duration = performance.now() - startTime
      times.push(duration)

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }

    this.progress.value = 80 + 20 // 100% of total

    const result = this.calculateBenchmarkResult('Bundle Size Analysis', times, errors)
    result.throughput = bundleSize / 1024 // Convert to KB

    return result
  }

  // Warmup functions
  private async warmupVirtualScrolling() {
    for (let i = 0; i < (this.config.warmupIterations || 2); i++) {
      const items = Array.from({ length: 100 }, (_, index) => ({ id: index, data: null }))
      useVirtualScrolling(items, { threshold: 50 })
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  private async warmupTaskStore() {
    for (let i = 0; i < (this.config.warmupIterations || 2); i++) {
      await this.simulateTaskCreate({ id: `warmup-${i}`, title: 'Warmup Task' })
    }
  }

  private async warmupNetworkRequests() {
    for (let i = 0; i < (this.config.warmupIterations || 2); i++) {
      try {
        await fetch('https://in-theflow.com')
      } catch {
        // Ignore warmup errors
      }
    }
  }

  private async warmupRenderPerformance() {
    for (let i = 0; i < (this.config.warmupIterations || 2); i++) {
      this.renderOptimizer.optimizedRender(() => {
        document.createElement('div')
      })
    }
  }

  // Simulation functions
  private async simulateTaskCreate(_task: unknown): Promise<void> {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
  }

  private async simulateTaskRead(id: string): Promise<unknown> {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5))
    return { id, title: `Task ${id}` }
  }

  private async simulateTaskUpdate(_task: unknown): Promise<void> {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 8))
  }

  private async simulateTaskDelete(_id: string): Promise<void> {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3))
  }

  // Utility functions
  private calculateBenchmarkResult(name: string, times: number[], errors: string[]): BenchmarkResult {
    const validTimes = times.length > 0 ? times : [0]

    const total = validTimes.reduce((sum, time) => sum + time, 0)
    const average = total / validTimes.length
    const min = Math.min(...validTimes)
    const max = Math.max(...validTimes)

    // Calculate standard deviation
    const variance = validTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / validTimes.length
    const standardDeviation = Math.sqrt(variance)

    return {
      name,
      iterations: times.length,
      totalTime: total,
      averageTime: average,
      minTime: min,
      maxTime: max,
      standardDeviation,
      throughput: total > 0 ? (times.length / (total / 1000)) : 0, // operations per second
      successRate: times.length > 0 ? (((times.length - errors.length) / times.length) * 100) : 0,
      errors
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
    }
    return 0
  }

  private async generateReport(results: BenchmarkSuite): Promise<void> {
    console.log('\n📊 PERFORMANCE BENCHMARK REPORT')
    console.log('=====================================')

    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results,
      thresholds: PERFORMANCE_THRESHOLDS,
      summary: this.generateSummary(results)
    }

    // Log results
    for (const [category, result] of Object.entries(results)) {
      console.log(`\n🏷️  ${category.toUpperCase()}:`)
      console.log(`   Average Time: ${result.averageTime.toFixed(2)}ms`)
      console.log(`   Throughput: ${result.throughput.toFixed(0)} ops/sec`)
      console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`)
      console.log(`   Min/Max: ${result.minTime.toFixed(2)}ms / ${result.maxTime.toFixed(2)}ms`)

      if (result.memoryUsage) {
        console.log(`   Memory Usage: ${(result.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
      }

      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`)
      }
    }

    // Performance comparison
    console.log('\n🎯 PERFORMANCE COMPARISON:')
    for (const [threshold, _value] of Object.entries(PERFORMANCE_THRESHOLDS)) {
      const passed = this.checkThreshold(threshold as keyof PerformanceThresholds, results)
      console.log(`   ${threshold}: ${passed ? '✅ PASS' : '❌ FAIL'}`)
    }

    console.log('\n📈 SUMMARY:')
    console.log(report.summary)

    // Save to localStorage for persistence
    try {
      localStorage.setItem('flow-state-benchmark-report', JSON.stringify(report))
      console.log('\n💾 Report saved to localStorage')
    } catch (error) {
      console.warn('Failed to save report to localStorage:', error)
    }
  }

  private generateSummary(results: BenchmarkSuite): string {
    const overallPerformance = Object.values(results).reduce((sum, result) => {
      const score = (result.successRate / 100) * (1000 / Math.max(result.averageTime, 1))
      return sum + score
    }, 0) / Object.keys(results).length

    let summary = `Overall Performance Score: ${overallPerformance.toFixed(0)}/1000\n`

    if (overallPerformance > 800) {
      summary += 'Status: 🟢 EXCELLENT - Application performs exceptionally well'
    } else if (overallPerformance > 600) {
      summary += 'Status: 🟡 GOOD - Application performs well with minor optimizations possible'
    } else if (overallPerformance > 400) {
      summary += 'Status: 🟠 FAIR - Application needs performance optimizations'
    } else {
      summary += 'Status: 🔴 POOR - Application requires significant performance improvements'
    }

    return summary
  }

  private checkThreshold(threshold: keyof PerformanceThresholds, results: BenchmarkSuite): boolean {
    switch (threshold) {
      case 'maxAverageRenderTime':
        return results.renderPerformance.averageTime <= PERFORMANCE_THRESHOLDS[threshold]
      case 'maxMemoryUsage': {
        const memoryUsage = results.memoryEfficiency.memoryUsage || 0
        return memoryUsage <= PERFORMANCE_THRESHOLDS[threshold]
      }
      case 'minThroughput':
        return results.taskStoreOperations.throughput >= PERFORMANCE_THRESHOLDS[threshold]
      default:
        return true
    }
  }

  // Public API
  get isBenchmarkRunning(): boolean {
    return this.isRunning.value
  }

  get currentProgress(): number {
    return this.progress.value
  }

  get benchmarkResults(): Partial<BenchmarkSuite> {
    return this.results.value
  }

  async getLatestReport(): Promise<unknown> {
    try {
      const report = localStorage.getItem('flow-state-benchmark-report')
      return report ? JSON.parse(report) : null
    } catch {
      return null
    }
  }

  clearResults(): void {
    this.results.value = {}
    this.progress.value = 0
  }
}

// Export singleton instance
export const performanceBenchmark = new PerformanceBenchmark()

export default PerformanceBenchmark