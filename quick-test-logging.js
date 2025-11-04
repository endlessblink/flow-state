// Quick test to verify keyboard shortcut logging is working
// Run this in the browser console on http://localhost:5546

console.log('='.repeat(80));
console.log('🧪 KEYBOARD SHORTCUT LOGGING TEST');
console.log('='.repeat(80));

// Test 1: Check if console filter is working
console.log('🔍 Test 1: Console filter status');
if (window.consoleFilter) {
    console.log('✅ Console filter available:', window.consoleFilter.getToggles());
} else {
    console.log('❌ Console filter not available');
}

// Test 2: Manually trigger a keyboard event to see if logging works
console.log('🔍 Test 2: Manual keyboard event trigger');
const testEvent = new KeyboardEvent('keydown', {
    key: '1',
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true
});

console.log('🎹 Dispatching Shift+1 event to window...');
window.dispatchEvent(testEvent);

// Test 3: Check if event listeners are attached
console.log('🔍 Test 3: Checking for event listeners');
const eventListeners = getEventListeners ? getEventListeners(window) : 'Not available';
console.log('📋 Window event listeners:', eventListeners);

// Test 4: Check current route
console.log('🔍 Test 4: Current application state');
console.log('📍 Current URL:', window.location.href);
console.log('🔍 Active element:', document.activeElement);

console.log('='.repeat(80));
console.log('📝 Instructions:');
console.log('1. Open browser console (F12)');
console.log('2. Look for logs with prefixes: 🔍, 🎹, 🔧, 🌐');
console.log('3. Try pressing Shift+1, Shift+2, etc. manually');
console.log('4. Check if any logs appear in console');
console.log('='.repeat(80));