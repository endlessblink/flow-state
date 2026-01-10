# Performance Optimization Patterns

## Memory Management Strategies

### Efficient State Cloning

```typescript
class OptimizedCloner {
  private static objectPool = new Map<string, any[]>()
  private static maxPoolSize = 100

  static clone<T>(obj: T, strategy: 'deep' | 'shallow' | 'selective' = 'deep'): T {
    switch (strategy) {
      case 'deep':
        return this.deepClone(obj)
      case 'shallow':
        return this.shallowClone(obj)
      case 'selective':
        return this.selectiveClone(obj)
      default:
        return this.deepClone(obj)
    }
  }

  private static deepClone<T>(obj: T): T {
    // Use structured cloning for better performance
    if (this.canUseStructuredClone(obj)) {
      return structuredClone(obj)
    }

    // Fallback to manual deep clone with pooling
    return this.manualDeepClone(obj)
  }

  private static canUseStructuredClone(obj: any): boolean {
    // Check if object contains only clonable types
    try {
      structuredClone(obj)
      return true
    } catch {
      return false
    }
  }

  private static manualDeepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime()) as T
    if (obj instanceof Map) {
      const cloned = new Map()
      for (const [key, value] of obj) {
        cloned.set(this.manualDeepClone(key), this.manualDeepClone(value))
      }
      return cloned as T
    }
    if (obj instanceof Set) {
      const cloned = new Set()
      for (const value of obj) {
        cloned.add(this.manualDeepClone(value))
      }
      return cloned as T
    }
    if (Array.isArray(obj)) {
      const poolKey = obj.constructor.name
      let pool = this.objectPool.get(poolKey) || []

      let cloned: any
      if (pool.length > 0) {
        cloned = pool.pop()!
        cloned.length = 0
      } else {
        cloned = []
      }

      for (let i = 0; i < obj.length; i++) {
        cloned[i] = this.manualDeepClone(obj[i])
      }

      // Return to pool if not too large
      if (cloned.length < 1000 && pool.length < this.maxPoolSize) {
        pool.push(cloned)
        this.objectPool.set(poolKey, pool)
      }

      return cloned as T
    }

    // Plain object
    const poolKey = 'Object'
    let pool = this.objectPool.get(poolKey) || []

    let cloned: any
    if (pool.length > 0) {
      cloned = pool.pop()!
      // Clear existing properties
      Object.keys(cloned).forEach(key => delete cloned[key])
    } else {
      cloned = {}
    }

    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.manualDeepClone(value)
    }

    // Return to pool
    if (Object.keys(cloned).length < 100 && pool.length < this.maxPoolSize) {
      pool.push(cloned)
      this.objectPool.set(poolKey, pool)
    }

    return cloned as T
  }

  private static shallowClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return [...obj] as T
    return { ...obj } as T
  }

  private static selectiveClone<T>(obj: T): T {
    // Clone only essential properties for undo/redo
    const essentialProps = ['id', 'title', 'status', 'position', 'createdAt', 'updatedAt']

    if (Array.isArray(obj)) {
      return obj.map(item => this.selectiveClone(item)) as T
    }

    if (typeof obj === 'object' && obj !== null) {
      const cloned: any = {}
      for (const prop of essentialProps) {
        if (prop in obj) {
          cloned[prop] = (obj as any)[prop]
        }
      }
      return cloned as T
    }

    return obj
  }
}
```

### Memory-Monitored History

