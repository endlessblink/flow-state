# 🔍 VUE 3 KEYBOARD SHORTCUT DEBUGGING - COMPREHENSIVE TECHNICAL QUERY

## 🎯 PROJECT OVERVIEW

**Pomo-Flow** is a sophisticated Vue 3.4.0 productivity application combining Pomodoro timer functionality with task management across multiple views (Board, Calendar, Canvas). We're experiencing critical issues with keyboard shortcut debugging where Shift+1-5 view switching shortcuts are not working, and console logging is being suppressed by our custom filtering system.

## 🛠️ TECHNICAL STACK & ENVIRONMENT

- **Framework**: Vue 3.4.0 with Composition API and `<script setup>` syntax
- **Language**: TypeScript 5.9.3
- **Build Tool**: Vite 7.1.10
- **State Management**: Pinia 2.1.7
- **UI Components**: Naive UI 2.43.1 with Tailwind CSS
- **Development Server**: http://localhost:5546 (with port conflict resolution)
- **Testing**: Playwright MCP, Vitest
- **Console Filtering**: Custom logging system in `src/utils/consoleFilter.ts`

## 🏗️ CURRENT KEYBOARD HANDLER ARCHITECTURE

We have a **4-tier keyboard event handling system**:

### **Handler 1: Global Document Listener (Capture Phase)**
**File**: `src/main.ts` (lines 65-77)
```typescript
// Add global keyboard event diagnostics to track all keyboard events
console.log('🔍 [MAIN.TS] Setting up global keyboard event diagnostics...')
window.addEventListener('keydown', (event) => {
  // Only log Shift+1-5 events to avoid console spam
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key >= '1' && event.key <= '5') {
    console.log('🔍 [MAIN.TS] GLOBAL: Shift+' + event.key + ' detected at document level:', {
      eventPhase: event.eventPhase,
      target: event.target,
      currentTarget: event.currentTarget,
      timestamp: new Date().toISOString(),
      bubbles: event.bubbles,
      cancelable: event.cancelable
    })
  }
}, true) // CAPTURE PHASE
```

### **Handler 2: Sidebar Toggle Handler (Bubble Phase)**
**File**: `src/composables/useSidebarToggle.ts`
```typescript
const handleKeyboardShortcuts = (event: KeyboardEvent) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? event.metaKey : event.ctrlKey

  // Comprehensive logging for sidebar keyboard shortcut debugging
  console.log('🔧 [SIDEBAR TOGGLE] handleKeyboardShortcuts called:', {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    isMac,
    modKey,
    target: event.target,
    targetTagName: (event.target as HTMLElement)?.tagName,
    timestamp: new Date().toISOString()
  })

  // Skip if typing in input/textarea
  const isInputField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
  if (isInputField) {
    console.log('❌ [SIDEBAR TOGGLE] Keyboard shortcut blocked - target is input field')
    return
  }

  // Check if this is Shift+1-5 that might interfere with App.vue
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key >= '1' && event.key <= '5') {
    console.log('⚠️ [SIDEBAR TOGGLE] Shift+1-5 detected but not handled by sidebar toggle - this should be handled by App.vue')
  }

  // Handles: Ctrl/Cmd+B (toggle sidebar), Ctrl/Cmd+\ (toggle secondary sidebar), Ctrl/Cmd+Shift+F (focus mode), Escape (exit focus mode)
}

onMounted(() => {
  console.log('🎯 [SIDEBAR TOGGLE] Adding keyboard event listener (bubble phase)')
  window.addEventListener('keydown', handleKeyboardShortcuts)
})
```

### **Handler 3: Global Undo/Redo Handler (Bubble Phase)**
**File**: `src/utils/globalKeyboardHandlerSimple.ts`
```typescript
private handleKeydown(event: KeyboardEvent): void {
  // Comprehensive logging for global keyboard handler debugging
  console.log('🌐 [GLOBAL HANDLER] handleKeydown called (bubble phase):', {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    target: event.target,
    targetTagName: (event.target as HTMLElement)?.tagName,
    timestamp: new Date().toISOString()
  })

  // Check if we should ignore this element
  const shouldIgnore = this.shouldIgnoreElement(event.target as Element)
  if (shouldIgnore) {
    console.log('❌ [GLOBAL HANDLER] Event blocked by shouldIgnoreElement')
    return
  }

  // Check if this is Shift+1-5 that might interfere with App.vue
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key >= '1' && event.key <= '5') {
    console.log('⚠️ [GLOBAL HANDLER] Shift+1-5 detected but not handled by global handler - should be handled by App.vue')
  }

  // Handles: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+Shift+Z (redo)
}

// Event listener setup:
console.log('🎯 [GLOBAL HANDLER] Adding keyboard event listener (bubble phase)')
window.addEventListener('keydown', this.keydownHandler, false) // BUBBLE PHASE
```

