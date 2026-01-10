# Advanced Debugging Techniques

## Reactivity Debugging

### Vue DevTools Pro Tips

1. **Component Timeline**: Use the timeline view to see when components render and why
2. **State Inspection**: Examine component state and props in real-time
3. **Event Debugging**: Track emitted events and their handlers
4. **Performance Profiling**: Identify slow components and operations

### Console Debugging Strategies

```javascript
// Debug reactivity chains
const debugComputedChain = (computedRef, label) => {
  let oldValue = computedRef.value
  console.log(`${label} initial:`, oldValue)

  const stopWatcher = watch(computedRef, (newValue) => {
    console.log(`${label} changed:`, oldValue, '→', newValue)
    oldValue = newValue
  }, { immediate: true })

  return stopWatcher
}

// Debug array reactivity issues
const debugArrayReactivity = (arrayRef, label) => {
  const originalMethods = {
    push: arrayRef.value.push,
    pop: arrayRef.value.pop,
    splice: arrayRef.value.splice
  }

  arrayRef.value.push = function(...args) {
    console.log(`${label}.push called with:`, args)
    const result = originalMethods.push.apply(this, args)
    console.log(`${label} after push:`, this)
    return result
  }

  // Patch other array methods similarly...
}

// Debug object property access
const debugObjectAccess = (obj, label) => {
  return new Proxy(obj, {
    get(target, prop) {
      console.log(`${label} accessing property:`, prop)
      return target[prop]
    },
    set(target, prop, value) {
      console.log(`${label} setting property:`, prop, '=', value)
      target[prop] = value
      return true
    }
  })
}
```

## Memory Leak Detection

### Component Lifecycle Tracking

```javascript
const componentTracker = {
  components: new Map(),

  track(component, name) {
    const id = Math.random().toString(36).substr(2, 9)
    this.components.set(id, { component, name, createdAt: Date.now() })

    console.log(`📦 Component tracked: ${name} (${id})`)

    // Auto-cleanup
    onUnmounted(() => {
      this.components.delete(id)
      console.log(`🗑️ Component unmounted: ${name} (${id})`)
    })

    return id
  },

  getActiveComponents() {
    return Array.from(this.components.values())
  },

  findLeaks(maxAge = 60000) {
    const now = Date.now()
    return this.getActiveComponents().filter(comp =>
      now - comp.createdAt > maxAge
    )
  }
}
```

### Subscription Management

```javascript
const subscriptionManager = {
  subscriptions: new Set(),

  add(unsubscribe, description) {
    this.subscriptions.add({ unsubscribe, description, createdAt: Date.now() })
    console.log(`➕ Subscription added: ${description}`)

    return () => {
      this.subscriptions.delete(unsubscribe)
      unsubscribe()
      console.log(`➖ Subscription removed: ${description}`)
    }
  },

  cleanup() {
    this.subscriptions.forEach(({ unsubscribe, description }) => {
      console.warn(`🧹 Cleaning up leaked subscription: ${description}`)
      unsubscribe()
    })
    this.subscriptions.clear()
  },

  getStats() {
    return {
      count: this.subscriptions.size,
      subscriptions: Array.from(this.subscriptions)
    }
  }
}
```

## Performance Analysis

### Render Performance Debugging