```typescript
class MemoryMonitoredHistory {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private memoryThreshold = 50 * 1024 * 1024 // 50MB
  private maxEntries = 100
  private compressionInterval = 2000 // 2 seconds
  private lastCleanup = Date.now()

  async execute(command: Command): Promise<void> {
    await command.execute()

    const entry: HistoryEntry = {
      id: generateId(),
      command,
      timestamp: Date.now(),
      memorySize: this.estimateMemorySize(command),
      compressed: false
    }

    this.undoStack.push(entry)
    this.redoStack = []

    // Check if cleanup is needed
    if (this.shouldCleanup()) {
      this.cleanup()
    }
  }

  private estimateMemorySize(command: Command): number {
    try {
      const jsonString = JSON.stringify(command)
      return new Blob([jsonString]).size
    } catch {
      // Fallback estimation
      return 1024 // 1KB default
    }
  }

  private shouldCleanup(): boolean {
    const now = Date.now()
    const timeSinceLastCleanup = now - this.lastCleanup

    // Check time-based cleanup
    if (timeSinceLastCleanup > this.compressionInterval) {
      return true
    }

    // Check memory usage
    const totalMemory = this.calculateMemoryUsage()
    if (totalMemory > this.memoryThreshold) {
      return true
    }

    // Check entry count
    if (this.undoStack.length > this.maxEntries) {
      return true
    }

    return false
  }

  private calculateMemoryUsage(): number {
    const undoMemory = this.undoStack.reduce((total, entry) => total + entry.memorySize, 0)
    const redoMemory = this.redoStack.reduce((total, entry) => total + entry.memorySize, 0)
    return undoMemory + redoMemory
  }

  private cleanup(): void {
    this.lastCleanup = Date.now()

    // Prioritize entries to keep
    const important = this.undoStack.filter(entry =>
      entry.command.getDescription().includes('checkpoint') ||
      entry.command.getDescription().includes('important') ||
      (Date.now() - entry.timestamp) < 300000 // Keep last 5 minutes
    )

    // Keep recent entries
    const recent = this.undoStack.slice(-30)

    // Remove duplicates and merge
    const unique = this.deduplicateEntries([...important, ...recent])

    // Sort by importance and recency
    unique.sort((a, b) => {
      const aImportance = this.calculateImportance(a)
      const bImportance = this.calculateImportance(b)

      if (aImportance !== bImportance) {
        return bImportance - aImportance
      }

      return b.timestamp - a.timestamp
    })

    // Limit final size
    this.undoStack = unique.slice(0, 50)

    // Compress if still too large
    if (this.calculateMemoryUsage() > this.memoryThreshold) {
      this.compressEntries()
    }
  }

  private calculateImportance(entry: HistoryEntry): number {
    let importance = 0

    // Age importance (newer is more important)
    const ageInMinutes = (Date.now() - entry.timestamp) / 60000
    importance += Math.max(0, 10 - ageInMinutes)

    // Description importance
    const description = entry.command.getDescription().toLowerCase()
    if (description.includes('checkpoint')) importance += 20
    if (description.includes('create')) importance += 5
    if (description.includes('delete')) importance += 5
    if (description.includes('batch')) importance += 10

    return importance
  }

  private deduplicateEntries(entries: HistoryEntry[]): HistoryEntry[] {
    const seen = new Set<string>()
    const unique: HistoryEntry[] = []

    for (const entry of entries) {
      const signature = this.getEntrySignature(entry)
      if (!seen.has(signature)) {
        seen.add(signature)
        unique.push(entry)
      }
    }

    return unique
  }

  private getEntrySignature(entry: HistoryEntry): string {
    return `${entry.command.constructor.name}:${entry.command.getDescription()}`
  }

  private compressEntries(): void {
    // Group similar entries and compress them
    const groups = this.groupSimilarEntries(this.undoStack)

    const compressed: HistoryEntry[] = []

    for (const group of groups) {
      if (group.length === 1) {
        compressed.push(group[0])
      } else {
        // Create compressed checkpoint
        const checkpoint = this.createCheckpoint(group)
        compressed.push(checkpoint)
      }
    }

    this.undoStack = compressed
  }

  private groupSimilarEntries(entries: HistoryEntry[]): HistoryEntry[][] {
    const groups = new Map<string, HistoryEntry[]>()

    for (const entry of entries) {
      const groupKey = this.getGroupKey(entry)

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }

      groups.get(groupKey)!.push(entry)
    }

    return Array.from(groups.values())
  }

  private getGroupKey(entry: HistoryEntry): string {
    const description = entry.command.getDescription()

    // Group by operation type and target
    if (description.includes('create')) return 'create'
    if (description.includes('update')) return 'update'
    if (description.includes('delete')) return 'delete'
    if (description.includes('move')) return 'move'

    return 'other'
  }

  private createCheckpoint(entries: HistoryEntry[]): HistoryEntry {
    const descriptions = entries.map(e => e.command.getDescription()).join(', ')

    return {
      id: generateId(),
      command: new CheckpointCommand(
        this.extractStateFromEntries(entries),
        `Checkpoint: ${descriptions}`
      ),
      timestamp: Math.min(...entries.map(e => e.timestamp)),
      memorySize: this.estimateMemorySize(entries),
      compressed: true
    }
  }

  private extractStateFromEntries(entries: HistoryEntry[]): any {
    // Extract cumulative state from entries
    // This would be implemented based on your specific state structure
    return {}
  }
}

interface HistoryEntry {
  id: string
  command: Command
  timestamp: number
  memorySize: number
  compressed: boolean
}
```

