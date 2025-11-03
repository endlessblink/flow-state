// Performance Monitoring Composable
// Tracks application performance metrics and provides optimization suggestions

import { ref, computed, onMounted, onUnmounted } from 'vue'

interface PerformanceMetrics {
  renderTime: number
  stateUpdates: number
  memoryUsage: number
  fps: number
  bundleSize: number
  networkRequests: number
  cacheHitRate: number
}

interface PerformanceEntry {
  timestamp: number
  type: 'render' | 'state' | 'memory' | 'fps' | 'network'
  value: number
  details?: string
}

export const usePerformanceMonitor = () => {
  const metrics = ref<PerformanceMetrics>({
    renderTime: 0,
    stateUpdates: 0,
    memoryUsage: 0,
    fps: 60,
    bundleSize: 0,
    networkRequests: 0,
    cacheHitRate: 0
  })

  const performanceHistory = ref<PerformanceEntry[]>([])
  const isMonitoring = ref(false)
  const lastFrameTime = ref(performance.now())
  const frameCount = ref(0)

  // FPS monitoring
  const measureFPS = () => {
    const currentTime = performance.now()
    const deltaTime = currentTime - lastFrameTime.value

    frameCount.value++

    if (deltaTime >= 1000) {
      const fps = Math.round((frameCount.value * 1000) / deltaTime)

      metrics.value.fps = fps
      addPerformanceEntry('fps', fps)

      frameCount.value = 0
      lastFrameTime.value = currentTime
    }

    if (isMonitoring.value) {
      requestAnimationFrame(measureFPS)
    }
  }

  // Memory usage monitoring
  const measureMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedMemory = Math.round(memory.usedJSHeapSize / 1024 / 1024) // MB

      metrics.value.memoryUsage = usedMemory
      addPerformanceEntry('memory', usedMemory, `Total: ${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`)
    }
  }

  // Render time monitoring
  const startRenderMeasurement = () => {
    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime

      metrics.value.renderTime = renderTime
      addPerformanceEntry('render', renderTime)

      return renderTime
    }
  }

  // State update tracking
  const trackStateUpdate = (operation: string) => {
    metrics.value.stateUpdates++
    addPerformanceEntry('state', 1, operation)
  }

  // Network request tracking
  const trackNetworkRequest = (url: string, duration: number) => {
    metrics.value.networkRequests++
    addPerformanceEntry('network', duration, url)
  }

  // Bundle size estimation
  const estimateBundleSize = async () => {
    try {
      const response = await fetch('/src/main.ts')
      const text = await response.text()
      const estimatedSize = Math.round(text.length * 10) // Rough estimation

      metrics.value.bundleSize = estimatedSize
      return estimatedSize
    } catch {
      return 0
    }
  }

  // Performance history management
  const addPerformanceEntry = (type: PerformanceEntry['type'], value: number, details?: string) => {
    performanceHistory.value.push({
      timestamp: Date.now(),
      type,
      value,
      details
    })

    // Keep only last 100 entries
    if (performanceHistory.value.length > 100) {
      performanceHistory.value = performanceHistory.value.slice(-100)
    }
  }

  // Performance analysis
  const getPerformanceScore = computed(() => {
    let score = 100

    // FPS scoring (30% weight)
    if (metrics.value.fps < 30) score -= 30
    else if (metrics.value.fps < 45) score -= 20
    else if (metrics.value.fps < 55) score -= 10

    // Memory usage scoring (25% weight)
    if (metrics.value.memoryUsage > 200) score -= 25
    else if (metrics.value.memoryUsage > 150) score -= 15
    else if (metrics.value.memoryUsage > 100) score -= 5

    // Render time scoring (25% weight)
    if (metrics.value.renderTime > 100) score -= 25
    else if (metrics.value.renderTime > 50) score -= 15
    else if (metrics.value.renderTime > 20) score -= 5

    // State updates scoring (20% weight)
    if (metrics.value.stateUpdates > 100) score -= 20
    else if (metrics.value.stateUpdates > 50) score -= 10
    else if (metrics.value.stateUpdates > 20) score -= 5

    return Math.max(0, score)
  })

  const getPerformanceGrade = computed(() => {
    const score = getPerformanceScore.value
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
  })

  // Optimization suggestions
  const getOptimizationSuggestions = computed(() => {
    const suggestions = []

    if (metrics.value.fps < 45) {
      suggestions.push({
        type: 'critical',
        title: 'Low FPS Detected',
        description: 'Consider reducing canvas complexity or implementing virtualization',
        action: 'Implement virtual scrolling for large lists'
      })
    }

    if (metrics.value.memoryUsage > 150) {
      suggestions.push({
        type: 'warning',
        title: 'High Memory Usage',
        description: 'Memory usage is above optimal range',
        action: 'Check for memory leaks and implement object pooling'
      })
    }

    if (metrics.value.renderTime > 50) {
      suggestions.push({
        type: 'warning',
        title: 'Slow Render Performance',
        description: 'Render times are above optimal range',
        action: 'Optimize component rendering and use memoization'
      })
    }

    if (metrics.value.stateUpdates > 50) {
      suggestions.push({
        type: 'info',
        title: 'Frequent State Updates',
        description: 'Consider debouncing state updates',
        action: 'Implement state update batching'
      })
    }

    return suggestions
  })

  // Monitoring control
  const startMonitoring = () => {
    if (isMonitoring.value) return

    isMonitoring.value = true
    lastFrameTime.value = performance.now()
    frameCount.value = 0

    // Start FPS monitoring
    requestAnimationFrame(measureFPS)

    // Start memory monitoring
    const memoryInterval = setInterval(measureMemoryUsage, 2000)

    // Store interval for cleanup
    ;(window as any).__performanceMonitorMemoryInterval = memoryInterval

    console.log('🚀 Performance monitoring started')
  }

  const stopMonitoring = () => {
    isMonitoring.value = false

    // Clear memory monitoring interval
    const memoryInterval = (window as any).__performanceMonitorMemoryInterval
    if (memoryInterval) {
      clearInterval(memoryInterval)
      delete (window as any).__performanceMonitorMemoryInterval
    }

    console.log('⏹️ Performance monitoring stopped')
  }

  // Performance reports
  const generateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: { ...metrics.value },
      score: getPerformanceScore.value,
      grade: getPerformanceGrade.value,
      suggestions: getOptimizationSuggestions.value,
      recentHistory: performanceHistory.value.slice(-10)
    }

    return report
  }

  const downloadReport = () => {
    const report = generateReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()

    URL.revokeObjectURL(url)
  }

  // Performance benchmarks
  const runBenchmark = async () => {
    console.log('🏃 Starting performance benchmark...')

    const results = {
      renderTest: 0,
      stateUpdateTest: 0,
      memoryTest: 0,
      overallScore: 0
    }

    // Render test
    const renderStart = performance.now()
    for (let i = 0; i < 1000; i++) {
      // Simulate render operations
      const element = document.createElement('div')
      element.innerHTML = `<span>Test ${i}</span>`
      document.body.appendChild(element)
      document.body.removeChild(element)
    }
    results.renderTest = performance.now() - renderStart

    // State update test
    const stateStart = performance.now()
    const testArray = new Array(1000).fill(null).map((_, i) => ({ id: i, value: i }))
    for (let i = 0; i < 1000; i++) {
      testArray[i].value = Math.random()
    }
    results.stateUpdateTest = performance.now() - stateStart

    // Memory test
    const memoryStart = performance.now()
    const testObjects = []
    for (let i = 0; i < 10000; i++) {
      testObjects.push({ id: i, data: new Array(100).fill(Math.random()) })
    }
    results.memoryTest = performance.now() - memoryStart

    // Calculate overall score
    const maxScore = 1000 // 1 second max for each test
    results.overallScore = Math.max(0, 300 - (results.renderTest + results.stateUpdateTest + results.memoryTest))

    console.log('📊 Benchmark results:', results)
    return results
  }

  // Cleanup
  const cleanup = () => {
    stopMonitoring()
    performanceHistory.value = []
    metrics.value = {
      renderTime: 0,
      stateUpdates: 0,
      memoryUsage: 0,
      fps: 60,
      bundleSize: 0,
      networkRequests: 0,
      cacheHitRate: 0
    }
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    metrics,
    performanceHistory,
    isMonitoring,

    // Computed
    getPerformanceScore,
    getPerformanceGrade,
    getOptimizationSuggestions,

    // Methods
    startMonitoring,
    stopMonitoring,
    measureFPS,
    measureMemoryUsage,
    startRenderMeasurement,
    trackStateUpdate,
    trackNetworkRequest,
    estimateBundleSize,

    // Reports
    generateReport,
    downloadReport,
    runBenchmark,

    // Utilities
    cleanup
  }
}