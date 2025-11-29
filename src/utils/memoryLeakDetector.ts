/**
 * Memory Leak Detection System
 * Detects and reports memory leaks in the Pomo-Flow application
 */

import { ref, onMounted, onUnmounted } from 'vue'

export interface MemorySnapshot {
  timestamp: number
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  domNodes: number
  eventListeners: number
  components: number
  watchers: number
  timers: number
}

export interface MemoryLeakReport {
  timestamp: number
  duration: number
  initialMemory: MemorySnapshot
  finalMemory: MemorySnapshot
  memoryGrowth: number
  leakDetected: boolean
  suspiciousGrowth: boolean
  recommendations: string[]
  componentAnalysis: ComponentMemoryProfile[]
}

export interface ComponentMemoryProfile {
  componentName: string
  instanceCount: number
  memoryUsage: number
  hasCleanup: boolean
  hasEventListeners: boolean
  hasTimers: boolean
  risk: 'low' | 'medium' | 'high'
}

export interface CPUProfile {
  timestamp: number
  duration: number
  averageUsage: number
  peakUsage: number
  idleTime: number
  busyTime: number
  tasks: number
  longTasks: number
  frameDrops: number
}

export class MemoryLeakDetector {
  private isMonitoring = ref(false)
  private snapshots: MemorySnapshot[] = []
  private componentRegistry = new Map<string, ComponentMemoryProfile>()
  private timerRegistry = new Set<number>()
  private eventListenerRegistry = new Set<string>()
  private monitoringInterval: number | null = null
  private baselineMemory: MemorySnapshot | null = null
  private cpuProfileInterval: number | null = null

  // Performance monitoring
  private performanceObserver: PerformanceObserver | null = null
  private frameCount = 0
  private lastFrameTime = 0
  private droppedFrames = 0

  constructor() {
    this.setupPerformanceMonitoring()
  }

