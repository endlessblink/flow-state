# Performance Optimizations

Techniques for optimizing conflict resolution performance.

## Performance Characteristics

### Baseline Metrics

| Operation | Target | Typical | Maximum |
|-----------|--------|---------|---------|
| Conflict Detection | <10ms | 5ms | 50ms |
| Field Comparison | <5ms | 2ms | 20ms |
| Auto-Resolution | <20ms | 10ms | 100ms |
| Manual Resolution UI | <100ms | 50ms | 200ms |
| Database Persist | <50ms | 20ms | 200ms |
| Full Flow (auto) | <100ms | 40ms | 300ms |

### Scaling Factors

| Factor | Impact | Notes |
|--------|--------|-------|
| Document Size | Linear | Large docs increase comparison time |
| Field Count | Linear | More fields = more comparisons |
| Nesting Depth | Quadratic | Deep nesting is expensive |
| Array Size | O(n²) | Array comparison scales poorly |
| Concurrent Conflicts | Linear | Queue prevents bottlenecks |

---

## Optimization Strategies

### 1. Lazy Loading

**Problem**: Loading all conflict revisions upfront is expensive.

**Solution**: Load revisions on-demand.

```typescript
class LazyConflictDetector {
  private revisionCache = new Map<string, DocumentVersion>()

  async detectConflict(doc: any): Promise<ConflictInfo | null> {
    // Quick check - no conflicts
    if (!doc._conflicts?.length) {
      return null
    }

    // Load only what's needed
    const localVersion = this.extractVersion(doc)

    // For simple conflicts, only load one remote version
    if (doc._conflicts.length === 1) {
      const remoteVersion = await this.loadVersion(
        doc._id,
        doc._conflicts[0]
      )
      return this.analyzeConflict(localVersion, remoteVersion)
    }

    // For complex conflicts, load all
    return this.analyzeComplexConflict(doc)
  }

  private async loadVersion(
    docId: string,
    rev: string
  ): Promise<DocumentVersion> {
    const cacheKey = `${docId}:${rev}`

    if (!this.revisionCache.has(cacheKey)) {
      const doc = await this.db.get(docId, { rev })
      this.revisionCache.set(cacheKey, this.extractVersion(doc))
    }

    return this.revisionCache.get(cacheKey)!
  }
}
```

### 2. Field-Level Caching

**Problem**: Repeated field comparisons for same documents.

**Solution**: Cache comparison results.

```typescript
class CachedFieldComparator {
  private cache = new Map<string, FieldDifference[]>()

  compare(
    local: Record<string, any>,
    remote: Record<string, any>
  ): FieldDifference[] {
    const cacheKey = this.generateCacheKey(local, remote)

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const differences = this.deepCompare(local, remote)
    this.cache.set(cacheKey, differences)

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    return differences
  }

  private generateCacheKey(local: any, remote: any): string {
    // Use checksums for efficient key generation
    const localChecksum = quickHash(JSON.stringify(local))
    const remoteChecksum = quickHash(JSON.stringify(remote))
    return `${localChecksum}:${remoteChecksum}`
  }
}

function quickHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return hash.toString(36)
}
```

### 3. Incremental Comparison

**Problem**: Full document comparison is expensive for large documents.

**Solution**: Compare incrementally, stopping early when possible.

```typescript
function incrementalCompare(
  local: Record<string, any>,
  remote: Record<string, any>,
  options: { maxDifferences?: number } = {}
): FieldDifference[] {
  const { maxDifferences = Infinity } = options
  const differences: FieldDifference[] = []

  // Compare critical fields first
  const criticalFields = ['id', 'title', 'status']
  for (const field of criticalFields) {
    if (local[field] !== remote[field]) {
      differences.push({
        path: field,
        localValue: local[field],
        remoteValue: remote[field],
        type: 'modified'
      })

      if (differences.length >= maxDifferences) {
        return differences
      }
    }
  }

  // Then compare other fields
  const otherFields = Object.keys(local).filter(
    k => !criticalFields.includes(k) && !k.startsWith('_')
  )

  for (const field of otherFields) {
    if (!deepEqual(local[field], remote[field])) {
      differences.push({
        path: field,
        localValue: local[field],
        remoteValue: remote[field],
        type: 'modified'
      })

      if (differences.length >= maxDifferences) {
        return differences
      }
    }
  }

  return differences
}
```