## Lazy Loading and Virtualization

### Lazy State Loading

```typescript
class LazyStateLoader {
  private loadedStates = new Map<string, any>()
  private loadingPromises = new Map<string, Promise<any>>()
  private stateCache = new LRUCache<string, any>(50)

  async loadState(stateId: string, loader: () => Promise<any>): Promise<any> {
    // Check cache first
    if (this.stateCache.has(stateId)) {
      return this.stateCache.get(stateId)
    }

    // Check if already loaded
    if (this.loadedStates.has(stateId)) {
      const state = this.loadedStates.get(stateId)
      this.stateCache.set(stateId, state)
      return state
    }

    // Check if currently loading
    if (this.loadingPromises.has(stateId)) {
      return this.loadingPromises.get(stateId)
    }

    // Load state
    const loadingPromise = this.doLoadState(stateId, loader)
    this.loadingPromises.set(stateId, loadingPromise)

    try {
      const state = await loadingPromise
      this.loadedStates.set(stateId, state)
      this.stateCache.set(stateId, state)
      return state
    } finally {
      this.loadingPromises.delete(stateId)
    }
  }

  private async doLoadState(stateId: string, loader: () => Promise<any>): Promise<any> {
    try {
      const state = await loader()

      // Validate loaded state
      if (!this.validateState(state)) {
        throw new Error(`Invalid state loaded for ${stateId}`)
      }

      return state
    } catch (error) {
      console.error(`Failed to load state ${stateId}:`, error)
      throw error
    }
  }

  private validateState(state: any): boolean {
    // Basic validation
    if (state === null || state === undefined) return false
    if (typeof state !== 'object') return false

    // Check for required properties
    const requiredProps = ['timestamp', 'version']
    return requiredProps.every(prop => prop in state)
  }

  preloadStates(stateIds: string[], loader: (id: string) => Promise<any>): void {
    // Preload states in background with priority
    const priorityStates = stateIds.slice(0, 10)
    const backgroundStates = stateIds.slice(10)

    // Load priority states immediately
    priorityStates.forEach(async (stateId, index) => {
      setTimeout(() => {
        this.loadState(stateId, () => loader(stateId)).catch(console.error)
      }, index * 100) // Stagger requests
    })

    // Load background states when idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        backgroundStates.forEach(stateId => {
          this.loadState(stateId, () => loader(stateId)).catch(console.error)
        })
      })
    }
  }

  clearCache(): void {
    this.stateCache.clear()
    this.loadedStates.clear()
  }
}

class LRUCache<K, V> {
  private cache = new Map<K, V>()

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
```

### Virtualized History Display