  // Start memory monitoring
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring.value) {
      console.warn('Memory leak detection is already running')
      return
    }

    console.log('🔍 Starting memory leak detection...')
    this.isMonitoring.value = true

    // Take initial snapshot
    this.baselineMemory = this.takeMemorySnapshot()

    // Start periodic monitoring
    this.monitoringInterval = window.setInterval(() => {
      this.takePeriodicSnapshot()
    }, intervalMs)

    // Start CPU profiling
    this.startCPUProfiling()
  }

  // Stop memory monitoring
  stopMonitoring(): MemoryLeakReport {
    if (!this.isMonitoring.value) {
      console.warn('Memory leak detection is not running')
      return this.generateEmptyReport()
    }

    console.log('🛑 Stopping memory leak detection...')
    this.isMonitoring.value = false

    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.cpuProfileInterval) {
      clearInterval(this.cpuProfileInterval)
      this.cpuProfileInterval = null
    }

    // Generate final report
    const report = this.generateLeakReport()
    this.cleanup()

    return report
  }

  // Register component for tracking
  registerComponent(componentName: string, element?: Element): void {
    const profile = this.componentRegistry.get(componentName) || {
      componentName,
      instanceCount: 0,
      memoryUsage: 0,
      hasCleanup: false,
      hasEventListeners: false,
      hasTimers: false,
      risk: 'low'
    }

    profile.instanceCount++
    profile.memoryUsage = this.estimateComponentMemoryUsage(element)

    this.componentRegistry.set(componentName, profile)
  }

  // Unregister component
  unregisterComponent(componentName: string): void {
    const profile = this.componentRegistry.get(componentName)
    if (profile) {
      profile.instanceCount = Math.max(0, profile.instanceCount - 1)
    }
  }

  // Register timer for tracking
  registerTimer(timerId: number, componentName?: string): void {
    this.timerRegistry.add(timerId)
    if (componentName) {
      const profile = this.componentRegistry.get(componentName)
      if (profile) {
        profile.hasTimers = true
        profile.risk = this.calculateRisk(profile)
      }
    }
  }

  // Unregister timer
  unregisterTimer(timerId: number): void {
    this.timerRegistry.delete(timerId)
  }

  // Register event listener for tracking
  registerEventListener(target: EventTarget, type: string, componentName?: string): void {
    const key = `${target.constructor.name}-${type}`
    this.eventListenerRegistry.add(key)

    if (componentName) {
      const profile = this.componentRegistry.get(componentName)
      if (profile) {
        profile.hasEventListeners = true
        profile.risk = this.calculateRisk(profile)
      }
    }
  }

  // Take memory snapshot
  private takeMemorySnapshot(): MemorySnapshot {
    const memory = (performance as any).memory || {}

    return {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize || 0,
      totalJSHeapSize: memory.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
      domNodes: document.querySelectorAll('*').length,
      eventListeners: this.eventListenerRegistry.size,
      components: this.componentRegistry.size,
      watchers: this.estimateWatcherCount(),
      timers: this.timerRegistry.size
    }
  }

  // Take periodic snapshot
  private takePeriodicSnapshot(): void {
    const snapshot = this.takeMemorySnapshot()
    this.snapshots.push(snapshot)

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100)
    }

    // Check for suspicious memory growth
    this.checkForSuspiciousGrowth(snapshot)
  }

  // Check for suspicious memory growth
  private checkForSuspiciousGrowth(currentSnapshot: MemorySnapshot): void {
    if (!this.baselineMemory || this.snapshots.length < 5) return

    const recentSnapshots = this.snapshots.slice(-5)
    const averageGrowth = recentSnapshots.reduce((sum, snapshot) => {
      return sum + (snapshot.usedJSHeapSize - this.baselineMemory!.usedJSHeapSize)
    }, 0) / recentSnapshots.length

    const growthPercentage = (averageGrowth / this.baselineMemory.usedJSHeapSize) * 100

    if (growthPercentage > 50) { // More than 50% growth is suspicious
      console.warn(`⚠️ Suspicious memory growth detected: ${growthPercentage.toFixed(1)}%`)
      console.warn('Consider checking for memory leaks in components')

      // Log potential problematic components
      this.logProblematicComponents()
    }
  }

  // Generate memory leak report
  private generateLeakReport(): MemoryLeakReport {
    if (!this.baselineMemory) {
      return this.generateEmptyReport()
    }

    const finalSnapshot = this.snapshots[this.snapshots.length - 1] || this.baselineMemory
    const duration = finalSnapshot.timestamp - this.baselineMemory.timestamp
    const memoryGrowth = finalSnapshot.usedJSHeapSize - this.baselineMemory.usedJSHeapSize
    const suspiciousGrowth = memoryGrowth > (this.baselineMemory.usedJSHeapSize * 0.3) // 30% growth
    const leakDetected = memoryGrowth > (this.baselineMemory.usedJSHeapSize * 0.5) // 50% growth

    const componentProfiles = Array.from(this.componentRegistry.values())
    const recommendations = this.generateRecommendations(finalSnapshot, componentProfiles)

    return {
      timestamp: Date.now(),
      duration,
      initialMemory: this.baselineMemory,
      finalMemory: finalSnapshot,
      memoryGrowth,
      leakDetected,
      suspiciousGrowth,
      recommendations,
      componentAnalysis: componentProfiles
    }
  }

  // Generate empty report
  private generateEmptyReport(): MemoryLeakReport {
    const emptySnapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      domNodes: 0,
      eventListeners: 0,
      components: 0,
      watchers: 0,
      timers: 0
    }

    return {
      timestamp: Date.now(),
      duration: 0,
      initialMemory: emptySnapshot,
      finalMemory: emptySnapshot,
      memoryGrowth: 0,
      leakDetected: false,
      suspiciousGrowth: false,
      recommendations: ['No monitoring data available'],
      componentAnalysis: []
    }
  }

  // Generate recommendations
  private generateRecommendations(snapshot: MemorySnapshot, components: ComponentMemoryProfile[]): string[] {
    const recommendations: string[] = []

    // Memory-based recommendations
    if (snapshot.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected. Consider implementing object pooling or lazy loading.')
    }

    if (snapshot.domNodes > 10000) {
      recommendations.push('High DOM node count detected. Consider virtual scrolling or element recycling.')
    }

    if (snapshot.timers > 50) {
      recommendations.push('Many active timers detected. Ensure all timers are properly cleared.')
    }

    if (snapshot.eventListeners > 100) {
      recommendations.push('Many event listeners detected. Ensure all listeners are properly removed.')
    }

    // Component-based recommendations
    const highRiskComponents = components.filter(c => c.risk === 'high')
    if (highRiskComponents.length > 0) {
      recommendations.push(`High-risk components detected: ${highRiskComponents.map(c => c.componentName).join(', ')}`)
      recommendations.push('Review these components for proper cleanup and resource management.')
    }

    const componentsWithoutCleanup = components.filter(c => !c.hasCleanup)
    if (componentsWithoutCleanup.length > 0) {
      recommendations.push(`Components without cleanup: ${componentsWithoutCleanup.map(c => c.componentName).join(', ')}`)
    }

    return recommendations
  }

  // Calculate component risk
  private calculateRisk(profile: ComponentMemoryProfile): 'low' | 'medium' | 'high' {
    let riskScore = 0

    if (profile.instanceCount > 10) riskScore += 1
    if (profile.memoryUsage > 1024 * 1024) riskScore += 1 // 1MB
    if (profile.hasEventListeners) riskScore += 1
    if (profile.hasTimers) riskScore += 1
    if (!profile.hasCleanup) riskScore += 2

    if (riskScore >= 4) return 'high'
    if (riskScore >= 2) return 'medium'
    return 'low'
  }

  // Log problematic components
  private logProblematicComponents(): void {
    const components = Array.from(this.componentRegistry.values())
    const problematicComponents = components.filter(c => c.risk === 'high')

    if (problematicComponents.length > 0) {
      console.warn('🚨 Potentially problematic components:')
      problematicComponents.forEach(component => {
        console.warn(`  - ${component.componentName}: ${component.instanceCount} instances, ${component.risk} risk`)
      })
    }
  }

  // Estimate component memory usage
  private estimateComponentMemoryUsage(element?: Element): number {
    if (!element) return 0

    // Rough estimation based on DOM characteristics
    let estimatedSize = 1024 // Base size for component instance

    // Add size for child nodes
    const childNodes = element.querySelectorAll('*').length
    estimatedSize += childNodes * 512 // 512 bytes per DOM node

    // Add size for event listeners
    if (element.getAttribute('data-has-listeners')) {
      estimatedSize += 256
    }

    return estimatedSize
  }

  // Estimate Vue watcher count (simplified)
  private estimateWatcherCount(): number {
    // This is a simplified estimation
    // In a real Vue app, you'd access the internal watcher count
    return this.componentRegistry.size * 3 // Assume 3 watchers per component
  }

  // CPU Profiling
  private startCPUProfiling(): void {
    let frameCount = 0
    let lastTime = performance.now()
    let totalFrameTime = 0
    let longTaskCount = 0

    this.cpuProfileInterval = window.setInterval(() => {
      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      // Measure frame time
      const frameStartTime = performance.now()

      // Simulate frame processing time measurement
      requestAnimationFrame(() => {
        const frameEndTime = performance.now()
        const frameTime = frameEndTime - frameStartTime
        totalFrameTime += frameTime

        frameCount++

        // Count long tasks (>16ms)
        if (frameTime > 16) {
          longTaskCount++
          this.droppedFrames++
        }

        // Log CPU usage periodically
        if (frameCount % 60 === 0) { // Every 60 frames
          const averageFrameTime = totalFrameTime / frameCount
          const cpuUsage = (averageFrameTime / 16.67) * 100 // 16.67ms = 60fps

          if (cpuUsage > 80) {
            console.warn(`⚠️ High CPU usage detected: ${cpuUsage.toFixed(1)}%`)
          }
        }
      })

    }, 16) // ~60fps
  }

  // Setup performance monitoring
  private setupPerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.duration > 16) {
            console.warn(`⚠️ Long task detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`)
          }
        }
      })

      try {
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] })
      } catch (error) {
        console.warn('Performance observer setup failed:', error)
      }
    }
  }

  // Cleanup
  private cleanup(): void {
    this.snapshots = []
    this.componentRegistry.clear()
    this.timerRegistry.clear()
    this.eventListenerRegistry.clear()
    this.baselineMemory = null

    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }
  }

  // Public getters
  get isMonitoringActive(): boolean {
    return this.isMonitoring.value
  }

  get currentMemoryUsage(): MemorySnapshot {
    return this.takeMemorySnapshot()
  }

  get componentProfiles(): ComponentMemoryProfile[] {
    return Array.from(this.componentRegistry.values())
  }

  get activeTimers(): number {
    return this.timerRegistry.size
  }

  get activeEventListeners(): number {
    return this.eventListenerRegistry.size
  }

  // Export data for analysis
  exportMonitoringData(): any {
    return {
      snapshots: this.snapshots,
      componentProfiles: this.componentProfiles,
      baselineMemory: this.baselineMemory,
      isActive: this.isMonitoring.value
    }
  }

  // Import monitoring data
  importMonitoringData(data: any): void {
    if (data.snapshots) this.snapshots = data.snapshots
    if (data.componentProfiles) {
      this.componentRegistry.clear()
      data.componentProfiles.forEach((profile: ComponentMemoryProfile) => {
        this.componentRegistry.set(profile.componentName, profile)
      })
    }
    if (data.baselineMemory) this.baselineMemory = data.baselineMemory
  }
}

// Global memory leak detector instance
export const memoryLeakDetector = new MemoryLeakDetector()

// Vue composable for easy integration
export function useMemoryLeakDetector() {
  return {
    detector: memoryLeakDetector,
    isMonitoring: () => memoryLeakDetector.isMonitoringActive,
    startMonitoring: (intervalMs?: number) => memoryLeakDetector.startMonitoring(intervalMs),
    stopMonitoring: () => memoryLeakDetector.stopMonitoring(),
    registerComponent: (name: string, element?: Element) => memoryLeakDetector.registerComponent(name, element),
    unregisterComponent: (name: string) => memoryLeakDetector.unregisterComponent(name),
    currentMemory: () => memoryLeakDetector.currentMemoryUsage,
    componentProfiles: () => memoryLeakDetector.componentProfiles
  }
}

export default MemoryLeakDetector