### 4. Batch Processing

**Problem**: Processing many conflicts sequentially blocks the UI.

**Solution**: Process in batches with yielding.

```typescript
async function processBatch(
  conflicts: ConflictInfo[],
  options: { batchSize?: number; yieldInterval?: number } = {}
): Promise<ResolutionResult[]> {
  const { batchSize = 10, yieldInterval = 16 } = options
  const results: ResolutionResult[] = []

  for (let i = 0; i < conflicts.length; i += batchSize) {
    const batch = conflicts.slice(i, i + batchSize)

    // Process batch
    const batchResults = await Promise.all(
      batch.map(c => resolveConflict(c))
    )
    results.push(...batchResults)

    // Yield to event loop
    await new Promise(resolve => setTimeout(resolve, yieldInterval))

    // Report progress
    onProgress?.((i + batch.length) / conflicts.length)
  }

  return results
}
```

### 5. Web Worker Offloading

**Problem**: Heavy computation blocks main thread.

**Solution**: Offload to Web Worker.

```typescript
// conflict-worker.ts
self.onmessage = async (event) => {
  const { type, payload } = event.data

  switch (type) {
    case 'detect':
      const conflict = detectConflict(payload.doc)
      self.postMessage({ type: 'detected', payload: conflict })
      break

    case 'resolve':
      const result = resolveConflict(payload.conflict, payload.strategy)
      self.postMessage({ type: 'resolved', payload: result })
      break
  }
}

// Main thread usage
class WorkerConflictProcessor {
  private worker = new Worker('conflict-worker.js')
  private pending = new Map<string, (result: any) => void>()

  constructor() {
    this.worker.onmessage = (event) => {
      const { type, payload, id } = event.data
      const resolver = this.pending.get(id)
      if (resolver) {
        resolver(payload)
        this.pending.delete(id)
      }
    }
  }

  async detect(doc: any): Promise<ConflictInfo | null> {
    return this.send('detect', { doc })
  }

  async resolve(
    conflict: ConflictInfo,
    strategy: ResolutionType
  ): Promise<ResolutionResult> {
    return this.send('resolve', { conflict, strategy })
  }

  private send<T>(type: string, payload: any): Promise<T> {
    const id = crypto.randomUUID()
    return new Promise(resolve => {
      this.pending.set(id, resolve)
      this.worker.postMessage({ type, payload, id })
    })
  }
}
```

### 6. Debounced Conflict Processing

**Problem**: Rapid sync events cause redundant processing.

**Solution**: Debounce conflict detection.

```typescript
class DebouncedConflictHandler {
  private pending = new Map<string, NodeJS.Timeout>()
  private debounceMs = 100

  handleDocument(doc: any) {
    const docId = doc._id

    // Clear existing timer
    if (this.pending.has(docId)) {
      clearTimeout(this.pending.get(docId))
    }

    // Set new timer
    this.pending.set(docId, setTimeout(async () => {
      this.pending.delete(docId)
      await this.processDocument(doc)
    }, this.debounceMs))
  }

  private async processDocument(doc: any) {
    // Get latest version
    const latestDoc = await this.db.get(doc._id, { conflicts: true })

    if (latestDoc._conflicts?.length) {
      const conflict = await this.detector.detectConflict(latestDoc)
      if (conflict) {
        this.emit('conflict', conflict)
      }
    }
  }
}
```

### 7. Virtual Scrolling for UI

**Problem**: Rendering many conflicts in UI is slow.

**Solution**: Virtual scrolling.

```vue
<template>
  <div
    ref="container"
    class="conflict-list"
    @scroll="onScroll"
    :style="{ height: `${containerHeight}px` }"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="item in visibleItems"
        :key="item.id"
        :style="{
          position: 'absolute',
          top: `${item.offset}px`,
          height: `${itemHeight}px`
        }"
      >
        <ConflictItem :conflict="item.conflict" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const itemHeight = 80
const bufferCount = 5

const visibleItems = computed(() => {
  const scrollTop = scrollPosition.value
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferCount)
  const endIndex = Math.min(
    conflicts.value.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferCount
  )

  return conflicts.value.slice(startIndex, endIndex).map((conflict, i) => ({
    id: conflict.id,
    conflict,
    offset: (startIndex + i) * itemHeight
  }))
})

const totalHeight = computed(() => conflicts.value.length * itemHeight)
</script>
```