```typescript
class VirtualizedHistory {
  private container: HTMLElement
  private itemHeight = 40
  private visibleItems = 20
  private scrollTop = 0
  private totalHeight = 0
  private visibleStart = 0
  private visibleEnd = 0

  constructor(container: HTMLElement, private history: HistoryEntry[]) {
    this.container = container
    this.totalHeight = history.length * this.itemHeight
    this.setupScrollListener()
  }

  private setupScrollListener(): void {
    this.container.addEventListener('scroll', () => {
      this.scrollTop = this.container.scrollTop
      this.updateVisibleRange()
      this.render()
    })
  }

  private updateVisibleRange(): void {
    this.visibleStart = Math.floor(this.scrollTop / this.itemHeight)
    this.visibleEnd = Math.min(
      this.visibleStart + this.visibleItems,
      this.history.length
    )
  }

  render(): void {
    // Clear container
    this.container.innerHTML = ''

    // Create spacer for top offset
    const topSpacer = document.createElement('div')
    topSpacer.style.height = `${this.visibleStart * this.itemHeight}px`
    this.container.appendChild(topSpacer)

    // Render visible items
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const entry = this.history[i]
      const element = this.createHistoryElement(entry, i)
      this.container.appendChild(element)
    }

    // Create spacer for bottom offset
    const bottomSpacer = document.createElement('div')
    bottomSpacer.style.height = `${(this.history.length - this.visibleEnd) * this.itemHeight}px`
    this.container.appendChild(bottomSpacer)
  }

  private createHistoryElement(entry: HistoryEntry, index: number): HTMLElement {
    const element = document.createElement('div')
    element.className = 'history-entry'
    element.style.height = `${this.itemHeight}px`
    element.style.position = 'absolute'
    element.style.top = `${index * this.itemHeight}px`
    element.style.width = '100%'

    const description = document.createElement('span')
    description.textContent = entry.command.getDescription()
    element.appendChild(description)

    const timestamp = document.createElement('span')
    timestamp.textContent = new Date(entry.timestamp).toLocaleTimeString()
    timestamp.className = 'timestamp'
    element.appendChild(timestamp)

    // Add click handlers for undo/redo
    element.addEventListener('click', () => {
      this.handleEntryClick(entry, index)
    })

    return element
  }

  private handleEntryClick(entry: HistoryEntry, index: number): void {
    // Navigate to this point in history
    // This would integrate with your history manager
    console.log(`Navigate to history entry ${index}:`, entry.command.getDescription())
  }

  scrollToEntry(index: number): void {
    const targetScrollTop = index * this.itemHeight
    this.container.scrollTop = targetScrollTop
  }

  updateHistory(newHistory: HistoryEntry[]): void {
    this.history = newHistory
    this.totalHeight = newHistory.length * this.itemHeight
    this.updateVisibleRange()
    this.render()
  }
}
```

## Background Processing

### Web Worker-based State Processing

