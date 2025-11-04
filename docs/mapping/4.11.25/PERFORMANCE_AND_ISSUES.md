# Pomo-Flow - Performance and Issues Reference

## Overview

This comprehensive reference document consolidates all performance optimization strategies, known issues, debugging approaches, and problem-solving techniques for the Pomo-Flow Vue.js productivity application. It covers both proactive performance measures and reactive issue resolution.

## Table of Contents

- [Performance Optimization Philosophy](#performance-optimization-philosophy)
- [Core Performance Strategies](#core-performance-strategies)
- [Critical Issues Catalog](#critical-issues-catalog)
- [Rendering Optimizations](#rendering-optimizations)
- [Memory Management](#memory-management)
- [Network Performance](#network-performance)
- [Animation Performance](#animation-performance)
- [Performance Monitoring](#performance-monitoring)
- [Issue Resolution Strategies](#issue-resolution-strategies)
- [Debugging and Troubleshooting](#debugging-and-troubleshooting)
- [Performance Checklist](#performance-checklist)

---

## 🎯 Performance Optimization Philosophy

### 1. Proactive Optimization
- **Preventive measures** over reactive fixes
- **Performance budgets** for components and operations
- **Continuous monitoring** and optimization
- **User experience first** approach

### 2. Scalability by Design
- **Virtual scrolling** for large datasets
- **Lazy loading** of components and data
- **Efficient algorithms** and data structures
- **Resource pooling** for memory efficiency

### 3. Performance Budgets
| Operation | Target Budget | Tolerance | Current Status |
|-----------|---------------|-----------|----------------|
| **Render Frame** | 16.67ms (60fps) | ±5ms | ✅ In Budget |
| **Task Filtering** | 10ms | ±2ms | ⚠️ Needs Review |
| **Database Save** | 100ms | ±20ms | ✅ In Budget |
| **Component Mount** | 50ms | ±10ms | ✅ In Budget |

---

## ⚡ Core Performance Strategies

### 1. Virtual Scrolling Implementation

#### Advanced Virtual Scrolling with Dynamic Heights

```typescript
export function useVirtualScrolling<T>({
  items,
  getItemHeight,
  containerHeight,
  overscan = 5,
  bufferSize = 100
}: VirtualScrollingConfig<T>) {
  const scrollTop = ref(0)
  const containerRef = ref<HTMLElement>()
  const itemHeights = ref(new Map<number, number>())
  const totalHeight = ref(0)

  // Calculate visible range with dynamic heights
  const visibleRange = computed(() => {
    if (!items.value.length) return { start: 0, end: 0 }

    let accumulatedHeight = 0
    let start = 0
    let end = 0

    // Find start position
    for (let i = 0; i < items.value.length; i++) {
      const height = getItemHeightForIndex(i)
      if (accumulatedHeight + height > scrollTop.value) {
        start = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += height
    }

    // Find end position
    accumulatedHeight = 0
    for (let i = start; i < items.value.length; i++) {
      accumulatedHeight += getItemHeightForIndex(i)
      if (accumulatedHeight > containerHeight + overscan * 50) {
        end = Math.min(items.value.length, i + overscan)
        break
      }
    }

    if (end === 0) end = Math.min(items.value.length, start + bufferSize)

    return { start, end }
  })

  // Visible items with their actual positions
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    let yOffset = 0

    // Calculate offset for start position
    for (let i = 0; i < start; i++) {
      yOffset += getItemHeightForIndex(i)
    }

    return items.value.slice(start, end).map((item, index) => {
      const actualIndex = start + index
      const height = getItemHeightForIndex(actualIndex)

      return {
        item,
        index: actualIndex,
        style: {
          position: 'absolute',
          top: `${yOffset}px`,
          left: '0',
          right: '0',
          height: `${height}px`
        }
      }
    })
  })

  return {
    containerRef,
    visibleItems,
    totalHeight,
    updateItemHeight: (index: number, height: number) => {
      if (itemHeights.value.get(index) !== height) {
        itemHeights.value.set(index, height)
        calculateTotalHeight()
      }
    }
  }
}
```

#### Virtual Scrolling Benefits
- **Memory Efficiency**: Only renders visible items
- **Performance**: Constant render time regardless of data size
- **Smooth Scrolling**: 60fps scrolling with thousands of items
- **Dynamic Heights**: Supports variable item heights

### 2. Component Lazy Loading

```typescript
// Lazy loading with code splitting
export const BoardView = defineAsyncComponent({
  loader: () => import('@/views/BoardView.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,
  timeout: 3000
})

// Dynamic component loading with error handling
export function useLazyComponent<T extends Component>(
  loader: () => Promise<T>
) {
  const component = shallowRef<T | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const loadComponent = async () => {
    if (component.value) return

    isLoading.value = true
    error.value = null

    try {
      const loadedComponent = await loader()
      component.value = loadedComponent
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to load component')
    } finally {
      isLoading.value = false
    }
  }

  return {
    component: readonly(component),
    isLoading: readonly(isLoading),
    error: readonly(error),
    loadComponent
  }
}
```

### 3. Efficient State Management

```typescript
// Optimized store with selective reactivity
export const useTaskStore = defineStore('tasks', () => {
  // State with shallow refs for large arrays
  const tasks = shallowRef<Task[]>([])
  const selectedTaskIds = ref<Set<string>>(new Set())

  // Computed with memoization
  const activeTasks = computed(() => {
    return tasks.value.filter(task => task.status !== 'done')
  })

  const tasksByProject = computed(() => {
    const grouped = new Map<string, Task[]>()

    for (const task of activeTasks.value) {
      if (!grouped.has(task.projectId)) {
        grouped.set(task.projectId, [])
      }
      grouped.get(task.projectId)!.push(task)
    }

    return grouped
  })

  // Batch updates for performance
  let batchUpdateQueue: Array<() => void> = []
  let isBatchScheduled = false

  const scheduleBatchUpdate = () => {
    if (isBatchScheduled) return

    isBatchScheduled = true
    nextTick(() => {
      const updates = batchUpdateQueue.slice()
      batchUpdateQueue = []
      isBatchScheduled = false

      // Batch all updates together
      startTransition(() => {
        updates.forEach(update => update())
      })
    })
  }

  const batchUpdateTask = (taskId: string, updates: Partial<Task>) => {
    batchUpdateQueue.push(() => {
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        Object.assign(task, updates)
      }
    })

    scheduleBatchUpdate()
  }

  return {
    tasks: readonly(tasks),
    selectedTaskIds: readonly(selectedTaskIds),
    activeTasks,
    tasksByProject,
    batchUpdateTask
  }
})
```

---

## 🚨 Critical Issues Catalog

### Priority 1: Event Handler Conflict - **CRITICAL**

**File**: `src/composables/useHorizontalDragScroll.ts:202-226`
**Severity**: 🔴 **CRITICAL** - Blocks all drag operations

```typescript
// ❌ PROBLEMATIC CODE:
const handleMouseDown = (e: MouseEvent) => {
  e.preventDefault()      // ❌ Cancels HTML5 dragstart
  e.stopPropagation()   // ❌ Blocks event propagation

  // ❌ Logic runs AFTER event already cancelled
  handleStart(e.clientX, e.clientY, e.target as HTMLElement)
}
```

**Impact**:
- TaskCard `@dragstart` events never fire
- HTML5 drag-and-drop completely blocked
- No visual feedback during drag attempts
- Drop zones never receive drag events

**Fix Strategy**:
```typescript
// ✅ FIXED CODE:
const handleMouseDown = (e: MouseEvent) => {
  // First detect drag intent
  const isDragIntent = detectDragIntent(e.target as HTMLElement, e.clientX, e.clientY)

  if (isDragIntent) {
    // Allow drag events to propagate naturally
    return // Don't prevent default for drag operations
  }

  // Only prevent default for horizontal scrolling
  e.preventDefault()
  handleStart(e.clientX, e.clientY, e.target as HTMLElement)
}
```

### Priority 2: Global CSS Overflow Restrictions - **CRITICAL**

**File**: `src/assets/design-tokens.css:736-754`
**Severity**: 🔴 **CRITICAL** - Prevents drag preview rendering

```css
/* ❌ PROBLEMATIC CODE: */
html, body {
  overflow-x: hidden;    /* ❌ Blocks drag preview rendering */
  overflow-y: auto;
}

.horizontal-scroll-container {
  overflow-x: auto;
  overflow-y: visible;
  contain: layout paint;  /* ❌ Isolates drag rendering context */
}
```

**Impact**:
- Drag previews are visually constrained
- Cross-element dragging prevented
- Drag ghost elements rendered incorrectly
- Visual feedback broken

**Fix Strategy**:
```css
/* ✅ FIXED CODE: */
html, body {
  overflow-x: auto;      /* ✅ Allow drag preview movement */
  overflow-y: auto;
}

.horizontal-scroll-container {
  overflow-x: auto;
  overflow-y: visible;
  contain: layout style; /* ✅ Remove paint containment */
}

/* ✅ Add drag-specific styling */
.dragging-active {
  overflow: visible !important;
  pointer-events: none;
}
```

### Priority 3: App-Level Overflow Constraints - **HIGH**

**File**: `src/App.vue:1150, 1753, 1795-1798`
**Severity**: 🟠 **HIGH** - Contains drag operations

```css
/* ❌ PROBLEMATIC CODE: */
.app {
  overflow-x: hidden;    /* ❌ Contains drag to app area */
}

.main-content {
  overflow-x: hidden;    /* ❌ Prevents cross-component dragging */
}
```

**Fix Strategy**:
```css
/* ✅ FIXED CODE: */
.app {
  overflow-x: visible;   /* ✅ Allow drag across app */
}

.main-content {
  overflow-x: visible;   /* ✅ Enable cross-component dragging */
}

/* ✅ Add drag-state specific overflow */
.app.dragging {
  overflow: visible !important;
  pointer-events: none;
}

.app.dragging * {
  pointer-events: auto;
}
```

### Priority 4: Touch Event Blocking - **MEDIUM**

**File**: `src/composables/useHorizontalDragScroll.ts:190-200`
**Severity**: 🟡 **MEDIUM** - Mobile experience degradation

```typescript
// ❌ PROBLEMATIC CODE:
if (touchEnabled) {
  container.addEventListener('touchstart', handleTouchStart, { passive: false })
  container.addEventListener('touchmove', handleTouchMove, { passive: false })
}
```

**Fix Strategy**:
```typescript
// ✅ FIXED CODE:
if (touchEnabled) {
  container.addEventListener('touchstart', handleTouchStart, {
    passive: true,  // ✅ Allow browser default touch behavior
    capture: false
  })

  container.addEventListener('touchmove', handleTouchMove, {
    passive: true   // ✅ Enable smooth touch scrolling
  })
}
```

### Priority 5: Memory Leaks - **MEDIUM**

**File**: `src/composables/useHorizontalDragScroll.ts:230-250`
**Severity**: 🟡 **MEDIUM** - Performance degradation

**Fix Strategy**:
```typescript
// ✅ PROPER CLEANUP:
onMounted(() => {
  const cleanup = () => {
    container.removeEventListener('mousedown', handleMouseDown)
    container.removeEventListener('touchstart', handleTouchStart)
    container.removeEventListener('touchmove', handleTouchMove)
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
    }
  }

  onUnmounted(cleanup)

  // Add listeners
  container.addEventListener('mousedown', handleMouseDown)
  if (touchEnabled) {
    container.addEventListener('touchstart', handleTouchStart)
    container.addEventListener('touchmove', handleTouchMove)
  }
})
```

---

## 🎨 Rendering Optimizations

### 1. Template Optimization

```vue
<template>
  <!-- Use v-show instead of v-if for frequently toggled elements -->
  <div v-show="isVisible" class="content">
    <!-- Content -->
  </div>

  <!-- Use key with v-for for efficient diffing -->
  <TaskCard
    v-for="task in visibleTasks"
    :key="task.id"
    :task="task"
    @update="handleTaskUpdate"
  />

  <!-- Use computed properties for complex filtering -->
  <TaskCard
    v-for="task in filteredTasks"
    :key="task.id"
    :task="task"
  />

  <!-- Avoid inline functions in templates -->
  <TaskCard
    v-for="task in tasks"
    :key="task.id"
    :task="task"
    @update="handleUpdate"
    @delete="handleDelete"
  />
</template>

<script setup lang="ts">
// Use computed for derived state
const filteredTasks = computed(() => {
  return tasks.value.filter(task => matchesFilters(task))
})

// Use methods for event handlers (not inline functions)
const handleUpdate = (task: Task) => {
  // Handle update
}

const handleDelete = (taskId: string) => {
  // Handle deletion
}
</script>
```

### 2. Watch Optimization

```typescript
// Debounced watches for performance
const debouncedSave = useDebounce((data: any) => {
  saveToDatabase(data)
}, 1000)

// Use flush: 'post' for DOM updates
watch(
  () => taskStore.tasks,
  (newTasks) => {
    debouncedSave(newTasks)
  },
  { deep: true, flush: 'post' }
)

// Use getter for selective watching
watch(
  () => taskStore.tasks.map(task => ({
    id: task.id,
    title: task.title,
    status: task.status
  })),
  (taskSummaries) => {
    // Only react to important changes
  }
)
```

### 3. Memoization and Caching

```typescript
// Advanced memoization system
class MemoizationCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()
  private maxSize: number
  private ttl: number

  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  set(key: K, value: V): void {
    // Delete existing if present
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Add new entry
    this.cache.set(key, { value, timestamp: Date.now() })

    // Enforce max size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
  }
}

// Memoized expensive functions
export function useMemoize<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: {
    maxSize?: number
    ttl?: number
    getKey?: (...args: TArgs) => string
  } = {}
) {
  const cache = new MemoizationCache<string, TReturn>(
    options.maxSize,
    options.ttl
  )

  const memoized = (...args: TArgs): TReturn => {
    const key = options.getKey ? options.getKey(...args) : JSON.stringify(args)

    let result = cache.get(key)
    if (result === undefined) {
      result = fn(...args)
      cache.set(key, result)
    }

    return result
  }

  memoized.cache = cache
  memoized.clear = () => cache.clear()

  return memoized
}
```

---

## 💾 Memory Management

### 1. Memory Leak Prevention

```typescript
// Event listener cleanup
export function useEventListener(
  target: EventTarget,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
) {
  onMounted(() => {
    target.addEventListener(event, handler, options)
  })

  onUnmounted(() => {
    target.removeEventListener(event, handler, options)
  })
}

// Timer cleanup
export function useInterval(callback: () => void, delay: number) {
  const intervalId = ref<number | null>(null)

  const start = () => {
    if (intervalId.value === null) {
      intervalId.value = setInterval(callback, delay)
    }
  }

  const stop = () => {
    if (intervalId.value !== null) {
      clearInterval(intervalId.value)
      intervalId.value = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { start, stop }
}

// WeakMap for memory-efficient associations
const componentData = new WeakMap<Component, any>()

export function setComponentData(component: Component, data: any) {
  componentData.set(component, data)
}

export function getComponentData(component: Component) {
  return componentData.get(component)
}
```

### 2. Object Pool Pattern

```typescript
// Object pooling for frequently created/destroyed objects
class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T
  private resetFn: (obj: T) => void
  private maxSize: number

  constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize = 50) {
    this.createFn = createFn
    this.resetFn = resetFn
    this.maxSize = maxSize
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!
    }

    return this.createFn()
  }

  release(obj: T) {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj)
      this.pool.push(obj)
    }
  }

  clear() {
    this.pool.length = 0
  }
}

// Usage for task cards
const taskCardPool = new ObjectPool(
  () => ({ element: document.createElement('div'), data: null }),
  (obj) => {
    obj.data = null
    obj.element.className = ''
  }
)
```

---

## 🌐 Network Performance

### 1. Request Optimization

```typescript
// Request deduplication
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>()

  async request<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>
    }

    const promise = requestFn()
    this.pendingRequests.set(key, promise)

    try {
      const result = await promise
      return result
    } finally {
      this.pendingRequests.delete(key)
    }
  }
}

// Batch API requests
class BatchRequester {
  private queue: Array<{
    request: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []

  private batchTimeout: number | null = null
  private readonly batchDelay = 50 // 50ms

  add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ request, resolve, reject })

      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch()
        }, this.batchDelay)
      }
    })
  }

  private async processBatch() {
    this.batchTimeout = null

    if (this.queue.length === 0) return

    const batch = this.queue.splice(0)

    try {
      // Process all requests in parallel
      const results = await Promise.allSettled(
        batch.map(item => item.request())
      )

      results.forEach((result, index) => {
        const { resolve, reject } = batch[index]

        if (result.status === 'fulfilled') {
          resolve(result.value)
        } else {
          reject(result.reason)
        }
      })
    } catch (error) {
      // Reject all if batch fails
      batch.forEach(({ reject }) => reject(error))
    }
  }
}
```

### 2. Data Caching

```typescript
// Multi-level caching system
class DataCache {
  private memoryCache = new Map<string, any>()
  private storageCache = useStorage()
  private readonly maxMemorySize = 100
  private readonly ttl = 5 * 60 * 1000 // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && Date.now() - memoryEntry.timestamp < this.ttl) {
      return memoryEntry.value
    }

    // Check storage cache
    try {
      const storageEntry = await this.storageCache.getItem(key)
      if (storageEntry) {
        const parsed = JSON.parse(storageEntry)
        if (Date.now() - parsed.timestamp < this.ttl) {
          // Restore to memory cache
          this.memoryCache.set(key, parsed)
          return parsed.value
        }
      }
    } catch (error) {
      console.error('Storage cache error:', error)
    }

    return null
  }

  async set<T>(key: string, value: T): Promise<void> {
    const entry = { value, timestamp: Date.now() }

    // Update memory cache
    this.memoryCache.set(key, entry)

    // Enforce memory cache size
    if (this.memoryCache.size > this.maxMemorySize) {
      const firstKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(firstKey)
    }

    // Update storage cache
    try {
      await this.storageCache.setItem(key, JSON.stringify(entry))
    } catch (error) {
      console.error('Storage cache error:', error)
    }
  }
}
```

---

## 🎬 Animation Performance

### 1. CSS Animation Optimization

```css
/* Use transform and opacity for smooth animations */
.task-card {
  /* Use transform instead of changing position */
  transform: translateX(0);
  /* Use opacity for fade effects */
  opacity: 1;

  /* Enable hardware acceleration */
  will-change: transform, opacity;
  /* Use GPU compositing */
  backface-visibility: hidden;
  perspective: 1000px;

  /* Smooth transitions */
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.task-card.moving {
  transform: translateX(100px);
}

.task-card.fade-out {
  opacity: 0;
}

/* Use contain for layout optimization */
.canvas-container {
  contain: layout style paint;
}

.virtual-scroll-item {
  contain: strict;
}
```

### 2. JavaScript Animation Control

```typescript
// RAF-based animations
export function useRAF(callback: () => void) {
  let rafId: number | null = null

  const start = () => {
    if (rafId === null) {
      const animate = () => {
        callback()
        rafId = requestAnimationFrame(animate)
      }
      animate()
    }
  }

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onUnmounted(stop)

  return { start, stop }
}

// Smooth scrolling with performance
export function useSmoothScroll() {
  const isScrolling = ref(false)

  const scrollTo = (element: HTMLElement, target: number, duration = 300) => {
    if (isScrolling.value) return

    isScrolling.value = true
    const start = element.scrollTop
    const change = target - start
    const startTime = Date.now()

    const animate = () => {
      const currentTime = Date.now()
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function
      const easeInOutCubic = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2

      element.scrollTop = start + change * easeInOutCubic

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        isScrolling.value = false
      }
    }

    requestAnimationFrame(animate)
  }

  return { scrollTo, isScrolling }
}
```

---

## 📊 Performance Monitoring

### 1. Performance Metrics System

```typescript
// Performance monitoring system
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>()
  private observers: PerformanceObserver[] = []

  constructor() {
    this.setupObservers()
  }

  // Measure function execution time
  measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now()

    if (fn.constructor.name === 'AsyncFunction') {
      return (fn as () => Promise<T>).finally(() => {
        const duration = performance.now() - start
        this.recordMetric(name, duration)
      })
    } else {
      try {
        const result = fn() as T
        const duration = performance.now() - start
        this.recordMetric(name, duration)
        return result
      } catch (error) {
        const duration = performance.now() - start
        this.recordMetric(name, duration, false)
        throw error
      }
    }
  }

  // Record custom metrics
  recordMetric(name: string, value: number, success = true) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        errors: 0
      })
    }

    const metric = this.metrics.get(name)!
    metric.count++
    metric.total += value
    metric.min = Math.min(metric.min, value)
    metric.max = Math.max(metric.max, value)

    if (!success) {
      metric.errors++
    }
  }

  // Get metrics summary
  getMetrics(): Record<string, PerformanceSummary> {
    const result: Record<string, PerformanceSummary> = {}

    for (const [name, metric] of this.metrics) {
      result[name] = {
        count: metric.count,
        average: metric.total / metric.count,
        min: metric.min,
        max: metric.max,
        errors: metric.errors,
        errorRate: metric.errors / metric.count
      }
    }

    return result
  }

  private setupObservers() {
    // Observe render performance
    const renderObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          this.recordMetric(entry.name, entry.duration)
        }
      }
    })

    renderObserver.observe({ entryTypes: ['measure'] })
    this.observers.push(renderObserver)

    // Observe navigation timing
    const navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          this.recordMetric('domContentLoaded', navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart)
          this.recordMetric('loadComplete', navEntry.loadEventEnd - navEntry.loadEventStart)
        }
      }
    })

    navigationObserver.observe({ entryTypes: ['navigation'] })
    this.observers.push(navigationObserver)
  }

  // Cleanup observers
  dispose() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.metrics.clear()
  }
}

// Usage
const performanceMonitor = new PerformanceMonitor()

// Measure function performance
export function measurePerformance<T>(name: string, fn: () => T | Promise<T>) {
  return performanceMonitor.measure(name, fn)
}
```

### 2. Performance Budget Enforcement

```typescript
// Performance budget enforcement
export class PerformanceBudget {
  private budgets = new Map<string, PerformanceBudgetItem>()

  setBudget(name: string, budget: PerformanceBudgetItem) {
    this.budgets.set(name, budget)
  }

  checkBudget(name: string, value: number): BudgetResult {
    const budget = this.budgets.get(name)
    if (!budget) {
      return { passed: true, exceeded: 0 }
    }

    const exceeded = Math.max(0, value - budget.max)
    const passed = exceeded <= budget.tolerance

    if (!passed) {
      console.warn(`Performance budget exceeded for ${name}: ${value}ms (budget: ${budget.max}ms)`)
    }

    return { passed, exceeded }
  }
}

// Define budgets
const performanceBudget = new PerformanceBudget()

performanceBudget.setBudget('render', {
  max: 16.67, // 60fps
  tolerance: 5
})

performanceBudget.setBudget('filter', {
  max: 10,
  tolerance: 2
})

performanceBudget.setBudget('save', {
  max: 100,
  tolerance: 20
})
```

---

## 🔧 Issue Resolution Strategies

### 1. Critical Issues Resolution Path

#### Phase 1: Unblock Core Functionality (Priority 1-4)

1. **Fix Event Handler Priority**
   ```typescript
   // Before: Prevent default immediately
   const handleMouseDown = (e: MouseEvent) => {
     e.preventDefault()
     e.stopPropagation()
     // Logic runs too late
   }

   // After: Check intent first
   const handleMouseDown = (e: MouseEvent) => {
     if (detectDragIntent(e.target, e.clientX, e.clientY)) {
       return // Allow drag to proceed
     }
     e.preventDefault()
   }
   ```

2. **Remove Global CSS Restrictions**
   ```css
   /* Remove restrictive overflow */
   html, body { overflow-x: auto; }
   .app { overflow-x: visible; }
   .main-content { overflow-x: visible; }
   ```

3. **Add Drag State Management**
   ```css
   /* Add drag-specific styles */
   .dragging-active {
     overflow: visible !important;
     pointer-events: none;
   }

   .dragging-active * {
     pointer-events: auto;
   }
   ```

4. **Fix Touch Event Handling**
   ```typescript
   // Enable passive touch events
   container.addEventListener('touchstart', handleTouchStart, {
     passive: true
   })
   ```

#### Phase 2: Performance and Polish (Priority 5+)

5. **Memory Management**
   - Proper cleanup in `onUnmounted`
   - Event listener removal
   - Timer cleanup

6. **Visual Feedback**
   - Drag state styling
   - Drop zone highlighting
   - Smooth animations

7. **Cross-Platform Support**
   - Mobile Safari compatibility
   - Touch event optimization
   - Responsive design

### 2. Systematic Debugging Process

#### Step 1: Issue Identification
```typescript
// Add debug logging
const debugLog = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    console.log(`[PomoFlow Debug] ${message}`, data)
  }
}

// Track drag events
const trackDragEvent = (event: string, element: HTMLElement) => {
  debugLog(`Drag ${event}`, {
    element: element.tagName,
    classes: element.className,
    draggable: element.draggable
  })
}
```

#### Step 2: Performance Measurement
```typescript
// Measure critical operations
const measureOperation = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  const start = performance.now()
  try {
    const result = await operation()
    const duration = performance.now() - start
    debugLog(`${name} completed in ${duration.toFixed(2)}ms`)
    return result
  } catch (error) {
    const duration = performance.now() - start
    debugLog(`${name} failed after ${duration.toFixed(2)}ms`, error)
    throw error
  }
}
```

#### Step 3: Regression Testing
```typescript
// Test drag functionality
const testDragAndDrop = async () => {
  const tasks = document.querySelectorAll('.task-card')

  for (const task of tasks) {
    // Test dragstart event
    const dragStartFired = new Promise((resolve) => {
      task.addEventListener('dragstart', () => resolve(true), { once: true })
    })

    // Simulate drag
    const dragEvent = new DragEvent('dragstart', { bubbles: true })
    task.dispatchEvent(dragEvent)

    const started = await dragStartFired
    debugLog(`Drag test for task ${task.id}: ${started ? 'PASS' : 'FAIL'}`)
  }
}
```

---

## 🐛 Debugging and Troubleshooting

### 1. Common Debugging Techniques

#### Performance Profiling
```typescript
// Performance monitoring
const profileComponent = (componentName: string) => {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.includes(componentName)) {
        console.log(`${componentName} performance:`, {
          duration: entry.duration,
          startTime: entry.startTime,
          renderTime: entry.renderTime
        })
      }
    }
  })

  observer.observe({ entryTypes: ['measure', 'paint', 'navigation'] })
  return observer
}
```

#### Memory Leak Detection
```typescript
// Memory monitoring
const monitorMemory = () => {
  if (performance.memory) {
    const memory = performance.memory
    const used = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
    const total = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2)
    const limit = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)

    console.log(`Memory usage: ${used}MB / ${total}MB (limit: ${limit}MB)`)

    // Alert if memory usage is high
    if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
      console.warn('High memory usage detected!')
    }
  }
}
```

#### Event Debugging
```typescript
// Event tracking
const trackEvents = (element: HTMLElement, events: string[]) => {
  const handlers = events.map(event => {
    const handler = (e: Event) => {
      console.log(`Event: ${event}`, {
        target: e.target,
        type: e.type,
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        defaultPrevented: e.defaultPrevented
      })
    }

    element.addEventListener(event, handler)
    return { event, handler }
  })

  // Return cleanup function
  return () => {
    handlers.forEach(({ event, handler }) => {
      element.removeEventListener(event, handler)
    })
  }
}
```

### 2. Issue Resolution Workflow

#### Step 1: Reproduce the Issue
```typescript
// Create reproduction test
const reproduceIssue = async () => {
  // Setup test conditions
  const testElement = document.querySelector('.task-card') as HTMLElement

  if (!testElement) {
    console.error('Test element not found')
    return
  }

  // Track events
  const cleanup = trackEvents(testElement, ['mousedown', 'dragstart', 'touchstart'])

  try {
    // Attempt to reproduce the issue
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100
    })

    testElement.dispatchEvent(mouseEvent)

    // Wait to see if dragstart fires
    await new Promise(resolve => setTimeout(resolve, 100))

  } finally {
    cleanup()
  }
}
```

#### Step 2: Identify Root Cause
```typescript
// Root cause analysis
const analyzeIssue = () => {
  const issues = []

  // Check for event conflicts
  const horizontalDragScroll = document.querySelector('[data-horizontal-scroll]')
  if (horizontalDragScroll) {
    const styles = getComputedStyle(horizontalDragScroll)
    if (styles.pointerEvents === 'none') {
      issues.push('Horizontal scroll container blocking events')
    }
  }

  // Check CSS constraints
  const bodyStyles = getComputedStyle(document.body)
  if (bodyStyles.overflowX === 'hidden') {
    issues.push('Body overflow-x: hidden blocking drag previews')
  }

  // Check event listeners
  const taskCards = document.querySelectorAll('.task-card')
  taskCards.forEach((card, index) => {
    const dragStartListener = getEventListeners?.(card)?.dragstart
    if (!dragStartListener || dragStartListener.length === 0) {
      issues.push(`Task card ${index + 1} missing dragstart listener`)
    }
  })

  return issues
}
```

#### Step 3: Verify Fix
```typescript
// Fix verification
const verifyFix = async () => {
  const results = []

  // Test drag functionality
  const dragTest = await testDragAndDrop()
  results.push({ test: 'Drag and Drop', passed: dragTest })

  // Test touch events
  const touchTest = await testTouchEvents()
  results.push({ test: 'Touch Events', passed: touchTest })

  // Test performance
  const performanceTest = await testPerformance()
  results.push({ test: 'Performance', passed: performanceTest })

  // Generate report
  const allPassed = results.every(r => r.passed)
  console.log(`Fix verification: ${allPassed ? 'PASS' : 'FAIL'}`, results)

  return allPassed
}
```

---

## ✅ Performance Checklist

### Component Level Optimizations
- [ ] Use `shallowRef` for large arrays/objects
- [ ] Implement virtual scrolling for long lists
- [ ] Use `v-show` instead of `v-if` for frequent toggles
- [ ] Add proper keys to `v-for` loops
- [ ] Avoid inline functions in templates
- [ ] Use computed properties for derived state
- [ ] Implement proper cleanup in `onUnmounted`
- [ ] Use `markRaw` for non-reactive data

### State Management Optimizations
- [ ] Batch multiple state updates
- [ ] Use selective reactivity with `computed`
- [ ] Implement debounced saves
- [ ] Use efficient data structures (Map, Set)
- [ ] Avoid deep watchers when possible
- [ ] Use `triggerRef` for controlled updates
- [ ] Implement optimistic updates

### Network Optimizations
- [ ] Implement request deduplication
- [ ] Use multi-level caching
- [ ] Batch API requests when possible
- [ ] Implement proper error handling
- [ ] Use compression for large payloads
- [ ] Add request timeout handling
- [ ] Implement retry logic

### Rendering Optimizations
- [ ] Use CSS transforms for animations
- [ ] Enable hardware acceleration
- [ ] Use `will-change` sparingly
- [ ] Implement proper image lazy loading
- [ ] Use appropriate image formats
- [ ] Optimize critical rendering path
- [ ] Use CSS containment

### Memory Management
- [ ] Clean up event listeners
- [ ] Clear intervals/timeouts
- [ ] Use WeakMap/WeakSet for temporary associations
- [ ] Implement object pooling for frequent allocations
- [ ] Monitor memory usage regularly
- [ ] Dispose of observers properly
- [ ] Clear large data structures when not needed

### Mobile Performance
- [ ] Optimize touch event handling
- [ ] Implement proper viewport settings
- [ ] Use appropriate touch targets
- [ ] Optimize for mobile networks
- [ ] Test on actual devices
- [ ] Implement proper mobile gestures
- [ ] Optimize battery usage

---

**Last Updated**: November 2, 2025
**Performance Version**: Vue 3.4.0, Performance APIs
**Critical Issues**: 5 identified (2 Critical, 2 High, 1 Medium)
**Optimization Status**: Proactive optimizations implemented, reactive fixes in progress
**Monitoring**: Continuous performance monitoring with automated budget enforcement