---

## Memory Optimization

### Object Pooling

```typescript
class ConflictInfoPool {
  private pool: ConflictInfo[] = []
  private maxSize = 100

  acquire(): ConflictInfo {
    return this.pool.pop() || this.createNew()
  }

  release(info: ConflictInfo) {
    if (this.pool.length < this.maxSize) {
      this.reset(info)
      this.pool.push(info)
    }
  }

  private createNew(): ConflictInfo {
    return {
      id: '',
      documentId: '',
      type: ConflictType.EDIT_EDIT,
      localVersion: { rev: '', data: {}, updatedAt: 0 },
      remoteVersion: { rev: '', data: {}, updatedAt: 0 },
      conflictingFields: [],
      severity: 'low',
      detectedAt: 0,
      canAutoResolve: false
    }
  }

  private reset(info: ConflictInfo) {
    info.id = ''
    info.documentId = ''
    info.conflictingFields.length = 0
    // ... reset other fields
  }
}
```

### WeakMap for Metadata

```typescript
// Use WeakMap to avoid memory leaks
const conflictMetadata = new WeakMap<object, ConflictMetadata>()

function attachMetadata(doc: any, metadata: ConflictMetadata) {
  conflictMetadata.set(doc, metadata)
}

function getMetadata(doc: any): ConflictMetadata | undefined {
  return conflictMetadata.get(doc)
}
// Metadata is automatically garbage collected when doc is
```

---

## Monitoring and Metrics

### Performance Tracking

```typescript
class ConflictMetrics {
  private metrics = {
    detectionTime: [] as number[],
    resolutionTime: [] as number[],
    conflictCount: 0,
    autoResolvedCount: 0,
    manualResolvedCount: 0
  }

  recordDetection(startTime: number) {
    const duration = performance.now() - startTime
    this.metrics.detectionTime.push(duration)
    this.trimMetrics()
  }

  recordResolution(startTime: number, wasAuto: boolean) {
    const duration = performance.now() - startTime
    this.metrics.resolutionTime.push(duration)

    if (wasAuto) {
      this.metrics.autoResolvedCount++
    } else {
      this.metrics.manualResolvedCount++
    }

    this.trimMetrics()
  }

  getStats() {
    return {
      avgDetectionTime: average(this.metrics.detectionTime),
      avgResolutionTime: average(this.metrics.resolutionTime),
      p95DetectionTime: percentile(this.metrics.detectionTime, 95),
      p95ResolutionTime: percentile(this.metrics.resolutionTime, 95),
      autoResolveRate: this.metrics.autoResolvedCount /
        (this.metrics.autoResolvedCount + this.metrics.manualResolvedCount)
    }
  }

  private trimMetrics() {
    const maxSamples = 1000
    if (this.metrics.detectionTime.length > maxSamples) {
      this.metrics.detectionTime = this.metrics.detectionTime.slice(-maxSamples)
    }
    if (this.metrics.resolutionTime.length > maxSamples) {
      this.metrics.resolutionTime = this.metrics.resolutionTime.slice(-maxSamples)
    }
  }
}
```

---

## Best Practices Summary

| Category | Practice | Impact |
|----------|----------|--------|
| Loading | Lazy load revisions | -60% initial load |
| Caching | Cache comparisons | -40% repeat operations |
| Comparison | Early termination | -30% comparison time |
| Processing | Batch with yields | +100% UI responsiveness |
| Threading | Web Worker | +80% main thread availability |
| Events | Debounce handlers | -50% redundant processing |
| UI | Virtual scrolling | -90% render time for large lists |
| Memory | Object pooling | -30% GC pressure |

---

## See Also

- [Conflict Detection](./conflict-detection.md) - Detection algorithms
- [Resolution Algorithms](./resolution-algorithms.md) - Resolution strategies
- [Data Flow](./data-flow.md) - End-to-end flow
