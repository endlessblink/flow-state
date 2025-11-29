# Debugging Troubleshooting Checklist

## Quick Diagnostic Flow

### Step 1: Identify the Symptom
- [ ] **UI not updating**: Components not re-rendering when state changes
- [ ] **Performance issues**: Slow renders, high memory usage
- [ ] **State inconsistency**: State appears different than expected
- [ ] **Memory leaks**: Memory usage increases over time
- [ ] **Async issues**: Promises, timers, or network requests not working
- [ ] **Canvas problems**: Drag/drop, selection, or viewport issues

### Step 2: Isolate the Problem Area
- [ ] **Component-level**: Check individual component reactivity
- [ ] **Store-level**: Verify Pinia store state and actions
- [ ] **Network-level**: Check API calls and data flow
- [ ] **Browser-level**: Examine console errors and network tab
- [ ] **Memory-level**: Monitor memory usage and garbage collection

### Step 3: Apply Debugging Tools
- [ ] **Vue DevTools**: Component inspection and timeline
- [ ] **Console logging**: Strategic log placement
- [ ] **Performance profiling**: Measure render times
- [ ] **Network monitoring**: Check request/response cycles
- [ ] **Memory profiling**: Identify leaks and usage patterns

## Symptom-Specific Checklists

### Reactivity Issues

#### Components Not Updating
```javascript
// ✅ Check these items:
- [ ] Are you using `ref()` for primitive values?
- [ ] Are you using `reactive()` for objects?
- [ ] Are you accessing `.value` correctly in setup()?
- [ ] Are you destructuring reactive objects (breaks reactivity)?
- [ ] Are you using `v-memo` unnecessarily?
- [ ] Are computed dependencies correct?
- [ ] Are watchers configured with proper options?
```

**Debug Script:**
```javascript
const debugReactivity = (ref, name) => {
  console.log(`${name} initial:`, ref.value)

  const stopWatch = watch(ref, (newVal, oldVal) => {
    console.log(`${name} changed:`, oldVal, '→', newVal)
  }, { immediate: true })

  return stopWatch
}
```

#### Array/Object Mutations Not Working
```javascript
// ✅ Check these items:
- [ ] Using `push()`/`pop()`/`splice()` instead of direct index assignment?
- [ ] Using `Vue.set()` or `Object.assign()` for new properties?
- [ ] Using `reactive()` instead of `ref()` for objects?
- [ ] Not reassigning entire arrays/objects (breaks reactivity)?
```

**Debug Script:**
```javascript
const debugArrayMutations = (arrayRef, name) => {
  const originalPush = arrayRef.value.push
  arrayRef.value.push = function(...args) {
    console.log(`${name}.push:`, args)
    return originalPush.apply(this, args)
  }
}
```

### Performance Issues

#### Slow Renders
```javascript
// ✅ Check these items:
- [ ] Large lists without virtualization?
- [ ] Expensive computations in templates?
- [ ] Too many re-renders (check Vue DevTools timeline)?
- [ ] Deep watchers causing cascading updates?
- [ ] Missing `v-memo` for expensive components?
- [ ] Heavy computations in computed properties?
```

**Debug Script:**
```javascript
const measureRender = (componentName) => {
  const start = performance.now()
  nextTick(() => {
    const end = performance.now()
    console.log(`⏱️ ${componentName} render: ${(end - start).toFixed(2)}ms`)
  })
}
```

#### Memory Leaks
```javascript
// ✅ Check these items:
- [ ] Unmanaged event listeners?
- [ ] Uncleaned up intervals/timeouts?
- [ ] Store subscriptions not unsubscribed?
- [ ] External library instances not disposed?
- [ ] Component references in global scope?
```

**Debug Script:**
```javascript
const memoryLeakDetector = {
  intervals: new Set(),
  timeouts: new Set(),
  listeners: new Set(),

  track(type, cleanupFn) {
    this[type].add(cleanupFn)
    console.log(`📊 Tracking ${type}:`, this[type].size)
  },

  cleanup() {
    console.log('🧹 Cleaning up:', {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      listeners: this.listeners.size
    })

    this.intervals.forEach(clearInterval)
    this.timeouts.forEach(clearTimeout)
    this.listeners.forEach(fn => fn())

    this.intervals.clear()
    this.timeouts.clear()
    this.listeners.clear()
  }
}
```

