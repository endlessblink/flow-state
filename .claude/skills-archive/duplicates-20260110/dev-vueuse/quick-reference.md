# VueUse Quick Reference

## Essential Composables for PomoFlow

### 🎯 Most Used
```typescript
import { useMagicKeys } from '@vueuse/core'
const { ctrl, shift, space, escape } = useMagicKeys()
// Enhanced keyboard shortcuts with automatic cleanup

import { useLocalStorage } from '@vueuse/core'
const settings = useLocalStorage('app-settings', defaults)
// Persistent settings with automatic JSON serialization

import { useThrottleFn } from '@vueuse/core'
const throttledUpdate = useThrottleFn(() => updateCanvas(), 16)
// Performance optimization for high-frequency operations
```

### 🖱️ Mouse & Pointer
```typescript
import { useMouse, usePointer, useElementSize } from '@vueuse/core'

const { x, y, pressed } = useMouse({ target: canvasRef })
// Reactive mouse position relative to element

const { pointerType } = usePointer()
// Distinguish between mouse, pen, and touch input

const { width, height } = useElementSize(containerRef)
// Reactive element dimensions
```

### ⌨️ Keyboard & Events
```typescript
import { useEventListener, useDocumentVisibility } from '@vueuse/core'

useEventListener('keydown', handleKeydown, { passive: true })
// Event listeners with automatic cleanup

const { isActive } = useDocumentVisibility()
// Track when tab is active/inactive

const { ctrl, alt, shift } = useKeyModifier()
// React to modifier keys
```

### 💾 Storage & Persistence
```typescript
import { useLocalStorage, useSessionStorage, useStorage } from '@vueuse/core'

const tasks = useLocalStorage('tasks', [], { mergeDefaults: true })
// Persistent across browser sessions

const uiState = useSessionStorage('ui-state', defaults)
// Cleared when session ends

const largeData = useStorage('big-data', [], indexedDB)
// Use IndexedDB for large datasets
```

### 🚀 Performance
```typescript
import { useThrottleFn, useDebounceFn, useRafFn } from '@vueuse/core'

const throttledScroll = useThrottleFn(handleScroll, 16)
// Limit function calls to ~60fps

const debouncedSearch = useDebounceFn(search, 300)
// Delay function execution until pause

const { start, stop } = useRafFn(animate)
// RequestAnimationFrame-based animations
```

### 📱 Responsive Design
```typescript
import { useWindowSize, useBreakpoints } from '@vueuse/core'

const { width, height } = useWindowSize()
// Reactive window dimensions

const breakpoints = useBreakpoints({
  mobile: 640,
  tablet: 1024,
  desktop: 1280
})

const isMobile = breakpoints.smaller('tablet')
const isDesktop = breakpoints.greaterOrEqual('desktop')
```

### 🌐 Browser APIs
```typescript
import { useClipboard, useNetwork, useNotification } from '@vueuse/core'

const { copy, copied, isSupported } = useClipboard()
// Clipboard access with permission handling

const { isOnline, connectionType } = useNetwork()
// Network status monitoring

const show = useNotification({ title: 'Timer Complete!' })
// Browser notifications
```

## Common Patterns

### Pattern 1: Enhanced Keyboard Shortcuts
```typescript
export const useKeyboardShortcuts = () => {
  const { ctrl, shift, space, enter } = useMagicKeys()

  watchEffect(() => {
    if (ctrl.value && space.value) {
      // Handle Ctrl+Space
    }
  })

  return { shortcuts: { 'Ctrl+Space': 'Action' } }
}
```

### Pattern 2: Auto-save with Debouncing
```typescript
export const useAutoSave = (data: Ref<any>) => {
  const save = useDebounceFn(() => {
    localStorage.setItem('auto-save', JSON.stringify(data.value))
  }, 1000)

  watch(data, save, { deep: true })

  return { save }
}
```