```javascript
const performanceProfiler = {
  measurements: [],

  start(label) {
    const id = Math.random().toString(36).substr(2, 9)
    performance.mark(`${label}-start-${id}`)

    return {
      end: () => {
        performance.mark(`${label}-end-${id}`)
        performance.measure(`${label}-${id}`, `${label}-start-${id}`, `${label}-end-${id}`)

        const measure = performance.getEntriesByName(`${label}-${id}`)[0]
        this.measurements.push({
          label,
          duration: measure.duration,
          timestamp: Date.now()
        })

        console.log(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`)

        return measure.duration
      }
    }
  },

  getSlowOperations(threshold = 16) {
    return this.measurements
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
  },

  getAverage(label) {
    const measurements = this.measurements.filter(m => m.label === label)
    if (measurements.length === 0) return 0

    const total = measurements.reduce((sum, m) => sum + m.duration, 0)
    return total / measurements.length
  }
}
```

### Network Performance Debugging

```javascript
const networkDebugger = {
  requests: new Map(),

  intercept() {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const [url, options = {}] = args
      const requestId = Math.random().toString(36).substr(2, 9)

      const requestData = {
        id: requestId,
        url,
        method: options.method || 'GET',
        startTime: performance.now(),
        status: 'pending'
      }

      this.requests.set(requestId, requestData)
      console.log(`🚀 Request started: ${options.method || 'GET'} ${url}`)

      try {
        const response = await originalFetch(...args)

        const endTime = performance.now()
        const duration = endTime - requestData.startTime

        requestData.status = 'completed'
        requestData.duration = duration
        requestData.responseStatus = response.status

        console.log(`✅ Request completed: ${response.status} (${duration.toFixed(2)}ms)`)

        return response
      } catch (error) {
        const endTime = performance.now()
        const duration = endTime - requestData.startTime

        requestData.status = 'error'
        requestData.duration = duration
        requestData.error = error.message

        console.error(`❌ Request failed: ${error.message} (${duration.toFixed(2)}ms)`)

        throw error
      }
    }
  },

  getPendingRequests() {
    return Array.from(this.requests.values())
      .filter(req => req.status === 'pending')
  },

  getSlowRequests(threshold = 1000) {
    return Array.from(this.requests.values())
      .filter(req => req.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
  },

  getRequestStats() {
    const requests = Array.from(this.requests.values())
    const completed = requests.filter(req => req.status === 'completed')
    const failed = requests.filter(req => req.status === 'error')

    return {
      total: requests.length,
      completed: completed.length,
      failed: failed.length,
      averageDuration: completed.reduce((sum, req) => sum + req.duration, 0) / completed.length || 0,
      failureRate: (failed.length / requests.length * 100).toFixed(1) + '%'
    }
  }
}
```

## State Synchronization Debugging

### Store State Diffing

```javascript
const stateDiff = {
  calculate(oldState, newState, path = '') {
    const diffs = []

    // Handle different types
    if (typeof oldState !== typeof newState) {
      diffs.push({
        path,
        type: 'type-change',
        oldValue: oldState,
        newValue: newState
      })
      return diffs
    }

    // Handle null/undefined
    if (oldState === null || oldState === undefined) {
      if (oldState !== newState) {
        diffs.push({
          path,
          type: 'value-change',
          oldValue: oldState,
          newValue: newState
        })
      }
      return diffs
    }

    // Handle primitives
    if (typeof oldState !== 'object') {
      if (oldState !== newState) {
        diffs.push({
          path,
          type: 'value-change',
          oldValue: oldState,
          newValue: newState
        })
      }
      return diffs
    }

    // Handle arrays
    if (Array.isArray(oldState)) {
      if (oldState.length !== newState.length) {
        diffs.push({
          path: `${path}.length`,
          type: 'array-length-change',
          oldValue: oldState.length,
          newValue: newState.length
        })
      }

      const minLength = Math.min(oldState.length, newState.length)
      for (let i = 0; i < minLength; i++) {
        diffs.push(...this.calculate(oldState[i], newState[i], `${path}[${i}]`))
      }

      return diffs
    }

    // Handle objects
    const allKeys = new Set([...Object.keys(oldState), ...Object.keys(newState)])

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key

      if (!(key in oldState)) {
        diffs.push({
          path: currentPath,
          type: 'property-added',
          newValue: newState[key]
        })
      } else if (!(key in newState)) {
        diffs.push({
          path: currentPath,
          type: 'property-removed',
          oldValue: oldState[key]
        })
      } else {
        diffs.push(...this.calculate(oldState[key], newState[key], currentPath))
      }
    }

    return diffs
  },

  format(diffs) {
    return diffs.map(diff => {
      switch (diff.type) {
        case 'value-change':
          return `${diff.path}: ${JSON.stringify(diff.oldValue)} → ${JSON.stringify(diff.newValue)}`
        case 'property-added':
          return `${diff.path}: +${JSON.stringify(diff.newValue)}`
        case 'property-removed':
          return `${diff.path}: -${JSON.stringify(diff.oldValue)}`
        case 'array-length-change':
          return `${diff.path}: length ${diff.oldValue} → ${diff.newValue}`
        default:
          return `${diff.path}: ${diff.type}`
      }
    })
  }
}
```

### Cross-Store Dependency Tracking

```javascript
const storeDependencyTracker = {
  dependencies: new Map(),

  track(storeName, accessedStores) {
    if (!this.dependencies.has(storeName)) {
      this.dependencies.set(storeName, new Set())
    }

    accessedStores.forEach(accessedStore => {
      this.dependencies.get(storeName).add(accessedStore)
      console.log(`🔗 Store dependency: ${storeName} → ${accessedStore}`)
    })
  },

  getCircularDependencies() {
    const visited = new Set()
    const recursionStack = new Set()
    const cycles = []

    const dfs = (storeName, path = []) => {
      if (recursionStack.has(storeName)) {
        const cycleStart = path.indexOf(storeName)
        cycles.push(path.slice(cycleStart))
        return
      }

      if (visited.has(storeName)) return

      visited.add(storeName)
      recursionStack.add(storeName)

      const dependencies = this.dependencies.get(storeName) || new Set()
      dependencies.forEach(dep => dfs(dep, [...path, storeName]))

      recursionStack.delete(storeName)
    }

    this.dependencies.forEach((_, storeName) => {
      if (!visited.has(storeName)) {
        dfs(storeName)
      }
    })

    return cycles
  },

  visualizeDependencies() {
    const result = []

    this.dependencies.forEach((deps, store) => {
      deps.forEach(dep => {
        result.push(`${store} → ${dep}`)
      })
    })

    return result
  }
}
```

## Canvas-Specific Debugging

### Node State Debugging

```javascript
const canvasDebugger = {
  debugNodeStates(canvasStore) {
    const checkNodeConsistency = () => {
      const { nodes, selectedNodes } = canvasStore

      console.group('🎨 Canvas State Check')

      // Check selected nodes exist
      const invalidSelections = selectedNodes.filter(id =>
        !nodes.some(node => node.id === id)
      )

      if (invalidSelections.length > 0) {
        console.warn('Invalid selections:', invalidSelections)
      }

      // Check node positions
      const invalidPositions = nodes.filter(node =>
        typeof node.x !== 'number' || typeof node.y !== 'number'
      )

      if (invalidPositions.length > 0) {
        console.warn('Invalid node positions:', invalidPositions)
      }

      // Check for duplicate IDs
      const nodeIds = nodes.map(n => n.id)
      const duplicates = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index)

      if (duplicates.length > 0) {
        console.error('Duplicate node IDs:', duplicates)
      }

      console.log(`✅ Canvas state valid: ${nodes.length} nodes, ${selectedNodes.length} selected`)
      console.groupEnd()
    }

    // Subscribe to store changes
    canvasStore.$subscribe(() => {
      checkNodeConsistency()
    })

    // Initial check
    checkNodeConsistency()
  },

  debugViewport(canvasStore) {
    const { viewport } = storeToRefs(canvasStore)

    watch(viewport, (newViewport, oldViewport) => {
      console.group('🔍 Viewport Changed')
      console.log('From:', oldViewport)
      console.log('To:', newViewport)

      // Check for invalid values
      if (newViewport.zoom <= 0) {
        console.error('Invalid zoom level:', newViewport.zoom)
      }

      if (isNaN(newViewport.x) || isNaN(newViewport.y)) {
        console.error('Invalid viewport position:', newViewport)
      }

      console.groupEnd()
    }, { deep: true })
  },

  debugDragState(canvasStore) {
    const { isDragging, selectedNodes } = storeToRefs(canvasStore)

    watch([isDragging, selectedNodes], ([dragging, selected]) => {
      console.log(`🖱️ Drag state: ${dragging ? 'dragging' : 'idle'}, selected: ${selected.length} nodes`)

      // Warn if dragging with no selection
      if (dragging && selected.length === 0) {
        console.warn('Dragging detected but no nodes selected')
      }
    })
  }
}
```

## Async Operation Debugging

### Promise Chain Debugging

```javascript
const promiseDebugger = {
  activePromises: new Map(),

  debug(promise, description) {
    const id = Math.random().toString(36).substr(2, 9)

    this.activePromises.set(id, {
      promise,
      description,
      createdAt: Date.now(),
      status: 'pending'
    })

    console.log(`🅿️ Promise created: ${description} (${id})`)

    const debuggedPromise = promise
      .then(value => {
        const promiseInfo = this.activePromises.get(id)
        if (promiseInfo) {
          promiseInfo.status = 'resolved'
          promiseInfo.duration = Date.now() - promiseInfo.createdAt
          console.log(`✅ Promise resolved: ${description} (${promiseInfo.duration}ms)`)
        }
        return value
      })
      .catch(error => {
        const promiseInfo = this.activePromises.get(id)
        if (promiseInfo) {
          promiseInfo.status = 'rejected'
          promiseInfo.duration = Date.now() - promiseInfo.createdAt
          promiseInfo.error = error.message
          console.error(`❌ Promise rejected: ${description} (${promiseInfo.duration}ms)`, error)
        }
        throw error
      })
      .finally(() => {
        // Clean up after delay to allow inspection
        setTimeout(() => {
          this.activePromises.delete(id)
        }, 5000)
      })

    return debuggedPromise
  },

  getPendingPromises() {
    return Array.from(this.activePromises.values())
      .filter(p => p.status === 'pending')
  },

  getLeakedPromises(maxAge = 30000) {
    const now = Date.now()
    return Array.from(this.activePromises.values())
      .filter(p => now - p.createdAt > maxAge)
  },

  getStats() {
    const promises = Array.from(this.activePromises.values())
    const resolved = promises.filter(p => p.status === 'resolved')
    const rejected = promises.filter(p => p.status === 'rejected')
    const pending = promises.filter(p => p.status === 'pending')

    return {
      total: promises.length,
      resolved: resolved.length,
      rejected: rejected.length,
      pending: pending.length,
      averageDuration: resolved.reduce((sum, p) => sum + p.duration, 0) / resolved.length || 0
    }
  }
}
```

This debugging techniques guide provides advanced tools and strategies for identifying and resolving complex issues in Vue.js applications with Pinia stores.