### Store Issues

#### Pinia State Not Updating
```javascript
// ✅ Check these items:
- [ ] Using `$patch()` for multiple updates?
- [ ] Actions properly mutating state?
- [ ] Store instance shared across components?
- [ ] Persistence plugins interfering with state?
- [ ] SSR hydration conflicts?
```

**Debug Script:**
```javascript
const debugStore = (store, name) => {
  console.log(`🏪 ${name} initial state:`, JSON.parse(JSON.stringify(store.$state)))

  store.$subscribe((mutation, state) => {
    console.group(`🔄 ${name} mutation`)
    console.log('Type:', mutation.type)
    console.log('Payload:', mutation.payload)
    console.log('State:', JSON.parse(JSON.stringify(state)))
    console.groupEnd()
  })
}
```

#### Persistence/Hydration Issues
```javascript
// ✅ Check these items:
- [ ] LocalStorage values being overridden?
- [ ] Server-side state conflicting with client state?
- [ ] Serialization/deserialization errors?
- [ ] Storage quota exceeded?
- [ ] Privacy mode blocking storage?
```

**Debug Script:**
```javascript
const debugStorage = (key) => {
  const getStorageInfo = () => {
    try {
      const raw = localStorage.getItem(key)
      const parsed = JSON.parse(raw || 'null')
      console.log(`📦 ${key}:`, { raw, parsed })
      return parsed
    } catch (error) {
      console.error(`❌ ${key} parse error:`, error)
      return null
    }
  }

  // Monitor storage changes
  window.addEventListener('storage', (e) => {
    if (e.key === key) {
      console.log(`🔄 ${key} changed:`, e.oldValue, '→', e.newValue)
    }
  })

  return { getStorageInfo }
}
```

### Canvas Issues

#### Drag/Drop Not Working
```javascript
// ✅ Check these items:
- [ ] Event handlers properly attached?
- [ ] Coordinate system correct (client vs canvas)?
- [ ] Hit detection working for mouse position?
- [ ] State updates triggering re-renders?
- [ ] Event propagation prevented correctly?
```

**Debug Script:**
```javascript
const debugCanvasEvents = (canvasElement) => {
  const logEvent = (e) => {
    console.log(`🖱️ ${e.type}:`, {
      client: { x: e.clientX, y: e.clientY },
      canvas: {
        x: e.offsetX,
        y: e.offsetY,
        rect: canvasElement.getBoundingClientRect()
      },
      buttons: e.buttons,
      target: e.target
    })
  }

  ;['mousedown', 'mousemove', 'mouseup', 'click'].forEach(eventType => {
    canvasElement.addEventListener(eventType, logEvent)
  })
}
```

#### Selection Issues
```javascript
// ✅ Check these items:
- [ ] Selection state properly synced with UI?
- [ ] Multi-selection logic working?
- [ ] Keyboard shortcuts handled correctly?
- [ ] Selection persistence across operations?
- [ ] Hit detection for non-rectangular elements?
```

**Debug Script:**
```javascript
const debugSelection = (canvasStore) => {
  watch(
    () => canvasStore.selectedNodes,
    (selected, oldSelected) => {
      console.group('🎯 Selection changed')
      console.log('From:', oldSelected)
      console.log('To:', selected)
      console.log('Available nodes:', canvasStore.nodes.map(n => ({ id: n.id, name: n.name })))
      console.groupEnd()
    },
    { deep: true }
  )
}
```

### Async Issues

#### Promise Chains Breaking
```javascript
// ✅ Check these items:
- [ ] Error handling in promise chains?
- [ ] Race conditions between async operations?
- [ ] Memory leaks from unresolved promises?
- [ ] Proper cleanup on component unmount?
- [ ] Timeout handling for long operations?
```