### Pattern 3: Canvas Interactions
```typescript
export const useCanvas = (canvasRef: Ref<HTMLElement>) => {
  const { x, y, pressed } = useMouse({ target: canvasRef })
  const { width, height } = useElementSize(canvasRef)

  const position = computed(() => ({
    x: (x.value / width.value) * 100,
    y: (y.value / height.value) * 100
  }))

  return { position, isPressed: pressed }
}
```

### Pattern 4: Responsive Sizing
```typescript
export const useResponsiveSizing = () => {
  const { width, height } = useWindowSize()
  const breakpoints = useBreakpoints({ mobile: 640, tablet: 1024 })

  const canvasSize = computed(() => ({
    width: width.value - (breakpoints.smaller('tablet') ? 0 : 320),
    height: height.value - 120
  }))

  return { canvasSize, isMobile: breakpoints.smaller('tablet') }
}
```

### Pattern 5: Data Persistence
```typescript
export const usePersistentState = <T>(key: string, defaults: T) => {
  const state = useLocalStorage(key, defaults, {
    serializer: JSON,
    mergeDefaults: true
  })

  const reset = () => {
    state.value = defaults
  }

  const exportState = () => JSON.stringify(state.value, null, 2)

  return { state, reset, exportState }
}
```

## Migration from Native Vue

### Before (Native Vue)
```typescript
// Manual event listener
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Manual debouncing
let timeoutId: number
const debouncedFn = (value: string) => {
  clearTimeout(timeoutId)
  timeoutId = setTimeout(() => search(value), 300)
}

// Manual storage handling
const settings = ref({})
onMounted(() => {
  const saved = localStorage.getItem('settings')
  if (saved) settings.value = JSON.parse(saved)
})

watch(settings, (newSettings) => {
  localStorage.setItem('settings', JSON.stringify(newSettings))
}, { deep: true })
```

### After (VueUse)
```typescript
// Automatic cleanup
useEventListener('keydown', handleKeydown, { passive: true })

// Built-in debouncing
const debouncedSearch = useDebounceFn(search, 300)

// Automatic persistence
const settings = useLocalStorage('settings', defaults, {
  serializer: JSON,
  mergeDefaults: true
})
```

## Performance Tips

### ✅ Do
```typescript
// Use throttle for high-frequency events
const throttledDrag = useThrottleFn(handleDrag, 16)

// Use debounce for user input
const debouncedSearch = useDebounceFn(performSearch, 300)

// Check browser support
const { isSupported } = useClipboard()
if (!isSupported) fallbackToManualCopy()

// Use RAF for animations
const { start, stop } = useRafFn(animate)
```

### ❌ Don't
```typescript
// Don't use VueUse for simple reactive state
const count = ref(0) // ✅ Native Vue is fine

// Don't forget to check permissions
await navigator.clipboard.writeText(text) // ❌ No permission check

// Don't use expensive operations in computed
const expensive = computed(() => heavyCalculation(data.value))
// ✅ Use useThrottleFn or memoization
```

## Browser Compatibility

### Always Check Support
```typescript
const { isSupported } = useClipboard()
if (!isSupported) {
  // Fallback behavior
  showCopyButton.value = true
}

const { isOnline } = useNetwork()
if (!isOnline) {
  // Offline mode
  enableOfflineMode.value = true
}
```

### SSR Safety
```typescript
export const useClientOnly = () => {
  const isClient = ref(false)

  onMounted(() => {
    isClient.value = true
  })

  return { isClient }
}

// Or use VueUse built-in
import { useHydration } from '@vueuse/core'
```

## Bundle Size Considerations

### Tree Shaking
```typescript
// ✅ Import only what you need
import { useMagicKeys, useLocalStorage } from '@vueuse/core'

// ❌ Avoid importing everything
import * as VueUse from '@vueuse/core'
```

### Alternative Libraries
For common cases, consider using native Vue instead:
- Simple state: `ref()`, `reactive()`
- Basic events: `@click`, `@input`
- Simple computed: `computed()`

Use VueUse for:
- Browser APIs
- Complex event handling
- Performance utilities
- Storage & persistence
- Responsive design