### **Handler 4: Main Application Handler (Bubble Phase)**
**File**: `src/App.vue` (lines 1260-1356)
```typescript
// Keyboard shortcut handlers
const handleKeydown = (event: KeyboardEvent) => {
  // Comprehensive logging for keyboard shortcut debugging
  console.log('🎹 [APP.VUE] handleKeydown called:', {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    target: event.target,
    targetTagName: (event.target as HTMLElement)?.tagName,
    timestamp: new Date().toISOString()
  })

  // Check if we should ignore keyboard shortcuts
  const target = event.target as HTMLElement
  const shouldIgnore = shouldIgnoreElement(target)
  console.log('🚫 [APP.VUE] shouldIgnoreElement result:', shouldIgnore, {
    targetElement: target,
    isInput: target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.contentEditable === 'true',
    isInModal: !!target?.closest('[role="dialog"], .modal, .n-modal')
  })

  if (shouldIgnore) {
    console.log('❌ [APP.VUE] Keyboard shortcut blocked by shouldIgnoreElement')
    return
  }

  // ... other shortcuts (Ctrl+K, Ctrl+P, etc.) ...

  // Shift+1-5 for view switching
  console.log('🔍 [APP.VUE] Checking Shift+1-5 condition:', {
    isShift: event.shiftKey,
    noCtrl: !event.ctrlKey,
    noMeta: !event.metaKey,
    noAlt: !event.altKey,
    key: event.key,
    conditionMet: event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
  })

  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const key = event.key
    console.log('🔢 [APP.VUE] Shift+number detected, key:', key, 'Checking range 1-5...')

    if (key >= '1' && key <= '5') {
      console.log('✅ [APP.VUE] Key', key, 'is in range 1-5. Looking up route...')
      const route = viewRouteMap[key as keyof typeof viewRouteMap]
      console.log('🗺️ [APP.VUE] Route lookup result:', { key, route, availableRoutes: viewRouteMap })

      if (route) {
        console.log('🚀 [APP.VUE] Route found! Attempting navigation to:', route)
        console.log('📍 [APP.VUE] Current route before navigation:', router.currentRoute.value.path)

        event.preventDefault()

        try {
          router.push(route)
          console.log('✅ [APP.VUE] Navigation command sent successfully to:', route)
        } catch (error) {
          console.error('❌ [APP.VUE] Navigation failed:', error)
        }
      } else {
        console.log('❌ [APP.VUE] No route found for key:', key)
      }
    } else {
      console.log('❌ [APP.VUE] Key', key, 'is not in range 1-5')
    }
  }
}

// Event listener setup:
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
```

## 🚨 CRITICAL ISSUE: CONSOLE FILTER SYSTEM PROBLEM

### **Current Console Filter Configuration**
**File**: `src/utils/consoleFilter.ts` (lines 15-28)
```typescript
interface LogToggles {
  timer: boolean
  tabUpdate: boolean
  taskFiltering: boolean
  taskUpdates: boolean
  undoSystem: boolean
  undoOperations: boolean
  canvasResize: boolean
  canvasDrag: boolean
  taskNodeTimer: boolean
  database: boolean
  cloudSync: boolean
  storage: boolean
}
```

### **Default Toggle Settings** (lines 41-54)
```typescript
let logToggles: LogToggles = {
  timer: false,
  tabUpdate: false,
  taskFiltering: true,
  taskUpdates: false,
  undoSystem: false,        // ❌ PROBLEM: This should be true for keyboard debugging
  undoOperations: false,   // ❌ PROBLEM: This should be true for keyboard debugging
  canvasResize: false,
  canvasDrag: false,
  taskNodeTimer: false,
  database: false,
  cloudSync: false,
  storage: false,
}
```

### **Missing Filter Implementation**
**Problem**: There's NO `keyboardShortcuts` toggle in the interface, but our debug tools try to access it:

**Debug HTML Reference** (in `debug-keyboard.html`):
```javascript
if (appFrame.contentWindow && appFrame.contentWindow.consoleFilter) {
    const toggles = appFrame.contentWindow.consoleFilter.getToggles();
    statusItems.push({
        title: 'Console Filter',
        status: toggles.keyboardShortcuts ? 'good' : 'warning',  // ❌ UNDEFINED PROPERTY
        details: `Keyboard shortcuts: ${toggles.keyboardShortcuts ? '✅ Enabled' : '❌ Disabled'}`
    });
}
```

**Filter Function Missing Keyboard Patterns** (lines 122-155):
```typescript
// Current filters only cover:
if (!logToggles.undoSystem) {
  if (msg.includes('🔍 [DEBUG] getUndoSystem') ||
      msg.includes('🔄 Loading unified undo/redo system')) {
    return true
  }
}

// ❌ MISSING: No keyboardShortcuts filter implementation
// Should filter patterns like:
// - '🎹 [APP.VUE]'
// - '🔧 [SIDEBAR TOGGLE]'
// - '🌐 [GLOBAL HANDLER]'
// - '🔍 [MAIN.TS] GLOBAL:'
// - 'handleKeydown called'
// - 'Shift+1-5 detected'
```

## 🐛 CURRENT SYMPTOMS & BEHAVIOR

