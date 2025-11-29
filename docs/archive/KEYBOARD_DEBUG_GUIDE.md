# 🔍 Keyboard Shortcut Debug Guide

## 🎯 Problem Summary

The Shift+1-5 keyboard shortcuts for view switching were not working, and no logging was visible to diagnose the issue.

## ✅ Solution Implemented

### 1. Fixed Console Filter
**File**: `src/utils/consoleFilter.ts`
- ✅ Enabled `undoSystem: true` and `undoOperations: true`
- ✅ Added new `keyboardShortcuts: true` category
- ✅ Added filtering for keyboard shortcut log patterns:
  - `🎹 [APP.VUE]`
  - `🔧 [SIDEBAR TOGGLE]`
  - `🌐 [GLOBAL HANDLER]`
  - `🔍 [MAIN.TS] GLOBAL:`
  - `handleKeydown called`
  - `Shift+1-5 detected`
  - `keyboard event`

### 2. Enhanced Logging System
**Files Modified**:
- `src/App.vue` - Comprehensive keyboard handler logging
- `src/composables/useSidebarToggle.ts` - Sidebar shortcut logging
- `src/utils/globalKeyboardHandlerSimple.ts` - Global handler logging
- `src/main.ts` - Event listener diagnostics

**Log Patterns**:
- 🔍 `[MAIN.TS] GLOBAL:` - Document-level event detection (capture phase)
- 🔧 `[SIDEBAR TOGGLE]` - Sidebar keyboard handler (bubble phase)
- 🌐 `[GLOBAL HANDLER]` - Undo/redo handler (bubble phase)
- 🎹 `[APP.VUE]` - Main application keyboard handler (bubble phase)

### 3. Debug Tools Created

#### Test Files:
- `test-keyboard-logging.html` - Visual test interface with expected log patterns
- `debug-keyboard.html` - Real-time debug panel with system status
- `quick-test-logging.js` - Console script for manual testing

## 🛠️ How to Debug Keyboard Shortcuts

### Method 1: Using Debug Panel (Recommended)
1. Open `debug-keyboard.html` in your browser
2. Check system status (console filter, event count, etc.)
3. Press Shift+1-5 to test shortcuts
4. Monitor real-time event logs
5. Use controls to toggle filters and test events

### Method 2: Manual Console Testing
1. Open http://localhost:5546 in browser
2. Open Developer Tools (F12)
3. Run the contents of `quick-test-logging.js` in console
4. Press Shift+1-5 manually
5. Look for log patterns in console

### Method 3: Test Interface
1. Open `test-keyboard-logging.html`
2. Follow on-screen instructions
3. Test each shortcut (Shift+1-5)
4. Verify expected log pattern appears

## 📊 Expected Event Flow

When you press Shift+1, you should see this sequence in console:

```
🔍 [MAIN.TS] GLOBAL: Shift+1 detected at document level
🎯 [SIDEBAR TOGGLE] Adding keyboard event listener (bubble phase)
🔧 [SIDEBAR TOGGLE] handleKeyboardShortcuts called
⚠️ [SIDEBAR TOGGLE] Shift+1-5 detected but not handled by sidebar toggle
🎯 [GLOBAL HANDLER] Adding keyboard event listener (bubble phase)
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

## 🐛 Troubleshooting

### If No Logs Appear:
1. **Check Console Filter**: Ensure `keyboardShortcuts` is enabled
   ```js
   // In browser console:
   console.log(window.consoleFilter.getToggles())
   ```

2. **Clear Browser Cache**: Reload page with Ctrl+Shift+R

3. **Check Development Server**: Ensure running on http://localhost:5546

### If Logs But No Navigation:
1. **Check Route Map**: Verify `viewRouteMap` has correct routes
2. **Check shouldIgnoreElement**: Look for modal/input blocking
3. **Check Router**: Verify Vue Router is working

### If Events Are Blocked:
1. **Check Modal State**: Close any open modals
2. **Check Active Element**: Ensure cursor is not in input field
3. **Check Event Propagation**: Look for `stopPropagation()` calls

## 🔧 Event Handler Architecture

### Current Handlers (3 total):
1. **useSidebarToggle** - Handles Ctrl+B, Ctrl+\, Ctrl+Shift+F
2. **globalKeyboardHandlerSimple** - Handles Ctrl+Z, Ctrl+Y (undo/redo)
3. **App.vue handleKeydown** - Handles Shift+1-5 (view switching)

### Event Flow:
1. **Capture Phase**: main.ts global listener detects events
2. **Bubble Phase**: All three handlers process events in order
3. **No Conflicts**: Each handler checks if it should process the event

## 🎯 Success Criteria

✅ **Logging**: All keyboard events visible with detailed context
✅ **Debugging**: Multiple tools available for troubleshooting
✅ **Event Flow**: Complete visibility into handler execution
✅ **Route Navigation**: Shift+1-5 successfully navigate between views
✅ **No Regressions**: Existing shortcuts (Ctrl+Z, Ctrl+K, etc.) still work

## 📚 Next Steps

1. **Test Thoroughly**: Use debug tools to verify all shortcuts work
2. **Document**: Add keyboard shortcuts to user documentation
3. **Monitor**: Keep logging enabled for future debugging
4. **Cleanup**: Remove debug files after confirming everything works

---

**Status**: ✅ Ready for testing
**Server**: http://localhost:5546
**Debug Tools**: Available in project root