```typescript
// worker.ts - Runs in Web Worker
class WorkerStateProcessor {
  private processingQueue: StateProcessingTask[] = []
  private isProcessing = false

  async processState(task: StateProcessingTask): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      this.processingQueue.push({
        ...task,
        resolve,
        reject
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.processingQueue.length > 0) {
      const task = this.processingQueue.shift()!

      try {
        const result = await this.processTask(task)
        task.resolve(result)
      } catch (error) {
        task.reject(error)
      }
    }

    this.isProcessing = false
  }

  private async processTask(task: StateProcessingTask): Promise<ProcessingResult> {
    switch (task.type) {
      case 'compress_state':
        return this.compressState(task.state)
      case 'calculate_delta':
        return this.calculateDelta(task.oldState, task.newState)
      case 'validate_state':
        return this.validateState(task.state)
      case 'serialize_state':
        return this.serializeState(task.state)
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }
  }

  private async compressState(state: any): Promise<ProcessingResult> {
    // Use compression algorithms
    const jsonString = JSON.stringify(state)
    const compressed = await this.compressString(jsonString)

    return {
      success: true,
      data: compressed,
      originalSize: jsonString.length,
      compressedSize: compressed.length
    }
  }

  private async calculateDelta(oldState: any, newState: any): Promise<ProcessingResult> {
    // Calculate delta between states
    const delta = this.calculateStateDelta(oldState, newState)

    return {
      success: true,
      data: delta
    }
  }

  private async validateState(state: any): Promise<ProcessingResult> {
    // Validate state integrity
    const isValid = this.performStateValidation(state)

    return {
      success: isValid,
      data: { isValid }
    }
  }

  private async serializeState(state: any): Promise<ProcessingResult> {
    // Efficient serialization
    const serialized = this.efficientSerialize(state)

    return {
      success: true,
      data: serialized
    }
  }

  // Compression and utility methods would be implemented here
  private async compressString(data: string): Promise<string> {
    // Use compression library like pako or implement custom compression
    return data // Placeholder
  }

  private calculateStateDelta(oldState: any, newState: any): any {
    // Delta calculation implementation
    return {} // Placeholder
  }

  private performStateValidation(state: any): boolean {
    // Validation logic
    return true // Placeholder
  }

  private efficientSerialize(state: any): string {
    // Efficient serialization implementation
    return JSON.stringify(state) // Placeholder
  }
}

interface StateProcessingTask {
  type: 'compress_state' | 'calculate_delta' | 'validate_state' | 'serialize_state'
  state?: any
  oldState?: any
  newState?: any
  resolve: (result: ProcessingResult) => void
  reject: (error: any) => void
}

interface ProcessingResult {
  success: boolean
  data: any
  originalSize?: number
  compressedSize?: number
}

// Main thread usage
class BackgroundStateManager {
  private worker: Worker

  constructor() {
    this.worker = new Worker('/workers/state-processor.js')
  }

  async compressState(state: any): Promise<ProcessingResult> {
    return this.sendToWorker({
      type: 'compress_state',
      state
    })
  }

  async calculateDelta(oldState: any, newState: any): Promise<ProcessingResult> {
    return this.sendToWorker({
      type: 'calculate_delta',
      oldState,
      newState
    })
  }

  private async sendToWorker(task: Omit<StateProcessingTask, 'resolve' | 'reject'>): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      const messageId = generateId()

      const handleMessage = (event: MessageEvent) => {
        const { id, result, error } = event.data

        if (id === messageId) {
          this.worker.removeEventListener('message', handleMessage)
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }
      }

      this.worker.addEventListener('message', handleMessage)
      this.worker.postMessage({
        id: messageId,
        task
      })
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}
```

## Performance Monitoring

### Real-time Performance Metrics