### **Expected Event Flow**:
```
🔍 [MAIN.TS] GLOBAL: Shift+1 detected at document level (capture phase)
🔧 [SIDEBAR TOGGLE] handleKeyboardShortcuts called
⚠️ [SIDEBAR TOGGLE] Shift+1-5 detected but not handled by sidebar toggle
🌐 [GLOBAL HANDLER] handleKeydown called (bubble phase)
⚠️ [GLOBAL HANDLER] Shift+1-5 detected but not handled by global handler
🎹 [APP.VUE] handleKeydown called
🚫 [APP.VUE] shouldIgnoreElement result: false
🔍 [APP.VUE] Checking Shift+1-5 condition
✅ [APP.VUE] Key 1 is in range 1-5. Looking up route...
🗺️ [APP.VUE] Route lookup result: {key: "1", route: "/"}
🚀 [APP.VUE] Route found! Attempting navigation to: /
✅ [APP.VUE] Navigation command sent successfully to: /
```

### **Actual Behavior**:
```
// ❌ NO LOGS VISIBLE - console filter suppressing all keyboard events
// ❌ NO NAVIGATION OCCURRING - events not reaching handlers or being blocked
// ❌ DEBUG PANEL SHOWS INCORRECT STATUS - undefined keyboardShortcuts property
```

## 🔧 DEBUG TOOLS CREATED

### **1. Debug Panel** (`debug-keyboard.html`)
- Real-time event monitoring
- System status display
- Cross-origin iframe testing
- Console filter toggle controls

### **2. Test Interface** (`test-keyboard-logging.html`)
- Visual keyboard shortcut testing
- Expected log pattern display
- Route navigation verification

### **3. Console Script** (`quick-test-logging.js`)
- Manual testing script
- Event listener diagnostics
- System status checking

## 🎯 SPECIFIC TECHNICAL QUESTIONS FOR VUE.JS EXPERTS

### **1. Console Filter Architecture**
- **How do we properly add the missing `keyboardShortcuts` toggle to the LogToggles interface without breaking existing configurations?**
- **What's the correct pattern for adding new filter categories to the `shouldFilter()` function?**
- **Should we enable keyboard logging by default in development, or make it opt-in?**
- **How to handle localStorage migration when adding new toggle properties?**

### **2. Event Handler Architecture**
- **Is our 4-handler architecture (capture + 3 bubble) optimal or over-engineered for keyboard shortcuts?**
- **Could the global document listener be causing timing conflicts with bubble-phase handlers?**
- **Should we consolidate handlers or maintain separation of concerns (sidebar vs undo vs navigation)?**
- **What's the best practice for preventing event handler conflicts in Vue 3 applications?**

### **3. Debug Tool Implementation**
- **Best practices for cross-origin console access in debug panels?**
- **How to create reliable keyboard event testing without iframe restrictions?**
- **Alternative approaches to real-time debugging that work with browser security policies?**

### **4. Performance & Production Considerations**
- **Are the extensive console logs impacting performance in development?**
- **Should the logging be environment-gated (development only) with production-safe patterns?**
- **How to implement conditional logging that doesn't require manual filter management?**

## 🛠️ IMPLEMENTATION GUIDANCE NEEDED

### **Step-by-Step Console Filter Fix Required**:
1. **Add `keyboardShortcuts: boolean` to LogToggles interface**
2. **Set default value to `true` in development**
3. **Implement filter patterns for all keyboard log prefixes**
4. **Add localStorage migration for existing configurations**
5. **Update debug tools to handle undefined properties gracefully**

### **Complete Code Examples Needed**:
- **Fixed console filter interface and implementation**
- **Proper keyboard event testing methodology**
- **Debug tool improvements for cross-origin scenarios**
- **Production-safe logging patterns**

### **Testing Strategy**:
- **How to verify keyboard shortcuts work end-to-end**
- **Browser compatibility testing for event handling**
- **Performance impact assessment of extensive logging**

## 📊 CURRENT DEVELOPMENT ENVIRONMENT

- **Server**: Running on http://localhost:5546
- **Build System**: Vite with hot reload
- **Console Filtering**: Custom system with localStorage persistence
- **Debug Tools**: Multiple HTML files with iframe-based testing
- **Current Status**: ❌ Keyboard shortcuts non-functional due to console filter configuration

## 🎯 EXPECTED OUTCOME FROM EXPERT GUIDANCE

We need specific, implementable solutions for:
1. **Complete console filter fix** with code examples
2. **Keyboard shortcut testing methodology** that works reliably
3. **Debug tool improvements** to handle current technical limitations
4. **Architecture recommendations** for event handling in Vue 3
5. **Production deployment strategy** for the debugging system

The goal is to make Shift+1-5 keyboard shortcuts work reliably with comprehensive debugging capabilities that help us identify and resolve future keyboard-related issues quickly.

---

**Technical Context Summary**: Vue 3.4.0 application with complex 4-tier keyboard event system, custom console filtering, and cross-origin debug tools. Primary issue is missing console filter configuration causing log suppression and preventing keyboard shortcut debugging.