**Debug Script:**
```javascript
const debugAsync = () => {
  const active = new Map()

  const track = (promise, description) => {
    const id = Math.random().toString(36).substr(2, 9)
    active.set(id, { promise, description, start: Date.now() })

    console.log(`⏳ Async started: ${description} (${id})`)

    promise
      .then(result => {
        const duration = Date.now() - active.get(id).start
        console.log(`✅ Async resolved: ${description} (${duration}ms)`)
        active.delete(id)
      })
      .catch(error => {
        const duration = Date.now() - active.get(id).start
        console.error(`❌ Async rejected: ${description} (${duration}ms)`, error)
        active.delete(id)
      })

    return promise
  }

  // Check for leaks every 10 seconds
  setInterval(() => {
    if (active.size > 0) {
      console.warn(`⚠️ ${active.size} pending async operations:`, Array.from(active.entries()))
    }
  }, 10000)

  return { track }
}
```

#### Network Requests Failing
```javascript
// ✅ Check these items:
- [ ] API endpoints correct and accessible?
- [ ] Authentication headers properly set?
- [ ] Request/response data format correct?
- [ ] Error handling for network failures?
- [ ] Timeout handling implemented?
```

**Debug Script:**
```javascript
const debugNetwork = () => {
  const originalFetch = window.fetch

  window.fetch = async (...args) => {
    const [url, options = {}] = args
    const start = performance.now()

    console.log(`🌐 Request: ${options.method || 'GET'} ${url}`, options)

    try {
      const response = await originalFetch(...args)
      const duration = performance.now() - start

      console.log(`✅ Response: ${response.status} (${duration.toFixed(2)}ms)`)

      // Clone response to avoid consuming it
      const cloned = response.clone()
      cloned.text().then(text => {
        try {
          const data = JSON.parse(text)
          console.log('📄 Response data:', data)
        } catch {
          console.log('📄 Response text:', text)
        }
      })

      return response
    } catch (error) {
      const duration = performance.now() - start
      console.error(`❌ Network error: ${error.message} (${duration.toFixed(2)}ms)`)
      throw error
    }
  }
}
```

## Emergency Debug Scripts

### All-in-One Debug Setup
```javascript
const setupComprehensiveDebugging = () => {
  console.log('🚀 Setting up comprehensive debugging...')

  // 1. Reactivity debugging
  window.debugReactivity = debugReactivity

  // 2. Performance monitoring
  window.measureRender = measureRender
  window.memoryLeakDetector = memoryLeakDetector

  // 3. Store debugging
  window.debugStore = debugStore

  // 4. Storage debugging
  window.debugStorage = debugStorage

  // 5. Canvas debugging
  window.debugCanvasEvents = debugCanvasEvents
  window.debugSelection = debugSelection

  // 6. Async debugging
  const asyncDebugger = debugAsync()
  window.trackAsync = asyncDebugger.track

  // 7. Network debugging
  debugNetwork()

  console.log('✅ Debugging tools ready!')
  console.log('Available globals:', {
    debugReactivity: 'Debug reactive references',
    measureRender: 'Measure component render times',
    memoryLeakDetector: 'Track memory leaks',
    debugStore: 'Debug Pinia store mutations',
    debugStorage: 'Debug localStorage/sessionStorage',
    debugCanvasEvents: 'Debug canvas mouse events',
    debugSelection: 'Debug canvas selection changes',
    trackAsync: 'Track async operations'
  })
}

// Auto-setup in development
if (process.env.NODE_ENV === 'development') {
  setupComprehensiveDebugging()
}
```

### Quick Health Check
```javascript
const quickHealthCheck = () => {
  console.group('🔍 PomoFlow Health Check')

  // Check Vue DevTools
  const hasDevTools = !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__
  console.log('Vue DevTools:', hasDevTools ? '✅ Connected' : '❌ Not found')

  // Check memory usage
  if (performance.memory) {
    const memory = performance.memory
    console.log('Memory usage:', {
      used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
    })
  }

  // Check active elements
  const activeElements = document.querySelectorAll(':hover, :focus, :active')
  console.log('Active elements:', activeElements.length)

  // Check performance timing
  const navigation = performance.getEntriesByType('navigation')[0]
  if (navigation) {
    console.log('Page load time:', `${navigation.loadEventEnd - navigation.fetchStart}ms`)
  }

  console.groupEnd()
}

// Run health check every 30 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(quickHealthCheck, 30000)
}
```

This troubleshooting checklist provides systematic approaches to diagnose and resolve common issues in Vue.js applications with Pinia stores.