```typescript
class PerformanceMonitor {
  private metrics = {
    undoTime: [] as number[],
    redoTime: [] as number[],
    memoryUsage: [] as number[],
    operationCount: 0,
    averageUndoTime: 0,
    averageRedoTime: 0,
    peakMemoryUsage: 0
  }

  private observers: PerformanceObserver[] = []

  constructor() {
    this.setupPerformanceObservers()
    this.startMetricsCollection()
  }

  private setupPerformanceObservers(): void {
    // Measure undo/redo performance
    if ('PerformanceObserver' in window) {
      const undoRedoObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.startsWith('undo:')) {
            this.recordUndoTime(entry.duration)
          } else if (entry.name.startsWith('redo:')) {
            this.recordRedoTime(entry.duration)
          }
        }
      })

      undoRedoObserver.observe({ entryTypes: ['measure'] })
      this.observers.push(undoRedoObserver)

      // Monitor memory usage
      const memoryObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'memory') {
            this.recordMemoryUsage((entry as PerformanceEntry & any).usedJSHeapSize)
          }
        }
      })

      memoryObserver.observe({ entryTypes: ['memory'] })
      this.observers.push(memoryObserver)
    }
  }

  startUndoMeasure(operationId: string): void {
    performance.mark(`undo:start:${operationId}`)
  }

  endUndoMeasure(operationId: string): void {
    performance.mark(`undo:end:${operationId}`)
    performance.measure(`undo:${operationId}`, `undo:start:${operationId}`, `undo:end:${operationId}`)
  }

  startRedoMeasure(operationId: string): void {
    performance.mark(`redo:start:${operationId}`)
  }

  endRedoMeasure(operationId: string): void {
    performance.mark(`redo:end:${operationId}`)
    performance.measure(`redo:${operationId}`, `redo:start:${operationId}`, `redo:end:${operationId}`)
  }

  private recordUndoTime(duration: number): void {
    this.metrics.undoTime.push(duration)
    this.metrics.operationCount++

    // Keep only last 100 measurements
    if (this.metrics.undoTime.length > 100) {
      this.metrics.undoTime.shift()
    }

    this.updateAverages()
  }

  private recordRedoTime(duration: number): void {
    this.metrics.redoTime.push(duration)

    // Keep only last 100 measurements
    if (this.metrics.redoTime.length > 100) {
      this.metrics.redoTime.shift()
    }

    this.updateAverages()
  }

  private recordMemoryUsage(usage: number): void {
    this.metrics.memoryUsage.push(usage)
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, usage)

    // Keep only last 100 measurements
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift()
    }
  }

  private updateAverages(): void {
    if (this.metrics.undoTime.length > 0) {
      this.metrics.averageUndoTime = this.metrics.undoTime.reduce((a, b) => a + b, 0) / this.metrics.undoTime.length
    }

    if (this.metrics.redoTime.length > 0) {
      this.metrics.averageRedoTime = this.metrics.redoTime.reduce((a, b) => a + b, 0) / this.metrics.redoTime.length
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMemoryMetrics()
    }, 5000) // Collect every 5 seconds
  }

  private collectMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.recordMemoryUsage(memory.usedJSHeapSize)
    }
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics }
  }

  getPerformanceReport(): PerformanceReport {
    return {
      averageUndoTime: this.metrics.averageUndoTime,
      averageRedoTime: this.metrics.averageRedoTime,
      totalOperations: this.metrics.operationCount,
      peakMemoryUsage: this.metrics.peakMemoryUsage,
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      undoTimeDistribution: this.getTimeDistribution(this.metrics.undoTime),
      redoTimeDistribution: this.getTimeDistribution(this.metrics.redoTime),
      recommendations: this.generateRecommendations()
    }
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private getTimeDistribution(times: number[]): TimeDistribution {
    if (times.length === 0) {
      return { fast: 0, medium: 0, slow: 0 }
    }

    const sorted = [...times].sort((a, b) => a - b)
    const p33 = sorted[Math.floor(sorted.length * 0.33)]
    const p66 = sorted[Math.floor(sorted.length * 0.66)]

    return {
      fast: times.filter(t => t <= p33).length,
      medium: times.filter(t => t > p33 && t <= p66).length,
      slow: times.filter(t => t > p66).length
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.averageUndoTime > 100) {
      recommendations.push('Consider optimizing undo operations - average time exceeds 100ms')
    }

    if (this.metrics.averageRedoTime > 100) {
      recommendations.push('Consider optimizing redo operations - average time exceeds 100ms')
    }

    if (this.metrics.peakMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected - consider implementing state compression')
    }

    const recentMemoryGrowth = this.getRecentMemoryGrowth()
    if (recentMemoryGrowth > 10 * 1024 * 1024) { // 10MB growth
      recommendations.push('Memory usage is growing rapidly - implement cleanup strategies')
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable ranges')
    }

    return recommendations
  }

  private getRecentMemoryGrowth(): number {
    const recent = this.metrics.memoryUsage.slice(-10) // Last 10 measurements
    if (recent.length < 2) return 0

    const oldest = recent[0]
    const newest = recent[recent.length - 1]
    return newest - oldest
  }

  dispose(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

interface PerformanceReport {
  averageUndoTime: number
  averageRedoTime: number
  totalOperations: number
  peakMemoryUsage: number
  currentMemoryUsage: number
  undoTimeDistribution: TimeDistribution
  redoTimeDistribution: TimeDistribution
  recommendations: string[]
}

interface TimeDistribution {
  fast: number
  medium: number
  slow: number
}
```

This performance optimization documentation provides comprehensive strategies for implementing efficient, scalable undo/redo systems that can handle large state trees while maintaining excellent performance and memory efficiency.